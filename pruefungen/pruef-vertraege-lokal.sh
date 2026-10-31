#!/usr/bin/env bash
# Spielt Modell + migration-vertraege.sql in eine frische lokale Datenbank und fährt
# datenbank/pruef-vertraege.sql darauf (§2.7: lokales Postgres 16, Port 5433).
# Gegenbeweise im Worktree: VERTRAEGE_MIGRATION=<Kopie der Migration>.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-"psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -X -q"}
DB=${VERTRAEGE_DB:-vertraege_probe}
MIGRATION=${VERTRAEGE_MIGRATION:-datenbank/migration-vertraege.sql}
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-zahlung.sql >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-vertraege.sql >/dev/null
$PSQL -d $DB -f "$MIGRATION" >/dev/null
$PSQL -d $DB -tA -f datenbank/pruef-vertraege.sql | tee /tmp/vertraege_ergebnis.txt
# Ein NULL-Ergebnis druckt GAR KEINE Zeile (NULL || text = NULL) — darum zählen (§8.1x).
erwartet=$(grep -c "^select 'V" datenbank/pruef-vertraege.sql)
bekommen=$(grep -c '^V.* | true$' /tmp/vertraege_ergebnis.txt)
if grep -q '| false' /tmp/vertraege_ergebnis.txt || [ "$erwartet" != "$bekommen" ]; then
  echo "ROT: $bekommen von $erwartet Proben grün (fehlende Zeilen = NULL-Ergebnis)"; exit 1; fi
echo "alle $bekommen Proben grün"
