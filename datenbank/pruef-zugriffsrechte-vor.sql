-- VOR Teil B: der Anlassfall, gemessen. Team und Küche lesen heute die Einkaufszahlen (Lese-Regel = „Mitglied“).
-- Läuft NUR lokal (pruefungen/pruef-zugriffsrechte-lokal.sh). Zeile je Probe: Name|Ergebnis. Zurückgedreht.
begin;
create temp table probe(schritt text, ergebnis text);
grant all on probe to authenticated, anon;
create function pg_temp.als(p_nutzer uuid, p_sitzung text default 's') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_nutzer, 'role', 'authenticated', 'session_id', p_sitzung)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select pg_temp.als('33333333-3333-3333-3333-333333333331');
insert into probe select 'V1 Voraussetzung: Team ist Mitglied und sieht den Betrieb (erwartet 1)', (select count(*) from public.betriebe where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into probe select 'V2 VOR Teil B: Team liest Einkaufsbelege (der Anlassfall)', least((select count(*) from public.einkaufsbelege where betrieb_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1);
insert into probe select 'V3 VOR Teil B: Team liest Rezepturen', least((select count(*) from public.rezepturen where betrieb_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1);
insert into probe select 'V4 VOR Teil B: Team liest die Kalkulation (Zeilen)', least((select count(*) from public.gericht_kalkulation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')), 1);
reset role;
select pg_temp.als('33333333-3333-3333-3333-333333333332');
insert into probe select 'V5 VOR Teil B: Küche liest Lagerbewegungen', least((select count(*) from public.lagerbewegungen where betrieb_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1);
reset role;
select * from probe;
rollback;
