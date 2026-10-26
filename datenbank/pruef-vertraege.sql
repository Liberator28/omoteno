-- ═══════════════════════════════════════════════════════════════════
--  Probe zu migration-vertraege.sql. Dreht sich selbst zurück.
--  Lokal: pruefungen/pruef-vertraege-lokal.sh (Modell + Migration).
--  Gemessen wird die ZEILENZAHL, nie nur die Ausnahme (§2.3b); Voraussetzungen
--  VOR dem Rollenwechsel; der zweite Durchgang gehört dazu (§1.1a).
--  Ausgabe: je Zeile "Vxx Beschreibung | true|false" — jedes false ist ein Befund.
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
create function pg_temp.fehler(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
grant execute on function pg_temp.als(text), pg_temp.fehler(text) to public;

-- ── V0x Rechte und Signatur (als Eigentümer) ──
select 'V01 anon hat KEIN Recht auf vertrag_annahmen | ' || not exists (
  select 1 from (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(recht)
   where has_table_privilege('anon', 'public.vertrag_annahmen', p.recht));
select 'V02 authenticated darf NUR lesen (kein INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) | ' || (
  has_table_privilege('authenticated', 'public.vertrag_annahmen', 'SELECT') and not exists (
  select 1 from (values ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(recht)
   where has_table_privilege('authenticated', 'public.vertrag_annahmen', p.recht)));
select 'V03 genau EINE Fassung von vertrag_annehmen (§2.1), anon ohne EXECUTE, authenticated mit | ' || (
  select count(*) = 1 and not bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) and bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'vertrag_annehmen');
select 'V04 Zeilenregel (RLS) ist an | ' || (select relrowsecurity from pg_class where oid = 'public.vertrag_annahmen'::regclass);

-- ── V1x Inhaber nimmt an ──
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'a1', vertrag_annehmen(:'B1'::uuid, '2026-10-26', true, true)::text;
reset role;
select 'V10 Inhaber nimmt an: ok und genau zwei Zeilen (agb, avv) mit Nutzer und Fassung | ' || (
  (select v::jsonb->>'ok' from st where k = 'a1') = 'true'
  and (select count(*) from vertrag_annahmen where betrieb_id = :'B1') = 2
  and (select count(*) from vertrag_annahmen where betrieb_id = :'B1' and nutzer_id = :'A'::uuid and fassung = '2026-10-26') = 2
  and (select count(distinct art) from vertrag_annahmen where betrieb_id = :'B1') = 2);
-- zweiter Durchgang: dieselbe Fassung noch einmal — kein Fehler, keine doppelten Zeilen
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'a2', vertrag_annehmen(:'B1'::uuid, '2026-10-26', true, true)::text;
reset role;
select 'V11 zweiter Durchgang mit derselben Fassung: ok, weiterhin zwei Zeilen | ' || (
  (select v::jsonb->>'ok' from st where k = 'a2') = 'true' and (select count(*) from vertrag_annahmen where betrieb_id = :'B1') = 2);
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'a3', vertrag_annehmen(:'B1'::uuid, '2026-12-01', true, true)::text;
reset role;
select 'V12 neue Fassung kommt dazu (vier Zeilen), die alte bleibt | ' || (
  (select count(*) from vertrag_annahmen where betrieb_id = :'B1') = 4
  and (select count(*) from vertrag_annahmen where betrieb_id = :'B1' and fassung = '2026-10-26') = 2);

-- ── V2x Abweisungen: Grund als Antwort, keine neue Zeile ──
set local role authenticated; select pg_temp.als(:'C');
insert into st select 'c1', vertrag_annehmen(:'B1'::uuid, '2026-10-26', true, true)::text;
select pg_temp.als(:'B');
insert into st select 'b1', vertrag_annehmen(:'B1'::uuid, '2026-10-26', true, true)::text;
insert into st select 'b2', vertrag_annehmen(:'B2'::uuid, '2026-10-26', true, false)::text;
insert into st select 'b3', vertrag_annehmen(:'B2'::uuid, '2026-10-26', false, true)::text;
insert into st select 'b4', vertrag_annehmen(:'B2'::uuid, '2026-10-26"; drop', true, true)::text;
insert into st select 'b5', vertrag_annehmen(:'B2'::uuid, null, true, true)::text;
insert into st select 'b6', vertrag_annehmen(null, '2026-10-26', true, true)::text;
reset role;
select 'V20 Team (nicht Inhaber): kein_inhaber, keine Zeile für Betrieb 2 | ' || (
  (select v::jsonb->>'grund' from st where k = 'c1') = 'kein_inhaber'
  and (select count(*) from vertrag_annahmen where betrieb_id = :'B2') = 0);
select 'V21 fremder Inhaber für den falschen Betrieb: kein_inhaber, Betrieb 1 behält seine vier Zeilen | ' || (
  (select v::jsonb->>'grund' from st where k = 'b1') = 'kein_inhaber'
  and (select count(*) from vertrag_annahmen where betrieb_id = :'B1') = 4);
select 'V22 nur eines der beiden Häkchen: nicht_beide (beide Richtungen), keine Zeile | ' || (
  (select v::jsonb->>'grund' from st where k = 'b2') = 'nicht_beide'
  and (select v::jsonb->>'grund' from st where k = 'b3') = 'nicht_beide'
  and (select count(*) from vertrag_annahmen where betrieb_id = :'B2') = 0);
select 'V23 Fassung mit Anführungszeichen, null oder Betrieb null: grund fassung, keine Zeile | ' || (
  (select v::jsonb->>'grund' from st where k = 'b4') = 'fassung'
  and (select v::jsonb->>'grund' from st where k = 'b5') = 'fassung'
  and (select v::jsonb->>'grund' from st where k = 'b6') = 'fassung'
  and (select count(*) from vertrag_annahmen where betrieb_id = :'B2') = 0);
-- ohne Anmeldung
set local role authenticated; select pg_temp.als(null);
insert into st select 'n1', vertrag_annehmen(:'B1'::uuid, '2026-10-26', true, true)::text;
reset role;
select 'V24 ohne Anmeldung (auth.uid() leer): anmeldung | ' || ((select v::jsonb->>'grund' from st where k = 'n1') = 'anmeldung');
-- anon: gar nicht rufbar
set local role anon; select pg_temp.als(null);
insert into st select 'an1', pg_temp.fehler($q$select vertrag_annehmen('10000000-0000-0000-0000-000000000001'::uuid, '2026-10-26', true, true)$q$);
reset role;
select 'V25 anon: permission denied, nichts geschrieben | ' || ((select v from st where k = 'an1') ~* 'permission denied' and (select count(*) from vertrag_annahmen) = 4);

-- ── V3x Direktes Schreiben und Lesen (Recht UND Zeilenzahl, §2.3b) ──
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'd1', pg_temp.fehler($q$insert into vertrag_annahmen(betrieb_id,art,fassung,nutzer_id) values ('10000000-0000-0000-0000-000000000001','agb','2030-01-01','00000000-0000-0000-0000-00000000000a')$q$);
insert into st select 'd2', pg_temp.fehler($q$update vertrag_annahmen set fassung = '2031-01-01'$q$);
insert into st select 'd3', pg_temp.fehler($q$delete from vertrag_annahmen$q$);
insert into st select 'l1', (select count(*) from vertrag_annahmen)::text;
select pg_temp.als(:'C');
insert into st select 'l2', (select count(*) from vertrag_annahmen)::text;
select pg_temp.als(:'B');
insert into st select 'l3', (select count(*) from vertrag_annahmen)::text;
reset role;
select 'V30 direkt INSERT/UPDATE/DELETE als Inhaber: permission denied, Bestand unverändert (4 Zeilen) | ' || (
  (select v from st where k = 'd1') ~* 'permission denied' and (select v from st where k = 'd2') ~* 'permission denied'
  and (select v from st where k = 'd3') ~* 'permission denied' and (select count(*) from vertrag_annahmen) = 4);
select 'V31 lesen: Inhaber und Team von Betrieb 1 sehen vier Zeilen, der Inhaber von Betrieb 2 keine | ' || (
  (select v from st where k = 'l1') = '4' and (select v from st where k = 'l2') = '4' and (select v from st where k = 'l3') = '0');

-- ── V4x Schranken der Tabelle selbst ──
select 'V40 CHECK: unbekannte Art und Fassung ohne Datumsform werden abgelehnt | ' ||
  (pg_temp.fehler($q$insert into vertrag_annahmen(betrieb_id,art,fassung,nutzer_id) values ('10000000-0000-0000-0000-000000000001','xyz','2030-01-01','00000000-0000-0000-0000-00000000000a')$q$) ~ 'check'
   and pg_temp.fehler($q$insert into vertrag_annahmen(betrieb_id,art,fassung,nutzer_id) values ('10000000-0000-0000-0000-000000000001','agb','heute','00000000-0000-0000-0000-00000000000a')$q$) ~ 'check');
select 'V41 UNIQUE: dieselbe Zeile zweimal geht nicht | ' ||
  (pg_temp.fehler($q$insert into vertrag_annahmen(betrieb_id,art,fassung,nutzer_id) values ('10000000-0000-0000-0000-000000000001','agb','2026-10-26','00000000-0000-0000-0000-00000000000a')$q$) ~ 'unique|duplicate');
insert into betriebe(id,name,slug) values ('10000000-0000-0000-0000-000000000009','Leer','leer');
insert into vertrag_annahmen(betrieb_id,art,fassung,nutzer_id) values ('10000000-0000-0000-0000-000000000009','agb','2026-10-26','00000000-0000-0000-0000-00000000000a');
select 'V42a Voraussetzung: die Zeile des Leer-Betriebs ist da | ' || ((select count(*) from vertrag_annahmen where betrieb_id = '10000000-0000-0000-0000-000000000009') = 1);
delete from betriebe where id = '10000000-0000-0000-0000-000000000009';
select 'V42 Betrieb löschen nimmt seine Annahmen mit (cascade) | ' || (not exists (select 1 from vertrag_annahmen where betrieb_id = '10000000-0000-0000-0000-000000000009'));

rollback;
