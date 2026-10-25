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
