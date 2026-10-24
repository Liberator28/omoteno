-- ═══════════════════════════════════════════════════════════════════
--  Probe zu migration-ki-nutzung.sql. Dreht sich selbst zurück.
--  Lokal: pruefungen/pruef-ki-nutzung-lokal.sh (Modell + Migration).
--  Im SQL-Editor gegen die Live-Datenbank: den Abschnitt "Bestand" unten
--  durch echte Konten ersetzen (A, B Inhaber zweier Betriebe, C Team
--  von Betrieb 1, D Master).
--
--  Gemessen wird (CLAUDE.md §2.3b) die ZEILENZAHL, nie nur die Ausnahme;
--  Schreibtests ohne `returning`; Voraussetzungen VOR dem Rollenwechsel.
--  Ausgabe: je Zeile "Kxx Beschreibung | true|false" — jedes false ist ein Befund.
-- ═══════════════════════════════════════════════════════════════════
\set QUIET 1
\pset tuples_only on
\pset format unaligned
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set C '00000000-0000-0000-0000-00000000000c'
\set D '00000000-0000-0000-0000-00000000000d'
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

-- Bestand: ein Master (D), nicht Mitglied irgendeines Betriebs
insert into auth.users(id,email) values (:'D','master@omoteno.test');
insert into public.master_konten(benutzer_id,email) values (:'D','master@omoteno.test');

-- ── K0x Rechte und Signaturen (als Eigentümer, vor jedem Rollenwechsel) ─
select 'K01 anon/authenticated haben KEIN Recht auf ki_nutzung, ki_preise, ki_budget | ' || not exists (
  select 1 from (values ('anon'),('authenticated')) r(rolle),
                (values ('ki_nutzung'),('ki_preise'),('ki_budget')) t(tab),
                (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(recht)
   where has_table_privilege(r.rolle, 'public.' || t.tab, p.recht));
select 'K02 anon darf keine der fünf Funktionen rufen | ' || not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('ki_nutzung_buchen','ki_budget_stand','master_ki_nutzung','master_ki_budget_setzen','master_ki_preis_setzen')
     and has_function_privilege('anon', p.oid, 'EXECUTE'));
select 'K03 authenticated darf alle fünf rufen (Master-Prüfung steckt in der Funktion) | ' || (
  select count(*) = 5 and bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('ki_nutzung_buchen','ki_budget_stand','master_ki_nutzung','master_ki_budget_setzen','master_ki_preis_setzen'));
select 'K04 von jeder Funktion gibt es genau EINE Fassung (§2.1) | ' || (
  select count(*) = 5 and count(distinct p.proname) = 5
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('ki_nutzung_buchen','ki_budget_stand','master_ki_nutzung','master_ki_budget_setzen','master_ki_preis_setzen'));
select 'K05 die vier Modelle sind eingetragen, alle OHNE Preis | ' || (
  select count(*) = 4 and bool_and(eingabe_eur_je_mio is null and eur_je_bild is null) from ki_preise);

-- ── K1x Buchen: Betrieb kommt aus der Mitgliedschaft, Preis aus dem Server ─
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'b1', ki_nutzung_buchen('uebersetzen', 'claude-opus-5', 1000, 500)::text;
reset role;
select 'K10 Inhaber bucht → gebucht, Preis fehlt noch | ' ||
  ((select v::jsonb from st where k = 'b1') = '{"gebucht": true, "preis_fehlt": true}'::jsonb);
select 'K10b …genau eine Zeile, am EIGENEN Betrieb, ohne Kosten | ' ||
  ((select count(*) from ki_nutzung) = 1 and exists (select 1 from ki_nutzung where betrieb_id = :'B1' and kosten_eur is null
     and tokens_ein = 1000 and tokens_aus = 500 and funktion = 'uebersetzen'));

-- Master trägt den Preis ein (EUR je Mio.): 10 Eingabe, 50 Ausgabe
set local role authenticated; select pg_temp.als(:'D');
insert into st select 'p1', master_ki_preis_setzen('claude-opus-5', 'token', 10, 50, null, null, 'Test')::text;
reset role;
select 'K11 Preis eintragen rechnet die frühere Buchung nach (1 Zeile) | ' ||
  ((select v::jsonb from st where k = 'p1') = '{"ok": true, "nachgerechnet": 1}'::jsonb);
select 'K11b …und sie kostet (1000·10 + 500·50)/1 Mio = 0,035 | ' ||
  ((select kosten_eur from ki_nutzung limit 1) = 0.035);

set local role authenticated; select pg_temp.als(:'A');
insert into st select 'b2', ki_nutzung_buchen('uebersetzen', 'claude-opus-5', 2000, 1000)::text;
reset role;
select 'K12 neue Buchung wird sofort bewertet: 0,07 | ' ||
  ((select v::jsonb from st where k = 'b2') = '{"gebucht": true, "preis_fehlt": false}'::jsonb
   and exists (select 1 from ki_nutzung where tokens_ein = 2000 and kosten_eur = 0.07));

-- fremder Betrieb: p_betrieb zeigt auf Blend, der Aufrufer ist Inhaber von Choco
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'b3', ki_nutzung_buchen('uebersetzen', 'claude-opus-5', 10, 10, 0, 0, :'B2')::text;
reset role;
select 'K13 fremder Betrieb als Ziel → abgewiesen | ' || ((select v::jsonb->>'grund' from st where k = 'b3') = 'kein_betrieb');
select 'K13b …und bei Blend entstand KEINE Zeile (Zeilenzahl, nicht Ausnahme) | ' || ((select count(*) from ki_nutzung where betrieb_id = :'B2') = 0);

set local role authenticated; select pg_temp.als(:'C');
insert into st select 'b4', ki_nutzung_buchen('uebersetzen', 'claude-opus-5', 100, 100)::text;
reset role;
select 'K14 Teammitglied (das die Funktion im Board ruft) bucht auf den EIGENEN Betrieb | ' ||
  (exists (select 1 from ki_nutzung where betrieb_id = :'B1' and tokens_ein = 100));

set local role authenticated; select pg_temp.als(:'D');
insert into st select 'b5', ki_nutzung_buchen('uebersetzen', 'claude-opus-5', 5, 5)::text;
reset role;
select 'K15 Master ohne eigenen Betrieb: nichts zu buchen, keine Ausnahme | ' ||
  ((select v::jsonb->>'grund' from st where k = 'b5') = 'kein_betrieb');

set local role authenticated; select pg_temp.als(:'A');
insert into st select 'f1', ki_nutzung_buchen('stehlen', 'claude-opus-5', 1, 1)::text;
insert into st select 'f2', ki_nutzung_buchen('uebersetzen', 'x"; drop', 1, 1)::text;
insert into st select 'f3', ki_nutzung_buchen('uebersetzen', 'claude-opus-5', 400001, 1)::text;
insert into st select 'f4', ki_nutzung_buchen('uebersetzen', 'claude-opus-5', -1, 1)::text;
insert into st select 'f5', ki_nutzung_buchen('bild_profi_frei', 'fal-ai/birefnet/v2', 0, 0, 0, 5)::text;
insert into st select 'f6', ki_nutzung_buchen(null, 'claude-opus-5', 1, 1)::text;
insert into st select 'f7', ki_nutzung_buchen('uebersetzen', null, 1, 1)::text;
reset role;
select 'K16 unbekannte Funktion → funktion | ' || ((select v::jsonb->>'grund' from st where k = 'f1') = 'funktion');
select 'K16b Anführungszeichen im Modell → modell | ' || ((select v::jsonb->>'grund' from st where k = 'f2') = 'modell');
select 'K16c 400 001 Token / negative Zahl / 5 Bilder → menge | ' ||
  ((select v::jsonb->>'grund' from st where k = 'f3') = 'menge' and (select v::jsonb->>'grund' from st where k = 'f4') = 'menge'
   and (select v::jsonb->>'grund' from st where k = 'f5') = 'menge');
select 'K16d NULL als Funktion / Modell → Grund, keine Ausnahme | ' ||
  ((select v::jsonb->>'grund' from st where k = 'f6') = 'funktion' and (select v::jsonb->>'grund' from st where k = 'f7') = 'modell');
select 'K16e alle abgewiesenen Aufrufe haben nichts hinterlassen (3 Zeilen von K10/K12/K14) | ' || ((select count(*) from ki_nutzung) = 3);

-- anon und direkte Tabellenzugriffe
set local role anon; select pg_temp.als(null);
select 'K17 anon: ki_nutzung_buchen → permission denied | ' ||
  (pg_temp.fehler($q$select ki_nutzung_buchen('uebersetzen','claude-opus-5',1,1)$q$) ~ 'permission denied');
select 'K17b anon: ki_budget_stand → permission denied | ' || (pg_temp.fehler($q$select ki_budget_stand()$q$) ~ 'permission denied');
reset role;
set local role authenticated; select pg_temp.als(:'A');
select 'K18 Inhaber: kein direktes INSERT in ki_nutzung | ' ||
  (pg_temp.fehler($q$insert into ki_nutzung(betrieb_id,funktion,modell) values ('10000000-0000-0000-0000-000000000001','uebersetzen','x')$q$) ~ 'permission denied');
select 'K18b Inhaber: kein Lesen von ki_nutzung / ki_preise / ki_budget | ' ||
  (pg_temp.fehler($q$select * from ki_nutzung$q$) ~ 'permission denied' and pg_temp.fehler($q$select * from ki_preise$q$) ~ 'permission denied'
   and pg_temp.fehler($q$select * from ki_budget$q$) ~ 'permission denied');
select 'K18c Inhaber: kein UPDATE auf ki_preise / ki_budget | ' ||
  (pg_temp.fehler($q$update ki_preise set eingabe_eur_je_mio = 0$q$) ~ 'permission denied'
   and pg_temp.fehler($q$update ki_budget set monat_eur = 1$q$) ~ 'permission denied');
reset role;
select 'K18d …und die Preise sind unverändert (10 / 50) | ' ||
  (select eingabe_eur_je_mio = 10 and ausgabe_eur_je_mio = 50 from ki_preise where modell = 'claude-opus-5');

-- Bilder
set local role authenticated; select pg_temp.als(:'D');
insert into st select 'p2', master_ki_preis_setzen('fal-ai/birefnet/v2', 'bild', null, null, null, 0.04, 'Test')::text;
reset role;
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'b6', ki_nutzung_buchen('bild_profi_frei', 'fal-ai/birefnet/v2', 0, 0, 0, 1)::text;
reset role;
select 'K19 Bild-Buchung kostet eur_je_bild · Bilder = 0,04 | ' ||
  (exists (select 1 from ki_nutzung where modell = 'fal-ai/birefnet/v2' and bilder = 1 and kosten_eur = 0.04));

-- ── K2x Preis ändern rechnet nur das Offene nach ─────────────────────
set local role authenticated; select pg_temp.als(:'D');
insert into st select 'p3', master_ki_preis_setzen('claude-opus-5', 'token', 20, 100, null, null, 'neu')::text;
reset role;
select 'K20 Preiswechsel rechnet KEINE bereits bewertete Zeile um (nachgerechnet 0) | ' ||
  ((select v::jsonb->>'nachgerechnet' from st where k = 'p3') = '0'
   and exists (select 1 from ki_nutzung where tokens_ein = 1000 and kosten_eur = 0.035));
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'b7', ki_nutzung_buchen('uebersetzen', 'claude-opus-5', 1000, 500)::text;
reset role;
select 'K21 neue Buchung nach dem Wechsel nimmt den NEUEN Preis (0,07) | ' ||
  (exists (select 1 from ki_nutzung where tokens_ein = 1000 and kosten_eur = 0.07));

-- Zwischenstand Choco: 0,035 + 0,07 + 0,006 (Team) + 0,04 (Bild) + 0,07 = 0,221
select 'K22 Summe Choco bisher 0,221 | ' || ((select sum(kosten_eur) from ki_nutzung where betrieb_id = :'B1') = 0.221);

set local role authenticated; select pg_temp.als(:'A');
insert into st select 'x1', master_ki_preis_setzen('claude-opus-5', 'token', 0, 0, null, null, 'Angriff')::text;
insert into st select 'x2', master_ki_budget_setzen(:'B1', 9999, true)::text;
reset role;
select 'K23 Inhaber ist kein Master: Preis UND Budget abgewiesen | ' ||
  ((select v::jsonb->>'grund' from st where k = 'x1') = 'kein_master' and (select v::jsonb->>'grund' from st where k = 'x2') = 'kein_master');
select 'K23b …Preis unverändert, kein Budget entstanden (Zeilen) | ' ||
  ((select eingabe_eur_je_mio from ki_preise where modell = 'claude-opus-5') = 20 and (select count(*) from ki_budget) = 0);

set local role authenticated; select pg_temp.als(:'D');
insert into st select 'v1', master_ki_preis_setzen('x"y', 'token', 1, 1, null, null, null)::text;
insert into st select 'v2', master_ki_preis_setzen('claude-opus-5', 'wasser', 1, 1, null, null, null)::text;
insert into st select 'v3', master_ki_preis_setzen('claude-opus-5', 'token', -1, 1, null, null, null)::text;
insert into st select 'v4', master_ki_preis_setzen('claude-opus-5', 'token', 1, 1, null, null, repeat('x', 301))::text;
reset role;
select 'K24 Preis-Form: Modell / Art / Betrag / Bemerkung je ein Grund | ' ||
  ((select v::jsonb->>'grund' from st where k = 'v1') = 'modell' and (select v::jsonb->>'grund' from st where k = 'v2') = 'art'
   and (select v::jsonb->>'grund' from st where k = 'v3') = 'betrag' and (select v::jsonb->>'grund' from st where k = 'v4') = 'bemerkung');
select 'K24b …und der Preis blieb 20 / 100 | ' ||
  (select eingabe_eur_je_mio = 20 and ausgabe_eur_je_mio = 100 from ki_preise where modell = 'claude-opus-5');

-- ── K3x Budget ───────────────────────────────────────────────────────
set local role authenticated; select pg_temp.als(:'A');
insert into st select 's0', ki_budget_stand()::text;
reset role;
select 'K30 ohne Budget: nicht über, keine Warnung, nicht hart | ' ||
  ((select v::jsonb from st where k = 's0') = '{"ueber": false, "warnung": false, "hart": false}'::jsonb);

set local role authenticated; select pg_temp.als(:'D');
insert into st select 'g1', master_ki_budget_setzen(:'B1', 0.10, true, 50)::text;
reset role;
set local role authenticated; select pg_temp.als(:'A');
insert into st select 's1', ki_budget_stand()::text;
reset role;
select 'K31 Budget 0,10 (hart), verbraucht 0,221 → über, Warnung, hart | ' ||
  ((select v::jsonb from st where k = 's1') = '{"ueber": true, "warnung": true, "hart": true}'::jsonb);
select 'K31b der Betrieb erfährt KEINE Beträge, nur drei Schalter | ' ||
  ((select count(*) from jsonb_object_keys((select v::jsonb from st where k = 's1'))) = 3);

set local role authenticated; select pg_temp.als(:'D');
insert into st select 'g2', master_ki_budget_setzen(:'B1', 1.00, false, 50)::text;
reset role;
set local role authenticated; select pg_temp.als(:'A');
insert into st select 's2', ki_budget_stand()::text;
reset role;
select 'K32 Budget 1,00 (weich), 22 % → weder über noch Warnung | ' ||
  ((select v::jsonb from st where k = 's2') = '{"ueber": false, "warnung": false, "hart": false}'::jsonb);

set local role authenticated; select pg_temp.als(:'D');
insert into st select 'g3', master_ki_budget_setzen(:'B1', 0.30, false, 70)::text;
reset role;
set local role authenticated; select pg_temp.als(:'A');
insert into st select 's3', ki_budget_stand()::text;
reset role;
select 'K33 Budget 0,30, Warnung ab 70 % (0,21) → Warnung, nicht über | ' ||
  ((select v::jsonb from st where k = 's3') = '{"ueber": false, "warnung": true, "hart": false}'::jsonb);

-- Budget ohne Betrag (null) heißt: kein Budget
set local role authenticated; select pg_temp.als(:'D');
insert into st select 'g4', master_ki_budget_setzen(:'B1', null, true, 80)::text;
reset role;
set local role authenticated; select pg_temp.als(:'A');
insert into st select 's4', ki_budget_stand()::text;
reset role;
select 'K34 Betrag NULL → kein Budget, auch nicht „hart“ | ' ||
  ((select v::jsonb from st where k = 's4') = '{"ueber": false, "warnung": false, "hart": false}'::jsonb);

-- Trennung der Häuser: Blend sieht nichts von Chocos Budget; fremder p_betrieb verrät nichts
set local role authenticated; select pg_temp.als(:'D');
insert into st select 'g5', master_ki_budget_setzen(:'B1', 0.10, true, 50)::text;
reset role;
set local role authenticated; select pg_temp.als(:'B');
insert into st select 's5', ki_budget_stand()::text;
insert into st select 's6', ki_budget_stand(:'B1')::text;
reset role;
select 'K35 Blend: eigener Stand unberührt von Chocos Budget | ' ||
  ((select v::jsonb from st where k = 's5') = '{"ueber": false, "warnung": false, "hart": false}'::jsonb);
select 'K35b …und mit Chocos Betriebs-Id gefragt kommt dasselbe „nichts“ (kein Leck) | ' ||
  ((select v from st where k = 's6') = (select v from st where k = 's5'));

-- Budgetform
set local role authenticated; select pg_temp.als(:'D');
insert into st select 'g6', master_ki_budget_setzen(:'B1', -1, false, 80)::text;
insert into st select 'g7', master_ki_budget_setzen(:'B1', 5, false, 0)::text;
insert into st select 'g8', master_ki_budget_setzen('99999999-9999-9999-9999-999999999999', 5, false, 80)::text;
reset role;
select 'K36 Budget-Form: Betrag / Warnung / unbekannter Betrieb je ein Grund | ' ||
  ((select v::jsonb->>'grund' from st where k = 'g6') = 'betrag' and (select v::jsonb->>'grund' from st where k = 'g7') = 'warnung'
   and (select v::jsonb->>'grund' from st where k = 'g8') = 'betrieb');

-- Vormonat zählt nicht fürs Budget (Berliner Monatsgrenze)
insert into ki_nutzung(betrieb_id, funktion, modell, tokens_ein, tokens_aus, kosten_eur, erstellt_am)
  values (:'B2', 'uebersetzen', 'claude-opus-5', 1, 1, 999,
          date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' - interval '1 minute');
update ki_budget set monat_eur = 5 where betrieb_id = :'B1';
insert into ki_budget(betrieb_id, monat_eur, hart) values (:'B2', 5, true);
set local role authenticated; select pg_temp.als(:'B');
insert into st select 's7', ki_budget_stand()::text;
reset role;
select 'K37 eine Buchung über 999 € aus dem Vormonat bringt Blend NICHT über das Monatsbudget | ' ||
  ((select v::jsonb->>'ueber' from st where k = 's7') = 'false');

-- ── K4x Master-Auswertung ────────────────────────────────────────────
set local role authenticated; select pg_temp.als(:'A');
insert into st select 'm0', master_ki_nutzung(current_date - 30, current_date)::text;
reset role;
select 'K40 Inhaber: Auswertung abgewiesen, ohne Daten | ' ||
  ((select v::jsonb from st where k = 'm0') = '{"ok": false, "grund": "kein_master"}'::jsonb);

set local role authenticated; select pg_temp.als(:'D');
insert into st select 'm1', master_ki_nutzung((now() at time zone 'Europe/Berlin')::date - 30, (now() at time zone 'Europe/Berlin')::date)::text;
insert into st select 'm2', master_ki_nutzung(date '2026-01-02', date '2026-01-01')::text;
insert into st select 'm3', master_ki_nutzung(current_date - 500, current_date)::text;
insert into st select 'm4', master_ki_nutzung(null, current_date)::text;
reset role;
select 'K41 Master: ok, Zeilen je Betrieb × Funktion × Modell | ' ||
  ((select v::jsonb->>'ok' from st where k = 'm1') = 'true'
   and (select jsonb_array_length(v::jsonb->'zeilen') from st where k = 'm1') = 3);
select 'K41b Summe der Choco-Zeilen = 0,221 (Blend: 999-€-Zeile aus dem Vormonat liegt IM 30-Tage-Fenster) | ' ||
  ((select sum((z->>'kosten_eur')::numeric) from st, jsonb_array_elements(v::jsonb->'zeilen') z
     where k = 'm1' and z->>'betrieb_name' = 'Choco') = 0.221);
select 'K41c Budgets: beide Betriebe aufgeführt, verbraucht_monat Blend = 0 (Vormonatszeile zählt nicht) | ' ||
  ((select jsonb_array_length(v::jsonb->'budgets') from st where k = 'm1') = 2
   and (select (b->>'verbraucht_monat_eur')::numeric from st, jsonb_array_elements(v::jsonb->'budgets') b
         where k = 'm1' and b->>'betrieb_name' = 'Blend') = 0);
select 'K41d Preistabelle liegt bei | ' || ((select jsonb_array_length(v::jsonb->'preise') from st where k = 'm1') = 4);
select 'K42 Zeitraum falsch herum / über 400 Tage / NULL → zeitraum | ' ||
  ((select v::jsonb->>'grund' from st where k = 'm2') = 'zeitraum' and (select v::jsonb->>'grund' from st where k = 'm3') = 'zeitraum'
   and (select v::jsonb->>'grund' from st where k = 'm4') = 'zeitraum');

-- Zeitraum filtert wirklich: eine Zeile aus 2020 taucht im 30-Tage-Fenster nicht auf, im eigenen Fenster schon
insert into ki_nutzung(betrieb_id, funktion, modell, tokens_ein, tokens_aus, kosten_eur, erstellt_am)
  values (:'B1', 'beleg_lesen', 'claude-opus-5-5', 7, 7, 1.5, timestamptz '2020-06-15 12:00:00+02');
set local role authenticated; select pg_temp.als(:'D');
insert into st select 'm5', master_ki_nutzung(date '2020-06-01', date '2020-06-30')::text;
insert into st select 'm6', master_ki_nutzung((now() at time zone 'Europe/Berlin')::date - 30, (now() at time zone 'Europe/Berlin')::date)::text;
reset role;
select 'K43 Zeile von 2020 liegt im Fenster 2020 (genau 1 Zeile, 1,5 €) und NICHT im aktuellen | ' ||
  ((select jsonb_array_length(v::jsonb->'zeilen') from st where k = 'm5') = 1
   and (select (v::jsonb->'zeilen'->0->>'kosten_eur')::numeric from st where k = 'm5') = 1.5
   and (select jsonb_array_length(v::jsonb->'zeilen') from st where k = 'm6') = 3);

-- ── K5x Schranken der Tabellen selbst (als Eigentümer, Gegenprobe zur Funktion) ─
select 'K50 CHECK: unbekannte Funktion / negative Token / 11 Bilder werden abgelehnt | ' ||
  (pg_temp.fehler($q$insert into ki_nutzung(betrieb_id,funktion,modell) values ('10000000-0000-0000-0000-000000000001','x','m')$q$) ~ 'check'
   and pg_temp.fehler($q$insert into ki_nutzung(betrieb_id,funktion,modell,tokens_ein) values ('10000000-0000-0000-0000-000000000001','uebersetzen','m',-1)$q$) ~ 'check'
   and pg_temp.fehler($q$insert into ki_nutzung(betrieb_id,funktion,modell,bilder) values ('10000000-0000-0000-0000-000000000001','uebersetzen','m',11)$q$) ~ 'check');
-- Betrieb ohne Mitglieder (im Modell hängt betrieb_mitglieder ohne cascade an den Betrieben)
insert into betriebe(id,name,slug) values ('10000000-0000-0000-0000-000000000009','Leer','leer');
insert into ki_nutzung(betrieb_id,funktion,modell) values ('10000000-0000-0000-0000-000000000009','uebersetzen','m');
insert into ki_budget(betrieb_id,monat_eur) values ('10000000-0000-0000-0000-000000000009',1);
select 'K51a Voraussetzung: Nutzung und Budget des Leer-Betriebs sind da | ' ||
  ((select count(*) from ki_nutzung where betrieb_id = '10000000-0000-0000-0000-000000000009') = 1
   and (select count(*) from ki_budget where betrieb_id = '10000000-0000-0000-0000-000000000009') = 1);
delete from betriebe where id = '10000000-0000-0000-0000-000000000009';
select 'K51 Betrieb löschen nimmt seine Nutzung und sein Budget mit (cascade) | ' ||
  (not exists (select 1 from ki_nutzung where betrieb_id = '10000000-0000-0000-0000-000000000009')
   and not exists (select 1 from ki_budget where betrieb_id = '10000000-0000-0000-0000-000000000009'));

rollback;
