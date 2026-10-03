import { Injectable } from '@nestjs/common';
import {
  CallAttempt,
  EmergencyContact,
  EmergencyEvent,
  Elder,
} from '../emergency.types';

/**
 * 内存数据存储。
 *
 * 项目数据库选型为 Supabase（Postgres），表结构见 sql/emergency_schema.sql。
 * 为了让模块在没有可用 Supabase 实例时也能独立运行 / 演示 / 跑测试，
 * 仓储层在这里使用内存实现；接入 Supabase 时只需新增一套 SupabaseXxxRepository
 * 并在 EmergencyModule 中按环境变量切换，上层 Service 无需改动。
 */
@Injectable()
export class MemoryStore {
  readonly elders = new Map<string, Elder>();
  readonly contacts = new Map<string, EmergencyContact>();
  readonly events = new Map<string, EmergencyEvent>();
  readonly attempts = new Map<string, CallAttempt>();

  /** 事件 ID -> 该事件下全部拨打记录（有序），便于级联呼叫快速读取 */
  readonly attemptsByEvent = new Map<string, CallAttempt[]>();

  reset(): void {
    this.elders.clear();
    this.contacts.clear();
    this.events.clear();
    this.attempts.clear();
    this.attemptsByEvent.clear();
  }
}
