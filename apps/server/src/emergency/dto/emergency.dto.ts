import { ContactType, EventType } from '../emergency.types';

export interface CreateElderDto {
  name: string;
  gender: 'male' | 'female';
  age: number;
  room: string;
  address: string;
  phone: string;
}

export interface UpsertContactDto {
  name: string;
  relation: string;
  type: ContactType;
  phone: string;
  priority: number;
  enabled?: boolean;
}

export interface ReorderContactsDto {
  /** 按新呼叫顺序排列的联系人 ID（仅需包含需要排序的联系人） */
  orderedContactIds: string[];
}

export interface TriggerEventDto {
  elderId: string;
  type: EventType;
  description?: string;
}

export interface SettleCallDto {
  outcome: 'answered' | 'no_answer' | 'rejected' | 'offline';
  talkSeconds?: number;
  note?: string;
}

export interface ResolveEventDto {
  resolution: string;
}

export interface ListFamilyEventsQuery {
  token: string;
}
