// Hub mit vergifteten Datenbankantworten (Sicherheits-Sweep 19.10.).
// Jedes Feld, das ein Restaurant oder das Team schreibt, trägt eine Nutzlast mit
// eigener Marke ZQnZ, die __x.push(Marke) aufruft. Gefeuert = ausgeführt.
// Aufruf: node hub-vergiftet.js <haus> <html|js|attr|sq|url> [sprache]
// Genutzt von pruefungen/pruef-einschleusung.js.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const haus = process.argv[2] || "chocolamour";
const variante = process.argv[3] || "html";
const lang = process.argv[4] || "de";
const OBEN = path.resolve(__dirname, "..", "..");
const HUB = process.env.HUB_DATEI || path.join(OBEN, "dist", haus, "index.html");
const VORLAGE = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");
const SCHL = [...VORLAGE.matchAll(/^"((?:[^"\\]|\\.)*)":\{en:/gm)].map(m => JSON.parse('"' + m[1] + '"'));

let zaehler = 0; const feldVon = {};
function P(feld){
  const m = "ZQ" + (++zaehler) + "Z"; feldVon[m] = feld;
  if(variante === "html") return `'"><img src=x onerror=__x.push("${m}")>${m}`;
  if(variante === "js")   return `');__x.push('${m}');//${m}`;
  if(variante === "attr") return `" autofocus onfocus="__x.push('${m}')" x="${m}`;
  if(variante === "sq")   return `' autofocus onfocus='__x.push("${m}")' x='${m}`;
  if(variante === "url")  return `javascript:__x.push('${m}')`;
}
function gerichte(){
  const kats = ["speisekarte","getraenke","cocktails"];
  return kats.map((k, i) => ({
    id: "g" + i, betrieb_id: "b1", karte: k, karten: [k], verfuegbar: true,
    name: P("gericht.name." + k), beschreibung: P("gericht.beschreibung." + k),
    kategorie: P("gericht.kategorie." + k), kat_emoji: P("gericht.kat_emoji"),
    kat_sort: 1, reihenfolge: 1, preis: 5.5,
    bild: P("gericht.bild"), bild_frei: "https://x.test/" + P("gericht.bild_frei"),
    frei: true, opt: P("gericht.opt"), allergene: P("gericht.allergene"),
    zusatzstoffe: P("gericht.zusatzstoffe"), stoff_hinweis: P("gericht.stoff_hinweis"),
    veg: true, vegan: true, ab_alter: 18,
    uebersetzungen: { en: P("gericht.uebersetzungen.en") },
    name_uebersetzungen: { en: P("gericht.name_uebersetzungen.en") }
  }));
}
function betrieb(){
  const woerter = { en: {}, de: {} };
  SCHL.forEach((k, i) => { if(i < 600 && !k.includes("{")) woerter.en[k] = P("woerter." + k.slice(0, 30)); });
  return [{
    id: "b1", bestell_pause: true, bestell_pause_text: P("betrieb.bestell_pause_text"),
    hub_texte: { claim: P("texte.claim"), gruss: P("texte.gruss"), runner_titel: "<img src=x onerror=__x.push(\"RT\")>",
      laufschrift: P("texte.laufschrift"), wlan_netz: P("texte.wlan_netz"), wlan_passwort: P("texte.wlan_passwort"),
      ueber: P("texte.ueber"), eigen: Object.fromEntries(SCHL.slice(0, 200).map(k => [k, { de: P("eigen.de"), en: P("eigen.en"), schrift: P("eigen.schrift") }])) },
    hub_kacheln: [
      ...["speisekarte","getraenke","cocktails","tischquiz","musikwunsch","rueckmeldung","kontakt","reservieren","wlan"].map(s => ({ schluessel: s, an: true, titel: P("kachel.titel"), unter: P("kachel.unter"), icon: P("kachel.icon"), emoji: P("kachel.emoji"), gruppe: P("kachel.gruppe"), raster: P("kachel.raster"), stil: P("kachel.stil"), farbe: P("kachel.farbe"), banner: "https://x.test/" + P("kachel.banner"), breite: P("kachel.breite"), bildform: P("kachel.bildform"), grund: P("kachel.grund"), symbolLage: P("kachel.symbolLage"), hoehe: P("kachel.hoehe"), textgroesse: P("kachel.textgroesse") })),
      { schluessel: "e-abc123", an: true, art: "link", link: "https://x.test/" + P("kachel.link"), titel: P("kachel.eigen.titel"), unter: P("kachel.eigen.unter") },
      { schluessel: "e-abc124", an: true, art: "link", link: "javascript:__x.push('LINKJS')", titel: "lj" },
      { schluessel: "e-abc125", an: true, art: "karte", karte: "k-" + P("kachel.karte"), titel: P("kachel.k.titel") }
    ],
    hub_banner: [
      { id: P("banner.id"), an: true, bild: "https://x.test/" + P("banner.bild"), titel: P("banner.titel"), text: P("banner.text"), farbe: P("banner.farbe"), zielTyp: "url", zielWert: "https://x.test/" + P("banner.zielWert.url"), reihenfolge: 1, ausrichtung: P("banner.ausr") },
      { id: "b2", an: true, bild: "https://x.test/b.png", titel: "t", zielTyp: "produkt", zielWert: P("banner.zielWert.produkt"), reihenfolge: 2 },
      { id: "b3", an: true, bild: "https://x.test/b.png", titel: "t", zielTyp: "seite", zielWert: P("banner.zielWert.seite"), reihenfolge: 3 }
    ],
    hub_woerter: woerter,
    liefer: { an: true, plz: [P("liefer.plz")], zeiten: { von: P("liefer.von"), bis: P("liefer.bis") }, tage: [P("liefer.tage")] , mindest: P("liefer.mindest")},
    hub_avatar: { figur: P("avatar.figur"), art: P("avatar.art"), name: P("avatar.name"), haende: { a: P("avatar.haende") } },
    hub_stil: { emoji: P("stil.emoji"), schrift: { kopf: P("stil.schrift.kopf"), text: P("stil.schrift.text") }, farben: { tag: { grund: P("stil.farben.grund") } }, kopf: { bild: "https://x.test/" + P("stil.kopf.bild"), logo: "https://x.test/" + P("stil.kopf.logo"), form: P("stil.kopf.form") }, karte: P("stil.karte"), lade: P("stil.lade") },
    karten: [{ id: "k-mittag", name: P("karten.name"), unter: P("karten.unter") }],
    optionen: { x: { name: P("optionen.name") } }
  }];
}
const AKT = () => [{ id: "a1", gericht_name: P("aktion.gericht_name"), titel: process.env.AKTLEER ? "" : P("aktion.titel"), preis_alt: 10, preis_neu: 5, bis: new Date(Date.now() + 3600e3).toISOString() }];

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
  p.on("dialog", d => d.dismiss());
  await p.addInitScript(l => { window.__x = []; try{ sessionStorage.setItem("omoteno-willkommen", "1"); localStorage.setItem("tapto-sprache", l); }catch(e){} }, lang);
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://") || u.startsWith("http://127.0.0.1")) return r.continue();
    const j = b => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if(/\/rest\/v1\/betriebe\?/.test(u)) return j(betrieb());
    if(/\/rest\/v1\/gerichte\?/.test(u)) return j(gerichte());
    if(/\/rest\/v1\/aktionen\?/.test(u)) return j(AKT());
    return j([]);
  });
  let url = "file://" + HUB;
  if(process.env.CSP){
    const http = require("http");
    const hd = fs.readFileSync(path.join(OBEN, "auslieferung", "_headers"), "utf8");
    const csp = /Content-Security-Policy:\s*(.*)/.exec(hd)[1].replace(/;\s*upgrade-insecure-requests/, "");
    const body = fs.readFileSync(HUB);
    const srv = http.createServer((q, r) => { r.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": csp }); r.end(body); });
    await new Promise(ok => srv.listen(8765, ok));
    url = "http://127.0.0.1:8765/h/x/";
    p.on("console", m => { if(/Content Security Policy/i.test(m.text())) console.log("CSP-VERLETZUNG:", m.text().slice(0, 160)); });
    console.log("CSP:", csp.slice(0, 120));
  }
  await p.goto(url);
  await p.waitForTimeout(2500);
  const seiten = await p.evaluate(() => Object.keys(SEITEN));
  const log = []; const reached = new Set(); const sinks = {};
  for(const h of ["speisekarte","getraenke","cocktails"]){
    await p.evaluate(h => { location.hash = "#/" + h; }, h); await p.waitForTimeout(500);
    for(let i=0;i<3;i++){ await p.evaluate(() => { const b = document.querySelector(".gplus"); if(b) b.click(); }); await p.waitForTimeout(150); }
    // Detailblatt oeffnen
    await p.evaluate(() => { const g = document.querySelector("[data-detail], .gericht, .tipp"); if(g) g.click(); }); await p.waitForTimeout(300);
    const dx = await p.evaluate(() => window.__x.length); log.push(["detail "+h, dx]);
    await p.keyboard.press("Escape");
  }
  for(const k of ["speisekarte","getraenke","cocktails"]){
    await p.evaluate(k => { try{ const lst = {speisekarte:SPEISEKARTE,getraenke:GETRAENKE,cocktails:COCKTAILS}[k]; detailOeffnen(lst[0].eintraege[0].n); }catch(e){ window.__detailfehler = String(e); } }, k);
    await p.waitForTimeout(700);
    const dd = await p.evaluate(() => ({ f: window.__detailfehler || null, offen: !!document.querySelector(".warenkarte, #warenkarte.an, .wkarte"), html: (document.getElementById("warenkarte")||{}).innerHTML ? document.getElementById("warenkarte").innerHTML.length : 0, marker: ((document.getElementById("warenkarte")||{innerHTML:""}).innerHTML.match(/ZQ\d+Z/g)||[]).length }));
    log.push(["detailblatt " + k, JSON.stringify(dd)]);
    const cx2 = await p.evaluate(() => { const o = {}; document.querySelectorAll("#warenkarte img[onerror*=ZQ]").forEach(i => { const m = /ZQ\d+Z/.exec(i.getAttribute("onerror"))[0]; o[m] = i.parentElement.tagName + "." + i.parentElement.className; }); document.querySelectorAll("#warenkarte [onfocus*=ZQ]").forEach(i => { o[/ZQ\d+Z/.exec(i.getAttribute("onfocus"))[0]] = "ATTR " + i.tagName + "." + i.className; }); return o; });
    Object.keys(cx2).forEach(m => sinks[(feldVon[m]||m) + " @detail"] = cx2[m]);
    await p.keyboard.press("Escape");
  }
  for(const s of ["", ...seiten]){
    try{
      await p.evaluate(h => { location.hash = h ? "#/" + h : "#/"; }, s);
      await p.waitForTimeout(500);
      // alle Bereiche öffnen
      await p.$$eval(".sb-kopf[aria-expanded=false]", ks => ks.forEach(k => k.click())).catch(() => {});
      await p.waitForTimeout(150);
    }catch(e){ log.push("fehler bei " + s + ": " + e.message.slice(0, 100)); }
    const r = await p.evaluate(() => {
      const aus = [];
      document.querySelectorAll("*").forEach(el => {
        for(const a of el.attributes){
          if(/^on/.test(a.name) && /ZQ\d+Z/.test(a.value)) aus.push(["ONATTR", el.tagName, a.name, a.value.slice(0, 80)]);
          if(a.name === "autofocus" ) aus.push(["autofocus", el.tagName]);
          if(/^(href|src)$/.test(a.name) && /^javascript:/i.test(a.value)) aus.push(["JSURL", el.tagName, a.name, a.value.slice(0, 80)]);
        }
        if(el.tagName === "IMG" && el.getAttribute("src") === "x") aus.push(["IMGx", el.outerHTML.slice(0, 100)]);
      });
      return { aus, x: window.__x.slice() };
    });
    const gesehen = await p.evaluate(() => { const m = new Set(); (document.documentElement.outerHTML.match(/ZQ\d+Z/g) || []).forEach(x => m.add(x)); return [...m]; });
    gesehen.forEach(m => reached.add(m));
    const cx = await p.evaluate(() => { const o = {}; document.querySelectorAll("img[onerror*=ZQ]").forEach(i => { const m = /ZQ\d+Z/.exec(i.getAttribute("onerror"))[0]; if(o[m]) return; let e = i.parentElement, pfad = []; for(let k = 0; k < 4 && e; k++, e = e.parentElement) pfad.push(e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.split(" ").join(".") : "") + (e.id ? "#" + e.id : "")); o[m] = pfad.join(" < "); });
      document.querySelectorAll("[onfocus*=ZQ]").forEach(i => { const m = /ZQ\d+Z/.exec(i.getAttribute("onfocus"))[0]; o[m] = "ATTR " + i.tagName.toLowerCase() + "." + i.className + " attrs=" + [...i.attributes].map(a=>a.name).join(","); }); return o; });
    Object.keys(cx).forEach(m => { const k = (feldVon[m] || m) + " @" + (s || "start"); if(!sinks[k]) sinks[k] = cx[m]; });
    log.push(["seite", s || "start", JSON.stringify(r.aus).slice(0, 600), "x=" + JSON.stringify(r.x)]);
    // Onclick-Handler mit Marke auslösen
    await p.evaluate(() => document.querySelectorAll("[onclick]").forEach(el => { if(/ZQ\d+Z/.test(el.getAttribute("onclick"))) try{ el.click(); }catch(e){} }));
  }
  Object.keys(sinks).forEach(k => console.log("SINK", k, "=>", sinks[k]));
  const ctxs = await p.evaluate(() => { const o = {}; document.querySelectorAll("img[onerror*=ZQ]").forEach(i => { const m = /ZQ\d+Z/.exec(i.getAttribute("onerror"))[0]; if(o[m]) return; let e = i.parentElement, pfad = []; for(let k = 0; k < 4 && e; k++, e = e.parentElement) pfad.push(e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.split(" ").join(".") : "") + (e.id ? "#" + e.id : "")); o[m] = pfad.join(" < "); });
    document.querySelectorAll("[autofocus][onfocus*=ZQ], [onfocus*=ZQ]").forEach(i => { const m = /ZQ\d+Z/.exec(i.getAttribute("onfocus"))[0]; o[m] = "ATTR " + i.tagName.toLowerCase() + "." + i.className; }); return o; });

  const x = await p.evaluate(() => window.__x.slice());
  console.log(haus, variante, lang, "gefeuert:", JSON.stringify([...new Set(x)].map(m => m + "=" + (feldVon[m] || m))));
  console.log("ERREICHT(Marke im DOM):", JSON.stringify([...new Set([...reached].map(m => (feldVon[m]||m).replace(/^woerter\..*/, "woerter.*")))]));
  log.forEach(l => console.log(JSON.stringify(l).slice(0, 700)));
  console.log("pageerrors:", fehler.slice(0, 5));
  await br.close(); process.exit(0);
})();
