/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Pille der Befehlsleiste (Ball-Übergang zwischen Reitern)

     node pruefungen/pruef-leistenpille.js

   Auftrag: Beim Wechsel zwischen den Reitern der telefontauglichen
   Befehlsleiste soll EIN Element von einem Knopf zum anderen fließen
   — ein Ball, der sich zusammenzieht und hinüberfließt, statt der bisherigen
   zwei unabhängigen Ein-/Ausblendungen (alter Knopf blendet seinen
   eigenen Hintergrund aus, neuer blendet seinen eigenen ein — zwei
   getrennte Bewegungen an zwei Stellen gleichzeitig, kein Zusammenhang
   zwischen ihnen).

   Umsetzung: FLIP (§bewegung) über Web-Animations-API, ausschließlich
   transform (translateX + scaleX), left/width werden nur EINMAL pro
   Wechsel hart gesetzt (kein Layout während der Bewegung). Fällt auf
   den "Mehr"-Knopf zurück, wenn der aktive Reiter im Überlauf-Fach
   liegt (kein Knopf der Leiste selbst ist dann aria-selected=true).

   Gegenbeweis gefahren: die Zeile "pille.animate([...])" testweise
   durch eine leere Anweisung ersetzt (keine Bewegung mehr, nur der
   Sprung durch das harte Setzen von left/width) → "es läuft wirklich
   eine Animation" und "die Mitte zeigt eine Stauchung" wurden rot.
   Zurückgenommen → wieder grün.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const ADMIN = path.join(__dirname, "..", "seiten", "admin.html");
let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

async function board(ctx, reduziert) {
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
  const scharf = await seite.$("#scharfJetzt");
  if (scharf && await seite.isVisible("#scharf")) { await scharf.click(); await seite.waitForTimeout(200); }
  seite._konsole = konsole;
  return seite;
}

(async () => {
  const browser = await chromium.launch();

  console.log("\n══ Ruhelage: Pille sitzt auf dem aktiven Reiter ══");
  const s1 = await board(await browser.newContext({ viewport: { width: 390, height: 844 } }));
  await s1.waitForTimeout(300);
  const ruhe = await s1.evaluate(() => {
    const p = document.getElementById("leistePille");
    const b = document.querySelector('.befehlsleiste [data-tafel="bestellungen"]');
    const pr = p.getBoundingClientRect(), br = b.getBoundingClientRect();
    return { deckt: Math.abs((pr.left + pr.width/2) - (br.left + br.width/2)) < 2, breite: pr.width };
  });
  pruef(ruhe.deckt, "Pille liegt über dem Anfangsreiter (Bestellungen)", JSON.stringify(ruhe));

  console.log("\n══ Übergang: Stauchung in der Mitte, Landung am Ziel ══");
  await s1.click('.befehlsleiste [data-tafel="speisekarte"]');
  const mitte = await s1.evaluate(() => new Promise(res => {
    setTimeout(() => {
      const p = document.getElementById("leistePille");
      const m = getComputedStyle(p).transform.match(/matrix\(([^,]+),/);
      res({ animCount: p.getAnimations().length, skalaX: m ? parseFloat(m[1]) : null });
    }, 150);
  }));
  pruef(mitte.animCount === 1, "eine Animation läuft während des Übergangs", mitte.animCount);
  pruef(mitte.skalaX !== null && mitte.skalaX < 0.98,
    "die Mitte zeigt eine Stauchung (scaleX < 1) — der \"Ball zieht sich zusammen\"",
    "scaleX=" + mitte.skalaX);

  await s1.waitForTimeout(400);
  const gelandet = await s1.evaluate(() => {
    const p = document.getElementById("leistePille");
    const b = document.querySelector('.befehlsleiste [data-tafel="speisekarte"]');
    const pr = p.getBoundingClientRect(), br = b.getBoundingClientRect();
    return {
      deckt: Math.abs((pr.left + pr.width/2) - (br.left + br.width/2)) < 2,
      transformIdentitaet: /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(getComputedStyle(p).transform),
      animCount: p.getAnimations().length,
    };
  });
  pruef(gelandet.deckt, "die Pille landet genau auf dem Zielreiter");
  pruef(gelandet.transformIdentitaet, "der Endzustand hat keinen Rest-transform (Ruhelage)",
    JSON.stringify(gelandet));
  pruef(s1._konsole.length === 0, "keine Ausnahme in der Konsole (Übergang)",
    s1._konsole.join(" | ") || "still");
  await s1.close();

  console.log("\n══ Unterbrechbar: ein zweiter Wechsel mitten im ersten ══");
  const s2 = await board(await browser.newContext({ viewport: { width: 390, height: 844 } }));
  await s2.click('.befehlsleiste [data-tafel="speisekarte"]');
  await s2.waitForTimeout(80); // mitten in der ersten Bewegung
  await s2.click('.befehlsleiste [data-tafel="auswertung"]');
  await s2.waitForTimeout(500);
  const unterbrochen = await s2.evaluate(() => {
    const p = document.getElementById("leistePille");
    const b = document.querySelector('.befehlsleiste [data-tafel="auswertung"]');
    const pr = p.getBoundingClientRect(), br = b.getBoundingClientRect();
    return {
      deckt: Math.abs((pr.left + pr.width/2) - (br.left + br.width/2)) < 2,
      animCount: p.getAnimations().length,
    };
  });
  pruef(unterbrochen.deckt, "landet trotz Unterbrechung sauber am zweiten Ziel", JSON.stringify(unterbrochen));
  pruef(unterbrochen.animCount <= 1, "keine zwei Animationen laufen gleichzeitig weiter", unterbrochen.animCount);
  pruef(s2._konsole.length === 0, "keine Ausnahme in der Konsole (Unterbrechung)",
    s2._konsole.join(" | ") || "still");
  await s2.close();

  console.log("\n══ Überlauf-Reiter aktiv → Pille auf \"Mehr\" ══");
  const s3 = await board(await browser.newContext({ viewport: { width: 390, height: 844 } }));
  await s3.evaluate(() => document.querySelector('.mehrfach [data-tafel="startseite"]').click());
  await s3.waitForTimeout(500);
  const ueberlauf = await s3.evaluate(() => {
    const p = document.getElementById("leistePille");
    const mehr = document.getElementById("mehrKnopf");
    const pr = p.getBoundingClientRect(), mr = mehr.getBoundingClientRect();
    return { deckt: Math.abs((pr.left + pr.width/2) - (mr.left + mr.width/2)) < 2 };
  });
  pruef(ueberlauf.deckt, "kein Knopf der Leiste selbst aktiv → Pille fällt auf \"Mehr\" zurück",
    JSON.stringify(ueberlauf));
  await s3.close();

  console.log("\n══ prefers-reduced-motion: kein Fließen, sofortiger Sprung ══");
  const s4 = await board(await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" }));
  await s4.click('.befehlsleiste [data-tafel="speisekarte"]');
  await s4.waitForTimeout(50);
  const reduziert = await s4.evaluate(() => {
    const p = document.getElementById("leistePille");
    const b = document.querySelector('.befehlsleiste [data-tafel="speisekarte"]');
    const pr = p.getBoundingClientRect(), br = b.getBoundingClientRect();
    return {
      animCount: p.getAnimations().length,
      deckt: Math.abs((pr.left + pr.width/2) - (br.left + br.width/2)) < 2,
    };
  });
  pruef(reduziert.animCount === 0, "keine Animation bei reduzierter Bewegung", reduziert.animCount);
  pruef(reduziert.deckt, "die Pille steht trotzdem sofort am richtigen Platz", JSON.stringify(reduziert));
  await s4.close();

  console.log("\n══ Fensterbreite ändert sich → Pille rastet neu ein, ohne loszufließen ══");
  const s5 = await board(await browser.newContext({ viewport: { width: 390, height: 844 } }));
  await s5.click('.befehlsleiste [data-tafel="auswertung"]');
  await s5.waitForTimeout(500);
  await s5.setViewportSize({ width: 1024, height: 800 }); // Leiste wird display:none
  await s5.waitForTimeout(100);
  await s5.setViewportSize({ width: 390, height: 844 }); // wieder sichtbar
  await s5.waitForTimeout(100);
  const nachDrehung = await s5.evaluate(() => {
    const p = document.getElementById("leistePille");
    const b = document.querySelector('.befehlsleiste [data-tafel="auswertung"]');
    const pr = p.getBoundingClientRect(), br = b.getBoundingClientRect();
    return { deckt: Math.abs((pr.left + pr.width/2) - (br.left + br.width/2)) < 2 };
  });
  pruef(nachDrehung.deckt, "nach Größenwechsel steht die Pille wieder korrekt (kein veralteter Sprung)",
    JSON.stringify(nachDrehung));
  await s5.close();

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
