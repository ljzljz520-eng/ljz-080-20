import { Injectable, Logger } from '@nestjs/common';
import {
  CallAttempt,
  Contact,
  EmergencyEvent,
  EventReport,
} from '../common/types';
import { EmergencyRepository } from '../common/repository';

const ROLE_LABEL: Record<Contact['role'], string> = {
  family: '家属',
  neighbor: '邻里',
  doctor: '社区医生',
  property: '物业',
};

export interface FamilyReportView {
  report: EventReport;
  event: {
    id: string;
    title: string;
    severity: EmergencyEvent['severity'];
    location?: string;
    startedAt: string;
    resolvedAt?: string;
    resolution?: string;
  };
  elderName: string;
  /** 与该家属本人相关的呼叫记录（明文） */
  ownAttempts: Array<{
    priority: number;
    outcome: CallAttempt['outcome'];
    startedAt: string;
    durationSec?: number;
    remark?: string;
  }>;
  /** 其他联系人的呼叫概览（脱敏：不透露姓名、电话、身份细节） */
  othersSummary: {
    total: number;
    answered: number;
    noAnswer: number;
    rejected: number;
    failed: number;
  };
  /** 是否由该家属本人首先接通 */
  answeredByMe: boolean;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly repo: EmergencyRepository) {}

  /** 结案时生成简短处置报告（幂等） */
  async generateIfAbsent(
    event: EmergencyEvent,
    attempts: CallAttempt[],
  ): Promise<EventReport> {
    const existing = await this.repo.getReportByEvent(event.id);
    if (existing) return existing;

    const elder = await this.repo.getElder(event.elderId);
    const answered = attempts.filter((a) => a.outcome === 'answered');
    const durationMin =
      event.resolvedAt != null
        ? Math.max(
            1,
            Math.round(
              (new Date(event.resolvedAt).getTime() -
                new Date(event.startedAt).getTime()) /
                60000,
            ),
          )
        : undefined;

    const maxPriority = attempts.length
      ? Math.max(...attempts.map((a) => a.priority))
      : 1;
    const priorityRange = maxPriority > 1 ? `P1→P${maxPriority}` : 'P1';
    const summaryParts = [
      `${elder?.name ?? '老人'}于 ${this.fmt(event.startedAt)} 发生「${event.title}」`,
      `按 ${priorityRange} 分级联络家属、邻里、社区医生及物业共 ${attempts.length} 人次`,
      answered.length > 0
        ? `${answered.length} 人接通，第一响应人为优先级 P${answered[0].priority} 的联系人`
        : '全部联系人未接通，由到场管家直接处置',
      durationMin != null ? `处置历时约 ${durationMin} 分钟` : null,
    ].filter(Boolean);

    const actions: string[] = [];
    actions.push(
      ...attempts.map((a) => {
        const role = `P${a.priority}`;
        if (a.outcome === 'answered')
          return `${role} 联系人接通电话，告知现场情况并协调处置`;
        if (a.outcome === 'no_answer')
          return `${role} 联系人振铃未接听，系统自动转接下一位`;
        if (a.outcome === 'rejected')
          return `${role} 联系人拒接，系统自动转接下一位`;
        return `${role} 联系人呼叫失败（${a.remark ?? '未知原因'}），转接下一位`;
      }),
    );
    actions.push(`管家现场处置：${event.resolution ?? '（未填写处置说明）'}`);

    const report = await this.repo.createReport({
      eventId: event.id,
      summary: `${summaryParts.join('；')}。`,
      actions,
    });
    this.logger.log(`事件 ${event.id} 处置报告已生成 ${report.id}`);
    return report;
  }

  async getReport(eventId: string): Promise<EventReport | undefined> {
    return this.repo.getReportByEvent(eventId);
  }

  async listReports(elderId?: string): Promise<
    Array<{
      report: EventReport;
      event: EmergencyEvent;
    }>
  > {
    const events = await this.repo.listEvents(elderId, 'resolved');
    const result: Array<{ report: EventReport; event: EmergencyEvent }> = [];
    for (const event of events) {
      const report = await this.repo.getReportByEvent(event.id);
      if (report) result.push({ report, event });
    }
    return result;
  }

  /**
   * 家属视图：只返回与其本人相关的内容。
   * - 本人的呼叫结果、时间、时长：明文
   * - 其他联系人：仅返回数量统计，不包含姓名/电话/关系
   * - 处置说明可能涉及其他家属，统一由后台模板控制，不回传完整通话明细
   */
  async getFamilyView(contact: Contact): Promise<FamilyReportView[]> {
    const events = await this.repo.listEvents(contact.elderId, 'resolved');
    const views: FamilyReportView[] = [];

    for (const event of events) {
      const report = await this.repo.getReportByEvent(event.id);
      if (!report) continue;

      const attempts = await this.repo.listAttempts(event.id);
      const elder = await this.repo.getElder(event.elderId);
      const mine = attempts.filter((a) => a.contactId === contact.id);
      const others = attempts.filter((a) => a.contactId !== contact.id);

      views.push({
        report,
        event: {
          id: event.id,
          title: event.title,
          severity: event.severity,
          location: event.location,
          startedAt: event.startedAt,
          resolvedAt: event.resolvedAt,
          resolution: event.resolution,
        },
        elderName: elder?.name ?? '家中老人',
        answeredByMe: mine.some((a) => a.outcome === 'answered'),
        ownAttempts: mine.map((a) => ({
          priority: a.priority,
          outcome: a.outcome,
          startedAt: a.startedAt,
          durationSec: a.durationSec,
          remark: a.remark,
        })),
        othersSummary: {
          total: others.length,
          answered: others.filter((a) => a.outcome === 'answered').length,
          noAnswer: others.filter((a) => a.outcome === 'no_answer').length,
          rejected: others.filter((a) => a.outcome === 'rejected').length,
          failed: others.filter((a) => a.outcome === 'failed').length,
        },
      });
    }

    return views;
  }

  private fmt(iso: string): string {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}

export { ROLE_LABEL };
