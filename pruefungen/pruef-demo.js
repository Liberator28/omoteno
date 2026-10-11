/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Der echte Hub als Vorführung (window.OMOTENO_DEMO)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-demo.js

   Wunsch 11.10.: „ein Demo-Hub, der sich vom neuesten nicht
   unterscheidet — man soll wirklich wissen, was man bekommt.“ Die
   Landingpage lädt die AUSGELIEFERTE Hub-Datei und setzt davor
   OMOTENO_DEMO. Geprüft wird, was dabei nicht passieren darf und was
   passieren muss — je Haus:

   1 · Nichts Schreibendes verlässt den Rahmen: Bestellung, Serviceruf,
       Reservierung, Besuch — gezählt an der Leitung (jede Anfrage, die
       nicht GET ist), nicht am Code.
   2 · Der echte Speicher bleibt unberührt: Die gemerkte Lichtwahl des
       Geräts gilt im Rahmen nicht und ist danach unverändert; kein
       Vorführ-Korb landet auf dem Gerät.
   3 · Der Bestellpass läuft durch: über den ECHTEN Knopf „Bestellen“
       (Schritt „pass“) → Bestätigungsseite → Stand wird „fertig“.
   4 · Um 3 Uhr nachts geöffnet, bestellbar.
   5 · Jeder Schritt der Vorführung führt dorthin, wo er soll.
   6 · Ohne Schalter: kein omotenoDemo, echter Speicher, echtes fetch.
   7 · Das Vorführhaus (Markenblatt mit „demo“, Café Nordstern) ist
       IMMER vorgeführt, auch direkt aufgerufen, fragt die Datenbank
       überhaupt nicht (auch kein GET) und zeigt seine eigenen Daten:
       Karte, Lieferung, Aktion, Übersetzungen aus den eigenen Zeilen —
       und keinen einzigen Namen aus Chocos Karte im Gerüst.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DIST = process.env.DIST || path.join(__dirname, "..", "dist");
const HAEUSER = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html")));
/* Zweite Quelle: welches Haus das Vorführhaus ist, sagt das Markenblatt. */
const VORFUEHRHAUS = h => { try{ return !!JSON.parse(fs.readFileSync(path.join(__dirname, "..", "markenblaetter", h + ".json"), "utf8")).demo; }catch(e){ return false; } };
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

async function oeffnen(browser, haus, opt){
  opt = opt || {};
  const ctx = opt.ctx || await browser.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const fehler = [], raus = [], db = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  if(opt.vorher) await p.addInitScript(opt.vorher);
  if(opt.demo !== false) await p.addInitScript(() => { window.OMOTENO_DEMO = true; });
  await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
  await p.clock.install({ time:new Date(opt.uhr || "2026-10-10T03:00:00") });
  await p.route("**/*", r => {
    const q = r.request();
    if(q.url().startsWith("file://")) return r.continue();
    if(q.method() !== "GET" && q.method() !== "HEAD") raus.push(q.method() + " " + q.url().replace(/^.*\/rest\/v1\//, ""));
    if(/\/(rest|functions|auth|storage|realtime)\/v1\//.test(q.url())) db.push(q.method() + " " + q.url().replace(/^.*\/v1\//, "").split("?")[0]);
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await p.goto("file://" + path.join(DIST, haus, "index.html") + "#/");
  await p.waitForTimeout(1000);
  return { ctx, p, fehler, raus, db };
}

(async () => {
  const browser = await chromium.launch();
  pruef(HAEUSER.length >= 2, "mindestens zwei Häuser (§8.1a)", HAEUSER.join(", "));

  /* Zweite Quelle: Jedes Allergen-Kürzel im Vorführhaus steht in
     ALLERGEN_NAMEN des Hubs. Gefunden 11.10.: „K“ (Sesam im Schlüssel
     a–n) stand an zwei Bowls, „L“ meinte Schwefel — der Hub kennt K
     nicht und zeigt unter L „Sellerie“. */
  {
    const vorlage = fs.readFileSync(path.join(__dirname, "..", "vorlagen", "hub.vorlage.html"), "utf8");
    const namen = Object.keys(eval("(" + (vorlage.match(/const ALLERGEN_NAMEN = (\{[\s\S]*?\});/) || [, "{}"])[1] + ")"));
    fs.readdirSync(path.join(__dirname, "..", "markenblaetter")).filter(d => d.endsWith(".json")).forEach(d => {
      const mb = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "markenblaetter", d), "utf8"));
      if(!mb.demo || !Array.isArray(mb.demo.gerichte)) return;
      const fremd = mb.demo.gerichte.flatMap(g => String(g.allergene || "").split(",").map(x => x.trim()).filter(Boolean)
        .filter(k => !namen.includes(k)).map(k => g.name + ":" + k));
      pruef(namen.length >= 14 && !fremd.length, d + ": jedes Allergen-Kürzel kennt der Hub", fremd.join(", ") || namen.join(""));
    });
  }
  const wiederholt = new Set();
  for(const haus of HAEUSER){
    console.log("\n══ " + haus + " ══");
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
    /* Eine echte Wahl auf dem Gerät, VOR der Vorführung: Licht „hell“.
       (Ein erfundener Korb taugt nicht — der echte Hub räumt Zeilen
       weg, deren Gericht nicht in der Karte steht, je nach Takt früher
       oder später; die Probe war damit einmal rot, ohne dass die
       Vorführung etwas getan hätte, §8.1r.) Die Vorführung schaltet
       selbst auf „schwarz“ — das darf nicht durchschlagen. */
    const vorfuehrhaus = VORFUEHRHAUS(haus);
    let { p, fehler, raus, db } = await oeffnen(browser, haus, { ctx, demo:false,
      vorher:new Function("try{ localStorage.setItem('omoteno-licht-" + haus + "', 'hell'); localStorage.setItem('probe-marke', '1'); }catch(e){}") });
    const ohne = await p.evaluate(() => ({ api: typeof window.omotenoDemo, nativ: localStorage instanceof Storage, licht }));
    if(!vorfuehrhaus){
      pruef(ohne.api === "undefined" && ohne.nativ && ohne.licht === "hell", "ohne Schalter: keine Vorführung, echter Speicher, gemerkte Wahl gilt", JSON.stringify(ohne));
    } else {
      /* 7 · Das Vorführhaus, direkt aufgerufen wie unter omoteno.de/demo */
      pruef(ohne.api === "object" && !ohne.nativ && ohne.licht === "auto",
        "Vorführhaus direkt aufgerufen: vorgeführt, eigener Speicher, die Wahl des Geräts gilt nicht", JSON.stringify(ohne));
      await p.waitForTimeout(800);
      const v = await p.evaluate(() => {
        spracheSetzen("en");
        const r = { liefer:LIEFER.an, aktionen:aktionen.map(a => a.gericht_name), gruppen:SPEISEKARTE.map(g => g.gruppe),
          en:t("Zwei Eier, Käse, Obst und frisches Brot"), enName:t("Nordstern-Frühstück"),
          alter:[].concat(...COCKTAILS.map(g => g.eintraege)).filter(e => e.alter).map(e => e.n + ":" + e.alter) };
        spracheSetzen("de");
        location.hash = "#/speisekarte";
        return r;
      });
      pruef(v.liefer, "… seine Lieferung ist eingeschaltet (aus demo.betrieb)");
      pruef(v.aktionen.join() === "Zimtschnecke", "… seine Aktion läuft (aus demo.aktionen)", v.aktionen.join());
      pruef(v.gruppen[0] === "Frühstück", "… seine eigene Karte statt der aus dem Gerüst", v.gruppen.join(","));
      pruef(v.en === "Two eggs, cheese, fruit and fresh bread" && v.enName === "Nordstern Breakfast",
        "… Englisch aus den Übersetzungen der eigenen Zeilen", v.en + " / " + v.enName);
      pruef(v.alter.length === 2, "… Altersfreigabe 16+/18+ an den Spritz-Getränken", v.alter.join(","));
      await p.waitForTimeout(500);
      /* Namentliche Liste (§8.1g D): Wörter, die nur in Chocos Karte im
         Gerüst stehen. Steht eines davon im Bild, zeigt das Vorführhaus
         einen echten Kunden. */
      const fremd = await p.evaluate(() => ["Crêpe","Kaiser","Choco","Dubai","Lotus","Waffel","Kirchhain"]
        .filter(w => document.body.innerText.includes(w)));
      pruef(!fremd.length, "… kein Wort aus Chocos Karte im Bild der Speisekarte", fremd.join(",") || "keins");
      pruef(!db.length, "… keine einzige Anfrage an die Datenbank, auch kein Lesen", db.slice(0, 4).join(" | ") || "0 Anfragen");
    }
    await p.close();

    ({ p, fehler, raus, db } = await oeffnen(browser, haus, { ctx }));
    const auf = await p.evaluate(() => ({ api: typeof window.omotenoDemo, korb: licht,
      offen: jetztOffen().offen, schritte: window.omotenoDemo && window.omotenoDemo.schritte }));
    pruef(auf.api === "object", "mit Schalter: Vorführung bereit");
    pruef(auf.korb === "auto", "die echte Wahl des Geräts ist im Rahmen nicht zu sehen (frisch: Automatisch)", auf.korb);
    pruef(auf.offen, "um 3 Uhr nachts geöffnet");

    /* 5 · jeder Schritt */
    const ziel = { start:/^#\/$/, karte:/^#\/speisekarte/, rad:/^#\/entdecken/, korb:/^#\/auswahl/, service:/^#\/service/,
                   reservieren:/^#\/reservieren/, meintisch:/^#\/meintisch/, sprache:/^#\/$/, licht:/^#\/$/, liefern:/^#\//, wischen:/^#\// };
    const schlecht = [];
    for(const s of Object.keys(ziel)){
      await p.evaluate(s => window.omotenoDemo.zeige(s), s);
      await p.clock.runFor(1500);
      await p.waitForTimeout(150);
      const m = await p.evaluate(() => ({ hash:location.hash, sprache, licht, n:Object.keys(merk).length }));
      if(!ziel[s].test(m.hash)) schlecht.push(s + " → " + m.hash);
      if(s === "korb" && m.n !== 2) schlecht.push("korb: " + m.n + " Gerichte");
      if(s === "sprache" && m.sprache !== "en") schlecht.push("sprache: " + m.sprache);
      if(s === "licht" && m.licht !== "schwarz") schlecht.push("licht: " + m.licht);
      if(s === "karte" && (m.sprache !== "de" || m.licht !== "auto")) schlecht.push("karte erbte " + m.sprache + "/" + m.licht);
    }
    const wisch = await p.evaluate(() => { location.hash = "#/speisekarte"; return new Promise(r => setTimeout(() => r(location.hash), 0)); });
    await p.evaluate(() => window.omotenoDemo.zeige("wischen"));
    /* Die Wischbewegung läuft auf der Animations-Zeitleiste, nicht auf
       der gestellten Uhr — echte Zeit abwarten. */
    await p.clock.runFor(2000); await p.waitForTimeout(1300);
    const nachWisch = await p.evaluate(() => location.hash);
    if(nachWisch === "#/speisekarte") schlecht.push("wischen blieb auf der Speisekarte");
    pruef(!schlecht.length, "jeder Vorführschritt führt dorthin, wo er soll (" + Object.keys(ziel).length + ")", schlecht.join(" | ") || "ja");

    /* 3 · Bestellpass über den echten Knopf */
    await p.evaluate(() => window.omotenoDemo.zeige("pass"));
    await p.clock.runFor(1500); await p.waitForTimeout(300);
    const nachSenden = await p.evaluate(() => ({ hash:location.hash, offen:offeneVorgaenge().length }));
    pruef(nachSenden.hash === "#/bestellt" && nachSenden.offen >= 1, "Schritt „pass“: echter Knopf → Bestätigungsseite, ein Vorgang offen", JSON.stringify(nachSenden));
    await p.clock.runFor(20000); await p.waitForTimeout(400);
    await p.clock.runFor(16000); await p.waitForTimeout(400);
    const stand = await p.evaluate(() => vorgaenge.map(v => v.status + "/" + (v.tagesnummer || "-")));
    pruef(stand.some(s => /^fertig\//.test(s)), "der Bestellpass läuft durch bis „fertig“, mit Tagesnummer", stand.join(","));

    /* Serviceruf und Reservierung über die echten Wege */
    await p.evaluate(() => anServer("service", { tisch:"7", inhalt:{ text:"Wasser bitte" } }));

    /* 1 · nichts Schreibendes ging raus */
    pruef(!raus.length, "nichts Schreibendes hat den Rahmen verlassen", raus.slice(0, 4).join(" | ") || "0 Anfragen");
    pruef(!db.length, "keine Anfrage an die Datenbank, auch kein Lesen", db.slice(0, 4).join(" | ") || "0 Anfragen");
    const nachgespielt = await p.evaluate(() => window.OMOTENO_DEMO_ANFRAGEN.slice());
    pruef(nachgespielt.includes("bestellung_aufgeben") && nachgespielt.includes("bestellung_status"),
      "… sie wurden nachgespielt (Bestellung, Stand)", [...new Set(nachgespielt)].join(","));
    pruef(!fehler.length, "keine Seitenfehler", fehler[0]);
    await p.close();

    /* 2 · echter Speicher danach unverändert */
    /* Das Vorführhaus liest nie den echten Speicher — gelesen wird er
       deshalb über die Datei eines gewöhnlichen Hauses (gleiche Herkunft). */
    ({ p } = await oeffnen(browser, vorfuehrhaus ? HAEUSER.find(h => !VORFUEHRHAUS(h)) : haus, { ctx, demo:false }));
    const echt = await p.evaluate(h => ({ licht:localStorage.getItem("omoteno-licht-" + h), korb:localStorage.getItem("omoteno-merk-" + h),
      marke:localStorage.getItem("probe-marke") }), haus);
    /* §8.1r: Ist auch die fremde Marke weg, hat die UMGEBUNG den Speicher
       verloren (kopfloses Chromium mit file:// unter Last) — die
       Vorführung schreibt nirgends hinein und könnte höchstens „schwarz“
       hinterlassen, nie nichts. Dann zählt der Fall als nicht gemessen
       und wird einmal wiederholt, statt grün zu werden. */
    if(echt.marke !== "1" && !wiederholt.has(haus)){
      console.log("  hinw  " + haus + ": Speicher der Umgebung verloren (fremde Marke weg) — Haus wird einmal wiederholt");
      wiederholt.add(haus); await ctx.close(); HAEUSER.push(haus); continue;
    }
    pruef(echt.licht === "hell" && !echt.korb, "danach: echte Wahl unverändert „hell“, kein Vorführ-Korb auf dem Gerät", JSON.stringify(echt));
    await ctx.close();
  }
  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if(f){ console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
