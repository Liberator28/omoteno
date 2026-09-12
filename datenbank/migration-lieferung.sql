-- ═══════════════════════════════════════════════════════════════════
--  NOCH NICHT ANGEWENDET · Lieferung
--
--  ┌───────────────────────────────────────────────────────────────┐
--  │  ZUERST DIE VORABFRAGE GANZ UNTEN UNTER „SCHRITT 0" FAHREN.   │
--  │  Sie beantwortet eine Frage, die ich von hier aus NICHT       │
--  │  beantworten kann. Erst danach diese Datei einspielen.        │
--  └───────────────────────────────────────────────────────────────┘
--
--  ── WAS HIER ENTSTEHT ─────────────────────────────────────────
--  Der Gast kann sich liefern lassen statt am Tisch zu bestellen.
--  Bezahlt wird beim Betrieb an der Tür (bar oder dessen eigenes
--  Kartengerät) — es fließt kein Geld über Omoteno. Stripe kommt
--  später als eigener, abschaltbarer Zusatz; ohne ihn läuft alles.
--
--  ── WARUM EINE HÜLLE UND KEINE ÄNDERUNG AN bestellung_aufgeben ──
--  Die Definition von bestellung_aufgeben steht NICHT in diesem
--  Verzeichnis — nur ihre Aufrufe. Ihr Körper ist aus meiner
--  Umgebung nicht lesbar (der Datenbankzugang ist gesperrt).
--
--  Eine Funktion umzuschreiben, die man nie gesehen hat, ist genau
--  die Annahme, gegen die §0 steht. Und ein zusätzlicher Parameter
--  würde nach §2.1 ohnehin eine ZWEITE Funktion daneben anlegen statt
--  zu ersetzen — der Vorfall dazu steht in CLAUDE.md.
--
--  Deshalb: bestellung_liefern() ist eine HÜLLE. Sie prüft das
--  Liefergebiet, ruft dann die vorhandene bestellung_aufgeben() auf
--  und hängt die Lieferdaten an die zurückgegebene Zeile. Die
--  Preisnachrechnung aus der Karte, die Vertragsprüfung und die
--  Bestellpause bleiben, wo sie sind — sie werden WIEDERVERWENDET,
--  nicht nachgebaut.
--
--  ── WAS DER SERVER RECHNET UND WAS ER GLAUBT ──────────────────
--  Zwei Dinge, bewusst unterschiedlich streng (§7):
--
--  • Die LIEFERGEBÜHR ist Geld. Sie wird IMMER aus betriebe.liefer
--    und der vom Server ermittelten Warensumme gerechnet, nie aus
--    einer Zahl des Browsers. Das ist §2.3a — dort gingen einmal
--    99 Stück für 1 Cent durch, weil eine Zahl aus dem Browser
--    geglaubt wurde.
--
--  • Der MINDESTBESTELLWERT ist eine Hausregel, keine Sicherheitsgrenze.
--    Er wird gegen die Summe geprüft, die der Hub mitschickt. Wer sie
--    fälscht, erreicht damit genau eines: dass ihm eine kleinere
--    Bestellung geliefert wird, als der Wirt eigentlich möchte. Das
--    kostet einen Gang, nicht Geld. Ein echter Gast, der wegen einer
--    strengeren Prüfung nicht bestellen kann, kostet Umsatz. Also
--    weich — und hier ausgeschrieben, damit es niemand für ein
--    Versehen hält.
--
--  ── DIE FORM VON betriebe.liefer ──────────────────────────────
--    {
--      "an":        true,            -- Liefermodus überhaupt an?
--      "plz":       ["45127","45128"],
--      "mindest":   15.00,           -- Mindestbestellwert, 0 = keiner
--      "gebuehr":   2.50,            -- Liefergebühr
--      "gratis_ab": 30.00,           -- ab dieser Warensumme frei, 0 = nie
--      "dauer_min": 45,              -- zugesagte Lieferzeit in Minuten
--      "bar":       true,            -- bar an der Tür
--      "karte":     true,            -- Kartengerät an der Tür
--      "zeiten":    {                -- optional; fehlt = immer offen
--        "von":  "17:00",
--        "bis":  "01:00",            -- darf über Mitternacht gehen
--        "tage": [4,5,6]             -- 1=Mo … 7=So; leer = jeden Tag
--      }
--    }
--
--  Die Zeitzone der Prüfung ist fest „Europe/Berlin". Das ist eine
--  ehrliche Festlegung, keine Vergesslichkeit: Die Datenbank läuft in
--  UTC, und ein Wirt, der „ab 17 Uhr" einstellt, meint seine Uhr, nicht
--  die von Greenwich. Sobald ein Betrieb außerhalb dieser Zone steht,
--  gehört die Zone an den Betrieb — dann ist es eine Spalte, kein
--  Literal.
--
--  Eine Spalte, zur Laufzeit gelesen — dasselbe Muster wie hub_texte
--  und hub_kacheln. Der Wirt ändert etwas im Board, der Gast sieht es
--  beim nächsten Öffnen, nicht beim nächsten Erzeugen.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Die Spalten, additiv ─────────────────────────────────────
alter table public.betriebe
  add column if not exists liefer jsonb;

comment on column public.betriebe.liefer is
  'Liefereinstellungen des Betriebs, vom Board gepflegt und vom Hub '
  'zur Laufzeit gelesen. Schluessel: an, plz[], mindest, gebuehr, '
  'gratis_ab, dauer_min, bar, karte, zeiten{von,bis,tage[]}.';

alter table public.bestellungen
  add column if not exists liefer_adresse jsonb,
  add column if not exists liefergebuehr  numeric;

comment on column public.bestellungen.liefer_adresse is
  'Wohin geliefert wird: name, strasse, plz, ort, telefon, klingel. '
  'Personenbezogen — gehoert in die Datenschutzerklaerung des Betriebs '
  'und wird nach der Lieferung nicht laenger gebraucht als noetig.';

comment on column public.bestellungen.liefergebuehr is
  'Vom SERVER gerechnet, nie vom Browser uebernommen.';

-- Der Gast darf die Spalten nicht selbst lesen oder schreiben — auf
-- bestellungen hat anon ohnehin nichts (migration-anon-rechte-schliessen).
-- Das Personal liest die Zeile ganzheitlich, deshalb nur die Ergaenzung:
grant select (liefer_adresse, liefergebuehr) on public.bestellungen to authenticated;


-- ── 2 · Die Hülle ────────────────────────────────────────────────
create or replace function public.bestellung_liefern(
  p_betrieb_id   uuid,
  p_adresse      jsonb,                  -- name, strasse, plz, ort, telefon, klingel
  p_positionen   jsonb,
  p_summe        numeric,
  p_notiz        text    default null,
  p_gast_kennung text    default null,
  p_geraet       text    default null
) returns jsonb
language plpgsql
security definer
-- Eng gehalten. Es wird nichts aus „extensions" gebraucht (§2.2).
set search_path to 'public'
as $$
declare
  v_liefer    jsonb;
  v_plz       text;
  v_mindest   numeric;
  v_gebuehr   numeric;
  v_gratis    numeric;
  v_id        uuid;
  v_ware      numeric;
  v_endgueltig numeric;
begin
  -- ── Was der Betrieb eingestellt hat ──────────────────────────
  select liefer into v_liefer from betriebe where id = p_betrieb_id;

  if v_liefer is null or coalesce((v_liefer->>'an')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'grund', 'aus');
  end if;

  -- ── Die Adresse muss vollstaendig sein ───────────────────────
  -- Geprueft wird hier, nicht nur im Browser: Der Fahrer steht sonst
  -- vor einem Haus ohne Nummer.
  if p_adresse is null
     or coalesce(trim(p_adresse->>'name'), '')    = ''
     or coalesce(trim(p_adresse->>'strasse'), '') = ''
     or coalesce(trim(p_adresse->>'plz'), '')     = ''
     or coalesce(trim(p_adresse->>'ort'), '')     = ''
     or coalesce(trim(p_adresse->>'telefon'), '') = ''
  then
    return jsonb_build_object('ok', false, 'grund', 'adresse');
  end if;

  -- ── Liegt die Adresse im Liefergebiet? ───────────────────────
  v_plz := trim(p_adresse->>'plz');
  if jsonb_typeof(v_liefer->'plz') <> 'array'
     or jsonb_array_length(v_liefer->'plz') = 0
     or not exists (
       select 1 from jsonb_array_elements_text(v_liefer->'plz') p
        where trim(p) = v_plz)
  then
    return jsonb_build_object('ok', false, 'grund', 'plz', 'plz', v_plz);
  end if;

  -- ── Liefert das Haus GERADE JETZT? ──────────────────────────
  -- „zeitlich begrenzter Lieferservice" heisst: Es gibt Stunden, in
  -- denen niemand faehrt. Das prueft der Server, nicht der Browser —
  -- sonst waere das Zeitfenster Zierrat, das eine verstellte
  -- Telefonuhr aushebelt.
  --
  -- Kein Fenster hinterlegt = keine Einschraenkung. Ein Haus, das
  -- nichts eingestellt hat, soll liefern koennen, nicht nie (§7).
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
      v_tag := extract(isodow from v_jetzt)::int;   -- 1 = Montag … 7 = Sonntag

      -- Wochentag: leere oder fehlende Liste heisst „jeden Tag".
      if jsonb_typeof(v_tage) = 'array' and jsonb_array_length(v_tage) > 0
         and not exists (select 1 from jsonb_array_elements_text(v_tage) d
                          where d::int = v_tag)
      then
        return jsonb_build_object('ok', false, 'grund', 'zeit');
      end if;

      if v_von is not null and v_bis is not null then
        -- Ein Fenster darf ueber Mitternacht gehen: 18:00–01:00 ist
        -- fuer einen Truck auf dem Festival der Normalfall, nicht die
        -- Ausnahme. Dann gilt „nach von ODER vor bis".
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

  -- ── Mindestbestellwert: Hausregel, siehe Kopf dieser Datei ───
  v_mindest := coalesce((v_liefer->>'mindest')::numeric, 0);
  if v_mindest > 0 and coalesce(p_summe, 0) < v_mindest then
    return jsonb_build_object('ok', false, 'grund', 'mindest',
                              'mindest', v_mindest);
  end if;

  -- ── Die Bestellung selbst legt die vorhandene Funktion an ────
  -- Benannte Aufrufform, damit eine spaetere Umstellung der
  -- Parameterreihenfolge hier nichts kaputt macht.
  v_id := bestellung_aufgeben(
            p_betrieb_id   => p_betrieb_id,
            p_quelle       => 'lieferung',
            p_tisch        => null,
            p_summe        => p_summe,
            p_notiz        => p_notiz,
            p_positionen   => p_positionen,
            p_gast_kennung => p_gast_kennung,
            p_geraet       => p_geraet);

  if v_id is null then
    return jsonb_build_object('ok', false, 'grund', 'abgewiesen');
  end if;

  -- ── Jetzt das Geld, und zwar aus der Zeile, nicht aus dem Browser ──
  -- bestellung_aufgeben hat die Warensumme aus der Karte nachgerechnet.
  -- DIESE Zahl ist die Grundlage der Gebuehr, nicht p_summe.
  select summe into v_ware from bestellungen where id = v_id;
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
    'gebuehr',  v_gebuehr,
    'summe',    v_endgueltig,
    'dauer',    coalesce((v_liefer->>'dauer_min')::int, null));
end $$;

revoke all on function public.bestellung_liefern(uuid, jsonb, jsonb, numeric, text, text, text) from public;
grant execute on function public.bestellung_liefern(uuid, jsonb, jsonb, numeric, text, text, text) to anon, authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════
--  SCHRITT 0 · VOR dem Einspielen fahren
-- ═══════════════════════════════════════════════════════════════════
--
--  Es kommt ein NEUER Wert in bestellungen.quelle: 'lieferung'.
--  Bisher gibt es dort 'tisch', 'service' und 'telefon'. Ob eine
--  CHECK-Bedingung diese Liste festnagelt, steht NIRGENDS in diesem
--  Verzeichnis — es gibt kein „create table bestellungen". Derselben
--  Frage stand schon die Telefon-Migration gegenueber
--  (migration-telefonbestellung.sql:19-23), und sie hat sie richtig
--  geloest: erst nachsehen, dann einspielen.
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.bestellungen'::regclass
--     and contype = 'c';
--
--   → Kommt KEINE Zeile mit „quelle" darin: alles gut, weitermachen.
--   → Steht dort etwas wie  check (quelle = any (array['tisch','service','telefon']))
--     dann MUSS 'lieferung' zuerst dazu. Schick mir die Zeile, dann
--     schreibe ich das passende alter table dazu — blind eine
--     Bedingung neu zu bauen, die man nicht gelesen hat, waere genau
--     der Fehler, den diese Datei sonst vermeidet.
--
--
-- ═══════════════════════════════════════════════════════════════════
--  DANACH PRÜFEN
-- ═══════════════════════════════════════════════════════════════════
--
-- ── 1 · Genau EINE Fassung? (§2.1) ───────────────────────────────
--
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'bestellung_liefern';
--
--   → genau EINE Zeile.
--
--
-- ── 2 · Läuft sie wirklich? (§2.2) ───────────────────────────────
--
--   Der Block legt eine echte Bestellung an und dreht alles zurueck.
--   Wie bei der Storno-Migration gilt: Die Meldung ans Board kann
--   trotzdem hinausgehen — am besten ausserhalb der Betriebszeit.
--
--   ACHTUNG, EIN FALL, DEN NUR DIESE PROBE ZEIGEN KANN: Wenn beim
--   Betrieb „tisch_pflicht" eingeschaltet ist, koennte
--   bestellung_aufgeben eine Bestellung OHNE Tisch abweisen. Ob sie
--   das tut, weiss ich nicht — ihr Koerper ist von hier nicht lesbar.
--   Probe 3 unten beantwortet es. Faellt sie durch, sag Bescheid;
--   dann muss der Liefermodus die Tischpflicht ausnehmen.
--
-- begin;
-- create temp table probe(nr int, was text, ergebnis text);
-- do $$
-- declare
--   v_betrieb uuid; v_alt jsonb; r jsonb; v_id uuid;
--   v_adr jsonb := jsonb_build_object(
--     'name','Probe Gast','strasse','Musterweg 1','plz','99999',
--     'ort','Probestadt','telefon','0000 000');
-- begin
--   select id, liefer into v_betrieb, v_alt from betriebe order by id limit 1;
--   if v_betrieb is null then
--     insert into probe values (0,'Vorbedingung','KEIN BETRIEB — Probe nicht moeglich');
--     return;
--   end if;
--
--   update betriebe set liefer = jsonb_build_object(
--     'an', true, 'plz', jsonb_build_array('99999'),
--     'mindest', 10, 'gebuehr', 2.50, 'gratis_ab', 30,
--     'dauer_min', 45, 'bar', true, 'karte', true)
--   where id = v_betrieb;
--
--   -- 1 · fremde PLZ
--   r := bestellung_liefern(v_betrieb, v_adr || jsonb_build_object('plz','11111'),
--                           '[]'::jsonb, 20);
--   insert into probe values (1,'fremde PLZ',
--     case when r->>'grund' = 'plz' then 'ok, abgewiesen' else 'KAPUTT: '||r::text end);
--
--   -- 2 · unter dem Mindestwert
--   r := bestellung_liefern(v_betrieb, v_adr, '[]'::jsonb, 5);
--   insert into probe values (2,'unter Mindestwert',
--     case when r->>'grund' = 'mindest' then 'ok, abgewiesen' else 'KAPUTT: '||r::text end);
--
--   -- 3 · der ehrliche Weg — zeigt zugleich, ob Tischpflicht dazwischenfunkt
--   r := bestellung_liefern(v_betrieb, v_adr, '[]'::jsonb, 20);
--   insert into probe values (3,'Lieferbestellung geht durch',
--     case when r->>'ok' = 'true' then 'ok' else 'KAPUTT: '||r::text end);
--
--   if r->>'ok' = 'true' then
--     v_id := (r->>'id')::uuid;
--     insert into probe values (4,'Gebuehr vom Server gerechnet',
--       (select case when liefergebuehr = 2.50 then 'ok, 2.50'
--                    else 'KAPUTT: '||coalesce(liefergebuehr::text,'NULL') end
--          from bestellungen where id = v_id));
--     insert into probe values (5,'Adresse steht in der Zeile',
--       (select case when liefer_adresse->>'plz' = '99999' then 'ok'
--                    else 'KAPUTT: '||coalesce(liefer_adresse::text,'NULL') end
--          from bestellungen where id = v_id));
--     insert into probe values (6,'quelle ist lieferung',
--       (select case when quelle = 'lieferung' then 'ok'
--                    else 'KAPUTT: '||coalesce(quelle,'NULL') end
--          from bestellungen where id = v_id));
--   end if;
--
--   -- 7 · Gratis-ab-Schwelle: Der Browser darf die Gebuehr nicht bestimmen
--   r := bestellung_liefern(v_betrieb, v_adr, '[]'::jsonb, 50);
--   if r->>'ok' = 'true' then
--     insert into probe values (7,'ab 30 EUR keine Gebuehr',
--       (select case when liefergebuehr = 0 then 'ok, 0'
--                    else 'KAPUTT: '||coalesce(liefergebuehr::text,'NULL') end
--          from bestellungen where id = (r->>'id')::uuid));
--   else
--     insert into probe values (7,'ab 30 EUR keine Gebuehr','uebersprungen: '||r::text);
--   end if;
--
--   -- 8 · Liefermodus aus
--   update betriebe set liefer = jsonb_build_object('an', false) where id = v_betrieb;
--   r := bestellung_liefern(v_betrieb, v_adr, '[]'::jsonb, 20);
--   insert into probe values (8,'Liefermodus aus',
--     case when r->>'grund' = 'aus' then 'ok, abgewiesen' else 'KAPUTT: '||r::text end);
--
--   -- ── Das Zeitfenster ──────────────────────────────────────────
--   -- Gerechnet gegen die JETZIGE Uhrzeit in Europe/Berlin, damit die
--   -- Probe zu jeder Tageszeit dasselbe beweist.
--   declare
--     v_jetzt timestamp := now() at time zone 'Europe/Berlin';
--     v_tag   int := extract(isodow from v_jetzt)::int;
--     v_basis jsonb := jsonb_build_object('an',true,'plz',jsonb_build_array('99999'),
--               'mindest',0,'gebuehr',2.50,'gratis_ab',0,'dauer_min',45);
--   begin
--     -- 9 · Fenster offen (eine Stunde davor bis eine Stunde danach)
--     update betriebe set liefer = v_basis || jsonb_build_object('zeiten',
--       jsonb_build_object('von', to_char(v_jetzt - interval '1 hour','HH24:MI'),
--                          'bis', to_char(v_jetzt + interval '1 hour','HH24:MI')))
--      where id = v_betrieb;
--     r := bestellung_liefern(v_betrieb, v_adr, '[]'::jsonb, 20);
--     insert into probe values (9,'Fenster offen',
--       case when r->>'ok' = 'true' then 'ok' else 'KAPUTT: '||r::text end);
--
--     -- 10 · Fenster zu (zwei bis drei Stunden spaeter)
--     update betriebe set liefer = v_basis || jsonb_build_object('zeiten',
--       jsonb_build_object('von', to_char(v_jetzt + interval '2 hour','HH24:MI'),
--                          'bis', to_char(v_jetzt + interval '3 hour','HH24:MI')))
--      where id = v_betrieb;
--     r := bestellung_liefern(v_betrieb, v_adr, '[]'::jsonb, 20);
--     insert into probe values (10,'Fenster zu',
--       case when r->>'grund' = 'zeit' then 'ok, abgewiesen' else 'KAPUTT: '||r::text end);
--
--     -- 11 · Falscher Wochentag
--     update betriebe set liefer = v_basis || jsonb_build_object('zeiten',
--       jsonb_build_object('von','00:00','bis','23:59',
--                          'tage', jsonb_build_array(((v_tag % 7) + 1))))
--      where id = v_betrieb;
--     r := bestellung_liefern(v_betrieb, v_adr, '[]'::jsonb, 20);
--     insert into probe values (11,'falscher Wochentag',
--       case when r->>'grund' = 'zeit' then 'ok, abgewiesen' else 'KAPUTT: '||r::text end);
--
--     -- 12 · Fenster ueber Mitternacht, jetzt DRIN (von > bis)
--     update betriebe set liefer = v_basis || jsonb_build_object('zeiten',
--       jsonb_build_object('von', to_char(v_jetzt - interval '1 hour','HH24:MI'),
--                          'bis', to_char(v_jetzt - interval '2 hour','HH24:MI')))
--      where id = v_betrieb;
--     r := bestellung_liefern(v_betrieb, v_adr, '[]'::jsonb, 20);
--     insert into probe values (12,'Fenster ueber Mitternacht',
--       case when r->>'ok' = 'true' then 'ok' else 'KAPUTT: '||r::text end);
--   end;
--
-- exception when others then
--   insert into probe values (99,'ABBRUCH', sqlerrm);
-- end $$;
-- select * from probe order by nr;
-- rollback;
--
--   → Jede Zeile muss mit „ok" beginnen. „KAPUTT" oder „ABBRUCH":
--     nichts scharf schalten, sondern die Zeile melden.
