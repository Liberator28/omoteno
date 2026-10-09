# Klaviyo · Was steht, und was du noch tun musst

Stand 09.10. Alles unten ist **angelegt und zurückgelesen** — und zwar
ausschließlich als **Entwurf**. Bis du in Klaviyo selbst auf „Live“
stellst, geht keine einzige Mail hinaus.

## Was im Konto steht

| Betrieb | Liste | Willkommen (Flow · Vorlage) | Rückholung 20 Tage (Flow · Vorlage) | Gutschein-Vorrat |
|---|---|---|---|---|
| Chocolamour | `UvPrnH` | `Vw3752` · `RjSG5g` | `X7LHLy` · `X8LYv4` | `chocolamour_newsletter` |
| Blend | `RvXGPR` | `Xrtf6j` · `RGZXDH` | `VY9CZL` · `XLr2Qq` | `blend_newsletter` |
| Minhkeey | `V2cdvr` | `Wyyrrw` · `Xy4a6Z` | `TFWdqV` · `T4NqNQ` | `minhkeey_newsletter` |

Dieselben IDs stehen in der Tabelle `klaviyo_flows`
(`datenbank/daten-klaviyo-flows.sql`), damit das Board sie zeigen kann.

**Willkommen:** Gast trägt sich im Hub ein → bestätigt die
Double-Opt-in-Mail → landet in der Liste → bekommt sofort die Mail
„Ein kleiner Gutschein für Sie“ mit einem Code aus dem Vorrat.

**Rückholung:** Bei jedem Besuch und jeder Bestellung setzt die
Datenbank am Klaviyo-Profil `omoteno_<slug>_letzter_besuch`
(`migration-klaviyo-besuch.sql`). Der Flow hängt an diesem Datum,
wartet 20 Tage und schickt dann „Wir vermissen Sie“ — mit dem
Lieblingsgericht, falls bekannt, und einem Code. An **jedem** Schritt
gilt ein Filter: in der Liste **und** letzter Besuch mindestens 20 Tage
her. Wer zwischendurch wiederkommt, bekommt also nichts.

## Wie der Code in die Mail kommt

In den Vorlagen steht `{% coupon_code '<slug>_newsletter' %}`. Das zieht
beim Versand einen freien Code aus dem Vorrat des Betriebs. Ein
Editor-Baustein von Hand ist dafür nicht nötig (die frühere Fassung
dieser Datei hat das behauptet).

Gemessen mit Klaviyos Render-Werkzeug: Lieblingsgericht erscheint mit
Wert und fällt ohne Wert ganz weg; der Abmeldelink wird gesetzt. Das
Coupon-Tag verlangt beim Rendern ein echtes Profil — einen echten Code
siehst du deshalb erst in der Vorschau mit einem Testprofil.

## Bevor du live schaltest — in dieser Reihenfolge

1. **`KLAVIYO_API_KEY` in Supabase setzen** (Edge Functions → Secrets).
   Gemessen am 09.10.: fehlt. Ohne ihn erreicht Klaviyo kein Besuch,
   keine Bestellung, keine Adresse.
2. **Vorrat füllen:** im Board als Inhaber „Vorrat auffüllen“ (je
   Betrieb, bis 50 Codes je Druck). Heute liegen **0 Codes** in allen
   drei Vorräten. Ist der Vorrat leer, verschickt Klaviyo die Mail
   nicht.
3. **Absender prüfen:** Die Flows nehmen die Vorgabe des Kontos
   („Omoteno“, `hallo@omoteno.de`). Wenn der Gast den Namen des Hauses
   sehen soll: im Flow je Mail „Sender name“ ändern; die Domain muss in
   Klaviyo bestätigt sein (Settings → Domains).
4. **Testprofil:** dich selbst in die Liste eines Betriebs eintragen
   (über den Hub, nicht von Hand — dann läuft der ganze Weg),
   Bestätigungslink klicken, im Flow unter „Preview“ die Mail mit
   deinem Profil ansehen — dort muss ein echter Code stehen.
5. **Live:** im Flow oben rechts „Draft“ → „Live“, und die Mail-Aktion
   ebenfalls auf „Live“.

## Was nicht beweisbar war

Ein echter Versand, der Datumsauslöser in Aktion und die Zustellung
selbst lassen sich ohne Live-Schaltung nicht prüfen. Die Naht
Datenbank → Edge Function ist gemessen (200 mit dem echten Geheimnis,
401 ohne), die Naht Edge Function → Klaviyo erst, sobald der Schlüssel
gesetzt ist.
