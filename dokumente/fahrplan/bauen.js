// Erzeugt den Fahrplan: node dokumente/fahrplan/bauen.js
// HTML -> PDF (A4, Hintergründe an, Seitenzahlen im Fuß) über das vorinstallierte Chromium von Playwright.
// Prüft vorher: Schriften wirklich geladen, nichts ragt seitlich über den Satzspiegel, keine fehlgeschlagene Anfrage.
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const ORDNER = __dirname;
const QUELLE = path.join(ORDNER, "fahrplan.html");
const ZIEL = path.join(ORDNER, "Omoteno-Fahrplan-erster-Kunde.pdf");

(async () => {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", e => fehler.push("pageerror: " + e.message));
  seite.on("requestfailed", r => fehler.push("Anfrage fehlgeschlagen: " + r.url()));
  await seite.goto("file://" + QUELLE, { waitUntil: "load" });
  await seite.evaluate(() => document.fonts.ready);
  const schriften = await seite.evaluate(() =>
    ["Instrument Sans", "Instrument Serif", "JetBrains Mono"].map(f => [f, document.fonts.check(`12px "${f}"`)]));
  for (const [f, ok] of schriften) if (!ok) fehler.push("Schrift nicht geladen: " + f);
  await seite.emulateMedia({ media: "print" });
  await seite.setViewportSize({ width: 673, height: 1000 });
  // Satzspiegel A4 minus 2 × 16 mm = 178 mm ≈ 673 px bei 96 dpi
  const breit = await seite.evaluate(() => {
    const max = 178 / 25.4 * 96 + 1, aus = [];
    document.querySelectorAll("section:not(.titel) *").forEach(e => {
      const b = e.getBoundingClientRect(); if (b.width > max) aus.push(e.tagName + "." + e.className + " " + Math.round(b.width) + "px");
    });
    return aus.slice(0, 10);
  });
  const ueber = await seite.evaluate(() => [...document.querySelectorAll("section:not(.titel) *")]
    .filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible").map(e => e.tagName).slice(0, 5));
  fehler.push(...ueber.map(x => "Überlauf: " + x));
  await seite.pdf({
    path: ZIEL, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: '<div style="width:100%;font:7pt monospace;color:#625E4D;padding:0 16mm;display:flex;justify-content:space-between"><span>Omoteno · Fahrplan zum ersten Kunden · Stand 31.10.2026 · keine Rechts- oder Steuerberatung</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
  });
  console.log(`PDF: ${ZIEL} (${(fs.statSync(ZIEL).size / 1024).toFixed(0)} KB)`);
  await browser.close();
  fehler.push(...breit.map(x => "breiter als der Satzspiegel: " + x));
  if (fehler.length) { console.log("BEFUND:\n - " + fehler.join("\n - ")); process.exitCode = 1; }
  else console.log("Schriften geladen, keine fehlgeschlagene Anfrage, kein Überlauf.");
})();
