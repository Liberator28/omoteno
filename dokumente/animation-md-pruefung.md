# Animationen: Prüfung der KI-MD und Neuaufbau nach Subframe Motion · Stand 31.10.2026

> **Was dieses Dokument ist.** Zwei Runden an einem Tag. Zuerst wurde eine KI-erzeugte Anleitung
> („High-End Food Web App Vector Animations“, Burger-Loader-Blueprint, nur im Chat, **nicht** im Verzeichnis)
> gegen das Projekt gehalten und daraus die Szenen Pizza, Sushi und Kurier gebaut. Danach wünschte der Nutzer:
> „Benutze Subframe Motion … ich finde sie vom Aufbau unlogisch und visuell zu billig … sharper, cleaner,
> smoother … Animationen, die einladen, etwas zu essen“. Daraufhin wurden **alle acht** Willkommen-Szenen nach den
> Regeln des Subframe-Motion-Dienstes neu aufgebaut. Jede Aussage hier ist gemessen, nicht behauptet.

## 1 · Ergebnis

| | vorher (Schleife) | jetzt (Subframe-Regeln) |
|---|---|---|
| Ablauf | jede Szene lief endlos (Pizza flog alle 3,6 s, Stäbchen legten das Nigiri wieder zurück) | **einmal erzählen, dann ruhen**: ≤ 3,5 s Auftritt, danach steht das appetitlichste Bild |
| Dauer | unendlich — verstößt gegen WCAG 2.2.2 (über 5 s ohne Pause) | **jede Animation endet vor 5 s** (gemessen 4,2–4,9 s je Szene) |
| Endbild | zufälliger Zeitpunkt der Schleife | **Grundzustand = Endbild = Bild bei reduzierter Bewegung** (Keyframes nur für den Weg hinein) |
| Szenenhülle | Maßstab .74 + `filter:blur` + Überschwung *zusätzlich* zur Szene | ruhiges Erscheinen (`scale(.97)`, 0,45 s); die Teile erzählen selbst |
| Bewegungssprache | je Szene eigene Kurven | `--wz-aus` (Abbremsen) für Auftritte, `--wz-feder` (Überschwung ≤ 0,25) nur für Essen, das landet, `--wz-gleit` für Wege; `.rein`/`.fall` mit `--t0` |
| Logik | — | Räder rollen genau so weit, wie der Roller fährt; Tomate rollt so weit, wie sie sich dreht; Glocke hebt sich **einmal**; Tür geht auf und **bleibt** auf; Nigiri wird dem Gast entgegengehoben, der Teller bleibt leer |

Die Szenen im Einzelnen: **Figur** hüpft herein und landet; **Café** Untertasse, Tasse, Kaffee füllt sich, Milch,
Herz, Löffel, Zucker; **Tisch** Glocke hebt sich, das Licht geht an, Dampf, Gläser klirren; **Küche** Pfanne und Topf,
Flammen, EIN Wurf zurück in die Pfanne, Deckel klappert; **Lieferung** Roller fährt vor und bremst (Nicken), Staub,
Herz; **Pizza** Teig landet mit Drehung, Soße, Käse, Salami, Basilikum, Glut leuchtet beim Landen; **Sushi** Band läuft
ein und hält, Stäbchen greifen, tauchen in die Soja, heben das Nigiri an; **Kurier** Bote kommt, klingelt, Tür auf,
Licht an, Paket in den Flur, Hüpfer.

## 2 · Die KI-MD — was trägt, was fehlt

**Trägt:** Ebenen einzeln bewegen, Anlauf/Überschwung/Nachwippen, nur `transform`/`opacity`, Kurve je Abschnitt.

**Fehlt (gemessen):**
1. **Drehpunkt** — ohne `transform-box` dreht ein SVG-Teil um die Bildecke. Probe: Der Teig dreht beim Landen um
   seine eigene Mitte (seitlich 0 px zu drei Zeitpunkten); B5 (Ursprung Bildmitte) wird rot.
2. **Schleifen und Staffelung** — eine Endlosschleife braucht genaue Perioden; besser gar keine (WCAG 2.2.2).
3. **Feste Farben** — verletzt §5.1. Aber auch die *Rollen* des Hauses reichen nicht für alles: **Vorfall J**
   (CLAUDE.md §8.1g) — Käse, Kaffee und Sojasauce kippten abends, weil ihre Rollen die Helligkeit wechseln; die
   Kontrastprüfung war grün. Sachfarben (Kaffee dunkel, Milch/Mehl hell, Soja dunkel) als Mischung aus Hausfarbe und
   festem Ton.
4. **Reduzierte Bewegung, Vorleser** — fehlt in der MD; hier ist das Endbild der Grundzustand, die Szene trägt
   `aria-hidden`.
5. **Namensraum und Prüfprotokoll** — Präfixe `pz-`, `su-`, `ku-`, `wz-pz-` …, vorher per `grep` in Hub, Board und
   Studio gesucht (0 Treffer).

**Subframe-Leitlinien, die den Ausschlag gaben:** Bewegung beantwortet eine Frage, sonst weg; seltene Momente
(Erstbesuch) dürfen ausdrucksstark sein; Dauer-Bewegung über 5 s braucht eine Pause oder hört nach wenigen Durchläufen
auf; Staffelung 20–60 ms; Ausgänge schneller als Eingänge; unter reduzierter Bewegung ein ruhiges Standbild. Die
Bibliothek besteht aus React-Beispielen; übernommen wurden Werte und Mechanik, umgesetzt als CSS/Web Animations
(keine neue Bibliothek im Hub).

## 3 · Prüfung (`pruefungen/pruef-willkommen-szenen.js`, 213 Proben)

Neu in Abschnitt 10: (a) jede Animation in der Szene endlich und vor 5 s vorbei, (b) Endbild nach `finish()` = Bild
bei reduzierter Bewegung (jedes Teil an Ort und Sichtbarkeit), (c) Räder ohne Rutschen, (d) Drehpunkt Teig, (e) Tür
am Scharnier, (f) Nigiri-Wechsel deckungsgleich. Dazu angepasst: Namensvergleich zählt auch beendete Animationen;
neun Szenen aus `WZ_ARTEN` (keine Zahl in der Prüfung). Nachbarprüfungen grün: `pruef-bewegung`, `-leistung`,
`-willkommen-knoepfe`, `-vorfenster`, `-figur`, `-uebersetzung`, `-farben`, `-kompakt`, `-sprache`, `-zentrale`,
`-figur-board`, `-lesbarkeit`, `-durchgang`.

**Gegenbeweise B1–B10** (Kopie des Verzeichnisses, Sabotage in Hub UND Board, Treffer gezählt): siehe Abschnitt 5.

**Eigene Fehler dieser Runde:**
- Erste Gegenbeweis-Runde (A1/A2) sabotierte nur die Vorlage → Block ungleich → rot aus dem falschen Grund
  (Vorfall K b).
- Probe „Nigiri-Wechsel“ stellte nur fünf Animationen auf den Zeitpunkt → 5,6 px Scheinabweichung (Vorfall K a).
- Kaffee/Käse/Mehl/Soja mit Rollenfarben, die abends kippen (Vorfall J) — gefunden am gerenderten Bild.

## 4 · Ehrliche Grenzen

- Kopfloses Chromium, **kein Gerät**: Bilder pro Sekunde auf einem echten Telefon nicht gemessen.
- „Appetitlich“ und „Studio-Qualität“ sind nicht messbar; gemessen sind die Regeln. Die Zeichnungen sind eigene
  Nachbauten, keine Referenz-Assets.
- Die MD wurde nur aus dem Chat beurteilt.

## 5 · Ergebnis der Gegenbeweise

Kopie des Verzeichnisses je Sabotage, Sabotage in Hub **und** Board (B8 absichtlich nur im Board), Treffer gezählt,
gezielte Meldung gezählt.

| Nr | Sabotage | Ergebnis |
|---|---|---|
| B1 | Flamme flackert endlos | ROT — „tisch: nichts läuft endlos … endlos: wzFlackern“ |
| B2 | Figur atmet bis 7,6 s | ROT — „zu spät: wzFigurAtmen 7600“ |
| B3 | Tür endet halb offen | ROT — Endbild ≠ Ruhebild, Tür 15 statt 4,8 px breit |
| B4 | Räder drehen 400° statt 661° | ROT — Räder rutschen |
| B5 | Teig dreht um die Bildmitte | ROT — seitlich 20–27 px |
| B6 | Tür dreht um die Mitte | ROT — linke Kante 12,6 px verschoben |
| B7 | Nigiri verschwindet zu früh | ROT — Wechsel nicht deckungsgleich |
| B8 | Board kennt Kurier nicht | ROT — Block ungleich, Kacheln ≠ WZ_ARTEN |
| B9 | Auftritt animiert `filter` | ROT — „fremd: filter“ in 4 Szenen |
| B10 | Roller fährt linear, Rad mit Kurve | **erst GRÜN** — die Probe verglich `getComputedTiming().easing`, das bei CSS-Animationen immer „linear“ ist (die Kurve steht im Keyframe). Probe korrigiert (Kurve aus `getKeyframes()[0].easing`), volle Prüfung danach grün (213 Proben); **Wiederholung B10: ROT** (gezielte Meldung 1×) |
| G1 | Begleiter: Regel für schmale Telefone entfernt (`pruef-texte`) | ROT — 6 Meldungen „Begleitersatz …“ |
