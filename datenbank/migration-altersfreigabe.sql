-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET 07.10. (Supabase-MCP, Project Blend Hub) · Altersfreigabe
--
--  Wunsch (07.10.): Gerichte mit Alkohol sollen eine Altersbeschränkung
--  tragen können, die beim Gast gekennzeichnet wird.
--
--  BEFUND vorher (live nachgesehen, §2.3c):
--   - gerichte hat keine Spalte für ein Mindestalter.
--   - anon liest gerichte tabellenweit, authenticated schreibt
--     tabellenweit: die neue Spalte braucht kein eigenes GRANT.
--   - Die Schranke ist eine reine Wertliste ohne Funktion — §2.7 (eine
--     Funktion in einer Schranke braucht EXECUTE für jeden Schreiber)
--     greift hier nicht.
--
--  Nur 16 und 18: das sind die Grenzen des Jugendschutzgesetzes für
--  Bier/Wein/Sekt (16) und Spirituosen (18). Ein freies Zahlenfeld
--  lüde zu „21+“ ein, das in Deutschland nichts bedeutet.
--
--  Additiv (§2.5): null heißt „keine Beschränkung“ — kein Gericht
--  ändert sich, bis der Betrieb es selbst setzt.
--
--  Ehrliche Grenze: Eine Bestätigung im Browser ist kein
--  Altersnachweis. Der Hub sagt dem Gast, dass das Personal den Ausweis
--  prüft; die Küche sieht die Marke am Bon.
-- ═══════════════════════════════════════════════════════════════════
alter table public.gerichte add column if not exists ab_alter smallint;

alter table public.gerichte drop constraint if exists gerichte_ab_alter_form;
alter table public.gerichte add constraint gerichte_ab_alter_form
  check (ab_alter is null or ab_alter in (16, 18));

comment on column public.gerichte.ab_alter is
  'Mindestalter für dieses Gericht (16 oder 18, null = keins). Hub kennzeichnet und fragt einmal je Sitzung nach; Küche zeigt „Ausweis“ am Bon. Kein Altersnachweis.';
