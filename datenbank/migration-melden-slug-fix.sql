-- ═══════════════════════════════════════════════════════════════════
--  EINGESPIELT (15.09.2026) · melde_neue_bestellung() zeigte auf den
--  falschen Pfad — Bestell- und Serviceruf-Push liefen seit Auslieferung
--  ins Leere
--
--  BEFUND. public.melde_neue_bestellung() (Trigger auf bestellungen,
--  AFTER INSERT) rief per net.http_post
--  https://…supabase.co/functions/v1/melden auf. Die Edge Function
--  heißt zwar "melden" (Anzeigename), ihr tatsächlicher Bereitstellungs-
--  Pfad (slug) ist aber "swift-processor" — Supabase routet über den
--  Slug, nicht über den Namen. Jeder Aufruf lief seit der ersten
--  Bereitstellung auf 404 ("Requested function was not found"), live
--  nachgemessen über net._http_response. Weder dieser Trigger noch die
--  Tabelle bestellungen wurden je über eine Migration in diesem
--  Verzeichnis angelegt — beides entstand direkt im SQL-Editor von
--  Supabase, deshalb stand der Fehler in keiner Datei, die grep hätte
--  finden können.
--
--  FOLGE. Weder Admin-Board noch Küche bekamen eine Web-Push-
--  Benachrichtigung bei neuer Bestellung oder Serviceruf, obwohl das
--  ganze Gegenstück (VAPID, push_geraete, pushEinrichten() in
--  admin.html:3485-3547, Service-Worker) fertig gebaut und verdrahtet
--  ist. Wer sein Gerät für Push eingerichtet hatte, bekam trotzdem
--  nie eine Meldung außerhalb des offenen Tabs.
--
--  KORREKTUR. Nur die URL in der Funktion geändert — nicht die Edge
--  Function neu bereitgestellt (ein Redeploy unter einem neuen Slug
--  hätte das Risiko getragen, den bestehenden, funktionierenden
--  Funktionskörper zu verlieren oder zu verdoppeln; die kleinstmögliche
--  Korrektur ist die am Aufrufer, CLAUDE.md §7 sinngemäß). Signatur
--  unverändert (keine Parameter vorher, keine nachher) — kein Fall von
--  §2.1, `create or replace` hat sauber ersetzt, per
--  pg_get_function_identity_arguments nachgeprüft: weiterhin genau
--  eine Zeile.
--
--  PROBE, GEFAHREN GEGEN DAS ECHTE PROJEKT:
--   1. Direkter net.http_post an .../functions/v1/melden (die alte
--      URL): 404 "Requested function was not found" — der Fehler
--      reproduziert.
--   2. Derselbe Aufruf an .../functions/v1/swift-processor (die neue
--      URL) mit dem exakten Nutzlast-Schema, das der Trigger schickt
--      ({"record": {...}}): 200, "kein Gerät gemeldet" — die Ziel-
--      Adresse trägt und die Funktion las die Nutzlast richtig.
--   3. Nach dem Einspielen: echten Trigger in einer zurückgedrehten
--      Transaktion ausgelöst (insert in bestellungen, quelle:'service')
--      — net.http_request_queue wuchs 0 → 1, kein Fehler, keine echte
--      Zeile blieb stehen.
--
--  Diese Datei spielt nichts automatisch ein — sie dokumentiert eine
--  Korrektur, die bereits live über apply_migration lief, nach
--  demselben Grundsatz wie migration-hub-avatar.sql & Co: Was direkt
--  in Supabase entsteht oder korrigiert wird, gehört trotzdem in eine
--  lesbare Datei in diesem Verzeichnis, sonst verschwindet der Befund
--  wieder in der Unsichtbarkeit, aus der er kam.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.melde_neue_bestellung()
returns trigger
language plpgsql
security definer
set search_path to 'net', 'extensions', 'public'
as $function$
begin
  perform http_post(
    url     := 'https://quxwweuvdqtjsdwgjdrh.supabase.co/functions/v1/swift-processor',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := jsonb_build_object('record', to_jsonb(new)),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Der Push ist Beiwerk. Scheitert er, darf die Bestellung
  -- trotzdem nicht verlorengehen.
  raise warning 'Push konnte nicht ausgelöst werden: %', sqlerrm;
  return new;
end $function$;
