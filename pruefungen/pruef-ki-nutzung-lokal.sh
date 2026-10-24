#!/usr/bin/env bash
# Spielt Modell + migration-ki-nutzung.sql in eine frische lokale Datenbank und fährt
# datenbank/pruef-ki-nutzung.sql darauf (§2.7: lokales Postgres 16, Port 5433).
# Die Migration nutzt nur meine_betriebe() und ist_master() — beide stehen im Modell
# (modell-lokal-zahlung.sql) so wie live; es gibt keine zweite, erfundene Funktion.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-"psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -X -q"}
DB=${KI_DB:-ki_probe}
MIGRATION=${KI_MIGRATION:-datenbank/migration-ki-nutzung.sql}
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-zahlung.sql >/dev/null
$PSQL -d $DB -f "$MIGRATION" >/dev/null
$PSQL -d $DB -tA -f "${KI_PROBE:-datenbank/pruef-ki-nutzung.sql}" | tee /tmp/ki_ergebnis.txt
# Ein NULL-Ergebnis druckt GAR KEINE Zeile (NULL || text = NULL) — darum zählen (§8.1x).
erwartet=$(grep -c "^select 'K" "${KI_PROBE:-datenbank/pruef-ki-nutzung.sql}")
bekommen=$(grep -c '^K.* | true$' /tmp/ki_ergebnis.txt)
if grep -q '| false' /tmp/ki_ergebnis.txt || [ "$erwartet" != "$bekommen" ]; then
  echo "ROT: $bekommen von $erwartet Proben grün (fehlende Zeilen = NULL-Ergebnis)"; exit 1; fi
echo "alle $bekommen Proben grün"
