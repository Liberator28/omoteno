#!/usr/bin/env bash
# „Gericht fertig → Service“ OHNE Zugriff auf die Live-Datenbank: Modell (wie live) + Spaltenrechte-Migration (damit
# authenticated die neue Spalte NICHT direkt schreiben kann, wie live) + migration-gericht-fertig.sql, dann die Probe.
# Lokales Postgres 16 (§2.7, Port 5433). Ehrliche Grenze: gleicher Code, andere Daten — beweist die Regeln, nicht den Live-Bestand.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-"psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -X -q"}
DB=${GF_DB:-gf_probe}
MIGRATION=${GF_MIGRATION:-datenbank/migration-gericht-fertig.sql}
PROBE=${GF_PROBE:-datenbank/pruef-gericht-fertig.sql}
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-zahlung.sql >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-bestellungen-spalten.sql >/dev/null
$PSQL -d $DB -f datenbank/migration-bestellungen-spaltenrechte.sql >/dev/null
$PSQL -d $DB -f "$MIGRATION" >/dev/null
$PSQL -d $DB -tA -f "$PROBE" | tee /tmp/gf_ergebnis.txt
erwartet=$(grep -c "^select 'S" "$PROBE")
bekommen=$(grep -c '^S.* | true$' /tmp/gf_ergebnis.txt)
if grep -q '| false' /tmp/gf_ergebnis.txt || [ "$erwartet" != "$bekommen" ]; then
  echo "ROT: $bekommen von $erwartet Proben grün (fehlende Zeilen = NULL-Ergebnis)"; exit 1; fi
echo "alle $bekommen Proben grün"
