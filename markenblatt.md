# Das Markenblatt

Ein Block, ganz oben in jeder Hub-Datei. Alles, was einen Kunden vom
anderen unterscheidet, steht darin — und nur darin.

## Warum oben in der Datei und nicht in der Datenbank

Du lieferst pro Kunde eine eigene Datei aus. Damit ist die Datei der
richtige Ort: Das Markenblatt ist beim ersten Bildwechsel schon da.
Käme es aus der Datenbank, sähe der Gast für einen Moment die
Standardfarben und dann den Umschlag — auf schlechtem Café-WLAN
sekundenlang. Ein Hub, der beim Öffnen die Farbe wechselt, wirkt
kaputt, egal wie gut er sonst ist.

Der zweite Grund: Ohne Netz bleibt der Hub trotzdem der Hub des Kunden.

## Die Trennlinie

```
┌─────────────────────────────────────────┐
│  MARKENBLATT        ← das änderst du    │
├─────────────────────────────────────────┤
│  ▲ AB HIER NICHTS ÄNDERN ▲              │
│  Gerüst, Logik, Datenbank               │
│  ← das ersetzt du beim Update komplett  │
└─────────────────────────────────────────┘
```

Bei einem Update kopierst du alles unterhalb der Linie aus der
neuesten Fassung und lässt den Block darüber stehen. Deshalb steht im
Markenblatt eine `version`: Passt sie nicht zum Gerüst, sagt der Hub
es dir in der Konsole, statt still etwas Falsches zu zeichnen.

## Aufbau

```js
const MARKENBLATT = {
  version: 1,

  betrieb: {
    name:        "Café Nordstern",
    claim:       "Guter Kaffee, kurze Wege.",
    begruessung: "Schön, dass Sie da sind.",
    strasse:     "Fährstraße 12",
    ort:         "28203 Bremen",
    slug:        "nordstern"        // muss betriebe.slug entsprechen
  },

  farben: {
    grund:      "#F6F3EE",   // Seitengrund
    flaeche:    "#FFFFFF",   // Karten
    flaeche2:   "#EFEAE2",   // Eingelassenes: Felder, Bahnen
    band:       "#1E3A3A",   // Kopfband
    bandText:   "#F4F9F8",
    tinte:      "#1C2321",   // Schrift
    tinteLeise: "#6E7B77",   // Nebentext
    tinteStill: "#95A19D",   // nur Zierrat
    linie:      "#E2DCD2",
    linieStark: "#CFC6B8",
    akzent:     "#0F6E64",   // Hauptfarbe: Knöpfe, Preise, Marke
    akzent2:    "#B0791A",   // Zweitfarbe: Hervorhebung, Gold-Rolle
    gut:        "#4F7A3D"    // Bestätigung, „fertig"
  },

  // Abendvariante. an:false → der Hub bleibt rund um die Uhr hell.
  abend: {
    an:         true,
    ab:         18,          // Stunde
    grund:      "#121614",
    flaeche:    "#1A201D",
    flaeche2:   "#232B27",
    band:       "#0E1A19",
    tinte:      "#F1F5F3",
    tinteLeise: "#9DAAA5",
    tinteStill: "#77837E",
    linie:      "#2A332F",
    linieStark: "#3A453F",
    akzent:     "#5FC7B8",
    akzent2:    "#E3B457",
    gut:        "#8FBF74"
  },

  form: {
    rundung:      16,        // px, Karten
    rundungKlein: 11,        // px, Knöpfe und Felder
    rand:         18,        // px, Seitenrand
    schatten:     "weich"    // "weich" | "kante" | "ohne"
  },

  schrift: {
    kopf:    "serif-klassisch",  // siehe SCHRIFTEN unten
    text:    "system",
    groesse: 1.0                 // 0.94 – 1.12
  },

  logo: {
    art:   "text",           // "text" | "bild"
    text:  "Nordstern",
    bild:  "",               // Adresse, wenn art:"bild"
    hoehe: 30                // px
  },

  bereiche: {
    speisekarte:  true,
    getraenke:    true,
    cocktails:    false,
    reservierung: true,
    tischruf:     true,
    musikwunsch:  false,
    quiz:         false,
    trinkgeld:    true
  },

  kacheln: [
    { id:"speisekarte", t:"Speisekarte", u:"Frühstück bis 14 Uhr", von:0,  bis:24, an:true },
    { id:"getraenke",   t:"Getränke",    u:"Kaffee, Limonaden",    von:0,  bis:24, an:true },
    { id:"tischruf",    t:"Service rufen", u:"Wir kommen zu Ihnen", von:0, bis:24, an:true }
  ]
};
```

## Schriften

Feste Auswahl statt freier Eingabe. Grund: Ein Kiosk-Tablet hinter
dem Tresen hat kein Netz für Schriftnachladungen, und eine Schrift,
die nicht kommt, verschiebt beim Nachladen die halbe Karte.

| Kennung | Wirkung |
|---|---|
| `system` | neutral, schnell, überall gleich |
| `serif-klassisch` | Iowan / Palatino / Georgia — Speisekarte |
| `serif-eng` | Charter / Georgia, engere Laufweite |
| `grotesk` | Helvetica / Arial, sachlich |
| `rund` | Avenir / Nunito / Segoe, freundlich |

## Umsetzung auf CSS-Variablen

Der Hub trägt aus seiner Geschichte die Namen `--rot`, `--gold` und
`--pistazie`. Die bleiben, damit 419 Verwendungen im Stylesheet nicht
angefasst werden müssen — aber das Markenblatt spricht semantisch:

| Markenblatt | CSS-Variable |
|---|---|
| `farben.akzent` | `--rot`, `--rot-flaeche` |
| `farben.akzent2` | `--gold`, `--gold-flaeche` |
| `farben.gut` | `--pistazie`, `--pistazie-flaeche` |

Die drei Hervorhebungsflächen rechnet die Anwendung selbst aus — als
durchscheinende Fassung der jeweiligen Farbe. Sonst müsstest du sechs
Werte aufeinander abstimmen statt drei, und eine Fläche, die nicht zu
ihrer Farbe passt, sieht man sofort.

Wer eine davon anders will, trägt sie ausdrücklich ein. Das ist der
seltene Fall, nicht die Regel:

```js
akzent2Flaeche: "rgba(242,180,65,.20)"   // statt errechnet
```

Ebenfalls errechnet und bewusst nicht einstellbar: die Schriftfarbe
auf farbigen Knöpfen (`--auf-rot`, `--auf-pistazie`). Ein Kunde mit
heller Hausfarbe bekäme sonst weißen Text auf Hellgelb — unter 2:1 und
damit nicht lesbar. Der Kunde bekommt seine Farbe, der Gast bekommt
Lesbarkeit.

## Der Inhalt des Hauses

Bis zuletzt standen Name, Anschrift, Öffnungszeiten, Links, WLAN und
Empfehlungen **fest im Gerüst** — die Farben kamen aus dem Markenblatt,
der Text nicht. Für einen Kunden fiel das nicht auf. Beim zweiten hätte
sein Hub die Telefonnummer und die Öffnungszeiten des ersten getragen.

Deshalb gehören diese Blöcke jetzt ebenfalls ins Markenblatt:

| Block | Inhalt |
|---|---|
| `betrieb` | `name`, `claim`, `begruessung`, `strasse`, `ort`, `telefon`, `mail`, `slug` |
| `zeiten` | sieben Zeilen, **Sonntag zuerst** — z. B. `"10:30 – 23:00"` |
| `links` | `bewertung`, `maps`, `instagram`, `tiktok`, `website` — leere blenden ihre Kachel aus |
| `wlan` | `netz`, `passwort` |
| `trinkgeld` | `paypal`, `betraege` (Liste von Zahlen) |
| `empfehlung` | Liste: `von`, `bis` (Stunde), `kennz`, `name`, `was`, `preis`, `ziel`, `gericht` |
| `avatar` | `figur`: `untersetzer` \| `erdbeere`, `art`: `freundlich` \| `ruhig` \| `witzig`, `name` |

**Fehlt ein Block, bleibt der Platzhalter aus dem Gerüst stehen** und
der Erzeuger sagt es als Hinweis. Ein altes Markenblatt ohne diese
Felder läuft also weiter — es zeigt nur nichts Eigenes.

### Die Figur

`figur` bestimmt, **wer** den Gast begleitet, `art` bestimmt **wie**.
Beides ist unabhängig: Jede Figur kann jede der drei Launen tragen.

- **`untersetzer`** — die Vorgabe. Der Untersetzer ist Omotenos
  Produkt und passt in jedes Haus. Fehlt `figur`, ist es dieser.
- **`erdbeere`** — Chocos Figur. Die Frucht bleibt Frucht: Rot, Grün
  und Kernbeige stehen fest, denn eine Erdbeere in der Hausfarbe ist
  keine Erdbeere mehr. Das Haus steht auf der **Schürze** — sie trägt
  `farben.band`, der Buchstabe darauf `farben.bandText`, und der
  Buchstabe kommt aus dem ersten Zeichen von `betrieb.name`.

Ein unbekannter Wert ist ein **Fehler**, kein Hinweis: Sonst hätte der
Kunde seine Figur ausgewählt, bekäme wortlos den Untersetzer, und
niemand sagte es ihm.

Nur Figuren mit Haltungen (heute die Erdbeere) erscheinen im
Bestellpass in drei Posen. Häuser mit dem Untersetzer bekommen dort
gezeichnete Zeichen — Zettel, Pfanne, Glocke.

## Was NICHT ins Markenblatt gehört

- Gerichte, Preise, Allergene → Datenbank, gepflegt im Board
- Tischschlüssel → Datenbank
- Bestellstopp und Testphase → Datenbank, vom Board geschaltet

Faustregel: Ändert es sich im laufenden Betrieb, gehört es in die
Datenbank. Ändert es sich einmal bei der Einrichtung, gehört es ins
Markenblatt.

Die Öffnungszeiten sind der Grenzfall: Sie stehen im Markenblatt, weil
sie sich selten ändern und der Hub sie ohne Netz zeigen können muss.
Wer sie im Betrieb ändern will, braucht eine Spalte in `betriebe` und
einen Vorrang zur Laufzeit — das ist bewusst noch nicht gebaut.
