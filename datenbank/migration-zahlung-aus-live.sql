-- ═══════════════════════════════════════════════════════════════════
-- ZAHLUNG AUS (live, 31.10.2026) · Freigabe des Nutzers: „Punkt 2“ der
-- Phase-0-Liste (OMOTENO_IST_BERICHT.md, S3).
--
-- Online-Zahlung ist ausgeliefert AUS (ZAHL OFFEN, ZAG-Frage, recht/15):
-- Hub (ZAHLUNG_ONLINE_AN), Board und beide Edge Functions (ZAHLUNG_AN).
-- Die Datenbank bot die vier Gast-Funktionen trotzdem für anon und
-- authenticated an — jeder mit dem öffentlichen Schlüssel hätte eine
-- Bestellung „zahlungspflichtig“ anlegen können, die bis zur Zahlung
-- unsichtbar bleibt. Live am 31.10. gelesen: 0 Zahlungen, 0 Zahlarten.
--
-- Wer ruft sie? Nur der Hub, und nur hinter ZAHLUNG_ONLINE_AN bzw. für
-- Bestellungen mit offener Zahlung (gibt es nicht). Board, Küche und die
-- Edge Functions rufen keine davon (grep). service_role behält das Recht.
--
-- WIEDER EINSCHALTEN (erst nach Anwaltsantwort, dokumente/zahlung-anbinden-anleitung.md):
--   grant execute on function public.bestellung_aufgeben_zahlung(uuid, text, text, numeric, text, jsonb, text, text, text, text, text, text) to anon, authenticated;
--   grant execute on function public.bestellung_liefern_zahlung(uuid, jsonb, jsonb, numeric, text, text, text, text, text) to anon, authenticated;
--   grant execute on function public.zahlarten_oeffentlich(uuid) to anon, authenticated;
--   grant execute on function public.zahlung_status(uuid) to anon, authenticated;
-- ═══════════════════════════════════════════════════════════════════
revoke execute on function public.bestellung_aufgeben_zahlung(uuid, text, text, numeric, text, jsonb, text, text, text, text, text, text) from anon, authenticated, public;
revoke execute on function public.bestellung_liefern_zahlung(uuid, jsonb, jsonb, numeric, text, text, text, text, text) from anon, authenticated, public;
revoke execute on function public.zahlarten_oeffentlich(uuid) from anon, authenticated, public;
revoke execute on function public.zahlung_status(uuid) from anon, authenticated, public;
