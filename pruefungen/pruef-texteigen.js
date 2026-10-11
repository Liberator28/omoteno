/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Jeder Text und seine Schrift (hub_texte.eigen, 11.10.)
   (braucht dist/)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-texteigen.js

   „Man soll jeden Text, der auf den Seiten begegnet, ganz einfach und
   übersichtlich ändern können, sowohl den Text als auch die Schrift
   von einzelnen Texten.“

   1 · Hub mit gestellter Zeile (alle Häuser außer dem Vorführhaus, das
       die Datenbank nie fragt):
       - Deutsch zeigt den eigenen Text; Englisch die eigene Übersetzung;
         Türkisch ohne eigene Übersetzung das Wörterbuch (Reihenfolge
         eigen[sp] → Wörterbuch → eigen.de);
       - Schrift nur am gemeinten Element (computed style), der Nachbar
         bleibt; nach einem Neuzeichnen (Sprache, Seite) wieder da;
       - <img onerror> im Text bleibt Text; ein Anführungszeichen öffnet
         kein Attribut (Suchfeld der Speisekarte, placeholder);
       - unbekannter Schlüssel, fremde Schrift werden verworfen;
       - zweiter Besuch ohne Netz: eigener Text ab dem ersten Bild.
   2 · Board (gestelltes db, echte Hub-Datei in der Vorschau):
       - Zweite Quelle: jeder Eintrag der Liste ist ein Schlüssel des
         Wörterbuchs im Hub (aus der Datei gelesen);
       - „Text in der Vorschau antippen“ + echter Mausklick im Rahmen
         öffnet GENAU diesen Text;
       - Tippen zeigt den neuen Wortlaut im Rahmen, Schrift färbt ihn;
       - Übernehmen ruft den Übersetzer in Paketen ≤ 25 (30 Texte → 2
         Aufrufe), speichert de + elf Sprachen + Schrift, lässt claim
         und WLAN stehen; Kontingent erschöpft → gespeichert auf
         Deutsch, Satz sagt es; erneutes Öffnen zeigt den Stand.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const DIST = process.env.DIST || path.join(OBEN, "dist");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const BASIS = "https://omoteno.test/h/";
const VORLAGE = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");
const TEXTE_SCHLUESSEL = new Set([...VORLAGE.matchAll(/^"((?:[^"\\]|\\.)*)":\{en:/gm)].map(m => JSON.parse('"' + m[1] + '"')));
const VORFUEHRHAUS = h => { try{ return !!JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", h + ".json"), "utf8")).demo; }catch(e){ return false; } };
const HAEUSER = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html")) && !VORFUEHRHAUS(d));

let n = 0, f = 0;
function pruef(b, t, d){
  n++; if(!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

async function hub(br, haus, texte, opt){
  opt = opt || {};
  const ctx = opt.ctx || await br.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(opt.offline) return r.abort();
    if(/\/rest\/v1\/betriebe\?/.test(u)) return r.fulfill({ status:200, contentType:"application/json",
      body:JSON.stringify([{ id:"b1", bestell_pause:false, hub_texte:texte, hub_stil:{} }]) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await p.goto("file://" + path.join(DIST, haus, "index.html") + (opt.hash || "#/kontakt"));
  await p.waitForTimeout(1300);
  return { ctx, p, fehler };
}
const lesen = p => p.evaluate(() => {
  const h2 = document.querySelector("#inhalt .seite h2"), h3 = document.querySelector("#inhalt .seite .block h3");
  return { h2: h2 && h2.textContent, h3: h3 && h3.textContent,
    h2Schrift: h2 && getComputedStyle(h2).fontFamily, h3Schrift: h3 && getComputedStyle(h3).fontFamily,
    markiert: h2 && h2.hasAttribute("data-eigen-schrift"), x: window.__x === 1 };
});

(async () => {
  const br = await chromium.launch();
  pruef(TEXTE_SCHLUESSEL.size > 500 && TEXTE_SCHLUESSEL.has("Öffnungszeiten & Weg"), "Wörterbuch aus der Datei gelesen", TEXTE_SCHLUESSEL.size + " Schlüssel");

  console.log("\n══ 1 · Hub: eigener Text, Sprache, Schrift ══");
  const EIGEN = { eigen:{
    "Öffnungszeiten & Weg": { de:"So finden Sie uns", en:"How to find us", schrift:"pacifico" },
    "Gibt es nicht im Wörterbuch": { de:"darf nie erscheinen" },
    "WANN WIR DA SIND": { de:"UNSERE ZEITEN", schrift:"https://boese.example/x.woff2" } }, claim:"Hallo" };
  for(const haus of HAEUSER){
    let h = await hub(br, haus, EIGEN);
    let m = await lesen(h.p);
    pruef(m.h2 === "So finden Sie uns", haus + ": Deutsch zeigt den eigenen Text", m.h2);
    pruef(/omo-pacifico/.test(m.h2Schrift || "") && m.markiert, haus + ": eigene Schrift an genau diesem Text", m.h2Schrift);
    pruef(m.h3 === "UNSERE ZEITEN" && !/omo-|boese/.test(m.h3Schrift || ""), haus + ": fremde Schrift verworfen, Text trotzdem", m.h3 + " / " + m.h3Schrift);
    const unbekannt = await h.p.evaluate(() => document.body.textContent.includes("darf nie erscheinen") || !!TEXTE_EIGEN["Gibt es nicht im Wörterbuch"]);
    pruef(!unbekannt, haus + ": Schlüssel außerhalb des Wörterbuchs verworfen");
    await h.p.evaluate(() => { spracheSetzen("en"); zeichne(); }); await h.p.waitForTimeout(400);
    m = await lesen(h.p);
    pruef(m.h2 === "How to find us" && /omo-pacifico/.test(m.h2Schrift || ""), haus + ": Englisch aus der eigenen Übersetzung, Schrift bleibt nach dem Neuzeichnen", m.h2);
    await h.p.evaluate(() => { spracheSetzen("tr"); zeichne(); }); await h.p.waitForTimeout(300);
    m = await lesen(h.p);
    const tr = (VORLAGE.match(/^"Öffnungszeiten & Weg":\{[^\n]*?tr:"([^"]+)"/m) || [])[1];
    pruef(m.h2 === tr, haus + ": ohne eigene Übersetzung das Wörterbuch (Türkisch)", m.h2);
    await h.p.evaluate(() => { spracheSetzen("de"); location.hash = "#/"; }); await h.p.waitForTimeout(300);
    await h.p.evaluate(() => { location.hash = "#/kontakt"; }); await h.p.waitForTimeout(400);
    m = await lesen(h.p);
    pruef(/omo-pacifico/.test(m.h2Schrift || ""), haus + ": nach Seitenwechsel wieder in der eigenen Schrift");
    pruef(!h.fehler.length, haus + ": keine Seitenfehler", h.fehler.join(" | ") || "–");
    await h.ctx.close();
  }

  console.log("\n══ 1b · Entschärft ══");
  {
    const h = await hub(br, HAEUSER[0], { eigen:{
      "Öffnungszeiten & Weg": { de:'Weg<img src=x onerror="window.__x=1">' },
      "Suchen …": { de:'Suche" onfocus="window.__y=1" autofocus="' } } }, { hash:"#/kontakt" });
    const a = await lesen(h.p);
    const img = await h.p.evaluate(() => document.querySelectorAll("#inhalt h2 img").length);
    pruef(img === 0 && !a.x && /Weg/.test(a.h2), "<img onerror> im eigenen Text bleibt Text", a.h2);
    await h.p.evaluate(() => { location.hash = "#/speisekarte"; }); await h.p.waitForTimeout(600);
    const s = await h.p.evaluate(() => { const i = [...document.querySelectorAll("#inhalt input")].find(x => /Suche/.test(x.placeholder || ""));
      return i ? { ph:i.placeholder, onfocus:i.hasAttribute("onfocus"), y:window.__y === 1 } : null; });
    pruef(s && !s.onfocus && !s.y, "ein Anführungszeichen öffnet kein Attribut (Suchfeld)", JSON.stringify(s));
    await h.ctx.close();
  }

  console.log("\n══ 1c · Zweiter Besuch ohne Netz ══");
  {
    const ctx = await br.newContext({ viewport:{ width:390, height:844 } });
    const eins = await hub(br, HAEUSER[0], EIGEN, { ctx });
    await eins.p.close();
    const zwei = await hub(br, HAEUSER[0], null, { ctx, offline:true });
    const m = await lesen(zwei.p);
    pruef(m.h2 === "So finden Sie uns", "ohne Netz steht der gemerkte eigene Text", m.h2);
    await ctx.close();
  }

  console.log("\n══ 2 · Board: Texte & Schrift ══");
  {
    const ctx = await br.newContext({ viewport:{ width:390, height:900 } });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.addInitScript(b => { window.HUB_VORSCHAU_BASIS = b;
      Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; }, BASIS);
    await p.route("**/*", r => {
      const u = r.request().url();
      if(u.startsWith("file://")) return r.continue();
      if(u === BASIS + "blend/") return r.fulfill({ status:200, contentType:"text/html; charset=utf-8",
        headers:{ "Access-Control-Allow-Origin":"*" }, body:fs.readFileSync(path.join(DIST, "blend", "index.html"), "utf8") });
      return r.fulfill({ status:200, contentType:"application/json", headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" });
    });
    await p.goto("file://" + ADMIN);
    await p.waitForTimeout(600);
    const BB = { id:"11111111-2222-3333-4444-555555555555", slug:"blend", name:"Blend", rolle:"inhaber", bestell_pause:false,
      hub_texte:{ claim:"Hallo", wlan_netz:"Gaeste" }, hub_stil:{}, markenblatt:null };
    await p.evaluate(bb => {
      window.__schreib = []; window.__ueb = []; window.__uebModus = "gut";
      function antwort(z){
        if(z.op !== "select"){ window.__schreib.push({ tab:z.tab, op:z.op, daten:JSON.parse(JSON.stringify(z.daten || null)) }); return { data:null, error:null }; }
        if(z.tab === "betrieb_mitglieder") return { data:[{ rolle:bb.rolle, betriebe:Object.assign({}, bb) }], error:null };
        return { data: z.einzeln ? null : [], error:null };
      }
      function kette(tab){
        const z = { tab, op:"select", daten:null, einzeln:false };
        const p = new Proxy(function(){}, { get(_, k){
          if(k === "then") return res => res(antwort(z));
          return (...a) => { if(["update","insert","upsert","delete"].includes(k)){ z.op = k; z.daten = a[0]; }
            if(k === "maybeSingle" || k === "single") z.einzeln = true; return p; }; }, apply(){ return p; } });
        return p;
      }
      const SP = ["en","tr","ru","fr","es","it","pl","ar","uk","nl","ro"];
      db = { from:kette, rpc:() => kette("rpc"), channel:() => kette("kanal"), removeChannel:async () => {},
        storage:{ from:() => kette("speicher") },
        functions:{ invoke: async (name, o) => {
          const texte = (o && o.body && o.body.texte) || [];
          window.__ueb.push({ name, n: texte.length });
          if(window.__uebModus === "kontingent") return { data:{ fehler:"kontingent", uebersetzt:{} }, error:null };
          const u = {}; texte.forEach(t => { u[t] = Object.fromEntries(SP.map(s => [s, s.toUpperCase() + ":" + t])); });
          return { data:{ uebersetzt:u }, error:null }; } },
        auth:{ getSession:async () => ({ data:{ session:null } }),
               getUser:async () => ({ data:{ user:{ id:"u1", email:"probe@example.org" } } }),
               onAuthStateChange:() => ({ data:{ subscription:{ unsubscribe(){} } } }) } };
      demo = false;
    }, BB);
    await p.evaluate(async id => { document.getElementById("tor").hidden = true;
      try{ localStorage.setItem(merkSchluessel(), id); }catch(e){}
      await betriebWaehlen(); }, BB.id);
    await p.waitForTimeout(300);
    await p.evaluate(() => { const s = document.getElementById("scharf"); if(s) s.hidden = true; tafelZeigen("startseite"); });
    let bereit = false;
    for(let i = 0; i < 60 && !bereit; i++){ await p.waitForTimeout(200);
      bereit = await p.evaluate(() => TX_LISTE.length > 20); }
    const liste = await p.evaluate(() => TX_LISTE.map(x => x.k));
    pruef(bereit, "Voraussetzung: die Vorschau lädt und liefert die Liste", liste.length + " Texte");
    const fremd = liste.filter(k => !TEXTE_SCHLUESSEL.has(k));
    pruef(!fremd.length, "jeder Eintrag ist ein Schlüssel des Wörterbuchs im Hub (zweite Quelle)", fremd.slice(0, 3).join(" | ") || "alle");
    const seiten = await p.evaluate(() => [...new Set(TX_LISTE.map(x => x.sz))]);
    pruef(seiten.includes("start") && seiten.includes("speisekarte") && seiten.includes("haus"), "Texte aus mehreren Seiten, nach Seite gruppiert", seiten.join(","));

    /* Echter Klick im Rahmen */
    await p.click("#txTippen"); await p.waitForTimeout(300);
    const ziel = await p.evaluate(() => {
      const h = hvAlle().gestalten, w = h.frame.contentWindow, d = w.document;
      const fr = h.frame.getBoundingClientRect(), sc = fr.width / w.innerWidth;
      const TEXTE = new w.Function("return TEXTE")();
      const fenster = h.frame.parentElement.getBoundingClientRect();
      const kand = [...d.querySelectorAll("#inhalt *")].filter(el => el.children.length === 0 && el.textContent.trim() &&
        TEXTE[el.textContent.trim()] && el.getBoundingClientRect().height > 8);
      for(const el of kand){
        const r = el.getBoundingClientRect();
        const x = fr.left + (r.left + r.width / 2) * sc, y = fr.top + (r.top + r.height / 2) * sc;
        if(y > fenster.top + 4 && y < fenster.bottom - 4 && x > fenster.left && x < fenster.right) return { k: el.textContent.trim(), x, y };
      }
      return null;
    });
    pruef(!!ziel, "Voraussetzung: ein Wörterbuchtext ist im Rahmen sichtbar", ziel && ziel.k);
    if(ziel){
      await p.mouse.click(ziel.x, ziel.y); await p.waitForTimeout(500);
      const offen = await p.evaluate(() => ({ k: TX_OFFEN, ed: !!document.querySelector("[data-tx-ed] [data-tx-text]") }));
      pruef(offen.k === ziel.k && offen.ed, "echter Tipp im Rahmen öffnet genau diesen Text", offen.k);
      await p.fill("[data-tx-ed] [data-tx-text]", "Probe Wortlaut"); await p.waitForTimeout(600);
      await p.selectOption("[data-tx-ed] [data-tx-schrift]", "pacifico"); await p.waitForTimeout(700);
      const imRahmen = await p.evaluate(() => { const d = hvAlle().gestalten.frame.contentWindow.document;
        const el = [...d.querySelectorAll("#inhalt *")].find(x => x.children.length === 0 && x.textContent.trim() === "Probe Wortlaut");
        return el ? { schrift: getComputedStyle(el).fontFamily } : null; });
      pruef(imRahmen && /omo-pacifico/.test(imRahmen.schrift), "Vorschau zeigt neuen Wortlaut in der gewählten Schrift", JSON.stringify(imRahmen));
    }
    await p.click("#txTippen");

    /* 30 Texte → zwei Übersetzer-Aufrufe */
    /* Den eben getippten Text NICHT mit überschreiben — sonst prüft die
       Probe unten ihre eigene Überschreibung (§8.1g). */
    await p.evaluate(z => { TX_LISTE.filter(x => x.k !== z).slice(0, 30).forEach((x, i) => { TX[x.k] = { de:"Neu " + i }; TX_NEU.add(x.k); }); txGeruehrt = true; txZeichnen(); }, ziel && ziel.k);
    await p.click("#txSichern"); await p.waitForTimeout(800);
    const ueb = await p.evaluate(() => window.__ueb);
    const zahl = ueb.filter(u => u.name === "uebersetzen").map(u => u.n);
    pruef(zahl.length >= 2 && zahl.every(x => x <= 25) && zahl.reduce((a, b) => a + b, 0) >= 30, "Übersetzer in Paketen ≤ 25", zahl.join("+"));
    const w = await p.evaluate(() => window.__schreib.filter(x => x.tab === "betriebe" && x.daten && x.daten.hub_texte).pop());
    const ht = w && w.daten.hub_texte;
    const einer = ht && ht.eigen && Object.values(ht.eigen).find(e => e.de === "Neu 3");
    pruef(ht && ht.claim === "Hallo" && ht.wlan_netz === "Gaeste", "claim und WLAN bleiben stehen");
    pruef(einer && einer.en === "EN:Neu 3" && einer.ar === "AR:Neu 3" && Object.keys(einer).length >= 12, "gespeichert: Deutsch + elf Sprachen", einer && Object.keys(einer).join(","));
    const mitSchrift = ht && ziel && ht.eigen[ziel.k];
    pruef(!ziel || (mitSchrift && mitSchrift.schrift === "pacifico" && mitSchrift.de === "Probe Wortlaut"), "Schrift und Wortlaut des getippten Textes gespeichert", JSON.stringify(mitSchrift || {}).slice(0, 80));
    pruef(/übersetzt/.test(await p.evaluate(() => document.getElementById("txStand").textContent)), "Satz nennt die Übersetzung");

    /* Kontingent erschöpft */
    await p.evaluate(() => { window.__uebModus = "kontingent"; const k = TX_LISTE[45].k; TX[k] = { de:"Ohne Übersetzung" }; TX_NEU.add(k); txGeruehrt = true; txZeichnen(); });
    await p.click("#txSichern"); await p.waitForTimeout(600);
    const k2 = await p.evaluate(() => ({ satz: document.getElementById("txStand").textContent,
      w: window.__schreib.filter(x => x.tab === "betriebe" && x.daten && x.daten.hub_texte).pop() }));
    const e2 = Object.values(k2.w.daten.hub_texte.eigen).find(e => e.de === "Ohne Übersetzung");
    pruef(e2 && !e2.en && /Nicht übersetzt/.test(k2.satz), "Kontingent leer: auf Deutsch gespeichert, Satz sagt es", k2.satz.slice(0, 90));

    /* „Ihre Worte“ übernehmen darf die eigenen Texte nicht löschen —
       hubTexteSichern baute hub_texte früher frisch aus den Feldern. */
    const vorWorte = await p.evaluate(() => window.__schreib.length);
    await p.evaluate(() => { document.getElementById("hubClaim").value = "Neuer Slogan"; hubTexteSichern(); });
    await p.waitForTimeout(600);
    const w3 = await p.evaluate(n => window.__schreib.slice(n).filter(x => x.tab === "betriebe" && x.daten && x.daten.hub_texte).pop(), vorWorte);
    pruef(!!w3, "Voraussetzung: „Ihre Worte“ hat geschrieben", w3 ? "ja" : "nichts");
    const e3 = w3 && w3.daten.hub_texte.eigen;
    pruef(w3 && w3.daten.hub_texte.claim === "Neuer Slogan" && e3 && Object.values(e3).some(e => e.de === "Neu 3"),
      "„Ihre Worte“ übernehmen lässt die eigenen Texte stehen", e3 ? Object.keys(e3).length + " eigene" : "eigen fehlt");

    /* Neu öffnen: Stand aus HUBTEXTE */
    await p.evaluate(() => { tafelZeigen("einstellungen"); tafelZeigen("startseite"); });
    await p.waitForTimeout(400);
    const neu = await p.evaluate(() => ({ n: Object.keys(TX).length, markiert: document.querySelectorAll("#txListe .txneu").length }));
    pruef(neu.n >= 31 && neu.markiert >= 1, "nach erneutem Öffnen steht der gespeicherte Stand", JSON.stringify(neu));
    pruef(!fehler.length, "Board: keine Seitenfehler", fehler.join(" | ") || "–");
    await ctx.close();
  }

  await br.close();
  console.log("\n" + (f ? f + " von " + n + " FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden"));
  process.exit(f ? 1 : 0);
})();
