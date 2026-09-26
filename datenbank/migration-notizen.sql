-- ═══════════════════════════════════════════════════════════════════
--  NOTIZEN · Anmerkungen des Teams zu Bestellungen und Reservierungen
--
--  Auftrag (26.09.): Mitarbeiter schreiben im Board und in der Küche
--  Anmerkungen zu einer Bestellung oder Reservierung. Vorher wählen
--  sie, an wen: nur ans Team, oder an den Gast. Der Gast sieht eine
--  Nachricht erst nach DOPPELTER Bestätigung, damit nichts Falsches
--  hinausgeht; bearbeiten bleibt jederzeit möglich.
--
--  WIE „DOPPELT" HIER GEBAUT IST
--  ─────────────────────────────
--  Der Gast liest nie die Spalte text, sondern gesendet_text — eine
--  Abschrift, die NUR notiz_senden() schreibt. notiz_senden() verlangt
--  den Text, den die zweite Stufe im Board angezeigt hat, und vergleicht
--  ihn mit dem gespeicherten. Weicht er ab (jemand hat dazwischen
--  geändert, ein zweites Gerät hat gespeichert), wird NICHT gesendet.
--  Wer eine gesendete Nachricht bearbeitet, ändert zunächst nur text;
--  der Gast sieht weiter die alte Fassung, bis wieder zweimal bestätigt
--  ist. Das Team kann gesendet_* nicht direkt schreiben (Spaltenrechte).
--
--  Der Gast erreicht seine Nachrichten nur über Funktionen, die die
--  Nummer seiner eigenen Bestellung/Reservierung verlangen (eine UUID,
--  die nur sein Gerät kennt) — nie über die Tabelle.
--
--  Dazu reservierung_anfragen(): Bisher schrieb der Hub direkt in
--  reservierungen und bekam keine Nummer zurück (return=minimal, kein
--  Leserecht). Ohne Nummer kann der Gast weder den Stand seiner
--  Anfrage sehen noch eine Nachricht dazu. Der direkte Weg bleibt
--  VORERST offen, damit ausgelieferte Hubs weiter reservieren können
--  (§2.5) — geschlossen wird er in migration-missbrauch.sql, erst wenn
--  der neue Hub ausgeliefert ist.
--
--  ANGEWENDET: 26.09.2026 (apply_migration „notizen"), vorher als
--  zurückgedrehter Probelauf gegen den echten Bestand: 24 Proben grün.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.notizen (
  id              uuid primary key default gen_random_uuid(),
  betrieb_id      uuid not null references public.betriebe(id) on delete cascade,
  bestellung_id   uuid references public.bestellungen(id) on delete cascade,
  reservierung_id uuid references public.reservierungen(id) on delete cascade,
  an              text not null default 'team',
  text            text not null,
  von             uuid default auth.uid(),
  von_name        text,
  erstellt        timestamptz not null default now(),
  geaendert       timestamptz,
  gesendet_text   text,
  gesendet_am     timestamptz,
  gesendet_mal    smallint not null default 0,
  geloescht       boolean not null default false,
  constraint notizen_an_liste  check (an in ('team','gast')),
  constraint notizen_text_laenge check (length(btrim(text)) between 1 and 500),
  constraint notizen_genau_ein_bezug check (num_nonnulls(bestellung_id, reservierung_id) = 1)
);
create index if not exists notizen_bestellung   on public.notizen(bestellung_id)   where bestellung_id is not null;
create index if not exists notizen_reservierung on public.notizen(reservierung_id) where reservierung_id is not null;
create index if not exists notizen_betrieb_zeit on public.notizen(betrieb_id, erstellt);

alter table public.notizen enable row level security;

-- Nur das eigene Team (meine_betriebe() hängt an pin_ok()) und der
-- Master. anon hat KEIN Recht auf die Tabelle (§2.3a: Recht UND Regel).
drop policy if exists "notiz team liest"   on public.notizen;
drop policy if exists "notiz team schreibt" on public.notizen;
drop policy if exists "notiz team aendert" on public.notizen;
create policy "notiz team liest" on public.notizen for select to authenticated
  using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
create policy "notiz team schreibt" on public.notizen for insert to authenticated
  with check (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
create policy "notiz team aendert" on public.notizen for update to authenticated
  using (betrieb_id in (select public.meine_betriebe()) or public.ist_master())
  with check (betrieb_id in (select public.meine_betriebe()) or public.ist_master());

revoke all on public.notizen from anon, authenticated;
grant select on public.notizen to authenticated;
grant insert (betrieb_id, bestellung_id, reservierung_id, an, text) on public.notizen to authenticated;
-- gesendet_* fehlt hier absichtlich: Das schreibt nur notiz_senden().
grant update (text, an, geloescht) on public.notizen to authenticated;

-- ── Vor jedem Schreiben ───────────────────────────────────────────
-- Bezug muss zum selben Betrieb gehören — sonst hängt jemand eine
-- Notiz an die Bestellung eines fremden Betriebs (die RLS prüft nur
-- betrieb_id der Notiz, nicht die der Bestellung).
create or replace function public.notiz_vorher()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_mail text;
begin
  if tg_op = 'INSERT' then
    if new.bestellung_id is not null and not exists (
         select 1 from bestellungen where id = new.bestellung_id and betrieb_id = new.betrieb_id) then
      raise exception 'notiz_fremder_bezug' using errcode = '42501';
    end if;
    if new.reservierung_id is not null and not exists (
         select 1 from reservierungen where id = new.reservierung_id and betrieb_id = new.betrieb_id) then
      raise exception 'notiz_fremder_bezug' using errcode = '42501';
    end if;
    select email into v_mail from auth.users where id = auth.uid();
    new.von := auth.uid();
    new.von_name := nullif(split_part(coalesce(v_mail, ''), '@', 1), '');
    new.erstellt := now();
    new.geaendert := null;
    new.gesendet_text := null; new.gesendet_am := null; new.gesendet_mal := 0;
    new.text := btrim(new.text);
    return new;
  end if;

  -- UPDATE: Bezug, Verfasser und Zeitpunkt stehen fest.
  new.betrieb_id := old.betrieb_id; new.bestellung_id := old.bestellung_id;
  new.reservierung_id := old.reservierung_id; new.von := old.von;
  new.von_name := old.von_name; new.erstellt := old.erstellt;
  new.text := btrim(new.text);
  if new.text is distinct from old.text or new.an is distinct from old.an then
    new.geaendert := now();
  end if;
  -- Wird aus einer Gast-Nachricht eine Team-Notiz, sieht der Gast sie
  -- nicht mehr (zurückgezogen).
  if new.an = 'team' then
    new.gesendet_text := null; new.gesendet_am := null;
  end if;
  return new;
end $$;
revoke execute on function public.notiz_vorher() from public, anon, authenticated;

drop trigger if exists notiz_vorher on public.notizen;
create trigger notiz_vorher before insert or update on public.notizen
  for each row execute function public.notiz_vorher();

-- ── Zweite Bestätigung: senden ─────────────────────────────────────
create or replace function public.notiz_senden(p_id uuid, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n public.notizen%rowtype;
begin
  select * into n from notizen where id = p_id;
  if not found or not (n.betrieb_id in (select meine_betriebe()) or ist_master()) then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;
  if n.geloescht then return jsonb_build_object('ok', false, 'grund', 'geloescht'); end if;
  if n.an <> 'gast' then return jsonb_build_object('ok', false, 'grund', 'nur_team'); end if;
  -- Der Kern der doppelten Bestätigung: gesendet wird nur, was die
  -- zweite Stufe WIRKLICH gezeigt hat.
  if btrim(coalesce(p_text, '')) is distinct from n.text then
    return jsonb_build_object('ok', false, 'grund', 'text_anders', 'text', n.text);
  end if;
  update notizen
     set gesendet_text = n.text, gesendet_am = now(), gesendet_mal = n.gesendet_mal + 1
   where id = p_id;
  return jsonb_build_object('ok', true, 'am', now());
end $$;
revoke execute on function public.notiz_senden(uuid, text) from public, anon;
grant  execute on function public.notiz_senden(uuid, text) to authenticated;

create or replace function public.notiz_zurueckziehen(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n public.notizen%rowtype;
begin
  select * into n from notizen where id = p_id;
  if not found or not (n.betrieb_id in (select meine_betriebe()) or ist_master()) then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;
  update notizen set gesendet_text = null, gesendet_am = null where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.notiz_zurueckziehen(uuid) from public, anon;
grant  execute on function public.notiz_zurueckziehen(uuid) to authenticated;

-- ── Was der Gast liest ─────────────────────────────────────────────
-- Nur gesendete, nicht gelöschte Gast-Nachrichten der EINEN Bestellung,
-- deren Nummer (id) das Gerät kennt; nur 24 Stunden lang.
create or replace function public.bestellung_nachrichten(nummer uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'text', n.gesendet_text, 'am', n.gesendet_am,
           'bearbeitet', n.gesendet_mal > 1)
         order by n.gesendet_am, n.id), '[]'::jsonb)
    from notizen n
    join bestellungen b on b.id = n.bestellung_id
   where b.id = nummer          -- über die id der Bestellung (pruef-naht.js)
     and n.an = 'gast' and not n.geloescht and n.gesendet_am is not null
     and b.zeitpunkt > now() - interval '24 hours';
$$;
revoke execute on function public.bestellung_nachrichten(uuid) from public;
grant  execute on function public.bestellung_nachrichten(uuid) to anon, authenticated;

-- ── Reservierung mit Nummer ────────────────────────────────────────
-- Dieselben Prüfungen wie die Regel „res gast fragt an", dazu Längen.
-- Der Brems-Trigger reservierung_bremse läuft weiter mit; seine
-- Ausnahme kommt als lesbarer Satz zurück statt als roher Fehler.
create or replace function public.reservierung_anfragen(
  p_betrieb_id uuid, p_name text, p_telefon text, p_personen integer,
  p_wunsch timestamptz, p_notiz text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_betrieb_id is null or not exists (select 1 from betriebe where id = p_betrieb_id) then
    return jsonb_build_object('ok', false, 'grund', 'betrieb');
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 2 and 80 then
    return jsonb_build_object('ok', false, 'grund', 'name');
  end if;
  if p_telefon is not null and (length(p_telefon) > 40 or p_telefon !~ '^[+0-9][0-9 ()/.-]{3,39}$') then
    return jsonb_build_object('ok', false, 'grund', 'telefon');
  end if;
  if p_personen is not null and (p_personen < 1 or p_personen > 40) then
    return jsonb_build_object('ok', false, 'grund', 'personen');
  end if;
  if p_wunsch is null or p_wunsch <= now() - interval '1 hour' or p_wunsch >= now() + interval '180 days' then
    return jsonb_build_object('ok', false, 'grund', 'wunsch');
  end if;
  if p_notiz is not null and length(p_notiz) > 500 then
    return jsonb_build_object('ok', false, 'grund', 'notiz');
  end if;
  begin
    insert into reservierungen(betrieb_id, name, telefon, personen, wunsch, notiz, quelle, status)
    values (p_betrieb_id, btrim(p_name), nullif(btrim(coalesce(p_telefon, '')), ''),
            p_personen, p_wunsch, nullif(btrim(coalesce(p_notiz, '')), ''), 'tisch', 'offen')
    returning id into v_id;
  exception when sqlstate 'P0001' then
    return jsonb_build_object('ok', false, 'grund', 'bremse', 'text', sqlerrm);
  end;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke execute on function public.reservierung_anfragen(uuid, text, text, integer, timestamptz, text) from public;
grant  execute on function public.reservierung_anfragen(uuid, text, text, integer, timestamptz, text) to anon, authenticated;

create or replace function public.reservierung_stand(nummer uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'ok', true, 'status', r.status, 'wunsch', r.wunsch, 'personen', r.personen,
           'nachrichten', coalesce((
             select jsonb_agg(jsonb_build_object('text', n.gesendet_text, 'am', n.gesendet_am,
                                                 'bearbeitet', n.gesendet_mal > 1)
                              order by n.gesendet_am, n.id)
               from notizen n
              where n.reservierung_id = r.id and n.an = 'gast'
                and not n.geloescht and n.gesendet_am is not null), '[]'::jsonb))
    from reservierungen r
   where r.id = nummer and r.wunsch > now() - interval '1 day';
$$;
revoke execute on function public.reservierung_stand(uuid) from public;
grant  execute on function public.reservierung_stand(uuid) to anon, authenticated;

comment on table public.notizen is
  'Anmerkungen des Teams zu Bestellungen/Reservierungen. an=gast: der Gast liest gesendet_text, das nur notiz_senden() schreibt (doppelte Bestätigung).';
