# Omoteno

Digitales Gästeerlebnis am Tisch. Untersetzer oder Aufsteller
antippen, Karte öffnet sich, Bestellung landet im Board und in der
Küche.

---

## Wie dieses Verzeichnis funktioniert

Der wichtigste Satz zuerst:

> **Hub-Dateien werden nicht bearbeitet, sondern erzeugt.**

```
vorlagen/hub.vorlage.html      das Gerüst — einmal gepflegt, für alle
markenblaetter/<slug>.json     was diesen einen Kunden ausmacht
        │
        ├── erzeuger/erzeuge-hub.js
        ▼
dist/<slug>/index.html         wird hochgeladen, nie bearbeitet
```

Vorher stand das Markenblatt nur in der ausgelieferten Datei und
wurde von Hand gepflegt. Damit kostete jeder Neukunde Handarbeit —
und eine Testversion, eine Selbstregistrierung oder auch nur zwanzig
Kunden waren unmöglich. Das war die Decke über allem.

`dist/` ist bewusst **nicht** eingecheckt. Was erzeugt werden kann,
gehört nicht in die Versionsgeschichte; sonst zeigt jeder Diff
tausende Zeilen, die niemand gelesen hat.

---

## Welche Datei liegt wo

Sechs Flächen, ein System. Wer wissen will, was er gerade bearbeitet,
liest diese Tabelle zuerst.

| Quelle | Adresse | Wer benutzt sie |
|---|---|---|
| `seiten/omoteno-web.html` | `omoteno.de` | Der Wirt, bevor er Kunde ist |
| `seiten/konto.html` | `omoteno.de/konto.html` | Der Kunde: Vertrag, Rechnungen, Zugänge |
| `seiten/start.html` | `omoteno.de/start.html` | Wer lieber redet als klickt — Formular für die Einrichtung |
| `seiten/marken-studio.html` | `omoteno.de/marken-studio.html` | Der Kunde, wenn er seinen Hub gestaltet |
| `seiten/admin.html` | `omoteno.de/admin` | Der Betrieb: Bestellungen, Karte, Auswertung |
| `seiten/kueche.html` | `omoteno.de/kueche` | Die Küche und die Theke am Pass |
| `vorlagen/hub.vorlage.html` → `dist/<slug>/index.html` | `<slug>.omoteno.de` | Der Gast am Tisch |

Links steht, wo die Datei **liegt**, rechts, unter welcher Adresse sie
ankommt. Beides hat nichts miteinander zu tun: Die Quellen liegen in
Ordnern, der veröffentlichte Ordner ist flach. `erzeuger/bauen.js`
legt das eine auf das andere.

```
seiten/          was ausgeliefert wird
vorlagen/        hub.vorlage.html
markenblaetter/  chocolamour.json, blend.json
erzeuger/        erzeuge-hub.js, bauen.js
pruefungen/      alle pruef-*
auslieferung/    _headers, _redirects
datenbank/       migration-*.sql
dokumente/       ANLEITUNG, deployen, markenblatt, …
```

In der Wurzel bleiben `README.md`, `CLAUDE.md`, `.gitignore` und
`netlify.toml` — letztere, weil Netlify sie **nur** dort liest.

**Die Farbrollen und Schriften stehen im `:root` von
`seiten/omoteno-web.html`.** Das ist die Quelle; alle anderen Dateien tragen
denselben Block mit demselben Kommentar. Kopiert, nicht geladen — es
gibt bewusst kein Bauwerkzeug.

---

## Die drei Befehle

```bash
# Alle Markenblätter prüfen, ohne etwas zu schreiben
node erzeuger/erzeuge-hub.js --alle --pruefen-nur

# Einen Kunden erzeugen
node erzeuger/erzeuge-hub.js chocolamour

# Alle erzeugen
node erzeuger/erzeuge-hub.js --alle
```

Danach immer:

```bash
python3 pruefungen/pruef-datei.py dist/chocolamour/index.html
```

Keine Abhängigkeiten. Kein `npm install`, kein Bauwerkzeug. Node und
Python3, mehr braucht es nicht — das ist Absicht und soll so bleiben.

Der Erzeuger findet seine Dateien in **beiden** Formen: in der
Ordnerform (`vorlagen/`, `markenblaetter/`) und flach neben sich, wenn
alles in einem Verzeichnis liegt. Wer vom iPhone aus arbeitet, lädt
flach hoch — derselbe Befehl läuft dann ohne Umbau. Er sucht die
Ordnerform zuerst und nimmt sonst, was neben ihm liegt.

---

## Was der Erzeuger prüft

**Fehler — es wird nichts geschrieben:**
fehlende Pflichtfarben, ungültige Hexwerte, unbekannte Schrift- oder
Schattenkennung, Abendfarben ohne Abendvariante, Schriftgröße außer
Rand, kein einziger eingeschalteter Bereich, Slug mit unerlaubten
Zeichen.

**Hinweis — es wird erzeugt und gemeldet:**
Kontrast unter 4,5:1 bei Schrift auf Grund, Nebentext auf Karte,
Schrift im Kopfband, Hauptfarbe auf Karte — jeweils für Tag und
Abend. Bewusst kein Fehler: Es gibt Fälle, in denen ein Betrieb seine
Hausfarbe trotzdem will.

---

## Ein neuer Kunde

1. `markenblaetter/<slug>.json` anlegen — am schnellsten im
   Marken-Studio einstellen und den Entwurfslink schicken.
2. `node erzeuger/erzeuge-hub.js <slug>` — Hinweise lesen.
3. Zeile in `betriebe` anlegen, `markenblatt` als jsonb setzen.
4. `dist/<slug>/index.html` auf `<slug>.omoteno.de` hochladen.
5. Tischschlüssel erzeugen, Untersetzer und Aufsteller in Druck.

---

## Verzeichnis

| Ordner | Inhalt |
|---|---|
| `vorlagen/` | Hub-Gerüst mit `/*{{MARKENBLATT}}*/` als Platzhalter |
| `markenblaetter/` | ein JSON je Kunde |
| `erzeuger/` | `erzeuger/erzeuge-hub.js` |
| `pruefungen/` | die Prüfskripte, siehe `CLAUDE.md` |
| `dokumente/` | Markenblatt-Schema, Wettbewerbsanalyse |
| `CLAUDE.md` | **Arbeitsregeln — wird von jeder Claude-Sitzung gelesen** |

---

## Arbeiten vom iPhone oder iPad

Claude Code hat keine eigene Mobil-App. Cloud-Sitzungen und
Fernsteuerung stecken im **Code-Reiter der Claude-App**.

Der Unterschied, auf den es ankommt:

| Weg | Läuft wo | Braucht einen Mac? |
|---|---|---|
| **Cloud-Sitzung** | in der Cloud | **nein** |
| Fernsteuerung | auf deinem Rechner | ja, muss wach sein |
| Dispatch | auf deinem Mac | ja, nur macOS |

Ohne Mac ist die **Cloud-Sitzung** der einzige Weg, der trägt. Sie
läuft weiter, wenn du das Telefon weglegst.

### Einrichtung, einmalig

1. Auf github.com ein privates Verzeichnis `omoteno` anlegen —
   geht im Browser, ohne Rechner.
2. Diesen Ordner hochladen (im Browser: *Add file → Upload files*,
   oder in Working Copy auf dem iPad).
3. In der Claude-App: **Code → neue Sitzung → Verzeichnis wählen**.
4. Prüfen, dass `CLAUDE.md` gelesen wird: „Fasse mir die
   Arbeitsregeln in drei Sätzen zusammen."

### Danach

> „Bau Block X. Halte dich an CLAUDE.md. Lass die Prüfungen laufen
> und zeig mir das Ergebnis, bevor du zusammenführst."

Die Prüfung in `.github/workflows/pruefung.yml` läuft bei jedem Push
mit. Was dort rot wird, kommt nicht in die Hauptlinie.

**Ehrlich dazu:** Das ersetzt nicht das Denken, sondern das Tippen.
Die Blöcke bleiben der Flaschenhals — und das ist gut so. Genau da
entstehen sonst die stillen Fehler, die in `CLAUDE.md` stehen.

---

## Rechtliches

© 2026 Elias Faber · Ringstraße 12 · 35260 Stadtallendorf
hallo@omoteno.de

Diese Software wird Kunden ausschließlich zur Nutzung im Rahmen
eines laufenden Vertrages überlassen. Vervielfältigung, Weitergabe,
Veröffentlichung, Bearbeitung sowie der Betrieb auf anderen Domains
als den freigegebenen sind ohne schriftliche Zustimmung nicht
gestattet.
