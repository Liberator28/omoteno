/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Wischen zwischen den Unterseiten (mit echtem Finger)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-seitenwischen.js

   Wunsch 11.10.: „Man soll, wenn man in der Speisekarte ist, durch nach
   links Wischen auf die nächste Kachel kommen, die in der Reihenfolge
   ist, so dass man schnell switchen kann.“

   Gemessen mit echten Touch-Folgen über CDP (Input.dispatchTouchEvent,
   CLAUDE.md §3.8 — eine Maus-Probe sähe keine Geste). Beide Häuser:
   1 · Die Folge ist die der Startseite: wischFolge() = Reihenfolge der
       a.kachel[href^="#/"] auf der gezeichneten Startseite (zweite
       Quelle), ohne Doppelte.
   2 · Nach links von der Speisekarte → nächste Kachel; mitten im Zug
       folgt die Seite dem Finger (translateX ≈ Fingerweg) und eine
       Pille nennt das Ziel; danach steht #inhalt ohne transform, die
       Pille ist weg, elementFromPoint trifft die neue Seite.
   3 · Nach rechts → wieder zurück. Ein kurzer Zug (40 px) → bleibt.
   4 · Senkrecht → rollt, kein Wechsel. Beginnt der Finger in einer
       seitlich rollenden Leiste → kein Wechsel.
   5 · Am Anfang nach rechts / am Ende nach links → bleibt.
   6 · Bewegung nur transform, ≤ 300 ms; reduzierte Bewegung: Wechsel
       ohne Animation. Arabisch: gespiegelt (nach rechts = weiter).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DIST = process.env.DIST || path.join(__dirname, "..", "dist");
const HAEUSER = ["chocolamour", "blend"].filter(h => fs.existsSync(path.join(DIST, h, "index.html")));
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

async function oeffnen(browser, haus, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true,
    reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  await ctx.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.clock.setFixedTime(new Date("2026-10-10T14:00:00"));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + path.join(DIST, haus, "index.html") + "#/");
  await p.waitForTimeout(1200);
  if(opt.sprache){ await p.evaluate(s => { spracheSetzen(s); zeichne(); }, opt.sprache); await p.waitForTimeout(300); }
  const cdp = await ctx.newCDPSession(p);
  return { ctx, p, cdp, fehler };
}
/* Ein Zug: von (x,y) um (dx,dy) in n Schritten; optional mitten im Zug messen. */
/* y = "yz": der Finger setzt auf einer Fläche auf, die NICHT seitlich rollt — je Seite neu bestimmt. Die Kategorie-Chips sind so eine
   Leiste (der Wechsel bleibt dort aus, gewollt); mit der höheren Kopfkarte der Startgrafik lagen sie bei 520 px. Mitte der Kopfkarte bzw.
   der Überschrift der gerade gezeigten Seite, sonst 520. */
async function aufsetzY(p){
  return p.evaluate(() => { const e = document.querySelector(".kopfkarte, #inhalt .seite h2"); const b = e && e.getBoundingClientRect();
    return b && b.height > 20 && b.y > 0 && b.bottom < innerHeight - 120 ? Math.round(b.y + b.height / 2) : 520; });
}
async function zug(p, cdp, x, y, dx, dy, mitte){
  if(y === "yz") y = await aufsetzY(p);
  const n = 14;
  await cdp.send("Input.dispatchTouchEvent", { type:"touchStart", touchPoints:[{ x, y }] });
  let gemessen = null;
  for(let i = 1; i <= n; i++){
    await cdp.send("Input.dispatchTouchEvent", { type:"touchMove", touchPoints:[{ x: x + dx * i / n, y: y + dy * i / n }] });
    await p.waitForTimeout(16);
    if(mitte && i === Math.round(n / 2)) gemessen = await p.evaluate(() => {
      const m = new DOMMatrix(getComputedStyle(document.getElementById("inhalt")).transform);
      const pl = document.querySelector(".wischziel");
      return { tx:m.m41, pille: pl ? pl.textContent.trim() : "", deck: pl ? +getComputedStyle(pl).opacity : 0 };
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type:"touchEnd", touchPoints:[] });
  await p.waitForTimeout(650);
  return gemessen;
}
const lage = p => p.evaluate(() => {
  const feld = document.getElementById("inhalt"), r = feld.getBoundingClientRect();
  const e = document.elementFromPoint(195, Math.min(innerHeight - 60, r.top + 200));
  return { hash:location.hash, tf:getComputedStyle(feld).transform, pille:!!document.querySelector(".wischziel"),
    trifft: !!(e && feld.contains(e)), y:scrollY };
});
const gehe = async (p, z) => { await p.evaluate(z => { location.hash = z; window.scrollTo(0, 0); }, z); await p.waitForTimeout(450); };

(async () => {
  const browser = await chromium.launch();
  pruef(HAEUSER.length >= 2, "zwei Häuser (§8.1a)", HAEUSER.join(", "));
  for(const haus of HAEUSER){
    console.log("\n══ " + haus + " ══");
    let { ctx, p, cdp, fehler } = await oeffnen(browser, haus);
    await p.$$eval('.sb-kopf[aria-expanded="false"]', ks => ks.forEach(k => k.click())).catch(() => {});
    const quelle = await p.evaluate(() => {
      const dom = [...new Set([...document.querySelectorAll('#inhalt a.kachel[href^="#/"]')].map(a => a.getAttribute("href")))];
      return { dom, folge: wischFolge().map(x => x.ziel) };
    });
    pruef(quelle.folge.length >= 3 && quelle.folge.join() === quelle.dom.join(), "Folge = Reihenfolge der Kacheln auf der Startseite",
      quelle.folge.join(" "));
    const F = quelle.folge;
    const i = Math.max(0, F.findIndex(z => z.startsWith("#/speisekarte")));
    const ziel = F[i + 1] || F[i - 1];
    await gehe(p, F[i]);
    /* 2 · nach links → nächste */
    const mitte = await zug(p, cdp, 330, "yz", -280, 6, true);
    let l = await lage(p);
    pruef(!!mitte && mitte.tx < -100 && mitte.tx > -160 && mitte.deck > .2 && mitte.pille.length > 1,
      "mitten im Zug: die Seite folgt dem Finger, eine Pille nennt das Ziel", JSON.stringify(mitte));
    pruef(l.hash === F[i + 1], "nach links: nächste Kachel (" + F[i + 1] + ")", l.hash);
    pruef(l.tf === "none" && !l.pille && l.trifft, "danach: ohne transform, Pille weg, die neue Seite liegt obenauf", JSON.stringify(l));

    /* 3 · nach rechts → zurück; kurzer Zug → bleibt */
    await zug(p, cdp, 60, "yz", 280, 6);
    l = await lage(p);
    pruef(l.hash === F[i], "nach rechts: zurück (" + F[i] + ")", l.hash);
    await zug(p, cdp, 300, "yz", -40, 0);
    l = await lage(p);
    pruef(l.hash === F[i] && l.tf === "none", "kurzer Zug (40 px): bleibt und federt zurück", JSON.stringify(l));

    /* 4 · senkrecht rollt; in einer seitlich rollenden Leiste kein Wechsel */
    const y0 = (await lage(p)).y;
    await zug(p, cdp, 200, 700, 10, -300);
    l = await lage(p);
    pruef(l.hash === F[i] && l.y > y0 + 100, "senkrecht: die Seite rollt, kein Wechsel", JSON.stringify({ y0, y:l.y, hash:l.hash }));
    await gehe(p, F[i]);
    const leiste = await p.evaluate(() => {
      for(const e of document.querySelectorAll("#inhalt *")){
        const ox = getComputedStyle(e).overflowX;
        if((ox === "auto" || ox === "scroll") && e.scrollWidth > e.clientWidth + 2){
          const r = e.getBoundingClientRect();
          /* Ans Ende gerollt: Dort kann die Leiste nicht weiter, der
             Browser übernimmt die Geste NICHT — erst dann trägt die
             Ausnahme (in der Mitte bräche der Browser den Zug selbst ab,
             und die Probe wäre auch ohne Ausnahme grün). */
          e.scrollLeft = e.scrollWidth;
          if(r.top > 0 && r.bottom < innerHeight && r.height > 20) return { x:r.left + r.width * .8, y:r.top + r.height / 2, links:e.scrollLeft };
        }
      }
      return null;
    });
    pruef(!!leiste && leiste.links > 0, "Voraussetzung: eine seitlich rollende Leiste im Bild, ans Ende gerollt", leiste && leiste.links);
    if(leiste){
      await zug(p, cdp, leiste.x, leiste.y, -200, 0);
      l = await lage(p);
      /* Gemessen wird das Ergebnis, nicht die Zeile: In Chromium bricht
         die Leiste den Zug selbst ab (Gegenbeweis ohne wischSperre blieb
         grün) — siehe Kommentar an wischSperre im Hub. */
      pruef(l.hash === F[i], "Finger beginnt in der Leiste: kein Wechsel", l.hash);
    }

    /* 5 · Ränder */
    await gehe(p, F[0]);
    await zug(p, cdp, 60, "yz", 280, 6);
    pruef((await lage(p)).hash === F[0], "erste Kachel, nach rechts: bleibt");
    await gehe(p, F[F.length - 1]);
    await zug(p, cdp, 330, "yz", -280, 6);
    pruef((await lage(p)).hash === F[F.length - 1], "letzte Kachel, nach links: bleibt");

    /* 6 · Bewegung: nur transform, kurz */
    await gehe(p, F[i]);
    await p.evaluate(() => { window.__ani = []; const feld = document.getElementById("inhalt");
      const alt = feld.animate.bind(feld);
      feld.animate = (k, o) => { const a = alt(k, o); window.__ani.push({ props:[...new Set(k.flatMap(x => Object.keys(x)))], d:+(o && o.duration) || 0 }); return a; }; });
    await zug(p, cdp, 330, "yz", -280, 6);
    const ani = await p.evaluate(() => window.__ani);
    pruef(ani.length >= 1 && ani.every(a => a.props.every(x => x === "transform" || x === "offset" || x === "easing") && a.d <= 300),
      "Bewegung nur transform, je ≤ 300 ms", JSON.stringify(ani));
    pruef(!fehler.length, "keine Seitenfehler", fehler[0]);
    await ctx.close();

    /* reduzierte Bewegung */
    ({ ctx, p, cdp, fehler } = await oeffnen(browser, haus, { ruhig:true }));
    await gehe(p, F[i]);
    await zug(p, cdp, 330, "yz", -280, 6);
    l = await lage(p);
    const laeuft = await p.evaluate(() => document.getElementById("inhalt").getAnimations().length);
    pruef(l.hash === F[i + 1] && l.tf === "none" && laeuft === 0, "reduzierte Bewegung: Wechsel ohne Animation", JSON.stringify({ hash:l.hash, laeuft }));
    await ctx.close();

    /* Arabisch: gespiegelt */
    ({ ctx, p, cdp, fehler } = await oeffnen(browser, haus, { sprache:"ar" }));
    const FA = await p.evaluate(() => wischFolge().map(x => x.ziel));
    const ia = Math.max(0, FA.findIndex(z => z.startsWith("#/speisekarte")));
    await gehe(p, FA[ia]);
    await zug(p, cdp, 60, "yz", 280, 6);
    l = await lage(p);
    pruef(l.hash === FA[ia + 1], "Arabisch: nach rechts = weiter", l.hash);
    pruef(!fehler.length, "Arabisch: keine Seitenfehler", fehler[0]);
    await ctx.close();
  }
  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if(f){ console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
