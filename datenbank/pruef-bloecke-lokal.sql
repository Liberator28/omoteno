-- pruef-bloecke-lokal.sql · Wer darf den Aufbau der Startseite (betriebe.hub_bloecke) lesen und ändern?
-- Läuft NUR lokal (pruefungen/pruef-bloecke-lokal.sh): echte Funktionen betrieb_rolle_wache/ist_inhaber aus
-- migration-rollen.sql, echte migration-hub-bloecke.sql. Zeilenzahl statt Ausnahme (§2.3b); Voraussetzungen
-- („Team SIEHT den Betrieb“, „Fremder ist kein Mitglied“) werden selbst gemessen, bevor etwas behauptet wird.
begin;
create temp table probe(schritt text, ergebnis text);
grant all on probe to authenticated, anon;
insert into auth.users(id, email) values ('33333333-3333-3333-3333-333333333333','team@probe.invalid'),
                                         ('44444444-4444-4444-4444-444444444444','fremd@probe.invalid');
insert into public.betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333','team');

-- Recht (die erste Linie, §2.3a) am Katalog gelesen
insert into probe values ('B0a anon darf die Spalte lesen (der Gast)', has_column_privilege('anon','public.betriebe','hub_bloecke','SELECT')::text);
insert into probe values ('B0b anon darf sie NICHT ändern', (not has_column_privilege('anon','public.betriebe','hub_bloecke','UPDATE'))::text);
insert into probe values ('B0c authenticated darf sie ändern', has_column_privilege('authenticated','public.betriebe','hub_bloecke','UPDATE')::text);
insert into probe values ('B0d anon darf preis-/Vertragsspalten nicht lesen (select * bleibt zu)', (not has_table_privilege('anon','public.betriebe','SELECT'))::text);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  update public.betriebe set hub_bloecke = '[{"id":"begleiter","breite":"halb"},{"id":"eigen-ab12","titel":"Hallo"}]'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  get diagnostics n = row_count; insert into probe values ('B1 Inhaber setzt Blöcke (erwartet 1)', n::text);
  begin update public.betriebe set hub_bloecke = '{"id":"x"}'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        insert into probe values ('B2 Objekt statt Liste','ERFOLG (falsch)');
  exception when check_violation then insert into probe values ('B2 Objekt statt Liste','abgewiesen'); end;
  begin update public.betriebe set hub_bloecke = (select jsonb_agg('x'::text) from generate_series(1,41)) where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        insert into probe values ('B3 41 Einträge','ERFOLG (falsch)');
  exception when check_violation then insert into probe values ('B3 41 Einträge','abgewiesen'); end;
  begin update public.betriebe set hub_bloecke = jsonb_build_array(repeat('x', 12000)) where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        insert into probe values ('B4 zu groß','ERFOLG (falsch)');
  exception when check_violation then insert into probe values ('B4 zu groß','abgewiesen'); end;
  begin update public.betriebe set hub_bloecke = (select jsonb_agg('x'::text) from generate_series(1,40)) where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        get diagnostics n = row_count; insert into probe values ('B4b genau 40 Einträge (Grenze selbst, erwartet 1)', n::text);
  exception when check_violation then insert into probe values ('B4b genau 40 Einträge (Grenze selbst, erwartet 1)','abgewiesen (falsch)'); end;
  update public.betriebe set hub_bloecke = '[{"id":"begleiter","breite":"halb"},{"id":"eigen-ab12","titel":"Hallo"}]'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  insert into probe values ('B5 Voraussetzung: Team sieht den Betrieb (erwartet 1)', (select count(*)::text from public.betriebe where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
  begin update public.betriebe set hub_bloecke = '[{"id":"schnell","an":false}]'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        get diagnostics n = row_count; insert into probe values ('B6 TEAM ändert Blöcke','ERFOLG ('||n||' Zeilen, falsch)');
  exception when sqlstate '42501' then insert into probe values ('B6 TEAM ändert Blöcke','abgewiesen'); end;
  update public.betriebe set bestell_pause = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  get diagnostics n = row_count; insert into probe values ('B6b TEAM pausiert Bestellungen (legitim, erwartet 1)', n::text);
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  insert into probe values ('B7 Voraussetzung: Fremder sieht den Betrieb NICHT (erwartet 0)', (select count(*)::text from public.betriebe where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
  begin update public.betriebe set hub_bloecke = '[]'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        get diagnostics n = row_count; insert into probe values ('B8 FREMDER ändert Blöcke (erwartet 0 Zeilen)', n::text);
  exception when sqlstate '42501' then insert into probe values ('B8 FREMDER ändert Blöcke (erwartet 0 Zeilen)', 'abgewiesen durch die Wache'); end;
end $$;
reset role;

set local role anon;
do $$ declare n int; begin
  begin update public.betriebe set hub_bloecke = '[]'::jsonb; get diagnostics n = row_count; insert into probe values ('B9 anon ändert Blöcke','ERFOLG ('||n||' Zeilen, falsch)');
  exception when others then insert into probe values ('B9 anon ändert Blöcke','abgewiesen'); end;
end $$;
reset role;

insert into probe select 'B10 Stand nach allen Versuchen (der des Inhabers)', hub_bloecke::text from public.betriebe where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select * from probe;
rollback;
