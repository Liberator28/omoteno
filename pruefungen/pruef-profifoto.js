/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Profi-Foto und Pop-Freisteller

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-profifoto.js

   DIE NAHT ZUERST (CLAUDE.md §8.1i). Vier Stellen müssen sich einig
   sein, und jede steht in einer anderen Datei:
     · migration-bild-ki.sql     Spalte bild_frei, CHECK-Liste für plan
     · gericht-bild/index.ts     Tarif-Liste, Eingabefelder, Antwort, Fehler
     · admin.html                BK_PLAENE, BK_FEHLER, was gesendet/gelesen wird
     · hub.vorlage.html          liest z.bild_frei
   Sie werden als QUELLTEXT gegeneinander gehalten — nicht jede gegen
   eine Erfindung der anderen.

   Danach das Board bedient (die Edge Function wird dort GESTELLT —
   die echte Funktion ist live und antwortet ohne FAL_KEY nur mit
   „kein_schluessel“) und der Hub mit einer nachgestellten Zeile aus
   der Datenbank samt echtem transparentem PNG.

   EHRLICHE GRENZE: Ob fal.ai so antwortet, wie die Dokumentation sagt,
   sieht diese Prüfung nicht (kein Netz, kein Schlüssel). Der erste
   echte Lauf gehört dem Betreiber.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OBEN  = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const HUBQ  = path.join(OBEN, "vorlagen", "hub.vorlage.html");
const EDGE  = path.join(OBEN, "supabase", "functions", "gericht-bild", "index.ts");
const MIGR  = path.join(OBEN, "datenbank", "migration-bild-ki.sql");
const HUB   = slug => "file://" + path.join(OBEN, "dist", slug, "index.html");
const EMO   = path.join(OBEN, "auslieferung", "emoji");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

/* Ein echtes PNG mit Alpha: ein runder „Teller“ auf durchsichtigem Grund.
   Von Hand gebaut, damit die Prüfung keine Bildbibliothek braucht. */
function tellerPNG(k = 64) {
  const zeilen = [];
  for (let y = 0; y < k; y++) {
    const z = [0];
    for (let x = 0; x < k; x++) {
      const d = Math.hypot(x - k / 2, y - k / 2);
      z.push(...(d < k * .42 ? [228, 178, 98, 255] : [0, 0, 0, 0]));
    }
    zeilen.push(Buffer.from(z));
  }
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const block = (typ, daten) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(daten.length);
    const t = Buffer.from(typ); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, daten])));
    return Buffer.concat([l, t, daten, c]);
  };
  const kopf = Buffer.alloc(13); kopf.writeUInt32BE(k, 0); kopf.writeUInt32BE(k, 4); kopf[8] = 8; kopf[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), block("IHDR", kopf),
    block("IDAT", zlib.deflateSync(Buffer.concat(zeilen))), block("IEND", Buffer.alloc(0))]);
}
const PNG = tellerPNG();

const BETRIEB = "af095b14-d9ef-41f4-9b97-c4422b0de63f";
const ORDNER  = "https://quxwweuvdqtjsdwgjdrh.supabase.co/storage/v1/object/public/gerichte/" + BETRIEB + "/";
const FREI    = ORDNER + "1-frei.png";
const PROFI   = ORDNER + "1-profi.jpg";

(async () => {
  const admin = fs.readFileSync(ADMIN, "utf8");
  const hubq  = fs.readFileSync(HUBQ, "utf8");
  const edge  = fs.readFileSync(EDGE, "utf8");
  const migr  = fs.readFileSync(MIGR, "utf8");

  console.log("\n══ Die Naht: vier Dateien, eine Wahrheit ══");
  const liste = (quelle, re) => { const m = quelle.match(re); return m ? JSON.parse(m[1].replace(/'/g, '"')) : null; };
  const board = liste(admin, /const BK_PLAENE = (\[[^\]]*\])/);
  const fn    = liste(edge, /const PLAENE_BILD_KI = (\[[^\]]*\])/);
  const chk   = (migr.match(/plan in \(([^)]*)\)/) || [])[1];
  const db    = chk ? chk.split(",").map(x => x.trim().replace(/'/g, "")) : null;
  pruef(!!board && !!fn && JSON.stringify(board) === JSON.stringify(fn), "Tarif-Liste im Board = in der Edge Function", JSON.stringify(board) + " / " + JSON.stringify(fn));
  pruef(!!db && fn && fn.every(p => db.includes(p)) && db.filter(p => !fn.includes(p)).join() === "basic",
    "jeder freigeschaltete Tarif steht in der CHECK-Liste, ausgeschlossen ist genau „basic“", JSON.stringify(db));

  const fehlerFn = ((edge.match(/type Fehler =([^;]*);/) || [])[1] || "").match(/"([a-z_]+)"/g).map(x => x.replace(/"/g, ""));
  const fehlerBoard = Object.keys(eval("(" + (admin.match(/const BK_FEHLER = (\{[\s\S]*?\n\});/) || [])[1] + ")"));
  const ohneText = fehlerFn.filter(x => !fehlerBoard.includes(x));
  pruef(fehlerFn.length >= 6 && !ohneText.length, "jeder Fehlergrund der Funktion hat im Board einen Satz", ohneText.join(", ") || fehlerFn.length + " Gründe");

  const gesendet = ((admin.match(/invoke\("gericht-bild",[\s\S]*?body:\s*\{([^}]*)\}/) || [])[1] || "").match(/(\w+):/g).map(x => x.replace(":", ""));
  const gelesen  = [...edge.matchAll(/eingabe\.(\w+)/g)].map(m => m[1]);
  pruef(gesendet.length === 3 && gesendet.every(k => gelesen.includes(k)), "was das Board schickt, liest die Funktion", gesendet.join(", ") + " / " + [...new Set(gelesen)].join(", "));

  const antwortFelder = ["profi", "frei", "teilweise", "fehler"];
  const fnGibt = antwortFelder.filter(k => new RegExp("aus\\." + k + "\\b|\\b" + k + "\\?:|fehler:\\s*f").test(edge));
  const boardLiest = antwortFelder.filter(k => new RegExp("data\\." + k + "\\b").test(admin));
  pruef(boardLiest.length === 4 && boardLiest.every(k => fnGibt.includes(k)), "was die Funktion antwortet, liest das Board", boardLiest.join(", "));

  pruef(admin.includes('"/storage/v1/object/public/gerichte/" + betriebId + "/"') &&
        edge.includes('"/storage/v1/object/public/gerichte/" + betrieb + "/"'),
    "Board und Funktion verlangen denselben eigenen Speicherordner");

  /* Die Reihenfolge der Türen: erst Mensch, dann Mitgliedschaft (der
     gezählte Eintrag), DANN erst fal. Stünde ein fal-Aufruf davor,
     verbrauchte ein Fremder Guthaben. */
  const posUser = edge.indexOf("auth.getUser()"), posTuer = edge.indexOf("if (nichtGezaehlt)"),
        posFal = edge.indexOf('fal("fal-ai/');
  pruef(posUser > 0 && posTuer > posUser && posFal > posTuer, "in der Funktion: angemeldet → gezählt (RLS) → erst dann fal",
    [posUser, posTuer, posFal].join(" < "));

  pruef(/add column if not exists bild_frei text/.test(migr), "Migration legt gerichte.bild_frei an");
  pruef(/bild_frei:\s*\$\("#fBildFrei"\)\.value\.trim\(\)\s*\|\|\s*null/.test(admin), "Board speichert bild_frei mit „Sichern“");
  pruef(/z\.bild_frei/.test(hubq) && /rest\/v1\/gerichte\?[\s\S]{0,200}?select=\*/.test(hubq), "Hub liest bild_frei (select=*, keine Liste, die veralten kann)");

  const browser = await chromium.launch();

  console.log("\n══ Board: Knopf, Vergleich, Übernehmen ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const s = await ctx.newPage();
    const fehler = [];
    s.on("pageerror", e => fehler.push(e.message));
    await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await s.goto("file://" + ADMIN);
    await s.waitForTimeout(600);
    await s.evaluate(() => { document.getElementById("tor").hidden = true;
      if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); } });
    await s.waitForTimeout(300);
    const scharf = await s.$("#scharfJetzt");
    if (scharf && await s.isVisible("#scharf")) { await scharf.click(); await s.waitForTimeout(150); }

    /* Vorführmodus zuerst: kein Aufruf, ehrliche Meldung */
    await s.evaluate(b => { blattOeffnen(gerichte[0]); document.getElementById("fBild").value =
      "https://quxwweuvdqtjsdwgjdrh.supabase.co/storage/v1/object/public/gerichte/" + b + "/x.jpg"; }, BETRIEB);
    const vorf = await s.evaluate(async () => { await bkErstellen(); return document.getElementById("bildStand").textContent; });
    pruef(/Vorführmodus/.test(vorf), "Vorführmodus: nichts wird erstellt, und das steht da", vorf);

    /* Ab hier „echt“ — mit gestellter Funktion und gestellter Datenbank */
    await s.evaluate(b => {
      demo = false; betriebId = b; meineBetriebe = [{ id: b, plan: null }];
      window.__aufrufe = []; window.__satz = null;
      window.__antwort = { data: null, error: null };
      db = {
        functions: { invoke: async (name, o) => { window.__aufrufe.push({ name, o }); if (window.__wirft) throw new Error("netz"); return window.__antwort; } },
        from: () => ({ update: satz => { window.__satz = satz; return { eq: async () => ({ error: null }) }; },
                       insert: satz => { window.__satz = satz; return { select: () => ({ single: async () => ({ data: satz, error: null }) }) }; } }),
        storage: { from: () => ({}) }
      };
    }, BETRIEB);

    const stand = () => s.evaluate(() => ({ aus: document.getElementById("bkLos").disabled,
      grund: document.getElementById("bkHinweis").dataset.stand, text: document.getElementById("bkHinweis").textContent }));
    await s.evaluate(() => { blattOeffnen(gerichte[0]); document.getElementById("fBild").value = ""; bkZeichnen(); });
    let st = await stand();
    pruef(st.aus && st.grund === "leer", "ohne Foto: Knopf aus", JSON.stringify(st.grund));
    await s.evaluate(() => { document.getElementById("fBild").value = "https://fremd.example/bild.jpg"; bkZeichnen(); });
    st = await stand();
    pruef(st.aus && st.grund === "fremd", "fremde Adresse: Knopf aus (die Funktion würde sie ablehnen)");
    await s.evaluate(o => { document.getElementById("fBild").value = o + "handy.jpg"; bkZeichnen(); }, ORDNER);
    st = await stand();
    pruef(!st.aus && st.grund === "bereit", "eigenes Foto, Tarif offen (plan null): Knopf an");
    for (const [plan, an] of [["basic", false], ["assistent", true], ["alessia", true], [null, true]]) {
      await s.evaluate(p => { meineBetriebe[0].plan = p; bkZeichnen(); }, plan);
      st = await stand();
      pruef(st.aus === !an && (an || /Tarif Assistent/.test(st.text)), "Tarif " + plan + ": Knopf " + (an ? "an" : "aus, mit Hinweis"), st.text.slice(0, 50));
    }

    /* Erfolg */
    await s.evaluate((a) => { window.__antwort = { data: { profi: a.PROFI, frei: a.FREI }, error: null }; }, { PROFI, FREI });
    await s.click("#bkLos"); await s.waitForTimeout(250);
    const nach = await s.evaluate(() => ({
      aufruf: window.__aufrufe[window.__aufrufe.length - 1],
      wahl: !document.getElementById("bkWahl").hidden,
      orig: document.getElementById("bkOriginal").getAttribute("src"),
      profi: document.getElementById("bkProfi").getAttribute("src"),
      frei: document.getElementById("bkFrei").getAttribute("src"),
      bild: document.getElementById("fBild").value, bildFrei: document.getElementById("fBildFrei").value }));
    pruef(nach.aufruf && nach.aufruf.name === "gericht-bild" && nach.aufruf.o.body.betrieb_id === BETRIEB &&
          nach.aufruf.o.body.quelle === ORDNER + "handy.jpg", "ruft gericht-bild mit Betrieb und eigenem Foto");
    pruef(nach.wahl && nach.orig === ORDNER + "handy.jpg" && nach.profi === PROFI && nach.frei === FREI,
      "Original · Profi-Foto · Freisteller stehen nebeneinander");
    pruef(nach.bild === ORDNER + "handy.jpg" && nach.bildFrei === "", "vor dem Übernehmen ist NICHTS ersetzt");

    const spalten = await s.evaluate(() => [...document.querySelectorAll("#bkWahl .bk-bild")].map(e => Math.round(e.getBoundingClientRect().width)));
    pruef(spalten.length === 3 && new Set(spalten).size === 1, "drei gleich breite Spalten", spalten.join(" / "));
    const tap = await s.evaluate(() => ["#bkLos", "#bkProfiNehmen", "#bkFreiNehmen", "#bkBehalten"]
      .map(id => Math.round(document.querySelector(id).getBoundingClientRect().height)));
    pruef(tap.every(h => h >= 44), "Tapflächen ≥ 44px", tap.join(", "));

    await s.click("#bkBehalten");
    const beh = await s.evaluate(() => ({ bild: document.getElementById("fBild").value, frei: document.getElementById("fBildFrei").value,
      wahl: document.getElementById("bkWahl").hidden }));
    pruef(beh.bild === ORDNER + "handy.jpg" && beh.frei === "" && beh.wahl, "„Original behalten“ ändert nichts");

    await s.click("#bkLos"); await s.waitForTimeout(250);
    await s.click("#bkProfiNehmen");
    await s.click("#bkFreiNehmen");
    const ueb = await s.evaluate(() => ({ bild: document.getElementById("fBild").value, frei: document.getElementById("fBildFrei").value,
      zeile: !document.getElementById("bkFreiZeile").hidden, schau: document.getElementById("bildSchau").style.backgroundImage }));
    pruef(ueb.bild === PROFI && ueb.schau.includes("1-profi.jpg"), "„Profi-Foto übernehmen“ setzt genau das Foto");
    pruef(ueb.frei === FREI && ueb.zeile, "„Freisteller übernehmen“ setzt genau bild_frei und zeigt ihn an");
    await s.evaluate(async () => { await sichern(false); });
    const satz = await s.evaluate(() => window.__satz);
    pruef(satz && satz.bild === PROFI && satz.bild_frei === FREI, "„Sichern“ schreibt bild und bild_frei", satz && satz.bild_frei);
    /* „Sichern“ schließt das Blatt mit einer Animation — erst abwarten,
       sonst blendet deren Ende das neu geöffnete Blatt wieder aus. */
    await s.waitForTimeout(600);
    await s.evaluate(() => { blattOeffnen(Object.assign({}, gerichte[0], { bild: "", bild_frei: "https://x.example/f.png" })); });
    await s.click("#bkFreiWeg");
    await s.evaluate(async () => { await sichern(false); });
    const satz2 = await s.evaluate(() => window.__satz);
    pruef(satz2 && satz2.bild_frei === null, "Freisteller entfernt → bild_frei wird null");

    /* Teilweise */
    await s.waitForTimeout(600);
    await s.evaluate((a) => { blattOeffnen(gerichte[0]); document.getElementById("fBild").value = a.o + "handy.jpg"; bkZeichnen();
      window.__antwort = { data: { frei: a.FREI, teilweise: true }, error: null }; }, { o: ORDNER, FREI });
    await s.click("#bkLos"); await s.waitForTimeout(250);
    const teil = await s.evaluate(() => ({ profi: document.getElementById("bkProfi").closest(".bk-bild").hidden,
      frei: document.getElementById("bkFrei").closest(".bk-bild").hidden, text: document.getElementById("bildStand").textContent }));
    pruef(teil.profi && !teil.frei && /Nur ein Teil/.test(teil.text), "nur ein Teil zurück: nur das Vorhandene wird angeboten, ehrlich gesagt");

    /* Jeder Fehlergrund als Satz, nie als JSON */
    const saetze = await s.evaluate(() => BK_FEHLER);
    for (const grund of Object.keys(saetze)) {
      await s.evaluate(g => { window.__antwort = { data: { fehler: g }, error: null }; }, grund);
      await s.click("#bkLos"); await s.waitForTimeout(150);
      const t = await s.evaluate(() => document.getElementById("bildStand").textContent);
      pruef(t === saetze[grund] && !/[{}"]/.test(t), "Grund „" + grund + "“ → Klartext", t.slice(0, 44));
    }
    await s.evaluate(() => { window.__antwort = { data: { fehler: "voellig_neu" }, error: null }; });
    await s.click("#bkLos"); await s.waitForTimeout(150);
    pruef(await s.evaluate(() => document.getElementById("bildStand").textContent === BK_FEHLER.anbieter), "unbekannter Grund → der allgemeine Satz, kein Rohtext");
    await s.evaluate(() => { window.__wirft = true; });
    await s.click("#bkLos"); await s.waitForTimeout(150);
    pruef(await s.evaluate(() => document.getElementById("bildStand").textContent === BK_FEHLER.anbieter && !document.getElementById("bkLos").disabled),
      "Netzfehler → Klartext, Knopf wieder frei");
    pruef(!fehler.length, "keine Ausnahme im Board", fehler.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ Hub: Pop-Ansicht ══");
  const zeilen = [
    { id: "z1", karte: "speisekarte", kategorie: "Crêpe", name: "Nutella Crêpe", beschreibung: "Probe", preis: 8.9, verfuegbar: true, bild: PROFI, bild_frei: FREI, kat_sort: 0, reihenfolge: 0 },
    { id: "z2", karte: "speisekarte", kategorie: "Crêpe", name: "Zucker Zimt", beschreibung: "Probe", preis: 5.5, verfuegbar: true, bild: null, bild_frei: FREI, kat_sort: 0, reihenfolge: 1 },
    { id: "z3", karte: "speisekarte", kategorie: "Crêpe", name: "Kaputter Freisteller", beschreibung: "Probe", preis: 6, verfuegbar: true, bild: PROFI, bild_frei: ORDNER + "fehlt.png", kat_sort: 0, reihenfolge: 2 },
    { id: "z4", karte: "speisekarte", kategorie: "Crêpe", name: "Unsicherer Freisteller", beschreibung: "Probe", preis: 6, verfuegbar: true, bild: null, bild_frei: "http://unsicher.example/x.png", kat_sort: 0, reihenfolge: 3 },
    { id: "z5", karte: "speisekarte", kategorie: "Waffel", name: "Nur Foto", beschreibung: "Probe", preis: 4, verfuegbar: true, bild: PROFI, bild_frei: null, kat_sort: 1, reihenfolge: 0 },
  ];
  async function hubAuf(opt = {}) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
    const s = await ctx.newPage(); const fehler = [];
    s.on("pageerror", e => fehler.push(e.message));
    await s.route("**/*", r => {
      const u = r.request().url();
      if (u.startsWith("file://")) return r.continue();
      if (u.includes("fehlt.png")) return r.fulfill({ status: 404, body: "" });
      if (u.endsWith("-frei.png")) return r.fulfill({ status: 200, contentType: "image/png", body: PNG });
      if (u.endsWith("-profi.jpg")) return r.fulfill({ status: 200, contentType: "image/png", body: PNG });
      const m = u.match(/^https:\/\/omoteno\.de\/emoji\/([^?]+)/);
      if (m && fs.existsSync(path.join(EMO, m[1]))) return r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" },
        contentType: m[1].endsWith(".js") ? "application/javascript" : "application/json", body: fs.readFileSync(path.join(EMO, m[1])) });
      if (/\/rest\/v1\/betriebe/.test(u)) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: BETRIEB, bestell_pause: false }]) });
      if (/\/rest\/v1\/gerichte/.test(u)) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(zeilen) });
      return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await s.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
    await s.goto(HUB("chocolamour") + "#/speisekarte");
    await s.waitForTimeout(2500);
    return { ctx, s, fehler };
  }
  {
    const { ctx, s, fehler } = await hubAuf();
    const k = await s.evaluate(() => {
      const zeile = name => [...document.querySelectorAll(".gericht")].find(z => z.textContent.includes(name));
      const info = name => { const z = zeile(name); const g = z && z.querySelector(".gbild");
        const img = g && g.querySelector("img");
        return z ? { da: !!g, schwebt: !!(g && g.classList.contains("schwebt")), src: img ? img.currentSrc.split("/").pop() : "",
          rahmen: g ? getComputedStyle(g).borderRadius + "/" + getComputedStyle(g).overflow + "/" + getComputedStyle(g).backgroundColor : "",
          schatten: img ? getComputedStyle(img).filter : "" } : null; };
      return { bf: findeGericht("Nutella Crêpe").bf, http: findeGericht("Unsicherer Freisteller").bf,
        beides: info("Nutella Crêpe"), nurFrei: info("Zucker Zimt"), kaputt: info("Kaputter Freisteller"),
        http2: info("Unsicherer Freisteller"), foto: info("Nur Foto") };
    });
    pruef(k.bf === FREI, "bild_frei aus der Datenbank kommt als Freisteller an");
    pruef(k.http === undefined && k.http2 && !k.http2.da, "http-Adresse wird verworfen (nur https) — ohne Foto bleibt die Zeile ohne Bild");
    pruef(k.beides.schwebt && k.beides.src === "1-frei.png" && k.beides.rahmen === "0px/visible/rgba(0, 0, 0, 0)" && /drop-shadow/.test(k.beides.schatten),
      "Liste: Freisteller schwebt ohne Rahmen, mit Schatten", JSON.stringify(k.beides));
    pruef(k.nurFrei.schwebt && k.nurFrei.src === "1-frei.png", "Liste: auch ohne Foto schwebt der Freisteller");
    pruef(k.kaputt.da && !k.kaputt.schwebt && k.kaputt.src === "1-profi.jpg", "kaputter Freisteller → das Foto springt ein, gerahmt", JSON.stringify(k.kaputt));
    pruef(k.foto.da && !k.foto.schwebt, "nur Foto: wie bisher gerahmt");

    const d = await s.evaluate(async () => {
      const lies = () => { const w = document.querySelector("#warenkarte .wbild"); const i = w && w.querySelector("img");
        return w ? { schwebt: w.classList.contains("schwebt"), src: i.getAttribute("src").split("/").pop() } : null; };
      detailOeffnen("Nutella Crêpe"); await new Promise(r => setTimeout(r, 300)); const a = lies();
      detailOeffnen("Zucker Zimt"); await new Promise(r => setTimeout(r, 300)); const b = lies();
      return { a, b };
    });
    pruef(d.a && !d.a.schwebt && d.a.src === "1-profi.jpg", "Detailblatt mit Profi-Foto: das Foto groß, gerahmt");
    pruef(d.b && d.b.schwebt && d.b.src === "1-frei.png", "Detailblatt ohne Foto: der Freisteller schwebt");
    await s.keyboard.press("Escape"); await s.waitForTimeout(300);

    await s.evaluate(() => { location.hash = "#/entdecken"; }); await s.waitForTimeout(700);
    await s.evaluate(() => { edLust = ""; edStapel = ["Zucker Zimt", "Nur Foto", "Nutella Crêpe"]; edPos = 0; edNeuZeichnen(); });
    await s.waitForTimeout(600);
    const e = await s.evaluate(() => { const k = document.querySelector('#edStapel .ed-karte[data-tiefe="0"]');
      const p = k.querySelector(".ed-pop"), f = k.querySelector(".ed-bildflaeche"), emo = k.querySelector(".ed-emo");
      return { pop: !!p, mitpop: f.classList.contains("mitpop"), deckend: p ? getComputedStyle(p).opacity : "",
        abzeichen: emo ? getComputedStyle(emo).position : "" }; });
    pruef(e.pop && e.mitpop && e.deckend === "1" && e.abzeichen === "absolute", "Entscheidungshilfe: Freisteller schwebt groß, Emoji wird Abzeichen", JSON.stringify(e));

    const w = await s.evaluate(async () => {
      ehZiehen = () => findeGericht("Zucker Zimt");
      edEntscheiden();
      await new Promise(r => setTimeout(r, 120));
      const waehrend = (() => { const p = document.querySelector(".eh-wahl .ed-pop"); return p ? getComputedStyle(p).opacity : "keins"; })();
      await new Promise(r => setTimeout(r, 1500));
      const p = document.querySelector(".eh-wahl .ed-pop");
      const anim = p ? p.getAnimations().map(a => a.animationName || a.constructor.name) : [];
      return { waehrend, danach: p ? getComputedStyle(p).opacity : "keins", anim };
    });
    pruef(w.waehrend === "0", "beim Mischen ist das Bild verdeckt (es verriete die Wahl)", w.waehrend);
    pruef(w.danach === "1", "nach dem Aufdecken steht der Freisteller da", w.danach);
    const flug = s.waitForSelector(".korbflug.kf-frei", { timeout: 1500 }).then(() => true).catch(() => false);
    await s.evaluate(() => document.querySelector("[data-eh-nehm]").click());
    pruef(await flug, "„Nehm ich!“: der Freisteller fliegt rahmenlos in den Korb");
    const ueber = await s.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(ueber <= 1, "kein seitliches Schieben", ueber + "px");
    pruef(!fehler.length, "keine Ausnahme im Hub", fehler.join(" | ") || "still");
    await ctx.close();
  }
  {
    /* Das Herausspringen: nur mit Bewegung, und nur einmal beim Aufdecken */
    for (const ruhig of [false, true]) {
      const { ctx, s } = await hubAuf({ ruhig });
      await s.evaluate(() => { location.hash = "#/entdecken"; }); await s.waitForTimeout(700);
      const r = await s.evaluate(async () => {
        ehZiehen = () => findeGericht("Zucker Zimt");
        edEntscheiden();
        const t0 = performance.now(); let gesehen = false, sichtbar = "";
        while (performance.now() - t0 < 2200) {
          const p = document.querySelector(".eh-wahl .ed-bildflaeche.mitpop .ed-pop");
          if (p && p.getAnimations().some(a => a.animationName === "ehPopRein")) gesehen = true;
          if (p) sichtbar = getComputedStyle(p).opacity;
          await new Promise(res => requestAnimationFrame(res));
        }
        return { gesehen, sichtbar };
      });
      pruef(ruhig ? (!r.gesehen && r.sichtbar === "1") : r.gesehen,
        (ruhig ? "Bewegung reduzieren: kein Herausspringen, Bild steht" : "Aufdecken: der Freisteller springt heraus (ehPopRein)"), JSON.stringify(r));
      await ctx.close();
    }
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
