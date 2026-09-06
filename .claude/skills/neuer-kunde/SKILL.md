---
name: neuer-kunde
description: Ein Restaurant neu aufnehmen — Markenblatt, Hub erzeugen, Adresse (CNAME, Netlify-Alias, _redirects mit Ausrufezeichen), Kontraste rechnen, Auslieferung prüfen. Greift, sobald ein weiterer Betrieb einen eigenen Hub oder eine eigene Adresse bekommen soll, und auch, wenn nur die Palette oder Adresse eines bestehenden Kunden geändert wird.
---

# Einen Kunden aufnehmen

Der Ablauf, bei dem hier zweimal etwas schiefging: einmal die
fehlende Bindestrich-Zeile, einmal die fehlenden Ausrufezeichen.
Beide Male sah der Gast die Landingpage statt seines Hubs.

## 1 · Markenblatt

`markenblaetter/<slug>.json` nach dem Vorbild von `blend.json`
(schlicht) oder `chocolamour.json` (mit gezeichnetem Siegel).
`dokumente/markenblatt.md` erklärt jedes Feld.

**Der Slug hängt an `betriebe.slug` in der Datenbank.** Er muss nicht
wie die Adresse heißen — die Adresse ist links in `_redirects`, der
Slug rechts.

## 2 · Erzeugen — und mindestens zweimal

```bash
node erzeuger/erzeuge-hub.js --alle --pruefen-nur
node erzeuger/erzeuge-hub.js --alle
```

`--alle`, nicht nur den neuen. Was mehrfach erzeugt wird, muss
mehrfach erzeugt und **verglichen** werden — sonst sieht ein Test mit
einem Kunden jede eingebrannte Fremdangabe für richtig an (§8.1a).

Gegenhalten, dass nichts vom Nachbarn im neuen Hub steht:

```bash
grep -c "Choco" dist/<slug>/index.html      # muss 0 sein
grep -o "<title>[^<]*" dist/<slug>/index.html
md5sum dist/*/index.html                    # die anderen unverändert
```

## 3 · Die Adresse — drei Dinge, nicht eins

Fehlt eines davon, kommt die Anfrage gar nicht erst bei Netlify
vorbei oder läuft ins Leere:

| | Wo | Was |
|---|---|---|
| 1 | Domain-Anbieter | `CNAME` für `<adresse>` → `<projekt>.netlify.app` |
| 2 | Netlify | *Domain management → Add domain alias* |
| 3 | `auslieferung/_redirects` | die vier Zeilen unten |

```
https://<adresse>/admin*   https://omoteno.de/admin    301!
https://<adresse>/kueche*  https://omoteno.de/kueche   301!
https://<adresse>/konto*   https://omoteno.de/konto    301!
https://<adresse>/*        /h/<slug>/:splat            200!
```

**Das Ausrufezeichen ist Pflicht.** Netlify bedient in dieser
Reihenfolge: erzwungene Umleitung → **vorhandene Datei** → nicht
erzwungene Umleitung. Der veröffentlichte Ordner ist flach, dort
liegen `index.html`, `admin.html`, `konto.html`. Ohne `!` liefert
`<adresse>/index.html` also Omotenos Landingpage aus.

**Die drei Wirt-Zeilen stehen vor der Hub-Zeile**, sonst schluckt die
den Pfad. 301 statt 200, weil Supabase den Rücksprung nach der
Anmeldung nur auf Adressen aus seiner Allowlist zulässt.

Gibt es die Adresse in einer zweiten Schreibweise, bekommt die alte
eine `301!` auf die echte — nicht denselben Hub zweimal ausliefern.

## 4 · Farben rechnen, nicht ansehen

Der Kunde wählt den Grund, der Gast braucht Lesbarkeit. Schriftfarbe
wird aus der Helligkeit **hergeleitet**, nie fest gesetzt (§5.1) —
eine feste Farbe im Hub ist immer falsch.

```bash
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-kontrast.js
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-lesbarkeit.js
```

Alle Paare, **Tag und Abend**, Grenze 4,5:1. Weiß auf hellem Grün gab
schon einmal 1,16:1.

## 5 · Auslieferung prüfen

```bash
node erzeuger/bauen.js
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-lieferung.js
```

Die Prüfung leitet ihre Wahrheit aus den erzeugten Hubs ab, nicht aus
den Zeilen in `_redirects` — sie merkt also, wenn ein Kunde **keine**
Adresse hat. Was sie nicht wissen kann: ob CNAME und Netlify-Alias
wirklich eingetragen sind. Das steht nirgends im Verzeichnis, und
diese Grenze gehört in den Bericht.

## 6 · Der Weg des Gastes

```bash
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-durchgang.js
NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-hub-hand.js <slug>
```

Mit dem **neuen** Slug, nicht mit dem alten. Wer nur Bausteine prüft,
findet keine Fehler zwischen den Bausteinen.

## 7 · Datenbank

Der Betrieb braucht eine Zeile in `betriebe` mit demselben `slug`,
sonst findet der Hub seine Karte nicht. Tischcodes und Untersetzer
danach über das Board.
