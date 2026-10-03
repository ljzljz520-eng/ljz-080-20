import { ReportsService } from './reports.service';
import { EmergencyRepository } from '../common/repository';
import {
  CallAttempt,
  Contact,
  Elder,
  EmergencyEvent,
  EventReport,
} from '../common/types';

class FakeRepo extends EmergencyRepository {
  contacts: Contact[] = [];
  private events: EmergencyEvent[] = [];
  private attempts: CallAttempt[] = [];
  private reports = new Map<string, EventReport>();
  elder: Elder = { id: 'e1', name: '王秀兰', createdAt: '' };

  withResolvedEvent() {
    this.events = [
      {
        id: 'ev1',
        elderId: 'e1',
        title: '突发胸痛',
        severity: 'critical',
        status: 'resolved',
        initiatedBy: '管家',
        startedAt: '2026-01-01T00:00:00Z',
        resolvedAt: '2026-01-01T00:30:00Z',
        resolution: '送医后情况稳定',
        escalationCount: 2,
      },
    ];
    this.attempts = [
      {
        id: 'a1',
        eventId: 'ev1',
        contactId: 'c1',
        priority: 1,
        outcome: 'no_answer',
        startedAt: '2026-01-01T00:00:01Z',
        durationSec: 8,
      },
      {
        id: 'a2',
        eventId: 'ev1',
        contactId: 'c2',
        priority: 2,
        outcome: 'answered',
        startedAt: '2026-01-01T00:00:10Z',
        answeredAt: '2026-01-01T00:00:12Z',
        endedAt: '2026-01-01T00:05:00Z',
        durationSec: 290,
      },
    ];
    this.reports.set('ev1', {
      id: 'r1',
      eventId: 'ev1',
      summary: '王秀兰发生突发胸痛……',
      actions: ['a', 'b'],
      generatedAt: '2026-01-01T00:30:00Z',
    });
    this.contacts = [
      {
        id: 'c1',
        elderId: 'e1',
        name: '王晓明',
        role: 'family',
        phone: '138',
        priority: 1,
        enabled: true,
        accessToken: 't1',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'c2',
        elderId: 'e1',
        name: '陈医生',
        role: 'doctor',
        phone: '136',
        priority: 2,
        enabled: true,
        createdAt: '',
        updatedAt: '',
      },
    ];
    return this;
  }

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
  createContact(): Promise<Contact> {
    throw new Error('not used');
  }
  updateContact(): Promise<Contact> {
    throw new Error('not used');
  }
  deleteContact() {
    return Promise.resolve();
  }
  listEvents() {
    return Promise.resolve(this.events);
  }
  getEvent(id: string) {
    return Promise.resolve(this.events.find((e) => e.id === id));
  }
  createEvent(): Promise<EmergencyEvent> {
    throw new Error('not used');
  }
  updateEvent(): Promise<EmergencyEvent> {
    throw new Error('not used');
  }
  listAttempts() {
    return Promise.resolve(this.attempts);
  }
  getAttempt(): Promise<CallAttempt | undefined> {
    throw new Error('not used');
  }
  hasAttempt() {
    return Promise.resolve(false);
  }
  createAttempt(): Promise<CallAttempt> {
    throw new Error('not used');
  }
  updateAttempt(): Promise<CallAttempt> {
    throw new Error('not used');
  }
  getReportByEvent(eventId: string) {
    return Promise.resolve(this.reports.get(eventId));
  }
  createReport(data: Omit<EventReport, 'id' | 'generatedAt'>) {
    const r: EventReport = { ...data, id: 'r2', generatedAt: '' };
    return Promise.resolve(r);
  }
}

describe('ReportsService 家属脱敏视图', () => {
  test('家属只能看到自己的呼叫明细，其他联系人仅有数量统计', async () => {
    const repo = new FakeRepo().withResolvedEvent();
    const service = new ReportsService(repo);
    const family = repo.contacts[0]; // 王晓明 P1 未接听

    const views = await service.getFamilyView(family);
    expect(views).toHaveLength(1);
    const view = views[0];

    // 本人记录明文
    expect(view.ownAttempts).toHaveLength(1);
    expect(view.ownAttempts[0].outcome).toBe('no_answer');
    expect(view.answeredByMe).toBe(false);

    // 他人信息脱敏：只有数字，没有姓名/电话/关系
    expect(view.othersSummary).toEqual({
      total: 1,
      answered: 1,
      noAnswer: 0,
      rejected: 0,
      failed: 0,
    });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('陈医生');
    expect(serialized).not.toContain('136');
  });

  test('报告摘要包含分级呼叫与第一响应人信息', async () => {
    const repo = new FakeRepo();
    const service = new ReportsService(repo);
    const event: EmergencyEvent = {
      id: 'ev2',
      elderId: 'e1',
      title: '跌倒',
      severity: 'major',
      status: 'resolved',
      initiatedBy: '管家',
      startedAt: '2026-01-01T00:00:00Z',
      resolvedAt: '2026-01-01T00:10:00Z',
      resolution: '已处置',
      escalationCount: 1,
    };
    const attempts: CallAttempt[] = [
      {
        id: 'a1',
        eventId: 'ev2',
        contactId: 'c1',
        priority: 1,
        outcome: 'no_answer',
        startedAt: '',
        durationSec: 8,
      },
      {
        id: 'a2',
        eventId: 'ev2',
        contactId: 'c2',
        priority: 2,
        outcome: 'answered',
        startedAt: '',
        durationSec: 120,
      },
    ];
    const report = await service.generateIfAbsent(event, attempts);
    expect(report.summary).toContain('分级联络');
    expect(report.summary).toContain('第一响应人');
    expect(report.actions.some((a) => a.includes('自动转接下一位'))).toBe(true);
  });
});
