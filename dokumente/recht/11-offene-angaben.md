# Offene Angaben und Entscheidungen

Was ich nicht aus dem Code lesen kann. Ohne diese Punkte bleiben die Texte
Entwürfe mit `{Platzhaltern}`.

## Entscheidungen

**A · Gerätekennung im Hub (Befund 2) — entschieden 18.10.:** der
sauberste Weg. Bestellung und Missbrauchsschutz mit einer Kennung nur für
den Tab; dauerhafte Kennung, Besuchszählung und Lieblinge erst, wenn der Gast
„Mein Tisch" ausdrücklich einschaltet (§ 25 Abs. 2 Nr. 2 TDDDG: ausdrücklich
gewünschter Dienst). Kein Banner. Umgesetzt, `pruef-gastkonto.js`.

**B · Bestellknopf (Befund 3) — entschieden 18.10.:** „Zahlungspflichtig
bestellen" in allen Sprachen. Ein Bestätigungsblatt für „Sofort bestellen"
entfällt: Der Knopf bestellt gar nicht, er legt nur in den Warenkorb
(meine erste Analyse war hier falsch); nur seine Beschriftung wird ehrlich.

**C · Löschfristen — entschieden 18.10.:** der Vorschlag gilt. (Fristen: Bestellungen 90 Tage, Transkripte 30 Tage, Reservierungen 30 Tage
nach Termin, Gäste 24 Monate, Protokoll 3 Jahre.)

**D · Rechtstexte übersetzen?** Vorschlag: Impressum und Datenschutz im Hub
nur auf Deutsch, Überschriften übersetzt. Übersetzen kostet nichts, aber jede
Fassung muss stimmen.

## Angaben zu Omoteno

1. Kleinunternehmer nach § 19 UStG — ja oder nein? (Landingpage sagt
   „zzgl. USt.")
2. USt-IdNr. inzwischen erteilt?
3. Kündigungsfrist: „monatlich kündbar" — zum Monatsende mit welcher Frist?
4. Zahlungsweg: Rechnung oder SEPA-Lastschrift?
5. Testphase: wie lange? (Più Gusto hat 30 Tage in der Datenbank.)
6. Vertragspartner bei Anthropic (US-Gesellschaft oder irische) — steht im
   Kundenkonto der Console.
7. Für jeden US-Anbieter: DPF-zertifiziert oder Standardvertragsklauseln?
   (dataprivacyframework.gov/list) und ist der DPA des Anbieters akzeptiert
   und abgelegt? Supabase, Netlify, Klaviyo, Vapi, fal.ai, Anthropic.
8. Netlify: wie lange bleiben die Server-Protokolle? (Die 30 Tage in der
   alten Erklärung sind nicht belegt.)
9. Supabase-Tarif: wie lange gibt es Sicherungen (für AVV § 6)?
10. Vapi: ist im Assistenten die Tonaufnahme an? (Dashboard → Assistant →
    Artifact Plan; ohne eigene Einstellung gilt die Vorgabe von Vapi.)
11. Steuerberater: Bestellsystem und Kassensicherungsverordnung (Befund 7).

## Angaben je Betrieb (für das Impressum im Hub)

Für **Choco L'AMouR**, **Blend**, **Minhkeey**, **Più Gusto** und jeden
weiteren: Firma bzw. Inhaber, Rechtsform, Vertretungsberechtigte,
Registergericht und -nummer, USt-IdNr., Anschrift (bei Più Gusto fehlt sie
noch), Telefon, E-Mail. Am einfachsten über das Konto-Formular einsammeln.

Und von jedem Betrieb: unterschriebener bzw. angeklickter AVV (T10).
