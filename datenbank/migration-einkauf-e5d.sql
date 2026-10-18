-- ═══════════════════════════════════════════════════════════════════
--  ENTWURF 17.10. — NOCH NICHT EINGESPIELT.
--  Zurückgedrehter Trockenlauf live (Supabase quxwweuvdqtjsdwgjdrh):
--  fehlerfrei; 6 Protokoll-Trigger angelegt, die Wächter „periode_zu“
--  stehen in beleg_freigeben, beleg_stornieren und inventur_buchen.
--  Vor dem Einspielen: Seite (einkauf.html, konto.html), team-zugang und
--  die zurückgedrehte Probe datenbank/pruef-einkauf-e5d.sql.
-- ═══════════════════════════════════════════════════════════════════
--  migration-einkauf-e5d.sql · Rechte, Nachvollziehbarkeit, feste Zahlen
--
--  Wunsch (17.10., E5): „Mehrere Standorte sollen sich zuverlässig
--  verwalten lassen.“ Dieser Block:
--
--  19 · Recht „darf_lager“ je Mitglied. Bisher durfte nur der Inhaber
--       zählen, Verlust buchen und Umlagerungen anlegen/annehmen — das
--       Personal am Lager konnte es nicht. Das Recht hängt an EINER
--       Stelle (darf_lager_buchen, E5-B); alle sechs Funktionen fragen
--       sie. Gesetzt wird es nur über die Edge Function team-zugang
--       (Inhaber, Service-Rolle).
--       Befund dabei (§2.3f): authenticated hatte INSERT/UPDATE/DELETE
--       auf betrieb_mitglieder. RLS kennt nur eine Lese-Regel — heute
--       0 Zeilen, aber ein Mitarbeiter, dessen Zeile je eine Schreib-
--       Regel bekäme, könnte sich darf_lager/darf_gutscheine selbst
--       geben. Kein Browser schreibt dort (gesucht: admin, konto,
--       einkauf, kueche, master — nur select). Das GRANT wird auf
--       SELECT gekürzt.
--  20 · Protokoll auch für Artikel, Lieferanten, Inventur, Verlust,
--       Umlagerung und Monatsabschluss. Artikel und Lieferanten gehören
--       der Kette: eine Zeile je Standort, damit jeder Inhaber sieht,
--       wer die gemeinsamen Stammdaten änderte. Umlagerung: Absender UND
--       Empfänger. Jeder alte Wert der Schranke bleibt (§2.3c).
--  21 · Monatsabschluss je Standort. Ein geschlossener Monat nimmt keine
--       Freigabe, kein Storno und keine Inventur mit Stichtag darin an
--       (Grund „periode_zu“) — die Zahlen alter Berichte bleiben fest.
--       Schließen nur vergangene Monate; öffnen nur der Inhaber, beides
--       im Protokoll. Verlust und Umlagerung buchen immer „jetzt“ und
--       treffen nie einen geschlossenen Monat.
--  22 · Vergleich zum Stichtag: der Lagerwert in zentrale_vergleich war
--       immer der HEUTIGE (lagerbestand), auch für „Letzter Monat“.
--       Jetzt: Summe der Bewegungen bis p_bis. Gleiche Signatur (§2.1).
--
--  Additiv (§2.5). Keine Zeile beginnt mit drop oder delete (§2.8).
--  Eingriffe in lange Live-Funktionen per DO-Block an genau einer
--  Stelle — fehlt die Stelle, bricht die Migration laut ab, statt still
--  nichts zu ändern.
-- ═══════════════════════════════════════════════════════════════════

-- ── 19 · darf_lager ──────────────────────────────────────────────────
alter table public.betrieb_mitglieder add column if not exists darf_lager boolean not null default false;
revoke insert, update, delete, truncate, references, trigger on public.betrieb_mitglieder from authenticated, anon;

create or replace function public.darf_lager_buchen(p_betrieb uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ist_inhaber(p_betrieb)
      or exists (select 1 from public.betrieb_mitglieder m
                  where m.betrieb_id = p_betrieb and m.nutzer_id = auth.uid() and m.darf_lager
                    and p_betrieb in (select public.meine_betriebe()));
$$;

-- Für „Dein Team“ in konto.html: team_liste() ändert ihre Rückgabe nicht
-- (das hieße drop + create); das neue Recht kommt aus einer eigenen Funktion.
create or replace function public.team_lagerrechte(p_betrieb uuid)
returns table(nutzer_id uuid, darf_lager boolean) language sql stable security definer set search_path = public as $$
  select m.nutzer_id, m.darf_lager from public.betrieb_mitglieder m
   where m.betrieb_id = p_betrieb and public.ist_inhaber(p_betrieb)
   order by m.nutzer_id;
$$;
revoke execute on function public.team_lagerrechte(uuid) from public, anon;
grant execute on function public.team_lagerrechte(uuid) to authenticated;

-- Die Seite fragt, ob das angemeldete Konto im Lager buchen darf.
create or replace function public.mein_lagerrecht(p_betrieb uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.darf_lager_buchen(p_betrieb);
$$;
revoke execute on function public.mein_lagerrecht(uuid) from public, anon;
grant execute on function public.mein_lagerrecht(uuid) to authenticated;

-- ── 21 · Monatsabschluss ─────────────────────────────────────────────
create table if not exists public.einkauf_perioden (
  betrieb_id    uuid not null references public.betriebe(id) on delete cascade,
  monat         date not null,
  geschlossen   boolean not null default true,
  geaendert     timestamptz not null default now(),
  geaendert_von uuid,
  primary key (betrieb_id, monat),
  constraint einkauf_perioden_monat check (monat = date_trunc('month', monat)::date)
);
alter table public.einkauf_perioden enable row level security;
revoke all on public.einkauf_perioden from public, anon, authenticated;
grant select on public.einkauf_perioden to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'einkauf_perioden' and policyname = 'einkauf_perioden_lesen') then
    create policy einkauf_perioden_lesen on public.einkauf_perioden for select to authenticated
      using (betrieb_id in (select public.meine_betriebe()));
  end if;
end $$;

create or replace function public.periode_zu(p_betrieb uuid, p_tag date)
returns boolean language sql stable security definer set search_path = public as $$
  select p_tag is not null and exists (select 1 from public.einkauf_perioden p
    where p.betrieb_id = p_betrieb and p.monat = date_trunc('month', p_tag)::date and p.geschlossen);
$$;
revoke execute on function public.periode_zu(uuid, date) from public, anon, authenticated;

create or replace function public.periode_schliessen(p_betrieb uuid, p_monat date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_monat date := date_trunc('month', p_monat)::date;
        v_jetzt date := date_trunc('month', (now() at time zone 'Europe/Berlin'))::date;
begin
  if p_betrieb is null or not public.ist_inhaber(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if v_monat is null or v_monat >= v_jetzt then return jsonb_build_object('ok', false, 'grund', 'zukunft'); end if;
  if v_monat < v_jetzt - interval '24 months' then return jsonb_build_object('ok', false, 'grund', 'zu_alt'); end if;
  insert into public.einkauf_perioden (betrieb_id, monat, geschlossen, geaendert, geaendert_von)
  values (p_betrieb, v_monat, true, now(), auth.uid())
  on conflict (betrieb_id, monat) do update set geschlossen = true, geaendert = now(), geaendert_von = auth.uid()
   where public.einkauf_perioden.geschlossen is distinct from true;
  return jsonb_build_object('ok', true, 'monat', v_monat,
    'entwuerfe', (select count(*) from public.einkaufsbelege e where e.betrieb_id = p_betrieb and e.status = 'entwurf'
                    and e.belegdatum >= v_monat and e.belegdatum < v_monat + interval '1 month'));
end $$;

create or replace function public.periode_oeffnen(p_betrieb uuid, p_monat date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_monat date := date_trunc('month', p_monat)::date; n int;
begin
  if p_betrieb is null or not public.ist_inhaber(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  update public.einkauf_perioden set geschlossen = false, geaendert = now(), geaendert_von = auth.uid()
   where betrieb_id = p_betrieb and monat = v_monat and geschlossen;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'grund', 'nicht_geschlossen'); end if;
  return jsonb_build_object('ok', true, 'monat', v_monat);
end $$;

revoke execute on function public.periode_schliessen(uuid, date) from public, anon;
revoke execute on function public.periode_oeffnen(uuid, date) from public, anon;
grant execute on function public.periode_schliessen(uuid, date) to authenticated;
grant execute on function public.periode_oeffnen(uuid, date) to authenticated;

-- Wächter in den drei Funktionen, die ein Datum in der Vergangenheit buchen.
do $$
declare d text; a text; g text;
begin
  d := pg_get_functiondef('public.beleg_freigeben(uuid)'::regprocedure);
  if position('periode_zu' in d) = 0 then
    a := $a$if b.status <> 'entwurf' then return jsonb_build_object('ok', false, 'grund', 'nicht_entwurf'); end if;$a$;
    g := $g$
  if public.periode_zu(b.betrieb_id, b.belegdatum) then return jsonb_build_object('ok', false, 'grund', 'periode_zu'); end if;$g$;
    if position(a in d) = 0 then raise exception 'beleg_freigeben: Stelle nicht gefunden'; end if;
    execute replace(d, a, a || g);
  end if;

  d := pg_get_functiondef('public.beleg_stornieren(uuid)'::regprocedure);
  if position('periode_zu' in d) = 0 then
    a := $a$if b.status <> 'freigegeben' then return jsonb_build_object('ok', false, 'grund', 'nicht_freigegeben'); end if;$a$;
    g := $g$
  if public.periode_zu(b.betrieb_id, b.belegdatum) then return jsonb_build_object('ok', false, 'grund', 'periode_zu'); end if;$g$;
    if position(a in d) = 0 then raise exception 'beleg_stornieren: Stelle nicht gefunden'; end if;
    execute replace(d, a, a || g);
  end if;

  d := pg_get_functiondef('public.inventur_buchen(uuid,jsonb,text,timestamptz)'::regprocedure);
  if position('periode_zu' in d) = 0 then
    a := $a$return jsonb_build_object('ok', false, 'grund', 'stichtag');
  end if;$a$;
    g := $g$
  if public.periode_zu(p_betrieb, (v_zeit at time zone 'Europe/Berlin')::date) then return jsonb_build_object('ok', false, 'grund', 'periode_zu'); end if;$g$;
    if position(a in d) = 0 then raise exception 'inventur_buchen: Stelle nicht gefunden'; end if;
    execute replace(d, a, a || g);
  end if;
end $$;

-- ── 22 · Lagerwert zum Stichtag ──────────────────────────────────────
create or replace function public.zentrale_vergleich(p_org uuid, p_von timestamp with time zone, p_bis timestamp with time zone)
 returns table(betrieb_id uuid, name text, einkauf_netto numeric, belege integer, lagerwert numeric, verlust_wert numeric, inventur_wert numeric, umsatz_brutto numeric, wareneinsatz numeric, umsatz_mit_rezeptur numeric, ohne_rezeptur integer, gerichte integer, mit_rezeptur integer)
 language sql stable security definer set search_path = public as $function$
  select b.id, b.name,
         coalesce((select sum(e.netto) from public.einkaufsbelege e where e.betrieb_id = b.id and e.status = 'freigegeben'
                    and e.belegdatum >= (p_von at time zone 'Europe/Berlin')::date and e.belegdatum <= (p_bis at time zone 'Europe/Berlin')::date), 0),
         (select count(*)::int from public.einkaufsbelege e where e.betrieb_id = b.id and e.status = 'freigegeben'
                    and e.belegdatum >= (p_von at time zone 'Europe/Berlin')::date and e.belegdatum <= (p_bis at time zone 'Europe/Berlin')::date),
         /* Lagerwert ZUM STICHTAG: alle Bewegungen bis p_bis (vorher: der heutige Bestand). */
         coalesce((select sum(coalesce(w.wert_netto, 0)) from public.lagerbewegungen w where w.betrieb_id = b.id and w.zeitpunkt < p_bis), 0),
         coalesce((select sum(w.wert_netto) from public.lagerbewegungen w where w.betrieb_id = b.id and w.art = 'verlust' and w.zeitpunkt >= p_von and w.zeitpunkt < p_bis), 0),
         coalesce((select sum(w.wert_netto) from public.lagerbewegungen w where w.betrieb_id = b.id and w.art = 'inventur' and w.zeitpunkt >= p_von and w.zeitpunkt < p_bis), 0),
         (x.we ->> 'umsatz_brutto')::numeric, (x.we ->> 'wareneinsatz')::numeric, (x.we ->> 'umsatz_mit_rezeptur')::numeric, (x.we ->> 'ohne_rezeptur')::int,
         (select count(*)::int from public.gerichte g where g.betrieb_id = b.id),
         (select count(distinct r.gericht_id)::int from public.rezepturen r where r.betrieb_id = b.id)
    from public.betriebe b
    cross join lateral (select public.wareneinsatz_theoretisch(b.id, p_von, p_bis) as we) x
   where b.organisation_id = p_org and public.darf_vergleichen_org(p_org)
     and p_von is not null and p_bis is not null and p_bis > p_von and p_bis - p_von <= interval '400 days'
   order by b.name, b.id;
$function$;

-- ── 20 · Protokoll für den Einkauf ───────────────────────────────────
alter table public.protokoll drop constraint protokoll_tabelle_check, add constraint protokoll_tabelle_check check (tabelle = any (array[
  'betriebe','gerichte','aktionen','gutscheine','rabattcodes','team','einkaufsbelege',
  'artikel','lieferanten','inventuren','lagerbewegungen','umlagerungen','einkauf_perioden']));

create or replace function public.protokoll_einkauf()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_alt    jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_neu    jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_zeile  jsonb := coalesce(v_neu, v_alt);
  v_ruhig  text[] := array['geaendert','angelegt'];
  v_felder text[];
  v_ziel   text;
  v_betriebe uuid[];
begin
  if v_uid is null then return null; end if;
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_felder
      from jsonb_each(v_neu) n where n.value is distinct from v_alt->n.key and n.key <> all(v_ruhig);
    if v_felder is null then return null; end if;
  end if;
  if tg_table_name in ('artikel', 'lieferanten') then
    select array_agg(b.id order by b.id) into v_betriebe from public.betriebe b where b.organisation_id = (v_zeile->>'organisation_id')::uuid;
    v_ziel := v_zeile->>'name';
  elsif tg_table_name = 'umlagerungen' then
    v_betriebe := array[(v_zeile->>'von_betrieb')::uuid, (v_zeile->>'nach_betrieb')::uuid];
    v_ziel := 'Umlagerung';
  elsif tg_table_name = 'lagerbewegungen' then
    v_betriebe := array[(v_zeile->>'betrieb_id')::uuid];
    v_ziel := (select a.name from public.artikel a where a.id = (v_zeile->>'artikel_id')::uuid);
  elsif tg_table_name = 'einkauf_perioden' then
    v_betriebe := array[(v_zeile->>'betrieb_id')::uuid];
    v_ziel := to_char((v_zeile->>'monat')::date, 'MM.YYYY');
  else
    v_betriebe := array[(v_zeile->>'betrieb_id')::uuid];
    v_ziel := 'Inventur';
  end if;
  insert into public.protokoll (betrieb_id, nutzer_id, tabelle, art, ziel, felder, vorher, nachher)
  select bid, v_uid, tg_table_name,
         case tg_op when 'INSERT' then 'neu' when 'DELETE' then 'geloescht' else 'geaendert' end,
         left(v_ziel, 120), coalesce(v_felder, '{}'),
         case when tg_op = 'UPDATE' then (select jsonb_object_agg(f, public.protokoll_kurz(v_alt->f)) from unnest(v_felder) f) end,
         case when tg_op = 'UPDATE' then (select jsonb_object_agg(f, public.protokoll_kurz(v_neu->f)) from unnest(v_felder) f) end
    from unnest(v_betriebe) bid where bid is not null;
  return null;
end $$;
revoke execute on function public.protokoll_einkauf() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'protokoll_artikel') then
    create trigger protokoll_artikel after insert or update on public.artikel for each row execute function public.protokoll_einkauf();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'protokoll_lieferanten') then
    create trigger protokoll_lieferanten after insert or update on public.lieferanten for each row execute function public.protokoll_einkauf();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'protokoll_inventuren') then
    create trigger protokoll_inventuren after insert on public.inventuren for each row execute function public.protokoll_einkauf();
  end if;
  -- Nur Verluste: Eingänge, Storno und Inventurdifferenzen stehen schon über Beleg/Inventur im Protokoll.
  if not exists (select 1 from pg_trigger where tgname = 'protokoll_verlust') then
    create trigger protokoll_verlust after insert on public.lagerbewegungen for each row when (new.art = 'verlust') execute function public.protokoll_einkauf();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'protokoll_umlagerungen') then
    create trigger protokoll_umlagerungen after insert or update on public.umlagerungen for each row execute function public.protokoll_einkauf();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'protokoll_perioden') then
    create trigger protokoll_perioden after insert or update on public.einkauf_perioden for each row execute function public.protokoll_einkauf();
  end if;
end $$;
