/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Missbrauchsschutz: markierte Bestellungen in Board, Küche,
   Push — und die Naht zur SQL

     NODE_PATH=$(npm root -g) node pruefungen/pruef-schutz.js

   Die Datenbankhälfte (Grenzen, Bremse, Serverpreis, Quarantäne) läuft
   in datenbank/pruef-missbrauch.sql gegen den echten Bestand und dreht
   sich selbst zurück (14 Proben, 26.09.). Hier: was die Seiten mit
   einer MARKIERTEN Bestellung tun — und ob sie dieselben Namen lesen,
   die die SQL schreibt (§8.1i).

   Grundsatz (§7): Markiert heißt „durchgelassen, aber nicht in der
   Küche, nicht auf den Telefonen, nicht im Umsatz — bis jemand im
   Board entscheidet“.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN   = path.resolve(__dirname, "..");
const SQL    = fs.readFileSync(path.join(OBEN, "datenbank", "migration-missbrauch.sql"), "utf8");
const ADMIN  = path.join(OBEN, "seiten", "admin.html");
const KUECHE = path.join(OBEN, "seiten", "kueche.html");
const MELDEN = fs.readFileSync(path.join(OBEN, "supabase", "functions", "melden", "index.ts"), "utf8");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}
const ohneKommentar = t => t.split("\n").map(z => z.replace(/--.*$/, "")).join("\n");

/* ── 1 · Naht ───────────────────────────────────────────────────── */
function naht() {
  console.log("\n══ Naht: SQL ↔ Board, Küche, Push ══");
  const sql = ohneKommentar(SQL);
  pruef(/add column if not exists pruefen boolean not null default false/.test(sql) &&
        /add column if not exists pruef_grund text/.test(sql), "SQL legt pruefen/pruef_grund an");
  pruef(/insert into bestellungen[\s\S]{0,300}pruefen, pruef_grund\)/.test(sql), "bestellung_aufgeben schreibt beide Spalten");
  const admin = fs.readFileSync(ADMIN, "utf8"), kueche = fs.readFileSync(KUECHE, "utf8");
  /* "pruefen"; oder "pruefen," + — seit dem Team-Modus folgt „zugewiesen“ in derselben Liste. */
  pruef(/"pruefen(?:";|," \+)/.test(kueche) && /b\.pruefen !== true/.test(kueche), "Küche holt pruefen und zeigt Markiertes nicht als Bon");
  pruef(/b\.pruef_grund/.test(admin) && /pruefen:false, pruef_grund:null/.test(admin), "Board liest pruef_grund und gibt über genau diese Spalten frei");
  pruef(/"id, betrieb_id, quelle, status, tisch, positionen, summe, notiz, zeitpunkt, pruefen"/.test(MELDEN) &&
        /zeile\.pruefen === true\) return/.test(MELDEN), "melden liest pruefen und pusht Markiertes nicht");
  /* Herkunft: nie das erste Element von x-forwarded-for (§2.3e). */
  const herkunft = (sql.match(/function public\.schutz_herkunft\(\)[\s\S]*?end \$\$;/) || [""])[0];
  pruef(herkunft.length > 0 && /cf-connecting-ip/.test(herkunft) && !/x-forwarded-for/.test(herkunft),
        "schutz_herkunft liest cf-connecting-ip, nie x-forwarded-for");
  pruef(/sha256\(convert_to\(v_ip \|\| '\|' \|\| v_salz/.test(herkunft), "gespeichert wird nur ein gesalzener Hash");
  /* Die Hilfsfunktionen sind kein rpc-Endpunkt (§2.3a). */
  for (const fn of ["schutz_herkunft\\(\\)", "schutz_stand\\(text, integer\\)", "schutz_zaehlen\\(text, integer\\)", "positionen_pruefen\\(uuid, jsonb\\)"])
    pruef(new RegExp("revoke execute on function public\\." + fn + " from public, anon, authenticated").test(sql),
          fn.replace(/\\/g, "") + " ist für anon/authenticated gesperrt");
}

/* ── 2 · Board ──────────────────────────────────────────────────── */
async function board(browser) {
  console.log("\n══ Board: markierte Bestellung ══");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  s.on("dialog", d => d.accept());
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await s.goto("file://" + ADMIN);
  await s.waitForTimeout(700);
  await s.evaluate(() => {
    document.getElementById("tor").hidden = true;
    beispieldaten();
    window.__upd = []; window.__hinweise = 0;
    const altHinweis = hinweisZeigen; hinweisZeigen = z => { window.__hinweise++; };
    const tab = name => {
      const q = { f: [] };
      q.select = () => { q._sel = true; return q; }; q.eq = (k, v) => { q.f.push([k, v]); return q; }; q.gte = () => q; q.order = () => q;
      q.not = () => q;                        /* wie PostgREST ein Filter; die storniert-Prüfung macht pruef-endstand.js */
      q.update = d => { window.__upd.push([name, d, q]); q._upd = true; return q; };
      /* Ein Schreibweg mit angeforderter Rückgabe bekommt die lebenden Zeilen seiner id-Filter zurück. */
      q.then = (ok, nein) => Promise.resolve({ data: q._upd && q._sel ? q.f.filter(x => x[0] === "id").map(x => ({ id: x[1] })) : [], error: null }).then(ok, nein);
      return q;
    };
    db = { from: tab, rpc: () => Promise.resolve({ data: null, error: null }) };
    demo = false; betriebId = "B1";
    const jetzt = new Date().toISOString();
    bestellungen.unshift(
      { id: "p1", betrieb_id: "B1", quelle: "tisch", status: "neu", tisch: "7", zeitpunkt: jetzt,
        positionen: [{ name: "Gibt es nicht", menge: 1, preis: 0 }], summe: 0, pruefen: true, pruef_grund: "Gericht nicht (mehr) auf der Karte" },
      { id: "p2", betrieb_id: "B1", quelle: "tisch", status: "neu", tisch: "8", zeitpunkt: jetzt,
        positionen: [{ name: "Crêpe", menge: 1, preis: 7 }], summe: 7, pruefen: true, pruef_grund: "Viele Bestellungen in kurzer Zeit von diesem Gerät" });
    zeichneAlles();
  });
  const scharf = await s.$("#scharfJetzt");
  if (scharf && await s.isVisible("#scharf")) { await scharf.click(); await s.waitForTimeout(200); }

  const k1 = await s.evaluate(() => {
    const a = document.querySelector('#karten .bestellung[data-id="p1"]');
    if (!a) return null;
    const schritte = a.querySelector(".schritte");
    return { band: (a.querySelector(".pruefband") || {}).textContent || "", klasse: a.className,
             zusage: !!a.querySelector(".zusage"), schritteSichtbar: schritte && getComputedStyle(schritte).display !== "none",
             info: document.getElementById("filterInfo").textContent };
  });
  pruef(!!k1, "Voraussetzung: die markierte Karte steht im Board");
  if (k1) {
    pruef(/Zu prüfen/.test(k1.band) && /Gericht nicht \(mehr\) auf der Karte/.test(k1.band), "Band „Zu prüfen“ mit dem Grund vom Server", k1.band.replace(/\s+/g, " ").slice(0, 90));
    pruef(!k1.zusage && !k1.schritteSichtbar, "keine Zusage, keine Schritte — nichts, was man aus Versehen annimmt", JSON.stringify({ zusage: k1.zusage, schritte: k1.schritteSichtbar }));
    pruef(/2 zu prüfen/.test(k1.info), "Zählzeile nennt „2 zu prüfen“", k1.info);
  }
  const masse = await s.evaluate(() => [...document.querySelectorAll('#karten .bestellung[data-id="p1"] .pruefknoepfe .knopf')].map(b => Math.round(b.getBoundingClientRect().height)));
  pruef(masse.length === 2 && masse.every(h => h >= 44), "Freigeben/Verwerfen je ≥ 44 px", masse.join(", "));

  await s.click('#karten [data-freigeben="p1"]');
  await s.waitForTimeout(300);
  const nachFrei = await s.evaluate(() => {
    const u = window.__upd.find(x => x[0] === "bestellungen");
    const a = document.querySelector('#karten .bestellung[data-id="p1"]');
    return { felder: u && u[1], filter: u && u[2].f, band: !!(a && a.querySelector(".pruefband")), schritte: !!(a && a.querySelector(".schritte:not([hidden])")) };
  });
  pruef(nachFrei.felder && nachFrei.felder.pruefen === false && nachFrei.felder.pruef_grund === null &&
        JSON.stringify(nachFrei.filter) === JSON.stringify([["id", "p1"], ["betrieb_id", "B1"]]),
        "Freigeben schreibt pruefen=false, pruef_grund=null — nur für DIESE Bestellung dieses Betriebs", JSON.stringify(nachFrei.felder) + " " + JSON.stringify(nachFrei.filter));
  pruef(!nachFrei.band && nachFrei.schritte, "nach der Freigabe ist es eine normale Karte", JSON.stringify(nachFrei));

  await s.click('#karten [data-verwerfen="p2"]');
  await s.waitForTimeout(300);
  const nachWeg = await s.evaluate(() => ({ u: window.__upd.filter(x => x[0] === "bestellungen").map(x => x[1]).pop(),
    karte: !!document.querySelector('#karten .bestellung[data-id="p2"]') }));
  pruef(nachWeg.u && nachWeg.u.status === "abgelehnt" && !nachWeg.karte, "Verwerfen setzt „abgelehnt“, die Karte ist weg", JSON.stringify(nachWeg));

  /* Echtzeit und Nachholen: gemessen am echten Weg. nachholen() holt
     über db.from("bestellungen") — der gestellte Server liefert eine
     markierte und eine freie Bestellung; nur die freie darf klingeln. */
  const klingeln = await s.evaluate(async () => {
    const jetzt = new Date().toISOString();
    const zeilen = [
      { id: "p4", betrieb_id: "B1", quelle: "tisch", status: "neu", tisch: "10", zeitpunkt: jetzt, positionen: [], summe: 0, pruefen: true },
      { id: "p5", betrieb_id: "B1", quelle: "tisch", status: "neu", tisch: "11", zeitpunkt: jetzt, positionen: [], summe: 0, pruefen: false }];
    const alt = db.from;
    db = Object.assign({}, db, { from: name => {
      const q = alt(name);
      if (name === "bestellungen") q.then = (ok, nein) => Promise.resolve({ data: zeilen, error: null }).then(ok, nein);
      q.limit = () => q; return q; } });
    window.__hinweise = 0;
    await nachholen("B1");
    return { hinweise: window.__hinweise, da: ["p4", "p5"].map(id => !!bestellungen.find(b => b.id === id)) };
  });
  pruef(klingeln.hinweise === 1 && klingeln.da.every(Boolean), "Nachholen: markierte aufgenommen, aber nur die freie meldet sich", JSON.stringify(klingeln));
  const quelltext = fs.readFileSync(ADMIN, "utf8");
  pruef(/if\(!nutz\.new\.pruefen\)\{ hinweisZeigen\(nutz\.new\); meldenGebuendelt\(\); \}/.test(quelltext),
        "Echtzeit: markiert → kein Hinweis, kein Ton (Quelltext; der Kanal läuft ohne Server nicht)");

  /* Umsatz: nie freigegeben zählt nicht. */
  const aw = await s.evaluate(() => {
    const t = new Date(); const von = new Date(t.getTime() - 3600000), bis = new Date(t.getTime() + 3600000);
    const zeile = (id, summe, pruefen) => ({ id, quelle: "tisch", status: "neu", summe, zeitpunkt: t.toISOString(), positionen: [], pruefen });
    return awAuswerten([zeile("a", 10, false), zeile("b", 999, true)], von, bis).umsatz;
  });
  pruef(aw === 10, "nie freigegebene Bestellung zählt nicht zum Umsatz", aw);
  pruef(!fehler.length, "keine Ausnahme im Board", fehler.join(" | ") || "still");
  await ctx.close();
}

/* ── 3 · Küche ──────────────────────────────────────────────────── */
async function kueche(browser, spalteFehlt) {
  console.log("\n══ Küche: markierte Bestellung" + (spalteFehlt ? " — Spalte fehlt noch" : "") + " ══");
  const B = "11111111-1111-1111-1111-111111111111";
  const bon = (id, tisch, pruefen) => ({ id, betrieb_id: B, quelle: "tisch", status: "neu", tisch, positionen: [{ name: "Crêpe", menge: 1 }],
    notiz: null, zeitpunkt: new Date().toISOString(), wartezeit_min: null, bestaetigt_um: null,
    kueche_fertig_um: null, theke_fertig_um: null, storno: [], pruefen });
  const gefragt = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.route("**/*", r => {
    const u = decodeURIComponent(r.request().url());
    const json = (b, st) => r.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(b) });
    if (u.startsWith("file://")) return r.continue();
    if (u.includes("/rest/v1/bestellungen")) {
      gefragt.push(u);
      if (spalteFehlt && /pruefen/.test(u)) return json({ message: 'column bestellungen.pruefen does not exist' }, 400);
      return json(spalteFehlt ? [bon("k1", "4")].map(b => { delete b.pruefen; return b; }) : [bon("k1", "4", false), bon("k2", "5", true)]);
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
  const bild = await s.evaluate(() => ({ bons: [...document.querySelectorAll("#feld .bon")].map(b => b.dataset.id),
    lage: document.getElementById("lage").textContent }));
  if (!spalteFehlt) {
    pruef(bild.bons.length === 1 && bild.bons[0] === "k1", "nur der freie Bon steht auf dem Schirm", JSON.stringify(bild.bons));
    pruef(/1 wartet auf Freigabe im Board/.test(bild.lage), "Kopfzeile: „1 wartet auf Freigabe im Board“", bild.lage);
    pruef(gefragt.some(u => /select=[^&]*pruefen/.test(u)), "die Küche fragt pruefen mit ab");
  } else {
    pruef(bild.bons.length === 1, "Spalte fehlt (400): die Küche fragt ohne sie nach und zeigt die Bons wie vorher", JSON.stringify(bild.bons) + " · " + gefragt.length + " Anfragen");
    pruef(!/Freigabe/.test(bild.lage), "und behauptet keine Freigaben", bild.lage);
  }
  pruef(!fehler.length, "keine Ausnahme in der Küche", fehler.join(" | ") || "still");
  await ctx.close();
}

(async () => {
  naht();
  const browser = await chromium.launch();
  try { await board(browser); } catch (e) { pruef(false, "Board-Teil lief durch", String(e).slice(0, 200)); }
  try { await kueche(browser, false); } catch (e) { pruef(false, "Küchen-Teil lief durch", String(e).slice(0, 200)); }
  try { await kueche(browser, true); } catch (e) { pruef(false, "Küchen-Rückfall lief durch", String(e).slice(0, 200)); }
  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
