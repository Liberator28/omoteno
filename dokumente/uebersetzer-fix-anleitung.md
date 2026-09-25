> **VERALTET (25.09.2026).** Diese Anleitung vermutete den Fehler im
> Schlüssel. Gemessen lag er im Vorflug des Browsers (CORS). Gültig ist
> jetzt `anleitung-uebersetzer.md`.

# Übersetzer reparieren — Anleitung für einen Chat mit Supabase-Zugriff

**Was das hier ist.** Diese Sitzung (Claude Code) erreicht Supabase
gerade nicht (`ERR_PROXY_TUNNEL`/403, je nach Verbindungsversuch).
Der Übersetzer im Admin-Board ist seit einer früheren Sitzung bekannt
kaputt, aber nie behoben worden — dieser Text steht zum Einfügen in
einen Chat mit einem Claude bereit, der den Supabase-Konnektor hat.

**Wichtig, damit hier nichts falsch verstanden wird:** Der **Code ist
korrekt**. Es muss nichts im Repository geändert werden. Das Problem
liegt allein an einem Wert in den Supabase-Secrets.

---

## Befund, in einem Satz

Der `ANTHROPIC_API_KEY`, der in den Supabase-Edge-Function-Secrets
hinterlegt ist, wird von Anthropic selbst mit `401 invalid x-api-key`
abgelehnt — die Edge Function `uebersetzen` kann deshalb keine
Übersetzung liefern.

## Wie der Code darauf reagiert (zur Einordnung, nicht zum Ändern)

- `supabase/functions/uebersetzen/index.ts` liest den Schlüssel aus
  `Deno.env.get("ANTHROPIC_API_KEY")`. Fehlt oder greift er nicht,
  antwortet die Funktion sauber mit `{ fehler: "kein_schluessel" }` —
  kein Absturz, kein halb gespeichertes Gericht.
- `seiten/admin.html` übersetzt automatisch nach dem Speichern eines
  Gerichts (`uebNachtragen`) und über den Knopf „Jetzt übersetzen"
  (`#uebJetzt`). Bei einem Fehler bleibt das Gericht **trotzdem**
  gespeichert, nur unübersetzt — mit einer ehrlichen deutschen
  Meldung, z. B. „Der Übersetzer ist noch nicht eingerichtet — in
  Supabase fehlt ANTHROPIC_API_KEY." (`UEB_GRUND`-Tabelle in
  admin.html).
- Die Datei-Kopfzeile von `uebersetzen/index.ts` vermerkt ausdrücklich:
  „nie gegen die echte API getestet" — dieser Fix ist der erste echte
  Test.

Das heißt: Alles, was gebraucht wird, ist ein **gültiger Schlüssel**
in den Secrets, kein Eingriff in den Code.

---

## Schritt 1 · Den aktuellen Zustand ansehen *(liest nur)*

**Aufgabe für den Chat-Claude:**

> Sieh dir die Edge Function `uebersetzen` im Supabase-Projekt an
> (Dashboard → Edge Functions → uebersetzen → Secrets, oder
> `supabase secrets list`, falls die CLI verfügbar ist). Ist
> `ANTHROPIC_API_KEY` gesetzt? Wie lang ist der Wert (nicht den Wert
> selbst nennen, nur ob er plausibel wie ein Anthropic-Schlüssel
> aussieht, üblicherweise beginnend mit `sk-ant-`)?

## Schritt 2 · Einen gültigen Schlüssel eintragen *(schreibt)*

**Aufgabe für den Chat-Claude:**

> Erzeuge (oder lass dir vom Nutzer geben) einen frischen, gültigen
> `ANTHROPIC_API_KEY` von console.anthropic.com und trage ihn ein:
>
> ```bash
> supabase secrets set ANTHROPIC_API_KEY=<neuer Schlüssel>
> ```
>
> oder über das Dashboard unter Edge Functions → uebersetzen →
> Secrets. Danach die Funktion neu ausrollen, falls das Ändern eines
> Secrets das nicht schon selbst auslöst:
>
> ```bash
> supabase functions deploy uebersetzen
> ```
>
> Der Schlüssel gehört **ausschließlich** in die Supabase-Secrets —
> nie in eine Datei dieses Repositories, nie in eine ausgelieferte
> Seite.

## Schritt 3 · Wirklich nachprüfen, nicht nur „gespeichert" glauben

Ein „success: true" beim Setzen eines Secrets sagt nichts darüber,
ob der Schlüssel selbst gültig ist. Ein echter Aufruf mit echtem
Text ist die einzige Probe, die zählt:

```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/uebersetzen" \
  -H "Authorization: Bearer $EIN_ANGEMELDETES_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"texte":["Frisch gebacken, warm serviert"]}' | jq
```

Erwartet: ein JSON mit den elf Sprachen des Hubs, jede mit einer
echten Übersetzung — **kein** `fehler`-Feld, kein `401`.

Danach, aus diesem Repository heraus, die formale Prüfung laufen
lassen — sie deckt genau den Admin-Board-Weg ab (Abschnitt „Der Weg
im Board" in der Datei, vier Fälle: voll übersetzt, Übersetzer
schweigt, teilweise übersetzt, fehlender Schlüssel):

```bash
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-uebersetzung.js
```

Alle Fälle müssen weiterhin grün bleiben — die Prüfung mockt die
Serverantwort und testet damit die UI-Seite unabhängig vom echten
Schlüssel; sie bestätigt also nicht direkt, dass der neue Schlüssel
selbst funktioniert (das tut nur der `curl`-Aufruf oben), sondern
dass admin.html weiterhin richtig auf jede mögliche echte Antwort
reagiert.

Am Ende: im Admin-Board wirklich ein Gericht speichern und „Jetzt
übersetzen" antippen — der einzige Beleg, der zählt, ist der, den
man gemessen hat (CLAUDE.md §0).

---

## Bonus-Fund, separat — bitte nicht verlieren

Aus derselben früheren Diagnose-Runde, unabhängig vom Übersetzer:
Die Edge Function **`melden`** läuft live unter dem Slug
**`swift-processor`**, wird aber vom Code unter dem Pfad
`/functions/v1/melden` aufgerufen und bekommt deshalb wiederholt
`404`. Das ist vermutlich der Weg, über den neue Bestellungen den
bestehenden Web-Push im Admin-Board auslösen sollten
(`push_geraete`, `pushEinrichten()`, `seiten/admin.html`). Dieser aus
Slug und Aufrufpfad zusammengesetzte Fehler steht in keiner Datei
dieses Repositories — vermutlich wurde die Function einmal direkt in
Supabase umbenannt oder mit einem anderen Namen angelegt, als der
Code erwartet.

**Zwei Wege, das zu beheben** (welcher passt, entscheidet, wie die
Function tatsächlich in Supabase heißt — das bitte zuerst nachsehen,
nicht raten, CLAUDE.md §0):

- Die Function in Supabase auf den Namen `melden` umbenennen (falls
  das über Dashboard/CLI möglich ist, ohne den Funktionskörper
  anzufassen), **oder**
- den Aufrufpfad im Code auf `swift-processor` ändern — dafür einmal
  `grep -rn "functions/v1/melden"` über das Repository laufen lassen,
  um jede Aufrufstelle zu finden, nicht nur eine.

Das ist ein eigener, kleiner Fund mit eigener Freigabe wert — nicht
Teil dieser Übersetzer-Anleitung, nur hier mit aufgeschrieben, damit
er nicht ein zweites Mal verloren geht.
