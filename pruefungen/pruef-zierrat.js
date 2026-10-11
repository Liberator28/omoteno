/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Zierrat "tusche" (Bambus im Kopf, Tuschekleckse, Pfingstrosen-
   Knospe vor jeder Abschnittsüberschrift)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-zierrat.js

   Auftrag: Auf Wunsch sollte minhkeey mehr wie die zwei Referenzbilder
   aussehen (Pfingstrosen, Bambus, Tuschespritzer, warmes Papier) —
   als wählbarer Stil gebaut (MARKENBLATT.zierrat==="tusche"), nicht
   fest an ein Haus gebunden, damit später jedes andere Haus ihn auch
   einschalten kann. Bild 1 trug Wasserzeichen-Merkmale einer
   Marktplatz-Vorschau (Platzhaltertext, Stempel) — auf Nutzerwunsch
   deshalb als eigene, unbedenkliche SVG-Zeichnung gebaut statt direkt
   aus dem Bild zugeschnitten.

   Drei Teile, ein einziger Schalter (body[data-zierrat="tusche"],
   gesetzt von zierratSetzen() im Skript):
     - .bambus-kopf   Bambuszweig in der oberen rechten Kopfband-Ecke
     - .raum-tusche   vier Tuschekleckse statt der acht Farbwolken
     - .bereich::before  Pfingstrosen-Knospe vor JEDER Abschnitts-
       überschrift — automatisch auf jeder Seite, die .bereich benutzt,
       ohne dass eine von ihnen selbst etwas dafür wissen muss.

   Vorfall beim Bauen: Der Bambuszweig stand zunächst bei right:-8px
   — 8px JENSEITS der Bildschirmkante, die das Kopfband durch seinen
   eigenen negativen Rand schon erreicht. Gemessen bei 420px Breite:
   document.documentElement.scrollWidth=428 statt 420 — echtes
   horizontales Überlaufen. Behoben auf right:0. Das wird hier für
   mehrere Breiten gemessen, nicht nur angesehen.

   Gegenbeweis gefahren: right:0 testweise wieder auf right:-8px
   gesetzt → die Überlauf-Zusicherung wurde bei 420px rot
   (scrollWidth 428 statt 420). Zurückgenommen → grün.
   Ebenso für den Haus-Schalter: MARKENBLATT.zierrat in minhkeey.json
   testweise entfernt, neu erzeugt → alle drei Zusicherungen für
   minhkeey (Bambus/Kleckse/Knospe sichtbar) wurden rot. Zurückgenommen
   → grün.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

(async () => {
  const browser = await chromium.launch();

  /* 1 · minhkeey: alle drei Teile sichtbar, Farbwolken ersetzt */
  {
    const seite = await (await browser.newContext()).newPage();
    const konsole = [];
    seite.on("pageerror", e => konsole.push(String(e)));
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + path.join(DIST, "minhkeey", "index.html"));
    await seite.waitForTimeout(300);
    await seite.click("body");
    await seite.waitForTimeout(800);

    const info = await seite.evaluate(() => {
      const bereich = document.querySelector(".bereich");
      return {
        zierrat: document.body.dataset.zierrat,
        bambusDisplay: getComputedStyle(document.querySelector(".bambus-kopf")).display,
        raumTuscheDisplay: getComputedStyle(document.querySelector(".raum-tusche")).display,
        raumDisplay: getComputedStyle(document.querySelector(".raum")).display,
        bereichVorher: bereich ? getComputedStyle(bereich, "::before").backgroundImage : "kein .bereich",
      };
    });
    pruef(info.zierrat === "tusche", "minhkeey: body trägt data-zierrat=tusche", info.zierrat);
    pruef(info.bambusDisplay === "block", "minhkeey: Bambuszweig sichtbar", info.bambusDisplay);
    pruef(info.raumTuscheDisplay === "block", "minhkeey: Tuschekleckse sichtbar", info.raumTuscheDisplay);
    pruef(info.raumDisplay === "none", "minhkeey: Farbwolken ersetzt (verborgen)", info.raumDisplay);
    pruef(info.bereichVorher.includes("data:image/svg+xml"),
      "minhkeey: Pfingstrosen-Knospe vor der Abschnittsüberschrift", info.bereichVorher.slice(0, 40));
    pruef(konsole.length === 0, "minhkeey: keine Ausnahme in der Konsole", konsole.join(" | ") || "still");
    await seite.close();
  }

  /* 2 · Choco und Blend: kein Leck — nichts davon aktiv, Farbwolken
     laufen unverändert weiter (§8.1a: geteilte Vorlage, jedes andere
     Haus muss den Zierrat NICHT sehen, solange es ihn nicht wählt). */
  for (const haus of ["chocolamour", "blend"]) {
    const seite = await (await browser.newContext()).newPage();
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + path.join(DIST, haus, "index.html"));
    await seite.waitForTimeout(300);
    await seite.click("body");
    await seite.waitForTimeout(800);
    const info = await seite.evaluate(() => {
      const bereich = document.querySelector(".bereich");
      return {
        zierrat: document.body.dataset.zierrat || null,
        bambusDisplay: getComputedStyle(document.querySelector(".bambus-kopf")).display,
        raumDisplay: getComputedStyle(document.querySelector(".raum")).display,
        bereichVorher: bereich ? getComputedStyle(bereich, "::before").backgroundImage : "kein .bereich",
      };
    });
    pruef(info.zierrat === null, haus + ": kein data-zierrat", info.zierrat);
    pruef(info.bambusDisplay === "none", haus + ": Bambuszweig verborgen", info.bambusDisplay);
    pruef(info.raumDisplay === "block", haus + ": Farbwolken laufen unverändert", info.raumDisplay);
    pruef(info.bereichVorher === "none", haus + ": keine Pfingstrosen-Knospe", info.bereichVorher);
    await seite.close();
  }

  /* 3 · Kein horizontales Überlaufen bei mehreren Breiten — genau der
     Fehler, der beim Bauen tatsächlich passiert ist (right:-8px lag
     jenseits der Kante, die das Kopfband selbst schon erreicht). */
  for (const breite of [360, 390, 420, 540, 768]) {
    const seite = await (await browser.newContext({ viewport: { width: breite, height: 900 } })).newPage();
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + path.join(DIST, "minhkeey", "index.html"));
    await seite.waitForTimeout(300);
    await seite.click("body");
    await seite.waitForTimeout(800);
    const masse = await seite.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    pruef(masse.scrollWidth === masse.clientWidth,
      "minhkeey " + breite + "px: kein horizontales Überlaufen",
      "scrollWidth=" + masse.scrollWidth + " clientWidth=" + masse.clientWidth);
    await seite.close();
  }

  /* 4 · Tag/Abend: die Tusche-Farben sind eigene, feste Werte je
     Phase (nicht aus der Marke hergeleitet, §5.3) — hier wird
     geprüft, dass beide Sätze tatsächlich unterschiedlich sind. */
  {
    const seite = await (await browser.newContext()).newPage();
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + path.join(DIST, "minhkeey", "index.html"));
    await seite.waitForTimeout(300);
    await seite.click("body");
    await seite.waitForTimeout(800);
    /* NICHT die Uhrzeit der Maschine als "Start ist Tag" annehmen, und
       auch nicht "zwei Klicks sind immer Abend": Der Lichtknopf zyklt
       automatisch → hell → dunkel → automatisch (siehe Handler im
       Gerüst), und "automatisch" löst sich nach der Systemstunde auf.
       Seit minhkeey abend.an=true trägt (Thema "kaiserlich"), kann
       JEDER Punkt im Zyklus, an dem "automatisch" ansteht, sich als
       Abend zeigen — gemessen: Sandbox stand auf 01:09 Uhr UTC, mitten
       in markeGrundlegen()s "< 5"-Fenster. Ein fester Klickzähler
       (2× für Abend, 1× mehr für Tag) traf deshalb beim dritten Klick
       wieder auf "automatisch" → "abend", nicht auf "hell". Robust ist
       nur: klicken, bis data-phase wirklich die gesuchte Phase zeigt —
       höchstens dreimal, mehr Zustände hat der Zyklus nicht. */
    /* Seit 11.10. öffnet der Knopf eine Liste — gewählt wird die
       Stufe, die die Phase festlegt (Hell → Tag, Dunkel → Abend), über
       den echten Tipp. Unabhängig von der Uhr der Sandbox. */
    async function phaseErzwingen(gesucht){
      await seite.click("#lichtknopf");
      await seite.waitForTimeout(300);
      await seite.click('#lichtliste [data-licht="' + (gesucht === "abend" ? "dunkel" : "hell") + '"]');
      await seite.waitForTimeout(500);
      return seite.evaluate(() => document.body.dataset.phase);
    }
    const abendPhase = await phaseErzwingen("abend");
    const abendKiefer = await seite.evaluate(() => getComputedStyle(document.body).getPropertyValue("--tusche-kiefer").trim());
    pruef(abendPhase === "abend", "minhkeey: der Lichtknopf erreicht die Abendphase", abendPhase);

    const tagPhase = await phaseErzwingen("tag");
    const tagKiefer = await seite.evaluate(() => getComputedStyle(document.body).getPropertyValue("--tusche-kiefer").trim());
    pruef(tagPhase === "tag", "minhkeey: der Lichtknopf erreicht die Tagphase", tagPhase);

    pruef(tagKiefer !== abendKiefer,
      "minhkeey: Bambusfarbe unterscheidet sich Tag/Abend",
      "tag=" + tagKiefer + " abend=" + abendKiefer);
    await seite.close();
  }

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
