-- pruef-rubriken-lokal.sql · Wer darf die Rubriken der Startseite (betriebe.hub_kacheln) ändern?
-- Läuft NUR lokal (pruefungen/pruef-saalplan-lokal.sh): echte Funktionen betrieb_rolle_wache/ist_inhaber aus
-- migration-rollen.sql, Spaltenrecht und Regel wie live gelesen am 24.10.2026. Zeilenzahl statt Ausnahme (§2.3b).
-- Die Voraussetzungen („Team SIEHT den Betrieb“, „Fremder ist wirklich kein Mitglied“) werden selbst gemessen.
begin;
create temp table probe(schritt text, ergebnis text);
grant all on probe to authenticated, anon;
-- Team des Betriebs 1 und ein Fremder ohne jede Mitgliedschaft
insert into auth.users(id, email) values ('33333333-3333-3333-3333-333333333333','team@probe.invalid'),
                                         ('44444444-4444-4444-4444-444444444444','fremd@probe.invalid');
insert into public.betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333','team');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  update public.betriebe set hub_kacheln = '[{"gruppe":"Meine Rubrik"}]'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  get diagnostics n = row_count; insert into probe values ('R1 Inhaber ändert Rubriken (erwartet 1)', n::text);
  begin update public.betriebe set slug = 'x' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; insert into probe values ('R2 Inhaber ändert slug','ERFOLG (falsch)');
  exception when others then insert into probe values ('R2 Inhaber ändert slug','abgewiesen'); end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  insert into probe values ('R3 Voraussetzung: Team sieht den Betrieb (erwartet 1)', (select count(*)::text from public.betriebe where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
  begin update public.betriebe set hub_kacheln = '[{"gruppe":"Fremdes Layout"}]'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        get diagnostics n = row_count; insert into probe values ('R4 TEAM ändert Rubriken','ERFOLG ('||n||' Zeilen, falsch)');
  exception when sqlstate '42501' then insert into probe values ('R4 TEAM ändert Rubriken','abgewiesen'); end;
  update public.betriebe set bestell_pause = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  get diagnostics n = row_count; insert into probe values ('R5 TEAM pausiert Bestellungen (legitim, erwartet 1)', n::text);
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  insert into probe values ('R6 Voraussetzung: Fremder sieht den Betrieb NICHT (erwartet 0)', (select count(*)::text from public.betriebe where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
  -- drei Schichten halten das: Lese-Regel (Fremder sieht die Zeile nicht), UPDATE-Regel, Wache. Wirft die Wache
  -- (nur wenn die beiden Regeln davor offen wären), steht „abgewiesen“ statt „0“ — beides sind verschiedene Befunde.
  begin
    update public.betriebe set hub_kacheln = '[{"gruppe":"Angriff"}]'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    get diagnostics n = row_count; insert into probe values ('R7 FREMDER ändert Rubriken (erwartet 0 Zeilen)', n::text);
  exception when sqlstate '42501' then insert into probe values ('R7 FREMDER ändert Rubriken (erwartet 0 Zeilen)', 'abgewiesen durch die Wache'); end;
  begin insert into public.betriebe(name, slug) values ('Neu','neu'); insert into probe values ('R8 Fremder legt Betrieb an','ERFOLG (falsch)');
  exception when others then insert into probe values ('R8 Fremder legt Betrieb an','abgewiesen'); end;
end $$;
reset role;

set local role anon;
do $$ declare n int; begin
  begin update public.betriebe set hub_kacheln = '[]'::jsonb; get diagnostics n = row_count; insert into probe values ('R9 anon ändert Rubriken','ERFOLG ('||n||' Zeilen, falsch)');
  exception when others then insert into probe values ('R9 anon ändert Rubriken','abgewiesen'); end;
end $$;
reset role;

-- Lesebeweis: der Stand nach allen Versuchen ist der des Inhabers (nicht der des Teams/Fremden)
insert into probe select 'R10 Stand nach allen Versuchen', hub_kacheln::text from public.betriebe where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select * from probe;
rollback;
