export type ContactRole = "family" | "neighbor" | "doctor" | "property";
export type CallOutcome =
  | "pending"
  | "ringing"
  | "answered"
  | "no_answer"
  | "rejected"
  | "failed";
export type EventStatus = "active" | "escalating" | "resolved" | "exhausted";
export type EventSeverity = "critical" | "major" | "minor";

export interface Contact {
  id: string;
  elderId: string;
  name: string;
  role: ContactRole;
  phone: string;
  relation?: string;
  priority: number;
  enabled: boolean;
  accessToken?: string;
  note?: string;
}

export interface Elder {
  id: string;
  name: string;
  age?: number;
  address?: string;
  phone?: string;
}

export interface CallAttempt {
  id: string;
  eventId: string;
  contactId: string;
  priority: number;
  outcome: CallOutcome;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  durationSec?: number;
  remark?: string;
  contact: Contact;
}

export interface EmergencyEvent {
  id: string;
  elderId: string;
  title: string;
  description?: string;
  severity: EventSeverity;
  status: EventStatus;
  location?: string;
  currentContactId?: string;
  answeredByContactId?: string;
  initiatedBy: string;
  startedAt: string;
  resolvedAt?: string;
  resolution?: string;
  escalationCount: number;
}

export interface EventReport {
  id: string;
  eventId: string;
  summary: string;
  actions: string[];
  generatedAt: string;
}

export interface EventDetail {
  event: EmergencyEvent;
  elder: Elder;
  attempts: CallAttempt[];
  report?: EventReport;
}

export interface FamilyReportView {
  report: EventReport;
  event: Pick<
    EmergencyEvent,
    | "id"
    | "title"
    | "severity"
    | "location"
    | "startedAt"
    | "resolvedAt"
    | "resolution"
  >;
  elderName: string;
  ownAttempts: Array<{
    priority: number;
    outcome: CallOutcome;
    startedAt: string;
    durationSec?: number;
    remark?: string;
  }>;
  othersSummary: {
    total: number;
    answered: number;
    noAnswer: number;
    rejected: number;
    failed: number;
  };
  answeredByMe: boolean;
}
