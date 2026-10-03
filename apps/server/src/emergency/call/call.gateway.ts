import { Injectable, Logger } from '@nestjs/common';
import { CallOutcome } from '../emergency.types';

export interface DialResult {
  outcome: CallOutcome;
  /** 通话时长（秒），接通时 */
  talkSeconds: number | null;
  note: string;
}

interface PendingCall {
  resolve: (result: DialResult) => void;
  timer: NodeJS.Timeout;
  startedAt: number;
}

/**
 * 电话外呼网关（模拟实现）。
 *
 * 真实环境应替换为云呼叫中心 / 语音通知 SDK（如阿里云隐私号、腾讯云呼叫中心），
 * 并通过 Webhook 回调「接通 / 拒接 / 超时」事件；当前模块用振铃超时 + 人工
 * 标记的方式模拟，对外暴露的接口语义保持一致：
 *
 *   dial()      发起呼叫，返回 Promise，在接通 / 挂断 / 超时后 settle
 *   settle()    外部（管理端管家或真实语音 Webhook）提前给出结果
 *
 * 关键规则：第一个联系人未接听时，由 EmergencyService 自动转拨下一位，
 * 管家无需手动翻通讯录——超时未接会自动 reject 为 no_answer 并驱动级联。
 */
@Injectable()
export class CallGateway {
  private readonly logger = new Logger('CallGateway');
  /** attemptId -> 正在振铃的呼叫 */
  private readonly pending = new Map<string, PendingCall>();

  /**
   * 振铃超时时间（毫秒）。默认 20s 无人接听自动转下一位；
   * 可通过环境变量 CALL_RING_TIMEOUT_MS 调整，测试中可设得很短。
   */
  private readonly ringTimeoutMs = Number(
    process.env.CALL_RING_TIMEOUT_MS ?? 20000,
  );

  /** 发起一通呼叫 */
  dial(
    attemptId: string,
    target: { name: string; phone: string },
  ): Promise<DialResult> {
    this.logger.log(
      `-> 正在拨打 ${target.name}（${maskPhone(target.phone)}），attempt=${attemptId}`,
    );

    return new Promise<DialResult>((resolve) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(attemptId)) return;
        this.pending.delete(attemptId);
        this.logger.log(`<- ${target.name} 振铃超时，自动转拨下一位`);
        resolve({
          outcome: 'no_answer',
          talkSeconds: null,
          note: `振铃 ${Math.round(this.ringTimeoutMs / 1000)}s 无人接听，系统自动转拨下一位`,
        });
      }, this.ringTimeoutMs);

      // unref：避免测试进程 / 关闭流程被定时器挂住
      timer.unref?.();

      this.pending.set(attemptId, {
        resolve,
        timer,
        startedAt: Date.now(),
      });
    });
  }

  /**
   * 由外部提前结算当前呼叫：
   *  - 管家在管理端点「标记已接通 / 无人接听 / 挂断」
   *  - 或真实语音平台 Webhook 回调
   * 返回 false 表示该呼叫已结束或不存在（重复回调时幂等忽略）。
   */
  settle(
    attemptId: string,
    outcome: Exclude<CallOutcome, 'pending'>,
    talkSeconds?: number,
    note?: string,
  ): boolean {
    const call = this.pending.get(attemptId);
    if (!call) return false;
    clearTimeout(call.timer);
    this.pending.delete(attemptId);
    const elapsed = Math.max(
      1,
      Math.round((Date.now() - call.startedAt) / 1000),
    );

    const result: DialResult = {
      outcome,
      talkSeconds: outcome === 'answered' ? (talkSeconds ?? elapsed) : null,
      note:
        note ??
        (outcome === 'answered'
          ? '联系人接听，已告知突发情况'
          : outcome === 'rejected'
            ? '联系人主动挂断'
            : outcome === 'offline'
              ? '电话无法接通（关机 / 不在服务区）'
              : '人工标记无人接听'),
    };
    call.resolve(result);
    return true;
  }

  /** 是否仍在振铃中 */
  isRinging(attemptId: string): boolean {
    return this.pending.has(attemptId);
  }
}

export function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
