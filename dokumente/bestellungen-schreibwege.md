# Schreibwege auf `bestellungen` (Wegeliste)

Stand 24.10.2026, gelesen im Quelltext (nicht aus dem Gedächtnis; CLAUDE.md §1.2/§1.3).
Grundlage für `datenbank/migration-bestellungen-spaltenrechte.sql` (**nicht eingespielt**).
`pruefungen/pruef-bestellungen-schreibwege.js` hält diese Liste gegen den Code: ein neuer
Schreibweg oder eine neue Spalte macht die Prüfung rot.

## Direkte Schreibwege des Browsers (brauchen ein Spaltenrecht für `authenticated`)

| # | Datei · Funktion | Spalten | Auslöser |
|---|---|---|---|
| 1 | `seiten/admin.html` · `bestellungSchreiben(felder, ids)` ← `statusSetzen` | `status`, `wartezeit_min`, `bestaetigt_um` | Karte weiterschieben, „Zurück auf Neu“ (leert Zusage) |
| 2 | `seiten/admin.html` · `bestellungSchreiben` ← `bestaetigen` | `status`, `wartezeit_min`, `bestaetigt_um` | Zusage mit Minuten |
| 3 | `seiten/admin.html` · `bestellungSchreiben` ← `pruefEntscheiden` | `pruefen`, `pruef_grund`, `status` | markierte Bestellung freigeben / verwerfen |
| 4 | `seiten/admin.html` · `abholGebracht` | `gebracht_um` | „Gebracht“ im Abholbereich |
| 5 | `seiten/admin.html` · Team-Modus (`update({ zugewiesen: neu })`) | `zugewiesen` | Bon einem Teammitglied zuweisen |
| 6 | `seiten/kueche.html` · `setzeBon` ← `ausfuehren` | `status`, `wartezeit_min`, `bestaetigt_um`, `kueche_fertig_um`, `theke_fertig_um` | Zeit, Starten, Zurück, Abholbereit, Öffnen |

Vereinigung: **9 Spalten** — `status`, `wartezeit_min`, `bestaetigt_um`, `kueche_fertig_um`,
`theke_fertig_um`, `gebracht_um`, `zugewiesen`, `pruefen`, `pruef_grund`.

## Wege, die KEIN Spaltenrecht brauchen

- Alle Funktionen mit `security definer` laufen mit den Rechten des Eigentümers:
  `bestellung_aufgeben`, `bestellung_liefern`, `bestellung_stornieren`, `bestellung_restzeit`,
  `rechnung_rabattieren`, `notiz_senden`, `zahlung_*` u. a. Hier steht Preis, Summe, Positionen.
- Edge Functions: `melden` liest (`select`), schreibt nicht. `zahlung-starten`, `stripe-webhook`,
  `alessia-bestellung` arbeiten über Funktionen bzw. den Dienstschlüssel.
- Lesen (`select *`, Realtime) hängt am SELECT-Recht, nicht am UPDATE-Recht.

## Was die Kürzung schließt

Heute darf ein angemeldetes Teammitglied (RLS: eigener Betrieb) per REST jede der 34 Spalten
ändern, auch `summe`, `positionen`, `rabatt_betrag`, `betrieb_id`. Nach der Kürzung nur noch die neun
Zustands-Spalten oben. Preis und Inhalt einer Bestellung ändert dann niemand mehr direkt.

## Grenzen (ehrlich)

- Nicht gegen die echte Datenbank gelaufen; der Live-Katalog war in dieser Sitzung nicht erreichbar.
  Die Lesefragen im Kopf der Migration sind VOR dem Einspielen zu stellen.
- Die RLS-Regel unterscheidet weiter nicht zwischen Team und Inhaber: Ein Teammitglied darf die neun
  Spalten ändern (gewollt — das Team bedient die Küche).
- Ein alter, zwischengespeicherter Tab mit einem anderen Schreibweg würde „permission denied“ sehen
  (Board: Satz, Küche: „Erneut“-Knopf).
