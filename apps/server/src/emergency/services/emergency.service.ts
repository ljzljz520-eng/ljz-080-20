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
  EmergencyContact,
  EmergencyEvent,
  EventType,
} from '../emergency.types';
import { EmergencyRepository, genId } from '../repository/emergency.repository';
import { CallGateway, DialResult } from '../call/call.gateway';

export class EventActionError extends Error {}

/**
 * 突发事件与分级呼叫编排。
 *
 * 级联规则（核心）：
 *  1. 事件触发后，按联系人 priority 升序生成呼叫队列（家属 → 家属 → 医生 → 邻里 → 物业）。
 *  2. 从第 1 级开始拨打；振铃超时 / 拒接 / 无法接通时，系统【自动】转拨下一位，
 *     无需管家手动翻通讯录。
 *  3. 任意一位接通即停止级联，事件进入「已接通、等待处置」。
 *  4. 全部联系人都未接通，事件标记为「全部未接」，提示管家走线下兜底流程。
 */
@Injectable()
export class EmergencyService {
  private readonly logger = new Logger('EmergencyService');

  /**
   * 每次转拨之间的间隔（毫秒），给系统写记录的缓冲，也更贴近真实外呼节奏。
   */
  private readonly nextDialGapMs = Number(process.env.CALL_NEXT_GAP_MS ?? 800);

  /** 正在进行级联的事件集合，防止同一事件被重复发起 */
  private readonly cascading = new Set<string>();

  constructor(
    private readonly repo: EmergencyRepository,
    private readonly gateway: CallGateway,
  ) {}

  // ---------- 事件查询 ----------

  listEvents(elderId?: string): EmergencyEvent[] {
    return this.repo.listEvents(elderId);
  }

  getEventOrThrow(eventId: string): EmergencyEvent {
    const event = this.repo.getEvent(eventId);
    if (!event) throw new NotFoundException(`事件不存在：${eventId}`);
    return event;
  }

  /** 事件详情（含老人快照、拨打明细、联系人快照） */
  getEventDetail(eventId: string) {
    const event = this.getEventOrThrow(eventId);
    const elder = this.repo.getElder(event.elderId);
    const attempts = this.repo.listAttempts(eventId).map((a) => {
      const contact = this.repo.getContact(a.contactId);
      return {
        ...a,
        contact: contact
          ? {
              id: contact.id,
              name: contact.name,
              relation: contact.relation,
              type: contact.type,
              phone: contact.phone,
            }
          : null,
      };
    });
    const answeredContact = event.answeredContactId
      ? (this.repo.getContact(event.answeredContactId) ?? null)
      : null;
    return {
      event,
      elder: elder ?? null,
      answeredContact: answeredContact
        ? {
            id: answeredContact.id,
            name: answeredContact.name,
            relation: answeredContact.relation,
            type: answeredContact.type,
          }
        : null,
      attempts,
      /** 当前振铃中的 attempt（前端据此高亮） */
      ringingAttemptId:
        attempts.find((a) => this.gateway.isRinging(a.id))?.id ?? null,
    };
  }

  // ---------- 触发事件 ----------

  trigger(
    elderId: string,
    type: EventType,
    description?: string,
  ): EmergencyEvent {
    const elder = this.repo.getElder(elderId);
    if (!elder) throw new NotFoundException(`老人不存在：${elderId}`);
    const types: EventType[] = ['fall', 'illness', 'fire', 'intruder', 'other'];
    if (!types.includes(type)) throw new BadRequestException('事件类型不合法');

    const event: EmergencyEvent = {
      id: genId('ev'),
      elderId,
      type,
      description: description?.trim() || '',
      status: 'pending',
      answeredContactId: null,
      answeredAttemptId: null,
      resolution: null,
      triggeredAt: new Date().toISOString(),
      cascadeStartedAt: null,
      closedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.repo.saveEvent(event);
    this.logger.warn(`收到突发事件：${elder.name} / ${type} / ${event.id}`);
    return event;
  }

  // ---------- 发起 / 继续分级呼叫 ----------

  /**
   * 开始对一个待受理（或全部未接后重试）的事件执行分级呼叫。
   * 呼叫在后台异步进行，接口立即返回，前端轮询事件详情查看进度。
   */
  startCascade(eventId: string): Promise<EmergencyEvent> {
    // 所有参数校验放到 async 体内，保证失败时以 rejected promise 形式返回，
    // 与控制器 await / 前端 .catch 的调用约定一致。
    return this.startCascadeInternal(eventId);
  }

  private async startCascadeInternal(eventId: string): Promise<EmergencyEvent> {
    const event = this.getEventOrThrow(eventId);
    if (this.cascading.has(eventId))
      throw new ConflictException('该事件正在分级呼叫中，请勿重复发起');
    if (event.status === 'calling')
      throw new ConflictException('呼叫已在进行中');
    if (event.status === 'resolved')
      throw new ConflictException('事件已处置完成，无需再次呼叫');

    const chain = this.repo.getCascadeChain(event.elderId);
    if (chain.length === 0)
      throw new BadRequestException('该老人尚未设置任何启用的紧急联系人');

    const updated: EmergencyEvent = {
      ...event,
      status: 'calling',
      cascadeStartedAt: event.cascadeStartedAt ?? new Date().toISOString(),
      // 重试（failed -> calling）时清空旧结论，旧拨打记录保留留痕
      closedAt: null,
    };
    this.repo.saveEvent(updated);
    this.cascading.add(eventId);

    // 后台执行，不 await；异常内部消化，避免 unhandled rejection
    void this.runCascade(updated, chain).finally(() => {
      this.cascading.delete(eventId);
    });

    return Promise.resolve(updated);
  }

  /**
   * 分级呼叫主循环。逐级拨打，未接自动转下一级。
   */
  private async runCascade(
    event: EmergencyEvent,
    chain: EmergencyContact[],
  ): Promise<void> {
    const elder = this.repo.getElder(event.elderId);
    this.logger.log(
      `[${event.id}] 开始分级呼叫，共 ${chain.length} 位联系人，` +
        chain.map((c, i) => `L${i + 1} ${c.name}(${c.type})`).join(' → '),
    );

    for (let i = 0; i < chain.length; i += 1) {
      // 事件可能在等待间隙被管家关闭
      const fresh = this.repo.getEvent(event.id);
      if (!fresh || fresh.status === 'resolved') return;

      const contact = chain[i];
      const sequence = i + 1;
      const attempt = this.createAttempt(event.id, contact.id, sequence);

      this.logger.log(
        `[${event.id}] 第 ${sequence} 级：${contact.name}（${contact.relation || contact.type}）`,
      );

      const result = await this.gateway.dial(attempt.id, {
        name: contact.name,
        phone: contact.phone,
      });

      // 等待期间事件可能已被关闭
      const current = this.repo.getEvent(event.id);
      if (!current || current.status === 'resolved') {
        this.finalizeAttempt(attempt.id, result);
        return;
      }

      this.finalizeAttempt(attempt.id, result);

      if (result.outcome === 'answered') {
        const answered: EmergencyEvent = {
          ...current,
          status: 'answered',
          answeredContactId: contact.id,
          answeredAttemptId: attempt.id,
        };
        this.repo.saveEvent(answered);
        this.logger.warn(
          `[${event.id}] 第 ${sequence} 级联系人 ${contact.name} 已接通，停止继续呼叫`,
        );
        return;
      }

      // 未接通 → 自动转下一位
      if (i < chain.length - 1) {
        this.logger.log(
          `[${event.id}] ${contact.name} ${labelOf(result.outcome)}，${Math.round(
            this.nextDialGapMs / 1000,
          )}s 后自动转拨第 ${sequence + 1} 位联系人`,
        );
        await this.sleep(this.nextDialGapMs);
      }
    }

    // 走完全部联系人仍无人接听
    const failed = this.repo.getEvent(event.id);
    if (failed && failed.status === 'calling') {
      this.repo.saveEvent({
        ...failed,
        status: 'failed',
        closedAt: new Date().toISOString(),
      });
      this.logger.error(
        `[${event.id}] 全部 ${chain.length} 位联系人均未接通，请管家立即线下处置（${elder?.name}）`,
      );
    }
  }

  // ---------- 管家标记当前通话结果（真实语音 Webhook 也走这里） ----------

  settleCall(
    eventId: string,
    attemptId: string,
    outcome: Exclude<CallOutcome, 'pending'>,
    talkSeconds?: number,
    note?: string,
  ): { ok: true; event: EmergencyEvent } {
    const event = this.getEventOrThrow(eventId);
    const attempt = this.repo.getAttempt(attemptId);
    if (!attempt || attempt.eventId !== eventId)
      throw new NotFoundException('拨打记录不存在');
    if (attempt.stage === 'ended')
      throw new ConflictException('该通话已结束，结果不可重复修改');

    const ok = this.gateway.settle(attemptId, outcome, talkSeconds, note);
    if (!ok)
      throw new ConflictException('当前没有正在振铃的通话（可能已超时转拨）');

    // gateway 的 Promise resolve 后，runCascade 会继续推进状态机；
    // 这里重新读取事件返回最新状态。
    return { ok: true as const, event: this.repo.getEvent(eventId) ?? event };
  }

  // ---------- 关闭事件（生成处置报告） ----------

  resolveEvent(
    eventId: string,
    resolution: string,
  ): { ok: true; event: EmergencyEvent } {
    const event = this.getEventOrThrow(eventId);
    if (event.status === 'resolved') throw new ConflictException('事件已关闭');
    if (!resolution?.trim()) throw new BadRequestException('请填写处置小结');

    // 关闭时若仍有振铃中的电话，标记为人工终止
    for (const attempt of this.repo.listAttempts(eventId)) {
      if (this.gateway.isRinging(attempt.id)) {
        this.gateway.settle(
          attempt.id,
          'no_answer',
          undefined,
          '事件已关闭，终止呼叫',
        );
      }
    }

    const closed: EmergencyEvent = {
      ...event,
      status: 'resolved',
      resolution: resolution.trim(),
      closedAt: new Date().toISOString(),
    };
    this.repo.saveEvent(closed);
    this.logger.log(`[${eventId}] 事件已处置并生成报告`);
    return { ok: true, event: closed };
  }

  // ---------- 内部工具 ----------

  private createAttempt(
    eventId: string,
    contactId: string,
    sequence: number,
  ): CallAttempt {
    const attempt: CallAttempt = {
      id: genId('call'),
      eventId,
      contactId,
      sequence,
      outcome: 'pending',
      stage: 'ringing',
      startedAt: new Date().toISOString(),
      endedAt: null,
      talkSeconds: null,
      note: null,
    };
    return this.repo.saveAttempt(attempt);
  }

  private finalizeAttempt(attemptId: string, result: DialResult): CallAttempt {
    const attempt = this.repo.getAttempt(attemptId);
    if (!attempt) throw new NotFoundException('拨打记录丢失');
    const endedAt = new Date().toISOString();
    const updated: CallAttempt =
      attempt.stage === 'ended'
        ? attempt // 已被关闭流程结算则保持不变（幂等）
        : {
            ...attempt,
            outcome: result.outcome,
            stage: result.outcome === 'answered' ? 'connected' : 'ended',
            endedAt,
            talkSeconds: result.talkSeconds,
            note: result.note,
          };
    return this.repo.saveAttempt(updated);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => {
      const t = setTimeout(r, ms);
      t.unref?.();
    });
  }
}

function labelOf(outcome: CallOutcome): string {
  switch (outcome) {
    case 'no_answer':
      return '无人接听';
    case 'rejected':
      return '挂断';
    case 'offline':
      return '无法接通';
    default:
      return outcome;
  }
}
