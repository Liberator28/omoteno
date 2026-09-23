-- ═══════════════════════════════════════════════════════════════════
--  BEREITS ANGEWENDET (2026-09-23) · bestellung_aufgeben kennt jetzt
--  Top-Runner-Aktionen UND einen optionalen Gast-Rabattcode
--
--  ── VORGESCHICHTE ─────────────────────────────────────────────
--  Diese Datei enthielt bis zu diesem Fix nur einen BEFUND, kein
--  lauffähiges "create or replace" — der Supabase-Zugang war aus
--  einer früheren Sitzung heraus gesperrt (403 AUTH_HEADER_REJECTED).
--  Der Befund von damals: bestellung_aufgeben rechnet die Summe jeder
--  Position ausschließlich aus gerichte.preis nach, die Tabelle
--  aktionen (Top-Runner-Rabatte) kam an keiner Stelle vor. Der
--  "Sofort bestellen"-Knopf im Hub (aktionBandHTML()) legt einen
--  Posten mit dem AKTIONSPREIS in den Korb — sobald der Gast wirklich
--  bestellte, lehnte bestellung_aufgeben die Bestellung mit "Der
--  Preis stimmt nicht" ab, weil sie gegen den vollen Kartenpreis
--  prüfte.
--
--  Diese Sitzung hatte inzwischen wieder Supabase-Zugriff (siehe
--  migration-lieferung-quelle-fix.sql für den zuerst behobenen,
--  DRINGENDEN Fehler derselben Funktion) und konnte den echten
--  Funktionskörper lesen, die Erweiterung in einer zurückgedrehten
--  Transaktion mit mehreren Fällen prüfen und danach wirklich
--  anwenden — siehe unten.
--
--  ── ZWEITE ERWEITERUNG, IN DERSELBEN ÄNDERUNG ────────────────────
--  Auf ausdrücklichen Wunsch sollen Rabattcodes jetzt auch GASTSEITIG
--  im Hub einlösbar sein (bisher nur personalintern übers Board via
--  rechnung_rabattieren, das NACHTRÄGLICH auf eine bereits bestehende
--  Bestellung rechnet und `authenticated`-Mitgliedschaft prüft — für
--  einen anonymen Gast ohne Bestellungs-ID vor dem Absenden passt das
--  nicht, siehe Begründung im Plan). Ein Gast-Rabattcode gehört in
--  dieselbe Preisprüfung wie die Aktionen, nicht in eine dritte,
--  unabhängige Preisrechnung — sonst entstehen zwei Stellen, die sich
--  widersprechen können (CLAUDE.md §1.1a). Deshalb ist das EIN
--  create-or-replace, nicht zwei.
--
--  Optionaler Parameter p_rabattcode text: wird gegen rabattcodes
--  desselben Betriebs geprüft (unbekannt/abgelaufen/bereits
--  eingelöst — dieselben drei Zustände wie rechnung_rabattieren,
--  hier VOR statt NACH dem Anlegen der Zeile, mit `for update`-Sperre
--  gegen doppeltes Einlösen), der Rabatt wird auf die bereits
--  aktions-/kartenpreis-geprüfte Summe angewendet.
--
--  ── SIGNATURÄNDERUNG, DESHALB DROP + CREATE STATT CREATE OR REPLACE
--  Ein neuer Parameter ändert die Signatur (die Argumenttypen-Liste),
--  mit der Postgres eine Funktion identifiziert. "create or replace"
--  hätte damit KEINE bestehende Funktion ersetzt, sondern eine ZWEITE
--  angelegt — genau der in CLAUDE.md §2.1 dokumentierte Vorfall. Also:
--  erst pg_depend geprüft (keine harten Abhängigkeiten, bestellung_
--  liefern ruft nur zur Laufzeit auf), dann DROP FUNCTION mit der
--  alten Signatur, dann CREATE FUNCTION mit der neuen — und weil DROP
--  auch alle Rechte auf dem alten Funktionsobjekt mitnimmt, direkt im
--  Anschluss dieselben GRANTs (anon, authenticated, service_role) neu
--  gesetzt, die vorher gemessen dastanden. bestellung_liefern bekam
--  aus demselben Grund denselben Parameter angehängt und reicht ihn
--  durch, plus ein neues 'rabatt'-Feld in ihrer Rückgabe.
--
--  ── VALIDIERUNG (CLAUDE.md §2.2, echte Testfälle, kein Glauben an
--     "success: true") ────────────────────────────────────────────
--  Neun Fälle in einer zurückgedrehten Transaktion durchgespielt,
--  gegen frische Test-Betriebe/-Gerichte/-Aktionen/-Codes, bevor
--  überhaupt etwas real angewendet wurde:
--    1. Tisch ohne Code, korrekter Kartenpreis            -> ok
--    2. Aktionspreis (Kartenpreis 10, Aktion 7, 2 Stück,
--       Summe 14) korrekt akzeptiert                      -> ok
--    3. Unter dem Aktionspreis (6.99 statt 14)             -> abgelehnt
--    4. Unbekannter Rabattcode                             -> abgelehnt
--    5. Gültiger Code, aber zu niedrige Summe (5 statt
--       Aktionspreis-Rabatt=11)                            -> abgelehnt
--    6. Aktion + Code zusammen, korrekte Summe (14-3=11)   -> ok, Code
--       als eingelöst markiert
--    7. Derselbe Code ein zweites Mal                      -> abgelehnt
--       ("bereits eingelöst")
--    8. Abgelaufener Code                                  -> abgelehnt
--    9. Lieferung (über die echte bestellung_liefern, nicht
--       gemockt, §8.1i), Aktion + Prozent-Code zusammen
--       (14 * 0,9 = 12,60)                                 -> ok,
--       Rückgabe zeigt rabatt=1.40
--  Dabei EINEN echten Fehler gefunden, bevor er live gelandet ist:
--  Der erste Entwurf griff nach dem insert unbedingt auf v_code.id
--  zu, um zu prüfen, ob ein Code eingelöst werden muss — bei einer
--  Bestellung OHNE Code war v_code als Record nie zugewiesen worden,
--  und Postgres wirft dann "record v_code is not assigned yet" statt
--  NULL zurückzugeben. Behoben durch eine eigene v_code_id-Variable,
--  die nur bei einem echten Treffer gesetzt wird. Ohne die neun
--  echten Testfälle (nicht gemockt) wäre das erst beim ersten Gast
--  ohne Rabattcode aufgefallen — also bei praktisch jeder normalen
--  Bestellung.
--
--  Nach dem echten Anwenden zusätzlich bestätigt: genau eine Fassung
--  jeder Funktion (pg_get_function_identity_arguments), dieselben
--  Rechte wie vorher (anon/authenticated/service_role EXECUTE), und
--  alle neun Fälle ein zweites Mal gegen die jetzt echten, live
--  gespeicherten Funktionen wiederholt — wieder alle neun wie
--  erwartet.
--
--  ── BEWUSST NICHT TEIL DIESER ÄNDERUNG ────────────────────────────
--  Überzahlung wird weiterhin nicht abgelehnt (die Prüfung greift nur
--  bei ZU NIEDRIGER Summe) — das war schon im Original so und wird
--  hier nicht angetastet (CLAUDE.md §9: keine zweite, unverlangte
--  Änderung im selben Zug). rechnung_rabattieren (Board, nachträglich
--  auf bestehende Bestellungen) bleibt unverändert; sie bedient einen
--  anderen Zeitpunkt und eine andere Rolle.
-- ═══════════════════════════════════════════════════════════════════

begin;

drop function public.bestellung_aufgeben(uuid, text, text, numeric, text, jsonb, text, text, text, text);

CREATE FUNCTION public.bestellung_aufgeben(p_betrieb_id uuid, p_quelle text, p_tisch text DEFAULT NULL::text, p_summe numeric DEFAULT 0, p_notiz text DEFAULT NULL::text, p_positionen jsonb DEFAULT '[]'::jsonb, p_gast_kennung text DEFAULT NULL::text, p_tisch_schluessel text DEFAULT NULL::text, p_sitzung text DEFAULT NULL::text, p_geraet text DEFAULT NULL::text, p_rabattcode text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  neue        uuid;
  b           record;
  t           record;
  s           record;
  v_code      record;
  v_code_id   uuid;
  tisch_final text;
  bestaetigt  boolean := false;
  basis_summe numeric := 0;
  v_rabattbetrag numeric(8,2) := 0;
  v_aktionspreis numeric;
  pos         jsonb;
  treffer     numeric;
  name_roh    text;
  name_basis  text;
  tagesnr     smallint := null;
  tagesbeginn timestamptz;
begin
  if p_betrieb_id is null then raise exception 'Betrieb fehlt' using errcode='P0001'; end if;
  if p_quelle is null or p_quelle not in ('tisch','service','lieferung') then
    raise exception 'Quelle ungueltig' using errcode='P0001';
  end if;

  select id, slug, bestell_pause, bestell_pause_text, tisch_pflicht, zustand, test_bis
    into b from betriebe where id = p_betrieb_id;
  if not found then raise exception 'Betrieb unbekannt' using errcode='P0001'; end if;

  if b.zustand = 'gekuendigt' then
    raise exception 'Hier kann gerade nicht bestellt werden. Bitte wenden Sie sich an das Personal.'
      using errcode='P0001';
  end if;
  if b.zustand = 'pausiert' then
    raise exception 'Die Bestellung am Tisch ist vorübergehend abgeschaltet. Bitte wenden Sie sich an das Personal.'
      using errcode='P0001';
  end if;
  if b.zustand = 'test' and b.test_bis is not null and b.test_bis < now() then
    raise exception 'Die Testphase dieses Hubs ist abgelaufen. Bitte wenden Sie sich an das Personal.'
      using errcode='P0001';
  end if;

  if p_gast_kennung is not null
     and (length(p_gast_kennung) < 8 or length(p_gast_kennung) > 80) then
    raise exception 'Kennung ungueltig' using errcode='P0001';
  end if;

  if p_geraet is not null
     and (length(p_geraet) < 8 or length(p_geraet) > 64
          or p_geraet !~ '^[A-Za-z0-9_-]+$') then
    p_geraet := null;
  end if;

  if p_notiz is not null and length(p_notiz) > 500 then
    raise exception 'Anmerkung zu lang' using errcode='P0001';
  end if;
  if p_positionen is not null and jsonb_array_length(p_positionen) > 60 then
    raise exception 'Zu viele Positionen' using errcode='P0001';
  end if;

  if b.bestell_pause then
    raise exception '%', coalesce(nullif(b.bestell_pause_text,''),
      'Wir nehmen gerade keine Bestellungen an.') using errcode='P0001';
  end if;

  tisch_final := p_tisch;

  if p_sitzung is not null and p_sitzung <> '' then
    select si.id, si.tisch_id, ti.nummer
      into s
      from tisch_sitzungen si
      join tische ti on ti.id = si.tisch_id
     where si.token = p_sitzung
       and si.betrieb_id = p_betrieb_id
       and si.gueltig_bis > now()
       and ti.aktiv
     limit 1;

    if found then
      tisch_final := s.nummer;
      bestaetigt  := true;
      update tisch_sitzungen
         set letzte_aktivitaet = now(),
             gueltig_bis       = now() + interval '4 hours'
       where id = s.id;
    end if;
  end if;

  if not bestaetigt and p_tisch_schluessel is not null and p_tisch_schluessel <> '' then
    select ti.nummer, ti.aktiv into t
      from tische ti
     where ti.schluessel = p_tisch_schluessel
       and ti.betrieb_id = p_betrieb_id;
    if not found or not t.aktiv then
      raise exception 'Dieser Tischcode gilt hier nicht.' using errcode='P0001';
    end if;
    tisch_final := t.nummer;
    bestaetigt  := true;
  end if;

  if not bestaetigt and b.tisch_pflicht then
    raise exception 'Zum Bestellen bitte kurz den Untersetzer auf Ihrem Tisch antippen.'
      using errcode='P0001';
  end if;

  if tisch_final is not null and length(tisch_final) > 20 then
    raise exception 'Tischangabe ungueltig' using errcode='P0001';
  end if;

  if p_quelle in ('tisch','lieferung') and jsonb_array_length(coalesce(p_positionen,'[]'::jsonb)) > 0 then
    for pos in select * from jsonb_array_elements(p_positionen) loop
      name_roh := coalesce(pos->>'name','');
      name_basis := btrim(split_part(name_roh, ' (', 1));
      select preis into treffer from gerichte
       where betrieb_id = p_betrieb_id and name = name_basis
       limit 1;
      if treffer is not null then
        v_aktionspreis := null;
        select least(treffer, a.preis_neu) into v_aktionspreis
          from aktionen a
         where a.betrieb_id = p_betrieb_id
           and a.gericht_name = name_basis
           and coalesce(a.aktiv, true)
           and now() between a.von and a.bis
         order by a.preis_neu asc
         limit 1;
        if v_aktionspreis is not null then
          treffer := v_aktionspreis;
        end if;
        basis_summe := basis_summe
          + treffer * greatest(1, coalesce((pos->>'menge')::numeric, 1));
      end if;
    end loop;

    if p_rabattcode is not null and p_rabattcode <> '' then
      select id, betrag, prozent, eingeloest, gueltig_bis into v_code
        from rabattcodes
       where betrieb_id = p_betrieb_id and code = p_rabattcode
       for update;

      if v_code.id is null then
        raise exception 'Dieser Rabattcode ist unbekannt.' using errcode='P0001';
      end if;
      if v_code.eingeloest then
        raise exception 'Dieser Rabattcode wurde bereits eingelöst.' using errcode='P0001';
      end if;
      if v_code.gueltig_bis is not null and v_code.gueltig_bis < now() then
        raise exception 'Dieser Rabattcode ist abgelaufen.' using errcode='P0001';
      end if;

      v_code_id := v_code.id;
      v_rabattbetrag := coalesce(v_code.betrag, round(basis_summe * v_code.prozent / 100, 2));
      v_rabattbetrag := least(v_rabattbetrag, basis_summe);
    end if;

    if basis_summe > 0 and coalesce(p_summe,0) < (basis_summe - v_rabattbetrag) - 0.01 then
      raise exception 'Der Preis stimmt nicht. Bitte die Karte neu laden.'
        using errcode='P0001';
    end if;
  end if;

  if p_gast_kennung is not null then
    select id into neue from bestellungen where gast_kennung = p_gast_kennung limit 1;
    if neue is not null then return neue; end if;
  end if;

  if p_quelle = 'tisch' then
    perform pg_advisory_xact_lock(hashtext('tagesnummer:' || p_betrieb_id::text));
    tagesbeginn := date_trunc('day', now() at time zone 'Europe/Berlin')
                     at time zone 'Europe/Berlin';
    select coalesce(max(tagesnummer), 99) + 1 into tagesnr
      from bestellungen
     where betrieb_id = p_betrieb_id
       and zeitpunkt >= tagesbeginn;
    if tagesnr > 999 then tagesnr := null; end if;
  end if;

  insert into bestellungen
    (betrieb_id, quelle, status, tisch, summe, summe_gast, notiz,
     positionen, gast_kennung, tagesnummer, tisch_bestaetigt, geraet)
  values
    (p_betrieb_id, p_quelle, 'neu', tisch_final,
     coalesce(p_summe,0), coalesce(p_summe,0),
     p_notiz, coalesce(p_positionen,'[]'::jsonb), p_gast_kennung,
     tagesnr, bestaetigt, p_geraet)
  returning id into neue;

  if v_code_id is not null then
    update rabattcodes
       set eingeloest = true, eingeloest_bestellung_id = neue, eingeloest_am = now()
     where id = v_code_id;
    update bestellungen
       set rabatt_betrag = v_rabattbetrag, rabatt_code = p_rabattcode
     where id = neue;
  end if;

  return neue;
end;
$function$;

grant execute on function public.bestellung_aufgeben(uuid, text, text, numeric, text, jsonb, text, text, text, text, text) to anon, authenticated, service_role;

drop function public.bestellung_liefern(uuid, jsonb, jsonb, numeric, text, text, text);

CREATE FUNCTION public.bestellung_liefern(p_betrieb_id uuid, p_adresse jsonb, p_positionen jsonb, p_summe numeric, p_notiz text DEFAULT NULL::text, p_gast_kennung text DEFAULT NULL::text, p_geraet text DEFAULT NULL::text, p_rabattcode text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_liefer    jsonb;
  v_plz       text;
  v_mindest   numeric;
  v_gebuehr   numeric;
  v_gratis    numeric;
  v_id        uuid;
  v_ware      numeric;
  v_rabatt    numeric;
  v_endgueltig numeric;
begin
  select liefer into v_liefer from betriebe where id = p_betrieb_id;

  if v_liefer is null or coalesce((v_liefer->>'an')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'grund', 'aus');
  end if;

  if p_adresse is null
     or coalesce(trim(p_adresse->>'name'), '')    = ''
     or coalesce(trim(p_adresse->>'strasse'), '') = ''
     or coalesce(trim(p_adresse->>'plz'), '')     = ''
     or coalesce(trim(p_adresse->>'ort'), '')     = ''
     or coalesce(trim(p_adresse->>'telefon'), '') = ''
  then
    return jsonb_build_object('ok', false, 'grund', 'adresse');
  end if;

  v_plz := trim(p_adresse->>'plz');
  if jsonb_typeof(v_liefer->'plz') <> 'array'
     or jsonb_array_length(v_liefer->'plz') = 0
     or not exists (
       select 1 from jsonb_array_elements_text(v_liefer->'plz') p
        where trim(p) = v_plz)
  then
    return jsonb_build_object('ok', false, 'grund', 'plz', 'plz', v_plz);
  end if;

  if v_liefer ? 'zeiten' and jsonb_typeof(v_liefer->'zeiten') = 'object' then
    declare
      v_jetzt   timestamp := now() at time zone 'Europe/Berlin';
      v_von     time;
      v_bis     time;
      v_uhr     time;
      v_tag     int;
      v_tage    jsonb := v_liefer->'zeiten'->'tage';
      v_offen   boolean;
    begin
      v_von := nullif(v_liefer->'zeiten'->>'von', '')::time;
      v_bis := nullif(v_liefer->'zeiten'->>'bis', '')::time;
      v_uhr := v_jetzt::time;
      v_tag := extract(isodow from v_jetzt)::int;

      if jsonb_typeof(v_tage) = 'array' and jsonb_array_length(v_tage) > 0
         and not exists (select 1 from jsonb_array_elements_text(v_tage) d
                          where d::int = v_tag)
      then
        return jsonb_build_object('ok', false, 'grund', 'zeit');
      end if;

      if v_von is not null and v_bis is not null then
        v_offen := case when v_von <= v_bis
                        then v_uhr >= v_von and v_uhr < v_bis
                        else v_uhr >= v_von or  v_uhr < v_bis end;
        if not v_offen then
          return jsonb_build_object('ok', false, 'grund', 'zeit',
                                    'von', to_char(v_von, 'HH24:MI'),
                                    'bis', to_char(v_bis, 'HH24:MI'));
        end if;
      end if;
    end;
  end if;

  v_mindest := coalesce((v_liefer->>'mindest')::numeric, 0);
  if v_mindest > 0 and coalesce(p_summe, 0) < v_mindest then
    return jsonb_build_object('ok', false, 'grund', 'mindest',
                              'mindest', v_mindest);
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

  select summe, coalesce(rabatt_betrag,0) into v_ware, v_rabatt from bestellungen where id = v_id;
  v_ware := coalesce(v_ware, 0);

  v_gebuehr := coalesce((v_liefer->>'gebuehr')::numeric, 0);
  v_gratis  := coalesce((v_liefer->>'gratis_ab')::numeric, 0);
  if v_gratis > 0 and v_ware >= v_gratis then
    v_gebuehr := 0;
  end if;

  update bestellungen
     set liefer_adresse = jsonb_strip_nulls(jsonb_build_object(
           'name',    trim(p_adresse->>'name'),
           'strasse', trim(p_adresse->>'strasse'),
           'plz',     v_plz,
           'ort',     trim(p_adresse->>'ort'),
           'telefon', trim(p_adresse->>'telefon'),
           'klingel', nullif(trim(coalesce(p_adresse->>'klingel','')), ''))),
         liefergebuehr  = v_gebuehr,
         abholung       = false
   where id = v_id;

  v_endgueltig := v_ware + v_gebuehr;

  return jsonb_build_object(
    'ok',       true,
    'id',       v_id,
    'ware',     v_ware,
    'rabatt',   v_rabatt,
    'gebuehr',  v_gebuehr,
    'summe',    v_endgueltig,
    'dauer',    coalesce((v_liefer->>'dauer_min')::int, null));
end $function$;

grant execute on function public.bestellung_liefern(uuid, jsonb, jsonb, numeric, text, text, text, text) to anon, authenticated, service_role;

commit;

-- ═══════════════════════════════════════════════════════════════════
--  DANACH PRÜFEN · aus dem Katalog gelesen, nicht behauptet (§0)
-- ═══════════════════════════════════════════════════════════════════
--
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and p.proname in ('bestellung_aufgeben','bestellung_liefern');
--
--   Erwartet: je GENAU EINE Zeile. Danach die neun Fälle oben (echte
--   Testbetriebe, zurückgedrehte Transaktion) — kein gemockter Test.
-- ═══════════════════════════════════════════════════════════════════
