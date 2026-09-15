/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Schwebende Fußleiste "Gericht hinzufügen" / "Karte einlesen"

     node pruefungen/pruef-kartenknoepfe.js

   Auftrag: .kartenknoepfe soll unter 760px schwebend am unteren Rand
   stehen (über der globalen Reiterleiste, mit Einflug-Animation von
   oben), statt mit der Liste mitzuscrollen — nach demselben Muster
   wie .befehlsleiste/.filterblock im selben File. Über 760px bleibt
   die alte Fließ-Lage unverändert.

   Zwei Testfehler wurden beim Bauen selbst gefunden und korrigiert,
   beide gehören zur Lehre dieser Prüfung:
     - matrix(1,0,0,1,0,0) ist die Identität, genau wie "none" — ein
       String-Vergleich auf "none" allein hätte den echten Endzustand
       fälschlich als Fehler gemeldet.
     - "Letzte Zeile nicht verdeckt" muss NACH dem Scrollen ans Ende
       gemessen werden. Jede fixierte Leiste überlappt Inhalt, der
       noch unterhalb des sichtbaren Fensters liegt — das ist kein
       Fehler, sondern der Normalzustand vor dem Scrollen.

   Gegenbeweis gefahren: position:fixed auf .kartenknoepfe testweise
   auf position:static gesetzt → "ist fixiert (Mobil)" und "Leiste
   steht innerhalb des sichtbaren Fensters" wurden rot. Zurückgenommen
   → grün.
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
  await seite.evaluate(() => document.querySelector('[data-tafel="speisekarte"]').click());
  await seite.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch();

  for (const m of [{ name: "Mobil 390px", width: 390, height: 844 }, { name: "Desktop 1024px", width: 1024, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: { width: m.width, height: m.height } });
    const seite = await ctx.newPage();
    const konsole = [];
    seite.on("pageerror", e => konsole.push(String(e).slice(0, 200)));
    await boardOeffnen(seite);

    console.log("\n══ " + m.name + " ══");

    const info = await seite.evaluate(() => {
      const el = document.querySelector(".kartenknoepfe");
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        position: cs.position, rectBottom: rect.bottom, winH: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    if (m.width <= 760) {
      pruef(info.position === "fixed", "kartenknoepfe ist fixiert (Mobil)", info.position);
      pruef(info.rectBottom <= info.winH + 1, "Leiste steht innerhalb des sichtbaren Fensters", info.rectBottom + " <= " + info.winH);
    } else {
      pruef(info.position !== "fixed", "kartenknoepfe bleibt im Fluss (Desktop, >760px)", info.position);
    }
    pruef(info.scrollWidth === info.clientWidth, "kein horizontales Ueberlaufen",
      "scrollWidth=" + info.scrollWidth + " clientWidth=" + info.clientWidth);

    await seite.waitForTimeout(400);
    const nachher = await seite.evaluate(() => {
      const cs = getComputedStyle(document.querySelector(".kartenknoepfe"));
      return { opacity: cs.opacity, transform: cs.transform };
    });
    pruef(nachher.opacity === "1", "Endzustand: voll sichtbar (opacity 1)", nachher.opacity);
    // matrix(1,0,0,1,0,0) ist die Identitaet, genau wie "none".
    pruef(nachher.transform === "none" || nachher.transform === "matrix(1, 0, 0, 1, 0, 0)",
      "Endzustand: kein Rest-Transform", nachher.transform);

    if (m.width <= 760) {
      await seite.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await seite.waitForTimeout(200);
      const ueberdeckt = await seite.evaluate(() => {
        const knoepfe = document.querySelector(".kartenknoepfe").getBoundingClientRect();
        const gerichte = [...document.querySelectorAll("#karteListe .gzeile")];
        if (!gerichte.length) return null;
        const letzte = gerichte[gerichte.length - 1].getBoundingClientRect();
        return letzte.bottom > knoepfe.top;
      });
      pruef(ueberdeckt === false || ueberdeckt === null,
        "letzte Listenzeile am Ende nicht unter der Leiste verdeckt", String(ueberdeckt));
    }

    pruef(konsole.length === 0, "keine Ausnahme in der Konsole", konsole.join(" | ") || "still");
    await seite.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const seite = await ctx.newPage();
    await boardOeffnen(seite);
    console.log("\n══ prefers-reduced-motion ══");
    const info = await seite.evaluate(() => getComputedStyle(document.querySelector(".kartenknoepfe")).opacity);
    pruef(info === "1", "sofort sichtbar ohne Bewegung", info);
    await seite.close();
  }

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
