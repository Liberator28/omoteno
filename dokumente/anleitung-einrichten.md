# Einrichten: Mailversand, Übersetzer, Foto-KI, Klaviyo

Stand 09.10.2026. Jeder Abschnitt beginnt mit dem, was **heute
gemessen** ist, dann die Schritte, dann woran du siehst, dass es
läuft. Alle vier hängen an Einstellungen, die nicht im Verzeichnis
stehen. Deshalb kann ich sie nicht für dich setzen, nur nachmessen.

Wo die Geheimnisse liegen (gilt für alle Abschnitte):
**supabase.com/dashboard → Projekt → Edge Functions → Secrets**.
Ein neuer oder geänderter Eintrag gilt ab dem nächsten Aufruf, neu
ausrollen musst du nichts. Ins Feld **Name** kommt der Name, ins Feld
**Value** der lange Schlüssel. Genau das war beim Übersetzer
vertauscht (siehe 2).

---

## 1 · Mailversand (SMTP) in Supabase

**Gemessen:** Die Anmelde-Protokolle der letzten 24 Stunden zeigen bei
3 von 6 Ereignissen noch `http://localhost:3000`, zuletzt am 08.10.
um 22:40 UTC. Die Site URL steht also noch auf der Vorgabe. Und ohne
eigenen Mailversand schickt Supabase nur an Adressen des eigenen Teams,
höchstens ein paar Mails pro Stunde.

**Wozu du es brauchst:** Passwort vergessen (Board, Konto, Zentrale),
Einladungen ans Team („Dein Team“ im Konto), Bestätigung neuer Konten.
Ohne SMTP zeigt „Dein Team“ den Einladungslink einmal an, und du gibst
ihn selbst weiter. Das funktioniert, ist aber Handarbeit.

**Schritte**

1. **Anbieter wählen**, zum Beispiel Brevo, Resend oder dein
   IONOS-Postfach. Für Transaktionsmails reicht jeweils der kleinste
   Tarif.
2. **Absender-Domain bestätigen** beim Anbieter (z. B. `omoteno.de`).
   Der Anbieter nennt dir DNS-Einträge (SPF, DKIM, oft DMARC). Die
   trägst du bei IONOS unter Domains → `omoteno.de` → DNS ein. Ohne
   diese Einträge landen die Mails im Spam.
3. **Zugangsdaten holen** im Konto des Anbieters: Host, Port,
   Benutzername, Passwort/SMTP-Schlüssel. Beispiele, bitte gegen das
   eigene Konto halten:
   - Resend: Host `smtp.resend.com`, Port `465`, Benutzer `resend`,
     Passwort = ein Resend-API-Schlüssel
   - Brevo: Host `smtp-relay.brevo.com`, Port `587`, Benutzer und
     Schlüssel aus „SMTP & API“
4. **Supabase → Authentication → Emails → SMTP Settings**:
   „Enable custom SMTP“ an, die Werte aus 3 eintragen. Absender z. B.
   `hallo@omoteno.de`, Name „omoteno“. Speichern.
5. **Supabase → Authentication → URL Configuration**:
   - Site URL: `https://omoteno.de`
   - Redirect URLs: `https://omoteno.de/**` und für jeden Hub mit
     eigener Adresse dessen Adresse mit `/**`.
6. **Rate Limits** (Authentication → Rate Limits): Die Grenze für
   E-Mails steigt erst mit eigenem SMTP. Auf 30 je Stunde stellen,
   das reicht für Einladungen und Passwort-Resets.
7. Optional die Texte unter **Authentication → Emails → Templates**
   (Invite, Reset Password) auf Deutsch stellen.

**Woran du siehst, dass es läuft:** Im Board „Passwort vergessen?“
mit einer Adresse außerhalb deines Teams. Die Mail kommt an, und der
Link führt auf `omoteno.de` (nicht `localhost`) und dort ins Formular
„Neues Passwort“. Im Konto unter „Dein Team“ jemanden einladen: Die
Seite zeigt keinen Link mehr an, sondern „Einladung an … ist unterwegs“.

---

## 2 · Übersetzer (Anthropic)

**Gemessen heute (09.10., Diagnose der Funktion, kostenlos):**
`{"art":"zu_kurz","laenge":17}`. Unter `ANTHROPIC_API_KEY` stehen
17 Zeichen. `ANTHROPIC_API_KEY` hat genau 17 Zeichen, im Feld
**Value** steht also der **Name** statt des Schlüssels. Ein echter
Schlüssel hat über 100 Zeichen und beginnt mit `sk-ant-api03-`.
Seit dem 26.09. unverändert, der Übersetzer hat also noch nie
übersetzt.

**Schritte**

1. **console.anthropic.com** → Billing: Guthaben aufladen (5 € reichen
   für viele Karten). Ein Abo auf claude.ai zählt hier **nicht**, das
   ist ein anderes Konto.
2. **console.anthropic.com → Settings → Limits**: ein Monatslimit
   setzen, z. B. 20 €. Damit ist die Rechnung gedeckelt, auch wenn
   etwas schiefläuft.
3. **API Keys → Create Key**, Name „omoteno-uebersetzer“. Den
   Schlüssel **sofort** kopieren, er wird nur einmal gezeigt.
4. **Supabase → Edge Functions → Secrets** → `ANTHROPIC_API_KEY`
   bearbeiten. **Value** = der Schlüssel aus 3. Save.
5. Board neu laden (Strg+Umschalt+R), ein Gericht öffnen, die
   Beschreibung minimal ändern, **Sichern**.

**Woran du siehst, dass es läuft:** Die Sprachfelder füllen sich nach
ein paar Sekunden. Oder du sagst mir Bescheid, dann frage ich die
Diagnose ab; dort muss `"art":"ok","anthropic":"ok"` stehen.

**Schutz, der schon steht:** Übersetzen darf nur, wer im Board
angemeldet ist (mit PIN). Je Betrieb gibt es ein Tageskontingent
(400 Texte; ein neu registrierter Betrieb ohne Tarif in der ersten Woche 60), und alles darüber bekommt einen Satz statt einer Rechnung.
Ein Gericht in elf Sprachen kostet rund einen halben bis einen Cent.

Fehlerbilder und ihre Bedeutung: `dokumente/anleitung-uebersetzer.md`.

---

## 3 · Foto-KI (fal.ai): Profi-Foto und Freisteller

**Gemessen:** In `bild_auftraege` steht **kein einziger Auftrag**.
Die Funktion `gericht-bild` ist also noch nie bis zu fal gekommen. Ob
`FAL_KEY` gesetzt ist, verrät die Funktion ohne Anmeldung nicht (mit
Absicht). Kein Betrieb hat einen Tarif eingetragen (`plan` leer), und
leer gilt als „darf“.

**Schritte**

1. **fal.ai** → Konto anlegen → **Billing**: Guthaben aufladen und ein
   Limit setzen.
2. **Dashboard → Keys → Add key**, Rechte „API“. Den Schlüssel
   kopieren (Form `xxxxxxxx-…:yyyyyyyy…`, mit Doppelpunkt, **beide**
   Hälften).
3. **Supabase → Edge Functions → Secrets** → neuer Eintrag
   **Name** `FAL_KEY`, **Value** = der Schlüssel. Save.
4. Board → Speisekarte → ein Gericht mit **eigenem Foto** öffnen →
   „Profi-Foto“. Das Board zeigt das Ergebnis erst als Vorschlag.
   Übernommen wird nur, was du einzeln bestätigst, und gespeichert erst
   mit „Sichern“.

**Woran du siehst, dass es läuft:** Nach etwa 10 bis 30 Sekunden
erscheinen Studiofoto und Freisteller zur Auswahl. Meldet das Board
„Der Bilddienst ist noch nicht verbunden“, fehlt `FAL_KEY` oder steht falsch.

**Deckel:** 200 Aufträge je Betrieb und Monat (in der Funktion
gezählt, **bevor** fal gefragt wird). Ein Auftrag sind zwei
fal-Aufrufe (Freisteller + Studiofoto).

**Ehrliche Grenze:** Die Funktion ist nie gegen die echte fal-API
gelaufen (diese Arbeitsumgebung erreicht fal nicht). Der erste echte
Lauf ist deiner. Geht etwas schief, bleibt das Originalfoto, und das
Board sagt, was fehlt.

---

## 4 · Klaviyo: Gutschein-Mails und Rückholung nach 20 Tagen

**Gemessen:**
- `KLAVIYO_API_KEY` **fehlt** in Supabase. Beide Melde-Funktionen
  antworten `kein_schluessel`, Klaviyo hat also noch keinen Besuch,
  keine Bestellung und keine Adresse bekommen.
- Die Kette Datenbank → Funktion steht und ist gemessen: mit dem
  echten Geheimnis `200`, ohne `401`. Das Geheimnis liegt im Vault der
  Datenbank. `OMOTENO_TRIGGER_SECRET` als Edge-Secret brauchst du
  **nicht** mehr, ein alter Eintrag darf stehen bleiben oder weg.
- In Klaviyo stehen je Betrieb zwei Vorlagen und zwei Abläufe, alle
  als **Entwurf** (Liste in `dokumente/klaviyo-flows-einrichten.md`).
- Gutschein-Codes bei Klaviyo: **0**. Bei Chocolamour stehen 20 Codes
  in Supabase, die Klaviyo nie erreicht haben (siehe dort).

**Schritte, in dieser Reihenfolge**

1. **Klaviyo → Settings → API Keys → Create Private API Key**, Name
   „omoteno“. Rechte: **Profiles**, **Lists**, **Subscriptions**,
   **Events**, **Coupons** jeweils *Full*; **Flows** *Read*. Wenn
   Klaviyo einen Bereich anders benennt oder dir die Auswahl zu
   kleinteilig ist: *Full Access*. Den Schlüssel kopieren (beginnt mit
   `pk_`).
2. **Supabase → Edge Functions → Secrets** → **Name**
   `KLAVIYO_API_KEY`, **Value** = `pk_…`. Save.
3. **Board → Einstellungen → Gäste-Newsletter**, als Besitzer:
   - „Newsletter aktiv“ an
   - „20 neue Codes anlegen“ (bis zu 4× am Tag). Ohne Schlüssel aus
     Schritt 2 legt der Knopf absichtlich nichts an und sagt das.
   - darunter „Gäste & Newsletter“: Dort muss jetzt bei Klaviyo eine
     Zahl größer 0 stehen, und je Ablauf „Entwurf“.
4. **Absender:** Klaviyo → Settings → **Domains**: deine Domain
   bestätigen (wieder DNS-Einträge bei IONOS). In jedem Ablauf in der
   E-Mail **Sender name** auf den Namen des Hauses stellen, sonst
   steht „Omoteno“ als Absender.
5. **Testen:** Im Hub des Betriebs unter „Mein Tisch“ deine eigene
   Adresse hinterlegen, die Bestätigungsmail anklicken. In Klaviyo im
   Ablauf „Willkommen – …“ auf die Mail → **Preview** → dein Profil
   wählen. Dort muss ein **echter Code** stehen. Steht dort keiner,
   ist der Vorrat leer (Schritt 3).
6. **Live schalten:** im Ablauf oben rechts **Draft → Live**, und die
   Mail-Aktion im Ablauf ebenfalls auf **Live**. Erst ab hier gehen
   Mails hinaus. Die Übersicht im Board zeigt dann „Live“.

**Wie die Rückholung funktioniert:** Bei jedem Besuch und jeder
Bestellung setzt die Datenbank am Klaviyo-Profil
`omoteno_<betrieb>_letzter_besuch`. Der Ablauf „Rückholung 20 Tage“
wartet 20 Tage nach diesem Datum. Kommt der Gast vorher wieder,
verschiebt sich das Datum, und die Mail entfällt. Ein Filter an jedem
Schritt prüft zusätzlich: in der Liste und letzter Besuch mindestens
20 Tage her.

**Wo der Besitzer den Stand sieht:** Board → Einstellungen →
Gäste-Newsletter → „Gäste & Newsletter“ (nur Besitzer, das Team sieht
einen Satz). Gezeigt werden: Gäste mit Adresse, wer in 20 Tagen da
war, wer „vermisst“ wird, Bestellungen mit Code in 30 Tagen, der Stand
je Ablauf mit Link in Klaviyo und die freien Codes bei Klaviyo.
Versand- und Öffnungszahlen zeigt Klaviyo selbst (der Link führt hin).

---

## Was ich nicht prüfen konnte

- Ob Mails wirklich ankommen (SMTP, Klaviyo): Das zeigt nur ein echter
  Versand an eine echte Adresse.
- Den Inhaber-Weg durch `newsletter-uebersicht` mit echtem Token. Der
  Weg für Fremde ist gemessen (`kein_zugriff`), der Weg für den
  Besitzer nur mit gestellter Antwort im Board.
- Den Datumsauslöser in Klaviyo in Aktion: Er feuert erst 20 Tage nach
  einem echten Besuch.
- Die Datenschutz-Texte (Hub-Satz am E-Mail-Feld, `datenschutz.html`)
  sind nach bestem Wissen formuliert. Ich bin kein Anwalt; lass sie
  bitte gegenlesen, bevor die Abläufe live gehen.
