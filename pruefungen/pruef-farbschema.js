/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Sagt jede Seite dem Browser, was sie zeigt?

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-farbschema.js

   DER ANLASSFALL. Ein Gast öffnete Chocos Karte auf einem Samsung mit
   eingeschaltetem Dunkelmodus. Die Figuren und einige Flächen kamen
   „viel heller" heraus als auf dem iPhone.

   Chrome auf Android und Samsung Internet haben ein „dunkles Design
   für Webseiten". Findet der Browser KEINE color-scheme-Angabe, hält
   er die Seite für eine, die kein Dunkel kennt, und färbt sie selbst
   um — er kippt Helligkeiten, und dunkle Konturen werden hell. Keine
   einzige Datei dieses Verzeichnisses hatte die Angabe.

   ZWEITE QUELLE (§8.1b). Eine Liste der Seiten von Hand wäre blind
   für die nächste neue Seite. Deshalb kommt sie aus dem VERZEICHNIS:
   jede .html unter seiten/ und jeder erzeugte Hub unter dist/.

   UND: Geprüft wird nicht, ob dort IRGENDWAS steht, sondern ob es
   stimmt. Ein falsch angesagtes Schema ist schlimmer als keins — der
   Browser richtet Bedienelemente und Rollbalken danach. Deshalb wird
   der wirklich gemalte Grund gemessen und dagegen gehalten.

   EHRLICHE GRENZE. Der kopflose Browser kennt Chromes Auto Dark Theme
   nicht; ich habe fünf Flag-Varianten durchprobiert, keine greift.
   Diese Prüfung kann also NICHT zeigen, dass das Umfärben aufhört —
   nur, dass die Ansage da ist und stimmt. Der Beweis dafür steht auf
   dem Gerät des Gastes.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN   = path.resolve(__dirname, "..");
const SEITEN = path.join(OBEN, "seiten");
const DIST   = path.join(OBEN, "dist");

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

/* Die Liste kommt aus dem Verzeichnis, nicht von Hand. */
function alleSeiten(){
  const raus = [];
  for(const f of fs.readdirSync(SEITEN).sort())
    if(f.endsWith(".html")) raus.push([f.replace(/\.html$/,""), path.join(SEITEN, f)]);
  if(fs.existsSync(DIST))
    for(const s of fs.readdirSync(DIST).sort()){
      const p = path.join(DIST, s, "index.html");
      if(fs.existsSync(p)) raus.push(["hub:" + s, p]);
    }
  return raus;
}

const kanal = c => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
function dunkel(rgb){
  const p = (String(rgb).match(/[\d.]+/g) || []).map(Number);
  if(p.length < 3) return null;
  return (.2126*kanal(p[0]) + .7152*kanal(p[1]) + .0722*kanal(p[2])) < 0.179;
}

async function verdrahten(seite){
  await seite.addInitScript(() => {
    try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){}
  });
  await seite.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
}

/* Was malt die Seite wirklich, und was sagt sie an? */
const MESSUNG = `(() => {
  const h = getComputedStyle(document.documentElement);
  let k = document.documentElement, grund = null;
  while(k){
    const c = getComputedStyle(k).backgroundColor;
    const p = (String(c).match(/[\\d.]+/g) || []).map(Number);
    if(p.length >= 3 && (p.length < 4 || p[3] > 0)){ grund = c; break; }
    k = k.firstElementChild && k.firstElementChild.tagName === "BODY"
        ? k.firstElementChild : null;
  }
  return { schema: h.colorScheme,
           grund: grund || getComputedStyle(document.body).backgroundColor };
})()`;

(async () => {
  const seiten = alleSeiten();
  console.log("\n── Was jede Seite ansagt, gegen das, was sie malt ──");
  pruef(seiten.length >= 8, "Seiten gefunden", seiten.map(s => s[0]).join(", "));

  const browser = await chromium.launch();
  for(const [name, datei] of seiten){
    const ctx = await browser.newContext({ colorScheme:"light", viewport:{width:412,height:915} });
    const seite = await ctx.newPage();
    await verdrahten(seite);
    let m;
    try{
      await seite.goto("file://" + datei);
      await seite.waitForTimeout(500);
      m = await seite.evaluate(MESSUNG);
    }catch(e){
      pruef(false, name.padEnd(16) + "lässt sich nicht öffnen", String(e).slice(0,70));
      await ctx.close(); continue;
    }

    const angesagt = String(m.schema || "normal").trim();
    const istDunkel = dunkel(m.grund);

    /* 1 · Überhaupt eine Ansage. „normal" heißt: keine — und genau
       dann färbt der Browser im Dunkelmodus selbst um. */
    pruef(angesagt !== "normal" && angesagt !== "",
      name.padEnd(16) + "sagt ein Farbschema an", angesagt);

    /* 2 · Und die Ansage stimmt. „light dark" heißt „ich kann beides"
       und ist für eine Seite richtig, die dem System folgt — die wird
       unten getrennt geprüft. */
    if(angesagt !== "normal" && angesagt !== "" && !angesagt.includes(" ")){
      const passt = (angesagt === "dark") === istDunkel;
      pruef(passt, name.padEnd(16) + "die Ansage passt zum Grund",
        angesagt + " bei Grund " + m.grund);
    }
    await ctx.close();
  }

  /* 3 · Wer „light dark" ansagt, muss dem System auch wirklich folgen.
     Sonst ist die Ansage eine Behauptung: Der Browser richtet
     Bedienelemente danach und bekommt dunkle Felder auf heller Seite. */
  console.log("\n── Wer \u201elight dark\u201c sagt, folgt dem System auch ──");
  for(const [name, datei] of seiten){
    const werte = {};
    for(const schema of ["light","dark"]){
      const ctx = await browser.newContext({ colorScheme:schema, viewport:{width:412,height:915} });
      const seite = await ctx.newPage();
      await verdrahten(seite);
      try{
        await seite.goto("file://" + datei);
        await seite.waitForTimeout(400);
        werte[schema] = await seite.evaluate(MESSUNG);
      }catch(e){ werte[schema] = null; }
      await ctx.close();
    }
    if(!werte.light || !werte.dark) continue;
    const sagtBeides = String(werte.light.schema || "").includes(" ");
    const folgt = werte.light.grund !== werte.dark.grund;
    if(sagtBeides || folgt)
      pruef(sagtBeides === folgt, name.padEnd(16) +
        (folgt ? "folgt dem System und sagt es auch"
               : "sagt \u201ebeides\u201c, folgt aber nicht"),
        werte.light.grund + " / " + werte.dark.grund);
  }

  /* 3b · Der ERSTE Anstrich. Beim Gegenbeweis blieb diese Prüfung
     grün, als der Erzeuger fest „light" ins Meta schrieb: nachtSchalten()
     überschreibt den Wert sofort, und gemessen wurde nur das Ergebnis
     danach. Der Browser entscheidet aber VORHER, bevor ein Skript
     läuft — genau dort fällt die Entscheidung übers Umfärben. Deshalb
     wird jetzt das Meta selbst gelesen und gegen die TAGpalette des
     Markenblatts gehalten (zweite Quelle, §8.1b). */
  console.log("\n── Das Meta für den ersten Anstrich ──");
  for(const [name, datei] of seiten.filter(s => s[0].startsWith("hub:"))){
    const slug = name.slice(4);
    const blatt = path.join(OBEN, "markenblaetter", slug + ".json");
    if(!fs.existsSync(blatt)){
      pruef(false, name.padEnd(16) + "Markenblatt zum Vergleich fehlt", blatt);
      continue;
    }
    const mb = JSON.parse(fs.readFileSync(blatt, "utf8"));
    const soll = dunkel(mb.farben.grund) ? "dark" : "light";
    const m = fs.readFileSync(datei, "utf8")
      .match(/<meta name="color-scheme" content="([^"]*)">/);
    pruef(!!m, name.padEnd(16) + "hat ein color-scheme-Meta im Kopf",
      m ? m[1] : "keins");
    if(m) pruef(m[1] === soll,
      name.padEnd(16) + "das Meta passt zur Tagpalette des Hauses",
      m[1] + " bei grund " + mb.farben.grund + ", erwartet " + soll);
  }

  /* 4 · Der Hub schaltet selbst. Dann muss die Ansage MITgehen —
     ein Gast, der auf dunkel stellt, bekommt sonst helle Rollbalken
     auf schwarzem Grund. */
  console.log("\n── Der Hub schaltet, die Ansage geht mit ──");
  for(const [name, datei] of seiten.filter(s => s[0].startsWith("hub:"))){
    const ctx = await browser.newContext({ viewport:{width:412,height:915} });
    const seite = await ctx.newPage();
    await verdrahten(seite);
    await seite.goto("file://" + datei);
    await seite.waitForTimeout(500);
    const paare = {};
    for(const wahl of ["hell","dunkel"]){
      paare[wahl] = await seite.evaluate(w => {
        lichtSetzen(w);
        const h = getComputedStyle(document.documentElement);
        return { schema:h.colorScheme, grund:h.backgroundColor };
      }, wahl);
    }
    for(const [wahl, v] of Object.entries(paare)){
      /* NICHT gegen den Schalter prüfen, gegen den GRUND. Blend hat
         gar keine Abendfassung (abend.an ist false) — dort lässt die
         Wahl „hell" den Grund bei rgb(11,12,15), und „dark" ist die
         richtige Ansage. Meine erste Fassung verglich mit dem Namen
         des Schalters und meldete das als Fehler: genau der Denkfehler
         aus §5.2b, eine Ebene höher. */
      const soll = dunkel(v.grund) ? "dark" : "light";
      pruef(v.schema === soll,
        name.padEnd(16) + "auf \u201e" + wahl + "\u201c passt die Ansage zum Grund",
        v.schema + " bei Grund " + v.grund);
    }
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
