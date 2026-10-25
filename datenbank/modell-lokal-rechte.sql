-- Nachbau der Teile des Bestands, die der Finanzbereich nicht aus den Migrationsdateien bekommt. Tabellen, Sichten,
-- Funktionen und Lese-Regeln der Einkaufsseite kommen NICHT von hier, sondern wörtlich aus den Migrationen
-- (pruefungen/pruef-zugriffsrechte-lokal.sh) — sonst prüfte die Probe eine Erfindung (§8.1i). Läuft nach
-- modell-lokal-zahlung.sql (Betriebe, Mitglieder, PIN, Bestellungen).
create table public.gerichte(id uuid primary key default gen_random_uuid(), betrieb_id uuid not null, name text not null,
  preis numeric, kategorie text, karte text, kat_sort int, reihenfolge int);
create table public.aktionen(id bigint generated always as identity primary key, betrieb_id uuid, gericht_name text,
  preis_neu numeric, aktiv boolean default true, von timestamptz default now(), bis timestamptz default now() + interval '1 day');
alter table public.bestellungen add column if not exists positionen jsonb;
alter table public.betrieb_mitglieder add column if not exists darf_lager boolean not null default false;
alter table public.betrieb_mitglieder add column if not exists darf_gutscheine boolean not null default false;
alter table public.betrieb_mitglieder add constraint betrieb_mitglieder_rolle_check check (rolle in ('inhaber','team','kueche'));
alter table public.betrieb_mitglieder add constraint betrieb_mitglieder_pk unique (betrieb_id, nutzer_id);
create schema if not exists storage;
grant usage on schema storage to authenticated;
