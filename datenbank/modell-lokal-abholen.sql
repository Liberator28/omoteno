-- Kleinstes Modell, in dem die ECHTEN Funktionen bestellung_aufgeben (migration-gutschein-sicher.sql) und
-- bestellung_abholen (migration-abholen.sql) und bestellung_liefern (migration-aktionspreis-pruefen.sql) laufen. Nachgestellt ist nur, was sie lesen: Tabellen mit den
-- Spalten, die im Körper vorkommen, und die Schutz-Helfer als Stummel (kein Zähler, keine Herkunft). Die Frage,
-- die damit gemessen wird (greift die Tischpflicht vor oder nach der Quelle?), steht VOR allen Stummeln im Körper.
create schema if not exists extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create table public.betriebe(id uuid primary key default gen_random_uuid(), slug text, bestell_pause boolean not null default false,
  bestell_pause_text text, tisch_pflicht boolean not null default false, zustand text not null default 'aktiv', test_bis timestamptz, liefer jsonb);
create table public.tische(id uuid primary key default gen_random_uuid(), betrieb_id uuid, nummer text, aktiv boolean default true, schluessel text);
create table public.tisch_sitzungen(id uuid primary key default gen_random_uuid(), token text, betrieb_id uuid, tisch_id uuid,
  gueltig_bis timestamptz, letzte_aktivitaet timestamptz);
create table public.rabattcodes(id uuid primary key default gen_random_uuid(), betrieb_id uuid, code text, betrag numeric, prozent numeric,
  eingeloest boolean default false, gueltig_bis timestamptz, ziel_gericht_name text, eingeloest_bestellung_id uuid, eingeloest_am timestamptz);
create table public.bestellungen(id uuid primary key default gen_random_uuid(), betrieb_id uuid, quelle text, status text, tisch text,
  summe numeric, summe_gast numeric, notiz text, positionen jsonb, gast_kennung text, tagesnummer smallint, tisch_bestaetigt boolean,
  geraet text, pruefen boolean, pruef_grund text, zeitpunkt timestamptz default now(), rabatt_betrag numeric, rabatt_code text,
  rabatt_ziel text, abholung boolean default false, liefergebuehr numeric, gast_name text, gast_telefon text, wunschzeit timestamptz, liefer_adresse jsonb);
create function public.positionen_pruefen(p_betrieb uuid, p jsonb) returns jsonb language sql as
 $$ select '{"positionen":[{"name":"Probe","menge":1,"preis":10}],"summe":10,"waren":10,"unbekannt":0}'::jsonb $$;
create function public.schutz_herkunft() returns text language sql as $$ select null::text $$;
create function public.schutz_stand(text) returns integer language sql as $$ select 0 $$;
create function public.schutz_zaehlen(text) returns void language sql as $$ select $$;
create function public.rabatt_basis(jsonb, text, numeric) returns numeric language sql as $$ select $3 $$;
