# Saalplan mit echten Maßen: Räume, Theke, Gebäude, Lieferauto

Wunsch vom 25.10.2026: Bei den Einstellungen der Tische und Räume die Metermaße eintragen — das Programm zeichnet den Raum, in
Kästchen von 1 × 1 m unterteilt, so wie er in echt ist. Dazu eine Bar / Theke, die Gebäudeumrandung, Herauszoomen auf das ganze
Gebäude mit den jeweiligen Bestellungen, und daneben ein Lieferauto, das beim Antippen alle Lieferungen zeigt.

## Was es gibt

| Teil | Wo | Was |
|---|---|---|
| Raum in Metern | Reiter **Maße** in „Saal einrichten“ (nur Inhaber) | Breite und Tiefe je Bereich (2 bis 60 m, eine Nachkommastelle, „7,5“ und „7.5“ gelten), Lage im Gebäude (leer = rechts neben dem vorigen Raum), bis zu drei Theken je Bereich. Ohne Angabe ist jeder Raum 10 × 10 m. |
| 1×1-m-Raster | `saalGitter()` | Eine Linie je Meter, jede fünfte kräftiger; zwei Pfade je Raum. Bei 15,5 m Breite 15 Linien — das letzte Kästchen ist 0,5 m breit. |
| Tische | `saalTischSVG()` | Die Zeichnung der Tische (rund Ø 1,05 m, eckig 1,1 × 1,1 m, lang 1,75 × 0,8 m) wird um den Nullpunkt gezeichnet und als Ganzes auf den Platz gesetzt (`translate` + `scale(SAAL_M)`); alles Beschriftete rechnet die Verkleinerung über `--ts` wieder heraus. Ein Tisch behält `x`/`y` als **Anteil 0–100 seines Raumes** — ändert sich das Maß, wandert er mit. |
| Theke / Bar | `saalThekeSVG()` | Quader mit Platte, Hocker (je 0,9 m) auf der Seite zur Raummitte, Schild „Theke“. |
| Gebäude | `saalSzene()` | Umriss um alle Räume (hohe Rückwände, niedrige Vorderwände — nichts verdeckt Tische von vorn), Gelände und Straße. |
| Rauszoomen | `saalPassend()` | Zwei Rahmungen: der gezeigte Raum (`SAAL.passt`) und das ganze Gebäude samt Auto (`SAAL.passtGeb`). Unterste Zoomstufe = Gebäude × 0,8. Knopf „Ganzes Gebäude zeigen“ in der Werkzeugleiste. Alle Räume werden gezeichnet, im Gebäudebild leuchten alle Tische mit Bedarf. |
| Andere Räume | Zeiger | Tipp auf Boden, Schild **oder Tisch** eines anderen Raums zoomt in diesen Raum (im Gebäudebild sind Tische klein und dicht; gewählt wird erst der nächste Tipp). |
| Lieferauto | `saalAutoSVG()` | Elektrotransporter in derselben Isometrie (4,7 × 1,95 × 2,35 m): Seitenfenster, Räder, Streifen, Schriftzug, Frontlicht mit Leuchtband, Sensor mit Puls (nur `opacity`). Steht, wenn das Haus liefert oder etwas zu liefern ist (Vorführhaus immer). Schild auf der Straße zählt die offenen **Lieferungen** (Abholungen nicht). Tipp — oder Knopf „Lieferungen zeigen“ in der Werkzeugleiste, der auch geht, wenn das Auto außerhalb des Bildes steht — zeigt genau diese Karten im Blatt unter dem Plan. |

## Speicherung

Keine neue Spalte, keine neue Tabelle: `saal_einstellungen.daten.raeume`, ein Eintrag je Bereich in der Reihenfolge von `zonen`:

```json
{ "zonen": ["Haupt-Raum", "Terrasse"], "stufen": { … },
  "raeume": [ { "b": 12, "t": 9, "x": null, "y": null, "theken": [ { "x": 2.5, "y": 7.6, "b": 7, "t": 0.8 } ] },
              { "b": 8, "t": 5, "x": null, "y": null, "theken": [] } ] }
```

`datenbank/migration-saal-raeume.sql` ersetzt NUR die Funktion `saal_einstellungen_setzen` (gleiche Signatur) und prüft Form und
Grenzen. **Noch nicht live eingespielt** (das Supabase-Werkzeug war in dieser Sitzung nicht erreichbar). Ohne sie läuft das Board
weiter: Speichern ohne Maße geht wie vorher (kein Schlüssel `raeume` in der Nutzlast, solange alles Vorgabe ist); mit Maßen kommt der
Satz „Die Maße lassen sich noch nicht speichern (migration-saal-raeume.sql fehlt).“

Einspielen: SQL-Editor, danach (CLAUDE.md §2.1) `select pg_get_function_identity_arguments(p.oid) … where proname = 'saal_einstellungen_setzen'`
— genau eine Zeile.

## Prüfungen

- `pruefungen/pruef-saal-raeume.js` — Boden, Raster, Tischmaße, Theke am **gemalten Bild** (eigene Umkehr der Projektion); Gebäude,
  Rauszoomen, Tipp auf andere Räume; Einrichten (Maße, Theke, Lage, Ziehen, Speichern, Neuladen); Lieferauto.
- `pruefungen/pruef-saalplan-lokal.sh` — lokales Postgres 16 mit den echten Funktionen; 28 neue Zeilen (`RM…`) in
  `datenbank/pruef-saal-raeume.sql`, fast alle mit UNGÜLTIGEN Werten (§2.3g), Höchstmaß passt in die Schranke (< 3500 Byte).
- `pruefungen/pruef-saalplan.js` — Altprüfung, an die Mehrbereichs-Szene angepasst (zählt je Bereich, nicht alles).

## Ehrliche Grenzen

- Kopfloses Chromium, kein Gerät; die Zeichnung ist nicht auf einem iPhone gesehen.
- Theken stehen per Zahlenfeld, nicht per Ziehen; sie sind keine Hindernisse für Tische (keine Kollisionsprüfung).
- Das Gebäude ist ein Rechteck um alle Räume; eine Terrasse „vor der Tür“ liegt innerhalb dieses Umrisses.
- Mehrere Standorte einer Kette teilen sich keinen Plan: jeder Betrieb hat sein eigenes Gebäude.
- Das Auto zeigt keine Fahrer, Touren oder Positionen — es zählt und listet nur die offenen Lieferungen.

---

## Belegung: wer sitzt wo, und ist er noch da? (01.11.)

Wunsch: „… so soll man sehen wie viele Leute dort sitzen und welche Bestellungen und ob ein Gast noch da ist.“

**Zuerst einspielen, sonst sieht man live nichts davon.** Beide Dateien gehen in den SQL-Editor, in dieser Reihenfolge:

1. `datenbank/migration-saal-raeume.sql` — Meter, 1×1-m-Raster, Theke, Küche. Ohne sie speichert „Maße“ nicht.
2. `datenbank/migration-tisch-belegung.sql` — Personen am Tisch, Stand, Anwesenheit.

Danach je Funktion genau eine Fassung (§2.1):
`select proname, pg_get_function_identity_arguments(oid) from pg_proc where proname in ('saal_einstellungen_setzen','tisch_belegung_setzen','saal_anwesenheit');`

**Woher das Board weiß, was es zeigt** (in dieser Rangfolge):

| Quelle | Was sie sagt | Ehrlich |
|---|---|---|
| `tisch_belegung` | Personen, „da“ / „zahlt“ / „frei“, seit wann | Wissen — der Service trägt es ein |
| `saal_anwesenheit()` | letzte Aktivität der Tischsitzung, ob sie gilt | Hinweis: live gibt es EINE Sitzung je Tisch, keine Gerätezahl |
| Bestellungen | der alte Hinweis „Gäste da“ | Vermutung |

**Im Plan** steht unter der Tischnummer ein Schild: `3/4` (Personen/Plätze), `· zahlt`, `· still` (20 Minuten ohne Aktivität), `frei`.
Minuten stehen nur in Liste und Blatt — sonst wäre jede Minute ein Neuaufbau des Plans (§4.2). Ein Tisch, den nur die Bestellungen
kennen, bekommt nur „still“, sonst kein Schild (das Zeichen am Tisch sagt schon „da“).

**Im Blatt** des gewählten Tisches: Gäste − / + (≥ 44 px), „Zahlt gerade“, „Gäste gegangen · Tisch frei“, „besetzt seit“, zuletzt
aktiv, woher es stammt, und die Summe dieses Besuchs (Bestellungen, Gerichte, Euro). „Frei“ gilt, bis danach eine Bestellung oder ein
Scan kommt.

**Links:** „10 Gäste im Haus · 18 freie Plätze“, Personen je Zeile mit Bedarf, darunter „Besetzt · alles gut“ (eigene Klasse
`.sp-tr`, nicht `.sp-tz` — die Prüfungen der Bedarfsliste zählen `.sp-tz`, §1.1).

**Assistent für einen leeren Saal:** Breite und Tiefe in Metern, Plätze je Tisch → der Raum entsteht in 1×1-m-Feldern, die Tische
werden im 2,4-m-Raster verteilt (≥ 2 m auseinander), der Editor ist offen. Gespeichert wird erst mit „Speichern“ — derselbe Weg und
dieselbe Prüfung wie von Hand. Grenzen wie die Datenbank: 2–60 m, eine Nachkommastelle.

**Rechte:** lesen alle Mitglieder; eintragen auch das Team (der Kellner zählt die Gäste), nur über `tisch_belegung_setzen`;
kein INSERT/UPDATE-Recht auf die Tabelle (§2.3f). anon: nichts.

**Prüfungen:**
- `pruefungen/pruef-saal-belegung.js` (53 Proben):
  - Naht gegen die Migration;
  - Schilder an den richtigen Tischen;
  - ungültige Zeilen fallen weg;
  - Tipp auf den Schildrand wählt den Tisch;
  - Kontrast;
  - Liste;
  - Blatt mit echten Tipps (Nutzlast, Absage, Wettlauf zweier Tipps, Neuladen während eines Tipps);
  - Migration fehlt;
  - Assistent;
  - 360 px.
  - Gegenbeweise B1–B10 auf Kopien, alle rot. B1 nur grob: Das Schild wurde entfernt; eine Sabotage, die es aus der Tischgruppe löst, gibt es nicht.
- `pruefungen/pruef-saalplan-lokal.sh`:
  - 37 neue Zeilen `TB…` in `datenbank/pruef-tisch-belegung.sql`, darunter der zweite Durchgang am selben Tisch, Fremder, anon und Team.
  - Gegenbeweise D1–D7 je Schicht (Regel, Recht, Funktion), alle rot.

**Ehrliche Grenzen:**
- Beide Migrationen sind NICHT live.
- Es gibt keine Gerätezahl; „Gast noch da“ ist die letzte Aktivität am Tisch, kein Beweis, dass jemand sitzt.
- Reservierungen haben weiterhin keinen Tisch.
- Der 30-s-Takt (nur bei sichtbarem Tab) ist nicht gemessen.
- Kopfloses Chromium, kein Gerät.
