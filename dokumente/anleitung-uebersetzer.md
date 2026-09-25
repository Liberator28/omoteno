# Übersetzer: So bringst du ihn zum Laufen

Stand 25.09.2026. Ersetzt `uebersetzer-fix-anleitung.md` — die lag
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
3. Name **genau** `ANTHROPIC_API_KEY` (Großbuchstaben, Unterstriche,
   kein Leerzeichen davor oder dahinter). Wert: der Schlüssel.
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
