-- Nachbau des Bestands, soweit der Saalplan ihn berührt (aufbauend auf modell-lokal-zahlung.sql).
-- tische wie live gelesen am 24.10.2026 (information_schema, pg_constraint, pg_policies).
-- VOR den Migrationen: Zustand, in dem die Tabelle noch ALLE Rechte und die offene
-- ALL-Regel „tische team pflegt“ hatte (Supabase-Vorgabe: anon + authenticated bekommen alles).
-- Die echten Funktionen (meine_betriebe_inhaber, ist_inhaber) kommen aus migration-rollen.sql.
create table public.tische (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  nummer text not null,
  schluessel text not null unique,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  unique (betrieb_id, nummer));
alter table public.tische enable row level security;
grant all on public.tische to anon, authenticated;
create policy "tische team liest" on public.tische for select to authenticated
  using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
create policy "tische team pflegt" on public.tische for all to authenticated
  using (betrieb_id in (select public.meine_betriebe())) with check (betrieb_id in (select public.meine_betriebe()));
-- Bestand: zwei Betriebe, je ein Inhaber, Betrieb 1 mit 20 Tischen (wie live)
insert into auth.users(id, email) values
  ('11111111-1111-1111-1111-111111111111','inhaber1@probe.invalid'),
  ('22222222-2222-2222-2222-222222222222','inhaber2@probe.invalid');
insert into public.betriebe(id, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Probe Eins','eins'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Probe Zwei','zwei');
insert into public.betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','inhaber'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222','inhaber');
insert into public.tische(betrieb_id, nummer, schluessel)
  select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', n::text, 'k'||n from generate_series(1,20) n;
insert into public.tische(betrieb_id, nummer, schluessel)
  select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', n::text, 'f'||n from generate_series(1,3) n;

-- betriebe: die Spalten, die die Rubriken und die Pause berühren; Regel und Spaltenrecht wie live gelesen am 24.10.2026
alter table public.betriebe add column hub_kacheln jsonb, add column bestell_pause boolean not null default false, add column bestell_pause_text text;
create policy "betrieb team aendert" on public.betriebe for update to authenticated
  using (id in (select public.meine_betriebe()) or public.ist_master())
  with check (id in (select public.meine_betriebe()) or public.ist_master());
grant update (name, hub_kacheln, bestell_pause, bestell_pause_text) on public.betriebe to authenticated;
create trigger betrieb_rolle_wache before update on public.betriebe for each row execute function public.betrieb_rolle_wache();
