# Zahlungen, Lieferung, Datensicherheit — was zu beachten ist

Stand 19.10.2026. **Keine Rechtsberatung.** Gelesen habe ich Fachbeiträge
(IT-Recht Kanzlei, IHK, Stripe-Rechtsseiten, PCI-Ratgeber); Gesetzestexte,
BaFin-Merkblätter und Urteile habe ich **nicht** im Original geprüft. Jede
Zeile mit „→ Anwalt“ oder „→ Steuerberater“ ist eine offene Frage, keine
Antwort. Quellen am Ende.

---

## 1 · Die Entscheidung, an der alles hängt

**Omoteno nimmt nie Geld an.** Jede Zahlung geht direkt auf das Konto des
Betriebs (Stripe Connect mit direkten Zahlungen auf das eigene Stripe-Konto
des Betriebs; bei Überweisung auf die IBAN des Betriebs).

Warum: Ein Plattformbetreiber, der Geld zunächst auf einem **eigenen**
Konto entgegennimmt und abzüglich Provision weiterleitet, betreibt nach
den Fachbeiträgen im Grundsatz ein erlaubnispflichtiges Finanztransfer-
geschäft (§ 1 Abs. 2 Nr. 6 ZAG; Fall „Lieferheld“ 2015). Die Pflicht
entfällt nicht, weil es nur eine Nebenleistung ist, und ein Verstoß kann
strafbar sein. Stripe empfiehlt dafür lizenzierte Zahlungsdienstleister —
**aber** die Quellen belegen nicht, dass Stripe Connect in jeder
Gestaltung erlaubnisfrei ist. Entscheidend ist, wer rechtlich das Geld
entgegennimmt.

Folgen im Code:
- Keine Plattformgebühr über die Zahlung (`application_fee`). Omoteno
  rechnet seine Gebühr separat per Rechnung ab. **Das ändert die Lage —
  vorher → Anwalt.**
- Die Stripe-Konto-Nummer (`acct_…`) gehört dem Betrieb. Omoteno speichert
  nur diese Nummer, **nie** einen geheimen Schlüssel eines Kunden.
- Kein Omoteno-Konto, kein Guthaben, keine Auszahlungslogik.

→ Anwalt: Bestätigen, dass genau dieses Modell (nur Software, Geld direkt
zum Betrieb) keine Erlaubnis nach ZAG braucht.

---

## 2 · Zahlungsarten und was jede rechtlich bedeutet

| Art | Wie umgesetzt | Worauf achten |
|---|---|---|
| **Am Tisch / bei Abholung** (bar, Karte beim Personal) | wie bisher, immer da | Das ist die **kostenlose, gängige, zumutbare** Zahlungsmöglichkeit (§ 312a Abs. 4 BGB). Sie darf nie wegfallen, solange andere Arten Aufpreise tragen könnten. |
| **Karte, Apple/Google Pay** | Stripe Checkout (gehostete Seite) | Kein Aufpreis (§ 270a BGB). Starke Kundenauthentifizierung (PSD2) macht Stripe. |
| **Klarna** | Stripe Checkout, Zahlungsart `klarna` | Muss im Stripe-Konto des Betriebs freigeschaltet sein (Klarna prüft den Händler). Kauf auf Rechnung/Ratenzahlung ist Sache von Klarna (Bonitätsprüfung, eigener Verantwortlicher) — Datenschutzerklärung nennt es. Mindest-/Höchstbeträge legt Klarna fest. |
| **PayPal** | Stripe Checkout, Zahlungsart `paypal` | Muss im Stripe-Konto des Betriebs aktiviert sein. Ob § 270a auch PayPal erfasst, ist **umstritten** (LG München I bejaht, OLG-Berufung anders; Ausgang in meinen Quellen nicht belegt). Deshalb: **kein Aufpreis**, dann stellt sich die Frage nicht. |
| **SEPA-Lastschrift** | Stripe Checkout, Zahlungsart `sepa_debit` | Mandat holt Stripe ein. Ankündigung („Pre-Notification“: Datum, Betrag, Mandatsnummer, Gläubiger-ID) vor dem Einzug — Stripes Bedingungen verlangen sie vom Händler; ob Checkout sie selbst versendet, ist in meinen Quellen nicht belegt → vor Livegang im Stripe-Konto prüfen. Kunde kann acht Wochen widersprechen: Bestellung nicht ausliefern, bevor die Zahlung bestätigt ist, und bei Rückbuchung mit Verlust rechnen. Kein Aufpreis (§ 270a). |
| **IBAN-Überweisung** (Vorkasse) | Bank-Daten des Betriebs im Hub, Bestellnummer als Verwendungszweck, Betrieb bestätigt „Zahlung eingegangen“ | Taugt für Vorbestellung, Catering, große Bestellungen — nicht für den Teller in 10 Minuten. Die Küche sieht die Bestellung erst nach der Bestätigung. IBAN-Änderung nur mit PIN, im Protokoll (klassischer Betrugsweg). |
| **Stripe** (als Anbieter) | trägt Karte, Klarna, PayPal, SEPA | Der Gast zahlt auf Stripes Seite. Omoteno sieht nie Karten- oder Kontodaten. |

**Preise:** ausnahmslos Endpreise inkl. MwSt. (bleibt). **Kein Aufpreis je
Zahlungsart** — im Board gibt es dafür kein Feld.

**Informationspflichten (Fernabsatz):** Zahlungsarten müssen **vor** dem
Abschluss genannt sein (Hub zeigt sie im Warenkorb, vor dem Knopf).
Bestellknopf bleibt „Zahlungspflichtig bestellen“ (§ 312j BGB). Kein
Widerrufsrecht bei frisch Zubereitetem steht schon im Hub.

---

## 3 · Datenschutz bei Zahlungen

- **Was Omoteno speichert:** Status, Betrag, Währung, Zahlungsart, Stripe-
  Sitzungsnummer, Zeitpunkte. **Nicht:** Kartennummer, IBAN des Gastes,
  Name auf der Karte, Klarna-Daten.
- **Stripe, PayPal, Klarna sind eigenständige Verantwortliche** für ihre
  Verarbeitung (Stripe sagt es in seinem DPA für Betrugsprävention,
  Bankenauswahl, Abrechnung). Für diese Teile braucht der Betrieb nach
  Stripes Angabe keinen Auftragsverarbeitungsvertrag — **bestätigen lassen
  (→ Datenschutzberater)**. In der Datenschutzerklärung des Hubs müssen sie
  genannt sein, mit Zweck und Rechtsgrundlage (Vertragserfüllung,
  Art. 6 Abs. 1 lit. b DSGVO). Der Hub nennt sie **nur**, wenn der Betrieb die
  Art eingeschaltet hat.
- **Weiterleitung auf eine Zahlungsseite** ist eine Übermittlung an Dritte:
  vor dem Wechsel steht im Warenkorb ein Satz, wohin es geht.
- **Cookies/Tracking:** Der Hub setzt keine. Stripes Seite ist Stripes Sache.
- **Aufbewahrung:** Steuerrechtlich gilt für Buchungsbelege eine mehrjährige
  Frist (nach meinen Quellen 8 Jahre; **→ Steuerberater**) — beim **Betrieb**
  (Stripe-Auszahlungsbericht, Buchhaltung), nicht in Omoteno. Unsere Zeilen
  folgen der Bestell-Löschfrist (90 Tage).

---

## 4 · Technische Sicherheit der Zahlungen (PCI, Betrug)

- **PCI DSS:** Mit Stripe Checkout als vollständiger Weiterleitung fallen
  Kartendaten nie auf unsere Seite — das ist der einfachste Fall (SAQ A).
  **Regel im Code:** kein Kartenfeld, kein `js.stripe.com` auf unseren
  Seiten, nur Weiterleitung auf die von Stripe gelieferte Adresse. Die
  Fachquellen streiten, wie viel Skriptpflege trotzdem bleibt, wenn die Seite
  eigene Skripte trägt; die genauen Voraussetzungen von SAQ A **im PCI-
  Dokument selbst nachlesen** — jedes Konto des Betriebs füllt seine eigene
  Selbstauskunft.
- **Betrag kommt nie vom Gast.** Die Funktion, die die Zahlung beginnt, liest
  Positionen und Summe aus der Bestellung in der Datenbank und rechnet nach;
  der Hub schickt nur die Bestellnummer.
- **Webhook:** Unterschrift (HMAC-SHA256 über `t.Rohkörper`) wird geprüft,
  Zeitfenster 5 Minuten, Konto der Zahlung muss zum Betrieb der Bestellung
  passen, jede Ereignis-Nummer wird nur einmal verarbeitet. Erst das
  Ereignis „bezahlt“ gibt die Bestellung an die Küche frei — **nie** die
  Rückkehr-Seite des Gastes.
- **Offene Bestellung ohne Zahlung** wird nach 30 Minuten verworfen; die
  Küche sieht sie nie („wartet auf Zahlung“, wie die Quarantäne).
- **IBAN des Betriebs:** Änderung nur mit PIN, mit Eintrag im Protokoll; der
  Hub zeigt die IBAN als Text (nie als Link/HTML).
- **Schlüssel:** Stripe-Geheimschlüssel und Webhook-Geheimnis nur als
  Funktions-Geheimnisse in Supabase, nie im Repo (`pruef-edge.js` sucht).

---

## 5 · Lieferung — Pflichten, die beim Betrieb liegen

Omoteno baut die Bestellstrecke; **verantwortlich ist der Betrieb**. Was ihr
dem Betrieb mitgebt:

| Thema | Stand im Produkt | → offen |
|---|---|---|
| **Jugendschutz bei Alkohol** | Frage 16+/18+ im Hub, „Ausweis 18+“ in der Küche an der Position | Ob die Abgabe über Lieferung/Internet unter § 9 JuSchG fällt, ist in den Quellen **gegensätzlich** beurteilt (altes LG Koblenz: nein; Ministerium: ja). Sicherer Weg: Alter beim Bestellen UND Ausweis bei Übergabe — ist so gebaut. → Anwalt |
| **Allergene im Fernabsatz** | Angaben im Detailblatt vor dem Kauf, Hinweis „bei Allergien Service fragen“ | Betrieb pflegt Daten selbst und haftet dafür (steht im Impressum) |
| **Preisangaben** | Endpreise inkl. MwSt., Liefergebühr vor dem Knopf | — |
| **Kein Widerrufsrecht** (frisch zubereitet, schnell verderblich) | Satz im Hub bei Lieferung | → Anwalt gegenlesen |
| **Verpackungsgesetz** | nicht Sache der Software | Nach den Quellen gilt für Lieferdienste: **Registrierung im Verpackungsregister LUCID und eigene Systembeteiligung** (Lieferverpackungen sind keine Serviceverpackungen); Mehrwegangebot (§ 33) ab mehr als 5 Beschäftigten oder 80 m². Quellen sind von 2022/23 — **jeder Betrieb prüft das selbst (IHK/Kreisbehörde)**. Ich nehme es in den Kunden-Onboarding-Bogen auf. |
| **Lebensmittelhygiene bei Lieferung** | nicht Sache der Software | Betrieb |
| **Liefergebiet, Mindestwert, Zeiten** | im Board einstellbar | Betrieb |
| **Datenschutz Lieferadresse** | Löschfrist (Entwurf C) vorbereitet, **Migration noch nicht eingespielt** | siehe Checkliste |

---

## 6 · Weitere Punkte, die „eine Webseite mit Bestell- und Zahlungsfunktion“ trifft

1. **Barrierefreiheit (BFSG, seit 28.06.2025):** Online-Bestell- und
   Bezahlstrecken für Verbraucher sind betroffen. Für Dienstleister gilt eine
   Ausnahme für **Kleinstunternehmen** (unter 10 Beschäftigte und höchstens
   2 Mio. € Umsatz/Bilanz, eng auszulegen). Ob ein Restaurant das ist **und**
   ob Omoteno als Anbieter der Software selbst verpflichtet ist, klären die
   Quellen nicht → Anwalt. Im Produkt sind Tapflächen ≥ 44 px, Kontraste
   ≥ 4,5:1, Beschriftungen und Fokus gemessen; **kein** Gesamt-Test nach
   EN 301 549, keine Barrierefreiheitserklärung.
2. **Impressum/Datenschutz:** vorhanden (Hub, omoteno.de). Angaben je
   Betrieb offen (siehe Checkliste).
3. **Verarbeitungsverzeichnis (Art. 30), Technisch-organisatorische Maß-
   nahmen (Anlage zum AVV), Meldeweg bei Datenpanne (Art. 33: 72 Stunden):**
   brauchen Omoteno **und** jeder Betrieb. Ein Muster für den Notfallplan
   liegt unter `13-datenpanne.md`.
4. **Datenschutzbeauftragter:** Pflicht erst ab 20 Personen, die ständig mit
   automatisierter Verarbeitung befasst sind (§ 38 BDSG) — vermutlich nicht
   erreicht → Datenschutzberater bestätigt.
5. **Newsletter:** Double-Opt-In über Klaviyo (bereits).
6. **Abmahnrisiko:** Impressum, Widerruf, Preisangaben, Zahlungsarten,
   Button-Beschriftung sind die klassischen Abmahngründe. Alles davon ist im
   Hub umgesetzt und wird geprüft (`pruef-preisangaben`, `pruef-rechtstexte`,
   `pruef-zahlung`).
7. **Kasse/Steuer:** Elektronische Aufzeichnungssysteme brauchen seit 2020
   eine zertifizierte Sicherheitseinrichtung (TSE, § 146a AO). Ob eine
   **Bestell- und Bezahl-App** selbst eine Kasse ist, oder ob die Bestellung
   in die Kasse des Betriebs gehört, **kann ich nicht belegen** → Steuerberater
   (steht seit Befund 7 offen). Bis dahin sagt Omoteno nirgends „ersetzt Ihre
   Kasse“. Der CSV-Export im Board liefert Bestellungen **und** Zahlstatus für
   die Kasse/Buchhaltung des Betriebs.

---

## 7 · Quellen (gelesen, nicht amtlich)

- Surcharging-Verbot, § 270a BGB, § 312a Abs. 4 BGB:
  [IT-Recht Kanzlei – Entgelte für Zahlungen](https://www.it-recht-kanzlei.de/entgelt-zahlungen-paypal-sofortueberweisung.html),
  [ECC Rechtstipp 2018](https://www.ifhkoeln.de/wp-content/uploads/2020/07/ECC-Rechtstipp_2018-Nr-150-Januar2018.pdf)
- ZAG / Plattformen, die Geld durchleiten:
  [Stripe – Marktplatz-Zahlungsabwicklung in Deutschland](https://stripe.com/de-be/resources/more/payment-processing-for-marketplaces-in-germany),
  [Rose & Partner – Lieferheld und BaFin-Lizenz](https://www.rosepartner.de/blog/lieferheld-bafin-lizenz-finanztransfergeschaeft.html),
  [Advant Beiten – ungewollt betriebenes Finanztransfergeschäft](https://www.advant-beiten.com/aktuelles/das-ungewollt-betriebene-finanztransfergeschaeft)
- SEPA-Lastschrift bei Stripe: [Stripe – SEPA Direct Debit (Rechtliches, DE)](https://stripe.com/en-de/legal/sepa-direct-debit)
- Stripe als Verantwortlicher: [Stripe – DPA](https://www.stripe.com/at/legal/dpa),
  [e-recht24 – Datenschutzerklärung für Stripe](https://www.e-recht24.de/dsg/12735-stripe.html)
- PCI DSS / Stripe Checkout: [cside – Stripe und PCI DSS](https://cside.com/blog/can-you-use-stripe-for-pci-dss)
- Webhook-Signatur (Verfahren, Zeitfenster): [OpenReplay – Verify webhook signature](https://blog.openreplay.com/verify-webhook-signature/)
- Kassensicherung: [Tageskarte – Kassensicherungsverordnung](https://www.tageskarte.io/gastronomie/detail/schaerfere-anforderungen-was-gastronomen-zur-neuen-kassensicherungsverordnung-wissen-muessen.html)
- Jugendschutz Lieferung: [IT-Recht Kanzlei – Abgabe von Alkohol](https://www.it-recht-kanzlei.de/Kommentar/13221/Definition_der_Abgabe.php),
  [Verbraucherzentrale RLP – Alkohol aus dem Netz](https://verbraucherzentrale-rlp.de/marktcheck-alkohol-aus-dem-netz)
- Verpackungsgesetz Gastronomie: [Verpackungsregister LUCID – Gastronomen](https://verpackungsregister.org/ich-bin-gastronom-oder-caterer)
- BFSG: [IHK München – BFSG](https://www.ihk-muenchen.de/de/Service/Recht-und-Steuern/Werbung-Fairer-Wettbewerb/barrierefreiheitsstaerkungsgesetz/)

**Ehrliche Grenze:** Das Zahlungssystem ist gegen nachgestellte Antworten
gebaut und geprüft, **nicht** gegen echte Stripe-, PayPal- oder Klarna-Konten.
Ob PayPal, Klarna und SEPA im Stripe-Konto eines Betriebs freigeschaltet
sind, entscheidet Stripe — nicht dieser Code. Ein echter Testlauf mit dem
Stripe-Testmodus ist der erste Schritt nach dem Einspielen (Checkliste).
