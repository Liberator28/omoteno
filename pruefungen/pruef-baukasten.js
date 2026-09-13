/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Der Kachel-Baukasten

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-baukasten.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle“)

   Der Wirt stellt im Admin-Board ein, was der Gast auf der Startseite
   seines Hubs sieht: welche Knöpfe, wie sie heißen, welches Symbol
   und welches Bild.

   Drei Dinge können dabei schiefgehen, und für jedes steht hier eine
   Probe:

   1 · DIE ZWEITE QUELLE LÄUFT AUS DEM RUDER. Der Baukasten kennt
       seine Kachelliste selbst (KACHELPLAN in admin.html), das Gerüst
       hat seine eigene (KACHELARTEN). Zwei Listen, die dasselbe
       meinen, laufen auseinander — und dann bietet das Board einen
       Knopf an, den der Hub nicht kennt (CLAUDE.md §8.1b).

   2 · DAS BILD FRISST DIE SCHRIFT. Ein Foto ist ein Grund, den der
       WIRT bestimmt. Rechnen lässt sich darauf nichts: Es kann oben
       weiß und unten schwarz sein (§5.1). Deshalb liegt die Schrift
       nie darauf — und genau das wird hier am gezeichneten Bild
       gemessen, nicht am Vorsatz.

   3 · DER ZUSCHNITT LIEFERT EINE FEHLPROPORTION. Der Rahmen hat das
       Verhältnis der Kachel; was herauskommt, muss es auch haben.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN   = path.join(__dirname, "..");
const ADMIN  = path.join(OBEN, "seiten", "admin.html");
const GERUEST= path.join(OBEN, "vorlagen", "hub.vorlage.html");
for(const d of [ADMIN, GERUEST]){
  if(!fs.existsSync(d)){ console.error(d + " fehlt."); process.exit(1); }
}
function hubDatei(name){
  const f = path.join(OBEN, "dist", name, "index.html");
  return fs.existsSync(f) ? "file://" + f : null;
}

let fehler = 0;
const ok = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };
/* Aborts durch die Route zählen nicht als Fehler der Seite. */
const echt = k => k.filter(z => !/net::ERR|Failed to load|ERR_FAILED/i.test(z));

const BID = "11111111-2222-3333-4444-555555555555";
const BILD = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240">' +
             '<rect width="600" height="240" fill="#ffffff"/></svg>';

/* ─────────────────────────────────────────────────────────────────
   1 · ZWEITE QUELLE — Board gegen Gerüst
   ───────────────────────────────────────────────────────────────── */
function zweiteQuelle(){
  console.log("\n══ Zweite Quelle: KACHELPLAN gegen KACHELARTEN ══");
  const admin  = fs.readFileSync(ADMIN, "utf8");
  const geruest= fs.readFileSync(GERUEST, "utf8");

  const planBlock = (admin.match(/const KACHELPLAN = \[([\s\S]*?)\n\];/) || [])[1] || "";
  const artBlock  = (geruest.match(/const KACHELARTEN = \{([\s\S]*?)\n\};/) || [])[1] || "";
  ok(!!planBlock, "KACHELPLAN steht im Board");
  ok(!!artBlock,  "KACHELARTEN steht im Gerüst");
  if(!planBlock || !artBlock) return;

  const planS = [...planBlock.matchAll(/\{\s*s:"([a-z]+)"/g)].map(m => m[1]);
  const artS  = [...artBlock.matchAll(/^  ([a-z]+):\s*\{/gm)].map(m => m[1]);

  const fehltImBoard = artS.filter(x => planS.indexOf(x) < 0);
  const fehltImHub   = planS.filter(x => artS.indexOf(x) < 0);
  ok(fehltImBoard.length === 0,
    "jede Kachel des Gerüsts steht auch im Baukasten",
    fehltImBoard.join(", ") || planS.length + " Kacheln");
  ok(fehltImHub.length === 0,
    "der Baukasten erfindet keine Kachel, die es nicht gibt",
    fehltImHub.join(", ") || "keine erfundene");

  /* Titel und Symbol müssen ebenfalls stimmen — sonst schlägt das
     Board einen Namen vor, den der Hub nie zeigt. */
  const abw = [];
  planS.forEach(s => {
    const pT = (planBlock.match(new RegExp('s:"' + s + '",\\s*titel:"([^"]*)"')) || [])[1];
    const aT = (artBlock.match(new RegExp('^  ' + s + ':[\\s\\S]*?titel:"([^"]*)"', "m")) || [])[1];
    const pI = (planBlock.match(new RegExp('s:"' + s + '"[\\s\\S]{0,220}?icon:"([a-z]+)"')) || [])[1];
    const aI = (artBlock.match(new RegExp('^  ' + s + ':[\\s\\S]*?icon:"([a-z]+)"', "m")) || [])[1];
    if(pT !== aT) abw.push(s + ": Titel " + pT + " gegen " + aT);
    if(pI !== aI) abw.push(s + ": Symbol " + pI + " gegen " + aI);
  });
  ok(abw.length === 0, "Titel und Symbol stimmen überein",
    abw.slice(0,3).join(" · ") || planS.length + " geprüft");

  /* Jedes vorgeschlagene Symbol muss es geben. Ein erfundener Name
     zeichnete einen leeren Knopf — und niemand merkte es. */
  const icons = (admin.match(/const ICONS = \{([\s\S]*?)\n\};/) || [])[1] || "";
  const vorhanden = [...icons.matchAll(/^  ([a-z]+):/gm)].map(m => m[1]);
  const genannt = [...(admin.match(/const KB_SYMBOLGRUPPEN = \[([\s\S]*?)\n\];/) || ["",""])[1]
                    .matchAll(/"([a-z]+)"/g)].map(m => m[1])
                    .filter(n => n !== "Immer");
  const unbekannt = genannt.filter(n => vorhanden.indexOf(n) < 0 && !/[A-ZÄÖÜ ]/.test(n));
  ok(unbekannt.length === 0, "jedes vorgeschlagene Symbol existiert",
    unbekannt.join(", ") || genannt.length + " Nennungen");
}

/* ─────────────────────────────────────────────────────────────────
   2 · DAS BOARD VON HAND
   ───────────────────────────────────────────────────────────────── */
async function board(br){
  console.log("\n══ Der Baukasten im Board ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,140)));
  p.on("console", m => { if(m.type()==="error") kons.push(m.text().slice(0,140)); });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); }
  });
  await p.waitForTimeout(400);
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(300); }

  await p.evaluate(() => tafelZeigen("startseite"));
  await p.waitForTimeout(400);

  const a = await p.evaluate(() => ({
    sichtbar: !document.getElementById("t-startseite").hidden,
    zeilen: document.querySelectorAll("[data-kb]").length,
    leereSymbole: [...document.querySelectorAll("[data-kb-icon]")]
      .filter(b => !b.querySelector("svg")).length,
    /* Unter 16px zoomt iOS beim Antippen in die Seite (§3.5). */
    kleinsteSchrift: Math.min(...[...document.querySelectorAll(".kbfelder input")]
      .map(i => parseFloat(getComputedStyle(i).fontSize)))
  }));
  ok(a.sichtbar, "der Bereich „Startseite“ öffnet sich");
  ok(a.zeilen === 13, "jede Kachel hat eine Zeile", a.zeilen + " Zeilen");
  ok(a.leereSymbole === 0, "kein Symbolknopf ist leer", a.leereSymbole + " leer");
  ok(a.kleinsteSchrift >= 16, "die Eingabefelder haben 16px",
    a.kleinsteSchrift + "px");

  /* Die Symbolwahl startet zu — bei elf Kacheln wären sonst knapp 420
     Symbolknöpfe auf einmal offen. Das gewählte Symbol steht schon in
     der Vorschau (.kbschau); die Wahl selbst ist reiner Komfort. */
  const zuVorher = await p.evaluate(() => {
    const knopf = document.querySelector('[data-kb="tischruf"] .kbsymknopf');
    const klapp = document.getElementById(knopf.getAttribute("aria-controls"));
    return {
      expanded: knopf.getAttribute("aria-expanded"),
      hoehe: klapp.getBoundingClientRect().height
    };
  });
  ok(zuVorher.expanded === "false" && zuVorher.hoehe < 2,
    "die Symbolwahl startet zu", JSON.stringify(zuVorher));

  await p.click('[data-kb="tischruf"] .kbsymknopf');
  await p.waitForTimeout(450);
  const aufNachher = await p.evaluate(() => {
    const knopf = document.querySelector('[data-kb="tischruf"] .kbsymknopf');
    const klapp = document.getElementById(knopf.getAttribute("aria-controls"));
    return { expanded: knopf.getAttribute("aria-expanded"), hoehe: klapp.getBoundingClientRect().height };
  });
  ok(aufNachher.expanded === "true" && aufNachher.hoehe > 100,
    "ein Tipp klappt sie auf", JSON.stringify(aufNachher));

  await p.click('[data-kb="tischruf"] [data-kb-icon="glocke"]');
  await p.waitForTimeout(150);
  const b = await p.evaluate(() => ({
    gedrueckt: document.querySelector('[data-kb="tischruf"] [data-kb-icon="glocke"]')
                 .getAttribute("aria-pressed"),
    stand: (KACHELSTAND.find(k => k.schluessel === "tischruf") || {}).icon
  }));
  ok(b.gedrueckt === "true" && b.stand === "glocke",
    "ein Symbol lässt sich wählen", b.stand);

  await p.fill('[data-kb="tischruf"] [data-kb-titel]', "Kellner rufen");
  await p.waitForTimeout(200);
  const c = await p.evaluate(() => ({
    schau: (document.querySelector('[data-kb="tischruf"] .kbschau .kbstxt b') || {}).textContent,
    fokus: document.activeElement && document.activeElement.matches("[data-kb-titel]")
  }));
  ok(c.schau === "Kellner rufen", "die Vorschau zieht beim Tippen mit", c.schau);
  /* Wer beim Tippen die Liste neu zeichnet, nimmt dem Feld den
     Blinker — nach jedem Buchstaben. Deshalb wird das gemessen. */
  ok(c.fokus === true, "und das Feld behält den Schreibblinker");

  /* Der Zuschnitt. Absichtlich ein HOCHFORMAT hinein: Käme es
     unverändert wieder heraus, prüfte die Probe nichts. */
  const bildDatei = path.join(require("os").tmpdir(), "pruef-baukasten-hoch.png");
  fs.writeFileSync(bildDatei, hochformat());
  await p.setInputFiles('[data-kb="tischruf"] [data-kb-datei]', bildDatei);
  await p.waitForTimeout(600);

  const d = await p.evaluate(() => {
    const r = document.getElementById("kbRahmen").getBoundingClientRect();
    return { offen: !document.getElementById("kbBlatt").hidden,
             hoehe: Math.round(r.height),
             verhaeltnis: r.height > 0 ? +(r.width/r.height).toFixed(2) : 0,
             soll: KB_FORMAT.reihe };
  });
  ok(d.offen, "das Zuschnitt-Blatt öffnet sich");
  ok(d.hoehe > 40, "der Rahmen hat eine Höhe", d.hoehe + "px");
  ok(Math.abs(d.verhaeltnis - d.soll) < 0.06,
    "der Rahmen trägt das Verhältnis der Kachel",
    d.verhaeltnis + " gegen " + d.soll);

  const e = await p.evaluate(async () => {
    const blob = await kbAusschnitt();
    const bild = await createImageBitmap(blob);
    return { typ: blob.type, gross: blob.size, b: bild.width, h: bild.height,
             verhaeltnis: +(bild.width/bild.height).toFixed(2) };
  });
  ok(Math.abs(e.verhaeltnis - KB_SOLL) < 0.01,
    "was herauskommt, hat GENAU dieses Verhältnis",
    e.b + "×" + e.h + " = " + e.verhaeltnis);
  ok(e.gross < fs.statSync(bildDatei).size,
    "und ist kleiner als das, was hineinging",
    Math.round(e.gross/1024) + " KB statt " +
    Math.round(fs.statSync(bildDatei).size/1024) + " KB");
  ok(/^image\//.test(e.typ), "es ist ein Bild", e.typ);

  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}
const KB_SOLL = 2.50;

/* Ein Hochformat-PNG, von Hand gebaut — die Prüfung soll ohne
   zusätzliche Pakete laufen. */
function hochformat(){
  const zlib = require("zlib");
  const B = 100, H = 200;
  const roh = [];
  for(let y = 0; y < H; y++){
    roh.push(0);
    for(let x = 0; x < B; x++) roh.push((x*255/B)|0, (y*255/H)|0, 120);
  }
  const stueck = (typ, daten) => {
    const laenge = Buffer.alloc(4); laenge.writeUInt32BE(daten.length);
    const kopf = Buffer.from(typ, "ascii");
    const summe = Buffer.alloc(4);
    summe.writeUInt32BE(require("zlib").crc32
      ? require("zlib").crc32(Buffer.concat([kopf, daten]))
      : crc32(Buffer.concat([kopf, daten])));
    return Buffer.concat([laenge, kopf, daten, summe]);
  };
  const kopfDaten = Buffer.alloc(13);
  kopfDaten.writeUInt32BE(B, 0); kopfDaten.writeUInt32BE(H, 4);
  kopfDaten[8] = 8; kopfDaten[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    stueck("IHDR", kopfDaten),
    stueck("IDAT", zlib.deflateSync(Buffer.from(roh))),
    stueck("IEND", Buffer.alloc(0))
  ]);
}
/* CRC32 nach PNG-Spezifikation — Node bringt es erst ab 22 mit. */
let crcTabelle = null;
function crc32(puffer){
  if(!crcTabelle){
    crcTabelle = new Int32Array(256);
    for(let n = 0; n < 256; n++){
      let c = n;
      for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      crcTabelle[n] = c;
    }
  }
  let c = 0xFFFFFFFF;
  for(const b of puffer) c = crcTabelle[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ─────────────────────────────────────────────────────────────────
   3 · DER HUB — was der Gast wirklich bekommt
   ───────────────────────────────────────────────────────────────── */
async function hub(br, datei, hausName){
  console.log("\n══ Der Hub · " + hausName + " ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,140)));

  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await p.route("**/rest/v1/betriebe**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"",
        hub_texte:{}, hub_kacheln:[
          { schluessel:"speisekarte", titel:"Unsere Karte",
            banner:"https://bild.test/banner.svg" },
          { schluessel:"tischruf", titel:"Service", unter:"Kurz Bescheid geben",
            banner:"https://bild.test/banner.svg" },
          /* Kein https → muss ignoriert werden, nicht gezeichnet. */
          { schluessel:"wlan", banner:"javascript:alert(1)" },
          { schluessel:"quiz", an:false }
        ] }]) }));
  await p.route("https://bild.test/**", r =>
    r.fulfill({ status:200, contentType:"image/svg+xml", body:BILD }));
  await p.addInitScript(() => localStorage.setItem("omoteno-willkommen","1"));
  await p.goto(datei);
  await p.waitForTimeout(1900);

  const d = await p.evaluate(() => {
    const alle = [...document.querySelectorAll("a.kachel")];
    const titel = alle.map(a => (a.querySelector(".txt strong")||{}).textContent);
    const mit = alle.filter(a => a.classList.contains("hatbanner"));
    let unterSchrift = "kein Banner", bildAnteil = 0, luecke = 0;
    const eine = document.querySelector("a.kachel.hatbanner:not(.saeule)");
    if(eine){
      const t = eine.querySelector(".txt strong").getBoundingClientRect();
      const b = eine.querySelector(".kbanner").getBoundingClientRect();
      /* GEMESSEN WIRD DIE GEOMETRIE, nicht elementFromPoint.
         Mein erster Versuch fragte den Punkt unter der Schrift — und
         konnte deshalb NIE „BILD" sagen: .kbanner trägt
         pointer-events:none, die Trefferprüfung geht durch das Bild
         hindurch. Die Probe war grün und wäre es auch geblieben,
         wenn das Bild die ganze Kachel bedeckt hätte. Eine Probe,
         die den Fehler nicht zeigen KANN, ist keine (§8.1g).

         Die Zusage lautet: Die linke Kante des Bildes liegt rechts
         von der rechten Kante der Schrift. Das ist prüfbar. */
      luecke = Math.round(b.left - t.right);
      unterSchrift = luecke >= 0 ? "Fläche" : "BILD";
      bildAnteil = Math.round(b.width / eine.getBoundingClientRect().width * 100);
    }
    return { anzahl: alle.length, titel: titel, mitBanner: mit.length,
             unterSchrift, bildAnteil, luecke,
             quiz: titel.some(x => /Quiz/i.test(x || "")),
             fuerbetrieb: !!document.getElementById("fuerbetrieb") };
  });

  ok(d.titel.indexOf("Unsere Karte") >= 0,
    "der Titel aus dem Board steht im Hub", d.titel.slice(0,3).join(" · "));
  ok(d.mitBanner === 2, "genau die zwei Kacheln mit Bild tragen eins",
    d.mitBanner + " von " + d.anzahl);
  ok(d.unterSchrift === "Fläche",
    "die Schrift liegt auf der Fläche, NIE auf dem Bild",
    d.unterSchrift + " (" + d.luecke + "px Abstand)");
  ok(d.bildAnteil > 20 && d.bildAnteil < 60,
    "das Bild nimmt einen sichtbaren, aber nicht den ganzen Knopf ein",
    d.bildAnteil + "%");
  ok(!d.quiz, "eine abgeschaltete Kachel erscheint nicht");
  ok(!d.fuerbetrieb, "„Für den Betrieb“ steht dem Gast nicht mehr im Weg");
  ok(kons.length === 0, "kein Fehler in der Konsole", kons[0] || "still");
  await ctx.close();
  return d;
}

(async () => {
  zweiteQuelle();

  const choco = hubDatei("chocolamour"), blend = hubDatei("blend");
  if(!choco){
    console.error("Kein erzeugter Hub in dist/. Erst: node erzeuger/erzeuge-hub.js --alle");
    process.exit(1);
  }

  /* Kein erzeugter Hub darf ein Banner EINGEBACKEN haben. Es kommt
     aus der Datenbank, je Betrieb — sonst trüge der zweite Kunde die
     Bilder des ersten (§8.1a). */
  console.log("\n══ Kein Bild ist eingebacken ══");
  ["chocolamour","blend"].forEach(n => {
    const f = path.join(OBEN, "dist", n, "index.html");
    if(!fs.existsSync(f)) return;
    const t = fs.readFileSync(f, "utf8");
    const treffer = [...t.matchAll(/banner:\s*"(https?:[^"]+)"/g)].map(m => m[1]);
    ok(treffer.length === 0, n + " trägt kein festes Banner",
      treffer.join(", ") || "keins");
  });

  const br = await chromium.launch();
  await board(br);
  await hub(br, choco, "Choco");
  if(blend) await hub(br, blend, "Blend");
  await br.close();

  console.log("\n" + (fehler ? fehler + " Fehler" : "Keine Fehler"));
  process.exit(fehler ? 1 : 0);
})();
