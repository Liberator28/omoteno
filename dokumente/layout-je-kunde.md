# Layout je Kunde (App-Stil) — `startstil` und `startlayout`

Stand 24.10.2026. Für den Betreiber: wie ein Haus seinen eigenen Zuschnitt der Gast-Seite bekommt. Alles steht
im Markenblatt des Hauses (`markenblaetter/<slug>.json`) — nie im erzeugten Hub (`dist/` wird nicht bearbeitet).

## Zwei Schalter

```json
"startstil": "premium",
"startlayout": { "profil": "bistro", "ecken": "eckig" }
```

- `startstil: "premium"` schaltet den App-Stil ein: Foto-Kopf, Bestell­art-Chips, Bildkarten, Auswahl-Leiste,
  Hauptnavigation, Speisekarte mit Kopfkarte, Suche als Pille und Produktkarten. Ohne das Feld bleibt der Hub
  **Zeichen für Zeichen** wie vorher.
- `startlayout` stellt den Zuschnitt dieses Stils je Haus ein. Es wirkt **nur** mit `startstil: "premium"`
  (der Erzeuger lehnt es sonst ab, damit nichts still wirkungslos bleibt). Fehlt es, sieht das Haus den Zuschnitt,
  den es vorher hatte (= Profil `standard`).

## Profile — Vorbelegungen, die du einzeln überschreiben kannst

| Profil | Charakter | ecken | kopf | wege | produktbild | dichte | chips | navigation |
|---|---|---|---|---|---|---|---|---|
| `standard` | wie bisher (Choco) | rund | hoch | bild | links | luftig | an | leiste |
| `bistro` | kompakter, weicher Rand, Foto rechts | weich | kompakt | kompakt | rechts | dicht | an | leiste |
| `cafe` | großzügig, großes Foto über dem Text | rund | hoch | bild | oben | luftig | an | leiste |
| `bar` | eckig und dicht, Getränke ohne Fotos | eckig | kompakt | kompakt | aus | dicht | an | schlank |

Ein Regler im Markenblatt schlägt das Profil: `{ "profil": "bistro", "ecken": "rund" }` ist Bistro mit runden Ecken.

## Die sieben Regler

| Regler | Werte | Wirkung |
|---|---|---|
| `ecken` | `rund` · `weich` · `eckig` | Rundung der Karten, Chips, Suche, Kategorien (22/14/6 px) |
| `kopf` | `hoch` · `kompakt` | Höhe des Foto-Kopfs auf der Startseite, Logo 104 → 76 px |
| `wege` | `bild` · `kompakt` | Höhe der Bildfläche der vier Wege-Karten (≈ 100 → 64 px) |
| `produktbild` | `links` · `rechts` · `oben` · `aus` | Foto der Gerichte; bei `aus` werden die Fotos nicht geladen |
| `dichte` | `luftig` · `dicht` | Polster/Abstand der Gericht-Karten, Bild 96 → 76 px |
| `chips` | `an` · `aus` | Bestellart-Chips unter dem Slogan; bei `aus` ist der klassische Schalter oben rechts wieder da |
| `navigation` | `leiste` · `schlank` · `aus` | untere Hauptnavigation; `schlank` nur Zeichen (Name bleibt für Vorleser), `aus` keine Leiste |

Farben ändert das Layout **nie**: Sie kommen aus den Rollen des Markenblatts (`farben`, `abend`), damit Schrift
auf jeder Hausfarbe lesbar bleibt (CLAUDE.md §5.1).

## Prüfen

```bash
node erzeuger/erzeuge-hub.js <slug> --pruefen-nur      # lehnt Tippfehler laut ab, schreibt nichts
node erzeuger/erzeuge-hub.js <slug>                    # erzeugen
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-startlayout.js
```

Ein Tippfehler („Bistro“ statt `bistro`, „zackig“) wird vom Erzeuger mit dem erlaubten Wertebereich abgelehnt.
Ein ungültiger Wert, der trotzdem im Hub ankäme, setzt nie ein Attribut (Positivliste im Hub).

## Grenzen

- Der Wirt stellt das Layout **nicht** selbst im Board ein; es ist Sache des Betreibers (Markenblatt).
- Gemessen im kopflosen Chromium mit neutralen Testbildern, nicht auf einem Gerät.
- Die Stile der Speisekarte „Bühne“, „Raster“, „Flink“ behalten ihr eigenes Bild; `produktbild`/`dichte` wirken
  auf den Stil „Liste“.
