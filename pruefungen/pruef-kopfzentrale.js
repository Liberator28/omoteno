/* ═══════════════════════════════════════════════════════════════════
   pruef-kopfzentrale.js — Kopf als Kommandozentrale, Öffnungsanzeige
   oben rechts (LED-Sanduhr / Regenbogen), kein Glanz, wenig Text

     NODE_PATH=$(npm root -g) node pruefungen/pruef-kopfzentrale.js

   Wunsch 10.10.: „Baue aus den Buttons im Header eine Kommandozentrale,
   die verbunden ist … Die Öffnungsanzeige oben rechts wie eine digitale
   Sandbox, die sich mit buntem LED-Sand füllt, bis sie geöffnet haben;
   danach in Rainbow-LED in der Glas-Box ‚Geöffnet bis (Uhrzeit)‘. Der
   Flash hinter ‚Guten Abend‘ soll weg, wenig Text: Logo und Slogan.“

   Uhr fest (§8.1j), alle Häuser, 320/360/390/430/1280 px, Tag und Abend:
   1 · Verbunden: Licht, Bestellart, Sprache stehen in EINER Leiste mit
       eigenem Rand/Glas; die Knöpfe darin sind randlos, ≥ 44 px, kein
       Spalt zwischen ihnen und der Leiste; mittig; Liste im Bild.
   2 · Wenig Text: kein Glanzstreifen (.glanzflug weg), der Gruß ist
       auf der Startseite nicht im Bild (h1 bleibt für Vorleser), der
       Slogan schon; Öffnungsstand NICHT in der Knopfzeile.
   3 · Oben rechts: rechter Rand der Box = Kopf − Rand (± 2), auf Höhe
       des Siegels, kein Überlappen mit dem Siegel; RTL oben links.
   4 · Geschlossen: Sanduhr da, Anteil = (jetzt − letzter Schluss) /
       (Öffnung − letzter Schluss) aus ZEITEN nachgerechnet, so viele
       bunte Punkte wie der Anteil sagt; 30 Min. später mehr Sand.
       Text „Öffnet heute 10:30“ ≥ 4,5:1 auf dem Band.
   5 · Offen: „Geöffnet bis …“, JEDER Buchstabe ≥ 4,5:1 auf dem Band,
       verschiedene Farben (Regenbogen), LED-Leiste läuft (nur transform);
       Arabisch ohne Einzelbuchstaben (Verbindung bliebe sonst kaputt).
   6 · Reduzierte Bewegung: in der Box läuft nichts.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const DIST = path.join(OBEN, "dist");
const HAEUSER = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html")));
let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if (!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };

function hellig(rgb) {
  const l = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
const kontrast = (a, b) => { const x = hellig(a), y = hellig(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = t => { const z = (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number); return /color\(/.test(t) ? z.map(v => v * 255) : z; };

async function oeffnen(browser, haus, breite, uhr, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 700 }, reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  await ctx.addInitScript(sp => { try { sessionStorage.setItem("omoteno-willkommen", "1"); if (sp) localStorage.setItem("tapto-sprache", sp); } catch (e) {} }, opt.sprache || null);
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.clock.setFixedTime(new Date(uhr));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await s.goto("file://" + path.join(DIST, haus, "index.html") + "#/");
  await s.waitForTimeout(900);
  /* Für jedes Haus dieselben Zeiten (§8.1j): täglich 10:30 – 00:30. */
  await s.evaluate(() => { ZEITEN.length = 0; for (let i = 0; i < 7; i++) ZEITEN.push("10:30 – 00:30"); stunde = new Date().getHours(); zeichne(); });
  await s.waitForTimeout(300);
  return { ctx, s, fehler };
}

const bandUnter = s => s.evaluate(() => {
  /* Der Grund unter der Box: das Band, darüber die Glasfläche gemischt. */
  return getComputedStyle(document.querySelector("header")).backgroundColor;
});

(async () => {
  const browser = await chromium.launch();
  pruef(HAEUSER.length >= 2, "mindestens zwei Häuser erzeugt (§8.1a)", HAEUSER.join(", "));
  for (const haus of HAEUSER) {
    for (const breite of [320, 360, 390, 430, 1280]) {
      const { ctx, s, fehler } = await oeffnen(browser, haus, breite, "2026-10-10T07:30:00");
      const k = haus + " @" + breite;
      const m = await s.evaluate(() => {
        const r = el => el.getBoundingClientRect();
        const kopf = document.querySelector("header"), wahl = document.querySelector(".kopfwahl"), cs = getComputedStyle(wahl);
        const kinder = [...wahl.children].filter(el => !el.hidden && getComputedStyle(el).display !== "none");
        const knoepfe = [document.getElementById("lichtknopf"), document.getElementById("sprachknopf")];
        const st = document.getElementById("status"), box = st.firstElementChild, logo = document.getElementById("logo");
        const h1 = document.getElementById("titel"), claim = document.getElementById("claim");
        const sichtbar = el => { const q = r(el); return q.width > 2 && q.height > 2 && getComputedStyle(el).visibility !== "hidden"; };
        return {
          leiste: { rand: cs.borderTopWidth, randFarbe: cs.borderTopColor, grund: cs.backgroundColor, breite: r(wahl).width,
            mitte: r(wahl).left + r(wahl).width / 2 - (r(kopf).left + r(kopf).width / 2) },
          knopf: knoepfe.map(b => ({ w: r(b).width, h: r(b).height, rand: getComputedStyle(b).borderTopColor, innen: r(b).left >= r(wahl).left - .5 && r(b).right <= r(wahl).right + .5 })),
          kinder: kinder.length,
          glanz: !!document.querySelector(".glanzflug"),
          h1: sichtbar(h1), h1text: h1.textContent.trim(), claim: sichtbar(claim) && claim.textContent.trim().length > 0,
          inZeile: st.parentElement === wahl,
          box: box ? { r: r(box).right, l: r(box).left, t: r(box).top, b: r(box).bottom } : null,
          kopf: { r: r(kopf).right, l: r(kopf).left }, rand: parseFloat(getComputedStyle(kopf).paddingRight),
          logo: { l: r(logo).left, r: r(logo).right, t: r(logo).top, b: r(logo).bottom },
          ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      pruef(parseFloat(m.leiste.rand) >= 1 && !/rgba\([^)]*,\s*0\)/.test(m.leiste.randFarbe) && !/rgba\([^)]*,\s*0\)/.test(m.leiste.grund),
        k + ": EINE Leiste mit eigenem Rand und Glas", m.leiste.rand + " " + m.leiste.randFarbe + " / " + m.leiste.grund);
      pruef(m.knopf.every(b => b.w >= 44 && b.h >= 44 && b.innen && /rgba\([^)]*,\s*0\)|transparent/.test(b.rand)),
        k + ": Licht und Sprache darin, randlos, ≥ 44 px", JSON.stringify(m.knopf));
      pruef(Math.abs(m.leiste.mitte) <= 1, k + ": Leiste mittig", m.leiste.mitte.toFixed(1));
      pruef(!m.glanz, k + ": kein Glanzstreifen mehr");
      pruef(!m.h1 && m.h1text.length > 0 && m.claim, k + ": wenig Text — Gruß nicht im Bild (h1 für Vorleser da), Slogan sichtbar", m.h1 + " / " + m.claim);
      pruef(!m.inZeile && !!m.box, k + ": Öffnungsstand nicht mehr in der Knopfzeile");
      if (m.box) {
        const rechts = m.kopf.r - m.rand;
        pruef(Math.abs(m.box.r - rechts) <= 2 && m.box.t < m.logo.b, k + ": Box oben rechts (bündig mit dem Rand, auf Höhe des Siegels)",
          "rechts " + m.box.r.toFixed(1) + " / " + rechts.toFixed(1) + ", oben " + m.box.t.toFixed(1));
        pruef(m.box.l >= m.logo.r + 4 || m.box.t >= m.logo.b, k + ": Box überdeckt das Siegel nicht", "Box links " + m.box.l.toFixed(1) + ", Siegel rechts " + m.logo.r.toFixed(1));
      }
      pruef(m.ueber <= 0, k + ": kein seitliches Überlaufen", m.ueber);

      if (breite === 390) {
        /* 4 · Geschlossen: Sanduhr gegen die Rechnung */
        const zu = await s.evaluate(() => {
          const sand = document.querySelector("#status .st-sand"), txt = document.querySelector("#status .st-text");
          return sand && { anteil: +sand.dataset.anteil, bunt: sand.querySelectorAll("circle:not(.aus):not(.st-korn)").length,
            alle: sand.querySelectorAll("circle:not(.st-korn)").length, text: txt.textContent.trim(),
            farbe: getComputedStyle(txt).color };
        });
        pruef(!!zu, haus + ": geschlossen → Sanduhr steht da");
        if (zu) {
          /* 00:30 geschlossen, 10:30 offen, jetzt 07:30 → 7/10 */
          pruef(Math.abs(zu.anteil - 0.7) < 0.01, haus + ": Anteil aus den Zeiten nachgerechnet (07:30 zwischen 00:30 und 10:30 = 0,7)", zu.anteil);
          pruef(zu.bunt === Math.round(0.7 * zu.alle), haus + ": so viel bunter Sand wie der Anteil", zu.bunt + " von " + zu.alle);
          pruef(/10:30/.test(zu.text) && /heute/.test(zu.text), haus + ": Text nennt die Öffnung", zu.text);
          const band = rgb(await bandUnter(s));
          pruef(kontrast(rgb(zu.farbe), band) >= 4.5, haus + ": Schrift der Box ≥ 4,5:1", kontrast(rgb(zu.farbe), band).toFixed(2));
        }
        await s.clock.setFixedTime(new Date("2026-10-10T09:30:00"));
        await s.evaluate(() => { stunde = new Date().getHours(); statusZeichnen(); });
        const mehr = await s.evaluate(() => +document.querySelector("#status .st-sand").dataset.anteil);
        pruef(mehr > 0.7 && Math.abs(mehr - 0.9) < 0.01, haus + ": zwei Stunden später mehr Sand (0,9)", mehr);
      }
      pruef(!fehler.length, k + ": keine Ausnahme", fehler.join(" | ") || "still");
      await ctx.close();
    }

    /* 5 · Offen: Regenbogen, Tag und Abend */
    for (const [uhr, phase] of [["2026-10-10T14:00:00", "Tag"], ["2026-10-10T21:30:00", "Abend"]]) {
      const { ctx, s, fehler } = await oeffnen(browser, haus, 390, uhr);
      const o = await s.evaluate(() => {
        const txt = document.querySelector("#status .status.offen .st-text");
        if (!txt) return null;
        const led = document.querySelector("#status .st-led");
        const anis = led ? led.getAnimations({ subtree: true }) : [];
        const props = new Set(); anis.forEach(a => a.effect.getKeyframes().forEach(k => Object.keys(k).forEach(x => { if (!["offset","computedOffset","easing","composite"].includes(x)) props.add(x); })));
        return { text: txt.textContent, farben: [...txt.querySelectorAll("span")].map(s => getComputedStyle(s).color),
          laeuft: anis.some(a => a.playState === "running"), props: [...props] };
      });
      pruef(!!o && /Geöffnet bis 00:30/.test(o.text), haus + " " + phase + ": offen → „Geöffnet bis 00:30“", o && o.text);
      if (o) {
        const band = rgb(await bandUnter(s));
        const k = o.farben.map(c => kontrast(rgb(c), band));
        pruef(o.farben.length >= 10 && Math.min(...k) >= 4.5, haus + " " + phase + ": jeder Buchstabe ≥ 4,5:1", "min " + Math.min(...k).toFixed(2) + " bei " + o.farben.length);
        pruef(new Set(o.farben).size >= 6, haus + " " + phase + ": Regenbogen (≥ 6 verschiedene Farben)", new Set(o.farben).size);
        pruef(o.laeuft && o.props.every(p => p === "transform" || p === "opacity"), haus + " " + phase + ": LED-Leiste läuft, nur transform", o.props.join(","));
      }
      pruef(!fehler.length, haus + " " + phase + ": keine Ausnahme", fehler.join(" | ") || "still");
      await ctx.close();
    }
  }

  /* RTL und reduzierte Bewegung */
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", 390, "2026-10-10T14:00:00", { sprache: "ar" });
    const r = await s.evaluate(() => {
      const box = document.querySelector("#status .status"), kopf = document.querySelector("header");
      const b = box.getBoundingClientRect();
      return { links: Math.abs(b.left - (kopf.getBoundingClientRect().left + parseFloat(getComputedStyle(kopf).paddingLeft))),
        spans: box.querySelectorAll(".st-text span").length, text: box.textContent.trim() };
    });
    pruef(r.links <= 2 && r.spans === 0 && r.text.length > 0, "Arabisch: Box oben LINKS, Text ohne Einzelbuchstaben", JSON.stringify(r));
    pruef(!fehler.length, "RTL: keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }
  for (const uhr of ["2026-10-10T14:00:00", "2026-10-10T07:30:00"]) {
    const { ctx, s } = await oeffnen(browser, "chocolamour", 390, uhr, { ruhig: true });
    const lauf = await s.evaluate(() => document.getElementById("status").getAnimations({ subtree: true }).filter(a => a.playState === "running").length);
    pruef(lauf === 0, "reduzierte Bewegung (" + uhr.slice(11, 16) + "): in der Box läuft nichts", lauf);
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
