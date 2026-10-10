/* ═══════════════════════════════════════════════════════════════════
   pruef-abholbereit.js — Küche meldet „Abholbereit“, der Service hört es

     NODE_PATH=$(npm root -g) node pruefungen/pruef-abholbereit.js

   Wunsch 10.10.: „Der Koch kann direkt sagen, sobald ein Gericht fertig
   ist … dann bekommt der Service mit einem speziellen Benachrichtigungs-
   ton Bescheid.“ Und: „Baue das Anzeigesystem übersichtlicher.“

   1 · Küche: Der Hauptknopf eines laufenden Bons heißt „Abholbereit“,
       der Tipp schreibt kueche_fertig_um (PATCH gemessen) und sagt per
       Toast, dass der Service Bescheid bekommt.
   2 · Board über den ECHTEN Weg: Live-Leitung (live_anmelden) mit
       gestelltem Kanal — eine UPDATE-Nachricht der Küche bringt die
       Bestellung unter „Zum Abholen“ und spielt den Abholton GENAU
       einmal (dieselbe Nachricht nochmal: kein zweiter); schon beim
       Laden Fertiges steht da, klingelt aber nicht; die zweite Spur
       (Theke) klingelt erneut; „Gebracht“ schreibt gebracht_um für
       genau diese Zeile und nimmt sie heraus; eine danach fertige Spur
       holt sie zurück; Serviceruf und Storniertes nie.
   3 · Ton: andere Noten als JEDER Klang für neue Bestellungen, eigene
       Wellenform; „Ton aus“ spielt nichts (Zähler zählt trotzdem den
       Versuch, die Probe liest tonWerk nicht).
   4 · Übersicht: Überschriften Zu prüfen · Neu · In Arbeit in dieser
       Reihenfolge mit Anzahl; Tapfläche „Gebracht“ ≥ 44 px; Schrift
       ≥ 4,5:1 dunkel und hell; 390 px ohne seitliches Überlaufen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const KUECHE = path.join(OBEN, "seiten", "kueche.html");
const SQL = fs.readFileSync(path.join(OBEN, "datenbank", "migration-abholbereit.sql"), "utf8");

let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if (!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };

async function kueche(browser) {
  console.log("\n══ 1 · Küche: Abholbereit ══");
  const B = "11111111-1111-1111-1111-111111111111";
  const bon = { id: "k1", betrieb_id: B, quelle: "tisch", status: "arbeit", tisch: "4", positionen: [{ name: "Crêpe", menge: 1 }],
    notiz: null, zeitpunkt: new Date().toISOString(), wartezeit_min: 10, bestaetigt_um: new Date().toISOString(),
    kueche_fertig_um: null, theke_fertig_um: null, storno: [], pruefen: false };
  const patches = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.route("**/*", r => {
    const u = decodeURIComponent(r.request().url());
    const json = (b, st) => r.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(b) });
    if (u.startsWith("file://")) return r.continue();
    if (u.includes("/rest/v1/bestellungen")) {
      if (r.request().method() === "PATCH") { patches.push({ u, body: JSON.parse(r.request().postData() || "{}") }); return json([]); }
      return json([bon]);
    }
    if (u.includes("/rest/v1/betriebe")) return json([{ id: B, name: "Prüfhaus" }]);
    if (u.includes("/auth/")) return json({ access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: { id: "u1" } });
    return json([]);
  });
  await s.addInitScript(() => {
    localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({ access_token: "t", refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  });
  await s.goto("file://" + KUECHE);
  await s.waitForTimeout(1800);
  const knopf = await s.evaluate(() => { const k = document.querySelector('#feld .bon [data-tun="fertig"]'); return k ? k.textContent.trim() : null; });
  pruef(knopf === "Abholbereit", "Hauptknopf heißt „Abholbereit“", knopf);
  if (knopf) {
    await s.click('#feld .bon [data-tun="fertig"]');
    await s.waitForTimeout(700);
    const p = patches[0] || {};
    pruef(patches.length === 1 && /id=eq\.k1/.test(p.u) && typeof (p.body || {}).kueche_fertig_um === "string",
      "der Tipp schreibt kueche_fertig_um für genau diesen Bon", JSON.stringify(p.body));
    const toast = await s.evaluate(() => [...document.querySelectorAll("#toasts .toast")].map(t => t.textContent).join(" | "));
    pruef(/Tisch 4 abholbereit/.test(toast) && /Service/.test(toast), "Toast: der Service bekommt Bescheid", toast);
  }
  pruef(!fehler.length, "keine Ausnahme in der Küche", fehler.join(" | ") || "still");
  await ctx.close();
}

function hellig(rgb) {
  const l = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
const kontrast = (a, b) => { const x = hellig(a), y = hellig(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

async function board(browser, breite) {
  console.log("\n══ 2 · Board " + breite + " px: Zum Abholen über die Live-Leitung ══");
  const ctx = await browser.newContext({ viewport: { width: breite, height: 900 } });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await s.goto("file://" + ADMIN);
  await s.waitForTimeout(700);
  await s.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
  });
  await s.waitForTimeout(300);
  const scharf = await s.$("#scharfJetzt");
  if (scharf && await s.isVisible("#scharf")) { await scharf.click(); await s.waitForTimeout(200); }

  await s.evaluate(() => {
    const vor = m => new Date(Date.now() - m * 60000).toISOString();
    const z = (id, o) => Object.assign({ id, betrieb_id: "B", quelle: "tisch", status: "arbeit", tisch: null, summe: 12,
      positionen: [{ name: "Dubai Crêpe", menge: 2, preis: 6 }], notiz: null, zeitpunkt: vor(12), pruefen: false,
      wartezeit_min: 10, kueche_fertig_um: null, theke_fertig_um: null, gebracht_um: null }, o);
    bestellungen.length = 0;
    bestellungen.push(
      z("o1", { tisch: "4" }),
      z("o2", { tisch: "9", status: "fertig", kueche_fertig_um: vor(3) }),
      z("o3", { tisch: "7", quelle: "service", status: "fertig", kueche_fertig_um: vor(2), positionen: [] }),
      z("o4", { tisch: "8", status: "storniert", kueche_fertig_um: vor(2) }),
      z("o5", { tisch: "2", status: "neu", wartezeit_min: null }),
      z("o6", { tisch: "3", status: "neu", pruefen: true, pruef_grund: "Probe" }));
    Object.keys(zeigeStatus).forEach(k => zeigeStatus[k] = k !== "fertig");
    Object.keys(zeigeQuelle).forEach(k => zeigeQuelle[k] = true);
    /* Wie der echte Ladeweg: Geladenes steht in „bekannt“ — sonst hält
       nachholen() es für neu und hängt eine zweite Kopie an. */
    bestellungen.forEach(b => bekannt.add(b.id));
    window.__abholTon = 0;
    EINST.ton = true;
    zeichneBoard();
  });
  const leiste = () => s.evaluate(() => ({
    sichtbar: !document.getElementById("abholen").hidden,
    wer: [...document.querySelectorAll("#abholListe .abkarte")].map(k => k.querySelector(".abwer").textContent),
    spur: [...document.querySelectorAll("#abholListe .abkarte")].map(k => k.querySelector(".abspur").textContent),
    zahl: document.getElementById("abholZahl").textContent, ton: window.__abholTon,
    frisch: [...document.querySelectorAll("#abholListe .abkarte.frisch")].map(k => k.dataset.abid),
    melde: (document.getElementById("toast") || document.querySelector(".melde") || {}).textContent || "" }));
  let l = await leiste();
  pruef(l.sichtbar && JSON.stringify(l.wer) === '["Tisch 9"]' && l.zahl === "1",
    "beim Laden schon Fertiges steht da (Serviceruf und Storniertes nie)", JSON.stringify(l.wer));
  pruef(l.ton === 0, "… klingelt aber nicht (kein Übergang gesehen)", l.ton);

  /* Live-Leitung mit gestelltem Kanal: der ECHTE Handler aus live_anmelden. */
  await s.evaluate(() => {
    window.__h = {}; window.__log = [];
    const kette = (felder) => { const k = { _f: [] };
      k.eq = (a, b) => { k._f.push([a, b]); return k; };
      k.then = (ok, nein) => { window.__log.push({ felder, filter: k._f }); return Promise.resolve({ error: null }).then(ok, nein); };
      return k; };
    demo = false;
    betriebId = betriebId || "B";
    window.__daten = [];
    const lesen = () => { const k = {}; ["eq", "gte", "order"].forEach(m => k[m] = () => k);
      k.limit = () => Promise.resolve({ data: window.__daten, error: null }); return k; };
    db = { from: () => ({ update: felder => kette(felder), select: () => lesen() }),
      channel: () => { const c = { on(art, cfg, fn) { window.__h[cfg.table + ":" + cfg.event] = fn; return c; }, subscribe() { return c; } }; return c; },
      removeChannel() {} };
    live_anmelden(betriebId || "B", ladeMarke);
    /* Gestelltes Tonwerk: gezählt wird, was WIRKLICH erklingt. */
    window.__osc = []; window.__dreiklang = 0;
    tonWerk = { state: "running", currentTime: 0, destination: {},
      createOscillator() { const o = { type: "", frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; window.__osc.push(o); return o; },
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } };
    const alt = klingel; klingel = function(){ window.__dreiklang++; return alt.apply(this, arguments); };
  });
  const update = neu => s.evaluate(z => { window.__h["bestellungen:UPDATE"]({ new: z }); }, neu);
  const zeile = id => s.evaluate(i => JSON.parse(JSON.stringify(bestellungen.find(b => b.id === i))), id);
  pruef(await s.evaluate(() => typeof window.__h["bestellungen:UPDATE"] === "function"), "Voraussetzung: Live-Handler für UPDATE angemeldet");

  let o1 = await zeile("o1");
  o1 = Object.assign(o1, { status: "fertig", kueche_fertig_um: new Date().toISOString() });
  await update(o1);
  await s.waitForTimeout(250);
  l = await leiste();
  pruef(l.wer.includes("Tisch 4") && l.wer.length === 2, "Küche hakt ab → Tisch 4 steht unter „Zum Abholen“", JSON.stringify(l.wer));
  pruef(l.ton === 1, "Abholton genau einmal", l.ton);
  const osc = await s.evaluate(() => ({ n: window.__osc.length, typ: [...new Set(window.__osc.map(o => o.type))].join(","),
    hz: window.__osc.map(o => o.frequency.value).join(","), drei: window.__dreiklang }));
  pruef(osc.n === 4 && osc.typ === "triangle" && osc.drei === 0, "es erklingen vier Dreieckstöne — nicht der Bestell-Dreiklang", JSON.stringify(osc));
  pruef(l.frisch.includes("o1") && !l.frisch.includes("o2"), "nur die neue Karte fliegt ein (§4.1)", JSON.stringify(l.frisch));
  const meld = await s.evaluate(() => [...document.querySelectorAll("body *")].filter(e => e.children.length === 0 && !/^(SCRIPT|STYLE)$/.test(e.tagName) && /abholbereit/.test(e.textContent)).map(e => e.textContent).join(" | "));
  pruef(/Tisch 4 · abholbereit/.test(meld), "Meldung nennt den Tisch", meld);
  await update(o1);
  await s.waitForTimeout(200);
  pruef((await leiste()).ton === 1, "dieselbe Nachricht noch einmal: kein zweiter Ton");
  o1 = Object.assign(await zeile("o1"), { theke_fertig_um: new Date(Date.now() + 1000).toISOString() });
  await update(o1);
  await s.waitForTimeout(200);
  l = await leiste();
  pruef(l.ton === 2 && /Theke/.test(l.spur[l.wer.indexOf("Tisch 4")] || ""), "zweite Spur (Theke) fertig → zweiter Ton, Spur genannt", l.ton + " · " + l.spur.join(" / "));

  /* Tapfläche und Kontrast, solange zwei Karten stehen. */
  const mass = await s.evaluate(() => {
    document.body.classList.remove("hell");   /* ausdrücklich dunkel — kopflos startet das Board sonst hell */
    const k = document.querySelector("#abholListe .abgebracht").getBoundingClientRect();
    const farbe = el => getComputedStyle(el).color, grund = el => getComputedStyle(el).backgroundColor;
    return { h: k.height, w: k.width, wer: farbe(document.querySelector(".abwer")), karte: grund(document.querySelector(".abkarte")),
      knopf: farbe(document.querySelector(".abgebracht")), knopfGrund: grund(document.querySelector(".abgebracht")),
      ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  const rgb = t => (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(v => v <= 1 && /color\(/.test(t) ? v * 255 : v);
  pruef(mass.h >= 44 && mass.w >= 44, "„Gebracht“ ≥ 44 px", Math.round(mass.w) + "×" + Math.round(mass.h));
  const k1 = kontrast(rgb(mass.wer), rgb(mass.karte)), k2 = kontrast(rgb(mass.knopf), rgb(mass.knopfGrund));
  pruef(k1 >= 4.5 && k2 >= 4.5, "Kontrast dunkel: Tisch auf Karte, Knopfschrift", k1.toFixed(2) + " / " + k2.toFixed(2) + " · " + mass.karte);
  pruef(mass.ueber <= 0, "kein seitliches Überlaufen", mass.ueber);
  const hell = await s.evaluate(() => { document.body.classList.add("hell"); const r = {
    wer: getComputedStyle(document.querySelector(".abwer")).color, karte: getComputedStyle(document.querySelector(".abkarte")).backgroundColor,
    knopf: getComputedStyle(document.querySelector(".abgebracht")).color, knopfGrund: getComputedStyle(document.querySelector(".abgebracht")).backgroundColor };
    return r; });
  const h1 = kontrast(rgb(hell.wer), rgb(hell.karte)), h2 = kontrast(rgb(hell.knopf), rgb(hell.knopfGrund));
  pruef(hell.karte !== mass.karte, "Voraussetzung: die helle Fassung greift wirklich (anderer Kartengrund)", mass.karte + " → " + hell.karte);
  pruef(h1 >= 4.5 && h2 >= 4.5, "Kontrast hell: Tisch auf Karte, Knopfschrift", h1.toFixed(2) + " / " + h2.toFixed(2) + " · " + hell.karte);

  await s.click('#abholListe .abkarte[data-abid="o2"] [data-gebracht]');
  await s.waitForTimeout(300);
  const log = await s.evaluate(() => window.__log);
  pruef(log.length === 1 && typeof log[0].felder.gebracht_um === "string" && Object.keys(log[0].felder).length === 1
    && JSON.stringify(log[0].filter[0]) === '["id","o2"]', "„Gebracht“ schreibt NUR gebracht_um für genau diese Zeile", JSON.stringify(log));
  l = await leiste();
  pruef(JSON.stringify(l.wer) === '["Tisch 4"]', "… und Tisch 9 verschwindet aus der Leiste", JSON.stringify(l.wer));
  const o2 = Object.assign(await zeile("o2"), { theke_fertig_um: new Date(Date.now() + 5000).toISOString() });
  await update(o2);
  await s.waitForTimeout(200);
  l = await leiste();
  pruef(l.wer.includes("Tisch 9") && /Theke/.test(l.spur[l.wer.indexOf("Tisch 9")]) && !/Küche/.test(l.spur[l.wer.indexOf("Tisch 9")]),
    "danach fertige Spur holt Tisch 9 zurück, nur mit „Theke“", l.spur.join(" / "));
  await s.evaluate(() => { EINST.ton = false; window.__osc = []; });
  const o4 = Object.assign(await zeile("o1"), { kueche_fertig_um: new Date(Date.now() + 9000).toISOString() });
  const vorTon = (await leiste()).ton;
  await update(o4);
  await s.waitForTimeout(200);
  pruef((await leiste()).ton === vorTon + 1 && await s.evaluate(() => window.__osc.length) === 0,
    "Ton aus: der Übergang wird erkannt, es erklingt aber nichts");

  /* Das Sicherheitsnetz: Riss die Live-Leitung, holt nachholen() alle
     25 s nach — auch dort muss ein neu fertiger Bon klingeln. */
  await s.evaluate(() => { EINST.ton = true; window.__osc = []; });
  const o5 = Object.assign(await zeile("o5"), { status: "fertig", kueche_fertig_um: new Date(Date.now() + 12000).toISOString() });
  const vorNetz = (await leiste()).ton;
  await s.evaluate(z => { window.__daten = [z]; return nachholen(betriebId); }, o5);
  await s.waitForTimeout(250);
  l = await leiste();
  pruef(l.ton === vorNetz + 1 && l.wer.includes("Tisch 2") && await s.evaluate(() => window.__osc.length) === 4,
    "nachholen() (Leitung war weg): neu fertiger Bon steht da und klingelt", l.ton - vorNetz + " · " + JSON.stringify(l.wer));
  await s.evaluate(() => nachholen(betriebId));
  await s.waitForTimeout(200);
  pruef((await leiste()).ton === vorNetz + 1, "nachholen() mit demselben Stand: kein zweiter Ton");

  /* Übersicht: Gruppen in der Bestellliste. */
  await s.evaluate(() => {
    const vor = m => new Date(Date.now() - m * 60000).toISOString();
    bestellungen.push({ id: "g1", quelle: "tisch", status: "arbeit", tisch: "11", summe: 5, positionen: [], zeitpunkt: vor(1), pruefen: false },
                      { id: "g2", quelle: "tisch", status: "neu", tisch: "12", summe: 5, positionen: [], zeitpunkt: vor(0), pruefen: false });
    bekannt.add("g1"); bekannt.add("g2");
    zeichneBoard();
  });
  const gruppen = await s.evaluate(() => [...document.querySelectorAll("#karten .kgruppe")].map(h => h.textContent.replace(/\s+/g, " ").trim()));
  pruef(JSON.stringify(gruppen) === '["Zu prüfen 1","Neu 1","In Arbeit 1"]',
    "Überschriften nach Stand: Zu prüfen · Neu · In Arbeit, je mit Anzahl", JSON.stringify(gruppen));
  const reihe = await s.evaluate(() => [...document.querySelectorAll("#karten > *")].map(e => e.classList.contains("kgruppe") ? "H" : e.dataset.id).join(","));
  pruef(reihe === "H,o6,H,g2,H,g1", "Reihenfolge: Kopf, markierte, Kopf, neue, Kopf, in Arbeit — obwohl die Arbeit älter eingetragen ist", reihe);
  pruef(!fehler.length, "keine Ausnahme im Board", fehler.join(" | ") || "still");
  await ctx.close();
}

function ton() {
  console.log("\n══ 3 · Eigener Ton ══");
  const html = fs.readFileSync(ADMIN, "utf8");
  const abhol = (html.match(/const ABHOL_NOTEN = (\[[^;]+\]);/) || [])[1];
  const klang = html.match(/const KLANG_NOTEN = \{([\s\S]*?)\};/);
  const noten = abhol ? JSON.parse(abhol).map(x => x[0]) : [];
  const andere = klang ? [...klang[1].matchAll(/\[([\d.]+), [\d.]+\]/g)].map(m => +m[1]) : [];
  pruef(noten.length >= 3 && andere.length >= 5 && noten.every(x => !andere.includes(x)), "Abholnoten kommen in keinem Klang für neue Bestellungen vor",
    noten.join(",") + " / " + [...new Set(andere)].join(","));
  pruef(/abholTonSpielen[\s\S]{0,400}o\.type = "triangle"/.test(html) && /dreiklangSpielen[\s\S]{0,400}o\.type = "sine"/.test(html),
    "eigene Wellenform (Dreieck statt Sinus)");
  pruef(/add column if not exists gebracht_um timestamptz/.test(SQL) && /gebracht_um: b\.gebracht_um/.test(html),
    "Naht: Board schreibt die Spalte, die die Migration anlegt");
}

(async () => {
  ton();
  const browser = await chromium.launch();
  try { await kueche(browser); } catch (e) { pruef(false, "Küchen-Teil lief durch", String(e).slice(0, 200)); }
  for (const b of [1280, 390]) {
    try { await board(browser, b); } catch (e) { pruef(false, "Board-Teil " + b + " lief durch", String(e).slice(0, 200)); }
  }
  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
