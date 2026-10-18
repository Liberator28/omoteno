-- ═══════════════════════════════════════════════════════════════════
--  ENTWURF 18.10. — NOCH NICHT EINGESPIELT.
--  Supabase war in dieser Sitzung nicht erreichbar (Netzwerkregel der
--  Umgebung). Geprüft nur im lokalen Postgres 16 gegen nachgebaute
--  Tabellen (Probe unten) — das belegt Logik und Syntax, NICHT den
--  echten Bestand. Lokal gemessen 18.10.: alte Bestellung → Personen-
--  felder leer, Gerichte/Summe bleiben; 40 Tage alt → nur Transkript weg;
--  frische unberührt; Reservierung nach Termin+30 geleert; alter Gast
--  weg, mit bestätigter Mail bleibt; zweiter Lauf zählt 0; ein alter Gast
--  mit Gutschein (Fremdschlüssel) bleibt allein stehen und wird mit Grund
--  gemeldet (erste Fassung ließ daran ALLE alten Gäste stehen);
--  Vorprüfung bricht bei fehlender oder NOT-NULL-Spalte ab; ohne pg_cron
--  ein Satz; anon/authenticated ohne EXECUTE.
--
--  VOR DEM EINSPIELEN im SQL-Editor (§2.3c, §1.1a):
--    select table_name, column_name, is_nullable, data_type
--      from information_schema.columns
--     where table_schema = 'public'
--       and (table_name, column_name) in (
--         ('bestellungen','gast_name'), ('bestellungen','gast_telefon'),
--         ('bestellungen','notiz'), ('bestellungen','transkript'),
--         ('bestellungen','liefer_adresse'), ('bestellungen','geraet'),
--         ('bestellungen','zeitpunkt'),
--         ('reservierungen','name'), ('reservierungen','telefon'),
--         ('reservierungen','notiz'), ('reservierungen','wunsch'),
--         ('gaeste','letzter_besuch'), ('gaeste','email_bestaetigt_am'));
--    select conrelid::regclass, conname, pg_get_constraintdef(oid)
--      from pg_constraint where confrelid = 'public.gaeste'::regclass;
--    select * from pg_extension where extname = 'pg_cron';
--  Die Vorprüfung in Teil 0 tut das Erste selbst und bricht laut ab.
--  Läuft im SQL-Editor, nicht über das Werkzeug (§2.8: der Körper
--  enthält delete).
-- ═══════════════════════════════════════════════════════════════════
--  migration-loeschfristen.sql · Speicherbegrenzung (Art. 5 Abs. 1 lit. e DSGVO)
--
--  Befund (dokumente/recht/01, Befund 5): Keine Migration löschte je
--  etwas. Name, Telefon, Lieferadresse, Notiz und das Gesprächsprotokoll
--  von Alessia blieben an der Bestellung, solange es die Datenbank gibt.
--  Entschieden 18.10.:
--    · Bestellungen älter als 90 Tage: Personenfelder leeren — Gerichte,
--      Summen, Zeiten, Status bleiben (Auswertung, Buchhaltung).
--    · Transkript einer Telefonbestellung nach 30 Tagen leeren.
--    · Reservierungen 30 Tage nach dem Termin: Name, Telefon, Notiz leeren.
--    · Gäste ohne Besuch seit 24 Monaten löschen — außer wer eine
--      bestätigte E-Mail hat (die Einwilligung trägt, bis sie widerrufen
--      wird) und außer wer noch an einer anderen Zeile hängt.
--  Das Protokoll „Wer hat was geändert“ (3 Jahre) ist NICHT Teil davon:
--  Seine Tabelle und Rechte gehören E5-D; eigener Schritt.
--
--  Additiv (§2.5): neue Funktion, ein Zeitplan. Leeren statt löschen
--  bei Bestellungen und Reservierungen — die Zeilen bleiben.
-- ═══════════════════════════════════════════════════════════════════

-- ── 0 · Vorprüfung: jede Spalte da und leerbar? ─────────────────────
do $$
declare
  v_fehlt text := '';
  r record;
begin
  for r in
    select * from (values
      ('bestellungen','gast_name', true), ('bestellungen','gast_telefon', true),
      ('bestellungen','notiz', true), ('bestellungen','transkript', true),
      ('bestellungen','liefer_adresse', true), ('bestellungen','geraet', true),
      ('bestellungen','zeitpunkt', false),
      ('reservierungen','name', true), ('reservierungen','telefon', true),
      ('reservierungen','notiz', true), ('reservierungen','wunsch', false),
      ('gaeste','letzter_besuch', false), ('gaeste','email_bestaetigt_am', false)
    ) as w(tabelle, spalte, leeren)
  loop
    if not exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = r.tabelle
                      and c.column_name = r.spalte) then
      v_fehlt := v_fehlt || r.tabelle || '.' || r.spalte || ' fehlt; ';
    elsif r.leeren and exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = r.tabelle
                      and c.column_name = r.spalte and c.is_nullable = 'NO') then
      v_fehlt := v_fehlt || r.tabelle || '.' || r.spalte || ' ist NOT NULL; ';
    end if;
  end loop;
  if v_fehlt <> '' then
    raise exception 'Löschfristen: Bestand passt nicht — %', v_fehlt;
  end if;
end $$;

-- ── 1 · Die Funktion ────────────────────────────────────────────────
-- Gibt zurück, was sie getan hat — eine Zahl je Schritt. Ein Schritt,
-- der an einem Fremdschlüssel scheitert, bricht nicht still ab: Er
-- meldet sich im Ergebnis mit 'fehler' (§8.1i: ein stummer Ausfall
-- wird nie gemeldet).
create or replace function public.aufraeumen_personendaten()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_best int; n_tel int; n_res int; n_gast int; n_bleibt int;
  v_gast_fehler text; v_id uuid;
begin
  update bestellungen
     set gast_name = null, gast_telefon = null, notiz = null,
         liefer_adresse = null, geraet = null
   where zeitpunkt < now() - interval '90 days'
     and (gast_name is not null or gast_telefon is not null or notiz is not null
          or liefer_adresse is not null or geraet is not null);
  get diagnostics n_best = row_count;

  update bestellungen
     set transkript = null
   where zeitpunkt < now() - interval '30 days'
     and transkript is not null;
  get diagnostics n_tel = row_count;

  update reservierungen
     set name = null, telefon = null, notiz = null
   where wunsch < now() - interval '30 days'
     and (name is not null or telefon is not null or notiz is not null);
  get diagnostics n_res = row_count;

  -- Gast für Gast: Hängt einer noch an einer anderen Zeile (z. B. einem
  -- Gutschein), bleibt GENAU er stehen und wird gezählt — ein einziges
  -- delete für alle scheiterte in der Probe an einem Gast und ließ dann
  -- jeden alten Gast stehen.
  n_gast := 0; n_bleibt := 0;
  for v_id in select g.id from gaeste g
               where g.letzter_besuch < now() - interval '24 months'
                 and g.email_bestaetigt_am is null
  loop
    begin
      delete from gaeste where id = v_id;
      n_gast := n_gast + 1;
    exception when foreign_key_violation then
      n_bleibt := n_bleibt + 1;
      v_gast_fehler := sqlerrm;
    end;
  end loop;

  return jsonb_strip_nulls(jsonb_build_object(
    'bestellungen', n_best, 'transkripte', n_tel,
    'reservierungen', n_res, 'gaeste', n_gast,
    'gaeste_bleiben', nullif(n_bleibt, 0), 'gaeste_grund', v_gast_fehler));
end $$;

-- Kein rpc-Endpunkt (§2.3a): nur der Zeitplan ruft sie.
revoke all on function public.aufraeumen_personendaten() from public, anon, authenticated;

-- ── 2 · Zeitplan, täglich 03:17 UTC ─────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('omoteno-aufraeumen', '17 3 * * *',
                          'select public.aufraeumen_personendaten()');
  else
    raise exception 'pg_cron fehlt — in Supabase unter Database → Extensions einschalten, dann erneut.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
--  PROBE (zurückgedreht). Zweiter Durchgang ausdrücklich (§1.1a): Was
--  einmal geleert ist, wird nicht noch einmal gezählt; Frisches bleibt.
--
--  begin;
--  create temp table probe(schritt text, ergebnis text);
--  do $p$
--  declare b uuid; r jsonb;
--  begin
--    select id into b from betriebe limit 1;
--    insert into bestellungen(betrieb_id, quelle, status, positionen, summe, gast_name, gast_telefon, notiz, transkript, zeitpunkt)
--      values (b,'telefon','fertig','[]',1,'Alt','0170','x','Text', now() - interval '100 days'),
--             (b,'telefon','fertig','[]',1,'Mittel','0171','y','Text', now() - interval '40 days'),
--             (b,'tisch','neu','[]',1,'Neu',null,'z',null, now());
--    r := aufraeumen_personendaten();
--    insert into probe values ('erster Lauf', r::text);
--    insert into probe select 'alt geleert', (gast_name is null and transkript is null)::text
--      from bestellungen where summe = 1 and zeitpunkt < now() - interval '90 days' order by zeitpunkt limit 1;
--    insert into probe select 'mittel: Name bleibt, Transkript weg', (gast_name = 'Mittel' and transkript is null)::text
--      from bestellungen where gast_name = 'Mittel';
--    insert into probe select 'neu unberührt', (notiz = 'z')::text from bestellungen where gast_name = 'Neu';
--    r := aufraeumen_personendaten();
--    insert into probe values ('zweiter Lauf zählt nichts doppelt', r::text);
--  end $p$;
--  select * from probe;
--  rollback;
-- ═══════════════════════════════════════════════════════════════════
