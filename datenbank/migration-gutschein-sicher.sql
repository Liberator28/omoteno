-- ═══════════════════════════════════════════════════════════════════
--  migration-gutschein-sicher.sql · Gutscheine und Codes, nicht ausnutzbar
--  (Wunsch zweiter Tag: „Es sollen keine Gutscheine ausgenutzt werden
--  können und nicht jeder Mitarbeiter soll einen Code anlegen können …
--  nachvollziehen, wer den Gutschein ausgestellt hat“)
--
--  BEFUND (live gelesen):
--   · rabattcode_team_anlegen, rabattcode_beenden, rechnung_rabattieren
--     prüften betrieb_mitglieder DIREKT — an der PIN vorbei
--     (migration-pin.sql), und jedes Mitglied durfte Codes anlegen, ohne
--     Grenze, mit selbst gewählten Codes ab drei Zeichen.
--   · rechnung_rabattieren: ein zweiter Code an derselben Bestellung
--     überschrieb den ersten Rabatt, der erste galt trotzdem als
--     eingelöst; stornierte Bestellungen wurden nicht geprüft.
--   · Gast (bestellung_aufgeben): drei verschiedene Sätze (unbekannt /
--     eingelöst / abgelaufen) verraten beim Raten den Stand; jeder ist
--     eine Ausnahme VOR dem Zähler, also wird Raten nie gezählt (§2.3g).
--     Ein Wiederholungsversuch nach eingelöstem Code scheiterte, obwohl
--     die Bestellung längst stand (Code-Prüfung VOR der Doppel-Rückgabe).
--     Ein Code mit Ziel-Gericht rabattierte den ganzen Korb.
--   · bestellung_stornieren (Teilstorno) senkte die Summe, nicht den
--     Rabatt — die Endsumme konnte negativ werden.
--   · gutscheine: direkt aus dem Board geschrieben, ohne „wer“.
--
--  REIHENFOLGE (§2.5): Teil 1 und 2 sind additiv oder ändern nur, was
--  heute schon so heißt und gleich aufgerufen wird — sie laufen sofort.
--  Teil 3 („SCHARF“) schneidet die alten Wege ab und läuft ERST, wenn
--  Board und Hub mit den neuen Wegen in main liegen; sonst bräche das
--  Ausstellen im ausgelieferten Board bis zum Merge.
--
--  TEIL 1+2 ANGEWENDET (Supabase-MCP). Vorher zurückgedreht gemessen
--  (Rolle über request.jwt.claims, §2.4): Team ohne Recht → kein_recht;
--  15 € bei Grenze 10 → ueber_grenze; 25 % bei 20 → ueber_grenze; falsche
--  PIN → pin_falsch; richtig → Code PRAEFIX-XXXXXXXXXX, Name des
--  Mitglieds, 30 Tage; dritte Ausstellung bei Tageslimit 2 → tageslimit;
--  ALTER Weg rabattcode_team_anlegen ohne PIN-Sitzung → ok (die Lücke),
--  NEUER Weg → kein_zugriff; Inhaber 50 € ohne Grenze; Ziel-Code 50 % auf
--  2×6 € → 6,00 (nicht auf den Korb); zweiter Code → schon_rabattiert;
--  Teilstorno des Ziel-Gerichts → Rabatt 0; ganz storniert → Code wieder
--  frei. Danach live: je Funktion genau eine Fassung (§2.1), Helfer
--  nicht als /rpc/, anon stellt nichts aus; Aufruf als Inhaber → Choco
--  hat noch KEINE PIN („keine_pin“) — das Board muss sie erstmals
--  festlegen lassen.
--
--  TEIL 2b ANGEWENDET (rabattcode_pruefen, rabatt_basis ohne LIKE),
--  in stand-anon-funktionen.sql nachgetragen.
--
--  TEIL 3 ANGEWENDET 09.10. beim Merge nach main (8b75526). Vorher
--  gemessen: Live-bestellung_aufgeben wich von dieser Datei NUR um
--  (a)/(b)/(c) ab (Zeilen-Hash-Vergleich, keine neuere Änderung ging
--  verloren); alle neun Funktionen, die in rabattcodes/gutscheine
--  schreiben, laufen als security definer; Board und Hub schreiben dort
--  nicht mehr direkt. Danach live: genau EINE Fassung von
--  bestellung_aufgeben; rabattcode_team_anlegen für anon/authenticated
--  nicht ausführbar; authenticated darf rabattcodes/gutscheine nur
--  lesen; anon bestellt weiter. Zurückgedrehte Probe als anon (Herkunft
--  über cf-connecting-ip): Bestellung OHNE Code → angelegt; Code ohne
--  Freigabe → „Dieser Rabattcode gilt hier nicht …“; rabattcode_pruefen
--  (klein, mit Leerzeichen) → ok; danach mit Freigabe → Rabatt 1,00 und
--  Code eingelöst; Wiederholung mit derselben Quittungsnummer → dieselbe
--  Bestellung; nach dem Zurückdrehen 0 Probezeilen. bestellung_liefern
--  ruft bestellung_aufgeben und erbt die Freigabe-Pflicht.
--
--  VORHER (bis 09.10.) zurückgedreht samt Teil 2b an Choco
--  gemessen (anon, Herkunft über cf-connecting-ip, §2.3e): unbekannt und
--  eingelöst → beide 'ungueltig'; Ziel-Code ohne das Gericht →
--  gericht_fehlt; klein geschrieben mit Leerzeichen und „(Sahne)“ → ok;
--  Bestellen OHNE Freigabe und mit Freigabe eines ANDEREN Geräts → je
--  derselbe Satz; mit Freigabe: 50 % auf 2 × 10,40 € Ziel-Gericht →
--  Rabatt 10,40, rabatt_ziel gesetzt; Wiederholung mit derselben
--  Quittungsnummer nach dem Einlösen → dieselbe Bestellung; 25 Rateversuche
--  aus einem Netz mit wechselndem Gerät → 'zu_viele', danach auch ein
--  GÜLTIGER Code aus diesem Netz → 'zu_viele'; anderes Netz → ok; keine
--  IP im Klartext im Zähler; nach den Entzügen: rabattcode_team_anlegen
--  nicht mehr ausführbar, gutscheine/rabattcodes nur noch lesbar; genau
--  eine Fassung von bestellung_aufgeben.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Wer hat ausgestellt, wer eingelöst ─────────────────────────
alter table public.rabattcodes
  add column if not exists angelegt_von  uuid,
  add column if not exists angelegt_name text,
  add column if not exists eingeloest_von uuid;
alter table public.gutscheine
  add column if not exists angelegt_von  uuid,
  add column if not exists angelegt_name text;

-- Darf ich hier Gutscheine/Codes ausstellen, und in welchen Grenzen?
-- Über meine_betriebe() — also MIT PIN-Pflicht (§2.3a, die alte Lücke).
create or replace function public.gutschein_recht(p_betrieb uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $function$
declare v_m public.betrieb_mitglieder%rowtype;
begin
  if p_betrieb is null or not (p_betrieb in (select public.meine_betriebe()) or public.ist_master()) then
    return jsonb_build_object('ok', false, 'grund', 'kein_zugriff');
  end if;
  -- 'pin': ob dieses Konto schon eine PIN hat — dann fragt das Board
  -- gleich richtig („bestätigen“ oder „erstmals festlegen“).
  if public.ist_inhaber(p_betrieb) then
    return jsonb_build_object('ok', true, 'inhaber', true,
      'pin', exists (select 1 from public.konto_pin where nutzer_id = auth.uid()));
  end if;
  select * into v_m from public.betrieb_mitglieder where betrieb_id = p_betrieb and nutzer_id = auth.uid();
  if not coalesce(v_m.darf_gutscheine, false) then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  return jsonb_build_object('ok', true, 'inhaber', false,
    'pin', exists (select 1 from public.konto_pin where nutzer_id = auth.uid()),
    'max_betrag', v_m.gutschein_max_betrag, 'max_prozent', v_m.gutschein_max_prozent,
    'tag_max', v_m.gutschein_tag_max,
    'heute', (select count(*) from public.rabattcodes r where r.betrieb_id = p_betrieb and r.angelegt_von = auth.uid()
               and r.angelegt_am >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')
           + (select count(*) from public.gutscheine g where g.betrieb_id = p_betrieb and g.angelegt_von = auth.uid()
               and g.angelegt >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'));
end $function$;

-- PIN je Ausstellung. Zählt Fehlversuche in DERSELBEN Sperre wie die
-- Anmelde-PIN und WIRFT NIE — der Aufrufer gibt den Grund als Antwort
-- zurück, sonst drehte die Ausnahme den Zähler zurück (§2.3g).
create or replace function public.pin_ausstellung_pruefen(p_pin text)
returns text language plpgsql volatile security definer set search_path = public as $function$
declare v_pin public.konto_pin%rowtype; v_neu integer;
begin
  select * into v_pin from public.konto_pin where nutzer_id = auth.uid() for update;
  if not found then return 'keine_pin'; end if;
  if v_pin.gesperrt then return 'pin_gesperrt'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{8}$' then return 'pin_form'; end if;
  if v_pin.pin_hash = extensions.crypt(p_pin, v_pin.pin_hash) then
    update public.konto_pin set fehlversuche = 0 where nutzer_id = auth.uid();
    return null;
  end if;
  v_neu := v_pin.fehlversuche + 1;
  update public.konto_pin set fehlversuche = v_neu, gesperrt = (v_neu >= 5) where nutzer_id = auth.uid();
  return case when v_neu >= 5 then 'pin_gesperrt' else 'pin_falsch' end;
end $function$;

-- Wer noch keine PIN hat, legt sie EINMAL selbst fest. Ehrliche Grenze:
-- Wer zuerst mit dem Passwort kommt, setzt sie. Danach ändert sie nur
-- die Zentrale (pin_setzen).
create or replace function public.pin_erstmals_setzen(p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet'); end if;
  if exists (select 1 from public.konto_pin where nutzer_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'grund', 'vorhanden');
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{8}$' then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  if p_pin ~ '^([0-9])\1{7}$'
     or p_pin in ('12345678','23456789','01234567','87654321','98765432','76543210') then
    return jsonb_build_object('ok', false, 'grund', 'zu_einfach');
  end if;
  insert into public.konto_pin (nutzer_id, pin_hash, fehlversuche, gesperrt, gesetzt_am, gesetzt_von)
    values (auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), 0, false, now(), auth.uid());
  return jsonb_build_object('ok', true);
end $function$;

-- Code vom Server: 10 Zeichen aus 32 (ohne 0/O/1/I), also 2^50 —
-- unerratbar, und kein Mitarbeiter wählt „GRATIS“. 256 ist durch 32
-- teilbar: jedes Zeichen gleich wahrscheinlich.
create or replace function public.code_erzeugen(p_praefix text)
returns text language plpgsql volatile set search_path = public as $function$
declare
  v_abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_b bytea := decode(md5(gen_random_uuid()::text), 'hex');
  v_s text := '';
  i integer;
begin
  for i in 0..9 loop v_s := v_s || substr(v_abc, get_byte(v_b, i) % 32 + 1, 1); end loop;
  return case when coalesce(p_praefix, '') = '' then v_s else p_praefix || '-' || v_s end;
end $function$;

create or replace function public.ausstell_name(p_betrieb uuid)
returns text language sql stable security definer set search_path = public as $function$
  select coalesce(nullif(m.anzeigename, ''), u.email::text)
    from auth.users u
    left join public.betrieb_mitglieder m on m.nutzer_id = u.id and m.betrieb_id = p_betrieb
   where u.id = auth.uid();
$function$;

-- Rabattcode ausstellen: Recht, Grenzen, Tageslimit, dann PIN (zuletzt,
-- damit ein Tippfehler im Betrag keinen PIN-Versuch kostet), Code vom
-- Server, „wer“ aus auth.uid().
create or replace function public.rabattcode_ausstellen(
  p_betrieb uuid, p_betrag numeric default null, p_prozent numeric default null,
  p_ziel_gericht_id uuid default null, p_gueltig_bis timestamptz default null,
  p_praefix text default null, p_pin text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  r jsonb := public.gutschein_recht(p_betrieb);
  v_praefix text := upper(btrim(coalesce(p_praefix, '')));
  v_bis timestamptz := p_gueltig_bis;
  v_ziel text; v_grund text; v_code text; v_id uuid; v_versuch integer;
begin
  if not (r->>'ok')::boolean then return r; end if;
  if (p_betrag is null) = (p_prozent is null) then return jsonb_build_object('ok', false, 'grund', 'betrag_oder_prozent'); end if;
  if p_betrag is not null and (p_betrag <= 0 or p_betrag > 500) then return jsonb_build_object('ok', false, 'grund', 'werte_ungueltig'); end if;
  if p_prozent is not null and (p_prozent <= 0 or p_prozent > 100) then return jsonb_build_object('ok', false, 'grund', 'werte_ungueltig'); end if;
  if v_praefix !~ '^[A-Z0-9]{0,8}$' then return jsonb_build_object('ok', false, 'grund', 'praefix'); end if;
  if not (r->>'inhaber')::boolean then
    if p_betrag  > (r->>'max_betrag')::numeric  then return jsonb_build_object('ok', false, 'grund', 'ueber_grenze', 'grenze', r->'max_betrag'); end if;
    if p_prozent > (r->>'max_prozent')::numeric then return jsonb_build_object('ok', false, 'grund', 'ueber_grenze', 'grenze', r->'max_prozent'); end if;
    if (r->>'heute')::int >= (r->>'tag_max')::int then return jsonb_build_object('ok', false, 'grund', 'tageslimit', 'grenze', r->'tag_max'); end if;
    -- Ein Code des Teams läuft immer ab: höchstens 90 Tage, ohne Angabe 30.
    v_bis := least(coalesce(v_bis, now() + interval '30 days'), now() + interval '90 days');
  end if;
  if v_bis is not null and v_bis <= now() then return jsonb_build_object('ok', false, 'grund', 'frist'); end if;
  if p_ziel_gericht_id is not null then
    select name into v_ziel from public.gerichte where id = p_ziel_gericht_id and betrieb_id = p_betrieb;
    if v_ziel is null then return jsonb_build_object('ok', false, 'grund', 'gericht_unbekannt'); end if;
  end if;
  v_grund := public.pin_ausstellung_pruefen(p_pin);
  if v_grund is not null then return jsonb_build_object('ok', false, 'grund', v_grund); end if;
  for v_versuch in 1..3 loop
    v_code := public.code_erzeugen(v_praefix);
    begin
      insert into public.rabattcodes (betrieb_id, code, betrag, prozent, ziel_gericht_id, ziel_gericht_name,
                                      gueltig_bis, quelle, angelegt_von, angelegt_name)
      values (p_betrieb, v_code, p_betrag, p_prozent, p_ziel_gericht_id, v_ziel, v_bis, 'team',
              auth.uid(), public.ausstell_name(p_betrieb))
      returning id into v_id;
      return jsonb_build_object('ok', true, 'id', v_id, 'code', v_code, 'gueltig_bis', v_bis);
    exception when unique_violation then null;    -- extrem selten: neuer Code
    end;
  end loop;
  return jsonb_build_object('ok', false, 'grund', 'code_vergeben');
end $function$;

-- Gutschein für Stammgäste („Mein Tisch“): Text statt Betrag, sonst
-- dieselben Regeln.
create or replace function public.gutschein_ausstellen(
  p_betrieb uuid, p_titel text, p_beschreibung text default null,
  p_gueltig_bis timestamptz default null, p_praefix text default null, p_pin text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  r jsonb := public.gutschein_recht(p_betrieb);
  v_praefix text := upper(btrim(coalesce(p_praefix, '')));
  v_titel text := btrim(coalesce(p_titel, ''));
  -- beschreibung ist NOT NULL (Vorgabe ''): leer, nie null — in der
  -- zurückgedrehten Probe gefunden, nicht beim Anlegen (§2.2).
  v_text text := btrim(coalesce(p_beschreibung, ''));
  v_bis timestamptz := p_gueltig_bis;
  v_grund text; v_code text; v_id uuid; v_versuch integer;
begin
  if not (r->>'ok')::boolean then return r; end if;
  if char_length(v_titel) not between 1 and 80 then return jsonb_build_object('ok', false, 'grund', 'titel'); end if;
  if char_length(coalesce(v_text, '')) > 240 then return jsonb_build_object('ok', false, 'grund', 'text'); end if;
  if v_praefix !~ '^[A-Z0-9]{0,8}$' then return jsonb_build_object('ok', false, 'grund', 'praefix'); end if;
  if not (r->>'inhaber')::boolean then
    if (r->>'heute')::int >= (r->>'tag_max')::int then return jsonb_build_object('ok', false, 'grund', 'tageslimit', 'grenze', r->'tag_max'); end if;
    v_bis := least(coalesce(v_bis, now() + interval '30 days'), now() + interval '90 days');
  end if;
  if v_bis is not null and v_bis <= now() then return jsonb_build_object('ok', false, 'grund', 'frist'); end if;
  v_grund := public.pin_ausstellung_pruefen(p_pin);
  if v_grund is not null then return jsonb_build_object('ok', false, 'grund', v_grund); end if;
  for v_versuch in 1..3 loop
    v_code := public.code_erzeugen(v_praefix);
    begin
      insert into public.gutscheine (betrieb_id, titel, beschreibung, code, gueltig_bis, angelegt_von, angelegt_name)
      values (p_betrieb, v_titel, v_text, v_code, v_bis, auth.uid(), public.ausstell_name(p_betrieb))
      returning id into v_id;
      return jsonb_build_object('ok', true, 'id', v_id, 'code', v_code, 'gueltig_bis', v_bis);
    exception when unique_violation then null;
    end;
  end loop;
  return jsonb_build_object('ok', false, 'grund', 'code_vergeben');
end $function$;

-- Beenden: wer ausstellen darf, darf beenden. Ohne PIN — Beenden
-- verkleinert das Risiko, es vergrößert es nicht.
create or replace function public.gutschein_beenden(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare v_betrieb uuid; r jsonb;
begin
  select betrieb_id into v_betrieb from public.gutscheine where id = p_id;
  if v_betrieb is null then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  r := public.gutschein_recht(v_betrieb);
  if not (r->>'ok')::boolean then return r; end if;
  update public.gutscheine set gueltig_bis = now() where id = p_id;
  return jsonb_build_object('ok', true);
end $function$;

create or replace function public.rabattcode_beenden(p_rabattcode_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_betrieb uuid; r jsonb;
begin
  select betrieb_id into v_betrieb from public.rabattcodes where id = p_rabattcode_id;
  if v_betrieb is null then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  r := public.gutschein_recht(v_betrieb);
  if not (r->>'ok')::boolean then return jsonb_build_object('ok', false, 'grund', 'kein_zugriff'); end if;
  update public.rabattcodes set gueltig_bis = now() where id = p_rabattcode_id;
  return jsonb_build_object('ok', true);
end $function$;

-- ── 2 · Einlösen an der Bestellung (Team), Teilstorno ─────────────
-- Jedes Mitglied MIT PIN darf einlösen (das ist Betrieb, kein Ausstellen),
-- aber: keine stornierte Bestellung, kein zweiter Code, und wer es war.
create or replace function public.rechnung_rabattieren(p_bestellung_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_bestellung record;
  v_code       record;
  v_basis      numeric(10,2);
  v_neuer_rabatt numeric(8,2);
begin
  select id, betrieb_id, summe, positionen, status, rabatt_code into v_bestellung
    from public.bestellungen where id = p_bestellung_id for update;
  if v_bestellung.id is null then return jsonb_build_object('ok', false, 'grund', 'bestellung_unbekannt'); end if;
  if not (v_bestellung.betrieb_id in (select public.meine_betriebe()) or public.ist_master()) then
    return jsonb_build_object('ok', false, 'grund', 'kein_zugriff');
  end if;
  if v_bestellung.status in ('storniert', 'abgelehnt') then
    return jsonb_build_object('ok', false, 'grund', 'storniert');
  end if;
  if v_bestellung.rabatt_code is not null then
    return jsonb_build_object('ok', false, 'grund', 'schon_rabattiert', 'code', v_bestellung.rabatt_code);
  end if;
  select id, betrag, prozent, eingeloest, gueltig_bis, ziel_gericht_name, code into v_code
    from public.rabattcodes
   where betrieb_id = v_bestellung.betrieb_id and code = upper(btrim(coalesce(p_code, '')))
   for update;
  if v_code.id is null then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  if v_code.eingeloest then return jsonb_build_object('ok', false, 'grund', 'bereits_eingeloest'); end if;
  if v_code.gueltig_bis is not null and v_code.gueltig_bis < now() then
    return jsonb_build_object('ok', false, 'grund', 'abgelaufen');
  end if;
  v_basis := public.rabatt_basis(v_bestellung.positionen, v_code.ziel_gericht_name, v_bestellung.summe);
  if v_basis <= 0 then return jsonb_build_object('ok', false, 'grund', 'produkt_nicht_bestellt'); end if;
  v_neuer_rabatt := least(coalesce(v_code.betrag, round(v_basis * v_code.prozent / 100, 2)), v_basis);
  update public.rabattcodes
     set eingeloest = true, eingeloest_bestellung_id = p_bestellung_id, eingeloest_am = now(), eingeloest_von = auth.uid()
   where id = v_code.id;
  update public.bestellungen
     set rabatt_betrag = v_neuer_rabatt, rabatt_code = v_code.code, rabatt_ziel = v_code.ziel_gericht_name
   where id = p_bestellung_id;
  return jsonb_build_object('ok', true, 'rabatt_betrag', v_neuer_rabatt,
    'ziel', v_code.ziel_gericht_name, 'endbetrag', v_bestellung.summe - v_neuer_rabatt);
end $function$;

-- Worauf ein Rabatt rechnet: die ganze Summe, oder nur die Zeilen des
-- Ziel-Gerichts. Eine Zeile heißt „Crêpe“ oder „Crêpe (Nutella)“ — die
-- Extras hängt der Hub in Klammern an.
create or replace function public.rabatt_basis(p_positionen jsonb, p_ziel text, p_summe numeric)
returns numeric language sql immutable set search_path = public as $function$
  select case when p_ziel is null then coalesce(p_summe, 0)
    else coalesce((select sum(coalesce((p->>'preis')::numeric, 0) * coalesce((p->>'menge')::numeric, 1))
                     from jsonb_array_elements(coalesce(p_positionen, '[]'::jsonb)) p
                    -- dieselbe Zerlegung wie positionen_pruefen (kein LIKE:
                    -- ein „%“ im Namen wäre ein Platzhalter)
                    where btrim(split_part(p->>'name', ' (', 1)) = p_ziel), 0) end;
$function$;

-- Interne Helfer: kein /rpc/ (§2.3a).
revoke execute on function public.pin_ausstellung_pruefen(text) from public, anon, authenticated;
revoke execute on function public.code_erzeugen(text)           from public, anon, authenticated;
revoke execute on function public.ausstell_name(uuid)            from public, anon, authenticated;
revoke execute on function public.rabatt_basis(jsonb, text, numeric) from public, anon, authenticated;
-- Für das Board.
revoke execute on function public.gutschein_recht(uuid) from public, anon;
revoke execute on function public.pin_erstmals_setzen(text) from public, anon;
revoke execute on function public.rabattcode_ausstellen(uuid, numeric, numeric, uuid, timestamptz, text, text) from public, anon;
revoke execute on function public.gutschein_ausstellen(uuid, text, text, timestamptz, text, text) from public, anon;
revoke execute on function public.gutschein_beenden(uuid) from public, anon;
grant execute on function public.gutschein_recht(uuid) to authenticated;
grant execute on function public.pin_erstmals_setzen(text) to authenticated;
grant execute on function public.rabattcode_ausstellen(uuid, numeric, numeric, uuid, timestamptz, text, text) to authenticated;
grant execute on function public.gutschein_ausstellen(uuid, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.gutschein_beenden(uuid) to authenticated;

-- Teilstorno: Der Rabatt wird auf das gedeckelt, was übrig bleibt —
-- fällt das Ziel-Gericht weg, fällt sein Rabatt mit. Ganz storniert:
-- Der Code wird wieder frei (der Gast hat für ihn nichts bekommen).
-- Sonst Zeile für Zeile die Live-Fassung (Bremse 'storno', Frist 2 min).
create or replace function public.bestellung_stornieren(nummer text, posten jsonb default null::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_b        bestellungen%rowtype;
  v_frist    constant interval := interval '2 minutes';
  v_bleibt   jsonb := '[]'::jsonb;
  v_weg      jsonb := '[]'::jsonb;
  v_zeile    jsonb;
  v_summe    numeric := 0;
  v_treffer  boolean;
  v_i        int;
begin
  perform schutz_bremsen('storno', 60);
  if nummer is null or nummer !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;
  select * into v_b from bestellungen where id = nummer::uuid;
  if not found then return jsonb_build_object('ok', false, 'grund', 'unbekannt'); end if;
  if now() - v_b.zeitpunkt > v_frist then return jsonb_build_object('ok', false, 'grund', 'frist'); end if;
  if v_b.status in ('fertig', 'storniert') then
    return jsonb_build_object('ok', false, 'grund', 'zu_spaet', 'status', v_b.status);
  end if;
  if posten is null or jsonb_array_length(coalesce(posten, '[]'::jsonb)) = 0 then
    update bestellungen set status = 'storniert',
           storno = coalesce(v_b.storno, '[]'::jsonb) || coalesce(v_b.positionen, '[]'::jsonb),
           positionen = '[]'::jsonb, summe = 0, rabatt_betrag = case when v_b.rabatt_betrag is null then null else 0 end
     where id = v_b.id;
    update rabattcodes set eingeloest = false, eingeloest_bestellung_id = null, eingeloest_am = null, eingeloest_von = null
     where eingeloest_bestellung_id = v_b.id;
    return jsonb_build_object('ok', true, 'alles', true, 'rest', 0, 'summe', 0);
  end if;
  for v_i in 0 .. jsonb_array_length(coalesce(v_b.positionen, '[]'::jsonb)) - 1 loop
    v_zeile := v_b.positionen -> v_i;
    select exists (select 1 from jsonb_array_elements_text(posten) n where n = v_i::text) into v_treffer;
    if v_treffer then v_weg := v_weg || jsonb_build_array(v_zeile);
    else
      v_bleibt := v_bleibt || jsonb_build_array(v_zeile);
      v_summe  := v_summe + coalesce((v_zeile->>'preis')::numeric, 0) * coalesce((v_zeile->>'menge')::numeric, 1);
    end if;
  end loop;
  if jsonb_array_length(v_weg) = 0 then return jsonb_build_object('ok', false, 'grund', 'nichts_getroffen'); end if;
  if jsonb_array_length(v_bleibt) = 0 then
    update bestellungen set status = 'storniert', storno = coalesce(v_b.storno, '[]'::jsonb) || v_weg,
           positionen = '[]'::jsonb, summe = 0, rabatt_betrag = case when v_b.rabatt_betrag is null then null else 0 end
     where id = v_b.id;
    update rabattcodes set eingeloest = false, eingeloest_bestellung_id = null, eingeloest_am = null, eingeloest_von = null
     where eingeloest_bestellung_id = v_b.id;
    return jsonb_build_object('ok', true, 'alles', true, 'rest', 0, 'summe', 0);
  end if;
  update bestellungen set storno = coalesce(v_b.storno, '[]'::jsonb) || v_weg, positionen = v_bleibt, summe = v_summe,
         rabatt_betrag = case when v_b.rabatt_betrag is null then null
                              else least(v_b.rabatt_betrag, public.rabatt_basis(v_bleibt, v_b.rabatt_ziel, v_summe)) end
   where id = v_b.id;
  return jsonb_build_object('ok', true, 'alles', false, 'rest', jsonb_array_length(v_bleibt), 'summe', v_summe, 'positionen', v_bleibt);
end $function$;

-- ── 2b · Gast prüft seinen Code VOR dem Bestellen ──────────────────
-- Bisher prüfte nur bestellung_aufgeben — mit drei verschiedenen
-- Ausnahmen VOR jedem Zähler: Raten war ungezählt und verriet den Stand.
-- Hier: erst zählen (Netz, Gerät, Betrieb), dann prüfen, NIE werfen
-- (§2.3g). Unbekannt, eingelöst, abgelaufen heißen alle 'ungueltig'.
-- Ein gültiger Code hinterlässt eine Freigabe für dieses Gerät (3 h);
-- nach Teil 3 nimmt bestellung_aufgeben NUR freigegebene Codes an —
-- dort zu raten bringt dann nichts mehr.
create or replace function public.rabattcode_pruefen(
  p_betrieb uuid, p_code text, p_geraet text default null, p_namen jsonb default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  v_code   text := upper(btrim(coalesce(p_code, '')));
  -- dieselbe Form wie in bestellung_aufgeben, sonst passt die Freigabe nicht
  v_geraet text := case when p_geraet ~ '^[A-Za-z0-9_-]{8,64}$' then p_geraet end;
  v_h      text := public.schutz_herkunft();
  v_zu     boolean := false;
  r        record;
begin
  if p_betrieb is null then return jsonb_build_object('ok', false, 'grund', 'ungueltig'); end if;
  if v_h is not null and public.schutz_zaehlen('rc:h:' || v_h, 10) > 20 then v_zu := true; end if;
  if v_geraet is not null and public.schutz_zaehlen('rc:g:' || v_geraet, 10) > 20 then v_zu := true; end if;
  if public.schutz_zaehlen('rc:b:' || p_betrieb::text, 10) > 500 then v_zu := true; end if;
  if v_zu then return jsonb_build_object('ok', false, 'grund', 'zu_viele'); end if;
  if v_code !~ '^[A-Z0-9-]{3,24}$' then return jsonb_build_object('ok', false, 'grund', 'ungueltig'); end if;
  select id, betrag, prozent, ziel_gericht_name into r
    from public.rabattcodes
   where betrieb_id = p_betrieb and code = v_code and not eingeloest
     and (gueltig_bis is null or gueltig_bis > now());
  if r.id is null then return jsonb_build_object('ok', false, 'grund', 'ungueltig'); end if;
  if r.ziel_gericht_name is not null and not exists (
       select 1 from jsonb_array_elements_text(case when jsonb_typeof(p_namen) = 'array' then p_namen else '[]'::jsonb end) n
        where btrim(split_part(n, ' (', 1)) = r.ziel_gericht_name) then
    return jsonb_build_object('ok', false, 'grund', 'gericht_fehlt', 'ziel', r.ziel_gericht_name);
  end if;
  perform public.schutz_zaehlen('rcfrei:' || r.id::text || ':' || coalesce(v_geraet, '-'), 60);
  return jsonb_build_object('ok', true, 'betrag', r.betrag, 'prozent', r.prozent, 'ziel', r.ziel_gericht_name);
end $function$;
revoke execute on function public.rabattcode_pruefen(uuid, text, text, jsonb) from public;
grant  execute on function public.rabattcode_pruefen(uuid, text, text, jsonb) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- ── 3 · SCHARF — erst beim Merge nach main einspielen ─────────────
--  Voraussetzung: admin.html stellt über rabattcode_ausstellen /
--  gutschein_ausstellen aus, der Hub ruft rabattcode_pruefen VOR dem
--  Bestellen. Liegt das noch nicht live, bräche hier das Ausstellen im
--  Board und jeder Code im alten Hub.
-- ═══════════════════════════════════════════════════════════════════

-- Alte Wege ohne PIN und ohne „wer“ schließen (§2.3f: kein Schreibweg
-- außerhalb der Funktionen, also das Recht auf genau das kürzen).
revoke execute on function public.rabattcode_team_anlegen(uuid, text, numeric, numeric, uuid, timestamptz) from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.gutscheine  from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.rabattcodes from anon, authenticated;

-- bestellung_aufgeben: Zeile für Zeile die Live-Fassung, drei Änderungen:
--  (a) Doppel-Rückgabe ganz nach vorn: Ein Wiederholungsversuch mit
--      derselben Quittungsnummer bekommt die Bestellung, die längst
--      steht — auch wenn ihr Code inzwischen eingelöst ist (von ihr).
--  (b) Ein Code gilt nur mit Freigabe aus rabattcode_pruefen für dieses
--      Gerät (3 h). Ohne Freigabe EIN Satz für alles — hier zu raten
--      verrät nichts mehr, das Raten läuft gezählt über rabattcode_pruefen.
--  (c) Ein Code mit Ziel-Gericht rechnet nur auf dessen Zeilen.
create or replace function public.bestellung_aufgeben(p_betrieb_id uuid, p_quelle text, p_tisch text default null::text, p_summe numeric default 0, p_notiz text default null::text, p_positionen jsonb default '[]'::jsonb, p_gast_kennung text default null::text, p_tisch_schluessel text default null::text, p_sitzung text default null::text, p_geraet text default null::text, p_rabattcode text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  neue        uuid;
  b           record;
  t           record;
  s           record;
  v_code      record;
  v_code_id   uuid;
  v_code_text text;
  v_ziel      text;
  v_rbasis    numeric := 0;
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
  if p_gast_kennung is not null
     and (length(p_gast_kennung) < 8 or length(p_gast_kennung) > 80) then
    raise exception 'Kennung ungueltig' using errcode='P0001';
  end if;
  -- (a) Wiederholungsversuch: die Bestellung steht schon.
  if p_gast_kennung is not null then
    select id into neue from bestellungen where gast_kennung = p_gast_kennung and betrieb_id = p_betrieb_id limit 1;
    if neue is not null then return neue; end if;
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
    if p_rabattcode is not null and btrim(p_rabattcode) <> '' then
      v_code_text := upper(btrim(p_rabattcode));
      select id, betrag, prozent, eingeloest, gueltig_bis, ziel_gericht_name into v_code
        from rabattcodes
       where betrieb_id = p_betrieb_id and code = v_code_text
       for update;
      -- (b) EIN Satz, gleich ob unbekannt, eingelöst, abgelaufen oder
      -- ohne Freigabe.
      if v_code.id is null or v_code.eingeloest
         or (v_code.gueltig_bis is not null and v_code.gueltig_bis < now())
         or not exists (select 1 from schutz_zaehler
                         where schluessel = 'rcfrei:' || v_code.id::text || ':' || coalesce(p_geraet, '-')
                           and fenster >= now() - interval '3 hours') then
        raise exception 'Dieser Rabattcode gilt hier nicht. Bitte prüfen Sie ihn oder bestellen Sie ohne Code.'
          using errcode='P0001';
      end if;
      v_code_id := v_code.id;
      v_ziel    := v_code.ziel_gericht_name;
      -- (c) Ziel-Gericht: nur dessen Zeilen.
      v_rbasis  := case when v_ziel is null then basis_summe else rabatt_basis(v_pos, v_ziel, basis_summe) end;
      if v_rbasis <= 0 then
        raise exception 'Dieser Rabattcode gilt für „%“ — das ist nicht in Ihrer Auswahl.', v_ziel
          using errcode='P0001';
      end if;
      v_rabattbetrag := coalesce(v_code.betrag, round(v_rbasis * v_code.prozent / 100, 2));
      v_rabattbetrag := least(v_rabattbetrag, v_rbasis, v_summe);
    end if;
    if basis_summe > 0 and coalesce(p_summe,0) < (basis_summe - v_rabattbetrag) - 0.01 then
      raise exception 'Der Preis stimmt nicht. Bitte die Karte neu laden.'
        using errcode='P0001';
    end if;
  end if;
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
  v_hart  := v_hart  || 100000;
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
       set rabatt_betrag = v_rabattbetrag, rabatt_code = v_code_text, rabatt_ziel = v_ziel
     where id = neue;
  end if;
  return neue;
end;
$function$;
