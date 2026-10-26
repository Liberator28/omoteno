# Entwicklungsnachweis · Wie Omoteno entsteht und was daran menschlich ist

> **Zweck.** Rein KI-erzeugter Code ist in Deutschland vermutlich nicht urheberrechtlich geschützt; Schutz kommt in
> Betracht, wenn **menschlicher Einfluss den Output prägt** und das **nachweisbar** ist (Rechtsbericht
> `dokumente/recht/14-…`, § 2.1, Rechtsbericht R11). Bei einem Firmenverkauf, einer Beteiligung oder einem Streit mit
> einem Nachbauer fragt jede Prüfung danach. Dieses Dokument sammelt die **belegbaren Spuren** an einer Stelle.
>
> **Ehrliche Grenze.** Es ist kein Rechtsgutachten und beweist keinen Schutz. Die Abschnitte, die nur der Betreiber
> bestätigen kann, sind mit **[Betreiber ergänzt]** markiert und leer, bis er sie bestätigt hat. Zahlen sind am
> 26.10.2026 aus dem Verzeichnis gezählt, nicht geschätzt.

## 1 · Wer was tut

| Rolle | Wer | Was |
|---|---|---|
| Auftraggeber, Produktverantwortung | Elias Faber (Betreiber) | Idee, Anforderungen, Prioritäten, Abnahme; legt Preise, Pakete, Texte der Ansprache und die Rechtsfragen fest |
| Umsetzung im Gespräch | KI-Programmierwerkzeug (Claude Code) | schreibt und ändert Code nach den Vorgaben, führt die Prüfungen aus, berichtet |
| Prüfung | automatische Prüfungen im Verzeichnis (siehe 3) und der Betreiber am fertigen Ergebnis | jede Übergabe läuft durch die Liste aus `CLAUDE.md` § 8 |

**[Betreiber ergänzt]** — Welche Entscheidungen im Konzept stammen persönlich vom Betreiber (Zielgruppe, Aufbau
„Hub · Board · Küche“, Preisstaffel, Gestaltung der Figuren und Marken, Auswahl unter Alternativen)? Je konkreter und
mit Datum, desto besser belegbar.

## 2 · Menschliche Entscheidungen, die im Verzeichnis belegt sind

- **Entscheidungen mit Wortlaut** stehen in `dokumente/recht/11-offene-angaben.md` (A–D: Gerätekennung, Bestellknopf,
  Löschfristen, Rechtstexte) und in den Berichten unter `dokumente/`.
- **Abgelehnte und geänderte Vorschläge** stehen in den Vorfällen von `CLAUDE.md`: Jede Regel dort hat einen Vorfall,
  oft mit dem Satz, dass ein Vorschlag der KI falsch war (z. B. § 7: harte Sperre statt Markierung; § 9: „Widersprechen,
  wenn der Plan falsch ist“). Das ist die Spur einer Auswahl und Korrektur durch Menschen.
- **Gestaltungsentscheidungen** der Marken stehen als Markenblätter (`markenblaetter/*.json`) und in
  `dokumente/markenblatt.md`; die Palette, Figuren, Texte und Wortwahl je Haus wurden vom Betreiber bestimmt und vom
  Betreiber an Bildschirmfotos korrigiert (viele Vorfälle in `CLAUDE.md` beginnen mit „gemeldet vom Nutzer mit
  Bildschirmfoto“).

## 3 · Prüfung als Qualitätsnachweis (Haftung, nicht Urheberrecht)

Gezählt am 26.10.2026:

| Was | Anzahl |
|---|---|
| Prüfskripte (`pruefungen/pruef-*.js`, `.py`, `.sh`) | 165 |
| Datenbankproben (`datenbank/pruef-*.sql`, zurückgedreht) | 31 |
| Einträge im Git-Verlauf | 319 (erster Eintrag 25.09.2026) |
| Zeilen Arbeitsregeln (`CLAUDE.md`), jede mit Vorfall | 2 295 |

Zu jeder Prüfung gehört ein **Gegenbeweis**: Die Korrektur wird testweise zurückgenommen, die Prüfung muss rot werden
(`CLAUDE.md` § 8.1b, § 8.1g). Das belegt, dass die Prüfungen den Fehler wirklich finden können — und dass jemand sie
geschrieben hat, um bestimmte Fehler zu verhindern.

## 4 · Drittbestandteile und Lizenzen

- Bibliotheken: `auslieferung/lib/LIZENZEN.txt` (selbst ausgeliefert, mit Integritätsprüfung).
- Schriften: `auslieferung/schriften/LIZENZEN.txt` (OFL 1.1, Urheberzeile je Familie aus der Datei gelesen,
  `pruefungen/pruef-lizenzen.py`).
- Bewegte Emojis: `auslieferung/emoji/LIZENZEN.txt` (Animated Noto Emoji, CC BY 4.0).
- **Offen:** Ein Ähnlichkeits- und Lizenzscan des **erzeugten** Codes (KI kann Code erzeugen, der fremdem Code ähnelt,
  z. B. unter GPL) existiert nicht. Üblicher Weg: ein Lizenzscanner über das Verzeichnis, Ergebnis hier ablegen.
- **Offen:** Die Nutzungsbedingungen des KI-Anbieters (wem gehört der Output, Freistellung bei Rechtsverletzungen) sind
  nicht geprüft; sie gehören mit Datum in die Akte. **[Betreiber ergänzt]**

## 5 · Was bei einer Due Diligence gefragt wird — und wo die Antwort steht

| Frage | Antwort / Fundstelle |
|---|---|
| Wer hat den Code geschrieben? | Siehe 1; Git-Verlauf (`git log`) zeigt jede Änderung mit Zeit |
| Welche menschlichen Entscheidungen prägen das Produkt? | Siehe 2 und **[Betreiber ergänzt]** |
| Wie wird Qualität gesichert? | Siehe 3 |
| Welche fremden Bestandteile sind enthalten? | Siehe 4 |
| Wie wird der Schutz vertraglich ersetzt? | `seiten/agb.html` § 7 (Nutzungsrechte, Weitergabeverbot, Geheimhaltung) |
| Gibt es einen Urhebervermerk ohne Schutzbehauptung? | `dokumente/urhebervermerk.txt` |
