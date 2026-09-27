/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Vegetarisch und Vegan — eigenes Merkmal, eigenes Zeichen

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-gericht-merkmale.js

   Auftrag des Betreibers (27.09.): Gerichte sollen sich als vegetarisch
   ODER vegan einstellen lassen, mit eigenem Symbol — bisher gab es nur
   „vegetarisch" (gerichte.veg), vegan stand allenfalls im Namen
   („Obstsalat vegan"). Jetzt trägt gerichte.vegan (migration-gerichte-
   vegan.sql) das eigene Merkmal.

   Geprüft wird die ganze Kette:
   1 · Board: Vegan schaltet Vegetarisch automatisch mit ein (vegan
       IMPLIZIERT vegetarisch); Vegetarisch auszuschalten nimmt ein
       gesetztes Vegan mit — sonst stünde „vegan, aber nicht
       vegetarisch" im Formular, ein Widerspruch in sich.
   2 · Hub: Ein veganes Gericht zeigt NUR das Vegan-Zeichen, nicht
       zusätzlich das Vegetarisch-Zeichen (Vegan schließt Vegetarisch
       ein, zwei Zeichen nebeneinander wären Redundanz, keine
       Zusatzinformation).
   3 · Die Live-Spalte kommt wirklich aus der Datenbank im Hub an
       (derselbe Weg, den pruef-figur-board.js für hub_avatar schon
       fährt) — nicht nur aus dem Gerüst der Vorführkarte.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN  = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const DIST  = path.join(OBEN, "dist", "chocolamour", "index.html");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

(async () => {
  console.log("\n══ Board: Vegan/Vegetarisch koppeln sich, nicht widersprüchlich ══");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push(String(e).slice(0, 300)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(700);
  await p.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
  });
  await p.waitForTimeout(500);
  const scharf = await p.$("#scharfJetzt");
  if (scharf && await p.isVisible("#scharf")) { await scharf.click(); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector('[data-tafel="speisekarte"]').click());
  await p.waitForTimeout(300);
  await p.evaluate(() => blattOeffnen(null));
  await p.waitForTimeout(200);

  await p.click("#fVegan");
  const anGeschaltet = await p.evaluate(() => ({
    veg: document.getElementById("fVeg").getAttribute("aria-pressed"),
    vegan: document.getElementById("fVegan").getAttribute("aria-pressed"),
  }));
  pruef(anGeschaltet.veg === "true" && anGeschaltet.vegan === "true",
    "Vegan einschalten schaltet Vegetarisch automatisch mit ein", JSON.stringify(anGeschaltet));

  await p.click("#fVeg");
  const ausGeschaltet = await p.evaluate(() => ({
    veg: document.getElementById("fVeg").getAttribute("aria-pressed"),
    vegan: document.getElementById("fVegan").getAttribute("aria-pressed"),
  }));
  pruef(ausGeschaltet.veg === "false" && ausGeschaltet.vegan === "false",
    "Vegetarisch ausschalten nimmt ein gesetztes Vegan mit", JSON.stringify(ausGeschaltet));

  /* Der umgekehrte Weg: vegetarisch allein bleibt möglich und lässt
     vegan unberührt (keine versteckte Kopplung in die andere
     Richtung). */
  await p.click("#fVeg");
  const nurVeg = await p.evaluate(() => ({
    veg: document.getElementById("fVeg").getAttribute("aria-pressed"),
    vegan: document.getElementById("fVegan").getAttribute("aria-pressed"),
  }));
  pruef(nurVeg.veg === "true" && nurVeg.vegan === "false",
    "nur Vegetarisch einschalten lässt Vegan aus", JSON.stringify(nurVeg));

  pruef(kons.length === 0, "keine Ausnahme in der Konsole", kons.join(" | ") || "still");
  await ctx.close();
  await browser.close();

  /* ── Der Hub: Vorrang und Zeichen ─────────────────────────────────
     Direkt gegen das gemalte Bild, mit einer nachgestellten Zeile aus
     der Datenbank — derselbe Weg, den pruef-figur-board.js für
     hub_avatar schon fährt (CLAUDE.md §8.1i: die Naht selbst prüfen,
     nicht beide Seiten getrennt gegen eine Annahme). */
  console.log("\n══ Hub: Zeichen und Vorrang (vegan schließt vegetarisch ein) ══");
  if (!fs.existsSync(DIST)) {
    pruef(false, "dist/chocolamour/index.html fehlt — erst node erzeuger/erzeuge-hub.js --alle laufen lassen");
  } else {
    const BID = "33333333-3333-3333-3333-333333333333";
    const browser2 = await chromium.launch();

    async function seiteMitGerichten(gerichte) {
      const seite = await browser2.newPage({ viewport: { width: 390, height: 844 } });
      const kons2 = [];
      seite.on("pageerror", e => kons2.push("JS: " + String(e).slice(0, 200)));
      await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
        : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
      await seite.route("**/rest/v1/betriebe**", r =>
        r.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify([{ id: BID, bestell_pause: false, bestell_pause_text: "",
            hub_texte: {}, hub_kacheln: null, hub_woerter: {}, liefer: null }]) }));
      await seite.route("**/rest/v1/gerichte**", r =>
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gerichte) }));
      await seite.addInitScript(() => localStorage.setItem("omoteno-willkommen", "1"));
      await seite.goto("file://" + DIST);
      await seite.waitForTimeout(1500);
      await seite.evaluate(() => { location.hash = "#/speisekarte"; zeichne(); });
      await seite.waitForTimeout(300);
      const html = await seite.evaluate(() => document.getElementById("inhalt").innerHTML);
      return { html, kons2 };
    }

    const nurVegan = [{ id: "g1", name: "Testgericht Vegan", kategorie: "Test", beschreibung: "",
      preis: 9, karte: "speisekarte", verfuegbar: true, kat_sort: 0, reihenfolge: 0,
      veg: true, vegan: true }];
    const r1 = await seiteMitGerichten(nurVegan);
    pruef(/class="tag vegan"/.test(r1.html), "veganes Gericht trägt das Vegan-Zeichen");
    pruef(!/class="tag veg"[^a]/.test(r1.html),
      "und NICHT zusätzlich das Vegetarisch-Zeichen (vegan schließt es ein)",
      /class="tag veg"[^a]/.test(r1.html) ? "beide Zeichen da" : "nur Vegan");
    pruef(r1.kons2.length === 0, "keine Ausnahme (nur vegan)", r1.kons2.join(" | ") || "still");

    const nurVeg = [{ id: "g2", name: "Testgericht Vegetarisch", kategorie: "Test", beschreibung: "",
      preis: 9, karte: "speisekarte", verfuegbar: true, kat_sort: 0, reihenfolge: 0,
      veg: true, vegan: false }];
    const r2 = await seiteMitGerichten(nurVeg);
    pruef(/class="tag veg"[^a]/.test(r2.html), "nur-vegetarisches Gericht trägt das Vegetarisch-Zeichen");
    pruef(!/class="tag vegan"/.test(r2.html), "und kein Vegan-Zeichen, wo keins gesetzt ist");
    pruef(r2.kons2.length === 0, "keine Ausnahme (nur vegetarisch)", r2.kons2.join(" | ") || "still");

    const keins = [{ id: "g3", name: "Testgericht Normal", kategorie: "Test", beschreibung: "",
      preis: 9, karte: "speisekarte", verfuegbar: true, kat_sort: 0, reihenfolge: 0 }];
    const r3 = await seiteMitGerichten(keins);
    pruef(!/class="tag vegan"/.test(r3.html) && !/class="tag veg"[^a]/.test(r3.html),
      "ohne gesetztes Merkmal steht kein Zeichen da");

    await browser2.close();
  }

  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
