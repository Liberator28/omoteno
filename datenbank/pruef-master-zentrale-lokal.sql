\set QUIET 1
\pset tuples_only on
\pset format unaligned
begin;
create or replace function pg_temp.als(p_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated','session_id','s1')::text, true); end $$;
create or replace function pg_temp.versuch(p_sql text) returns text language plpgsql as $$
declare n int; begin execute p_sql; get diagnostics n = row_count; return 'zeilen:'||n;
exception when insufficient_privilege then return 'verweigert'; when check_violation then return 'schranke'; end $$;
grant execute on all functions in schema pg_temp to authenticated;
\set W '00000000-0000-0000-0000-00000000000a'
\set M '00000000-0000-0000-0000-0000000000ff'
\set C '10000000-0000-0000-0000-000000000001'
set local role authenticated;
select pg_temp.als(:'W');
select 'M01 Wirt setzt eigenen Tarif | ' || (pg_temp.versuch($q$update betriebe set plan = 'alessia' where id = '10000000-0000-0000-0000-000000000001'$q$) = 'verweigert');
select 'M02 Wirt setzt Preis auf 0 | ' || (pg_temp.versuch($q$update betriebe set preis_monat = 0 where id = '10000000-0000-0000-0000-000000000001'$q$) = 'verweigert');
select 'M03 Wirt schaltet PIN-Pflicht ab | ' || (pg_temp.versuch($q$update betriebe set pin_pflicht = false where id = '10000000-0000-0000-0000-000000000001'$q$) = 'verweigert');
select 'M04 Wirt verlängert Testphase | ' || (pg_temp.versuch($q$update betriebe set test_bis = now() + interval '1 year' where id = '10000000-0000-0000-0000-000000000001'$q$) = 'verweigert');
select 'M05 Wirt ändert Hub-Texte (bleibt erlaubt) | ' || (pg_temp.versuch($q$update betriebe set hub_texte = '{"claim":"x"}' where id = '10000000-0000-0000-0000-000000000001'$q$) = 'zeilen:1');
select 'M06 Wirt setzt Reservierungs-Telefon | ' || (pg_temp.versuch($q$update betriebe set kontakt_telefon = '+49 6422 123456' where id = '10000000-0000-0000-0000-000000000001'$q$) = 'zeilen:1');
select 'M07 Telefon mit Text wird abgewiesen | ' || (pg_temp.versuch($q$update betriebe set kontakt_telefon = 'ruf an <b>' where id = '10000000-0000-0000-0000-000000000001'$q$) = 'schranke');
select 'M08 Wirt ruft master_betrieb_setzen | ' || (master_betrieb_setzen(:'C', '{"plan":"alessia"}')->>'grund' = 'kein_master');
select 'M09 Wirt legt keine Rechnung an | ' || (master_rechnung_anlegen(:'C', '2026-09-01')->>'grund' = 'kein_master');
select 'M10 Wirt schreibt nicht direkt in rechnungen | ' || (pg_temp.versuch($q$insert into rechnungen(betrieb_id, nummer) values ('10000000-0000-0000-0000-000000000001','X')$q$) <> 'zeilen:1');
select pg_temp.als(:'M');
select 'M11 Master: Rechnung ohne Preis | ' || (master_rechnung_anlegen(:'C', '2026-09-01')->>'grund' = 'kein_preis');
select 'M12 Master setzt Tarif und Preis | ' || (master_betrieb_setzen(:'C', '{"plan":"basic","preis_monat":199}')->>'ok');
select 'M13 Master: falscher Tarif | ' || (master_betrieb_setzen(:'C', '{"plan":"gold"}')->>'grund' = 'schranke');
select 'M14 Master: unbekanntes Feld (slug) | ' || (master_betrieb_setzen(:'C', '{"slug":"neu"}')->>'grund' = 'unbekannt');
select 'M15 Master: Test ohne Frist | ' || (master_betrieb_setzen(:'C', '{"zustand":"test"}')->>'grund' = 'schranke');
select 'M16 Master: Test mit Frist | ' || (master_betrieb_setzen(:'C', '{"zustand":"test","test_bis":"2026-10-31T23:59:00Z"}')->>'ok');
select 'M17 Master: kaputtes Datum | ' || (master_betrieb_setzen(:'C', '{"vertrag_ab":"31.12.2026"}')->>'grund' = 'form');
select 'M18 Master: Telefon leeren | ' || (master_betrieb_setzen(:'C', '{"kontakt_telefon":""}')->>'ok');
select 'M19 Rechnung Sept. | ' || (master_rechnung_anlegen(:'C', '2026-09-15')->>'nummer');
select 'M20 Brutto 199 → 236,81 | ' || ((select brutto from rechnungen where nummer = 'OMO-2026-0001') = 236.81);
select 'M21 zweimal derselbe Monat | ' || (master_rechnung_anlegen(:'C', '2026-09-02')->>'grund' = 'schon_da');
select 'M22 nächster Monat, nächste Nummer | ' || (master_rechnung_anlegen(:'C', '2026-10-01')->>'nummer');
select 'M23a bezahlt markieren | ' || (master_rechnung_bezahlt((select id from rechnungen where nummer='OMO-2026-0001'), true)->>'ok');
select 'M23b Datum steht | ' || (select bezahlt_am = current_date from rechnungen where nummer='OMO-2026-0001');
select 'M24 Login-Sperre aufheben | ' || (master_login_entsperren(:'W')->>'ok');
select 'M25 Master ändert Hub-Texte direkt (Regel mit ist_master) | ' || (pg_temp.versuch($q$update betriebe set hub_texte = '{"claim":"y"}' where id = '10000000-0000-0000-0000-000000000001'$q$) = 'zeilen:1');
select pg_temp.als(:'W');
select 'M26 Wirt sieht seine Rechnungen | ' || ((select count(*) from rechnungen) = 2);
reset role;
select 'M27 Sperre ist weg | ' || (select not gesperrt and fehlversuche = 0 from admin_login_schutz where nutzer_id = :'W');
select 'M28 anon liest Telefon-Spalte | ' || has_column_privilege('anon','public.betriebe','kontakt_telefon','SELECT');
select 'M29 anon ruft keine Master-Funktion | ' || (not has_function_privilege('anon','public.master_betrieb_setzen(uuid,jsonb)','EXECUTE'));
rollback;
