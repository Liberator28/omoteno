# Rollen, Rechte, „Unternehmen“ und „Team & Ziele“

Stand 24.10.2026. Vorher gelesen und begründet: `dokumente/zugriffsrechte-befund.md`. Alles hier ist in lokalen Proben
gemessen (Postgres 16, Chromium) — **nichts davon ist live eingespielt** (der Supabase-MCP war in dieser Sitzung nicht
verbunden). Reihenfolge und Handgriffe stehen unten.

## Wer darf was

| | Besitzer | Manager (Standard) | Manager (freigeschaltet) | Team | Küche |
|---|---|---|---|---|---|
| Zahlen → **Unternehmen**: Tageszahlen (Umsatz, Bestellungen, Stornos, Servicerufe von heute) | ja | **ja** | `kennzahlen_tag` | gesperrt | gesperrt |
| … Wochen-/Monats-/Zeitraumberichte, Verlauf, Stunden, Renner, Umsatzziele sehen | ja | nein | `berichte_view` | gesperrt | gesperrt |
| … Berichte als CSV | ja | nein | `berichte_export` | – | – |
| … Umsatzziele **ändern** | ja | nein | nie (nur Besitzer) | – | – |
| **Einkauf & Kosten**, Kalkulation, Wareneinsatz, Margen, Belegfotos | ja | nein | `kosten_view` | gesperrt | gesperrt |
| … Einkaufsbelege als CSV | ja | nein | `finanz_export` (nur zusammen mit `kosten_view`) | – | – |
| Zahlen → **Team & Ziele**: sehen, Aufgaben abhaken | ja | ja | ja | **ja** | **ja** |
| … Ziele anlegen/ändern/archivieren | ja | nein | `ziele_edit` | nein | nein |
| … Ziele für das Team freigeben | ja | nein | `ziele_approve` | nein | nein |
| Rechte anderer vergeben, Rollen ändern | ja | **nie** | **nie** | nie | nie |
| Karte, Preise, Gast-Hub, Lieferung … ändern | ja | wie Team (nur Verfügbar/Pause) | wie Team | nur Verfügbar/Pause | – |

„Manager“ ist im Betrieb **wie Team** (jede Wache und Regel der Datenbank fragt „Besitzer?“), plus Rechte je Person.
Rechte gibt es nur für Manager; steht in der Spalte eines Team-/Küche-Kontos etwas, wirkt es nicht (gemessen mit absichtlich
vergifteter Spalte).

## Was die Datenbank erzwingt — und was nicht

**Erzwungen** (auch am Board vorbei, mit direkter Abfrage; Proben `pruef-zugriffsrechte-lokal.sh`):
`kosten_view` — neun Tabellen der Einkaufsseite (Belege, Positionen, Lagerbewegungen, Inventuren, Rezepturen,
Rezepturpositionen, Perioden, Umlagerungen samt Positionen), die Belegfotos im Speicher, `gericht_kalkulation()`,
`wareneinsatz_theoretisch()`; `finanz_export` — `finanz_export_belege()`; `ziele_*` — Teamziele (Lesen, Schreiben,
Freigeben); die Vergabe der Rechte selbst (`team_rechte_setzen()` nur für den Besitzer, nie für sich, nur für Manager
desselben Betriebs, jede Änderung im Verlauf).

**Nur Anzeige** — und die Oberfläche sagt es bei jedem Schalter: `kennzahlen_tag`, `berichte_view`, `berichte_export`.
Grund: Die Zeilen von `bestellungen` (mit `summe`) müssen für Küche und Board lesbar bleiben; wer sie lesen darf, kann
Tages-, Wochen- und Monatsumsatz selbst zusammenzählen. Das Board holt und zeichnet die Zahlen nicht — ein Manager mit
Entwickler-Werkzeug und eigenem API-Aufruf bekäme sie trotzdem. Schließen ließe sich das nur mit einem Umbau von Küche,
Board, Rechnung und Bon auf eine Funktion statt der Tabelle (eigenes Vorhaben).

## Dateien

| Datei | Was |
|---|---|
| `datenbank/migration-zugriffsrechte.sql` | **Teil A, additiv**: Rolle `manager` (Schranke aus dem Katalog gelesen, jeder alte Wert bleibt), `betrieb_mitglieder.rechte`, `rechte_katalog()`, `rechte_wirksam()`, `hat_recht()`, `meine_rechte()`, Wache (Rollenwechsel setzt Rechte zurück), `team_rechte_liste/setzen/verlauf`, Teamziele (3 Tabellen, 5 Funktionen), `finanz_export_belege()` |
| `datenbank/migration-zugriffsrechte-scharf.sql` | **Teil B, schärft**: die Lese-Regeln der Einkaufstabellen, der Speicher-Regel und beider Kalkulations-Funktionen auf `kosten_view`. Bricht laut ab bei unbekannter oder fehlender Lese-Regel oder abweichender Zugriffsstelle |
| `seiten/admin.html` | Rolle Manager; `meine_rechte`; Reiter „Zahlen“ in **Unternehmen** (gesperrt = nichts geholt, nichts gezeichnet) und **Team & Ziele**; Einstellungen-Gruppe **Zugriffsrechte** |
| `seiten/einkauf.html` | gesperrt ohne `kosten_view` (keine Abfrage); „Belege als CSV“ mit `finanz_export` |
| `seiten/konto.html` | „Manager“ wählbar |
| `supabase/functions/team-zugang/index.ts` | Rolle `manager` einladen/umstellen |
| `pruefungen/pruef-zugriffsrechte-lokal.sh` + `datenbank/pruef-zugriffsrechte-*.sql/.txt`, `modell-lokal-rechte.sql` | Datenbankprobe |
| `pruefungen/pruef-zugriffsrechte.js` | Board-Probe; `pruef-einkauf.js` (10b), `pruef-rollen.js` angepasst |

## Reihenfolge beim Einspielen (CLAUDE.md §2.5/§7)

1. **Teil A** einspielen, danach **lesen** (nicht „success“ glauben): die Abfragen am Ende der Datei
   (Schranke, genau eine Fassung je Funktion, kein `EXECUTE` für `anon`).
2. Edge Function `team-zugang` ausrollen, `admin.html`, `einkauf.html`, `konto.html` ausliefern.
3. Entscheiden, wer bisher Zahlen/Einkauf brauchte: **Bestehende Team-Konten verlieren beides** (Anzeige sofort, Daten
   erst mit Teil B). Der Besitzer stellt sie im Konto → „Dein Team“ auf **Manager** und schaltet im Board unter
   Einstellungen → Zugriffsrechte frei.
4. **Teil B** einspielen, danach lesen (`pg_policies` der zehn Tabellen: jede `qual` trägt `hat_recht`;
   `has_column_privilege('authenticated','public.lieferanten_artikel','letzter_preis','select')` muss `false` sein).
5. Würde Teil B VOR den Seiten laufen, bekäme ein Team-Konto Fehler statt eines Satzes.

## Ehrliche Grenzen und offene Risiken

- **Nichts davon lief gegen die echte Datenbank.** Die Proben bauen Tabellen, Funktionen und Lese-Regeln wörtlich aus
  den Migrationsdateien nach; ob der Live-Bestand abweicht (eine zusätzliche Regel, ein anderes `GRANT`), zeigt erst der
  Lauf am Live-Katalog. Teil B bricht dafür bei Unbekanntem ab, statt zu raten.
- `bestellungen` bleibt für Mitglieder lesbar (siehe oben); ebenso `betriebe.ziele` (Umsatzziele) über die Betriebs-Regel.
- Mitglieder mit `darf_lager` behalten Lagerbewegungen und Inventuren **mit Werten** (Lagerbuchung braucht den Bestand).
  Der Besitzer vergibt dieses Recht ausdrücklich; es ist kein Teil von `kosten_view`.
- Die Zentrale einer Kette (`zentrale_vergleich`, eigene Rolle) ist unverändert.
- Es gibt **keine Gewinn-Zahl** im System und deshalb kein Gewinn-Recht; Marge und Wareneinsatz hängen an `kosten_view`.
- Nur kopfloses Chromium, kein Gerät; kein Lauf gegen Mailversand der Einladung.
