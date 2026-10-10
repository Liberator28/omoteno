/* ═══════════════════════════════════════════════════════════════════
   pruef-fotofehler.js — die Fehler aus den Bildschirmfotos vom 10.10.

   Jeder Fall stellt die Lage des Fotos nach und misst am gezeichneten
   Bild (Rechtecke), nicht am Quelltext:
   1 · Board, Entwurf-Hinweis: Satz und „Verwerfen“ überlappen nicht,
       der Satz hat Platz (vorher eine Spalte von drei Buchstaben).
   2 · Board, wiederhergestellter Preis: „10,90“, nicht „10.9“.
   3 · Board, Kategorie-Panel auf dem Telefon: so breit wie die ganze
       Zeile, jeder Chip im Panel sichtbar, KEIN eigener Scrollbereich
       (§3.8 — vorher halb breit, „Für die Runde“ abgeschnitten).
   4 · Hub, Ruf-Streifen + Auswahl-Leiste: ganz unten gerollt liegt
       das letzte Gericht samt „+“ — und das unterste Antippbare der
       Seite überhaupt — ÜBER beiden Leisten. Eine Wache: Gemessen
       reichte die Fußzeile schon, ein eigener Platz-Rechner war
       wirkungslos (Gegenbeweis grün) und wurde wieder entfernt. Im
       Foto lagen die Leisten beim Scrollen über einem Gericht in der
       Mitte — das ist feste Leiste, kein verdeckter Inhalt.
   5 · Hub Minhkeey, Unterseite: der Zurück-Knopf liegt unter den
       Laternen, nicht hinter ihren Quasten.
   6 · Hub, Foodroulette: die Marke „Neu für Sie“ wird nicht
       abgeschnitten („Ne“).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = "file://" + path.join(OBEN, "seiten", "admin.html");
const HUB = slug => "file://" + path.join(OBEN, "dist", slug, "index.html");
for (const s of ["chocolamour", "minhkeey"]) if (!fs.existsSync(path.join(OBEN, "dist", s, "index.html"))) { console.error("dist/ fehlt"); process.exit(1); }

let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if (!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };
const schneidet = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

async function board(browser, breite, hoehe) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe } });
  const s = await ctx.newPage(); const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await s.goto(ADMIN); await s.waitForTimeout(700);
  await s.evaluate(() => { document.getElementById("tor").hidden = true; if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); } });
  await s.waitForTimeout(400);
  const scharf = await s.$("#scharfJetzt");
  if (scharf && await s.isVisible("#scharf")) { await scharf.click(); await s.waitForTimeout(200); }
  await s.evaluate(() => document.querySelector('[data-tafel="speisekarte"]').click());
  await s.waitForTimeout(300);
  return { ctx, s, fehler };
}
async function hub(browser, slug, hash, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const s = await ctx.newPage(); const fehler = [];
  s.on("pageerror", e => fehler.push(e.message));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await s.addInitScript(o => {
    try { sessionStorage.setItem("omoteno-willkommen", "1");
      if (o.probiert) localStorage.setItem("omoteno-probiert-" + o.slug, JSON.stringify(["Gibt es nicht"])); } catch (e) {}
    const echt = Date, fest = new echt(2026, 9, 10, 14, 0, 0).getTime();
    Date = class extends echt { constructor(...a) { super(...(a.length ? a : [fest])); } static now() { return fest; } };
  }, Object.assign({ slug }, opt));
  await s.goto(HUB(slug) + hash); await s.waitForTimeout(1000);
  return { ctx, s, fehler };
}

(async () => {
  const browser = await chromium.launch();

  console.log("══ Board: Entwurf, Preis (iPad quer) ══");
  {
    const { ctx, s, fehler } = await board(browser, 1180, 820);
    await s.evaluate(() => blattOeffnen(null)); await s.waitForTimeout(200);
    await s.fill("#fName", "Creamy Rice Oriental"); await s.fill("#fPreis", "10.9");
    await s.waitForTimeout(700);
    await s.click("#abbrechen"); await s.waitForTimeout(400);
    await s.evaluate(() => blattOeffnen(null)); await s.waitForTimeout(300);
    const m = await s.evaluate(() => {
      const h = document.getElementById("entwurfHinweis");
      const sp = document.getElementById("entwurfHinweisText").getBoundingClientRect();
      const k = document.getElementById("entwurfVerwerfen").getBoundingClientRect();
      return { sichtbar: !h.hidden, sp: { left: sp.left, right: sp.right, top: sp.top, bottom: sp.bottom, width: sp.width },
               k: { left: k.left, right: k.right, top: k.top, bottom: k.bottom, height: k.height }, preis: document.getElementById("fPreis").value };
    });
    pruef(m.sichtbar, "Voraussetzung: der Entwurf-Hinweis steht da");
    pruef(m.sp.width >= 180 && !schneidet(m.sp, m.k), "Entwurf-Hinweis: Satz breit genug, „Verwerfen“ liegt nicht darüber",
      Math.round(m.sp.width) + " px Satz");
    pruef(m.k.height >= 44, "„Verwerfen“ ≥ 44 px hoch", Math.round(m.k.height));
    pruef(m.preis === "10,90", "wiederhergestellter Preis mit Komma und zwei Stellen", m.preis);
    pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ Board: Kategorie-Panel (Telefon) ══");
  {
    const { ctx, s, fehler } = await board(browser, 390, 844);
    await s.evaluate(() => blattOeffnen(null)); await s.waitForTimeout(300);
    /* Die Vorführkarte hat nur eine Kategorie — mit einer kann das Panel
       nie zu eng sein (§8.1g). Chocos echte Kategorien eintragen. */
    await s.evaluate(() => { document.getElementById("katListe").innerHTML =
      ["Creamy Rice","Crêpe","Fettuccine","Für die Runde","Getränke","Heißgetränke","Manakish","Mini-Pancakes",
       "Milchshakes","Smoothies","Waffel","Eis","Extras"].map(k => '<option value="' + k + '">').join(""); });
    await s.click("#katKnopf"); await s.waitForTimeout(400);
    const m = await s.evaluate(() => {
      const zeile = document.getElementById("katFeld").closest(".zweispalt").getBoundingClientRect();
      const p = document.getElementById("katPanel"), pr = p.getBoundingClientRect();
      const g = document.getElementById("katChips");
      const chips = [...g.querySelectorAll(".katchip")];
      const draussen = chips.filter(c => { const r = c.getBoundingClientRect(); return r.right > pr.right + 1 || r.bottom > pr.bottom + 1 || r.left < pr.left - 1; }).length;
      return { zeileL: zeile.left, zeileR: zeile.right, pl: pr.left, pr: pr.right, chips: chips.length, draussen,
               ueber: getComputedStyle(g).overflowY, hoch: g.scrollHeight - g.clientHeight };
    });
    pruef(m.chips >= 13, "Voraussetzung: dreizehn Kategorien stehen im Panel", m.chips);
    pruef(Math.abs(m.pl - m.zeileL) <= 2 && Math.abs(m.pr - m.zeileR) <= 2, "Panel so breit wie die ganze Zeile",
      Math.round(m.pl) + "…" + Math.round(m.pr) + " / Zeile " + Math.round(m.zeileL) + "…" + Math.round(m.zeileR));
    pruef(m.draussen === 0 && !/auto|scroll/.test(m.ueber) && m.hoch <= 1, "jeder Chip sichtbar, kein eigener Scrollbereich",
      m.draussen + " draußen, overflow " + m.ueber);
    pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ Hub: Ruf-Streifen + Auswahl-Leiste ══");
  {
    const { ctx, s, fehler } = await hub(browser, "chocolamour", "#/speisekarte");
    const plus = await s.$$(".gericht .gplus");
    pruef(plus.length > 0, "Voraussetzung: Gerichte mit „+“", plus.length);
    await s.evaluate(() => document.querySelector(".gericht .gplus").click());
    await s.evaluate(() => { const v = document.getElementById("vstreifen");
      v.innerHTML = '<span class="vpunkt"></span><span class="vtext"><b>Bitte einmal an den Tisch</b><small>Ihr Ruf ist angekommen · 5 weitere</small></span>';
      v.hidden = false; });
    await s.waitForTimeout(400);
    await s.evaluate(() => { const se = document.scrollingElement; se.scrollTop = se.scrollHeight; });
    await s.waitForTimeout(400);
    const m = await s.evaluate(() => {
      const leisten = ["auswahlbalken", "vstreifen"].map(id => document.getElementById(id).getBoundingClientRect())
        .filter(r => r.height > 0 && r.top < innerHeight);
      const oben = Math.min(...leisten.map(r => r.top));
      const g = [...document.querySelectorAll(".gericht")].pop();
      const k = g.querySelector(".gplus") || g;
      const gr = g.getBoundingClientRect(), kr = k.getBoundingClientRect();
      /* Das unterste Antippbare der ganzen Seite (auch die Links der
         Fußzeile) — sonst schöbe die Fußzeile das letzte Gericht immer
         über die Leisten, und die Probe könnte nichts finden (§8.1g). */
      const alle = [...document.querySelectorAll("main a, main button, footer a, footer button")]
        .filter(x => !x.closest("#auswahlbalken, #vstreifen, #wsstreifen") && x.getBoundingClientRect().height > 0);
      const tiefst = Math.max(...alle.map(x => x.getBoundingClientRect().bottom));
      return { leisten: leisten.length, oben: Math.round(oben), gerichtUnten: Math.round(gr.bottom), knopfUnten: Math.round(kr.bottom),
               tiefst: Math.round(tiefst) };
    });
    pruef(m.leisten === 2, "Voraussetzung: beide Leisten stehen unten", m.leisten);
    pruef(m.knopfUnten <= m.oben - 4 && m.gerichtUnten <= m.oben, "ganz unten: letztes Gericht samt Knopf über den Leisten",
      "Knopf " + m.knopfUnten + " / Gericht " + m.gerichtUnten + " / Leisten ab " + m.oben);
    pruef(m.tiefst <= m.oben - 4, "ganz unten: auch das unterste Antippbare der Seite liegt über den Leisten",
      "unterstes " + m.tiefst + " / Leisten ab " + m.oben);
    pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ Hub Minhkeey: Laternen und Zurück ══");
  {
    const { ctx, s, fehler } = await hub(browser, "minhkeey", "#/speisekarte");
    const m = await s.evaluate(() => {
      const lat = document.querySelector(".laternen");
      if (!lat || !lat.getBoundingClientRect().height) return null;
      const lr = lat.getBoundingClientRect(), z = document.getElementById("zurueck").getBoundingClientRect();
      /* Seit 10.10. steht über dem Titel die Pille „Für mich entscheiden“ —
         gemessen wird bis zum ERSTEN Inhalt der Seite, nicht bis zum h2. */
      const erstes = document.querySelector("#inhalt .seite > :first-child");
      return { latUnten: Math.round(lr.bottom), zOben: Math.round(z.top), zUnten: Math.round(z.bottom),
               luecke: erstes ? Math.round(erstes.getBoundingClientRect().top - z.bottom) : null };
    });
    pruef(!!m, "Voraussetzung: Minhkeey trägt Laternen");
    pruef(!!m && m.zOben >= m.latUnten - 4, "Zurück liegt unter den Laternen (keine Quaste darüber)", m && JSON.stringify(m));
    pruef(!!m && m.luecke !== null && m.luecke <= 60, "kein leerer Streifen zwischen Zurück und dem Inhalt darunter", m && m.luecke + " px");
    pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ Hub: Foodroulette-Marke ══");
  {
    const { ctx, s, fehler } = await hub(browser, "chocolamour", "#/entdecken", { probiert: true });
    await s.evaluate(() => { if (typeof frModusSetzen === "function") frModusSetzen("rad"); frDrehen(); });
    await s.waitForTimeout(800);
    const m = await s.evaluate(() => {
      const e = document.querySelector(".fr-etikett"), er = e && e.getBoundingClientRect();
      const mk = e ? [...e.querySelectorAll(".eh-marke")] : [];
      return { marken: mk.length, text: mk.map(x => x.textContent).join(","),
               ab: mk.filter(x => { const r = x.getBoundingClientRect(); return r.right > er.right + 1 || x.scrollWidth > x.clientWidth + 1; }).length };
    });
    pruef(m.marken >= 1, "Voraussetzung: eine Marke steht im Ergebnis", m.text);
    pruef(m.ab === 0, "keine Marke abgeschnitten", m.ab + " abgeschnitten");
    pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  console.log(f ? f + " FEHLER" : "Alles sauber.");
  process.exit(f ? 1 : 0);
})();
