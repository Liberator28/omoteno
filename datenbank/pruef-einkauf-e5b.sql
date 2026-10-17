-- ═══════════════════════════════════════════════════════════════════
--  pruef-einkauf-e5b.sql · zurückgedrehte Probe für migration-einkauf-e5b.sql
--  Choco (A) und Minhkeey (B) werden IN der Probe eine Kette; Inhaber A
--  ist Inhaber in A und B, Inhaber F nur in B, Blend (C) ist eine andere
--  Kette. Gemessen wird die Wertgleichheit über die Kette, jeder Grund
--  (mit Zeilenzahl, §2.3b) und dass ein Grund nichts halb gebucht lässt.
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(nr int, schritt text, ergebnis text);
grant all on probe to authenticated, anon;
select set_config('p.a', '153c5425-cd7a-42e4-a629-38cee3524951', true);
select set_config('p.f', 'bf6ea9ba-a97d-4ae7-a700-25d35afa0095', true);
select set_config('p.c', '4a60e8c2-1933-4228-aeff-c799894e846d', true);
select set_config('p.ba', 'af095b14-d9ef-41f4-9b97-c4422b0de63f', true);
select set_config('p.bb', 'cb560d8c-a72b-4687-b212-0a708c28ea62', true);
select set_config('p.bc', '03793490-635a-460a-ac61-b08bbd7fd5bf', true);
select set_config('p.oa', 'ff88aba9-de5e-42b1-b65c-28593d97f21a', true);
update betriebe set organisation_id = current_setting('p.oa')::uuid where id = current_setting('p.bb')::uuid;
insert into betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (current_setting('p.bb')::uuid, current_setting('p.a')::uuid, 'inhaber');
insert into pin_sitzungen(nutzer_id, sitzung, bis) values
  (current_setting('p.a')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.f')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.c')::uuid, 'probe-s', now() + interval '1 hour') on conflict do nothing;
insert into probe select 0, 'Katalog: je eine Fassung', string_agg(proname || '=' || c, ', ' order by proname) from
  (select p.proname, count(*) c from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    and p.proname in ('umlagerung_anlegen','umlagerung_annehmen','umlagerung_zurueckziehen','beleg_verschieben','darf_lager_buchen','beleg_freigeben') group by 1) x;
insert into probe select 0, 'Rechte: anon lesen / authenticated schreiben (alles false)',
  has_table_privilege('anon', 'public.umlagerungen', 'SELECT') || '/' || has_table_privilege('anon', 'public.umlagerungspositionen', 'SELECT') || '/' ||
  has_table_privilege('authenticated', 'public.umlagerungen', 'INSERT') || '/' || has_table_privilege('authenticated', 'public.umlagerungen', 'UPDATE') || '/' ||
  has_table_privilege('authenticated', 'public.umlagerungspositionen', 'INSERT') || '/' ||
  has_function_privilege('anon', 'public.umlagerung_anlegen(uuid,uuid,jsonb,text,uuid)', 'EXECUTE');
insert into probe select 0, 'beleg_freigeben trägt „is distinct from“', (position('pr.beleg_id is distinct from b.id' in pg_get_functiondef('public.beleg_freigeben(uuid)'::regprocedure)) > 0)::text;

-- ── 1 · A kauft 10 kg Mehl für 20 € und schickt 4 kg nach B ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare v_art uuid; v_art2 uuid; v_lief uuid; r jsonb; r2 jsonb; n0 int; begin
  insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.oa')::uuid, 'Probe-Mehl E5B', 'g') returning id into v_art;
  insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.oa')::uuid, 'Probe-ohne-Preis E5B', 'g') returning id into v_art2;
  insert into lieferanten(organisation_id, name) values (current_setting('p.oa')::uuid, 'Probe-Mühle E5B') returning id into v_lief;
  perform set_config('p.art', v_art::text, true); perform set_config('p.art2', v_art2::text, true); perform set_config('p.lief', v_lief::text, true);
  r := public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'E5B-1', 'netto', 20,
       'positionen', jsonb_build_array(jsonb_build_object('text','Mehl 10 kg','art','ware','artikel_id',v_art,'menge',1,'gebinde_basis',10000,'netto',20))));
  perform set_config('p.beleg1', r->>'id', true);
  insert into probe values (1, 'A: Einkauf 10 kg / 20 €', public.beleg_freigeben((r->>'id')::uuid)->>'ok');
  r := public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.bb')::uuid,
       jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge_basis', 4000)), 'Probe');
  perform set_config('p.u1', r->>'id', true);
  insert into probe values (2, 'A → B 4 kg (Wert 8,00, Bestand nicht negativ)', r::text);
  -- Gründe: jeder ohne Rest
  select count(*) into n0 from umlagerungen;
  insert into probe values (3, 'gleich', public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.ba')::uuid, '[{"artikel_id":"00000000-0000-4000-8000-000000000000","menge_basis":1}]')->>'grund');
  insert into probe values (4, 'andere Kette (Blend)', public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.bc')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge_basis', 1)))->>'grund');
  insert into probe values (5, 'keine Positionen', public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.bb')::uuid, '[]')->>'grund');
  insert into probe values (6, 'doppelter Artikel', (public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.bb')::uuid,
    jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge_basis', 1), jsonb_build_object('artikel_id', v_art, 'menge_basis', 2))) - 'ok')::text);
  insert into probe values (7, 'Menge 0', (public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.bb')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge_basis', 0))) - 'ok')::text);
  insert into probe values (8, 'Menge „viel“', (public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.bb')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge_basis', 'viel'))) - 'ok')::text);
  insert into probe values (9, 'Artikel einer fremden Kette', (public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.bb')::uuid,
    jsonb_build_array(jsonb_build_object('artikel_id', (select id from artikel where organisation_id <> current_setting('p.oa')::uuid limit 1), 'menge_basis', 1))) - 'ok')::text);
  -- ohne Preis, als ZWEITE Position: die erste darf nicht stehen bleiben
  insert into probe values (10, 'Pos 2 ohne Preis → Grund, Pos 1 nicht gebucht', (public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.bb')::uuid,
    jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge_basis', 100), jsonb_build_object('artikel_id', v_art2, 'menge_basis', 1))) - 'ok')::text);
  insert into probe select 11, 'Umlagerungen nach allen Gründen unverändert (1 = 1)', (select count(*) from umlagerungen) || ' = ' || n0;
  insert into probe values (12, 'fremder Beleg als Quelle', public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.bb')::uuid,
    jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge_basis', 1)), null, '00000000-0000-4000-8000-000000000000')->>'grund');
  begin
    insert into umlagerungen(organisation_id, von_betrieb, nach_betrieb) values (current_setting('p.oa')::uuid, current_setting('p.ba')::uuid, current_setting('p.bb')::uuid);
    insert into probe values (13, 'direkt in umlagerungen schreiben', 'GING DURCH');
  exception when others then insert into probe values (13, 'direkt in umlagerungen schreiben', sqlstate); end;
end $$;
reset role;
insert into probe select 14, 'Bestand A nach dem Abschicken (6000 g / 12,00)', menge_basis || ' / ' || round(wert_netto, 2) from lagerbestand
  where betrieb_id = current_setting('p.ba')::uuid and artikel_id = current_setting('p.art')::uuid;

-- ── 2 · F (nur B) nimmt 3 kg an, 1 kg fehlt ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.f'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare r jsonb; n int; begin
  insert into probe values (20, 'F (nur B) schickt aus A', public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.bb')::uuid,
    jsonb_build_array(jsonb_build_object('artikel_id', current_setting('p.art'), 'menge_basis', 1)))->>'grund');
  insert into probe values (21, 'F zieht A''s Umlagerung zurück', public.umlagerung_zurueckziehen(current_setting('p.u1')::uuid)->>'grund');
  insert into probe values (22, 'F: angekommen 5000 > 4000', (public.umlagerung_annehmen(current_setting('p.u1')::uuid, '[{"pos":1,"menge_angekommen":5000}]') - 'ok')::text);
  insert into probe values (23, 'F: unbekannte Position', (public.umlagerung_annehmen(current_setting('p.u1')::uuid, '[{"pos":7,"menge_angekommen":1}]') - 'ok')::text);
end $$;
reset role;
-- Als Eigentümer gezählt: F sieht die Bewegungen von A gar nicht (RLS) — als F
-- gezählt stünde hier immer 0, auch wenn etwas gebucht worden wäre.
insert into probe select 24, 'nach den Gründen: Bewegungen der Umlagerung (nur transfer_aus = 1)', count(*)::text
  from lagerbewegungen where umlagerung_id = current_setting('p.u1')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.f'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (25, 'F sieht die Umlagerung (1)', (select count(*) from umlagerungen where id = current_setting('p.u1')::uuid)::text);
  insert into probe values (26, 'F nimmt 3000 an (Wert 6,00, fehlt 2,00)', public.umlagerung_annehmen(current_setting('p.u1')::uuid, '[{"pos":1,"menge_angekommen":3000}]')::text);
  insert into probe values (27, 'zweites Annehmen', public.umlagerung_annehmen(current_setting('p.u1')::uuid)->>'grund');
  insert into probe values (28, 'F liest A''s Preise/Belege (0/0)', (select count(*) from artikel_preise where betrieb_id = current_setting('p.ba')::uuid) || '/' ||
    (select count(*) from einkaufsbelege where betrieb_id = current_setting('p.ba')::uuid));
  insert into probe values (29, 'F: Preis in B aus der Umlagerung (0,002)', (select preis_basis from artikel_preise where betrieb_id = current_setting('p.bb')::uuid
    and artikel_id = current_setting('p.art')::uuid and beleg_id is null)::text);
end $$;
reset role;
insert into probe select 30, 'Bestand A / B (6000 / 12,00 · 3000 / 6,00)',
  (select menge_basis || ' / ' || round(wert_netto, 2) from lagerbestand where betrieb_id = current_setting('p.ba')::uuid and artikel_id = current_setting('p.art')::uuid) || ' · ' ||
  (select menge_basis || ' / ' || round(wert_netto, 2) from lagerbestand where betrieb_id = current_setting('p.bb')::uuid and artikel_id = current_setting('p.art')::uuid);
insert into probe select 31, 'Kette: Bewegungen ohne Verlust 20,00 + Verlust 2,00 · Lagerwert 18,00',
  round(sum(wert_netto) filter (where art <> 'verlust'), 2) || ' + ' || round(-sum(wert_netto) filter (where art = 'verlust'), 2) || ' · netto ' || round(sum(wert_netto), 2)
  from lagerbewegungen where artikel_id = current_setting('p.art')::uuid;
insert into probe select 32, 'Verlust beim Absender (A, −1000 g, −2,00)', string_agg(betrieb_id::text = current_setting('p.ba') || ' ' || menge_basis || ' ' || wert_netto, '; ')
  from lagerbewegungen where artikel_id = current_setting('p.art')::uuid and art = 'verlust';
insert into probe values (33, 'Preis B als Eigentümer (0,002000)', public.artikel_preis_betrieb(current_setting('p.art')::uuid, current_setting('p.bb')::uuid)::text);

-- ── 3 · B kauft teurer: „vorher“ kommt aus der Umlagerung ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.f'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.beleg_speichern(null, current_setting('p.bb')::uuid, jsonb_build_object('lieferant_id', current_setting('p.lief'), 'belegnummer', 'E5B-B1', 'netto', 30,
       'positionen', jsonb_build_array(jsonb_build_object('text','Mehl 10 kg','art','ware','artikel_id',current_setting('p.art'),'menge',1,'gebinde_basis',10000,'netto',30))));
  insert into probe values (40, 'B: Einkauf 0,003 €/g → Preisänderung vorher 0,002 (+50 %)', (public.beleg_freigeben((r->>'id')::uuid)->'preisaenderungen')::text);
end $$;
reset role;

-- ── 4 · Zurückziehen ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.umlagerung_anlegen(current_setting('p.ba')::uuid, current_setting('p.bb')::uuid,
       jsonb_build_array(jsonb_build_object('artikel_id', current_setting('p.art'), 'menge_basis', 7000)), null, current_setting('p.beleg1')::uuid);
  perform set_config('p.u2', r->>'id', true);
  insert into probe values (50, 'A → B 7 kg aus dem Beleg (Wert 14,00, Bestand negativ gemeldet)', r::text);
  insert into probe values (51, 'A zieht zurück', public.umlagerung_zurueckziehen((r->>'id')::uuid)::text);
  insert into probe values (52, 'nochmal zurückziehen / annehmen', (public.umlagerung_zurueckziehen((r->>'id')::uuid)->>'grund') || ' / ' || (public.umlagerung_annehmen((r->>'id')::uuid)->>'grund'));
end $$;
reset role;
insert into probe select 53, 'Bestand A wie vorher (6000 / 12,00)', menge_basis || ' / ' || round(wert_netto, 2) from lagerbestand
  where betrieb_id = current_setting('p.ba')::uuid and artikel_id = current_setting('p.art')::uuid;

-- ── 5 · Andere Kette sieht nichts, anon nichts ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.c'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (60, 'Blend liest Umlagerungen/Positionen (0/0)', (select count(*) from umlagerungen) || '/' || (select count(*) from umlagerungspositionen));
  insert into probe values (61, 'Blend nimmt A''s Umlagerung an', public.umlagerung_annehmen(current_setting('p.u2')::uuid)->>'grund');
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from umlagerungen; insert into probe values (62, 'anon liest umlagerungen', 'GING DURCH');
  exception when others then insert into probe values (62, 'anon liest umlagerungen', sqlstate); end;
  begin perform public.umlagerung_anlegen(null, null, '[]'); insert into probe values (63, 'anon umlagerung_anlegen', 'GING DURCH');
  exception when others then insert into probe values (63, 'anon umlagerung_anlegen', sqlstate); end;
end $$;
reset role;

-- ── 6 · Entwurf an den richtigen Standort ──
-- Die Datei im Ziel-Ordner legt die Probe als Eigentümer an (die Seite lädt sie hoch).
select set_config('p.dateiA', current_setting('p.ba') || '/11111111-2222-4333-8444-555555555555.jpg', true);
select set_config('p.dateiB', current_setting('p.bb') || '/11111111-2222-4333-8444-666666666666.jpg', true);
insert into storage.objects (bucket_id, name) values ('belege', current_setting('p.dateiB'));
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare r jsonb; r2 jsonb; begin
  r := public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('belegnummer', 'E5B-V', 'datei_pfad', current_setting('p.dateiA'), 'datei_hash', repeat('cd', 32)));
  perform set_config('p.bv', r->>'id', true);
  insert into probe values (70, 'ohne Kopie im Ziel', public.beleg_verschieben((r->>'id')::uuid, current_setting('p.bb')::uuid)->>'grund');
  insert into probe values (71, 'Pfad im falschen Ordner', public.beleg_verschieben((r->>'id')::uuid, current_setting('p.bb')::uuid, current_setting('p.dateiA'))->>'grund');
  insert into probe values (72, 'Pfad, den es nicht gibt', public.beleg_verschieben((r->>'id')::uuid, current_setting('p.bb')::uuid,
    current_setting('p.bb') || '/11111111-2222-4333-8444-777777777777.jpg')->>'grund');
  insert into probe values (73, 'andere Kette (A ist dort nicht Inhaber → zuerst kein_recht)', public.beleg_verschieben((r->>'id')::uuid, current_setting('p.bc')::uuid)->>'grund');
  insert into probe values (74, 'mit Kopie im Ziel', public.beleg_verschieben((r->>'id')::uuid, current_setting('p.bb')::uuid, current_setting('p.dateiB'))::text);
  insert into probe select 75, 'danach: Betrieb B, Pfad B', (betrieb_id = current_setting('p.bb')::uuid) || ' / ' || (datei_pfad = current_setting('p.dateiB'))
    from einkaufsbelege where id = current_setting('p.bv')::uuid;
  insert into probe values (76, 'freigegebenen Beleg verschieben', public.beleg_verschieben(current_setting('p.beleg1')::uuid, current_setting('p.bb')::uuid)->>'grund');
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.f'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (77, 'F (nicht Inhaber von A) verschiebt nach A', public.beleg_verschieben(current_setting('p.bv')::uuid, current_setting('p.ba')::uuid)->>'grund');
end $$;
reset role;

select * from probe order by nr;
rollback;
