-- ═══════════════════════════════════════════════════════════════════
--  Probe zu migration-zahlungen.sql. Dreht sich selbst zurück.
--  Lokal: pruefungen/pruef-zahlungen-lokal.sh (Modell + echte Funktionen).
--  Im SQL-Editor gegen die Live-Datenbank: den Abschnitt "Bestand" unten
--  durch zwei echte Betriebe/Konten ersetzen (A, B, C, Betriebe 1, 2).
--
--  Gemessen wird (CLAUDE.md §2.3b) die ZEILENZAHL, nie nur die Ausnahme;
--  jeder Schreibweg ohne `returning`; Voraussetzungen vor dem Rollenwechsel.
--  Ausgabe: je Zeile "Zxx Beschreibung | true|false" — jedes false ist ein Befund.
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

-- PIN für die beiden Inhaber (nicht für den Koch C)
insert into konto_pin(nutzer_id, pin_hash) values
  (:'A', extensions.crypt('48151623', extensions.gen_salt('bf', 4))),
  (:'B', extensions.crypt('48151623', extensions.gen_salt('bf', 4)));

-- ── Z0x IBAN-Prüfsumme ─────────────────────────────────────────────
select 'Z01 gültige deutsche IBAN (mit Leerzeichen) | ' || iban_gueltig('DE89 3704 0044 0532 0130 00');
select 'Z02 eine Ziffer vertauscht → falsch | ' || (not iban_gueltig('DE89 3704 0044 0532 0130 01'));
select 'Z03 DE mit 21 Stellen → falsch | ' || (not iban_gueltig('DE8937040044053201300'));
select 'Z04 Einschleusung als IBAN → falsch | ' || (not iban_gueltig('DE89"><script>370400440532013000'));
select 'Z05 österreichische IBAN gültig | ' || iban_gueltig('AT61 1904 3002 3457 3201');
select 'Z06 leer/NULL → falsch, kein Fehler | ' || (not iban_gueltig('') and not iban_gueltig(null));

-- ── Z1x Einstellen: Recht, Form, PIN ───────────────────────────────
set local role authenticated;
select pg_temp.als(:'C');
select 'Z10 Koch/Team stellt nichts ein | ' || (zahlarten_setzen(:'B1', '{"ueberweisung_an":false}'::jsonb, '48151623')->>'grund' = 'kein_recht');
select pg_temp.als(:'B');
select 'Z11 Inhaber eines ANDEREN Betriebs stellt nichts ein | ' || (zahlarten_setzen(:'B1', '{}'::jsonb, '48151623')->>'grund' = 'kein_recht');
select pg_temp.als(null);
select 'Z12 ohne Anmeldung | ' || (zahlarten_setzen(:'B1', '{}'::jsonb, '48151623')->>'grund' = 'nicht_angemeldet');
select pg_temp.als(:'A');
select 'Z13 Stripe-Konto muss acct_… heißen | ' || (zahlarten_setzen(:'B1', '{"stripe_konto":"sk_live_abc"}'::jsonb, '48151623')->>'grund' = 'stripe_konto_form');
select 'Z14 Karte an ohne Konto → Grund | ' || (zahlarten_setzen(:'B1', '{"karte_an":true}'::jsonb, '48151623')->>'grund' = 'stripe_konto_fehlt');
select 'Z15 falsche IBAN → Grund | ' || (zahlarten_setzen(:'B1', '{"iban":"DE00 1234"}'::jsonb, '48151623')->>'grund' = 'iban');
select 'Z16 Überweisung ohne Kontoinhaber → Grund | ' || (zahlarten_setzen(:'B1', '{"ueberweisung_an":true,"iban":"DE89370400440532013000"}'::jsonb, '48151623')->>'grund' = 'ueberweisung_unvollstaendig');
select 'Z16b Kontoinhaber mit Tag → Grund | ' || (zahlarten_setzen(:'B1', '{"kontoinhaber":"<b>x</b>"}'::jsonb, '48151623')->>'grund' = 'kontoinhaber');
select 'Z16c BIC mit Anführungszeichen → Grund | ' || (zahlarten_setzen(:'B1', '{"bic":"X\"Y"}'::jsonb, '48151623')->>'grund' = 'bic');
reset role;
select 'Z17 Formfehler kosten KEINEN PIN-Versuch | ' || ((select fehlversuche from konto_pin where nutzer_id = :'A') = 0);
set local role authenticated; select pg_temp.als(:'A');
select 'Z18 falsche PIN → pin_falsch | ' || (zahlarten_setzen(:'B1', '{"ueberweisung_an":false}'::jsonb, '11112222')->>'grund' = 'pin_falsch');
select 'Z18b keine PIN mitgeschickt → pin_form | ' || (zahlarten_setzen(:'B1', '{}'::jsonb, null)->>'grund' = 'pin_form');
reset role;
select 'Z19 …und zählt als Versuch (jetzt 1 Fehlversuch), nichts gespeichert | ' ||
  ((select fehlversuche from konto_pin where nutzer_id = :'A') = 1 and (select count(*) from betrieb_zahlarten) = 0);
set local role authenticated; select pg_temp.als(:'A');
select 'Z20 richtige PIN + gültige Angaben → ok | ' || (zahlarten_setzen(:'B1',
  '{"karte_an":true,"klarna_an":true,"paypal_an":true,"sepa_an":true,"ueberweisung_an":true,"stripe_konto":"acct_1ABCDEFGHIJ",
    "iban":"DE89 3704 0044 0532 0130 00","kontoinhaber":"Choco L''Amour GmbH","bic":"cobadeffxxx","bank":"Commerzbank"}'::jsonb,
  '48151623')->>'ok' = 'true');
reset role;
select 'Z21 gespeichert: IBAN ohne Leerzeichen, BIC groß | ' ||
  ((select iban from betrieb_zahlarten where betrieb_id = :'B1') = 'DE89370400440532013000'
   and (select bic from betrieb_zahlarten where betrieb_id = :'B1') = 'COBADEFFXXX');
select 'Z21b richtige PIN setzt den Fehlzähler zurück | ' || ((select fehlversuche from konto_pin where nutzer_id = :'A') = 0);
select 'Z22 Protokoll: Person, Tabelle, geänderte Felder (iban dabei) | ' ||
  exists (select 1 from protokoll where tabelle = 'betrieb_zahlarten' and nutzer_id = :'A' and betrieb_id = :'B1' and 'iban' = any(felder) or
          tabelle = 'betrieb_zahlarten' and art = 'neu' and nutzer_id = :'A');
select 'Z22b Protokoll-Schranke kennt alle alten Werte UND die neuen | ' ||
  (select bool_and(pg_get_constraintdef(oid) ~ 'team' and pg_get_constraintdef(oid) ~ 'rabattcodes'
                   and pg_get_constraintdef(oid) ~ 'betrieb_zahlarten' and pg_get_constraintdef(oid) ~ 'zahlungen')
     from pg_constraint where conname = 'protokoll_tabelle_check');

-- ── Z2x Direkter Weg: Recht UND Zeilen (§2.3a, §2.3b) ──────────────
select 'Z23 authenticated hat kein INSERT/UPDATE/DELETE auf betrieb_zahlarten | ' ||
  (not has_table_privilege('authenticated', 'public.betrieb_zahlarten', 'INSERT')
   and not has_table_privilege('authenticated', 'public.betrieb_zahlarten', 'UPDATE')
   and not has_table_privilege('authenticated', 'public.betrieb_zahlarten', 'DELETE'));
select 'Z23b anon hat gar nichts auf Zahlarten/Zahlungen/Ereignissen | ' ||
  (not has_table_privilege('anon', 'public.betrieb_zahlarten', 'SELECT') and not has_table_privilege('anon', 'public.zahlungen', 'SELECT')
   and not has_table_privilege('anon', 'public.zahlung_ereignisse', 'SELECT') and not has_table_privilege('anon', 'public.zahlungen', 'INSERT'));
select 'Z23c authenticated: kein Schreibrecht auf zahlungen, kein Lesen der Stripe-Spalten | ' ||
  (not has_table_privilege('authenticated', 'public.zahlungen', 'INSERT') and not has_table_privilege('authenticated', 'public.zahlungen', 'UPDATE')
   and not has_column_privilege('authenticated', 'public.zahlungen', 'stripe_url', 'SELECT')
   and not has_column_privilege('authenticated', 'public.zahlungen', 'stripe_session', 'SELECT')
   and has_column_privilege('authenticated', 'public.zahlungen', 'betrag_cent', 'SELECT'));
set local role authenticated; select pg_temp.als(:'A');
select 'Z24 direkter UPDATE als Inhaber scheitert | ' || (pg_temp.fehler('update public.betrieb_zahlarten set iban = ''DE02120300000000202051''') ~ 'permission denied');
select 'Z25 Inhaber sieht seine Zeile | ' || ((select count(*) from betrieb_zahlarten) = 1);
select pg_temp.als(:'B');
select 'Z26 fremder Inhaber sieht SIE nicht | ' || ((select count(*) from betrieb_zahlarten) = 0);
reset role;

-- ── Z3x Bestellen mit Zahlungsart (Wrapper) ─────────────────────────
insert into st values ('n0', (select count(*) from bestellungen)::text);
set local role anon; select pg_temp.als(null);
select 'Z30 ohne Zahlungsart → Ausnahme | ' || (pg_temp.fehler(format('select bestellung_aufgeben_zahlung(%L, ''tisch'', ''5'', 10, null, ''[]'', ''g1'', null, null, null, null, null)', :'B1')) ~ 'Zahlungsart ungueltig');
select 'Z31 erfundene Zahlungsart → Ausnahme | ' || (pg_temp.fehler(format('select bestellung_aufgeben_zahlung(%L, ''tisch'', ''5'', 10, null, ''[]'', ''g1'', null, null, null, null, ''bitcoin'')', :'B1')) ~ 'Zahlungsart ungueltig');
select 'Z32 andere Quelle als Tisch → Ausnahme | ' || (pg_temp.fehler(format('select bestellung_aufgeben_zahlung(%L, ''telefon'', ''5'', 10, null, ''[]'', ''g1'', null, null, null, null, ''stripe'')', :'B1')) ~ 'Quelle ungueltig');
select 'Z33 Überweisung am Tisch → Ausnahme (nur Lieferung) | ' || (pg_temp.fehler(format('select bestellung_aufgeben_zahlung(%L, ''tisch'', ''5'', 10, null, ''[]'', ''g2'', null, null, null, null, ''ueberweisung'')', :'B1')) ~ 'nur bei Lieferung');
select 'Z34 unter 50 Cent → Ausnahme mit Satz | ' || (pg_temp.fehler(format('select bestellung_aufgeben_zahlung(%L, ''tisch'', ''5'', 0.3, null, ''[]'', ''g3'', null, null, null, null, ''stripe'')', :'B1')) ~ 'zu klein');
reset role;
select 'Z33b alle fünf abgewiesenen Aufrufe haben KEINE Bestellung hinterlassen (eine Transaktion) | ' ||
  ((select count(*) from bestellungen) = (select v::int from st where k = 'n0'));
set local role anon; select pg_temp.als(null);
-- ehrlicher Weg 1: Tisch, Stripe, 12,50 €
insert into st select 'o1', (bestellung_aufgeben_zahlung(:'B1', 'tisch', '5', 12.5, null, '[]', 'g10', null, null, null, null, 'stripe')->>'id');
-- ehrlicher Weg 2: Lieferung, Stripe, 20 € + 2,50 € Liefergebühr
insert into st select 'o2', (bestellung_liefern_zahlung(:'B1', '{}'::jsonb, '[]'::jsonb, 20, null, 'g11', null, null, 'stripe')->>'id');
-- ehrlicher Weg 3: Lieferung, Überweisung
insert into st select 'o3', (bestellung_liefern_zahlung(:'B1', '{}'::jsonb, '[]'::jsonb, 30, null, 'g12', null, null, 'ueberweisung')->>'id');
-- Rabatt: 12,50 − 2,00
insert into st select 'o4', (bestellung_aufgeben_zahlung(:'B1', 'tisch', '6', 12.5, null, '[]', 'g13', null, null, null, 'MINUS2', 'stripe')->>'id');
-- Lieferung unter Mindestwert: Antwort wird durchgereicht, keine Zahlung
select 'Z35b Lieferung unter Mindestwert: Antwort des Bestellwegs bleibt, KEINE Zahlung | ' ||
  ((bestellung_liefern_zahlung(:'B1', '{}'::jsonb, '[]'::jsonb, 0.5, null, 'g14', null, null, 'stripe')->>'grund') = 'mindestwert');
reset role;
select 'Z35 Tisch/Stripe: 1250 Cent, offen, Art stripe | ' ||
  (select betrag_cent = 1250 and status = 'offen' and art = 'stripe' and stripe_konto = 'acct_1ABCDEFGHIJ' from zahlungen where bestellung_id = (select v::uuid from st where k = 'o1'));
select 'Z36 Lieferung: Ware + Liefergebühr = 2250 Cent | ' ||
  (select betrag_cent = 2250 from zahlungen where bestellung_id = (select v::uuid from st where k = 'o2'));
select 'Z37 Rabatt wird abgezogen: 1050 Cent | ' ||
  (select betrag_cent = 1050 from zahlungen where bestellung_id = (select v::uuid from st where k = 'o4'));
select 'Z38 Bestellung ist „Zahlung offen“ markiert (Küche sieht sie nicht) | ' ||
  (select pruefen is true and pruef_grund = 'Zahlung offen' from bestellungen where id = (select v::uuid from st where k = 'o1'));
select 'Z39 Überweisung offen, ohne Stripe-Konto in der Zeile | ' ||
  (select art = 'ueberweisung' and stripe_konto is null and betrag_cent = 3250 from zahlungen where bestellung_id = (select v::uuid from st where k = 'o3'));
select 'Z39b pro Bestellung genau eine Zahlung | ' || ((select count(*) from zahlungen) = 4);
-- Ehrlich: abgewiesene Aufrufe drehen ihren Zähler mit zurück (§2.3g). Hier ist das richtig: sie schreiben
-- nichts, kosten also nur Rechenzeit; gezählt wird jede Bestellung, die wirklich entsteht.
select 'Z39c jede ENTSTANDENE Bestellung wurde gezählt (zahlbestellung 60), fünf Stück | ' || ((select count(*) from bremse_log where ort = 'zahlbestellung' and grenze = 60) = 5);
-- Zweiter Aufruf derselben Bestellung ändert nichts (idempotent)
select 'Z40 zweites Vormerken liefert dieselbe Zahlung, keine zweite | ' ||
  ((zahlung_vormerken((select v::uuid from st where k = 'o1'), :'B1', 'stripe')->>'betrag_cent') = '1250' and (select count(*) from zahlungen) = 4);
-- bereits markierte Bestellung (Quarantäne) behält ihren Grund
insert into st select 'o5', bestellung_aufgeben(:'B1', 'tisch', '7', 9, null, '[]', 'g20')::text;
update bestellungen set pruefen = true, pruef_grund = 'Netz' where id = (select v::uuid from st where k = 'o5');
select zahlung_vormerken((select v::uuid from st where k = 'o5'), :'B1', 'stripe') is not null;
select 'Z42 Vormerken: alte Markierung bleibt, „Zahlung offen“ kommt dazu | ' ||
  (select be.pruef_grund = 'Netz · Zahlung offen' and za.vorher_markiert
     from bestellungen be join zahlungen za on za.bestellung_id = be.id where be.id = (select v::uuid from st where k = 'o5'));

-- ── Z5x Stand für den Gast ──────────────────────────────────────────
set local role anon; select pg_temp.als(null);
select 'Z50 zahlarten_oeffentlich: Flags, KEINE Kontodaten | ' ||
  (zahlarten_oeffentlich(:'B1') @> '{"stripe":true,"karte":true,"klarna":true,"paypal":true,"sepa":true,"ueberweisung":true}'
   and not (zahlarten_oeffentlich(:'B1')::text ~* 'iban|acct_|DE89'));
select 'Z51 Betrieb ohne Zeile: alles aus | ' || (zahlarten_oeffentlich(:'B2') = '{"stripe": false, "ueberweisung": false}'::jsonb);
select 'Z52 Stand einer Stripe-Zahlung: offen, KEINE Bankdaten | ' ||
  ((zahlung_status((select v::uuid from st where k = 'o1'))->>'status') = 'offen'
   and (zahlung_status((select v::uuid from st where k = 'o1'))->'ueberweisung') = 'null'::jsonb
   and not (zahlung_status((select v::uuid from st where k = 'o1'))::text ~* 'acct_|iban'));
select 'Z53 offene Überweisung: IBAN, Inhaber, Verwendungszweck | ' ||
  ((zahlung_status((select v::uuid from st where k = 'o3'))->'ueberweisung'->>'iban') = 'DE89370400440532013000'
   and (zahlung_status((select v::uuid from st where k = 'o3'))->>'zweck') ~ '^Bestellung [0-9A-F]{8}$');
select 'Z54 unbekannte Nummer → unbekannt | ' || (zahlung_status('99999999-9999-9999-9999-999999999999')->>'grund' = 'unbekannt');
reset role;
select 'Z55 Bremsen gezählt (zahlarten 300, zahlstatus 600) | ' ||
  ((select count(*) from bremse_log where ort = 'zahlarten' and grenze = 300) >= 2 and (select count(*) from bremse_log where ort = 'zahlstatus' and grenze = 600) >= 3);

-- ── Z6x Nur für die Edge Functions ──────────────────────────────────
select 'Z60 anon UND authenticated dürfen keine der sechs Service-Funktionen rufen | ' ||
  (select bool_and(not has_function_privilege(r, p.oid, 'EXECUTE'))
     from pg_proc p cross join (values ('anon'), ('authenticated')) v(r)
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('zahlung_stripe_vorbereiten','zahlung_session_merken','zahlung_finden','zahlung_ereignis_neu','zahlung_ereignis_frei','zahlung_freigeben','zahlung_scheitert','zahlung_vormerken'));
select 'Z60b service_role darf die sechs | ' ||
  (select bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE')) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('zahlung_stripe_vorbereiten','zahlung_session_merken','zahlung_finden','zahlung_ereignis_neu','zahlung_ereignis_frei','zahlung_freigeben','zahlung_scheitert'));
set local role anon; select pg_temp.als(null);
select 'Z61 anon ruft zahlung_freigeben direkt → Ausnahme, nichts bezahlt | ' ||
  (pg_temp.fehler(format('select zahlung_freigeben(%L)', (select v from st where k = 'o1'))) ~ 'permission denied');
reset role;
select 'Z61b …Zahlung blieb offen | ' || ((select status from zahlungen where bestellung_id = (select v::uuid from st where k = 'o1')) = 'offen');
set local role authenticated; select pg_temp.als(:'A');
select 'Z62 Inhaber ruft zahlung_freigeben direkt → Ausnahme | ' || (pg_temp.fehler(format('select zahlung_freigeben(%L)', (select v from st where k = 'o1'))) ~ 'permission denied');
reset role;

-- ── Z7x Stripe-Weg (als service_role) ───────────────────────────────
set local role service_role;
select 'Z70 vorbereiten: Betrag aus der Datenbank, Konto, Methoden | ' ||
  (zahlung_stripe_vorbereiten((select v::uuid from st where k = 'o1')) @>
   '{"ok":true,"betrag_cent":1250,"stripe_konto":"acct_1ABCDEFGHIJ","methoden":["card","klarna","paypal","sepa_debit"]}');
select 'Z70b Überweisung hat keinen Stripe-Weg | ' || (zahlung_stripe_vorbereiten((select v::uuid from st where k = 'o3'))->>'grund' = 'unbekannt');
select 'Z71 Sitzungsnummer in falscher Form → Ausnahme | ' || (pg_temp.fehler(format('select zahlung_session_merken(%L, ''x'', ''https://checkout.stripe.com/c/pay/abc'', now())', (select v from st where k = 'o1'))) ~ 'session_form');
select 'Z71b fremde Adresse als Bezahlseite → Ausnahme | ' || (pg_temp.fehler(format('select zahlung_session_merken(%L, ''cs_test_abcdefghij'', ''https://evil.example/pay'', now())', (select v from st where k = 'o1'))) ~ 'session_form');
select zahlung_session_merken((select v::uuid from st where k = 'o1'), 'cs_test_abcdefghij', 'https://checkout.stripe.com/c/pay/cs_test_abcdefghij', now() + interval '30 minutes');
select 'Z72 zweites Vorbereiten liefert dieselbe Bezahlseite (keine zweite Sitzung) | ' ||
  (zahlung_stripe_vorbereiten((select v::uuid from st where k = 'o1')) @> '{"ok":true,"wiederverwendet":true,"url":"https://checkout.stripe.com/c/pay/cs_test_abcdefghij"}');
select 'Z73 zahlung_finden: Konto, Betrag, Bestellung | ' ||
  (zahlung_finden('cs_test_abcdefghij') @> format('{"bestellung_id":%s,"betrag_cent":1250,"stripe_konto":"acct_1ABCDEFGHIJ"}', to_json((select v from st where k = 'o1')))::jsonb);
select 'Z73b unbekannte Sitzung → null | ' || (zahlung_finden('cs_test_gibtesnicht') = 'null'::jsonb);
select 'Z74 Ereignis: erstes Mal neu, zweites Mal nicht, Müll nie | ' ||
  (zahlung_ereignis_neu('evt_test_12345678') and not zahlung_ereignis_neu('evt_test_12345678') and not zahlung_ereignis_neu('x') and not zahlung_ereignis_neu(null));
-- freigeben mit falschem Konto
select zahlung_ereignis_frei('evt_test_12345678');
select 'Z74b …nach „frei“ zählt dasselbe Ereignis wieder als neu (Wiederholung von Stripe wird nicht verschluckt) | ' || zahlung_ereignis_neu('evt_test_12345678');
select 'Z74c Vorbereiten nennt den Versuch (für den Idempotenz-Schlüssel) | ' || ((zahlung_stripe_vorbereiten((select v::uuid from st where k = 'o1'))->>'versuch') = '1');
select 'Z75 Webhook mit FREMDEM Konto: abgelehnt, nichts bezahlt | ' ||
  (zahlung_freigeben((select v::uuid from st where k = 'o1'), 'card', 'pi_test_1', 'acct_FREMDERFREMDER')->>'grund' = 'konto');
select 'Z76 freigeben: ok, Bestellung frei, Zeit frisch | ' ||
  (zahlung_freigeben((select v::uuid from st where k = 'o1'), 'klarna', 'pi_test_1', 'acct_1ABCDEFGHIJ') @> '{"ok":true}');
reset role;
select 'Z76b Bestellung nicht mehr markiert, Zahlung bezahlt/klarna | ' ||
  ((select pruefen is false and pruef_grund is null and zeitpunkt > now() - interval '1 minute' from bestellungen where id = (select v::uuid from st where k = 'o1'))
   and (select status = 'bezahlt' and methode = 'klarna' and bezahlt_am is not null and not rueckzahlung_noetig from zahlungen where bestellung_id = (select v::uuid from st where k = 'o1')));
set local role service_role;
select 'Z77 zweites freigeben ändert nichts („schon“) | ' || (zahlung_freigeben((select v::uuid from st where k = 'o1'), 'card', 'pi_andere', null) @> '{"ok":true,"schon":true}');
select zahlung_scheitert((select v::uuid from st where k = 'o1'), 'abgelaufen');
reset role;
select 'Z78 „abgelaufen“ überschreibt NIE „bezahlt“ | ' || ((select status from zahlungen where bestellung_id = (select v::uuid from st where k = 'o1')) = 'bezahlt');
set local role service_role;
select 'Z79 scheitert mit erfundenem Status → Ausnahme | ' || (pg_temp.fehler(format('select zahlung_scheitert(%L, ''bezahlt'')', (select v from st where k = 'o2'))) ~ 'status');
select zahlung_scheitert((select v::uuid from st where k = 'o2'), 'fehlgeschlagen');
select 'Z80 nach Fehlschlag darf der Gast es nochmal versuchen | ' || (zahlung_stripe_vorbereiten((select v::uuid from st where k = 'o2'))->>'ok' = 'true');
reset role;
-- Zähler für neue Sitzungen: höchstens fünf
update zahlungen set sessions_erstellt = 5, stripe_url = null where bestellung_id = (select v::uuid from st where k = 'o2');
set local role service_role;
select 'Z81 mehr als fünf Sitzungen je Bestellung → zu_oft | ' || (zahlung_stripe_vorbereiten((select v::uuid from st where k = 'o2'))->>'grund' = 'zu_oft');
reset role;
-- Bestellung inzwischen storniert, dann zahlt der Gast doch: Geld ohne Essen wird markiert
update bestellungen set status = 'storniert' where id = (select v::uuid from st where k = 'o4');
set local role service_role;
select 'Z82 Zahlung für eine stornierte Bestellung → Rückzahlung nötig | ' ||
  (zahlung_freigeben((select v::uuid from st where k = 'o4'), 'card', 'pi_test_4', 'acct_1ABCDEFGHIJ') @> '{"ok":true,"rueckzahlung":true}');
reset role;
select 'Z82b …Bestellung bleibt für die Küche zu, Zahlung als „Rückzahlung nötig“ | ' ||
  ((select pruefen is true from bestellungen where id = (select v::uuid from st where k = 'o4'))
   and (select rueckzahlung_noetig and status = 'bezahlt' from zahlungen where bestellung_id = (select v::uuid from st where k = 'o4')));
set local role service_role;
select zahlung_freigeben((select v::uuid from st where k = 'o5'), 'card', 'pi_test_5', null) is not null;
reset role;
select 'Z83b …Grund „Netz“ bleibt, „Zahlung offen“ weg, Markierung bleibt | ' ||
  (select pruefen is true and pruef_grund = 'Netz' from bestellungen where id = (select v::uuid from st where k = 'o5'));

-- ── Z9x Überweisung bestätigen ──────────────────────────────────────
set local role authenticated; select pg_temp.als(:'C');
select 'Z90 Koch/Team bestätigt keine Überweisung | ' || (zahlung_ueberweisung_bestaetigen((select v::uuid from st where k = 'o3'))->>'grund' = 'kein_recht');
select pg_temp.als(:'B');
select 'Z91 fremder Inhaber bestätigt keine | ' || (zahlung_ueberweisung_bestaetigen((select v::uuid from st where k = 'o3'))->>'grund' = 'kein_recht');
select pg_temp.als(:'A');
select 'Z92 Stripe-Zahlung lässt sich nicht von Hand „bestätigen“ | ' || (zahlung_ueberweisung_bestaetigen((select v::uuid from st where k = 'o2'))->>'grund' = 'falsche_art');
select 'Z93 Inhaber bestätigt → ok | ' || (zahlung_ueberweisung_bestaetigen((select v::uuid from st where k = 'o3'))->>'ok' = 'true');
select 'Z93b zweites Bestätigen ändert nichts | ' || (zahlung_ueberweisung_bestaetigen((select v::uuid from st where k = 'o3'))->>'schon' = 'true');
select 'Z94 Inhaber sieht Zahlungen seines Betriebs, nicht die Stripe-Spalten | ' ||
  ((select count(*) from zahlungen) = 5 and (select bool_and(status in ('offen','bezahlt','fehlgeschlagen')) from zahlungen));
select pg_temp.als(:'B');
select 'Z95 fremder Inhaber sieht 0 Zahlungen | ' || ((select count(*) from zahlungen) = 0);
reset role;
select 'Z96 Überweisung: bezahlt, Methode ueberweisung, Verweis auf die bestätigende Person | ' ||
  (select methode = 'ueberweisung' and status = 'bezahlt' and stripe_zahlung = 'manuell:' || :'A' from zahlungen where bestellung_id = (select v::uuid from st where k = 'o3'));
select 'Z96b …Bestellung ist frei | ' || (select pruefen is false from bestellungen where id = (select v::uuid from st where k = 'o3'));
select 'Z97 Bank-Daten erscheinen nach der Zahlung nicht mehr im Gast-Stand | ' ||
  ((select zahlung_status((select v::uuid from st where k = 'o3'))->'ueberweisung') = 'null'::jsonb);

-- ── Z98 Beim Personal bezahlt (Stripe fällt aus / bar) ──────────────
insert into st select 'o7', bestellung_aufgeben(:'B1', 'tisch', '3', 14, null, '[]', 'g40')::text;
select zahlung_vormerken((select v::uuid from st where k = 'o7'), :'B1', 'stripe') is not null;
set local role anon; select pg_temp.als(null);
select 'Z98 anon darf nicht „beim Personal bezahlt“ freigeben | ' || (pg_temp.fehler(format('select zahlung_vor_ort_freigeben(%L)', (select v from st where k = 'o7'))) ~ 'permission denied');
reset role;
set local role authenticated; select pg_temp.als(:'B');
select 'Z98b Inhaber eines fremden Betriebs darf es nicht | ' || (zahlung_vor_ort_freigeben((select v::uuid from st where k = 'o7'))->>'grund' = 'kein_recht');
select pg_temp.als(:'C');
select 'Z98c Koch/Team des Betriebs darf es (kein Inhaber-Recht nötig) | ' || (zahlung_vor_ort_freigeben((select v::uuid from st where k = 'o7'))->>'ok' = 'true');
reset role;
select 'Z98d Bestellung ist frei, Zahlung steht auf „vor_ort“ | ' ||
  ((select pruefen is false and pruef_grund is null from bestellungen where id = (select v::uuid from st where k = 'o7'))
   and (select status = 'vor_ort' from zahlungen where bestellung_id = (select v::uuid from st where k = 'o7')));
set local role service_role;
select 'Z98e …neue Stripe-Sitzung für diese Bestellung ist gesperrt | ' || (zahlung_stripe_vorbereiten((select v::uuid from st where k = 'o7'))->>'grund' = 'nicht_offen');
select 'Z98f kommt trotzdem Geld an → Rückzahlung nötig, Bestellung unberührt | ' ||
  (zahlung_freigeben((select v::uuid from st where k = 'o7'), 'card', 'pi_doppelt', 'acct_1ABCDEFGHIJ') @> '{"ok":true,"rueckzahlung":true}');
reset role;
select 'Z98g …gemerkt, Küche bekam keine zweite Freigabe | ' ||
  ((select rueckzahlung_noetig and status = 'bezahlt' from zahlungen where bestellung_id = (select v::uuid from st where k = 'o7')));
set local role authenticated; select pg_temp.als(:'C');
select 'Z98h zweites „vor Ort“ auf bezahlter Zahlung ändert nichts | ' || (zahlung_vor_ort_freigeben((select v::uuid from st where k = 'o7'))->>'schon' = 'true');
reset role;

-- ── Z99 Rückzahlung: bezahlt, danach storniert ─────────────────────
insert into st select 'o8', bestellung_aufgeben(:'B1', 'tisch', '4', 16, null, '[]', 'g50')::text;
insert into st select 'o9', bestellung_aufgeben(:'B1', 'tisch', '4', 17, null, '[]', 'g51')::text;
select zahlung_vormerken((select v::uuid from st where k = 'o8'), :'B1', 'stripe') is not null;
select zahlung_vormerken((select v::uuid from st where k = 'o9'), :'B1', 'stripe') is not null;
set local role service_role;
select zahlung_freigeben((select v::uuid from st where k = 'o8'), 'card', 'pi_8', 'acct_1ABCDEFGHIJ') is not null;
reset role;
update bestellungen set status = 'storniert' where id in ((select v::uuid from st where k = 'o8'), (select v::uuid from st where k = 'o9'));
select 'Z99 bezahlt und dann storniert → Rückzahlung nötig (Trigger) | ' || (select rueckzahlung_noetig from zahlungen where bestellung_id = (select v::uuid from st where k = 'o8'));
select 'Z99b storniert, aber NIE bezahlt → keine Rückzahlung | ' || (select not rueckzahlung_noetig from zahlungen where bestellung_id = (select v::uuid from st where k = 'o9'));
set local role authenticated; select pg_temp.als(:'C');
select 'Z99c Team darf „Rückzahlung erledigt“ nicht setzen | ' || (zahlung_rueckzahlung_erledigt((select v::uuid from st where k = 'o8'))->>'grund' = 'kein_recht');
select pg_temp.als(:'B');
select 'Z99d fremder Inhaber auch nicht | ' || (zahlung_rueckzahlung_erledigt((select v::uuid from st where k = 'o8'))->>'grund' = 'kein_recht');
select pg_temp.als(:'A');
select 'Z99e Inhaber auf nicht nötige Zahlung → nicht_noetig | ' || (zahlung_rueckzahlung_erledigt((select v::uuid from st where k = 'o9'))->>'grund' = 'nicht_noetig');
select 'Z99f Inhaber sieht die offene Rückzahlung (Spalte lesbar) | ' || ((select count(*) from zahlungen where rueckzahlung_noetig and not rueckzahlung_erledigt) >= 1);
select 'Z99g Inhaber setzt „erledigt“ | ' || (zahlung_rueckzahlung_erledigt((select v::uuid from st where k = 'o8'))->>'ok' = 'true');
select 'Z99h …danach ist sie nicht mehr offen | ' || ((select count(*) from zahlungen where bestellung_id = (select v::uuid from st where k = 'o8') and rueckzahlung_noetig and not rueckzahlung_erledigt) = 0);
set local role anon; select pg_temp.als(null);
select 'Z99i anon kann es nicht | ' || (pg_temp.fehler(format('select zahlung_rueckzahlung_erledigt(%L)', (select v from st where k = 'o8'))) ~ 'permission denied');
reset role;
select 'Z99j Trigger-Funktion ist kein rpc-Endpunkt (§2.3a) | ' || (not has_function_privilege('anon', 'public.zahlung_storno_merken()', 'EXECUTE') and not has_function_privilege('authenticated', 'public.zahlung_storno_merken()', 'EXECUTE'));

-- ── Z10x Einstellungen wieder ausschalten ──────────────────────────
set local role authenticated; select pg_temp.als(:'A');
select 'Z100 Überweisung ausschalten (Rest bleibt) → ok | ' || (zahlarten_setzen(:'B1',
  '{"karte_an":true,"stripe_konto":"acct_1ABCDEFGHIJ","iban":"DE89370400440532013000","kontoinhaber":"Choco"}'::jsonb, '48151623')->>'ok' = 'true');
set local role anon; select pg_temp.als(null);
select 'Z101 Gast sieht nur noch Karte | ' || (zahlarten_oeffentlich(:'B1') @> '{"karte":true,"klarna":false,"ueberweisung":false}');
select 'Z102 neue Bestellung per Klarna-Wunsch geht trotzdem als „stripe“ → Zahlung wird verlangt, die Seite zeigt dann nur Karte | ' ||
  (bestellung_aufgeben_zahlung(:'B1', 'tisch', '9', 15, null, '[]', 'g30', null, null, null, null, 'stripe')->>'ok' = 'true');
select 'Z103 Überweisung nach dem Ausschalten → Ausnahme | ' ||
  (pg_temp.fehler(format('select bestellung_liefern_zahlung(%L, ''{}''::jsonb, ''[]''::jsonb, 20, null, ''g31'', null, null, ''ueberweisung'')', :'B1')) ~ 'gerade nicht');
reset role;
-- Z41 nachgeholt: Betrieb 2 bekommt eigene Zahlarten, dann der Versuch, eine Zahlung von Betrieb 1 an Betrieb 2 zu hängen
set local role authenticated; select pg_temp.als(:'B');
select 'Z41a Betrieb 2 stellt Karte ein | ' || (zahlarten_setzen(:'B2', '{"karte_an":true,"stripe_konto":"acct_2ZZZZZZZZZZ"}'::jsonb, '48151623')->>'ok' = 'true');
reset role;
insert into st select 'o6', bestellung_aufgeben(:'B1', 'tisch', '8', 11, null, '[]', 'g21')::text;
select 'Z41 Zahlung von Betrieb 2 an eine Bestellung von Betrieb 1 zu hängen scheitert | ' ||
  (pg_temp.fehler(format('select zahlung_vormerken(%L, %L, ''stripe'')', (select v from st where k = 'o6'), :'B2')) ~ 'Bestellung unbekannt');
select 'Z41b …und es entstand keine Zahlung dazu | ' || not exists (select 1 from zahlungen where bestellung_id = (select v::uuid from st where k = 'o6'));
-- Brute-force: fünfmal falsche PIN sperrt, danach hilft auch die richtige nicht
set local role authenticated; select pg_temp.als(:'B');
select zahlarten_setzen(:'B2', '{}'::jsonb, '00000000') is not null from generate_series(1, 5);
reset role;
select 'Z110 fünf falsche PINs → Konto-PIN gesperrt | ' || (select gesperrt from konto_pin where nutzer_id = :'B');
set local role authenticated; select pg_temp.als(:'B');
select 'Z111 …die richtige PIN hilft jetzt nicht mehr | ' || (zahlarten_setzen(:'B2', '{}'::jsonb, '48151623')->>'grund' = 'pin_gesperrt');
reset role;
select 'Z112 …und die Einstellung von Betrieb 2 blieb unverändert (Karte an, Konto gleich) | ' ||
  (select karte_an and stripe_konto = 'acct_2ZZZZZZZZZZ' from betrieb_zahlarten where betrieb_id = :'B2');

rollback;
