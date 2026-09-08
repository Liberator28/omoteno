---
name: bewegung
description: Handwerk für Animationen und Übergänge nach Emil Kowalskis Regeln — Kurven, Dauern, was überhaupt animiert werden darf, und wie man es misst. Greift, sobald an einer Animation, einem Übergang, einer Einblendung, einem 3D-Modell oder einer Geste gearbeitet wird, und immer dann, wenn etwas „smoother", „hochwertiger" oder „wie bei Apple" aussehen soll.
---

# Bewegung

Emil Kowalski (animations.dev, Sonner, Vaul) bringt es auf einen Satz:
**Gute Bewegung merkt man nicht, schlechte schon.** Alles hier folgt
daraus.

Der teuerste Fehler ist nicht die falsche Kurve — es ist Bewegung, die
gar keinen Grund hat. Vor jeder Animation die Frage: **Was versteht der
Nutzer danach besser?** Woher etwas kommt, wohin es geht, dass etwas
angekommen ist, dass sein Tippen gezählt hat. Wer nichts davon
beantworten kann, lässt es weg.

---

## 1 · Nur `transform` und `opacity`

Diese beiden rechnet der Compositor auf der Grafikkarte. Alles andere
zwingt den Browser, Layout und Anstrich neu zu rechnen — bei jedem
einzelnen Bild.

| statt | nimm |
|---|---|
| `width` / `height` | `transform:scale()` |
| `top` / `left` / `margin` | `transform:translate()` |
| `filter:blur()` in Schleifen | sparsam, nie auf großen Flächen |
| `box-shadow` animieren | zweite Ebene mit `opacity` überblenden |

Muss sich doch ein Layout ändern: **FLIP** — erst messen, dann mit
`transform` vortäuschen, dann laufen lassen.

`will-change` nur auf dem einen Element, das gerade läuft, und danach
wieder weg. Auf zwanzig Elementen ist es kein Hinweis mehr, sondern
eine Speicherbremse.

## 2 · Die Kurve sagt, ob es echt wirkt

**`linear` ist für Bedienoberflächen immer falsch.** Nichts in der
physischen Welt startet und stoppt mit derselben Geschwindigkeit.
Ausnahme: was sich endlos dreht (Ladekreisel) oder ein Wert, der
gleichmäßig läuft.

| Vorgang | Kurve | warum |
|---|---|---|
| kommt herein | **ease-out** | schnell da, dann ausrollen — reagiert sofort |
| geht hinaus | **ease-in** | zieht an und verschwindet; niemand wartet dem Weggehen hinterher |
| bewegt sich im Bild | **ease-in-out** | beschleunigt und bremst wie ein Körper |
| Geste, unterbrechbar | **Feder** | siehe §4 |

Im Verzeichnis stehen die Kurven schon als Variablen — **benutzen,
nicht neue erfinden**:

```css
--weich:cubic-bezier(.16,1,.3,1);      /* ease-out, sehr weiches Ausrollen */
--schnell:cubic-bezier(.77,0,.175,1);  /* ease-in-out, kräftig */
--elegant:cubic-bezier(.33,1,.68,1);   /* ease-out, ruhiger */
```

> **Achtung, gemessen:** `hub.vorlage.html` trägt unter demselben Namen
> eine **andere** Kurve (`.2,.8,.3,1`) als `omoteno-web.html`,
> `konto.html` und `start.html`. Wer eine Bewegung aus einer Datei in
> die andere kopiert, bekommt dort ein anderes Gefühl. Beim nächsten
> Anfassen angleichen oder den Unterschied ausdrücklich begründen
> (§5.3).

## 3 · Dauer hängt an der Strecke

| Was | Dauer |
|---|---|
| Antippen, Umschalter, Haken | **80 – 160 ms** |
| Karte, Menü, Blatt, Meldung | **180 – 320 ms** |
| Ganzer Schirm, Seitenwechsel | **320 – 500 ms** |
| Etwas darüber | nur, wenn es eine Vorführung ist |

**Hinausgehen ist schneller als Hereinkommen** — meist 60 bis 80
Prozent. Der Nutzer hat sich schon entschieden.

Alles über 500 ms fühlt sich beim zweiten Mal zäh an, beim zehnten
Mal wie ein Fehler. Eine Vorführung, die man einmal sieht, darf länger
laufen — eine Bedienung nie.

## 4 · Federn für alles, was der Finger führt

Eine Kurve hat eine feste Dauer. Eine Feder hat einen Zustand — sie
lässt sich **mitten in der Bewegung umlenken**, ohne zu springen. Für
Wischgesten, Blätter und Regler ist das der Unterschied zwischen
„reagiert" und „spielt eine Datei ab".

In CSS geht das mit `linear()` als Näherung, in JS über die
Web-Animations-API mit fortlaufender Geschwindigkeit.

**Jede Bewegung muss unterbrechbar sein.** Wer zweimal tippt, darf
nicht zwei Animationen hintereinander bekommen. Im Verzeichnis steht
dafür schon eine Warnung im Quelltext: eine Bewegung, die unter einer
neuen begraben wird, lässt den Gegenstand dauerhaft herangezoomt.

## 5 · Maße, die es echt aussehen lassen

- **Nicht aus dem Nichts skalieren.** `scale(.96)` → `1`, nicht
  `scale(0)`. Etwas, das aus einem Punkt wächst, gibt es nirgends.
- **Kurze Wege.** 8 bis 24 px reichen. Wer 100 px fliegen lässt,
  bekommt eine Diashow.
- **`transform-origin` dorthin, wo es herkommt.** Ein Menü unter einem
  Knopf wächst aus dem Knopf, nicht aus seiner Mitte.
- **Versatz nur bei wenigen Dingen.** Drei bis fünf Elemente gestaffelt
  mit 30–50 ms wirkt lebendig; zwanzig wirken langsam.
- **Tiefe kommt aus zwei Dingen gleichzeitig:** Skalierung *und*
  Schatten. Nur eines davon sieht flach aus.

## 6 · Ein Schatten liegt unter dem Ding, nicht davor

> **Vorfall.** Im 3D-Modell auf der Landingpage steht
> `.tischschatten` als **späteres Geschwisterelement** hinter dem
> Gegenstand im Auszeichnungstext. Beide sind eigene Stapelkontexte
> (`perspective` beim einen, `transform` beim anderen), beide ohne
> `z-index`. Dann entscheidet die Reihenfolge im Dokument — und der
> Schatten malt **über** das Modell. Beim Antippen fährt der Gegenstand
> heran, reicht weiter nach unten, und der Fehler wird sichtbar.

Bei allem mit `perspective`, `preserve-3d` oder `transform`:

- **Reihenfolge im Dokument ist die Voreinstellung**, nicht die
  optische Tiefe. Wer eine andere Tiefe will, sagt es mit `z-index` —
  und dann an **beiden** Elementen, nicht nur an einem.
- `transform` erzeugt einen Stapelkontext. Ein Kind darf danach nie
  mehr über ein Geschwisterelement des Elternteils.
- **Gemessen wird mit `elementFromPoint`**, nicht angesehen: Was liegt
  an dieser Stelle wirklich obenauf?

## 7 · `prefers-reduced-motion` ist keine Kür

Es gibt Menschen, denen von Bewegung schlecht wird. Jede Datei bekommt
den Block, und er wird **geprüft**, nicht angenommen:

```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{
    animation-duration:.01ms !important;animation-iteration-count:1 !important;
    transition-duration:.01ms !important;scroll-behavior:auto !important}
}
```

Wichtig: Der Endzustand muss **richtig** sein. Wer eine Einblendung nur
abschaltet, hinterlässt ein unsichtbares Element — dieselbe Falle wie
`[hidden]` ohne Gegenregel (CLAUDE.md §8.1).

## 8 · Die zwei Regeln aus diesem Projekt

**§4.1 — Einflug nur an neue Elemente.** Ein Feld, das alle vier
Sekunden per `innerHTML` neu gebaut wird, besteht danach aus lauter
neuen Elementen. Trägt die Klasse eine Einflug-Animation, fliegt alles
erneut ein. Das war das „Wackeln" im Küchendisplay. Animation gehört an
eine Klasse, die nur wirklich Neues trägt.

**§4.2 — Nicht neu zeichnen, wenn sich nichts geändert hat.** Signatur
aus den Feldern bilden, die zählen — **ohne Uhrzeit**. Laufende Zeiten
am bestehenden Element nachziehen. Während einer Geste gar nicht neu
zeichnen.

## 9 · Gemessen, nicht angesehen

Eine Animation, die man nur angeschaut hat, ist eine Behauptung.

```js
/* Bilder pro Sekunde über die Dauer der Bewegung */
let n = 0, t0 = performance.now();
(function z(){ n++; if(performance.now() - t0 < 1000) requestAnimationFrame(z);
               else console.log(n + " Bilder"); })();
```

Im kopflosen Browser dazu:

- **Liegt am Ende das Richtige obenauf?** `elementFromPoint`.
- **Steht der Endzustand?** Nach der Dauer + Puffer den berechneten
  Stil ablesen, nicht den gesetzten.
- **Ohne Bewegung auch?** Mit
  `page.emulateMedia({ reducedMotion:"reduce" })` gegenprüfen — die
  Seite muss vollständig benutzbar sein.
- **`html{scroll-behavior:smooth}` verfälscht jede Messung am Scroll.**
  Im Test überschreiben, sonst misst man die Mitte der Bewegung.

Für die Landingpage macht `pruefungen/pruef-web.js` einen Teil davon
schon. Was dort fehlt, gehört ergänzt — mit Gegenbeweis
(`.claude/skills/gegenbeweis`).
