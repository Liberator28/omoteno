-- ═══════════════════════════════════════════════════════════════════
--  migration-einkauf-e4.sql · Einkauf & Kosten, Stufe E4 · Ketten
--  (Plan: dokumente/plan-einkauf.md)
--
--  Was hier entsteht:
--   · Zuerst die Trennung der Preise. Bis E3 hatte jede Organisation
--     genau einen Betrieb; „letzter Preis in der Organisation“ war
--     „letzter Preis im Betrieb“. Nach dem Zusammenlegen wäre er der
--     Preis eines ANDEREN Standorts gewesen — gefunden an vier Stellen:
--       1. beleg_freigeben meldet 'vorher' aus der ganzen Organisation
--          (security definer — die Regeln greifen dort nicht),
--       2. inventur_buchen / verlust_buchen bewerten mit
--          artikel_letzter_preis(…, org) und geben den Wert zurück,
--       3. lieferanten_artikel.letzter_preis liest jedes Mitglied der
--          Organisation,
--       4. gericht_kosten_portion rechnet mit Preisen der Organisation
--          (im eigenen Aufruf durch die Regeln gefiltert, in einem
--          security-definer-Aufrufer nicht).
--     Alle vier rechnen jetzt mit den Preisen DES Betriebs. Ehrliche
--     Folge: Kauft ein Standort für einen anderen ein, kennt der andere
--     den Preis nicht (Umlagerung ist nicht Teil von E4).
--   · organisation_mitglieder mit der Rolle „zentrale“ (vom Master
--     vergeben, abschaltbar über aktiv — nichts wird gelöscht, §2.8).
--     Die Zentrale sieht ZAHLEN je Standort (zentrale_vergleich), keine
--     Belege, keine Gäste, keine Bestellungen.
--   · master_organisation_zusammenlegen: Betriebe, Artikel und
--     Lieferanten wandern in die Ziel-Organisation; gleichnamige Artikel
--     und Lieferanten bekommen den Standort als Zusatz, statt still
--     zusammengeführt zu werden (Belege und Rezepturen hängen an der id).
--   · rezeptur_uebertragen: gemeinsame Rezeptur — neue Fassung beim
--     gleichnamigen Gericht eines anderen Standorts derselben Kette.
--
--  Was geteilt ist und was nicht (Abnahme „A kann B nicht lesen“):
--   geteilt:  Artikelliste, Lieferanten (Name, Kd.-Nr., Kontakt),
--             gelernte Bezeichnungen OHNE Preis.
--   getrennt: Belege, Positionen, Preise, Bestand, Bewegungen,
--             Inventuren, Rezepturen, Bestellungen — wie bisher je Betrieb.
--
--  ANGEWENDET 12.10. (apply_migration einkauf_e4). Nachgelesen: je
--  Funktion eine Signatur, beleg_freigeben vergleicht mit
--  pr.betrieb_id = b.betrieb_id, letzter_preis für authenticated nicht
--  lesbar (bezeichnung schon), keine neue Funktion für anon.
--  Zurückgedrehte Probe datenbank/pruef-einkauf-e4.sql, live:
--   · Nicht-Master/Zentrale: zusammenlegen, Zentrale setzen, master_ketten
--     → kein_recht. Master: gleich, kein_konto; zusammenlegen B → A:
--     1 Betrieb, 1 Artikel, 1 Lieferant, 2 umbenannt („Probe-Mehl E4 ·
--     MINHKEEY · Asia Streetfood“), Protokollzeile mit organisation_id.
--   · A liest von B: Belege/Positionen/Preise/Bestand/Bewegungen 0/0/0/0/0,
--     letzter_preis 42501, meine_ketten 0, Vergleich 0, Kalkulation 0,
--     Wareneinsatz 0. A sieht die geteilten Artikel (beide „Mehl“).
--   · Verlust auf B's Mehl in A ohne eigenen Preis: Wert null (vorher
--     wäre es B's 0,002 €/g gewesen); Einkauf in A zu 0,0012 €/g:
--     preisaenderungen [] (vorher: −40 % gegen B); danach −1,20.
--   · Zentrale: meine_ketten 1 (2 Standorte), Vergleich A 50,00 € (2) /
--     Lager 48,80 / Verlust −1,20, B 50,00 € (1) / Lager 50,00; rohe
--     Belege 0; 500 Tage → 0 Zeilen; Rezeptur A → B neue Fassung
--     „Übernommen von …“; kein_gericht, andere_kette (Ziel = Quelle,
--     andere Kette), keine_rezeptur; zusammenlegen → kein_recht.
--   · Inhaber beider Standorte: 1 Kette, 2 Zeilen. Zentrale aus → 0 / 0.
--   · anon: Vergleich, master_ketten, organisation_mitglieder → 42501.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Preise je Betrieb ─────────────────────────────────────────
create or replace function public.artikel_preis_betrieb(p_artikel uuid, p_betrieb uuid)
returns numeric language sql stable security definer set search_path = public as $function$
  select pr.preis_basis from public.artikel_preise pr
   where pr.artikel_id = p_artikel and pr.betrieb_id = p_betrieb
   order by pr.belegdatum desc, pr.position_id desc limit 1;
$function$;
revoke execute on function public.artikel_preis_betrieb(uuid, uuid) from public, anon, authenticated;

-- beleg_freigeben: gleiche Signatur, nur der Vergleichspreis wird auf
-- den Betrieb des Belegs eingeschränkt. Die Funktion ist lang; ersetzt
-- wird genau EINE Stelle der Live-Fassung, sonst bricht die Migration ab.
do $$
declare d text; alt text; neu text; n int;
begin
  d := pg_get_functiondef('public.beleg_freigeben(uuid)'::regprocedure);
  -- Live steht die Stelle OHNE den Kommentar aus migration-einkauf.sql
  -- (Rumpf sonst gleich, md5 ohne Kommentare/Leerraum verglichen, §1.4).
  alt := E'select pr.preis_basis into v_alt from public.artikel_preise pr join public.betriebe bb on bb.id = pr.betrieb_id\n       where pr.artikel_id = v_artikel and bb.organisation_id = v_org';
  neu := E'select pr.preis_basis into v_alt from public.artikel_preise pr\n       where pr.artikel_id = v_artikel and pr.betrieb_id = b.betrieb_id';
  n := (length(d) - length(replace(d, alt, ''))) / length(alt);
  if n = 0 and position(neu in d) > 0 then return; end if;   -- schon eingespielt
  if n <> 1 then raise exception 'beleg_freigeben: Vergleichsstelle % mal gefunden', n; end if;
  execute replace(d, alt, neu);
end $$;

-- inventur_buchen / verlust_buchen: gleiche Signatur, Wert aus dem
-- Preis des Betriebs (artikel_letzter_preis bleibt, ruft niemand mehr).
create or replace function public.inventur_buchen(p_betrieb uuid, p_zaehlung jsonb, p_notiz text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  v_org uuid; z jsonb; v_art uuid; v_menge numeric; v_ist numeric; v_diff numeric; v_preis numeric;
  v_inv uuid; n int := 0; v_wert numeric := 0; i int := 0;
begin
  if not public.ist_inhaber(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if jsonb_typeof(p_zaehlung) is distinct from 'array' or jsonb_array_length(p_zaehlung) = 0 or jsonb_array_length(p_zaehlung) > 500 then
    return jsonb_build_object('ok', false, 'grund', 'zaehlung');
  end if;
  if p_notiz is not null and length(p_notiz) > 200 then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  select organisation_id into v_org from public.betriebe where id = p_betrieb;
  -- Erst alles prüfen, dann schreiben.
  for z in select value from jsonb_array_elements(p_zaehlung) loop
    i := i + 1;
    begin
      v_art := (z ->> 'artikel_id')::uuid; v_menge := (z ->> 'menge')::numeric;
    exception when others then return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'zahl'); end;
    if v_menge is null or v_menge < 0 then return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'menge'); end if;
    if not exists (select 1 from public.artikel a where a.id = v_art and a.organisation_id = v_org) then
      return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'artikel');
    end if;
  end loop;
  insert into public.inventuren (betrieb_id, nutzer_id, notiz) values (p_betrieb, auth.uid(), nullif(btrim(p_notiz), '')) returning id into v_inv;
  for z in select value from jsonb_array_elements(p_zaehlung) loop
    v_art := (z ->> 'artikel_id')::uuid; v_menge := (z ->> 'menge')::numeric;
    select coalesce(sum(menge_basis), 0) into v_ist from public.lagerbewegungen where betrieb_id = p_betrieb and artikel_id = v_art;
    v_diff := v_menge - v_ist;
    continue when v_diff = 0;
    v_preis := public.artikel_preis_betrieb(v_art, p_betrieb);
    insert into public.lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, inventur_id, nutzer_id, notiz)
    values (p_betrieb, v_art, 'inventur', v_diff, round(v_diff * v_preis, 2), v_inv, auth.uid(), 'Inventur');
    n := n + 1; v_wert := v_wert + coalesce(round(v_diff * v_preis, 2), 0);
  end loop;
  update public.inventuren set positionen = n, differenz_wert = v_wert where id = v_inv;
  return jsonb_build_object('ok', true, 'id', v_inv, 'buchungen', n, 'differenz_wert', v_wert);
end $function$;

create or replace function public.verlust_buchen(p_betrieb uuid, p_artikel uuid, p_menge numeric, p_notiz text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_org uuid; v_preis numeric;
begin
  if not public.ist_inhaber(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if p_menge is null or p_menge <= 0 then return jsonb_build_object('ok', false, 'grund', 'menge'); end if;
  if p_notiz is not null and length(p_notiz) > 200 then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  select organisation_id into v_org from public.betriebe where id = p_betrieb;
  if not exists (select 1 from public.artikel a where a.id = p_artikel and a.organisation_id = v_org) then
    return jsonb_build_object('ok', false, 'grund', 'artikel');
  end if;
  v_preis := public.artikel_preis_betrieb(p_artikel, p_betrieb);
  insert into public.lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, nutzer_id, notiz)
  values (p_betrieb, p_artikel, 'verlust', -p_menge, round(-p_menge * v_preis, 2), auth.uid(), coalesce(nullif(btrim(p_notiz), ''), 'Verlust'));
  return jsonb_build_object('ok', true, 'wert', round(-p_menge * v_preis, 2));
end $function$;

-- gericht_kosten_portion: gleiche Signatur, Preise des Betriebs der Rezeptur.
create or replace function public.gericht_kosten_portion(p_gericht uuid, p_stichtag timestamptz default now())
returns table (rezeptur_id uuid, gueltig_ab timestamptz, portionen numeric, mwst smallint, kosten numeric, positionen int, ohne_preis int)
language sql stable security invoker set search_path = public as $function$
  with r as (
    select r.* from public.rezepturen r
     where r.gericht_id = p_gericht and r.gueltig_ab <= p_stichtag
     order by r.gueltig_ab desc, r.id desc limit 1
  ), zeilen as (
    select rp.artikel_id, rp.menge_basis * (1 + rp.verlust_prozent / 100) as menge,
           (select pr.preis_basis from public.artikel_preise pr
             where pr.artikel_id = rp.artikel_id and pr.betrieb_id = r.betrieb_id
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

-- Die gelernte Zuordnung bleibt geteilt, ihr Preis nicht: Er ist der
-- Preis des Standorts, der zuletzt freigegeben hat.
revoke select on public.lieferanten_artikel from authenticated;
grant select (id, lieferant_id, artikel_id, bezeichnung, artikelnummer, einkaufseinheit, gebinde_basis, angelegt)
  on public.lieferanten_artikel to authenticated;

-- ── 2 · Zentrale ──────────────────────────────────────────────────
create table if not exists public.organisation_mitglieder (
  organisation_id uuid not null references public.organisationen(id),
  nutzer_id       uuid not null references auth.users(id),
  rolle           text not null default 'zentrale' check (rolle in ('zentrale')),
  aktiv           boolean not null default true,
  angelegt        timestamptz not null default now(),
  geaendert_von   uuid,
  primary key (organisation_id, nutzer_id)
);
alter table public.organisation_mitglieder enable row level security;
revoke all on public.organisation_mitglieder from anon, authenticated;
grant select on public.organisation_mitglieder to authenticated;
do $$ begin
  create policy "zentrale liest eigene" on public.organisation_mitglieder for select to authenticated
    using (nutzer_id = auth.uid() or public.ist_master());
exception when duplicate_object then null; end $$;

-- Zentrale = aktive Zeile UND die PIN, wenn das Konto eine hat oder ein
-- Standort sie verlangt (wie meine_betriebe / ist_master).
create or replace function public.ist_zentrale(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $function$
  select exists (select 1 from public.organisation_mitglieder m
                  where m.organisation_id = p_org and m.nutzer_id = auth.uid() and m.aktiv and m.rolle = 'zentrale')
     and (public.pin_ok()
          or not (exists (select 1 from public.konto_pin where nutzer_id = auth.uid())
                  or exists (select 1 from public.betriebe b where b.organisation_id = p_org and b.pin_pflicht)));
$function$;
revoke execute on function public.ist_zentrale(uuid) from public, anon;
grant  execute on function public.ist_zentrale(uuid) to authenticated;   -- sagt nur etwas über sich selbst

-- Vergleichen darf: Master, Zentrale der Kette, oder wer Inhaber JEDES
-- Standorts der Kette ist (wer zwei Läden selbst führt, braucht keine Zentrale).
create or replace function public.darf_vergleichen_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $function$
  select p_org is not null and (
         public.ist_master() or public.ist_zentrale(p_org)
      or (exists (select 1 from public.betriebe b where b.organisation_id = p_org)
          and not exists (select 1 from public.betriebe b where b.organisation_id = p_org and not public.ist_inhaber(b.id))));
$function$;
create or replace function public.darf_vergleichen(p_betrieb uuid)
returns boolean language sql stable security definer set search_path = public as $function$
  select public.darf_vergleichen_org((select organisation_id from public.betriebe where id = p_betrieb));
$function$;
revoke execute on function public.darf_vergleichen_org(uuid) from public, anon;
revoke execute on function public.darf_vergleichen(uuid) from public, anon;
grant  execute on function public.darf_vergleichen_org(uuid) to authenticated;   -- steht in wareneinsatz_theoretisch (§2.7)
grant  execute on function public.darf_vergleichen(uuid) to authenticated;

-- wareneinsatz_theoretisch: gleiche Signatur, die Zentrale darf rechnen
-- lassen. Ruft sie es selbst auf, filtern die Regeln der Bestellungen
-- trotzdem auf null — Zahlen bekommt sie nur über zentrale_vergleich.
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
       and (p_betrieb in (select public.meine_betriebe()) or public.ist_master() or public.darf_vergleichen(p_betrieb))
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

-- Ketten, die ich vergleichen darf — nur solche mit mehr als einem Standort.
create or replace function public.meine_ketten()
returns table (organisation_id uuid, name text, standorte int, zentrale boolean)
language sql stable security definer set search_path = public as $function$
  select o.id, o.name, count(b.id)::int, public.ist_zentrale(o.id)
    from public.organisationen o join public.betriebe b on b.organisation_id = o.id
   where (o.id in (select m.organisation_id from public.organisation_mitglieder m where m.nutzer_id = auth.uid() and m.aktiv)
          or o.id in (select public.meine_organisationen()))
     and public.darf_vergleichen_org(o.id)
   group by o.id, o.name
  having count(b.id) > 1
   order by o.name, o.id;
$function$;
revoke execute on function public.meine_ketten() from public, anon;
grant  execute on function public.meine_ketten() to authenticated;

-- Zahlen je Standort. Ohne Recht keine Zeile (kein Werfen, §2.3g).
-- Zeitraum höchstens 400 Tage.
create or replace function public.zentrale_vergleich(p_org uuid, p_von timestamptz, p_bis timestamptz)
returns table (betrieb_id uuid, name text, einkauf_netto numeric, belege int, lagerwert numeric,
               verlust_wert numeric, inventur_wert numeric, umsatz_brutto numeric, wareneinsatz numeric,
               umsatz_mit_rezeptur numeric, ohne_rezeptur int, gerichte int, mit_rezeptur int)
language sql stable security definer set search_path = public as $function$
  select b.id, b.name,
         coalesce((select sum(e.netto) from public.einkaufsbelege e where e.betrieb_id = b.id and e.status = 'freigegeben'
                    and e.belegdatum >= (p_von at time zone 'Europe/Berlin')::date and e.belegdatum <= (p_bis at time zone 'Europe/Berlin')::date), 0),
         (select count(*)::int from public.einkaufsbelege e where e.betrieb_id = b.id and e.status = 'freigegeben'
                    and e.belegdatum >= (p_von at time zone 'Europe/Berlin')::date and e.belegdatum <= (p_bis at time zone 'Europe/Berlin')::date),
         coalesce((select sum(l.wert_netto) from public.lagerbestand l where l.betrieb_id = b.id), 0),
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
revoke execute on function public.zentrale_vergleich(uuid, timestamptz, timestamptz) from public, anon;
grant  execute on function public.zentrale_vergleich(uuid, timestamptz, timestamptz) to authenticated;

-- ── 3 · Master: Ketten bilden, Zentrale vergeben ─────────────────
create or replace function public.master_ketten()
returns jsonb language sql stable security definer set search_path = public as $function$
  select case when not public.ist_master() then jsonb_build_object('ok', false, 'grund', 'kein_recht')
  else jsonb_build_object('ok', true, 'organisationen', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'name', o.name,
             'betriebe', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'slug', b.slug) order by b.name, b.id), '[]'::jsonb)
                            from public.betriebe b where b.organisation_id = o.id),
             'zentrale', (select coalesce(jsonb_agg(jsonb_build_object('nutzer_id', m.nutzer_id, 'email', u.email) order by u.email, m.nutzer_id), '[]'::jsonb)
                            from public.organisation_mitglieder m join auth.users u on u.id = m.nutzer_id
                           where m.organisation_id = o.id and m.aktiv))
           order by o.name, o.id)
      from public.organisationen o where exists (select 1 from public.betriebe b where b.organisation_id = o.id)), '[]'::jsonb)) end;
$function$;
revoke execute on function public.master_ketten() from public, anon;
grant  execute on function public.master_ketten() to authenticated;

create or replace function public.master_organisation_zusammenlegen(p_ziel uuid, p_quelle uuid, p_name text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_zusatz text; r record; v_name text; k int; n_art int := 0; n_lief int := 0; n_um int := 0; n_betr int;
begin
  if not public.ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if p_ziel is null or p_quelle is null or p_ziel = p_quelle then return jsonb_build_object('ok', false, 'grund', 'gleich'); end if;
  if not exists (select 1 from public.organisationen where id = p_ziel) or not exists (select 1 from public.organisationen where id = p_quelle) then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;
  if p_name is not null and length(btrim(p_name)) not between 1 and 120 then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  select left(coalesce(string_agg(b.name, ', ' order by b.name, b.id), max(o.name)), 40) into v_zusatz
    from public.organisationen o left join public.betriebe b on b.organisation_id = o.id where o.id = p_quelle;
  -- Gleicher Name in der Ziel-Kette → Zusatz „· Standort“, nie still verschmelzen.
  for r in select a.id, a.name from public.artikel a where a.organisation_id = p_quelle order by a.name, a.id loop
    v_name := btrim(r.name); k := 1;
    while exists (select 1 from public.artikel x where x.organisation_id = p_ziel and lower(btrim(x.name)) = lower(v_name)) loop
      v_name := left(btrim(r.name), 120 - length(v_zusatz) - 6) || ' · ' || v_zusatz || case when k > 1 then ' ' || k else '' end;
      k := k + 1;
    end loop;
    if v_name <> btrim(r.name) then n_um := n_um + 1; end if;
    update public.artikel set organisation_id = p_ziel, name = v_name where id = r.id;
    n_art := n_art + 1;
  end loop;
  for r in select l.id, l.name from public.lieferanten l where l.organisation_id = p_quelle order by l.name, l.id loop
    v_name := btrim(r.name); k := 1;
    while exists (select 1 from public.lieferanten x where x.organisation_id = p_ziel and lower(btrim(x.name)) = lower(v_name)) loop
      v_name := left(btrim(r.name), 120 - length(v_zusatz) - 6) || ' · ' || v_zusatz || case when k > 1 then ' ' || k else '' end;
      k := k + 1;
    end loop;
    if v_name <> btrim(r.name) then n_um := n_um + 1; end if;
    update public.lieferanten set organisation_id = p_ziel, name = v_name where id = r.id;
    n_lief := n_lief + 1;
  end loop;
  update public.betriebe set organisation_id = p_ziel where organisation_id = p_quelle;
  get diagnostics n_betr = row_count;
  if p_name is not null then update public.organisationen set name = btrim(p_name) where id = p_ziel; end if;
  return jsonb_build_object('ok', true, 'betriebe', n_betr, 'artikel', n_art, 'lieferanten', n_lief, 'umbenannt', n_um);
end $function$;
revoke execute on function public.master_organisation_zusammenlegen(uuid, uuid, text) from public, anon;
grant  execute on function public.master_organisation_zusammenlegen(uuid, uuid, text) to authenticated;

create or replace function public.master_zentrale_setzen(p_org uuid, p_email text, p_an boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_nutzer uuid;
begin
  if not public.ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if not exists (select 1 from public.organisationen where id = p_org) then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  if p_email is null or length(btrim(p_email)) not between 3 and 254 or p_an is null then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  select id into v_nutzer from auth.users where lower(email) = lower(btrim(p_email)) order by created_at, id limit 1;
  if v_nutzer is null then return jsonb_build_object('ok', false, 'grund', 'kein_konto'); end if;
  insert into public.organisation_mitglieder (organisation_id, nutzer_id, rolle, aktiv, geaendert_von)
  values (p_org, v_nutzer, 'zentrale', p_an, auth.uid())
  on conflict (organisation_id, nutzer_id) do update set aktiv = excluded.aktiv, geaendert_von = excluded.geaendert_von;
  return jsonb_build_object('ok', true, 'aktiv', p_an);
end $function$;
revoke execute on function public.master_zentrale_setzen(uuid, text, boolean) from public, anon;
grant  execute on function public.master_zentrale_setzen(uuid, text, boolean) to authenticated;

-- ── 4 · Gemeinsame Rezeptur ───────────────────────────────────────
-- Kopiert die gültige Fassung als NEUE Fassung zum gleichnamigen
-- Gericht eines anderen Standorts derselben Kette. Artikel sind in der
-- Kette geteilt; Preise nicht — die Kosten rechnet jeder Standort selbst.
create or replace function public.rezeptur_uebertragen(p_gericht uuid, p_ziel_betrieb uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_quelle uuid; v_name text; v_org uuid; v_ziel_org uuid; v_rz record; v_ziel_g uuid; v_neu uuid; v_qname text;
begin
  select g.betrieb_id, g.name into v_quelle, v_name from public.gerichte g where g.id = p_gericht;
  select organisation_id, name into v_org, v_qname from public.betriebe where id = v_quelle;
  select organisation_id into v_ziel_org from public.betriebe where id = p_ziel_betrieb;
  if v_quelle is null or v_ziel_org is null then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if not ((public.ist_inhaber(v_quelle) and public.ist_inhaber(p_ziel_betrieb)) or public.ist_zentrale(v_org) or public.ist_master()) then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  if v_org is distinct from v_ziel_org or v_quelle = p_ziel_betrieb then return jsonb_build_object('ok', false, 'grund', 'andere_kette'); end if;
  select r.id, r.portionen, r.mwst into v_rz from public.rezepturen r
   where r.gericht_id = p_gericht and r.gueltig_ab <= now() order by r.gueltig_ab desc, r.id desc limit 1;
  if v_rz.id is null then return jsonb_build_object('ok', false, 'grund', 'keine_rezeptur'); end if;
  select g.id into v_ziel_g from public.gerichte g
   where g.betrieb_id = p_ziel_betrieb and lower(btrim(g.name)) = lower(btrim(v_name)) order by g.id limit 1;
  if v_ziel_g is null then return jsonb_build_object('ok', false, 'grund', 'kein_gericht'); end if;
  insert into public.rezepturen (betrieb_id, gericht_id, portionen, mwst, notiz, angelegt_von)
  values (p_ziel_betrieb, v_ziel_g, v_rz.portionen, v_rz.mwst, left('Übernommen von ' || coalesce(v_qname, 'Standort'), 300), auth.uid())
  returning id into v_neu;
  insert into public.rezepturpositionen (rezeptur_id, artikel_id, menge_basis, verlust_prozent)
  select v_neu, rp.artikel_id, rp.menge_basis, rp.verlust_prozent from public.rezepturpositionen rp where rp.rezeptur_id = v_rz.id;
  return jsonb_build_object('ok', true, 'id', v_neu, 'gericht_id', v_ziel_g);
end $function$;
revoke execute on function public.rezeptur_uebertragen(uuid, uuid) from public, anon;
grant  execute on function public.rezeptur_uebertragen(uuid, uuid) to authenticated;
