#!/usr/bin/env bash
# Rechte des Saalplans OHNE Zugriff auf die Live-Datenbank (Stabilisierungsauftrag 24.10.):
# Modell (tische wie live, Vorzustand mit offenen Rechten) + die ECHTEN Funktionen aus den Migrationen
# + migration-saalplan.sql + migration-saal-einstellungen.sql, dann beide Proben.
# Lokales Postgres 16 (§2.7). Ehrliche Grenze: gleicher Code, andere Daten — beweist die Regeln, nicht den Live-Bestand.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-"psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -X -q"}
DB=saal_probe
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-zahlung.sql >/dev/null
python3 - <<'PY' > /tmp/saal_funktionen.sql
import re,sys
def hol(datei,name):
    s=open('datenbank/'+datei).read()
    m=re.search(r'create or replace function public\.'+name+r'\(.*?\n(?:end )?(?:\$function\$|\$\$);',s,re.S)
    if not m: sys.exit('fehlt: '+name)
    return m.group(0)
for d,n in [('migration-pin.sql','pin_ok'),('migration-rollen.sql','meine_betriebe_inhaber'),('migration-rollen.sql','ist_inhaber'),('migration-rollen.sql','betrieb_rolle_wache')]:
    print(hol(d,n))
PY
$PSQL -d $DB -f /tmp/saal_funktionen.sql
$PSQL -d $DB -f datenbank/modell-lokal-saal.sql
$PSQL -d $DB -f datenbank/migration-saalplan.sql
$PSQL -d $DB -f datenbank/migration-saal-einstellungen.sql
ERWARTET=(
 "Inhaber legt Lage (erwartet 1)|1"
 "Inhaber ändert nummer|abgewiesen" "Inhaber ändert schluessel|abgewiesen"
 "x = 101|abgewiesen" "nur x ohne y|abgewiesen" "Form dreieck|abgewiesen"
 "Inhaber legt Tisch an|abgewiesen" "Inhaber löscht Tisch|abgewiesen"
 "Team sieht Tische des Betriebs (Voraussetzung, > 0)|20" "TEAM legt Lage (erwartet 0 Zeilen)|0"
 "00 Voraussetzung|true" "01 gültig → ok|{\"ok\": true}"
 "03 doppelter Name|{\"ok\": false, \"grund\": \"zonen\"}" "04 Spitzklammer|{\"ok\": false, \"grund\": \"zonen\"}"
 "06 sieben Bereiche|{\"ok\": false, \"grund\": \"zonen\"}" "10 Farbname|{\"ok\": false, \"grund\": \"stufen\"}"
 "11 min3 = min2|{\"ok\": false, \"grund\": \"stufen\"}" "14 Zahl als Text|{\"ok\": false, \"grund\": \"stufen\"}"
 "16 Zeiten fehlen|{\"ok\": false, \"grund\": \"stufen\"}" "17 Zeit bei In Arbeit|{\"ok\": false, \"grund\": \"stufen\"}"
 "19 unbekannter Schlüssel|{\"ok\": false, \"grund\": \"form\"}"
 "22 direkt einfügen|abgewiesen" "23 direkt ändern|abgewiesen" "24 Inhaber setzt Bereich (erwartet 1)|1"
 "25 Bereich mit <|abgewiesen" "31 TEAM setzt (erwartet kein_recht)|{\"ok\": false, \"grund\": \"kein_recht\"}"
 "32 TEAM setzt Bereich (erwartet 0 Zeilen)|0" "40 anon ruft|abgewiesen"
 "R1 Inhaber ändert Rubriken (erwartet 1)|1" "R2 Inhaber ändert slug|abgewiesen"
 "R3 Voraussetzung: Team sieht den Betrieb (erwartet 1)|1" "R4 TEAM ändert Rubriken|abgewiesen"
 "R5 TEAM pausiert Bestellungen (legitim, erwartet 1)|1"
 "R6 Voraussetzung: Fremder sieht den Betrieb NICHT (erwartet 0)|0" "R7 FREMDER ändert Rubriken (erwartet 0 Zeilen)|0"
 "R8 Fremder legt Betrieb an|abgewiesen" "R9 anon ändert Rubriken|abgewiesen"
 "R10 Stand nach allen Versuchen|[{\"gruppe\": \"Meine Rubrik\"}]")
$PSQL -d $DB -tA -f datenbank/pruef-saalplan.sql > /tmp/saal_ergebnis.txt
$PSQL -d $DB -tA -f datenbank/pruef-saal-einstellungen.sql >> /tmp/saal_ergebnis.txt
$PSQL -d $DB -tA -f datenbank/pruef-rubriken-lokal.sql >> /tmp/saal_ergebnis.txt
rot=0
for e in "${ERWARTET[@]}"; do
  if ! grep -qxF -- "$e" /tmp/saal_ergebnis.txt; then echo "ROT, Zeile fehlt oder weicht ab: $e"; rot=1; fi
done
# Zeilen, die keine Erwartung haben (Probe hat mehr gemessen als hier geprüft wird), werden gezeigt, nicht verschwiegen
grep -vE '^\{|^Voraussetzung Inhaber|^Voraussetzung Fremder' /tmp/saal_ergebnis.txt | while IFS= read -r z; do
  gefunden=0; for e in "${ERWARTET[@]}"; do [ "$z" = "$e" ] && gefunden=1; done
  [ $gefunden = 0 ] && echo "OHNE ERWARTUNG: $z"; true
done
[ $rot = 0 ] && echo "alle ${#ERWARTET[@]} erwarteten Zeilen genau so da" || exit 1
