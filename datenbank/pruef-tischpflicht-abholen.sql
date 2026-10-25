-- Probe (zurückgedreht): Was macht die Tischpflicht mit einer Abholung? Läuft gegen datenbank/modell-lokal-abholen.sql
-- mit den ECHTEN Funktionen bestellung_aufgeben (migration-gutschein-sicher.sql) und bestellung_abholen.
-- Aufruf: pruefungen/pruef-tischpflicht-lokal.sh  (Argument "nachher" spielt vorher die Korrektur ein)
begin;
create temp table probe(nr text, was text, ergebnis text);
do $$
declare
  v_b uuid; r jsonb; m text; n int;
  pos jsonb := '[{"name":"Probe","menge":1}]';
begin
  insert into betriebe(slug, liefer) values ('probe', '{"abholen":true,"an":true,"plz":["35037"]}') returning id into v_b;

  -- T1 · ohne Tischpflicht geht die Abholung durch (Gegenfall: der Weg an sich ist in Ordnung)
  r := bestellung_abholen(v_b, 'Gast', '0151 1', pos, 10, null, null, null, null, null);
  insert into probe values ('T1','ohne Tischpflicht: Abholung angenommen', (r->>'ok'));

  -- T2 · MIT Tischpflicht, Abholung (der Anlassfall): angenommen oder abgewiesen?
  update betriebe set tisch_pflicht = true where id = v_b;
  begin
    r := bestellung_abholen(v_b, 'Gast', '0151 1', pos, 10, null, null, null, null, null);
    insert into probe values ('T2','Tischpflicht an: Abholung angenommen', (r->>'ok'));
  exception when others then
    get stacked diagnostics m = message_text;
    insert into probe values ('T2','Tischpflicht an: Abholung angenommen', 'Ausnahme: ' || m);
  end;

  -- T3 · MIT Tischpflicht, Tisch ohne Beleg: bleibt abgewiesen (das ist der Sinn der Tischpflicht, darf sich nie lockern)
  begin
    perform bestellung_aufgeben(v_b, 'tisch', '5', 10, null, pos, null, null, null, null, null);
    insert into probe values ('T3','Tischpflicht an: Tischbestellung ohne Beleg abgewiesen', 'false');
  exception when others then
    get stacked diagnostics m = message_text;
    insert into probe values ('T3','Tischpflicht an: Tischbestellung ohne Beleg abgewiesen', (m like '%Untersetzer%')::text);
  end;

  -- T4 · MIT Tischpflicht, Serviceruf ohne Beleg: bleibt abgewiesen
  begin
    perform bestellung_aufgeben(v_b, 'service', '5', 0, null, '[]', null, null, null, null, null);
    insert into probe values ('T4','Tischpflicht an: Serviceruf ohne Beleg abgewiesen', 'false');
  exception when others then
    get stacked diagnostics m = message_text;
    insert into probe values ('T4','Tischpflicht an: Serviceruf ohne Beleg abgewiesen', (m like '%Untersetzer%')::text);
  end;

  -- T5 · direkter Aufruf der Roh-Funktion mit Quelle 'lieferung' (so, wie ein Angreifer ihn schicken würde) bei Tischpflicht
  begin
    perform bestellung_aufgeben(v_b, 'lieferung', null, 10, null, pos, null, null, null, null, null);
    insert into probe values ('T5','Tischpflicht an: Roh-Aufruf mit Quelle lieferung angenommen', 'true');
  exception when others then
    get stacked diagnostics m = message_text;
    insert into probe values ('T5','Tischpflicht an: Roh-Aufruf mit Quelle lieferung angenommen', 'Ausnahme: ' || m);
  end;

  -- T7 · MIT Tischpflicht, Lieferung (derselbe Weg wie die Abholung, bestellung_liefern → bestellung_aufgeben)
  begin
    r := bestellung_liefern(v_b, '{"name":"Frau Weber","strasse":"Musterweg 1","plz":"35037","ort":"Marburg","telefon":"0173 1"}'::jsonb, pos, 10, null, null, null, null);
    insert into probe values ('T7','Tischpflicht an: Lieferung angenommen', (r->>'ok'));
  exception when others then
    get stacked diagnostics m = message_text;
    insert into probe values ('T7','Tischpflicht an: Lieferung angenommen', 'Ausnahme: ' || m);
  end;

  -- T8 · die Ausnahme gilt nur im Aufruf der beiden Funktionen: danach, in DERSELBEN Transaktion, ist sie weg
  begin
    perform bestellung_aufgeben(v_b, 'lieferung', null, 10, null, pos, null, null, null, null, null);
    insert into probe values ('T8','Tischpflicht an: Roh-Aufruf NACH einer Abholung in derselben Transaktion angenommen', 'true');
  exception when others then
    get stacked diagnostics m = message_text;
    insert into probe values ('T8','Tischpflicht an: Roh-Aufruf NACH einer Abholung in derselben Transaktion angenommen', 'Ausnahme: ' || m);
  end;

  -- T9 · der Helfer ist kein Endpunkt: weder anon noch authenticated dürfen ihn rufen (§2.3a); vor der Korrektur gibt es ihn nicht
  insert into probe values ('T9','Helfer tischpflicht_ausnahme_nehmen für Clients gesperrt',
    case when to_regprocedure('public.tischpflicht_ausnahme_nehmen(text)') is null then 'entfällt'
         else (not has_function_privilege('anon','public.tischpflicht_ausnahme_nehmen(text)','EXECUTE')
               and not has_function_privilege('authenticated','public.tischpflicht_ausnahme_nehmen(text)','EXECUTE'))::text end);

  -- T10 · selbst wenn die Einstellung irgendwie gesetzt wäre: für Tisch und Serviceruf gilt sie nie (die Ausnahme ist an die Quelle gebunden)
  perform set_config('omoteno.ohne_tischpflicht', '1', true);
  begin
    perform bestellung_aufgeben(v_b, 'tisch', '5', 10, null, pos, null, null, null, null, null);
    insert into probe values ('T10','Tischpflicht an, Einstellung gesetzt: Tischbestellung ohne Beleg abgewiesen', 'false');
  exception when others then
    get stacked diagnostics m = message_text;
    insert into probe values ('T10','Tischpflicht an, Einstellung gesetzt: Tischbestellung ohne Beleg abgewiesen', (m like '%Untersetzer%')::text);
  end;
  perform set_config('omoteno.ohne_tischpflicht', '', true);

  -- T6 · Zeilen: wie viele Bestellungen gibt es am Ende (T1 immer, T2/T5 je nach Stand)
  select count(*) into n from bestellungen where betrieb_id = v_b;
  insert into probe values ('T6','Zeilen in bestellungen', n::text);
end $$;
select nr || ' | ' || was || ' → ' || coalesce(ergebnis,'NULL') from probe order by nr;
rollback;
