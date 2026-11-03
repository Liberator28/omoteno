/* ═════════════════════════════════════════════════════════════════════
   PRÜFUNG · Saal mit dem Finger einrichten · schlichter Restaurant-Look

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-saal-finger.js
     (Gegenbeweise: ADMIN_DATEI=<Kopie von admin.html>)

   Wunsch 02.11.: „Küche und Theke mit dem Finger verschieben statt der
   komplizierten Meter-Angabe — mit allem so, schieben und größer/kleiner
   ziehen. Danach das Bild: zu nichtssagend, die Dimensionen passen nicht,
   Restaurant-Look und schlicht. Benachrichtigungen dezenter.“

   Gezogen wird mit ECHTEN Zeigern (Maus bei 1280 px, CDP-Finger bei 390 px).
   Gemessen wird am GEMALTEN Bild über eine EIGENE Umkehr der Projektion
   (zweite Quelle, nicht saalWelt()).

   1 · BLATT. Meterfelder eingeklappt („Maße genau eingeben“ ≥ 44 px),
       bleiben nach einem Zug offen, wenn sie offen waren; Satz zur
       Fingerbedienung; ohne Einrichten weder Griffe noch ziehbare Körper.
   2 · KÜCHE. Griff → Größe im 10-cm-Raster, endet an der Wand, nicht unter
       1 m; Körper → Lage im Raster, bleibt im Raum; Maßschild und Zeile im
       Blatt nennen das gemalte Maß; Kamera springt nicht.
   3 · THEKE, RAUM, LAGE. Theke wie Küche; Raum im 50-cm-Raster 2–60 m;
       Lage-Griff nur bei mehreren Bereichen.
   4 · TISCH. Griff neben dem gewählten Tisch: hinaus mehr, hinein weniger
       Stühle (1–20); gemalte Stühle = Zahl.
   5 · WER WIRD GEFASST. Die gemalte Küche schlägt die 48-px-Trefferfläche
       eines Tisches daneben (§3.17); Pfeiltaste ändert um einen Schritt,
       der Fokus bleibt; Speichern trägt die gezogenen Werte.
   6 · BILD. Stand als schmaler Ring (kein Verlauf, Deckkraft ≤ 0,16, liegt
       an den Stühlen an), im Einrichten nur im Reiter „Signale“ (id stufen); Stühle
       0,42 m, so viele wie Plätze, überlappen nicht; warmer Boden; eng
       (Telefon, ganzer Raum) ohne Belegungsschilder, herangezoomt mit;
       Maßschild und Griff ≥ 4,5:1 in beiden Fassungen; kein Seitenfehler.
   7 · S1/S2 (03.11.). Maßschild nur während des Zugs und 1,5 s danach
       (dann opacity 0, nach dem nächsten Zeichnen weg), Raummaß unter dem
       Namen nur beim Raum-Griff, außerhalb des Einrichtens nie; ↻ dreht
       Küche und Theke um 90° (Breite ↔ Tiefe um die Mitte, am gemalten
       Bild), am Rand wird an die Wand geschoben; „↻ Drehen“ im Blatt und
       „R“ auf dem Körper drehen ebenso, der Fokus bleibt.
   ═════════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const ADMIN = "file://" + (process.env.ADMIN_DATEI ? path.resolve(process.env.ADMIN_DATEI) : path.join(__dirname, "..", "seiten", "admin.html"));

let fehler = 0;
const pruef = (g, t, z) => { console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined && z !== "" ? "  → " + z : "")); if(!g) fehler++; };
const nah = (a, b, tol) => Math.abs(a - b) <= tol;
const lum = c => { const m = String(c).match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

async function neu(br, breite, hoehe, extra){
  const ctx = await br.newContext({ viewport: { width: breite, height: hoehe }, colorScheme: "dark", ...(extra || {}) });
  const p = await ctx.newPage();
  const pf = [];
  p.on("pageerror", e => pf.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
  await p.goto(ADMIN);
  await p.waitForTimeout(700);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; tafelZeigen("reservierungen"); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    /* EIGENE Projektion (zweite Quelle): Welt (m) ↔ Bildschirm */
    window.__bild = (x, y, z) => { const r = document.getElementById("spBuehne").getBoundingClientRect(), c = SAAL.kamera;
      return { x: r.left + c.tx + (x - y) * SAAL_C * SAAL_U * c.k, y: r.top + c.ty + ((x + y) * 0.5 * SAAL_U - z * SAAL_U) * c.k }; };
    window.__welt = (cx, cy, z) => { const r = document.getElementById("spBuehne").getBoundingClientRect(), c = SAAL.kamera;
      const px = (cx - r.left - c.tx) / c.k, py = (cy - r.top - c.ty) / c.k + z * SAAL_U, a = px / (SAAL_C * SAAL_U), b = py / (0.5 * SAAL_U);
      return { x: (a + b) / 2, y: (b - a) / 2 }; };
    window.__ecken = (el, z) => { const svg = document.getElementById("spSvg"), m = el.getScreenCTM();
      return [...el.points].map(pt => { const q = svg.createSVGPoint(); q.x = pt.x; q.y = pt.y; const w = q.matrixTransform(m); return window.__welt(w.x, w.y, z); }); };
    window.__mitte = sel => { const e = document.querySelector(sel); if(!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
  });
  return { ctx, p, pf };
}
/* Ein Zug von a nach b — mit der Maus oder dem Finger (CDP), in kleinen Schritten wie eine Hand. */
async function zug(p, cdp, a, b){
  const n = 12;
  if(cdp){
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
    for(let i = 1; i <= n; i++){ await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }] }); await p.waitForTimeout(12); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }else{
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    for(let i = 1; i <= n; i++) await p.mouse.move(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n);
    await p.mouse.up();
  }
  await p.waitForTimeout(80);
}
/* Bildschirmversatz für einen Weg in Metern (dx, dy) — aus der eigenen Projektion. */
const versatz = (p, dx, dy) => p.evaluate(([dx, dy]) => { const a = window.__bild(0, 0, 0), b = window.__bild(dx, dy, 0); return { x: b.x - a.x, y: b.y - a.y }; }, [dx, dy]);
const plus = (a, d) => ({ x: a.x + d.x, y: a.y + d.y });
const raum0 = p => p.evaluate(() => JSON.parse(JSON.stringify(SAAL.konfigEntwurf.raeume[0])));
const griffMitte = (p, art) => p.evaluate(a => window.__mitte('#spSvg [data-sp-griff="' + a + '"] .sp-griff-treffer'), art);
const imRaster = (v, q) => nah(Math.round(v / q) * q, v, 1e-6);
/* Plan ins Bild: Blatt UND Plan sollen bedienbar sein */
const planZeigen = p => p.evaluate(() => { document.getElementById("spBuehne").scrollIntoView({ block: "start", behavior: "instant" }); });

async function fahren(br, breite, hoehe, finger){
  const name = (finger ? "Finger " : "Maus ") + breite + " px";
  console.log("\n══ " + name + " ══");
  const { ctx, p, pf } = await neu(br, breite, hoehe, finger ? { hasTouch: true, isMobile: true } : {});
  const cdp = finger ? await ctx.newCDPSession(p) : null;
  /* 1 · ohne Einrichten nichts zum Ziehen */
  pruef(await p.evaluate(() => !document.querySelector("#spSvg [data-sp-griff],#spSvg [data-sp-ding]") && !!document.querySelector("#spSvg .sp-k-kueche")), name + ": ohne Einrichten keine Griffe und keine ziehbaren Körper (Voraussetzung: die Küche ist gemalt)");
  await p.click('[data-sp-wz="einrichten"]'); await p.click('[data-sp-tab="masse"]');
  await planZeigen(p); await p.waitForTimeout(150);
  const blatt = await p.evaluate(() => { const d = document.querySelector("#spEdit [data-sp-genau]"), s = d && d.querySelector("summary");
    return { da: !!d, offen: d && d.open, felderSichtbar: [...document.querySelectorAll("#spEdit input[data-sp-kf],#spEdit input[data-sp-rm]")].filter(i => i.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })).length,
      h: s ? s.getBoundingClientRect().height : 0, satz: /mit dem Finger/.test(document.getElementById("spEdit").textContent) }; });
  pruef(blatt.da && !blatt.offen && blatt.felderSichtbar === 0 && blatt.h >= 44 && blatt.satz, name + ": Meterfelder eingeklappt unter „Maße genau eingeben“ (≥ 44 px), oben der Satz zur Fingerbedienung", JSON.stringify(blatt));
  const griffe = await p.evaluate(() => [...document.querySelectorAll("#spSvg [data-sp-griff]")].map(g => { const r = g.querySelector(".sp-griff-treffer").getBoundingClientRect(); return g.dataset.spGriff + ":" + Math.round(r.width); }));
  pruef(griffe.map(g => g.slice(0, g.lastIndexOf(":"))).sort().join() === "kueche,raum,raumlage,theke:0" && griffe.every(g => +g.slice(g.lastIndexOf(":") + 1) >= 44), name + ": Griffe für Raum, Lage (zwei Bereiche), Theke und Küche, jeder ≥ 44 px", griffe.join(" "));

  /* 2 · Küche: Griff zieht die Größe */
  let r0 = await raum0(p), k0 = r0.kueche, kam0 = await p.evaluate(() => JSON.stringify(SAAL.kamera));
  let g = await griffMitte(p, "kueche");
  await zug(p, cdp, g, plus(g, await versatz(p, 1.23, 0.47)));
  let r1 = await raum0(p);
  pruef(nah(r1.kueche.b, k0.b + 1.2, 1e-6) && nah(r1.kueche.t, k0.t + 0.5, 1e-6) && r1.kueche.x === k0.x, name + ": Küchen-Griff +1,23/+0,47 m → Größe +1,2/+0,5 m (10-cm-Raster), die Lage bleibt", JSON.stringify(k0) + " → " + JSON.stringify(r1.kueche));
  const kGemalt = await p.evaluate(() => { const e = window.__ecken(document.querySelector("#spSvg .sp-k-kueche .o"), SAAL_BODEN + 1.5); return { b: Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y), t: Math.hypot(e[2].x - e[1].x, e[2].y - e[1].y) }; });
  pruef(nah(kGemalt.b, r1.kueche.b, 0.06) && nah(kGemalt.t, r1.kueche.t, 0.06), name + ": die gemalte Küche hat genau dieses Maß", kGemalt.b.toFixed(2) + " × " + kGemalt.t.toFixed(2));
  const schild = await p.evaluate(() => (document.querySelector("#spSvg .sp-massschild text") || {}).textContent || "");
  const zeile = await p.evaluate(() => [...document.querySelectorAll("#spEdit .sp-dingzeile span")].map(s => s.textContent).find(t => /^Küche/.test(t)) || "");
  const soll = "Küche " + String(r1.kueche.b).replace(".", ",") + " × " + String(r1.kueche.t).replace(".", ",") + " m";
  pruef(schild === soll && zeile === "Küche · " + soll.slice(6), name + ": Maßschild und Zeile im Blatt nennen das neue Maß", schild + " | " + zeile);
  pruef(await p.evaluate(() => JSON.stringify(SAAL.kamera)) === kam0, name + ": die Kamera springt beim Ziehen nicht");
  g = await griffMitte(p, "kueche");
  await zug(p, cdp, g, plus(g, await versatz(p, 30, 0)));
  r1 = await raum0(p);
  pruef(nah(r1.kueche.x + r1.kueche.b, r1.b, 1e-6) && r1.kueche.x === k0.x, name + ": weiter als die Wand → endet an der Wand, die Küche rutscht nicht weg", JSON.stringify(r1.kueche));
  g = await griffMitte(p, "kueche");
  await zug(p, cdp, g, plus(g, await versatz(p, -40, -40)));
  r1 = await raum0(p);
  pruef(r1.kueche.b === 1 && r1.kueche.t === 1, name + ": kleiner als 1 m geht nicht", JSON.stringify(r1.kueche));
  /* zurück auf eine greifbare Größe (Feld, nicht Finger: die Probe will hier nur Platz) */
  await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0]; r.kueche = { x: 0.2, y: 0.2, b: 2.6, t: 1.8 }; SAAL.konfigEntwurf.raeume[0] = saalRaum(r); saalNeuBauen(); });
  /* Körper verschieben */
  const kStelle = await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0], k = r.kueche, a = window.__bild(k.x + k.b * 0.5, k.y + k.t * 0.35, SAAL_BODEN + 1.57), e = document.elementFromPoint(a.x, a.y); return { ...a, ding: !!(e && e.closest('[data-sp-ding="kueche"]')) }; });
  pruef(kStelle.ding, name + ": Voraussetzung: an der gewählten Stelle liegt die gemalte Küche obenauf");
  kam0 = await p.evaluate(() => JSON.stringify(SAAL.kamera));
  await zug(p, cdp, kStelle, plus(kStelle, await versatz(p, 1.54, 2.03)));
  r1 = await raum0(p);
  pruef(nah(r1.kueche.x, 1.7, 1e-6) && nah(r1.kueche.y, 2.2, 1e-6) && r1.kueche.b === 2.6, name + ": Küche am Körper +1,54/+2,03 m gezogen → Lage 1,7/2,2 m (Raster), Größe bleibt", JSON.stringify(r1.kueche));
  pruef(await p.evaluate(() => JSON.stringify(SAAL.kamera)) === kam0, name + ": die Kamera bleibt auch beim Verschieben stehen");
  const k2 = await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0], k = r.kueche; return window.__bild(k.x + k.b * 0.5, k.y + k.t * 0.35, SAAL_BODEN + 1.57); });
  await zug(p, cdp, k2, plus(k2, await versatz(p, 50, 50)));
  r1 = await raum0(p);
  pruef(nah(r1.kueche.x + r1.kueche.b, r1.b, 1e-6) && nah(r1.kueche.y + r1.kueche.t, r1.t, 1e-6), name + ": weit hinausgezogen bleibt die Küche im Raum (Ecke)", JSON.stringify(r1.kueche));
  await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0]; r.kueche = { x: 0.2, y: 0.2, b: 2.6, t: 1.8 }; SAAL.konfigEntwurf.raeume[0] = saalRaum(r); saalNeuBauen(); });

  /* 7 · S3–S12: Reiter und Sätze — jeder Reiter einmal gezeichnet, alte Wörter nirgends */
  {
    const texte = [];
    for(const t of ["tische", "bereiche", "masse", "stufen"]){ await p.click('[data-sp-tab="' + t + '"]'); texte.push(await p.evaluate(() => document.getElementById("spEdit").textContent)); }
    const reiter = await p.evaluate(() => [...document.querySelectorAll(".sp-tabs .aw-seg")].map(b => b.textContent).join("|"));
    const alle = texte.join(" ") + " " + await p.evaluate(() => document.getElementById("spZeile").textContent);
    const alt = ["Theke / Bar", "Gebäudeumrandung", "Genaue Maße", "Lage im Gebäude", "Der Pass", "Stufe 2 ab", "Stufe 3 ab", "Wann leuchtet", "Ziehen verschiebt"].filter(w => alle.includes(w));
    pruef(reiter === "Tische|Bereiche|Theke & Küche|Signale", name + ": S3/S4 — Reiter „Tische · Bereiche · Theke & Küche · Signale“", reiter);
    pruef(/\d+(,\d)? × \d+(,\d)? m/.test(texte[1]) && /Wo liegt dieser Bereich\?/.test(texte[1]) && /Meter vom linken Rand/.test(texte[1]), name + ": S3/S7 — die Raumgröße steht beim Bereich, „Wo liegt dieser Bereich?“");
    pruef(/Durchreiche/.test(texte[2]) && /＋ Theke dazu|Theke 1/.test(texte[2]) && /Deutlicher ab/.test(texte[3]) && /Dringend ab/.test(texte[3]) && /aufmerksam macht/.test(texte[3]),
      name + ": S4/S8/S9 — „Durchreiche“, „Theke dazu“, „Deutlicher ab“, „Dringend ab“");
    pruef(!alt.length, name + ": S5–S9 — keines der alten Wörter steht mehr im Blatt oder in der Zeile", alt.join(", "));
    await p.click('[data-sp-tab="masse"]'); await planZeigen(p);
  }

  /* 7 · S1: das Maß nur beim Ziehen */
  await p.evaluate(() => { SAAL.ding = null; SAAL.massBis = 0; saalNeuBauen(); });
  pruef(await p.evaluate(() => !document.querySelector("#spSvg .sp-massschild") && !document.querySelector("#spSvg .sp-raumdim")),
    name + ": S1 — ohne Zug kein Maßschild und kein Raummaß unter dem Namen");
  g = await griffMitte(p, "kueche");
  await zug(p, cdp, g, plus(g, await versatz(p, 0.4, 0)));
  const s1 = await p.evaluate(() => { const e = document.querySelector("#spSvg .sp-massschild"); return e ? { da:true, o:getComputedStyle(e).opacity, t:e.textContent } : { da:false }; });
  pruef(s1.da && s1.o === "1" && /^Küche/.test(s1.t), name + ": S1 — direkt nach dem Zug steht das Maßschild da", JSON.stringify(s1));
  await p.waitForTimeout(1900);
  const s2 = await p.evaluate(() => { const e = document.querySelector("#spSvg .sp-massschild"); return e ? getComputedStyle(e).opacity : "weg"; });
  pruef(s2 === "0" || s2 === "weg", name + ": S1 — 1,5 s nach dem Loslassen ist es ausgeblendet", s2);
  await p.evaluate(() => saalNeuBauen());
  pruef(await p.evaluate(() => !document.querySelector("#spSvg .sp-massschild")), name + ": S1 — nach dem nächsten Zeichnen ist es weg (die Küche bleibt gewählt)");
  pruef(await p.evaluate(() => /Küche · \d/.test(document.getElementById("spEdit").textContent)), name + ": S1 — im Blatt steht das Maß weiter als Text");
  g = await griffMitte(p, "raum");
  await zug(p, cdp, g, plus(g, await versatz(p, 0.6, 0)));
  const dim = await p.evaluate(() => [...document.querySelectorAll("#spSvg .sp-raumdim")].map(e => e.textContent));
  pruef(dim.length === 1 && /^\d+(,\d)? × \d+(,\d)? m$/.test(dim[0]), name + ": S1 — beim Raum-Griff steht das Raummaß unter DIESEM Raumnamen", dim.join(" | "));
  await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0]; r.b = 12; r.t = 9; r.kueche = { x: 0.2, y: 0.2, b: 2.6, t: 1.8 }; r.theken = [{ x: 2.5, y: 7.6, b: 7, t: 0.8 }]; SAAL.konfigEntwurf.raeume[0] = saalRaum(r); SAAL.ding = null; SAAL.massBis = 0; saalNeuBauen(); saalAlles(false); });

  /* 7 · S2: Drehen um 90° */
  pruef(await p.evaluate(() => !document.querySelector('#spSvg [data-sp-griff^="drehen:"]')), name + ": S2 — ohne gewählte Sache kein Drehen-Knopf");
  let kz = await p.evaluate(() => { const k = SAAL.konfigEntwurf.raeume[0].kueche; return window.__bild(k.x + k.b * 0.5, k.y + k.t * 0.35, SAAL_BODEN + 1.57); });
  await zug(p, cdp, kz, kz);
  const dg = await p.evaluate(() => { const e = document.querySelector('#spSvg [data-sp-griff="drehen:kueche"] .sp-griff-treffer'); if(!e) return null; const r = e.getBoundingClientRect(); return { w:r.width, x:r.left + r.width / 2, y:r.top + r.height / 2, oben:!!(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) || { closest:() => null }).closest('[data-sp-griff="drehen:kueche"]') }; });
  pruef(dg && Math.round(dg.w) >= 44 && dg.oben, name + ": S2 — Küche angetippt → Drehen-Knopf ↻ ≥ 44 px, obenauf", JSON.stringify(dg));
  let k0d = (await raum0(p)).kueche;
  if(dg) await zug(p, cdp, dg, dg);
  let k1d = (await raum0(p)).kueche;
  const mitte = k => [k.x + k.b / 2, k.y + k.t / 2];
  pruef(nah(k1d.b, k0d.t, 1e-6) && nah(k1d.t, k0d.b, 1e-6) && nah(mitte(k1d)[0], mitte(k0d)[0], 0.051) && nah(mitte(k1d)[1], mitte(k0d)[1], 0.051) || (nah(k1d.b, k0d.t, 1e-6) && (k1d.x === 0 || k1d.y === 0)),
    name + ": S2 — ein Tipp auf ↻: Breite und Tiefe getauscht, um die Mitte (oder an die Wand geschoben)", JSON.stringify(k0d) + " → " + JSON.stringify(k1d));
  const kG = await p.evaluate(() => { const e = window.__ecken(document.querySelector("#spSvg .sp-k-kueche .o"), SAAL_BODEN + 1.5); return { b: Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y), t: Math.hypot(e[2].x - e[1].x, e[2].y - e[1].y) }; });
  pruef(nah(kG.b, k1d.b, 0.06) && nah(kG.t, k1d.t, 0.06), name + ": S2 — die gemalte Küche ist gedreht", kG.b.toFixed(2) + " × " + kG.t.toFixed(2));
  /* am Rand: eine 4 × 1 m-Küche in der Ecke dreht sich in den Raum hinein */
  await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0]; r.kueche = { x: 0, y: 0, b: 4, t: 1 }; SAAL.konfigEntwurf.raeume[0] = saalRaum(r); SAAL.ding = "kueche"; saalNeuBauen(); });
  await p.click('#spEdit [data-sp-drehen-knopf="kueche"]');
  const ecke = await p.evaluate(() => ({ k: SAAL.konfigEntwurf.raeume[0].kueche, fokus: document.activeElement && document.activeElement.dataset.spDrehenKnopf,
    h: document.querySelector('#spEdit [data-sp-drehen-knopf="kueche"]').getBoundingClientRect().height }));
  pruef(ecke.k.b === 1 && ecke.k.t === 4 && ecke.k.y === 0 && ecke.k.x >= 0 && ecke.fokus === "kueche" && ecke.h >= 44,
    name + ": S2 — „↻ Drehen“ im Blatt (≥ 44 px): 4 × 1 m in der Ecke wird 1 × 4 m und an die Wand geschoben, der Fokus bleibt", JSON.stringify(ecke));
  /* Tastatur „R“ auf der Theke */
  const th0 = (await raum0(p)).theken[0];
  await p.focus('#spSvg [data-sp-ding="theke:0"]'); await p.keyboard.press("r");
  const th1 = (await raum0(p)).theken[0];
  pruef(nah(th1.b, th0.t, 1e-6) && nah(th1.t, Math.min(th0.b, 9), 1e-6), name + ": S2 — „R“ auf der Theke dreht sie (7 × 0,8 → 0,8 × 7)", JSON.stringify(th0) + " → " + JSON.stringify(th1));
  await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0]; r.b = 12; r.t = 9; r.kueche = { x: 0.2, y: 0.2, b: 2.6, t: 1.8 }; r.theken = [{ x: 2.5, y: 7.6, b: 7, t: 0.8 }]; SAAL.konfigEntwurf.raeume[0] = saalRaum(r); SAAL.ding = null; SAAL.massBis = 0; saalNeuBauen(); saalAlles(false); });

  /* 3 · Theke */
  r0 = await raum0(p);
  g = await griffMitte(p, "theke:0");
  await zug(p, cdp, g, plus(g, await versatz(p, -2.04, 0.33)));
  r1 = await raum0(p);
  pruef(nah(r1.theken[0].b, r0.theken[0].b - 2, 1e-6) && nah(r1.theken[0].t, r0.theken[0].t + 0.3, 1e-6) && r1.theken[0].x === r0.theken[0].x, name + ": Theken-Griff → Länge −2,0 m, Tiefe +0,3 m", JSON.stringify(r0.theken[0]) + " → " + JSON.stringify(r1.theken[0]));
  const tStelle = await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0], t = r.theken[0], a = window.__bild(t.x + t.b * 0.3, t.y + t.t * 0.5, SAAL_BODEN + 1.07), e = document.elementFromPoint(a.x, a.y); return { ...a, ding: !!(e && e.closest('[data-sp-ding="theke:0"]')) }; });
  pruef(tStelle.ding, name + ": Voraussetzung: an der gewählten Stelle liegt die gemalte Theke obenauf");
  await zug(p, cdp, tStelle, plus(tStelle, await versatz(p, -1.04, -0.97)));
  const r2 = await raum0(p);
  pruef(nah(r2.theken[0].x, r1.theken[0].x - 1, 1e-6) && nah(r2.theken[0].y, r1.theken[0].y - 1, 1e-6), name + ": Theke am Körper verschoben (−1,0 / −1,0 m)", JSON.stringify(r2.theken[0]));
  /* Antippen ohne Zug zeigt das Maß */
  const tz = await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0], t = r.theken[0]; return window.__bild(t.x + t.b * 0.3, t.y + t.t * 0.5, SAAL_BODEN + 1.07); });
  await zug(p, cdp, tz, tz);
  const getippt = await p.evaluate(() => ({ ding: SAAL.ding, schild: (document.querySelector("#spSvg .sp-massschild text") || {}).textContent || "" }));
  pruef(getippt.ding === "theke:0" && /^Theke \d/.test(getippt.schild), name + ": Antippen ohne Zug wählt die Theke und zeigt ihr Maß", JSON.stringify(getippt));

  /* Raum: 50-cm-Raster, Kamera bleibt */
  r0 = await raum0(p); kam0 = await p.evaluate(() => JSON.stringify(SAAL.kamera));
  g = await griffMitte(p, "raum");
  await zug(p, cdp, g, plus(g, await versatz(p, 2.3, 1.2)));
  r1 = await raum0(p);
  pruef(nah(r1.b, r0.b + 2.5, 1e-6) && nah(r1.t, r0.t + 1, 1e-6) && imRaster(r1.b, 0.5), name + ": Raum-Griff +2,3/+1,2 m → +2,5/+1,0 m (50-cm-Raster)", r0.b + "×" + r0.t + " → " + r1.b + "×" + r1.t);
  pruef(await p.evaluate(() => JSON.stringify(SAAL.kamera)) === kam0, name + ": die Kamera rahmt während des Zugs nicht neu (sonst liefe der Raum unter dem Finger weg)");
  const boden = await p.evaluate(() => { const e = window.__ecken(document.querySelector('#spSvg .sp-raum[data-sp-raum="Haupt-Raum"] .sp-boden'), SAAL_BODEN); return { b: Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y), t: Math.hypot(e[3].x - e[0].x, e[3].y - e[0].y) }; });
  pruef(nah(boden.b, r1.b, 0.05) && nah(boden.t, r1.t, 0.05), name + ": der gemalte Boden ist so groß", boden.b.toFixed(2) + " × " + boden.t.toFixed(2));
  g = await griffMitte(p, "raum");
  await zug(p, cdp, g, plus(g, await versatz(p, -80, -80)));
  r1 = await raum0(p);
  pruef(r1.b === 2 && r1.t === 2, name + ": kleiner als 2 × 2 m geht nicht", r1.b + "×" + r1.t);
  await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0]; r.b = 12; r.t = 9; r.kueche = { x: 0.2, y: 0.2, b: 2.6, t: 1.8 }; r.theken = [{ x: 2.5, y: 7.6, b: 7, t: 0.8 }]; SAAL.konfigEntwurf.raeume[0] = saalRaum(r); saalNeuBauen(); saalAlles(false); });
  /* Lage im Gebäude */
  g = await griffMitte(p, "raumlage");
  await zug(p, cdp, g, plus(g, await versatz(p, 1.3, 2.2)));
  r1 = await raum0(p);
  pruef(r1.x != null && r1.y != null && imRaster(r1.x, 0.5) && imRaster(r1.y, 0.5) && nah(r1.x, 1.5, 1e-6) && nah(r1.y, 2, 1e-6), name + ": Lage-Griff → Raum steht bei 1,5 / 2,0 m (50-cm-Raster)", r1.x + " / " + r1.y);
  await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0]; r.x = null; r.y = null; SAAL.konfigEntwurf.raeume[0] = saalRaum(r); saalNeuBauen(); saalAlles(false); });

  /* 4 · Tisch: Stühle ziehen */
  await p.click('[data-sp-tab="tische"]'); await planZeigen(p);
  const t8 = await p.evaluate(() => window.__mitte('#spSvg [data-sp-tisch="demo-t8"] .sp-treffer'));
  await zug(p, cdp, t8, t8);
  pruef(await p.evaluate(() => SAAL.gewaehlt === "demo-t8" && !!document.querySelector('#spSvg [data-sp-griff="tisch:demo-t8"]')), name + ": Tisch 8 angetippt → sein Stühle-Griff erscheint");
  const sv = await p.evaluate(() => SAAL.entwurf.get("demo-t8").plaetze);
  g = await griffMitte(p, "tisch:demo-t8");
  /* Ziel in Weltkoordinaten (Bodenhöhe, wie der Zug sie liest): auf der Linie Tisch → Griff 0,95 m weiter hinaus. */
  const raus = await p.evaluate(([gx, gy]) => { const w = saalTischWelt({ ...SAAL.tische.find(t => t.id === "demo-t8"), ...SAAL.entwurf.get("demo-t8") }), q = window.__welt(gx, gy, SAAL_BODEN);
    const d = Math.hypot(q.x - w.X, q.y - w.Y), f = (d + 0.95) / d, h = 0.05 / d;
    return { raus: window.__bild(w.X + (q.x - w.X) * f, w.Y + (q.y - w.Y) * f, SAAL_BODEN), rein: window.__bild(w.X + (q.x - w.X) * h, w.Y + (q.y - w.Y) * h, SAAL_BODEN) }; }, [g.x, g.y]);
  await zug(p, cdp, g, raus.raus);
  const sv2 = await p.evaluate(() => SAAL.entwurf.get("demo-t8").plaetze);
  pruef(sv2 === sv + 3, name + ": 0,9 m hinaus → drei Stühle mehr (je 30 cm einer)", sv + " → " + sv2);
  const stuehle = await p.evaluate(() => document.querySelectorAll('#spSvg [data-sp-tisch="demo-t8"] .sp-k-lehne').length);
  pruef(stuehle === sv2, name + ": so viele Stühle sind gemalt", String(stuehle));
  g = await griffMitte(p, "tisch:demo-t8");
  await zug(p, cdp, g, raus.rein);
  const sv3 = await p.evaluate(() => SAAL.entwurf.get("demo-t8").plaetze);
  pruef(sv3 <= sv2 - 3 && sv3 >= 1, name + ": zur Tischmitte gezogen → mindestens drei Stühle weniger", sv2 + " → " + sv3);
  await p.evaluate(() => { SAAL.entwurf.get("demo-t8").plaetze = 2; saalNeuBauen(); });
  g = await griffMitte(p, "tisch:demo-t8");
  const rein2 = await p.evaluate(([gx, gy]) => { const w = saalTischWelt({ ...SAAL.tische.find(t => t.id === "demo-t8"), ...SAAL.entwurf.get("demo-t8") }); return window.__bild(w.X, w.Y, SAAL_BODEN); }, [g.x, g.y]);
  await zug(p, cdp, g, rein2);
  pruef(await p.evaluate(() => SAAL.entwurf.get("demo-t8").plaetze) === 1, name + ": von zwei Stühlen ganz hinein → einer, nicht weniger");

  /* 5 · Gemalte Küche schlägt die Trefferfläche eines Tisches daneben */
  await p.click('[data-sp-tab="masse"]'); await planZeigen(p);
  const kandidat = await p.evaluate(() => {
    const r = SAAL.konfigEntwurf.raeume[0], k = r.kueche, v = SAAL.entwurf.get("demo-t1");
    /* Tisch 1 dicht vor die Küche */
    v.x = Math.round((k.x + k.b + 0.25) / r.b * 100); v.y = Math.round((k.y + k.t * 0.5) / r.t * 100); saalNeuBauen();
    for(let i = 0; i <= 20; i++) for(let j = 0; j <= 20; j++){
      const a = window.__bild(k.x + k.b * i / 20, k.y + k.t * j / 20, SAAL_BODEN + 1.57), e = document.elementFromPoint(a.x, a.y);
      if(e && e.closest(".sp-treffer") && e.closest('[data-sp-tisch="demo-t1"]') && document.elementsFromPoint(a.x, a.y).some(x => x.closest('[data-sp-ding="kueche"]'))) return { ...a, k: { ...k }, t: { x: v.x, y: v.y } };
    }
    return null;
  });
  pruef(!!kandidat, name + ": Voraussetzung: es gibt eine Stelle, an der die Trefferfläche von Tisch 1 über der gemalten Küche liegt");
  if(kandidat){
    await zug(p, cdp, kandidat, plus(kandidat, await versatz(p, 0, 1.0)));
    const nach = await p.evaluate(() => ({ k: SAAL.konfigEntwurf.raeume[0].kueche, t: { x: SAAL.entwurf.get("demo-t1").x, y: SAAL.entwurf.get("demo-t1").y } }));
    pruef(nah(nach.k.y, kandidat.k.y + 1, 1e-6) && nach.t.x === kandidat.t.x && nach.t.y === kandidat.t.y, name + ": dort gezogen bewegt sich die Küche, nicht der Tisch", JSON.stringify(nach));
  }
  /* Tastatur */
  await p.focus('#spSvg [data-sp-griff="kueche"]');
  const vorT = (await raum0(p)).kueche.b;
  await p.keyboard.press("ArrowRight");
  const nachT = await p.evaluate(() => ({ b: SAAL.konfigEntwurf.raeume[0].kueche.b, fokus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.spGriff : null }));
  pruef(nah(nachT.b, vorT + 0.1, 1e-6) && nachT.fokus === "kueche", name + ": Pfeil rechts auf dem Griff → +0,1 m, der Fokus bleibt auf dem Griff", vorT + " → " + JSON.stringify(nachT));
  /* Felder: offen bleibt offen, auch nach einem Zug */
  await p.click("#spEdit [data-sp-genau] > summary");
  await planZeigen(p);
  g = await griffMitte(p, "kueche");
  await zug(p, cdp, g, plus(g, await versatz(p, 0.31, 0)));
  const offen = await p.evaluate(() => ({ offen: document.querySelector("#spEdit [data-sp-genau]").open, wert: (document.querySelector('#spEdit [data-sp-kf="b"]') || {}).value, b: SAAL.konfigEntwurf.raeume[0].kueche.b }));
  pruef(offen.offen && offen.wert === String(offen.b).replace(".", ","), name + ": aufgeklappte Felder bleiben nach einem Zug offen und zeigen das gezogene Maß", JSON.stringify(offen));
  /* Speichern trägt die gezogenen Werte */
  await p.evaluate(() => { window.__rpc = []; demo = false; betriebId = "b-1";
    db = { rpc: (fn, a) => { window.__rpc.push({ fn, a: JSON.parse(JSON.stringify(a)) }); return Promise.resolve({ data: { ok: true }, error: null }); },
           from: () => { const o = { update: () => o, eq: () => o, select: () => Promise.resolve({ data: [{ id: "x" }], error: null }) }; return o; } }; });
  const vorSpeichern = await raum0(p);
  await p.click("[data-sp-speichern]"); await p.waitForTimeout(300);
  const a = await p.evaluate(() => (window.__rpc.find(x => x.fn === "saal_einstellungen_setzen") || {}).a);
  pruef(a && JSON.stringify(a.p_daten.raeume[0].kueche) === JSON.stringify(vorSpeichern.kueche) && JSON.stringify(a.p_daten.raeume[0].theken) === JSON.stringify(vorSpeichern.theken), name + ": „Speichern“ schickt genau die gezogenen Maße", a ? JSON.stringify(a.p_daten.raeume[0].kueche) : "kein Aufruf");
  pruef(pf.length === 0, name + ": kein Seitenfehler", pf.join(" | "));
  await ctx.close();
}

(async () => {
  const br = await chromium.launch();
  await fahren(br, 1280, 860, false);
  await fahren(br, 390, 844, true);

  /* ── 6 · Bild ─────────────────────────────────────────────────── */
  for(const farbe of ["dark", "light"]){
    console.log("\n══ Bild · " + (farbe === "dark" ? "dunkel" : "hell") + " ══");
    const { ctx, p, pf } = await neu(br, 1280, 860, { colorScheme: farbe });
    if(farbe === "light") await p.evaluate(() => { document.body.classList.add("hell"); SAAL.sig = ""; saalZeichnen(); });
    await p.evaluate(() => { const vor = m => new Date(Date.now() - m * 60000).toISOString();
      bestellungen.length = 0;
      bestellungen.push({ id: "x1", quelle: "service", status: "neu", tisch: "4", zeitpunkt: vor(1), notiz: "Rechnung bitte", positionen: [], summe: 0 },
        { id: "x6", quelle: "tisch", status: "neu", tisch: "6", pruefen: true, pruef_grund: "Zahlung offen", zeitpunkt: vor(12), positionen: [{ name: "E", menge: 1, preis: 5 }], summe: 5 },
        { id: "x2", quelle: "tisch", status: "arbeit", tisch: "2", zeitpunkt: vor(12), positionen: [{ name: "C", menge: 1, preis: 5 }], summe: 5 });
      bekannt.clear(); bestellungen.forEach(b => bekannt.add(b.id)); SAAL.sig = ""; zeichneAlles(); });
    await p.waitForTimeout(300);
    const ring = await p.evaluate(() => {
      const verlauf = document.querySelectorAll("#spSvg radialGradient, #spSvg ellipse.sp-glow").length;
      const l = [...document.querySelectorAll("#spSvg .sp-glow")].map(g => {
        const t = g.closest("[data-sp-tisch]"), id = t.dataset.spTisch, roh = SAAL.tische.find(x => x.id === id), w = saalTischWelt(roh);
        const kasten = l => ({ x0: Math.min(...l.map(q => q.x)), x1: Math.max(...l.map(q => q.x)), y0: Math.min(...l.map(q => q.y)), y1: Math.max(...l.map(q => q.y)) });
        const ri = kasten(window.__ecken(g, SAAL_BODEN + 0.05 * SAAL_M));
        const st = kasten([...t.querySelectorAll(".sp-k-stuhl .o, .sp-k-lehne .o")].flatMap(o => window.__ecken(o, SAAL_BODEN + (o.closest(".sp-k-lehne") ? 6.8 : 3.6) * SAAL_M)));
        /* Ring umschließt die Stühle und liegt höchstens 0,3 m außerhalb */
        const ueber = Math.max(st.x0 - ri.x0, ri.x1 - st.x1, st.y0 - ri.y0, ri.y1 - st.y1), innen = Math.min(st.x0 - ri.x0, ri.x1 - st.x1, st.y0 - ri.y0, ri.y1 - st.y1);
        return { id, deck: +g.getAttribute("fill-opacity"), strich: +g.getAttribute("stroke-width"), ueber, innen };
      });
      return { verlauf, l };
    });
    pruef(ring.verlauf === 0 && ring.l.length >= 2, "kein Verlauf und keine Glüh-Ellipse mehr; Stand als Ring an " + ring.l.length + " Tischen");
    pruef(ring.l.every(r => r.deck <= 0.16 && r.strich <= 2.4), "jeder Ring ist dezent (Deckkraft ≤ 0,16, Strich ≤ 2,4 px)", ring.l.map(r => r.id + ":" + r.deck + "/" + r.strich).join(" "));
    pruef(ring.l.every(r => r.innen >= -0.02 && r.ueber <= 0.3), "der Ring umschließt die Stühle und liegt höchstens 0,3 m außerhalb (nicht über halbe Räume)", ring.l.map(r => r.id + ":" + r.innen.toFixed(2) + "…" + r.ueber.toFixed(2)).join(" "));
    const st = await p.evaluate(() => SAAL.tische.filter(t => t.aktiv && t.x != null).map(t => {
      const g = document.querySelector('#spSvg [data-sp-tisch="' + t.id + '"]'), sitze = [...g.querySelectorAll(".sp-k-stuhl .o")].map(o => window.__ecken(o, SAAL_BODEN + 3.6 * SAAL_M));
      const mitten = sitze.map(e => ({ x: (e[0].x + e[2].x) / 2, y: (e[0].y + e[2].y) / 2 }));
      let nah = 9; mitten.forEach((a, i) => mitten.forEach((b, j) => { if(i < j) nah = Math.min(nah, Math.hypot(a.x - b.x, a.y - b.y)); }));
      const seite = sitze.length ? Math.hypot(sitze[0][1].x - sitze[0][0].x, sitze[0][1].y - sitze[0][0].y) : 0;
      return { id: t.id, n: sitze.length, pl: t.plaetze, nah, seite };
    }));
    pruef(st.every(s => s.n === s.pl), "an jedem Tisch so viele Stühle wie Plätze", st.map(s => s.id.slice(6) + ":" + s.n + "/" + s.pl).join(" "));
    pruef(st.every(s => nah(s.seite, 0.425, 0.03)), "Stuhl 0,42 × 0,42 m (am gemalten Sitz)", [...new Set(st.map(s => s.seite.toFixed(2)))].join(" "));
    pruef(st.every(s => s.n < 2 || s.nah >= 0.45), "kein Stuhl steht im anderen (Mitten ≥ 0,45 m auseinander)", st.map(s => s.nah.toFixed(2)).join(" "));
    /* Ein langer Tisch mit 10 Stühlen wächst mit */
    const zehn = await p.evaluate(() => { const t = SAAL.tische.find(x => x.id === "demo-t4"); t.plaetze = 10; SAAL.sig = ""; saalZeichnen();
      const g = document.querySelector('#spSvg [data-sp-tisch="demo-t4"]'), e = window.__ecken(g.querySelector(".sp-oben"), SAAL_BODEN + SAAL_TISCH_H);
      const mitten = [...g.querySelectorAll(".sp-k-stuhl .o")].map(o => window.__ecken(o, SAAL_BODEN + 3.6 * SAAL_M)).map(e => ({ x: (e[0].x + e[2].x) / 2, y: (e[0].y + e[2].y) / 2 }));
      let nah = 9; mitten.forEach((a, i) => mitten.forEach((b, j) => { if(i < j) nah = Math.min(nah, Math.hypot(a.x - b.x, a.y - b.y)); }));
      t.plaetze = 6; SAAL.sig = ""; saalZeichnen();
      return { lang: Math.max(Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y), Math.hypot(e[2].x - e[1].x, e[2].y - e[1].y)), nah, n: mitten.length }; });
    pruef(zehn.n === 10 && zehn.lang >= 2.6 && zehn.nah >= 0.5, "langer Tisch mit 10 Stühlen wird länger (≥ 2,6 m), die Stühle bleiben auseinander", JSON.stringify(zehn));
    const bodenFarbe = await p.evaluate(() => getComputedStyle(document.querySelector("#spSvg .sp-boden")).fill);
    const bf = bodenFarbe.match(/\d+/g).map(Number);
    pruef(bf[0] >= bf[2] + 12, "der Boden ist warm (Holz), nicht blaugrau", bodenFarbe);
    /* Im Einrichten (Tische) kein Stand, im Reiter „Stufen“ die Vorschau */
    await p.click('[data-sp-wz="einrichten"]');
    const ruhig = await p.evaluate(() => document.querySelectorAll("#spSvg .sp-glow, #spSvg .sp-abz").length);
    await p.click('[data-sp-tab="stufen"]');
    const vorschau = await p.evaluate(() => document.querySelectorAll("#spSvg .sp-glow").length);
    pruef(ruhig === 0 && vorschau >= 2, "Einrichten: ohne Ring und Abzeichen — im Reiter „Stufen“ zeigt der Plan die Vorschau", ruhig + " / " + vorschau);
    /* Kontrast: Maßschild und Griff */
    await p.click('[data-sp-tab="masse"]');
    /* Das Schild steht seit S1 nur kurz nach einem Zug da — für die Farbmessung so gestellt. */
    await p.evaluate(() => { SAAL.ding = "kueche"; SAAL.massBis = Date.now() + 60000; saalNeuBauen(); });
    const k = await p.evaluate(() => { const r = document.querySelector("#spSvg .sp-massschild rect"), t = document.querySelector("#spSvg .sp-massschild text"), pu = document.querySelector('#spSvg [data-sp-griff="raum"] .sp-griff-punkt'), z = document.querySelector('#spSvg [data-sp-griff="raum"] .sp-griff-zeichen');
      return { r: getComputedStyle(r).fill, t: getComputedStyle(t).fill, pu: getComputedStyle(pu).fill, z: getComputedStyle(z).stroke }; });
    pruef(kontrast(k.r, k.t) >= 4.5 && kontrast(k.pu, k.z) >= 4.5, "Maßschild und Griff ≥ 4,5:1", kontrast(k.r, k.t).toFixed(1) + " / " + kontrast(k.pu, k.z).toFixed(1));
    pruef(pf.length === 0, "kein Seitenfehler", pf.join(" | "));
    await ctx.close();
  }
  /* Telefon, ganzer Raum: keine Belegungsschilder; herangezoomt wieder da */
  {
    console.log("\n══ Telefon: enge Darstellung ══");
    const { ctx, p } = await neu(br, 390, 844);
    const eng = await p.evaluate(() => ({ eng: document.getElementById("spBuehne").classList.contains("eng"), pxm: SAAL.kamera.k * SAAL_U,
      sichtbar: [...document.querySelectorAll("#spSvg .sp-bel")].filter(g => g.getClientRects().length && getComputedStyle(g).display !== "none").length, alle: document.querySelectorAll("#spSvg .sp-bel").length }));
    pruef(eng.alle >= 1 && eng.eng && eng.sichtbar === 0, "390 px, ganzer Raum (" + eng.pxm.toFixed(1) + " px/m): Belegungsschilder ausgeblendet (Voraussetzung: es gibt welche)", JSON.stringify(eng));
    await p.evaluate(() => saalZoomUm(3, null, null, false));
    const nah2 = await p.evaluate(() => ({ eng: document.getElementById("spBuehne").classList.contains("eng"), pxm: SAAL.kamera.k * SAAL_U, sichtbar: [...document.querySelectorAll("#spSvg .sp-bel")].filter(g => getComputedStyle(g).display !== "none").length }));
    pruef(!nah2.eng && nah2.sichtbar >= 1, "herangezoomt (" + nah2.pxm.toFixed(1) + " px/m) sind sie wieder da", JSON.stringify(nah2));
    await ctx.close();
  }
  await br.close();
  console.log(fehler ? "\n" + fehler + " FEHLER" : "\nalles grün");
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
