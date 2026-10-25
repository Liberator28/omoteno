/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Startgrafiken (Entwurf 24.10.): Maskottchen, Wunderbox, Teller, Sticker, Botschaft, Schweben der Auswahl,
   Glas-Knopfzeile, Speisekarte mit Kopfkarte / Highlights / Pillen (Markenblatt `startgrafik`, Board hub_texte.karte_*)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-startgrafik.js

   Gemessen am gemalten Bild (§8.1e: ein Schirm ist keine Messung — zwei Breiten, hell und dunkel), jede Voraussetzung selbst
   geprüft (§8.1g). Zweite Quellen: die Texte der Kopfkarte kommen aus dem Markenblatt UND dem Board (hub_texte.karte_*) und
   werden gegeneinander gehalten; Allergen-Klartext je Kürzel aus ALLERGEN_NAMEN (§6.3). Der Erzeuger läuft in einem
   Wegwerf-Verzeichnis.
   Ehrliche Grenzen: kopfloses Chromium, neutrale Testbilder, kein Gerät; die Grafiken sind Nachzeichnungen des Entwurfs, nicht
   dessen Originale; die Live-Zeilen kennen „beliebt“ erst nach migration-karte-kopf.sql.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os");
const { spawnSync } = require("child_process");
const { oeffneHub } = require("./werkzeug/start-hub.js");
const { schlechtester, rect } = require("./werkzeug/messen.js");

let ok = 0, bad = 0;
const pruef = (name, bed, info) => { if(bed){ ok++; console.log("  ok   " + name); } else { bad++; console.log("  ROT  " + name + (info !== undefined ? "  → " + JSON.stringify(info) : "")); } };
const KORB = ["Banane Erdbeere", "Waffel Classic"];
/* Eine Karte mit Beliebt-Gericht, Merkmal und Allergenen — alles aus den Zeilen (nichts steht in der Prüfung als „erwartet“,
   was nicht aus denselben Zeilen kommt). */
const ZEILEN = rows => rows.map(r => {
  if(r.name === "Waffel Classic") return Object.assign({}, r, { allergene: "A,G,H", preis: 9.2, veg: true, beliebt: true });
  if(r.name === "Banane Erdbeere") return Object.assign({}, r, { allergene: "G", preis: 11.4, veg: true });
  return r;
});

(async () => {
  const b = await chromium.launch();

  /* ── 1 · Erzeuger: prüft laut, schreibt genau das Angegebene ── */
  console.log("\n══ 1 · Erzeuger ══");
  {
    const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), "sg-"));
    for(const d of ["erzeuger", "vorlagen", "markenblaetter"]) fs.mkdirSync(path.join(wurzel, d));
    for(const f of ["erzeuge-hub.js", "kompakt.js"]) fs.copyFileSync(path.join(__dirname, "..", "erzeuger", f), path.join(wurzel, "erzeuger", f));
    fs.copyFileSync(path.join(__dirname, "..", "vorlagen", "hub.vorlage.html"), path.join(wurzel, "vorlagen", "hub.vorlage.html"));
    const basis = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "markenblaetter", "chocolamour.json"), "utf8"));
    const erzeuge = (inhalt, nurPruefen, ohne) => {
      const mb = Object.assign({}, basis, { betrieb: Object.assign({}, basis.betrieb, { slug: "probe" }) }, inhalt);
      (ohne || []).forEach(k => { delete mb[k]; });
      fs.writeFileSync(path.join(wurzel, "markenblaetter", "probe.json"), JSON.stringify(mb));
      const r = spawnSync("node", [path.join(wurzel, "erzeuger", "erzeuge-hub.js"), "probe"].concat(nurPruefen ? ["--pruefen-nur"] : []), { encoding: "utf8" });
      return { code: r.status, text: r.stdout + r.stderr, hub: fs.existsSync(path.join(wurzel, "dist", "probe", "index.html")) ? fs.readFileSync(path.join(wurzel, "dist", "probe", "index.html"), "utf8") : "" };
    };
    const sg0 = basis.startgrafik;
    pruef("Voraussetzung: Chocos Markenblatt trägt startgrafik mit allen vier Teilen", !!sg0 && !!sg0.figur && !!sg0.sticker && sg0.botschaft.length === 2 && !!sg0.karte && Object.keys(sg0.karte).length === 4, sg0);
    pruef("Basis (Choco) geht durch — Voraussetzung der Gegenfälle", erzeuge({}, true).code === 0, erzeuge({}, true).text.slice(-120));
    const F = (g, teil, name) => { const r = erzeuge({ startgrafik: g }, true); pruef("Erzeuger lehnt ab (" + name + ")", r.code !== 0 && r.text.indexOf(teil) >= 0, r.text.split("\n").filter(x => /FEHLER/.test(x)).join(" | ").slice(0, 160)); };
    F(Object.assign({}, sg0, { figur: "pizza" }), "startgrafik.figur unbekannt", "unbekannte Figur");
    F(Object.assign({}, sg0, { figur: "__proto__" }), "startgrafik.figur unbekannt", "Figur __proto__");
    F(Object.assign({}, sg0, { farbe: "rot" }), "startgrafik.farbe gibt es nicht", "fremder Schlüssel");
    F(Object.assign({}, sg0, { sticker: "Zu lang, das passt nicht mehr auf den Aufkleber hier" }), "startgrafik.sticker", "Sticker über 26 Zeichen");
    F(Object.assign({}, sg0, { sticker: 'x"onload="y' }), "startgrafik.sticker", "Sticker mit Anführungszeichen");
    F(Object.assign({}, sg0, { botschaft: ["nur eine Zeile"] }), "startgrafik.botschaft", "Botschaft mit einer Zeile");
    F(Object.assign({}, sg0, { botschaft: ["a", "<b>b</b>"] }), "startgrafik.botschaft", "Botschaft mit Tag");
    F(Object.assign({}, sg0, { karte: { eyebrow: "Ok", farbe: "x" } }), "startgrafik.karte.farbe gibt es nicht", "fremder Schlüssel in karte");
    F(Object.assign({}, sg0, { karte: { titel: "x".repeat(61) } }), "startgrafik.karte.titel", "Titel über 60 Zeichen");
    F(Object.assign({}, sg0, { karte: { text: "<img src=x onerror=1>" } }), "startgrafik.karte.text", "Text mit Tag");
    F(Object.assign({}, sg0, { karte: "Hallo" }), "startgrafik.karte muss ein Objekt sein", "karte als Zeichenkette");
    F("erdbeere", "muss ein Objekt sein", "Zeichenkette statt Objekt");
    let r = erzeuge({ startstil: "klassisch" }, true);
    pruef("Erzeuger lehnt startgrafik ohne Premium ab (sonst wirkungslos und still)", r.code !== 0 && /wirkt nur mit startstil/.test(r.text));
    r = erzeuge({}, false);
    const block = (r.hub.match(/startgrafik: \{([\s\S]*?)\n  \},/) || ["", ""])[1];
    pruef("Erzeuger schreibt alle vier Teile ins Markenblatt des Hubs (figur, sticker, botschaft, karte)", r.code === 0 && /figur:/.test(block) && /sticker:/.test(block) && /botschaft:/.test(block) && /karte:/.test(block), block.slice(0, 200));
    pruef("… und die Texte der Kopfkarte stehen wörtlich darin (Rundlauf Markenblatt → Hub)", Object.values(sg0.karte).every(v => block.indexOf(JSON.stringify(v).slice(1, -1)) >= 0 || block.indexOf(v) >= 0));
    r = erzeuge({}, false, ["startgrafik"]);
    pruef("ohne startgrafik steht nichts davon im erzeugten Hub (Markenblatt-Zeile)", r.code === 0 && r.hub.length > 1000 && !/\n  startgrafik:/.test(r.hub));
    fs.rmSync(wurzel, { recursive: true, force: true });
  }

  /* ── 2 · Startseite: Grafiken, Botschaft, Teller ── */
  console.log("\n══ 2 · Startseite mit Startgrafik ══");
  for(const breite of [360, 430]){
    const h = await oeffneHub(b, { kopf: "dunkel", kachelFoto: false, korb: KORB, stil: "premium", breite, hoehe: 900, zeilen: ZEILEN });
    const p = h.p;
    const s = await p.evaluate(() => ({ an: document.body.dataset.startgrafik, m: !!document.querySelector("header .sg-m svg"), st: !!document.querySelector("header .sg-s svg"),
      bot: !!document.querySelector(".botschaft .bo-text"), teller: !!document.querySelector('[data-sz="karte"] .sz-k-teller svg'), box: !!document.querySelector('[data-sz="roulette"] .sz-k-box svg'),
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    pruef(breite + " px: Maskottchen, Sticker, Botschaft, Wunderbox da (Voraussetzung)", s.an === "an" && s.m && s.st && s.bot && s.box, s);
    pruef(breite + " px: kein horizontales Scrollen", s.sw <= s.cw, s);
    /* keine Grafik malt Schwarz (SVG füllt ohne Regel mit Schwarz — §8.1e) */
    const schwarz = await p.evaluate(() => [...document.querySelectorAll(".sg *")].filter(e => /^(path|circle|ellipse|rect|polygon|polyline)$/i.test(e.tagName)).filter(e => { const cs = getComputedStyle(e); return cs.fill === "rgb(0, 0, 0)" && e.getAttribute("fill") !== "#000"; }).length);
    pruef(breite + " px: keine gezeichnete Fläche füllt unbeabsichtigt mit Schwarz", schwarz === 0, schwarz);
    /* Maskottchen und Sticker überdecken weder Siegel noch Öffnungs-Pille */
    /* Maß ist das GEMALTE Bild (Vereinigung der Kinder), nicht der Rahmen des SVG — der hat durchsichtigen Rand. */
    const gemalt = sel => p.evaluate(s => { const kids = [...document.querySelectorAll(s + " > *")].map(e => e.getBoundingClientRect()).filter(b => b.width > 0 && b.height > 0); if(!kids.length) return null;
      const x = Math.min(...kids.map(b => b.x)), y = Math.min(...kids.map(b => b.y)), r = Math.max(...kids.map(b => b.right)), bo = Math.max(...kids.map(b => b.bottom)); return { x, y, w: r - x, h: bo - y, r, b: bo }; }, sel);
    const R = {}; for(const [k, sel] of [["logo", "#logo"], ["pille", ".st-link"]]) R[k] = await rect(p, sel);
    R.m = await gemalt("header .sg-m svg"); R.st = await gemalt("header .sg-s svg");
    /* Das Siegel ist ein Kreis: Fläche der Zeichnung INNERHALB des Kreises (die Ecken des Quadrats sind leer). */
    const kreisSchnitt = (a, lg) => { let n = 0; const cx = lg.x + lg.w / 2, cy = lg.y + lg.h / 2, rr = lg.w / 2; for(let x = a.x; x < a.r; x += 2) for(let y = a.y; y < a.b; y += 2) if((x - cx) ** 2 + (y - cy) ** 2 < rr * rr) n += 4; return n; };
    const schnitt = (a, c) => Math.max(0, Math.min(a.r, c.r) - Math.max(a.x, c.x)) * Math.max(0, Math.min(a.b, c.b) - Math.max(a.y, c.y));
    pruef(breite + " px: das Maskottchen liegt neben dem Siegel, nicht darüber (Fläche der Zeichnung im Kreis des Siegels < 4 px²)", kreisSchnitt(R.m, R.logo) < 4, [kreisSchnitt(R.m, R.logo), R]);
    pruef(breite + " px: der Sticker deckt den Text der Öffnungs-Pille nicht", schnitt(R.st, await rect(p, ".st-link .st-text")) < 1, R.st);
    /* Pfade bleiben im Bild */
    pruef(breite + " px: Maskottchen und Sticker ragen nicht über den Bildrand", R.m.r <= breite + 1 && R.st.r <= breite + 1 && R.m.x >= -1 && R.st.x >= -1, R);
    /* Der Teller trägt Tipp-Flächen nicht: Kunst fängt keinen Tipp */
    const pe = await p.evaluate(() => [...document.querySelectorAll(".sz-kunst")].map(e => getComputedStyle(e).pointerEvents));
    pruef(breite + " px: die Kunst in den Kacheln fängt keinen Tipp (pointer-events: none)", pe.length >= 2 && pe.every(x => x === "none"), pe);
    /* Schrift der Kacheln liegt auf der Fläche, nicht auf der Kunst: Titel ≥ 4,5:1 am gemalten Bild */
    const tt = {}; for(const [k, sel] of [["Auswahl", '[data-sz="auswahl"] .sz-text'], ["Karte", '[data-sz="karte"] .sz-text'], ["Foodroulette", '[data-sz="roulette"] .sz-text']]) tt[k] = await schlechtester(p, sel, true);
    pruef(breite + " px: Kachelschrift ≥ 4,5:1 am schlechtesten Bildpunkt (auch über Kunst)", Object.values(tt).every(v => v !== null && v >= 4.5), tt);
    /* Kein Wort bricht mitten im Wort um („Foodroulett/e“, 360 px): ohne Umbruchzwang passt jedes Wort in die Zeile. */
    const wort = await p.evaluate(() => [...document.querySelectorAll(".sz-p .sz-text")].map(e => { e.style.overflowWrap = "normal"; const o = e.scrollWidth <= e.clientWidth + 1; e.style.overflowWrap = ""; return [e.textContent, o]; }));
    pruef(breite + " px: kein Titel der Kacheln bricht mitten im Wort", wort.length >= 3 && wort.every(x => x[1]), wort);
    await h.ctx.close();
  }

  /* ── 3 · Schweben der Auswahl (nur transform/opacity, Einflug nur bei neuem Stand, reduziert still) ── */
  console.log("\n══ 3 · Schweben der Auswahl ══");
  {
    const h = await oeffneHub(b, { kopf: "dunkel", korb: KORB, stil: "premium", breite: 390, hoehe: 900, zeilen: ZEILEN });
    const p = h.p;
    const laeuft = () => p.evaluate(() => [...document.querySelectorAll(".sz-k-auswahl, .sz-k-auswahl *")].flatMap(e => e.getAnimations().map(a => ({ n: a.animationName, props: (a.effect.getKeyframes() || []).flatMap(k => Object.keys(k)).filter(k => !["offset", "easing", "composite", "computedOffset"].includes(k)) }))));
    const a1 = await laeuft();
    pruef("Voraussetzung: gewählte Gerichte tragen ein Foto in der Kachel (Fotos aus dem Korb)", await p.evaluate(() => document.querySelectorAll(".sz-k-auswahl img.sz-f").length) >= 1);
    pruef("die Fotos schweben (eine laufende Animation je Foto, ≥ 1)", a1.some(x => x.n === "szSchweb"), a1);
    pruef("… und es bewegt sich NUR transform/opacity", a1.every(x => x.props.every(k => k === "transform" || k === "opacity")), a1);
    /* §4.1: Einflug nur, wenn sich die Wahl geändert hat. Erstes Zeichnen: Klasse da; Neuzeichnen ohne Änderung: Klasse weg. */
    const erst = await p.evaluate(() => document.querySelector(".sz-k-auswahl").classList.contains("sz-hoch"));
    await p.evaluate(() => zeichne()); await p.waitForTimeout(200);
    const nochmal = await p.evaluate(() => document.querySelector(".sz-k-auswahl").classList.contains("sz-hoch"));
    pruef("Einflug nur bei neuem Stand: nach dem ersten Zeichnen ja, nach Neuzeichnen ohne Änderung nein (§4.1)", erst === true && nochmal === false, { erst, nochmal });
    await p.evaluate(() => { const g = findeGericht("Cola"); merk["Cola"] = { n: g.n, p: g.p, b: "", m: 1 }; merkSpeichern(); zeichne(); });
    await p.waitForTimeout(200);
    pruef("neues Gericht gewählt → der Einflug spielt wieder (neuer Stand)", await p.evaluate(() => document.querySelector(".sz-k-auswahl").classList.contains("sz-hoch")));
    await h.ctx.close();
    const r = await oeffneHub(b, { kopf: "dunkel", korb: KORB, stil: "premium", breite: 390, hoehe: 900, zeilen: ZEILEN, reduziert: true });
    const ar = await r.p.evaluate(() => [...document.querySelectorAll(".sz-k-auswahl, .sz-k-auswahl *")].flatMap(e => e.getAnimations()).length);
    pruef("reduzierte Bewegung: nichts schwebt", ar === 0, ar);
    await r.ctx.close();
  }

  /* ── 4 · Glas-Knopfzeile ── */
  console.log("\n══ 4 · Glas-Knopfzeile ══");
  for(const bild of ["hell", "dunkel"]){
    const h = await oeffneHub(b, { kopf: bild, korb: KORB, stil: "premium", breite: 390, hoehe: 900, reduziert: true });
    const p = h.p;
    const g = await p.evaluate(() => { const cs = getComputedStyle(document.querySelector(".kopfwahl")); const m = /\/\s*([\d.]+)\s*\)|rgba\([^)]*,\s*([\d.]+)\)/.exec(cs.backgroundColor) || []; return { bf: cs.backdropFilter || cs.webkitBackdropFilter, bg: cs.backgroundColor, a: m[1] !== undefined ? +m[1] : m[2] !== undefined ? +m[2] : 1, kw: document.body.dataset.kw || "", kopf: document.body.dataset.kopfbild };
    });
    pruef("Bild " + bild + ": Voraussetzung — Kopfbild an, Kopf im Bild (nicht fest)", g.kopf === "an" && g.kw === "", g);
    pruef("Bild " + bild + ": die Leiste ist Glas (Weichzeichner ≥ 16 px, Fläche höchstens 45 % deckend)", /blur\((\d+)px\)/.test(g.bf) && +/blur\((\d+)px\)/.exec(g.bf)[1] >= 16 && g.a <= .45, g);
    const kz = {};
    for(const [k, sel] of [["Licht", ".kopfwahl button:nth-of-type(1) svg"], ["Sprache", ".kopfwahl button:last-of-type svg"]]) kz[k] = await schlechtester(p, sel);
    pruef("Bild " + bild + ": Zeichen auf dem Glas ≥ 3:1 am schlechtesten Bildpunkt (Bedienzeichen, WCAG 1.4.11)", Object.values(kz).every(v => v !== null && v >= 3), kz);
    await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(500);
    const f = await p.evaluate(() => { const cs = getComputedStyle(document.querySelector(".kopfwahl")); const m = /\/\s*([\d.]+)\s*\)|rgba\([^)]*,\s*([\d.]+)\)/.exec(cs.backgroundColor) || []; return { kw: document.body.dataset.kw || "", bg: cs.backgroundColor, a: m[1] !== undefined ? +m[1] : m[2] !== undefined ? +m[2] : 1 }; });
    pruef("Bild " + bild + ": ist der Kopf aus dem Bild, wird die Leiste wieder fast deckend (≥ 85 %)", f.kw === "fest" && f.a >= .85, f);
    await h.ctx.close();
  }

  /* ── 5 · Speisekarte: Kopfkarte, Highlights, Pillen, Texte aus Markenblatt UND Board ── */
  console.log("\n══ 5 · Speisekarte ══");
  for(const breite of [360, 430]){
    const h = await oeffneHub(b, { kopf: "dunkel", kachelFoto: true, stil: "premium", breite, hoehe: 1000, zeilen: ZEILEN, hash: "#/speisekarte" });
    const p = h.p;
    const sgMb = await p.evaluate(() => JSON.parse(JSON.stringify(MARKENBLATT.startgrafik)));
    const k = await p.evaluate(() => ({ eyebrow: (document.querySelector(".kk-eyebrow") || {}).textContent, titel: (document.querySelector(".kopfkarte h2") || {}).textContent, text: (document.querySelector(".kopfkarte .unter") || {}).textContent,
      schwung: !!document.querySelector(".kk-schwung svg"), herz: !!document.querySelector(".kk-herz2 svg"), zeile: (document.getElementById("titel") || {}).dataset.unterzeile }));
    pruef(breite + " px: Kopfkarte zeigt die Texte des Markenblatts (zweite Quelle: Markenblatt-Objekt)", k.eyebrow === sgMb.karte.eyebrow && k.titel === sgMb.karte.titel && k.text === sgMb.karte.text, [k, sgMb.karte]);
    pruef(breite + " px: Herz und Schwung gezeichnet, Zeile unter dem Namen = Kopfzeile", k.schwung && k.herz && k.zeile === sgMb.karte.kopfzeile, k);
    /* Highlights: jedes Gericht genau EINMAL in der Liste, das beliebte vorn */
    const hl = await p.evaluate(() => ({ kopf: (document.querySelector(".sg-highlights h3") || {}).textContent, namen: [...document.querySelectorAll(".gericht .n")].map(e => e.textContent.trim()), badge: [...document.querySelectorAll(".gbadge")].length }));
    const zeilen = ZEILEN([{ name: "Banane Erdbeere" }, { name: "Waffel Classic" }, { name: "Cola" }]);
    pruef(breite + " px: „Unsere Highlights“ vor der Liste, jedes Gericht genau einmal (Waffel Classic steht nicht doppelt)", !!hl.kopf && hl.namen.filter(n => n === "Waffel Classic").length === 1 && hl.namen[0] === "Waffel Classic" && new Set(hl.namen).size === hl.namen.length, hl);
    pruef(breite + " px: Abzeichen „Beliebt“ nur am beliebten Gericht (eines, aus beliebt:true)", hl.badge === 1, hl.badge);
    /* Pillen: Klartext je Allergen aus ALLERGEN_NAMEN (zweite Quelle), Zeichen davor, höchstens zwei Pillen + „+n“ */
    const pil = await p.evaluate(() => [...document.querySelectorAll(".gericht")].map(g => ({ n: g.querySelector(".n").textContent.trim(), pillen: [...g.querySelectorAll(".gmerk .tag.gp")].map(t => ({ text: t.textContent.trim(), svg: !!t.querySelector("svg"), titel: t.title || "" })) })));
    const alle = await p.evaluate(() => ({ A: ALLERGEN_NAMEN.A, G: ALLERGEN_NAMEN.G, H: ALLERGEN_NAMEN.H }));
    const waffel = pil.find(x => x.n === "Waffel Classic"), banane = pil.find(x => x.n === "Banane Erdbeere"), cola = pil.find(x => x.n === "Cola");
    pruef(breite + " px: Waffel (Vegetarisch + A,G,H): höchstens zwei Pillen plus „+n“, jede mit Zeichen, Allergen-Klartext enthält den Stoffnamen der Tabelle", waffel && waffel.pillen.length === 3 && waffel.pillen.filter(x => !/^\+/.test(x.text)).every(x => x.svg) && /\+2/.test(waffel.pillen[2].text) && waffel.pillen[1].text.toLowerCase().indexOf(alle.G.toLowerCase().split(/[ ,(]/)[0]) >= 0, [waffel, alle]);
    pruef(breite + " px: alle Namen stehen im title (auch die nicht sichtbaren)", waffel && waffel.pillen[1].titel.split(", ").length === 3, waffel && waffel.pillen[1].titel);
    pruef(breite + " px: Banane (veg, G): Vegetarisch + Milch, keine „+n“", banane && banane.pillen.length === 2 && !/^\+/.test(banane.pillen[1].text), banane);
    pruef(breite + " px: Cola (ohne Angabe): KEINE Allergen-Pille — unbekannt ist nicht frei (§0)", cola && cola.pillen.length === 0, cola);
    /* Kategorie-Chips mit Strich-Symbol, Chevron, Preis/Plus in der Karte, kein Überlauf, ≥ 44 px */
    const m = await p.evaluate(() => ({ ico: [...document.querySelectorAll(".chip.mitico .chip-ico svg")].length, chips: document.querySelectorAll(".chips .chip:not(.chip-zurueck)").length, pfeil: document.querySelectorAll(".gpfeil svg").length, gerichte: document.querySelectorAll(".gericht").length,
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      karten: [...document.querySelectorAll(".gericht")].map(g => { const a = g.getBoundingClientRect(), pz = g.querySelector(".gpz").getBoundingClientRect(), pl = (g.querySelector(".gplus, .gmenge") || g).getBoundingClientRect(), tx = g.querySelector(".gtext").getBoundingClientRect(); return { inPz: pz.left >= a.left - 1 && pz.right <= a.right + 1, plus: pl.height, ueberPlus: pz.bottom <= pl.top + 2, textRechts: tx.right <= pz.left + 2 || tx.right <= a.right }; }) }));
    pruef(breite + " px: jeder Chip trägt ein Strich-Symbol, jede Karte einen Pfeil", m.ico === m.chips && m.chips >= 3 && m.pfeil === m.gerichte, m);
    pruef(breite + " px: Preis in der Karte, über dem Plus, Plus ≥ 44 px", m.karten.every(x => x.inPz && x.ueberPlus && x.plus >= 44), m.karten);
    pruef(breite + " px: kein horizontales Scrollen", m.sw <= m.cw, m);
    /* Kopfkarte: Schrift liegt auf der Bandfarbe — am gemalten Bild, Foto hell und dunkel nicht gemessen (Karte trägt Schleier) */
    const kt = {}; for(const [k2, sel] of [["Eyebrow", ".kk-eyebrow"], ["Titel", ".kopfkarte h2"], ["Text", ".kopfkarte .unter"]]) kt[k2] = await schlechtester(p, sel);
    pruef(breite + " px: Kopfkarte — Kennzeile, Titel, Text ≥ 4,5:1 am schlechtesten Bildpunkt", Object.values(kt).every(v => v !== null && v >= 4.5), kt);
    await h.ctx.close();
  }
  {
    /* Board-Weg: hub_texte.karte_* schlägt das Markenblatt; zu lange Werte werden gekürzt wie die Schranke der Datenbank; Markup bleibt Text */
    const texte = { karte_eyebrow: "Heute frisch", karte_titel: "Waffeln, Crêpes & mehr", karte_text: "Alles <b>selbst</b> gebacken.", karte_kopfzeile: "Seit 2019 für euch" };
    const h = await oeffneHub(b, { kopf: "dunkel", kachelFoto: true, stil: "premium", breite: 390, hoehe: 900, zeilen: ZEILEN, hash: "#/speisekarte", texte });
    const k = await h.p.evaluate(() => ({ eyebrow: document.querySelector(".kk-eyebrow").textContent, titel: document.querySelector(".kopfkarte h2").textContent, text: document.querySelector(".kopfkarte .unter").textContent, b: !!document.querySelector(".kopfkarte .unter b"), zeile: document.getElementById("titel").dataset.unterzeile }));
    pruef("Board-Text schlägt das Markenblatt (Kennzeile, Titel, Text, Kopfzeile)", k.eyebrow === texte.karte_eyebrow && k.titel === texte.karte_titel && k.text === texte.karte_text && k.zeile === texte.karte_kopfzeile, k);
    pruef("ein Tag im Text bleibt Text (kein <b> im Bild)", k.b === false, k);
    await h.ctx.close();
    const l = await oeffneHub(b, { kopf: "dunkel", kachelFoto: true, stil: "premium", breite: 390, hoehe: 900, zeilen: ZEILEN, hash: "#/speisekarte", texte: { karte_titel: "T".repeat(90), karte_eyebrow: "E".repeat(70) } });
    const kl = await l.p.evaluate(() => ({ t: document.querySelector(".kopfkarte h2").textContent.length, e: document.querySelector(".kk-eyebrow").textContent.length }));
    pruef("zu lange Werte werden auf die Grenzen der Datenbank gekürzt (Titel 60, Kennzeile 40)", kl.t === 60 && kl.e === 40, kl);
    await l.ctx.close();
    /* Ohne Startgrafik (Haus ohne Angabe oder Schalter weg): die Speisekarte bleibt, wie sie war */
    const o = await oeffneHub(b, { kopf: "dunkel", kachelFoto: true, stil: "premium", breite: 390, hoehe: 900, zeilen: ZEILEN, hash: "#/speisekarte", startgrafik: null });
    const ko = await o.p.evaluate(() => ({ sg: document.body.dataset.sg || "", eyebrow: !!document.querySelector(".kk-eyebrow"), hl: !!document.querySelector(".sg-highlights"), gp: document.querySelectorAll(".tag.gp").length, badge: document.querySelectorAll(".gbadge").length, pfeil: document.querySelectorAll(".gpfeil").length, ico: document.querySelectorAll(".chip-ico").length, zeile: (document.getElementById("titel").dataset.unterzeile || "") }));
    pruef("ohne startgrafik: keine Kennzeile, keine Highlights, keine Pillen/Badge/Pfeil/Chip-Zeichen (Karte wie vorher)", ko.sg === "" && !ko.eyebrow && !ko.hl && ko.gp === 0 && ko.badge === 0 && ko.pfeil === 0 && ko.ico === 0 && ko.zeile === "", ko);
    await o.ctx.close();
  }

  /* ── 6 · Ein Haus ohne Schalter bleibt, wie es war ── */
  console.log("\n══ 6 · Haus ohne Startgrafik ══");
  {
    const h = await oeffneHub(b, { haus: "nordstern", breite: 390, hoehe: 900 });
    const k = await h.p.evaluate(() => ({ sg: document.body.dataset.sg || "", st: document.body.dataset.startgrafik || "", m: document.querySelectorAll(".sg-m, .sg-s, .botschaft").length, bz: typeof MARKENBLATT !== "undefined" && !!MARKENBLATT.startgrafik }));
    pruef("Nordstern: keine Startgrafik im Bild, kein Attribut, kein Eintrag im Markenblatt", k.sg === "" && k.st === "" && k.m === 0 && !k.bz, k);
    await h.ctx.close();
  }

  await b.close();
  console.log("\n" + ok + " ok, " + bad + " rot");
  process.exit(bad ? 1 : 0);
})();
