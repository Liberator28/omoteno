-- ═══════════════════════════════════════════════════════════════════
--  migration-einkauf-e2.sql · Einkauf & Kosten, Stufe E2
--  (Plan: dokumente/plan-einkauf.md · baut auf migration-einkauf.sql)
--
--  Was hier entsteht:
--   · Privater Eimer „belege“ für Rechnungsfotos und PDFs. Pfad
--     <betrieb_id>/<uuid>.jpg|pdf. Lesen: Mitglieder des Betriebs;
--     Hochladen: Inhaber. Kein Löschen, kein Überschreiben (§2.8).
--   · einkaufsbelege.datei_hash — derselbe Upload zweimal legt keinen
--     zweiten Beleg an (eindeutig je Betrieb, verworfene ausgenommen).
--   · beleg_speichern() nimmt datei_pfad/datei_hash/quelle an —
--     GLEICHE Signatur, nur der Körper wächst (§2.1).
--   · Inventur (gezählter Bestand → Differenzbuchung) und Verlust,
--     beide nur über Funktionen, beide als Lagerbewegung.
--
--  Additiv, kein drop, kein delete (§2.8). Abgewiesen wird mit Grund,
--  nicht mit Ausnahme (§2.3g).
--
--  ANGEWENDET 12.10. (Supabase-MCP, einkauf_e2). Zurückgedrehte Probe
--  datenbank/pruef-einkauf-e2.sql, alles wie erwartet:
--   · Foto-Entwurf speichert quelle/pfad/hash; dieselbe Datei nochmal
--     (Hash in Großbuchstaben) → datei_doppelt mit der Beleg-ID; Pfad
--     im fremden Ordner → datei; Hash in falscher Form → form; Ändern
--     behält die Datei; nach Verwerfen ist die Datei wieder frei.
--   · 25 kg Eingang, Inventur 20 kg → eine Buchung −5000 g, −4,00 €;
--     dieselbe Zählung nochmal → 0 Buchungen; Verlust 1 kg → −0,80 €,
--     Bestand 19000 g; negativ/leer/„abc“/0 → Grund statt Ausnahme.
--   · Speicher: Inhaber lädt in den eigenen Ordner, falscher Name und
--     fremder Ordner 42501; Team liest, lädt nicht; Fremder liest 0,
--     anon sieht 0. Team/Fremder: Inventur, Verlust, Speichern kein_recht.
--   · Je Funktion eine Signatur; artikel_letzter_preis für niemanden
--     aufrufbar (nur innerhalb der Funktionen); anon ohne EXECUTE.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Eimer „belege“ ────────────────────────────────────────────
-- Nur JPEG und PDF: Die Seite rechnet jedes Foto (auch HEIC vom
-- iPhone) vorher in ein JPEG um — das kann Claude lesen und es ist
-- kleiner. 10 MB reichen für ein mehrseitiges PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('belege', 'belege', false, 10485760, array['image/jpeg', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Der erste Ordner ist die Betriebs-ID. CASE statt AND: Postgres
-- verspricht keine Reihenfolge beim Auswerten, ein ::uuid auf einen
-- fremden Namen würde sonst werfen (Muster aus migration-schriften.sql).
do $$ begin
  create policy "belege mitglied liest" on storage.objects for select to authenticated
    using (bucket_id = 'belege' and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid in (select public.meine_betriebe())
      else false end);
  create policy "belege inhaber laedt hoch" on storage.objects for insert to authenticated
    with check (bucket_id = 'belege'
      and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|pdf)$'
      and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid in (select public.meine_betriebe_inhaber())
      else false end);
exception when duplicate_object then null; end $$;

-- ── 2 · Derselbe Upload nicht zweimal ─────────────────────────────
alter table public.einkaufsbelege add column if not exists datei_hash text
  check (datei_hash is null or datei_hash ~ '^[0-9a-f]{64}$');
create unique index if not exists einkaufsbelege_datei_einmal
  on public.einkaufsbelege (betrieb_id, datei_hash)
  where datei_hash is not null and status <> 'verworfen';

-- ── 3 · beleg_speichern mit Datei ─────────────────────────────────
-- Gleiche Signatur wie in migration-einkauf.sql. Neu: datei_pfad,
-- datei_hash und quelle (foto/pdf) beim ANLEGEN; beim Ändern bleiben
-- sie, wie sie sind — ein Entwurf wechselt seine Rechnung nicht.
create or replace function public.beleg_speichern(p_beleg uuid, p_betrieb uuid, p_daten jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
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
  if v_id is null and v_pfad is not null then
    -- Nur eine Datei im eigenen Ordner, in der Form, die der Eimer annimmt.
    if v_pfad !~ ('^' || v_betrieb::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|pdf)$') then
      return jsonb_build_object('ok', false, 'grund', 'datei');
    end if;
  end if;
  if v_id is null and v_hash is not null then
    select id into v_vorhanden from public.einkaufsbelege
     where betrieb_id = v_betrieb and datei_hash = v_hash and status <> 'verworfen' limit 1;
    if v_vorhanden is not null then return jsonb_build_object('ok', false, 'grund', 'datei_doppelt', 'beleg', v_vorhanden); end if;
  end if;
  begin
    if v_id is null then
      insert into public.einkaufsbelege (betrieb_id, lieferant_id, belegnummer, belegdatum, netto, steuer, brutto,
                                         quelle, notiz, positionen_entwurf, angelegt_von, datei_pfad, datei_hash)
      values (v_betrieb, v_lief, nullif(btrim(p_daten ->> 'belegnummer'), ''),
              coalesce(nullif(p_daten ->> 'belegdatum', '')::date, current_date),
              nullif(p_daten ->> 'netto', '')::numeric, nullif(p_daten ->> 'steuer', '')::numeric,
              nullif(p_daten ->> 'brutto', '')::numeric,
              v_quelle, nullif(btrim(p_daten ->> 'notiz'), ''),
              v_pos, auth.uid(), v_pfad, v_hash)
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
  exception when data_exception or check_violation then
    return jsonb_build_object('ok', false, 'grund', 'form', 'text', sqlerrm);
  when unique_violation then
    -- Zwei gleichzeitige Uploads derselben Datei: der zweite verliert.
    return jsonb_build_object('ok', false, 'grund', 'datei_doppelt');
  end;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;

-- ── 4 · Inventur und Verlust ──────────────────────────────────────
create table if not exists public.inventuren (
  id          uuid primary key default gen_random_uuid(),
  betrieb_id  uuid not null references public.betriebe(id),
  gezaehlt_am timestamptz not null default now(),
  nutzer_id   uuid,
  notiz       text check (notiz is null or length(notiz) <= 200),
  positionen  integer not null default 0,
  differenz_wert numeric(12,2)
);
alter table public.inventuren enable row level security;
do $$ begin
  create policy "inventur betrieb liest" on public.inventuren for select to authenticated
    using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
exception when duplicate_object then null; end $$;
revoke all on public.inventuren from anon, authenticated;
grant select on public.inventuren to authenticated;

alter table public.lagerbewegungen add column if not exists inventur_id uuid references public.inventuren(id);

-- Letzter Einkaufspreis je Basiseinheit in der Organisation — Wert
-- einer Inventurdifferenz oder eines Verlusts. Ohne Einkauf: null.
create or replace function public.artikel_letzter_preis(p_artikel uuid, p_org uuid)
returns numeric language sql stable security definer set search_path = public as $function$
  select pr.preis_basis from public.artikel_preise pr join public.betriebe b on b.id = pr.betrieb_id
   where pr.artikel_id = p_artikel and b.organisation_id = p_org
   order by pr.belegdatum desc, pr.position_id desc limit 1;
$function$;
revoke execute on function public.artikel_letzter_preis(uuid, uuid) from public, anon, authenticated;

-- Gezählt wird der ganze Bestand eines Artikels; gebucht wird nur die
-- Differenz zum Stand der Bewegungen. Ein Artikel, der nicht gezählt
-- wurde, bleibt unberührt (nicht „0“).
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
    v_preis := public.artikel_letzter_preis(v_art, v_org);
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
  v_preis := public.artikel_letzter_preis(p_artikel, v_org);
  insert into public.lagerbewegungen (betrieb_id, artikel_id, art, menge_basis, wert_netto, nutzer_id, notiz)
  values (p_betrieb, p_artikel, 'verlust', -p_menge, round(-p_menge * v_preis, 2), auth.uid(), coalesce(nullif(btrim(p_notiz), ''), 'Verlust'));
  return jsonb_build_object('ok', true, 'wert', round(-p_menge * v_preis, 2));
end $function$;

revoke execute on function public.inventur_buchen(uuid, jsonb, text)       from public, anon;
revoke execute on function public.verlust_buchen(uuid, uuid, numeric, text) from public, anon;
grant  execute on function public.inventur_buchen(uuid, jsonb, text)       to authenticated;
grant  execute on function public.verlust_buchen(uuid, uuid, numeric, text) to authenticated;
