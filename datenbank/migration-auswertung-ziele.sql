-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET 2026-09-25 (Supabase, Migration „auswertung_ziele“) ·
--  betriebe.ziele — Umsatzziele für die Auswertung im Board
--
--  Vorher lokal gegen Postgres 16 geprobt, danach live in einer
--  zurückgedrehten Transaktion: datenbank/pruef-rechte.sql TEIL 6
--  (Nr. 90–97), jede Probe mit Gegenbeweis rot gesehen.
--
--  Form: {"tag": Zahl, "woche": Zahl, "monat": Zahl}, jeder Schlüssel
--  optional, Beträge in Euro, > 0 und ≤ 1 000 000. Das Board prüft
--  dieselben Grenzen (awZielPruefen) und rundet auf Cent.
--
--  WER DARF WAS (CLAUDE.md §2.3a):
--    · anon: NICHTS. betriebe ist für den Hub spaltenweise lesbar
--      (tisch_pflicht, liefer, hub_* …). Ein Umsatzziel ist eine
--      Geschäftszahl und gehört nicht in jeden Hub. Weil anon nur
--      Spaltenrechte hat, bekommt eine NEUE Spalte von selbst keines —
--      hier trotzdem ausdrücklich entzogen, damit das hält, falls
--      jemand später auf Tabellenrecht umstellt.
--    · authenticated: lesen und ändern. WELCHE Zeile, entscheidet die
--      bestehende RLS auf betriebe (Mitglied oder Master) — hier keine
--      neue Regel.
--
--  REIHENFOLGE (§2.5): Das Board fragt die Spalte in einer EIGENEN
--  Abfrage (awZielLaden), nicht im großen select von betriebeHolen.
--  Fehlt sie, bleibt das Ziel auf dem Gerät und das Board sagt es —
--  die Migration darf also jederzeit nachgezogen werden.
--
--  Additiv: legt nur an, ändert nichts Bestehendes.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.betriebe
  add column if not exists ziele jsonb;

comment on column public.betriebe.ziele is
  'Umsatzziele fuer die Auswertung im Board, {"tag","woche","monat"} in Euro. '
  'Nur fuer das Team lesbar, nie fuer anon.';

-- Eine CHECK-Schranke darf keine Unterabfrage enthalten („cannot use
-- subquery in check constraint“) — jsonb_each braucht aber eine. Die
-- Prüfung steht deshalb in einer unveränderlichen Funktion; die darf
-- das. search_path fest auf pg_catalog: nichts Fremdes erreichbar.
create or replace function public.betriebe_ziele_gueltig(z jsonb)
returns boolean language sql immutable
set search_path = pg_catalog
as $f$
  select z is null or (
    jsonb_typeof(z) = 'object'
    and pg_column_size(z) < 500
    and not exists (
      select 1 from jsonb_each(z) e
      where e.key not in ('tag','woche','monat')
         or jsonb_typeof(e.value) <> 'number'
         or (e.value #>> '{}')::numeric <= 0
         or (e.value #>> '{}')::numeric > 1000000))
$f$;
-- EXECUTE bleibt für authenticated. VORFALL, im lokalen Postgres 16
-- gemessen, bevor es live ging: Die erste Fassung entzog das Recht
-- (Gedanke: kein rpc-Endpunkt, §2.3a). Eine CHECK-Schranke ruft ihre
-- Funktion aber mit den Rechten dessen, der die ZEILE ändert — danach
-- scheiterte JEDE Änderung an betriebe durch das Team mit „permission
-- denied for function“, auch nur der Name. Liefer-, Hub- und Banner-
-- Einstellungen wären live gesperrt gewesen. Die Funktion prüft nur
-- eine übergebene Form und liest keine Tabelle; als rpc ist sie harmlos.
-- anon darf betriebe nicht ändern und braucht sie deshalb nicht.
revoke execute on function public.betriebe_ziele_gueltig(jsonb) from public, anon;
grant  execute on function public.betriebe_ziele_gueltig(jsonb) to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'betriebe_ziele_form') then
    alter table public.betriebe
      add constraint betriebe_ziele_form check (public.betriebe_ziele_gueltig(ziele));
  end if;
end $$;

revoke select (ziele), update (ziele) on public.betriebe from anon;
grant  select (ziele), update (ziele) on public.betriebe to authenticated;

commit;

-- ── Probe (zurückgedreht, §2.2 / §2.3b): ohne returning, Zeilen zählen ──
-- begin;
-- create temp table probe(schritt text, ergebnis text);
-- grant all on probe to anon, authenticated;
-- do $$ begin
--   begin update betriebe set ziele = '{"tag":-5}' where id = (select id from betriebe limit 1);
--     insert into probe values ('negatives Ziel', 'OFFEN !!!');
--   exception when check_violation then insert into probe values ('negatives Ziel', 'abgewiesen'); end;
--   begin update betriebe set ziele = '{"jahr":5}' where id = (select id from betriebe limit 1);
--     insert into probe values ('fremder Schluessel', 'OFFEN !!!');
--   exception when check_violation then insert into probe values ('fremder Schluessel', 'abgewiesen'); end;
-- end $$;
-- set local role anon;
-- do $$ begin
--   begin perform ziele from betriebe limit 1; insert into probe values ('anon liest Ziele', 'OFFEN !!!');
--   exception when others then insert into probe values ('anon liest Ziele', 'abgewiesen'); end;
-- end $$;
-- reset role;
-- select * from probe;
-- rollback;
