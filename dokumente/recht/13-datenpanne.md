# Datenpanne — Ablauf in den ersten 72 Stunden

Entwurf, **keine Rechtsberatung** (→ Datenschutzberater gegenlesen). Gilt für
Omoteno als Auftragsverarbeiter; der **Betrieb** ist Verantwortlicher und
meldet an die Aufsichtsbehörde (Art. 33 DSGVO: unverzüglich, möglichst binnen
72 Stunden nach Bekanntwerden). Omoteno meldet dem Betrieb **unverzüglich**
(Art. 33 Abs. 2) — im AVV steht die Frist (Entwurf 06: 24 Stunden).

## Was eine Panne ist

Unbefugter Zugriff, Verlust, Veränderung oder Offenlegung personenbezogener
Daten. Beispiele aus diesem Projekt:
- ein fremdes Konto sieht Bestellungen eines anderen Betriebs (RLS-Fehler),
- eingeschleuster Code (XSS) liest Daten im Browser des Personals,
- ein gestohlenes Besitzer-Passwort,
- ein Schlüssel im Repo oder im Browser-Verlauf,
- Zahlungsdaten an falschen Empfänger (IBAN eines Betriebs geändert).

## Ablauf

| Wann | Wer | Was |
|---|---|---|
| sofort | wer es merkt | **Nicht löschen, nicht aufräumen.** Uhrzeit, Betrieb, was gesehen wurde notieren. An hallo@omoteno.de und Telefon des Inhabers. |
| bis 1 h | Omoteno | Zugang sperren (Konto, Schlüssel drehen: Supabase-Dienstschlüssel, Stripe-Schlüssel, Webhook-Geheimnis, Vapi-Geheimnis), betroffene Funktion abschalten (Schalter im Board / Netlify-Deploy zurück). |
| bis 4 h | Omoteno | Umfang feststellen: welche Betriebe, welche Tabellen, welcher Zeitraum (Supabase-Logs, `protokoll`, Netlify-Logs). Beweise sichern (Logs exportieren). |
| bis 24 h | Omoteno → Betrieb | Meldung an jeden betroffenen Betrieb: Art der Panne, betroffene Daten und Personen (Größenordnung), mögliche Folgen, getroffene Maßnahmen, Ansprechperson. |
| bis 72 h | Betrieb | Meldung an die Aufsichtsbehörde (für Hessen: Hessischer Beauftragter für Datenschutz und Informationsfreiheit; sonst die Behörde am Sitz des Betriebs). Omoteno liefert die Unterlagen. |
| danach | Betrieb | Betroffene benachrichtigen, **wenn voraussichtlich ein hohes Risiko** besteht (Art. 34). |
| immer | Omoteno | Eintrag in das Panneverzeichnis (auch wenn **nicht** gemeldet wird — dann mit Begründung). Ursache beheben, **Prüfung schreiben, die den Fall findet** (CLAUDE.md §8.1b/g). |

## Nach einer Zahlungs-Panne zusätzlich

- Stripe-Konto des Betriebs: Zahlungen pausieren, Support von Stripe
  einschalten; Karten- und Kontodaten liegen bei Stripe, nicht bei Omoteno.
- IBAN-Änderung ohne Wissen des Betriebs: alte IBAN aus dem Protokoll
  zurückspielen, PIN neu setzen, Auszahlungen der betroffenen Zeit prüfen.

## Vorbereitung (vor dem Ernstfall erledigen)

- [ ] Telefonnummer und Vertretung für die ersten 72 Stunden festlegen
- [ ] Panneverzeichnis anlegen (Datum, Beschreibung, Betroffene, Maßnahmen, Meldung ja/nein)
- [ ] Zuständige Aufsichtsbehörden je Betrieb notieren
- [ ] Wiederherstellung üben: Supabase-Sicherung zurückspielen (Tarif mit Sicherungen?)
