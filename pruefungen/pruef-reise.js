/* ═══════════════════════════════════════════════════════════════════
   pruef-reise.js — Übergang Kachel → Unterseite, Glas-Knopf „Zurück“

   Seit 10.10. ein schlichter Übergang („ganz flüssig und simpel, ohne
   große Animation“). Vorher gemessen: 1154 ms vom Tipp bis zur Karte,
   weil die Klappkarte die Seite erst bei 76 % der Szene wechselte.
   Was hier gemessen wird, und warum so:

   1 · JEDE Kachel mit Unterseite (über alle a.kachel[href^="#/"] der
       echten Startseite, zweite Quelle: was der Gast sieht) startet die
       Ebene; am Ende ist sie ENTFERNT (§8.1), die Adresse stimmt, und
       elementFromPoint trifft die neue Seite.
   2 · KEINE Verzögerung: Die Adresse ist im selben Takt wie der Tipp
       die neue, und die neue Seite ist gezeichnet (seiteJetzt), bevor
       die Ebene halb durch ist. Das ist der Anlassfall.
   3 · Kurz: 180–320 ms, beim ERSTEN Öffnen genauso wie danach (keine
       lange Fassung mehr).
   4 · Die Ebene wächst aus der Kachel: Im ersten Bild deckt die Fläche
       das Rechteck der angetippten Kachel (± 2 px), im letzten den
       Schirm. Nur transform und opacity (getAnimations), kein Text.
   5 · Das Licht ist die Farbe der Kachel (rot/gold/pistazie) im Haus.
   6 · Ein Tipp während der Ebene beendet sie sofort — und sein Klick
       trifft nichts auf der neuen Seite (Doppeltipp auf die Kachel).
   7 · Reduzierte Bewegung: keine Ebene, sofort die Seite.
   8 · Zurück ohne Ebene; Link nach außen ohne Ebene.
   9 · Der Glas-Knopf: Wort „Zurück“ je Sprache (de/en/ar), volle
       Ansage im aria-label, ≥ 44 px, das Licht läuft (CSS-Animation
       zrLauf, nur transform) — bei reduzierter Bewegung steht es.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DIST = process.env.DIST || path.join(__dirname, "..", "dist");
const HAEUSER = ["chocolamour", "blend"].filter(h => fs.existsSync(path.join(DIST, h, "index.html")));
if (HAEUSER.length < 2) { console.error("dist/ fehlt — erst node erzeuger/erzeuge-hub.js --alle"); process.exit(1); }

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

async function hubAuf(browser, haus, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {}
    /* Ebene beobachten: wann kam sie, wann ging sie. */
    window.__reise = { an: 0, weg: 0, zahl: 0 };
    new MutationObserver(ms => ms.forEach(m => {
      m.addedNodes.forEach(k => { if (k.classList && k.classList.contains("reise")) { window.__reise.an = performance.now(); window.__reise.zahl++; } });
      m.removedNodes.forEach(k => { if (k.classList && k.classList.contains("reise")) window.__reise.weg = performance.now(); });
    })).observe(document, { childList: true, subtree: true });
  });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + path.join(DIST, haus, "index.html"));
  await p.waitForTimeout(1400);
  return { ctx, p, fehler };
}

(async () => {
  const browser = await chromium.launch();

  for (const haus of HAEUSER) {
    console.log("\n══ " + haus + " ══");

    /* ── 1 · jede Kachel ───────────────────────────────────────── */
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus);
      const ziele = await p.evaluate(() => [...document.querySelectorAll('#inhalt a.kachel[href^="#/"]')].map(a => a.getAttribute("href")));
      pruef(ziele.length >= 3, "Voraussetzung: Kacheln mit Unterseite auf der Startseite", ziele.join(" "));
      let ok = 0; const schlecht = [];
      for (const ziel of ziele) {
        await p.evaluate(() => { location.hash = "#/"; });
        await p.waitForTimeout(250);
        const vor = await p.evaluate(() => window.__reise.zahl);
        const a = p.locator('#inhalt a.kachel[href="' + ziel + '"]').first();
        await a.scrollIntoViewIfNeeded();
        await a.click();
        const kam = await p.evaluate(() => !!document.querySelector(".reise"));
        await p.waitForTimeout(600);
        const m = await p.evaluate(() => {
          const mitte = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
          return { hash: location.hash, zahl: window.__reise.zahl, rest: document.querySelectorAll(".reise").length,
                   trifft: !!(mitte && mitte.closest("#inhalt, header, .zurueck, main, body") && !mitte.closest(".reise")) };
        });
        if (kam && m.zahl === vor + 1 && m.rest === 0 && m.hash === ziel && m.trifft) ok++;
        else schlecht.push(ziel + " " + JSON.stringify({ kam, ...m }));
      }
      pruef(ok === ziele.length, "jede Kachel: Ebene startet, endet ENTFERNT, Adresse stimmt, Seite antippbar",
        ok + "/" + ziele.length + (schlecht.length ? " — " + schlecht.join(" | ") : ""));
      pruef(fehler.length === 0, "keine Skriptfehler", fehler[0] || "still");
      await ctx.close();
    }

    /* ── 2–5 · ohne Verzögerung, kurz, aus der Kachel, Licht ──── */
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus);
      const ziele = await p.evaluate(() => [...document.querySelectorAll('#inhalt a.kachel[href^="#/"]')].map(a => a.getAttribute("href")));
      const messe = async ziel => p.evaluate(async ziel => {
        const a = document.querySelector('#inhalt a.kachel[href="' + ziel + '"]');
        a.scrollIntoView({ block: "center" });
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const kr = a.getBoundingClientRect();
        const name = { rot: "--rot", pistazie: "--pistazie" }[a.dataset.farbe] || "--gold";
        const t0 = performance.now();
        a.click();
        const hashSofort = location.hash;
        const r = document.querySelector(".reise");
        const fl = r && r.querySelector(".reise-flaeche");
        const aus = { hashSofort, da: !!r, props: [], worte: [], start: null, ende: null, kachel: null, farbe: null };
        if (fl) {
          const anis = r.getAnimations({ subtree: true });
          const props = new Set();
          anis.forEach(x => x.effect.getKeyframes().forEach(k => Object.keys(k).forEach(s => {
            if (!["offset", "computedOffset", "easing", "composite"].includes(s)) props.add(s);
          })));
          aus.props = [...props];
          const W = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
          for (let k = W.nextNode(); k; k = W.nextNode()) if (/\p{L}{2,}/u.test(k.textContent)) aus.worte.push(k.textContent.trim());
          const halte = anis.map(x => x.currentTime);
          const rund = q => ({ l: Math.round(q.left), t: Math.round(q.top), r: Math.round(q.right), b: Math.round(q.bottom) });
          anis.forEach(x => { x.pause(); x.currentTime = 0; });
          aus.start = rund(fl.getBoundingClientRect());
          anis.forEach(x => { x.currentTime = x.effect.getComputedTiming().duration - 1; });
          aus.ende = rund(fl.getBoundingClientRect());
          anis.forEach((x, i) => { x.currentTime = halte[i]; x.play(); });
          aus.kachel = rund(kr);
          const probe = document.createElement("i");
          probe.style.color = "var(--reise-licht)"; r.appendChild(probe);
          const ist = getComputedStyle(probe).color;
          probe.style.color = "var(" + name + ")";
          aus.farbe = { ist, soll: getComputedStyle(probe).color, name };
          probe.remove();
        }
        /* Bis die neue Seite wirklich gezeichnet ist. */
        const soll = ziel.slice(2).split(/[/?]/)[0];
        let gezeichnet = -1;
        for (let i = 0; i < 60; i++) {
          if (typeof seiteJetzt !== "undefined" && seiteJetzt !== "start") { gezeichnet = performance.now() - t0; break; }
          await new Promise(r => setTimeout(r, 5));
        }
        aus.gezeichnet = gezeichnet;
        await new Promise(r => setTimeout(r, 600));
        aus.dauer = window.__reise.weg - window.__reise.an;
        aus.rest = document.querySelectorAll(".reise").length;
        aus.soll = soll;
        return aus;
      }, ziel);
      const erst = await messe(ziele[0]);
      pruef(erst.da, "Voraussetzung: die Ebene erscheint beim Tipp", erst.da);
      pruef(erst.hashSofort === ziele[0], "keine Verzögerung: Adresse wechselt im selben Takt wie der Tipp", erst.hashSofort);
      pruef(erst.gezeichnet >= 0 && erst.gezeichnet < 130, "keine Verzögerung: neue Seite gezeichnet, bevor die Ebene halb durch ist",
        Math.round(erst.gezeichnet) + " ms (vorher 1154 ms)");
      pruef(erst.dauer >= 180 && erst.dauer <= 340 && erst.rest === 0, "erstes Öffnen: kurz (180–320 ms) und danach entfernt",
        Math.round(erst.dauer) + " ms");
      const k = erst.kachel, st = erst.start, en = erst.ende;
      const nah = (x, y) => Math.abs(x - y) <= 2;
      pruef(!!st && nah(st.l, k.l) && nah(st.t, k.t) && nah(st.r, k.r) && nah(st.b, k.b),
        "die Fläche beginnt genau auf der angetippten Kachel", JSON.stringify({ kachel: k, start: st }));
      pruef(!!en && en.l <= 1 && en.t <= 1 && en.r >= 389 && en.b >= 843, "… und endet über dem ganzen Schirm", JSON.stringify(en));
      pruef(erst.props.length > 0 && erst.props.every(s => s === "transform" || s === "opacity"),
        "nur transform und opacity werden bewegt", erst.props.join(", "));
      pruef(erst.worte.length === 0, "kein Text in der Ebene", erst.worte.join(" | ") || "kein Wort");
      pruef(erst.farbe && erst.farbe.ist === erst.farbe.soll && erst.farbe.ist !== "rgba(0, 0, 0, 0)",
        "das Licht ist die Farbe der Kachel (" + (erst.farbe && erst.farbe.name) + ")", erst.farbe && erst.farbe.ist);
      await p.evaluate(() => { location.hash = "#/"; });
      await p.waitForTimeout(300);
      const zweit = await messe(ziele[1] || ziele[0]);
      pruef(Math.abs(zweit.dauer - erst.dauer) < 40 && zweit.gezeichnet >= 0 && zweit.gezeichnet < 130,
        "zweites Öffnen: genauso kurz und genauso sofort (keine lange Fassung mehr)",
        Math.round(erst.dauer) + " / " + Math.round(zweit.dauer) + " ms");
      pruef(fehler.length === 0, "keine Skriptfehler", fehler[0] || "still");
      await ctx.close();
    }

    /* ── 6 · Tipp beendet die Ebene — sein Klick trifft nichts ──── */
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus);
      const ziel = await p.evaluate(() => document.querySelector('#inhalt a.kachel[href^="#/"]').getAttribute("href"));
      const kr = await p.evaluate(z => { const r = document.querySelector('#inhalt a.kachel[href="' + z + '"]').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, ziel);
      /* Ein Horcher zählt jeden Klick, der auf der NEUEN Seite ankommt. */
      await p.evaluate(() => { window.__durch = 0; document.getElementById("inhalt").addEventListener("click", () => window.__durch++); });
      await p.mouse.click(kr.x, kr.y);
      await p.waitForTimeout(40);
      const vorher = await p.evaluate(() => ({ da: document.querySelectorAll(".reise").length, durch: window.__durch }));
      pruef(vorher.da === 1, "Voraussetzung: die Ebene läuft noch, als der zweite Tipp kommt", vorher.da);
      const t0 = await p.evaluate(() => performance.now());
      await p.mouse.click(kr.x, kr.y);
      await p.waitForTimeout(60);
      const m = await p.evaluate(t0 => ({ rest: document.querySelectorAll(".reise").length, hash: location.hash,
        dauer: window.__reise.weg - t0, durch: window.__durch }), t0);
      pruef(m.rest === 0 && m.dauer < 60, "ein zweiter Tipp beendet die Ebene sofort", Math.round(m.dauer) + " ms");
      pruef(m.durch === vorher.durch && m.hash === ziel, "… und sein Klick trifft nichts auf der neuen Seite",
        JSON.stringify({ klicksAufSeite: m.durch - vorher.durch, hash: m.hash }));
      pruef(fehler.length === 0, "keine Skriptfehler", fehler[0] || "still");
      await ctx.close();
    }

    /* ── 7 · reduzierte Bewegung ───────────────────────────────── */
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus, { ruhig: true });
      const ziel = await p.evaluate(() => document.querySelector('#inhalt a.kachel[href^="#/"]').getAttribute("href"));
      await p.click('#inhalt a.kachel[href="' + ziel + '"]');
      await p.waitForTimeout(150);
      const m = await p.evaluate(() => ({ zahl: window.__reise.zahl, hash: location.hash }));
      pruef(m.zahl === 0 && m.hash === ziel, "reduzierte Bewegung: keine Ebene, sofort die Seite", JSON.stringify(m));
      const licht = await p.evaluate(() => document.getAnimations().filter(x => x.effect && x.effect.target &&
        x.effect.target.classList && x.effect.target.classList.contains("zr-licht") && x.playState === "running").length);
      pruef(licht === 0, "reduzierte Bewegung: das Licht am Zurück-Knopf steht", licht + " laufend");
      pruef(fehler.length === 0, "keine Skriptfehler", fehler[0] || "still");
      await ctx.close();
    }

    /* ── 8 · Zurück und Links nach außen ohne Szene ─────────────── */
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus);
      await p.evaluate(() => { location.hash = "#/speisekarte"; });
      await p.waitForTimeout(500);
      await p.click("#zurueck");
      await p.waitForTimeout(300);
      const m = await p.evaluate(() => ({ zahl: window.__reise.zahl, seite: seiteJetzt }));
      pruef(m.zahl === 0 && m.seite === "start", "Zurück führt ohne Ebene heim", JSON.stringify(m));
      const aussen = await p.evaluate(() => {
        const a = document.createElement("a"); a.className = "kachel"; a.href = "https://example.org/"; a.target = "_blank";
        const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
        return [reiseMoeglich(a, ev), reiseMoeglich(Object.assign(document.createElement("a"), { className: "kachel" }), ev)];
      });
      pruef(aussen[0] === "" && aussen[1] === "", "Link nach außen / ohne Ziel: keine Ebene", JSON.stringify(aussen));

      /* ── 9 · Glas-Knopf ───────────────────────────────────────── */
      await p.evaluate(() => { location.hash = "#/speisekarte"; });
      await p.waitForTimeout(500);
      for (const [sp, soll] of [["de", "Zurück"], ["en", "Back"], ["ar", "رجوع"]]) {
        /* Über das echte Menü: spracheSetzen() allein zeichnet nicht neu. */
        await p.click("#sprachknopf");
        await p.click('#sprachliste [data-sprache="' + sp + '"]');
        await p.waitForTimeout(300);
        const k = await p.evaluate(() => {
          const b = document.getElementById("zurueck"), r = b.getBoundingClientRect();
          const mitte = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { text: b.querySelector(".zr-text").textContent, label: b.getAttribute("aria-label"),
                   h: r.height, w: r.width, oben: mitte === b || b.contains(mitte),
                   ueber: b.querySelector(".zr-text").scrollWidth > b.querySelector(".zr-text").clientWidth + 1 };
        });
        pruef(k.text === soll && k.h >= 44 && k.w >= 44 && k.oben && !k.ueber,
          "Zurück-Knopf (" + sp + "): „" + soll + "“, ≥ 44 px, obenauf, nichts abgeschnitten",
          JSON.stringify(k.text) + " " + Math.round(k.w) + "×" + Math.round(k.h));
        if (sp === "en") pruef(k.label === "Back to overview", "die volle Ansage bleibt im aria-label (übersetzt)", k.label);
      }
      const lauf = await p.evaluate(() => {
        const l = document.querySelector("#zurueck .zr-licht");
        const a = l.getAnimations().find(x => x.animationName === "zrLauf");
        if (!a) return null;
        const props = new Set();
        a.effect.getKeyframes().forEach(k => Object.keys(k).forEach(s => { if (!["offset", "computedOffset", "easing", "composite"].includes(s)) props.add(s); }));
        return { status: a.playState, props: [...props] };
      });
      pruef(!!lauf && lauf.status === "running" && lauf.props.every(s => s === "transform"),
        "das Licht läuft um (zrLauf, nur transform)", JSON.stringify(lauf));
      pruef(fehler.length === 0, "keine Skriptfehler", fehler[0] || "still");
      await ctx.close();
    }
  }

  await browser.close();
  console.log("\n" + (f ? f + " Fehler von " + n : "Alles sauber. (" + n + " Proben)"));
  process.exit(f ? 1 : 0);
})();
