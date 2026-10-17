-- ═══════════════════════════════════════════════════════════════════
--  pruef-einkauf-e5c.sql · zurückgedrehte Probe für migration-einkauf-e5c.sql
--  Choco (A) und Minhkeey (B) in einer Kette; Inhaber A nur in A,
--  Inhaber F nur in B. In einer Transaktion ist now() überall gleich —
--  die Zeitpunkte der Bewegungen setzt die Probe deshalb als Eigentümer,
--  sonst trennte der Stichtag nichts (§8.1g).
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(nr int, schritt text, ergebnis text);
grant all on probe to authenticated, anon;
select set_config('p.a', '153c5425-cd7a-42e4-a629-38cee3524951', true);
select set_config('p.f', 'bf6ea9ba-a97d-4ae7-a700-25d35afa0095', true);
select set_config('p.ba', 'af095b14-d9ef-41f4-9b97-c4422b0de63f', true);
select set_config('p.bb', 'cb560d8c-a72b-4687-b212-0a708c28ea62', true);
select set_config('p.oa', 'ff88aba9-de5e-42b1-b65c-28593d97f21a', true);
update betriebe set organisation_id = current_setting('p.oa')::uuid where id = current_setting('p.bb')::uuid;
insert into pin_sitzungen(nutzer_id, sitzung, bis) values
  (current_setting('p.a')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.f')::uuid, 'probe-s', now() + interval '1 hour') on conflict do nothing;
insert into probe select 0, 'Katalog: inventur_buchen in public', string_agg(pg_get_function_identity_arguments(p.oid), ' | ')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'inventur_buchen';
insert into probe select 0, 'Katalog: alte inventur_buchen im archiv ohne EXECUTE', coalesce((select has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'archiv' and p.proname = 'inventur_buchen_vor_e5c'), 'fehlt');
insert into probe select 0, 'verlust_buchen über darf_lager_buchen', (position('darf_lager_buchen(p_betrieb)' in pg_get_functiondef('public.verlust_buchen(uuid,uuid,numeric,text)'::regprocedure)) > 0)::text;
insert into probe select 0, 'Rechte: authenticated schreibt nicht direkt (false/false/false), anon liest nicht (false)',
  has_table_privilege('authenticated', 'public.artikel_standort', 'INSERT') || '/' || has_table_privilege('authenticated', 'public.lieferanten_standort', 'UPDATE') || '/' ||
  has_table_privilege('authenticated', 'public.inventur_entwurf', 'INSERT') || ' · ' || has_table_privilege('anon', 'public.inventur_entwurf', 'SELECT');

-- ── Vorbereitung als A: Artikel, Lieferant, Einkauf 10 kg ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare v_art uuid; v_lief uuid; r jsonb; begin
  insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.oa')::uuid, 'Probe-Mehl E5C', 'g') returning id into v_art;
  insert into lieferanten(organisation_id, name) values (current_setting('p.oa')::uuid, 'Probe-Mühle E5C') returning id into v_lief;
  perform set_config('p.art', v_art::text, true); perform set_config('p.lief', v_lief::text, true);
  r := public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'E5C-1', 'netto', 20,
       'positionen', jsonb_build_array(jsonb_build_object('text','Mehl 10 kg','art','ware','artikel_id',v_art,'menge',1,'gebinde_basis',10000,'netto',20))));
  perform public.beleg_freigeben((r->>'id')::uuid);
  perform public.verlust_buchen(current_setting('p.ba')::uuid, v_art, 2000, 'Probe');
end $$;
reset role;
-- Eingang vor drei Tagen, Verlust vor einer Stunde (als Eigentümer gesetzt)
update lagerbewegungen set zeitpunkt = now() - interval '3 days' where artikel_id = current_setting('p.art')::uuid and art = 'eingang';
update lagerbewegungen set zeitpunkt = now() - interval '1 hour' where artikel_id = current_setting('p.art')::uuid and art = 'verlust';

-- ── 15 · Sortiment je Standort ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (10, 'A: Mehl hier aus, Mindestbestand 5 kg, Keller', public.artikel_standort_setzen(current_setting('p.ba')::uuid, current_setting('p.art')::uuid,
    '{"aktiv":false,"mindestbestand":5000,"lagerort":"Keller","reihenfolge":3}')::text);
  insert into probe values (11, 'A: nochmal (ändert, keine zweite Zeile)', public.artikel_standort_setzen(current_setting('p.ba')::uuid, current_setting('p.art')::uuid,
    '{"aktiv":false,"mindestbestand":6000,"lagerort":"Keller"}')::text || ' · Zeilen ' || (select count(*) from artikel_standort where artikel_id = current_setting('p.art')::uuid));
  insert into probe values (12, 'Form: −1 / 61 Zeichen / „vielleicht“ / Liste',
    (public.artikel_standort_setzen(current_setting('p.ba')::uuid, current_setting('p.art')::uuid, '{"mindestbestand":-1}')->>'grund') || ' / ' ||
    (public.artikel_standort_setzen(current_setting('p.ba')::uuid, current_setting('p.art')::uuid, jsonb_build_object('lagerort', repeat('x', 61)))->>'grund') || ' / ' ||
    (public.artikel_standort_setzen(current_setting('p.ba')::uuid, current_setting('p.art')::uuid, '{"aktiv":"vielleicht"}')->>'grund') || ' / ' ||
    (public.artikel_standort_setzen(current_setting('p.ba')::uuid, current_setting('p.art')::uuid, '[]')->>'grund'));
  insert into probe values (13, 'fremder Artikel', public.artikel_standort_setzen(current_setting('p.ba')::uuid,
    (select id from artikel where organisation_id <> current_setting('p.oa')::uuid limit 1), '{}')->>'grund');
  insert into probe values (14, 'A setzt in B (nicht Mitglied)', public.artikel_standort_setzen(current_setting('p.bb')::uuid, current_setting('p.art')::uuid, '{}')->>'grund');
  insert into probe select 15, 'nach Formfehlern unverändert (6000 / Keller / false)', mindestbestand || ' / ' || lagerort || ' / ' || aktiv
    from artikel_standort where artikel_id = current_setting('p.art')::uuid and betrieb_id = current_setting('p.ba')::uuid;
  insert into probe values (16, 'A: Lieferant für A „K-A“, Liefertage mo/do, 150 €', public.lieferant_standort_setzen(current_setting('p.ba')::uuid, current_setting('p.lief')::uuid,
    '{"kundennummer":"K-A","ansprechpartner":"Frau Probe","liefertage":["mo","do"],"mindestbestellwert":150}')::text);
  insert into probe values (17, 'Form: Liefertag „xx“ / −5 €',
    (public.lieferant_standort_setzen(current_setting('p.ba')::uuid, current_setting('p.lief')::uuid, '{"liefertage":["mo","xx"]}')->>'grund') || ' / ' ||
    (public.lieferant_standort_setzen(current_setting('p.ba')::uuid, current_setting('p.lief')::uuid, '{"mindestbestellwert":-5}')->>'grund'));
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.f'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (20, 'F liest Sortiment/Lieferantenangaben von A (0/0)', (select count(*) from artikel_standort where betrieb_id = current_setting('p.ba')::uuid) || '/' ||
    (select count(*) from lieferanten_standort where betrieb_id = current_setting('p.ba')::uuid));
  insert into probe values (21, 'F: Artikel in B weiter aktiv (keine Zeile = Kette)', coalesce((select aktiv::text from artikel_standort where betrieb_id = current_setting('p.bb')::uuid
    and artikel_id = current_setting('p.art')::uuid), 'keine Zeile') || ' / artikel.aktiv ' || (select aktiv from artikel where id = current_setting('p.art')::uuid));
  insert into probe values (22, 'F: eigene Kundennummer „K-B“', public.lieferant_standort_setzen(current_setting('p.bb')::uuid, current_setting('p.lief')::uuid, '{"kundennummer":"K-B"}')::text);
  insert into probe values (23, 'F sieht nur seine (K-B)', (select string_agg(kundennummer, ',') from lieferanten_standort where lieferant_id = current_setting('p.lief')::uuid));
  insert into probe values (24, 'F setzt Sortiment in A', public.artikel_standort_setzen(current_setting('p.ba')::uuid, current_setting('p.art')::uuid, '{}')->>'grund');
  insert into probe values (25, 'F: Zwischenstand für A / Verlust in A / Inventur in A',
    (public.inventur_entwurf_sichern(current_setting('p.ba')::uuid, '{}')->>'grund') || ' / ' ||
    (public.verlust_buchen(current_setting('p.ba')::uuid, current_setting('p.art')::uuid, 1)->>'grund') || ' / ' ||
    (public.inventur_buchen(current_setting('p.ba')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', current_setting('p.art'), 'menge', 0)))->>'grund'));
end $$;
reset role;
insert into probe select 26, 'Kundennummern als Eigentümer (K-A, K-B)', string_agg(kundennummer, ', ' order by kundennummer) from lieferanten_standort where lieferant_id = current_setting('p.lief')::uuid;

-- ── 18 · Zählliste: Zwischenstand und Stichtag ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare r jsonb; begin
  insert into probe values (30, 'A: Zwischenstand sichern', public.inventur_entwurf_sichern(current_setting('p.ba')::uuid,
    jsonb_build_object(current_setting('p.art'), '9'), now() - interval '1 day')::text);
  insert into probe values (31, 'Zwischenstand kein Objekt', public.inventur_entwurf_sichern(current_setting('p.ba')::uuid, '[]')->>'grund');
  insert into probe values (32, 'Stichtag morgen / vor 70 Tagen',
    (public.inventur_buchen(current_setting('p.ba')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', current_setting('p.art'), 'menge', 9000)), null, now() + interval '1 day')->>'grund') || ' / ' ||
    (public.inventur_buchen(current_setting('p.ba')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', current_setting('p.art'), 'menge', 9000)), null, now() - interval '70 days')->>'grund'));
  -- gestern gezählt: 9 kg. Bestand GESTERN 10 kg → −1 kg. (Ohne Stichtag: 8 kg jetzt → +1 kg.)
  r := public.inventur_buchen(current_setting('p.ba')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', current_setting('p.art'), 'menge', 9000)), 'Probe', now() - interval '1 day');
  perform set_config('p.inv', r->>'id', true);
  insert into probe values (33, 'Inventur zum Stichtag gestern: 9 kg gezählt', r::text);
end $$;
reset role;
insert into probe select 34, 'Inventur-Bewegung: Menge −1000, Zeitpunkt = gestern', menge_basis || ' · ' || (abs(extract(epoch from (zeitpunkt - (now() - interval '1 day')))) < 1)::text
  from lagerbewegungen where inventur_id = current_setting('p.inv')::uuid;
insert into probe select 35, 'gezaehlt_am der Inventur = Stichtag', (abs(extract(epoch from (gezaehlt_am - (now() - interval '1 day')))) < 1)::text from inventuren where id = current_setting('p.inv')::uuid;
insert into probe select 36, 'Bestand jetzt (10 − 2 − 1 = 7000 g)', menge_basis::text from lagerbestand where betrieb_id = current_setting('p.ba')::uuid and artikel_id = current_setting('p.art')::uuid;
insert into probe select 37, 'Zwischenstand nach dem Buchen geleert', daten::text || ' / ' || coalesce(stichtag::text, 'kein Stichtag') from inventur_entwurf where betrieb_id = current_setting('p.ba')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  -- alter Aufruf über Namen, ohne p_stichtag (wie die Seite vor E5-C) — trägt weiter
  insert into probe values (38, 'alter Aufruf ohne Stichtag (7 kg gezählt → nichts zu buchen)', public.inventur_buchen(p_betrieb => current_setting('p.ba')::uuid,
    p_zaehlung => jsonb_build_array(jsonb_build_object('artikel_id', current_setting('p.art'), 'menge', 7000)), p_notiz => 'alt')::text);
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.inventur_entwurf_sichern(current_setting('p.ba')::uuid, '{}'); insert into probe values (40, 'anon Zwischenstand', 'GING DURCH');
  exception when others then insert into probe values (40, 'anon Zwischenstand', sqlstate); end;
  begin perform 1 from artikel_standort; insert into probe values (41, 'anon liest Sortiment', 'GING DURCH');
  exception when others then insert into probe values (41, 'anon liest Sortiment', sqlstate); end;
end $$;
reset role;
select * from probe order by nr;
rollback;
