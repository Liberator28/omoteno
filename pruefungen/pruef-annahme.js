/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Annahme-Leiste für neue Bestellungen (Block 5)

     node pruefungen/pruef-annahme.js

   Auftrag: eine Bestellung mit status="neu" bekommt eine auffällige,
   grün gerahmte "Bestellung annehmen"/"Ruf annehmen"-Leiste statt der
   stillen "Dauert ca."-Zeile — derselbe Tipp (dieselben data-warte-
   Knöpfe, dieselbe bestaetigen()-Funktion), nur deutlicher gerahmt.
   Eine Bestellung mit status="arbeit" OHNE Zusage (schon angenommen,
   nur die Zeit fehlt noch) bleibt bei der stillen Zeile — sie ist
   nicht mehr "neu", das Personal hat sie längst gesehen.

   Gegenbeweis (dokumentiert, nicht Teil des automatischen Laufs):
   .zusage.neu-Zweig in der Vorlage testweise auf denselben Zweig wie
   ohne .neu zurückgesetzt → "Annahme-Leiste zeigt die auffälligere
   .neu-Klasse" und "Beschriftung nennt eine Annahme" wurden rot,
   "In-Arbeit ohne Zusage bleibt bei der stillen Zeile" blieb grün.
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

async function boardOeffnen(seite) {
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(700);
  await seite.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
  });
  await seite.waitForTimeout(400);
  const scharf = await seite.$("#scharfJetzt");
  if (scharf && await seite.isVisible("#scharf")) { await scharf.click(); await seite.waitForTimeout(200); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const seite = await ctx.newPage();
  const konsole = [];
  seite.on("pageerror", e => konsole.push(String(e).slice(0, 200)));
  await boardOeffnen(seite);

  console.log("\n══ Annahme-Leiste ══");

  /* b1 (Demo-Datensatz): status "neu", keine wartezeit_min. */
  const neu = await seite.evaluate(() => {
    const karte = document.querySelector('.bestellung[data-id="b1"]');
    if (!karte) return null;
    const zusage = karte.querySelector(".zusage");
    if (!zusage) return null;
    const cs = getComputedStyle(zusage);
    return {
      klasse: zusage.className,
      text: zusage.querySelector(".zt") ? zusage.querySelector(".zt").textContent : null,
      hintergrund: cs.backgroundColor,
    };
  });
  pruef(!!neu, "die neue Bestellung (b1) ist auf dem Board");
  if (neu) {
    pruef(neu.klasse.includes("neu"), "Annahme-Leiste zeigt die auffälligere .neu-Klasse", neu.klasse);
    pruef(/annehmen/i.test(neu.text || ""), "Beschriftung nennt eine Annahme", neu.text);
  }

  /* b3 (Demo-Datensatz): status "arbeit", keine wartezeit_min — schon
     angenommen, nur die Zeit fehlt. Muss bei der stillen Zeile bleiben. */
  const inArbeit = await seite.evaluate(() => {
    const karte = document.querySelector('.bestellung[data-id="b3"]');
    if (!karte) return null;
    const zusage = karte.querySelector(".zusage");
    if (!zusage) return null;
    return { klasse: zusage.className, text: zusage.querySelector(".zt").textContent };
  });
  pruef(!!inArbeit, "die Bestellung in Arbeit (b3) ist auf dem Board");
  if (inArbeit) {
    pruef(!inArbeit.klasse.includes("neu"), "In-Arbeit ohne Zusage bleibt bei der stillen Zeile", inArbeit.klasse);
  }

  /* Tapflächen: die Minuten-Knöpfe in der Annahme-Leiste müssen groß
     genug sein — das ist genau die Stelle, an der im Trubel getippt
     wird. */
  const flaechen = await seite.evaluate(() => {
    const karte = document.querySelector('.bestellung[data-id="b1"] .zusage.neu');
    if (!karte) return [];
    return [...karte.querySelectorAll(".zmin")].map(el => el.getBoundingClientRect().height);
  });
  pruef(flaechen.length > 0, "Minuten-Knöpfe in der Annahme-Leiste gefunden", flaechen.length);
  pruef(flaechen.every(h => h >= 44), "jeder Minuten-Knopf ist mindestens 44px hoch", flaechen.join(","));

  /* Der Tipp funktioniert nach wie vor — derselbe Handgriff, nur
     auffälliger gerahmt. Nach dem Tippen verschwindet die Annahme-
     Leiste und macht der Zusage-Anzeige Platz. */
  await seite.evaluate(() => {
    document.querySelector('.bestellung[data-id="b1"] .zusage.neu [data-warte="10"]').click();
  });
  await seite.waitForTimeout(300);
  const danach = await seite.evaluate(() => {
    const karte = document.querySelector('.bestellung[data-id="b1"]');
    const zusage = karte ? karte.querySelector(".zusage") : null;
    return zusage ? { klasse: zusage.className, text: zusage.textContent } : null;
  });
  pruef(!!danach && danach.klasse.includes("an"), "nach dem Tipp steht die Zusage da", danach && danach.klasse);
  pruef(!!danach && /10/.test(danach.text || ""), "mit den richtigen Minuten", danach && danach.text);

  /* Kontrast der grünen Beschriftung auf ihrem eigenen, getönten
     Grund — Tag und Abend, CLAUDE.md §5.2. Echte WCAG-Rechnung aus
     den tatsächlich gemalten rgb()-Werten, nicht nur "Farbe existiert". */
  function relLum([r, g, b]) {
    const v = [r, g, b].map(x => {
      const c = x / 255;
      return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
    });
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
  }
  function parseRgb(s) {
    const roh = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (roh) return [+roh[1], +roh[2], +roh[3]];
    // Chromium gibt eine aus color-mix() berechnete Fläche nicht als
    // rgb(), sondern als "color(srgb r g b)" zurück - Werte 0..1.
    const srgb = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (srgb) return [+srgb[1] * 255, +srgb[2] * 255, +srgb[3] * 255];
    return null;
  }
  function kontrastVerhaeltnis(a, b) {
    const l1 = relLum(a), l2 = relLum(b);
    return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
  }
  for (const phase of ["dunkel", "hell"]) {
    await seite.evaluate(() => { if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); } });
    await seite.evaluate(h => { document.body.classList.toggle("hell", h); }, phase === "hell");
    await seite.waitForTimeout(150);
    const echt = await seite.evaluate(() => {
      const zt = document.querySelector('.bestellung[data-id="b1"] .zusage.neu .zt');
      if (!zt) return null;
      // Die tatsächlich gemalte Fläche hinter der Schrift ist die
      // .zusage.neu-Ebene (color-mix über der Kartenfarbe) — genau
      // die wird gemessen, nicht die Kartenfarbe allein.
      return { farbe: getComputedStyle(zt).color, grund: getComputedStyle(zt.closest(".zusage.neu")).backgroundColor };
    });
    if (echt && echt.farbe && echt.grund) {
      const farbe = parseRgb(echt.farbe), grund = parseRgb(echt.grund);
      const ratio = farbe && grund ? kontrastVerhaeltnis(farbe, grund) : null;
      pruef(ratio !== null && ratio >= 4.5, phase + " · Kontrast der Annahme-Beschriftung ≥ 4.5:1",
        ratio !== null ? ratio.toFixed(2) + ":1" : "nicht messbar (" + echt.farbe + " / " + echt.grund + ")");
    } else {
      pruef(false, phase + " · Kontrast der Annahme-Beschriftung ≥ 4.5:1", "Element nicht gefunden");
    }
  }

  pruef(konsole.length === 0, "keine Ausnahme auf dem ganzen Weg", konsole.join(" | ") || "still");

  await seite.close();
  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
