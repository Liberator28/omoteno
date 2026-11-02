# Admin-Board: Formulierungen und Saal — Befund und Vorschlag (02.11.)

Noch nichts davon ist umgesetzt. Jede Zeile hat eine Nummer; ein „Go“ kann einzelne ausnehmen („Go außer W12, W20“).

**So wurde gesucht:** Alle sichtbaren Texte aus `seiten/admin.html` wurden maschinell herausgezogen: Beschriftungen, Knöpfe, Hilfesätze, Platzhalter, Vorlesetexte und Meldungen aus dem Skript, zusammen **3 423 Stellen**. Danach liefen drei Suchen darüber:

1. „du/dein“ (das Board siezt sonst),
2. sichtbare Technik (Spalte, Migration, Supabase, Markenblatt),
3. englische und Fachwörter.

Zum Schluss wurden die 553 kurzen Beschriftungen und alle Texte des Saals einzeln gelesen.

---

## S · Saal (dein Foto)

| Nr. | Heute | Vorschlag |
|---|---|---|
| S1 | Das Maßschild „Theke 3,4 × 0,4 m“ bleibt stehen, solange die Theke gewählt ist; unter jedem Raumnamen steht immer „15,5 × 7 m“. | Das Maß erscheint **nur während des Ziehens** und blendet 1,5 s nach dem Loslassen aus. Unter dem Raumnamen steht es nur, während man die Raumgröße zieht. Im Blatt unten bleibt das Maß als Text stehen, für alle, die es nachlesen wollen. |
| S2 | Theke und Küche lassen sich nur verschieben. | Ein runder **Drehen-Knopf (↻)** steht am gewählten Möbelstück und im Blatt („Drehen“). Ein Tipp dreht um 90° um die eigene Mitte. Wo das gedrehte Stück nicht mehr in den Raum passt, wird es an die Wand geschoben. Pfeiltasten und Vorlesen gehen ebenfalls. **Ohne Datenbank-Änderung:** Gespeichert werden Breite und Tiefe vertauscht. |
| S2b | — | *Freies Drehen (z. B. 30°)* bräuchte ein neues Feld in `migration-saal-raeume.sql`. Diese Migration ist noch nicht live und dürfte nur von dir eingespielt werden. **Empfehlung:** erst 90°. In Gasträumen stehen Theken fast immer gerade an einer Wand. |
| S3 | Reiter „Tische · Bereiche · **Maße** · Stufen“. Theke und Küche liegen unter „Maße“. | **„Tische · Bereiche · Theke & Küche · Signale“.** Die Raumgröße wandert zum jeweiligen Bereich (Name + Größe an einer Stelle). Theke und Küche bekommen ihren eigenen Reiter. |
| S4 | „Stufen“, „Wann leuchtet was wie stark“, „Stufe 2 ab … / Stufe 3 ab …“ | Reiter „Signale“. Überschrift: „Wann ein Tisch auf sich aufmerksam macht“. Felder: „Deutlicher ab … Min“ und „Dringend ab … Min“. |
| S5 | „Ziehen verschiebt · der runde Griff ändert die Größe · zwei Finger oder ± zoomen.“ | „Mit dem Finger verschieben · am runden Punkt größer oder kleiner ziehen · ↻ dreht · mit zwei Fingern zoomen.“ |
| S6 | „Genaue Maße eintippen“ | „Maße genau eingeben“ |
| S7 | „Lage im Gebäude · von links (m) · von hinten (m)“ und „… zeichnet der Plan selbst — Gebäudeumrandung.“ | „Wo liegt dieser Bereich? · Meter vom linken Rand · Meter von der Rückwand“. Das Wort „Gebäudeumrandung“ entfällt: „Die Außenwände zeichnet der Plan selbst.“ |
| S8 | „Der Pass — hier holt der Service ab — …“ | „Die Durchreiche (hier holt der Service ab) …“ |
| S9 | „Theke / Bar“ und „＋ Theke / Bar“ neben „Theke“ | Einheitlich „Theke“ und „＋ Theke dazu“ |
| S10 | „still seit 25 Min“ | „seit 25 Min keine Bestellung“ |
| S11 | „Tischsitzung offen (Untersetzer gescannt)“ | „Gast hat den Tisch-Code gescannt“ |
| S12 | „Noch keine Tische angelegt … Danach stellst du sie hier auf.“ | Siezen: „Danach stellen Sie sie hier auf.“ (siehe W1) |

---

## W · Ganzes Board

### Grundsätzliches (betrifft viele Stellen auf einmal)

| Nr. | Befund | Vorschlag |
|---|---|---|
| W1 | **17 Stellen duzen**, sonst siezt das Board. Beispiele: Karte („Ausverkauftes stellst du …“), Zahlen („für deine Rolle nicht freigeschaltet“), Saal („fehlt dir das Recht“), Kacheln („verschiebst du oben“), Profi-Foto („melde dich beim Omoteno-Team“, „Vergleiche und übernimm“). | Alle 17 auf „Sie“. |
| W2 | **Technik in Meldungen an den Wirt** (rund 30 Stellen): „Die Spalte hub_stil fehlt noch. Bitte migration-hub-stil.sql einspielen.“, „In Supabase fehlt ANTHROPIC_API_KEY“, „In Supabase muss eine Zeile in betrieb_mitglieder stehen“, „Die Datenbank kennt ‚gebracht_um‘ noch nicht“ … Der Wirt kann damit nichts anfangen. | Ein Satz für alle: **„Diese Funktion ist in Ihrem Konto noch nicht freigeschaltet. Bitte geben Sie Omoteno kurz Bescheid.“** Den technischen Namen bekommt Omoteno weiter: als Kennung klein darunter („Code: hub-stil“) und in der Browser-Konsole. |
| W3 | **Drei Wörter fürs Speichern:** „Übernehmen“ (Gast-Hub), „Sichern“ (Gericht, Kategorie, Profi-Foto), „Speichern“ (Saal, Bezahlen). | Überall **„Speichern“**. Wo es sofort bei Gästen ankommt, steht darunter „Gäste sehen es beim nächsten Öffnen“. Das steht schon fast überall. |
| W4 | **„Gast-Hub“ / „Hub“** ist Omoteno-Sprache. | **„Gästeseite“**: „Gästeseite gestalten“, „Adresse Ihrer Gästeseite“, „Ihre Worte auf der Gästeseite“. *(Große Umbenennung, über 100 Stellen. Wenn dir „Hub“ als Markenwort wichtig ist: auslassen.)* |
| W5 | **„Markenblatt“** (8 Stellen): „Auf Markenblatt zurück“, „kommt aus dem Markenblatt Ihres Hauses“. | „Grundeinstellung Ihres Hauses“. Der Knopf heißt „Zurück auf Ihre Hausfarben“ bzw. „Zurück auf die Grundeinstellung“. |
| W6 | **„scharf schalten“** (Board scharf schalten, „noch nicht scharf“, „Board ist scharf“). | „Ton & Hinweise einschalten“, „Ton und Hinweise sind noch aus“, „Ton und Hinweise sind an“. |

### Einzelstellen

| Nr. | Ort | Heute | Vorschlag | Warum |
|---|---|---|---|---|
| W7 | Aktionen | „Top-Runner“ | „Aktion“ / „Aktion des Tages“ | Englisches Kunstwort |
| W8 | Bestellungen | „Team-Modus“, „Team-Modus an/aus“ | „Bestellungen verteilen“ (an/aus) | Sagt, was passiert |
| W9 | Team-Modus | „Gerecht · Zufällig · Von Hand“ | bleibt, mit Satz darunter: „Gerecht: Wer am wenigsten offen hat, bekommt die nächste.“ | Fehlte im Board |
| W10 | Einstellungen → Zugriffsrechte | „von der Datenbank erzwungen“ / „steuert nur die Anzeige“ | „Fest gesperrt“ / „Nur ausgeblendet“ | Fachsprache |
| W11 | Farben | „Fassung · Tag · Abend“, „Abendfassung“ | „Farben für · Tag · Abend“, „Eigene Farben am Abend“ | „Fassung“ versteht niemand |
| W12 | Farben | „Kopfband“, „Für alles, was Gäste lesen“ | „Farbband oben“; die Zeile darunter: „Schrift (für alles, was Gäste lesen)“ | Fachwort |
| W13 | Farben | „Leise Schrift, Linien und die Schrift auf dem Kopfband rechnet das Board …“ | „Hellere Nebenschrift und Linien stellt das Board selbst passend ein.“ | |
| W14 | Ihre Worte | „Kennzeile“ (Kopf der Speisekarte) | „Kleine Zeile über der Überschrift“ | |
| W15 | Ihre Worte / Alle Texte / Texte & Schrift | Drei Namen für dasselbe Thema | „Die wichtigsten Texte“ (Slogan, Gruß, WLAN …) und „Alle Texte“ | Man weiß nicht, wo was steht |
| W16 | Gericht | „Freisteller“, „Pop-Ansicht“, „Freisteller für die Pop-Ansicht ist gesetzt“ | „Foto ohne Hintergrund“, „schwebende Ansicht“ | |
| W17 | Gericht | „✨ Profi-Foto erstellen“ | bleibt; darunter: „Die KI macht aus Ihrem Foto ein Studiofoto. Sie entscheiden danach.“ | Was passiert, stand nicht da |
| W18 | Gericht | „Wer macht das? — bestimmt, wer es im Küchendisplay sieht“ | „Wer bereitet das zu? (Küche oder Theke — dort erscheint der Bon)“ | |
| W19 | Gericht | „nach LMIV · Mehrfachauswahl“, „nach LMZDV · nur wenn zutreffend“ | „Mehrere möglich“, „Nur ankreuzen, was drin ist“; die Abkürzungen nur in der Anleitung | Abkürzungen |
| W20 | Gericht | „Beliebt (Highlights)“ | „Beliebt — erscheint oben in der Karte“ | |
| W21 | Lieferung | „Vorlauf in Minuten“ | „Frühestens abholbereit nach … Minuten“ | |
| W22 | Lieferung | „Mehrweg:“ (Zeilenanfang) | „Mehrweg-Pflicht:“ und der Satz dahinter in Alltagssprache | |
| W23 | Rabattcodes | „Vorsilbe (freiwillig)“ | „Anfang des Codes (freiwillig, z. B. SOMMER)“ | |
| W24 | Newsletter | „Rabattcode-Vorrat“, „20 neue Codes anlegen“ | „Codes für den Newsletter: noch X übrig“, „20 Codes nachfüllen“ | |
| W25 | Newsletter | „In Klaviyo auf ‚Live‘ stellen“, „Klaviyo-Upload fehlgeschlagen“ | „… in Klaviyo einschalten“, „Hochladen zu Klaviyo hat nicht geklappt“ | |
| W26 | Nichts übersehen | „Mahnen nach“, „Servicerufe mahnen nach“ | „Erinnern nach“, „Bei Servicerufen erinnern nach“ | |
| W27 | Nichts übersehen | „Titel des Tabs blinkt“ / „Liegt das Board im Hintergrund, zeigt der Tab …“ | „Browser-Tab blinkt, wenn etwas wartet“ | |
| W28 | Bildschirm | „Aus der Ferne lesen“ | „Große Schrift (zum Lesen aus Abstand)“ | |
| W29 | Bildschirm | „Ganz schwarz — Für dunkle Räume, OLED“ | „Ganz schwarz — Für dunkle Räume, schont den Akku“ | „OLED“ ist Technik |
| W30 | Aufbau | „Block“, „Eigener Textblock“, „Blöcke ordnen, zeigen, verstecken“ | „Baustein“, „Eigener Text“, „Bausteine ordnen, zeigen, verstecken“ | „Block“ klingt nach Sperre |
| W31 | Kacheln | „Rubrik“ (aufklappbare Gruppe) | „Abschnitt“ | Seltenes Wort |
| W32 | Speisekarte-Stil | „Liste, Bühne, Raster, Flink oder Teller“ | Namen bleiben; die Kachel sagt: „So sieht die Karte für Gäste aus“ | Die Namen allein sagen nichts |
| W33 | Startseite | „Aktion · Top-Runner (Knopf unten rechts)“ | „Aktion (kleiner Knopf unten rechts)“ | |
| W34 | Vorschau | „Live — ändert sich beim Tippen. Übernommen ist erst nach ‚Übernehmen‘.“ | „Vorschau — ändert sich beim Tippen. Für Gäste gespeichert ist es erst nach ‚Speichern‘.“ | „Live“ klingt nach „schon bei Gästen“ |
| W35 | Kopf | „wechseln“, „verbinde“ (Kleinschreibung oben im Kopf) | „Betrieb wechseln“, „Verbinde …“ | |
| W36 | Reiter | „Ausgabe“, „Verfügbar“ (unter „Mehr“) | „Ausgabe (Abholung)“ bzw. „Was gerade aus ist“. *Vor der Umsetzung prüfe ich, was dort genau steht.* | Mehrdeutig |
| W37 | Notizen | „Beim Gast zurückziehen“ | „Für den Gast wieder ausblenden“ | |
| W38 | Lieferung | „0 = nie“ (bei „Ab dieser Summe kostenlos“) | „0 = Lieferung kostet immer“ | Doppelte Verneinung |
| W39 | Willkommen | „Gilt ab dem nächsten Besuch eines Gastes“ vs. sonst „Gäste sehen es beim nächsten Öffnen“ | Überall derselbe Satz: „Gäste sehen es beim nächsten Öffnen“ | Einheitlich |
| W40 | Sperre | „Das geht nicht bei deinem eigenen Zugang.“ | „Bei Ihrem eigenen Zugang geht das nicht.“ | Teil von W1 |

---

## Was die Umsetzung mitbringt

- **Prüfungen ziehen mit.** Rund 40 Prüfungen klicken oder suchen Beschriftungen (z. B. „Übernehmen“, „Scharf schalten“, „Top-Runner“, die Reiter des Saals). Die Wiki-Prüfung (`pruef-tour-board`) hält jede Beschriftung der Anleitung gegen das Board. Jede Umbenennung wird in den Prüfungen nachgezogen, nicht abgeschaltet.
- **Anleitung und Tour** bekommen dieselben Wörter.
- **Reihenfolge:** zuerst Saal (S1–S12), dann W1–W3 (das Grundsätzliche), dann die Einzelstellen. Jeder Block wird geprüft, bevor der nächste kommt.
- **Ehrliche Grenze:** Das Drehen um 90° vertauscht Breite und Tiefe. Ohne die Migration `migration-saal-raeume.sql` (nicht live) speichert der Saal live weder Maße noch Drehung.
