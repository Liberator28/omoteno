-- ═══════════════════════════════════════════════════════════════════
--  NOCH NICHT EINGESPIELT · migration-ki-nutzung.sql
--  KI-Nutzung je Betrieb erfassen (Tokens / Bilder), in Euro bewerten,
--  Monatsbudget je Betrieb, Auswertung im Master-Board.
--
--  WARUM: Jede Übersetzung, jede gelesene Rechnung, jedes Profi-Foto
--  kostet den Betreiber Geld. Bisher zählte nur ki_kontingent (TEXTE je
--  Tag, migration-ki-kontingent.sql / migration-einkauf-e5a.sql) und
--  bild_auftraege (AUFTRÄGE je Monat) — beides Mengen, keine Kosten.
--  Anthropic liefert in jeder Antwort `usage` (input_tokens,
--  output_tokens); die Edge Functions lasen sie nie.
--
--  DESIGN
--   · ki_preise        Preis je Modell, in EURO (Anbieter rechnen in USD;
--                      wer einträgt, rechnet um und schreibt in die
--                      Bemerkung Kurs + Datum). Preise sind DATEN, nicht
--                      Code — ein Preiswechsel ist kein Ausrollen.
--                      Fehlt der Preis, wird trotzdem gebucht
--                      (preis_fehlt) und beim Eintragen nachgerechnet:
--                      nichts geht verloren, nichts wird erfunden.
--   · ki_nutzung       Ein Eintrag je Aufruf. Nur Master liest (die
--                      Kostenstruktur ist Betreiber-Sache). Geschrieben
--                      wird AUSSCHLIESSLICH über ki_nutzung_buchen().
--   · ki_budget        Monatsbudget je Betrieb in Euro; `hart` = die
--                      Edge Function weist ab, sonst nur Anzeige/Warnung.
--   · ki_kontingent_nehmen() wird NICHT angefasst (zwei Fassungen,
--                      CLAUDE.md §2.1) — das Budget ist eine zweite,
--                      unabhängige Schranke.
--
--  EHRLICHE GRENZE: ki_nutzung_buchen() läuft mit den Rechten des
--  Aufrufers (kein Service-Schlüssel in den Edge Functions, §2.3a). Ein
--  angemeldetes Teammitglied könnte die Funktion direkt rufen und für
--  den EIGENEN Betrieb falsche Zahlen buchen. Es kann damit nur seine
--  eigene Statistik und sein eigenes Budget verfälschen, nie fremde,
--  und nicht einen Cent bei Anthropic/fal verursachen. Obergrenzen je
--  Aufruf (unten) halten die Verfälschung klein.
--
--  Additiv. REIHENFOLGE (§2.5): Migration → Edge Functions ausrollen →
--  Master-Board. Edge Functions laufen auch OHNE diese Migration weiter
--  (Funktion fehlt → 42883/PGRST202 → fail-open, wie bisher).
--  Rechte: anon hat NICHTS; authenticated darf nur die zwei Funktionen
--  ki_nutzung_buchen/ki_budget_stand rufen, keine Tabelle anfassen.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Preise ───────────────────────────────────────────────────────
create table if not exists public.ki_preise (
  modell              text primary key
                        check (modell ~ '^[A-Za-z0-9._:/+-]{1,80}$'),
  art                 text not null check (art in ('token', 'bild')),
  eingabe_eur_je_mio  numeric check (eingabe_eur_je_mio is null or eingabe_eur_je_mio between 0 and 100000),
  ausgabe_eur_je_mio  numeric check (ausgabe_eur_je_mio is null or ausgabe_eur_je_mio between 0 and 100000),
  cache_eur_je_mio    numeric check (cache_eur_je_mio    is null or cache_eur_je_mio    between 0 and 100000),
  eur_je_bild         numeric check (eur_je_bild         is null or eur_je_bild         between 0 and 1000),
  bemerkung           text check (bemerkung is null or length(bemerkung) <= 300),
  geaendert           timestamptz not null default now()
);
alter table public.ki_preise enable row level security;
revoke all on public.ki_preise from anon, authenticated;

-- Die Modelle, die die Edge Functions heute rufen. Preise bewusst leer:
-- Sie stehen nicht verlässlich im Verzeichnis (die Anleitung nennt USD, hier
-- wird in EUR gerechnet) — der Master trägt sie ein, bis dahin „Preis fehlt“.
insert into public.ki_preise (modell, art, bemerkung) values
  ('claude-opus-5',               'token', 'Übersetzer (Standard). Preis in EUR je Mio. Token eintragen.'),
  ('claude-opus-5-5',             'token', 'Rechnung lesen (beleg-lesen). Preis in EUR je Mio. Token eintragen.'),
  ('fal-ai/birefnet/v2',          'bild',  'Freisteller. Preis in EUR je Bild eintragen.'),
  ('fal-ai/bria/product-shot',    'bild',  'Profi-Foto. Preis in EUR je Bild eintragen.')
on conflict (modell) do nothing;

-- ── 2 · Nutzung ──────────────────────────────────────────────────────
create table if not exists public.ki_nutzung (
  id           bigint generated always as identity primary key,
  betrieb_id   uuid not null references public.betriebe(id) on delete cascade,
  funktion     text not null check (funktion in ('uebersetzen', 'beleg_lesen', 'bild_profi_frei')),
  modell       text not null check (modell ~ '^[A-Za-z0-9._:/+-]{1,80}$'),
  tokens_ein   integer not null default 0 check (tokens_ein   between 0 and 2000000),
  tokens_aus   integer not null default 0 check (tokens_aus   between 0 and 200000),
  tokens_cache integer not null default 0 check (tokens_cache between 0 and 2000000),
  bilder       integer not null default 0 check (bilder       between 0 and 10),
  kosten_eur   numeric(14,6),            -- null = Preis fehlte bei der Buchung
  erstellt_am  timestamptz not null default now()
);
create index if not exists ki_nutzung_betrieb_zeit on public.ki_nutzung (betrieb_id, erstellt_am desc);
create index if not exists ki_nutzung_ohne_preis   on public.ki_nutzung (modell) where kosten_eur is null;
alter table public.ki_nutzung enable row level security;
revoke all on public.ki_nutzung from anon, authenticated;

-- ── 3 · Budget ───────────────────────────────────────────────────────
create table if not exists public.ki_budget (
  betrieb_id   uuid primary key references public.betriebe(id) on delete cascade,
  monat_eur    numeric check (monat_eur is null or monat_eur between 0 and 100000),  -- null = kein Budget
  hart         boolean not null default false,
  warn_prozent integer not null default 80 check (warn_prozent between 1 and 100),
  geaendert    timestamptz not null default now()
);
alter table public.ki_budget enable row level security;
revoke all on public.ki_budget from anon, authenticated;

-- ── 4 · Buchen (Edge Function, mit dem Token des Aufrufers) ──────────
-- Betrieb: p_betrieb nur, wenn der Aufrufer dazugehört; sonst der erste
-- eigene (wie ki_kontingent_nehmen). Master ohne Betrieb: nichts zu buchen.
-- Kosten rechnet der SERVER aus ki_preise, nie der Aufrufer.
create or replace function public.ki_nutzung_buchen(
  p_funktion text, p_modell text, p_ein integer, p_aus integer,
  p_cache integer default 0, p_bilder integer default 0, p_betrieb uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_betrieb uuid; v_p ki_preise%rowtype; v_kosten numeric;
begin
  if p_funktion is null or p_funktion not in ('uebersetzen', 'beleg_lesen', 'bild_profi_frei') then
    return jsonb_build_object('gebucht', false, 'grund', 'funktion');
  end if;
  if p_modell is null or p_modell !~ '^[A-Za-z0-9._:/+-]{1,80}$' then
    return jsonb_build_object('gebucht', false, 'grund', 'modell');
  end if;
  p_ein := coalesce(p_ein, 0); p_aus := coalesce(p_aus, 0);
  p_cache := coalesce(p_cache, 0); p_bilder := coalesce(p_bilder, 0);
  if p_ein not between 0 and 400000 or p_aus not between 0 and 64000
     or p_cache not between 0 and 400000 or p_bilder not between 0 and 4 then
    return jsonb_build_object('gebucht', false, 'grund', 'menge');
  end if;
  if p_betrieb is not null then
    select b into v_betrieb from meine_betriebe() b where b = p_betrieb;
  else
    select b into v_betrieb from meine_betriebe() b order by b limit 1;
  end if;
  if v_betrieb is null then return jsonb_build_object('gebucht', false, 'grund', 'kein_betrieb'); end if;

  select * into v_p from ki_preise where modell = p_modell;
  if found then
    if v_p.art = 'token' and v_p.eingabe_eur_je_mio is not null and v_p.ausgabe_eur_je_mio is not null then
      v_kosten := (p_ein * v_p.eingabe_eur_je_mio + p_aus * v_p.ausgabe_eur_je_mio
                   + p_cache * coalesce(v_p.cache_eur_je_mio, v_p.eingabe_eur_je_mio)) / 1000000.0;
    elsif v_p.art = 'bild' and v_p.eur_je_bild is not null then
      v_kosten := p_bilder * v_p.eur_je_bild;
    end if;
  end if;

  insert into ki_nutzung (betrieb_id, funktion, modell, tokens_ein, tokens_aus, tokens_cache, bilder, kosten_eur)
  values (v_betrieb, p_funktion, p_modell, p_ein, p_aus, p_cache, p_bilder, v_kosten);
  return jsonb_build_object('gebucht', true, 'preis_fehlt', v_kosten is null);
end $$;
revoke execute on function public.ki_nutzung_buchen(text, text, integer, integer, integer, integer, uuid) from public, anon;
grant  execute on function public.ki_nutzung_buchen(text, text, integer, integer, integer, integer, uuid) to authenticated;

-- ── 5 · Budgetstand (Edge Function vor dem Aufruf) ───────────────────
-- Gibt dem Betrieb NUR Ja/Nein zurück, keine Beträge.
create or replace function public.ki_budget_stand(p_betrieb uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_betrieb uuid; v_b ki_budget%rowtype; v_monat timestamptz; v_summe numeric;
begin
  if p_betrieb is not null then
    select b into v_betrieb from meine_betriebe() b where b = p_betrieb;
  else
    select b into v_betrieb from meine_betriebe() b order by b limit 1;
  end if;
  if v_betrieb is null then return jsonb_build_object('ueber', false, 'warnung', false, 'hart', false); end if;
  select * into v_b from ki_budget where betrieb_id = v_betrieb;
  if not found or v_b.monat_eur is null then
    return jsonb_build_object('ueber', false, 'warnung', false, 'hart', false);
  end if;
  v_monat := date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin';
  select coalesce(sum(kosten_eur), 0) into v_summe from ki_nutzung
   where betrieb_id = v_betrieb and erstellt_am >= v_monat;
  return jsonb_build_object(
    'ueber',   v_summe >= v_b.monat_eur,
    'warnung', v_summe >= v_b.monat_eur * v_b.warn_prozent / 100.0,
    'hart',    v_b.hart);
end $$;
revoke execute on function public.ki_budget_stand(uuid) from public, anon;
grant  execute on function public.ki_budget_stand(uuid) to authenticated;

-- ── 6 · Master: Auswertung ───────────────────────────────────────────
-- Zeitraum [p_von, p_bis] in Berliner Tagen, beide eingeschlossen.
create or replace function public.master_ki_nutzung(p_von date, p_bis date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_von timestamptz; v_bis timestamptz; v_monat timestamptz;
begin
  if not ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_master'); end if;
  if p_von is null or p_bis is null or p_bis < p_von or p_bis - p_von > 400 then
    return jsonb_build_object('ok', false, 'grund', 'zeitraum');
  end if;
  v_von := p_von::timestamp at time zone 'Europe/Berlin';
  v_bis := (p_bis + 1)::timestamp at time zone 'Europe/Berlin';
  v_monat := date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin';
  return jsonb_build_object(
    'ok', true,
    'zeilen', coalesce((
      select jsonb_agg(z order by z.kosten_eur desc nulls last, z.betrieb_id, z.funktion, z.modell) from (
        select n.betrieb_id, b.name as betrieb_name, n.funktion, n.modell,
               count(*)::int as aufrufe, sum(n.tokens_ein)::bigint as tokens_ein,
               sum(n.tokens_aus)::bigint as tokens_aus, sum(n.tokens_cache)::bigint as tokens_cache,
               sum(n.bilder)::int as bilder,
               coalesce(sum(n.kosten_eur), 0)::numeric(14,6) as kosten_eur,
               count(*) filter (where n.kosten_eur is null)::int as ohne_preis
          from ki_nutzung n join betriebe b on b.id = n.betrieb_id
         where n.erstellt_am >= v_von and n.erstellt_am < v_bis
         group by n.betrieb_id, b.name, n.funktion, n.modell) z), '[]'::jsonb),
    'budgets', coalesce((
      select jsonb_agg(jsonb_build_object(
               'betrieb_id', b.id, 'betrieb_name', b.name,
               'monat_eur', k.monat_eur, 'hart', coalesce(k.hart, false),
               'warn_prozent', coalesce(k.warn_prozent, 80),
               'verbraucht_monat_eur', coalesce((select sum(kosten_eur) from ki_nutzung
                                                  where betrieb_id = b.id and erstellt_am >= v_monat), 0))
             order by b.name, b.id)
        from betriebe b left join ki_budget k on k.betrieb_id = b.id), '[]'::jsonb),
    'preise', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.art, p.modell) from ki_preise p), '[]'::jsonb));
end $$;
revoke execute on function public.master_ki_nutzung(date, date) from public, anon;
grant  execute on function public.master_ki_nutzung(date, date) to authenticated;

-- ── 7 · Master: Budget setzen ────────────────────────────────────────
create or replace function public.master_ki_budget_setzen(
  p_betrieb uuid, p_monat_eur numeric, p_hart boolean, p_warn integer default 80)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_master'); end if;
  if p_betrieb is null or not exists (select 1 from betriebe where id = p_betrieb) then
    return jsonb_build_object('ok', false, 'grund', 'betrieb');
  end if;
  if p_monat_eur is not null and (p_monat_eur < 0 or p_monat_eur > 100000) then
    return jsonb_build_object('ok', false, 'grund', 'betrag');
  end if;
  if p_warn is null or p_warn not between 1 and 100 then
    return jsonb_build_object('ok', false, 'grund', 'warnung');
  end if;
  insert into ki_budget (betrieb_id, monat_eur, hart, warn_prozent, geaendert)
  values (p_betrieb, p_monat_eur, coalesce(p_hart, false), p_warn, now())
  on conflict (betrieb_id) do update
     set monat_eur = excluded.monat_eur, hart = excluded.hart,
         warn_prozent = excluded.warn_prozent, geaendert = now();
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.master_ki_budget_setzen(uuid, numeric, boolean, integer) from public, anon;
grant  execute on function public.master_ki_budget_setzen(uuid, numeric, boolean, integer) to authenticated;

-- ── 8 · Master: Preis setzen (+ frühere Buchungen ohne Preis nachrechnen)
create or replace function public.master_ki_preis_setzen(
  p_modell text, p_art text, p_ein numeric, p_aus numeric, p_cache numeric, p_bild numeric, p_bemerkung text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v_nachgerechnet integer := 0;
begin
  if not ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_master'); end if;
  if p_modell is null or p_modell !~ '^[A-Za-z0-9._:/+-]{1,80}$' then
    return jsonb_build_object('ok', false, 'grund', 'modell');
  end if;
  if p_art is null or p_art not in ('token', 'bild') then
    return jsonb_build_object('ok', false, 'grund', 'art');
  end if;
  if (p_ein is not null and p_ein not between 0 and 100000) or (p_aus is not null and p_aus not between 0 and 100000)
     or (p_cache is not null and p_cache not between 0 and 100000) or (p_bild is not null and p_bild not between 0 and 1000) then
    return jsonb_build_object('ok', false, 'grund', 'betrag');
  end if;
  if p_bemerkung is not null and length(p_bemerkung) > 300 then
    return jsonb_build_object('ok', false, 'grund', 'bemerkung');
  end if;
  insert into ki_preise (modell, art, eingabe_eur_je_mio, ausgabe_eur_je_mio, cache_eur_je_mio, eur_je_bild, bemerkung, geaendert)
  values (p_modell, p_art, p_ein, p_aus, p_cache, p_bild, p_bemerkung, now())
  on conflict (modell) do update
     set art = excluded.art, eingabe_eur_je_mio = excluded.eingabe_eur_je_mio,
         ausgabe_eur_je_mio = excluded.ausgabe_eur_je_mio, cache_eur_je_mio = excluded.cache_eur_je_mio,
         eur_je_bild = excluded.eur_je_bild, bemerkung = excluded.bemerkung, geaendert = now();

  -- Nur Zeilen, die BISHER keinen Preis hatten; bereits bewertete bleiben, wie sie gebucht wurden.
  if p_art = 'token' and p_ein is not null and p_aus is not null then
    update ki_nutzung
       set kosten_eur = (tokens_ein * p_ein + tokens_aus * p_aus + tokens_cache * coalesce(p_cache, p_ein)) / 1000000.0
     where modell = p_modell and kosten_eur is null;
    get diagnostics v_nachgerechnet = row_count;
  elsif p_art = 'bild' and p_bild is not null then
    update ki_nutzung set kosten_eur = bilder * p_bild where modell = p_modell and kosten_eur is null;
    get diagnostics v_nachgerechnet = row_count;
  end if;
  return jsonb_build_object('ok', true, 'nachgerechnet', v_nachgerechnet);
end $$;
revoke execute on function public.master_ki_preis_setzen(text, text, numeric, numeric, numeric, numeric, text) from public, anon;
grant  execute on function public.master_ki_preis_setzen(text, text, numeric, numeric, numeric, numeric, text) to authenticated;

commit;
