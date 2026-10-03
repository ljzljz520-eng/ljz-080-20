import { Injectable, NotFoundException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CallAttempt,
  Contact,
  Elder,
  EmergencyEvent,
  EventReport,
} from './types';
import { EmergencyRepository } from './repository';

interface ContactRow {
  id: string;
  elder_id: string;
  name: string;
  role: Contact['role'];
  phone: string;
  relation: string | null;
  priority: number;
  enabled: boolean;
  access_token: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface ElderRow {
  id: string;
  name: string;
  age: number | null;
  address: string | null;
  phone: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  elder_id: string;
  title: string;
  description: string | null;
  severity: EmergencyEvent['severity'];
  status: EmergencyEvent['status'];
  location: string | null;
  current_contact_id: string | null;
  answered_by_contact_id: string | null;
  initiated_by: string;
  started_at: string;
  resolved_at: string | null;
  resolution: string | null;
  escalation_count: number;
}

interface AttemptRow {
  id: string;
  event_id: string;
  contact_id: string;
  priority: number;
  outcome: CallAttempt['outcome'];
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  remark: string | null;
}

interface ReportRow {
  id: string;
  event_id: string;
  summary: string;
  actions: string[];
  generated_at: string;
}

@Injectable()
export class SupabaseEmergencyRepository extends EmergencyRepository {
  private clientInstance?: SupabaseClient;

  constructor() {
    super();
  }

  /** 懒加载：仅当工厂选择了 Supabase 实现并真正访问数据时才创建客户端 */
  private get client(): SupabaseClient {
    if (!this.clientInstance) {
      this.clientInstance = createClient(
        process.env.SUPABASE_URL ?? '',
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? '',
      );
    }
    return this.clientInstance;
  }

  // ---- mapping ----
  private mapElder(r: ElderRow): Elder {
    return {
      id: r.id,
      name: r.name,
      age: r.age ?? undefined,
      address: r.address ?? undefined,
      phone: r.phone ?? undefined,
      createdAt: r.created_at,
    };
  }

  private mapContact(r: ContactRow): Contact {
    return {
      id: r.id,
      elderId: r.elder_id,
      name: r.name,
      role: r.role,
      phone: r.phone,
      relation: r.relation ?? undefined,
      priority: r.priority,
      enabled: r.enabled,
      accessToken: r.access_token ?? undefined,
      note: r.note ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapEvent(r: EventRow): EmergencyEvent {
    return {
      id: r.id,
      elderId: r.elder_id,
      title: r.title,
      description: r.description ?? undefined,
      severity: r.severity,
      status: r.status,
      location: r.location ?? undefined,
      currentContactId: r.current_contact_id ?? undefined,
      answeredByContactId: r.answered_by_contact_id ?? undefined,
      initiatedBy: r.initiated_by,
      startedAt: r.started_at,
      resolvedAt: r.resolved_at ?? undefined,
      resolution: r.resolution ?? undefined,
      escalationCount: r.escalation_count,
    };
  }

  private mapAttempt(r: AttemptRow): CallAttempt {
    return {
      id: r.id,
      eventId: r.event_id,
      contactId: r.contact_id,
      priority: r.priority,
      outcome: r.outcome,
      startedAt: r.started_at,
      answeredAt: r.answered_at ?? undefined,
      endedAt: r.ended_at ?? undefined,
      durationSec: r.duration_sec ?? undefined,
      remark: r.remark ?? undefined,
    };
  }

  private mapReport(r: ReportRow): EventReport {
    return {
      id: r.id,
      eventId: r.event_id,
      summary: r.summary,
      actions: r.actions ?? [],
      generatedAt: r.generated_at,
    };
  }

  // ---- elders ----
  async listElders(): Promise<Elder[]> {
    const { data, error } = await this.client
      .from('elders')
      .select('*')
      .order('created_at');
    if (error) throw error;
    return (data as ElderRow[]).map((r) => this.mapElder(r));
  }

  async getElder(id: string): Promise<Elder | undefined> {
    const { data, error } = await this.client
      .from('elders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapElder(data as ElderRow) : undefined;
  }

  // ---- contacts ----
  async listContacts(elderId?: string): Promise<Contact[]> {
    let q = this.client.from('contacts').select('*').order('priority');
    if (elderId) q = q.eq('elder_id', elderId);
    const { data, error } = await q;
    if (error) throw error;
    return (data as ContactRow[]).map((r) => this.mapContact(r));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const { data, error } = await this.client
      .from('contacts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapContact(data as ContactRow) : undefined;
  }

  async findContactByToken(token: string): Promise<Contact | undefined> {
    const { data, error } = await this.client
      .from('contacts')
      .select('*')
      .eq('access_token', token)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapContact(data as ContactRow) : undefined;
  }

  async createContact(
    data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Contact> {
    const row = {
      elder_id: data.elderId,
      name: data.name,
      role: data.role,
      phone: data.phone,
      relation: data.relation ?? null,
      priority: data.priority,
      enabled: data.enabled,
      access_token: data.accessToken ?? null,
      note: data.note ?? null,
    };
    const { data: inserted, error } = await this.client
      .from('contacts')
      .insert(row)
      .select('*')
      .single();
    if (error) throw error;
    return this.mapContact(inserted as ContactRow);
  }

  async updateContact(id: string, patch: Partial<Contact>): Promise<Contact> {
    const row: Record<string, unknown> = {};
    if (patch.elderId !== undefined) row.elder_id = patch.elderId;
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.role !== undefined) row.role = patch.role;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.relation !== undefined) row.relation = patch.relation;
    if (patch.priority !== undefined) row.priority = patch.priority;
    if (patch.enabled !== undefined) row.enabled = patch.enabled;
    if (patch.accessToken !== undefined) row.access_token = patch.accessToken;
    if (patch.note !== undefined) row.note = patch.note;
    const { data, error } = await this.client
      .from('contacts')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundException('联系人不存在');
    return this.mapContact(data as ContactRow);
  }

  async deleteContact(id: string): Promise<void> {
    const { error } = await this.client.from('contacts').delete().eq('id', id);
    if (error) throw error;
  }

  // ---- events ----
  async listEvents(
    elderId?: string,
    status?: EmergencyEvent['status'],
  ): Promise<EmergencyEvent[]> {
    let q = this.client
      .from('emergency_events')
      .select('*')
      .order('started_at', { ascending: false });
    if (elderId) q = q.eq('elder_id', elderId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return (data as EventRow[]).map((r) => this.mapEvent(r));
  }

  async getEvent(id: string): Promise<EmergencyEvent | undefined> {
    const { data, error } = await this.client
      .from('emergency_events')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapEvent(data as EventRow) : undefined;
  }

  async createEvent(
    data: Omit<EmergencyEvent, 'id' | 'startedAt' | 'escalationCount'>,
  ): Promise<EmergencyEvent> {
    const row = {
      elder_id: data.elderId,
      title: data.title,
      description: data.description ?? null,
      severity: data.severity,
      status: data.status,
      location: data.location ?? null,
      current_contact_id: data.currentContactId ?? null,
      answered_by_contact_id: data.answeredByContactId ?? null,
      initiated_by: data.initiatedBy,
      resolved_at: data.resolvedAt ?? null,
      resolution: data.resolution ?? null,
    };
    const { data: inserted, error } = await this.client
      .from('emergency_events')
      .insert(row)
      .select('*')
      .single();
    if (error) throw error;
    return this.mapEvent(inserted as EventRow);
  }

  async updateEvent(
    id: string,
    patch: Partial<EmergencyEvent>,
  ): Promise<EmergencyEvent> {
    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.severity !== undefined) row.severity = patch.severity;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.location !== undefined) row.location = patch.location;
    if (patch.currentContactId !== undefined)
      row.current_contact_id = patch.currentContactId;
    if (patch.answeredByContactId !== undefined)
      row.answered_by_contact_id = patch.answeredByContactId;
    if (patch.resolvedAt !== undefined) row.resolved_at = patch.resolvedAt;
    if (patch.resolution !== undefined) row.resolution = patch.resolution;
    if (patch.escalationCount !== undefined)
      row.escalation_count = patch.escalationCount;
    const { data, error } = await this.client
      .from('emergency_events')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundException('事件不存在');
    return this.mapEvent(data as EventRow);
  }

  // ---- attempts ----
  async listAttempts(eventId: string): Promise<CallAttempt[]> {
    const { data, error } = await this.client
      .from('call_attempts')
      .select('*')
      .eq('event_id', eventId)
      .order('started_at');
    if (error) throw error;
    return (data as AttemptRow[]).map((r) => this.mapAttempt(r));
  }

  async getAttempt(id: string): Promise<CallAttempt | undefined> {
    const { data, error } = await this.client
      .from('call_attempts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapAttempt(data as AttemptRow) : undefined;
  }

  async hasAttempt(eventId: string, contactId: string): Promise<boolean> {
    const { count, error } = await this.client
      .from('call_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('contact_id', contactId);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async createAttempt(data: Omit<CallAttempt, 'id'>): Promise<CallAttempt> {
    const row = {
      event_id: data.eventId,
      contact_id: data.contactId,
      priority: data.priority,
      outcome: data.outcome,
      started_at: data.startedAt,
      answered_at: data.answeredAt ?? null,
      ended_at: data.endedAt ?? null,
      duration_sec: data.durationSec ?? null,
      remark: data.remark ?? null,
    };
    const { data: inserted, error } = await this.client
      .from('call_attempts')
      .insert(row)
      .select('*')
      .single();
    if (error) throw error;
    return this.mapAttempt(inserted as AttemptRow);
  }

  async updateAttempt(
    id: string,
    patch: Partial<CallAttempt>,
  ): Promise<CallAttempt> {
    const row: Record<string, unknown> = {};
    if (patch.outcome !== undefined) row.outcome = patch.outcome;
    if (patch.answeredAt !== undefined) row.answered_at = patch.answeredAt;
    if (patch.endedAt !== undefined) row.ended_at = patch.endedAt;
    if (patch.durationSec !== undefined) row.duration_sec = patch.durationSec;
    if (patch.remark !== undefined) row.remark = patch.remark;
    const { data, error } = await this.client
      .from('call_attempts')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundException('呼叫记录不存在');
    return this.mapAttempt(data as AttemptRow);
  }

  // ---- reports ----
  async getReportByEvent(eventId: string): Promise<EventReport | undefined> {
    const { data, error } = await this.client
      .from('event_reports')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapReport(data as ReportRow) : undefined;
  }

  async createReport(
    data: Omit<EventReport, 'id' | 'generatedAt'>,
  ): Promise<EventReport> {
    const row = {
      event_id: data.eventId,
      summary: data.summary,
      actions: data.actions,
    };
    const { data: inserted, error } = await this.client
      .from('event_reports')
      .insert(row)
      .select('*')
      .single();
    if (error) throw error;
    return this.mapReport(inserted as ReportRow);
  }
}
