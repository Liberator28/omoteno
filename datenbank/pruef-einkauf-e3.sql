-- ═══════════════════════════════════════════════════════════════════
--  pruef-einkauf-e3.sql · zurückgedrehte Probe für migration-einkauf-e3.sql
--  Am Stück ausführen; dreht sich selbst zurück. Konten wie
--  pruef-einkauf.sql (Inhaber Choco, Blend-Inhaber als Team, Minhkeey-
--  Inhaber als Fremder). Erwartete Werte stehen im Schritt-Text.
--  Rechnung: Mehl 20 €/25 kg = 0,0008 €/g, Milch 12 €/12 l = 0,001 €/ml.
--  200 g Mehl +10 % Verlust + 300 ml Milch, 2 Portionen → 0,238 €.
--  Mehl ab 10.10. 30 € → 0,0012 €/g → 0,282 €. Neue Fassung 400 g → 0,414 €.
--  Wareneinsatz der Bestellungen rechnet mit der Fassung, die zur
--  Bestellzeit galt (now() steht in der Transaktion still, die neue
--  Fassung gilt ab now(), die Bestellungen liegen davor) → 3 × 0,282.
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(nr int, schritt text, ergebnis text);
grant all on probe to authenticated, anon;
select set_config('p.a', '153c5425-cd7a-42e4-a629-38cee3524951', true);
select set_config('p.t', '4a60e8c2-1933-4228-aeff-c799894e846d', true);
select set_config('p.f', 'bf6ea9ba-a97d-4ae7-a700-25d35afa0095', true);
select set_config('p.b', 'af095b14-d9ef-41f4-9b97-c4422b0de63f', true);
select set_config('p.org', 'ff88aba9-de5e-42b1-b65c-28593d97f21a', true);
-- fremder Artikel: in der Organisation des Minhkeey-Betriebs, als postgres angelegt (der Bestand hat keinen)
with a as (insert into artikel(organisation_id, name, basiseinheit)
  select organisation_id, 'Probe-Fremdartikel', 'g' from betriebe where id = 'cb560d8c-a72b-4687-b212-0a708c28ea62' returning id)
select set_config('p.fremd_art', (select id::text from a), true);
insert into probe select 9, 'fremder Artikel angelegt (Voraussetzung)', (current_setting('p.fremd_art') <> '')::text;
select set_config('p.g', (select id::text from gerichte where betrieb_id = 'af095b14-d9ef-41f4-9b97-c4422b0de63f' and verfuegbar and name !~ '\(' order by id limit 1), true);
select set_config('p.gname', (select name from gerichte where id = current_setting('p.g')::uuid), true);
select set_config('p.gpreis', (select preis::text from gerichte where id = current_setting('p.g')::uuid), true);
insert into probe values (0, 'Probegericht', current_setting('p.gname') || ' · ' || current_setting('p.gpreis') || ' €');
insert into betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (current_setting('p.b')::uuid, current_setting('p.t')::uuid, 'team');
insert into pin_sitzungen(nutzer_id, sitzung, bis) values
  (current_setting('p.a')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.t')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.f')::uuid, 'probe-s', now() + interval '1 hour') on conflict do nothing;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$
declare v_mehl uuid; v_milch uuid; v_lief uuid; r jsonb; v_rz uuid;
begin
  insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.org')::uuid, 'Probe-Mehl E3', 'g') returning id into v_mehl;
  insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.org')::uuid, 'Probe-Milch E3', 'ml') returning id into v_milch;
  insert into lieferanten(organisation_id, name) values (current_setting('p.org')::uuid, 'Probe-Großhandel E3') returning id into v_lief;
  perform set_config('p.mehl', v_mehl::text, true); perform set_config('p.milch', v_milch::text, true);
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'E3-1', 'belegdatum', '2026-10-01', 'netto', 32,
       'positionen', jsonb_build_array(
         jsonb_build_object('text','Mehl 25 kg','art','ware','artikel_id',v_mehl,'menge',1,'gebinde_basis',25000,'netto',20),
         jsonb_build_object('text','Milch 1 l','art','ware','artikel_id',v_milch,'menge',12,'gebinde_basis',1000,'netto',12))));
  insert into probe values (1, 'Einkauf 1.10.', public.beleg_freigeben((r->>'id')::uuid)::text);
  r := public.rezeptur_speichern(current_setting('p.g')::uuid, jsonb_build_array(
         jsonb_build_object('artikel_id', v_mehl, 'menge_basis', 200, 'verlust_prozent', 10),
         jsonb_build_object('artikel_id', v_milch, 'menge_basis', 300)), 2, 7::smallint, 'Probe');
  insert into probe values (2, 'Rezeptur speichern', r::text);
  insert into probe select 3, 'Kosten/Portion heute (0,238)', kosten::text || ' · Pos ' || positionen || ' · ohne Preis ' || ohne_preis from public.gericht_kosten_portion(current_setting('p.g')::uuid);
  insert into probe select 4, 'Kalkulation: Wareneinsatz = 0,238/(Preis/1,07)', kosten::text || ' · ' || wareneinsatz::text || ' · soll ' ||
       round(0.238 / (current_setting('p.gpreis')::numeric / 1.07), 4)::text from public.gericht_kalkulation(current_setting('p.b')::uuid) where gericht_id = current_setting('p.g')::uuid;
  -- Preisänderung am 10.10.: Mehl 30 € statt 20 €
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'E3-2', 'belegdatum', '2026-10-10', 'netto', 30,
       'positionen', jsonb_build_array(jsonb_build_object('text','Mehl 25 kg','art','ware','artikel_id',v_mehl,'menge',1,'gebinde_basis',25000,'netto',30))));
  insert into probe values (5, 'Einkauf 10.10. (+50 %)', public.beleg_freigeben((r->>'id')::uuid)::text);
  insert into probe select 6, 'heute nach Preisänderung (0,282)', kosten::text from public.gericht_kosten_portion(current_setting('p.g')::uuid);
  insert into probe select 7, 'Stichtag 5.10. vor gueltig_ab: keine Zeile', count(*)::text from public.gericht_kosten_portion(current_setting('p.g')::uuid, '2026-10-05 12:00+02');
  insert into probe select 8, 'Stichtag 30.9. (vor Rezeptur): leer', count(*)::text from public.gericht_kosten_portion(current_setting('p.g')::uuid, '2026-09-30 12:00+02');
  -- Gründe
  insert into probe values (10, 'Menge 0', public.rezeptur_speichern(current_setting('p.g')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', v_mehl, 'menge_basis', 0)), 1, 7::smallint)::text);
  insert into probe values (11, 'Artikel doppelt', public.rezeptur_speichern(current_setting('p.g')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', v_mehl, 'menge_basis', 1), jsonb_build_object('artikel_id', v_mehl, 'menge_basis', 2)), 1, 7::smallint)::text);
  insert into probe values (12, 'fremder Artikel', public.rezeptur_speichern(current_setting('p.g')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', current_setting('p.fremd_art'), 'menge_basis', 1)), 1, 7::smallint)::text);
  insert into probe values (13, 'MwSt 5', public.rezeptur_speichern(current_setting('p.g')::uuid, '[]'::jsonb, 1, 5::smallint)::text);
  insert into probe values (14, 'Portionen 0', public.rezeptur_speichern(current_setting('p.g')::uuid, '[]'::jsonb, 0, 7::smallint)::text);
  insert into probe values (15, 'Verlust 95 %', public.rezeptur_speichern(current_setting('p.g')::uuid, jsonb_build_array(jsonb_build_object('artikel_id', v_mehl, 'menge_basis', 1, 'verlust_prozent', 95)), 1, 7::smallint)::text);
  -- Positionen tragen gericht_id
end $$;
reset role;
insert into probe select 16, 'positionen_pruefen: gericht_id', (public.positionen_pruefen(current_setting('p.b')::uuid,
       jsonb_build_array(jsonb_build_object('name', current_setting('p.gname'), 'menge', 2, 'preis', current_setting('p.gpreis')),
                         jsonb_build_object('name', 'Gibt es nicht', 'menge', 1, 'preis', 3))) -> 'positionen')::text;
-- Versionen: alte Fassung in die Vergangenheit, neue mit 400 g Mehl heute
update rezepturen set gueltig_ab = '2026-10-02 00:00+02' where gericht_id = current_setting('p.g')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.rezeptur_speichern(current_setting('p.g')::uuid, jsonb_build_array(
         jsonb_build_object('artikel_id', current_setting('p.mehl'), 'menge_basis', 400, 'verlust_prozent', 10),
         jsonb_build_object('artikel_id', current_setting('p.milch'), 'menge_basis', 300)), 2, 7::smallint, 'mehr Mehl');
  insert into probe values (20, 'neue Fassung', r::text);
  insert into probe select 21, 'heute neue Fassung ((440*0,0012+0,3)/2=0,414)', kosten::text from public.gericht_kosten_portion(current_setting('p.g')::uuid);
  insert into probe select 22, 'vor 2 Tagen alte Fassung (0,282)', kosten::text from public.gericht_kosten_portion(current_setting('p.g')::uuid, now() - interval '2 days');
  insert into probe select 24, 'Stichtag 5.10.: alte Fassung, alter Preis (0,238)', kosten::text from public.gericht_kosten_portion(current_setting('p.g')::uuid, '2026-10-05 12:00+02');
  insert into probe select 23, 'Fassungen gesamt', count(*)::text from rezepturen where gericht_id = current_setting('p.g')::uuid;
end $$;
reset role;
-- Wareneinsatz theoretisch: zwei Bestellungen heute (2× mit gericht_id, 1× nur Name), eine storniert, ein Serviceruf
insert into bestellungen(betrieb_id, quelle, status, positionen, summe, zeitpunkt)
values (current_setting('p.b')::uuid, 'tisch', 'neu', (public.positionen_pruefen(current_setting('p.b')::uuid,
          jsonb_build_array(jsonb_build_object('name', current_setting('p.gname'), 'menge', 2, 'preis', current_setting('p.gpreis'))))) -> 'positionen', 0, now() - interval '1 minute'),
       (current_setting('p.b')::uuid, 'tisch', 'fertig', jsonb_build_array(jsonb_build_object('name', current_setting('p.gname'), 'menge', 1, 'preis', current_setting('p.gpreis')::numeric)), 0, now() - interval '2 minutes'),
       (current_setting('p.b')::uuid, 'tisch', 'storniert', jsonb_build_array(jsonb_build_object('name', current_setting('p.gname'), 'menge', 5, 'preis', 1)), 0, now() - interval '3 minutes'),
       (current_setting('p.b')::uuid, 'service', 'neu', '[]'::jsonb, 0, now() - interval '4 minutes');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (30, 'Wareneinsatz 3 Portionen, Fassung zur Bestellzeit (3×0,282=0,85)', public.wareneinsatz_theoretisch(current_setting('p.b')::uuid, now() - interval '10 minutes', now() + interval '1 minute')::text);
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.t'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (40, 'Team speichert Rezeptur', public.rezeptur_speichern(current_setting('p.g')::uuid, '[]'::jsonb, 1, 7::smallint)::text);
  insert into probe select 41, 'Team liest Kalkulation', coalesce(kosten::text, 'null') from public.gericht_kalkulation(current_setting('p.b')::uuid) where gericht_id = current_setting('p.g')::uuid;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.f'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (50, 'Fremd speichert Rezeptur', public.rezeptur_speichern(current_setting('p.g')::uuid, '[]'::jsonb, 1, 7::smallint)::text);
  insert into probe select 51, 'Fremd: Kalkulation A Zeilen', count(*)::text from public.gericht_kalkulation(current_setting('p.b')::uuid);
  insert into probe select 52, 'Fremd: Rezepturen A', count(*)::text from rezepturen where betrieb_id = current_setting('p.b')::uuid;
  insert into probe select 53, 'Fremd: Kosten direkt', coalesce((select kosten::text from public.gericht_kosten_portion(current_setting('p.g')::uuid)), 'keine Zeile');
  insert into probe values (54, 'Fremd: Wareneinsatz A', public.wareneinsatz_theoretisch(current_setting('p.b')::uuid, now() - interval '10 minutes', now() + interval '1 minute')::text);
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.gericht_kalkulation(current_setting('p.b')::uuid); insert into probe values (60, 'anon Kalkulation', 'GING DURCH'); exception when others then insert into probe values (60, 'anon Kalkulation', sqlstate); end;
  begin perform 1 from rezepturen; insert into probe values (61, 'anon Rezepturen', 'GING DURCH'); exception when others then insert into probe values (61, 'anon Rezepturen', sqlstate); end;
end $$;
reset role;
insert into probe select 70, 'Signaturen', string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', '; ' order by p.proname)
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('positionen_pruefen','rezeptur_speichern','gericht_kosten_portion','gericht_kalkulation','wareneinsatz_theoretisch');
insert into probe select 71, 'positionen_pruefen EXECUTE anon/auth', has_function_privilege('anon', 'public.positionen_pruefen(uuid,jsonb)', 'EXECUTE')::text || '/' || has_function_privilege('authenticated', 'public.positionen_pruefen(uuid,jsonb)', 'EXECUTE')::text;
insert into probe select 72, 'Rechte rezepturen', relacl::text from pg_class where relname = 'rezepturen';
select * from probe order by nr;
rollback;
