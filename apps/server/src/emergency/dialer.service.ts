import { Injectable, Logger } from '@nestjs/common';
import { CallOutcome } from '../common/types';

export interface DialResult {
  outcome: CallOutcome;
  durationSec: number;
  remark?: string;
}

export interface DialOptions {
  /** 振铃超时秒数，超时判定为 no_answer 并触发自动转接 */
  ringTimeoutSec?: number;
  /** 便于测试：强制指定结果（生产环境由真实语音网关回调决定） */
  forceOutcome?: CallOutcome;
}

/**
 * 语音外呼通道（模拟实现）。
 *
 * 生产环境替换为真实语音网关 SDK：dial() 发起呼叫后 Promise 等待网关
 * 状态回调（接通/拒接/无应答/失败）；本模拟实现用定时器在振铃超时后
 * 自动回传 no_answer，以驱动分级引擎转接下一位联系人。
 */
@Injectable()
export class DialerService {
  private readonly logger = new Logger(DialerService.name);
  private readonly defaultTimeoutSec = Number(
    process.env.CALL_RING_TIMEOUT_SEC ?? 20,
  );

  async dial(
    phone: string,
    name: string,
    options: DialOptions = {},
  ): Promise<DialResult> {
    const timeoutSec = options.ringTimeoutSec ?? this.defaultTimeoutSec;
    this.logger.log(`外呼 ${name} ${phone}，振铃超时阈值 ${timeoutSec}s`);

    const startedAt = Date.now();

    if (options.forceOutcome === 'answered') {
      const durationSec = Math.max(1, Math.round(timeoutSec / 4));
      return { outcome: 'answered', durationSec };
    }

    if (options.forceOutcome === 'rejected') {
      await this.wait(Math.min(3, timeoutSec));
      return {
        outcome: 'rejected',
        durationSec: Math.round((Date.now() - startedAt) / 1000),
        remark: '对方挂断',
      };
    }

    if (options.forceOutcome === 'failed') {
      await this.wait(1);
      return { outcome: 'failed', durationSec: 1, remark: '网络/网关错误' };
    }

    if (options.forceOutcome === 'no_answer') {
      // 演示注入：立即模拟一次完整振铃超时，避免前端演示长时间等待
      return {
        outcome: 'no_answer',
        durationSec: timeoutSec,
        remark: `振铃 ${timeoutSec}s 未接听，自动转接下一位`,
      };
    }

    // 默认模拟：振铃至超时仍无人接听
    await this.wait(timeoutSec);
    return {
      outcome: 'no_answer',
      durationSec: timeoutSec,
      remark: `振铃 ${timeoutSec}s 未接听，自动转接下一位`,
    };
  }

  private wait(sec: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, sec * 1000));
  }
}
