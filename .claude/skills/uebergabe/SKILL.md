---
name: uebergabe
description: Die Prüfliste aus CLAUDE.md §8 vor jeder Übergabe fahren. Greift, sobald an Seiten, Hub, Vorlage, Markenblättern oder Auslieferung etwas geändert wurde und das Ergebnis abgegeben, zusammengeführt oder als „fertig" gemeldet werden soll — auch bei einer Änderung, die klein aussieht.
---

# Übergabe

Ein Ergebnis, das nicht geprüft wurde, ist kein Ergebnis, sondern eine
Behauptung. Dieser Ablauf macht daraus eine Messung.

**Alles aus der Wurzel des Verzeichnisses starten.** Prüfungen, die
einen Browser brauchen, brauchen `NODE_PATH`.

## 1 · Was wurde angefasst

```bash
git status --short
git diff --stat
```

Die Liste entscheidet, welche Prüfungen unten laufen. Nicht raten —
ansehen.

## 2 · Erzeugen, wenn die Quelle des Hubs berührt ist

Berührt heißt: `vorlagen/hub.vorlage.html` oder
`markenblaetter/*.json`.

```bash
node erzeuger/erzeuge-hub.js --alle --pruefen-nur
node erzeuger/erzeuge-hub.js --alle
```

`dist/` wird **nie** von Hand bearbeitet. Wer dort editiert, verliert
es beim nächsten Erzeugen (CLAUDE.md, Kopf).

## 3 · Prüfsummen gegenhalten

Bei jeder Änderung, die den Hub **nicht** verändern soll — Umbenennen,
Verschieben, Aufräumen — muss er bytegleich herauskommen:

```bash
md5sum dist/*/index.html
```

Vorher und nachher vergleichen. Ein Unterschied, den man nicht
erklären kann, ist ein Fehler, kein Zufall (§8.1a).

## 4 · Die Einzelprüfung, immer

Für **jede** berührte ausgelieferte Datei:

```bash
python3 pruefungen/pruef-datei.py <datei>
node pruefungen/pruef-ueberlauf.js <datei>
```

## 5 · Die richtigen Prüfungen wählen

Aus der Tabelle in CLAUDE.md §8.2. Der Bereich entscheidet, nicht die
Gewohnheit:

| Geändert | Läuft |
|---|---|
| Farben, Paletten, Vorlagen | `pruef-kontrast.js`, `pruef-lesbarkeit.js` |
| Irgendetwas am Hub | `pruef-durchgang.js` **und** `pruef-hub-hand.js` |
| Irgendetwas am Board | `pruef-board.js` |
| Landingpage | `pruef-web.js` |
| Impressum, Datenschutz | `pruef-recht.js` |
| Marken-Studio | `pruef-studio.js`, `pruef-studio-hand.js` |
| Gastkonto, „Mein Tisch" | `pruef-gastkonto.js` |
| Figur, Bestellpass | `pruef-figur.js` |
| Texte, Sprachen | `pruef-sprache.js`, `pruef-texte.js` |
| Karten-Zerleger | `pruef-import.js` |
| Konto, Anfrageformular | `pruef-konto-start.js` |
| Meldungen, Service Worker | `pruef-push.js` |
| Auslieferung, Umleitungen | `erzeuger/bauen.js`, dann `pruef-lieferung.js` |
| Telefonweg | `pruef-alessia.js`, `pruef-telefonbon.js` |
| Rechte, Regeln, Funktionen | `datenbank/pruef-rechte.sql` im SQL-Editor |

```bash
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/<name>.js
```

## 6 · Startet die Prüfung überhaupt?

`node --check` und ein sauberer Start sind zweierlei. Drei Prüfungen
fielen monatelang mit ENOENT um, und in der Liste stand trotzdem
„läuft" (§8.2).

**Eine Prüfung ohne Ausgabe ist nicht grün, sondern tot.** Bei
ENOENT, leerer Ausgabe oder Abbruch: erst reparieren, dann weiter.

## 7 · Versionsparameter

Bei Änderungen an einer Datei, die der Service Worker
zwischenspeichert: `?v=…` am Skript hochzählen.

## 8 · Berichten

Nach CLAUDE.md §9: **erst der Befund, dann die Lösung.** Die echte
Ausgabe zeigen, nicht die Zusammenfassung davon. Gefundene eigene
Fehler gehören in den Bericht. Und dazu, was aufgefallen ist und
**nicht** angefasst wurde.
