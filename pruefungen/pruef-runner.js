/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Top-Runner als Flash-Sale (Band, Streifen, Laufschrift)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-runner.js

   Wunsch (09.10., Bildschirmfoto der Board-Vorschau): „Der Top-Runner
   soll grafisch moderner aussehen … Text ein bisschen größer, das Bild
   rechts, mehr wie eine Flash-Sale-Anzeige, mehr Farben, eine
   Animation, die mit einem Text von links nach rechts läuft, mit
   Streifen — oder ein Text, den man auch eingeben kann.“

   ZWEITE QUELLEN:
     · der Rabatt in Prozent wird aus preis_alt/preis_neu der Aktion
       nachgerechnet, nicht vom Hub abgelesen
     · die Laufschrift kommt aus hub_texte.laufschrift — Grenze 80 aus
       datenbank/migration-laufschrift.sql (gelesen, nicht abgetippt)
     · Kontrast der Bandschrift gegen das Band UND gegen die Streifen
       (aus dem ::before gelesen) — die schlechtere Fläche zählt

   Uhr fest (§8.1j). Beide Häuser, hell und dunkel, 360/390/430 px.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const HUB  = slug => "file://" + path.join(OBEN, "dist", slug, "index.html");
const ADMIN = "file://" + path.join(OBEN, "seiten", "admin.html");
const GRENZE = +((fs.readFileSync(path.join(OBEN, "datenbank", "migration-laufschrift.sql"), "utf8")
  .match(/'laufschrift'\), 0\) <= (\d+)/) || [])[1]);

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

const AKTION = { id:"probe", gericht_name:"Dubai Crêpe", titel:null, preis_alt:12.9, preis_neu:8.9 };

async function oeffnen(browser, slug, opt = {}) {
  const ctx = await browser.newContext({ viewport:{ width:opt.breite || 390, height:844 },
    reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(e.message));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await s.addInitScript(() => {
    try{ sessionStorage.setItem("omoteno-willkommen", "1"); sessionStorage.setItem("omoteno-reise", "1"); }catch(e){}
    const echt = Date, fest = new echt(2026, 9, 9, 14, 0, 0).getTime();
    Date = class extends echt { constructor(...a){ super(...(a.length ? a : [fest])); } static now(){ return fest; } };
  });
  await s.goto(HUB(slug) + "#/");
  await s.waitForTimeout(1000);
  await s.evaluate(([a, licht, lauf]) => {
    if(licht) lichtSetzen(licht);
    RUNNER_LAUFSCHRIFT = lauf || "";
    aktionen = [Object.assign({}, a, { bis:new Date(Date.now() + 2 * 3600e3 + 60e3).toISOString() })];
    zeichne();
  }, [AKTION, opt.licht || "", opt.lauf || ""]);
  await s.waitForTimeout(opt.licht ? 1000 : 300);   // Hell/Dunkel blendet über
  return { ctx, s, fehler };
}

const KONTRAST = () => {
  const zahl = t => { const s = String(t);
    const m = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
    if (m) return [m[1] * 255, m[2] * 255, m[3] * 255].concat(m[4] !== undefined ? [+m[4]] : []);
    return (s.match(/[\d.]+/g) || []).map(Number); };
  const kanal = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  const L = p => .2126 * kanal(p[0]) + .7152 * kanal(p[1]) + .0722 * kanal(p[2]);
  const misch = (o, u) => { const a = o.length > 3 ? o[3] : 1; return [0, 1, 2].map(i => o[i] * a + u[i] * (1 - a)); };
  const kanten = st => (String(st.backgroundImage).match(/color\(srgb[^)]*\)|rgba?\([^)]*\)/g) || []).map(zahl).filter(v => v.length >= 3);
  const gruende = el => { const st = []; let k = el;
    while (k) { const cs = getComputedStyle(k), b = zahl(cs.backgroundColor), v = kanten(cs);
      if (v.length) { st.push(v); if (v.every(x => x.length === 3 || x[3] === 1)) break; }
      if (b.length >= 3 && (b.length < 4 || b[3] > 0)) st.push([b]);
      if (b.length === 3 || b[3] === 1) break; k = k.parentElement; }
    if (!st.length) return [[255, 255, 255]];
    const n = Math.max(...st.map(l => l.length)), aus = [];
    for (let i = 0; i < n; i++) { const spur = st.map(l => l[Math.min(i, l.length - 1)]);
      let u = spur.pop(); if (u.length > 3) u = misch(u, [255, 255, 255]);
      while (spur.length) u = misch(spur.pop(), u); aus.push(u); }
    return aus; };
  const verh = (c, g) => { const a = L(misch(c, g)), b = L(g); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
  const aus = [];
  document.querySelectorAll(".aktion .kennz, .aktion .name, .aktion .neu, .aktion .rest, .aktion-rabatt, .aktion .sofort").forEach(el => {
    const c = zahl(getComputedStyle(el).color);
    aus.push([el.className, +Math.min(...gruende(el).map(g => verh(c, g))).toFixed(2)]);
  });
  /* Das Band: gegen die Bandfarbe UND gegen die (deckenden) Streifen aus dem ::before. */
  const band = document.querySelector(".aktion-band"), lauf = band.querySelector(".aktion-lauf");
  const c = zahl(getComputedStyle(lauf).color), grund = zahl(getComputedStyle(band).backgroundColor);
  const streifen = kanten(getComputedStyle(band, "::before")).filter(v => v.length === 3 || v[3] > 0).map(v => misch(v, grund));
  aus.push(["band", +Math.min(verh(c, grund), ...streifen.map(g => verh(c, g))).toFixed(2), streifen.length]);
  return aus;
};

(async () => {
  const browser = await chromium.launch();
  pruef(GRENZE === 80, "Grenze der Laufschrift aus der Migration gelesen", GRENZE);

  for (const slug of ["chocolamour", "blend"]) {
    console.log("\n══ " + slug + " · Aufbau, Bewegung, Laufschrift ══");
    {
      const { ctx, s, fehler } = await oeffnen(browser, slug);
      const r = await s.evaluate(() => {
        const a = document.querySelector(".aktion"); if (!a) return null;
        const q = sel => a.querySelector(sel), box = el => el.getBoundingClientRect();
        const was = box(q(".was")), bild = box(q(".aktion-bild")), karte = box(a);
        return { band: !!q(".aktion-band"), lauf: q(".aktion-lauf").textContent,
                 kennz: q(".kennz").textContent, rabatt: (q(".aktion-rabatt") || {}).textContent,
                 name: +parseFloat(getComputedStyle(q(".name")).fontSize), neu: +parseFloat(getComputedStyle(q(".neu")).fontSize),
                 bildRechts: bild.left >= was.right - 1 && bild.left + bild.width / 2 > karte.left + karte.width / 2,
                 bildGross: Math.round(bild.width), rest: q(".rest").textContent };
      });
      pruef(!!r && r.band, "über der Aktion steht ein farbiges Band");
      const soll = "−" + Math.round((1 - AKTION.preis_neu / AKTION.preis_alt) * 100) + " %";
      pruef(!!r && r.rabatt === soll, "Rabatt-Plakette aus den Preisen gerechnet", r && (r.rabatt + " = " + soll));
      pruef(!!r && r.name >= 20 && r.neu >= 24, "Name und neuer Preis groß (≥ 20 / ≥ 24 px)", r && (r.name + " / " + r.neu + " px"));
      pruef(!!r && r.bildRechts && r.bildGross >= 90, "das Gericht steht rechts, ≥ 90 px", r && (r.bildRechts + ", " + r.bildGross + " px"));
      pruef(!!r && r.kennz === "Top-Runner", "Kennzeichnung bleibt genau der Titel (der Blitz ist ein eigenes Zeichen)", r && r.kennz);
      pruef(!!r && ["Top-Runner", "Dubai Crêpe", soll, r.rest].every(x => r.lauf.includes(x)),
        "ohne eigene Laufschrift: Titel, Gericht, Rabatt, Restzeit laufen", r && r.lauf.slice(0, 90));
      /* Die Spur läuft von links nach rechts — gemessen an zwei Zeitpunkten. */
      const lauf = await s.evaluate(async () => {
        const el = document.querySelector(".aktion-lauf");
        const x = () => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
        const a = x(); await new Promise(r => setTimeout(r, 600)); const b = x();
        const anims = [...document.querySelector(".aktion").getAnimations({ subtree:true })];
        const props = new Set(); anims.forEach(an => an.effect.getKeyframes().forEach(k => Object.keys(k).forEach(p => props.add(p))));
        ["offset", "easing", "composite", "computedOffset"].forEach(p => props.delete(p));
        return { a:+a.toFixed(1), b:+b.toFixed(1), namen: anims.map(an => an.animationName).filter(Boolean).sort(), props:[...props] };
      });
      pruef(lauf.b > lauf.a, "die Laufschrift wandert von links nach rechts", lauf.a + " → " + lauf.b + " px");
      pruef(lauf.namen.includes("aktionStreifen") && lauf.namen.includes("aktionLauf") && lauf.namen.includes("aktionPuls"),
        "Streifen, Laufschrift und Puls laufen", lauf.namen.join(", "));
      pruef(lauf.props.every(p => p === "transform" || p === "opacity"), "nur transform/opacity werden bewegt", lauf.props.join(","));
      /* Eigene Laufschrift: steht drin, Rabatt dazu, Gericht nicht doppelt */
      const eigen = await s.evaluate(() => { RUNNER_LAUFSCHRIFT = "Nur heute · solange der Vorrat reicht"; zeichne();
        return document.querySelector(".aktion-lauf").textContent; });
      pruef(eigen.includes("Nur heute · solange der Vorrat reicht") && eigen.includes(soll) && !eigen.includes("Dubai Crêpe"),
        "eigene Laufschrift läuft, der Rabatt kommt von selbst dazu", eigen.slice(0, 80));
      /* Nur als Text: ein Anführungszeichen oder Tag wird nicht zur Auszeichnung */
      const sicher = await s.evaluate(() => { RUNNER_LAUFSCHRIFT = '<img src=x onerror="window.__lauf=1">'; zeichne();
        return { img: !!document.querySelector(".aktion-band img"), lief: !!window.__lauf }; });
      await s.waitForTimeout(200);
      pruef(!sicher.img && !(await s.evaluate(() => !!window.__lauf)), "Laufschrift nur als Text (kein Tag, kein onerror)", JSON.stringify(sicher));
      /* Aus hub_texte: Grenze, falscher Typ */
      const aus = await s.evaluate(G => {
        betriebsTeileAnwenden({ hub_texte:{ laufschrift:"x".repeat(G + 15) } }, true); const lang = RUNNER_LAUFSCHRIFT.length;
        betriebsTeileAnwenden({ hub_texte:{ laufschrift:42 } }, true); const zahl = RUNNER_LAUFSCHRIFT;
        betriebsTeileAnwenden({ hub_texte:{ laufschrift:"  Happy Hour  " } }, true); const gut = RUNNER_LAUFSCHRIFT;
        return { lang, zahl, gut };
      }, GRENZE);
      pruef(aus.lang === GRENZE && aus.zahl === "" && aus.gut === "Happy Hour", "aus hub_texte: gekürzt auf die Grenze, Nicht-Text verworfen, getrimmt", JSON.stringify(aus));
      pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
      await ctx.close();
    }
    {
      const { ctx, s } = await oeffnen(browser, slug, { ruhig:true });
      const r = await s.evaluate(() => ({ laufend: document.querySelector(".aktion").getAnimations({ subtree:true }).filter(a => a.playState === "running").length,
        x: new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".aktion-lauf")).transform).m41 }));
      pruef(r.laufend === 0 && r.x === 0, "Bewegung reduzieren: nichts läuft, die Schrift steht am Anfang", JSON.stringify(r));
      await ctx.close();
    }
    for (const licht of ["hell", "dunkel"]) for (const breite of [360, 390, 430]) {
      const { ctx, s, fehler } = await oeffnen(browser, slug, { licht, breite, ruhig:true });
      const lage = slug + " · " + licht + " · " + breite + " px";
      const k = await s.evaluate(KONTRAST);
      const schlecht = k.filter(x => x[1] < 4.5), band = k.find(x => x[0] === "band");
      pruef(!schlecht.length && band && band[2] >= 1, lage + ": jede Schrift ≥ 4,5:1 (Band gegen Streifen gerechnet)",
        schlecht.length ? schlecht.map(x => x.join(" ")).join(", ") : k.length + " Stellen, kleinste " + Math.min(...k.map(x => x[1])));
      const m = await s.evaluate(() => { const a = document.querySelector(".aktion"), so = a.querySelector(".sofort").getBoundingClientRect();
        const name = a.querySelector(".name"), zh = parseFloat(getComputedStyle(name).lineHeight);
        return { ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                 sofort: Math.round(Math.min(so.width, so.height)), nameZeilen: Math.round(name.getBoundingClientRect().height / zh) }; });
      pruef(m.ueber <= 0 && m.sofort >= 44 && m.nameZeilen <= 2, lage + ": kein Überlauf, „+“ ≥ 44 px, Name ≤ 2 Zeilen", JSON.stringify(m));
      pruef(!fehler.length, lage + ": keine Ausnahme", fehler.join("|") || "still");
      await ctx.close();
    }
  }

  console.log("\n══ Board: Laufschrift eingeben, Vorschau, Übernehmen ══");
  {
    const ctx = await browser.newContext({ viewport:{ width:900, height:900 } });
    const p = await ctx.newPage(); const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto(ADMIN); await p.waitForTimeout(700);
    await p.evaluate(() => { document.getElementById("tor").hidden = true;
      if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); } });
    await p.waitForTimeout(400);
    /* Wie der Besitzer: Einstellungen öffnen — erst dann füllt das Board die Felder. */
    await p.evaluate(() => { const r = document.querySelector('[data-tafel="startseite"]'); if (r) r.click(); });
    await p.waitForTimeout(400);
    const feld = await p.evaluate(() => { const el = document.getElementById("hubLaufschrift");
      return el ? { max: +el.getAttribute("maxlength") } : null; });
    pruef(!!feld && feld.max === GRENZE, "Feld „Laufschrift“ da, nimmt höchstens so viel wie die Datenbank", feld && feld.max);
    const r = await p.evaluate(async () => {
      const gesendet = [];
      const alt = hvSenden; hvSenden = (art, teil, ziel) => { gesendet.push({ art, teil, ziel }); };
      const el = document.getElementById("hubLaufschrift");
      el.value = "Nur heute · 2 für 1"; el.dispatchEvent(new Event("input", { bubbles:true }));
      hvSenden = alt;
      const letzte = gesendet[gesendet.length - 1] || {};
      await hubTexteSichern();
      return { ziel: letzte.ziel, text: letzte.teil && letzte.teil.hub_texte && letzte.teil.hub_texte.laufschrift,
               aktion: !!(letzte.teil && letzte.teil.aktion), gespeichert: HUBTEXTE.laufschrift };
    });
    pruef(r.text === "Nur heute · 2 für 1" && r.ziel === "aktion" && r.aktion, "Tippen schickt die Laufschrift an die Vorschau, mit Beispiel-Aktion", JSON.stringify(r));
    pruef(r.gespeichert === "Nur heute · 2 für 1", "„Übernehmen“ legt sie in hub_texte.laufschrift", r.gespeichert);
    const zurueck = await p.evaluate(() => { document.getElementById("hubTexteZurueck").click(); return document.getElementById("hubLaufschrift").value; });
    pruef(zurueck === "", "„Auf Vorgabe zurück“ leert auch die Laufschrift");
    pruef(!fehler.length, "keine Ausnahme im Board", fehler.join(" | ") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  console.log(f ? f + " FEHLER" : "Alles sauber.");
  process.exit(f ? 1 : 0);
})();
