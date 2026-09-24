/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Gastkonto ohne Konto („Mein Tisch")

   Läuft gegen den ERZEUGTEN Hub, nicht gegen das Gerüst:

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-gastkonto.js

   Die Datenschicht wird nachgebaut (page.route), damit die Oberfläche
   prüfbar ist, ohne echte Gäste anzufassen.

   Zwei Dinge prüft sie, weil beide schon einmal schiefgingen:

   1 · GERÄT IST NICHT QUITTUNG. bestellungen.gast_kennung ist die
       Quittungsnummer EINER Bestellung, liegt unter einem UNIQUE-Index,
       und bestellung_aufgeben gibt bei bekannter Nummer die vorhandene
       id zurück statt neu anzulegen. Wer dort das Gerät einträgt,
       verliert ab der zweiten Bestellung jede weitere – still. Deshalb
       schickt der Hub beides getrennt, und das wird hier gemessen.

   2 · KONTRAST WIRD GERECHNET, NICHT ANGESEHEN. Gemessen wird am
       fertigen Bild, nicht aus den Markenblattwerten: Die Flächen sind
       teils durchscheinend, und nur der Browser weiß, was am Ende
       darunter liegt. Tag und Abend, jedes Markenblatt, Grenze 4,5:1
       (3:1 bei großer, fetter Schrift).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

/* Die Wurzel, nicht das eigene Verzeichnis: dist/ liegt eine
   Ebene hoeher als pruefungen/. */
const HIER = path.resolve(__dirname, "..");
const BID  = "af095b14-d9ef-41f4-9b97-c4422b0de63f";   /* frei erfunden */

const MASSE = [
  { name: "iPhone SE", width: 390, height:  664 },
  { name: "iPhone 14", width: 390, height:  844 },
  { name: "iPad",      width: 820, height: 1180 },
  { name: "Rechner",   width: 1440, height: 900 }
];

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

/* Welche Hubs liegen erzeugt vor? Ohne dist/ hat die Prüfung nichts
   zu tun – dann sagt sie das, statt grün zu melden. */
function erzeugteHubs(){
  const ordner = path.join(HIER, "dist");
  if(!fs.existsSync(ordner)) return [];
  return fs.readdirSync(ordner)
    .filter(s => fs.existsSync(path.join(ordner, s, "index.html")))
    .sort();
}

const ANTWORT_LEER = { ok:true, neu:true,  besuche:1,  lieblinge:[], gutscheine:[] };
const ANTWORT_VOLL = {
  ok:true, neu:false, besuche:12,
  lieblinge:  [{ name:"__GERICHT__", mal:11 }],
  gutscheine: [{ titel:"Ein Heißgetränk aufs Haus", text:"Weil Sie öfter da sind.",
                 code:"DANKE-7Q2", bis:"2026-12-24T22:00:00+00:00" }]
};

async function verdrahten(seite, antwort, gesammelt, verzoegerung){
  /* Auffangroute ZUERST registrieren: Playwright prüft die ZULETZT
     registrierte Route zuerst. Andersherum schluckt sie alles. */
  await seite.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await seite.route("**/rest/v1/betriebe**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"" }]) }));
  await seite.route("**/rest/v1/rpc/gast_melden", async r => {
    gesammelt.melden.push(JSON.parse(r.request().postData() || "{}"));
    if(verzoegerung) await new Promise(f => setTimeout(f, verzoegerung));
    r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify(antwort) });
  });
  await seite.route("**/rest/v1/rpc/gast_mail_merken", r => {
    gesammelt.mail.push(JSON.parse(r.request().postData() || "{}"));
    r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify({ ok:true }) });
  });
  await seite.route("**/rest/v1/rpc/bestellung_aufgeben", r => {
    gesammelt.bestellt.push(JSON.parse(r.request().postData() || "{}"));
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify("11111111-2222-3333-4444-" +
        String(gesammelt.bestellt.length).padStart(12, "0")) });
  });
}

const leer = () => ({ melden:[], mail:[], bestellt:[] });

/* Ein Gericht, das es in DIESEM Haus wirklich gibt – sonst prüft der
   Sprung nichts. */
async function erstesGericht(seite){
  return seite.evaluate(() => {
    for(const quelle of [SPEISEKARTE, GETRAENKE, COCKTAILS])
      for(const gr of quelle)
        for(const e of gr.eintraege) return e.n;
    return "";
  });
}

/* ═══ Kontrast am fertigen Bild ═══════════════════════════════════ */
const MESSUNG = `
(() => {
  /* Eine aus color-mix() gerechnete Fläche kommt als
     "color(srgb r g b / a)" mit Werten 0..1 zurück, nicht als rgb().
     Ohne Umrechnung läse man sie als fast Schwarz — und die Messung
     träfe die neue Fläche von „Mein Tisch" gar nicht (CLAUDE.md §8.1g). */
  const zahl = t => {
    const s = String(t);
    const w = (s.match(/[\\d.]+/g) || []).map(Number);
    if(/^color\\(srgb/.test(s)) return w.map((x, i) => i < 3 ? x * 255 : x);
    return w;
  };
  const kanal = c => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
  const leucht = p => .2126*kanal(p[0]) + .7152*kanal(p[1]) + .0722*kanal(p[2]);
  const mischen = (oben, unten) => {
    const a = oben.length > 3 ? oben[3] : 1;
    return [0,1,2].map(i => Math.round(oben[i]*a + unten[i]*(1-a)));
  };
  /* Grund suchen: nach oben laufen und jede durchscheinende Fläche auf
     die darunter mischen, bis eine deckt. */
  function grundVon(el){
    const stapel = []; let k = el;
    while(k){
      const b = zahl(getComputedStyle(k).backgroundColor);
      if(b.length >= 3 && (b.length < 4 || b[3] > 0)) stapel.push(b);
      if(b.length === 3 || (b.length === 4 && b[3] === 1)) break;
      k = k.parentElement;
    }
    let unten = stapel.pop() || [255,255,255];
    while(stapel.length) unten = mischen(stapel.pop(), unten);
    return unten;
  }
  const paare = [
    [".gastkopf .zahl",       "Besuchszahl auf Fläche"],
    [".gastkopf .wort",       "Text auf Fläche"],
    [".gastkopf .wort small", "Nebentext auf Fläche"],
    [".gastzeile span",       "Liebling auf Karte"],
    [".gastzeile .mal",       "Anzahl auf Karte"],
    [".gutschein b",          "Gutscheintitel"],
    [".gutschein p",          "Gutscheintext"],
    [".gutschein .code",      "Code auf Goldfläche"],
    [".gutschein .bis",       "Frist"],
    [".gastpost .label",      "Post: Überzeile"],
    [".gastpost-kopf b",      "Post: Titel"],
    [".gastpost .hinweis",    "Post: Wofür-Text"],
    [".gastpost .knopf",      "Post: Knopfschrift"]
  ];
  return paare.map(([w, name]) => {
    const el = document.querySelector(w);
    if(!el) return { name, wert:null, gross:false };
    const grund = grundVon(el);
    const vorne = mischen(zahl(getComputedStyle(el).color), grund);
    const a = leucht(vorne), b = leucht(grund);
    return {
      name,
      wert: Math.round(((Math.max(a,b)+.05)/(Math.min(a,b)+.05))*100)/100,
      gross: parseFloat(getComputedStyle(el).fontSize) >= 24 &&
             parseInt(getComputedStyle(el).fontWeight, 10) >= 700
    };
  });
})()
`;

(async () => {
  const hubs = erzeugteHubs();
  if(!hubs.length){
    console.log("Kein erzeugter Hub in dist/. Erst „node erzeuger/erzeuge-hub.js --alle“ laufen lassen.");
    process.exit(1);
  }

  const browser = await chromium.launch();

  /* Die Durchspielung braucht ein Haus mit Karte und eingeschalteter
     Bestellung — ein Markenblatt ohne Gerichte kann sie nicht prüfen.
     Welches das ist, wird nachgesehen und nicht angenommen. */
  let haupt = "";
  for(const slug of hubs){
    const ctx = await browser.newContext();
    const seite = await ctx.newPage();
    await seite.goto("file://" + path.join(HIER, "dist", slug, "index.html"));
    const taugt = await seite.evaluate(() =>
      !!(typeof BESTELLUNG === "object" && BESTELLUNG.an) &&
      SPEISEKARTE.some(gr => gr.eintraege.length));
    await ctx.close();
    if(taugt){ haupt = slug; break; }
  }
  if(!haupt){
    console.log("Kein erzeugter Hub mit Karte und eingeschalteter Bestellung — " +
                "die Durchspielung hätte nichts zu prüfen.");
    await browser.close();
    process.exit(1);
  }
  const HAUPT = "file://" + path.join(HIER, "dist", haupt, "index.html");

  /* ───── 1 · erster Besuch ───── */
  console.log("\n── Erster Besuch (" + haupt + ") ──");
  {
    const ctx = await browser.newContext({ viewport: MASSE[1] });
    const seite = await ctx.newPage();
    const g = leer();
    await verdrahten(seite, ANTWORT_LEER, g);
    await seite.goto(HAUPT);
    await seite.waitForTimeout(400);
    await seite.evaluate(() => { location.hash = "#/meintisch"; });
    await seite.waitForTimeout(400);

    const txt = await seite.textContent("#inhalt");
    pruef(g.melden.length === 1, "gast_melden genau einmal gerufen", "n=" + g.melden.length);
    pruef(/^[A-Za-z0-9_-]{8,64}$/.test(g.melden[0].p_kennung || ""),
      "Kennung passt zur Regel der Datenbank", g.melden[0].p_kennung);
    pruef(/erster Besuch/.test(txt), "erster Besuch benannt");
    pruef(/sammeln sich hier Ihre Lieblingsspeisen/.test(txt),
      "kein leeres Feld, sondern ein Satz");
    pruef(!/IHRE LIEBLINGE/.test(txt), "keine Überschrift ohne Inhalt darunter");
    pruef(/FREIWILLIG/.test(txt), "E-Mail ausdrücklich freiwillig");
    pruef(/Bestätigungsmail/.test(txt), "Doppelbestätigung angekündigt");

    await seite.fill("#gastMail", "gast@example.de");
    await seite.click('[data-aktion="gastMail"]');
    await seite.waitForTimeout(300);
    pruef(g.mail.length === 1 && g.mail[0].p_email === "gast@example.de",
      "Adresse geht an gast_mail_merken");
    pruef(g.mail[0].p_kennung === g.melden[0].p_kennung, "dieselbe Gerätekennung");
    pruef(/bestätigt/.test(await seite.textContent("#melde")),
      "Rückmeldung verspricht nichts, was noch nicht geht");
    await ctx.close();
  }

  /* ───── 2 · Wiederkehrer ───── */
  console.log("\n── Wiederkehrer mit Lieblingen und Gutschein ──");
  {
    const ctx = await browser.newContext({ viewport: MASSE[1] });
    const seite = await ctx.newPage();
    const g = leer();
    await seite.goto(HAUPT);
    const gericht = await erstesGericht(seite);
    await ctx.close();

    const ctx2 = await browser.newContext({ viewport: MASSE[1] });
    const s2 = await ctx2.newPage();
    const voll = JSON.parse(JSON.stringify(ANTWORT_VOLL));
    voll.lieblinge[0].name = gericht;
    voll.lieblinge.push({ name: "Gibt es nicht mehr", mal: 2 });
    await verdrahten(s2, voll, g);
    await s2.goto(HAUPT);
    await s2.waitForTimeout(400);
    await s2.evaluate(() => { location.hash = "#/meintisch"; });
    await s2.waitForTimeout(400);

    const txt = await s2.textContent("#inhalt");
    pruef(/12\. Besuch/.test(txt), "Besuchszahl steht da");
    pruef(txt.indexOf(gericht) >= 0 && /11×/.test(txt), "Liebling mit Anzahl", gericht);
    pruef(/DANKE-7Q2/.test(txt), "Gutscheincode sichtbar");
    pruef(/Eingelöst wird am Tisch/.test(txt), "Einlösung ehrlich erklärt");

    const schrift = await s2.$eval(".gastkopf .zahl", el => getComputedStyle(el).fontFamily);
    pruef(/mono/i.test(schrift), "Zahlen in Schreibmaschinenschrift");

    const zeilen = await s2.$$(".gastzeile");
    pruef(zeilen.length === 2, "zwei Zeilen");
    pruef(await zeilen[1].isDisabled(), "verschwundenes Gericht führt nirgendwohin");
    await zeilen[0].click();
    await s2.waitForTimeout(600);
    /* zeichne() räumt „?g=…“ nach dem Öffnen wieder aus der Adresse —
       geprüft wird deshalb, ob das Gericht offen ist, nicht der Hash. */
    pruef((await s2.textContent("#warenkarte")).indexOf(gericht) >= 0,
      "Sprung öffnet das Gericht selbst");
    await ctx2.close();
  }

  /* ───── 3 · Ladezustand ───── */
  console.log("\n── Ladezustand ──");
  {
    const ctx = await browser.newContext({ viewport: MASSE[1] });
    const seite = await ctx.newPage();
    await verdrahten(seite, ANTWORT_LEER, leer(), 2500);
    await seite.goto(HAUPT);
    await seite.waitForTimeout(300);
    await seite.evaluate(() => { location.hash = "#/meintisch"; });
    await seite.waitForTimeout(300);
    pruef((await seite.$$(".skelett")).length >= 3, "Skelett statt leerer Fläche");
    await seite.waitForTimeout(2600);
    pruef((await seite.$$(".skelett")).length === 0, "Skelett geht, wenn die Antwort da ist");
    pruef(/erster Besuch/.test(await seite.textContent("#inhalt")), "Inhalt kommt nach");
    await ctx.close();
  }

  /* ───── 4 · zwei Bestellungen, ein Gerät ───── */
  console.log("\n── Zwei Bestellungen von einem Gerät ──");
  {
    const ctx = await browser.newContext({ viewport: MASSE[1] });
    const seite = await ctx.newPage();
    const g = leer();
    await verdrahten(seite, ANTWORT_LEER, g);
    await seite.goto(HAUPT);
    await seite.waitForTimeout(400);

    /* Der Bestellteil erscheint nur, wenn der Betrieb GERADE geöffnet
       hat. Sonst hinge diese Prüfung an der Uhr des Prüfrechners und
       liefe nachts rot — geprüft wird hier die Kennung, nicht die
       Öffnungszeit. */
    await seite.evaluate(() => { try{ bestellStopp = () => null; }catch(e){} });

    async function bestellen(){
      await seite.evaluate(() => { location.hash = "#/speisekarte"; });
      await seite.waitForTimeout(300);
      await seite.evaluate(() => {
        const h = document.querySelector("[data-merk]"); if(h) h.click();
      });
      await seite.waitForTimeout(200);
      await seite.evaluate(() => { location.hash = "#/auswahl"; });
      await seite.waitForTimeout(300);
      /* Die Tischnummer steht nicht immer als Feld da: Kommt der Gast
         über den Untersetzer, kennt der Hub den Tisch schon. */
      const feld = await seite.$("#bTisch");
      if(feld) await feld.fill("7");
      /* Wartezeit zwischen zwei Bestellungen aushebeln – sie ist hier
         nicht das Prüfziel. Blanke Zuweisung, nicht window.…: Ein
         top-level let liegt im globalen Lexikon, nicht am window. */
      await seite.evaluate(() => { try{ bestellSperre = 0; }catch(e){} });
      const knopf = await seite.$('[data-aktion="bestellen"]');
      if(knopf) await knopf.click();
      await seite.waitForTimeout(900);
    }

    await bestellen();
    await bestellen();

    pruef(g.bestellt.length >= 2, "zwei Bestellungen abgeschickt", "n=" + g.bestellt.length);
    if(g.bestellt.length >= 2){
      const a = g.bestellt[0], b = g.bestellt[1];
      pruef(a.p_geraet === b.p_geraet && /^[A-Za-z0-9_-]{8,64}$/.test(a.p_geraet || ""),
        "dasselbe Gerät bei beiden");
      pruef(a.p_gast_kennung !== b.p_gast_kennung,
        "verschiedene Quittungsnummern – die zweite wird nicht verschluckt");
      pruef(a.p_geraet !== a.p_gast_kennung, "Gerät und Quittung sind nicht dasselbe Feld");
    }
    await ctx.close();
  }

  /* ───── 5 · Maße ───── */
  console.log("\n── Maße ──");
  for(const m of MASSE){
    const ctx = await browser.newContext({ viewport: m });
    const seite = await ctx.newPage();
    await seite.goto(HAUPT);
    const gericht = await erstesGericht(seite);
    await ctx.close();

    const ctx2 = await browser.newContext({ viewport: m });
    const s2 = await ctx2.newPage();
    const voll = JSON.parse(JSON.stringify(ANTWORT_VOLL));
    voll.lieblinge[0].name = gericht;
    await verdrahten(s2, voll, leer());
    await s2.goto(HAUPT);
    await s2.waitForTimeout(400);
    await s2.evaluate(() => { location.hash = "#/meintisch"; });
    await s2.waitForTimeout(400);
    const ueber = await s2.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(ueber <= 1, m.name + ": kein seitliches Schieben", "Überstand " + ueber + "px");
    await ctx2.close();
  }

  /* ───── 6 · Bewegung reduzieren ───── */
  console.log("\n── prefers-reduced-motion ──");
  {
    const ctx = await browser.newContext({ viewport: MASSE[1], reducedMotion: "reduce" });
    const seite = await ctx.newPage();
    await verdrahten(seite, ANTWORT_LEER, leer(), 1500);
    await seite.goto(HAUPT);
    await seite.waitForTimeout(300);
    await seite.evaluate(() => { location.hash = "#/meintisch"; });
    await seite.waitForTimeout(300);
    /* Der Hub ersetzt bei „Bewegung reduzieren“ jede Einblendung durch
       reinLeise – ein Aufblenden, das einmal läuft. Das gilt auch fürs
       Skelett: Das wandernde Licht läuft dann nicht. */
    const name  = await seite.$eval(".skelett", el => getComputedStyle(el).animationName);
    const runde = await seite.$eval(".skelett", el => getComputedStyle(el).animationIterationCount);
    pruef(name !== "skelettzug", "kein wanderndes Licht", name);
    pruef(runde !== "infinite",  "nichts läuft endlos", runde);
    await ctx.close();
  }

  /* ───── 7 · Kontrast, jedes Haus, Tag und Abend ───── */
  for(const slug of hubs){
    const datei = "file://" + path.join(HIER, "dist", slug, "index.html");
    for(const [phase, stunde] of [["Tag", 14], ["Abend", 22]]){
      const ctx = await browser.newContext({ viewport: MASSE[1] });
      const seite = await ctx.newPage();
      await verdrahten(seite, ANTWORT_VOLL, leer());
      await seite.goto(datei);
      await seite.waitForTimeout(400);
      await seite.evaluate(h => { stunde = h; nachtSchalten(); }, stunde);
      await seite.evaluate(() => { location.hash = "#/meintisch"; });
      await seite.waitForTimeout(500);

      console.log("\n── Kontrast · " + slug + " · " + phase + " ──");
      for(const w of await seite.evaluate(MESSUNG)){
        if(w.wert == null){ pruef(false, w.name + " (nicht gefunden)"); continue; }
        /* Große, fette Schrift darf nach WCAG bei 3:1 liegen. */
        const grenze = w.gross ? 3 : 4.5;
        pruef(w.wert >= grenze,
          w.name.padEnd(26) + w.wert.toFixed(2) + ":1", "mind. " + grenze);
      }
      await ctx.close();
    }
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
