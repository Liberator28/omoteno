/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Entwurf-Zwischenspeicher im Gericht-Blatt

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-gericht-entwurf.js

   Auftrag des Betreibers (27.09.): Ein Gericht in Arbeit soll sich wie
   ein offenes Projekt anfühlen — wer zwischendurch etwas anderes im
   Board nachsieht, soll seinen unfertigen Stand wiederfinden, nicht
   neu anfangen müssen. entwurfSchreiben()/entwurfLesen() (admin.html)
   sichern das Formular in localStorage, unabhängig vom Schließen des
   Blatts.

   Geprüft:
   1 · Ein Entwurf übersteht „Abbrechen" UND einen Tafelwechsel im
       Board und wird beim erneuten Öffnen wiederhergestellt, mit
       sichtbarem Hinweis.
   2 · „Verwerfen" löscht ihn und setzt die Felder zurück.
   3 · Nach einem ECHTEN „Speichern" bleibt KEIN Geisterentwurf übrig —
       auch dann nicht, wenn der entprellte Schreibvorgang (500 ms)
       noch unterwegs war, als gespeichert wurde (CLAUDE.md §8.1p: ein
       verzögerter Schreibvorgang kann etwas wiederbeleben, das gerade
       gelöscht wurde — hier eigens durchgemessen, nicht angenommen).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const OBEN  = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

async function neueSeite(browser) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const seite = await ctx.newPage();
  const kons = [];
  seite.on("pageerror", e => kons.push(String(e).slice(0, 300)));
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
  await seite.evaluate(() => document.querySelector('[data-tafel="speisekarte"]').click());
  await seite.waitForTimeout(300);
  return { ctx, seite, kons };
}

(async () => {
  const browser = await chromium.launch();

  console.log("\n══ Entwurf übersteht Abbrechen und Tafelwechsel ══");
  const { ctx: ctx1, seite: s1, kons: kons1 } = await neueSeite(browser);

  await s1.evaluate(() => blattOeffnen(null));
  await s1.waitForTimeout(200);
  await s1.fill("#fName", "Testgericht Entwurf");
  await s1.fill("#fBeschr", "Ein Entwurf, der überleben soll");
  await s1.click("#fVegan"); // koppelt fVeg mit — auch das soll im Entwurf stehen
  await s1.waitForTimeout(700); // die 500-ms-Verzögerung des Schreibens abwarten

  await s1.click("#abbrechen");
  await s1.waitForTimeout(400);
  await s1.evaluate(() => document.querySelector('[data-tafel="startseite"]').click());
  await s1.waitForTimeout(150);
  await s1.evaluate(() => document.querySelector('[data-tafel="speisekarte"]').click());
  await s1.waitForTimeout(150);

  await s1.evaluate(() => blattOeffnen(null));
  await s1.waitForTimeout(300);
  const wieder = await s1.evaluate(() => ({
    name: document.getElementById("fName").value,
    beschr: document.getElementById("fBeschr").value,
    veg: document.getElementById("fVeg").getAttribute("aria-pressed"),
    vegan: document.getElementById("fVegan").getAttribute("aria-pressed"),
    hinweis: !document.getElementById("entwurfHinweis").hidden,
  }));
  pruef(wieder.name === "Testgericht Entwurf" && wieder.beschr === "Ein Entwurf, der überleben soll",
    "Name und Beschreibung kommen nach Abbrechen + Tafelwechsel zurück", JSON.stringify(wieder));
  pruef(wieder.veg === "true" && wieder.vegan === "true",
    "auch die Vegan/Vegetarisch-Kopplung steht im wiederhergestellten Entwurf");
  pruef(wieder.hinweis, "der Hinweis „Entwurf wiederhergestellt“ ist sichtbar");

  console.log("\n══ Verwerfen löscht den Entwurf ══");
  await s1.click("#entwurfVerwerfen");
  await s1.waitForTimeout(200);
  const verworfen = await s1.evaluate(() => ({
    name: document.getElementById("fName").value,
    hinweis: !document.getElementById("entwurfHinweis").hidden,
  }));
  pruef(verworfen.name === "" && !verworfen.hinweis,
    "nach „Verwerfen“ sind die Felder leer und der Hinweis weg", JSON.stringify(verworfen));

  pruef(kons1.length === 0, "keine Ausnahme in der Konsole (Teil 1)", kons1.join(" | ") || "still");
  await ctx1.close();

  /* ── Der Wettlauf aus §8.1p: schreiben UND speichern fast gleichzeitig ─ */
  console.log("\n══ Kein Geisterentwurf nach echtem Speichern (Wettlauf) ══");
  const { ctx: ctx2, seite: s2, kons: kons2 } = await neueSeite(browser);

  await s2.evaluate(() => blattOeffnen(null));
  await s2.waitForTimeout(200);
  await s2.fill("#fName", "Wird gespeichert");
  await s2.fill("#fKat", "Testkategorie");
  /* Direkt speichern, BEVOR die 500-ms-Verzögerung des Entwurf-
     Schreibens verstrichen ist — genau der Fall aus dem Vorfall. */
  await s2.click("#speichern");
  await s2.waitForTimeout(900); // länger als die 500 ms warten

  await s2.evaluate(() => document.querySelector('[data-tafel="startseite"]').click());
  await s2.waitForTimeout(100);
  await s2.evaluate(() => document.querySelector('[data-tafel="speisekarte"]').click());
  await s2.waitForTimeout(150);
  await s2.evaluate(() => blattOeffnen(null));
  await s2.waitForTimeout(200);
  const nachSpeichern = await s2.evaluate(() => ({
    name: document.getElementById("fName").value,
    hinweis: !document.getElementById("entwurfHinweis").hidden,
  }));
  pruef(nachSpeichern.name === "" && !nachSpeichern.hinweis,
    "ein neues Gericht nach vorherigem Speichern trägt keinen Geisterentwurf mehr",
    JSON.stringify(nachSpeichern));

  pruef(kons2.length === 0, "keine Ausnahme in der Konsole (Teil 2)", kons2.join(" | ") || "still");
  await ctx2.close();

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
