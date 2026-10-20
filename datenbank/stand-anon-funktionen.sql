-- ═══════════════════════════════════════════════════════════════════
-- STAND · security-definer-Funktionen, die anon ausführen darf
--
-- Gelesen am 08.10., nachgelesen am zweiten Tag nach dem Einspielen
-- von admin_anmelden und tisch_sitzung_start, erneut nach
-- migration-zahlungen.sql (vier neue Zeilen, noch NICHT eingespielt) und nach
-- rabattcode_pruefen (migration-gutschein-sicher.sql, Teil 2b), mit:
--
--   select p.proname, pg_get_function_identity_arguments(p.oid),
--          case when pg_get_functiondef(p.oid) ~ 'schutz_bremsen|schutz_zaehlen'
--               then 'koerper' else '-' end
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef
--     and has_function_privilege('anon', p.oid, 'EXECUTE');
--
-- Zweite Quelle für pruefungen/pruef-sicherheit.js. Jede Zeile braucht
-- dort eine Bremse ODER einen namentlich begründeten Eintrag. Kommt
-- eine Funktion für anon dazu, gehört sie hier hinein — sonst ist sie
-- ungeprüft offen (CLAUDE.md §2.3a, §8.1b).
--
-- Spalten: name | bremse (koerper = schutz_bremsen/schutz_zaehlen im
-- Körper, trigger = Bremse per Trigger auf der Zieltabelle, aufgeben =
-- läuft über bestellung_aufgeben, das je Herkunft zählt und markiert —
-- der Trigger bestellung_bremse lässt quelle 'lieferung' NICHT durch
-- seine Zählung, das stand hier für bestellung_liefern vorher falsch
-- als „trigger“; - = keine)
-- ═══════════════════════════════════════════════════════════════════
admin_anmelden          | koerper
anfrage_anhang_ok       | koerper
bestellung_aufgeben     | koerper
bestellung_aufgeben_zahlung | koerper
bestellung_liefern_zahlung | koerper
bestellung_gefunden     | koerper
bestellung_abholen      | aufgeben
bestellung_liefern      | aufgeben
bestellung_nachrichten  | koerper
bestellung_restzeit     | koerper
bestellung_status       | koerper
bestellung_stornieren   | koerper
gast_mail_merken        | koerper
gast_melden             | koerper
ist_master              | -
meine_betriebe          | -
rabattcode_pruefen      | koerper
reservierung_anfragen   | trigger
reservierung_stand      | koerper
slug_frei               | koerper
tisch_sitzung_start     | koerper
zahlarten_oeffentlich   | koerper
zahlung_status          | koerper
