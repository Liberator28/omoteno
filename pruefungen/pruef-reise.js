/* ═══════════════════════════════════════════════════════════════════
   pruef-reise.js — Übergang Kachel → Unterseite, Glas-Knopf „Zurück“
   (Wunsch 08.10.)

   Was hier gemessen wird, und warum so:

   1 · JEDE Kachel mit Unterseite startet die Szene — gezählt wird über
       alle a.kachel[href^="#/"] der echten Startseite, nicht über eine
       Liste in der Prüfung (zweite Quelle: das, was der Gast sieht).
       Am Ende ist die Ebene ENTFERNT (nicht versteckt, §8.1), die
       Adresse ist die der Kachel, und elementFromPoint trifft die neue
       Seite — sonst läge eine unsichtbare Fläche über allem.
   2 · Erstes Öffnen lang (~0,92 s), danach kurz (~0,44 s) — seit 09.10.
       kürzer („kompakt und schnell“).
   2a · Seit 09.10.: KEIN Wort in der Szene (Textknoten mit Buchstaben
       außerhalb des Symbols gezählt), die zwei Deckel der Klappkarte
       drehen wirklich auf (rotateY ±172° in den eigenen Keyframes, und
       mitten im Aufklappen steht der berechnete transform schräg), und
       der Sog deckt beim Seitenwechsel den ganzen Schirm (Rechteck der
       Scheibe ⊇ Schirm, Deckkraft ≥ 0,95) — sonst sähe man die alte
       Seite springen.
   3 · Nur transform und opacity — abgelesen an den laufenden
       Animationen selbst (getAnimations), nicht am Quelltext.
   4 · Das Licht kommt aus dem Haus: --reise-licht ist die Farbe der
       Kachel (rot/gold/pistazie), in zwei Häusern.
   5 · Ein Tipp mitten in der Szene springt ans Ende — und trifft NICHT
       die alte Startseite darunter (sonst landete der Gast auf einer
       anderen Kachel). Gegenfall: ohne Tipp läuft sie bis zum Ende.
   6 · Reduzierte Bewegung: keine Szene, sofort die Seite.
   7 · Zurück ohne Szene; Link nach außen ohne Szene.
   8 · Der Glas-Knopf: Wort „Zurück“ je Sprache (de/en/ar), volle
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
        await p.waitForTimeout(1500);
        const m = await p.evaluate(() => {
          const mitte = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
          return { hash: location.hash, zahl: window.__reise.zahl, rest: document.querySelectorAll(".reise").length,
                   trifft: !!(mitte && mitte.closest("#inhalt, header, .zurueck, main, body") && !mitte.closest(".reise")) };
        });
        if (kam && m.zahl === vor + 1 && m.rest === 0 && m.hash === ziel && m.trifft) ok++;
        else schlecht.push(ziel + " " + JSON.stringify({ kam, ...m }));
      }
      pruef(ok === ziele.length, "jede Kachel: Szene startet, endet ENTFERNT, Adresse stimmt, Seite antippbar",
        ok + "/" + ziele.length + (schlecht.length ? " — " + schlecht.join(" | ") : ""));
      pruef(fehler.length === 0, "keine Skriptfehler", fehler[0] || "still");
      await ctx.close();
    }

    /* ── 2–4 · Dauer, Eigenschaften, Licht ─────────────────────── */
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus);
      const ziel = await p.evaluate(() => document.querySelector('#inhalt a.kachel[href^="#/"]').getAttribute("href"));
      await p.click('#inhalt a.kachel[href="' + ziel + '"]');
      const eig = await p.evaluate(() => {
        const r = document.querySelector(".reise");
        const props = new Set();
        let zahl = 0;
        document.getAnimations().forEach(x => {
          const t = x.effect && x.effect.target;
          if (!t || !t.closest || !t.closest(".reise")) return;
          zahl++;
          x.effect.getKeyframes().forEach(k => Object.keys(k).forEach(s => {
            if (!["offset", "computedOffset", "easing", "composite"].includes(s)) props.add(s);
          }));
        });
        const licht = getComputedStyle(r).getPropertyValue("--reise-licht").trim();
        const a = document.querySelector('#inhalt a.kachel[href="' + location.hash + '"]') || null;
        return { props: [...props], zahl, licht };
      });
      pruef(eig.zahl >= 6, "die Szene läuft (Animationen der Ebene)", eig.zahl);
      const bau = await p.evaluate(() => {
        const r = document.querySelector(".reise");
        const W = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
        const worte = [];
        for (let k = W.nextNode(); k; k = W.nextNode())
          if (!k.parentElement.closest(".reise-ico") && /\p{L}{2,}/u.test(k.textContent)) worte.push(k.textContent.trim());
        const tueren = [...r.querySelectorAll(".reise-tuer")].map(t => {
          const a = t.getAnimations()[0];
          const ziel = a ? a.effect.getKeyframes().map(k => k.transform || "").join(" ") : "";
          let schraeg = 0;
          if (a) {
            const vorher = a.currentTime;
            a.pause(); a.currentTime = a.effect.getComputedTiming().duration * .42;
            const m = new DOMMatrix(getComputedStyle(t).transform);
            schraeg = Math.round(Math.acos(Math.max(-1, Math.min(1, m.m11))) * 180 / Math.PI);
            a.currentTime = vorher; a.play();
          }
          return { ziel, schraeg };
        });
        /* Der Sog im Augenblick des Wechsels: alle Animationen auf 0,78. */
        const anis = r.getAnimations({ subtree: true });
        const halte = anis.map(a => a.currentTime);
        anis.forEach(a => { a.pause(); a.currentTime = a.effect.getComputedTiming().duration * .78; });
        const po = r.querySelector(".reise-portal");
        const pr = po ? po.getBoundingClientRect() : { left: 1, top: 1, right: 0, bottom: 0 };
        /* Ein Kreis: jede Ecke des Schirms muss im Radius liegen — das
           umschließende Rechteck allein ließe die Ecken frei. */
        const mx = (pr.left + pr.right) / 2, my = (pr.top + pr.bottom) / 2, rad = (pr.right - pr.left) / 2;
        const ecken = [[0, 0], [innerWidth, 0], [0, innerHeight], [innerWidth, innerHeight]];
        const deckt = { op: po ? +getComputedStyle(po).opacity : 0,
          ganz: rad > 0 && ecken.every(([x, y]) => Math.hypot(x - mx, y - my) <= rad) };
        anis.forEach((a, i) => { a.currentTime = halte[i]; a.play(); });
        return { worte, tueren, deckt };
      });
      pruef(bau.worte.length === 0, "kein Text in der Szene, nur das Symbol", bau.worte.join(" | ") || "kein Wort");
      pruef(bau.tueren.length === 2 && /rotateY\(-172deg\)/.test(bau.tueren[0].ziel) && /rotateY\(172deg\)/.test(bau.tueren[1].ziel)
        && bau.tueren.every(t => t.schraeg >= 30), "die Karte klappt auf: zwei Deckel drehen auseinander",
        bau.tueren.map(t => t.schraeg + "°").join(", ") + " mitten im Aufklappen");
      pruef(bau.deckt.ganz && bau.deckt.op >= .95, "der Sog deckt beim Wechsel den ganzen Schirm",
        JSON.stringify(bau.deckt));
      pruef(eig.props.length > 0 && eig.props.every(s => s === "transform" || s === "opacity"),
        "nur transform und opacity werden bewegt", eig.props.join(", "));
      await p.waitForTimeout(1500);
      const lang = await p.evaluate(() => window.__reise.weg - window.__reise.an);
      pruef(lang > 800 && lang < 1150, "erstes Öffnen: die volle Szene (~0,92 s)", Math.round(lang) + " ms");

      /* Farbe: die der angetippten Kachel, aus dem Haus gelesen. */
      await p.evaluate(() => { location.hash = "#/"; });
      await p.waitForTimeout(300);
      const farbProbe = await p.evaluate(() => {
        const a = document.querySelector('#inhalt a.kachel[href^="#/"]');
        a.click();
        const r = document.querySelector(".reise");
        const name = { rot: "--rot", pistazie: "--pistazie" }[a.dataset.farbe] || "--gold";
        /* Beide Seiten durch dieselbe Probe rechnen: eine Fläche, die
           einmal mit der Ebene und einmal mit der Hausvariable färbt. */
        const probe = document.createElement("i");
        probe.style.color = "var(--reise-licht)"; r.appendChild(probe);
        const ist = getComputedStyle(probe).color;
        probe.style.color = "var(" + name + ")";
        const soll = getComputedStyle(probe).color;
        return { ist, soll, name };
      });
      pruef(farbProbe.ist === farbProbe.soll && farbProbe.ist !== "rgba(0, 0, 0, 0)",
        "das Licht ist die Farbe des Hauses (" + farbProbe.name + ")", farbProbe.ist);
      await p.waitForTimeout(900);
      const kurz = await p.evaluate(() => window.__reise.weg - window.__reise.an);
      pruef(kurz > 300 && kurz < 650, "zweites Öffnen: kurz (~0,44 s)", Math.round(kurz) + " ms");
      pruef(fehler.length === 0, "keine Skriptfehler", fehler[0] || "still");
      await ctx.close();
    }

    /* ── 5 · Tipp überspringt — und trifft nicht die alte Seite ─── */
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus);
      const ziele = await p.evaluate(() => [...document.querySelectorAll('#inhalt a.kachel[href^="#/"]')].map(a => a.getAttribute("href")));
      const ziel = ziele[0];
      await p.click('#inhalt a.kachel[href="' + ziel + '"]');
      await p.waitForTimeout(150);
      /* Getippt wird genau dorthin, wo auf der ALTEN Startseite eine
         andere Kachel lag — der schlimmste Fall. */
      const anderePos = await p.evaluate(z => {
        const a = [...document.querySelectorAll('#inhalt a.kachel[href^="#/"]')].find(x => x.getAttribute("href") !== z);
        if (!a) return null;
        const r = a.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, ziel: a.getAttribute("href") };
      }, ziel);
      pruef(!!anderePos, "Voraussetzung: eine zweite Kachel liegt unter der Szene", anderePos && anderePos.ziel);
      const t0 = await p.evaluate(() => performance.now());
      await p.mouse.click(anderePos.x, anderePos.y);
      await p.waitForTimeout(120);
      const m = await p.evaluate(t0 => ({ rest: document.querySelectorAll(".reise").length, hash: location.hash,
        dauer: window.__reise.weg - t0 }), t0);
      pruef(m.rest === 0 && m.dauer < 100, "ein Tipp springt sofort ans Ende", Math.round(m.dauer) + " ms");
      await p.waitForTimeout(600);
      const h = await p.evaluate(() => location.hash);
      pruef(h === ziel, "der Tipp traf NICHT die Kachel darunter", h + " (soll " + ziel + ", nicht " + anderePos.ziel + ")");
      pruef(fehler.length === 0, "keine Skriptfehler", fehler[0] || "still");
      await ctx.close();
    }

    /* ── 6 · reduzierte Bewegung ───────────────────────────────── */
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus, { ruhig: true });
      const ziel = await p.evaluate(() => document.querySelector('#inhalt a.kachel[href^="#/"]').getAttribute("href"));
      await p.click('#inhalt a.kachel[href="' + ziel + '"]');
      await p.waitForTimeout(150);
      const m = await p.evaluate(() => ({ zahl: window.__reise.zahl, hash: location.hash }));
      pruef(m.zahl === 0 && m.hash === ziel, "reduzierte Bewegung: keine Szene, sofort die Seite", JSON.stringify(m));
      const licht = await p.evaluate(() => document.getAnimations().filter(x => x.effect && x.effect.target &&
        x.effect.target.classList && x.effect.target.classList.contains("zr-licht") && x.playState === "running").length);
      pruef(licht === 0, "reduzierte Bewegung: das Licht am Zurück-Knopf steht", licht + " laufend");
      pruef(fehler.length === 0, "keine Skriptfehler", fehler[0] || "still");
      await ctx.close();
    }

    /* ── 7 · Zurück und Links nach außen ohne Szene ─────────────── */
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus);
      await p.evaluate(() => { location.hash = "#/speisekarte"; });
      await p.waitForTimeout(500);
      await p.click("#zurueck");
      await p.waitForTimeout(300);
      const m = await p.evaluate(() => ({ zahl: window.__reise.zahl, seite: seiteJetzt }));
      pruef(m.zahl === 0 && m.seite === "start", "Zurück führt ohne Szene heim", JSON.stringify(m));
      const aussen = await p.evaluate(() => {
        const a = document.createElement("a"); a.className = "kachel"; a.href = "https://example.org/"; a.target = "_blank";
        const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
        return [reiseMoeglich(a, ev), reiseMoeglich(Object.assign(document.createElement("a"), { className: "kachel" }), ev)];
      });
      pruef(aussen[0] === "" && aussen[1] === "", "Link nach außen / ohne Ziel: keine Szene", JSON.stringify(aussen));

      /* ── 8 · Glas-Knopf ───────────────────────────────────────── */
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
