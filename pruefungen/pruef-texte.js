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
const { execFileSync } = require("child_process");
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
      const k = document.querySelector("#aktionBlatt .ak-titel");
      return k ? k.textContent : "";
    });
    pruef(band === "Happy Hour", "Aktion ohne eigenen Titel nimmt die Vorgabe", band);

    /* Aktion MIT eigenem Titel → der gewinnt. */
    const band2 = await seite.evaluate(() => {
      aktionen = [{ id:"m", gericht_name:"Dubai Crêpe", titel:"Nur heute",
                    preis_alt:15.9, preis_neu:11.9,
                    bis:new Date(Date.now()+3600000).toISOString() }];
      zeichne();
      const k = document.querySelector("#aktionBlatt .ak-titel");
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
      const k = document.querySelector("#aktionBlatt .ak-titel");
      raus.runnerBeiGut = k ? zeilen(k) : 0;
      aktionen = []; zeichne();
      return raus;
    }, { gutClaim:  textMit(grenzen.hubClaim.gut),
         hartClaim: textMit(grenzen.hubClaim.hart),
         gutRunner: textMit(grenzen.hubRunner.gut) });

    console.log("  " + breite + "px");
    pruef(zahl.claimBeiGut <= 1,
      "    Slogan bei „gut" + '"' + " noch einzeilig", zahl.claimBeiGut + " Zeile(n)");
    /* Seit 26.09. darf der Slogan 90 Zeichen haben (Wunsch des
       Betreibers: mehr Platz für eigene Worte). Die Regel lautet
       jetzt: Der Kopf wächst höchstens auf DREI Zeilen, der Rest
       endet mit „…" (line-clamp) — gemessen an der gezeichneten Höhe,
       nicht an der Zeichenzahl. */
    pruef(zahl.claimBeiHart <= 3,
      "    Slogan bei „hart" + '"' + " höchstens dreizeilig", zahl.claimBeiHart + " Zeile(n)");
    /* Der Aktions-Knopf zeigt den Titel im Blatt in höchstens zwei Zeilen (line-clamp:2, seit 26.10.); einzeilig war der Streifen. */
    pruef(zahl.runnerBeiGut <= 2,
      "    Aktionsname bei „gut\" noch höchstens zweizeilig", zahl.runnerBeiGut + " Zeile(n)");
    await ctx.close();
  }

  /* ═══ Die Sätze, die der Betrieb seit Block 7 selbst schreibt ═══
     Bestellpass und Begleiter. Dieselben vier Schranken wie oben, nur
     ist die erste hier das Studio und nicht das Board — geprüft wird
     die VIERTE (der Hub schneidet ab) und die Zahl selbst.

     Die Grenzen kommen aus dem GERÜST, nicht von hier: Sie hier
     abzuschreiben hieße, die Prüfung prüft ihre eigene Kopie. */
  console.log("\n── Eigene Sätze: Bestellpass und Begleiter ──");
  {
    const geruest = fs.readFileSync(
      path.join(HIER, "vorlagen", "hub.vorlage.html"), "utf8");
    const tm = geruest.match(/const E_TEXTMASS = \{([\s\S]*?)\n\};/);
    const mass = {};
    if(tm) for(const m of tm[1].matchAll(
        /(\w+):\s*\{\s*gut:\s*(\d+),\s*hart:\s*(\d+)/g))
      mass[m[1]] = { gut:+m[2], hart:+m[3] };
    pruef(!!mass.phase && !!mass.begleiter, "Grenzen im Gerüst gefunden",
      JSON.stringify(mass));
    if(mass.phase){
      /* Klassisch UND Premium (31.10.): Premium setzt den Satz in 15,5 px — dort brach das Versprechen zuerst, und diese
       Probe sah nur das erste Haus. */
    const TEXTHAEUSER = [...new Set([liste[0], liste.includes("chocolamour") ? "chocolamour" : liste[0]])];
    for(const haus of TEXTHAEUSER) for(const breite of BREITEN){
        const ctx = await browser.newContext({ viewport:{ width:breite, height:900 } });
        const seite = await ctx.newPage();
        await verdrahten(seite);
        await seite.goto("file://" + path.join(HIER, "dist", haus, "index.html"));
        await seite.waitForTimeout(400);
        const r = await seite.evaluate(({ mass, worte }) => {
          const wk = document.querySelector(".willkommen"); if(wk) wk.remove();
          const satz = n => { let s = "", i = 0;
            while(s.length < n) s += (s ? " " : "") + worte[i++ % worte.length];
            return s.slice(0, n); };
          const zeilen = el => el ? Math.round(el.getBoundingClientRect().height /
            parseFloat(getComputedStyle(el).lineHeight)) : 0;
          const zeig = (gruppe, schluessel, text, bau, wahl) => {
            MARKENBLATT.texte = { [gruppe]: { [schluessel]: text } };
            document.getElementById("inhalt").innerHTML = bau();
            const el = document.querySelector(wahl);
            const erg = { zeilen: zeilen(el), text: el ? el.textContent : "" };
            delete MARKENBLATT.texte;
            return erg;
          };
          const pass = () => phaseHTML("arbeit", 217);
          const begl = () => begleiterHTML("start");
          const raus = {
            passGut:  zeig("phase","arbeit", satz(mass.phase.gut), pass, ".bp-text"),
            passHart: zeig("phase","arbeit", satz(mass.phase.hart), pass, ".bp-text"),
            beglGut:  zeig("figur","start", satz(mass.begleiter.gut), begl, ".begleiter p"),
            beglHart: zeig("figur","start", satz(mass.begleiter.hart), begl, ".begleiter p")
          };
          /* Die VIERTE Schranke: Was zu lang ins Markenblatt kommt,
             schneidet der Hub beim Lesen ab. */
          raus.abgeschnitten = zeig("phase","arbeit", satz(mass.phase.hart) +
            " und noch viel mehr Text hinterher", pass, ".bp-text").text.length;
          /* Und die Sprachen: Ein eigener Satz steht in ALLEN zwölf
             gleich da, eine Vorgabe wird übersetzt. Beides ist Absicht,
             und beides muss man belegen können. */
          /* DER SATZ MUSS IM WÖRTERBUCH STEHEN, sonst kann diese
             Prüfung ihren eigenen Anlassfall nicht sehen: Ein
             erfundener Satz käme auch durch t() unverändert heraus,
             und die Prüfung bliebe grün, während der Hub die Sätze
             des Hauses in Wirklichkeit übersetzt. Genommen wird
             deshalb die Vorgabe der anderen Phase — die steht
             garantiert in allen zwölf Sprachen drin. */
          const probe = E_PHASENTEXTE.fertig;
          const eigen = {}, vorgabe = {};
          for(const sp of SPRACHEN.map(x => x.code)){
            sprache = sp;
            eigen[sp] = zeig("phase","arbeit", probe, pass, ".bp-text").text;
            document.getElementById("inhalt").innerHTML = pass();
            vorgabe[sp] = document.querySelector(".bp-text").textContent;
          }
          sprache = "de";
          raus.probe = probe;
          raus.eigenGleich = Object.values(eigen).every(x => x === probe);
          raus.vorgabeUebersetzt = new Set(Object.values(vorgabe)).size > 1;
          raus.sprachen = Object.keys(eigen).length;
          return raus;
        }, { mass, worte: ["Frisch","gebacken","jeden","Tag","für","Sie","mit","viel",
                           "Liebe","und","Schokolade","aus","der","eigenen","Küche"] });

        console.log("  " + haus + " · " + breite + "px");
        pruef(r.passGut.zeilen <= 1, "    Passtext bei „gut\u201c noch einzeilig",
          r.passGut.zeilen + " Zeile(n)");
        pruef(r.passHart.zeilen <= 2, "    Passtext bei „hart\u201c höchstens zweizeilig",
          r.passHart.zeilen + " Zeile(n)");
        pruef(r.beglGut.zeilen <= 2, "    Begleitersatz bei „gut\u201c höchstens zweizeilig",
          r.beglGut.zeilen + " Zeile(n)");
        pruef(r.beglHart.zeilen <= 3, "    Begleitersatz bei „hart\u201c höchstens dreizeilig",
          r.beglHart.zeilen + " Zeile(n)");
        pruef(r.abgeschnitten <= mass.phase.hart,
          "    zu langer Satz wird beim Lesen gekürzt",
          r.abgeschnitten + " von erlaubten " + mass.phase.hart + " Zeichen");
        pruef(r.eigenGleich, "    eigener Satz steht in allen Sprachen gleich da",
          r.sprachen + " Sprachen, Probe: \u201e" + r.probe + "\u201c");
        pruef(r.vorgabeUebersetzt, "    die Vorgabe wird weiterhin übersetzt");
        await ctx.close();
      }
    }
  }

  /* Die ZWEITE Schranke: Der Erzeuger muss ablehnen, was der Hub
     hinterher abschneiden würde. Ohne diese Prüfung wäre die
     Längengrenze im Gerüst eine Zahl, an die sich niemand halten
     muss. */
  console.log("\n── Der Erzeuger lehnt zu lange Sätze ab ──");
  {
    const blatt = path.join(HIER, "markenblaetter", liste[0] + ".json");
    const probe = path.join(HIER, "markenblaetter", "textprobe.json");
    try{
      const mb = JSON.parse(fs.readFileSync(blatt, "utf8"));
      mb.betrieb.slug = "textprobe";
      const faelle = [
        ["genau an der Grenze",  "x".repeat(80),  false],
        ["ein Zeichen darüber",  "x".repeat(81),  true],
        ["weit darüber",         "x".repeat(300), true],
        ["falscher Schlüssel",   null,            true]
      ];
      for(const [name, wert, sollHalten] of faelle){
        mb.texte = wert === null
          ? { phase: { arbeitt: "kurz" } }
          : { phase: { arbeit: wert } };
        fs.writeFileSync(probe, JSON.stringify(mb));
        let hielt = false;
        try { execFileSync("node",
          [path.join(HIER, "erzeuger", "erzeuge-hub.js"), "textprobe", "--pruefen-nur"],
          { cwd: HIER, encoding: "utf8", stdio: "pipe" }); }
        catch(e){ hielt = true; }
        pruef(hielt === sollHalten,
          "  " + name + (sollHalten ? " hält den Erzeuger an" : " läuft durch"),
          hielt ? "hält an" : "läuft durch");
      }
    } finally {
      if(fs.existsSync(probe)) fs.unlinkSync(probe);
      const raus = path.join(HIER, "dist", "textprobe");
      if(fs.existsSync(raus)) fs.rmSync(raus, { recursive:true, force:true });
    }
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
