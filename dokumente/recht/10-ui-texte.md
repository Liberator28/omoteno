# Knopf-, Häkchen- und Hinweistexte

Exakte Formulierungen. Wo der Hub zwölf Sprachen hat, stehen alle zwölf da —
die Übersetzungen sind von mir und müssen vor dem Einspielen von
Muttersprachlern gegengelesen werden (ein Rechtsbegriff wie „zahlungspflichtig"
hat in jeder Sprache eine übliche Form).

## A · Bestellknopf im Hub (§ 312j Abs. 3 BGB)

Ersetzt „Bestellung abschicken" (Wörterbuch-Schlüssel neu: „Zahlungspflichtig
bestellen").

| Sprache | Text |
|---|---|
| de | Zahlungspflichtig bestellen |
| en | Order with obligation to pay |
| tr | Ödeme yükümlülüğüyle sipariş ver |
| ru | Заказать с обязательством оплаты |
| fr | Commander avec obligation de paiement |
| es | Pedido con obligación de pago |
| it | Ordine con obbligo di pagamento |
| pl | Zamawiam z obowiązkiem zapłaty |
| ar | اطلب مع الالتزام بالدفع |
| uk | Замовити з обов'язком оплати |
| nl | Bestellen met betalingsverplichting |
| ro | Comandă cu obligație de plată |

Hinweis: Für Englisch, Französisch und Polnisch habe ich den Wortlaut der
jeweiligen Sprachfassung von Art. 8 Abs. 2 der Verbraucherrechte-Richtlinie
2011/83/EU genommen („order with obligation to pay", „commande avec
obligation de paiement", „zamówienie z obowiązkiem zapłaty"), soweit ich
ihn kenne — gegen den Amtsblatt-Text prüfen. Rechtlich maßgeblich für
einen deutschen Betrieb ist der deutsche Text; die anderen sind Lesehilfe.

Mindestgröße: 16 px, Kontrast ≥ 4,5:1, Knopf ≥ 44 px hoch (wie alle Knöpfe).

## B · „Sofort bestellen" (Top-Runner)

Knopf am Streifen: „Jetzt bestellen" → öffnet ein Blatt:

> **{Gericht}** · {Menge} × {Preis}
> Tisch {Nr}
> Summe {Betrag}
> [ Zahlungspflichtig bestellen ]   [ Abbrechen ]

## C · Unter der Karte und im Warenkorb

- „Alle Preise in Euro inkl. MwSt."
- Liefermodus: „zzgl. Liefergebühr {x} € · frei ab {y} €"
- Über dem Knopf, Liefermodus: „Ein Widerrufsrecht besteht nicht, da Speisen
  und Getränke frisch zubereitet werden und schnell verderben."
- Über dem Knopf, immer: Link „Impressum · Datenschutz"

## D · E-Mail-Feld „Post vom Haus"

Der bestehende Text (Vorlage, Zeile ~10560) bleibt. Darunter neu, als Link:
„Mehr dazu in unserer Datenschutzerklärung". Kein vorausgefülltes Häkchen —
das Eintragen der Adresse plus Bestätigungsmail ist die Einwilligung.
Knopf: „Adresse eintragen" (nicht „Anmelden" — nichts ist angemeldet,
solange die Bestätigung fehlt; so steht es schon im Code).

## E · Lieferanschrift merken (T11)

Häkchen, Vorgabe aus: „Adresse auf diesem Gerät merken"

## F · Alessia, Pflichtsatz vor jedem Gruß (T6)

> „Hallo, hier ist Alessia, die KI-Assistentin von {name}. Unser Gespräch wird
> zur Bearbeitung Ihrer Bestellung als Text mitgeschrieben."

Danach der frei wählbare Gruß des Betriebs. Auf die Frage „Bin ich mit einem
Menschen verbunden?" antwortet Alessia immer wahrheitsgemäß
(Systemanweisung): „Nein, ich bin eine KI. Wenn Sie lieber mit jemandem vom
Team sprechen, sagen Sie es — dann {Weiterleitung / Rückruf}."

## G · Vertragsschluss der Betriebe (T10)

Blatt beim ersten Anmelden nach der Freischaltung, beide Häkchen Pflicht,
keines vorausgewählt:

- [ ] Ich schließe den Vertrag für mein Unternehmen ab und habe die
  **AGB** (Fassung vom {Datum}) gelesen und akzeptiere sie.
- [ ] Ich schließe den **Vertrag zur Auftragsverarbeitung** (Fassung vom
  {Datum}) für mein Unternehmen ab.

Knopf: „Verbindlich abschließen". (Nicht „zahlungspflichtig", weil B2B —
schadet aber nicht, wenn das Entgelt sofort läuft.)

Gespeichert: Fassung, Zeitpunkt, angemeldetes Konto. Ohne beide Häkchen kein
Board, ein Satz statt Fehlermeldung: „Ohne diese Zustimmung können wir den
Zugang nicht freigeben."

## H · Anfrageformular `start.html`

Die bestehende Einwilligung im Formular prüfen auf genau diesen Wortlaut:

- [ ] Ich bin damit einverstanden, dass Omoteno meine Angaben und Dateien
  speichert, um meine Anfrage zu beantworten und ein Angebot vorzubereiten.
  Ich kann das jederzeit per E-Mail an hallo@omoteno.de widerrufen. Mehr in der
  [Datenschutzerklärung].

Dazu, damit die B2B-Grenze sichtbar ist (über dem Absendeknopf):
> Omoteno richtet sich ausschließlich an Gastronomiebetriebe und andere
> Unternehmer.

## I · Team einladen (Konto, „Dein Team")

Unter dem Einladen-Knopf:
> Die eingeladene Person kann sich mit ihrer E-Mail-Adresse anmelden. Was sie
> ändert, steht im Protokoll „Wer hat was geändert" mit ihrem Namen.
> Bitte informiere dein Team darüber.
