# Rechtliche Lücken- und Risikoanalyse · Omoteno

Stand: 18.10.2026 · erstellt aus dem Code des Zweigs
`claude/landingpage-design-integration-r000h9`, nicht aus der Erinnerung.

> **Wichtig.** Das ist eine sorgfältige Vorarbeit, keine Rechtsberatung.
> Ich bin kein Anwalt. Jede Fundstelle unten ist im Code belegt; die
> rechtliche Bewertung muss eine Fachanwältin oder ein Fachanwalt für
> IT-Recht gegenlesen, bevor die Texte live gehen. Punkt 7 gehört
> zusätzlich zum Steuerberater.

## Wer ist wofür verantwortlich

Omoteno hat zwei Rollen, und fast jeder Befund hängt daran, welche gerade gilt:

| Bereich | Omoteno ist … | Grund |
|---|---|---|
| omoteno.de, Anfrageformular, Konto, Board-Anmeldung | **Verantwortlicher** (Art. 4 Nr. 7 DSGVO) | eigene Website, eigene Kunden |
| Gästehub, Bestellungen, Reservierungen, Lieferung, Alessia, Newsletter der Gäste, Protokoll des Teams, Einkauf | **Auftragsverarbeiter** (Art. 28 DSGVO) des Betriebs | Daten der Gäste und Mitarbeiter des Betriebs, Zweck bestimmt der Betrieb |
| Inhalte im Hub (Karte, Preise, Fotos, Texte) | **Hostingdienst** (Art. 6 DSA) | Inhalte stammen vom Betrieb |

Omoteno verkauft ausschließlich an Unternehmer (B2B). Der Vertrag über Speisen
kommt zwischen Gast und Betrieb zustande (B2C). Deshalb braucht Omoteno
**keine** eigene Widerrufsbelehrung — die Betriebe brauchen aber Hinweise für
ihre Gäste, und der Hub muss sie anzeigen.

## Befunde, nach Folgen geordnet

### 1 · Der Gästehub hat weder Impressum noch Datenschutzerklärung — HOCH

**Belegt:** `grep -n -i 'impressum\|datenschutz' vorlagen/hub.vorlage.html` findet
nichts. Die Seite `datenschutz.html` von Omoteno sagt dagegen: „Die für einen
Gästehub geltende Datenschutzerklärung und das Impressum findest du im
jeweiligen Gästehub selbst." Das stimmt nicht.

**Folge:** Jeder Hub ist ein geschäftsmäßiges digitales Angebot des Betriebs.
§ 5 DDG verlangt ein leicht erkennbares, unmittelbar erreichbares Impressum,
Art. 13 DSGVO eine Datenschutzinformation beim Erheben (Bestellung, Lieferadresse,
Telefonnummer, E-Mail für „Post vom Haus"). Beides ist abmahnfähig (UWG) und
bußgeldbewehrt (§ 33 DDG bis 50.000 €; Art. 83 Abs. 5 DSGVO). Betroffen sind
**alle** Betriebe gleichzeitig — und als Anbieter der Technik, der die
Fußzeile gebaut hat, steht Omoteno im Gespräch mit jedem Betrieb schlecht da.

**Lösung:** Fester Link „Impressum · Datenschutz" in jeder Ansicht des Hubs,
Inhalte aus dem Markenblatt bzw. dem Board des Betriebs; ohne vollständige
Angaben warnt der Erzeuger („fehlt noch"). Vorlagen: `07-hub-impressum.md`,
`08-hub-datenschutz.md`. Technik: `02-technik.md` T1.

### 2 · Gerätekennung ohne Einwilligung bei jedem Aufruf — HOCH

**Belegt:** `geraetKennung()` (Vorlage, Zeile ~7043) legt beim ersten Aufruf
`omoteno-geraet-<betrieb>` in `localStorage` ab; `if(!VORSCHAU) gastLaden();`
(Zeile ~18079) schickt sie bei **jedem** Seitenaufruf an `gast_melden`. Dort
wird ein Gast angelegt und ein Besuch gezählt (`stand-gast-melden.sql`,
Zeile 45–55). Der Gast hat dafür nichts getan außer die Karte zu öffnen.

**Folge:** § 25 Abs. 1 TDDDG verlangt eine Einwilligung für jedes Speichern und
Auslesen auf dem Endgerät — es sei denn, es ist **unbedingt erforderlich** für
einen Dienst, den der Gast **ausdrücklich gewünscht** hat (Abs. 2 Nr. 2). Eine
Speisekarte lesen braucht keinen Besuchszähler. Für Bestellung und
Missbrauchsschutz lässt sich die Kennung vertreten, für Besuchszählung,
Lieblingsgerichte und die Weitergabe an Klaviyo nicht. Die Erklärung von
Omoteno sagt zudem: „Keiner [der Einträge] verlässt dein Gerät" — für diese
Kennung ist das falsch (irreführend, Art. 5 Abs. 1 lit. a, Art. 13 DSGVO).

**Lösung (Entscheidung nötig, siehe `11-offene-angaben.md` Frage A):**
- **Empfohlen:** Kennung erst anlegen, wenn der Gast etwas tut, das sie
  braucht — bestellen, reservieren, „Mein Tisch" öffnen, E-Mail hinterlegen.
  Vorher kein `gast_melden`. Kein Banner nötig, Besuche werden ab der ersten
  Bestellung gezählt. Technik: T2.
- Alternative: Einwilligungsabfrage beim ersten Aufruf. Kostet jeden Gast einen
  Tipp, und wer ablehnt, wird gar nicht gezählt — auch nicht nach einer
  Bestellung.

### 3 · Bestellknopf ohne „zahlungspflichtig" — HOCH

**Belegt:** Der Knopf heißt „Bestellung abschicken" (Vorlage, Zeile ~10352,
13395); „Sofort bestellen" bestellt mit einem Tipp aus dem Top-Runner-Streifen.

**Folge:** § 312j Abs. 3 BGB: Bei einem Verbrauchervertrag im elektronischen
Geschäftsverkehr muss die Schaltfläche gut lesbar mit „zahlungspflichtig
bestellen" oder einer entsprechend eindeutigen Formulierung beschriftet sein.
Sonst kommt **kein Vertrag zustande** (Abs. 4) — der Gast müsste nicht zahlen —,
und Mitbewerber können abmahnen. Für Lieferbestellungen ist das eindeutig;
für die Bestellung am Tisch ist umstritten, ob der Vertrag „elektronisch"
geschlossen wird. Die sichere Seite kostet nur den Knopftext.
Dazu § 312j Abs. 2: Unmittelbar vor dem Knopf müssen Gesamtpreis, wesentliche
Eigenschaften (die Positionen) und bei Lieferung die Kosten stehen — der
Warenkorb zeigt das bereits, die Liefergebühr ist zu prüfen.

**Lösung:** Knopf „Zahlungspflichtig bestellen" in allen zwölf Sprachen;
„Sofort bestellen" öffnet statt direkt zu bestellen eine Bestätigung mit
Preis und demselben Knopf. Texte: `10-ui-texte.md`. Technik: T3.

### 4 · Datenschutzerklärung von omoteno.de stimmt nicht mehr — MITTEL

**Belegt:**
- nennt **jsDelivr** als Empfänger — die Bibliothek liegt seit dem Umbau unter
  `/lib/supabase-js-2.117.3.js` mit `integrity`, keine Seite lädt mehr von dort;
- **fehlt: Anthropic** (Claude) — Übersetzer (`supabase/functions/uebersetzen`)
  und Rechnungslesen (`beleg-lesen`, Lieferantenrechnungen können Namen von
  Einzelunternehmern enthalten);
- **fehlt: Google-Anmeldung** im Konto (`konto.html`, `signInWithOAuth` mit
  `provider: "google"`);
- **fehlt: Web-Push** im Board (`VAPID_PUBLIC`, Abo-Endpunkt beim Push-Dienst
  des Browsers, z. B. Google oder Apple; `melden` versendet);
- **fehlt:** Einkauf (Belege, Lieferanten), Team und Protokoll, PIN;
- behauptet, kein Eintrag verlasse das Gerät (siehe 2) und die Hubs hätten
  eigene Rechtstexte (siehe 1);
- „Server-Protokolle nach spätestens 30 Tagen gelöscht" — steht nirgends im
  Verzeichnis; Netlify bestätigen lassen oder Wortlaut vorsichtiger.

**Folge:** Eine unvollständige Erklärung ist ein Verstoß gegen Art. 13 DSGVO,
eine falsche zusätzlich irreführend. Neuer Text: `03-datenschutz-omoteno.md`.

### 5 · Keine Löschfristen für Gästedaten — MITTEL

**Belegt:** Keine Migration plant eine Löschung (`grep -l 'cron.schedule'
datenbank/*.sql` leer). Name, Telefonnummer, Lieferadresse, Notizen und das
Gesprächsprotokoll von Alessia bleiben an der Bestellung, solange es die
Datenbank gibt.

**Folge:** Art. 5 Abs. 1 lit. e DSGVO (Speicherbegrenzung). Im AVV und in der
Erklärung muss eine Frist stehen, und sie muss technisch gelten.

**Lösung:** Personenbezogene Felder der Bestellung nach **90 Tagen** leeren
(Positionen, Summen und Zeit bleiben für Auswertung und Buchhaltung), das
Gesprächsprotokoll nach **30 Tagen**, Gäste ohne Besuch seit **24 Monaten**
löschen. Frist zur Wahl im Board ist möglich, die Vorgabe muss aber greifen.
Technik: T5.

### 6 · Alessia: KI-Hinweis, Aufnahme, Information der Anrufer — MITTEL

**Belegt:** Begrüßung „…, hier ist Alessia, die digitale Assistentin."
(`erzeuger/erzeuge-alessia.js`, Zeile 74) und vom Betrieb überschreibbar
(`--gruss`). Das Transkript wird an der Bestellung gespeichert
(`alessia-bestellung/index.ts`, Zeile 78). Eine Einstellung zur Tonaufnahme
setzt der Erzeuger nicht — dann gilt die Vorgabe von Vapi.

**Folge:**
- **KI-Verordnung Art. 50 Abs. 1** gilt seit 2.8.2026: Wer mit einem KI-System
  spricht, muss es erfahren, spätestens zu Beginn. „Digitale Assistentin" ist
  näher an „Sprachmenü" als an „KI". Und weil der Betrieb den Gruß frei
  überschreiben kann, kann der Hinweis ganz verschwinden.
- **§ 201 StGB:** Eine Tonaufnahme des nichtöffentlich gesprochenen Wortes
  ohne Einwilligung ist strafbar. Ob Vapi aufnimmt, muss in der
  Assistenten-Einstellung nachgesehen werden; sicher ist, die Aufnahme
  abzuschalten und nur das Transkript zu behalten.
- Art. 13 DSGVO am Telefon: kurzer Hinweis plus Verweis auf die
  Datenschutzerklärung des Betriebs.

**Lösung:** fester Pflichtsatz vor dem frei wählbaren Gruß; Aufnahme
ausdrücklich aus. Texte: `10-ui-texte.md`. Technik: T6.

### 7 · „Kein Kassensystem" und Kassensicherungsverordnung — MITTEL (Steuer)

**Belegt:** Die Landingpage wirbt mit „Kein Kassensystem"; Hub und Board
zeichnen jede Bestellung mit Positionen und Summen auf, die Küche druckt Bons.

**Folge:** Nach dem Anwendungserlass zu § 146a AO können Bestellsysteme in der
Gastronomie, die Geschäftsvorfälle vor der Kasse aufzeichnen, Teil des
„elektronischen Aufzeichnungssystems" sein und eine TSE-Anbindung brauchen.
Ob das für Omoteno gilt, hängt davon ab, wie die Betriebe kassieren. **Das kann
nur ein Steuerberater beurteilen** — mit Folgen für die Betriebe
(Schätzung bei der Betriebsprüfung) und für das Werbeversprechen.

**Lösung bis zur Klärung:** In den AGB festhalten, dass Omoteno kein
Kassensystem und keine TSE ist und der Betrieb die Einnahmen über seine
zertifizierte Kasse erfasst (`05-agb.md` § 4). Werbesatz prüfen lassen.

### 8 · Preisangaben im Hub — MITTEL

**Belegt:** Kein „inkl. MwSt." im Hub (`grep 'inkl\.\|MwSt\|USt'` leer).

**Folge:** § 7 PAngV (Gaststätten) verlangt Gesamtpreise einschließlich
Umsatzsteuer und Bedienung — die Preise sind brutto, ein Hinweis fehlt. Bei
Lieferung (Fernabsatz) verlangt § 6 PAngV ausdrücklich den Hinweis, dass die
Umsatzsteuer enthalten ist, und die Lieferkosten. Abmahnfähig.

**Lösung:** Eine Zeile unter der Karte und im Warenkorb: „Alle Preise in Euro
inkl. MwSt." und bei Lieferung „zzgl. Liefergebühr x,xx €". Technik: T4.

### 9 · Digital Services Act (Hostingdienst) — NIEDRIG bis MITTEL

Omoteno speichert Inhalte der Betriebe und macht sie öffentlich zugänglich.
Pflichten für Hostingdienste: eine **zentrale Kontaktstelle** für Behörden und
Nutzer (Art. 11, 12), Angaben zur Inhaltsmoderation in den AGB (Art. 14), ein
**Meldeweg** für rechtswidrige Inhalte (Art. 16) und eine Begründung, wenn
Omoteno Inhalte sperrt (Art. 17). Als Kleinstunternehmen entfallen die
Plattform-Pflichten aus Art. 20 ff. weitgehend (Art. 19). Texte:
Impressum (`04-impressum-omoteno.md`) und AGB § 8.

### 10 · KI-generierte Gerichtfotos (Profi-Foto) — NIEDRIG

fal.ai und Bria setzen das Gericht in ein Studiofoto. Zeigt das Bild mehr, als
auf dem Teller landet, ist das irreführend (§ 5 UWG) — das Risiko trägt der
Betrieb, der Hinweis gehört in die AGB. Art. 50 Abs. 4 KI-VO (Deepfakes) zielt
auf täuschend echte Darstellungen; vorsorglich eine kleine Kennzeichnung
„KI-bearbeitet" am Bild im Hub. Technik: T7 (optional).

### 11 · Newsletter der Gäste — weitgehend in Ordnung

Double-Opt-in, Zweck, Klaviyo und Widerspruch stehen im Hub-Text
(Vorlage, Zeile ~10560). Es fehlt der **Link zur Datenschutzerklärung** direkt
am Feld (folgt aus 1). Klaviyo ist ein US-Dienst, den Omoteno als
Unterauftragnehmer einsetzt; der Betrieb braucht keinen eigenen Vertrag mit
Klaviyo, aber Klaviyo muss in der Liste im AVV stehen (Anlage 2).

### 12 · Formales, das fehlt

- **AVV** mit jedem Betrieb (Art. 28 Abs. 3) — `06-avv.md`.
- **AGB** für Betriebe — dringend empfohlen, weil B2B ohne AGB nur das
  Gesetz gilt (unbegrenzte Haftung, keine Regeln zu Inhalten, Preisänderung,
  Testphase). `05-agb.md`.
- **Verzeichnis von Verarbeitungstätigkeiten** (Art. 30 Abs. 1 und 2) — als
  Verantwortlicher und als Auftragsverarbeiter. Kein Text hier, aber Pflicht.
- **Verträge mit den Unterauftragnehmern** (Supabase, Netlify, Klaviyo, Vapi,
  fal.ai, Anthropic) abschließen bzw. die DPA der Anbieter akzeptieren und
  ablegen. Für Anthropic: kommerzielle Bedingungen mit DPA; API-Daten werden
  nicht zum Training genutzt.
- **KI-Kompetenz** (Art. 4 KI-VO, seit 2.2.2025): Wer KI-Systeme betreibt,
  sorgt für ausreichende Kenntnisse beim eigenen Personal — kurz dokumentieren.

## Was ausdrücklich NICHT fehlt

- **Cookie-Banner für omoteno.de:** nicht nötig — keine Analyse, keine
  Werbung, Einträge nur für gewünschte Funktionen (§ 25 Abs. 2 Nr. 2 TDDDG).
  Für den Hub gilt das erst nach Befund 2.
- **Schriften:** alle selbst ausgeliefert (`pruef-schriften.js`), keine
  Übermittlung an Google.
- **OS-Plattform-Link:** Die EU-Plattform zur Online-Streitbeilegung wurde am
  20.7.2025 eingestellt (VO (EU) 2024/3228). Der Link gehört nicht mehr ins
  Impressum; das jetzige Impressum hat ihn richtigerweise nicht.
- **Widerrufsbelehrung für Omoteno selbst:** nicht nötig, reiner B2B-Vertrieb —
  vorausgesetzt, das steht klar auf der Seite und in den AGB und es wird
  tatsächlich nur mit Unternehmern abgeschlossen.
- **Datenschutzbeauftragter:** erst ab 20 Personen, die ständig Daten
  verarbeiten (§ 38 BDSG).
- **Allergene/Zusatzstoffe:** Hub zeigt sie je Gericht (LMIV Art. 9, 44);
  richtig sein müssen sie beim Betrieb.
