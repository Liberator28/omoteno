-- ═══════════════════════════════════════════════════════════════════
--  migration-saal-raeume.sql · Räume in Metern, Theken, Lage im Gebäude
--
--  Wunsch 25.10.: „Bei den Einstellungen der Tische und Räume die Metermaße
--  eintragen … das Programm erstellt den Raum und unterteilt ihn in 1×1-m-
--  Kästchen, so sieht der Raum auf der Grafik aus wie der echte. Dann noch
--  eine Bar/Theke, die Gebäudeumrandung — rauszoomen und das ganze Gebäude
--  sehen.“
--
--  Es gibt KEINE neue Spalte und KEINE neue Tabelle: Die Maße liegen in
--  saal_einstellungen.daten unter dem neuen Schlüssel „raeume“ (parallel zu
--  „zonen“, gleiche Reihenfolge). Die Tische behalten x/y als Anteil 0–100
--  ihres Raumes — ändert der Besitzer die Maße, wandern sie anteilig mit.
--
--  Geändert wird NUR die Funktion saal_einstellungen_setzen: Sie nimmt
--  zusätzlich „raeume“ an und prüft Form und Grenzen. Gleiche Signatur →
--  create or replace ersetzt (§2.1, nachlesen: genau EINE Zeile je Name).
--  Rechte unverändert: nur Inhaber, nur über die Funktion (§2.3f).
--
--  Ohne diese Migration läuft das Board weiter: Speichern ohne Maße geht wie
--  vorher, mit Maßen kommt ein Satz („migration-saal-raeume.sql fehlt“).
--
--  EINSPIELEN: SQL-Editor. Danach (§2.1):
--    select pg_get_function_identity_arguments(p.oid) from pg_proc p
--     join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and p.proname='saal_einstellungen_setzen';
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.saal_einstellungen_setzen(p_betrieb uuid, p_daten jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  z jsonb; a text; s jsonb; i int;
  v_namen text[] := '{}'; v_name text;
  v_arten text[] := array['ruf','servieren','neu','pruefen','arbeit'];
  v_mit_zeit text[] := array['ruf','servieren','neu','pruefen'];
  v_m2 text; v_m3 text;
  r jsonb; th jsonb; j int; k2 int; v_t text;
begin
  if p_betrieb is null or not public.ist_inhaber(p_betrieb) then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  if p_daten is null or jsonb_typeof(p_daten) <> 'object' or pg_column_size(p_daten) > 3500 then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end if;
  -- nur bekannte Schlüssel
  if exists (select 1 from jsonb_object_keys(p_daten) k where k not in ('zonen', 'stufen', 'raeume')) then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end if;

  -- Bereiche: 0 bis 6 Namen, je 1 bis 24 Zeichen, ohne Sonderzeichen, nicht doppelt
  z := coalesce(p_daten -> 'zonen', '[]'::jsonb);
  if jsonb_typeof(z) <> 'array' or jsonb_array_length(z) > 6 then
    return jsonb_build_object('ok', false, 'grund', 'zonen');
  end if;
  for i in 0 .. jsonb_array_length(z) - 1 loop
    if jsonb_typeof(z -> i) <> 'string' then return jsonb_build_object('ok', false, 'grund', 'zonen'); end if;
    v_name := z ->> i;
    if char_length(v_name) not between 1 and 24 or v_name ~ '[<>"''`&\\]' or v_name <> btrim(v_name)
       or lower(v_name) = any (v_namen) then
      return jsonb_build_object('ok', false, 'grund', 'zonen');
    end if;
    v_namen := v_namen || lower(v_name);
  end loop;

  -- Leuchtstufen: je Art Farbe #RRGGBB; die vier mit Zeit: 1 <= min2 <= 120, min2 < min3 <= 240
  s := coalesce(p_daten -> 'stufen', '{}'::jsonb);
  if jsonb_typeof(s) <> 'object' then return jsonb_build_object('ok', false, 'grund', 'stufen'); end if;
  if exists (select 1 from jsonb_object_keys(s) k where k <> all (v_arten)) then
    return jsonb_build_object('ok', false, 'grund', 'stufen');
  end if;
  foreach a in array v_arten loop
    if s ? a then
      if jsonb_typeof(s -> a) <> 'object' then return jsonb_build_object('ok', false, 'grund', 'stufen'); end if;
      if exists (select 1 from jsonb_object_keys(s -> a) k where k <> all (array['farbe','min2','min3'])) then
        return jsonb_build_object('ok', false, 'grund', 'stufen');
      end if;
      if (s -> a ->> 'farbe') is null or (s -> a ->> 'farbe') !~ '^#[0-9a-fA-F]{6}$' then
        return jsonb_build_object('ok', false, 'grund', 'stufen');
      end if;
      if a = any (v_mit_zeit) then
        v_m2 := s -> a ->> 'min2'; v_m3 := s -> a ->> 'min3';
        -- erst die Form, dann die Zahl (die Auswertung von OR ist nicht in Reihenfolge garantiert)
        if v_m2 is null or v_m3 is null or v_m2 !~ '^[0-9]{1,3}$' or v_m3 !~ '^[0-9]{1,3}$'
           or jsonb_typeof(s -> a -> 'min2') <> 'number' or jsonb_typeof(s -> a -> 'min3') <> 'number' then
          return jsonb_build_object('ok', false, 'grund', 'stufen');
        end if;
        if v_m2::int not between 1 and 120 or v_m3::int not between 2 and 240 or v_m3::int <= v_m2::int then
          return jsonb_build_object('ok', false, 'grund', 'stufen');
        end if;
      elsif (s -> a) ? 'min2' or (s -> a) ? 'min3' then
        return jsonb_build_object('ok', false, 'grund', 'stufen');
      end if;
    end if;
  end loop;


  -- Räume (Wunsch 25.10.): parallel zu den Bereichen, in Metern mit höchstens einer Nachkommastelle.
  --   [ { b, t, x, y, theken: [ { x, y, b, t } ] } ]   b,t 2..60 · x,y leer oder 0..300 · Theken 0..3
  if p_daten ? 'raeume' then
    r := p_daten -> 'raeume';
    if jsonb_typeof(r) <> 'array' or jsonb_array_length(r) > 6 then
      return jsonb_build_object('ok', false, 'grund', 'raeume');
    end if;
    for i in 0 .. jsonb_array_length(r) - 1 loop
      if jsonb_typeof(r -> i) <> 'object' then return jsonb_build_object('ok', false, 'grund', 'raeume'); end if;
      if exists (select 1 from jsonb_object_keys(r -> i) k where k <> all (array['b','t','x','y','theken'])) then
        return jsonb_build_object('ok', false, 'grund', 'raeume');
      end if;
      -- Breite und Tiefe: Pflicht, Zahl, 2 bis 60
      foreach v_t in array array['b','t'] loop
        if jsonb_typeof(r -> i -> v_t) is distinct from 'number' or (r -> i ->> v_t) !~ '^[0-9]{1,2}(\.[0-9])?$'
           or (r -> i ->> v_t)::numeric not between 2 and 60 then
          return jsonb_build_object('ok', false, 'grund', 'raeume');
        end if;
      end loop;
      -- Lage im Gebäude: leer (selbst anordnen) oder Zahl 0 bis 300
      foreach v_t in array array['x','y'] loop
        if r -> i ? v_t and jsonb_typeof(r -> i -> v_t) <> 'null' then
          if jsonb_typeof(r -> i -> v_t) <> 'number' or (r -> i ->> v_t) !~ '^[0-9]{1,3}(\.[0-9])?$'
             or (r -> i ->> v_t)::numeric not between 0 and 300 then
            return jsonb_build_object('ok', false, 'grund', 'raeume');
          end if;
        end if;
      end loop;
      -- Theken
      th := coalesce(r -> i -> 'theken', '[]'::jsonb);
      if jsonb_typeof(th) <> 'array' or jsonb_array_length(th) > 3 then
        return jsonb_build_object('ok', false, 'grund', 'raeume');
      end if;
      for j in 0 .. jsonb_array_length(th) - 1 loop
        if jsonb_typeof(th -> j) <> 'object'
           or exists (select 1 from jsonb_object_keys(th -> j) k where k <> all (array['x','y','b','t'])) then
          return jsonb_build_object('ok', false, 'grund', 'raeume');
        end if;
        foreach v_t in array array['x','y','b','t'] loop
          if jsonb_typeof(th -> j -> v_t) is distinct from 'number' or (th -> j ->> v_t) !~ '^[0-9]{1,2}(\.[0-9])?$' then
            return jsonb_build_object('ok', false, 'grund', 'raeume');
          end if;
        end loop;
        if (th -> j ->> 'x')::numeric > 60 or (th -> j ->> 'y')::numeric > 60
           or (th -> j ->> 'b')::numeric not between 0.4 and 30 or (th -> j ->> 't')::numeric not between 0.4 and 30 then
          return jsonb_build_object('ok', false, 'grund', 'raeume');
        end if;
      end loop;
    end loop;
  end if;

  insert into public.saal_einstellungen (betrieb_id, daten, geaendert)
  values (p_betrieb, p_daten, now())
  on conflict (betrieb_id) do update set daten = excluded.daten, geaendert = now();
  return jsonb_build_object('ok', true);
end $function$;
revoke execute on function public.saal_einstellungen_setzen(uuid, jsonb) from public, anon;
grant execute on function public.saal_einstellungen_setzen(uuid, jsonb) to authenticated;
