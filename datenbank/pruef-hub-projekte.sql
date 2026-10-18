-- ═══════════════════════════════════════════════════════════════════
--  pruef-hub-projekte.sql · zurückgedrehte Probe für migration-hub-projekte.sql
--  Inhaber A = Choco, Fremder F = Minhkeey, Team T = Blend-Inhaber, in
--  dieser Probe als Team in Choco eingetragen. Nichts bleibt stehen.
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(nr int, schritt text, ergebnis text);
grant all on probe to authenticated, anon;
select set_config('p.a', '153c5425-cd7a-42e4-a629-38cee3524951', true);
select set_config('p.f', 'bf6ea9ba-a97d-4ae7-a700-25d35afa0095', true);
select set_config('p.t', '4a60e8c2-1933-4228-aeff-c799894e846d', true);
select set_config('p.ba', 'af095b14-d9ef-41f4-9b97-c4422b0de63f', true);
insert into betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (current_setting('p.ba')::uuid, current_setting('p.t')::uuid, 'team') on conflict do nothing;
insert into pin_sitzungen(nutzer_id, sitzung, bis) values
  (current_setting('p.a')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.f')::uuid, 'probe-s', now() + interval '1 hour'),
  (current_setting('p.t')::uuid, 'probe-s', now() + interval '1 hour') on conflict do nothing;
select set_config('p.vorher', (select coalesce(hub_stil, '{}'::jsonb)::text from betriebe where id = current_setting('p.ba')::uuid), true);

insert into probe select 0, 'Katalog: je Funktion eine Signatur', string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ' | ' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'hub_projekt%';
insert into probe select 0, 'Rechte: authenticated schreibt nicht direkt / anon liest nicht / anon ruft nicht / hub_stand_von nicht für authenticated',
  has_table_privilege('authenticated', 'public.hub_projekte', 'INSERT') || '/' || has_table_privilege('authenticated', 'public.hub_projekte', 'UPDATE') || ' · ' ||
  has_table_privilege('anon', 'public.hub_projekte', 'SELECT') || ' · ' || has_function_privilege('anon', 'public.hub_projekt_laden(uuid)', 'EXECUTE') || ' · ' ||
  has_function_privilege('authenticated', 'public.hub_stand_von(uuid)', 'EXECUTE');

-- ── Inhaber A ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.hub_projekt_sichern(current_setting('p.ba')::uuid, '  Herbst  ');
  perform set_config('p.pr', r->>'id', true);
  insert into probe values (1, 'A sichert „  Herbst  “', r::text);
  insert into probe values (2, 'A liest sein Projekt (Name getrimmt, art eigen)',
    (select name || ' · ' || art || ' · Schlüssel ' || (select string_agg(k, ',' order by k) from jsonb_object_keys(daten) k) from hub_projekte where id = (r->>'id')::uuid));
  insert into probe values (3, 'Name leer / 61 Zeichen',
    (public.hub_projekt_sichern(current_setting('p.ba')::uuid, '   ')->>'grund') || ' / ' ||
    (public.hub_projekt_sichern(current_setting('p.ba')::uuid, repeat('x', 61))->>'grund'));
end $$;
reset role;
-- Der Hub ändert sich (als Eigentümer): Stil auf Raster.
update betriebe set hub_stil = coalesce(hub_stil, '{}'::jsonb) || '{"karte":"raster"}' where id = current_setting('p.ba')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.hub_projekt_laden(current_setting('p.pr')::uuid);
  perform set_config('p.sich', r->>'sicherung', true);
  insert into probe values (4, 'A lädt „Herbst“', r::text);
end $$;
reset role;
insert into probe select 5, 'nach dem Laden: hub_stil wie beim Sichern (gleich = true)',
  ((select coalesce(hub_stil, '{}'::jsonb) from betriebe where id = current_setting('p.ba')::uuid) = current_setting('p.vorher')::jsonb)::text;
insert into probe select 6, 'die Sicherung trägt den Raster-Stand (raster)',
  (select daten->'hub_stil'->>'karte' from hub_projekte where id = current_setting('p.sich')::uuid);
insert into probe select 7, 'Protokoll: Zeilen von A an betriebe (≥ 1; die Probe selbst ändert einmal als A)',
  (select count(*)::text from protokoll where betrieb_id = current_setting('p.ba')::uuid and tabelle = 'betriebe' and nutzer_id = current_setting('p.a')::uuid and zeit = now());

-- ── Form: ein Projekt, das die Schranke von hub_stil verletzt ──
update hub_projekte set daten = jsonb_set(daten, '{hub_stil}', jsonb_build_object('emoji', 'ja', 'f', repeat('x', 3000))) where id = current_setting('p.pr')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare vorher int; r jsonb; begin
  select count(*) into vorher from hub_projekte where betrieb_id = current_setting('p.ba')::uuid;
  r := public.hub_projekt_laden(current_setting('p.pr')::uuid);
  insert into probe values (8, 'kaputter Stand → form, keine neue Sicherung, Betrieb unverändert',
    (r->>'grund') || ' · neue Zeilen ' || ((select count(*) from hub_projekte where betrieb_id = current_setting('p.ba')::uuid) - vorher));
end $$;
reset role;
insert into probe select 9, 'Betrieb nach form unverändert (true)',
  ((select coalesce(hub_stil, '{}'::jsonb) from betriebe where id = current_setting('p.ba')::uuid) = current_setting('p.vorher')::jsonb)::text;

-- ── Archivieren, Zurückholen, Umbenennen ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (10, 'archivieren / archiviert laden / zurückholen / umbenennen',
    (public.hub_projekt_archivieren(current_setting('p.pr')::uuid)->>'ok') || ' / ' ||
    (public.hub_projekt_laden(current_setting('p.pr')::uuid)->>'grund') || ' / ' ||
    (public.hub_projekt_archivieren(current_setting('p.pr')::uuid, false)->>'ok') || ' / ' ||
    (public.hub_projekt_umbenennen(current_setting('p.pr')::uuid, 'Herbst 2026')->>'ok'));
  -- Eigene Anweisung: dieselbe Anweisung sähe noch den alten Namen (Momentaufnahme).
  insert into probe values (10, 'Name danach', (select name from hub_projekte where id = current_setting('p.pr')::uuid));
end $$;
reset role;

-- ── Fremder F und Team T ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.f'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (11, 'F: sieht / sichert / lädt / benennt / archiviert A',
    (select count(*) from hub_projekte where betrieb_id = current_setting('p.ba')::uuid)::text || ' / ' ||
    (public.hub_projekt_sichern(current_setting('p.ba')::uuid, 'Fremd')->>'grund') || ' / ' ||
    (public.hub_projekt_laden(current_setting('p.pr')::uuid)->>'grund') || ' / ' ||
    (public.hub_projekt_umbenennen(current_setting('p.pr')::uuid, 'X')->>'grund') || ' / ' ||
    (public.hub_projekt_archivieren(current_setting('p.pr')::uuid)->>'grund'));
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.t'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ begin
  insert into probe values (12, 'Team T in A: sieht / sichert / lädt',
    (select count(*) from hub_projekte where betrieb_id = current_setting('p.ba')::uuid)::text || ' / ' ||
    (public.hub_projekt_sichern(current_setting('p.ba')::uuid, 'Team')->>'grund') || ' / ' ||
    (public.hub_projekt_laden(current_setting('p.pr')::uuid)->>'grund'));
  begin
    insert into hub_projekte(betrieb_id, name, daten) values (current_setting('p.ba')::uuid, 'direkt', '{}');
    insert into probe values (13, 'Team schreibt direkt in die Tabelle', 'GING DURCH');
  exception when insufficient_privilege then insert into probe values (13, 'Team schreibt direkt in die Tabelle', '42501');
  end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
do $$ begin
  begin perform public.hub_projekt_laden(current_setting('p.pr')::uuid); insert into probe values (14, 'anon ruft laden', 'GING DURCH');
  exception when insufficient_privilege then insert into probe values (14, 'anon ruft laden', '42501'); end;
end $$;
reset role;

-- ── Grenzen: 30 eigene, fünf Sicherungen ──
insert into hub_projekte(betrieb_id, name, daten) select current_setting('p.ba')::uuid, 'Füller ' || g, '{}' from generate_series(1, 29) g;
-- Das Projekt trägt seit Schritt 8 einen kaputten Stand — sonst endete jedes
-- weitere Laden mit „form“ und zählte keine Sicherung (§8.1g C).
update hub_projekte set daten = public.hub_stand_von(current_setting('p.ba')::uuid) where id = current_setting('p.pr')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p.a'), 'role', 'authenticated', 'session_id', 'probe-s')::text, true);
set local role authenticated;
do $$ declare i int; begin
  insert into probe values (15, 'das 31. eigene Projekt', public.hub_projekt_sichern(current_setting('p.ba')::uuid, 'Zu viel')->>'grund');
  for i in 1..7 loop perform public.hub_projekt_laden(current_setting('p.pr')::uuid); end loop;
  insert into probe values (16, 'nach acht Ladevorgängen sichtbare Sicherungen (5)',
    (select count(*) from hub_projekte where betrieb_id = current_setting('p.ba')::uuid and art = 'sicherung' and not archiviert)::text);
end $$;
reset role;

select * from probe order by nr, schritt;
rollback;
