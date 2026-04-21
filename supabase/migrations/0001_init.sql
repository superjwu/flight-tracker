-- Live aircraft data. Worker writes with service role, everyone reads.

create table if not exists aircraft_states (
  icao24         text primary key,
  callsign       text,
  origin_country text,
  longitude      double precision,
  latitude       double precision,
  altitude_m     double precision,
  velocity_ms    double precision,
  heading_deg    double precision,
  vertical_rate  double precision,
  on_ground      boolean not null default false,
  squawk         text,
  last_contact   timestamptz,
  updated_at     timestamptz not null default now()
);

create index if not exists aircraft_states_lonlat_idx
  on aircraft_states (longitude, latitude);
create index if not exists aircraft_states_callsign_idx
  on aircraft_states (callsign);
create index if not exists aircraft_states_updated_at_idx
  on aircraft_states (updated_at desc);

create table if not exists aircraft_positions (
  id          bigserial primary key,
  icao24      text not null,
  longitude   double precision not null,
  latitude    double precision not null,
  altitude_m  double precision,
  heading_deg double precision,
  observed_at timestamptz not null default now()
);

create index if not exists aircraft_positions_icao_obs_idx
  on aircraft_positions (icao24, observed_at desc);
create index if not exists aircraft_positions_obs_idx
  on aircraft_positions (observed_at);

-- Public read access for live data.
alter table aircraft_states enable row level security;
alter table aircraft_positions enable row level security;

drop policy if exists "public read aircraft_states" on aircraft_states;
create policy "public read aircraft_states" on aircraft_states
  for select using (true);

drop policy if exists "public read aircraft_positions" on aircraft_positions;
create policy "public read aircraft_positions" on aircraft_positions
  for select using (true);
-- No insert/update/delete policies => only service_role (which bypasses RLS) can write.
