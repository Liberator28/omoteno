/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Kopfzeile mittig, Sprachknopf nur als Symbol

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-kopf.js

   Wunsch (30.09.): „alles eher mittig", Platz sparen — der Sprachknopf
   zeigt nicht mehr „Deutsch ▾", sondern nur den Globus. Welche Sprache
   gilt, sieht man in der offenen Liste (Haken), und ein Vorlese-
   programm hört es über das aria-label.

   Gemessen, nicht angesehen, in allen Häusern und bei 320–1280 px:
   - Die Knopfzeile (.kopfwahl) steht in der Mitte des Kopfes (± 1 px),
     auch in Arabisch (RTL) — dort dreht sich nur die Reihenfolge.
   - Sprachknopf ist ein Kreis: ≤ 48 px breit, ≥ 44 px Tapfläche, und
     trägt keinen sichtbaren Text mehr.
   - Lichtknopf bleibt auch bei 320 px sichtbar und ≥ 44 px.
   - Nichts in der Zeile läuft seitlich aus dem Bild; die offene Liste
     liegt ganz im sichtbaren Bereich.
   - aria-label nennt die aktive Sprache und folgt dem Wechsel
     (übersetzt: „Language: English").
   - Die offene Liste markiert genau die aktive Sprache — aria-checked
     UND sichtbar (Haken im ::before, Farbe verschieden vom Nachbarn).

   Gegenbeweis gefahren (git worktree, §8.1k): justify-self:center an
   .kopfwahl zurück auf end → „Mitte" rot in jedem Haus; der Haken
   (::before) entfernt → „sichtbar markiert" rot; die aria-label-Zeile
   in zeichne() entfernt → „folgt dem Wechsel" rot.
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

async function oeffnen(browser, haus, breite, sprache) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 800 } });
  await ctx.addInitScript(sp => {
    try {
      sessionStorage.setItem("omoteno-willkommen", "1");
      if (sp) localStorage.setItem("tapto-sprache", sp);
    } catch (e) {}
  }, sprache || null);
  const seite = await ctx.newPage();
  const fehler = [];
  seite.on("pageerror", e => fehler.push(String(e)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + path.join(DIST, haus, "index.html"));
  await seite.waitForTimeout(500);
  if (await seite.$("#willkommen")) { await seite.click("#willkommen").catch(() => {}); await seite.waitForTimeout(600); }
  return { seite, ctx, fehler };
}

(async () => {
  const browser = await chromium.launch();
  pruef(HAEUSER.length >= 2, "mindestens zwei Häuser erzeugt (§8.1a)", HAEUSER.join(", "));

  for (const haus of HAEUSER) {
    for (const breite of [320, 360, 390, 430, 1280]) {
      const { seite, ctx, fehler } = await oeffnen(browser, haus, breite);
      const m = await seite.evaluate(() => {
        const r = el => el.getBoundingClientRect();
        const kopf = document.querySelector("header"), wahl = document.querySelector(".kopfwahl");
        const sk = document.getElementById("sprachknopf"), lk = document.getElementById("lichtknopf");
        const zeile = Array.from(wahl.children).filter(el => getComputedStyle(el).display !== "none" && !el.hidden);
        const links = Math.min(...zeile.map(el => r(el).left)), rechts = Math.max(...zeile.map(el => r(el).right));
        return {
          kopfMitte: r(kopf).left + r(kopf).width / 2,
          zeileMitte: (links + rechts) / 2, links, rechts,
          sk: { w: r(sk).width, h: r(sk).height, text: sk.innerText.trim() },
          lk: { w: r(lk).width, h: r(lk).height, sichtbar: getComputedStyle(lk).display !== "none" },
          label: sk.getAttribute("aria-label") || "",
          ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      const k = haus + " @" + breite;
      pruef(Math.abs(m.zeileMitte - m.kopfMitte) <= 1, k + ": Knopfzeile mittig (± 1 px)",
        "Zeile " + m.zeileMitte.toFixed(1) + " / Kopf " + m.kopfMitte.toFixed(1));
      pruef(m.sk.w <= 48 && m.sk.w >= 44 && m.sk.h >= 44, k + ": Sprachknopf ist ein Kreis 44–48 px",
        m.sk.w.toFixed(1) + "×" + m.sk.h.toFixed(1));
      pruef(m.sk.text === "", k + ": Sprachknopf zeigt keinen Sprachnamen", JSON.stringify(m.sk.text));
      pruef(m.lk.sichtbar && m.lk.w >= 44 && m.lk.h >= 44, k + ": Lichtknopf sichtbar, ≥ 44 px",
        m.lk.w.toFixed(1) + "×" + m.lk.h.toFixed(1));
      pruef(m.links >= 0 && m.rechts <= breite && m.ueber <= 0, k + ": nichts läuft seitlich über",
        "links " + m.links.toFixed(1) + " rechts " + m.rechts.toFixed(1) + " Überlauf " + m.ueber);
      pruef(/Deutsch/.test(m.label), k + ": aria-label nennt die Sprache", m.label);

      if (breite === 360) {
        await seite.click("#sprachknopf");
        await seite.waitForTimeout(450);
        const liste = await seite.evaluate(() => {
          const l = document.getElementById("sprachliste"), r = l.getBoundingClientRect();
          const an = l.querySelector('[aria-checked="true"]'), aus = l.querySelector('[aria-checked="false"]');
          const vor = an ? getComputedStyle(an.querySelector(".kurz"), "::before").content : "";
          return {
            offen: document.getElementById("sprachwahl").classList.contains("offen"),
            links: r.left, rechts: r.right, breite: innerWidth,
            aktiv: l.querySelectorAll('[aria-checked="true"]').length,
            aktivCode: an ? an.dataset.sprache : null,
            haken: vor, farbeAn: an ? getComputedStyle(an).color : "", farbeAus: aus ? getComputedStyle(aus).color : "",
          };
        });
        pruef(liste.offen, k + ": Tipp auf den Globus öffnet die Liste");
        pruef(liste.links >= 0 && liste.rechts <= liste.breite, k + ": offene Liste ganz im Bild",
          liste.links.toFixed(1) + "…" + liste.rechts.toFixed(1));
        pruef(liste.aktiv === 1 && liste.aktivCode === "de", k + ": genau Deutsch ist markiert", liste.aktivCode);
        pruef(/✓/.test(liste.haken) && liste.farbeAn !== liste.farbeAus, k + ": aktive Sprache sichtbar markiert",
          liste.haken + " " + liste.farbeAn + " / " + liste.farbeAus);

        await seite.click('#sprachliste [data-sprache="en"]');
        await seite.waitForTimeout(400);
        const nach = await seite.evaluate(() => ({
          label: document.getElementById("sprachknopf").getAttribute("aria-label"),
          offen: document.getElementById("sprachwahl").classList.contains("offen"),
        }));
        pruef(nach.label === "Language: English", k + ": aria-label folgt dem Wechsel (übersetzt)", nach.label);
        pruef(!nach.offen, k + ": Liste schließt nach der Wahl");
      }
      pruef(fehler.length === 0, k + ": keine Ausnahme", fehler.join(" | ") || "still");
      await ctx.close();
    }

    /* RTL: dieselbe Mitte, Liste im Bild */
    const { seite, ctx, fehler } = await oeffnen(browser, haus, 390, "ar");
    const rtl = await seite.evaluate(() => {
      const r = el => el.getBoundingClientRect();
      const kopf = document.querySelector("header"), wahl = document.querySelector(".kopfwahl");
      const zeile = Array.from(wahl.children).filter(el => getComputedStyle(el).display !== "none" && !el.hidden);
      const links = Math.min(...zeile.map(el => r(el).left)), rechts = Math.max(...zeile.map(el => r(el).right));
      return { dir: document.documentElement.dir, kopfMitte: r(kopf).left + r(kopf).width / 2, zeileMitte: (links + rechts) / 2,
               label: document.getElementById("sprachknopf").getAttribute("aria-label") };
    });
    pruef(rtl.dir === "rtl" && Math.abs(rtl.zeileMitte - rtl.kopfMitte) <= 1, haus + " RTL: Knopfzeile mittig",
      rtl.dir + " " + rtl.zeileMitte.toFixed(1) + " / " + rtl.kopfMitte.toFixed(1));
    pruef(/العربية/.test(rtl.label), haus + " RTL: aria-label nennt Arabisch", rtl.label);
    await seite.click("#sprachknopf");
    await seite.waitForTimeout(450);
    const rl = await seite.evaluate(() => { const r = document.getElementById("sprachliste").getBoundingClientRect(); return [r.left, r.right, innerWidth]; });
    pruef(rl[0] >= 0 && rl[1] <= rl[2], haus + " RTL: offene Liste ganz im Bild", rl.map(x => x.toFixed(1)).join(" "));
    pruef(fehler.length === 0, haus + " RTL: keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if (f) { console.log(f + " FEHL"); process.exit(1); }
  console.log("Alles sauber.");
})();
