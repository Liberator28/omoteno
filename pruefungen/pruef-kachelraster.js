/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Kacheln im Hub: Breite, Selbst-Füllen, Farbe, Bildform,
             ohne Symbol  (braucht dist/)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-kachelraster.js

   Wunsch des Betreibers (26.09.): Die Knöpfe richten Lage und Breite
   danach, wie viele aktiv sind — „die Speisekarte zieht sich breit“.
   Breite je Kachel wählbar, Bildform wählbar, eigene Farbe je Kachel,
   und ohne Symbol soll die Kachel nicht leer aussehen.

   Gemessen wird am gezeichneten Bild (getBoundingClientRect,
   getComputedStyle), nicht am Auszeichnungstext:
     · Packen: Reihen gehen genau auf, eine Kachel allein steht über
       die ganze Breite, zwei teilen sich die Reihe gleich
     · Standard (ohne Board-Angaben): drei Säulen und das Zweierraster
       wie vorher
     · Positivliste: raster/stil/farbe aus der Live-Spalte können kein
       Attribut mehr aufmachen (vorher roh in class= und data-farbe=)
     · Farbe: Schrift ≥ 4,5:1 auf jeder Farbe, auch auf mittlerem Grau
     · Bildform „flaeche“: Schrift über einem REIN WEISSEN Foto ≥ 4,5:1;
       „rund“: Kreis statt Symbol
     · Ohne Symbol: Akzentstrich, größere Schrift, Säule unten bündig
     · 360–1280 px ohne Überlauf, in zwei Häusern, keine Laufzeitfehler
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const OBEN = path.resolve(__dirname, "..");

let n = 0, f = 0;
const pruef = (gut, text, mehr) => { n++; if(!gut) f++;
  console.log((gut ? "  ok   " : "  FEHL ") + text + (mehr !== undefined ? "  → " + mehr : "")); };

const ALLE = ["speisekarte","getraenke","cocktails","tischruf","wlan","quiz","musikwunsch",
              "meintisch","bewertung","reservierung","instagram","kontakt","trinkgeld"];
/* Die Board-Spalte ist IMMER die ganze Liste (kbRoh schickt jede Kachel).
   Nur Genanntes gilt als an; alles andere wird ausgeschaltet. */
const liste = eintraege => ALLE.map(s => Object.assign({ schluessel:s, an:false },
  (eintraege.find(e => e.schluessel === s) ? Object.assign({ an:true }, eintraege.find(e => e.schluessel === s)) : {})));

/* Ein Foto, das bewusst REIN WEISS ist: der ungünstigste Fall für
   weiße Schrift auf dem Bild. */
const WEISS = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#ffffff"/></svg>';

async function hubAuf(br, haus, breite, kacheln){
  const ctx = await br.newContext({ viewport:{ width:breite, height:900 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(u.includes("bild.probe")) return r.fulfill({ status:200, contentType:"image/svg+xml", body:WEISS });
    if(u.includes("/rest/v1/betriebe"))
      return r.fulfill({ status:200, contentType:"application/json",
        body:JSON.stringify([kacheln ? { id:"x", hub_kacheln:kacheln } : { id:"x" }]) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await p.addInitScript(() => {
    try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){}
    /* Uhr fest (§8.1j): 14 Uhr — Quiz ab 11, Musikwunsch ab 17 wäre sonst Zufall. */
    const echt = Date; const fest = new echt("2026-09-26T14:00:00").getTime();
    // eslint-disable-next-line no-global-assign
    Date = class extends echt { constructor(...a){ super(...(a.length ? a : [fest])); } static now(){ return fest; } };
  });
  await p.goto("file://" + path.join(OBEN, "dist", haus, "index.html"));
  await p.waitForTimeout(1800);
  return { p, ctx, fehler };
}

/* Alle Kacheln der Startseite mit Maß und Stil. */
const MESSEN = () => {
  const farbe = c => { const m = c.match(/[\d.]+/g) || []; return m.slice(0, 3).map(Number); };
  const lum = ([r, g, b]) => { const k = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); };
    return .2126 * k(r) + .7152 * k(g) + .0722 * k(b); };
  const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  return [...document.querySelectorAll("#inhalt .gitter")].map(g => {
    const gr = g.getBoundingClientRect();
    return { breite: gr.width, links: gr.left, kacheln: [...g.querySelectorAll(":scope > a.kachel")].map(a => {
      const r = a.getBoundingClientRect(), cs = getComputedStyle(a);
      const st = a.querySelector(".txt strong"), sts = st && getComputedStyle(st);
      const vor = a.querySelector(".txt") ? getComputedStyle(a.querySelector(".txt"), "::before") : null;
      const kb = a.querySelector(".kbanner"), kbr = kb && kb.getBoundingClientRect();
      const nach = kb ? getComputedStyle(kb, "::after") : null;
      return {
        s: a.dataset.kachel, klassen: a.className, spalten: +a.dataset.spalten,
        x: r.left, y: r.top, w: r.width, h: r.height,
        grund: cs.backgroundColor, tinte: sts ? sts.color : "", schrift: sts ? parseFloat(sts.fontSize) : 0,
        kontrast: st ? kontrast(farbe(sts.color), farbe(cs.backgroundColor)) : 0,
        ueberlauf: st ? st.scrollWidth - st.clientWidth : 0,
        ico: !!a.querySelector(".ico"),
        strich: vor ? vor.content !== "none" && parseFloat(vor.height) > 0 : false,
        txtUnten: a.querySelector(".txt") ? r.bottom - a.querySelector(".txt").getBoundingClientRect().bottom : null,
        banner: kbr ? { w: kbr.width, h: kbr.height, x: kbr.left, y: kbr.top, rund: getComputedStyle(kb).borderRadius,
                        schleier: nach ? nach.backgroundColor : "" } : null,
        attrs: [...a.attributes].map(x => x.name)
      };
    }) };
  });
};

(async () => {
  if(!fs.existsSync(path.join(OBEN, "dist", "chocolamour", "index.html"))){
    console.error("Kein erzeugter Hub in dist/. Erst: node erzeuger/erzeuge-hub.js --alle"); process.exit(1);
  }
  const br = await chromium.launch();

  /* ── 1 · Packen, als Rechnung ─────────────────────────────────── */
  console.log("\n══ Packen (kachelReihen) ══");
  {
    const { p, ctx } = await hubAuf(br, "chocolamour", 390, null);
    const r = await p.evaluate(() => {
      const f = arr => kachelReihen(arr.map(b => ({ breite:b }))).map(z => z.map(x => x.spalten + x.form[0]).join(" ")).join(" | ");
      return {
        eins: f(["drittel"]), zwei: f(["drittel","drittel"]), drei: f(["drittel","drittel","drittel"]),
        halb: f(["halb"]), gemischt: f(["drittel","halb"]), lang: f(["drittel","drittel","drittel","halb","voll","halb","halb"]),
        standard: f(["", "", ""]),
        altRaster: kachelReihen([{ raster:"saeulen" }, { raster:"saeulen" }, { raster:"saeulen" }]).map(z => z.map(x => x.spalten).join(",")).join("|")
      };
    });
    pruef(r.eins === "6v", "eine Kachel allein zieht sich über die ganze Breite", r.eins);
    pruef(r.zwei === "3s 3s", "zwei Säulen teilen sich die Reihe (bleiben Säulen)", r.zwei);
    pruef(r.drei === "2s 2s 2s", "drei Säulen wie bisher", r.drei);
    pruef(r.halb === "6v", "eine halbe allein wird ganz breit", r.halb);
    pruef(r.gemischt === "3s 3h", "Drittel + Hälfte geht auf, gleich breit", r.gemischt);
    /* Die Hälfte vor „voll“ steht allein in ihrer Reihe — und streckt sich. */
    pruef(r.lang === "2s 2s 2s | 6v | 6v | 3h 3h", "Reihen gehen immer genau auf (allein → ganz)", r.lang);
    pruef(r.standard === "6v | 6v | 6v", "ohne Angabe: jede ganz breit (Reihe mit Unterzeile)", r.standard);
    pruef(r.altRaster === "2,2,2", "altes raster:saeulen gilt weiter als Drittel", r.altRaster);
    await ctx.close();
  }

  for(const haus of ["chocolamour", "blend"]){
    /* ── 2 · Standard: wie vorher ───────────────────────────────── */
    console.log("\n══ " + haus + " · Standard (ohne Board-Angaben) ══");
    {
      const { p, ctx, fehler } = await hubAuf(br, haus, 390, null);
      const g = await p.evaluate(MESSEN);
      const reihenOk = g.every(gr => {
        const zeilen = {};
        gr.kacheln.forEach(k => { const y = Math.round(k.y); (zeilen[y] = zeilen[y] || []).push(k); });
        return Object.values(zeilen).every(z => Math.abs(z.reduce((a, k) => a + k.w, 0) + (z.length - 1) * (z.length > 1 ? (z[1].x - z[0].x - z[0].w) : 0) - gr.breite) <= 2);
      });
      pruef(g.length >= 2, "Voraussetzung: Kachelbereiche stehen da", g.length);
      pruef(reihenOk, "jede Reihe geht genau auf (keine Lücke rechts)");
      const karte = g[0] && g[0].kacheln.filter(k => /saeule/.test(k.klassen));
      pruef(karte && karte.length === 3 && karte.every(k => Math.abs(k.w - karte[0].w) <= 1 && Math.abs(k.y - karte[0].y) <= 1),
        "Die Karte: drei gleich breite Säulen nebeneinander", karte && karte.map(k => Math.round(k.w)).join("/"));
      pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
      await ctx.close();
    }

    /* ── 3 · Nur die Speisekarte an ─────────────────────────────── */
    console.log("══ " + haus + " · „die Speisekarte zieht sich breit“ ══");
    {
      const { p, ctx } = await hubAuf(br, haus, 390, liste([{ schluessel:"speisekarte" }, { schluessel:"tischruf" }]));
      const g = await p.evaluate(MESSEN);
      const sk = g[0] && g[0].kacheln.find(k => k.s === "speisekarte");
      pruef(!!sk, "Voraussetzung: Speisekarte steht da");
      if(sk){
        pruef(Math.abs(sk.w - g[0].breite) <= 1, "allein: so breit wie die ganze Reihe", Math.round(sk.w) + " / " + Math.round(g[0].breite));
        pruef(!/saeule/.test(sk.klassen), "und als breite Reihe gezeichnet, nicht als schmale Säule", sk.klassen);
      }
      await ctx.close();
      const z = await hubAuf(br, haus, 390, liste([{ schluessel:"speisekarte" }, { schluessel:"getraenke" }]));
      const g2 = await z.p.evaluate(MESSEN);
      const zwei = g2[0] ? g2[0].kacheln : [];
      pruef(zwei.length === 2 && Math.abs(zwei[0].w - zwei[1].w) <= 1 && Math.abs(zwei[0].y - zwei[1].y) <= 1 &&
            zwei[0].w > g2[0].breite * .45, "zwei an: halbe–halbe in einer Reihe", zwei.map(k => Math.round(k.w)).join("/"));
      await z.ctx.close();
    }

    /* ── 4 · Positivliste: nichts aus der Live-Spalte macht ein Attribut auf ── */
    console.log("══ " + haus + " · Positivliste ══");
    {
      const { p, ctx, fehler } = await hubAuf(br, haus, 390, liste([
        { schluessel:"speisekarte", stil:'x" onclick="window.__boese=1', farbe:'"><img src=x onerror="window.__boese=2">',
          raster:'zwei" data-boese="1', breite:"riesig", bildform:"<b>", grund:"red" },
        /* bildform wirkt nur MIT Bild, und nur ein Anführungszeichen
           öffnet ein Attribut — die erste Fassung dieser Probe hatte
           beides nicht und blieb beim Gegenbeweis grün (§8.1g). */
        { schluessel:"tischruf", banner:"https://bild.probe/w.svg", bildform:'x" onclick="window.__boese=3' }]));
      const r = await p.evaluate(() => ({
        attrs: [...document.querySelectorAll("#inhalt a.kachel")].flatMap(a => [...a.attributes].map(x => x.name)),
        img: !!document.querySelector('#inhalt img[src="x"]'),
        boese: window.__boese || 0,
        grund: !!document.querySelector("#inhalt a.kachel.hatgrund"),
        spalten: (document.querySelector('#inhalt a.kachel[data-kachel="speisekarte"]') || {}).dataset
      }));
      pruef(!r.attrs.some(a => /^on|boese/.test(a)), "kein fremdes Attribut an einer Kachel", r.attrs.filter(a => /^on|boese/.test(a)).join(",") || "keins");
      pruef(!r.img && !r.boese, "kein eingeschleustes Element, kein Skript");
      pruef(!r.grund, "„red“ ist keine Farbe im Format #RRGGBB → keine eigene Farbe");
      pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
      await ctx.close();
    }

    /* ── 5 · Farbe, Bildform, ohne Symbol ───────────────────────── */
    console.log("══ " + haus + " · Farbe, Bildform, ohne Symbol ══");
    const FARBEN = ["#777777", "#A83A2E", "#F2C94C", "#1E3A8A", "#FFFFFF", "#000000"];
    /* Nur Kacheln, die um 14 Uhr in JEDEM Haus stehen: Musikwunsch erst
       ab 17, Instagram nur mit Adresse, Trinkgeld nur mit PayPal. */
    const FARBIG = ["tischruf", "wlan", "quiz", "meintisch", "bewertung", "reservierung"];
    const bunt = liste([
      ...FARBEN.map((c, i) => ({ schluessel:FARBIG[i], grund:c, breite:"halb" })),
      { schluessel:"speisekarte", bildform:"flaeche", banner:"https://bild.probe/w.svg", breite:"voll" },
      /* Getränke (mit Symbol) und Cocktails (ohne) teilen sich eine Reihe
         als zwei Säulen — allein stünde jede über die ganze Breite und
         wäre gar keine Säule (erste Fassung, Gegenbeweis grün). */
      { schluessel:"getraenke", breite:"drittel" },
      { schluessel:"cocktails", iconAus:true, breite:"drittel" },
      { schluessel:"kontakt", bildform:"rund", banner:"https://bild.probe/w.svg", breite:"voll" }
    ]);
    for(const breite of [360, 390, 430, 1280]){
      const { p, ctx, fehler } = await hubAuf(br, haus, breite, bunt);
      const g = await p.evaluate(MESSEN);
      const k = [].concat(...g.map(x => x.kacheln));
      const seite = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      pruef(seite <= 0, breite + " px: kein seitlicher Überlauf", seite + " px");
      pruef(!k.some(x => x.ueberlauf > 1), breite + " px: kein Titel läuft aus seiner Kachel",
        k.filter(x => x.ueberlauf > 1).map(x => x.s).join(",") || "keiner");
      if(breite !== 390){ await ctx.close(); continue; }

      const farbig = k.filter(x => /hatgrund/.test(x.klassen));
      pruef(farbig.length === FARBEN.length, "Voraussetzung: jede Farbe ist eine eigene Kachel", farbig.length);
      const schwach = farbig.filter(x => x.kontrast < 4.5);
      pruef(!schwach.length, "Schrift auf jeder Farbe ≥ 4,5:1 (auch mittleres Grau)",
        schwach.map(x => x.s + " " + x.kontrast.toFixed(2)).join(" | ") || "kleinster Wert " + Math.min(...farbig.map(x => x.kontrast)).toFixed(2));

      const fl = k.find(x => x.s === "speisekarte");
      pruef(!!fl && /bild-flaeche/.test(fl.klassen) && !!fl.banner, "Voraussetzung: „flaeche“ steht da");
      if(fl && fl.banner){
        pruef(Math.abs(fl.banner.w - fl.w) <= 2 && Math.abs(fl.banner.h - fl.h) <= 2, "„flaeche“: das Bild füllt die ganze Kachel",
          Math.round(fl.banner.w) + "×" + Math.round(fl.banner.h) + " / " + Math.round(fl.w) + "×" + Math.round(fl.h));
        /* Weiß über weißem Foto unter dem Schleier: gerechnet aus dem
           GEZEICHNETEN Schleier, nicht aus dem Wert im Quelltext. */
        const a = parseFloat((fl.banner.schleier.match(/[\d.]+/g) || [])[3] || "0");
        const unten = Math.round(255 * (1 - a));
        const lum = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
        const tinte = (fl.tinte.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const Lt = .2126 * lum(tinte[0]) + .7152 * lum(tinte[1]) + .0722 * lum(tinte[2]), Lg = lum(unten);
        const kon = (Math.max(Lt, Lg) + .05) / (Math.min(Lt, Lg) + .05);
        pruef(kon >= 4.5, "„flaeche“: Schrift über rein weißem Foto ≥ 4,5:1", kon.toFixed(2) + " (Schleier " + a + ")");
      }
      const rd = k.find(x => x.s === "kontakt");
      pruef(!!rd && rd.banner && Math.abs(rd.banner.w - rd.banner.h) <= 1 && /50%/.test(rd.banner.rund),
        "„rund“: das Foto ist ein Kreis", rd && rd.banner ? Math.round(rd.banner.w) + "×" + Math.round(rd.banner.h) + " " + rd.banner.rund : "fehlt");
      pruef(!!rd && !rd.ico, "„rund“: das Foto steht an der Stelle des Symbols (kein zweites Symbol)");

      const oi = k.find(x => x.s === "cocktails"), mi = k.find(x => x.s === "getraenke");
      pruef(!!oi && /ohneico/.test(oi.klassen) && /saeule/.test(oi.klassen) && !oi.ico, "Voraussetzung: Säule ohne Symbol steht da", oi && oi.klassen);
      pruef(!!mi && /saeule/.test(mi.klassen) && mi.ico, "Voraussetzung: Säule mit Symbol daneben", mi && mi.klassen);
      if(oi){
        pruef(oi.strich, "ohne Symbol: Akzentstrich über dem Titel");
        pruef(mi && oi.schrift > mi.schrift, "ohne Symbol: Titel größer als mit Symbol", oi.schrift + " > " + (mi && mi.schrift));
        pruef(oi.txtUnten !== null && oi.txtUnten <= 18, "ohne Symbol: Säule setzt den Text nach unten (kein Loch)", oi.txtUnten + " px");
      }
      pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
      await ctx.close();
    }
  }
  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Fehler." : n + " von " + n + " ok\nAlles sauber."));
  process.exit(f ? 1 : 0);
})();
