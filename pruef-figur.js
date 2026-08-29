/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Figur des Hauses

     node erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruef-figur.js

   Was hier geprüft wird und warum:

   1 · NICHTS RAGT HERAUS. Die Erdbeere hält Flasche, Zettel und
       Teller neben sich. Im ersten Entwurf lag die Frucht randbündig
       im Feld und die Flasche wurde abgeschnitten — auf dem Schirm
       sah es aus wie ein Zeichenfehler.

   2 · DIE VORGABE TRÄGT. Ein Markenblatt ohne avatar.figur muss den
       Untersetzer bekommen, nicht nichts. Und ein Tippfehler in
       figur muss den Erzeuger anhalten, statt wortlos den
       Untersetzer zu liefern.

   3 · KEIN EMOJI IM BESTELLPASS. Dort standen 🧾🍳🔔 — auf jedem
       Gerät ein anderes Bild, in dem Feld, auf das der wartende Gast
       am längsten schaut.

   4 · KONTRAST WIRD GERECHNET. Gemessen am fertigen Bild, weil
       Schürze und Flächen durchscheinend sein können und nur der
       Browser weiß, was darunter liegt. Tag und Abend.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

const HIER = __dirname;
const BID  = "af095b14-d9ef-41f4-9b97-c4422b0de63f";
const MASSE = [
  { name: "iPhone SE", width: 390, height:  664 },
  { name: "iPhone 14", width: 390, height:  844 },
  { name: "iPad",      width: 820, height: 1180 },
  { name: "Rechner",   width: 1440, height: 900 }
];

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

function erzeugteHubs(){
  const ordner = path.join(HIER, "dist");
  if(!fs.existsSync(ordner)) return [];
  return fs.readdirSync(ordner)
    .filter(s => fs.existsSync(path.join(ordner, s, "index.html")))
    .sort();
}

async function verdrahten(seite){
  /* Auffangroute ZUERST: Playwright prüft die zuletzt registrierte
     Route zuerst. Andersherum schluckt sie alles. */
  await seite.addInitScript(() => {
    try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){}
  });
  await seite.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await seite.route("**/rest/v1/betriebe**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"" }]) }));
}

/* ═══ Kontrast am fertigen Bild ═══════════════════════════════════ */
const MESSUNG = `
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
      const s = getComputedStyle(k);
      const b = zahl(s.backgroundColor);
      /* Bei SVG zählt die Füllung als Grund — die Schürze ist kein
         background, sondern ein fill. */
      const f = k.namespaceURI && k.namespaceURI.indexOf("svg") >= 0 ? zahl(s.fill) : [];
      const nimm = (b.length >= 3 && (b.length < 4 || b[3] > 0)) ? b
                 : (f.length >= 3 && (f.length < 4 || f[3] > 0)) ? f : null;
      if(nimm) stapel.push(nimm);
      if(nimm && (nimm.length === 3 || nimm[3] === 1)) break;
      k = k.parentElement;
    }
    let unten = stapel.pop() || [255,255,255];
    while(stapel.length) unten = mischen(stapel.pop(), unten);
    return unten;
  }
  function wert(vorne, grund){
    const v = mischen(vorne, grund), a = leucht(v), b = leucht(grund);
    return Math.round(((Math.max(a,b)+.05)/(Math.min(a,b)+.05))*100)/100;
  }
  const raus = [];

  /* Der Buchstabe auf der Schürze: --band-text auf --band. */
  const mono = document.querySelector(".f-erdbeere .mono");
  if(mono){
    const sch = document.querySelector(".f-erdbeere .schuerze");
    raus.push({ name:"Monogramm auf Schürze", gross:false,
      wert: wert(zahl(getComputedStyle(mono).fill),
                 zahl(getComputedStyle(sch).fill)) });
  }

  /* Die Knopfschrift auf der Hausfarbe — hier stand einmal fest Weiß. */
  const knopf = document.querySelector(".knopf:not(.zweit)");
  if(knopf){
    const s = getComputedStyle(knopf);
    raus.push({ name:"Knopfschrift auf Hauptfarbe", gross:false,
      wert: wert(zahl(s.color), grundVon(knopf)) });
  }

  /* Arme und Beine liegen auf dem Grund des Hauses, nicht auf der
     Frucht. Abends ist der fast schwarz. */
  const bein = document.querySelector(".f-erdbeere .bein");
  if(bein){
    const seite = document.querySelector(".bpass") || document.body;
    raus.push({ name:"Gliedmaßen auf Grund", gross:true,
      wert: wert(zahl(getComputedStyle(bein).stroke), grundVon(seite)) });
  }

  /* Die Frucht gegen ihren Grund — sonst ist die Figur ein Fleck. */
  const frucht = document.querySelector(".f-erdbeere .frucht");
  if(frucht){
    const seite = document.querySelector(".bpass") || document.body;
    raus.push({ name:"Frucht auf Grund", gross:true,
      wert: wert(zahl(getComputedStyle(frucht).fill), grundVon(seite)) });
  }
  return raus;
})()
`;

/* Liegt alles im Feld? getBBox() rechnet ohne Konturbreite, deshalb
   ein kleiner Spielraum. */
const RANDMESSUNG = `
(() => {
  return Array.prototype.map.call(document.querySelectorAll("svg.figur"), s => {
    const vb = s.viewBox.baseVal, b = s.getBBox();
    const pass = s.closest(".bpass");
    return { wo: pass ? pass.className : (s.getAttribute("class") || ""),
             links: Math.round((b.x - vb.x)*10)/10,
             oben:  Math.round((b.y - vb.y)*10)/10,
             rechts:Math.round((vb.x + vb.width  - b.x - b.width)*10)/10,
             unten: Math.round((vb.y + vb.height - b.y - b.height)*10)/10 };
  });
})()
`;

(async () => {
  const hubs = erzeugteHubs();
  if(!hubs.length){
    console.log("Kein erzeugter Hub in dist/. Erst „node erzeuge-hub.js --alle“ laufen lassen.");
    process.exit(1);
  }

  /* ───── 0 · Laufen Gerüst und Studio auseinander? ─────
     Es gibt bewusst kein Bauwerkzeug, geteilter Code wird kopiert.
     Eine Kopie ohne Wächter läuft irgendwann auseinander — dann
     gestaltet der Kunde im Studio eine andere Figur, als sein Gast
     im Hub bekommt. Deshalb Zeichen für Zeichen. */
  console.log("\n── Gerüst und Studio ──");
  {
    const hub    = fs.readFileSync(path.join(HIER, "hub.vorlage.html"), "utf8");
    const studio = fs.readFileSync(path.join(HIER, "marken-studio.html"), "utf8");
    const bloecke = [
      ["Zeichnung (JS)",
       /\/\* ╔═══ FIGUR · GETEILTER BLOCK · ANFANG[\s\S]*?\/\* ╚═══ FIGUR · GETEILTER BLOCK · ENDE ═+╝ \*\//],
      ["Farben (CSS)",
       /\/\* ╔═══ FIGUR · GETEILTER BLOCK \(CSS\) · ANFANG[\s\S]*?\/\* ╚═══ FIGUR · GETEILTER BLOCK \(CSS\) · ENDE ═+╝ \*\//]
    ];
    for(const [name, muster] of bloecke){
      const a = hub.match(muster), b = studio.match(muster);
      if(!a || !b){
        pruef(false, name + ": Block fehlt in " + (!a ? "hub.vorlage.html" : "marken-studio.html"));
        continue;
      }
      const gleich = a[0] === b[0];
      let wo = "";
      if(!gleich){
        const za = a[0].split("\n"), zb = b[0].split("\n");
        for(let i = 0; i < Math.max(za.length, zb.length); i++)
          if(za[i] !== zb[i]){ wo = "erste Abweichung in Zeile " + (i+1) + " des Blocks"; break; }
      }
      pruef(gleich, name + ": Gerüst und Studio sind wortgleich",
        gleich ? a[0].split("\n").length + " Zeilen" : wo);
    }
  }

  /* ───── 1 · Der Erzeuger hält bei unbekannter Figur an ───── */
  console.log("\n── Erzeuger ──");
  {
    const quelle = hubs.map(s => path.join(HIER, s + ".json")).filter(fs.existsSync)[0];
    if(!quelle){
      pruef(false, "kein Markenblatt zum Prüfen gefunden");
    } else {
      const mb = JSON.parse(fs.readFileSync(quelle, "utf8"));
      const probe = path.join(HIER, "pruefling.json");
      try {
        /* unbekannter Wert → Fehler, nichts wird geschrieben */
        mb.betrieb.slug = "pruefling";
        mb.avatar = Object.assign({}, mb.avatar, { figur: "banane" });
        fs.writeFileSync(probe, JSON.stringify(mb));
        let hielt = false, meldung = "";
        try { execFileSync("node", ["erzeuge-hub.js", "pruefling", "--pruefen-nur"],
                { cwd: HIER, encoding: "utf8", stdio: "pipe" }); }
        catch(e){ hielt = true; meldung = String(e.stdout || "") + String(e.stderr || ""); }
        pruef(hielt && /figur unbekannt/.test(meldung),
          "unbekannte Figur hält den Erzeuger an", meldung.trim().split("\n").pop());

        /* ganz ohne figur → läuft durch */
        delete mb.avatar.figur;
        fs.writeFileSync(probe, JSON.stringify(mb));
        let lief = true;
        try { execFileSync("node", ["erzeuge-hub.js", "pruefling", "--pruefen-nur"],
                { cwd: HIER, encoding: "utf8", stdio: "pipe" }); }
        catch(e){ lief = false; }
        pruef(lief, "Markenblatt ohne figur läuft weiter");
      } finally {
        if(fs.existsSync(probe)) fs.unlinkSync(probe);
        const raus = path.join(HIER, "dist", "pruefling");
        if(fs.existsSync(raus)) fs.rmSync(raus, { recursive:true, force:true });
      }
    }
  }

  const browser = await chromium.launch();

  /* ───── 2 · Jedes Haus: Figur, Züge, Ränder, Bestellpass ───── */
  for(const slug of hubs){
    const datei = "file://" + path.join(HIER, "dist", slug, "index.html");

    for(const [phase, stunde] of [["Tag", 14], ["Abend", 22]]){
      const ctx = await browser.newContext({ viewport: MASSE[1] });
      const seite = await ctx.newPage();
      await verdrahten(seite);
      await seite.goto(datei);
      await seite.waitForTimeout(400);
      await seite.evaluate(h => { stunde = h; nachtSchalten(); }, stunde);

      const figur = await seite.evaluate(() => avatarFigur());
      console.log("\n── " + slug + " · " + phase + " · Figur: " + figur + " ──");

      /* alle drei Züge und alle Haltungen nebeneinander bauen */
      await seite.evaluate(() => {
        const wk = document.querySelector(".willkommen"); if(wk) wk.remove();
        const posen = ["neu","arbeit","fertig"];
        let h = '<div class="seite">' + posen.map(s => phaseHTML(s, 217)).join("");
        ["freundlich","ruhig","witzig"].forEach(a => {
          MARKENBLATT.avatar = Object.assign({}, MARKENBLATT.avatar, { art:a });
          h += begleiterHTML("start");
        });
        h += '<a class="knopf" href="#/">Knopf zur Messung</a>';
        document.getElementById("inhalt").innerHTML = h + '</div>';
      });
      await seite.waitForTimeout(300);

      const paesse = await seite.$$(".bpass");
      pruef(paesse.length === 3, "drei Phasen gezeichnet", "n=" + paesse.length);

      const text = await seite.textContent("#inhalt");
      const emoji = (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [])
        .filter(z => "✓✕★".indexOf(z) < 0);
      pruef(emoji.length === 0, "kein Emoji im Bestellpass", emoji.join(" ") || "keins");

      const zeichen = await seite.$$(".bp-zeichen svg");
      pruef(zeichen.length === 3, "jede Phase hat ein gezeichnetes Bild",
        "n=" + zeichen.length);

      const raender = await seite.evaluate(RANDMESSUNG);
      const eng = raender.filter(r => Math.min(r.links, r.oben, r.rechts, r.unten) < -2);
      pruef(eng.length === 0, "nichts ragt aus dem Feld",
        eng.length ? JSON.stringify(eng[0]) : raender.length + " Figuren geprüft");

      for(const w of await seite.evaluate(MESSUNG)){
        const grenze = w.gross ? 3 : 4.5;
        pruef(w.wert >= grenze,
          w.name.padEnd(28) + w.wert.toFixed(2) + ":1", "mind. " + grenze);
      }
      await ctx.close();
    }
  }

  /* ───── 3 · Maße ───── */
  console.log("\n── Maße ──");
  for(const m of MASSE){
    const ctx = await browser.newContext({ viewport: m });
    const seite = await ctx.newPage();
    await verdrahten(seite);
    await seite.goto("file://" + path.join(HIER, "dist", hubs[0], "index.html"));
    await seite.waitForTimeout(400);
    await seite.evaluate(() => {
      const wk = document.querySelector(".willkommen"); if(wk) wk.remove();
      document.getElementById("inhalt").innerHTML = '<div class="seite">' +
        ["neu","arbeit","fertig"].map(s => phaseHTML(s, 217)).join("") + '</div>';
    });
    await seite.waitForTimeout(300);
    const ueber = await seite.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(ueber <= 1, m.name + ": kein seitliches Schieben", "Überstand " + ueber + "px");
    await ctx.close();
  }

  /* ───── 4 · Bewegung reduzieren ───── */
  console.log("\n── prefers-reduced-motion ──");
  {
    const ctx = await browser.newContext({ viewport: MASSE[1], reducedMotion: "reduce" });
    const seite = await ctx.newPage();
    await verdrahten(seite);
    await seite.goto("file://" + path.join(HIER, "dist", hubs[0], "index.html"));
    await seite.waitForTimeout(400);
    await seite.evaluate(() => {
      const wk = document.querySelector(".willkommen"); if(wk) wk.remove();
      document.getElementById("inhalt").innerHTML = '<div class="seite">' +
        ["neu","arbeit","fertig"].map(s => phaseHTML(s, 217)).join("") + '</div>';
    });
    await seite.waitForTimeout(300);
    const laeuft = await seite.evaluate(() =>
      Array.prototype.filter.call(
        document.querySelectorAll(".bpass *"),
        el => getComputedStyle(el).animationIterationCount === "infinite" &&
              getComputedStyle(el).animationName !== "none"
      ).map(el => el.getAttribute("class") || el.tagName));
    pruef(laeuft.length === 0, "nichts läuft endlos", laeuft.join(", ") || "keins");
    /* Die HALTUNG muss bleiben — sie trägt die Phase, nicht die Bewegung. */
    const sichtbar = await seite.$$(".bp-zeichen svg");
    pruef(sichtbar.length === 3, "die Haltungen stehen trotzdem");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
