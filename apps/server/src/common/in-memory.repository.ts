import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CallAttempt,
  Contact,
  Elder,
  EmergencyEvent,
  EventReport,
} from './types';
import { EmergencyRepository } from './repository';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function now(): string {
  return new Date().toISOString();
}

function makeToken(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

/**
 * 进程内内存仓储：随服务重启重置，仅用于本地演示与测试。
 * 生产环境请配置 Supabase 并启用 SupabaseEmergencyRepository。
 */
@Injectable()
export class InMemoryEmergencyRepository extends EmergencyRepository {
  private elders = new Map<string, Elder>();
  private contacts = new Map<string, Contact>();
  private events = new Map<string, EmergencyEvent>();
  private attempts = new Map<string, CallAttempt>();
  private reports = new Map<string, EventReport>();

  constructor() {
    super();
    this.seed();
  }

  private seed(): void {
    const ts = now();
    const elderA: Elder = {
      id: 'elder_001',
      name: '王秀兰',
      age: 82,
      address: '幸福社区 3 号楼 2 单元 501',
      phone: '010-88886666',
      createdAt: ts,
    };
    const elderB: Elder = {
      id: 'elder_002',
      name: '李建国',
      age: 76,
      address: '幸福社区 1 号楼 1 单元 302',
      phone: '010-88887777',
      createdAt: ts,
    };
    this.elders.set(elderA.id, elderA);
    this.elders.set(elderB.id, elderB);

    const seedContacts: Array<Omit<Contact, 'createdAt' | 'updatedAt'>> = [
      {
        id: 'contact_001',
        elderId: 'elder_001',
        name: '王晓明',
        role: 'family',
        relation: '长子',
        phone: '13800000001',
        priority: 1,
        enabled: true,
        accessToken: 'family-demo-wangxm',
        note: '工作日常开会，短信也会提醒',
      },
      {
        id: 'contact_002',
        elderId: 'elder_001',
        name: '王丽',
        role: 'family',
        relation: '女儿',
        phone: '13800000002',
        priority: 2,
        enabled: true,
        accessToken: 'family-demo-wangli',
      },
      {
        id: 'contact_003',
        elderId: 'elder_001',
        name: '张桂芳',
        role: 'neighbor',
        relation: '对门邻居',
        phone: '13900000003',
        priority: 3,
        enabled: true,
        note: '持有备用钥匙',
      },
      {
        id: 'contact_004',
        elderId: 'elder_001',
        name: '陈医生',
        role: 'doctor',
        relation: '社区卫生服务中心 家庭医生',
        phone: '13600000004',
        priority: 4,
        enabled: true,
      },
      {
        id: 'contact_005',
        elderId: 'elder_001',
        name: '幸福社区物业值班室',
        role: 'property',
        phone: '010-66660000',
        priority: 5,
        enabled: true,
      },
      {
        id: 'contact_006',
        elderId: 'elder_002',
        name: '李娜',
        role: 'family',
        relation: '女儿',
        phone: '13800000005',
        priority: 1,
        enabled: true,
        accessToken: 'family-demo-lina',
      },
      {
        id: 'contact_007',
        elderId: 'elder_002',
        name: '刘医生',
        role: 'doctor',
        relation: '家庭医生',
        phone: '13600000006',
        priority: 2,
        enabled: true,
      },
    ];
    for (const c of seedContacts) {
      this.contacts.set(c.id, { ...c, createdAt: ts, updatedAt: ts });
    }
  }

  async listElders(): Promise<Elder[]> {
    return [...this.elders.values()];
  }

  async getElder(id: string): Promise<Elder | undefined> {
    return this.elders.get(id);
  }

  async listContacts(elderId?: string): Promise<Contact[]> {
    const all = [...this.contacts.values()];
    return elderId ? all.filter((c) => c.elderId === elderId) : all;
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async findContactByToken(token: string): Promise<Contact | undefined> {
    return [...this.contacts.values()].find((c) => c.accessToken === token);
  }

  async createContact(
    data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Contact> {
    const ts = now();
    const contact: Contact = {
      ...data,
      id: uid('contact'),
      createdAt: ts,
      updatedAt: ts,
    };
    this.contacts.set(contact.id, contact);
    return contact;
  }

  async updateContact(id: string, patch: Partial<Contact>): Promise<Contact> {
    const existing = this.contacts.get(id);
    if (!existing) throw new NotFoundException('联系人不存在');
    const updated: Contact = { ...existing, ...patch, id, updatedAt: now() };
    this.contacts.set(id, updated);
    return updated;
  }

  async deleteContact(id: string): Promise<void> {
    this.contacts.delete(id);
  }

  async listEvents(
    elderId?: string,
    status?: EmergencyEvent['status'],
  ): Promise<EmergencyEvent[]> {
    let list = [...this.events.values()];
    if (elderId) list = list.filter((e) => e.elderId === elderId);
    if (status) list = list.filter((e) => e.status === status);
    return list.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  }

  async getEvent(id: string): Promise<EmergencyEvent | undefined> {
    return this.events.get(id);
  }

  async createEvent(
    data: Omit<EmergencyEvent, 'id' | 'startedAt' | 'escalationCount'>,
  ): Promise<EmergencyEvent> {
    const event: EmergencyEvent = {
      ...data,
      id: uid('event'),
      startedAt: now(),
      escalationCount: 0,
    };
    this.events.set(event.id, event);
    return event;
  }

  async updateEvent(
    id: string,
    patch: Partial<EmergencyEvent>,
  ): Promise<EmergencyEvent> {
    const existing = this.events.get(id);
    if (!existing) throw new NotFoundException('事件不存在');
    const updated = { ...existing, ...patch, id };
    this.events.set(id, updated);
    return updated;
  }

  async listAttempts(eventId: string): Promise<CallAttempt[]> {
    return [...this.attempts.values()]
      .filter((a) => a.eventId === eventId)
      .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
  }

  async getAttempt(id: string): Promise<CallAttempt | undefined> {
    return this.attempts.get(id);
  }

  async hasAttempt(eventId: string, contactId: string): Promise<boolean> {
    return [...this.attempts.values()].some(
      (a) => a.eventId === eventId && a.contactId === contactId,
    );
  }

  async createAttempt(data: Omit<CallAttempt, 'id'>): Promise<CallAttempt> {
    const attempt: CallAttempt = { ...data, id: uid('attempt') };
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  async updateAttempt(
    id: string,
    patch: Partial<CallAttempt>,
  ): Promise<CallAttempt> {
    const existing = this.attempts.get(id);
    if (!existing) throw new NotFoundException('呼叫记录不存在');
    const updated = { ...existing, ...patch, id };
    this.attempts.set(id, updated);
    return updated;
  }

  async getReportByEvent(eventId: string): Promise<EventReport | undefined> {
    return this.reports.get(eventId);
  }

  async createReport(
    data: Omit<EventReport, 'id' | 'generatedAt'>,
  ): Promise<EventReport> {
    const report: EventReport = {
      ...data,
      id: uid('report'),
      generatedAt: now(),
    };
    this.reports.set(report.eventId, report);
    return report;
  }
}
