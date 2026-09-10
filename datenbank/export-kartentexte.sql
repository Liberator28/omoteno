-- ═══════════════════════════════════════════════════════════════════
-- EXPORT · Jeder deutsche Text, den ein Gast zu sehen bekommt
--
--   Im Supabase SQL-Editor ausfuehren. Liest NUR, schreibt nichts.
--
-- Warum es diese Datei gibt
-- ─────────────────────────
-- Der Hub uebersetzt ueber ein Woerterbuch, dessen SCHLUESSEL der
-- deutsche Satz ist (t() in hub.vorlage.html). Steht ein Satz nicht
-- darin, bleibt er deutsch — genau das sieht der Gast heute in der
-- tuerkischen und der arabischen Karte.
--
-- Um das zu beheben, muss man wissen, welche deutschen Saetze
-- ueberhaupt in der Datenbank stehen. Von aussen ist das nicht zu
-- sehen. Diese Abfrage holt sie alle.
--
-- Robust gegen fehlende Spalten: Gelesen wird ueber to_jsonb(zeile),
-- also ueber ->> statt ueber den Spaltennamen direkt. Eine Spalte,
-- die es in diesem Projekt nicht gibt, liefert dann NULL, statt die
-- ganze Abfrage mit einem Fehler abzubrechen.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1 · Kurzer Ueberblick. Erst hier hinsehen: Stimmen die Zahlen nicht,
--     stimmt auch der grosse Export darunter nicht.
-- ───────────────────────────────────────────────────────────────────
with betrieb as (
  select b.id, b.slug, to_jsonb(b) as j
  from betriebe b
  -- ▸ HIER den Betrieb eintragen. Mehrere Haeuser: slug in ('a','b')
  where b.slug = 'chocolamour'
)
select
  (select slug from betrieb)                                       as betrieb,
  (select count(*) from gerichte g
    where g.betrieb_id = (select id from betrieb))                 as gerichte_gesamt,
  (select count(*) from gerichte g
    where g.betrieb_id = (select id from betrieb)
      and coalesce(to_jsonb(g)->>'verfuegbar','true') = 'true')    as gerichte_sichtbar,
  (select count(distinct to_jsonb(g)->>'kategorie') from gerichte g
    where g.betrieb_id = (select id from betrieb))                 as kategorien,
  (select count(*) from gerichte g
    where g.betrieb_id = (select id from betrieb)
      and coalesce(to_jsonb(g)->>'beschreibung','') <> '')         as mit_beschreibung,
  (select count(*) from gerichte g
    where g.betrieb_id = (select id from betrieb)
      and to_jsonb(g)->'uebersetzungen' is not null
      and to_jsonb(g)->>'uebersetzungen' <> 'null')                as mit_uebersetzung;

-- ───────────────────────────────────────────────────────────────────
-- 2 · Der eigentliche Export.
--
--     EIN Feld, EINE Zeile. Im Ergebnis auf die Zelle klicken, den
--     ganzen Inhalt kopieren und als Datei ablegen — z. B. als
--     dokumente/kartentexte-chocolamour.json.
--
--     Enthalten ist zu jedem Text seine Herkunft (Tabelle, Spalte,
--     id). Das ist kein Beiwerk: Ohne die id kann niemand spaeter
--     zielgenau zurueckschreiben, und ein UPDATE ueber den Textinhalt
--     traefe zwei Gerichte, die zufaellig gleich heissen.
-- ───────────────────────────────────────────────────────────────────
with betrieb as (
  select b.id, b.slug, to_jsonb(b) as j
  from betriebe b
  where b.slug = 'chocolamour'          -- ▸ derselbe slug wie oben
),
zeile as (
  select g.id, to_jsonb(g) as j
  from gerichte g, betrieb
  where g.betrieb_id = betrieb.id
)
select jsonb_pretty(jsonb_build_object(

  'erzeugt',  now(),
  'betrieb',  (select slug from betrieb),

  /* Die freien Worte des Hauses. Sie stehen in keiner Kartenzeile
     und werden heute nirgends uebersetzt. */
  'haus', (select jsonb_strip_nulls(jsonb_build_object(
             'name',               j->>'name',
             'bestell_pause_text', j->>'bestell_pause_text',
             'hub_texte',          j->'hub_texte',
             'hub_kacheln',        j->'hub_kacheln',
             'hub_woerter',        j->'hub_woerter'
           )) from betrieb),

  /* Jedes Gericht mit allem, was auf den Schirm kann. */
  'gerichte', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'id',             id,
                 'karte',          j->>'karte',
                 'kategorie',      j->>'kategorie',
                 'name',           j->>'name',
                 'beschreibung',   nullif(j->>'beschreibung',''),
                 'stoff_hinweis',  nullif(j->>'stoff_hinweis',''),
                 'opt',            nullif(j->>'opt',''),
                 'verfuegbar',     j->>'verfuegbar',
                 'uebersetzungen', j->'uebersetzungen',
                 'name_uebersetzungen', j->'name_uebersetzungen'
               )) order by j->>'karte', j->>'kategorie', j->>'name')
               from zeile),

  /* Und dieselben Texte noch einmal flach und ohne Doppelte — das
     ist die Liste, die uebersetzt wird. Ein Satz, der bei acht
     Gerichten steht, wird sonst achtmal uebersetzt und beim neunten
     anders. */
  'texte_einmalig', (select jsonb_agg(jsonb_build_object(
                       'text',   t,
                       'wo',     wo,
                       'anzahl', n) order by wo, t)
    from (
      select txt as t, herkunft as wo, count(*) as n
      from (
        select j->>'kategorie'     as txt, 'kategorie'    as herkunft from zeile
        union all
        select j->>'name'          as txt, 'name'         as herkunft from zeile
        union all
        select j->>'beschreibung'  as txt, 'beschreibung' as herkunft from zeile
        union all
        select j->>'stoff_hinweis' as txt, 'hinweis'      as herkunft from zeile
      ) alles
      where txt is not null and btrim(txt) <> ''
      group by txt, herkunft
    ) gezaehlt)

)) as export;

-- ───────────────────────────────────────────────────────────────────
-- 3 · Was diese Abfrage NICHT sieht — und warum das hier steht
--
--     Eine Grenze, die man nennt, ist keine Luecke; eine, die man
--     verschweigt, schon.
--
--     • Die Zusatz-Gruppen ("Favorite Sauce on top", "Bounty",
--       "Marshmallow") stehen NICHT in der Datenbank, sondern fest
--       im Hub-Geruest (OPTIONEN, hub.vorlage.html ab Zeile 2959).
--       Zeigt der ausgelieferte Hub dort einen anderen Text als das
--       Verzeichnis, laeuft live eine aeltere Fassung — dann ist
--       nicht die Datenbank das Problem, sondern die Auslieferung.
--     • Das Markenblatt (Slogan, Gruss, Kachelunterzeilen) liegt im
--       Verzeichnis, nicht in der Datenbank — ausser der Wirt hat es
--       im Board ueberschrieben; dann steht es oben unter 'haus'.
--     • Bestellungen, Gaeste und alles Personenbezogene wird hier
--       bewusst NICHT ausgelesen. Es gehoert nicht zur Karte.
-- ───────────────────────────────────────────────────────────────────
