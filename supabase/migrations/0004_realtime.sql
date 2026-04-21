-- Enable realtime for aircraft_states so the frontend can stream position updates.
-- supabase_realtime publication is created by default; we just add the table to it.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'aircraft_states'
  ) then
    execute 'alter publication supabase_realtime add table public.aircraft_states';
  end if;
end
$$;

-- Ensure full row data on updates (needed so realtime payloads include old + new positions).
alter table public.aircraft_states replica identity full;
