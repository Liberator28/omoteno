-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET 07.10. (Supabase-MCP, Project Blend Hub) · Karten frei
--
--  Wunsch (07.10.): bis zu 20 Karten (Mittagskarte, Abendkarte …)
--  benennen, speichern, jederzeit bearbeiten und einer Kachel zuweisen;
--  ein Gericht darf in MEHREREN Karten stehen; Kategorien sollen sich
--  anlegen lassen, ohne dass schon ein Gericht darin steht.
--
--  BEFUND vorher (live nachgesehen, §2.3c):
--   - gerichte.karte ist text mit Vorgabe 'speisekarte' und trägt KEINE
--     CHECK-Schranke — neue Werte brechen nichts.
--   - bestellung_aufgeben und bestellung_liefern lesen karte nicht
--     (pg_get_functiondef durchsucht) — die Bestellwege bleiben unberührt.
--   - anon liest gerichte tabellenweit, authenticated schreibt
--     tabellenweit: neue Spalten an gerichte brauchen kein eigenes GRANT.
--   - betriebe ist spaltenweise freigegeben (migration-betriebe-
--     leserecht.sql): die neue Spalte bekommt ihr Lese- und Schreibrecht
--     ausdrücklich.
--
--  Additiv (§2.5): betriebe.karten ist null → es gelten die drei
--  bisherigen Karten. gerichte.karten wird aus karte gefüllt; karte
--  bleibt stehen (Küche und Auswertung lesen sie) und ist immer die
--  erste Karte der Liste.
--
--  Die Form der Einträge in betriebe.karten prüft die Schranke nur grob
--  (Liste, ≤ 20, Größe). Eine Prüfung je Eintrag bräuchte eine Funktion
--  in der Schranke — und die läuft mit den Rechten dessen, der ändert
--  (§2.7). Die Einträge laufen deshalb in Hub und Board durch eine
--  Positivliste (id-Muster, Name gekürzt), wie hub_kacheln auch.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.betriebe add column if not exists karten jsonb;

alter table public.betriebe drop constraint if exists betriebe_karten_form;
alter table public.betriebe add constraint betriebe_karten_form check (
  karten is null or (
    jsonb_typeof(karten) = 'array'
    and jsonb_array_length(karten) <= 20
    and pg_column_size(karten) < 24000));

comment on column public.betriebe.karten is
  'Karten des Betriebs: [{id, name, unter, kategorien:[{name, zeichen}]}], '
  'höchstens 20. null = die drei Grundkarten speisekarte/getraenke/cocktails. '
  'kategorien dürfen leer sein (Kategorie ohne Gericht).';

grant select (karten) on public.betriebe to anon, authenticated;
grant update (karten) on public.betriebe to authenticated;

alter table public.gerichte add column if not exists karten text[];

alter table public.gerichte drop constraint if exists gerichte_karten_form;
alter table public.gerichte add constraint gerichte_karten_form check (
  karten is null or (
    cardinality(karten) between 1 and 20
    and array_to_string(karten, ',') ~ '^[a-z0-9-]{1,24}(,[a-z0-9-]{1,24})*$'));

comment on column public.gerichte.karten is
  'Alle Karten, in denen das Gericht steht. karte bleibt die erste davon '
  '(Küche, Auswertung). null = nur karte.';

update public.gerichte set karten = array[coalesce(nullif(karte, ''), 'speisekarte')]
 where karten is null;

commit;

-- ── DANACH PRÜFEN (live gelaufen, siehe Bericht) ─────────────────
--   select count(*) filter (where karten is null) ohne,
--          count(*) filter (where karten[1] <> coalesce(karte,'speisekarte')) abweichend
--   from public.gerichte;                         → 0 / 0
--   select has_column_privilege('anon','public.betriebe','karten','SELECT'),
--          has_column_privilege('anon','public.betriebe','karten','UPDATE');  → true / false
--   update gerichte set karten = array['Mittag!'] …  → verletzt gerichte_karten_form
