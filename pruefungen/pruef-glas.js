/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Glas-Flächen (Block 6b, "iPhone-Glas"-Optik)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-glas.js

   pruef-kontrast.js/pruef-lesbarkeit.js prüfen Kontrast allgemein.
   Was sie NICHT prüfen, weil es keine Kontrastfrage ist: steht auf
   jeder neuen/umgestellten Glas-Fläche wirklich ein backdrop-filter,
   und fällt @media (prefers-reduced-transparency:reduce) wirklich auf
   die feste, deckende Fläche zurück statt auf einen Rest an
   Transparenz? Genau das prüft diese Datei — strukturell, an jeder
   der sieben betroffenen Flächen einzeln:

     admin.html   header, #t-bestellungen .filterblock,
                  .befehlsleiste, .kartenknoepfe
     kueche.html  .kopf
     Gast-Hub     .chips, .summe — je Haus (Choco/Blend/Minhkeey),
                  weil color-mix() aus der jeweils eigenen
                  Markenfarbe rechnet (CLAUDE.md §5.1)

   Dazu eine eigene, unabhängige Kontrastrechnung für .summe: Dort
   sitzt Schrift DIREKT auf der Glasfläche (bei .chips nicht — dort
   liegen nur opake Pillen davor, siehe Kommentar im Quelltext). Die
   Fläche wird zur Laufzeit ausgelesen (Alphawert), gegen den
   ungünstigsten plausiblen Hintergrund gemischt — reines Schwarz UND
   reines Weiß, nicht nur die eigene Kartenfarbe, denn .summe ist
   sticky und kann über beliebigem gescrolltem Inhalt stehen.

   Gegenbeweis (am Ende dieser Datei, nicht Teil des Normallaufs):
   --flaeche im Hub testweise auf einen hellen Wert nahe der
   Schriftfarbe gesetzt → die Kontrastprobe für .summe wird rot.
   Zurückgenommen → wieder grün. Belegt, dass die Probe wirklich die
   Glas-Variable misst, nicht zufällig grün bleibt (CLAUDE.md §8.1g).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const HIER = path.resolve(__dirname, "..");
const SEITEN = path.join(HIER, "seiten");
const DIST = path.join(HIER, "dist");

let n = 0, f = 0;
function pruef(gut, text, zusatz) {
  n++; if (!gut) f++;
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz !== undefined ? "  → " + zusatz : ""));
}

/* Dieselbe Falle wie in pruef-lesbarkeit.js/pruef-annahme.js:
   Chromium gibt eine aus color-mix() berechnete Farbe als
   "color(srgb r g b)" mit Werten 0..1 zurück, nicht als rgb(). */
function parseFarbe(s) {
  s = String(s);
  const srgb = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
  if (srgb) {
    const w = [+srgb[1] * 255, +srgb[2] * 255, +srgb[3] * 255];
    w.push(srgb[4] !== undefined ? +srgb[4] : 1);
    return w;
  }
  const roh = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (roh) return [+roh[1], +roh[2], +roh[3], roh[4] !== undefined ? +roh[4] : 1];
  return null;
}
function relLum([r, g, b]) {
  const v = [r, g, b].map(x => { const c = x / 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); });
  return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
}
function kontrast(a, b) { const l1 = relLum(a), l2 = relLum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); }
function mischen(vorne, hinten) {
  const [r, g, b, a = 1] = vorne;
  return [r * a + hinten[0] * (1 - a), g * a + hinten[1] * (1 - a), b * a + hinten[2] * (1 - a)];
}
/* Ungünstigster Fall: die Glasfarbe über reinem Schwarz UND reinem
   Weiß gemischt, Text ohne eigene Transparenz obendrauf. Der
   schlechtere der beiden Werte zählt. */
function schlechtesterFall(textRgb, glasRgba) {
  const schwarz = mischen(glasRgba, [0, 0, 0]);
  const weiss = mischen(glasRgba, [255, 255, 255]);
  return Math.min(kontrast(textRgb, schwarz), kontrast(textRgb, weiss));
}

async function pruefeGlasflaeche(seite, selektor, { erwartetVar } = {}) {
  return seite.evaluate(([sel]) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const bf = cs.backdropFilter || cs.webkitBackdropFilter || "";
    return {
      backdropFilter: bf,
      backgroundColor: cs.backgroundColor,
      boxShadow: cs.boxShadow,
    };
  }, [selektor]);
}

async function reduzierteTransparenz(seite, an) {
  const cdp = await seite.context().newCDPSession(seite);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: an ? [{ name: "prefers-reduced-transparency", value: "reduce" }] : [],
  });
}

/* ── Admin-Board ── */
async function boardOeffnen(seite) {
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + path.join(SEITEN, "admin.html"));
  await seite.waitForTimeout(700);
  await seite.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
  });
  await seite.waitForTimeout(400);
  const scharf = await seite.$("#scharfJetzt");
  if (scharf && await seite.isVisible("#scharf")) { await scharf.click(); await seite.waitForTimeout(200); }
}

async function pruefeAdminUndKueche(browser) {
  console.log("\n══ Admin-Board ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const seite = await ctx.newPage();
    await boardOeffnen(seite);
    await seite.evaluate(() => document.querySelector('[data-tafel="speisekarte"]').click());
    await seite.waitForTimeout(300);

    for (const sel of ["header", "#t-bestellungen .filterblock", ".befehlsleiste", ".kartenknoepfe"]) {
      const v = await pruefeGlasflaeche(seite, sel);
      pruef(!!v, sel + " ist im Baum", v ? "gefunden" : "fehlt");
      if (!v) continue;
      pruef(/blur\(/.test(v.backdropFilter), sel + " trägt backdrop-filter:blur(...)", v.backdropFilter || "(leer)");
    }
    /* Kopf/Filterleiste tragen jetzt eine spekulare Kante. */
    const kopfSchatten = await seite.evaluate(() => getComputedStyle(document.querySelector("header")).boxShadow);
    pruef(kopfSchatten !== "none", "header hat eine spekulare Kante (box-shadow)", kopfSchatten);

    await reduzierteTransparenz(seite, true);
    await seite.waitForTimeout(150);
    for (const sel of ["header", "#t-bestellungen .filterblock", ".befehlsleiste", ".kartenknoepfe"]) {
      const v = await pruefeGlasflaeche(seite, sel);
      if (!v) continue;
      pruef(!/blur\(/.test(v.backdropFilter), sel + " · prefers-reduced-transparency: kein blur mehr", v.backdropFilter || "(leer/none)");
      const farbe = parseFarbe(v.backgroundColor);
      pruef(!!farbe && farbe[3] === undefined ? true : (!farbe || farbe.length < 4 || farbe[3] === 1),
        sel + " · Fläche ist wieder deckend (kein Rest-Transparenz)", v.backgroundColor);
    }
    await reduzierteTransparenz(seite, false);
    await ctx.close();
  }

  console.log("\n══ Küchendisplay ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const seite = await ctx.newPage();
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + path.join(SEITEN, "kueche.html"));
    await seite.waitForTimeout(500);

    for (const [lage, hell] of [["dunkel", false], ["hell", true]]) {
      await seite.evaluate(h => document.body.classList.toggle("hell", h), hell);
      await seite.waitForTimeout(150);
      const v = await pruefeGlasflaeche(seite, ".kopf");
      pruef(!!v, lage + " · .kopf ist im Baum");
      if (!v) continue;
      pruef(/blur\(/.test(v.backdropFilter), lage + " · .kopf trägt backdrop-filter:blur(...)", v.backdropFilter);
      pruef(v.boxShadow !== "none", lage + " · .kopf hat eine spekulare Kante", v.boxShadow);
    }

    await reduzierteTransparenz(seite, true);
    await seite.waitForTimeout(150);
    const v2 = await pruefeGlasflaeche(seite, ".kopf");
    pruef(!/blur\(/.test(v2.backdropFilter), "prefers-reduced-transparency: .kopf ohne blur", v2.backdropFilter || "(leer/none)");
    await reduzierteTransparenz(seite, false);
    await ctx.close();
  }
}

/* ── Gast-Hub, je Haus ── */
async function pruefeHub(browser) {
  console.log("\n══ Gast-Hub ══");
  if (!fs.existsSync(DIST)) { console.log("  kein dist/ erzeugt, übersprungen"); return; }
  const haeuser = fs.readdirSync(DIST).filter(x => fs.existsSync(path.join(DIST, x, "index.html")));
  if (!haeuser.length) { console.log("  kein erzeugter Hub, übersprungen"); return; }

  for (const slug of haeuser) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const seite = await ctx.newPage();
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    /* Der Willkommensschirm liegt sonst über allem — derselbe Umweg
       wie in pruef-lesbarkeit.js. */
    await seite.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){} });
    await seite.goto("file://" + path.join(DIST, slug, "index.html"));
    await seite.waitForTimeout(700);

    /* .chips steht auf der Speisekarte. */
    await seite.evaluate(() => { location.hash = "#/speisekarte"; });
    await seite.waitForTimeout(400);
    {
      const v = await pruefeGlasflaeche(seite, ".chips");
      pruef(!!v, slug + " · .chips ist im Baum", v ? "gefunden" : "fehlt");
      if (v) pruef(/blur\(/.test(v.backdropFilter), slug + " · .chips trägt backdrop-filter:blur(...)", v.backdropFilter || "(leer)");
    }

    /* .summe braucht einen gefüllten Korb — zwei Gerichte merken,
       dann zur Auswahl wechseln (Muster aus pruef-durchgang.js). */
    await seite.evaluate(() => {
      const els = document.querySelectorAll("[data-merk]");
      if (els[0]) els[0].click();
      if (els[1]) els[1].click();
    });
    await seite.waitForTimeout(300);
    await seite.evaluate(() => { location.hash = "#/auswahl"; });
    await seite.waitForTimeout(400);
    {
      const v = await pruefeGlasflaeche(seite, ".summe");
      pruef(!!v, slug + " · .summe ist im Baum (Korb gefüllt)", v ? "gefunden" : "fehlt — Korb leer geblieben?");
      if (v) pruef(/blur\(/.test(v.backdropFilter), slug + " · .summe trägt backdrop-filter:blur(...)", v.backdropFilter || "(leer)");
    }

    /* Kontrast von .summe direkt gegen den ungünstigsten Fall (Schwarz
       UND Weiß dahinter), nicht nur gegen die eigene Kartenfarbe —
       .summe ist sticky und kann über beliebigem Inhalt stehen. */
    for (const lage of ["dunkel", "hell"]) {
      await seite.evaluate(l => { if (typeof lichtSetzen === "function") lichtSetzen(l); }, lage);
      /* body{color:…} trägt eine 0,9s-Übergangszeit (Zeile 249) — vor
         dem Ablauf gemessen liest man eine echte, aber vorübergehende
         Zwischenfarbe. Vorfall beim ersten Lauf dieser Datei: Choco
         dunkel maß so 1,11:1 statt der tatsächlichen ~9:1. */
      await seite.waitForTimeout(1000);
      const echt = await seite.evaluate(() => {
        const summe = document.querySelector(".summe");
        const b = summe ? summe.querySelector(".b") : null;
        if (!summe || !b) return null;
        return { farbe: getComputedStyle(b).color, grund: getComputedStyle(summe).backgroundColor };
      });
      if (!echt) { pruef(false, slug + " · " + lage + " · .summe .b gefunden"); continue; }
      const textRgb = parseFarbe(echt.farbe);
      const glasRgba = parseFarbe(echt.grund);
      if (!textRgb || !glasRgba) { pruef(false, slug + " · " + lage + " · Farben lesbar", echt.farbe + " / " + echt.grund); continue; }
      const wert = schlechtesterFall(textRgb, glasRgba);
      pruef(wert >= 4.5, slug + " · " + lage + " · .summe-Schrift ≥ 4.5:1 gegen Schwarz UND Weiß dahinter",
        wert.toFixed(2) + ":1");

      /* Die Glas-Pille „‹ Zurück“ (08.10.) klebt beim Rollen über
         beliebigem Inhalt — dieselbe Rechnung wie bei .summe. */
      const zk = await seite.evaluate(() => {
        const z = document.getElementById("zurueck"), t = z && z.querySelector(".zr-text");
        if (!z || !t || !z.classList.contains("an")) return null;
        return { farbe: getComputedStyle(t).color, grund: getComputedStyle(z).backgroundColor,
                 bf: getComputedStyle(z).backdropFilter };
      });
      if (!zk) { pruef(false, slug + " · " + lage + " · Zurück-Pille sichtbar (Voraussetzung)"); continue; }
      pruef(/blur\(/.test(zk.bf), slug + " · " + lage + " · Zurück-Pille trägt backdrop-filter:blur(...)", zk.bf || "(leer)");
      const wz = schlechtesterFall(parseFarbe(zk.farbe), parseFarbe(zk.grund));
      pruef(wz >= 4.5, slug + " · " + lage + " · Zurück-Schrift ≥ 4.5:1 gegen Schwarz UND Weiß dahinter", wz.toFixed(2) + ":1");
    }
    await ctx.close();
  }
  return haeuser[0];
}

/* ── Gegenbeweis: eine Glas-Variable sabotieren, Probe muss rot werden ── */
async function gegenbeweis(browser, slug) {
  console.log("\n══ Gegenbeweis (nicht Teil des Normallaufs) ══");
  if (!slug) { console.log("  kein Hub verfügbar, übersprungen"); return; }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const seite = await ctx.newPage();
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){} });
  await seite.goto("file://" + path.join(DIST, slug, "index.html"));
  await seite.waitForTimeout(700);
  await seite.evaluate(() => { location.hash = "#/speisekarte"; });
  await seite.waitForTimeout(400);
  await seite.evaluate(() => {
    const els = document.querySelectorAll("[data-merk]");
    if (els[0]) els[0].click();
    if (els[1]) els[1].click();
  });
  await seite.waitForTimeout(300);
  await seite.evaluate(() => { location.hash = "#/auswahl"; });
  await seite.waitForTimeout(400);
  await seite.evaluate(() => { if (typeof lichtSetzen === "function") lichtSetzen("hell"); });
  await seite.waitForTimeout(1000);

  const vorher = await seite.evaluate(() => {
    const summe = document.querySelector(".summe"), b = summe && summe.querySelector(".b");
    return b ? { farbe: getComputedStyle(b).color, grund: getComputedStyle(summe).backgroundColor } : null;
  });
  if (!vorher) { pruef(false, "Gegenbeweis: .summe .b nicht gefunden — Korb leer geblieben?"); await ctx.close(); return; }

  /* Den echten, gerade aktiven Wert von --flaeche sichern — er steht
     als Inline-Angabe auf <html> (markeAnwenden(), nicht im Blatt).
     removeProperty() würde NICHT auf den vorherigen Laufzeitwert
     zurückfallen, sondern auf den Vorgabewert aus :root (Tag-Palette)
     — beim ersten Lauf dieser Datei genau deshalb rot geblieben, wo
     "zurückgenommen" grün sein sollte. Der echte Wert wird deshalb
     gesichert und explizit zurückgeschrieben, nicht entfernt. */
  const echtesFlaeche = await seite.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--flaeche").trim());

  /* --flaeche auf die Schriftfarbe selbst setzen — der denkbar
     schlechteste Fall, muss die Probe zuverlässig durchschlagen. */
  await seite.evaluate(farbe => { document.documentElement.style.setProperty("--flaeche", farbe); }, vorher.farbe);
  await seite.waitForTimeout(150);
  const nachher = await seite.evaluate(() => {
    const summe = document.querySelector(".summe"), b = summe && summe.querySelector(".b");
    return b ? { farbe: getComputedStyle(b).color, grund: getComputedStyle(summe).backgroundColor } : null;
  });
  const textRgb = parseFarbe(nachher.farbe), glasRgba = parseFarbe(nachher.grund);
  const wertSabotiert = schlechtesterFall(textRgb, glasRgba);
  pruef(wertSabotiert < 4.5, "sabotierte --flaeche (= Schriftfarbe) wird als Verstoß erkannt", wertSabotiert.toFixed(2) + ":1");

  await seite.evaluate(w => { document.documentElement.style.setProperty("--flaeche", w); }, echtesFlaeche);
  await seite.waitForTimeout(150);
  const zurueck = await seite.evaluate(() => {
    const summe = document.querySelector(".summe"), b = summe && summe.querySelector(".b");
    return b ? { farbe: getComputedStyle(b).color, grund: getComputedStyle(summe).backgroundColor } : null;
  });
  const wertZurueck = schlechtesterFall(parseFarbe(zurueck.farbe), parseFarbe(zurueck.grund));
  pruef(wertZurueck >= 4.5, "zurückgenommen → wieder ≥ 4.5:1", wertZurueck.toFixed(2) + ":1");

  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await pruefeAdminUndKueche(browser);
  const ersterHub = await pruefeHub(browser);
  await gegenbeweis(browser, ersterHub);
  await browser.close();

  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
