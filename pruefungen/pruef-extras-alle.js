/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Alle Beilagen & Extras bearbeitbar, „wie beim letzten Mal“ (03.11.)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-extras-alle.js
     (braucht dist/; Gegenbeweise mit ADMIN_DATEI= / HUB_DIST= / VORLAGE=)

   > Wunsch (03.11., Foto): „Es gibt bereits bestehende Extras und Beilagen …
   > ich kann diese aber nicht bearbeiten oder löschen … alle Beilagen
   > bearbeitbar … wenn man einmal eine Auswahl getroffen hat, werden
   > nochmal dieselben Beilagen vorgeschlagen, danach kann man hinzufügen
   > oder etwas abändern.“ Antworten: Vorschlag „beides“ (Board beim
   > nächsten Gericht UND beim Gast), geteilte Gruppe „gilt für alle, mit
   > Wahl“.

   N · Naht: der Block OPTIONEN-VORLAGE steht in Hub und Board Zeichen für
       Zeichen gleich (zweite Quelle für das, was das Board zeigt).
   H · Haus-Editor: Gruppen der Vorlage, auf die Gerichte zeigen, stehen da
       (mit „an N Gerichten“), unbenutzte nicht; ohne Änderung „Übernehmen“
       zu; bearbeitet → genau dieser Schlüssel in betriebe.optionen,
       unveränderte Vorlagen-Gruppen werden NICHT kopiert, Fremdes bleibt;
       Entfernen erst beim zweiten Tipp, dann zuerst die Verweise an den
       Gerichten (jede Zeile gezählt), dann die Spalte; 0 Zeilen → Satz,
       Spalte unangetastet.
   G · Gericht-Blatt: EINE Liste in der Reihenfolge des Gastes (geteilte,
       Vorlage, eigene); geteilt bearbeitet → betriebe.optionen unter dem
       Schlüssel, opt unverändert; „Nur für dieses Gericht ändern“ → Kopie
       an derselben Stelle, die geteilte Gruppe bleibt; „Entfernen“ nur an
       diesem Gericht; „dazunehmen“; frisch gelesen vor dem Schreiben.
   V · Vorschlag vom letzten Gericht: neues Gericht startet mit dessen
       Gruppen (eigene als neue Kopie unter neuem Schlüssel), Band mit
       „Leeren“; Leeren → keine Gruppen.
   M · Maße: 360/1280 px kein Überlauf, Knöpfe ≥ 44 px, Felder 16 px,
       neue Sätze ≥ 4,5:1 hell und dunkel.
   K · Hub: bezahlter Vorschlag nicht vorgewählt („Empfohlen“), freier
       schon; nach einer Bestellung sind die FREIEN Zeilen von damals
       vorgewählt (mit Satz), die bezahlten nicht; der Chip nennt den
       Betrag und setzt alles; Sätze in elf Sprachen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { oeffneHub } = require("./werkzeug/start-hub.js");
const { schlechtester } = require("./werkzeug/messen.js");
const { gruppeZu } = require("./werkzeug/zentrale.js");
const hausOeffnen = async p => { await p.evaluate(() => tafelZeigen("startseite")); await p.waitForTimeout(200); await gruppeZu(p, "#eoGruppe"); };

const OBEN = path.join(__dirname, "..");
const ADMIN = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");
const VORLAGE = process.env.VORLAGE || path.join(OBEN, "vorlagen", "hub.vorlage.html");
const BETRIEB = "1635382f-f641-42ba-b26e-2542e16da974";

let n = 0, f = 0;
function pruef(b, t, d){ n++; if(!b) f++; console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + (typeof d === "string" ? d : JSON.stringify(d)) : "")); }

/* ── N · Naht ───────────────────────────────────────────────────── */
function block(datei){
  const s = fs.readFileSync(datei, "utf8");
  const a = s.indexOf("/* ══ OPTIONEN-VORLAGE ══"), b = s.indexOf("/* ══ Ende OPTIONEN-VORLAGE ══ */");
  return a < 0 || b < 0 ? null : s.slice(a, b);
}
function teilN(){
  console.log("\n══ N · Naht: OPTIONEN-VORLAGE ══");
  const h = block(VORLAGE), a = block(ADMIN);
  pruef(!!h && !!a, "der Block steht in beiden Dateien", { hub:!!h, board:!!a });
  pruef(!!h && h === a, "Hub und Board Zeichen für Zeichen gleich", h && a ? h.length + " / " + a.length : "–");
  pruef(!!h && /const OPT_VORLAGE = \{/.test(h) && /suess:/.test(h) && /sauce:/.test(h), "Voraussetzung: der Block trägt die Vorlagen-Gruppen (suess, sauce)");
}

/* ── Board mit gestellter Datenbank (hält Zustand, zählt Zeilen) ── */
async function boardAuf(browser, optionen, gerichte, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport:{ width:opt.breite || 430, height:900 } });
  const p = await ctx.newPage();
  const fehler = []; p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => { const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    return r.fulfill({ status:200, contentType:"application/json", headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" }); });
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(600);
  await p.evaluate(([id, optionen]) => {
    window.__schreib = []; window.__lese = 0;
    window.__zustand = { optionen: optionen ? JSON.parse(JSON.stringify(optionen)) : null, gerichteRls0:false };
    function antwort(z){
      if(z.op !== "select"){
        window.__schreib.push({ tab:z.tab, op:z.op, daten:JSON.parse(JSON.stringify(z.daten || null)), eq:z.eq.slice(), spalten:z.spalten });
        if(z.tab === "betriebe" && z.op === "update" && z.daten && "optionen" in z.daten){
          window.__zustand.optionen = z.daten.optionen; return { data:[{ id }], error:null }; }
        if(z.tab === "gerichte" && z.op === "update") return { data:window.__zustand.gerichteRls0 ? [] : [{ id:"x" }], error:null };
        if(z.tab === "gerichte" && z.op === "insert") return { data:Object.assign({}, z.daten, { id:z.daten.id || "neu-1" }), error:null };
        return { data:z.op === "update" ? [{ id:"x" }] : null, error:null };
      }
      if(z.tab === "betrieb_mitglieder") return { data:[{ rolle:"inhaber", betriebe:{ id, slug:"chocolamour", name:"Choco", hub_stil:{}, hub_texte:{} } }], error:null };
      if(z.tab === "betriebe" && z.einzeln){ window.__lese++; return { data:{ optionen:JSON.parse(JSON.stringify(window.__zustand.optionen)) }, error:null }; }
      return { data: z.einzeln ? null : [], error:null };
    }
    function kette(tab){
      const z = { tab, op:"select", daten:null, einzeln:false, spalten:null, eq:[] };
      const p = new Proxy(function(){}, { get(_, k){
        if(k === "then") return res => res(antwort(z));
        return (...a) => { if(["update","insert","upsert","delete"].includes(k)){ z.op = k; z.daten = a[0]; }
          if(k === "select" && a.length) z.spalten = a[0];
          if(k === "eq") z.eq.push(a[0] + "=" + a[1]);
          if(k === "maybeSingle" || k === "single") z.einzeln = true; return p; }; }, apply(){ return p; } });
      return p;
    }
    db = { from:kette, rpc:() => kette("rpc"), channel:() => kette("kanal"), removeChannel:async () => {},
      storage:{ from:() => ({ upload:async () => ({ error:null }), getPublicUrl:() => ({ data:{ publicUrl:"" } }) }) },
      functions:{ invoke:async () => ({ data:null, error:null }) },
      auth:{ getSession:async () => ({ data:{ session:null } }), getUser:async () => ({ data:{ user:{ id:"u1" } } }),
             onAuthStateChange:() => ({ data:{ subscription:{ unsubscribe(){} } } }) } };
    demo = false;
  }, [BETRIEB, optionen]);
  await p.evaluate(async id => { document.getElementById("tor").hidden = true;
    try{ localStorage.setItem(merkSchluessel(), id); }catch(e){}
    await betriebWaehlen(); }, BETRIEB);
  await p.waitForFunction(() => typeof eoGelesen !== "undefined" && eoGelesen !== undefined, null, { timeout:4000 }).catch(() => {});
  await p.evaluate(liste => { const s = document.getElementById("scharf"); if(s) s.hidden = true;
    gerichte = liste.map(g => Object.assign({ kategorie:"Crêpes", karte:"speisekarte", verfuegbar:true, preis:9.9 }, g));
    zeichneKarte(); }, gerichte || []);
  return { ctx, p, fehler };
}
const SCHREIB = (p, tab, op, nur) => p.evaluate(([tab, op, nur]) => window.__schreib.filter(w => w.tab === tab && w.op === op && (!nur || (w.daten && nur in w.daten))), [tab, op, nur || null]);
const ALLE = p => p.evaluate(() => window.__schreib.map(w => w.tab + "." + w.op));
const eingeben = (p, sel, wert, nr) => p.evaluate(([sel, wert, nr]) => { const fs_ = document.querySelectorAll(sel);
  const e = nr == null ? fs_[fs_.length - 1] : fs_[nr]; e.value = wert; e.dispatchEvent(new Event("input", { bubbles:true })); }, [sel, wert, nr == null ? null : nr]);
const melde = p => p.evaluate(() => { const m = document.getElementById("meldung"); return m.hidden ? "" : m.textContent; });
const hausKarten = p => p.evaluate(() => [...document.querySelectorAll("#eoListe .eo-karte")].map(k => ({
  t:k.querySelector('[data-eo-feld="titel"]').value, kopf:(k.querySelector(".eo-herkunft") || {}).textContent || "" })));
const blattKarten = p => p.evaluate(() => [...document.querySelectorAll("#egListe .eo-karte")].map(k => ({
  t:k.querySelector('[data-eo-feld="titel"]').value, kopf:(k.querySelector(".eg-geteilt") || {}).textContent || "",
  nurhier:!!k.querySelector("[data-eg-nurhier]") })));

const CREPE = { id:"aaaaaaaa-0000-0000-0000-000000000001", name:"Dubai Crêpe", opt:"suess,sauce" };
const WAFFEL = { id:"bbbbbbbb-0000-0000-0000-000000000002", name:"Waffel", opt:"sauce" };
const PANCAKE = { id:"cccccccc-0000-0000-0000-000000000003", name:"Pancake", opt:"g-cccccccc-topping,sauce" };
const OPT_START = {
  "g-cccccccc-topping": { titel:"Topping", art:"mehrere", zeilen:[{ n:"Ahorn", auf:1 }] },
  "fremd-geraet": { titel:"Von einem anderen Gerät", art:"mehrere", zeilen:[{ n:"X", auf:1 }] },
};

/* ── H · Haus-Editor ───────────────────────────────────────────── */
async function teilH(browser){
  console.log("\n══ H · Haus-Editor „Extras & Beläge“ zeigt die Vorlagen-Gruppen ══");
  let { ctx, p, fehler } = await boardAuf(browser, OPT_START, [CREPE, WAFFEL, PANCAKE]);
  await hausOeffnen(p);
  let k = await hausKarten(p);
  const titel = k.map(x => x.t);
  pruef(titel.includes("Make it extra sweet") && titel.includes("Favorite Sauce on top"), "die genutzten Vorlagen-Gruppen stehen da (vorher unsichtbar)", titel.join(" | "));
  pruef(!titel.includes("Milch wählen") && !titel.includes("Käserand"), "ungenutzte Vorlagen-Gruppen stehen NICHT da", titel.join(" | "));
  pruef(!titel.includes("Topping"), "die Gruppe eines einzelnen Gerichts steht nicht im Haus-Editor");
  const sauce = k.find(x => x.t === "Favorite Sauce on top"), suess = k.find(x => x.t === "Make it extra sweet");
  pruef(sauce && /Vorlage/.test(sauce.kopf) && /an 3 Gerichten/.test(sauce.kopf) && suess && /an 1 Gericht\b/.test(suess.kopf),
    "jede Gruppe sagt, woher sie kommt und an wie vielen Gerichten sie hängt", (sauce || {}).kopf + " / " + (suess || {}).kopf);
  pruef(await p.evaluate(() => document.getElementById("eoSichern").disabled), "ohne Änderung bleibt „Übernehmen“ zu (gelesener Stand = Entwurf)");

  /* bearbeiten: Preis der Sauce */
  const iS = titel.indexOf("Favorite Sauce on top");
  await p.evaluate(i => { const f = document.querySelectorAll('#eoListe [data-eo="' + i + '"] [data-eo-zfeld="auf"]')[0];
    f.value = "2,50"; f.dispatchEvent(new Event("input", { bubbles:true })); }, iS);
  pruef(!(await p.evaluate(() => document.getElementById("eoSichern").disabled)), "nach dem Tippen ist „Übernehmen“ offen");
  await p.click("#eoSichern"); await p.waitForTimeout(400);
  let w = (await SCHREIB(p, "betriebe", "update", "optionen")).pop();
  const o = w && w.daten.optionen;
  pruef(o && o.sauce && o.sauce.zeilen[0].auf === 2.5 && o.sauce.titel === "Favorite Sauce on top", "bearbeitet → unter IHREM Schlüssel „sauce“ in betriebe.optionen, mit dem neuen Preis", o && o.sauce);
  pruef(o && !("suess" in o), "die unveränderte Vorlagen-Gruppe „suess“ wird NICHT in die Datenbank kopiert", o && Object.keys(o).join(","));
  pruef(o && o["fremd-geraet"] && o["g-cccccccc-topping"], "die Gruppe eines anderen Geräts und die eines Gerichts bleiben stehen", o && Object.keys(o).join(","));
  pruef(!(await SCHREIB(p, "gerichte", "update")).length, "nur bearbeitet: kein Gericht wird geschrieben");
  k = await hausKarten(p);
  pruef(k.filter(x => x.t === "Favorite Sauce on top").length === 1 && !/Vorlage/.test(k.find(x => x.t === "Favorite Sauce on top").kopf),
    "danach steht die Sauce einmal da — jetzt als Gruppe des Hauses", k.map(x => x.t + ":" + x.kopf).join(" | "));

  /* entfernen: suess hängt an einem Gericht — erst beim zweiten Tipp */
  let iW = (await hausKarten(p)).findIndex(x => x.t === "Make it extra sweet");
  await p.click('#eoListe [data-eo="' + iW + '"] [data-eo-weg]'); await p.waitForTimeout(100);
  let stand = await p.evaluate(i => ({ da:!!document.querySelector('#eoListe [data-eo="' + i + '"]'), knopf:document.querySelector('#eoListe [data-eo="' + i + '"] [data-eo-weg]').textContent,
    satz:document.getElementById("eoSatz").textContent }), iW);
  pruef(stand.da && /Wirklich/.test(stand.knopf) && /1 Gericht/.test(stand.knopf) && /diesem Gericht/.test(stand.satz), "erster Tipp: nichts entfernt, der Knopf fragt nach und nennt die Zahl", stand);
  await p.click('#eoListe [data-eo="' + iW + '"] [data-eo-weg]'); await p.waitForTimeout(100);
  k = await hausKarten(p);
  pruef(!k.some(x => x.t === "Make it extra sweet"), "zweiter Tipp: die Gruppe ist aus dem Entwurf weg");
  const vor = (await ALLE(p)).length;
  await p.click("#eoSichern"); await p.waitForTimeout(500);
  const folge = (await ALLE(p)).slice(vor);
  const gU = (await SCHREIB(p, "gerichte", "update"));
  pruef(folge.join(",") === "gerichte.update,betriebe.update", "Speichern: ZUERST die Verweise am Gericht, DANN die Spalte", folge.join(" → "));
  pruef(gU.length === 1 && gU[0].daten.opt === "sauce" && gU[0].eq.includes("id=" + CREPE.id) && gU[0].eq.includes("betrieb_id=" + BETRIEB) &&
    gU[0].spalten === "id", "am Crêpe wird nur „suess“ aus opt genommen (Filter id + Betrieb, Zeilen gezählt mit select(id))", gU[0]);
  const lok = await p.evaluate(id => gerichte.find(g => g.id === id).opt, CREPE.id);
  pruef(lok === "sauce", "auch im Board steht das Gericht danach ohne die Gruppe", lok);
  pruef(!fehler.length, "keine Seitenfehler", fehler.join(" | ") || "–");
  await ctx.close();

  /* 0 Zeilen (RLS) beim Gericht → Satz, Spalte unangetastet */
  ({ ctx, p, fehler } = await boardAuf(browser, OPT_START, [CREPE, WAFFEL]));
  await p.evaluate(() => { window.__zustand.gerichteRls0 = true; });
  await hausOeffnen(p);
  iW = (await hausKarten(p)).findIndex(x => x.t === "Make it extra sweet");
  await p.click('#eoListe [data-eo="' + iW + '"] [data-eo-weg]'); await p.click('#eoListe [data-eo="' + iW + '"] [data-eo-weg]');
  await p.click("#eoSichern"); await p.waitForTimeout(400);
  const satz = await p.evaluate(() => document.getElementById("eoSatz").textContent);
  pruef(/nicht entfernt|Nur an/.test(satz) && !(await SCHREIB(p, "betriebe", "update", "optionen")).length,
    "Gericht trifft 0 Zeilen → Satz, betriebe.optionen wird NICHT geschrieben (§2.3b)", satz);
  await ctx.close();
}

/* ── G · Gericht-Blatt ─────────────────────────────────────────── */
async function teilG(browser){
  console.log("\n══ G · Gericht-Blatt: eine Liste, alles bearbeitbar ══");
  let { ctx, p, fehler } = await boardAuf(browser, OPT_START, [CREPE, WAFFEL, PANCAKE]);
  const oeffne = g => p.evaluate(id => { blattOeffnen(gerichte.find(x => x.id === id)); mehrAufZu(true); }, g.id);
  await oeffne(PANCAKE); await p.waitForTimeout(250);
  let k = await blattKarten(p);
  pruef(k.length === 2 && k[0].t === "Topping" && k[1].t === "Favorite Sauce on top", "die Liste steht in der Reihenfolge des Gastes: eigene, dann die Vorlagen-Gruppe", k.map(x => x.t).join(","));
  pruef(/Nur an diesem Gericht/.test(k[0].kopf) && !k[0].nurhier && /gilt für 3 Gerichte/.test(k[1].kopf) && k[1].nurhier,
    "eigene Gruppe „Nur an diesem Gericht“, geteilte „gilt für 3 Gerichte“ mit „Nur für dieses Gericht ändern“", k.map(x => x.kopf).join(" | "));
  const dazu = await p.evaluate(() => [...document.querySelectorAll("#egDazu [data-eg-dazu]")].map(b => b.dataset.egDazu));
  pruef(dazu.includes("suess") && dazu.includes("fremd-geraet") && !dazu.includes("sauce") && !dazu.some(x => /^g-/.test(x)),
    "„Vorhandene dazunehmen“: die übrigen geteilten Gruppen, nichts schon Angehängtes, keine eines Gerichts", dazu.join(","));

  /* geteilt bearbeiten → betriebe.optionen.sauce, opt bleibt */
  await p.evaluate(() => { window.__zustand.optionen["neu-anderes-geraet"] = { titel:"Neu woanders", art:"mehrere", zeilen:[{ n:"Y", auf:1 }] }; });
  await eingeben(p, '#egListe [data-eo="1"] [data-eo-zfeld="auf"]', "3,00", 0);
  let vor = (await ALLE(p)).length;
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(500);
  let folge = (await ALLE(p)).slice(vor);
  let w = (await SCHREIB(p, "betriebe", "update", "optionen")).pop(), g = (await SCHREIB(p, "gerichte", "update")).pop();
  pruef(folge.join(",") === "betriebe.update,gerichte.update", "geteilte Gruppe geändert: ERST betriebe.optionen, DANN das Gericht", folge.join(" → "));
  pruef(w && w.daten.optionen.sauce && w.daten.optionen.sauce.zeilen[0].auf === 3, "die Vorlagen-Gruppe steht jetzt mit dem neuen Preis unter „sauce“ — gilt für alle Gerichte", w && w.daten.optionen.sauce);
  pruef(w && w.daten.optionen["neu-anderes-geraet"] && w.daten.optionen["g-cccccccc-topping"], "frisch gelesen: die Gruppe eines anderen Geräts und die eigene bleiben", w && Object.keys(w.daten.optionen).join(","));
  pruef(g && g.daten.opt === PANCAKE.opt, "gerichte.opt bleibt, wie er war", g && g.daten.opt);
  await ctx.close();

  /* Nur für dieses Gericht ändern */
  ({ ctx, p, fehler } = await boardAuf(browser, OPT_START, [CREPE, WAFFEL, PANCAKE]));
  await p.evaluate(id => { blattOeffnen(gerichte.find(x => x.id === id)); mehrAufZu(true); }, CREPE.id); await p.waitForTimeout(250);
  k = await blattKarten(p);
  pruef(k.map(x => x.t).join(",") === "Make it extra sweet,Favorite Sauce on top", "Voraussetzung: Crêpe zeigt beide Vorlagen-Gruppen", k.map(x => x.t).join(","));
  await eingeben(p, '#egListe [data-eo="1"] [data-eo-zfeld="auf"]', "9,00", 0);   /* schon getippt — die Kopie nimmt es mit */
  await p.click('#egListe [data-eo="1"] [data-eg-nurhier]'); await p.waitForTimeout(100);
  k = await blattKarten(p);
  const fokus = await p.evaluate(() => document.activeElement && document.activeElement.dataset.eoFeld);
  pruef(k.length === 2 && /Nur an diesem Gericht/.test(k[1].kopf) && k[1].t === "Favorite Sauce on top" && fokus === "titel",
    "„Nur für dieses Gericht ändern“: an derselben Stelle eine eigene Kopie, Fokus im Titel", k.map(x => x.t + ":" + x.kopf).join(" | "));
  await eingeben(p, '#egListe [data-eo="1"] [data-eo-feld="titel"]', "Sauce nur für den Crêpe", 0);
  vor = (await ALLE(p)).length;
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(500);
  w = (await SCHREIB(p, "betriebe", "update", "optionen")).pop(); g = (await SCHREIB(p, "gerichte", "update")).pop();
  const opt = g ? g.daten.opt.split(",") : [];
  const eigenK = opt[1] || "";
  pruef(opt.length === 2 && opt[0] === "suess" && /^g-aaaaaaaa-/.test(eigenK), "opt: „suess“ bleibt vorn, an der Stelle der Sauce steht jetzt die eigene Kopie", g && g.daten.opt);
  pruef(w && w.daten.optionen[eigenK] && w.daten.optionen[eigenK].titel === "Sauce nur für den Crêpe" && w.daten.optionen[eigenK].zeilen[0].auf === 9,
    "die Kopie trägt Titel und den schon getippten Preis", w && w.daten.optionen[eigenK]);
  pruef(w && !("sauce" in w.daten.optionen), "die geteilte Gruppe „sauce“ wird NICHT geändert (die anderen Gerichte behalten sie)", w && Object.keys(w.daten.optionen).join(","));
  const andere = await p.evaluate(() => gerichte.filter(x => x.opt && x.opt.split(",").includes("sauce")).map(x => x.name));
  pruef(andere.includes("Waffel") && andere.includes("Pancake"), "Waffel und Pancake zeigen weiter auf „sauce“", andere.join(","));
  await ctx.close();

  /* Entfernen nur an diesem Gericht, dazunehmen */
  ({ ctx, p, fehler } = await boardAuf(browser, OPT_START, [CREPE, WAFFEL, PANCAKE]));
  await p.evaluate(id => { blattOeffnen(gerichte.find(x => x.id === id)); mehrAufZu(true); }, WAFFEL.id); await p.waitForTimeout(250);
  await p.click('#egListe [data-eo="0"] [data-eo-weg]'); await p.waitForTimeout(80);
  await p.click('#egDazu [data-eg-dazu="suess"]'); await p.waitForTimeout(80);
  k = await blattKarten(p);
  pruef(k.map(x => x.t).join(",") === "Make it extra sweet", "Sauce entfernt, „Make it extra sweet“ dazugenommen", k.map(x => x.t).join(","));
  vor = (await ALLE(p)).length;
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(500);
  folge = (await ALLE(p)).slice(vor);
  g = (await SCHREIB(p, "gerichte", "update")).pop();
  pruef(folge.join(",") === "gerichte.update" && g && g.daten.opt === "suess", "nur gerichte.opt ändert sich (suess) — betriebe.optionen bleibt unberührt", folge.join(",") + " / " + (g && g.daten.opt));
  pruef(!fehler.length, "keine Seitenfehler", fehler.join(" | ") || "–");
  await ctx.close();
}

/* ── V · Vorschlag vom letzten Gericht ─────────────────────────── */
async function teilV(browser){
  console.log("\n══ V · Neues Gericht: dieselben Beilagen wie beim letzten ══");
  let { ctx, p, fehler } = await boardAuf(browser, OPT_START, [CREPE, WAFFEL, PANCAKE]);
  /* Pancake bearbeiten und speichern → er ist das „letzte“ */
  await p.evaluate(id => { blattOeffnen(gerichte.find(x => x.id === id)); }, PANCAKE.id); await p.waitForTimeout(200);
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(400);
  await p.evaluate(() => { blattOeffnen(null); mehrAufZu(true);
    document.getElementById("fName").value = "Kaiserschmarrn"; document.getElementById("fKat").value = "Crêpes"; katWertAktualisieren();
    document.getElementById("fPreis").value = "8,50"; });
  await p.waitForTimeout(200);
  const band = await p.evaluate(() => ({ da:!document.getElementById("egVorschlag").hidden, text:document.getElementById("egVorschlagText").textContent,
    leeren:document.getElementById("egLeeren").getBoundingClientRect().height }));
  let k = await blattKarten(p);
  pruef(band.da && /Pancake/.test(band.text) && /Topping/.test(band.text) && /Favorite Sauce/.test(band.text) && band.leeren >= 44,
    "Band: „Vom zuletzt gespeicherten Gericht „Pancake“ übernommen: Topping, Favorite Sauce …“ mit „Leeren“ ≥ 44 px", band);
  pruef(k.map(x => x.t).join(",") === "Topping,Favorite Sauce on top" && /Nur an diesem/.test(k[0].kopf) && /gilt für/.test(k[1].kopf),
    "die Liste startet mit denselben Gruppen (eigene als Kopie, geteilte als Verweis)", k.map(x => x.t).join(","));
  await p.evaluate(() => sichern(false)); await p.waitForTimeout(500);
  const ins = (await SCHREIB(p, "gerichte", "insert")).pop(), w = (await SCHREIB(p, "betriebe", "update", "optionen")).pop();
  const opt = ins ? String(ins.daten.opt).split(",") : [];
  const neuPr = ins ? "g-" + String(ins.daten.id).replace(/-/g, "").slice(0, 8) + "-" : "?";
  pruef(opt.length === 2 && opt[0].indexOf(neuPr) === 0 && opt[1] === "sauce", "das neue Gericht: eigene Kopie unter SEINEM Schlüssel, dann „sauce“", ins && ins.daten.opt);
  pruef(w && w.daten.optionen[opt[0]] && w.daten.optionen[opt[0]].titel === "Topping" && w.daten.optionen["g-cccccccc-topping"],
    "die Kopie steht in betriebe.optionen, die des Pancakes bleibt", w && Object.keys(w.daten.optionen).join(","));

  /* „Speichern & nächstes“ schlägt wieder vor; „Leeren“ */
  await p.evaluate(() => { blattOeffnen(null); mehrAufZu(true); }); await p.waitForTimeout(200);
  const nochmal = await p.evaluate(() => !document.getElementById("egVorschlag").hidden && /Kaiserschmarrn/.test(document.getElementById("egVorschlagText").textContent));
  pruef(nochmal, "das nächste neue Gericht schlägt die Beilagen des gerade gespeicherten vor (Kaiserschmarrn)");
  await p.click("#egLeeren"); await p.waitForTimeout(80);
  k = await blattKarten(p);
  const nach = await p.evaluate(() => ({ band:document.getElementById("egVorschlag").hidden, satz:document.getElementById("egSatz").textContent }));
  pruef(!k.length && nach.band && /Geleert/.test(nach.satz), "„Leeren“: keine Gruppe mehr, Band weg, Satz", nach);
  await p.evaluate(() => { document.getElementById("fName").value = "Ohne"; document.getElementById("fKat").value = "Crêpes"; katWertAktualisieren(); sichern(false); });
  await p.waitForTimeout(400);
  const ins2 = (await SCHREIB(p, "gerichte", "insert")).pop();
  pruef(ins2 && ins2.daten.name === "Ohne" && !ins2.daten.opt, "geleert gespeichert: kein opt", ins2 && ins2.daten.opt);
  pruef(!fehler.length, "keine Seitenfehler", fehler.join(" | ") || "–");
  await ctx.close();

  /* vor dem Lesen gesperrt */
  const ctx2 = await browser.newContext({ viewport:{ width:430, height:900 } });
  const p2 = await ctx2.newPage();
  await p2.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await p2.goto("file://" + ADMIN); await p2.waitForTimeout(500);
  const gesperrt = await p2.evaluate(() => { eoGelesen = undefined; blattOeffnen(null);
    return { neu:document.getElementById("egNeu").disabled, text:document.getElementById("egListe").textContent }; });
  pruef(gesperrt.neu && /geladen/.test(gesperrt.text), "vor dem Lesen: „Wird geladen“, Anlegen gesperrt (§8.1m)", gesperrt);
  await ctx2.close();
}

/* ── M · Maße und Kontrast ─────────────────────────────────────── */
async function teilM(browser){
  console.log("\n══ M · Maße, Kontrast ══");
  for(const breite of [360, 1280]) for(const hell of [false, true]){
    const { ctx, p, fehler } = await boardAuf(browser, OPT_START, [CREPE, WAFFEL, PANCAKE], { breite });
    if(hell) await p.evaluate(() => document.body.classList.add("hell"));
    await p.evaluate(() => { blattOeffnen(null); mehrAufZu(true); });   /* zuerst ein neues: kein Vorschlag (nichts gespeichert) */
    await p.evaluate(id => { extrasLetztMerken(id); blattOeffnen(null); mehrAufZu(true); }, PANCAKE.id);
    await p.waitForTimeout(250);
    await p.evaluate(() => document.getElementById("egBlock").scrollIntoView({ block:"start" }));
    const m = await p.evaluate(() => {
      const b = document.getElementById("blatt"), knoepfe = [...document.querySelectorAll("#egBlock button")].filter(x => x.offsetParent);
      const felder = [...document.querySelectorAll("#egBlock input, #egBlock select")].filter(x => x.offsetParent);
      return { ueber:Math.max(0, document.documentElement.scrollWidth - innerWidth),
        blattUeber:[...document.querySelectorAll("#egBlock *")].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length,
        kleinK:knoepfe.filter(x => x.getBoundingClientRect().height < 43.5).map(x => x.textContent.trim().slice(0, 30)),
        kleinF:felder.filter(x => parseFloat(getComputedStyle(x).fontSize) < 16).length, knoepfe:knoepfe.length };
    });
    const tag = breite + " px " + (hell ? "hell" : "dunkel");
    pruef(m.ueber === 0 && m.blattUeber === 0, tag + ": kein Überlauf", m);
    pruef(m.knoepfe >= 4 && !m.kleinK.length && m.kleinF === 0, tag + ": Knöpfe ≥ 44 px, Felder 16 px", m);
    for(const sel of ["#egVorschlagText", "#egListe .eg-geteilt"]){
      const lage = await p.evaluate(s => { const e = document.querySelector(s); e.scrollIntoView({ block:"center", behavior:"instant" });
        const r = e.getBoundingClientRect(); return { y:Math.round(r.y), h:Math.round(r.height), inBild:r.top >= 0 && r.bottom <= innerHeight }; }, sel);
      await p.waitForTimeout(80);
      const k = lage.inBild ? await schlechtester(p, sel, true) : null;
      if(!lage.inBild) console.log("    (nicht im Bild: " + JSON.stringify(lage) + ")");
      pruef(k !== null && k >= 4.5, tag + ": " + sel + " ≥ 4,5:1", k && k.toFixed(2));
    }
    await p.evaluate(() => { tafelZeigen("startseite"); });
    await p.evaluate(() => { const g = document.getElementById("eoGruppe"); g.hidden = false; g.scrollIntoView({ block:"start" }); }).catch(() => {});
    pruef(!fehler.length, tag + ": keine Seitenfehler", fehler.join(" | ") || "–");
    await ctx.close();
  }
}

/* ── K · Hub ───────────────────────────────────────────────────── */
const PR = "g-aaaaaaaa-";
const OPT_HUB = {
  [PR + "beilage"]: { titel:"Beilage", art:"eine", pflicht:true, zeilen:[{ n:"Pommes", auf:0 }, { n:"Salat", auf:1.5 }] },
  [PR + "saucen"]: { titel:"Saucen", art:"mehrere", zeilen:[{ n:"Ketchup", auf:0 }, { n:"Mayo", auf:0, vor:true }, { n:"Trüffel", auf:2.5, vor:true }] },
};
async function hubAuf(browser, ctxVorher){
  const h = await oeffneHub(browser, { haus:"blend", optionen:OPT_HUB, hash:"#/speisekarte", ctx:ctxVorher,
    zeilen: z => { z[0].name = "Burger"; z[0].id = "aaaaaaaa-1111-1111-1111-111111111111"; z[0].opt = Object.keys(OPT_HUB).join(","); return z; } });
  h.bestell = [];
  await h.p.route("**/rpc/bestellung_aufgeben", r => { h.bestell.push(JSON.parse(r.request().postData() || "{}"));
    r.fulfill({ status:200, contentType:"application/json", body:'"aaaaaaaa-bbbb-cccc-dddd-000000000001"' }); });
  await h.p.evaluate(() => { ZEITEN.length = 0; for(let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59"); });
  return h;
}
const zeilen = p => p.evaluate(() => [...document.querySelectorAll("#warenkarte .ozeile")].map(e => ({
  n:decodeURIComponent(e.dataset.ozeile), an:e.classList.contains("an"), empf:!!e.querySelector(".ovor.empf"), vor:!!e.querySelector(".ovor:not(.empf)") })));
async function teilK(browser){
  console.log("\n══ K · Hub: nur Freies von selbst, „wie beim letzten Mal“ ══");
  let h = await hubAuf(browser);
  await h.p.evaluate(() => detailOeffnen("Burger")); await h.p.waitForTimeout(400);
  let z = await zeilen(h.p);
  const an = () => z.filter(x => x.an).map(x => x.n).join(",");
  pruef(z.length === 5, "Voraussetzung: beide Gruppen, 5 Zeilen", z.length);
  pruef(an() === "Pommes,Mayo", "erster Besuch: freier Vorschlag (Mayo) gewählt, bezahlter (Trüffel) nicht", an());
  pruef(z.find(x => x.n === "Trüffel").empf && z.find(x => x.n === "Mayo").vor, "Trüffel „Empfohlen“, Mayo „Vorschlag“");
  let satz = await h.p.evaluate(() => !!document.querySelector("#warenkarte .olvorwahl"));
  pruef(!satz, "erster Besuch: kein Satz „Wie beim letzten Mal“");
  /* wählen und bestellen: Salat (bezahlt), Ketchup (frei), Mayo ab, Trüffel (bezahlt) */
  for(const x of ["Salat", "Ketchup", "Mayo", "Trüffel"]){ await h.p.click('#warenkarte [data-ozeile="' + encodeURIComponent(x) + '"]'); await h.p.waitForTimeout(120); }
  z = await zeilen(h.p);
  pruef(an() === "Salat,Ketchup,Trüffel", "Voraussetzung: Wahl Salat, Ketchup, Trüffel", an());
  await h.p.click('#warenkarte [data-wmerk]'); await h.p.waitForTimeout(200);
  await h.p.evaluate(() => { location.hash = "#/auswahl"; }); await h.p.waitForTimeout(500);
  if(await h.p.$("#bTisch")) await h.p.fill("#bTisch", "7");
  await h.p.click('[data-aktion="bestellen"]'); await h.p.waitForTimeout(1500);
  pruef(h.bestell.length === 1 && /Salat/.test(JSON.stringify(h.bestell[0])), "Voraussetzung: bestellt", h.bestell.length);
  /* neuer Besuch, dasselbe Gerät */
  await h.p.evaluate(() => { location.hash = "#/speisekarte"; }); await h.p.reload(); await h.p.waitForTimeout(1300);
  await h.p.evaluate(() => { ZEITEN.length = 0; for(let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59"); detailOeffnen("Burger"); });
  await h.p.waitForTimeout(400);
  z = await zeilen(h.p);
  pruef(an() === "Pommes,Ketchup", "zweiter Besuch: die FREIEN Zeilen von damals (Ketchup) sind vorgewählt, Salat und Trüffel nicht", an());
  const info = await h.p.evaluate(() => ({ satz:(document.querySelector("#warenkarte .olvorwahl") || {}).textContent || "",
    chip:(document.querySelector("#warenkarte [data-wieletzt]") || {}).textContent || "", auf:optAufpreis("Burger"), text:optText("Burger") }));
  pruef(/Wie beim letzten Mal vorgewählt/.test(info.satz), "Satz „Wie beim letzten Mal vorgewählt“", info.satz);
  pruef(/Wie letztes Mal/.test(info.chip) && /\+4,00/.test(info.chip), "der Chip nennt den Betrag der Wahl von damals (+4,00 €)", info.chip);
  pruef(info.auf === 0 && info.text === "Pommes · Ketchup", "ohne Tipp: Aufpreis 0, Bon-Text nur mit dem Freien", info);
  await h.p.click("#warenkarte [data-wieletzt]"); await h.p.waitForTimeout(200);
  z = await zeilen(h.p);
  const nachChip = await h.p.evaluate(() => ({ auf:optAufpreis("Burger"), chip:!!document.querySelector("#warenkarte [data-wieletzt]") }));
  pruef(an() === "Salat,Ketchup,Trüffel" && nachChip.auf === 4 && !nachChip.chip, "ein Tipp auf den Chip setzt alles von damals (4,00 €), danach kein Chip mehr", an() + " " + JSON.stringify(nachChip));
  /* die eigene Wahl schlägt die Vorwahl */
  await h.p.click('#warenkarte [data-ozeile="Ketchup"]'); await h.p.waitForTimeout(120);
  z = await zeilen(h.p);
  pruef(an() === "Salat,Trüffel", "Ketchup abgewählt: bleibt aus", an());
  const sprachen = await h.p.evaluate(() => ["Empfohlen", "Wie beim letzten Mal vorgewählt"].map(k => Object.keys(TEXTE[k] || {}).length));
  pruef(sprachen.every(x => x === 11), "beide neuen Sätze in elf Sprachen", sprachen.join(","));
  pruef(!h.fehler.length, "Hub: keine Seitenfehler", h.fehler.join(" | ") || "–");
  await h.ctx.close();
}

(async () => {
  teilN();
  const browser = await chromium.launch();
  try{
    await teilH(browser);
    await teilG(browser);
    await teilV(browser);
    await teilM(browser);
    await teilK(browser);
  }finally{ await browser.close(); }
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN." : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
