-- ═══════════════════════════════════════════════════════════════════
--  migration-laufschrift.sql · hub_texte.laufschrift (Top-Runner-Band)
--
--  Wunsch (09.10.): Der Top-Runner wird eine Flash-Sale-Anzeige mit
--  einer Laufschrift, „deren Text man auch eingeben kann“. Der Text
--  liegt bei den übrigen Worten des Hauses in betriebe.hub_texte
--  (claim, gruss, runner_titel) — der Hub liest sie live, die
--  Live-Vorschau im Board bekommt sie mit, keine neue Spalte.
--
--  hub_texte_masse kennt nur die vier alten Schlüssel; ein neuer wäre
--  ungedeckelt. Diese Schranke kommt DAZU (additiv, nichts wird
--  gelöscht — §2.8: keine Zeile beginnt mit drop). 80 Zeichen = „hart“
--  im Board (TEXTMASS.hubLaufschrift) = kurz(…, 80) im Hub.
--
--  Vorher gemessen: Keine Zeile trägt heute einen Schlüssel
--  „laufschrift“, die Schranke kann also nicht an Bestandsdaten
--  scheitern (select count(*) … where hub_texte ? 'laufschrift' → 0).
-- ═══════════════════════════════════════════════════════════════════
alter table public.betriebe add constraint hub_texte_laufschrift check (
  coalesce(length(hub_texte ->> 'laufschrift'), 0) <= 80
);

-- ANGEWENDET 09.10. (live). Vorher gemessen: 0 Zeilen mit dem Schlüssel,
-- einzige Schranke bisher hub_texte_masse.
-- ── PROBE (zurückgedreht, §2.2 / §2.7: andere Spalte derselben Zeile),
--    Choco, Zeilenzahl statt Ausnahme (§2.3b) ──
--   hub_texte mit laufschrift 80 Zeichen   → 1 Zeile
--   hub_texte mit laufschrift 81 Zeichen   → abgewiesen (check_violation)
--   name ändern (andere Spalte)            → 1 Zeile
