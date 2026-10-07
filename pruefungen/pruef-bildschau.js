/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Bildvorschau im Admin-Board — Tiefeneffekt-Politur

     node pruefungen/pruef-bildschau.js

   Auftrag: Die kleine Bildvorschau beim Hochladen eines Gerichte-Fotos
   (.bildschau) soll "perfekt passen" — mittig (schon vorhanden über
   background-position:center) und mit einem Tiefeneffekt an den
   Rändern wie bei einer 3D-Ansicht. Kein neuer Bildverarbeitungsdienst
   (Nutzer-Entscheidung): reine CSS-Vignette (radial-gradient in einem
   ::after) plus ein zweistufiger box-shadow, keine echte Freistellung.
   Seit 07.10. ersetzt ein quadratischer Zuschnitt (#gbZuschnitt, dieselben
   Gesten wie bei den Kacheln) den freien Rahmen: Geprüft wird an einem
   echten Bild, dass das Quadrat immer gefüllt ist, mittig schneidet,
   in 1080 und 320 px ausgibt, und dass die Marke „-q1080“ nur kommt,
   wenn die kleine Fassung wirklich oben liegt. Die Hub-Hälfte (Liste
   nimmt die kleine, Detail füllt) steht in pruef-profifoto.js.

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
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, hasTouch: true });
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
  /* „Scharf schalten“ NICHT klicken: Es geht in den Vollbildmodus, und
     im kopflosen Browser landen Maus und Rad danach an falschen Stellen
     (CLAUDE.md §3.8) — das Rad im Zuschnitt kam so nie an. */
  await seite.evaluate(() => { const s = document.getElementById("scharf"); if (s) s.hidden = true; });

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

  console.log("\n══ Zuschnitt des Gerichtfotos: Quadrat, füllend, mittig ══");
  /* Ein Probebild, an dem man Mitte und Ränder ablesen kann: 1600×900,
     links rot, Mitte grün, rechts blau. Mittig quadratisch geschnitten
     MUSS der linke Rand rot, die Mitte grün, der rechte Rand blau sein. */
  const probe = await seite.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 1600; c.height = 900;
    const x = c.getContext("2d");
    x.fillStyle = "#ff0000"; x.fillRect(0, 0, 534, 900);
    x.fillStyle = "#00ff00"; x.fillRect(534, 0, 532, 900);
    x.fillStyle = "#0000ff"; x.fillRect(1066, 0, 534, 900);
    return c.toDataURL("image/png").split(",")[1];
  });
  pruef(!(await seite.$("#bildCropContainer")), "der alte freie Rahmen ist weg");
  await seite.setInputFiles("#fDatei", { name: "Probe Teller.png", mimeType: "image/png", buffer: Buffer.from(probe, "base64") });
  await seite.waitForTimeout(600);
  const z = await seite.evaluate(() => {
    const r = document.getElementById("gbRahmen").getBoundingClientRect();
    const st = gbZuschnitt, m = st ? gbGrundmass() * st.zoom : 0;
    return { offen: !document.getElementById("gbZuschnitt").hidden, w: r.width, h: r.height,
      dx: st && st.dx, dy: st && st.dy, bw: st ? st.bild.naturalWidth * m : 0, bh: st ? st.bild.naturalHeight * m : 0,
      stand: document.getElementById("bildStand").textContent };
  });
  pruef(z.offen, "Foto wählen öffnet den Zuschnitt — auch im Vorführmodus", z.stand);
  pruef(Math.abs(z.w - z.h) < 1 && z.w > 200, "Rahmen ist ein Quadrat", z.w.toFixed(1) + "×" + z.h.toFixed(1));
  pruef(z.dx <= 0.01 && z.dy <= 0.01 && z.dx + z.bw >= z.w - 0.01 && z.dy + z.bh >= z.h - 0.01,
    "kleinster Zoom: Bild deckt das Quadrat ganz (kein Rand)", JSON.stringify({ dx: z.dx.toFixed(1), dy: z.dy.toFixed(1), bw: z.bw.toFixed(1), bh: z.bh.toFixed(1) }));
  pruef(Math.abs((z.dx + z.bw / 2) - z.w / 2) < 1, "Bild steht mittig", (z.dx + z.bw / 2).toFixed(1) + " / " + (z.w / 2).toFixed(1));

  /* Ausgabe: zwei Quadrate, mittig */
  const aus = await seite.evaluate(async () => {
    const { gross, klein } = await gbAusschnitte();
    const lies = async (b) => {
      const bmp = await createImageBitmap(b);
      const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
      const x = c.getContext("2d"); x.drawImage(bmp, 0, 0);
      const px = (u, v) => Array.from(x.getImageData(Math.round(u * (bmp.width - 1)), Math.round(v * (bmp.height - 1)), 1, 1).data.slice(0, 3));
      return { w: bmp.width, h: bmp.height, typ: b.type, kb: Math.round(b.size / 1024), links: px(0.02, .5), mitte: px(.5, .5), rechts: px(.98, .5) };
    };
    return { gross: await lies(gross), klein: await lies(klein) };
  });
  const farbe = (p, k) => p[k] > 200 && p.filter((_, i) => i !== k).every(v => v < 60);
  pruef(aus.gross.w === 1080 && aus.gross.h === 1080, "große Fassung 1080×1080", aus.gross.w + "×" + aus.gross.h + " " + aus.gross.typ + " " + aus.gross.kb + " KB");
  pruef(aus.klein.w === 320 && aus.klein.h === 320, "kleine Fassung 320×320", aus.klein.w + "×" + aus.klein.h + " " + aus.klein.kb + " KB");
  pruef(aus.klein.kb * 3 < aus.gross.kb || aus.klein.kb <= 4, "kleine Fassung ist deutlich leichter", aus.klein.kb + " / " + aus.gross.kb + " KB");
  pruef(/image\/(webp|jpeg)/.test(aus.gross.typ), "Format WebP oder JPEG", aus.gross.typ);
  for (const f of ["gross", "klein"])
    pruef(farbe(aus[f].links, 0) && farbe(aus[f].mitte, 1) && farbe(aus[f].rechts, 2),
      f + ": links rot, Mitte grün, rechts blau — symmetrisch geschnitten", JSON.stringify([aus[f].links, aus[f].mitte, aus[f].rechts]));

  /* Über die Kante ziehen: es entsteht nie ein Rand */
  const r = await seite.$eval("#gbRahmen", el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await seite.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
  await seite.mouse.down();
  /* Weit genug, um über die Kante zu wollen (das Bild steht nur 140 px
     über), aber im Fenster — ein Loslassen außerhalb meldet der kopflose
     Browser nicht, und der Zeiger bliebe „gedrückt“. */
  await seite.mouse.move(r.x + r.w - 2, r.y + r.h - 2, { steps: 8 });
  await seite.mouse.up();
  const nachZug = await seite.evaluate(() => ({ dx: gbZuschnitt.dx, dy: gbZuschnitt.dy }));
  pruef(nachZug.dx <= 0.01 && nachZug.dy <= 0.01, "über die Kante nach rechts unten gezogen: Bild bleibt an der Kante, kein Rand", JSON.stringify(nachZug));

  /* Zwei echte Finger (CDP) abseits der Mitte: der Bildpunkt zwischen
     ihnen bleibt dort. In der Mitte bliebe er auch bei naivem Zoom
     liegen — deshalb bei 27 % / 64 %.
     Ehrliche Grenze: Das Mausrad kommt im kopflosen Browser nach dem
     Öffnen über den echten Klick-Weg gar nicht an (auch beim Kachel-
     Zuschnitt; mit jedem zusätzlich angemeldeten Rad-Horcher dagegen
     schon). Gemessen wird deshalb die Geste, um die es geht. */
  await seite.evaluate(() => { gbZuschnitt.zoom = 1; gbMitte(); document.getElementById("gbRahmen").scrollIntoView({ block: "center" }); });
  await seite.waitForTimeout(200);
  const r2 = await seite.$eval("#gbRahmen", el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const px = r2.x + r2.w * 0.27, py = r2.y + r2.h * 0.64;
  const punkt = () => seite.evaluate(([x, y]) => {
    const rr = document.getElementById("gbRahmen").getBoundingClientRect(), m = gbGrundmass() * gbZuschnitt.zoom;
    return { u: (x - rr.left - gbZuschnitt.dx) / m, v: (y - rr.top - gbZuschnitt.dy) / m, zoom: gbZuschnitt.zoom };
  }, [px, py]);
  const vor = await punkt();
  const cdp = await ctx.newCDPSession(seite);
  const finger = d => [{ x: px - d, y: py, id: 0 }, { x: px + d, y: py, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: finger(20) });
  for (let i = 1; i <= 8; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: finger(20 + i * 4) }); await seite.waitForTimeout(16); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await seite.waitForTimeout(200);
  const nach = await punkt();
  pruef(nach.zoom > 1.4, "zwei Finger zoomen hinein", nach.zoom.toFixed(2));
  pruef(Math.hypot(nach.u - vor.u, nach.v - vor.v) < 1.5, "Bildpunkt zwischen den Fingern bleibt (abseits der Mitte)",
    vor.u.toFixed(1) + "," + vor.v.toFixed(1) + " → " + nach.u.toFixed(1) + "," + nach.v.toFixed(1));
  const regler = await seite.evaluate(() => document.getElementById("gbZoom").value);
  pruef(Math.abs(Number(regler) - nach.zoom * 100) <= 1, "Regler läuft mit", regler);
  await seite.evaluate(() => { const r = document.getElementById("gbZoom"); r.value = 100; r.dispatchEvent(new Event("input")); });
  const zurueck = await seite.evaluate(() => {
    const rr = document.getElementById("gbRahmen").getBoundingClientRect(), m = gbGrundmass() * gbZuschnitt.zoom;
    return { zoom: gbZuschnitt.zoom, rand: gbZuschnitt.dx > 0.01 || gbZuschnitt.dy > 0.01 ||
      gbZuschnitt.dx + gbZuschnitt.bild.naturalWidth * m < rr.width - 0.01 || gbZuschnitt.dy + gbZuschnitt.bild.naturalHeight * m < rr.height - 0.01 };
  });
  pruef(zurueck.zoom === 1 && !zurueck.rand, "Regler zurück auf 100 %: wieder ohne Rand", JSON.stringify(zurueck));

  /* Vorführmodus lädt nichts hoch und lässt den Zuschnitt offen */
  await seite.click("#gbOk"); await seite.waitForTimeout(200);
  const vf = await seite.evaluate(() => ({ offen: !document.getElementById("gbZuschnitt").hidden, stand: document.getElementById("bildStand").textContent, bild: document.getElementById("fBild").value }));
  pruef(vf.offen && /Vorführmodus/.test(vf.stand) && !vf.bild, "Vorführmodus: nichts hochgeladen, ehrlich gesagt", vf.stand);

  /* Hochladen mit gestelltem Speicher: erst klein, dann groß mit Marke */
  const hoch = async (kleinScheitert) => seite.evaluate(async (kleinScheitert) => {
    const log = [];
    demo = false; betriebId = "b-probe";
    db = { storage: { from: eimer => ({
      upload: async (pfad, blob, o) => { log.push({ eimer, pfad, typ: o.contentType, gr: blob.size });
        return { error: kleinScheitert && /-q320\./.test(pfad) ? { message: "nein" } : null }; },
      getPublicUrl: pfad => ({ data: { publicUrl: "https://probe.supabase.co/storage/v1/object/public/gerichte/" + pfad } }) }) } };
    await gbFertig();
    const erg = { log, bild: document.getElementById("fBild").value, offen: !document.getElementById("gbZuschnitt").hidden,
      stand: document.getElementById("bildStand").textContent };
    demo = true; db = null;
    return erg;
  }, kleinScheitert);
  const h1 = await hoch(false);
  pruef(h1.log.length === 2 && /-q320\.(webp|jpg)$/.test(h1.log[0].pfad) && /-q1080\.(webp|jpg)$/.test(h1.log[1].pfad),
    "erst die kleine, dann die große Fassung", h1.log.map(x => x.pfad.split("/").pop()).join(", "));
  pruef(h1.log.every(x => x.eimer === "gerichte" && x.pfad.startsWith("b-probe/")), "in den Ordner des eigenen Betriebs");
  pruef(h1.log[0] && h1.log[1] && h1.log[0].pfad.replace(/-q320\..*$/, "") === h1.log[1].pfad.replace(/-q1080\..*$/, ""), "beide Fassungen teilen den Namen");
  pruef(/probe-teller-q1080\.(webp|jpg)$/.test(h1.bild) && !h1.offen, "Adresse der großen Fassung steht im Feld, Zuschnitt zu", h1.bild.split("/").pop());
  await seite.setInputFiles("#fDatei", { name: "Probe Teller.png", mimeType: "image/png", buffer: Buffer.from(probe, "base64") });
  await seite.waitForTimeout(600);
  const h2 = await hoch(true);
  pruef(h2.log.length === 2 && !/-q1080/.test(h2.bild) && /probe-teller\.(webp|jpg)$/.test(h2.bild),
    "kleine Fassung scheitert → die große bekommt KEINE Marke (der Hub sucht dann keine kleine)", h2.bild.split("/").pop());

  pruef(konsole.length === 0, "keine Ausnahme in der Konsole", konsole.join(" | ") || "still");

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
