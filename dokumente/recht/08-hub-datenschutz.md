# Vorlage · Datenschutzerklärung im Gästehub

> **Umgesetzt 18.10.** in `vorlagen/hub.vorlage.html` (`SEITEN.datenschutz`,
> `SPEICHER_EINTRAEGE`). Maßgeblich ist ab jetzt der Code; diese Datei ist die
> Vorlage für den Anwalt. Unterschied: Löschfristen erscheinen erst mit
> `LOESCHFRISTEN_LIVE`.

Wird im Hub unter `#/datenschutz` gezeichnet (Technik T1). Abschnitte für
Funktionen, die ein Betrieb nicht nutzt (Lieferung, Newsletter, Alessia,
Reservierung, Trinkgeld), entfallen automatisch — die Schalter dafür kennt
der Hub ohnehin. Die Tabelle in Abschnitt 6 entsteht aus `SPEICHER_EINTRAEGE`
und wird gegen jeden Speicherschlüssel der Vorlage geprüft.

Ton: „Sie", kurz, ohne Juristendeutsch wo möglich.

---

## Datenschutz bei {betrieb.name}

Wir verarbeiten nur, was wir brauchen, um Sie zu bedienen. Keine Werbung von
Dritten, keine Analyse, kein Tracking.

### 1 · Wer verantwortlich ist

{recht.firma}, {betrieb.strasse}, {betrieb.ort}
Telefon {betrieb.telefon} · E-Mail {betrieb.mail}
{falls vorhanden: Datenschutzbeauftragte(r): …}

Die Technik dieser Karte stellt Omoteno (Elias Faber, Ringstraße 12, 35260
Stadtallendorf) bereit. Omoteno verarbeitet Ihre Daten nur in unserem Auftrag
und nach unseren Weisungen (Art. 28 DSGVO).

### 2 · Karte ansehen

Beim Öffnen der Karte verarbeitet der Hoster technisch nötige Verbindungsdaten
(IP-Adresse, Zeit, aufgerufene Adresse, Browser), um die Seite auszuliefern und
vor Angriffen zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Gespeichert werden sie
nur in den Protokollen des Hosters, {Frist}. Schriften, Bilder und Programme
kommen von unserem eigenen Server; es werden keine fremden Dienste geladen.

### 3 · Bestellen und Servicerufe

Wenn Sie bestellen oder den Service rufen, verarbeiten wir Ihre Auswahl, die
Tischnummer, Ihre Notiz und die Uhrzeit, um die Bestellung zuzubereiten, zu
servieren und abzurechnen (Art. 6 Abs. 1 lit. b DSGVO).

Damit niemand in Ihrem Namen erfundene Bestellungen aufgibt, zählen wir kurz,
wie viele Bestellungen von einem Gerät, einem Tisch und einer Herkunft
kommen. Ihre IP-Adresse wird dabei nicht gespeichert, nur ein täglich neu
verschlüsselter Prüfwert, der nach zwei Tagen niemandem mehr zuzuordnen ist.
Auffällige Bestellungen lehnen wir nicht ab, unser Personal sieht sie sich an
(Art. 6 Abs. 1 lit. f DSGVO).

Personenbezogene Angaben an der Bestellung löschen wir nach 90 Tagen;
Gerichte und Beträge bleiben für unsere Buchhaltung.

### 4 · Lieferung  *(nur bei Lieferung)*

Für eine Lieferung brauchen wir Namen, Anschrift und Telefonnummer
(Art. 6 Abs. 1 lit. b DSGVO). Wir verwenden sie nur für diese Lieferung und für
Rückfragen und löschen sie nach 90 Tagen. Wenn Sie das Häkchen „Adresse auf
diesem Gerät merken" setzen, bleibt die Anschrift für das nächste Mal auf
Ihrem Gerät (Abschnitt 6).

*(Umsetzung: Heute merkt sich der Hub die Anschrift ohne Häkchen —
`lieferAdresseMerken()`. Bis T11 umgesetzt ist, lautet der Satz: „Ihr Gerät
merkt sich die Anschrift für das nächste Mal; sie verlässt es erst mit der
nächsten Bestellung.")*

### 5 · Reservierung  *(nur bei Reservierung)*

Name, Telefonnummer, Personenzahl, Termin und Ihr Wunsch — für die
Reservierung und Rückfragen (Art. 6 Abs. 1 lit. b DSGVO). Gelöscht 30 Tage
nach dem Termin.

### 6 · Was auf Ihrem Gerät gespeichert wird

Nach § 25 TDDDG zählt jedes Ablegen auf Ihrem Gerät. Alle Einträge sind für
eine Funktion nötig, die Sie nutzen (§ 25 Abs. 2 Nr. 2 TDDDG). Sie löschen sie
in den Einstellungen Ihres Browsers unter „Websitedaten".

| Eintrag | Wozu | Wie lange | Geht an uns? |
|---|---|---|---|
| Warenkorb (`…-merk`) | Ihre Auswahl samt Extras | bis zur Bestellung oder zum Leeren | erst mit der Bestellung |
| Extras (`…-opt`) | zuletzt gewählte Extras je Gericht | bis Sie Browserdaten löschen | nein |
| Wie letztes Mal (`…-zuletzt`) | Ihre letzte Bestellung, um sie mit einem Tipp zu wiederholen | bis Sie Browserdaten löschen, höchstens 30 Gerichte | nein |
| Probiert (`…-probiert`) | was Sie schon bestellt haben, damit „Neu für Sie" stimmt | bis Sie Browserdaten löschen | nein |
| Warteschlange (`omoteno-warteschlange`) | hält eine Bestellung, wenn die Verbindung kurz abreißt | bis sie angekommen ist | ja, das ist die Bestellung |
| Vorgänge (`omoteno-vorgaenge`) | Stand Ihrer laufenden Bestellungen | bis zum Abschluss | nein |
| Gerätekennung (`omoteno-geraet-…`) | eine zufällige Nummer, die **nach Ihrer ersten Bestellung** angelegt wird: für „Mein Tisch", Gutscheine, Besuche, Schutz vor Missbrauch. Für jeden Betrieb eine andere. | bis Sie Browserdaten löschen | **ja**, mit jeder Bestellung und beim Öffnen von „Mein Tisch" |
| Lieferanschrift (`…-lieferadresse`) | Anschrift fürs nächste Mal, nur mit Häkchen | bis Sie das Häkchen entfernen oder Browserdaten löschen | erst mit der Bestellung |
| Tisch und Tischsitzung (Tab-Speicher) | ordnet Ihre Bestellung Ihrem Tisch zu | bis der Tab geschlossen wird | ja, mit der Bestellung |
| Sprache (`tapto-sprache`) | Ihre Sprache | bis zur Änderung | nein |
| Helligkeit (`omoteno-licht-…`) | hell/dunkel | bis zur Änderung | nein |
| Darstellung des Hauses (`omoteno-farben-`, `-texte-`, `-kopf-`, `-lade-`, `-schrift-`, `-optionen-`) | Farben, Texte, Kopfbild und Extras des Hauses, damit die Karte ohne Netz richtig aussieht | bis zur nächsten Änderung durch das Haus | nein — kommt von uns |
| Bereiche, Willkommen, Aktionen, Alter (Tab-Speicher) | aufgeklappte Bereiche, Begrüßung einmal, Aktion gesehen, Altersbestätigung 16+/18+ | bis der Tab geschlossen wird | nein |
| Servicerufe (`omoteno-rufe-…`) | Zeitpunkte Ihrer Rufe, höchstens 4 in 10 Minuten | zehn Minuten | nein |
| Reservierungen (`omoteno-res-…`) | Nummer, Zeit, Personen Ihrer Anfragen | bis einen Tag nach dem Termin | die Anfrage selbst beim Absenden |
| Foodroulette (`…-fr-modus`) | Rad oder Karten | bis zur Änderung | nein |
| Quiz (`omoteno-quiz-gesehen`, `…-bestenliste`) | keine Frage doppelt, Ihre Punkte | bis Sie Browserdaten löschen | nein |

**Hinweis für die Umsetzung:** Die Zeile „Gerätekennung" ist nur richtig,
wenn T2 umgesetzt ist. Vorher würde sie lauten „beim ersten Öffnen der Karte"
— und dafür bräuchte es eine Einwilligung.

### 7 · Mein Tisch und Gutscheine

Nach Ihrer ersten Bestellung merken wir uns zu der zufälligen Gerätekennung,
wie oft Sie bei uns waren, was Sie gern bestellen und welche Gutscheine Sie
haben. Wir kennen dabei weder Ihren Namen noch Ihre Adresse
(Art. 6 Abs. 1 lit. b DSGVO, Stammgast-Vorteile, die Sie mit Ihrer Bestellung
nutzen). Gelöscht 24 Monate nach Ihrem letzten Besuch.

### 8 · Post vom Haus  *(nur mit Newsletter)*

Tragen Sie Ihre E-Mail-Adresse ein, schicken wir Ihnen erst eine
Bestätigungsmail. Erst wenn Sie die Adresse dort freigeben, schreiben wir
Ihnen — gelegentlich einen Gutschein, eine Einladung oder eine Erinnerung,
wenn Sie länger nicht da waren (Art. 6 Abs. 1 lit. a DSGVO, § 7 Abs. 2 UWG).
Dafür übermitteln wir an unseren Versanddienst Klaviyo, Inc. (USA): Ihre
Adresse, das Datum Ihres letzten Besuchs, die Zahl Ihrer Besuche, Ihr
Lieblingsgericht und bei Bestellungen Summe und Gerichte. Klaviyo verarbeitet
das in unserem Auftrag; Grundlage der Übermittlung in die USA ist {das EU-US
Data Privacy Framework / Standardvertragsklauseln}.
Sie können jederzeit widerrufen — über den Link in jeder Mail oder per Nachricht
an {betrieb.mail}. Was bis dahin geschah, bleibt rechtmäßig.

### 9 · Telefonbestellung mit Alessia  *(nur mit Alessia)*

Rufen Sie uns an, nimmt unter Umständen Alessia ab, eine KI-Assistentin. Sie
nimmt Fragen zur Karte und Bestellungen zur Abholung entgegen. Wir speichern
Ihre Rufnummer, den genannten Namen, die Abholzeit, die Bestellung und eine
Mitschrift des Gesprächs als Text (Art. 6 Abs. 1 lit. b DSGVO). Ihre Stimme
wird nicht aufgezeichnet. Dienstleister ist Vapi, Inc. (USA), in unserem
Auftrag. Die Mitschrift löschen wir nach 30 Tagen. Möchten Sie nicht mit
Alessia sprechen, sagen Sie es — oder bestellen Sie über die Karte.

### 10 · Trinkgeld über PayPal  *(nur mit Trinkgeld)*

Tippen Sie auf „Trinkgeld geben", öffnet sich PayPal. Ab dort gelten die
Bedingungen und die Datenschutzerklärung der PayPal (Europe) S.à r.l. et Cie,
S.C.A.; wir erfahren nur, dass ein Betrag eingegangen ist.

### 11 · Empfänger

Omoteno (Technik) und deren Dienstleister: Supabase (Datenbank in
Frankfurt am Main), Netlify (Auslieferung) {+ Klaviyo, Vapi, wenn genutzt}.
Bei US-Anbietern ist ein Zugriff aus den USA nicht ausgeschlossen; Grundlage
sind das EU-US Data Privacy Framework oder Standardvertragsklauseln.

### 12 · Ihre Rechte

Auskunft (Art. 15), Berichtigung (16), Löschung (17), Einschränkung (18),
Datenübertragbarkeit (20), Widerspruch (21), Widerruf einer Einwilligung
(7 Abs. 3). Eine Nachricht an {betrieb.mail} genügt.

**Widerspruch:** Gegen Verarbeitungen aus berechtigtem Interesse (Abschnitte
2 und 3) können Sie aus Gründen Ihrer besonderen Situation widersprechen.

Sie können sich bei einer Aufsichtsbehörde beschweren, etwa bei der in
Ihrem Bundesland oder der für uns zuständigen: {Aufsichtsbehörde des Landes,
in dem der Betrieb sitzt — für Hessen: Der Hessische Beauftragte für
Datenschutz und Informationsfreiheit, Postfach 3163, 65021 Wiesbaden}.

Es gibt keine automatisierte Entscheidung über Sie (Art. 22 DSGVO).

Stand: {Datum der Erzeugung}
