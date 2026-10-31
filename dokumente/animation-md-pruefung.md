# Prüfung der „High-End Food Web App Vector Animations“-MD · Stand 31.10.2026

> **Was dieses Dokument ist.** Die Beurteilung einer KI-erzeugten Anleitung (Burger-Loader-Blueprint, SVG + CSS)
> gegen das, was in diesem Projekt gemessen wurde. Jede Aussage unten ist an einer Szene gemessen, nicht
> behauptet. Die MD selbst liegt **nicht** im Verzeichnis (`animation-instructions.md` existiert nicht); sie
> wurde nur im Chat mitgegeben. Beurteilt ist ihr Inhalt, wie er dort stand.

## Ergebnis in einem Satz

Als **Grundgerüst** taugt sie (Ebenen zerlegen, Anlauf vor der Bewegung, Überschwung, Nachwippen, nur
`transform`/`opacity`) — das deckt sich mit dem Skill `bewegung` und dem vorhandenen Block
`WILLKOMMEN-SZENEN`. **Als Anleitung für dieses Projekt reicht sie nicht**, weil sie fünf Dinge nicht kennt,
die hier schon einmal schiefgegangen sind.

## Was trägt

| Punkt der MD | Befund |
|---|---|
| Ebenen einzeln bewegen (Teig, Belag, Dampf getrennt) | trägt; in `pizza` sind Wurf, Schieber, Schatten, Mehl, Dampf, Tomate, Basilikum je eine eigene Bewegung |
| Anlauf, Überschwung, Nachwippen | trägt; Wurf der Pizza: Stauchung 9 %, Absprung 15 %, Gipfel 46 %, Landung 74 %, Stoß 79 %, Nachwippen 88 % |
| nur `transform` und `opacity` | trägt; `pruef-willkommen-szenen.js` liest jede laufende Animation aus dem Browser (`getKeyframes`) |
| Easing je Segment statt einer Kurve für alles | trägt; im Wurf wechselt die Kurve an jedem Schlüsselbild |

## Was fehlt (die fünf Lücken)

1. **Drehpunkt.** Ohne `transform-box` dreht ein SVG-Teil um die Ecke des ganzen Bildes. Im Projekt gilt die
   Grundregel `.wz > svg *{transform-box:fill-box;transform-origin:50% 50%}`; liegt der Drehpunkt außerhalb
   des Teils (Schieber, Stäbchen), steht er ausdrücklich mit `transform-box:view-box` und Pixelpunkt. Die
   Prüfung misst ihn: Die Pizza steigt auf dem Gipfel (540°, Maßstab 1,18) um genau 44 Einheiten und seitlich
   um 0 (`dx 0, dy −44`); die offene Tür des Kuriers behält ihre Scharnierkante (Abweichung 0,00002 px).
   **Fallstrick:** 720° wären die Identität und würden einen falschen Ursprung verstecken — die Probe misst
   bei 540°.
2. **Schleifen ohne Naht.** Ein Band, das „einfach weiterläuft“, springt, wenn die Verschiebung nicht genau
   eine Periode ist. Das Sushi-Band besteht aus zwei Sätzen à 200 Einheiten und läuft um genau −200; die
   Prüfung vergleicht die Verschiebung mit der Lage der Kinder (`passt:true`) — auch für die drei Ebenen der
   Szene „Lieferung“. Versetzte Starts (Stagger) per `animation-delay` sind in Endlosschleifen nur bei
   **gleicher Dauer** unbedenklich; bei verschiedenen Dauern laufen die Teile auseinander.
3. **Feste Farben.** Eine feste Palette verletzt CLAUDE.md §5.1/§5.2: Der Hub hat Häuser mit hellem und mit
   dunklem Grund. Die Szenen nehmen nur die Rollen des Hauses (`.t .a .g .f .n`, `--_*`). **Gefunden beim
   Ansehen der Bilder, nicht von der Prüfung:** Die Rolle `.f` (Fläche) wird abends dunkel — der Käse wurde zum
   schwarzen Fleck, der Schieber zur schwarzen Pfanne, die Sojasauce (`.t`) weiß. Behoben mit Gold bzw. Tinte
   bei geringer Deckkraft und einer dunklen Mischfarbe für die Sauce. Die Kontrastprüfung am gemalten Bild
   bestand schon vorher: Name und Gruß waren lesbar, **die Zeichnung sah trotzdem falsch aus.** Kontrast
   misst Schrift, nicht, ob ein Käse wie Käse aussieht.
4. **Reduzierte Bewegung und Vorleser.** Die MD nennt weder `prefers-reduced-motion` noch `aria-hidden`.
   Hier steht jede Szene bei reduzierter Bewegung still in ihrem schönsten Bild (Tür offen, Paket im Flur,
   Herz da; Nigiri auf dem Teller, Stäbchen am Reis) und hat `aria-hidden="true"`.
5. **Namensraum und Prüfliste.** Zwei Klassen mit gleichem Namen in einem geteilten Block zerstören still das
   Bild (CLAUDE.md §1.1). Alle neuen Klassen tragen Präfixe (`pz-`, `su-`, `ku-`, `wz-pz-`, …), vorher per
   `grep` gegen Hub, Board und Studio geprüft (0 Treffer). Dazu gehört auch die Frage, die die MD nicht
   stellt: *Wird die Vorlage von einem Prüfer gesehen, der nicht weiß, dass es sie gibt?* Hier: Die
   Szenen-Prüfung liest `WZ_ARTEN` aus dem Hub, neue Szenen werden ohne Änderung mitgemessen.

## Was die Prüfung beim ersten Lauf selbst gefunden hat

- `pruef-bewegung` lehnte `linear` an `wzSuBand` und `wzKuVorbei` ab. Beides sind Bewegungen ohne Anfang
  und Ende (Band, vorbeiziehende Lichter); sie stehen jetzt **namentlich** in `GLEICHFOERMIG`, nicht per Muster.

## „Liefer-Scooter“ gab es schon

Die Szene `lieferung` (Roller mit Wheelie, drei Häuserschichten) zeigt die **Fahrt**. Eine zweite Fahrt-Szene
hätte genau den Fehler vom 24.10. wiederholt („zu einheitlich“). Der neue **Kurier** zeigt deshalb eine andere
Bildidee: den Roller **stehend**, die **Übergabe** an der Haustür.

## Ehrliche Grenzen

- Kopfloses Chromium, **kein Gerät**: Bilder pro Sekunde sind nicht gemessen; die Szenen laufen mit
  `transform`/`opacity`, ob sie auf einem alten Telefon flüssig bleiben, zeigt nur ein Gerät.
- Die Zeichnungen sind **eigene Nachbauten** nach Beschreibung, keine Referenz-Assets. „Wie aus einem
  Animationsstudio“ lässt sich nicht messen; gemessen sind nur die Regeln (Handwerk, Maße, Kontrast,
  Naht, Drehpunkt).
- Die MD wurde nur aus dem Chat beurteilt. Was in einer Fassung der Datei steht, die ich nicht gesehen habe,
  ist nicht beurteilt.
- Die Prüfung der Bildlücken (`pruef-auswertung`, Figuren-Rad) ist **vorbestehend unzuverlässig**: am Stand vor
  dieser Sitzung (`0b321bb`) in 1 von 2 Läufen rot (70 ms statt ≤ 50), am neuen Stand in 2 von 2 (65 und
  114 ms). Nicht Teil dieser Änderung, nicht behoben.
