-- User tables. All RLS-gated by Clerk user id in 0003_rls.sql.

create extension if not exists pgcrypto;

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email         text,
  created_at    timestamptz not null default now()
);

create table if not exists favorite_flights (
  user_id    uuid not null references users(id) on delete cascade,
  callsign   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, callsign)
);

create table if not exists favorite_airlines (
  user_id     uuid not null references users(id) on delete cascade,
  icao_prefix text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, icao_prefix)
);

create table if not exists saved_views (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null,
  min_lon    double precision not null,
  min_lat    double precision not null,
  max_lon    double precision not null,
  max_lat    double precision not null,
  created_at timestamptz not null default now()
);
create index if not exists saved_views_user_idx on saved_views (user_id);

create table if not exists alert_rules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  name           text not null,
  callsign       text,
  region_view_id uuid references saved_views(id) on delete cascade,
  condition      text not null check (condition in ('enters_region','leaves_region','altitude_below','altitude_above')),
  threshold      double precision,
  last_triggered timestamptz,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists alert_rules_user_idx on alert_rules (user_id);

create table if not exists alert_events (
  id           bigserial primary key,
  rule_id      uuid not null references alert_rules(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  icao24       text,
  callsign     text,
  triggered_at timestamptz not null default now(),
  details      jsonb
);
create index if not exists alert_events_user_idx on alert_events (user_id, triggered_at desc);
