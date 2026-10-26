# Umsetzung des Rechtsberichts · Stand 26.10.2026

> **Was dieses Dokument ist.** Es hält fest, was aus `14-ki-software-hessen-stand-2510.md` (Befunde R1–R16) im
> Verzeichnis umgesetzt wurde, was **nicht** im Verzeichnis lösbar ist und wer es liefern muss. Es ist kein
> Rechtsgutachten. **AGB, AVV und alle neuen Rechtstexte sind Entwürfe und nicht anwaltlich geprüft.**
>
> **Güte der Quellen.** Gesetzestexte (gesetze-im-internet.de, EUR-Lex) waren aus der Arbeitsumgebung nicht abrufbar
> (DNS-Fehler, am 26.10. erneut gemessen). Belegt sind die Aussagen über Sekundärseiten (IHK, Kanzleien, Aufsicht) —
> jede trägt in `14-…` ihre Güte [B]/[W]/[?]. Eine „zertifizierte“ Rechtsquelle gibt es nicht; belastbar sind
> Gesetzestext, Urteile und Aufsichtsbehörden. Das ist die Grenze dieser Umsetzung.

## 1 · Umgesetzt (im Verzeichnis, geprüft)

| Befund | Was geschah | Prüfung |
|---|---|---|
| **R1** AGB/AVV | `seiten/agb.html`, `seiten/avv.html`; Fußzeilen auf Landingpage, Konto, Start; Auslieferung in `erzeuger/bauen.js`, `auslieferung/_redirects`; im Konto die Vertragstafel mit zwei Häkchen (Zeitpunkt + Fassung) — **aus**, solange `VERTRAEGE_AN` nicht gesetzt ist; Speicherung nur über `vertrag_akzeptieren` (`datenbank/migration-vertraege.sql`, Entwurf) | `pruef-rechtspflichten.js`, `pruef-vertraege-lokal.sh` (lokales Postgres 16) |
| **R2** Impressumsangaben | `erzeuge-hub.js --streng` bricht bei fehlenden Angaben **im Prüflauf** ab; der Netlify-Bau (`bauen.js`) bleibt bewusst nicht streng, sonst gingen bei einer Lücke alle Hubs offline | `pruef-rechtspflichten.js` |
| **R3** Preisangaben | Variante A: Der Hub zeigt nur den Aktionspreis mit dem Wort „Aktion“; kein Streichpreis, kein „−x %“ (Karte, Detailblatt, Aktions-Knopf). Der Wirt sieht den Rabatt weiter im Board | `pruef-runner.js`, `pruef-rabatt-gericht.js`, `pruef-sofort.js` |
| **R4** Allergene | „Angaben ohne Gewähr“ ersetzt durch den Hinweis, vor der Bestellung beim Serviceteam nachzufragen; Angaben stammen vom Betrieb; elf Sprachen | `pruef-rechtspflichten.js`, `pruef-uebersetzung.js` |
| **R5** Landingpage | „DSGVO“-Plakette → „Auftragsverarbeitungsvertrag inklusive“; § 146a-Satz neutral; nur Unternehmer, netto; „Server in Frankfurt“ auf das Wahre eingegrenzt (nur die Datenbank) | `pruef-rechtspflichten.js`, `pruef-web.js` |
| **R7** Stripe | als Empfänger in der Datenschutzerklärung; Rolle neutral („eigener Verantwortlicher für die Zahlungsabwicklung“) und als offen vermerkt | `pruef-rechtspflichten.js` |
| **R8** KI-Kennzeichnung | Marke „KI-bearbeitet“ im Detailblatt, **nur** wenn die Spalte `gerichte.bild_ki` existiert und gesetzt ist (`migration-bild-ki-marke.sql`, Entwurf); ohne Migration keine Marke (fail-open) | `pruef-rechtspflichten.js`, `pruef-profifoto.js` |
| **R9** Mehrweg | Hinweiszeile im Board bei Lieferung/Abholung (§§ 33/34 VerpackG, Ausnahme kleine Betriebe, LUCID/Systembeteiligung) | `pruef-rechtspflichten.js`, `pruef-liefern.js`, `pruef-abholen.js` |
| **R11** Entwicklungsnachweis | `dokumente/entwicklungsnachweis.md`, `dokumente/urhebervermerk.txt` (ohne Schutzbehauptung); Impressum nutzt eine neutrale Vorbehaltsformel | `pruef-rechtspflichten.js` |

Dazu, aus demselben Auftrag: Gast-Texte im Hub ruhig-professionell in der Sie-Form (alle elf Sprachen), Top-Runner als
kleiner Prozent-Knopf mit Blatt und Countdown, Wisch-Verdrahtung aller Board-Blätter, Abstand der Vorschau,
Reiterleiste folgt dem sichtbaren Rand auch bei Zoom.

## 2 · Nicht im Verzeichnis lösbar — Übergabeliste

| Nr. | Was | Wer |
|---|---|---|
| R2 | Impressumsangaben je Betrieb (chocolamour, blend, minhkeey, piugusto); `--streng` ist dort heute rot | Betreiber |
| R6 | Löschfristen-Migration einspielen, danach `LOESCHFRISTEN_LIVE` | Betreiber |
| R12 | Vapi-Einstellungen im Dashboard (Aufzeichnung, Hinweis, Region) | Betreiber |
| R13 | Einstufung nach BFSG; erst danach eine Erklärung zur Barrierefreiheit | Betreiber / Anwalt |
| R14 | Kasse/TSE: Omoteno ersetzt keine Kasse — Einstufung durch Steuerberater | Steuerberater |
| R15 | ZAG: Rolle bei Zahlungen | Anwalt |
| R16 | Berufs-/Betriebshaftpflicht, Cyberversicherung | Betreiber |
| — | Rolle von Stripe (Verantwortlicher / Auftragsverarbeiter) | Anwalt |
| — | Offene Angaben A–D und 1–11 aus `11-offene-angaben.md` (Kündigungsfrist, Zahlungsweg, Testphase, Drittlandtransfer, Backup-Tage) | Betreiber |
| — | **Anwaltsprüfung** von AGB, AVV, Hub-Datenschutz; § 12 (Schweigefiktion) besonders | Anwalt |
| — | `VERTRAEGE_AN` erst **nach** dieser Prüfung einschalten | Betreiber |
| — | Migrationen `migration-vertraege.sql`, `migration-bild-ki-marke.sql`, `migration-gericht-fertig.sql`, `migration-saal-raeume.sql` sind **nicht live** (Supabase-Werkzeug war nicht erreichbar) | Betreiber / nächste Sitzung |

## 3 · Ehrliche Grenzen

- Kopfloses Chromium, kein iPhone; die Leiste bei Zoom ist am sichtbaren Rand gemessen, nicht auf einem Gerät gesehen.
- Alles Neue ist fail-open (CLAUDE.md § 7): Fehlt eine Migration, läuft das Produkt wie vorher.
- Eigene Texte, die ein Wirt unter einem alten Wörterbuchschlüssel gespeichert hat (`hub_texte.eigen`), greifen unter den
  neuen Sätzen nicht mehr — der Wirt sieht dann wieder die neue Vorgabe.
- Marken-Stimme der Häuser (Hausbeschreibungen, Landingpage in der Du-Form) wurde nicht angefasst.

## 4 · Regression und Befunde dieser Runde (26.10.)

- Berührte Prüfungen erneut gelaufen und grün: `pruef-runner` (152), `pruef-rechtspflichten` (97), `pruef-durchgang`, `pruef-zahlung`, `pruef-abholen` (101), `pruef-liefern`, `pruef-sofort`, `pruef-rabatt-gericht` (49), `pruef-uebersetzung`, `pruef-sprache`, `pruef-figur`, `pruef-tour`; dazu die übrige Regression (Sicherheit, Lesbarkeit, Hell, Farbschema, Rechtstexte, Startseite, Kopf, Lizenzen).
- Gegenbeweise: Top-Runner 19 von 19 rot, Rechtspflichten 16 von 16 rot, Wortlaut/Pille 3 von 3 rot (Treffer je Sabotage gezählt).
- **Eigener Fehler, gefunden von der Prüfung:** „Gerade geschlossen“ passte in der Liefer-Pille nicht (Rumänisch 124/76 px); die alte Probe hatte das Wort fest eingetragen und nie auf Deutsch gemessen. Jetzt „Zurzeit zu“, Probe fragt den Hub.
- **Vorbestehend, nicht behoben:** `pruef-texte` „Begleitersatz bei gut/hart“ bei 360 px (3 bzw. 4 statt 2 bzw. 3 Zeilen) — am Stand vor dieser Sitzung (`0b321bb`) mit Blend und Choco ebenfalls rot.
