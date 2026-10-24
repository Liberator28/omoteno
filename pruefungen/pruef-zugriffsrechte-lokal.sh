#!/usr/bin/env bash
# Rollen und Rechte des Finanzbereichs OHNE Live-Zugriff (lokales Postgres 16, §2.7).
#   Modell (modell-lokal-zahlung.sql + modell-lokal-rechte.sql) + Tabellen, Sichten, Funktionen und Lese-Regeln der
#   Einkaufsseite WÖRTLICH aus den Migrationsdateien + migration-zugriffsrechte.sql (A) + migration-zugriffsrechte-scharf.sql (B).
#   Vor B misst datenbank/pruef-zugriffsrechte-vor.sql den Anlassfall (Team liest Einkaufszahlen); nach B misst
#   datenbank/pruef-zugriffsrechte-lokal.sql, jede Zeile in einer zurückgedrehten Transaktion.
# Ehrliche Grenze: gleicher Code, andere Daten — beweist die Regeln, nicht den Live-Bestand.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-"psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -X -q"}
DB=${DB:-rechte_probe}
MIG_A=${MIGRATION_A:-datenbank/migration-zugriffsrechte.sql}
MIG_B=${MIGRATION_B:-datenbank/migration-zugriffsrechte-scharf.sql}
T=/tmp/rechte_$DB
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-zahlung.sql >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-rechte.sql >/dev/null
python3 - > $T.sql <<'PY'
import re, sys
def datei(n): return open('datenbank/'+n, encoding='utf-8').read()
def tab(d, name):
    m = re.search(r'create table if not exists public\.'+name+r' \(.*?\n\);', datei(d), re.S)
    if not m: sys.exit('Tabelle fehlt: '+name)
    return m.group(0)
def fn(d, name):
    m = re.search(r'create or replace function public\.'+name+r'\(.*?\n(?:end )?(?:\$function\$|\$\$);', datei(d), re.S)
    if not m: sys.exit('Funktion fehlt: '+name+' in '+d)
    return m.group(0)
def pol(d, tabelle, name):
    m = re.search(r'create policy (?:"'+re.escape(name)+r'"|'+re.escape(name)+r') on public\.'+tabelle+r' for select[^;]*;', datei(d), re.S)
    if not m: sys.exit('Regel fehlt: '+name)
    return m.group(0)
def sicht(d, name):
    m = re.search(r'create or replace view public\.'+name+r' with.*?;', datei(d), re.S)
    if not m: sys.exit('Sicht fehlt: '+name)
    return m.group(0)
out = []
for d, n in [('migration-einkauf.sql','organisationen'),('migration-einkauf.sql','artikel'),('migration-einkauf.sql','lieferanten'),
             ('migration-einkauf.sql','lieferanten_artikel'),('migration-einkauf.sql','einkaufsbelege'),('migration-einkauf.sql','einkaufspositionen'),
             ('migration-einkauf.sql','lagerbewegungen'),('migration-einkauf-e2.sql','inventuren'),('migration-einkauf-e3.sql','rezepturen'),
             ('migration-einkauf-e3.sql','rezepturpositionen'),('migration-einkauf-e4.sql','organisation_mitglieder'),
             ('migration-einkauf-e5b.sql','umlagerungen'),('migration-einkauf-e5b.sql','umlagerungspositionen'),('migration-einkauf-e5d.sql','einkauf_perioden')]:
    out.append(tab(d, n))
out.append("alter table public.betriebe add column organisation_id uuid references public.organisationen(id);")
for t in ['organisationen','artikel','lieferanten','lieferanten_artikel','einkaufsbelege','einkaufspositionen','lagerbewegungen','inventuren','rezepturen',
          'rezepturpositionen','organisation_mitglieder','umlagerungen','umlagerungspositionen','einkauf_perioden']:
    out.append("alter table public.%s enable row level security;" % t)
out.append("grant select on public.organisationen, public.artikel, public.lieferanten, public.lieferanten_artikel, public.einkaufsbelege, public.einkaufspositionen, public.lagerbewegungen, public.inventuren, public.rezepturen, public.rezepturpositionen, public.organisation_mitglieder, public.umlagerungen, public.umlagerungspositionen, public.einkauf_perioden, public.gerichte, public.aktionen to authenticated;")
# echte Funktionen: PIN-bewusste Mitgliedschaft, Inhaber, Rolle, Lager, Zentrale
for d, n in [('migration-pin.sql','pin_ok'),('migration-pin.sql','meine_betriebe'),('migration-rollen.sql','meine_betriebe_inhaber'),
             ('migration-rollen.sql','ist_inhaber'),('migration-rollen.sql','meine_rolle'),('migration-einkauf.sql','meine_organisationen'),
             ('migration-einkauf-e5d.sql','darf_lager_buchen'),('migration-einkauf-e4.sql','ist_zentrale'),
             ('migration-einkauf-e4.sql','darf_vergleichen_org'),('migration-einkauf-e4.sql','darf_vergleichen')]:
    out.append(fn(d, n))
out.append(sicht('migration-einkauf-e5b.sql','artikel_preise'))
out.append("grant select on public.artikel_preise to authenticated;")   # wie live (migration-einkauf.sql: grant select … artikel_preise)
for d, n in [('migration-einkauf-e5a.sql','gericht_kosten_portion'),('migration-einkauf-e3.sql','gericht_kalkulation'),('migration-einkauf-e4.sql','wareneinsatz_theoretisch')]:
    out.append(fn(d, n))
# die ECHTEN Lese-Regeln von heute
for d, t, n in [('migration-einkauf.sql','einkaufsbelege','beleg betrieb liest'),('migration-einkauf.sql','einkaufspositionen','position betrieb liest'),
                ('migration-einkauf.sql','lagerbewegungen','bewegung betrieb liest'),('migration-einkauf-e2.sql','inventuren','inventur betrieb liest'),
                ('migration-einkauf-e3.sql','rezepturen','rezeptur betrieb liest'),('migration-einkauf-e3.sql','rezepturpositionen','rezepturposition betrieb liest'),
                ('migration-einkauf-e5d.sql','einkauf_perioden','einkauf_perioden_lesen'),('migration-einkauf-e5b.sql','umlagerungen','umlagerung beteiligte lesen'),
                ('migration-einkauf-e5b.sql','umlagerungspositionen','umlagerungsposition beteiligte lesen')]:
    out.append(pol(d, t, n))
# Spaltenrecht auf lieferanten_artikel wörtlich aus E4 (letzter_preis ist für authenticated nicht lesbar)
e4 = datei('migration-einkauf-e4.sql')
out.append(re.search(r'revoke select on public\.lieferanten_artikel from authenticated;', e4).group(0))
out.append(re.search(r'grant select \(id, lieferant_id.*?\)\s+on public\.lieferanten_artikel to authenticated;', e4, re.S).group(0))
print("\n".join(out))
PY
$PSQL -d $DB -f $T.sql >/dev/null
# storage.objects wie live (Regel „belege mitglied liest“ wörtlich aus e2)
$PSQL -d $DB >/dev/null <<'SQL'
create schema if not exists storage;
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(n text) returns text[] language sql immutable as $$ select string_to_array(n, '/') $$;
alter table storage.objects enable row level security;
grant select on storage.objects to authenticated;
SQL
python3 - <<'PY' > $T.storage.sql
import re
s = open('datenbank/migration-einkauf-e2.sql', encoding='utf-8').read()
m = re.search(r'create policy "belege mitglied liest" on storage\.objects for select.*?;', s, re.S)
print(m.group(0))
PY
$PSQL -d $DB -f $T.storage.sql >/dev/null
ERWARTET_VOR=(
 "V1 Voraussetzung: Team ist Mitglied und sieht den Betrieb (erwartet 1)|1"
 "V2 VOR Teil B: Team liest Einkaufsbelege (der Anlassfall)|1"
 "V3 VOR Teil B: Team liest Rezepturen|1"
 "V4 VOR Teil B: Team liest die Kalkulation (Zeilen)|1"
 "V5 VOR Teil B: Küche liest Lagerbewegungen|1")
$PSQL -d $DB -f datenbank/pruef-zugriffsrechte-vor-daten.sql >/dev/null
$PSQL -d $DB -tA -f datenbank/pruef-zugriffsrechte-vor.sql | grep -v '^{"sub"' | grep -v '^$' > $T.vor.txt
rot=0
for e in "${ERWARTET_VOR[@]}"; do grep -qxF -- "$e" $T.vor.txt || { echo "ROT (vorher), Zeile fehlt oder weicht ab: $e"; rot=1; }; done
nv=$(grep -c . $T.vor.txt); [ "$nv" = "${#ERWARTET_VOR[@]}" ] || { echo "ROT (vorher), Zeilenzahl $nv statt ${#ERWARTET_VOR[@]}"; rot=1; }
$PSQL -d $DB -f "$MIG_A" >/dev/null
# Wächter von Teil B (jeder Fall in einer Kopie der Datenbank NACH A, vor B): unbekannte Lese-Regel, fehlende bekannte Regel,
# abweichende Zugriffsstelle in einer Kalkulations-Funktion → B bricht LAUT ab und ändert nichts.
ERWARTET_WACHE=(
 "W-B1 unbekannte Lese-Regel auf einkaufsbelege: B bricht ab|abgebrochen"
 "W-B2 bekannte Regel fehlt: B bricht ab|abgebrochen"
 "W-B3 gericht_kalkulation mit fremder Zugriffsstelle: B bricht ab|abgebrochen"
 "W-B4 nach dem Abbruch ist die Lese-Regel unverändert (kein hat_recht)|unveraendert")
: > $T.wache.txt
wache() { # name, sql, stichwort
  $PSQL -d postgres -c "drop database if exists ${DB}_w" -c "create database ${DB}_w template $DB" >/dev/null
  $PSQL -d ${DB}_w -c "$2" >/dev/null
  if $PSQL -d ${DB}_w -f "$MIG_B" >/dev/null 2>$T.w.err; then echo "$1|ERFOLG (falsch)" >> $T.wache.txt
  elif grep -q "$3" $T.w.err; then echo "$1|abgebrochen" >> $T.wache.txt
  else echo "$1|abgebrochen aus ANDEREM Grund: $(head -1 $T.w.err)" >> $T.wache.txt; fi
}
wache "W-B1 unbekannte Lese-Regel auf einkaufsbelege: B bricht ab" 'create policy "alt offen" on public.einkaufsbelege for select to authenticated using (true)' "Unbekannter Regelbestand"
wache "W-B2 bekannte Regel fehlt: B bricht ab" 'drop policy "rezeptur betrieb liest" on public.rezepturen' "Unbekannter Regelbestand"
wache "W-B3 gericht_kalkulation mit fremder Zugriffsstelle: B bricht ab" "do \$x\$ declare d text; begin d := pg_get_functiondef('public.gericht_kalkulation(uuid, timestamptz)'::regprocedure); execute replace(d, '(p_betrieb in (select public.meine_betriebe()) or public.ist_master())', '(p_betrieb is not null)'); end \$x\$" "Zugriffsstelle nicht gefunden"
echo "W-B4 nach dem Abbruch ist die Lese-Regel unverändert (kein hat_recht)|$($PSQL -d ${DB}_w -tA -c "select case when qual like '%hat_recht%' then 'VERAENDERT' else 'unveraendert' end from pg_policies where tablename='einkaufsbelege' and policyname='beleg betrieb liest'")" >> $T.wache.txt
$PSQL -d postgres -c "drop database if exists ${DB}_w" >/dev/null
for e in "${ERWARTET_WACHE[@]}"; do grep -qxF -- "$e" $T.wache.txt || { echo "ROT (Wächter), Zeile fehlt oder weicht ab: $e"; rot=1; }; done
$PSQL -d $DB -f "$MIG_B" >/dev/null
$PSQL -d $DB -f datenbank/pruef-zugriffsrechte-nach-daten.sql >/dev/null
$PSQL -d $DB -tA -f datenbank/pruef-zugriffsrechte-lokal.sql | grep -v '^{"sub"' | grep -v '^$' > $T.nach.txt
$PSQL -d $DB -f "$MIG_A" >/dev/null && $PSQL -d $DB -f "$MIG_B" >/dev/null
$PSQL -d $DB -tA -f datenbank/pruef-zugriffsrechte-lokal.sql | grep -v '^{"sub"' | grep -v '^$' > $T.nach2.txt
cmp -s $T.nach.txt $T.nach2.txt && echo "A und B ein zweites Mal eingespielt: dieselben Proben, dieselbe Ausgabe" || { echo "ROT, zweites Einspielen ändert das Ergebnis:"; diff $T.nach.txt $T.nach2.txt | head; rot=1; }
python3 - "$T.nach.txt" <<'PY' || rot=1
import sys
erw = [l.rstrip("\n") for l in open('datenbank/pruef-zugriffsrechte-erwartet.txt', encoding='utf-8') if l.strip() and not l.startswith('#')]
ist = [l.rstrip("\n") for l in open(sys.argv[1], encoding='utf-8') if l.strip()]
fehl = [e for e in erw if e not in ist]
extra = [i for i in ist if i not in erw]
for e in fehl: print("ROT, Zeile fehlt oder weicht ab:", e)
for i in extra: print("OHNE ERWARTUNG:", i)
if len(ist) != len(erw): print("ROT, Zeilenzahl %d statt %d" % (len(ist), len(erw)))
sys.exit(1 if fehl or extra or len(ist) != len(erw) else 0)
PY
[ $rot = 0 ] && echo "alle ${#ERWARTET_VOR[@]} Vorher-Zeilen und $(grep -c . $T.nach.txt) Nachher-Zeilen genau so da" || exit 1
