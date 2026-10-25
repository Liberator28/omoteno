# Beilagen und Extras je Gericht

Stand 24.10.2026. Für Wirte: Board → **Karte → Gericht öffnen → Mehr Angaben → „Beilagen & Extras dieses
Gerichts“**. Für Entwickler: Gruppen liegen in `betriebe.optionen` unter `g-<8 Zeichen der Gericht-id>-<Name>`,
das Gericht zeigt mit `gerichte.opt` darauf.

## Was der Wirt einstellt

- **Überschrift** der Gruppe (frei, 40 Zeichen): „Beilage zur Wahl“, „Extras dazu“, „Soße“ …
- **Wahl:** *mehrere* (Häkchen) oder *genau eine* (Auswahlpunkt). Knöpfe „＋ Beilage (genau eine)“ und
  „＋ Extras (mehrere)“ legen die Gruppe mit passender Vorgabe an; der Titel ist änderbar.
- **Zutaten** mit Name und **Aufpreis** in Euro (Komma geht: „1,50“; leer = ohne Aufpreis).
- **Vorschlag** je Zutat: Der Gast findet sie schon gewählt (mit dem Etikett „Vorschlag“) und ändert sie mit einem
  Tipp. Bei *genau eine* kann nur eine Zutat der Vorschlag sein; der Tipp auf eine andere nimmt die erste heraus.
- Hinweis für Gäste (freiwillig, 120 Zeichen).
- Höchstens **6 Gruppen je Gericht**, 40 Zutaten je Gruppe.
- Die **gemeinsamen** Gruppen des Hauses (Einstellungen → „Extras & Beläge“) bleiben, wie sie waren — dort legt man
  etwas an, das an mehreren Gerichten hängt (z. B. Pizzabeläge). Beides lässt sich an einem Gericht mischen.

## Was der Gast sieht

Die Karte des Gerichts zeigt die Gruppen in der Reihenfolge von `gerichte.opt`. Ungetippt zählen die Vorschläge:
Aufpreis, Zeile auf dem Bon und Summe im Korb tragen sie. Sobald der Gast **eine Gruppe** anfasst, gilt seine
Wahl für diese Gruppe — auch eine leere (er nimmt „Speck“ heraus: es bleibt aus). Das Etikett verschwindet dann
in dieser Gruppe. Die Wahl übersteht ein Neuladen.

## Der Server rechnet nach

`positionen_pruefen` nimmt aus der Bestellung nur den Namen („Burger (Salat · Speck)“) und rechnet den Preis aus
`gerichte.preis` plus den Aufpreisen der Gruppen, die an **diesem** Gericht hängen. Derselbe Name an einem anderen
Gericht kostet dort sein eigenes Geld; ein vom Gast geschickter Betrag zählt nicht. Der Vorschlag selbst ändert
am Server nichts — er rechnet, was bestellt wurde.

## Speichern

Reihenfolge: **erst die Gruppen** (`betriebe.optionen`), **dann das Gericht**. Eine Gruppe ohne Gericht ist
unsichtbar; ein Gericht mit Verweis ins Leere wäre es nicht. Ein neues Gericht bekommt seine `id` vorab (die
Schlüssel brauchen sie). Vor dem Schreiben liest das Board die Spalte **frisch** — die Gruppe, die ein anderes
Gerät inzwischen angelegt hat, bleibt stehen. Wurde im Blatt nichts an den Gruppen angefasst, wird `optionen`
**nicht** geschrieben. Liefert die Datenbank „0 Zeilen getroffen“ (die Regel hat verweigert), steht dort
„Nur der Besitzer …“ und das Gericht wird nicht ohne seine Gruppen angelegt.

- **Kopie** legt die Gruppen unter der neuen id neu an (Zutaten und Preise wie das Original).
- **Löschen** räumt die Gruppen des Gerichts mit auf (ein Fehlschlag dort ist harmlos: eine Gruppe ohne Gericht
  ist unsichtbar).
- Der Haus-Editor „Extras & Beläge“ zeigt die Gruppen einzelner Gerichte **nicht** und lässt sie beim Übernehmen
  stehen.

## Grenzen (Datenbank, `datenbank/migration-extras-je-gericht.sql`, am 24.10.2026 eingespielt)

`optionen_form_ok`: höchstens **60 Gruppen** und 40 000 Bytes zusammen (vorher 12 und 8 000), je Zeile optional
`vor` (boolean). Jede Form, die vorher gültig war, ist es weiter (Differenztest `pruefungen/pruef-extras-lokal.sh`).
Das Board prüft vorher mit denselben Zahlen und nennt sie im Satz. Bei großen Karten gilt: **60 Gruppen für das
ganze Haus** — ein Haus mit 100 Gerichten, die alle eine eigene Gruppe brauchen, stößt daran. Dann gehört
gemeinsam genutztes in die gemeinsamen Gruppen (ein Eintrag für viele Gerichte).

## Nicht enthalten (ehrlich)

- Titel, Zutaten und Hinweise dieser Gruppen werden **nicht übersetzt** (nur „Vorschlag“ ist in elf Sprachen
  hinterlegt). Wie bei den gemeinsamen Gruppen steht dort, was der Wirt geschrieben hat.
- Der Entwurf-Zwischenspeicher des Gericht-Blatts (`entwurfSchreiben`) sichert die Extras-Gruppen **nicht**; bricht
  der Wirt ab, sind sie weg.
- Hub-Projekte („sichern, laden“) enthalten `optionen` nicht.
- Eine Gruppe „genau eine“ mit Vorschlag ist immer Pflicht (der Gast kann die Wahl ändern, nicht leeren).
- Nie gegen die echte Live-Datenbank mit einem echten Konto gelaufen; Board und Hub nur im kopflosen Chromium.

## Prüfungen

`pruefungen/pruef-extras-gericht.js` (Hub → Board → Naht), `pruefungen/pruef-extras-lokal.sh` (Schranke alt/neu,
echte `positionen_pruefen`), `pruefungen/pruef-pizza-rund.js` (gemeinsame Gruppen).
