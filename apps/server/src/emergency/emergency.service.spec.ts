import { EmergencyService } from './emergency.service';
import { DialerService } from './dialer.service';
import { ReportsService } from '../reports/reports.service';
import { EmergencyRepository } from '../common/repository';
import {
  CallAttempt,
  Contact,
  Elder,
  EmergencyEvent,
  EventReport,
} from '../common/types';

/** 极简内存假仓储 */
class FakeRepo extends EmergencyRepository {
  contacts: Contact[] = [];
  events = new Map<string, EmergencyEvent>();
  attempts: CallAttempt[] = [];
  reports = new Map<string, EventReport>();
  elder: Elder = {
    id: 'e1',
    name: '测试老人',
    createdAt: '2026-01-01T00:00:00Z',
  };

  listElders() {
    return Promise.resolve([this.elder]);
  }
  getElder() {
    return Promise.resolve(this.elder);
  }
  listContacts() {
    return Promise.resolve(this.contacts);
  }
  getContact(id: string) {
    return Promise.resolve(this.contacts.find((c) => c.id === id));
  }
  findContactByToken(token: string) {
    return Promise.resolve(this.contacts.find((c) => c.accessToken === token));
  }
  async createContact(data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) {
    const c: Contact = {
      ...data,
      id: `c${this.contacts.length + 1}`,
      createdAt: '',
      updatedAt: '',
    };
    this.contacts.push(c);
    return c;
  }
  updateContact(id: string, patch: Partial<Contact>) {
    const c = this.contacts.find((x) => x.id === id);
    Object.assign(c!, patch);
    return Promise.resolve(c!);
  }
  deleteContact() {
    return Promise.resolve();
  }
  async listEvents(_elderId?: string, status?: EmergencyEvent['status']) {
    return [...this.events.values()].filter(
      (e) => !status || e.status === status,
    );
  }
  getEvent(id: string) {
    return Promise.resolve(this.events.get(id));
  }
  async createEvent(
    data: Omit<EmergencyEvent, 'id' | 'startedAt' | 'escalationCount'>,
  ) {
    const e: EmergencyEvent = {
      ...data,
      id: 'ev1',
      startedAt: '2026-01-01T00:00:00Z',
      escalationCount: 0,
    };
    this.events.set(e.id, e);
    return e;
  }
  async updateEvent(id: string, patch: Partial<EmergencyEvent>) {
    const e = this.events.get(id)!;
    Object.assign(e, patch);
    return e;
  }
  listAttempts() {
    return Promise.resolve(this.attempts);
  }
  getAttempt(id: string) {
    return Promise.resolve(this.attempts.find((a) => a.id === id));
  }
  hasAttempt(_eventId: string, contactId: string) {
    return Promise.resolve(
      this.attempts.some((a) => a.contactId === contactId),
    );
  }
  async createAttempt(data: Omit<CallAttempt, 'id'>) {
    const a: CallAttempt = { ...data, id: `a${this.attempts.length + 1}` };
    this.attempts.push(a);
    return a;
  }
  updateAttempt(id: string, patch: Partial<CallAttempt>) {
    const a = this.attempts.find((x) => x.id === id)!;
    Object.assign(a, patch);
    return Promise.resolve(a);
  }
  getReportByEvent(eventId: string) {
    return Promise.resolve(this.reports.get(eventId));
  }
  async createReport(data: Omit<EventReport, 'id' | 'generatedAt'>) {
    const r: EventReport = {
      ...data,
      id: 'r1',
      generatedAt: '2026-01-01T01:00:00Z',
    };
    this.reports.set(data.eventId, r);
    return r;
  }
}

/** 立即返回预置结果的假拨号器，避免真实等待 */
class FakeDialer extends DialerService {
  results: Array<'answered' | 'no_answer' | 'rejected' | 'failed'> = [];
  calls: Array<{ phone: string; name: string }> = [];

  async dial(phone: string, name: string) {
    this.calls.push({ phone, name });
    const outcome = this.results[this.calls.length - 1] ?? 'no_answer';
    return {
      outcome,
      durationSec: outcome === 'answered' ? 42 : 8,
      remark: 'fake',
    };
  }
}

function makeService() {
  const repo = new FakeRepo();
  const dialer = new FakeDialer();
  const reports = new ReportsService(repo);
  const service = new EmergencyService(repo, dialer, reports);
  repo.contacts = [
    {
      id: 'c1',
      elderId: 'e1',
      name: '大女儿',
      role: 'family',
      phone: '1',
      priority: 1,
      enabled: true,
      accessToken: 't1',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'c2',
      elderId: 'e1',
      name: '邻居',
      role: 'neighbor',
      phone: '2',
      priority: 2,
      enabled: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'c3',
      elderId: 'e1',
      name: '陈医生',
      role: 'doctor',
      phone: '3',
      priority: 3,
      enabled: true,
      createdAt: '',
      updatedAt: '',
    },
  ];
  return { repo, dialer, reports, service };
}

const baseDto = {
  elderId: 'e1',
  title: '老人跌倒',
  severity: 'major' as const,
  initiatedBy: '管家小刘',
};

describe('EmergencyService 分级呼叫引擎', () => {
  test('P1 未接听时自动转接到 P2，直到有人接听并停止', async () => {
    const { service, dialer, repo } = makeService();
    dialer.results = ['no_answer', 'rejected', 'answered'];

    await service.trigger(baseDto);
    // 等待后台三轮呼叫落库
    await new Promise((r) => setTimeout(r, 50));

    expect(dialer.calls.map((c) => c.name)).toEqual([
      '大女儿',
      '邻居',
      '陈医生',
    ]);
    expect(repo.attempts.map((a) => a.outcome)).toEqual([
      'no_answer',
      'rejected',
      'answered',
    ]);
    const event = repo.events.get('ev1')!;
    expect(event.status).toBe('active');
    expect(event.answeredByContactId).toBe('c3');
    expect(event.escalationCount).toBe(2);
  });

  test('P1 直接接听时不再拨打后续联系人', async () => {
    const { service, dialer, repo } = makeService();
    dialer.results = ['answered'];

    await service.trigger(baseDto);
    await new Promise((r) => setTimeout(r, 20));

    expect(dialer.calls).toHaveLength(1);
    expect(repo.events.get('ev1')!.answeredByContactId).toBe('c1');
  });

  test('全部联系人未接听时事件标记为 exhausted，等待管家介入', async () => {
    const { service, repo } = makeService();
    // FakeDialer 默认 no_answer
    await service.trigger(baseDto);
    await new Promise((r) => setTimeout(r, 30));

    const event = repo.events.get('ev1')!;
    expect(event.status).toBe('exhausted');
    expect(event.answeredByContactId).toBeUndefined();
    expect(repo.attempts).toHaveLength(3);
  });

  test('没有可用联系人时拒绝触发', async () => {
    const { service, repo } = makeService();
    repo.contacts.forEach((c) => (c.enabled = false));
    await expect(service.trigger(baseDto)).rejects.toThrow();
  });

  test('结案时生成处置报告', async () => {
    const { service, repo } = makeService();
    await service.trigger(baseDto);
    await new Promise((r) => setTimeout(r, 20));

    const detail = await service.resolve('ev1', {
      resolution: '已扶老人上床休息，无外伤',
    });
    expect(detail.event.status).toBe('resolved');
    expect(detail.report).toBeDefined();
    expect(detail.report!.summary).toContain('测试老人');
    expect(detail.report!.actions.at(-1)).toContain('已扶老人上床休息');
  });
});
