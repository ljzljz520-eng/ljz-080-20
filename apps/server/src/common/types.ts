/** 联系人身份类别 */
export type ContactRole = 'family' | 'neighbor' | 'doctor' | 'property';

/** 呼叫接通结果 */
export type CallOutcome =
  | 'pending'
  | 'ringing'
  | 'answered'
  | 'no_answer'
  | 'rejected'
  | 'failed';

/** 紧急事件状态 */
export type EventStatus = 'active' | 'escalating' | 'resolved' | 'exhausted';

/** 事件严重级别 */
export type EventSeverity = 'critical' | 'major' | 'minor';

/** 联系人 */
export interface Contact {
  id: string;
  elderId: string;
  name: string;
  role: ContactRole;
  phone: string;
  relation?: string;
  /** 呼叫优先级，数字越小越优先（1 最先） */
  priority: number;
  /** 是否启用 */
  enabled: boolean;
  /** 家属 H5 访问凭证，仅家属角色签发 */
  accessToken?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/** 老人 */
export interface Elder {
  id: string;
  name: string;
  age?: number;
  address?: string;
  phone?: string;
  createdAt: string;
}

/** 一次外呼尝试 */
export interface CallAttempt {
  id: string;
  eventId: string;
  contactId: string;
  /** 呼叫时的优先级快照 */
  priority: number;
  outcome: CallOutcome;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  /** 振铃/通话时长（秒） */
  durationSec?: number;
  /** 未接听原因、失败原因等 */
  remark?: string;
}

/** 紧急事件 */
export interface EmergencyEvent {
  id: string;
  elderId: string;
  title: string;
  description?: string;
  severity: EventSeverity;
  status: EventStatus;
  location?: string;
  /** 当前正在呼叫的联系人 */
  currentContactId?: string;
  /** 首位接通的联系人，即事件的第一响应人 */
  answeredByContactId?: string;
  initiatedBy: string;
  startedAt: string;
  resolvedAt?: string;
  resolution?: string;
  escalationCount: number;
}

/** 处置报告 */
export interface EventReport {
  id: string;
  eventId: string;
  summary: string;
  actions: string[];
  generatedAt: string;
}

/** 事件聚合详情（管家视角，含全部明细） */
export interface EventDetail {
  event: EmergencyEvent;
  elder: Elder;
  attempts: Array<CallAttempt & { contact: Contact }>;
  report?: EventReport;
}
