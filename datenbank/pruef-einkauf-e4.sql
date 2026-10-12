-- ═══════════════════════════════════════════════════════════════════
--  pruef-einkauf-e4.sql · zurückgedrehte Probe für migration-einkauf-e4.sql
--  Am Stück ausführen; dreht sich selbst zurück. Echte Konten:
--  Master (hallo@omoteno.de), Inhaber Choco (A), Inhaber Minhkeey (B),
--  Blend-Inhaber als Zentrale. Choco und Minhkeey werden IN der Probe
--  zu einer Kette zusammengelegt — danach wird gemessen, dass A von B
--  nichts liest (Belege, Preise, Bestand, letzter_preis, „vorher“ bei
--  der Freigabe, Wert eines Verlusts) und die Zentrale nur Zahlen sieht.
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(nr int, schritt text, ergebnis text);
grant all on probe to authenticated, anon;
select set_config('p.a', '153c5425-cd7a-42e4-a629-38cee3524951', true);   -- Inhaber Choco (A)
select set_config('p.f', 'bf6ea9ba-a97d-4ae7-a700-25d35afa0095', true);   -- Inhaber Minhkeey (B)
select set_config('p.z', '4a60e8c2-1933-4228-aeff-c799894e846d', true);   -- Blend-Inhaber, wird Zentrale
select set_config('p.m', (select id::text from auth.users where lower(email) = 'hallo@omoteno.de'), true);
select set_config('p.zmail', (select email from auth.users where id = '4a60e8c2-1933-4228-aeff-c799894e846d'), true);
select set_config('p.ba', 'af095b14-d9ef-41f4-9b97-c4422b0de63f', true);
select set_config('p.bb', 'cb560d8c-a72b-4687-b212-0a708c28ea62', true);
select set_config('p.bc', '03793490-635a-460a-ac61-b08bbd7fd5bf', true);  -- Blend, andere Kette
select set_config('p.oa', 'ff88aba9-de5e-42b1-b65c-28593d97f21a', true);
select set_config('p.ob', '3ac3be90-fb7b-4ee3-85ce-8aa2432aec14', true);
select set_config('p.g', (select id::text from gerichte where betrieb_id = 'af095b14-d9ef-41f4-9b97-c4422b0de63f' and verfuegbar and name !~ '\(' order by id limit 1), true);
select set_config('p.g2', (select id::text from gerichte where betrieb_id = 'af095b14-d9ef-41f4-9b97-c4422b0de63f' and verfuegbar and name !~ '\(' order by id offset 1 limit 1), true);
-- Gleichnamiges Gericht in B (Ziel für die gemeinsame Rezeptur)
insert into gerichte (betrieb_id, name, kategorie, preis, karte)
select current_setting('p.bb')::uuid, name, 'Probe', preis, 'speisekarte' from gerichte where id = current_setting('p.g')::uuid;
-- Gericht nur in A, mit Rezeptur — Ziel B hat es nicht (kein_gericht)
with g as (insert into gerichte (betrieb_id, name, kategorie, preis, karte) values (current_setting('p.ba')::uuid, 'Probe-Nur-A E4', 'Probe', 5, 'speisekarte') returning id)
select set_config('p.g3', (select id::text from g), true);
insert into rezepturen (betrieb_id, gericht_id, portionen, mwst, notiz) values (current_setting('p.ba')::uuid, current_setting('p.g3')::uuid, 1, 7, 'Probe');
insert into probe select 0, 'Voraussetzungen', 'master ' || (current_setting('p.m') <> '') || ' · zentrale-Mail ' || (current_setting('p.zmail') <> '')
  || ' · Gericht ' || (select name from gerichte where id = current_setting('p.g')::uuid);
insert into pin_sitzungen(nutzer_id, sitzung, bis) values
  (current_setting('p.a')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.f')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.z')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.m')::uuid, 'probe-s', now() + interval '1 hour') on conflict do nothing;

-- ── 1 · Vorher: jeder Standort seine Organisation, je ein Mehl mit eigenem Preis ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare v_art uuid; v_lief uuid; r jsonb; begin
  insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.oa')::uuid, 'Probe-Mehl E4', 'g') returning id into v_art;
  insert into lieferanten(organisation_id, name) values (current_setting('p.oa')::uuid, 'Probe-Großhandel E4') returning id into v_lief;
  perform set_config('p.arta', v_art::text, true); perform set_config('p.liefa', v_lief::text, true);
  r := public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'E4-A1', 'belegdatum', (current_date - 2)::text, 'netto', 20,
       'positionen', jsonb_build_array(jsonb_build_object('text','Mehl 25 kg','art','ware','artikel_id',v_art,'menge',1,'gebinde_basis',25000,'netto',20))));
  insert into probe values (1, 'A: Einkauf Mehl 20 €', public.beleg_freigeben((r->>'id')::uuid)::text);
  r := public.rezeptur_speichern(current_setting('p.g')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge_basis', 200)), 2, 7::smallint, 'Probe E4');
  insert into probe values (2, 'A: Rezeptur', r::text);
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.f'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare v_art uuid; v_lief uuid; r jsonb; begin
  insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.ob')::uuid, 'Probe-Mehl E4', 'g') returning id into v_art;
  insert into lieferanten(organisation_id, name) values (current_setting('p.ob')::uuid, 'Probe-Großhandel E4') returning id into v_lief;
  perform set_config('p.artb', v_art::text, true);
  r := public.beleg_speichern(null, current_setting('p.bb')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'E4-B1', 'belegdatum', (current_date - 1)::text, 'netto', 50,
       'positionen', jsonb_build_array(jsonb_build_object('text','Mehl 25 kg','art','ware','artikel_id',v_art,'menge',1,'gebinde_basis',25000,'netto',50))));
  insert into probe values (3, 'B: Einkauf Mehl 50 € (0,002 €/g)', public.beleg_freigeben((r->>'id')::uuid)::text);
  insert into probe values (4, 'B (kein Master): zusammenlegen', public.master_organisation_zusammenlegen(current_setting('p.oa')::uuid, current_setting('p.ob')::uuid)::text);
  insert into probe values (5, 'B (kein Master): Zentrale setzen', public.master_zentrale_setzen(current_setting('p.oa')::uuid, current_setting('p.zmail'), true)::text);
  insert into probe values (6, 'B (kein Master): master_ketten', public.master_ketten()::text);
end $$;
reset role;

-- ── 2 · Master legt zusammen und setzt die Zentrale ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.m'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (10, 'Master: gleich', public.master_organisation_zusammenlegen(current_setting('p.oa')::uuid, current_setting('p.oa')::uuid)::text);
  insert into probe values (11, 'Master: zusammenlegen B → A', public.master_organisation_zusammenlegen(current_setting('p.oa')::uuid, current_setting('p.ob')::uuid, 'Probe-Kette')::text);
  insert into probe values (12, 'Master: Zentrale unbekannte Mail', public.master_zentrale_setzen(current_setting('p.oa')::uuid, 'gibt-es-nicht@example.invalid', true)::text);
  insert into probe values (13, 'Master: Zentrale setzen', public.master_zentrale_setzen(current_setting('p.oa')::uuid, current_setting('p.zmail'), true)::text);
  insert into probe select 14, 'Master: master_ketten Probe-Kette', (select o::text from jsonb_array_elements(public.master_ketten() -> 'organisationen') o where o ->> 'id' = current_setting('p.oa'));
  -- Gründe der gemeinsamen Rezeptur über den Master (hat das Recht)
  insert into probe values (15, 'Master: andere Kette', public.rezeptur_uebertragen(current_setting('p.g')::uuid, current_setting('p.bc')::uuid)::text);
  insert into probe values (16, 'Master: keine Rezeptur', public.rezeptur_uebertragen(current_setting('p.g2')::uuid, current_setting('p.bb')::uuid)::text);
end $$;
reset role;
insert into probe select 17, 'nach dem Zusammenlegen: Organisation von B = A', ((select organisation_id from betriebe where id = current_setting('p.bb')::uuid) = current_setting('p.oa')::uuid)::text;
insert into probe select 18, 'Mehl von B umbenannt', string_agg(name, ' | ' order by name) from artikel where organisation_id = current_setting('p.oa')::uuid and name like 'Probe-Mehl E4%';
insert into probe select 19, 'Protokoll: Kette am Betrieb B', coalesce(string_agg(name || ' · ' || array_to_string(felder, ','), '; '), 'keine Zeile') from protokoll where betrieb_id = current_setting('p.bb')::uuid and 'organisation_id' = any(felder) and zeit >= now();

-- ── 3 · A (nur Inhaber von A) sieht von B nichts ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare r jsonb; v_lief uuid; begin
  insert into probe select 20, 'A liest B: Belege/Positionen/Preise/Bestand/Bewegungen',
    (select count(*) from einkaufsbelege where betrieb_id = current_setting('p.bb')::uuid) || '/' ||
    (select count(*) from einkaufspositionen p join einkaufsbelege e on e.id = p.beleg_id where e.betrieb_id = current_setting('p.bb')::uuid) || '/' ||
    (select count(*) from artikel_preise where betrieb_id = current_setting('p.bb')::uuid) || '/' ||
    (select count(*) from lagerbestand where betrieb_id = current_setting('p.bb')::uuid) || '/' ||
    (select count(*) from lagerbewegungen where betrieb_id = current_setting('p.bb')::uuid);
  begin
    perform letzter_preis from lieferanten_artikel limit 1;
    insert into probe values (21, 'A liest lieferanten_artikel.letzter_preis', 'GING DURCH');
  exception when others then insert into probe values (21, 'A liest lieferanten_artikel.letzter_preis', sqlstate); end;
  insert into probe select 22, 'A sieht geteilte Artikel (2 Mehl)', count(*)::text from artikel where name like 'Probe-Mehl E4%';
  insert into probe select 23, 'A: meine_ketten / zentrale_vergleich', (select count(*) from public.meine_ketten()) || ' / ' ||
    (select count(*) from public.zentrale_vergleich(current_setting('p.oa')::uuid, now() - interval '30 days', now()));
  insert into probe select 24, 'A: Kalkulation B / Wareneinsatz B', (select count(*) from public.gericht_kalkulation(current_setting('p.bb')::uuid)) || ' / ' ||
    public.wareneinsatz_theoretisch(current_setting('p.bb')::uuid, now() - interval '30 days', now())::text;
  -- Verlust auf B's Mehl in A: A hat dafür keinen Preis → Wert null (vorher: B's 0,002 €/g)
  insert into probe values (25, 'A: Verlust 1 kg auf B-Mehl ohne eigenen Preis', public.verlust_buchen(current_setting('p.ba')::uuid, current_setting('p.artb')::uuid, 1000)::text);
  -- Einkauf von B's Mehl in A: kein 'vorher' aus B
  select id into v_lief from lieferanten where name = 'Probe-Großhandel E4' order by id limit 1;
  r := public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'E4-A2', 'belegdatum', current_date::text, 'netto', 30,
       'positionen', jsonb_build_array(jsonb_build_object('text','Mehl 25 kg B','art','ware','artikel_id',current_setting('p.artb'),'menge',1,'gebinde_basis',25000,'netto',30))));
  insert into probe values (26, 'A: Einkauf B-Mehl 30 € — Preisänderungen leer', public.beleg_freigeben((r->>'id')::uuid)::text);
  insert into probe values (27, 'A: Verlust jetzt mit eigenem Preis (−1,20)', public.verlust_buchen(current_setting('p.ba')::uuid, current_setting('p.artb')::uuid, 1000)::text);
  insert into probe select 28, 'A: Kosten/Portion (200 g × 0,0008 / 2 = 0,08)', kosten::text from public.gericht_kosten_portion(current_setting('p.g')::uuid);
  insert into probe values (29, 'A (nicht Inhaber von B): Rezeptur übertragen', public.rezeptur_uebertragen(current_setting('p.g')::uuid, current_setting('p.bb')::uuid)::text);
end $$;
reset role;

-- ── 4 · Zentrale vergleicht, liest aber keine Belege ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.z'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe select 30, 'Zentrale: meine_ketten', string_agg(name || ' · ' || standorte || ' · zentrale ' || zentrale, ', ') from public.meine_ketten();
  insert into probe select 31, 'Zentrale: Vergleich je Standort', string_agg(name || ': Einkauf ' || einkauf_netto || ' (' || belege || ') Lager ' || lagerwert || ' Verlust ' || verlust_wert || ' Rezepturen ' || mit_rezeptur || '/' || gerichte, ' | ' order by name)
    from public.zentrale_vergleich(current_setting('p.oa')::uuid, now() - interval '30 days', now() + interval '1 minute');
  insert into probe select 32, 'Zentrale: rohe Belege A/B', (select count(*) from einkaufsbelege where betrieb_id in (current_setting('p.ba')::uuid, current_setting('p.bb')::uuid))::text;
  insert into probe select 33, 'Zentrale: Vergleich 500 Tage (Grenze 400)', count(*)::text from public.zentrale_vergleich(current_setting('p.oa')::uuid, now() - interval '500 days', now());
  insert into probe values (34, 'Zentrale: Rezeptur A → B', public.rezeptur_uebertragen(current_setting('p.g')::uuid, current_setting('p.bb')::uuid)::text);
  insert into probe values (35, 'Zentrale: kein gleichnamiges Gericht', public.rezeptur_uebertragen(current_setting('p.g3')::uuid, current_setting('p.bb')::uuid)::text);
  insert into probe values (38, 'Zentrale: Ziel = Quelle', public.rezeptur_uebertragen(current_setting('p.g')::uuid, current_setting('p.ba')::uuid)::text);
  insert into probe values (36, 'Zentrale: zusammenlegen', public.master_organisation_zusammenlegen(current_setting('p.oa')::uuid, current_setting('p.ob')::uuid)::text);
end $$;
reset role;
insert into probe select 37, 'B hat jetzt eine Fassung (Notiz)', string_agg(r.notiz || ' · ' || (select count(*) from rezepturpositionen p where p.rezeptur_id = r.id) || ' Pos', ', ')
  from rezepturen r join gerichte g on g.id = r.gericht_id where g.betrieb_id = current_setting('p.bb')::uuid;

-- ── 5 · Inhaber beider Standorte darf vergleichen ──
insert into betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (current_setting('p.bb')::uuid, current_setting('p.a')::uuid, 'inhaber');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe select 40, 'Inhaber beider: meine_ketten / Vergleich', (select count(*) from public.meine_ketten()) || ' / ' ||
    (select count(*) from public.zentrale_vergleich(current_setting('p.oa')::uuid, now() - interval '30 days', now()));
end $$;
reset role;

-- ── 6 · Zentrale abgeschaltet ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.m'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (50, 'Master: Zentrale aus', public.master_zentrale_setzen(current_setting('p.oa')::uuid, current_setting('p.zmail'), false)::text);
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.z'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe select 51, 'ehemalige Zentrale: meine_ketten / Vergleich', (select count(*) from public.meine_ketten()) || ' / ' ||
    (select count(*) from public.zentrale_vergleich(current_setting('p.oa')::uuid, now() - interval '30 days', now()));
end $$;
reset role;

-- ── 7 · anon und Katalog ──
set local role anon;
do $$ begin
  begin perform public.zentrale_vergleich(current_setting('p.oa')::uuid, now() - interval '1 day', now()); insert into probe values (60, 'anon Vergleich', 'GING DURCH');
  exception when others then insert into probe values (60, 'anon Vergleich', sqlstate); end;
  begin perform public.master_ketten(); insert into probe values (61, 'anon master_ketten', 'GING DURCH');
  exception when others then insert into probe values (61, 'anon master_ketten', sqlstate); end;
  begin perform 1 from organisation_mitglieder; insert into probe values (62, 'anon organisation_mitglieder', 'GING DURCH');
  exception when others then insert into probe values (62, 'anon organisation_mitglieder', sqlstate); end;
end $$;
reset role;
select * from probe order by nr;
rollback;
