-- pruef-saal-einstellungen.sql · Rechte und Grenzen von migration-saal-einstellungen.sql
-- Zurückgedreht. Gelaufen live am 20.10.2026: 33 Zeilen, jede wie erwartet.
-- Zeilenzahl statt Ausnahme (§2.3b); „Team“ ist ein fremder Inhaber, der für diese Transaktion
-- Mitglied wird (so sieht er die Zeilen, nur die UPDATE-Regel kann 0 Zeilen erzwingen).
-- Ein Teil der Proben ruft mit UNGÜLTIGEN Werten (§2.3g: gültige Werte machen jede Schranke grün).
begin;
create temp table probe(schritt text, ergebnis text);
grant all on probe to authenticated, anon;
do $$
declare b uuid; inh uuid; fremd uuid; t uuid;
begin
  select betrieb_id into b from public.tische limit 1;
  select nutzer_id into inh   from public.betrieb_mitglieder where betrieb_id = b  and rolle = 'inhaber' limit 1;
  select nutzer_id into fremd from public.betrieb_mitglieder where betrieb_id <> b and rolle = 'inhaber' limit 1;
  select id into t from public.tische where betrieb_id = b order by nummer limit 1;
  perform set_config('probe.b', b::text, true); perform set_config('probe.t', t::text, true);
  perform set_config('probe.inh', inh::text, true); perform set_config('probe.f', fremd::text, true);
  insert into public.betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (b, fremd, 'team');
  insert into probe values ('00 Voraussetzung', (inh is not null and fremd is not null)::text);
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('probe.inh'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare b uuid := current_setting('probe.b')::uuid; r jsonb; n int;
  gut jsonb := '{"zonen":["Haupt-Raum","Terrasse"],"stufen":{"ruf":{"farbe":"#FF3D81","min2":3,"min3":8},"arbeit":{"farbe":"#38BDF8"}}}';
begin
  r := public.saal_einstellungen_setzen(b, gut);                                   insert into probe values ('01 gültig → ok', r::text);
  r := public.saal_einstellungen_setzen(b, '{"zonen":["A","a"]}');                insert into probe values ('03 doppelter Name', r::text);
  r := public.saal_einstellungen_setzen(b, '{"zonen":["a<b"]}');                  insert into probe values ('04 Spitzklammer', r::text);
  r := public.saal_einstellungen_setzen(b, '{"zonen":["1","2","3","4","5","6","7"]}'); insert into probe values ('06 sieben Bereiche', r::text);
  r := public.saal_einstellungen_setzen(b, '{"stufen":{"ruf":{"farbe":"rot","min2":2,"min3":5}}}'); insert into probe values ('10 Farbname', r::text);
  r := public.saal_einstellungen_setzen(b, '{"stufen":{"ruf":{"farbe":"#FF3D81","min2":5,"min3":5}}}'); insert into probe values ('11 min3 = min2', r::text);
  r := public.saal_einstellungen_setzen(b, '{"stufen":{"ruf":{"farbe":"#FF3D81","min2":"2","min3":5}}}'); insert into probe values ('14 Zahl als Text', r::text);
  r := public.saal_einstellungen_setzen(b, '{"stufen":{"ruf":{"farbe":"#FF3D81"}}}'); insert into probe values ('16 Zeiten fehlen', r::text);
  r := public.saal_einstellungen_setzen(b, '{"stufen":{"arbeit":{"farbe":"#38BDF8","min2":2,"min3":5}}}'); insert into probe values ('17 Zeit bei In Arbeit', r::text);
  r := public.saal_einstellungen_setzen(b, '{"anderes":1}');                       insert into probe values ('19 unbekannter Schlüssel', r::text);
  begin insert into public.saal_einstellungen(betrieb_id, daten) values (gen_random_uuid(), '{}'); insert into probe values ('22 direkt einfügen','ERFOLG (falsch)');
  exception when others then insert into probe values ('22 direkt einfügen','abgewiesen'); end;
  begin update public.saal_einstellungen set daten = '{}'; insert into probe values ('23 direkt ändern','ERFOLG (falsch)');
  exception when others then insert into probe values ('23 direkt ändern','abgewiesen'); end;
  update public.tische set x = 10, y = 20, form = 'rund', plaetze = 4, zone = 'Terrasse' where id = current_setting('probe.t')::uuid;
  get diagnostics n = row_count; insert into probe values ('24 Inhaber setzt Bereich (erwartet 1)', n::text);
  begin update public.tische set zone = 'a<b' where id = current_setting('probe.t')::uuid; insert into probe values ('25 Bereich mit <','ERFOLG (falsch)');
  exception when others then insert into probe values ('25 Bereich mit <','abgewiesen'); end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('probe.f'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare b uuid := current_setting('probe.b')::uuid; r jsonb; n int;
begin
  r := public.saal_einstellungen_setzen(b, '{"zonen":["X"]}');                    insert into probe values ('31 TEAM setzt (erwartet kein_recht)', r::text);
  update public.tische set zone = 'Team' where id = current_setting('probe.t')::uuid;
  get diagnostics n = row_count; insert into probe values ('32 TEAM setzt Bereich (erwartet 0 Zeilen)', n::text);
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
do $$
begin
  begin perform public.saal_einstellungen_setzen(current_setting('probe.b')::uuid, '{}'); insert into probe values ('40 anon ruft', 'ERFOLG (falsch)');
  exception when others then insert into probe values ('40 anon ruft', 'abgewiesen'); end;
end $$;
reset role;
select * from probe order by schritt;
rollback;
