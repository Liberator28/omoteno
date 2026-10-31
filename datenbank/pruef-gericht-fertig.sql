-- ═════════════════════════════════════════════════════════════════
--  Probe zu migration-gericht-fertig.sql. Dreht sich selbst zurück.
--  Lokal: pruefungen/pruef-gericht-fertig-lokal.sh (Modell + Spaltenrechte + Migration).
--
--  Gemessen wird (CLAUDE.md §2.3b) der ZUSTAND der Zeile nach dem Aufruf, nie nur die Antwort; eine
--  Absage kommt als Antwort, nie als Ausnahme (§2.3g); Voraussetzungen VOR dem Rollenwechsel (§2.3b).
--  Ausgabe: je Zeile "Sxx Beschreibung | true|false" — jedes false ist ein Befund.
-- ═════════════════════════════════════════════════════════════════
\set QUIET 1
\pset tuples_only on
\pset format unaligned
\set A '00000000-0000-0000-0000-00000000000e'
\set B '00000000-0000-0000-0000-00000000000b'
\set C '00000000-0000-0000-0000-00000000000f'
\set M '00000000-0000-0000-0000-00000000000d'
\set B1 '10000000-0000-0000-0000-000000000001'
\set B2 '10000000-0000-0000-0000-000000000002'
\set O1 '20000000-0000-0000-0000-000000000001'
\set O2 '20000000-0000-0000-0000-000000000002'
\set O3 '20000000-0000-0000-0000-000000000003'
begin;
create temp table st(k text primary key, v text);
grant all on st to public;
create function pg_temp.als(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_uid is null then '{"role":"authenticated"}'
    else json_build_object('sub',p_uid,'role','authenticated')::text end, true);
end $$;
/* Führt eine Anweisung aus und liefert die Zeilenzahl oder die Fehlermeldung. */
create function pg_temp.schreibe(q text) returns text language plpgsql as $$
declare n bigint;
begin execute q; get diagnostics n = row_count; return n::text; exception when others then return sqlerrm; end $$;
grant execute on function pg_temp.als(text), pg_temp.schreibe(text) to public;

-- Bestand: das Modell (modell-lokal-zahlung.sql) kennt B1 und B2 und ein Mitglied in B2 (B).
-- Dazu: A = Rolle „kueche“ in B1, C = Mitglied von niemandem, M = Master.
insert into public.betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (:'B1', :'A', 'kueche');
insert into public.master_konten(benutzer_id, email) values (:'M', 'm@example.org');
insert into public.bestellungen(id, betrieb_id, quelle, status, summe, positionen, tisch)
  values (:'O1', :'B1', 'tisch', 'arbeit', 30, '[{"name":"Suppe"},{"name":"Pizza"},{"name":"Tiramisu"}]', '5'),
         (:'O2', :'B1', 'tisch', 'storniert', 9, '[{"name":"Suppe"}]', '6'),
         (:'O3', :'B2', 'tisch', 'arbeit', 9, '[{"name":"Salat"}]', '1');

-- ── S0x Zustand der Rechte und Funktionen (als Eigentümer) ───────────
select 'S01 Spalte da, Vorgabe {} und nicht NULL | ' || (
  select data_type = 'jsonb' and is_nullable = 'NO' and column_default like '%{}%' from information_schema.columns
   where table_schema = 'public' and table_name = 'bestellungen' and column_name = 'positionen_fertig');
select 'S02 authenticated darf die Spalte NICHT direkt ändern (kein Spaltenrecht) | ' || not exists (
  select 1 from information_schema.column_privileges where table_schema = 'public' and table_name = 'bestellungen'
     and column_name = 'positionen_fertig' and grantee = 'authenticated' and privilege_type = 'UPDATE');
select 'S03 genau eine Fassung je Funktion (§2.1) | ' || (
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'gericht_fertig_setzen') = 1 and
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'gerichte_gebracht_setzen') = 1);
select 'S04 anon darf keine der beiden Funktionen rufen | ' || (
  not has_function_privilege('anon', 'public.gericht_fertig_setzen(uuid,integer[],boolean)', 'EXECUTE') and
  not has_function_privilege('anon', 'public.gerichte_gebracht_setzen(uuid,integer[])', 'EXECUTE'));
select 'S05 authenticated darf beide rufen | ' || (
  has_function_privilege('authenticated', 'public.gericht_fertig_setzen(uuid,integer[],boolean)', 'EXECUTE') and
  has_function_privilege('authenticated', 'public.gerichte_gebracht_setzen(uuid,integer[])', 'EXECUTE'));
select 'S06 beide Funktionen sind security definer mit festem search_path | ' || (
  select bool_and(prosecdef and proconfig is not null and exists (select 1 from unnest(proconfig) c where c like 'search_path=%'))
    from pg_proc where pronamespace = 'public'::regnamespace and proname in ('gericht_fertig_setzen', 'gerichte_gebracht_setzen'));

-- ── S1x Koch meldet fertig ───────────────────────────────────────────
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'k1', public.gericht_fertig_setzen(:'O1', array[0])::text;
reset role;
insert into st select 'zeit0', positionen_fertig -> '0' ->> 'f' from public.bestellungen where id = :'O1';
select 'S10 Koch (Rolle kueche, eigener Betrieb) meldet Position 0 fertig → ok | ' || ((select v::jsonb ->> 'ok' from st where k = 'k1') = 'true');
select 'S11 …und die Zeile trägt den Eintrag mit Zeit (Zustand gelesen, nicht Antwort geglaubt) | ' ||
  coalesce((select (positionen_fertig -> '0' ->> 'f') is not null and not ((positionen_fertig -> '0') ? 'g') and
            (select count(*) from jsonb_object_keys(positionen_fertig)) = 1 from public.bestellungen where id = :'O1'), false);

-- zweiter Durchgang (§1.1a): dieselbe Position nochmal + eine neue; die ERSTE Zeit bleibt
select pg_sleep(0.05);
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'k2', public.gericht_fertig_setzen(:'O1', array[0, 1])::text;
reset role;
select 'S12 zweiter Durchgang: Position 0 behält ihre erste Zeit, Position 1 kommt dazu | ' ||
  coalesce((select positionen_fertig -> '0' ->> 'f' = (select v from st where k = 'zeit0') and (positionen_fertig ? '1')
              from public.bestellungen where id = :'O1'), false);

-- Formfehler: jede Absage als Antwort, die Zeile bleibt
insert into st select 'vor', positionen_fertig::text from public.bestellungen where id = :'O1';
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'p3',   public.gericht_fertig_setzen(:'O1', array[3])::text;
insert into st select 'pneg', public.gericht_fertig_setzen(:'O1', array[-1])::text;
insert into st select 'pleer', public.gericht_fertig_setzen(:'O1', array[]::integer[])::text;
insert into st select 'pnull', public.gericht_fertig_setzen(:'O1', null)::text;
insert into st select 'pnullel', public.gericht_fertig_setzen(:'O1', array[0, null]::integer[])::text;
insert into st select 'p101', public.gericht_fertig_setzen(:'O1', (select array_agg(g) from generate_series(0, 100) g))::text;
insert into st select 'pgemischt', public.gericht_fertig_setzen(:'O1', array[2, 7])::text;
reset role;
select 'S13 Position hinter dem Bon (3 bei 3 Positionen) → position | ' || ((select v::jsonb ->> 'grund' from st where k = 'p3') = 'position');
select 'S14 negative Nummer → position | ' || ((select v::jsonb ->> 'grund' from st where k = 'pneg') = 'position');
select 'S15 leere Liste → form | ' || ((select v::jsonb ->> 'grund' from st where k = 'pleer') = 'form');
select 'S16 NULL → form | ' || ((select v::jsonb ->> 'grund' from st where k = 'pnull') = 'form');
select 'S17 NULL im Feld → position | ' || ((select v::jsonb ->> 'grund' from st where k = 'pnullel') = 'position');
select 'S18 101 Nummern → form | ' || ((select v::jsonb ->> 'grund' from st where k = 'p101') = 'form');
select 'S19 eine gültige UND eine ungültige Nummer: nichts wird geschrieben (Position 2 bleibt offen) | ' ||
  ((select v::jsonb ->> 'grund' from st where k = 'pgemischt') = 'position' and
   (select positionen_fertig::text from public.bestellungen where id = :'O1') = (select v from st where k = 'vor'));

-- ── S2x Wer darf nicht ───────────────────────────────────────────────
set local role authenticated; select pg_temp.als(:'B');
insert into st select 'fremd', public.gericht_fertig_setzen(:'O1', array[2])::text;
insert into st select 'fremdg', public.gerichte_gebracht_setzen(:'O1')::text;
select pg_temp.als(:'C');
insert into st select 'keiner', public.gericht_fertig_setzen(:'O1', array[2])::text;
select pg_temp.als(null);
insert into st select 'ohne', public.gericht_fertig_setzen(:'O1', array[2])::text;
select pg_temp.als(:'A');
insert into st select 'unbekannt', public.gericht_fertig_setzen('99999999-9999-9999-9999-999999999999', array[0])::text;
insert into st select 'storno', public.gericht_fertig_setzen(:'O2', array[0])::text;
insert into st select 'fremdbetrieb', public.gericht_fertig_setzen(:'O3', array[0])::text;
reset role;
select 'S20 Mitglied eines ANDEREN Betriebs → kein_recht, Zeile unverändert | ' ||
  ((select v::jsonb ->> 'grund' from st where k = 'fremd') = 'kein_recht' and
   (select positionen_fertig::text from public.bestellungen where id = :'O1') = (select v from st where k = 'vor'));
select 'S21 …auch für „gebracht“ | ' || ((select v::jsonb ->> 'grund' from st where k = 'fremdg') = 'kein_recht');
select 'S22 angemeldet, aber in keinem Betrieb → kein_recht | ' || ((select v::jsonb ->> 'grund' from st where k = 'keiner') = 'kein_recht');
select 'S23 ohne Anmeldung (keine Nutzerkennung) → nicht_angemeldet | ' || ((select v::jsonb ->> 'grund' from st where k = 'ohne') = 'nicht_angemeldet');
select 'S24 unbekannte Bestellung → unbekannt | ' || ((select v::jsonb ->> 'grund' from st where k = 'unbekannt') = 'unbekannt');
select 'S25 stornierte Bestellung → storniert, nichts geschrieben | ' ||
  ((select v::jsonb ->> 'grund' from st where k = 'storno') = 'storniert' and
   (select positionen_fertig = '{}'::jsonb from public.bestellungen where id = :'O2'));
select 'S26 Betrieb A kann nicht an der Bestellung von Betrieb B schreiben | ' ||
  ((select v::jsonb ->> 'grund' from st where k = 'fremdbetrieb') = 'kein_recht' and
   (select positionen_fertig = '{}'::jsonb from public.bestellungen where id = :'O3'));

-- ── S3x Zurücknehmen und Servieren ───────────────────────────────────
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'zu', public.gericht_fertig_setzen(:'O1', array[1], false)::text;
reset role;
select 'S30 zurücknehmen (vor „gebracht“): Position 1 weg, Position 0 bleibt | ' ||
  coalesce((select not (positionen_fertig ? '1') and (positionen_fertig ? '0') from public.bestellungen where id = :'O1'), false);

set local role authenticated; select pg_temp.als(:'A');
insert into st select 'g1', public.gerichte_gebracht_setzen(:'O1', array[0])::text;
reset role;
insert into st select 'gzeit0', positionen_fertig -> '0' ->> 'g' from public.bestellungen where id = :'O1';
select 'S31 Position 0 gebracht: „g“ gesetzt, gebracht_um bleibt LEER (noch nicht alles) | ' ||
  coalesce((select (positionen_fertig -> '0' ->> 'g') is not null and gebracht_um is null from public.bestellungen where id = :'O1'), false);

set local role authenticated; select pg_temp.als(:'A');
insert into st select 'zu2', public.gericht_fertig_setzen(:'O1', array[0], false)::text;
insert into st select 'g0', public.gerichte_gebracht_setzen(:'O1', array[2])::text;      -- Position 2 war nie fertig
reset role;
select 'S32 nach „gebracht“ lässt sich „fertig“ nicht mehr zurücknehmen | ' ||
  coalesce((select (positionen_fertig -> '0') ? 'g' from public.bestellungen where id = :'O1'), false);
select 'S33 „gebracht“ für ein Gericht, das nie fertig war: ok, aber nichts gesetzt | ' ||
  ((select v::jsonb ->> 'ok' from st where k = 'g0') = 'true' and (select (v::jsonb ->> 'gebracht')::int from st where k = 'g0') = 0 and
   (select not (positionen_fertig ? '2') from public.bestellungen where id = :'O1'));

set local role authenticated; select pg_temp.als(:'A');
insert into st select 'f12', public.gericht_fertig_setzen(:'O1', array[1, 2])::text;
insert into st select 'gall', public.gerichte_gebracht_setzen(:'O1')::text;                -- NULL = alle fertigen
insert into st select 'gnochmal', public.gerichte_gebracht_setzen(:'O1')::text;
reset role;
select 'S34 „alle fertigen“ gebracht: jetzt hat JEDE Position g, gebracht_um ist gesetzt | ' ||
  coalesce((select (select bool_and(e.value ? 'g') from jsonb_each(positionen_fertig) e) and
                   (select count(*) from jsonb_object_keys(positionen_fertig)) = 3 and gebracht_um is not null
              from public.bestellungen where id = :'O1'), false);
select 'S35 zweiter Durchgang: nichts mehr zu bringen (0), erste „g“-Zeit unverändert | ' ||
  ((select (v::jsonb ->> 'gebracht')::int from st where k = 'gnochmal') = 0 and
   (select positionen_fertig -> '0' ->> 'g' from public.bestellungen where id = :'O1') = (select v from st where k = 'gzeit0'));

-- ── S4x Der alte Weg und die Schranken ───────────────────────────────
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'direkt', pg_temp.schreibe($q$update public.bestellungen set positionen_fertig = '{"0":{"f":"x"}}' where id = '20000000-0000-0000-0000-000000000003'$q$);
insert into st select 'direktA', pg_temp.schreibe($q$update public.bestellungen set positionen_fertig = '{"0":{"f":"x"}}' where id = '20000000-0000-0000-0000-000000000001'$q$);
insert into st select 'gebracht_alt', pg_temp.schreibe($q$update public.bestellungen set gebracht_um = now() where id = '20000000-0000-0000-0000-000000000001'$q$);
reset role;
select 'S40 direktes UPDATE der Spalte als Mitglied → permission denied (auch im EIGENEN Betrieb) | ' ||
  ((select v from st where k = 'direktA') ilike '%permission denied%' and (select v from st where k = 'direkt') ilike '%permission denied%');
select 'S41 der alte Weg bleibt: „Gebracht“ über das Spaltenrecht → 1 Zeile | ' || ((select v from st where k = 'gebracht_alt') = '1');
select 'S42 Schranke: ein Array statt Objekt wird abgewiesen | ' ||
  (pg_temp.schreibe($q$update public.bestellungen set positionen_fertig = '[]' where id = '20000000-0000-0000-0000-000000000001'$q$) ilike '%positionen_fertig_form%');
select 'S43 Schranke: mehr als 8000 Byte werden abgewiesen | ' ||
  (pg_temp.schreibe($q$update public.bestellungen set positionen_fertig = jsonb_build_object('x', repeat('y', 9000)) where id = '20000000-0000-0000-0000-000000000001'$q$) ilike '%positionen_fertig_form%');

-- ── S5x Master ───────────────────────────────────────────────────────
set local role authenticated; select pg_temp.als(:'M');
insert into st select 'master', public.gericht_fertig_setzen(:'O3', array[0])::text;
reset role;
select 'S50 Master darf an jedem Betrieb | ' || ((select v::jsonb ->> 'ok' from st where k = 'master') = 'true' and
  (select positionen_fertig ? '0' from public.bestellungen where id = :'O3'));

-- Ehrliche Grenze: echte Gleichzeitigkeit (zwei Köche im selben Augenblick) lässt sich in EINER Transaktion nicht
-- nachstellen. Belegt ist nur, dass die Funktion die Zeile sperrt (for update) und ERGÄNZT statt zu überschreiben (S12).
rollback;
