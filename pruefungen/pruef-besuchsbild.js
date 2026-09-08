/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Das Besuchsbild

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-besuchsbild.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   Nach dem Essen baut der Gast sich ein Bild: was es gab, wie es war,
   wo er war. Es entsteht VOLLSTÄNDIG IM GERÄT — kein Hochladen, kein
   Dritter, und es läuft ohne Netz. Auch das Foto und die Sterne
   bleiben dort.

   Drei Dinge können schiefgehen, für jedes steht hier eine Probe:

   1 · DIE LEINWAND WIRD VERGIFTET. Wer ein fremdes Bild ohne
       crossOrigin hineinzeichnet, bekommt beim Sichern eine Ausnahme
       — und der Gast einen Knopf, der nichts tut. Deshalb wird
       toDataURL nach dem Zeichnen wirklich aufgerufen.

   2 · „MIT BILD" OHNE BILD. Ein leeres Band über der Liste wäre ein
       Versprechen, das niemand einlöst. Die Bauart darf erst greifen,
       wenn ein Bild da ist.

   3 · DIE STERNE FEHLEN IM BILD. Sie stehen im Auszeichnungstext, aber
       nicht auf der Leinwand — gemessen wird deshalb die GEZEICHNETE
       Fläche, nicht der Zustand im Speicher.

   EINE EHRLICHE GRENZE, und sie gehört hierher statt in eine
   Fußnote: Punkt 1 ist mit dieser Prüfung NICHT belegt. Der
   Gegenbeweis dazu — crossOrigin aus dem Gerüst nehmen — blieb GRÜN,
   obwohl die Sabotage nachweislich ankam (grep -c = 1). Von einer
   file://-Seite aus vergiftet Chromium die Leinwand nicht so, wie es
   ein Browser auf omoteno.de täte; der Fall lässt sich hier also gar
   nicht herstellen. Die Prüfung zeigt, dass toDataURL LÄUFT, nicht,
   dass die Zeile crossOrigin nötig ist. Wer sie entfernt, merkt es
   erst auf dem Gerät des Gastes.

   Warum hier Pixel gezählt werden dürfen, obwohl §8.1f davon abrät:
   Das Besuchsbild ist eine RUHENDE Fläche. Es wird einmal gemalt und
   ändert sich nicht von selbst. Verglichen werden außerdem keine
   ganzen Bilder, sondern einzelne Punkte und Zählwerte — die sind
   auch dann stabil, wenn die Figur darin einen Hauch anders steht.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
function hubDatei(name){
  const f = path.join(OBEN, "dist", name, "index.html");
  return fs.existsSync(f) ? "file://" + f : null;
}
let fehler = 0;
const ok = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };

const WEISS = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">' +
              '<rect width="800" height="800" fill="#ffffff"/></svg>';

async function lauf(br, datei, haus){
  console.log("\n══ " + haus + " ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));

  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  /* Ein hochgeladenes Gerichtfoto liegt in Wirklichkeit auf einer
     fremden Adresse mit CORS-Kopfzeile. Genau so wird es gestellt. */
  await p.route("https://bild.test/**", r => r.fulfill({ status:200,
    contentType:"image/svg+xml",
    headers:{ "Access-Control-Allow-Origin":"*" }, body:WEISS }));
  await p.addInitScript(() => localStorage.setItem("omoteno-willkommen","1"));
  await p.goto(datei);
  await p.waitForTimeout(1200);

  await p.evaluate(() => {
    SPEISEKARTE.unshift({ gruppe:"Probe", eintraege:[
      { n:"Probe-Waffel", p:"9,90", bild:"https://bild.test/waffel.svg" }]});
  });
  await p.evaluate(() => storyOeffnen([{n:"Nutella Crêpe", m:2},{n:"Dubai Crêpe", m:1}]));
  await p.waitForTimeout(1500);

  const a = await p.evaluate(() => {
    const c = document.querySelector("#storyBild canvas");
    let sichern = "ohne";
    try{ sichern = c ? (c.toDataURL("image/png").slice(0,14) + "…") : "keine Leinwand"; }
    catch(e){ sichern = "VERGIFTET: " + e.name; }
    return { offen: !document.getElementById("story").hidden,
             mass: c ? c.width + "×" + c.height : "keine",
             sichern,
             sternZeilen: document.querySelectorAll("[data-sgericht-zeile]").length,
             sterne: document.querySelectorAll("[data-sstern]").length,
             /* Beschriftungen dürfen nicht deutsch festhängen. */
             teilen: document.getElementById("storyTeilen").textContent,
             bauart: [...document.querySelectorAll("[data-sbauart]")].map(b => b.textContent) };
  });
  ok(a.offen, "das Fenster geht auf");
  ok(a.mass === "1080×1920", "die Leinwand hat das Story-Maß", a.mass);
  ok(/^data:image/.test(a.sichern), "das Bild lässt sich sichern", a.sichern);
  ok(a.sternZeilen === 2, "jede Speise bekommt eine Sternreihe", a.sternZeilen + " Reihen");
  ok(a.sterne === 10, "fünf Sterne je Speise", a.sterne + " Sterne");
  ok(!!a.teilen && a.bauart.length === 2,
    "die Knöpfe sind beschriftet", a.teilen + " · " + a.bauart.join(" / "));

  /* ── Sterne landen wirklich auf der Leinwand ── */
  const goldVorher = await goldPunkte(p);
  await p.click('[data-sgericht-zeile] [data-sstern="4"]');
  await p.waitForTimeout(900);
  const nach = await p.evaluate(() => ({
    stand: storyStand.sterne,
    gedrueckt: [...document.querySelectorAll("[data-sgericht-zeile] [data-sstern]")]
      .slice(0,5).map(s => s.getAttribute("aria-pressed")).join(",")
  }));
  const goldNachher = await goldPunkte(p);
  ok(nach.gedrueckt === "true,true,true,true,false",
    "vier Sterne stehen an, der fünfte nicht", nach.gedrueckt);
  ok(goldNachher > goldVorher + 200,
    "und sie sind AUF DEM BILD zu sehen, nicht nur im Speicher",
    goldVorher + " → " + goldNachher + " goldene Punkte");

  /* Noch einmal derselbe Stern nimmt zurück — sonst gäbe es keinen
     Weg von „ein Stern" zu „gar keiner". */
  await p.click('[data-sgericht-zeile] [data-sstern="4"]');
  await p.waitForTimeout(800);
  const zurueck = await p.evaluate(() =>
    Object.values(storyStand.sterne).filter(Boolean).length);
  ok(zurueck === 0, "derselbe Stern nimmt die Bewertung zurück",
    zurueck + " Bewertung(en) übrig");

  /* ── „Mit Bild" ohne Bild malt kein leeres Band ── */
  await p.click('[data-sbauart="bild"]');
  await p.waitForTimeout(700);
  const b = await p.evaluate(() => ({
    bauart: storyStand.bauart, bild: !!storyStand.bild,
    wahl: !document.getElementById("storyBildWahl").hidden,
    /* Wo das Band läge: Ist dort die Grundfarbe, wurde nichts gemalt. */
    punkt: [...document.querySelector("#storyBild canvas")
      .getContext("2d").getImageData(540, 650, 1, 1).data].slice(0,3).join(",")
  }));
  ok(b.bauart === "bild" && !b.bild, "die Bauart merkt sich die Wahl");
  ok(b.wahl, "und fragt, woher das Bild kommen soll");

  /* ── Aus der Karte wählen ── */
  await p.click("[data-sgericht]");
  await p.waitForTimeout(400);
  const c = await p.evaluate(() => ({
    offen: !document.getElementById("storyGerichte").hidden,
    anzahl: document.querySelectorAll("[data-sgericht-bild]").length
  }));
  ok(c.offen && c.anzahl > 0, "die Karte bietet ihre Bilder an",
    c.anzahl + " Gerichte mit Bild");

  await p.click('[data-sgericht-bild^="https://bild.test"]');
  await p.waitForTimeout(1700);
  const d = await p.evaluate(() => {
    const cv = document.querySelector("#storyBild canvas");
    const x = cv.getContext("2d");
    let sichern = "ohne";
    try{ sichern = cv.toDataURL("image/png").slice(0,14) + "…"; }
    catch(e){ sichern = "VERGIFTET: " + e.name; }
    return { bild: !!storyStand.bild,
             punkt: [...x.getImageData(540, 650, 1, 1).data].slice(0,3).join(","),
             sichern };
  });
  ok(d.bild, "das Bild aus der Karte ist geladen");
  ok(d.punkt === "255,255,255",
    "und steht als Band im Bild", "Punkt (540,650) = " + d.punkt);
  /* Siehe die Grenze im Kopf: Das belegt, dass Sichern LÄUFT — nicht,
     dass crossOrigin nötig ist. Von file:// aus vergiftet Chromium
     die Leinwand nicht. */
  ok(/^data:image/.test(d.sichern),
    "die Leinwand bleibt sicherbar (Grenze: siehe Kopf)", d.sichern);

  ok(kons.length === 0, "kein Fehler in der Konsole", kons[0] || "still");
  await ctx.close();
}

/* Goldene Punkte zählen: So sieht man, ob Sterne GEMALT wurden. */
function goldPunkte(p){
  return p.evaluate(() => {
    const c = document.querySelector("#storyBild canvas");
    if(!c) return 0;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for(let i = 0; i < d.length; i += 4){
      const r = d[i], g = d[i+1], b = d[i+2];
      if(r > 150 && g > 110 && b < 110 && r - b > 60) n++;
    }
    return n;
  });
}

(async () => {
  const choco = hubDatei("chocolamour");
  if(!choco){
    console.error("Kein erzeugter Hub in dist/. Erst: node erzeuger/erzeuge-hub.js --alle");
    process.exit(1);
  }
  const br = await chromium.launch();
  await lauf(br, choco, "Choco");
  const blend = hubDatei("blend");
  if(blend) await lauf(br, blend, "Blend");
  await br.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Keine Fehler"));
  process.exit(fehler ? 1 : 0);
})();
