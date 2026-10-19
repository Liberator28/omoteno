-- ═══════════════════════════════════════════════════════════════════
--  ZAHLUNGEN · Karte, Klarna, PayPal, SEPA-Lastschrift (über Stripe) und
--  IBAN-Überweisung. Geld geht NUR auf das Konto des Betriebs.
--
--  NOCH NICHT EINGESPIELT. Standard ist AUS: ohne Zeile in
--  betrieb_zahlarten ändert sich für niemanden etwas (§2.5 additiv).
--
--  Der Weg einer Online-Zahlung:
--    1 · Hub ruft bestellung_aufgeben_zahlung / bestellung_liefern_zahlung.
--        Dieselbe Bestellfunktion wie bisher — danach, im SELBEN Schritt,
--        wird die Bestellung markiert („Zahlung offen“, wie die Quarantäne
--        pruefen=true): Küche und Auswertung sehen sie nicht, und der Push
--        (melden) überspringt sie, weil er erst nach dem Abschluss liest.
--    2 · Edge Function zahlung-starten holt hier Betrag und Konto (der
--        Betrag kommt NIE aus dem Browser), legt die Stripe-Sitzung an.
--    3 · Edge Function stripe-webhook prüft die Unterschrift und ruft
--        zahlung_freigeben: erst jetzt ist die Bestellung für die Küche da.
--    Überweisung: der Besitzer bestätigt „Zahlung eingegangen“ im Board.
--
--  Was NICHT hier steht, weil es nicht hierher gehört: Karten- oder
--  Kontodaten des Gastes (liegen bei Stripe/PayPal/Klarna), geheime
--  Schlüssel (nur Funktionsgeheimnisse in Supabase).
--
--  Vor dem Einspielen (§2.1, §2.3c — am Katalog nachsehen, nicht raten):
--    select p.proname, pg_get_function_identity_arguments(p.oid)
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname='public' and p.proname in
--           ('bestellung_aufgeben','bestellung_liefern');
--    -- genau EINE Zeile je Name, Signatur wie unten aufgerufen
--    select pg_get_constraintdef(oid) from pg_constraint
--     where conrelid='public.bestellungen'::regclass and contype='c';
--    -- pruef_grund / pruefen vorhanden (migration-missbrauch.sql)
--  Danach: datenbank/pruef-zahlungen.sql im SQL-Editor (dreht sich zurück).
-- ═══════════════════════════════════════════════════════════════════

-- ── 0 · IBAN prüfen (Länge für DE, Prüfsumme mod 97) ───────────────
create or replace function public.iban_normal(p text)
returns text language sql immutable set search_path = public as $function$
  select upper(regexp_replace(coalesce(p, ''), '\s', '', 'g'))
$function$;

create or replace function public.iban_gueltig(p text)
returns boolean language plpgsql immutable set search_path = public as $function$
declare
  v    text := public.iban_normal(p);
  r    text;
  rest bigint := 0;
  ch   text;
  z    text;
  i    integer;
begin
  if v !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then return false; end if;
  if left(v, 2) = 'DE' and length(v) <> 22 then return false; end if;
  r := substr(v, 5) || substr(v, 1, 4);
  for i in 1 .. length(r) loop
    ch := substr(r, i, 1);
    z  := case when ch ~ '[0-9]' then ch else (ascii(ch) - 55)::text end;
    rest := (rest::text || z)::bigint % 97;
  end loop;
  return rest = 1;
end $function$;

-- ── 1 · Welche Zahlungsarten ein Betrieb anbietet ──────────────────
create table if not exists public.betrieb_zahlarten (
  betrieb_id      uuid primary key references public.betriebe(id) on delete cascade,
  karte_an        boolean not null default false,
  klarna_an       boolean not null default false,
  paypal_an       boolean not null default false,
  sepa_an         boolean not null default false,
  ueberweisung_an boolean not null default false,
  stripe_konto    text,
  iban            text,
  kontoinhaber    text,
  bic             text,
  bank            text,
  geaendert_am    timestamptz not null default now(),
  geaendert_von   uuid,
  constraint zahlarten_stripe_form check (stripe_konto is null or stripe_konto ~ '^acct_[A-Za-z0-9]{8,64}$'),
  constraint zahlarten_stripe_noetig check ((not (karte_an or klarna_an or paypal_an or sepa_an)) or stripe_konto is not null),
  constraint zahlarten_iban_form check (iban is null or public.iban_gueltig(iban)),
  constraint zahlarten_ueberweisung_noetig check (not ueberweisung_an or (iban is not null and kontoinhaber is not null)),
  constraint zahlarten_texte check (
        (kontoinhaber is null or (length(kontoinhaber) between 2 and 70 and kontoinhaber !~ '[<>"]'))
    and (bank         is null or (length(bank)         between 2 and 70 and bank         !~ '[<>"]'))
    and (bic          is null or  bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'))
);
comment on table public.betrieb_zahlarten is
  'Zahlungsarten je Betrieb. Geschrieben NUR über zahlarten_setzen (Inhaber + PIN). '
  'Kein geheimer Schlüssel, nur die Kontonummer acct_… des EIGENEN Stripe-Kontos des Betriebs.';

alter table public.betrieb_zahlarten enable row level security;
revoke all on public.betrieb_zahlarten from anon, authenticated, public;
grant select on public.betrieb_zahlarten to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='betrieb_zahlarten' and policyname='zahlarten_team_liest') then
    create policy zahlarten_team_liest on public.betrieb_zahlarten for select to authenticated
      using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
  end if;
end $$;

-- ── 2 · Die Zahlungen ──────────────────────────────────────────────
create table if not exists public.zahlungen (
  id                uuid primary key default gen_random_uuid(),
  betrieb_id        uuid not null references public.betriebe(id) on delete cascade,
  bestellung_id     uuid not null unique references public.bestellungen(id) on delete cascade,
  art               text not null check (art in ('stripe','ueberweisung')),
  methode           text check (methode is null or methode in ('card','klarna','paypal','sepa_debit','ueberweisung','unbekannt')),
  status            text not null default 'offen' check (status in ('offen','bezahlt','fehlgeschlagen','abgelaufen','vor_ort')),
  betrag_cent       integer not null check (betrag_cent between 50 and 10000000),
  waehrung          text not null default 'eur' check (waehrung = 'eur'),
  stripe_konto      text,
  stripe_session    text unique,
  stripe_url        text,
  stripe_ablauf     timestamptz,
  stripe_zahlung    text,
  sessions_erstellt smallint not null default 0 check (sessions_erstellt between 0 and 20),
  vorher_markiert   boolean not null default false,
  rueckzahlung_noetig boolean not null default false,
  rueckzahlung_erledigt boolean not null default false,
  erstellt_am       timestamptz not null default now(),
  bezahlt_am        timestamptz,
  geaendert_am      timestamptz not null default now()
);
create index if not exists zahlungen_betrieb_status on public.zahlungen (betrieb_id, status, erstellt_am desc);
comment on table public.zahlungen is
  'Eine Zahlung je Bestellung. Karten-/Kontodaten des Gastes stehen NIE hier. '
  'Löscht mit der Bestellung (Löschfrist der Bestellungen).';

alter table public.zahlungen enable row level security;
revoke all on public.zahlungen from anon, authenticated, public;
grant select (id, betrieb_id, bestellung_id, art, methode, status, betrag_cent, waehrung, erstellt_am, bezahlt_am,
              rueckzahlung_noetig, rueckzahlung_erledigt) on public.zahlungen to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='zahlungen' and policyname='zahlungen_team_liest') then
    create policy zahlungen_team_liest on public.zahlungen for select to authenticated
      using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
  end if;
end $$;

-- Jedes Stripe-Ereignis wird genau EINMAL verarbeitet (Wiederholungen
-- und Wiedereinspielen durch Stripe ändern nichts).
create table if not exists public.zahlung_ereignisse (
  ereignis_id  text primary key,
  empfangen_am timestamptz not null default now()
);
alter table public.zahlung_ereignisse enable row level security;
revoke all on public.zahlung_ereignisse from anon, authenticated, public;

-- protokoll_tabelle_check kennt nur die Tabellen, die bisher dazukamen —
-- ohne die beiden neuen Namen scheiterte JEDE Änderung der Zahlarten
-- (derselbe Fund wie in migration-einkauf.sql). Die Liste wird aus dem
-- LIVE-Katalog gelesen (§2.3c), jeder alte Wert bleibt.
do $$
declare v_def text; v_alt text[]; v_neu text[];
begin
  if to_regclass('public.protokoll') is null then return; end if;
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.protokoll'::regclass and conname = 'protokoll_tabelle_check';
  if v_def is null then return; end if;
  select array_agg(distinct m[1]) into v_alt from regexp_matches(v_def, '''([a-z_]+)''', 'g') m;
  v_neu := (select array_agg(distinct x order by x) from unnest(v_alt || array['betrieb_zahlarten','zahlungen']) x);
  execute 'alter table public.protokoll drop constraint protokoll_tabelle_check';
  execute format('alter table public.protokoll add constraint protokoll_tabelle_check check (tabelle = any (%L::text[]))', v_neu);
end $$;

-- Wer ändert was: dieselbe Spur wie bei Gerichten und Aktionen (protokoll).
do $$ begin
  if to_regclass('public.protokoll') is not null and to_regproc('public.protokoll_schreiben') is not null then
    if not exists (select 1 from pg_trigger where tgname = 'protokoll_betrieb_zahlarten' and tgrelid = 'public.betrieb_zahlarten'::regclass) then
      create trigger protokoll_betrieb_zahlarten after insert or update or delete on public.betrieb_zahlarten
        for each row execute function public.protokoll_schreiben();
    end if;
    if not exists (select 1 from pg_trigger where tgname = 'protokoll_zahlungen' and tgrelid = 'public.zahlungen'::regclass) then
      create trigger protokoll_zahlungen after update or delete on public.zahlungen
        for each row execute function public.protokoll_schreiben();
    end if;
  end if;
end $$;

-- ── 3 · Einstellen (Inhaber + PIN, nur so) ─────────────────────────
-- Erst die Form, dann die PIN (ein Tippfehler im Feld kostet keinen
-- PIN-Versuch, §2.3g: die PIN-Prüfung wirft nie). Die IBAN ist der
-- Weg, auf dem Geld umgeleitet würde — deshalb PIN und Protokoll.
create or replace function public.zahlarten_setzen(p_betrieb uuid, p_daten jsonb, p_pin text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  d      jsonb := coalesce(p_daten, '{}'::jsonb);
  v_konto text := nullif(btrim(coalesce(d->>'stripe_konto', '')), '');
  v_iban  text := nullif(public.iban_normal(d->>'iban'), '');
  v_inh   text := nullif(btrim(coalesce(d->>'kontoinhaber', '')), '');
  v_bic   text := nullif(upper(regexp_replace(coalesce(d->>'bic', ''), '\s', '', 'g')), '');
  v_bank  text := nullif(btrim(coalesce(d->>'bank', '')), '');
  v_karte boolean := coalesce((d->>'karte_an')::boolean, false);
  v_klarna boolean := coalesce((d->>'klarna_an')::boolean, false);
  v_paypal boolean := coalesce((d->>'paypal_an')::boolean, false);
  v_sepa  boolean := coalesce((d->>'sepa_an')::boolean, false);
  v_ueb   boolean := coalesce((d->>'ueberweisung_an')::boolean, false);
  v_grund text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet'); end if;
  if not public.ist_inhaber(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if v_konto is not null and v_konto !~ '^acct_[A-Za-z0-9]{8,64}$' then return jsonb_build_object('ok', false, 'grund', 'stripe_konto_form'); end if;
  if (v_karte or v_klarna or v_paypal or v_sepa) and v_konto is null then return jsonb_build_object('ok', false, 'grund', 'stripe_konto_fehlt'); end if;
  if v_iban is not null and not public.iban_gueltig(v_iban) then return jsonb_build_object('ok', false, 'grund', 'iban'); end if;
  if v_ueb and (v_iban is null or v_inh is null) then return jsonb_build_object('ok', false, 'grund', 'ueberweisung_unvollstaendig'); end if;
  if v_inh is not null and (length(v_inh) not between 2 and 70 or v_inh ~ '[<>"]') then return jsonb_build_object('ok', false, 'grund', 'kontoinhaber'); end if;
  if v_bank is not null and (length(v_bank) not between 2 and 70 or v_bank ~ '[<>"]') then return jsonb_build_object('ok', false, 'grund', 'bank'); end if;
  if v_bic is not null and v_bic !~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$' then return jsonb_build_object('ok', false, 'grund', 'bic'); end if;
  v_grund := public.pin_ausstellung_pruefen(p_pin);
  if v_grund is not null then return jsonb_build_object('ok', false, 'grund', v_grund); end if;
  insert into public.betrieb_zahlarten as z
    (betrieb_id, karte_an, klarna_an, paypal_an, sepa_an, ueberweisung_an, stripe_konto, iban, kontoinhaber, bic, bank, geaendert_am, geaendert_von)
  values (p_betrieb, v_karte, v_klarna, v_paypal, v_sepa, v_ueb, v_konto, v_iban, v_inh, v_bic, v_bank, now(), auth.uid())
  on conflict (betrieb_id) do update
     set karte_an = excluded.karte_an, klarna_an = excluded.klarna_an, paypal_an = excluded.paypal_an,
         sepa_an = excluded.sepa_an, ueberweisung_an = excluded.ueberweisung_an, stripe_konto = excluded.stripe_konto,
         iban = excluded.iban, kontoinhaber = excluded.kontoinhaber, bic = excluded.bic, bank = excluded.bank,
         geaendert_am = now(), geaendert_von = auth.uid();
  return jsonb_build_object('ok', true);
end $function$;
revoke execute on function public.zahlarten_setzen(uuid, jsonb, text) from public, anon;
grant  execute on function public.zahlarten_setzen(uuid, jsonb, text) to authenticated;

-- ── 4 · Was der Gast sehen darf ────────────────────────────────────
-- Nur ob eine Art da ist, nie die Kontodaten (die erscheinen erst NACH
-- der Bestellung, bei zahlung_status).
create or replace function public.zahlarten_oeffentlich(p_betrieb uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare z public.betrieb_zahlarten%rowtype;
begin
  perform schutz_bremsen('zahlarten', 300);
  select * into z from public.betrieb_zahlarten where betrieb_id = p_betrieb;
  if not found then return jsonb_build_object('stripe', false, 'ueberweisung', false); end if;
  return jsonb_build_object(
    'karte',  z.karte_an  and z.stripe_konto is not null,
    'klarna', z.klarna_an and z.stripe_konto is not null,
    'paypal', z.paypal_an and z.stripe_konto is not null,
    'sepa',   z.sepa_an   and z.stripe_konto is not null,
    'stripe', (z.karte_an or z.klarna_an or z.paypal_an or z.sepa_an) and z.stripe_konto is not null,
    'ueberweisung', z.ueberweisung_an and z.iban is not null and z.kontoinhaber is not null);
end $function$;
revoke execute on function public.zahlarten_oeffentlich(uuid) from public;
grant  execute on function public.zahlarten_oeffentlich(uuid) to anon, authenticated;

-- Verwendungszweck der Überweisung: kurz, eindeutig, vom Gast abtippbar.
create or replace function public.zahlung_zweck(p_bestellung uuid)
returns text language sql immutable set search_path = public as $function$
  select 'Bestellung ' || upper(substr(replace(p_bestellung::text, '-', ''), 1, 8))
$function$;

-- ── 5 · Bestellen mit Zahlungsart (zwei Wrapper, ein Bestellweg) ───
-- Eine Markierung nach dem Insert in einem ZWEITEN Aufruf käme zu spät:
-- der Push der Datenbank läuft nach dem Abschluss und läse „nicht
-- markiert“. Im selben Schritt ist die Zeile beim Lesen schon markiert.
create or replace function public.zahlung_vormerken(p_bestellung uuid, p_betrieb uuid, p_art text)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  z   public.betrieb_zahlarten%rowtype;
  b   public.bestellungen%rowtype;
  v_z public.zahlungen%rowtype;
  v_cent integer;
begin
  select * into v_z from public.zahlungen where bestellung_id = p_bestellung;
  if found then
    return jsonb_build_object('id', v_z.id, 'art', v_z.art, 'status', v_z.status, 'betrag_cent', v_z.betrag_cent);
  end if;
  select * into z from public.betrieb_zahlarten where betrieb_id = p_betrieb;
  if p_art = 'stripe' then
    if not found or z.stripe_konto is null or not (z.karte_an or z.klarna_an or z.paypal_an or z.sepa_an) then
      raise exception 'Diese Zahlungsart gibt es hier gerade nicht.' using errcode = 'P0001';
    end if;
  elsif p_art = 'ueberweisung' then
    if not found or not z.ueberweisung_an or z.iban is null then
      raise exception 'Diese Zahlungsart gibt es hier gerade nicht.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Zahlungsart ungueltig' using errcode = 'P0001';
  end if;
  select * into b from public.bestellungen where id = p_bestellung and betrieb_id = p_betrieb;
  if not found then raise exception 'Bestellung unbekannt' using errcode = 'P0001'; end if;
  if p_art = 'ueberweisung' and b.quelle <> 'lieferung' then
    raise exception 'Überweisung gibt es nur bei Lieferung.' using errcode = 'P0001';
  end if;
  -- Endbetrag wie überall: Ware + Lieferung − Rabatt (admin.html, migration-rechnung-rabatt.sql)
  v_cent := round((coalesce(b.summe, 0) + coalesce(b.liefergebuehr, 0) - coalesce(b.rabatt_betrag, 0)) * 100)::integer;
  if v_cent < 50 then
    raise exception 'Der Betrag ist für eine Online-Zahlung zu klein. Bitte am Tisch zahlen.' using errcode = 'P0001';
  end if;
  insert into public.zahlungen (betrieb_id, bestellung_id, art, betrag_cent, stripe_konto, vorher_markiert)
  values (p_betrieb, p_bestellung, p_art, v_cent, case when p_art = 'stripe' then z.stripe_konto end, coalesce(b.pruefen, false))
  returning * into v_z;
  update public.bestellungen
     set pruefen = true,
         pruef_grund = case when coalesce(b.pruefen, false) and b.pruef_grund is not null
                            then b.pruef_grund || ' · Zahlung offen' else 'Zahlung offen' end
   where id = p_bestellung;
  return jsonb_build_object('id', v_z.id, 'art', v_z.art, 'status', v_z.status, 'betrag_cent', v_z.betrag_cent);
end $function$;
revoke execute on function public.zahlung_vormerken(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.bestellung_aufgeben_zahlung(
  p_betrieb_id uuid, p_quelle text, p_tisch text default null::text, p_summe numeric default 0,
  p_notiz text default null::text, p_positionen jsonb default '[]'::jsonb, p_gast_kennung text default null::text,
  p_tisch_schluessel text default null::text, p_sitzung text default null::text, p_geraet text default null::text,
  p_rabattcode text default null::text, p_zahlart text default null::text)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_id uuid; v_z jsonb;
begin
  perform schutz_bremsen('zahlbestellung', 60);
  if p_quelle is distinct from 'tisch' then raise exception 'Quelle ungueltig' using errcode = 'P0001'; end if;
  if p_zahlart is null or p_zahlart not in ('stripe','ueberweisung') then
    raise exception 'Zahlungsart ungueltig' using errcode = 'P0001';
  end if;
  v_id := public.bestellung_aufgeben(
            p_betrieb_id => p_betrieb_id, p_quelle => p_quelle, p_tisch => p_tisch, p_summe => p_summe,
            p_notiz => p_notiz, p_positionen => p_positionen, p_gast_kennung => p_gast_kennung,
            p_tisch_schluessel => p_tisch_schluessel, p_sitzung => p_sitzung, p_geraet => p_geraet,
            p_rabattcode => p_rabattcode);
  v_z := public.zahlung_vormerken(v_id, p_betrieb_id, p_zahlart);
  return jsonb_build_object('ok', true, 'id', v_id, 'zahlung', v_z);
end $function$;
revoke execute on function public.bestellung_aufgeben_zahlung(uuid, text, text, numeric, text, jsonb, text, text, text, text, text, text) from public;
grant  execute on function public.bestellung_aufgeben_zahlung(uuid, text, text, numeric, text, jsonb, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.bestellung_liefern_zahlung(
  p_betrieb_id uuid, p_adresse jsonb, p_positionen jsonb, p_summe numeric,
  p_notiz text default null::text, p_gast_kennung text default null::text,
  p_geraet text default null::text, p_rabattcode text default null::text, p_zahlart text default null::text)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare r jsonb; v_z jsonb;
begin
  perform schutz_bremsen('zahlbestellung', 60);
  if p_zahlart is null or p_zahlart not in ('stripe','ueberweisung') then
    raise exception 'Zahlungsart ungueltig' using errcode = 'P0001';
  end if;
  r := public.bestellung_liefern(
         p_betrieb_id => p_betrieb_id, p_adresse => p_adresse, p_positionen => p_positionen, p_summe => p_summe,
         p_notiz => p_notiz, p_gast_kennung => p_gast_kennung, p_geraet => p_geraet, p_rabattcode => p_rabattcode);
  if coalesce((r->>'ok')::boolean, false) is not true then return r; end if;
  v_z := public.zahlung_vormerken((r->>'id')::uuid, p_betrieb_id, p_zahlart);
  return r || jsonb_build_object('zahlung', v_z);
end $function$;
revoke execute on function public.bestellung_liefern_zahlung(uuid, jsonb, jsonb, numeric, text, text, text, text, text) from public;
grant  execute on function public.bestellung_liefern_zahlung(uuid, jsonb, jsonb, numeric, text, text, text, text, text) to anon, authenticated;

-- ── 6 · Stand der Zahlung (Bestellpass) ────────────────────────────
-- Wer die Bestellnummer (eine zufällige UUID) kennt, sieht den Stand.
-- Bankdaten nur bei offener Überweisung.
create or replace function public.zahlung_status(p_bestellung uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare z public.zahlungen%rowtype; za public.betrieb_zahlarten%rowtype;
begin
  perform schutz_bremsen('zahlstatus', 600);
  select * into z from public.zahlungen where bestellung_id = p_bestellung;
  if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  select * into za from public.betrieb_zahlarten where betrieb_id = z.betrieb_id;
  return jsonb_build_object(
    'ok', true, 'status', z.status, 'art', z.art, 'methode', z.methode, 'betrag_cent', z.betrag_cent,
    'zweck', public.zahlung_zweck(p_bestellung),
    'ueberweisung', case when z.art = 'ueberweisung' and z.status = 'offen'
        then jsonb_build_object('iban', za.iban, 'kontoinhaber', za.kontoinhaber, 'bic', za.bic, 'bank', za.bank) end);
end $function$;
revoke execute on function public.zahlung_status(uuid) from public;
grant  execute on function public.zahlung_status(uuid) to anon, authenticated;

-- ── 7 · Nur für die Edge Functions (service_role) ──────────────────
-- Kein rpc-Endpunkt für anon oder angemeldete Nutzer (§2.3a): Wer eine
-- Zahlung freigeben könnte, könnte Essen ohne Geld bestellen.
create or replace function public.zahlung_stripe_vorbereiten(p_bestellung uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  z  public.zahlungen%rowtype;
  za public.betrieb_zahlarten%rowtype;
  b  public.bestellungen%rowtype;
  v_betrieb record;
  v_methoden text[] := '{}';
begin
  select * into z from public.zahlungen where bestellung_id = p_bestellung for update;
  if not found or z.art <> 'stripe' then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  if z.status not in ('offen','abgelaufen','fehlgeschlagen') then
    return jsonb_build_object('ok', false, 'grund', 'nicht_offen', 'status', z.status);
  end if;
  select * into b from public.bestellungen where id = p_bestellung;
  if not found or b.status <> 'neu' or b.zeitpunkt < now() - interval '6 hours' then
    return jsonb_build_object('ok', false, 'grund', 'nicht_offen');
  end if;
  if z.stripe_url is not null and z.stripe_ablauf is not null and z.stripe_ablauf > now() + interval '2 minutes' and z.status = 'offen' then
    return jsonb_build_object('ok', true, 'url', z.stripe_url, 'wiederverwendet', true, 'versuch', z.sessions_erstellt);
  end if;
  if z.sessions_erstellt >= 5 then return jsonb_build_object('ok', false, 'grund', 'zu_oft'); end if;
  select * into za from public.betrieb_zahlarten where betrieb_id = z.betrieb_id;
  if not found or za.stripe_konto is null or za.stripe_konto is distinct from z.stripe_konto then
    return jsonb_build_object('ok', false, 'grund', 'keine_art');
  end if;
  if za.karte_an   then v_methoden := array_append(v_methoden, 'card'::text); end if;
  if za.klarna_an  then v_methoden := array_append(v_methoden, 'klarna'::text); end if;
  if za.paypal_an  then v_methoden := array_append(v_methoden, 'paypal'::text); end if;
  if za.sepa_an    then v_methoden := array_append(v_methoden, 'sepa_debit'::text); end if;
  if array_length(v_methoden, 1) is null then return jsonb_build_object('ok', false, 'grund', 'keine_art'); end if;
  select name, slug into v_betrieb from public.betriebe where id = z.betrieb_id;
  return jsonb_build_object(
    'ok', true, 'zahlung_id', z.id, 'betrieb_id', z.betrieb_id, 'stripe_konto', z.stripe_konto,
    'betrag_cent', z.betrag_cent, 'methoden', to_jsonb(v_methoden), 'betrieb_name', v_betrieb.name,
    'slug', v_betrieb.slug, 'zweck', public.zahlung_zweck(p_bestellung), 'versuch', z.sessions_erstellt);
end $function$;

create or replace function public.zahlung_session_merken(p_bestellung uuid, p_session text, p_url text, p_ablauf timestamptz)
returns void language plpgsql volatile security definer set search_path = public as $function$
begin
  if p_session !~ '^cs_[A-Za-z0-9_]{8,200}$' or p_url !~ '^https://checkout\.stripe\.com/' then
    raise exception 'session_form';
  end if;
  update public.zahlungen
     set stripe_session = p_session, stripe_url = p_url, stripe_ablauf = p_ablauf,
         sessions_erstellt = sessions_erstellt + 1, status = 'offen', geaendert_am = now()
   where bestellung_id = p_bestellung and status in ('offen','abgelaufen','fehlgeschlagen');
end $function$;

create or replace function public.zahlung_finden(p_session text)
returns jsonb language sql stable security definer set search_path = public as $function$
  select coalesce((select jsonb_build_object('bestellung_id', z.bestellung_id, 'betrieb_id', z.betrieb_id,
                    'stripe_konto', z.stripe_konto, 'betrag_cent', z.betrag_cent, 'status', z.status)
                     from public.zahlungen z where z.stripe_session = p_session), 'null'::jsonb)
$function$;

create or replace function public.zahlung_ereignis_neu(p_id text)
returns boolean language plpgsql volatile security definer set search_path = public as $function$
declare v_n integer;
begin
  if p_id is null or p_id !~ '^evt_[A-Za-z0-9_]{8,200}$' then return false; end if;
  insert into public.zahlung_ereignisse (ereignis_id) values (p_id) on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n = 1;
end $function$;

-- Scheitert die Verarbeitung NACH dem Eintrag, gibt die Funktion den Eintrag
-- wieder frei und antwortet Stripe mit 500: Stripe wiederholt dann, und die
-- Wiederholung wird nicht als „schon gesehen“ weggeworfen (sonst ginge die
-- Zahlung still verloren).
create or replace function public.zahlung_ereignis_frei(p_id text)
returns void language plpgsql volatile security definer set search_path = public as $function$
begin
  delete from public.zahlung_ereignisse where ereignis_id = p_id;
end $function$;

-- Freigeben: erst jetzt gehört die Bestellung der Küche. Gibt es die
-- Bestellung nicht mehr als „neu“ (verworfen), bleibt sie zu und die
-- Zahlung ist als „Rückzahlung nötig“ vermerkt — Geld ohne Essen soll
-- niemand still behalten.
create or replace function public.zahlung_freigeben(p_bestellung uuid, p_methode text default null, p_ref text default null, p_konto text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare z public.zahlungen%rowtype; b public.bestellungen%rowtype;
begin
  select * into z from public.zahlungen where bestellung_id = p_bestellung for update;
  if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  if z.status = 'bezahlt' then return jsonb_build_object('ok', true, 'schon', true, 'betrieb_id', z.betrieb_id); end if;
  if p_konto is not null and z.stripe_konto is distinct from p_konto then
    return jsonb_build_object('ok', false, 'grund', 'konto');
  end if;
  select * into b from public.bestellungen where id = p_bestellung for update;
  -- „vor_ort“: das Personal hat die Bestellung schon freigegeben (Gast hat dort bezahlt).
  -- Kommt trotzdem Geld an, zahlte er zweimal → Rückzahlung nötig, Bestellung bleibt unberührt.
  update public.zahlungen
     set status = 'bezahlt', bezahlt_am = now(), geaendert_am = now(),
         methode = case when p_methode in ('card','klarna','paypal','sepa_debit','ueberweisung') then p_methode else 'unbekannt' end,
         stripe_zahlung = left(p_ref, 120),
         rueckzahlung_noetig = (b.status is distinct from 'neu') or z.status = 'vor_ort'
   where id = z.id;
  if b.status is distinct from 'neu' or z.status = 'vor_ort' then
    return jsonb_build_object('ok', true, 'betrieb_id', z.betrieb_id, 'rueckzahlung', true);
  end if;
  update public.bestellungen
     set pruefen = z.vorher_markiert,
         pruef_grund = case when z.vorher_markiert then nullif(replace(coalesce(b.pruef_grund, ''), ' · Zahlung offen', ''), 'Zahlung offen') end,
         zeitpunkt = now()
   where id = p_bestellung;
  return jsonb_build_object('ok', true, 'betrieb_id', z.betrieb_id, 'bestellung_id', p_bestellung);
end $function$;

create or replace function public.zahlung_scheitert(p_bestellung uuid, p_status text)
returns void language plpgsql volatile security definer set search_path = public as $function$
begin
  if p_status not in ('fehlgeschlagen','abgelaufen') then raise exception 'status'; end if;
  update public.zahlungen set status = p_status, geaendert_am = now()
   where bestellung_id = p_bestellung and status = 'offen';
end $function$;

do $$
declare f text;
begin
  foreach f in array array[
    'zahlung_stripe_vorbereiten(uuid)', 'zahlung_session_merken(uuid, text, text, timestamptz)', 'zahlung_finden(text)',
    'zahlung_ereignis_neu(text)', 'zahlung_ereignis_frei(text)', 'zahlung_freigeben(uuid, text, text, text)', 'zahlung_scheitert(uuid, text)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end $$;

-- ── 7b · Beim Personal bezahlt (Team UND Inhaber im Board) ─────────
-- Fällt Stripe aus oder will der Gast doch bar zahlen, darf die Bestellung
-- nicht unsichtbar bleiben (§7: ein echter Gast ohne Essen kostet mehr als
-- eine Zahlung, die später doppelt eintrifft). Das Personal gibt frei; kommt
-- später doch Geld an, steht die Zahlung auf „Rückzahlung nötig“.
create or replace function public.zahlung_vor_ort_freigeben(p_bestellung uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare z public.zahlungen%rowtype; b public.bestellungen%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet'); end if;
  select * into z from public.zahlungen where bestellung_id = p_bestellung for update;
  if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  if z.betrieb_id not in (select public.meine_betriebe()) and not public.ist_master() then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  if z.status in ('bezahlt','vor_ort') then return jsonb_build_object('ok', true, 'schon', true); end if;
  select * into b from public.bestellungen where id = p_bestellung for update;
  update public.zahlungen set status = 'vor_ort', geaendert_am = now() where id = z.id;
  if b.status = 'neu' then
    update public.bestellungen
       set pruefen = z.vorher_markiert,
           pruef_grund = case when z.vorher_markiert then nullif(replace(coalesce(b.pruef_grund, ''), ' · Zahlung offen', ''), 'Zahlung offen') end,
           zeitpunkt = now()
     where id = p_bestellung;
  end if;
  return jsonb_build_object('ok', true);
end $function$;
revoke execute on function public.zahlung_vor_ort_freigeben(uuid) from public, anon;
grant  execute on function public.zahlung_vor_ort_freigeben(uuid) to authenticated;

-- ── 7c · Bezahlt, aber die Bestellung fällt weg → Rückzahlung nötig ──
-- Storniert der Gast (oder lehnt das Personal ab), NACHDEM bezahlt wurde, steht
-- die Karte nirgends mehr im Board — das Geld würde still behalten. Der Trigger
-- merkt es in der Zahlung; das Board listet jede offene Rückzahlung, an
-- welchem Tag auch immer, bis der Besitzer „erledigt“ tippt.
create or replace function public.zahlung_storno_merken()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  update public.zahlungen set rueckzahlung_noetig = true, geaendert_am = now()
   where bestellung_id = new.id and status = 'bezahlt' and not rueckzahlung_noetig;
  return null;
end $function$;
revoke execute on function public.zahlung_storno_merken() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'zahlung_bei_storno' and tgrelid = 'public.bestellungen'::regclass) then
    create trigger zahlung_bei_storno after update of status on public.bestellungen
      for each row when (new.status in ('storniert','abgelehnt') and old.status is distinct from new.status)
      execute function public.zahlung_storno_merken();
  end if;
end $$;

create or replace function public.zahlung_rueckzahlung_erledigt(p_bestellung uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare z public.zahlungen%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet'); end if;
  select * into z from public.zahlungen where bestellung_id = p_bestellung for update;
  if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  if not public.ist_inhaber(z.betrieb_id) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if not z.rueckzahlung_noetig then return jsonb_build_object('ok', false, 'grund', 'nicht_noetig'); end if;
  update public.zahlungen set rueckzahlung_erledigt = true, geaendert_am = now() where id = z.id;
  return jsonb_build_object('ok', true);
end $function$;
revoke execute on function public.zahlung_rueckzahlung_erledigt(uuid) from public, anon;
grant  execute on function public.zahlung_rueckzahlung_erledigt(uuid) to authenticated;

-- ── 8 · Überweisung bestätigen (Inhaber im Board) ──────────────────
create or replace function public.zahlung_ueberweisung_bestaetigen(p_bestellung uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare z public.zahlungen%rowtype; r jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet'); end if;
  select * into z from public.zahlungen where bestellung_id = p_bestellung;
  if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  if not public.ist_inhaber(z.betrieb_id) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if z.art <> 'ueberweisung' then return jsonb_build_object('ok', false, 'grund', 'falsche_art'); end if;
  r := public.zahlung_freigeben(p_bestellung, 'ueberweisung', 'manuell:' || auth.uid()::text, null);
  return r;
end $function$;
revoke execute on function public.zahlung_ueberweisung_bestaetigen(uuid) from public, anon;
grant  execute on function public.zahlung_ueberweisung_bestaetigen(uuid) to authenticated;
