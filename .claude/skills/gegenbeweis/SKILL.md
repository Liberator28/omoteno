---
name: gegenbeweis
description: Beweisen, dass eine Prüfung ihren eigenen Anlassfall findet — Korrektur testweise zurücknehmen, Prüfung muss rot werden, Korrektur zurück. Greift, sobald eine neue Prüfung geschrieben, eine bestehende erweitert oder ein Fehler behoben und mit einer Prüfung abgesichert wurde. Vor jeder Meldung „die Prüfung fängt das jetzt".
---

# Gegenbeweis

Eine Prüfung, die immer grün meldet, ist nicht grün — sie ist blind.
Das kostet zwei Minuten und ist der einzige Beleg, der zählt.

## Der Ablauf

1. **Grüner Stand.** Prüfung fahren, echte Ausgabe ansehen. Sie muss
   sauber melden.
2. **Korrektur zurücknehmen.** Genau die eine Zeile, die den Fehler
   behebt — nichts sonst. Notieren, was entfernt wurde.
3. **Prüfung fahren.** Sie **muss** rot werden, und die Meldung muss
   den Anlassfall benennen, nicht irgendetwas.
4. **Korrektur zurück.** `git diff` muss danach leer sein für diese
   Stelle.
5. **Prüfung fahren.** Wieder grün.

Wird sie in Schritt 3 nicht rot, prüft sie nicht das, wofür sie
geschrieben wurde. Dann ist die Prüfung der Fehler, nicht der Code.

```bash
git stash push -- <datei>     # oder gezielt die Zeile ändern
<prüfung fahren>              # muss ROT sein
git stash pop
<prüfung fahren>              # muss GRÜN sein
```

## Die zwei Fallen, an denen es zweimal hing

### Über etwas, das nicht dasteht, iteriert keine Schleife

Eine Prüfung, die eine Liste durchgeht, prüft nur, ob das **Vorhandene**
stimmt. Der Anlassfall war eine **fehlende** Zeile in `_redirects` —
die Schleife lief über die Zeilen, die dastanden, und meldete „alles
sauber", auch nachdem die Zeile wieder entfernt war (§8.1b).

Für „etwas fehlt" braucht es eine **zweite Quelle**, gegen die man
hält: nicht die Regeln zählen, sondern die erzeugten Hubs — jeder
Ordner unter `dist/` ist ein Kunde, und jeder Kunde braucht eine
Adresse.

Frage vor jeder Prüfung: **Woher weiß sie, was da sein müsste?**
Wenn die Antwort „aus der Datei, die sie prüft" ist, findet sie
Fehlendes nie.

### Die Prüfung misst dieselbe kaputte Eigenschaft

`el.hidden = true` auf einem `<svg>` legt still eine JS-Eigenschaft
an, die niemand liest. Meine Prüfung las dieselbe Eigenschaft — und
meldete grün, als es kaputt war, und rot, als es lief (§8.1c).

Gemessen wird, was **zählt**: `hasAttribute("hidden")`,
`getComputedStyle(el).display`, die Breite. Nicht die Zusicherung,
sondern die Wirkung.

## Ein Grenzwert ist eine Lücke, bis er begründet ist

`pruef-lesbarkeit.js` übersprang alles unter 10px als Zierschrift und
ließ dadurch einen antippbaren Link mit 2,83:1 durch (§5.2a).

Wer einen Grenzwert einbaut, schreibt dazu, **was er damit ungesehen
durchlässt** — und prüft, ob das stimmt. Ein Bedienelement ist nie
Zierschrift.

## Berichten

Beide Ausgaben zeigen: die rote aus Schritt 3 und die grüne aus
Schritt 5. Ohne die rote ist es kein Gegenbeweis, sondern eine
Behauptung.
