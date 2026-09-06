# Omoteno · Stand am 5. September 2026

Was da ist, was läuft, was nachweislich geprüft ist — und was **nicht**.
Jede Zahl unten ist gemessen, nicht geschätzt. Wo etwas ungeprüft ist,
steht das dabei; ein Ergebnis ohne Prüfung ist eine Behauptung
(CLAUDE.md §0).

---

## 1 · Das Modell in vier Sätzen

Der Gast legt sein Telefon auf einen NFC-Untersetzer oder scannt den
QR-Code auf dem A5-Aufsteller. Der Hub öffnet sich in der Sprache
seines Telefons — ohne App, ohne Konto, ohne Einwilligungsbanner. Er
wählt, bestellt, sieht seine dreistellige Nummer und in welchem Schritt
sie steckt. Die Küche sieht den Bon in Sekunden, der Service sagt eine
Wartezeit zu, und der Gast liest sie an seinem Platz.

Neu seit heute: **Alessia** nimmt dieselbe Bestellung am Telefon auf.
Sie landet im selben Board und auf demselben Küchenschirm — nur mit
anderem Kennzeichen.

---

## 2 · Die Teile

| Datei | Umfang | Wofür |
|---|---|---|
| `seiten/omoteno-web.html` | 3 600 Z · 163 KB | Landingpage |
| `seiten/admin.html` | 5 419 Z · 381 KB | Board: Bestellungen, Karte, Auswertung |
| `seiten/kueche.html` | 1 543 Z · 70 KB | Küchendisplay am Pass |
| `seiten/konto.html` | 1 429 Z · 62 KB | Vertrag, Zugänge, Rechnungen |
| `seiten/marken-studio.html` | 2 294 Z · 103 KB | Der Kunde gestaltet seinen Hub |
| `seiten/start.html` | 2 002 Z · 94 KB | Aufnahmestrecke |
| `seiten/impressum.html` · `datenschutz.html` | 258 · 499 Z | Pflichtangaben |
| `vorlagen/hub.vorlage.html` | 8 639 Z · 637 KB | Das Gerüst aller Gäste-Hubs |

**Erzeugt daraus:**

| Hub | Umfang | Adresse |
|---|---|---|
| Choco L'AMouR | 8 767 Z · **639 KB** | `choco-lamour.omoteno.de` |
| Blend | 8 664 Z · **636 KB** | `blend.omoteno.de` |

Ein Hub ist **eine einzige Datei** — kein Bauwerkzeug, keine
Abhängigkeit, nichts nachzuladen außer Schrift und Daten.

**12 Sprachen. 21 Prüfskripte. 15 Dateien im veröffentlichten Ordner.**

---

## 3 · Wie es zusammenhängt

```
markenblaetter/<slug>.json  ─┐
vorlagen/hub.vorlage.html   ─┴─→ erzeuger/erzeuge-hub.js → dist/<slug>/index.html
seiten/*.html               ───────→ erzeuger/bauen.js  →  oeffentlich/
auslieferung/_headers,_redirects ──→                        (Netlify veröffentlicht das)
```

`dist/` und `oeffentlich/` stehen in `.gitignore`. **Netlify baut
beides bei jedem Push selbst** — ein Push in `main` erzeugt den
Auftritt, mehr ist nicht zu tun.

Der veröffentlichte Ordner bleibt **flach**: `index.html`,
`admin.html`, `h/<slug>/`. Kundenadressen entstehen über `_redirects`,
nicht über Ordner.

---

## 4 · Verträgt das ein volles Haus?

Gerechnet aus den echten Intervallen im Quelltext, für **ein** Haus
mit 200 gleichzeitig offenen Hubs:

| Wer | Takt | Anfragen/min |
|---|---|---|
| Gast · Vorgänge | 15 s | 800 |
| Gast · Bestellstand | 15 s | 800 |
| Gast · Speisekarte | **300 s** (war 90 s) | **40** (war 133) |
| Gast · Aktionen | 120 s | 100 |
| Küche | 4 s | 15 je Schirm |
| Board | Realtime + 25 s Nachholen | ~2 je Board |

**Rund 29 Anfragen pro Sekunde je Haus im Vollbetrieb.** Zehn Häuser
gleichzeitig: knapp 300/s. Das trägt eine Supabase-Pro-Instanz, ist
aber die Größenordnung, ab der man hinsehen muss.

**Heute verbessert:** Das Auffrischen der kompletten Speisekarte lief
alle 90 Sekunden — bei 200 Gästen 133 Abrufe je hundert Zeilen pro
Minute, der teuerste Posten überhaupt. Jetzt alle 5 Minuten:
**70 % weniger**. Gefahrlos, weil `bestellung_aufgeben` den Preis
ohnehin serverseitig aus der Karte nachrechnet — eine ältere Karte im
Telefon kann nichts falsch abrechnen. Und wer die Seite wieder
hervorholt, bekommt sie sofort frisch.

**Was mehrere Häuser sauber trennt:** Der Realtime-Kanal des Boards
heißt `omoteno-board-<betrieb_id>`; zwei Betriebe können sich niemals
denselben teilen. Die Trennung selbst hängt an RLS und
`meine_betriebe()` — gemessen: Ein Angemeldeter ohne Mitgliedschaft
sieht in 8 Tabellen nichts und ändert in 5 null Zeilen.

### Die ehrliche Grenze

**639 KB je Hub.** Das ist viel. Beim ersten Aufruf am Tisch über
Mobilfunk sind das je nach Netz ein bis drei Sekunden. Danach greift
`Cache-Control: public, max-age=300, must-revalidate`, und der zweite
Gast am selben Abend lädt fast nichts. **Nicht gemessen** habe ich, wie
sich das auf einem schwachen Telefon in einem vollen Keller anfühlt —
dafür braucht es ein echtes Gerät an einem echten Abend.

**Ebenfalls nicht geprüft:** ob die Indizes auf `bestellungen` für
diese Last ausreichen. Der Supabase-Zugang ist aus der Arbeitsumgebung
gesperrt (`mcp.supabase.com` am Netzausgang). Vor dem ersten großen
Abend gehört das nachgesehen:

```sql
select indexname, indexdef from pg_indexes where tablename = 'bestellungen';
-- Erwartet mindestens: (betrieb_id, zeitpunkt) und (betrieb_id, status)
```

---

## 5 · Sicherheit · was gemessen ist

Am 31.08. waren **zwei Löcher live ausnutzbar**, beide geschlossen und
nachgemessen:

- `anon` durfte direkt in `bestellungen` schreiben, am Preiswächter
  vorbei. Gemessen: **99 Stück für 1 Cent** gingen durch.
- Die Sicht `betriebe_oeffentlich` lief mit `security_invoker=false`.
  Ein anonymes `update` änderte **alle Betriebe auf einmal**.

Heutiger Stand, mit `datenbank/pruef-rechte.sql` jederzeit
nachfahrbar: **10 von 10 Angriffen abgewiesen, 10 von 10 ehrlichen
Wegen unverändert.**

Dazu seit 05.09.: Kundenadressen sind **dicht**. Ohne das
Ausrufezeichen in `_redirects` lieferte `<kunde>.omoteno.de/index.html`
die Omoteno-Landingpage aus — Netlify bedient zuerst eine vorhandene
Datei. Gegenbeweis: ohne `!` sechs Fehler, mit `!` sauber.

---

## 6 · Alessia · Bestellungen am Telefon

**Neu gebaut, teilweise ungeprüft.** Der Weg:

```
Anrufer → Vapi (Alessia)
        → supabase/functions/alessia-bestellung   [Webhook, Geheimnis im Kopf]
        → bestellung_telefon()                    [rechnet den Preis NACH]
        → bestellungen (quelle='telefon')
        → Board (Realtime, Chip „Alessia")  +  Küche (Bon mit Abholung, Name, Wunschzeit)
```

**Was schon da war** und nur nicht erreichbar: `bestellungen` trägt seit
jeher `gast_name`, `gast_telefon`, `transkript`, `abholung`,
`wunschzeit`. Das Board hat Filterchip, Herkunftsfarbe und Anzeige
komplett — es fehlte allein der Weg hinein. Die Küche filterte
`quelle=eq.tisch`, eine Telefonbestellung wäre dort **nie**
aufgetaucht.

**Der Preis wird nie übernommen.** Alessia kann sich verhören, ein
Anrufer kann alles behaupten. `bestellung_telefon()` schlägt jedes
Gericht in der Karte nach und rechnet die Summe selbst — dieselbe
Regel wie am Tisch (CLAUDE.md §2.3a). Ein unbekanntes Gericht führt zu
einer Absage, die Alessia vorlesen kann, nicht zu einem Fehlercode.

**Welches Haus?** Über die **angerufene** Nummer
(`betriebe.telefon_nummer`), nie über die des Anrufers. Geprüft: Eine
in der Nutzlast mitgeschickte Nummer schlägt die echte **nicht**.

### Was du noch tun musst

1. **Migration anwenden** — `datenbank/migration-telefonbestellung.sql`.
   Sie beginnt mit drei Vorprüfungen; erst lesen, dann fahren.
2. **Nummer eintragen** —
   `update betriebe set telefon_nummer = '+49…' where slug = 'chocolamour';`
3. **Function ausrollen** —
   `supabase functions deploy alessia-bestellung --no-verify-jwt`
   und `supabase secrets set VAPI_SECRET=<geheim>`.
4. **In Vapi** — das Werkzeug `bestellung` mit den Feldern
   `positionen[{name,menge,notiz}]`, `name`, `notiz`, `abholung`,
   `wunschzeit` anlegen, als Server-URL die Function eintragen und
   denselben Wert als Kopfzeile `X-Vapi-Secret` mitgeben.

### Was ich davon nicht prüfen konnte

- **Ob Vapi wirklich so schickt.** `pruef-alessia.js` prüft das Lesen
  der Nutzlast gegen vier Formen, darunter kaputtes JSON und eine
  leere Nachricht — aber gegen meine Annahme über Vapis Format, nicht
  gegen Vapi.
- **Ob die Function ausgerollt läuft.** Kein Zugang, kein Deno in der
  Arbeitsumgebung; nicht einmal typgeprüft.
- **Ob die Migration durchgeht.** Der Bestand war nicht lesbar.

Was ich **doch** prüfen konnte: das Auslesen der Nutzlast (22 Proben,
alle grün) und dass die Küche einen Telefonbon zeichnet — mit
Abholung, Nummer zum Ausrufen, Name, Rufnummer und Wunschzeit
(`pruef-telefonbon.js`, 10 Proben, alle grün).

---

## 7 · Vor dem Ausliefern

```bash
node erzeuger/erzeuge-hub.js --alle --pruefen-nur
node erzeuger/bauen.js
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-lieferung.js
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-durchgang.js
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-hub-hand.js
node pruefungen/pruef-alessia.js
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-telefonbon.js
```

Die vollständige Liste, nach Art der Änderung sortiert, steht in
`CLAUDE.md` §8.2.

---

## 8 · Offen — nach Dringlichkeit

| | Was | Wer |
|---|---|---|
| **1** | **Netlify: ein Projekt statt zwei.** Zwei Projekte auf einem Repo laufen zwangsläufig auseinander — daher der ungleiche Stand. Klickfolge in `deployen.md` 5b. | du |
| **2** | **Google-Anmeldung freischalten.** Der Code ist fertig, es fehlt die Konfiguration. Zwei Stellen, `deployen.md` 5c. | du |
| **3** | **Alessia ausrollen** — Punkte 1–4 oben. | du |
| **4** | **Indizes auf `bestellungen` nachsehen** vor dem ersten großen Abend. | du |
| 5 | 639 KB je Hub. Der größte Brocken ist das Wörterbuch mit 12 Sprachen. Nachladen statt einbetten wäre die eine große Optimierung — aber sie bricht „eine Datei, nichts nachzuladen". | Entscheidung |
| 6 | `bauen.js` Zeile 92: `.slice(-3)` verschluckt das halbe Bauprotokoll. Bei zwei Kunden fällt einer heraus. | klein |
| 7 | `admin.html:3013` ruft `reservierungen_aufraeumen()`, darf es aber nicht — scheitert still in `catch(e){}`. Gehört als zeitgesteuerter Auftrag, nicht als RPC für jeden Angemeldeten. | klein |
| 8 | `tisch_schluessel_neu()` benutzt `random()`, nicht kryptografischen Zufall. Derzeit unbenutzt. | klein |
| 9 | „Leaked Password Protection" ist im Supabase-Dashboard aus. | ein Klick |

---

## 9 · Was dieses Dokument nicht ist

Kein Versprechen. Es sagt, was **gemessen** ist und was nicht — und die
zwei größten offenen Punkte (Netlify, Google) sind Klicks in
Oberflächen, an die diese Arbeitsumgebung nicht herankommt. Solange
Punkt 1 offen ist, sieht dein Kunde möglicherweise weiter einen alten
Stand, ganz gleich wie grün alles hier ist.
