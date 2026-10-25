/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Willkommensschirm — beide Knöpfe tragen ein Symbol

   Anlass (24.10.): „Die Auswahl zwischen Übersicht (umbenennen) und
   Speisekarte soll beide jeweils durch ein Symbol untermauert werden.“
   Heißt jetzt „Zur Startseite“ (Haus) und „Speisekarte ansehen“ (Besteck).

   Gemessen wird am GEMALTEN Bild, nicht am Auszeichnungstext:
     1 · jeder Knopf hat sein Symbol (Strich gemalt, nicht leer), links vom
         Text (Arabisch: rechts), auf einer Höhe mit ihm, ohne Überlappung
     2 · Symbol = Besteck bzw. Haus (zweite Quelle: ICONS.speise / HN_ICON.start)
     3 · Tapfläche ≥ 44 px, Symbol 18–26 px
     4 · Schrift UND Symbol ≥ 4,5:1 am schlechtesten Bildpunkt (Tag/Abend,
         alle fünf Häuser; Symbol und Schrift teilen currentColor)
     5 · beide Zeichner des Schirms (erster Besuch UND Rückkehr per „Gruß“)
         setzen dieselben Knöpfe — nach dem zweiten Zeichnen genau EIN Symbol
     6 · Text in jeder Sprache übersetzt, nie das Deutsche stehengeblieben
     7 · reduzierte Bewegung: steht sofort da
     8 · 320 px: nichts läuft über, auch bei langem Text (Russisch)
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { kontrast, schlechtester } = require("./werkzeug/messen.js");

const OBEN = path.resolve(__dirname, "..");
const HAEUSER = ["chocolamour", "blend", "nordstern", "piugusto", "minhkeey"].filter(h => fs.existsSync(path.join(OBEN, "dist", h, "index.html")));
const HUB = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");

let n = 0, f = 0;
function pruef(b, t, d) { n++; if (!b) f++; console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : "")); }

/* Zweite Quelle: die Pfade der beiden Symbole aus der Vorlage. */
const ico = (name, anker) => { const i = HUB.indexOf(anker); const s = HUB.indexOf("<svg", i); return HUB.slice(s, HUB.indexOf("</svg>", s) + 6); };
const SPEISE = ico("speise", "  speise:  '<svg");
const START = ico("start", "const HN_ICON = {\n  start:'<svg");
const pfade = svg => (svg.match(/ d="[^"]+"/g) || []).join("|");

async function seite(browser, haus, opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: opt.breite || 390, height: 844 }, reducedMotion: opt.still ? "reduce" : "no-preference" });
  if (opt.init) await ctx.addInitScript(opt.init[0], opt.init[1]);
  const p = await ctx.newPage(); const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await p.goto("file://" + path.join(OBEN, "dist", haus, "index.html"));
  await p.waitForTimeout(300);
  return { ctx, p, fehler };
}

const MESSEN = () => {
  const aus = {};
  for (const id of ["wkSpeisekarte", "wkHub"]) {
    const k = document.getElementById(id); if (!k) { aus[id] = null; continue; }
    const kr = k.getBoundingClientRect();
    const i = k.querySelector(".wk-ico"), x = k.querySelector(".wk-txt");
    const ir = i && i.getBoundingClientRect(), xr = x && x.getBoundingClientRect();
    const svg = i && i.querySelector("svg");
    const pfade = svg ? Array.from(svg.querySelectorAll("path")).map(p => " d=\"" + p.getAttribute("d") + "\"").join("|") : "";
    const cs = svg ? getComputedStyle(svg.querySelector("path")) : null;
    aus[id] = {
      kw: kr.width, kh: kr.height, kr: kr.right, kl: kr.left, ksw: k.scrollWidth, kcw: k.clientWidth,
      anzahl: k.querySelectorAll(".wk-ico").length,
      ix: ir && ir.left, iw: ir && ir.width, ih: ir && ir.height, im: ir && (ir.top + ir.height / 2),
      xx: xr && xr.left, xr: xr && xr.right, xm: xr && (xr.top + xr.height / 2), text: x ? x.textContent : null,
      stroke: cs ? cs.stroke : null, strokeW: cs ? parseFloat(cs.strokeWidth) : 0, fill: cs ? cs.fill : null,
      farbe: getComputedStyle(k).color, pfade, hidden: k.hidden,
    };
  }
  return aus;
};

(async () => {
  const browser = await chromium.launch();

  pruef(pfade(SPEISE).length > 20 && pfade(START).length > 20, "zweite Quelle gelesen: Besteck und Haus aus der Vorlage", pfade(SPEISE).length + "/" + pfade(START).length);

  console.log("\n══ Symbol je Knopf, alle Häuser, Tag/Abend ══");
  for (const haus of HAEUSER) for (const abend of [false, true]) {
    const wo = haus + (abend ? " · abends" : " · tags");
    const { ctx, p, fehler } = await seite(browser, haus, { init: [([h, ab]) => { try { if (ab) localStorage.setItem("omoteno-licht-" + h, "dunkel"); } catch (e) {} }, [haus, abend]] });
    if (abend) { await p.evaluate(() => { if (typeof lichtSetzen === "function") lichtSetzen("dunkel"); }); await p.waitForTimeout(1000); }
    const steht = await p.evaluate(() => { const w = document.getElementById("willkommen"); return !!w && !w.hidden; });
    pruef(steht, wo + ": Willkommensschirm steht (Voraussetzung)");
    if (!steht) { await ctx.close(); continue; }
    await p.waitForTimeout(1800);   /* Einflug zu Ende (Verzögerung .99 s + .55 s) */
    const m = await p.evaluate(MESSEN);
    for (const [id, quelle, wort] of [["wkSpeisekarte", SPEISE, "Besteck"], ["wkHub", START, "Haus"]]) {
      const k = m[id];
      pruef(k && k.anzahl === 1, wo + " · " + id + ": genau ein Symbol", k && k.anzahl);
      if (!k || !k.anzahl) continue;
      pruef(k.pfade === pfade(quelle), wo + " · " + id + ": Symbol ist das " + wort + " aus der Vorlage");
      pruef(k.stroke !== "none" && k.strokeW >= 1.5 && k.fill === "none", wo + " · " + id + ": Strich gemalt (" + k.stroke + ", " + k.strokeW + ")", k.fill);
      pruef(k.iw >= 18 && k.iw <= 26 && Math.abs(k.iw - k.ih) < 1, wo + " · " + id + ": Symbol 18–26 px und quadratisch", k.iw + "×" + k.ih);
      pruef(k.ix + k.iw <= k.xx + 0.5 && k.ix >= k.kl, wo + " · " + id + ": Symbol links vom Text, ohne Überlappung", Math.round(k.ix + k.iw) + " ≤ " + Math.round(k.xx));
      pruef(Math.abs(k.im - k.xm) <= 2.5, wo + " · " + id + ": auf einer Höhe mit dem Text", Math.abs(k.im - k.xm).toFixed(1));
      pruef(k.kh >= 44, wo + " · " + id + ": Tapfläche ≥ 44 px hoch", Math.round(k.kh));
      pruef(k.ksw <= k.kcw + 1, wo + " · " + id + ": nichts läuft über", k.ksw + "/" + k.kcw);
      const sw = await schlechtester(p, "#" + id + " .wk-txt");
      pruef(sw !== null && sw >= 4.5, wo + " · " + id + ": Schrift (und Symbol, gleiche Farbe) ≥ 4,5:1 am gemalten Bild", sw && sw.toFixed(2));
    }
    pruef(fehler.length === 0, wo + ": keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ Der zweite Zeichner (Rückkehr per Gruß) setzt dieselben Knöpfe ══");
  {
    const { ctx, p } = await seite(browser, "chocolamour");
    await p.evaluate(() => { wkKnoepfe(); wkKnoepfe(); });
    const m = await p.evaluate(MESSEN);
    pruef(m.wkSpeisekarte.anzahl === 1 && m.wkHub.anzahl === 1, "zweimal gezeichnet: je Knopf weiter genau ein Symbol", m.wkSpeisekarte.anzahl + "/" + m.wkHub.anzahl);
    /* Die Rückkehr-Stelle liegt in einer Funktion der Seite — beide Stellen müssen den Helfer benutzen. */
    const stellen = (HUB.match(/wkKnoepfe\(\);/g) || []).length;
    pruef(stellen >= 2, "beide Zeichner des Schirms rufen den Helfer (Quelltext, mindestens zwei Aufrufe)", stellen);
    pruef(!/\$\("wkHub"\)\.textContent|\$\("wkSpeisekarte"\)\.textContent/.test(HUB), "kein Zeichner setzt den Knopftext noch von Hand (das Symbol ginge verloren)");
    await ctx.close();
  }

  console.log("\n══ Sprachen ══");
  {
    const erwartet = { en: ["View menu", "To the home page"], tr: ["Menüyü görüntüle", "Ana sayfaya"], ru: null, ar: null, fr: null, es: null, it: null, pl: null, uk: null, nl: null, ro: null };
    const { ctx, p } = await seite(browser, "chocolamour");
    for (const code of Object.keys(erwartet)) {
      const m = await p.evaluate(c => { spracheSetzen(c); wkKnoepfe(); return { sk: document.querySelector("#wkSpeisekarte .wk-txt").textContent, hub: document.querySelector("#wkHub .wk-txt").textContent, dir: document.documentElement.dir }; }, code);
      pruef(m.hub !== "Zur Startseite" && m.hub !== "Zur Übersicht" && m.hub.length > 3 && m.sk !== "Speisekarte ansehen", code + ": beide Knöpfe übersetzt", m.sk + " | " + m.hub);
      if (erwartet[code] && code === "tr") pruef(m.hub === "Ana sayfaya", "tr: Wortlaut", m.hub);
      if (code === "ar") {
        const g = await p.evaluate(MESSEN);
        for (const id of ["wkSpeisekarte", "wkHub"]) {
          const k = g[id];
          pruef(k.ix >= k.xr - 0.5 && k.ix + k.iw <= k.kr + 0.5, "ar · " + id + ": Symbol RECHTS vom Text (gespiegelt)", Math.round(k.ix) + " ≥ " + Math.round(k.xr));
        }
      }
    }
    await ctx.close();
  }

  console.log("\n══ Enge Schirme und reduzierte Bewegung ══");
  for (const [breite, code] of [[320, "ru"], [320, "de"]]) {
    const { ctx, p } = await seite(browser, "chocolamour", { breite });
    await p.evaluate(c => { spracheSetzen(c); wkKnoepfe(); }, code);
    await p.waitForTimeout(1800);
    const m = await p.evaluate(MESSEN);
    for (const id of ["wkSpeisekarte", "wkHub"]) {
      const k = m[id];
      pruef(k.ksw <= k.kcw + 1 && k.kr <= breite, breite + " px " + code + " · " + id + ": nichts läuft über", k.ksw + "/" + k.kcw + " rechts " + Math.round(k.kr));
    }
    await ctx.close();
  }
  {
    const { ctx, p } = await seite(browser, "chocolamour", { still: true });
    const ani = await p.evaluate(() => ["wkSpeisekarte", "wkHub"].map(id => { const k = document.getElementById(id); return getComputedStyle(k).opacity + "/" + getComputedStyle(k).animationName; }));
    pruef(ani.every(a => a.startsWith("1/")), "reduzierte Bewegung: beide Knöpfe stehen sofort voll da", ani.join(" "));
    const m = await p.evaluate(MESSEN);
    pruef(m.wkSpeisekarte.anzahl === 1 && m.wkHub.anzahl === 1, "reduzierte Bewegung: Symbole da");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " von " + n + " Fehler." : n + " von " + n + " ok\nAlles sauber."));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
