-- ═══════════════════════════════════════════════════════════════════
--  BESTANDSAUFNAHME · Was steht wirklich in dieser Datenbank?
--
--  Im SQL-Editor von Supabase ausführen. Ändert NICHTS — reines Lesen.
--
--  ── WOZU ──────────────────────────────────────────────────────
--  Die Vermerke „NOCH NICHT ANGEWENDET" in den Migrationsköpfen sind
--  Notizen, keine Messungen. Wer sie als Wahrheit nimmt, spielt eine
--  Migration zweimal ein oder gar nicht — beides schon passiert.
--
--  Diese Abfrage beantwortet in einem Rutsch: Welche Funktionen gibt
--  es, in wie vielen Fassungen, und welche Spalten sind da. Daraus
--  ergibt sich ohne Raten, welche Datei noch fehlt.
--
--  Und sie beantwortet die Frage, die einen ganzen Block blockiert:
--  Trägt bestellungen.quelle eine CHECK-Bedingung, die einen neuen
--  Wert wie 'lieferung' verbieten würde?
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Welche Funktionen gibt es, und in WIE VIELEN Fassungen? ───
--
--  Mehr als eine Zeile je Name heißt: „create or replace" hat einmal
--  danebengelegt statt zu ersetzen (§2.1). Welche PostgREST dann
--  trifft, hängt davon ab, welche Parameter der Aufrufer schickt —
--  das ist die Sorte Fehler, die nur manchmal auftritt.
select
  p.proname                                     as funktion,
  pg_get_function_identity_arguments(p.oid)     as parameter,
  count(*) over (partition by p.proname)        as fassungen
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'bestellung_aufgeben', 'bestellung_status', 'bestellung_gefunden',
    'bestellung_stornieren', 'bestellung_restzeit', 'bestellung_telefon',
    'bestellung_liefern', 'admin_anmelden', 'gericht_uebersetzen',
    'reservierungen_aufraeumen', 'tisch_sitzung_start')
order by p.proname, parameter;


-- ── 2 · Welche Spalten sind schon da? ────────────────────────────
--
--  „da" heißt: Die zugehörige Migration ist eingespielt. Fehlt eine
--  Zeile, fehlt die Datei.
select
  c.relname   as tabelle,
  a.attname   as spalte,
  format_type(a.atttypid, a.atttypmod) as typ
from pg_attribute a
join pg_class c     on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not a.attisdropped and a.attnum > 0
  and (
    (c.relname = 'betriebe'    and a.attname in
      ('hub_texte','hub_kacheln','hub_woerter','liefer','telefon_nummer'))
 or (c.relname = 'bestellungen' and a.attname in
      ('storno','wartezeit_min','bestaetigt_um','liefer_adresse',
       'liefergebuehr','abholung','wunschzeit','transkript','tagesnummer'))
 or (c.relname = 'gerichte'    and a.attname in
      ('uebersetzungen','name_uebersetzungen'))
 or (c.relname = 'admin_login_schutz')
  )
order by c.relname, a.attname;


-- ── 3 · Die Frage, die den Liefer-Block blockiert ────────────────
--
--  Kommt KEINE Zeile mit „quelle" darin: alles gut,
--  migration-lieferung.sql kann eingespielt werden.
--
--  Steht dort etwas wie
--      check (quelle = any (array['tisch','service','telefon']))
--  dann muss 'lieferung' ZUERST in diese Liste. Schick mir die Zeile,
--  dann schreibe ich das passende alter table dazu — blind eine
--  Bedingung neu zu bauen, die man nicht gelesen hat, wäre genau der
--  Fehler, den die Migration sonst vermeidet.
select
  conname                        as bedingung,
  pg_get_constraintdef(oid)      as definition
from pg_constraint
where conrelid = 'public.bestellungen'::regclass
  and contype = 'c'
order by conname;


-- ── 4 · Welche quelle-Werte kommen heute wirklich vor? ───────────
--
--  Zeigt, ob 'lieferung' schon Zeilen hat (dann ist die Migration
--  eingespielt und es wird bereits geliefert) — und deckt nebenbei
--  auf, wenn ein Wert auftaucht, den niemand erwartet hat.
select quelle, count(*) as zeilen
from public.bestellungen
group by quelle
order by zeilen desc;
