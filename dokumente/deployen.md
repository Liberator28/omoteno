# Datenpflege und Auslieferung

Von der bearbeiteten Datei bis zur sichtbaren Seite. Alles hier ist
ausprobiert, nicht angenommen.

---

## 0 · Das Wichtigste in fünf Zeilen

```bash
node erzeuger/bauen.js                                   # baut oeffentlich/
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-lieferung.js
git add -A && git commit -m "was geändert wurde"
git push
```

Netlify sieht den Push, führt `node erzeuger/bauen.js` aus und stellt
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

- `vorlagen/hub.vorlage.html` — gilt für alle Kunden
- `markenblaetter/<slug>.json` — gilt für einen
- `seiten/` — die Seiten selbst: `omoteno-web.html`, `admin.html`,
  `kueche.html`, `konto.html`, `start.html`, `marken-studio.html`,
  `impressum.html`, `datenschutz.html`, `sw.js`

### Schritt 2 — Prüfen, **bevor** du eincheckst

Die Prüfungen laufen absichtlich **nicht** bei Netlify: Sie brauchen
einen Browser und dauern Minuten. Eine Auslieferung, die daran hängt,
wird irgendwann übersprungen.

Immer:

```bash
node erzeuger/erzeuge-hub.js --alle
python3 pruefungen/pruef-datei.py dist/chocolamour/index.html
python3 pruefungen/pruef-datei.py seiten/omoteno-web.html
```

Je nachdem, was du angefasst hast:

| Geändert | Zusätzlich |
|---|---|
| Landingpage | `node pruefungen/pruef-web.js` |
| Impressum, Datenschutz | `node pruefungen/pruef-recht.js` |
| Marken-Studio | `node pruefungen/pruef-studio.js` und `node pruefungen/pruef-studio-hand.js` |
| Farben, Paletten | `node pruefungen/pruef-kontrast.js`, `node pruefungen/pruef-lesbarkeit.js` |
| Irgendetwas am Hub | `node pruefungen/pruef-durchgang.js` |
| Irgendetwas am Hub | `node pruefungen/pruef-hub-hand.js` |
| Irgendetwas am Board | `node pruefungen/pruef-board.js` |
| Meldungen, Service Worker | `node pruefungen/pruef-push.js` |
| Konto, Anfrageformular | `node pruefungen/pruef-konto-start.js` |
| Auslieferung, Umleitungen | `node erzeuger/bauen.js && node pruefungen/pruef-lieferung.js` |

Die Playwright-Prüfungen brauchen den Pfad davor:

```bash
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-web.js
```

### Schritt 3 — Bauen und ansehen

```bash
node erzeuger/bauen.js
```

Der Bau meldet, was er tut. Lies die Ausgabe: Sie nennt jede Seite,
jeden Hub und bricht ab, wenn eine Pflichtdatei fehlt.

Der Ordner `oeffentlich/` ist danach genau das, was ins Netz geht.
Ansehen kannst du ihn mit jedem kleinen Server:

```bash
cd oeffentlich && python3 -m http.server 8000
```

Dann `http://localhost:8000` im Browser. **Achtung:** Die Umleitungen
aus `_redirects` kennt dieser Server nicht — `/admin` funktioniert
dort nicht, `/admin.html` schon. `pruefungen/pruef-lieferung.js` bildet die
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
2. Es liest `netlify.toml` und führt `node erzeuger/bauen.js` aus.
3. `erzeuger/bauen.js` ruft `erzeuger/erzeuge-hub.js --alle`, baut die Hubs nach
   `dist/`, stellt `oeffentlich/` zusammen und kopiert `_headers`
   und `_redirects` hinein.
4. Netlify stellt den Inhalt von `oeffentlich/` ins Netz.

Das dauert typischerweise zwei bis drei Minuten. Solange behält
Netlify die **vorige** Fassung online — es wird nie eine halbe Seite
ausgeliefert.

**Wenn der Bau scheitert, passiert nichts.** `erzeuger/bauen.js` bricht ab,
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
| `omoteno.de/impressum` | Impressum |
| `omoteno.de/datenschutz` | Datenschutzerklärung |
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
node erzeuger/erzeuge-hub.js <slug> --pruefen-nur
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
node erzeuger/erzeuge-hub.js <slug>
python3 pruefungen/pruef-datei.py dist/<slug>/index.html
```

Prüf dabei, ob **sein** Name im Siegel steht, nicht Chocos. Das
Siegel wird aus Name und Farben gezeichnet; wer ein eigenes
gezeichnetes will, trägt es als `logo.svg` ins Markenblatt ein (so
macht es `chocolamour.json`).

### d) In die Datenbank

Der Betrieb braucht eine Zeile in `betriebe` mit demselben `slug`,
sonst findet der Hub seine Karte nicht.

### e) Domain

1. In `_redirects` **vier** Zeilen dazu — die drei Wege des Wirts
   zuerst, sonst schluckt die Hub-Regel den Pfad:
   ```
   https://<adresse>/admin*   https://omoteno.de/admin    301!
   https://<adresse>/kueche*  https://omoteno.de/kueche   301!
   https://<adresse>/konto*   https://omoteno.de/konto    301!
   https://<adresse>/*        /h/<slug>/:splat            200!
   ```
   **Das Ausrufezeichen ist Pflicht, keine Feinheit** — ohne es
   liefert die Kundenadresse Omotenos eigene Seiten aus. Warum,
   steht unten unter „Die Adresse eines Kunden".
2. Bei Netlify: **Domain management → Add domain alias** →
   `<adresse>`.
3. Beim DNS-Anbieter von `omoteno.de` einen CNAME anlegen:
   `<adresse>` → deine Netlify-Adresse (`<projekt>.netlify.app`).

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
   - Build command: `node erzeuger/bauen.js`
   - Publish directory: `oeffentlich`

   Steht beides schon in `netlify.toml` — die Datei gewinnt. Trag es
   trotzdem ein, dann sieht man in der Oberfläche, was passiert.

2. **Domain.** *Domain management* → `omoteno.de` hinzufügen, DNS
   nach Netlifys Anweisung setzen. HTTPS kommt von selbst.

3. **Der erste Lauf.** *Deploys → Trigger deploy → Clear cache and
   deploy site.* Sieh dir das Protokoll an: Dort muss die Ausgabe von
   `erzeuger/bauen.js` stehen, samt der Zeile mit den Hubs.

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
| `KEIN EINZIGER HUB` | Der Erzeuger lief, lieferte aber nichts — `node erzeuger/bauen.js` örtlich nachfahren |
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

Dann ist sein Hub aus einem alten Gerüst gebaut. `node erzeuger/bauen.js` neu
laufen lassen und mit `node pruefungen/pruef-lieferung.js` gegenprüfen — die
Prüfung sieht genau in den Titel jedes Hubs.

---

## 5c · Google-Anmeldung einschalten

Der Code in `seiten/konto.html` ist vollständig — er ruft
`signInWithOAuth({provider:"google"})` auf und übersetzt beide
möglichen Absagen in Klartext. Was fehlt, ist die **Freischaltung**.
Zwei Stellen, beide im Supabase-Dashboard:

**1 · Den Anbieter einschalten**
*Authentication → Providers → Google*. Client-ID und Secret kommen aus
der Google Cloud Console (*APIs & Services → Credentials → OAuth
client ID*, Typ „Web application"). Dort als autorisierte
Weiterleitung eintragen:

```
https://quxwweuvdqtjsdwgjdrh.supabase.co/auth/v1/callback
```

**2 · Die Rücksprungadressen erlauben**
*Authentication → URL Configuration → Redirect URLs*. Die Seite
schickt `location.origin + location.pathname` zurück, und beide
Schreibweisen sind erreichbar:

```
https://omoteno.de/konto
https://omoteno.de/konto.html
```

**Keine Kundendomain hier eintragen.** Das Konto gehört unter
omoteno.de; unter einer Kundenadresse hat es nichts zu suchen (siehe
5b).

**Woran man erkennt, welches der beiden fehlt:** Die Seite sagt es.
„noch nicht freigeschaltet" heißt Punkt 1, „Adresse nicht hinterlegt"
heißt Punkt 2.

---

## 5b · Ein Projekt, nicht zwei

> **Vorfall, 04.09.** Bei Netlify liefen ZWEI Projekte auf demselben
> Repo — eines für omoteno.de, eines für den Choco-Hub. Beide bauten
> unabhängig voneinander, zu verschiedenen Zeitpunkten. Ergebnis: Auf
> der einen Adresse stand ein alter Stand, auf der anderen die
> Landingpage statt des Hubs. Die Korrektur im Repo war längst drin.

Zwei Projekte auf einem Repo laufen **zwangsläufig** auseinander. Sie
teilen sich dieselbe `netlify.toml`, bauen denselben Ordner und
veröffentlichen dasselbe — nur eben zu verschiedenen Zeiten. Was einen
Kunden-Hub unter eigener Adresse erscheinen lässt, ist **kein zweites
Projekt**, sondern ein Domain-Alias plus eine Zeile in `_redirects`
(Abschnitt 5a).

**Zusammenlegen, in dieser Reihenfolge:**

1. Im **Omoteno-Projekt**: *Domain management → Add domain alias* →
   die Kundenadresse eintragen. Warten, bis Netlify das Zertifikat
   ausgestellt hat (steht dort als „Netlify certificate").
2. *Site configuration → Build & deploy* prüfen:
   **Base directory leer**, Branch `main`, Build command kommt aus
   `netlify.toml`. Steht im Base directory etwas, findet Netlify die
   `netlify.toml` nicht — der häufigste Grund für einen Bau, der
   sofort scheitert.
3. **Erst wenn 1 grün ist**: das zweite Projekt löschen
   (*Site configuration → Danger zone → Delete site*). Vorher nicht —
   sonst zeigt die Adresse zwischendurch ins Leere.
4. Beim Domain-Anbieter bleibt der `CNAME` unverändert. Er zeigt
   danach nur auf ein anderes Netlify-Projekt.

**Warum das auch die Anmeldung repariert:** Supabase lässt den
Rücksprung nach der Google-Anmeldung nur auf Adressen zu, die in
*Authentication → URL Configuration* stehen. Dort steht `omoteno.de`
— und dort soll auch keine Kundendomain stehen. Liegt `konto.html`
unter einer Kundenadresse, scheitert die Anmeldung genau daran.
Mit einem Projekt und sauberen Umleitungen kommt das Konto gar nicht
erst unter einer Kundendomain heraus.

---

## 5a · Eine neue Kundenadresse einpflegen

Drei Dinge, **alle drei** nötig. Fehlt eines, passiert nichts:

| # | Wo | Was |
|---|---|---|
| 1 | Domain-Anbieter | `CNAME` für die Adresse → `<projekt>.netlify.app` |
| 2 | Netlify | *Domain management → Add domain alias* |
| 3 | Repo | eine Zeile in `auslieferung/_redirects` |

1 und 2 bringen die Anfrage überhaupt erst zu Netlify. Mit 1 und 2,
aber ohne 3, kommt genau das heraus, was am 04.09. passiert ist: Der
Gast landet auf der **Landingpage** statt im Hub, weil Netlify bei
keiner passenden Regel die Startseite des Ordners ausliefert.

**Die Adresse muss NICHT wie der Slug heißen.** Links steht, was der
Gast tippt; rechts, wie der Ordner heißt:

```
https://choco-lamour.omoteno.de/*  /h/chocolamour/:splat   200!
```

Der Slug hängt an `betriebe.slug` in der Datenbank — der Hub lädt
Karte und Texte darüber. Ihn umzubenennen, nur damit er wie die
Adresse aussieht, wäre eine Datenbankänderung und neue Untersetzer.

Gibt es die Adresse schon in einer zweiten Schreibweise, bekommt die
alte eine **301** auf die echte, statt zweimal denselben Hub
auszuliefern:

```
https://chocolamour.omoteno.de/*   https://choco-lamour.omoteno.de/:splat   301!
```

**Das Ausrufezeichen ist Pflicht, keine Feinheit.** Netlify bedient
zuerst eine vorhandene **Datei** und erst danach eine nicht erzwungene
Umleitung. Der veröffentlichte Ordner ist flach — `admin.html`,
`konto.html`, `index.html` liegen darin. Ohne `!` liefert die
Kundenadresse also Omotenos Seiten aus:

```
https://<adresse>/*   /h/<slug>/:splat   200!
```

**Der Wirt braucht einen Weg an sein Board.** Drei Zeilen je Kunde,
**vor** der Hub-Regel, sonst schluckt die den Pfad:

```
https://<adresse>/admin*   https://omoteno.de/admin    301!
https://<adresse>/kueche*  https://omoteno.de/kueche   301!
https://<adresse>/konto*   https://omoteno.de/konto    301!
```

301, nicht 200: Die Anmeldung gehört auf omoteno.de, weil Supabase den
Rücksprung nur auf Adressen aus seiner Allowlist zulässt (5c). Welches
Haus der Wirt danach sieht, entscheidet `meine_betriebe()` in den
RLS-Regeln — am Board selbst ist nichts einzurichten.

Im Hub führt die Zeile **„Für den Betrieb"** im Fuß auf denselben Weg.

Danach `node erzeuger/bauen.js && node pruefungen/pruef-lieferung.js`.
Die Prüfung sagt für jeden Hub, ob eine Adresse auf ihn zeigt.

---

## 6 · Die Rechtstexte

`impressum.html` und `datenschutz.html` liegen in `seiten/` und
gehen bei jedem Bau mit raus. `erzeuger/bauen.js` führt sie als **Pflicht**:
Fehlt eine davon, bricht der Bau ab, statt eine Seite auszuliefern,
deren Impressumslink ins Leere führt.

Zwei Dinge stehen in beiden Dateien ausdrücklich drin und sollen
**nicht** „ergänzt" werden — beides steht als Kommentar oben in der
jeweiligen Datei:

- **Kein Link zur EU-Plattform für Online-Streitbeilegung.** Die
  Plattform wurde am 20.07.2025 abgeschaltet; ein Hinweis darauf ist
  seitdem falsch und selbst abmahnfähig.
- **Kein Verweis auf § 5 TMG.** Das Telemediengesetz gibt es seit
  dem 14.05.2024 nicht mehr, die Impressumspflicht steht in § 5 DDG.

Eine Zeile ist noch offen und im Impressum als solche gekennzeichnet:
die **Umsatzsteuer-Identifikationsnummer** („noch nicht erteilt").
Sobald sie vom Bundeszentralamt für Steuern da ist, den Text
ersetzen und die Klasse `offen` entfernen. Bis dahin ist die Zeile
korrekt — § 5 Abs. 1 Nr. 6 DDG verlangt die Angabe nur, „soweit
vorhanden".

**Ich bin kein Anwalt.** Die Texte sind sorgfältig geschrieben, aber
ob sie für deinen Fall vollständig sind, kann dir nur jemand sagen,
der das darf.
