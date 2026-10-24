/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Geschlossenes Gericht-Blatt hängt nicht aus dem Rand, Navigation „schwebt“ nicht

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-blatt-zu.js

   Vorfall (Bildschirmfoto vom Nutzer, iPhone, 24.10.): „unten am Ende der
   Karte hängt ein Gericht offen mit der Beschreibung fest.“ Gemeint war der
   obere Rand des geschlossenen Detail-Blatts (.warenkarte): Es war nur nach
   unten GESCHOBEN (translate 102 %), nicht unsichtbar. Malt der Browser
   Inhalt unter seine eigene Leiste, sieht man diesen Rand — das Foto und die
   erste Zeile des Gerichts. Die Navigation endete darüber und „schwebte“.

   Nachgestellt wird das, was das Gerät zeigt: Die festen Leisten enden 120 px
   ÜBER dem Schirmrand (bottom:120px), darunter sieht man den Inhalt. Dann
   gemessen, am gemalten Bild:
   1 · Geschlossen ist das Blatt unsichtbar (visibility), offen sichtbar, und
       beim Schließen bleibt es bis zum Ende der Bewegung sichtbar (sonst
       verschwände es mitten im Hinunterfahren).
   2 · Der Streifen unter der Navigation ist in der Farbe der Navigation —
       durchgehend, an jedem Pixel (keine Karte, kein Foto, kein Blattrand).
   3 · Reduzierte Bewegung: dieselben Regeln.
   4 · Alle Häuser mit Hauptnavigation (Premium), 360 und 430 px.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OBEN = path.join(__dirname, "..");
const DIST = process.env.DIST || path.join(OBEN, "dist");
let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if(!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };
const HAEUSER = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html")));

(async () => {
  const br = await chromium.launch();
  for(const haus of HAEUSER) for(const breite of [360, 430]) for(const ruhig of [false, true]){
    if(breite === 430 && ruhig) continue;
    const ctx = await br.newContext({ viewport:{ width:breite, height:800 }, reducedMotion: ruhig ? "reduce" : "no-preference", deviceScaleFactor:1 });
    const p = await ctx.newPage(); const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 140)));
    await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
    await p.goto("file://" + path.join(DIST, haus, "index.html") + "#/speisekarte");
    await p.waitForTimeout(1200);
    const wo = haus + " · " + breite + (ruhig ? " · reduziert" : "");
    const nav = await p.evaluate(() => { const e = document.getElementById("hauptnav"); return !!e && !e.hidden && getComputedStyle(e).position === "fixed" && e.getBoundingClientRect().height > 0; });
    /* Ein Gericht der Karte öffnen und wieder schließen: Das Blatt behält seinen Inhalt (wie auf dem Foto). */
    const name = await p.evaluate(() => { const a = document.querySelector("[data-detail]"); return a ? a.getAttribute("data-detail") : null; });
    pruef(!!name, wo + ": Voraussetzung — die Karte zeigt ein Gericht zum Öffnen", name || "keins");
    if(!name){ await ctx.close(); continue; }
    const vis = () => p.evaluate(() => getComputedStyle(document.querySelector(".warenkarte")).visibility);
    const v0 = await vis();
    await p.evaluate(nm => detailOeffnen(decodeURIComponent(nm)), name).catch(() => p.evaluate(nm => detailOeffnen(nm), name));
    await p.waitForTimeout(ruhig ? 300 : 600);
    const v1 = await vis();
    const hatInhalt = await p.evaluate(() => document.querySelector(".warenkarte").textContent.trim().length);
    await p.evaluate(() => detailSchliessen());
    await p.waitForTimeout(ruhig ? 60 : 90);
    const v2 = await vis();
    await p.waitForTimeout(ruhig ? 400 : 600);
    const v3 = await vis();
    pruef(v0 === "hidden" && v1 === "visible" && hatInhalt > 40 && v2 === "visible" && v3 === "hidden",
      wo + ": Blatt zu = unsichtbar, offen = sichtbar, beim Schließen bis zum Ende sichtbar (Inhalt bleibt stehen)", [v0, v1, v2, v3, hatInhalt + " Zeichen"].join(" / "));

    if(nav){
      /* Das Gerät malt Inhalt UNTER seine Leiste: Alle festen Leisten enden 120 px über dem Schirmrand. */
      await p.addStyleTag({ content:".hauptnav,.warenkarte,.auswahlbalken,.vstreifen,.wsstreifen{bottom:120px !important}" });
      await p.evaluate(() => window.scrollTo(0, 400));
      await p.waitForTimeout(250);
      const info = await p.evaluate(() => { const e = document.getElementById("hauptnav"), r = e.getBoundingClientRect();
        return { unten:Math.round(r.bottom), farbe:getComputedStyle(e).backgroundColor, h:innerHeight }; });
      const buf = await p.screenshot({ clip:{ x:0, y:info.unten + 2, width:breite, height:Math.max(1, info.h - info.unten - 2) } });
      const messung = await p.evaluate(async ([b64, farbe]) => {
        const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const g = c.getContext("2d"); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        const soll = farbe.match(/[\d.]+/g).slice(0, 3).map(Number);
        let abweich = 0, groesste = 0;
        for(let i = 0; i < d.length; i += 4){ const m = Math.max(Math.abs(d[i] - soll[0]), Math.abs(d[i + 1] - soll[1]), Math.abs(d[i + 2] - soll[2])); if(m > 3){ abweich++; if(m > groesste) groesste = m; } }
        return { pixel:d.length / 4, abweich, groesste, hoehe:img.height };
      }, [buf.toString("base64"), info.farbe]);
      pruef(info.unten < info.h - 100 && messung.hoehe > 60 && messung.abweich === 0,
        wo + ": der Streifen unter der Navigation ist durchgehend in Navigationsfarbe (kein Blattrand, kein Foto, keine Karte)",
        info.unten + " < " + info.h + ", " + messung.abweich + " von " + messung.pixel + " Pixeln weichen ab (max " + messung.groesste + ")");
    } else {
      pruef(true, wo + ": (kein Premium — keine Hauptnavigation, Streifenprobe entfällt)");
    }
    pruef(!fehler.length, wo + ": kein Seitenfehler", fehler.join(" | "));
    await ctx.close();
  }
  await br.close();
  console.log("\n" + (f ? f + " Fehler" : "Alles sauber.") + " (" + n + " Proben)");
  process.exit(f ? 1 : 0);
})();
