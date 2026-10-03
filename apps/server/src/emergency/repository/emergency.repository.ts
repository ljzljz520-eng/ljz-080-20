import { Injectable } from '@nestjs/common';
import {
  CallAttempt,
  ContactType,
  EmergencyContact,
  EmergencyEvent,
  Elder,
} from '../emergency.types';
import { MemoryStore } from './memory.store';

let seq = 0;
/** 生成带前缀的可读主键，如 ev_1727...a3 */
export function genId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

@Injectable()
export class EmergencyRepository {
  constructor(private readonly store: MemoryStore) {}

  // ---------- 老人 ----------

  listElders(): Elder[] {
    return [...this.store.elders.values()].sort((a, b) =>
      a.room.localeCompare(b.room, 'zh-Hans-CN'),
    );
  }

  getElder(id: string): Elder | undefined {
    return this.store.elders.get(id);
  }

  saveElder(elder: Elder): Elder {
    this.store.elders.set(elder.id, elder);
    return elder;
  }

  // ---------- 联系人 ----------

  listContacts(elderId?: string): EmergencyContact[] {
    const all = [...this.store.contacts.values()];
    return all
      .filter((c) => (elderId ? c.elderId === elderId : true))
      .sort((a, b) =>
        a.elderId === b.elderId
          ? a.priority - b.priority || a.createdAt.localeCompare(b.createdAt)
          : a.elderId.localeCompare(b.elderId),
      );
  }

  /**
   * 取某老人「参与分级呼叫」的联系人队列：
   * 仅启用状态，按优先级升序（数字越小越先呼叫），同优先级按创建先后。
   */
  getCascadeChain(elderId: string): EmergencyContact[] {
    return this.listContacts(elderId).filter((c) => c.enabled);
  }

  getContact(id: string): EmergencyContact | undefined {
    return this.store.contacts.get(id);
  }

  getContactByToken(token: string): EmergencyContact | undefined {
    return [...this.store.contacts.values()].find(
      (c) => c.familyToken === token,
    );
  }

  saveContact(contact: EmergencyContact): EmergencyContact {
    this.store.contacts.set(contact.id, contact);
    return contact;
  }

  deleteContact(id: string): boolean {
    return this.store.contacts.delete(id);
  }

  /** 同一老人同优先级是否已被占用（用于校验） */
  priorityTaken(
    elderId: string,
    priority: number,
    excludeId?: string,
  ): boolean {
    return this.listContacts(elderId).some(
      (c) => c.priority === priority && c.id !== excludeId,
    );
  }

  listContactsByType(elderId: string, type: ContactType): EmergencyContact[] {
    return this.listContacts(elderId).filter((c) => c.type === type);
  }

  // ---------- 事件 ----------

  listEvents(elderId?: string): EmergencyEvent[] {
    return [...this.store.events.values()]
      .filter((e) => (elderId ? e.elderId === elderId : true))
      .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));
  }

  getEvent(id: string): EmergencyEvent | undefined {
    return this.store.events.get(id);
  }

  saveEvent(event: EmergencyEvent): EmergencyEvent {
    this.store.events.set(event.id, event);
    return event;
  }

  // ---------- 拨打记录 ----------

  listAttempts(eventId: string): CallAttempt[] {
    return this.store.attemptsByEvent.get(eventId) ?? [];
  }

  getAttempt(id: string): CallAttempt | undefined {
    return this.store.attempts.get(id);
  }

  saveAttempt(attempt: CallAttempt): CallAttempt {
    this.store.attempts.set(attempt.id, attempt);
    const list = this.store.attemptsByEvent.get(attempt.eventId) ?? [];
    const idx = list.findIndex((a) => a.id === attempt.id);
    if (idx >= 0) list[idx] = attempt;
    else list.push(attempt);
    list.sort((a, b) => a.sequence - b.sequence);
    this.store.attemptsByEvent.set(attempt.eventId, list);
    return attempt;
  }
}
