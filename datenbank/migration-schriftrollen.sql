-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET 17.10. (apply_migration hub_stil_2500, als EINE
--  alter-Anweisung statt drop+add in zwei Zeilen, §2.8). Vorher live
--  gemessen: Schranke stand noch auf < 1000 Bytes — diese Datei war nie
--  eingespielt. Zurückgedrehte Probe: Choco + karte/lade 671 Bytes geht,
--  ~1700 Bytes geht (unter der alten Grenze abgelehnt), 3000 Bytes
--  check_violation, emoji als Text check_violation. Danach nachgelesen.
-- ═══════════════════════════════════════════════════════════════════
--  betriebe.hub_stil.schrift — vier neue Rollen statt einer geteilten
--
--  VORFALL: Alle Überschriften-artigen Texte im Hub (Begrüßung, Titel,
--  Tischquiz-Runde, Gerichtname, Kachel-Beschriftung, …) hingen an
--  EINER CSS-Variable (--schrift-kopf). Wer im Board die Begrüßung
--  umstellte, sah dieselbe Änderung ungewollt an der Quiz-Runde. Vier
--  neue, unabhängige Rollen lösen das ab: titel, abschnitt, gericht,
--  kachel — zusätzlich zu den bestehenden kopf/text. Jede kann eine
--  Auswahlschrift ("titel":"playfair") ODER eine eigene Datei tragen
--  ("titel":"eigen","titel_datei":"https://…").
--
--  Rein additiv: keine neue Spalte, keine neue Tabelle. Fehlt eine der
--  vier neuen Rollen im gespeicherten JSON (jeder Kunde von vor diesem
--  Umbau), erbt sie im Hub von "kopf" — CLAUDE.md §2.5, kein Kunde
--  sieht ohne eigenes Zutun eine Änderung.
--
--  Einzige nötige Änderung an der Datenbank: betriebe_hub_stil_form
--  deckelte hub_stil bisher auf 1000 Bytes (aus der Zeit vor
--  Schriftrollen, migration-hub-stil.sql). Mit sechs statt zwei
--  Rollen kann ein Betrieb, der für mehrere Rollen je eine eigene
--  Schriftdatei hochlädt (lange Supabase-Storage-Adressen, je
--  ~170 Bytes), diese Grenze real erreichen — die Auswahl aus der
--  festen Liste (kurze Schlüssel wie "playfair") bleibt weit
--  darunter. Die Schranke wird deshalb angehoben, nicht entfernt:
--  hub_stil ist eine Einstellungs-Spalte eines angemeldeten Teams,
--  kein Ort für beliebig großen Inhalt.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.betriebe
  drop constraint if exists betriebe_hub_stil_form;

alter table public.betriebe
  add constraint betriebe_hub_stil_form check (
    hub_stil is null or (
      jsonb_typeof(hub_stil) = 'object'
      and pg_column_size(hub_stil) < 2500
      and (not hub_stil ? 'emoji' or jsonb_typeof(hub_stil->'emoji') = 'boolean')
    ));

commit;

-- ── PROBE (vor dem Anwenden in einer zurückgedrehten Transaktion) ──
--   {"emoji":false}                                → angenommen (unverändert)
--   {"emoji":"false"}                               → check_violation (unverändert)
--   {"schrift":{"kopf":"playfair","titel":"bebas",
--     "abschnitt":"lora","gericht":"caveat",
--     "kachel":"pacifico","text":"nunito"}}          → angenommen (~150 Bytes)
--   sechs Rollen, je "eigen" + volle Storage-Adresse  → angenommen (~1100 Bytes,
--     wäre unter der alten 1000-Byte-Grenze abgelehnt worden)
--   ein Text mit 3000 Bytes irgendwo in hub_stil      → check_violation
-- ═══════════════════════════════════════════════════════════════════
