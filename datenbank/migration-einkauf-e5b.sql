-- ═══════════════════════════════════════════════════════════════════
--  EINKAUF E5-B · Ware zwischen Standorten
--
--  Bis hier gab es keinen Weg, Ware von A nach B zu bringen: Die
--  CHECK-Regel der Bewegungen kannte transfer_aus/transfer_ein/korrektur
--  längst, aber keine Funktion schrieb sie (gelesen 17.10.). Wer für
--  B einkaufte, hatte in B keinen Preis — die Kalkulation dort blieb leer.
--
--  Umlagerung in zwei Schritten, wie ein Lieferschein:
--   1 · umlagerung_anlegen(p_von, p_nach, p_positionen, p_notiz, p_beleg)
--       Der Absender bucht sofort transfer_aus mit SEINEM Wert (Ø aus
--       dem Bestand, sonst letzter Preis; aus einem Beleg: dessen Preis).
--       Stand „unterwegs“. Ohne Preis → Grund, nichts gebucht.
--   2 · umlagerung_annehmen(p_id, p_mengen) — der Empfänger bestätigt
--       je Position, was ankam (Vorgabe: alles). transfer_ein mit
--       DEMSELBEN Wert je Einheit. Fehlmenge: beim Absender als Verlust
--       (korrektur + / verlust −, Menge netto 0) — der Lagerwert der Kette
--       ändert sich nur um den echten Verlust.
--   3 · umlagerung_zurueckziehen(p_id) — nur der Absender, nur solange
--       unterwegs: korrektur zurück, Wert gleich.
--  Rechte: über darf_lager_buchen(p_betrieb) — heute = Inhaber; E5-D
--  ergänzt das Recht „darf_lager“ für das Team an EINER Stelle.
--  Beide Standorte in derselben Organisation, sonst `andere_kette`.
--
--  Der Empfänger kennt danach den Preis: artikel_preise nimmt angenommene
--  Umlagerungen mit (lieferant_id und beleg_id leer). Ehrlich: Damit
--  sieht B den Wert, zu dem A die gelieferte Ware abgab — nur für diese
--  Ware, nie A's übrige Preise (E4 bleibt).
--
--  Entwurf an den falschen Standort gelesen: beleg_verschieben(p_beleg,
--  p_ziel, p_pfad). Nur Entwürfe, nur Inhaber BEIDER Standorte derselben
--  Kette. Die Datei kann SQL nicht im Eimer bewegen (die Speicherregeln
--  kennen kein Umbenennen) — die Seite lädt eine Kopie in den Ordner
--  des Ziels, die Funktion prüft, dass diese Datei dort liegt.
--
--  Additiv (§2.5). Neue Tabellen: Lesen über RLS, Schreiben NUR über die
--  Funktionen — die Vorgabe-Rechte von Supabase (alles für anon und
--  authenticated) werden ausdrücklich entzogen (§2.3f).
--  Keine Zeile beginnt mit drop oder delete (§2.8).
--  Probe: datenbank/pruef-einkauf-e5b.sql (zurückgedreht).
--
--  ANGEWENDET 17.10. (apply_migration einkauf_e5b), Probe live grün:
--   · je Funktion eine Fassung; anon liest/ruft nichts (42501),
--     authenticated schreibt nicht direkt in umlagerungen (42501).
--   · A kauft 10 kg / 20 €, schickt 4 kg (Wert 8,00); F (nur B) nimmt
--     3 kg an → B 3000 g / 6,00, A 6000 g / 12,00, Verlust bei A
--     −1000 g / −2,00; Lagerwert der Kette 18,00 = 20,00 − 2,00.
--   · Preis in B aus der Umlagerung 0,002; B kauft zu 0,003 → „vorher“
--     0,002 (+50 %) — vorher fiel die Zeile über `<>` mit null heraus.
--   · Jeder Grund (gleich, andere_kette, positionen, doppelt, menge,
--     zahl, artikel, preis an Pos 2, beleg, Menge > geschickt, unbekannte
--     Pos) lässt nichts gebucht (Zeilen als Eigentümer gezählt).
--   · F darf A's Umlagerung weder anlegen noch zurückziehen; Blend sieht
--     0 und nimmt nicht an; zurückgezogen → Bestand wie vorher, danach
--     nicht_unterwegs.
--   · beleg_verschieben: ohne Kopie / falscher Ordner / Datei fehlt →
--     datei; mit Kopie → Betrieb und Pfad des Ziels; freigegeben →
--     nicht_entwurf; F (nicht Inhaber von A) → kein_recht.
--   · kette_standorte (einkauf_e5b_standorte): A sieht „MINHKEEY …“, für
--     einen Betrieb ohne Mitgliedschaft 0 Zeilen, Blend allein 0, anon 42501.
-- ═══════════════════════════════════════════════════════════════════

-- ── Recht: wer darf am Lager buchen ──────────────────────────────────
create or replace function public.darf_lager_buchen(p_betrieb uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.ist_inhaber(p_betrieb) $$;
revoke execute on function public.darf_lager_buchen(uuid) from public, anon;
grant execute on function public.darf_lager_buchen(uuid) to authenticated;

-- ── Tabellen ─────────────────────────────────────────────────────────
create table if not exists public.umlagerungen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisationen(id),
  von_betrieb uuid not null references public.betriebe(id),
  nach_betrieb uuid not null references public.betriebe(id),
  status text not null default 'unterwegs',
  notiz text,
  beleg_id uuid references public.einkaufsbelege(id),
  angelegt timestamptz not null default now(),
  angelegt_von uuid,
  angenommen_am timestamptz, angenommen_von uuid,
  zurueckgezogen_am timestamptz, zurueckgezogen_von uuid,
  constraint umlagerungen_status check (status in ('unterwegs', 'angenommen', 'zurueckgezogen')),
  constraint umlagerungen_zwei_orte check (von_betrieb <> nach_betrieb),
  constraint umlagerungen_notiz check (notiz is null or length(notiz) <= 300)
);
create table if not exists public.umlagerungspositionen (
  id uuid primary key default gen_random_uuid(),
  umlagerung_id uuid not null references public.umlagerungen(id),
  pos smallint not null,
  artikel_id uuid not null references public.artikel(id),
  menge_basis numeric not null,
  wert_netto numeric not null,
  menge_angekommen numeric,
  unique (umlagerung_id, pos),
  constraint umlagerungspositionen_menge check (menge_basis > 0 and (menge_angekommen is null or (menge_angekommen >= 0 and menge_angekommen <= menge_basis)))
);
create index if not exists umlagerungen_von on public.umlagerungen (von_betrieb, angelegt desc);
create index if not exists umlagerungen_nach on public.umlagerungen (nach_betrieb, status);
create index if not exists umlagerungspositionen_artikel on public.umlagerungspositionen (artikel_id);

alter table public.lagerbewegungen add column if not exists umlagerung_id uuid references public.umlagerungen(id);
create index if not exists lagerbewegungen_umlagerung on public.lagerbewegungen (umlagerung_id);

alter table public.umlagerungen enable row level security;
alter table public.umlagerungspositionen enable row level security;
revoke all on public.umlagerungen, public.umlagerungspositionen from public, anon, authenticated;
grant select on public.umlagerungen, public.umlagerungspositionen to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'umlagerungen' and policyname = 'umlagerung beteiligte lesen') then
    create policy "umlagerung beteiligte lesen" on public.umlagerungen for select to authenticated
      using (von_betrieb in (select public.meine_betriebe()) or nach_betrieb in (select public.meine_betriebe()) or public.ist_master());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'umlagerungspositionen' and policyname = 'umlagerungsposition beteiligte lesen') then
    create policy "umlagerungsposition beteiligte lesen" on public.umlagerungspositionen for select to authenticated
      using (exists (select 1 from public.umlagerungen u where u.id = umlagerung_id
                      and (u.von_betrieb in (select public.meine_betriebe()) or u.nach_betrieb in (select public.meine_betriebe()) or public.ist_master())));
  end if;
end $$;

-- ── 1 · Anlegen ──────────────────────────────────────────────────────
create or replace function public.umlagerung_anlegen(p_von uuid, p_nach uuid, p_positionen jsonb,
                                                     p_notiz text default null, p_beleg uuid default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid; v_org_nach uuid; v_id uuid; p jsonb; i int := 0;
  v_art uuid; v_menge numeric; v_preis numeric; v_bm numeric; v_bw numeric;
  v_summe numeric := 0; v_minus jsonb := '[]'::jsonb; v_gesehen uuid[] := '{}';
begin
  if p_von is null or p_nach is null or not public.darf_lager_buchen(p_von) then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  if p_von = p_nach then return jsonb_build_object('ok', false, 'grund', 'gleich'); end if;
  select organisation_id into v_org from public.betriebe where id = p_von;
  select organisation_id into v_org_nach from public.betriebe where id = p_nach;
  if v_org_nach is null or v_org_nach <> v_org then return jsonb_build_object('ok', false, 'grund', 'andere_kette'); end if;
  if jsonb_typeof(p_positionen) <> 'array' or jsonb_array_length(p_positionen) = 0 or jsonb_array_length(p_positionen) > 100 then
    return jsonb_build_object('ok', false, 'grund', 'positionen');
  end if;
  if p_notiz is not null and length(p_notiz) > 300 then return jsonb_build_object('ok', false, 'grund', 'notiz'); end if;
  if p_beleg is not null and not exists (select 1 from public.einkaufsbelege e
                                          where e.id = p_beleg and e.betrieb_id = p_von and e.status = 'freigegeben') then
    return jsonb_build_object('ok', false, 'grund', 'beleg');
  end if;
  -- Erst alles prüfen, dann schreiben: ein Grund lässt keine halbe Umlagerung zurück.
  for p in select value from jsonb_array_elements(p_positionen) loop
    i := i + 1;
    begin
      v_art := (p ->> 'artikel_id')::uuid;
      v_menge := (p ->> 'menge_basis')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'zahl');
    end;
    if v_art is null or not exists (select 1 from public.artikel a where a.id = v_art and a.organisation_id = v_org) then
      return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'artikel');
    end if;
    if v_art = any(v_gesehen) then return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'doppelt'); end if;
    v_gesehen := v_gesehen || v_art;
    if v_menge is null or v_menge <= 0 or v_menge > 10000000 then
      return jsonb_build_object('ok', false, 'grund', 'position', 'pos', i, 'feld', 'menge');
    end if;
  end loop;

  insert into public.umlagerungen (organisation_id, von_betrieb, nach_betrieb, notiz, beleg_id, angelegt_von)
  values (v_org, p_von, p_nach, nullif(btrim(p_notiz), ''), p_beleg, auth.uid()) returning id into v_id;
  i := 0;
  for p in select value from jsonb_array_elements(p_positionen) loop
    i := i + 1;
    v_art := (p ->> 'artikel_id')::uuid;
    v_menge := (p ->> 'menge_basis')::numeric;
    v_preis := null;
    if p_beleg is not null then
      select sum(ep.netto) / nullif(sum(ep.menge_basis), 0) into v_preis
        from public.einkaufspositionen ep where ep.beleg_id = p_beleg and ep.artikel_id = v_art and ep.art = 'ware';
    end if;
    select lb.menge_basis, lb.wert_netto into v_bm, v_bw from public.lagerbestand lb where lb.betrieb_id = p_von and lb.artikel_id = v_art;
    if v_preis is null and coalesce(v_bm, 0) > 0 and coalesce(v_bw, 0) > 0 then v_preis := v_bw / v_bm; end if;
    if v_preis is null then v_preis := public.artikel_preis_betrieb(v_art, p_von); end if;
    if v_preis is null then
      raise exception using errcode = 'P0001', message = 'ohne_preis:' || i;
    end if;
    if coalesce(v_bm, 0) - v_menge < 0 then v_minus := v_minus || to_jsonb(v_art); end if;
    insert into public.umlagerungspositionen (umlagerung_id, pos, artikel_id, menge_basis, wert_netto)
    values (v_id, i, v_art, v_menge, round(v_menge * v_preis, 4));
    insert into public.lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, umlagerung_id, nutzer_id, notiz)
    values (p_von, v_art, 'transfer_aus', -v_menge, -round(v_menge * v_preis, 4), v_id, auth.uid(), 'Umlagerung');
    v_summe := v_summe + round(v_menge * v_preis, 4);
  end loop;
  -- Bestand darf ins Minus (§7: die Ware steht vielleicht nur noch nicht im
  -- System) — gesagt wird es.
  return jsonb_build_object('ok', true, 'id', v_id, 'wert', round(v_summe, 2), 'bestand_negativ', v_minus);
exception when sqlstate 'P0001' then
  if sqlerrm like 'ohne_preis:%' then
    return jsonb_build_object('ok', false, 'grund', 'position', 'pos', split_part(sqlerrm, ':', 2)::int, 'feld', 'preis');
  end if;
  raise;
end $$;

-- ── 2 · Annehmen ─────────────────────────────────────────────────────
create or replace function public.umlagerung_annehmen(p_id uuid, p_mengen jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  u record; z record; v_an numeric; v_ein numeric := 0; v_fehl numeric := 0; v_w numeric; e jsonb;
begin
  select * into u from public.umlagerungen where id = p_id for update;
  if u.id is null or not public.darf_lager_buchen(u.nach_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if u.status <> 'unterwegs' then return jsonb_build_object('ok', false, 'grund', 'nicht_unterwegs'); end if;
  if p_mengen is not null and jsonb_typeof(p_mengen) <> 'array' then return jsonb_build_object('ok', false, 'grund', 'positionen'); end if;
  -- Erst prüfen
  for e in select value from jsonb_array_elements(coalesce(p_mengen, '[]'::jsonb)) loop
    begin
      v_an := (e ->> 'menge_angekommen')::numeric;
      if not exists (select 1 from public.umlagerungspositionen where umlagerung_id = u.id and pos = (e ->> 'pos')::int) then
        return jsonb_build_object('ok', false, 'grund', 'position', 'pos', e ->> 'pos', 'feld', 'pos');
      end if;
    exception when others then
      return jsonb_build_object('ok', false, 'grund', 'position', 'pos', e ->> 'pos', 'feld', 'zahl');
    end;
    if v_an is null or v_an < 0 or v_an > (select menge_basis from public.umlagerungspositionen where umlagerung_id = u.id and pos = (e ->> 'pos')::int) then
      return jsonb_build_object('ok', false, 'grund', 'position', 'pos', e ->> 'pos', 'feld', 'menge');
    end if;
  end loop;
  for z in select * from public.umlagerungspositionen where umlagerung_id = u.id order by pos loop
    select (x ->> 'menge_angekommen')::numeric into v_an from jsonb_array_elements(coalesce(p_mengen, '[]'::jsonb)) x
     where (x ->> 'pos')::int = z.pos limit 1;
    v_an := coalesce(v_an, z.menge_basis);
    update public.umlagerungspositionen set menge_angekommen = v_an where id = z.id;
    if v_an > 0 then
      v_w := round(z.wert_netto * v_an / z.menge_basis, 4);
      insert into public.lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, umlagerung_id, nutzer_id, notiz)
      values (u.nach_betrieb, z.artikel_id, 'transfer_ein', v_an, v_w, u.id, auth.uid(), 'Umlagerung');
      v_ein := v_ein + v_w;
    end if;
    if v_an < z.menge_basis then
      v_w := z.wert_netto - coalesce(round(z.wert_netto * v_an / z.menge_basis, 4), 0);
      insert into public.lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, umlagerung_id, nutzer_id, notiz)
      values (u.von_betrieb, z.artikel_id, 'korrektur', z.menge_basis - v_an, v_w, u.id, auth.uid(), 'Umlagerung: nicht angekommen'),
             (u.von_betrieb, z.artikel_id, 'verlust', -(z.menge_basis - v_an), -v_w, u.id, auth.uid(), 'Umlagerung: nicht angekommen');
      v_fehl := v_fehl + v_w;
    end if;
  end loop;
  update public.umlagerungen set status = 'angenommen', angenommen_am = clock_timestamp(), angenommen_von = auth.uid() where id = u.id;
  return jsonb_build_object('ok', true, 'wert', round(v_ein, 2), 'fehlwert', round(v_fehl, 2));
end $$;

-- ── 3 · Zurückziehen ─────────────────────────────────────────────────
create or replace function public.umlagerung_zurueckziehen(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare u record; n int;
begin
  select * into u from public.umlagerungen where id = p_id for update;
  if u.id is null or not public.darf_lager_buchen(u.von_betrieb) then return jsonb_build_object('ok', false, 'grund', 'kein_recht'); end if;
  if u.status <> 'unterwegs' then return jsonb_build_object('ok', false, 'grund', 'nicht_unterwegs'); end if;
  insert into public.lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, umlagerung_id, nutzer_id, notiz)
  select u.von_betrieb, z.artikel_id, 'korrektur', z.menge_basis, z.wert_netto, u.id, auth.uid(), 'Umlagerung zurückgezogen'
    from public.umlagerungspositionen z where z.umlagerung_id = u.id;
  get diagnostics n = row_count;
  update public.umlagerungen set status = 'zurueckgezogen', zurueckgezogen_am = clock_timestamp(), zurueckgezogen_von = auth.uid() where id = u.id;
  return jsonb_build_object('ok', true, 'positionen', n);
end $$;

revoke execute on function public.umlagerung_anlegen(uuid, uuid, jsonb, text, uuid) from public, anon;
revoke execute on function public.umlagerung_annehmen(uuid, jsonb) from public, anon;
revoke execute on function public.umlagerung_zurueckziehen(uuid) from public, anon;
grant execute on function public.umlagerung_anlegen(uuid, uuid, jsonb, text, uuid) to authenticated;
grant execute on function public.umlagerung_annehmen(uuid, jsonb) to authenticated;
grant execute on function public.umlagerung_zurueckziehen(uuid) to authenticated;

-- ── Preis beim Empfänger ─────────────────────────────────────────────
create or replace view public.artikel_preise with (security_invoker = true) as
 select p.artikel_id, e.betrieb_id, e.lieferant_id, e.belegdatum, e.id as beleg_id, p.id as position_id,
        round(p.netto / nullif(p.menge_basis, 0::numeric), 6) as preis_basis,
        e.freigegeben_am, p.pos
   from public.einkaufspositionen p
   join public.einkaufsbelege e on e.id = p.beleg_id
  where e.status = 'freigegeben'::text and p.art = 'ware'::text and p.artikel_id is not null
 union all
 select z.artikel_id, u.nach_betrieb, null::uuid, (u.angenommen_am at time zone 'Europe/Berlin')::date, null::uuid, z.id,
        round(z.wert_netto / z.menge_basis, 6), u.angenommen_am, z.pos
   from public.umlagerungspositionen z
   join public.umlagerungen u on u.id = z.umlagerung_id
  where u.status = 'angenommen' and coalesce(z.menge_angekommen, 0) > 0;

-- beleg_freigeben verglich „vorher“ mit `pr.beleg_id <> b.id` — bei einer
-- Umlagerung ist beleg_id leer, der Vergleich null, die Zeile fiel heraus.
-- Genau diese eine Stelle der Live-Fassung wird ersetzt (Muster E4).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.beleg_freigeben(uuid)'::regprocedure);
  if position('pr.beleg_id <> b.id' in d) > 0 then
    execute replace(d, 'pr.beleg_id <> b.id', 'pr.beleg_id is distinct from b.id');
  elsif position('pr.beleg_id is distinct from b.id' in d) = 0 then
    raise exception 'beleg_freigeben: Stelle nicht gefunden';
  end if;
end $$;

-- ── Entwurf an den richtigen Standort ────────────────────────────────
create or replace function public.beleg_verschieben(p_beleg uuid, p_ziel uuid, p_pfad text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare b record; v_org uuid; v_org_ziel uuid; v_pfad text := nullif(btrim(p_pfad), '');
begin
  select * into b from public.einkaufsbelege where id = p_beleg for update;
  if b.id is null or not public.ist_inhaber(b.betrieb_id) or p_ziel is null or not public.ist_inhaber(p_ziel) then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  if b.status <> 'entwurf' then return jsonb_build_object('ok', false, 'grund', 'nicht_entwurf'); end if;
  if b.betrieb_id = p_ziel then return jsonb_build_object('ok', false, 'grund', 'gleich'); end if;
  select organisation_id into v_org from public.betriebe where id = b.betrieb_id;
  select organisation_id into v_org_ziel from public.betriebe where id = p_ziel;
  if v_org_ziel is distinct from v_org then return jsonb_build_object('ok', false, 'grund', 'andere_kette'); end if;
  if b.datei_pfad is not null then
    if v_pfad is null or v_pfad !~ ('^' || p_ziel::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|pdf)$')
       or right(v_pfad, 4) <> right(b.datei_pfad, 4)
       or not exists (select 1 from storage.objects o where o.bucket_id = 'belege' and o.name = v_pfad) then
      return jsonb_build_object('ok', false, 'grund', 'datei');
    end if;
  else
    v_pfad := null;
  end if;
  begin
    update public.einkaufsbelege set betrieb_id = p_ziel, datei_pfad = coalesce(v_pfad, datei_pfad) where id = b.id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'grund', 'datei_doppelt');
  end;
  return jsonb_build_object('ok', true, 'id', b.id, 'betrieb', p_ziel);
end $$;
revoke execute on function public.beleg_verschieben(uuid, uuid, text) from public, anon;
grant execute on function public.beleg_verschieben(uuid, uuid, text) to authenticated;

-- ── Ziele einer Umlagerung: die anderen Standorte der eigenen Kette ──
-- (zweiter Schritt, eingespielt als einkauf_e5b_standorte) Wer nur in A
-- Mitglied ist, kann `betriebe` von B nicht lesen — braucht aber Namen
-- und id als Ziel. Nur diese zwei Spalten, nur für Mitglieder.
create or replace function public.kette_standorte(p_betrieb uuid)
returns table (id uuid, name text)
language sql stable security definer set search_path = public
as $$
  select o.id, o.name from public.betriebe o
    join public.betriebe m on m.id = p_betrieb and m.organisation_id = o.organisation_id
   where o.id <> p_betrieb and p_betrieb in (select public.meine_betriebe())
   order by o.name, o.id;
$$;
revoke execute on function public.kette_standorte(uuid) from public, anon;
grant execute on function public.kette_standorte(uuid) to authenticated;
