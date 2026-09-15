-- ═══════════════════════════════════════════════════════════════════
--  EINGESPIELT (15.09.2026) · Gäste-Newsletter über Klaviyo — DB-Seite
--
--  Angewendet gegen das echte Projekt. Die drei Edge Functions sind
--  deployt, die beiden Trigger-Funktionen laufen mit einem echten,
--  zufällig erzeugten Geheimnis statt dem Platzhalter unten — DAS
--  GEHEIMNIS STEHT NICHT IN DIESER DATEI und nirgends im Repo, nur in
--  Supabase (Funktionskörper der beiden Trigger-Funktionen) und als
--  Secret OMOTENO_TRIGGER_SECRET der beiden Edge Functions. Wer diese
--  Datei ein zweites Mal — etwa gegen ein neues Projekt — einspielt,
--  ersetzt <OMOTENO_TRIGGER_SECRET> unten zuerst durch einen NEUEN,
--  selbst erzeugten Zufallswert (z. B. `openssl rand -base64 32`) und
--  setzt denselben Wert als Secret auf beiden Functions — niemals den
--  Platzhalter unverändert einspielen.
--
--  Nachgetragen nach dem ersten Einspielen, per get_advisors gefunden:
--  beide Trigger-Funktionen waren ohne Revoke über
--  /rest/v1/rpc/<name> für anon UND authenticated direkt aufrufbar
--  (CLAUDE.md §2.3a). Jetzt am Ende von Punkt 2 und 3 mit
--  `revoke all … from public, anon, authenticated` geschlossen —
--  geprüft, dass der Trigger selbst danach unverändert weiter feuert.
--
--  Ursprünglich einzuspielen NACHDEM migration-rechnung-rabatt.sql
--  eingespielt ist (dort steht rabattcode_anlegen, das Block D beim
--  Auffüllen des Coupon-Vorrats braucht) und NACHDEM die beiden
--  Edge Functions deployt sind (sonst laufen die pg_net-Aufrufe ins
--  Leere — harmlos, aber sinnlos, siehe Hinweis bei Punkt 3):
--
--    supabase functions deploy klaviyo-profil-melden --no-verify-jwt
--    supabase functions deploy klaviyo-ereignis-melden --no-verify-jwt
--    supabase functions deploy newsletter-vorrat-auffuellen
--    supabase secrets set OMOTENO_TRIGGER_SECRET=<langer Zufallswert>
--    supabase secrets set KLAVIYO_API_KEY=pk_... (Private API Key)
--
--  newsletter-vorrat-auffuellen ist die Bruecke fuer den "Vorrat
--  auffuellen"-Knopf im Board: rabattcode_anlegen ist absichtlich nur
--  fuer service_role freigegeben, der Browser darf sie nicht direkt
--  rufen. OHNE --no-verify-jwt, weil ein eingeloggter Wirt sie ruft,
--  nicht ein fremder Dienst (Muster wie bei uebersetzen).
--
--  VOR DEM EINSPIELEN VON HAND GEPRÜFT (gegen das echte Projekt,
--  CLAUDE.md §1.2/§1.3):
--    \d gaeste         -- Spalten wirklich betrieb_id, kennung, email? Ja.
--    \d bestellungen   -- Spalte wirklich "geraet" (nicht gast_kennung
--                         — das ist die Quittungsnummer, CLAUDE.md §1.1a)? Ja.
--    select extname from pg_extension where extname = 'pg_net'; -- vorhanden.
--
--  <OMOTENO_TRIGGER_SECRET> unten ist ein PLATZHALTER, kein echter
--  Wert — vor jedem Einspielen (auch gegen ein weiteres Projekt) durch
--  denselben Wert ersetzen, der bei "supabase secrets set" steht,
--  sonst weisen die Funktionen jeden Aufruf mit 401 ab (CLAUDE.md-
--  Muster wie VAPI_SECRET bei alessia-bestellung: die Echtheit haengt
--  an einem gemeinsamen Geheimnis im Kopf, nicht an einem Supabase-
--  Nutzertoken, weil ein DB-Trigger kein Nutzertoken hat).
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ══════════════════════════════════════════════════════════════════
--  1 · Zwei Spalten auf betriebe
-- ══════════════════════════════════════════════════════════════════

alter table public.betriebe
  add column if not exists newsletter_aktiv boolean not null default false;
alter table public.betriebe
  add column if not exists klaviyo_liste_id text;

comment on column public.betriebe.newsletter_aktiv is
  'Schalter im Admin-Board (Block F). Aus = beide Trigger unten tun '
  'nichts, auch wenn eine E-Mail hinterlegt ist — kein Gast landet in '
  'Klaviyo, solange der Betrieb es nicht ausdruecklich eingeschaltet '
  'hat (CLAUDE.md §2.5).';
comment on column public.betriebe.klaviyo_liste_id is
  'Klaviyo-Listen-ID dieses Betriebs, angelegt in Block D. Ohne diese '
  'ID meldet klaviyo-profil-melden "keine_liste" und traegt niemanden '
  'ein.';

grant select (newsletter_aktiv, klaviyo_liste_id) on public.betriebe to authenticated;
grant update (newsletter_aktiv) on public.betriebe to authenticated;


-- ══════════════════════════════════════════════════════════════════
--  2 · Trigger gaeste → klaviyo-profil-melden
--
--  NUR bei einer NEUEN oder GEÄNDERTEN E-Mail, nicht bei jedem
--  Update der Zeile (z. B. Besuchszaehler) — sonst meldet Klaviyo
--  bei jedem Tischbesuch erneut dasselbe Profil.
-- ══════════════════════════════════════════════════════════════════

create or replace function public.gaeste_klaviyo_melden()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_aktiv boolean;
begin
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email is not distinct from new.email then
    return new;
  end if;

  select newsletter_aktiv into v_aktiv from public.betriebe where id = new.betrieb_id;
  if v_aktiv is not true then
    return new;
  end if;

  perform net.http_post(
    url := 'https://quxwweuvdqtjsdwgjdrh.supabase.co/functions/v1/klaviyo-profil-melden',
    body := jsonb_build_object('betrieb_id', new.betrieb_id, 'email', new.email),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Omoteno-Trigger-Secret', '<OMOTENO_TRIGGER_SECRET>'
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists gaeste_klaviyo_melden_trg on public.gaeste;
create trigger gaeste_klaviyo_melden_trg
  after insert or update of email on public.gaeste
  for each row execute function public.gaeste_klaviyo_melden();

-- Nachgetragen nach dem ersten Einspielen: get_advisors meldete diese
-- Funktion als über /rest/v1/rpc/gaeste_klaviyo_melden fuer anon UND
-- authenticated aufrufbar (CLAUDE.md §2.3a — PostgREST stellt JEDE
-- Funktion in public als RPC bereit, sobald die Rolle EXECUTE hat,
-- Trigger-Funktionen eingeschlossen). Ein Trigger braucht dieses Recht
-- nicht, er laeuft als Teil der Anweisung — verifiziert: der Trigger
-- feuert nach dem Revoke unveraendert (net.http_request_queue waechst
-- weiter bei aktivem Newsletter).
revoke all on function public.gaeste_klaviyo_melden() from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════
--  3 · Trigger bestellungen → klaviyo-ereignis-melden
--
--  Bestellungen tragen keine E-Mail direkt — nur bestellungen.geraet,
--  dieselbe Geraetekennung wie gaeste.kennung (CLAUDE.md §1.1a: NICHT
--  gast_kennung, das ist die Quittungsnummer der einzelnen
--  Bestellung). Ohne hinterlegte E-Mail fuer dieses Geraet passiert
--  nichts — die meisten Bestellungen bleiben anonym, das ist normal.
-- ══════════════════════════════════════════════════════════════════

create or replace function public.bestellung_klaviyo_melden()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_aktiv boolean;
  v_email text;
begin
  if new.geraet is null then
    return new;
  end if;

  select newsletter_aktiv into v_aktiv from public.betriebe where id = new.betrieb_id;
  if v_aktiv is not true then
    return new;
  end if;

  select email into v_email from public.gaeste
    where betrieb_id = new.betrieb_id and kennung = new.geraet
      and email is not null and btrim(email) <> '';
  if v_email is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://quxwweuvdqtjsdwgjdrh.supabase.co/functions/v1/klaviyo-ereignis-melden',
    body := jsonb_build_object('betrieb_id', new.betrieb_id, 'email', v_email,
                                'zeitpunkt', new.zeitpunkt),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Omoteno-Trigger-Secret', '<OMOTENO_TRIGGER_SECRET>'
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists bestellung_klaviyo_melden_trg on public.bestellungen;
create trigger bestellung_klaviyo_melden_trg
  after insert on public.bestellungen
  for each row execute function public.bestellung_klaviyo_melden();

-- Nachgetragen, dieselbe Begründung wie bei gaeste_klaviyo_melden oben.
revoke all on function public.bestellung_klaviyo_melden() from public, anon, authenticated;

commit;

-- ── PROBE — GEFAHREN, gegen das echte Projekt, zurueckgedreht ──────
-- newsletter_aktiv=true + neue E-Mail: Warteschlange 0 → 1.
-- newsletter_aktiv=false + neue E-Mail: Warteschlange unveraendert
--   (1 → 1, kein neuer Eintrag). Danach denselben Ablauf nach dem
--   Revoke oben wiederholt: Trigger feuert unveraendert (0 → 1) —
--   das Revoke nimmt nur den direkten RPC-Aufruf weg, nicht den
--   Trigger selbst. Alle drei Laeufe rollten zurueck, keine der
--   Probe-Zeilen (probe-geraet-0000x@example.com) blieb stehen.
--
-- pg_net feuert asynchron (die Anfrage geht in eine Warteschlange,
-- net._http_response zeigt spaeter das Ergebnis) — deshalb genuegt
-- hier NICHT "kein Fehler", sondern es muss geprueft werden, dass
-- ueberhaupt ein Aufruf in die Warteschlange kam.
--
-- begin;
-- select count(*) as vorher from net.http_request_queue;
-- update betriebe set newsletter_aktiv = true where id =
--   (select id from betriebe limit 1);
-- insert into gaeste (betrieb_id, kennung, email) values (
--   (select id from betriebe limit 1), 'probe-geraet-00001', 'probe@example.com'
-- ) on conflict do nothing;
-- select count(*) as nachher from net.http_request_queue;
-- -- nachher muss groesser als vorher sein
-- rollback;
--
-- Gegenprobe (muss NICHTS ausloesen): denselben Einsatz mit
-- newsletter_aktiv = false fahren — die Warteschlange darf sich dabei
-- nicht aendern.
