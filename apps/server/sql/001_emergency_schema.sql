-- =============================================================
-- 紧急联系人分级呼叫模块 - Supabase / PostgreSQL Schema
-- 执行位置：Supabase Dashboard -> SQL Editor
-- =============================================================

-- 老人档案
create table if not exists elders (
  id          text primary key default ('elder_' || substr(gen_random_uuid()::text, 1, 12)),
  name        text not null,
  age         int,
  address     text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- 紧急联系人：家属 / 邻里 / 社区医生 / 物业，按 priority 分级
create table if not exists contacts (
  id            text primary key default ('contact_' || substr(gen_random_uuid()::text, 1, 12)),
  elder_id      text not null references elders(id) on delete cascade,
  name          text not null,
  role          text not null check (role in ('family', 'neighbor', 'doctor', 'property')),
  phone         text not null,
  relation      text,
  priority      int  not null check (priority >= 1),
  enabled       boolean not null default true,
  access_token  text unique,                       -- 仅家属角色使用，H5 端身份凭证
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_contacts_elder on contacts(elder_id, priority);

-- 突发事件
create table if not exists emergency_events (
  id                     text primary key default ('event_' || substr(gen_random_uuid()::text, 1, 12)),
  elder_id               text not null references elders(id) on delete cascade,
  title                  text not null,
  description            text,
  severity               text not null check (severity in ('critical', 'major', 'minor')),
  status                 text not null default 'active'
                           check (status in ('active', 'escalating', 'resolved', 'exhausted')),
  location               text,
  current_contact_id     text references contacts(id) on delete set null,
  answered_by_contact_id text references contacts(id) on delete set null,
  initiated_by           text not null,
  started_at             timestamptz not null default now(),
  resolved_at            timestamptz,
  resolution             text,
  escalation_count       int not null default 0
);
create index if not exists idx_events_elder_status on emergency_events(elder_id, status);
create index if not exists idx_events_started on emergency_events(started_at desc);

-- 每一次外呼尝试（接通结果留痕，是自动转接与处置报告的数据基础）
create table if not exists call_attempts (
  id           text primary key default ('attempt_' || substr(gen_random_uuid()::text, 1, 12)),
  event_id     text not null references emergency_events(id) on delete cascade,
  contact_id   text not null references contacts(id) on delete cascade,
  priority     int not null,
  outcome      text not null default 'ringing'
                 check (outcome in ('pending', 'ringing', 'answered', 'no_answer', 'rejected', 'failed')),
  started_at   timestamptz not null default now(),
  answered_at  timestamptz,
  ended_at     timestamptz,
  duration_sec int,
  remark       text
);
create index if not exists idx_attempts_event on call_attempts(event_id, started_at);

-- 处置报告（事件结案后生成，一份/事件）
create table if not exists event_reports (
  id           text primary key default ('report_' || substr(gen_random_uuid()::text, 1, 12)),
  event_id     text not null unique references emergency_events(id) on delete cascade,
  summary      text not null,
  actions      jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

-- updated_at 自动维护
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_contacts_updated on contacts;
create trigger trg_contacts_updated before update on contacts
  for each row execute function set_updated_at();

-- =============================================================
-- 行级安全（RLS）：服务端使用 service_role 密钥访问，绕过 RLS；
-- 家属 H5 只走后端 /api/family/* 接口，后端按 access_token 过滤，
-- 因此这里默认对 anon 角色禁用直连。
-- =============================================================
alter table elders enable row level security;
alter table contacts enable row level security;
alter table emergency_events enable row level security;
alter table call_attempts enable row level security;
alter table event_reports enable row level security;
-- 不创建 anon 的 permissive policy => 匿名直连默认拒绝
