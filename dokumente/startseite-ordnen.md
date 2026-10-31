# Startseite live ordnen (Gast-Hub gestalten → Kacheln → „Ordnen starten“)

Wunsch vom 25.10.2026: „Man kann noch immer nicht per Drag and drop die Felder einstellen. Es soll unter Kacheln als neue
Funktion dienen anstatt der alten: Alle Kacheln und Flächen wie Blöcke verschieben können, live in der Ansicht vom Hub, und beim
Drauftippen kann man es dann bearbeiten.“

## Was es gibt

| Teil | Wo | Was |
|---|---|---|
| „Ordnen starten“ | Board, Gast-Hub gestalten → Kacheln (nur Besitzer) | Die Vorschau wird zur Arbeitsfläche: größer, alle Rubriken offen, jede **Fläche** (Schnellzugriff, Begleiter, Empfehlung, Banner, Rubriken, eigene Textblöcke) trägt ein Namensschild, jede **Kachel** einen Rand. |
| Ziehen | Hub-Vorschau | Maus: nach 6 px Zug. Finger: erst nach 260 ms Halten (vorher rollt die Vorschau); danach rollt nichts mehr mit. Am oberen/unteren Rand rollt die Vorschau von selbst. Die anderen Stücke rücken nach (nur `transform`). |
| Kachel in andere Rubrik | Hub-Vorschau | Eine Kachel kann in eine **andere** Rubrik gezogen werden (sie bekommt deren Namen als `gruppe`). Rubriken zerfallen nie (`kbRubrikenZusammenhalten`). |
| Tippen | Hub-Vorschau | Ein Halten ohne Zug (< 8 px) ist ein Tipp: Das Board öffnet die Einstellungen **genau dieses Stücks** (Kachel → Zeile der Kacheln, Fläche → Zeile im Aufbau). Der Hub navigiert dabei nicht. |
| „Ordnung übernehmen“ | Board | Schreibt beide Stände: `hub_bloecke` (Aufbau) **und** `hub_kacheln` (Kacheln samt Rubrik). Vorher wird nichts geschrieben. |
| Alte Anordnung | `<details id="loAlt">` darunter | Bleibt, eingeklappt, als Weg ohne Zeiger (Pfeiltasten, Knöpfe). |

## Wie die zwei Dateien zusammenarbeiten

Der Hub (`vorschauOrdnen`, `ordnenAblegen`) ordnet nur **sein eigenes Abbild** um und meldet das Ergebnis an das Board
(`window.parent.vorschauOrdnenFertig(art, nutzlast)` / `vorschauOrdnenTipp(art, id, gruppe)`). Das Board bildet es auf seine
Stände ab (`loBloeckeSetzen`, `loKachelSetzen`) und schickt die Vorschau neu. Geschrieben wird ausschließlich im Board.

- Was im Hub nicht zu sehen ist (ausgeblendet, ohne Inhalt), behält seinen Platz hinter dem sichtbaren Vorgänger — nichts
  verschwindet, weil es nicht zu sehen war (CLAUDE.md §7).
- Die Rubrik einer Kachel steht an ihrem Bereich (`data-sb-auf`) — keine zweite Kennung im Auszeichnungstext.

## Fund beim Bau

Eine Kachel ist ein `<a href>`: Mit der Maus beginnt der Browser sein **eigenes** Ziehen und bricht den Zeiger ab
(`pointercancel`). Flächen ließen sich ziehen, Kacheln nie — ohne Fehlermeldung. Behoben mit `dragstart` →
`preventDefault()` (Fangphase) und `-webkit-user-drag:none` (CLAUDE.md §4.6).

## Prüfung

`pruefungen/pruef-ordnen.js` — echtes Board, echte Hub-Datei als Rahmen (Blend, Chocolamour), echte Zeiger; siehe Tabelle in
CLAUDE.md §8.2. Die Altprüfungen der Anordnung (`pruef-kachelraster`, `pruef-rubriken`, `pruef-bloecke`) laufen weiter.

## Ehrliche Grenzen

- Nur kopfloses Chromium; auf einem iPhone nicht gesehen. Das lange Drücken auf einem Link (iOS-Linkvorschau) ist durch
  `-webkit-touch-callout:none` und `contextmenu` verhindert, aber nicht beobachtet.
- Das Vorführhaus schreibt nicht; die Nutzlast ist gegen ein gestelltes `db` gemessen, nicht gegen die Live-Datenbank.
- Textblöcke und Rubriknamen werden nicht übersetzt.
