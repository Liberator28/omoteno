/* ═══════════════════════════════════════════════════════════════
   pruef-karte-schalter.js — Schalter in der Karte (Wunsch 25.10.)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-karte-schalter.js     (braucht dist/)

   Gebaut ist:
   · „Verfügbar“ als Schalter direkt an jedem Gericht in der Karte (Liste UND Kacheln) — dieselbe Funktion und dieselbe
     Zeile in der Datenbank wie im Reiter „Verfügbar“.
   · „Karte aktiv“: ein Schalter unter den Karten-Chips. Eine ausgeschaltete Karte steht als `aktiv:false` im Verzeichnis
     (betriebe.karten); der Hub nimmt sie aus Kacheln, Adresse und alleKarten().

   Was schiefgehen kann, und je eine Probe dazu:
   1 · Board: jedes Gericht trägt seinen Schalter in beiden Ansichten, Stand = verfuegbar, Antippfläche ≥ 44 px.
   2 · Board: ein echter Tipp schreibt GENAU {verfuegbar} an dieses Gericht und diesen Betrieb; Netz weg → alles zurück.
   3 · Board: „Karte aktiv“ schreibt das Verzeichnis mit `aktiv:false` NUR an dieser Karte (andere Karten ohne den Schlüssel),
       Einschalten nimmt den Schlüssel wieder weg, die letzte eingeschaltete Karte bleibt an, Chip zeigt „aus“.
   4 · Team: der Karten-Schalter fehlt (nur Stand), die Schalter an den Gerichten bleiben.
   5 · Hub: `aktiv:false` (strikt) nimmt Kachel, Adresse und alleKarten() weg; „false“ als Text, 0, true, fehlend → Karte bleibt.
   Ehrliche Grenze: kopfloses Chromium, kein Gerät; die Datenbank ist gestellt (Zeilen und Rechte: pruef-rollen/pruef-rechte.sql).
   ═══════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const { oeffneHub } = require("./werkzeug/start-hub.js");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if (!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };

const DATEN = () => {
  const z = (id, name, kat, o) => Object.assign({ id, betrieb_id: "B", name, kategorie: kat, karte: "speisekarte", karten: ["speisekarte"], preis: 9.5, beschreibung: "",
    allergene: "", verfuegbar: true, veg: false, vegan: false, reihenfolge: 0, kat_sort: 1, kat_emoji: null, bild: "", bild_frei: null }, o);
  return [
    z("g1", "Pizza Margherita", "Pizza", { reihenfolge: 0 }),
    z("g2", "Pizza Salami", "Pizza", { reihenfolge: 1, verfuegbar: false, preis: 11 }),
    z("g3", "Cola", "Getränke", { reihenfolge: 0, kat_sort: 2, karte: "getraenke", karten: ["getraenke"], preis: 3.2 }),
    z("g4", "Negroni", "Cocktails", { reihenfolge: 0, kat_sort: 3, karte: "cocktails", karten: ["cocktails"], preis: 9 })
  ];
};

async function oeffnen(browser, opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: opt.breite || 390, height: 844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.addInitScript(a => { try { localStorage.setItem("omoteno-karte-ansicht", a); } catch (e) {} }, opt.liste ? "liste" : "raster");
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(600);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const sc = document.getElementById("scharf"); if (sc) sc.hidden = true; });
  await p.waitForTimeout(200);
  await p.evaluate(([daten, team, ansicht]) => {
    const g = new Function("return (" + daten + ")()")();
    demo = false; betriebId = "B";
    window.__melde = []; window.melde = t => { window.__melde.push(t); };
    window.__db = { log: [], modus: "ok" };
    db = { removeChannel: () => Promise.resolve(), channel: () => ({ on() { return this; }, subscribe() { return this; } }), rpc: () => Promise.resolve({ data: null, error: null }),
      from: tab => ({ update: satz => { const q = { f: [] };
        const api = { eq(c, v) { q.f.push([c, v]); return api; }, select() { return api; },
          then(ok, nein) { const d = window.__db; d.log.push({ tab, satz, f: q.f });
            const res = d.modus === "netz" ? { data: null, error: { message: "x" } } : { data: [{ id: 1 }], error: null };
            return Promise.resolve(res).then(ok, nein); } };
        return api; } }) };
    if (team) window.istInhaberRolle = () => false;
    gerichte = g; KARTENSTAND = []; welcheKarte = "speisekarte"; KR_ANSICHT = ansicht; krKat = ""; krFilter = "alle"; krWahl.clear(); suchtext = "";
    tafelZeigen("speisekarte"); zeichneKarte();
  }, [DATEN.toString(), !!opt.team, opt.liste ? "liste" : "raster"]);
  await p.waitForTimeout(250);
  return { ctx, p, fehler };
}
const log = p => p.evaluate(() => window.__db.log);
const melden = p => p.evaluate(() => window.__melde.join(" | "));

async function boardStruktur(br) {
  console.log("\n══ 1 · Schalter an jedem Gericht (Liste und Kacheln) ══");
  for (const liste of [true, false]) {
    const b = await oeffnen(br, { liste }), p = b.p, w = liste ? "Liste" : "Kacheln";
    const s = await p.evaluate(() => {
      const sch = [...document.querySelectorAll("#karteListe input[data-verf]")];
      return { zahl: sch.length, gerichte: gerichte.filter(g => g.karten.includes("speisekarte")).length,
        stand: sch.map(x => x.checked), soll: gerichte.filter(g => g.karten.includes("speisekarte")).map(g => g.verfuegbar),
        hoch: Math.min(...sch.map(x => Math.round(x.closest("label").getBoundingClientRect().height))),
        breit: Math.min(...sch.map(x => Math.round(x.closest("label").getBoundingClientRect().width))) };
    });
    pruef(s.zahl === s.gerichte && s.zahl >= 2, w + ": ein Schalter je Gericht der Karte", s.zahl + " / " + s.gerichte);
    pruef(JSON.stringify(s.stand.slice().sort()) === JSON.stringify(s.soll.slice().sort()), w + ": jeder Schalter steht wie `verfuegbar`", JSON.stringify(s.stand));
    pruef(s.hoch >= 44 && s.breit >= 44, w + ": Antippfläche ≥ 44 px", s.breit + "×" + s.hoch);
    pruef(b.fehler.length === 0, w + ": keine Skriptfehler", b.fehler.join(" | "));
    await b.ctx.close();
  }
}

async function boardSchreiben(br) {
  console.log("\n══ 2 · Tipp auf den Schalter schreibt, Netz weg stellt zurück ══");
  for (const liste of [true, false]) {
    const b = await oeffnen(br, { liste }), p = b.p, w = liste ? "Liste" : "Kacheln";
    const sel = '#karteListe input[data-verf="g1"]';
    pruef(await p.isChecked(sel), w + ": Voraussetzung — „Pizza Margherita“ ist an");
    await p.locator(sel).evaluate(e => e.closest("label").click());
    await p.waitForTimeout(250);
    const l = await log(p);
    pruef(l.length === 1 && l[0].tab === "gerichte" && JSON.stringify(l[0].satz) === '{"verfuegbar":false}' &&
      JSON.stringify(l[0].f) === '[["id","g1"],["betrieb_id","B"]]', w + ": echter Tipp schreibt GENAU {verfuegbar:false} an dieses Gericht in diesem Betrieb", JSON.stringify(l));
    pruef(await p.evaluate(() => gerichte.find(g => g.id === "g1").verfuegbar === false) && !(await p.isChecked(sel)), w + ": Stand im Board und Schalter folgen");
    pruef(/ist heute aus/.test(await melden(p)), w + ": der Satz sagt es", await melden(p));
    /* Netz weg: alles zurück, mit Satz. */
    await p.evaluate(() => { window.__db.modus = "netz"; window.__melde.length = 0; });
    await p.locator(sel).evaluate(e => e.closest("label").click());
    await p.waitForTimeout(250);
    pruef(await p.evaluate(() => gerichte.find(g => g.id === "g1").verfuegbar === false) && !(await p.isChecked(sel)),
      w + ": Netz weg — der Schalter bleibt, wo die Datenbank ihn hält (aus)");
    pruef(/Nicht gespeichert/.test(await melden(p)), w + ": Netz weg sagt es", await melden(p));
    await p.evaluate(() => { window.__db.modus = "ok"; });
    await p.locator(sel).evaluate(e => e.closest("label").click());
    await p.waitForTimeout(250);
    pruef(await p.isChecked(sel) && (await log(p)).filter(x => x.tab === "gerichte").pop().satz.verfuegbar === true, w + ": wieder an schreibt {verfuegbar:true}");
    pruef(b.fehler.length === 0, w + ": keine Skriptfehler", b.fehler.join(" | "));
    await b.ctx.close();
  }
}

async function boardKarte(br) {
  console.log("\n══ 3 · „Karte aktiv“ ══");
  const b = await oeffnen(br), p = b.p;
  const zeile = () => p.evaluate(() => { const z = document.getElementById("karteAktivZeile"); return { sichtbar: !z.hidden, text: z.textContent.trim(), an: document.getElementById("karteAktiv").checked,
    aus: z.classList.contains("aus"), chips: [...document.querySelectorAll("#kartenWahl .chip[data-karte]")].map(c => c.textContent.trim().replace(/\s+/g, " ")) }; });
  let z = await zeile();
  pruef(!z.sichtbar || z.an, "Ruhelage: Karte an", JSON.stringify(z));
  await p.locator("#karteAktivSchalter").click();
  await p.waitForTimeout(250);
  let l = (await log(p)).filter(x => x.tab === "betriebe");
  const karten = l.length ? l[l.length - 1].satz.karten : [];
  pruef(l.length === 1 && JSON.stringify(l[0].f) === '[["id","B"]]' && karten.length === 3, "Tipp schreibt das Verzeichnis (drei Karten) in diesen Betrieb", JSON.stringify(l.map(x => x.f)));
  pruef(karten.filter(k => k.aktiv === false).map(k => k.id).join() === "speisekarte", "NUR die gewählte Karte trägt aktiv:false", JSON.stringify(karten.map(k => [k.id, k.aktiv])));
  pruef(karten.filter(k => k.id !== "speisekarte").every(k => !("aktiv" in k)), "die anderen Karten tragen den Schlüssel gar nicht (Bestand unverändert)");
  z = await zeile();
  pruef(z.sichtbar && !z.an && z.aus && /ausgeschaltet/.test(z.text), "die Zeile sagt „ausgeschaltet“", z.text);
  pruef(z.chips.some(c => /^Speisekarte aus$/.test(c)), "der Chip trägt „aus“", JSON.stringify(z.chips));
  pruef(/ist für Gäste ausgeschaltet/.test(await melden(p)), "der Satz sagt es", await melden(p));
  /* Wieder an: Schlüssel weg. */
  await p.locator("#karteAktivSchalter").click();
  await p.waitForTimeout(250);
  l = (await log(p)).filter(x => x.tab === "betriebe");
  pruef(l.length === 2 && l[1].satz.karten.every(k => !("aktiv" in k)), "wieder an nimmt den Schlüssel wieder heraus (kein aktiv:true gespeichert)", JSON.stringify(l[1] && l[1].satz.karten.map(k => [k.id, k.aktiv])));
  /* Zwei aus, die dritte bleibt an. */
  await p.evaluate(() => { welcheKarte = "speisekarte"; zeichneKarte(); });
  await p.locator("#karteAktivSchalter").click(); await p.waitForTimeout(200);
  await p.evaluate(() => { welcheKarte = "getraenke"; zeichneKarte(); });
  await p.locator("#karteAktivSchalter").click(); await p.waitForTimeout(200);
  await p.evaluate(() => { welcheKarte = "cocktails"; zeichneKarte(); });
  const vorher = (await log(p)).filter(x => x.tab === "betriebe").length;
  await p.locator("#karteAktivSchalter").click(); await p.waitForTimeout(200);
  const nachher = (await log(p)).filter(x => x.tab === "betriebe").length;
  z = await zeile();
  pruef(nachher === vorher && z.an && /Mindestens eine Karte/.test(await melden(p)), "die letzte eingeschaltete Karte lässt sich nicht ausschalten — nichts geschrieben, Satz sagt warum", (await melden(p)).slice(-80));
  /* Netz weg: Schalter zurück. */
  await p.evaluate(() => { window.__db.modus = "netz"; welcheKarte = "speisekarte"; zeichneKarte(); });
  const vor = await zeile();
  await p.locator("#karteAktivSchalter").click(); await p.waitForTimeout(250);
  z = await zeile();
  pruef(vor.an === false && z.an === false, "Netz weg: Stand bleibt, wie die Datenbank ihn hält", JSON.stringify([vor.an, z.an]));
  pruef(b.fehler.length === 0, "keine Skriptfehler", b.fehler.join(" | "));
  await b.ctx.close();
}

async function boardTeam(br) {
  console.log("\n══ 4 · Team ══");
  const b = await oeffnen(br, { team: true }), p = b.p;
  const z0 = await p.evaluate(() => { const z = document.getElementById("karteAktivZeile"); return { versteckt: z.hidden }; });
  pruef(z0.versteckt, "Team: ist die Karte an, gibt es keine Zeile (nichts zu bedienen)");
  await p.evaluate(() => { KARTENSTAND = [{ id: "speisekarte", name: "Speisekarte", unter: "", kategorien: [], aktiv: false }, { id: "getraenke", name: "Getränke", unter: "", kategorien: [] }]; kartenWahlZeichnen(); });
  const z1 = await p.evaluate(() => { const z = document.getElementById("karteAktivZeile");
    return { sichtbar: !z.hidden, schalter: getComputedStyle(document.getElementById("karteAktivSchalter")).display, text: z.textContent.trim() }; });
  pruef(z1.sichtbar && z1.schalter === "none" && /schaltet der Besitzer/.test(z1.text), "Team: ist die Karte aus, steht der Stand da — ohne Schalter", JSON.stringify(z1));
  const s = await p.evaluate(() => document.querySelectorAll("#karteListe input[data-verf]").length);
  pruef(s >= 2, "Team: die Schalter „Verfügbar“ an den Gerichten bleiben (dieses Recht hat das Team)", String(s));
  await b.ctx.close();
}

async function hub(br) {
  console.log("\n══ 5 · Hub ══");
  const lies = h => h.p.evaluate(() => ({
    kacheln: sichtbareKachelnRoh().filter(k => k.art === "karte").map(k => kachelKarte(k)),
    alle: alleKarten().map(x => x[0]),
    links: ["speisekarte", "getraenke", "cocktails"].filter(id => document.querySelector('#inhalt a[href="#/' + id + '"]')) }));
  let h = await oeffneHub(br, { haus: "chocolamour" });
  let s = await lies(h);
  pruef(s.kacheln.join() === "speisekarte,getraenke,cocktails" && s.alle.join() === "speisekarte,getraenke,cocktails", "Standard (ohne Schlüssel): alle drei Karten wie vorher", JSON.stringify(s));
  await h.ctx.close();

  h = await oeffneHub(br, { haus: "chocolamour", karten: [{ id: "speisekarte", name: "Speisekarte", unter: "" }, { id: "getraenke", name: "Getränke", unter: "" }, { id: "cocktails", name: "Cocktails", unter: "", aktiv: false }] });
  s = await lies(h);
  pruef(s.kacheln.join() === "speisekarte,getraenke" && s.alle.join() === "speisekarte,getraenke", "aktiv:false — die Kachel fehlt und alleKarten() nimmt die Karte nicht mit", JSON.stringify(s));
  pruef(!s.links.includes("cocktails") && s.links.includes("speisekarte"), "die Startseite verlinkt die ausgeschaltete Karte nicht", JSON.stringify(s.links));
  await h.p.evaluate(() => { location.hash = "#/cocktails"; });
  await h.p.waitForTimeout(400);
  const ziel = await h.p.evaluate(() => ({ seite: seiteJetzt, inhaltHatKarte: !!document.querySelector("#inhalt .gericht") }));
  pruef(ziel.seite === "start" && !ziel.inhaltHatKarte, "die Adresse #/cocktails führt auf die Startseite, nicht auf eine leere Karte", JSON.stringify(ziel));
  await h.p.evaluate(() => { location.hash = "#/speisekarte"; });
  await h.p.waitForTimeout(400);
  pruef(await h.p.evaluate(() => seiteJetzt === "speisekarte"), "eine eingeschaltete Karte öffnet weiter");
  pruef(h.fehler.length === 0, "keine Skriptfehler", h.fehler.join(" | "));
  await h.ctx.close();

  /* Nur ein echtes false zählt. */
  for (const wert of ["false", 0, null, true, "aus"]) {
    h = await oeffneHub(br, { haus: "chocolamour", karten: [{ id: "cocktails", name: "Cocktails", unter: "", aktiv: wert }] });
    s = await lies(h);
    pruef(s.alle.includes("cocktails"), "aktiv: " + JSON.stringify(wert) + " schaltet NICHT ab (strikt boolean)", JSON.stringify(s.alle));
    await h.ctx.close();
  }
  /* Eigene Karte mit Gerichten, ausgeschaltet. */
  h = await oeffneHub(br, { haus: "chocolamour", karten: [{ id: "k-mittag", name: "Mittag", unter: "", aktiv: false }],
    zeilen: z => z.concat([Object.assign({}, z[0], { id: "mittag-1", name: "Mittagsteller", karte: "k-mittag", karten: ["k-mittag"] })]) });
  s = await lies(h);
  const eigene = await h.p.evaluate(() => ({ extra: Object.keys(KARTEN_EXTRA), alle: alleKarten().map(x => x[0]) }));
  pruef(eigene.extra.includes("k-mittag") && !eigene.alle.includes("k-mittag"), "eigene Karte ausgeschaltet: die Gerichte sind da, die Karte zählt für den Gast nicht", JSON.stringify(eigene));
  await h.p.evaluate(() => { location.hash = "#/k-mittag"; });
  await h.p.waitForTimeout(400);
  pruef(await h.p.evaluate(() => seiteJetzt === "start"), "#/k-mittag führt auf die Startseite");
  await h.ctx.close();
}

(async () => {
  const br = await chromium.launch();
  await boardStruktur(br);
  await boardSchreiben(br);
  await boardKarte(br);
  await boardTeam(br);
  await hub(br);
  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
