-- ═══════════════════════════════════════════════════════════════════
-- migration-abholbereit.sql — „Abholbereit“: Küche meldet, Service bringt
--
-- Wunsch 10.10.: „Der Koch kann auch direkt sagen sobald ein Gericht
-- fertig ist und abgeholt werden kann vom Service, dann bekommt der
-- Service mit einem speziellen Benachrichtigungston Bescheid.“
--
-- Bestand (gelesen): Die Küche schreibt längst kueche_fertig_um bzw.
-- theke_fertig_um je Spur (kueche.html, ausfuehren("fertig")). Das IST
-- „abholbereit“ — es fehlte nur, wann der Service es gebracht hat.
-- Ohne diese Angabe gäbe es keine Liste „Zum Abholen“, die sich leert.
--
-- Additiv (§2.5): eine Spalte, nichts liest sie, bis das Board sie
-- benutzt. Rechte: authenticated hat UPDATE auf Tabellenebene, die
-- Regel „bestellung team aendert“ entscheidet über die Zeilen — genau
-- wie bei status. anon hat kein UPDATE auf bestellungen (gemessen).
--
-- Regel im Board: Eine Bestellung steht unter „Zum Abholen“, solange
-- eine Spur fertig ist und gebracht_um fehlt oder ÄLTER ist als die
-- jüngste fertige Spur (Getränke schon gebracht, Essen kommt später →
-- erscheint wieder).
--
-- ANGEWENDET 10.10. (apply_migration abholbereit). Zurückgedrehte Probe
-- mit Probezeile in blend, Rolle über request.jwt.claims (§2.4),
-- Zeilenzahl statt Ausnahme (§2.3b):
--   Mitglied von blend: gebracht_um → 1 Zeile, status → 1 Zeile (gleich)
--   Mitglied eines anderen Betriebs: gebracht_um → 0 Zeilen
--   anon: kein UPDATE-Recht auf die Spalte
-- Messfalle dabei: ein „update betriebe set …“ OHNE where in der Probe
-- hing 60 s — das Werkzeug hält es für destruktiv (§2.8). Nicht nötig
-- gewesen: pin_pflicht stand ohnehin überall auf false.
-- ═══════════════════════════════════════════════════════════════════

alter table public.bestellungen add column if not exists gebracht_um timestamptz;

comment on column public.bestellungen.gebracht_um is
  'Wann der Service zuletzt abgeholt und an den Tisch gebracht hat (Board: „Gebracht“). Steht unter „Zum Abholen“, solange eine fertige Spur jünger ist.';
