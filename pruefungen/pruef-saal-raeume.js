/* ═════════════════════════════════════════════════════════════════════
   PRÜFUNG · Der Saalplan mit echten Maßen: Räume in Metern, Theke,
   Gebäude, Rauszoomen, Lieferauto

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-saal-raeume.js
     (Gegenbeweise: ADMIN_DATEI=<Kopie von admin.html>)

   Wunsch 25.10.: „Bei den Einstellungen der Tische und Räume die Metermaße
   eintragen, das Programm erstellt den Raum und unterteilt ihn in 1×1-m-
   Kästchen, so sieht der Raum auf der Grafik aus wie der echte. Dann noch
   eine Bar/Theke, die Gebäudeumrandung, rauszoomen und das ganze Gebäude
   sehen — mit den jeweiligen Bestellungen. Daneben ein hochauflösendes
   smartes Lieferauto; drauf tippen zeigt alle Lieferungen.“

   Gemessen wird am GEMALTEN Bild (§8.1e): Ecken der Bodenfläche, Abstand
   der Rasterlinien, Kanten der Tischplatten werden aus dem SVG über die
   Bildschirmmatrix zurück in Meter gerechnet — mit einer EIGENEN Umkehr
   der Projektion (zweite Quelle, nicht saalWelt()).

   1 · RAUM IN METERN. Boden = Breite × Tiefe, ein Raster-Abstand = 1 m,
       Linienzahl stimmt, Tische haben echte Maße (rund Ø 1,05 · lang
       1,75 × 0,8 · eckig 1,1 × 1,1), Theke mit ihrem Maß nur im eigenen Raum.
   2 · GEBÄUDE. Umriss umschließt alle Räume; die Räume liegen ohne Überlappung;
       Kamera: Raum ganz im Bild · Gebäude ganz im Bild (mit Auto und Straße) ·
       Mausrad bis zur Gebäudegrenze · jeder eingezeichnete Tisch mit seinem
       Abzeichen im Gebäudebild · Tipp auf Boden/Schild/Tisch eines anderen
       Raums wechselt dorthin.
   3 · EINRICHTEN. Reiter „Maße“: Zahl rein → Boden wächst sofort (gemessen),
       Unsinn/zu klein/zu groß ändert nichts und das Feld springt zurück;
       Theke anlegen/entfernen (an den Raum geklemmt); Lage im Gebäude;
       Tische ziehen im eigenen Raum (Zeiger = gemalter Tisch, Rand klemmt);
       Bereich anlegen/entfernen zieht die Räume nach; Nutzlast genau
       b,t,x,y,theken; ohne Maße kein Schlüssel „raeume“ (alter Weg bleibt
       gangbar); fehlende Migration → Satz; Neuladen zeigt den Stand (§8.1m);
       Tische wandern anteilig mit.
   4 · LIEFERAUTO. Steht im Vorführhaus und bei Häusern mit Lieferung, bei
       anderen nicht; Schild zählt Lieferungen (Abholungen nicht); echter
       Tipp zeigt genau diese Karten im Blatt, zweiter Tipp hebt auf;
       Tastatur; reduzierte Bewegung: nichts läuft.
   ═════════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const ADMIN = "file://" + (process.env.ADMIN_DATEI ? path.resolve(process.env.ADMIN_DATEI) : path.join(__dirname, "..", "seiten", "admin.html"));

let fehler = 0;
const pruef = (g, t, z) => { console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined && z !== "" ? "  → " + z : "")); if(!g) fehler++; };
const nah = (a, b, tol) => Math.abs(a - b) <= tol;

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
  /* Hilfen im Seitenkontext: EIGENE Umkehr der Projektion (zweite Quelle) */
  await p.evaluate(() => {
    window.__welt = (cx, cy, z) => {
      const r = document.getElementById("spBuehne").getBoundingClientRect(), c = SAAL.kamera;
      const px = (cx - r.left - c.tx) / c.k, py = (cy - r.top - c.ty) / c.k + z * SAAL_U;
      const a = px / (SAAL_C * SAAL_U), b = py / (0.5 * SAAL_U);
      return { x: (a + b) / 2, y: (b - a) / 2 };
    };
    window.__ecken = (el, z) => {
      const svg = document.getElementById("spSvg"), m = el.getScreenCTM();
      return [...el.points].map(pt => { const q = svg.createSVGPoint(); q.x = pt.x; q.y = pt.y; const w = q.matrixTransform(m); return window.__welt(w.x, w.y, z); });
    };
    window.__fest = () => new Promise(f => setTimeout(f, 700));
  });
  return { ctx, p, pf };
}
/* Gestellte Lage: Uhr und Bestellungen fest (§8.1j) */
async function stelle(p){
  await p.evaluate(() => {
    const vor = m => new Date(Date.now() - m * 60000).toISOString();
    bestellungen.length = 0;
    bestellungen.push(
      { id: "x1", quelle: "service", status: "neu", tisch: "4", zeitpunkt: vor(1), notiz: "Rechnung bitte", positionen: [], summe: 0 },
      { id: "x2", quelle: "tisch", status: "neu", tisch: "10", zeitpunkt: vor(8), positionen: [{ name: "A", menge: 1, preis: 5 }], summe: 5 },
      { id: "x3", quelle: "tisch", status: "neu", tisch: "7", zeitpunkt: vor(1), positionen: [{ name: "B", menge: 1, preis: 5 }], summe: 5 },
      { id: "x4", quelle: "tisch", status: "arbeit", tisch: "2", zeitpunkt: vor(12), positionen: [{ name: "C", menge: 1, preis: 5 }], summe: 5 },
      { id: "x5", quelle: "tisch", status: "arbeit", tisch: "3", zeitpunkt: vor(15), kueche_fertig_um: vor(1), positionen: [{ name: "D", menge: 1, preis: 5 }], summe: 5 },
      { id: "x6", quelle: "tisch", status: "neu", tisch: "6", pruefen: true, pruef_grund: "Zahlung offen", zeitpunkt: vor(12), positionen: [{ name: "E", menge: 1, preis: 5 }], summe: 5 },
      { id: "x7", quelle: "lieferung", status: "neu", zeitpunkt: vor(2), liefer_adresse: { name: "Frau Test" }, positionen: [{ name: "F", menge: 1, preis: 5 }], summe: 5 },
      { id: "x8", quelle: "lieferung", abholung: true, status: "neu", zeitpunkt: vor(2), positionen: [{ name: "G", menge: 1, preis: 5 }], summe: 5 },
      { id: "x9", quelle: "tisch", status: "fertig", tisch: "8", zeitpunkt: vor(30), kueche_fertig_um: vor(25), gebracht_um: vor(20), positionen: [{ name: "H", menge: 1, preis: 5 }], summe: 5 }
    );
    bekannt.clear(); bestellungen.forEach(b => bekannt.add(b.id));
    zeigeStatus.fertig = false;
    SAAL.sig = ""; zeichneAlles();
  });
  await p.waitForTimeout(250);
}
const boden = (p, zone) => p.evaluate(z => {
  const el = document.querySelector('#spSvg .sp-raum[data-sp-raum="' + z + '"] .sp-boden');
  return el ? window.__ecken(el, SAAL_BODEN) : null;
}, zone);
const seitenlaenge = e => ({ b: Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y), t: Math.hypot(e[3].x - e[0].x, e[3].y - e[0].y) });
const imBild = (p, sel) => p.evaluate(s => {
  const b = document.getElementById("spBuehne").getBoundingClientRect();
  const l = [...document.querySelectorAll(s)];
  return { n: l.length, aus: l.filter(g => { const r = g.getBoundingClientRect(); return r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1; }).length };
}, sel);

(async () => {
  const br = await chromium.launch();

  /* ── 1 · Raum in Metern ────────────────────────────────────────── */
  console.log("\n══ Raum in Metern: Boden, Raster, Tische, Theke ══");
  {
    const { ctx, p, pf } = await neu(br, 1280, 860);
    await stelle(p);
    const e1 = await boden(p, "Haupt-Raum"), e2 = await boden(p, "Terrasse");
    pruef(e1 && e2, "Voraussetzung: beide Böden sind gezeichnet");
    const s1 = seitenlaenge(e1), s2 = seitenlaenge(e2);
    pruef(nah(s1.b, 12, 0.05) && nah(s1.t, 9, 0.05), "Haupt-Raum: der gemalte Boden ist 12 × 9 m", s1.b.toFixed(2) + " × " + s1.t.toFixed(2));
    pruef(nah(s2.b, 8, 0.05) && nah(s2.t, 5, 0.05), "Terrasse: der gemalte Boden ist 8 × 5 m", s2.b.toFixed(2) + " × " + s2.t.toFixed(2));
    pruef(nah(e1[1].x - e1[0].x, 12, 0.05) && nah(e1[1].y - e1[0].y, 0, 0.05), "Breite läuft in die x-Richtung, Tiefe in die y-Richtung (rechtwinklig)");
    /* Raster: Abstand der Linien = 1 m, Zahl der Linien */
    const raster = await p.evaluate(() => {
      const g = document.querySelector('#spSvg .sp-raum[data-sp-raum="Haupt-Raum"]'), svg = document.getElementById("spSvg");
      const pfade = [...g.querySelectorAll(".sp-gitter")];
      const linien = [];
      pfade.forEach(pf => {
        const m = pf.getScreenCTM(), re = /M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g; let t;
        while((t = re.exec(pf.getAttribute("d")))){
          const mk = (x, y) => { const q = svg.createSVGPoint(); q.x = +x; q.y = +y; const w = q.matrixTransform(m); return window.__welt(w.x, w.y, SAAL_BODEN); };
          linien.push([mk(t[1], t[2]), mk(t[3], t[4])]);
        }
      });
      return linien;
    });
    const senkr = raster.filter(l => nah(l[0].x, l[1].x, 0.02)).map(l => l[0].x).sort((a, b) => a - b);
    const waager = raster.filter(l => nah(l[0].y, l[1].y, 0.02)).map(l => l[0].y).sort((a, b) => a - b);
    pruef(raster.length === 19 && senkr.length === 11 && waager.length === 8, "12 × 9 m: 11 + 8 Rasterlinien (die Ränder sind der Boden selbst)", raster.length + " Linien (" + senkr.length + " + " + waager.length + ")");
    pruef(senkr.every((x, i) => i === 0 || nah(x - senkr[i - 1], 1, 0.02)) && waager.every((y, i) => i === 0 || nah(y - waager[i - 1], 1, 0.02)), "jedes Kästchen ist 1 × 1 m (Abstand zwischen Nachbarlinien)", "x: " + senkr.slice(0, 3).map(v => v.toFixed(2)).join(" ") + " …");
    pruef(nah(senkr[0], e1[0].x + 1, 0.02) && nah(waager[0], e1[0].y + 1, 0.02), "die erste Linie liegt 1 m vom Rand");
    const f5 = await p.evaluate(() => document.querySelectorAll('#spSvg .sp-raum[data-sp-raum="Haupt-Raum"] .sp-gitter.f').length);
    pruef(f5 === 1, "jede fünfte Linie ist kräftiger (zusammen in EINEM Pfad, nicht hundert Elemente)", String(f5));
    /* Tische: echte Maße der Platten (Kante aus dem gemalten Bild) */
    const platte = nr => p.evaluate(n => {
      const g = document.querySelector('#spSvg [data-sp-tisch="demo-t' + n + '"]'), t = g && g.querySelector("polygon[fill-opacity]");
      return t ? window.__ecken(t, SAAL_BODEN + 5.1 * SAAL_M) : null;
    }, nr);
    const lang = await platte(4), eckig = await platte(2), rund = await platte(3);
    if(lang){ const a = Math.hypot(lang[1].x - lang[0].x, lang[1].y - lang[0].y), b = Math.hypot(lang[2].x - lang[1].x, lang[2].y - lang[1].y);
      pruef(nah(Math.max(a, b), 1.75, 0.06) && nah(Math.min(a, b), 0.8, 0.06), "Tisch 4 (lang): Platte 1,75 × 0,8 m", a.toFixed(2) + " × " + b.toFixed(2)); }else pruef(false, "Tisch 4 hat keine gemalte Platte");
    if(eckig){ const a = Math.hypot(eckig[1].x - eckig[0].x, eckig[1].y - eckig[0].y), b = Math.hypot(eckig[2].x - eckig[1].x, eckig[2].y - eckig[1].y);
      pruef(nah(a, 1.1, 0.06) && nah(b, 1.1, 0.06), "Tisch 2 (eckig): Platte 1,1 × 1,1 m", a.toFixed(2) + " × " + b.toFixed(2)); }else pruef(false, "Tisch 2 hat keine gemalte Platte");
    if(rund){ let d = 0; rund.forEach(a => rund.forEach(b => { d = Math.max(d, Math.hypot(a.x - b.x, a.y - b.y)); }));
      pruef(nah(d, 1.05, 0.06), "Tisch 3 (rund): Durchmesser der Platte 1,05 m", d.toFixed(2)); }else pruef(false, "Tisch 3 hat keine gemalte Platte");
    /* Tische stehen an ihrem Anteil des Raumes */
    const lage = await p.evaluate(() => {
      const r = document.querySelector('#spSvg [data-sp-tisch="demo-t2"] polygon[fill-opacity]'), e = window.__ecken(r, SAAL_BODEN + 5.1 * SAAL_M);
      return { x: (e[0].x + e[2].x) / 2, y: (e[0].y + e[2].y) / 2, t: SAAL.tische.find(t => t.id === "demo-t2") };
    });
    const e1o = e1[0];
    pruef(nah(lage.x, e1o.x + lage.t.x / 100 * 12, 0.08) && nah(lage.y, e1o.y + lage.t.y / 100 * 9, 0.08), "Tisch 2 steht bei " + lage.t.x + " % × " + lage.t.y + " % des Raumes (= " + (lage.t.x / 100 * 12).toFixed(1) + " × " + (lage.t.y / 100 * 9).toFixed(1) + " m vom Eck)", lage.x.toFixed(2) + " / " + lage.y.toFixed(2));
    /* Theke */
    const th = await p.evaluate(() => [...document.querySelectorAll("#spSvg .sp-theke")].map(g => ({ label: g.getAttribute("aria-label"), raum: g.closest ? null : null, text: !!g.querySelector(".sp-thekentext") })));
    pruef(th.length === 1 && /Theke, 7 mal 0,8 Meter/.test(th[0].label), "eine Theke, 7 × 0,8 m (nur im Haupt-Raum, die Terrasse hat keine)", JSON.stringify(th.map(t => t.label)));
    const thWelt = await p.evaluate(() => {
      const o = [...document.querySelectorAll("#spSvg .sp-k-thekeoben polygon.o")][0];
      return window.__ecken(o, SAAL_BODEN + 1.07);
    });
    const tw = Math.hypot(thWelt[1].x - thWelt[0].x, thWelt[1].y - thWelt[0].y), td = Math.hypot(thWelt[2].x - thWelt[1].x, thWelt[2].y - thWelt[1].y);
    pruef(nah(tw, 7.12, 0.06) && nah(td, 0.92, 0.06), "die Theke ist gemalt 7 × 0,8 m (mit 6 cm Überstand der Platte)", tw.toFixed(2) + " × " + td.toFixed(2));
    pruef(nah(thWelt[0].x, e1o.x + 2.5 - 0.06, 0.06) && nah(thWelt[0].y, e1o.y + 7.6 - 0.06, 0.06), "und steht 2,5 m von links, 7,6 m von hinten im Raum", thWelt[0].x.toFixed(2) + "/" + thWelt[0].y.toFixed(2));
    const hocker = await p.evaluate(() => document.querySelectorAll("#spSvg .sp-k-hocker").length);
    pruef(hocker === 7, "sieben Hocker an einer 7-m-Theke (je 0,9 m)", String(hocker));
    pruef(pf.length === 0, "kein Seitenfehler", pf.join(" | "));
    await ctx.close();
  }

  /* ── 2 · Gebäude, Rauszoomen, Bestellungen im Gesamtbild ───────── */
  console.log("\n══ Gebäude: Umriss, Rauszoomen, alle Bestellungen ══");
  for(const [breite, hoehe] of [[1280, 860], [390, 844]]){
    const { ctx, p, pf } = await neu(br, breite, hoehe);
    await stelle(p);
    const e1 = await boden(p, "Haupt-Raum"), e2 = await boden(p, "Terrasse");
    /* Die Räume liegen nebeneinander, ohne sich zu berühren */
    pruef(e2[0].x - (e1[0].x + 12) >= 1.99 && nah(e2[0].y, e1[0].y, 0.05), breite + " px: Terrasse liegt 2 m rechts neben dem Haupt-Raum (automatisch, keine Überlappung)", (e2[0].x - e1[0].x - 12).toFixed(2) + " m Abstand");
    const flur = await p.evaluate(() => { const el = document.querySelector("#spSvg polygon.sp-flur"); return window.__ecken(el, 0); });
    const innen = [e1, e2].every(e => e.every(c => c.x >= flur[0].x - 0.01 && c.x <= flur[1].x + 0.01 && c.y >= flur[0].y - 0.01 && c.y <= flur[3].y + 0.01));
    pruef(innen, breite + " px: die Gebäudeumrandung umschließt beide Räume (am gemalten Umriss)", "x " + flur[0].x.toFixed(1) + "…" + flur[1].x.toFixed(1) + ", y " + flur[0].y.toFixed(1) + "…" + flur[3].y.toFixed(1));
    const waende = await p.evaluate(() => ({ hoch: document.querySelectorAll("#spSvg .sp-k-mauerhoch").length, niedrig: document.querySelectorAll("#spSvg .sp-k-mauer").length }));
    pruef(waende.hoch === 2 && waende.niedrig === 2, breite + " px: hohe Rückwände (2) und niedrige Vorderwände (2) — nichts verdeckt Tische von vorn", JSON.stringify(waende));
    /* Rahmung: Raum, dann Gebäude */
    const k = await p.evaluate(() => ({ k: SAAL.kamera.k, passt: SAAL.passt, geb: SAAL.passtGeb }));
    pruef(k.geb < k.passt * 0.95, breite + " px: das ganze Gebäude braucht einen kleineren Zoom als der Raum", k.geb.toFixed(3) + " < " + k.passt.toFixed(3));
    const raumBild = await imBild(p, '#spSvg [data-sp-tisch] .sp-koerper');
    const hier = await p.evaluate(() => { const b = document.getElementById("spBuehne").getBoundingClientRect(); return [...document.querySelectorAll("#spSvg [data-sp-tisch]")].filter(g => g.dataset.zone === SAAL.zone).filter(g => { const r = g.querySelector(".sp-koerper").getBoundingClientRect(); return r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1; }).length; });
    pruef(hier === 0, breite + " px: Raumansicht — jeder Tisch des Raums ganz im Bild", hier + " außerhalb");
    await p.click('[data-sp-wz="gebaeude"]');
    await p.evaluate(() => window.__fest());
    const alle = await imBild(p, "#spSvg [data-sp-tisch] .sp-koerper");
    pruef(alle.n === 11 && alle.aus === 0, breite + " px: „Ganzes Gebäude“ — alle 11 eingezeichneten Tische ganz im Bild", alle.n + " Tische, " + alle.aus + " außerhalb");
    const gb = await p.evaluate(() => Math.abs(SAAL.kamera.k - SAAL.passtGeb) < 0.01);
    pruef(gb, breite + " px: die Kamera steht auf der Gebäude-Rahmung");
    const grund = await imBild(p, "#spSvg .sp-grund");
    pruef(grund.n === 1 && grund.aus === 0, breite + " px: das ganze Gelände samt Straße liegt im Bild", JSON.stringify(grund));
    const auto = await imBild(p, "#spSvg .sp-auto");
    pruef(auto.n === 1 && auto.aus === 0, breite + " px: das Lieferauto liegt im Bild und ist nur einmal da", JSON.stringify(auto));
    /* Bestellungen: jedes Abzeichen im Bild, auch das der Terrasse */
    const abz = await p.evaluate(() => {
      const b = document.getElementById("spBuehne").getBoundingClientRect();
      const mit = [...SAAL.stand.tische].filter(([, v]) => v.haupt && v.haupt !== "sitzt").length;
      /* „Gäste da“ (sitzt) hat ein graues Abzeichen ohne Leuchten — gezählt werden die Tische mit Bedarf: sie tragen ein Leuchten */
      const sicht = [...document.querySelectorAll("#spSvg [data-sp-tisch]")].filter(g => g.querySelector(".sp-glow")).filter(g => { const c = g.querySelector(".sp-abz circle"); if(!c) return false; const r = c.getBoundingClientRect(); return r.left >= b.left && r.right <= b.right && r.top >= b.top && r.bottom <= b.bottom; }).length;
      return { mit, sicht, terrasse: !!document.querySelector('#spSvg [data-sp-tisch="demo-t10"] .sp-abz') };
    });
    pruef(abz.mit === 6 && abz.sicht === 6 && abz.terrasse, breite + " px: im Gebäudebild leuchten alle 6 Tische mit Bedarf (auch Tisch 10 auf der Terrasse)", abz.sicht + " von " + abz.mit);
    /* Einen Tisch eines ANDEREN Raums antippen: die Tische sind im Gebäudebild klein und dicht — der Tipp zoomt in den Raum
       (dort ist jeder Tisch groß genug), gewählt wird erst der nächste Tipp. */
    const t10 = await p.evaluate(() => { const r = document.querySelector('#spSvg [data-sp-tisch="demo-t10"] .sp-treffer').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.click(t10.x, t10.y);
    await p.waitForTimeout(700);
    const w10 = await p.evaluate(() => ({ zone: SAAL.zone, auswahl: SAAL.auswahl, nah: Math.abs(SAAL.kamera.k - SAAL.passt) < 0.02 }));
    pruef(w10.zone === "Terrasse" && w10.auswahl === null && w10.nah, breite + " px: Tipp auf einen Tisch der Terrasse im Gebäudebild zoomt in die Terrasse (noch keine Wahl)", JSON.stringify(w10));
    const t10b = await p.evaluate(() => { const r = document.querySelector('#spSvg [data-sp-tisch="demo-t10"] .sp-treffer').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.click(t10b.x, t10b.y);
    await p.waitForTimeout(500);
    pruef((await p.evaluate(() => SAAL.auswahl)) === "10", breite + " px: dort wählt der nächste Tipp Tisch 10");
    await p.click('[data-sp-wz="alles"]'); await p.evaluate(() => window.__fest());
    /* Tipp auf den Boden eines anderen Raums (nicht auf einen Tisch) */
    await p.click('[data-sp-zone="Haupt-Raum"]'); await p.evaluate(() => window.__fest());
    await p.click('[data-sp-wz="gebaeude"]'); await p.evaluate(() => window.__fest());
    const bo = await p.evaluate(() => {
      /* ein Punkt auf der Terrasse, an dem wirklich der BODEN oben liegt (kein Tisch, kein Schild): Raster über die Fläche absuchen */
      const e = window.__ecken(document.querySelector('#spSvg .sp-raum[data-sp-raum="Terrasse"] .sp-boden'), SAAL_BODEN), c = SAAL.kamera, r = document.getElementById("spBuehne").getBoundingClientRect();
      for(let fy = 0.1; fy < 1; fy += 0.1) for(let fx = 0.1; fx < 1; fx += 0.1){
        const x = e[0].x + fx * 8, y = e[0].y + fy * 5;
        const px = r.left + c.tx + (x - y) * SAAL_C * SAAL_U * c.k, py = r.top + c.ty + ((x + y) * 0.5 * SAAL_U - SAAL_BODEN * SAAL_U) * c.k;
        const el = document.elementFromPoint(px, py);
        if(el && el.classList.contains("sp-boden") && el.closest('[data-sp-raum="Terrasse"]')) return { x: px, y: py };
      }
      /* Auf dem Telefon füllen die Tapflächen der Tische die kleine Terrasse ganz aus: dann zählt die Mitte (jeder Treffer dort führt in denselben Raum) */
      const x = e[0].x + 4, y = e[0].y + 2.5;
      return { x: r.left + c.tx + (x - y) * SAAL_C * SAAL_U * c.k, y: r.top + c.ty + ((x + y) * 0.5 * SAAL_U - SAAL_BODEN * SAAL_U) * c.k, mitte: true };
    });
    const treff = await p.evaluate(b => { const el = document.elementFromPoint(b.x, b.y); return el ? (el.closest("[data-sp-raum]") ? el.closest("[data-sp-raum]").dataset.spRaum : (el.closest("[data-sp-tisch]") ? "TISCH" : el.tagName)) : null; }, bo);
    await p.mouse.click(bo.x, bo.y);
    await p.waitForTimeout(600);
    const nach = await p.evaluate(() => ({ zone: SAAL.zone, nah: Math.abs(SAAL.kamera.k - SAAL.passt) < 0.02 }));
    pruef((treff === "Terrasse" || bo.mitte) && nach.zone === "Terrasse" && nach.nah, breite + " px: Tipp auf den Boden der Terrasse zeigt sie (Kamera rahmt den Raum)", "getroffen: " + treff + (bo.mitte ? " (Mitte, Tapflächen füllen die Terrasse)" : "") + " → " + JSON.stringify(nach));
    /* Schild antippen */
    await p.click('[data-sp-zone="Haupt-Raum"]'); await p.evaluate(() => window.__fest());
    await p.click('[data-sp-wz="gebaeude"]'); await p.evaluate(() => window.__fest());
    const sch = await p.evaluate(() => { const r = document.querySelector('#spSvg .sp-raumschild[data-sp-raum="Terrasse"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.click(sch.x, sch.y);
    await p.waitForTimeout(500);
    pruef((await p.evaluate(() => SAAL.zone)) === "Terrasse", breite + " px: Tipp auf das Schild „Terrasse“ zeigt sie");
    /* Rauszoomen von Hand: bis zur Gebäudegrenze, nicht weiter */
    await p.click('[data-sp-zone="Haupt-Raum"]'); await p.evaluate(() => window.__fest());
    const m = await mitte(p, "#spBuehne");
    await p.mouse.move(m.x, m.y);
    for(let i = 0; i < 14; i++) await p.mouse.wheel(0, 400);
    await p.waitForTimeout(150);
    const klein = await p.evaluate(() => ({ k: SAAL.kamera.k, min: Math.min(SAAL.passt, SAAL.passtGeb) * 0.8, geb: SAAL.passtGeb }));
    pruef(nah(klein.k, klein.min, klein.min * 0.01) && klein.k <= klein.geb, breite + " px: Mausrad zoomt bis über das Gebäude hinaus und bleibt an der Grenze stehen", klein.k.toFixed(3) + " / Grenze " + klein.min.toFixed(3));
    const raus = await imBild(p, "#spSvg [data-sp-tisch] .sp-koerper");
    pruef(raus.n === 11 && raus.aus === 0, breite + " px: ganz herausgezoomt sieht man jeden Tisch", raus.n + " / " + raus.aus + " außerhalb");
    /* Zwei Finger (echter Pinch) bis an die Grenze */
    pruef(pf.length === 0, breite + " px: kein Seitenfehler", pf.join(" | "));
    await ctx.close();
  }

  /* ── 3 · Einrichten: Reiter „Maße“ ─────────────────────────────── */
  console.log("\n══ Einrichten: Maße, Theke, Lage, Tische ziehen, Speichern ══");
  {
    const { ctx, p, pf } = await neu(br, 1440, 900);
    await stelle(p);
    await p.evaluate(() => { window.__rpc = []; window.__antwort = { data: { ok: true }, error: null }; });
    /* Datenbank stellen, damit Speichern messbar ist: Aufrufe festhalten */
    await p.evaluate(() => {
      demo = false;
      db = { rpc: (fn, a) => { window.__rpc.push({ fn, a: JSON.parse(JSON.stringify(a)) }); return Promise.resolve(window.__antwort); },
             from: () => { const o = { update: () => o, eq: () => o, select: () => Promise.resolve({ data: [{ id: "x" }], error: null }) }; return o; } };
      betriebId = "b-1";
    });
    await p.click('[data-sp-wz="einrichten"]');
    pruef(await p.evaluate(() => !!document.querySelector('[data-sp-tab="masse"]')), "der Reiter „Maße“ ist da");
    pruef(await p.evaluate(() => [...document.querySelectorAll(".sp-tabs .aw-seg")].map(b => b.getAttribute("aria-label")).join("|")) === "Tische|Bereiche|Maße von Raum und Theke|Leuchtstufen", "vier Reiter in einer Zeile, jeder mit vollem Namen für Vorleser");
    const tabH = await p.evaluate(() => { const l = [...document.querySelectorAll(".sp-tabs .aw-seg")].map(b => b.getBoundingClientRect()); return { h: Math.min(...l.map(r => r.height)), b: Math.min(...l.map(r => r.width)), zeilen: new Set(l.map(r => Math.round(r.top))).size }; });
    pruef(tabH.h >= 44 && tabH.zeilen === 1, "die Reiter sind ≥ 44 px hoch und stehen in einer Zeile", JSON.stringify(tabH));
    const glider = await p.evaluate(() => { const t = document.querySelector(".sp-tabs"); return { w: parseFloat(getComputedStyle(t, "::before").width), gesamt: t.getBoundingClientRect().width }; });
    pruef(nah(glider.w, (glider.gesamt - 8) / 4, 3), "die Auswahl-Pille ist ein Viertel breit (nicht ein Drittel wie bei drei Reitern)", glider.w.toFixed(1) + " von " + glider.gesamt.toFixed(1));
    await p.click('[data-sp-tab="masse"]');
    const felder = await p.evaluate(() => [...document.querySelectorAll('#spEdit input[data-sp-rm]')].map(i => ({ f: i.dataset.spRm, v: i.value, fs: parseFloat(getComputedStyle(i).fontSize), h: i.getBoundingClientRect().height, ph: i.placeholder })));
    pruef(felder.length === 4 && felder.every(f => f.fs >= 16 && f.h >= 44), "vier Maßfelder (Breite, Tiefe, Lage links/hinten), 16 px, ≥ 44 px hoch", JSON.stringify(felder.map(f => f.f + "=" + f.v)));
    pruef(felder.find(f => f.f === "x").v === "" && felder.find(f => f.f === "x").ph === "0", "Lage leer = automatisch, der Platzhalter nennt den berechneten Wert");
    /* Breite tippen: der Boden wächst sofort (am gemalten Bild) */
    await p.click('#spEdit [data-sp-rm="b"]');
    await p.fill('#spEdit [data-sp-rm="b"]', "15,5");
    await p.waitForTimeout(150);
    const fok = await p.evaluate(() => document.activeElement && document.activeElement.dataset.spRm);
    const b1 = seitenlaenge(await boden(p, "Haupt-Raum"));
    pruef(fok === "b" && nah(b1.b, 15.5, 0.05) && nah(b1.t, 9, 0.05), "„15,5“ in Breite: der gemalte Boden ist sofort 15,5 × 9 m, das Feld behält den Fokus", b1.b.toFixed(2) + " × " + b1.t.toFixed(2) + ", Fokus " + fok);
    const lin = await p.evaluate(() => (document.querySelector('#spSvg .sp-raum[data-sp-raum="Haupt-Raum"] .sp-gitter').getAttribute("d").match(/M/g) || []).length + (document.querySelector('#spSvg .sp-raum[data-sp-raum="Haupt-Raum"] .sp-gitter.f').getAttribute("d").match(/M/g) || []).length);
    pruef(lin === 15 + 8, "15,5 × 9 m: 15 + 8 Rasterlinien (bei 1…15 m; das letzte Kästchen ist 0,5 m breit)", String(lin));
    const rahmen = await p.evaluate(() => { const b = document.getElementById("spBuehne").getBoundingClientRect(), e = document.querySelector('#spSvg .sp-raum[data-sp-raum="Haupt-Raum"] .sp-boden').getBoundingClientRect(); return e.left >= b.left && e.right <= b.right && e.top >= b.top && e.bottom <= b.bottom; });
    pruef(rahmen, "die Kamera rahmt den größeren Raum neu (er liegt ganz im Bild)");
    /* Unsinn ändert nichts */
    const vorher = async () => p.evaluate(() => JSON.stringify(SAAL.konfigEntwurf.raeume[0]));
    const stand0 = await vorher();
    for(const [wert, was] of [["abc", "Buchstaben"], ["1", "1 m (zu klein)"], ["61", "61 m (zu groß)"], ["", "leer"], ["12,555", "drei Nachkommastellen"], ["-4", "negativ"]]){
      await p.fill('#spEdit [data-sp-rm="b"]', wert);
      await p.waitForTimeout(40);
      pruef(await vorher() === stand0, "Breite „" + wert + "“ (" + was + ") ändert den Entwurf nicht");
    }
    await p.dispatchEvent('#spEdit [data-sp-rm="b"]', "change");
    pruef(await p.evaluate(() => document.querySelector('#spEdit [data-sp-rm="b"]').value) === "15,5", "beim Verlassen springt das Feld auf den gültigen Wert zurück („15,5“)");
    /* Tiefe, Komma und Punkt */
    await p.fill('#spEdit [data-sp-rm="t"]', "7.5"); await p.waitForTimeout(60);
    const t1 = seitenlaenge(await boden(p, "Haupt-Raum"));
    pruef(nah(t1.t, 7.5, 0.05), "Tiefe „7.5“ (mit Punkt) gilt wie „7,5“", t1.t.toFixed(2));
    /* Tische wandern anteilig mit */
    const anteil = await p.evaluate(() => { const r = document.querySelector('#spSvg [data-sp-tisch="demo-t2"] polygon[fill-opacity]'), e = window.__ecken(r, SAAL_BODEN + 5.1 * SAAL_M), bo = window.__ecken(document.querySelector('#spSvg .sp-raum[data-sp-raum="Haupt-Raum"] .sp-boden'), SAAL_BODEN), t = SAAL.tische.find(x => x.id === "demo-t2");
      return { x: ((e[0].x + e[2].x) / 2 - bo[0].x) / 15.5 * 100, y: ((e[0].y + e[2].y) / 2 - bo[0].y) / 7.5 * 100, soll: [t.x, t.y] }; });
    pruef(nah(anteil.x, anteil.soll[0], 0.8) && nah(anteil.y, anteil.soll[1], 0.8), "Tisch 2 bleibt bei " + anteil.soll[0] + " % × " + anteil.soll[1] + " % — er wandert mit dem Raum", anteil.x.toFixed(1) + " % × " + anteil.y.toFixed(1) + " %");
    /* Theke anlegen und klemmen */
    await p.click("[data-sp-theke-neu]");
    const th2 = await p.evaluate(() => SAAL.konfigEntwurf.raeume[0].theken);
    pruef(th2.length === 2 && th2[1].b === 6 && th2[1].t === 0.8 && th2[1].x >= 0 && th2[1].x + th2[1].b <= 15.5, "„＋ Theke / Bar“ legt eine zweite an (6 × 0,8 m, im Raum)", JSON.stringify(th2[1]));
    await p.fill('#spEdit [data-sp-th="1"][data-sp-thf="b"]', "30"); await p.waitForTimeout(60);
    const th3 = await p.evaluate(() => SAAL.konfigEntwurf.raeume[0].theken[1]);
    pruef(th3.b <= 15.5 - th3.x + 0.001 && th3.x + th3.b <= 15.5 + 0.001, "eine 30 m lange Theke wird an die 15,5 m des Raumes geklemmt", JSON.stringify(th3));
    await p.click('[data-sp-theke-weg="1"]');
    pruef((await p.evaluate(() => document.querySelectorAll("#spSvg .sp-theke").length)) === 1, "Theke 2 entfernen: nur noch eine gemalt");
    await p.click("[data-sp-theke-neu]"); await p.click("[data-sp-theke-neu]");
    pruef(await p.evaluate(() => SAAL.konfigEntwurf.raeume[0].theken.length === 3 && !document.querySelector("[data-sp-theke-neu]")), "höchstens drei Theken: danach verschwindet der Knopf");
    await p.click('[data-sp-theke-weg="2"]'); await p.click('[data-sp-theke-weg="1"]');
    /* Lage im Gebäude */
    await p.click('[data-sp-zone="Terrasse"]');
    await p.evaluate(() => window.__fest());
    await p.fill('#spEdit [data-sp-rm="x"]', "20"); await p.fill('#spEdit [data-sp-rm="y"]', "12");
    await p.waitForTimeout(100);
    const hr = await boden(p, "Haupt-Raum"), te = await boden(p, "Terrasse");
    pruef(nah(te[0].x - hr[0].x, 20, 0.05) && nah(te[0].y - hr[0].y, 12, 0.05), "Terrasse mit Lage 20 / 12 m: der gemalte Boden steht dort", (te[0].x - hr[0].x).toFixed(2) + " / " + (te[0].y - hr[0].y).toFixed(2));
    const geb = await p.evaluate(() => { const fl = window.__ecken(document.querySelector("#spSvg polygon.sp-flur"), 0), bs = [...document.querySelectorAll("#spSvg .sp-raum .sp-boden")].map(e => window.__ecken(e, SAAL_BODEN)); return bs.every(b => b.every(c => c.x >= fl[0].x - 0.01 && c.x <= fl[1].x + 0.01 && c.y >= fl[0].y - 0.01 && c.y <= fl[3].y + 0.01)); });
    pruef(geb, "die Gebäudeumrandung wächst mit (beide Räume liegen weiter innen)");
    await p.fill('#spEdit [data-sp-rm="x"]', ""); await p.fill('#spEdit [data-sp-rm="y"]', "");
    await p.waitForTimeout(100);
    const te2 = await boden(p, "Terrasse");
    pruef(nah(te2[0].x - hr[0].x, 15.5 + 2, 0.06) && nah(te2[0].y - hr[0].y, 0, 0.05), "leere Lage = wieder automatisch (15,5 + 2 m rechts neben dem Haupt-Raum)", (te2[0].x - hr[0].x).toFixed(2));
    /* Tische ziehen: Zeiger = gemalter Tisch, Rand klemmt */
    await p.click('[data-sp-tab="tische"]');
    await p.click('[data-sp-zone="Haupt-Raum"]'); await p.evaluate(() => window.__fest());
    const ziel = await p.evaluate(() => {
      const bo = window.__ecken(document.querySelector('#spSvg .sp-raum[data-sp-raum="Haupt-Raum"] .sp-boden'), SAAL_BODEN), c = SAAL.kamera, r = document.getElementById("spBuehne").getBoundingClientRect();
      const pkt = (x, y, z) => ({ x: r.left + c.tx + (x - y) * SAAL_C * SAAL_U * c.k, y: r.top + c.ty + ((x + y) * 0.5 * SAAL_U - z * SAAL_U) * c.k });
      const t = document.querySelector('#spSvg [data-sp-tisch="demo-t6"] .sp-treffer').getBoundingClientRect();
      return { von: { x: t.left + t.width / 2, y: t.top + t.height / 2 }, nach: pkt(bo[0].x + 9, bo[0].y + 3, 0.76), aus: pkt(bo[0].x + 40, bo[0].y + 40, 0.76), bo };
    });
    await p.mouse.move(ziel.von.x, ziel.von.y); await p.mouse.down(); await p.mouse.move(ziel.nach.x, ziel.nach.y, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(120);
    const v6 = await p.evaluate(() => { const v = SAAL.entwurf.get("demo-t6"); const e = window.__ecken(document.querySelector('#spSvg [data-sp-tisch="demo-t6"] polygon[fill-opacity]'), SAAL_BODEN + 5.1 * SAAL_M), bo = window.__ecken(document.querySelector('#spSvg .sp-raum[data-sp-raum="Haupt-Raum"] .sp-boden'), SAAL_BODEN);
      return { x: v.x, y: v.y, mx: (e[0].x + e[2].x) / 2 - bo[0].x, my: (e[0].y + e[2].y) / 2 - bo[0].y }; });
    pruef(nah(v6.mx, 9, 0.3) && nah(v6.my, 3, 0.3), "Tisch 6 gezogen: er steht dort, wo der Zeiger losließ (9 × 3 m vom Eck)", v6.mx.toFixed(2) + " × " + v6.my.toFixed(2) + " m");
    pruef(nah(v6.x, 9 / 15.5 * 100, 1) && nah(v6.y, 3 / 7.5 * 100, 1) && v6.x === Math.round(v6.x), "gespeichert wird der ANTEIL des Raumes als ganze Zahl (die Spalten x/y verlangen 0–100)", v6.x + " % × " + v6.y + " %");
    const ziel2 = await p.evaluate(() => { const t = document.querySelector('#spSvg [data-sp-tisch="demo-t6"] .sp-treffer').getBoundingClientRect(); return { x: t.left + t.width / 2, y: t.top + t.height / 2 }; });
    await p.mouse.move(ziel2.x, ziel2.y); await p.mouse.down(); await p.mouse.move(ziel.aus.x, ziel.aus.y, { steps: 6 }); await p.mouse.up();
    await p.waitForTimeout(100);
    const v6b = await p.evaluate(() => SAAL.entwurf.get("demo-t6"));
    pruef(v6b.x === 100 && v6b.y === 100, "weit außerhalb losgelassen: der Tisch bleibt am Rand des Raumes (100 % × 100 %), nicht im Nichts", v6b.x + " × " + v6b.y);
    /* Neuer Tisch kommt auf einen freien Platz des gezeigten Raums */
    await p.evaluate(() => { SAAL.entwurf.get("demo-t12").x = null; });
    await p.evaluate(() => { saalNeuBauen(); });
    await p.click('[data-sp-setzen="demo-t12"]');
    const nt = await p.evaluate(() => { const v = SAAL.entwurf.get("demo-t12"), r = saalRaumVon(SAAL.zone), andere = [...SAAL.entwurf.entries()].filter(([id, w]) => id !== "demo-t12" && w.x != null && saalTischZone({ ...SAAL.tische.find(t => t.id === id), ...w }) === r.zone).map(([, w]) => [w.x / 100 * r.b, w.y / 100 * r.t]);
      const m = [v.x / 100 * r.b, v.y / 100 * r.t]; return { naechster: Math.min(...andere.map(a => Math.hypot(a[0] - m[0], a[1] - m[1]))), x: v.x, y: v.y, zone: v.zone }; });
    pruef(nt.naechster >= 2 && nt.zone === "Haupt-Raum", "„Tisch 12“ aufs Plan setzen: freier Platz (≥ 2 m zum nächsten Tisch) im gezeigten Raum", nt.naechster.toFixed(2) + " m, " + nt.x + "/" + nt.y);
    await p.evaluate(() => { SAAL.entwurf.get("demo-t12").x = null; SAAL.entwurf.get("demo-t12").y = null; saalNeuBauen(); });
    /* Bereiche anlegen/entfernen ziehen die Räume nach */
    await p.click('[data-sp-tab="bereiche"]');
    await p.click("[data-sp-zneu]");
    const r3 = await p.evaluate(() => ({ z: SAAL.konfigEntwurf.zonen.length, r: SAAL.konfigEntwurf.raeume.map(x => x.b + "×" + x.t) }));
    pruef(r3.z === 3 && r3.r.length === 3 && r3.r[2] === "10×10" && r3.r[0] === "15.5×7.5", "ein neuer Bereich bringt einen Raum mit (10 × 10 m), die anderen bleiben", JSON.stringify(r3));
    await p.click('[data-sp-zweg="1"]');
    const r2 = await p.evaluate(() => ({ z: SAAL.konfigEntwurf.zonen.join("|"), r: SAAL.konfigEntwurf.raeume.map(x => x.b + "×" + x.t) }));
    pruef(r2.r.length === 2 && r2.r[0] === "15.5×7.5" && r2.r[1] === "10×10", "die Terrasse entfernen nimmt IHREN Raum mit (8 × 5 fällt weg, der neue 10 × 10 rückt nach)", JSON.stringify(r2));
    pruef(pf.length === 0, "kein Seitenfehler im Einrichten", pf.join(" | "));
    /* Speichern: Nutzlast, Gründe */
    await p.click("[data-sp-abbrechen]");
    await p.click('[data-sp-wz="einrichten"]'); await p.click('[data-sp-tab="masse"]');
    await p.fill('#spEdit [data-sp-rm="b"]', "14"); await p.fill('#spEdit [data-sp-rm="t"]', "8,5");
    await p.click("[data-sp-theke-neu]");
    await p.evaluate(() => { window.__rpc.length = 0; window.__antwort = { data: { ok: false, grund: "form" }, error: null }; });
    await p.click("[data-sp-speichern]"); await p.waitForTimeout(250);
    const abg = await p.evaluate(() => ({ edit: SAAL.edit, text: document.getElementById("spEditMeldung").textContent, rpc: window.__rpc.length, konfig: SAAL.konfig.raeume[0].b }));
    pruef(abg.edit && /migration-saal-raeume\.sql/.test(abg.text) && abg.konfig === 12, "alte Funktion (lehnt „raeume“ als „form“ ab): Satz mit dem Namen der Migration, Blatt offen, alter Stand bleibt", abg.text);
    await p.evaluate(() => { window.__rpc.length = 0; window.__antwort = { data: { ok: false, grund: "raeume" }, error: null }; });
    await p.click("[data-sp-speichern]"); await p.waitForTimeout(250);
    pruef(/Maße sind nicht gültig/.test(await p.evaluate(() => document.getElementById("spEditMeldung").textContent)), "Grund „raeume“ vom Server: Satz statt „Nicht gespeichert“");
    await p.evaluate(() => { window.__rpc.length = 0; window.__antwort = { data: { ok: true }, error: null }; });
    await p.click("[data-sp-speichern]"); await p.waitForTimeout(250);
    const ok = await p.evaluate(() => ({ edit: SAAL.edit, rpc: window.__rpc, b: SAAL.konfig.raeume[0].b, t: SAAL.konfig.raeume[0].t }));
    const a = ok.rpc[0];
    pruef(!ok.edit && ok.rpc.length === 1 && a.fn === "saal_einstellungen_setzen" && a.a.p_betrieb === "b-1", "Erfolg: genau EIN Aufruf von saal_einstellungen_setzen für den eigenen Betrieb", ok.rpc.length + " Aufrufe");
    pruef(a && Object.keys(a.a.p_daten).sort().join() === "raeume,stufen,zonen", "Nutzlast: zonen, stufen, raeume — sonst nichts", a && Object.keys(a.a.p_daten).join());
    pruef(a && a.a.p_daten.raeume.length === 2 && Object.keys(a.a.p_daten.raeume[0]).sort().join() === "b,t,theken,x,y" && a.a.p_daten.raeume[0].b === 14 && a.a.p_daten.raeume[0].t === 8.5 && a.a.p_daten.raeume[0].x === null, "ein Raum je Bereich mit genau b, t, x, y, theken (Lage leer = null)", JSON.stringify(a && a.a.p_daten.raeume[0]));
    pruef(a && a.a.p_daten.raeume[0].theken.length === 2 && Object.keys(a.a.p_daten.raeume[0].theken[1]).sort().join() === "b,t,x,y", "Theken mit genau x, y, b, t");
    pruef(ok.b === 14 && ok.t === 8.5, "danach gilt der neue Stand im Plan", ok.b + " × " + ok.t);
    /* Neuöffnen (§8.1m): aus der Datenbank lesen */
    const neuLaden = await p.evaluate(async daten => {
      db = { from: tab => tab === "saal_einstellungen"
        ? { select: () => { const o = { eq: () => o, maybeSingle: () => Promise.resolve({ data: { daten }, error: null }) }; return o; } }
        : { select: () => { const o = { eq: () => o, order: () => o, then: f => f({ data: [{ id: "demo-t2", nummer: "2", aktiv: true, x: 50, y: 50, form: "eckig", plaetze: 4, zone: "Haupt-Raum" }], error: null }) }; return o; } } };
      await saalLaden("b-1");
      const bo = window.__ecken(document.querySelector('#spSvg .sp-raum[data-sp-raum="Haupt-Raum"] .sp-boden'), SAAL_BODEN), t = window.__ecken(document.querySelector('#spSvg [data-sp-tisch="demo-t2"] .sp-treffer') ? document.querySelector('#spSvg [data-sp-tisch="demo-t2"] polygon[fill="rgb(255,255,255)"]') : null, SAAL_BODEN + 5.1 * SAAL_M);
      return { b: SAAL.konfig.raeume[0].b, th: SAAL.konfig.raeume[0].theken.length, zonen: SAAL.konfig.zonen, boden: Math.hypot(bo[1].x - bo[0].x, bo[1].y - bo[0].y), mitte: (t[0].x + t[2].x) / 2 - bo[0].x };
    }, a.a.p_daten);
    pruef(neuLaden.b === 14 && neuLaden.th === 2 && nah(neuLaden.boden, 14, 0.05), "nach dem Neuladen steht der gespeicherte Raum da (14 m, 2 Theken) — am gemalten Boden gemessen", JSON.stringify(neuLaden));
    pruef(nah(neuLaden.mitte, 7, 0.1), "Tisch 2 bei 50 % steht bei 7,0 m (die Hälfte der neuen 14 m)", neuLaden.mitte.toFixed(2));
    pruef(pf.length === 0, "kein Seitenfehler beim Speichern und Laden", pf.join(" | "));
    await ctx.close();
  }
  {
    /* Ein Haus ohne gespeicherte Maße: der alte Weg bleibt gangbar (kein Schlüssel „raeume“) */
    const { ctx, p } = await neu(br, 1440, 900);
    await stelle(p);
    await p.evaluate(() => {
      window.__rpc = []; demo = false; betriebId = "b-1";
      db = { rpc: (fn, a) => { window.__rpc.push({ fn, a: JSON.parse(JSON.stringify(a)) }); return Promise.resolve({ data: { ok: true }, error: null }); }, from: () => { const o = { update: () => o, eq: () => o, select: () => Promise.resolve({ data: [{ id: "x" }], error: null }) }; return o; } };
      SAAL.einst = { zonen: ["Haupt-Raum", "Terrasse"], stufen: {} }; SAAL.konfig = saalKonfig(SAAL.einst); SAAL.sig = ""; saalZeichnen();
    });
    const b10 = seitenlaenge(await boden(p, "Haupt-Raum"));
    pruef(nah(b10.b, 10, 0.05) && nah(b10.t, 10, 0.05), "ohne gespeicherte Maße ist jeder Raum 10 × 10 m (Vorgabe, kein Absturz, kein Leerraum)", b10.b.toFixed(2) + " × " + b10.t.toFixed(2));
    await p.click('[data-sp-wz="einrichten"]'); await p.click('[data-sp-tab="stufen"]');
    await p.evaluate(() => { const f = document.querySelector('[data-sp-farbe="ruf"]'); f.value = "#00c8ff"; f.dispatchEvent(new Event("input", { bubbles: true })); });
    await p.click("[data-sp-speichern]"); await p.waitForTimeout(250);
    const a = await p.evaluate(() => window.__rpc[0]);
    pruef(a && Object.keys(a.a.p_daten).sort().join() === "stufen,zonen", "Farbe geändert, Maße unberührt: Nutzlast OHNE „raeume“ (läuft auch mit der alten Funktion)", a && Object.keys(a.a.p_daten).join());
    await ctx.close();
  }

  /* ── 4 · Lieferauto ────────────────────────────────────────────── */
  console.log("\n══ Lieferauto ══");
  {
    const { ctx, p, pf } = await neu(br, 1280, 860);
    await stelle(p);
    const sc = await p.evaluate(() => ({ da: !!document.querySelector("#spSvg .sp-auto"), text: (document.querySelector("#spSvg .sp-autozahl") || {}).textContent, label: (document.querySelector("#spSvg .sp-auto") || document.body).getAttribute("aria-label"), strasse: !!document.querySelector("#spSvg .sp-strasse") }));
    pruef(sc.da && sc.strasse, "das Lieferauto steht auf der Straße vor dem Gebäude");
    pruef(sc.text === "1 Lieferung" && /eine Lieferung offen/.test(sc.label), "das Schild zählt Lieferungen: „1 Lieferung“ (die Abholung zählt nicht mit)", sc.text + " | " + sc.label);
    /* Maße des Autos am gemalten Bild: 4,7 × 1,95 m */
    const maß = await p.evaluate(() => { const g = document.querySelector("#spSvg .sp-auto"), r = g.querySelector("polygon.sp-auto-schatten"); const e = window.__ecken(r, 0.03); return { l: Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y), b: Math.hypot(e[2].x - e[1].x, e[2].y - e[1].y) }; });
    pruef(nah(maß.l, 5.2, 0.06) && nah(maß.b, 2.2, 0.06), "Standfläche des Autos 4,7 × 1,95 m (Schatten +0,25/+0,4 m)", maß.l.toFixed(2) + " × " + maß.b.toFixed(2));
    const teile = await p.evaluate(() => ({ rad: document.querySelectorAll("#spSvg .sp-auto .sp-auto-reifen").length, glas: document.querySelectorAll("#spSvg .sp-auto .sp-auto-glas").length, licht: document.querySelectorAll("#spSvg .sp-auto .sp-auto-licht").length, band: !!document.querySelector("#spSvg .sp-auto .sp-auto-band"), text: (document.querySelector("#spSvg .sp-auto-text") || {}).textContent }));
    pruef(teile.rad >= 4 && teile.glas === 2 && teile.licht === 2 && teile.band && teile.text === "LIEFERUNG", "gezeichnet sind Räder, Scheibe und Frontscheibe, zwei Scheinwerfer, Leuchtband und der Schriftzug", JSON.stringify(teile));
    const schwarz = await p.evaluate(() => [...document.querySelectorAll("#spSvg .sp-auto polygon, #spSvg .sp-auto path")].filter(e => { const f = getComputedStyle(e).fill; return f === "rgb(0, 0, 0)" && !e.classList.contains("sp-auto-fuge"); }).map(e => e.getAttribute("class")));
    pruef(schwarz.length === 0, "keine Fläche des Autos fällt auf SVG-Schwarz (jede hat eine Regel, §8.1e)", schwarz.join(","));
    /* Tipp auf das Schild */
    const alle0 = await p.evaluate(() => document.querySelectorAll("#karten .bestellung").length);
    /* In der Raumansicht liegt das Auto außerhalb des Bildes — dafür gibt es den Knopf in der Werkzeugleiste (mit Zahl) */
    const ak = await p.evaluate(() => { const b = document.querySelector('.sp-werkzeug [data-sp-wz="auto"]'), r = b.getBoundingClientRect(), z = b.querySelector(".sp-wzzahl"); return { da: !b.hidden, w: r.width, h: r.height, zahl: z && !z.hidden ? z.textContent : null, label: b.getAttribute("aria-label"), aus: (() => { const a = document.querySelector("#spSvg .sp-auto").getBoundingClientRect(), bu = document.getElementById("spBuehne").getBoundingClientRect(); return a.bottom > bu.bottom || a.top < bu.top || a.right > bu.right; })() }; });
    pruef(ak.da && ak.w >= 44 && ak.h >= 44 && ak.zahl === "1" && /1 offen/.test(ak.label), "Werkzeugleiste: Knopf „Lieferungen“ (≥ 44 px) mit der Zahl 1", JSON.stringify(ak));
    pruef(ak.aus, "Voraussetzung: in der Raumansicht liegt das Auto selbst außerhalb des Bildes");
    await p.click('[data-sp-wz="gebaeude"]'); await p.evaluate(() => window.__fest());
    const sb = await mitte(p, "#spSvg .sp-autopille");
    await p.mouse.click(sb.x, sb.y); await p.waitForTimeout(700);
    const z = await p.evaluate(() => ({ a: SAAL.auswahl, t: document.getElementById("spDetailTitel").textContent, orte: document.getElementById("karten").parentElement.id, q: [...document.querySelectorAll("#karten .bestellung")].map(k => k.dataset.quelle + ":" + (k.dataset.id || "")), zeile: document.getElementById("spZeile").textContent, ring: getComputedStyle(document.querySelector("#spSvg .sp-auto-ring")).display !== "none", pressed: document.querySelector("#spSvg .sp-auto").getAttribute("aria-pressed") }));
    pruef(z.a === "__auto" && z.t === "Lieferungen" && z.orte === "spKartenOrt", "Tipp aufs Auto: das Blatt „Lieferungen“ öffnet, die Karten ziehen hinein", JSON.stringify({ a: z.a, t: z.t, orte: z.orte }));
    pruef(z.q.length === 1 && /^lieferung/.test(z.q[0]), "es steht genau die eine Lieferung darin (nicht die Tische, nicht die Abholung)", z.q.join(","));
    pruef(z.ring && z.pressed === "true" && /Lieferauto: 1 Lieferung offen/.test(z.zeile), "das Auto trägt einen Auswahlring, aria-pressed und die Zeile unter dem Plan nennt den Stand", z.zeile);
    const k = await p.evaluate(() => ({ nah: Math.abs(SAAL.kamera.k - SAAL.passtGeb) < 0.02 }));
    pruef(k.nah, "die Kamera zeigt dabei das ganze Gebäude (Auto und Straße im Bild)");
    pruef(await p.evaluate(() => document.querySelector('.sp-werkzeug [data-sp-wz="auto"]').getAttribute("aria-pressed")) === "true", "der Knopf in der Werkzeugleiste zeigt „gewählt“");
    await p.mouse.click(sb.x, sb.y); await p.waitForTimeout(500);
    const z2 = await p.evaluate(() => ({ a: SAAL.auswahl, orte: document.getElementById("karten").parentElement.id, n: document.querySelectorAll("#karten .bestellung").length, ring: getComputedStyle(document.querySelector("#spSvg .sp-auto-ring")).display !== "none", pressed: document.querySelector("#spSvg .sp-auto").getAttribute("aria-pressed") }));
    pruef(z2.a === null && z2.orte === "t-bestellungen" && z2.n === alle0, "zweiter Tipp hebt auf: die Karten wohnen wieder unter „Bestellungen“ und zeigen ALLES", JSON.stringify(z2));
    pruef(!z2.ring && z2.pressed === "false", "und der Auswahlring ist weg, aria-pressed steht wieder auf false");
    /* Über die Werkzeugleiste (Raumansicht) */
    await p.click('[data-sp-zone="Haupt-Raum"]'); await p.evaluate(() => window.__fest());
    await p.click('.sp-werkzeug [data-sp-wz="auto"]'); await p.waitForTimeout(700);
    const z3 = await p.evaluate(() => ({ a: SAAL.auswahl, t: document.getElementById("spDetailTitel").textContent, n: document.querySelectorAll("#karten .bestellung").length, geb: Math.abs(SAAL.kamera.k - SAAL.passtGeb) < 0.02 }));
    pruef(z3.a === "__auto" && z3.t === "Lieferungen" && z3.n === 1 && z3.geb, "Knopf in der Werkzeugleiste: Lieferungen im Blatt, Kamera zeigt das Gebäude mit dem Auto", JSON.stringify(z3));
    await p.click('.sp-werkzeug [data-sp-wz="auto"]'); await p.waitForTimeout(300);
    pruef((await p.evaluate(() => SAAL.auswahl)) === null, "zweiter Tipp auf den Knopf hebt auf");
    /* Anderer Tisch gewählt, während das Auto gewählt ist: die Auswahl wechselt sauber */
    await p.click('.sp-werkzeug [data-sp-wz="auto"]'); await p.waitForTimeout(300);
    await p.evaluate(() => saalTipp("demo-t4")); await p.waitForTimeout(300);
    const wechsel = await p.evaluate(() => ({ a: SAAL.auswahl, ring: getComputedStyle(document.querySelector("#spSvg .sp-auto-ring")).display !== "none", n: [...document.querySelectorAll("#karten .bestellung")].map(k => k.dataset.quelle).join(",") }));
    pruef(wechsel.a === "4" && !wechsel.ring && wechsel.n === "service", "vom Auto zu Tisch 4 gewechselt: nur dessen Karte, der Ring am Auto ist weg", JSON.stringify(wechsel));
    await p.evaluate(() => saalAbwaehlen());
    /* Tastatur */
    await p.focus("#spSvg .sp-auto"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
    pruef((await p.evaluate(() => SAAL.auswahl)) === "__auto", "Enter auf dem fokussierten Auto zeigt die Lieferungen");
    await p.keyboard.press("Space"); await p.waitForTimeout(300);
    pruef((await p.evaluate(() => SAAL.auswahl)) === null, "Leertaste hebt wieder auf");
    /* eine zweite und dritte Lieferung */
    await p.evaluate(() => { bestellungen.push({ id: "x20", quelle: "lieferung", status: "arbeit", zeitpunkt: new Date(Date.now() - 9 * 60000).toISOString(), liefer_adresse: { name: "B" }, positionen: [{ name: "Z", menge: 1, preis: 5 }], summe: 5 }, { id: "x21", quelle: "lieferung", status: "neu", zeitpunkt: new Date().toISOString(), liefer_adresse: { name: "C" }, positionen: [{ name: "Y", menge: 1, preis: 5 }], summe: 5 }); zeichneAlles(); });
    pruef((await p.evaluate(() => document.querySelector("#spSvg .sp-autozahl").textContent)) === "3 Lieferungen", "weitere Lieferungen kommen: das Schild zählt mit („3 Lieferungen“, Mehrzahl)");
    await p.evaluate(() => { bestellungen.filter(b => b.quelle === "lieferung").forEach(b => b.status = "storniert"); zeichneAlles(); });
    pruef((await p.evaluate(() => document.querySelector("#spSvg .sp-autozahl").textContent)) === "Keine Lieferung", "alles storniert: „Keine Lieferung“ (das Auto steht trotzdem, das Haus liefert)");
    /* Sprachlich/lesbar: Schild ≥ 4,5:1 */
    const kontrast = await p.evaluate(() => {
      const lum = c => { const v = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => x / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const r = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
      const t = document.querySelector("#spSvg .sp-autozahl"), pille = document.querySelector("#spSvg .sp-autopille");
      const leer = r(getComputedStyle(t).fill, getComputedStyle(pille).fill);
      bestellungen.push({ id: "x30", quelle: "lieferung", status: "neu", zeitpunkt: new Date().toISOString(), liefer_adresse: { name: "D" }, positionen: [{ name: "X", menge: 1, preis: 5 }], summe: 5 }); zeichneAlles();
      const t2 = document.querySelector("#spSvg .sp-autozahl"), p2 = document.querySelector("#spSvg .sp-autopille");
      return { leer, da: r(getComputedStyle(t2).fill, getComputedStyle(p2).fill) };
    });
    pruef(kontrast.leer >= 4.5 && kontrast.da >= 4.5, "Schild: Schrift ≥ 4,5:1 auf der Fläche (leer und mit Lieferungen)", kontrast.leer.toFixed(2) + " / " + kontrast.da.toFixed(2));
    pruef(pf.length === 0, "kein Seitenfehler", pf.join(" | "));
    await ctx.close();
  }
  {
    /* Ein Haus ohne Lieferung hat kein Auto */
    const { ctx, p } = await neu(br, 1280, 860);
    await stelle(p);
    await p.evaluate(() => {
      demo = false; betriebId = "b-1"; meineBetriebe = [{ id: "b-1", liefer: { an: false } }];
      bestellungen.splice(0, bestellungen.length, ...bestellungen.filter(b => b.quelle !== "lieferung"));
      SAAL.sig = ""; saalZeichnen();
    });
    pruef(await p.evaluate(() => !document.querySelector("#spSvg .sp-auto") && !document.querySelector("#spSvg .sp-strasse")), "Haus ohne Lieferung und ohne offene Lieferung: weder Auto noch Straße");
    await p.evaluate(() => { meineBetriebe[0].liefer.an = true; SAAL.sig = ""; saalZeichnen(); });
    pruef(await p.evaluate(() => !!document.querySelector("#spSvg .sp-auto")), "Lieferung eingeschaltet: das Auto steht da (auch ohne Bestellung)");
    await p.evaluate(() => { meineBetriebe[0].liefer.an = false; bestellungen.push({ id: "x40", quelle: "lieferung", status: "neu", zeitpunkt: new Date().toISOString(), liefer_adresse: { name: "E" }, positionen: [{ name: "X", menge: 1, preis: 5 }], summe: 5 }); zeichneAlles(); });
    pruef(await p.evaluate(() => !!document.querySelector("#spSvg .sp-auto")), "Lieferung ausgeschaltet, aber eine liegt noch offen: das Auto steht (nichts wird unsichtbar, §7)");
    await ctx.close();
  }
  {
    /* Reduzierte Bewegung: nichts läuft am Auto */
    const { ctx, p } = await neu(br, 1280, 860, { reducedMotion: "reduce" });
    await stelle(p);
    const an = await p.evaluate(() => [...document.querySelectorAll("#spSvg .sp-auto, #spSvg .sp-auto *")].filter(e => getComputedStyle(e).animationName !== "none").length);
    pruef(an === 0, "reduzierte Bewegung: keine laufende Animation am Auto", String(an));
    await ctx.close();
    const n2 = await neu(br, 1280, 860);
    await stelle(n2.p);
    const lauf = await n2.p.evaluate(() => [...document.querySelectorAll("#spSvg .sp-auto *")].filter(e => getComputedStyle(e).animationName !== "none").map(e => e.getAttribute("class") + ":" + getComputedStyle(e).animationName));
    pruef(lauf.length === 1 && /puls/.test(lauf[0]), "sonst läuft genau ein Puls (nur opacity), sonst bewegt sich nichts", lauf.join(","));
    const anim = await n2.p.evaluate(() => { const e = document.querySelector("#spSvg .sp-auto-puls"); return e.getAnimations().map(a => a.effect.getKeyframes().map(k => Object.keys(k).filter(x => !["offset", "computedOffset", "easing", "composite"].includes(x)).join(",")).join("|")).join(";"); });
    pruef(/^opacity(\|opacity)*$/.test(anim), "und er verändert nur opacity", anim);
    await n2.ctx.close();
  }

  await br.close();
  console.log(fehler ? "\n" + fehler + " FEHLER" : "\nalles grün");
  process.exit(fehler ? 1 : 0);
})();
async function mitte(p, sel){ return p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel); }
