/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Impressum und Datenschutzerklärung

     NODE_PATH=/opt/node22/lib/node_modules node pruef-recht.js

   Zwei Seiten, die selten jemand aufmacht — und die genau deshalb
   niemandem auffallen, wenn sie kaputt sind. Geprüft wird:

   1 · Laden sie schnell, auch wenn der Schriftdienst nicht
       antwortet? Beide holen ihre Schrift von fonts.googleapis.com;
       blockierend wären das gemessene zwölf Sekunden.
   2 · Ist JEDER Text lesbar? Gerechnet gegen den tatsächlich
       sichtbaren Grund, Deckung eingeschlossen — die Kästen liegen
       mit sieben Prozent auf der Pappe. Wer gegen das volle Blau
       rechnet, bekommt 1,00:1 und meldet einen Fehler, den es nicht
       gibt.
   3 · Steht dieselbe Wortmarke wie auf der Landingpage? Beide
       Dateien kamen mit der VORIGEN Marke („omoten" plus
       gezeichnetes Zeichen). Zwei Marken auf zwei Seiten desselben
       Hauses ist der sichtbarste Weg, unfertig zu wirken.

   Was hier NICHT geprüft wird: der Inhalt. Ich bin kein Anwalt.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
/* Die Datei neben sich suchen, nicht an einem festen Pfad — nach
   einer Umbenennung faellt eine Pruefung sonst mit ENOENT um und
   wird nicht mehr gelesen (CLAUDE.md §8.2). */
const ADRESSE = n => {
  const p = path.join(__dirname, n + ".html");
  if(!fs.existsSync(p)){ console.error(n + ".html fehlt."); process.exit(1); }
  return "file://" + p;
};
let fehler = 0;
const pruef = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };
const L = h => { const c=[1,3,5].map(i=>{const v=parseInt(h.substr(i,2),16)/255;
  return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055,2.4);});
  return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
const K = (a,b) => { const x=L(a),y=L(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
const hex = rgb => { const n=rgb.match(/[\d.]+/g); return "#"+n.slice(0,3)
  .map(v=>Math.round(+v).toString(16).padStart(2,"0")).join("").toUpperCase(); };

(async () => {
  const b = await chromium.launch();
  for(const d of ["impressum","datenschutz"]){
    const ctx = await b.newContext({ viewport:{width:390,height:844} });
    const p = await ctx.newPage();
    const konsole = [];
    p.on("pageerror", e => konsole.push(String(e).slice(0,120)));
    /* Schriftdienst haengt — der schlimmste Fall. */
    await p.route("**/*", r => {
      const u = r.request().url();
      if(u.startsWith("file://")) return r.continue();
      if(/fonts\.(googleapis|gstatic)/.test(u)) return new Promise(()=>{});
      return r.abort();
    });
    await p.goto(ADRESSE(d), {waitUntil:"domcontentloaded"});
    await p.waitForTimeout(900);
    console.log("\n══ " + d + ".html");

    const farbe = await p.evaluate(() => {
      const f = performance.getEntriesByType("paint")
        .find(x => x.name === "first-contentful-paint");
      return Math.round((f||{}).startTime || -1);
    });
    pruef(farbe >= 0 && farbe < 500, "erstes Bild unter 500 ms trotz haengendem Schriftdienst",
      farbe + " ms");

    /* Lesbarkeit: jedes Textelement gegen seinen tatsaechlichen Grund. */
    const schwach = await p.evaluate(() => {
      /* Der Grund ist das, was man SIEHT, nicht die oberste Angabe.
         Die Kaesten hier liegen mit 7 % Deckung auf der Pappe; wer
         gegen das volle Blau rechnet, bekommt 1,00:1 und meldet einen
         Fehler, den es nicht gibt. Also von unten nach oben schichten. */
      const zahl = c => (c.match(/[\d.]+/g) || [0,0,0,0]).map(Number);
      const grund = el => {
        const schichten = [];
        let e = el;
        while(e){
          const [r,g,b,a] = zahl(getComputedStyle(e).backgroundColor);
          const deck = a === undefined ? 1 : a;
          if(deck > 0) schichten.push([r,g,b,deck]);
          if(deck >= 1) break;
          e = e.parentElement;
        }
        schichten.push([255,255,255,1]);
        let [R,G,B] = schichten[schichten.length-1];
        for(let i = schichten.length-2; i >= 0; i--){
          const [r,g,b,a] = schichten[i];
          R = r*a + R*(1-a); G = g*a + G*(1-a); B = b*a + B*(1-a);
        }
        return "rgb(" + Math.round(R) + "," + Math.round(G) + "," + Math.round(B) + ")";
      };
      return [...document.querySelectorAll("p,li,td,th,h1,h2,h3,a,span")]
        .filter(el => el.textContent.trim().length > 2 && el.offsetParent !== null)
        .map(el => {
          const s = getComputedStyle(el);
          return { vg:s.color, hg:grund(el), gr:parseFloat(s.fontSize),
                   fett:+s.fontWeight >= 600,
                   was:(el.tagName+"."+(el.className||"")).slice(0,30),
                   text:el.textContent.trim().slice(0,26) };
        });
    });
    const durchgefallen = schwach.map(x => {
      const w = K(hex(x.vg), hex(x.hg));
      const grenze = (x.gr >= 24 || (x.gr >= 18.66 && x.fett)) ? 3 : 4.5;
      return { ...x, w, grenze };
    }).filter(x => x.w < x.grenze);
    pruef(durchgefallen.length === 0, "jeder Text ueber der Grenze",
      durchgefallen.length
        ? durchgefallen.slice(0,3).map(x => x.was+" "+x.w.toFixed(2)+" („"+x.text+"“)").join(" | ")
        : schwach.length + " Textstellen geprueft");

    /* Die Marke: ein Punkt plus OMOTENO, zweimal (Kopf und Fuss). */
    const marken = await p.$$eval(".marke", e => e.map(x => x.textContent.trim()));
    pruef(marken.length === 2 && marken.every(m => m === "OMOTENO"),
      "die Wortmarke steht in Kopf und Fuss", marken.join(" · "));
    pruef((await p.$$(".pip")).length === 2, "und traegt ihren Punkt");

    /* Kein seitliches Schieben, keine toten Links im Fuss. */
    const ueber = await p.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(ueber <= 1, "nichts schiebt seitlich", ueber + "px");
    pruef(konsole.length === 0, "kein Fehler in der Konsole", konsole[0] || "still");
    await ctx.close();
  }
  await b.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
