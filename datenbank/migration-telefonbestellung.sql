-- ═══════════════════════════════════════════════════════════════════
--  NOCH NICHT ANGEWENDET — Alessia nimmt Bestellungen am Telefon auf
--
--  ACHTUNG, ehrlich vorweg: Diese Migration ist geschrieben, aber
--  NICHT gefahren. Der Supabase-Zugang ist aus der Arbeitsumgebung
--  gesperrt (mcp.supabase.com am Netzausgang), ich konnte den
--  Bestand also nicht gegenlesen. Vor dem Anwenden bitte die drei
--  Vorpruefungen unten laufen lassen — sie sagen, ob die Annahmen
--  stimmen. CLAUDE.md 0: Ein Ergebnis, das nicht geprueft wurde, ist
--  eine Behauptung.
--
--  WAS SCHON DA IST und deshalb NICHT angelegt wird:
--  bestellungen traegt bereits gast_telefon, gast_name, transkript,
--  abholung, wunschzeit und notiz. Wer das Schema gebaut hat, hat an
--  den Telefonweg gedacht. Diese Migration ergaenzt nur, was fehlt.
-- ═══════════════════════════════════════════════════════════════════

-- ── VORPRUEFUNG · erst lesen, dann anwenden ────────────────────────
-- 1) Gibt es eine CHECK-Bedingung auf quelle? Wenn ja, muss sie
--    'telefon' erlauben — sonst schlaegt jeder Einwurf fehl.
--      select conname, pg_get_constraintdef(oid)
--      from pg_constraint
--      where conrelid = 'public.bestellungen'::regclass and contype = 'c';
-- 2) Wie heisst die Bestellfunktion heute genau?
--      select pg_get_function_identity_arguments(oid)
--      from pg_proc where proname = 'bestellung_aufgeben';
-- 3) Gibt es telefon_nummer auf betriebe schon?
--      select column_name from information_schema.columns
--      where table_name = 'betriebe';

begin;

-- ── 1 · Welche Nummer gehoert zu welchem Haus ──────────────────────
-- Alessia ruft nicht "irgendwo" an: Vapi meldet, welche Nummer
-- ANGERUFEN wurde. Daraus muss der Betrieb hervorgehen, sonst landet
-- eine Bestellung im falschen Haus — der teuerste denkbare Fehler.
alter table public.betriebe
  add column if not exists telefon_nummer text;

-- Eindeutig, sonst waere die Zuordnung mehrdeutig. Teilindex, damit
-- beliebig viele Betriebe ohne Nummer nebeneinander stehen duerfen.
create unique index if not exists betriebe_telefon_nummer_uniq
  on public.betriebe (telefon_nummer)
  where telefon_nummer is not null;

comment on column public.betriebe.telefon_nummer is
  'Die Alessia-Rufnummer dieses Hauses in E.164 (+4915678505529). '
  'Der Webhook findet den Betrieb ueber die ANGERUFENE Nummer.';

-- ── 2 · Der Weg hinein ─────────────────────────────────────────────
-- Eine eigene Funktion statt eines direkten INSERT. Der Grund steht
-- in CLAUDE.md 2.3a: Ein direkter Weg in die Tabelle prueft nur, was
-- RLS prueft — und RLS rechnet keinen Preis nach.
--
-- security definer, damit die Edge Function mit dem service_role
-- arbeiten kann, ohne dass irgendein anderer Weg dadurch aufgeht.
-- search_path fest auf public (CLAUDE.md 2.2).
create or replace function public.bestellung_telefon(
  p_gerufene_nummer text,
  p_anrufer         text,
  p_name            text,
  p_positionen      jsonb,
  p_notiz           text default null,
  p_abholung        boolean default true,
  p_wunschzeit      timestamptz default null,
  p_transkript      text default null,
  p_ruf_id          text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_betrieb  betriebe%rowtype;
  v_summe    numeric := 0;
  v_pos      jsonb := '[]'::jsonb;
  v_eintrag  jsonb;
  v_gericht  gerichte%rowtype;
  v_menge    int;
  v_id       uuid;
  v_nummer   int;
begin
  -- ── Welches Haus? ───────────────────────────────────────────────
  select * into v_betrieb from betriebe
   where telefon_nummer = p_gerufene_nummer;
  if not found then
    return jsonb_build_object('ok', false,
      'grund', 'unbekannte_nummer',
      'sagen', 'Diese Nummer ist keinem Betrieb zugeordnet.');
  end if;

  -- ── Nimmt das Haus gerade an? ───────────────────────────────────
  -- Dieselben Waechter wie am Tisch. Eine Bestellung, die das Haus
  -- am Tisch ablehnt, darf am Telefon nicht durchgehen.
  if v_betrieb.bestell_pause then
    return jsonb_build_object('ok', false,
      'grund', 'pause',
      'sagen', coalesce(nullif(v_betrieb.bestell_pause_text, ''),
                        'Wir nehmen gerade keine Bestellungen an.'));
  end if;
  if v_betrieb.zustand is not null and v_betrieb.zustand = 'gekuendigt' then
    return jsonb_build_object('ok', false, 'grund', 'vertrag',
      'sagen', 'Dieser Betrieb nimmt keine Bestellungen mehr an.');
  end if;

  -- ── Der Preis wird NACHGERECHNET, nie uebernommen ───────────────
  -- Alessia kann sich verhoeren, und ein Anrufer kann alles sagen.
  -- Massgeblich ist die Karte, sonst waere der Telefonweg genau die
  -- offene Tuer neben dem Waechter (CLAUDE.md 2.3a).
  for v_eintrag in select * from jsonb_array_elements(coalesce(p_positionen, '[]'::jsonb))
  loop
    v_menge := greatest(1, least(99, coalesce((v_eintrag->>'menge')::int, 1)));

    select * into v_gericht from gerichte
     where betrieb_id = v_betrieb.id
       and lower(name) = lower(trim(v_eintrag->>'name'))
       and verfuegbar
     order by id
     limit 1;

    if not found then
      return jsonb_build_object('ok', false,
        'grund', 'unbekanntes_gericht',
        'gericht', v_eintrag->>'name',
        'sagen', 'Das steht heute nicht auf der Karte.');
    end if;

    v_summe := v_summe + (v_gericht.preis * v_menge);
    v_pos := v_pos || jsonb_build_array(jsonb_build_object(
      'name',  v_gericht.name,
      'menge', v_menge,
      'preis', v_gericht.preis,
      'notiz', nullif(trim(coalesce(v_eintrag->>'notiz','')), '')
    ));
  end loop;

  if jsonb_array_length(v_pos) = 0 then
    return jsonb_build_object('ok', false, 'grund', 'leer',
      'sagen', 'Es wurde nichts bestellt.');
  end if;

  -- ── Tagesnummer, wie am Tisch ───────────────────────────────────
  select coalesce(max(tagesnummer), 0) + 1 into v_nummer
    from bestellungen
   where betrieb_id = v_betrieb.id
     and zeitpunkt >= date_trunc('day', now());

  insert into bestellungen (
    betrieb_id, quelle, status, positionen, summe, summe_gast,
    gast_name, gast_telefon, notiz, abholung, wunschzeit,
    transkript, tagesnummer, tisch, zeitpunkt
  ) values (
    v_betrieb.id, 'telefon', 'neu', v_pos, v_summe, v_summe,
    nullif(trim(coalesce(p_name, '')), ''),
    nullif(trim(coalesce(p_anrufer, '')), ''),
    nullif(trim(coalesce(p_notiz, '')), ''),
    coalesce(p_abholung, true),
    p_wunschzeit,
    left(coalesce(p_transkript, ''), 8000),
    v_nummer,
    'Telefon',
    now()
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'nummer', v_nummer,
    'summe', v_summe,
    'sagen', 'Notiert. Ihre Nummer ist ' || v_nummer || '.');
end;
$$;

-- NUR der service_role darf das. Kein anon, kein authenticated:
-- Wer die Funktion aufrufen kann, legt Bestellungen ohne Tisch und
-- ohne Sitzung an. Sie gehoert hinter die Edge Function, sonst
-- waere sie ein offenes Bestellrohr (CLAUDE.md 2.3a).
revoke all on function public.bestellung_telefon(
  text, text, text, jsonb, text, boolean, timestamptz, text, text)
  from public, anon, authenticated;

commit;

-- ── NACHPRUEFUNG · sofort nach dem Anwenden fahren ─────────────────
-- Eine Migration, die "success" meldet, sagt nichts darueber, ob die
-- Funktion laeuft (CLAUDE.md 2.2). Diese Probe legt nichts an:
--
--   begin;
--   create temp table probe(schritt text, ergebnis text);
--   do $$
--   declare a jsonb;
--   begin
--     a := bestellung_telefon('+490000000000', '+49170', 'Probe',
--            '[{"name":"gibtesnicht","menge":1}]'::jsonb);
--     insert into probe values ('unbekannte Nummer',
--       case when (a->>'grund') = 'unbekannte_nummer' then 'ok' else a::text end);
--   end $$;
--   select * from probe;
--   rollback;
--
-- Und die Signatur genau einmal (CLAUDE.md 2.1):
--   select pg_get_function_identity_arguments(oid)
--   from pg_proc where proname = 'bestellung_telefon';
