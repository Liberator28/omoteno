/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Runterwischen schließt das Fenster

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-wischen.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   > Anlass. Jedes Fenster hatte oben einen Balken, der aussieht, als
   > könnte man ihn herunterziehen — und man konnte nicht. Zum
   > Schließen musste man jedes Mal das ✕ oben rechts treffen: der
   > Griff, den man am Telefon am schlechtesten erreicht.

   Vier Dinge müssen stimmen, und für jedes steht hier eine Probe:

   1 · Ein LANGER Zug schließt.
   2 · Ein KURZER Zug schließt NICHT, sondern federt zurück. Ohne das
       wäre jedes Verrutschen beim Lesen ein Schließen.
   3 · Auf einem Bedienelement fängt gar keine Geste an. Wer einen
       Regler zieht, will den Regler bewegen.
   4 · Danach steht keine Inline-Angabe mehr am Element. Bliebe sie
       stehen, öffnete sich das Fenster beim nächsten Mal an der
       falschen Stelle — und niemand fände den Grund.

   5 · Mit dem FINGER (echte Touch-Folgen, nicht Maus): Ein Blatt hat
       genau einen Scrollbereich, rollt bis ans Ende, und ein Wisch
       nach unten schließt nur, wenn zwischen Finger und Blatt alles
       ganz oben steht — auch auf einem Raster aus Knöpfen.

   > Anlass zu 5. Im Kategorie-Blatt des Boards lag das Emoji-Raster
   > als eigener Scrollbereich (44dvh) im Blatt. Gemessen: Sechs
   > Wische nach oben ließen das Raster an sein Ende laufen, das
   > Blatt blieb bei 0 von 192 stehen, „Sichern" lag bei y=891 unter
   > dem Schirm. Ein Wisch nach unten rollte das Raster, statt das
   > Blatt zu schließen. Die Maus-Proben oben sahen davon nichts.

   Und: Wer Bewegung reduziert hat, bekommt dieselbe Geste mit
   demselben Ergebnis, nur ohne Mitziehen. Ein Fenster, das sich für
   diese Menschen nicht mehr schließen ließe, wäre der schlechtere
   Fehler.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
/* Gegenbeweise: ADMIN_DATEI=<Kopie von admin.html> */
const ADMIN_PFAD = process.env.ADMIN_DATEI ? path.resolve(process.env.ADMIN_DATEI) : path.join(OBEN, "seiten", "admin.html");
let fehler = 0;
const ok = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };
const echt = k => k.filter(z => !/net::ERR|Failed to load|ERR_FAILED/i.test(z));

/* Eine Zeigergeste, wie sie ein Finger macht: aufsetzen, in Schritten
   ziehen, loslassen. In einem Sprung gezogen sähe der Browser keine
   Geschwindigkeit — und die entscheidet mit. */
async function ziehe(p, wo, dy, schritte){
  const r = await p.evaluate(s => {
    const e = document.querySelector(s); if(!e) return null;
    const b = e.getBoundingClientRect();
    if(!b.width || !b.height) return null;
    return { x: b.left + b.width/2, y: b.top + Math.min(8, b.height/2) };
  }, wo);
  if(!r) return false;
  const n = schritte || 6;
  await p.mouse.move(r.x, r.y);
  await p.mouse.down();
  for(let i = 1; i <= n; i++){
    await p.mouse.move(r.x, r.y + dy * i / n);
    await p.waitForTimeout(16);
  }
  await p.mouse.up();
  await p.waitForTimeout(430);
  return true;
}

/* Ein echter Finger über das DevTools-Protokoll: Chromium rollt dabei
   wirklich, wie auf dem Telefon. Mit der Maus (oben) rollt nichts —
   deshalb sah keine Maus-Probe den Fehler im Kategorie-Blatt. */
async function finger(p, cdp, x, y, dy, schritte){
  const n = schritte || 12;
  await cdp.send("Input.dispatchTouchEvent", { type:"touchStart", touchPoints:[{ x, y }] });
  for(let i = 1; i <= n; i++){
    await cdp.send("Input.dispatchTouchEvent", { type:"touchMove", touchPoints:[{ x, y: y + dy * i / n }] });
    await p.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type:"touchEnd", touchPoints:[] });
  await p.waitForTimeout(650);
}
async function tippen(p, cdp, x, y){
  await cdp.send("Input.dispatchTouchEvent", { type:"touchStart", touchPoints:[{ x, y }] });
  await p.waitForTimeout(40);
  await cdp.send("Input.dispatchTouchEvent", { type:"touchEnd", touchPoints:[] });
  await p.waitForTimeout(300);
}
/* Mitte eines Elements, das wirklich obenauf liegt. */
async function mitte(p, sel){
  return p.evaluate(s => {
    for(const e of document.querySelectorAll(s)){
      const b = e.getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      if(b.width && y > 60 && y < innerHeight - 60 && e.contains(document.elementFromPoint(x, y))) return { x, y };
    }
    return null;
  }, sel);
}

/* ── Der geteilte Block ──────────────────────────────────────────── */
function geteilt(){
  console.log("\n══ Der geteilte WISCHZU-Block ══");
  const A = "/* ╔═══ WISCHZU · GETEILTER BLOCK · ANFANG";
  const E = "╚═══ WISCHZU · GETEILTER BLOCK · ENDE ═══════════════════════════╝ */";
  const quellen = [
    ["vorlagen/hub.vorlage.html", path.join(OBEN, "vorlagen", "hub.vorlage.html")],
    ["seiten/admin.html",         path.join(OBEN, "seiten", "admin.html")],
    ["seiten/kueche.html",        path.join(OBEN, "seiten", "kueche.html")]
  ].map(([name, pfad]) => {
    const t = fs.readFileSync(pfad, "utf8");
    const i = t.indexOf(A), j = t.indexOf(E);
    return { name, text: (i >= 0 && j > i) ? t.slice(i, j + E.length) : null };
  });
  const ohne = quellen.filter(q => !q.text);
  if(ohne.length){ ohne.forEach(q => ok(false, "Block fehlt in " + q.name)); return; }
  quellen.slice(1).forEach(q => ok(quellen[0].text === q.text,
    "wortgleich mit " + q.name,
    quellen[0].text === q.text ? quellen[0].text.length + " Zeichen" : "weicht ab"));
  /* Der Block darf sich auf nichts stützen, was es nur in einer Datei
     gibt — sonst trägt er in der zweiten nicht (§8.1e). */
  /* Mit Wortgrenze gesucht: „t(" allein trifft auch setTimeout( und
     getBoundingClientRect( — mein erster Anlauf meldete genau das
     als Fehler. Ein Werkzeug, das Fehlalarm schlägt, bringt einem
     bei, es zu übergehen (§8.2). */
  /* Kommentare vorher weg: Der Block ERKLÄRT in seinem Kopf, dass er
     kein t() benutzt — und meine erste Fassung meldete genau diesen
     Satz als Verstoß. Ein Werkzeug, das Fehlalarm schlägt, bringt
     einem bei, es zu übergehen (§8.2). */
  const ohneKommentar = quellen[0].text
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const fremd = [/\bt\(/, /MARKENBLATT/, /BETRIEB\./, /\bEINST\./,
                 /\$\(/, /\bmelde\(/, /\bmelden\(/]
    .filter(r => r.test(ohneKommentar)).map(r => String(r));
  ok(fremd.length === 0, "der Block stützt sich auf nichts Fremdes",
    fremd.join(", ") || "rein");
}

/* ── Der Hub ─────────────────────────────────────────────────────── */
async function hub(br, ruhig){
  console.log("\n══ Hub" + (ruhig ? " · Bewegung reduziert" : "") + " ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844},
                                    reducedMotion: ruhig ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  /* Der Hub merkt sich den Willkommensschirm in sessionStorage, nicht
     in localStorage. Mit dem falschen Schlüssel stand der Schirm
     3,5 s über allem und fing je nach Tempo des Browsers den Finger
     ab — die Fingerprobe wurde dadurch rot und grün im Wechsel. */
  await p.addInitScript(() => { localStorage.setItem("omoteno-willkommen","1");
                                sessionStorage.setItem("omoteno-willkommen","1"); });
  await p.goto("file://" + path.join(OBEN, "dist", "chocolamour", "index.html"));
  await p.waitForTimeout(1100);

  const oeffnen = async () => {
    await p.evaluate(() => { location.hash = "#/speisekarte"; });
    await p.waitForTimeout(450);
    await p.evaluate(() => {
      const n = document.querySelector("[data-detail]");
      if(n) detailOeffnen(decodeURIComponent(n.dataset.detail));
    });
    await p.waitForTimeout(550);
    return p.evaluate(() => !!detailName);
  };

  ok(await oeffnen(), "das Gerichtfenster geht auf");
  ok(await ziehe(p, "#warenkarte .wgriff", 40), "ein kurzer Zug am Balken ist möglich");
  let a = await p.evaluate(() => ({ offen: !!detailName,
    inline: document.getElementById("warenkarte").style.transform }));
  ok(a.offen, "ein kurzer Zug schließt NICHT", a.offen ? "bleibt offen" : "zu");
  ok(a.inline === "", "und lässt keine Angabe am Element stehen",
    a.inline || "leer");

  await ziehe(p, "#warenkarte .wgriff", 320);
  a = await p.evaluate(() => ({ offen: !!detailName,
    klasse: document.getElementById("warenkarte").className,
    /* Gemessen wird der WIRKENDE Stil, nicht das Attribut (§8.1c). */
    sichtbar: getComputedStyle(document.getElementById("warenkarte")).transform,
    inline: document.getElementById("warenkarte").style.transform }));
  ok(!a.offen, "ein langer Zug schließt", a.offen ? "noch offen" : "zu");
  ok(!/\ban\b/.test(a.klasse), "die Klasse „an“ ist weg", a.klasse);
  ok(a.inline === "", "keine Inline-Angabe bleibt zurück", a.inline || "leer");

  await oeffnen();
  await ziehe(p, "#warenkarte [data-wzu]", 320);
  const b = await p.evaluate(() => !!detailName);
  ok(b, "auf einem Knopf fängt keine Geste an", b ? "bleibt offen" : "ZU");
  await p.evaluate(() => detailSchliessen());
  await p.waitForTimeout(300);

  await p.evaluate(() => storyOeffnen([{ n:"Nutella Crêpe", m:1 }]));
  await p.waitForTimeout(1300);
  await ziehe(p, "#story .wgriff", 340);
  ok(await p.evaluate(() => document.getElementById("story").hidden),
    "auch das Besuchsbild lässt sich herunterziehen");

  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}

/* ── Das Board ───────────────────────────────────────────────────── */
async function board(br){
  console.log("\n══ Board ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + path.join(OBEN, "seiten", "admin.html"));
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); }
  });
  await p.waitForTimeout(400);
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(300); }

  await p.evaluate(() => { $("#impBlatt").hidden = false; });
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById("impBlatt").hidden),
    "ein Blatt des Boards geht auf");

  await ziehe(p, "#impBlatt .griff", 40);
  ok(await p.evaluate(() => !document.getElementById("impBlatt").hidden),
    "ein kurzer Zug schließt es NICHT");

  await ziehe(p, "#impBlatt .griff", 320);
  const a = await p.evaluate(() => ({
    zu: document.getElementById("impBlatt").hidden,
    inline: document.querySelector("#impBlatt .blattinhalt").style.transform }));
  ok(a.zu, "ein langer Zug schließt es", a.zu ? "zu" : "noch offen");
  ok(a.inline === "", "keine Inline-Angabe bleibt zurück", a.inline || "leer");

  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}

/* ── Jedes Blatt des Boards ist wegwischbar (Quelltext gegen Quelltext) ───
   Anlass 25.10. (Nutzer, Foto): Im Blatt „Karten“ ließ sich nichts wegwischen,
   „man hängt fest“. `#kvBlatt` fehlte in blaetterWischbar(): der Griff war
   Zierde, geschlossen ging es nur über „Abbrechen“ ganz unten (bis 20 Zeilen
   lang). Jede Wisch-Prüfung hatte EIN Blatt angesehen (§8.1b: eine Prüfung über
   das Vorhandene ist blind für das Fehlende). Zweite Quelle hier: ALLE
   `.blatt` mit `.blattinhalt` aus dem Auszeichnungstext. */
function alleBlaetter(){
  console.log("\n══ Board · jedes Blatt steht in blaetterWischbar() ══");
  const html = fs.readFileSync(ADMIN_PFAD, "utf8");
  const liste = (html.match(/\(function blaetterWischbar\(\)\{[\s\S]*?\.forEach\(function\(paar\)/) || [""])[0];
  ok(liste.length > 200, "Voraussetzung: die Liste in blaetterWischbar() ist gefunden", liste.length + " Zeichen");
  /* jedes <div class="blatt…" id="X"> samt Inhalt bis zum nächsten Blatt */
  const ids = [];
  html.replace(/<div class="blatt(?: [^"]*)?" id="([A-Za-z]+)"([\s\S]*?)(?=<div class="blatt(?: [^"]*)?" id="|<\/body>)/g, (m, id, rest) => {
    if(/class="blattinhalt/.test(rest.slice(0, 400))) ids.push(id);
    return m;
  });
  ok(ids.length >= 14, "Voraussetzung: das Board hat mindestens 14 Blätter mit Inhalt (sonst findet der Auszug nichts)", ids.length + ": " + ids.join(", "));
  const fehlt = ids.filter(id => liste.indexOf('"#' + id + '"') < 0);
  ok(fehlt.length === 0, "jedes Blatt hat seinen Eintrag zum Wegwischen", fehlt.length ? "OHNE: " + fehlt.join(", ") : ids.length + " von " + ids.length);
  ok(ids.includes("kvBlatt") && ids.includes("bnBlatt") && ids.includes("teamBlatt"), "die drei, die fehlten (Karten, Banner-Zuschnitt, Team), sind im Auszug");
}

/* ── Blatt „Karten“ mit dem Finger, mit 20 Karten ─────────────────────────── */
async function kartenBlatt(br){
  console.log("\n══ Board · Finger · Blatt „Karten“ (20 Zeilen) ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  await p.addInitScript(() => { Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + ADMIN_PFAD);
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); }
  });
  await p.waitForTimeout(400);
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(300); }
  const cdp = await ctx.newCDPSession(p);
  const offen = () => p.evaluate(() => !document.getElementById("kvBlatt").hidden);
  const oeffnen = async () => {
    await p.evaluate(() => {
      kvOeffnen();
      /* bis zur Höchstzahl auffüllen: so lang wie bei der Meldung */
      while(kvEntwurf.length < 20) kvEntwurf.push({ id: "k-t" + kvEntwurf.length, name: "Karte " + kvEntwurf.length, unter: "", kategorien: [] });
      kvZeichnen();
    });
    await p.waitForTimeout(700);
    return p.evaluate(() => !document.getElementById("kvBlatt").hidden && document.querySelectorAll("#kvListe .kv-zeile").length >= 20);
  };
  ok(await oeffnen(), "Voraussetzung: das Blatt ist offen und zeigt 20 Karten-Zeilen");
  const m = await p.evaluate(() => { const i = document.querySelector("#kvBlatt .blattinhalt"); return { max: i.scrollHeight - i.clientHeight, inline: i.style.transform }; });
  ok(m.max > 300, "Voraussetzung: das Blatt ist deutlich länger als der Schirm", m.max + " px");
  const g = await p.evaluate(() => { const b = document.querySelector("#kvBlatt .griff").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, h: b.height }; });
  /* kurzer Zug schließt nicht */
  await finger(p, cdp, g.x, g.y, 40);
  ok(await offen(), "ein kurzer Zug am Griff schließt NICHT");
  /* langer Zug schließt */
  await finger(p, cdp, g.x, g.y, 320);
  ok(!(await offen()), "ein langer Zug am Griff schließt das Blatt");
  ok(await p.evaluate(() => document.querySelector("#kvBlatt .blattinhalt").style.transform === ""), "keine Inline-Angabe bleibt zurück");
  /* nach dem Schließen ist das Board bedienbar: wieder öffnen geht */
  ok(await oeffnen(), "danach lässt es sich wieder öffnen (man hängt nicht fest)");
  /* ganz nach unten gerollt, dann am oberen Rand wischen: oben schließt der Wisch erst, wenn ganz oben */
  await p.evaluate(() => { document.querySelector("#kvBlatt .blattinhalt").scrollTop = 0; });
  const t = await p.evaluate(() => { const b = document.querySelector("#kvBlatt .blatttitel").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await finger(p, cdp, t.x, t.y, 320);
  ok(!(await offen()), "ein langer Zug am Titel (Blatt ganz oben) schließt es ebenfalls");
  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}

/* ── Das Board mit dem Finger: Kategorie-Blatt ─────────────────── */
async function boardFinger(br){
  console.log("\n══ Board · Finger · Kategorie bearbeiten ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  /* „Scharf schalten" geht in den Vollbildmodus, und der kopflose
     Schirm ist 800×600. Danach landete jeder Finger unterhalb von
     y≈590 im Board statt im Blatt — gemessen, und ich hätte es fast
     für den Fehler gehalten. Vollbild ist hier Messfehler, nicht
     Gegenstand; pruef-vollbild.js prüft es für sich. */
  await p.addInitScript(() => { Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + path.join(OBEN, "seiten", "admin.html"));
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); }
  });
  await p.waitForTimeout(400);
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(300); }
  const cdp = await ctx.newCDPSession(p);

  const oeffnen = async () => {
    await p.evaluate(() => { const k = katNamen(welcheKarte)[0]; if(k) ktedOeffnen(k); });
    await p.waitForTimeout(800);
    return p.evaluate(() => !document.getElementById("ktedBlatt").hidden &&
      document.querySelectorAll("#ktedWahl .kted-zeichen").length > 20 && !document.fullscreenElement);
  };
  const stand = () => p.evaluate(() => {
    const i = document.querySelector("#ktedBlatt .blattinhalt");
    return { offen: !document.getElementById("ktedBlatt").hidden, oben: Math.round(i.scrollTop),
             max: i.scrollHeight - i.clientHeight, inline: i.style.transform, board: Math.round(scrollY) };
  });

  const auf = await oeffnen();
  ok(auf, "das Blatt geht auf, das Raster ist gezeichnet, kein Vollbild");
  if(!auf){ ok(false, "Fingerproben", "nichts offen — nicht prüfbar"); await ctx.close(); return; }

  const zweite = await p.evaluate(() => [...document.querySelectorAll("#ktedBlatt .blattinhalt *")]
    .filter(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1)
    .map(e => e.id || e.className));
  ok(zweite.length === 0, "im Blatt liegt kein zweiter Scrollbereich", zweite.join(", ") || "einer");

  let a = await stand();
  ok(a.max > 100, "das Blatt ist länger als der Schirm (sonst prüft das Folgende nichts)", a.max + " px");
  const rast = await mitte(p, "#ktedWahl .kted-zeichen");
  for(let k = 0; k < 8; k++) await finger(p, cdp, 195, 700, -450);
  a = await stand();
  ok(a.oben >= a.max - 2, "Wische auf dem Raster rollen das Blatt bis ans Ende", a.oben + " von " + a.max);
  const sichern = await p.evaluate(() => {
    const b = document.getElementById("ktedSichern").getBoundingClientRect();
    const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { y: Math.round(b.top), trifft: !!e && !!e.closest("#ktedSichern") };
  });
  ok(sichern.trifft, "„Sichern“ ist danach erreichbar", "y=" + sichern.y);

  const vorher = a.oben;
  await finger(p, cdp, 195, 250, 300);
  a = await stand();
  ok(a.offen && a.oben < vorher, "gescrollt: ein Wisch nach unten rollt zurück und schließt NICHT",
    (a.offen ? "offen" : "ZU") + ", " + vorher + " → " + a.oben);

  await p.evaluate(() => { document.querySelector("#ktedBlatt .blattinhalt").scrollTop = 0; });
  await p.waitForTimeout(200);
  const gewaehlt = () => p.evaluate(() =>
    (document.querySelector('#ktedWahl [aria-checked="true"]') || {}).dataset?.zeichen || null);
  const g0 = await gewaehlt();
  const k = await mitte(p, "#ktedWahl .kted-zeichen");
  /* Langsam, wie ein Finger, der nur verrutscht: 30 px in 10 Zügen.
     In vier Zügen wären es 0,6 px/ms — ein Wurf, und der schließt
     zu Recht. */
  await finger(p, cdp, k.x, k.y, 30, 10);
  a = await stand();
  ok(a.offen && a.inline === "", "oben: ein kurzer Zug auf einem Knopf federt zurück",
    (a.offen ? "offen" : "ZU") + ", " + (a.inline || "keine Angabe"));
  ok(await gewaehlt() === g0, "und wählt dabei kein Zeichen", String(await gewaehlt()));

  await finger(p, cdp, k.x, k.y, 380);
  a = await stand();
  ok(!a.offen, "oben: ein langer Wisch auf dem Raster schließt", a.offen ? "noch offen" : "zu");
  ok(a.inline === "", "keine Inline-Angabe bleibt zurück", a.inline || "leer");
  ok(await gewaehlt() === g0, "der Wisch hat kein Zeichen gewählt", String(await gewaehlt()));

  await oeffnen();
  const k2 = await p.evaluate(() => {
    const e = [...document.querySelectorAll("#ktedWahl .kted-zeichen")].find(x => x.getAttribute("aria-checked") !== "true");
    const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, code: e.dataset.zeichen };
  });
  await tippen(p, cdp, k2.x, k2.y);
  ok(await gewaehlt() === k2.code, "Antippen wählt weiterhin", String(await gewaehlt()) + " / " + k2.code);
  a = await stand();
  ok(a.offen && a.inline === "", "und bewegt das Blatt nicht", a.inline || "ruhig");

  /* Der Schleier über dem Blatt: Dort gibt es nichts zu rollen. */
  await p.evaluate(() => scrollTo(0, 0));
  const hoch = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const schleier = await p.evaluate(() => {
    const t = document.querySelector("#ktedBlatt .blattinhalt").getBoundingClientRect().top;
    const e = document.elementFromPoint(195, Math.max(4, t - 20));
    return { y: Math.max(4, t - 20), trifft: e && e.id === "ktedBlatt" };
  });
  if(hoch > 50 && schleier.trifft){
    await finger(p, cdp, 195, schleier.y, -200, 8);
    a = await stand();
    ok(a.board === 0, "ein Wisch auf dem Schleier rollt das Board NICHT", "scrollY " + a.board);
  }else{
    ok(false, "ein Wisch auf dem Schleier rollt das Board NICHT",
      "nicht prüfbar: Board " + hoch + " px rollbar, Schleier " + (schleier.trifft ? "da" : "nicht getroffen"));
  }

  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}

/* ── Der Hub mit dem Finger: Besuchsbild ───────────────────────── */
async function hubFinger(br){
  console.log("\n══ Hub · Finger · Besuchsbild ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  /* Der Hub merkt sich den Willkommensschirm in sessionStorage, nicht
     in localStorage. Mit dem falschen Schlüssel stand der Schirm
     3,5 s über allem und fing je nach Tempo des Browsers den Finger
     ab — die Fingerprobe wurde dadurch rot und grün im Wechsel. */
  await p.addInitScript(() => { localStorage.setItem("omoteno-willkommen","1");
                                sessionStorage.setItem("omoteno-willkommen","1"); });
  await p.goto("file://" + path.join(OBEN, "dist", "chocolamour", "index.html"));
  await p.waitForTimeout(1100);
  const cdp = await ctx.newCDPSession(p);
  await p.evaluate(() => { location.hash = "#/speisekarte"; });
  await p.waitForTimeout(500);
  await p.evaluate(() => { scrollTo(0, 0); storyOeffnen([{ n:"Nutella Crêpe", m:1 }]); });
  await p.waitForTimeout(1300);
  const vor = await p.evaluate(() => ({ auf: !document.getElementById("story").hidden,
    hash: location.hash, oben: document.getElementById("story").scrollTop }));
  /* Die Voraussetzung selbst prüfen: Stünde der Hub schon auf der
     Startseite, sähe „springt nicht zur Startseite" immer grün aus. */
  const auf = vor.auf && vor.hash === "#/speisekarte" && vor.oben === 0;
  ok(auf, "das Besuchsbild geht auf, auf einer Unterseite, ganz oben", JSON.stringify(vor));
  if(auf){
    const z = await p.evaluate(() => {
      const b = document.getElementById("story").getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + 60 };
    });
    await finger(p, cdp, z.x, z.y, 360);
    const a = await p.evaluate(() => ({ zu: document.getElementById("story").hidden, hash: location.hash }));
    ok(a.zu, "ein Fingerwisch nach unten schließt es", a.zu ? "zu" : "offen");
    /* Das Zurück-Ziehen am oberen Rand hört auf document. Ohne
       stopPropagation zählte derselbe Wisch dort ein zweites Mal. */
    ok(a.hash === "#/speisekarte", "und springt NICHT zusätzlich zur Startseite", a.hash);
  }
  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}

/* ── Die Küche ───────────────────────────────────────────────────── */
async function kueche(br){
  console.log("\n══ Küche ══");
  const ctx = await br.newContext({ viewport:{width:1280,height:900} });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  /* Die Küche zeigt ohne Anmeldung nur das Tor — dieselbe Sitzung
     wie in pruef-telefonbon.js, sonst gibt es gar kein Blatt. */
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(u.includes("/auth/"))
      return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify({ access_token:"t", refresh_token:"r", expires_in:3600,
                               token_type:"bearer", user:{ id:"u1" } }) });
    if(u.includes("/rest/v1/betrieb_mitglieder"))
      return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ betrieb_id:"b1", nutzer_id:"u1", rolle:"inhaber" }]) });
    if(u.includes("/rest/v1/betriebe"))
      return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ id:"b1", name:"Prüfhaus", slug:"pruefhaus",
                                bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await p.addInitScript(() => {
    localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({
      access_token:"t", refresh_token:"r", expires_at: Math.floor(Date.now()/1000)+3600 }));
  });
  await p.goto("file://" + path.join(OBEN, "seiten", "kueche.html"));
  await p.waitForTimeout(1600);
  /* Über den KNOPF öffnen, nicht über die Funktion: Die ist im
     Küchenskript nicht global, und ein Aufruf von außen scheiterte
     lautlos — meine erste Fassung meldete deshalb „nichts offen".
     Von Hand bedient ist ohnehin der ehrlichere Weg. */
  const knopf = await p.$("#einstKnopf");
  if(knopf) await knopf.click();
  await p.waitForTimeout(600);

  const auf = await p.evaluate(() => !!document.querySelector(".decke .blatt"));
  ok(auf, "die Einstellungen gehen auf");
  /* Ohne dieses „wenn" bestanden die zwei Proben darunter auch dann,
     wenn gar nichts aufgegangen war: „nichts da" sieht aus wie
     „geschlossen". Genau das ist mir hier passiert. */
  if(!auf){
    ok(false, "ein kurzer Zug schließt sie NICHT", "nichts offen — nicht prüfbar");
    ok(false, "ein langer Zug schließt sie",       "nichts offen — nicht prüfbar");
  }else{
    await ziehe(p, ".decke .blatt .griff", 40);
    ok(await p.evaluate(() => !!document.querySelector(".decke .blatt")),
      "ein kurzer Zug schließt sie NICHT");

    await ziehe(p, ".decke .blatt .griff", 340);
    ok(await p.evaluate(() => !document.querySelector(".decke")),
      "ein langer Zug schließt sie");
  }

  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}

(async () => {
  if(!fs.existsSync(path.join(OBEN, "dist", "chocolamour", "index.html"))){
    console.error("Kein erzeugter Hub in dist/. Erst: node erzeuger/erzeuge-hub.js --alle");
    process.exit(1);
  }
  geteilt();
  const br = await chromium.launch();
  await hub(br, false);
  await hub(br, true);
  await board(br);
  alleBlaetter();
  await boardFinger(br);
  await kartenBlatt(br);
  await hubFinger(br);
  await kueche(br);
  await br.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Keine Fehler"));
  process.exit(fehler ? 1 : 0);
})();
