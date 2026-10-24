# Übersetzer einrichten — von null bis „läuft“

Stand 24.10.2026. Gilt für die Edge Function `uebersetzen` (Gericht-Texte und „Texte & Schrift“ im Board
in elf Sprachen). Die Fehlersuche vom 25./26.09. steht weiter in `anleitung-uebersetzer.md`; **diese**
Datei ist der Weg von einem frischen Projekt zum ersten erfolgreichen Lauf — in der Reihenfolge, in der
es geschehen muss. Keine Geheimnisse stehen hier; Schlüssel kommen aus deiner Anthropic-Konsole.

> **Ehrliche Grenze.** Die Funktion ist nie gegen die echte Anthropic-API gelaufen (die Arbeitsumgebung
> hat keinen Schlüssel). Die Form der Aufrufe folgt der SDK-Dokumentation und ist gegen eine
> nachgestellte Gegenstelle geprüft (`pruefungen/pruef-ki-nutzung-edge.js`). Der erste echte Lauf ist
> deiner — genau dafür ist Schritt 7.

---

## Überblick in sechs Zeilen

| Schritt | Wo | Dauer |
|---|---|---|
| 1 Anthropic-Konto, Schlüssel, Guthaben, Ausgabegrenze | console.anthropic.com | 10 min |
| 2 Datenbank vorbereiten (drei Migrationen, nur was fehlt) | Supabase → SQL Editor | 10 min |
| 3 Geheimnisse setzen | Supabase → Edge Functions → Secrets | 3 min |
| 4 Funktion ausrollen | Supabase CLI oder Dashboard | 5 min |
| 5 Diagnose ohne Anmeldung | Terminal | 1 min |
| 6 Der erste echte Lauf im Board | `omoteno.de/admin` | 5 min |
| 7 Modell wählen, Kosten ansehen | Master-Board → KI-Nutzung | laufend |

---

## 1 · Anthropic: Schlüssel, Guthaben, Ausgabegrenze

1. **console.anthropic.com** → anmelden (ein eigenes Konto; ein Abo auf claude.ai zählt für die API
   **nicht** — zwei getrennte Welten, auch wenn beide „Claude“ heißen).
2. **Billing** → Guthaben aufladen (ab ca. 5 €; die Karte eines ganzen Hauses kostet je nach Modell
   Cent bis wenige Euro, siehe Schritt 7).
3. **Billing → Limits**: eine **monatliche Ausgabegrenze** setzen (z. B. 30 €). Das ist die Notbremse
   ganz außen — unabhängig von allem, was Omoteno selbst zählt.
4. **API Keys → Create Key**, Name z. B. `omoteno-uebersetzer`. Den Schlüssel **sofort** kopieren
   (beginnt mit `sk-ant-api03-`, über 100 Zeichen); er wird nur einmal angezeigt.

## 2 · Datenbank: nur einspielen, was fehlt

Im **SQL Editor** zuerst die drei Prüfungen (sie lesen nur):

```sql
-- a) Spalten für die Übersetzungen
select column_name from information_schema.columns
 where table_schema='public' and table_name='gerichte' and column_name='uebersetzungen';
select column_name from information_schema.columns
 where table_schema='public' and table_name='betriebe' and column_name='hub_woerter';

-- b) Tageskontingent: welche Fassung gibt es? (genau EINE Zeile erwartet)
select p.proname, pg_get_function_identity_arguments(p.oid)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='ki_kontingent_nehmen';

-- c) KI-Nutzung (Logbuch, Budget, Preise)
select to_regclass('public.ki_nutzung') as nutzung, to_regclass('public.ki_preise') as preise;
```

| Ergebnis | Tun |
|---|---|
| a) eine Spalte fehlt | `datenbank/migration-uebersetzungen.sql` in einem Rutsch ausführen |
| b) keine Zeile | `datenbank/migration-ki-kontingent.sql` ausführen |
| b) **eine** Zeile `p_anzahl integer, p_betrieb uuid` | schon die neue Fassung — **nichts** tun (die alte Datei würde nur wieder eine zweite Fassung anlegen, CLAUDE.md §2.1) |
| b) zwei Zeilen | stopp: die alte (`p_anzahl integer`) mit vollständiger Signatur löschen, erst dann weiter |
| c) beides `null` | `datenbank/migration-ki-nutzung.sql` ausführen (Logbuch, Budget, Preistabelle; **optional** — ohne sie läuft der Übersetzer wie bisher, nur ohne Kostenzählung) |

Nach jeder Migration: Prüfung b) noch einmal (nie mehr als eine Zeile), und die Probe der jeweiligen
Datei (am Dateikopf beschrieben) in einer **zurückgedrehten** Transaktion. Ein „Success“ des
SQL-Editors sagt nichts darüber, ob eine Funktion läuft (CLAUDE.md §2.2).

## 3 · Geheimnisse (Secrets)

Supabase → **Edge Functions → Secrets** (oder CLI). Genau diese Namen:

| Name | Wert | Pflicht |
|---|---|---|
| `ANTHROPIC_API_KEY` | der Schlüssel aus Schritt 1 — **der lange Wert**, nicht der Name | ja |
| `UEBERSETZER_MODELL` | siehe Schritt 7; leer lassen = `claude-opus-5` wie bisher | nein |

```bash
supabase secrets set ANTHROPIC_API_KEY='sk-ant-api03-…' --project-ref quxwweuvdqtjsdwgjdrh
```

Typische Fehlgriffe (alle schon einmal passiert): der **Name** statt des Schlüssels im Feld „Value“;
Anführungszeichen oder „Bearer “ davor (die Funktion schneidet beides ab); ein Abo-Token (`sk-ant-oat…`);
ein Admin-Schlüssel (`sk-ant-admin…`, kann nicht übersetzen). Neue Geheimnisse gelten ab dem nächsten
Aufruf — ein neues Ausrollen ist dafür nicht nötig.

## 4 · Funktion ausrollen

```bash
supabase functions deploy uebersetzen --project-ref quxwweuvdqtjsdwgjdrh
```

**Ohne** `--no-verify-jwt`, und das ist Absicht: Die Funktion wird nur aus dem Board gerufen, wo immer
jemand angemeldet ist; ohne Prüfung könnte jeder Fremde dein Guthaben verbrauchen. Im Dashboard unter
Edge Functions → `uebersetzen` muss „Verify JWT“ **an** sein.

Gleichzeitig sollten `beleg-lesen` und `gericht-bild` auf den Stand mit Kostenzählung
(`supabase functions deploy beleg-lesen` / `gericht-bild`) — sie buchen dann ihren Verbrauch ins Logbuch.
Reihenfolge: **erst Migration (Schritt 2), dann Funktionen.** Umgekehrt läuft alles trotzdem
(die Buchung scheitert leise → die Antwort meldet `gebucht:false`), aber es wird nichts gezählt.

## 5 · Diagnose ohne Anmeldung (kostenlos)

Die Funktion beantwortet `{"diagnose":true}` ohne Board-Login. Sie nennt nur Art und Länge des
Schlüssels und ob Anthropic ihn annimmt — nie ein Zeichen daraus. Den öffentlichen `anon`-Schlüssel
findest du im Quelltext jedes Hubs (Block `SERVER`, Feld `schluessel`), er darf öffentlich sein:

```bash
curl -s -X POST 'https://quxwweuvdqtjsdwgjdrh.supabase.co/functions/v1/uebersetzen' \
  -H 'Content-Type: application/json' -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -d '{"diagnose":true}'
```

Erwartet: `{"diagnose":true,"art":"ok","laenge":1xx,"andere_namen":[],"anthropic":"ok"}`.

| `art` / `anthropic` | heißt | tun |
|---|---|---|
| `ok` + `ok` | läuft | weiter zu Schritt 6 |
| `ok` + `schluessel_ungueltig` | Form stimmt, Anthropic lehnt ab | neuen Schlüssel anlegen (Schritt 1.4, 3) |
| `ok` + `guthaben_leer` | Konsole ohne Guthaben | Schritt 1.2 |
| `leer` | nichts eingetragen | Schritt 3 |
| `zu_kurz`, `name_statt_wert` | der Name steht im Wert-Feld | Schritt 3, den langen Schlüssel einfügen |
| `abo_token`, `admin_schluessel`, `anderer_anbieter`, `kennung_statt_schluessel`, `adresse`, `unbekannt` | falscher Wert | wie `zu_kurz` — ein normaler API-Schlüssel aus der Konsole |

## 6 · Der erste echte Lauf im Board

1. `omoteno.de/admin` → anmelden (PIN). Board einmal **hart neu laden** (Strg+Umschalt+R; am iPhone den
   Tab schließen und neu öffnen), damit kein alter Stand im Zwischenspeicher hängt.
2. **Speisekarte** → ein Gericht öffnen → Beschreibung minimal ändern → **Sichern**.
3. Nach wenigen Sekunden füllen sich die Sprachfelder / das Board meldet „übersetzt“.

Woran du den Erfolg erkennst — in dieser Reihenfolge:

- Supabase → Edge Functions → `uebersetzen` → **Logs**: ein `POST 200` (nur `OPTIONS` heißt: der
  Browser hat den alten Stand, Schritt 1 wiederholen).
- Im Gericht stehen elf Sprachen; Eigennamen wie „Bounty“ oder „Dubai Crêpe“ sind **nicht** übersetzt
  (Glossar der Funktion, `ANWEISUNG` in `index.ts`).
- Master-Board → **KI-Nutzung** zeigt eine Zeile „Übersetzer · claude-opus-5 · 1×“ (falls Schritt 2c
  und 4 gemacht sind) — zunächst mit „Preis fehlt“, siehe Schritt 7.

Wenn eine **andere Meldung** kommt, nennt das Board den Grund in Klartext:

| Meldung im Board | Ursache | Handgriff |
|---|---|---|
| „noch nicht eingerichtet — ANTHROPIC_API_KEY fehlt“ | Secret fehlt/anders benannt | Schritt 3 |
| „Anthropic-Schlüssel wird abgelehnt“ | ungültig/widerrufen | Schritt 1.4 + 3 |
| „Guthaben bei Anthropic aufgebraucht“ | Konsole leer | Schritt 1.2 |
| „Kontingent für heute aufgebraucht“ | 400 Texte/Tag je Haus (60 in den ersten 7 Tagen ohne Tarif) | morgen wieder, oder Grenze in `ki_kontingent_nehmen` anpassen |
| „KI-Budget für diesen Monat aufgebraucht“ | du hast im Master-Board ein **hartes** Budget gesetzt | Master-Board → KI-Nutzung → Karte des Hauses → Budget |
| „Übersetzer nicht erreichbar“ | Browser-Zwischenspeicher oder Funktion nicht ausgerollt | Schritt 1 (hart neu laden), dann Schritt 4 |
| „Sprachmodell hat diesen Text abgelehnt“ | Sicherheitsfilter des Modells | Formulierung ändern |

## 7 · Modell wählen — und was es kostet

Standard ist **Claude Opus 5** (so lief die Funktion bisher; ohne Secret ändert sich nichts, auch kein
Byte der Anfrage). Wählbar über `UEBERSETZER_MODELL` — ausschließlich diese vier Namen, alles andere
(Tippfehler, unbekannte Namen) fällt **auf den Standard zurück** und wird nie an Anthropic geschickt:

| Wert | Preis je 1 Mio. Token (Eingabe / Ausgabe) | Hinweis |
|---|---|---|
| `claude-opus-5` (Standard) | 5 $ / 25 $ | erzwungenes Werkzeug, Ersatz bei Ablehnung |
| `claude-opus-5-5` | 4 $ / 20 $ | kein erzwungenes Werkzeug (400 bei Opus 5.5) — die Funktion schickt `auto` + Aufforderung |
| `claude-sonnet-5-5` | 2 $ / 10 $ | wie oben |
| `claude-haiku-5-5` | 0,10 $ / 0,50 $ (bis 100 000 Token Eingabe) | wie oben, ohne serverseitigen Ersatz bei Ablehnung |

*(Preise: Modelltabelle der Anthropic-SDK-Dokumentation, Stand 06.10.2026 — vor dem Rechnen auf
console.anthropic.com/docs gegenprüfen. Die Preise rechnet Omoteno in **Euro**: Im Master-Board unter
„KI-Nutzung → Preise“ trägst du je Modell Euro je Million Token ein, den Dollarkurs und das Datum in der
Bemerkung. Bis dahin steht dort „Preis fehlt“; frühere Aufrufe werden beim Eintragen nachgerechnet.)*

### Was eine Karte kostet — **Schätzung, nicht Messung**

Annahme: 100 Gerichte, je Name + Beschreibung = 200 Texte → 8 Aufrufe zu 25 Texten. Je Aufruf geschätzt
~2 000 Token Eingabe (Anweisung, Schema, Texte) und ~9 000 Token Ausgabe (elf Sprachen **plus Denken**;
Denk-Token zählen als Ausgabe). Zusammen 16 000 Eingabe und 72 000 Ausgabe:

| Modell | Eingabe | Ausgabe | **je 100 Gerichte** |
|---|---|---|---|
| Opus 5 | 0,08 $ | 1,80 $ | **≈ 1,90 $** |
| Opus 5.5 | 0,06 $ | 1,44 $ | **≈ 1,50 $** |
| Sonnet 5.5 | 0,03 $ | 0,72 $ | **≈ 0,75 $** |
| Haiku 5.5 | 0,002 $ | 0,036 $ | **≈ 0,04 $** |

Das ist **ein Mal je Karte** (Übersetzungen werden gespeichert; nur geänderte Texte kosten wieder).
Die frühere Aussage in `anleitung-uebersetzer.md` („unter 1 € je Karte“) ist nach dieser Rechnung für
Opus 5 eher knapp; **die echten Zahlen kommen aus dem Logbuch**, sobald ein Haus übersetzt hat
(Master-Board → KI-Nutzung → Kosten je Aufruf).

### Gibt es etwas Günstigeres, das trotzdem trägt?

- **Kleineres Claude-Modell** (Haiku 5.5, Sonnet 5.5): rund 2× bis 45× günstiger *rechnerisch*. Ob die
  Qualität reicht, entscheidet **deine echte Karte**, nicht diese Tabelle. Vorgehen: Testhaus,
  `UEBERSETZER_MODELL=claude-haiku-5-5` setzen, die Prüfliste unten übersetzen lassen, Ergebnis lesen
  (Arabisch/Türkisch von einer Muttersprachlerin lesen lassen, wenn möglich), im Master-Board die Kosten
  ansehen. Gefällt es nicht: Secret löschen → sofort wieder Opus 5. Nichts ist festgelegt.
- **Klassische Übersetzungsdienste** (Google Cloud Translation, DeepL): *nicht* günstiger bei dieser
  Menge. Google rechnet je Zielsprache ~20 $ je Million Zeichen (NMT); 100 Gerichte × ~140 Zeichen × 11
  Sprachen ≈ 154 000 Zeichen ≈ 3 $. DeepL liegt in der Größenordnung höher (zudem Grundgebühr; die
  Preisseiten waren in der Recherche widersprüchlich — vor einem Wechsel bei DeepL selbst nachsehen).
  Dazu fehlt ihnen, was dieses Projekt braucht: das **Glossar** (Ashta, Bounty, Kadayif …), die
  **Sie-Anrede** in elf Sprachen, **Platzhalter** `{n}` unverändert. Empfehlung: bei Claude bleiben.
- **Mehr sparen ohne Qualitätsverlust**: Doppelte Sätze übersetzt die Funktion nur einmal; nur
  geänderte Texte kosten wieder; das Tageskontingent und das Monatsbudget bremsen Ausreißer.

*Quellen der Recherche (24.10.2026): Google Cloud Translation Preise (cloud.google.com/translate/pricing),
SimpleLocalize „AI machine translation cost comparison 2026“, Flexprice/G2-Einträge zu DeepL (uneinheitlich).*

### Prüfliste für den Modellwechsel (Testhaus)

Diese Sätze im Board eintippen und sichern, dann alle elf Sprachen lesen:

| Eingabe (Deutsch) | Erwartung |
|---|---|
| `Bounty Waffel` | „Bounty“ bleibt in **jeder** Sprache stehen (kein „Kopfgeld“) |
| `Milchreis mit Ashta` | Ashta bleibt „Ashta“ (ru/uk „ашта“, ar „قشطة“); Milchreis = Landesgericht (fr „riz au lait“, es „arroz con leche“ …) |
| `Dubai Crêpe` | unverändert in allen Sprachen |
| `Kadayif mit Za'atar` | beide Namen bleiben |
| `Milch wählen` | unpersönlich („Scegliere il latte“), **kein** „Scelga“ |
| `Bitte wählen Sie {n} Beläge` | `{n}` steht in jeder Sprache; Sie-Form |
| ein arabischer Beschreibungssatz mit Komma | arabische Satzzeichen (،) |

Jede Sprache, die davon abweicht, ist ein Grund, beim größeren Modell zu bleiben.

## 8 · Was du danach brauchst

- **Preisschema rechnen**: Master-Board → KI-Nutzung → Zeitraum „Vormonat“, **CSV** exportieren (Kosten je
  Haus, Funktion und Modell), Aufschlag draufrechnen. Fotos (Profi-Foto) stehen dort ebenfalls, sobald
  `gericht-bild` mit Kostenzählung ausgerollt ist und du den **Preis je Bild** (laut fal-Rechnung bzw.
  Modellseite) eingetragen hast — die Preise von fal standen in der Recherche nicht verlässlich fest und
  sind darum **leer**, nicht geschätzt.
- **Budget je Haus**: Karte des Hauses antippen → Betrag je Monat, „hart“ sperrt Übersetzer, Rechnung
  lesen und Profi-Foto dieses Hauses bei Erreichen; ohne „hart“ ist es nur Anzeige und Warnung. Das Haus
  sieht nie Beträge, nur den Satz „Budget aufgebraucht“.
- **Wenn etwas Seltsames passiert**: `dokumente/anleitung-uebersetzer.md` (Fehlersuche mit Messwerten).

## Ehrliche Grenzen dieser Anleitung

- Nie gegen die echte API gelaufen (siehe oben); Preise und Modellnamen aus der SDK-Dokumentation vom
  06.10.2026 — Preise ändern sich.
- Die Token-Schätzung ist eine Rechnung, keine Messung. Gemessen wird ab dem ersten Lauf.
- Der Import `npm:@anthropic-ai/sdk` in `index.ts` hat keine feste Version; Deno löst sie beim Ausrollen
  auf. Ein bewusstes Festnageln (`@x.y.z`) nach dem ersten erfolgreichen Lauf ist sinnvoll, wurde hier
  nicht getan, weil keine Version gegen die echte API gelaufen ist.
- Ob Haiku/Sonnet das Glossar so treu befolgen wie Opus, zeigt nur dein Test.
