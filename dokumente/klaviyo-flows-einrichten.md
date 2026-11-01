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
2. **Vorrat füllen:** im Board als Inhaber „20 neue Codes anlegen“
   (Einstellungen → Gäste-Newsletter; bis zu 4× am Tag je Betrieb).
   Heute liegen **0 Codes** bei Klaviyo, in allen drei Vorräten. Ist
   der Vorrat leer, verschickt Klaviyo die Mail nicht. Erst NACH
   Schritt 1 drücken — ohne Schlüssel legt die Funktion jetzt
   absichtlich nichts an.
   *Befund dazu:* Bei Chocolamour stehen 20 Codes in Supabase, die
   Klaviyo nie erreicht haben (angelegt ohne Schlüssel, damals als
   Erfolg gemeldet). Sie verschickt niemand; sie laufen am 28.12. ab.
   Die Übersicht zeigt deshalb bis dahin „20 in omoteno, 0 bei
   Klaviyo“ — nach dem Auffüllen 40 zu 20.
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

## Wo du (und jeder Besitzer) den Stand siehst

Board → Einstellungen → **Gäste-Newsletter** → „Gäste & Newsletter“,
nur für den Besitzer: Gäste mit Adresse, wer in 20 Tagen da war, wer
„vermisst“ wird, Bestellungen mit Code in 30 Tagen; darunter je Ablauf
der Stand aus Klaviyo (Entwurf / Live) mit Link in Klaviyo, und wie
viele Codes Klaviyo noch zum Verschicken hat. Fehlt der Schlüssel,
steht dort genau das. Versand- und Öffnungszahlen zeigt Klaviyo selbst
(der Link führt hin).

## Was nicht beweisbar war

Ein echter Versand, der Datumsauslöser in Aktion und die Zustellung
selbst lassen sich ohne Live-Schaltung nicht prüfen. Die Naht
Datenbank → Edge Function ist gemessen (200 mit dem echten Geheimnis,
401 ohne), die Naht Edge Function → Klaviyo erst, sobald der Schlüssel
gesetzt ist.

## Aussehen der Mails wählen (seit 01.11.)

Im Board unter **Einstellungen → Gäste-Newsletter → Aussehen der Mails**
wählt der Inhaber eine von vier Fassungen. Für jede gibt es beide Mails
(„Willkommen“ und „Wir vermissen Sie“) in einer Vorschau:

| Variante | Aufbau | Vorbild (nur Aufbau und Wirkung, keine Marke, kein Bild) |
|---|---|---|
| **Klassisch** | die bisherige Mail, Zeichen für Zeichen | — (Vorgabe, nichts ändert sich ohne Wahl) |
| **Kampagne** | Angebot als Kopf auf der Bandfarbe, ein kräftiger Knopf, „Beliebt bei uns“ mit Foto und Preis, Code als Ticket | Angebotsmails großer Burger-Ketten: Angebot und Preis auf dem ersten Bildschirm, große Produktbilder, kurze beschriftete Blöcke |
| **Persönlich** | Anrede mit Vornamen, Gutschein als Karte mit Bedingungen, drei Schritte „So lösen Sie ihn ein“, Liste „Unsere Favoriten“ | Lieferdienst-Gutscheine: €-Wert, Bedingung, Schritte, Favoritenliste |
| **Edel** | Serifenschrift, ein Foto, viel Weißraum, wenig Text | für Häuser, denen die anderen zu laut sind |

Farben kommen aus dem Markenblatt bzw. den im Board gewählten Farben;
jede Schrift auf Farbe wird gerechnet (≥ 4,5:1). Gerichte: zuerst die als
„Beliebt“ markierten, dann die mit Foto, höchstens drei; Fotos nur über
https. Die Klaviyo-Tags (Code, Abmeldelink, Lieblingsgericht) stehen in
jeder Variante.

**„Übernehmen“** speichert die Wahl in `hub_stil.newsletter.variante` und
ruft danach die Edge Function `newsletter-vorlage-setzen`. Sie prüft den
Inhaber, liest die Vorlagen-IDs aus `klaviyo_flows` und ersetzt die beiden
Vorlagen in Klaviyo (`PATCH /api/templates/<id>/`) — nur, wenn jede Mail
das Code-Tag des EIGENEN Hauses und den Abmeldelink trägt, kein Skript
enthält und unter 100 KB bleibt.

**Stand 01.11. — noch zu tun:**

1. `supabase/functions/newsletter-vorlage-setzen` ausrollen (in dieser
   Sitzung war Supabase nicht erreichbar). Bis dahin sagt das Board:
   „gespeichert … mit ‚HTML kopieren‘ können Sie die Vorlage selbst in
   Klaviyo einfügen.“
2. Nach dem ersten echten Aufruf in Klaviyo nachsehen, ob die **Mail im
   Ablauf** gewechselt hat. Klaviyo legt beim Anlegen eines Ablaufs eine
   Kopie der Vorlage an; ob das Ersetzen der Vorlage diese Kopie erreicht,
   ist nicht gemessen. Falls nicht: die Vorlage im Ablauf neu auswählen
   oder „HTML kopieren“ nehmen.
3. Von Hand erzeugen geht weiter: `node erzeuger/erzeuge-newsletter-vorlage.js
   <slug> --variante kampagne` (Dateien je Variante und Art).

Eine Skizze aller Varianten liegt unter `dokumente/newsletter/`.
