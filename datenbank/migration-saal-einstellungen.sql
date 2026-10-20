-- ═══════════════════════════════════════════════════════════════════
--  migration-saal-einstellungen.sql · Bereiche und Leuchtstufen des Saalplans
--
--  Wunsch 20.10.: „Die Farben — ab wann welche Farbe kommt — soll man selbst
--  einstellen können.“ Und: Bereiche (Haupt-Raum, Terrasse, Bar) wie in der
--  Vorlage der Tisch-Seite.
--
--    tische.zone                 Bereich des Tisches (Text; null = erster Bereich)
--    saal_einstellungen.daten    { zonen: [..], stufen: { ruf: {farbe,min2,min3}, … } }
--
--  Additiv (§2.5). Ohne Zeile gelten die Vorgaben im Board (dieselben Werte
--  wie vorher: Ruf 2/5, Neu 3/6, Servieren 2/4, Zahlung 5/10 Minuten).
--
--  RECHTE: Die Einstellungen schreibt nur der Inhaber, und nur über die
--  Funktion — sie prüft Form und Grenzen. Gelesen wird die Tabelle von jedem
--  Mitglied des Betriebs (Team und Küche brauchen die Farben, um den Plan zu
--  zeichnen). Kein Browser-Schreibweg auf die Tabelle (§2.3f).
-- ═══════════════════════════════════════════════════════════════════

alter table public.tische add column if not exists zone text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tische_zone_form') then
    alter table public.tische add constraint tische_zone_form check
      (zone is null or (char_length(zone) between 1 and 24 and zone !~ '[<>"''`&\\]'));
  end if;
end $$;
-- Der Bereich schreibt sich wie die Lage: nur Inhaber (Regel „tische inhaber legt lage“), nur diese Spalten.
grant update (zone) on public.tische to authenticated;
comment on column public.tische.zone is 'Saalplan: Bereich des Tisches (Name aus saal_einstellungen.daten.zonen); null = erster Bereich.';

create table if not exists public.saal_einstellungen (
  betrieb_id uuid primary key references public.betriebe(id) on delete cascade,
  daten      jsonb not null default '{}'::jsonb,
  geaendert  timestamptz not null default now(),
  constraint saal_einstellungen_masse check (pg_column_size(daten) < 4000)
);
alter table public.saal_einstellungen enable row level security;
revoke all on public.saal_einstellungen from public, anon, authenticated;
grant select on public.saal_einstellungen to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saal_einstellungen' and policyname = 'saal_einstellungen lesen') then
    create policy "saal_einstellungen lesen" on public.saal_einstellungen for select to authenticated
      using (betrieb_id in (select public.meine_betriebe()));
  end if;
end $$;

create or replace function public.saal_einstellungen_setzen(p_betrieb uuid, p_daten jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  z jsonb; a text; s jsonb; i int;
  v_namen text[] := '{}'; v_name text;
  v_arten text[] := array['ruf','servieren','neu','pruefen','arbeit'];
  v_mit_zeit text[] := array['ruf','servieren','neu','pruefen'];
  v_m2 text; v_m3 text;
begin
  if p_betrieb is null or not public.ist_inhaber(p_betrieb) then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  if p_daten is null or jsonb_typeof(p_daten) <> 'object' or pg_column_size(p_daten) > 3500 then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end if;
  -- nur bekannte Schlüssel
  if exists (select 1 from jsonb_object_keys(p_daten) k where k not in ('zonen', 'stufen')) then
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

  insert into public.saal_einstellungen (betrieb_id, daten, geaendert)
  values (p_betrieb, p_daten, now())
  on conflict (betrieb_id) do update set daten = excluded.daten, geaendert = now();
  return jsonb_build_object('ok', true);
end $function$;
revoke execute on function public.saal_einstellungen_setzen(uuid, jsonb) from public, anon;
grant execute on function public.saal_einstellungen_setzen(uuid, jsonb) to authenticated;
