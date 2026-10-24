# Aufbau der Startseite aus Blöcken

Stand 24.10.2026. Für Wirte: Board → **Gast-Hub gestalten → Aufbau**. Für Entwickler: Spalte
`betriebe.hub_bloecke`, Hub-Funktionen `bloeckeSauber` / `bloeckeHTML`, Board-Block `AFB…`.

## Was ein Block ist

| Block | Was der Gast sieht | Breite | Größe |
|---|---|---|---|
| Kopf | Logo, Name, Slogan, Öffnungsstand | **fest oben**, kein Block | – |
| `schnell` | Ihre Auswahl, Karte, Foodroulette, Serviceruf, laufende Bestellung | ganz | klein, normal |
| `begleiter` | Figur des Hauses mit ihrem Satz | ganz / halb | klein, normal, groß |
| `aktion` | Top-Runner (laufende Aktionen) — nur wenn eine läuft | ganz | klein, normal, groß |
| `banner` | Wischbares Banner-Rad — nur mit Bannern | ganz | klein, normal, groß |
| `nochmal` | „Nochmal wie letztes Mal“ — nur für Wiederkehrer | ganz / halb | klein, normal, groß |
| `empfehlung` | Empfehlung des Hauses — nur wenn es eine gibt | ganz / halb | klein, normal, groß |
| `rubrik:<Name>` | eine Rubrik der Kacheln (Die Karte, Jetzt am Tisch …) | ganz | klein, normal, groß |
| `eigen-<kürzel>` | eigener Textblock: Titel, Text, Knopf, Aussehen Karte/Band | ganz / halb | klein, normal, groß |

Ein Block ohne Inhalt (kein Banner, keine Aktion) macht keine Fläche auf — auch wenn er in der Liste steht.

**Warum der Kopf kein Block ist.** Siegel, Schokoguss, Laternen und die feste Knopfzeile (Licht, Bestellart,
Sprache) hängen am oberen Rand der Seite. Ein Kopf mitten im Inhalt würde sie über Karten legen. Der Kopf wird
unter „Kopf & Logo“ und „Ihre Worte“ eingestellt; die Liste zeigt ihn als festen Eintrag mit Weg dorthin.

**Warum nicht jeder Block halb breit sein darf.** Bei 390 px ist eine halbe Spalte 172 px. Der Schnellzugriff
packt ohnehin zwei Felder in die Breite, Banner-Rad und Rubriken brauchen sie ganz. Die Liste nennt den Grund.
Zwei halbe Blöcke hintereinander teilen sich eine Reihe, ein einzelner halber steht ganz (wie im Kachelraster).

**Größe** ist ein Zoom der ganzen Hülle (klein 0,88 · groß 1,1). Der Block füllt weiter die Breite. Der
Schnellzugriff darf nicht größer werden: Bei 390 px bräche „Foodroulette“ mitten im Wort.

## Bedienung im Board

- **Griff** (⠿, 44 × 44 px) ziehen verschiebt einen Block. Nur der Griff zieht — der Rest der Zeile bleibt
  Fläche zum Rollen. Am Bildschirmrand rollt die Seite mit.
- Pfeiltasten am fokussierten Griff und „Nach oben/unten“ im geöffneten Block: derselbe Weg ohne Ziehen.
- **Schalter** rechts blendet einen Block aus. Eine ausgeblendete Rubrik nimmt dem Gast nicht den Weg zur Karte:
  der Schnellzugriff führt weiter dorthin.
- **Nichts wird markiert:** Liste und Griff haben `user-select: none`; während des Ziehens ist die ganze Seite
  unmarkierbar, eine begonnene Auswahl wird verworfen, das Menü des langen Drucks ist am Griff gesperrt.
  Eingabefelder bleiben markierbar.
- „**＋ Eigener Textblock**“: höchstens zehn. Der Text steht in allen Sprachen so, wie er geschrieben ist (er wird
  nicht übersetzt). Ziel des Knopfes: eine Seite des Hubs oder eine https-Adresse.
- Jede Änderung zeigt sich sofort in der Vorschau; Gäste sehen sie nach „Übernehmen“ (beim nächsten Öffnen).
- „Auf Vorgabe zurück“ + Übernehmen schreibt `null`. Dann gilt wieder die Reihenfolge von vorher.

## Daten

`betriebe.hub_bloecke jsonb` (`datenbank/migration-hub-bloecke.sql`, am 24.10.2026 eingespielt): Array, höchstens
40 Einträge, unter 10 kB. Lesen: `anon` (spaltenweise). Schreiben: `authenticated` — die vorhandene Wache
`betrieb_rolle_wache()` lässt nur den Inhaber an diese Spalte. Eintrag:
`{ id, an?, breite?, groesse?, titel?, text?, knopf?, ziel?, look? }` — nur Abweichungen vom Standard.

Was in die Seite geht, läuft durch `bloeckeSauber()` (geteilter Block, Hub und Board wortgleich): feste
Kennungen oder `rubrik:<Name>` (≤ 28 Zeichen, ohne `<>"'&` und Backtick) oder `eigen-<2–8 Zeichen>`; Text ohne `<>`,
`"` wird `”`; Ziel nur `#/seite` oder https ohne Leerzeichen und Anführungszeichen.

**Gemerkt im Gerät** (`omoteno-bloecke-<haus>`, nur das Geprüfte): Der zweite Besuch zeigt den Aufbau schon im
ersten Bild, auch ohne Netz — sonst sprängen die Blöcke nach dem Laden um.

## Ehrliche Grenzen

- **Vorführhaus** (Café Nordstern) und die Landingpage zeigen immer den Aufbau von vorher: Der Vorführmodus
  fragt die Datenbank nicht.
- **Hub-Projekte** (sichern/laden) sichern `hub_bloecke` **noch nicht** mit — `hub_projekt_sichern/_laden`
  kennen die Spalte nicht. Ein geladenes Projekt lässt den Aufbau also stehen.
- **Eigene Textblöcke werden nicht übersetzt.**
- Rubrik-Namen sind Teil der Kennung: Wird eine Rubrik umbenannt, zieht ihr Block mit (Platz bleibt), aber
  Kacheln **und** Aufbau müssen dann übernommen werden. Der Schalter in den Kacheln und der Aufbau sind zwei
  Speicherstände.
- Gilt ein eigener Aufbau, sind die ▲▼ der Rubriken in der Kachel-Anordnung gesperrt (eine Wahrheit).
- Nur in kopflosem Chromium gesehen, nicht auf einem Telefon.

## Prüfung

`node pruefungen/pruef-bloecke.js` (125 Proben, braucht `dist/`), `pruefungen/pruef-bloecke-lokal.sh`
(lokales Postgres: Rechte, Schranke, Wache, 16 Proben). Gegenbeweise im Worktree: 26 Sabotagen.
