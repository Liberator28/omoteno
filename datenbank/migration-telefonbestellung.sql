-- ═══════════════════════════════════════════════════════════════════
--  migration-telefonbestellung.sql · Alessia nimmt am Telefon auf
--  NEU GEFASST 10.10. — die Fassung vom 05.09. wurde nie eingespielt
--  (live gemessen: keine Funktion bestellung_telefon, keine Spalte
--  telefon_nummer, Edge Function alessia-bestellung nicht ausgerollt,
--  0 Telefonbestellungen). Sie wäre heute an Aktionspreis, Bremsen,
--  Markierung (pruefen), Testphase und Tagesnummer vorbeigelaufen.
--
--  Live gemessen VOR dem Bau (§1.2, §2.3c):
--   · CHECK bestellungen_quelle_check erlaubt 'telefon'
--   · bestellungen trägt gast_name, gast_telefon, transkript, abholung,
--     wunschzeit, pruefen, pruef_grund, tagesnummer
--   · UNIQUE idx_bestellung_gast_kennung (gast_kennung) — eine Kennung
--     ist EINE Bestellung (§1.1a). Hier: 'tel:' || Vapi-Anruf-ID, damit
--     ein wiederholter Werkzeugaufruf im selben Anruf nichts doppelt.
--   · positionen_pruefen(betrieb, positionen) rechnet Preise aus der
--     Karte inkl. laufender Aktion — wird wiederverwendet, nicht kopiert.
--   · anon liest betriebe nur spaltenweise → neue Spalten sind für
--     Gäste unsichtbar. authenticated hat Tabellenrechte → Wache unten.
--   · Küche liest quelle=in.(tisch,telefon,lieferung) und zeichnet den
--     Telefonbon (Abholung, #Nummer, Name, Rückrufnummer, Wunschzeit).
--
--  Trennung der Betriebe: Der Betrieb kommt AUSSCHLIESSLICH aus der
--  angerufenen Nummer (oder der Vapi-Nummer-ID) — nie vom Anrufer und
--  nie aus dem, was das Sprachmodell sagt. Jede Abfrage danach hängt an
--  genau dieser einen id.
--
--  Keine Zeile beginnt mit drop oder delete (§2.8).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Welche Nummer gehört zu welchem Haus, und wie ist Alessia dort
alter table public.betriebe add column if not exists telefon_nummer text;
alter table public.betriebe add column if not exists alessia jsonb;

create unique index if not exists betriebe_telefon_nummer_uniq
  on public.betriebe (telefon_nummer) where telefon_nummer is not null;
create unique index if not exists betriebe_alessia_nummer_id_uniq
  on public.betriebe ((alessia->>'nummer_id')) where alessia ? 'nummer_id';

alter table public.betriebe add constraint betriebe_telefon_nummer_form check (
  telefon_nummer is null or telefon_nummer ~ '^\+[1-9][0-9]{6,14}$');
alter table public.betriebe add constraint betriebe_alessia_form check (
  alessia is null or (jsonb_typeof(alessia) = 'object' and length(alessia::text) <= 2000));

comment on column public.betriebe.telefon_nummer is
  'Alessias Rufnummer dieses Hauses (E.164, +4930…). Der Webhook findet den Betrieb über die ANGERUFENE Nummer.';
comment on column public.betriebe.alessia is
  '{aktiv, assistent_id, nummer_id, stimme, begruessung} — nur der Master setzt das (alessia_wache).';

-- ── 2 · Nur der Master setzt Nummer und Alessia
-- Sonst könnte ein Konto eine fremde Nummer eintragen, und die Anrufe
-- eines anderen Hauses landeten in seiner Küche. Die Rolle des Teams
-- regelt betrieb_rolle_wache — die lässt Inhaber alles ändern, deshalb
-- eine eigene Wache. Andere Rollen (service_role, postgres) dürfen.
create or replace function public.alessia_wache() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.ist_master() then return new; end if;
  if tg_op = 'INSERT' then
    if new.telefon_nummer is not null or new.alessia is not null then
      raise exception 'nur_master' using errcode = '42501', hint = 'Rufnummer und Alessia setzt omoteno.';
    end if;
  elsif new.telefon_nummer is distinct from old.telefon_nummer or new.alessia is distinct from old.alessia then
    raise exception 'nur_master' using errcode = '42501', hint = 'Rufnummer und Alessia setzt omoteno.';
  end if;
  return new;
end $$;
revoke all on function public.alessia_wache() from public, anon, authenticated;
create trigger alessia_wache before insert or update on public.betriebe
  for each row execute function public.alessia_wache();

-- ── 3 · Welches Haus wurde angerufen?
create or replace function public.alessia_betrieb(p_gerufene_nummer text, p_nummer_id text default null)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select id from betriebe
   where (p_gerufene_nummer is not null and telefon_nummer = regexp_replace(p_gerufene_nummer, '[^0-9+]', '', 'g'))
      or (p_nummer_id is not null and alessia->>'nummer_id' = p_nummer_id)
   order by id limit 1;
$$;
revoke all on function public.alessia_betrieb(text, text) from public, anon, authenticated;

-- ── 4 · Was Alessia wissen darf — und NUR das
-- Genau, was der Hub jedem Gast ohnehin zeigt: Name, Bestellpause,
-- verfügbare Gerichte mit Preis/Aktionspreis, Beschreibung, Kennziffern,
-- vegan/vegetarisch, Altersfreigabe, Abholung/Lieferung an/aus.
-- NIE: Umsätze, Bestellungen, Gäste, Team, Codes, Verträge, andere Häuser.
create or replace function public.alessia_wissen(p_gerufene_nummer text, p_nummer_id text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_id uuid; b record;
begin
  v_id := alessia_betrieb(p_gerufene_nummer, p_nummer_id);
  if v_id is null then return jsonb_build_object('ok', false, 'grund', 'unbekannte_nummer'); end if;
  select name, bestell_pause, bestell_pause_text, zustand, alessia, liefer into b from betriebe where id = v_id;
  if coalesce((b.alessia->>'aktiv')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'grund', 'aus');
  end if;
  return jsonb_build_object(
    'ok', true,
    'betrieb', b.name,
    'nimmt_an', not b.bestell_pause and b.zustand::text <> 'gekuendigt' and b.zustand::text <> 'pausiert',
    'pause_satz', case when b.bestell_pause then coalesce(nullif(b.bestell_pause_text, ''), 'Wir nehmen gerade keine Bestellungen an.') end,
    'abholung', true,
    'lieferung_im_hub', coalesce((b.liefer->>'an')::boolean, false),
    'karte', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'name', g.name, 'kategorie', g.kategorie, 'preis', g.preis,
               'aktionspreis', (select min(a.preis_neu) from aktionen a
                                 where a.betrieb_id = v_id and a.gericht_name = g.name
                                   and coalesce(a.aktiv, true) and now() between a.von and a.bis
                                   and a.preis_neu < g.preis),
               'beschreibung', left(g.beschreibung, 200),
               'allergene', nullif(g.allergene, ''), 'zusatzstoffe', nullif(g.zusatzstoffe, ''),
               'vegan', case when g.vegan then true end,
               'vegetarisch', case when g.veg or g.vegan then true end,
               'ab_alter', g.ab_alter))
             order by g.kat_sort nulls last, g.kategorie, g.reihenfolge, g.id)
        from gerichte g where g.betrieb_id = v_id and g.verfuegbar), '[]'::jsonb));
end $$;
revoke all on function public.alessia_wissen(text, text) from public, anon, authenticated;

-- ── 5 · Der Weg hinein
-- Rückgabe immer jsonb mit 'sagen' (ein Satz zum Vorlesen), nie eine
-- Ausnahme: Gezählt wird vor dem Eintrag, und eine Ausnahme danach
-- drehte den Zähler zurück (§2.3g).
create or replace function public.bestellung_telefon(
  p_gerufene_nummer text,
  p_anrufer         text,
  p_name            text,
  p_positionen      jsonb,
  p_notiz           text default null,
  p_wunschzeit      timestamptz default null,
  p_transkript      text default null,
  p_ruf_id          text default null,
  p_nummer_id       text default null
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_id       uuid;
  b          record;
  v_kennung  text;
  v_alt      record;
  v_eintrag  jsonb;
  v_name     text;
  v_menge    int;
  v_echt     text;
  v_pos      jsonb := '[]'::jsonb;
  v_fehlt    text[] := '{}';
  v_pp       jsonb;
  v_summe    numeric;
  v_nr       smallint;
  v_beginn   timestamptz;
  v_neu      uuid;
  v_pruefen  boolean := false;
  v_grund    text;
  v_wunsch   timestamptz;
  v_anrufer  text;
  v_k_anruf  text;
  v_k_haus   text;
  v_n        int;
begin
  v_id := alessia_betrieb(p_gerufene_nummer, p_nummer_id);
  if v_id is null then
    return jsonb_build_object('ok', false, 'grund', 'unbekannte_nummer',
      'sagen', 'Diese Nummer ist gerade keinem Restaurant zugeordnet. Bitte rufen Sie das Restaurant direkt an.');
  end if;
  select id, name, bestell_pause, bestell_pause_text, zustand, test_bis, alessia into b from betriebe where id = v_id;
  if coalesce((b.alessia->>'aktiv')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'grund', 'aus',
      'sagen', 'Telefonbestellungen sind hier gerade nicht eingeschaltet. Bitte bestellen Sie direkt beim Personal.');
  end if;

  -- (a) Derselbe Anruf zum zweiten Mal: dieselbe Bestellung, nichts doppelt.
  if p_ruf_id is not null and length(p_ruf_id) between 4 and 72 then
    v_kennung := 'tel:' || p_ruf_id;
    select id, tagesnummer, summe into v_alt from bestellungen where gast_kennung = v_kennung limit 1;
    if v_alt.id is not null then
      return jsonb_build_object('ok', true, 'id', v_alt.id, 'nummer', v_alt.tagesnummer, 'summe', v_alt.summe, 'doppelt', true,
        'sagen', 'Ihre Bestellung ist schon notiert' || coalesce(', Nummer ' || v_alt.tagesnummer, '') || '.');
    end if;
  end if;

  -- (b) Nimmt das Haus an? Dieselben Wächter wie am Tisch.
  if b.zustand::text in ('gekuendigt', 'pausiert')
     or (b.zustand::text = 'test' and b.test_bis is not null and b.test_bis < now()) then
    return jsonb_build_object('ok', false, 'grund', 'vertrag',
      'sagen', 'Telefonbestellungen gehen hier gerade nicht. Bitte bestellen Sie direkt beim Personal.');
  end if;
  if b.bestell_pause then
    return jsonb_build_object('ok', false, 'grund', 'pause',
      'sagen', coalesce(nullif(b.bestell_pause_text, ''), 'Wir nehmen gerade keine Bestellungen an.'));
  end if;

  -- (c) Jedes Gericht gegen DIESE Karte. Gehört nicht verfügbar oder
  --     nicht hier → keine Bestellung, sondern ein Satz mit den Namen,
  --     damit Alessia nachfragen kann (am Telefon lässt sich das klären).
  if p_positionen is null or jsonb_typeof(p_positionen) <> 'array' or jsonb_array_length(p_positionen) = 0 then
    return jsonb_build_object('ok', false, 'grund', 'leer', 'sagen', 'Es wurde noch nichts bestellt.');
  end if;
  if jsonb_array_length(p_positionen) > 40 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viel', 'sagen', 'Das ist eine sehr große Bestellung — bitte sprechen Sie dafür direkt mit dem Restaurant.');
  end if;
  for v_eintrag in select * from jsonb_array_elements(p_positionen) loop
    v_name  := btrim(coalesce(v_eintrag->>'name', ''));
    v_menge := case when coalesce(v_eintrag->>'menge', '1') ~ '^[0-9]{1,3}$' then (coalesce(v_eintrag->>'menge', '1'))::int else 1 end;
    v_menge := greatest(1, least(30, v_menge));
    v_echt := null;
    select g.name into v_echt from gerichte g
     where g.betrieb_id = v_id and g.verfuegbar and lower(btrim(g.name)) = lower(v_name)
     order by g.id limit 1;
    if v_echt is null then
      v_fehlt := v_fehlt || left(v_name, 60);
    else
      v_pos := v_pos || jsonb_build_object('name', v_echt, 'menge', v_menge);
    end if;
  end loop;
  if array_length(v_fehlt, 1) > 0 then
    return jsonb_build_object('ok', false, 'grund', 'unbekanntes_gericht', 'fehlt', to_jsonb(v_fehlt),
      'sagen', '„' || array_to_string(v_fehlt, '“, „') || '“ steht heute nicht auf unserer Karte. Möchten Sie etwas anderes?');
  end if;
  -- Preis aus der Karte, mit laufender Aktion — dieselbe Rechnung wie am Tisch.
  v_pp := positionen_pruefen(v_id, v_pos);
  if v_pp ? 'fehler' then
    return jsonb_build_object('ok', false, 'grund', 'positionen', 'sagen', 'Das konnte ich so nicht aufnehmen. Bitte sagen Sie mir die Bestellung noch einmal.');
  end if;
  v_summe := (v_pp->>'summe')::numeric;

  -- (d) Bremsen: je Anrufer und je Haus. Weich → markieren (die Küche
  --     sieht „wartet auf Freigabe“), hart → freundlich abweisen. Nie
  --     werfen (§2.3g). Die Rufnummer geht nur gehasht in den Zähler.
  v_anrufer := nullif(regexp_replace(coalesce(p_anrufer, ''), '[^0-9+]', '', 'g'), '');
  v_k_anruf := 'tel:a:' || v_id::text || ':' || md5(coalesce(v_anrufer, 'unterdrueckt'));
  v_k_haus  := 'tel:b:' || v_id::text;
  v_n := schutz_stand(v_k_anruf);
  if v_n >= 10 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele',
      'sagen', 'Von dieser Nummer kamen gerade sehr viele Bestellungen. Bitte wenden Sie sich direkt an das Restaurant.');
  end if;
  if v_n >= 3 then v_pruefen := true; v_grund := 'Viele Telefonbestellungen in kurzer Zeit von dieser Nummer'; end if;
  if schutz_stand(v_k_haus) >= 40 and not v_pruefen then v_pruefen := true; v_grund := 'Viele Telefonbestellungen in kurzer Zeit im ganzen Haus'; end if;

  -- (e) Wunschzeit nur, wenn sie Sinn ergibt (nicht in der Vergangenheit, höchstens 24 h).
  v_wunsch := case when p_wunschzeit between now() - interval '5 minutes' and now() + interval '24 hours' then p_wunschzeit end;

  -- (f) Tagesnummer wie am Tisch (ab 100), damit Küche und Gast dieselbe sagen.
  perform pg_advisory_xact_lock(hashtext('tagesnummer:' || v_id::text));
  v_beginn := date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin';
  select coalesce(max(tagesnummer), 99) + 1 into v_nr from bestellungen where betrieb_id = v_id and zeitpunkt >= v_beginn;
  if v_nr > 999 then v_nr := null; end if;

  insert into bestellungen (
    betrieb_id, quelle, status, positionen, summe, summe_gast,
    gast_name, gast_telefon, notiz, abholung, wunschzeit,
    transkript, tagesnummer, gast_kennung, pruefen, pruef_grund, zeitpunkt
  ) values (
    v_id, 'telefon', 'neu', v_pp->'positionen', v_summe, v_summe,
    nullif(left(btrim(coalesce(p_name, '')), 80), ''),
    left(v_anrufer, 20),
    nullif(left(btrim(coalesce(p_notiz, '')), 500), ''),
    true, v_wunsch,
    nullif(left(coalesce(p_transkript, ''), 8000), ''),
    v_nr, v_kennung, v_pruefen, v_grund, now()
  ) returning id into v_neu;
  perform schutz_zaehlen(v_k_anruf);
  perform schutz_zaehlen(v_k_haus);

  return jsonb_build_object('ok', true, 'id', v_neu, 'nummer', v_nr, 'summe', v_summe,
    'sagen', 'Notiert' || coalesce(' — Ihre Abholnummer ist ' || v_nr, '') ||
             '. Das macht ' || replace(to_char(v_summe, 'FM9990.00'), '.', ',') || ' Euro.');
end $$;
revoke all on function public.bestellung_telefon(text, text, text, jsonb, text, timestamptz, text, text, text)
  from public, anon, authenticated;

-- ── 6 · Übersicht für den Master
create or replace function public.master_alessia()
returns table (betrieb_id uuid, slug text, name text, telefon_nummer text, alessia jsonb,
               letzte_bestellung timestamptz, bestellungen_7_tage bigint)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not ist_master() then raise exception 'nur_master' using errcode = '42501'; end if;
  return query
    select b.id, b.slug, b.name, b.telefon_nummer, b.alessia,
           (select max(x.zeitpunkt) from bestellungen x where x.betrieb_id = b.id and x.quelle = 'telefon'),
           (select count(*) from bestellungen x where x.betrieb_id = b.id and x.quelle = 'telefon' and x.zeitpunkt > now() - interval '7 days')
      from betriebe b order by b.name, b.id;
end $$;
revoke all on function public.master_alessia() from public, anon;
grant execute on function public.master_alessia() to authenticated;

create or replace function public.master_alessia_setzen(p_betrieb uuid, p_nummer text, p_alessia jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_nr text; v_n int;
begin
  if not ist_master() then return jsonb_build_object('ok', false, 'grund', 'nur_master'); end if;
  v_nr := nullif(regexp_replace(coalesce(p_nummer, ''), '[^0-9+]', '', 'g'), '');
  if v_nr is not null and v_nr !~ '^\+[1-9][0-9]{6,14}$' then
    return jsonb_build_object('ok', false, 'grund', 'nummer_form');
  end if;
  if v_nr is not null and exists (select 1 from betriebe where telefon_nummer = v_nr and id <> p_betrieb) then
    return jsonb_build_object('ok', false, 'grund', 'nummer_vergeben');
  end if;
  if p_alessia is not null and (jsonb_typeof(p_alessia) <> 'object' or length(p_alessia::text) > 2000) then
    return jsonb_build_object('ok', false, 'grund', 'form');
  end if;
  if p_alessia ? 'nummer_id' and exists (select 1 from betriebe where alessia->>'nummer_id' = p_alessia->>'nummer_id' and id <> p_betrieb) then
    return jsonb_build_object('ok', false, 'grund', 'nummer_vergeben');
  end if;
  update betriebe set telefon_nummer = v_nr,
         alessia = jsonb_strip_nulls(jsonb_build_object(
           'aktiv', coalesce((p_alessia->>'aktiv')::boolean, false),
           'assistent_id', nullif(left(p_alessia->>'assistent_id', 80), ''),
           'nummer_id', nullif(left(p_alessia->>'nummer_id', 80), ''),
           'stimme', nullif(left(p_alessia->>'stimme', 300), ''),
           'begruessung', nullif(left(p_alessia->>'begruessung', 200), '')))
   where id = p_betrieb;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n = 1, 'grund', case when v_n = 1 then null else 'unbekannt' end);
end $$;
revoke all on function public.master_alessia_setzen(uuid, text, jsonb) from public, anon;
grant execute on function public.master_alessia_setzen(uuid, text, jsonb) to authenticated;

-- ═══ ANGEWENDET 10.10. (live, apply_migration „alessia_telefonbestellung“) ═══
-- Danach (§2.1): je Funktion GENAU eine Fassung; anon führt keine aus,
-- authenticated nur master_alessia / master_alessia_setzen.
-- PROBE (zurückgedreht, §2.2; Choco/Blend mit Probe-Nummern +49642299900x):
--   alessia_wissen Choco          → 106 Gerichte, nur Felder name/kategorie/preis/
--                                   (aktionspreis)/beschreibung/allergene/
--                                   zusatzstoffe/vegetarisch/ab_alter; 0 Blend-Gerichte
--   über nummer_id                → Choco; unbekannte Nummer → unbekannte_nummer
--   Bestellung (GROSS geschrieben, Menge 2 + 1) → ok, Abholnummer 100, 24,30 €
--                                   = positionen_pruefen derselben Positionen
--   Zeile                         → quelle telefon, richtiger Betrieb, abholung,
--                                   Name, Rückrufnummer, pruefen false
--   gleicher Anruf (ruf_id) erneut → DIESELBE id, „schon notiert, Nummer 100“
--   unbekanntes Gericht           → keine Zeile, Satz mit dem Namen
--   Choco-Gericht über Blend-Nr.  → unbekanntes_gericht (Häuser getrennt)
--   Pause / Alessia aus / fremde Nr. → pause (Pausentext) / aus / unbekannte_nummer
--   11 Anrufe derselben Nummer    → 1–3 normal, 4–10 markiert (pruefen), 11 abgewiesen
-- Rechte (Rolle authenticated über request.jwt.claims, Choco-Inhaber):
--   Name ändern                   → 1 Zeile (§2.7, andere Spalte)
--   Rufnummer / Alessia setzen    → permission denied (kein Spaltenrecht)
--   … mit testweise geöffnetem Recht → nur_master (die Wache hält auch dann)
--   master_alessia(_setzen)       → nur_master;  bestellung_telefon → permission denied
