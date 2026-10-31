# Gericht für Gericht fertig melden · Küche auf dem Saalplan

Wunsch vom 25.10.2026: „Man soll einstellen, wo die Küche ist auf der Karte. Dann soll der Koch im Küchenboard dem Service
Bescheid sagen können, welche Speise fertig ist, damit sie zum Tisch gebracht werden kann.“

## Was es gibt

| Teil | Wo | Was |
|---|---|---|
| Knopf je Zeile | Küchenboard (`kueche.html`) | Jede Position des Bons hat „Fertig“ (≥ 44 px). Tipp meldet **dieses** Gericht, zweiter Tipp nimmt zurück — solange der Service es nicht gebracht hat. „Gebracht“ ist gesperrt. |
| „Abholbereit“ für den ganzen Bon | Küchenboard | Meldet zusätzlich alle Gerichte der Ansicht, die noch offen sind; der alte Weg (`kueche_fertig_um`/`theke_fertig_um`) läuft unverändert weiter. „Wieder öffnen“ nimmt nur Gemeldetes zurück, das noch nicht gebracht ist. |
| „Zum Abholen“ | Admin-Board | Sobald auch nur ein Gericht eines Bons gemeldet ist, zählen die Gerichte: „2 von 3 fertig“, die Karte nennt **nur** die fertigen. Abholton einmal je jüngerer Meldung. „Gebracht“ sendet genau die Nummern, die am Schirm standen. |
| Bestellkarte | Admin-Board, Reiter Bestellungen | Marke „✓ fertig“ / „gebracht“ je Zeile und eine Zeile „Bitte servieren: …“ mit eigenem „Gebracht“. |
| „Servieren ×n“ | Saalplan | Am Tisch zählt es die Gerichte am Pass (nicht die Bons); die Wartezeit ist die des ältesten. |
| Küche einzeichnen | Saalplan → Einrichten → Maße | Rechteck in Metern (1–30), höchstens **eine** im Gebäude. Der Pass liegt auf der Seite zur Raummitte. Ist an einem Tisch im selben Raum ein Gericht fertig, führt eine gestrichelte Linie vom Pass dorthin (nur Anzeige). |

## Datenmodell

`datenbank/migration-gericht-fertig.sql` (ENTWURF, **nicht live**): Spalte `bestellungen.positionen_fertig jsonb` —
Schlüssel = Nummer der Position (ab 0), Wert `{"f": fertig um, "g": gebracht um}`. Geschrieben wird **nur** über zwei
`security definer`-Funktionen (`gericht_fertig_setzen`, `gerichte_gebracht_setzen`); die Spalte steht nicht im UPDATE-Recht
von `authenticated` (CLAUDE.md §2.3a/§2.3f). Warum Funktionen: Zwei Köche an zwei Schirmen hakten sonst verschiedene
Gerichte ab, und ein UPDATE mit dem ganzen Objekt ließe den späteren den früheren überschreiben. Die Funktion sperrt die
Zeile und ergänzt nur. Absagen kommen als Antwort (`grund`), nie als Ausnahme (§2.3g).

Die Küche der Karte steht in `saal_einstellungen.daten.raeume[i].kueche = {x,y,b,t}`; geprüft von
`saal_einstellungen_setzen` (`datenbank/migration-saal-raeume.sql`, erweitert — gleiche Signatur, §2.1).

## Rückfallstufen (additiv, §2.5)

- Fehlt die Spalte, antwortet PostgREST 400: Die Küche fragt dann ohne sie weiter (`BON_SPALTEN_STUFEN`), das Board liest sie nur, wenn sie in den Zeilen vorkommt.
- Fehlt die Funktion (404), sagt die Küche „Die Datenbank kennt ‚Gericht fertig‘ noch nicht (migration-gericht-fertig.sql)“ und nimmt den Knopf zurück.
- Ohne gemeldetes Gericht gilt für jeden Bon der alte Weg je Spur.

## Prüfungen

- `pruefungen/pruef-gericht-fertig.js` — Küche, Board (1280/390 px), Saal; echte Tipps; die Funktion wird im gestellten Server wie in der Datenbank ausgeführt (nur ergänzen, Gebrachtes bleibt).
- `pruefungen/pruef-gericht-fertig-lokal.sh` + `datenbank/pruef-gericht-fertig.sql` — lokales Postgres 16 mit den echten Funktionen (34 Proben, Zeilenzahl statt Ausnahme).
- `pruefungen/pruef-saalplan-lokal.sh` — die erweiterte Saal-Funktion (Küche: Schlüssel, Maße, nur eine).

## Ehrliche Grenzen

- Beide Migrationen sind **nicht eingespielt** (das Supabase-Werkzeug war in dieser Sitzung nicht erreichbar). Bis dahin zeigt die Küche den Knopf, aber jeder Tipp endet im Satz „kennt … noch nicht“.
- Nur kopfloses Chromium; kein Gerät, kein echter Schirm in der Küche.
- Gleichzeitigkeit zweier Köche ist in der Datenbankprobe über die Funktion belegt, nicht mit zwei echten Verbindungen gleichzeitig gemessen.
- Meldet der Koch über „Abholbereit“ und die Funktion scheitert, steht lokal kurz „fertig“, bis der nächste Abruf (4 s) den Serverstand zeigt; der alte Weg trägt die Meldung trotzdem.
- Die Linie vom Pass führt nur zu Tischen **im Raum der Küche**; ein Tisch in einem anderen Raum zeigt „Servieren“ am Tisch selbst, aber keine Linie.
- Die Küche ist ein Rechteck ohne Kollisionsprüfung mit Theke oder Tischen.
