-- ═══════════════════════════════════════════════════════════════════
--  MISSBRAUCH · Was jeder mit der Webadresse tun kann, und die Bremsen
--
--  Auftrag (26.09.): „Jeder, der die Webadresse hat, kann bestellen und
--  womöglich die Küche mit nicht existenten Bestellungen bombardieren.
--  Alle Sicherheitslücken und Möglichkeiten, das System auszunutzen,
--  decken und lösen."
--
--  Grundsatz (CLAUDE.md §7): Ein echter Gast, der nicht bestellen kann,
--  kostet mehr als ein Teller zu viel. Deshalb, wo ein Gast betroffen
--  sein könnte: durchlassen und MARKIEREN (die Küche zeigt es erst nach
--  Freigabe im Board). Hart abgewiesen wird nur, was kein Gast je tut.
--
--  Teile, jeder einzeln angewendet und geprüft:
--    1 · push_gemeldet — „melden“ meldet jede Bestellung genau einmal
--    2 · (folgt) Bestellungen: Karte, Mengen, Preis vom Server, Bremse
--    3 · (folgt) übrige offene Wege
--
--  ANGEWENDET: Teil 1–4 am 26.09.2026 — Teil 2 und 3 vorher
--  zurückgedreht gegen den echten Bestand geprobt (14 + 13 Proben,
--  datenbank/pruef-missbrauch.sql).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · push_gemeldet ─────────────────────────────────────────────
-- Die Edge Function „melden“ (ausgerollt als swift-processor) nahm den
-- Text der Push-Meldung ungeprüft aus der Anfrage: Jeder konnte jedem
-- Betrieb beliebigen Text auf die Sperrbildschirme schicken. Jetzt liest
-- sie nur die id, holt die Zeile selbst und meldet jede Bestellung genau
-- einmal — dieser Eintrag ist das „einmal“. Nur die Funktion (Service-
-- Rolle) schreibt; anon und authenticated haben kein Recht.
create table if not exists public.push_gemeldet (
  bestellung_id uuid primary key references public.bestellungen(id) on delete cascade,
  am            timestamptz not null default now()
);
alter table public.push_gemeldet enable row level security;
revoke all on public.push_gemeldet from anon, authenticated;
comment on table public.push_gemeldet is
  'Welche Bestellung die Push-Funktion schon gemeldet hat (genau einmal). Nur Service-Rolle.';

-- ── 2 · Bestellungen ──────────────────────────────────────────────
-- VORHER (gemessen am Funktionstext, 26.09.):
--   · Ein Gericht, das es nicht gibt, wurde still übersprungen. Nur
--     erfundene Namen → Summe 0 → keine Preisprüfung → Bon in der Küche.
--   · Mengen unbegrenzt; der Preis je Position kam vom Gast und stand so
--     im Board.
--   · Keine Bremse je Gerät, Herkunft, Tisch oder Betrieb.
-- Gegen den echten Bestand gerechnet: 57 Positionen in 33 echten
-- Bestellungen — jede passt zu einem verfügbaren Gericht, größte Menge 6.
-- Die neuen Grenzen hätten keinen echten Gast getroffen.

-- 2a · Zähler. Feste 10-Minuten-Fenster; gezählt werden nur ANGELEGTE
-- Bestellungen (ein abgewiesener Versuch zählt nicht — der Hub versucht
-- es bis zu 10 Minuten lang still erneut, der Gast soll sich nicht
-- selbst aussperren). Ein Zähler in einer Transaktion, die mit raise
-- endet, würde ohnehin zurückgedreht.
create table if not exists public.schutz_zaehler (
  schluessel text not null,
  fenster    timestamptz not null,
  n          integer not null default 0,
  primary key (schluessel, fenster)
);
alter table public.schutz_zaehler enable row level security;
revoke all on public.schutz_zaehler from anon, authenticated;

-- Herkunft: cf-connecting-ip, Rückfall x-real-ip — NIE das erste
-- Element von x-forwarded-for, das schreibt der Aufrufer selbst
-- (gemessen, CLAUDE.md §2.3e). Gespeichert wird nur ein Hash mit
-- täglich neuem Salz; nach einem Tag ist er niemandem mehr zuzuordnen.
create table if not exists public.schutz_salz (
  tag  date primary key,
  salz text not null
);
alter table public.schutz_salz enable row level security;
revoke all on public.schutz_salz from anon, authenticated;

create or replace function public.schutz_herkunft()
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_kopf jsonb; v_ip text; v_salz text;
begin
  begin
    v_kopf := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then v_kopf := null;
  end;
  v_ip := coalesce(nullif(btrim(v_kopf->>'cf-connecting-ip'), ''), nullif(btrim(v_kopf->>'x-real-ip'), ''));
  if v_ip is null then return null; end if;
  select salz into v_salz from schutz_salz where tag = current_date;
  if v_salz is null then
    insert into schutz_salz(tag, salz) values (current_date, gen_random_uuid()::text || gen_random_uuid()::text)
      on conflict (tag) do nothing;
    select salz into v_salz from schutz_salz where tag = current_date;
    delete from schutz_salz where tag < current_date - 1;
  end if;
  return encode(sha256(convert_to(v_ip || '|' || v_salz, 'UTF8')), 'hex');
end $$;

create or replace function public.schutz_stand(p_schluessel text, p_min integer default 10)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select n from schutz_zaehler
                    where schluessel = p_schluessel
                      and fenster = date_bin(make_interval(mins => p_min), now(), timestamptz '2000-01-01')), 0);
$$;

create or replace function public.schutz_zaehlen(p_schluessel text, p_min integer default 10)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare v_n integer;
begin
  insert into schutz_zaehler(schluessel, fenster, n)
  values (p_schluessel, date_bin(make_interval(mins => p_min), now(), timestamptz '2000-01-01'), 1)
  on conflict (schluessel, fenster) do update set n = schutz_zaehler.n + 1
  returning n into v_n;
  if random() < 0.02 then delete from schutz_zaehler where fenster < now() - interval '1 day'; end if;
  return v_n;
end $$;

revoke execute on function public.schutz_herkunft() from public, anon, authenticated;
revoke execute on function public.schutz_stand(text, integer) from public, anon, authenticated;
revoke execute on function public.schutz_zaehlen(text, integer) from public, anon, authenticated;

-- 2b · Quarantäne: durchlassen und markieren (§7). Die Küche zeigt eine
-- markierte Bestellung erst nach Freigabe im Board; „melden“ pusht sie nicht.
alter table public.bestellungen add column if not exists pruefen boolean not null default false;
alter table public.bestellungen add column if not exists pruef_grund text;

-- 2c · Positionen gegen die Karte. Liefert die bereinigten Positionen,
-- die Summe (Kartenpreis, Aktionspreis, Aufpreis höchstens 12 € je
-- Position — der höchste Optionsaufpreis im Hub ist 3,10 €), den
-- Warenwert ohne Aufpreise und die Zahl der Positionen ohne Gericht.
create or replace function public.positionen_pruefen(p_betrieb_id uuid, p_positionen jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  pos jsonb; v_name text; v_basis text; v_menge integer; v_gast numeric; v_preis numeric; v_aktion numeric;
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
    -- Der Hub schickt JS-Zahlen: 7,50 + 3,10 kommt als 10.600000000000001.
    v_gast := case when coalesce(pos->>'preis', '') ~ '^[0-9]{1,5}([.][0-9]+)?$'
                   then round((pos->>'preis')::numeric, 2) end;
    select g.preis into v_preis from gerichte g
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
    v_raus := v_raus || jsonb_build_object('name', v_name, 'menge', v_menge, 'preis', round(v_preis, 2));
  end loop;
  if v_stueck > 100 then
    return jsonb_build_object('fehler', 'Sehr große Bestellung — bitte sprechen Sie kurz mit dem Personal.');
  end if;
  return jsonb_build_object('positionen', v_raus, 'summe', round(v_summe, 2),
                            'waren', round(v_waren, 2), 'unbekannt', v_unbekannt);
end $$;
revoke execute on function public.positionen_pruefen(uuid, jsonb) from public, anon, authenticated;

-- 2d · bestellung_aufgeben — dieselbe Signatur (§2.1: create or replace
-- ersetzt nur bei identischer Signatur; geprüft nach dem Einspielen).
-- Neu gegenüber der Fassung vom 25.09.:
--   · Positionen über positionen_pruefen(): gespeichert werden die
--     bereinigten Positionen und die Summe des SERVERS; was der Gast
--     schickte, steht in summe_gast.
--   · Leere Bestellung am Tisch/zur Lieferung → abgewiesen.
--   · Gericht ohne Treffer auf der Karte → markiert (pruefen), nicht
--     abgewiesen: ein Gast mit veralteter Karte soll nicht leer ausgehen.
--   · Bremse nach dem Wiederholungs-Rücksprung (gast_kennung), vor dem
--     Anlegen: über „weich“ markiert, über „hart“ abgewiesen.
create or replace function public.bestellung_aufgeben(
  p_betrieb_id uuid, p_quelle text, p_tisch text default null::text, p_summe numeric default 0,
  p_notiz text default null::text, p_positionen jsonb default '[]'::jsonb, p_gast_kennung text default null::text,
  p_tisch_schluessel text default null::text, p_sitzung text default null::text, p_geraet text default null::text,
  p_rabattcode text default null::text)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare
  neue        uuid;
  b           record;
  t           record;
  s           record;
  v_code      record;
  v_code_id   uuid;
  tisch_final text;
  bestaetigt  boolean := false;
  basis_summe numeric := 0;
  v_summe     numeric := 0;
  v_rabattbetrag numeric(8,2) := 0;
  v_pp        jsonb := null;
  v_pos       jsonb := '[]'::jsonb;
  tagesnr     smallint := null;
  tagesbeginn timestamptz;
  v_pruefen   boolean := false;
  v_grund     text := null;
  v_herkunft  text;
  v_art       text;
  v_faktor    integer;
  v_schl      text[] := '{}';
  v_weich     integer[] := '{}';
  v_hart      integer[] := '{}';
  v_was       text[] := '{}';
  i           integer;
  v_n         integer;
begin
  if p_betrieb_id is null then raise exception 'Betrieb fehlt' using errcode='P0001'; end if;
  if p_quelle is null or p_quelle not in ('tisch','service','lieferung') then
    raise exception 'Quelle ungueltig' using errcode='P0001';
  end if;

  select id, slug, bestell_pause, bestell_pause_text, tisch_pflicht, zustand, test_bis
    into b from betriebe where id = p_betrieb_id;
  if not found then raise exception 'Betrieb unbekannt' using errcode='P0001'; end if;

  if b.zustand = 'gekuendigt' then
    raise exception 'Hier kann gerade nicht bestellt werden. Bitte wenden Sie sich an das Personal.'
      using errcode='P0001';
  end if;
  if b.zustand = 'pausiert' then
    raise exception 'Die Bestellung am Tisch ist vorübergehend abgeschaltet. Bitte wenden Sie sich an das Personal.'
      using errcode='P0001';
  end if;
  if b.zustand = 'test' and b.test_bis is not null and b.test_bis < now() then
    raise exception 'Die Testphase dieses Hubs ist abgelaufen. Bitte wenden Sie sich an das Personal.'
      using errcode='P0001';
  end if;

  if p_gast_kennung is not null
     and (length(p_gast_kennung) < 8 or length(p_gast_kennung) > 80) then
    raise exception 'Kennung ungueltig' using errcode='P0001';
  end if;

  if p_geraet is not null
     and (length(p_geraet) < 8 or length(p_geraet) > 64
          or p_geraet !~ '^[A-Za-z0-9_-]+$') then
    p_geraet := null;
  end if;

  if p_notiz is not null and length(p_notiz) > 500 then
    raise exception 'Anmerkung zu lang' using errcode='P0001';
  end if;

  if b.bestell_pause then
    raise exception '%', coalesce(nullif(b.bestell_pause_text,''),
      'Wir nehmen gerade keine Bestellungen an.') using errcode='P0001';
  end if;

  tisch_final := p_tisch;

  if p_sitzung is not null and p_sitzung <> '' then
    select si.id, si.tisch_id, ti.nummer
      into s
      from tisch_sitzungen si
      join tische ti on ti.id = si.tisch_id
     where si.token = p_sitzung
       and si.betrieb_id = p_betrieb_id
       and si.gueltig_bis > now()
       and ti.aktiv
     limit 1;

    if found then
      tisch_final := s.nummer;
      bestaetigt  := true;
      update tisch_sitzungen
         set letzte_aktivitaet = now(),
             gueltig_bis       = now() + interval '4 hours'
       where id = s.id;
    end if;
  end if;

  if not bestaetigt and p_tisch_schluessel is not null and p_tisch_schluessel <> '' then
    select ti.nummer, ti.aktiv into t
      from tische ti
     where ti.schluessel = p_tisch_schluessel
       and ti.betrieb_id = p_betrieb_id;
    if not found or not t.aktiv then
      raise exception 'Dieser Tischcode gilt hier nicht.' using errcode='P0001';
    end if;
    tisch_final := t.nummer;
    bestaetigt  := true;
  end if;

  if not bestaetigt and b.tisch_pflicht then
    raise exception 'Zum Bestellen bitte kurz den Untersetzer auf Ihrem Tisch antippen.'
      using errcode='P0001';
  end if;

  if tisch_final is not null and length(tisch_final) > 20 then
    raise exception 'Tischangabe ungueltig' using errcode='P0001';
  end if;

  if p_quelle in ('tisch','lieferung') then
    v_pp := positionen_pruefen(p_betrieb_id, coalesce(p_positionen, '[]'::jsonb));
    if v_pp ? 'fehler' then
      raise exception '%', v_pp->>'fehler' using errcode='P0001';
    end if;
    if jsonb_array_length(v_pp->'positionen') = 0 then
      raise exception 'Ihre Auswahl ist noch leer.' using errcode='P0001';
    end if;
    v_pos       := v_pp->'positionen';
    v_summe     := (v_pp->>'summe')::numeric;
    basis_summe := (v_pp->>'waren')::numeric;
    if (v_pp->>'unbekannt')::integer > 0 then
      v_pruefen := true;
      v_grund   := 'Gericht nicht (mehr) auf der Karte';
    end if;

    if p_rabattcode is not null and p_rabattcode <> '' then
      select id, betrag, prozent, eingeloest, gueltig_bis into v_code
        from rabattcodes
       where betrieb_id = p_betrieb_id and code = p_rabattcode
       for update;

      if v_code.id is null then
        raise exception 'Dieser Rabattcode ist unbekannt.' using errcode='P0001';
      end if;
      if v_code.eingeloest then
        raise exception 'Dieser Rabattcode wurde bereits eingelöst.' using errcode='P0001';
      end if;
      if v_code.gueltig_bis is not null and v_code.gueltig_bis < now() then
        raise exception 'Dieser Rabattcode ist abgelaufen.' using errcode='P0001';
      end if;

      v_code_id := v_code.id;
      -- Wie bisher auf den Warenwert (ohne Aufpreise) — keine stille Änderung.
      v_rabattbetrag := coalesce(v_code.betrag, round(basis_summe * v_code.prozent / 100, 2));
      v_rabattbetrag := least(v_rabattbetrag, v_summe);
    end if;

    if basis_summe > 0 and coalesce(p_summe,0) < (basis_summe - v_rabattbetrag) - 0.01 then
      raise exception 'Der Preis stimmt nicht. Bitte die Karte neu laden.'
        using errcode='P0001';
    end if;
  end if;

  -- Wiederholung desselben Versuchs: die vorhandene id, ohne zu zählen.
  if p_gast_kennung is not null then
    select id into neue from bestellungen where gast_kennung = p_gast_kennung limit 1;
    if neue is not null then return neue; end if;
  end if;

  -- ── Bremse ──
  -- Je 10 Minuten. Ein bestätigter Tisch (Untersetzer) darf doppelt so
  -- viel. Die Herkunft ist hoch angesetzt: Im WLAN des Hauses teilen
  -- sich alle Gäste EINE Adresse.
  v_herkunft := schutz_herkunft();
  v_art      := case when p_quelle = 'service' then 's' else 'b' end;
  v_faktor   := case when bestaetigt then 2 else 1 end;
  if p_geraet is not null then
    v_schl := v_schl || (v_art || ':g:' || p_geraet);
    v_weich := v_weich || (case when v_art = 's' then 4 else 6 end * v_faktor);
    v_hart  := v_hart  || (case when v_art = 's' then 12 else 20 end * v_faktor);
    v_was   := v_was   || 'von diesem Gerät'::text;
  end if;
  if v_herkunft is not null then
    v_schl := v_schl || (v_art || ':h:' || p_betrieb_id::text || ':' || v_herkunft);
    v_weich := v_weich || (30 * v_faktor);
    v_hart  := v_hart  || (120 * v_faktor);
    v_was   := v_was   || 'aus diesem Netz'::text;
  end if;
  if tisch_final is not null and p_quelle <> 'lieferung' then
    v_schl := v_schl || (v_art || ':t:' || p_betrieb_id::text || ':' || lower(tisch_final));
    v_weich := v_weich || (case when v_art = 's' then 6 else 8 end * v_faktor);
    v_hart  := v_hart  || (case when v_art = 's' then 20 else 30 end * v_faktor);
    v_was   := v_was   || 'von diesem Tisch'::text;
  end if;
  v_schl := v_schl || (v_art || ':b:' || p_betrieb_id::text);
  v_weich := v_weich || (case when v_art = 's' then 60 else 150 end);
  v_hart  := v_hart  || 100000;     -- den ganzen Betrieb nie abweisen, nur markieren
  v_was   := v_was   || 'im ganzen Haus'::text;

  for i in 1 .. coalesce(array_length(v_schl, 1), 0) loop
    v_n := schutz_stand(v_schl[i]);
    if v_n >= v_hart[i] then
      raise exception 'Gerade kommen sehr viele Bestellungen %. Bitte wenden Sie sich kurz an das Personal.', v_was[i]
        using errcode='P0001';
    end if;
    if v_n >= v_weich[i] and not v_pruefen then
      v_pruefen := true;
      v_grund   := 'Viele Bestellungen in kurzer Zeit ' || v_was[i];
    end if;
  end loop;

  if p_quelle = 'tisch' then
    perform pg_advisory_xact_lock(hashtext('tagesnummer:' || p_betrieb_id::text));
    tagesbeginn := date_trunc('day', now() at time zone 'Europe/Berlin')
                     at time zone 'Europe/Berlin';
    select coalesce(max(tagesnummer), 99) + 1 into tagesnr
      from bestellungen
     where betrieb_id = p_betrieb_id
       and zeitpunkt >= tagesbeginn;
    if tagesnr > 999 then tagesnr := null; end if;
  end if;

  insert into bestellungen
    (betrieb_id, quelle, status, tisch, summe, summe_gast, notiz,
     positionen, gast_kennung, tagesnummer, tisch_bestaetigt, geraet, pruefen, pruef_grund)
  values
    (p_betrieb_id, p_quelle, 'neu', tisch_final,
     -- Ein Serviceruf trägt weder Positionen noch Summe.
     case when p_quelle = 'service' then 0 else v_summe end, coalesce(p_summe,0),
     p_notiz, case when p_quelle = 'service' then '[]'::jsonb else v_pos end, p_gast_kennung,
     tagesnr, bestaetigt, p_geraet, v_pruefen, v_grund)
  returning id into neue;

  for i in 1 .. coalesce(array_length(v_schl, 1), 0) loop
    perform schutz_zaehlen(v_schl[i]);
  end loop;

  if v_code_id is not null then
    update rabattcodes
       set eingeloest = true, eingeloest_bestellung_id = neue, eingeloest_am = now()
     where id = v_code_id;
    update bestellungen
       set rabatt_betrag = v_rabattbetrag, rabatt_code = p_rabattcode
     where id = neue;
  end if;

  return neue;
end;
$function$;

-- 2e · bestellung_liefern — dieselbe Signatur. Einzige Änderung: Der
-- Mindestbestellwert wird gegen die Summe des SERVERS gehalten, nicht
-- gegen die Zahl aus dem Browser (vorher genügte p_summe = mindest).
create or replace function public.bestellung_liefern(
  p_betrieb_id uuid, p_adresse jsonb, p_positionen jsonb, p_summe numeric,
  p_notiz text default null::text, p_gast_kennung text default null::text,
  p_geraet text default null::text, p_rabattcode text default null::text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_liefer    jsonb;
  v_plz       text;
  v_mindest   numeric;
  v_gebuehr   numeric;
  v_gratis    numeric;
  v_id        uuid;
  v_ware      numeric;
  v_rabatt    numeric;
  v_endgueltig numeric;
  v_pp        jsonb;
begin
  select liefer into v_liefer from betriebe where id = p_betrieb_id;

  if v_liefer is null or coalesce((v_liefer->>'an')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'grund', 'aus');
  end if;

  if p_adresse is null
     or coalesce(trim(p_adresse->>'name'), '')    = ''
     or coalesce(trim(p_adresse->>'strasse'), '') = ''
     or coalesce(trim(p_adresse->>'plz'), '')     = ''
     or coalesce(trim(p_adresse->>'ort'), '')     = ''
     or coalesce(trim(p_adresse->>'telefon'), '') = ''
  then
    return jsonb_build_object('ok', false, 'grund', 'adresse');
  end if;
  -- Längen: eine Adresse, keine Datei.
  if length(p_adresse::text) > 1000 then
    return jsonb_build_object('ok', false, 'grund', 'adresse');
  end if;

  v_plz := trim(p_adresse->>'plz');
  if jsonb_typeof(v_liefer->'plz') <> 'array'
     or jsonb_array_length(v_liefer->'plz') = 0
     or not exists (
       select 1 from jsonb_array_elements_text(v_liefer->'plz') p
        where trim(p) = v_plz)
  then
    return jsonb_build_object('ok', false, 'grund', 'plz', 'plz', v_plz);
  end if;

  if v_liefer ? 'zeiten' and jsonb_typeof(v_liefer->'zeiten') = 'object' then
    declare
      v_jetzt   timestamp := now() at time zone 'Europe/Berlin';
      v_von     time;
      v_bis     time;
      v_uhr     time;
      v_tag     int;
      v_tage    jsonb := v_liefer->'zeiten'->'tage';
      v_offen   boolean;
    begin
      v_von := nullif(v_liefer->'zeiten'->>'von', '')::time;
      v_bis := nullif(v_liefer->'zeiten'->>'bis', '')::time;
      v_uhr := v_jetzt::time;
      v_tag := extract(isodow from v_jetzt)::int;

      if jsonb_typeof(v_tage) = 'array' and jsonb_array_length(v_tage) > 0
         and not exists (select 1 from jsonb_array_elements_text(v_tage) d
                          where d::int = v_tag)
      then
        return jsonb_build_object('ok', false, 'grund', 'zeit');
      end if;

      if v_von is not null and v_bis is not null then
        v_offen := case when v_von <= v_bis
                        then v_uhr >= v_von and v_uhr < v_bis
                        else v_uhr >= v_von or  v_uhr < v_bis end;
        if not v_offen then
          return jsonb_build_object('ok', false, 'grund', 'zeit',
                                    'von', to_char(v_von, 'HH24:MI'),
                                    'bis', to_char(v_bis, 'HH24:MI'));
        end if;
      end if;
    end;
  end if;

  v_mindest := coalesce((v_liefer->>'mindest')::numeric, 0);
  v_pp := positionen_pruefen(p_betrieb_id, coalesce(p_positionen, '[]'::jsonb));
  if v_mindest > 0 and coalesce((v_pp->>'summe')::numeric, 0) < v_mindest then
    return jsonb_build_object('ok', false, 'grund', 'mindest',
                              'mindest', v_mindest);
  end if;

  v_id := bestellung_aufgeben(
            p_betrieb_id   => p_betrieb_id,
            p_quelle       => 'lieferung',
            p_tisch        => null,
            p_summe        => p_summe,
            p_notiz        => p_notiz,
            p_positionen   => p_positionen,
            p_gast_kennung => p_gast_kennung,
            p_geraet       => p_geraet,
            p_rabattcode   => p_rabattcode);

  if v_id is null then
    return jsonb_build_object('ok', false, 'grund', 'abgewiesen');
  end if;

  select summe, coalesce(rabatt_betrag,0) into v_ware, v_rabatt from bestellungen where id = v_id;
  v_ware := coalesce(v_ware, 0);

  v_gebuehr := coalesce((v_liefer->>'gebuehr')::numeric, 0);
  v_gratis  := coalesce((v_liefer->>'gratis_ab')::numeric, 0);
  if v_gratis > 0 and v_ware >= v_gratis then
    v_gebuehr := 0;
  end if;

  update bestellungen
     set liefer_adresse = jsonb_strip_nulls(jsonb_build_object(
           'name',    trim(p_adresse->>'name'),
           'strasse', trim(p_adresse->>'strasse'),
           'plz',     v_plz,
           'ort',     trim(p_adresse->>'ort'),
           'telefon', trim(p_adresse->>'telefon'),
           'klingel', nullif(trim(coalesce(p_adresse->>'klingel','')), ''))),
         liefergebuehr  = v_gebuehr,
         abholung       = false
   where id = v_id;

  v_endgueltig := v_ware + v_gebuehr;

  return jsonb_build_object(
    'ok',       true,
    'id',       v_id,
    'ware',     v_ware,
    'rabatt',   v_rabatt,
    'gebuehr',  v_gebuehr,
    'summe',    v_endgueltig,
    'dauer',    coalesce((v_liefer->>'dauer_min')::int, null));
end $function$;

-- ── 3 · Die übrigen offenen Wege ─────────────────────────────────
-- Gefunden beim Durchgang (26.09.), jeweils am Funktionstext gelesen:
--   · bestellung_bremse wies ALLE Bestellungen des Hauses ab, sobald 60
--     in 2 Minuten kamen, und jeden Tisch nach 6 in 2 Minuten. Damit
--     war die Bremse selbst die Angriffsfläche: 60 falsche Bestellungen,
--     und kein echter Gast kam mehr durch; eine gefälschte Tischnummer
--     sperrte einen echten Tisch. Jetzt: markieren statt abweisen (§7),
--     und markierte zählen nicht mit.
--   · anfragen_bremse zählte ALLE Anfragen: 30 falsche in einer Stunde,
--     und das Formular der Landingpage war für jeden tot. Jetzt je
--     Herkunft (3 in 10 Minuten), dazu eine weite Obergrenze.
--   · reservierung_bremse: je Telefon/Name (bleibt) — dazu je Herkunft.
--   · ereignisse: Inhalt ohne Größengrenze.
--   · gast_melden legte für jede neue Kennung eine Gastzeile an,
--     gast_mail_merken schickte jede Adresse weiter an Klaviyo — beides
--     ohne Bremse.
--   · Eimer „anfragen“: jede Datei bis 25 MB, jeder Pfad, ungebremst.
-- Bewusst NICHT geändert: tisch_sitzung_start. Die Tischschlüssel sind
-- 8 Zeichen aus Groß-, Kleinbuchstaben und Ziffern (gemessen, 20
-- Tische): 62^8 ≈ 2·10^14 — auch mit 10 000 Versuchen je Sekunde im
-- Mittel Jahrzehnte bis zum Treffer.

-- 3a · bestellung_bremse: markieren statt abweisen
create or replace function public.bestellung_bremse()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  vom_tisch   integer;
  vom_betrieb integer;
begin
  -- Nur Meldungen vom Gast. Was das Team oder Alessia einträgt, läuft
  -- ungebremst; schon Markiertes wird nicht noch einmal gezählt.
  if new.quelle not in ('tisch','service') or new.pruefen then
    return new;
  end if;

  if new.tisch is not null then
    select count(*) into vom_tisch
      from bestellungen
     where betrieb_id = new.betrieb_id and tisch = new.tisch
       and zeitpunkt > now() - interval '2 minutes' and not pruefen;
    if vom_tisch >= 6 then
      new.pruefen := true;
      new.pruef_grund := 'Viele Bestellungen in kurzer Zeit von diesem Tisch';
      return new;
    end if;
  end if;

  select count(*) into vom_betrieb
    from bestellungen
   where betrieb_id = new.betrieb_id
     and zeitpunkt > now() - interval '2 minutes' and not pruefen;
  if vom_betrieb >= 60 then
    new.pruefen := true;
    new.pruef_grund := 'Sehr viele Bestellungen im ganzen Haus';
  end if;
  return new;
end $$;
revoke execute on function public.bestellung_bremse() from public, anon, authenticated;

-- 3b · anfragen: je Herkunft, Längen
create or replace function public.anfragen_bremse()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_herkunft text; v_alle integer;
begin
  -- Längen: ein Formular, kein Speicher.
  if length(coalesce(new.notiz,'')) > 4000 or length(coalesce(new.hinweise,'')) > 4000
     or length(coalesce(new.betrieb,'')) > 200 or length(coalesce(new.ort,'')) > 300
     or length(coalesce(new.ansprechpartner,'')) > 200 or length(coalesce(new.email,'')) > 200
     or length(coalesce(new.telefon,'')) > 60 or length(coalesce(new.kasse,'')) > 200
     or length(coalesce(new.start_wann,'')) > 200 or length(coalesce(new.kontaktweg,'')) > 200
     or length(coalesce(new.quelle,'')) > 200 or length(coalesce(new.kennung,'')) > 40
     or length(coalesce(new.antworten::text,'')) > 20000 or length(coalesce(new.dateien::text,'')) > 20000
     or coalesce(new.tische, 0) not between 0 and 10000 then
    raise exception 'Die Anfrage ist zu lang. Bitte kürzen oder uns direkt schreiben.' using errcode = 'P0001';
  end if;

  v_herkunft := schutz_herkunft();
  if v_herkunft is not null then
    if schutz_stand('a:h:' || v_herkunft) >= 3 then
      raise exception 'Zu viele Anfragen in kurzer Zeit. Bitte spaeter erneut versuchen.' using errcode = 'P0001';
    end if;
    perform schutz_zaehlen('a:h:' || v_herkunft);
  end if;

  -- Die weite Obergrenze bleibt, als letzter Deckel.
  select count(*) into v_alle from anfragen where erstellt_am > now() - interval '1 hour';
  if v_alle >= 200 then
    raise exception 'Zu viele Anfragen in kurzer Zeit. Bitte spaeter erneut versuchen.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.anfragen_bremse() from public, anon, authenticated;

-- 3c · ereignisse: Größe
create or replace function public.ereignis_bremse()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  vom_tisch   integer;
  vom_betrieb integer;
  bid         uuid;
begin
  if length(coalesce(new.inhalt::text, '')) > 4000 or length(coalesce(new.art, '')) > 60
     or length(coalesce(new.tisch, '')) > 20 then
    raise exception 'Meldung zu lang' using errcode = 'P0001';
  end if;
  -- betrieb_id kann fehlen, weil der Hub historisch den Slug in
  -- "betrieb" schickt. Dann ueber den Slug nachschlagen.
  bid := new.betrieb_id;
  if bid is null and new.betrieb is not null then
    select id into bid from betriebe where slug = new.betrieb;
    new.betrieb_id := bid;
  end if;
  if bid is null then
    raise exception 'Unbekannter Betrieb' using errcode = 'P0001';
  end if;

  if new.tisch is not null then
    select count(*) into vom_tisch from ereignisse
     where betrieb_id = bid and tisch = new.tisch
       and zeitpunkt > now() - interval '2 minutes';
    if vom_tisch >= 5 then
      raise exception 'Zu viele Meldungen von diesem Tisch. Bitte einen Moment warten.'
        using errcode = 'P0001';
    end if;
  end if;

  select count(*) into vom_betrieb from ereignisse
   where betrieb_id = bid and zeitpunkt > now() - interval '2 minutes';
  if vom_betrieb >= 60 then
    raise exception 'Gerade sehr viele Meldungen. Bitte kurz warten.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.ereignis_bremse() from public, anon, authenticated;

-- 3d · reservierungen: zusätzlich je Herkunft
create or replace function public.reservierung_bremse()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  anzahl integer;
  v_herkunft text;
begin
  if new.quelle <> 'tisch' then
    return new;
  end if;

  select count(*) into anzahl
  from reservierungen
  where betrieb_id  = new.betrieb_id
    and eingegangen > now() - interval '1 hour'
    and (telefon = new.telefon or lower(name) = lower(new.name));
  if anzahl >= 3 then
    raise exception
      'Es liegen bereits Anfragen von Ihnen vor. Bitte rufen Sie uns an.'
      using errcode = 'P0001';
  end if;

  v_herkunft := schutz_herkunft();
  if v_herkunft is not null then
    if schutz_stand('r:h:' || new.betrieb_id::text || ':' || v_herkunft) >= 4 then
      raise exception
        'Es liegen bereits Anfragen von Ihnen vor. Bitte rufen Sie uns an.'
        using errcode = 'P0001';
    end if;
    perform schutz_zaehlen('r:h:' || new.betrieb_id::text || ':' || v_herkunft);
  end if;

  select count(*) into anzahl
  from reservierungen
  where betrieb_id  = new.betrieb_id
    and eingegangen > now() - interval '10 minutes';
  if anzahl >= 40 then
    raise exception 'Gerade sehr viele Anfragen. Bitte kurz warten.'
      using errcode = 'P0001';
  end if;

  return new;
end $$;
revoke execute on function public.reservierung_bremse() from public, anon, authenticated;

-- 3e · gast_melden — dieselbe Signatur. Neu: Eine NEUE Gastzeile
-- entsteht höchstens 40-mal je 10 Minuten aus demselben Netz (das WLAN
-- des Hauses ist ein Netz — ein voller Abend bleibt weit darunter).
-- Darüber: ok:false, grund 'bremse'; der Hub zeigt „Mein Tisch“ dann
-- einfach nicht, die Bestellung ist davon nicht berührt.
create or replace function public.gast_melden(p_slug text, p_kennung text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_betrieb uuid;
  v_gast    public.gaeste%rowtype;
  v_neu     boolean := false;
  v_lieblinge jsonb;
  v_gutscheine jsonb;
  v_herkunft text;
begin
  if p_kennung is null or length(p_kennung) < 8 or length(p_kennung) > 64
     or p_kennung !~ '^[A-Za-z0-9_-]+$' then
    return jsonb_build_object('ok', false, 'grund', 'kennung');
  end if;

  select id into v_betrieb from public.betriebe where slug = p_slug;
  if v_betrieb is null then
    return jsonb_build_object('ok', false, 'grund', 'betrieb');
  end if;

  select * into v_gast from public.gaeste
   where betrieb_id = v_betrieb and kennung = p_kennung;

  if not found then
    v_herkunft := schutz_herkunft();
    if v_herkunft is not null then
      if schutz_stand('gm:h:' || v_betrieb::text || ':' || v_herkunft) >= 40 then
        return jsonb_build_object('ok', false, 'grund', 'bremse');
      end if;
      perform schutz_zaehlen('gm:h:' || v_betrieb::text || ':' || v_herkunft);
    end if;
    insert into public.gaeste(betrieb_id, kennung)
      values (v_betrieb, p_kennung)
      returning * into v_gast;
    v_neu := true;
  else
    update public.gaeste
       set besuche = besuche + case when letzter_besuch < now() - interval '4 hours' then 1 else 0 end,
           letzter_besuch = now()
     where id = v_gast.id
     returning * into v_gast;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'mal', mal) order by mal desc, name), '[]'::jsonb)
    into v_lieblinge
  from (
    select p->>'name' as name, sum(coalesce((p->>'menge')::int, 1)) as mal
      from public.bestellungen b
      cross join lateral jsonb_array_elements(coalesce(b.positionen, '[]'::jsonb)) as p
     where b.betrieb_id = v_betrieb
       and b.geraet = p_kennung
       and p->>'name' is not null
     group by 1
     order by 2 desc, 1
     limit 3
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
           'titel', g.titel, 'text', g.beschreibung, 'code', g.code,
           'bis', g.gueltig_bis) order by g.gueltig_bis nulls last, g.id), '[]'::jsonb)
    into v_gutscheine
  from public.gutscheine g
   where g.betrieb_id = v_betrieb
     and (g.gast_id = v_gast.id or g.gast_id is null)
     and g.eingeloest_am is null
     and (g.gueltig_bis is null or g.gueltig_bis > now());

  return jsonb_build_object(
    'ok', true,
    'neu', v_neu,
    'besuche', v_gast.besuche,
    'seit', v_gast.erster_besuch,
    'lieblinge', v_lieblinge,
    'gutscheine', v_gutscheine
  );
end $$;

-- 3f · gast_mail_merken — dieselbe Signatur. Neu: höchstens 5 Adressen
-- je 10 Minuten aus demselben Netz. Jede gemerkte Adresse geht an
-- Klaviyo; ohne Bremse ließe sich darüber jede fremde Adresse eintragen.
create or replace function public.gast_mail_merken(p_slug text, p_kennung text, p_email text)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_catalog' as $$
declare
  v_betrieb uuid;
  v_mail    text := btrim(coalesce(p_email, ''));
  v_treffer int;
  v_herkunft text;
begin
  if p_kennung is null or length(p_kennung) < 8 or length(p_kennung) > 64
     or p_kennung !~ '^[A-Za-z0-9_-]+$' then
    return jsonb_build_object('ok', false, 'grund', 'kennung');
  end if;

  if v_mail = '' or length(v_mail) > 160 or v_mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$' then
    return jsonb_build_object('ok', false, 'grund', 'email');
  end if;

  select id into v_betrieb from public.betriebe where slug = p_slug;
  if v_betrieb is null then
    return jsonb_build_object('ok', false, 'grund', 'betrieb');
  end if;

  v_herkunft := schutz_herkunft();
  if v_herkunft is not null then
    if schutz_stand('gmm:h:' || v_herkunft) >= 5 then
      return jsonb_build_object('ok', false, 'grund', 'bremse');
    end if;
    perform schutz_zaehlen('gmm:h:' || v_herkunft);
  end if;

  update public.gaeste
     set email            = lower(v_mail),
         email_gewollt_am = now(),
         email_bestaetigt_am = case when lower(email) is distinct from lower(v_mail)
                                    then null else email_bestaetigt_am end
   where betrieb_id = v_betrieb and kennung = p_kennung;

  get diagnostics v_treffer = row_count;
  if v_treffer = 0 then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;

  return jsonb_build_object('ok', true);
end $$;

-- 3g · Eimer „anfragen“: Größe wie im Formular (20 MB je Datei), nur
-- unter einer Anfragenummer (OMO-XXXXX), höchstens 10 Dateien je Anfrage
-- und 15 je 10 Minuten aus demselben Netz. Dateitypen bleiben offen:
-- Das Formular nimmt Karten als Pages/Numbers/Word an, die oft ohne
-- Typ kommen — der Eimer ist privat (nur der Master liest), eine
-- Typliste hätte echte Anfragen abgewiesen und nichts geschützt.
update storage.buckets set file_size_limit = 20971520 where id = 'anfragen';

create or replace function public.anfrage_anhang_ok(p_name text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_ordner text; v_herkunft text; v_da integer;
begin
  v_ordner := split_part(coalesce(p_name, ''), '/', 1);
  if v_ordner !~ '^OMO-[A-Z0-9]{5}$' or p_name !~ '^OMO-[A-Z0-9]{5}/[A-Za-z0-9._-]{1,90}$' then
    return false;
  end if;
  select count(*) into v_da from storage.objects
   where bucket_id = 'anfragen' and name like v_ordner || '/%';
  if v_da >= 10 then return false; end if;
  -- Deckel für den ganzen Eimer, unabhängig von der Herkunft: Echte
  -- Anfragen kommen wenige am Tag. 60 Dateien je Stunde sind reichlich.
  select count(*) into v_da from storage.objects
   where bucket_id = 'anfragen' and created_at > now() - interval '1 hour';
  if v_da >= 60 then return false; end if;
  v_herkunft := schutz_herkunft();
  if v_herkunft is not null then
    if schutz_stand('d:h:' || v_herkunft) >= 15 then return false; end if;
    perform schutz_zaehlen('d:h:' || v_herkunft);
  end if;
  return true;
end $$;
-- §2.7: Eine Funktion in einer Regel braucht EXECUTE für die Rolle, die
-- schreibt — hier anon. Aufrufbar ist sie damit auch als rpc; mehr als
-- den eigenen Zähler hochsetzen kann man damit nicht.
revoke execute on function public.anfrage_anhang_ok(text) from public;
grant  execute on function public.anfrage_anhang_ok(text) to anon;

-- GEMESSEN nach dem Einspielen (Upload über pg_net, 26.09.): Der
-- Storage-Dienst reicht KEINE request.headers an die Datenbank weiter —
-- der Zähler 'd:h:' blieb bei 0. Die Bremse je Netz greift beim Hochladen
-- also nicht. Was trägt, ist unabhängig von der Herkunft: nur unter
-- OMO-XXXXX/…, höchstens 10 Dateien je Anfrage, 60 je Stunde im ganzen
-- Eimer. Ein falscher Pfad wurde live mit 403 abgewiesen.
-- (Die Probe-Datei OMO-PRUEF/probe.json, 11 Byte, liegt noch im privaten
-- Eimer; direkt per SQL gelöscht bliebe sie im Speicher verwaist.)
drop policy if exists "anfragen anhang hochladen" on storage.objects;
create policy "anfragen anhang hochladen" on storage.objects for insert to anon
  with check (bucket_id = 'anfragen' and public.anfrage_anhang_ok(name));

-- ── 4 · Tote Regeln entfernen ─────────────────────────────────────
-- anon hat KEIN INSERT-Recht auf bestellungen und servicerufe (gemessen,
-- has_table_privilege = false) — die beiden Regeln wirkten also nicht.
-- Sie bleiben trotzdem eine Falle: Ein späteres „grant insert … to anon“
-- machte die alten, schwachen Prüfungen (kein Preis!) still wieder
-- scharf (§2.3). Bestellt wird nur über bestellung_aufgeben.
drop policy if exists "bestellung gast legt an" on public.bestellungen;
drop policy if exists "serviceruf gast legt an" on public.servicerufe;
