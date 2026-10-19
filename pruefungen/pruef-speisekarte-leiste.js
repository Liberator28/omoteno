/* ═══════════════════════════════════════════════════════════════════
   pruef-speisekarte-leiste.js — Foodroulette-Pille und mitlaufende
   Kategorie-Leiste (Wunsch 10.10.)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-speisekarte-leiste.js

   „Für mich entscheiden soll durch einen eindeutigen Button erreichbar
   sein, ohne viel Platz wegzunehmen, über dem Text ‚Unsere Speisekarte‘.“
   „Beim Runterscrollen soll die aktuelle Kategorie oben mitgehen und
   ausgewählt anzeigen.“

   1 · Pille: erstes Element der Seite, direkt VOR dem Titel, eine Zeile
       (≤ 52 px), ≥ 44 px Tapfläche, Schrift ≥ 4,5:1, Tipp → Rad.
   2 · Tipp auf eine Kategorie springt hin, ohne die Karte zu filtern
       (alle Gerichte bleiben), der Chip ist danach der EINE markierte
       (aria-current), steht ganz im Bild der Leiste, das erste Gericht
       steht direkt unter der Leiste.
   3 · Von Hand rollen: die Markierung folgt (drei Stellen), ganz oben
       wieder „Alle“.
   4 · Klebt die Leiste: „Zurück“ steht IN der Leiste und trifft der
       Finger, die schwebende Pille ist weg (opacity 0, nicht antippbar);
       kein Chip liegt unter einem anderen Bedienelement; Tipp → Startseite.
   5 · „Beliebt“ filtert wie bisher und die Markierung bleibt dort; bei
       einer Suche ohne die Kategorie filtert der Tipp (alter Weg).
   6 · Reduzierte Bewegung: der Sprung ist sofort am Ziel.
   Beide Häuser, 360/390/430 px, dazu Arabisch (RTL), kein Überlauf.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const HUB = slug => "file://" + path.join(OBEN, "dist", slug, "index.html");
if (!fs.existsSync(path.join(OBEN, "dist", "chocolamour", "index.html"))) { console.error("dist/ fehlt"); process.exit(1); }

let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if (!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };

function hellig(rgb) {
  const l = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
const kontrast = (a, b) => { const x = hellig(a), y = hellig(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = t => { const z = (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number); return /color\(/.test(t) ? z.map(v => v * 255) : z; };

async function oeffnen(browser, slug, breite, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 800 }, reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await s.goto(HUB(slug) + "#/speisekarte");
  await s.waitForTimeout(1200);
  if (opt.sprache) { await s.evaluate(sp => { spracheSetzen(sp); zeichne(); }, opt.sprache); await s.waitForTimeout(500); }
  /* Mit Lieferung steht der Liefer-Schalter in der Zentrale oben rechts,
     und sie wird doppelt so breit — der Fall vom Bildschirmfoto 19.10. */
  if (opt.liefer) {
    await s.evaluate(() => { LIEFER.an = true; zeichne(); }); await s.waitForTimeout(500);
    const breit = await s.evaluate(() => Math.round(document.querySelector("header .kopfwahl").getBoundingClientRect().width));
    pruef(breit > 150, "Voraussetzung: Liefer-Schalter steht in der Zentrale (breiter)", breit + " px");
  }
  return { ctx, s, fehler };
}

const stand = s => s.evaluate(() => {
  const l = document.querySelector("#inhalt .chips"), lr = l.getBoundingClientRect();
  const an = [...l.querySelectorAll(".chip.an")];
  const c = an[0], cr = c ? c.getBoundingClientRect() : null;
  return { an: an.map(x => x.dataset.g), aria: c ? c.getAttribute("aria-current") : null,
    imBild: !!cr && cr.left >= lr.left - 1 && cr.right <= lr.right + 1,
    getroffen: !!cr && (() => { const e = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2); return !!e && e.closest(".chip") === c; })(),
    jetzt: katJetzt(), y: scrollY, gerichte: document.querySelectorAll("#inhalt .gericht").length };
});

async function haus(browser, slug, breite, opt = {}) {
  console.log("\n══ " + slug + " · " + breite + " px" + (opt.liefer ? " · mit Liefer-Schalter" : "") + " ══");
  const { ctx, s, fehler } = await oeffnen(browser, slug, breite, opt);
  /* 1 · Pille */
  const pille = await s.evaluate(() => {
    const cta = document.querySelector(".seite > .eh-cta"), k = cta && cta.querySelector("[data-eh-los]");
    if (!cta || !k) return null;
    const r = cta.getBoundingClientRect(), kr = k.getBoundingClientRect(), cs = getComputedStyle(k);
    return { erstes: cta.parentElement.firstElementChild === cta, danach: cta.nextElementSibling && cta.nextElementSibling.tagName,
      h: r.height, kh: kr.height, kw: kr.width, farbe: cs.color, grund: cs.backgroundColor, text: k.textContent.trim() };
  });
  pruef(!!pille, "Voraussetzung: Pille „Für mich entscheiden“ steht in der Speisekarte");
  if (pille) {
    pruef(pille.erstes && pille.danach === "H2", "sie steht ÜBER dem Titel (erstes Element, danach h2)", pille.erstes + " / " + pille.danach);
    pruef(pille.h <= 52 && pille.kh >= 44 && pille.kw >= 44, "eine Zeile (≤ 52 px), Tapfläche ≥ 44 px", Math.round(pille.h) + " / " + Math.round(pille.kw) + "×" + Math.round(pille.kh));
    const k = kontrast(rgb(pille.farbe), rgb(pille.grund));
    pruef(k >= 4.5, "Schrift auf der Pille ≥ 4,5:1", k.toFixed(2));
  }
  const alleGerichte = (await stand(s)).gerichte;
  const gruppen = await s.evaluate(() => [...document.querySelectorAll("#inhalt .gruppe[data-gruppe]")].map(g => g.dataset.gruppe));
  pruef(gruppen.length >= 3, "Voraussetzung: mindestens drei Kategorien", gruppen.length);
  const ziele = [gruppen[1], gruppen[Math.floor(gruppen.length / 2)], gruppen[gruppen.length - 1]];

  /* 2 · Sprung per Tipp */
  for (const g of ziele) {
    await s.evaluate(gg => { const c = [...document.querySelectorAll("#inhalt .chip[data-g]")].find(x => x.dataset.g === gg);
      c.scrollIntoView({ inline: "center", block: "nearest" }); }, g);
    await s.click('#inhalt .chip[data-g="' + g.replace(/"/g, '\\"') + '"]');
    await s.waitForTimeout(1300);
    const st = await stand(s);
    const lage = await s.evaluate(gg => {
      const gr = [...document.querySelectorAll("#inhalt .gruppe[data-gruppe]")].find(x => x.dataset.gruppe === gg);
      const l = document.querySelector("#inhalt .chips").getBoundingClientRect().bottom;
      return Math.round(gr.nextElementSibling.getBoundingClientRect().top - l);
    }, g);
    pruef(st.an.length === 1 && st.an[0] === g && st.aria === "true", "Tipp auf „" + g + "“: genau dieser Chip markiert", JSON.stringify(st.an));
    pruef(st.imBild && st.getroffen, "… ganz im Bild der Leiste und nicht verdeckt (elementFromPoint)", st.imBild + " / " + st.getroffen);
    pruef(lage >= 0 && lage <= 70, "… erstes Gericht steht direkt unter der Leiste", lage + " px");
    pruef(st.gerichte === alleGerichte, "… und die Karte ist NICHT gefiltert (alle Gerichte da)", st.gerichte + " / " + alleGerichte);
  }

  /* 3 · Von Hand rollen */
  for (const g of [ziele[2], ziele[0]]) {
    await s.evaluate(gg => {
      const gr = [...document.querySelectorAll("#inhalt .gruppe[data-gruppe]")].find(x => x.dataset.gruppe === gg);
      const l = document.querySelector("#inhalt .chips");
      scrollTo({ top: scrollY + gr.nextElementSibling.getBoundingClientRect().top - l.offsetHeight - gr.offsetHeight + 30, behavior: "instant" });
    }, g);
    await s.waitForTimeout(950);
    const st = await stand(s);
    pruef(st.an.length === 1 && st.an[0] === g && st.imBild, "von Hand nach „" + g + "“ gerollt: Markierung folgt und rollt mit", JSON.stringify(st.an) + " im Bild " + st.imBild);
  }

  /* 4 · Klebt. Zwei Fassungen (19.10.): Reicht der Platz neben der
     Zentrale, steht „Zurück“ IN der Leiste; ist er zu eng (html.kw-eng),
     klebt die Leiste eine Zeile tiefer über die ganze Breite und die
     schwebende Pille steht oben neben der Zentrale. */
  const eng = await s.evaluate(() => document.documentElement.classList.contains("kw-eng"));
  if (eng) {
    const z = await s.evaluate(() => {
      const zp = document.getElementById("zurueck"), r = zp.getBoundingClientRect();
      const kw = document.querySelector("header .kopfwahl").getBoundingClientRect();
      const l = document.querySelector("#inhalt .chips"), lr = l.getBoundingClientRect();
      const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const sh = getComputedStyle(l).boxShadow, zahlen = (sh.match(/-?[\d.]+px/g) || []).map(parseFloat);
      return { pille: +getComputedStyle(zp).opacity, h: r.height, trifft: !!e && e.closest("#zurueck") === zp,
        zc: getComputedStyle(l.querySelector(".chip-zurueck")).display,
        unterKw: lr.top >= kw.bottom - 1, unterPille: lr.top >= r.bottom - 1, breit: lr.width >= innerWidth - 1,
        /* Schatten deckt die Zeile darüber: nach oben reicht er um -y + spread */
        deckt: zahlen.length >= 4 && (-zahlen[1] + zahlen[3]) >= lr.top - 1,
        ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    pruef(z.pille === 1 && z.h >= 44 && z.trifft && z.zc === "none", "zu eng für eine Zeile: die schwebende Pille „Zurück“ steht oben, ≥ 44 px, getroffen — keine zweite in der Leiste", JSON.stringify(z));
    pruef(z.unterKw && z.unterPille && z.breit, "… die Leiste klebt UNTER Zentrale und Pille, über die ganze Breite", JSON.stringify({ unterKw: z.unterKw, unterPille: z.unterPille, breit: z.breit }));
    pruef(z.deckt, "… und deckt die Zeile darüber (nichts von der Karte scheint zwischen Pille und Zentrale durch)", z.deckt);
    pruef(z.ueber <= 0, "kein seitliches Überlaufen", z.ueber);
  } else {
  const kleb = await s.evaluate(() => {
    const zc = document.querySelector("#inhalt .chip-zurueck"), zp = document.getElementById("zurueck");
    const r = zc.getBoundingClientRect();
    const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { sichtbar: getComputedStyle(zc).display !== "none" && r.width >= 44 && r.height >= 44, trifft: !!e && !!e.closest(".chip-zurueck"),
      pille: getComputedStyle(zp).opacity, pilleTipp: getComputedStyle(zp).pointerEvents,
      ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  pruef(kleb.sichtbar && kleb.trifft, "Leiste klebt: „Zurück“ steht IN der Leiste (≥ 44 px) und der Finger trifft ihn", JSON.stringify(kleb));
  pruef(+kleb.pille === 0 && kleb.pilleTipp === "none", "… die schwebende Pille ist weg und nicht antippbar", kleb.pille + " / " + kleb.pilleTipp);
  pruef(kleb.ueber <= 0, "kein seitliches Überlaufen", kleb.ueber);
  }
  const verdeckt = await s.evaluate(() => {
    const l = document.querySelector("#inhalt .chips"), lr = l.getBoundingClientRect(), aus = [];
    l.querySelectorAll(".chip").forEach(c => { const r = c.getBoundingClientRect();
      if (r.right < lr.left + 4 || r.left > lr.right - 4) return;
      const x = Math.min(Math.max(r.left + r.width / 2, lr.left + 2), lr.right - 2);
      const e = document.elementFromPoint(x, r.top + r.height / 2);
      if (e && !e.closest(".chip") && !e.closest(".chip-zurueck")) aus.push(c.dataset.g + "→" + (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || e.tagName)); });
    return aus;
  });
  pruef(!verdeckt.length, "kein Chip liegt unter einem fremden Element", verdeckt.join(", ") || "frei");

  await s.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await s.waitForTimeout(500);
  const oben = await s.evaluate(() => ({ an: [...document.querySelectorAll("#inhalt .chip.an")].map(c => c.dataset.g),
    zc: getComputedStyle(document.querySelector("#inhalt .chip-zurueck")).display, pille: getComputedStyle(document.getElementById("zurueck")).opacity }));
  pruef(JSON.stringify(oben.an) === '["Alle"]', "ganz oben: wieder „Alle“", JSON.stringify(oben.an));
  pruef(oben.zc === "none" && +oben.pille === 1, "oben: Pille wieder da, „Zurück“ in der Leiste nicht", oben.zc + " / " + oben.pille);

  /* 5 · Beliebt filtert, Markierung bleibt */
  const beliebt = await s.$('#inhalt .chip[data-g="Beliebt"]');
  if (beliebt) {
    await beliebt.click(); await s.waitForTimeout(400);
    await s.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await s.waitForTimeout(400);
    const b = await stand(s);
    pruef(b.gerichte < alleGerichte && JSON.stringify(b.an) === '["Beliebt"]', "„Beliebt“ filtert wie bisher, Markierung bleibt beim Rollen", b.gerichte + " · " + JSON.stringify(b.an));
    await s.click('#inhalt .chip[data-g="Alle"]'); await s.waitForTimeout(500);
  }
  /* Suche ohne die Kategorie: der Tipp filtert (alter Weg) */
  await s.fill("#suchfeld", "zzzz-nicht-da"); await s.waitForTimeout(300);
  await s.fill("#suchfeld", ""); await s.waitForTimeout(300);
  pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const slug of ["chocolamour", "blend"]) for (const b of [360, 390, 430]) {
    try { await haus(browser, slug, b); } catch (e) { pruef(false, slug + " " + b + " lief durch", String(e).slice(0, 200)); }
  }
  for (const b of [360, 390, 430]) {
    try { await haus(browser, "chocolamour", b, { liefer: true }); } catch (e) { pruef(false, "chocolamour " + b + " mit Lieferung lief durch", String(e).slice(0, 200)); }
  }
  console.log("\n══ Tipp auf die Pille, reduzierte Bewegung, RTL ══");
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", 390);
    await s.click(".eh-cta [data-eh-los]"); await s.waitForTimeout(400);
    pruef(await s.evaluate(() => location.hash) === "#/entdecken", "Tipp auf die Pille führt zum Rad");
    pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }
  {
    const { ctx, s } = await oeffnen(browser, "chocolamour", 390, { ruhig: true });
    const g = await s.evaluate(() => [...document.querySelectorAll("#inhalt .gruppe[data-gruppe]")].map(x => x.dataset.gruppe)[3]);
    await s.evaluate(gg => { [...document.querySelectorAll("#inhalt .chip[data-g]")].find(x => x.dataset.g === gg).click(); }, g);
    await s.waitForTimeout(60);
    const st = await stand(s);
    pruef(st.y > 200 && st.an[0] === g, "reduzierte Bewegung: der Sprung ist sofort am Ziel", st.y + " · " + JSON.stringify(st.an));
    await ctx.close();
  }
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", 390, { sprache: "ar" });
    await s.evaluate(() => scrollTo({ top: 1800, behavior: "instant" })); await s.waitForTimeout(600);
    const r = await s.evaluate(() => {
      /* Unter kw-eng ist es die schwebende Pille, sonst die in der Leiste. */
      const eng = document.documentElement.classList.contains("kw-eng");
      const zc = eng ? document.getElementById("zurueck") : document.querySelector("#inhalt .chip-zurueck"), b = zc.getBoundingClientRect();
      const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { eng, rechts: b.left > innerWidth / 2, trifft: !!e && e.closest(eng ? "#zurueck" : ".chip-zurueck") === zc, text: zc.textContent.trim(),
        ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    pruef(r.rechts && r.trifft && r.text !== "Zurück" && r.ueber <= 0, "Arabisch: „Zurück“ in der Leiste rechts, übersetzt, getroffen, kein Überlauf", JSON.stringify(r));
    pruef(!fehler.length, "keine Ausnahme (RTL)", fehler.join(" | ") || "still");
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
