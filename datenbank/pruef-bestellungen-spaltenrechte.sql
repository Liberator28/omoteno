-- ═══════════════════════════════════════════════════════════════════
--  Probe zu migration-bestellungen-spaltenrechte.sql. Dreht sich selbst zurück.
--  Lokal: pruefungen/pruef-bestellungen-spaltenrechte-lokal.sh (Modell + Migration).
--
--  Gemessen wird (CLAUDE.md §2.3b) die ZEILENZAHL, nie nur die Ausnahme; Schreibtests ohne
--  `returning` (außer der REST-Form des Küchen-Boards, die es selbst benutzt); Voraussetzungen
--  VOR dem Rollenwechsel. Ausgabe: je Zeile "Sxx Beschreibung | true|false" — jedes false ist ein Befund.
--  Im SQL-Editor gegen die Live-Datenbank: den Abschnitt "Bestand" durch echte Konten ersetzen.
-- ═══════════════════════════════════════════════════════════════════
\set QUIET 1
\pset tuples_only on
\pset format unaligned
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set C '00000000-0000-0000-0000-00000000000c'
\set B1 '10000000-0000-0000-0000-000000000001'
\set B2 '10000000-0000-0000-0000-000000000002'
begin;
create temp table st(k text primary key, v text);
grant all on st to public;
create function pg_temp.als(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_uid is null then '{"role":"anon"}'
    else json_build_object('sub',p_uid,'role','authenticated')::text end, true);
end $$;
/* Führt ein UPDATE aus und liefert 'n' (Zeilenzahl) oder die Fehlermeldung. */
create function pg_temp.schreibe(q text) returns text language plpgsql as $$
declare n bigint;
begin execute q; get diagnostics n = row_count; return n::text; exception when others then return sqlerrm; end $$;
grant execute on function pg_temp.als(text), pg_temp.schreibe(text) to public;

insert into public.bestellungen(id, betrieb_id, quelle, status, summe, liefergebuehr, rabatt_betrag, gast_kennung, positionen, tisch)
  values ('20000000-0000-0000-0000-000000000001', :'B1', 'tisch', 'neu', 12.50, 0, 0, 'g1', '[{"n":"x"}]', '5'),
         ('20000000-0000-0000-0000-000000000002', :'B2', 'tisch', 'neu', 7.00, 0, 0, 'g2', '[]', '9');
\set O1 '20000000-0000-0000-0000-000000000001'
\set O2 '20000000-0000-0000-0000-000000000002'

-- ── S0x Zustand der Rechte (als Eigentümer) ──────────────────────────
select 'S01 authenticated hat KEIN Tabellenrecht UPDATE mehr | ' || not has_table_privilege('authenticated', 'public.bestellungen', 'UPDATE');
select 'S02 …und UPDATE genau auf den neun Spalten der Wegeliste | ' || (
  (select string_agg(column_name, ',' order by column_name) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'bestellungen' and grantee = 'authenticated' and privilege_type = 'UPDATE')
  = 'bestaetigt_um,gebracht_um,kueche_fertig_um,pruef_grund,pruefen,status,theke_fertig_um,wartezeit_min,zugewiesen');
select 'S03 anon hat weder Tabellen- noch Spaltenrecht UPDATE | ' || (not has_table_privilege('anon', 'public.bestellungen', 'UPDATE') and not exists (
  select 1 from information_schema.column_privileges where table_name = 'bestellungen' and grantee = 'anon' and privilege_type = 'UPDATE'));
select 'S04 SELECT bleibt (Realtime, Filter, returning der Küche) | ' || has_table_privilege('authenticated', 'public.bestellungen', 'SELECT');

-- ── S1x Erlaubte Spalten schreiben (Zeilenzahl 1) ────────────────────
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'e1', pg_temp.schreibe($q$update bestellungen set status = 'arbeit', wartezeit_min = 15, bestaetigt_um = now() where id = '20000000-0000-0000-0000-000000000001'$q$);
insert into st select 'e2', pg_temp.schreibe($q$update bestellungen set kueche_fertig_um = now(), theke_fertig_um = now() where id = '20000000-0000-0000-0000-000000000001'$q$);
insert into st select 'e3', pg_temp.schreibe($q$update bestellungen set gebracht_um = now() where id = '20000000-0000-0000-0000-000000000001'$q$);
insert into st select 'e4', pg_temp.schreibe($q$update bestellungen set zugewiesen = 7 where id = '20000000-0000-0000-0000-000000000001'$q$);
-- die REST-Form der Küche: Filter auf status, Antwort mit returning (einmal auf eine offene Zeile ...)
insert into st select 'e6', pg_temp.schreibe($q$update bestellungen set status = 'fertig' where id = '20000000-0000-0000-0000-000000000001' and (status is null or status not in ('storniert','abgelehnt')) returning id$q$);
insert into st select 'e5', pg_temp.schreibe($q$update bestellungen set pruefen = false, pruef_grund = null, status = 'abgelehnt' where id = '20000000-0000-0000-0000-000000000001'$q$);
-- ... einmal auf eine abgelehnte: der Filter hält, 0 Zeilen, keine Ausnahme
insert into st select 'e7', pg_temp.schreibe($q$update bestellungen set status = 'arbeit' where id = '20000000-0000-0000-0000-000000000001' and (status is null or status not in ('storniert','abgelehnt')) returning id$q$);
reset role;
select 'S10 Status + Zusage (Karte weiterschieben, Küche „Zeit“) → 1 Zeile | ' || ((select v from st where k = 'e1') = '1');
select 'S11 Abholbereit je Spur → 1 Zeile | ' || ((select v from st where k = 'e2') = '1');
select 'S12 „Gebracht“ → 1 Zeile | ' || ((select v from st where k = 'e3') = '1');
select 'S13 Team-Modus (zugewiesen) → 1 Zeile | ' || ((select v from st where k = 'e4') = '1');
select 'S14 Markierte Bestellung verwerfen (pruefen, pruef_grund, status) → 1 Zeile | ' || ((select v from st where k = 'e5') = '1');
select 'S15 REST-Form der Küche (Filter auf status, returning id) trifft eine offene Zeile: 1 Zeile | ' || ((select v from st where k = 'e6') = '1');
select 'S15b …und eine abgelehnte NICHT (0 Zeilen, keine Ausnahme — der Endstand hält) | ' || ((select v from st where k = 'e7') = '0');
select 'S16 die Werte sind wirklich angekommen (Zeilen gelesen, nicht Ausnahme gezählt) | ' || exists (
  select 1 from bestellungen where id = :'O1' and status = 'abgelehnt' and wartezeit_min = 15 and zugewiesen = 7 and gebracht_um is not null and kueche_fertig_um is not null);

-- ── S2x Verbotene Spalten: permission denied UND Wert unverändert ────
create temp table verboten(spalte text, sql_wert text);
grant all on verboten to public;
insert into verboten values ('summe', '0'), ('positionen', $$'[]'$$), ('rabatt_betrag', '99'), ('liefergebuehr', '99'), ('betrieb_id', quote_literal('10000000-0000-0000-0000-000000000002')),
  ('quelle', $$'telefon'$$), ('gast_kennung', $$'fremd'$$), ('tisch', $$'1'$$), ('tisch_bestaetigt', 'true'), ('zeitpunkt', $$now() + interval '1 day'$$);
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'v_' || spalte, pg_temp.schreibe(format('update bestellungen set %I = %s where id = %L', spalte, sql_wert, '20000000-0000-0000-0000-000000000001')) from verboten;
reset role;
select 'S20 jede der zehn verbotenen Spalten → permission denied | ' || (select bool_and(v ~ 'permission denied') from st where k like 'v\_%');
select 'S21 …und KEINE hat sich geändert (summe 12,50 · Betrieb 1 · Quelle tisch · Tisch 5 · Kennung g1) | ' || exists (
  select 1 from bestellungen where id = :'O1' and summe = 12.50 and rabatt_betrag = 0 and liefergebuehr = 0 and betrieb_id = :'B1' and quelle = 'tisch'
     and gast_kennung = 'g1' and tisch = '5' and tisch_bestaetigt = false and positionen = '[{"n":"x"}]'::jsonb);
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'g1', pg_temp.schreibe($q$update bestellungen set status = 'neu', summe = 0 where id = '20000000-0000-0000-0000-000000000001'$q$);
reset role;
select 'S22 gemischt (erlaubte + verbotene Spalte in EINEM Satz) wird ganz abgewiesen | ' || ((select v from st where k = 'g1') ~ 'permission denied'
  and exists (select 1 from bestellungen where id = :'O1' and status = 'abgelehnt' and summe = 12.50));

-- ── S3x Fremder Betrieb und Konten ───────────────────────────────────
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'f1', pg_temp.schreibe($q$update bestellungen set status = 'arbeit' where id = '20000000-0000-0000-0000-000000000002'$q$);
reset role;
select 'S30 erlaubte Spalte an der Bestellung eines FREMDEN Betriebs → 0 Zeilen (RLS hält weiter) | ' || ((select v from st where k = 'f1') = '0'
  and exists (select 1 from bestellungen where id = :'O2' and status = 'neu'));
set local role authenticated; select pg_temp.als(:'C');       -- Teammitglied von Betrieb 1
insert into st select 'm1', pg_temp.schreibe($q$update bestellungen set status = 'arbeit' where id = '20000000-0000-0000-0000-000000000001'$q$);
insert into st select 'm2', pg_temp.schreibe($q$update bestellungen set summe = 0.01 where id = '20000000-0000-0000-0000-000000000001'$q$);
reset role;
select 'S31 Teammitglied: Status ja (1 Zeile), Summe nein (permission denied, Wert bleibt 12,50) | ' || ((select v from st where k = 'm1') = '1'
  and (select v from st where k = 'm2') ~ 'permission denied' and exists (select 1 from bestellungen where id = :'O1' and summe = 12.50));
set local role anon; select pg_temp.als(null);
insert into st select 'a1', pg_temp.schreibe($q$update bestellungen set status = 'arbeit' where id = '20000000-0000-0000-0000-000000000001'$q$);
reset role;
select 'S32 anon: nicht einmal der Status | ' || ((select v from st where k = 'a1') ~ 'permission denied');

-- ── S4x Was NICHT betroffen sein darf ────────────────────────────────
set local role authenticated; select pg_temp.als(:'A');
select pg_temp.schreibe($q$select probe_definer_summe('20000000-0000-0000-0000-000000000001', 99.99)$q$);
reset role;
select 'S40 eine security-definer-Funktion ändert weiter die Summe (so arbeiten Storno, Rabatt, Zahlung) | ' ||
  exists (select 1 from bestellungen where id = :'O1' and summe = 99.99);
set local role authenticated; select pg_temp.als(:'A');
insert into st select 't1', pg_temp.schreibe($q$update bestellungen set wartezeit_min = 20 where id = '20000000-0000-0000-0000-000000000001'$q$);
reset role;
select 'S41 ein Trigger des Aufrufers, der eine ANDERE Spalte setzt (geaendert), braucht dafür kein Spaltenrecht | ' ||
  ((select v from st where k = 't1') = '1' and (select geaendert is not null from bestellungen where id = :'O1'));

-- ── S5x Rückgängig ───────────────────────────────────────────────────
grant update on public.bestellungen to authenticated;
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'r1', pg_temp.schreibe($q$update bestellungen set summe = 1 where id = '20000000-0000-0000-0000-000000000001'$q$);
reset role;
select 'S50 „grant update on public.bestellungen to authenticated“ stellt den alten Zustand her (Summe wieder änderbar) | ' || ((select v from st where k = 'r1') = '1');

rollback;
