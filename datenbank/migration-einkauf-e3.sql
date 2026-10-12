-- ═══════════════════════════════════════════════════════════════════
--  migration-einkauf-e3.sql · Einkauf & Kosten, Stufe E3
--  Rezepturen und Gerichtkalkulation (Plan: dokumente/plan-einkauf.md)
--
--  Was hier entsteht:
--   · rezepturen / rezepturpositionen — je Gericht VERSIONIERT. Eine
--     Änderung legt eine neue Fassung an (gueltig_ab), die alte bleibt.
--     Nichts wird überschrieben oder gelöscht (§2.8).
--   · gericht_kosten_portion(gericht, stichtag) — EINE Rechnung für die
--     Kosten einer Portion: Rezeptur, die am Stichtag galt, mal letzter
--     freigegebener Einkaufspreis bis zu diesem Tag. Darum ändert eine
--     Preisänderung die heutige Kalkulation, alte Stichtage nicht.
--   · gericht_kalkulation(betrieb, stichtag) — je Gericht Kosten,
--     Kartenpreis, Aktionspreis, Wareneinsatz (Anteil am Nettopreis).
--   · wareneinsatz_theoretisch(betrieb, von, bis) — verkaufte Portionen
--     mal Kosten zum Zeitpunkt der Bestellung.
--   · positionen_pruefen() legt gericht_id in jede erkannte Position
--     (GLEICHE Signatur, nur additiv — §2.1). Damit hängt der
--     Wareneinsatz nicht mehr am Namen, der sich ändern kann.
--
--  Rechte: Lesen Mitglieder, Schreiben nur rezeptur_speichern()
--  (Inhaber). Abgewiesen wird mit Grund (§2.3g).
--
--  ANGEWENDET 12.10. (apply_migration einkauf_e3), danach die
--  zurückgedrehte Probe datenbank/pruef-einkauf-e3.sql, live:
--   · Kosten/Portion 0,238 → nach +50 % Mehl 0,282; Stichtag 5.10.
--     mit alter Fassung und altem Preis weiter 0,238; vor der ersten
--     Fassung keine Zeile. Neue Fassung heute 0,414, vor 2 Tagen 0,282.
--   · Wareneinsatz = Kosten / (Preis / 1,07) gleich nachgerechnet.
--   · Gründe: menge, doppelt, artikel (fremde Organisation), mwst,
--     portionen, verlust — je als Antwort, keine Ausnahme.
--   · positionen_pruefen: gericht_id nur am bekannten Gericht.
--   · wareneinsatz_theoretisch: storniert und Serviceruf zählen nicht,
--     Position ohne gericht_id über den Namen (ueber_namen 1).
--   · Team: kein_recht beim Speichern, liest die Kalkulation. Fremder:
--     kein_recht, 0 Zeilen, Wareneinsatz 0. anon: 42501.
--   · Je Funktion genau eine Signatur (§2.1); positionen_pruefen für
--     anon/authenticated nicht ausführbar; rezepturen nur lesbar.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Rezepturen ────────────────────────────────────────────────
create table if not exists public.rezepturen (
  id          uuid primary key default gen_random_uuid(),
  betrieb_id  uuid not null references public.betriebe(id),
  gericht_id  uuid not null references public.gerichte(id),
  gueltig_ab  timestamptz not null default now(),
  portionen   numeric(10,2) not null default 1 check (portionen > 0 and portionen <= 1000),
  mwst        smallint not null default 7 check (mwst in (0, 7, 19)),
  notiz       text check (notiz is null or length(notiz) <= 300),
  angelegt_von uuid
);
create index if not exists rezepturen_gericht_zeit on public.rezepturen (gericht_id, gueltig_ab desc, id);
alter table public.rezepturen enable row level security;

create table if not exists public.rezepturpositionen (
  id          uuid primary key default gen_random_uuid(),
  rezeptur_id uuid not null references public.rezepturen(id),
  artikel_id  uuid not null references public.artikel(id),
  menge_basis numeric(14,4) not null check (menge_basis > 0 and menge_basis <= 1000000),
  verlust_prozent numeric(5,2) not null default 0 check (verlust_prozent >= 0 and verlust_prozent <= 90),
  unique (rezeptur_id, artikel_id)
);
alter table public.rezepturpositionen enable row level security;

do $$ begin
  create policy "rezeptur betrieb liest" on public.rezepturen for select to authenticated
    using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
  create policy "rezepturposition betrieb liest" on public.rezepturpositionen for select to authenticated
    using (exists (select 1 from public.rezepturen r where r.id = rezeptur_id
                    and (r.betrieb_id in (select public.meine_betriebe()) or public.ist_master())));
exception when duplicate_object then null; end $$;
revoke all on public.rezepturen, public.rezepturpositionen from anon, authenticated;
grant select on public.rezepturen, public.rezepturpositionen to authenticated;

-- Eine neue Fassung — nie ein Überschreiben.
create or replace function public.rezeptur_speichern(p_gericht uuid, p_positionen jsonb, p_portionen numeric default 1,
                                                    p_mwst smallint default 7, p_notiz text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_betrieb uuid; v_org uuid; v_id uuid; z jsonb; i int := 0; v_art uuid; v_menge numeric; v_verlust numeric;
begin
  select g.betrieb_id into v_betrieb from public.gerichte g where g.id = p_gericht;
  if v_betrieb is null or not public.ist_inhaber(v_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if jsonb_typeof(p_positionen) is distinct from 'array' or jsonb_array_length(p_positionen) > 100 then
    return jsonb_build_object('ok', false, 'grund', 'positionen');
  end if;
  if p_portionen is null or p_portionen <= 0 or p_portionen > 1000 then return jsonb_build_object('ok', false, 'grund', 'portionen'); end if;
  if p_mwst is null or p_mwst not in (0, 7, 19) then return jsonb_build_object('ok', false, 'grund', 'mwst'); end if;
  if p_notiz is not null and length(p_notiz) > 300 then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  select organisation_id into v_org from public.betriebe where id = v_betrieb;
  for z in select value from jsonb_array_elements(p_positionen) loop
    i := i + 1;
    begin
      v_art := (z ->> 'artikel_id')::uuid; v_menge := (z ->> 'menge_basis')::numeric;
      v_verlust := coalesce(nullif(z ->> 'verlust_prozent', '')::numeric, 0);
    exception when others then return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'zahl'); end;
    if v_menge is null or v_menge <= 0 or v_menge > 1000000 then return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'menge'); end if;
    if v_verlust < 0 or v_verlust > 90 then return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'verlust'); end if;
    if not exists (select 1 from public.artikel a where a.id = v_art and a.organisation_id = v_org) then
      return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'artikel');
    end if;
    if (select count(*) from jsonb_array_elements(p_positionen) x where x ->> 'artikel_id' = v_art::text) > 1 then
      return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'doppelt');
    end if;
  end loop;
  insert into public.rezepturen (betrieb_id, gericht_id, portionen, mwst, notiz, angelegt_von)
  values (v_betrieb, p_gericht, p_portionen, p_mwst, nullif(btrim(p_notiz), ''), auth.uid()) returning id into v_id;
  insert into public.rezepturpositionen (rezeptur_id, artikel_id, menge_basis, verlust_prozent)
  select v_id, (x ->> 'artikel_id')::uuid, (x ->> 'menge_basis')::numeric, coalesce(nullif(x ->> 'verlust_prozent', '')::numeric, 0)
    from jsonb_array_elements(p_positionen) x;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;
revoke execute on function public.rezeptur_speichern(uuid, jsonb, numeric, smallint, text) from public, anon;
grant  execute on function public.rezeptur_speichern(uuid, jsonb, numeric, smallint, text) to authenticated;

-- ── 2 · Kosten je Portion zu einem Stichtag ───────────────────────
-- security invoker: Wer die Rezeptur oder die Preise nicht lesen darf,
-- bekommt null — die Regeln der Tabellen gelten unverändert.
-- Ergebnis: kosten (null ohne Rezeptur), positionen, ohne_preis.
create or replace function public.gericht_kosten_portion(p_gericht uuid, p_stichtag timestamptz default now())
returns table (rezeptur_id uuid, gueltig_ab timestamptz, portionen numeric, mwst smallint, kosten numeric, positionen int, ohne_preis int)
language sql stable security invoker set search_path = public as $function$
  with r as (
    select r.* from public.rezepturen r
     where r.gericht_id = p_gericht and r.gueltig_ab <= p_stichtag
     order by r.gueltig_ab desc, r.id desc limit 1
  ), org as (
    select b.organisation_id from r join public.betriebe b on b.id = r.betrieb_id
  ), zeilen as (
    select rp.artikel_id, rp.menge_basis * (1 + rp.verlust_prozent / 100) as menge,
           (select pr.preis_basis from public.artikel_preise pr join public.betriebe bb on bb.id = pr.betrieb_id
             where pr.artikel_id = rp.artikel_id and bb.organisation_id = (select organisation_id from org)
               and pr.belegdatum <= (p_stichtag at time zone 'Europe/Berlin')::date
             order by pr.belegdatum desc, pr.position_id desc limit 1) as preis
      from public.rezepturpositionen rp join r on rp.rezeptur_id = r.id
  )
  select r.id, r.gueltig_ab, r.portionen, r.mwst,
         round((select sum(z.menge * z.preis) from zeilen z) / r.portionen, 4),
         (select count(*)::int from zeilen),
         (select count(*)::int from zeilen z where z.preis is null)
    from r;
$function$;
revoke execute on function public.gericht_kosten_portion(uuid, timestamptz) from public, anon;
grant  execute on function public.gericht_kosten_portion(uuid, timestamptz) to authenticated;

-- ── 3 · Kalkulation je Gericht ────────────────────────────────────
-- Wareneinsatz = Kosten ÷ Nettopreis (Kartenpreis ohne MwSt der
-- Rezeptur). Aktionspreis getrennt — gleiche Regel wie im Bestellweg
-- (positionen_pruefen: Name, aktiv, Zeitraum, niedrigster Preis).
create or replace function public.gericht_kalkulation(p_betrieb uuid, p_stichtag timestamptz default now())
returns table (gericht_id uuid, name text, kategorie text, karte text, preis numeric, aktionspreis numeric,
               rezeptur_id uuid, gueltig_ab timestamptz, mwst smallint, portionen numeric,
               kosten numeric, positionen int, ohne_preis int, wareneinsatz numeric, wareneinsatz_aktion numeric)
language sql stable security invoker set search_path = public as $function$
  select g.id, g.name, g.kategorie, g.karte, g.preis, a.preis_neu,
         k.rezeptur_id, k.gueltig_ab, k.mwst, k.portionen, k.kosten, coalesce(k.positionen, 0), coalesce(k.ohne_preis, 0),
         case when k.kosten is not null and g.preis > 0 then round(k.kosten / (g.preis / (1 + k.mwst / 100.0)), 4) end,
         case when k.kosten is not null and a.preis_neu > 0 then round(k.kosten / (a.preis_neu / (1 + k.mwst / 100.0)), 4) end
    from public.gerichte g
    left join lateral public.gericht_kosten_portion(g.id, p_stichtag) k on true
    left join lateral (
      select min(x.preis_neu) as preis_neu from public.aktionen x
       where x.betrieb_id = g.betrieb_id and x.gericht_name = g.name
         and coalesce(x.aktiv, true) and p_stichtag between x.von and x.bis
    ) a on true
   where g.betrieb_id = p_betrieb
     and (p_betrieb in (select public.meine_betriebe()) or public.ist_master())
   order by g.karte, g.kat_sort nulls last, g.kategorie, g.reihenfolge nulls last, g.id;
$function$;
revoke execute on function public.gericht_kalkulation(uuid, timestamptz) from public, anon;
grant  execute on function public.gericht_kalkulation(uuid, timestamptz) to authenticated;

-- ── 4 · Theoretischer Wareneinsatz ────────────────────────────────
-- Je verkaufter Position: gericht_id (ab dieser Migration) oder, für
-- ältere Bestellungen, der Name wie in positionen_pruefen. Kosten zum
-- Zeitpunkt der Bestellung. Storniertes, Markiertes und Servicerufe
-- zählen nicht (wie in der Auswertung).
create or replace function public.wareneinsatz_theoretisch(p_betrieb uuid, p_von timestamptz, p_bis timestamptz)
returns jsonb language sql stable security invoker set search_path = public as $function$
  with zeilen as (
    select b.zeitpunkt, (p ->> 'menge')::numeric as menge, (p ->> 'preis')::numeric as preis,
           coalesce(nullif(p ->> 'gericht_id', '')::uuid,
                    (select g.id from public.gerichte g
                      where g.betrieb_id = b.betrieb_id and g.name = btrim(split_part(p ->> 'name', ' (', 1))
                      order by g.id limit 1)) as gericht_id,
           (p ? 'gericht_id') as mit_id
      from public.bestellungen b, jsonb_array_elements(coalesce(b.positionen, '[]'::jsonb)) p
     where b.betrieb_id = p_betrieb and b.zeitpunkt >= p_von and b.zeitpunkt < p_bis
       and b.status <> 'storniert' and coalesce(b.pruefen, false) = false and b.quelle <> 'service'
       and (p_betrieb in (select public.meine_betriebe()) or public.ist_master())
  ), bewertet as (
    select z.*, (select k.kosten from public.gericht_kosten_portion(z.gericht_id, z.zeitpunkt) k) as kosten
      from zeilen z
  )
  select jsonb_build_object(
    'positionen', count(*),
    'portionen', coalesce(sum(menge), 0),
    'umsatz_brutto', round(coalesce(sum(menge * preis), 0), 2),
    'wareneinsatz', round(coalesce(sum(menge * kosten), 0), 2),
    'umsatz_mit_rezeptur', round(coalesce(sum(menge * preis) filter (where kosten is not null), 0), 2),
    'ohne_rezeptur', count(*) filter (where kosten is null),
    'ueber_namen', count(*) filter (where not mit_id and gericht_id is not null)
  ) from bewertet;
$function$;
revoke execute on function public.wareneinsatz_theoretisch(uuid, timestamptz, timestamptz) from public, anon;
grant  execute on function public.wareneinsatz_theoretisch(uuid, timestamptz, timestamptz) to authenticated;

-- ── 5 · positionen_pruefen: gericht_id in die Position ────────────
-- GLEICHE Signatur, gleicher Körper bis auf zwei Stellen: die id wird
-- mitgelesen und — nur wenn bekannt — als 'gericht_id' angehängt.
create or replace function public.positionen_pruefen(p_betrieb_id uuid, p_positionen jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  pos jsonb; v_name text; v_basis text; v_menge integer; v_gast numeric; v_preis numeric; v_aktion numeric; v_gid uuid;
  v_raus jsonb := '[]'::jsonb; v_summe numeric := 0; v_waren numeric := 0; v_unbekannt integer := 0; v_stueck integer := 0;
begin
  if p_positionen is null or jsonb_typeof(p_positionen) <> 'array' then
    return jsonb_build_object('fehler', 'Die Bestellung ist unvollständig. Bitte die Karte neu laden.');
  end if;
  if jsonb_array_length(p_positionen) > 40 then
    return jsonb_build_object('fehler', 'Zu viele Positionen in einer Bestellung. Bitte teilen Sie sie auf.');
  end if;
  for pos in select * from jsonb_array_elements(p_positionen) loop
    if jsonb_typeof(pos) <> 'object' then
      return jsonb_build_object('fehler', 'Die Bestellung ist unvollständig. Bitte die Karte neu laden.');
    end if;
    v_name := btrim(coalesce(pos->>'name', ''));
    if length(v_name) not between 1 and 160 then
      return jsonb_build_object('fehler', 'Die Bestellung ist unvollständig. Bitte die Karte neu laden.');
    end if;
    if coalesce(pos->>'menge', '1') !~ '^[0-9]{1,3}$' then
      return jsonb_build_object('fehler', 'Eine Menge stimmt nicht. Bitte die Karte neu laden.');
    end if;
    v_menge := coalesce(pos->>'menge', '1')::integer;
    if v_menge < 1 or v_menge > 30 then
      return jsonb_build_object('fehler', 'Höchstens 30 Stück je Gericht. Für mehr sprechen Sie bitte das Personal an.');
    end if;
    v_stueck := v_stueck + v_menge;
    v_basis := btrim(split_part(v_name, ' (', 1));
    v_gast := case when coalesce(pos->>'preis', '') ~ '^[0-9]{1,5}([.][0-9]+)?$'
                   then round((pos->>'preis')::numeric, 2) end;
    select g.preis, g.id into v_preis, v_gid from gerichte g
     where g.betrieb_id = p_betrieb_id and g.name = v_basis and g.verfuegbar
     order by g.id limit 1;
    if v_preis is null then
      v_unbekannt := v_unbekannt + 1;
      v_preis := least(coalesce(v_gast, 0), 500);
    else
      v_aktion := null;
      select least(v_preis, a.preis_neu) into v_aktion from aktionen a
       where a.betrieb_id = p_betrieb_id and a.gericht_name = v_basis
         and coalesce(a.aktiv, true) and now() between a.von and a.bis
       order by a.preis_neu asc, a.id limit 1;
      if v_aktion is not null then v_preis := v_aktion; end if;
      v_waren := v_waren + v_preis * v_menge;
      v_preis := least(greatest(coalesce(v_gast, v_preis), v_preis), v_preis + 12);
    end if;
    v_summe := v_summe + v_preis * v_menge;
    v_raus := v_raus || (jsonb_build_object('name', v_name, 'menge', v_menge, 'preis', round(v_preis, 2))
                         || case when v_gid is not null then jsonb_build_object('gericht_id', v_gid) else '{}'::jsonb end);
  end loop;
  if v_stueck > 100 then
    return jsonb_build_object('fehler', 'Sehr große Bestellung — bitte sprechen Sie kurz mit dem Personal.');
  end if;
  return jsonb_build_object('positionen', v_raus, 'summe', round(v_summe, 2),
                            'waren', round(v_waren, 2), 'unbekannt', v_unbekannt);
end $function$;
