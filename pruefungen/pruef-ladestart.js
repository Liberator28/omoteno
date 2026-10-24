/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Ladestart des Hubs (früher Start der Karten-Abfrage)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-ladestart.js

   > 24.10.: „Die Seite ist relativ langsam … schneller, Qualität gleich.“
   Gemessen (CPU 4-fach, 1,6 Mbit, 150 ms): Die erste Abfrage an die
   Datenbank ging erst nach ~3,5 s hinaus — nach dem Laden UND Ausführen der
   ganzen Datei. Dazu zwei weitere, identische „select=id“-Abfragen.

   Was belegt wird (am echten Verhalten, mit gestellter Datenbank):
   1 · Die Abfrage geht hinaus, solange der Kopf der Seite noch gelesen wird
       (document.body gibt es noch nicht), und es ist GENAU EINE nach dem
       Betrieb — keine „select=id“-Abfrage nebenher, auch wenn Aktionen und
       Zahlarten zugleich nach der id fragen.
   2 · Die Antwort kommt wirklich an: Karte und Bestellpause stehen im Hub
       (dieselben Zeilen wie auf dem alten Weg).
   3 · Scheitert die frühe Abfrage (Netz weg, 500), geht der Hub den alten
       Weg: eine zweite Abfrage, die Karte steht trotzdem da.
   4 · Antwortet sie gar nicht, hängt der Hub nicht: Nach der Wartezeit
       steht die eingebaute Karte (die ersten drei Gerichte im Quelltext).
   5 · Vorschau im Board (OMOTENO_VORSCHAU): kein früher Start.
   6 · Vorführhaus: keine Anfrage an die Datenbank (die Weiche des
       Vorführmodus greift auch für den frühen Weg).
   7 · betriebIdHolen() teilt sich EINE Abfrage, auch ohne frühen Weg; nach
       einem Fehlschlag darf es erneut fragen (kein dauerhaft gemerkter Fehler).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OBEN = path.join(__dirname, "..");
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

const BETRIEB = { id:"11111111-1111-1111-1111-111111111111", bestell_pause:true, bestell_pause_text:"Pausenprobe", hub_texte:{}, hub_kacheln:null,
  hub_bloecke:null, hub_banner:null, hub_woerter:null, liefer:null, hub_avatar:null, hub_stil:null, karten:null, optionen:null };

/* Eine Seite, die jede Anfrage an die Datenbank zählt. */
async function seite(browser, haus, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  if(opt.init) await ctx.addInitScript(opt.init);
  /* Vor jedem Skript der Seite: jeden fetch an die Datenbank mit Zeit und Kopf-Phase festhalten. */
  await ctx.addInitScript(() => {
    window.__db = [];
    const echt = window.fetch.bind(window);
    window.fetch = function(ziel, o){
      const u = String((ziel && ziel.url) || ziel);
      if(/\/rest\/v1\//.test(u)) window.__db.push({ u:u.replace(/^.*\/rest\/v1\//, ""), imKopf:!document.body, t:Math.round(performance.now()) });
      return echt(ziel, o);
    };
  });
  const p = await ctx.newPage(); const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  const echt = [];
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(/\/rest\/v1\/betriebe\?/.test(u)){
      echt.push(u);
      const k = echt.length;
      if(opt.betrieb) return opt.betrieb(r, k);
      return r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([BETRIEB]) });
    }
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await p.goto("file://" + path.join(OBEN, "dist", haus, "index.html") + (opt.hash || ""));
  return { ctx, p, fehler, echt };
}
const betriebeAnfragen = p => p.evaluate(() => window.__db.filter(x => /^betriebe\?/.test(x.u)));

(async () => {
  const browser = await chromium.launch();
  const HAEUSER = fs.readdirSync(path.join(OBEN, "dist")).filter(h => fs.existsSync(path.join(OBEN, "dist", h, "index.html")) && h !== "nordstern");

  console.log("══ 1+2 · Früh, genau eine, Antwort kommt an ══");
  for(const haus of HAEUSER){
    const { ctx, p, fehler, echt } = await seite(browser, haus);
    await p.waitForTimeout(1200);
    const b = await betriebeAnfragen(p);
    const ids = b.filter(x => /select=id$/.test(x.u));
    const haupt = b.filter(x => /select=id,bestell_pause/.test(x.u));
    pruef(haupt.length === 1 && haupt[0].imKopf === true, haus + ": die Karten-Abfrage geht im Kopf der Seite hinaus (vor dem Körper), genau einmal", haupt.map(x => "imKopf=" + x.imKopf + " " + x.t + " ms").join(", ") || "keine");
    pruef(ids.length === 0, haus + ": keine zusätzliche „select=id“-Abfrage (Aktionen, Zahlarten, Reservierung teilen die id)", ids.length + " Abfragen");
    const st = await p.evaluate(() => ({ pause:BETRIEB.bestellPause, text:BETRIEB.bestellPauseText, id:betriebId }));
    pruef(st.pause === true && st.text === "Pausenprobe" && st.id === BETRIEB.id, haus + ": die Antwort kommt an (Pause, Text, Betriebs-ID)", JSON.stringify(st));
    const alle = await p.evaluate(() => window.__db.map(x => x.u.split("?")[0]));
    pruef(alle.filter(x => x === "gerichte").length >= 1, haus + ": danach die Gerichte (die zweite Stufe läuft wie vorher)", alle.join(","));
    pruef(!fehler.length, haus + ": kein Seitenfehler", fehler.join(" | "));
    await ctx.close();
  }

  console.log("══ 3 · Die frühe Abfrage scheitert ══");
  for(const art of ["abbruch", "500"]){
    const { ctx, p, fehler } = await seite(browser, "chocolamour", { betrieb:(r, k) => k === 1
      ? (art === "abbruch" ? r.abort("failed") : r.fulfill({ status:500, contentType:"application/json", body:"{}" }))
      : r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([BETRIEB]) }) });
    await p.waitForTimeout(1800);
    const b = (await betriebeAnfragen(p)).filter(x => /select=id,bestell_pause/.test(x.u));
    const st = await p.evaluate(() => ({ pause:BETRIEB.bestellPause, id:betriebId }));
    pruef(b.length === 2 && st.pause === true && st.id === BETRIEB.id, "früh " + art + ": zweite Abfrage auf dem alten Weg, Karte steht trotzdem da", b.length + " Abfragen, " + JSON.stringify(st));
    pruef(!fehler.length, "früh " + art + ": kein Seitenfehler", fehler.join(" | "));
    await ctx.close();
  }

  console.log("══ 4 · Keine Antwort: der Hub hängt nicht ══");
  {
    const { ctx, p, fehler } = await seite(browser, "chocolamour", { betrieb:() => { /* nie beantwortet */ } });
    await p.waitForTimeout(1000);
    const frueh = await p.evaluate(() => ({ speisekarte:!!document.querySelector("#inhalt .kachel, #inhalt a.kachel, #inhalt .sb-kopf"), titel:document.getElementById("titel").textContent.trim().length }));
    pruef(frueh.titel > 0, "ohne Antwort steht der Hub (Titel) schon nach 1 s da — er wartet nicht auf die Datenbank", JSON.stringify(frueh));
    await p.waitForTimeout(6500);
    const spaet = await p.evaluate(() => ({ gerichte:Object.keys(typeof SPEISEKARTE === "object" ? SPEISEKARTE : {}).length, pause:BETRIEB.bestellPause }));
    pruef(spaet.pause === false && spaet.gerichte >= 1, "nach der Wartezeit (6 s) bleibt die eingebaute Karte, keine Pause gesetzt", JSON.stringify(spaet));
    pruef(!fehler.length, "ohne Antwort: kein Seitenfehler", fehler.join(" | "));
    await ctx.close();
  }

  console.log("══ 5+6 · Vorschau und Vorführhaus ══");
  {
    const { ctx, p } = await seite(browser, "chocolamour", { init:() => { window.OMOTENO_VORSCHAU = true; } });
    await p.waitForTimeout(500);
    const v = await p.evaluate(() => ({ rennt:OMOTENO_FRUEH.rennt === null, imKopf:window.__db.filter(x => x.imKopf).length }));
    pruef(v.rennt && v.imKopf === 0, "Vorschau im Board: kein früher Start (dort gilt, was das Board schickt)", JSON.stringify(v));
    await ctx.close();
    const d = await seite(browser, "nordstern");
    await d.p.waitForTimeout(800);
    pruef(d.echt.length === 0, "Vorführhaus: keine Anfrage erreicht die Datenbank (auch nicht die frühe)", d.echt.length + " erreicht");
    const dv = await d.p.evaluate(() => ({ anfragen:window.OMOTENO_DEMO_ANFRAGEN || null, gerichte:Object.keys(SPEISEKARTE).length }));
    pruef(!!dv.anfragen && dv.anfragen.some(x => /betriebe/.test(x)) && dv.gerichte >= 1, "Vorführhaus: die Weiche des Vorführmodus beantwortet die frühe Abfrage selbst", JSON.stringify(dv.anfragen));
    await d.ctx.close();
  }

  console.log("══ 7 · betriebIdHolen teilt sich eine Abfrage ══");
  {
    let k = 0;
    const { ctx, p } = await seite(browser, "chocolamour", { init:() => { window.OMOTENO_VORSCHAU = true; },
      betrieb:(r) => { k++; return r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([{ id:BETRIEB.id }]) }); } });
    await p.waitForTimeout(600);
    await p.evaluate(() => { betriebId = null; window.__db.length = 0; });
    const vor = k;
    const ids = await p.evaluate(async () => (await Promise.all([1, 2, 3, 4, 5].map(() => betriebIdHolen()))));
    const nach = await p.evaluate(() => window.__db.filter(x => /select=id$/.test(x.u)).length);
    pruef(ids.every(i => i === BETRIEB.id) && nach === 1, "fünf gleichzeitige Aufrufe → EINE Abfrage, alle bekommen dieselbe id", ids.length + " Antworten, " + nach + " Abfrage(n)");
    /* Fehlschlag darf nicht festkleben */
    await p.evaluate(() => { betriebId = null; });
    await p.route("**/rest/v1/betriebe?*select=id", r => r.fulfill({ status:500, contentType:"application/json", body:"{}" }));
    const leer = await p.evaluate(() => betriebIdHolen());
    await p.unroute("**/rest/v1/betriebe?*select=id");
    await p.route("**/rest/v1/betriebe?*select=id", r => r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([{ id:BETRIEB.id }]) }));
    const wieder = await p.evaluate(() => betriebIdHolen());
    pruef(leer === null && wieder === BETRIEB.id, "nach einem Fehlschlag fragt der nächste Aufruf erneut (der Fehler bleibt nicht hängen)", JSON.stringify([leer, wieder]));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " Fehler" : "Alles sauber.") + " (" + n + " Proben)");
  process.exit(f ? 1 : 0);
})();
