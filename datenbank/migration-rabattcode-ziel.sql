-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET (quxwweuvdqtjsdwgjdrh) · Rabattcodes: Ziel wählen, manuell anlegen
--
--  ANLASS. Wunsch des Betreibers (27.09., „das hatte ich dir schon
--  einmal gesagt"): Ein Rabattcode soll beim Anlegen entweder einen
--  Prozentsatz oder einen festen Betrag tragen — beides gab es schon
--  (rabattcodes.betrag/prozent, migration-rechnung-rabatt.sql) — UND
--  beim Einlösen im Board entweder von einem VORHER gewählten Gericht
--  oder von der GANZEN Rechnung abgehen. Letzteres fehlte komplett:
--  rechnung_rabattieren() kannte nur "ganze Rechnung", und es gab
--  keinen Weg, im Board überhaupt von Hand einen Code mit Betrag/
--  Prozent anzulegen — rabattcode_anlegen() ist bewusst nur für
--  service_role (Klaviyo-Newsletter-Vorrat), s. migration-rechnung-
--  rabatt.sql.
--
--  NICHT `gutscheine` erweitert (CLAUDE.md §1.1a — ein passender Name
--  ist kein Beweis): diese Tabelle ist ausdrücklich betragslos, "das
--  Team entscheidet am Tisch" (Kommentar in seiten/admin.html, Zeile
--  bei #gsGruppe). `rabattcodes` ist die Tabelle, die schon gegen eine
--  offene Bestellung eingelöst wird — hier gehört die Erweiterung hin.
--
--  NACHGESEHEN, nicht angenommen (CLAUDE.md §1.2/§2.3c):
--    · bestellungen.positionen ist jsonb, jede Position hat name/
--      menge/preis — KEINE gericht_id. Ein Ziel-Gericht wird deshalb
--      über den NAMEN gematcht, als Schnappschuss bei der Erstellung
--      (ziel_gericht_name) — nicht live nachgeschlagen, sonst würde
--      eine spätere Umbenennung oder Löschung des Gerichts einen
--      längst angelegten Code rückwirkend anders wirken lassen.
--    · rabattcodes hatte BISHER keine Formgrenze auf `code` (anders
--      als gutscheine_masse) und keine Wertegrenze auf betrag/prozent
--      — ein Prozentsatz über 100 oder ein negativer Betrag wäre bis
--      zur Anwendung durchgelaufen. Beides wird hier nachgezogen.
--    · rechnung_rabattieren() deckelte den Rabatt bisher NICHT gegen
--      die Bestellsumme — ein von Hand zu hoch eingetragener fester
--      Betrag hätte bestellungen_rabatt_betrag_positiv verletzt (die
--      UPDATE wäre mit einem rohen Datenbankfehler gescheitert) statt
--      sauber gedeckelt zu werden. Wird mit `least()` behoben.
--
--  Additiv (CLAUDE.md §2.5): neue Spalten mit Vorgabewert NULL/aus,
--  0 Zeilen in rabattcodes und bestellungen mit rabatt_betrag > 0 zum
--  Zeitpunkt des Schreibens — nichts Bestehendes ändert sich.
-- ═══════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='rabattcodes' and column_name='betrag')
  then raise exception 'rabattcodes.betrag fehlt — Annahme falsch, nichts angelegt.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='bestellungen' and column_name='positionen')
  then raise exception 'bestellungen.positionen fehlt — Annahme falsch, nichts angelegt.';
  end if;
end $$;

-- ── 1 · Ziel je Code: ein bestimmtes Gericht oder NULL (= ganze Rechnung) ──

alter table public.rabattcodes
  add column if not exists ziel_gericht_id uuid references public.gerichte(id) on delete set null;
alter table public.rabattcodes
  add column if not exists ziel_gericht_name text;

comment on column public.rabattcodes.ziel_gericht_id is
  'Nur zur Anzeige/Auswahl im Board. Verschwindet das Gericht (on delete '
  'set null), bleibt der Code trotzdem korrekt: ziel_gericht_name ist der '
  'eigentliche Schnappschuss, den rechnung_rabattieren() verwendet.';
comment on column public.rabattcodes.ziel_gericht_name is
  'Name des Gerichts zum Zeitpunkt der Erstellung, gegen bestellungen.'
  'positionen[].name gematcht. NULL = der Rabatt gilt der ganzen Rechnung.';

-- Formgrenze wie gutscheine_masse (migration-gutscheine-masse.sql) —
-- fehlte hier bisher komplett.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rabattcodes_code_form') then
    alter table public.rabattcodes
      add constraint rabattcodes_code_form check (code ~ '^[A-Z0-9-]{3,24}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rabattcodes_werte_sinnvoll') then
    alter table public.rabattcodes
      add constraint rabattcodes_werte_sinnvoll check (
        (betrag is null or betrag > 0) and
        (prozent is null or (prozent > 0 and prozent <= 100))
      );
  end if;
end $$;

-- ── 1b · Fund unterwegs: authenticated hatte INSERT/UPDATE/DELETE/
--         TRUNCATE/TRIGGER/REFERENCES auf rabattcodes — die Tabelle
--         GRANT-Zeile widerspricht damit dem eigenen Kommentar oben
--         ("authenticated darf NUR lesen") und in migration-rechnung-
--         rabatt.sql ("Schreiben laeuft ausschliesslich ueber die
--         beiden Funktionen ... nie direkt auf der Tabelle"). GEPRÜFT
--         (CLAUDE.md §2.3b, mit Zeilenzahl statt Ausnahme): ein
--         direkter INSERT/UPDATE/DELETE als echtes Mitglied traf 0
--         Zeilen — RLS hat für rabattcodes NUR eine SELECT-Regel,
--         Postgres verweigert ohne passende Regel per Vorgabe auch
--         INSERT/UPDATE/DELETE. Der Wächter (RLS) hält also HEUTE,
--         aber die offene Tür (GRANT) bleibt ein Risiko für morgen —
--         genau die Reihenfolge aus CLAUDE.md §2.3a, nur diesmal
--         zufällig auf der richtigen Seite. Dieselbe Lücke besteht
--         auf mindestens 18 weiteren Tabellen (u. a. bestellungen,
--         betrieb_mitglieder, gerichte, rechnungen) — das ist ein
--         eigenes, größeres Vorhaben und wird hier bewusst NICHT
--         mitgemacht (admin.html schreibt auf diese Tabellen an
--         mehreren echten Stellen direkt, ungeprüft mitgezogen wäre
--         das Risiko, einen heute funktionierenden Weg zu zerstören).
--         Für rabattcodes selbst ist die Lage klar: kein einziger
--         direkter .from("rabattcodes").insert/update/delete() im
--         gesamten Board (nachgesehen) — GRANT wird hier nachgezogen.

revoke insert, update, delete, truncate, trigger, references
  on public.rabattcodes from authenticated;

-- ── 2 · Anzeige im Board: welches Gericht wurde rabattiert? ──

alter table public.bestellungen
  add column if not exists rabatt_ziel text;
comment on column public.bestellungen.rabatt_ziel is
  'Name des rabattierten Gerichts, falls der Code eins hatte. NULL = '
  'Rabatt galt der ganzen Rechnung. Nur zur Anzeige im Board.';

grant select (rabatt_ziel) on public.bestellungen to authenticated;

-- ── 3 · rechnung_rabattieren(): jetzt zielbewusst UND gedeckelt ──
--
--  Gleiche Signatur wie bisher (uuid, text) — ersetzt die vorhandene
--  Fassung, legt keine zweite an (CLAUDE.md §2.1).

create or replace function public.rechnung_rabattieren(
  p_bestellung_id uuid,
  p_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bestellung record;
  v_code       record;
  v_pos        jsonb;
  v_basis      numeric(10,2);
  v_neuer_rabatt numeric(8,2);
begin
  select id, betrieb_id, summe, positionen into v_bestellung
    from public.bestellungen where id = p_bestellung_id;

  if v_bestellung.id is null then
    return jsonb_build_object('ok', false, 'grund', 'bestellung_unbekannt');
  end if;

  if not exists (
    select 1 from public.betrieb_mitglieder m
    where m.betrieb_id = v_bestellung.betrieb_id and m.nutzer_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'grund', 'kein_zugriff');
  end if;

  select id, betrag, prozent, eingeloest, gueltig_bis, ziel_gericht_name into v_code
    from public.rabattcodes
    where betrieb_id = v_bestellung.betrieb_id and code = p_code
    for update;

  if v_code.id is null then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;
  if v_code.eingeloest then
    return jsonb_build_object('ok', false, 'grund', 'bereits_eingeloest');
  end if;
  if v_code.gueltig_bis is not null and v_code.gueltig_bis < now() then
    return jsonb_build_object('ok', false, 'grund', 'abgelaufen');
  end if;

  -- Ganze Rechnung ODER ein bestimmtes, vorher gewähltes Gericht.
  if v_code.ziel_gericht_name is null then
    v_basis := v_bestellung.summe;
  else
    select p into v_pos
      from jsonb_array_elements(coalesce(v_bestellung.positionen, '[]'::jsonb)) p
      where p->>'name' = v_code.ziel_gericht_name
      limit 1;
    if v_pos is null then
      return jsonb_build_object('ok', false, 'grund', 'produkt_nicht_bestellt');
    end if;
    v_basis := coalesce((v_pos->>'preis')::numeric, 0) * coalesce((v_pos->>'menge')::numeric, 1);
  end if;

  -- Nie mehr abziehen, als die Grundlage hergibt (VORFALL: bislang
  -- ungedeckelt — ein von Hand zu hoch eingetragener fester Betrag
  -- hätte die CHECK-Schranke auf bestellungen verletzt, statt sauber
  -- gedeckelt zu werden).
  v_neuer_rabatt := least(
    coalesce(v_code.betrag, round(v_basis * v_code.prozent / 100, 2)),
    v_basis
  );

  update public.rabattcodes
    set eingeloest = true, eingeloest_bestellung_id = p_bestellung_id, eingeloest_am = now()
    where id = v_code.id;

  update public.bestellungen
    set rabatt_betrag = v_neuer_rabatt, rabatt_code = p_code, rabatt_ziel = v_code.ziel_gericht_name
    where id = p_bestellung_id;

  return jsonb_build_object('ok', true, 'rabatt_betrag', v_neuer_rabatt,
    'ziel', v_code.ziel_gericht_name, 'endbetrag', v_bestellung.summe - v_neuer_rabatt);
end;
$$;

revoke all on function public.rechnung_rabattieren(uuid, text) from public, anon;
grant execute on function public.rechnung_rabattieren(uuid, text) to authenticated;


-- ── 4 · rabattcode_team_anlegen(): das Team legt selbst einen Code an ──
--
--  Anders als rabattcode_anlegen (service_role, Klaviyo-Vorrat) darf
--  das eigene Team hiermit direkt einen Code mit Betrag/Prozent und
--  optionalem Ziel-Gericht anlegen — geprüft wird die Mitgliedschaft
--  IM Funktionskörper (CLAUDE.md §2.3a: RLS ist die zweite Linie,
--  authenticated hat auf rabattcodes bewusst nur SELECT).

create or replace function public.rabattcode_team_anlegen(
  p_betrieb_id uuid,
  p_code text,
  p_betrag numeric default null,
  p_prozent numeric default null,
  p_ziel_gericht_id uuid default null,
  p_gueltig_bis timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ziel_name text;
begin
  if not exists (
    select 1 from public.betrieb_mitglieder m
    where m.betrieb_id = p_betrieb_id and m.nutzer_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'grund', 'kein_zugriff');
  end if;

  if (p_betrag is null) = (p_prozent is null) then
    return jsonb_build_object('ok', false, 'grund', 'betrag_oder_prozent');
  end if;
  if p_code !~ '^[A-Z0-9-]{3,24}$' then
    return jsonb_build_object('ok', false, 'grund', 'code_form');
  end if;

  if p_ziel_gericht_id is not null then
    select name into v_ziel_name from public.gerichte
      where id = p_ziel_gericht_id and betrieb_id = p_betrieb_id;
    if v_ziel_name is null then
      return jsonb_build_object('ok', false, 'grund', 'gericht_unbekannt');
    end if;
  end if;

  insert into public.rabattcodes
    (betrieb_id, code, betrag, prozent, ziel_gericht_id, ziel_gericht_name, gueltig_bis, quelle)
  values
    (p_betrieb_id, p_code, p_betrag, p_prozent, p_ziel_gericht_id, v_ziel_name, p_gueltig_bis, 'team')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'grund', 'code_vergeben');
  when check_violation then
    return jsonb_build_object('ok', false, 'grund', 'werte_ungueltig');
end;
$$;

revoke all on function public.rabattcode_team_anlegen(uuid, text, numeric, numeric, uuid, timestamptz) from public, anon;
grant execute on function public.rabattcode_team_anlegen(uuid, text, numeric, numeric, uuid, timestamptz) to authenticated;


-- ── 5 · rabattcode_beenden(): einen noch nicht eingelösten Code zurückziehen ──
--
--  "Beenden heißt beenden, nicht löschen" (dasselbe Muster wie
--  gutscheine): der Code bleibt belegt (UNIQUE je Haus), taucht aber
--  nicht mehr als einlösbar auf — gueltig_bis auf jetzt gesetzt.

create or replace function public.rabattcode_beenden(
  p_rabattcode_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_betrieb uuid;
begin
  select betrieb_id into v_betrieb from public.rabattcodes where id = p_rabattcode_id;
  if v_betrieb is null then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;
  if not exists (
    select 1 from public.betrieb_mitglieder m
    where m.betrieb_id = v_betrieb and m.nutzer_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'grund', 'kein_zugriff');
  end if;

  update public.rabattcodes set gueltig_bis = now() where id = p_rabattcode_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.rabattcode_beenden(uuid) from public, anon;
grant execute on function public.rabattcode_beenden(uuid) to authenticated;

commit;

-- ── GEPRÜFT, nicht angenommen (in zurückgedrehten Transaktionen, als
--    echter Mitgliedsnutzer, gegen echte Zeilen: nutzer_id 153c5425…,
--    betrieb_id af095b14…, gericht "Creamy Rice Oriental" e6ee3910…,
--    Bestellung 3ab20df0… (summe 10,90, enthält das Gericht) als
--    eigene, Bestellung 3f5e164b… (summe 15,90, "Pistachio Fettuccine")
--    als die FALSCHE, um den Ziel-Abgleich wirklich zu treffen) ──
--
-- 1 · Genau eine Fassung je Funktion (§2.1):
--     rechnung_rabattieren, rabattcode_team_anlegen, rabattcode_beenden
--     — je genau eine Zeile in pg_proc, keine zweite Signatur daneben.
--
-- 2 · Deckel-Probe: ein von Hand eingetragener fester Betrag 9999.00
--     gegen die 10,90-Bestellung → rabatt_betrag exakt 10.90 (nicht
--     9999.00), endbetrag 0.00 — die geplante VORHER-ungedeckelte
--     Lücke (Kommentar oben) ist zu. Vorher hätte dasselbe die CHECK-
--     Schranke bestellungen_rabatt_betrag_positiv mit einem rohen
--     Datenbankfehler verletzt.
--
-- 3 · Ziel-Gericht, Prozent: Code mit 50% auf "Creamy Rice Oriental"
--     gegen die eigene Bestellung (enthält das Gericht) → rabatt_betrag
--     korrekt aus Zeilenpreis×Menge gerechnet, rabatt_ziel gesetzt.
--
-- 4 · Der Fall, für den diese Migration eigentlich da ist: derselbe
--     Ziel-Code gegen die FALSCHE Bestellung (3f5e164b…, enthält das
--     Zielgericht nicht) → grund 'produkt_nicht_bestellt', KEIN
--     stillschweigendes Rabattieren der ganzen Rechnung.
--
-- 5 · GRANT-Fund (Kommentar 1b): als echtes Mitglied — direkter INSERT/
--     UPDATE auf rabattcodes für den EIGENEN Betrieb → 0 Zeilen
--     betroffen (RLS kennt nur eine SELECT-Regel, kein ALL/INSERT/
--     UPDATE), gemessen über die Zeilenzahl, nicht nur die Ausnahme
--     (§2.3b). Nach dem REVOKE oben zusätzlich per fehlendem Recht
--     abgewiesen. Die RPC-Funktionen selbst (SECURITY DEFINER) blieben
--     davon unberührt und funktionierten unverändert weiter.
--
-- Dieselben Fälle stehen jetzt dauerhaft in datenbank/pruef-rechte.sql,
-- TEIL 3b (Proben 65–69, 76–78) — dort auch gegen einen erfundenen
-- Fremden, nicht nur gegen den eigenen Betrieb.
