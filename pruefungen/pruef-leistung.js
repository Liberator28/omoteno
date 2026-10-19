/* ═══════════════════════════════════════════════════════════════════
   pruef-leistung.js — „Die Seite wird langsam“ (Wunsch 10.10.)

   Gemessen vorher (4× gebremste CPU, 390×844): Lottie las beim Laden
   alle Filme auf einmal ein (eine lange Aufgabe von 454 ms, in der
   kein Tipp ankam), zehn Filme spielten fast immer zugleich, der
   Goldring am Logo malte abends JEDES Bild neu (@property-Winkel statt
   transform), und #blende trug dauerhaft einen backdrop-filter.

   Was hier gehalten wird, damit es nicht still zurückkommt:
   1 · Abends läuft keine einzige CSS-Animation, die etwas anderes als
       transform/opacity bewegt (fängt den alten ledLauf).
   2 · Die Blende rechnet nur, wenn sie da ist: ohne .an kein
       backdrop-filter, mit .an die Unschärfe.
   3 · Filme starten erst nach `load` und einzeln: Beim DOMContentLoaded
       läuft kein Film; danach spielen außerhalb der Foodroulette
       höchstens BZ_ZUGLEICH (aus dem Hub gelesen) zugleich — über 8 s
       alle 100 ms gezählt.
   4 · Kopf außer Sicht: seine Dauer-Animationen stehen; zurück im Bild
       laufen sie wieder (beides gemessen, nicht angenommen).
   5 · Ein Tipp des Gastes spielt sein Zeichen trotzdem sofort.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const HUB = slug => "file://" + path.join(OBEN, "dist", slug, "index.html");
if (!fs.existsSync(path.join(OBEN, "dist", "chocolamour", "index.html"))) { console.error("dist/ fehlt"); process.exit(1); }

let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if (!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };

async function oeffnen(browser, slug, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: opt.hoehe || 844 } });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(e.message));
  await s.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith("file://")) return r.continue();
    /* Eine langsame Seite nachstellen: Dieses Bild hält „load“ 1,5 s
       auf — wie ein großes Foto im Café-WLAN. Lokal käme load sonst so
       früh, dass kein Film es je überholen KÖNNTE (Gegenbeweis 10.10.:
       „Start sofort“ blieb grün). */
    if (u.includes("langsam.test")) return new Promise(ok => setTimeout(ok, 1500)).then(() =>
      r.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAAAAACw=", "base64") }));
    const m = u.match(/^https:\/\/omoteno\.de\/emoji\/([^?]+)/);
    if (m) { try { return r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" },
      body: fs.readFileSync(path.join(OBEN, "auslieferung", "emoji", m[1])),
      contentType: m[1].endsWith(".js") ? "application/javascript" : "application/json" }); } catch (e) { return r.fulfill({ status: 404, body: "" }); } }
    return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await s.addInitScript(() => {
    try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {}
    window.__beimLaden = -1; window.__ersterFilm = 0;
    document.addEventListener("DOMContentLoaded", () => { const i = new Image(); i.src = "https://langsam.test/foto.gif";
      i.style.cssText = "position:absolute;width:1px;height:1px;opacity:0"; document.body.appendChild(i); });
    addEventListener("load", () => { window.__beimLaden = document.querySelectorAll(".bz-film").length;
      window.__geladenUm = performance.now(); });
    new MutationObserver(ms => { if (!window.__ersterFilm && document.querySelector(".bz-film")) window.__ersterFilm = performance.now(); })
      .observe(document, { childList: true, subtree: true });
  });
  await s.goto(HUB(slug) + "#/");
  await s.waitForTimeout(1600);
  return { ctx, s, fehler };
}

(async () => {
  const browser = await chromium.launch();
  for (const slug of ["chocolamour", "blend"]) {
    console.log("\n══ " + slug + " ══");
    const { ctx, s, fehler } = await oeffnen(browser, slug);
    await s.waitForTimeout(1200);

    /* 1 · abends nur transform/opacity */
    const anim = await s.evaluate(() => {
      document.body.dataset.phase = "abend";
      /* Nach dem Umschalten laufen kurz Übergänge (Farben, Schatten) —
         die sind einmalig. Gemessen werden die DAUER-Animationen. */
      return new Promise(ok => setTimeout(() => {
        const schlecht = [], laufend = [];
        /* getKeyframes() lässt animierte CSS-Variablen in Chromium weg —
           der alte ledLauf (@property --led-winkel) war damit unsichtbar
           (Gegenbeweis 10.10.: grün trotz Sabotage). Deshalb zusätzlich
           die @keyframes-Regeln selbst lesen. */
        const regel = {};
        for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; }
          (function lies(liste){ for (const r of liste) {
            if (r.type === CSSRule.KEYFRAMES_RULE) { const p = regel[r.name] = regel[r.name] || new Set();
              for (const k of r.cssRules) for (let i = 0; i < k.style.length; i++) p.add(k.style[i]); }
            else if (r.cssRules) lies(r.cssRules); } })(rs); }
        document.getAnimations().forEach(a => {
          if (a.playState !== "running" || !a.effect) return;
          if (typeof CSSTransition !== "undefined" && a instanceof CSSTransition) return;
          const props = new Set();
          a.effect.getKeyframes().forEach(k => Object.keys(k).forEach(x => {
            if (!["offset", "computedOffset", "easing", "composite"].includes(x)) props.add(x); }));
          const name = a.animationName || (a.effect.target && a.effect.target.className && String(a.effect.target.className.baseVal ?? a.effect.target.className)) || "?";
          laufend.push(name);
          if (a.animationName && regel[a.animationName]) regel[a.animationName].forEach(x => props.add(x));
          if ([...props].some(x => x !== "transform" && x !== "opacity")) schlecht.push(name + ":" + [...props].join("+"));
        });
        ok({ schlecht, laufend: laufend.length, led: laufend.includes("ledDrehen") });
      }, 1500));
    });
    pruef(anim.laufend > 0 && anim.schlecht.length === 0, "abends: jede laufende Animation bewegt nur transform/opacity",
      anim.schlecht.join(", ") || anim.laufend + " laufend");
    pruef(anim.led, "Voraussetzung: der Goldring am Logo läuft abends (ledDrehen) — sonst prüfte 1 nichts");

    /* 2 · Blende */
    const bl = await s.evaluate(() => {
      const b = document.getElementById("blende") || document.querySelector(".blende");
      if (!b) return null;
      const ruhe = getComputedStyle(b).backdropFilter;
      b.classList.add("an"); const an = getComputedStyle(b).backdropFilter; b.classList.remove("an");
      return { ruhe, an };
    });
    pruef(!!bl && bl.ruhe === "none" && /blur/.test(bl.an), "Blende: in Ruhe kein backdrop-filter, offen die Unschärfe", JSON.stringify(bl));

    /* 3 · Filme: nicht beim Laden, danach höchstens BZ_ZUGLEICH */
    const beimLaden = await s.evaluate(() => ({ n: window.__beimLaden, film: Math.round(window.__ersterFilm), load: Math.round(window.__geladenUm || 0) }));
    pruef(beimLaden.n === 0 && beimLaden.film > 0 && beimLaden.film >= beimLaden.load,
      "der erste Film entsteht erst NACH load (bis dahin steht das Ruhebild)", JSON.stringify(beimLaden));
    await s.evaluate(() => { document.body.dataset.phase = "tag"; });
    /* Die Kacheln mit ihren Filmen ins Bild holen: Seit 18.10. steht der
       Schnellzugriff (zwei Reihen) darüber, und bei 844 px begannen sie
       unter dem Rand — dort wartet jeder Film zu Recht. Gezählt wird
       die Grenze für Filme IM Bild, nicht die Lage der Kacheln. */
    await s.evaluate(() => { const g = document.querySelector(".sbereich .gitter"); if (g) g.scrollIntoView({ block: "start" }); });
    await s.waitForTimeout(600);
    const takt = await s.evaluate(() => new Promise(ok => {
      let max = 0, proben = 0, bereit = 0;
      const t0 = performance.now();
      (function z() {
        let spielt = 0;
        document.querySelectorAll(".bz.bz-bereit").forEach(el => {
          if (el._bz && !el._bz.isPaused && el._bzSicht && !el.closest(".ed-seite")) spielt++; });
        bereit = Math.max(bereit, document.querySelectorAll(".bz.bz-bereit").length);
        max = Math.max(max, spielt); proben++;
        if (performance.now() - t0 < 8000) setTimeout(z, 100); else ok({ max, proben, bereit, grenze: BZ_ZUGLEICH });
      })();
    }));
    pruef(takt.bereit >= 4, "Voraussetzung: mehrere Filme sind bereit (sonst zählte 3 nichts)", takt.bereit);
    pruef(takt.max >= 1 && takt.max <= takt.grenze, "höchstens " + takt.grenze + " Filme spielen zugleich (8 s, alle 100 ms)",
      "max " + takt.max + " bei " + takt.bereit + " bereiten Filmen");

    /* 5 · Tipp spielt sofort, auch über der Grenze */
    const tipp = await s.evaluate(() => {
      const ziel = [...document.querySelectorAll(".kachel")].find(k => { const b = k.querySelector(".bz.bz-bereit"); return b && b._bz && b._bz.isPaused; });
      if (!ziel) return null;
      const bz = ziel.querySelector(".bz.bz-bereit");
      ziel.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      return !bz._bz.isPaused;
    });
    pruef(tipp === true, "ein Tipp auf eine Kachel spielt ihr Zeichen sofort", tipp);

    /* 4 · Kopf außer Sicht */
    await s.setViewportSize({ width: 390, height: 500 });
    await s.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await s.waitForTimeout(400);
    const weg = await s.evaluate(() => {
      const k = document.querySelector("header"), h = k.querySelector(".herz");
      return { ruht: k.classList.contains("kopf-ruht"), unten: k.getBoundingClientRect().bottom,
               herz: h ? getComputedStyle(h).animationPlayState : null };
    });
    pruef(weg.unten < 0 && weg.ruht && weg.herz === "paused", "Kopf außer Sicht: seine Animationen stehen", JSON.stringify(weg));
    await s.evaluate(() => window.scrollTo(0, 0));
    await s.waitForTimeout(400);
    const da = await s.evaluate(() => { const k = document.querySelector("header"), h = k.querySelector(".herz");
      return { ruht: k.classList.contains("kopf-ruht"), herz: h ? getComputedStyle(h).animationPlayState : null }; });
    pruef(!da.ruht && da.herz === "running", "zurück im Bild laufen sie wieder", JSON.stringify(da));
    pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }
  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  console.log(f ? f + " FEHLER" : "Alles sauber.");
  process.exit(f ? 1 : 0);
})();
