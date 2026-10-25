/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Rollen und Rechte im Board: „Zahlen“ = Unternehmen · Team & Ziele, Gruppe „Zugriffsrechte“

     NODE_PATH=$(npm root -g) node pruefungen/pruef-zugriffsrechte.js

   Die Datenbank erzwingt (datenbank/pruef-zugriffsrechte-lokal.sql, 153 Proben im lokalen Postgres 16); das Board sagt
   es vorher und holt/zeichnet Gesperrtes GAR NICHT. Gemessen wird über den echten Weg: ein gestelltes `db` antwortet
   auf betrieb_mitglieder mit der Rolle und auf meine_rechte() mit den Rechten, dann läuft betriebWaehlen() — nicht
   rolleAnwenden() oder darfRecht() direkt (§8.1i).

   Geprüft wird, dass kein gesperrter WERT im Dokument steht (nicht nur: „versteckt“), dass nichts geholt wird, was das
   Recht nicht deckt (Zeitfenster der Abfrage, Ziele, Export), und die Nähte zur SQL (zweite Quellen, §8.1i):
     · Katalog ZR_RECHTE = rechte_katalog() in migration-zugriffsrechte.sql (Schlüssel, Art der Durchsetzung)
     · jeder Parameter der aufgerufenen Funktionen = Signatur in der Migration
     · jeder `grund` der Funktionen hat im Board einen Satz
     · Rollenliste der Edge Function team-zugang = CHECK der Migration
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const ADMIN = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");
const MIG = process.env.MIGRATION_A || path.join(OBEN, "datenbank", "migration-zugriffsrechte.sql");
const EDGE = path.join(OBEN, "supabase", "functions", "team-zugang", "index.ts");
const KONTO = path.join(OBEN, "seiten", "konto.html");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

const ALLE = { kennzahlen_tag: true, berichte_view: true, berichte_export: true, kosten_view: true, finanz_export: true, ziele_edit: true, ziele_approve: true };
const KEINE = { kennzahlen_tag: false, berichte_view: false, berichte_export: false, kosten_view: false, finanz_export: false, ziele_edit: false, ziele_approve: false };
const mit = (x) => Object.assign({}, KEINE, x);

/* Gestelltes Supabase. Alles, was das Board fragt, wird mitgeschrieben: select/gte je Tabelle, rpc mit Parametern. */
function stelleDb(cfg) {
  window.__rpc = []; window.__abfragen = []; window.__schreib = [];
  window.__cfg = cfg;
  const heute0 = new Date(); heute0.setHours(0, 0, 0, 0);
  const jetzt = Date.now();
  const spaet = new Date(Math.max(jetzt - 60000, heute0.getTime() + 1000)).toISOString();
  window.__BEST = [
    { id: "b1", betrieb_id: "b-a", quelle: "tisch", status: "neu", summe: 12.5, liefergebuehr: 0, rabatt_betrag: 0, zeitpunkt: spaet, positionen: [{ name: "Probe-Crêpe", menge: 1, preis: 12.5 }], pruefen: false },
    /* gestern und vorgestern, mit unverwechselbaren Beträgen — sie dürfen bei „nur Tageszahlen“ nirgends im Dokument stehen */
    { id: "b2", betrieb_id: "b-a", quelle: "tisch", status: "neu", summe: 777.77, liefergebuehr: 0, rabatt_betrag: 0, zeitpunkt: new Date(heute0.getTime() - 3600e3 * 5).toISOString(), positionen: [{ name: "Gestern-Gericht", menge: 1, preis: 777.77 }], pruefen: false },
    { id: "b3", betrieb_id: "b-a", quelle: "tisch", status: "neu", summe: 888.88, liefergebuehr: 0, rabatt_betrag: 0, zeitpunkt: new Date(heute0.getTime() - 3600e3 * 50).toISOString(), positionen: [{ name: "Vorgestern-Gericht", menge: 1, preis: 888.88 }], pruefen: false }
  ];
  function rpcAntwort(name, args) {
    window.__rpc.push({ name, args });
    const c = window.__cfg;
    if (c.rpcFehler && c.rpcFehler.includes(name)) return { data: null, error: { message: "Could not find the function public." + name, code: "PGRST202" } };
    if (c.queue && c.queue[name] && c.queue[name].length) return { data: c.queue[name].shift(), error: null };
    if (c.rpc && c.rpc[name] && c.rpc[name].__echo) return { data: { ok: true, rechte: Object.assign({}, c.rpc[name].wirksam, { [args.p_recht]: args.p_an }), eigene: { [args.p_recht]: args.p_an } }, error: null };
    if (c.rpc && c.rpc[name]) return { data: c.rpc[name], error: null };
    if (name === "meine_rechte") return { data: { rolle: c.rolle, rechte: c.rechte }, error: null };
    return { data: null, error: null };
  }
  function kette(tab) {
    const z = { tab, op: "select", daten: null, einzeln: false, select: null, gte: [] };
    const p = new Proxy(function () {}, {
      get(_, k) {
        if (k === "then") return (res) => {
          if (z.op !== "select") { window.__schreib.push({ tab: z.tab, op: z.op, daten: z.daten }); return res({ data: null, error: null }); }
          window.__abfragen.push({ tab: z.tab, select: z.select, gte: z.gte });
          if (z.tab === "betrieb_mitglieder")
            return res({ data: [{ rolle: window.__cfg.rolle, betriebe: { id: "b-a", slug: "b-a", name: "Choco", bestell_pause: false, hub_texte: {} } }], error: null });
          if (z.tab === "bestellungen") {
            const von = z.gte.find(x => x[0] === "zeitpunkt");
            const liste = window.__BEST.filter(b => !von || b.zeitpunkt >= von[1]);   // wie PostgREST: das Fenster filtert
            return res({ data: liste, error: null });
          }
          if (z.tab === "betriebe") return res({ data: z.einzeln ? { ziele: { tag: 999 } } : [{ ziele: { tag: 999 } }], error: null });
          return res({ data: z.einzeln ? null : [], error: null });
        };
        return (...a) => {
          if (["update", "insert", "upsert", "delete"].includes(k)) { z.op = k; z.daten = a[0]; }
          if (k === "select") z.select = a[0];
          if (k === "gte") z.gte.push([a[0], a[1]]);
          if (k === "maybeSingle" || k === "single") z.einzeln = true;
          return p;
        };
      },
      apply() { return p; }
    });
    return p;
  }
  db = {
    from: kette,
    rpc: (name, args) => Promise.resolve(rpcAntwort(name, args || {})),
    channel: () => kette("kanal"),
    removeChannel: async () => {},
    storage: { from: () => kette("speicher") },
    functions: { invoke: async () => ({ data: null, error: null }) },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: { id: "u1", email: "probe@example.org" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    }
  };
  demo = false;
}

async function oeffnen(browser, cfg, breite) {
  const ctx = await browser.newContext({ viewport: { width: breite || 390, height: 900 } });
  const seite = await ctx.newPage();
  const fehler = [];
  seite.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(600);
  const scharf = await seite.$("#scharfJetzt");
  if (scharf && await seite.isVisible("#scharf")) { await scharf.click(); await seite.waitForTimeout(150); }
  await seite.evaluate(stelleDb, cfg);
  await seite.evaluate(async () => {
    document.getElementById("tor").hidden = true;
    try { localStorage.setItem(merkSchluessel(), "b-a"); } catch (e) {}
    await betriebWaehlen();
  });
  await seite.waitForTimeout(450);
  return { ctx, seite, fehler };
}
async function tafel(seite, name) {
  await seite.evaluate(x => { const k = document.querySelector('[data-tafel="' + x + '"]'); if (k) k.click(); }, name);
  await seite.waitForTimeout(450);
}
const sichtbar = (sel) => (s) => s.evaluate(q => { const e = document.querySelector(q); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }, sel);

/* ════ Zweite Quellen: Quelltexte ═════════════════════════════════════════════════════════ */
function quellen() {
  const mig = fs.readFileSync(MIG, "utf8");
  const admin = fs.readFileSync(ADMIN, "utf8");
  const edge = fs.readFileSync(EDGE, "utf8");
  return { mig, admin, edge };
}
function katalogAusMigration(mig) {
  const kopf = mig.indexOf("function public.rechte_katalog()");
  const ende = mig.indexOf("$$;", kopf);
  const k = mig.slice(kopf, ende);
  const zeilen = [...k.matchAll(/\(\s*'([a-z_]+)'\s*,\s*'([^']+)'\s*,\s*'([a-z]+)'\s*,\s*(true|false)\s*,\s*'([a-z]+)'/g)];
  return zeilen.map(m => ({ recht: m[1], art: m[3], standard: m[4] === "true", durch: m[5] }));
}
function paramAusMigration(mig, name) {
  const m = mig.match(new RegExp("create or replace function public\\." + name + "\\(([^)]*)\\)"));
  return m ? m[1].split(",").map(x => x.trim().split(/\s+/)[0]).filter(Boolean) : null;
}
function grundAusMigration(mig, name) {
  const kopf = mig.indexOf("create or replace function public." + name + "(");
  if (kopf < 0) return null;
  const ende = mig.indexOf("end $function$;", kopf);
  return [...new Set([...mig.slice(kopf, ende).matchAll(/'grund',\s*'([a-z_]+)'/g)].map(m => m[1]))];
}
function paramAusBoard(admin, name) {
  const m = admin.match(new RegExp('\\("' + name + '",\\s*\\{([^}]*)\\}'));
  return m ? [...m[1].matchAll(/(p_[a-z_]+)\s*:/g)].map(x => x[1]) : null;
}

(async () => {
  const q = quellen();
  const browser = await chromium.launch();

  /* ══ 0 · Nähte ══ */
  console.log("\n══ Nähte: Board ↔ Migration ↔ Edge Function ══");
  {
    const kat = katalogAusMigration(q.mig);
    pruef(kat.length === 7, "Voraussetzung: sieben Rechte aus der Migration gelesen", kat.map(x => x.recht).join(","));
    const boardKat = await (async () => {
      const ctx = await browser.newContext(); const s = await ctx.newPage();
      await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
      await s.goto("file://" + ADMIN); await s.waitForTimeout(500);
      const r = await s.evaluate(() => ({ zr: ZR_RECHTE, liste: RECHT_LISTE }));
      await ctx.close(); return r;
    })();
    pruef(JSON.stringify(boardKat.zr.map(x => [x.recht, x.durch])) === JSON.stringify(kat.map(x => [x.recht, x.durch])),
      "Katalog im Board (Schlüssel, Reihenfolge, „Datenbank/Anzeige“) = rechte_katalog() der Migration", boardKat.zr.map(x => x.recht + ":" + x.durch).join(" "));
    pruef(JSON.stringify(boardKat.liste) === JSON.stringify(kat.map(x => x.recht)), "RECHT_LISTE = Schlüssel des Katalogs");
    const stdManager = kat.filter(x => x.standard).map(x => x.recht);
    pruef(JSON.stringify(stdManager) === '["kennzahlen_tag"]', "Standard des Managers laut Migration: nur die Tageszahlen", stdManager.join(","));

    for (const fn of ["team_rechte_setzen", "team_rechte_liste", "team_rechte_verlauf", "teamziel_speichern", "teamziel_freigeben", "teamziel_archivieren", "teamaufgabe_haken", "teamziele_stand", "meine_rechte"]) {
      const sql = paramAusMigration(q.mig, fn), brd = paramAusBoard(q.admin, fn);
      pruef(sql && brd && sql.length > 0 && JSON.stringify(sql) === JSON.stringify(brd) || (brd && sql && brd.every(x => sql.includes(x)) && sql.every(x => brd.includes(x))),
        fn + ": gesendete Parameter = Signatur der Migration", "Board " + JSON.stringify(brd) + " · SQL " + JSON.stringify(sql));
    }
    const sample = (name) => grundAusMigration(q.mig, name) || [];
    const tzGruende = ["teamziel_speichern", "teamziel_freigeben", "teamziel_archivieren", "teamaufgabe_haken", "teamziele_stand"].flatMap(sample);
    const tzBoard = await (async () => {
      const ctx = await browser.newContext(); const s = await ctx.newPage();
      await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
      await s.goto("file://" + ADMIN); await s.waitForTimeout(500);
      const r = await s.evaluate(() => ({ tz: Object.keys(TZ_GRUND), zr: Object.keys(ZR_GRUND) }));
      await ctx.close(); return r;
    })();
    const ohneTz = [...new Set(tzGruende)].filter(g => !tzBoard.tz.includes(g));
    pruef(ohneTz.length === 0 && tzGruende.length >= 8, "jeder Grund der Teamziel-Funktionen hat im Board einen Satz", ohneTz.join(",") || [...new Set(tzGruende)].join(","));
    const zrGruende = sample("team_rechte_setzen");
    const ohneZr = zrGruende.filter(g => !tzBoard.zr.includes(g));
    pruef(ohneZr.length === 0 && zrGruende.length >= 5, "jeder Grund von team_rechte_setzen hat im Board einen Satz", ohneZr.join(",") || zrGruende.join(","));

    /* Rollenliste: Edge Function = Schranke der Migration = Auswahl im Konto */
    const edgeRollen = (q.edge.match(/const ROLLEN = \[([^\]]*)\]/) || [])[1];
    const eRollen = edgeRollen ? [...edgeRollen.matchAll(/"([a-z]+)"/g)].map(m => m[1]).sort() : null;
    const migRollen = [...(q.mig.match(/check \(rolle in \(([^)]*)\)\)/) || [, ""])[1].matchAll(/'+([a-z]+)'+/g)].map(m => m[1]).sort();
    pruef(JSON.stringify(eRollen) === JSON.stringify(migRollen) && eRollen.includes("manager"), "Rollen der Edge Function team-zugang = Schranke der Migration (mit manager)", JSON.stringify(eRollen) + " · " + JSON.stringify(migRollen));
    const konto = fs.readFileSync(KONTO, "utf8");
    pruef(/<option value="manager">/.test(konto) && /TEAM_ROLLEN = \{[^}]*manager/.test(konto), "Konto: „Manager“ ist wählbar und hat ein Wort");
  }

  /* ══ 1 · Besitzer ══ */
  console.log("\n══ Besitzer: alles wie vorher ══");
  {
    const { ctx, seite, fehler } = await oeffnen(browser, { rolle: "inhaber", rechte: ALLE });
    pruef(await seite.evaluate(() => RECHTE && RECHTE.rechte.kosten_view === true), "Voraussetzung: Rechte vom Server angekommen (meine_rechte)");
    await tafel(seite, "auswertung");
    const s1 = await seite.evaluate(() => ({
      sicht: document.getElementById("awUnternehmen").dataset.sicht, kacheln: document.querySelectorAll("#awKacheln .aw-kpi").length,
      segmente: document.querySelectorAll("#zeitWahl .aw-seg").length, schloss: document.querySelector('[data-aw-bereich="unternehmen"]').classList.contains("gesperrt"),
      team: !document.getElementById("awTeam").hidden }));
    pruef(s1.sicht === "berichte" && s1.kacheln === 4 && s1.segmente === 4 && !s1.schloss && !s1.team, "Unternehmen offen, vier Kacheln, vier Zeiträume, kein Schloss", JSON.stringify(s1));
    pruef(await sichtbar("#awCsvBestellungen")(seite) && await sichtbar("#awCsvGerichte")(seite) && await sichtbar("#awZielAendern")(seite), "Export und „Ziele ändern“ sichtbar");
    const ab = await seite.evaluate(() => window.__abfragen.filter(a => a.tab === "bestellungen" && /liefergebuehr/.test(a.select || "")).map(a => a.gte[0][1]));
    const heute0 = await seite.evaluate(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); });
    pruef(ab.length >= 1 && ab[0] < heute0, "holt auch den Zeitraum davor (Vergleich)", ab[0]);
    pruef(await seite.evaluate(() => window.__abfragen.some(a => a.tab === "betriebe" && a.select === "ziele")), "liest die Umsatzziele");
    await tafel(seite, "einstellungen");
    await seite.evaluate(() => euOeffnen("eu-" + EU_BEREICHE.findIndex(b => b.titel === "Zugriffsrechte")));
    pruef(await seite.evaluate(() => { const g = [...document.querySelectorAll(".egruppe")].find(x => /Zugriffsrechte/.test((x.querySelector(".etitel") || {}).textContent || "")); return !!g && !g.querySelector(":scope > .nur-inhaber-satz"); }), "Gruppe „Zugriffsrechte“ beim Besitzer bedienbar (kein Sperr-Satz)");
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  /* ══ 2 · Manager mit den Standard-Rechten: nur Tageszahlen ══ */
  console.log("\n══ Manager, nur Tageszahlen ══");
  {
    const { ctx, seite, fehler } = await oeffnen(browser, { rolle: "manager", rechte: mit({ kennzahlen_tag: true }) });
    pruef(await seite.evaluate(() => document.body.dataset.rolle === "team" && ROLLE === "manager" && !istInhaberRolle()), "Voraussetzung: Rolle manager angekommen und im Betrieb wie Team (kein Besitzer)");
    await tafel(seite, "auswertung");
    const s = await seite.evaluate(() => {
      const sicht = el => !!el && el.getClientRects().length > 0;
      return {
        sicht: document.getElementById("awUnternehmen").dataset.sicht,
        kacheln: [...document.querySelectorAll("#awKacheln .aw-kpi")].map(k => k.textContent.replace(/\s+/g, " ").trim()),
        kopf: sicht(document.querySelector("#awUnternehmen .aw-kopf")), befunde: sicht(document.getElementById("awBefunde")),
        verlauf: sicht(document.getElementById("awVerlauf")), renner: sicht(document.getElementById("awRenner")), quellen: sicht(document.getElementById("awQuellen")),
        ziele: sicht(document.getElementById("awZiele")), csv: sicht(document.getElementById("awCsvBestellungen")) || sicht(document.getElementById("awCsvGerichte")),
        zielKnopf: sicht(document.getElementById("awZielAendern")),
        leer: ["awBefunde", "awVerlauf", "awStunden", "awRenner", "awQuellen", "awZiele"].every(id => document.getElementById(id).innerHTML.trim() === ""),
        text: document.body.innerText, html: document.getElementById("t-auswertung").innerHTML
      };
    });
    pruef(s.sicht === "tag" && s.kacheln.length === 2 && /Umsatz heute/.test(s.kacheln[0]) && /12,50/.test(s.kacheln[0]) && /Bestellungen heute/.test(s.kacheln[1]),
      "zwei Kacheln: Umsatz und Bestellungen von heute (die eine Bestellung von heute: 12,50 €)", s.kacheln.join(" | "));
    pruef(!s.kopf && !s.befunde && !s.verlauf && !s.renner && !s.quellen && !s.ziele && !s.csv && !s.zielKnopf,
      "weder Zeitraum-Wahl, Befunde, Verlauf, Gerichte, Quellen, Ziele noch Export sichtbar", JSON.stringify({ kopf: s.kopf, befunde: s.befunde, verlauf: s.verlauf, renner: s.renner, ziele: s.ziele, csv: s.csv }));
    pruef(s.leer, "und nicht nur versteckt: die Behälter sind leer");
    pruef(!/777[,.]77|888[,.]88|Gestern-Gericht|Vorgestern-Gericht|999/.test(s.text + s.html), "kein Betrag von gestern/vorgestern, kein Gericht, kein Umsatzziel irgendwo im Dokument");
    const ab = await seite.evaluate(() => window.__abfragen.filter(a => a.tab === "bestellungen" && /liefergebuehr/.test(a.select || "")).map(a => a.gte[0][1]));
    const heute0 = await seite.evaluate(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); });
    pruef(ab.length >= 1 && ab.every(x => x >= heute0), "holt nur ab heute 0 Uhr (gar nichts davor)", ab.join(" | "));
    pruef(!(await seite.evaluate(() => window.__abfragen.some(a => a.tab === "betriebe" && a.select === "ziele"))), "liest die Umsatzziele nicht");
    /* Nichts „von innen“ nachladbar: der Zeitraum ist festgenagelt */
    await seite.evaluate(() => { awZeitraum = "monat"; awLaden(); });
    await seite.waitForTimeout(300);
    pruef(await seite.evaluate(() => awZeitraum === "heute" && document.getElementById("awUnternehmen").dataset.sicht === "tag"), "ein von Hand gesetzter Zeitraum „30 Tage“ wird auf heute zurückgesetzt");
    pruef(await seite.evaluate(() => awCsv("bestellungen") === null && awCsv("gerichte") === null), "awCsv() liefert ohne Recht keine Datei");

    await tafel(seite, "einstellungen");
    const z = await seite.evaluate(() => { const g = [...document.querySelectorAll(".egruppe")].find(x => /Zugriffsrechte/.test((x.querySelector(".etitel") || {}).textContent || "")); return { satz: !!g.querySelector(":scope > .nur-inhaber-satz"), frei: [...g.querySelectorAll("input,button")].filter(e => !e.closest(".nur-inhaber-satz") && !e.closest("[inert]")).length, rufe: window.__rpc.filter(r => /team_rechte/.test(r.name)).length }; });
    pruef(z.satz && z.frei === 0 && z.rufe === 0, "Gruppe „Zugriffsrechte“: Satz da, nichts bedienbar, und die Liste wurde gar nicht erst abgefragt", JSON.stringify(z));
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  /* ══ 3 · Manager mit Berichten (ohne Export) ══ */
  console.log("\n══ Manager mit Berichten ══");
  {
    const { ctx, seite } = await oeffnen(browser, { rolle: "manager", rechte: mit({ kennzahlen_tag: true, berichte_view: true }) });
    await tafel(seite, "auswertung");
    const s = await seite.evaluate(() => ({ sicht: document.getElementById("awUnternehmen").dataset.sicht, kacheln: document.querySelectorAll("#awKacheln .aw-kpi").length, seg: document.querySelectorAll("#zeitWahl .aw-seg").length }));
    pruef(s.sicht === "berichte" && s.kacheln === 4 && s.seg === 4, "Berichte offen: vier Kacheln, vier Zeiträume", JSON.stringify(s));
    pruef(!(await sichtbar("#awCsvBestellungen")(seite)) && !(await sichtbar("#awCsvGerichte")(seite)), "Export-Knöpfe nicht da (kein Recht „Berichte exportieren“)");
    pruef(!(await sichtbar("#awZielAendern")(seite)), "„Ziele ändern“ nicht da (Umsatzziele setzt der Besitzer)");
    pruef(await seite.evaluate(() => awCsv("bestellungen") === null), "awCsv() ohne Exportrecht: keine Datei");
    await seite.evaluate(() => awZielBlatt());
    pruef(await seite.evaluate(() => !document.querySelector("#awZielForm")), "auch ein direkter Aufruf von awZielBlatt() öffnet für den Manager nichts");
    await ctx.close();
  }
  console.log("\n══ Manager mit Berichten und Export ══");
  {
    const { ctx, seite } = await oeffnen(browser, { rolle: "manager", rechte: mit({ kennzahlen_tag: true, berichte_view: true, berichte_export: true }) });
    await tafel(seite, "auswertung");
    pruef(await sichtbar("#awCsvBestellungen")(seite) && await sichtbar("#awCsvGerichte")(seite), "Export-Knöpfe da");
    pruef(await seite.evaluate(() => typeof awCsv("bestellungen") === "string"), "awCsv() liefert eine Datei");
    await ctx.close();
  }

  /* ══ 4 · Team: Unternehmen gesperrt, Team & Ziele offen ══ */
  console.log("\n══ Team ══");
  const ZIELE = {
    ok: true, darf: { edit: false, approve: false },
    ziele: [{ id: "11111111-1111-4111-8111-111111111111", titel: "Zehn Bewertungen", beschreibung: "Bis Freitag", frist: null, status: "freigegeben", erledigt: 1, gesamt: 2,
      aufgaben: [{ id: "a1111111-1111-4111-8111-111111111111", titel: "Karte erklären", erledigt: true, von: "Mia" }, { id: "a2222222-2222-4222-8222-222222222222", titel: "Nach Bewertung fragen", erledigt: false, von: null }] }],
    erfolge: [{ titel: "Sommerfest", zeit: new Date().toISOString() }]
  };
  {
    const { ctx, seite, fehler } = await oeffnen(browser, { rolle: "team", rechte: KEINE, rpc: { teamziele_stand: ZIELE, teamaufgabe_haken: { ok: true, status: "freigegeben", erledigt: 2, gesamt: 2 } } });
    await tafel(seite, "auswertung");
    const s = await seite.evaluate(() => ({
      bereich: awBereich, team: !document.getElementById("awTeam").hidden, unt: !document.getElementById("awUnternehmen").hidden,
      schloss: getComputedStyle(document.querySelector("#awBereich .aw-schloss")).display !== "none",
      gesperrt: document.querySelector('[data-aw-bereich="unternehmen"]').classList.contains("gesperrt"),
      abgefragt: window.__abfragen.filter(a => a.tab === "bestellungen" && /liefergebuehr/.test(a.select || "")).length }));
    pruef(s.bereich === "team" && s.team && !s.unt, "öffnet auf „Team & Ziele“, nicht auf den Zahlen", JSON.stringify(s));
    pruef(s.gesperrt && s.schloss, "„Unternehmen“ trägt ein sichtbares Schloss");
    pruef(s.abgefragt === 0, "und es wurden keine Zahlen geholt (Auswertungs-Abfrage nie gestellt)");
    const t = await seite.evaluate(() => ({
      karten: document.querySelectorAll(".tz-ziel").length, haken: [...document.querySelectorAll("[data-tz-haken]")].map(b => [b.getAttribute("aria-checked"), Math.round(b.getBoundingClientRect().height)]),
      neu: !!document.getElementById("tzNeu"), knoepfe: document.querySelectorAll("[data-tz-bearbeiten],[data-tz-frei],[data-tz-zurueck],[data-tz-archiv]").length,
      balken: document.querySelector(".tz-balken").getAttribute("aria-valuenow") + "/" + document.querySelector(".tz-balken").getAttribute("aria-valuemax"),
      erfolg: /Sommerfest/.test(document.getElementById("awTeamInhalt").textContent), von: /Mia/.test(document.getElementById("awTeamInhalt").textContent) }));
    pruef(t.karten === 1 && t.balken === "1/2" && t.erfolg, "Ziel mit Fortschritt (1/2) und gemeinsamem Erfolg", JSON.stringify(t));
    pruef(t.haken.length === 2 && t.haken.every(h => h[1] >= 44), "zwei Aufgaben, jede ≥ 44 px hoch", JSON.stringify(t.haken));
    pruef(!t.neu && t.knoepfe === 0, "Team: kein „Neues Ziel“, kein Bearbeiten/Freigeben/Archivieren");
    await seite.click('[data-tz-haken="a2222222-2222-4222-8222-222222222222"]');
    await seite.waitForTimeout(350);
    const r = await seite.evaluate(() => window.__rpc.filter(x => x.name === "teamaufgabe_haken"));
    pruef(r.length === 1 && r[0].args.p_aufgabe === "a2222222-2222-4222-8222-222222222222" && r[0].args.p_erledigt === true, "Tipp auf die Aufgabe ruft teamaufgabe_haken mit genau dieser Aufgabe", JSON.stringify(r.map(x => x.args)));
    pruef(await seite.evaluate(() => document.activeElement && document.activeElement.dataset.tzHaken === "a2222222-2222-4222-8222-222222222222"), "der Fokus bleibt auf der Aufgabe");

    /* Auf „Unternehmen“ tippen: ein Satz, keine Zahl, keine Abfrage */
    await seite.click('[data-aw-bereich="unternehmen"]');
    await seite.waitForTimeout(350);
    const g = await seite.evaluate(() => ({ satz: !document.getElementById("awGesperrt").hidden && getComputedStyle(document.getElementById("awGesperrt")).display !== "none",
      kacheln: document.querySelectorAll("#awKacheln .aw-kpi").length, kopf: document.querySelector("#awUnternehmen .aw-kopf").getClientRects().length,
      abgefragt: window.__abfragen.filter(a => a.tab === "bestellungen" && /liefergebuehr/.test(a.select || "")).length,
      text: document.getElementById("t-auswertung").textContent }));
    pruef(g.satz && g.kacheln === 0 && g.kopf === 0 && g.abgefragt === 0 && !/12,50|777|888/.test(g.text), "Unternehmen: Satz „gesperrt“, keine Kachel, keine Abfrage, kein Betrag", JSON.stringify({ satz: g.satz, kacheln: g.kacheln, abgefragt: g.abgefragt }));
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }
  console.log("\n══ Küche ══");
  {
    const { ctx, seite } = await oeffnen(browser, { rolle: "kueche", rechte: KEINE, rpc: { teamziele_stand: ZIELE } });
    await tafel(seite, "auswertung");
    pruef(await seite.evaluate(() => awBereich === "team" && document.getElementById("awUnternehmen").dataset.sicht === "gesperrt"), "Küche: wie Team, gesperrt");
    await ctx.close();
  }

  /* ══ 5 · Ohne Antwort des Servers: weniger, nie mehr ══ */
  console.log("\n══ meine_rechte antwortet nicht (Migration fehlt) ══");
  for (const [rolle, erwartet] of [["inhaber", "berichte"], ["manager", "tag"], ["team", "gesperrt"], ["kueche", "gesperrt"]]) {
    const { ctx, seite } = await oeffnen(browser, { rolle, rechte: ALLE, rpcFehler: ["meine_rechte", "teamziele_stand"] });
    await tafel(seite, "auswertung");
    const s = await seite.evaluate(() => ({ r: RECHTE, sicht: awSicht() }));
    pruef(s.r === null && s.sicht === erwartet, rolle + ": Rückfall nach Rolle → " + erwartet, JSON.stringify(s));
    if (rolle === "team") {
      const t = await seite.evaluate(() => document.getElementById("awTeamInhalt").textContent);
      pruef(/noch nicht eingerichtet/.test(t) && /migration-zugriffsrechte/.test(t), "Team & Ziele: fehlende Migration als Satz statt leerer Fläche", t.slice(0, 100));
    }
    await ctx.close();
  }

  /* ══ 6 · Rechte ändern sich, während das Board offen ist ══ */
  console.log("\n══ Rechte kommen nach dem Öffnen an ══");
  {
    const { ctx, seite } = await oeffnen(browser, { rolle: "manager", rechte: mit({ kennzahlen_tag: true }) });
    await tafel(seite, "auswertung");
    pruef(await seite.evaluate(() => document.getElementById("awUnternehmen").dataset.sicht) === "tag", "Voraussetzung: erst nur Tageszahlen");
    await seite.evaluate(async () => { window.__cfg.rechte = Object.assign({}, window.__cfg.rechte, { berichte_view: true }); await rechteLaden(); });
    await seite.waitForTimeout(500);
    pruef(await seite.evaluate(() => document.getElementById("awUnternehmen").dataset.sicht === "berichte" && document.querySelectorAll("#awKacheln .aw-kpi").length === 4), "ein neu gelesenes Recht schaltet die offene Seite um (vier Kacheln)");
    /* Rückstufung Berichte → nur Tageszahlen: vom Verlauf, den Gerichten und den Zielen darf NICHTS im Dokument bleiben (textContent
       zählt auch Verstecktes, innerText nicht). */
    pruef(await seite.evaluate(() => /Probe-Crêpe/.test(document.getElementById("awRenner").textContent)), "Voraussetzung: mit Berichten steht ein Gericht in der Liste");
    await seite.evaluate(async () => { window.__cfg.rechte = Object.assign({}, window.__cfg.rechte, { berichte_view: false }); await rechteLaden(); });
    await seite.waitForTimeout(500);
    const rs = await seite.evaluate(() => ({ s: document.getElementById("awUnternehmen").dataset.sicht, k: document.querySelectorAll("#awKacheln .aw-kpi").length,
      leer: ["awBefunde", "awVerlauf", "awStunden", "awRenner", "awQuellen", "awZiele"].every(id => document.getElementById(id).innerHTML.trim() === ""),
      text: document.getElementById("awUnternehmen").textContent }));
    pruef(rs.s === "tag" && rs.k === 2 && rs.leer && !/Probe-Crêpe|Gestern-Gericht|999/.test(rs.text), "Rückstufung auf nur Tageszahlen: zwei Kacheln, die übrigen Behälter leer, kein Gericht und kein Ziel im Text", JSON.stringify({ s: rs.s, k: rs.k, leer: rs.leer }));
    await seite.evaluate(async () => { window.__cfg.rechte = Object.assign({}, window.__cfg.rechte, { berichte_view: false, kennzahlen_tag: false }); await rechteLaden(); });
    await seite.waitForTimeout(500);
    const w = await seite.evaluate(() => ({ s: document.getElementById("awUnternehmen").dataset.sicht, b: awBereich, k: document.querySelectorAll("#awKacheln .aw-kpi").length, text: document.getElementById("t-auswertung").textContent }));
    pruef(w.s === "gesperrt" && w.b === "team" && w.k === 0 && !/12,50/.test(w.text), "wird ein Recht entzogen, ist die Seite sofort gesperrt und leer (auch das Versteckte)", JSON.stringify({ s: w.s, b: w.b, k: w.k }));
    await ctx.close();
  }

  /* ══ 7 · Manager mit Ziele-Rechten ══ */
  console.log("\n══ Manager mit Teamziel-Rechten ══");
  {
    const stand = JSON.parse(JSON.stringify(ZIELE)); stand.darf = { edit: true, approve: true };
    stand.ziele.push({ id: "22222222-2222-4222-8222-222222222222", titel: "Entwurf Ziel", beschreibung: null, frist: null, status: "entwurf", erledigt: 0, gesamt: 1, aufgaben: [{ id: "a3333333-3333-4333-8333-333333333333", titel: "Plakat", erledigt: false, von: null }] });
    const { ctx, seite, fehler } = await oeffnen(browser, { rolle: "manager", rechte: mit({ kennzahlen_tag: true, ziele_edit: true, ziele_approve: true }),
      rpc: { teamziele_stand: stand, teamziel_speichern: { ok: true, id: "33333333-3333-4333-8333-333333333333" }, teamziel_freigeben: { ok: true }, teamziel_archivieren: { ok: true } } });
    await tafel(seite, "auswertung");
    await seite.click('[data-aw-bereich="team"]'); await seite.waitForTimeout(350);
    const s = await seite.evaluate(() => ({ neu: !!document.getElementById("tzNeu"), bearb: document.querySelectorAll("[data-tz-bearbeiten]").length, frei: document.querySelectorAll("[data-tz-frei]").length,
      zurueck: document.querySelectorAll("[data-tz-zurueck]").length, archiv: document.querySelectorAll("[data-tz-archiv]").length,
      entwurfHaken: document.querySelector('[data-tz-ziel="22222222-2222-4222-8222-222222222222"] [data-tz-haken]').disabled }));
    pruef(s.neu && s.bearb === 2 && s.frei === 1 && s.zurueck === 1 && s.archiv === 2, "Neues Ziel, Bearbeiten, Freigeben (Entwurf), Zurückziehen (laufendes), Archivieren", JSON.stringify(s));
    pruef(s.entwurfHaken, "Aufgaben eines Entwurfs lassen sich nicht abhaken");
    await seite.click("#tzNeu"); await seite.waitForTimeout(250);
    await seite.fill("#tzTitel", "  Neues Ziel  "); await seite.fill("#tzBesch", "Beschreibung");
    await seite.fill("#tzAufgaben input", "Erste Aufgabe");
    await seite.click("#tzAufgabeNeu"); await seite.waitForTimeout(100);
    await seite.keyboard.type("Zweite");
    pruef(await seite.evaluate(() => document.querySelectorAll("#tzAufgaben input").length === 2 && document.querySelectorAll("#tzAufgaben input")[0].value === "Erste Aufgabe"), "zweite Aufgabe hinzugefügt, die erste behält ihren Text");
    pruef(await seite.evaluate(() => [...document.querySelectorAll("#tzEditor input, #tzEditor textarea, #tzEditor button")].every(e => e.getBoundingClientRect().height >= 43.5) && getComputedStyle(document.getElementById("tzTitel")).fontSize === "16px"), "Felder ≥ 44 px hoch, 16 px Schrift");
    await seite.click('#tzEditor button[type=submit]'); await seite.waitForTimeout(350);
    const sp = await seite.evaluate(() => window.__rpc.filter(x => x.name === "teamziel_speichern").map(x => x.args));
    pruef(sp.length === 1 && sp[0].p_betrieb === "b-a" && sp[0].p_ziel === null && sp[0].p_titel.trim() === "Neues Ziel" && sp[0].p_beschreibung === "Beschreibung" && sp[0].p_frist === null &&
      JSON.stringify(sp[0].p_aufgaben) === '[{"titel":"Erste Aufgabe"},{"titel":"Zweite"}]', "Speichern sendet genau Betrieb, kein Ziel, Titel, Beschreibung, Aufgaben", JSON.stringify(sp[0]));
    await seite.click('[data-tz-frei="22222222-2222-4222-8222-222222222222"]'); await seite.waitForTimeout(300);
    await seite.click('[data-tz-zurueck="11111111-1111-4111-8111-111111111111"]'); await seite.waitForTimeout(300);
    await seite.click('[data-tz-archiv="11111111-1111-4111-8111-111111111111"]'); await seite.waitForTimeout(300);
    const fr = await seite.evaluate(() => window.__rpc.filter(x => /teamziel_(freigeben|archivieren)/.test(x.name)).map(x => x.name + ":" + JSON.stringify(x.args)));
    pruef(fr.length === 3 && fr[0] === 'teamziel_freigeben:{"p_ziel":"22222222-2222-4222-8222-222222222222","p_an":true}' && fr[1] === 'teamziel_freigeben:{"p_ziel":"11111111-1111-4111-8111-111111111111","p_an":false}' &&
      fr[2] === 'teamziel_archivieren:{"p_ziel":"11111111-1111-4111-8111-111111111111"}', "Freigeben, Zurückziehen, Archivieren rufen die richtige Funktion mit dem richtigen Ziel", fr.join(" · "));
    /* Eine Abweisung des Servers wird ein Satz, kein rohes JSON */
    await seite.evaluate(() => { window.__cfg.rpc.teamziel_freigeben = { ok: false, grund: "keine_aufgaben" }; });
    await seite.click('[data-tz-frei="22222222-2222-4222-8222-222222222222"]'); await seite.waitForTimeout(300);
    pruef(await seite.evaluate(() => /mindestens eine Aufgabe/.test(document.getElementById("meldung").textContent)), "Abweisung „keine_aufgaben“ erscheint als Satz");
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  console.log("\n══ Manager mit Teamziel-Recht „bearbeiten“, aber ohne „freigeben“ ══");
  {
    const stand = JSON.parse(JSON.stringify(ZIELE)); stand.darf = { edit: true, approve: false };
    stand.ziele.push({ id: "22222222-2222-4222-8222-222222222222", titel: "Entwurf Ziel", beschreibung: null, frist: null, status: "entwurf", erledigt: 0, gesamt: 1, aufgaben: [{ id: "a3333333-3333-4333-8333-333333333333", titel: "Plakat", erledigt: false, von: null }] });
    const { ctx, seite } = await oeffnen(browser, { rolle: "manager", rechte: mit({ kennzahlen_tag: true, ziele_edit: true }), rpc: { teamziele_stand: stand } });
    await tafel(seite, "auswertung");
    await seite.click('[data-aw-bereich="team"]'); await seite.waitForTimeout(350);
    const s = await seite.evaluate(() => ({ neu: !!document.getElementById("tzNeu"), bearb: document.querySelectorAll("[data-tz-bearbeiten]").length,
      frei: document.querySelectorAll("[data-tz-frei]").length, zurueck: document.querySelectorAll("[data-tz-zurueck]").length, archiv: document.querySelectorAll("[data-tz-archiv]").length,
      entwurf: !!document.querySelector('[data-tz-ziel="22222222-2222-4222-8222-222222222222"]') }));
    pruef(s.entwurf, "Voraussetzung: der Entwurf ist für ihn sichtbar (er darf bearbeiten)");
    pruef(s.neu && s.bearb === 2 && s.archiv === 2 && s.frei === 0 && s.zurueck === 0, "Bearbeiten und Archivieren ja — Freigeben und Zurückziehen NICHT", JSON.stringify(s));
    await ctx.close();
  }

  /* ══ 8 · Gruppe „Zugriffsrechte“ (Besitzer) ══ */
  console.log("\n══ Besitzer vergibt Rechte ══");
  {
    const wirksam = { kennzahlen_tag: true, berichte_view: true, berichte_export: false, kosten_view: true, finanz_export: true, ziele_edit: false, ziele_approve: false };
    const liste = [
      { nutzer_id: "11111111-1111-4111-8111-111111111111", email: "wirt@example.org", anzeigename: "Ina", rolle: "inhaber", ich: true, eigene: {}, rechte: ALLE },
      { nutzer_id: "22222222-2222-4222-8222-222222222221", email: "mia@example.org", anzeigename: "Mia", rolle: "manager", ich: false, eigene: wirksam, rechte: wirksam },
      { nutzer_id: "33333333-3333-4333-8333-333333333331", email: "tim@example.org", anzeigename: "Tim", rolle: "team", ich: false, eigene: {}, rechte: KEINE },
      { nutzer_id: "33333333-3333-4333-8333-333333333332", email: "kai@example.org", anzeigename: "<img src=x onerror=window.__x=1>", rolle: "kueche", ich: false, eigene: {}, rechte: KEINE }
    ];
    const verlauf = [{ zeit: new Date().toISOString(), von_name: "Ina", ziel_name: "Mia", recht: "kosten_view", an: true }];
    let antworten = [];
    const { ctx, seite, fehler } = await oeffnen(browser, { rolle: "inhaber", rechte: ALLE, rpc: {
      team_rechte_liste: liste, team_rechte_verlauf: verlauf,
      team_rechte_setzen: { __echo: true, wirksam } } });
    await tafel(seite, "einstellungen");
    await seite.evaluate(() => euOeffnen("eu-" + EU_BEREICHE.findIndex(b => b.titel === "Zugriffsrechte")));
    await seite.waitForTimeout(500);
    const s = await seite.evaluate(() => ({
      personen: document.querySelectorAll(".zr-person").length, schalter: document.querySelectorAll('[data-zr-recht]').length,
      kopf: [...document.querySelectorAll(".zr-person")].map(p => p.querySelector(".rmarke").textContent),
      sieht: document.querySelector('[data-zr-person="22222222-2222-4222-8222-222222222221"] .zr-sieht').innerText.replace(/\s+/g, " "),
      durch: [...document.querySelectorAll('[data-zr-person="22222222-2222-4222-8222-222222222221"] .zr-durch')].map(e => e.className.replace("zr-durch ", "")).join(","),
      verlauf: document.getElementById("zrVerlauf").textContent.replace(/\s+/g, " "), injiziert: window.__x === 1,
      kachel: [...document.querySelectorAll(".eu-kachel")].some(k => /Zugriffsrechte/.test(k.textContent)) }));
    pruef(s.personen === 4 && s.schalter === 7 && s.kopf.join(",") === "Besitzer,Manager,Team,Küche", "vier Personen, sieben Schalter (nur beim Manager), Rollen beschriftet", JSON.stringify({ p: s.personen, s: s.schalter, k: s.kopf }));
    pruef(s.kachel, "es gibt eine Kachel „Zugriffsrechte“ in den Einstellungen");
    pruef(/Sieht: Tageszahlen · Berichte · Einkauf und Kalkulation · Finanzexport/.test(s.sieht) && /Gesperrt: Berichte exportieren · Teamziele bearbeiten · Teamziele freigeben/.test(s.sieht), "„Sieht“ und „Gesperrt“ nennen genau die wirksamen Rechte", s.sieht);
    pruef(s.durch === "anzeige,anzeige,anzeige,datenbank,datenbank,datenbank,datenbank", "jede Zeile sagt, ob die Datenbank erzwingt oder nur die Anzeige", s.durch);
    pruef(/Ina → Mia/.test(s.verlauf) && /Einkauf und Kalkulation/.test(s.verlauf) && /freigeschaltet/.test(s.verlauf), "Verlauf nennt Namen und Recht", s.verlauf);
    pruef(!s.injiziert, "ein Anzeigename mit <img onerror> bleibt Text");
    const hoehe = await seite.evaluate(() => [...document.querySelectorAll("[data-zr-recht]")].map(e => Math.round(e.closest("label").getBoundingClientRect().height)));
    pruef(hoehe.every(h => h >= 44), "jede Schalterzeile ≥ 44 px hoch", hoehe.join(","));

    /* Schalten */
    await seite.click('[data-zr-nutzer="22222222-2222-4222-8222-222222222221"][data-zr-recht="berichte_export"] ~ *, [data-zr-nutzer="22222222-2222-4222-8222-222222222221"][data-zr-recht="berichte_export"]', { force: true });
    await seite.waitForTimeout(450);
    let r = await seite.evaluate(() => window.__rpc.filter(x => x.name === "team_rechte_setzen").map(x => x.args));
    pruef(r.length === 1 && JSON.stringify(r[0]) === '{"p_betrieb":"b-a","p_nutzer":"22222222-2222-4222-8222-222222222221","p_recht":"berichte_export","p_an":true}', "Schalter „Berichte exportieren“ → team_rechte_setzen mit genau Betrieb, Person, Recht, Wert", JSON.stringify(r));
    /* kosten_view aus: finanz_export (an) wird MIT zurückgenommen */
    await seite.evaluate(() => { window.__rpc.length = 0; window.__cfg.queue = { team_rechte_setzen: [
      { ok: true, rechte: { kennzahlen_tag: true }, eigene: { kosten_view: false, finanz_export: true } }, { ok: true, rechte: { kennzahlen_tag: true }, eigene: { finanz_export: false } }] }; });
    await seite.click('[data-zr-nutzer="22222222-2222-4222-8222-222222222221"][data-zr-recht="kosten_view"]', { force: true });
    await seite.waitForTimeout(500);
    r = await seite.evaluate(() => window.__rpc.filter(x => x.name === "team_rechte_setzen").map(x => x.args.p_recht + ":" + x.args.p_an));
    pruef(JSON.stringify(r) === '["kosten_view:false","finanz_export:false"]', "„Einkauf und Kalkulation“ aus nimmt den Export in einem zweiten Aufruf mit zurück", JSON.stringify(r));
    /* Abweisung */
    await seite.evaluate(() => { window.__cfg.rpc.team_rechte_setzen = { ok: false, grund: "selbst" }; });
    await seite.click('[data-zr-nutzer="22222222-2222-4222-8222-222222222221"][data-zr-recht="ziele_edit"]', { force: true });
    await seite.waitForTimeout(450);
    pruef(await seite.evaluate(() => /eigenen Zugang/.test(document.getElementById("meldung").textContent)), "Abweisung „selbst“ erscheint als Satz");
    pruef(await seite.evaluate(() => !!document.querySelector('[data-zr-recht]') && [...document.querySelectorAll('[data-zr-recht]')].every(e => !e.disabled || e.dataset.zrRecht === "finanz_export")), "danach sind die Schalter wieder bedienbar");
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  /* ══ 9 · Maße ══ */
  console.log("\n══ Telefon 360 px ══");
  {
    const { ctx, seite } = await oeffnen(browser, { rolle: "inhaber", rechte: ALLE }, 360);
    await tafel(seite, "auswertung");
    const m = await seite.evaluate(() => ({ breit: document.documentElement.scrollWidth, fenster: innerWidth,
      seg: [...document.querySelectorAll("#awBereich .aw-seg")].map(b => Math.round(b.getBoundingClientRect().height)) }));
    pruef(m.breit <= m.fenster && m.seg.every(h => h >= 44), "kein Seitenüberlauf, beide Reiter ≥ 44 px", JSON.stringify(m));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
