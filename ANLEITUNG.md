# Von GitHub zu Netlify — Schritt für Schritt

Diese Anleitung setzt **nichts** voraus. Wenn irgendwo ein Wort steht,
das du nicht kennst, steht daneben, was es bedeutet.

---

## Teil 0 · Was hier überhaupt passiert

Stell dir drei Orte vor:

| Ort | Was er ist | Vergleich |
|---|---|---|
| **Dein Rechner / diese Sitzung** | Hier wird gearbeitet | Die Küche |
| **GitHub** | Hier liegen alle Dateien und ihre Geschichte | Das Lager |
| **Netlify** | Hier läuft die Seite für alle im Internet | Der Gastraum |

Der Weg ist immer derselbe:
**Küche → Lager → Gastraum.** Also: ändern → zu GitHub schicken →
Netlify macht daraus die Seite.

**Das Wichtigste zuerst:** Netlify baut die Seite selbst. Du lädst
also **keine** Dateien bei Netlify hoch. Du schiebst sie zu GitHub,
und Netlify holt sie sich von dort. Das ist der ganze Trick.

---

## Teil 1 · Einmalig einrichten (ca. 15 Minuten)

Das machst du **einmal**. Danach nie wieder.

### Schritt 1.1 — Netlify sagen, wie gebaut wird

1. Geh auf **netlify.com** und melde dich an.
2. Klick auf dein Projekt (die Seite, die schon läuft).
3. Links im Menü: **Site configuration** → **Build & deploy**.
4. Bei **Build settings** klick auf **Configure**.
5. Trag genau das ein:

   | Feld | Was reinkommt |
   |---|---|
   | Build command | `node bauen.js` |
   | Publish directory | `oeffentlich` |
   | Base directory | *(leer lassen)* |

6. **Save**.

> **Was passiert da?**
> „Build command" heißt: der Befehl, den Netlify ausführt.
> `node bauen.js` startet unser kleines Programm `bauen.js`. Das
> baut den Ordner `oeffentlich` zusammen.
> „Publish directory" heißt: welcher Ordner ins Internet soll.
> Antwort: `oeffentlich`.

> **Muss ich das eintragen, wenn es schon in `netlify.toml` steht?**
> Nein — die Datei gewinnt sowieso. Trag es trotzdem ein: Dann
> siehst du in der Oberfläche, was passiert, statt raten zu müssen.

### Schritt 1.2 — Deine Adresse eintragen

1. Links im Menü: **Domain management**.
2. **Add a domain** → `omoteno.de` eingeben.
3. Netlify sagt dir jetzt, was du bei deinem Domain-Anbieter
   (bei dir: IONOS) eintragen musst. Meist zwei Zeilen, sogenannte
   „DNS-Einträge". Kopier sie genau so, wie Netlify sie zeigt.
4. Bei IONOS einloggen → Domain → DNS → die Zeilen eintragen.
5. Warten. Das dauert zwischen zehn Minuten und ein paar Stunden.
   Das ist normal und liegt nicht an dir.

> **Was ist DNS?** Das Telefonbuch des Internets. Es übersetzt
> `omoteno.de` in die Nummer des Rechners, auf dem die Seite liegt.
> Du sagst dem Telefonbuch: „Wer nach omoteno.de fragt, soll zu
> Netlify geschickt werden."

Das Schloss-Symbol (HTTPS) richtet Netlify von allein ein. Nichts zu tun.

### Schritt 1.3 — Den ersten Bau starten

1. Links im Menü: **Deploys**.
2. Rechts oben: **Trigger deploy** → **Clear cache and deploy site**.
3. Klick auf den Lauf, der jetzt startet. Du siehst Text durchlaufen.

**Darauf achtest du:** Irgendwo im Text muss stehen

```
oeffentlich/ steht: 8 Seiten, 2 Hubs, 13 Einträge oben.
```

Steht das da, hat es geklappt. Steht am Ende **Published**, ist die
Seite online.

---

## Teil 2 · Der normale Weg, wenn etwas geändert wurde

Das ist der Ablauf, den du ab jetzt **jedes Mal** gehst.

### Schritt 2.1 — Prüfen, bevor du etwas abschickst

In der Sitzung (oder auf deinem Rechner im Ordner):

```bash
node bauen.js
```

Das baut alles zusammen und sagt dir, ob etwas fehlt.
**Wenn es abbricht, schick nichts ab.** Ein Abbruch ist kein
Unglück — er verhindert gerade, dass etwas Kaputtes online geht.

Dann die große Prüfung:

```bash
NODE_PATH=/opt/node22/lib/node_modules node pruef-lieferung.js
NODE_PATH=/opt/node22/lib/node_modules node pruef-hub-hand.js chocolamour
```

Bei beiden muss am Ende **„Alles sauber."** bzw. **„Keine Fehler"**
stehen. Wenn nicht: nicht abschicken, sondern melden.

### Schritt 2.2 — Zu GitHub schicken

```bash
git add -A
git commit -m "kurz aufschreiben, was du geändert hast"
git push
```

> **Was heißt das?**
> - `git add -A` → „nimm alle Änderungen mit"
> - `git commit -m "…"` → „pack sie in ein Päckchen und schreib
>   drauf, was drin ist"
> - `git push` → „schick das Päckchen ins Lager (GitHub)"

### Schritt 2.3 — Zusehen, wie Netlify baut

Du musst **nichts** tun. Netlify merkt das von selbst.

1. **netlify.com** → dein Projekt → **Deploys**.
2. Oben steht ein neuer Lauf: erst gelb („Building"), dann grün
   („Published").
3. Das dauert zwei bis drei Minuten.

**Solange gebaut wird, bleibt die alte Seite online.** Es gibt
keinen Moment, in dem Gäste eine halbe Seite sehen.

### Schritt 2.4 — Nachsehen, ob es wirklich da ist

Ruf diese Adressen auf und schau, ob jede etwas zeigt:

| Adresse | Was du sehen musst |
|---|---|
| `omoteno.de` | Die Startseite mit dem Untersetzer |
| `omoteno.de/admin` | Das Board (fragt nach Anmeldung) |
| `omoteno.de/kueche` | Das Küchendisplay |
| `omoteno.de/konto` | Das Kundenkonto |
| `omoteno.de/start` | Das Anfrageformular |
| `omoteno.de/studio` | Das Marken-Studio |
| `omoteno.de/impressum` | Das Impressum |
| `omoteno.de/datenschutz` | Die Datenschutzerklärung |
| `omoteno.de/h/chocolamour/` | Chocos Gäste-Hub |

> **Siehst du noch die alte Fassung?** Drück **Strg + Umschalt + R**
> (Mac: **Cmd + Umschalt + R**). Das lädt die Seite wirklich neu,
> statt sie aus dem Zwischenspeicher zu nehmen.

---

## Teil 3 · Wenn etwas schiefgeht

### Der Bau ist rot („Failed")

1. **Deploys** → auf den roten Lauf klicken.
2. Den Text von **unten nach oben** lesen. Die erste Zeile, die
   nach einem Fehler aussieht, ist meistens die richtige.

Häufige Meldungen:

| Im Text steht | Was zu tun ist |
|---|---|
| `FEHLER: betrieb.slug fehlt` | Im Markenblatt (`<name>.json`) fehlt eine Pflichtangabe |
| `impressum.html fehlt — Abbruch` | Eine Pflichtdatei ist nicht im Ordner |
| `KEIN EINZIGER HUB` | Zwischen Erzeugen und Ausliefern klemmt etwas |
| `Die Vorlage hat keine LOGO-Marke` | In `hub.vorlage.html` fehlen die Marken für das Siegel |

**Wichtig:** Solange der Bau rot ist, bleibt die **alte** Seite
online. Es ist nichts kaputt. Du hast Zeit.

### Zurück auf die letzte funktionierende Fassung

1. **Deploys** → in der Liste den letzten **grünen** Lauf suchen.
2. Draufklicken → **Publish deploy**.

Das wirkt sofort und braucht kein GitHub. Danach kannst du in Ruhe
suchen, was schiefgelaufen ist.

### Ein Kunde sieht noch die alte Karte

Der Browser hält Gäste-Hubs fünf Minuten fest (das ist Absicht — es
macht den Hub schnell). Einmal hart neu laden oder fünf Minuten
warten.

---

## Teil 4 · Ein neuer Kunde kommt dazu

1. **Markenblatt anlegen.** Eine Datei `<kürzel>.json` neben die
   anderen legen. Am einfachsten im Marken-Studio Farben einstellen,
   unten auf „Markenblatt kopieren" tippen und einsetzen.
2. **Erst prüfen, ohne zu schreiben:**
   ```bash
   node erzeuge-hub.js <kürzel> --pruefen-nur
   ```
   **Lies die Hinweise.** Besonders diesen: Wenn dort steht, dass
   das Quiz eingeschaltet ist, aber eigene Fragen fehlen, würden
   deinem Kunden zwei Fragen über **Choco L'AMouR** gestellt.
3. **Erzeugen:**
   ```bash
   node erzeuge-hub.js <kürzel>
   ```
   Dann in der erzeugten Datei nachsehen: Steht **sein** Name im
   runden Siegel oben links? Nicht Chocos?
4. **In die Datenbank:** Der Betrieb braucht eine Zeile in der
   Tabelle `betriebe` mit demselben Kürzel. Sonst findet der Hub
   seine Speisekarte nicht.
5. **Eigene Adresse** (optional): In `_redirects` eine Zeile dazu:
   ```
   https://<kürzel>.omoteno.de/*   /h/<kürzel>/:splat   200
   ```
   Dann bei Netlify unter **Domain management** →
   **Add domain alias** die Adresse eintragen, und bei IONOS einen
   CNAME-Eintrag `<kürzel>` → deine Netlify-Adresse anlegen.

   Bis das steht, ist der Hub unter `omoteno.de/h/<kürzel>/`
   erreichbar — voll benutzbar, nur die Adresse ist länger.

---

## Teil 5 · Drei Regeln, die du nie brechen solltest

1. **Bearbeite niemals etwas in `dist/` oder `oeffentlich/`.**
   Diese Ordner werden bei jedem Bau gelöscht und neu geschrieben.
   Alles, was du dort änderst, ist beim nächsten Mal weg.
   Änderungen gehören in `hub.vorlage.html` (gilt für alle Kunden)
   oder in `<kürzel>.json` (gilt für einen).

2. **Schick nichts ab, wenn eine Prüfung rot ist.**
   Die Prüfungen sind keine Schikane. Jede einzelne steht da, weil
   genau dieser Fehler schon einmal passiert ist.

3. **Lies die Ausgabe von `node bauen.js`.**
   Sie sagt dir in normalen Worten, was gerade passiert und was
   fehlt. Zehn Sekunden lesen ersparen eine Stunde suchen.
