// Erzeugt das Kunden-Handout: node dokumente/handout/bauen.js
// HTML -> PDF (A4, Hintergründe an) über das vorinstallierte Chromium von Playwright.
// Ausgabe: dokumente/handout/Omoteno-Handout-2026.pdf, dazu (mit --png) eine Vorschau je Seite.
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const ORDNER = __dirname;
const QUELLE = path.join(ORDNER, "handout.html");
const ZIEL = path.join(ORDNER, "Omoteno-Handout-2026.pdf");
const MIT_PNG = process.argv.includes("--png");
const PNG_ORDNER = process.env.HANDOUT_PNG || path.join(ORDNER, "vorschau");

(async () => {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", e => fehler.push("pageerror: " + e.message));
  seite.on("requestfailed", r => fehler.push("Anfrage fehlgeschlagen: " + r.url()));
  await seite.goto("file://" + QUELLE, { waitUntil: "load" });
  await seite.evaluate(() => document.fonts.ready);

  // Schriften wirklich geladen? (sonst druckt Chromium still mit Ersatzschrift)
  const schriften = await seite.evaluate(() =>
    ["Instrument Sans", "Instrument Serif", "JetBrains Mono"].map(f => [f, document.fonts.check(`12px "${f}"`)]));
  for (const [f, ok] of schriften) if (!ok) fehler.push("Schrift nicht geladen: " + f);

  // Überlauf: kein Inhalt darf über den Rand seiner Seite hinausragen
  const ueber = await seite.evaluate(() => {
    const aus = [];
    document.querySelectorAll(".seite").forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const fuss = s.querySelector(".fuss");
      if (!fuss) return; // Umschlag: randloses Layout, kein Fuß
      const fussOben = fuss.getBoundingClientRect().top;
      s.querySelectorAll("*").forEach(e => {
        if (e.closest(".fuss") || getComputedStyle(e).position === "absolute") return;
        const b = e.getBoundingClientRect();
        if (!b.width || !b.height) return;
        if (b.right > r.right + 1 || b.bottom > fussOben - 2 && b.top < fussOben)
          aus.push(`Seite ${i + 1}: ${e.tagName}.${e.className} bottom=${Math.round(b.bottom - r.top)} (Fuß ab ${Math.round(fussOben - r.top)})`);
      });
      if (s.scrollHeight > s.clientHeight + 1) aus.push(`Seite ${i + 1}: scrollHeight ${s.scrollHeight} > ${s.clientHeight}`);
    });
    return aus;
  });
  fehler.push(...ueber.slice(0, 30));

  await seite.pdf({ path: ZIEL, format: "A4", printBackground: true, preferCSSPageSize: true });
  const n = await seite.evaluate(() => document.querySelectorAll(".seite").length);
  console.log(`PDF: ${ZIEL}  (${n} Seiten im HTML, ${(fs.statSync(ZIEL).size / 1024).toFixed(0)} KB)`);

  if (MIT_PNG) {
    fs.mkdirSync(PNG_ORDNER, { recursive: true });
    const v = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.6 });
    await v.goto("file://" + QUELLE, { waitUntil: "load" });
    await v.evaluate(() => document.fonts.ready);
    const els = await v.$$(".seite");
    for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(PNG_ORDNER, `seite-${i + 1}.png`) });
    console.log("Vorschau:", PNG_ORDNER);
  }
  await browser.close();
  if (fehler.length) { console.log("BEFUND:\n - " + fehler.join("\n - ")); process.exitCode = 1; }
  else console.log("Keine Überläufe, alle Schriften geladen.");
})();
