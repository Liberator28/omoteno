/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Der ganze Weg des Gastes

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-durchgang.js

   Die anderen Prüfungen sehen sich je ein Stück an. Diese geht den
   Weg, den ein Gast wirklich geht — vom Antippen des Untersetzers bis
   zum Bild für die Story —, und schaut nach, ob die Stücke ineinander
   greifen. Genau dort liegen die Fehler, die man beim Bauen einzelner
   Teile nicht sieht: ein Korb, der nicht leer wird; eine Nummer, die
   nicht ankommt; eine Seite, die nach dem Zurück leer bleibt.

   Sie meldet ausserdem JEDEN Fehler aus der Konsole. Ein Hub, der
   auf dem Weg still einen Fehler wirft, ist nicht in Ordnung, auch
   wenn er noch etwas zeigt.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

/* Die Wurzel, nicht das eigene Verzeichnis: dist/ liegt eine
   Ebene hoeher als pruefungen/. */
const HIER = path.resolve(__dirname, "..");
const BID  = "af095b14-d9ef-41f4-9b97-c4422b0de63f";

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

function hubDatei(){
  const o = path.join(HIER, "dist");
  if(!fs.existsSync(o)) return null;
  const slug = fs.readdirSync(o).find(x => fs.existsSync(path.join(o, x, "index.html")));
  return slug ? "file://" + path.join(o, slug, "index.html") : null;
}

(async () => {
  const datei = hubDatei();
  if(!datei){
    console.log("Kein erzeugter Hub in dist/. Erst „node erzeuger/erzeuge-hub.js --alle“ laufen lassen.");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:390,height:844} });
  const seite = await ctx.newPage();

  /* Alles, was der Hub auf dem Weg an die Konsole gibt. */
  const konsole = [];
  seite.on("pageerror", e => konsole.push("Ausnahme: " + String(e).slice(0,160)));
  seite.on("console", m => { if(m.type() === "error") konsole.push("Fehler: " + m.text().slice(0,160)); });

  const gesendet = { bestellungen: [], service: [], gast: [] };
  await seite.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await seite.route("**/rest/v1/betriebe**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) }));
  await seite.route("**/rest/v1/rpc/gast_melden", r => {
    gesendet.gast.push(JSON.parse(r.request().postData() || "{}"));
    r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify({
      ok:true, neu:false, besuche:4,
      lieblinge:[{ name:"Nutella Crêpe", mal:3 }], gutscheine:[] }) });
  });
  await seite.route("**/rest/v1/rpc/bestellung_aufgeben", r => {
    const d = JSON.parse(r.request().postData() || "{}");
    (d.p_quelle === "service" ? gesendet.service : gesendet.bestellungen).push(d);
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify("aaaaaaaa-bbbb-cccc-dddd-" +
        String(gesendet.bestellungen.length + gesendet.service.length).padStart(12,"0")) });
  });

  /* ───── 1 · Ankommen ───── */
  console.log("\n── Ankommen ──");
  await seite.goto(datei);
  await seite.waitForTimeout(500);
  pruef(await seite.isVisible(".willkommen"), "Willkommensschirm beim ersten Öffnen");
  pruef((await seite.$$(".willkommen .figur")).length === 1, "die Figur des Hauses grüßt");
  await seite.click(".willkommen");
  await seite.waitForTimeout(700);
  pruef(!(await seite.isVisible(".willkommen")), "Antippen überspringt ihn");
  /* Seit 18.10. meldet der Hub keinen Besuch, bevor der Gast „Mein
     Tisch" eingeschaltet hat (§ 25 TDDDG) — Abschnitt 6 schaltet ein. */
  pruef(gesendet.gast.length === 0, "ohne Einschalten kein Besuch gemeldet", "n=" + gesendet.gast.length);

  /* Zweites Öffnen: der Schirm darf NICHT wiederkommen. */
  await seite.reload();
  await seite.waitForTimeout(600);
  pruef(!(await seite.isVisible(".willkommen")),
    "beim zweiten Öffnen bleibt er weg (einmal je Sitzung)");

  /* ───── 2 · Die Karte ───── */
  console.log("\n── Die Karte ──");
  const kacheln = await seite.$$eval("a.kachel", e => e.length);
  pruef(kacheln >= 4, "Startseite zeigt die Kacheln des Hauses", kacheln + " Stück");

  await seite.evaluate(() => { location.hash = "#/speisekarte"; });
  await seite.waitForTimeout(500);
  const karte = await seite.evaluate(() => ({
    gerichte: document.querySelectorAll("[data-merk]").length,
    bilder:   document.querySelectorAll(".gbild img").length,
    preise:   document.querySelectorAll(".gpreis").length
  }));
  pruef(karte.gerichte > 0, "Gerichte stehen auf der Karte", karte.gerichte + " Stück");
  pruef(karte.preise > 0, "jedes Gericht hat einen Preis", karte.preise + " Preise");

  /* Kein Bild darf ins Leere zeigen. */
  const kaputt = await seite.evaluate(() =>
    Array.prototype.filter.call(document.querySelectorAll("img"),
      i => i.complete && i.naturalWidth === 0 && i.getAttribute("src")).length);
  pruef(kaputt === 0, "kein Bild bleibt als leerer Rahmen stehen", kaputt + " kaputt");

  /* ───── 3 · Merken und bestellen ───── */
  console.log("\n── Merken und bestellen ──");
  await seite.evaluate(() => {
    document.querySelectorAll("[data-merk]")[0].click();
    document.querySelectorAll("[data-merk]")[1].click();
  });
  await seite.waitForTimeout(300);
  const korb = await seite.evaluate(() => Object.keys(merk).length);
  pruef(korb === 2, "zwei Gerichte im Korb", korb + "");
  pruef(await seite.isVisible("#auswahlbalken"), "der Balken unten zeigt den Korb");

  await seite.evaluate(() => { location.hash = "#/auswahl"; });
  await seite.waitForTimeout(400);
  await seite.evaluate(() => { try{ bestellStopp = () => null; }catch(e){} });
  await seite.evaluate(() => { location.hash = "#/speisekarte"; location.hash = "#/auswahl"; });
  await seite.waitForTimeout(400);
  const feld = await seite.$("#bTisch");
  if(feld) await feld.fill("7");
  const knopf = await seite.$('[data-aktion="bestellen"]');
  pruef(!!knopf, "der Bestellknopf ist da");
  if(knopf){
    await knopf.click();
    await seite.waitForTimeout(1200);
    pruef(gesendet.bestellungen.length === 1, "die Bestellung ist raus",
      "n=" + gesendet.bestellungen.length);
    const b = gesendet.bestellungen[0] || {};
    pruef(b.p_tisch === "7", "mit der Tischnummer", String(b.p_tisch));
    pruef(Array.isArray(b.p_positionen) && b.p_positionen.length === 2,
      "mit beiden Posten", (b.p_positionen || []).length + "");
    pruef(!!b.p_geraet && b.p_geraet !== b.p_gast_kennung,
      "Gerät und Quittungsnummer getrennt");
    pruef(await seite.evaluate(() => Object.keys(merk).length) === 0,
      "der Korb ist danach leer");
    pruef((await seite.evaluate(() => location.hash)) === "#/bestellt",
      "der Gast steht auf der Bestätigung");
  }

  /* ───── 4 · Der Bestellpass ───── */
  console.log("\n── Der Bestellpass ──");
  const pass = await seite.evaluate(() => {
    const p = document.querySelector(".bpass");
    return p ? { klasse: p.className, zeichen: p.querySelectorAll("svg").length,
                 text: p.textContent.trim().slice(0,60) } : null;
  });
  pruef(!!pass, "der Pass steht da");
  if(pass){
    pruef(pass.zeichen > 0, "mit einem gezeichneten Bild, nicht mit Emoji");
    pruef(/Bestellung eingegangen|Angenommen/.test(pass.text), "und der Phase in Worten",
      pass.text.split("\n")[0]);
  }

  /* ───── 5 · Zurück und wieder hin ───── */
  console.log("\n── Zurück und wieder hin ──");
  for(const ziel of ["", "speisekarte", "meintisch", "kontakt", "bestellt"]){
    await seite.evaluate(z => { location.hash = "#/" + z; }, ziel);
    await seite.waitForTimeout(350);
    const inhalt = (await seite.textContent("#inhalt")).trim();
    pruef(inhalt.length > 20, "„" + (ziel || "Start") + "“ ist gefüllt",
      inhalt.length + " Zeichen");
    pruef(!/Hier hakt gerade etwas/.test(inhalt),
      "„" + (ziel || "Start") + "“ ohne Ersatzseite");
  }

  /* ───── 6 · Mein Tisch und das Bild ───── */
  console.log("\n── Mein Tisch und das Bild ──");
  await seite.evaluate(() => { location.hash = "#/meintisch"; });
  await seite.waitForTimeout(500);
  const einschalten = await seite.$('[data-aktion="stammgastAn"]');
  pruef(!!einschalten, "Mein Tisch fragt zuerst");
  if(einschalten) await einschalten.click();
  await seite.waitForTimeout(600);
  pruef(gesendet.gast.length === 1, "nach dem Einschalten ist der Besuch gemeldet", "n=" + gesendet.gast.length);
  const meins = await seite.textContent("#inhalt");
  pruef(/4\. Besuch/.test(meins), "der Besuchszähler steht");
  pruef(/Nutella Crêpe/.test(meins), "die Lieblingsspeise steht");

  await seite.evaluate(() => { storyOeffnen([{n:"Nutella Crêpe", m:2}]); });
  await seite.waitForTimeout(1500);
  const bild = await seite.evaluate(() => {
    const c = document.querySelector("#storyBild canvas");
    return c ? { b:c.width, h:c.height } : null;
  });
  pruef(!!bild && bild.b === 1080 && bild.h === 1920,
    "das Bild für die Story ist gebaut", bild ? bild.b + "×" + bild.h : "keins");
  pruef(await seite.isVisible("#storySichern"), "und lässt sich sichern");
  await seite.click("[data-story-zu]");
  await seite.waitForTimeout(300);
  pruef(!(await seite.isVisible("#story")), "das Fenster schließt wieder");
  pruef(!(await seite.evaluate(() => document.body.classList.contains("fest"))),
    "und gibt die Seite wieder frei");

  /* ───── 7 · Sprache wechseln ───── */
  console.log("\n── Sprache wechseln ──");
  await seite.evaluate(() => { spracheSetzen("ar"); zeichne(); });
  await seite.waitForTimeout(500);
  pruef(await seite.evaluate(() => document.documentElement.dir) === "rtl",
    "Arabisch dreht die Leserichtung");
  await seite.evaluate(() => { location.hash = "#/speisekarte"; });
  await seite.waitForTimeout(500);
  /* Bei fremder Schrift MUSS der Originalname mitlaufen — sonst kann
     der Gast nicht bestellen, was er sieht. */
  const zweit = await seite.$$eval(".urname", e => e.length).catch(() => 0);
  pruef(zweit > 0, "bei fremder Schrift läuft der Originalname mit",
    zweit + " Zweitzeilen");
  /* Gegenprobe: In einer lateinischen Sprache soll die zweite Zeile
     NICHT bei jedem Gericht stehen — fünfzig Mal „Marina Waffle" über
     „Marina Waffel" wäre Rauschen, kein Dienst. */
  await seite.evaluate(() => { spracheSetzen("en"); zeichne(); });
  await seite.waitForTimeout(400);
  const zweitEn = await seite.$$eval(".urname", e => e.length).catch(() => 0);
  const gerichteEn = await seite.$$eval("[data-merk]", e => e.length).catch(() => 1);
  pruef(zweitEn < gerichteEn / 2,
    "auf Englisch bleibt sie die Ausnahme",
    zweitEn + " von " + gerichteEn);
  await seite.evaluate(() => { spracheSetzen("de"); zeichne(); });

  /* ───── 8 · Was die Konsole sagt ───── */
  console.log("\n── Was die Konsole sagt ──");
  const echt = konsole.filter(z => !/net::ERR|Failed to load resource/i.test(z));
  pruef(echt.length === 0, "kein Fehler auf dem ganzen Weg",
    echt.length ? echt[0] : "still");
  echt.slice(0, 6).forEach(z => console.log("         " + z));

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
