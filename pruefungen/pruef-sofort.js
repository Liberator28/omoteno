/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Sofort bestellen — Top-Runner und Empfehlung des Hauses

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-sofort.js

   Zwei Knöpfe, zwei Preisquellen: Der Top-Runner-Streifen bestellt zum
   AKTIONSPREIS (aus aktionen.preis_neu, nicht aus der Karte), die
   Empfehlung des Hauses zum normalen Kartenpreis. Seit 26.10. ist der
   Top-Runner ein kleiner Knopf unten rechts; sein Blatt (#aktionBlatt)
   trägt das Gericht — ein Tipp darauf öffnet die Vorschau —, der
   Sofort-Knopf daneben legt direkt in den Korb, ohne Vorschau.

   Kritischste Zusicherung: Der Sofort-Preis beim Top-Runner weicht
   wirklich vom Kartenpreis ab. Würde jemand versehentlich g.p statt
   dem Aktionspreis einsetzen, sähe die Bedienung noch genauso aus —
   nur der Preis im Korb wäre falsch. Das findet keine Sichtprüfung.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const HIER = path.resolve(__dirname, "..");
const BID  = "af095b14-d9ef-41f4-9b97-c4422b0de63f";

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

function hubDatei(){
  const o = path.join(HIER, "dist", "chocolamour", "index.html");
  return fs.existsSync(o) ? "file://" + o : null;
}

/* Ein aktives Top-Runner-Angebot auf ein echtes Gericht der Karte,
   mit einem Preis, der sich vom Kartenpreis unterscheidet — sonst
   könnte ein vertauschter Preis nie auffallen. */
function aktionMock(name, extra){
  return Object.assign({
    id: "aktion-1", gericht_name: name, titel: null,
    preis_alt: 15.90, preis_neu: 11.90,
    bis: new Date(Date.now() + 2 * 3600000).toISOString()
  }, extra || {});
}

(async () => {
  const datei = hubDatei();
  if(!datei){
    console.log("Kein erzeugter Hub in dist/chocolamour/. Erst „node erzeuger/erzeuge-hub.js --alle“ laufen lassen.");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:390,height:844} });
  const seite = await ctx.newPage();

  let aktionenAntwort = [aktionMock("Dubai Crêpe")];

  await seite.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await seite.route("**/rest/v1/betriebe**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) }));
  await seite.route("**/rest/v1/rpc/gast_melden", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify({ ok:true, neu:false, besuche:1, lieblinge:[], gutscheine:[] }) }));
  await seite.route("**/rest/v1/rpc/bestellung_aufgeben", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify("aaaaaaaa-bbbb-cccc-dddd-000000000001") }));
  await seite.route("**/rest/v1/aktionen**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      headers:{ "Cache-Control":"no-store" }, body: JSON.stringify(aktionenAntwort) }));

  await seite.goto(datei);
  await seite.waitForTimeout(500);
  if(await seite.isVisible(".willkommen")){ await seite.click(".willkommen"); await seite.waitForTimeout(500); }

  /* aktionenLaden() läuft asynchron beim Start — auf die Ankunft warten,
     nicht auf eine feste Wartezeit verlassen (CLAUDE.md §8.1g). */
  await seite.waitForFunction(() => typeof aktionen !== "undefined" && Array.isArray(aktionen) && aktionen.length > 0, null, { timeout: 5000 }).catch(() => {});
  await seite.evaluate(() => { location.hash = ""; zeichne(); });
  await seite.waitForTimeout(300);

  /* ───── 1 · Top-Runner: Klick auf den Streifen öffnet die Vorschau ───── */
  console.log("\n── Top-Runner: Klick öffnet die Vorschau ──");
  await seite.waitForFunction(() => !document.getElementById("aktionKnopf").hidden, null, { timeout: 5000 }).catch(() => {});
  pruef(await seite.evaluate(() => !document.getElementById("aktionKnopf").hidden), "Voraussetzung: der Aktions-Knopf steht da");
  await seite.click("#aktionTaste");
  await seite.waitForTimeout(450);
  const klickKnopf = await seite.$("#aktionBlatt button.ak-info");
  pruef(!!klickKnopf, "das Gericht im Blatt ist ein echter <button>, kein bloßes <div>");
  if(klickKnopf){
    await klickKnopf.click();
    await seite.waitForTimeout(400);
    const offen = await seite.evaluate(() => ({
      an: document.getElementById("warenkarte").classList.contains("an"),
      name: typeof detailName !== "undefined" ? detailName : null
    }));
    pruef(offen.an, "die Vorschau öffnet sich");
    pruef(offen.name === "Dubai Crêpe", "und zeigt das richtige Gericht", String(offen.name));
    await seite.evaluate(() => { detailSchliessen(); });
    await seite.waitForTimeout(300);
  }

  /* ───── 2 · Top-Runner: Sofort-Knopf bestellt zum AKTIONSPREIS ───── */
  console.log("\n── Top-Runner: Sofort-Knopf ──");
  const vorher = await seite.evaluate(() => Object.keys(merk).length);
  pruef(vorher === 0, "der Korb ist vor dem Tippen leer");

  await seite.click("#aktionTaste");
  await seite.waitForTimeout(450);
  const sofort = await seite.$("#aktionBlatt .sofort[data-aktionmerk]");
  pruef(!!sofort, "der Sofort-Knopf steht im Blatt neben dem Gericht");
  if(sofort){
    const box = await sofort.boundingBox();
    pruef(!!box && box.width >= 44 && box.height >= 44,
      "Tapfläche mindestens 44×44px", box ? Math.round(box.width) + "×" + Math.round(box.height) : "–");

    await sofort.click();
    await seite.waitForTimeout(300);
    const nachTipp = await seite.evaluate(() => merk["Dubai Crêpe"] || null);
    pruef(!!nachTipp, "das Gericht liegt im Korb");
    if(nachTipp){
      pruef(nachTipp.p === "11,90 €", "zum AKTIONSPREIS, nicht zum Kartenpreis (15,90 €)", nachTipp.p);
    }
    pruef(await seite.evaluate(() => document.querySelector('#aktionBlatt .sofort[data-aktionmerk]').classList.contains("an")),
      "der Knopf zeigt seinen aktiven Zustand");
    pruef(await seite.isVisible("#auswahlbalken"), "der Balken unten zeigt den Korb");

    /* Zweiter Tipp nimmt wieder heraus — dieselbe Geste wie beim Herz. */
    await sofort.click();
    await seite.waitForTimeout(300);
    pruef(!(await seite.evaluate(() => !!merk["Dubai Crêpe"])), "erneutes Tippen nimmt es wieder heraus");
  }

  /* ───── 3 · Fehlt das Gericht in der Karte, bleibt es ein Hinweis ───── */
  console.log("\n── Aktion ohne passendes Gericht in der Karte ──");
  aktionenAntwort = [aktionMock("Gibt es hier nicht", { id:"aktion-2" })];
  await seite.evaluate(() => { aktionGesehen = {}; try{ sessionStorage.removeItem("omoteno-aktionen"); }catch(e){} });
  await seite.reload();
  await seite.waitForTimeout(500);
  if(await seite.isVisible(".willkommen")){ await seite.click(".willkommen"); await seite.waitForTimeout(500); }
  await seite.waitForFunction(() => typeof aktionen !== "undefined" && Array.isArray(aktionen) && aktionen.length > 0, null, { timeout: 5000 }).catch(() => {});
  await seite.evaluate(() => { location.hash = ""; zeichne(); });
  await seite.waitForTimeout(300);
  await seite.waitForFunction(() => !document.getElementById("aktionKnopf").hidden, null, { timeout: 5000 }).catch(() => {});
  const ohneGericht = await seite.evaluate(() => ({
    div: !!document.querySelector("#aktionBlatt .ak-info") && !document.getElementById("aktionKnopf").hidden,
    knopf: !!document.querySelector("#aktionBlatt button.ak-info"),
    sofort: !!document.querySelector("#aktionBlatt .sofort")
  }));
  pruef(ohneGericht.div, "der Knopf steht weiterhin, das Blatt zeigt die Aktion als Hinweis");
  pruef(!ohneGericht.knopf, "aber ohne anklickbare Vorschau");
  pruef(!ohneGericht.sofort, "und ohne Sofort-Knopf — es gäbe nichts zu bestellen");

  /* ───── 4 · Empfehlung des Hauses: Menge zum Kartenpreis ─────
     VORFALL (Bildschirmfoto des Betreibers): Der runde Sofort-Knopf
     lag absolut über dem Text — von der Beschreibung fehlte ein Stück.
     Jetzt steht dort dieselbe Mengensteuerung wie in der Karte, in
     einer eigenen Fußzeile. Gemessen wird, dass KEIN Textrechteck
     unter dem Knopf liegt, und dass Plus und Minus wirklich zählen. */
  console.log("\n── Empfehlung des Hauses ──");
  aktionenAntwort = [];
  /* Eine LANGE Beschreibung, wie auf dem Bildschirmfoto des Betreibers.
     Mit der kurzen Probe-Empfehlung reichte der Text nie bis zum Knopf
     — der Gegenbeweis (Fußzeile entfernt) blieb grün (§8.1g). Jetzt
     läuft die letzte Zeile bis an den rechten Rand. */
  await seite.evaluate(() => {
    stunde = 21;
    EMPFEHLUNG.forEach(e => { e.was = "Pistaziencreme, Engelshaar, Schokolade. Der Grund, warum so viele von weit her wiederkommen und immer wieder danach fragen, jeden einzelnen Abend"; });
    location.hash = ""; zeichne(); });
  await seite.waitForTimeout(300);
  const tipp = await seite.evaluate(() => {
    const knopf = document.querySelector(".tippwrap .tippmenge");
    const k = knopf ? knopf.getBoundingClientRect() : null;
    /* Jede Textzeile einzeln (Range je Textknoten), nicht nur die
       Kästen — ein Kasten reicht über die ganze Breite, die Zeile
       darin vielleicht nicht. */
    let ueber = 0, zeilen = 0;
    document.querySelectorAll(".tipp .tinhalt .name, .tipp .tinhalt .was, .tipp .tinhalt .kennz").forEach(el => {
      const r = document.createRange(); r.selectNodeContents(el);
      [...r.getClientRects()].forEach(z => { zeilen++;
        if(k && z.right > k.left && z.left < k.right && z.bottom > k.top && z.top < k.bottom) ueber++; });
    });
    return { wrap: !!document.querySelector(".tippwrap"),
             kennz: (document.querySelector(".tipp .kennz") || {}).textContent || "",
             mengeDa: !!knopf, ueber, zeilen };
  });
  pruef(tipp.wrap, "die Karte steht in ihrem eigenen Rahmen (kein <button> in <a>)");
  pruef(/THEKE/i.test(tipp.kennz), "„Heute an der Theke“ zur passenden Uhrzeit", tipp.kennz);
  pruef(tipp.mengeDa, "die Mengensteuerung sitzt in der Karte");
  pruef(tipp.zeilen > 0 && tipp.ueber === 0, "kein Stück Text liegt unter dem Knopf",
    tipp.ueber + " von " + tipp.zeilen + " Zeilen verdeckt");

  const tplus = await seite.$(".tippwrap .tippmenge .gplus");
  pruef(!!tplus, "zuerst ein „+“");
  if(tplus){
    await tplus.click();
    await seite.waitForTimeout(350);
    const g = await seite.evaluate(() => merk["Arabischer Kaiser"] || null);
    pruef(!!g, "das Gericht liegt im Korb");
    if(g) pruef(g.p === "12,20", "zum normalen Kartenpreis (keine Aktion aktiv)", g.p);
    const hoch = await seite.$('.tippwrap .tippmenge [data-kschritt="1"]');
    pruef(!!hoch, "aus dem „+“ wird − Zahl +");
    if(hoch){
      /* Je Klick frisch suchen: korbSteuerungNeu() setzt die Stelle neu,
         ein gemerkter Griff hinge danach an einem entfernten Knopf. */
      await seite.click('.tippwrap .tippmenge [data-kschritt="1"]');
      await seite.waitForTimeout(150);
      await seite.click('.tippwrap .tippmenge [data-kschritt="1"]');
      await seite.waitForTimeout(250);
      const m = await seite.evaluate(() => ({ m:(merk["Arabischer Kaiser"] || {}).m,
        zahl:(document.querySelector(".tippwrap .tippmenge .gmz") || {}).textContent }));
      pruef(m.m === 3 && m.zahl === "3", "zweimal Plus: drei Stück, Zahl und Korb gleich", JSON.stringify(m));
      await seite.click('.tippwrap .tippmenge [data-kschritt="-1"]');
      await seite.waitForTimeout(250);
      pruef((await seite.evaluate(() => (merk["Arabischer Kaiser"] || {}).m)) === 2, "Minus nimmt eins weg");
    }

    await seite.evaluate(() => { detailSchliessen(); });
    await seite.click(".tipp .name");
    await seite.waitForTimeout(400);
    const offen = await seite.evaluate(() => document.getElementById("warenkarte").classList.contains("an"));
    pruef(offen, "ein Klick auf die Karte selbst öffnet trotzdem die Vorschau");
    pruef((await seite.evaluate(() => (merk["Arabischer Kaiser"] || {}).m)) === 2,
      "und verändert den Korb dabei nicht");
  }

  /* ───── 5 · Reduzierte Bewegung ───── */
  console.log("\n── Reduzierte Bewegung ──");
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:"reduce" });
  const seite2 = await ctx2.newPage();
  await seite2.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await seite2.route("**/rest/v1/betriebe**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) }));
  await seite2.route("**/rest/v1/aktionen**", r =>
    r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify([aktionMock("Dubai Crêpe")]) }));
  await seite2.goto(datei);
  await seite2.waitForTimeout(500);
  if(await seite2.isVisible(".willkommen")){ await seite2.click(".willkommen"); await seite2.waitForTimeout(500); }
  await seite2.waitForFunction(() => typeof aktionen !== "undefined" && Array.isArray(aktionen) && aktionen.length > 0, null, { timeout: 5000 }).catch(() => {});
  await seite2.waitForFunction(() => !document.getElementById("aktionKnopf").hidden, null, { timeout: 5000 }).catch(() => {});
  await seite2.click("#aktionTaste");
  await seite2.waitForTimeout(150);
  const s2 = await seite2.$("#aktionBlatt .sofort[data-aktionmerk]");
  pruef(!!s2, "Voraussetzung: bei reduzierter Bewegung steht das Blatt sofort da, mit dem Sofort-Knopf");
  if(s2){
    await s2.click();
    await seite2.waitForTimeout(200);
    pruef(await seite2.evaluate(() => document.querySelector('#aktionBlatt .sofort[data-aktionmerk]').classList.contains("an")),
      "der Zustand wechselt auch ohne Bewegung zuverlässig");
  }
  await browser.close();

  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
