import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CallAttempt,
  CallOutcome,
  Contact,
  EmergencyEvent,
  EventDetail,
  EventSeverity,
} from '../common/types';
import { EmergencyRepository } from '../common/repository';
import { DialerService, DialResult } from './dialer.service';
import { ReportsService } from '../reports/reports.service';

export interface TriggerEventDto {
  elderId: string;
  title: string;
  description?: string;
  severity: EventSeverity;
  location?: string;
  initiatedBy: string;
  /** 演示/测试用：第一轮呼叫的模拟结果 */
  simulate?: CallOutcome;
}

export interface ResolveEventDto {
  resolution: string;
}

export interface CallCallbackDto {
  outcome: CallOutcome;
  remark?: string;
}

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);
  /** 正在执行分级呼叫的事件，防止重复调度 */
  private readonly running = new Set<string>();
  /** 人工/网关可提前结束当前振铃的信号 */
  private readonly signals = new Map<string, (result: DialResult) => void>();

  constructor(
    private readonly repo: EmergencyRepository,
    private readonly dialer: DialerService,
    private readonly reportsService: ReportsService,
  ) {}

  /** 触发突发事件，立即按优先级开始逐级外呼 */
  async trigger(dto: TriggerEventDto): Promise<EventDetail> {
    const elder = await this.repo.getElder(dto.elderId);
    if (!elder) throw new NotFoundException('老人信息不存在');

    const contacts = await this.repo.listContacts(dto.elderId);
    if (!contacts.some((c) => c.enabled)) {
      throw new BadRequestException(
        '该老人尚未配置可用的紧急联系人，无法发起分级呼叫',
      );
    }

    const open = await this.repo.listEvents(dto.elderId, 'active');
    const escalating = await this.repo.listEvents(dto.elderId, 'escalating');
    if (open.length + escalating.length > 0) {
      throw new ConflictException('该老人已有进行中的突发事件，请勿重复触发');
    }

    const event = await this.repo.createEvent({
      elderId: dto.elderId,
      title: dto.title,
      description: dto.description,
      severity: dto.severity,
      location: dto.location,
      status: 'active',
      initiatedBy: dto.initiatedBy,
    });
    this.logger.warn(
      `突发事件 ${event.id}「${event.title}」已触发，启动分级呼叫流程`,
    );

    // 后台执行逐级呼叫，接口立即返回，前端通过轮询跟踪进度
    void this.runEscalation(event.id, dto.simulate);

    return this.getDetail(event.id);
  }

  /**
   * 分级呼叫主循环：按优先级依次外呼，未接听自动转下一位，
   * 直到有人接听或全部联系人轮询完毕。
   */
  private async runEscalation(
    eventId: string,
    firstForced?: CallOutcome,
  ): Promise<void> {
    if (this.running.has(eventId)) return;
    this.running.add(eventId);
    let simulatedUsed = false;

    try {
      // 外层循环：每轮拨打一位联系人
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const event = await this.repo.getEvent(eventId);
        if (!event || event.status === 'resolved') return;

        const contact = await this.pickNextContact(event);
        if (!contact) {
          await this.repo.updateEvent(eventId, {
            status: 'exhausted',
            currentContactId: undefined,
          });
          this.logger.warn(
            `事件 ${eventId} 全部联系人均未接听，等待管家介入处置`,
          );
          return;
        }

        await this.repo.updateEvent(eventId, {
          status: 'escalating',
          currentContactId: contact.id,
        });

        const attempt = await this.repo.createAttempt({
          eventId,
          contactId: contact.id,
          priority: contact.priority,
          outcome: 'ringing',
          startedAt: new Date().toISOString(),
        });
        this.logger.log(
          `事件 ${eventId} 正在呼叫 P${contact.priority} ${contact.role} ${contact.name}`,
        );

        // 第一轮可注入模拟结果；后续轮询默认振铃超时（也可由人工/网关回调打断）
        const force = !simulatedUsed && firstForced ? firstForced : undefined;
        simulatedUsed = true;
        const result = await this.performDial(eventId, contact, force);

        await this.finalizeAttempt(attempt.id, result);

        if (result.outcome === 'answered') {
          await this.repo.updateEvent(eventId, {
            status: 'active',
            answeredByContactId: contact.id,
          });
          this.logger.warn(
            `事件 ${eventId} 已接通：${contact.name}（${contact.role}）成为第一响应人`,
          );
          // 接通后保持通话/处置中，等待管家确认结案，不再继续呼叫
          return;
        }

        // 未接听/拒接/失败 → 自动转接下一位，无需管家翻通讯录
        const eventNow = await this.repo.getEvent(eventId);
        await this.repo.updateEvent(eventId, {
          escalationCount: (eventNow?.escalationCount ?? 0) + 1,
          currentContactId: undefined,
        });
      }
    } catch (err) {
      this.logger.error(
        `事件 ${eventId} 分级呼叫异常: ${(err as Error).message}`,
      );
      await this.repo.updateEvent(eventId, {
        status: 'exhausted',
        currentContactId: undefined,
      });
    } finally {
      this.running.delete(eventId);
      this.signals.delete(eventId);
    }
  }

  /** 选出下一位未呼叫过、启用中、优先级最高的联系人 */
  private async pickNextContact(
    event: EmergencyEvent,
  ): Promise<Contact | undefined> {
    const contacts = await this.repo.listContacts(event.elderId);
    let next: Contact | undefined;
    for (const c of contacts) {
      if (!c.enabled) continue;
      if (await this.repo.hasAttempt(event.id, c.id)) continue;
      if (!next || c.priority < next.priority) next = c;
    }
    return next;
  }

  /** 发起外呼，并允许人工/网关回调提前结束振铃 */
  private performDial(
    eventId: string,
    contact: Contact,
    force?: CallOutcome,
  ): Promise<DialResult> {
    const gatewayPromise = this.dialer.dial(contact.phone, contact.name, {
      forceOutcome: force,
    });

    const callbackPromise = new Promise<DialResult>((resolve) => {
      this.signals.set(eventId, resolve);
    });

    return Promise.race([gatewayPromise, callbackPromise]).finally(() => {
      this.signals.delete(eventId);
    });
  }

  private async finalizeAttempt(
    attemptId: string,
    result: DialResult,
  ): Promise<CallAttempt> {
    const endedAt = new Date().toISOString();
    return this.repo.updateAttempt(attemptId, {
      outcome: result.outcome,
      durationSec: result.durationSec,
      endedAt,
      answeredAt: result.outcome === 'answered' ? endedAt : undefined,
      remark: result.remark,
    });
  }

  /**
   * 语音网关回调 / 管家代操作：当前联系人接通、拒接或呼叫失败。
   * 若仍在振铃，立即结束等待并驱动引擎进入下一步。
   */ async notifyCallResult(
    eventId: string,
    dto: CallCallbackDto,
  ): Promise<EventDetail> {
    const event = await this.repo.getEvent(eventId);
    if (!event) throw new NotFoundException('事件不存在');
    if (!event.currentContactId)
      throw new ConflictException('当前没有正在振铃的通话');

    const attempts = await this.repo.listAttempts(eventId);
    const current = [...attempts]
      .reverse()
      .find((a) => a.outcome === 'ringing');
    if (!current) throw new ConflictException('当前没有振铃中的呼叫记录');

    const signal = this.signals.get(eventId);
    if (signal) {
      signal({
        outcome: dto.outcome,
        durationSec: Math.max(
          1,
          Math.round(
            (Date.now() - new Date(current.startedAt).getTime()) / 1000,
          ),
        ),
        remark:
          dto.remark ??
          (dto.outcome === 'answered' ? '联系人已接听' : undefined),
      });
      // 给主循环一点时间落库，再返回最新详情
      await this.wait(300);
    }
    return this.getDetail(eventId);
  }

  /** 管家结案：填写处置结果并自动生成处置报告 */
  async resolve(eventId: string, dto: ResolveEventDto): Promise<EventDetail> {
    const event = await this.repo.getEvent(eventId);
    if (!event) throw new NotFoundException('事件不存在');
    if (event.status === 'resolved') {
      throw new ConflictException('该事件已结案');
    }

    const resolvedAt = new Date().toISOString();
    const updated = await this.repo.updateEvent(eventId, {
      status: 'resolved',
      resolvedAt,
      resolution: dto.resolution,
      currentContactId: undefined,
    });

    // 若仍在振铃，发失败信号中止当前等待
    this.signals.get(eventId)?.({
      outcome: 'failed',
      durationSec: 0,
      remark: '管家提前结案，中止呼叫',
    });

    const attempts = await this.repo.listAttempts(eventId);
    await this.reportsService.generateIfAbsent(updated, attempts);

    return this.getDetail(eventId);
  }

  async list(elderId?: string): Promise<EmergencyEvent[]> {
    return this.repo.listEvents(elderId);
  }

  async getDetail(eventId: string): Promise<EventDetail> {
    const event = await this.repo.getEvent(eventId);
    if (!event) throw new NotFoundException('事件不存在');
    const elder = await this.repo.getElder(event.elderId);
    if (!elder) throw new NotFoundException('老人信息缺失');
    const attempts = await this.repo.listAttempts(eventId);
    const enriched = await Promise.all(
      attempts.map(async (a) => ({
        ...a,
        contact: (await this.repo.getContact(a.contactId))!,
      })),
    );
    const report = await this.repo.getReportByEvent(eventId);
    return { event, elder, attempts: enriched, report };
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
