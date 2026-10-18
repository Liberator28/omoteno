-- ═══════════════════════════════════════════════════════════════════
--  migration-hub-projekte.sql · Hubs wie Projekte zwischenspeichern
--
--  ANGEWENDET 17.10. (apply_migration hub_projekte, Supabase quxwweuvdqtjsdwgjdrh)
--  und sofort zurückgedreht geprüft (datenbank/pruef-hub-projekte.sql):
--    · je Funktion genau eine Signatur; authenticated schreibt nicht direkt
--      in hub_projekte, anon liest nicht und ruft nicht (42501),
--      hub_stand_von ist für niemanden außer dem Eigentümer ausführbar
--    · Inhaber sichert („  Herbst  “ → „Herbst“, fünf Schlüssel), Name leer
--      oder 61 Zeichen → name; Laden stellt hub_stil bytegleich wieder her,
--      die Sicherung trägt den Stand davor (karte raster)
--    · kaputter Stand (hub_stil verletzt seine Schranke) → form, KEINE
--      neue Sicherung, Betrieb unverändert
--    · archivieren / archiviert laden → archiviert / zurückholen /
--      umbenennen („Herbst 2026“, in eigener Anweisung gemessen)
--    · Fremder und Team: 0 Zeilen sichtbar, jede Funktion kein_recht;
--      Team schreibt direkt → 42501
--    · 31. eigenes Projekt → voll; nach acht Ladevorgängen 5 sichtbare,
--      3 archivierte Sicherungen
--    · Zwei Messfehler der ersten Probe behoben: der Name im SELECT
--      derselben Anweisung (alte Momentaufnahme) und ein Projekt, das
--      seit der Form-Probe kaputt war — jedes Laden endete mit „form“,
--      gezählt wurde 1 statt 5 (§8.1g C).
--
--  Wunsch (17.10.): „Man soll auch seine Hubs wie Projekte
--  zwischenspeichern können.“ Vorher gab es nur den Live-Stand in
--  betriebe — jedes „Übernehmen“ überschrieb ihn, ohne Weg zurück.
--
--  Ein Projekt ist ein Schnappschuss der fünf Spalten, die das
--  Aussehen des Gast-Hubs tragen: hub_stil, hub_texte, hub_kacheln,
--  hub_banner, hub_avatar. Den Stand liest der SERVER aus betriebe —
--  nicht aus der Anfrage. So kann niemand ein „Projekt“ mit einem
--  erfundenen Inhalt anlegen, der beim Laden an den Schranken der
--  Spalten vorbeiginge.
--
--  Laden legt zuerst eine „Sicherung vor dem Laden“ an (die letzten
--  fünf bleiben, ältere werden archiviert) und schreibt dann die fünf
--  Spalten. Jede CHECK-Schranke auf betriebe greift; ein Verstoß ergibt
--  den Grund „form“, und NICHTS ist geändert (Sicherung eingeschlossen).
--  Der Protokoll-Trigger auf betriebe hält fest, wer geladen hat.
--
--  Nichts wird gelöscht (§2.8): Entfernen heißt archivieren, mit
--  Rückweg. Nur Inhaber (ist_inhaber), wie jede Gestaltung des Hubs.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.hub_projekte (
  id           uuid primary key default gen_random_uuid(),
  betrieb_id   uuid not null references public.betriebe(id) on delete cascade,
  name         text not null,
  art          text not null default 'eigen',
  daten        jsonb not null,
  archiviert   boolean not null default false,
  angelegt     timestamptz not null default now(),
  angelegt_von uuid,
  constraint hub_projekte_form check (
    length(btrim(name)) between 1 and 60
    and art in ('eigen', 'sicherung')
    and jsonb_typeof(daten) = 'object'
    and pg_column_size(daten) < 600000)
);
create index if not exists hub_projekte_betrieb on public.hub_projekte (betrieb_id, angelegt desc, id);

alter table public.hub_projekte enable row level security;
revoke all on public.hub_projekte from public, anon, authenticated;
grant select on public.hub_projekte to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hub_projekte' and policyname = 'hub_projekte_lesen') then
    create policy hub_projekte_lesen on public.hub_projekte for select to authenticated
      using (public.ist_inhaber(betrieb_id));
  end if;
end $$;

-- Der Stand des Hubs, wie er gerade in betriebe steht.
create or replace function public.hub_stand_von(p_betrieb uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('hub_stil', b.hub_stil, 'hub_texte', b.hub_texte, 'hub_kacheln', b.hub_kacheln,
                            'hub_banner', b.hub_banner, 'hub_avatar', b.hub_avatar)
    from public.betriebe b where b.id = p_betrieb;
$$;
revoke execute on function public.hub_stand_von(uuid) from public, anon, authenticated;

create or replace function public.hub_projekt_sichern(p_betrieb uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(coalesce(p_name, '')); v_id uuid;
begin
  if p_betrieb is null or not public.ist_inhaber(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if length(v_name) < 1 or length(v_name) > 60 then return jsonb_build_object('ok', false, 'grund', 'name'); end if;
  if (select count(*) from public.hub_projekte where betrieb_id = p_betrieb and art = 'eigen' and not archiviert) >= 30 then
    return jsonb_build_object('ok', false, 'grund', 'voll');
  end if;
  begin
    insert into public.hub_projekte (betrieb_id, name, art, daten, angelegt_von)
    values (p_betrieb, v_name, 'eigen', public.hub_stand_von(p_betrieb), auth.uid())
    returning id into v_id;
  exception when check_violation then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.hub_projekt_laden(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pr record; v_sich uuid;
begin
  select * into pr from public.hub_projekte where id = p_id;
  if pr.id is null or not public.ist_inhaber(pr.betrieb_id) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if pr.archiviert then return jsonb_build_object('ok', false, 'grund', 'archiviert'); end if;
  begin
    insert into public.hub_projekte (betrieb_id, name, art, daten, angelegt_von)
    values (pr.betrieb_id, 'Vor dem Laden von „' || left(pr.name, 40) || '“', 'sicherung', public.hub_stand_von(pr.betrieb_id), auth.uid())
    returning id into v_sich;
    -- JSON-null (ein Projekt ohne Banner) wird SQL-NULL, nicht der Text 'null'.
    update public.betriebe set
      hub_stil    = nullif(pr.daten -> 'hub_stil',    'null'::jsonb),
      hub_texte   = nullif(pr.daten -> 'hub_texte',   'null'::jsonb),
      hub_kacheln = nullif(pr.daten -> 'hub_kacheln', 'null'::jsonb),
      hub_banner  = nullif(pr.daten -> 'hub_banner',  'null'::jsonb),
      hub_avatar  = nullif(pr.daten -> 'hub_avatar',  'null'::jsonb)
     where id = pr.betrieb_id;
  exception when check_violation then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end;
  -- Nur die letzten fünf Sicherungen bleiben sichtbar (Gleichstand nach id, §2.6).
  update public.hub_projekte set archiviert = true
   where betrieb_id = pr.betrieb_id and art = 'sicherung' and not archiviert
     and id not in (select id from public.hub_projekte where betrieb_id = pr.betrieb_id and art = 'sicherung' and not archiviert
                     order by angelegt desc, id desc limit 5);
  return jsonb_build_object('ok', true, 'sicherung', v_sich);
end $$;

create or replace function public.hub_projekt_umbenennen(p_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_b uuid; v_name text := btrim(coalesce(p_name, ''));
begin
  select betrieb_id into v_b from public.hub_projekte where id = p_id;
  if v_b is null or not public.ist_inhaber(v_b) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if length(v_name) < 1 or length(v_name) > 60 then return jsonb_build_object('ok', false, 'grund', 'name'); end if;
  update public.hub_projekte set name = v_name where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- Entfernen = archivieren; p_an = false holt es zurück (Rückgängig im Board).
create or replace function public.hub_projekt_archivieren(p_id uuid, p_an boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_b uuid;
begin
  select betrieb_id into v_b from public.hub_projekte where id = p_id;
  if v_b is null or not public.ist_inhaber(v_b) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if p_an is false and (select count(*) from public.hub_projekte where betrieb_id = v_b and art = 'eigen' and not archiviert) >= 30
     and (select art from public.hub_projekte where id = p_id) = 'eigen' then
    return jsonb_build_object('ok', false, 'grund', 'voll');
  end if;
  update public.hub_projekte set archiviert = coalesce(p_an, true) where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.hub_projekt_sichern(uuid, text) from public, anon;
revoke execute on function public.hub_projekt_laden(uuid) from public, anon;
revoke execute on function public.hub_projekt_umbenennen(uuid, text) from public, anon;
revoke execute on function public.hub_projekt_archivieren(uuid, boolean) from public, anon;
grant execute on function public.hub_projekt_sichern(uuid, text) to authenticated;
grant execute on function public.hub_projekt_laden(uuid) to authenticated;
grant execute on function public.hub_projekt_umbenennen(uuid, text) to authenticated;
grant execute on function public.hub_projekt_archivieren(uuid, boolean) to authenticated;
