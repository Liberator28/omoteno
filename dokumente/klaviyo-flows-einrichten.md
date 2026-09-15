# Klaviyo-Flows von Hand einrichten

## Warum von Hand, nicht per Skript

Die Klaviyo-Flow-API kennt keinen eigenen Aktionstyp für einen
Gutschein-Code in einer E-Mail — der "Coupon Code"-Baustein wird
ausschließlich im Klaviyo-E-Mail-Editor per Ziehen in die Vorlage
gesetzt und dort mit einem Coupon verknüpft (siehe
`erzeuger/erzeuge-newsletter-vorlage.js`, Kommentar zu
`{{ event.discount_code }}`). Alles andere in einem Flow
(Trigger, Wartezeit, Segment-Bedingung) ließe sich zwar über die API
zusammensetzen, aber blind, ohne visuelle Prüfung, in einem echten
Marketing-Account — genau die Art Behauptung, die CLAUDE.md §0
untersagt ("ungeprüft ist eine Behauptung, kein Ergebnis"). Deshalb
hier eine Anleitung mit den bereits angelegten, echten IDs statt
eines Skripts, das niemand nachsehen kann, bevor es scharf ist.

## Was schon steht (diese Sitzung angelegt)

| Betrieb | Liste | Coupon (external_id) | E-Mail-Vorlage |
|---|---|---|---|
| Chocolamour | `Chocolamour – Gäste-Newsletter` (`UvPrnH`) | `chocolamour_newsletter` | „Chocolamour – Woechentlicher Gutschein" (`RjSG5g`) |
| Blend | `Blend – Gäste-Newsletter` (`RvXGPR`) | `blend_newsletter` | „Blend – Woechentlicher Gutschein" (`RGZXDH`) |
| Minhkeey | `Minhkeey – Gäste-Newsletter` (`V2cdvr`) | `minhkeey_newsletter` | „Minhkeey – Woechentlicher Gutschein" (`Xy4a6Z`) |

Alle drei Listen mit `double_opt_in` — löst das im Hub schon
gegebene Versprechen ein ("Sie hören erst von uns, wenn Sie die
Adresse bestätigt haben"), ohne dass Omoteno selbst eine
Bestätigungsmail bauen muss.

**Noch offen, weil es echten Datenbank-Zugang braucht** (diese
Sitzung hatte keinen, HTTP 403 auf mcp.supabase.com): Der
Coupon-Code-**Vorrat**. Ein Coupon ohne Codes kann niemandem einen
Code zuteilen. Reihenfolge, sobald Zugang da ist:

1. `migration-rechnung-rabatt.sql` und `migration-newsletter-klaviyo.sql`
   in Supabase einspielen (siehe Dateiköpfe für die genaue Reihenfolge
   und Vorprüfungen).
2. Pro Betrieb z. B. 50 Codes über `rabattcode_anlegen` erzeugen
   (Beispiel: `select rabattcode_anlegen('<betrieb_id>', 'CHOCO-' || substr(gen_random_uuid()::text,1,8), 2.00, null, now() + interval '90 days')`,
   50-mal wiederholt oder in einer Schleife).
3. Dieselben Code-Strings per `bulk_create_coupon_codes` zum
   passenden Coupon hochladen (`chocolamour_newsletter` usw.) — DANACH
   sind es in Supabase UND in Klaviyo dieselben, gültigen Codes.

Ohne Schritt 2+3 lässt sich Flow 1 unten anlegen und testen, aber der
Versand würde leerlaufen (kein Code im Vorrat).

---

## Flow 1 · Wöchentlicher Gutschein

Für jeden der drei Betriebe einmal anlegen (Klaviyo → Flows → Create
Flow → "Build your own").

1. **Trigger**: "Someone is added to a list" → die passende Liste aus
   der Tabelle oben wählen.
2. **Time Delay**: 7 Tage.
3. **Send Email**:
   - Als Vorlage die passende hochgeladene Vorlage aus der Tabelle
     oben wählen ("Use existing template").
   - Im E-Mail-Editor an der Stelle, wo `{{ event.discount_code }}`
     im HTML steht: das vorhandene Textfeld anklicken, den
     "Coupon Code"-Baustein aus der linken Leiste dorthin ziehen
     (ersetzt die Zeile), im Baustein-Menü den Coupon dieses Betriebs
     auswählen (z. B. `chocolamour_newsletter`).
   - **Prüfen**: rechts oben "Preview" → zeigt einen echten Code aus
     dem Vorrat (erst möglich, nachdem Schritt 2+3 oben gelaufen
     sind).
4. Zurück zu **Time Delay** verzweigen (Schritt 3 mit der Maus an den
   Ausgang von "Time Delay" ziehen, nicht ans Ende — das ist die
   wöchentliche Wiederholung). Falls Klaviyos Editor das in der
   aktuellen Version nicht als Rückwärts-Kante erlaubt: stattdessen
   eine zweite, dritte, vierte "Time Delay (7 Tage) → Send Email"-Kette
   hintereinanderhängen (z. B. für die ersten 8 Wochen) — weniger
   elegant, aber ohne Frage funktionsfähig, und in der Klaviyo-UI mit
   drei Klicks kopierbar.
5. Flow-Status von "Draft" auf "Live" stellen — **erst nachdem** die
   Vorschau einen echten Code zeigt.

## Flow 2 · 20-Tage-Retargeting

**Erst das Segment anlegen** (Klaviyo → Lists & Segments → Create
Segment), pro Betrieb:

- Bedingung 1: "Is in list" → die passende Liste des Betriebs.
- UND Bedingung 2: "Has NOT" → "Bestellung aufgegeben – <Betrieb>"
  (Metrikname, kommt automatisch, sobald die erste echte Bestellung
  mit hinterlegter E-Mail durchgelaufen ist — vorher steht die Metrik
  in der Liste noch nicht zur Auswahl. Falls sie fehlt: einmal
  `bestellung_klaviyo_melden` testweise auslösen, siehe Verifikation
  unten) → "in the last 20 days".

Dann der Flow:

1. **Trigger**: "Someone enters a segment" → das eben angelegte
   Segment.
2. **Send Email**: dieselbe Vorlage wie in Flow 1 (oder eine eigene
   "Wir vermissen Sie"-Variante — optional, die bestehende Vorlage
   funktioniert auch hier), Coupon-Code-Baustein genauso verknüpfen.
3. Status auf "Live".

**Wichtig zur Segment-Neuberechnung**: Klaviyo wertet ein dynamisches
Segment in kurzen Abständen neu aus (kein Cron nötig) — ein Gast, der
die 20-Tage-Schwelle überschreitet, rutscht von selbst hinein und löst
den Flow aus.

---

## Verifikation (von Hand, in Klaviyo)

1. Ein Test-Profil mit eigener E-Mail manuell zur Liste eines
   Betriebs hinzufügen (Lists → Liste öffnen → "Add profiles").
   Double-Opt-in-Mail muss ankommen.
2. Bestätigungslink klicken → Flow 1 muss in "Flow" → "Overview"
   einen Eintrag in der Trigger-Historie zeigen (auch wenn die
   Wartezeit die Zustellung erst in 7 Tagen freigibt — das ist
   erwartet, nicht zum Testen der E-Mail selbst geeignet; dafür in
   Klaviyo mit einer testweise auf "0 Tage" gesetzten Kopie des Flows
   arbeiten und danach wieder auf 7 zurückstellen).
3. `datenbank/migration-newsletter-klaviyo.sql`s PROBE-Abschnitt
   liefert den Beweis, dass der Trigger überhaupt feuert (siehe
   Datei) — das ist die Naht zwischen Supabase und hier.
