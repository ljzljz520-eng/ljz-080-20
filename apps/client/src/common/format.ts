import type {
  CallOutcome,
  ContactRole,
  EventSeverity,
  EventStatus,
} from "../api/types";

export const ROLE_LABEL: Record<ContactRole, string> = {
  family: "家属",
  neighbor: "邻里",
  doctor: "社区医生",
  property: "物业",
};

export const ROLE_COLOR: Record<ContactRole, string> = {
  family: "#f43f5e",
  neighbor: "#2563eb",
  doctor: "#16a34a",
  property: "#d97706",
};

export const OUTCOME_LABEL: Record<CallOutcome, string> = {
  pending: "等待",
  ringing: "振铃中",
  answered: "已接通",
  no_answer: "未接听",
  rejected: "已拒接",
  failed: "呼叫失败",
};

export const OUTCOME_COLOR: Record<CallOutcome, string> = {
  pending: "#8c8c8c",
  ringing: "#1677ff",
  answered: "#52c41a",
  no_answer: "#faad14",
  rejected: "#fa8c16",
  failed: "#ff4d4f",
};

export const STATUS_META: Record<
  EventStatus,
  { label: string; color: string; bg: string }
> = {
  active: { label: "处置中（已接通）", color: "#15803d", bg: "#dcfce7" },
  escalating: { label: "分级呼叫中", color: "#1d4ed8", bg: "#dbeafe" },
  resolved: { label: "已结案", color: "#52525b", bg: "#f4f4f5" },
  exhausted: { label: "全部未接听·待介入", color: "#b91c1c", bg: "#fee2e2" },
};

export const SEVERITY_META: Record<
  EventSeverity,
  { label: string; color: string }
> = {
  critical: { label: "紧急", color: "#dc2626" },
  major: { label: "较重", color: "#ea580c" },
  minor: { label: "一般", color: "#ca8a04" },
};

export function fmtTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function fmtDuration(sec?: number): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec} 秒`;
  return `${Math.floor(sec / 60)} 分 ${sec % 60} 秒`;
}
