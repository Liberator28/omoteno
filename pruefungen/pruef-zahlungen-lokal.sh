#!/usr/bin/env bash
# Spielt Modell + die ECHTEN Funktionen + migration-zahlungen.sql in eine frische
# lokale Datenbank und fährt datenbank/pruef-zahlungen.sql darauf (§2.7: lokales Postgres 16).
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-"psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -X -q"}
DB=zahl_probe
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f datenbank/modell-lokal-zahlung.sql >/dev/null
python3 - "$DB" <<'PY' > /tmp/zahl_funktionen.sql
import re,sys
def hol(datei,name):
    s=open('datenbank/'+datei).read()
    m=re.search(r'create or replace function public\.'+name+r'\(.*?\n(?:end )?(?:\$function\$|\$\$);',s,re.S)
    if not m: sys.exit('fehlt: '+name)
    return m.group(0)
for d,n in [('migration-pin.sql','pin_ok'),('migration-gutschein-sicher.sql','pin_ausstellung_pruefen'),('migration-rollen.sql','meine_betriebe_inhaber'),
            ('migration-rollen.sql','ist_inhaber'),('migration-protokoll.sql','protokoll_name'),
            ('migration-protokoll.sql','protokoll_kurz'),('migration-protokoll.sql','protokoll_schreiben')]:
    print(hol(d,n))
PY
$PSQL -d $DB -f /tmp/zahl_funktionen.sql
$PSQL -d $DB -f datenbank/migration-zahlungen.sql
$PSQL -d $DB -tA -f datenbank/pruef-zahlungen.sql | tee /tmp/zahl_ergebnis.txt
! grep -q '| false' /tmp/zahl_ergebnis.txt
