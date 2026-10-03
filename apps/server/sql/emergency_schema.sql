-- =============================================================
-- 紧急联系人分级呼叫模块 —— Supabase / Postgres 表结构
-- 在 Supabase SQL Editor 中执行即可。仓储层可对照本结构实现
-- SupabaseEmergencyRepository 替换内存实现。
-- =============================================================

-- 老人档案
create table if not exists elders (
  id          text primary key,
  name        text not null,
  gender      text not null check (gender in ('male', 'female')),
  age         int  not null check (age > 0),
  room        text not null default '',
  address     text not null default '',
  phone       text not null,
  created_at  timestamptz not null default now()
);

-- 紧急联系人（家属 / 邻里 / 社区医生 / 物业）
create table if not exists emergency_contacts (
  id           text primary key,
  elder_id     text not null references elders(id) on delete cascade,
  name         text not null,
  relation     text not null default '',
  type         text not null check (type in ('family', 'neighbor', 'doctor', 'property')),
  phone        text not null,
  priority     int  not null check (priority >= 1),
  enabled      boolean not null default true,
  family_token text,                       -- 仅家属有值，H5 专属访问令牌
  created_at   timestamptz not null default now(),
  unique (elder_id, priority)
);
create index if not exists idx_contacts_elder on emergency_contacts(elder_id);
create unique index if not exists idx_contacts_family_token
  on emergency_contacts(family_token) where family_token is not null;

-- 突发事件
create table if not exists emergency_events (
  id                  text primary key,
  elder_id            text not null references elders(id),
  type                text not null check (type in ('fall', 'illness', 'fire', 'intruder', 'other')),
  description         text not null default '',
  status              text not null check (status in ('pending', 'calling', 'answered', 'resolved', 'failed')),
  answered_contact_id text references emergency_contacts(id),
  answered_attempt_id text,
  resolution          text,
  triggered_at        timestamptz not null default now(),
  cascade_started_at  timestamptz,
  closed_at           timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_events_elder on emergency_events(elder_id);
create index if not exists idx_events_status on emergency_events(status);

-- 每一通拨打记录（接通结果留痕）
create table if not exists call_attempts (
  id            text primary key,
  event_id      text not null references emergency_events(id) on delete cascade,
  contact_id    text not null references emergency_contacts(id),
  sequence      int  not null,           -- 第几级
  outcome       text not null check (outcome in ('pending', 'answered', 'no_answer', 'rejected', 'offline')),
  stage         text not null check (stage in ('ringing', 'connected', 'ended')),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  talk_seconds  int,
  note          text
);
create index if not exists idx_attempts_event on call_attempts(event_id, sequence);

-- -------------------------------------------------------------
-- RLS：家属只能读取与自己相关的数据（凭 family_token 的服务端代理接口鉴权后访问；
-- 若直接使用 supabase-js 匿名客户端，可开启以下策略）。
-- -------------------------------------------------------------
alter table emergency_events enable row level security;
alter table call_attempts enable row level security;

-- 家属视角：通过后端 /api/family/* 访问，后端只返回该 token 对应联系人片段；
-- 直连策略示例（需要先以 family_token 登录 / 映射 auth.uid()，此处仅作模板）：
-- create policy "family_read_own_elder_events" on emergency_events
--   for select using (
--     elder_id in (
--       select elder_id from emergency_contacts where family_token = auth.jwt() ->> 'family_token'
--     )
--   );
