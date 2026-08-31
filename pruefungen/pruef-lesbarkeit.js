/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Lesbarkeit, hell wie dunkel

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-lesbarkeit.js

   Sie geht über JEDES Element mit Text, mischt die durchscheinenden
   Flächen darunter zusammen und rechnet den Kontrast. Nicht ein paar
   ausgewählte Paare — alles, was auf dem Schirm steht.

   Warum so grob: Eine Palette umzustellen heißt nicht, zwei Farben zu
   tauschen. Es heißt, dass irgendwo eine Zeile steht, an die niemand
   gedacht hat — ein Platzhalter, ein Hinweis, eine Zahl in einer
   Bedeutungsfarbe. Die findet man nur, indem man alles nachrechnet.

   Grenze 4,5:1; ab 24px und fett genügen 3:1 (WCAG). Reine
   Zierschrift unter 10px und Elemente ohne sichtbaren Text werden
   übersprungen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

/* dist/ liegt in der Wurzel, die Seiten in seiten/ - beides eine
   Ebene hoeher als dieses Skript. */
const HIER   = path.resolve(__dirname, "..");
const SEITEN = path.join(HIER, "seiten");
const BID  = "af095b14-d9ef-41f4-9b97-c4422b0de63f";

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

const SWEEP = `
(() => {
  const zahl = t => (String(t).match(/[\\d.]+/g) || []).map(Number);
  const kanal = c => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
  const leucht = p => .2126*kanal(p[0]) + .7152*kanal(p[1]) + .0722*kanal(p[2]);
  const mischen = (oben, unten) => {
    const a = oben.length > 3 ? oben[3] : 1;
    return [0,1,2].map(i => Math.round(oben[i]*a + unten[i]*(1-a)));
  };
  function grundVon(el){
    const stapel = []; let k = el;
    while(k){
      const b = zahl(getComputedStyle(k).backgroundColor);
      if(b.length >= 3 && (b.length < 4 || b[3] > 0)) stapel.push(b);
      if(b.length === 3 || (b.length === 4 && b[3] === 1)) break;
      k = k.parentElement;
    }
    let unten = stapel.pop() || [255,255,255];
    while(stapel.length) unten = mischen(stapel.pop(), unten);
    return unten;
  }
  /* Nur Elemente, die SELBST Text zeigen — sonst zählt jeder
     Container den Text seiner Kinder noch einmal mit. */
  const eigenerText = el => Array.prototype.some.call(el.childNodes,
    n => n.nodeType === 3 && n.textContent.trim().length > 0);

  const raus = [];
  document.querySelectorAll("body *").forEach(el => {
    if(!eigenerText(el)) return;
    /* Text INNERHALB einer Zeichnung hat keinen CSS-Hintergrund,
       sondern liegt auf gezeichneten Flächen. Diese Rechnung käme
       dort immer auf 1:1 und wäre nur Rauschen — die Figur und das
       Siegel prüft pruef-figur.js an ihren echten Flächen. */
    if(el.closest("svg")) return;
    const s = getComputedStyle(el);
    if(s.visibility === "hidden" || s.display === "none") return;
    if(parseFloat(s.opacity) < .15) return;
    const kasten = el.getBoundingClientRect();
    if(kasten.width < 2 || kasten.height < 2) return;
    const groesse = parseFloat(s.fontSize);
    if(groesse < 10) return;                 /* Zierschrift */
    const dick = parseInt(s.fontWeight, 10) >= 700;
    const grenze = (groesse >= 24 || (groesse >= 18.66 && dick)) ? 3 : 4.5;

    const grund = grundVon(el);
    const vorne = mischen(zahl(s.color), grund);
    const a = leucht(vorne), b = leucht(grund);
    const wert = Math.round(((Math.max(a,b)+.05)/(Math.min(a,b)+.05))*100)/100;
    if(wert < grenze){
      raus.push({
        wert, grenze,
        wo: el.tagName.toLowerCase() +
            (el.id ? "#" + el.id : "") +
            (el.className && typeof el.className === "string"
              ? "." + el.className.trim().split(/\\s+/).slice(0,2).join(".") : ""),
        text: (el.textContent || "").trim().slice(0, 46)
      });
    }
  });
  return raus.sort((a,b) => a.wert - b.wert);
})()
`;

async function fuellen(seite){
  await seite.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await seite.route("**/rest/v1/betriebe**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"",
                              hub_texte:{} }]) }));
  await seite.addInitScript(() => {
    try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){}
  });
}

/* Jede Fläche mit den Zuständen, in denen sie geprüft wird. */
const FLAECHEN = [
  { datei:"admin.html", name:"Admin-Board",
    lagen:[["dunkel", p => p.evaluate(() => { EINST.licht="dunkel"; lichtAnwenden(); })],
           ["hell",   p => p.evaluate(() => { EINST.licht="hell";   lichtAnwenden(); })]],
    /* Das Board zeigt ohne Anmeldung nur das Tor. Der Vorführmodus
       füllt es mit Beispieldaten — genau dafür ist er da. */
    vorher: async p => {
      await p.evaluate(() => { if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); } });
      await p.waitForTimeout(300);
    },
    seiten:["bestellungen","speisekarte","auswertung","einstellungen"],
    blaettern: (p, ziel) => p.evaluate(z => tafelZeigen(z), ziel) },

  { datei:"kueche.html", name:"Küchendisplay",
    lagen:[["dunkel", p => p.evaluate(() => { EINST.hell=false; document.body.classList.remove("hell"); })],
           ["hell",   p => p.evaluate(() => { EINST.hell=true;  document.body.classList.add("hell"); })]] },

  { hub:true, name:"Gäste-Hub",
    lagen:[["dunkel", p => p.evaluate(() => { lichtSetzen("dunkel"); })],
           ["hell",   p => p.evaluate(() => { lichtSetzen("hell");   })]],
    seiten:["", "speisekarte", "meintisch", "kontakt", "service"],
    blaettern: (p, ziel) => p.evaluate(z => { location.hash = "#/" + z; }, ziel) }
];

(async () => {
  const browser = await chromium.launch();

  for(const f of FLAECHEN){
    let ziel;
    if(f.hub){
      const o = path.join(HIER, "dist");
      const slug = fs.existsSync(o)
        ? fs.readdirSync(o).find(x => fs.existsSync(path.join(o, x, "index.html"))) : null;
      if(!slug){ console.log("\n" + f.name + ": kein erzeugter Hub, übersprungen"); continue; }
      ziel = "file://" + path.join(o, slug, "index.html");
    } else {
      if(!fs.existsSync(path.join(SEITEN, f.datei))){
        console.log("\n" + f.name + ": Datei fehlt, übersprungen"); continue;
      }
      ziel = "file://" + path.join(SEITEN, f.datei);
    }

    for(const [lage, stellen] of f.lagen){
      const ctx = await browser.newContext({ viewport:{width:390,height:844} });
      const seite = await ctx.newPage();
      await fuellen(seite);
      await seite.goto(ziel);
      await seite.waitForTimeout(700);
      if(f.vorher) await f.vorher(seite);
      try{ await stellen(seite); }catch(e){}
      await seite.waitForTimeout(400);

      const wege = f.seiten || [null];
      const gesammelt = new Map();
      for(const w of wege){
        if(w !== null && f.blaettern){
          try{ await f.blaettern(seite, w); }catch(e){}
          await seite.waitForTimeout(350);
        }
        for(const t of await seite.evaluate(SWEEP)){
          const k = t.wo + "|" + t.text;
          if(!gesammelt.has(k) || gesammelt.get(k).wert > t.wert) gesammelt.set(k, t);
        }
      }
      const liste = [...gesammelt.values()].sort((a,b) => a.wert - b.wert);
      console.log("\n── " + f.name + " · " + lage + " ──");
      pruef(liste.length === 0, "alles über der Grenze",
        liste.length ? liste.length + " Stelle(n)" : "geprüft");
      liste.slice(0, 12).forEach(t => console.log("         " +
        t.wert.toFixed(2) + ":1 (mind. " + t.grenze + ")  " +
        t.wo.padEnd(30) + "  " + JSON.stringify(t.text)));
      await ctx.close();
    }
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fläche(n) mit Fundstellen" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
