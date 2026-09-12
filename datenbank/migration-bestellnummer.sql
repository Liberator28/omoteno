-- ═══════════════════════════════════════════════════════════════════
--  NOCH NICHT ANGEWENDET · Storno und Restzeit suchten den falschen
--  Schlüssel
--
--  Anwenden im SQL-Editor von Supabase. Danach die Proben ganz unten
--  fahren — eine Migration, die „success" meldet, sagt NICHTS darüber,
--  ob die Funktion läuft (CLAUDE.md §2.2).
--
--  ── BEFUND ────────────────────────────────────────────────────
--  Der Betreiber meldete: „Man kann seine Bestellungen nicht
--  stornieren, es kommt nichts durch." Auf dem Bildschirmfoto steht
--  unter den Knöpfen: „Das geht hier gerade nicht. Bitte sagen Sie
--  kurz Bescheid."
--
--  Gemessen, nicht vermutet. Der Hub schickt die UUID der Zeile:
--
--      hub.vorlage.html:7632   const nummer = zeile && zeile.id ? zeile.id : null;
--      hub.vorlage.html:7650   letzteBestellung.nummer = nummer;
--      hub.vorlage.html:3877   body: JSON.stringify({ nummer: b.nummer, … })
--
--  Die Funktion suchte aber über die QUITTUNGSNUMMER:
--
--      migration-baukasten-und-storno.sql:170
--          select * into v_b from bestellungen where gast_kennung = nummer;
--
--  Eine UUID ist nie eine Quittungsnummer. Also nie ein Treffer, also
--  'grund','unbekannt', also im Hub der Auffangzweig — genau der Satz
--  aus dem Bildschirmfoto.
--
--  ── DERSELBE FEHLER STEHT EIN ZWEITES MAL ─────────────────────
--      migration-restzeit.sql:101   where b.gast_kennung = nummer
--
--  Gerufen wird sie mit demselben Wert (hub.vorlage.html:7393).
--  Der Countdown „noch ca. X Minuten" ist damit ebenfalls tot — nur
--  unauffällig, weil er stumm ausfällt statt zu meckern. Das hatte
--  noch niemand gemeldet.
--
--  bestellung_status erwartet dagegen die id (pruef-rechte.sql:86-89:
--  v_id := bestellung_aufgeben(…) → bestellung_status(v_id)) und lief
--  die ganze Zeit richtig. Drei Funktionen, ein Wert, zwei
--  Auffassungen davon, was er bedeutet.
--
--  ── WARUM DIE SQL SICH ÄNDERT UND NICHT DER HUB ───────────────
--  Man könnte auch den Hub die Quittungsnummer schicken lassen. Das
--  wäre falsch, und zwar messbar: Der gemerkte Vorgang speichert
--  nummer, tisch, summe, posten, notiz (hub.vorlage.html:7633-7642) —
--  die kennung NICHT. Nach einem Neuladen hat der Gast also nur die
--  id. Wer auf die Quittungsnummer umstellt, macht Stornieren nach
--  jedem Neuladen kaputt. Die id ist der Wert, der in JEDEM Zustand
--  da ist, und bestellung_status benutzt ihn bereits.
--
--  ── WARUM NUR EIN SCHLÜSSEL UND KEIN „BEIDE" ──────────────────
--  Nachgesehen: Jeder Weg endet bei der id. Auch die Wiederfindung
--  nach einem Verbindungsabbruch geht über bestellung_gefunden und
--  reicht danach die id weiter (hub.vorlage.html:7593
--  wsErfolg(e, {id: da.id})). Es gibt keinen Aufrufer mit einer
--  Quittungsnummer. Eine Funktion, die beides annimmt, würde also
--  einen Fall abdecken, den es nicht gibt — und genau die
--  Doppeldeutigkeit fortschreiben, aus der dieser Fehler entstand.
--
--  Gegen ein Wiederauftreten steht stattdessen eine Prüfung:
--  pruefungen/pruef-naht.js hält den Wert, den der Hub schickt, gegen
--  die Spalte, über die die SQL sucht.
--
--  ── WAS SICH NICHT ÄNDERT ─────────────────────────────────────
--  Beide Signaturen bleiben BYTEGLEICH:
--      bestellung_stornieren(nummer text, posten jsonb)
--      bestellung_restzeit(nummer text)
--  Sonst ersetzt „create or replace" nicht, sondern legt eine ZWEITE
--  Funktion daneben — der Vorfall steht in CLAUDE.md §2.1. Welche
--  PostgREST dann trifft, hängt davon ab, welche Parameter der
--  Aufrufer schickt.
--
--  Die gesamte Storno-Logik darunter (Frist, Statusprüfung, Streichen
--  über die STELLE, Vollstorno-Erkennung, Summenneuberechnung) ist
--  unverändert übernommen. Geändert sind allein die Zeilen, die die
--  Bestellung heraussuchen.
--
--  bestellung_restzeit wechselt dabei von „language sql" zu plpgsql.
--  Grund: Vor dem Cast nach uuid muss geprüft werden, ob überhaupt
--  eine UUID dasteht — sonst wirft ein alter zwischengespeicherter
--  Hub oder ein Spaßvogel eine Ausnahme statt eine ehrliche Antwort
--  zu bekommen. In reinem SQL ließe sich diese Reihenfolge nicht
--  verlässlich erzwingen. Die Signatur bleibt davon unberührt.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Storno ───────────────────────────────────────────────────
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
  -- Der Hub schickt die id der Zeile. Was keine UUID ist, kann keine
  -- sein — dann gleich die ehrliche Antwort, statt den Cast eine
  -- Ausnahme werfen zu lassen. Der Gast saehe sonst „Keine
  -- Verbindung", obwohl die Verbindung steht.
  if nummer is null or nummer !~*
     '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;

  select * into v_b from bestellungen where id = nummer::uuid;
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


-- ── 2 · Restzeit ─────────────────────────────────────────────────
create or replace function public.bestellung_restzeit(nummer text)
returns integer
language plpgsql
stable
security definer
-- Der search_path bleibt eng. make_interval, now() und greatest kommen
-- aus pg_catalog, es wird nichts aus „extensions" gebraucht (§2.2).
set search_path = public
as $$
declare
  v_rest integer;
begin
  if nummer is null or nummer !~*
     '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return null;
  end if;

  select case
           when b.status = 'fertig' then 0
           when b.wartezeit_min is null or b.bestaetigt_um is null then null
           else greatest(0, ceil(extract(epoch from
                  (b.bestaetigt_um + make_interval(mins => b.wartezeit_min)) - now()
                ))::integer)
         end
    into v_rest
    from public.bestellungen b
   where b.id = nummer::uuid
   limit 1;

  return v_rest;
end $$;

-- Der Gast ruft mit dem anon-Schlüssel. Das Recht gilt der FUNKTION,
-- nicht der Tabelle — auf bestellungen hat anon weiterhin gar nichts.
revoke all on function public.bestellung_restzeit(text) from public;
grant execute on function public.bestellung_restzeit(text) to anon, authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════
--  DANACH PRÜFEN — beides, in dieser Reihenfolge
-- ═══════════════════════════════════════════════════════════════════
--
-- ── 1 · Genau EINE Fassung je Funktion? (§2.1) ───────────────────
--
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('bestellung_stornieren','bestellung_restzeit')
--   order by p.proname;
--
--   → muss GENAU ZWEI Zeilen liefern:
--       bestellung_restzeit    | nummer text
--       bestellung_stornieren  | nummer text, posten jsonb
--
--   Stehen dort drei oder vier, hat „create or replace" danebengelegt
--   statt ersetzt. Dann die überzählige Fassung mit vollständiger
--   Signatur löschen, sonst entscheidet der Zufall, welche der Gast
--   trifft.
--
--
-- ── 2 · Läuft es wirklich? ───────────────────────────────────────
--
--   Der Funktionskörper wird beim Anlegen NICHT geprüft (§2.2).
--   Der folgende Block legt eine echte Bestellung an, spielt alle
--   Fälle durch und dreht am Ende ALLES zurück. raise notice
--   erscheint über MCP nicht — deshalb der Umweg über eine
--   temporäre Tabelle.
--
--   EIN NEBENEFFEKT, DEN MAN WISSEN MUSS: Die Probe ruft
--   bestellung_aufgeben, und daran hängt die Meldung ans Board. Die
--   Bestellung selbst verschwindet mit dem rollback — eine Meldung
--   kann trotzdem hinausgehen. Am besten außerhalb der Betriebszeit
--   fahren, sonst wundert sich die Küche.
--
-- begin;
-- create temp table probe(nr int, was text, ergebnis text);
-- do $$
-- declare
--   v_betrieb uuid;
--   v_id      uuid;
--   r         jsonb;
--   n         integer;
-- begin
--   select id into v_betrieb from betriebe order by id limit 1;
--   if v_betrieb is null then
--     insert into probe values (0,'Vorbedingung','KEIN BETRIEB — Probe nicht moeglich');
--     return;
--   end if;
--
--   v_id := bestellung_aufgeben(v_betrieb,'tisch','7',0,'Probe Bestellnummer','[]'::jsonb);
--   insert into probe values (1,'Bestellung angelegt', coalesce(v_id::text,'NULL'));
--
--   -- Der Anlassfall: Storno ueber genau den Wert, den der Hub schickt
--   r := bestellung_stornieren(v_id::text);
--   insert into probe values (2,'Storno ueber die id',
--     case when r->>'ok' = 'true' then 'ok' else 'KAPUTT: '||r::text end);
--
--   -- Einzelne Stelle streichen. Zwei Zeilen hineinlegen, eine weg.
--   update bestellungen
--      set status='neu', storno='[]'::jsonb, zeitpunkt=now(),
--          positionen='[{"n":"A","preis":5,"menge":1},{"n":"B","preis":3,"menge":2}]'::jsonb,
--          summe=11
--    where id=v_id;
--   r := bestellung_stornieren(v_id::text, '["0"]'::jsonb);
--   insert into probe values (3,'eine Stelle streichen',
--     case when r->>'ok' = 'true' and (r->>'summe')::numeric = 6
--          then 'ok, Rest 6' else 'KAPUTT: '||r::text end);
--
--   -- Frist: drei Minuten alt, muss abgelehnt werden
--   update bestellungen
--      set status='neu', zeitpunkt=now() - interval '3 minutes'
--    where id=v_id;
--   r := bestellung_stornieren(v_id::text);
--   insert into probe values (4,'drei Minuten alt',
--     case when r->>'grund' = 'frist' then 'ok, abgelehnt'
--          else 'KAPUTT: '||r::text end);
--
--   -- Restzeit ueber dieselbe id
--   update bestellungen
--      set status='neu', zeitpunkt=now(), wartezeit_min=20, bestaetigt_um=now()
--    where id=v_id;
--   n := bestellung_restzeit(v_id::text);
--   insert into probe values (5,'Restzeit ueber die id',
--     case when n is not null and n > 0 then 'ok, '||n||' Sekunden'
--          else 'KAPUTT: '||coalesce(n::text,'NULL') end);
--
--   -- Unfug darf keine Ausnahme werfen, sondern muss ehrlich antworten
--   r := bestellung_stornieren('keine-uuid');
--   insert into probe values (6,'Unfug statt UUID',
--     case when r->>'grund' = 'unbekannt' then 'ok, abgewiesen'
--          else 'KAPUTT: '||r::text end);
--   n := bestellung_restzeit('keine-uuid');
--   insert into probe values (7,'Restzeit mit Unfug',
--     case when n is null then 'ok, null' else 'KAPUTT: '||n end);
--
-- exception when others then
--   insert into probe values (99,'ABBRUCH', sqlerrm);
-- end $$;
-- select * from probe order by nr;
-- rollback;
--
--   → Jede Zeile muss mit „ok" beginnen. Steht irgendwo „KAPUTT"
--     oder „ABBRUCH", ist die Migration NICHT in Ordnung — dann
--     nichts scharf schalten, sondern die Zeile melden.
