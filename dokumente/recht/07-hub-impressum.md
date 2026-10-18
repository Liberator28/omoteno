# Vorlage · Impressum im Gästehub

Wird im Hub unter `#/impressum` gezeichnet (Technik T1). Werte aus dem
Markenblatt (`betrieb.*`, neu `recht.*`). Zeilen mit leerem Feld entfallen —
außer Pflichtfeldern: Fehlt eines, meldet der Erzeuger „fehlt noch".

Sprache: Deutsch, Anrede „Sie" wie im Hub.

---

**Impressum**

Angaben nach § 5 DDG

{recht.firma}                                   ← Pflicht; bei Einzelunternehmen Vor- und Nachname, ggf. mit Geschäftsbezeichnung „{betrieb.name}"
{recht.rechtsform}                              ← Pflicht bei GmbH, UG, GbR, OHG, KG, e. K.
{betrieb.strasse}
{betrieb.ort}                                   ← ladungsfähige Anschrift, kein Postfach

Vertreten durch: {recht.vertreten}              ← Pflicht bei Gesellschaften (Geschäftsführer, Gesellschafter)

Telefon: {betrieb.telefon}
E-Mail: {betrieb.mail}                          ← beide Pflicht

Registereintrag: {recht.register}               ← z. B. „Amtsgericht Marburg, HRB 1234" — Pflicht, wenn eingetragen
Umsatzsteuer-Identifikationsnummer: {recht.ustid}   ← Pflicht, wenn vorhanden
Wirtschafts-Identifikationsnummer: {recht.wid}      ← Pflicht, wenn vorhanden

Zuständige Aufsichtsbehörde: {recht.aufsicht}   ← nur bei erlaubnispflichtiger Tätigkeit; für Gaststätten mit Alkoholausschank i. d. R. nicht nötig (Gaststättenerlaubnis ist keine „Zulassung" im Sinne von § 5 Abs. 1 Nr. 3 DDG) — anwaltlich bestätigen lassen

**Verbraucherstreitbeilegung**
Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren
vor einer Verbraucherschlichtungsstelle teilzunehmen.
← Pflicht nur für Betriebe mit mehr als zehn Beschäftigten (§ 36 VSBG); der
  Satz schadet aber keinem.

**Technik**
Diese Speisekarte läuft mit Omoteno (Elias Faber, Stadtallendorf). Für Inhalt,
Preise und Angaben zu Allergenen ist {betrieb.name} verantwortlich.

---

## Felder für das Markenblatt (`recht`)

| Feld | Pflicht | Beispiel |
|---|---|---|
| `firma` | immer | „Più Gusto Pizzeria GmbH" / „Maria Rossi" |
| `rechtsform` | bei Gesellschaft | „GmbH" |
| `vertreten` | bei Gesellschaft | „Geschäftsführer Marco Rossi" |
| `register` | wenn eingetragen | „Amtsgericht Marburg, HRB 7654" |
| `ustid` | wenn vorhanden | „DE123456789" |
| `wid` | wenn vorhanden | „DE123456789-00001" |
| `aufsicht` | nur bei Zulassungspflicht | — |

Erzeuger: `firma` fehlt → „fehlt noch: Impressum (Name/Firma)". `rechtsform`
enthält GmbH/UG/AG/KG/OHG/GbR und `vertreten` fehlt → „fehlt noch".
