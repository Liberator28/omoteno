/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Aufklappbare Gerichte-Zeilen in der Speisekarte

     node pruefungen/pruef-speisekarte-klapp.js

   Auftrag: Jede Gerichte-Zeile im Admin-Board soll zugeklappt nur
   Name + Preis zeigen (spart die Zeile, die vorher für die
   abgeschnittene Beschreibung draufging) und beim Antippen
   Beschreibung + Allergene vollständig zeigen — Baustein wie
   .kbklapp/.kbsymknopf (Kachel-Baukasten), nicht neu erfunden.
   "Bearbeiten" bleibt eine EIGENE Geste und öffnet weiterhin das
   echte Bearbeiten-Blatt, statt vom Aufklapp-Klick verschluckt zu
   werden.

   Der Zustand "welche Zeile ist offen" steht in offeneGerichte
   (admin.html), weil zeichneKarte() #karteListe bei jeder Suche/
   Verschiebung komplett neu baut — ein reiner DOM-Zustand
   (aria-expanded) wäre dabei jedes Mal weg.

   Gegenbeweis gefahren: den Eintrag "offeneGerichte.add(...)" im
   Klapp-Handler testweise durch eine leere Anweisung ersetzt →
   "offen bleibt offen nach Suchfeld-Neuzeichnen" wurde rot.
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

async function board(ctx) {
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
  await seite.click('.befehlsleiste [data-tafel="speisekarte"]');
  await seite.waitForTimeout(300);
  seite._konsole = konsole;
  return seite;
}

(async () => {
  const browser = await chromium.launch();

  console.log("\n══ Ruhelage: nur Name + Preis, kein Beschreibungstext im Kopf ══");
  const s1 = await board(await browser.newContext({ viewport: { width: 390, height: 844 } }));
  const ruhe = await s1.evaluate(() => {
    const kopf = document.querySelector("#karteListe .gkopf");
    const panel = document.getElementById(kopf.getAttribute("aria-controls"));
    return {
      geschlossen: kopf.getAttribute("aria-expanded") === "false",
      panelZu: !panel.classList.contains("offen"),
      keinBeschrImKopf: !kopf.querySelector(".gbeschrvoll"),
      hatPreis: !!kopf.querySelector(".gpreis"),
    };
  });
  pruef(ruhe.geschlossen && ruhe.panelZu, "Zeile startet zugeklappt", JSON.stringify(ruhe));
  pruef(ruhe.keinBeschrImKopf && ruhe.hatPreis, "zugeklappt zeigt nur Name/Preis, keine Beschreibung");

  const kopfBox = await (await s1.$("#karteListe .gkopf")).boundingBox();
  pruef(kopfBox.height >= 44, "Tap-Fläche der Zeile ≥44px (§8.1d)", kopfBox.height.toFixed(1) + "px");

  console.log("\n══ Aufklappen zeigt Beschreibung + Bearbeiten-Knopf ══");
  await s1.click("#karteListe .gkopf");
  await s1.waitForTimeout(450);
  const auf = await s1.evaluate(() => {
    const kopf = document.querySelector("#karteListe .gkopf");
    const panel = document.getElementById(kopf.getAttribute("aria-controls"));
    const beschr = panel.querySelector(".gbeschrvoll");
    const bearbeiten = panel.querySelector("[data-bearbeiten]");
    return {
      offen: kopf.getAttribute("aria-expanded") === "true" && panel.classList.contains("offen"),
      beschrSichtbar: beschr && beschr.getBoundingClientRect().height > 0,
      hatBearbeiten: !!bearbeiten,
    };
  });
  pruef(auf.offen, "Klick klappt auf (aria-expanded + .offen)");
  pruef(auf.beschrSichtbar, "Beschreibung wird sichtbar");
  pruef(auf.hatBearbeiten, "Bearbeiten-Knopf steht im aufgeklappten Bereich");

  const bearbBox = await s1.evaluate(() => {
    const b = document.querySelector("#karteListe .kbklapp.offen [data-bearbeiten]");
    const r = b.getBoundingClientRect();
    return { h: r.height };
  });
  pruef(bearbBox.h >= 44, "Bearbeiten-Knopf ≥44px hoch (§8.1d)", bearbBox.h.toFixed(1) + "px");

  console.log("\n══ Bearbeiten öffnet weiterhin das echte Blatt, nicht nur die Klapp-Geste ══");
  await s1.click("#karteListe .kbklapp.offen [data-bearbeiten]");
  await s1.waitForTimeout(350);
  const blatt = await s1.evaluate(() => {
    const b = document.querySelector(".blatt:not([hidden])");
    return { da: !!b, titel: document.getElementById("blattTitel")?.textContent || "" };
  });
  pruef(blatt.da && /bearbeiten/i.test(blatt.titel), "echtes Bearbeiten-Blatt geht auf", JSON.stringify(blatt));
  await s1.evaluate(() => { if (typeof blattSchliessen === "function") blattSchliessen(); });
  await s1.waitForTimeout(500);

  console.log("\n══ Zuklappen ══");
  await s1.click("#karteListe .gkopf");
  await s1.waitForTimeout(450);
  const zu = await s1.evaluate(() => {
    const kopf = document.querySelector("#karteListe .gkopf");
    const panel = document.getElementById(kopf.getAttribute("aria-controls"));
    return kopf.getAttribute("aria-expanded") === "false" && !panel.classList.contains("offen");
  });
  pruef(zu, "zweiter Klick klappt wieder zu");
  pruef(s1._konsole.length === 0, "keine Ausnahme in der Konsole", s1._konsole.join(" | ") || "still");
  await s1.close();

  console.log("\n══ Offen bleibt offen nach einem Neuzeichnen (Suche) ══");
  const s2 = await board(await browser.newContext({ viewport: { width: 390, height: 844 } }));
  await s2.click("#karteListe .gkopf");
  await s2.waitForTimeout(450);
  const vorName = await s2.evaluate(() =>
    document.querySelector("#karteListe .gname").textContent);
  await s2.fill("#karteSuche", "a");
  await s2.waitForTimeout(200);
  await s2.fill("#karteSuche", "");
  await s2.waitForTimeout(200);
  const nachSuche = await s2.evaluate((name) => {
    const zeilen = [...document.querySelectorAll("#karteListe .gkopf")];
    const meins = zeilen.find(k => k.querySelector(".gname").textContent === name);
    if (!meins) return { gefunden: false };
    const panel = document.getElementById(meins.getAttribute("aria-controls"));
    return {
      gefunden: true,
      nochOffen: meins.getAttribute("aria-expanded") === "true" && panel.classList.contains("offen"),
    };
  }, vorName);
  pruef(nachSuche.gefunden && nachSuche.nochOffen,
    "dieselbe Zeile ist nach dem Neuzeichnen weiterhin offen", JSON.stringify(nachSuche));
  await s2.close();

  console.log("\n══ prefers-reduced-motion: sofort da, keine laufende Animation ══");
  const s3 = await board(await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" }));
  await s3.click("#karteListe .gkopf");
  await s3.waitForTimeout(80);
  const reduziert = await s3.evaluate(() => {
    const kopf = document.querySelector("#karteListe .gkopf");
    const panel = document.getElementById(kopf.getAttribute("aria-controls"));
    return {
      hoehe: panel.getBoundingClientRect().height,
      animCount: panel.getAnimations ? panel.getAnimations().length : 0,
    };
  });
  pruef(reduziert.hoehe > 40, "Inhalt steht sofort auf voller Höhe", reduziert.hoehe.toFixed(0) + "px");
  pruef(reduziert.animCount === 0, "keine laufende Animation", reduziert.animCount);
  await s3.close();

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
