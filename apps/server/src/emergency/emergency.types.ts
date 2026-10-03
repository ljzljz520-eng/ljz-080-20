/**
 * 紧急联系人分级呼叫模块 —— 领域类型定义
 */

/** 联系人身份类别 */
export type ContactType = 'family' | 'neighbor' | 'doctor' | 'property';

/** 突发事件类型 */
export type EventType = 'fall' | 'illness' | 'fire' | 'intruder' | 'other';

/**
 * 事件状态机：
 *  pending   待受理（已触发，等待管家在管理端发起呼叫）
 *  calling   分级呼叫进行中（正在按优先级逐位拨打）
 *  answered  已接通某位联系人，等待上门处置 / 管家关闭
 *  resolved  已处置完成并生成报告
 *  failed    全部联系人均未接通
 */
export type EventStatus =
  | 'pending'
  | 'calling'
  | 'answered'
  | 'resolved'
  | 'failed';

/** 单次拨打结果 */
export type CallOutcome =
  | 'pending'
  | 'answered'
  | 'no_answer'
  | 'rejected'
  | 'offline';

/** 单次拨打所处阶段 */
export type CallStage = 'ringing' | 'connected' | 'ended';

export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  family: '家属',
  neighbor: '邻里',
  doctor: '社区医生',
  property: '物业',
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  fall: '跌倒',
  illness: '突发疾病',
  fire: '火情',
  intruder: '非法闯入',
  other: '其他',
};

export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  pending: '振铃中',
  answered: '已接通',
  no_answer: '无人接听',
  rejected: '挂断',
  offline: '无法接通',
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  pending: '待受理',
  calling: '呼叫中',
  answered: '已接通',
  resolved: '已处置',
  failed: '全部未接',
};

export interface Elder {
  id: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  room: string;
  address: string;
  phone: string;
  createdAt: string;
}

export interface EmergencyContact {
  id: string;
  elderId: string;
  name: string;
  /** 与老人的关系，如「长子」「对门邻居」 */
  relation: string;
  type: ContactType;
  phone: string;
  /**
   * 呼叫优先级，1 为最高。
   * 同一老人下不同类别联系人可交叉排序，例如 家属1 → 家属2 → 社区医生 → 邻里 → 物业。
   */
  priority: number;
  enabled: boolean;
  /**
   * 家属专属访问令牌（仅家属类型有值）。
   * 家属凭此令牌在 H5 端查看与自己相关的事件与处置报告。
   */
  familyToken: string | null;
  createdAt: string;
}

export interface CallAttempt {
  id: string;
  eventId: string;
  contactId: string;
  /** 拨打序号，从 1 开始（即分级中的第几级） */
  sequence: number;
  outcome: CallOutcome;
  stage: CallStage;
  /** 开始振铃时间 */
  startedAt: string;
  /** 结束时间（接通 / 超时未接 / 挂断） */
  endedAt: string | null;
  /** 通话时长（秒），仅接通时有值 */
  talkSeconds: number | null;
  /** 备注，如「振铃超时」「手动标记无人接听」 */
  note: string | null;
}

export interface EmergencyEvent {
  id: string;
  elderId: string;
  type: EventType;
  description: string;
  status: EventStatus;
  /** 实际接通的联系人 ID（接通后写入） */
  answeredContactId: string | null;
  /** 最终一次拨打记录 ID */
  answeredAttemptId: string | null;
  /** 管家补录的处置小结 */
  resolution: string | null;
  triggeredAt: string;
  /** 开始分级呼叫时间 */
  cascadeStartedAt: string | null;
  /** 关闭时间（resolved / failed） */
  closedAt: string | null;
  createdAt: string;
}
