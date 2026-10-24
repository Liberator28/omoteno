#!/usr/bin/env bash
# Spielt Modell + migration-bestellungen-spaltenrechte.sql in eine frische lokale Datenbank und fährt
# datenbank/pruef-bestellungen-spaltenrechte.sql darauf (§2.7: lokales Postgres 16, Port 5433).
# Das Modell (modell-lokal-zahlung.sql) gibt authenticated — wie live — UPDATE auf die GANZE Tabelle.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-"psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -X -q"}
DB=${BS_DB:-bsr_probe}
MIGRATION=${BS_MIGRATION:-datenbank/migration-bestellungen-spaltenrechte.sql}
PROBE=${BS_PROBE:-datenbank/pruef-bestellungen-spaltenrechte.sql}
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-zahlung.sql >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-bestellungen-spalten.sql >/dev/null
# Der Modellstand VOR der Migration: Tabellenrecht UPDATE (wie live). Wenn die Zeile fehlte, prüfte die Probe nichts.
$PSQL -d $DB -tA -c "select 'Vorher: Tabellenrecht UPDATE | ' || has_table_privilege('authenticated','public.bestellungen','UPDATE')" | tee /tmp/bsr_vorher.txt
grep -q '| true' /tmp/bsr_vorher.txt || { echo "ROT: Das Modell hat vorher kein UPDATE-Recht — die Probe prüfte nichts"; exit 1; }
$PSQL -d $DB -f "$MIGRATION" >/dev/null
$PSQL -d $DB -tA -f "$PROBE" | tee /tmp/bsr_ergebnis.txt
erwartet=$(grep -c "^select 'S" "$PROBE")
bekommen=$(grep -c '^S.* | true$' /tmp/bsr_ergebnis.txt)
if grep -q '| false' /tmp/bsr_ergebnis.txt || [ "$erwartet" != "$bekommen" ]; then
  echo "ROT: $bekommen von $erwartet Proben grün (fehlende Zeilen = NULL-Ergebnis)"; exit 1; fi
echo "alle $bekommen Proben grün"
