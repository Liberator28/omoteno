-- ═══════════════════════════════════════════════════════════════════
--  migration-zugriffsrechte.sql · TEIL A (additiv) · Rolle „Manager“, Rechte je Mitglied, Teamziele
--
--  NOCH NICHT EINGESPIELT. Der Live-Katalog war bei der Entstehung nicht erreichbar (Supabase-MCP
--  „ERR_PROXY_TUNNEL“); gelaufen ist alles im lokalen Postgres 16 (pruefungen/pruef-zugriffsrechte-lokal.sh)
--  gegen die ECHTEN Funktionen und Regeln aus den Migrationsdateien. Siehe dokumente/zugriffsrechte-befund.md.
--
--  Reihenfolge (§2.5/§7): TEIL A (diese Datei) → Seiten ausrollen (admin.html, einkauf.html, konto.html,
--  Edge Function team-zugang) → TEIL B (migration-zugriffsrechte-scharf.sql: engere Lese-Regeln).
--  Teil A verändert nichts, was heute jemand liest.
--
--  Was hier liegt:
--   · Rolle „manager“ in betrieb_mitglieder_rolle_check (aus dem Katalog gelesen, §2.3c: jeder alte Wert bleibt).
--   · betrieb_mitglieder.rechte (jsonb, nur Schlüssel aus dem Katalog, nur boolean) — EINE Stelle für Rechte
--     je Mitglied. darf_lager/darf_gutscheine bleiben, wie sie sind (kein zweites System).
--   · rechte_katalog(), rechte_wirksam(), hat_recht(), meine_rechte().
--     Rechte gelten NUR für Manager; Team/Küche bekommen nie ein Finanzrecht. Inhaber (mit PIN) und Master: alles.
--   · team_rechte_liste / team_rechte_setzen / team_rechte_verlauf — nur Inhaber, nie für sich selbst,
--     nur für Manager desselben Betriebs, jede Änderung im Verlauf.
--   · Teamziele (team_ziele, team_aufgaben, team_erfolge) und ihre Funktionen. Kein Geldfeld.
--   · finanz_export_belege() — Einkaufsbelege als Zeilen, nur mit Recht „finanz_export“ (und „kosten_view“).
--
--  Keine Zeile beginnt mit drop oder delete (§2.8): Löschendes steht als „with … as (delete …)“ in einer Zeile.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Rolle „manager“ — Liste aus dem Katalog, jeder alte Wert bleibt (§2.3c) ─────────────
do $$
declare
  v_def text; v_alt text[]; v_neu text[];
begin
  select pg_get_constraintdef(c.oid) into v_def from pg_constraint c
   where c.conrelid = 'public.betrieb_mitglieder'::regclass and c.conname = 'betrieb_mitglieder_rolle_check';
  if v_def is null then
    -- Kein Bestand (nur im lokalen Modell möglich): mit der vollen Liste anlegen.
    execute 'alter table public.betrieb_mitglieder add constraint betrieb_mitglieder_rolle_check check (rolle in (''inhaber'',''manager'',''team'',''kueche''))';
    return;
  end if;
  if v_def like '%''manager''%' then return; end if;
  -- Beide Schreibweisen: ARRAY['a'::text, …] und '{a,b}'::text[] — alle kleingeschriebenen Wörter, ohne Rauschen.
  select array_agg(distinct w order by w) into v_alt
    from (select (regexp_matches(v_def, '[a-z_]+', 'g'))[1] as w) s
   where w not in ('rolle', 'text', 'character', 'varying', 'bpchar', 'any', 'array', 'in', 'check');
  if v_alt is null or not (v_alt @> array['inhaber', 'team', 'kueche']) then
    raise exception 'betrieb_mitglieder_rolle_check unlesbar oder unvollständig: %', v_def;
  end if;
  v_neu := v_alt || array['manager'];
  execute 'alter table public.betrieb_mitglieder drop constraint betrieb_mitglieder_rolle_check';
  execute 'alter table public.betrieb_mitglieder add constraint betrieb_mitglieder_rolle_check check (rolle in ('
          || (select string_agg(quote_literal(x), ',' order by x) from unnest(v_neu) x) || '))';
  -- Nach dem Anlegen die Schranke selbst lesen, nicht „success“ glauben (§2.3c).
  select pg_get_constraintdef(c.oid) into v_def from pg_constraint c
   where c.conrelid = 'public.betrieb_mitglieder'::regclass and c.conname = 'betrieb_mitglieder_rolle_check';
  if v_def not like '%''manager''%' or v_def not like '%''inhaber''%' or v_def not like '%''team''%' or v_def not like '%''kueche''%' then
    raise exception 'betrieb_mitglieder_rolle_check nach dem Umbau unvollständig: %', v_def;
  end if;
end $$;

-- ── 2 · Katalog der Rechte (EINE Stelle) ───────────────────────────────────────────────
-- durchsetzung: 'datenbank' = erzwingen RLS/Funktionen; 'anzeige' = nur die Oberfläche (Bestelldaten bleiben für
-- Mitglieder lesbar, weil Küche und Board die Bons brauchen) — die Oberfläche sagt das so.
create or replace function public.rechte_katalog()
returns table (recht text, bereich text, art text, standard_manager boolean, durchsetzung text, titel text, satz text)
language sql immutable set search_path = public as $$
  select * from (values
    ('kennzahlen_tag',  'Unternehmen',  'view',    true,  'anzeige',   'Tageszahlen',            'Tagesumsatz, Bestellanzahl, Stornos und Servicerufe von heute'),
    ('berichte_view',   'Unternehmen',  'view',    false, 'anzeige',   'Berichte',               'Wochen-, Monats- und Zeitraumberichte: Verlauf, Stunden, Renner'),
    ('berichte_export', 'Unternehmen',  'export',  false, 'anzeige',   'Berichte exportieren',   'Bestellungen und Gerichte als CSV'),
    ('kosten_view',     'Finanzen',     'view',    false, 'datenbank', 'Einkauf und Kalkulation','Einkaufskosten, Wareneinsatz, Rezeptkalkulation und Margen'),
    ('finanz_export',   'Finanzen',     'export',  false, 'datenbank', 'Finanzexport',           'Einkaufsbelege als CSV — wirkt nur zusammen mit „Einkauf und Kalkulation“'),
    ('ziele_edit',      'Team & Ziele', 'edit',    false, 'datenbank', 'Teamziele bearbeiten',   'Teamziele und Aufgaben anlegen und ändern'),
    ('ziele_approve',   'Team & Ziele', 'approve', false, 'datenbank', 'Teamziele freigeben',    'Teamziele für das Team sichtbar machen')
  ) v(recht, bereich, art, standard_manager, durchsetzung, titel, satz)
$$;

-- Der Katalog ist kein Endpunkt für Fremde (§2.3a: PostgREST stellt jede Funktion bereit, sobald die Rolle EXECUTE hat);
-- authenticated und service_role brauchen ihn für die Schranke unten (§2.7).
revoke execute on function public.rechte_katalog() from public, anon;
grant  execute on function public.rechte_katalog() to authenticated, service_role;

-- ── 3 · Spalte, Form-Schranke (§2.7: EXECUTE für jede Rolle, die die Zeile schreibt) ──────
alter table public.betrieb_mitglieder add column if not exists rechte jsonb not null default '{}'::jsonb;

create or replace function public.rechte_form_ok(p jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare k text; v jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 600 then return false; end if;
  for k, v in select key, value from jsonb_each(p) loop
    if jsonb_typeof(v) <> 'boolean' then return false; end if;
    if not exists (select 1 from public.rechte_katalog() c where c.recht = k) then return false; end if;
  end loop;
  return true;
end $$;
revoke execute on function public.rechte_form_ok(jsonb) from public, anon;
grant  execute on function public.rechte_form_ok(jsonb) to authenticated, service_role;

do $$ begin
  alter table public.betrieb_mitglieder add constraint betrieb_mitglieder_rechte_form check (public.rechte_form_ok(rechte));
exception when duplicate_object then null; end $$;

-- ── 4 · Wirksame Rechte (EINE Rechnung für hat_recht und für die Liste) ────────────────
create or replace function public.rechte_wirksam(p_rolle text, p_rechte jsonb)
returns jsonb language plpgsql immutable set search_path = public as $function$
declare r jsonb := '{}'::jsonb; k record; v boolean;
begin
  for k in select c.recht, c.standard_manager from public.rechte_katalog() c order by c.recht loop
    if p_rolle = 'inhaber' then
      v := true;
    elsif p_rolle = 'manager' then
      v := coalesce(case when jsonb_typeof(p_rechte -> k.recht) = 'boolean' then (p_rechte ->> k.recht)::boolean end, k.standard_manager);
    else
      v := false;                                   -- Team, Küche und alles Unbekannte: nie
    end if;
    r := r || jsonb_build_object(k.recht, v);
  end loop;
  -- Exportieren darf nur, wer die Daten auch sehen darf.
  if p_rolle = 'manager' and (r ->> 'finanz_export')::boolean and not (r ->> 'kosten_view')::boolean then
    r := r || jsonb_build_object('finanz_export', false);
  end if;
  return r;
end $function$;
revoke execute on function public.rechte_wirksam(text, jsonb) from public, anon;
grant  execute on function public.rechte_wirksam(text, jsonb) to authenticated;

-- hat_recht: Inhaber (mit PIN) und Master → ja. Sonst nur ein Manager dieses Betriebs, und nur, was ihm bleibt.
-- Gebaut aus ist_inhaber/meine_betriebe, also MIT PIN. Für Fremde: false, ohne zu verraten, ob es den Betrieb gibt.
create or replace function public.hat_recht(p_betrieb uuid, p_recht text)
returns boolean language plpgsql stable security definer set search_path = public as $function$
declare v_rolle text; v_rechte jsonb;
begin
  if p_betrieb is null or p_recht is null or auth.uid() is null then return false; end if;
  if public.ist_inhaber(p_betrieb) then
    return exists (select 1 from public.rechte_katalog() k where k.recht = p_recht);
  end if;
  if p_betrieb not in (select public.meine_betriebe()) then return false; end if;
  select m.rolle, m.rechte into v_rolle, v_rechte from public.betrieb_mitglieder m
   where m.betrieb_id = p_betrieb and m.nutzer_id = auth.uid() order by m.nutzer_id limit 1;
  if v_rolle is distinct from 'manager' then return false; end if;
  return coalesce((public.rechte_wirksam(v_rolle, v_rechte) ->> p_recht)::boolean, false);
end $function$;
revoke execute on function public.hat_recht(uuid, text) from public, anon;
grant  execute on function public.hat_recht(uuid, text) to authenticated;

-- Für die Seiten: meine Rolle und meine wirksamen Rechte in einem Aufruf.
create or replace function public.meine_rechte(p_betrieb uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $function$
declare v_rolle text; r jsonb := '{}'::jsonb; k record;
begin
  if auth.uid() is null then return jsonb_build_object('rolle', null, 'rechte', '{}'::jsonb); end if;
  v_rolle := public.meine_rolle(p_betrieb);
  for k in select c.recht from public.rechte_katalog() c order by c.recht loop
    r := r || jsonb_build_object(k.recht, public.hat_recht(p_betrieb, k.recht));
  end loop;
  return jsonb_build_object('rolle', v_rolle, 'rechte', r);
end $function$;
revoke execute on function public.meine_rechte(uuid) from public, anon;
grant  execute on function public.meine_rechte(uuid) to authenticated;

-- ── 5 · Rollenwechsel setzt die Rechte zurück (kein Recht „reist“ mit in eine andere Rolle) ──
create or replace function public.mitglied_rechte_wache()
returns trigger language plpgsql set search_path = public as $function$
begin
  if tg_op = 'INSERT' then
    if new.rolle is distinct from 'manager' then new.rechte := '{}'::jsonb; end if;
  elsif new.rolle is distinct from old.rolle then
    new.rechte := '{}'::jsonb;
  end if;
  return new;
end $function$;
revoke execute on function public.mitglied_rechte_wache() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'mitglied_rechte_wache' and tgrelid = 'public.betrieb_mitglieder'::regclass) then
    create trigger mitglied_rechte_wache before insert or update on public.betrieb_mitglieder
      for each row execute function public.mitglied_rechte_wache();
  end if;
end $$;

-- ── 6 · Rechte verwalten: nur der Inhaber, über Funktionen ──────────────────────────────
create table if not exists public.rechte_protokoll (
  id         bigint generated always as identity primary key,
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  von        uuid,
  ziel       uuid,
  recht      text not null,
  an         boolean not null,
  zeit       timestamptz not null default now()
);
alter table public.rechte_protokoll enable row level security;
revoke all on public.rechte_protokoll from anon, authenticated;     -- gelesen wird nur über team_rechte_verlauf()

create or replace function public.team_rechte_liste(p_betrieb uuid)
returns table (nutzer_id uuid, email text, anzeigename text, rolle text, ich boolean, eigene jsonb, rechte jsonb)
language plpgsql stable security definer set search_path = public as $function$
begin
  if not public.ist_inhaber(p_betrieb) then return; end if;
  return query
    select m.nutzer_id, u.email::text, m.anzeigename, m.rolle::text, (m.nutzer_id = auth.uid()),
           case when m.rolle = 'manager' then m.rechte else '{}'::jsonb end,
           public.rechte_wirksam(m.rolle, m.rechte)
      from public.betrieb_mitglieder m
      join auth.users u on u.id = m.nutzer_id
     where m.betrieb_id = p_betrieb
     order by case m.rolle when 'inhaber' then 0 when 'manager' then 1 when 'team' then 2 else 3 end, u.email, m.nutzer_id;
end $function$;

create or replace function public.team_rechte_setzen(p_betrieb uuid, p_nutzer uuid, p_recht text, p_an boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_rolle text; v_neu jsonb;
begin
  if p_an is null then return jsonb_build_object('ok', false, 'grund', 'wert'); end if;
  if auth.uid() is null or not public.ist_inhaber(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_inhaber'); end if;
  if not exists (select 1 from public.rechte_katalog() k where k.recht = p_recht) then
    return jsonb_build_object('ok', false, 'grund', 'recht_unbekannt');
  end if;
  select m.rolle into v_rolle from public.betrieb_mitglieder m where m.betrieb_id = p_betrieb and m.nutzer_id = p_nutzer;
  if not found then return jsonb_build_object('ok', false, 'grund', 'kein_mitglied'); end if;
  if p_nutzer = auth.uid() then return jsonb_build_object('ok', false, 'grund', 'selbst'); end if;
  if v_rolle is distinct from 'manager' then return jsonb_build_object('ok', false, 'grund', 'kein_manager'); end if;
  update public.betrieb_mitglieder set rechte = rechte || jsonb_build_object(p_recht, p_an)
   where betrieb_id = p_betrieb and nutzer_id = p_nutzer returning rechte into v_neu;
  insert into public.rechte_protokoll (betrieb_id, von, ziel, recht, an) values (p_betrieb, auth.uid(), p_nutzer, p_recht, p_an);
  return jsonb_build_object('ok', true, 'rechte', public.rechte_wirksam(v_rolle, v_neu), 'eigene', v_neu);
end $function$;

create or replace function public.team_rechte_verlauf(p_betrieb uuid)
returns table (zeit timestamptz, von_name text, ziel_name text, recht text, an boolean)
language plpgsql stable security definer set search_path = public as $function$
begin
  if not public.ist_inhaber(p_betrieb) then return; end if;
  return query
    select p.zeit, coalesce(mv.anzeigename, uv.email::text, 'Zentrale'), coalesce(mz.anzeigename, uz.email::text, 'entfernt'), p.recht, p.an
      from public.rechte_protokoll p
      left join public.betrieb_mitglieder mv on mv.betrieb_id = p.betrieb_id and mv.nutzer_id = p.von
      left join auth.users uv on uv.id = p.von
      left join public.betrieb_mitglieder mz on mz.betrieb_id = p.betrieb_id and mz.nutzer_id = p.ziel
      left join auth.users uz on uz.id = p.ziel
     where p.betrieb_id = p_betrieb
     order by p.zeit desc, p.id desc limit 50;
end $function$;

revoke execute on function public.team_rechte_liste(uuid)                  from public, anon;
revoke execute on function public.team_rechte_setzen(uuid, uuid, text, boolean) from public, anon;
revoke execute on function public.team_rechte_verlauf(uuid)                from public, anon;
grant  execute on function public.team_rechte_liste(uuid)                  to authenticated;
grant  execute on function public.team_rechte_setzen(uuid, uuid, text, boolean) to authenticated;
grant  execute on function public.team_rechte_verlauf(uuid)                to authenticated;

-- ── 7 · Teamziele: Fortschritt, Aufgaben, gemeinsame Erfolge (kein Geldfeld) ─────────────
create table if not exists public.team_ziele (
  id             uuid primary key default gen_random_uuid(),
  betrieb_id     uuid not null references public.betriebe(id) on delete cascade,
  titel          text not null check (length(btrim(titel)) between 1 and 80),
  beschreibung   text check (beschreibung is null or length(beschreibung) <= 300),
  frist          date,
  status         text not null default 'entwurf' check (status in ('entwurf', 'freigegeben', 'erreicht', 'archiviert')),
  angelegt       timestamptz not null default now(),
  angelegt_von   uuid,
  freigegeben_am timestamptz,
  freigegeben_von uuid,
  erreicht_am    timestamptz
);
create index if not exists team_ziele_betrieb on public.team_ziele (betrieb_id, status, angelegt desc, id);
create table if not exists public.team_aufgaben (
  id          uuid primary key default gen_random_uuid(),
  ziel_id     uuid not null references public.team_ziele(id) on delete cascade,
  pos         smallint not null,
  titel       text not null check (length(btrim(titel)) between 1 and 120),
  erledigt    boolean not null default false,
  erledigt_am timestamptz,
  erledigt_von uuid,
  unique (ziel_id, pos)
);
create table if not exists public.team_erfolge (
  id         bigint generated always as identity primary key,
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  ziel_id    uuid not null references public.team_ziele(id) on delete cascade,
  titel      text not null,
  zeit       timestamptz not null default now(),
  unique (ziel_id)
);
alter table public.team_ziele    enable row level security;
alter table public.team_aufgaben enable row level security;
alter table public.team_erfolge  enable row level security;
revoke all on public.team_ziele, public.team_aufgaben, public.team_erfolge from anon, authenticated;
grant select on public.team_ziele, public.team_aufgaben, public.team_erfolge to authenticated;

-- Lesen: Mitglieder sehen freigegebene und erreichte Ziele; Entwürfe nur, wer bearbeiten oder freigeben darf.
-- Schreiben gibt es nur über die Funktionen unten (kein INSERT/UPDATE/DELETE-Recht, keine Regel dafür).
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_ziele' and policyname = 'teamziele lesen') then
    create policy "teamziele lesen" on public.team_ziele for select to authenticated
      using (status <> 'archiviert' and betrieb_id in (select public.meine_betriebe())
             and (status in ('freigegeben', 'erreicht') or public.hat_recht(betrieb_id, 'ziele_edit') or public.hat_recht(betrieb_id, 'ziele_approve'))
             or public.ist_master());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_aufgaben' and policyname = 'teamaufgaben lesen') then
    create policy "teamaufgaben lesen" on public.team_aufgaben for select to authenticated
      using (exists (select 1 from public.team_ziele z where z.id = ziel_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_erfolge' and policyname = 'teamerfolge lesen') then
    create policy "teamerfolge lesen" on public.team_erfolge for select to authenticated
      using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
  end if;
end $$;

-- Intern: erreicht ↔ freigegeben nachziehen (nach Abhaken, Ändern der Aufgaben). Kein Aufruf von außen.
create or replace function public.teamziel_nachziehen(p_ziel uuid)
returns void language plpgsql volatile security definer set search_path = public as $function$
declare v_z public.team_ziele%rowtype; v_ges integer; v_off integer; v_n integer;
begin
  select * into v_z from public.team_ziele where id = p_ziel for update;
  if not found then return; end if;
  select count(*), count(*) filter (where not erledigt) into v_ges, v_off from public.team_aufgaben where ziel_id = p_ziel;
  if v_z.status = 'freigegeben' and v_ges > 0 and v_off = 0 then
    update public.team_ziele set status = 'erreicht', erreicht_am = now() where id = p_ziel;
    insert into public.team_erfolge (betrieb_id, ziel_id, titel) values (v_z.betrieb_id, p_ziel, v_z.titel) on conflict (ziel_id) do nothing;
  elsif v_z.status = 'erreicht' and v_off > 0 then
    update public.team_ziele set status = 'freigegeben', erreicht_am = null where id = p_ziel;
    with weg as (delete from public.team_erfolge where ziel_id = p_ziel returning 1) select count(*) into v_n from weg;
  end if;
end $function$;
revoke execute on function public.teamziel_nachziehen(uuid) from public, anon, authenticated;

create or replace function public.teamziel_speichern(p_betrieb uuid, p_ziel uuid, p_titel text, p_beschreibung text, p_frist date, p_aufgaben jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  v_titel text := btrim(coalesce(p_titel, '')); v_besch text := nullif(btrim(coalesce(p_beschreibung, '')), '');
  v_z public.team_ziele%rowtype; v_id uuid := p_ziel; e jsonb; i integer := 0; v_ids uuid[] := '{}'; v_aid uuid; v_n integer;
  v_t text;
begin
  if auth.uid() is null or not public.hat_recht(p_betrieb, 'ziele_edit') then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if length(v_titel) not between 1 and 80 then return jsonb_build_object('ok', false, 'grund', 'titel'); end if;
  if v_besch is not null and length(v_besch) > 300 then return jsonb_build_object('ok', false, 'grund', 'beschreibung'); end if;
  if p_frist is not null and (p_frist < date '2000-01-01' or p_frist > date '2100-01-01') then return jsonb_build_object('ok', false, 'grund', 'frist'); end if;
  if p_aufgaben is null or jsonb_typeof(p_aufgaben) <> 'array' or jsonb_array_length(p_aufgaben) > 12 then
    return jsonb_build_object('ok', false, 'grund', 'aufgaben');
  end if;
  -- Form jeder Aufgabe, und: eine mitgeschickte id muss zu DIESEM Ziel gehören.
  for e in select value from jsonb_array_elements(p_aufgaben) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'titel') <> 'string' or length(btrim(e ->> 'titel')) not between 1 and 120 then
      return jsonb_build_object('ok', false, 'grund', 'aufgaben');
    end if;
    if e ? 'id' and e ->> 'id' is not null then
      if (e ->> 'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or p_ziel is null
         or not exists (select 1 from public.team_aufgaben a where a.id = (e ->> 'id')::uuid and a.ziel_id = p_ziel) then
        return jsonb_build_object('ok', false, 'grund', 'aufgaben');
      end if;
    end if;
  end loop;
  if p_ziel is null then
    select count(*) into v_n from public.team_ziele where betrieb_id = p_betrieb and status <> 'archiviert';
    if v_n >= 20 then return jsonb_build_object('ok', false, 'grund', 'grenze'); end if;
    insert into public.team_ziele (betrieb_id, titel, beschreibung, frist, angelegt_von)
      values (p_betrieb, v_titel, v_besch, p_frist, auth.uid()) returning id into v_id;
  else
    select * into v_z from public.team_ziele where id = p_ziel and betrieb_id = p_betrieb for update;
    if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
    if v_z.status = 'archiviert' then return jsonb_build_object('ok', false, 'grund', 'archiviert'); end if;
    update public.team_ziele set titel = v_titel, beschreibung = v_besch, frist = p_frist where id = p_ziel;
    -- Wer nicht freigeben darf, schickt eine Änderung an einem freigegebenen Ziel zurück in die Freigabe.
    if v_z.status in ('freigegeben', 'erreicht') and not public.hat_recht(p_betrieb, 'ziele_approve') then
      update public.team_ziele set status = 'entwurf', freigegeben_am = null, freigegeben_von = null, erreicht_am = null where id = p_ziel;
      with weg as (delete from public.team_erfolge where ziel_id = p_ziel returning 1) select count(*) into v_n from weg;
    end if;
  end if;
  -- Aufgaben: vorhandene behalten ihren Stand (erledigt), neue kommen dazu, fehlende fallen weg.
  -- Zwei Durchgänge über pos, damit „unique (ziel_id, pos)“ beim Umordnen nie kollidiert.
  update public.team_aufgaben set pos = pos + 100 where ziel_id = v_id;
  for e in select value from jsonb_array_elements(p_aufgaben) loop
    i := i + 1;
    v_t := btrim(e ->> 'titel');
    if e ? 'id' and e ->> 'id' is not null then
      v_aid := (e ->> 'id')::uuid;
      update public.team_aufgaben set titel = v_t, pos = i where id = v_aid and ziel_id = v_id;
    else
      insert into public.team_aufgaben (ziel_id, pos, titel) values (v_id, i, v_t) returning id into v_aid;
    end if;
    v_ids := v_ids || v_aid;
  end loop;
  with weg as (delete from public.team_aufgaben where ziel_id = v_id and not (id = any (v_ids)) returning 1) select count(*) into v_n from weg;
  perform public.teamziel_nachziehen(v_id);
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;

create or replace function public.teamziel_freigeben(p_ziel uuid, p_an boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_z public.team_ziele%rowtype; v_n integer;
begin
  if p_an is null then return jsonb_build_object('ok', false, 'grund', 'wert'); end if;
  select * into v_z from public.team_ziele where id = p_ziel for update;
  if not found or auth.uid() is null or not public.hat_recht(v_z.betrieb_id, 'ziele_approve') then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  if v_z.status = 'archiviert' then return jsonb_build_object('ok', false, 'grund', 'archiviert'); end if;
  if p_an then
    select count(*) into v_n from public.team_aufgaben where ziel_id = p_ziel;
    if v_n = 0 then return jsonb_build_object('ok', false, 'grund', 'keine_aufgaben'); end if;
    if v_z.status = 'entwurf' then
      update public.team_ziele set status = 'freigegeben', freigegeben_am = now(), freigegeben_von = auth.uid() where id = p_ziel;
    end if;
  else
    update public.team_ziele set status = 'entwurf', freigegeben_am = null, freigegeben_von = null, erreicht_am = null where id = p_ziel;
    with weg as (delete from public.team_erfolge where ziel_id = p_ziel returning 1) select count(*) into v_n from weg;
  end if;
  perform public.teamziel_nachziehen(p_ziel);
  return jsonb_build_object('ok', true);
end $function$;

create or replace function public.teamziel_archivieren(p_ziel uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_b uuid;
begin
  select betrieb_id into v_b from public.team_ziele where id = p_ziel;
  if v_b is null or auth.uid() is null or not public.hat_recht(v_b, 'ziele_edit') then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  update public.team_ziele set status = 'archiviert' where id = p_ziel;
  return jsonb_build_object('ok', true);
end $function$;

-- Mitarbeiten darf jedes Mitglied des Betriebs — nur an freigegebenen Zielen, mit dem eigenen Konto als „erledigt von“.
create or replace function public.teamaufgabe_haken(p_aufgabe uuid, p_erledigt boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_a public.team_aufgaben%rowtype; v_z public.team_ziele%rowtype; v_ges integer; v_ok integer;
begin
  if p_erledigt is null then return jsonb_build_object('ok', false, 'grund', 'wert'); end if;
  select * into v_a from public.team_aufgaben where id = p_aufgabe;
  if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  select * into v_z from public.team_ziele where id = v_a.ziel_id for update;
  if auth.uid() is null or not (v_z.betrieb_id in (select public.meine_betriebe())) then return jsonb_build_object('ok', false, 'grund', 'kein_zugang'); end if;
  if v_z.status not in ('freigegeben', 'erreicht') then return jsonb_build_object('ok', false, 'grund', 'nicht_freigegeben'); end if;
  update public.team_aufgaben
     set erledigt = p_erledigt, erledigt_am = case when p_erledigt then now() end, erledigt_von = case when p_erledigt then auth.uid() end
   where id = p_aufgabe;
  perform public.teamziel_nachziehen(v_z.id);
  select count(*), count(*) filter (where erledigt) into v_ges, v_ok from public.team_aufgaben where ziel_id = v_z.id;
  return jsonb_build_object('ok', true, 'status', (select status from public.team_ziele where id = v_z.id), 'erledigt', v_ok, 'gesamt', v_ges);
end $function$;

-- Stand für „Team & Ziele“: ein Aufruf, nur was die Rolle sehen darf, Namen nur als Anzeigename (nie E-Mail).
create or replace function public.teamziele_stand(p_betrieb uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $function$
declare v_edit boolean; v_app boolean; v_ziele jsonb; v_erf jsonb;
begin
  if auth.uid() is null or not (p_betrieb in (select public.meine_betriebe()) or public.ist_master()) then
    return jsonb_build_object('ok', false, 'grund', 'kein_zugang');
  end if;
  v_edit := public.hat_recht(p_betrieb, 'ziele_edit');
  v_app  := public.hat_recht(p_betrieb, 'ziele_approve');
  select coalesce(jsonb_agg(z.j order by z.sort, z.id), '[]'::jsonb) into v_ziele from (
    select t.id, case t.status when 'entwurf' then 0 when 'freigegeben' then 1 else 2 end as sort,
           jsonb_build_object('id', t.id, 'titel', t.titel, 'beschreibung', t.beschreibung, 'frist', t.frist, 'status', t.status,
             'erledigt', (select count(*) from public.team_aufgaben a where a.ziel_id = t.id and a.erledigt),
             'gesamt',   (select count(*) from public.team_aufgaben a where a.ziel_id = t.id),
             'aufgaben', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'titel', a.titel, 'erledigt', a.erledigt,
                            'von', case when a.erledigt then coalesce(m.anzeigename, 'Team') end) order by a.pos)
                          from public.team_aufgaben a
                          left join public.betrieb_mitglieder m on m.betrieb_id = t.betrieb_id and m.nutzer_id = a.erledigt_von
                         where a.ziel_id = t.id), '[]'::jsonb)) as j
      from public.team_ziele t
     where t.betrieb_id = p_betrieb and t.status <> 'archiviert'
       and (t.status in ('freigegeben', 'erreicht') or v_edit or v_app)
  ) z;
  select coalesce(jsonb_agg(jsonb_build_object('titel', e.titel, 'zeit', e.zeit) order by e.zeit desc, e.id desc), '[]'::jsonb) into v_erf
    from (select * from public.team_erfolge where betrieb_id = p_betrieb order by zeit desc, id desc limit 20) e;
  return jsonb_build_object('ok', true, 'darf', jsonb_build_object('edit', v_edit, 'approve', v_app), 'ziele', v_ziele, 'erfolge', v_erf);
end $function$;

revoke execute on function public.teamziel_speichern(uuid, uuid, text, text, date, jsonb) from public, anon;
revoke execute on function public.teamziel_freigeben(uuid, boolean)  from public, anon;
revoke execute on function public.teamziel_archivieren(uuid)         from public, anon;
revoke execute on function public.teamaufgabe_haken(uuid, boolean)   from public, anon;
revoke execute on function public.teamziele_stand(uuid)              from public, anon;
grant  execute on function public.teamziel_speichern(uuid, uuid, text, text, date, jsonb) to authenticated;
grant  execute on function public.teamziel_freigeben(uuid, boolean)  to authenticated;
grant  execute on function public.teamziel_archivieren(uuid)         to authenticated;
grant  execute on function public.teamaufgabe_haken(uuid, boolean)   to authenticated;
grant  execute on function public.teamziele_stand(uuid)              to authenticated;

-- ── 8 · Finanzexport: Einkaufsbelege, nur mit Recht — als Antwort, nicht als Ausnahme ───────
create or replace function public.finanz_export_belege(p_betrieb uuid, p_von date, p_bis date)
returns jsonb language plpgsql stable security definer set search_path = public as $function$
declare v jsonb;
begin
  if auth.uid() is null or not public.hat_recht(p_betrieb, 'finanz_export') then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  if p_von is null or p_bis is null or p_von > p_bis or p_bis - p_von > 400 then
    return jsonb_build_object('ok', false, 'grund', 'zeitraum');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('belegdatum', b.belegdatum, 'belegnummer', b.belegnummer, 'lieferant', l.name,
           'netto', b.netto, 'steuer', b.steuer, 'brutto', b.brutto, 'status', b.status) order by b.belegdatum, b.id), '[]'::jsonb)
    into v
    from (select * from public.einkaufsbelege e
           where e.betrieb_id = p_betrieb and e.belegdatum between p_von and p_bis and e.status in ('freigegeben', 'storniert')
           order by e.belegdatum, e.id limit 5000) b
    left join public.lieferanten l on l.id = b.lieferant_id;
  return jsonb_build_object('ok', true, 'zeilen', v);
end $function$;
revoke execute on function public.finanz_export_belege(uuid, date, date) from public, anon;
grant  execute on function public.finanz_export_belege(uuid, date, date) to authenticated;

commit;

-- ── PROBE (zurückgedreht) — die vollständige, mit echten Konten: pruefungen/pruef-zugriffsrechte-lokal.sh ──
--   Nach dem Einspielen live ZUSÄTZLICH lesen (nicht „success“ glauben, §2.3c/§2.1):
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.betrieb_mitglieder'::regclass and contype='c';
--   select p.proname, count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.proname in ('hat_recht','meine_rechte','rechte_wirksam','team_rechte_setzen',
--          'team_rechte_liste','team_rechte_verlauf','teamziel_speichern','teamziel_freigeben','teamziel_archivieren',
--          'teamaufgabe_haken','teamziele_stand','finanz_export_belege') group by 1 having count(*) <> 1;   -- muss leer sein
--   select has_function_privilege('anon','public.hat_recht(uuid,text)','execute');                       -- muss false sein
