/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Top-Runner als kleiner Prozent-Knopf unten rechts

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-runner.js
     (HUB_DIST=<Ordner> liest einen anderen dist-Ordner — Gegenbeweise im Worktree)

   Wunsch (25.10.): „Der Top-Runner soll ein schlichteres Design haben, nicht so
   breit, kleiner. Als kleiner Prozent-Button an der Seite unten rechts, wo man
   dann die Aktion und das Produkt sieht, am besten mit der Zeit, die abläuft.“
   Dazu entschieden: nur der Aktionspreis, kein durchgestrichener Preis, kein
   „−x %“ (Variante A, wegen § 11 PAngV).

   ZWEITE QUELLEN:
     · der Satz zur Aktion kommt aus hub_texte.laufschrift — Grenze 80 aus
       datenbank/migration-laufschrift.sql (gelesen, nicht abgetippt)
     · die Uhr wird gegen die echte Zeit gehalten (zwei Messungen, ein Element)
     · die Lage über den festen Leisten wird gegen die Rechtecke der Leisten
       selbst gemessen (Endlage, nicht mitten im Einfahren, §3.16)

   Uhr fest (§8.1j), außer in der Uhr-Probe. Beide Häuser, hell und dunkel,
   360/390/430 px.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs   = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const DIST = process.env.HUB_DIST || path.join(OBEN, "dist");
const HUB  = slug => "file://" + path.join(DIST, slug, "index.html");
const ADMIN = "file://" + path.join(OBEN, "seiten", "admin.html");
const GRENZE = +((fs.readFileSync(path.join(OBEN, "datenbank", "migration-laufschrift.sql"), "utf8")
  .match(/'laufschrift'\), 0\) <= (\d+)/) || [])[1]);

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

const AKTION = { id:"probe", gericht_name:"Dubai Crêpe", titel:null, preis_alt:12.9, preis_neu:8.9 };

/* fest: die Uhr steht (14 Uhr, 9.10.); echt: die Uhr läuft (für die Probe der ablaufenden Zeit). */
async function oeffnen(browser, slug, opt = {}) {
  const ctx = await browser.newContext({ viewport:{ width:opt.breite || 390, height:opt.hoehe || 844 },
    reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(e.message));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await s.addInitScript(echt => {
    try{ sessionStorage.setItem("omoteno-willkommen", "1"); sessionStorage.setItem("omoteno-reise", "1"); }catch(e){}
    if(echt) return;
    const alt = Date, fest = new alt(2026, 9, 9, 14, 0, 0).getTime();
    Date = class extends alt { constructor(...a){ super(...(a.length ? a : [fest])); } static now(){ return fest; } };
  }, !!opt.echt);
  await s.goto(HUB(slug) + "#/");
  await s.waitForTimeout(1000);
  await s.evaluate(([a, licht, lauf, restSek, liste]) => {
    if(licht) lichtSetzen(licht);
    RUNNER_LAUFSCHRIFT = lauf || "";
    const jetzt = Date.now();
    aktionen = (liste || [Object.assign({}, a, { bis:null })]).map((x, i) =>
      Object.assign({}, x, { bis:new Date(jetzt + (x.restSek || restSek || 7260) * 1000).toISOString() }));
    aktionKnopfAbgleichen();
  }, [AKTION, opt.licht || "", opt.lauf || "", opt.restSek || 0, opt.liste || null]);
  await s.waitForTimeout(opt.licht ? 1000 : 400);   // Hell/Dunkel blendet über, Leisten fahren ein
  return { ctx, s, fehler };
}

/* Alles, was den Knopf und sein Blatt betrifft, an einer Stelle gelesen. */
const LESEN = () => {
  const k = document.getElementById("aktionKnopf"), t = document.getElementById("aktionTaste"), b = document.getElementById("aktionBlatt");
  const r = e => { const q = e.getBoundingClientRect(); return { l:q.left, r:q.right, o:q.top, u:q.bottom, b:q.width, h:q.height }; };
  const cs = e => getComputedStyle(e);
  return { da: !!k, hidden: k.hidden, anzeige: cs(k).display, taste: r(t), text: t.textContent,
           expanded: t.getAttribute("aria-expanded"), label: t.getAttribute("aria-label"),
           blattAn: b.classList.contains("an"), sicht: cs(b).visibility, blatt: r(b), blattText: b.innerText,
           vw: innerWidth, vh: innerHeight, ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
};

const KONTRAST = () => {
  const zahl = t => { const s = String(t);
    const m = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
    if (m) return [m[1] * 255, m[2] * 255, m[3] * 255].concat(m[4] !== undefined ? [+m[4]] : []);
    return (s.match(/[\d.]+/g) || []).map(Number); };
  const kanal = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  const L = p => .2126 * kanal(p[0]) + .7152 * kanal(p[1]) + .0722 * kanal(p[2]);
  const verh = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const farbe = (el, eig) => zahl(getComputedStyle(el)[eig]);
  const aus = [];
  const blatt = document.getElementById("aktionBlatt"), taste = document.getElementById("aktionTaste");
  const grundBlatt = farbe(blatt, "backgroundColor");
  /* Voraussetzung: der Grund unter der Schrift ist deckend (sonst misst die Prüfung gegen etwas, das nicht da ist). */
  aus.push(["blatt-grund-deckend", grundBlatt.length < 4 || grundBlatt[3] === 1 ? 21 : 0]);
  blatt.querySelectorAll(".ak-titel, .ak-name, .ak-preis, .ak-preis b, .ak-rest, .ak-satz, .sofort").forEach(el => {
    const g = el.classList.contains("sofort") ? farbe(el, "backgroundColor") : grundBlatt;
    aus.push([el.className, +verh(farbe(el, "color"), g).toFixed(2)]);
  });
  const grundTaste = farbe(taste, "backgroundColor");
  aus.push(["taste", +verh(farbe(taste, "color"), grundTaste).toFixed(2)]);
  const z = taste.querySelector(".ak-zeichen");
  aus.push(["zeichen", +verh(farbe(z, "color"), farbe(z, "backgroundColor")).toFixed(2)]);
  return aus;
};

(async () => {
  const browser = await chromium.launch();
  pruef(GRENZE === 80, "Grenze des Satzes zur Aktion aus der Migration gelesen", GRENZE);

  for (const slug of ["chocolamour", "blend"]) {
    console.log("\n══ " + slug + " · Knopf, Blatt, Bedienung ══");
    {
      const { ctx, s, fehler } = await oeffnen(browser, slug);
      const alt = await s.evaluate(() => ({ band: document.querySelectorAll(".aktion, .aktion-band, .aktion-lauf, .aktion-rabatt, .aktionklick").length,
        streich: [...document.body.querySelectorAll("*")].filter(e => /line-through/.test(getComputedStyle(e).textDecorationLine) && e.closest("#aktionBlatt")).length }));
      pruef(alt.band === 0, "kein Band, keine Laufschrift, keine Rabatt-Plakette, keine breite Karte mehr", String(alt.band));
      const r = await s.evaluate(LESEN);
      pruef(r.da && !r.hidden && r.anzeige !== "none", "der Knopf steht da", JSON.stringify({ hidden:r.hidden, anzeige:r.anzeige }));
      pruef(r.taste.h >= 44 && r.taste.b >= 44, "Tapfläche ≥ 44 px", Math.round(r.taste.b) + " × " + Math.round(r.taste.h));
      pruef(r.taste.b <= 130 && r.taste.h <= 52, "klein: höchstens 130 × 52 px (vorher eine ganze Kartenbreite)", Math.round(r.taste.b) + " × " + Math.round(r.taste.h));
      pruef(Math.abs((r.vw - r.taste.r) - 12) <= 1.5, "sitzt rechts, 12 px vom Rand", (r.vw - r.taste.r).toFixed(1));
      pruef(r.taste.u <= r.vh && r.taste.o >= 0, "ganz im Bild", Math.round(r.taste.o) + "–" + Math.round(r.taste.u) + " von " + r.vh);
      pruef(/%/.test(r.text) && /2:01:00/.test(r.text), "zeigt das Prozentzeichen und die ablaufende Zeit (2:01:00)", r.text);
      pruef(r.expanded === "false" && r.sicht === "hidden" && !r.blattAn, "das Blatt ist zu, und zwar unsichtbar (visibility), nicht nur geschoben (§3.14)", r.sicht);

      /* Öffnen mit dem echten Tipp */
      await s.click("#aktionTaste");
      await s.waitForTimeout(500);
      const o = await s.evaluate(LESEN);
      pruef(o.blattAn && o.sicht === "visible" && o.expanded === "true", "ein Tipp öffnet das Blatt (aria-expanded stimmt)", JSON.stringify({ an:o.blattAn, sicht:o.sicht, exp:o.expanded }));
      const inh = await s.evaluate(() => { const b = document.getElementById("aktionBlatt"), q = c => (b.querySelector(c) || {}).textContent;
        return { titel:q(".ak-titel"), name:q(".ak-name"), preis:q(".ak-preis"), rest:q(".ak-rest"), prozent:/[%−]/.test(b.innerText),
                 streich:[...b.querySelectorAll("*")].filter(e => /line-through/.test(getComputedStyle(e).textDecorationLine)).length,
                 alt:/12,90|12\.9/.test(b.innerText) }; });
      pruef(inh.titel === "Top-Runner" && inh.name === "Dubai Crêpe", "Blatt nennt die Aktion und das Gericht", inh.titel + " / " + inh.name);
      pruef(/Aktionspreis/.test(inh.preis) && /8,90/.test(inh.preis), "… und den Aktionspreis 8,90 €", inh.preis);
      pruef(!inh.prozent && !inh.streich && !inh.alt, "… aber weder ein Prozentwert, noch ein Streichpreis, noch der alte Preis (Variante A)", JSON.stringify({ p:inh.prozent, s:inh.streich, a:inh.alt }));
      pruef(/noch 2:01:00/.test(inh.rest), "… und die Restzeit", inh.rest);
      pruef(o.blatt.l >= 11 && o.blatt.r <= o.vw - 11 && o.blatt.o >= 0, "Blatt liegt ganz im Bild", Math.round(o.blatt.l) + "–" + Math.round(o.blatt.r) + " von " + o.vw);
      pruef(o.blatt.u <= o.taste.o + 1, "… über dem Knopf, nicht auf ihm", Math.round(o.blatt.u) + " ≤ " + Math.round(o.taste.o));
      pruef(o.ueber <= 0, "kein Überlauf zur Seite", String(o.ueber));
      /* Ein Tipp IM Blatt auf nichts Bedienbares (der Rand) lässt es offen */
      await s.click("#aktionBlatt", { position:{ x:6, y:6 } });
      await s.waitForTimeout(250);
      pruef(await s.evaluate(() => document.getElementById("aktionBlatt").classList.contains("an")), "ein Tipp auf den Rand des Blatts schließt es nicht");
      /* Der Knopf schließt wieder */
      await s.click("#aktionTaste");
      await s.waitForTimeout(500);
      const z1 = await s.evaluate(LESEN);
      pruef(!z1.blattAn && z1.sicht === "hidden" && z1.expanded === "false", "der Knopf schließt es wieder (danach unsichtbar)", z1.sicht);
      /* Escape */
      await s.click("#aktionTaste"); await s.waitForTimeout(400);
      await s.keyboard.press("Escape"); await s.waitForTimeout(500);
      pruef(await s.evaluate(() => !document.getElementById("aktionBlatt").classList.contains("an")), "Escape schließt es");
      /* Tipp daneben */
      await s.click("#aktionTaste"); await s.waitForTimeout(400);
      await s.mouse.click(30, 120); await s.waitForTimeout(500);
      pruef(await s.evaluate(() => !document.getElementById("aktionBlatt").classList.contains("an")), "ein Tipp daneben schließt es");

      /* „+“ im Blatt: dasselbe Gericht zum AKTIONSPREIS in der Auswahl */
      await s.click("#aktionTaste"); await s.waitForTimeout(450);
      const vorher = await s.evaluate(() => !!merk["Dubai Crêpe"]);
      await s.click('#aktionBlatt [data-aktionmerk]'); await s.waitForTimeout(500);
      const plus = await s.evaluate(() => ({ eintrag: merk["Dubai Crêpe"] ? merk["Dubai Crêpe"].p : null,
        an: document.querySelector("#aktionBlatt .sofort").classList.contains("an") }));
      pruef(!vorher && /8,90/.test(plus.eintrag || "") && plus.an, "„+“ legt das Gericht zum Aktionspreis in die Auswahl (8,90, nicht der Kartenpreis)", JSON.stringify(plus));
      /* Die Auswahl-Leiste fährt ein — der Knopf liegt in der Endlage darüber (§3.16) */
      await s.keyboard.press("Escape"); await s.waitForTimeout(900);
      const lage = await s.evaluate(() => {
        const t = document.getElementById("aktionTaste").getBoundingClientRect(), liste = [];
        ["hauptnav", "auswahlbalken", "vstreifen", "wsstreifen"].forEach(id => { const e = document.getElementById(id); if(!e || e.hidden) return;
          const cs = getComputedStyle(e); if(cs.visibility === "hidden" || cs.display === "none") return;
          let dy = 0; try{ dy = new DOMMatrix(cs.transform).m42; }catch(x){}
          const q = e.getBoundingClientRect(); if(!(q.width > 0 && q.height > 0)) return;
          liste.push({ id, oben: Math.round(q.top - dy) }); });
        return { knopfUnten: Math.round(t.bottom), liste };
      });
      const hoechste = Math.min(...lage.liste.map(x => x.oben), 99999);
      pruef(lage.liste.some(x => x.id === "auswahlbalken"), "Voraussetzung: die Auswahl-Leiste steht (sonst misst die Lage nichts)", JSON.stringify(lage.liste));
      pruef(lage.knopfUnten <= hoechste, "der Knopf liegt über der höchsten festen Leiste", lage.knopfUnten + " ≤ " + hoechste + " " + JSON.stringify(lage.liste));
      /* Der Bestellstand-Streifen (wsstreifen) ist ebenfalls eine feste Leiste: Der Knopf liegt auch über ihm. */
      await s.evaluate(() => { const w = document.getElementById("wsstreifen"); w.hidden = false; w.textContent = "Ihre Bestellung wird zubereitet"; });
      await s.waitForTimeout(500);
      const ws = await s.evaluate(() => { const w = document.getElementById("wsstreifen").getBoundingClientRect(), t = document.getElementById("aktionTaste").getBoundingClientRect();
        return { wsOben: Math.round(w.top), wsHoch: Math.round(w.height), knopfUnten: Math.round(t.bottom) }; });
      pruef(ws.wsHoch > 20, "Voraussetzung: der Bestellstand-Streifen steht da", JSON.stringify(ws));
      pruef(ws.knopfUnten <= ws.wsOben, "der Knopf liegt auch über dem Bestellstand-Streifen", JSON.stringify(ws));
      await s.evaluate(() => { const w = document.getElementById("wsstreifen"); w.hidden = true; w.textContent = ""; });
      await s.waitForTimeout(300);
      /* Herausnehmen */
      await s.click("#aktionTaste"); await s.waitForTimeout(450);
      await s.click('#aktionBlatt [data-aktionmerk]'); await s.waitForTimeout(400);
      pruef(await s.evaluate(() => !merk["Dubai Crêpe"] && !document.querySelector("#aktionBlatt .sofort").classList.contains("an")), "zweiter Tipp nimmt es wieder heraus");
      /* Tipp auf das Gericht im Blatt öffnet DESSEN Detailblatt und schließt das Aktions-Blatt */
      await s.click("#aktionBlatt .ak-info"); await s.waitForTimeout(700);
      const det = await s.evaluate(() => ({ detail: document.getElementById("warenkarte").classList.contains("an"),
        name: (document.querySelector("#warenkarte #wname, #warenkarte .wname, #warenkarte h2") || {}).textContent || "",
        blatt: document.getElementById("aktionBlatt").classList.contains("an"), knopf: document.getElementById("aktionKnopf").hidden }));
      pruef(det.detail && /Dubai/.test(det.name) && !det.blatt, "Tipp auf das Gericht öffnet dessen Detailblatt, das Aktions-Blatt geht zu", JSON.stringify(det));
      pruef(det.knopf, "… und der Knopf tritt zurück, solange das Detailblatt offen ist", String(det.knopf));
      pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
      await ctx.close();
    }

    console.log("\n══ " + slug + " · wo er steht und wo nicht ══");
    {
      const { ctx, s } = await oeffnen(browser, slug);
      const stand = async () => s.evaluate(() => document.getElementById("aktionKnopf").hidden);
      pruef(!(await stand()), "Startseite: da");
      await s.evaluate(() => { location.hash = "#/speisekarte"; }); await s.waitForTimeout(700);
      pruef(!(await stand()), "Speisekarte: da");
      await s.evaluate(() => { location.hash = "#/haus"; }); await s.waitForTimeout(700);
      pruef(await stand(), "Unterseite „Haus“: nicht da");
      await s.evaluate(() => { location.hash = "#/"; }); await s.waitForTimeout(700);
      pruef(!(await stand()), "zurück auf der Startseite: wieder da");
      await s.evaluate(() => { aktionen = []; aktionKnopfAbgleichen(); });
      const leer = await s.evaluate(() => ({ hidden: document.getElementById("aktionKnopf").hidden, blatt: document.getElementById("aktionBlatt").children.length }));
      pruef(leer.hidden && leer.blatt === 0, "ohne Aktion: kein Knopf und ein leeres Blatt", JSON.stringify(leer));
      await s.evaluate(a => { aktionen = [Object.assign({}, a, { bis:new Date(Date.now() - 1000).toISOString() })]; aktionKnopfAbgleichen(); }, AKTION);
      pruef(await stand(), "abgelaufene Aktion: kein Knopf");
      await s.evaluate(a => { aktionen = [Object.assign({}, a, { bis:new Date(Date.now() + 90 * 86400e3).toISOString() })]; aktionKnopfAbgleichen(); }, AKTION);
      pruef(await stand(), "Dauer-Rabatt (90 Tage) gehört nicht in den Knopf");
      await s.evaluate(() => { aktionen = []; aktionKnopfAbgleichen(); });
      await ctx.close();
    }

    console.log("\n══ " + slug + " · Zeit: mehrere Aktionen, Tage, Stunden ══");
    {
      const liste = [
        { id:"c", gericht_name:"Dubai Crêpe", titel:"Spät", preis_neu:8.9, restSek:3 * 3600 },
        { id:"a", gericht_name:"Dubai Crêpe", titel:"Früh", preis_neu:7.5, restSek:1800 },
        { id:"b", gericht_name:"Dubai Crêpe", titel:"Mitte", preis_neu:8.0, restSek:3600 },
        { id:"d", gericht_name:"Dubai Crêpe", titel:"Vierte", preis_neu:6.0, restSek:5 * 3600 }
      ];
      const { ctx, s } = await oeffnen(browser, slug, { liste });
      const r = await s.evaluate(() => ({ titel:[...document.querySelectorAll("#aktionBlatt .ak-titel")].map(e => e.textContent), knopf:document.getElementById("aktionTaste").textContent }));
      pruef(r.titel.length === 3 && r.titel.join(",") === "Früh,Mitte,Spät", "höchstens drei, nach Ende geordnet (die Vierte fehlt)", r.titel.join(","));
      pruef(/30:00/.test(r.knopf), "der Knopf zeigt die, die zuerst endet (30:00)", r.knopf);
      await ctx.close();
      for (const [sek, blatt, knopf, lage] of [[3 * 86400, /noch 3 Tage/, /Aktion/, "3 Tage"], [30 * 3600, /noch 30 Stunden/, /Aktion/, "30 Stunden"], [75, /noch 1:15/, /1:15/, "75 Sekunden"]]) {
        const { ctx: c2, s: s2 } = await oeffnen(browser, slug, { restSek:sek });
        await s2.click("#aktionTaste"); await s2.waitForTimeout(400);
        const t = await s2.evaluate(() => ({ b:document.querySelector("#aktionBlatt .ak-rest").textContent.trim(), k:document.getElementById("aktionTaste").textContent }));
        pruef(blatt.test(t.b) && knopf.test(t.k), lage + ": Blatt „" + t.b + "“, Knopf „" + t.k + "“");
        await c2.close();
      }
    }

    console.log("\n══ " + slug + " · die Uhr läuft am selben Element ══");
    {
      const { ctx, s } = await oeffnen(browser, slug, { echt:true, restSek:180 });
      await s.click("#aktionTaste"); await s.waitForTimeout(400);
      const a = await s.evaluate(() => { const e = document.querySelector("#aktionTaste .ak-zeit"), b = document.querySelector("#aktionBlatt .ak-rest [data-akt-bis]");
        window.__ak = { e, b, blatt:document.getElementById("aktionBlatt").firstElementChild }; return { k:e.textContent, b:b.textContent }; });
      await s.waitForTimeout(2300);
      const b = await s.evaluate(() => ({ k:document.querySelector("#aktionTaste .ak-zeit").textContent, b:document.querySelector("#aktionBlatt .ak-rest [data-akt-bis]").textContent,
        gleich: document.querySelector("#aktionTaste .ak-zeit") === window.__ak.e && document.querySelector("#aktionBlatt .ak-rest [data-akt-bis]") === window.__ak.b,
        blattGleich: document.getElementById("aktionBlatt").firstElementChild === window.__ak.blatt }));
      const sek = t => { const m = String(t).match(/(\d+):(\d\d)/); return m ? +m[1] * 60 + +m[2] : NaN; };
      pruef(sek(b.k) < sek(a.k) && sek(a.k) - sek(b.k) >= 1 && sek(a.k) - sek(b.k) <= 4, "die Zeit im Knopf zählt herunter (nach 2,3 s " + (sek(a.k) - sek(b.k)) + " s weniger)", a.k + " → " + b.k);
      pruef(sek(b.b) < sek(a.b), "… und im Blatt", a.b + " → " + b.b);
      pruef(b.gleich && b.blattGleich, "… am selben Element, ohne das Blatt neu zu bauen (§4.2)", JSON.stringify({ gleich:b.gleich, blatt:b.blattGleich }));
      await ctx.close();
      /* Läuft sie ab, verschwindet der Knopf von selbst */
      const { ctx: c3, s: s3 } = await oeffnen(browser, slug, { echt:true, restSek:2 });
      pruef(!(await s3.evaluate(() => document.getElementById("aktionKnopf").hidden)), "Voraussetzung: der Knopf steht (2 Sekunden Rest)");
      await s3.waitForTimeout(3500);
      pruef(await s3.evaluate(() => document.getElementById("aktionKnopf").hidden), "nach Ablauf verschwindet der Knopf von selbst");
      await c3.close();
    }

    console.log("\n══ " + slug + " · Satz zur Aktion, nur Text ══");
    {
      const { ctx, s, fehler } = await oeffnen(browser, slug, { lauf:"Nur heute · solange der Vorrat reicht" });
      const q = await s.evaluate(() => (document.querySelector("#aktionBlatt .ak-satz") || {}).textContent);
      pruef(q === "Nur heute · solange der Vorrat reicht", "der eigene Satz steht über der Aktion im Blatt", q);
      const sicher = await s.evaluate(() => { RUNNER_LAUFSCHRIFT = '<img src=x onerror="window.__lauf=1">'; aktionKnopfAbgleichen();
        return { img: !!document.querySelector("#aktionBlatt img"), text:(document.querySelector("#aktionBlatt .ak-satz") || {}).textContent }; });
      await s.waitForTimeout(250);
      pruef(!sicher.img && !(await s.evaluate(() => !!window.__lauf)) && /<img/.test(sicher.text || ""), "der Satz nur als Text (kein Tag, kein onerror)", JSON.stringify(sicher));
      const g = await s.evaluate(() => { aktionen = [{ id:"x", gericht_name:'<img src=x onerror="window.__gn=1">', titel:'"><img src=x onerror="window.__ti=1">', preis_neu:5,
        bis:new Date(Date.now() + 3600e3).toISOString() }]; RUNNER_LAUFSCHRIFT = ""; aktionKnopfAbgleichen();
        return { img: document.querySelectorAll("#aktionBlatt img, #aktionTaste img").length }; });
      await s.waitForTimeout(250);
      const lief = await s.evaluate(() => ({ gn:!!window.__gn, ti:!!window.__ti }));
      pruef(g.img === 0 && !lief.gn && !lief.ti, "Gerichtname und Titel der Aktion nur als Text", JSON.stringify({ img:g.img, lief }));
      const aus = await s.evaluate(G => {
        betriebsTeileAnwenden({ hub_texte:{ laufschrift:"x".repeat(G + 15) } }, true); const lang = RUNNER_LAUFSCHRIFT.length;
        betriebsTeileAnwenden({ hub_texte:{ laufschrift:42 } }, true); const zahl = RUNNER_LAUFSCHRIFT;
        betriebsTeileAnwenden({ hub_texte:{ laufschrift:"  Happy Hour  " } }, true); const gut = RUNNER_LAUFSCHRIFT;
        return { lang, zahl, gut };
      }, GRENZE);
      pruef(aus.lang === GRENZE && aus.zahl === "" && aus.gut === "Happy Hour", "aus hub_texte: gekürzt auf die Grenze, Nicht-Text verworfen, getrimmt", JSON.stringify(aus));
      pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
      await ctx.close();
    }

    console.log("\n══ " + slug + " · Bewegung ══");
    {
      const { ctx, s } = await oeffnen(browser, slug);
      const b = await s.evaluate(() => { const c = getComputedStyle(document.getElementById("aktionBlatt")), t = getComputedStyle(document.getElementById("aktionTaste"));
        return { blatt:c.transitionProperty.split(",").map(x => x.trim()), taste:t.transitionProperty.split(",").map(x => x.trim()) }; });
      pruef(b.blatt.every(p => ["transform", "opacity", "visibility"].includes(p)) && b.taste.every(p => p === "transform"), "nur transform/opacity (und visibility) bewegen sich", JSON.stringify(b));
      await ctx.close();
      const { ctx: c2, s: s2 } = await oeffnen(browser, slug, { ruhig:true });
      const r = await s2.evaluate(() => ({ puls: document.getAnimations().filter(a => a.playState === "running" && a.animationName === "aktionPuls").length,
        dauer: getComputedStyle(document.getElementById("aktionBlatt")).transitionDuration }));
      await s2.click("#aktionTaste"); await s2.waitForTimeout(150);
      const offen = await s2.evaluate(() => getComputedStyle(document.getElementById("aktionBlatt")).visibility);
      pruef(r.puls === 0 && /^0s(, 0s)*$/.test(r.dauer) && offen === "visible", "Bewegung reduzieren: kein Puls, keine Übergänge, das Blatt steht sofort da", JSON.stringify({ puls:r.puls, dauer:r.dauer, offen }));
      await c2.close();
    }

    console.log("\n══ " + slug + " · Farben und Maße ══");
    for (const licht of ["hell", "dunkel"]) for (const breite of [360, 390, 430]) {
      const { ctx, s, fehler } = await oeffnen(browser, slug, { licht, breite, ruhig:true });
      await s.click("#aktionTaste"); await s.waitForTimeout(300);
      const lage = slug + " · " + licht + " · " + breite + " px";
      const k = await s.evaluate(KONTRAST);
      const grund = k.find(x => x[0] === "blatt-grund-deckend");
      const schlecht = k.filter(x => x[1] < 4.5);
      pruef(grund && grund[1] > 0 && !schlecht.length, lage + ": jede Schrift ≥ 4,5:1 (Knopf, Zeichen, Blatt)",
        schlecht.length ? schlecht.map(x => x.join(" ")).join(", ") : k.length + " Stellen, kleinste " + Math.min(...k.map(x => x[1])));
      const m = await s.evaluate(() => { const t = document.getElementById("aktionTaste").getBoundingClientRect(), so = document.querySelector("#aktionBlatt .sofort").getBoundingClientRect(),
        b = document.getElementById("aktionBlatt").getBoundingClientRect(), name = document.querySelector("#aktionBlatt .ak-name"), zh = parseFloat(getComputedStyle(name).lineHeight);
        return { ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth, taste: Math.round(Math.min(t.width, t.height)),
                 sofort: Math.round(Math.min(so.width, so.height)), nameZeilen: Math.round(name.getBoundingClientRect().height / zh),
                 imBild: b.left >= 11 && b.right <= innerWidth - 11 && b.top >= 0 }; });
      pruef(m.ueber <= 0 && m.taste >= 44 && m.sofort >= 44 && m.nameZeilen <= 2 && m.imBild, lage + ": kein Überlauf, Knopf und „+“ ≥ 44 px, Name ≤ 2 Zeilen, Blatt im Bild", JSON.stringify(m));
      pruef(!fehler.length, lage + ": keine Ausnahme", fehler.join("|") || "still");
      await ctx.close();
    }
  }

  console.log("\n══ Spiegelung (Arabisch) und lange Texte ══");
  {
    const { ctx, s } = await oeffnen(browser, "chocolamour");
    await s.evaluate(() => { document.documentElement.dir = "rtl"; });
    await s.waitForTimeout(200);
    const r = await s.evaluate(() => { const q = document.getElementById("aktionTaste").getBoundingClientRect(); return { links: Math.round(q.left), vw: innerWidth }; });
    pruef(Math.abs(r.links - 12) <= 1.5, "gespiegelt sitzt der Knopf links, 12 px vom Rand", JSON.stringify(r));
    await ctx.close();
    const { ctx: c2, s: s2 } = await oeffnen(browser, "chocolamour", { breite:360, lauf:"x".repeat(80),
      liste:[{ id:"l", gericht_name:"Dubai Crêpe mit sehr langem Namen für zwei Personen zum Teilen", titel:"W".repeat(40), preis_neu:12.5 }] });
    await s2.click("#aktionTaste"); await s2.waitForTimeout(400);
    const l = await s2.evaluate(() => { const b = document.getElementById("aktionBlatt");
      const ab = e => e.scrollHeight > e.clientHeight + 1;
      return { ueber: b.scrollWidth - b.clientWidth, hoehe: Math.round(b.getBoundingClientRect().height), oben: Math.round(b.getBoundingClientRect().top),
               titelZeilen: Math.round(b.querySelector(".ak-titel").getBoundingClientRect().height / parseFloat(getComputedStyle(b.querySelector(".ak-titel")).lineHeight)),
               nameZeilen: Math.round(b.querySelector(".ak-name").getBoundingClientRect().height / parseFloat(getComputedStyle(b.querySelector(".ak-name")).lineHeight)),
               kuerzt: ab(b.querySelector(".ak-titel")) || ab(b.querySelector(".ak-name")) }; });
    pruef(l.ueber <= 0 && l.titelZeilen <= 2 && l.nameZeilen <= 2 && l.oben >= 0, "längste Texte bei 360 px: kein Überlauf, Titel und Name ≤ 2 Zeilen, Blatt im Bild", JSON.stringify(l));
    await c2.close();
  }

  console.log("\n══ Board: Satz zur Aktion eingeben, Vorschau, Übernehmen ══");
  {
    const ctx = await browser.newContext({ viewport:{ width:900, height:900 } });
    const p = await ctx.newPage(); const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto(ADMIN); await p.waitForTimeout(700);
    await p.evaluate(() => { document.getElementById("tor").hidden = true;
      if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); } });
    await p.waitForTimeout(400);
    /* Wie der Besitzer: Einstellungen öffnen — erst dann füllt das Board die Felder. */
    await p.evaluate(() => { const r = document.querySelector('[data-tafel="startseite"]'); if (r) r.click(); });
    await p.waitForTimeout(400);
    await gruppeZu(p, "#gh-worte");
    const feld = await p.evaluate(() => { const el = document.getElementById("hubLaufschrift");
      const beschr = el ? el.closest(".ezeile").querySelector("b") : null;
      return el ? { max: +el.getAttribute("maxlength"), beschr: beschr && beschr.textContent } : null; });
    pruef(!!feld && feld.max === GRENZE, "Feld „Satz zur Aktion“ da, nimmt höchstens so viel wie die Datenbank", feld && feld.max);
    pruef(!!feld && feld.beschr === "Satz zur Aktion", "… und heißt nicht mehr „Laufschrift“ (es läuft nichts mehr)", feld && feld.beschr);
    const r = await p.evaluate(async () => {
      const gesendet = [];
      const alt = hvSenden; hvSenden = (art, teil, ziel) => { gesendet.push({ art, teil, ziel }); };
      const el = document.getElementById("hubLaufschrift");
      el.value = "Nur heute · 2 für 1"; el.dispatchEvent(new Event("input", { bubbles:true }));
      hvSenden = alt;
      const letzte = gesendet[gesendet.length - 1] || {};
      await hubTexteSichern();
      return { ziel: letzte.ziel, text: letzte.teil && letzte.teil.hub_texte && letzte.teil.hub_texte.laufschrift,
               aktion: !!(letzte.teil && letzte.teil.aktion), gespeichert: HUBTEXTE.laufschrift };
    });
    pruef(r.text === "Nur heute · 2 für 1" && r.ziel === "aktion" && r.aktion, "Tippen schickt den Satz an die Vorschau, mit Beispiel-Aktion", JSON.stringify(r));
    pruef(r.gespeichert === "Nur heute · 2 für 1", "„Übernehmen“ legt ihn in hub_texte.laufschrift", r.gespeichert);
    const zurueck = await p.evaluate(() => { document.getElementById("hubTexteZurueck").click(); return document.getElementById("hubLaufschrift").value; });
    pruef(zurueck === "", "„Auf Vorgabe zurück“ leert auch den Satz");
    const quelle = fs.readFileSync(path.join(OBEN, "seiten", "admin.html"), "utf8");
    pruef(!/Läuft im farbigen Band|Der Rabatt in Prozent kommt von selbst/.test(quelle), "keine Beschreibung im Board spricht noch von Band, Laufschrift-Durchlauf oder Prozent-Plakette");
    pruef(!fehler.length, "keine Ausnahme im Board", fehler.join(" | ") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  console.log(f ? f + " FEHLER" : "Alles sauber.");
  process.exit(f ? 1 : 0);
})();
