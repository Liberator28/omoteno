-- ═══════════════════════════════════════════════════════════════════
--  PRÜFUNG · migration-missbrauch.sql, Teil 2 (Bestellungen, Bremse)
--                                     und Teil 3 (die übrigen Gastwege)
--
--  Im SQL-Editor ausführen, NACH der Migration. Legt echte Zeilen an
--  und endet mit raise exception 'PROBE …' — alles wird zurückgedreht,
--  die Ergebnisse stehen in der Fehlermeldung. Läuft als anon mit einer
--  gestellten Herkunft (cf-connecting-ip), so wie PostgREST sie setzt
--  (§2.4); das erste Element von x-forwarded-for ist absichtlich eine
--  Fälschung (6.6.6.6) und darf nirgends auftauchen (§2.3e).
--
--  Erwartet (26.09.2026, gegen den echten Bestand):
--    Q1  true | Gericht nicht (mehr) auf der Karte          (markiert, nicht abgewiesen)
--    Q2a abgewiesen: Höchstens 30 Stück …                    Q2b abgewiesen: Der Preis stimmt nicht …
--    Q3  false | summe=25.40 | positionen mit Serverpreis    Q9  dieselbe id
--    Q4  abgewiesen: Höchstens 30 Stück …                    Q5  abgewiesen: Ihre Auswahl ist noch leer.
--    Q6  ffffffmmmmmmmmmmmmmmX   (6 frei, ab der 7. markiert, 21. abgewiesen)
--    Q7  ffffffffmmmm            (Netz: ab der 31. markiert)
--    Q8  summe=0.00 | [] | pruefen=false                    Q10 grund mindest
--    Q11 h:64 (nur ein Hash)                                 Q12 0
--  Teil 3 (eigene Herkunft 198.51.100.9, damit Teil 2 nicht mitzählt):
--    R1  ffffffm      (Tisch: ab der 7. in 2 Minuten markiert)
--    R2a abgewiesen: Die Anfrage ist zu lang …   R2b fffX (4. Anfrage aus einem Netz)
--    R3a abgewiesen: Meldung zu lang  R3b abgewiesen: Unbekannter Betrieb
--    R3c fffffX (6. Serviceruf-Ereignis vom selben Tisch)
--    R4  ffffX        (5. Reservierung aus einem Netz, je anderer Name)
--    R5  40× ok, dann bremse; bekannte Kennung bleibt ok
--    R6  fffffB       (6. Adresse aus einem Netz: bremse)
--    R7  false,false,true (fremder Pfad, Pfad mit /../, echte Anfragenummer)
--    R8  0            (keine Adresse im Zähler)
--    Teil 3 so gemessen am 26.09.2026, live, zurückgedreht.
--  Voraussetzung: „Bounty Waffel“ (10,40) und „Salami + Käse“ (3,50)
--  stehen verfügbar in der Karte von chocolamour.
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(nr text, ergebnis text);
grant all on probe to anon, authenticated;
do $p$
declare
  B1 uuid := 'af095b14-d9ef-41f4-9b97-c4422b0de63f';
  id1 uuid; id2 uuid; n int; j jsonb; e text; r record; i int;
  echt jsonb := '[{"name":"Bounty Waffel","menge":2,"preis":10.4}]';
begin
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  perform set_config('request.headers', '{"cf-connecting-ip":"203.0.113.7","x-forwarded-for":"6.6.6.6, 203.0.113.7"}', true);
  perform set_config('role','anon', true);

  -- Q1 nur erfundene Gerichte → angelegt, aber markiert
  id1 := bestellung_aufgeben(p_betrieb_id=>B1, p_quelle=>'tisch', p_tisch=>'91', p_summe=>0,
           p_positionen=>'[{"name":"Gibt es nicht","menge":1,"preis":0}]', p_geraet=>'probegeraet0001');
  perform set_config('role','postgres', true);
  select pruefen::text||' | '||coalesce(pruef_grund,'-')||' | summe='||summe||' | '||positionen::text into e from bestellungen where id=id1;
  insert into probe values ('Q1 erfundenes Gericht', e);
  perform set_config('role','anon', true);

  -- Q2 echtes Gericht zum Preis von 1 Cent
  begin
    perform bestellung_aufgeben(p_betrieb_id=>B1, p_quelle=>'tisch', p_tisch=>'92', p_summe=>0.01,
      p_positionen=>'[{"name":"Bounty Waffel","menge":99,"preis":0.01}]', p_geraet=>'probegeraet0002');
    insert into probe values ('Q2a 99 Stück für 1 Cent', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('Q2a 99 Stück für 1 Cent', 'abgewiesen: '||sqlerrm); end;
  begin
    perform bestellung_aufgeben(p_betrieb_id=>B1, p_quelle=>'tisch', p_tisch=>'92', p_summe=>0.01,
      p_positionen=>'[{"name":"Bounty Waffel","menge":2,"preis":0.01}]', p_geraet=>'probegeraet0002');
    insert into probe values ('Q2b 2 Stück für 1 Cent', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('Q2b 2 Stück für 1 Cent', 'abgewiesen: '||sqlerrm); end;

  -- Q3 ehrliche Bestellung: Preis vom Server, Aufpreis als JS-Zahl
  id2 := bestellung_aufgeben(p_betrieb_id=>B1, p_quelle=>'tisch', p_tisch=>'93', p_summe=>24.3,
           p_positionen=>'[{"name":"Bounty Waffel","menge":2,"preis":10.4},{"name":"Salami + Käse (extra Käse)","menge":1,"preis":4.6000000000000005}]',
           p_geraet=>'probegeraet0003', p_gast_kennung=>'probe-kennung-q3-0001');
  perform set_config('role','postgres', true);
  select pruefen::text||' | summe='||summe||' | gast='||summe_gast||' | nr='||coalesce(tagesnummer::text,'-')||' | '||positionen::text into e from bestellungen where id=id2;
  insert into probe values ('Q3 ehrliche Bestellung (Aufpreis 1,10 als JS-Zahl)', e);
  perform set_config('role','anon', true);
  -- Q9 Wiederholung derselben Kennung: dieselbe id, zählt nicht
  if bestellung_aufgeben(p_betrieb_id=>B1, p_quelle=>'tisch', p_tisch=>'93', p_summe=>24.3,
       p_positionen=>'[{"name":"Bounty Waffel","menge":2,"preis":10.4},{"name":"Salami + Käse (extra Käse)","menge":1,"preis":4.6}]',
       p_geraet=>'probegeraet0003', p_gast_kennung=>'probe-kennung-q3-0001') = id2
  then insert into probe values ('Q9 Wiederholung', 'dieselbe id');
  else insert into probe values ('Q9 Wiederholung', 'NEUE id (FEHLER)'); end if;

  -- Q4/Q5 Grenzen
  begin perform bestellung_aufgeben(p_betrieb_id=>B1, p_quelle=>'tisch', p_tisch=>'94', p_summe=>1000,
          p_positionen=>'[{"name":"Bounty Waffel","menge":31,"preis":10.4}]');
        insert into probe values ('Q4 31 Stück', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('Q4 31 Stück', 'abgewiesen: '||sqlerrm); end;
  begin perform bestellung_aufgeben(p_betrieb_id=>B1, p_quelle=>'tisch', p_tisch=>'94', p_summe=>0, p_positionen=>'[]');
        insert into probe values ('Q5 leer', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('Q5 leer', 'abgewiesen: '||sqlerrm); end;

  -- Q6 ein Gerät: 6 frei, ab der 7. markiert, die 21. abgewiesen
  e := '';
  for i in 1..21 loop
    begin
      id1 := bestellung_aufgeben(p_betrieb_id=>B1, p_quelle=>'tisch', p_tisch=>'T'||i, p_summe=>10.4,
               p_positionen=>'[{"name":"Bounty Waffel","menge":1,"preis":10.4}]', p_geraet=>'probegeraet0666');
      perform set_config('role','postgres', true);
      e := e || (select case when pruefen then 'm' else 'f' end from bestellungen where id=id1);
      perform set_config('role','anon', true);
    exception when others then e := e || 'X'; perform set_config('role','anon', true);
      if i = 21 then insert into probe values ('Q6b 21. vom selben Gerät', sqlerrm); end if;
    end;
  end loop;
  insert into probe values ('Q6 Gerät, 21 Versuche (f=frei m=markiert X=abgewiesen)', e);

  -- Q7 ein Netz, viele Geräte: ab der 31. markiert (Q6 zählte schon 20 in dieses Netz)
  e := '';
  for i in 1..12 loop
    id1 := bestellung_aufgeben(p_betrieb_id=>B1, p_quelle=>'tisch', p_tisch=>null, p_summe=>10.4,
             p_positionen=>'[{"name":"Bounty Waffel","menge":1,"preis":10.4}]', p_geraet=>'netzgeraet'||lpad(i::text,6,'0'));
    perform set_config('role','postgres', true);
    e := e || (select case when pruefen then 'm' else 'f' end from bestellungen where id=id1);
    perform set_config('role','anon', true);
  end loop;
  insert into probe values ('Q7 Netz, Bestellung 23..34 (Soll: f bis 30, danach m)', e);

  -- Q8 Serviceruf mit untergeschobenen Positionen
  id1 := bestellung_aufgeben(p_betrieb_id=>B1, p_quelle=>'service', p_tisch=>'95', p_summe=>999,
           p_notiz=>'Bitte zahlen', p_positionen=>'[{"name":"Bounty Waffel","menge":30,"preis":0}]', p_geraet=>'probegeraet0008');
  perform set_config('role','postgres', true);
  select 'summe='||summe||' | '||positionen::text||' | pruefen='||pruefen into e from bestellungen where id=id1;
  insert into probe values ('Q8 Serviceruf', e);

  -- Q10 Lieferung: Mindestwert gegen die Serversumme
  update betriebe set liefer = '{"an":true,"plz":["12345"],"mindest":20,"gebuehr":2}'::jsonb where id=B1;
  perform set_config('role','anon', true);
  j := bestellung_liefern(p_betrieb_id=>B1,
         p_adresse=>'{"name":"Probe","strasse":"Weg 1","plz":"12345","ort":"Ort","telefon":"0170"}',
         p_positionen=>'[{"name":"Salami + Käse","menge":1,"preis":25}]', p_summe=>25, p_geraet=>'probegeraet0010');
  insert into probe values ('Q10 Lieferung 3,50 € Ware als 25 € ausgegeben', j::text);

  perform set_config('role','postgres', true);
  insert into probe values ('Q11 gespeicherte Herkunft (Hash, nie die Adresse)',
    (select string_agg(distinct split_part(schluessel,':',2)||':'||length(split_part(schluessel,':',4)), ',') from schutz_zaehler where schluessel like 'b:h:%'));
  insert into probe values ('Q12 Adressen tauchen nirgends auf',
    (select count(*)::text from schutz_zaehler where schluessel like '%6.6.6.6%' or schluessel like '%203.0.113%'));
end
$p$;
do $p3$
declare
  B1 uuid := 'af095b14-d9ef-41f4-9b97-c4422b0de63f';
  S1 text; id1 uuid; e text; i int; j jsonb;
begin
  select slug into S1 from betriebe where id = B1;
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  perform set_config('request.headers', '{"cf-connecting-ip":"198.51.100.9","x-forwarded-for":"6.6.6.6, 198.51.100.9"}', true);
  perform set_config('role','anon', true);

  -- R1 3a: sieben Bestellungen vom selben Tisch, je eigenes Gerät
  e := '';
  for i in 1..7 loop
    id1 := bestellung_aufgeben(p_betrieb_id=>B1, p_quelle=>'tisch', p_tisch=>'97', p_summe=>10.4,
             p_positionen=>'[{"name":"Bounty Waffel","menge":1,"preis":10.4}]', p_geraet=>'r1geraet'||lpad(i::text,6,'0'));
    perform set_config('role','postgres', true);
    e := e || (select case when pruefen then 'm' else 'f' end from bestellungen where id=id1);
    perform set_config('role','anon', true);
  end loop;
  insert into probe values ('R1 Tisch 97, 7 Bestellungen', e);

  -- R2 3b: Länge, dann vier Anfragen aus einem Netz (Zeilen gezählt, kein returning, §2.3b)
  begin
    insert into anfragen(kennung, notiz) values ('OMO-R2LNG', repeat('x', 4001));
    insert into probe values ('R2a Anfrage 4001 Zeichen', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('R2a Anfrage 4001 Zeichen', 'abgewiesen: '||sqlerrm); end;
  e := '';
  for i in 1..4 loop
    begin
      insert into anfragen(kennung, betrieb) values ('OMO-R2' || i::text || 'X', 'Probe');
      e := e || 'f';
    exception when others then e := e || 'X'; end;
  end loop;
  insert into probe values ('R2b vier Anfragen aus einem Netz', e);

  -- R3 3c: ereignisse
  begin
    insert into ereignisse(betrieb, betrieb_id, art, tisch, inhalt)
      values (S1, B1, 'probe', '98', jsonb_build_object('x', repeat('y', 4100)));
    insert into probe values ('R3a Ereignis 4100 Zeichen', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('R3a Ereignis 4100 Zeichen', 'abgewiesen: '||sqlerrm); end;
  begin
    insert into ereignisse(betrieb, art, tisch) values ('gibt-es-nicht-r3', 'probe', '98');
    insert into probe values ('R3b Ereignis fremder Betrieb', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('R3b Ereignis fremder Betrieb', 'abgewiesen: '||sqlerrm); end;
  e := '';
  for i in 1..6 loop
    begin
      insert into ereignisse(betrieb, art, tisch) values (S1, 'probe', '98');
      e := e || 'f';
    exception when others then e := e || 'X'; end;
  end loop;
  insert into probe values ('R3c sechs Ereignisse Tisch 98', e);

  -- R4 3d: fünf Reservierungen aus einem Netz, je anderer Name und Telefon
  e := '';
  for i in 1..5 loop
    begin
      insert into reservierungen(betrieb_id, name, telefon, personen, wunsch, quelle)
        values (B1, 'Probe R4 ' || i, '0170000000' || i, 2, now() + interval '2 days', 'tisch');
      e := e || 'f';
    exception when others then e := e || 'X'; end;
  end loop;
  insert into probe values ('R4 fünf Reservierungen aus einem Netz', e);

  -- R5 3e: 41 neue Gastkennungen aus einem Netz
  e := '';
  for i in 1..41 loop
    j := gast_melden(S1, 'r5kennung' || lpad(i::text, 6, '0'));
    if i = 40 then e := e || '40:' || coalesce(j->>'ok','?') || ' '; end if;
    if i = 41 then e := e || '41:' || coalesce(j->>'grund', j->>'ok') || ' '; end if;
  end loop;
  j := gast_melden(S1, 'r5kennung000001');
  insert into probe values ('R5 Gastzeilen aus einem Netz', e || 'bekannt:' || coalesce(j->>'ok','?'));

  -- R6 3f: sechs Adressen aus einem Netz
  e := '';
  for i in 1..6 loop
    j := gast_mail_merken(S1, 'r5kennung000001', 'probe' || i || '@example.org');
    e := e || case when j->>'grund' = 'bremse' then 'B' when (j->>'ok')::boolean then 'f' else coalesce(j->>'grund','?') end;
  end loop;
  insert into probe values ('R6 Adressen aus einem Netz', e);

  -- R7 3g: Pfade
  insert into probe values ('R7 Pfade', anfrage_anhang_ok('irgendwo/datei.pdf')::text || ',' ||
    anfrage_anhang_ok('OMO-ABCDE/../x.pdf')::text || ',' || anfrage_anhang_ok('OMO-ABCDE/karte.pdf')::text);

  perform set_config('role','postgres', true);
  insert into probe values ('R8 Adressen tauchen nirgends auf (Teil 3)',
    (select count(*)::text from schutz_zaehler where schluessel like '%198.51.100%' or schluessel like '%6.6.6.6%'));
end
$p3$;
do $e$ declare t text; begin select string_agg(nr||' → '||ergebnis, E'\n' order by nr) into t from probe; raise exception E'PROBE\n%', t; end $e$;
