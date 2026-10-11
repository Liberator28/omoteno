/* ═══════════════════════════════════════════════════════════════════
   pruef-reise.js — Kachel → Unterseite OHNE Übergang, Glas-Knopf „Zurück“

   Seit 11.10. (Wunsch: „die Übergangsanimationen von den Kacheln raus,
   man sieht sie sowieso nicht, und sie sorgt nur dafür, dass es so
   aussieht, als ob die Seite länger braucht“) gibt es keine Ebene mehr.
   Gemessen wird, dass es dabei bleibt:

   1 · JEDE Kachel mit Unterseite der echten Startseite (zweite Quelle:
       a.kachel[href^="#/"], was der Gast sieht), über den echten Tipp:
       die Adresse wechselt im selben Takt, die neue Seite ist im
       nächsten Bild gezeichnet, es entsteht nie eine .reise-Ebene.
   2 · Im ersten Bild ist die neue Seite DECKEND: kein Element in
       #inhalt unter voller Deckkraft, keine Verzögerung; was sich
       bewegt, ist nur transform und höchstens 220 ms.
   3 · Reduzierte Bewegung: gar keine Animation in #inhalt.
   4 · Zurück führt heim, ebenfalls ohne Ebene.
   5 · Der Glas-Knopf: Wort „Zurück“ je Sprache (de/en/ar), volle
       Ansage im aria-label, ≥ 44 px, das Licht läuft (zrLauf, nur
       transform).
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
    /* Entstünde je wieder eine Ebene: hier wird sie gezählt. */
    window.__reise = { zahl: 0 };
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(k => {
      if (k.classList && (k.classList.contains("reise") || k.classList.contains("reise-flaeche"))) window.__reise.zahl++;
    }))).observe(document, { childList: true, subtree: true });
  });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + path.join(DIST, haus, "index.html"));
  await p.waitForTimeout(1400);
  /* Bereiche aufklappen (pruef-startseite.js): sonst haben Kacheln
     keine Höhe. Die Wahl gilt für die Sitzung. */
  await p.$$eval('.sb-kopf[aria-expanded="false"]', ks => ks.forEach(k => k.click())).catch(() => {});
  return { ctx, p, fehler };
}

/* Tippt die Kachel an (echtes Klickereignis an ihr) und misst im
   selben Takt und im nächsten Bild. */
const TIPP = href => new Promise(fertig => {
  const a = [...document.querySelectorAll('#inhalt a.kachel')].find(x => x.getAttribute("href") === href);
  if (!a) return fertig(null);
  a.scrollIntoView({ block: "center" });
  const vorher = location.hash;
  a.click();
  const sofort = location.hash;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const kinder = [...document.querySelectorAll("#inhalt, #inhalt *")].filter(e => e.getClientRects().length);
    /* Ausgenommen: Fotos — sie blenden ein, SOBALD sie geladen sind
       (ein Bild kann nicht vor seinem Laden da sein, und es hält keinen
       Text auf); bewegte Zeichen tauschen Ruhebild und Film. */
    /* Gegen die RUHE gemessen, nicht gegen 1: Manches ist absichtlich
       halbdurchsichtig (der Pfeil der Foodroulette-Pille, 0,85). */
    const erst = kinder.filter(e => e.tagName !== "IMG" && !e.closest(".bz-film, .bz-still, .fr-treffer, .fr-glas, .fr-lichter, .lw-name, svg"))
      .map(e => [e, parseFloat(getComputedStyle(e).opacity)]);
    const anis = document.getAnimations().filter(x => x.effect && x.effect.target && x.effect.target.closest && x.effect.target.closest("#inhalt") &&
      (x.animationName === "reinGleiten" || x.animationName === "rein" || x.animationName === "reinLeise"));
    const props = new Set(); let dauer = 0, verz = 0;
    anis.forEach(x => { const t = x.effect.getTiming(); dauer = Math.max(dauer, +t.duration || 0); verz = Math.max(verz, +t.delay || 0);
      x.effect.getKeyframes().forEach(k => Object.keys(k).forEach(s => { if (!["offset", "computedOffset", "easing", "composite"].includes(s)) props.add(s); })); });
    setTimeout(() => {
      const blass = erst.filter(([e, o]) => e.isConnected && o < parseFloat(getComputedStyle(e).opacity) - 0.01).length;
      fertig({ vorher, sofort, ziel: href, seite: seiteJetzt, blass, anis: anis.length, props: [...props], dauer, verz, ebenen: window.__reise.zahl });
    }, 900);
  }));
});

(async () => {
  const browser = await chromium.launch();
  for (const haus of HAEUSER) {
    console.log("\n══ " + haus + " ══");
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus);
      const ziele = await p.evaluate(() => [...new Set([...document.querySelectorAll('#inhalt a.kachel[href^="#/"]')].map(a => a.getAttribute("href")))]);
      pruef(ziele.length >= 4, "Voraussetzung: Kacheln mit Unterseite auf der Startseite", ziele.length);
      const schlecht = [];
      let bewegt = null;
      for (const z of ziele) {
        await p.evaluate(() => { location.hash = "#/"; });
        await p.waitForTimeout(350);
        await p.$$eval('.sb-kopf[aria-expanded="false"]', ks => ks.forEach(k => k.click())).catch(() => {});
        const m = await p.evaluate(TIPP, z);
        if (!m) { schlecht.push(z + ": Kachel nicht gefunden"); continue; }
        if (m.sofort !== z.split("?")[0] && m.sofort !== z) schlecht.push(z + ": Adresse erst später (" + m.sofort + ")");
        if (m.ebenen) schlecht.push(z + ": Übergangsebene entstanden");
        if (m.blass) schlecht.push(z + ": " + m.blass + " Elemente im ersten Bild nicht deckend");
        if (m.verz > 0 || m.dauer > 220 || m.props.some(x => x !== "transform")) schlecht.push(z + ": Bewegung " + JSON.stringify(m.props) + " " + m.dauer + " ms, Verzögerung " + m.verz);
        if (!bewegt && m.anis) bewegt = m;
      }
      pruef(!schlecht.length, "jede Kachel: Adresse im selben Takt, keine Ebene, im ersten Bild deckend, höchstens 220 ms nur transform",
        schlecht.slice(0, 3).join(" | ") || ziele.length + " Kacheln");
      pruef(!!bewegt, "die Seite gleitet (eine kurze transform-Bewegung ist da)", bewegt && JSON.stringify({ anis: bewegt.anis, dauer: bewegt.dauer }));
      pruef(!fehler.length, "keine Skriptfehler", fehler[0] || "still");
      await ctx.close();
    }
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus, { ruhig: true });
      const z = await p.evaluate(() => { const a = document.querySelector('#inhalt a.kachel[href^="#/"]'); return a && a.getAttribute("href"); });
      const m = await p.evaluate(TIPP, z);
      pruef(!!m && m.anis === 0 && !m.blass && !m.ebenen, "reduzierte Bewegung: keine Animation, sofort deckend", m && JSON.stringify({ anis: m.anis, blass: m.blass }));
      await ctx.close();
    }
    {
      const { ctx, p, fehler } = await hubAuf(browser, haus);
      await p.evaluate(() => { location.hash = "#/speisekarte"; });
      await p.waitForTimeout(500);
      await p.click("#zurueck");
      await p.waitForTimeout(300);
      const m = await p.evaluate(() => ({ zahl: window.__reise.zahl, seite: seiteJetzt }));
      pruef(m.zahl === 0 && m.seite === "start", "Zurück führt ohne Ebene heim", JSON.stringify(m));

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
