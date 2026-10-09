-- ═══════════════════════════════════════════════════════════════════
-- STAND · Schranken der Tabelle aktionen (gelesen, nicht geändert)
--
-- Zweite Quelle für pruefungen/pruef-rabatt-gericht.js: Was das
-- Gericht-Blatt („Rabatt starten“) in aktionen schreibt, muss jede
-- dieser Schranken halten. Die Tabelle ist älter als die Dateien hier
-- (es gibt kein create table aktionen) — die Liste lebt nur im Katalog
-- (CLAUDE.md §2.3c). Gelesen am 07.10. mit:
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.aktionen'::regclass and contype = 'c';
--
-- Kommt eine Schranke dazu, gehört sie hier hinein — die Prüfung zählt
-- nach und wird rot, wenn eine nicht geprüft ist.
-- ═══════════════════════════════════════════════════════════════════
aktionen_preis               CHECK ((preis_neu < preis_alt))
aktionen_preis_alt_check     CHECK ((preis_alt > (0)::numeric))
aktionen_preis_neu_check     CHECK ((preis_neu >= (0)::numeric))
aktionen_titel_mass          CHECK (((length(btrim(titel)) >= 1) AND (length(btrim(titel)) <= 40)))
aktionen_zeit                CHECK ((bis > von))
