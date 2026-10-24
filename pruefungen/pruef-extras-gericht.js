/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Beilagen und Extras JE GERICHT (Board → Hub → Server)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-extras-gericht.js
     (braucht dist/ und das lokale Postgres 16, siehe pruefungen/pruef-extras-lokal.sh)

   > Wunsch (24.10.): „für jedes Gericht Beilagen und Extras einstellen —
   > mit Textändern von den Überschriften, welche Zutaten wie viel sie
   > kosten und Voreinstellung als Vorschlag.“

   Der Weg steht in drei Stücken, und jedes ist gegen eine Erfindung des
   anderen leicht grün zu bekommen (§8.1i). Deshalb läuft hier die NAHT am
   Stück: was das Board schreibt, liest der Hub; was der Hub bestellt,
   rechnet die ECHTE positionen_pruefen nach.

   A · Hub: der Vorschlag ist vorgewählt (Aufpreis, Bon-Text, Etikett
       „Vorschlag“), die Wahl des Gastes schlägt ihn, auch eine leere
       Wahl; „genau eine“ startet auf dem Vorschlag, nicht auf der ersten
       Zeile; kein Vorschlag → wie vorher; „vor“ als Text zählt nicht;
       Neuladen behält die Wahl; die Bestellung trägt Text und Preis.
   B · Board, Gericht-Blatt: Beilage/Extras anlegen, Titel ändern, Zutaten
       mit Preis, Vorschlag (bei „genau eine“ nur einer); Speichern:
       ERST die Gruppen, DANN das Gericht (Reihenfolge der Schreibzugriffe
       gemessen), neues Gericht bekommt seine id vorab, Schlüssel unter
       g-<id>-…, Gruppen anderer Gerichte und gemeinsame Gruppen bleiben;
       unberührt gespeichert → KEIN Schreiben an optionen; Entfernen,
       Kopie, Löschen räumen auf; unlesbarer Preis/Klammer/leere Gruppe →
       Satz, nichts geschrieben; 0 Zeilen (RLS) → Satz, Gericht nicht
       geschrieben; frisch gelesen vor dem Schreiben (Gruppe eines anderen
       Geräts bleibt); vor dem Lesen gesperrt (§8.1m); Grenzen (6 je
       Gericht, 60 insgesamt); der Haus-Editor zeigt die Gruppen einzelner
       Gerichte nicht und lässt sie beim Übernehmen stehen.
   C · Naht: die vom Board geschriebenen Gruppen → Hub (Vorschlag steht
       vor) → Bestellung → ECHTE positionen_pruefen im lokalen Postgres:
       der Server rechnet denselben Betrag, ein gefälschter Betrag wird
       korrigiert, dasselbe Wort an einem anderen Gericht kostet dort SEIN
       Geld.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { oeffneHub } = require("./werkzeug/start-hub.js");

const OBEN = path.join(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const BETRIEB = "1635382f-f641-42ba-b26e-2542e16da974";

let n = 0, f = 0;
function pruef(b, t, d){ n++; if(!b) f++; console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : "")); }

/* ── Das Hub-Gericht, an dem alles hängt ───────────────────────── */
const BURGER_ID = "aaaaaaaa-1111-1111-1111-111111111111";
const PRAEFIX = "g-aaaaaaaa-";
const OPT_HUB = {
  [PRAEFIX + "beilage"]: { titel:"Beilage", art:"eine", pflicht:true,
    zeilen:[{ n:"Pommes", auf:0 }, { n:"Salat", auf:1.5, vor:true }, { n:"Suppe", auf:2.2 }] },
  [PRAEFIX + "extras"]: { titel:"Extras dazu", art:"mehrere",
    zeilen:[{ n:"Käse", auf:1 }, { n:"Speck", auf:1.5, vor:true }] },
};

async function hubAuf(browser, optionen, id, opt){
  const h = await oeffneHub(browser, { haus:"blend", optionen, hash:"#/speisekarte",
    zeilen: z => { z[0].name = "Burger"; z[0].id = id || BURGER_ID; z[0].opt = opt === undefined ? Object.keys(optionen || {}).join(",") : opt; return z; } });
  h.bestell = [];
  await h.p.route("**/rpc/bestellung_aufgeben", r => { h.bestell.push(JSON.parse(r.request().postData() || "{}"));
    r.fulfill({ status:200, contentType:"application/json", body:'"aaaaaaaa-bbbb-cccc-dddd-000000000001"' }); });
  await h.p.evaluate(() => { ZEITEN.length = 0; for(let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59"); });
  return h;
}
const zeilenText = p => p.evaluate(() => [...document.querySelectorAll("#warenkarte .ozeile")].map(e => ({
  n:decodeURIComponent(e.dataset.ozeile), an:e.classList.contains("an"), vor:!!e.querySelector(".ovor") })));
async function bestellen(h){
  await h.p.evaluate(() => { location.hash = "#/auswahl"; });
  await h.p.waitForTimeout(500);
  if(await h.p.$("#bTisch")) await h.p.fill("#bTisch", "7");
  const vorher = h.bestell.length;
  await h.p.click('[data-aktion="bestellen"]');
  await h.p.waitForFunction(k => k, h.bestell.length > vorher, { timeout:1500 }).catch(() => {});
  await h.p.waitForTimeout(900);
  return h.bestell[h.bestell.length - 1];
}

/* ── A · Hub ───────────────────────────────────────────────────── */
async function teilA(browser){
  console.log("\n══ A · Hub: der Vorschlag ══");
  let h = await hubAuf(browser, OPT_HUB);
  await h.p.evaluate(() => detailOeffnen("Burger"));
  await h.p.waitForTimeout(400);
  let z = await zeilenText(h.p);
  const wahl = k => z.filter(x => x.an).map(x => x.n).join(",");
  pruef(z.length === 5, "Voraussetzung: die Karte des Burgers zeigt beide Gruppen (5 Zeilen)", z.length);
  pruef(wahl() === "Salat,Speck", "ungetippt sind genau die Vorschläge gewählt (Salat statt der ersten Zeile „Pommes“)", wahl());
  pruef(z.filter(x => x.vor).map(x => x.n).join(",") === "Salat,Speck", "das Etikett „Vorschlag“ steht nur an den Vorschlägen", z.filter(x => x.vor).map(x => x.n).join(","));
  let w = await h.p.evaluate(() => ({ auf:optAufpreis("Burger"), text:optText("Burger") }));
  pruef(w.auf === 3 && w.text === "Salat · Speck", "Aufpreis und Bon-Text tragen den Vorschlag", JSON.stringify(w));
  /* Gast tippt Pommes (genau eine): der Vorschlag weicht, das Etikett dieser Gruppe auch */
  await h.p.click('#warenkarte [data-ozeile="Pommes"]'); await h.p.waitForTimeout(150);
  z = await zeilenText(h.p);
  pruef(wahl() === "Pommes,Speck", "Pommes angetippt: Salat weicht, der Vorschlag der anderen Gruppe bleibt", wahl());
  pruef(z.filter(x => x.vor).map(x => x.n).join(",") === "Speck", "das Etikett der angefassten Gruppe ist weg, das der unberührten bleibt");
  /* Gast nimmt Speck heraus: leer ist eine Wahl, der Vorschlag kommt nicht zurück */
  await h.p.click('#warenkarte [data-ozeile="Speck"]'); await h.p.waitForTimeout(150);
  z = await zeilenText(h.p);
  w = await h.p.evaluate(() => ({ auf:optAufpreis("Burger"), text:optText("Burger") }));
  pruef(wahl() === "Pommes" && w.auf === 0 && w.text === "Pommes", "Speck abgewählt: bleibt aus (kein Wiederauferstehen), Aufpreis 0", JSON.stringify(w));
  /* Neuladen behält die Wahl des Gastes */
  await h.p.click('#warenkarte [data-wmerk]'); await h.p.waitForTimeout(200);
  await h.p.reload(); await h.p.waitForTimeout(1300);
  await h.p.evaluate(() => { ZEITEN.length = 0; for(let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59"); });
  w = await h.p.evaluate(() => ({ auf:optAufpreis("Burger"), text:optText("Burger"), da:!!merk["Burger"] }));
  pruef(w.da && w.text === "Pommes" && w.auf === 0, "Neuladen: Gericht UND die Wahl des Gastes (nicht der Vorschlag) stehen im Korb", JSON.stringify(w));
  pruef(!h.fehler.length, "Hub: keine Seitenfehler", h.fehler.join(" | ") || "–");
  await h.ctx.close();

  /* ungetippt in den Korb und bestellen: der Vorschlag geht an die Küche, mit Preis */
  h = await hubAuf(browser, OPT_HUB);
  await h.p.evaluate(() => detailOeffnen("Burger")); await h.p.waitForTimeout(400);
  await h.p.click('#warenkarte [data-wmerk]'); await h.p.waitForTimeout(200);
  const grund = await h.p.evaluate(() => preisNum(korbPreis(findeGericht("Burger"))));
  await h.p.reload(); await h.p.waitForTimeout(1300);
  await h.p.evaluate(() => { ZEITEN.length = 0; for(let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59"); });
  w = await h.p.evaluate(() => ({ text:optText("Burger"), da:!!merk["Burger"] }));
  pruef(w.da && w.text === "Salat · Speck", "ungetippt in den Korb, Neuladen: der Vorschlag steht noch da", w.text);
  const b = await bestellen(h);
  const pos = b && b.p_positionen && b.p_positionen[0];
  pruef(pos && pos.name === "Burger (Salat · Speck)" && Math.abs(pos.preis - (grund + 3)) < 0.005,
    "Bestellung: Name trägt den Vorschlag, Preis = Gericht + 3,00", pos && (pos.name + " " + pos.preis + " (Gericht " + grund + ")"));
  h.letzte = b;
  await h.ctx.close();

  /* kein Vorschlag → wie vorher: „genau eine“ + Pflicht = erste Zeile, „mehrere“ = nichts */
  h = await hubAuf(browser, {
    [PRAEFIX + "beilage"]: { titel:"Beilage", art:"eine", pflicht:true, zeilen:[{ n:"Pommes", auf:0 }, { n:"Salat", auf:1.5 }] },
    [PRAEFIX + "extras"]: { titel:"Extras dazu", art:"mehrere", zeilen:[{ n:"Käse", auf:1 }] } });
  await h.p.evaluate(() => detailOeffnen("Burger")); await h.p.waitForTimeout(400);
  z = await zeilenText(h.p);
  pruef(wahl() === "Pommes" && !z.some(x => x.vor), "ohne Vorschlag: wie bisher (Pflicht → erste Zeile), kein Etikett", wahl());
  await h.ctx.close();

  /* „vor“ muss ein echtes true sein: Text und Zahl zählen nicht */
  h = await hubAuf(browser, {
    [PRAEFIX + "extras"]: { titel:"Extras dazu", art:"mehrere", zeilen:[{ n:"Käse", auf:1, vor:"true" }, { n:"Speck", auf:1.5, vor:1 }, { n:"Ei", auf:1, vor:true }] } });
  await h.p.evaluate(() => detailOeffnen("Burger")); await h.p.waitForTimeout(400);
  z = await zeilenText(h.p);
  pruef(wahl() === "Ei", "„vor“ als Text oder Zahl wählt nichts vor — nur ein echtes true", wahl());
  await h.ctx.close();

  /* „genau eine“ mit zwei Vorschlägen (so aus der Datenbank): höchstens EIN Vorschlag */
  h = await hubAuf(browser, {
    [PRAEFIX + "beilage"]: { titel:"Beilage", art:"eine", pflicht:false, zeilen:[{ n:"Pommes", auf:0, vor:true }, { n:"Salat", auf:1.5, vor:true }] } });
  await h.p.evaluate(() => detailOeffnen("Burger")); await h.p.waitForTimeout(400);
  z = await zeilenText(h.p);
  pruef(wahl() === "Pommes", "„genau eine“ mit zwei Vorschlägen: nur der erste ist gewählt", wahl());
  await h.ctx.close();
  return h;
}

/* ── B · Board ─────────────────────────────────────────────────── */
async function boardAuf(browser, optionen, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport:{ width:opt.breite || 430, height:900 } });
  const p = await ctx.newPage();
  const fehler = []; p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => { const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    return r.fulfill({ status:200, contentType:"application/json", headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" }); });
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(600);
  await p.evaluate(([id, optionen, verzoegert]) => {
    /* Die Gegenstelle HÄLT Zustand: ein Schreiben an betriebe.optionen ändert, was der nächste Lesezugriff liefert —
       sonst sähe der Lesezugriff vor dem Schreiben nie den Stand eines anderen Geräts. */
    window.__schreib = []; window.__lese = 0;
    window.__zustand = { optionen: optionen ? JSON.parse(JSON.stringify(optionen)) : null, rls0:false, schreibFehler:false };
    function antwort(z){
      if(z.op !== "select"){
        window.__schreib.push({ tab:z.tab, op:z.op, daten:JSON.parse(JSON.stringify(z.daten || null)), spalten:z.spalten });
        if(z.tab === "betriebe" && z.op === "update" && z.daten && "optionen" in z.daten){
          if(window.__zustand.schreibFehler) return { data:null, error:{ message:"boom", code:"XX000" } };
          if(window.__zustand.rls0) return { data:[], error:null };
          window.__zustand.optionen = z.daten.optionen;
          return { data:[{ id }], error:null };
        }
        if(z.tab === "gerichte" && z.op === "insert") return { data:Object.assign({}, z.daten, { id:z.daten.id || "neu-1" }), error:null };
        return { data:z.op === "update" ? [{ id:"x" }] : null, error:null };
      }
      if(z.tab === "betrieb_mitglieder") return { data:[{ rolle:"inhaber", betriebe:{ id, slug:"piugusto", name:"Più Gusto", hub_stil:{}, hub_texte:{} } }], error:null };
      /* Jede Antwort ist eine KOPIE: Ein geteiltes Objekt ließe Änderungen „des anderen Geräts“ auch im Speicher des Boards
         erscheinen — der Gegenbeweis „ohne frisches Lesen“ blieb damit grün (§8.1g). */
      if(z.tab === "betriebe" && z.einzeln){ window.__lese++; return { data:{ optionen:JSON.parse(JSON.stringify(window.__zustand.optionen)) }, error:null }; }
      return { data: z.einzeln ? null : [], error:null };
    }
    function kette(tab){
      const z = { tab, op:"select", daten:null, einzeln:false, spalten:null };
      const p = new Proxy(function(){}, { get(_, k){
        if(k === "then") return res => { const a = antwort(z);
          if(verzoegert && z.tab === "betriebe" && z.einzeln && z.op === "select" && !window.__lese0) setTimeout(() => res(a), verzoegert); else res(a); };
        return (...a) => { if(["update","insert","upsert","delete"].includes(k)){ z.op = k; z.daten = a[0]; }
          if(k === "select" && a.length) z.spalten = a[0];
          if(k === "maybeSingle" || k === "single") z.einzeln = true; return p; }; }, apply(){ return p; } });
      return p;
    }
    db = { from:kette, rpc:() => kette("rpc"), channel:() => kette("kanal"), removeChannel:async () => {},
      storage:{ from:() => ({ upload:async () => ({ error:null }), getPublicUrl:() => ({ data:{ publicUrl:"" } }) }) },
      functions:{ invoke:async () => ({ data:null, error:null }) },
      auth:{ getSession:async () => ({ data:{ session:null } }), getUser:async () => ({ data:{ user:{ id:"u1" } } }),
             onAuthStateChange:() => ({ data:{ subscription:{ unsubscribe(){} } } }) } };
    demo = false;
  }, [BETRIEB, optionen, opt.verzoegert || 0]);
  await p.evaluate(async id => { document.getElementById("tor").hidden = true;
    try{ localStorage.setItem(merkSchluessel(), id); }catch(e){}
    await betriebWaehlen(); }, BETRIEB);
  if(!opt.verzoegert){ await p.waitForFunction(() => typeof eoGelesen !== "undefined" && eoGelesen !== undefined, null, { timeout:4000 }).catch(() => {}); }
  await p.evaluate(() => { const s = document.getElementById("scharf"); if(s) s.hidden = true; });
  return { ctx, p, fehler };
}
const SCHREIB = (p, tab, op, nur) => p.evaluate(([tab, op, nur]) => window.__schreib.filter(w => w.tab === tab && w.op === op && (!nur || (w.daten && nur in w.daten))), [tab, op, nur || null]);
const ALLE = p => p.evaluate(() => window.__schreib.map(w => w.tab + "." + w.op));
const eingeben = (p, sel, wert, nr) => p.evaluate(([sel, wert, nr]) => { const fs_ = document.querySelectorAll(sel);
  const e = nr == null ? fs_[fs_.length - 1] : fs_[nr]; e.value = wert; e.dispatchEvent(new Event("input", { bubbles:true })); }, [sel, wert, nr == null ? null : nr]);
const melde = p => p.evaluate(() => { const m = document.getElementById("meldung"); return m.hidden ? "" : m.textContent; });
const OPT_BOARD_START = {
  "belag-kaese": { titel:"Käse extra", art:"mehrere", zeilen:[{ n:"Burrata", auf:3.5 }, { n:"Mozzarella", auf:2 }] },
  "g-cccccccc-beilage": { titel:"Beilage", art:"eine", pflicht:true, zeilen:[{ n:"Reis", auf:1 }, { n:"Nudeln", auf:1.2, vor:true }] },
};
const NEUES_GERICHT = (p, name) => p.evaluate(name => { blattOeffnen(null); mehrAufZu(true);
  document.getElementById("fName").value = name; document.getElementById("fKat").value = "Hauptgerichte"; katWertAktualisieren();
  document.getElementById("fPreis").value = "10,90"; }, name);
const KLICK = (p, sel) => p.evaluate(sel => document.querySelector(sel).click(), sel);

async function teilB(browser){
  console.log("\n══ B · Board: Beilagen & Extras im Gericht-Blatt ══");
  let { ctx, p, fehler } = await boardAuf(browser, OPT_BOARD_START);

  /* B1 · Aufbau */
  await NEUES_GERICHT(p, "Burger");
  await p.waitForTimeout(250);
  const auf = await p.evaluate(() => { const b = document.getElementById("egBlock"), r = id => document.getElementById(id).getBoundingClientRect();
    return { da:!!b, inMehr:!!b && !!b.closest("#mehrKlapp"), karten:document.querySelectorAll("#egListe .eo-karte").length,
      h1:r("egNeu").height, h2:r("egNeuBeilage").height, haus:document.querySelectorAll("#eoListe .eo-karte").length }; });
  pruef(auf.da && auf.inMehr && auf.karten === 0, "Gericht-Blatt: Block „Beilagen & Extras dieses Gerichts“ unter „Mehr Angaben“, anfangs leer", JSON.stringify(auf));
  pruef(auf.h1 >= 44 && auf.h2 >= 44, "beide Anlegen-Knöpfe ≥ 44 px", Math.round(auf.h1) + "/" + Math.round(auf.h2));
  pruef(auf.haus === 2 || auf.haus === 1, "Voraussetzung: der Haus-Editor zeigt NUR die gemeinsame Gruppe (nicht „g-cccccccc-…“)", auf.haus);

  /* B2 · anlegen und ausfüllen — mit echten Tipps */
  await p.click("#egNeuBeilage"); await p.waitForTimeout(100);
  let karte = await p.evaluate(() => { const k = document.querySelector("#egListe .eo-karte");
    return { titel:k.querySelector('[data-eo-feld="titel"]').value, art:k.querySelector('[data-eo-feld="art"]').value,
      fokus:document.activeElement && document.activeElement.dataset.eoZfeld }; });
  pruef(karte.titel === "Beilage" && karte.art === "eine" && karte.fokus === "n", "„+ Beilage“: Titel „Beilage“, genau eine, der Cursor steht im ersten Zutatennamen", JSON.stringify(karte));
  await eingeben(p, '#egListe [data-eo-zfeld="n"]', "Pommes");
  await p.click('#egListe [data-eo-zneu]'); await eingeben(p, '#egListe [data-eo-zfeld="n"]', "Salat"); await eingeben(p, '#egListe [data-eo-zfeld="auf"]', "1,50");
  await p.click('#egListe [data-eo-zneu]'); await eingeben(p, '#egListe [data-eo-zfeld="n"]', "Suppe"); await eingeben(p, '#egListe [data-eo-zfeld="auf"]', "2,2");
  await eingeben(p, '#egListe [data-eo-feld="titel"]', "Beilage zur Wahl", 0);
  /* Vorschlag: Salat, dann Suppe — bei „genau eine“ zieht der Vorschlag um */
  await p.click('#egListe [data-eo-zvor="1"]'); await p.waitForTimeout(80);
  let vor = await p.evaluate(() => [...document.querySelectorAll("#egListe [data-eo-zvor]")].map(b => b.getAttribute("aria-pressed")).join(","));
  pruef(vor === "false,true,false", "Vorschlag auf Salat gesetzt", vor);
  await p.click('#egListe [data-eo-zvor="2"]'); await p.waitForTimeout(80);
  vor = await p.evaluate(() => [...document.querySelectorAll("#egListe [data-eo-zvor]")].map(b => b.getAttribute("aria-pressed")).join(","));
  pruef(vor === "false,false,true", "„genau eine“: der zweite Vorschlag nimmt den ersten heraus (nur einer)", vor);
  await p.click('#egListe [data-eo-zvor="1"]'); await p.waitForTimeout(80);
  const fokusVor = await p.evaluate(() => document.activeElement && document.activeElement.dataset.eoZvor);
  pruef(fokusVor === "1", "nach dem Tipp bleibt der Fokus auf dem Vorschlag-Knopf (Neuaufbau verliert ihn nicht)", fokusVor);
  /* Extras (mehrere): zwei Vorschläge dürfen sein */
  await p.click("#egNeu"); await p.waitForTimeout(100);
  await eingeben(p, '#egListe .eo-karte:nth-of-type(2) [data-eo-zfeld="n"]', "Käse");
  await p.evaluate(() => { const k = document.querySelectorAll("#egListe .eo-karte")[1];
    const e = k.querySelector('[data-eo-zfeld="auf"]'); e.value = "1"; e.dispatchEvent(new Event("input", { bubbles:true })); });
  await p.evaluate(() => { document.querySelectorAll("#egListe .eo-karte")[1].querySelector("[data-eo-zneu]").click(); });
  await p.evaluate(() => { const k = document.querySelectorAll("#egListe .eo-karte")[1], zs = k.querySelectorAll('[data-eo-zfeld="n"]');
    const e = zs[zs.length - 1]; e.value = "Speck"; e.dispatchEvent(new Event("input", { bubbles:true }));
    const a = k.querySelectorAll('[data-eo-zfeld="auf"]'); const q = a[a.length - 1]; q.value = "1,5"; q.dispatchEvent(new Event("input", { bubbles:true })); });
  /* jeder Tipp baut die Karte neu auf: den Knopf jedes Mal frisch suchen */
  for(const j of [0, 1]) await p.evaluate(j => document.querySelectorAll("#egListe .eo-karte")[1].querySelectorAll("[data-eo-zvor]")[j].click(), j);
  await p.waitForTimeout(80);
  vor = await p.evaluate(() => [...document.querySelectorAll("#egListe .eo-karte")[1].querySelectorAll("[data-eo-zvor]")].map(b => b.getAttribute("aria-pressed")).join(","));
  pruef(vor === "true,true", "„mehrere“: beide Zutaten dürfen Vorschlag sein", vor);
  const stand = await p.evaluate(() => document.getElementById("mehrStand").textContent);
  pruef(/2 Extra-Gruppen/.test(stand), "die Zeile „Mehr Angaben“ nennt die Gruppen", stand);

  /* B3 · Speichern: Reihenfolge, id vorab, Schlüssel, Inhalt, Fremdes bleibt */
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(500);
  const reihenfolge = await ALLE(p);
  const iOpt = reihenfolge.indexOf("betriebe.update"), iGer = reihenfolge.indexOf("gerichte.insert");
  pruef(iOpt > -1 && iGer > iOpt, "ERST die Gruppen (betriebe.optionen), DANN das Gericht (gerichte.insert)", reihenfolge.join(" → "));
  const ins = (await SCHREIB(p, "gerichte", "insert"))[0];
  const optW = (await SCHREIB(p, "betriebe", "update", "optionen"))[0];
  const id = ins && ins.daten.id;
  const pre = id ? "g-" + id.replace(/-/g, "").slice(0, 8) + "-" : "";
  pruef(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id || ""), "das neue Gericht bekommt seine id VOR dem Schreiben (die Schlüssel brauchen sie)", id);
  const eigeneKeys = optW ? Object.keys(optW.daten.optionen).filter(k => k.indexOf(pre) === 0) : [];
  pruef(eigeneKeys.length === 2 && eigeneKeys.every(k => /^g-[0-9a-f]{8}-[a-z0-9-]{1,13}$/.test(k) && k.length <= 24),
    "zwei Schlüssel unter g-<id>-…, jeder ≤ 24 Zeichen", eigeneKeys.join(" "));
  pruef(ins && ins.daten.opt === eigeneKeys.join(","), "gerichte.opt nennt genau diese zwei Schlüssel", ins && ins.daten.opt);
  const bg = optW && optW.daten.optionen[eigeneKeys[0]], eg = optW && optW.daten.optionen[eigeneKeys[1]];
  pruef(bg && bg.titel === "Beilage zur Wahl" && bg.art === "eine" && bg.pflicht === true &&
        JSON.stringify(bg.zeilen) === JSON.stringify([{ n:"Pommes", auf:0 }, { n:"Salat", auf:1.5, vor:true }, { n:"Suppe", auf:2.2 }]),
    "Beilage: Titel, genau eine, Pflicht (wegen Vorschlag), Zutaten mit Preis als Zahl, Vorschlag nur am Salat", JSON.stringify(bg));
  pruef(eg && eg.titel === "Extras" && eg.art === "mehrere" && eg.zeilen.length === 2 && eg.zeilen.every(z => z.vor === true) &&
        eg.zeilen[1].auf === 1.5, "Extras: zwei Zutaten, beide Vorschlag, 1,50 als Zahl", JSON.stringify(eg));
  pruef(optW.daten.optionen["belag-kaese"] && optW.daten.optionen["g-cccccccc-beilage"],
    "die gemeinsame Gruppe und die Gruppe eines ANDEREN Gerichts bleiben stehen", Object.keys(optW.daten.optionen).join(" "));
  const haus = await p.evaluate(() => ({ karten:document.querySelectorAll("#eoListe .eo-karte").length, zu:document.getElementById("eoSichern").disabled }));
  pruef(haus.karten === 1 && haus.zu, "der Haus-Editor zeigt weiter nur die gemeinsame Gruppe, „Übernehmen“ zu", JSON.stringify(haus));
  const nach = JSON.parse(JSON.stringify(optW.daten.optionen));
  global.__BOARD_OPT = nach; global.__BOARD_ID = id; global.__BOARD_KEYS = eigeneKeys;

  /* B4 · bestehendes Gericht öffnen: Editor zeigt den Stand; Preis ändern behält die Schlüssel */
  await p.evaluate(([id, keys]) => { const g = { id, name:"Burger", kategorie:"Hauptgerichte", preis:10.9, karte:"speisekarte", verfuegbar:true, opt:keys.join(",") + ",kaeserand" };
    gerichte.push(g); window.__g = g; blattOeffnen(g); mehrAufZu(true); }, [id, eigeneKeys]);
  await p.waitForTimeout(250);
  const gelesen = await p.evaluate(() => [...document.querySelectorAll("#egListe .eo-karte")].map(k => ({ t:k.querySelector('[data-eo-feld="titel"]').value,
    z:[...k.querySelectorAll('[data-eo-z]')].map(z => z.querySelector('[data-eo-zfeld="n"]').value + "=" + z.querySelector('[data-eo-zfeld="auf"]').value +
       (z.querySelector("[data-eo-zvor]").getAttribute("aria-pressed") === "true" ? "*" : "")).join("|") })));
  pruef(gelesen.length === 2 && gelesen[0].z === "Pommes=0,00|Salat=1,50*|Suppe=2,20" && gelesen[1].z === "Käse=1,00*|Speck=1,50*",
    "Öffnen zeigt den gespeicherten Stand (Preise mit Komma, Vorschläge markiert)", JSON.stringify(gelesen));
  const chips = await p.evaluate(() => [...document.querySelectorAll("#fOpt [data-opt-wahl]")].map(b => b.dataset.optWahl));
  pruef(chips.join(",") === "belag-kaese", "die Chips der gemeinsamen Gruppen zeigen KEINE Gruppen einzelner Gerichte", chips.join(","));
  const vorher = (await ALLE(p)).length;
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(400);
  const rest = (await ALLE(p)).slice(vorher);
  const upG0 = (await SCHREIB(p, "gerichte", "update")).pop();
  pruef(rest.join(",") === "gerichte.update", "UNBERÜHRT gespeichert: es wird NICHT an betriebe.optionen geschrieben", rest.join(" → "));
  pruef(upG0 && upG0.daten.opt === eigeneKeys.join(",") + ",kaeserand", "…und gerichte.opt behält die eigenen UND die fremde Vorlagen-Gruppe", upG0 && upG0.daten.opt);

  await p.evaluate(g => { blattOeffnen(window.__g); mehrAufZu(true); }, null);
  await p.waitForTimeout(200);
  await eingeben(p, '#egListe [data-eo-zfeld="auf"]', "2,00", 1);
  const v2 = (await ALLE(p)).length;
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(500);
  const rest2 = (await ALLE(p)).slice(v2);
  const optW2 = (await SCHREIB(p, "betriebe", "update", "optionen")).pop();
  const upG = (await SCHREIB(p, "gerichte", "update")).pop();
  pruef(rest2.join(",") === "betriebe.update,gerichte.update", "Preis geändert: Gruppen zuerst, dann das Gericht", rest2.join(" → "));
  pruef(optW2.daten.optionen[eigeneKeys[0]].zeilen[1].auf === 2 && Object.keys(optW2.daten.optionen).length === Object.keys(nach).length &&
        eigeneKeys.every(k => k in optW2.daten.optionen), "neuer Preis, dieselben Schlüssel (gemerkte Wahlen der Gäste bleiben gültig), keine neue Gruppe", Object.keys(optW2.daten.optionen).join(" "));
  pruef(upG.daten.opt === eigeneKeys.join(",") + ",kaeserand", "gerichte.opt unverändert", upG.daten.opt);

  /* B5 · Fehleingaben: Satz, nichts geschrieben */
  const fehlerFaelle = [
    ["1,5O", null, /Zahl/, "unlesbarer Aufpreis „1,5O“"],
    [null, "Salat (halal)", /Klammern/, "Klammer im Namen"],
    [null, "Salat, scharf", /Komma|Klammern/, "Komma im Namen"],
  ];
  for(const [auf_, name_, muster, titel] of fehlerFaelle){
    await p.evaluate(() => { blattOeffnen(window.__g); mehrAufZu(true); }); await p.waitForTimeout(150);
    if(auf_) await eingeben(p, '#egListe [data-eo-zfeld="auf"]', auf_, 1);
    if(name_) await eingeben(p, '#egListe [data-eo-zfeld="n"]', name_, 1);
    const v = (await ALLE(p)).length;
    await p.evaluate(() => sichern(false)); await p.waitForTimeout(250);
    const rest_ = (await ALLE(p)).slice(v), m = await melde(p);
    pruef(muster.test(m) && !rest_.length, titel + " → Satz, nichts geschrieben (weder Gruppen noch Gericht)", m + " | " + rest_.join(","));
  }
  await p.evaluate(() => { blattOeffnen(window.__g); mehrAufZu(true); }); await p.waitForTimeout(150);
  await p.click("#egNeu"); await p.waitForTimeout(80);
  let v = (await ALLE(p)).length;
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(250);
  let m = await melde(p);
  pruef(/noch keine Zeile/.test(m) && (await ALLE(p)).length === v, "neue Gruppe ohne Zutat → „hat noch keine Zeile“, nichts geschrieben", m);
  /* sechs sind das Höchste */
  await p.evaluate(() => { blattOeffnen(window.__g); mehrAufZu(true); }); await p.waitForTimeout(150);
  for(let i = 0; i < 4; i++){ await p.click("#egNeu"); await p.waitForTimeout(40); }
  const sechs = await p.evaluate(() => ({ karten:document.querySelectorAll("#egListe .eo-karte").length, aus:document.getElementById("egNeu").disabled && document.getElementById("egNeuBeilage").disabled }));
  pruef(sechs.karten === 6 && sechs.aus, "höchstens 6 Gruppen je Gericht: beide Anlegen-Knöpfe gesperrt", JSON.stringify(sechs));
  /* zwei „genau eine“-Vorschläge (nur von Hand in den Zustand gesetzt): der Prüfer weist ab */
  const zwei = await p.evaluate(() => eoNachDb([{ k:"", titel:"X", art:"eine", pflicht:false, hinweis:"", zeilen:[{ n:"A", auf:"", vor:true }, { n:"B", auf:"", vor:true }] }]).fehler);
  pruef(/nur eine Zeile/.test(zwei || ""), "zwei Vorschläge bei „genau eine“ lehnt die Prüfung mit Satz ab", zwei);
  /* Schlüssel */
  const sch = await p.evaluate(() => { const pr = eoPraefix("deadbeef-0000-0000-0000-000000000000"); const b = [];
    const a = eoSchluessel("Extras", b, pr); b.push(a); const c = eoSchluessel("Extras", b, pr); b.push(c);
    const l = eoSchluessel("Beilagen und Extras zum Burger", b, pr);
    return { a, c, l, g:eoSchluessel("G-Punkt Extras", [], ""), ok:[a, c, l].every(k => eoEinzelKey(k) && k.length <= 24) }; });
  pruef(sch.a === "g-deadbeef-extras" && sch.c === "g-deadbeef-extras-2" && sch.ok, "Schlüssel: Namensgleiche bekommen -2, lange Titel werden gekürzt, alle passen in 24 Zeichen", JSON.stringify(sch));
  pruef(!/^g-/.test(sch.g), "eine GEMEINSAME Gruppe darf nie wie die Gruppe eines Gerichts heißen („G-Punkt“ → " + sch.g + ")");
  pruef(!fehler.length, "Board: keine Seitenfehler", fehler.join(" | ") || "–");
  await ctx.close();

  /* B4b · die Reihenfolge der Gruppen beim Gast ist die von gerichte.opt — nicht die der Spalte (jsonb ordnet nach Länge) */
  ({ ctx, p, fehler } = await boardAuf(browser, {
    "g-ffffffff-ab": { titel:"Zweite", art:"mehrere", zeilen:[{ n:"Ei", auf:1 }] },
    "g-ffffffff-zusatzlang": { titel:"Erste", art:"mehrere", zeilen:[{ n:"Käse", auf:1 }] } }));
  await p.evaluate(() => { const g = { id:"ffffffff-0000-0000-0000-000000000001", name:"Wrap", kategorie:"Hauptgerichte", preis:8, karte:"speisekarte", verfuegbar:true,
    opt:"g-ffffffff-zusatzlang,kaeserand,g-ffffffff-ab" }; gerichte.push(g); window.__g = g; blattOeffnen(g); mehrAufZu(true); });
  await p.waitForTimeout(250);
  const titel = await p.evaluate(() => [...document.querySelectorAll('#egListe [data-eo-feld="titel"]')].map(e => e.value).join(","));
  pruef(titel === "Erste,Zweite", "der Editor zeigt die Gruppen in der Reihenfolge, in der der Gast sie sieht (nicht in der der Spalte)", titel);
  await eingeben(p, '#egListe [data-eo-zfeld="auf"]', "1,20", 1);
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(500);
  const ord = (await SCHREIB(p, "gerichte", "update")).pop();
  pruef(ord && ord.daten.opt === "g-ffffffff-zusatzlang,kaeserand,g-ffffffff-ab", "Preis geändert: die Reihenfolge in gerichte.opt bleibt, wie sie war", ord && ord.daten.opt);
  await ctx.close();

  /* B6 · Entfernen, Kopie, Löschen */
  ({ ctx, p, fehler } = await boardAuf(browser, global.__BOARD_OPT));
  const G = () => p.evaluate(([id, keys]) => { const g = { id, name:"Burger", kategorie:"Hauptgerichte", preis:10.9, karte:"speisekarte", verfuegbar:true, opt:keys.join(",") };
    gerichte.push(g); window.__g = g; blattOeffnen(g); mehrAufZu(true); }, [global.__BOARD_ID, global.__BOARD_KEYS]);
  await G(); await p.waitForTimeout(250);
  await p.evaluate(() => sichern(true)); await p.waitForTimeout(500);
  const kopOpt = (await SCHREIB(p, "betriebe", "update", "optionen")).pop(), kopIns = (await SCHREIB(p, "gerichte", "insert")).pop();
  const kid = kopIns && kopIns.daten.id, kpre = kid ? "g-" + kid.replace(/-/g, "").slice(0, 8) + "-" : "";
  const neueKeys = kopOpt ? Object.keys(kopOpt.daten.optionen).filter(k => k.indexOf(kpre) === 0) : [];
  pruef(kid && kid !== global.__BOARD_ID && neueKeys.length === 2 && global.__BOARD_KEYS.every(k => k in kopOpt.daten.optionen),
    "Kopie: neue id, die Gruppen werden unter DER ID DER KOPIE neu angelegt, die des Originals bleiben", neueKeys.join(" "));
  pruef(kopIns && kopIns.daten.opt === neueKeys.join(",") && JSON.stringify(kopOpt.daten.optionen[neueKeys[0]].zeilen) === JSON.stringify(global.__BOARD_OPT[global.__BOARD_KEYS[0]].zeilen),
    "Kopie: opt zeigt auf die NEUEN Schlüssel, Zutaten und Preise wie das Original", kopIns && kopIns.daten.opt);
  /* Entfernen */
  await G(); await p.waitForTimeout(250);
  await p.click('#egListe [data-eo-weg]'); await p.waitForTimeout(80);
  await p.click('#egListe [data-eo-weg]'); await p.waitForTimeout(80);
  const leer = await p.evaluate(() => document.querySelectorAll("#egListe .eo-karte").length);
  v = (await ALLE(p)).length;
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(500);
  const entf = (await SCHREIB(p, "betriebe", "update", "optionen")).pop(), entfG = (await SCHREIB(p, "gerichte", "update")).pop();
  pruef(leer === 0 && entf && !global.__BOARD_KEYS.some(k => k in entf.daten.optionen) && "belag-kaese" in entf.daten.optionen && "g-cccccccc-beilage" in entf.daten.optionen,
    "beide Gruppen entfernt: sie fehlen in der Spalte, alles andere bleibt", entf && Object.keys(entf.daten.optionen).join(" "));
  pruef(entfG && !/g-aaaaaaaa|g-[0-9a-f]{8}-(beilage|extras)/.test(entfG.daten.opt || "") && entfG.daten.opt !== undefined,
    "gerichte.opt verliert die Schlüssel (kein Verweis ins Leere)", String(entfG && entfG.daten.opt));
  /* Löschen räumt auf */
  await boardGeschlossen(p);
  ({ ctx: ctx, p: p } = await neuBoard(ctx, browser, global.__BOARD_OPT));
  await G(); await p.waitForTimeout(250);
  await p.evaluate(() => { window.confirm = () => true; });
  await p.evaluate(() => document.getElementById("loeschen").onclick()); await p.waitForTimeout(500);
  const alles = await ALLE(p);
  const lo = (await SCHREIB(p, "betriebe", "update", "optionen")).pop();
  pruef(alles.indexOf("gerichte.delete") > -1 && lo && !global.__BOARD_KEYS.some(k => k in lo.daten.optionen) && "belag-kaese" in lo.daten.optionen,
    "Gericht löschen räumt seine Gruppen auf, die anderen bleiben", alles.join(" → "));
  await ctx.close();

  /* B7 · RLS meldet „0 Zeilen“ als Erfolg: Satz, das Gericht wird NICHT geschrieben (§2.3b) */
  ({ ctx, p, fehler } = await boardAuf(browser, OPT_BOARD_START));
  await NEUES_GERICHT(p, "Burger"); await p.click("#egNeu"); await eingeben(p, '#egListe [data-eo-zfeld="n"]', "Käse");
  await p.evaluate(() => { window.__zustand.rls0 = true; });
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(500);
  m = await melde(p);
  pruef(/Nur der Besitzer/.test(m) && !(await ALLE(p)).includes("gerichte.insert"), "0 Zeilen getroffen → „Nur der Besitzer …“, das Gericht wird nicht ohne seine Gruppen angelegt", m);
  await p.evaluate(() => { window.__zustand.rls0 = false; window.__zustand.schreibFehler = true; });
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(500);
  m = await melde(p);
  pruef(/Verbindung/.test(m) && !(await ALLE(p)).includes("gerichte.insert"), "Schreibfehler → Satz, das Gericht wird nicht angelegt", m);
  await ctx.close();

  /* B8 · die Gruppe eines anderen Geräts wird nicht überschrieben (frisch gelesen) */
  ({ ctx, p, fehler } = await boardAuf(browser, OPT_BOARD_START));
  await NEUES_GERICHT(p, "Burger"); await p.click("#egNeu"); await eingeben(p, '#egListe [data-eo-zfeld="n"]', "Käse");
  await p.evaluate(() => { window.__zustand.optionen["g-dddddddd-fremd"] = { titel:"Fremd", art:"mehrere", zeilen:[{ n:"Ei", auf:1 }] }; });
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(500);
  const fr = (await SCHREIB(p, "betriebe", "update", "optionen")).pop();
  pruef(fr && "g-dddddddd-fremd" in fr.daten.optionen, "Gruppe, die ein ANDERES Gerät inzwischen angelegt hat, bleibt beim Speichern erhalten", fr && Object.keys(fr.daten.optionen).join(" "));
  /* Haus-Editor: „Übernehmen“ behält die Gruppen der Gerichte, auch die frisch dazugekommenen */
  await p.evaluate(() => { window.__zustand.optionen["g-eeeeeeee-neu"] = { titel:"Neu", art:"mehrere", zeilen:[{ n:"Ei", auf:1 }] }; });
  await p.evaluate(() => tafelZeigen("startseite"));
  const ge = await p.evaluate(() => { document.getElementById("eoNeu").click();
    const t = document.querySelectorAll('#eoListe [data-eo-feld="titel"]'); const e = t[t.length - 1]; e.value = "Fleisch extra"; e.dispatchEvent(new Event("input", { bubbles:true }));
    const nn = document.querySelectorAll('#eoListe [data-eo-zfeld="n"]'); const q = nn[nn.length - 1]; q.value = "Salami"; q.dispatchEvent(new Event("input", { bubbles:true }));
    return !document.getElementById("eoSichern").disabled; });
  pruef(ge, "Voraussetzung: „Übernehmen“ im Haus-Editor ist nach einer Änderung offen");
  await p.evaluate(() => document.getElementById("eoSichern").click()); await p.waitForTimeout(500);
  const hu = (await SCHREIB(p, "betriebe", "update", "optionen")).pop();
  pruef(hu && "fleisch-extra" in hu.daten.optionen && "g-eeeeeeee-neu" in hu.daten.optionen && "g-dddddddd-fremd" in hu.daten.optionen,
    "Haus-Editor „Übernehmen“: neue gemeinsame Gruppe da, die Gruppen einzelner Gerichte (auch die frischen) bleiben", hu && Object.keys(hu.daten.optionen).join(" "));
  await ctx.close();

  /* B9 · vor dem Lesen gesperrt (§8.1m) */
  ({ ctx, p, fehler } = await boardAuf(browser, OPT_BOARD_START, { verzoegert:1200 }));
  await p.evaluate(() => { blattOeffnen(null); mehrAufZu(true); });
  await p.waitForTimeout(200);
  const frueh = await p.evaluate(() => ({ text:document.getElementById("egListe").textContent, aus:document.getElementById("egNeu").disabled && document.getElementById("egNeuBeilage").disabled }));
  pruef(/geladen/.test(frueh.text) && frueh.aus, "vor dem Lesen: „Wird geladen“, beide Anlegen-Knöpfe gesperrt (sonst ersetzte ein Tipp den Stand durch eine leere Liste)", JSON.stringify(frueh));
  await ctx.close();

  /* B10 · Grenzen: 60 Gruppen insgesamt */
  const viele = {}; for(let i = 0; i < 59; i++) viele["g-" + ("00000000" + i.toString(16)).slice(-8) + "-x"] = { titel:"X", art:"mehrere", zeilen:[{ n:"A", auf:0 }] };
  viele["belag-kaese"] = OPT_BOARD_START["belag-kaese"];
  ({ ctx, p, fehler } = await boardAuf(browser, viele));
  await NEUES_GERICHT(p, "Burger"); await p.click("#egNeu"); await eingeben(p, '#egListe [data-eo-zfeld="n"]', "Käse");
  await p.click("#egNeu"); await eingeben(p, '#egListe [data-eo-zfeld="n"]', "Ei");
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(400);
  m = await melde(p);
  pruef(/60 Gruppen/.test(m) && !(await ALLE(p)).length, "mehr als 60 Gruppen zusammen → Satz mit der Grenze, nichts geschrieben", m);
  await ctx.close();

  /* B11 · Bedienung: Maße, Lesbarkeit */
  await bedienung(browser);
}
async function boardGeschlossen(p){ await p.evaluate(() => { try{ blattSchliessen(); }catch(e){} }); }
async function neuBoard(ctxAlt, browser, opt){ await ctxAlt.close(); const b = await boardAuf(browser, opt); return { ctx:b.ctx, p:b.p }; }

function lum(c){ const v = c.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; }
async function bedienung(browser){
  for(const breite of [360, 430, 1280]){
    const { ctx, p, fehler } = await boardAuf(browser, global.__BOARD_OPT, { breite });
    await p.evaluate(([id, keys]) => { const g = { id, name:"Burger", kategorie:"Hauptgerichte", preis:10.9, karte:"speisekarte", verfuegbar:true, opt:keys.join(",") };
      gerichte.push(g); blattOeffnen(g); mehrAufZu(true); }, [global.__BOARD_ID, global.__BOARD_KEYS]);
    await p.waitForTimeout(400);
    const mass = await p.evaluate(() => { const b = document.getElementById("egBlock"), r = b.getBoundingClientRect(), sheet = b.closest("#blatt") || document.body;
      const klein = [...b.querySelectorAll("button, input, select")].filter(e => e.getBoundingClientRect().width && (e.getBoundingClientRect().height < 43.5)).map(e => e.className + ":" + Math.round(e.getBoundingClientRect().height));
      const schrift = [...b.querySelectorAll("input, select")].filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).length;
      const ueberlauf = b.scrollWidth - b.clientWidth;
      const eigenerScroll = [b, ...b.querySelectorAll("*")].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1).length;
      const zeilen = [...b.querySelectorAll(".eo-zeile")].map(z => z.getBoundingClientRect()), karten = [...b.querySelectorAll(".eo-karte")].map(z => z.getBoundingClientRect());
      const raus = zeilen.filter(z => z.right > karten[0].right + 1 || z.left < karten[0].left - 1).length;
      return { klein, schrift, ueberlauf, eigenerScroll, raus, seite:document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    pruef(!mass.klein.length && !mass.schrift && mass.ueberlauf <= 0 && !mass.eigenerScroll && !mass.raus && mass.seite <= 0,
      breite + " px: Tapflächen ≥ 44 px, Felder 16 px, kein Überlauf, kein eigener Scrollbereich", JSON.stringify(mass));
    for(const hell of [false, true]){
      await p.evaluate(h => document.body.classList.toggle("hell", h), hell);
      const k = await p.evaluate(() => { const an = document.querySelector('#egBlock .eo-vor[aria-pressed="true"]'), aus = document.querySelector('#egBlock .eo-vor[aria-pressed="false"]');
        const paar = e => { const s = getComputedStyle(e); return [s.color, s.backgroundColor]; };
        const rgb = c => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        return { an:an && paar(an).map(rgb), aus:aus && paar(aus).map(rgb), grund:rgb(getComputedStyle(document.getElementById("egBlock").querySelector(".eo-karte")).backgroundColor) }; });
      if(k.an){
        const l1 = lum(k.an[0]), l2 = lum(k.an[1]), c1 = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
        pruef(c1 >= 4.5, breite + " px " + (hell ? "hell" : "dunkel") + ": gewählter „Vorschlag“-Knopf ≥ 4,5:1", c1.toFixed(2));
      }else pruef(false, "Voraussetzung: ein gewählter Vorschlag-Knopf ist da");
      if(breite !== 430) break;
    }
    if(breite === 430){
      const s = await p.evaluate(() => { const t = document.querySelector('#egBlock .eo-vor[aria-pressed="true"]'), u = document.querySelector('#egBlock .eo-vor[aria-pressed="false"]');
        return { an:t && t.textContent, aus:u && u.textContent, bg:[t && getComputedStyle(t).backgroundColor, u && getComputedStyle(u).backgroundColor] }; });
      pruef(s.an && /✓/.test(s.an) && s.aus && !/✓/.test(s.aus) && s.bg[0] !== s.bg[1], "gewählt ist nicht nur an der Farbe erkennbar (Haken im Knopf)", s.an + " / " + s.aus);
    }
    pruef(!fehler.length, breite + " px: keine Seitenfehler", fehler.join(" | ") || "–");
    await ctx.close();
  }
}

/* ── C · Naht: Board-Gruppen → Hub → Bestellung → ECHTE positionen_pruefen ──── */
const PSQL = ["-h", "/tmp", "-p", "5433", "-U", "postgres", "-X", "-q", "-A", "-t"];
const psql = (db, sql) => execFileSync("psql", PSQL.concat(["-d", db, "-v", "ON_ERROR_STOP=1", "-c", sql]), { encoding:"utf8" }).trim();
async function teilC(browser){
  console.log("\n══ C · Naht: Board → Hub → Bestellung → positionen_pruefen ══");
  const optionen = global.__BOARD_OPT, id = global.__BOARD_ID, keys = global.__BOARD_KEYS;
  if(!optionen || !id){ pruef(false, "Voraussetzung: Teil B hat Gruppen geschrieben, die hier weitergereicht werden"); return; }
  let db_ = process.env.EXTRAS_DB || "extras_naht";
  try{
    execFileSync("bash", [path.join(__dirname, "pruef-extras-lokal.sh")], { env:Object.assign({}, process.env, { DB:db_, NUR_AUFBAU:"1" }), cwd:OBEN, stdio:"pipe" });
  }catch(e){ pruef(false, "Voraussetzung: lokales Postgres mit den echten Funktionen aufgebaut", String(e.stderr || e.message).slice(0, 200)); return; }
  const BID = "b1b1b1b1-0000-0000-0000-000000000001";
  psql(db_, "insert into public.betriebe(id, optionen) values ('" + BID + "', $j$" + JSON.stringify(optionen) + "$j$::jsonb)");
  /* das Gericht so, wie das Board es geschrieben hat (id, opt) und ein zweites mit demselben Wort */
  const h = await hubAuf(browser, optionen, id, keys.join(","));
  const preis = await h.p.evaluate(() => preisNum(korbPreis(findeGericht("Burger"))));
  psql(db_, "insert into public.gerichte(id, betrieb_id, name, preis, opt) values ('" + id + "','" + BID + "','Burger'," + preis + ",'" + keys.join(",") + "')");
  psql(db_, "insert into public.gerichte(id, betrieb_id, name, preis, opt) values ('cccccccc-0000-0000-0000-000000000009','" + BID + "','Schnitzel',12,'g-cccccccc-beilage')");
  await h.p.evaluate(() => detailOeffnen("Burger")); await h.p.waitForTimeout(400);
  const z = await zeilenText(h.p);
  pruef(z.filter(x => x.an).map(x => x.n).join(",") === "Salat,Käse,Speck" || z.filter(x => x.an).map(x => x.n).sort().join(",") === "Käse,Salat,Speck",
    "der Hub zeigt, was das Board geschrieben hat: Vorschläge Salat, Käse, Speck gewählt", z.filter(x => x.an).map(x => x.n).join(","));
  await h.p.click('#warenkarte [data-wmerk]'); await h.p.waitForTimeout(200);
  const b = await bestellen(h);
  const pos = b && b.p_positionen && b.p_positionen[0];
  pruef(!!pos, "Voraussetzung: der Hub hat bestellt", pos && pos.name);
  if(pos){
    const erwartet = Math.round((preis + 1.5 + 1 + 1.5) * 100) / 100;
    pruef(Math.abs(pos.preis - erwartet) < 0.005, "der Hub rechnet Gericht + Vorschläge (" + erwartet.toFixed(2) + ")", pos.preis);
    const antw = (name, gast, menge) => psql(db_, "select (public.positionen_pruefen('" + BID + "'::uuid, jsonb_build_array(jsonb_build_object('name', $q$" + name + "$q$, 'preis', " + gast + ", 'menge', " + (menge || 1) + ")))->'positionen'->0->>'preis')");
    const s1 = Number(antw(pos.name, pos.preis));
    pruef(Math.abs(s1 - pos.preis) < 0.005, "ECHTE positionen_pruefen rechnet denselben Betrag wie der Hub (" + pos.name + ")", s1 + " vs " + pos.preis);
    const s2 = Number(antw(pos.name, 1));
    pruef(Math.abs(s2 - pos.preis) < 0.005, "ein gefälschter Betrag (1,00) wird auf den Serverbetrag gesetzt", s2);
    const s3 = Number(antw("Burger (Suppe)", 1));
    pruef(Math.abs(s3 - (preis + 2.2)) < 0.005, "Gast wählt Suppe statt Salat: Server rechnet SEINEN Preis (Gericht + 2,20)", s3);
    const s4 = Number(antw("Schnitzel (Reis)", 1));
    pruef(Math.abs(s4 - 13) < 0.005, "dasselbe Wort an einem ANDEREN Gericht kostet dort sein eigenes Geld (Schnitzel + 1,00)", s4);
    const s5 = Number(antw("Schnitzel (Salat)", 1));
    pruef(Math.abs(s5 - 12) < 0.005, "„Salat“ gehört dem Burger — am Schnitzel kostet es nichts extra", s5);
  }
  pruef(!h.fehler.length, "Hub: keine Seitenfehler", h.fehler.join(" | ") || "–");
  await h.ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try{
    await teilA(browser);
    await teilB(browser);
    await teilC(browser);
  }finally{ await browser.close(); }
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN." : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
