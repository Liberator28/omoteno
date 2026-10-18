# Technische To-do-Liste · Recht

Jede Zeile verweist auf den Befund in `01-risikoanalyse.md`. Reihenfolge =
Dringlichkeit. Jede Änderung bekommt ihre Prüfung und ihren Gegenbeweis
(CLAUDE.md §8.1b) — die Spalte „Prüfung" sagt, welche.

| Nr | Was | Wo | Prüfung | Befund |
|---|---|---|---|---|
| T1 | Impressum und Datenschutz im Hub | Vorlage, Erzeuger, Markenblatt, Board | neu `pruef-rechtstexte.js` | 1 |
| T2 | Gerätekennung erst bei Bedarf | Vorlage `geraetKennung`, `gastLaden` | neu, Teil von `pruef-rechtstexte.js`; `pruef-gastkonto.js` anpassen | 2 |
| T3 | Knopf „Zahlungspflichtig bestellen", Top-Runner-Knopf ehrlich beschriften | Vorlage, Wörterbuch | `pruef-uebersetzung.js`, `pruef-sofort.js`, `pruef-durchgang.js` | 3 |
| T4 | „inkl. MwSt." und Lieferkosten | Vorlage, Karte und Warenkorb | Teil von `pruef-rechtstexte.js` | 8 |
| T5 | Löschfristen | neue Migration, Board-Einstellung | zurückgedrehte Probe | 5 |
| T6 | Alessia: Pflichtsatz, Aufnahme aus | `erzeuge-alessia.js` | `pruef-alessia.js` | 6 |
| T7 | Kennzeichnung KI-Foto (optional) | Vorlage, Pop-Ansicht | `pruef-profifoto.js` | 10 |
| T8 | `datenschutz.html` von omoteno.de ersetzen | `seiten/datenschutz.html` | `pruef-recht.js` | 4 |
| T9 | Kontaktstelle DSA und Meldeweg | `seiten/impressum.html` | `pruef-recht.js` | 9 |
| T10 | Häkchen AGB/AVV beim Vertragsschluss | Warteliste/Freischaltung, Konto | neu | 12 |
| T11 | Lieferanschrift nur mit Häkchen „Adresse auf diesem Gerät merken" merken | Vorlage `lieferAdresseMerken` | `pruef-liefern.js` | 2 (Datensparsamkeit) |

## T1 · Impressum und Datenschutz im Hub

- Neuer Block im Markenblatt, Pflicht für jeden Betrieb:
  ```json
  "recht": {
    "inhaber": "Vorname Nachname" ,
    "firma": "Choco L'AMouR GmbH",
    "rechtsform": "GmbH",
    "vertreten": "Geschäftsführerin …",
    "register": "Amtsgericht Marburg, HRB …",
    "ustid": "DE…",
    "aufsicht": "",
    "kammer": ""
  }
  ```
  Anschrift, Telefon und E-Mail stehen bereits im Markenblatt (`betrieb.strasse`,
  `ort`, `telefon`, `mail`). Fehlt `recht` oder ein Pflichtfeld, meldet der
  Erzeuger „fehlt noch" wie bei der Adresse von Più Gusto — und der Hub zeigt
  im Impressum einen sichtbaren Platzhalter statt still nichts.
- Zwei Routen im Hub: `#/impressum` und `#/datenschutz`, Text aus
  `07-hub-impressum.md` und `08-hub-datenschutz.md`, Werte über `hs()`
  (CLAUDE.md §2.3a).
- **Erreichbarkeit:** ein Link „Impressum · Datenschutz" am Ende jeder
  Ansicht und ein Eintrag in der Haus-Seite (`#/haus`). Für die Bestellung
  zusätzlich ein Link direkt über dem Bestellknopf und am E-Mail-Feld.
  „Leicht erkennbar" heißt: nicht nur hinter dem Logo versteckt.
- Die Datenschutz-Seite des Hubs bekommt ihre Liste der Geräte-Einträge aus
  **einer** Quelle: eine Konstante `SPEICHER_EINTRAEGE` neben den Schlüsseln;
  die Prüfung hält jeden `localStorage`/`sessionStorage`-Schlüssel der Vorlage
  gegen diese Liste (zweite Quelle, §8.1b). Ein neuer Schlüssel ohne Zeile
  wird rot.
- Übersetzung: Rechtstexte bleiben auf Deutsch, Rahmen und Überschriften
  übersetzt („Impressum", „Datenschutz" in elf Sprachen). Ein übersetzter
  Rechtstext ist eine eigene Haftung — das muss der Betrieb wollen.

## T2 · Gerätekennung erst bei Bedarf

- `if(!VORSCHAU) gastLaden();` beim Laden **entfernen**.
- `geraetKennung()` legt nur noch an, wenn sie gerufen wird. Aufrufer heute:
  Bestellung (`bestellung_aufgeben`, `bestellung_liefern`), Rabattcode,
  Reservierung, `gast_mail_merken`, „Mein Tisch". Neu eine Lesefunktion
  `geraetKennungWennDa()` für alles, was nur nachsehen will.
- `gastLaden()` läuft: nach einer erfolgreichen Bestellung, beim Öffnen von
  „Mein Tisch", und beim Laden **nur wenn die Kennung schon existiert**
  (der Gast hat früher schon bestellt — dann ist sie für den angeforderten
  Dienst „Mein Tisch / Gutscheine" nötig).
- Prüfung: frischer Kontext, Karte öffnen, durch alle Seiten — kein Schlüssel
  `omoteno-geraet-*`, keine Anfrage an `gast_melden`. Dann bestellen →
  Schlüssel da, genau eine Anfrage. Gegenbeweis: Zeile zurück → rot.
- Erklärung im Hub: der Eintrag steht dann ehrlich als „nach Ihrer ersten
  Bestellung" in der Liste (`08-hub-datenschutz.md` Abschnitt 6).

## T3 · Bestellknopf

- „Bestellung abschicken" → „Zahlungspflichtig bestellen"; bei Lieferung
  ebenso. Wörterbuch: zwölf Sprachen (`10-ui-texte.md`).
- Top-Runner: Der Knopf „+" legt in den Warenkorb, bestellt aber nicht
  (Korrektur 18.10.). Nur sein `aria-label` „Sofort bestellen" wird zu
  „In den Warenkorb" — kein Bestätigungsblatt nötig.
- Unmittelbar über dem Knopf: Summe, bei Lieferung Liefergebühr und
  Gesamtbetrag (§ 312j Abs. 2 BGB). Der Warenkorb zeigt das; prüfen, dass die
  Liefergebühr in der Summe **über dem Knopf** steht, nicht erst danach.
- Der Text „zahlungspflichtig" ist auch am Tisch richtig: Bezahlt wird später,
  aber die Pflicht entsteht mit dem Tipp.

## T4 · Preisangaben

Unter der Karte und im Warenkorb, klein, lesbar (≥ 4,5:1):
„Alle Preise in Euro inkl. MwSt." — im Liefermodus zusätzlich
„zzgl. Liefergebühr 2,50 €" bzw. „Lieferung frei ab 25 €" aus den
Liefereinstellungen.

Offen für den Anwalt: Der Hub zeigt bei Aktionen den alten Preis
durchgestrichen mit „−20 %". § 11 PAngV verlangt bei einer
Preisermäßigung für **Waren** den niedrigsten Preis der letzten 30 Tage als
Bezug. Ob zubereitete Speisen zur Lieferung darunter fallen, ist zu klären.
Vorsichtige Umsetzung: Als „vorher" nur den Kartenpreis zeigen, der in den
30 Tagen vor Aktionsbeginn ununterbrochen galt (aus `protokoll` lesbar).

## T5 · Löschfristen

Neue Migration (additiv, §2.5), über `pg_cron` täglich, Funktion
`aufraeumen_personendaten()`:
- Bestellungen älter als **90 Tage**: `name`, `telefon`, `adresse`, `notiz`,
  `geraet` leeren — Positionen, Summen, Zeiten, Status bleiben.
- Transkript von Telefonbestellungen älter als **30 Tage** leeren.
- Reservierungen 30 Tage nach dem Termin: Name und Telefon leeren.
- Gäste (`gaeste`) ohne Besuch seit **24 Monaten** löschen; E-Mail-Freigaben
  bei Klaviyo bleiben Sache von Klaviyo (Abmeldung dort).
- Der Löschteil steht als Datei und läuft im SQL-Editor (§2.8), die
  zurückgedrehte Probe zählt Zeilen (§2.3b), Probe mit **zweitem** Durchgang.
- Fristen gehören in den AVV (Anlage 1) — wenn sie sich ändern, ändert sich
  der Vertrag.

## T6 · Alessia

- `erzeuge-alessia.js`: Gruß wird zusammengesetzt aus einem **festen**
  Pflichtsatz und dem freien Teil des Betriebs:
  „Hallo, hier ist Alessia, die KI-Assistentin von {name}. Das Gespräch wird
  zur Bearbeitung Ihrer Bestellung als Text mitgeschrieben." + freier Gruß.
- Im Assistenten ausdrücklich: Tonaufnahme aus (bei Vapi im
  `artifactPlan`: `recordingEnabled: false`; Feldname gegen die aktuelle
  Vapi-Doku prüfen, nicht raten). Transkript bleibt.
- `pruef-alessia.js`: jeder erzeugte Assistent enthält den Pflichtsatz,
  auch wenn `--gruss` gesetzt ist; Aufnahme aus. Gegenbeweis.

## T7 · KI-Foto (optional)

An Bildern aus `bild_frei`/Profi-Foto eine kleine Marke „KI-bearbeitet" im
Detailblatt (nicht in der Kachel). Der Betrieb kann sie nicht abschalten.

## T8 · omoteno.de/datenschutz

Inhalt aus `03-datenschutz-omoteno.md` in die bestehende Gestaltung von
`seiten/datenschutz.html` übertragen (gleiche Klassen, Inhaltsverzeichnis).
`pruef-recht.js` laufen lassen.

## T9 · Impressum: Kontaktstelle DSA und Meldeweg

Abschnitt aus `04-impressum-omoteno.md` ergänzen. Meldeweg genügt als
E-Mail-Adresse mit Pflichtangaben (Art. 16 Abs. 2 DSA); ein Formular ist
schöner, aber nicht nötig.

## T10 · Vertragsschluss mit Betrieben

Heute: Warteliste und Freischaltung durch den Master. Beim Freischalten (oder
beim ersten Anmelden im Konto) ein Blatt mit zwei Häkchen (`10-ui-texte.md`),
gespeichert mit Zeitpunkt und Fassung (`betriebe.agb_fassung`,
`agb_akzeptiert_um`). Ohne Häkchen kein Board. Die Fassung steht als Datum
in den AGB.

## T11 · Lieferanschrift nur auf Wunsch merken

`lieferAdresseMerken(a)` wird heute bei jeder Lieferbestellung gerufen. Neu
ein Häkchen unter dem Adressformular, Vorgabe **aus**; nur mit Häkchen wird
gespeichert, ohne Häkchen ein vorhandener Eintrag entfernt. Die Anschrift
bleibt lokal — das ist datenschutzrechtlich mild, aber „automatisch auf dem
Gerät abgelegt" ist auf einem geteilten Familien-Tablet eine Überraschung,
und § 25 TDDDG fragt nach „unbedingt erforderlich".
