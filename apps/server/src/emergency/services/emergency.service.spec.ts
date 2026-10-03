import { CallGateway } from '../call/call.gateway';
import { ContactsService } from './contacts.service';
import { EmergencyService } from './emergency.service';
import { EmergencyRepository } from '../repository/emergency.repository';
import { MemoryStore } from '../repository/memory.store';
import { EmergencyContact } from '../emergency.types';
import { ReportService } from './report.service';

/** 测试中把振铃超时与转拨间隔压到最短 */
process.env.CALL_RING_TIMEOUT_MS = '150';
process.env.CALL_NEXT_GAP_MS = '20';

function build() {
  const store = new MemoryStore();
  const repo = new EmergencyRepository(store);
  const gateway = new CallGateway();
  const contacts = new ContactsService(repo);
  const service = new EmergencyService(repo, gateway);
  return { store, repo, gateway, contacts, service };
}

function makeChain(repo: EmergencyRepository, elderId: string) {
  const types = ['family', 'family', 'doctor', 'property'] as const;
  return types.map((type, i) =>
    repo.saveContact({
      id: `c${i + 1}`,
      elderId,
      name: `联系人${i + 1}`,
      relation: '',
      type,
      phone: `1380000${1000 + i}`,
      priority: i + 1,
      enabled: true,
      familyToken: type === 'family' ? `ft-${i + 1}` : null,
      createdAt: new Date(2026, 0, i + 1).toISOString(),
    }),
  );
}

function makeElderAndChain(repo: EmergencyRepository) {
  repo.saveElder({
    id: 'e1',
    name: '测试老人',
    gender: 'female',
    age: 80,
    room: '1-1-1',
    address: '',
    phone: '13900000000',
    createdAt: new Date().toISOString(),
  });
  return makeChain(repo, 'e1');
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('EmergencyService 分级呼叫', () => {
  it('联系人按优先级排队，顺序正确', () => {
    const { repo } = build();
    makeElderAndChain(repo);
    const chain = repo.getCascadeChain('e1');
    expect(chain.map((c: EmergencyContact) => c.priority)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('第一位无人接听时，自动转拨下一位，直到有人接通', async () => {
    const { repo, service } = build();
    makeElderAndChain(repo);
    const event = service.trigger('e1', 'fall', '卫生间跌倒');

    await service.startCascade(event.id);

    // 第 1 位振铃中：手动标记无人接听 → 应自动转第 2 位
    await wait(30);
    let detail = service.getEventDetail(event.id);
    expect(detail.ringingAttemptId).toBeTruthy();
    const first = detail.attempts.find((a) => a.sequence === 1)!;
    service.settleCall(event.id, first.id, 'no_answer');

    // 第 2 位：标记接通 → 级联停止
    await wait(60);
    detail = service.getEventDetail(event.id);
    const second = detail.attempts.find((a) => a.sequence === 2)!;
    expect(second.stage).toBe('ringing');
    service.settleCall(event.id, second.id, 'answered', 42, '儿子已接听并赶回');

    await wait(30);
    const updated = service.getEventOrThrow(event.id);
    expect(updated.status).toBe('answered');
    expect(updated.answeredContactId).toBe('c2');

    const attempts = repo.listAttempts(event.id);
    // 不应该继续呼叫第 3、4 位
    expect(attempts.map((a) => a.sequence)).toEqual([1, 2]);
    expect(attempts[0].outcome).toBe('no_answer');
    expect(attempts[1].outcome).toBe('answered');
    expect(attempts[1].talkSeconds).toBe(42);
  });

  it('全部联系人都未接听时，事件标记为 failed', async () => {
    const { repo, service } = build();
    makeElderAndChain(repo);
    const event = service.trigger('e1', 'fire', '厨房冒烟');

    await service.startCascade(event.id);
    // 不做任何人工干预，等待 4 位联系人各自超时
    await wait(150 * 4 + 20 * 4 + 200);

    const updated = service.getEventOrThrow(event.id);
    expect(updated.status).toBe('failed');
    const attempts = repo.listAttempts(event.id);
    expect(attempts).toHaveLength(4);
    expect(attempts.every((a) => a.outcome === 'no_answer')).toBe(true);
  });

  it('没有启用的联系人时拒绝发起呼叫', async () => {
    const { repo, service } = build();
    makeElderAndChain(repo);
    repo
      .listContacts('e1')
      .forEach((c) => repo.saveContact({ ...c, enabled: false }));
    const event = service.trigger('e1', 'illness');
    await expect(service.startCascade(event.id)).rejects.toThrow(/紧急联系人/);
  });

  it('家属报告只能看到自己的拨打记录，看不到其他联系人', async () => {
    const { repo, service } = build();
    makeElderAndChain(repo);
    const report = new ReportService(repo);

    const event = service.trigger('e1', 'fall');
    await service.startCascade(event.id);
    await wait(30);
    const first = service.getEventDetail(event.id).attempts[0];
    service.settleCall(event.id, first.id, 'no_answer');
    await wait(60);
    const second = service.getEventDetail(event.id).attempts[1];
    service.settleCall(event.id, second.id, 'answered');
    await wait(30);
    service.resolveEvent(event.id, '已送医，无大碍');

    const familyReport = report.buildFamilyReport(event.id, 'c2');
    expect(familyReport.scope).toBe('family');
    expect(familyReport.lines).toHaveLength(1);
    expect(familyReport.lines[0].contactName).toBe('联系人2');
    expect(familyReport.lines[0].selfAnswered).toBe(true);
    // 不泄露其他联系人姓名
    expect(JSON.stringify(familyReport)).not.toContain('联系人1');
    expect(JSON.stringify(familyReport)).not.toContain('联系人3');

    const staffReport = report.buildStaffReport(event.id);
    expect(staffReport.lines).toHaveLength(2);
  });
});
