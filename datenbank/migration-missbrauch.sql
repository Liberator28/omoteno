-- ═══════════════════════════════════════════════════════════════════
--  MISSBRAUCH · Was jeder mit der Webadresse tun kann, und die Bremsen
--
--  Auftrag (26.09.): „Jeder, der die Webadresse hat, kann bestellen und
--  womöglich die Küche mit nicht existenten Bestellungen bombardieren.
--  Alle Sicherheitslücken und Möglichkeiten, das System auszunutzen,
--  decken und lösen."
--
--  Grundsatz (CLAUDE.md §7): Ein echter Gast, der nicht bestellen kann,
--  kostet mehr als ein Teller zu viel. Deshalb, wo ein Gast betroffen
--  sein könnte: durchlassen und MARKIEREN (die Küche zeigt es erst nach
--  Freigabe im Board). Hart abgewiesen wird nur, was kein Gast je tut.
--
--  Teile, jeder einzeln angewendet und geprüft:
--    1 · push_gemeldet — „melden“ meldet jede Bestellung genau einmal
--    2 · (folgt) Bestellungen: Karte, Mengen, Preis vom Server, Bremse
--    3 · (folgt) übrige offene Wege
--
--  ANGEWENDET: Teil 1 am 26.09.2026
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · push_gemeldet ─────────────────────────────────────────────
-- Die Edge Function „melden“ (ausgerollt als swift-processor) nahm den
-- Text der Push-Meldung ungeprüft aus der Anfrage: Jeder konnte jedem
-- Betrieb beliebigen Text auf die Sperrbildschirme schicken. Jetzt liest
-- sie nur die id, holt die Zeile selbst und meldet jede Bestellung genau
-- einmal — dieser Eintrag ist das „einmal“. Nur die Funktion (Service-
-- Rolle) schreibt; anon und authenticated haben kein Recht.
create table if not exists public.push_gemeldet (
  bestellung_id uuid primary key references public.bestellungen(id) on delete cascade,
  am            timestamptz not null default now()
);
alter table public.push_gemeldet enable row level security;
revoke all on public.push_gemeldet from anon, authenticated;
comment on table public.push_gemeldet is
  'Welche Bestellung die Push-Funktion schon gemeldet hat (genau einmal). Nur Service-Rolle.';
