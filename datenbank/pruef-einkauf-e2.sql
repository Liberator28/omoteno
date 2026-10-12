-- ═══════════════════════════════════════════════════════════════════
--  pruef-einkauf-e2.sql · zurückgedrehte Probe für migration-einkauf-e2.sql
--  Am Stück ausführen; dreht sich selbst zurück. Drei echte Konten wie
--  pruef-einkauf.sql (Inhaber Choco, Blend-Inhaber als Team, Minhkeey-
--  Inhaber als Fremder). Speicherregeln werden mit echten Zeilen in
--  storage.objects gemessen, nicht mit der Regel im Katalog.
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(nr int, schritt text, ergebnis text);
grant all on probe to authenticated, anon;
select set_config('p.a', '153c5425-cd7a-42e4-a629-38cee3524951', true);
select set_config('p.t', '4a60e8c2-1933-4228-aeff-c799894e846d', true);
select set_config('p.f', 'bf6ea9ba-a97d-4ae7-a700-25d35afa0095', true);
select set_config('p.b', 'af095b14-d9ef-41f4-9b97-c4422b0de63f', true);
select set_config('p.org', 'ff88aba9-de5e-42b1-b65c-28593d97f21a', true);
select set_config('p.hash', repeat('ab', 32), true);
select set_config('p.pfad', 'af095b14-d9ef-41f4-9b97-c4422b0de63f/' || gen_random_uuid() || '.jpg', true);
insert into betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (current_setting('p.b')::uuid, current_setting('p.t')::uuid, 'team');
insert into pin_sitzungen(nutzer_id, sitzung, bis) values
  (current_setting('p.a')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.t')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.f')::uuid, 'probe-s', now() + interval '1 hour') on conflict do nothing;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$
declare v_art uuid; v_lief uuid; r jsonb; id1 uuid; n int;
begin
  insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.org')::uuid, 'Probe-Mehl', 'g') returning id into v_art;
  insert into lieferanten(organisation_id, name) values (current_setting('p.org')::uuid, 'Probe-Mühle') returning id into v_lief;
  perform set_config('p.art', v_art::text, true);
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'M-1', 'netto', 20, 'quelle', 'foto',
        'datei_pfad', current_setting('p.pfad'), 'datei_hash', current_setting('p.hash'),
        'positionen', jsonb_build_array(jsonb_build_object('text','Mehl 25 kg','art','ware','artikel_id',v_art,'menge',1,'gebinde_basis',25000,'netto',20))));
  insert into probe values (1, 'Foto-Entwurf mit Datei', r::text);
  id1 := (r->>'id')::uuid;
  insert into probe select 2, 'gespeichert: quelle/pfad/hash', quelle || ' · ' || (datei_pfad = current_setting('p.pfad'))::text || ' · ' || (datei_hash = current_setting('p.hash'))::text from einkaufsbelege where id = id1;
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('datei_pfad', current_setting('p.b') || '/' || gen_random_uuid() || '.jpg', 'datei_hash', upper(current_setting('p.hash'))));
  insert into probe values (3, 'gleiche Datei nochmal (Hash GROSS)', r::text);
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('datei_pfad', 'cb560d8c-a72b-4687-b212-0a708c28ea62/' || gen_random_uuid() || '.jpg'));
  insert into probe values (4, 'Pfad im fremden Ordner', r::text);
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('datei_hash', 'kein-hash'));
  insert into probe values (5, 'Hash in falscher Form', r::text);
  r := public.beleg_speichern(id1, null, jsonb_build_object('netto', 20, 'datei_pfad', 'x', 'datei_hash', repeat('cd',32), 'positionen', '[]'::jsonb));
  insert into probe select 6, 'Ändern behält Datei', r::text || ' · ' || (datei_hash = current_setting('p.hash'))::text from einkaufsbelege where id = id1;
  insert into probe values (7, 'Verwerfen', public.beleg_verwerfen(id1)::text);
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('datei_hash', current_setting('p.hash')));
  insert into probe values (8, 'nach Verwerfen: Datei wieder frei', r::text);
  -- Lager: Eingang 25 kg über Freigabe, dann Inventur 20 kg, dann Verlust 1 kg
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'M-2', 'netto', 20,
        'positionen', jsonb_build_array(jsonb_build_object('text','Mehl 25 kg','art','ware','artikel_id',v_art,'menge',1,'gebinde_basis',25000,'netto',20))));
  insert into probe values (9, 'Eingang 25 kg', public.beleg_freigeben((r->>'id')::uuid)::text);
  r := public.inventur_buchen(current_setting('p.b')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge', 20000)), 'Monatsende');
  insert into probe values (10, 'Inventur 20 kg gezählt', r::text);
  insert into probe select 11, 'Bestand nach Inventur (20000)', sum(menge_basis)::text from lagerbestand where artikel_id = v_art;
  r := public.inventur_buchen(current_setting('p.b')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge', 20000)), null);
  insert into probe values (12, 'gleiche Zählung nochmal: 0 Buchungen', r::text);
  insert into probe values (13, 'Verlust 1 kg', public.verlust_buchen(current_setting('p.b')::uuid, v_art, 1000, 'Feuchtigkeit')::text);
  insert into probe select 14, 'Bestand nach Verlust (19000)', sum(menge_basis)::text from lagerbestand where artikel_id = v_art;
  insert into probe values (15, 'Inventur negativ', public.inventur_buchen(current_setting('p.b')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge', -1)))::text);
  insert into probe values (16, 'Inventur leer', public.inventur_buchen(current_setting('p.b')::uuid, '[]'::jsonb)::text);
  insert into probe values (17, 'Inventur Zahl "abc"', public.inventur_buchen(current_setting('p.b')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', v_art, 'menge', 'abc')))::text);
  insert into probe values (18, 'Verlust 0', public.verlust_buchen(current_setting('p.b')::uuid, v_art, 0)::text);
  -- Speicher: Inhaber lädt hoch
  begin
    insert into storage.objects(bucket_id, name, owner) values ('belege', current_setting('p.pfad'), auth.uid());
    insert into probe values (19, 'Inhaber lädt Beleg hoch', 'ok');
  exception when others then insert into probe values (19, 'Inhaber lädt Beleg hoch', sqlstate || ' ' || sqlerrm); end;
  begin
    insert into storage.objects(bucket_id, name, owner) values ('belege', current_setting('p.b') || '/rechnung.png', auth.uid());
    insert into probe values (20, 'Name außerhalb der Form', 'GING DURCH');
  exception when others then insert into probe values (20, 'Name außerhalb der Form', sqlstate); end;
  begin
    insert into storage.objects(bucket_id, name, owner) values ('belege', 'cb560d8c-a72b-4687-b212-0a708c28ea62/' || gen_random_uuid() || '.jpg', auth.uid());
    insert into probe values (21, 'in fremden Ordner hochladen', 'GING DURCH');
  exception when others then insert into probe values (21, 'in fremden Ordner hochladen', sqlstate); end;
  insert into probe select 22, 'Inhaber liest Datei', count(*)::text from storage.objects where bucket_id = 'belege' and name = current_setting('p.pfad');
  insert into probe select 23, 'Inhaber liest Inventuren', count(*)::text from inventuren where betrieb_id = current_setting('p.b')::uuid;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.t'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (30, 'Team Inventur', public.inventur_buchen(current_setting('p.b')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', current_setting('p.art'), 'menge', 1)))::text);
  insert into probe values (31, 'Team Verlust', public.verlust_buchen(current_setting('p.b')::uuid, current_setting('p.art')::uuid, 1)::text);
  insert into probe select 32, 'Team liest Datei', count(*)::text from storage.objects where bucket_id = 'belege' and name = current_setting('p.pfad');
  begin
    insert into storage.objects(bucket_id, name, owner) values ('belege', current_setting('p.b') || '/' || gen_random_uuid() || '.jpg', auth.uid());
    insert into probe values (33, 'Team lädt hoch', 'GING DURCH');
  exception when others then insert into probe values (33, 'Team lädt hoch', sqlstate); end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.f'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe select 40, 'Fremd liest Datei', count(*)::text from storage.objects where bucket_id = 'belege' and name = current_setting('p.pfad');
  insert into probe select 41, 'Fremd liest Inventuren', count(*)::text from inventuren where betrieb_id = current_setting('p.b')::uuid;
  insert into probe values (42, 'Fremd Verlust in A', public.verlust_buchen(current_setting('p.b')::uuid, current_setting('p.art')::uuid, 1)::text);
  insert into probe values (43, 'Fremd speichert Hash in A', public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('datei_hash', current_setting('p.hash')))::text);
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from inventuren; insert into probe values (50, 'anon liest Inventuren', 'GING DURCH'); exception when others then insert into probe values (50, 'anon liest Inventuren', sqlstate); end;
  begin perform public.inventur_buchen(current_setting('p.b')::uuid, '[]'::jsonb); insert into probe values (51, 'anon inventur_buchen', 'GING DURCH'); exception when others then insert into probe values (51, 'anon inventur_buchen', sqlstate); end;
  begin perform count(*) from storage.objects where bucket_id = 'belege'; insert into probe select 52, 'anon sieht Belegdateien', count(*)::text from storage.objects where bucket_id = 'belege'; exception when others then insert into probe values (52, 'anon sieht Belegdateien', sqlstate); end;
end $$;
reset role;
insert into probe select 60, 'Signaturen', string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', '; ' order by p.proname)
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('beleg_speichern','inventur_buchen','verlust_buchen','artikel_letzter_preis');
insert into probe select 61, 'EXECUTE auth/anon', string_agg(p.proname || ' ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::int || has_function_privilege('anon', p.oid, 'EXECUTE')::int, ', ' order by p.proname)
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('inventur_buchen','verlust_buchen','artikel_letzter_preis');
insert into probe select 62, 'Rechte inventuren', relacl::text from pg_class where relname = 'inventuren';
insert into probe select 63, 'Eimer', id || ' public=' || public || ' ' || file_size_limit || ' ' || array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'belege';
select * from probe order by nr;
rollback;
