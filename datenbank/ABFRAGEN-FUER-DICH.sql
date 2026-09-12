-- ═══════════════════════════════════════════════════════════════════
--  ABFRAGEN · Was ich von hier aus nicht sehen kann
--
--  Im SQL-Editor von Supabase ausführen. Ändert NICHTS — reines Lesen.
--  Schick mir die Ergebnisse, dann baue ich weiter, ohne zu raten.
--
--  Mein Datenbankzugang ist in dieser Sitzung gesperrt (gemessen:
--  HTTP 403, der Host mcp.supabase.com ist nicht freigegeben). Alles
--  hier drin blockiert gerade konkrete Arbeit — es ist keine
--  Neugier.
-- ═══════════════════════════════════════════════════════════════════


-- ═══ 1 · DAS MASTER BOARD · blockiert „Kunde anlegen" ═════════════
--
--  Die Funktion ist_master() EXISTIERT in deiner Datenbank —
--  migration-anon-rechte-schliessen.sql:101 nennt sie ausdrücklich.
--  Ihr Körper steht aber in keiner Datei dieses Verzeichnisses.
--
--  Das ist die Sicherheitsgrenze des ganzen Master Boards: Woran
--  erkennt sie DICH und nicht einen Wirt? Bevor ich eine Funktion
--  schreibe, die Betriebe anlegt und Leute zu Inhabern macht, muss
--  ich das gelesen haben. Eine Rechteprüfung nachzubauen, die man
--  nie gesehen hat, ist genau die Annahme, gegen die §0 steht.

select pg_get_functiondef('public.ist_master()'::regprocedure) as ist_master;


-- ── 1b · Welche Master-Funktionen gibt es schon? ──────────────────
--
--  Damit ich nicht zum dritten Mal etwas plane, das es längst gibt.
--  Genau das ist mir bei ist_master() und beim „erste Geste"-Vollbild
--  schon passiert.

select p.proname                                 as funktion,
       pg_get_function_identity_arguments(p.oid) as parameter,
       count(*) over (partition by p.proname)    as fassungen
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'master%'
       or p.proname like '%_anlegen'
       or p.proname in ('ist_master','ist_gruender','meine_betriebe','slug_frei'))
order by p.proname, parameter;


-- ── 1c · Wer darf was lesen? ──────────────────────────────────────
--
--  Das Master Board liest betriebe, bestellungen, anfragen und
--  master_umsaetze mit select('*'). Damit das trägt, muss eine Regel
--  es erlauben — und für JEDEN ANDEREN verbieten. §2.3a: Die Regel
--  entscheidet, welche Zeilen; das RECHT entscheidet, ob überhaupt.

select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('anfragen','betriebe','betrieb_mitglieder',
                    'master_umsaetze','omoteno_personal')
order by tablename, policyname;

select c.relname as tabelle,
       has_table_privilege('anon',          c.oid, 'SELECT') as anon_lesen,
       has_table_privilege('anon',          c.oid, 'INSERT') as anon_schreiben,
       has_table_privilege('authenticated', c.oid, 'SELECT') as ang_lesen
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('anfragen','betriebe','betrieb_mitglieder',
                    'master_umsaetze','omoteno_personal')
order by c.relname;


-- ── 1d · Gibt es die Tabellen, die das Master Board erwartet? ─────
--
--  Deine Datei nennt master_umsaetze und ruft rpc('trennungsbericht').
--  Letztere verweist auf „supabase-trennung.sql" — die Datei gibt es
--  in diesem Verzeichnis nicht. Existiert die Funktion trotzdem?

select to_regclass('public.master_umsaetze')    as tabelle_umsaetze,
       to_regclass('public.omoteno_personal')   as tabelle_personal,
       to_regproc('public.trennungsbericht')    as funktion_trennung;


-- ═══ 2 · DER TELEFONWEG · blockiert Alessia ═══════════════════════
--
--  betriebe.telefon_nummer fehlte laut deiner Bestandsaufnahme.
--  migration-telefonbestellung.sql ist EINE Transaktion — entweder
--  ist alles drin oder nichts. Heißt: Alessia ist wahrscheinlich
--  nicht ausgerollt.
--
--  Wahrscheinlich ist nicht gemessen. Diese zwei Zeilen klären es:

select to_regclass('public.bestellungen')                        as tabelle_da,
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='betriebe'
                  and column_name='telefon_nummer')              as spalte_telefon,
       to_regproc('public.bestellung_telefon')                   as funktion_telefon;


-- ═══ 3 · DIE LIEFERUNG · Stand nach deinen Migrationen ════════════
--
--  Damit ich weiß, ob migration-quelle-lieferung.sql und
--  migration-lieferung.sql angekommen sind. Beide habe ich dir
--  geschickt.

select conname                   as bedingung,
       pg_get_constraintdef(oid) as definition,
       pg_get_constraintdef(oid) ~ 'lieferung' as lieferung_erlaubt
from pg_constraint
where conrelid = 'public.bestellungen'::regclass and contype = 'c'
order by conname;

select exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='betriebe'
                  and column_name='liefer')            as spalte_liefer,
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='bestellungen'
                  and column_name='liefer_adresse')    as spalte_adresse,
       to_regproc('public.bestellung_liefern')         as funktion_liefern;


-- ═══ 4 · DER STRESSTEST · was 60 Gäste wirklich auslösen ══════════
--
--  Du willst wissen, ob das System 60 Besucher trägt. Das entscheidet
--  sich nicht im Browser, sondern hier: an Indizes und an der Frage,
--  wie oft jeder Hub den Server fragt.
--
--  60 Gäste × alle 20 Sekunden eine Kartenabfrage = 180 Anfragen pro
--  Minute auf betriebe und gerichte. Das ist für Postgres wenig —
--  ABER nur, wenn die Abfragen auf einen Index treffen. Ohne Index
--  liest Postgres bei jeder Anfrage die ganze Tabelle.

select t.relname                as tabelle,
       i.relname                as index,
       pg_get_indexdef(x.indexrelid) as definition
from pg_index x
join pg_class t on t.oid = x.indrelid
join pg_class i on i.oid = x.indexrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname in ('betriebe','gerichte','bestellungen','reservierungen',
                    'servicerufe','ereignisse','anfragen')
order by t.relname, i.relname;


-- ── 4b · Wie groß ist es heute? ───────────────────────────────────
--  Eine Tabelle mit 45 Zeilen verhält sich anders als eine mit
--  45 000. Damit ich weiß, ab wann was weh tut.

select relname as tabelle, n_live_tup as zeilen
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc
limit 20;


-- ── 4c · Die teuersten Abfragen, falls die Erweiterung da ist ─────
--  pg_stat_statements zeigt, was wirklich Zeit kostet — statt dass
--  ich rate, welche Abfrage der Engpass ist. Fehlt die Erweiterung,
--  kommt hier ein Fehler; dann einfach überspringen und mir das
--  sagen.

select calls, round(mean_exec_time::numeric, 2) as ms_schnitt,
       round(total_exec_time::numeric) as ms_gesamt,
       left(query, 110) as abfrage
from pg_stat_statements
where query not ilike '%pg_stat%'
order by total_exec_time desc
limit 15;
