-- ═══════════════════════════════════════════════════════════════════
--  NOCH NICHT ANGEWENDET · Betriebsart: Restaurant oder Foodtruck
--
--  ── WAS HIER ENTSTEHT ─────────────────────────────────────────────
--  Zwei neue, additive Spalten an betriebe:
--
--    art             text, Vorgabe 'restaurant', CHECK ('restaurant'|'foodtruck')
--    standort_heute  jsonb, leer = nicht gesetzt
--
--  Reines Anlegen, nichts liest davon — nach §2.5 ist das Risiko null,
--  solange kein Code danach fragt. Choco und Blend bekommen automatisch
--  'restaurant' (die Vorgabe) und bleiben unverändert.
--
--  ── WAS BEWUSST NICHT HIER DRINSTEHT ───────────────────────────────
--  Die Abholnummer für den Foodtruck-Gast (kein Tisch, aber eine
--  Nummer, auf die er wartet) fehlt in dieser Datei — und zwar nicht,
--  weil ich sie vergessen habe, sondern weil ich ihren Zielort nicht
--  kenne:
--
--    • bestellungen.abholung existiert schon (gesehen in
--      migration-lieferung.sql:257 und migration-telefonbestellung.sql),
--      ist aber ein BOOLEAN — "wird abgeholt, nicht am Tisch serviert",
--      keine Zahl, die man aufruft.
--    • Ob es daneben eine Zahl gibt, in die man reinschreiben könnte
--      (tagesnummer o.ä.), oder ob sie fehlt, weiß ich nicht — nur
--      dass sie in einer früheren Sitzung einmal als "Spalte und Index
--      da, nur das Schreiben fehlt" beschrieben wurde. Diese Notiz ist
--      kein Messwert, sondern eine Erinnerung (§1.3: die Datei schlägt
--      die Erinnerung) — und die Datei kann ich von hier nicht lesen.
--
--  Bevor daran etwas gebaut wird, bitte diese eine Abfrage fahren und
--  das Ergebnis zurückgeben:
--
--    select column_name, data_type
--    from information_schema.columns
--    where table_name = 'bestellungen'
--      and column_name ilike '%nummer%';
--
--  Dieselbe Vorsicht gilt für Catering (reservierungen.art,
--  Catering-Felder) — die Tabelle reservierungen wurde in dieser
--  Sitzung kein einziges Mal gelesen. Diese Datei fasst sie deshalb
--  nicht an; das ist ein zweiter, eigener Schritt nach einer
--  eigenen Bestandsaufnahme, nicht Teil von hier.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Erst nachsehen, ob "art" schon etwas anderes bedeutet ──────
--  "art" ist ein häufiger Spaltenname. Gäbe es ihn an betriebe schon
--  mit einer anderen Bedeutung, würde diese Migration ihn überschreiben
--  oder auf eine CHECK-Bedingung treffen, die nicht zu unseren zwei
--  Werten passt — genau die Verwechslung aus §1.1a ("ein vorhandenes
--  Feld heißt nicht, dass es das eigene ist"), nur mit einer Spalte
--  statt einer Funktion.
do $$
declare v_typ text;
begin
  select data_type into v_typ
    from information_schema.columns
   where table_name = 'betriebe' and column_name = 'art';

  if v_typ is not null then
    raise exception
      'betriebe.art gibt es bereits (Typ %) — nicht blind ueberschreiben, erst ansehen: select distinct art from betriebe;', v_typ;
  end if;
end $$;

-- ── 2 · Die zwei Spalten ────────────────────────────────────────────
alter table public.betriebe
  add column art text not null default 'restaurant',
  add column standort_heute jsonb;

alter table public.betriebe
  add constraint betriebe_art_check check (art in ('restaurant', 'foodtruck'));

commit;

-- ═══════════════════════════════════════════════════════════════════
--  DANACH PRÜFEN
-- ═══════════════════════════════════════════════════════════════════
--
-- ── 1 · Alle bestehenden Betriebe stehen auf 'restaurant' ──────────
--
--   select slug, art, standort_heute from betriebe order by slug;
--
--   → JEDE Zeile 'restaurant', standort_heute NULL. Kein Betrieb darf
--     durch das Anlegen der Spalte seine Art geändert bekommen haben.
--
--
-- ── 2 · Die Bedingung lässt nur die zwei Werte durch ───────────────
--
--   select pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.betriebe'::regclass
--     and conname = 'betriebe_art_check';
--
--   → check (art = any (array['restaurant','foodtruck']))
--
--   Und der Gegenbeweis dazu, in derselben zurückgedrehten Transaktion:
--
--   begin;
--   update betriebe set art = 'imbisswagen' where id = (select id from betriebe limit 1);
--   -- MUSS eine Ausnahme werfen (23514, check_violation). Wirft sie
--   -- keine, ist die Bedingung nicht das, was Schritt 2 oben zeigt.
--   rollback;
--
--
-- ── 3 · MINHKEEY auf 'foodtruck' setzen, wenn hier angekommen ──────
--  Das ist der einzige Schreibvorgang mit echter Wirkung in diesem
--  ganzen Vorgang — bewusst NICHT Teil des obigen Blocks, damit die
--  Spalten-Migration und die inhaltliche Entscheidung "welcher Kunde
--  ist ein Foodtruck" getrennt bleiben und einzeln nachvollziehbar
--  sind.
--
--   update betriebe set art = 'foodtruck' where slug = 'minhkeey';
--   select slug, art from betriebe where slug = 'minhkeey';
--   → 'foodtruck'
