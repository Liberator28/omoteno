#!/usr/bin/env bash
# Tischpflicht und Abholung, OHNE Live-Zugriff (lokales Postgres 16, §2.7): die ECHTEN Funktionen
# bestellung_aufgeben (migration-gutschein-sicher.sql) und bestellung_abholen (migration-abholen.sql)
# in einem Kleinstmodell. "nachher" spielt vorher migration-tischpflicht-abholen.sql ein.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-"psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -X -q"}
DB=tp_probe
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-abholen.sql >/dev/null
python3 - <<'PY' > /tmp/tp_echte.sql
import re,sys
def hol(datei,name):
    s=open('datenbank/'+datei).read()
    m=re.search(r'create or replace function public\.'+name+r'\(.*?\n(?:end;\n)?\$function\$;|create or replace function public\.'+name+r'\(.*?\nend \$function\$;',s,re.S)
    if not m: sys.exit('fehlt: '+name)
    return m.group(0)
print(hol('migration-gutschein-sicher.sql','bestellung_aufgeben'))
print(hol('migration-abholen.sql','bestellung_abholen'))
PY
$PSQL -d $DB -f /tmp/tp_echte.sql >/dev/null
if [ "${1:-}" = "nachher" ]; then $PSQL -d $DB -f datenbank/migration-tischpflicht-abholen.sql >/dev/null; fi
$PSQL -d $DB -tA -f datenbank/pruef-tischpflicht-abholen.sql
