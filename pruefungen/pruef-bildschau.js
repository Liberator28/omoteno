/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Bildvorschau im Admin-Board — Tiefeneffekt-Politur

     node pruefungen/pruef-bildschau.js

   Auftrag: Die kleine Bildvorschau beim Hochladen eines Gerichte-Fotos
   (.bildschau) soll "perfekt passen" — mittig (schon vorhanden über
   background-position:center) und mit einem Tiefeneffekt an den
   Rändern wie bei einer 3D-Ansicht. Kein neuer Bildverarbeitungsdienst
   (Nutzer-Entscheidung): reine CSS-Vignette (radial-gradient in einem
   ::after) plus ein zweistufiger box-shadow, keine echte Freistellung.
   Dieselbe Politur, wo möglich, auch auf der Zuschnitt-Vorschau
   (#bildCropContainer) — dort NUR am äußeren Rahmen, nicht am Canvas/
   Overlay selbst, sonst bricht das Zuschnitt-Rechteck (CLAUDE.md,
   Plan-Text Block A).

   Gegenbeweis gefahren: die Regel .bildschau::after testweise
   herausgeschnitten (per Skript, nicht von Hand) → drei Zusicherungen
   (Vorhandensein, radial-gradient, absolute Position) wurden rot.
   Zurückgenommen → alle 11 wieder grün.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const ADMIN = path.join(__dirname, "..", "seiten", "admin.html");
let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const seite = await ctx.newPage();
  const konsole = [];
  seite.on("pageerror", e => konsole.push(String(e).slice(0, 300)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(700);
  await seite.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
  });
  await seite.waitForTimeout(500);
  const scharf = await seite.$("#scharfJetzt");
  if (scharf && await seite.isVisible("#scharf")) { await scharf.click(); await seite.waitForTimeout(200); }

  console.log("\n══ .bildschau (Gerichte-Foto-Vorschau) ══");
  await seite.evaluate(() => document.querySelector('[data-tafel="speisekarte"]').click());
  await seite.waitForTimeout(400);
  const hinzuKnopf = await seite.$("text=Gericht hinzufügen");
  if (hinzuKnopf) { await hinzuKnopf.click(); await seite.waitForTimeout(300); }

  const info = await seite.evaluate(() => {
    const el = document.querySelector("#bildSchau");
    if (!el) return null;
    const cs = getComputedStyle(el);
    const after = getComputedStyle(el, "::after");
    return {
      position: cs.position, boxShadow: cs.boxShadow, borderRadius: cs.borderRadius,
      bgPos: cs.backgroundPosition,
      afterContent: after.content, afterBg: after.backgroundImage, afterPos: after.position,
    };
  });
  pruef(!!info, "#bildSchau gefunden");
  if (info) {
    pruef(info.position === "relative", "bildschau ist position:relative (Grundlage für ::after)", info.position);
    pruef(info.boxShadow !== "none", "bildschau hat box-shadow für Tiefe", info.boxShadow);
    pruef(info.bgPos === "center" || info.bgPos === "50% 50%", "Bild bleibt mittig (background-position:center)", info.bgPos);
    pruef(info.afterContent === '""', "::after vorhanden (Vignette-Ebene)", info.afterContent);
    pruef(/radial-gradient/.test(info.afterBg), "::after zeichnet eine Vignette (radial-gradient)", info.afterBg.slice(0, 60));
    pruef(info.afterPos === "absolute", "::after bleibt innerhalb des Rahmens (absolute)", info.afterPos);
  }

  console.log("\n══ #bildCropContainer (Zuschnitt-Vorschau) ══");
  const cropInfo = await seite.evaluate(() => {
    const el = document.querySelector("#bildCropContainer");
    if (!el) return null;
    const overlay = document.querySelector("#bildCropOverlay");
    const canvas = document.querySelector("#bildCropCanvas");
    return {
      borderRadius: getComputedStyle(el).borderRadius,
      overflow: getComputedStyle(el).overflow,
      boxShadow: getComputedStyle(el).boxShadow,
      overlayPosition: overlay ? getComputedStyle(overlay).position : null,
      canvasDisplay: canvas ? getComputedStyle(canvas).display : null,
    };
  });
  pruef(!!cropInfo, "#bildCropContainer gefunden");
  if (cropInfo) {
    pruef(cropInfo.borderRadius !== "0px", "Crop-Container hat abgerundete Ecken (wie .bildschau)", cropInfo.borderRadius);
    pruef(cropInfo.overflow === "hidden", "Crop-Container schneidet Canvas an den Ecken zu", cropInfo.overflow);
    pruef(cropInfo.boxShadow !== "none", "Crop-Container hat denselben Tiefen-Schatten", cropInfo.boxShadow);
    // Das Zuschnitt-Rechteck selbst darf NICHT verändert sein — sonst
    // stimmt die vom Nutzer gezogene Auswahl nicht mehr mit dem
    // sichtbaren Rahmen überein.
    pruef(cropInfo.overlayPosition === "absolute", "Zuschnitt-Rechteck (Overlay) unverändert absolut positioniert", cropInfo.overlayPosition);
    pruef(cropInfo.canvasDisplay === "block", "Canvas selbst unverändert (block, keine eigene Politur)", cropInfo.canvasDisplay);
  }

  pruef(konsole.length === 0, "keine Ausnahme in der Konsole", konsole.join(" | ") || "still");

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
