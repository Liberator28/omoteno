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

- **Der Untersetzer ist ein Körper.** Kein Bild einer Scheibe mehr,
  sondern zwei Flächen und dreißig Randsegmente, die den Zylinder
  ergeben — beim Aufsteller vier Kanten am Rechteck. Er dreht sich
  langsam, beim Antippen läuft die Drehung aus, er richtet sich auf
  und fährt heran; erst wenn er steht, öffnet sich der Hub. Ohne
  Bibliothek, ohne Modellformat: CSS-Transformationen und Web
  Animations.

- **Das Markenblatt trägt jetzt den Inhalt.** Name, Anschrift,
  Telefon, Öffnungszeiten, Links, WLAN, Trinkgeld, Empfehlungen und
  der Avatar kommen aus `markenblaetter/<slug>.json`, nicht mehr aus
  dem Gerüst. Der Erzeuger meldet, was fehlt.
- **Hub: Willkommensschirm und Begleiter.** Drei Sekunden beim
  Öffnen, einmal je Sitzung; die Figur meldet sich auf der
  Startseite, nach der Bestellung und beim Bewerten. Drei Züge im
  Markenblatt: freundlich, ruhig, witzig.
- **Top-Runner.** Tabelle `aktionen` mit Regeln, die dem Gast nur
  Laufendes zeigen. Im Board über der Karte anlegen und beenden, im
  Hub als Band auf Startseite und Karte — und als Einblendung, wenn
  die Aktion während des Besuchs anfängt.

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

### 0 · Was du einmal einrichten musst

**Google-Anmeldung freischalten.** Der Knopf steht im Konto und
funktioniert, sobald diese drei Dinge stehen. Ohne sie sagt die Seite
im Klartext, dass es noch nicht geht — sie zeigt keinen Fehlercode.

1. **Google Cloud Console** → APIs & Dienste → Anmeldedaten →
   *OAuth-Client-ID erstellen* → Anwendungstyp **Webanwendung**.
   - Autorisierte JavaScript-Quellen: `https://omoteno.de`
   - Autorisierter Weiterleitungs-URI:
     `https://quxwweuvdqtjsdwgjdrh.supabase.co/auth/v1/callback`
2. **Supabase** → Authentication → Providers → **Google** einschalten,
   Client-ID und Client-Secret eintragen, speichern.
3. **Supabase** → Authentication → URL Configuration →
   *Site URL* `https://omoteno.de`, unter *Redirect URLs* zusätzlich
   `https://omoteno.de/konto.html` eintragen.

Danach einmal auf `omoteno.de/konto.html` prüfen: Knopf drücken,
Google-Auswahl erscheint, zurück im Konto steht der Betriebsschritt.

---

### 2 · Anmeldeseite und Formular auf das neue System
**`konto.html` ist umgestellt.** Palette, Schriften und Knöpfe kommen
jetzt aus demselben `:root` wie die Webseite — Werte übernommen, nicht
geschätzt; die Bedeutungsfarben (warn, gut, gold) sind neu gerechnet,
weil sie als Schrift auf getönten Flächen stehen. Überschriften in
Instrument Serif, Beschriftungen und Beträge in JetBrains Mono,
magnetische Knöpfe, Korn wie auf der Webseite.

**`start.html` fehlt in diesem Verzeichnis.** Die Landingpage verweist
darauf („Lieber erst reden"). Sobald die Datei hier liegt, bekommt sie
dieselbe Behandlung — angelegt wurde sie bewusst nicht, um eine
vorhandene Fassung nicht zu überschreiben.

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
