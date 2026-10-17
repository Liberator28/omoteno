/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Stile der Speisekarte (Liste, Bühne, Raster, Flink) + Filter

     NODE_PATH=$(npm root -g) node pruefungen/pruef-kartenstil.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   > Anlass (17.10.). Wunsch mit Fotos (Sushi-App, MenuVA, FeastRocket):
   > „Die Gerichte sind im Vordergrund … Ideen von den drei Stilen …
   > man soll wechseln können.“ Den Stil wählt der Betrieb im Board
   > (hub_stil.karte).

   ZWEITE QUELLEN:
     · Zahl der Gerichte: der Stil „liste“ desselben Hauses (der war vor
       dem Umbau die einzige Darstellung) — jeder Stil zeigt genau so
       viele.
     · „liste“ bytegleich: gerichtHTML aus dem Stand VOR dem Umbau
       (git show STAND:vorlagen/hub.vorlage.html) läuft im selben Hub
       gegen dieselben Gerichte (§8.1a: wo der alte Stand richtig war,
       kommt er unverändert heraus).

   1 · Jedes Haus × jeder Stil × 390 hell/dunkel, 360 ganz weiß,
       430 ganz schwarz, 1280: alle Gerichte da, kein Überlauf, jede
       Schrift der Karte ≥ 4,5:1 auf ihrer GEMISCHTEN Fläche.
   2 · Jeder Stil, je Haus: „+“ legt genau dieses Gericht in die Auswahl,
       ein Tipp öffnet das Detailblatt DIESES Gerichts, die Kategorie-
       Leiste folgt dem Rollen, Tapflächen der neuen Knöpfe ≥ 44 px.
   3 · Filter: Vegan zeigt nur Veganes, „ohne …“ nur Gerichte mit
       Angaben und ohne dieses Allergen, Zurücksetzen alles.
   4 · Feste Liste: Unbekanntes und Anführungszeichen → „liste“; der
       Live-Weg (betriebe.hub_stil.karte) zeichnet um.
   5 · Board: Auswahl über den echten Tipp färbt die Vorschau, erst
       „Übernehmen“ schreibt, zusammengeführt (Nachbarn bleiben), nach
       dem Neuöffnen der gespeicherte Stand (§8.1m).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const OBEN = path.join(__dirname, "..");
const DIST = path.join(OBEN, "dist");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const BASIS = "https://omoteno.test/h/";
const STAND = "41fb6c6";   /* letzter Stand vor den Stilen (E5-C) */
const HAEUSER = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html")));
const STILE = ["liste", "buehne", "raster", "flink"];

let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

async function hub(browser, haus, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport:{ width:opt.breite || 390, height:844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
  await p.clock.setFixedTime(new Date("2026-10-10T14:00:00"));
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(opt.stil !== undefined && /\/rest\/v1\/betriebe\?/.test(u)) return r.fulfill({ status:200, contentType:"application/json",
      body:JSON.stringify([{ id:"b1", bestell_pause:false, hub_texte:{}, hub_stil:{ emoji:true, karte:opt.stil } }]) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await p.goto("file://" + path.join(DIST, haus, "index.html") + "#/speisekarte");
  await p.waitForTimeout(1100);
  return { ctx, p, fehler };
}
const stilSetzen = (p, stil, licht) => p.evaluate(([s, l]) => {
  HUBSTIL = Object.assign({}, HUBSTIL, { karte:s });
  if(l) lichtSetzen(l);
  location.hash = "#/speisekarte"; zeichne(); scrollTo(0, 0);
}, [stil, licht]);

/* Schrift gegen ihre wirklich gemalte Fläche: Hintergründe vom Wurzel-
   element abwärts übereinandergelegt (Glas, color-mix, Alpha). */
const LESBAR = () => {
  const farbe = s => {
    if(!s) return null;
    let m = s.match(/^rgba?\(([^)]+)\)/);
    if(m){ const v = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; }
    m = s.match(/^color\(srgb\s+([^)]+)\)/);
    if(m){ const [a, b] = m[1].split("/"); const v = a.trim().split(/\s+/).map(Number);
      return [v[0] * 255, v[1] * 255, v[2] * 255, b ? Number(b) : 1]; }
    return null;
  };
  const grund = el => {
    const kette = []; for(let e = el; e; e = e.parentElement) kette.unshift(e);
    let c = [255, 255, 255];
    for(const x of kette){ const b = farbe(getComputedStyle(x).backgroundColor);
      if(b && b[3] > 0) c = [0, 1, 2].map(i => b[i] * b[3] + c[i] * (1 - b[3])); }
    return c;
  };
  const L = c => { const k = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * k[0] + .7152 * k[1] + .0722 * k[2]; };
  const kontrast = el => {
    const g = grund(el), s = farbe(getComputedStyle(el).color);
    const t = [0, 1, 2].map(i => s[i] * s[3] + g[i] * (1 - s[3]));
    const a = L(t), b = L(g); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  };
  const sel = ["#inhalt .gericht .n", "#inhalt .gericht .b", "#inhalt .gericht .p", "#inhalt .gericht .tag", "#inhalt .gruppe",
               "#inhalt .chip", "#inhalt .ks-gruss", "#inhalt .ks-titel", "#inhalt .ks-tname", "#inhalt .ks-tpreis .p", "#inhalt .sf-chip"];
  const schlecht = [];
  let gezaehlt = 0;
  sel.forEach(s => [...document.querySelectorAll(s)].slice(0, 10).forEach(el => {
    const r = el.getBoundingClientRect();
    if(!r.width || !r.height || getComputedStyle(el).visibility === "hidden") return;
    gezaehlt++;
    const k = kontrast(el);
    if(k < 4.5) schlecht.push(s.replace("#inhalt ", "") + " „" + el.textContent.trim().slice(0, 18) + "“ " + k.toFixed(2));
  }));
  return { gezaehlt, schlecht };
};

(async () => {
  if(!HAEUSER.length){ console.error("Kein erzeugter Hub. Erst: node erzeuger/erzeuge-hub.js --alle"); process.exit(1); }
  let alt = null;
  try{
    const quelle = execSync("git show " + STAND + ":vorlagen/hub.vorlage.html", { cwd:OBEN, maxBuffer:64 * 1024 * 1024 }).toString();
    const a = quelle.indexOf("function gerichtHTML(g){");
    alt = quelle.slice(a, quelle.indexOf("\n}\n", a) + 2).replace("function gerichtHTML(g){", "function gerichtHTMLalt(g){");
  }catch(e){}
  pruef(!!alt && /gmitbild/.test(alt), "zweite Quelle: gerichtHTML aus dem Stand " + STAND + " gelesen", alt ? alt.length + " Zeichen" : "fehlt");
  const browser = await chromium.launch();

  console.log("══ 1 · Jedes Haus × jeder Stil: vollständig, kein Überlauf, lesbar ══");
  const LICHT = [[390, "hell"], [390, "dunkel"], [360, "weiss"], [430, "schwarz"], [1280, "hell"]];
  for(const haus of HAEUSER){
    for(const [breite, licht] of LICHT){
      const { ctx, p, fehler } = await hub(browser, haus, { breite });
      let soll = null;
      for(const stil of STILE){
        await stilSetzen(p, stil, licht);
        await p.waitForTimeout(stil === "liste" ? 1300 : 350);
        const m = await p.evaluate(LESBAR);
        const z = await p.evaluate(() => ({ n: document.querySelectorAll("#inhalt .gericht").length,
          stil: document.body.dataset.kartenstil, ueber: document.documentElement.scrollWidth - innerWidth }));
        if(stil === "liste") soll = z.n;
        pruef(z.stil === stil && z.n === soll && z.n > 0 && z.ueber <= 0 && m.gezaehlt > 10 && !m.schlecht.length,
          haus + " · " + stil + " · " + breite + " px " + licht + ": " + z.n + " Gerichte, kein Überlauf, Schrift ≥ 4,5:1",
          m.schlecht.length ? m.schlecht.slice(0, 4).join(" | ") : JSON.stringify(Object.assign(z, { gemessen:m.gezaehlt })));
      }
      if(fehler.length) pruef(false, haus + " " + licht + ": keine Seitenfehler", fehler.join(" | "));
      await ctx.close();
    }
  }

  console.log("══ 2 · Bedienen in jedem Stil ══");
  for(const haus of HAEUSER){
    const { ctx, p, fehler } = await hub(browser, haus);
    if(alt){
      const gleich = await p.evaluate(code => {
        (0, eval)(code);
        HUBSTIL = Object.assign({}, HUBSTIL, { karte:"liste" });
        const namen = [...new Set([...document.querySelectorAll("#inhalt .ginfo[data-detail]")].map(b => decodeURIComponent(b.dataset.detail)))];
        let anders = 0, n = 0;
        namen.forEach(nm => { const g = findeGericht(nm); if(!g) return; n++;
          if(gerichtHTMLalt(g) !== gerichtHTML(g, "Probe", "speisekarte")) anders++; });
        return { n, anders };
      }, alt);
      pruef(gleich.n > 5 && gleich.anders === 0, haus + ": „liste“ bytegleich zum Stand vorher", JSON.stringify(gleich));
    }
    for(const stil of STILE){
      await stilSetzen(p, stil, "hell");
      await p.waitForTimeout(400);
      /* „+“ legt genau dieses Gericht hinein */
      const plus = await p.evaluate(() => { merk = {}; const b = [...document.querySelectorAll("#inhalt .gericht .gplus[data-merk]")][1];
        b.scrollIntoView({ block:"center" }); return decodeURIComponent(b.dataset.merk); });
      await p.waitForTimeout(150);
      await p.click('#inhalt .gericht .gplus[data-merk="' + encodeURIComponent(plus) + '"]');
      await p.waitForTimeout(300);
      const imKorb = await p.evaluate(() => Object.keys(merk));
      pruef(imKorb.length === 1 && imKorb[0] === plus, haus + " · " + stil + ": „+“ legt genau „" + plus + "“ in die Auswahl", imKorb.join(","));
      /* Tipp aufs Gericht öffnet DIESES Gericht */
      const name = await p.evaluate(() => { const b = [...document.querySelectorAll("#inhalt .gericht .ginfo")][3];
        b.scrollIntoView({ block:"center" }); return decodeURIComponent(b.dataset.detail); });
      await p.waitForTimeout(150);
      await p.click('#inhalt .gericht .ginfo[data-detail="' + encodeURIComponent(name) + '"]');
      await p.waitForTimeout(500);
      const blatt = await p.evaluate(() => { const w = document.getElementById("warenkarte");
        return { offen: !!w && w.getBoundingClientRect().height > 100 && !w.hidden, titel: (document.getElementById("wname") || {}).textContent || "" }; });
      pruef(blatt.offen && blatt.titel.indexOf(await p.evaluate(nm => t(nm), name)) === 0, haus + " · " + stil + ": Tipp öffnet das Blatt von „" + name + "“", JSON.stringify(blatt));
      await p.evaluate(() => { if(typeof detailSchliessen === "function") detailSchliessen(); });
      await p.waitForTimeout(400);
      /* Mitlaufen: von Hand zur dritten Gruppe gerollt */
      /* Die dritte Gruppe, sonst die zweite — eine kurze Karte (Nordstern:
         8 Gerichte) lässt die dritte gar nicht bis unter die Leiste rollen. */
      const gr = await p.evaluate(() => {
        const l = document.querySelector("#inhalt .chips");
        const ziel = g => scrollY + g.nextElementSibling.getBoundingClientRect().top - g.offsetHeight - l.offsetHeight + 4;
        const max = document.documentElement.scrollHeight - innerHeight;
        const g = [...document.querySelectorAll("#inhalt .gruppe[data-gruppe]")].slice(1, 3).filter(x => ziel(x) <= max).pop();
        if(!g) return null;
        scrollTo(0, ziel(g));
        return g.dataset.gruppe; });
      await p.waitForTimeout(500);
      if(gr){
        const an = await p.evaluate(() => { const c = document.querySelector("#inhalt .chips .chip.an"); return c ? c.dataset.g : null; });
        pruef(an === gr, haus + " · " + stil + ": die Leiste folgt dem Rollen bis „" + gr + "“", an);
      }
      /* Neue Knöpfe ≥ 44 px */
      const tap = await p.evaluate(() => { const k = [...document.querySelectorAll("#inhalt .sf-knopf, #inhalt .ks-tipp")];
        return k.map(e => { const r = e.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }); });
      pruef(tap.length && tap.every(x => x >= 44), haus + " · " + stil + ": Filterknopf und Bahnkarten ≥ 44 px", tap.join(","));
    }
    if(fehler.length) pruef(false, haus + ": keine Seitenfehler", fehler.join(" | "));
    await ctx.close();
  }

  console.log("══ 3 · Filter ══");
  for(const haus of HAEUSER){
    const { ctx, p } = await hub(browser, haus);
    await stilSetzen(p, "buehne", "hell");
    await p.waitForTimeout(300);
    const vorher = await p.evaluate(() => document.querySelectorAll("#inhalt .gericht").length);
    await p.click("#inhalt .sf-knopf");
    await p.waitForTimeout(200);
    const offen = await p.evaluate(() => !document.getElementById("sfFeld").hidden && document.querySelector("#inhalt .sf-knopf").getAttribute("aria-expanded"));
    pruef(offen === "true", haus + ": der Filterknopf öffnet das Feld (aria-expanded)");
    await p.click('#inhalt [data-sf="vegan"]');
    await p.waitForTimeout(300);
    const vegan = await p.evaluate(() => { const namen = [...document.querySelectorAll("#inhalt .gericht .ginfo")].map(b => decodeURIComponent(b.dataset.detail));
      return { n: namen.length, nicht: namen.filter(nm => !findeGericht(nm).vegan), leer: !!document.querySelector("#inhalt .leer .sf-weg"),
               zahl: (document.querySelector("#inhalt .sf-zahl") || {}).textContent }; });
    pruef(vegan.nicht.length === 0 && (vegan.n > 0 || vegan.leer) && vegan.zahl === "1", haus + ": Vegan zeigt nur Veganes (" + vegan.n + "), Zahl am Knopf", JSON.stringify(vegan));
    await p.click("#inhalt [data-sf-weg]");
    await p.waitForTimeout(300);
    const zurueck = await p.evaluate(() => document.querySelectorAll("#inhalt .gericht").length);
    pruef(zurueck === vorher, haus + ": Zurücksetzen zeigt wieder alle", zurueck + " / " + vorher);
    const ohneK = await p.evaluate(() => { const b = document.querySelector('#inhalt [data-sf-ohne]'); return b ? b.dataset.sfOhne : null; });
    if(ohneK){
      await p.click('#inhalt [data-sf-ohne="' + ohneK + '"]');
      await p.waitForTimeout(300);
      const ohne = await p.evaluate(k => { const namen = [...document.querySelectorAll("#inhalt .gericht .ginfo")].map(b => decodeURIComponent(b.dataset.detail));
        return { n: namen.length, falsch: namen.filter(nm => { const i = INHALTSSTOFFE[nm]; return !i || !Array.isArray(i.a) || i.a.indexOf(k) >= 0; }) }; }, ohneK);
      pruef(ohne.falsch.length === 0 && ohne.n < vorher, haus + ": „ohne " + ohneK + "“ — nur Gerichte mit Angaben und ohne " + ohneK + " (" + ohne.n + ")", JSON.stringify(ohne.falsch.slice(0, 3)));
      await p.click("#inhalt [data-sf-weg]");
    }else pruef(true, haus + ": keine Allergen-Angaben in dieser Karte — kein „ohne …“-Knopf");
    await ctx.close();
  }

  console.log("══ 4 · Feste Liste und Live-Weg ══");
  {
    const { ctx, p } = await hub(browser, HAEUSER[0]);
    for(const w of ['buehne" onclick="x', "Raster", 7, null, ["raster"]]){
      const r = await p.evaluate(w => { HUBSTIL = { karte:w }; zeichne(); return { stil: document.body.dataset.kartenstil, onclick: !!document.querySelector("[onclick]") }; }, w);
      pruef(r.stil === "liste" && !r.onclick, "unbekannter Wert " + JSON.stringify(w) + " → liste", JSON.stringify(r));
    }
    await ctx.close();
    for(const stil of ["raster", "flink"]){
      const h = await hub(browser, HAEUSER[0], { stil });
      await h.p.waitForTimeout(600);
      const live = await h.p.evaluate(() => ({ stil: document.body.dataset.kartenstil, raster: document.querySelectorAll("#inhalt .ks-raster").length,
        gruss: !!document.querySelector("#inhalt .ks-gruss") }));
      pruef(live.stil === stil && (stil === "raster" ? live.raster > 0 : live.gruss), "Live-Weg betriebe.hub_stil.karte = " + stil + " zeichnet um", JSON.stringify(live));
      await h.ctx.close();
    }
  }

  console.log("══ 5 · Board: Stil der Speisekarte ══");
  {
    const BB = { id:"b-blend", slug:"blend", name:"Blend", rolle:"inhaber", bestell_pause:false, hub_texte:{},
      hub_stil:{ emoji:false, schrift:{ kopf:"fraunces" } }, markenblatt:null };
    const ctx = await browser.newContext({ viewport:{ width:390, height:900 } });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.addInitScript(b => { window.HUB_VORSCHAU_BASIS = b; Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; }, BASIS);
    await p.route("**/*", r => {
      const u = r.request().url();
      if(u.startsWith("file://")) return r.continue();
      if(u === BASIS + "blend/") return r.fulfill({ status:200, contentType:"text/html; charset=utf-8",
        headers:{ "Access-Control-Allow-Origin":"*" }, body:fs.readFileSync(path.join(DIST, "blend", "index.html"), "utf8") });
      return r.fulfill({ status:200, contentType:"application/json", headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" });
    });
    await p.goto("file://" + ADMIN);
    await p.waitForTimeout(600);
    const scharf = await p.$("#scharfJetzt");
    if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(150); }
    await p.evaluate(bb => {
      window.__schreib = [];
      const antwort = z => {
        if(z.op !== "select"){ window.__schreib.push({ tab:z.tab, op:z.op, daten:JSON.parse(JSON.stringify(z.daten || null)) });
          if(z.tab === "betriebe" && z.op === "update" && z.daten && z.daten.hub_stil) bb.hub_stil = z.daten.hub_stil;
          return { data:null, error:null }; }
        if(z.tab === "betrieb_mitglieder") return { data:[{ rolle:bb.rolle, betriebe:Object.assign({}, bb) }], error:null };
        return { data: z.einzeln ? null : [], error:null };
      };
      const kette = tab => { const z = { tab, op:"select", daten:null, einzeln:false };
        const p = new Proxy(function(){}, { get(_, k){ if(k === "then") return res => res(antwort(z));
          return (...a) => { if(["update", "insert", "upsert", "delete"].includes(k)){ z.op = k; z.daten = a[0]; }
            if(k === "maybeSingle" || k === "single") z.einzeln = true; return p; }; }, apply(){ return p; } }); return p; };
      db = { from:kette, rpc:() => kette("rpc"), channel:() => kette("kanal"), removeChannel:async () => {},
        storage:{ from:() => kette("speicher") }, functions:{ invoke:async () => ({ data:null, error:null }) },
        auth:{ getSession:async () => ({ data:{ session:null } }), getUser:async () => ({ data:{ user:{ id:"u1", email:"probe@example.org" } } }),
               onAuthStateChange:() => ({ data:{ subscription:{ unsubscribe(){} } } }) } };
      demo = false; window.__bb = bb;
    }, BB);
    const oeffnen = async () => { await p.evaluate(async id => { document.getElementById("tor").hidden = true;
      try{ localStorage.setItem(merkSchluessel(), id); }catch(e){} await betriebWaehlen(); }, BB.id);
      await p.waitForTimeout(300); await p.evaluate(() => document.querySelector('[data-tafel="startseite"]').click()); };
    await oeffnen();
    for(let i = 0; i < 50; i++){ if(await p.evaluate(() => { const h = hvAlle().gestalten; return !!(h && h.bereit); })) break; await p.waitForTimeout(150); }
    await p.waitForTimeout(500);
    let st = await p.evaluate(() => ({ an: [...document.querySelectorAll("#ksGruppe .ks-wahl")].filter(b => b.getAttribute("aria-checked") === "true").map(b => b.dataset.ks),
      zu: document.getElementById("ksSichern").disabled, inhaber: document.getElementById("ksGruppe").hasAttribute("data-nur-inhaber"),
      hoehe: Math.min(...[...document.querySelectorAll("#ksGruppe .ks-wahl")].map(b => b.getBoundingClientRect().height)),
      wahlen: [...document.querySelectorAll("#ksGruppe .ks-wahl")].map(b => b.dataset.ks) }));
    const hubStile = await p.evaluate(() => hvAlle().gestalten.frame.contentWindow.eval("KARTENSTILE"));
    pruef(JSON.stringify(st.wahlen) === JSON.stringify(hubStile), "die Wahlen im Board = KARTENSTILE im Hub (zweite Quelle)", st.wahlen.join(","));
    pruef(st.an.join() === "liste" && st.zu && st.inhaber && st.hoehe >= 44, "ohne gespeicherten Stil: Liste gewählt, Übernehmen zu, Besitzer-Gruppe, ≥ 44 px", JSON.stringify(st));
    await p.$eval('#ksGruppe [data-ks="buehne"]', b => b.scrollIntoView({ block:"center" }));
    await p.click('#ksGruppe [data-ks="buehne"]');
    await p.waitForTimeout(900);
    const rahmen = await p.evaluate(() => { const w = hvAlle().gestalten.frame.contentWindow;
      return { stil: w.document.body.dataset.kartenstil, hash: w.location.hash, karten: w.document.querySelectorAll("#inhalt .gericht").length }; });
    pruef(rahmen.stil === "buehne" && /speisekarte/.test(rahmen.hash) && rahmen.karten > 0, "Tipp auf „Bühne“: die Vorschau zeigt die Speisekarte als Bühne", JSON.stringify(rahmen));
    pruef(!(await p.evaluate(() => __schreib.length)), "ohne „Übernehmen“ wird nichts geschrieben");
    await p.$eval("#ksSichern", b => b.scrollIntoView({ block:"center" }));
    await p.click("#ksSichern");
    await p.waitForTimeout(400);
    const w = await p.evaluate(() => __schreib.filter(x => x.tab === "betriebe" && x.op === "update").pop());
    pruef(w && w.daten.hub_stil.karte === "buehne" && w.daten.hub_stil.emoji === false && w.daten.hub_stil.schrift && w.daten.hub_stil.schrift.kopf === "fraunces",
      "Übernehmen schreibt karte und lässt die Nachbarn stehen", JSON.stringify(w && w.daten));
    await oeffnen();
    st = await p.evaluate(() => ({ an: [...document.querySelectorAll("#ksGruppe .ks-wahl")].filter(b => b.getAttribute("aria-checked") === "true").map(b => b.dataset.ks),
      zu: document.getElementById("ksSichern").disabled }));
    pruef(st.an.join() === "buehne" && st.zu, "nach dem Neuöffnen: der gespeicherte Stil, Übernehmen wieder zu", JSON.stringify(st));
    pruef(!fehler.length, "keine Seitenfehler im Board", fehler.join(" | "));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " FEHLER" : "Alles grün.") + " (" + n + " Proben)");
  process.exit(f ? 1 : 0);
})();
