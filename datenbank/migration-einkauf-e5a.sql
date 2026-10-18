-- ═══════════════════════════════════════════════════════════════════
--  EINKAUF E5-A · Mehrere Standorte verlässlich: was heute schon trifft
--
--  Gelesen am 17.10. aus dem Live-Katalog (pg_get_functiondef), nicht
--  aus den Dateien vermutet:
--
--   1 · ki_kontingent_nehmen(p_anzahl) bucht auf
--       `select b from meine_betriebe() b limit 1` — ohne Sortierung.
--       Wer zwei Standorte hat, liest in B ein und zahlt aus dem
--       Kontingent eines beliebigen Standorts. Neu: p_betrieb (Vorgabe
--       null = wie bisher, aber fest der kleinste), Mitgliedschaft
--       geprüft. Die alte Fassung wandert nach `archiv` (kein drop,
--       §2.8) — zwei Fassungen in public machten den Aufruf mit nur
--       p_anzahl für PostgREST mehrdeutig (§2.1).
--   2 · „Letzter Preis“ bei gleichem Belegdatum entschied über
--       position_id, eine Zufalls-UUID. Neu: belegdatum, freigegeben_am,
--       pos, id. Die Spalte freigegeben_am gab es schon (beleg_freigeben
--       setzt sie) — nur gelesen hat sie niemand (§1.2). artikel_preise
--       bekommt sie und pos als neue Spalten HINTEN (create or replace
--       view erlaubt nur Anhängen), security_invoker bleibt.
--   3 · Doppelte Belegnummer: Die Prüfung reicht über die ganze Kette
--       (der Lieferant gehört der Organisation) und gab die id des
--       FREMDEN Standorts zurück. Neu: im eigenen Standort `doppelt`
--       mit id, sonst `doppelt_standort` mit dem Namen — ohne id.
--   4 · Gleiche Datei an einem anderen Standort derselben Kette: der
--       Entwurf entsteht trotzdem (§7), die Antwort trägt den Hinweis
--       `datei_doppelt_standort` mit dem Standortnamen.
--   5 · Zwei gleichzeitige Freigaben mit derselben Nummer: die zweite
--       lief in den eindeutigen Index und warf. Neu: Positionen,
--       Bewegungen und Statuswechsel in EINEM Block; unique_violation →
--       alles darin zurück, Grund `doppelt` (§2.3g: Antwort statt Wurf).
--   6 · Belegdatum: nicht mehr als einen Tag in der Zukunft, nicht
--       älter als 400 Tage (Berliner Tag), sonst Grund `datum`. Ohne
--       Datum gilt der Berliner Tag, nicht current_date (UTC — nach
--       Mitternacht stand der Beleg auf gestern).
--   7 · Gelernte Zuordnung (lieferanten_artikel) wurde bei der Freigabe
--       still überschrieben. Sie wird weiter übernommen — die neuere
--       Entscheidung ist die bessere Kenntnis —, aber die Antwort nennt
--       jede Änderung (`zuordnungen`: Bezeichnung, vorher/jetzt Artikel
--       und Gebinde). Gebinde je Standort folgt in E5-C.
--  10 · Sechs Indizes für die Wege, die mit mehreren Standorten wachsen.
--
--  Additiv (§2.5). Keine Zeile beginnt mit drop oder delete (§2.8).
--  Probe: datenbank/pruef-einkauf-e5a.sql (zurückgedreht).
--
--  ANGEWENDET 17.10. (apply_migration einkauf_e5a), Probe live grün:
--   · public kennt nur ki_kontingent_nehmen(p_anzahl, p_betrieb); die
--     alte liegt in archiv, ohne EXECUTE für anon/authenticated; jede
--     geänderte Funktion genau einmal; artikel_preise security_invoker.
--   · A bucht 6 auf B → B 6, A 0; ohne Standort → fest der kleinste
--     Betrieb; fremder Standort, 0 und 26 Texte → -1; anon 42501.
--   · 10 Belege am selben Tag, Preis 1…10 €: letzter Preis 0,010000
--     (= zuletzt freigegeben; vorher Zufall über die UUID).
--   · Nummer im eigenen Standort → doppelt mit id; in B → doppelt_standort
--     „Choco L'AMouR“ ohne id. Datum +2 / −401 / 2026-13-32 → datum,
--     morgen geht, ohne Datum = Berliner Tag.
--   · Gleiche Datei in B → Entwurf + Hinweis mit Namen, keine fremde id;
--     andere Kette → kein Hinweis.
--   · unique_violation beim Statuswechsel (Auslöser in der Probe) →
--     {grund: doppelt}, danach entwurf/0 Positionen/0 Bewegungen.
--   · Andere Zuordnung derselben Bezeichnung → zuordnungen nennt Artikel
--     und Gebinde vorher/jetzt; gleiche Zuordnung → [].
--   · Mit 4000 erzeugten Bewegungen: Index Scan über
--     lagerbewegungen_betrieb_art_zeit (live gibt es noch keine Zeile —
--     einen Plan an Chocos Daten kann es erst mit Daten geben).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Kontingent am richtigen Standort ─────────────────────────────
create schema if not exists archiv;
revoke all on schema archiv from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'ki_kontingent_nehmen'
                and pg_get_function_identity_arguments(p.oid) = 'p_anzahl integer') then
    alter function public.ki_kontingent_nehmen(integer) rename to ki_kontingent_nehmen_vor_e5;
    alter function public.ki_kontingent_nehmen_vor_e5(integer) set schema archiv;
    revoke execute on function archiv.ki_kontingent_nehmen_vor_e5(integer) from public, anon, authenticated;
  end if;
end $$;

create or replace function public.ki_kontingent_nehmen(p_anzahl integer, p_betrieb uuid default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_betrieb uuid; v_tag date := (now() at time zone 'Europe/Berlin')::date;
  v_grenze integer := 400; v_jetzt integer; v_plan text; v_alt timestamptz;
begin
  if ist_master() then return 999999; end if;
  if p_anzahl is null or p_anzahl < 1 or p_anzahl > 25 then return -1; end if;
  if p_betrieb is not null then
    select b into v_betrieb from meine_betriebe() b where b = p_betrieb;
  else
    select b into v_betrieb from meine_betriebe() b order by b limit 1;
  end if;
  if v_betrieb is null then return -1; end if;
  select plan, angelegt into v_plan, v_alt from betriebe where id = v_betrieb;
  if v_plan is null and v_alt > now() - interval '7 days' then v_grenze := 60; end if;
  insert into ki_kontingent(betrieb_id, tag, texte) values (v_betrieb, v_tag, 0) on conflict (betrieb_id, tag) do nothing;
  update ki_kontingent set texte = texte + p_anzahl
   where betrieb_id = v_betrieb and tag = v_tag and texte + p_anzahl <= v_grenze
  returning texte into v_jetzt;
  if v_jetzt is null then return -1; end if;
  return v_grenze - v_jetzt;
end $$;
revoke execute on function public.ki_kontingent_nehmen(integer, uuid) from public, anon;
grant execute on function public.ki_kontingent_nehmen(integer, uuid) to authenticated;

-- ── 2 · Fester „letzter Preis“ ───────────────────────────────────────
create or replace view public.artikel_preise with (security_invoker = true) as
 select p.artikel_id, e.betrieb_id, e.lieferant_id, e.belegdatum, e.id as beleg_id, p.id as position_id,
        round(p.netto / nullif(p.menge_basis, 0::numeric), 6) as preis_basis,
        e.freigegeben_am, p.pos
   from public.einkaufspositionen p
   join public.einkaufsbelege e on e.id = p.beleg_id
  where e.status = 'freigegeben'::text and p.art = 'ware'::text and p.artikel_id is not null;

create or replace function public.artikel_preis_betrieb(p_artikel uuid, p_betrieb uuid)
returns numeric language sql stable security definer set search_path = public
as $$
  select pr.preis_basis from public.artikel_preise pr
   where pr.artikel_id = p_artikel and pr.betrieb_id = p_betrieb
   order by pr.belegdatum desc, pr.freigegeben_am desc nulls last, pr.pos desc, pr.position_id desc limit 1;
$$;

create or replace function public.artikel_letzter_preis(p_artikel uuid, p_org uuid)
returns numeric language sql stable security definer set search_path = public
as $$
  select pr.preis_basis from public.artikel_preise pr join public.betriebe b on b.id = pr.betrieb_id
   where pr.artikel_id = p_artikel and b.organisation_id = p_org
   order by pr.belegdatum desc, pr.freigegeben_am desc nulls last, pr.pos desc, pr.position_id desc limit 1;
$$;

create or replace function public.gericht_kosten_portion(p_gericht uuid, p_stichtag timestamptz default now())
returns table(rezeptur_id uuid, gueltig_ab timestamptz, portionen numeric, mwst smallint, kosten numeric, positionen integer, ohne_preis integer)
language sql stable set search_path = public
as $$
  with r as (
    select r.* from public.rezepturen r
     where r.gericht_id = p_gericht and r.gueltig_ab <= p_stichtag
     order by r.gueltig_ab desc, r.id desc limit 1
  ), zeilen as (
    select rp.artikel_id, rp.menge_basis * (1 + rp.verlust_prozent / 100) as menge,
           (select pr.preis_basis from public.artikel_preise pr
             where pr.artikel_id = rp.artikel_id and pr.betrieb_id = r.betrieb_id
               and pr.belegdatum <= (p_stichtag at time zone 'Europe/Berlin')::date
             order by pr.belegdatum desc, pr.freigegeben_am desc nulls last, pr.pos desc, pr.position_id desc limit 1) as preis
      from public.rezepturpositionen rp join r on rp.rezeptur_id = r.id
  )
  select r.id, r.gueltig_ab, r.portionen, r.mwst,
         round((select sum(z.menge * z.preis) from zeilen z) / r.portionen, 4),
         (select count(*)::int from zeilen),
         (select count(*)::int from zeilen z where z.preis is null)
    from r;
$$;

-- ── 4 + 6 · Speichern: Datum plausibel, Datei an anderem Standort ────
create or replace function public.beleg_speichern(p_beleg uuid, p_betrieb uuid, p_daten jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := p_beleg;
  v_status text;
  v_betrieb uuid;
  v_lief uuid;
  v_pos jsonb := coalesce(p_daten -> 'positionen', '[]'::jsonb);
  v_pfad text := nullif(btrim(p_daten ->> 'datei_pfad'), '');
  v_hash text := lower(nullif(btrim(p_daten ->> 'datei_hash'), ''));
  v_quelle text := coalesce(nullif(p_daten ->> 'quelle', ''), 'manuell');
  v_vorhanden uuid;
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_datum date;
  v_anderswo text;
begin
  begin
    v_lief := nullif(p_daten ->> 'lieferant_id', '')::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('ok', false, 'grund', 'lieferant');
  end;
  begin
    v_datum := nullif(p_daten ->> 'belegdatum', '')::date;
  exception when others then
    return jsonb_build_object('ok', false, 'grund', 'datum');
  end;
  if v_datum is not null and (v_datum > v_heute + 1 or v_datum < v_heute - 400) then
    return jsonb_build_object('ok', false, 'grund', 'datum', 'heute', v_heute);
  end if;
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
  if v_id is null and v_pfad is not null then
    if v_pfad !~ ('^' || v_betrieb::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|pdf)$') then
      return jsonb_build_object('ok', false, 'grund', 'datei');
    end if;
  end if;
  if v_id is null and v_hash is not null then
    select id into v_vorhanden from public.einkaufsbelege
     where betrieb_id = v_betrieb and datei_hash = v_hash and status <> 'verworfen' limit 1;
    if v_vorhanden is not null then return jsonb_build_object('ok', false, 'grund', 'datei_doppelt', 'beleg', v_vorhanden); end if;
    /* Dieselbe Datei an einem anderen Standort DERSELBEN Kette: nur ein
       Hinweis mit dem Namen, keine fremde id (§7: Entwurf entsteht). */
    select ob.name into v_anderswo
      from public.einkaufsbelege e
      join public.betriebe ob on ob.id = e.betrieb_id
      join public.betriebe mb on mb.id = v_betrieb
     where e.datei_hash = v_hash and e.status <> 'verworfen' and e.betrieb_id <> v_betrieb
       and ob.organisation_id = mb.organisation_id
     order by e.angelegt, e.id limit 1;
  end if;
  begin
    if v_id is null then
      insert into public.einkaufsbelege (betrieb_id, lieferant_id, belegnummer, belegdatum, netto, steuer, brutto,
                                         quelle, notiz, positionen_entwurf, angelegt_von, datei_pfad, datei_hash)
      values (v_betrieb, v_lief, nullif(btrim(p_daten ->> 'belegnummer'), ''),
              coalesce(v_datum, v_heute),
              nullif(p_daten ->> 'netto', '')::numeric, nullif(p_daten ->> 'steuer', '')::numeric,
              nullif(p_daten ->> 'brutto', '')::numeric,
              v_quelle, nullif(btrim(p_daten ->> 'notiz'), ''),
              v_pos, auth.uid(), v_pfad, v_hash)
      returning id into v_id;
    else
      update public.einkaufsbelege set
        lieferant_id = v_lief,
        belegnummer = nullif(btrim(p_daten ->> 'belegnummer'), ''),
        belegdatum = coalesce(v_datum, belegdatum),
        netto = nullif(p_daten ->> 'netto', '')::numeric,
        steuer = nullif(p_daten ->> 'steuer', '')::numeric,
        brutto = nullif(p_daten ->> 'brutto', '')::numeric,
        notiz = nullif(btrim(p_daten ->> 'notiz'), ''),
        positionen_entwurf = v_pos
      where id = v_id;
    end if;
  exception when data_exception or check_violation then
    return jsonb_build_object('ok', false, 'grund', 'form', 'text', sqlerrm);
  when unique_violation then
    return jsonb_build_object('ok', false, 'grund', 'datei_doppelt');
  end;
  if v_anderswo is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'hinweis', 'datei_doppelt_standort', 'standort', v_anderswo);
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- ── 2 + 3 + 5 + 7 · Freigeben ────────────────────────────────────────
create or replace function public.beleg_freigeben(p_beleg uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
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
  v_zuordnungen jsonb := '[]'::jsonb;
  v_fehlt jsonb := '[]'::jsonb;
  v_doppelt uuid; v_doppelt_betrieb uuid; v_doppelt_name text;
  v_la record;
begin
  select * into b from public.einkaufsbelege where id = p_beleg for update;
  if b.id is null or not public.ist_inhaber(b.betrieb_id) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if b.status <> 'entwurf' then return jsonb_build_object('ok', false, 'grund', 'nicht_entwurf'); end if;
  if b.lieferant_id is null then return jsonb_build_object('ok', false, 'grund', 'kein_lieferant'); end if;
  if b.belegnummer is null then return jsonb_build_object('ok', false, 'grund', 'keine_nummer'); end if;
  if b.netto is null then return jsonb_build_object('ok', false, 'grund', 'keine_summe'); end if;
  if jsonb_array_length(b.positionen_entwurf) = 0 then return jsonb_build_object('ok', false, 'grund', 'keine_positionen'); end if;
  select organisation_id into v_org from public.betriebe where id = b.betrieb_id;
  select e.id, e.betrieb_id, ob.name into v_doppelt, v_doppelt_betrieb, v_doppelt_name
    from public.einkaufsbelege e join public.betriebe ob on ob.id = e.betrieb_id
   where e.status = 'freigegeben' and e.lieferant_id = b.lieferant_id
     and lower(btrim(e.belegnummer)) = lower(btrim(b.belegnummer))
   order by e.freigegeben_am, e.id limit 1;
  if v_doppelt is not null then
    if v_doppelt_betrieb = b.betrieb_id then
      return jsonb_build_object('ok', false, 'grund', 'doppelt', 'beleg', v_doppelt);
    end if;
    return jsonb_build_object('ok', false, 'grund', 'doppelt_standort', 'standort', v_doppelt_name);
  end if;
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
  /* Alles Schreibende in EINEM Block: kommt eine zweite Freigabe mit
     derselben Nummer zugleich durch, fällt der eindeutige Index beim
     Statuswechsel — und mit ihm jede Zeile darüber (§2.3g). */
  begin
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
        select pr.preis_basis into v_alt from public.artikel_preise pr
         where pr.artikel_id = v_artikel and pr.betrieb_id = b.betrieb_id and pr.beleg_id <> b.id
         order by pr.belegdatum desc, pr.freigegeben_am desc nulls last, pr.pos desc, pr.position_id desc limit 1;
        v_neu := round(v_netto / (v_menge * v_gebinde), 6);
        if v_alt is not null and v_alt > 0 and abs(v_neu - v_alt) / v_alt >= 0.05 then
          v_aenderungen := v_aenderungen || jsonb_build_object('artikel_id', v_artikel, 'vorher', v_alt, 'jetzt', v_neu,
                                                               'prozent', round((v_neu - v_alt) / v_alt * 100, 1));
        end if;
        insert into public.lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, beleg_id, position_id, nutzer_id)
        values (b.betrieb_id, v_artikel, 'eingang', v_menge * v_gebinde, v_netto, b.id, v_pid, auth.uid());
        /* Gelernte Zuordnung: die neuere Entscheidung gilt — aber nicht still. */
        select la.artikel_id, la.gebinde_basis into v_la from public.lieferanten_artikel la
         where la.lieferant_id = b.lieferant_id and lower(btrim(la.bezeichnung)) = lower(btrim(left(v_text, 200)));
        if found and (v_la.artikel_id is distinct from v_artikel or v_la.gebinde_basis is distinct from v_gebinde) then
          v_zuordnungen := v_zuordnungen || jsonb_build_object('pos', i, 'bezeichnung', left(v_text, 200),
                             'artikel_vorher', v_la.artikel_id, 'artikel_jetzt', v_artikel,
                             'gebinde_vorher', v_la.gebinde_basis, 'gebinde_jetzt', v_gebinde);
        end if;
        insert into public.lieferanten_artikel (lieferant_id, artikel_id, bezeichnung, einkaufseinheit, gebinde_basis, letzter_preis, letzter_preis_am)
        values (b.lieferant_id, v_artikel, left(v_text, 200), coalesce(v_einheit, 'Stück'), v_gebinde, round(v_netto / v_menge, 4), b.belegdatum)
        on conflict (lieferant_id, (lower(btrim(bezeichnung)))) do update
          set artikel_id = excluded.artikel_id, einkaufseinheit = excluded.einkaufseinheit,
              gebinde_basis = excluded.gebinde_basis, letzter_preis = excluded.letzter_preis, letzter_preis_am = excluded.letzter_preis_am;
      end if;
    end loop;
    update public.einkaufsbelege set status = 'freigegeben', freigegeben_am = clock_timestamp(), freigegeben_von = auth.uid() where id = b.id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'grund', 'doppelt');
  end;
  return jsonb_build_object('ok', true, 'positionen', i, 'preisaenderungen', v_aenderungen, 'zuordnungen', v_zuordnungen);
end $$;

-- ── 10 · Indizes ─────────────────────────────────────────────────────
create index if not exists einkaufspositionen_artikel on public.einkaufspositionen (artikel_id);
create index if not exists lagerbewegungen_beleg on public.lagerbewegungen (beleg_id);
create index if not exists lagerbewegungen_betrieb_art_zeit on public.lagerbewegungen (betrieb_id, art, zeitpunkt);
create index if not exists inventuren_betrieb on public.inventuren (betrieb_id, gezaehlt_am desc);
create index if not exists rezepturen_betrieb on public.rezepturen (betrieb_id);
create index if not exists lieferanten_artikel_artikel on public.lieferanten_artikel (artikel_id);
