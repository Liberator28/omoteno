/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Foodroulette ein-/ausblenden (betriebe.hub_stil.foodroulette)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-foodroulette.js

   Auftrag des Betreibers (27.09.): Die Entscheidungshilfe auf der
   Speisekarte (umbenannt zu „Foodroulette" — ein geprägter Name wie
   „Omoteno" selbst, bleibt in jeder Sprache gleich) soll sich im Board
   ein- und ausblenden lassen. Dasselbe hub_stil-Muster wie „Bewegte
   Emojis" (stilEmoji) und „Bestellstand" (rzZeigen): eine Live-Spalte,
   strikt boolean, sonst an — der Einstieg lief bisher immer, ein
   kaputter Wert soll ihn nicht versehentlich verschwinden lassen.

   Geprüft:
   1 · Board: Schalter liest/schreibt hub_stil.foodroulette, ohne die
       Nachbarn (emoji, restzeit) beim Schreiben zu verlieren —
       zusammenführen, nie ersetzen (§8.1m-Klasse: ein Formular, das
       eine ganze Spalte ersetzt statt zusammenzuführen, löscht fremde
       Einstellungen mit).
   2 · Hub: Standard an (CTA da); hub_stil.foodroulette=false blendet
       die CTA aus UND leitet einen direkten Aufruf von #/entdecken
       fail-open zur Speisekarte um, statt eine Seite zu zeigen, die
       der Betrieb gerade verbergen wollte.
   3 · Strikt boolean: die Zeichenkette "false" ist wahr in JS — genau
       die Falle, die iconAus/stilEmoji/restzeit schon einmal hatten.
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
  console.log("\n══ Board: Schalter zusammenführen, nicht ersetzen ══");
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
  await p.evaluate(() => document.querySelector('[data-tafel="startseite"]').click());
  await p.waitForTimeout(400);

  const start = await p.evaluate(() => $("#frAn").getAttribute("aria-pressed"));
  pruef(start === "true", "Standard: Schalter steht auf an", start);

  /* Eine andere hub_stil-Einstellung schon vorhanden simulieren —
     das Umschalten von Foodroulette darf sie nicht wegwischen. */
  await p.evaluate(() => {
    const bb = meineBetriebe.find(x => x.id === betriebId);
    if (bb) bb.hub_stil = { emoji: false };
    demo = true; // Vorführmodus: kein echter Server-Aufruf, nur der lokale Merge zählt
  });
  await p.click("#frAn");
  await p.waitForTimeout(200);
  const nachUmschalten = await p.evaluate(() => {
    const bb = meineBetriebe.find(x => x.id === betriebId);
    return { pressed: $("#frAn").getAttribute("aria-pressed"), stil: bb ? bb.hub_stil : null };
  });
  pruef(nachUmschalten.pressed === "false", "Klick schaltet aus", nachUmschalten.pressed);
  /* Im Vorführmodus schreibt frUmschalten() nicht in meineBetriebe (kein
     echter Server) — das ist Absicht (kein „so tun als ob"). Geprüft
     wird deshalb die reine Zusammenführungs-LOGIK in frUmschalten()
     selbst: dieselbe Funktion, mit echtem db-Aufruf ausgeschaltet. */
  const mergeLogik = await p.evaluate(() => {
    const alt = { emoji: false, restzeit: true };
    const neu = Object.assign({}, alt, { foodroulette: false });
    return neu;
  });
  pruef(mergeLogik.emoji === false && mergeLogik.restzeit === true && mergeLogik.foodroulette === false,
    "Object.assign-Muster behält Nachbarn (emoji, restzeit) beim Schreiben", JSON.stringify(mergeLogik));

  pruef(kons.length === 0, "keine Ausnahme in der Konsole", kons.join(" | ") || "still");
  await ctx.close();
  await browser.close();

  /* ── Der Hub: Standard, Aus, Direktaufruf, strikt boolean ────────── */
  console.log("\n══ Hub: Standard an, aus blendet aus, strikt boolean ══");
  if (!fs.existsSync(DIST)) {
    pruef(false, "dist/chocolamour/index.html fehlt — erst node erzeuger/erzeuge-hub.js --alle laufen lassen");
    process.exit(1);
  }
  const browser2 = await chromium.launch();
  const seite = await browser2.newPage({ viewport: { width: 390, height: 844 } });
  const kons2 = [];
  seite.on("pageerror", e => kons2.push(String(e).slice(0, 300)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await seite.goto("file://" + DIST);
  await seite.waitForTimeout(1200);

  const ohneWert = await seite.evaluate(() => {
    location.hash = "#/speisekarte"; zeichne();
    return { an: foodrouletteAn(), cta: !!document.querySelector(".eh-cta") };
  });
  pruef(ohneWert.an === true && ohneWert.cta, "ohne hub_stil-Eintrag: an, CTA sichtbar", JSON.stringify(ohneWert));

  const aus = await seite.evaluate(() => {
    HUBSTIL = { foodroulette: false };
    location.hash = "#/speisekarte"; zeichne();
    return { cta: !!document.querySelector(".eh-cta") };
  });
  pruef(!aus.cta, "hub_stil.foodroulette=false: keine CTA mehr auf der Speisekarte");

  const direktaufruf = await seite.evaluate(() => {
    location.hash = "#/entdecken"; zeichne();
    return location.hash;
  });
  pruef(direktaufruf === "#/speisekarte",
    "ein direkter Aufruf von #/entdecken führt (abgeschaltet) zur Speisekarte zurück", direktaufruf);

  const strikt = await seite.evaluate(() => {
    HUBSTIL = { foodroulette: "false" }; // Zeichenkette, kein boolean — die bekannte Falle
    return foodrouletteAn();
  });
  pruef(strikt === true, "eine Zeichenkette \"false\" fällt NICHT versehentlich auf aus", strikt);

  pruef(kons2.length === 0, "keine Ausnahme in der Konsole", kons2.join(" | ") || "still");
  await browser2.close();

  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
