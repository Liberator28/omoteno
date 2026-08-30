# Datenpflege und Auslieferung

Von der bearbeiteten Datei bis zur sichtbaren Seite. Alles hier ist
ausprobiert, nicht angenommen.

---

## 0 · Das Wichtigste in fünf Zeilen

```bash
node bauen.js                                   # baut oeffentlich/
NODE_PATH=/opt/node22/lib/node_modules node pruef-lieferung.js
git add -A && git commit -m "was geändert wurde"
git push
```

Netlify sieht den Push, führt `node bauen.js` aus und stellt
`oeffentlich/` ins Netz. Nach zwei bis drei Minuten ist es oben.

---

## 1 · Wo was liegt — und was das heißt

Die wichtigste Frage bei jeder Änderung: **Wo gehört das hin?** Es
gibt drei Orte, und sie verhalten sich völlig verschieden.

| Ort | Was da hineingehört | Wann es wirkt |
|---|---|---|
| **Datenbank** (Supabase) | Gerichte, Preise, Bestellungen, Öffnungspause, Top-Runner, die freien Texte aus dem Board | **Sofort.** Kein Auslieferungslauf nötig. |
| **Markenblatt** `<slug>.json` | Farben, Schrift, Form, Logo, Figur, Zeiten, Links, WLAN, Empfehlungen, Quizfragen | Nach `git push` — Netlify baut den Hub neu. |
| **Gerüst** `hub.vorlage.html` | Alles, was für **alle** Kunden gilt: Abläufe, Übersetzungen, Aufbau | Nach `git push` — alle Hubs werden neu gebaut. |

**Die Faustregel:** Was der Wirt selbst ändern können soll, gehört in
die Datenbank. Was sein Haus von anderen unterscheidet, ins
Markenblatt. Was für alle gilt, ins Gerüst.

### Was der Wirt selbst im Board ändert

Ohne dich, ohne Auslieferung, sofort sichtbar:

- Gerichte, Preise, Beschreibungen, Bilder, Kategorien
- Bestellpause an und aus, samt Text
- Der Name und die Bedingungen der Top-Runner-Aktion
- Slogan, Begrüßung und der Titel des Runners (unter „Texte")
- Öffnungszeiten, soweit sie in der Datenbank stehen

### Was du erzeugen musst

Alles aus dem Markenblatt. **Woran man es merkt:** In
`betriebe.erzeugt_am` steht, wann der Hub dieses Kunden zuletzt
gebaut wurde. Ist das Markenblatt neuer als dieses Datum, sieht der
Gast noch die alte Fassung.

```sql
select slug, name, erzeugt_am from betriebe order by erzeugt_am nulls first;
```

> **Achtung, eine Falle.** `betriebe.markenblatt` in der Datenbank und
> `<slug>.json` im Verzeichnis sind **zwei verschiedene Dinge**. Das
> Konto schreibt in die Datenbank, der Erzeuger liest die Datei. Wenn
> ein Kunde im Konto ein Markenblatt übernimmt, musst du es von dort
> in die Datei ziehen — sonst passiert nichts. Bis das automatisch
> geht, ist das ein Handgriff, und er gehört auf deine Liste.

---

## 2 · Der tägliche Weg

### Schritt 1 — Ändern

**Niemals in `dist/` oder `oeffentlich/` bearbeiten.** Beide werden
bei jedem Bau gelöscht und neu geschrieben. Änderungen gehen in:

- `hub.vorlage.html` — gilt für alle Kunden
- `<slug>.json` — gilt für einen
- `omoteno-web.html`, `admin.html`, `kueche.html`, `konto.html`,
  `start.html`, `marken-studio.html` — die Seiten selbst

### Schritt 2 — Prüfen, **bevor** du eincheckst

Die Prüfungen laufen absichtlich **nicht** bei Netlify: Sie brauchen
einen Browser und dauern Minuten. Eine Auslieferung, die daran hängt,
wird irgendwann übersprungen.

Immer:

```bash
node erzeuge-hub.js --alle
python3 pruef-datei.py dist/chocolamour/index.html
python3 pruef-datei.py omoteno-web.html
```

Je nachdem, was du angefasst hast:

| Geändert | Zusätzlich |
|---|---|
| Landingpage | `node pruef-web.js` |
| Marken-Studio | `node pruef-studio.js` und `node pruef-studio-hand.js` |
| Farben, Paletten | `node pruef-kontrast.js`, `node pruef-lesbarkeit.js` |
| Irgendetwas am Hub | `node pruef-durchgang.js` |
| Irgendetwas am Board | `node pruef-board.js` |
| Auslieferung, Umleitungen | `node bauen.js && node pruef-lieferung.js` |

Die Playwright-Prüfungen brauchen den Pfad davor:

```bash
NODE_PATH=/opt/node22/lib/node_modules node pruef-web.js
```

### Schritt 3 — Bauen und ansehen

```bash
node bauen.js
```

Der Bau meldet, was er tut. Lies die Ausgabe — sie sagt dir auch, was
fehlt (zum Beispiel `impressum.html`, siehe unten).

Der Ordner `oeffentlich/` ist danach genau das, was ins Netz geht.
Ansehen kannst du ihn mit jedem kleinen Server:

```bash
cd oeffentlich && python3 -m http.server 8000
```

Dann `http://localhost:8000` im Browser. **Achtung:** Die Umleitungen
aus `_redirects` kennt dieser Server nicht — `/admin` funktioniert
dort nicht, `/admin.html` schon. `pruef-lieferung.js` bildet die
Umleitungen dagegen nach.

### Schritt 4 — Einchecken und hochschieben

```bash
git add -A
git commit -m "Zeitbalken auf dem Telefon beschriftet"
git push
```

Was **nicht** mitgeht, und das ist Absicht: `dist/` und
`oeffentlich/` stehen in `.gitignore`. Was erzeugt werden kann,
gehört nicht in die Versionsgeschichte — sonst zeigt jeder Vergleich
tausende Zeilen, die niemand gelesen hat.

### Schritt 5 — Was Netlify daraus macht

1. Netlify sieht den Push am Zweig.
2. Es liest `netlify.toml` und führt `node bauen.js` aus.
3. `bauen.js` ruft `erzeuge-hub.js --alle`, baut die Hubs nach
   `dist/`, stellt `oeffentlich/` zusammen und kopiert `_headers`
   und `_redirects` hinein.
4. Netlify stellt den Inhalt von `oeffentlich/` ins Netz.

Das dauert typischerweise zwei bis drei Minuten. Solange behält
Netlify die **vorige** Fassung online — es wird nie eine halbe Seite
ausgeliefert.

**Wenn der Bau scheitert, passiert nichts.** `bauen.js` bricht ab,
wenn der Erzeuger scheitert oder kein einziger Hub herauskommt. Die
alte Fassung bleibt oben. Das ist gewollt: Eine Auslieferung ohne
Kunden-Hubs sähe erfolgreich aus, und die Kunden wären offline.

### Schritt 6 — Wo du es siehst

| Adresse | Was |
|---|---|
| `omoteno.de` | Die Landingpage |
| `omoteno.de/admin` | Das Board |
| `omoteno.de/kueche` | Küche und Theke |
| `omoteno.de/konto` | Das Kundenkonto |
| `omoteno.de/start` | Das Anfrageformular |
| `omoteno.de/studio` | Das Marken-Studio |
| `omoteno.de/h/<slug>/` | Der Hub eines Kunden |
| `<slug>.omoteno.de` | Derselbe Hub unter eigener Domain |

Die `.html`-Adressen gelten weiter (`/admin.html` und so fort) — die
Seiten verlinken sich untereinander so.

---

## 3 · Ein neuer Kunde

### a) Markenblatt anlegen

Am einfachsten über das Marken-Studio: Farben einstellen, unten
„Markenblatt kopieren", in eine neue Datei `<slug>.json` einsetzen und
in gültiges JSON bringen (das Studio gibt JavaScript aus — Kommentare
raus, Schlüssel in Anführungszeichen).

Pflicht sind `version`, `betrieb.name`, `betrieb.slug` und `farben`.
Der `slug` muss dem Dateinamen entsprechen und darf nur
Kleinbuchstaben, Ziffern und Bindestriche enthalten.

### b) Prüfen, ohne zu schreiben

```bash
node erzeuge-hub.js <slug> --pruefen-nur
```

Der Erzeuger sagt, was fehlt. **Lies die Hinweise.** Zwei davon
kosten sonst richtig:

- *„quiz ist eingeschaltet, aber es fehlen eigene Fragen"* — dann
  stellt der Hub deinen Gästen zwei Fragen über **Choco L'AMouR**.
  Entweder eigene Fragen ins Markenblatt (`"quiz": [...]`) oder
  `bereiche.quiz` auf `false`.
- *Kontrastwarnungen* — eine Farbkombination unter 4,5:1 ist auf einem
  Telefon mit Fingerabdrücken nicht lesbar.

### c) Erzeugen und ansehen

```bash
node erzeuge-hub.js <slug>
python3 pruef-datei.py dist/<slug>/index.html
```

Prüf dabei, ob **sein** Name im Siegel steht, nicht Chocos. Das
Siegel wird aus Name und Farben gezeichnet; wer ein eigenes
gezeichnetes will, trägt es als `logo.svg` ins Markenblatt ein (so
macht es `chocolamour.json`).

### d) In die Datenbank

Der Betrieb braucht eine Zeile in `betriebe` mit demselben `slug`,
sonst findet der Hub seine Karte nicht.

### e) Domain

1. In `_redirects` eine Zeile dazu:
   ```
   https://<slug>.omoteno.de/*   /h/<slug>/:splat   200
   ```
2. Bei Netlify: **Domain management → Add domain alias** →
   `<slug>.omoteno.de`.
3. Beim DNS-Anbieter von `omoteno.de` einen CNAME anlegen:
   `<slug>` → deine Netlify-Adresse (`<projekt>.netlify.app`).

Ohne Schritt 2 **und** 3 läuft die Anfrage gar nicht erst bei Netlify
vorbei, und die Zeile aus Schritt 1 kann nichts tun.

Bis die Domain steht, ist der Hub unter `omoteno.de/h/<slug>/`
erreichbar — vollständig benutzbar, nur die Adresse ist länger.

### f) Tischcodes

Die Untersetzer bekommen die Adresse des Hubs. Erst wenn sie auf den
Tischen liegen, darf `tisch_pflicht` an.

---

## 4 · Das erste Mal einrichten (einmalig)

Netlify ist verbunden, ein Projekt läuft. Was noch fehlt:

1. **Baueinstellung setzen.** Netlify → dein Projekt → *Site
   configuration → Build & deploy*:
   - Build command: `node bauen.js`
   - Publish directory: `oeffentlich`

   Steht beides schon in `netlify.toml` — die Datei gewinnt. Trag es
   trotzdem ein, dann sieht man in der Oberfläche, was passiert.

2. **Domain.** *Domain management* → `omoteno.de` hinzufügen, DNS
   nach Netlifys Anweisung setzen. HTTPS kommt von selbst.

3. **Der erste Lauf.** *Deploys → Trigger deploy → Clear cache and
   deploy site.* Sieh dir das Protokoll an: Dort muss die Ausgabe von
   `bauen.js` stehen, samt der Zeile mit den Hubs.

Ein zweites oder drittes Netlify-Projekt brauchst du **nicht**. Warum,
steht in `netlify.toml`: Sie müssten sich dieselbe Konfigurationsdatei
teilen, und getrennte Umleitungen gingen nur mit einem Umbau der
Ordner. Ein Projekt, ein Bau, getrennt wird über Adressen.

---

## 5 · Wenn etwas schiefgeht

### Die Seite ist alt geblieben

Netlify → *Deploys*. Steht der letzte Lauf auf **Failed**, ist der Bau
gescheitert und die alte Fassung noch oben — genau wie vorgesehen.
Öffne den Lauf und lies das Protokoll von unten nach oben. Die erste
Zeile, die nach einem Fehler aussieht, ist meist die richtige.

Häufigste Ursachen:

| Im Protokoll | Was zu tun ist |
|---|---|
| `FEHLER: betrieb.slug fehlt` | Markenblatt unvollständig |
| `slug im Markenblatt … passt nicht zum Dateinamen` | Datei umbenennen oder `slug` ändern |
| `KEIN EINZIGER HUB` | Der Erzeuger lief, lieferte aber nichts — `node bauen.js` örtlich nachfahren |
| `Die Vorlage hat keine LOGO-Marke` | In `hub.vorlage.html` fehlen `{{LOGO}}` … `{{/LOGO}}` |

### Zurückrollen

Netlify → *Deploys* → den letzten funktionierenden Lauf anklicken →
**Publish deploy**. Das ist sofort wirksam und braucht kein Git.

Danach den Fehler in Ruhe örtlich suchen. Ein zurückgerollter Stand
bleibt oben, bis du das nächste Mal pushst.

### Ein Kunde sieht die alte Fassung

Der Browser hält Hubs fünf Minuten (`_headers`). Einmal hart neu
laden (⇧ + Neu laden) oder fünf Minuten warten.

### Ein Kunde sieht den falschen Namen

Dann ist sein Hub aus einem alten Gerüst gebaut. `node bauen.js` neu
laufen lassen und mit `node pruef-lieferung.js` gegenprüfen — die
Prüfung sieht genau in den Titel jedes Hubs.

---

## 6 · Was noch fehlt

**`impressum.html` und `datenschutz.html` gibt es nicht**, sind aber
sechsmal verlinkt: im Fuß von `omoteno-web.html`, `konto.html` und
`start.html`, und in der Einwilligung des Anfrageformulars. Diese
Links führen ins Leere.

Für eine gewerbliche Seite in Deutschland ist ein Impressum
vorgeschrieben, und das Anfrageformular verweist auf eine
Datenschutzerklärung, die nicht existiert. **Ich bin kein Anwalt** —
lass beides von jemandem aufsetzen, der es ist. `bauen.js` nimmt die
Dateien auf, sobald sie da sind, und meldet sie bis dahin bei jedem
Lauf als fehlend.
