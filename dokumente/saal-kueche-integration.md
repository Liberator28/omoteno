# Saal ↔ Küche · Integrationsplan

Stand 24.10.2026. Entstanden aus dem Stabilisierungsauftrag, Punkt 4. **Das ist ein Plan, keine
Umsetzung.** Jede Aussage trägt ihre Herkunft:

- **[Code]** aus dem Quelltext gelesen, nicht im Betrieb gemessen
- **[live]** am 24.10.2026 lesend aus der Live-Datenbank gelesen
- **[offen]** nicht gemessen, nicht belegt

## 1 · Maßgebliche Datenquelle

Die Zeile in `public.bestellungen`. Der Saal speichert keinen Bestellzustand, er **leitet ab**
(`saalStand()`): Neu, In Arbeit, Servieren, Ruf, Zahlung prüfen, „sitzt“ — alles aus `status`,
`pruefen`, `quelle`, `kueche_fertig_um`, `theke_fertig_um`, `gebracht_um`, `zeitpunkt` [Code].
Eigenen Zustand haben nur `tische` (Lage, Form, Plätze, Bereich) und `saal_einstellungen`
(Bereiche, Leuchtstufen) [live]. Es gibt damit **keine zweite Wahrheit**, die auseinanderlaufen
könnte; das ist die wichtigste Eigenschaft und soll bleiben.

## 2 · Übertragung

| Weg | Wie | Verzögerung |
|---|---|---|
| Küche → Datenbank | `PATCH /bestellungen?id=eq.…` mit nur den geänderten Feldern (`setzeBon`) [Code] | sofort, im Bild optimistisch |
| Datenbank → Board (und Saal) | Realtime `postgres_changes` INSERT/UPDATE, dazu `nachholen()` alle 25 s als Netz [Code]; `bestellungen` ist in der Realtime-Veröffentlichung [live] | Sekunden |
| Datenbank → Küche | Abfrage alle `TAKT_MS` (4 s) mit fester Spaltenliste, kein Realtime [Code] | bis ca. 4 s |
| Board → Datenbank | `update(...).eq("id").eq("betrieb_id")` (`statusSetzen`) [Code] | sofort, optimistisch |

Heißt: **Küche → Saal ist bereits verdrahtet.** „Abholbereit“ in der Küche schreibt
`kueche_fertig_um`, der Realtime-UPDATE trifft das Board, `neuZeichnen()` zeichnet den Saal neu
(Stufe „Servieren“) [Code]. Als Ende-zu-Ende-Lauf gegen echte Datenbank und zwei Geräte ist das
**[offen]**; die Prüfungen stellen die Antworten.

Die Gegenrichtung (Saal → Küche) fehlt: Die Küche liest `gebracht_um` nicht [Code, `BON_SPALTEN`].
Ein Tisch, den der Service als „gebracht“ markiert, bleibt in der Küche so stehen, wie er war.
Das stört nicht (die Küche hakt selbst ab), ist aber der Grund, warum der Satz „der Service
bekommt Bescheid“ nur in eine Richtung gilt.

## 3 · Gleichzeitige Änderungen

- **Verschiedene Felder:** unkritisch. Jeder Schreibweg schickt nur seine Felder; Küche setzt
  `kueche_fertig_um`, Board `zugewiesen` — sie überschreiben einander nicht [Code].
- **Dasselbe Feld (`status`):** letzter Schreiber gewinnt. Das Board schützt nur sich selbst
  (`inArbeit`: eine laufende eigene Änderung wird nicht von einer fremden Antwort zurückgedreht)
  [Code].
- **Lücke, live belegt:** Die Datenbank hat **keinen Wächter für Statusübergänge** [live]. Nur
  der Übergang *in* „storniert/abgelehnt“ hat einen Trigger (Zahlung merken), nichts verhindert
  „storniert → arbeit“. Die Küche schützt sich im Client (`b.status !== "storniert"` beim
  Abhaken) [Code]; das Board nicht. Zieht der Gast im richtigen Augenblick zurück und tippt
  das Personal gleichzeitig „Starten“, kann die Stornierung überschrieben werden.
  **[Risiko, nicht behoben]**

**Umgesetzt am 24.10.2026** (`pruefungen/pruef-endstand.js`, 79 Proben, 9 Gegenbeweise rot): bedingtes Schreiben —
`…&status=neq.storniert&status=neq.abgelehnt` an beiden Schreibwegen, dazu `Prefer: return=representation`,
damit „0 Zeilen“ als „inzwischen storniert“ erkannt und gezeigt wird statt als Erfolg (§2.3b). Der Filter
hängt nur an Schreibwegen, die `status` setzen — die Küche hakt einen stornierten Bon ab, indem sie nur
`kueche_fertig_um` schreibt, und das bleibt möglich. Ohne lesbare Zeilenliste in der Antwort gilt das
Schreiben als gelungen (fail-open, §7). Der Filter lautet `or(status.is.null, status.not.in.(storniert,abgelehnt))`: `bestellungen.status`
ist nullbar (Vorgabe „neu“, kein CHECK; live 24.10.: 0 Zeilen ohne Status), und `NULL NOT IN (…)` ist in SQL
„unbekannt“ — ein einfaches `not.in` hätte eine Zeile ohne Status nie mehr bedienbar gemacht. **Ehrliche Grenze:** Die gestellten Gegenstellen werten den Filter
wie PostgREST aus; ob die echte Datenbank `status=not.in.(…)` genauso trifft, ist im Browser nicht
gemessen. Am lokalen Postgres wurde es nicht nachgestellt (dort fehlt PostgREST selbst).

## 4 · Rollen je Zustand

Soll (Absicht des Hauses) und Ist [live]:

| Handlung | Soll | Ist in der Datenbank |
|---|---|---|
| Gast bestellt / storniert | nur über `bestellung_aufgeben` / `bestellung_stornieren`, Frist | stimmt — `anon` hat keine Tabellenrechte [live] |
| Status ändern, Zusage, Abholbereit, Gebracht, Zuweisen | Team und Inhaber | stimmt — jede Mitgliedschaft [live] |
| Preis, Summe, Positionen, Rabatt einer Bestellung ändern | **niemand** (nur über Funktionen) | **offen:** `authenticated` darf 34 Spalten ändern, darunter `summe`, `positionen`, `rabatt_betrag`, `betrieb_id`; die Regel unterscheidet nicht zwischen Team und Inhaber [live] |
| Saal einrichten (Lage, Bereiche, Stufen) | nur Inhaber | stimmt — lokal mit Gegenbeweisen belegt (`pruef-saalplan-lokal.sh`), live-Regeln gelesen |

Die Zeile „Preis ändern“ ist der gewichtigste Befund dieser Prüfung. Er ist älter als der Saal
(CLAUDE.md §2.3f beschreibt dieselbe Klasse). Gegenmittel: Spaltenrecht auf das kürzen, was Board
und Küche tatsächlich schreiben, **nachdem** jeder Schreibweg beider Dateien einzeln aufgelistet
und gegen die 34 Spalten gehalten ist. Das ist ein eigenes Vorhaben mit Freigabe, kein
Nebenbei-Eingriff.

## 5 · Externe Bestellungen

Lieferung, Telefon (Alessia), Serviceruf haben `quelle ≠ tisch` oder keinen Tisch [Code]. Der
Saal führt sie unter „Außerhalb des Plans“ und zählt sie in der Liste mit; **nichts wird
unsichtbar** (CLAUDE.md §7) [Code, `saalStand().rest`]. Die Küche zeigt sie ohnehin alle.
Wünsche dazu (Lieferwagen im Plan, Lieferung als Aufgabe weitergeben) setzen darauf auf und
brauchen **vorher** die Klärung, wer eine Lieferung „besitzt“: heute gibt es dafür nur
`zugewiesen` (Nummer 1–99, Team-Modus) [live].

## 6 · Netzwerkprobleme und veraltete Daten

- Board: Kopfzeile zeigt „live verbunden“ / „Verbindung unterbrochen – hole nach“; bei Abbruch
  Nachholen nach 2 s, sonst alle 25 s; pausiert bei verstecktem Tab [Code].
- Küche: Netzstatus und „vor Xs“ [Code].
- **Lücke:** Der Saal selbst kennzeichnet nicht, wie alt sein Stand ist. Nur die allgemeine
  Kopfzeile des Boards spricht. Ein Kellner am Plan sieht bei gekappter Leitung einen scheinbar
  gültigen, in Wahrheit alten Stand. [Code; Wirkung am Gerät offen]
  **Umgesetzt am 24.10.2026:** Band `#spAlter` über dem Plan, ab > 60 s seit dem letzten Lebenszeichen
  (Erstladen, Nachholen, Live-Ereignis, Abo-Bestätigung): „Stand von vor N Min – Verbindung prüfen“. Nur
  Text und `hidden`, kein Neuaufbau des Plans; im Vorführmodus nie. Grenze: Es misst, wann das Board zuletzt
  etwas **gehört** hat, nicht, ob die Leitung heute still ist, weil nichts los war — bei einem ruhigen Haus
  kommt das Nachholen alle 25 s, das ist das Lebenszeichen.
- Optimistische Anzeige (Board und Küche) mit Rückdrehen und Toast bei Fehler [Code].

## 7 · Beeinträchtigungen und Reihenfolge

- Die Küche darf nicht langsamer oder instabiler werden: Ihr Abfragepfad (4 s, feste Spalten,
  Stufen-Rückfall) bleibt unangetastet; jede Änderung dort bekommt eine eigene Prüfung gegen die
  Küchen-Prüfungen (`pruef-abholbereit`, `pruef-bestellkarten`, `pruef-storno`, `pruef-telefonbon`).
- Der Saal zeichnet nur bei geänderter Signatur (§4.2) und nur, wenn er sichtbar ist (§8.1u).
  Mehr Datenquellen ändern daran nichts, solange sie in `saalStand()` einfließen.
- Umsetzungsreihenfolge, kleinste vollständige Schritte, jeder einzeln prüfbar:
  1. ~~Bedingtes Schreiben gegen Überschreiben von „storniert/abgelehnt“ (Abschnitt 3).~~ **Erledigt 24.10.**
  2. ~~Alter-des-Standes im Saal (Abschnitt 6).~~ **Erledigt 24.10.**
  3. Spaltenrecht auf `bestellungen` kürzen — **mit Freigabe**, nach Wegeliste (Abschnitt 4).
     **Vorbereitet am 24.10.2026, eingespielt am 25.10.2026:** Wegeliste `dokumente/bestellungen-schreibwege.md`, Migration
     `datenbank/migration-bestellungen-spaltenrechte.sql` (9 statt 34 Spalten), lokale Probe (21 Proben, Gegenbeweise)
     und `pruefungen/pruef-bestellungen-schreibwege.js`. Vor dem Einspielen die drei Lesefragen im Kopf der Migration
     gegen die Live-Datenbank stellen.
  4. Küche liest `gebracht_um` (Rückrichtung), erst nach 1–3.
  5. Erst danach die Wünsche: Gästezahl, Raummaße/Sperren, Lieferwagen, Nachrichtenvorlagen.

## Ehrliche Grenzen

- Kein Lauf auf einem echten Gerät, kein Lauf mit zwei gleichzeitigen Geräten gegen die echte
  Datenbank.
- Die Aussagen zur Realtime-Verzögerung sind Erwartung aus dem Code, nicht gemessen.
- Live wurde nur gelesen. Es wurde nichts geschrieben, keine Probe live ausgeführt.
