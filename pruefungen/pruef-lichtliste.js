/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Fünf Helligkeitsstufen für den Gast

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-lichtliste.js

   Wunsch 11.10.: „mehr Helligkeitsstufen für den Hub“. Der Lichtknopf
   öffnet eine Liste (wie die Sprachwahl): Automatisch, Hell, Ganz
   weiß, Dunkel, Ganz schwarz. Ganz weiß/schwarz rechnen über
   denselben geteilten Block wie die Farben aus dem Board.

   Je Haus (zweite Quelle: dist/), 390 px, Uhr fest:
   1 · Ein echter Tipp öffnet die Liste: fünf Einträge ≥ 44 px, die
       gültige Stufe ist markiert, die Liste liegt ganz im Bild (auch
       320 px und Arabisch) und malt über dem Guss (Malreihenfolge
       gemessen, §3.11).
   2 · Jede Stufe über den echten Tipp: Grund am Wurzelelement
       (weiß #FFF, schwarz #000, hell/dunkel = Tag/Abend des
       Markenblatts), Phase, color-scheme passend; jede Schrift auf
       der Startseite ≥ 4,5:1; Liste danach zu, Knopf nennt die Stufe.
   3 · Die Wahl übersteht das Neuladen; ein unbekannter gemerkter
       Wert („lila“) fällt still auf Automatisch.
   4 · Escape und Tipp daneben schließen; die Sprachliste schließt sie.
   5 · Mit Farben aus dem Board (hub_stil.farben) bleibt ganz weiß
       ganz weiß.
   6 · Arabisch: Namen übersetzt.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DIST = process.env.DIST || path.join(__dirname, "..", "dist");
const OBEN = path.join(__dirname, "..");
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };
const HAEUSER = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html")));

async function oeffnen(browser, haus, opt){
  opt = opt || {};
  const ctx = opt.ctx || await browser.newContext({ viewport:{ width:opt.breite || 390, height:844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
  if(opt.vorher) await p.addInitScript(opt.vorher);
  await p.clock.setFixedTime(new Date("2026-10-10T14:00:00"));
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(opt.stil && /\/rest\/v1\/betriebe\?/.test(u)) return r.fulfill({ status:200, contentType:"application/json",
      body:JSON.stringify([{ id:"b1", bestell_pause:false, hub_texte:{}, hub_stil:opt.stil }]) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await p.goto("file://" + path.join(DIST, haus, "index.html") + "#/");
  await p.waitForTimeout(1200);
  if(opt.sprache){ await p.evaluate(s => { spracheSetzen(s); zeichne(); }, opt.sprache); await p.waitForTimeout(300); }
  return { ctx, p, fehler };
}
const stand = p => p.evaluate(() => ({
  grund:getComputedStyle(document.documentElement).backgroundColor,
  phase:document.body.dataset.phase, schema:getComputedStyle(document.documentElement).colorScheme,
  offen:document.getElementById("lichtwahl").classList.contains("offen"),
  label:document.getElementById("lichtknopf").getAttribute("aria-label") }));
const rgb = h => "rgb(" + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(", ") + ")";

/* Kontrast jeder sichtbaren Schrift der Startseite — dieselbe Messung
   wie pruef-lesbarkeit.js, hier nur die Startseite. */
const SWEEP = fs.readFileSync(path.join(__dirname, "pruef-lesbarkeit.js"), "utf8")
  .match(/const SWEEP = `([\s\S]*?)`;\n/)[1].replace(/\\\\/g, "\\");

(async () => {
  const browser = await chromium.launch();
  pruef(HAEUSER.length >= 2, "mindestens zwei Häuser (§8.1a)", HAEUSER.join(", "));
  for(const haus of HAEUSER){
    console.log("\n══ " + haus + " ══");
    const mb = JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", haus + ".json"), "utf8"));
    let { ctx, p, fehler } = await oeffnen(browser, haus);
    await p.click("#lichtknopf"); await p.waitForTimeout(350);
    const liste = await p.evaluate(() => {
      const l = document.getElementById("lichtliste"), r = l.getBoundingClientRect();
      const b = [...l.querySelectorAll("button")];
      return { offen:document.getElementById("lichtwahl").classList.contains("offen"),
        werte:b.map(x => x.dataset.licht), hoch:Math.min(...b.map(x => x.getBoundingClientRect().height)),
        gewaehlt:b.filter(x => x.getAttribute("aria-checked") === "true").map(x => x.dataset.licht),
        imBild:r.left >= 0 && r.right <= innerWidth && r.top >= 0,
        expanded:document.getElementById("lichtknopf").getAttribute("aria-expanded") };
    });
    pruef(liste.offen && liste.expanded === "true", "ein Tipp öffnet die Liste");
    pruef(liste.werte.join() === "auto,hell,weiss,dunkel,schwarz", "fünf Stufen in der Reihenfolge", liste.werte.join());
    pruef(liste.hoch >= 44, "jeder Eintrag ≥ 44 px", liste.hoch.toFixed(0));
    pruef(liste.gewaehlt.join() === "auto", "Automatisch ist markiert", liste.gewaehlt.join());
    /* Ob etwas DARÜBER malt, misst pruef-ueberdeckt.js (es kennt die
       unsichtbare #blende — eine einfache elementFromPoint-Probe hielt
       sie hier für eine Abdeckung). */
    pruef(liste.imBild, "ganz im Bild");
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    pruef(!(await stand(p)).offen, "Escape schließt");

    const abendAn = !!(mb.abend && mb.abend.an);
    const soll = { hell:mb.farben.grund, dunkel:abendAn ? mb.abend.grund : mb.farben.grund, weiss:"#FFFFFF", schwarz:"#000000" };
    for(const w of ["weiss", "schwarz", "hell", "dunkel"]){
      await p.click("#lichtknopf"); await p.waitForTimeout(250);
      /* body blendet seinen Grund in 0,9 s über — vorher gemessen, sah
         die Probe einen Zwischenton (rgb 192,192,193) als Grund. */
      await p.click('#lichtliste [data-licht="' + w + '"]'); await p.waitForTimeout(1200);
      const s = await stand(p);
      const hellW = w === "hell" || w === "weiss";
      pruef(s.grund === rgb(soll[w]) && s.phase === (hellW ? "tag" : "abend") && !s.offen,
        w + ": Grund " + soll[w] + ", Phase " + (hellW ? "tag" : "abend") + ", Liste zu", JSON.stringify(s).slice(0, 120));
      if(w === "weiss" || w === "schwarz"){
        pruef(s.schema.split(/\s+/).includes(w === "weiss" ? "light" : "dark"), w + ": color-scheme folgt", s.schema);
        const schwach = await p.evaluate(SWEEP);
        pruef(!schwach.length, w + ": jede Schrift der Startseite ≥ 4,5:1",
          schwach.slice(0, 3).map(t => t.wert.toFixed(2) + " " + t.wo + " " + t.text).join(" | ") || "ja");
        pruef(/weiß|schwarz/.test(s.label), w + ": der Knopf nennt die Stufe", s.label);
      }
    }
    /* Neuladen behält die Wahl */
    await p.click("#lichtknopf"); await p.waitForTimeout(250);
    await p.click('#lichtliste [data-licht="schwarz"]'); await p.waitForTimeout(300);
    await p.reload(); await p.waitForTimeout(900);
    pruef((await stand(p)).grund === "rgb(0, 0, 0)", "ganz schwarz übersteht das Neuladen");
    /* Tipp daneben schließt; die Sprachliste schließt die Lichtliste */
    await p.click("#lichtknopf"); await p.waitForTimeout(250);
    await p.mouse.click(195, 700); await p.waitForTimeout(250);
    pruef(!(await stand(p)).offen, "ein Tipp daneben schließt");
    await p.click("#lichtknopf"); await p.waitForTimeout(250);
    await p.click("#sprachknopf"); await p.waitForTimeout(250);
    const beide = await p.evaluate(() => ({ licht:document.getElementById("lichtwahl").classList.contains("offen"),
      sprache:document.getElementById("sprachwahl").classList.contains("offen") }));
    pruef(!beide.licht && beide.sprache, "die Sprachliste schließt die Lichtliste", JSON.stringify(beide));
    pruef(!fehler.length, "keine Seitenfehler", fehler[0]);
    await ctx.close();

    /* unbekannter gemerkter Wert */
    ({ ctx, p, fehler } = await oeffnen(browser, haus, { vorher:new Function("try{ localStorage.setItem('omoteno-licht-" + haus + "', 'lila'); }catch(e){}") }));
    const lila = await p.evaluate(() => licht);
    pruef(lila === "auto", "gemerkt „lila“ → still Automatisch", lila);
    await ctx.close();

    /* Farben aus dem Board + ganz weiß */
    const EIGEN = { tag:{ grund:"#F0E8E0", flaeche:"#FFFFFF", band:"#123456", tinte:"#111111", akzent:"#9A1F18", akzent2:"#5E4207" } };
    ({ ctx, p, fehler } = await oeffnen(browser, haus, { stil:{ farben:EIGEN } }));
    const vorWeiss = (await stand(p)).grund;
    await p.click("#lichtknopf"); await p.waitForTimeout(250);
    await p.click('#lichtliste [data-licht="weiss"]'); await p.waitForTimeout(400);
    pruef(vorWeiss === rgb("#F0E8E0") && (await stand(p)).grund === "rgb(255, 255, 255)",
      "Board-Farben: erst deren Grund, mit „Ganz weiß“ dann #FFF", vorWeiss);
    await ctx.close();

    /* 320 px und Arabisch */
    ({ ctx, p, fehler } = await oeffnen(browser, haus, { breite:320, sprache:"ar" }));
    await p.click("#lichtknopf"); await p.waitForTimeout(350);
    const ar = await p.evaluate(() => { const l = document.getElementById("lichtliste"), r = l.getBoundingClientRect();
      return { imBild:r.left >= 0 && r.right <= innerWidth, texte:[...l.querySelectorAll("button")].map(b => b.textContent.trim()) }; });
    pruef(ar.imBild, "320 px, Arabisch: Liste ganz im Bild");
    pruef(!ar.texte.some(t => /Ganz|Hell|Dunkel|Automatisch/.test(t)), "Arabisch: Namen übersetzt", ar.texte.join(" | "));
    pruef(!fehler.length, "keine Seitenfehler", fehler[0]);
    await ctx.close();
  }
  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if(f){ console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
