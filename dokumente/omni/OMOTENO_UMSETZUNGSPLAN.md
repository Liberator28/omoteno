# OMOTENO · Umsetzungsplan (Reihenfolge nach Phase 0) · Stand 31.10.2026

> Grundlage: `OMOTENO_IST_BERICHT.md` (Befunde S1–S10, Lücken §7). **Nichts hiervon ist umgesetzt.** Migrationen werden
> nur als Datei im Entwicklungsbranch vorbereitet und **lokal** (Postgres 16, `pruefungen/*-lokal.sh`) gegen die echten
> Funktionen geprüft. Einspielen, Ausrollen und jede Live-Änderung brauchen eine **ausdrückliche Freigabe je Schritt**.
>
> Reihenfolge-Regel: erst Schäden stoppen (P0), dann Rechte enger (P1), dann das Datenfundament, auf dem Omni steht (P2),
> erst danach neue Fachfunktionen (P3–P7). Jede Phase endet mit Tests, Gegenbeweisen und Doku (Abnahmekriterien §12).

## Übersicht

| Phase | Inhalt | Braucht Entscheidung von dir | Live-Eingriff nötig |
|---|---|---|---|
| **P0** | Datenverlust und Ausrollrückstand stoppen (S1–S3, S8) | **ja** (Löschfrist, Zahlung) | ja (Freigabe je Punkt) |
| **P1** | Rechte enger: GRANT kürzen, Geldwerte vor Küche verbergen (S4–S7) | nein | Migration (Freigabe) |
| **P2** | Fundament: stabile `gericht_id`, Archiv statt Löschen, Positionsjournal | ja (Aufbewahrung) | Migration (Freigabe) |
| **P3** | Einkaufsrechte und Freigabegrenzen je Manager/Standort | nein | Migration |
| **P4** | Bestellung → Lieferung → Rechnung → Zahlung (Lieferantenseite) | nein | Migration |
| **P5** | Lager: Verbrauch aus Bestellungen, Fehlmengen, Inventur-Zweitfreigabe, Verderb-Arten | nein | Migration |
| **P6** | Preise: gewichteter Durchschnitt, manueller Kalkulationspreis, Standortübertragung | nein | Migration |
| **P7** | Controlling & Liquidität mit Qualitätsstatus | nein | Code + Sichten |
| **P8** | Dokumente B, C, E, F | — | nein |

---

## P0 · Schäden stoppen (vor allem anderen)

### P0.1 Lösch-Cron `aufraeumen-bestellungen` (S1) — **Entscheidung nötig**
- **Objekte:** `cron.job` `aufraeumen-bestellungen`, `aufraeumen-ereignisse`, `ereignisse-aufraeumen`; FK-Kaskade auf `zahlungen`, `notizen`, `push_gemeldet`.
- **Grund:** Hartlöschung nach 30 Tagen widerspricht der entschiedenen Frist (90 Tage), nimmt Zahlungen mit, steht nicht im Repo, macht Lagerabgang/Controlling unmöglich.
- **Vorschlag (zur Wahl):** (a) Job sofort **pausieren** (`cron.unschedule` bzw. `active=false`) — reversibel, keine Datenänderung; (b) danach entweder die im Repo geplante Löschfrist (`migration-loeschfristen.sql`) nach Prüfung einspielen **oder** personenbezogene Felder nach Frist **anonymisieren** statt die Zeile zu löschen (Name, Telefon, Adresse, Notiz, Transkript leeren; Positionen, Summe, Zeit, Betrieb bleiben für Lager/Controlling). (b2) ist mit Omni vereinbar, (b1) nicht.
- **Abhängigkeit:** Rechtsfrage Aufbewahrung beim Betrieb (Steuerberater/Anwalt, siehe Fahrplan-PDF).
- **Risiko:** Bis zur Entscheidung wächst die Tabelle; Datenschutz verlangt trotzdem eine Frist → (b2) löst beides.
- **Tests:** lokal: Anonymisierung lässt Summen, Positionen, `gericht_id` stehen, entfernt PII; zweiter Lauf ändert nichts; Zahlungen bleiben.
- **Rollback:** Job mit gleichem Befehl wieder anlegen (Befehl steht im Ist-Bericht §5).
- **Datenmigration:** nein (nur Stoppen); bei (b2) ein einmaliger Anonymisierungslauf.
- **Doppelter Job `ereignisse`:** einen entfernen (gleiche Wirkung, keine Datenänderung).

### P0.2 Edge `melden` auf Repo-Stand ausrollen (S2)
- **Objekte:** `supabase/functions/melden/index.ts` → `swift-processor`, `--no-verify-jwt` wie bisher.
- **Grund:** SSRF-Positivliste für Push-Endpunkte (19.10.) ist nicht live.
- **Tests vorher (lokal, schon vorhanden):** `pruefungen/pruef-haertung.js` (12 Fremdfälle), `pruef-push.js`. Nachher: Quelltext live gegen Repo vergleichen (`get_edge_function`), eine echte Testbestellung im Vorführhaus erzeugt genau eine Push-Meldung.
- **Rollback:** v6-Quelltext ist gesichert (im Ist-Bericht gelesen; vor dem Ausrollen als Datei ablegen).

### P0.3 Online-Zahlung live abschalten (S3)
- **Objekte:** Edge `zahlung-starten`, `stripe-webhook` (Repo-Stand mit `ZAHLUNG_AN`-Sperre ausrollen) **oder** beide entfernen; `EXECUTE` für `anon` auf `bestellung_aufgeben_zahlung`, `bestellung_liefern_zahlung`, `zahlarten_oeffentlich`, `zahlung_status` entziehen, solange die Funktion aus ist.
- **Grund:** Oberfläche ist aus (ZAG offen), Datenbank- und Edge-Wege sind es nicht.
- **Risiko:** Ein alter, zwischengespeicherter Hub ruft `zahlarten_oeffentlich` → bekommt 401/404 statt leerer Liste; der Hub behandelt Fehler fail-open (`pruef-zahlung.js`: „nichts sichtbar bei 404/500“) [R].
- **Tests:** `pruef-zahlung-edge.js` (Abgeschaltet-Proben), `pruef-zahlung.js`, `pruef-ladestart.js`; Gegenbeweis: EXECUTE zurück → Probe rot.
- **Rollback:** GRANT zurück, alte Edge-Fassung erneut ausrollen.

### P0.4 Auth: Schutz gegen geleakte Passwörter einschalten (S8)
- Dashboard-Schalter; kein Code. Test: Registrierung mit bekanntem Passwort wird abgelehnt (Testkonto).

**Abnahme P0:** Kein Lösch-Job ohne Repo-Gegenstück; Live-Quelltext von `melden`/`zahlung-*` = Repo; Advisor ohne die vier Zahlungs-RPCs bei `anon`.

---

## P1 · Rechte enger (Tiefenverteidigung)

### P1.1 GRANT auf das Nötige (S4)
- **Objekte:** `gerichte`, `aktionen`, `anfragen`, `reservierungen`, `push_geraete`, `master_umsaetze`.
- **Vorgehen:** Für jede Tabelle die Schreibwege aus Board/Küche/Konto/Master/Edge auflisten (Muster: `dokumente/bestellungen-schreibwege.md`, `pruef-bestellungen-schreibwege.js` — Quelltext ↔ Wegeliste ↔ GRANT in beide Richtungen), dann `TRUNCATE`, `TRIGGER`, `REFERENCES` entziehen und DML auf die genutzten Spalten kürzen.
- **Risiko:** Ein vergessener Schreibweg bricht still (Board kann nicht speichern) → genau deshalb die Wegeliste-Prüfung (§2.3f CLAUDE.md).
- **Tests:** lokale Probe nach Muster `pruef-bestellungen-spaltenrechte-lokal.sh` (erlaubt: Zeilenzahl 1; verboten: `permission denied` und Wert unverändert; fremder Betrieb 0 Zeilen), Board-Prüfungen der betroffenen Bereiche.
- **Rollback:** `grant` der alten Rechte (Liste im Ist-Bericht).

### P1.2 Geldwerte vor Küche/Lager ohne `kosten_view` verbergen (S5, S6)
- **Objekte:** Regeln `bewegung betrieb liest`, `inventur betrieb liest`; Sicht `lagerbestand`.
- **Vorschlag:** Lesezweig `darf_lager` ohne `kosten_view` nur über eine Sicht **ohne** `wert_netto`/`differenz_wert` (security invoker), Tabellenzugriff nur mit `kosten_view`; `lagerbestand` liefert `wert_netto` nur, wenn alle Werte bekannt sind, sonst `null` + Kennzeichen „unvollständig“.
- **Abhängigkeit:** Code in `einkauf.html`/Küche, der heute direkt liest (grep vor dem Bau).
- **Tests:** Rolle `kueche` mit `darf_lager`: Menge sichtbar, Wert nicht (auch nicht über `lagerbestand`, RPC, CSV); Manager mit `kosten_view`: Wert sichtbar; Leistung mit 200 001 Zeilen < 3 s (§2.3h).

### P1.3 Lieferantenkontakt (S7)
- `kundennummer`, `kontakt` per Spaltenrecht nur für Inhaber/`kosten_view`. Niedrige Priorität.

**Abnahme P1:** `has_table_privilege` zeigt kein `TRUNCATE`/`TRIGGER`/`REFERENCES` für `authenticated`; Küchen-Probe sieht keinen Euro-Betrag.

---

## P2 · Datenfundament für Omni (vor jeder Lagerbuchung aus Bestellungen)

### P2.1 Stabile `gericht_id` je Position (S10)
- **Ist:** Server sucht die ID über den Namen; Hub schickt keine ID.
- **Soll:** Hub/Board/Alessia schicken `gericht_id`; `positionen_pruefen` nimmt die **ID** (gehört sie zu diesem Betrieb?) und vergleicht den Namen nur zur Kontrolle; ohne gültige ID: Position bleibt bestellbar (§7 CLAUDE.md), wird aber **„ohne Zuordnung“** markiert — nie per Namen geraten.
- **Kompatibilität:** Alte, zwischengespeicherte Hubs schicken keine ID → Namensfallback bleibt, aber gekennzeichnet (`zuordnung: 'name'`), damit der Lagerabgang sie als ungeklärt behandelt.
- **Tests:** zwei gleichnamige Gerichte, umbenanntes Gericht, fremde ID (anderer Betrieb) → abgewiesen/markiert; Preis weiter aus der Karte (`pruef-naht.js`, `pruef-extras-gericht.js`).
- **Datenmigration:** keine Rückwärts-Zuordnung alter Positionen (Auftrag §7).

### P2.2 Abschlussereignis und Positionsjournal
- **Neu (additiv):** Tabelle `bestellung_abschluss` (eine Zeile je abgeschlossener Bestellung, UNIQUE `bestellung_id`) als **idempotenter** Anker für den späteren Lagerabgang; Rezeptversion je Position zum Zeitpunkt (`rezeptur_id`).
- **Grund:** Doppelte/parallele Abschlüsse dürfen keine doppelte Buchung erzeugen (UNIQUE + `on conflict do nothing`).
- **Abhängigkeit:** P0.1 (keine Löschung mehr), P2.1.

**Abnahme P2:** Jede neue Position hat `gericht_id` oder sichtbar „ohne Zuordnung“; Abschluss zweimal aufgerufen = ein Eintrag.

---

## P3 · Einkaufsrechte und Freigabegrenzen
- **Rechtekatalog erweitern** (`rechte_katalog()`, gleiche Signatur, §2.1): `einkauf_erfassen`, `einkauf_freigeben`, `lager_buchen` (ersetzt schrittweise `darf_lager`), `preise_pflegen`.
- **Neu:** `freigabe_grenzen(betrieb_id, nutzer_id, max_netto, gesetzt_von, gesetzt_am)`; nur Inhaber schreibt über RPC, Änderung in `rechte_protokoll`.
- **`beleg_freigeben`:** Inhaber wie heute; Manager mit `einkauf_freigeben` bis `max_netto` (auch selbst erfasste); darüber Grund `ueber_grenze` (als Antwort, nicht Ausnahme, §2.3g); Protokoll mit Akteur, Grenze, Betrag.
- **Zusätzlich:** Steuer- und Bruttosumme mit konfigurierbarer Toleranz prüfen (S9).
- **Tests:** unter, genau auf, über der Grenze; Grenze eines anderen Standorts; Manager ohne Recht; Grenzänderung durch Nicht-Inhaber; Protokolleintrag je Fall; Perioden-, Duplikat-Prüfung unverändert (`pruef-einkauf.js`, `pruef-zugriffsrechte-lokal.sh` erweitert).

## P4 · Lieferantenseite: vier verknüpfte Vorgänge
- **Additiv neue Tabellen:** `lieferantenbestellungen` (+ Positionen), `lieferungen` (+ Positionen, Teil-/Fehlmengen), `eingangsrechnungen` = Erweiterung von `einkaufsbelege` (Fälligkeit, Skonto, Status `offen/teilbezahlt/bezahlt/ungeklärt`), `rechnung_zahlungen` (Teilzahlungen), Verknüpfungstabellen n:m (Rechnung ↔ Lieferungen ↔ Bestellungen).
- **Lagerzugang** künftig aus der **Lieferung** (heute aus dem Beleg) — Übergang: Belege ohne Lieferung buchen wie bisher, damit alter und neuer Weg nie doppelt buchen (Kennzeichen am Beleg).
- **Bestellvorschläge:** aus `artikel_standort.mindestbestand`, offenen Bestellungen, Lieferzeit; nur Vorschlag, Bestellung erst nach Bestätigung.
- **Bezahlt** nur durch erfasste Zahlung, nie durch KI oder UI-Status.

## P5 · Lager aus Bestellungen, Inventur, Verderb
- Bewegungsart `verbrauch` (+ `verbrauch_storno`), gebucht je `bestellung_abschluss` × Rezeptposition; negativer Bestand erlaubt, **Fehlmengenprotokoll** (Artikel, Menge, Bestellung, Zeit, Auslöser); fehlende Rezeptur/Umrechnung → Zustand „ungeklärt“, kein erfundener Verbrauch.
- Storno/Teilrückgabe: Gegenbuchung nur der zurückgegebenen Menge.
- Inventur: Grund Pflicht, Schwellen (absolut/prozentual) → Zweitfreigabe durch Inhaber; Unterarten `verderb/schwund/bruch/zaehlfehler/sonstiges`; MHD optional je Artikel.
- Tests: parallele Abschlüsse (zwei Verbindungen lokal), Wiederholung, fehlende Rezeptur, Umrechnung kg/g, negative Bestände.

## P6 · Preise
- Gewichteter Durchschnitt aus bestätigten, vergleichbaren Mengen (Basiseinheit, Gutschriften/Retouren/Rabatte nach fester Regel); letzter bestätigter Preis daneben; manueller Kalkulationspreis als **eigene** Tabelle mit Historie (nie Lagerzugang), Übertragung auf ausgewählte Standorte protokolliert; Warnung bei Wirkung auf Gerichtskosten (heute schon ≥ 5 % in `beleg_freigeben`).
- Historische Kalkulationen: Kosten je Rezeptversion zum Stichtag, nicht zum heutigen Preis.

## P7 · Controlling & Liquidität
- Kennzahlen-Katalog (Formel, Quelle, Zeitraum, Recht, Qualitätsstatus „vollständig/unvollständig/geschätzt“); unbekannte Kosten nie 0 €.
- Liquiditätsvorschau nur aus offenen Zahlungsverpflichtungen (P4), ohne Bankbestand, mit Hinweis „keine Buchhaltung“.

## P8 · Dokumente
B `OMOTENO_FUNKTIONSHANDBUCH.md` (aus Wiki „Anleitung“ im Board + Rollen), C `OMOTENO_SOLLKONZEPT.md` (aus P2–P7), E
`OMOTENO_SICHERHEITS_UND_TESTBERICHT.md` (S1–S10 + Testergebnisse je Phase), F `OMOTENO_BETRIEBS_UND_WARTUNGSANLEITUNG.md`
(Backups, Ausrollen nur nach `list_edge_functions`-Abgleich, Cron nur aus dem Repo, Deployment-Checkliste).

---

## Testumgebung und Regeln für alle Phasen
- **Sicher:** lokales Postgres 16 mit dem live gelesenen Modell + den echten Funktionen (`pruefungen/*-lokal.sh`), Playwright gegen `dist/` mit gestellter Datenbank, Gegenbeweise auf Kopien (CLAUDE.md §8.1k).
- **Nicht ohne Freigabe:** `datenbank/pruef-*.sql` live (schreiben in zurückgedrehten Transaktionen), jede Migration, jedes Ausrollen, jeder Cron-Eingriff.
- **Neu einzuführen:** CI-Lauf der schnellen Prüfungen (fehlt heute) — Vorschlag in F.
- Bekannte vorbestehende Wackler bleiben benannt: `pruef-auswertung` „Bildlücken ≤ 50 ms“ (auch am Stand vor 31.10. rot).

## Nächster Schritt (wartet auf dich)
1. **Entscheidung P0.1:** Lösch-Job pausieren? Danach Anonymisieren (empfohlen) oder Löschen nach 90 Tagen?
2. **Freigabe P0.2–P0.4** (Ausrollen `melden`, Zahlung abschalten, Passwortschutz) — je einzeln.
3. Danach bereite ich P1 im Entwicklungsbranch vor (Migration als Datei + lokale Probe + Gegenbeweise), ohne einzuspielen.
