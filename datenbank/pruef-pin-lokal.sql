\set QUIET 1
\pset tuples_only on
\pset format unaligned
begin;
create or replace function pg_temp.als(p_uid text, p_sitzung text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated','session_id',p_sitzung)::text, true);
end $$;
grant execute on function pg_temp.als(text,text) to authenticated;
\set W '00000000-0000-0000-0000-00000000000a'
\set K '00000000-0000-0000-0000-00000000000c'
\set B '00000000-0000-0000-0000-00000000000b'
\set M '00000000-0000-0000-0000-0000000000ff'
\set C '10000000-0000-0000-0000-000000000001'

set local role authenticated;
select pg_temp.als(:'W','s1');
select 'P01 ohne Pflicht sieht der Wirt seine Karte | ' || ((select count(*) from gerichte) = 1);
select pg_temp.als(:'M','m1');
select 'P02 Master ohne PIN ist Master | ' || ist_master();
select 'P03 Master vergibt PIN an Wirt | ' || (pin_setzen(:'W','48151623')->>'ok');
select 'P04 Pflicht verweigert, solange der Koch keine PIN hat | ' || ((pin_pflicht_setzen(:'C',true)) @> '{"grund":"pin_fehlt","fehlt":["koch@choco.de"]}');
select 'P05a Koch bekommt PIN | ' || (pin_setzen(:'K','90817263')->>'ok');
select 'P05b jetzt geht die Pflicht an | ' || (pin_pflicht_setzen(:'C',true)->>'ok');
select pg_temp.als(:'W','s1');
select 'P06a ohne PIN-Eingabe: keine Gerichte | ' || ((select count(*) from gerichte) = 0);
select 'P06b ohne PIN-Eingabe: kein Betrieb | ' || ((select count(*) from betriebe) = 0);
select 'P06c ohne PIN-Eingabe: keine Rabattcodes (Regel war am Bypass) | ' || ((select count(*) from rabattcodes) = 0);
select 'P06d ohne PIN-Eingabe: rechnung_rabattieren verweigert | ' || (rechnung_rabattieren('20000000-0000-0000-0000-000000000001','CHOCO-1')->>'grund' = 'kein_zugriff');
select 'P06e ohne PIN-Eingabe: Mitgliedschaft bleibt lesbar (Board weiß, wohin) | ' || ((select count(*) from betrieb_mitglieder) = 1);
select 'P07 pin_status sagt: Pflicht, PIN da, noch nicht ok | ' || (pin_status() @> '{"pflicht":true,"hat_pin":true,"ok":false}');
select 'P08a falsche PIN zählt | ' || (pin_pruefen('00000001') @> '{"grund":"falsch","verbleibend":4}');
select 'P08b Formfehler zählt nicht | ' || (pin_pruefen('1234') @> '{"grund":"form","verbleibend":4}');
select 'P09a richtige PIN | ' || (pin_pruefen('48151623')->>'ok');
select 'P09b danach: Karte da | ' || ((select count(*) from gerichte) = 1);
select 'P09c danach: Rabattcode da | ' || ((select count(*) from rabattcodes) = 1);
with u as (update betriebe set name = 'Choco L''AMouR' where id = :'C' returning 1) select 'P09d andere Spalte derselben Zeile änderbar (§2.7) | ' || (count(*) = 1) from u;
select 'P09e Zähler wieder auf null | ' || (pin_status() @> '{"verbleibend":5}');
select pg_temp.als(:'W','s2');
select 'P10 andere Anmeldung desselben Kontos: wieder zu | ' || ((select count(*) from gerichte) = 0);
select pg_temp.als(:'W','');
select 'P10b Token ohne session_id: kein Freischalten | ' || (pin_pruefen('48151623')->>'grund' = 'keine_sitzung');
select pg_temp.als(:'B','b1');
select 'P11 Blend ohne Pflicht: eigene Karte, keine fremde | ' || ((select string_agg(name, ',') from gerichte) = 'Mojito');
select pg_temp.als(:'K','k1');
select 'P12a fünf Fehlversuche | ' || (select string_agg(pin_pruefen('1111111' || i)->>'grund', ',') from generate_series(1,5) i);
select 'P12b gesperrt bleibt gesperrt, auch mit richtiger PIN | ' || (pin_pruefen('90817263')->>'grund' = 'gesperrt');
select 'P12c und sieht nichts | ' || ((select count(*) from gerichte) = 0);
select 'P14 Nicht-Master setzt keine PIN | ' || (pin_setzen(:'K','55667788')->>'grund' = 'kein_master');
select 'P14b Nicht-Master sieht keine Zugänge | ' || ((select count(*) from master_zugaenge()) = 0);
select pg_temp.als(:'M','m1');
select 'P13a Master entsperrt | ' || (pin_entsperren(:'K')->>'ok');
select pg_temp.als(:'K','k1');
select 'P13b danach geht die richtige PIN | ' || (pin_pruefen('90817263')->>'ok');
select pg_temp.als(:'M','m1');
select 'P15a zu einfach: 8 gleiche | ' || (pin_setzen(:'W','11111111')->>'grund' = 'zu_einfach');
select 'P15b zu einfach: Treppe | ' || (pin_setzen(:'W','12345678')->>'grund' = 'zu_einfach');
select 'P15c Form: 7 Ziffern | ' || (pin_setzen(:'W','1234567')->>'grund' = 'form');
select 'P17 PIN entfernen bei aktiver Pflicht verweigert | ' || (pin_entfernen(:'K')->>'grund' = 'pflicht_aktiv');
select 'P20 Master sieht alle Zugänge mit PIN-Stand | ' || ((select count(*) from master_zugaenge()) = 4 and (select bool_and(hat_pin) from master_zugaenge() where betrieb_name = 'Choco L''AMouR'));
select 'P16a Master gibt sich selbst eine PIN | ' || (pin_setzen(:'M','20262027')->>'ok');
select 'P16b danach ohne Eingabe kein Master mehr | ' || (not ist_master());
select 'P16c pin_status verrät es trotzdem (für den Schirm) | ' || (pin_status() @> '{"master":true,"pflicht":true,"ok":false}');
select 'P16d Eingabe ok | ' || (pin_pruefen('20262027')->>'ok');
select 'P16e nächste Anfrage: wieder Master | ' || ist_master();
reset role;
select 'P18a anon darf pin_pruefen nicht rufen | ' || (not has_function_privilege('anon','public.pin_pruefen(text)','EXECUTE'));
select 'P18b anon darf pin_setzen nicht rufen | ' || (not has_function_privilege('anon','public.pin_setzen(uuid,text)','EXECUTE'));
select 'P18c authenticated liest konto_pin nicht direkt | ' || (not has_table_privilege('authenticated','public.konto_pin','SELECT'));
select 'P18d Trigger kein rpc-Endpunkt mehr | ' || (not has_function_privilege('authenticated','public.admin_login_entsperren()','EXECUTE'));
select 'P18e PIN liegt als bcrypt-Hash, nie im Klartext | ' || (select bool_and(pin_hash like '$2a$08$%' and pin_hash not like '%48151623%') from konto_pin);
update pin_sitzungen set bis = now() - interval '1 minute' where nutzer_id = :'W';
set local role authenticated;
select pg_temp.als(:'W','s1');
select 'P21 abgelaufene Freigabe gilt nicht | ' || ((select count(*) from gerichte) = 0);
reset role;
select 'P22 genau EINE Fassung jeder Funktion (§2.1) | ' || (select bool_and(n = 1) from (select count(*) n from pg_proc where pronamespace='public'::regnamespace and proname in ('meine_betriebe','ist_master','pin_pruefen','rechnung_rabattieren') group by proname) x);
rollback;
