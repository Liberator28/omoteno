-- ═══════════════════════════════════════════════════════════════════
--  PRUEFUNG · Was darf der anonyme Gast, was darf ein Fremder
--
--  Einfuegen in den SQL-Editor von Supabase und ausfuehren. Die
--  Pruefung schreibt NICHTS: alles laeuft in einer Transaktion, die
--  am Ende zurueckgedreht wird.
--
--  Nach JEDER Aenderung an Rechten, Regeln oder Funktionen fahren.
--
--  Zwei Fallen, in die diese Pruefung schon gelaufen ist und die
--  deshalb hier ausdruecklich vermieden werden:
--
--   · „insert … returning id" scheitert am fehlenden SELECT-Recht,
--     nicht am INSERT. Das sah wie eine geschlossene Tuer aus,
--     obwohl sie offen stand. Hier wird ohne returning eingefuegt.
--   · Ein UPDATE, das durch RLS auf null Zeilen faellt, meldet
--     ERFOLG. Wer nur die Ausnahme abfaengt, meldet ein Leck, das
--     es nicht gibt. Hier wird die Zeilenzahl gemessen.
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(nr int, wer text, was text, ergebnis text);
grant insert on probe to anon, authenticated;

-- ═══ TEIL 1 · Der anonyme Gast ═══
set local role anon;
do $$
declare v uuid; s text; nm text; n int; v_id uuid;
begin
  select id, slug, name into v, s, nm from betriebe limit 1;

  -- Angriffe: jede Zeile MUSS „abgewiesen" sagen
  begin insert into bestellungen (betrieb_id,quelle,status,summe,tisch_bestaetigt)
        values (v,'tisch','neu',0.01,true);
    insert into probe values (1,'Gast','Bestellung am Preiswaechter vorbei','OFFEN !!!');
  exception when others then insert into probe values (1,'Gast','Bestellung am Preiswaechter vorbei','abgewiesen'); end;

  begin update betriebe_oeffentlich set bestell_pause=true;
    insert into probe values (2,'Gast','allen Betrieben die Bestellung abschalten','OFFEN !!!');
  exception when others then insert into probe values (2,'Gast','allen Betrieben die Bestellung abschalten','abgewiesen'); end;

  begin update betriebe_oeffentlich set slug='kaputt';
    insert into probe values (3,'Gast','jeden Hub per slug zerreissen','OFFEN !!!');
  exception when others then insert into probe values (3,'Gast','jeden Hub per slug zerreissen','abgewiesen'); end;

  begin select count(*) into n from gaeste;
    insert into probe values (4,'Gast','Gast-E-Mail-Adressen abziehen','OFFEN !!! '||n);
  exception when others then insert into probe values (4,'Gast','Gast-E-Mail-Adressen abziehen','abgewiesen'); end;

  begin select count(*) into n from gutscheine;
    insert into probe values (5,'Gast','Gutscheincodes abziehen','OFFEN !!! '||n);
  exception when others then insert into probe values (5,'Gast','Gutscheincodes abziehen','abgewiesen'); end;

  begin insert into servicerufe (betrieb_id,tisch,grund,erledigt) values (v,'7','x',false);
    insert into probe values (6,'Gast','Serviceruf-Spam','OFFEN !!!');
  exception when others then insert into probe values (6,'Gast','Serviceruf-Spam','abgewiesen'); end;

  begin delete from aktionen;
    insert into probe values (7,'Gast','fremde Aktionen loeschen','OFFEN !!!');
  exception when others then insert into probe values (7,'Gast','fremde Aktionen loeschen','abgewiesen'); end;

  begin perform melde_neue_bestellung();
    insert into probe values (8,'Gast','Meldefunktion direkt rufen (HTTP nach draussen)','OFFEN !!!');
  exception when others then insert into probe values (8,'Gast','Meldefunktion direkt rufen','abgewiesen'); end;

  begin select count(*) into n from bestellungen;
    insert into probe values (9,'Gast','fremde Bestellungen mitlesen','OFFEN !!! '||n);
  exception when others then insert into probe values (9,'Gast','fremde Bestellungen mitlesen','abgewiesen'); end;

  begin select count(*) into n from tische;
    insert into probe values (10,'Gast','Tischschluessel abziehen','OFFEN !!! '||n);
  exception when others then insert into probe values (10,'Gast','Tischschluessel abziehen','abgewiesen'); end;

  -- Ehrliche Wege: jede Zeile MUSS „ok" sagen
  begin select count(*) into n from betriebe;
    insert into probe values (20,'Gast','Kopfdaten des Hauses lesen','ok, '||n);
  exception when others then insert into probe values (20,'Gast','Kopfdaten lesen','KAPUTT: '||sqlerrm); end;
  begin select count(*) into n from gerichte;
    insert into probe values (21,'Gast','Speisekarte lesen','ok, '||n||' Gerichte');
  exception when others then insert into probe values (21,'Gast','Speisekarte lesen','KAPUTT: '||sqlerrm); end;
  begin select count(*) into n from aktionen;
    insert into probe values (22,'Gast','laufende Aktionen lesen','ok, '||n);
  exception when others then insert into probe values (22,'Gast','Aktionen lesen','KAPUTT: '||sqlerrm); end;
  begin select count(*) into n from betriebe_oeffentlich;
    insert into probe values (23,'Gast','Sicht betriebe_oeffentlich lesen','ok, '||n);
  exception when others then insert into probe values (23,'Gast','Sicht lesen','KAPUTT: '||sqlerrm); end;
  begin v_id := bestellung_aufgeben(v,'tisch','7',0,'Pruefung','[]'::jsonb);
    insert into probe values (24,'Gast','bestellen (der richtige Weg)','ok');
  exception when others then insert into probe values (24,'Gast','bestellen','KAPUTT: '||sqlerrm); end;
  begin perform bestellung_status(v_id);
    insert into probe values (25,'Gast','Bestellpass abfragen','ok');
  exception when others then insert into probe values (25,'Gast','Bestellpass','KAPUTT: '||sqlerrm); end;
  begin perform gast_melden(s,'pruef-kennung-12345');
    insert into probe values (26,'Gast','Gastkonto melden','ok');
  exception when others then insert into probe values (26,'Gast','Gastkonto','KAPUTT: '||sqlerrm); end;
  begin perform gast_mail_merken(s,'pruef-kennung-12345','pruef@example.org');
    insert into probe values (27,'Gast','E-Mail hinterlegen','ok');
  exception when others then insert into probe values (27,'Gast','E-Mail hinterlegen','KAPUTT: '||sqlerrm); end;
  begin insert into reservierungen (betrieb_id,status,name,wunsch,personen)
        values (v,'offen','Pruefung',now()+interval '2 days',2);
    insert into probe values (28,'Gast','Tisch reservieren','ok');
  exception when others then insert into probe values (28,'Gast','reservieren','KAPUTT: '||sqlerrm); end;
  begin insert into ereignisse (betrieb_id,betrieb,art,inhalt) values (v,nm,'pruefung','{}'::jsonb);
    insert into probe values (29,'Gast','Ereignis melden','ok');
  exception when others then insert into probe values (29,'Gast','Ereignis','KAPUTT: '||sqlerrm); end;
  begin perform slug_frei('irgendeinname');
    insert into probe values (30,'Konto','slug_frei pruefen','ok');
  exception when others then insert into probe values (30,'Konto','slug_frei','KAPUTT: '||sqlerrm); end;
end $$;
reset role;

-- ═══ TEIL 2 · Ein Angemeldeter, der Mitglied von NICHTS ist ═══
-- Rollenwechsel allein reicht nicht — PostgREST setzt auch die
-- Ansprueche im Token (CLAUDE.md 2.4).
--
-- Vorher ein echter Gutschein, NOCH als Standardrolle angelegt: Die
-- Tabelle ist sonst leer, und „0 Zeilen beendet / nichts sichtbar"
-- (Nr. 58/59) waere auch ohne jede Regel wahr — wo nie etwas war, ist
-- auch nichts zu sehen (CLAUDE.md §8.1g, Vorfall C).
insert into gutscheine (betrieb_id, titel, code)
  values ((select id from betriebe limit 1), 'Pruef-Rechte-Gutschein', 'PRUEF-RECHTE-GS');
select set_config('request.jwt.claims',
  json_build_object('sub','00000000-0000-4000-8000-000000000001',
                    'role','authenticated')::text, true);
set local role authenticated;
do $$
declare n int;
begin
  begin select count(*) into n from bestellungen;
    insert into probe values (40,'Fremder','fremde Bestellungen lesen',
      case when n=0 then 'nichts sichtbar' else 'LECK !!! '||n end);
  exception when others then insert into probe values (40,'Fremder','Bestellungen','abgewiesen'); end;
  begin select count(*) into n from betriebe;
    insert into probe values (41,'Fremder','fremde Betriebe lesen',
      case when n=0 then 'nichts sichtbar' else 'LECK !!! '||n end);
  exception when others then insert into probe values (41,'Fremder','Betriebe','abgewiesen'); end;
  begin select count(*) into n from gaeste;
    insert into probe values (42,'Fremder','Gastdaten lesen',
      case when n=0 then 'nichts sichtbar' else 'LECK !!! '||n end);
  exception when others then insert into probe values (42,'Fremder','Gaeste','abgewiesen'); end;
  begin select count(*) into n from tische;
    insert into probe values (43,'Fremder','Tischschluessel lesen',
      case when n=0 then 'nichts sichtbar' else 'LECK !!! '||n end);
  exception when others then insert into probe values (43,'Fremder','Tische','abgewiesen'); end;
  begin select count(*) into n from rechnungen;
    insert into probe values (44,'Fremder','Rechnungen lesen',
      case when n=0 then 'nichts sichtbar' else 'LECK !!! '||n end);
  exception when others then insert into probe values (44,'Fremder','Rechnungen','abgewiesen'); end;
  begin select count(*) into n from anfragen;
    insert into probe values (45,'Fremder','Anfragen mit E-Mail/Telefon lesen',
      case when n=0 then 'nichts sichtbar' else 'LECK !!! '||n end);
  exception when others then insert into probe values (45,'Fremder','Anfragen','abgewiesen'); end;
  begin select count(*) into n from push_geraete;
    insert into probe values (46,'Fremder','Push-Schluessel lesen',
      case when n=0 then 'nichts sichtbar' else 'LECK !!! '||n end);
  exception when others then insert into probe values (46,'Fremder','Push-Geraete','abgewiesen'); end;
  begin select count(*) into n from master_umsaetze;
    insert into probe values (47,'Fremder','Master-Umsaetze lesen',
      case when n=0 then 'nichts sichtbar' else 'LECK !!! '||n end);
  exception when others then insert into probe values (47,'Fremder','Master-Umsaetze','abgewiesen'); end;

  -- Schreiben: die ZEILENZAHL entscheidet, nicht die Ausnahme
  begin update betriebe set name='GEKAPERT'; get diagnostics n = row_count;
    insert into probe values (50,'Fremder','fremden Betrieb umbenennen',
      case when n=0 then 'RLS haelt (0 Zeilen)' else 'LECK !!! '||n end);
  exception when others then insert into probe values (50,'Fremder','fremden Betrieb umbenennen','abgewiesen'); end;
  begin update gerichte set preis=0.01; get diagnostics n = row_count;
    insert into probe values (51,'Fremder','fremde Preise aendern',
      case when n=0 then 'RLS haelt (0 Zeilen)' else 'LECK !!! '||n end);
  exception when others then insert into probe values (51,'Fremder','fremde Preise aendern','abgewiesen'); end;
  begin update bestellungen set status='fertig'; get diagnostics n = row_count;
    insert into probe values (52,'Fremder','fremde Bestellungen umstellen',
      case when n=0 then 'RLS haelt (0 Zeilen)' else 'LECK !!! '||n end);
  exception when others then insert into probe values (52,'Fremder','fremde Bestellungen umstellen','abgewiesen'); end;
  begin update tische set schluessel='AAAAAAAA'; get diagnostics n = row_count;
    insert into probe values (53,'Fremder','fremde Tischcodes ueberschreiben',
      case when n=0 then 'RLS haelt (0 Zeilen)' else 'LECK !!! '||n end);
  exception when others then insert into probe values (53,'Fremder','fremde Tischcodes ueberschreiben','abgewiesen'); end;
  begin delete from bestellungen; get diagnostics n = row_count;
    insert into probe values (54,'Fremder','fremde Bestellungen loeschen',
      case when n=0 then 'RLS haelt (0 Zeilen)' else 'LECK !!! '||n end);
  exception when others then insert into probe values (54,'Fremder','fremde Bestellungen loeschen','abgewiesen'); end;
  begin insert into betrieb_mitglieder (betrieb_id,nutzer_id,rolle)
        values ((select id from betriebe limit 1),'00000000-0000-4000-8000-000000000001','inhaber');
    insert into probe values (55,'Fremder','sich in fremden Betrieb eintragen','LECK !!!');
  exception when others then insert into probe values (55,'Fremder','sich in fremden Betrieb eintragen','abgewiesen'); end;
  begin insert into gerichte (betrieb_id,name,preis,kategorie,verfuegbar)
        values ((select id from betriebe limit 1),'Untergeschoben',0,'X',true);
    insert into probe values (56,'Fremder','Gericht in fremde Karte schieben','LECK !!!');
  exception when others then insert into probe values (56,'Fremder','Gericht in fremde Karte schieben','abgewiesen'); end;
  -- Gutscheine legt das Board jetzt direkt an (kein Server-Weg):
  -- ein Fremder darf weder in ein fremdes Haus schreiben noch dort
  -- einen Gutschein beenden oder lesen.
  begin insert into gutscheine (betrieb_id,titel,code)
        values ((select id from betriebe limit 1),'Untergeschoben','FREMD-GUTSCHEIN');
    insert into probe values (57,'Fremder','Gutschein in fremdes Haus schreiben','LECK !!!');
  exception when others then insert into probe values (57,'Fremder','Gutschein in fremdes Haus schreiben','abgewiesen'); end;
  begin update gutscheine set gueltig_bis=now(); get diagnostics n = row_count;
    insert into probe values (58,'Fremder','fremde Gutscheine beenden',
      case when n=0 then 'RLS haelt (0 Zeilen)' else 'LECK !!! '||n end);
  exception when others then insert into probe values (58,'Fremder','fremde Gutscheine beenden','abgewiesen'); end;
  begin select count(*) into n from gutscheine;
    insert into probe values (59,'Fremder','fremde Gutscheincodes lesen',
      case when n=0 then 'nichts sichtbar' else 'LECK !!! '||n end);
  exception when others then insert into probe values (59,'Fremder','Gutscheine lesen','abgewiesen'); end;
end $$;
reset role;

-- ═══ TEIL 3 · rabattcodes / rechnung_rabattieren / rabattcode_anlegen ═══
-- Braucht migration-rechnung-rabatt.sql. Lokal gegen ein nachgebildetes
-- Mindestschema bereits durchgespielt (siehe Kommentar dort) — hier
-- dieselben Faelle gegen den ECHTEN, gewachsenen Bestand.
do $$ begin
  if to_regclass('public.rabattcodes') is null then
    insert into probe values (60,'—','TEIL 3 uebersprungen','migration-rechnung-rabatt.sql noch nicht eingespielt');
  end if;
end $$;

set local role anon;
do $$ begin
  begin perform count(*) from rabattcodes;
    insert into probe values (60,'Gast','Rabattcodes lesen','OFFEN !!!');
  exception when others then insert into probe values (60,'Gast','Rabattcodes lesen','abgewiesen'); end;
  begin perform rabattcode_anlegen((select id from betriebe limit 1),'X',1,null,null);
    insert into probe values (61,'Gast','rabattcode_anlegen aufrufen','OFFEN !!!');
  exception when others then insert into probe values (61,'Gast','rabattcode_anlegen aufrufen','abgewiesen'); end;
end $$;
reset role;

select set_config('request.jwt.claims',
  json_build_object('sub','00000000-0000-4000-8000-000000000001',
                    'role','authenticated')::text, true);
set local role authenticated;
do $$
declare n int; r jsonb; v_bestellung uuid;
begin
  begin select count(*) into n from rabattcodes;
    insert into probe values (62,'Fremder','fremde Rabattcodes lesen',
      case when n=0 then 'nichts sichtbar' else 'LECK !!! '||n end);
  exception when others then insert into probe values (62,'Fremder','Rabattcodes lesen','abgewiesen'); end;

  begin perform rabattcode_anlegen((select id from betriebe limit 1),'PROBE-FREMD',1,null,null);
    insert into probe values (63,'Fremder','rabattcode_anlegen aufrufen','LECK !!!');
  exception when others then insert into probe values (63,'Fremder','rabattcode_anlegen aufrufen','abgewiesen'); end;

  -- rechnung_rabattieren wirft NICHT — sie antwortet mit {ok:false,...}.
  -- Wer nur die Ausnahme abfaengt, misst hier gar nichts (CLAUDE.md §2.3b).
  select id into v_bestellung from bestellungen limit 1;
  if v_bestellung is not null then
    r := rechnung_rabattieren(v_bestellung, 'IRGENDEIN-CODE');
    insert into probe values (64,'Fremder','rechnung_rabattieren auf fremde Bestellung',
      case when (r->>'ok')::boolean is true then 'LECK !!! ' || r::text
           else 'abgewiesen: ' || (r->>'grund') end);
  else
    insert into probe values (64,'—','rechnung_rabattieren-Probe uebersprungen','keine Bestellung vorhanden');
  end if;
end $$;
reset role;

-- ═══ TEIL 4 · Aktionspreise und Gast-Rabattcode in bestellung_aufgeben ═══
-- migration-aktionspreis-pruefen.sql: bestellung_aufgeben rechnet jetzt
-- aktionen mit und kennt einen optionalen p_rabattcode. Angriffe: der
-- Gast darf nie WENIGER zahlen, als Aktion/Code wirklich hergeben.
--
-- Die Testdaten (Aktion, Gericht, Rabattcode) legt der Betrieb selbst
-- an, nicht der Gast — deshalb NOCH ALS STANDARDROLLE eingefuegt,
-- bevor auf anon umgeschaltet wird. Sonst wuerde diese Pruefung genau
-- die Schreibsperre pruefen, die TEIL 1 (Zeile 57) schon fuer
-- 'delete from aktionen' bestaetigt — anon darf hier gar nichts
-- einfuegen, und die Probe wuerde nie zu den eigentlichen Angriffen
-- kommen.
--
-- Die Token-Ansprüche aus TEIL 3 gelten sonst weiter (set_config mit
-- true gilt für die ganze Transaktion, nicht nur für den Block).
-- aktionen.angelegt_von kommt aus auth.uid() — mit dem erfundenen
-- Fremden darin brach der ganze Lauf an einem Fremdschlüssel ab, und
-- TEIL 4 lief in dieser Datei nie am Stück.
select set_config('request.jwt.claims', '', true);
do $$
declare v uuid;
begin
  select id into v from betriebe limit 1;
  insert into aktionen (betrieb_id, gericht_name, titel, preis_alt, preis_neu, von, bis, aktiv)
  values (v, 'Pruef-Rechte-Aktionsgericht', 'Probe', 99.00, 5.00, now() - interval '1 hour', now() + interval '1 hour', true);
  insert into gerichte (betrieb_id, kategorie, name, preis, verfuegbar)
  values (v, 'Pruefung', 'Pruef-Rechte-Aktionsgericht', 99.00, true);
  insert into rabattcodes (betrieb_id, code, betrag, gueltig_bis)
  values (v, 'PRUEF-RECHTE-2', 2.00, now() + interval '1 day');
end $$;

set local role anon;
do $$
declare
  v uuid; v_id uuid; n int;
begin
  select id into v from betriebe limit 1;

  -- Angriff: unter dem Aktionspreis bestellen (0.01 statt 5.00)
  begin
    v_id := bestellung_aufgeben(v,'tisch','7',0.01,'Pruefung',
      '[{"name":"Pruef-Rechte-Aktionsgericht","menge":1}]'::jsonb);
    insert into probe values (70,'Gast','unter dem Aktionspreis bestellen','OFFEN !!!');
  exception when others then insert into probe values (70,'Gast','unter dem Aktionspreis bestellen','abgewiesen'); end;

  -- Ehrlicher Weg: genau zum Aktionspreis
  begin
    v_id := bestellung_aufgeben(v,'tisch','7',5.00,'Pruefung',
      '[{"name":"Pruef-Rechte-Aktionsgericht","menge":1}]'::jsonb);
    insert into probe values (71,'Gast','genau zum Aktionspreis bestellen','ok');
  exception when others then insert into probe values (71,'Gast','zum Aktionspreis bestellen','KAPUTT: '||sqlerrm); end;

  -- Angriff: einen erfundenen Rabattcode angeben
  begin
    v_id := bestellung_aufgeben(v,'tisch','7',0.01,'Pruefung',
      '[{"name":"Pruef-Rechte-Aktionsgericht","menge":1}]'::jsonb,
      null, null, null, null, 'PRUEF-RECHTE-ERFUNDEN');
    insert into probe values (72,'Gast','erfundenen Rabattcode angeben','OFFEN !!!');
  exception when others then insert into probe values (72,'Gast','erfundenen Rabattcode angeben','abgewiesen'); end;

  -- Angriff: gueltigen Code kennen, aber weniger zahlen als Aktion minus Code
  begin
    v_id := bestellung_aufgeben(v,'tisch','7',0.01,'Pruefung',
      '[{"name":"Pruef-Rechte-Aktionsgericht","menge":1}]'::jsonb,
      null, null, null, null, 'PRUEF-RECHTE-2');
    insert into probe values (73,'Gast','Aktion+Code, aber zu wenig zahlen','OFFEN !!!');
  exception when others then insert into probe values (73,'Gast','Aktion+Code, aber zu wenig zahlen','abgewiesen'); end;

  -- Ehrlicher Weg: Aktion (5.00) minus Code (2.00) = 3.00, korrekt gezahlt
  begin
    v_id := bestellung_aufgeben(v,'tisch','7',3.00,'Pruefung',
      '[{"name":"Pruef-Rechte-Aktionsgericht","menge":1}]'::jsonb,
      null, null, null, null, 'PRUEF-RECHTE-2');
    insert into probe values (74,'Gast','Aktion+Code, korrekt gezahlt (5-2=3)','ok');
  exception when others then insert into probe values (74,'Gast','Aktion+Code korrekt','KAPUTT: '||sqlerrm); end;

  -- Angriff: denselben Code ein zweites Mal einloesen
  begin
    v_id := bestellung_aufgeben(v,'tisch','7',3.00,'Pruefung',
      '[{"name":"Pruef-Rechte-Aktionsgericht","menge":1}]'::jsonb,
      null, null, null, null, 'PRUEF-RECHTE-2');
    insert into probe values (75,'Gast','Rabattcode ein zweites Mal einloesen','OFFEN !!!');
  exception when others then insert into probe values (75,'Gast','Rabattcode zweites Mal','abgewiesen'); end;
end $$;
reset role;

-- ═══ TEIL 5 · Bild-KI: gerichte.bild_frei und bild_auftraege ═══
-- Braucht migration-bild-ki.sql. bild_auftraege ist die Tür vor einem
-- Dienst, der pro Bild kostet: Wer dort eine Zeile anlegen darf, darf
-- Guthaben verbrauchen; wer Zeilen löschen oder zurückdatieren darf,
-- hebelt die Monatsgrenze aus.
--
-- Vorher eine echte Zeile, als Standardrolle — sonst hieße „Fremder
-- sieht 0 Zeilen" auch ohne jede Regel „0" (§8.1g, Vorfall C).
select set_config('request.jwt.claims', '', true);
do $$ begin
  if to_regclass('public.bild_auftraege') is null then
    insert into probe values (80,'—','TEIL 5 uebersprungen','migration-bild-ki.sql noch nicht eingespielt');
  else
    insert into bild_auftraege (betrieb_id, gericht_name)
      values ((select id from betriebe order by id limit 1), 'Pruef-Rechte-Bild');
  end if;
end $$;

set local role anon;
do $$ declare n int; begin
  if to_regclass('public.bild_auftraege') is null then return; end if;
  begin perform count(*) from bild_auftraege;
    insert into probe values (80,'Gast','Bildauftraege lesen','OFFEN !!!');
  exception when others then insert into probe values (80,'Gast','Bildauftraege lesen','abgewiesen'); end;
  begin insert into bild_auftraege (betrieb_id) values ((select id from betriebe_oeffentlich limit 1));
    insert into probe values (81,'Gast','Bildauftrag anlegen (Guthaben verbrauchen)','OFFEN !!!');
  exception when others then insert into probe values (81,'Gast','Bildauftrag anlegen','abgewiesen'); end;
  begin update gerichte set bild_frei = 'https://boese.example/x.png'; get diagnostics n = row_count;
    insert into probe values (82,'Gast','bild_frei ueberschreiben', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  exception when others then insert into probe values (82,'Gast','bild_frei ueberschreiben','abgewiesen'); end;
end $$;
reset role;

select set_config('request.jwt.claims',
  json_build_object('sub','00000000-0000-4000-8000-000000000001','role','authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  if to_regclass('public.bild_auftraege') is null then return; end if;
  select count(*) into n from bild_auftraege;
  insert into probe values (83,'Fremder','Bildauftraege anderer Betriebe sehen', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  begin insert into bild_auftraege (betrieb_id) values ((select id from betriebe order by id limit 1));
    insert into probe values (84,'Fremder','Bildauftrag fuer fremden Betrieb','OFFEN !!!');
  exception when others then insert into probe values (84,'Fremder','Bildauftrag fuer fremden Betrieb','abgewiesen'); end;
end $$;
reset role;

-- Ein echtes Mitglied: darf anlegen (sonst liefe die Edge Function nie),
-- aber weder loeschen noch zurueckdatieren.
select set_config('request.jwt.claims',
  json_build_object('sub',(select nutzer_id from betrieb_mitglieder order by nutzer_id limit 1)::text,'role','authenticated')::text, true);
set local role authenticated;
do $$ declare n int; v uuid; begin
  if to_regclass('public.bild_auftraege') is null then return; end if;
  select betrieb_id into v from betrieb_mitglieder where nutzer_id = auth.uid() limit 1;
  begin insert into bild_auftraege (betrieb_id, gericht_name) values (v, 'Pruef-Rechte-Bild');
    get diagnostics n = row_count;
    insert into probe values (85,'Mitglied','Bildauftrag fuer eigenen Betrieb', case when n = 1 then 'ok' else 'KAPUTT: '||n end);
  exception when others then insert into probe values (85,'Mitglied','Bildauftrag eigener Betrieb','KAPUTT: '||sqlerrm); end;
  begin delete from bild_auftraege where betrieb_id = v; get diagnostics n = row_count;
    insert into probe values (86,'Mitglied','Monatsgrenze durch Loeschen umgehen', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  exception when others then insert into probe values (86,'Mitglied','Monatsgrenze durch Loeschen umgehen','abgewiesen'); end;
  begin update bild_auftraege set erstellt_am = now() - interval '60 days' where betrieb_id = v; get diagnostics n = row_count;
    insert into probe values (87,'Mitglied','Monatsgrenze durch Zurueckdatieren umgehen', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  exception when others then insert into probe values (87,'Mitglied','Monatsgrenze durch Zurueckdatieren','abgewiesen'); end;
  begin update gerichte set bild_frei = 'http://unsicher.example/x.png' where betrieb_id = v;
    get diagnostics n = row_count;
    insert into probe values (88,'Mitglied','bild_frei ohne https',
      case when n = 0 then 'NICHT MESSBAR (Betrieb ohne Gerichte)' else 'OFFEN !!!' end);
  exception when others then insert into probe values (88,'Mitglied','bild_frei ohne https','abgewiesen'); end;
end $$;
reset role;

select nr, wer, was, ergebnis from probe order by nr;

-- Und der Bestand selbst: was darf anon ueberhaupt noch anfassen?
select c.relname as objekt,
       case when has_table_privilege('anon',c.oid,'SELECT') then 'lesen ' else '' end ||
       case when has_table_privilege('anon',c.oid,'INSERT') then 'schreiben ' else '' end ||
       case when has_table_privilege('anon',c.oid,'UPDATE') then 'aendern ' else '' end ||
       case when has_table_privilege('anon',c.oid,'DELETE') then 'loeschen ' else '' end as anon_darf
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v')
  and (has_table_privilege('anon',c.oid,'SELECT') or has_table_privilege('anon',c.oid,'INSERT')
    or has_table_privilege('anon',c.oid,'UPDATE') or has_table_privilege('anon',c.oid,'DELETE'))
order by c.relname;

rollback;
