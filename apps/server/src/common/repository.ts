import {
  CallAttempt,
  Contact,
  Elder,
  EmergencyEvent,
  EventReport,
} from './types';

/**
 * 数据仓储抽象层：默认使用内存实现（开发/演示/单测零依赖），
 * 配置 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 后切换为 Supabase 实现。
 *
 * 使用抽象类（而非 interface）作为 NestJS 的 DI 注入令牌。
 */
export abstract class EmergencyRepository {
  abstract listElders(): Promise<Elder[]>;
  abstract getElder(id: string): Promise<Elder | undefined>;

  abstract listContacts(elderId?: string): Promise<Contact[]>;
  abstract getContact(id: string): Promise<Contact | undefined>;
  abstract findContactByToken(token: string): Promise<Contact | undefined>;
  abstract createContact(
    data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Contact>;
  abstract updateContact(id: string, patch: Partial<Contact>): Promise<Contact>;
  abstract deleteContact(id: string): Promise<void>;

  abstract listEvents(
    elderId?: string,
    status?: EmergencyEvent['status'],
  ): Promise<EmergencyEvent[]>;
  abstract getEvent(id: string): Promise<EmergencyEvent | undefined>;
  abstract createEvent(
    data: Omit<EmergencyEvent, 'id' | 'startedAt' | 'escalationCount'>,
  ): Promise<EmergencyEvent>;
  abstract updateEvent(
    id: string,
    patch: Partial<EmergencyEvent>,
  ): Promise<EmergencyEvent>;

  abstract listAttempts(eventId: string): Promise<CallAttempt[]>;
  abstract getAttempt(id: string): Promise<CallAttempt | undefined>;
  abstract hasAttempt(eventId: string, contactId: string): Promise<boolean>;
  abstract createAttempt(data: Omit<CallAttempt, 'id'>): Promise<CallAttempt>;
  abstract updateAttempt(
    id: string,
    patch: Partial<CallAttempt>,
  ): Promise<CallAttempt>;

  abstract getReportByEvent(eventId: string): Promise<EventReport | undefined>;
  abstract createReport(
    data: Omit<EventReport, 'id' | 'generatedAt'>,
  ): Promise<EventReport>;
}
