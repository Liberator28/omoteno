# Anleitung: Tour und Wiki (Gast-Hub und Board)

Wunsch vom 25.10.2026: ein Tutorial-Modus im Gast-Hub und im Board — Schritt für Schritt durch alle Funktionen, oben der Bereich, in
dem man gerade ist, Wischen zwischen den Bereichen, direkt in der Seite mit Hervorhebung und einer Vorführung der Geste; im Hub ein
schwebender Knopf beim ersten Besuch; im Board zusätzlich ein Wiki unter Einstellungen.

## Was es gibt

| Teil | Wo | Was |
|---|---|---|
| Maschine | Block `TOUR` in `vorlagen/hub.vorlage.html` **und** `seiten/admin.html` (wortgleich, `pruef-tour.js` vergleicht) | Schleier mit Loch über dem echten Element, Bereichsleiste oben, Karte mit Titel/Text/Schritt, Hand-Vorführung (`tippen`, `wischen`, `wischen-hoch`, `halten`), Wischen/Pfeiltasten/Escape. Stil entsteht im Block, die Seite liefert sechs Farbrollen am Element `#tourWurzel` (`--tour-karte`, `-schrift`, `-leise`, `-akzent`, `-akzent-schrift`, `-linie`). |
| Hub | `tourDef()`, `tourStarten()`, `tourPilleAbgleichen()` in der Vorlage | Bereiche: Start · Speisekarte · Ihre Auswahl · Foodroulette (nur wenn das Haus sie hat) · Am Tisch (nur mit Serviceruf/„Mein Tisch“) · Bestellung. Sätze im Wörterbuch `TEXTE`, elf Sprachen. |
| Hub, Einstieg | schwebender Knopf `#tourPille`; Knopf „Anleitung“ auf der Haus-Seite (Logo antippen) | Knopf nur auf Start und Speisekarte, solange nie angetippt/ausgeblendet. **Gemerkt wird erst nach dieser Handlung** (`omoteno-tour-<Haus>`, § 25 TDDDG); das Vorführhaus merkt nichts. |
| Board | `boardTourDef()`, `boardTourStarten()` | Bereiche: Bestellungen · Karte · Verfügbar · Tische · Zahlen · Ausgabe · Gast-Hub · Einstellungen · Einkauf. Deutsch, kein Wörterbuch. |
| Board, Wiki | Gruppe „Anleitung“ unter Einstellungen (`#anGruppe`), Daten `AN_WIKI` | Abschnitte nach Kapiteln, durchsuchbar, aufklappbar; „Im Board zeigen“ startet die Tour im Bereich, „Dorthin springen“ öffnet die Gruppe bzw. den Reiter. Unter „Mehr“ gibt es zusätzlich den Eintrag „Anleitung“. |

## Wer etwas am Board ändert

Jeder Eintrag in `AN_WIKI` trägt `labels`: die Beschriftungen, auf die sich der Text beruft („Pausieren“, „Karte aktiv“ …).
`pruefungen/pruef-tour-board.js` hält jede gegen das Board (Quelltext von `admin.html`, `kueche.html`, `einkauf.html`, ohne die
Wiki-Daten selbst) — **ein umbenannter Knopf macht die Prüfung rot, bevor die Anleitung still falsch wird**. Dasselbe für jede
Gruppe, auf die ein Eintrag zeigt (`gruppe:`), und jede Gruppe der Einstellungen / des Gast-Hubs: Sie braucht einen erklärenden
Abschnitt (Ausnahmen stehen namentlich in der Prüfung). Neue Gruppe → neuer Eintrag; neuer Reiter → neuer Bereich in
`boardTourDef()`.

Wer im Hub einen Satz der Tour ändert, ändert den Schlüssel in `TEXTE` mit (die Sätze der Tour sind die deutschen Schlüssel);
`pruef-tour.js` prüft, dass jeder Satz alle elf Sprachen hat und dass Sätze, die Knöpfe nennen, den Namen tragen, der in der
Sprache auf dem Knopf steht.

## Ehrliche Grenzen

- Kopfloses Chromium, kein Gerät: Wischen ist mit Maus und CDP-Finger gemessen, nicht auf einem iPhone.
- Die Vorführung ist eine Zeichnung der Geste, keine Aufzeichnung.
- Das Board ist nur im Vorführmodus (gestellte Beispieldaten) geprüft; die Tour bedient nichts, was Daten schreibt.
- Texte des Wikis stammen aus den Hinweistexten des Boards und dem Quelltext; was dort nicht steht, steht auch hier nicht.
