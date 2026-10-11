# Einkauf & Kosten — Plan (11.10.)

Ausgangspunkt war ein Entwurf aus ChatGPT. Dieser Plan hält ihn gegen den
**live gelesenen** Bestand (Supabase-MCP, 11.10.) und gegen die Regeln in
CLAUDE.md. Wo er abweicht, steht warum.

## Entscheidungen (vom Nutzer, 11.10.)

- **Eigene Seite** `seiten/einkauf.html`, verlinkt aus dem Board. Gleiche
  Anmeldung, Sperre und PIN wie Board/Küche/Master (geteilte Blöcke).
- **Auslesen über Claude** in einer Edge Function (Muster `uebersetzen`):
  Schlüssel nur auf dem Server, Kontingent je Betrieb, Ergebnis nur als
  Vorschlag. Braucht `ANTHROPIC_API_KEY` als Secret.
- **Organisationsebene still mit anlegen**: Jeder Betrieb bekommt eine
  eigene Organisation; Artikel hängen an der Organisation, Bestände am
  Betrieb. Später lassen sich Betriebe zur Kette zusammenlegen.

## Bestand (gelesen, nicht vermutet)

| Befund | Folge |
|---|---|
| Keine Tabellen für Artikel, Lieferanten, Lager, Rezepte, Organisationen | alles neu, additiv |
| `rechnungen` gibt es — Omotenos Rechnung **an** den Betrieb | neue Tabelle heißt `einkaufsbelege` (§1.1a) |
| `betriebe` = Standort; 3 Betriebe, je 1 Inhaber | **keine** Tabelle `standorte` — der Betrieb ist der Standort (§1.2) |
| `betrieb_mitglieder.rolle` inhaber/team/kueche, `ist_inhaber()`, PIN-Pflicht | Rechte daran hängen, keine zweite Rollenwelt |
| `protokoll` + `protokoll_schreiben()` (Trigger auf betriebe, gerichte, …) | **kein** neues `audit_ereignisse` — dieselbe Spur nutzen |
| `ki_kontingent` + `ki_kontingent_nehmen()` | Auslesen zählt ins selbe Kontingent |
| Privater Eimer `anfragen` mit Master-Regeln | Muster für privaten Eimer `belege` |
| Verkaufte Positionen: `{name, menge, preis}` ohne Gericht-ID | theoretischer Wareneinsatz (E3) braucht zuerst `gericht_id` in den Positionen |
| Nur Choco hat Gerichte in der DB (107) | Kalkulation wird an Choco gemessen, nicht an Beispieldaten |

Abweichungen vom Entwurf, mit Grund:
- Einstieg nicht `konto.html` (Onboarding/Vertrag), sondern eigene Seite
  neben dem Board (dort verwalten Besitzer schon heute).
- `omoteno-admin.html` heißt längst `seiten/admin.html`.
- Rollen `owner/central_manager/location_manager/staff` erst in E4; bis
  dahin gelten die vorhandenen Rollen. Eine zweite Rollenwelt neben
  `betrieb_mitglieder` wäre genau die Anhäufung aus §2.3.

## Datenmodell (E1–E3)

Alle Beträge `numeric`, Mengen `numeric(14,4)` in **Basiseinheit**
(`g`, `ml`, `stk`). Zwischen Gewicht und Volumen wird nie umgerechnet.

| Tabelle | Inhalt |
|---|---|
| `organisationen` | id, name — eine je Betrieb, angelegt von der Migration |
| `betriebe.organisation_id` | neue Spalte, gefüllt |
| `artikel` | organisation_id, name, kategorie, basiseinheit, aktiv |
| `lieferanten` | organisation_id, name, kundennummer, kontakt |
| `lieferanten_artikel` | Bezeichnung **wie auf der Rechnung**, Artikelnummer, Gebinde in Basiseinheit („12 × 750 ml“ = 9000 ml), letzter Preis — die gelernte Zuordnung |
| `einkaufsbelege` | betrieb_id, lieferant, Belegnummer, Datum, netto/steuer/brutto, Status `entwurf → freigegeben → storniert`, Dateipfad, Quelle |
| `einkaufspositionen` | Text, Artikel, Menge, Einheit, Gebinde, `menge_basis`, netto, Steuersatz, Art `ware/pfand/fracht/rabatt/sonstiges` |
| `lagerbewegungen` | betrieb_id, artikel, Art `eingang/storno/inventur/verlust/transfer`, `menge_basis`, Wert, Bezug — **nur einfügen**, nie ändern |
| `inventuren`, `inventurpositionen` | E2 |
| `rezepturen`, `rezepturpositionen` | E3, je Gericht versioniert (`gueltig_ab`) |

Bestand = Summe der Bewegungen (Sicht), nie eine gepflegte Zahl.
Preis je Basiseinheit = netto ÷ menge_basis der **freigegebenen** Position.

### Regeln, die die Datenbank durchsetzt

- **Freigabe nur über `beleg_freigeben()`** (security definer): jede
  Warenposition einem Artikel zugeordnet, Positionssumme = Beleg netto
  (± 0,02 €), Lieferant + Belegnummer nicht schon freigegeben. Bricht
  etwas, kommt ein Grund zurück, keine Ausnahme nach dem Zählen (§2.3g).
  Die Freigabe schreibt Belegstatus, Lagereingänge und den letzten Preis
  in **einer** Transaktion.
- **Freigegeben ist unveränderlich.** Korrektur = `beleg_stornieren()`
  (Gegenbuchung) + neuer Beleg.
- **Rechte**: Lesen alle Mitglieder des Betriebs; Schreiben Inhaber (E1).
  GRANTs genau so knapp wie die Regeln (§2.3f), anon nichts. Negativtest
  mit zwei Betrieben gehört zu jeder Migration.
- **Protokoll**: Anlegen/Freigeben/Stornieren über `protokoll_schreiben()`.

## Phasen

**E1 · Grundlage und manueller Einkauf**
Migration (Organisationen, Artikel, Lieferanten, Belege, Positionen,
Bewegungen, RPCs, Regeln) mit zurückgedrehter Live-Probe;
`einkauf.html` mit Anmeldung/Sperre/PIN, Übersicht (Monatssumme netto,
letzte Belege, Entwürfe, Preisänderungen), Belege manuell erfassen und
freigeben, Artikel und Lieferanten pflegen. Link im Board („Mehr“).
*Abnahme:* Beleg mit 12 × 750 ml für 54 € netto ergibt 9000 ml und
6,00 €/l; ein zweiter Beleg mit derselben Nummer wird nicht freigegeben;
Betrieb B sieht nichts von A; eine Freigabe lässt sich nicht still
ändern.

**E2 · Auslesen und Lager**
Privater Eimer `belege`, Edge Function `beleg-lesen` (Bild/PDF → JSON-
Vorschlag, Kontingent), Prüfliste, Zuordnung lernt über
`lieferanten_artikel`, Inventur und Verlust.
*Abnahme:* echte Testrechnung wird richtig vorgeschlagen; derselbe Upload
zweimal bucht nichts doppelt; ohne Schlüssel ein Satz statt Fehler.

**E3 · Rezept- und Gerichtkalkulation**
Rezepturen je Gericht (versioniert), Kosten je Portion, Marge gegen den
Kartenpreis (Aktionspreis getrennt), „betroffene Gerichte“ bei
Preisänderung; `bestellung_aufgeben` legt `gericht_id` in die Positionen
(additiv) für den theoretischen Wareneinsatz.
*Abnahme:* Preisänderung ändert die heutige Kalkulation, alte Berichte
nicht.

**E4 · Ketten**
Betriebe einer Organisation zusammenlegen (Master), Rolle „Zentrale“,
Standortvergleich, gemeinsame Rezepturen.
*Abnahme:* Standort A kann B nicht lesen; die Zentrale vergleicht.

Nicht in diesem Ausbau: automatische Bestellungen, Kassen-/EDI-
Anbindung, Prognosen, Offline-Inventur, Buchhaltung/DATEV.

## Ehrliche Grenzen

- Ob die Erkennung auf echten Rechnungen trägt, zeigt erst ein Pilot mit
  freigegebenen Belegen.
- Der Wert für den Betrieb (Zeit, Preissteigerungen früh gesehen) wird im
  Pilot gemessen, nicht auf der Webseite versprochen.
