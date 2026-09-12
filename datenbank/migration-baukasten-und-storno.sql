-- ═══════════════════════════════════════════════════════════════════
--  NOCH NICHT ANGEWENDET · Zwei Dinge, ein Einspielen
--
--  Im SQL-Editor von Supabase ausführen. Die Proben am Dateiende
--  gehören dazu: Eine Migration, die „success" meldet, sagt NICHTS
--  darüber, ob die Funktion läuft (CLAUDE.md §2.2).
--
--  1 · betriebe.hub_kacheln   — der Kachel-Baukasten im Admin-Board
--  2 · bestellungen.storno    — der Gast zieht binnen zwei Minuten
--      und bestellung_stornieren()  zurück
--
--  Beide Abschnitte sind ADDITIV (§2.5): Sie legen an, sie ändern
--  nichts Bestehendes. Wer nur einen davon braucht, kann den anderen
--  stehen lassen — sie hängen nicht zusammen.
-- ═══════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════
--  1 · DER KACHEL-BAUKASTEN
--
--  BEFUND. Die Startkacheln des Hubs kommen bisher aus dem
--  MARKENBLATT und werden beim Erzeugen in die Datei gebacken. Das
--  ist richtig für Farben, Schriften und Aufbau — die stellt das
--  Marken-Studio bei der Aufnahme eines Hauses ein.
--
--  Der WIRT arbeitet aber im Admin-Board, und was er dort umstellt,
--  will er beim nächsten Öffnen des Hubs sehen und nicht beim
--  nächsten Erzeugen. Deshalb derselbe Weg wie bei hub_texte: eine
--  Spalte, die der Hub zur Laufzeit liest.
--
--  WARUM EINE EIGENE SPALTE UND NICHT hub_texte. Auf hub_texte liegt
--  eine Größenschranke (hub_texte_masse). Ihren Wert konnte ich nicht
--  nachsehen — die Datenbank ist aus meiner Arbeitsumgebung gesperrt.
--  Eine Kachelliste dort hineinzudrücken hieße raten, und Raten ist
--  genau das, wogegen §0 steht.
-- ══════════════════════════════════════════════════════════════════

begin;

alter table public.betriebe
  add column if not exists hub_kacheln jsonb;

comment on column public.betriebe.hub_kacheln is
  'Startkacheln des Gaeste-Hubs, im Admin-Board eingestellt. Liste von '
  '{schluessel, an, titel, unter, icon, banner}. Der Hub liest sie zur '
  'Laufzeit und nimmt nur Felder aus seiner eigenen Positivliste an.';

-- Eine Schranke, die zu dem passt, was der Baukasten wirklich
-- schickt: dreizehn Kacheln mit Titel, Unterzeile, Symbolnamen und
-- einer Bildadresse. 20 kB sind das Doppelte davon — genug Luft, und
-- weit entfernt davon, dass jemand eine Karte in die Spalte legt.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'betriebe_hub_kacheln_masse')
  then
    alter table public.betriebe
      add constraint betriebe_hub_kacheln_masse
      check (hub_kacheln is null or pg_column_size(hub_kacheln) < 20000);
  end if;
end $$;

-- Der Gast liest die Spalte mit dem anon-Schluessel. Das Leserecht
-- ist SPALTENWEISE vergeben — genau wie bei den uebrigen Kopfdaten,
-- damit „select *" auf betriebe weiterhin scheitert und plan,
-- preis_monat und vertrag_ab nicht mit herauskommen (§2.3a).
grant select (hub_kacheln) on public.betriebe to anon;

-- Schreiben darf nur, wer ohnehin schon Betriebsdaten aendern darf.
-- Hier wird KEINE RLS-Regel angefasst: Die vorhandene Regel fuer
-- authenticated entscheidet weiterhin, WELCHE Zeile — dieses Recht
-- sagt nur, dass die neue Spalte dabei ist.
grant update (hub_kacheln) on public.betriebe to authenticated;

commit;

-- ── PROBE 1 ──────────────────────────────────────────────────────
--   begin;
--   create temp table probe(schritt text, ergebnis text);
--   do $$
--   declare v_id uuid; v_n int;
--   begin
--     select id into v_id from betriebe limit 1;
--     update betriebe set hub_kacheln =
--       '[{"schluessel":"speisekarte","titel":"Unsere Karte"}]'::jsonb
--      where id = v_id;
--     get diagnostics v_n = row_count;
--     insert into probe values ('schreiben', v_n || ' Zeile(n)');
--
--     -- Zu gross muss ABGELEHNT werden. Faengt die Schranke nicht,
--     -- ist sie keine.
--     begin
--       update betriebe set hub_kacheln =
--         to_jsonb(repeat('x', 30000)) where id = v_id;
--       insert into probe values ('zu gross', 'DURCHGELASSEN — Schranke greift nicht');
--     exception when check_violation then
--       insert into probe values ('zu gross', 'abgelehnt, richtig');
--     end;
--   end $$;
--   select * from probe;
--   rollback;
--
-- ── PROBE 2 · liest der Gast sie? ────────────────────────────────
--   begin;
--   set local role anon;
--   select slug, hub_kacheln from betriebe where slug = 'chocolamour';
--   -- muss EINE Zeile liefern
--   rollback;
--
--   begin;
--   set local role anon;
--   select preis_monat from betriebe limit 1;
--   -- muss weiterhin mit 42501 scheitern
--   rollback;


-- ══════════════════════════════════════════════════════════════════
--  2 · STORNO BINNEN ZWEI MINUTEN
--
--  BEFUND. Der Gast tippt sich vertan und kann nichts dagegen tun:
--  Es gibt keinen Weg zurueck. Er muss aufstehen und jemanden suchen —
--  wegen einer Cola, die er nicht wollte.
--
--  Der Status 'storniert' ist im Board LAENGST bekannt (awAuswerten
--  filtert ihn aus dem Umsatz, die Ausgabe kennt sein Wort). Was
--  fehlte, war jeder Weg dorthin.
--
--  WARUM EINE FUNKTION UND KEIN DIREKTES UPDATE. CLAUDE.md 2.3a: Ein
--  direkter Weg in die Tabelle prueft nur, was RLS prueft — und RLS
--  rechnet keine Frist und keine Summe nach. Ein Gast koennte sonst
--  eine Stunde alte Bestellung stornieren, indem er die Uhr seines
--  Telefons verstellt. Die Frist gehoert auf den SERVER.
--
--  WARUM DIE STORNIERTEN ZEILEN STEHEN BLEIBEN. Sie wandern nach
--  bestellungen.storno statt geloescht zu werden. Wer schon kocht,
--  muss sehen, WAS wegfaellt — nicht nur, DASS etwas wegfiel. Ein
--  Bon, aus dem still eine Zeile verschwindet, ist schlimmer als
--  keiner.
-- ══════════════════════════════════════════════════════════════════

begin;

alter table public.bestellungen
  add column if not exists storno jsonb;

comment on column public.bestellungen.storno is
  'Die vom Gast zurueckgezogenen Posten, gleiche Form wie positionen. '
  'Sie bleiben stehen, damit die Kueche sieht, was wegfaellt.';

-- ÜBERHOLT durch migration-bestellnummer.sql — NICHT mehr einspielen.
-- Die Zeilensuche unten geht über gast_kennung, der Hub schickt aber
-- die id der Zeile. Ergebnis: Der Gast konnte nie stornieren („Das
-- geht hier gerade nicht"). Die Fassung bleibt hier nur als
-- Verlaufsakte stehen; die gültige steht in migration-bestellnummer.sql.
create or replace function public.bestellung_stornieren(
  nummer text,
  posten jsonb default null      -- Liste von STELLEN ("0","2"); null = alles
) returns jsonb
language plpgsql
security definer
-- pg_catalog reicht: jsonb, now(), interval. Nichts aus extensions
-- (CLAUDE.md 2.2), und der search_path bleibt eng.
set search_path to 'public'
as $$
declare
  v_b        bestellungen%rowtype;
  v_frist    constant interval := interval '2 minutes';
  v_bleibt   jsonb := '[]'::jsonb;
  v_weg      jsonb := '[]'::jsonb;
  v_zeile    jsonb;
  v_summe    numeric := 0;
  v_treffer  boolean;
  v_i        int;
begin
  select * into v_b from bestellungen where gast_kennung = nummer;
  if not found then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;

  -- Die Frist rechnet der SERVER. Die Uhr des Gastes zaehlt nicht.
  if now() - v_b.zeitpunkt > v_frist then
    return jsonb_build_object('ok', false, 'grund', 'frist');
  end if;

  -- Was fertig oder schon storniert ist, wird nicht noch einmal
  -- angefasst. Sonst kaeme ein zweiter Tipp durch und die Summe
  -- rutschte ins Minus.
  if v_b.status in ('fertig', 'storniert') then
    return jsonb_build_object('ok', false, 'grund', 'zu_spaet',
                              'status', v_b.status);
  end if;

  -- ── Alles zurueckziehen ──────────────────────────────────────
  if posten is null or jsonb_array_length(coalesce(posten, '[]'::jsonb)) = 0 then
    update bestellungen
       set status = 'storniert',
           storno = coalesce(v_b.storno, '[]'::jsonb) || coalesce(v_b.positionen, '[]'::jsonb),
           positionen = '[]'::jsonb,
           summe = 0
     where id = v_b.id;
    return jsonb_build_object('ok', true, 'alles', true, 'rest', 0, 'summe', 0);
  end if;

  -- ── Einzelne Zeilen ──────────────────────────────────────────
  -- Gezaehlt wird ueber die STELLE in der Liste, nicht ueber den
  -- Namen. Grund: Der Name in der Datenbank traegt die Zusaetze mit
  -- ("Dubai Crepe (extra Pistazie)"), und der Hub baut ihn beim
  -- Senden aus dem damaligen Zustand der Auswahl zusammen. Wer
  -- spaeter ueber den Namen sucht, sucht unter Umstaenden einen, den
  -- es so nicht mehr gibt — und stornierte dann nichts oder das
  -- Falsche. Die Stelle ist eindeutig.
  --
  -- Zwei gleiche Zeilen sind damit auch unterscheidbar: Wer zweimal
  -- dieselbe Cola bestellt hat, kann EINE davon zuruecknehmen.
  for v_i in 0 .. jsonb_array_length(coalesce(v_b.positionen, '[]'::jsonb)) - 1
  loop
    v_zeile := v_b.positionen -> v_i;
    select exists (
      select 1 from jsonb_array_elements_text(posten) n
       where n = v_i::text
    ) into v_treffer;

    if v_treffer then
      v_weg := v_weg || jsonb_build_array(v_zeile);
    else
      v_bleibt := v_bleibt || jsonb_build_array(v_zeile);
      v_summe  := v_summe
                + coalesce((v_zeile->>'preis')::numeric, 0)
                * coalesce((v_zeile->>'menge')::numeric, 1);
    end if;
  end loop;

  if jsonb_array_length(v_weg) = 0 then
    return jsonb_build_object('ok', false, 'grund', 'nichts_getroffen');
  end if;

  -- Bleibt nichts uebrig, ist es ein Vollstorno — sonst staende ein
  -- leerer Bon in der Kueche.
  if jsonb_array_length(v_bleibt) = 0 then
    update bestellungen
       set status = 'storniert',
           storno = coalesce(v_b.storno, '[]'::jsonb) || v_weg,
           positionen = '[]'::jsonb,
           summe = 0
     where id = v_b.id;
    return jsonb_build_object('ok', true, 'alles', true, 'rest', 0, 'summe', 0);
  end if;

  update bestellungen
     set storno = coalesce(v_b.storno, '[]'::jsonb) || v_weg,
         positionen = v_bleibt,
         summe = v_summe
   where id = v_b.id;

  -- Die verbliebenen Zeilen kommen mit zurueck: Der Hub zeigt danach
  -- seine eigene Liste an, und die soll nicht raten muessen.
  return jsonb_build_object('ok', true, 'alles', false,
                            'rest', jsonb_array_length(v_bleibt),
                            'summe', v_summe,
                            'positionen', v_bleibt);
end $$;

revoke all on function public.bestellung_stornieren(text, jsonb) from public;
grant execute on function public.bestellung_stornieren(text, jsonb) to anon, authenticated;

-- Die Kueche liest die Spalte mit dem Personal-Schluessel. Sie hat
-- auf bestellungen ohnehin Zugriff; das Recht gilt der neuen Spalte.
grant select (storno) on public.bestellungen to authenticated;

commit;

-- ── DANACH PRÜFEN ────────────────────────────────────────────────
--
-- 1 · Genau EINE Fassung? (§2.1)
--
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'bestellung_stornieren';
--
--   → muss GENAU EINE Zeile liefern: nummer text, posten jsonb
--
-- 2 · Laeuft sie? Die Probe legt an, storniert, und dreht zurueck.
--
--   begin;
--   create temp table probe(schritt text, ergebnis text);
--   do $$
--   declare v_betrieb uuid; v_a jsonb;
--   begin
--     select id into v_betrieb from betriebe limit 1;
--     insert into bestellungen (betrieb_id, quelle, status, summe,
--                               gast_kennung, positionen, zeitpunkt)
--     values (v_betrieb, 'tisch', 'neu', 12.50, 'probe_storno_0001',
--             '[{"name":"Cola","menge":1,"preis":3.50},
--               {"name":"Waffel","menge":1,"preis":9.00}]'::jsonb,
--             now() - interval '30 seconds');
--
--     -- "0" ist die erste Zeile: die Cola.
--     select bestellung_stornieren('probe_storno_0001', '["0"]'::jsonb) into v_a;
--     insert into probe values ('eine Zeile weg', v_a::text);
--     -- erwartet: ok true, alles false, rest 1, summe 9.00
--
--     insert into probe values ('Summe danach',
--       (select summe::text from bestellungen where gast_kennung='probe_storno_0001'));
--
--     select bestellung_stornieren('probe_storno_0001', null) into v_a;
--     insert into probe values ('Rest weg', v_a::text);
--     -- erwartet: ok true, alles true
--
--     select bestellung_stornieren('probe_storno_0001', null) into v_a;
--     insert into probe values ('noch einmal', v_a::text);
--     -- erwartet: ok false, grund zu_spaet  (nicht zweimal stornieren)
--
--     -- Und die Frist. Eine alte Bestellung darf NICHT gehen.
--     insert into bestellungen (betrieb_id, quelle, status, summe,
--                               gast_kennung, positionen, zeitpunkt)
--     values (v_betrieb, 'tisch', 'neu', 3.50, 'probe_storno_0002',
--             '[{"name":"Cola","menge":1,"preis":3.50}]'::jsonb,
--             now() - interval '10 minutes');
--     select bestellung_stornieren('probe_storno_0002', null) into v_a;
--     insert into probe values ('zu alt', v_a::text);
--     -- erwartet: ok false, grund frist
--   end $$;
--   select * from probe;
--   rollback;
--
-- 3 · Und der Weg, den der Gast wirklich geht (§2.4):
--
--   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/bestellung_stornieren" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--        -H "Content-Type: application/json" \
--        -d '{"nummer":"<echte Quittungsnummer>","posten":["0"]}'
