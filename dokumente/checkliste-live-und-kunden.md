# Checkliste · Live gehen und die ersten Kunden unter Vertrag

Stand 19.10.2026. Von oben nach unten; jede Zeile hat einen Besitzer
(**E** = Elias, **C** = Claude-Sitzung, **A** = Anwalt/Steuerberater) und
sagt, woran man „fertig" erkennt. Quellen stehen in Klammern — nichts
hier ist aus dem Gedächtnis, aber **nichts von Supabase ist von hier aus
geprüft** (die Datenbank war in dieser Sitzung nicht erreichbar). Jede
Datenbank-Zeile ist deshalb „im Editor nachsehen", nicht „ist erledigt".

**Entscheidung dieser Sitzung:** Choco L'AMouR bleibt bewusst ohne
vollständiges Impressum, bis es Kunde ist (Pitch nächsten Monat). Das
Impressum im Hub zeigt bis dahin „Angabe fehlt noch" — gewollt, siehe
Block 5.

---

## 1 · Was ein Kunde sehen muss, bevor er unterschreibt (Pitch)

- [ ] **E** Pitch-Hub ist als Vorführung erkennbar. Choco läuft unter
      `choco-lamour.omoteno.de` öffentlich, mit „Angabe fehlt noch" im
      Impressum. Der Hub trägt `noindex` (Google findet ihn nicht), aber
      jeder mit dem Link sieht es. Entweder den Link nur dem Betrieb
      geben, oder wie beim Vorführhaus Nordstern (`demo`) Omoteno als
      Betreiber nennen, bis Choco unterschreibt.
- [ ] **E** Der Pitch-Weg auf dem **eigenen Telefon** durchgespielt, in
      dieser Reihenfolge: Hub öffnen · Karte · Foodroulette (Rad UND
      Karten wischen) · Warenkorb · Bestellen · Küche zeigt den Bon ·
      Bestellpass · Board (Einstellungen, Gast-Hub gestalten, Texte).
      Meine Messungen sind kopflos (Chromium); iPhone und Android sehen
      nur Sie.
- [ ] **E** Ein Tablet in der Küche mit `kueche.html`, angemeldet, Ton
      an (Browser verlangt einmal eine Berührung für den Ton).
- [ ] **E** Zwei, drei echte Tischschilder/Untersetzer mit QR-Code für
      den Pitch-Termin gedruckt (Tischcode ist statisch: beweist „war am
      Tisch", nicht „sitzt dort" — so sagen).

## 2 · Technik, die vor dem ersten echten Gast stehen muss

- [ ] **C** Branch `claude/landingpage-design-integration-r000h9`
      (Rückwurf-Fix, Kartenwisch-Fotos, Rechtslinks, Lahmacun, neuer
      Texte-Editor) als PR nach `main`, Netlify-Vorschau ansehen, mergen.
- [ ] **E** Netlify: alle drei Projekte prüfen. `super-lamington-a072f5`
      ist nicht aus diesem Repo und seit PR #10 rot — löschen oder
      zuordnen.
- [ ] **E** Pro Kunde: Adresse erreichbar (siehe Block 6, Skill
      „neuer-kunde"). `pruef-lieferung.js` fängt „Zeile vergessen", nicht
      „DNS fehlt".
- [ ] **C+E** Supabase: alle Dateien in `datenbank/` mit „NOCH NICHT
      EINGESPIELT" im Kopf einspielen — heute `migration-loeschfristen.sql`
      und `migration-einkauf-e5d.sql`. Danach `LOESCHFRISTEN_LIVE = true`
      in `vorlagen/hub.vorlage.html` (die Prüfung `pruef-rechtstexte`
      verbietet es vorher) und neu erzeugen.
- [ ] **E** Im SQL-Editor **`datenbank/pruef-rechte.sql`** und
      **`pruef-missbrauch.sql`** laufen lassen (drehen sich selbst
      zurück). Erst wenn beide durch sind, ist „anon kann nichts
      Fremdes" belegt statt behauptet.
- [ ] **C** Offener Fund CLAUDE.md §2.3f: `authenticated` hat auf ca. 18
      Tabellen mehr Schreibrechte als die RLS braucht (`bestellungen`,
      `betrieb_mitglieder`, `gerichte`, `rechnungen` …). Heute hält die
      RLS. Eigenes Vorhaben: jeden Schreibweg des Boards prüfen, dann
      das GRANT kürzen.
- [ ] **E** Supabase-Einstellungen, die nicht im Verzeichnis stehen:
      Site URL + erlaubte Rücksprung-Adressen (Passwort-Reset in Board,
      Konto, Master), Mailversand, Google-Anbieter (der Knopf prüft
      vorher, aber ohne Anbieter gibt es keinen Login), Sicherungen
      (Tarif? wie lange?).
- [ ] **E** Edge Functions: Geheimnisse gesetzt (Anthropic für
      `beleg-lesen`/Übersetzer, fal.ai für Profi-Foto, Klaviyo, Vapi-
      Geheimnis für Alessia). `list_edge_functions` gegen den Ordner
      `supabase/functions/` halten — jede ausgerollte muss im
      Verzeichnis liegen (CLAUDE.md §2.3d).
- [ ] **E** Push-Meldungen: Push-Schlüssel (Web-Push) gesetzt, ein echter Serviceruf
      kommt auf dem Team-Handy an (`pruef-push.js` prüft nur sw.js).
- [ ] **C** Bekannte rote Prüfungen: `pruef-texte` (Begleitersatz bei
      360 px, 3 statt 2 Zeilen, schon vor dieser Sitzung). Der
      Lahmacun-Fehler im Foodroulette ist behoben.
- [ ] **E** Alessia (Telefon), nur falls im ersten Vertrag: Vapi-Assistent
      je Betrieb neu einfügen (`erzeuger/erzeuge-alessia.js`), **Tonaufnahme
      im Assistenten aus** (Dashboard → Assistant → Artifact Plan),
      Begrüßung nennt KI + Mitschrift.
- [ ] **E** Monitoring: ein kostenloser Erreichbarkeitsdienst auf
      `omoteno.de` und einen Hub; eine Adresse, an die Fehler gehen.

## 3 · Recht: Omoteno selbst (B2B-Vertrag)

Entwürfe liegen in `dokumente/recht/` — **keine Rechtsberatung**, zur
Prüfung durch Fachanwältin/Fachanwalt für IT-Recht.

- [ ] **A** `03-datenschutz-omoteno.md` und `04-impressum-omoteno.md`
      prüfen lassen, dann auf omoteno.de.
- [ ] **A** `05-agb.md` (Betriebe) und `06-avv.md` (Auftragsverarbeitung
      mit Anlagen) prüfen lassen. Der AVV ist Pflicht **vor** dem ersten
      Gästedatensatz eines Kunden.
- [ ] **E** Antworten auf `11-offene-angaben.md`, Abschnitt „Angaben zu
      Omoteno": Kleinunternehmer § 19 UStG ja/nein (Landingpage sagt
      „zzgl. USt."), USt-IdNr., Kündigungsfrist, Zahlungsweg (Rechnung
      oder SEPA), Testphase (Più Gusto hat 30 Tage in der Datenbank).
- [ ] **E** Für jeden US-Anbieter (Supabase, Netlify, Klaviyo, Vapi,
      fal.ai, Anthropic): Auftragsverarbeitungsvertrag des Anbieters
      angenommen und abgelegt, Übermittlungsgrundlage (DPF oder
      Standardvertragsklauseln) eingetragen.
- [ ] **E** Supabase-Region und Sicherungsdauer notieren (für AVV § 6),
      Netlify-Protokolldauer belegen (die „30 Tage" sind nicht belegt).
- [ ] **A** Steuerberater: Bestellsystem und Kassensicherungsverordnung
      (Befund 7). Der Hub nimmt kein Geld — „Hier wird nicht bezahlt,
      abgerechnet wird beim Personal" — das ist die Linie, die es zu
      bestätigen gilt, besonders bei Lieferung.
- [ ] **E** Gewerbe, Berufshaftpflicht/Cyber-Versicherung geklärt
      (Allergene-Anzeige und Ausfall während des Dienstes sind die
      realen Risiken).

## 4 · Recht: je Kunde (steht vor dem Livegang des Kunden)

Für Choco L'AMouR, Blend, Minhkeey, Più Gusto und jeden weiteren:

- [ ] **E** Angaben fürs Impressum in `markenblaetter/<slug>.json` unter
      `recht`: Firma/Inhaber, Rechtsform, Vertretungsberechtigte,
      Registergericht und -nummer, USt-IdNr., Anschrift, Telefon,
      E-Mail (Vorlage `07-hub-impressum.md`). **Più Gusto: Anschrift
      fehlt noch.** Der Hub schreibt sonst „Angabe fehlt noch".
- [ ] **E** AVV vom Kunden unterschrieben/angeklickt und abgelegt (T10).
- [ ] **E** Der Kunde hat die **Allergen-Daten selbst** gepflegt oder
      freigegeben. Der Hub sagt „Bei Allergien fragen Sie bitte
      zusätzlich unser Serviceteam" — die Verantwortung für die Angaben
      steht im Impressum bei ihm. Ein falsch gesetztes Allergen ist
      schlimmer als ein fehlendes.
- [ ] **E** Altersfreigabe 16+/18+ an jedem alkoholischen Gericht
      geprüft (das Board schlägt nur vor).
- [ ] **E** Lieferung nur, wenn gewollt: Gebühr, Mindestwert, Zeiten,
      Gebiet im Board gesetzt; „kein Widerrufsrecht bei frischen
      Speisen" ist im Hub schon drin.
- [ ] **E** Öffnungszeiten, WLAN, Links, Trinkgeld im Markenblatt echt
      (Più Gusto: echte Öffnungszeiten fehlen).

## 5 · Choco L'AMouR: der Weg vom Pitch zum Kunden

- [ ] **E** Pitch (nächsten Monat) auf der Vorführfassung.
- [ ] **E** Unterschrift: Vertrag + AGB + AVV.
- [ ] **E** Betreiberdaten erfragen → `recht` in `chocolamour.json` eintragen →
      `node erzeuger/erzeuge-hub.js --alle`, `pruef-rechtstexte.js` grün
      → live. Erst dann ist das Impressum vollständig; vorher ist
      „Angabe fehlt noch" richtig und gewollt.
- [ ] **E** Karte des Betriebs einlesen („Karte einlesen" im Board),
      Allergene gegenlesen lassen, Fotos (Profi-Foto optional).
- [ ] **E** Team im Konto einladen („Dein Team"): Rolle Besitzer/Team,
      Gutschein-Recht nur wer es braucht, PIN gesetzt.
- [ ] **E** Einweisung des Personals: Küche, Bon, „Abholbereit",
      Serviceruf, Pause setzen, Ausverkauft (30 Minuten reichen).

## 6 · Neuer Kunde in 10 Schritten (wiederholbar)

(Der Skill „neuer-kunde" fährt das; hier die Reihenfolge für dich.)

1. Betrieb in Supabase anlegen, Besitzer-Konto, `betrieb_mitglieder`.
2. `markenblaetter/<slug>.json` mit Farben, Schriften, Logo, Zeiten,
   `recht`.
3. Kontraste rechnen (`pruef-kontrast.js`, `pruef-lesbarkeit.js`) — Tag
   und Abend; Farben des Kunden nie ungeprüft.
4. Hub erzeugen, `pruef-datei.py` und `pruef-ueberlauf.js` auf die
   erzeugte Datei.
5. Adresse: CNAME beim Domainanbieter, Alias in Netlify,
   `_redirects` mit Ausrufezeichen, `bauen.js`, `pruef-lieferung.js`.
6. Karte einlesen, Kategorien/Zeichen, Allergene, 16+/18+.
7. Tischcodes/QR drucken, `tisch_pflicht` bleibt **aus**, bis die
   Untersetzer auf den Tischen liegen.
8. AVV + Vertrag + Zahlungsweg.
9. Probebestellung durch alle Stationen (Hub → Küche → Board →
   Bestellpass → Storno).
10. Livegang an einem ruhigen Tag, du bist in der ersten Schicht dabei.

## 7 · Geschäft

- [ ] **E** Preismodell festgelegt und auf der Landingpage identisch
      (Netto/Brutto, Testphase, Kündigung).
- [ ] **E** Rechnungsstellung: Vorlage, Nummernkreis, Zahlungsziel;
      SEPA-Mandat falls Lastschrift.
- [ ] **E** Support-Weg: eine Adresse, eine Telefonnummer, Reaktionszeit
      im Vertrag. Bei Ausfall während des Dienstes: wer ruft wen an.
- [ ] **E** Pilotvereinbarung für den ersten Kunden (Laufzeit, was
      „live" heißt, Abnahme).
- [ ] **E** Referenz: ein Foto/ein Satz vom ersten Haus (mit Erlaubnis)
      für die Landingpage.

## 7b · Zahlarten live schalten (Karte, Klarna, PayPal, SEPA, Überweisung)

Standard bleibt: Der Gast zahlt beim Personal. Nichts davon ändert sich,
bis ein Betrieb unter „Einstellungen → Bezahlen“ etwas einschaltet.

- [ ] **E** `datenbank/migration-zahlungen.sql` einspielen. Vorher die
      zwei Abfragen aus ihrem Kopf (Signaturen von `bestellung_aufgeben`
      und `bestellung_liefern`, Schranken von `bestellungen`) — **genau
      eine Zeile je Funktion**. Danach `datenbank/pruef-zahlungen.sql` im
      SQL-Editor (dreht sich zurück): jede Zeile muss `true` sein. Lokal
      laufen sie 116 von 116 — gegen die echte Datenbank noch nie.
- [ ] **E** Edge Functions ausrollen, beide **ohne** Token-Prüfung (die
      Echtheit kommt beim Webhook aus der Unterschrift):
      `supabase functions deploy zahlung-starten --no-verify-jwt` und
      `supabase functions deploy stripe-webhook --no-verify-jwt`.
      Geheimnisse nur in Supabase: `STRIPE_SECRET_KEY` (Plattform),
      `STRIPE_WEBHOOK_SECRET`. Dann `list_edge_functions` gegen den Ordner
      halten (CLAUDE.md §2.3d).
- [ ] **E** Stripe-Plattformkonto: Connect aktivieren; Webhook-Endpunkt
      vom Typ „Connected accounts“ auf `…/functions/v1/stripe-webhook` mit
      `checkout.session.completed`, `.async_payment_succeeded`,
      `.async_payment_failed`, `.expired`.
- [ ] **E** **Erst im Teststand** durchspielen: Testkarte, Abbruch auf der
      Bezahlseite, abgelaufene Sitzung (30 min), fehlgeschlagene Zahlung,
      Klarna-/PayPal-Testkonto, SEPA-Testmandat. Bei jedem Weg: Landet
      die Bestellung erst NACH der Zahlung in der Küche? Kommt der Push?
- [ ] **E** Ausfall üben: Webhook-Geheimnis absichtlich falsch → die
      Bestellung bleibt „Zahlung offen“ im Board → „Beim Personal bezahlt
      – freigeben“ funktioniert → eine spätere Zahlung erscheint als
      „Rückzahlung nötig“.
- [ ] **E** Rückzahlung üben (Stripe-Dashboard) und „erledigt“ tippen.
- [ ] **E** Je Betrieb: eigenes Stripe-Konto (Standard-Konto, Betrieb
      ist Vertragspartner von Stripe), Klarna und PayPal im
      Stripe-Dashboard des Betriebs freigeschaltet (Klarna prüft den
      Händler), `acct_…` im Board eintragen, PIN bestätigen.
- [ ] **E** Rechtlich (Fragen stehen in `recht/12`): Anwalt zur
      Einschätzung nach ZAG (Omoteno hält nie Geld, keine
      Plattformgebühr über die Zahlung); Steuerberater zum Preismodell;
      Stripe/Klarna/PayPal als Empfänger in `recht/03` und im AVV
      (`recht/06`) namentlich; kein Aufpreis auf irgendeine Zahlart
      (§ 270a BGB).
- [ ] **E** SEPA-Lastschrift nur einschalten, wenn der Betrieb weiß:
      Bestätigung kann Tage dauern, die Küche beginnt dann erst
      spät. Für Essen zum Sofortverzehr nicht sinnvoll.
- [ ] **E** Überweisung nur bei Lieferung, nur wenn gewünscht; die
      Küche beginnt erst nach „Zahlung eingegangen“ (Besitzer tippt).

## 8 · Was ich NICHT belegen kann

- Wie Animationen und Schriften auf echten Telefonen aussehen
  (kopfloser Chromium; Safari-Eigenheiten wie `-webkit-text-fill-color`
  sind nicht auslösbar).
- Ob Claude echte Rechnungen richtig liest (`beleg-lesen`) — zeigt nur
  ein Lauf mit Schlüssel.
- Ob E-Mails (Passwort-Reset, Einladung, Klaviyo) ankommen — zeigt nur
  ein echter Versuch.
- Alles, was in Supabase, DNS und Netlify-Einstellungen steht.
- Ob Stripe, Klarna und PayPal mit diesem Code wirklich Geld bewegen — die
  Edge Functions laufen in der Prüfung gegen gestelltes Deno/fetch, nie
  gegen Stripe.
