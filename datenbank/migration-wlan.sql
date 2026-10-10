-- ═══════════════════════════════════════════════════════════════════
--  migration-wlan.sql · hub_texte.wlan_netz / wlan_passwort
--
--  Wunsch (10.10.): Das WLAN-Passwort trägt der Betrieb im Board ein,
--  der Gast sieht es nicht, sondern kopiert es mit einem Tipp oder
--  scannt einen QR-Code. Die Werte liegen bei den übrigen Worten des
--  Hauses in betriebe.hub_texte — der Hub liest sie live, wie Slogan
--  und Laufschrift, keine neue Spalte.
--
--  Ehrlich dazu: hub_texte ist für anon lesbar (der Hub braucht es).
--  Das Passwort ist für Gäste bestimmt und stand bisher sogar sichtbar
--  im Hub — nur das GÄSTE-Netz gehört hierher (Satz im Board).
--
--  Grenzen sind Technik, keine Stilfrage: 32 Zeichen = längster
--  WLAN-Name, 63 = längstes WPA-Passwort. Dieselben Zahlen wie
--  TEXTMASS.hubWlanNetz/-Passwort im Board und kurz(…) im Hub.
--  Additiv (§2.8: keine Zeile beginnt mit drop).
--
--  Vorher gemessen: 0 Zeilen mit wlan_netz/wlan_passwort, bisherige
--  Schranken hub_texte_masse und hub_texte_laufschrift.
-- ═══════════════════════════════════════════════════════════════════
alter table public.betriebe add constraint hub_texte_wlan check (
  coalesce(length(hub_texte ->> 'wlan_netz'), 0) <= 32 and
  coalesce(length(hub_texte ->> 'wlan_passwort'), 0) <= 63
);

-- ANGEWENDET 10.10. (live). ── PROBE (zurückgedreht, Choco, Zeilenzahl
-- statt Ausnahme §2.3b, andere Spalte derselben Zeile §2.7) ──
--   wlan_netz 32 + wlan_passwort 63 Zeichen   → 1 Zeile
--   wlan_passwort 64 Zeichen                 → abgewiesen (check_violation)
--   wlan_netz 33 Zeichen                     → abgewiesen (check_violation)
--   name ändern (andere Spalte)              → 1 Zeile
