/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Landingpage: Funktions-Showcase und echter Demo-Hub

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-web-showcase.js

   Wunsch 11.10.: „alle Funktionen im Showcase und ein Demo-Hub, der
   sich vom neusten nicht unterscheidet“. Gefahren wird über einen
   kleinen Server, der die Landingpage unter / und die ERZEUGTE Datei
   des Vorführhauses unter /h/nordstern/ ausliefert — gleiche Herkunft
   wie auf omoteno.de, sonst wäre der srcdoc-Rahmen nicht derselbe.
   Alles andere wird abgewiesen und gezählt.

   1 · Zweite Quelle: Die Schritte der Karten = omotenoDemo.schritte im
       Hub, jeder kommt genau einmal vor.
   2 · Lazy: Vor dem Abschnitt ist nichts geholt und kein Rahmen gefüllt.
   3 · Das Telefon zeigt die AUSGELIEFERTE Datei (Titel Café Nordstern,
       Vorführwerkzeug da) — kein Nachbau.
   4 · Jede Karte → „Zeig’s mir“ → das Telefon steht auf der Route, von
       der sie spricht; Zähler und aktive Karte stimmen.
   5 · Pfeile, Pfeiltaste und Rollen der Bahn wechseln die aktive Karte,
       das Telefon folgt.
   6 · Bewegung nur transform/opacity, je ≤ 450 ms; reduzierte Bewegung:
       keine.
   7 · Im Rahmen: Ein echter Tipp auf eine Kachel wechselt die Seite IM
       Rahmen (der Fund vom 11.10.: Raute-Links gegen <base> wären eine
       Navigation nach /h/nordstern/, die X-Frame-Options verweigert).
   8 · Nichts Schreibendes, nichts an die Datenbank, kein Schlüssel des
       Hubs im Speicher der Landingpage.
   9 · 360/390/768/1280 px: kein Überlauf, Tapflächen ≥ 44 px, Schrift
       der aktiven Karte ≥ 4,5:1.
  10 · Das Fenster „Demo-Hub“ zeigt denselben echten Hub.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const http = require("http");
const path = require("path");
const fs = require("fs");

const WURZEL = path.join(__dirname, "..");
const DIST = process.env.DIST || path.join(WURZEL, "dist");
const SEITE = process.env.SEITE || path.join(WURZEL, "seiten", "omoteno-web.html");
const HUB = path.join(DIST, "nordstern", "index.html");
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

if(!fs.existsSync(HUB)){ console.error("dist/nordstern fehlt — erst erzeugen."); process.exit(1); }

/* Dieselbe Tabelle wie in pruef-demo.js: wohin jeder Schritt führt. */
const ZIEL = { start:/^#\/$/, karte:/^#\/speisekarte/, rad:/^#\/entdecken/, korb:/^#\/auswahl/, pass:/^#\/(auswahl|bestellt)/,
  service:/^#\/service/, sprache:/^#\/$/, licht:/^#\/$/, liefern:/^#\//, wischen:/^#\//, reservieren:/^#\/reservieren/, meintisch:/^#\/meintisch/ };

let geholt = 0;
const server = http.createServer((q, a) => {
  const u = q.url.split("?")[0];
  if(u === "/" || u === "/index.html"){ a.writeHead(200, { "Content-Type":"text/html; charset=utf-8" }); return a.end(fs.readFileSync(SEITE)); }
  if(u === "/h/nordstern/" || u === "/h/nordstern/index.html"){ geholt++; a.writeHead(200, { "Content-Type":"text/html; charset=utf-8" }); return a.end(fs.readFileSync(HUB)); }
  a.writeHead(404); a.end();
});

async function oeffnen(browser, breite, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport:{ width:breite, height:opt.hoehe || 860 }, reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  const fehler = [], raus = [], db = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  p.on("console", m => { if(m.type() === "error" && !/Failed to load resource/.test(m.text())) fehler.push("konsole: " + m.text().slice(0, 140)); });
  await p.route("**/*", r => {
    const q = r.request(), u = q.url();
    if(q.method() !== "GET" && q.method() !== "HEAD") raus.push(q.method() + " " + u.slice(0, 80));
    if(/\/(rest|functions|auth|storage|realtime)\/v1\//.test(u)) db.push(u.slice(0, 80));
    if(u.startsWith(BASIS)) return r.continue();
    return r.abort();
  });
  await p.goto(BASIS + "/");
  await p.waitForTimeout(400);
  return { ctx, p, fehler, raus, db };
}
let BASIS = "";
const hash = p => p.evaluate(() => document.getElementById("fnRahmen").contentWindow.location.hash);
const aktiv = (p, reihe) => p.evaluate(r => {
  const d = [...document.querySelectorAll('[data-fn-reihe="' + r + '"] .fn-dia')];
  return { i:d.findIndex(x => x.classList.contains("fn-an")), n:d.length,
           zahl:document.querySelector('[data-fn-reihe="' + r + '"] .fn-zahl').textContent.trim() };
}, reihe);

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  BASIS = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();

  console.log("\n══ Telefon und Karten (1280 px) ══");
  let { ctx, p, fehler, raus, db } = await oeffnen(browser, 1280);
  const vorher = await p.evaluate(() => Object.keys(localStorage));

  /* 2 · Lazy */
  const leer = await p.evaluate(() => !document.getElementById("fnRahmen").srcdoc);
  pruef(leer && geholt === 0, "vor dem Abschnitt: kein Hub geholt, kein Rahmen gefüllt", "geholt " + geholt);

  await p.evaluate(() => document.getElementById("funktionen").scrollIntoView());
  await p.waitForFunction(() => { try{ return !!document.getElementById("fnRahmen").contentWindow.omotenoDemo; }catch(e){ return false; } }, null, { timeout:15000 }).catch(() => {});
  await p.waitForTimeout(600);

  /* 3 · der echte Hub */
  const hub = await p.evaluate(() => {
    const w = document.getElementById("fnRahmen").contentWindow;
    return { titel:w.document.title, demo:w.OMOTENO_DEMO === true, api:typeof w.omotenoDemo, ohneGruss:!w.document.getElementById("willkommen"),
             schritte:w.omotenoDemo ? w.omotenoDemo.schritte.slice() : [], stand:document.getElementById("fnStand").hidden,
             kacheln:w.document.querySelectorAll("a.kachel").length };
  });
  pruef(hub.demo && hub.api === "object" && /Nordstern/.test(hub.titel), "das Telefon zeigt die ausgelieferte Datei des Vorführhauses", hub.titel);
  pruef(hub.stand && hub.kacheln > 0 && hub.ohneGruss, "… geladen, Startseite mit Kacheln, kein Willkommensschirm davor", JSON.stringify({ stand:hub.stand, kacheln:hub.kacheln }));
  pruef(geholt === 1, "die Datei wurde genau einmal geholt", geholt);

  /* 1 · zweite Quelle */
  const karten = await p.evaluate(() => [...document.querySelectorAll('[data-fn-reihe="gast"] .fn-dia')].map(d => d.dataset.schritt));
  const fehlt = hub.schritte.filter(s => !karten.includes(s)), fremd = karten.filter(s => !hub.schritte.includes(s));
  const doppelt = karten.filter((s, i) => karten.indexOf(s) !== i);
  pruef(hub.schritte.length >= 10 && !fehlt.length && !fremd.length && !doppelt.length,
    "Karten = Schritte des Hubs, jeder genau einmal (" + hub.schritte.length + ")", (fehlt.join(",") + " | " + fremd.join(",") + " | " + doppelt.join(",")).replace(/^ \| \| $/, "ja"));

  /* 4 · jede Karte */
  const schlecht = [];
  for(let i = 0; i < karten.length; i++){
    const sch = karten[i];
    await p.evaluate(s => document.querySelector('[data-zeig="' + s + '"]').scrollIntoView({ block:"nearest", inline:"nearest" }), sch);
    await p.click('[data-zeig="' + sch + '"]');
    await p.waitForTimeout(sch === "pass" || sch === "wischen" ? 1800 : 900);
    const h = await hash(p), a = await aktiv(p, "gast");
    if(!ZIEL[sch].test(h)) schlecht.push(sch + " → " + h);
    if(a.i !== i || a.zahl !== (i + 1) + " / " + a.n) schlecht.push(sch + ": aktiv " + a.i + " „" + a.zahl + "“");
  }
  pruef(!schlecht.length, "jede Karte: „Zeig’s mir“ führt das Telefon an die richtige Stelle, Zähler stimmt", schlecht.slice(0, 4).join(" | ") || "alle " + karten.length);

  /* 5 · Pfeile, Taste, Rollen */
  await p.click('[data-fn-reihe="gast"] [data-fn-zurueck]');
  await p.waitForTimeout(700);
  let a = await aktiv(p, "gast");
  pruef(a.i === karten.length - 2, "Pfeil zurück: die vorige Karte ist aktiv", a.zahl);
  await p.waitForTimeout(400);
  pruef(ZIEL[karten[a.i]].test(await hash(p)), "… und das Telefon folgt ihr", await hash(p));
  await p.focus('[data-fn-reihe="gast"] .fn-bahn');
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(900);
  a = await aktiv(p, "gast");
  pruef(a.i === karten.length - 3, "Pfeiltaste links: noch eine zurück", a.zahl);
  await p.evaluate(() => { const b = document.querySelector('[data-fn-reihe="gast"] .fn-bahn'); b.scrollTo({ left:0, behavior:"auto" }); });
  await p.waitForTimeout(900);
  a = await aktiv(p, "gast");
  pruef(a.i === 0 && await p.evaluate(() => document.querySelector('[data-fn-reihe="gast"] [data-fn-zurueck]').disabled),
    "an den Anfang gerollt: erste Karte aktiv, „zurück“ gesperrt", a.zahl);
  pruef(ZIEL[karten[0]].test(await hash(p)), "… das Telefon zeigt nach dem Rollen die erste Stelle", await hash(p));

  /* 5b · Ein übersprungener Schritt plant nichts nach. Zwei Fenster,
     getrennt gemessen (§8.1g F — sonst verdeckt die eine Regel die
     andere): „wischen“ plant seinen Wisch nach 700 ms und der Wisch
     selbst läuft 620 ms. Weiter VOR dem Start trifft die geplante Uhr,
     weiter WÄHREND des Wischs trifft die laufende Animation. */
  for(const [fenster, ms] of [["vor dem Wisch", 250], ["während des Wischs", 1000]]){
    await p.evaluate(() => document.getElementById("fnRahmen").contentWindow.omotenoDemo.zeige("wischen"));
    await p.waitForTimeout(ms);
    await p.evaluate(() => document.getElementById("fnRahmen").contentWindow.omotenoDemo.zeige("start"));
    await p.waitForTimeout(2200);
    const h = await hash(p);
    pruef(h === "#/", "weiter " + fenster + ": das Telefon bleibt auf dem neuen Schritt", h);
  }

  /* 6 · Bewegung */
  await p.evaluate(() => { window.__ani = []; });
  await p.click('[data-fn-reihe="gast"] [data-fn-weiter]');
  await p.waitForTimeout(60);
  const ani = await p.evaluate(() => {
    const feld = document.getElementById("funktionen");
    return document.getAnimations().filter(x => x.effect && x.effect.target && feld.contains(x.effect.target))
      .map(x => ({ was:x.transitionProperty || x.animationName || "waapi",
                   props:x.transitionProperty ? [x.transitionProperty] : [...new Set(x.effect.getKeyframes().flatMap(k => Object.keys(k)))].filter(k => !["offset","computedOffset","easing","composite"].includes(k)),
                   d:+x.effect.getTiming().duration || 0 }));
  });
  pruef(ani.length > 0 && ani.every(x => x.props.every(pp => pp === "transform" || pp === "opacity") && x.d <= 450),
    "Bewegung beim Wechsel: nur transform/opacity, je ≤ 450 ms", ani.length + " · " + [...new Set(ani.map(x => x.props.join("+") + "/" + x.d))].join(" "));

  /* 7 · Tipp im Rahmen bleibt im Rahmen */
  await p.click('[data-zeig="start"]'); await p.waitForTimeout(900);
  const rahmen = await (await p.$("#fnRahmen")).contentFrame();
  let tipp = "kein Rahmen";
  if(rahmen){
    const k = await rahmen.$('a.kachel[href="#/speisekarte"]');
    if(k){
      await k.click({ force:true });
      await p.waitForTimeout(900);
      tipp = await p.evaluate(() => { const w = document.getElementById("fnRahmen").contentWindow;
        try{ return w.location.protocol + " " + w.location.hash + " " + !!w.omotenoDemo; }catch(e){ return "fremd: " + e.message; } });
    } else tipp = "keine Kachel zur Speisekarte";
  }
  pruef(/^about: #\/speisekarte true$/.test(tipp), "echter Tipp auf eine Kachel im Rahmen wechselt die Seite IM Rahmen (keine Navigation)", tipp);

  /* Zweite Reihe: öffnet das Board */
  await p.evaluate(() => document.querySelector('.fn-tresen [data-board="pass"]').scrollIntoView({ block:"center", inline:"nearest" }));
  await p.click('.fn-tresen [data-board="pass"]'); await p.waitForTimeout(700);
  pruef(await p.isVisible("#boardfenster"), "„Hinter dem Tresen“: der Knopf öffnet das Board-Fenster");
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);

  /* 10 · Fenster „Demo-Hub“ */
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
  await p.click(".status [data-hub]");
  await p.waitForFunction(() => { try{ return !!document.getElementById("hubRahmen").contentWindow.omotenoDemo; }catch(e){ return false; } }, null, { timeout:15000 }).catch(() => {});
  const fenster = await p.evaluate(() => { const w = document.getElementById("hubRahmen").contentWindow;
    return { offen:document.getElementById("hubfenster").open, titel:w.document.title, gruss:!!w.document.getElementById("willkommen") }; });
  pruef(fenster.offen && /Nordstern/.test(fenster.titel), "das Fenster „Demo-Hub“ zeigt denselben echten Hub", fenster.titel);
  pruef(geholt === 1, "… ohne die Datei ein zweites Mal zu holen", geholt);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);

  /* 8 · nichts geht hinaus, nichts bleibt */
  const nachher = await p.evaluate(() => Object.keys(localStorage));
  const neu = nachher.filter(k => !vorher.includes(k) && /nordstern|omoteno-|tapto-/.test(k));
  pruef(!raus.length, "nichts Schreibendes hat die Seite verlassen", raus.slice(0, 3).join(" | ") || "0");
  pruef(!db.length, "keine Anfrage an die Datenbank", db.slice(0, 3).join(" | ") || "0");
  pruef(!neu.length, "kein Schlüssel des Hubs im Speicher der Landingpage", neu.join(",") || "keiner");
  pruef(!fehler.length, "keine Seitenfehler", fehler.slice(0, 2).join(" | "));
  await ctx.close();

  /* 6b · reduzierte Bewegung */
  console.log("\n══ Reduzierte Bewegung ══");
  ({ ctx, p, fehler } = await oeffnen(browser, 1280, { ruhig:true }));
  await p.evaluate(() => document.getElementById("funktionen").scrollIntoView());
  await p.waitForTimeout(500);
  await p.click('[data-fn-reihe="gast"] [data-fn-weiter]');
  await p.waitForTimeout(40);
  const ruhig = await p.evaluate(() => { const feld = document.getElementById("funktionen");
    return document.getAnimations().filter(x => x.effect && x.effect.target && feld.contains(x.effect.target) && x.playState === "running").length; });
  a = await aktiv(p, "gast");
  pruef(ruhig === 0 && a.i === 1, "reduzierte Bewegung: Wechsel ohne Animation", "laufend " + ruhig + " · " + a.zahl);
  await ctx.close();

  /* 9 · Breiten */
  console.log("\n══ Breiten ══");
  for(const b of [360, 390, 768, 1280]){
    ({ ctx, p, fehler } = await oeffnen(browser, b, { hoehe:b < 700 ? 780 : 900 }));
    await p.evaluate(() => document.getElementById("funktionen").scrollIntoView());
    await p.waitForTimeout(700);
    const m = await p.evaluate(() => {
      const ueber = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const klein = [...document.querySelectorAll("#funktionen .fn-pfeil, #funktionen .fn-zeig")]
        .filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44); }).map(e => e.textContent.trim().slice(0, 14));
      const lum = c => { const v = c.match(/[\d.]+/g).slice(0, 3).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
      const kon = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const schwach = [];
      document.querySelectorAll("#funktionen .fn-dia.fn-an").forEach(d => {
        const grund = getComputedStyle(d).backgroundColor;
        d.querySelectorAll(".fn-was, h3, p").forEach(e => { const k = kon(getComputedStyle(e).color, grund); if(k < 4.5) schwach.push(e.tagName + " " + k.toFixed(2)); });
        const z = d.querySelector(".fn-zeig"); if(z){ const k = kon(getComputedStyle(z).color, getComputedStyle(z).backgroundColor); if(k < 4.5) schwach.push("Knopf " + k.toFixed(2)); }
      });
      const s = document.getElementById("fnSchirm").getBoundingClientRect();
      return { ueber, klein, schwach, schirm:Math.round(s.width) + "×" + Math.round(s.height), hoch:s.height <= innerHeight };
    });
    pruef(m.ueber <= 1, b + " px: nichts schiebt seitlich", m.ueber + " px");
    pruef(!m.klein.length, b + " px: Pfeile und Knöpfe ≥ 44 px (auch in den zurückgesetzten Karten)", m.klein.join(",") || "ja");
    pruef(!m.schwach.length, b + " px: Schrift der aktiven Karten ≥ 4,5:1", m.schwach.join(",") || "ja");
    pruef(m.hoch, b + " px: das Telefon passt ganz ins Fenster", m.schirm);
    pruef(!fehler.length, b + " px: keine Seitenfehler", fehler[0]);
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if(f){ console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
