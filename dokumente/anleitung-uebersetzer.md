# Übersetzer: So bringst du ihn zum Laufen

> **Neu 24.10.2026:** Den Weg von null bis „läuft“ (inkl. Modellwahl, Kosten, Budget) beschreibt jetzt
> `anleitung-uebersetzer-einrichten.md`. Diese Datei bleibt die **Fehlersuche mit Messwerten** vom 25./26.09.
> Eine Aussage unten ist überholt: Die Kosten stehen dort nicht mehr bei „rund 0,5 bis 1 Cent je Gericht“,
> sondern als ausdrückliche Schätzung (Opus 5 ≈ 1,90 $ je 100 Gerichte) — gemessen wird im Master-Board.

Stand 26.09.2026. Ersetzt `uebersetzer-fix-anleitung.md` — die lag
falsch (siehe unten).

## Was kaputt war — gemessen, nicht vermutet

Die Logs der Funktion `uebersetzen` zeigten am 25.09. um 20:04 und
20:50 **nur `OPTIONS 200`, nie einen `POST`**. Das heißt: Die
eigentliche Anfrage ist gar nicht bei Supabase angekommen. Der
API-Schlüssel wurde also nie benutzt, weder richtig noch falsch.

Grund: Bevor der Browser eine Anfrage an eine fremde Adresse schickt,
fragt er vorher („Vorflug“, `OPTIONS`), welche Kopfzeilen erlaubt
sind. Die Funktion erlaubte nur `authorization, content-type, apikey`.
Die Supabase-Bibliothek im Board schickt aber zusätzlich
`x-client-info`. Der Browser sah das, brach ab, und das Board meldete
„keine Verbindung“.

Derselbe Fehler stand in `newsletter-vorrat-auffuellen` (Knopf
„Vorrat auffüllen“ bei den Newsletter-Codes) — dort ebenfalls nur
`OPTIONS` um 20:48.

**Erledigt am 25.09.:** Beide Funktionen erlauben jetzt genau die
Liste, die supabase-js selbst vorgibt, und sind neu ausgerollt
(`uebersetzen` Version 5, `newsletter-vorrat-auffuellen` Version 4).
`pruefungen/pruef-edge.js` prüft das künftig bei jeder Funktion.

## Stand 26.09.2026, 17:00 — gemessen: im Feld steht NICHT der Schlüssel

Dein Versuch um 16:53 kam an (`POST 200`), die Anmeldung stimmte. Die
Funktion (Version 7) prüft jetzt selbst, was unter
`ANTHROPIC_API_KEY` liegt — ohne den Wert zu verraten:

```
{"art":"zu_kurz","laenge":17,"andere_namen":[],"anthropic":"nicht_gefragt"}
```

- Dort stehen **17 Zeichen**. Ein Anthropic-API-Schlüssel hat **über
  100 Zeichen** und beginnt mit **`sk-ant-api03-`**.
- `ANTHROPIC_API_KEY` selbst hat genau 17 Zeichen. Sehr
  wahrscheinlich steht im Feld **„Value“ der Name** (klein oder
  gemischt geschrieben) statt des Schlüssels.
- Einen zweiten Eintrag mit „Anthropic“ oder „Claude“ im Namen gibt
  es nicht — der Schlüssel liegt also nirgends in Supabase.

**Guthaben:** Die 5 € müssen in der **Anthropic-Konsole**
(console.anthropic.com → Billing) liegen. Guthaben oder ein Abo auf
claude.ai gilt für die API **nicht** — das sind zwei getrennte
Konten, auch wenn beide „Claude“ heißen.

**Was du tun musst:** Schritt 3 unten, und dabei in Punkt 3 ins Feld
**Value** den langen Schlüssel einfügen, nicht den Namen.

**Selbst nachprüfen, ohne Board:** Die Funktion beantwortet
`{"diagnose":true}` ohne Anmeldung, kostenlos, und nennt nur Art und
Länge. Nach dem Eintragen muss dort `"art":"ok"` und
`"anthropic":"ok"` stehen. (Ich frage das für dich ab, sag einfach
Bescheid.)

| `art` | heißt | was tun |
|---|---|---|
| `ok` + `anthropic:"ok"` | läuft | nichts |
| `ok` + `anthropic:"schluessel_ungueltig"` | Form stimmt, Anthropic lehnt ab | neuen Schlüssel anlegen |
| `ok` + `anthropic:"guthaben_leer"` | Konsole ohne Guthaben | console.anthropic.com → Billing |
| `anderer_name` | Schlüssel liegt unter einem anderen Namen | geht trotzdem; aufräumen, wenn du magst |
| `zu_kurz`, `name_statt_wert` | Name oder kurzer Text statt Schlüssel | Schritt 3 |
| `abo_token` | Token aus einem Claude-Abo (`sk-ant-oat…`) | API-Schlüssel aus der Konsole nehmen |
| `admin_schluessel` | Admin-Schlüssel, kann nicht übersetzen | normalen API-Schlüssel anlegen |
| `kennung_statt_schluessel` | die ID des Schlüssels statt des Schlüssels | neu anlegen, **sofort** kopieren |
| `anderer_anbieter` | z. B. OpenAI (`sk-proj…`) | Anthropic-Schlüssel nehmen |
| `leer` | nichts eingetragen | Schritt 3 |

Die Funktion findet den Schlüssel auch, wenn er mit `ANTHROPIC_API_KEY=`
davor, in Anführungszeichen oder unter einem anderen Namen eingetragen
ist. Nur wenn er **nirgends** steht, kann sie nichts tun.

## Stand 26.09.2026, vormittags — gemessen: der Schlüssel war UNGÜLTIG

Probe direkt gegen die ausgerollte Funktion (aus der Datenbank über
`pg_net`, nicht aus einem Browser):

| Anfrage | Antwort | heißt |
|---|---|---|
| `{"texte":[]}` | `{"uebersetzt":{}}` | Funktion läuft, `ANTHROPIC_API_KEY` **ist gesetzt** |
| `{"texte":["Guten Appetit"]}` | `401 authentication_error: invalid x-api-key` | Anthropic **lehnt den Schlüssel ab** |

Der Vorflug ist also nicht mehr das Problem — die Anfrage kommt an,
der Schlüssel wird benutzt, und Anthropic sagt nein. Das passiert,
wenn der Schlüssel widerrufen/gelöscht wurde, zu einer anderen
Organisation gehört, oder beim Kopieren etwas fehlt oder dazukam.

**Was du tun musst: nur Schritt 3** (neuen Schlüssel anlegen und in
Supabase ersetzen). Danach Board neu laden und ein Gericht sichern.

Seit Version 6 der Funktion (26.09.):
- Leerzeichen, Zeilenumbrüche, Anführungszeichen und ein „Bearer "
  vor dem Schlüssel werden abgeschnitten; ein Wert, der nicht mit
  `sk-ant-` beginnt, meldet „kein Anthropic-Schlüssel".
- Das Board zeigt statt des rohen 401-Textes: „Der hinterlegte
  Anthropic-Schlüssel wird abgelehnt … Anleitung „Übersetzer“,
  Schritt 3."
- **Nur noch angemeldete Teammitglieder** (nach der PIN) dürfen
  übersetzen. Vorher reichte der öffentliche Schlüssel aus jedem Hub,
  um auf deine Rechnung übersetzen zu lassen. Gemessen: Aufruf mit dem
  öffentlichen Schlüssel → `kein_zugriff`, kein Anthropic-Aufruf.
- `{"probe":true}` prüft den Schlüssel kostenlos (Modellliste statt
  Übersetzung).

**Ehrliche Grenze:** Den Weg „angemeldet im Board → übersetzt“ konnte
ich nicht selbst gehen — ohne gültigen Schlüssel und ohne dein
Anmeldetoken. Der erste echte Lauf nach dem Schlüsseltausch ist deiner;
im Log steht dann `POST 200`.

## Was du jetzt tun musst

### Schritt 1 · Einmal ausprobieren

1. Board öffnen (`omoteno.de/admin`), anmelden.
2. Einmal **neu laden** mit Strg+Umschalt+R (am iPhone: Tab schließen
   und neu öffnen) — damit kein alter Stand im Zwischenspeicher hängt.
3. **Speisekarte** → ein Gericht öffnen → Beschreibung minimal ändern
   (z. B. ein Leerzeichen am Ende) → **Sichern**.

**Woran du siehst, dass es geklappt hat:** Nach einigen Sekunden
erscheint „übersetzt“ bzw. die Sprachfelder füllen sich. Dann bist du
fertig — die Schritte 2 und 3 brauchst du nicht.

### Schritt 2 · Wenn jetzt eine ANDERE Meldung kommt

Die Meldung im Board sagt jetzt, was los ist, statt „keine Verbindung“:

| Meldung im Board | Bedeutung | Was tun |
|---|---|---|
| „noch nicht eingerichtet — in Supabase fehlt ANTHROPIC_API_KEY“ | Das Geheimnis fehlt oder heißt anders | Schritt 3 |
| „Der Übersetzer meldet: 401 … invalid x-api-key“ | Schlüssel da, aber ungültig oder widerrufen | Schritt 3 mit einem neuen Schlüssel |
| „… 400 … credit balance“ | Guthaben leer | console.anthropic.com → Billing → aufladen |
| „… 429 …“ | zu viele Anfragen auf einmal | eine Minute warten, nochmal |
| „Der Übersetzer ist nicht erreichbar …“ | Browser hat den alten Stand, oder die Anfrage kommt nicht durch | Schritt 1, Punkt 2 wiederholen; hilft das nicht: Supabase → Edge Functions → `uebersetzen` → Logs. Nur `OPTIONS`, kein `POST` → mir Bescheid geben |

### Schritt 3 · Den Schlüssel richtig hinterlegen

1. **console.anthropic.com** → API Keys → **Create Key**, Name z. B.
   „omoteno-uebersetzer“. Den Schlüssel sofort kopieren (beginnt mit
   `sk-ant-`), er wird nur einmal angezeigt.
2. **supabase.com/dashboard** → Projekt → links **Edge Functions** →
   oben **Secrets**.
3. Den vorhandenen Eintrag `ANTHROPIC_API_KEY` bearbeiten (oder
   löschen und neu anlegen). **Name:** `ANTHROPIC_API_KEY`.
   **Value:** der lange Schlüssel aus Punkt 1, der mit
   `sk-ant-api03-` beginnt — **nicht** noch einmal der Name.
   **Save**.
4. Neue Geheimnisse gelten ab dem nächsten Aufruf, ein neues Ausrollen
   ist nicht nötig.
5. Zurück zu Schritt 1.

**Woran du siehst, dass es geklappt hat:** In Supabase unter Edge
Functions → `uebersetzen` → **Logs** steht nach dem Sichern ein
`POST 200`. Steht dort nur `OPTIONS`, ist der Browser noch auf dem
alten Stand (Schritt 1, Punkt 2).

## Kosten

Die Funktion benutzt Claude Opus 5 (5 $ je Million Eingabe-, 25 $ je
Million Ausgabe-Token). Ein Gericht mit Name und Beschreibung in elf
Sprachen kostet rund **0,5 bis 1 Cent**. Eine ganze Karte mit 100
Gerichten also unter 1 €. Doppelte Sätze werden nur einmal übersetzt.

## Was die alte Anleitung falsch hatte

Sie schrieb, ein ungültiger Schlüssel ergebe `kein_schluessel`. Das
stimmt nicht: `kein_schluessel` kommt nur, wenn das Geheimnis
**fehlt**. Ein falscher Schlüssel führt zu einer Ausnahme im
Anthropic-Paket, die als „Der Übersetzer meldet: 401 …“ im Board
erscheint. Und vor allem: Der eigentliche Fehler lag gar nicht beim
Schlüssel, sondern eine Ebene davor, im Vorflug des Browsers.
