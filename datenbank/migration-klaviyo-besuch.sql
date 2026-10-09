-- ═══════════════════════════════════════════════════════════════════
--  migration-klaviyo-besuch.sql · Klaviyo merkt sich jeden Besuch
--  (Wunsch zweiter Tag: „das System soll sich immer merken, sobald der
--  Kunde wieder bestellt und wenn er länger nicht mehr da war“ —
--  Rückholung nach 20 Tagen ohne Besuch)
--
--  BEFUND (live gelesen):
--   · gaeste_klaviyo_melden meldete nur eine NEUE E-Mail. Ein Besuch
--     (gast_melden erhöht gaeste.besuche nach > 4 h Pause) kam nie bei
--     Klaviyo an — eine Rückholung „20 Tage ohne Besuch“ hatte keine
--     Datengrundlage.
--   · bestellung_klaviyo_melden meldete JEDE neue Bestellung mit
--     bekannter Mail, auch markierte (pruefen) und Servicerufe, ohne
--     Summe und ohne Gerichte.
--   · Beide Trigger schickten die E-Mail-Adresse im Körper und trugen
--     das gemeinsame Geheimnis als Klartext im Funktionskörper.
--
--  JETZT:
--   · Das Geheimnis liegt im Vault (omoteno_trigger_secret), kopiert aus
--     dem alten Funktionskörper — nie in dieser Datei. Frische
--     Datenbank: select vault.create_secret('<OMOTENO_TRIGGER_SECRET>',
--     'omoteno_trigger_secret');
--   · Die Trigger schicken NUR eine id (§2.3d) — den Inhalt holt die
--     Edge Function selbst über klaviyo_gast_stand /
--     klaviyo_bestellung_stand (nur service_role).
--   · Neuer Trigger: Besuch (besuche steigt) → Profil-Eigenschaft
--     omoteno_<slug>_letzter_besuch. Eine Bestellung setzt sie ebenfalls.
--     Der Rückhol-Flow in Klaviyo hängt an diesem Datum + 20 Tage:
--     Kommt der Gast vorher wieder, rückt das Datum, die Mail entfällt
--     von selbst — kein Cron nötig.
--   · klaviyo_flows: welche Flows/Vorlagen je Betrieb angelegt sind
--     (Lesen nur Inhaber), damit das Board sie zeigen kann.
--
--  ANGEWENDET (09.10., live, mit den Edge Functions v5 beider Melder).
--  Vorher zurückgedreht an Choco gemessen: Besuch +1 → genau 1 Aufruf
--  {art:'besuch', gast_id}; nur letzter_besuch geändert → 0; Gast ohne
--  Mail → 0; Bestellung → 1 Klaviyo-Aufruf; markiert und Serviceruf → 0
--  und klaviyo_bestellung_stand = null.
--  Danach live: je Funktion genau EINE Fassung, Geheimnis in keinem
--  Körper mehr, anon/authenticated dürfen keine der sieben Funktionen
--  (service_role: Stand + Geheimnisprüfung), klaviyo_flows für anon zu.
--  Echter Aufruf über klaviyo_melden_post mit unbekannter id:
--    · VOR Teil 5: beide Edge Functions 401 — das Geheimnis im
--      Triggerkörper und das Edge-Secret waren verschieden (Teil 5).
--    · NACH Teil 5: beide 200 {fehler:'kein_schluessel'}; falsches
--      Geheimnis → 401, ohne Kopf → 401.
--  BEFUNDE, die nur der Betreiber beheben kann:
--    · KLAVIYO_API_KEY ist als Edge-Secret NICHT gesetzt — der Server
--      hat Klaviyo also noch nie etwas geschickt.
--    · betriebe.klaviyo_liste_id war bei allen drei Häusern leer; jetzt
--      live gelesen gesetzt (chocolamour UvPrnH, blend RvXGPR,
--      minhkeey V2cdvr — Datenänderung, nicht Teil dieser Datei).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Geheimnis in den Vault (aus dem alten Körper, einmalig) ────
do $$
declare v text;
begin
  if exists (select 1 from vault.secrets where name = 'omoteno_trigger_secret') then return; end if;
  v := (regexp_match(pg_get_functiondef('public.gaeste_klaviyo_melden()'::regprocedure),
                     '''X-Omoteno-Trigger-Secret'',\s*''([^'']+)'''))[1];
  if v is not null and v !~ '^<' then
    perform vault.create_secret(v, 'omoteno_trigger_secret', 'Geheimnis der Klaviyo-Trigger (Edge Functions ohne JWT)');
  end if;
end $$;

-- Ein Aufruf an genau zwei Funktionen, Geheimnis aus dem Vault. Fehlt
-- es, wird nichts gesendet — nie ohne Geheimnis.
create or replace function public.klaviyo_melden_post(p_funktion text, p_koerper jsonb)
returns void language plpgsql security definer set search_path = public as $function$
declare v_geheim text;
begin
  if p_funktion not in ('klaviyo-profil-melden', 'klaviyo-ereignis-melden') then return; end if;
  select decrypted_secret into v_geheim from vault.decrypted_secrets where name = 'omoteno_trigger_secret' limit 1;
  if v_geheim is null then return; end if;
  perform net.http_post(
    url := 'https://quxwweuvdqtjsdwgjdrh.supabase.co/functions/v1/' || p_funktion,
    body := p_koerper,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Omoteno-Trigger-Secret', v_geheim),
    timeout_milliseconds := 5000);
end $function$;

-- ── 2 · Was die Edge Functions lesen (nur service_role) ────────────
-- null = nicht melden (Newsletter aus, keine Adresse).
create or replace function public.klaviyo_gast_stand(p_gast uuid)
returns jsonb language sql stable security definer set search_path = public as $function$
  select jsonb_build_object(
    'email', lower(btrim(g.email)), 'slug', b.slug, 'name', b.name, 'liste', b.klaviyo_liste_id,
    'besuche', g.besuche, 'letzter_besuch', g.letzter_besuch, 'erster_besuch', g.erster_besuch,
    'bestellungen', (select count(*) from public.bestellungen o
                      where o.betrieb_id = g.betrieb_id and o.geraet = g.kennung
                        and not coalesce(o.pruefen, false) and o.status not in ('storniert', 'abgelehnt')),
    'liebling', (select btrim(split_part(p->>'name', ' (', 1))
                   from public.bestellungen o
                   cross join lateral jsonb_array_elements(coalesce(o.positionen, '[]'::jsonb)) p
                  where o.betrieb_id = g.betrieb_id and o.geraet = g.kennung
                    and not coalesce(o.pruefen, false) and o.status not in ('storniert', 'abgelehnt')
                    and p->>'name' is not null
                  group by 1 order by sum(coalesce((p->>'menge')::int, 1)) desc, 1 limit 1))
  from public.gaeste g join public.betriebe b on b.id = g.betrieb_id
  where g.id = p_gast and b.newsletter_aktiv is true and nullif(btrim(g.email), '') is not null;
$function$;

create or replace function public.klaviyo_bestellung_stand(p_bestellung uuid)
returns jsonb language sql stable security definer set search_path = public as $function$
  select jsonb_build_object(
    'email', lower(btrim(g.email)), 'slug', b.slug, 'name', b.name, 'gast_id', g.id,
    'zeitpunkt', o.zeitpunkt, 'quelle', o.quelle,
    'summe', round(coalesce(o.summe, 0) - coalesce(o.rabatt_betrag, 0), 2),
    'rabatt_code', o.rabatt_code,
    'gerichte', coalesce((select jsonb_agg(n order by n) from (
                  select distinct btrim(split_part(p->>'name', ' (', 1)) n
                    from jsonb_array_elements(coalesce(o.positionen, '[]'::jsonb)) p
                   where p->>'name' is not null limit 20) t), '[]'::jsonb))
  from public.bestellungen o
  join public.betriebe b on b.id = o.betrieb_id
  join public.gaeste g on g.betrieb_id = o.betrieb_id and g.kennung = o.geraet
  where o.id = p_bestellung and b.newsletter_aktiv is true and nullif(btrim(g.email), '') is not null
    and not coalesce(o.pruefen, false) and o.quelle <> 'service' and o.status not in ('storniert', 'abgelehnt');
$function$;

-- ── 3 · Trigger: neue Adresse, neuer Besuch, neue Bestellung ───────
create or replace function public.gaeste_klaviyo_melden()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if nullif(btrim(coalesce(new.email, '')), '') is null then return new; end if;
  if tg_op = 'UPDATE' and old.email is not distinct from new.email then return new; end if;
  if not exists (select 1 from public.betriebe where id = new.betrieb_id and newsletter_aktiv is true) then return new; end if;
  perform public.klaviyo_melden_post('klaviyo-profil-melden', jsonb_build_object('gast_id', new.id, 'art', 'neu'));
  return new;
end $function$;

create or replace function public.gaeste_besuch_melden()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if new.besuche is not distinct from old.besuche or new.besuche < old.besuche then return new; end if;
  if nullif(btrim(coalesce(new.email, '')), '') is null then return new; end if;
  if not exists (select 1 from public.betriebe where id = new.betrieb_id and newsletter_aktiv is true) then return new; end if;
  perform public.klaviyo_melden_post('klaviyo-profil-melden', jsonb_build_object('gast_id', new.id, 'art', 'besuch'));
  return new;
end $function$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'gaeste_besuch_melden_trg' and tgrelid = 'public.gaeste'::regclass) then
    create trigger gaeste_besuch_melden_trg after update of besuche on public.gaeste
      for each row execute function public.gaeste_besuch_melden();
  end if;
end $$;

create or replace function public.bestellung_klaviyo_melden()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if new.geraet is null or coalesce(new.pruefen, false) or new.quelle = 'service' then return new; end if;
  if not exists (select 1 from public.betriebe where id = new.betrieb_id and newsletter_aktiv is true) then return new; end if;
  if not exists (select 1 from public.gaeste where betrieb_id = new.betrieb_id and kennung = new.geraet
                  and nullif(btrim(coalesce(email, '')), '') is not null) then return new; end if;
  perform public.klaviyo_melden_post('klaviyo-ereignis-melden', jsonb_build_object('bestellung_id', new.id));
  return new;
end $function$;

-- Kein /rpc/ für Trigger und Helfer (§2.3a); die Stand-Funktionen nur
-- für die Edge Functions.
revoke execute on function public.klaviyo_melden_post(text, jsonb) from public, anon, authenticated;
revoke execute on function public.gaeste_klaviyo_melden()          from public, anon, authenticated;
revoke execute on function public.gaeste_besuch_melden()           from public, anon, authenticated;
revoke execute on function public.bestellung_klaviyo_melden()      from public, anon, authenticated;
revoke execute on function public.klaviyo_gast_stand(uuid)         from public, anon, authenticated;
revoke execute on function public.klaviyo_bestellung_stand(uuid)   from public, anon, authenticated;
grant  execute on function public.klaviyo_gast_stand(uuid)         to service_role;
grant  execute on function public.klaviyo_bestellung_stand(uuid)   to service_role;

-- ── 4 · Welche Flows je Betrieb angelegt sind ──────────────────────
create table if not exists public.klaviyo_flows (
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  art        text not null check (art in ('willkommen', 'rueckholung')),
  flow_id    text not null check (flow_id ~ '^[A-Za-z0-9]{1,32}$'),
  vorlage_id text check (vorlage_id ~ '^[A-Za-z0-9]{1,32}$'),
  angelegt   timestamptz not null default now(),
  primary key (betrieb_id, art)
);
alter table public.klaviyo_flows enable row level security;
revoke all on public.klaviyo_flows from public, anon, authenticated;
grant select on public.klaviyo_flows to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'klaviyo_flows' and policyname = 'klaviyo_flows inhaber liest') then
    create policy "klaviyo_flows inhaber liest" on public.klaviyo_flows for select to authenticated
      using (public.ist_inhaber(betrieb_id));
  end if;
end $$;

-- ── 5 · Eine Quelle für das Geheimnis ─────────────────────────────
-- VORFALL beim Einspielen: Der erste echte Aufruf über
-- klaviyo_melden_post bekam von beiden Edge Functions 401. Das
-- Geheimnis stand zweimal — im alten Triggerkörper (jetzt im Vault)
-- und als Edge-Secret OMOTENO_TRIGGER_SECRET —, und die Kopien waren
-- verschieden. Ob je ein Aufruf durchkam, ist nicht mehr feststellbar
-- (pg_net hält Antworten nur Stunden, die Edge-Protokolle zeigen in 24 h
-- keinen Klaviyo-Aufruf). Statt einer zweiten Kopie fragt die Edge
-- Function jetzt hier: nur service_role, Antwort nur ja/nein, verglichen
-- über md5 (kein zeichenweiser Vergleich, der die Länge eines gleichen
-- Anfangs verrät).
create or replace function public.klaviyo_geheimnis_ok(p_wert text)
returns boolean language sql stable security definer set search_path = public as $function$
  select length(coalesce(p_wert, '')) >= 32 and exists (
    select 1 from vault.decrypted_secrets
     where name = 'omoteno_trigger_secret' and md5(decrypted_secret) = md5(p_wert));
$function$;
revoke execute on function public.klaviyo_geheimnis_ok(text) from public, anon, authenticated;
grant  execute on function public.klaviyo_geheimnis_ok(text) to service_role;
