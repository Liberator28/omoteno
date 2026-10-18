/* ═══════════════════════════════════════════════════════════════════
   pruef-kopfzentrale.js — Kopf als Kommandozentrale, Öffnungsanzeige
   oben rechts (schlicht, eine Farbe), kein Glanz, wenig Text

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
   3 · Seit 17.10. (Foto 12.10.: „die geöffnet Anzeige soll unter dem
       Logo sein … die Kommandozentrale rechts oben sticky“):
       Leiste FEST oben rechts an der Spalte (540 px), auch nach dem
       Rollen an derselben Stelle; RTL oben links; sie überdeckt weder
       Siegel noch Anzeige noch Slogan. Die Anzeige steht mittig UNTER
       dem Siegel, als Glas-Pille (rund, ≥ 34 px hoch).
   4 · Geschlossen: hohler Ring, feine Linie, Anteil = (jetzt − letzter
       Schluss) / (Öffnung − letzter Schluss) aus ZEITEN nachgerechnet
       UND am gemalten scaleX abgelesen; zwei Stunden später länger.
       Text „Öffnet heute 10:30“ ≥ 4,5:1 auf dem Band.
   5 · Offen: „Geöffnet bis …“ ≥ 4,5:1, voller Punkt, Atem nur
       transform/opacity.
   5b · EINE Farbe (Wunsch 10.10., dritte Nachricht: „ohne rgb colors“):
       jede gemalte Farbe in der Box — Schrift, Grund, Rand, auch an
       ::before/::after — hat den Farbton der Bandschrift (nur die
       Deckkraft darf abweichen). Ein Verlauf ist nur erlaubt, wenn
       JEDER Halt diese Farbe oder durchsichtig ist (das umlaufende
       Licht der Pille). Gegenbeweis: eine hsl()-Farbe an einem
       Buchstaben → rot; Gold im Licht → rot.
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

/* Jede gemalte Farbe in der Box gegen die Bandschrift: gleicher
   Farbton (RGB ± 3), nur die Deckkraft darf anders sein. Schatten
   (schwarz, unter der Box) zählen nicht — sie sind kein Farbton. */
const einfarbig = s => s.evaluate(() => {
  const box = document.querySelector("#status .status");
  const lies = t => { const z = (t.match(/[\d.]+/g) || []).map(Number); if (/color\(/.test(t)) { return { c: z.slice(0, 3).map(v => v * 255), a: z.length > 3 ? z[3] : 1 }; } return { c: z.slice(0, 3), a: z.length > 3 ? z[3] : 1 }; };
  const ref = lies(getComputedStyle(box).color).c;
  const fremd = []; let n = 0;
  const els = [box, ...box.querySelectorAll("*")];
  for (const el of els) for (const pseudo of [null, "::before", "::after"]) {
    const cs = getComputedStyle(el, pseudo);
    if (pseudo && (cs.content === "none" || cs.content === "normal")) continue;
    if (cs.backgroundImage !== "none") {
      /* Nur ein Verlauf aus der Bandschrift (jede Deckkraft) oder Durchsichtigem. */
      const halte = cs.backgroundImage.match(/rgba?\([^)]*\)|color\([^)]*\)/g) || [];
      if (/url\(/.test(cs.backgroundImage) || !halte.length) fremd.push(el.className + (pseudo || "") + " Bild");
      for (const h of halte) { const f = lies(h); n++; if (f.a >= 0.02 && f.c.some((v, i) => Math.abs(v - ref[i]) > 3)) fremd.push((el.getAttribute("class") || el.tagName) + (pseudo || "") + " Verlauf " + h); }
    }
    /* fill nur an SVG — an HTML steht dort immer Schwarz, gemalt wird es nie. */
    for (const eig of el instanceof SVGElement ? ["color", "fill"] : ["color", "backgroundColor", "borderTopColor"]) {
      const w = cs[eig]; if (!w || w === "none" || w === "transparent") continue;
      const f = lies(w); if (f.a < 0.02) continue;
      n++;
      if (f.c.some((v, i) => Math.abs(v - ref[i]) > 3)) fremd.push((el.getAttribute("class") || el.tagName) + (pseudo || "") + " " + eig + " " + w);
    }
  }
  return { fremd, n };
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
            pos: cs.position, l: r(wahl).left, r: r(wahl).right, t: r(wahl).top, b: r(wahl).bottom,
            spalteR: Math.min(innerWidth, (innerWidth + 540) / 2) },
          claimR: (() => { const q = r(claim); return { l: q.left, r: q.right, t: q.top, b: q.bottom }; })(),
          knopf: knoepfe.map(b => ({ w: r(b).width, h: r(b).height, rand: getComputedStyle(b).borderTopColor, innen: r(b).left >= r(wahl).left - .5 && r(b).right <= r(wahl).right + .5 })),
          kinder: kinder.length,
          glanz: !!document.querySelector(".glanzflug"),
          h1: sichtbar(h1), h1text: h1.textContent.trim(), claim: sichtbar(claim) && claim.textContent.trim().length > 0,
          inZeile: st.parentElement === wahl,
          box: box ? { r: r(box).right, l: r(box).left, t: r(box).top, b: r(box).bottom, h: r(box).height,
            rund: parseFloat(getComputedStyle(box).borderTopLeftRadius) >= r(box).height / 2 - 1 } : null,
          kopf: { r: r(kopf).right, l: r(kopf).left }, rand: parseFloat(getComputedStyle(kopf).paddingRight),
          logo: { l: r(logo).left, r: r(logo).right, t: r(logo).top, b: r(logo).bottom },
          ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      pruef(parseFloat(m.leiste.rand) >= 1 && !/rgba\([^)]*,\s*0\)/.test(m.leiste.randFarbe) && !/rgba\([^)]*,\s*0\)/.test(m.leiste.grund),
        k + ": EINE Leiste mit eigenem Rand und Glas", m.leiste.rand + " " + m.leiste.randFarbe + " / " + m.leiste.grund);
      pruef(m.knopf.every(b => b.w >= 44 && b.h >= 44 && b.innen && /rgba\([^)]*,\s*0\)|transparent/.test(b.rand)),
        k + ": Licht und Sprache darin, randlos, ≥ 44 px", JSON.stringify(m.knopf));
      pruef(m.leiste.pos === "fixed" && Math.abs(m.leiste.r - (m.leiste.spalteR - 8)) <= 2 && m.leiste.t <= 12,
        k + ": Leiste fest oben rechts an der Spalte", m.leiste.pos + " rechts " + m.leiste.r.toFixed(1) + " / " + (m.leiste.spalteR - 8).toFixed(1) + ", oben " + m.leiste.t.toFixed(1));
      const schneidet = (a, b) => !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b);
      pruef(!schneidet(m.leiste, m.logo) && (!m.box || !schneidet(m.leiste, m.box)) && !schneidet(m.leiste, m.claimR),
        k + ": Leiste überdeckt weder Siegel noch Anzeige noch Slogan", JSON.stringify({ leiste: [m.leiste.l, m.leiste.b].map(Math.round), logo: [m.logo.l, m.logo.t].map(Math.round) }));
      pruef(!m.glanz, k + ": kein Glanzstreifen mehr");
      pruef(!m.h1 && m.h1text.length > 0 && m.claim, k + ": wenig Text — Gruß nicht im Bild (h1 für Vorleser da), Slogan sichtbar", m.h1 + " / " + m.claim);
      pruef(!m.inZeile && !!m.box, k + ": Öffnungsstand nicht mehr in der Knopfzeile");
      if (m.box) {
        const mitteBox = (m.box.l + m.box.r) / 2, mitteLogo = (m.logo.l + m.logo.r) / 2;
        pruef(m.box.t >= m.logo.b && Math.abs(mitteBox - mitteLogo) <= 2, k + ": Anzeige mittig UNTER dem Siegel",
          "oben " + m.box.t.toFixed(1) + " / Siegel unten " + m.logo.b.toFixed(1) + ", Mitte " + mitteBox.toFixed(1) + " / " + mitteLogo.toFixed(1));
        pruef(m.box.rund && m.box.h >= 34, k + ": Glas-Pille (rund, ≥ 34 px)", m.box.h.toFixed(1));
      }
      pruef(m.ueber <= 0, k + ": kein seitliches Überlaufen", m.ueber);
      if (breite === 390 || breite === 1280) {
        await s.evaluate(() => { document.body.style.minHeight = "3000px"; scrollTo(0, 900); });
        await s.waitForTimeout(250);
        const g = await s.evaluate(() => { const q = document.querySelector(".kopfwahl").getBoundingClientRect(); return { r: q.right, t: q.top }; });
        pruef(Math.abs(g.r - m.leiste.r) <= 1 && Math.abs(g.t - m.leiste.t) <= 1, k + ": nach dem Rollen an derselben Stelle (klebt)", JSON.stringify(g));
        await s.evaluate(() => scrollTo(0, 0));
      }

      if (breite === 390) {
        /* 4 · Geschlossen: Linie gegen die Rechnung — und gegen das Bild */
        const zu = await s.evaluate(() => {
          const linie = document.querySelector("#status .st-linie"), txt = document.querySelector("#status .st-text");
          const punkt = document.querySelector("#status .status.zu .st-punkt");
          const tf = linie && getComputedStyle(linie.firstElementChild).transform;
          return linie && { anteil: +linie.dataset.anteil, gemalt: tf && tf !== "none" ? +tf.match(/matrix\(([^,]+)/)[1] : 1,
            hohl: !!punkt && /rgba\([^)]*,\s*0\)|transparent/.test(getComputedStyle(punkt).backgroundColor) && parseFloat(getComputedStyle(punkt).borderTopWidth) >= 1,
            text: txt.textContent.trim(), farbe: getComputedStyle(txt).color };
        });
        pruef(!!zu, haus + ": geschlossen → Linie bis zur Öffnung steht da");
        if (zu) {
          /* 00:30 geschlossen, 10:30 offen, jetzt 07:30 → 7/10 */
          pruef(Math.abs(zu.anteil - 0.7) < 0.01, haus + ": Anteil aus den Zeiten nachgerechnet (07:30 zwischen 00:30 und 10:30 = 0,7)", zu.anteil);
          pruef(Math.abs(zu.gemalt - 0.7) < 0.01, haus + ": die Linie ist zu 70 % gefüllt (gemalt, scaleX)", zu.gemalt);
          pruef(zu.hohl, haus + ": geschlossen = hohler Ring");
          pruef(/10:30/.test(zu.text) && /heute/.test(zu.text), haus + ": Text nennt die Öffnung", zu.text);
          const band = rgb(await bandUnter(s));
          pruef(kontrast(rgb(zu.farbe), band) >= 4.5, haus + ": Schrift der Box ≥ 4,5:1", kontrast(rgb(zu.farbe), band).toFixed(2));
          const ein = await einfarbig(s);
          pruef(ein.fremd.length === 0 && ein.n >= 4, haus + ": geschlossen — EINE Farbe in der Box (" + ein.n + " Farbangaben)", ein.fremd.slice(0, 3).join(" | "));
        }
        await s.clock.setFixedTime(new Date("2026-10-10T09:30:00"));
        await s.evaluate(() => { stunde = new Date().getHours(); statusZeichnen(); });
        const mehr = await s.evaluate(() => +document.querySelector("#status .st-linie").dataset.anteil);
        pruef(mehr > 0.7 && Math.abs(mehr - 0.9) < 0.01, haus + ": zwei Stunden später länger (0,9)", mehr);
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
        const box = document.querySelector("#status .status");
        const anis = box.getAnimations({ subtree: true });
        const props = new Set(); anis.forEach(a => a.effect.getKeyframes().forEach(k => Object.keys(k).forEach(x => { if (!["offset","computedOffset","easing","composite"].includes(x)) props.add(x); })));
        return { text: txt.textContent, farbe: getComputedStyle(txt).color, spans: txt.querySelectorAll("span").length,
          punkt: !!box.querySelector(".st-punkt"), laeuft: anis.some(a => a.playState === "running"), props: [...props] };
      });
      pruef(!!o && /Geöffnet bis 00:30/.test(o.text), haus + " " + phase + ": offen → „Geöffnet bis 00:30“", o && o.text);
      if (o) {
        const band = rgb(await bandUnter(s));
        pruef(kontrast(rgb(o.farbe), band) >= 4.5, haus + " " + phase + ": Schrift ≥ 4,5:1", kontrast(rgb(o.farbe), band).toFixed(2));
        pruef(o.spans === 0, haus + " " + phase + ": ein Satz, keine Einzelbuchstaben", o.spans);
        pruef(o.punkt && o.laeuft && o.props.every(p => p === "transform" || p === "opacity"), haus + " " + phase + ": Punkt atmet, nur transform/opacity", o.props.join(","));
        const ein = await einfarbig(s);
        pruef(ein.fremd.length === 0 && ein.n >= 4, haus + " " + phase + ": offen — EINE Farbe in der Box (" + ein.n + " Farbangaben)", ein.fremd.slice(0, 3).join(" | "));
      }
      pruef(!fehler.length, haus + " " + phase + ": keine Ausnahme", fehler.join(" | ") || "still");
      await ctx.close();
    }
  }

  /* RTL und reduzierte Bewegung */
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", 390, "2026-10-10T14:00:00", { sprache: "ar" });
    const r = await s.evaluate(() => {
      const box = document.querySelector("#status .status"), wahl = document.querySelector(".kopfwahl").getBoundingClientRect();
      return { leisteLinks: Math.round(wahl.left),
        spans: box.querySelectorAll(".st-text span").length, text: box.textContent.trim() };
    });
    pruef(r.leisteLinks >= 6 && r.leisteLinks <= 10 && r.spans === 0 && r.text.length > 0, "Arabisch: Leiste oben LINKS, Text ohne Einzelbuchstaben", JSON.stringify(r));
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
