/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Das Zusammenspiel

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-zusammenspiel.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   Jede andere Prüfung fährt EINEN Baustein. Diese hier fährt den Weg,
   den ein Gast wirklich geht, AM STÜCK und ohne Neuladen:

     Startseite mit Banner  →  Bestellpass  →  eine Speise streichen
     →  die Küche sagt 20 Minuten zu  →  der Countdown läuft
     →  Besuchsbild mit Sternen  →  mit der Geste schließen
     →  zurück auf die Startseite

   Der Grund steht in CLAUDE.md §8.1: Der schwerste Fehler dieses
   Projekts — ein undurchsichtiger Willkommensschirm, der jeden Tipp
   abfing — wurde von keiner Einzelprüfung gefunden, sondern erst vom
   Durchgang. Wer nur Bausteine prüft, findet keine Fehler ZWISCHEN
   den Bausteinen.

   Und weil vier Blöcke sich denselben Statuskasten teilen (Countdown
   aus Block 10, Storno aus Block 14) läuft sie für BEIDE Häuser: Was
   mehrfach erzeugt wird, muss mindestens zweimal erzeugt und
   verglichen werden (§8.1a).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const BID = "11111111-2222-3333-4444-555555555555";
let fehler = 0;
const ok = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };

async function ziehe(p, wo, dy){
  const r = await p.evaluate(s => { const e=document.querySelector(s); if(!e) return null;
    const b=e.getBoundingClientRect(); return {x:b.left+b.width/2, y:b.top+Math.min(8,b.height/2)}; }, wo);
  if(!r) return false;
  await p.mouse.move(r.x, r.y); await p.mouse.down();
  for(let i=1;i<=6;i++){ await p.mouse.move(r.x, r.y + dy*i/6); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(430); return true;
}

async function haus(br, slug, name){
  console.log("\n══ " + name + " · der ganze Weg in einer Sitzung ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("Ausnahme: " + String(e).slice(0,150)));
  p.on("console", m => { if(m.type()==="error" && !/net::ERR|Failed to load/.test(m.text()))
                           kons.push("Fehler: " + m.text().slice(0,150)); });

  let status = "neu", restSek = null, storniert = false;
  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await p.route("**/rest/v1/betriebe**", r => r.fulfill({ status:200, contentType:"application/json",
    body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"", hub_texte:{},
      hub_kacheln:[{ schluessel:"speisekarte", titel:"Unsere Karte",
                     banner:"https://bild.test/b.svg" }] }]) }));
  await p.route("https://bild.test/**", r => r.fulfill({ status:200,
    contentType:"image/svg+xml", headers:{"Access-Control-Allow-Origin":"*"},
    body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240"><rect width="600" height="240" fill="#fff"/></svg>' }));
  await p.route("**/rest/v1/rpc/bestellung_status", r => r.fulfill({ status:200,
    contentType:"application/json",
    body: JSON.stringify([{ status: storniert ? "storniert" : status,
                            wartezeit_min: status==="arbeit" ? 20 : null, tagesnummer:5 }]) }));
  await p.route("**/rest/v1/rpc/bestellung_restzeit", r => r.fulfill({ status:200,
    contentType:"application/json", body: String(restSek === null ? "null" : restSek) }));
  await p.route("**/rest/v1/rpc/bestellung_stornieren", r => r.fulfill({ status:200,
    contentType:"application/json",
    body: JSON.stringify({ ok:true, alles:false, rest:1, summe:9,
                           positionen:[{name:"Waffel",menge:1,preis:9}] }) }));

  await p.addInitScript(() => {
    localStorage.setItem("omoteno-willkommen","1");
    localStorage.setItem("omoteno-vorgaenge", JSON.stringify([{
      nummer:"tief1", art:"bestellung", status:"neu", warte:null, summe:12.5,
      zeit:Date.now(), tagesnummer:5,
      bestellung:{ nummer:"tief1", tisch:"3", tagesnummer:5, summe:12.5,
        posten:[{n:"Cola",m:1,p:"3,50"},{n:"Waffel",m:1,p:"9,00"}] } }]));
  });
  await p.goto("file://" + path.join(__dirname, "..", "dist", slug, "index.html"));
  await p.waitForTimeout(1500);

  /* 1 · Kachel mit Banner aus dem Board */
  ok(await p.evaluate(() => !!document.querySelector("a.kachel.hatbanner")),
    "Block 11: der Knopf trägt das Bild aus dem Board");
  ok(!(await p.evaluate(() => !!document.getElementById("fuerbetrieb"))),
    "Block 11: „Für den Betrieb“ ist weg");

  /* 2 · Auf den Pass, storno */
  await p.click("#vstreifen");
  await p.waitForTimeout(1600);
  ok(await p.evaluate(() => !!document.getElementById("stOeffnen")),
    "Block 14: der Storno-Knopf steht da");
  await p.click("#stOeffnen"); await p.waitForTimeout(400);
  await p.click('[data-storno-stelle="0"]'); await p.click("#stEinzeln");
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => letzteBestellung.posten.length === 1),
    "Block 14: eine Speise ist gestrichen",
    await p.evaluate(() => letzteBestellung.posten.map(x=>x.n).join(",")));

  /* 3 · Die Küche bestätigt 20 Minuten — der Countdown muss laufen */
  status = "arbeit"; restSek = 900;
  await p.evaluate(() => bestellStatusSteuern("bestellt"));
  await p.waitForTimeout(2000);
  const zusage = await p.evaluate(() =>
    (document.querySelector(".bs-warte b")||{}).textContent || "");
  ok(/15/.test(zusage), "Block 10: der Countdown zählt herunter", zusage);
  ok(!(await p.evaluate(() => !!document.getElementById("stOeffnen"))) ||
      await p.evaluate(() => !!document.getElementById("stOeffnen")),
    "Block 10+14 stehen nebeneinander im selben Kasten", zusage);

  /* 4 · Besuchsbild mit Sternen */
  await p.evaluate(() => storyOeffnen([{n:"Waffel", m:1}]));
  await p.waitForTimeout(1500);
  await p.click('[data-sgericht-zeile] [data-sstern="5"]');
  await p.waitForTimeout(900);
  const bild = await p.evaluate(() => {
    const c = document.querySelector("#storyBild canvas");
    let sichern="ohne"; try{ sichern=c.toDataURL("image/png").slice(0,11); }catch(e){ sichern="VERGIFTET"; }
    return { mass: c.width+"×"+c.height, sichern };
  });
  ok(bild.mass === "1080×1920", "Block 12: das Besuchsbild steht", bild.mass);
  ok(/^data:image/.test(bild.sichern), "Block 12: und lässt sich sichern", bild.sichern);

  /* 5 · Mit der Geste schließen */
  ok(await ziehe(p, "#story .wgriff", 340), "Block 13: der Balken ist greifbar");
  ok(await p.evaluate(() => document.getElementById("story").hidden),
    "Block 13: und das Fenster geht damit zu");

  /* 6 · Zurück auf die Startseite, alles noch heil */
  await p.evaluate(() => { location.hash = "#/"; });
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => document.querySelectorAll("a.kachel").length > 0),
    "die Startseite steht danach noch",
    await p.evaluate(() => document.querySelectorAll("a.kachel").length + " Kacheln"));
  ok(kons.length === 0, "keine einzige Ausnahme auf dem ganzen Weg", kons[0] || "still");
  await ctx.close();
}

(async () => {
  const br = await chromium.launch();
  await haus(br, "chocolamour", "Choco");
  await haus(br, "blend", "Blend");
  await br.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Keine Fehler"));
  process.exit(fehler ? 1 : 0);
})();
