-- RLS for user tables. Uses Clerk JWT template that sets 'sub' to the Clerk user id.
-- The Clerk JWT template named 'supabase' must be configured to sign with the Supabase JWT secret.

alter table users             enable row level security;
alter table favorite_flights  enable row level security;
alter table favorite_airlines enable row level security;
alter table saved_views       enable row level security;
alter table alert_rules       enable row level security;
alter table alert_events      enable row level security;

-- Helper: resolve current user row via Clerk sub claim.
create or replace function current_user_row_id() returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from users where clerk_user_id = (auth.jwt() ->> 'sub')
$$;

grant execute on function current_user_row_id() to anon, authenticated;

-- users: users may see/update their own row. Insert is done by server via webhook (service role).
drop policy if exists "self select" on users;
create policy "self select" on users
  for select using (clerk_user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "self update" on users;
create policy "self update" on users
  for update using (clerk_user_id = (auth.jwt() ->> 'sub'));

-- favorite_flights
drop policy if exists "own favorite_flights" on favorite_flights;
create policy "own favorite_flights" on favorite_flights
  for all
  using (user_id = current_user_row_id())
  with check (user_id = current_user_row_id());

-- favorite_airlines
drop policy if exists "own favorite_airlines" on favorite_airlines;
create policy "own favorite_airlines" on favorite_airlines
  for all
  using (user_id = current_user_row_id())
  with check (user_id = current_user_row_id());

-- saved_views
drop policy if exists "own saved_views" on saved_views;
create policy "own saved_views" on saved_views
  for all
  using (user_id = current_user_row_id())
  with check (user_id = current_user_row_id());

-- alert_rules
drop policy if exists "own alert_rules" on alert_rules;
create policy "own alert_rules" on alert_rules
  for all
  using (user_id = current_user_row_id())
  with check (user_id = current_user_row_id());

-- alert_events: users can read their own events; writes are server-side (service role).
drop policy if exists "own alert_events read" on alert_events;
create policy "own alert_events read" on alert_events
  for select using (user_id = current_user_row_id());
