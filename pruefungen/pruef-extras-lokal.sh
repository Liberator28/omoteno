#!/usr/bin/env bash
# Beilagen und Extras je Gericht, OHNE Live-Zugriff (lokales Postgres 16, §2.7):
#  1 · Schranke optionen_form_ok vor und nach migration-extras-je-gericht.sql — Differenz alt/neu, jede Zeile erwartet
#  2 · die ECHTE positionen_pruefen (aus migration-optionen.sql) rechnet Extras je Gericht richtig nach
# Ehrliche Grenze: gleicher Code, andere Daten — beweist die Regeln, nicht den Live-Bestand.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-"psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -X -q"}
DB=${DB:-extras_probe}
MIG=${MIGRATION:-datenbank/migration-extras-je-gericht.sql}
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB >/dev/null <<'SQL'
create table public.betriebe(id uuid primary key, optionen jsonb);
create table public.gerichte(id uuid primary key default gen_random_uuid(), betrieb_id uuid, name text, preis numeric, verfuegbar boolean default true, opt text);
create table public.aktionen(id bigint generated always as identity primary key, betrieb_id uuid, gericht_name text, preis_neu numeric, aktiv boolean, von timestamptz, bis timestamptz);
SQL
python3 - <<'PY' > /tmp/extras_funktionen.sql
import re,sys
s=open('datenbank/migration-optionen.sql').read()
def hol(name,schluss):
    m=re.search(r'create or replace function public\.'+name+r'\(.*?(?:'+schluss+')',s,re.S)
    if not m: sys.exit('fehlt: '+name)
    return m.group(0)
print(hol('optionen_form_ok', r'\n end \$\$;|\nend \$\$;'))
print(hol('positionen_pruefen', r'end \$function\$;'))
PY
$PSQL -d $DB -f /tmp/extras_funktionen.sql
# NUR_AUFBAU=1: Datenbank mit den echten Funktionen UND der Migration stehen lassen (für pruef-extras-gericht.js, Teil C)
if [ -n "${NUR_AUFBAU:-}" ]; then $PSQL -d $DB -f "$MIG" >/dev/null; echo "aufgebaut: $DB"; exit 0; fi
alt=$($PSQL -d $DB -tA -v fassung=alt -f datenbank/pruef-extras-lokal.sql)
$PSQL -d $DB -f "$MIG" >/dev/null
neu=$($PSQL -d $DB -tA -v fassung=neu -f datenbank/pruef-extras-lokal.sql)
# Erwartung je Fall: alt|neu
ERW=(
 "f01 klein, gültig|ok|ok" "f02 ohne Vorschlag|ok|ok" "f03 mit Vorschlag true|ok|ok"
 "f04 Vorschlag als Text|ok|zu" "f05 Vorschlag als Zahl|ok|zu"
 "f06 Komma im Namen|zu|zu" "f07 Aufpreis 60|zu|zu" "f08 art alle|zu|zu" "f09 Schlüssel groß|zu|zu" "f10 keine Zeilen|zu|zu"
 "f11 Liste statt Objekt|zu|zu" "f12 null|ok|ok"
 "12 Gruppen|ok|ok" "13 Gruppen|zu|ok" "60 Gruppen|zu|ok" "61 Gruppen|zu|zu"
 "40 Zeilen/ 41 Zeilen|zu|zu" "groß: 9 kB|zu|ok" "groß: 50 kB|zu|zu")
rot=0
for e in "${ERW[@]}"; do
  IFS='|' read -r nr a n <<<"$e"
  ga=$(grep -F "alt $nr|" <<<"$alt" | cut -d'|' -f2); gn=$(grep -F "neu $nr|" <<<"$neu" | cut -d'|' -f2)
  [ "$ga" = "$a" ] && [ "$gn" = "$n" ] || { echo "ROT $nr: erwartet alt=$a neu=$n, gemessen alt=$ga neu=$gn"; rot=1; }
done
zl=$(grep -c . <<<"$neu"); [ "$zl" = "${#ERW[@]}" ] || { echo "ROT Zahl der Fälle $zl statt ${#ERW[@]}"; rot=1; }
# Rechte der Funktion bleiben (§2.7): create or replace ändert keine
echo "Teil 1: ${#ERW[@]} Fälle alt/neu geprüft"
ERWP=(
 "P1 Burger (Pommes), Gast zahlt 10|10.00"
 "P2 Burger (Salat · Käse), Gast will 1 zahlen → Server|12.50"
 "P3 Schnitzel (Pommes) — SEIN Preis, nicht der vom Burger|12.50"
 "P4 Burger (Pommes) — dort ohne Aufpreis|10.00"
 "P5 Schnitzel (Reis)|13.00"
 "P6 Burger (Hafermilch · Speck · Salat) — eigene UND geteilte Gruppe|13.50"
 "P7 Burger (Reis) — Reis hängt am Schnitzel: alte Regel, Gast 1|10.00"
 "P8 Burger (Reis) — alte Regel, Gast 11|11.00"
 "P9 Burger (Reis) — alte Regel, Gast 99 (gedeckelt auf +12)|22.00"
 "P10 Schnitzel (Salat) — Salat gehört dem Burger|12.00"
 "P11 Suppe ohne Gruppen, mit Wunsch (Käse)|5.00"
 "P12 Burger (Speck) — „Vorschlag“ ändert den Preis nicht|11.50"
 "P13 Burger (Gold) — unbekanntes Extra, Gast 10.50|10.50"
 "P14 Burger ohne Extras, Gast 1|10.00"
 "P15 Summe: 2 × Burger (Salat) + 1 × Schnitzel (Reis)|36.00")
preis=$($PSQL -d $DB -tA -f datenbank/pruef-extras-preis-lokal.sql)
for e in "${ERWP[@]}"; do grep -qxF -- "$e" <<<"$preis" || { echo "ROT, Zeile fehlt oder weicht ab: $e"; rot=1; }; done
zp=$(grep -c . <<<"$preis"); [ "$zp" = "${#ERWP[@]}" ] || { echo "ROT Zahl der Preisproben $zp statt ${#ERWP[@]}"; rot=1; }
[ $rot = 0 ] && echo "Teil 2: alle ${#ERWP[@]} Preisproben genau so da" || exit 1
