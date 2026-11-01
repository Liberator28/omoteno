/* ═══════════════════════════════════════════════════════════════════
   pruef-bestellkarten.js — Bestellkarten im Board: Restzeit der Zusage,
   Klappen bei vielen Bestellungen, Wischen Neu → In Arbeit → Fertig

     NODE_PATH=$(npm root -g) node pruefungen/pruef-bestellkarten.js

   Wunsch 11.10.: „Der Koch und Service soll sehen, wie viel Zeit von
   ihrer Bestellzusage noch übrig ist. Bestellungen sollen aufklappbar
   sein, ein Swipe nach links und es wird bearbeitet, noch ein Swipe und
   es ist fertig. … übersichtlich bei vielen Bestellungen.“

   1 · Naht: Block RESTZEIT in admin.html und kueche.html Zeichen für
       Zeichen gleich; die Küche rechnet mit ihm dieselbe Zahl.
   2 · Restzeit (Uhr fest): 20 Min zugesagt, vor 8 bestätigt → „Noch
       12 Min“; vor 17 → Vorwarnung; vor 25 → „Überzogen +5 Min“. Nach
       drei Minuten zieht der eigene Takt die Zahl am SELBEN Element
       nach — auch mit ausgeschalteter Mahnung (deren Neuzeichnen je
       Minute läuft nur, wenn sie an ist; ohne Takt stünde die Zahl).
       „In Arbeit“ ist nach Restzeit geordnet; Übersicht nennt
       „überzogen“.
   3 · Klappen: mehr als B_KLAPP_AB offen → „In Arbeit“ zu, „Neu“,
       „Zu prüfen“ und Rufe offen; echter Tipp öffnet, Wahl übersteht
       zeichneAlles(); Gegenfall wenige Bestellungen: nichts zu.
   4 · Wischen mit echtem Finger (CDP-Touch): Neu → genau eine Anfrage
       status=arbeit, zweiter Wisch → fertig; kurzer Wisch schreibt
       nichts und federt zurück; senkrechter Zug rollt; Wisch über einem
       Minuten-Knopf setzt KEINE Zusage; „Rückgängig“ stellt zurück;
       nur transform/opacity; reduzierte Bewegung ohne Animation.
   5 · Maße und Lesbarkeit: 360/1280 px kein Überlauf, ≥ 44 px, Schrift
       der Restzeit ≥ 4,5:1 in dunkel, hell, schwarz, weiß.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const KUECHE = path.join(OBEN, "seiten", "kueche.html");

let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if (!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };

function block(datei) {
  const s = fs.readFileSync(datei, "utf8");
  const a = s.indexOf("/* ═══ RESTZEIT · GETEILTER BLOCK"), b = s.indexOf("/* ═══ ENDE RESTZEIT");
  return a < 0 || b < 0 ? null : s.slice(a, b);
}

const T0 = new Date("2026-10-11T19:00:00").getTime();

async function boardAuf(browser, opt) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, opt || {}));
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  if (opt && opt.uhr) await s.clock.install({ time: T0 });
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await s.goto("file://" + ADMIN);
  await s.waitForTimeout(700);
  await s.evaluate(() => {
    document.getElementById("tor").hidden = true;
    demoStarten();
    const sch = document.getElementById("scharf"); if (sch) sch.hidden = true;
  });
  return { ctx, s, fehler };
}

/* Bestellungen setzen: [id, status, tisch, Minuten seit Bestätigung | null, {extra}] */
const setzen = (s, zeilen) => s.evaluate(z => {
  const vor = m => new Date(Date.now() - m * 60000).toISOString();
  bestellungen.length = 0;
  z.forEach(([id, status, tisch, seit, extra]) => bestellungen.push(Object.assign({
    id, betrieb_id: "B", quelle: "tisch", status, tisch, summe: 12.5, tisch_bestaetigt: true,
    positionen: [{ name: "Dubai Crêpe", menge: 2, preis: 5 }, { name: "Cola", menge: 1, preis: 2.5 }],
    notiz: null, zeitpunkt: vor(30), pruefen: false,
    wartezeit_min: seit === null ? null : 20, bestaetigt_um: seit === null ? null : vor(seit),
    kueche_fertig_um: null, theke_fertig_um: null, gebracht_um: null }, extra || {})));
  bestellungen.forEach(b => bekannt.add(b.id));
  Object.keys(zeigeStatus).forEach(k => zeigeStatus[k] = true);
  Object.keys(zeigeQuelle).forEach(k => zeigeQuelle[k] = true);
  bAuf.clear();
  zeichneBoard();
}, zeilen);

async function teil1und2(browser) {
  console.log("\n══ 1 · Naht: geteilter Block RESTZEIT ══");
  const a = block(ADMIN), k = block(KUECHE);
  pruef(!!a && !!k, "Block steht in admin.html und kueche.html");
  pruef(!!a && a === k, "Zeichen für Zeichen gleich", a && k ? (a.length + " / " + k.length) : "fehlt");

  console.log("\n══ 2 · Restzeit im Board (Uhr fest) ══");
  const { ctx, s, fehler } = await boardAuf(browser, { uhr: true });
  /* Die Vorführung schiebt nach 9 s eine Telefonbestellung ein und
     zeichnet neu — erst danach beginnt die Messung. */
  await s.clock.runFor(10000);
  await setzen(s, [["a1", "arbeit", "1", 8], ["a2", "arbeit", "2", 17], ["a3", "arbeit", "3", 25], ["a4", "arbeit", "4", null]]);
  const lese = id => s.evaluate(i => {
    const el = document.querySelector(`.bestellung[data-id="${i}"] [data-rest]`);
    return el ? { wort: el.querySelector(".zt").textContent, zahl: el.querySelector(".zrestzahl").textContent,
      knapp: el.classList.contains("zknapp"), ueber: el.classList.contains("zueber"),
      balken: el.querySelector(".zbalken i").style.transform } : null;
  }, id);
  const r1 = await lese("a1"), r2 = await lese("a2"), r3 = await lese("a3");
  pruef(r1 && r1.wort === "Noch" && r1.zahl === "12 Min" && !r1.knapp && !r1.ueber, "vor 8 von 20 Min bestätigt: „Noch 12 Min“", JSON.stringify(r1));
  pruef(r1 && /scaleX\(0\.4\)/.test(r1.balken), "Balken zeigt den verbrauchten Anteil (40 %) per scaleX", r1 && r1.balken);
  pruef(r2 && r2.zahl === "3 Min" && r2.knapp, "letztes Fünftel: Vorwarnung", JSON.stringify(r2));
  pruef(r3 && r3.wort === "Überzogen" && r3.zahl === "+5 Min" && r3.ueber, "überzogen: „Überzogen +5 Min“", JSON.stringify(r3));
  const a4 = await s.evaluate(() => !!document.querySelector('.bestellung[data-id="a4"] [data-rest]'));
  pruef(!a4, "ohne Bestätigungszeit keine erfundene Restzeit");
  const folge = await s.evaluate(() => [...document.querySelectorAll("#karten .bestellung")].map(k => k.dataset.id).join(","));
  pruef(folge === "a3,a2,a1,a4", "„In Arbeit“: knappste Zusage zuerst, ohne Zusage dahinter", folge);
  const info = await s.evaluate(() => document.getElementById("filterInfo").textContent);
  pruef(/1 überzogen/.test(info), "Übersicht nennt „1 überzogen“", info);

  await s.evaluate(() => { EINST.mahnungAb = 0; });
  const vorher = await s.evaluateHandle(() => document.querySelector('.bestellung[data-id="a1"] [data-rest]'));
  await s.clock.runFor(3 * 60000 + 21000);
  await s.waitForTimeout(100);
  const nach = await s.evaluate(el => ({ dran: el.isConnected, zahl: el.querySelector(".zrestzahl").textContent }), vorher);
  pruef(nach.dran && nach.zahl === "9 Min", "Mahnung aus, 3 Minuten später: „9 Min“ am SELBEN Element", JSON.stringify(nach));

  /* Die Küche rechnet dieselbe Zahl (geteilter Block, nicht nur gleicher Text). */
  const k2 = await ctx.newPage();
  await k2.clock.install({ time: T0 });
  const bon = { id: "k1", betrieb_id: "B", quelle: "tisch", status: "arbeit", tisch: "4", positionen: [{ name: "Crêpe", menge: 1 }],
    notiz: null, zeitpunkt: new Date(T0 - 9 * 60000).toISOString(), wartezeit_min: 20, bestaetigt_um: new Date(T0 - 8 * 60000).toISOString(),
    kueche_fertig_um: null, theke_fertig_um: null, storno: [], pruefen: false };
  await k2.route("**/*", r => {
    const u = decodeURIComponent(r.request().url());
    const json = b => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (u.startsWith("file://")) return r.continue();
    if (u.includes("/rest/v1/bestellungen")) return json([bon]);
    if (u.includes("/rest/v1/betriebe")) return json([{ id: "B", name: "Prüfhaus" }]);
    if (u.includes("/auth/")) return json({ access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: { id: "u1" } });
    return json([]);
  });
  await k2.addInitScript(() => localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({ access_token: "t", refresh_token: "r",
    expires_at: Math.floor(Date.now() / 1000) + 3600 })));
  await k2.goto("file://" + KUECHE); await k2.waitForTimeout(1800);
  const kt = await k2.evaluate(() => (document.querySelector("#feld .bon") || {}).textContent || "");
  pruef(/noch/.test(kt) && /12′/.test(kt), "Küche: derselbe Bon zeigt „noch 12′“ (geteilter Block)", kt.replace(/\s+/g, " ").slice(0, 80));
  pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
  await ctx.close();
}

async function teil3(browser) {
  console.log("\n══ 3 · Klappen bei vielen Bestellungen ══");
  const { ctx, s, fehler } = await boardAuf(browser);
  const grenze = await s.evaluate(() => B_KLAPP_AB);
  pruef(grenze === 4, "Grenze aus dem Board gelesen", grenze);
  await setzen(s, [["n1", "neu", "1", null], ["p1", "neu", "2", null, { pruefen: true, pruef_grund: "Probe" }],
    ["r1", "neu", "3", null, { quelle: "service", positionen: [], notiz: "Rechnung bitte" }],
    ["a1", "arbeit", "4", 5], ["a2", "arbeit", "5", 9], ["a3", "arbeit", "6", null]]);
  const lage = () => s.evaluate(() => [...document.querySelectorAll("#karten .bestellung")].map(k => ({
    id: k.dataset.id, zu: k.classList.contains("bzu"), h: Math.round(k.getBoundingClientRect().height),
    knopf: (k.querySelector("[data-bklapp]") || {}).getAttribute ? k.querySelector("[data-bklapp]").getAttribute("aria-expanded") : null })));
  let l = await lage();
  const zu = l.filter(x => x.zu).map(x => x.id).sort().join(",");
  pruef(zu === "a1,a2,a3", "6 offen: genau die Karten „In Arbeit“ stehen zu", zu);
  pruef(["n1", "p1", "r1"].every(i => l.find(x => x.id === i && !x.zu)), "Neu, Zu prüfen und Serviceruf bleiben offen");
  const kurz = await s.evaluate(() => document.querySelector('.bestellung[data-id="a1"] .bklapp').textContent.replace(/\s+/g, " ").trim());
  pruef(/3 Gerichte/.test(kurz) && /Dubai Crêpe/.test(kurz) && /noch 15 Min/.test(kurz), "zugeklappt: Anzahl, Gerichte, Restzeit in einer Zeile", kurz);
  const hZu = l.find(x => x.id === "a1").h;
  await s.click('.bestellung[data-id="a1"] [data-bklapp]');
  await s.waitForTimeout(250);
  l = await lage();
  const a1 = l.find(x => x.id === "a1");
  pruef(!a1.zu && a1.knopf === "true" && a1.h > hZu + 60, "echter Tipp öffnet die Karte", JSON.stringify({ vorher: hZu, a1 }));
  const schritt = await s.evaluate(() => { const k = document.querySelector('.bestellung[data-id="a1"] .schritt[data-status="fertig"]'); return k ? k.getBoundingClientRect().height : 0; });
  pruef(schritt > 0, "offen: die Schritt-Knöpfe sind da", schritt);
  await s.evaluate(() => zeichneAlles()); await s.waitForTimeout(150);
  l = await lage();
  pruef(!l.find(x => x.id === "a1").zu && l.find(x => x.id === "a2").zu, "zeichneAlles(): geöffnete bleibt offen, die andere zu");
  /* Tipp auf den Kopf einer zugeklappten Karte öffnet ebenfalls */
  await s.click('.bestellung[data-id="a2"] .tischnr');
  await s.waitForTimeout(250);
  l = await lage();
  pruef(!l.find(x => x.id === "a2").zu, "Tipp auf den Kopf einer zugeklappten Karte öffnet sie");
  await s.click('.bestellung[data-id="a2"] [data-bklapp]');
  await s.waitForTimeout(250);
  l = await lage();
  pruef(l.find(x => x.id === "a2").zu, "„Zuklappen“ klappt wieder zu");
  /* Gegenfall: wenige offene Bestellungen → nichts zu */
  await setzen(s, [["n1", "neu", "1", null], ["a1", "arbeit", "4", 5], ["a2", "arbeit", "5", 9]]);
  l = await lage();
  pruef(l.every(x => !x.zu), "Gegenfall 3 offen: keine Karte zu", l.map(x => x.id + (x.zu ? "·zu" : "")).join(","));
  pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
  await ctx.close();
}

async function wisch(s, cdp, sel, anteil, opt) {
  const r = await s.evaluate(q => { const el = document.querySelector(q); el.scrollIntoView({ block: "center" });
    const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, sel);
  const o = opt || {};
  const x0 = o.x0 !== undefined ? o.x0 : r.x + r.w * 0.85, y0 = o.y0 !== undefined ? o.y0 : r.y + Math.min(40, r.h / 2);
  const dx = o.dy ? 0 : -r.w * anteil, dy = o.dy || 0;
  const schritte = o.schritte || 14;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  let mitte = null;
  for (let i = 1; i <= schritte; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + dx * i / schritte, y: y0 + dy * i / schritte }] });
    await s.waitForTimeout(o.langsam ? 40 : 16);
    if (i === Math.floor(schritte / 2) && o.neuzeichnen) await s.evaluate(() => zeichneBoard());
    if (i === Math.floor(schritte / 2) + 2 && o.neuzeichnen) await s.evaluate(id => {
      const el = document.querySelector(`.bestellung[data-id="${id}"]`);
      window.__nachLive = { tf: el ? el.style.transform : "", ziel: !!document.querySelector(".wischziel") };
    }, o.neuId);
    if (i === Math.floor(schritte / 2) && o.mitte) mitte = await s.evaluate(q => {
      const el = document.querySelector(q); const z = document.querySelector(".wischziel");
      return { tf: el ? el.style.transform : "", ziel: z ? z.textContent : null };
    }, sel);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  return mitte;
}

async function teil4(browser, ruhig) {
  console.log("\n══ 4 · Wischen mit echtem Finger" + (ruhig ? " (reduzierte Bewegung)" : "") + " ══");
  const { ctx, s, fehler } = await boardAuf(browser, { hasTouch: true, isMobile: true, reducedMotion: ruhig ? "reduce" : "no-preference" });
  const cdp = await ctx.newCDPSession(s);
  await setzen(s, [["n1", "neu", "1", null], ["n2", "neu", "2", null], ["a9", "arbeit", "9", 5],
    ["p1", "neu", "7", null, { pruefen: true, pruef_grund: "Probe" }]]);
  await s.evaluate(() => {
    window.__log = []; window.__anims = [];
    const kette = (op, felder) => {
      const k = { _f: [] };
      k.eq = (a, b) => { k._f.push(["eq", a, b]); return k; };
      k.in = (a, b) => { k._f.push(["in", a, b]); return k; };
      /* Wie PostgREST: .not() ist ein Filter, .select() fordert die geschriebenen Zeilen an — die Antwort nennt die
         lebenden Zeilen der id-Filter (eine storniert-Prüfung macht diese Gegenstelle nicht; das tut pruef-endstand.js). */
      k.not = (a, o, v) => { k._f.push(["not", a, o, v]); return k; };
      k.or = e => { k._f.push(["or", e]); return k; };
      k.select = () => { k._sel = true; return k; };
      k.then = (ok, nein) => { window.__log.push({ op, felder, filter: k._f });
        const ids = k._f.filter(y => y[1] === "id").flatMap(y => Array.isArray(y[2]) ? y[2] : [y[2]]);
        return Promise.resolve({ error: null, data: k._sel ? ids.map(id => ({ id })) : null }).then(ok, nein); };
      return k;
    };
    demo = false;
    db = { from: () => ({ update: felder => kette("update", felder) }), rpc: () => Promise.resolve({ data: null, error: null }),
      channel: () => ({ on() { return this; }, subscribe() { return this; } }) };
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (k, o) { window.__anims.push(Object.keys(Object.assign({}, ...(Array.isArray(k) ? k : [k]))).filter(x => x !== "offset" && x !== "easing")); return orig.call(this, k, o); };
  });
  const log = () => s.evaluate(() => window.__log.map(x => ({ f: x.felder, id: (x.filter.find(y => y[1] === "id") || [])[2] })));
  const status = id => s.evaluate(i => (bestellungen.find(b => b.id === i) || {}).status, id);

  /* kurzer Wisch: nichts */
  const karteVor = await s.evaluateHandle(() => document.querySelector('.bestellung[data-id="n1"]'));
  await wisch(s, cdp, '.bestellung[data-id="n1"]', 0.15);
  await s.waitForTimeout(400);
  const kurz = await s.evaluate(el => ({ dran: el.isConnected, tf: el.style.transform, ziel: !!document.querySelector(".wischziel") }), karteVor);
  pruef((await log()).length === 0 && await status("n1") === "neu", "kurzer Wisch (15 %) schreibt nichts", JSON.stringify(await log()));
  pruef(kurz.dran && !kurz.tf && !kurz.ziel, "… federt zurück, dieselbe Karte, Zielfläche weg", JSON.stringify(kurz));

  /* senkrechter Zug: rollt, schreibt nichts */
  await s.evaluate(() => { document.body.style.minHeight = "3000px"; window.scrollTo(0, 0); });
  const y0 = await s.evaluate(() => window.scrollY);
  const rr = await s.evaluate(() => { const b = document.querySelector('.bestellung[data-id="n2"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: Math.min(b.top + 60, 600) }; });
  await wisch(s, cdp, '.bestellung[data-id="n2"]', 0, { dy: -200, x0: rr.x, y0: rr.y });
  await s.waitForTimeout(500);
  const y1 = await s.evaluate(() => window.scrollY);
  pruef((await log()).length === 0, "senkrechter Zug schreibt nichts");
  pruef(y1 > y0 + 60, "… und rollt die Seite", y0 + " → " + y1);

  /* Wisch nach links auf Neu */
  const mitte = await wisch(s, cdp, '.bestellung[data-id="n1"]', 0.6, { mitte: true });
  await s.waitForTimeout(500);
  let l = await log();
  pruef(!!mitte && /translateX\(-\d/.test(mitte.tf) && /In Arbeit/.test(mitte.ziel || ""), "mitten im Zug: Karte folgt dem Finger, dahinter „In Arbeit“", JSON.stringify(mitte));
  pruef(l.length === 1 && l[0].f.status === "arbeit" && l[0].id === "n1" && !("wartezeit_min" in l[0].f), "Wisch links auf „Neu“: genau eine Anfrage status=arbeit", JSON.stringify(l));
  pruef(await status("n1") === "arbeit", "… und die Karte steht in Arbeit");
  const rueck = await s.evaluate(() => { const r = document.getElementById("rueckleiste"); const k = r.querySelector("button").getBoundingClientRect();
    return { da: !r.hidden, text: r.textContent, h: k.height }; });
  pruef(rueck.da && /Tisch 1/.test(rueck.text) && /In Arbeit/.test(rueck.text) && rueck.h >= 44, "„Rückgängig“ steht unten, nennt Tisch und Stufe, ≥ 44 px", JSON.stringify(rueck));

  /* zweiter Wisch: fertig */
  await s.waitForTimeout(400);
  await wisch(s, cdp, '.bestellung[data-id="n1"]', 0.6);
  await s.waitForTimeout(500);
  l = await log();
  pruef(l.length === 2 && l[1].f.status === "fertig" && l[1].id === "n1", "zweiter Wisch: fertig", JSON.stringify(l[1]));

  /* Rückgängig */
  await s.click("#rueckleiste button");
  await s.waitForTimeout(400);
  l = await log();
  pruef(l.length === 3 && l[2].f.status === "arbeit" && l[2].id === "n1", "„Rückgängig“ stellt den alten Stand zurück", JSON.stringify(l[2]));
  pruef(await s.evaluate(() => document.getElementById("rueckleiste").hidden), "… und die Leiste geht");

  /* Wisch, der auf einem Minuten-Knopf beginnt: keine Zusage */
  await s.waitForTimeout(400);
  const zm = await s.evaluate(() => { const b = document.querySelector('.bestellung[data-id="n2"] .zmin'); b.scrollIntoView({ block: "center" });
    const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await wisch(s, cdp, '.bestellung[data-id="n2"]', 0.6, { x0: zm.x + 200 > 380 ? zm.x : zm.x + 150, y0: zm.y });
  await s.waitForTimeout(500);
  l = await log();
  const n2 = l.filter(x => x.id === "n2");
  pruef(n2.length === 1 && n2[0].f.status === "arbeit" && !("wartezeit_min" in n2[0].f), "Wisch über einem Minuten-Knopf: Status, aber KEINE Zusage", JSON.stringify(n2));

  /* Dasselbe mit der Maus (Board am Tresen): Zug ab einem Minuten-Knopf */
  if (!ruhig) {
    await s.evaluate(() => { const b = bestellungen.find(x => x.id === "n2"); b.status = "neu"; b.wartezeit_min = null; zeichneBoard(); });
    const mz = await s.evaluate(() => { const z = document.querySelector('.bestellung[data-id="n2"] .zmin'); z.scrollIntoView({ block: "center" });
      const q = z.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    const vorMaus = (await log()).length;
    await s.mouse.move(mz.x, mz.y); await s.mouse.down();
    for (let i = 1; i <= 14; i++) { await s.mouse.move(mz.x - 220 * i / 14, mz.y); await s.waitForTimeout(16); }
    await s.mouse.up(); await s.waitForTimeout(500);
    const lm = (await log()).slice(vorMaus);
    pruef(lm.length === 1 && lm[0].f.status === "arbeit" && !("wartezeit_min" in lm[0].f), "Maus-Zug ab einem Minuten-Knopf: Status, KEINE Zusage", JSON.stringify(lm));
  }

  /* Zu prüfen ist nicht wischbar */
  await wisch(s, cdp, '.bestellung[data-id="p1"]', 0.6);
  await s.waitForTimeout(400);
  pruef(!(await log()).some(x => x.id === "p1"), "„Zu prüfen“ lässt sich nicht wegwischen");

  /* Knopf bleibt Zweitweg */
  /* Die Vorführung schiebt nach 9 s eine Telefonbestellung ein — dann
     wären es fünf offene und „In Arbeit“ stünde zu (gewollt). */
  await s.evaluate(() => { document.getElementById("rueckleiste").hidden = true;
    const i = bestellungen.findIndex(b => b.id === "demo-neu"); if (i >= 0) bestellungen.splice(i, 1); zeichneBoard();
    document.querySelector('.bestellung[data-id="a9"] .schritt[data-status="fertig"]').scrollIntoView({ block: "center" }); });
  await s.click('.bestellung[data-id="a9"] .schritt[data-status="fertig"]');
  await s.waitForTimeout(300);
  l = await log();
  pruef(l[l.length - 1].id === "a9" && l[l.length - 1].f.status === "fertig", "Knopf „Fertig“ schreibt wie bisher");

  /* Live-Daten kommen mitten im Zug an (zeichneBoard): der Wisch gilt
     trotzdem, und die Karte unter dem Finger wird nicht ersetzt. */
  await s.evaluate(() => { document.getElementById("rueckleiste").hidden = true; zeichneBoard(); });
  const vorLive = (await log()).length;
  await wisch(s, cdp, '.bestellung[data-id="n2"]', 0.6, { neuzeichnen: true, neuId: "n2" });
  await s.waitForTimeout(500);
  l = await log();
  pruef(l.length === vorLive + 1 && l[l.length - 1].id === "n2" && l[l.length - 1].f.status === "fertig",
    "Live-Neuzeichnen mitten im Zug: der Wisch gilt trotzdem (n2 → fertig)", JSON.stringify(l.slice(vorLive)));
  const nl = await s.evaluate(() => window.__nachLive);
  pruef(nl && /translateX\(-\d/.test(nl.tf) && nl.ziel, "… und die Karte unter dem Finger bleibt dieselbe, gleitet weiter", JSON.stringify(nl));

  const anims = await s.evaluate(() => window.__anims);
  if (ruhig) pruef(anims.length === 0, "reduzierte Bewegung: keine Animation, Wirkung gleich", JSON.stringify(anims));
  else pruef(anims.length > 0 && anims.every(k => k.every(x => x === "transform" || x === "opacity")), "nur transform/opacity animiert", JSON.stringify(anims));
  pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
  await ctx.close();
}

function hell(rgb) {
  const l = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}

async function teil5(browser) {
  console.log("\n══ 5 · Maße und Lesbarkeit ══");
  for (const breite of [360, 1280]) {
    const { ctx, s, fehler } = await boardAuf(browser, { viewport: { width: breite, height: 900 } });
    await setzen(s, [["n1", "neu", "1", null], ["a1", "arbeit", "4", 5], ["a2", "arbeit", "5", 17], ["a3", "arbeit", "6", 25],
      ["a4", "arbeit", "7", 2], ["a5", "arbeit", "8", null]]);
    await s.click('.bestellung[data-id="a3"] [data-bklapp]'); await s.waitForTimeout(200);
    for (const licht of ["dunkel", "hell", "schwarz", "weiss"]) {
      await s.evaluate(w => { EINST.licht = w; lichtAnwenden(); zeichneBoard(); }, licht);
      await s.waitForTimeout(350);
      const m = await s.evaluate(() => {
        const rgb = c => { const x = String(c).match(/[\d.]+/g).map(Number); return /color\(srgb/.test(c) ? { v: x.slice(0, 3).map(y => y * 255), a: x[3] ?? 1 } : { v: x.slice(0, 3), a: x[3] ?? 1 }; };
        const grund = el => { const schichten = []; for (let e = el; e; e = e.parentElement) { const b = rgb(getComputedStyle(e).backgroundColor); if (b.a > 0.01) { schichten.push(b); if (b.a >= 0.99) break; } }
          let v = schichten.length ? schichten[schichten.length - 1].v : [0, 0, 0];
          for (let i = schichten.length - 2; i >= 0; i--) v = v.map((x, j) => schichten[i].v[j] * schichten[i].a + x * (1 - schichten[i].a));
          return v; };
        const els = [...document.querySelectorAll("#karten .zrestzahl, #karten .zrestkurz, #karten .bkurz, #karten .zrest .zt, #karten .zvon")].filter(e => e.getBoundingClientRect().height > 0);
        const paare = els.map(e => ({ k: e.className, f: rgb(getComputedStyle(e).color).v, g: grund(e) }));
        const kn = [...document.querySelectorAll("#karten [data-bklapp]")].map(b => b.getBoundingClientRect().height);
        return { paare, kn, ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      const schlecht = m.paare.map(p => { const a = hell(p.f), b = hell(p.g); return { k: p.k, r: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }; })
        .sort((x, y) => x.r - y.r);
      pruef(m.paare.length >= 5 && schlecht[0].r >= 4.5, breite + " px " + licht + ": Restzeit-Schrift ≥ 4,5:1", schlecht[0] ? schlecht[0].k + " " + schlecht[0].r.toFixed(2) : "keine");
      pruef(m.kn.every(h => h >= 44) && m.ueber <= 0, breite + " px " + licht + ": Klappknopf ≥ 44 px, kein Überlauf", JSON.stringify({ kn: Math.min(...m.kn), ueber: m.ueber }));
    }
    pruef(!fehler.length, breite + " px: keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }
}

const SQL_TM = fs.readFileSync(path.join(OBEN, "datenbank", "migration-teammodus.sql"), "utf8");

/* Gestelltes db: liest team_modus und team_nummern, schreibt in __log. */
const DB_STELLEN = ({ modus, nummern, fehlt }) => {
  window.__log = [];
  const kette = (tab, op, felder) => {
    const k = { _f: [] };
    k.eq = (a, b) => { k._f.push(["eq", a, b]); return k; };
    k.in = (a, b) => { k._f.push(["in", a, b]); return k; };
    k.maybeSingle = () => Promise.resolve(fehlt ? { data: null, error: { code: "42703", message: "column does not exist" } }
      : { data: tab === "betriebe" ? { team_modus: modus } : null, error: null });
    k.not = (a, o, v) => { k._f.push(["not", a, o, v]); return k; };
    k.or = e => { k._f.push(["or", e]); return k; };
    k.select = () => { k._sel = true; return k; };
    k.then = (ok, nein) => { window.__log.push({ tab, op, felder, filter: k._f });
      const ids = k._f.filter(y => y[1] === "id").flatMap(y => Array.isArray(y[2]) ? y[2] : [y[2]]);
      return Promise.resolve({ error: null, data: k._sel ? ids.map(id => ({ id })) : null }).then(ok, nein); };
    return k;
  };
  demo = false; betriebId = "B";
  db = { from: tab => ({ select: c => kette(tab, "select", c), update: f => kette(tab, "update", f) }),
    rpc: (name, arg) => { window.__log.push({ rpc: name, arg }); return Promise.resolve(fehlt ? { data: null, error: { code: "PGRST202" } } : { data: nummern, error: null }); },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }) };
};
const NUMMERN = [{ nummer: 1, name: "Inhaber", rolle: "inhaber", ich: true }, { nummer: 2, name: "Ali", rolle: "team", ich: false },
  { nummer: 3, name: "Mia", rolle: "team", ich: false }];

async function teil6(browser) {
  console.log("\n══ 6 · Team-Modus ══");
  /* Naht gegen die Migration (zweite Quelle) */
  const html = fs.readFileSync(ADMIN, "utf8"), kue = fs.readFileSync(KUECHE, "utf8");
  const artSql = (SQL_TM.match(/'art', 'fair'\) in \(([^)]*)\)/) || [])[1] || "";
  const artBoard = [...html.matchAll(/data-tm-art="(\w+)"/g)].map(m => m[1]);
  pruef(artBoard.length === 3 && artBoard.every(a => artSql.includes("'" + a + "'")), "jede Art des Boards steht in der CHECK-Schranke", artBoard.join(",") + " ⊆ " + artSql);
  pruef(/create or replace function public\.team_nummern\(p_betrieb uuid\)/.test(SQL_TM) && /rpc\("team_nummern", \{ p_betrieb: id \}\)/.test(html),
    "team_nummern: Parameter p_betrieb in SQL und Board");
  pruef(/add column if not exists zugewiesen smallint/.test(SQL_TM) && /update\(\{ zugewiesen: neu \}\)/.test(html) && /"zugewiesen,"\s*\+/.test(kue),
    "Spalte zugewiesen: angelegt, vom Board geschrieben, von der Küche gelesen");
  pruef(/add column if not exists team_modus jsonb/.test(SQL_TM) && /select\("team_modus"\)/.test(html), "Spalte team_modus: angelegt und gelesen");

  const { ctx, s, fehler } = await boardAuf(browser);
  await setzen(s, [["n1", "neu", "1", null], ["a1", "arbeit", "4", 5, { zugewiesen: 2 }], ["a2", "arbeit", "5", 9, { zugewiesen: 1 }]]);
  await s.evaluate(DB_STELLEN, { modus: { an: true, art: "fair", dienst: [1, 2] }, nummern: NUMMERN, fehlt: false });
  await s.evaluate(() => { ROLLE = "inhaber"; localStorage.removeItem("omoteno-geraet-nr-B"); return teamLaden("B"); });
  await s.waitForTimeout(200);
  const knopf = await s.evaluate(() => ({ p: document.getElementById("teamKnopf").getAttribute("aria-pressed"), t: document.getElementById("teamKnopf").textContent.replace(/\s+/g, " ").trim(),
    h: document.getElementById("teamKnopf").getBoundingClientRect().height }));
  pruef(knopf.p === "true" && /gerecht/.test(knopf.t) && /ich: 1 · Inhaber/.test(knopf.t) && knopf.h >= 44, "Knopf trägt Stellung, Art und die Nummer dieses Geräts (Vorgabe: mein Konto)", JSON.stringify(knopf));
  const zuw = await s.evaluate(() => [...document.querySelectorAll("[data-tmzuw]")].map(x => ({ id: x.dataset.tmzuw, v: x.value,
    text: x.selectedOptions[0].textContent, opts: [...x.options].map(o => o.value).join(","), meins: x.classList.contains("meins"), h: x.getBoundingClientRect().height })));
  const a1 = zuw.find(x => x.id === "a1"), a2 = zuw.find(x => x.id === "a2");
  pruef(a1 && a1.v === "2" && /2 · Ali/.test(a1.text) && a1.opts === ",1,2", "Karte zeigt den Zuständigen, Wahl nur aus dem Dienst", JSON.stringify(a1));
  pruef(a2 && a2.meins && zuw.every(x => x.h >= 44), "eigene Bestellung hervorgehoben, Wahl ≥ 44 px", JSON.stringify(a2));
  await s.selectOption('[data-tmzuw="a1"]', "1");
  await s.waitForTimeout(200);
  let log = await s.evaluate(() => window.__log.filter(x => x.op === "update"));
  pruef(log.length === 1 && log[0].tab === "bestellungen" && log[0].felder.zugewiesen === 1 && log[0].filter.some(f => f[1] === "id" && f[2] === "a1"),
    "Umhängen schreibt genau zugewiesen=1 für diese Bestellung", JSON.stringify(log));
  /* Nur meine */
  await s.click("#nurMeine"); await s.waitForTimeout(150);
  const meine = await s.evaluate(() => [...document.querySelectorAll("#karten .bestellung")].map(k => k.dataset.id).sort().join(","));
  pruef(meine === "a1,a2", "„Nur meine“ zeigt nur die Bestellungen von Nr. 1", meine);
  await s.click("#nurMeine"); await s.waitForTimeout(150);

  /* Blatt als Besitzer: Mia in den Dienst, zufällig, Übernehmen */
  await s.click("#teamKnopf"); await s.waitForTimeout(250);
  await s.click('[data-tm-dienst="3"]'); await s.click('[data-tm-art="zufall"]');
  await s.evaluate(() => { window.__log = []; });
  await s.click("#teamSichern"); await s.waitForTimeout(300);
  log = await s.evaluate(() => window.__log.filter(x => x.op === "update"));
  pruef(log.length === 1 && log[0].tab === "betriebe" && JSON.stringify(log[0].felder.team_modus) === '{"an":true,"art":"zufall","dienst":[1,2,3]}',
    "Besitzer: Übernehmen schreibt team_modus genau so", JSON.stringify(log[0] && log[0].felder));
  /* niemand im Dienst → Satz, nichts geschrieben */
  await s.click("#teamKnopf"); await s.waitForTimeout(250);
  for (const n of [1, 2, 3]) await s.click(`[data-tm-dienst="${n}"]`);
  await s.click('[data-tm-art="fair"]');
  await s.evaluate(() => { window.__log = []; });
  await s.click("#teamSichern"); await s.waitForTimeout(200);
  const leer = await s.evaluate(() => ({ satz: document.getElementById("teamStand").textContent, n: window.__log.length }));
  pruef(leer.n === 0 && /mindestens eine Person/.test(leer.satz), "niemand im Dienst: Satz statt Schreiben", JSON.stringify(leer));
  await s.click("#teamZu"); await s.waitForTimeout(400);

  /* Als Team: Blatt gesperrt, „Dieses Gerät“ geht und bleibt über ein Neuladen */
  await s.evaluate(() => { ROLLE = "team"; });
  await s.click("#teamKnopf"); await s.waitForTimeout(250);
  const team = await s.evaluate(() => ({ satz: !document.getElementById("teamNurBesitzer").hidden, sichern: document.getElementById("teamSichern").hidden,
    gesperrt: [...document.querySelectorAll("#teamBesitzer button")].every(b => b.disabled) }));
  pruef(team.satz && team.sichern && team.gesperrt, "Team: Satz, keine Bedienung, kein Übernehmen", JSON.stringify(team));
  await s.selectOption("#teamGeraet", "3"); await s.waitForTimeout(150);
  await s.reload(); await s.waitForTimeout(700);
  await s.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten();
    const sch = document.getElementById("scharf"); if (sch) sch.hidden = true; });
  await s.evaluate(DB_STELLEN, { modus: { an: true, art: "fair", dienst: [1, 2, 3] }, nummern: NUMMERN, fehlt: false });
  await s.evaluate(() => teamLaden("B")); await s.waitForTimeout(200);
  const nachLaden = await s.evaluate(() => TM.geraet);
  pruef(nachLaden === 3, "„Dieses Gerät ist Nr. 3“ übersteht ein Neuladen (vor der Konto-Vorgabe)", nachLaden);

  /* Längster erlaubter Name (60 Zeichen, betrieb_mitglieder_grenzen) bei 360 px */
  await s.setViewportSize({ width: 360, height: 780 });
  const lang = await s.evaluate(() => {
    TM.nummern = [{ nummer: 1, name: "M".repeat(30) + " " + "H".repeat(29), ich: true }, { nummer: 2, name: "Ali" }];
    TM.modus = { an: true, art: "fair", dienst: [1, 2] }; TM.geraet = 1;
    bestellungen.forEach(b => { if (b.status !== "fertig") b.zugewiesen = 1; }); tmZeichnen(); zeichneBoard();
    const k = document.getElementById("teamKnopf").getBoundingClientRect();
    const sel = [...document.querySelectorAll("[data-tmzuw]")].map(x => x.getBoundingClientRect().right);
    return { knopf: Math.round(k.right), wahl: Math.round(Math.max(0, ...sel)), ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  pruef(lang.knopf <= 360 && lang.wahl <= 360 && lang.ueber <= 0, "Name mit 60 Zeichen bei 360 px: Knopf und Wahl bleiben im Bild", JSON.stringify(lang));
  await s.setViewportSize({ width: 390, height: 844 });

  /* Migration fehlt: Satz statt Fehler, keine Plakette */
  await setzen(s, [["a1", "arbeit", "4", 5, { zugewiesen: 2 }]]);
  await s.evaluate(DB_STELLEN, { modus: null, nummern: null, fehlt: true });
  await s.evaluate(() => { ROLLE = "inhaber"; return teamLaden("B"); }); await s.waitForTimeout(200);
  await s.click("#teamKnopf"); await s.waitForTimeout(250);
  const fehlt = await s.evaluate(() => ({ kurz: document.getElementById("teamStandKurz").textContent, satz: document.getElementById("teamFehlt").textContent,
    zuw: document.querySelectorAll("[data-tmzuw]").length }));
  pruef(fehlt.kurz === "nicht eingerichtet" && /migration-teammodus/.test(fehlt.satz) && fehlt.zuw === 0, "Migration fehlt: Satz, keine Plakette", JSON.stringify(fehlt));
  pruef(!fehler.length, "keine Ausnahme im Board", fehler.join(" | ") || "still");
  await ctx.close();

  /* Küche: Marke am Bon; ohne Spalte (400) lädt sie wie vorher */
  for (const ohne of [false, true]) {
    const kctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const k = await kctx.newPage();
    const kf = [];
    k.on("pageerror", e => kf.push(String(e).slice(0, 160)));
    const bon = { id: "k1", betrieb_id: "B", quelle: "tisch", status: "arbeit", tisch: "4", positionen: [{ name: "Crêpe", menge: 1 }],
      notiz: null, zeitpunkt: new Date().toISOString(), wartezeit_min: 10, bestaetigt_um: new Date().toISOString(),
      kueche_fertig_um: null, theke_fertig_um: null, storno: [], pruefen: false, zugewiesen: 2 };
    let anfragen = 0;
    await k.route("**/*", r => {
      const u = decodeURIComponent(r.request().url());
      const json = (b, st) => r.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(b) });
      if (u.startsWith("file://")) return r.continue();
      if (u.includes("/rest/v1/rpc/team_nummern")) return ohne ? json({ code: "PGRST202" }, 404) : json(NUMMERN);
      if (u.includes("/rest/v1/bestellungen")) { anfragen++;
        if (ohne && /zugewiesen/.test(u)) return json({ code: "42703", message: "column bestellungen.zugewiesen does not exist" }, 400);
        const z = Object.assign({}, bon); if (ohne) delete z.zugewiesen; return json([z]); }
      if (u.includes("/rest/v1/betriebe")) return json([{ id: "B", name: "Prüfhaus" }]);
      if (u.includes("/auth/")) return json({ access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: { id: "u1" } });
      return json([]);
    });
    await k.addInitScript(() => localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({ access_token: "t", refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 3600 })));
    await k.goto("file://" + KUECHE); await k.waitForTimeout(2200);
    const t = await k.evaluate(() => ({ bon: !!document.querySelector("#feld .bon"), marke: (document.querySelector("#feld .bon .marke.team") || {}).textContent || "" }));
    if (!ohne) pruef(t.bon && t.marke === "→ 2 · Ali", "Küche: Marke „→ 2 · Ali“ am Bon", JSON.stringify(t));
    else pruef(t.bon && !t.marke, "Küche ohne Spalte: Bon kommt trotzdem (zweiter Versuch ohne zugewiesen)", JSON.stringify(t) + " · " + anfragen + " Anfragen");
    pruef(!kf.length, "Küche: keine Ausnahme", kf.join(" | ") || "still");
    await kctx.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  for (const [name, fn] of [["Restzeit", () => teil1und2(browser)], ["Klappen", () => teil3(browser)],
    ["Wischen", () => teil4(browser, false)], ["Wischen ruhig", () => teil4(browser, true)], ["Maße", () => teil5(browser)], ["Team-Modus", () => teil6(browser)]]) {
    try { await fn(); } catch (e) { pruef(false, name + " lief durch", String(e).slice(0, 240)); }
  }
  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
