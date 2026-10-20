# Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO)

zwischen dem Kunden (Betrieb) — **Verantwortlicher** — und
Elias Faber, Omoteno, Ringstraße 12, 35260 Stadtallendorf — **Auftragsverarbeiter**.

> Entwurf. Gegenstände und Datenarten aus dem Code gelesen (Hub-Vorlage,
> Migrationen, Edge Functions). Anwaltlich prüfen lassen; Anlage 3 (TOM)
> sind die tatsächlich gebauten Maßnahmen und müssen aktuell bleiben.

## § 1 Gegenstand und Dauer

(1) Omoteno verarbeitet personenbezogene Daten im Auftrag des Betriebs, um die
nach den AGB gebuchten Leistungen zu erbringen. Einzelheiten: Anlage 1.

(2) Der Vertrag läuft so lange wie der Hauptvertrag.

## § 2 Weisungen

(1) Omoteno verarbeitet die Daten nur auf dokumentierte Weisung des Betriebs —
die Einstellungen im Board gelten als solche Weisung —, es sei denn, Omoteno
ist gesetzlich zu einer Verarbeitung verpflichtet; dann teilt Omoteno das vorher
mit, soweit erlaubt.

(2) Hält Omoteno eine Weisung für rechtswidrig, weist Omoteno unverzüglich
darauf hin und darf sie bis zur Bestätigung aussetzen.

## § 3 Pflichten von Omoteno

(1) Vertraulichkeit: Wer bei Omoteno Zugang zu den Daten hat, ist zur
Vertraulichkeit verpflichtet.

(2) Sicherheit: Omoteno trifft die Maßnahmen nach Art. 32 DSGVO aus Anlage 3
und passt sie dem Stand der Technik an, ohne das Schutzniveau zu senken.

(3) Unterstützung: Omoteno unterstützt den Betrieb bei Anfragen Betroffener
(Auskunft, Löschung u. a.), bei Meldungen nach Art. 33, 34 DSGVO und bei einer
Datenschutz-Folgenabschätzung, soweit es die Verarbeitung durch Omoteno
betrifft. Anfragen, die bei Omoteno eingehen, leitet Omoteno weiter.

(4) Verletzungen: Omoteno meldet dem Betrieb eine Verletzung des Schutzes
personenbezogener Daten unverzüglich, spätestens binnen 24 Stunden nach
Kenntnis, mit den Angaben nach Art. 33 Abs. 3 DSGVO, soweit bekannt.

(5) Ort: Die Datenbank liegt im Rechenzentrum Frankfurt am Main. Eine
Übermittlung in Drittländer erfolgt nur bei Unterauftragnehmern aus
Anlage 2 und nur mit Garantien nach Art. 44 ff. DSGVO.

## § 4 Unterauftragsverarbeiter

(1) Der Betrieb genehmigt die Unterauftragsverarbeiter aus Anlage 2.

(2) Omoteno informiert den Betrieb mindestens vier Wochen vorher in Textform
über jeden neuen oder ersetzten Unterauftragsverarbeiter. Der Betrieb kann
aus wichtigem datenschutzrechtlichem Grund widersprechen; findet sich keine
Lösung, kann er die betroffene Funktion abbestellen oder den Vertrag
außerordentlich kündigen.

(3) Omoteno legt Unterauftragsverarbeitern Pflichten auf, die diesem Vertrag
entsprechen.

## § 5 Kontrollen

Omoteno stellt dem Betrieb alle Informationen bereit, die zum Nachweis der
Pflichten nötig sind, und ermöglicht Überprüfungen nach Absprache, in der
Regel durch Auskunft in Textform, bei begründetem Anlass vor Ort mit
angemessener Vorankündigung.

## § 6 Ende

Nach Vertragsende kann der Betrieb seine Daten 30 Tage lang ausführen. Danach
löscht Omoteno sie, einschließlich Kopien, spätestens nach weiteren 30 Tagen,
soweit keine Pflicht zur Aufbewahrung besteht. Sicherungskopien werden mit
ihrem regulären Umlauf überschrieben, {höchstens nach … Tagen — beim Supabase-
Tarif nachsehen}.

## § 7 Haftung

Es gilt Art. 82 DSGVO. Im Übrigen gelten die AGB.

---

## Anlage 1 · Art und Zweck, Daten, Betroffene, Fristen

| Funktion | Betroffene | Daten | Zweck | Löschung |
|---|---|---|---|---|
| Bestellung am Tisch | Gäste | Positionen, Tisch, Notiz, Zeit, Gerätekennung, Prüfwert der Herkunft | Bestellung annehmen, Küche, Abrechnung, Missbrauchsschutz | personenbezogene Felder nach 90 Tagen ¹ |
| Lieferung | Gäste | Name, Telefon, Anschrift, Positionen | Lieferung | nach 90 Tagen ¹ |
| Reservierung | Gäste | Name, Telefon, Personen, Wunsch, Termin | Reservierung | 30 Tage nach dem Termin ¹ |
| Serviceruf, Nachricht an den Gast | Gäste | Tisch, Grund, Text | Service | mit der Bestellung |
| „Mein Tisch", Gutscheine | Gäste | Gerätekennung, Besuche, Lieblingsgerichte, Gutscheine | Stammgast-Funktionen | 24 Monate nach letztem Besuch ¹ |
| Post vom Haus (Newsletter) | Gäste mit Einwilligung | E-Mail, Besuche, letzter Besuch, Lieblingsgericht, Bestellsumme und Gerichtnamen | E-Mails mit Gutscheinen über Klaviyo | bei Abmeldung; Profil bei Klaviyo nach Weisung |
| Telefon-Assistentin Alessia | Anrufer | Rufnummer, genannter Name, Abholzeit, Bestellung, Gesprächstranskript | Telefonbestellung | Transkript 30 Tage ¹ |
| Team, Protokoll, PIN | Mitarbeiter des Betriebs | E-Mail, Rolle, Rechte, Anmeldezeit, Änderungen mit Zeit und Person | Zugang, Nachvollziehbarkeit | {3 Jahre} ¹ |
| Einkauf | Lieferanten (bei Einzelunternehmern personenbezogen), Mitarbeiter | Rechnungen, Namen, Anschriften, Beträge, Buchungen | Kosten, Lager | 10 Jahre (§ 147 AO) |

¹ Frist greift erst nach Technik T5 automatisch. Bis dahin löscht Omoteno
auf Weisung.

Besondere Kategorien (Art. 9 DSGVO) werden nicht gezielt verarbeitet. Eine
Notiz eines Gastes kann Gesundheitsangaben enthalten („Nussallergie"); sie
wird nur für die Bestellung verwendet.

## Anlage 2 · Unterauftragsverarbeiter

| Anbieter | Leistung | Ort / Drittlandgarantie |
|---|---|---|
| Supabase, Inc. | Datenbank, Speicher, Anmeldung, Funktionen | Frankfurt; Zugriff aus USA möglich — {DPF/SCC} |
| Netlify, Inc. | Auslieferung, Protokolle | weltweit — {DPF/SCC} |
| Klaviyo, Inc. | E-Mail-Versand (nur bei gebuchtem Newsletter) | USA — {DPF/SCC} |
| Vapi, Inc. | Telefon-Assistentin (nur bei Buchung) | USA — {DPF/SCC} |
| Stripe Payments Europe, Ltd. | Online-Zahlung auf dem eigenen Stripe-Konto des Betriebs (nur wenn der Betrieb sie einschaltet). Stripe ist hier **eigener Verantwortlicher** für die Zahlungsabwicklung; Omoteno speichert nur Betrag, Zahlart, Status und die Kontonummer `acct_…`. **{Anwalt: Einordnung Auftragsverarbeiter / eigener Verantwortlicher prüfen}** | Irland — Übermittlung USA {DPF/SCC} |
| Features & Labels, Inc. (fal.ai) | Bildbearbeitung (nur auf Anforderung) | USA — {DPF/SCC} |
| Anthropic {Vertragspartner} | Übersetzung, Rechnungen auslesen | USA — {DPF/SCC} |

## Anlage 3 · Technische und organisatorische Maßnahmen (aus dem Bestand)

- **Zugang:** Anmeldung mit Passwort und PIN als zweitem Faktor; Sperre nach
  drei Fehlversuchen; Rollen Inhaber/Team mit getrennten Rechten; Master
  nur für Omoteno.
- **Zugriff in der Datenbank:** Zeilenregeln (RLS) je Betrieb; Schreiben für
  Gäste nur über geprüfte Funktionen, die Preise aus der Karte nachrechnen;
  Rechte der Rollen auf das Nötige gekürzt und mit zurückgedrehten
  Angriffsproben geprüft (`datenbank/pruef-rechte.sql`).
- **Übertragung:** nur HTTPS mit HSTS; Inhaltsrichtlinie (CSP) ohne fremde
  Skripte; Bibliotheken selbst ausgeliefert mit Integritätsprüfung.
- **Trennung:** Daten je Betrieb getrennt; Gerätekennung je Betrieb eine
  andere, kein betriebsübergreifendes Profil.
- **Datensparsamkeit:** keine IP-Adressen gespeichert, Missbrauchsschutz über
  täglich neu gesalzenen Prüfwert, Schlüssel nach zwei Tagen gelöscht.
- **Nachvollziehbarkeit:** Protokoll jeder Änderung an Preisen, Rabatten,
  Gutscheinen, Team und Lager mit Person und Zeit.
- **Verfügbarkeit:** Sicherungen des Anbieters {Tarif und Tage eintragen};
  Warteschlange im Gerät des Gastes bei kurzen Ausfällen.
- **Prüfung:** über 100 automatische Prüfungen vor jeder Auslieferung.
