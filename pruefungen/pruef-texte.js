/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Eigene Worte des Betriebs

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-texte.js

   Der Gastgeber darf Slogan, Gruß und den Namen seiner Aktionen
   selbst setzen. Damit das nicht den Kopf des Gast-Hubs zerlegt,
   hängen drei Schranken hintereinander:

     1. das Board warnt ab der gemessenen Länge und zählt mit
     2. das Feld nimmt ab der harten Grenze nichts mehr an
     3. die Datenbank weist per CHECK ab, was durchgerutscht wäre
     4. der Hub kürzt beim Lesen, falls doch etwas ankommt

   Diese Prüfung misst die vierte Schranke am fertigen Bild und
   vergleicht die Grenzen im Board mit dem, was der Hub wirklich tut.
   Zahlen im Board, die nicht zur Wirklichkeit passen, sind schlimmer
   als gar keine — sie lehren den Gastgeber, die Warnung zu übergehen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

/* dist/ liegt in der Wurzel, das Board in seiten/. */
const HIER   = path.resolve(__dirname, "..");
const SEITEN = path.join(HIER, "seiten");
const BID  = "af095b14-d9ef-41f4-9b97-c4422b0de63f";
const BREITEN = [360, 390, 430];

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

/* Ein Text aus echten Wörtern — eine Buchstabenkette bricht ganz
   anders um als ein Satz, und der Gastgeber tippt Sätze. */
const WORTE = ["Frisch","gebacken","jeden","Tag","für","Sie","mit","viel",
  "Liebe","und","Schokolade","aus","der","eigenen","Küche","seit","zwanzig","Jahren"];
function textMit(n){
  let s = "";
  for(let i = 0; s.length < n; i++) s += (s ? " " : "") + WORTE[i % WORTE.length];
  return s.slice(0, n).replace(/\s+$/, "");
}

function hubs(){
  const o = path.join(HIER, "dist");
  if(!fs.existsSync(o)) return [];
  return fs.readdirSync(o).filter(s => fs.existsSync(path.join(o, s, "index.html"))).sort();
}

/* Die Grenzen, wie das Board sie dem Gastgeber nennt. Sie werden aus
   admin.html gelesen, nicht hier abgeschrieben — sonst prüft die
   Prüfung ihre eigene Kopie. */
function grenzenAusBoard(){
  const s = fs.readFileSync(path.join(SEITEN, "admin.html"), "utf8");
  const blk = s.slice(s.indexOf("const TEXTMASS = {"));
  const raus = {};
  for(const m of blk.slice(0, blk.indexOf("\n};")).matchAll(
      /(\w+):\s*\{\s*gut:(\d+),\s*hart:(\d+)/g)){
    raus[m[1]] = { gut:+m[2], hart:+m[3] };
  }
  return raus;
}

async function verdrahten(seite, texte){
  await seite.addInitScript(() => {
    try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){}
  });
  await seite.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await seite.route("**/rest/v1/betriebe**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"",
                              hub_texte: texte || {} }]) }));
}

(async () => {
  const liste = hubs();
  if(!liste.length){
    console.log("Kein erzeugter Hub in dist/. Erst „node erzeuger/erzeuge-hub.js --alle“ laufen lassen.");
    process.exit(1);
  }
  const DATEI = "file://" + path.join(HIER, "dist", liste[0], "index.html");
  const grenzen = grenzenAusBoard();
  const browser = await chromium.launch();

  console.log("\n── Grenzen im Board ──");
  ["hubClaim","hubGruss","hubRunner","runnerTitel"].forEach(k => {
    const g = grenzen[k];
    pruef(!!g && g.gut > 0 && g.hart >= g.gut,
      k.padEnd(12) + (g ? g.gut + " gut / " + g.hart + " hart" : "FEHLT"));
  });

  /* ───── 1 · Kommen die Worte überhaupt an? ───── */
  console.log("\n── Die Worte kommen an ──");
  {
    const ctx = await browser.newContext({ viewport:{width:390,height:844} });
    const seite = await ctx.newPage();
    await verdrahten(seite, {
      claim: "Frisch gebacken, jeden Tag.",
      gruss: "Herzlich willkommen!",
      runner_titel: "Happy Hour"
    });
    await seite.goto(DATEI);
    await seite.waitForTimeout(700);

    pruef(await seite.textContent("#claim") === "Frisch gebacken, jeden Tag.",
      "Slogan steht im Kopf", await seite.textContent("#claim"));
    pruef(await seite.evaluate(() => BETRIEB.begruessung) === "Herzlich willkommen!",
      "Gruß ist übernommen");

    /* Aktion ohne eigenen Titel → die Vorgabe des Hauses. */
    const band = await seite.evaluate(() => {
      aktionen = [{ id:"m", gericht_name:"Dubai Crêpe", titel:null,
                    preis_alt:15.9, preis_neu:11.9,
                    bis:new Date(Date.now()+3600000).toISOString() }];
      zeichne();
      const k = document.querySelector(".aktion .kennz");
      return k ? k.textContent : "";
    });
    pruef(band === "Happy Hour", "Aktion ohne eigenen Titel nimmt die Vorgabe", band);

    /* Aktion MIT eigenem Titel → der gewinnt. */
    const band2 = await seite.evaluate(() => {
      aktionen = [{ id:"m", gericht_name:"Dubai Crêpe", titel:"Nur heute",
                    preis_alt:15.9, preis_neu:11.9,
                    bis:new Date(Date.now()+3600000).toISOString() }];
      zeichne();
      const k = document.querySelector(".aktion .kennz");
      return k ? k.textContent : "";
    });
    pruef(band2 === "Nur heute", "eigener Titel der Aktion gewinnt", band2);
    await ctx.close();
  }

  /* ───── 2 · Kürzt der Hub, was zu lang ankommt? ───── */
  console.log("\n── Der Hub kürzt, was durchrutscht ──");
  {
    const ctx = await browser.newContext({ viewport:{width:390,height:844} });
    const seite = await ctx.newPage();
    await verdrahten(seite, {
      claim: textMit(300), gruss: textMit(300), runner_titel: textMit(300)
    });
    await seite.goto(DATEI);
    await seite.waitForTimeout(700);
    const gemessen = await seite.evaluate(() => ({
      claim: BETRIEB.claim.length,
      gruss: BETRIEB.begruessung.length,
      runner: RUNNER_TITEL.length
    }));
    pruef(gemessen.claim  <= grenzen.hubClaim.hart,  "Slogan gekürzt", gemessen.claim + " Zeichen");
    pruef(gemessen.gruss  <= grenzen.hubGruss.hart,  "Gruß gekürzt",   gemessen.gruss + " Zeichen");
    pruef(gemessen.runner <= grenzen.hubRunner.hart, "Aktionsname gekürzt", gemessen.runner + " Zeichen");
    await ctx.close();
  }

  /* ───── 3 · Stimmen die Zahlen im Board mit der Wirklichkeit? ───── */
  console.log("\n── Die Warnung sagt die Wahrheit ──");
  for(const breite of BREITEN){
    const ctx = await browser.newContext({ viewport:{width:breite,height:844} });
    const seite = await ctx.newPage();
    await verdrahten(seite, {});
    await seite.goto(DATEI);
    await seite.waitForTimeout(600);

    /* Die Texte werden HIER gebaut und fertig hineingereicht —
       eine Funktion überlebt den Weg in die Seite nicht. */
    const zahl = await seite.evaluate(({ gutClaim, hartClaim, gutRunner }) => {
      const zeilen = el => {
        const s = getComputedStyle(el);
        const zh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2;
        return Math.round(el.getBoundingClientRect().height / zh);
      };
      const raus = {};
      BETRIEB.claim = gutClaim; zeichne();
      raus.claimBeiGut = zeilen(document.getElementById("claim"));
      BETRIEB.claim = hartClaim; zeichne();
      raus.claimBeiHart = zeilen(document.getElementById("claim"));

      aktionen = [{ id:"m", gericht_name:"Dubai Crêpe", titel:gutRunner,
                    preis_alt:15.9, preis_neu:11.9,
                    bis:new Date(Date.now()+3600000).toISOString() }];
      zeichne();
      const k = document.querySelector(".aktion .kennz");
      raus.runnerBeiGut = k ? zeilen(k) : 0;
      aktionen = []; zeichne();
      return raus;
    }, { gutClaim:  textMit(grenzen.hubClaim.gut),
         hartClaim: textMit(grenzen.hubClaim.hart),
         gutRunner: textMit(grenzen.hubRunner.gut) });

    console.log("  " + breite + "px");
    pruef(zahl.claimBeiGut <= 1,
      "    Slogan bei „gut" + '"' + " noch einzeilig", zahl.claimBeiGut + " Zeile(n)");
    pruef(zahl.claimBeiHart <= 2,
      "    Slogan bei „hart" + '"' + " höchstens zweizeilig", zahl.claimBeiHart + " Zeile(n)");
    pruef(zahl.runnerBeiGut <= 1,
      "    Aktionsname bei „gut" + '"' + " noch einzeilig", zahl.runnerBeiGut + " Zeile(n)");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
