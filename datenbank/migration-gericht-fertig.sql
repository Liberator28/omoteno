-- ═══════════════════════════════════════════════════════════════════
-- migration-gericht-fertig.sql — „Dieses Gericht ist fertig, bitte servieren“
--
-- Wunsch 25.10.2026: Der Koch soll im Küchenboard dem Service sagen können,
-- WELCHE Speise fertig ist, damit sie zum Tisch gebracht werden kann.
--
-- BESTAND (gelesen, nicht erinnert): Die Küche meldet bisher je SPUR (Küche /
-- Theke) einen ganzen Bon fertig: kueche_fertig_um / theke_fertig_um; der
-- Service tippt „Gebracht“ (gebracht_um). Wenn die Vorspeise aus der Küche
-- kommt und der Hauptgang zehn Minuten später, kann der Koch das heute nicht
-- trennen — der Bon ist ganz fertig oder gar nicht.
--
-- NEU: eine Spalte positionen_fertig (jsonb-Objekt), Schlüssel = Nummer der
-- Position im Bon (0 = erste Zeile von bestellungen.positionen), Wert =
-- {"f": Zeitpunkt „fertig“, "g": Zeitpunkt „gebracht“ (fehlt, solange offen)}.
--
-- WARUM FUNKTIONEN statt Spaltenrecht: Zwei Köche an zwei Bildschirmen haken
-- gleichzeitig verschiedene Gerichte ab. Ein UPDATE, das das ganze Objekt
-- schreibt, ließe den späteren den früheren überschreiben (verlorene
-- Änderung); die Funktion sperrt die Zeile und ergänzt nur. Und die Spalte
-- bleibt für authenticated UNSCHREIBBAR (migration-bestellungen-spaltenrechte.sql
-- nennt nur neun Spalten) — kein neuer Schreibweg an der offenen REST-Tür
-- (CLAUDE.md §2.3a, §2.3f).
--
-- Regeln beider Funktionen (jede Absage als Antwort, nie als Ausnahme, §2.3g):
--   nicht_angemeldet · unbekannt · kein_recht (nicht Mitglied des Betriebs) ·
--   storniert (Bestellung storniert/abgelehnt) · form (leer, NULL, > 100) ·
--   position (Nummer außerhalb des Bons)
--
-- ADDITIV (§2.5): Solange nichts die Funktionen ruft, ändert sich nichts. Die
-- Küche fragt die Spalte mit Rückfallstufe ab (fehlt sie noch, 400 → ohne sie),
-- das Board liest sie nur, wenn sie in den Zeilen vorkommt.
--
-- VOR DEM EINSPIELEN LESEN (Live-Katalog, §1.2):
--   1) Gibt es schon eine Spalte oder Funktion dieses Namens?
--        select column_name from information_schema.columns
--         where table_schema='public' and table_name='bestellungen' and column_name='positionen_fertig';
--        select proname, pg_get_function_identity_arguments(oid) from pg_proc
--         where pronamespace='public'::regnamespace and proname in ('gericht_fertig_setzen','gerichte_gebracht_setzen');
--      Erwartet: beides leer.
--   2) Darf authenticated alle Spalten LESEN (Tabellenrecht) — sonst sähe die Küche die neue Spalte nicht?
--        select has_table_privilege('authenticated','public.bestellungen','SELECT');   -- erwartet true
--   3) Ist bestellungen in der Realtime-Veröffentlichung (damit das Board die Änderung hört)?
--        select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='bestellungen';
--
-- NACH DEM EINSPIELEN: genau eine Fassung je Funktion (§2.1), Probe in zurückgedrehter
-- Transaktion mit echtem Mitglied (§2.2), Zeilenzahl statt Ausnahme (§2.3b).
-- Lokale Probe: pruefungen/pruef-gericht-fertig-lokal.sh (datenbank/pruef-gericht-fertig.sql).
--
-- STAND: ENTWURF 25.10.2026 — NOCH NICHT EINGESPIELT (Supabase-Werkzeug war in dieser Sitzung nicht erreichbar).
-- ═══════════════════════════════════════════════════════════════════

alter table public.bestellungen add column if not exists positionen_fertig jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bestellungen_positionen_fertig_form'
                   and conrelid = 'public.bestellungen'::regclass) then
    alter table public.bestellungen add constraint bestellungen_positionen_fertig_form
      check (jsonb_typeof(positionen_fertig) = 'object' and pg_column_size(positionen_fertig) <= 8000);
  end if;
end $$;

comment on column public.bestellungen.positionen_fertig is
  'Je Position des Bons (Schlüssel = Nummer ab 0): {"f": fertig um, "g": gebracht um}. Geschrieben NUR von gericht_fertig_setzen / gerichte_gebracht_setzen (security definer).';

-- ── 1 · Koch: Gerichte fertig melden oder zurücknehmen ──────────────────
create or replace function public.gericht_fertig_setzen(p_bestellung uuid, p_positionen integer[], p_fertig boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  b public.bestellungen%rowtype;
  v jsonb;
  i integer;
  n integer;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet'); end if;
  if p_positionen is null or cardinality(p_positionen) = 0 or cardinality(p_positionen) > 100 then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end if;
  select * into b from public.bestellungen where id = p_bestellung for update;
  if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  if b.betrieb_id not in (select public.meine_betriebe()) and not public.ist_master() then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  if b.status in ('storniert', 'abgelehnt') then return jsonb_build_object('ok', false, 'grund', 'storniert'); end if;
  n := case when jsonb_typeof(b.positionen) = 'array' then jsonb_array_length(b.positionen) else 0 end;
  foreach i in array p_positionen loop
    if i is null or i < 0 or i >= n then return jsonb_build_object('ok', false, 'grund', 'position'); end if;
  end loop;
  v := coalesce(b.positionen_fertig, '{}'::jsonb);
  foreach i in array p_positionen loop
    if p_fertig is not false then
      -- schon fertig? Dann bleibt die ERSTE Zeit stehen (der Service wartet seit dann).
      if not (v ? i::text) then v := v || jsonb_build_object(i::text, jsonb_build_object('f', to_jsonb(clock_timestamp()))); end if;
    else
      -- Zurücknehmen geht nur, solange es nicht gebracht ist.
      if (v ? i::text) and not ((v -> i::text) ? 'g') then v := v - i::text; end if;
    end if;
  end loop;
  update public.bestellungen set positionen_fertig = v where id = p_bestellung;
  return jsonb_build_object('ok', true, 'fertig', v);
end $function$;
revoke execute on function public.gericht_fertig_setzen(uuid, integer[], boolean) from public, anon;
grant  execute on function public.gericht_fertig_setzen(uuid, integer[], boolean) to authenticated;

-- ── 2 · Service: fertige Gerichte als gebracht abhaken ─────────────────
-- p_positionen NULL = alle, die gerade fertig und noch nicht gebracht sind. Ist danach
-- JEDE Position gebracht, setzt die Funktion auch gebracht_um (die alte Liste „Zum Abholen“
-- und alles, was gebracht_um liest, sehen den Bon dann als erledigt).
create or replace function public.gerichte_gebracht_setzen(p_bestellung uuid, p_positionen integer[] default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  b public.bestellungen%rowtype;
  v jsonb;
  i integer;
  n integer;
  k text;
  alle boolean := true;
  gesetzt integer := 0;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet'); end if;
  if p_positionen is not null and (cardinality(p_positionen) = 0 or cardinality(p_positionen) > 100) then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end if;
  select * into b from public.bestellungen where id = p_bestellung for update;
  if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  if b.betrieb_id not in (select public.meine_betriebe()) and not public.ist_master() then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  if b.status in ('storniert', 'abgelehnt') then return jsonb_build_object('ok', false, 'grund', 'storniert'); end if;
  n := case when jsonb_typeof(b.positionen) = 'array' then jsonb_array_length(b.positionen) else 0 end;
  if p_positionen is not null then
    foreach i in array p_positionen loop
      if i is null or i < 0 or i >= n then return jsonb_build_object('ok', false, 'grund', 'position'); end if;
    end loop;
  end if;
  v := coalesce(b.positionen_fertig, '{}'::jsonb);
  for i in 0 .. n - 1 loop
    k := i::text;
    if (v ? k) and not ((v -> k) ? 'g') and (p_positionen is null or i = any (p_positionen)) then
      v := jsonb_set(v, array[k, 'g'], to_jsonb(clock_timestamp()));
      gesetzt := gesetzt + 1;
    end if;
  end loop;
  for i in 0 .. n - 1 loop
    if not ((v ? i::text) and ((v -> i::text) ? 'g')) then alle := false; end if;
  end loop;
  update public.bestellungen
     set positionen_fertig = v,
         gebracht_um = case when alle and n > 0 then now() else gebracht_um end
   where id = p_bestellung;
  return jsonb_build_object('ok', true, 'gebracht', gesetzt, 'alle', alle and n > 0, 'fertig', v);
end $function$;
revoke execute on function public.gerichte_gebracht_setzen(uuid, integer[]) from public, anon;
grant  execute on function public.gerichte_gebracht_setzen(uuid, integer[]) to authenticated;
