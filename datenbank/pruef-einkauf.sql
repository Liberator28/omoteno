-- ═══════════════════════════════════════════════════════════════════
--  pruef-einkauf.sql · zurückgedrehte Probe für migration-einkauf.sql
--  Im SQL-Editor oder über den MCP am Stück ausführen; dreht sich am
--  Ende selbst zurück. Drei echte Konten: Inhaber Choco (A), der
--  Blend-Inhaber wird testweise Team bei Choco (T), der Minhkeey-
--  Inhaber ist der Fremde (F). Ergebnis: eine Tabelle „probe“.
--  Schreibproben zählen Zeilen, ohne returning (§2.3b).
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(nr int, schritt text, ergebnis text);
grant all on probe to authenticated, anon;
select set_config('p.a', '153c5425-cd7a-42e4-a629-38cee3524951', true);
select set_config('p.t', '4a60e8c2-1933-4228-aeff-c799894e846d', true);
select set_config('p.f', 'bf6ea9ba-a97d-4ae7-a700-25d35afa0095', true);
select set_config('p.b', 'af095b14-d9ef-41f4-9b97-c4422b0de63f', true);
select set_config('p.org', 'ff88aba9-de5e-42b1-b65c-28593d97f21a', true);
-- Voraussetzungen als postgres: Blend-Inhaber wird Team bei Choco, alle drei mit PIN-Sitzung.
insert into betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (current_setting('p.b')::uuid, current_setting('p.t')::uuid, 'team');
insert into pin_sitzungen(nutzer_id, sitzung, bis) values
  (current_setting('p.a')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.t')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.f')::uuid, 'probe-s', now() + interval '1 hour')
  on conflict do nothing;
insert into probe select 0, 'protokoll vorher', count(*)::text from protokoll where tabelle = 'einkaufsbelege';

-- ═══ Inhaber A ═══
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$
declare v_art uuid; v_lief uuid; r jsonb; id1 uuid; id2 uuid; id3 uuid; n int; pos jsonb;
begin
  insert into probe values (1, 'A ist_master / ist_inhaber', public.ist_master()::text || ' / ' || public.ist_inhaber(current_setting('p.b')::uuid)::text);
  insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.org')::uuid, 'Probe-Wein', 'ml') returning id into v_art;
  insert into lieferanten(organisation_id, name) values (current_setting('p.org')::uuid, 'Probe-Lieferant') returning id into v_lief;
  perform set_config('p.art', v_art::text, true);
  perform set_config('p.lief', v_lief::text, true);
  pos := jsonb_build_array(jsonb_build_object('text', 'Wein 0,75 l', 'art', 'ware', 'artikel_id', v_art, 'menge', 12,
                                              'gebinde_basis', 750, 'netto', 54, 'steuersatz', 19, 'einkaufseinheit', 'Flasche'));
  r := public.beleg_speichern(null, current_setting('p.b')::uuid,
        jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'r-1', 'belegdatum', '2026-10-01', 'netto', 54, 'positionen', pos));
  insert into probe values (2, 'speichern r-1', r::text);
  id1 := (r ->> 'id')::uuid; perform set_config('p.id1', id1::text, true);
  r := public.beleg_freigeben(id1);
  insert into probe values (3, 'freigeben r-1', r::text);
  insert into probe select 4, 'Bestand ml (9000)', coalesce(sum(menge_basis), 0)::text from lagerbestand where artikel_id = v_art;
  insert into probe select 5, '€/l (6,00)', (round(preis_basis * 1000, 2))::text from artikel_preise where beleg_id = id1;
  insert into probe select 6, 'gelernt', string_agg(bezeichnung || ' · ' || gebinde_basis || ' · ' || letzter_preis, '; ') from lieferanten_artikel where lieferant_id = v_lief;
  -- zweiter Beleg, gleiche Nummer
  r := public.beleg_speichern(null, current_setting('p.b')::uuid,
        jsonb_build_object('lieferant_id', v_lief, 'belegnummer', ' R-1 ', 'belegdatum', '2026-10-02', 'netto', 54, 'positionen', pos));
  id2 := (r ->> 'id')::uuid; perform set_config('p.id2', id2::text, true);
  insert into probe values (7, 'doppelt r-1', public.beleg_freigeben(id2)::text);
  -- freigegeben unveraenderlich
  begin
    update einkaufsbelege set netto = 1 where id = id1; get diagnostics n = row_count;
    insert into probe values (8, 'UPDATE freigegeben direkt', n || ' Zeilen');
  exception when others then insert into probe values (8, 'UPDATE freigegeben direkt', sqlstate || ' ' || sqlerrm); end;
  insert into probe values (9, 'speichern auf freigegeben', public.beleg_speichern(id1, null, '{"netto":1}')::text);
  begin
    update artikel set basiseinheit = 'g' where id = v_art; get diagnostics n = row_count;
    insert into probe values (10, 'basiseinheit aendern', n || ' Zeilen');
  exception when others then insert into probe values (10, 'basiseinheit aendern', sqlstate || ' ' || sqlerrm); end;
  update artikel set name = 'Probe-Wein rot' where id = v_art; get diagnostics n = row_count;
  insert into probe values (11, 'Name aendern (erlaubt)', n || ' Zeilen');
  -- Gruende
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'r-3', 'netto', 10,
        'positionen', jsonb_build_array(jsonb_build_object('text', 'Unbekannt', 'art', 'ware', 'menge', 1, 'netto', 10))));
  insert into probe values (12, 'nicht zugeordnet', public.beleg_freigeben((r ->> 'id')::uuid)::text);
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'r-4', 'netto', 60, 'positionen', pos));
  insert into probe values (13, 'summe 54 vs 60', public.beleg_freigeben((r ->> 'id')::uuid)::text);
  insert into probe values (14, 'Datum 32.13.', public.beleg_speichern(null, current_setting('p.b')::uuid,
        jsonb_build_object('belegdatum', '32.13.2026'))::text);
  insert into probe values (15, 'Netto "abc"', public.beleg_speichern(null, current_setting('p.b')::uuid,
        jsonb_build_object('netto', 'abc'))::text);
  -- +20 %
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'r-2', 'belegdatum', '2026-10-05', 'netto', 64.80,
        'positionen', jsonb_build_array(jsonb_build_object('text', 'Wein 0,75 l', 'art', 'ware', 'artikel_id', v_art, 'menge', 12, 'gebinde_basis', 750, 'netto', 64.80))));
  id3 := (r ->> 'id')::uuid;
  insert into probe values (16, 'r-2 +20 %', public.beleg_freigeben(id3)::text);
  insert into probe select 17, 'Bestand nach r-2 (18000)', sum(menge_basis)::text from lagerbestand where artikel_id = v_art;
  -- Storno
  insert into probe values (18, 'storno r-1', public.beleg_stornieren(id1)::text);
  insert into probe select 19, 'Bestand nach Storno (9000)', sum(menge_basis)::text from lagerbestand where artikel_id = v_art;
  insert into probe values (20, 'zweites storno', public.beleg_stornieren(id1)::text);
  insert into probe values (21, 'r-1 neu nach Storno', public.beleg_freigeben(id2)::text);
  insert into probe select 22, 'Bestand am Ende (18000)', sum(menge_basis)::text from lagerbestand where artikel_id = v_art;
  -- verwerfen
  r := public.beleg_speichern(null, current_setting('p.b')::uuid, '{"belegnummer":"weg"}');
  perform set_config('p.entwurf', r ->> 'id', true);
  insert into probe values (23, 'Entwurf fuer Team/Fremd', r::text);
end $$;
reset role;

-- ═══ Team T bei Choco ═══
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.t'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$
declare n int;
begin
  insert into probe select 30, 'Team liest Belege', count(*)::text from einkaufsbelege where betrieb_id = current_setting('p.b')::uuid;
  insert into probe select 31, 'Team liest Artikel', count(*)::text from artikel where id = current_setting('p.art')::uuid;
  insert into probe values (32, 'Team legt Beleg an', public.beleg_speichern(null, current_setting('p.b')::uuid, '{}')::text);
  insert into probe values (33, 'Team gibt frei', public.beleg_freigeben(current_setting('p.entwurf')::uuid)::text);
  insert into probe values (34, 'Team storniert', public.beleg_stornieren(current_setting('p.id2')::uuid)::text);
  insert into probe values (35, 'Team verwirft', public.beleg_verwerfen(current_setting('p.entwurf')::uuid)::text);
  begin
    insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.org')::uuid, 'Team-Artikel', 'g');
    insert into probe values (36, 'Team legt Artikel an', 'GING DURCH');
  exception when others then insert into probe values (36, 'Team legt Artikel an', sqlstate || ' ' || sqlerrm); end;
  update artikel set name = 'Team war hier' where id = current_setting('p.art')::uuid; get diagnostics n = row_count;
  insert into probe values (37, 'Team aendert Artikel', n || ' Zeilen');
end $$;
reset role;

-- ═══ Fremder F (Minhkeey) ═══
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.f'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$
declare n int;
begin
  insert into probe select 40, 'Fremd liest Belege A', count(*)::text from einkaufsbelege where betrieb_id = current_setting('p.b')::uuid;
  insert into probe select 41, 'Fremd liest Artikel A', count(*)::text from artikel where organisation_id = current_setting('p.org')::uuid;
  insert into probe select 42, 'Fremd liest Bestand A', count(*)::text from lagerbestand where betrieb_id = current_setting('p.b')::uuid;
  insert into probe select 43, 'Fremd liest Positionen A', count(*)::text from einkaufspositionen where beleg_id = current_setting('p.id2')::uuid;
  update artikel set name = 'Fremd' where id = current_setting('p.art')::uuid; get diagnostics n = row_count;
  insert into probe values (44, 'Fremd aendert Artikel A', n || ' Zeilen');
  insert into probe values (45, 'Fremd gibt frei', public.beleg_freigeben(current_setting('p.entwurf')::uuid)::text);
  insert into probe values (46, 'Fremd speichert in A', public.beleg_speichern(null, current_setting('p.b')::uuid, '{}')::text);
  insert into probe values (47, 'Fremd speichert Entwurf A', public.beleg_speichern(current_setting('p.entwurf')::uuid, null, '{}')::text);
  begin
    insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.org')::uuid, 'Fremd-Artikel', 'g');
    insert into probe values (48, 'Fremd legt Artikel in A an', 'GING DURCH');
  exception when others then insert into probe values (48, 'Fremd legt Artikel in A an', sqlstate); end;
end $$;
reset role;

-- ═══ anon ═══
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
do $$ begin
  begin perform 1 from einkaufsbelege limit 1; insert into probe values (50, 'anon liest Belege', 'GING DURCH');
  exception when others then insert into probe values (50, 'anon liest Belege', sqlstate); end;
  begin perform 1 from artikel limit 1; insert into probe values (51, 'anon liest Artikel', 'GING DURCH');
  exception when others then insert into probe values (51, 'anon liest Artikel', sqlstate); end;
  begin perform public.beleg_speichern(null, current_setting('p.b')::uuid, '{}'); insert into probe values (52, 'anon beleg_speichern', 'GING DURCH');
  exception when others then insert into probe values (52, 'anon beleg_speichern', sqlstate); end;
  begin perform 1 from lagerbestand limit 1; insert into probe values (53, 'anon liest Bestand', 'GING DURCH');
  exception when others then insert into probe values (53, 'anon liest Bestand', sqlstate); end;
end $$;
reset role;

-- ═══ als postgres: Protokoll, Signaturen, Rechte, neuer Betrieb ═══
insert into probe select 60, 'protokoll neu', string_agg(art || ':' || coalesce(name, '?'), ', ' order by zeit) from protokoll
  where tabelle = 'einkaufsbelege' and zeit >= now() - interval '1 minute';
insert into probe select 61, 'Signaturen', string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', '; ' order by p.proname)
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('beleg_speichern','beleg_verwerfen','beleg_freigeben','beleg_stornieren','meine_organisationen','ist_org_inhaber','lieferanten_artikel_ok','betrieb_organisation_anlegen');
insert into probe select 62, 'Rechte ' || c.relname,
   'auth s/i/u/d ' || has_table_privilege('authenticated', c.oid, 'SELECT')::int || has_table_privilege('authenticated', c.oid, 'INSERT')::int
   || has_table_privilege('authenticated', c.oid, 'UPDATE')::int || has_table_privilege('authenticated', c.oid, 'DELETE')::int
   || ' · anon ' || has_table_privilege('anon', c.oid, 'SELECT')::int || has_table_privilege('anon', c.oid, 'INSERT')::int
   || has_table_privilege('anon', c.oid, 'UPDATE')::int || has_table_privilege('anon', c.oid, 'DELETE')::int
  from pg_class c where c.relnamespace = 'public'::regnamespace
   and c.relname in ('organisationen','artikel','lieferanten','lieferanten_artikel','einkaufsbelege','einkaufspositionen','lagerbewegungen','lagerbestand','artikel_preise');
insert into probe select 63, 'anon EXECUTE beleg_*', string_agg(p.proname || '=' || has_function_privilege('anon', p.oid, 'EXECUTE')::text, ', ')
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'beleg\_%';
insert into probe select 64, 'Betriebe ohne Organisation', count(*)::text from betriebe where organisation_id is null;
do $$ declare o uuid; begin
  insert into betriebe(name, slug, test_bis) values ('Probe-Haus', 'probe-haus-einkauf', now() + interval '14 days') returning organisation_id into o;
  insert into probe values (65, 'neuer Betrieb bekommt Organisation', (o is not null)::text);
exception when others then insert into probe values (65, 'neuer Betrieb bekommt Organisation', 'nicht messbar: ' || sqlstate || ' ' || sqlerrm); end $$;
select * from probe order by nr;
rollback;
