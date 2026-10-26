-- ═══════════════════════════════════════════════════════════════════
--  MIGRATION · Kennzeichnung „KI-bearbeitet“ am Gerichtfoto
--  ENTWURF 26.10. — NOCH NICHT EINGESPIELT (Supabase war nicht erreichbar)
--
--  Rechtsbericht R8 (dokumente/recht/14-…): Das Profi-Foto setzt ein Gericht
--  in ein Studiofoto (fal.ai / Bria). Zeigt ein Bild mehr, als auf dem Teller
--  landet, ist das irreführend (Art. 7 LMIV, § 5 UWG). Der Hub zeichnet deshalb
--  im Detailblatt die Marke „KI-bearbeitet“, sobald diese Spalte true ist.
--
--  gerichte.bild_ki   boolean, Vorgabe false.
--       Das Board setzt true, wenn ein Profi-Foto oder Freisteller übernommen
--       wird (admin.html: #fBildKi), und false bei einem neu hochgeladenen Foto.
--
--  REIHENFOLGE (§2.5, additiv): Die Spalte darf vor dem Code laufen — solange
--  niemand sie liest, ist das Risiko null. Hub (liest `select=*`) und Board
--  (schickt bild_ki nur, wenn die Spalte in den gelesenen Zeilen vorkommt)
--  laufen ohne diese Migration unverändert weiter: keine Marke, kein Fehler.
--
--  RECHTE: gerichte hat für die Rolle authenticated bereits die Rechte und
--  RLS-Regeln des Betriebs; eine neue Spalte erbt sie. Gäste (anon) lesen
--  `gerichte` wie bisher; die Spalte verrät nichts, was das Foto nicht ohnehin zeigt.
-- ═══════════════════════════════════════════════════════════════════

alter table public.gerichte
  add column if not exists bild_ki boolean not null default false;

comment on column public.gerichte.bild_ki is
  'true, wenn das Foto oder der Freisteller mit KI bearbeitet wurde (Profi-Foto). Der Hub zeigt dann die Marke „KI-bearbeitet“.';

-- ── Probe (zurückgedreht): Spalte da, Vorgabe false, schreibbar ──────
-- begin;
--   select column_name, data_type, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'gerichte' and column_name = 'bild_ki';
--   -- erwartet: bild_ki | boolean | false | NO
-- rollback;
