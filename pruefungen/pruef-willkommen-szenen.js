/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Willkommen-Animationen (Szenen über dem Namen des Hauses)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-willkommen-szenen.js

   > Wunsch (17.10.): „Der Ladebildschirm soll auch verbessert werden …
   > eine ansehnliche Animation … man soll zwischen verschiedenen
   > Animationen wechseln können als neue Einstellung im Board … von der
   > Figur sowie von einem Café oder Restaurant mit Essen, Utensilien.“

   Was der Gast als „Ladebildschirm“ sieht, ist der Willkommensschirm.
   Er trägt jetzt eine von sechs Szenen (hub_stil.lade, feste Liste).

   NEU GEZEICHNET (24.10., Wunsch: „zu einheitlich … wie aus einem
   Animationsstudio, gezeichnet im modernen Stil, alle unterschiedlich“):
   Jede Szene hat ihren eigenen Hintergrund, ihre eigene Teilchenform und
   ihre eigene Bewegungssprache. Abschnitt 9 prüft deshalb nicht mehr „alle
   tragen dieselben fünf Schichten“, sondern das Gegenteil: keine zwei
   Szenen teilen eine Hintergrundschicht, jede hat eigene Animationen.

   ZWEITE QUELLEN: der geteilte Block steht Zeichen für Zeichen gleich in
   Hub und Board; jede Keyframe-Regel, die der Block benutzt, steht IM
   Block (§8.1e); die Liste WZ_ARTEN des Hubs ist die Liste des Boards.

   1 · Naht: Block gleich, selbsttragend, Arten gleich.
   2 · Jede Szene × jedes Haus × Tag/Abend: gezeichnet im eigenen Feld,
       keine schwarze Füllung ohne Regel, tragende Teile ≥ 3:1 gegen den
       Grund des Schirms (Grafik, WCAG 1.4.11), Name/Gruß ≥ 4,5:1.
   3 · Bewegung: ≥ 2 laufende Teile, nur transform/opacity; reduziert
       läuft nichts und die Szene steht trotzdem ganz da.
   4 · Knöpfe sofort antippbar (keine Wartezeit durch die Szene).
   5 · Nach dem Schließen ist die Szene weg und keine ihrer Animationen
       läuft weiter; zweiter Besuch und tiefer Link ohne Schirm.
   6 · Wahl: gemerkte Szene vom letzten Besuch, Live-Wert schlägt sie und
       wird gemerkt, Unbekanntes/Anführungszeichen → Figur.
   7 · Vorschau im Board-Rahmen zeigt den Entwurf.
   8 · Board: sechs Kacheln, gespeicherte gewählt, „Übernehmen“ erst bei
       Änderung, Tipp schickt den Entwurf an die Vorschau, Speichern
       führt hub_stil zusammen, nach dem Neuöffnen der neue Stand (§8.1m),
       ohne gelesenen Stand bleibt „Übernehmen“ gesperrt, außer Sicht
       ruhen die Kacheln, 44 px, 360 px ohne Überlauf.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const HUB = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");
const ADMIN_PFAD = path.join(OBEN, "seiten", "admin.html");
const ADMIN = fs.readFileSync(ADMIN_PFAD, "utf8");
const HAEUSER = fs.readdirSync(path.join(OBEN, "dist")).filter(h => fs.existsSync(path.join(OBEN, "dist", h, "index.html")));

let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

console.log("══ 1 · Naht ══");
const block = s => { const a = s.indexOf("/* ═══ WILLKOMMEN-SZENEN · GETEILTER BLOCK"),
  b = s.indexOf("/* ═══ Ende WILLKOMMEN-SZENEN · GETEILTER BLOCK"); return a >= 0 && b > a ? s.slice(a, b) : null; };
const bH = block(HUB), bA = block(ADMIN);
pruef(!!bH && bH === bA, "geteilter Block in Hub und Board Zeichen für Zeichen gleich", bH ? bH.length + " Zeichen" : "fehlt");
const benutzt = [...new Set([...(bH || "").matchAll(/animation:(wz[A-Z]\w*)/g)].map(m => m[1]))];
const da = [...(bH || "").matchAll(/@keyframes (wz\w+)/g)].map(m => m[1]);
pruef(benutzt.length >= 8 && benutzt.every(k => da.includes(k)), "jede benutzte Keyframe-Regel steht im Block", benutzt.filter(k => !da.includes(k)).join(",") || benutzt.length + " Regeln");
const ARTEN = JSON.parse(((bH || "").match(/const WZ_ARTEN = (\[[^\]]*\])/) || [0, "[]"])[1]);
pruef(ARTEN.length === 6 && ARTEN[0] === "figur", "sechs Szenen, Vorgabe zuerst", ARTEN.join(","));
pruef(!/class="b[ "]/.test(bH || ""), "keine Fläche in der Bandfarbe (sie ist bei dunklen Häusern so dunkel wie der Grund)");

/* Tragende Teile je Szene: Was ohne sie nicht mehr zu erkennen ist. */
const TRAGEND = {
  cafe: [".la", "circle.a", "circle.lt"],
  tisch: ["ellipse.lt", ".gabel .lt", ".kerze .lt", ".glasl .lt"],
  kueche: [".pfanne path.t", ".pfanne rect.t", ".kuchen"],
  lieferung: ["g.roller > path.a", "g.roller > rect.lt", ".rad circle.t"],
  /* Figur und „still“ tragen die Hausfigur — ihre Kontraste misst pruef-figur.js. */
  figur: [], still: []
};

function hubSeite(browser, haus, opt){
  opt = opt || {};
  return (async () => {
    const ctx = await browser.newContext({ viewport:{ width:opt.breite || 390, height:844 }, reducedMotion: opt.still ? "reduce" : "no-preference" });
    if(opt.init) await ctx.addInitScript(opt.init[0], opt.init[1]);
    const p = await ctx.newPage(); const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
      : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
    if(opt.betrieb) await p.route("**/rest/v1/betriebe**", r => r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([opt.betrieb]) }));
    await p.goto("file://" + path.join(OBEN, "dist", haus, "index.html") + (opt.hash || ""));
    return { ctx, p, fehler };
  })();
}
const merk = ([h, a]) => { try{ localStorage.setItem("omoteno-lade-" + h, a); }catch(e){} };

/* Misst die Szene im Browser: Feld, gemalte Teile, Farben, Kontraste. */
const MESSEN = tragend => {
  const rgb = s => { const m = String(s).match(/[\d.]+/g); return m ? m.slice(0, 4).map(Number) : null; };
  const lum = c => { const k = c.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * k[0] + .7152 * k[1] + .0722 * k[2]; };
  const kon = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const schirm = document.getElementById("willkommen");
  const grund = (() => { for(let el = schirm; el; el = el.parentElement){ const c = rgb(getComputedStyle(el).backgroundColor); if(c && (c[3] === undefined || c[3] > .9)) return c; }
    return rgb(getComputedStyle(document.documentElement).backgroundColor); })();
  const wz = document.querySelector("#wkFigur .wz");
  if(!wz) return { fehlt:true };
  const wr = wz.getBoundingClientRect();
  let raus = 0, schwarz = [], teile = 0;
  const tinte = rgb(getComputedStyle(wz).getPropertyValue("--_t").trim() ? (() => { const d = document.createElement("i"); d.style.color = "var(--_t)"; wz.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; })() : "rgb(1,1,1)");
  wz.querySelectorAll("path,ellipse,circle,rect").forEach(e => {
    const r = e.getBoundingClientRect(); if(!r.width && !r.height) return; teile++;
    const ueber = Math.max(wr.left - r.left, r.right - wr.right, wr.top - r.top, r.bottom - wr.bottom);
    /* Was das eigene svg abschneidet (overflow:hidden), ragt nicht hinaus. */
    const sv = e.ownerSVGElement; if(ueber > 6 && !(sv && getComputedStyle(sv).overflow === "hidden")) raus++;
    const cs = getComputedStyle(e);
    if(cs.fill === "rgb(0, 0, 0)" && !(tinte && tinte[0] + tinte[1] + tinte[2] === 0)) schwarz.push(e.getAttribute("class") || e.tagName);
  });
  const tragKon = tragend.map(sel => {
    const els = [...wz.querySelectorAll(sel)];
    if(!els.length) return [sel, 0];
    return [sel, Math.min(...els.map(e => { const cs = getComputedStyle(e);
      const farbe = cs.fill !== "none" ? cs.fill : cs.stroke; const c = rgb(farbe); return c ? kon(c, grund) : 0; }))];
  });
  const textKon = ["wkHaus", "wkWort"].map(id => { const el = document.getElementById(id); return el ? kon(rgb(getComputedStyle(el).color), grund) : 0; });
  return { art: wz.dataset.wz, feld:[Math.round(wr.width), Math.round(wr.height)], teile, raus, schwarz, tragKon, textKon };
};
const LAEUFT = () => {
  const wz = document.querySelector("#wkFigur .wz"); if(!wz) return { laufend:0, fremd:[] };
  const an = wz.getAnimations({ subtree:true }).filter(a => a.playState === "running" && a.effect && a.effect.target !== wz);
  const fremd = new Set();
  an.forEach(a => (a.effect.getKeyframes() || []).forEach(k => Object.keys(k).forEach(x => {
    if(!["offset", "computedOffset", "easing", "composite", "transform", "opacity"].includes(x)) fremd.add(x); })));
  return { laufend: an.length, fremd:[...fremd] };
};

(async () => {
  const browser = await chromium.launch();

  console.log("══ 2+3 · Jede Szene, jedes Haus, Tag und Abend ══");
  for(const haus of HAEUSER) for(const art of ARTEN) for(const abend of [false, true]){
    const { ctx, p, fehler } = await hubSeite(browser, haus, { still:true,
      init:[([h, a, ab]) => { try{ localStorage.setItem("omoteno-lade-" + h, a); if(ab) localStorage.setItem("omoteno-licht-" + h, "dunkel"); }catch(e){} }, [haus, art, abend]] });
    await p.waitForTimeout(450);
    /* Das Vorführhaus merkt sich absichtlich nichts im Gerät — die Szene
       kommt dort wie live über hub_stil. Für alle Häuser derselbe Weg. */
    await p.evaluate(a => { HUBSTIL = Object.assign({}, HUBSTIL || {}, { lade:a }); wzZeigen(); }, art);
    if(abend) await p.evaluate(() => { if(typeof lichtSetzen === "function") lichtSetzen("dunkel"); });
    await p.waitForTimeout(abend ? 1000 : 50);
    const m = await p.evaluate(MESSEN, TRAGEND[art]);
    const wo = haus + " · " + art + (abend ? " · abends" : " · tags");
    if(m.fehlt){ pruef(false, wo + ": Szene steht da"); await ctx.close(); continue; }
    const kurz = m.tragKon.filter(([, k]) => k < 3);
    pruef(m.art === art && m.teile >= 3 && m.raus === 0 && !m.schwarz.length && !kurz.length && Math.min(...m.textKon) >= 4.5 && !fehler.length,
      wo + ": im Feld, nichts schwarz, tragende Teile ≥ 3:1, Name/Gruß ≥ 4,5:1",
      [m.feld.join("×"), m.teile + " Teile", m.raus ? m.raus + " ragen hinaus" : "", m.schwarz.join(","),
       kurz.map(([s, k]) => s + " " + k.toFixed(2)).join(" "), "Text " + m.textKon.map(k => k.toFixed(1)).join("/"), fehler.join(" ")].filter(Boolean).join(" · "));
    await ctx.close();
  }

  for(const art of ARTEN){
    const { ctx, p } = await hubSeite(browser, "chocolamour", { init:[merk, ["chocolamour", art]] });
    await p.waitForTimeout(900);
    const l = await p.evaluate(LAEUFT);
    if(art === "still") pruef(l.laufend === 0, "still: keine Dauer-Animation in der Szene", l.laufend);
    else pruef(l.laufend >= 2 && !l.fremd.length, art + ": ≥ 2 laufende Teile, nur transform/opacity", l.laufend + " laufend" + (l.fremd.length ? ", fremd: " + l.fremd.join(",") : ""));
    await ctx.close();
    const s = await hubSeite(browser, "chocolamour", { still:true, init:[merk, ["chocolamour", art]] });
    /* Früh messen: Der Einflug der Hülle dauert 0,8 s — nach 500 ms wäre
       er auch ohne Ausnahme fast fertig gewesen (so blieb er zuerst unentdeckt). */
    await s.p.waitForTimeout(150);
    const huelle = await s.p.evaluate(() => { const w = document.querySelector("#wkFigur > .wz"); if(!w) return null;
      const cs = getComputedStyle(w); return { o: cs.opacity, f: cs.filter, t: cs.transform }; });
    pruef(!!huelle && huelle.o === "1" && /^(none|blur\(0px\))$/.test(huelle.f) && /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(huelle.t),
      art + " bei reduzierter Bewegung: die Hülle steht nach 150 ms ganz da (kein Einflug)", JSON.stringify(huelle));
    const r = await s.p.evaluate(LAEUFT), m = await s.p.evaluate(MESSEN, TRAGEND[art]);
    const sichtbar = await s.p.evaluate(sel => { const e = document.querySelector("#wkFigur .wz " + sel); return e ? +getComputedStyle(e).opacity : 0; }, TRAGEND[art][0] || "svg");
    pruef(r.laufend === 0 && m.teile >= 3 && sichtbar === 1, art + " bei reduzierter Bewegung: nichts läuft, Szene steht ganz da", r.laufend + " laufend, Deckkraft " + sichtbar);
    await s.ctx.close();
  }

  console.log("══ 4+5 · Knöpfe sofort, danach weg ══");
  {
    const { ctx, p, fehler } = await hubSeite(browser, "blend", { init:[merk, ["blend", "lieferung"]] });
    await p.waitForTimeout(120);
    const treffer = await p.evaluate(() => ["wkSpeisekarte", "wkHub"].map(id => { const b = document.getElementById(id), r = b.getBoundingClientRect();
      const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && (e === b || b.contains(e)); }));
    pruef(treffer.every(Boolean), "120 ms nach dem Laden: beide Knöpfe treffbar", treffer.join(","));
    await p.click("#wkHub");
    await p.waitForTimeout(800);
    const weg = await p.evaluate(() => ({ szene: document.querySelectorAll(".wz").length, figur: (document.getElementById("wkFigur") || {}).innerHTML,
      laeuft: document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(".wz")).length,
      schirm: !!document.getElementById("willkommen") && !document.getElementById("willkommen").hidden }));
    pruef(weg.szene === 0 && !weg.figur && weg.laeuft === 0 && !weg.schirm, "nach „Zur Übersicht“: Szene entfernt, keine ihrer Animationen läuft", JSON.stringify(weg));
    await p.reload(); await p.waitForTimeout(500);
    const zweit = await p.evaluate(() => ({ schirm: !!document.getElementById("willkommen"), szene: document.querySelectorAll(".wz").length }));
    pruef(!zweit.schirm && zweit.szene === 0, "zweiter Besuch in der Sitzung: kein Schirm, keine Szene", JSON.stringify(zweit));
    pruef(!fehler.length, "kein Seitenfehler", fehler.join(" | "));
    await ctx.close();
    const t = await hubSeite(browser, "blend", { hash:"#/speisekarte", init:[merk, ["blend", "cafe"]] });
    await t.p.waitForTimeout(500);
    const tief = await t.p.evaluate(() => ({ schirm: !!document.getElementById("willkommen"), szene: document.querySelectorAll(".wz").length }));
    pruef(!tief.schirm && tief.szene === 0, "tiefer Link: kein Schirm, keine Szene", JSON.stringify(tief));
    await t.ctx.close();
  }

  console.log("══ 6 · Welche Szene ══");
  {
    const art = async opt => { const s = await hubSeite(browser, "chocolamour", opt); await s.p.waitForTimeout(900);
      const r = await s.p.evaluate(() => ({ art: (document.querySelector("#wkFigur .wz") || {}).dataset?.wz, merk: localStorage.getItem("omoteno-lade-chocolamour"),
        img: document.querySelectorAll("#willkommen img").length, xss: window.__xss === 1 }));
      await s.ctx.close(); return r; };
    let r = await art({});
    pruef(r.art === "figur", "ohne Wahl: die Figur des Hauses", r.art);
    r = await art({ init:[merk, ["chocolamour", "lila"]] });
    pruef(r.art === "figur", "unbekannter gemerkter Wert → Figur", r.art);
    r = await art({ init:[merk, ["chocolamour", "cafe"]] });
    pruef(r.art === "cafe", "gemerkte Szene vom letzten Besuch steht sofort", r.art);
    r = await art({ init:[merk, ["chocolamour", "cafe"]], betrieb:{ id:"b", bestell_pause:false, hub_texte:{}, hub_stil:{ lade:"kueche" } } });
    pruef(r.art === "kueche" && r.merk === "kueche", "Live-Wert des Betriebs schlägt den gemerkten und wird gemerkt", JSON.stringify(r));
    r = await art({ init:[merk, ["chocolamour", "cafe"]], betrieb:{ id:"b", bestell_pause:false, hub_texte:{}, hub_stil:{ lade:'"><img src=x onerror="window.__xss=1">' } } });
    pruef(r.art === "figur" && r.merk === null && !r.img && !r.xss, "Anführungszeichen im Live-Wert → Figur, nichts gemerkt, kein Tag", JSON.stringify(r));
  }

  console.log("══ 7 · Vorschau im Board-Rahmen ══");
  {
    const s = await hubSeite(browser, "minhkeey", { init:[() => { window.OMOTENO_VORSCHAU = true; }, null] });
    await s.p.waitForTimeout(500);
    const v = await s.p.evaluate(async () => {
      const vorher = !!document.querySelector("#willkommen:not([hidden])");
      vorschauSetzen({ hub_stil:{ lade:"tisch" } }); vorschauZeige("gruss");
      await new Promise(r => setTimeout(r, 200));
      const a = (document.querySelector("#wkFigur .wz") || {}).dataset?.wz;
      vorschauSetzen({ hub_stil:{ lade:"javascript:" } });
      await new Promise(r => setTimeout(r, 100));
      return { vorher, a, b: (document.querySelector("#wkFigur .wz") || {}).dataset?.wz, merk: localStorage.getItem("omoteno-lade-minhkeey") };
    });
    pruef(!v.vorher && v.a === "tisch" && v.b === "figur" && v.merk === null, "Vorschau: Schirm nicht von selbst, Entwurf sofort, Unbekanntes → Figur, nichts gemerkt", JSON.stringify(v));
    await s.ctx.close();
  }

  console.log("══ 9 · Bühne je Szene (eigener Hintergrund, Teilchen, Unterschiede, Name als Buchstaben, Abgang) ══");
  {
    /* Zweite Quelle: Zahl der Teilchen je Szene aus dem Block gelesen. */
    const cfg = {};
    for(const m of (bH || "").matchAll(/(\w+):\s*\{\s*n:(\d+),\s*f:"(\w+)"/g)) cfg[m[1]] = { n:+m[2], f:m[3] };
    pruef(ARTEN.filter(a => a !== "still").every(a => cfg[a] && cfg[a].n >= 8) && !cfg.still, "Teilchen je Szene im Block festgelegt (mindestens 8), „still“ ohne", JSON.stringify(Object.keys(cfg)));
    const STUFEN = [1800, 3400, 5000];
    const HELL = (p, farbe) => p.evaluate(f => { const k = f.match(/[\d.]+/g).map(Number); return k; }, farbe);
    /* Der Kontrast wird am GEMALTEN Bild gemessen: Text unsichtbar schalten,
       Animationen auf feste Zeiten stellen, Ausschnitt fotografieren und
       jedes Pixel gegen die Schriftfarbe halten. Die Farbwerte allein
       (Abschnitt 2) sähen die Bühne gar nicht. */
    const MESSBILD = async (p, stufe) => {
      const kopf = await p.evaluate(() => {
        /* Die Schriftfarbe wird EINMAL je Seite gelesen: Ab dem zweiten
           Aufruf stünde dort schon „transparent“ (erster Lauf dieser
           Prüfung maß so 1,07:1 und beschuldigte die Bühne zu Unrecht). */
        window.__wkFarbe = window.__wkFarbe || {};
        const aus = ["wkHaus", "wkWort"].map(id => { const el = document.getElementById(id), r = el.getBoundingClientRect();
          if(!window.__wkFarbe[id]) window.__wkFarbe[id] = getComputedStyle(el).color;
          return { id, farbe:window.__wkFarbe[id], x:Math.floor(r.left), y:Math.floor(r.top), w:Math.ceil(r.width), h:Math.ceil(r.height) }; });
        ["wkHaus", "wkWort"].forEach(id => { document.getElementById(id).style.color = "transparent"; });
        return aus;
      });
      if(kopf.some(k => /^rgba\(0, 0, 0, 0\)$|transparent/.test(k.farbe))) throw new Error("Voraussetzung: Schriftfarbe gelesen, nicht transparent");
      await p.evaluate(t => document.getAnimations().forEach(a => { try{ a.pause(); a.currentTime = t; }catch(e){} }), stufe);
      await p.waitForTimeout(60);
      const ergebnis = {};
      for(const k of kopf){
        const buf = await p.screenshot({ clip:{ x:Math.max(0, k.x), y:Math.max(0, k.y), width:Math.max(1, Math.min(k.w, 390 - Math.max(0, k.x))), height:Math.max(1, k.h) } });
        ergebnis[k.id] = await p.evaluate(async ([b64, farbe]) => {
          const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
          const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
          const g = c.getContext("2d"); g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height).data;
          const lum = v => { const q = v.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * q[0] + .7152 * q[1] + .0722 * q[2]; };
          const t = farbe.match(/[\d.]+/g).slice(0, 3).map(Number), lt = lum(t);
          let min = 99;
          for(let i = 0; i < d.length; i += 4){ const lp = lum([d[i], d[i + 1], d[i + 2]]);
            const k = (Math.max(lt, lp) + .05) / (Math.min(lt, lp) + .05); if(k < min) min = k; }
          return min;
        }, [buf.toString("base64"), k.farbe]);
      }
      return ergebnis;
    };
    for(const haus of HAEUSER) for(const abend of [false, true]){
      const schlecht = [];
      let geprueft = 0;
      for(const art of ARTEN.filter(a => a !== "still")){
        const { ctx, p } = await hubSeite(browser, haus, { init:[([h, a, ab]) => { try{ localStorage.setItem("omoteno-lade-" + h, a); if(ab) localStorage.setItem("omoteno-licht-" + h, "dunkel"); }catch(e){} }, [haus, art, abend]] });
        await p.waitForTimeout(500);
        await p.evaluate(a => { HUBSTIL = Object.assign({}, HUBSTIL || {}, { lade:a }); wzZeigen(); }, art);
        if(abend){ await p.evaluate(() => { if(typeof lichtSetzen === "function") lichtSetzen("dunkel"); }); await p.waitForTimeout(1000); }
        const da = await p.evaluate(() => !!document.querySelector("#wkFigur .wz-buehne"));
        if(!da){ schlecht.push(art + ": keine Bühne"); await ctx.close(); continue; }
        for(const st of STUFEN){
          const m = await MESSBILD(p, st); geprueft++;
          for(const id of Object.keys(m)) if(m[id] < 4.5) schlecht.push(art + "@" + st + " " + id + " " + m[id].toFixed(2));
        }
        await ctx.close();
      }
      pruef(geprueft === 15 && !schlecht.length, haus + " · " + (abend ? "abends" : "tags") + ": Name und Gruß ≥ 4,5:1 AM GEMALTEN BILD (5 Szenen × 3 Zeitpunkte, schlechtester Bildpunkt)",
        schlecht.slice(0, 4).join(" | ") || geprueft + " Bilder");
    }

    /* Aufbau, Bewegung und Tippschutz der Bühne in jeder Szene — und: Die Szenen
       sind UNTERSCHIEDLICH (Wunsch 24.10.: „zu einheitlich … alle unterschiedlich“).
       Vorher trugen alle fünf dieselben fünf Schichten; die Probe zählte genau das
       als Erfolg („1 Strahlenkranz, 3 Auren, 2 Wellen“) und hätte jede Angleichung
       belohnt. Jetzt zählt das Gegenteil: eigener Hintergrund, eigene Animationen. */
    const hintergruende = {}, namen = {}, formen = {};
    for(const art of ARTEN){
      const { ctx, p } = await hubSeite(browser, "chocolamour", { init:[merk, ["chocolamour", art]] });
      await p.waitForTimeout(1200);
      const b = await p.evaluate(() => {
        const st = document.querySelector("#wkFigur .wz-buehne");
        if(!st) return null;
        const alle = st.getAnimations({ subtree:true }).filter(a => a.playState === "running");
        const fremd = new Set();
        st.getAnimations({ subtree:true }).forEach(a => (a.effect.getKeyframes() || []).forEach(k => Object.keys(k).forEach(x => {
          if(!["offset", "computedOffset", "easing", "composite", "transform", "opacity"].includes(x)) fremd.add(x); })));
        const kinder = [...st.children].map(c => getComputedStyle(c).pointerEvents);
        const fig = document.querySelector("#wkFigur .wz").getBoundingClientRect();
        const e = document.elementFromPoint(fig.left + fig.width / 2, fig.top + fig.height / 2);
        const szene = document.querySelector("#wkFigur .wz");
        return { bg:st.dataset.bg, hinten:[...st.children].filter(c => !c.classList.contains("wz-teil")).map(c => c.className.split(" ")[0]),
          teile:st.querySelectorAll(".wz-teil").length, form:(st.querySelector(".wz-teil") || { className:"" }).className.split(" ")[1],
          lauf:alle.length, fremd:[...fremd],
          namen:[...new Set(szene.getAnimations({ subtree:true }).filter(a => a.playState === "running" && a.animationName).map(a => a.animationName))],
          tippfrei:kinder.every(x => x === "none") && st.style.pointerEvents !== "auto" && getComputedStyle(st).pointerEvents === "none",
          obenauf:!!e && !e.closest(".wz-buehne") };
      });
      if(art === "still"){ pruef(b === null, "still: keine Bühne"); await ctx.close(); continue; }
      hintergruende[art] = b && b.hinten; namen[art] = (b && b.namen) || []; formen[art] = b && b.form;
      pruef(!!b && b.bg === art && b.hinten.length >= 2 && b.teile === cfg[art].n,
        art + ": eigener Hintergrund (≥ 2 Schichten, data-bg = Szene) und " + cfg[art].n + " Teilchen (Zahl aus dem Block)", JSON.stringify(b && { bg:b.bg, hinten:b.hinten, teile:b.teile }));
      pruef(!!b && b.lauf >= cfg[art].n + 1 && !b.fremd.length, art + ": die Bühne läuft (Teilchen + Hintergrund), nur transform/opacity", b && (b.lauf + " laufend" + (b.fremd.length ? ", fremd: " + b.fremd.join(",") : "")));
      pruef(!!b && b.tippfrei && b.obenauf, art + ": die Bühne fängt keinen Tipp (pointer-events none, Szene liegt obenauf)", b && JSON.stringify({ tippfrei:b.tippfrei, obenauf:b.obenauf }));
      await ctx.close();
      /* Reduzierte Bewegung: der Hintergrund steht sichtbar still da, nichts läuft, die Teilchen entfallen. */
      const s = await hubSeite(browser, "chocolamour", { still:true, init:[merk, ["chocolamour", art]] });
      await s.p.waitForTimeout(400);
      const r = await s.p.evaluate(() => { const st = document.querySelector("#wkFigur .wz-buehne");
        const hinten = [...st.children].filter(c => !c.classList.contains("wz-teil"));
        return { lauf:st.getAnimations({ subtree:true }).filter(a => a.playState === "running").length, licht:Math.max(...hinten.map(c => +getComputedStyle(c).opacity)),
          teile:[...st.querySelectorAll(".wz-teil")].filter(e => +getComputedStyle(e).opacity > 0).length }; });
      pruef(r.lauf === 0 && r.licht > .3 && r.teile === 0, art + " bei reduzierter Bewegung: mindestens eine Hintergrundschicht steht sichtbar still, die Teilchen entfallen", JSON.stringify(r));
      await s.ctx.close();
    }
    {
      const arten = Object.keys(hintergruende);
      const paare = [];
      for(let i = 0; i < arten.length; i++) for(let j = i + 1; j < arten.length; j++){
        const A = arten[i], B = arten[j];
        const gemeinsamHg = hintergruende[A].filter(c => hintergruende[B].includes(c));
        const nurA = namen[A].filter(x => !namen[B].includes(x)).length, nurB = namen[B].filter(x => !namen[A].includes(x)).length;
        if(gemeinsamHg.length || nurA < 4 || nurB < 4) paare.push(A + "/" + B + " (gemeinsame Schichten " + gemeinsamHg.join("+") + "; nur-eigene Animationen " + nurA + "/" + nurB + ")");
      }
      pruef(arten.length === 5 && !paare.length, "keine zwei Szenen teilen eine Hintergrundschicht, jede hat ≥ 4 Animationen, die die andere nicht benutzt (alle Paare)", paare.join(" | ") || "10 Paare");
      pruef(new Set(Object.values(formen)).size === 5, "jede Szene hat ihre eigene Teilchenform", JSON.stringify(formen));
    }

    /* Der Name als Buchstaben. */
    {
      const { ctx, p } = await hubSeite(browser, "chocolamour", { init:[merk, ["chocolamour", "cafe"]] });
      await p.waitForTimeout(2200);
      const n = await p.evaluate(() => { const h = document.getElementById("wkHaus"), name = BETRIEB.name;
        const b = [...h.querySelectorAll(".wk-b")], ids = b.map(x => +x.style.getPropertyValue("--i"));
        return { name, text:h.textContent, label:h.getAttribute("aria-label"), buchstaben:b.length, soll:Array.from(name.replace(/ /g, "")).length,
          versteckt:[...h.querySelectorAll(".wk-wort")].every(w => w.getAttribute("aria-hidden") === "true"), aufsteigend:ids.every((x, i) => i === 0 || x >= ids[i - 1]) }; });
      pruef(n.text === n.name && n.label === n.name && n.buchstaben === n.soll && n.versteckt && n.aufsteigend,
        "Name als Buchstaben: Text unverändert, Beschriftung = Name, jeder Buchstabe eigen, Folge steigt, für Vorleser nur die Beschriftung", JSON.stringify(n));
      /* Ein sehr langer Name: Folge auf 22 gedeckelt, umbrochen wird nur zwischen Wörtern, nichts läuft über. */
      await p.setViewportSize({ width:360, height:700 });
      const lang = await p.evaluate(() => { wkTitel("Gasthaus zum goldenen Löwen am Marktplatz — Weinstube & Küche");
        const h = document.getElementById("wkHaus"), ids = [...h.querySelectorAll(".wk-b")].map(x => +x.style.getPropertyValue("--i"));
        const worte = [...h.querySelectorAll(".wk-wort")].map(w => w.getBoundingClientRect());
        return { max:Math.max(...ids), ueber:document.documentElement.scrollWidth - innerWidth, hr:h.getBoundingClientRect().right,
          imBild:worte.every(r => r.left >= -1 && r.right <= innerWidth + 1), zeilen:new Set(worte.map(r => Math.round(r.top))).size }; });
      pruef(lang.max === 22 && lang.ueber <= 0 && lang.imBild && lang.zeilen >= 2, "langer Name bei 360 px: Folge höchstens 22, in Zeilen umbrochen, nichts ragt hinaus", JSON.stringify(lang));
      const sonder = await p.evaluate(() => { wkTitel('<img src=x onerror="window.__x=1"> & "Q" 🍕'); const h = document.getElementById("wkHaus");
        return { img:h.querySelectorAll("img").length, x:window.__x === 1, text:h.textContent }; });
      pruef(!sonder.img && !sonder.x && sonder.text.includes("<img") && sonder.text.includes("🍕"), "Name mit Markup und Emoji bleibt Text (kein Tag, Emoji ganz)", JSON.stringify(sonder));
      await ctx.close();
    }

    /* Der Abgang: Beim Schließen zieht die Bühne an und verschwindet nach vorn. */
    {
      const { ctx, p } = await hubSeite(browser, "chocolamour", { init:[merk, ["chocolamour", "figur"]] });
      await p.waitForTimeout(1900);
      const vor = await p.evaluate(() => { const b = document.querySelector(".wk-buehne"), cs = getComputedStyle(b); return { o:+cs.opacity, t:cs.transform }; });
      await p.evaluate(() => document.getElementById("wkHub").click());
      await p.waitForTimeout(230);
      const mitte = await p.evaluate(() => { const b = document.querySelector(".wk-buehne"), cs = getComputedStyle(b);
        const m = cs.transform.match(/matrix\(([^)]+)\)/); return { o:+cs.opacity, sk:m ? +m[1].split(",")[0] : 1 }; });
      pruef(vor.o === 1 && mitte.o < 1 && mitte.sk > 1.003 && mitte.sk < 1.12, "Abgang: nach 230 ms ist die Bühne schon größer (Hindurchfahren) und halb ausgeblendet",
        "vorher Deckkraft " + vor.o + ", dann " + mitte.o.toFixed(2) + " / Maßstab " + mitte.sk.toFixed(3));
      await p.waitForTimeout(700);
      const ende = await p.evaluate(() => !document.getElementById("willkommen") || document.getElementById("willkommen").hidden);
      pruef(ende, "Abgang: nach 0,9 s ist der Schirm weg", ende);
      await ctx.close();
    }
  }

  console.log("══ 8 · Board ══");
  async function board(stil, opt){
    opt = opt || {};
    const ctx = await browser.newContext({ viewport:{ width:opt.breite || 390, height:900 } });
    const p = await ctx.newPage(); const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.addInitScript(() => { Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; });
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
      : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
    await p.goto("file://" + ADMIN_PFAD);
    await p.waitForTimeout(600);
    const scharf = await p.$("#scharfJetzt");
    if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(150); }
    await p.evaluate(([stil, o]) => {
      window.__bb = { id:"b1", slug:"blend", name:"Blend", rolle:"inhaber", bestell_pause:false, hub_texte:{}, hub_stil:stil, markenblatt:null };
      window.__upd = []; window.__send = []; window.__ohneStand = !!o.ohneStand;
      const antwort = z => {
        if(z.tab === "betrieb_mitglieder") return o.ohneStand ? { data:null, error:{ message:"weg" } } : { data:[{ rolle:"inhaber", betriebe:JSON.parse(JSON.stringify(window.__bb)) }], error:null };
        return { data: z.einzeln ? null : [], error:null };
      };
      const kette = tab => { const z = { tab, einzeln:false };
        const p = new Proxy(function(){}, { get(_, k){ if(k === "then") return res => res(antwort(z));
          return (...a) => { if(k === "update"){ window.__upd.push({ tab, wert:a[0] }); if(tab === "betriebe") Object.assign(window.__bb, a[0]); }
            if(k === "maybeSingle" || k === "single") z.einzeln = true; return p; }; }, apply(){ return p; } }); return p; };
      db = { from:kette, rpc: async () => ({ data:[], error:null }), channel:() => kette("kanal"), removeChannel:async () => {},
        storage:{ from:() => kette("speicher") }, functions:{ invoke:async () => ({ data:null, error:null }) },
        auth:{ getSession:async () => ({ data:{ session:null } }), getUser:async () => ({ data:{ user:{ id:"u1", email:"probe@example.org" } } }),
               onAuthStateChange:() => ({ data:{ subscription:{ unsubscribe(){} } } }) } };
      demo = false;
      const alt = hvSenden; hvSenden = function(s, t, z){ window.__send.push({ s, t, z }); return alt.apply(this, arguments); };
    }, [stil, opt]);
    await p.evaluate(async () => { document.getElementById("tor").hidden = true;
      try{ localStorage.setItem(merkSchluessel(), "b1"); }catch(e){}
      if(window.__ohneStand) return;
      try{ meineBetriebe = await betriebeHolen(); await betriebWaehlen(); }catch(e){ throw new Error("Board: " + (e && (e.message || JSON.stringify(e)))); } });
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('[data-tafel="startseite"]').click());
    await p.waitForTimeout(300);
    await gruppeZu(p, "#wzGruppe");
    await p.$eval("#wzGruppe", g => g.scrollIntoView({ block:"start" }));
    await p.waitForTimeout(250);
    return { ctx, p, fehler };
  }
  let { ctx, p, fehler } = await board({ emoji:true, lade:"tisch" }, { breite:360 });
  let b = await p.evaluate(() => {
    const k = [...document.querySelectorAll("#wzWahlen .wz-wahl")];
    return { arten: k.map(x => x.dataset.wzw), an: k.filter(x => x.getAttribute("aria-checked") === "true").map(x => x.dataset.wzw),
      szenen: k.map(x => (x.querySelector(".wz") || {}).dataset?.wz), knopf: document.getElementById("wzSichern").disabled,
      hoehe: Math.min(...k.map(x => x.getBoundingClientRect().height)), ueber: document.documentElement.scrollWidth - innerWidth,
      inhaber: document.getElementById("wzGruppe").hasAttribute("data-nur-inhaber") };
  });
  pruef(JSON.stringify(b.arten) === JSON.stringify(ARTEN) && JSON.stringify(b.szenen) === JSON.stringify(ARTEN), "sechs Kacheln = WZ_ARTEN, jede zeigt ihre Szene", b.arten.join(","));
  pruef(b.an.length === 1 && b.an[0] === "tisch" && b.knopf, "gespeicherte Szene gewählt, „Übernehmen“ gesperrt ohne Änderung", b.an.join(","));
  pruef(b.hoehe >= 44 && b.ueber <= 0 && b.inhaber, "Kacheln ≥ 44 px, 360 px ohne Überlauf, Besitzer-Gruppe", b.hoehe + " / " + b.ueber);
  /* Außer Sicht ruhen die Szenen. Seit 19.10. steht die Gruppe als eigene
     Unterseite da, und bei 900 px Höhe passen alle sechs Kacheln ins Bild —
     „außer Sicht“ gäbe es nie. Deshalb ein niedriges Fenster: Die unteren
     Reihen liegen darunter. Voraussetzung wird mitgemessen (unten). */
  await p.setViewportSize({ width:360, height:380 });
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
  const ruhe = await p.evaluate(() => [...document.querySelectorAll("#wzWahlen .wz-wahl")].map(x => { const r = x.getBoundingClientRect();
    return { aus: r.bottom < 0 || r.top > innerHeight, ruht: x.classList.contains("wz-ruht") }; }));
  pruef(ruhe.some(x => x.aus) && ruhe.every(x => !x.aus || x.ruht), "außer Sicht ruhen die Szenen", ruhe.filter(x => x.aus).length + " außer Sicht");
  await p.$eval('#wzWahlen [data-wzw="kueche"]', x => x.scrollIntoView({ block:"center" }));
  await p.click('#wzWahlen [data-wzw="kueche"]'); await p.waitForTimeout(200);
  b = await p.evaluate(() => ({ an: [...document.querySelectorAll('#wzWahlen [aria-checked="true"]')].map(x => x.dataset.wzw),
    knopf: document.getElementById("wzSichern").disabled, send: window.__send.slice(-1)[0], upd: window.__upd.length }));
  pruef(b.an.join() === "kueche" && !b.knopf && b.upd === 0, "Tipp wählt, schreibt nichts, „Übernehmen“ frei", JSON.stringify(b.an));
  pruef(b.send && b.send.s === "gestalten" && b.send.z === "gruss" && JSON.stringify(b.send.t) === '{"hub_stil":{"lade":"kueche"}}', "Tipp schickt genau den Entwurf an die Vorschau, Gruß zeigen", JSON.stringify(b.send));
  await p.click("#wzSichern"); await p.waitForTimeout(250);
  b = await p.evaluate(() => ({ upd: window.__upd.filter(u => u.tab === "betriebe").slice(-1)[0], knopf: document.getElementById("wzSichern").disabled }));
  pruef(b.upd && JSON.stringify(b.upd.wert) === '{"hub_stil":{"emoji":true,"lade":"kueche"}}' && b.knopf, "„Übernehmen“ führt hub_stil zusammen (emoji bleibt)", JSON.stringify(b.upd && b.upd.wert));
  /* Neu öffnen: das Board liest den Betrieb neu (§8.1m). */
  await p.evaluate(async () => { meineBetriebe = await betriebeHolen(); await betriebWaehlen(); }); await p.waitForTimeout(300);
  b = await p.evaluate(() => [...document.querySelectorAll('#wzWahlen [aria-checked="true"]')].map(x => x.dataset.wzw).join());
  pruef(b === "kueche", "nach dem Neuöffnen steht der gespeicherte Stand", b);
  pruef(!fehler.length, "kein Seitenfehler im Board", fehler.join(" | "));
  await ctx.close();
  ({ ctx, p, fehler } = await board(null, { ohneStand:true }));
  await p.$eval('#wzWahlen [data-wzw="cafe"]', x => x.scrollIntoView({ block:"center" })).catch(() => {});
  await p.click('#wzWahlen [data-wzw="cafe"]').catch(() => {}); await p.waitForTimeout(150);
  b = await p.evaluate(() => ({ knopf: document.getElementById("wzSichern").disabled }));
  await p.evaluate(() => document.getElementById("wzSichern").click()); await p.waitForTimeout(150);
  const upd = await p.evaluate(() => window.__upd.filter(u => u.tab === "betriebe").length);
  pruef(b.knopf && upd === 0, "ohne gelesenen Stand: „Übernehmen“ gesperrt, schreibt nichts", JSON.stringify(b) + " / " + upd);
  await ctx.close();

  await browser.close();
  console.log("\n" + (f ? f + " Fehler" : "Alles sauber.") + " (" + n + " Proben)");
  process.exit(f ? 1 : 0);
})();
