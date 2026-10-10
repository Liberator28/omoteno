/* ═══════════════════════════════════════════════════════════════════
   pruef-anfragen.js — höchstens 4 Servicerufe je Gast in 10 Minuten

     NODE_PATH=$(npm root -g) node pruefungen/pruef-anfragen.js

   Anlass (Foto 10.10.): zehn „Bitte einmal an den Tisch“ von Tisch 12,
   jede eine eigene Karte, alle „ZU PRÜFEN“. Der Hub schickte den Ruf
   ohne Gerätekennung — die Gerätebremse griff nie.

   1 · Naht (§8.1i): Grenze und Fenster im Hub = in der Migration, der
       Hub liest genau den HINT, den die SQL setzt, und schickt nur
       Schlüssel, die bestellung_aufgeben kennt — p_geraet dabei.
   2 · Hub mit gestelltem Server: vier Rufe gehen hinaus, der fünfte
       NICHT (Satz mit Minuten), auch nicht nach einem Neuladen; die
       Abweisung des Servers (HINT bremse:7) wird zum Satz mit „7“, nicht
       zu „kam nicht durch“; ein anderer Fehler bleibt beim alten Satz;
       Englisch.
   3 · Board: drei Rufe von Tisch 12 = EINE Karte „3 Rufe“, gleiche
       Gründe zusammengezählt; ein anderer Tisch und ein erledigter Ruf
       bleiben eigene Karten; die Zusage auf der Karte schreibt ALLE drei
       (eine Anfrage mit .in), „Fertig“ ebenso; die Ausfuhr zählt weiter
       jede Zeile.
   Die Datenbankhälfte (4 gehen, 5. abgewiesen, anderes Gerät frei bis
   Tischdeckel 8, ohne Gerät je Tisch) steht als zurückgedrehte Probe im
   Kopf von datenbank/migration-anfragen-bremse.sql.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const HAUS = "chocolamour";
const HUB = path.join(OBEN, "dist", HAUS, "index.html");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const SQL = fs.readFileSync(path.join(OBEN, "datenbank", "migration-anfragen-bremse.sql"), "utf8");
const SQL_GUTSCHEIN = fs.readFileSync(path.join(OBEN, "datenbank", "migration-gutschein-sicher.sql"), "utf8");
const VORLAGE = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");

let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if (!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };

function naht() {
  console.log("\n══ 1 · Naht Hub ↔ Migration ══");
  const grenzeSql = (SQL.match(/geraet = p_geraet[\s\S]*?if v_n >= (\d+) then/) || [])[1];
  const fensterSql = (SQL.match(/quelle = 'service'\s+and zeitpunkt > now\(\) - interval '(\d+) minutes'/) || [])[1];
  const grenzeHub = (VORLAGE.match(/const RUF_GRENZE = (\d+)/) || [])[1];
  const fensterHub = (VORLAGE.match(/RUF_FENSTER = (\d+)/) || [])[1];
  pruef(grenzeSql === "4" && grenzeHub === "4", "Grenze je Gast: 4 in der SQL und im Hub", grenzeSql + " / " + grenzeHub);
  pruef(fensterSql === "10" && +fensterHub === 600000, "Fenster: 10 Minuten in beiden", fensterSql + " min / " + fensterHub + " ms");
  pruef(/if v_n >= 8 then/.test(SQL), "Tischdeckel 8 (gegen wechselnde Gerätekennungen)");
  const hint = (SQL.match(/hint = '(\w+):'/g) || []);
  pruef(hint.length === 2 && hint.every(h => h === "hint = 'bremse:'"), "beide Abweisungen tragen HINT bremse:<Minuten>", hint.join(", "));
  pruef(/\^bremse:\(\\d\{1,3\}\)\$/.test(VORLAGE), "der Hub liest genau diese Form");
  const kopf = SQL_GUTSCHEIN.match(/function public\.bestellung_aufgeben\(([\s\S]*?)\)\s*returns/i);
  const params = kopf ? [...kopf[1].matchAll(/\b(p_\w+)\s/g)].map(m => m[1]) : [];
  const service = VORLAGE.match(/if\(istService\)\{[\s\S]*?paket = \{([\s\S]*?)\n      \};/);
  const schluessel = service ? [...service[1].matchAll(/^\s*(p_\w+):/gm)].map(m => m[1]) : [];
  pruef(params.length >= 10 && schluessel.length > 0 && schluessel.every(k => params.includes(k)),
    "Serviceruf schickt nur Parameter von bestellung_aufgeben", schluessel.join(","));
  pruef(schluessel.includes("p_geraet"), "… und die Gerätekennung (vorher fehlte sie — die Gerätebremse griff nie)");
  /* §2.3g: die Bremse zählt festgeschriebene Zeilen, keinen Zähler in derselben Transaktion. */
  const block = (SQL.match(/\(d\) Servicerufe[\s\S]*?\$z\$;/) || [""])[0];
  pruef(block && !/schutz_zaehlen/.test(block) && /from bestellungen/.test(block),
    "gezählt werden Zeilen in bestellungen, kein Zähler, den die Ausnahme zurückdrehen könnte (§2.3g)");
}

async function hub(browser) {
  console.log("\n══ 2 · Hub: vier Rufe, dann der Satz ══");
  if (!fs.existsSync(HUB)) { pruef(false, "dist/ fehlt — erst node erzeuger/erzeuge-hub.js --alle"); return; }
  const netz = { rufe: [], antwort: null };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith("file://")) return r.continue();
    const json = (b, st) => r.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(b) });
    if (/rest\/v1\/betriebe/.test(u)) return json([{ id: "11111111-1111-1111-1111-111111111111", bestell_pause: false, bestell_pause_text: "", hub_texte: {} }]);
    if (/rpc\/bestellung_aufgeben/.test(u)) {
      netz.rufe.push(JSON.parse(r.request().postData() || "{}"));
      if (netz.antwort) return json(netz.antwort.body, netz.antwort.status);
      return json("aaaaaaaa-bbbb-cccc-dddd-" + String(netz.rufe.length).padStart(12, "0"));
    }
    return json([]);
  });
  const oeffnen = async () => {
    await p.goto("file://" + HUB + "#/service");
    await p.waitForTimeout(1100);
  };
  const rufen = async () => {
    await p.evaluate(() => { const m = document.getElementById("melde"); if (m) m.textContent = ""; });
    const knopf = await p.$("[data-ruf]");
    if (knopf) await knopf.click();
    if (await p.$("#sTisch")) await p.fill("#sTisch", "12");
    const vor = netz.rufe.length;
    await p.click('[data-aktion="service"]');
    await p.waitForTimeout(500);
    return { raus: netz.rufe.length - vor, satz: await p.evaluate(() => (document.getElementById("melde") || {}).textContent || "") };
  };

  await oeffnen();
  const da = await p.evaluate(() => !!document.querySelector("[data-ruf]") && !!document.querySelector('[data-aktion="service"]'));
  pruef(da, "Voraussetzung: Service-Seite mit Rufknöpfen steht");
  if (!da) { await ctx.close(); return; }

  const erste = [];
  for (let i = 0; i < 4; i++) erste.push(await rufen());
  pruef(erste.every(r => r.raus === 1 && /Angekommen/.test(r.satz)), "Ruf 1–4 gehen hinaus und kommen an",
    erste.map(r => r.raus).join(","));
  const nutz = netz.rufe[0] || {};
  pruef(nutz.p_quelle === "service" && /^[A-Za-z0-9_-]{8,64}$/.test(nutz.p_geraet || ""),
    "Nutzlast: Quelle service mit Gerätekennung in der Form, die die SQL annimmt", nutz.p_geraet);
  pruef(new Set(netz.rufe.map(r => r.p_geraet)).size === 1, "alle vier mit DERSELBEN Kennung");

  const fuenf = await rufen();
  pruef(fuenf.raus === 0, "Ruf 5 geht NICHT hinaus (Vorprüfung im Gerät)", fuenf.raus);
  pruef(/weiß schon Bescheid/.test(fuenf.satz) && /\b10 Min\./.test(fuenf.satz), "Satz mit Minuten statt „kam nicht durch“", fuenf.satz);

  await oeffnen();
  const nachLaden = await rufen();
  pruef(nachLaden.raus === 0 && /Bescheid/.test(nachLaden.satz), "auch nach dem Neuladen bleibt die Grenze", JSON.stringify(nachLaden));

  /* Die Vorprüfung ist nur eine Höflichkeit — die Grenze hält der Server. */
  await p.evaluate(() => localStorage.removeItem(rufSchluessel()));
  netz.antwort = { status: 400, body: { code: "P0001", message: "Sie haben gerade schon mehrmals gerufen – das Team weiß Bescheid.", hint: "bremse:7", details: null } };
  const server = await rufen();
  pruef(server.raus === 1 && /\b7 Min\./.test(server.satz) && !/winken/.test(server.satz),
    "Abweisung des Servers (HINT bremse:7) → Satz mit 7 Minuten, nicht „winken“", server.satz);
  pruef(await p.evaluate(() => rufListe().length) === 0, "ein abgewiesener Ruf zählt im Gerät nicht mit");

  netz.antwort = { status: 400, body: { code: "P0001", message: "Betrieb unbekannt", hint: null } };
  const anders = await rufen();
  pruef(/winken/.test(anders.satz), "anderer Fehler: weiter der alte Satz (Gegenfall)", anders.satz);

  netz.antwort = null;
  await p.evaluate(() => { localStorage.setItem(rufSchluessel(), JSON.stringify([Date.now(), Date.now(), Date.now(), Date.now()]));
    if (typeof spracheSetzen === "function") spracheSetzen("en"); });
  await p.waitForTimeout(300);
  const en = await rufen();
  pruef(en.raus === 0 && /already knows/.test(en.satz) && /10 min/.test(en.satz), "Englisch übersetzt", en.satz);
  /* Alte Einträge fallen aus dem Fenster: 11 Minuten alt → wieder frei. */
  await p.evaluate(() => localStorage.setItem(rufSchluessel(), JSON.stringify([1, 2, 3, 4].map(() => Date.now() - 660000))));
  pruef(await p.evaluate(() => rufWarteMin()) === 0, "nach 10 Minuten wieder frei");
  pruef(!fehler.length, "keine Ausnahme im Hub", fehler.join(" | ") || "still");
  await ctx.close();
}

async function board(browser) {
  console.log("\n══ 3 · Board: Rufe eines Tisches als eine Karte ══");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
    const t = m => new Date(Date.now() - m * 60000).toISOString();
    const ruf = (id, tisch, min, notiz, status) => ({ id, quelle: "service", status: status || "neu", tisch, summe: 0,
      positionen: [], notiz, zeitpunkt: t(min), pruefen: false, wartezeit_min: null });
    bestellungen.length = 0;
    bestellungen.push(ruf("r1", "12", 1, "Tisch 12: Bitte einmal an den Tisch"), ruf("r2", "12", 2, "Tisch 12: Rechnung bitte"),
      ruf("r3", "12", 3, "Tisch 12: Bitte einmal an den Tisch"), ruf("r4", "5", 2, "Tisch 5: Rechnung bitte"),
      ruf("r5", "12", 9, "Tisch 12: Rechnung bitte", "fertig"));
    Object.keys(zeigeStatus).forEach(k => zeigeStatus[k] = true);
    Object.keys(zeigeQuelle).forEach(k => zeigeQuelle[k] = true);
    zeichneBoard();
  });
  const bild = await s.evaluate(() => [...document.querySelectorAll("#karten .bestellung")].map(k => ({
    id: k.dataset.id, zahl: (k.querySelector(".rufzahl") || {}).textContent || "", notiz: (k.querySelector(".notiz") || {}).textContent || "" })));
  const zwölf = bild.find(b => b.id === "r1");
  pruef(bild.length === 3, "drei Karten statt fünf (Tisch 12 offen · Tisch 5 · Tisch 12 erledigt)", bild.map(b => b.id).join(","));
  pruef(!!zwölf && zwölf.zahl === "3 Rufe", "die neueste trägt „3 Rufe“", zwölf && zwölf.zahl);
  pruef(!!zwölf && /an den Tisch\s*×2/.test(zwölf.notiz) && /Rechnung bitte/.test(zwölf.notiz), "gleiche Gründe zusammengezählt", zwölf && zwölf.notiz);
  pruef(bild.some(b => b.id === "r4" && !b.zahl) && bild.some(b => b.id === "r5" && !b.zahl), "anderer Tisch und Erledigtes bleiben einzeln");
  pruef(await s.evaluate(() => tabelle().length) === 6, "Ausfuhr: weiter jede Zeile (Kopf + 5)");

  /* Scharf mit gestelltem db: was geht hinaus? */
  await s.evaluate(() => {
    window.__log = [];
    const kette = (op, felder) => {
      const k = { _f: [] };
      k.eq = (a, b) => { k._f.push(["eq", a, b]); return k; };
      k.in = (a, b) => { k._f.push(["in", a, b]); return k; };
      k.then = (ok, nein) => { window.__log.push({ op, felder, filter: k._f }); return Promise.resolve({ error: null }).then(ok, nein); };
      return k;
    };
    demo = false;
    db = { from: () => ({ update: felder => kette("update", felder) }), channel: () => ({ on() { return this; }, subscribe() { return this; } }) };
  });
  await s.click('#karten .bestellung[data-id="r1"] .zmin');
  await s.waitForTimeout(300);
  let log = await s.evaluate(() => window.__log);
  const zusage = log[0] || {};
  const inFilter = (zusage.filter || []).find(x => x[0] === "in");
  pruef(log.length === 1 && inFilter && JSON.stringify([...inFilter[2]].sort()) === '["r1","r2","r3"]',
    "Zusage: EINE Anfrage für alle drei Rufe (.in)", JSON.stringify(log));
  pruef(await s.evaluate(() => ["r1", "r2", "r3"].every(i => bestellungen.find(b => b.id === i).status === "arbeit")
    && bestellungen.find(b => b.id === "r4").status === "neu"), "alle drei in Arbeit, Tisch 5 unberührt");

  await s.evaluate(() => { window.__log = []; zeichneBoard(); });
  await s.click('#karten .bestellung[data-id="r1"] .schritt[data-status="fertig"]');
  await s.waitForTimeout(300);
  log = await s.evaluate(() => window.__log);
  const fertig = (log[0] && log[0].filter || []).find(x => x[0] === "in");
  pruef(log.length === 1 && fertig && fertig[2].length === 3 && log[0].felder.status === "fertig", "„Fertig“ schließt alle drei", JSON.stringify(log));

  await s.evaluate(() => { window.__log = []; zeichneBoard(); });
  await s.click('#karten .bestellung[data-id="r4"] .zmin');
  await s.waitForTimeout(300);
  log = await s.evaluate(() => window.__log);
  pruef(log.length === 1 && (log[0].filter || []).some(x => x[0] === "eq" && x[1] === "id" && x[2] === "r4")
    && !(log[0].filter || []).some(x => x[0] === "in"), "Einzelner Ruf: wie bisher .eq(id) (Gegenfall)", JSON.stringify(log));
  pruef(!fehler.length, "keine Ausnahme im Board", fehler.join(" | ") || "still");
  await ctx.close();
}

(async () => {
  naht();
  const browser = await chromium.launch();
  try { await hub(browser); } catch (e) { pruef(false, "Hub-Teil lief durch", String(e).slice(0, 200)); }
  try { await board(browser); } catch (e) { pruef(false, "Board-Teil lief durch", String(e).slice(0, 200)); }
  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
