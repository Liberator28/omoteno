# Recht · Mit KI gebaute Software verkaufen — Hessen, Stand 25.10.2026

> **Lesen vor allem anderen.** Ich bin kein Anwalt, und das hier ist **keine Rechtsberatung**. Es ist eine
> belegte Vorarbeit für das Gespräch mit einer Fachanwältin bzw. einem Fachanwalt für IT-Recht und mit dem
> Steuerberater. Ein Fehler wird nicht dadurch kleiner, dass er „nur" aus einer Recherche stammt.
>
> **Ehrliche Grenzen dieser Recherche**
> - Gesetzestexte (gesetze-im-internet.de, EUR-Lex) waren aus dieser Umgebung **nicht abrufbar** (der Abruf
>   scheiterte am Netzzugang). Paragrafen und Fristen stammen aus Kanzlei-, IHK- und Behördenseiten, die die Suche
>   lieferte, oder aus meinem Wissen. Jede Zeile trägt deshalb eine Güte: **[B]** = Kanzlei/IHK/Verband gelesen,
>   **[W]** = mein Wissen, in dieser Runde nicht belegt, **[?]** = ich habe nichts gefunden.
> - „Zertifizierte" Aussagen gibt es nicht als Gütesiegel. Am nächsten kommen: Gesetzestext, Gerichtsentscheidung,
>   Aufsichtsbehörde (z. B. HBDI, BSI), Kammern (IHK, Rechtsanwaltskammer). Foren und Anbieterseiten habe ich nur
>   als Hinweis auf Fragestellungen benutzt, nie als Beleg.
> - Zwei Punkte aus früheren Runden bleiben offen und sind unten wiederholt (Kasse/TSE, ZAG).

## 1 · Die kurze Antwort

**Darf ich Software verkaufen, die mit KI geschrieben wurde? Ja.** Das deutsche Recht kennt kein Verbot und keine
Pflicht, den Entstehungsweg anzugeben. Für Haftung, Verträge, Datenschutz und Preise zählt das **Produkt**, nicht das
Werkzeug: Omoteno haftet für einen Fehler im Hub genauso, als hätte ihn ein Mensch getippt. Fünf Dinge sind wirklich
anders — und genau dort liegen die Risiken:

| # | Was anders ist | Folge in einem Satz |
|---|---|---|
| 1 | **Urheberrecht**: Rein KI-erzeugter Code ist in Deutschland vermutlich nicht geschützt | Du kannst Nachbauer weniger leicht stoppen; Vertrieb und Verträge bleiben möglich |
| 2 | **Qualität und Haftung** hängen an deinem Nachweis, dass du geprüft hast | Das ist dein stärkster Punkt: über 600 Prüfungen und Gegenbeweise liegen im Verzeichnis |
| 3 | **KI im Produkt** (Alessia, Übersetzer, Foto, Rechnungslesen) | KI-Verordnung (Art. 50 seit 2.8.2026), DSGVO, Irreführungsverbot |
| 4 | **Aussagen über das Produkt** („DSGVO", „keine Kasse") | Müssen stimmen, sonst Abmahnung (UWG) |
| 5 | **Verträge**: Ohne AGB/AVV hast du keine Haftungsgrenze und keinen Datenschutzvertrag | Heute **nicht eingeführt** — das ist der größte offene Punkt (R1) |

## 2 · Rechtslage nach Thema (mit Quellen)

### 2.1 Urheberrecht an KI-erzeugtem Code **[B]**
- Schutz setzt eine „persönliche geistige Schöpfung" voraus (§ 2 Abs. 2 UrhG), bei Software gilt § 69a Abs. 3 UrhG
  („eigene geistige Schöpfung"). Einer KI fehlt die eigenschöpferische Leistung; **rein KI-erzeugter Output ist derzeit
  nicht geschützt**. Schutz kommt in Betracht, wenn **menschlicher Einfluss den Output prägt** und das objektiv
  nachweisbar ist (AG München, Urteil vom 13.02.2026, Az. 142 C 9786/25 — dort für drei KI-Logos verneint). Eine
  höchstrichterliche Entscheidung zu KI-Code habe ich nicht gefunden.
- **Folge:** Du darfst die Software verkaufen und vermieten. Du solltest nicht schreiben „alle Rechte vorbehalten" als
  Beweis eines Schutzes, sondern **Vertragsschutz** nutzen (AGB: Nutzungsrecht, Weitergabeverbot, Geheimhaltung) und
  den **menschlichen Anteil dokumentieren** (Konzept, Anforderungen, Auswahl, Prüfung — das steht in `CLAUDE.md`, in
  den Prüfungen und im Git-Verlauf). Bei einem Firmenverkauf oder einer Beteiligung fragt jede Due Diligence danach.
- Quellen: [CMS – KI-generierter Softwarecode in der Due Diligence](https://cms.law/de/deu/legal-updates/ki-generierter-softwarecode-in-der-due-diligence) ·
  [Taylor Wessing – Once again no copyright protection for AI-generated output (02/2026)](https://www.taylorwessing.com/de/insights-and-events/insights/2026/02/once-again-no-copyright-proetection-for-ai-generated-output) ·
  [Uni Duisburg-Essen – Generative KI und Urheberrecht](https://www.uni-due.de/ub/urheberrecht/ki-und-urheberrecht)
- **Nicht recherchiert in dieser Runde [?]:** die Nutzungsbedingungen des KI-Anbieters (wem gehört der Output, Haftungs-
  freistellung bei Rechtsverletzungen, Datennutzung). Das steht in den *Commercial Terms* des Anbieters und gehört in
  die Akte; ich habe sie nicht geprüft.
- **Drittrechte im Code [W]:** KI kann Code erzeugen, der fremdem Code ähnelt (Lizenzen wie GPL). Ein Scan der
  Abhängigkeiten und ein Ähnlichkeitslauf (z. B. mit einem Lizenzscanner) wäre die übliche Antwort; das gibt es im
  Verzeichnis nicht. Selbst eingebundene Bibliotheken (MIT) und Schriften (OFL, Noto CC BY) sind mit Vermerken
  geführt (`auslieferung/lib/LIZENZEN.txt`, `auslieferung/schriften/LIZENZEN.txt`, `pruef-lizenzen.py`).

### 2.2 Haftung, Gewährleistung, AGB im B2B **[B]**
- SaaS-Verträge ordnet die Rechtsprechung überwiegend dem **Mietrecht** zu: Der Anbieter schuldet einen **mangelfreien
  Zustand während der gesamten Laufzeit**; das darf in AGB nicht unangemessen eingeschränkt werden.
- Haftungsausschlüsse in AGB unterliegen der Kontrolle nach §§ 307 ff. BGB. Bei einfacher Fahrlässigkeit ist eine
  Beschränkung möglich, **außer bei Kardinalpflichten** (Bereitstellung, vereinbarte Verfügbarkeit, Datensicherheit,
  Datenexport): Dort muss mindestens der vorhersehbare, vertragstypische Schaden gedeckt sein. Eine Deckelung auf
  eine Monatsgebühr gilt als angreifbar; **12 Monatsentgelte** (so im Entwurf `05-agb.md` § 9) sind vertretbarer.
- Die Vorschriften für **digitale Produkte** (§§ 327 ff. BGB, Update-Pflicht, Rückgriff § 327u) betreffen Verbraucher;
  Omoteno verkauft nur an Unternehmer. Der Rückgriff in der Lieferkette kann trotzdem auf den Betrieb zurückfallen,
  wenn ein Betrieb Verbrauchern Software-Funktionen schuldet — für die Gästeseite (Bestellung) ist das der Wirt, nicht
  Omoteno.
- **Neues Produkthaftungsrecht:** Die Richtlinie (EU) 2024/2853 bezieht **Software und KI-Systeme** ein und ist bis
  **9.12.2026** umzusetzen. Der Bundestag-Rechtsausschuss hat am 7.10.2026 eine Beschlussempfehlung vorgelegt
  (BT-Drs. 21/8429); ob das Plenum beschlossen hat, konnte ich nicht belegen. Gilt vor allem für Personen- und
  Sachschäden (z. B. falsche Allergen-Ausgabe, die einen Gast verletzt). Quelle:
  [BT-Drs. 21/8429](https://dserver.bundestag.de/btd/21/084/2108429.pdf) ·
  [MTR Legal – Bundestag beschließt neues Produkthaftungsrecht](https://www.mtrlegal.com/bundestag-beschliesst-neues-produkthaftungsrecht/).
  → **Betriebshaftpflicht/IT-Haftpflicht prüfen** (Hersteller, nicht nur Dienstleister). **[W]**
- **Cyber Resilience Act:** Meldepflichten für ausgenutzte Schwachstellen und schwere Vorfälle ab **11.9.2026**, übrige
  Pflichten ab 11.12.2027 **[B]**. Ob reine SaaS-Dienste darunter fallen, ist in den Quellen nicht entschieden;
  nach dem Wortlaut sind reine Cloud-Dienste ohne Produkt meist nicht erfasst **[W]** → Anwalt, solange der Hub eine
  ausgelieferte Datei ist (er ist es: eine HTML-Datei im Gerät des Gastes).
- Quellen: [SRD Rechtsanwälte – SaaS: Rechtliche & praktische Tipps](https://www.srd-rechtsanwaelte.de/blog/saas-rechtsfragen-faq) ·
  [SRD – SaaS-Verträge: Einordnung](https://www.srd-rechtsanwaelte.de/blog/saas-vertraege-einordnung-moeglichkeiten) ·
  [Haufe/buzer – § 327u BGB](https://www.buzer.de/327u_BGB.htm)

### 2.3 KI-Verordnung (Verordnung (EU) 2024/1689) **[B]**
- **Art. 50 Abs. 1** (Menschen müssen erfahren, dass sie mit einer KI sprechen) **gilt seit 2.8.2026** und wurde vom
  „Digital Omnibus" **nicht** verschoben. Die Kommission hat am 20.7.2026 Leitlinien zu Art. 50 veröffentlicht.
  Die maschinenlesbare Kennzeichnung synthetischer Inhalte (Art. 50 Abs. 2) trifft **Anbieter** von KI-Systemen
  (hier fal.ai/Bria/Anthropic, nicht Omoteno); für ältere Systeme bis 2.12.2026.
- **Art. 4 (KI-Kompetenz)** gilt seit 2.2.2025 für Anbieter *und* Betreiber: Wer KI einsetzt, sorgt für ausreichende
  Kenntnisse — kurz dokumentieren (eine Seite genügt) **[W]**.
- Quellen: [Datenschutzticker – KI-Verordnung: Neue Transparenzpflichten ab 2. August 2026](https://www.datenschutzticker.de/2026/07/ki-verordnung-neue-transparenzpflichten-ab-2-august-2026/) ·
  [Dreyfield – KI-Verordnung ab dem 2. August](https://www.dreyfield.de/ki-verordnung-august-2026/) ·
  [MB Kanzlei – Art. 50 KI-VO](https://mbkanzlei.digital/blog/ki-vo-artikel-50-transparenzpflichten/) ·
  [TÜV Rheinland – Transparenzpflichten Art. 50](https://consulting.tuv.com/aktuelles/ki-im-fokus/transparenzpflichten-eu-ai-act-art-50)
- **Folge für Omoteno:** Alessia nennt sich im Gruß KI (umgesetzt, `pruef-alessia.js`) — das ist die Pflicht aus Art. 50
  Abs. 1. Bußgelder: Art. 99 KI-VO **[W]**, Höhe hier nicht belegt.

### 2.4 Telefon-Assistentin: Strafrecht und Datenschutz **[B]**
- Eine Aufzeichnung des nichtöffentlich gesprochenen Wortes ohne Einwilligung kann nach **§ 201 StGB** strafbar sein
  (Freiheitsstrafe bis drei Jahre oder Geldstrafe). Empfehlung der Quellen: Einwilligung vor Aufnahmebeginn, Ablehnung
  muss folgenlos bleiben; bei Alessia ist die **Tonaufnahme aus**, nur die Mitschrift wird gespeichert.
- Quelle: [IT-Recht Kanzlei – KI-Telefonsupport und Datenschutz](https://www.it-recht-kanzlei.de/ki-telefonsupport-datenschutz.html) ·
  [Famulor – Telefonaufzeichnung DACH](https://www.famulor.io/de/blog/recording-phone-calls-legal-guide-for-the-dach-region-ai-usage) (Anbieterseite, nur Hinweis)
- **Offene Handlung:** In Vapi die Tonaufnahme **tatsächlich** ausschalten und bestehende Assistenten mit dem neuen
  Pflichtsatz neu einfügen (Befund aus `02-technik.md` T6).

### 2.5 Datenschutz (DSGVO, TDDDG, Aufsicht in Hessen)
- Omoteno ist für Gäste-, Bestell- und Mitarbeiterdaten **Auftragsverarbeiter** der Betriebe; **ohne AV-Vertrag nach
  Art. 28 DSGVO** ist die Verarbeitung für beide Seiten rechtswidrig. Ein fehlender oder mangelhafter AVV gehört zu den
  häufigsten Sanktionsgründen **[B]**. Unterauftragnehmer: vorher mitteilen, Widerspruch ermöglichen **[B]**.
  Quellen: [DSK Kurzpapier Nr. 13](https://www.datenschutzkonferenz-online.de/kurzpapiere.html) (über die Suche genannt) ·
  [EDPB Guidelines 07/2020](https://www.edpb.europa.eu/) (genannt).
- **Zuständige Aufsicht für Hessen** ist der Hessische Beauftragte für Datenschutz und Informationsfreiheit (HBDI)
  **[W]** — in dieser Runde nicht über die Suche belegt.
- **Meldung einer Panne binnen 72 Stunden** (Art. 33 DSGVO) **[W]**; Ablauf: `13-datenpanne.md`.
- **§ 25 TDDDG:** Gerätekennung erst nach „Einschalten" (umgesetzt, `pruef-gastkonto.js`).

### 2.6 Preise und Steuern
- **Omoteno → Betrieb (B2B):** Preise netto zuzüglich Umsatzsteuer (so auf der Landingpage: „Alle Preise zzgl. USt."). Die
  Preisangabenverordnung schützt Verbraucher; für reine Unternehmerpreise gilt sie nicht **[W]**. Wichtig ist, dass das
  Angebot erkennbar **nur an Unternehmer** geht (AGB § 1) — heute steht das nur im Entwurf, nicht auf der Seite.
- **Betrieb → Gast (B2C), im Hub:** Gesamtpreise einschließlich Umsatzsteuer (umgesetzt: „inkl. MwSt.", Lieferkosten
  getrennt, `pruef-preisangaben.js`).
- **Preisermäßigung (§ 11 PAngV):** Wer eine Ermäßigung bekanntgibt, muss den **niedrigsten Gesamtpreis der letzten 30
  Tage** nennen; das soll Mondpreise verhindern **[B]**. Der BGH hat am **9.10.2025 (I ZR 183/24)** zu einer
  hervorgehoben beworbenen Preisermäßigung entschieden, deren Bezug nicht der 30-Tage-Tiefstpreis war; der
  Tiefstpreis muss zudem verständlich dargestellt sein **[B]**. Ob und wie das für Speisen und Getränke einer
  Gaststätte gilt (z. B. Ausnahme für schnell verderbliche Ware), habe ich **nicht belegt [?]** → Anwalt.
  Quellen: [it-recht-kanzlei – Preisermäßigungen](https://www.it-recht-kanzlei.de/faq-werbung-preisermaessigungen-gesamtpreis-preisangabenverordnung.html?print=1) ·
  [BGH I ZR 183/24 (rewis)](https://rewis.io/urteile/urteil/sqe-09-10-2025-i-zr-18324/)
- **Mehrwertsteuer in der Gastronomie:** Seit **1.1.2026** gilt für **Speisen** (vor Ort, Abholung, Lieferung) 7 %
  (§ 12 Abs. 2 Nr. 15 UStG), für **Getränke** weiter 19 %; Milchgetränke (≥ 75 % Milch, ohne Alkohol) nur zum Mitnehmen 7 %.
  Kombi-Angebote: ein BMF-Schreiben vom 22.12.2025 soll einen Pauschalanteil von 30 % für Getränke zulassen (nur
  eine Quelle). **[B]** — Das Board rechnet **keine** Steuer aus (`grep` nach MwSt im Board: keine Fundstelle). Das
  ist unkritisch, solange Omoteno keine Belege erteilt; bei Kasse/Rechnungserstellung wäre es Pflicht.
  Quellen: [DIHK](https://www.dihk.de/de/newsroom/ermaessigter-mehrwertsteuersatz-fuer-gastronomie-161492) ·
  [IHK Darmstadt](https://www.ihk.de/darmstadt/produktmarken/beraten-und-informieren/branchen/tourismus-in-suedhessen/informationen-fuer-gastronomie-und-hotellerie/reduzierter-mehrwertsteuersatz-6933470) ·
  [IHK Frankfurt](https://www.frankfurt-main.ihk.de/branchenthemen/portal-gastronomie-tourismus-und-gesundheitswirtschaft/wichtige-informationen-zum-gaststaettengewerbe/news-fuer-die-gastronomie/reduzierter-mehrwertsteuersatz-6847546)
- **E-Rechnung (für Omoteno selbst):** Empfangen müssen alle Unternehmer seit 1.1.2025 können; **ausstellen** muss, wer
  2026 mehr als 800 000 € Vorjahresumsatz hat, ab 1.1.2027, alle ab 1.1.2028 (Ausnahme Kleinbetragsrechnungen < 250 €)
  **[B]** — Quelle: [IHK Schwerin](https://www.ihk.de/schwerin/recht/aktuelles/e-rechnung-ab-2025-verpflichtend-6171118),
  [IHK Potsdam](https://www.ihk.de/potsdam/ihk-service-und-beratung/e-rechnungen-ab-2025-6223258). Kleinunternehmer-
  Grenzen (§ 19 UStG) **nicht belegt [?]** → Steuerberater (offene Frage 1 in `11-offene-angaben.md`).

### 2.7 Gäste-Verträge im Hub (die Betriebe sind Vertragspartner)
- Der Bestellknopf heißt „Zahlungspflichtig bestellen" (§ 312j Abs. 3 BGB) — umgesetzt. Kein Widerrufsrecht bei frisch
  Zubereitetem (§ 312g Abs. 2 BGB) — als Hinweis im Hub umgesetzt **[W]**.
- **Allergene vor Vertragsschluss (Art. 14, Art. 9 LMIV):** Bei Fernabsatz müssen Pflichtangaben **vor** dem Vertragsschluss
  verfügbar sein; ein Telefon ersetzt das nicht (KG Berlin); **Angaben zu Allergenen müssen verbindlich sein, nicht
  unter dem Vorbehalt „kann abweichen"** (OLG Düsseldorf, I-U 82/19, nicht rechtskräftig) **[B]** — betrifft
  vorverpackte Ware im Onlinehandel; für lose Speisen im Restaurant gilt eine Ausnahme-Praxis, **die ich nicht belegen
  kann [?]**. Quelle: [vzbv-Urteile zu Allergenen](https://www.vzbv.de/urteil/online-lebensmittelhaendler-muss-vor-der-bestellung-auf-allergene-hinweisen) ·
  [IT-Recht Kanzlei – Allergenkennzeichnung](https://www.it-recht-kanzlei.de/allergenkennzeichnung-lebensmittel.html)
- **Mehrwegangebotspflicht (§§ 33, 34 VerpackG):** Wer Speisen zum Mitnehmen oder Liefern in Einwegverpackung abgibt,
  muss grundsätzlich eine Mehrwegalternative anbieten. **Ausnahme: höchstens 80 m² Verkaufsfläche *und* höchstens
  5 Beschäftigte** — dann nur mitgebrachte Behälter befüllen; **Hinweisschilder gelten für alle**; bei Lieferdiensten
  zählen Lager- und Versandflächen mit **[B]**. Quelle: [DUH-Infoblatt](https://www.duh.de/fileadmin/user_upload/download/Projektinformation/Kreislaufwirtschaft/Mehrweg/231130_Mehrwegangebotspflicht_Infoblatt_f%C3%BCr_Gastro_und_Veranstaltungen_FINAL.pdf) ·
  [Bayerische Abfallberatung](https://www.abfallratgeber.bayern.de/gewerbe/abfallvermeidung/mehrwegangebotspflicht/index.htm).
- **Verbraucherstreitbeilegung:** Die EU-Plattform ist seit **20.7.2025** abgeschaltet (der Link gehört nicht mehr ins
  Impressum — richtig so); die Angabe nach § 36 VSBG entfällt für Unternehmen bis zehn Beschäftigte **[B]**.
  Quelle: [IHK Schwaben](https://www.ihk.de/schwaben/produktmarken/recht-und-steuern/onlinerecht/neue-informationspflichten-fuer-online-haendler-3067566).
- **KI-Bilder von Speisen:** Zeigt ein Bild mehr als auf dem Teller landet, ist das irreführend (Art. 7 LMIV, § 5
  UWG); der BGH betrachtet die **Gesamtaufmachung**, nicht nur die richtige Zutatenliste („Himbeer-Vanille-Abenteuer")
  **[B]**. Zu *KI-Bildern* selbst fand ich keine Entscheidung **[?]**.

### 2.8 Kasse, TSE, Zahlungen
- **§ 146a AO / KassenSichV:** Elektronische Aufzeichnungssysteme brauchen eine zertifizierte TSE; **seit 1.1.2025
  Mitteilung** der Systeme an das Finanzamt (elektronisch, ELSTER; Anschaffung ab 1.7.2025: Monatsfrist);
  Verstöße bis 25 000 € Geldbuße (§ 379 AO). Eine Registrierkassenpflicht gibt es nicht; die offene Ladenkasse
  bleibt zulässig **[B]**. **Ob eine Bestell- und Bezahl-App ein Aufzeichnungssystem ist, geht aus den Quellen nicht
  hervor [?]** → **Steuerberater** (Befund 7, seit 18.10. offen).
  Quelle: [everbill – KassenSichV](https://www.everbill.com/?p=10261) · [Lido](https://www.lido.app/de/kassengesetz-tse) (Anbieter, nur Hinweis)
- **ZAG (Zahlungsdienste):** Omoteno nimmt nie Geld an (direct charges auf das Stripe-Konto des Betriebs, keine
  Plattformgebühr über die Zahlung). Die Quellen belegen **nicht**, dass Stripe Connect in jeder Gestaltung
  erlaubnisfrei ist **[B, Stripe-Seite]**; Handelsvertreterausnahme: nicht gefunden **[?]** → Fachanwalt für
  Zahlungsverkehr. Quelle: [Stripe – Marktplatz-Zahlungsabwicklung in Deutschland](https://stripe.com/de-be/resources/more/payment-processing-for-marketplaces-in-germany).

### 2.9 Barrierefreiheit (BFSG, seit 28.6.2025)
- Online-Bestellung für Verbraucher ist ein erfasster Dienst. **Kleinstunternehmen** (unter 10 Beschäftigte *und*
  höchstens 2 Mio. € Umsatz oder Bilanzsumme) sind für **Dienstleistungen** ausgenommen, **nicht** für Produkte
  **[B]**. Ob Omoteno als Softwareanbieter und der einzelne Betrieb als Dienstleister jeweils darunter fallen und ob
  die Prüfung auf Betriebs- oder Unternehmensebene zählt, ist in den Quellen widersprüchlich → Anwalt. Quelle:
  [IHK Aachen – BFSG](https://www.ihk.de/aachen/recht/rechtsinformationen/aktuelle-dokumente-zum-thema-recht/barrierefreiheitsstaerkungsgesetz-bfsg-6517836).

### 2.10 Werbung, Newsletter, Bewertungen
- Newsletter nur mit nachweisbarer Einwilligung, **Double-Opt-In** ist der sichere Weg; auch die Bestätigungsmail
  darf **keine Werbung** enthalten (LG Berlin, OLG München 29 U 1682/12) **[B]**. Eine Bitte um Bewertung in der
  Bestellbestätigung ist Werbung und ohne Einwilligung problematisch **[B]**. Quelle:
  [IHK Hannover – Newsletter](https://www.ihk.de/hannover/hauptnavigation/recht/e-business-recht/newsletter-rechtliche-voraussetzungen-5205352).
- **Rechtsdienstleistung durch Generatoren:** Das OLG Köln sieht einen Vertragsgenerator als zulässig (kein Verstoß
  gegen das RDG); ob das für **Datenschutz-/Impressumstexte aus dem Board** trägt, ist nicht entschieden **[B]** →
  Hinweis „Muster, kein Rechtsrat" an den Texten (`pruef-rechtstexte.js` prüft die Angaben, nicht die Haftung).

### 2.11 Hessen und Gründung **[W, nicht belegt]**
- Gewerbeanmeldung beim Gewerbeamt der Gemeinde (Stadtallendorf); IHK-Pflichtmitgliedschaft für Gewerbetreibende
  (zuständige Kammer nach Sitz prüfen); Datenschutzaufsicht HBDI; Verbraucher- und Wettbewerbsfragen:
  Verbraucherzentrale Hessen, Wettbewerbszentrale. Die Frage Freiberuf/Gewerbe für SaaS klärt der Steuerberater
  (die Quellen sagen: hängt von der Tätigkeit ab).

## 3 · Abgleich mit dem Projekt — Befunde R1 bis R16

Zeilen und Dateien gelesen am 25.10.2026 (Zweig `claude/landingpage-design-integration-r000h9`).
**Nichts davon ist umgesetzt.** „Vorschlag" ist der Wortlaut, den ich zeigen wollte, bevor ich ihn setze.

### HOCH

**R1 · AGB und AVV sind weder veröffentlicht noch werden sie angenommen**
- Belegt: `grep -n -i 'agb\|auftragsverarbeit' seiten/omoteno-web.html seiten/konto.html seiten/start.html` — keine Verlinkung;
  die Fußzeile der Landingpage hat nur Impressum und Datenschutz (Zeile 2887–2888); `grep agb_fassung` findet nichts
  im ganzen Verzeichnis (T10 aus `02-technik.md` ist offen).
- Folge: Ohne wirksam einbezogene AGB gilt das gesetzliche Mietrecht ohne Haftungsgrenze (§ 2.2). Ohne AVV fehlt für
  **jeden Betrieb** der Art.-28-Vertrag (§ 2.5). Das ist der größte offene Punkt, bevor ein weiterer Betrieb freigeschaltet wird.
- Vorschlag: (1) `seiten/agb.html` und `seiten/avv.html` aus `dokumente/recht/05-agb.md` und `06-avv.md` — **erst nach
  Anwaltsprüfung**; (2) im Konto ein Blatt mit zwei Häkchen (AGB, AVV), gespeichert mit Zeitpunkt und Fassung
  (`betriebe.agb_fassung`, `agb_akzeptiert_um`, `avv_akzeptiert_um`), ohne Häkchen kein Board; (3) Fußzeile der
  Landingpage: „AGB · Auftragsverarbeitung"; (4) im Preisfuß: „Das Angebot richtet sich ausschließlich an Unternehmer."

**R2 · Impressum der Gäste-Hubs: bei allen fünf Häusern fehlen die Pflichtangaben**
- Belegt: `markenblaetter/*.json` — bei `blend`, `chocolamour`, `minhkeey`, `nordstern`, `piugusto` ist **kein**
  `recht`-Block gesetzt. Der Hub zeigt dann „Angabe fehlt noch" (`hub.vorlage.html` Zeile 16595); der Erzeuger
  warnt nur, bricht aber nicht ab.
- Folge: Ein Impressum ohne Anschrift/Vertretung ist ein Verstoß gegen § 5 DDG (Bußgeld bis 50 000 €, Angabe aus
  `01-risikoanalyse.md`) und abmahnfähig. Das betrifft **die vier echten Betriebe**; Nordstern ist das Vorführhaus.
- Vorschlag: (a) Angaben je Betrieb einsammeln (Liste in `11-offene-angaben.md`), in die Markenblätter eintragen;
  (b) der Erzeuger lehnt ein **nicht** als Vorführhaus gekennzeichnetes Haus ohne `recht.firma` ab (heute nur Warnung).

**R3 · Aktionspreis: durchgestrichener Preis und „−20 %" ohne 30-Tage-Bezug (§ 11 PAngV)**
- Belegt: Hub zeigt in der Karte den gestrichenen **aktuellen Kartenpreis** und „−20 %"
  (`hub.vorlage.html` Zeile 13517ff.); der Streifen oben rechnet den Prozentsatz aus dem frei eingegebenen `preis_alt`
  (Zeile 7692). Der Bezug „niedrigster Preis der letzten 30 Tage" fehlt; hat der Wirt den Preis kurz vorher erhöht,
  ist die Ermäßigung nur scheinbar.
- Folge: Abmahnrisiko (UWG, § 11 PAngV; BGH I ZR 183/24). Ob Speisen in der Gastronomie ausgenommen sind, ist nicht
  geklärt (§ 2.6).
- Vorschlag — **zwei Wege zur Wahl:**
  - **A (klein, sofort):** Im Hub nur den Aktionspreis zeigen („Aktion: 4,90 €"), **kein** durchgestrichener Preis, **kein**
    Prozentsatz. Es wird dann keine Ermäßigung „bekanntgegeben".
  - **B (vollständig):** Das Protokoll (`wer hat was geändert`) kennt jede Preisänderung; daraus rechnet das Board den
    niedrigsten Kartenpreis der letzten 30 Tage und der Hub schreibt unter den Aktionspreis „Niedrigster Preis der
    letzten 30 Tage: x,xx €". Mehr Arbeit, aber behält die Streichpreis-Optik.
  - Empfehlung: **A jetzt, B später**, und beim Anwaltsgespräch fragen, ob die Gastronomie-Ausnahme greift.

### MITTEL

**R4 · „Angaben ohne Gewähr" bei Allergenen**
- Belegt: `hub.vorlage.html` Zeile 18389 (Wörterbuch Zeile 11239): „Angaben ohne Gewähr. Bei Allergien oder
  Unverträglichkeiten sprechen Sie bitte immer unser Serviceteam an."
- Folge: Die Rechtsprechung (OLG Düsseldorf) verlangt für Online-Allergenangaben **Verbindlichkeit**; ein Vorbehalt
  schwächt die Angabe und ist als Haftungsausschluss gegenüber Gästen ohnehin kaum wirksam (der Betrieb haftet).
- Vorschlag (Wortlaut, alle elf Sprachen nachziehen): „Bei Allergien oder Unverträglichkeiten fragen Sie bitte vor der
  Bestellung unser Serviceteam. Die Angaben zu Allergenen und Zusatzstoffen stammen vom Betrieb."

**R5 · Landingpage: Aussagen, die nicht (mehr) stimmen oder nicht belegt sind**
- Belegt (`seiten/omoteno-web.html`): (a) Zeile 1819 Plakette „DSGVO" — eine unbelegte Konformitätsbehauptung;
  (b) Zeile 2799–2803: „Es ist **ausdrücklich kein System mit Kassenfunktion nach § 146a AO** — … Bezahlt wird wie immer bei dir."
  — das ist eine **rechtliche Aussage**, die der Steuerberater nicht bestätigt hat (Befund 7), und sie passt nicht mehr, sobald die
  Online-Zahlung (Stripe) live ist; (c) Zeile 7 `meta description` „Ab 79 € im Monat" ohne „netto"; (d) die Seite
  sagt nirgends „nur für Unternehmer".
- Vorschlag (Wortlaut): (a) „DSGVO" → „Auftragsverarbeitungsvertrag inklusive"; (b) FAQ: „Omoteno ersetzt deine Kasse nicht. Deine
  Einnahmen erfasst du weiter in deiner Kasse. Wenn du die Online-Zahlung einschaltest, zahlt der Gast auf deinem eigenen
  Stripe-Konto." — und den Satz zu § 146a AO streichen, bis der Steuerberater geantwortet hat; (c) „Ab 79 € netto im Monat";
  (d) siehe R1.

**R6 · Löschfristen sind versprochen, aber nicht live**
- Belegt: `LOESCHFRISTEN_LIVE = false` (`hub.vorlage.html` Zeile 16547); `datenbank/migration-loeschfristen.sql`
  trägt den Kopf „ENTWURF 18.10. — NOCH NICHT EINGESPIELT". Der AVV (Anlage 1) und die Hub-Datenschutzerklärung nennen
  die Fristen erst, wenn der Schalter an ist — richtig; der Verstoß liegt in der **fehlenden Frist** (Art. 5 Abs. 1 lit. e DSGVO).
- Vorschlag: Migration im SQL-Editor einspielen (Löschteil darf das Werkzeug nicht ausführen, CLAUDE.md §2.8), zurückgedrehte
  Probe laufen lassen, dann Schalter an. Braucht Supabase-Zugang (in dieser Sitzung nicht erreichbar).

**R7 · Datenschutzerklärung von omoteno.de: Stripe fehlt, sobald Zahlungen live gehen**
- Belegt: `grep -c -i stripe seiten/datenschutz.html` = 0; der Entwurf `03-datenschutz-omoteno.md` enthält Stripe (Zeile 164),
  der AVV (Anlage 2) ebenfalls. Die Seite und der Entwurf sind auseinandergelaufen.
- Vorschlag: Beim Live-Gang der Zahlarten die Zeile in `seiten/datenschutz.html` ergänzen; Rolle von Stripe (Auftragsverarbeiter
  oder eigener Verantwortlicher) vom Anwalt festlegen lassen (steht als `{Anwalt: …}` im AVV).

**R8 · Kennzeichnung KI-bearbeiteter Gerichtfotos fehlt (T7)**
- Belegt: `grep -i 'KI-bearbeitet' vorlagen/hub.vorlage.html` leer. Das Profi-Foto setzt das Gericht in ein Studiofoto (fal.ai/Bria).
- Folge: Irreführung möglich (§ 2.7); die Kennzeichnung ist keine Pflicht für den Betrieb, aber eine sinnvolle Vorsicht.
- Vorschlag: kleine Marke „KI-bearbeitet" im Detailblatt (nicht in der Kachel), vom Betrieb nicht abschaltbar; AGB § 4: „Der Betrieb stellt
  sicher, dass ein Bild das Gericht nicht besser darstellt, als es serviert wird."

**R9 · Mehrweg (VerpackG) fehlt als Hinweis bei Lieferung/Abholung**
- Belegt: keine Fundstelle zu Mehrweg in Hub/Board/Landingpage. Die Pflicht trifft den Betrieb, nicht Omoteno; die Funktion „Lieferung/Abholen" macht den
  Betrieb aber zum Versender in Einwegverpackung.
- Vorschlag: Hinweiszeile im Board bei „Lieferung" und „Abholen": „Prüfen Sie Ihre Mehrwegangebotspflicht (§§ 33, 34 VerpackG): Ausnahme
  nur bis 5 Beschäftigte und 80 m²." Kein Hub-Code.

**R10 · KI im Produkt: Pflichten des Kunden stehen nicht in den AGB**
- Belegt: Der Entwurf `05-agb.md` kennt kein Kapitel zu KI-Funktionen (Übersetzer, Beleg-Lesen, Foto, Alessia).
- Vorschlag (für den Anwalt): Kunde prüft Übersetzungen, gelesene Rechnungen, Fotos und Allergenangaben vor Veröffentlichung; KI-Ergebnisse sind Vorschläge;
  Omoteno nennt die eingesetzten Unterauftragnehmer (AVV Anlage 2). Zusätzlich: Ausschluss der verschuldensunabhängigen Mängelhaftung
  nach § 536a BGB (typische SaaS-Klausel), Aktualisierungsklausel in § 12 (Zustimmung per Schweigen im B2B: anwaltlich prüfen).

### NIEDRIG / HINWEIS

**R11 · Entwicklungsnachweis und Lizenzvermerk** — kein Dokument beschreibt den menschlichen Anteil an der Entstehung; keine `LICENSE`/Urhebervermerk-Datei im Wurzelverzeichnis (`ls`).
Vorschlag: `dokumente/entwicklungsnachweis.md` (Konzeptentscheidungen, Prüfliste CLAUDE.md, Zahl der Prüfungen, Git-Verlauf), Copyright-Zeile „© Omoteno" ohne Schutzbehauptung,
Abhängigkeits-/Lizenzscan.

**R12 · Alessia** — Pflichtsatz und Aufnahme-aus sind im Erzeuger (`pruef-alessia.js`); offen ist die Handlung in Vapi (bestehende Assistenten neu einfügen, Tonaufnahme im Dashboard prüfen). Die Preisliste nennt Alessia „noch nicht buchbar" — dann darf sie auch nicht als lieferbar beworben werden (UWG); passt aktuell.

**R13 · BFSG** — keine Barrierefreiheitserklärung; Prüfung nach EN 301 549 fehlt (nur Maße und Kontraste gemessen). Entscheidung Anwalt (§ 2.9).

**R14 · Kasse/TSE** — offen beim Steuerberater (Frage 11 in `11-offene-angaben.md`); die Funktionen „Zahlung eingegangen", „Rabatt auf die Rechnung" und der CSV-Export liegen nahe an einer Kassenfunktion. Bis zur Antwort nichts versprechen (R5).

**R15 · ZAG / Stripe Connect** — offen beim Anwalt (Modell „Geld direkt auf das Konto des Betriebs").

**R16 · Versicherung und Notfall** — Berufshaftpflicht/IT-Haftpflicht mit Produkthaftung (§ 2.2) und Cyber-Deckung prüfen; Ablauf einer Datenpanne liegt vor (`13-datenpanne.md`).

## 4 · Was ich geprüft habe und in Ordnung fand

- Bestellknopf „Zahlungspflichtig bestellen", „inkl. MwSt.", Hinweis „kein Widerrufsrecht" — `pruef-preisangaben.js`.
- Gerätekennung erst nach „Einschalten" (§ 25 TDDDG) — `pruef-gastkonto.js`.
- Impressum/Datenschutz im Hub vorhanden und erreichbar (§ 5 DDG, Art. 13 DSGVO) — `pruef-rechtstexte.js`; **Angaben je Betrieb fehlen (R2)**.
- Alessia nennt sich KI, Aufnahme aus — `pruef-alessia.js`.
- Schriften selbst ausgeliefert, Lizenzen vermerkt — `pruef-schriften.js`, `pruef-lizenzen.py`.
- Keine Übermittlung an Google-Schriften, Bibliotheken mit `integrity` — `pruef-sicherheit.js`.
- OS-Plattform-Link fehlt richtig (seit 20.7.2025 abgeschaltet).
- Preise gegenüber Betrieben „zzgl. USt." — Landingpage, Preisfuß.

## 5 · Gespräch mit dem Anwalt: die Fragenliste

1. AGB/AVV (R1, R10): Tragen die Entwürfe? Haftungsgrenze, § 536a BGB, Änderungsklausel, Preisanpassung.
2. § 11 PAngV in der Gastronomie (R3): Gilt die Pflicht für Speisen? Reicht Variante A?
3. Allergenangaben (R4): Verbindlichkeit bei losen Speisen im Fernabsatz.
4. ZAG (R15) und Rolle von Stripe (R7).
5. Kasse/TSE zusammen mit dem Steuerberater (R14).
6. Urheberrecht/Due Diligence (R11): Wie stärke ich den Schutz trotz KI-Entstehung?
7. BFSG (R13) und CRA/Produkthaftung (§ 2.2).

## 6 · Fachanwälte und Stellen (Hessen)
Rechtsanwaltskammer (Kassel bzw. Frankfurt) für die Suche nach Fachanwälten für IT-Recht; IHK-Gründerberatung; HBDI für Datenschutzfragen
(Auskunft, nicht Rechtsberatung); Steuerberaterkammer Hessen. **[W]**
