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
declare v uuid; s text; nm text; n int; v_id uuid; v_hat uuid; v_pos jsonb; v_preis numeric;
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
  -- Seit migration-missbrauch.sql (26.09.) nimmt der Server keine leere
  -- Bestellung mehr an und rechnet den Preis aus der Karte. Der richtige
  -- Weg ist also: ein echtes, verfügbares Gericht zum Kartenpreis — aus
  -- einem Betrieb, der überhaupt eine Karte hat.
  begin
    select g.betrieb_id, jsonb_build_array(jsonb_build_object('name', g.name, 'menge', 1, 'preis', g.preis)), g.preis
      into v_hat, v_pos, v_preis
      from gerichte g where g.verfuegbar order by g.betrieb_id, g.id limit 1;
    v_id := bestellung_aufgeben(v_hat,'tisch','7',v_preis,'Pruefung',v_pos);
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

-- ═══ TEIL 3b · rabattcode_team_anlegen / rabattcode_beenden / GRANT-Fund ═══
-- Braucht migration-rabattcode-ziel.sql. Deckt permanent ab, was beim
-- Bau der Migration ad hoc gemessen wurde (Kommentar 1b dort): authenticated
-- hatte INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES auf rabattcodes,
-- RLS hielt (nur eine SELECT-Regel) — hier als Zeilenzahl gemessen, nicht
-- nur als Ausnahme (CLAUDE.md §2.3b).
do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='rabattcodes' and column_name='ziel_gericht_name')
  then
    insert into probe values (65,'—','TEIL 3b uebersprungen','migration-rabattcode-ziel.sql noch nicht eingespielt');
  end if;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub','00000000-0000-4000-8000-000000000001',
                    'role','authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; n int;
begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='rabattcodes' and column_name='ziel_gericht_name') then return; end if;

  r := rabattcode_team_anlegen((select id from betriebe limit 1), 'PROBE-FREMD-2', 5, null, null, null);
  insert into probe values (66,'Fremder','rabattcode_team_anlegen fuer fremden Betrieb',
    case when (r->>'ok')::boolean is true then 'LECK !!! ' || r::text else 'abgewiesen: '||(r->>'grund') end);

  r := rabattcode_beenden((select id from rabattcodes limit 1));
  insert into probe values (67,'Fremder','rabattcode_beenden auf fremden Code',
    case when (r->>'ok')::boolean is true then 'LECK !!! ' || r::text else 'abgewiesen: '||(r->>'grund') end);

  begin insert into rabattcodes (betrieb_id, code, betrag) values ((select id from betriebe limit 1), 'PROBE-DIREKT-FREMD', 1);
    get diagnostics n = row_count;
    insert into probe values (68,'Fremder','rabattcodes direkt beschreiben (GRANT-Fund)',
      case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  exception when others then insert into probe values (68,'Fremder','rabattcodes direkt beschreiben','abgewiesen'); end;
end $$;
reset role;

-- Ein echtes Mitglied: darf ueber die Funktionen anlegen/beenden, aber
-- NICHT mehr direkt auf der Tabelle schreiben — Zeilenzahl gemessen,
-- nicht nur die Ausnahme (CLAUDE.md §2.3b).
select set_config('request.jwt.claims',
  json_build_object('sub',(select nutzer_id from betrieb_mitglieder order by nutzer_id limit 1)::text,'role','authenticated')::text, true);
set local role authenticated;
do $$
declare v uuid; v_gericht uuid; r jsonb; n int; v_id uuid;
begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='rabattcodes' and column_name='ziel_gericht_name') then return; end if;
  select betrieb_id into v from betrieb_mitglieder where nutzer_id = auth.uid() limit 1;
  select id into v_gericht from gerichte where betrieb_id = v limit 1;

  r := rabattcode_team_anlegen(v, 'PROBE-MITGLIED-OK', null, 15, v_gericht, null);
  insert into probe values (69,'Mitglied','rabattcode_team_anlegen fuer eigenen Betrieb, mit Ziel-Gericht',
    case when (r->>'ok')::boolean is true then 'ok' else 'KAPUTT: '||(r->>'grund') end);

  begin insert into rabattcodes (betrieb_id, code, betrag) values (v, 'PROBE-MITGLIED-DIREKT', 1);
    get diagnostics n = row_count;
    insert into probe values (76,'Mitglied','rabattcodes direkt beschreiben trotz eigenem Betrieb (GRANT-Fund)',
      case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  exception when others then insert into probe values (76,'Mitglied','rabattcodes direkt beschreiben trotz eigenem Betrieb','abgewiesen'); end;

  begin update rabattcodes set eingeloest = true where betrieb_id = v; get diagnostics n = row_count;
    insert into probe values (77,'Mitglied','rabattcodes direkt aendern trotz eigenem Betrieb (GRANT-Fund)',
      case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  exception when others then insert into probe values (77,'Mitglied','rabattcodes direkt aendern trotz eigenem Betrieb','abgewiesen'); end;

  -- Ziel-Gericht, das in KEINER Bestellung steht: darf die ganze
  -- Rechnung nicht heimlich rabattieren — der eigentliche Anlass der
  -- Migration (CLAUDE.md-Muster: erst gegen die echten Daten pruefen).
  select id into v_id from bestellungen where betrieb_id = v limit 1;
  if v_id is not null and v_gericht is not null then
    r := rechnung_rabattieren(v_id, 'PROBE-MITGLIED-OK');
    insert into probe values (78,'Mitglied','rechnung_rabattieren mit Ziel-Gericht, das nicht bestellt wurde',
      case when (r->>'grund') = 'produkt_nicht_bestellt' then 'abgewiesen: produkt_nicht_bestellt'
           when (r->>'ok')::boolean is true then 'LECK !!! rabattiert ohne bestelltes Ziel: '||r::text
           else 'unklar: '||r::text end);
  else
    insert into probe values (78,'—','Ziel-Gericht-Probe uebersprungen','kein Gericht oder keine Bestellung vorhanden');
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

-- ═══ TEIL 6 · Umsatzziele: betriebe.ziele (migration-auswertung-ziele.sql) ═══
-- Die Schranke ruft betriebe_ziele_gueltig mit den Rechten dessen, der
-- die ZEILE aendert (CLAUDE.md §2.7). Deshalb zuerst: Das Team aendert
-- eine ANDERE Spalte — dort zeigt sich ein fehlendes EXECUTE.
-- Ob die Spalte da ist, wird EINMAL in der Standardrolle gefragt:
-- information_schema zeigt jeder Rolle nur die Spalten, auf die sie
-- ein Recht hat. Als anon ist ziele dort also unsichtbar — genau weil
-- die Migration wirkt. Die anon-Proben 96/97 hielten die Migration
-- deshalb im ersten Lauf am Stueck fuer „nicht eingespielt“ und
-- schrieben gar keine Zeile (§8.1g, Vorfall C).
select set_config('probe.ziele', (exists (select 1 from information_schema.columns
  where table_schema='public' and table_name='betriebe' and column_name='ziele'))::text, true);
do $$ begin
  if current_setting('probe.ziele') <> 'true' then
    insert into probe values (90,'—','TEIL 6 uebersprungen','migration-auswertung-ziele.sql noch nicht eingespielt');
  end if;
end $$;
-- Eigener und FREMDER Betrieb werden VOR dem Rollenwechsel bestimmt:
-- Als Mitglied verbirgt die RLS die fremden Betriebe schon beim Lesen,
-- „fremd“ bliebe leer und Nr. 95 hiesse immer „nicht messbar“ — beim
-- ersten Lauf gegen den echten Bestand genau so passiert (§8.1g).
select set_config('probe.nutzer', (select m.nutzer_id from betrieb_mitglieder m
     where not exists (select 1 from master_konten k where k.benutzer_id = m.nutzer_id)
     order by m.nutzer_id limit 1)::text, true);
select set_config('probe.eigen', (select betrieb_id::text from betrieb_mitglieder
     where nutzer_id::text = current_setting('probe.nutzer') limit 1), true);
select set_config('probe.fremd', coalesce((select id::text from betriebe where id not in
     (select betrieb_id from betrieb_mitglieder where nutzer_id::text = current_setting('probe.nutzer'))
     order by id limit 1), ''), true);
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('probe.nutzer'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare n int; eigen uuid; fremd uuid; v text; begin
  if current_setting('probe.ziele') <> 'true' then return; end if;
  eigen := nullif(current_setting('probe.eigen'), '')::uuid;
  fremd := nullif(current_setting('probe.fremd'), '')::uuid;
  begin update betriebe set name = name where id = eigen; get diagnostics n = row_count;
    insert into probe values (90,'Mitglied','andere Spalte (name) aendern trotz Ziel-Schranke', case when n = 1 then 'ok' else 'KAPUTT: '||n end);
  exception when others then insert into probe values (90,'Mitglied','andere Spalte trotz Ziel-Schranke','KAPUTT: '||sqlerrm); end;
  update betriebe set ziele = '{"tag":450,"woche":2800}' where id = eigen; get diagnostics n = row_count;
  select ziele->>'woche' into v from betriebe where id = eigen;
  insert into probe values (91,'Mitglied','Ziele setzen und zuruecklesen', case when n = 1 and v = '2800' then 'ok' else 'KAPUTT: '||n||' / '||coalesce(v,'null') end);
  begin update betriebe set ziele = '{"tag":-5}' where id = eigen;
    insert into probe values (92,'Mitglied','negatives Ziel','OFFEN !!!');
  exception when check_violation then insert into probe values (92,'Mitglied','negatives Ziel','abgewiesen'); end;
  begin update betriebe set ziele = '{"jahr":5}' where id = eigen;
    insert into probe values (93,'Mitglied','fremder Schluessel im Ziel','OFFEN !!!');
  exception when check_violation then insert into probe values (93,'Mitglied','fremder Schluessel im Ziel','abgewiesen'); end;
  begin update betriebe set ziele = '{"tag":"450"}' where id = eigen;
    insert into probe values (94,'Mitglied','Ziel als Zeichenkette','OFFEN !!!');
  exception when check_violation then insert into probe values (94,'Mitglied','Ziel als Zeichenkette','abgewiesen'); end;
  update betriebe set ziele = '{"tag":1}' where id = fremd; get diagnostics n = row_count;
  insert into probe values (95,'Mitglied','Ziele eines FREMDEN Betriebs', case when fremd is null then 'NICHT MESSBAR (es gibt nur einen Betrieb)'
    when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
end $$;
reset role;
set local role anon;
do $$ declare n int; begin
  if current_setting('probe.ziele') <> 'true' then return; end if;
  begin perform ziele from betriebe limit 1; insert into probe values (96,'anon','Umsatzziele lesen','OFFEN !!!');
  exception when insufficient_privilege then insert into probe values (96,'anon','Umsatzziele lesen','abgewiesen'); end;
  begin update betriebe set ziele = '{"tag":1}'; get diagnostics n = row_count;
    insert into probe values (97,'anon','Umsatzziele schreiben','KEINE Ausnahme, '||n||' Zeilen');
  exception when insufficient_privilege then insert into probe values (97,'anon','Umsatzziele schreiben','abgewiesen'); end;
end $$;
reset role;

-- ═══ TEIL 8 · Rollen: Besitzer, Team (migration-rollen.sql) ═══
-- VOR Teil 7: Teil 7 schaltet die PIN-Pflicht ein, danach sähe das
-- Probe-Team ohne PIN gar nichts — jede Probe hieße „0 Zeilen“, und das
-- sähe aus wie „hält“ (§8.1g C). Deshalb auch die Voraussetzungen zuerst.
-- Voraussetzungen VOR dem Rollenwechsel bestimmen (§2.3b): ein Betrieb
-- mit Inhaber und ohne PIN-Pflicht, dessen Inhaber, ein echtes Konto,
-- das dort NICHT Mitglied ist (wird testweise 'team'), ein fremder
-- Betrieb. Probegericht und Probegutschein legt postgres an — so hängt
-- nichts am Bestand.
select set_config('probe.rollen', (select (count(*) > 0)::text from pg_proc
   where proname = 'ist_inhaber' and pronamespace = 'public'::regnamespace), true);
select set_config('probe.r_haus', coalesce((select b.id::text from betriebe b
   join betrieb_mitglieder m on m.betrieb_id = b.id and m.rolle = 'inhaber'
   where b.pin_pflicht is not true order by b.id limit 1), ''), true);
select set_config('probe.r_inhaber', coalesce((select m.nutzer_id::text from betrieb_mitglieder m
   where m.betrieb_id::text = current_setting('probe.r_haus') and m.rolle = 'inhaber' order by m.nutzer_id limit 1), ''), true);
select set_config('probe.r_team', coalesce((select u.id::text from auth.users u
   where u.id not in (select nutzer_id from betrieb_mitglieder where betrieb_id::text = current_setting('probe.r_haus'))
     and u.id not in (select benutzer_id from master_konten)
   order by u.id limit 1), ''), true);
select set_config('probe.r_fremd', coalesce((select id::text from betriebe
   where id::text <> current_setting('probe.r_haus') order by id limit 1), ''), true);
do $$ begin
  if current_setting('probe.rollen') <> 'true' then
    insert into probe values (120,'—','TEIL 8 uebersprungen','migration-rollen.sql noch nicht eingespielt');
  elsif current_setting('probe.r_haus') = '' or current_setting('probe.r_team') = '' then
    insert into probe values (120,'—','TEIL 8 nicht messbar','kein Betrieb ohne PIN-Pflicht oder kein freies Konto');
  else
    insert into betrieb_mitglieder(betrieb_id, nutzer_id, rolle)
      values (current_setting('probe.r_haus')::uuid, current_setting('probe.r_team')::uuid, 'team');
    insert into gerichte(betrieb_id, name, preis, karte, kategorie)
      values (current_setting('probe.r_haus')::uuid, 'Probe-Rolle', 5, 'speisekarte', 'Probe');
    insert into gutscheine(betrieb_id, titel, code)
      values (current_setting('probe.r_haus')::uuid, 'Probe', 'PROBE-ROLLE-1');
  end if;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('probe.r_team'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare n int; h uuid; ok boolean; begin
  if current_setting('probe.rollen') <> 'true' or current_setting('probe.r_team') = '' or current_setting('probe.r_haus') = '' then return; end if;
  h := current_setting('probe.r_haus')::uuid;
  -- Voraussetzung: das Team SIEHT Betrieb, Gericht und Gutschein. Ohne
  -- das hieße jedes „0 Zeilen“ unten nur „nichts gefunden“.
  ok := public.meine_rolle(h) = 'team'
    and exists (select 1 from gerichte where betrieb_id = h and name = 'Probe-Rolle')
    and exists (select 1 from gutscheine where betrieb_id = h and code = 'PROBE-ROLLE-1');
  insert into probe values (121,'Team','Voraussetzung: Rolle team, sieht Gericht und Gutschein', case when ok then 'ok' else 'KAPUTT (Folgeproben ohne Aussage)' end);
  if not ok then return; end if;
  begin update betriebe set hub_texte = coalesce(hub_texte,'{}') || '{"slogan":"Probe"}' where id = h; get diagnostics n = row_count;
    insert into probe values (122,'Team','Hub-Text aendern', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  exception when insufficient_privilege then insert into probe values (122,'Team','Hub-Text aendern','abgewiesen (Wache)'); end;
  begin update betriebe set bestell_pause_text = 'Probe' where id = h; get diagnostics n = row_count;
    insert into probe values (123,'Team','Pausentext (andere Spalte derselben Zeile, §2.7)', case when n = 1 then 'ok' else 'KAPUTT: '||n end);
  exception when others then insert into probe values (123,'Team','Pausentext (andere Spalte derselben Zeile, §2.7)','KAPUTT: '||sqlerrm); end;
  begin update gerichte set preis = preis + 1 where betrieb_id = h and name = 'Probe-Rolle'; get diagnostics n = row_count;
    insert into probe values (124,'Team','Preis aendern', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  exception when insufficient_privilege then insert into probe values (124,'Team','Preis aendern','abgewiesen (Wache)'); end;
  begin update gerichte set verfuegbar = false where betrieb_id = h and name = 'Probe-Rolle'; get diagnostics n = row_count;
    insert into probe values (125,'Team','Ausverkauft setzen', case when n = 1 then 'ok' else 'KAPUTT: '||n end);
  exception when others then insert into probe values (125,'Team','Ausverkauft setzen','KAPUTT: '||sqlerrm); end;
  begin insert into gerichte(betrieb_id, name, preis, karte, kategorie) values (h, 'Probe-Team', 1, 'speisekarte', 'Probe');
    insert into probe values (126,'Team','Gericht anlegen','OFFEN !!!');
  exception when insufficient_privilege then insert into probe values (126,'Team','Gericht anlegen','abgewiesen'); end;
  delete from gerichte where betrieb_id = h and name = 'Probe-Rolle'; get diagnostics n = row_count;
  insert into probe values (127,'Team','Gericht loeschen', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  begin insert into aktionen(betrieb_id, gericht_name, preis_alt, preis_neu, von, bis) values (h, 'Probe-Rolle', 5, 4, now(), now() + interval '1 hour');
    insert into probe values (128,'Team','Aktion anlegen','OFFEN !!!');
  exception when insufficient_privilege then insert into probe values (128,'Team','Aktion anlegen','abgewiesen'); end;
  begin insert into gutscheine(betrieb_id, titel, code) values (h, 'Probe', 'PROBE-ROLLE-2');
    insert into probe values (129,'Team','Gutschein direkt anlegen','OFFEN !!!');
  exception when insufficient_privilege then insert into probe values (129,'Team','Gutschein direkt anlegen','abgewiesen'); end;
  update gutscheine set titel = 'geaendert' where betrieb_id = h and code = 'PROBE-ROLLE-1'; get diagnostics n = row_count;
  insert into probe values (130,'Team','vorhandenen Gutschein aendern', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  begin insert into storage.objects(bucket_id, name) values ('gerichte', h::text||'/probe-team.webp');
    insert into probe values (131,'Team','Bild hochladen','OFFEN !!!');
  exception when insufficient_privilege then insert into probe values (131,'Team','Bild hochladen','abgewiesen'); end;
  begin insert into bild_auftraege(betrieb_id, gericht_name) values (h, 'Probe');
    insert into probe values (132,'Team','Profi-Foto-Auftrag (kostet)','OFFEN !!!');
  exception when insufficient_privilege then insert into probe values (132,'Team','Profi-Foto-Auftrag (kostet)','abgewiesen'); end;
end $$;
reset role;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('probe.r_inhaber'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare n int; h uuid; begin
  if current_setting('probe.rollen') <> 'true' or current_setting('probe.r_inhaber') = '' then return; end if;
  h := current_setting('probe.r_haus')::uuid;
  update betriebe set hub_texte = coalesce(hub_texte,'{}') || '{"slogan":"Probe"}' where id = h; get diagnostics n = row_count;
  insert into probe values (133,'Inhaber','Hub-Text aendern', case when n = 1 then 'ok' else 'KAPUTT: '||n end);
  update gerichte set preis = preis + 1 where betrieb_id = h and name = 'Probe-Rolle'; get diagnostics n = row_count;
  insert into probe values (134,'Inhaber','Preis aendern', case when n = 1 then 'ok' else 'KAPUTT: '||n end);
  -- Nach Teil 3 von migration-gutschein-sicher.sql schreibt auch der
  -- Inhaber nicht mehr direkt (nur über gutschein_ausstellen/_beenden).
  -- Ohne den Fang bräche hier die ganze Datei ab.
  begin update gutscheine set titel = 'geaendert' where betrieb_id = h and code = 'PROBE-ROLLE-1'; get diagnostics n = row_count;
    insert into probe values (135,'Inhaber','Gutschein aendern (direkt)', case when n = 1 then 'ok (Teil 3 noch nicht eingespielt)' else 'KAPUTT: '||n end);
  exception when insufficient_privilege then
    insert into probe values (135,'Inhaber','Gutschein aendern (direkt)','nur noch ueber die Funktionen (Teil 3 eingespielt)'); end;
  delete from gerichte where betrieb_id = h and name = 'Probe-Rolle'; get diagnostics n = row_count;
  insert into probe values (136,'Inhaber','Gericht loeschen', case when n = 1 then 'ok' else 'KAPUTT: '||n end);
  update betriebe set hub_texte = hub_texte where id::text = current_setting('probe.r_fremd'); get diagnostics n = row_count;
  insert into probe values (137,'Inhaber','FREMDEN Betrieb aendern', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
end $$;
reset role;
do $$ begin
  if current_setting('probe.rollen') <> 'true' then return; end if;
  insert into probe select 138, 'authenticated', 'Wachen als /rpc/ rufbar',
    case when bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')) then 'OFFEN !!!' else 'abgewiesen' end
    from pg_proc p where p.proname in ('betrieb_rolle_wache','gericht_rolle_wache') and p.pronamespace = 'public'::regnamespace;
  insert into probe select 139, '—', 'beide Wachen haengen an der Tabelle',
    case when count(*) = 2 then 'ok' else 'KAPUTT: '||count(*) end
    from pg_trigger where tgname in ('betrieb_rolle_wache','gericht_rolle_wache') and tgenabled <> 'D';
end $$;

-- ═══ TEIL 9 · Gutscheine und Codes (migration-gutschein-sicher.sql) ═══
-- Läuft nach TEIL 8 und benutzt dessen Probe-Team (r_team ist dort
-- Mitglied 'team' von r_haus). Recht, Grenzen und PIN setzt postgres —
-- alles dreht sich am Ende mit zurück. Die PIN des Probe-Kontos wird
-- hier gesetzt (auch wenn es schon eine hat: zurückgedreht).
select set_config('probe.gs', (select (count(*) > 0)::text from pg_proc
   where proname = 'rabattcode_ausstellen' and pronamespace = 'public'::regnamespace), true);
do $$ begin
  if current_setting('probe.gs') <> 'true' then
    insert into probe values (140,'—','TEIL 9 uebersprungen','migration-gutschein-sicher.sql noch nicht eingespielt'); return;
  end if;
  if current_setting('probe.rollen') <> 'true' or current_setting('probe.r_haus') = '' or current_setting('probe.r_team') = '' then
    insert into probe values (140,'—','TEIL 9 nicht messbar','TEIL 8 hat kein Probe-Team'); return;
  end if;
  update betrieb_mitglieder set darf_gutscheine = true, gutschein_max_betrag = 10, gutschein_max_prozent = 20,
         gutschein_tag_max = 2, anzeigename = 'Probe-Team'
   where betrieb_id = current_setting('probe.r_haus')::uuid and nutzer_id = current_setting('probe.r_team')::uuid;
  insert into konto_pin(nutzer_id, pin_hash, fehlversuche, gesperrt, gesetzt_am, gesetzt_von)
    values (current_setting('probe.r_team')::uuid, extensions.crypt('40918273', extensions.gen_salt('bf', 8)), 0, false, now(), null)
    on conflict (nutzer_id) do update set pin_hash = excluded.pin_hash, fehlversuche = 0, gesperrt = false;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('probe.r_team'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare h uuid; r jsonb; n int; begin
  if current_setting('probe.gs') <> 'true' or current_setting('probe.r_team') = '' or current_setting('probe.r_haus') = '' then return; end if;
  h := current_setting('probe.r_haus')::uuid;
  r := public.gutschein_recht(h);
  insert into probe values (141,'Team','Voraussetzung: Recht freigeschaltet, Rahmen 10 €/20 %/2', case when (r->>'ok')::boolean and (r->>'tag_max')::int = 2 then 'ok' else 'KAPUTT: '||r::text end);
  if not (r->>'ok')::boolean then return; end if;
  r := public.rabattcode_ausstellen(h, 15, null, null, null, null, '40918273');
  insert into probe values (142,'Team','15 € bei Grenze 10', case when r->>'grund' = 'ueber_grenze' then 'abgewiesen' else 'OFFEN !!! '||r::text end);
  r := public.rabattcode_ausstellen(h, null, 25, null, null, null, '40918273');
  insert into probe values (143,'Team','25 % bei Grenze 20', case when r->>'grund' = 'ueber_grenze' then 'abgewiesen' else 'OFFEN !!! '||r::text end);
  r := public.rabattcode_ausstellen(h, 5, null, null, null, 'PROBE', '00000000');
  insert into probe values (144,'Team','falsche PIN', case when r->>'grund' = 'pin_falsch' then 'abgewiesen' else 'OFFEN !!! '||r::text end);
  r := public.rabattcode_ausstellen(h, 5, null, null, null, 'PROBE', '40918273');
  insert into probe values (145,'Team','richtige PIN: Code vom Server', case when (r->>'ok')::boolean and r->>'code' ~ '^PROBE-[A-HJ-NP-Z2-9]{10}$' then 'ok' else 'KAPUTT: '||r::text end);
  insert into probe select 146,'Team','Name und Frist am Code (nicht vom Aufrufer)',
    case when angelegt_name = 'Probe-Team' and angelegt_von::text = current_setting('probe.r_team') and gueltig_bis between now() + interval '29 days' and now() + interval '31 days'
         then 'ok' else 'KAPUTT: '||coalesce(angelegt_name,'-') end
    from rabattcodes where code = r->>'code';
  r := public.gutschein_ausstellen(h, 'Probe-Kaffee', null, null, null, '40918273');
  insert into probe values (147,'Team','Gutschein (zweite Ausstellung heute)', case when (r->>'ok')::boolean then 'ok' else 'KAPUTT: '||r::text end);
  r := public.gutschein_ausstellen(h, 'Probe-Kuchen', null, null, null, '40918273');
  insert into probe values (148,'Team','dritte Ausstellung bei Tageslimit 2', case when r->>'grund' = 'tageslimit' then 'abgewiesen' else 'OFFEN !!! '||r::text end);
  begin insert into gutscheine(betrieb_id, titel, code) values (h, 'Probe', 'PROBE-DIREKT-9');
    insert into probe values (149,'Team','Gutschein direkt in die Tabelle','OFFEN !!!');
  exception when insufficient_privilege then insert into probe values (149,'Team','Gutschein direkt in die Tabelle','abgewiesen'); end;
end $$;
reset role;
do $$ begin
  if current_setting('probe.gs') <> 'true' then return; end if;
  insert into probe select 150,'authenticated','alter Weg rabattcode_team_anlegen (ohne PIN)',
    case when has_function_privilege('authenticated','public.rabattcode_team_anlegen(uuid,text,numeric,numeric,uuid,timestamptz)','EXECUTE')
         then 'noch offen — Teil 3 (SCHARF) beim Merge einspielen' else 'zu' end;
  insert into probe select 151,'—','Helfer nicht als /rpc/ rufbar',
    case when bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('anon', p.oid, 'EXECUTE'))
         then 'OFFEN !!!' else 'abgewiesen' end
    from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('pin_ausstellung_pruefen','code_erzeugen','ausstell_name','rabatt_basis');
end $$;

-- Gast: Raten wird gezählt, auch das falsche — und nie mit Ausnahme.
-- Herkunft gestellt über cf-connecting-ip (§2.3e).
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.99"}', true);
set local role anon;
do $$ declare h uuid; r jsonb; i int; begin
  if current_setting('probe.gs') <> 'true' or current_setting('probe.r_haus') = '' then return; end if;
  h := current_setting('probe.r_haus')::uuid;
  r := public.rabattcode_pruefen(h, 'GIBTSNICHT', 'probegeraet99', null);
  insert into probe values (152,'anon','unbekannter Code', case when r->>'grund' = 'ungueltig' then 'ok (ungueltig, keine Ausnahme)' else 'KAPUTT: '||r::text end);
  for i in 1..21 loop r := public.rabattcode_pruefen(h, 'RATE' || i, 'geraet' || lpad(i::text, 4, '0'), null); end loop;
  insert into probe values (153,'anon','21 Rateversuche aus einem Netz', case when r->>'grund' = 'zu_viele' then 'gebremst' else 'OFFEN !!! '||r::text end);
  begin insert into rabattcodes(betrieb_id, code, betrag, quelle) values (h, 'PROBE-ANON', 5, 'team');
    insert into probe values (154,'anon','Code direkt anlegen','OFFEN !!!');
  exception when insufficient_privilege then insert into probe values (154,'anon','Code direkt anlegen','abgewiesen'); end;
end $$;
reset role;
select set_config('request.headers', '', true);
select set_config('request.jwt.claims', '', true);

-- ═══ TEIL 7 · Zweiter Faktor: PIN (migration-pin.sql) ═══
-- Voraussetzungen VOR dem Rollenwechsel (§2.3b): Unter authenticated
-- sieht der Master von betrieb_mitglieder nur sich selbst.
select set_config('probe.pin', (select (count(*) = 1)::text from pg_class
   where relname = 'konto_pin' and relnamespace = 'public'::regnamespace), true);
do $$ begin
  if current_setting('probe.pin') <> 'true' then
    insert into probe values (100,'—','TEIL 7 uebersprungen','migration-pin.sql noch nicht eingespielt');
  end if;
end $$;
select set_config('probe.master', coalesce((select benutzer_id::text from master_konten order by benutzer_id limit 1), ''), true);
select set_config('probe.mitglieder', coalesce((select string_agg(nutzer_id::text, ',') from betrieb_mitglieder
   where betrieb_id::text = current_setting('probe.eigen')), ''), true);
select set_config('probe.gericht', coalesce((select count(*)::text from gerichte
   where betrieb_id::text = current_setting('probe.eigen')), '0'), true);

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('probe.master'),'role','authenticated','session_id','probe-m1')::text, true);
set local role authenticated;
do $$ declare j jsonb; u text; alle boolean := true; begin
  if current_setting('probe.pin') <> 'true' or current_setting('probe.master') = '' then return; end if;
  j := pin_pflicht_setzen(current_setting('probe.eigen')::uuid, true);
  insert into probe values (100,'Master','Pflicht an, solange Mitglieder keine PIN haben',
    case when j->>'grund' = 'pin_fehlt' then 'abgewiesen' else 'OFFEN !!! '||j::text end);
  foreach u in array string_to_array(current_setting('probe.mitglieder'), ',') loop
    alle := alle and coalesce((pin_setzen(u::uuid, '48151623')->>'ok')::boolean, false);
  end loop;
  j := pin_pflicht_setzen(current_setting('probe.eigen')::uuid, true);
  insert into probe values (101,'Master','PIN an alle Mitglieder, dann Pflicht an',
    case when alle and (j->>'ok')::boolean then 'ok' else 'KAPUTT: '||j::text end);
  j := pin_setzen(current_setting('probe.master')::uuid, '1111111');
  insert into probe values (102,'Master','PIN mit 7 Ziffern', case when j->>'grund' = 'form' then 'abgewiesen' else 'OFFEN !!! '||j::text end);
end $$;
reset role;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('probe.nutzer'),'role','authenticated','session_id','probe-w1')::text, true);
set local role authenticated;
do $$ declare n int; j jsonb; begin
  if current_setting('probe.pin') <> 'true' or current_setting('probe.master') = '' then return; end if;
  select count(*) into n from betriebe where id::text = current_setting('probe.eigen');
  insert into probe values (103,'Mitglied','OHNE PIN-Eingabe: eigener Betrieb', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  select count(*) into n from gerichte where betrieb_id::text = current_setting('probe.eigen');
  insert into probe values (104,'Mitglied','OHNE PIN-Eingabe: eigene Karte', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  update betriebe set name = name where id::text = current_setting('probe.eigen'); get diagnostics n = row_count;
  insert into probe values (105,'Mitglied','OHNE PIN-Eingabe: Betrieb aendern', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
  j := pin_pruefen('00000001');
  insert into probe values (106,'Mitglied','falsche PIN zaehlt', case when j->>'grund' = 'falsch' and (j->>'verbleibend')::int = 4 then 'ok' else 'KAPUTT: '||j::text end);
  j := pin_pruefen('48151623');
  insert into probe values (107,'Mitglied','richtige PIN', case when (j->>'ok')::boolean then 'ok' else 'KAPUTT: '||j::text end);
end $$;
-- Neue Anweisung = neuer Schnappschuss: erst jetzt ist die Freigabe sichtbar.
do $$ declare n int; begin
  if current_setting('probe.pin') <> 'true' or current_setting('probe.master') = '' then return; end if;
  select count(*) into n from gerichte where betrieb_id::text = current_setting('probe.eigen');
  insert into probe values (108,'Mitglied','MIT PIN: eigene Karte wieder da',
    case when n::text = current_setting('probe.gericht') then 'ok ('||n||')' else 'KAPUTT: '||n||' statt '||current_setting('probe.gericht') end);
  update betriebe set name = name where id::text = current_setting('probe.eigen'); get diagnostics n = row_count;
  insert into probe values (109,'Mitglied','MIT PIN: andere Spalte aendern (§2.7)', case when n = 1 then 'ok' else 'KAPUTT: '||n end);
  if pin_setzen(current_setting('probe.nutzer')::uuid, '55667788')->>'grund' = 'kein_master' then
    insert into probe values (110,'Mitglied','Nicht-Master setzt PIN','abgewiesen');
  else insert into probe values (110,'Mitglied','Nicht-Master setzt PIN','OFFEN !!!'); end if;
end $$;
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('probe.nutzer'),'role','authenticated','session_id','probe-w2')::text, true);
set local role authenticated;
do $$ declare n int; begin
  if current_setting('probe.pin') <> 'true' or current_setting('probe.master') = '' then return; end if;
  select count(*) into n from gerichte where betrieb_id::text = current_setting('probe.eigen');
  insert into probe values (111,'Mitglied','ANDERE Anmeldung desselben Kontos', case when n = 0 then 'abgewiesen (0 Zeilen)' else 'OFFEN !!! '||n end);
end $$;
reset role;
set local role anon;
do $$ begin
  if current_setting('probe.pin') <> 'true' then return; end if;
  begin perform pin_pruefen('48151623'); insert into probe values (112,'anon','pin_pruefen rufen','OFFEN !!!');
  exception when insufficient_privilege then insert into probe values (112,'anon','pin_pruefen rufen','abgewiesen'); end;
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
