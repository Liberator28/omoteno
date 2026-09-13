/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Kopfband-Schmuck (Guss / Laternen)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-kopfband.js

   Auftrag: Der Schokoladenguss unter dem Kopfband passt zu keinem
   Haus, das keine Schokolade verkauft. minhkeey (Asia Streetfood)
   bekommt stattdessen eine Reihe Papierlaternen — auf Wunsch, ohne
   Farbe zu erfinden (--gold = akzent2 des Hauses).

   Beide Bänder stehen fertig im Auszeichnungstext jedes Hubs; welches
   sichtbar ist, entscheidet kopfbandSetzen() zur Laufzeit anhand
   MARKENBLATT.kopfband — "laternen" schaltet um, alles andere
   (auch ein fehlendes Feld) bleibt beim Guss. Genau das wird hier
   gemessen, nicht angenommen.

   Gegenbeweis gefahren: markenblaetter/minhkeey.json testweise auf
   kopfband:"guss" gesetzt, neu erzeugt — die Prüfung wurde an genau
   den beiden Zusicherungen für minhkeey rot. Zurückgenommen → grün.
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

  for (const [haus, erwartetGuss, erwartetLaternen] of [
    ["chocolamour", false, true],
    ["blend", false, true],
    ["minhkeey", true, false],
  ]) {
    const seite = await (await browser.newContext()).newPage();
    const konsole = [];
    seite.on("pageerror", e => konsole.push(String(e)));
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + path.join(DIST, haus, "index.html"));
    await seite.waitForTimeout(300);

    const zustand = await seite.evaluate(() => ({
      gussVerborgen: document.querySelector(".guss").hasAttribute("hidden"),
      laternenVerborgen: document.querySelector(".laternen").hasAttribute("hidden"),
      laternenAnzahl: document.querySelectorAll(".laternen .laterne").length,
    }));
    pruef(zustand.gussVerborgen === erwartetGuss,
      haus + ": .guss hidden=" + zustand.gussVerborgen, "erwartet " + erwartetGuss);
    pruef(zustand.laternenVerborgen === erwartetLaternen,
      haus + ": .laternen hidden=" + zustand.laternenVerborgen, "erwartet " + erwartetLaternen);
    if (haus === "minhkeey")
      pruef(zustand.laternenAnzahl === 7, "minhkeey: sieben Laternen gezeichnet", zustand.laternenAnzahl);
    pruef(konsole.length === 0, haus + ": keine Ausnahme in der Konsole", konsole.join(" | ") || "still");
    await seite.close();
  }

  /* Reduzierte Bewegung: die Laternen müssen sofort im Endzustand
     stehen (opacity 1, kein translateY) statt auf eine Animation zu
     warten, die nie läuft — dieselbe Falle wie beim Guss. */
  const seiteRuhig = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
  await seiteRuhig.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seiteRuhig.goto("file://" + path.join(DIST, "minhkeey", "index.html"));
  await seiteRuhig.waitForTimeout(150);
  const ruhig = await seiteRuhig.evaluate(() => {
    const el = document.querySelector(".laternen .laterne");
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, transform: cs.transform };
  });
  pruef(ruhig.opacity === "1", "reduzierte Bewegung: Laterne sofort sichtbar", ruhig.opacity);
  pruef(ruhig.transform === "none", "reduzierte Bewegung: keine Transform-Reste", ruhig.transform);
  await seiteRuhig.close();

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
