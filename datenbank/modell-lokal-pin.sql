-- Nachbau des Live-Bestands, soweit die PIN ihn berührt (Stand 25.09., gelesen per MCP)
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, encrypted_password text,
  last_sign_in_at timestamptz, email_confirmed_at timestamptz);
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant usage on schema auth, extensions to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;

create table public.betriebe(id uuid primary key default gen_random_uuid(), name text, slug text);
create table public.betrieb_mitglieder(betrieb_id uuid references public.betriebe(id), nutzer_id uuid, rolle text default 'inhaber', angelegt timestamptz default now());
create table public.master_konten(benutzer_id uuid primary key, email text, notiz text, angelegt_am timestamptz default now());
create table public.admin_login_schutz(nutzer_id uuid primary key, fehlversuche int default 0, gesperrt boolean default false, gesperrt_seit timestamptz, aktualisiert timestamptz);
create table public.gerichte(id uuid primary key default gen_random_uuid(), betrieb_id uuid, name text);
create table public.bestellungen(id uuid primary key default gen_random_uuid(), betrieb_id uuid, summe numeric, rabatt_betrag numeric, rabatt_code text);
create table public.rabattcodes(id uuid primary key default gen_random_uuid(), betrieb_id uuid, code text, betrag numeric, prozent numeric,
  eingeloest boolean default false, gueltig_bis timestamptz, eingeloest_bestellung_id uuid, eingeloest_am timestamptz);

create function public.meine_betriebe() returns setof uuid language sql stable security definer set search_path to 'public' as
  $$ select betrieb_id from betrieb_mitglieder where nutzer_id = auth.uid() $$;
create function public.ist_master() returns boolean language sql stable security definer set search_path to 'public' as
  $$ select exists (select 1 from public.master_konten where benutzer_id = auth.uid()) $$;
create function public.admin_login_entsperren() returns trigger language plpgsql security definer set search_path to 'public' as
  $$ begin return new; end $$;

alter table public.betriebe enable row level security;
alter table public.betrieb_mitglieder enable row level security;
alter table public.gerichte enable row level security;
alter table public.bestellungen enable row level security;
alter table public.rabattcodes enable row level security;
create policy "betrieb team liest" on public.betriebe for select to authenticated using (id in (select meine_betriebe()) or ist_master());
create policy "betrieb team aendert" on public.betriebe for update to authenticated using (id in (select meine_betriebe()) or ist_master()) with check (id in (select meine_betriebe()) or ist_master());
create policy "mitglied liest sich selbst" on public.betrieb_mitglieder for select to authenticated using (nutzer_id = auth.uid());
create policy "gerichte team" on public.gerichte for all to authenticated using (betrieb_id in (select meine_betriebe()) or ist_master()) with check (betrieb_id in (select meine_betriebe()));
create policy "bestellung team" on public.bestellungen for all to authenticated using (betrieb_id in (select meine_betriebe()) or ist_master());
create policy rabattcodes_eigene_lesen on public.rabattcodes for select to authenticated using (exists (select 1 from betrieb_mitglieder m where m.betrieb_id = rabattcodes.betrieb_id and m.nutzer_id = auth.uid()));
grant select (id, name, slug), update (name) on public.betriebe to authenticated;
grant select on public.betrieb_mitglieder, public.gerichte, public.bestellungen, public.rabattcodes to authenticated;
grant update, insert, delete on public.gerichte to authenticated;

-- Bestand: zwei Betriebe, ein Wirt je Betrieb, ein Master, ein Koch ohne PIN
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-00000000000a','wirt@choco.de'),
 ('00000000-0000-0000-0000-00000000000b','wirt@blend.de'),
 ('00000000-0000-0000-0000-00000000000c','koch@choco.de'),
 ('00000000-0000-0000-0000-0000000000ff','master@omoteno.de');
insert into public.betriebe(id,name,slug) values
 ('10000000-0000-0000-0000-000000000001','Choco','chocolamour'),
 ('10000000-0000-0000-0000-000000000002','Blend','blend');
insert into public.betrieb_mitglieder(betrieb_id,nutzer_id) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000b'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c');
insert into public.master_konten(benutzer_id,email) values ('00000000-0000-0000-0000-0000000000ff','master@omoteno.de');
insert into public.gerichte(betrieb_id,name) values ('10000000-0000-0000-0000-000000000001','Crêpe'),('10000000-0000-0000-0000-000000000002','Mojito');
insert into public.bestellungen(id,betrieb_id,summe) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',20);
insert into public.rabattcodes(betrieb_id,code,betrag) values ('10000000-0000-0000-0000-000000000001','CHOCO-1',2);
