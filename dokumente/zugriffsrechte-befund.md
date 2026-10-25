# Zugriffsrechte, „Unternehmen“ und „Team & Ziele“ — Befund vor der Änderung

Stand 24.10.2026. Gelesen, nicht angenommen: Quelltext und Migrationsdateien. Der Live-Katalog war in dieser
Sitzung **nicht** erreichbar (Supabase-MCP „ERR_PROXY_TUNNEL“). Alles, was unten über „live“ steht, stammt aus den
Köpfen der Migrationen (dort steht, was beim Einspielen gemessen wurde) — nicht aus einer Abfrage von heute.

## Was es schon gibt (und deshalb erweitert wird, nicht neu gebaut)

| Baustein | Datei | Befund |
|---|---|---|
| Mitgliedschaft mit Rolle | `betrieb_mitglieder.rolle` (`migration-rollen.sql`) | CHECK `('inhaber','team','kueche')`. Es gibt **keine** Rolle „Manager“. |
| Rechte je Mitglied | `darf_gutscheine`, `gutschein_max_*` (`migration-rollen.sql`), `darf_lager` (`migration-einkauf-e5d.sql`) | Muster: eine Spalte je Recht, nur Inhaber setzt es, Prüfung in einer `security definer`-Funktion (`darf_lager_buchen`). Schreiben auf `betrieb_mitglieder` ist für `authenticated` entzogen (e5d, laut Kopf live geprüft). |
| „Wer ist Inhaber?“ | `ist_inhaber(betrieb)`, `meine_betriebe_inhaber()` | Mit PIN (`pin_ok()`) gebaut; Master zählt mit. `meine_betriebe()` ebenfalls PIN-bewusst. |
| Wächter | `betrieb_rolle_wache`, `gericht_rolle_wache` | Alles außer Inhaber darf nur Pause/Ausverkauft ändern. |
| Rollen in der Oberfläche | `admin.html` `ROLLE`, `rolleAnwenden()`, `data-nur-inhaber` | **Eine unbekannte Rolle gilt als Inhaber** (§7: „die Anzeige sperrt niemanden aus“). Würde „manager“ ohne Änderung eingeführt, sähe ein Manager im Board alles wie der Inhaber (der Server hielte nur die Schreibwege). |
| Einladen/Ändern | `supabase/functions/team-zugang` | `ROLLEN = [inhaber, team, kueche]`; prüft den Aufrufer als Inhaber; `pruef-team.js` hält die Liste gegen die CHECK-Schranke. |
| Zahlen | `admin.html` Reiter „Zahlen“ (`t-auswertung`, `awLaden`) | Liest `bestellungen` direkt (Spalten `AW_SPALTEN`) und rechnet **im Browser**. Zeigt Umsatz, Bestellungen, Verlauf, Stunden, Quellen, Renner, Ziele, zwei CSV-Exporte. |
| Einkauf & Kosten | `seiten/einkauf.html` + `migration-einkauf*.sql` | Hier liegen Einkaufskosten, Wareneinsatz, Rezepturen, Kalkulation. |

## Welche Kennzahlen wirklich aus der Datenbank kommen

- **Zahlen-Reiter:** Umsatz, Bestellanzahl, Durchschnitt, Quellen, Renner, Stunden, Stornos, Servicerufe — alles aus
  `bestellungen` (+ `gerichte`, `aktionen`, `betriebe.ziele`). **Es gibt dort keinen Gewinn, keine Marge, keinen
  Wareneinsatz.** Eine Zahl „Gewinn“ existiert im ganzen System nicht; sie wird hier nicht erfunden.
- **Wareneinsatz und Marge** kommen aus `gericht_kalkulation()` und `wareneinsatz_theoretisch()` (Einkauf-Seite,
  Reiter „Kalkulation“), gerechnet aus Rezepturen und freigegebenen Einkaufspreisen.

## Lücken (gemessen am Quelltext, nicht live)

1. **Jedes Mitglied liest die Einkaufszahlen.** Die SELECT-Regeln `beleg betrieb liest`, `position betrieb liest`,
   `bewegung betrieb liest`, `inventur betrieb liest`, `rezeptur betrieb liest`, `rezepturposition betrieb liest`,
   `einkauf_perioden_lesen` prüfen nur `betrieb_id in (select meine_betriebe())`. Das gilt auch für `team` und
   `kueche`. `einkauf.html` zeigt Team sogar ausdrücklich „nur ansehen“ (`B.rolle !== "inhaber"`). `lagerbewegungen`
   trägt `wert_netto`, `inventuren` `differenz_wert`, `umlagerungspositionen` `wert_netto`.
   **Berichtigung (beim Bau der Probe gefunden, nicht angenommen):** In der ersten Fassung dieses Befunds stand auch
   `lieferanten_artikel.letzter_preis`. Das stimmt nicht mehr: `migration-einkauf-e4.sql` entzieht `authenticated` das
   Tabellenrecht und gibt nur noch Spalten OHNE `letzter_preis` frei. Die Zeile trägt Stammdaten (Bezeichnung, Einheit).
   Deshalb bleibt diese Tabelle unangetastet — `hat_recht_org()` ist wieder gestrichen. Die Probe misst das Spaltenrecht
   (K17). Ebenfalls geprüft und nicht geändert: `artikel_standort`, `lieferanten_standort`, `inventur_entwurf` (e5c) tragen
   Mindestbestand, Lagerort, Liefertage, Mindestbestellwert und Zählstand — betrieblich, keine Kosten.
2. **Die Kalkulations-Funktionen** `gericht_kalkulation` und `wareneinsatz_theoretisch` (beide `security invoker`)
   prüfen nur Mitgliedschaft. `wareneinsatz_theoretisch` liefert zusätzlich `umsatz_brutto`.
3. **Belegfotos:** Storage-Regel `belege mitglied liest` — jedes Mitglied darf die Rechnungs-PDFs/Fotos laden.
4. **Zahlen/Umsatz ist für jedes Mitglied direkt lesbar**, weil Küche und Board die Bons brauchen:
   `bestellungen` trägt `summe` je Bestellung. Wer die Zeilen lesen darf, kann Tages-, Wochen- und Monatsumsatz selbst
   zusammenzählen. **Das lässt sich ohne Umbau von Küche, Board, Rechnung und Bon nicht schließen** (die geplante
   Spaltenrechte-Migration `migration-bestellungen-spaltenrechte.sql` betrifft nur das Schreiben).
5. **Keine Rolle dazwischen:** Wer heute „Team — führt den Betrieb“ ist, sieht Zahlen und Einkauf; die Spezifikation
   will Team ohne Finanzdaten. Das ändert das Verhalten **bestehender** Team-Konten (siehe unten).
6. `betriebe.ziele` (Umsatzziele) ist über die Betriebs-Leseregel für jedes Mitglied lesbar.

## Entscheidungen

- **Eine Berechtigungsarchitektur:** Rolle `manager` kommt in dieselbe CHECK-Schranke; Rechte je Mitglied in **einer**
  Spalte `betrieb_mitglieder.rechte` (jsonb, feste Liste, strikt boolean); Prüfung in **einer** Funktion
  `hat_recht(betrieb, recht)`, gebaut aus `ist_inhaber`/`meine_betriebe` (also mit PIN). `darf_lager`/
  `darf_gutscheine` bleiben, wie sie sind.
- **Rechte ändert nur der Inhaber**, nur über `team_rechte_setzen()`; kein Schreibrecht auf `betrieb_mitglieder`.
  Rechte gelten **nur** für `manager`; `team`/`kueche` bekommen nie ein Finanzrecht, auch wenn die Spalte etwas anderes
  enthielte.
- **Was die Datenbank erzwingt, und was nicht (und das sagt die Oberfläche so):**
  - erzwungen: `kosten_view` (alle Einkaufs-/Kalkulationstabellen, Belegfotos, die beiden Funktionen),
    `finanz_export` (Export-Funktion), Teamziele (Lesen/Schreiben/Freigeben), Rechtevergabe;
  - **nur Anzeige:** `kennzahlen_tag`, `berichte_view`, `berichte_export` — die Bestelldaten bleiben für Mitglieder
    lesbar (Lücke 4).
- **Kein Gewinn-Recht:** Ein Recht für eine Zahl, die es nicht gibt, wäre Schein. Marge und Wareneinsatz hängen an
  `kosten_view`. Käme später ein Gewinn, gehört er hinter dasselbe Recht.
- **Bestehende Team-Konten:** werden **nicht** automatisch zu Managern. Wer Zahlen oder Einkauf braucht, setzt der
  Inhaber unter „Dein Team“ auf Manager und schaltet frei. Das ist beabsichtigt, aber eine Verhaltensänderung.

## Risiken der Änderung

- Die SELECT-Regeln werden mit `alter policy` geändert (nie drop+create, §2.8). Der Live-Bestand an Regeln ist nicht
  einsehbar; die Migration listet vorher die vorhandenen Regeln je Tabelle und bricht **laut** ab, wenn eine
  unbekannte dabei ist (Anhäufung, §2.3).
- `darf_lager`-Mitglieder behalten Lesezugriff auf `lagerbewegungen`/`inventuren` (Lagerbuchung braucht ihn); beide
  tragen Werte. Das ist ein bewusst vom Inhaber vergebenes Recht — nicht stillschweigend.
- Reihenfolge (§2.5/§7): erst Migration (additiv: Spalte, Funktionen, Tabellen), dann Seiten, dann die engeren
  Regeln. Würden die engeren Regeln vor `einkauf.html` laufen, bekäme Team Fehler statt eines Satzes.
