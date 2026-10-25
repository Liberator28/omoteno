-- pruef-saal-raeume.sql · Grenzen und Rechte von migration-saal-raeume.sql (Räume in Metern, Theken)
-- Zurückgedreht. Zeilenzahl statt Ausnahme (§2.3b). Fast alle Proben rufen mit UNGÜLTIGEN Werten (§2.3g):
-- mit gültigen sähe jede Schranke richtig aus. „Team“ ist ein fremder Inhaber, der für diese Transaktion
-- Mitglied wird. Lauf: pruefungen/pruef-saalplan-lokal.sh (lokales Postgres 16).
begin;
create temp table probe(schritt text, ergebnis text);
grant all on probe to authenticated, anon;
do $$
declare b uuid; inh uuid; fremd uuid;
begin
  select betrieb_id into b from public.tische limit 1;
  select nutzer_id into inh   from public.betrieb_mitglieder where betrieb_id = b  and rolle = 'inhaber' limit 1;
  select nutzer_id into fremd from public.betrieb_mitglieder where betrieb_id <> b and rolle = 'inhaber' limit 1;
  perform set_config('probe.b', b::text, true);
  perform set_config('probe.inh', inh::text, true); perform set_config('probe.f', fremd::text, true);
  insert into public.betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (b, fremd, 'team');
  insert into probe values ('RM00 Voraussetzung', (inh is not null and fremd is not null)::text);
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('probe.inh'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare b uuid := current_setting('probe.b')::uuid; r jsonb; sechs text; n int; g int;
  raum  text := '{"b":12.5,"t":8,"x":0,"y":null,"theken":[{"x":2,"y":0.5,"b":6,"t":0.8}]}';
begin
  r := public.saal_einstellungen_setzen(b, ('{"zonen":["Haupt-Raum","Terrasse"],"raeume":[' || raum || ',{"b":8,"t":5,"x":14,"y":3}]}')::jsonb);
  insert into probe values ('RM01 gültig mit Theke → ok', r::text);
  insert into probe values ('RM02 gespeichert: Breite 12.5', (select daten -> 'raeume' -> 0 ->> 'b' from public.saal_einstellungen where betrieb_id = b));
  r := public.saal_einstellungen_setzen(b, '{"zonen":["Nur"]}');
  insert into probe values ('RM03 alter Stand ohne Räume bleibt gültig', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":1.9,"t":8}]}');          insert into probe values ('RM10 Breite 1.9', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":61,"t":8}]}');           insert into probe values ('RM11 Breite 61', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":"12","t":8}]}');         insert into probe values ('RM12 Breite als Text', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12.25,"t":8}]}');        insert into probe values ('RM13 zwei Nachkommastellen', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12}]}');                 insert into probe values ('RM14 Tiefe fehlt', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12,"t":8,"farbe":"x"}]}'); insert into probe values ('RM15 fremder Schlüssel im Raum', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":{"b":12,"t":8}}');             insert into probe values ('RM16 Räume kein Array', r::text);
  sechs := repeat('{"b":5,"t":5},', 6) || '{"b":5,"t":5}';
  r := public.saal_einstellungen_setzen(b, ('{"raeume":[' || sechs || ']}')::jsonb);  insert into probe values ('RM17 sieben Räume', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12,"t":8,"x":301}]}');   insert into probe values ('RM18 Lage x 301', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12,"t":8,"x":-1}]}');    insert into probe values ('RM19 Lage x negativ', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12,"t":8,"theken":[{"x":1,"y":1,"b":0.3,"t":0.8}]}]}'); insert into probe values ('RM20 Theke 0.3 m lang', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12,"t":8,"theken":[{"x":1,"y":1,"b":31,"t":0.8}]}]}');  insert into probe values ('RM21 Theke 31 m lang', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12,"t":8,"theken":[{"x":61,"y":1,"b":2,"t":0.8}]}]}');  insert into probe values ('RM22 Theke x 61', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12,"t":8,"theken":[{"x":1,"y":1,"b":2,"t":0.8,"farbe":"x"}]}]}'); insert into probe values ('RM23 fremder Schlüssel an der Theke', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12,"t":8,"theken":[{"x":1,"b":2,"t":0.8}]}]}');       insert into probe values ('RM24 Theke ohne y', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12,"t":8,"theken":[{"x":1,"y":1,"b":2,"t":1},{"x":1,"y":2,"b":2,"t":1},{"x":1,"y":3,"b":2,"t":1},{"x":1,"y":4,"b":2,"t":1}]}]}'); insert into probe values ('RM25 vier Theken', r::text);
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12,"t":8,"theken":"viel"}]}'); insert into probe values ('RM26 Theken kein Array', r::text);
  -- Der Stand nach allen abgewiesenen Versuchen ist der letzte gültige (RM03: Räume fehlen → Setzen ersetzt alles)
  insert into probe values ('RM30 Stand nach Abweisungen = RM03', (select daten::text from public.saal_einstellungen where betrieb_id = b));
  -- Größter erlaubter Inhalt: 6 Bereiche à 24 Zeichen, 6 Räume, je 3 Theken — muss in die Schranke (< 4000 Byte) passen
  r := public.saal_einstellungen_setzen(b, jsonb_build_object(
    'zonen', (select jsonb_agg(repeat(chr(64 + i), 24)) from generate_series(1, 6) i),
    'raeume', (select jsonb_agg(jsonb_build_object('b', 60.0, 't', 60.0, 'x', 300.0, 'y', 300.0, 'theken',
        jsonb_build_array(jsonb_build_object('x', 60.0, 'y', 60.0, 'b', 30.0, 't', 30.0),
                          jsonb_build_object('x', 60.0, 'y', 60.0, 'b', 30.0, 't', 30.0),
                          jsonb_build_object('x', 60.0, 'y', 60.0, 'b', 30.0, 't', 30.0)))) from generate_series(1, 6) i),
    'stufen', jsonb_build_object('ruf', jsonb_build_object('farbe', '#FF3D81', 'min2', 120, 'min3', 240),
                                 'neu', jsonb_build_object('farbe', '#FFB300', 'min2', 120, 'min3', 240),
                                 'servieren', jsonb_build_object('farbe', '#22D17A', 'min2', 120, 'min3', 240),
                                 'pruefen', jsonb_build_object('farbe', '#A78BFA', 'min2', 120, 'min3', 240),
                                 'arbeit', jsonb_build_object('farbe', '#38BDF8'))));
  insert into probe values ('RM31 Höchstmaß passt in die Schranke', r::text);
  insert into probe values ('RM32 Größe des Höchstmaßes unter 3500', (select (pg_column_size(daten) < 3500)::text from public.saal_einstellungen where betrieb_id = b));
  begin update public.saal_einstellungen set daten = '{}'; insert into probe values ('RM40 direkt ändern','ERFOLG (falsch)');
  exception when others then insert into probe values ('RM40 direkt ändern','abgewiesen'); end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('probe.f'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare b uuid := current_setting('probe.b')::uuid; r jsonb;
begin
  r := public.saal_einstellungen_setzen(b, '{"raeume":[{"b":12,"t":8}]}');          insert into probe values ('RM50 TEAM setzt Räume (erwartet kein_recht)', r::text);
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
do $$
begin
  begin perform public.saal_einstellungen_setzen(current_setting('probe.b')::uuid, '{"raeume":[{"b":12,"t":8}]}'); insert into probe values ('RM60 anon ruft', 'ERFOLG (falsch)');
  exception when others then insert into probe values ('RM60 anon ruft', 'abgewiesen'); end;
end $$;
reset role;
-- Genau eine Fassung der Funktion (§2.1)
insert into probe select 'RM70 genau eine Fassung', count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'saal_einstellungen_setzen';
select * from probe order by schritt;
rollback;
