-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET (quxwweuvdqtjsdwgjdrh) · gutscheine: Maße als Schranke
--
--  ANLASS. Das Admin-Board bekommt eine Gutschein-Verwaltung. Bisher
--  konnte nur, wer in der Datenbank stand, Gutscheine anlegen — und
--  die Tabelle kannte keine einzige Längengrenze. Die Oberfläche
--  begrenzt jetzt Titel, Text und Code; dieselben Grenzen stehen
--  hier als CHECK, denn eine Oberfläche kann einen Fehler haben, die
--  Schranke dahinter nicht (dasselbe Muster wie bei den freien Texten,
--  siehe TEXTMASS in admin.html).
--
--  NACHGESEHEN, nicht angenommen (CLAUDE.md §1.2, §2.3a):
--    · Rechte: authenticated hat insert/update/delete, anon nichts.
--    · RLS "gutscheine team pflegt" (ALL): betrieb_id in
--      meine_betriebe() oder ist_master(). Live geprobt als echtes
--      Mitglied: eigenes Haus 1 Zeile, fremdes Haus abgelehnt.
--    · UNIQUE (betrieb_id, code) liegt schon — derselbe Code darf je
--      Haus nur einmal vorkommen, auch nach dem Beenden. Das Board
--      meldet 23505 deshalb in Klartext.
--    · 0 Zeilen in der Tabelle: die Schranke trifft nichts Bestehendes.
--
--  Code: nur Großbuchstaben, Ziffern, Bindestrich, 3–24 Zeichen. Er
--  wird am Tisch laut vorgelesen — „0" oder „O", „ä" oder „ae" wären
--  dort eine Frage mehr. Das Board schreibt den Code beim Tippen groß.
--
--  Additiv (CLAUDE.md §2.5): legt nur an, ändert nichts Bestehendes.
-- ═══════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gutscheine_masse') then
    alter table public.gutscheine
      add constraint gutscheine_masse check (
        char_length(titel) between 1 and 60
        and char_length(beschreibung) <= 160
        and code ~ '^[A-Z0-9-]{3,24}$'
      );
  end if;
end $$;

commit;

-- ── PROBE (lief vor dem Anwenden in einer zurückgedrehten Transaktion)
--   gültiger Gutschein            → 1 Zeile
--   derselbe Code nochmal         → unique_violation (23505)
--   Code in Kleinbuchstaben       → check_violation
--   Titel mit 61 Zeichen          → check_violation
--   leerer Titel                  → check_violation
--   als Mitglied, eigenes Haus    → anlegen 1, beenden 1, lesen 1
--   als Mitglied, fremdes Haus    → insufficient_privilege (RLS)
-- ═══════════════════════════════════════════════════════════════════
