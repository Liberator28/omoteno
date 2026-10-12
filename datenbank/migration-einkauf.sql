-- ═══════════════════════════════════════════════════════════════════
--  migration-einkauf.sql · Einkauf & Kosten, Stufe E1
--  (Plan: dokumente/plan-einkauf.md)
--
--  Was hier entsteht:
--   · organisationen — eine je Betrieb, still angelegt. Artikel und
--     Lieferanten gehören der Organisation, Belege und Bestand dem
--     Betrieb (= Standort). Später lassen sich Betriebe zusammenlegen.
--   · artikel, lieferanten, lieferanten_artikel (die gelernte Zuordnung
--     „so heißt es auf der Rechnung“ → Artikel + Gebinde).
--   · einkaufsbelege — Entwürfe tragen ihre Positionen als JSON
--     (positionen_entwurf). Erst beleg_freigeben() schreibt unveränderliche
--     Zeilen in einkaufspositionen und lagerbewegungen. So muss nie etwas
--     gelöscht werden (§2.8), und eine Freigabe kann sich nicht still
--     ändern.
--   · lagerbewegungen — nur einfügen. Bestand ist eine Sicht über die
--     Summe, nie eine gepflegte Zahl.
--
--  Rechte: Lesen jedes Mitglied des Betriebs (meine_betriebe, mit PIN).
--  Schreiben Inhaber/Master — Stammdaten per RLS, Belege NUR über die
--  Funktionen (keine Schreib-GRANTs, §2.3a/§2.3f). anon: nichts.
--  Abgewiesen wird mit Grund, nicht mit Ausnahme (§2.3g).
--  Mengen in Basiseinheit g / ml / stk; nie Gewicht ↔ Volumen.
--  Additiv, kein drop, kein delete (§2.8).
--
--  ANGEWENDET 11./12.10. (Supabase-MCP): einkauf_e1,
--  einkauf_e1_speichern_datenfehler, einkauf_e1_protokoll_tabelle,
--  einkauf_e1_organisationen_rechte. Zurückgedrehte Live-Probe
--  datenbank/pruef-einkauf.sql, 12.10., alles wie erwartet:
--   · 12 × 750 ml für 54 € → Bestand 9000 ml, 6,00 €/l; gelernt
--     „Wein 0,75 l · 750 · 4,50 je Flasche“.
--   · „ R-1 “ beim selben Lieferanten → doppelt; Positionen 54 vs. 60 →
--     summe; ohne Artikel → nicht_zugeordnet; „32.13.“ und Netto „abc“
--     → form (als Antwort, keine Ausnahme).
--   · Direktes UPDATE auf einen Beleg und auf basiseinheit → 42501;
--     Name ändern 1 Zeile; Speichern auf Freigegebenes → nicht_entwurf.
--   · +20 % → preisaenderungen 20,0; Storno → Bestand 18000 → 9000,
--     zweites Storno → nicht_freigegeben; danach dieselbe Nummer frei.
--   · Team: liest 6 Belege, jede Funktion kein_recht, Artikel anlegen
--     RLS, ändern 0 Zeilen. Fremder Betrieb: 0 Belege/Artikel/Bestand/
--     Positionen, ändern 0 Zeilen, Funktionen kein_recht. anon: 42501.
--   · Protokoll: 6 × neu, 4 × geaendert, Name aus auth.uid().
--   · Je Funktion eine Signatur, anon ohne EXECUTE, alle Betriebe mit
--     Organisation, neuer Betrieb bekommt eine.
--   · Zwei Funde dabei, beide behoben: protokoll_tabelle_check kannte
--     einkaufsbelege nicht (jedes Anlegen scheiterte, Abschnitt 7);
--     organisationen trug Supabases Vorgabe-Rechte für anon (Abschnitt 1).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Organisationen ────────────────────────────────────────────
create table if not exists public.organisationen (
  id       uuid primary key default gen_random_uuid(),
  name     text not null check (length(btrim(name)) between 1 and 120),
  angelegt timestamptz not null default now()
);
alter table public.organisationen enable row level security;

alter table public.betriebe add column if not exists organisation_id uuid references public.organisationen(id);

do $$
declare r record; o uuid;
begin
  for r in select id, name from public.betriebe where organisation_id is null order by id loop
    insert into public.organisationen (name) values (coalesce(nullif(btrim(r.name), ''), 'Betrieb')) returning id into o;
    update public.betriebe set organisation_id = o where id = r.id;
  end loop;
end $$;

-- Neue Betriebe bekommen ihre Organisation von selbst.
create or replace function public.betrieb_organisation_anlegen()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if new.organisation_id is null then
    insert into public.organisationen (name) values (coalesce(nullif(btrim(new.name), ''), 'Betrieb'))
    returning id into new.organisation_id;
  end if;
  return new;
end $function$;
revoke execute on function public.betrieb_organisation_anlegen() from public, anon, authenticated;
do $$ begin
  create trigger betrieb_organisation_anlegen before insert on public.betriebe
    for each row execute function public.betrieb_organisation_anlegen();
exception when duplicate_object then null; end $$;

grant select (organisation_id) on public.betriebe to authenticated;

create or replace function public.meine_organisationen()
returns setof uuid language sql stable security definer set search_path = public as $function$
  select distinct b.organisation_id from public.betriebe b
   where b.id in (select public.meine_betriebe()) and b.organisation_id is not null;
$function$;

create or replace function public.ist_org_inhaber(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $function$
  select public.ist_master()
      or exists (select 1 from public.betriebe b where b.organisation_id = p_org and public.ist_inhaber(b.id));
$function$;

revoke execute on function public.meine_organisationen() from public, anon;
revoke execute on function public.ist_org_inhaber(uuid)   from public, anon;
grant  execute on function public.meine_organisationen() to authenticated;   -- in Regeln (§2.7)
grant  execute on function public.ist_org_inhaber(uuid)   to authenticated;

do $$ begin
  create policy "organisation mitglied liest" on public.organisationen for select to authenticated
    using (id in (select public.meine_organisationen()) or public.ist_master());
exception when duplicate_object then null; end $$;
-- Supabase gibt neuen Tabellen von selbst ALLE Rechte an anon und
-- authenticated. Die Live-Probe fand genau das hier (anon=arwdDxtm) —
-- RLS hielt, weil es nur eine Leseregel gibt, aber das ist die offene
-- Tür neben dem Wächter (§2.3f). Erst alles weg, dann nur Lesen.
revoke all on public.organisationen from anon, authenticated;
grant select on public.organisationen to authenticated;

-- ── 2 · Artikel und Lieferanten (Stammdaten der Organisation) ─────
create table if not exists public.artikel (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisationen(id),
  name            text not null check (length(btrim(name)) between 1 and 120),
  kategorie       text check (kategorie is null or length(kategorie) <= 60),
  basiseinheit    text not null check (basiseinheit in ('g', 'ml', 'stk')),
  aktiv           boolean not null default true,
  angelegt        timestamptz not null default now()
);
create unique index if not exists artikel_name_eindeutig on public.artikel (organisation_id, lower(btrim(name)));
alter table public.artikel enable row level security;

create table if not exists public.lieferanten (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisationen(id),
  name            text not null check (length(btrim(name)) between 1 and 120),
  kundennummer    text check (kundennummer is null or length(kundennummer) <= 60),
  kontakt         text check (kontakt is null or length(kontakt) <= 300),
  aktiv           boolean not null default true,
  angelegt        timestamptz not null default now()
);
create unique index if not exists lieferanten_name_eindeutig on public.lieferanten (organisation_id, lower(btrim(name)));
alter table public.lieferanten enable row level security;

create table if not exists public.lieferanten_artikel (
  id               uuid primary key default gen_random_uuid(),
  lieferant_id     uuid not null references public.lieferanten(id),
  artikel_id       uuid not null references public.artikel(id),
  bezeichnung      text not null check (length(btrim(bezeichnung)) between 1 and 200),
  artikelnummer    text check (artikelnummer is null or length(artikelnummer) <= 60),
  einkaufseinheit  text not null default 'Stück' check (length(btrim(einkaufseinheit)) between 1 and 30),
  gebinde_basis    numeric(14,4) not null check (gebinde_basis > 0),
  letzter_preis    numeric(12,4),
  letzter_preis_am date,
  angelegt         timestamptz not null default now()
);
create unique index if not exists lieferanten_artikel_eindeutig on public.lieferanten_artikel (lieferant_id, lower(btrim(bezeichnung)));
alter table public.lieferanten_artikel enable row level security;

-- Lieferant und Artikel müssen derselben Organisation gehören, und der
-- Schreibende muss dort Inhaber sein.
create or replace function public.lieferanten_artikel_ok(p_lieferant uuid, p_artikel uuid)
returns boolean language sql stable security definer set search_path = public as $function$
  select exists (
    select 1 from public.lieferanten l join public.artikel a on a.organisation_id = l.organisation_id
     where l.id = p_lieferant and a.id = p_artikel and public.ist_org_inhaber(l.organisation_id));
$function$;
revoke execute on function public.lieferanten_artikel_ok(uuid, uuid) from public, anon;
grant  execute on function public.lieferanten_artikel_ok(uuid, uuid) to authenticated;

do $$ begin
  create policy "artikel organisation liest" on public.artikel for select to authenticated
    using (organisation_id in (select public.meine_organisationen()) or public.ist_master());
  create policy "artikel inhaber legt an" on public.artikel for insert to authenticated
    with check (public.ist_org_inhaber(organisation_id));
  create policy "artikel inhaber aendert" on public.artikel for update to authenticated
    using (public.ist_org_inhaber(organisation_id)) with check (public.ist_org_inhaber(organisation_id));
  create policy "lieferant organisation liest" on public.lieferanten for select to authenticated
    using (organisation_id in (select public.meine_organisationen()) or public.ist_master());
  create policy "lieferant inhaber legt an" on public.lieferanten for insert to authenticated
    with check (public.ist_org_inhaber(organisation_id));
  create policy "lieferant inhaber aendert" on public.lieferanten for update to authenticated
    using (public.ist_org_inhaber(organisation_id)) with check (public.ist_org_inhaber(organisation_id));
  create policy "zuordnung organisation liest" on public.lieferanten_artikel for select to authenticated
    using (exists (select 1 from public.lieferanten l where l.id = lieferant_id
                    and (l.organisation_id in (select public.meine_organisationen()) or public.ist_master())));
  create policy "zuordnung inhaber legt an" on public.lieferanten_artikel for insert to authenticated
    with check (public.lieferanten_artikel_ok(lieferant_id, artikel_id));
  create policy "zuordnung inhaber aendert" on public.lieferanten_artikel for update to authenticated
    using (public.lieferanten_artikel_ok(lieferant_id, artikel_id)) with check (public.lieferanten_artikel_ok(lieferant_id, artikel_id));
exception when duplicate_object then null; end $$;

-- Basiseinheit und Organisation sind nach dem Anlegen fest: Eine andere
-- Einheit würde jede gebuchte Menge umdeuten.
revoke all on public.artikel, public.lieferanten, public.lieferanten_artikel from anon, authenticated;
grant select, insert on public.artikel to authenticated;
grant update (name, kategorie, aktiv) on public.artikel to authenticated;
grant select, insert on public.lieferanten to authenticated;
grant update (name, kundennummer, kontakt, aktiv) on public.lieferanten to authenticated;
grant select, insert on public.lieferanten_artikel to authenticated;
grant update (artikel_id, artikelnummer, einkaufseinheit, gebinde_basis) on public.lieferanten_artikel to authenticated;

-- ── 3 · Belege, Positionen, Bewegungen ────────────────────────────
create table if not exists public.einkaufsbelege (
  id                 uuid primary key default gen_random_uuid(),
  betrieb_id         uuid not null references public.betriebe(id),
  lieferant_id       uuid references public.lieferanten(id),
  belegnummer        text check (belegnummer is null or length(belegnummer) <= 60),
  belegdatum         date not null default current_date,
  netto              numeric(12,2),
  steuer             numeric(12,2),
  brutto             numeric(12,2),
  status             text not null default 'entwurf' check (status in ('entwurf', 'freigegeben', 'storniert', 'verworfen')),
  quelle             text not null default 'manuell' check (quelle in ('manuell', 'foto', 'pdf')),
  datei_pfad         text check (datei_pfad is null or length(datei_pfad) <= 300),
  positionen_entwurf jsonb not null default '[]'::jsonb
                     check (jsonb_typeof(positionen_entwurf) = 'array' and octet_length(positionen_entwurf::text) < 200000),
  notiz              text check (notiz is null or length(notiz) <= 500),
  angelegt           timestamptz not null default now(),
  angelegt_von       uuid,
  freigegeben_am     timestamptz,
  freigegeben_von    uuid,
  storniert_am       timestamptz,
  storniert_von      uuid
);
create unique index if not exists einkaufsbelege_nicht_doppelt
  on public.einkaufsbelege (lieferant_id, lower(btrim(belegnummer)))
  where status = 'freigegeben' and lieferant_id is not null and belegnummer is not null;
create index if not exists einkaufsbelege_betrieb_datum on public.einkaufsbelege (betrieb_id, belegdatum desc, id);
alter table public.einkaufsbelege enable row level security;

create table if not exists public.einkaufspositionen (
  id              uuid primary key default gen_random_uuid(),
  beleg_id        uuid not null references public.einkaufsbelege(id),
  pos             smallint not null,
  text            text not null check (length(btrim(text)) between 1 and 200),
  art             text not null check (art in ('ware', 'pfand', 'fracht', 'rabatt', 'sonstiges')),
  artikel_id      uuid references public.artikel(id),
  menge           numeric(12,4) not null check (menge > 0),
  einkaufseinheit text,
  gebinde_basis   numeric(14,4) check (gebinde_basis is null or gebinde_basis > 0),
  menge_basis     numeric(16,4) generated always as (menge * gebinde_basis) stored,
  netto           numeric(12,2) not null,
  steuersatz      numeric(5,2) check (steuersatz is null or steuersatz between 0 and 30),
  unique (beleg_id, pos)
);
alter table public.einkaufspositionen enable row level security;

create table if not exists public.lagerbewegungen (
  id          bigint generated always as identity primary key,
  betrieb_id  uuid not null references public.betriebe(id),
  artikel_id  uuid not null references public.artikel(id),
  art         text not null check (art in ('eingang', 'storno', 'inventur', 'verlust', 'transfer_aus', 'transfer_ein', 'korrektur')),
  menge_basis numeric(16,4) not null check (menge_basis <> 0),
  wert_netto  numeric(12,2),
  beleg_id    uuid references public.einkaufsbelege(id),
  position_id uuid references public.einkaufspositionen(id),
  notiz       text check (notiz is null or length(notiz) <= 200),
  zeitpunkt   timestamptz not null default now(),
  nutzer_id   uuid
);
create index if not exists lagerbewegungen_betrieb_artikel on public.lagerbewegungen (betrieb_id, artikel_id);
alter table public.lagerbewegungen enable row level security;

do $$ begin
  create policy "beleg betrieb liest" on public.einkaufsbelege for select to authenticated
    using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
  create policy "position betrieb liest" on public.einkaufspositionen for select to authenticated
    using (exists (select 1 from public.einkaufsbelege e where e.id = beleg_id
                    and (e.betrieb_id in (select public.meine_betriebe()) or public.ist_master())));
  create policy "bewegung betrieb liest" on public.lagerbewegungen for select to authenticated
    using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
exception when duplicate_object then null; end $$;

-- Lesen ja, Schreiben nur über die Funktionen.
revoke all on public.einkaufsbelege, public.einkaufspositionen, public.lagerbewegungen from anon, authenticated;
grant select on public.einkaufsbelege, public.einkaufspositionen, public.lagerbewegungen to authenticated;

-- Bestand und Preise: Sichten mit den Rechten des Lesenden (§2.3a).
create or replace view public.lagerbestand with (security_invoker = true) as
  select betrieb_id, artikel_id, sum(menge_basis) as menge_basis, sum(coalesce(wert_netto, 0)) as wert_netto
    from public.lagerbewegungen group by betrieb_id, artikel_id;
create or replace view public.artikel_preise with (security_invoker = true) as
  select p.artikel_id, e.betrieb_id, e.lieferant_id, e.belegdatum, e.id as beleg_id, p.id as position_id,
         round(p.netto / nullif(p.menge_basis, 0), 6) as preis_basis
    from public.einkaufspositionen p join public.einkaufsbelege e on e.id = p.beleg_id
   where e.status = 'freigegeben' and p.art = 'ware' and p.artikel_id is not null;
revoke all on public.lagerbestand, public.artikel_preise from anon, authenticated;
grant select on public.lagerbestand, public.artikel_preise to authenticated;

-- Wer hat Belege angelegt, freigegeben, storniert: dieselbe Spur wie
-- bei Gerichten und Aktionen (migration-protokoll.sql).
do $$ begin
  -- Nur Anlegen und Statuswechsel — jedes Zwischenspeichern eines Entwurfs
  -- wäre Rauschen im Verlauf.
  create trigger einkaufsbelege_protokoll after insert or update of status on public.einkaufsbelege
    for each row execute function public.protokoll_schreiben();
exception when duplicate_object then null; end $$;

-- ── 4 · Entwurf speichern ─────────────────────────────────────────
create or replace function public.beleg_speichern(p_beleg uuid, p_betrieb uuid, p_daten jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  v_id uuid := p_beleg;
  v_status text;
  v_betrieb uuid;
  v_lief uuid;
  v_pos jsonb := coalesce(p_daten -> 'positionen', '[]'::jsonb);
begin
  begin
    v_lief := nullif(p_daten ->> 'lieferant_id', '')::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('ok', false, 'grund', 'lieferant');
  end;
  if jsonb_typeof(v_pos) <> 'array' or jsonb_array_length(v_pos) > 200 then
    return jsonb_build_object('ok', false, 'grund', 'positionen');
  end if;
  if v_id is null then
    if not public.ist_inhaber(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
    v_betrieb := p_betrieb;
  else
    select status, betrieb_id into v_status, v_betrieb from public.einkaufsbelege where id = v_id for update;
    if v_betrieb is null or not public.ist_inhaber(v_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
    if v_status <> 'entwurf' then return jsonb_build_object('ok', false, 'grund', 'nicht_entwurf'); end if;
  end if;
  if v_lief is not null and not exists (select 1 from public.lieferanten l join public.betriebe b on b.organisation_id = l.organisation_id
                                         where l.id = v_lief and b.id = v_betrieb) then
    return jsonb_build_object('ok', false, 'grund', 'lieferant');
  end if;
  begin
    if v_id is null then
      insert into public.einkaufsbelege (betrieb_id, lieferant_id, belegnummer, belegdatum, netto, steuer, brutto,
                                         quelle, notiz, positionen_entwurf, angelegt_von)
      values (v_betrieb, v_lief, nullif(btrim(p_daten ->> 'belegnummer'), ''),
              coalesce(nullif(p_daten ->> 'belegdatum', '')::date, current_date),
              nullif(p_daten ->> 'netto', '')::numeric, nullif(p_daten ->> 'steuer', '')::numeric,
              nullif(p_daten ->> 'brutto', '')::numeric,
              coalesce(nullif(p_daten ->> 'quelle', ''), 'manuell'), nullif(btrim(p_daten ->> 'notiz'), ''),
              v_pos, auth.uid())
      returning id into v_id;
    else
      update public.einkaufsbelege set
        lieferant_id = v_lief,
        belegnummer = nullif(btrim(p_daten ->> 'belegnummer'), ''),
        belegdatum = coalesce(nullif(p_daten ->> 'belegdatum', '')::date, belegdatum),
        netto = nullif(p_daten ->> 'netto', '')::numeric,
        steuer = nullif(p_daten ->> 'steuer', '')::numeric,
        brutto = nullif(p_daten ->> 'brutto', '')::numeric,
        notiz = nullif(btrim(p_daten ->> 'notiz'), ''),
        positionen_entwurf = v_pos
      where id = v_id;
    end if;
  -- data_exception = die ganze Klasse 22 (Zahl, Datum, Länge, UUID).
  -- Die erste Fassung fing nur 22008; „32.13.“ ist 22007 und warf —
  -- gefunden in der Live-Probe.
  exception when data_exception or check_violation then
    return jsonb_build_object('ok', false, 'grund', 'form', 'text', sqlerrm);
  end;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;

-- Ein Entwurf, der nicht gebraucht wird, wird verworfen (bleibt lesbar).
create or replace function public.beleg_verwerfen(p_beleg uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_status text; v_betrieb uuid;
begin
  select status, betrieb_id into v_status, v_betrieb from public.einkaufsbelege where id = p_beleg for update;
  if v_betrieb is null or not public.ist_inhaber(v_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if v_status <> 'entwurf' then return jsonb_build_object('ok', false, 'grund', 'nicht_entwurf'); end if;
  update public.einkaufsbelege set status = 'verworfen' where id = p_beleg;
  return jsonb_build_object('ok', true);
end $function$;

-- ── 5 · Freigeben: prüfen, festschreiben, Lager und Preise ────────
create or replace function public.beleg_freigeben(p_beleg uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  b record;
  v_org uuid;
  p jsonb;
  i int := 0;
  v_summe numeric := 0;
  v_text text; v_art text; v_artikel uuid; v_menge numeric; v_gebinde numeric; v_netto numeric; v_satz numeric; v_einheit text;
  v_pid uuid;
  v_alt numeric; v_neu numeric;
  v_aenderungen jsonb := '[]'::jsonb;
  v_fehlt jsonb := '[]'::jsonb;
  v_doppelt uuid;
begin
  select * into b from public.einkaufsbelege where id = p_beleg for update;
  if b.id is null or not public.ist_inhaber(b.betrieb_id) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if b.status <> 'entwurf' then return jsonb_build_object('ok', false, 'grund', 'nicht_entwurf'); end if;
  if b.lieferant_id is null then return jsonb_build_object('ok', false, 'grund', 'kein_lieferant'); end if;
  if b.belegnummer is null then return jsonb_build_object('ok', false, 'grund', 'keine_nummer'); end if;
  if b.netto is null then return jsonb_build_object('ok', false, 'grund', 'keine_summe'); end if;
  if jsonb_array_length(b.positionen_entwurf) = 0 then return jsonb_build_object('ok', false, 'grund', 'keine_positionen'); end if;
  select organisation_id into v_org from public.betriebe where id = b.betrieb_id;

  select id into v_doppelt from public.einkaufsbelege
   where status = 'freigegeben' and lieferant_id = b.lieferant_id and lower(btrim(belegnummer)) = lower(btrim(b.belegnummer))
   limit 1;
  if v_doppelt is not null then return jsonb_build_object('ok', false, 'grund', 'doppelt', 'beleg', v_doppelt); end if;

  -- Erst alles prüfen, dann schreiben.
  for p in select value from jsonb_array_elements(b.positionen_entwurf) loop
    i := i + 1;
    begin
      v_text := btrim(p ->> 'text');
      v_art := coalesce(nullif(p ->> 'art', ''), 'ware');
      v_artikel := nullif(p ->> 'artikel_id', '')::uuid;
      v_menge := (p ->> 'menge')::numeric;
      v_gebinde := nullif(p ->> 'gebinde_basis', '')::numeric;
      v_netto := (p ->> 'netto')::numeric;
      v_satz := nullif(p ->> 'steuersatz', '')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'zahl');
    end;
    if v_text is null or length(v_text) not between 1 and 200 then return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'text'); end if;
    if v_art not in ('ware', 'pfand', 'fracht', 'rabatt', 'sonstiges') then return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'art'); end if;
    if v_menge is null or v_menge <= 0 then return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'menge'); end if;
    if v_netto is null then return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'netto'); end if;
    if v_satz is not null and (v_satz < 0 or v_satz > 30) then return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'steuersatz'); end if;
    if v_art = 'ware' then
      if v_artikel is null or v_gebinde is null or v_gebinde <= 0 then
        v_fehlt := v_fehlt || to_jsonb(i);
      elsif not exists (select 1 from public.artikel a where a.id = v_artikel and a.organisation_id = v_org) then
        return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'artikel');
      end if;
    end if;
    v_summe := v_summe + v_netto;
  end loop;
  if jsonb_array_length(v_fehlt) > 0 then return jsonb_build_object('ok', false, 'grund', 'nicht_zugeordnet', 'pos', v_fehlt); end if;
  if abs(v_summe - b.netto) > 0.02 then
    return jsonb_build_object('ok', false, 'grund', 'summe', 'positionen', round(v_summe, 2), 'beleg', b.netto);
  end if;

  i := 0;
  for p in select value from jsonb_array_elements(b.positionen_entwurf) loop
    i := i + 1;
    v_text := btrim(p ->> 'text');
    v_art := coalesce(nullif(p ->> 'art', ''), 'ware');
    v_artikel := case when v_art = 'ware' then nullif(p ->> 'artikel_id', '')::uuid end;
    v_menge := (p ->> 'menge')::numeric;
    v_gebinde := case when v_art = 'ware' then (p ->> 'gebinde_basis')::numeric end;
    v_netto := (p ->> 'netto')::numeric;
    v_satz := nullif(p ->> 'steuersatz', '')::numeric;
    v_einheit := left(nullif(btrim(p ->> 'einkaufseinheit'), ''), 30);
    insert into public.einkaufspositionen (beleg_id, pos, text, art, artikel_id, menge, einkaufseinheit, gebinde_basis, netto, steuersatz)
    values (b.id, i, v_text, v_art, v_artikel, v_menge, v_einheit, v_gebinde, v_netto, v_satz)
    returning id into v_pid;
    if v_art = 'ware' then
      -- Preis vor dieser Lieferung (letzte Freigabe in der Organisation)
      select pr.preis_basis into v_alt from public.artikel_preise pr join public.betriebe bb on bb.id = pr.betrieb_id
       where pr.artikel_id = v_artikel and bb.organisation_id = v_org
       order by pr.belegdatum desc, pr.position_id desc limit 1;
      v_neu := round(v_netto / (v_menge * v_gebinde), 6);
      if v_alt is not null and v_alt > 0 and abs(v_neu - v_alt) / v_alt >= 0.05 then
        v_aenderungen := v_aenderungen || jsonb_build_object('artikel_id', v_artikel, 'vorher', v_alt, 'jetzt', v_neu,
                                                             'prozent', round((v_neu - v_alt) / v_alt * 100, 1));
      end if;
      insert into public.lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, beleg_id, position_id, nutzer_id)
      values (b.betrieb_id, v_artikel, 'eingang', v_menge * v_gebinde, v_netto, b.id, v_pid, auth.uid());
      -- Die Zuordnung lernt: so heißt es bei diesem Lieferanten.
      insert into public.lieferanten_artikel (lieferant_id, artikel_id, bezeichnung, einkaufseinheit, gebinde_basis, letzter_preis, letzter_preis_am)
      values (b.lieferant_id, v_artikel, left(v_text, 200), coalesce(v_einheit, 'Stück'), v_gebinde, round(v_netto / v_menge, 4), b.belegdatum)
      on conflict (lieferant_id, (lower(btrim(bezeichnung)))) do update
        set artikel_id = excluded.artikel_id, einkaufseinheit = excluded.einkaufseinheit,
            gebinde_basis = excluded.gebinde_basis, letzter_preis = excluded.letzter_preis, letzter_preis_am = excluded.letzter_preis_am;
    end if;
  end loop;

  update public.einkaufsbelege set status = 'freigegeben', freigegeben_am = now(), freigegeben_von = auth.uid() where id = b.id;
  return jsonb_build_object('ok', true, 'positionen', i, 'preisaenderungen', v_aenderungen);
end $function$;

-- ── 6 · Stornieren: Gegenbuchung, nie stilles Ändern ──────────────
create or replace function public.beleg_stornieren(p_beleg uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare b record; n int;
begin
  select * into b from public.einkaufsbelege where id = p_beleg for update;
  if b.id is null or not public.ist_inhaber(b.betrieb_id) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if b.status <> 'freigegeben' then return jsonb_build_object('ok', false, 'grund', 'nicht_freigegeben'); end if;
  insert into public.lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, beleg_id, position_id, nutzer_id)
  select l.betrieb_id, l.artikel_id, 'storno', -l.menge_basis, -l.wert_netto, l.beleg_id, l.position_id, auth.uid()
    from public.lagerbewegungen l where l.beleg_id = b.id and l.art = 'eingang';
  get diagnostics n = row_count;
  update public.einkaufsbelege set status = 'storniert', storniert_am = now(), storniert_von = auth.uid() where id = b.id;
  return jsonb_build_object('ok', true, 'gegenbuchungen', n);
end $function$;

revoke execute on function public.beleg_speichern(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.beleg_verwerfen(uuid)              from public, anon;
revoke execute on function public.beleg_freigeben(uuid)              from public, anon;
revoke execute on function public.beleg_stornieren(uuid)             from public, anon;
grant  execute on function public.beleg_speichern(uuid, uuid, jsonb) to authenticated;
grant  execute on function public.beleg_verwerfen(uuid)              to authenticated;
grant  execute on function public.beleg_freigeben(uuid)              to authenticated;
grant  execute on function public.beleg_stornieren(uuid)             to authenticated;

-- ── 7 · Protokoll kennt einkaufsbelege ────────────────────────────
-- Gefunden in der Live-Probe: protokoll_tabelle_check kannte nur sechs
-- Tabellen, der Trigger aus Abschnitt 3 ließ damit JEDES Anlegen eines
-- Belegs scheitern (beleg_speichern antwortete grund:'form'). Liste aus
-- dem Katalog gelesen (§2.3c), alle sechs alten Werte bleiben.
alter table public.protokoll drop constraint protokoll_tabelle_check,
  add constraint protokoll_tabelle_check check (tabelle = any (array[
    'betriebe','gerichte','aktionen','gutscheine','rabattcodes','team','einkaufsbelege']));
