/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Figur lebt — Begleiter auf der Startseite

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-begleiter.js

   Wunsch 10.10. (dritte Nachricht): „Mach mehr Figuren und
   Animationen.“ Vier neue Figuren (Croissant, Donut, Taco, Ramen) —
   deren Zeichnung, Klassen und Kontraste prüft pruef-figur.js, die
   Wahl im Board pruef-figur-board.js. Hier die Bewegung:

   1 · Die Figur atmet und blinzelt (laufende Animationen am gemalten
       Element, nicht nur eine Regel im Blatt); nur transform/opacity.
   2 · Sie grüßt EINMAL je Anlass und Sitzung (b-hallo, bgHallo) —
       zurück auf die Startseite grüßt sie nicht noch einmal (§4.1);
       nach dem Gruß ist die Klasse weg.
   3 · Ein Tipp: sie hüpft (bgHops läuft), DASSELBE Element bleibt
       (§4.3), ein zweiter Tipp nach dem Ende hüpft wieder.
   4 · Jede neue Figur steht als Begleiter da, im 48-px-Feld.
   5 · Reduzierte Bewegung: nichts läuft, kein Hüpfer.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DIST = process.env.DIST || path.join(__dirname, "..", "dist");
let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}
const HAEUSER = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html")));
const NEU = ["croissant", "donut", "taco", "ramen"];

async function oeffnen(browser, haus, ruhig) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: ruhig ? "reduce" : "no-preference" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.clock.setFixedTime(new Date("2026-10-10T14:00:00"));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await s.goto("file://" + path.join(DIST, haus, "index.html") + "#/");
  await s.waitForTimeout(300);
  return { ctx, s, fehler };
}

/* Echter Mausklick auf die Mitte: Die Figur atmet, für Playwrights
   „stabil“ steht sie nie still — der Klick selbst ist dennoch echt. */
async function tippen(s, el) {
  await el.evaluate(e => e.scrollIntoView({ block: "center" }));
  const b = await el.boundingBox();
  await s.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

const lauf = s => s.evaluate(() => {
  const b = document.querySelector(".begleiter"), fig = b && b.querySelector(".figur");
  if (!fig) return null;
  const anis = fig.getAnimations({ subtree: true }).filter(a => a.playState === "running");
  const props = new Set();
  anis.forEach(a => a.effect.getKeyframes().forEach(k => Object.keys(k).forEach(x => {
    if (!["offset", "computedOffset", "easing", "composite"].includes(x)) props.add(x); })));
  return { namen: anis.map(a => a.animationName).sort(), props: [...props], hallo: b.classList.contains("b-hallo") };
});

(async () => {
  const browser = await chromium.launch();
  pruef(HAEUSER.length >= 2, "mindestens zwei Häuser erzeugt (§8.1a)", HAEUSER.join(", "));
  for (const haus of HAEUSER) {
    const { ctx, s, fehler } = await oeffnen(browser, haus);
    let m = await lauf(s);
    pruef(!!m, haus + ": Begleiter mit Figur auf der Startseite (Voraussetzung)");
    if (!m) { await ctx.close(); continue; }
    pruef(m.hallo && m.namen.includes("bgHallo"), haus + ": grüßt beim ersten Erscheinen", m.namen.join(","));
    pruef(m.namen.includes("bgBlinzeln"), haus + ": blinzelt", m.namen.join(","));
    pruef(m.props.every(p => p === "transform" || p === "opacity"), haus + ": nur transform/opacity", m.props.join(","));
    await s.waitForTimeout(1100);
    m = await lauf(s);
    pruef(!m.hallo && m.namen.includes("bgAtem") && !m.namen.includes("bgHallo"), haus + ": nach dem Gruß: Klasse weg, die Figur atmet", m.namen.join(","));

    /* zurück auf die Startseite: kein zweiter Gruß (§4.1) */
    await s.evaluate(() => { location.hash = "#/speisekarte"; });
    await s.waitForTimeout(400);
    await s.evaluate(() => { location.hash = "#/"; });
    await s.waitForTimeout(400);
    m = await lauf(s);
    pruef(!!m && !m.hallo && !m.namen.includes("bgHallo"), haus + ": zurück auf der Startseite grüßt sie nicht noch einmal", m && m.namen.join(","));

    /* Tipp → Hüpfer, dasselbe Element, und wieder */
    const fig = await s.$(".begleiter .figur");
    await s.evaluate(el => { window.__fig = el; }, fig);
    await tippen(s, fig);
    await s.waitForTimeout(120);
    m = await lauf(s);
    pruef(m.namen.includes("bgHops"), haus + ": ein Tipp — sie hüpft", m.namen.join(","));
    await s.waitForTimeout(700);
    const nach = await s.evaluate(() => ({ gleich: document.querySelector(".begleiter .figur") === window.__fig,
      klasse: window.__fig.classList.contains("b-hops") }));
    pruef(nach.gleich && !nach.klasse, haus + ": nach dem Hüpfer dasselbe Element, Klasse wieder weg", JSON.stringify(nach));
    await tippen(s, fig); await s.waitForTimeout(120);
    m = await lauf(s);
    pruef(m.namen.includes("bgHops") && !m.namen.includes("bgHallo"), haus + ": zweiter Tipp hüpft wieder (ohne neuen Gruß)", m.namen.join(","));

    /* 4 · jede neue Figur als Begleiter */
    for (const fk of NEU) {
      const g = await s.evaluate(fk => {
        MARKENBLATT.avatar = Object.assign({}, MARKENBLATT.avatar || {}, { figur: fk });
        zeichne();
        const svg = document.querySelector(".begleiter .figur"); if (!svg) return null;
        const r = svg.getBoundingClientRect(), bb = svg.getBBox();
        return { klasse: svg.getAttribute("class"), w: r.width, h: r.height, innen: bb.x >= -1 && bb.y >= -1 && bb.x + bb.width <= 125 && bb.y + bb.height <= 129 };
      }, fk);
      pruef(!!g && g.klasse.includes("f-" + fk) && Math.abs(g.w - 48) < 1 && g.innen, haus + ": „" + fk + "“ steht als Begleiter im 48-px-Feld, nichts ragt heraus", g && JSON.stringify(g));
    }
    pruef(!fehler.length, haus + ": keine Seitenfehler", fehler[0]);
    await ctx.close();
  }

  /* 5 · reduzierte Bewegung */
  {
    const { ctx, s } = await oeffnen(browser, HAEUSER[0], true);
    let m = await lauf(s);
    pruef(!!m && m.namen.length === 0, "reduzierte Bewegung: an der Figur läuft nichts", m && m.namen.join(","));
    await tippen(s, await s.$(".begleiter .figur")); await s.waitForTimeout(120);
    m = await lauf(s);
    pruef(m.namen.length === 0, "reduzierte Bewegung: ein Tipp lässt sie nicht hüpfen", m.namen.join(","));
    await ctx.close();
  }
  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if (f) { console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
