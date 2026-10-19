/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Fehler aus dem Kundentest vom 19.10. (Foto + Meldung)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-kundenweg.js

   Gemeldet: (1) „Wenn man schnell nach oben und unten scrollt in der
   Speisekarte, wirft es einen auf die Startseite zurück.“ Ursache: die
   Geste „am oberen Rand 110 px nach unten ziehen → Übersicht“. Ein
   Finger, der gerade oben ankommt (Schwung, Gummiband), zählte als
   Geste. (2) „Beim Kartenwischen ist die Karte kurz verbuggt“: Foto
   und Abzeichen der nachrückenden Karte kamen erst, wenn sie schon
   vorn lag. (3) Impressum/Datenschutz standen im Warenkorb zweimal.

   Alles mit echtem Finger (CDP, §3.8). Die Fotos sind nachgestellt und
   langsam (900 ms) — mit schnellen Fotos sieht jede Fassung richtig
   aus (§8.1g). Datei per HUB_DATEI überschreibbar (Gegenbeweis).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const HUB = process.env.HUB_DATEI || path.join(__dirname, "..", "dist", "chocolamour", "index.html");
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function neu(br){
  const ctx = await br.newContext({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true });
  await ctx.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); localStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.clock.setFixedTime(new Date("2026-10-10T14:00:00"));
  await p.route("**/*", async r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(/fake\.test/.test(u)){ await new Promise(k => setTimeout(k, 900)); return r.fulfill({ status:200, contentType:"image/png", body:PNG }); }
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await p.goto("file://" + HUB);
  await p.waitForTimeout(1200);
  return { ctx, p, fehler, cdp: await ctx.newCDPSession(p) };
}
async function zug(p, cdp, x, y, dx, dy, schritte, warte){
  await cdp.send("Input.dispatchTouchEvent", { type:"touchStart", touchPoints:[{ x, y }] });
  for(let i = 1; i <= schritte; i++){
    await cdp.send("Input.dispatchTouchEvent", { type:"touchMove", touchPoints:[{ x: x + dx * i / schritte, y: y + dy * i / schritte }] });
    await p.waitForTimeout(warte);
  }
  await cdp.send("Input.dispatchTouchEvent", { type:"touchEnd", touchPoints:[] });
}

(async () => {
  const br = await chromium.launch();

  console.log("\n══ 1 · Schnell hoch und runter rollen bleibt auf der Unterseite ══");
  { const { ctx, p, fehler, cdp } = await neu(br);
    await p.evaluate(() => { location.hash = "#/speisekarte"; });
    await p.waitForTimeout(600);
    const hoch = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    pruef(hoch > 600, "Voraussetzung: die Speisekarte ist lang genug zum Rollen", hoch);
    let weg = null;
    for(let i = 0; i < 8 && !weg; i++){
      /* runter, kurz hoch bis ganz oben, SOFORT wieder nach unten ziehen */
      await zug(p, cdp, 200, 700, 0, -520, 6, 8);
      await zug(p, cdp, 200, 150, 0, 560, 6, 8);
      await p.evaluate(() => scrollTo(0, 0));
      await zug(p, cdp, 200, 200, 0, 260, 8, 10);
      const h = await p.evaluate(() => location.hash);
      if(h !== "#/speisekarte") weg = h;
    }
    pruef(weg === null, "nach 8 Runden Rollen und einem Zug nach unten am oberen Rand: noch in der Speisekarte", weg || "#/speisekarte");
    const oben = await p.evaluate(() => scrollY);
    pruef(oben === 0, "Voraussetzung: der letzte Zug begann ganz oben", oben);
    pruef(fehler.length === 0, "kein Fehler in der Konsole", fehler[0] || "still");
    await ctx.close(); }

  console.log("\n══ 2 · Kartenwischen: Fotos kommen nicht mitten im Wisch ══");
  { const { ctx, p, fehler, cdp } = await neu(br);
    await p.evaluate(() => { let i = 0;
      for(const e of edKandidaten()){ const g = findeGericht(e.n); if(g) g.bild = "https://fake.test/p" + (i++) + ".png"; }
      location.hash = "#/entdecken"; });
    await p.waitForTimeout(700);
    await p.evaluate(() => frModusSetzen("karten", true));
    await p.waitForTimeout(1600);
    await p.evaluate(() => {
      window.__f = []; const t0 = performance.now();
      const tick = () => {
        window.__f.push([...document.querySelectorAll("#edStapel .ed-karte")].map(k => ({
          n: k.dataset.ed, t: k.dataset.tiefe, foto: k.querySelector(".ed-bildflaeche").classList.contains("mitfoto") })));
        requestAnimationFrame(tick); };
      tick(); });
    for(let i = 0; i < 7; i++){
      const r = await p.evaluate(() => { const b = document.querySelector('#edStapel .ed-karte[data-tiefe="0"]').getBoundingClientRect();
        return { x:b.left + b.width * .8, y:b.top + b.height * .5 }; });
      await zug(p, cdp, r.x, r.y, -200, 8, 8, 20);
      await p.waitForTimeout(230);
    }
    await p.waitForTimeout(800);
    const pos = await p.evaluate(() => edPos);
    pruef(pos === 7, "Voraussetzung: sieben Karten wirklich weggewischt", pos);
    const bilder = await p.evaluate(() => window.__f);
    const zuvor = {}; let spaet = 0, gesehen = 0;
    bilder.forEach((ks, i) => ks.forEach(k => {
      const a = zuvor[k.n];
      if(a && (k.t === "0" || k.t === "1")){ gesehen++; if(!a.foto && k.foto) spaet++; }
      zuvor[k.n] = k; }));
    pruef(gesehen > 100, "Voraussetzung: vordere Karten über viele Bilder beobachtet", gesehen);
    /* Die allerersten Karten laden mit der Seite; danach darf an einer
       Karte, die vorn liegt (Tiefe 0 oder 1), kein Foto mehr einblenden. */
    pruef(spaet <= 2, "Fotos blenden nicht erst ein, wenn die Karte schon vorn liegt", spaet + " späte (erlaubt: die ersten beiden der Seite)");
    pruef(fehler.length === 0, "kein Fehler in der Konsole", fehler[0] || "still");
    await ctx.close(); }

  console.log("\n══ 3 · Warenkorb: Impressum/Datenschutz genau einmal ══");
  { const { ctx, p, fehler } = await neu(br);
    await p.evaluate(() => { location.hash = "#/auswahl"; });
    await p.waitForTimeout(500);
    const leer = await p.evaluate(() => [...document.querySelectorAll(".rechtlink")].filter(a => a.getClientRects().length).map(a => a.textContent));
    pruef(leer.filter(x => /Impressum/.test(x)).length === 1, "leerer Korb: Impressum einmal (Fußzeile)", leer.join("|"));
    await p.evaluate(() => { const g = edKandidaten()[0]; merk[g.n] = { n:g.n, p:korbPreis(findeGericht(g.n)), b:"", m:1 }; merkSpeichern(); zeichne(); });
    await p.waitForTimeout(500);
    const voll = await p.evaluate(() => ({
      zahlteil: !!document.getElementById("zahlteil"),
      links: [...document.querySelectorAll(".rechtlink")].filter(a => a.getClientRects().length).map(a => a.textContent) }));
    pruef(voll.zahlteil, "Voraussetzung: der Zahlteil steht da", voll.zahlteil);
    pruef(voll.links.filter(x => /Impressum/.test(x)).length === 1 && voll.links.filter(x => /Datenschutz/.test(x)).length === 1,
      "gefüllter Korb: jeder Link genau einmal sichtbar (vor dem Knopf)", voll.links.join("|"));
    pruef(fehler.length === 0, "kein Fehler in der Konsole", fehler[0] || "still");
    await ctx.close(); }

  console.log("\n══ 4 · Fußzeile liegt nie hinter der Auswahl-Leiste ══");
  { const { ctx, p, fehler } = await neu(br);
    await p.evaluate(() => { const e = edKandidaten()[0]; merk[e.n] = { n:e.n, p:1, b:"", m:1 }; merkSpeichern(); });
    for(const h of ["impressum", "datenschutz", "haus", "speisekarte", "entdecken"]){
      await p.evaluate(x => { location.hash = "#/" + x; }, h);
      await p.waitForTimeout(700);
      await p.evaluate(() => scrollTo(0, 99999));
      await p.waitForTimeout(300);
      const r = await p.evaluate(() => {
        const bal = [...document.querySelectorAll("body > *")].find(e => /Auswahl ansehen/.test(e.textContent) && getComputedStyle(e).position === "fixed");
        const f = document.querySelector("footer");
        const unten = Math.max(...[...f.querySelectorAll("*")].filter(e => !e.children.length && e.textContent.trim()).map(e => e.getBoundingClientRect().bottom));
        return { bal: bal ? bal.getBoundingClientRect().top : null, unten, sichtbar: bal ? getComputedStyle(bal).opacity : null };
      });
      pruef(r.bal !== null && +r.sichtbar === 1, h + ": Voraussetzung: die Leiste steht da", r.bal);
      pruef(r.unten <= r.bal, h + ": letzte Zeile der Fußzeile endet über der Leiste", Math.round(r.unten) + " ≤ " + Math.round(r.bal));
    }
    pruef(fehler.length === 0, "kein Fehler in der Konsole", fehler[0] || "still");
    await ctx.close(); }

  await br.close();
  console.log("\n" + (f ? f + " von " + n + " FEHLGESCHLAGEN" : "Alles grün (" + n + ")"));
  process.exit(f ? 1 : 0);
})();
