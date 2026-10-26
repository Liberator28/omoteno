# Online-Zahlung später anbinden — Schritt für Schritt

Stand 26.10.2026 · **Keine Rechtsberatung.** Rechtsaussagen unten stützen sich auf Fachbeiträge im Netz, nicht auf
Gesetzestext oder BaFin-Schreiben im Original (aus der Arbeitsumgebung nicht abrufbar). Was „→ Anwalt“ trägt, ist offen.

---

## 0 · Wo wir stehen

- **Die Online-Zahlung (Karte, Klarna, PayPal, SEPA, Überweisung) ist ausgeschaltet.** Kein Gast und kein Wirt sieht sie.
  Im Hub und im Board gibt es sie nicht mehr; die beiden Funktionen `zahlung-starten` und `stripe-webhook` tun ohne
  `ZAHLUNG_AN=1` nichts.
- **Live ist nie etwas bezahlt worden:** am 26.10. standen in der Datenbank 0 eingerichtete Zahlarten und 0 Zahlungen.
- **Bezahlt wird bei euch vor Ort** — Bargeld, EC-/Kreditkarte am eigenen Terminal. Daran ändert sich nichts.
- Der Quelltext bleibt im Verzeichnis, damit ihr es später ohne Neubau einschalten könnt. Einschalten geht erst, wenn
  Teil 1 unten erledigt ist.

## 1 · Brauche ich ein Zertifikat? — die ehrliche Antwort

Es gibt hier **kein Zertifikat**, das man „kauft“. Es sind drei verschiedene Fragen:

| Frage | Antwort | Sicherheit |
|---|---|---|
| **Kartendaten (PCI DSS)** | Solange der Gast auf der **Bezahlseite von Stripe** zahlt und Omoteno nie Kartendaten sieht, braucht Omoteno kein eigenes Zertifikat; Stripe selbst ist zertifiziert. Es bleibt eine **Selbstauskunft** (Fragebogen „SAQ A“), die Stripe vorbefüllt anbietet. Seit 2025 gilt dafür eine Bedingung zum Schutz der Seite, die zur Bezahlseite weiterleitet. | Quellen sind Fachblogs, keine Stripe-/PCI-Originale → im Stripe-Dashboard unter „Compliance“ nachsehen |
| **Erlaubnis nach dem Zahlungsdiensteaufsichtsgesetz (ZAG, BaFin)** | **Das ist die eigentliche Frage.** Wer Geld von Gästen annimmt und weiterleitet, braucht eine Erlaubnis. Wer **nie in den Besitz der Gelder kommt**, fällt nach den Fundstellen unter die Ausnahme „technischer Dienstleister“ (§ 2 Abs. 1 Nr. 4 ZAG; ältere Texte nennen Nr. 9). **Aber:** nach einer Kanzlei-Darstellung der BaFin-Praxis entfällt diese Ausnahme, wenn der Dienstleister **auch nur vorübergehend Verfügungsmacht über ein Konto** hat, über das Gelder laufen. | **Offen.** Ob unser Aufbau (Omoteno-Schlüssel handelt für das Stripe-Konto des Wirts) darunter fällt, kann ich nicht belegen. → **Anwalt für Zahlungsverkehr oder BaFin-Anfrage**, schriftlich |
| **Kasse / Aufzeichnung (TSE, Steuerberater)** | Ob eine Bestell-/Bezahl-App ein „Aufzeichnungssystem“ ist, geht aus den Quellen nicht hervor. | **Offen** → Steuerberater (`recht/11`, Frage 11) |

Quellen: [Stripe – Marktplatz-Zahlungsabwicklung in Deutschland](https://stripe.com/de-be/resources/more/payment-processing-for-marketplaces-in-germany) (nur Inhaltsverzeichnis lesbar) ·
[ZAG § 2 (Fundstelle)](https://urteile-gesetze.de/gesetze/zag/2) · [Bird & Bird – ZAG-Merkblatt](https://www.twobirds.com/en/insights/2023/germany/amendment-to-bafins-zag-guidance-notes) ·
[PCI-Hinweise zu Stripe Checkout](https://oneuptime.com/blog/post/2026-09-24-reduce-pci-dss-scope-hosted-checkout/view) (Blog).

**Folge für euch:** Bis die Erlaubnisfrage **schriftlich** geklärt ist, bleibt es ausgeschaltet. Das ist die
vorsichtige und billigere Seite: „aus“ kostet einen Ablauf („bei uns an der Kasse“), „an ohne Klärung“ kann
strafbar sein (Strafvorschriften des ZAG; den Paragraphen habe ich hier nicht im Original geprüft).

## 2 · Die Wege, wie das Geld direkt vom Gast zum Wirt geht

**Weg A — Stripe „Standard“-Konto des Wirts (so ist es im Quelltext gebaut).**
Der Gast zahlt auf der Stripe-Seite, das Geld landet auf dem **eigenen Stripe-Konto des Wirts**; Klarna, PayPal, Karte,
SEPA schaltet der Wirt in **seinem** Stripe-Dashboard frei. Omoteno nimmt **keine Gebühr auf die Zahlung** und hält
kein Geld (Rechnung für Omoteno läuft getrennt). Das ist das „nur verbinden“ — **rechtlich aber der Punkt aus Zeile 2
der Tabelle oben.**

**Weg B — ohne Omoteno im Zahlungsweg (sofort möglich, null ZAG-Frage).**
Der Wirt kassiert **am Tisch oder an der Tür mit seinem eigenen Terminal/Zahlungslink** (z. B. sein Kartenterminal,
sein PayPal-Business-Konto, ein Zahlungslink von Stripe/SumUp). Omoteno nimmt weiter nur die Bestellung an und zeigt
„Bezahlt wird bei uns vor Ort“. Nachteil: keine automatische „bezahlt“-Meldung in der Küche, Betrag und Bestellung hängen
nicht zusammen. Wer das möchte, sagt es — ich baue dann nur einen Hinweistext pro Betrieb („So bezahlen Sie bei uns:
Terminal / Link“), ohne Zahlungsfunktion.

**Nicht empfohlen:** Omoteno-eigenes Konto, das Geld einsammelt und weiterleitet. Das ist ohne Erlaubnis genau der
erlaubnispflichtige Fall (Fundstelle: Fall „Lieferheld“).

## 3 · Schritt für Schritt — Weg A einschalten (erst nach Teil 1!)

### Teil 1 — Rechtliches (vor allem anderen)
1. **Fachanwalt für Zahlungsverkehr/Bank- und Kapitalmarktrecht** fragen (oder bei der BaFin eine Auskunft zur
   Erlaubnispflicht anfragen). Fragen, wörtlich:
   - Braucht Omoteno nach ZAG eine Erlaubnis, wenn der Gast über eine Stripe-Bezahlseite auf das **Stripe-Standard-Konto
     des Gastwirts** zahlt, Omoteno mit einem **Plattform-Schlüssel** im Namen des verbundenen Kontos die Bezahlseite
     anlegt, **keine Gebühr** auf die Zahlung erhebt und **nie Gelder hält**?
   - Gilt dafür die Ausnahme technischer Dienstleister, oder zählt der Zugriff über Stripe Connect als Verfügungsmacht?
   - Welche Rolle hat Stripe datenschutzrechtlich (Verantwortlicher oder Auftragsverarbeiter)?
2. **Antwort schriftlich ablegen** (unter `dokumente/recht/`). Ohne diese Zeile **nicht** weitermachen.
3. Texte anpassen: `seiten/datenschutz.html` (Zeile „Stripe Payments Europe“) und `seiten/avv.html` (Anlage 3) sagen
   heute „derzeit nicht freigeschaltet“ → streichen und die Rolle von Stripe eintragen. AGB/AVV nochmals anwaltlich prüfen.
4. Steuerberater: Kasse/TSE-Frage (siehe Tabelle) klären.

### Teil 2 — Stripe-Plattformkonto von Omoteno
(Menüpunkte bei Stripe ändern sich; im Zweifel dem Dashboard folgen.)
1. Stripe-Konto für **Omoteno** anlegen und vollständig freischalten (Unternehmensdaten, Identitätsprüfung).
2. **Connect aktivieren** (Dashboard → Connect → Erste Schritte) als **Plattform**; verbundene Konten vom Typ **Standard**.
3. Zuerst im **Testmodus** arbeiten (`sk_test_…`), erst am Ende auf `sk_live_…` wechseln.
4. Im Connect-Bereich die **Client-ID** (`ca_…`) notieren und die **Weiterleitungs-Adresse** für die Verbindung
   eintragen (siehe Teil 5, Schritt 1).

### Teil 3 — Supabase (Projekt „Project Blend Hub“)
1. **Secrets setzen** (Supabase → Edge Functions → Secrets, nie ins Verzeichnis):
   `STRIPE_SECRET_KEY` (Plattform-Schlüssel), `STRIPE_WEBHOOK_SECRET` (kommt aus Teil 3 Schritt 3), **`ZAHLUNG_AN` = `1`**.
2. **Funktionen ausrollen** (beide ohne Token-Prüfung, die Echtheit kommt beim Webhook aus der Unterschrift):
   `supabase functions deploy zahlung-starten --no-verify-jwt` und `supabase functions deploy stripe-webhook --no-verify-jwt`.
   Danach `list_edge_functions` gegen den Ordner `supabase/functions/` halten (Version, `updated_at`).
3. **Webhook in Stripe** anlegen: Endpunkt vom Typ **„Verbundene Konten“** auf
   `https://<projekt>.supabase.co/functions/v1/stripe-webhook` mit den Ereignissen `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
   Das angezeigte **Signing-Secret** (`whsec_…`) ist `STRIPE_WEBHOOK_SECRET`.

### Teil 4 — Schalter im Quelltext umlegen (das mache ich, wenn ihr „Zahlung einschalten“ sagt)
1. In `vorlagen/hub.vorlage.html` **und** `seiten/admin.html`: `const ZAHLUNG_ONLINE_AN = window.OMOTENO_ZAHLUNG === true;`
   → `const ZAHLUNG_ONLINE_AN = true;`
2. `node erzeuger/erzeuge-hub.js --alle`, dann die Prüfungen `pruef-zahlung.js`, `pruef-zahlung-board.js`,
   `pruef-zahlung-edge.js`, `pruef-rechtstexte.js`, `pruef-rechtspflichten.js` (die Probe „ausgeliefert = aus“ muss dann
   bewusst auf „an“ umgestellt werden).
3. Veröffentlichen. Erst jetzt erscheint im Board die Gruppe **Einstellungen → Bezahlen**.

### Teil 5 — Gastwirt anbinden (je Betrieb)
> **Achtung, Lücke im bisherigen Aufbau (26.10. im Quelltext nachgesehen):** Es gibt **keinen „Mit Stripe verbinden“-Schritt**.
> Der Hub schickt die Kontonummer `acct_…` des Wirts, aber Stripe erlaubt dem Plattform-Schlüssel den Zugriff nur auf
> Konten, die **vorher mit der Plattform verbunden** wurden (OAuth oder Verbindungs-Link). Nur die Nummer ins Board zu
> tippen reicht **nicht**. Dieser Schritt muss noch gebaut werden (Aufwand: ein Knopf im Board + eine kleine Funktion,
> die den Rücksprung entgegennimmt und `acct_…` speichert; mit Prüfung und Gegenbeweis). Sagt Bescheid, dann baue ich ihn.
1. Der Wirt legt **sein eigenes** Stripe-Konto an (er ist Vertragspartner von Stripe; Unternehmensdaten, IBAN,
   Identitätsprüfung macht Stripe).
2. Der Wirt tippt im Board **„Mit Stripe verbinden“** (muss noch gebaut werden) und erlaubt Omoteno den Zugriff.
3. In **seinem** Stripe-Dashboard schaltet er die Zahlarten frei: Karten (Apple/Google Pay), **Klarna** (Klarna prüft
   den Händler und kann ablehnen), **PayPal** (Verfügbarkeit für verbundene Konten im Stripe-Dashboard prüfen), SEPA
   (nur wenn gewollt; Bestätigung dauert Tage — für Essen zum Sofortverzehr ungeeignet).
4. Im Board unter **Einstellungen → Bezahlen** die Arten anhaken, mit der **PIN** bestätigen.
5. **Keine Aufpreise** auf eine Zahlart (§ 270a BGB). Die Zahlung beim Personal bleibt immer möglich.

### Teil 6 — Testen, bevor ein echter Gast zahlt (im Testmodus)
- Testkarte, Abbruch auf der Bezahlseite, abgelaufene Sitzung (30 Minuten), fehlgeschlagene Zahlung.
- Klarna-/PayPal-Testkonto, SEPA-Testmandat.
- Bei jedem Weg: Landet die Bestellung **erst nach der Zahlung** in der Küche? Kommt der Push?
- **Ausfall üben:** Webhook-Geheimnis absichtlich falsch → Bestellung bleibt „Zahlung offen“ → „Beim Personal bezahlt –
  freigeben“ funktioniert → eine spätere Zahlung erscheint als „Rückzahlung nötig“.
- Rückzahlung im Stripe-Dashboard üben, im Board „Zurückgezahlt – erledigt“ tippen.

### Teil 7 — Scharf schalten
1. Schlüssel von `sk_test_…` auf `sk_live_…` und Webhook-Secret auf das Live-Secret wechseln.
2. Ein Haus zuerst (nicht alle), eine echte Zahlung von 1 € selbst machen und zurückzahlen.
3. Danach Betrieb für Betrieb.

## 4 · Was ihr danach im Alltag wisst
- Das Geld geht auf das Konto des Wirts; Auszahlung auf seine Bank macht Stripe nach seinen Regeln.
- Omoteno sieht nur Betrag, Zahlart, Status und die Kontonummer — nie Karten- oder Kontodaten.
- Fällt Stripe aus, kann der Wirt mit „Beim Personal bezahlt – freigeben“ weiterarbeiten.
- Rückzahlungen: im Stripe-Dashboard des Wirts; das Board erinnert, bis „erledigt“ getippt wird.

## 5 · Was ich nicht belegen kann
- Ob unser Aufbau ohne ZAG-Erlaubnis zulässig ist (Anwalt/BaFin).
- Die genauen Menüpunkte bei Stripe/Klarna/PayPal und ob PayPal für verbundene Konten in Deutschland verfügbar ist.
- Ob die PCI-Selbstauskunft für eure Konstellation „SAQ A“ ist.
- Nie gegen echtes Stripe, Klarna oder PayPal gelaufen (nur nachgestellte Antworten).
