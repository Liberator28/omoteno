-- ═══════════════════════════════════════════════════════════════════
--  migration-teammodus.sql · Team-Modus: Bestellungen gerecht verteilen
--
--  Wunsch (11.10.): „… als Button die Funktion, dass man in den Team-
--  Modus schaltet, dann werden Bestellungen den jeweiligen Team-
--  Mitgliedern zugewiesen und gerecht aufgeteilt. Entweder zufällig
--  aufgeteilt oder man kann zuweisen. Dafür muss man, wenn ein Betrieb
--  mehrere Geräte hat, auch Nutzer-Nummern haben.“
--
--  WIE:
--   · betrieb_mitglieder.nummer — 1…99, eindeutig je Betrieb. Vorhandene
--     Mitglieder werden durchnummeriert (Inhaber zuerst), neue bekommen
--     beim Eintragen die nächste freie Nummer. Der Besitzer ändert sie
--     über team_nummer_setzen().
--   · betriebe.team_modus — {an, art: fair|zufall|hand, dienst:[Nummern]}.
--     Schreibt nur der Inhaber (die Wache betrieb_rolle_wache lässt dem
--     Team nur die Bestellpause, migration-rollen.sql).
--   · bestellungen.zugewiesen — Nummer des Zuständigen, null = niemand.
--     Gesetzt beim Einfügen von der Datenbank (Trigger), damit zwei
--     Geräte nie verschieden verteilen. Das Team ändert sie direkt wie
--     den Status.
--   · Die Verteilung darf eine Bestellung NIE aufhalten (§7): Alles im
--     Trigger steht in einem Ausnahmeblock; schlägt etwas fehl, bleibt
--     zugewiesen = null und die Bestellung geht durch.
--   · „Gerecht“ = wer im Dienst die wenigsten offenen Bestellungen
--     (neu/arbeit, letzte 12 h) hat; Gleichstand → kleinste Nummer
--     (§2.6: eindeutiger Notnagel). „Zufällig“ = zufällig unter den
--     Diensthabenden. „Von Hand“ = keine Automatik.
--   · team_nummern(p_betrieb): Nummer und Name für JEDES Mitglied des
--     Betriebs — Team-Geräte brauchen die Namen auf den Karten,
--     team_liste() ist nur für den Inhaber.
--
--  Additiv (§2.5). Kein drop, kein delete (§2.8).
--
--  NICHT LIVE GEPRÜFT: Der Supabase-Zugang war am 11.10. getrennt
--  (ERR_PROXY_TUNNEL). Im lokalen Postgres 16 gegen das Modell
--  datenbank/modell-lokal-pin.sql gefahren (Probe unten, Ergebnis im
--  Kopf von pruefungen/pruef-bestellkarten.js). Im SQL-Editor einspielen,
--  danach die Probe am Ende; vorher die Spalten von betrieb_mitglieder
--  nachsehen (§1.1a) — gibt es „nummer“ schon, NICHT einspielen.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Nummer je Mitglied ─────────────────────────────────────────
alter table public.betrieb_mitglieder add column if not exists nummer smallint;
do $$ begin
  alter table public.betrieb_mitglieder
    add constraint betrieb_mitglieder_nummer check (nummer is null or nummer between 1 and 99);
exception when duplicate_object then null; end $$;
create unique index if not exists betrieb_mitglieder_nummer_eindeutig
  on public.betrieb_mitglieder (betrieb_id, nummer) where nummer is not null;

update public.betrieb_mitglieder m
   set nummer = x.n
  from (select m2.betrieb_id, m2.nutzer_id,
               coalesce((select max(m3.nummer) from public.betrieb_mitglieder m3 where m3.betrieb_id = m2.betrieb_id), 0)
               + row_number() over (partition by m2.betrieb_id
                                    order by case m2.rolle when 'inhaber' then 0 when 'team' then 1 else 2 end, m2.nutzer_id) as n
          from public.betrieb_mitglieder m2
         where m2.nummer is null) x
 where m.betrieb_id = x.betrieb_id and m.nutzer_id = x.nutzer_id and m.nummer is null and x.n <= 99;

create or replace function public.mitglied_nummer_vergeben()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if new.nummer is null then
    select min(z) into new.nummer
      from generate_series(1, 99) z
     where not exists (select 1 from public.betrieb_mitglieder m where m.betrieb_id = new.betrieb_id and m.nummer = z);
  end if;
  return new;
end $function$;
revoke execute on function public.mitglied_nummer_vergeben() from public, anon, authenticated;
do $$ begin
  create trigger mitglied_nummer_vergeben before insert on public.betrieb_mitglieder
    for each row execute function public.mitglied_nummer_vergeben();
exception when duplicate_object then null; end $$;

-- ── 2 · Modus am Betrieb, Zuständiger an der Bestellung ─────────────
alter table public.betriebe     add column if not exists team_modus jsonb;
alter table public.bestellungen add column if not exists zugewiesen smallint;
do $$ begin
  alter table public.betriebe add constraint betriebe_team_modus_form check (
    team_modus is null or (
      jsonb_typeof(team_modus) = 'object'
      and octet_length(team_modus::text) < 1000
      and coalesce(team_modus ->> 'art', 'fair') in ('fair', 'zufall', 'hand')
      and (team_modus -> 'dienst' is null or jsonb_typeof(team_modus -> 'dienst') = 'array')));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.bestellungen add constraint bestellungen_zugewiesen_bereich check (zugewiesen is null or zugewiesen between 1 and 99);
exception when duplicate_object then null; end $$;

-- Gäste lesen weder Modus noch Zuständigen (Muster migration-auswertung-ziele.sql).
revoke select (team_modus), update (team_modus) on public.betriebe from anon;
grant  select (team_modus), update (team_modus) on public.betriebe to authenticated;
revoke select (zugewiesen), update (zugewiesen) on public.bestellungen from anon;
grant  select (zugewiesen), update (zugewiesen) on public.bestellungen to authenticated;
grant  select (nummer) on public.betrieb_mitglieder to authenticated;

-- ── 3 · Verteilen beim Einfügen ─────────────────────────────────────
create or replace function public.bestellung_verteilen()
returns trigger language plpgsql security definer set search_path = public as $function$
declare
  v_modus jsonb;
  v_dienst smallint[];
begin
  if new.zugewiesen is not null then return new; end if;
  begin
    select team_modus into v_modus from public.betriebe where id = new.betrieb_id;
    if v_modus is null or coalesce((v_modus ->> 'an')::boolean, false) is not true
       or coalesce(v_modus ->> 'art', 'fair') = 'hand' then
      return new;
    end if;
    -- Nur Nummern, die es im Betrieb wirklich gibt.
    select array_agg(m.nummer order by m.nummer) into v_dienst
      from public.betrieb_mitglieder m
     where m.betrieb_id = new.betrieb_id and m.nummer is not null
       and m.nummer::text in (select jsonb_array_elements_text(coalesce(v_modus -> 'dienst', '[]'::jsonb)));
    if v_dienst is null or array_length(v_dienst, 1) is null then return new; end if;
    if v_modus ->> 'art' = 'zufall' then
      new.zugewiesen := v_dienst[1 + floor(random() * array_length(v_dienst, 1))::int];
    else
      select d.nr into new.zugewiesen
        from unnest(v_dienst) as d(nr)
        left join public.bestellungen b
          on b.betrieb_id = new.betrieb_id and b.zugewiesen = d.nr
         and b.status in ('neu', 'arbeit') and b.zeitpunkt > now() - interval '12 hours'
       group by d.nr
       order by count(b.id), d.nr
       limit 1;
    end if;
  exception when others then
    new.zugewiesen := null;   -- §7: die Bestellung geht immer durch
  end;
  return new;
end $function$;
revoke execute on function public.bestellung_verteilen() from public, anon, authenticated;
do $$ begin
  create trigger bestellung_verteilen before insert on public.bestellungen
    for each row execute function public.bestellung_verteilen();
exception when duplicate_object then null; end $$;

-- ── 4 · Namen und Nummern für die Geräte des Betriebs ──────────────
create or replace function public.team_nummern(p_betrieb uuid)
returns table (nummer smallint, name text, rolle text, ich boolean)
language sql stable security definer set search_path = public as $function$
  select m.nummer, coalesce(nullif(btrim(m.anzeigename), ''), 'Nr. ' || m.nummer), m.rolle::text, (m.nutzer_id = auth.uid())
    from public.betrieb_mitglieder m
   where m.betrieb_id = p_betrieb and m.nummer is not null
     and (p_betrieb in (select public.meine_betriebe()) or public.ist_master())
   order by m.nummer, m.nutzer_id;
$function$;
revoke execute on function public.team_nummern(uuid) from public, anon;
grant  execute on function public.team_nummern(uuid) to authenticated;

-- Der Besitzer ändert eine Nummer. Antwort statt Ausnahme (§2.3g).
create or replace function public.team_nummer_setzen(p_betrieb uuid, p_alt smallint, p_neu smallint)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare n integer;
begin
  if not public.ist_inhaber(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_inhaber'); end if;
  if p_neu is null or p_neu < 1 or p_neu > 99 then return jsonb_build_object('ok', false, 'grund', 'bereich'); end if;
  if exists (select 1 from public.betrieb_mitglieder where betrieb_id = p_betrieb and nummer = p_neu) then
    return jsonb_build_object('ok', false, 'grund', 'vergeben');
  end if;
  update public.betrieb_mitglieder set nummer = p_neu where betrieb_id = p_betrieb and nummer = p_alt;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  return jsonb_build_object('ok', true);
end $function$;
revoke execute on function public.team_nummer_setzen(uuid, smallint, smallint) from public, anon;
grant  execute on function public.team_nummer_setzen(uuid, smallint, smallint) to authenticated;

-- ── PROBE (im SQL-Editor, dreht sich selbst zurück; Zeilenzahl statt
--    Ausnahme §2.3b; eine Fassung je Funktion §2.1) ──
-- begin;
-- create temp table probe(schritt text, ergebnis text);
-- do $$
-- declare b uuid := (select id from public.betriebe order by id limit 1);
--         nrs smallint[]; i int; v text;
-- begin
--   select array_agg(nummer order by nummer) into nrs from public.betrieb_mitglieder where betrieb_id = b;
--   insert into probe values ('Nummern', coalesce(nrs::text, 'keine'));
--   update public.betriebe set team_modus = jsonb_build_object('an', true, 'art', 'fair', 'dienst', to_jsonb(nrs)) where id = b;
--   update public.bestellungen set status = 'fertig' where betrieb_id = b and status in ('neu','arbeit');
--   for i in 1..(2 * coalesce(array_length(nrs, 1), 0)) loop
--     insert into public.bestellungen (betrieb_id, quelle, status, positionen, summe) values (b, 'tisch', 'neu', '[]', 0);
--   end loop;
--   select string_agg(zugewiesen || ':' || c, ' ' order by zugewiesen) into v
--     from (select zugewiesen, count(*) c from public.bestellungen where betrieb_id = b and status = 'neu' group by 1) x;
--   insert into probe values ('fair, je zwei', v);
--   update public.betriebe set team_modus = '{"an":true,"art":"hand"}' where id = b;
--   insert into public.bestellungen (betrieb_id, quelle, status, positionen, summe) values (b, 'tisch', 'neu', '[]', 0);
--   insert into probe values ('hand → null', (select (zugewiesen is null)::text from public.bestellungen where betrieb_id = b order by zeitpunkt desc, id desc limit 1));
--   update public.betriebe set name = name where id = b;
--   insert into probe values ('andere Spalte', 'ok');
-- end $$;
-- select * from probe;
-- rollback;
--   Erwartet: die Nummern · je Nummer „:2“ · hand → null true · ok.
--   Danach: select proname, pg_get_function_identity_arguments(oid) from pg_proc
--           where proname in ('team_nummern','team_nummer_setzen','bestellung_verteilen');  -- je eine Zeile
