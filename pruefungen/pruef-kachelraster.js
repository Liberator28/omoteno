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
const { gruppeZu } = require("./werkzeug/zentrale");
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
  /* ── 6 · Geteilter Block: Board und Hub rechnen gleich ─────────── */
  console.log("\n══ Geteilter Block KACHELRASTER ══");
  {
    const aus = datei => { const t = fs.readFileSync(path.join(OBEN, datei), "utf8");
      const m = t.match(/\/\* KACHELRASTER — GETEILTER BLOCK[\s\S]*?\/\* ENDE KACHELRASTER \*\//); return m ? m[0] : null; };
    const hub = aus("vorlagen/hub.vorlage.html"), board = aus("seiten/admin.html");
    pruef(!!hub && !!board, "der Block steht in beiden Dateien");
    pruef(!!hub && hub === board, "Zeichen für Zeichen gleich", hub && board ? (hub === board ? hub.length + " Zeichen" : "VERSCHIEDEN") : "fehlt");
  }

  /* ── 7 · Board: kompakt, Anordnung, Ziehen, Wahlen ──────────────── */
  console.log("\n══ Board · Kacheln kompakt, Breite ziehen ══");
  for(const breite of [390, 1280]){
    const ctx = await br.newContext({ viewport:{ width:breite, height:900 }, hasTouch:true });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
    await p.goto("file://" + path.join(OBEN, "seiten", "admin.html"));
    await p.waitForTimeout(800);
    await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); zeichneAlles();
      const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; tafelZeigen("startseite");
      kbAusZeile([]); kbZeichnen(); });
    await p.waitForTimeout(400);
    await gruppeZu(p, "#gh-kacheln");
    const vor = await p.evaluate(() => ({
      zu: [...document.querySelectorAll("#kbListe [data-kb-auf]")].every(b => b.getAttribute("aria-expanded") === "false"),
      zeilenHoehe: Math.max(...[...document.querySelectorAll("#kbListe .kbzeile")].map(z => z.getBoundingClientRect().height)),
      karte: [...document.querySelectorAll('#kbAnordnung .kbr-gitter')][0] ?
        [...document.querySelectorAll('#kbAnordnung .kbr-gitter')][0].querySelectorAll(".kbr-kachel").length : 0,
      spalten: [...document.querySelectorAll('#kbAnordnung [data-kbr]')].map(k => k.dataset.kbr + ":" + k.dataset.spalten).join(" "),
      ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      klein: [...document.querySelectorAll("#kbListe .kbkopfknopf, #kbAnordnung .kbr-name")]
        .filter(b => b.getBoundingClientRect().height < 44).length
    }));
    pruef(vor.zu, breite + " px: jede Kachel startet als zugeklappte Zeile");
    pruef(vor.zeilenHoehe <= 90, breite + " px: eine Zeile ist kompakt", Math.round(vor.zeilenHoehe) + " px");
    pruef(vor.karte === 3 && /speisekarte:2 getraenke:2 cocktails:2/.test(vor.spalten),
      breite + " px: die Anordnung rechnet wie der Hub (drei Säulen)", vor.spalten.split(" ").slice(0, 4).join(" "));
    pruef(vor.ueber <= 0, breite + " px: kein seitlicher Überlauf", vor.ueber + " px");
    pruef(vor.klein === 0, breite + " px: Tapflächen ≥ 44 px", vor.klein + " zu klein");

    /* Tippen auf den Namen in der Anordnung öffnet genau diese Zeile. */
    await p.click('#kbAnordnung [data-kbr="wlan"] [data-kbr-auf]');
    await p.waitForTimeout(500);
    const auf = await p.evaluate(() => ({
      exp: document.querySelector('[data-kb="wlan"] [data-kb-auf]').getAttribute("aria-expanded"),
      h: document.getElementById("kbinhalt-wlan").getBoundingClientRect().height }));
    pruef(auf.exp === "true" && auf.h > 200, breite + " px: Tipp auf den Namen öffnet die Einstellungen dieser Kachel", JSON.stringify(auf));

    /* Ziehen mit der Maus: Tischruf (ganz) am Griff nach links auf ein Drittel. */
    const zieh = async (sch, anteil, finger) => {
      await p.evaluate(s => document.querySelector('#kbAnordnung [data-kbr="' + s + '"]').scrollIntoView({ block:"center" }), sch);
      await p.waitForTimeout(150);
      const g = await p.evaluate(s => { const k = document.querySelector('#kbAnordnung [data-kbr="' + s + '"]');
        const gr = k.querySelector("[data-kbr-griff]").getBoundingClientRect(), git = k.parentElement.getBoundingClientRect();
        return { x: gr.left + gr.width / 2, y: gr.top + gr.height / 2, links: git.left, breite: git.width }; }, sch);
      const zielX = g.links + g.breite * anteil;
      const scrollVor = await p.evaluate(() => scrollY);
      if(finger){
        const cdp = await ctx.newCDPSession(p);
        const t = (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y:g.y, id:1 }] });
        await t("touchStart", g.x);
        for(let i = 1; i <= 8; i++){ await t("touchMove", g.x + (zielX - g.x) * i / 8); await p.waitForTimeout(16); }
        await t("touchEnd", zielX);
      }else{
        await p.mouse.move(g.x, g.y); await p.mouse.down();
        await p.mouse.move(zielX, g.y, { steps:8 }); await p.mouse.up();
      }
      await p.waitForTimeout(300);
      return p.evaluate(([s, sv]) => ({ breite: KACHELSTAND.find(k => k.schluessel === s).breite,
        spalten: document.querySelector('#kbAnordnung [data-kbr="' + s + '"]').dataset.spalten,
        roh: (kbRoh().find(e => e.schluessel === s) || {}).breite, gerollt: Math.abs(scrollY - sv) }), [sch, scrollVor]);
    };
    const m = await zieh("tischruf", 0.3, false);
    pruef(m.breite === "drittel" && m.roh === "drittel", breite + " px: Griff mit der Maus auf ⅓ gezogen → Drittel, geht mit „Übernehmen“", JSON.stringify(m));
    /* Tischruf steht allein in der Reihe (WLAN darunter ist ganz) und
       füllt sie weiter — dann muss das Board sagen, warum. */
    const satz = await p.evaluate(() => { const m = document.getElementById("meldung"); return m ? m.textContent : ""; });
    pruef(m.spalten === "6" && /allein in ihrer Reihe/.test(satz), breite + " px: bleibt sie breit, sagt das Board warum", satz.slice(0, 60));
    /* Gegenfall: Nachbar auch schmaler → jetzt stehen beide im Drittel-Raster. */
    const n2 = await zieh("wlan", 0.3, false);
    const beide = await p.evaluate(() => ["tischruf","wlan"].map(s => document.querySelector('#kbAnordnung [data-kbr="' + s + '"]').dataset.spalten).join(","));
    pruef(n2.breite === "drittel" && beide === "3,3", breite + " px: mit schmalerem Nachbarn teilen sich beide die Reihe", beide);
    const t = await zieh("tischruf", 0.97, true);
    pruef(t.breite === "" && t.roh === undefined, breite + " px: mit dem FINGER zurück auf ganz → wieder Vorgabe, nichts extra gespeichert", JSON.stringify(t));
    pruef(t.gerollt <= 2, breite + " px: beim Ziehen rollt die Seite nicht mit", t.gerollt + " px");

    /* ── Umsortieren per langem Druck auf den Namen, innerhalb der
       eigenen Gruppe ────────────────────────────────────────────── */
    const ziehReihenfolge = async (sch, zielSch, finger) => {
      /* scrollIntoView UND das Maß in ZWEI Aufrufen, mit Warten
         dazwischen — html hat scroll-behavior:smooth (Zeile 433), ein
         Maß im selben Durchgang träfe die Kachel noch mitten im
         Rollen (Bewegungs-Skill §9). */
      await p.evaluate(s => document.querySelector('#kbAnordnung [data-kbr="' + s + '"] [data-kbr-auf]').scrollIntoView({ block:"center" }), sch);
      await p.waitForTimeout(150);
      const start = await p.evaluate(s => {
        const el = document.querySelector('#kbAnordnung [data-kbr="' + s + '"] [data-kbr-auf]');
        const r = el.getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height / 2 };
      }, sch);
      const ziel = await p.evaluate(s => {
        const r = document.querySelector('#kbAnordnung [data-kbr="' + s + '"]').getBoundingClientRect();
        return { x:r.left + r.width / 2, y:r.top + r.height / 2 };
      }, zielSch);
      if(finger){
        const cdp = await ctx.newCDPSession(p);
        const tt = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id:1 }] });
        await tt("touchStart", start.x, start.y);
        await p.waitForTimeout(230); /* über die 180-ms-Schwelle, OHNE Bewegung — sonst gilt es als Wisch */
        for(let i = 1; i <= 8; i++){ await tt("touchMove", start.x + (ziel.x - start.x) * i / 8, start.y + (ziel.y - start.y) * i / 8); await p.waitForTimeout(16); }
        await tt("touchEnd", ziel.x, ziel.y);
      }else{
        await p.mouse.move(start.x, start.y);
        await p.mouse.down();
        await p.waitForTimeout(230);
        await p.mouse.move(ziel.x, ziel.y, { steps:8 });
        await p.waitForTimeout(80);
        await p.mouse.up();
      }
      await p.waitForTimeout(250);
      return p.evaluate(() => KACHELSTAND.map(k => k.schluessel));
    };
    const reihenfolgeVorher = await p.evaluate(() => KACHELSTAND.map(k => k.schluessel));
    const reihenfolgeNachher = await ziehReihenfolge("getraenke", "cocktails", breite === 390);
    pruef(reihenfolgeVorher.indexOf("getraenke") < reihenfolgeVorher.indexOf("cocktails") &&
      reihenfolgeNachher.indexOf("getraenke") > reihenfolgeNachher.indexOf("cocktails"),
      breite + " px: langer Druck (" + (breite === 390 ? "Finger" : "Maus") + ") zieht „Getränke“ hinter „Cocktails“",
      reihenfolgeVorher.slice(0, 3).join(",") + " → " + reihenfolgeNachher.slice(0, 3).join(","));
    const offenNachZug = await p.evaluate(() => document.querySelector('[data-kb="getraenke"] [data-kb-auf]').getAttribute("aria-expanded"));
    pruef(offenNachZug === "false", breite + " px: nach einem echten Zug öffnen sich NICHT zusätzlich die Einstellungen", offenNachZug);

    /* Über die eigene Gruppe hinaus gezogen: bleibt drin. „Cocktails“
       (jetzt letzte Kachel der Gruppe „Die Karte“) weit in Richtung
       der nächsten Gruppe gezogen — sie darf „Die Karte“ nie verlassen,
       weil jede Gruppe ihr eigenes .kbr-gitter ist. */
    const weitGezogen = await ziehReihenfolge("cocktails", "tischruf", false);
    const dieKarte = ["speisekarte", "getraenke", "cocktails"];
    pruef(weitGezogen.slice(0, 3).slice().sort().join(",") === dieKarte.slice().sort().join(",") &&
      weitGezogen.indexOf("cocktails") < 3,
      breite + " px: Ziehen über die Gruppengrenze hinaus bleibt in der eigenen Gruppe (kein Sprung zu „Jetzt am Tisch“)",
      weitGezogen.slice(0, 5).join(","));

    /* ── Zugänglicher Zweitweg: Pfeil-Knöpfe, an den Gruppengrenzen
       deaktiviert — „Danke sagen“ hat nur eine Kachel (trinkgeld):
       oben UND unten deaktiviert, unabhängig davon, was sonst gezogen
       wurde. „Kontakt“ ist die letzte der unberührten Gruppe „Für
       Ihren nächsten Besuch“. ────────────────────────────────────── */
    const grenzen = await p.evaluate(() => ({
      trinkgeldHoch:   document.querySelector('[data-kb="trinkgeld"] [data-kb-hoch]').disabled,
      trinkgeldRunter: document.querySelector('[data-kb="trinkgeld"] [data-kb-runter]').disabled,
      kontaktRunter:   document.querySelector('[data-kb="kontakt"] [data-kb-runter]').disabled,
      kontaktHoch:     document.querySelector('[data-kb="kontakt"] [data-kb-hoch]').disabled
    }));
    pruef(grenzen.trinkgeldHoch && grenzen.trinkgeldRunter,
      breite + " px: einzige Kachel ihrer Gruppe – beide Pfeile deaktiviert", JSON.stringify(grenzen));
    pruef(grenzen.kontaktRunter && !grenzen.kontaktHoch,
      breite + " px: letzte Kachel der Gruppe – „nach unten“ deaktiviert, „nach oben“ nicht", JSON.stringify(grenzen));
    const vorPfeil = await p.evaluate(() => KACHELSTAND.map(k => k.schluessel));
    await p.click('[data-kb="kontakt"] [data-kb-hoch]');
    await p.waitForTimeout(150);
    const nachPfeil = await p.evaluate(() => KACHELSTAND.map(k => k.schluessel));
    pruef(nachPfeil.indexOf("kontakt") === vorPfeil.indexOf("kontakt") - 1,
      breite + " px: „nach oben“ tauscht mit dem Nachbarn in der eigenen Gruppe",
      vorPfeil.join(",") + " → " + nachPfeil.join(","));

    /* Pfeiltasten am Griff. */
    await p.focus('#kbAnordnung [data-kbr="kontakt"] [data-kbr-griff]');
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(150);
    const taste = await p.evaluate(() => KACHELSTAND.find(k => k.schluessel === "kontakt").breite);
    pruef(taste === "voll", breite + " px: Pfeiltaste am Griff ändert die Breite (Hälfte → ganz)", taste);

    /* Wahlen in der Zeile: Farbe, eigene Farbe, Bildform, Breite. */
    /* Über den echten Tipp auf den Kopf öffnen, nicht über kbOffen — der
       erste Gegenbeweis (Merken beim Tipp entfernt) blieb sonst grün. */
    await p.click('[data-kb="speisekarte"] [data-kb-auf]');
    await p.waitForTimeout(450);
    await p.click('[data-kb="speisekarte"] [data-kb-grund="#A83A2E"]', { timeout:3000 }).catch(() => {});
    const nochOffen = await p.evaluate(() => document.querySelector('[data-kb="speisekarte"] [data-kb-auf]').getAttribute("aria-expanded"));
    pruef(nochOffen === "true", breite + " px: nach einer Wahl (Neuzeichnen) bleibt die angetippte Zeile offen", nochOffen);
    await p.click('[data-kb="speisekarte"] [data-kb-bildform="rund"]', { timeout:3000 }).catch(() => {});
    await p.click('[data-kb="speisekarte"] [data-kb-breite="voll"]', { timeout:3000 }).catch(() => {});
    await p.$eval('[data-kb="speisekarte"] [data-kb-grundwahl]', el => { el.value = "#123abc"; el.dispatchEvent(new Event("change", { bubbles:true })); });
    await p.waitForTimeout(200);
    const w = await p.evaluate(() => ({ roh: kbRoh().find(e => e.schluessel === "speisekarte"),
      zusammen: document.querySelector('[data-kb="speisekarte"] .kbkopftext i').textContent,
      verh: kbSeitenverhaeltnis(KACHELSTAND.find(k => k.schluessel === "speisekarte")),
      verhFl: kbSeitenverhaeltnis({ schluessel:"tischruf", bildform:"flaeche" }),
      offen: document.querySelector('[data-kb="speisekarte"] [data-kb-auf]').getAttribute("aria-expanded") }));
    pruef(w.roh && w.roh.grund === "#123ABC" && w.roh.bildform === "rund" && w.roh.breite === "voll",
      breite + " px: Farbe (eigene), Bildform und Breite gehen mit „Übernehmen“", JSON.stringify(w.roh));
    pruef(/Ganz/.test(w.zusammen) && /eigene Farbe/.test(w.zusammen), breite + " px: die zugeklappte Zeile sagt, was eingestellt ist", w.zusammen);
    pruef(w.offen === "true", breite + " px: die Zeile bleibt beim Neuzeichnen offen");
    pruef(w.verh === 1 && w.verhFl === 3.6, breite + " px: Zuschnitt folgt der Bildform (rund 1:1, füllend ganz 3,6:1)", w.verh + " / " + w.verhFl);
    pruef(!fehler.length, breite + " px: keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }

  /* ── 7b · Umsortieren mit prefers-reduced-motion ─────────────────
     Kein Zwischenschritt beim Nachrücken, aber die Endposition muss
     trotzdem stimmen — und am Ende darf kein inline-transform hängen
     bleiben (§8.1: kein Zustand, der nicht zurückgesetzt wurde). */
  console.log("\n══ Kacheln: Umsortieren mit prefers-reduced-motion ══");
  {
    const ctx = await br.newContext({ viewport:{ width:390, height:900 } });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.emulateMedia({ reducedMotion:"reduce" });
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
    await p.goto("file://" + path.join(OBEN, "seiten", "admin.html"));
    await p.waitForTimeout(800);
    await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); zeichneAlles();
      const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; tafelZeigen("startseite");
      kbAusZeile([]); kbZeichnen(); });
    await p.waitForTimeout(400);
    await gruppeZu(p, "#gh-kacheln");
    /* scrollIntoView und das Maß in zwei Aufrufen mit Warten dazwischen
       (Bewegungs-Skill §9, wie oben bei ziehReihenfolge) — sonst zeigt
       das Maß eine Stelle, an der die Kachel (noch) nicht steht. */
    await p.evaluate(() => document.querySelector('#kbAnordnung [data-kbr="getraenke"] [data-kbr-auf]').scrollIntoView({ block:"center" }));
    await p.waitForTimeout(150);
    const start = await p.evaluate(() => { const el = document.querySelector('#kbAnordnung [data-kbr="getraenke"] [data-kbr-auf]');
      const r = el.getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height / 2 }; });
    const ziel = await p.evaluate(() => { const r = document.querySelector('#kbAnordnung [data-kbr="cocktails"]').getBoundingClientRect();
      return { x:r.left + r.width / 2, y:r.top + r.height / 2 }; });
    await p.mouse.move(start.x, start.y);
    await p.mouse.down();
    await p.waitForTimeout(230);
    await p.mouse.move(ziel.x, ziel.y, { steps:8 });
    await p.waitForTimeout(80);
    await p.mouse.up();
    await p.waitForTimeout(250);
    const nach = await p.evaluate(() => ({
      reihe: KACHELSTAND.map(k => k.schluessel),
      transform: [...document.querySelectorAll("#kbAnordnung [data-kbr]")].every(el => !el.style.transform && !el.style.transition)
    }));
    pruef(nach.reihe.indexOf("getraenke") > nach.reihe.indexOf("cocktails"),
      "prefers-reduced-motion: Endposition stimmt trotzdem (kein Zwischenschritt nötig)", nach.reihe.slice(0, 3).join(","));
    pruef(nach.transform, "prefers-reduced-motion: kein liegen gebliebenes transform/transition an den Nachbarn");
    pruef(!fehler.length, "prefers-reduced-motion: keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }

  /* ── 8 · Zuschnitt mit zwei Fingern ─────────────────────────────
     Wunsch: „mit den Fingern ausschneiden und raus- und reinzoomen“.
     Echte Finger über CDP (zwei Kontaktpunkte), nicht die Maus — eine
     Maus hat nur einen Zeiger und hätte das Zoomen nie gesehen. */
  console.log("\n══ Zuschnitt: Finger und Mausrad (Kachel und Banner) ══");
  for(const art of ["kb", "bn"]){
    const ctx = await br.newContext({ viewport:{ width:390, height:844 }, hasTouch:true });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
    await p.goto("file://" + path.join(OBEN, "seiten", "admin.html"));
    await p.waitForTimeout(800);
    await p.evaluate(async art => {
      document.getElementById("tor").hidden = true; demoStarten(); zeichneAlles();
      const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; tafelZeigen("startseite");
      /* Ein Bild mit Muster, 1200×900, als echte Datei. */
      const c = document.createElement("canvas"); c.width = 1200; c.height = 900;
      const g = c.getContext("2d");
      for(let x = 0; x < 12; x++) for(let y = 0; y < 9; y++){ g.fillStyle = (x + y) % 2 ? "#2a9d8f" : "#e9c46a"; g.fillRect(x * 100, y * 100, 100, 100); }
      const blob = await new Promise(r => c.toBlob(r, "image/png"));
      const datei = new File([blob], "probe.png", { type:"image/png" });
      if(art === "kb"){ kbAusZeile([]); kbZeichnen(); kbZuschnittOeffnen("tischruf", datei); }
      else { bnAusZeile([]); bnNeu(); bnZuschnittOeffnen(BANNERSTAND[0].id, datei); }
    }, art);
    await gruppeZu(p, art === "kb" ? "#gh-kacheln" : "#gh-banner");
    await p.waitForTimeout(900);
    const R = "#" + art + "Rahmen", Z = art === "kb" ? "kbZuschnitt" : "bnZuschnitt", G = art === "kb" ? "kbGrundmass" : "bnGrundmass";
    const lage = () => p.evaluate(([R, Z, G]) => { const r = document.querySelector(R).getBoundingClientRect(), st = window.eval(Z);
      return st ? { zoom:st.zoom, dx:st.dx, dy:st.dy, m:window.eval(G)() * st.zoom, x:r.left, y:r.top, w:r.width, h:r.height,
                    regler:+document.getElementById(R.slice(1, 3) + "Zoom").value } : null; }, [R, Z, G]);
    const vor = await lage();
    pruef(!!vor && vor.w > 100 && vor.zoom === 1, art + ": Voraussetzung: Zuschnitt offen, Zoom 1", vor && JSON.stringify({ w:Math.round(vor.w), h:Math.round(vor.h) }));
    if(!vor){ await ctx.close(); continue; }
    const cdp = await ctx.newCDPSession(p);
    const tp = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((q, i) => ({ x:q[0], y:q[1], id:i + 1 })) });
    /* Abseits der Mitte: In der Mitte bliebe der Punkt auch bei einem
       naiven Zoom um die Rahmenmitte liegen (§8.1g — eine Probe, die
       den Fehler nicht zeigen kann). */
    const mx = vor.x + vor.w * 0.3, my = vor.y + vor.h * 0.35;
    /* Bildpunkt unter der Mitte, vorher */
    const bildX0 = (mx - vor.x - vor.dx) / vor.m, bildY0 = (my - vor.y - vor.dy) / vor.m;
    await tp("touchStart", [[mx - 20, my], [mx + 20, my]]);
    for(let i = 1; i <= 10; i++){ const d = 20 + 4 * i; await tp("touchMove", [[mx - d, my], [mx + d, my]]); await p.waitForTimeout(16); }
    await tp("touchEnd", []);
    await p.waitForTimeout(150);
    const auf = await lage();
    const bildX1 = (mx - auf.x - auf.dx) / auf.m, bildY1 = (my - auf.y - auf.dy) / auf.m;
    pruef(auf.zoom >= 2.8 && auf.zoom <= 3, art + ": zwei Finger auseinander → hineingezoomt (höchstens 3×)", auf.zoom.toFixed(2));
    pruef(Math.abs(auf.regler - Math.round(auf.zoom * 100)) <= 1, art + ": der Regler läuft mit", auf.regler);
    pruef(Math.abs(bildX1 - bildX0) < 2 && Math.abs(bildY1 - bildY0) < 2, art + ": der Punkt unter den Fingern bleibt unter den Fingern",
      bildX0.toFixed(1) + "," + bildY0.toFixed(1) + " → " + bildX1.toFixed(1) + "," + bildY1.toFixed(1));
    /* Ein Finger schiebt. */
    await tp("touchStart", [[mx, my]]);
    for(let i = 1; i <= 6; i++){ await tp("touchMove", [[mx - 5 * i, my - 3 * i]]); await p.waitForTimeout(16); }
    await tp("touchEnd", []);
    await p.waitForTimeout(100);
    const gesch = await lage();
    pruef(Math.abs(gesch.dx - auf.dx + 30) < 1.5 && Math.abs(gesch.dy - auf.dy + 18) < 1.5, art + ": ein Finger verschiebt das Bild",
      (gesch.dx - auf.dx).toFixed(1) + "," + (gesch.dy - auf.dy).toFixed(1));
    /* Zusammenkneifen: nie kleiner als der Rahmen (kein Rand). */
    await tp("touchStart", [[mx - 120, my], [mx + 120, my]]);
    for(let i = 1; i <= 10; i++){ const d = 120 - 11 * i; await tp("touchMove", [[mx - d, my], [mx + d, my]]); await p.waitForTimeout(16); }
    await tp("touchEnd", []);
    await p.waitForTimeout(100);
    const zu = await lage();
    const bw = zu.m * (await p.evaluate(Z => window.eval(Z).bild.naturalWidth, Z)), bh = zu.m * (await p.evaluate(Z => window.eval(Z).bild.naturalHeight, Z));
    pruef(zu.zoom === 1 && zu.dx <= 0.5 && zu.dy <= 0.5 && zu.dx + bw >= zu.w - 0.5 && zu.dy + bh >= zu.h - 0.5,
      art + ": zusammengekniffen bleibt der Rahmen voll bedeckt (Zoom 1, kein Rand)", zu.zoom.toFixed(2));
    /* Mausrad */
    await p.mouse.move(mx, my);
    await p.mouse.wheel(0, -300);
    await p.waitForTimeout(150);
    const rad = await lage();
    pruef(rad.zoom > 1.3, art + ": Mausrad zoomt", rad.zoom.toFixed(2));
    pruef(!fehler.length, art + ": keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }

  /* ── Symbol-Anordnung: eigener Schalter, unabhängig von der Breite ──
     VORFALL (Bildschirmfoto): "Uns bewerten" und "WLAN verbinden"
     landeten nur durch die Rest-Zeilen-Streckung/gewählte Breite im
     Säulen-Layout (Symbol über dem Text) — ein Zufall, keine Wahl.
     symbolLage macht es zu einem eigenen Feld: "neben" erzwingt die
     Reihen-Klasse auch bei einer Kachel, die rechnerisch eine Säule
     wäre; "oben" erzwingt die Säule auch bei einer, die rechnerisch
     breit würde. Getestet gegen den ECHTEN erzeugten Hub, nicht nur
     gegen die isolierte kachelReihen()-Rechnung von oben. */
  console.log("\n══ Symbol-Anordnung: eigener Schalter (Vorfall aus dem Bildschirmfoto) ══");
  {
    /* Drei "drittel"-Kacheln derselben Gruppe füllen eine Reihe exakt
       (2+2+2=6) — ohne Rest-Streckung bleibt jede rechnerisch eine
       Säule (spalten=2). Eine davon bekommt symbolLage:"neben". */
    const { p, ctx, fehler } = await hubAuf(br, "chocolamour", 390, liste([
      { schluessel:"speisekarte", breite:"drittel" },
      { schluessel:"getraenke",   breite:"drittel", symbolLage:"neben" },
      { schluessel:"cocktails",   breite:"drittel" }
    ]));
    const karten = await p.evaluate(() => [...document.querySelectorAll("a.kachel")].map(a => ({
      s: a.dataset.kachel, spalten: +a.dataset.spalten, klassen: a.className
    })));
    const speisekarte = karten.find(k => k.s === "speisekarte");
    const getraenke   = karten.find(k => k.s === "getraenke");
    const cocktails   = karten.find(k => k.s === "cocktails");
    pruef(!!speisekarte && speisekarte.spalten === 2 && /\bsaeule\b/.test(speisekarte.klassen),
      "Voraussetzung: ohne eigene Wahl bleibt eine 'drittel'-Kachel rechnerisch eine Säule",
      speisekarte && JSON.stringify({ spalten:speisekarte.spalten, klassen:speisekarte.klassen }));
    pruef(!!getraenke && getraenke.spalten === 2 && !/\bsaeule\b/.test(getraenke.klassen) && /\bkhalb\b/.test(getraenke.klassen),
      "symbolLage:'neben' erzwingt die Reihen-Klasse, OBWOHL die Breite (2 Spalten) rechnerisch eine Säule wäre",
      getraenke && JSON.stringify({ spalten:getraenke.spalten, klassen:getraenke.klassen }));
    pruef(!!cocktails && cocktails.spalten === 2 && /\bsaeule\b/.test(cocktails.klassen),
      "…die dritte, unveränderte Kachel bleibt bei der alten (Säulen-)Anordnung — nur die gewählte weicht ab",
      cocktails && JSON.stringify({ spalten:cocktails.spalten, klassen:cocktails.klassen }));
    pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }
  {
    /* Umgekehrt: eine Kachel allein in ihrer Gruppe wird rechnerisch
       "voll" (6 Spalten, Reihen-Layout mit Unterzeile) — symbolLage:
       "oben" erzwingt trotzdem die Säule. */
    const { p, ctx, fehler } = await hubAuf(br, "chocolamour", 390, liste([
      { schluessel:"wlan", symbolLage:"oben" }
    ]));
    const karte = await p.evaluate(() => {
      const a = document.querySelector('a.kachel[data-kachel="wlan"]');
      return a ? { spalten:+a.dataset.spalten, klassen:a.className } : null;
    });
    pruef(!!karte && karte.spalten === 6 && /\bsaeule\b/.test(karte.klassen),
      "symbolLage:'oben' erzwingt die Säule, OBWOHL die Kachel allein rechnerisch ganz breit (6 Spalten) würde",
      karte && JSON.stringify(karte));
    pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }

  /* ── Höhe (gestuft) und Textgröße: eine reine Mindesthöhe/-größe ──
     "hoch"/"kompakt" skalieren die vorhandene Mindesthöhe (132/64/60px
     je Klasse), "kein Wert" bleibt bytegleich beim alten Verhalten.
     Textgröße ist eine geklammerte Zahl (0,8–1,4), keine feste Liste. */
  console.log("\n══ Kachel-Höhe (gestuft) und Textgröße ══");
  {
    const { p, ctx, fehler } = await hubAuf(br, "chocolamour", 390, liste([
      { schluessel:"wlan",       hoehe:"hoch",    textgroesse:1.3 },
      { schluessel:"bewertung",  hoehe:"kompakt", textgroesse:0.85 },
      { schluessel:"speisekarte" }
    ]));
    const messen = s => p.evaluate(sel => {
      const a = document.querySelector('a.kachel[data-kachel="' + sel + '"]');
      const st = a.querySelector(".txt strong");
      return { minHoehe: parseFloat(getComputedStyle(a).minHeight), schrift: parseFloat(getComputedStyle(st).fontSize) };
    }, s);
    const wlan = await messen("wlan"), bewertung = await messen("bewertung"), speisekarte = await messen("speisekarte");
    /* Alle drei Kacheln stehen hier ohne eigene Breite, landen also
       alle auf "voll" (Basis-Mindesthöhe 64px, Basisschrift 14,5px). */
    pruef(Math.abs(wlan.minHoehe - 64 * 1.35) < 1, "hoehe:'hoch' skaliert die Mindesthöhe um ×1,35", wlan.minHoehe);
    pruef(Math.abs(wlan.schrift - 14.5 * 1.3) < .1, "textgroesse:1.3 skaliert die Schrift um ×1,3", wlan.schrift);
    pruef(Math.abs(bewertung.minHoehe - 64 * .8) < 1, "hoehe:'kompakt' skaliert die Mindesthöhe um ×0,8", bewertung.minHoehe);
    pruef(Math.abs(bewertung.schrift - 14.5 * .85) < .1, "textgroesse:0.85 skaliert die Schrift um ×0,85", bewertung.schrift);
    pruef(speisekarte.minHoehe === 64 && speisekarte.schrift === 14.5,
      "ohne eigene Wahl: bytegleich die alte Mindesthöhe/-schrift (kein Bestandskunde sieht eine Änderung)",
      JSON.stringify(speisekarte));
    pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }
  {
    /* Ein zu großer/zu kleiner Wert aus der Live-Spalte wird
       geklammert, nicht verworfen — ein Regler, der knapp daneben
       liegt, fällt nicht gleich ganz auf die Vorgabe zurück. */
    const { p, ctx, fehler } = await hubAuf(br, "chocolamour", 390, liste([
      { schluessel:"wlan", textgroesse:9.9 }
    ]));
    const schrift = await p.evaluate(() => parseFloat(getComputedStyle(
      document.querySelector('a.kachel[data-kachel="wlan"] .txt strong')).fontSize));
    pruef(Math.abs(schrift - 14.5 * 1.4) < .1, "ein zu großer Wert wird auf 1,4 geklammert, nicht ignoriert", schrift);
    pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }

  /* ── Board: die neuen Bedienelemente sind wirklich da und schreiben
     in denselben Stand, den kbRoh() sichert. ── */
  console.log("\n══ Board: Höhen-Segment und Textgrößen-Regler ══");
  {
    const ctx = await br.newContext({ viewport:{ width:390, height:844 } });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + path.join(OBEN, "seiten", "admin.html"));
    await p.waitForTimeout(700);
    await p.evaluate(() => {
      document.getElementById("tor").hidden = true;
      demoStarten(); zeichneAlles();
      const sc = document.getElementById("scharf"); if(sc) sc.hidden = true;
      tafelZeigen("startseite");
      kbAusZeile([]); kbZeichnen();
      kbZeileOeffnen("speisekarte");
    });
    await p.waitForTimeout(400);
    await gruppeZu(p, "#gh-kacheln");
    await p.click('[data-kb="speisekarte"] [data-kb-hoehe="hoch"]');
    await p.evaluate(() => {
      const inp = document.querySelector('[data-kb="speisekarte"] [data-kb-textgroesse]');
      inp.value = 130; inp.dispatchEvent(new Event("input", { bubbles:true }));
    });
    await p.waitForTimeout(150);
    const stand = await p.evaluate(() => ({
      k: (() => { const x = KACHELSTAND.find(x => x.schluessel === "speisekarte");
        return { hoehe:x.hoehe, textgroesse:x.textgroesse }; })(),
      roh: kbRoh().find(e => e.schluessel === "speisekarte"),
      hinweis: document.querySelector('[data-kb="speisekarte"] [data-kb-textgroesse-wert]').textContent,
      aktiv: document.querySelector('[data-kb="speisekarte"] [data-kb-hoehe="hoch"]').getAttribute("aria-checked")
    }));
    pruef(stand.k.hoehe === "hoch", "Tipp auf „Hoch“ setzt hoehe im Stand", stand.k.hoehe);
    pruef(stand.aktiv === "true", "…und der Segmentknopf zeigt sich als gewählt", stand.aktiv);
    pruef(stand.k.textgroesse === 1.3, "der Regler setzt textgroesse als Bruchzahl (130 % → 1,3)", stand.k.textgroesse);
    pruef(stand.hinweis === "130 %", "…und der Hinweis daneben zeigt den Prozentwert live mit", stand.hinweis);
    pruef(!!stand.roh && stand.roh.hoehe === "hoch" && stand.roh.textgroesse === 1.3,
      "beide Felder gehen mit kbRoh() (Speichern/Vorschau) mit", JSON.stringify(stand.roh));
    pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }

  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Fehler." : n + " von " + n + " ok\nAlles sauber."));
  process.exit(f ? 1 : 0);
})();
