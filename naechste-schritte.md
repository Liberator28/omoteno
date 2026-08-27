# Wo wir stehen · Auftrag für die Code-Sitzung

**Diese Datei ist der Übergabezettel.** Sie sagt einer neuen
Claude-Code-Sitzung, was fertig ist und was als Nächstes ansteht —
damit im Chat keine Tokens für Wiederholung draufgehen.

---

## Fertig und geprüft

| Bereich | Stand |
|---|---|
| Küchendisplay | Servicerufe raus, Flackern behoben, Spur je Gericht |
| Admin-Board | Regler vereinheitlicht, Suchfelder, Kategorie-Sortierung, Allergen-Auswahl, Karten-Import, Spurwahl |
| Gäste-Hub | Tagesnummer, Bestellpass, Empfehlung mit Direktsprung, Originalname bei fremder Schrift, Tischsitzung |
| Marken-Studio | Fertig, mit Entwurfslink |
| Erzeuger | `erzeuger/erzeuge-hub.js` — Hub aus Vorlage + Markenblatt |
| Konto | Registrierung, Login, Markenblatt, Rechnungen, Vertrag |
| Webseite | `omoteno-web.html` — Gegenstand auf dem Sockel, Demo-Hub im Fenster |

Alle Prüfskripte laufen sauber. Siehe `CLAUDE.md`.

---

## Zuletzt gemacht · Landingpage

- **Sockel neu gesetzt.** Gegenstand und Schlagzeile stehen
  nebeneinander statt untereinander; die Rufe („Zwei Wochen testen",
  „Demo-Hub öffnen") stehen im ersten Bild statt darunter.
- **Demo-Hub im Fenster.** Das Antippen des Untersetzers öffnet den
  Gast-Hub mit Beispieldaten: Karte, Korb, Bestellpass mit
  dreistelliger Nummer, laufende Schritte, Servicerufe. Zu erreichen
  über den Untersetzer, die Kopfleiste, die Markenschau und das
  Kolophon — jedes Element mit `data-hub` öffnet ihn.
- **Häuser sind eine Quelle.** `HAEUSER` steht jetzt vor den Kapseln;
  Markenschau und Fenster hören auf dasselbe Ereignis `hauswahl`.
- **Gequetschtes behoben:** Kopf und Szene im Durchgang überlappten
  auf dem Telefon (absolut über mittig gesetzt), die Uhr zeigte
  „+4:60", die Farbtupfer der Häuser standen untereinander, der
  Empfehlungspreis der Markenschau war fest verdrahtet.

**Offen an der Webseite:** Der Demo-Hub ist eine Nachbildung, kein
erzeugter Hub. Sobald ein Betrieb als Schaufenster erzeugt ist
(`demo.omoteno.de`), gehört daneben ein Verweis „echten Hub öffnen" —
die Nachbildung bleibt als schnelle Vorschau bestehen.

---

## Als Nächstes — in dieser Reihenfolge

### 1 · Erzeugen automatisieren
Heute ist der Erzeuger ein Befehl, den ein Mensch auslöst. Solange das
so ist, kostet jeder Neukunde und jede Markenänderung Handarbeit.

**Auftrag:** Eine GitHub-Aktion, die täglich (und auf Zuruf) alle
Betriebe aus `betriebe.markenblatt` zieht, `markenblaetter/<slug>.json`
schreibt, erzeugt und nach Netlify legt. Danach `betriebe.erzeugt_am`
setzen. Zugangsdaten als Repository-Geheimnisse.

### 2 · Anmeldeseite und Formular auf das neue System
`konto.html` und `start.html` benutzen noch die alte Papier-Palette
ohne die neuen Schriften. Sie müssen auf `omoteno-web.html` angeglichen
werden: Instrument Serif / Instrument Sans / JetBrains Mono, dieselben
Farbrollen, magnetische Knöpfe.

**Wichtig:** Farbwerte nicht raten — die geprüften Werte stehen im
`:root` von `omoteno-web.html`, jeder mit Kontrastwert im Kommentar.

### 3 · Der Assistent (Tarif „Assistent", 59 €)
Auf der Webseite beworben, noch nicht gebaut:
- Karte aus Foto oder PDF einlesen (der Zerleger dafür existiert
  bereits in `omoteno-admin.html`, Funktion `impZerlegen`)
- Fragen an die eigenen Zahlen im Klartext
- Allergene vorschlagen

### 4 · Alessia — noch nicht anfassen
Auf der Webseite ausdrücklich als „In Vorbereitung" gekennzeichnet,
mit Warteliste statt Kaufknopf. **Nicht als buchbar darstellen,
solange sie nicht läuft.**

---

## Regeln für jede Sitzung

1. `CLAUDE.md` lesen. Sie steht im Wurzelverzeichnis und sammelt
   Fehler, die in diesem Projekt schon einmal live gegangen sind.
2. Vor jeder Übergabe:
   ```
   node erzeuger/erzeuge-hub.js --alle --pruefen-nur
   python3 pruefungen/pruef-datei.py <datei>
   node pruefungen/pruef-ueberlauf.js <datei>
   node pruefungen/pruef-uebergabe.js
   ```
3. `dist/` nie von Hand bearbeiten — wird erzeugt.
4. Am Ende: „Sichere die Änderungen mit Commit und Push."
