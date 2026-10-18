-- ═══════════════════════════════════════════════════════════════════
--  EINKAUF E5-C · Sortiment und Nachbestellen je Standort
--
--  Gelesen 17.10.: Artikel und Lieferanten gehören der Kette (E4). Ihr
--  `aktiv` und die Kundennummer gelten damit für ALLE Standorte — wer in
--  A einen Artikel abschaltet, blendet ihn in B aus; die Kundennummer
--  beim Großhandel ist aber je Filiale eine andere. Mindestbestand und
--  Lagerort gab es nirgends; die Inventur zählte immer „jetzt“.
--
--   15 · artikel_standort (Artikel × Betrieb): aktiv, Mindestbestand,
--        Lagerort, Reihenfolge. Keine Zeile = wie die Kette (aktiv aus
--        artikel, kein Mindestbestand) — kein Standort sieht ohne eigenes
--        Zutun eine Änderung (§2.5).
--   16 · lieferanten_standort: Kundennummer, Ansprechpartner, Liefertage,
--        Mindestbestellwert je Standort.
--   17 · Nachbestellen rechnet die Seite aus Bestand, Mindestbestand,
--        letztem Lieferanten und gelerntem Gebinde — nichts wird
--        verschickt, die Seite gibt einen Text zum Kopieren.
--   18 · inventur_entwurf: Zwischenstand der Zählung je Standort,
--        geräteübergreifend. inventur_buchen bekommt p_stichtag: gebucht
--        wird gegen den Bestand ZUM Stichtag, die Bewegung trägt ihn als
--        Zeitpunkt; was danach geschah, bleibt stehen. Neue Signatur →
--        alte Fassung nach archiv (§2.1, kein drop §2.8).
--  Rechte: Sortiment und Lieferanten-Angaben setzt der Inhaber; Zählen
--  und Verlust über darf_lager_buchen (E5-B; E5-D öffnet es dem Team).
--  Schreiben NUR über die Funktionen; Supabase-Vorgaberechte entzogen.
--  Keine Zeile beginnt mit drop oder delete (§2.8).
--  Probe: datenbank/pruef-einkauf-e5c.sql (zurückgedreht).
--
--  ANGEWENDET 17.10. (apply_migration einkauf_e5c), Probe live grün:
--   · public kennt nur inventur_buchen(…, p_stichtag); die alte liegt in
--     archiv ohne EXECUTE; verlust_buchen fragt darf_lager_buchen; kein
--     direktes Schreiben für authenticated, anon liest nichts (42501).
--   · Sortiment: A schaltet Mehl HIER ab (6 kg, Keller) — eine Zeile,
--     Formfehler (−1, 61 Zeichen, „vielleicht“, Liste) → form und nichts
--     geändert; in B keine Zeile, artikel.aktiv bleibt true; F kann in A
--     nichts setzen, liest A's Zeilen nicht.
--   · Kundennummer je Standort: K-A in A, K-B in B, jeder sieht nur seine.
--   · Zählung: Eingang vor 3 Tagen 10 kg, Verlust vor 1 h 2 kg; gestern
--     9 kg gezählt → −1 kg zum Stichtag gestern (ohne Stichtag wären es
--     +1 kg gewesen), Bestand jetzt 7 kg, Zwischenstand danach leer;
--     Stichtag morgen / vor 70 Tagen → stichtag; alter Aufruf ohne
--     Stichtag trägt.
-- ═══════════════════════════════════════════════════════════════════

-- ── Tabellen ─────────────────────────────────────────────────────────
create table if not exists public.artikel_standort (
  artikel_id uuid not null references public.artikel(id),
  betrieb_id uuid not null references public.betriebe(id),
  aktiv boolean not null default true,
  mindestbestand numeric,
  lagerort text,
  reihenfolge integer,
  geaendert timestamptz not null default now(),
  primary key (artikel_id, betrieb_id),
  constraint artikel_standort_form check ((mindestbestand is null or mindestbestand between 0 and 100000000)
    and (lagerort is null or length(lagerort) between 1 and 60) and (reihenfolge is null or reihenfolge between 0 and 9999))
);
create table if not exists public.lieferanten_standort (
  lieferant_id uuid not null references public.lieferanten(id),
  betrieb_id uuid not null references public.betriebe(id),
  kundennummer text,
  ansprechpartner text,
  liefertage text[],
  mindestbestellwert numeric,
  geaendert timestamptz not null default now(),
  primary key (lieferant_id, betrieb_id),
  constraint lieferanten_standort_form check ((kundennummer is null or length(kundennummer) between 1 and 60)
    and (ansprechpartner is null or length(ansprechpartner) between 1 and 120)
    and (liefertage is null or liefertage <@ array['mo','di','mi','do','fr','sa','so'])
    and (mindestbestellwert is null or mindestbestellwert between 0 and 100000))
);
create table if not exists public.inventur_entwurf (
  betrieb_id uuid primary key references public.betriebe(id),
  daten jsonb not null default '{}'::jsonb,
  stichtag timestamptz,
  geaendert timestamptz not null default now(),
  geaendert_von uuid,
  constraint inventur_entwurf_form check (jsonb_typeof(daten) = 'object' and pg_column_size(daten) < 60000)
);
create index if not exists artikel_standort_betrieb on public.artikel_standort (betrieb_id);
create index if not exists lieferanten_standort_betrieb on public.lieferanten_standort (betrieb_id);

alter table public.artikel_standort enable row level security;
alter table public.lieferanten_standort enable row level security;
alter table public.inventur_entwurf enable row level security;
revoke all on public.artikel_standort, public.lieferanten_standort, public.inventur_entwurf from public, anon, authenticated;
grant select on public.artikel_standort, public.lieferanten_standort, public.inventur_entwurf to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'artikel_standort' and policyname = 'sortiment betrieb liest') then
    create policy "sortiment betrieb liest" on public.artikel_standort for select to authenticated
      using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lieferanten_standort' and policyname = 'lieferant standort liest') then
    create policy "lieferant standort liest" on public.lieferanten_standort for select to authenticated
      using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inventur_entwurf' and policyname = 'zaehlung betrieb liest') then
    create policy "zaehlung betrieb liest" on public.inventur_entwurf for select to authenticated
      using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
  end if;
end $$;

-- ── 15 · Sortiment je Standort ───────────────────────────────────────
create or replace function public.artikel_standort_setzen(p_betrieb uuid, p_artikel uuid, p_daten jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_org uuid; v_min numeric; v_ort text; v_rf int; v_aktiv boolean;
begin
  if p_betrieb is null or not public.ist_inhaber(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  select organisation_id into v_org from public.betriebe where id = p_betrieb;
  if not exists (select 1 from public.artikel a where a.id = p_artikel and a.organisation_id = v_org) then
    return jsonb_build_object('ok', false, 'grund', 'artikel');
  end if;
  if jsonb_typeof(p_daten) is distinct from 'object' then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  begin
    v_aktiv := coalesce((p_daten ->> 'aktiv')::boolean, true);
    v_min := nullif(p_daten ->> 'mindestbestand', '')::numeric;
    v_ort := nullif(btrim(p_daten ->> 'lagerort'), '');
    v_rf := nullif(p_daten ->> 'reihenfolge', '')::int;
  exception when others then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end;
  begin
    insert into public.artikel_standort (artikel_id, betrieb_id, aktiv, mindestbestand, lagerort, reihenfolge, geaendert)
    values (p_artikel, p_betrieb, v_aktiv, v_min, v_ort, v_rf, now())
    on conflict (artikel_id, betrieb_id) do update
      set aktiv = excluded.aktiv, mindestbestand = excluded.mindestbestand, lagerort = excluded.lagerort,
          reihenfolge = excluded.reihenfolge, geaendert = now();
  exception when check_violation then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end;
  return jsonb_build_object('ok', true);
end $$;

-- ── 16 · Lieferanten-Angaben je Standort ─────────────────────────────
create or replace function public.lieferant_standort_setzen(p_betrieb uuid, p_lieferant uuid, p_daten jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_org uuid; v_tage text[]; v_mbw numeric;
begin
  if p_betrieb is null or not public.ist_inhaber(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  select organisation_id into v_org from public.betriebe where id = p_betrieb;
  if not exists (select 1 from public.lieferanten l where l.id = p_lieferant and l.organisation_id = v_org) then
    return jsonb_build_object('ok', false, 'grund', 'lieferant');
  end if;
  if jsonb_typeof(p_daten) is distinct from 'object' then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  begin
    v_tage := case when jsonb_typeof(p_daten -> 'liefertage') = 'array'
                   then array(select jsonb_array_elements_text(p_daten -> 'liefertage')) end;
    v_mbw := nullif(p_daten ->> 'mindestbestellwert', '')::numeric;
    insert into public.lieferanten_standort (lieferant_id, betrieb_id, kundennummer, ansprechpartner, liefertage, mindestbestellwert, geaendert)
    values (p_lieferant, p_betrieb, nullif(btrim(p_daten ->> 'kundennummer'), ''), nullif(btrim(p_daten ->> 'ansprechpartner'), ''),
            nullif(v_tage, '{}'), v_mbw, now())
    on conflict (lieferant_id, betrieb_id) do update
      set kundennummer = excluded.kundennummer, ansprechpartner = excluded.ansprechpartner,
          liefertage = excluded.liefertage, mindestbestellwert = excluded.mindestbestellwert, geaendert = now();
  exception when check_violation or data_exception then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end;
  return jsonb_build_object('ok', true);
end $$;

-- ── 18 · Zählliste: Zwischenstand und Stichtag ───────────────────────
create or replace function public.inventur_entwurf_sichern(p_betrieb uuid, p_daten jsonb, p_stichtag timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if p_betrieb is null or not public.darf_lager_buchen(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if jsonb_typeof(coalesce(p_daten, '{}'::jsonb)) <> 'object' then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  begin
    insert into public.inventur_entwurf (betrieb_id, daten, stichtag, geaendert, geaendert_von)
    values (p_betrieb, coalesce(p_daten, '{}'::jsonb), p_stichtag, now(), auth.uid())
    on conflict (betrieb_id) do update
      set daten = excluded.daten, stichtag = excluded.stichtag, geaendert = now(), geaendert_von = auth.uid();
  exception when check_violation then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end;
  return jsonb_build_object('ok', true);
end $$;

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'inventur_buchen'
                and pg_get_function_identity_arguments(p.oid) = 'p_betrieb uuid, p_zaehlung jsonb, p_notiz text') then
    alter function public.inventur_buchen(uuid, jsonb, text) rename to inventur_buchen_vor_e5c;
    alter function public.inventur_buchen_vor_e5c(uuid, jsonb, text) set schema archiv;
    revoke execute on function archiv.inventur_buchen_vor_e5c(uuid, jsonb, text) from public, anon, authenticated;
  end if;
end $$;

create or replace function public.inventur_buchen(p_betrieb uuid, p_zaehlung jsonb, p_notiz text default null, p_stichtag timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid; z jsonb; v_art uuid; v_menge numeric; v_ist numeric; v_diff numeric; v_preis numeric;
  v_inv uuid; n int := 0; v_wert numeric := 0; i int := 0; v_zeit timestamptz := coalesce(p_stichtag, now());
begin
  if p_betrieb is null or not public.darf_lager_buchen(p_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if v_zeit > now() + interval '5 minutes' or v_zeit < now() - interval '62 days' then
    return jsonb_build_object('ok', false, 'grund', 'stichtag');
  end if;
  if jsonb_typeof(p_zaehlung) is distinct from 'array' or jsonb_array_length(p_zaehlung) = 0 or jsonb_array_length(p_zaehlung) > 500 then
    return jsonb_build_object('ok', false, 'grund', 'zaehlung');
  end if;
  if p_notiz is not null and length(p_notiz) > 200 then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  select organisation_id into v_org from public.betriebe where id = p_betrieb;
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
  insert into public.inventuren (betrieb_id, nutzer_id, notiz, gezaehlt_am) values (p_betrieb, auth.uid(), nullif(btrim(p_notiz), ''), v_zeit) returning id into v_inv;
  for z in select value from jsonb_array_elements(p_zaehlung) loop
    v_art := (z ->> 'artikel_id')::uuid; v_menge := (z ->> 'menge')::numeric;
    -- Bestand ZUM Stichtag: was danach gebucht wurde, gehört nicht in die Differenz.
    select coalesce(sum(menge_basis), 0) into v_ist from public.lagerbewegungen
     where betrieb_id = p_betrieb and artikel_id = v_art and zeitpunkt <= v_zeit;
    v_diff := v_menge - v_ist;
    continue when v_diff = 0;
    v_preis := public.artikel_preis_betrieb(v_art, p_betrieb);
    insert into public.lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, inventur_id, nutzer_id, notiz, zeitpunkt)
    values (p_betrieb, v_art, 'inventur', v_diff, round(v_diff * v_preis, 2), v_inv, auth.uid(), 'Inventur', v_zeit);
    n := n + 1; v_wert := v_wert + coalesce(round(v_diff * v_preis, 2), 0);
  end loop;
  update public.inventuren set positionen = n, differenz_wert = v_wert where id = v_inv;
  -- Gebucht: der Zwischenstand ist erledigt.
  update public.inventur_entwurf set daten = '{}'::jsonb, stichtag = null, geaendert = now(), geaendert_von = auth.uid() where betrieb_id = p_betrieb;
  return jsonb_build_object('ok', true, 'id', v_inv, 'buchungen', n, 'differenz_wert', v_wert);
end $$;

-- Verlust: dieselbe Regel wie die Zählung (E5-D öffnet sie dem Team).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.verlust_buchen(uuid,uuid,numeric,text)'::regprocedure);
  if position('if not public.ist_inhaber(p_betrieb) then' in d) > 0 then
    execute replace(d, 'if not public.ist_inhaber(p_betrieb) then', 'if not public.darf_lager_buchen(p_betrieb) then');
  elsif position('darf_lager_buchen(p_betrieb)' in d) = 0 then
    raise exception 'verlust_buchen: Stelle nicht gefunden';
  end if;
end $$;

revoke execute on function public.artikel_standort_setzen(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.lieferant_standort_setzen(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.inventur_entwurf_sichern(uuid, jsonb, timestamptz) from public, anon;
revoke execute on function public.inventur_buchen(uuid, jsonb, text, timestamptz) from public, anon;
grant execute on function public.artikel_standort_setzen(uuid, uuid, jsonb) to authenticated;
grant execute on function public.lieferant_standort_setzen(uuid, uuid, jsonb) to authenticated;
grant execute on function public.inventur_entwurf_sichern(uuid, jsonb, timestamptz) to authenticated;
grant execute on function public.inventur_buchen(uuid, jsonb, text, timestamptz) to authenticated;
