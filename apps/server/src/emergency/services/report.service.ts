import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CALL_OUTCOME_LABEL,
  CONTACT_TYPE_LABEL,
  EVENT_STATUS_LABEL,
  EVENT_TYPE_LABEL,
  EmergencyContact,
  EventStatus,
} from '../emergency.types';
import { EmergencyRepository } from '../repository/emergency.repository';
import { maskPhone } from '../call/call.gateway';

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
  /** 是否由当前查看的家属本人接通 */
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

/**
 * 家属视角报告：只能看到【与自己相关】的部分——
 * 事件概况 + 自己被呼叫的那一条记录 + 最终老人是否已获得帮助，
 * 看不到其他家属 / 邻里 / 医生 / 物业的姓名、电话和处置明细。
 */
export interface FamilyReport {
  scope: 'family';
  eventId: string;
  elderName: string;
  eventType: string;
  description: string;
  triggeredAt: string;
  status: string;
  /** 老人最终是否得到帮助（已接通联系人 或 已处置完成） */
  assisted: boolean;
  elderHelpedBy: string | null;
  lines: ReportCallLine[];
  resolutionRelevant: string | null;
  summary: string;
}

@Injectable()
export class ReportService {
  constructor(private readonly repo: EmergencyRepository) {}

  // ---------- 管家 / 工作人员：完整报告 ----------

  buildStaffReport(eventId: string): StaffReport {
    const detail = this.buildBase(eventId);
    const { event, elder } = detail;

    const lines = detail.attempts.map((a) => ({
      sequence: a.sequence,
      contactName: a.contact?.name ?? '（联系人已删除）',
      contactType: a.contact ? CONTACT_TYPE_LABEL[a.contact.type] : '-',
      relation: a.contact?.relation ?? '',
      phone: a.contact ? maskPhone(a.contact.phone) : '-',
      outcome: CALL_OUTCOME_LABEL[a.outcome],
      startedAt: a.startedAt,
      endedAt: a.endedAt,
      talkSeconds: a.talkSeconds,
      note: a.note,
      selfAnswered: false,
    }));

    const answeredContact = event.answeredContactId
      ? (this.repo.getContact(event.answeredContactId) ?? null)
      : null;

    const summary = this.composeStaffSummary(
      elder?.name ?? '老人',
      EVENT_TYPE_LABEL[event.type],
      lines.length,
      answeredContact,
      event.status,
    );

    return {
      scope: 'staff',
      eventId: event.id,
      elderName: elder?.name ?? '（档案缺失）',
      elderRoom: elder?.room ?? '',
      elderAddress: elder?.address ?? '',
      eventType: EVENT_TYPE_LABEL[event.type],
      description: event.description,
      status: EVENT_STATUS_LABEL[event.status],
      triggeredAt: event.triggeredAt,
      cascadeStartedAt: event.cascadeStartedAt,
      closedAt: event.closedAt,
      answeredContactName: answeredContact ? answeredContact.name : null,
      totalCalls: lines.length,
      answeredCalls: lines.filter(
        (l) => l.outcome === CALL_OUTCOME_LABEL.answered,
      ).length,
      lines,
      resolution: event.resolution,
      summary,
    };
  }

  // ---------- 家属：仅本人相关片段 ----------

  buildFamilyReport(eventId: string, familyContactId: string): FamilyReport {
    const detail = this.buildBase(eventId);
    const { event, elder } = detail;

    const ownAttempts = detail.attempts.filter(
      (a) => a.contact?.id === familyContactId,
    );

    const family = this.repo.getContact(familyContactId);
    if (!family) throw new NotFoundException('家属联系人不存在');

    const lines: ReportCallLine[] = ownAttempts.map((a) => ({
      sequence: a.sequence,
      contactName: family.name,
      contactType: CONTACT_TYPE_LABEL[family.type],
      relation: family.relation,
      phone: maskPhone(family.phone),
      outcome: CALL_OUTCOME_LABEL[a.outcome],
      startedAt: a.startedAt,
      endedAt: a.endedAt,
      talkSeconds: a.talkSeconds,
      note: a.note,
      selfAnswered: a.outcome === 'answered',
    }));

    const answeredContact = event.answeredContactId
      ? (this.repo.getContact(event.answeredContactId) ?? null)
      : null;
    const assisted = event.status === 'resolved' || answeredContact !== null;
    // 仅告知家属「已有人接通并上门」，不透露具体是哪位联系人（隐私）
    const elderHelpedBy = answeredContact
      ? answeredContact.id === familyContactId
        ? '您本人'
        : '其他应急联系人'
      : event.status === 'resolved'
        ? '社区工作人员'
        : null;

    const summary = this.composeFamilySummary(
      elder?.name ?? '家中老人',
      EVENT_TYPE_LABEL[event.type],
      lines,
      assisted,
    );

    return {
      scope: 'family',
      eventId: event.id,
      elderName: elder?.name ?? '家中老人',
      eventType: EVENT_TYPE_LABEL[event.type],
      description: event.description,
      triggeredAt: event.triggeredAt,
      status: EVENT_STATUS_LABEL[event.status],
      assisted,
      elderHelpedBy,
      lines,
      resolutionRelevant:
        event.status === 'resolved'
          ? '社区已完成现场处置，老人情况已妥善安排。'
          : null,
      summary,
    };
  }

  // ---------- 内部 ----------

  private buildBase(eventId: string) {
    const event = this.repo.getEvent(eventId);
    if (!event) throw new NotFoundException(`事件不存在：${eventId}`);
    const elder = this.repo.getElder(event.elderId) ?? null;
    const attempts = this.repo.listAttempts(eventId).map((a) => ({
      ...a,
      contact: this.repo.getContact(a.contactId) ?? null,
    }));
    return { event, elder, attempts };
  }

  private composeStaffSummary(
    elderName: string,
    eventType: string,
    totalCalls: number,
    answered: EmergencyContact | null,
    status: EventStatus,
  ): string {
    const time = new Date().toLocaleString('zh-CN', { hour12: false });
    if (answered) {
      return `${time} 接报${elderName}${eventType}事件，系统按预设优先级依次外呼，共拨打 ${totalCalls} 位联系人，由「${answered.name}」（${CONTACT_TYPE_LABEL[answered.type]}）接通，已告知事件详情并请其尽快到场，随后由管家关闭事件。`;
    }
    if (status === 'resolved') {
      return `${time} ${elderName}${eventType}事件，分级呼叫 ${totalCalls} 次后由社区线下处置完成。`;
    }
    return `${time} 接报${elderName}${eventType}事件，系统已按优先级外呼 ${totalCalls} 位联系人，截至目前无人接听，请立即执行线下兜底。`;
  }

  private composeFamilySummary(
    elderName: string,
    eventType: string,
    ownLines: ReportCallLine[],
    assisted: boolean,
  ): string {
    if (ownLines.length === 0) {
      return `${elderName}发生${eventType}事件，本次分级呼叫未呼叫到您（您的排期在事件结束之后），仅向您同步事件概况。`;
    }
    const own = ownLines[0];
    const self = own.selfAnswered
      ? '您已接通并获悉情况'
      : `系统曾于第 ${own.sequence} 级呼叫您，结果为「${own.outcome}」`;
    const tail = assisted
      ? '目前老人已获得帮助，请放心。'
      : '截至目前尚未联系上应急联系人，社区正在线下处理，请保持电话畅通。';
    return `${elderName}发生${eventType}事件，${self}。${tail}`;
  }
}
