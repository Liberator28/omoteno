-- Nachbau des Bestands, soweit die Zahlungen ihn berühren. Die echten Funktionen
-- (pin_ausstellung_pruefen, ist_inhaber, protokoll_*, schutz_bremsen) kommen aus
-- den Migrationsdateien (Aufruf: pruefungen/pruef-zahlungen-lokal.sh), nicht aus
-- dieser Datei — sonst prüfte die Probe eine Erfindung (§8.1i).
do $$ declare r text; begin
  foreach r in array array['anon','authenticated','service_role'] loop
    if not exists (select 1 from pg_roles where rolname=r) then execute format('create role %I nologin', r); end if;
  end loop; end $$;
create schema auth; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, encrypted_password text,
  last_sign_in_at timestamptz, email_confirmed_at timestamptz);
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant usage on schema auth, extensions, public to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create table public.betriebe(id uuid primary key default gen_random_uuid(), name text, slug text, pin_pflicht boolean not null default false);
create table public.betrieb_mitglieder(betrieb_id uuid references public.betriebe(id), nutzer_id uuid, rolle text default 'inhaber',
  anzeigename text, angelegt timestamptz default now());
create table public.master_konten(benutzer_id uuid primary key, email text);
create table public.konto_pin (nutzer_id uuid primary key references auth.users(id) on delete cascade, pin_hash text not null,
  fehlversuche integer not null default 0, gesperrt boolean not null default false, gesetzt_am timestamptz not null default now(), gesetzt_von uuid);
create table public.pin_sitzungen(nutzer_id uuid, sitzung text, bis timestamptz, primary key(nutzer_id, sitzung));
-- bestellungen wie live (Spalten aus den Migrationen gelesen)
create table public.bestellungen(id uuid primary key default gen_random_uuid(), betrieb_id uuid, quelle text, status text default 'neu',
  summe numeric, liefergebuehr numeric, rabatt_betrag numeric, pruefen boolean default false, pruef_grund text, zeitpunkt timestamptz default now(),
  gast_kennung text);
create table public.protokoll (
  id bigint generated always as identity primary key, betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  nutzer_id uuid, name text, tabelle text not null,
  art text not null check (art in ('neu','geaendert','geloescht')), ziel text, felder text[] not null default '{}',
  vorher jsonb, nachher jsonb, zeit timestamptz not null default now());
alter table public.protokoll add constraint protokoll_tabelle_check
  check (tabelle in ('betriebe','gerichte','aktionen','gutscheine','rabattcodes','team'));

create function public.meine_betriebe() returns setof uuid language sql stable security definer set search_path to 'public' as
  $$ select betrieb_id from betrieb_mitglieder where nutzer_id = auth.uid() $$;
create function public.ist_master() returns boolean language sql stable security definer set search_path to 'public' as
  $$ select exists (select 1 from public.master_konten where benutzer_id = auth.uid()) $$;
-- Bremse: gezählt wird in einer Tabelle, damit die Probe die Zählung sehen kann
create table public.bremse_log(ort text, grenze int);
create function public.schutz_bremsen(p_ort text, p_grenze integer, p_min integer default 10)
returns void language plpgsql security definer set search_path = public as $$
begin insert into public.bremse_log values (p_ort, p_grenze); end $$;

alter table public.betriebe enable row level security;
alter table public.betrieb_mitglieder enable row level security;
alter table public.bestellungen enable row level security;
alter table public.protokoll enable row level security;
create policy b1 on public.betriebe for select to authenticated using (id in (select meine_betriebe()) or ist_master());
create policy m1 on public.betrieb_mitglieder for select to authenticated using (nutzer_id = auth.uid());
create policy be1 on public.bestellungen for all to authenticated using (betrieb_id in (select meine_betriebe()) or ist_master());
grant select on public.betriebe, public.betrieb_mitglieder, public.bestellungen to authenticated;
grant update, insert, delete on public.bestellungen to authenticated;

-- Stand der beiden Bestellfunktionen: Signatur wie live (migration-lieferung.sql, Tischsitzung), Rumpf nur das Nötige.
create function public.bestellung_aufgeben(p_betrieb_id uuid, p_quelle text, p_tisch text default null, p_summe numeric default 0,
  p_notiz text default null, p_positionen jsonb default '[]', p_gast_kennung text default null, p_tisch_schluessel text default null,
  p_sitzung text default null, p_geraet text default null, p_rabattcode text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  insert into public.bestellungen(betrieb_id, quelle, summe, gast_kennung, rabatt_betrag)
  values (p_betrieb_id, p_quelle, p_summe, p_gast_kennung, case when p_rabattcode = 'MINUS2' then 2 end) returning id into v;
  return v;
end $$;
create function public.bestellung_liefern(p_betrieb_id uuid, p_adresse jsonb, p_positionen jsonb, p_summe numeric,
  p_notiz text default null, p_gast_kennung text default null, p_geraet text default null, p_rabattcode text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if p_summe < 1 then return jsonb_build_object('ok', false, 'grund', 'mindestwert'); end if;
  insert into public.bestellungen(betrieb_id, quelle, summe, liefergebuehr, gast_kennung)
  values (p_betrieb_id, 'lieferung', p_summe, 2.50, p_gast_kennung) returning id into v;
  return jsonb_build_object('ok', true, 'id', v);
end $$;
grant execute on function public.bestellung_aufgeben(uuid,text,text,numeric,text,jsonb,text,text,text,text,text) to anon, authenticated;
grant execute on function public.bestellung_liefern(uuid,jsonb,jsonb,numeric,text,text,text,text) to anon, authenticated;

-- Bestand
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-00000000000a','wirt@choco.de'),
 ('00000000-0000-0000-0000-00000000000b','wirt@blend.de'),
 ('00000000-0000-0000-0000-00000000000c','koch@choco.de');
insert into public.betriebe(id,name,slug) values
 ('10000000-0000-0000-0000-000000000001','Choco','chocolamour'),
 ('10000000-0000-0000-0000-000000000002','Blend','blend');
insert into public.betrieb_mitglieder(betrieb_id,nutzer_id,rolle) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','inhaber'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000b','inhaber'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','team');
