-- ═══════════════════════════════════════════════════════════════════
--  migration-abholen.sql · Abholen: Gast bestellt und holt selbst ab
--  (Wunsch 07.10., Block L8)
--
--  ANGEWENDET (Supabase-MCP). Vorher und danach in zurückgedrehter
--  Transaktion als anon: Schalter fehlt → aus; ohne Name → angaben;
--  „25:99“ → zeit; 1 Cent → „Der Preis stimmt nicht“ (aus
--  bestellung_aufgeben); echt → quelle lieferung, abholung true,
--  Gebühr 0, Name getrimmt, Wunschzeit gesetzt, Abrufnummer 100;
--  Wiederholung derselben Kennung → dieselbe Nummer, eine Zeile;
--  nächste Abholung → 101. Genau eine Fassung (§2.1).
--
--  WARUM EINE EIGENE FUNKTION statt eines neuen Parameters an
--  bestellung_liefern: Eine Signaturänderung legt in Postgres eine
--  ZWEITE Fassung an (CLAUDE.md §2.1). Additiv ist sicherer — die
--  Lieferung bleibt bytegleich.
--
--  Bestand (gelesen, nicht vermutet):
--   · bestellungen.quelle CHECK kennt tisch/telefon/reservierung/
--     service/lieferung (§2.3c). Abholung läuft als quelle 'lieferung'
--     mit abholung = true — genau so, wie das Board sie schon zeigt
--     („Abholung“ statt „Lieferung“, admin.html), und wie
--     bestellung_aufgeben 'lieferung' schon annimmt.
--   · Spalten: gast_name, gast_telefon, wunschzeit (timestamptz),
--     abholung (bool, Vorgabe false), liefergebuehr.
--   · bestellung_aufgeben rechnet die Preise aus der Karte nach, prüft
--     Vertrag/Pause und zählt je Herkunft (markieren statt abweisen) —
--     auch für 'lieferung'. Diese Funktion erbt das, statt es zu
--     verdoppeln.
--   · Schalter: betriebe.liefer->'abholen' (true/false). Fehlt er, ist
--     Abholen AUS — kein Betrieb bekommt ungefragt einen neuen Weg.
--
--  Antworten wie bei bestellung_liefern: jsonb {ok, grund …}, nie eine
--  Ausnahme für einen erwartbaren Fall (§2.3g).
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.bestellung_abholen(
  p_betrieb_id   uuid,
  p_name         text,
  p_telefon      text,
  p_positionen   jsonb,
  p_summe        numeric,
  p_abholzeit    text default null,
  p_notiz        text default null,
  p_gast_kennung text default null,
  p_geraet       text default null,
  p_rabattcode   text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  v_liefer jsonb;
  v_id     uuid;
  v_ware   numeric;
  v_rabatt numeric;
  v_zeit   timestamptz := null;
  v_jetzt  timestamp := now() at time zone 'Europe/Berlin';
  v_uhr    time;
  v_nr     smallint;
begin
  select liefer into v_liefer from betriebe where id = p_betrieb_id;
  if v_liefer is null or coalesce((v_liefer->>'abholen')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'grund', 'aus');
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_telefon), '') = ''
     or length(p_name) > 80 or length(p_telefon) > 40 then
    return jsonb_build_object('ok', false, 'grund', 'angaben');
  end if;
  /* Abholzeit „HH:MM“ von heute, Berliner Zeit; leer = so bald wie
     möglich. Vergangen (mehr als 5 Minuten) oder mehr als 12 Stunden
     voraus wird abgewiesen — eine Bestellung für „03:00“ ist ein
     Tippfehler, keine Absicht. */
  if coalesce(trim(p_abholzeit), '') <> '' then
    if trim(p_abholzeit) !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' then
      return jsonb_build_object('ok', false, 'grund', 'zeit');
    end if;
    v_uhr  := trim(p_abholzeit)::time;
    v_zeit := (v_jetzt::date + v_uhr) at time zone 'Europe/Berlin';
    if v_zeit < now() - interval '5 minutes' or v_zeit > now() + interval '12 hours' then
      return jsonb_build_object('ok', false, 'grund', 'zeit');
    end if;
  end if;

  v_id := bestellung_aufgeben(
            p_betrieb_id   => p_betrieb_id,
            p_quelle       => 'lieferung',
            p_tisch        => null,
            p_summe        => p_summe,
            p_notiz        => p_notiz,
            p_positionen   => p_positionen,
            p_gast_kennung => p_gast_kennung,
            p_geraet       => p_geraet,
            p_rabattcode   => p_rabattcode);
  if v_id is null then
    return jsonb_build_object('ok', false, 'grund', 'abgewiesen');
  end if;

  /* Abrufnummer für den Pass. bestellung_aufgeben vergibt sie nur
     bei quelle 'tisch' — eine Abholung wird aber ausgerufen. Dasselbe
     Muster, dieselbe Sperre (kein doppelter Wert unter Last); ein
     Wiederholungsversuch derselben Kennung behält seine Nummer. */
  perform pg_advisory_xact_lock(hashtext('tagesnummer:' || p_betrieb_id::text));
  select coalesce(max(tagesnummer), 99) + 1 into v_nr
    from bestellungen
   where betrieb_id = p_betrieb_id
     and zeitpunkt >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin';
  if v_nr > 999 then v_nr := null; end if;

  update bestellungen
     set abholung      = true,
         liefergebuehr = 0,
         gast_name     = trim(p_name),
         gast_telefon  = trim(p_telefon),
         wunschzeit    = v_zeit,
         tagesnummer   = coalesce(tagesnummer, v_nr)
   where id = v_id;
  select summe, coalesce(rabatt_betrag, 0), tagesnummer into v_ware, v_rabatt, v_nr from bestellungen where id = v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'ware', coalesce(v_ware, 0),
                            'rabatt', v_rabatt, 'summe', coalesce(v_ware, 0), 'nummer', v_nr);
end $function$;

revoke execute on function public.bestellung_abholen(uuid, text, text, jsonb, numeric, text, text, text, text, text) from public;
grant execute on function public.bestellung_abholen(uuid, text, text, jsonb, numeric, text, text, text, text, text) to anon, authenticated;
