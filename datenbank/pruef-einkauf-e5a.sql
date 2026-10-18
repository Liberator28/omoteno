-- ═══════════════════════════════════════════════════════════════════
--  pruef-einkauf-e5a.sql · zurückgedrehte Probe für migration-einkauf-e5a.sql
--  Am Stück ausführen; dreht sich selbst zurück. Choco (A) und
--  Minhkeey (B) werden IN der Probe eine Kette; Inhaber A wird zusätzlich
--  Inhaber in B (zwei Standorte, ein Mensch). Inhaber B bleibt nur in B.
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(nr int, schritt text, ergebnis text);
grant all on probe to authenticated, anon;
select set_config('p.a', '153c5425-cd7a-42e4-a629-38cee3524951', true);
select set_config('p.f', 'bf6ea9ba-a97d-4ae7-a700-25d35afa0095', true);
select set_config('p.ba', 'af095b14-d9ef-41f4-9b97-c4422b0de63f', true);
select set_config('p.bb', 'cb560d8c-a72b-4687-b212-0a708c28ea62', true);
select set_config('p.bc', '03793490-635a-460a-ac61-b08bbd7fd5bf', true);
select set_config('p.oa', 'ff88aba9-de5e-42b1-b65c-28593d97f21a', true);
update betriebe set organisation_id = current_setting('p.oa')::uuid where id = current_setting('p.bb')::uuid;
insert into betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (current_setting('p.bb')::uuid, current_setting('p.a')::uuid, 'inhaber');
insert into pin_sitzungen(nutzer_id, sitzung, bis) values
  (current_setting('p.a')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.f')::uuid, 'probe-s', now() + interval '1 hour') on conflict do nothing;
-- frische Kontingente, damit die Zählung bei 0 beginnt
update ki_kontingent set texte = 0 where tag = (now() at time zone 'Europe/Berlin')::date
   and betrieb_id in (current_setting('p.ba')::uuid, current_setting('p.bb')::uuid);
insert into probe select 0, 'Katalog: Fassungen ki_kontingent_nehmen (public)', string_agg(pg_get_function_identity_arguments(p.oid), ' | ')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'ki_kontingent_nehmen';
insert into probe select 0, 'Katalog: alte Fassung im archiv, anon/authenticated ohne EXECUTE',
  coalesce((select has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'archiv' and p.proname = 'ki_kontingent_nehmen_vor_e5'), 'fehlt');
insert into probe select 0, 'Katalog: je eine Fassung', string_agg(p.proname || '=' || c, ', ' order by p.proname) from
  (select p.proname, count(*) c from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    and p.proname in ('beleg_speichern','beleg_freigeben','artikel_preis_betrieb','artikel_letzter_preis','gericht_kosten_portion') group by 1) p;
insert into probe select 0, 'Katalog: artikel_preise security_invoker', array_to_string(reloptions, ',') from pg_class where oid = 'public.artikel_preise'::regclass;

-- ── 1 · Kontingent am richtigen Standort ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (1, 'A: 6 auf B (mit Standort)', public.ki_kontingent_nehmen(6, current_setting('p.bb')::uuid)::text);
  insert into probe values (2, 'A: 6 ohne Standort (alter Aufruf, fester kleinster Betrieb)', public.ki_kontingent_nehmen(6)::text);
  insert into probe values (3, 'A: fremder Standort (Blend) → -1', public.ki_kontingent_nehmen(6, current_setting('p.bc')::uuid)::text);
  insert into probe values (4, 'A: 0 / 26 Texte → -1', public.ki_kontingent_nehmen(0, current_setting('p.bb')::uuid) || ' / ' || public.ki_kontingent_nehmen(26, current_setting('p.bb')::uuid));
end $$;
reset role;
insert into probe select 5, 'gezählt: B / A (B=6; ohne Standort traf ' || (select min(b::text) from (select current_setting('p.ba') b union all select current_setting('p.bb')) x) || ')',
  coalesce((select texte::text from ki_kontingent where betrieb_id = current_setting('p.bb')::uuid and tag = (now() at time zone 'Europe/Berlin')::date), '–') || ' / ' ||
  coalesce((select texte::text from ki_kontingent where betrieb_id = current_setting('p.ba')::uuid and tag = (now() at time zone 'Europe/Berlin')::date), '–');

-- ── 2 · Fester letzter Preis, 3 · Doppelt je Standort, 6 · Datum ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare v_art uuid; v_lief uuid; r jsonb; r2 jsonb; i int; v_preis numeric; v_soll numeric; begin
  insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.oa')::uuid, 'Probe-Zucker E5', 'g') returning id into v_art;
  insert into lieferanten(organisation_id, name) values (current_setting('p.oa')::uuid, 'Probe-Lieferant E5') returning id into v_lief;
  perform set_config('p.art', v_art::text, true); perform set_config('p.lief', v_lief::text, true);
  -- Zehn Belege am SELBEN Tag in A, Preis steigt mit jeder Freigabe: der letzte freigegebene gilt.
  for i in 1..10 loop
    r := public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'E5-T' || i,
         'belegdatum', ((now() at time zone 'Europe/Berlin')::date - 3)::text, 'netto', i,
         'positionen', jsonb_build_array(jsonb_build_object('text','Zucker 1 kg','art','ware','artikel_id',v_art,'menge',1,'gebinde_basis',1000,'netto',i))));
    r2 := public.beleg_freigeben((r->>'id')::uuid);
    if not (r2->>'ok')::boolean then insert into probe values (10, 'Freigabe ' || i, r2::text); end if;
  end loop;
  -- Dieselbe Nummer im eigenen Standort → doppelt MIT id
  r := public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', ' e5-t1 ', 'netto', 1,
       'positionen', jsonb_build_array(jsonb_build_object('text','Zucker 1 kg','art','ware','artikel_id',v_art,'menge',1,'gebinde_basis',1000,'netto',1))));
  r2 := public.beleg_freigeben((r->>'id')::uuid);
  insert into probe values (12, 'eigener Standort: doppelt mit id', (r2->>'grund') || ' id=' || (r2 ? 'beleg'));
  -- Dieselbe Nummer in B → doppelt_standort mit Namen, OHNE id
  r := public.beleg_speichern(null, current_setting('p.bb')::uuid, jsonb_build_object('lieferant_id', v_lief, 'belegnummer', 'E5-T1', 'netto', 1,
       'positionen', jsonb_build_array(jsonb_build_object('text','Zucker 1 kg','art','ware','artikel_id',v_art,'menge',1,'gebinde_basis',1000,'netto',1))));
  r2 := public.beleg_freigeben((r->>'id')::uuid);
  insert into probe values (13, 'anderer Standort: doppelt_standort, Name, keine id', (r2->>'grund') || ' · ' || coalesce(r2->>'standort','–') || ' · id=' || (r2 ? 'beleg'));
  -- Datum
  insert into probe values (14, 'Datum +2 Tage → datum', public.beleg_speichern(null, current_setting('p.ba')::uuid,
    jsonb_build_object('belegdatum', ((now() at time zone 'Europe/Berlin')::date + 2)::text))->>'grund');
  insert into probe values (15, 'Datum −401 Tage → datum', public.beleg_speichern(null, current_setting('p.ba')::uuid,
    jsonb_build_object('belegdatum', ((now() at time zone 'Europe/Berlin')::date - 401)::text))->>'grund');
  insert into probe values (16, 'Datum „32.13.“ → datum', public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('belegdatum', '2026-13-32'))->>'grund');
  r := public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('belegdatum', ((now() at time zone 'Europe/Berlin')::date + 1)::text));
  insert into probe values (17, 'Datum morgen geht (Lieferschein mit Vortag-Druck)', (r->>'ok'));
  r := public.beleg_speichern(null, current_setting('p.ba')::uuid, '{}'::jsonb);
  insert into probe select 18, 'ohne Datum: Berliner Tag', ((select belegdatum from einkaufsbelege where id = (r->>'id')::uuid) = (now() at time zone 'Europe/Berlin')::date)::text;
end $$;
reset role;

-- ── 4 · Gleiche Datei an anderem Standort ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare r jsonb; h text := repeat('ab', 32); begin
  r := public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('datei_hash', h));
  insert into probe values (20, 'A: Datei zum ersten Mal', r::text);
  r := public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('datei_hash', h));
  insert into probe values (21, 'A: dieselbe Datei nochmal → datei_doppelt', r->>'grund');
  r := public.beleg_speichern(null, current_setting('p.bb')::uuid, jsonb_build_object('datei_hash', h));
  insert into probe values (22, 'B: dieselbe Datei → Entwurf + Hinweis mit Name, ohne fremde id', (r->>'ok') || ' · ' || coalesce(r->>'hinweis','–') || ' · ' || coalesce(r->>'standort','–') || ' · beleg=' || (r ? 'beleg'));
end $$;
reset role;
-- Gegenfall: Blend (andere Kette) mit derselben Datei bekommt KEINEN Hinweis
select set_config('request.jwt.claims', json_build_object('sub', '4a60e8c2-1933-4228-aeff-c799894e846d', 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
insert into pin_sitzungen(nutzer_id, sitzung, bis) values ('4a60e8c2-1933-4228-aeff-c799894e846d', 'probe-s', now() + interval '1 hour') on conflict do nothing;
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.beleg_speichern(null, current_setting('p.bc')::uuid, jsonb_build_object('datei_hash', repeat('ab', 32)));
  insert into probe values (23, 'andere Kette: dieselbe Datei → kein Hinweis', (r->>'ok') || ' · ' || coalesce(r->>'hinweis','kein Hinweis'));
end $$;
reset role;

-- ── 5 · Gleichzeitige Freigabe: unique_violation im Schreibblock ──
-- Eine zweite Sitzung lässt sich in einer Transaktion nicht nachstellen; ein
-- Auslöser wirft beim Statuswechsel genau den Fehler, den der eindeutige
-- Index bei einem gleichzeitigen Gewinner werfen würde.
create function pg_temp.probe_wurf() returns trigger language plpgsql as $$
begin
  if new.status = 'freigegeben' and new.belegnummer = 'E5-ZUGLEICH' then
    raise exception 'gleichzeitig' using errcode = 'unique_violation';
  end if;
  return new;
end $$;
create trigger probe_wurf before update on einkaufsbelege for each row execute function pg_temp.probe_wurf();
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare r jsonb; r2 jsonb; begin
  r := public.beleg_speichern(null, current_setting('p.ba')::uuid, jsonb_build_object('lieferant_id', current_setting('p.lief'), 'belegnummer', 'E5-ZUGLEICH', 'netto', 4,
       'positionen', jsonb_build_array(jsonb_build_object('text','Zucker 1 kg','art','ware','artikel_id',current_setting('p.art'),'menge',1,'gebinde_basis',1000,'netto',4))));
  r2 := public.beleg_freigeben((r->>'id')::uuid);
  insert into probe values (30, 'Wurf beim Statuswechsel → Grund doppelt, keine Ausnahme', r2::text);
  insert into probe select 31, 'danach: Status / Positionen / Bewegungen dieses Belegs (entwurf/0/0)',
    (select status from einkaufsbelege where id = (r->>'id')::uuid) || '/' ||
    (select count(*) from einkaufspositionen where beleg_id = (r->>'id')::uuid) || '/' ||
    (select count(*) from lagerbewegungen where beleg_id = (r->>'id')::uuid);
end $$;
reset role;
-- (der Auslöser fällt mit dem rollback; er trifft nur „E5-ZUGLEICH“)

-- ── 7 · Gelernte Zuordnung wird nicht still überschrieben ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare v_art2 uuid; r jsonb; r2 jsonb; begin
  insert into artikel(organisation_id, name, basiseinheit) values (current_setting('p.oa')::uuid, 'Probe-Rohrzucker E5', 'g') returning id into v_art2;
  r := public.beleg_speichern(null, current_setting('p.bb')::uuid, jsonb_build_object('lieferant_id', current_setting('p.lief'), 'belegnummer', 'E5-B-ZU', 'netto', 9,
       'positionen', jsonb_build_array(jsonb_build_object('text','Zucker 1 kg','art','ware','artikel_id',v_art2,'menge',1,'gebinde_basis',500,'netto',9))));
  r2 := public.beleg_freigeben((r->>'id')::uuid);
  insert into probe values (40, 'B ordnet „Zucker 1 kg“ anders zu → Hinweis nennt vorher/jetzt', (r2->>'ok') || ' · ' || (r2->'zuordnungen')::text);
  r := public.beleg_speichern(null, current_setting('p.bb')::uuid, jsonb_build_object('lieferant_id', current_setting('p.lief'), 'belegnummer', 'E5-B-ZU2', 'netto', 9,
       'positionen', jsonb_build_array(jsonb_build_object('text','Zucker 1 kg','art','ware','artikel_id',v_art2,'menge',1,'gebinde_basis',500,'netto',9))));
  r2 := public.beleg_freigeben((r->>'id')::uuid);
  insert into probe values (41, 'gleiche Zuordnung nochmal → kein Hinweis', (r2->'zuordnungen')::text);
  perform set_config('p.art2', v_art2::text, true);
end $$;
reset role;

-- artikel_preis_betrieb ist intern (kein EXECUTE für authenticated) — als Eigentümer gelesen
insert into probe values (11, 'letzter Preis bei 10× gleichem Datum = zuletzt freigegeben (0,010000)',
  public.artikel_preis_betrieb(current_setting('p.art')::uuid, current_setting('p.ba')::uuid)::text);
insert into probe values (42, 'Preis in B nur aus B (9/500 = 0,018)', public.artikel_preis_betrieb(current_setting('p.art2')::uuid, current_setting('p.bb')::uuid)::text);
insert into probe select 43, 'artikel_preis_betrieb für authenticated ausführbar (false)', has_function_privilege('authenticated', 'public.artikel_preis_betrieb(uuid,uuid)', 'EXECUTE')::text;

-- ── Inhaber B (nur B) sieht A weiterhin nicht ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.f'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe select 50, 'B liest Belege/Preise von A (0/0)',
    (select count(*) from einkaufsbelege where betrieb_id = current_setting('p.ba')::uuid) || '/' ||
    (select count(*) from artikel_preise where betrieb_id = current_setting('p.ba')::uuid);
  insert into probe values (51, 'B: Kontingent auf A → -1', public.ki_kontingent_nehmen(1, current_setting('p.ba')::uuid)::text);
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.ki_kontingent_nehmen(1, current_setting('p.bb')::uuid); insert into probe values (52, 'anon Kontingent', 'GING DURCH');
  exception when others then insert into probe values (52, 'anon Kontingent', sqlstate); end;
end $$;
reset role;

-- ── 10 · Indizes: Plan mit 4000 erzeugten Zeilen (live gibt es noch keine) ──
insert into lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, notiz, zeitpunkt)
select case when g % 2 = 0 then current_setting('p.ba')::uuid else current_setting('p.bb')::uuid end, current_setting('p.art')::uuid,
       (array['eingang','verlust','inventur','storno'])[1 + g % 4], 1, 0.01, 'probe', now() - (g || ' minutes')::interval
  from generate_series(1, 4000) g;
analyze lagerbewegungen; analyze einkaufspositionen;
create temp table plan(z text);
do $$ declare zeile text; begin
  for zeile in execute format('explain select * from lagerbewegungen where betrieb_id = %L and art = ''verlust'' and zeitpunkt > now() - interval ''1 day''', current_setting('p.ba')) loop
    insert into plan values ('verlust: ' || zeile); end loop;
  for zeile in execute format('explain select * from einkaufspositionen where artikel_id = %L', current_setting('p.art')) loop
    insert into plan values ('positionen: ' || zeile); end loop;
end $$;
insert into probe select 60, 'Plan', string_agg(z, ' ‖ ') from plan where z ~ '(Index|Seq|Bitmap)';
insert into probe select 61, 'Indizes vorhanden', string_agg(indexname, ', ' order by indexname) from pg_indexes where schemaname = 'public'
  and indexname in ('einkaufspositionen_artikel','lagerbewegungen_beleg','lagerbewegungen_betrieb_art_zeit','inventuren_betrieb','rezepturen_betrieb','lieferanten_artikel_artikel');

select * from probe order by nr;
rollback;
