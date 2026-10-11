/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Keine Fläche liegt unter etwas anderem

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-ueberdeckt.js

   Anlass (Foto 10.10., Choco auf dem iPhone): Die offene Sprachliste
   lag mit ihrer ersten Zeile UNTER dem Schokoguss — „Deutsch ✓“ war
   nicht zu lesen. Ursache: `.kopfwahl` trägt backdrop-filter und ist
   damit ein eigener Stapelkontext; die Liste darin (z-index 30) kam
   nie über die späteren Geschwister `.guss`/`.laternen` hinaus.

   Gemessen wird das GEMALTE, nicht das Antippbare: Der Guss hat
   pointer-events:none, und elementFromPoint übersieht ihn deshalb —
   eine Probe damit wäre grün geblieben (§8.1g). Für die Messung
   bekommt jedes Element pointer-events:auto; dann folgt die Trefferprüfung
   der Malreihenfolge. Von oben nach unten zählt das erste Element,
   das wirklich etwas malt (Grund mit Deckkraft, Bild, SVG-Fläche) und
   nicht selbst zum Text gehört. Gehört es nicht zur Fläche, ist die
   Zeile verdeckt.

   Für jede Fläche wird zuerst geprüft, dass sie wirklich offen ist
   (§8.1g C) — „nichts gefunden“ heißt sonst „nichts geöffnet“.

   Flächen: Sprachliste (Startseite und Unterseite), Detailblatt eines
   Gerichts, Foodroulette-Ergebnis, Öffnungsanzeige und Slogan im Kopf.
   Alle Häuser, 360/390/430/1280 px, Tag und Abend, dazu Arabisch.

   Gegenbeweis: gegen den Stand VOR der Behebung (z-index an .kopfwahl
   fehlt) rot in allen drei Häusern — 54 Fälle, „Deutsch“ unter
   svg.guss (Choco, Blend) bzw. svg.laternen (Minhkeey). Zwei
   Messfehler der ersten Fassung dabei behoben: weggerollte Zeilen der
   Liste (overflow) und eine Zeile genau auf ihrer Unterkante zählten
   als verdeckt.
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

async function oeffnen(browser, haus, breite, uhr, sprache, ziel) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 800 }, reducedMotion: "reduce" });
  await ctx.addInitScript(sp => { try { sessionStorage.setItem("omoteno-willkommen", "1"); if (sp) localStorage.setItem("tapto-sprache", sp); } catch (e) {} }, sprache || null);
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.clock.setFixedTime(new Date(uhr));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await s.goto("file://" + path.join(DIST, haus, "index.html") + (ziel || "#/"));
  await s.waitForTimeout(700);
  await s.evaluate(() => { ZEITEN.length = 0; for (let i = 0; i < 7; i++) ZEITEN.push("10:30 – 00:30"); stunde = new Date().getHours(); zeichne(); });
  await s.waitForTimeout(250);
  return { ctx, s, fehler };
}

/* Misst alle Textzeilen unter `wurzel` (Selektor), die im Bild liegen.
   Gibt die verdeckten zurück: Text, Punkt, verdeckendes Element. */
const verdeckt = (s, wurzel) => s.evaluate(sel => {
  const root = document.querySelector(sel);
  if (!root) return { offen: false, zeilen: 0, funde: [] };
  const st = document.createElement("style");
  st.textContent = "*,*::before,*::after{pointer-events:auto !important}";
  document.head.appendChild(st);
  const deckkraft = el => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
  const malt = el => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || deckkraft(el) < .3) return false;
    if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) {
      if (/^(path|rect|circle|ellipse|polygon|polyline|line|text|use|image)$/.test(el.tagName)) {
        const fill = cs.fill, fa = +cs.fillOpacity;
        return (fill && fill !== "none" && !/rgba\([^)]*,\s*0\)/.test(fill) && fa > .3);
      }
      return false;
    }
    if (/^(IMG|CANVAS|VIDEO)$/.test(el.tagName)) return true;
    if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
    const m = cs.backgroundColor.match(/[\d.]+/g);
    if (m && (m.length < 4 || +m[3] > .3) && cs.backgroundColor !== "transparent") return true;
    return false;
  };
  const funde = []; let zeilen = 0;
  const gang = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t = gang.nextNode(); t; t = gang.nextNode()) {
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || deckkraft(el) < .5 || getComputedStyle(el).visibility === "hidden") continue;
    const r = document.createRange(); r.selectNodeContents(t);
    for (const z of r.getClientRects()) {
      if (z.width < 4 || z.height < 4) continue;
      const x = z.left + z.width / 2, y = z.top + z.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      /* Was ein Rollbereich (overflow) wegschneidet, ist nicht verdeckt,
         sondern weggerollt — erster Lauf zählte die Zeilen unter dem
         Rand der Sprachliste als „unter der Kachel“. */
      let weg = false;
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const o = getComputedStyle(a);
        if (o.overflowX === "visible" && o.overflowY === "visible") continue;
        const ar = a.getBoundingClientRect();
        if (x <= ar.left + 1 || x >= ar.right - 1 || y <= ar.top + 1 || y >= ar.bottom - 1) { weg = true; break; }
      }
      if (weg) continue;
      zeilen++;
      for (const h of document.elementsFromPoint(x, y)) {
        if (h === el || el.contains(h) || h.contains(el)) break;   /* Text selbst oder sein Grund: frei */
        if (!malt(h)) continue;
        if (root.contains(h)) break;                                 /* eigene Fläche darüber (z. B. Zeile) */
        funde.push(t.textContent.trim().slice(0, 24) + " @" + Math.round(x) + "," + Math.round(y) +
                   " unter <" + h.tagName.toLowerCase() + (h.className && h.className.baseVal === undefined && h.className ? "." + String(h.className).split(" ")[0] : "") +
                   (h.closest("svg") ? " in svg." + (h.closest("svg").getAttribute("class") || "") : "") + ">");
        break;
      }
    }
  }
  st.remove();
  return { offen: true, zeilen, funde };
}, wurzel);

(async () => {
  const browser = await chromium.launch();
  pruef(HAEUSER.length >= 2, "mindestens zwei Häuser erzeugt (§8.1a)", HAEUSER.join(", "));
  const fall = [];
  for (const haus of HAEUSER)
    for (const breite of [360, 390, 430, 1280])
      for (const [phase, uhr] of [["Tag", "2026-10-10T14:00:00"], ["Abend", "2026-10-10T21:30:00"]])
        fall.push({ haus, breite, phase, uhr });
  for (const haus of HAEUSER) fall.push({ haus, breite: 390, phase: "Tag", uhr: "2026-10-10T14:00:00", sprache: "ar" });

  for (const c of fall) {
    const tag = c.haus + " " + c.breite + "px " + c.phase + (c.sprache ? " " + c.sprache : "");

    /* 1 · Kopf der Startseite: Öffnungsanzeige, Slogan, Knopfzeile */
    let { ctx, s, fehler } = await oeffnen(browser, c.haus, c.breite, c.uhr, c.sprache);
    let m = await verdeckt(s, "header");
    pruef(m.offen && m.zeilen >= 2 && !m.funde.length, tag + ": Kopf — kein Text verdeckt (" + m.zeilen + " Zeilen)", m.funde.slice(0, 3).join(" | "));

    /* 2 · Sprachliste auf der Startseite — über den echten Knopf */
    await s.click("#sprachknopf");
    await s.waitForTimeout(250);
    const offen = await s.evaluate(() => { const l = document.getElementById("sprachliste"); return !!l && !l.hidden && l.getBoundingClientRect().height > 40; });
    pruef(offen, tag + ": Sprachliste ist offen (Voraussetzung)");
    if (offen) {
      m = await verdeckt(s, "#sprachliste");
      pruef(m.zeilen >= 6 && !m.funde.length, tag + ": Sprachliste — jede Zeile lesbar (" + m.zeilen + ")", m.funde.slice(0, 3).join(" | "));
    }
    await s.keyboard.press("Escape").catch(() => {});

    /* 2b · Lichtliste (seit 11.10. fünf Stufen) — dieselbe Leiste, die
       andere Ecke; über den echten Knopf. */
    await s.click("#lichtknopf");
    await s.waitForTimeout(250);
    const lOffen = await s.evaluate(() => { const l = document.getElementById("lichtliste"); return !!l && l.getBoundingClientRect().height > 40 &&
      document.getElementById("lichtwahl").classList.contains("offen"); });
    pruef(lOffen, tag + ": Lichtliste ist offen (Voraussetzung)");
    if (lOffen) {
      m = await verdeckt(s, "#lichtliste");
      pruef(m.zeilen >= 5 && !m.funde.length, tag + ": Lichtliste — jede Zeile lesbar (" + m.zeilen + ")", m.funde.slice(0, 3).join(" | "));
    }
    await s.keyboard.press("Escape").catch(() => {});
    pruef(!fehler.length, tag + ": keine Seitenfehler (Start)", fehler[0]);
    await ctx.close();

    if (c.breite === 1280 && c.phase === "Abend") continue;   /* Unterseiten: Telefonbreiten genügen, Abend nur schmal */

    /* 3 · Sprachliste auf einer Unterseite (flacher Kopf) */
    ({ ctx, s, fehler } = await oeffnen(browser, c.haus, c.breite, c.uhr, c.sprache, "#/speisekarte"));
    await s.click("#sprachknopf");
    await s.waitForTimeout(250);
    m = await verdeckt(s, "#sprachliste");
    pruef(m.offen && m.zeilen >= 6 && !m.funde.length, tag + ": Sprachliste auf der Speisekarte lesbar (" + m.zeilen + ")", m.funde.slice(0, 3).join(" | "));
    await s.keyboard.press("Escape").catch(() => {});

    /* 4 · Detailblatt eines Gerichts — über den echten Info-Knopf */
    const info = await s.$(".ginfo");
    pruef(!!info, tag + ": Info-Knopf eines Gerichts gefunden (Voraussetzung)");
    if (info) {
      await info.scrollIntoViewIfNeeded();
      await info.click();
      await s.waitForTimeout(400);
      const auf = await s.evaluate(() => document.getElementById("warenkarte").classList.contains("an"));
      pruef(auf, tag + ": Detailblatt ist offen (Voraussetzung)");
      m = await verdeckt(s, "#warenkarte");
      pruef(auf && m.zeilen >= 2 && !m.funde.length, tag + ": Detailblatt — kein Text verdeckt (" + m.zeilen + ")", m.funde.slice(0, 3).join(" | "));
    }
    await ctx.close();

    /* 5 · Foodroulette: Ergebnis nach der Landung (reduzierte Bewegung = sofort) */
    ({ ctx, s, fehler } = await oeffnen(browser, c.haus, c.breite, c.uhr, c.sprache, "#/entdecken"));
    const los = await s.$("[data-fr-los], .fr-mitte");
    if (los) { await los.click(); await s.waitForTimeout(500); }
    m = await verdeckt(s, ".fr-ergebnis");
    pruef(m.offen && m.zeilen >= 2 && !m.funde.length, tag + ": Foodroulette-Ergebnis — kein Text verdeckt (" + m.zeilen + ")", m.funde.slice(0, 3).join(" | "));
    pruef(!fehler.length, tag + ": keine Seitenfehler (Unterseiten)", fehler[0]);
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + "/" + n + " Proben bestanden" + (f ? " — " + f + " FEHLER" : ""));
  process.exit(f ? 1 : 0);
})();
