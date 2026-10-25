/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Eindrücken der Gericht-Karte und gestaffeltes Öffnen des Blatts

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-eindruecken.js

   > 24.10.: „Die Effekte, wenn man auf eine Speise klickt, sollen smoother
   > sein und sich reindrücken, mit mehr Animationen und Bewegungseffekten.“

   Gemessen wird am echten Zeiger (Maus UND Finger über CDP), nicht an :active:
   1 · Aufsetzen → nach 55 ms duckt sich die Karte (scale ≈ .972), das Foto
       darin wächst (≈ 1.07), die Tönung liegt darüber; Nachbarkarten bleiben
       auf den Pixel an ihrem Platz (nur transform).
   2 · Loslassen → die Karte federt zurück: nach der Bewegung scale = 1,
       Klasse weg; ein kurzer Tipp zeigt den Eindruck TROTZDEM (≥ 100 ms).
   3 · Der „+“-Knopf löst KEINEN Eindruck der Karte aus.
   4 · Ein Finger, der zum Rollen aufsetzt und zieht, hinterlässt nichts
       (kein hängender Eindruck, nach pointercancel/Zug weg); Zweiter Tipp
       gleich nach dem ersten: nie zwei Karten zugleich eingedrückt.
   5 · Blatt: .oeffnet nur kurz nach dem Öffnen; die Kinder laufen gestaffelt
       (≥ 3 Animationen, nur transform/opacity, Endzustand steht: Deckkraft 1,
       kein transform); Neuzeichnen IM offenen Blatt spielt nichts erneut ab;
       das Blatt tritt heran (geschlossen kleiner als offen).
   6 · Reduzierte Bewegung: kein Eindruck (transform none auch beim Drücken),
       keine Animation, alles sichtbar.
   7 · Alle Häuser, Liste und Raster (Kartenstil), Premium und klassisch.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OBEN = path.join(__dirname, "..");
const DIST = process.env.DIST || path.join(OBEN, "dist");
let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if(!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };
const HAEUSER = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html")));

async function offen(br, haus, opt){
  opt = opt || {};
  const ctx = await br.newContext({ viewport:{ width:390, height:844 }, hasTouch:!!opt.touch, isMobile:!!opt.touch, reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  const p = await ctx.newPage(); const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 140)));
  await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
  /* Die Fotos liegen nicht im erzeugten Ordner — ohne Antwort entfernt der Hub das Bild (onerror) und die Fotoprobe wäre ein
     grünes Nichts. Jedes Foto bekommt ein echtes, kleines PNG. */
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAAJNAH/XYm2NwAAAABJRU5ErkJggg==", "base64");
  await p.route("**/*", r => { const u = r.request().url();
    if(/\/bilder\/.*\.(webp|png|jpe?g)/i.test(u)) return r.fulfill({ status:200, contentType:"image/png", body:PNG });
    return u.startsWith("file://") ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }); });
  await p.goto("file://" + path.join(DIST, haus, "index.html") + "#/speisekarte");
  await p.waitForTimeout(1300);
  /* html{scroll-behavior:smooth} verfälscht jede Messung nach scrollIntoView (skill bewegung §9). */
  await p.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  return { ctx, p, fehler };
}
const matrixA = s => { const m = String(s).match(/matrix\(([^)]+)\)/); return m ? +m[1].split(",")[0] : 1; };
const stand = (p, i) => p.evaluate(i => {
  const k = [...document.querySelectorAll(".ginfo[data-detail]")].map(x => x.closest(".gericht"))[i];
  if(!k) return null;
  const img = k.querySelector(".gbild img"), cs = getComputedStyle(k);
  return { druck:k.classList.contains("druck"), a:cs.transform, bild: img ? getComputedStyle(img).transform : "none", ton:+getComputedStyle(k, "::after").opacity };
}, i);
const mitte = (p, i) => p.evaluate(i => { const e = [...document.querySelectorAll(".ginfo[data-detail]")][i]; e.scrollIntoView({ block:"center" });
  const g = e.getBoundingClientRect(); return { x:Math.round(g.left + g.width * .3), y:Math.round(g.top + g.height / 2) }; }, i);

(async () => {
  const br = await chromium.launch();
  for(const haus of HAEUSER){
    console.log("\n══ " + haus + " ══");
    const { ctx, p, fehler } = await offen(br, haus);
    const anzahl = await p.evaluate(() => document.querySelectorAll(".ginfo[data-detail]").length);
    pruef(anzahl >= 3, "Voraussetzung: mindestens drei Gerichte zum Antippen", anzahl);
    /* Eine Karte MIT Foto wählen (sonst bliebe die Fotoprobe ein grünes Nichts, §8.1g); wo keine ist, die zweite. */
    const mitFoto = await p.evaluate(() => [...document.querySelectorAll(".ginfo[data-detail]")].findIndex((x, k) => k >= 1 && k < 40 && !!x.querySelector(".gbild img")));
    const i = mitFoto >= 1 ? mitFoto : 1;
    if(haus === "chocolamour") pruef(mitFoto >= 1, "Voraussetzung: Chocos Karte hat Gerichte mit Foto (Fotoprobe läuft)", "Karte " + mitFoto);
    const pos = await mitte(p, i);
    await p.waitForTimeout(450);      /* klebende Leiste und Bilder setzen sich, bevor gemessen wird */
    const nachbar0 = await p.evaluate(i => { const k = [...document.querySelectorAll(".ginfo[data-detail]")].map(x => x.closest(".gericht")); const r = x => { const b = x.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round).join(","); };
      return [r(k[i - 1]), r(k[i + 1])]; }, i);
    const vorher = await stand(p, i);
    await p.mouse.move(pos.x, pos.y); await p.mouse.down();
    await p.waitForTimeout(260);
    const unten = await stand(p, i);
    const nachbar1 = await p.evaluate(i => { const k = [...document.querySelectorAll(".ginfo[data-detail]")].map(x => x.closest(".gericht")); const r = x => { const b = x.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round).join(","); };
      return [r(k[i - 1]), r(k[i + 1])]; }, i);
    const sc = matrixA(unten.a), scBild = unten.bild === "none" ? null : matrixA(unten.bild);
    pruef(!vorher.druck && matrixA(vorher.a) === 1 && unten.druck && sc > .96 && sc < .98, "Aufsetzen: Karte duckt sich auf ≈ .972", "vorher " + matrixA(vorher.a) + ", gedrückt " + sc.toFixed(3));
    pruef(unten.ton > .03 && unten.ton < .09, "Aufsetzen: Tönung liegt über der Karte (Tiefe)", unten.ton.toFixed(3));
    pruef(scBild === null ? haus !== "chocolamour" : (scBild > 1.04 && scBild < 1.1), "Aufsetzen: das Foto darin wächst gegen den Druck (≈ 1.07)", scBild === null ? "kein Foto an dieser Karte (" + unten.bild + ")" : scBild.toFixed(3));
    pruef(JSON.stringify(nachbar0) === JSON.stringify(nachbar1), "Aufsetzen: die Nachbarkarten bleiben auf den Pixel an ihrem Platz", JSON.stringify(nachbar0) + " / " + JSON.stringify(nachbar1));
    await p.mouse.up();
    /* Der Tipp öffnet das Blatt; zurück zur Liste, um das Federn zu messen */
    await p.waitForTimeout(150);
    await p.evaluate(() => detailSchliessen()); await p.waitForTimeout(700);
    const danach = await stand(p, i);
    pruef(!danach.druck && Math.abs(matrixA(danach.a) - 1) < .001, "Loslassen: Karte steht wieder bei 1, Klasse weg", danach.a);

    /* Kurzer Tipp: Der Eindruck ist trotzdem einmal zu sehen */
    const pos2 = await mitte(p, 2);
    await p.evaluate(() => { window.__sah = 0; const k = [...document.querySelectorAll(".ginfo[data-detail]")][2].closest(".gericht");
      new MutationObserver(() => { if(k.classList.contains("druck")) window.__sah = Math.max(window.__sah, performance.now()); }).observe(k, { attributes:true, attributeFilter:["class"] });
      window.__weg = 0; new MutationObserver(() => { if(!k.classList.contains("druck") && window.__sah) window.__weg = window.__weg || performance.now(); }).observe(k, { attributes:true, attributeFilter:["class"] }); });
    await p.mouse.move(pos2.x, pos2.y); await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(500);
    const kurz = await p.evaluate(() => ({ sah:window.__sah, weg:window.__weg }));
    pruef(kurz.sah > 0 && kurz.weg - kurz.sah >= 90, "kurzer Tipp: der Eindruck war zu sehen und blieb mindestens 100 ms", "gesehen, " + Math.round(kurz.weg - kurz.sah) + " ms");
    await p.evaluate(() => detailSchliessen()); await p.waitForTimeout(600);

    /* + Knopf */
    const plus = await p.evaluate(() => { const b = document.querySelector(".gplus[data-merk]"); if(!b) return null; b.scrollIntoView({ block:"center" }); const r = b.getBoundingClientRect(); return { x:Math.round(r.left + r.width / 2), y:Math.round(r.top + r.height / 2) }; });
    if(plus){
      await p.mouse.move(plus.x, plus.y); await p.mouse.down(); await p.waitForTimeout(200);
      const eind = await p.evaluate(() => document.querySelectorAll(".druck").length);
      await p.mouse.up(); await p.waitForTimeout(300);
      pruef(eind === 0, "„+“ drücken löst KEINEN Eindruck der Karte aus", eind + " eingedrückt");
    }
    pruef(!fehler.length, "kein Seitenfehler", fehler.join(" | "));
    await ctx.close();
  }

  console.log("\n══ Finger: Rollen hinterlässt nichts, zweiter Tipp ══");
  {
    const { ctx, p } = await offen(br, "chocolamour", { touch:true });
    const cdp = await ctx.newCDPSession(p);
    const pos = await mitte(p, 1);
    const touch = (typ, x, y) => cdp.send("Input.dispatchTouchEvent", { type:typ, touchPoints: typ === "touchEnd" ? [] : [{ x, y, id:1 }] });
    await touch("touchStart", pos.x, pos.y); await p.waitForTimeout(80);
    const waehrend = await p.evaluate(() => document.querySelectorAll(".druck").length);
    for(let k = 1; k <= 6; k++){ await touch("touchMove", pos.x, pos.y - k * 12); await p.waitForTimeout(16); }
    await p.waitForTimeout(250);
    const gezogen = await p.evaluate(() => document.querySelectorAll(".druck").length);
    await touch("touchEnd");
    await p.waitForTimeout(500);
    const ende = await p.evaluate(() => ({ druck:document.querySelectorAll(".druck").length, blatt:document.querySelector(".warenkarte").classList.contains("an") }));
    pruef(waehrend <= 1 && gezogen === 0 && ende.druck === 0 && !ende.blatt, "Finger setzt auf, zieht 72 px (Rollen): nach dem Zug nichts eingedrückt, kein Blatt geöffnet", JSON.stringify({ waehrend, gezogen, ende }));
    const pos3 = await mitte(p, 3);
    await touch("touchStart", pos3.x, pos3.y); await p.waitForTimeout(90);
    const eins = await p.evaluate(() => document.querySelectorAll(".druck").length);
    await touch("touchEnd");
    await p.waitForTimeout(30);
    const pos4 = await mitte(p, 4);
    await touch("touchStart", pos4.x, pos4.y); await p.waitForTimeout(90);
    const zwei = await p.evaluate(() => document.querySelectorAll(".druck").length);
    await touch("touchEnd"); await p.waitForTimeout(600);
    const rest = await p.evaluate(() => document.querySelectorAll(".druck").length);
    pruef(eins === 1 && zwei <= 2 && rest === 0, "zwei Tipps kurz nacheinander: nie mehr als zwei Karten, am Ende keine eingedrückt", [eins, zwei, rest].join(" / "));
    await ctx.close();
  }

  console.log("\n══ Blatt: Staffelung, nur kurz, nichts erneut, Endzustand ══");
  for(const haus of ["chocolamour", "piugusto"]){
    const { ctx, p } = await offen(br, haus);
    const name = await p.evaluate(() => document.querySelector("[data-detail]").getAttribute("data-detail"));
    await p.evaluate(nm => detailOeffnen(decodeURIComponent(nm)), name);
    await p.waitForTimeout(120);
    const mitten = await p.evaluate(() => { const k = document.getElementById("warenkarte");
      const an = k.getAnimations({ subtree:true }).filter(a => a.animationName && /^wk/.test(a.animationName));
      const fremd = new Set(); an.forEach(a => (a.effect.getKeyframes() || []).forEach(kf => Object.keys(kf).forEach(x => { if(!["offset", "computedOffset", "easing", "composite", "transform", "opacity"].includes(x)) fremd.add(x); })));
      return { oeffnet:k.classList.contains("oeffnet"), laeuft:an.length, namen:[...new Set(an.map(a => a.animationName))], fremd:[...fremd] }; });
    pruef(mitten.oeffnet && mitten.laeuft >= 3 && mitten.namen.includes("wkRein") && (haus !== "chocolamour" || mitten.namen.includes("wkBild")) && !mitten.fremd.length, haus + ": nach dem Öffnen laufen ≥ 3 gestaffelte Animationen, nur transform/opacity", JSON.stringify(mitten));
    await p.waitForTimeout(1300);
    const spaet = await p.evaluate(() => { const k = document.getElementById("warenkarte");
      const kinder = [...k.children].filter(c => c.getBoundingClientRect().height > 0);
      return { oeffnet:k.classList.contains("oeffnet"), laeuft:k.getAnimations({ subtree:true }).filter(a => a.animationName && /^wk/.test(a.animationName) && a.playState === "running").length,
        alleDa:kinder.every(c => getComputedStyle(c).opacity === "1" && /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(getComputedStyle(c).transform)), n:kinder.length, skal:getComputedStyle(k).transform }; });
    pruef(!spaet.oeffnet && spaet.laeuft === 0 && spaet.alleDa, haus + ": nach 1,3 s ist es ruhig, jeder Teil steht da (Deckkraft 1, kein transform)", JSON.stringify(spaet));
    /* Neuzeichnen im offenen Blatt (z. B. andere Zutat, Sprache): nichts spielt erneut */
    await p.evaluate(() => { const k = document.getElementById("warenkarte"); const h = k.innerHTML; k.innerHTML = h; });
    await p.waitForTimeout(120);
    const nochmal = await p.evaluate(() => document.getElementById("warenkarte").getAnimations({ subtree:true }).filter(a => a.animationName && /^wk/.test(a.animationName)).length);
    pruef(nochmal === 0, haus + ": Neuzeichnen im offenen Blatt spielt die Staffelung NICHT erneut ab", nochmal + " Animationen");
    /* Das Blatt tritt heran: geschlossen kleiner */
    await p.evaluate(() => detailSchliessen()); await p.waitForTimeout(700);
    const zu = await p.evaluate(() => matrixA => getComputedStyle(document.getElementById("warenkarte")).transform).catch(() => null);
    const zuM = await p.evaluate(() => getComputedStyle(document.getElementById("warenkarte")).transform);
    const m = zuM.match(/matrix\(([^)]+)\)/); const skalZu = m ? +m[1].split(",")[0] : 1;
    pruef(skalZu < 1 && skalZu > .9, haus + ": geschlossen steht das Blatt etwas kleiner (tritt beim Öffnen heran)", skalZu.toFixed(3));
    await ctx.close();
  }

  console.log("\n══ Reduzierte Bewegung ══");
  {
    const { ctx, p } = await offen(br, "chocolamour", { ruhig:true });
    const pos = await mitte(p, 1);
    await p.mouse.move(pos.x, pos.y); await p.mouse.down(); await p.waitForTimeout(250);
    const r = await stand(p, 1);
    await p.mouse.up(); await p.waitForTimeout(200);
    pruef(r && (r.a === "none" || matrixA(r.a) === 1) && (r.bild === "none" || matrixA(r.bild) === 1), "reduzierte Bewegung: beim Drücken kein Skalieren, weder Karte noch Foto", JSON.stringify(r));
    await p.evaluate(() => detailSchliessen()); await p.waitForTimeout(400);
    const name = await p.evaluate(() => document.querySelector("[data-detail]").getAttribute("data-detail"));
    await p.evaluate(nm => detailOeffnen(decodeURIComponent(nm)), name);
    await p.waitForTimeout(250);
    const o = await p.evaluate(() => { const k = document.getElementById("warenkarte");
      return { lauf:k.getAnimations({ subtree:true }).filter(a => a.animationName && /^wk/.test(a.animationName) && a.playState === "running").length,
        sichtbar:[...k.children].filter(c => c.getBoundingClientRect().height > 0).every(c => getComputedStyle(c).opacity === "1") }; });
    pruef(o.lauf === 0 && o.sichtbar, "reduzierte Bewegung: im Blatt läuft keine Staffelung, alles ist sichtbar", JSON.stringify(o));
    await ctx.close();
  }

  await br.close();
  console.log("\n" + (f ? f + " Fehler" : "Alles sauber.") + " (" + n + " Proben)");
  process.exit(f ? 1 : 0);
})();
