#!/usr/bin/env bash
# Rechte und Form von betriebe.hub_bloecke OHNE Live-Zugriff: Modell + ECHTE Funktionen aus migration-rollen.sql
# + ECHTE migration-hub-bloecke.sql, dann datenbank/pruef-bloecke-lokal.sql (zurückgedreht).
# Lokales Postgres 16 (§2.7). Ehrliche Grenze: gleicher Code, andere Daten — beweist die Regeln, nicht den Live-Bestand.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-"psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -X -q"}
DB=bloecke_probe
MIG=${MIGRATION:-datenbank/migration-hub-bloecke.sql}
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-zahlung.sql >/dev/null
python3 - <<'PY' > /tmp/bloecke_funktionen.sql
import re,sys
def hol(datei,name):
    s=open('datenbank/'+datei).read()
    m=re.search(r'create or replace function public\.'+name+r'\(.*?\n(?:end )?(?:\$function\$|\$\$);',s,re.S)
    if not m: sys.exit('fehlt: '+name)
    return m.group(0)
for d,n in [('migration-pin.sql','pin_ok'),('migration-rollen.sql','meine_betriebe_inhaber'),('migration-rollen.sql','ist_inhaber'),('migration-rollen.sql','betrieb_rolle_wache')]:
    print(hol(d,n))
PY
$PSQL -d $DB -f /tmp/bloecke_funktionen.sql >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-saal.sql >/dev/null
$PSQL -d $DB -f "$MIG" >/dev/null
ERWARTET=(
 "B0a anon darf die Spalte lesen (der Gast)|true"
 "B0b anon darf sie NICHT ändern|true"
 "B0c authenticated darf sie ändern|true"
 "B0d anon darf preis-/Vertragsspalten nicht lesen (select * bleibt zu)|true"
 "B1 Inhaber setzt Blöcke (erwartet 1)|1"
 "B2 Objekt statt Liste|abgewiesen" "B3 41 Einträge|abgewiesen" "B4 zu groß|abgewiesen"
 "B4b genau 40 Einträge (Grenze selbst, erwartet 1)|1"
 "B5 Voraussetzung: Team sieht den Betrieb (erwartet 1)|1" "B6 TEAM ändert Blöcke|abgewiesen"
 "B6b TEAM pausiert Bestellungen (legitim, erwartet 1)|1"
 "B7 Voraussetzung: Fremder sieht den Betrieb NICHT (erwartet 0)|0"
 "B8 FREMDER ändert Blöcke (erwartet 0 Zeilen)|0"
 "B9 anon ändert Blöcke|abgewiesen"
 "B10 Stand nach allen Versuchen (der des Inhabers)|[{\"id\": \"begleiter\", \"breite\": \"halb\"}, {\"id\": \"eigen-ab12\", \"titel\": \"Hallo\"}]")
$PSQL -d $DB -tA -f datenbank/pruef-bloecke-lokal.sql | grep -v '^{"sub"' > /tmp/bloecke_ergebnis.txt
rot=0
for e in "${ERWARTET[@]}"; do
  grep -qxF -- "$e" /tmp/bloecke_ergebnis.txt || { echo "ROT, Zeile fehlt oder weicht ab: $e"; rot=1; }
done
# Zählung: keine Zeile mehr und keine weniger als erwartet (eine NULL-Probe druckt nichts, §8.1x)
n=$(grep -c . /tmp/bloecke_ergebnis.txt)
[ "$n" = "${#ERWARTET[@]}" ] || { echo "ROT, Zeilenzahl $n statt ${#ERWARTET[@]}"; grep -vxF -f <(printf '%s\n' "${ERWARTET[@]}") /tmp/bloecke_ergebnis.txt | sed 's/^/OHNE ERWARTUNG: /'; rot=1; }
[ $rot = 0 ] && echo "alle ${#ERWARTET[@]} erwarteten Zeilen genau so da" || exit 1
