/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Feste Leisten unten im Hub bei kürzerem Layout-Viewport

     NODE_PATH=$(npm root -g) node pruefungen/pruef-leiste-hub.js

   Vorfall (Bildschirmfoto vom Nutzer, iPhone): Die Hauptnavigation schwebte mitten im Bild, ein geschlossenes Blatt schaute
   darunter heraus. iOS lässt manchmal den Layout-Viewport kürzer als das Sichtbare; „bottom:0“ meint dann die Mitte.
   Nachgestellt wird ein visualViewport, dessen Unterkante 120 px unter dem Layout-Viewport liegt: Hauptnavigation, Auswahl-
   Leiste, Streifen und Blätter müssen um genau 120 px nach unten, sonst bleibt alles stehen (1 px Rundung, Tastatur, Eingabefeld).
   EHRLICHE GRENZE: Der Auslöser auf dem Gerät ist nicht gesehen; geprüft ist die Rechnung und ihre Wirkung auf jede feste Leiste.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OBEN = path.join(__dirname, "..");
const DIST = process.env.DIST || path.join(OBEN, "dist");
let n = 0, f = 0;
function pruef(b, t, d){ n++; if(!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); }
const HAEUSER = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html")));

(async () => {
  const br = await chromium.launch();
  for(const haus of HAEUSER){
    const ctx = await br.newContext({ viewport:{ width:390, height:844 } });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 140)));
    await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
    await p.goto("file://" + path.join(DIST, haus, "index.html") + "#/speisekarte");
    await p.waitForTimeout(1200);
    /* Die festen Dinge, die es in diesem Haus gerade gibt, sichtbar machen: Blatt (geschlossen geparkt), Leisten, Navigation. */
    const gesetzt = await p.evaluate(() => {
      const aus = {};
      const nav = document.getElementById("hauptnav");
      aus.nav = !!nav && !nav.hidden && getComputedStyle(nav).position === "fixed";
      aus.blatt = !!document.querySelector(".warenkarte");
      return aus;
    });
    const stand = () => p.evaluate(() => {
      const unten = s => { const e = document.querySelector(s); if(!e) return null; const cs = getComputedStyle(e); if(cs.position !== "fixed") return null;
        const r0 = e.getBoundingClientRect(); if(!r0.width && !r0.height) return null; const b = r0.bottom; const t = new DOMMatrix(cs.transform).m42; return Math.round(b - (s === ".warenkarte" ? t : 0)); };
      return { vh: document.documentElement.clientHeight, versatz: document.documentElement.style.getPropertyValue("--vv-versatz"),
        nav: unten("#hauptnav"), blatt: unten(".warenkarte"), balken: unten(".auswahlbalken"), strv: unten(".vstreifen"), strw: unten(".wsstreifen") };
    });
    const setze = (h, extra) => p.evaluate(([dy, fokus]) => {
      Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, height:document.documentElement.clientHeight + dy, addEventListener(){} } });
      if(fokus){ const i = document.createElement("input"); document.body.appendChild(i); i.focus(); }
      return leisteAnkern();
    }, [h, !!extra]);

    console.log("\n══ " + haus + " ══");
    pruef(gesetzt.blatt, "Voraussetzung: das Blatt (.warenkarte) gibt es", JSON.stringify(gesetzt));
    const ruhe = await stand();
    await setze(120);
    await p.waitForTimeout(100);
    const kurz = await stand();
    const festeNachher = ["nav", "blatt", "balken", "strv", "strw"].filter(k => ruhe[k] !== null);
    pruef(festeNachher.length >= 1 && festeNachher.every(k => kurz[k] === ruhe[k] + 120), "jede feste Leiste/jedes Blatt rückt um genau 120 px nach unten", JSON.stringify({ ruhe, kurz }));
    pruef(kurz.versatz === "120px", "die Variable steht auf 120px", kurz.versatz);
    await setze(1);
    const rauschen = await stand();
    pruef(["nav", "blatt", "balken", "strv", "strw"].every(k => rauschen[k] === ruhe[k]), "1 px (Rundung) bewegt nichts", JSON.stringify(rauschen));
    /* Foto vom 25.10. (Board, iPhone): die Leiste saß UNTER dem sichtbaren Rand, abgeschnitten. Die Rechnung kannte nur „Leiste zu hoch“.
       Jetzt gilt die Richtung auch andersherum — ohne Tastatur (Eingabefeld) und ohne Zoom rückt alles genau um den Abstand NACH OBEN. */
    await setze(-47);
    const abgeschnitten = await stand();
    pruef(festeNachher.every(k => abgeschnitten[k] === ruhe[k] - 47) && abgeschnitten.versatz === "-47px", "Leiste unter dem sichtbaren Rand (47 px): alles rückt um genau 47 px nach OBEN", JSON.stringify({ ruhe, abgeschnitten }));
    await setze(-300);
    const kuerzer = await stand();
    pruef(festeNachher.every(k => kuerzer[k] === ruhe[k] - 300), "Sichtbares 300 px kürzer, ohne Eingabefeld: die Leiste folgt nach oben", JSON.stringify(kuerzer));
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, scale:2, height:document.documentElement.clientHeight - 300, addEventListener(){} } }); leisteAnkern(); });
    const gezoomt = await stand();
    pruef(festeNachher.every(k => gezoomt[k] === ruhe[k]), "gezoomt (scale 2): nichts bewegt sich", JSON.stringify(gezoomt));
    await setze(120);
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:-60, scale:1, height:document.documentElement.clientHeight + 300, addEventListener(){} } }); leisteAnkern(); });
    const gummi = await stand();
    pruef(gummi.versatz === "120px", "Gummiband oben (offsetTop −60): der letzte Stand bleibt, nichts zuckt", gummi.versatz);
    await setze(0);
    const mitFeld = await setze(120, true);
    pruef(mitFeld === 0, "mit fokussiertem Eingabefeld wird nicht verschoben", String(mitFeld));
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }
  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
