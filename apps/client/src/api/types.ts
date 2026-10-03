export type ContactType = 'family' | 'neighbor' | 'doctor' | 'property';
export type EventType = 'fall' | 'illness' | 'fire' | 'intruder' | 'other';
export type EventStatus =
  | 'pending'
  | 'calling'
  | 'answered'
  | 'resolved'
  | 'failed';
export type CallOutcome =
  | 'pending'
  | 'answered'
  | 'no_answer'
  | 'rejected'
  | 'offline';

export interface Elder {
  id: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  room: string;
  address: string;
  phone: string;
  contactCount?: number;
  createdAt: string;
}

export interface Contact {
  id: string;
  elderId: string;
  name: string;
  relation: string;
  type: ContactType;
  phone: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

export interface EventItem {
  id: string;
  elderId: string;
  type: EventType;
  description: string;
  status: EventStatus;
  answeredContactId: string | null;
  resolution: string | null;
  triggeredAt: string;
  cascadeStartedAt: string | null;
  closedAt: string | null;
}

export interface AttemptContact {
  id: string;
  name: string;
  relation: string;
  type: ContactType;
  phone: string;
}

export interface Attempt {
  id: string;
  eventId: string;
  contactId: string;
  sequence: number;
  outcome: CallOutcome;
  stage: 'ringing' | 'connected' | 'ended';
  startedAt: string;
  endedAt: string | null;
  talkSeconds: number | null;
  note: string | null;
  contact: AttemptContact | null;
}

export interface EventDetail {
  event: EventItem;
  elder: Elder | null;
  answeredContact: {
    id: string;
    name: string;
    relation: string;
    type: ContactType;
  } | null;
  attempts: Attempt[];
  ringingAttemptId: string | null;
}

export interface ReportCallLine {
  sequence: number;
  contactName: string;
  contactType: string;
  relation: string;
  phone: string;
  outcome: string;
  startedAt: string;
  endedAt: string | null;
  talkSeconds: number | null;
  note: string | null;
  selfAnswered: boolean;
}

export interface StaffReport {
  scope: 'staff';
  eventId: string;
  elderName: string;
  elderRoom: string;
  elderAddress: string;
  eventType: string;
  description: string;
  status: string;
  triggeredAt: string;
  cascadeStartedAt: string | null;
  closedAt: string | null;
  answeredContactName: string | null;
  totalCalls: number;
  answeredCalls: number;
  lines: ReportCallLine[];
  resolution: string | null;
  summary: string;
}

export interface FamilyReport {
  scope: 'family';
  eventId: string;
  elderName: string;
  eventType: string;
  description: string;
  triggeredAt: string;
  status: string;
  assisted: boolean;
  elderHelpedBy: string | null;
  lines: ReportCallLine[];
  resolutionRelevant: string | null;
  summary: string;
}

export interface FamilyEventListItem {
  id: string;
  type: string;
  rawType: EventType;
  description: string;
  status: string;
  rawStatus: EventStatus;
  triggeredAt: string;
  closedAt: string | null;
  myCall: {
    sequence: number;
    outcome: CallOutcome;
    outcomeLabel: string;
  } | null;
}

export interface FamilyMe {
  name: string;
  relation: string;
  type: string;
  elderName: string;
  elderAddress: string;
}

export interface FamilyBinding {
  contactId: string;
  name: string;
  relation: string;
  token: string;
}

export const CONTACT_TYPE_META: Record<
  ContactType,
  { label: string; color: string; icon: string }
> = {
  family: { label: '家属', color: '#e8734a', icon: '👨‍👩‍👧' },
  neighbor: { label: '邻里', color: '#2f9e8f', icon: '🏘️' },
  doctor: { label: '社区医生', color: '#3d7ec9', icon: '🩺' },
  property: { label: '物业', color: '#8a6fb8', icon: '🛎️' },
};

export const EVENT_TYPE_META: Record<EventType, { label: string; color: string }> =
  {
    fall: { label: '跌倒', color: '#e8734a' },
    illness: { label: '突发疾病', color: '#d9534f' },
    fire: { label: '火情', color: '#d9534f' },
    intruder: { label: '非法闯入', color: '#8a6fb8' },
    other: { label: '其他', color: '#7a8290' },
  };

export const EVENT_STATUS_META: Record<
  EventStatus,
  { label: string; color: string; bg: string }
> = {
  pending: { label: '待受理', color: '#b07d12', bg: '#fff6e0' },
  calling: { label: '呼叫中', color: '#c0392b', bg: '#fdecea' },
  answered: { label: '已接通', color: '#1f8a5b', bg: '#e6f6ee' },
  resolved: { label: '已处置', color: '#3d7ec9', bg: '#e8f1fc' },
  failed: { label: '全部未接', color: '#b03030', bg: '#fde8e8' },
};

export const OUTCOME_META: Record<
  CallOutcome,
  { label: string; color: string }
> = {
  pending: { label: '振铃中', color: '#c0392b' },
  answered: { label: '已接通', color: '#1f8a5b' },
  no_answer: { label: '无人接听', color: '#9a6b1e' },
  rejected: { label: '挂断', color: '#b05050' },
  offline: { label: '无法接通', color: '#7a8290' },
};
