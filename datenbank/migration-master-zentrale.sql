-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET 2026-09-25 (Supabase, „master_zentrale_vertragsdaten“).
--  Lokal PG16: 30 Proben, Gegenbeweis ohne Spaltenrechte 4 rot (M01–04).
--  Live zurückgedreht: Wirt setzt plan/pin_pflicht/preis → verweigert,
--  alle Board-Spalten weiter schreibbar, Rechnung OMO-2026-0001 = 236,81.
--
--  MIGRATION · Master-Zentrale: Vertragsdaten nur für den Master,
--  Reservierungs-Telefon live, Rechnungen, Login entsperren
--
--  BEFUND (25.09.2026, beim Bauen gemessen — §2.3a):
--  authenticated hatte UPDATE auf die GANZE Tabelle betriebe, und die
--  Regel „betrieb team aendert“ lässt das Team die eigene Zeile ändern.
--  Ein Wirt konnte also selbst setzen: plan (bezahlte Funktionen
--  freischalten), preis_monat (0 €), test_bis (Testphase verlängern),
--  zustand, gekuendigt_zum — und pin_pflicht, den zweiten Faktor, den
--  der Master für ihn eingeschaltet hat. Die Regel entscheidet, WELCHE
--  Zeilen; das Recht entscheidet, OB. Hier stand „ob“ weit offen.
--
--  Jetzt: Das Team darf genau die Spalten, die Board und Konto
--  wirklich schreiben (gezählt per grep über seiten/*.html:
--  bestell_pause, newsletter_aktiv, hub_stil, hub_woerter, liefer,
--  hub_texte, hub_kacheln, hub_avatar, hub_banner, markenblatt, ziele,
--  rechnung_an), dazu name, bestell_pause_text, tisch_pflicht und das
--  neue kontakt_telefon. Vertragsdaten ändert nur noch
--  master_betrieb_setzen() — mit ist_master() und damit mit PIN.
--
--  Rechnungen: Die Tabelle hatte nur eine Leseregel; angelegt wird
--  jetzt über master_rechnung_anlegen(), bezahlt über
--  master_rechnung_bezahlt(). Beide rechnen serverseitig, der Browser
--  schickt keine Beträge.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Reservierungs-Telefon, live statt im Markenblatt ───────────
alter table public.betriebe add column if not exists kontakt_telefon text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'betriebe_kontakt_telefon_form') then
    alter table public.betriebe add constraint betriebe_kontakt_telefon_form
      check (kontakt_telefon is null or kontakt_telefon ~ '^[+0-9][0-9 ()/.-]{3,30}$');
  end if;
end $$;
comment on column public.betriebe.kontakt_telefon is
  'Telefon für Reservierungen, im Hub live gelesen. Markenblatt nur Rückfall.';
grant select (kontakt_telefon) on public.betriebe to anon, authenticated;

-- ── 2 · Das Team schreibt nur noch seine Spalten ───────────────────
revoke update on public.betriebe from authenticated;
grant update (name, bestell_pause, bestell_pause_text, tisch_pflicht, markenblatt,
              hub_texte, hub_kacheln, hub_woerter, liefer, newsletter_aktiv,
              hub_avatar, hub_banner, hub_stil, ziele, rechnung_an, kontakt_telefon)
  on public.betriebe to authenticated;

-- ── 3 · Vertragsdaten: nur der Master ─────────────────────────────
create or replace function public.master_betrieb_setzen(p_betrieb uuid, p_werte jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public'
as $$
declare
  v_erlaubt text[] := array['name','plan','preis_monat','zustand','test_bis','vertrag_ab',
                            'gekuendigt_zum','kontakt_telefon','rechnung_an'];
  v_fremd text;
begin
  if not public.ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_master'); end if;
  if jsonb_typeof(p_werte) is distinct from 'object' then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  select string_agg(k, ', ') into v_fremd from jsonb_object_keys(p_werte) k where k <> all (v_erlaubt);
  if v_fremd is not null then return jsonb_build_object('ok', false, 'grund', 'unbekannt', 'felder', v_fremd); end if;

  begin
    update public.betriebe set
      name            = case when p_werte ? 'name'            then p_werte->>'name' else name end,
      plan            = case when p_werte ? 'plan'            then p_werte->>'plan' else plan end,
      preis_monat     = case when p_werte ? 'preis_monat'     then (p_werte->>'preis_monat')::numeric else preis_monat end,
      zustand         = case when p_werte ? 'zustand'         then (p_werte->>'zustand')::public.betrieb_zustand else zustand end,
      test_bis        = case when p_werte ? 'test_bis'        then (p_werte->>'test_bis')::timestamptz else test_bis end,
      vertrag_ab      = case when p_werte ? 'vertrag_ab'      then (p_werte->>'vertrag_ab')::date else vertrag_ab end,
      gekuendigt_zum  = case when p_werte ? 'gekuendigt_zum'  then (p_werte->>'gekuendigt_zum')::date else gekuendigt_zum end,
      kontakt_telefon = case when p_werte ? 'kontakt_telefon' then nullif(btrim(p_werte->>'kontakt_telefon'), '') else kontakt_telefon end,
      rechnung_an     = case when p_werte ? 'rechnung_an'     then p_werte->'rechnung_an' else rechnung_an end
    where id = p_betrieb;
    if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt_betrieb'); end if;
  exception
    when check_violation then return jsonb_build_object('ok', false, 'grund', 'schranke', 'text', sqlerrm);
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
      or numeric_value_out_of_range then
      return jsonb_build_object('ok', false, 'grund', 'form', 'text', sqlerrm);
  end;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 4 · Rechnungen: angelegt und bezahlt nur über den Master ──────
-- Nummer OMO-JJJJ-NNNN, fortlaufend je Jahr. Betrag aus preis_monat,
-- anteilig nie — ein Monat ist ein Monat. Steuersatz 19 %.
create or replace function public.master_rechnung_anlegen(p_betrieb uuid, p_monat date)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public'
as $$
declare
  v_b public.betriebe%rowtype;
  v_von date := date_trunc('month', p_monat)::date;
  v_bis date := (date_trunc('month', p_monat) + interval '1 month - 1 day')::date;
  v_nr text;
  v_netto numeric(10,2);
  v_id uuid;
begin
  if not public.ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_master'); end if;
  select * into v_b from public.betriebe where id = p_betrieb;
  if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt_betrieb'); end if;
  if coalesce(v_b.preis_monat, 0) <= 0 then return jsonb_build_object('ok', false, 'grund', 'kein_preis'); end if;
  if exists (select 1 from public.rechnungen where betrieb_id = p_betrieb and zeitraum_von = v_von) then
    return jsonb_build_object('ok', false, 'grund', 'schon_da');
  end if;
  -- Nummernvergabe unter Sperre: zwei gleichzeitige Klicks bekämen
  -- sonst dieselbe Nummer (und der zweite scheiterte am UNIQUE).
  perform pg_advisory_xact_lock(hashtext('omoteno-rechnungsnummer'));
  select 'OMO-' || to_char(v_von, 'YYYY') || '-' ||
         lpad((coalesce(max(split_part(nummer, '-', 3)::int), 0) + 1)::text, 4, '0')
    into v_nr
    from public.rechnungen where nummer like 'OMO-' || to_char(v_von, 'YYYY') || '-%';
  v_netto := round(v_b.preis_monat, 2);
  insert into public.rechnungen (betrieb_id, nummer, zeitraum_von, zeitraum_bis, netto, steuersatz, brutto,
                                 posten, gestellt_am, faellig_am)
    values (p_betrieb, v_nr, v_von, v_bis, v_netto, 19, round(v_netto * 1.19, 2),
            jsonb_build_array(jsonb_build_object(
              'text', 'Omoteno ' || coalesce(initcap(v_b.plan), 'Paket') || ' · ' || to_char(v_von, 'MM/YYYY'),
              'netto', v_netto)),
            current_date, current_date + 14)
    returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'nummer', v_nr);
end;
$$;

create or replace function public.master_rechnung_bezahlt(p_rechnung uuid, p_bezahlt boolean)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public'
as $$
begin
  if not public.ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_master'); end if;
  update public.rechnungen set bezahlt_am = case when p_bezahlt then current_date else null end
   where id = p_rechnung;
  return jsonb_build_object('ok', found);
end;
$$;

-- ── 5 · Die Sperre nach drei Fehlversuchen: Master hebt sie auf ────
create or replace function public.master_login_entsperren(p_nutzer uuid)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public'
as $$
begin
  if not public.ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_master'); end if;
  update public.admin_login_schutz
     set fehlversuche = 0, gesperrt = false, gesperrt_seit = null, aktualisiert = now()
   where nutzer_id = p_nutzer;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.master_betrieb_setzen(uuid, jsonb), public.master_rechnung_anlegen(uuid, date),
  public.master_rechnung_bezahlt(uuid, boolean), public.master_login_entsperren(uuid) from public, anon;
grant execute on function public.master_betrieb_setzen(uuid, jsonb), public.master_rechnung_anlegen(uuid, date),
  public.master_rechnung_bezahlt(uuid, boolean), public.master_login_entsperren(uuid) to authenticated;

commit;
