/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Farben des Hubs im Board, live im Hub

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-farben.js

   Wunsch 11.10.: „mehr Helligkeitsstufen für den Hub, dass man die
   Farbe für den Choco Hub auch im Admin Board bearbeiten kann“.
   Sechs Farben je Fassung (Tag/Abend) in hub_stil.farben, der Rest
   wird gerechnet (FARBEN · GETEILTER BLOCK), Unlesbares gesperrt.

   1 · Der geteilte Block steht in Hub und Board Zeichen für Zeichen
       gleich — sonst erlaubte das Board, was der Hub anders malt.
   2 · Rechnung: Jede Stufe der Leiter ist für jedes Haus (zweite
       Quelle: markenblaetter/*.json), Tag und Abend, lesbar; leise
       Schrift ≥ 4,5:1 auf Grund UND Karte. farbPruefen lässt nur
       sechs Hexwerte durch (Anführungszeichen, Kurzform, fehlende
       Rolle → null) und nichts Unlesbares.
   3 · Board (gestelltes db über betriebWaehlen, echte Hub-Datei in der
       Vorschau): ohne gespeicherte Farben stehen die des Markenblatts
       DES HUBS im Formular; ein Tipp auf eine Stufe füllt die Felder
       und färbt die Vorschau (gemessen am Rahmen, nicht am Formular);
       Abend-Reiter zeigt die Abendfassung; unlesbare Schrift sperrt
       „Übernehmen“ mit Satz und schreibt nichts; „Übernehmen“ führt
       hub_stil zusammen (emoji, restzeit, schrift bleiben), < 600
       Bytes; nach dem Neuöffnen steht der gespeicherte Stand im
       Formular (§8.1m); „Auf Markenblatt zurück“ nimmt NUR farben
       weg; vor dem Lesen schreibt „Übernehmen“ nichts.
   4 · Hub (gestellte Antwort): gültige Farben werden gemalt; ein
       Wert mit Anführungszeichen oder ein unlesbares Paar lässt das
       Markenblatt stehen; abends die Abendfarben; zweiter Besuch ohne
       Netz hat die Farben schon beim ersten Anstrich; ohne farben in
       der Spalte wieder das Markenblatt, und der Merker ist weg.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const OBEN = path.join(__dirname, "..");
const DIST = process.env.DIST || path.join(OBEN, "dist");
const VORLAGE = process.env.VORLAGE || path.join(OBEN, "vorlagen", "hub.vorlage.html");
const ADMIN = process.env.ADMIN || path.join(OBEN, "seiten", "admin.html");
const BASIS = "https://omoteno.test/h/";

let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

const ANFANG = "/* ╔═══ FARBEN · GETEILTER BLOCK · ANFANG", ENDE = "/* ╚═══ FARBEN · GETEILTER BLOCK · ENDE";
const block = datei => { const s = fs.readFileSync(datei, "utf8"); const a = s.indexOf(ANFANG), e = s.indexOf(ENDE);
  return a >= 0 && e > a ? s.slice(a, s.indexOf("\n", e)) : null; };

/* ── 1 + 2 · Block und Rechnung ──────────────────────────────────── */
console.log("══ Geteilter Block und Rechnung ══");
const bh = block(VORLAGE), ba = block(ADMIN);
pruef(!!bh && !!ba, "der Block steht in Hub und Board");
pruef(bh === ba, "Zeichen für Zeichen gleich", bh && ba ? bh.length + " / " + ba.length + " Zeichen" : "–");
const F = {};
vm.runInNewContext(bh + "\nObject.assign(F,{FARB_STUFEN,farbStufeAuf,farbLesbar,farbHerleiten,farbKontrast,farbPruefen});", { F });
const HAEUSER = fs.readdirSync(path.join(OBEN, "markenblaetter")).filter(x => x.endsWith(".json"));
let schlecht = [], leise = [];
for(const datei of HAEUSER){
  const m = JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", datei), "utf8"));
  for(const [seite, q] of [["tag", m.farben], ["abend", Object.assign({}, m.farben, m.abend || {})]]){
    const e = { grund:q.grund, flaeche:q.flaeche, band:q.band, tinte:q.tinte, akzent:q.akzent, akzent2:q.akzent2 };
    for(const st of F.FARB_STUFEN){
      const x = F.farbStufeAuf(e, st.s), l = F.farbLesbar(x), p = F.farbHerleiten(x);
      if(l.length) schlecht.push(datei + " " + seite + " " + st.s + ": " + l.map(y => y.was).join(","));
      const k = Math.min(F.farbKontrast(p.tinteLeise, p.grund), F.farbKontrast(p.tinteLeise, p.flaeche),
                         F.farbKontrast(p.tinteStill, p.grund), F.farbKontrast(p.tinteStill, p.flaeche));
      if(k < 4.5) leise.push(datei + " " + seite + " " + st.s + " " + k.toFixed(2));
    }
  }
}
pruef(HAEUSER.length >= 2, "Häuser aus der zweiten Quelle", HAEUSER.length);
pruef(!schlecht.length, "jede Stufe × jedes Haus × Tag/Abend lesbar", schlecht.slice(0, 3).join(" | ") || F.FARB_STUFEN.length + " Stufen");
pruef(!leise.length, "leise und stille Schrift ≥ 4,5:1 auf Grund und Karte", leise.slice(0, 3).join(" | ") || "ja");
const GUT = { grund:"#FFFFFF", flaeche:"#FFFFFF", band:"#2A1A14", tinte:"#111111", akzent:"#C8202E", akzent2:"#7D560C" };
const mit = (k, v) => Object.assign({}, GUT, { [k]: v });
pruef(!!F.farbPruefen({ tag:GUT }) && F.farbPruefen({ tag:GUT }).tag.grund === "#FFFFFF", "sechs gültige Hexwerte werden angenommen");
pruef(F.farbPruefen({ tag:mit("grund", '#fff" onclick="alert(1)') }) === null, "Anführungszeichen im Wert → nicht angenommen");
pruef(F.farbPruefen({ tag:mit("grund", "#fff") }) === null, "Kurzform #fff → nicht angenommen");
pruef(F.farbPruefen({ tag:mit("grund", "red") }) === null, "Farbname → nicht angenommen");
const ohne = Object.assign({}, GUT); delete ohne.akzent2;
pruef(F.farbPruefen({ tag:ohne }) === null, "fehlende Rolle → nicht angenommen");
pruef(F.farbPruefen({ tag:mit("tinte", "#888888") }) === null, "Schrift #888 auf Weiß (3,5:1) → nicht angenommen");
pruef(F.farbPruefen({ tag:mit("band", "#5A5A5A") }) !== null, "Band #5A5A5A: Schrift darauf wird gerechnet → angenommen");
/* #777: weder Weiß (4,48) noch fast Schwarz (4,19) erreichen 4,5 —
   ein Band, auf dem keine Schrift lesbar ist, gilt nicht. */
pruef(F.farbPruefen({ tag:mit("band", "#777777") }) === null &&
      F.farbLesbar(mit("band", "#777777")).some(x => /Kopfband/.test(x.was)), "Band #777: keine Schrift lesbar → nicht angenommen, mit Grund");
pruef(F.farbPruefen([GUT]) === null && F.farbPruefen("x") === null, "kein Objekt → nicht angenommen");

/* ── 3 · Board ───────────────────────────────────────────────────── */
const HUB = path.join(DIST, "blend", "index.html");
const BLEND = JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", "blend.json"), "utf8"));

function stelleDb(){
  return (bb) => {
    window.__schreib = [];
    function antwort(z){
      if(z.op !== "select"){ window.__schreib.push({ tab:z.tab, op:z.op, daten:JSON.parse(JSON.stringify(z.daten || null)) });
        if(z.tab === "betriebe" && z.op === "update" && z.daten && z.daten.hub_stil) bb.hub_stil = z.daten.hub_stil;
        /* Wie PostgREST: update … select("id") gibt die getroffenen Zeilen zurück (Board liest frisch, C3b). */
        if(z.tab === "betriebe" && z.op === "update" && z.mitZeilen) return { data:[{ id:bb.id }], error:null };
        return { data:null, error:null }; }
      if(z.tab === "betriebe" && z.einzeln) return { data:{ hub_stil: JSON.parse(JSON.stringify(bb.hub_stil || null)) }, error:null };
      if(z.tab === "betrieb_mitglieder") return { data:[{ rolle:bb.rolle, betriebe:Object.assign({}, bb) }], error:null };
      return { data: z.einzeln ? null : [], error:null };
    }
    function kette(tab){
      const z = { tab, op:"select", daten:null, einzeln:false };
      const p = new Proxy(function(){}, {
        get(_, k){
          if(k === "then") return res => res(antwort(z));
          return (...a) => { if(["update", "insert", "upsert", "delete"].includes(k)){ z.op = k; z.daten = a[0]; }
            if(k === "maybeSingle" || k === "single") z.einzeln = true;
            if(k === "select" && z.op !== "select") z.mitZeilen = true; return p; };
        },
        apply(){ return p; }
      });
      return p;
    }
    db = { from:kette, rpc:() => kette("rpc"), channel:() => kette("kanal"), removeChannel:async () => {},
      storage:{ from:() => kette("speicher") }, functions:{ invoke:async () => ({ data:null, error:null }) },
      auth:{ getSession:async () => ({ data:{ session:null } }),
             getUser:async () => ({ data:{ user:{ id:"u1", email:"probe@example.org" } } }),
             onAuthStateChange:() => ({ data:{ subscription:{ unsubscribe(){} } } }) } };
    demo = false;
  };
}

async function board(browser, bb, haus){
  haus = haus || "blend";
  const ctx = await browser.newContext({ viewport:{ width:390, height:900 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript(b => { window.HUB_VORSCHAU_BASIS = b;
    Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; }, BASIS);
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(u === BASIS + haus + "/") return r.fulfill({ status:200, contentType:"text/html; charset=utf-8",
      headers:{ "Access-Control-Allow-Origin":"*" }, body:fs.readFileSync(path.join(DIST, haus, "index.html"), "utf8") });
    return r.fulfill({ status:200, contentType:"application/json", headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" });
  });
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(600);
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(150); }
  await p.evaluate(stelleDb(), bb);
  await p.evaluate(async id => { document.getElementById("tor").hidden = true;
    try{ localStorage.setItem(merkSchluessel(), id); }catch(e){}
    await betriebWaehlen(); }, bb.id);
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-tafel="startseite"]').click());
  await gruppeZu(p, "#fbGruppe");
  return { ctx, p, fehler };
}
const bereit = async p => { for(let i = 0; i < 50; i++){
  if(await p.evaluate(() => { const h = hvAlle().farben;
    try{ return !!(h && h.bereit && typeof h.frame.contentWindow.farbMarke === "function"); }catch(e){ return false; } })) return true;
  await p.waitForTimeout(150); } return false; };
const rahmen = p => p.evaluate(() => { const w = hvAlle().farben.frame.contentWindow, d = w.document;
  return { grund:d.documentElement.style.getPropertyValue("--grund").trim().toUpperCase(),
           tinte:d.documentElement.style.getPropertyValue("--tinte").trim().toUpperCase(),
           phase:d.body.dataset.phase }; });
const felder = p => p.evaluate(() => Object.fromEntries(FARB_ROLLEN.map(r => [r, document.getElementById("fbx-" + r).value])));
const tippen = async (p, sel) => { await p.$eval(sel, el => el.scrollIntoView({ block:"center" })); await p.click(sel); await p.waitForTimeout(400); };

async function boardTeil(browser){
  console.log("\n══ Board: Farben des Hubs (Besitzer) ══");
  const BB = { id:"b-blend", slug:"blend", name:"Blend", rolle:"inhaber", bestell_pause:false, hub_texte:{},
    hub_stil:{ emoji:false, restzeit:false, schrift:{ kopf:"fraunces" } }, markenblatt:null };
  let { ctx, p, fehler } = await board(browser, BB);
  pruef(await bereit(p), "Voraussetzung: die Vorschau lädt die echte Hub-Datei");
  await p.waitForTimeout(400);
  let fe = await felder(p);
  pruef(fe.grund === BLEND.farben.grund.toUpperCase() && fe.tinte === BLEND.farben.tinte.toUpperCase(),
    "ohne gespeicherte Farben: Markenblatt des Hubs im Formular (zweite Quelle blend.json)", fe.grund + " / " + fe.tinte);
  const sicht = await p.evaluate(() => { const g = document.getElementById("fbGruppe");
    return { da:!!g && g.getClientRects().length > 0, inhaber:g && g.hasAttribute("data-nur-inhaber"),
             feld:getComputedStyle(document.getElementById("fbx-grund")).fontSize,
             stufeH:Math.min(...[...document.querySelectorAll("[data-fb-stufe]")].map(b => b.getBoundingClientRect().height)),
             muster:document.querySelector(".fbmuster").getBoundingClientRect().height,
             ueber:document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  pruef(sicht.da && sicht.inhaber, "die Gruppe steht da und ist eine Besitzer-Gruppe");
  pruef(sicht.feld === "16px" && sicht.stufeH >= 44 && sicht.muster >= 44, "Felder 16 px, Stufen und Muster ≥ 44 px",
    sicht.feld + " / " + sicht.stufeH.toFixed(0) + " / " + sicht.muster.toFixed(0));
  pruef(sicht.ueber <= 0, "kein seitlicher Überlauf bei 390 px", sicht.ueber);

  /* Stufe Weiß, über den echten Tipp */
  await tippen(p, '[data-fb-stufe="weiss"]');
  await p.waitForTimeout(500);
  fe = await felder(p);
  let r = await rahmen(p);
  pruef(fe.grund === "#FFFFFF" && fe.tinte === "#111111", "Tipp auf „Weiß“ füllt Grund und Schrift", fe.grund + " / " + fe.tinte);
  pruef(r.grund === "#FFFFFF" && r.phase === "tag", "die Vorschau malt den weißen Grund (am Rahmen gemessen)", JSON.stringify(r));
  pruef(await p.$eval('[data-fb-stufe="weiss"]', b => b.getAttribute("aria-checked")) === "true", "die Stufe ist als gewählt markiert");
  const akz = await p.evaluate(() => farbKontrast(document.getElementById("fbx-akzent").value, document.getElementById("fbx-flaeche").value));
  pruef(akz >= 4.5, "Hauptfarbe auf der weißen Karte nachgezogen ≥ 4,5:1", akz.toFixed(2));

  /* Abend */
  await tippen(p, '[data-fb-fassung="abend"]');
  await p.waitForTimeout(400);
  const abendAus = await p.evaluate(() => ({ zeile:!document.getElementById("fbAbendZeile").hidden,
    an:document.getElementById("fbAbendAn").getAttribute("aria-pressed"), satz:document.getElementById("fbWarn").textContent }));
  pruef(abendAus.zeile && abendAus.an === String(!!(BLEND.abend && BLEND.abend.an)),
    "Abend-Reiter: Schalter der Abendfassung steht wie im Markenblatt", JSON.stringify(abendAus).slice(0, 120));
  if(abendAus.an === "false"){
    pruef(/aus/.test(abendAus.satz), "Abendfassung aus: ein Satz sagt es", abendAus.satz);
    await tippen(p, "#fbAbendAn");
  }
  await tippen(p, '[data-fb-stufe="schwarz"]');
  await p.waitForTimeout(500);
  r = await rahmen(p);
  pruef(r.grund === "#000000" && r.phase === "abend", "Abend + „Schwarz“: Vorschau zeigt die Abendfassung auf #000", JSON.stringify(r));

  /* Unlesbar sperrt */
  await tippen(p, '[data-fb-fassung="tag"]');
  await p.fill("#fbx-tinte", "#888888");
  await p.waitForTimeout(300);
  const gesperrt = await p.evaluate(() => ({ aus:document.getElementById("fbSichern").disabled,
    satz:document.getElementById("fbWarn").textContent }));
  pruef(gesperrt.aus && /nicht lesbar/i.test(gesperrt.satz) && /Schrift auf Hintergrund/.test(gesperrt.satz),
    "Schrift #888 auf Weiß: „Übernehmen“ gesperrt, mit Satz", gesperrt.satz.slice(0, 90));
  await p.evaluate(() => document.getElementById("fbSichern").click());
  await p.waitForTimeout(200);
  pruef(!(await p.evaluate(() => __schreib.filter(x => x.tab === "betriebe").length)), "gesperrt: nichts geschrieben");
  await p.fill("#fbx-tinte", "#1A1A1A");
  await p.waitForTimeout(300);
  pruef(!(await p.evaluate(() => document.getElementById("fbSichern").disabled)), "lesbar: „Übernehmen“ wieder frei");

  /* Übernehmen */
  await tippen(p, "#fbSichern");
  await p.waitForTimeout(300);
  const w = await p.evaluate(() => __schreib.filter(x => x.tab === "betriebe" && x.op === "update"));
  const hs = w.length === 1 && w[0].daten && w[0].daten.hub_stil;
  pruef(!!hs, "„Übernehmen“: genau ein Schreibaufruf mit hub_stil", w.length);
  pruef(hs && hs.emoji === false && hs.restzeit === false && hs.schrift && hs.schrift.kopf === "fraunces",
    "zusammengeführt: emoji, restzeit, schrift bleiben", hs && JSON.stringify(Object.keys(hs)));
  pruef(hs && hs.farben && hs.farben.tag.tinte === "#1A1A1A" && hs.farben.tag.grund === "#FFFFFF" &&
        hs.farben.abend.grund === "#000000" && hs.farben.abend.an === true, "die gewählten Farben stehen darin");
  const bytes = hs ? Buffer.byteLength(JSON.stringify(hs.farben)) : 9999;
  pruef(bytes < 600, "farben < 600 Bytes", bytes + " Bytes");
  pruef(!fehler.length, "keine Seitenfehler", fehler[0]);
  await ctx.close();

  /* Neu öffnen: der gespeicherte Stand steht im Formular (§8.1m) —
     die gestellte Datenbank trägt jetzt, was eben geschrieben wurde. */
  ({ ctx, p, fehler } = await board(browser, Object.assign({}, BB, { hub_stil: hs })));
  await bereit(p); await p.waitForTimeout(500);
  fe = await felder(p);
  pruef(fe.grund === "#FFFFFF" && fe.tinte === "#1A1A1A", "nach dem Neuöffnen: gespeicherter Stand im Formular (nicht das Markenblatt)",
    fe.grund + " / " + fe.tinte);
  r = await rahmen(p);
  pruef(r.grund === "#FFFFFF", "… und in der Vorschau", r.grund);
  await tippen(p, "#fbZurueck");
  await p.waitForTimeout(400);
  const z = await p.evaluate(() => __schreib.filter(x => x.tab === "betriebe" && x.op === "update").pop());
  pruef(z && z.daten.hub_stil && !("farben" in z.daten.hub_stil) && z.daten.hub_stil.emoji === false &&
        z.daten.hub_stil.schrift && z.daten.hub_stil.schrift.kopf === "fraunces",
    "„Auf Markenblatt zurück“ nimmt NUR farben weg", z && JSON.stringify(Object.keys(z.daten.hub_stil)));
  fe = await felder(p);
  pruef(fe.grund === BLEND.farben.grund.toUpperCase(), "… und das Formular zeigt wieder das Markenblatt", fe.grund);

  /* Vor dem Lesen schreibt nichts (§8.1m) */
  const vorher = await p.evaluate(() => { FB = null; fbZeichnen(); const k = document.getElementById("fbSichern");
    const aus = k.disabled; k.disabled = false; const n0 = __schreib.length; k.click(); return { aus, n0 }; });
  await p.waitForTimeout(200);
  const nachher = await p.evaluate(() => __schreib.length);
  pruef(vorher.aus && nachher === vorher.n0, "ungelesener Stand: gesperrt, und selbst ein erzwungener Tipp schreibt nichts");
  pruef(!fehler.length, "keine Seitenfehler", fehler[0]);
  await ctx.close();

  /* Choco: Das Gold des Markenblatts steht als kleine Schrift (Preis,
     „Beliebt“) mit gemessen 3,12:1 da — das Board sagt es und bietet
     „Lesbar machen“; danach ist es frei, der Farbton bleibt. */
  ({ ctx, p, fehler } = await board(browser, Object.assign({}, BB, { id:"b-choco", slug:"chocolamour", name:"Choco" }), "chocolamour"));
  await bereit(p); await p.waitForTimeout(500);
  const choco = await p.evaluate(() => ({ satz:document.getElementById("fbWarn").textContent,
    aus:document.getElementById("fbSichern").disabled, knopf:!document.getElementById("fbLesbar").hidden,
    gold:document.getElementById("fbx-akzent2").value }));
  const CHOCO = JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", "chocolamour.json"), "utf8"));
  pruef(choco.gold === CHOCO.farben.akzent2.toUpperCase() && /Zweitfarbe/.test(choco.satz) && choco.aus && choco.knopf,
    "Choco-Markenblatt: Gold als Schrift zu schwach — Satz, gesperrt, „Lesbar machen“ da", choco.satz.slice(0, 80));
  await tippen(p, "#fbLesbar");
  const nachLesbar = await p.evaluate(() => ({ aus:document.getElementById("fbSichern").disabled,
    knopf:!document.getElementById("fbLesbar").hidden, gold:document.getElementById("fbx-akzent2").value,
    probleme:fbProbleme().length }));
  const ton = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    return !d ? 0 : (((mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60) + 360) % 360; };
  pruef(!nachLesbar.aus && !nachLesbar.knopf && !nachLesbar.probleme, "„Lesbar machen“: alles lesbar, „Übernehmen“ frei", JSON.stringify(nachLesbar));
  pruef(Math.abs(ton(nachLesbar.gold) - ton(CHOCO.farben.akzent2)) < 4, "… der Farbton des Golds bleibt",
    CHOCO.farben.akzent2 + " → " + nachLesbar.gold);
  pruef(!fehler.length, "keine Seitenfehler", fehler[0]);
  await ctx.close();

  /* Team: Gruppe gesperrt */
  ({ ctx, p, fehler } = await board(browser, Object.assign({}, BB, { rolle:"team" })));
  await p.waitForTimeout(300);
  const team = await p.evaluate(() => { const g = document.getElementById("fbGruppe");
    const k = document.getElementById("fbSichern");
    return { satz:/Nur der Besitzer/.test(g.textContent), inert:!!k.closest("[inert]") }; });
  pruef(team.satz && team.inert, "Team: Satz steht da, „Übernehmen“ nicht erreichbar", JSON.stringify(team));
  await ctx.close();
}

/* ── 4 · Hub ─────────────────────────────────────────────────────── */
async function hub(browser, haus, stil, opt){
  opt = opt || {};
  const ctx = opt.ctx || await browser.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
  if(opt.uhr) await p.clock.setFixedTime(new Date(opt.uhr));
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(opt.offline) return r.abort();
    if(/\/rest\/v1\/betriebe\?/.test(u)) return r.fulfill({ status:200, contentType:"application/json",
      body:JSON.stringify([{ id:"b1", bestell_pause:false, hub_texte:{}, hub_stil:stil }]) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  if(opt.frueh){
    await p.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => {
      window.__frueh = document.documentElement.style.getPropertyValue("--grund").trim().toUpperCase(); }); });
  }
  await p.goto("file://" + path.join(DIST, haus, "index.html") + "#/");
  await p.waitForTimeout(1200);
  const m = await p.evaluate(() => ({ grund:document.documentElement.style.getPropertyValue("--grund").trim().toUpperCase(),
    tinte:document.documentElement.style.getPropertyValue("--tinte").trim().toUpperCase(),
    leise:document.documentElement.style.getPropertyValue("--tinte-leise").trim().toUpperCase(),
    bg:getComputedStyle(document.documentElement).backgroundColor, phase:document.body.dataset.phase,
    merk:localStorage.getItem("omoteno-farben-" + HAUS), frueh:window.__frueh || null }));
  return { ctx, p, m, fehler };
}

async function hubTeil(browser){
  console.log("\n══ Hub: Farben aus hub_stil ══");
  for(const haus of ["chocolamour", "blend"]){
    const mb = JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", haus + ".json"), "utf8"));
    const EIGEN = { tag:{ grund:"#FFFFFF", flaeche:"#FFFFFF", band:"#123456", tinte:"#111111", akzent:"#B3261E", akzent2:"#7D560C", stufe:"weiss" },
                    abend:{ grund:"#000000", flaeche:"#0E0E0E", band:"#123456", tinte:"#FFFFFF", akzent:"#F0616D", akzent2:"#F2B441", an:true } };
    let h = await hub(browser, haus, { emoji:true, farben:EIGEN }, { uhr:"2026-10-10T14:00:00" });
    pruef(h.m.grund === "#FFFFFF" && h.m.tinte === "#111111" && h.m.bg === "rgb(255, 255, 255)",
      haus + ": gültige Farben werden gemalt (Tag)", JSON.stringify(h.m).slice(0, 110));
    const lk = await h.p.evaluate(() => farbKontrast(document.documentElement.style.getPropertyValue("--tinte-leise").trim(), "#FFFFFF"));
    pruef(lk >= 4.5, haus + ": leise Schrift gerechnet ≥ 4,5:1", lk.toFixed(2));
    pruef(!!h.m.merk && JSON.parse(h.m.merk).tag.grund === "#FFFFFF", haus + ": für den nächsten Besuch gemerkt");
    pruef(!h.fehler.length, haus + ": keine Seitenfehler", h.fehler[0]);
    /* zweiter Besuch ohne Netz, im selben Kontext (gleicher Speicher) */
    const h2 = await hub(browser, haus, null, { ctx:h.ctx, offline:true, frueh:true, uhr:"2026-10-10T14:00:00" });
    pruef(h2.m.frueh === "#FFFFFF", haus + ": zweiter Besuch ohne Netz — Farben schon beim ersten Anstrich", h2.m.frueh);
    await h.ctx.close();

    h = await hub(browser, haus, { farben:EIGEN }, { uhr:"2026-10-10T21:00:00" });
    pruef(h.m.grund === "#000000" && h.m.phase === "abend", haus + ": abends die Abendfarben", h.m.grund + " " + h.m.phase);
    await h.ctx.close();

    const boese = JSON.parse(JSON.stringify(EIGEN)); boese.tag.grund = '#fff" onclick="alert(1)';
    h = await hub(browser, haus, { farben:boese }, { uhr:"2026-10-10T14:00:00" });
    pruef(h.m.grund === mb.farben.grund.toUpperCase(), haus + ": Anführungszeichen im Wert → Markenblatt bleibt", h.m.grund);
    pruef(!h.m.merk || !/onclick|"#fff/.test(h.m.merk), haus + ": … und gemerkt wird nur Geprüftes", h.m.merk && h.m.merk.slice(0, 60));
    await h.ctx.close();

    const blass = JSON.parse(JSON.stringify(EIGEN)); blass.tag.tinte = "#BBBBBB";
    h = await hub(browser, haus, { farben:blass }, { uhr:"2026-10-10T14:00:00" });
    pruef(h.m.grund === mb.farben.grund.toUpperCase(), haus + ": unlesbare Schrift → Markenblatt bleibt (Tag)", h.m.grund);
    await h.ctx.close();

    /* gemerkt, dann ohne farben: zurück aufs Markenblatt, Merker weg */
    h = await hub(browser, haus, { farben:EIGEN }, { uhr:"2026-10-10T14:00:00" });
    const h3 = await hub(browser, haus, { emoji:true }, { ctx:h.ctx, uhr:"2026-10-10T14:00:00" });
    pruef(h3.m.grund === mb.farben.grund.toUpperCase() && !h3.m.merk,
      haus + ": Spalte ohne farben → Markenblatt, Merker gelöscht", h3.m.grund + " / " + h3.m.merk);
    await h.ctx.close();
  }
}

(async () => {
  if(!fs.existsSync(HUB)){ console.error("Kein erzeugter Hub. Erst: node erzeuger/erzeuge-hub.js --alle"); process.exit(1); }
  const browser = await chromium.launch();
  await boardTeil(browser);
  await hubTeil(browser);
  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if(f){ console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
