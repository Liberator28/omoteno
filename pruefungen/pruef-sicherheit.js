/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Sicherheitssystem (08.10.)

     node erzeuger/bauen.js
     NODE_PATH=$(npm root -g) node pruefungen/pruef-sicherheit.js

   Der Wunsch: Angriffe über den öffentlichen anon-Schlüssel, Fluten mit
   Kostenfolge und automatisierte (KI-)Angriffe abwehren. Geprüft wird,
   was dieses Verzeichnis dazu beiträgt — gemessen, nicht angesehen:

   1 · Kopfzeilen: Ein lokaler Server liefert oeffentlich/ mit genau den
       Kopfzeilen aus auslieferung/_headers aus, so wie Netlify sie
       zusammensetzt. Jede Seite trägt CSP (object-src 'none',
       frame-ancestors 'none', kein cdn.jsdelivr.net), HSTS, DENY;
       /lib/* ist ein Jahr gültig.
   2 · CSP bricht nichts: Jede Seite (Landing, Start, Konto, Board,
       Küche, Master, Studio, Recht, zwei Hubs mit Karte, Detailblatt
       und bewegten Zeichen, Board mit Live-Vorschau) meldet KEINEN
       securitypolicyviolation.
   3 · Bibliothek fest und geprüft: supabase-js kommt von /lib/ mit
       integrity — eine manipulierte Datei wird NICHT ausgeführt.
   4 · Netz-Bremse (HTTP 429) an allen fünf Anmeldetüren: ein Satz statt
       still weiter, KEIN Login-Versuch danach. Gegenfall: erlaubt →
       Login-Versuch läuft.
   5 · Kein Abfragen im Hintergrund: Hub bei verstecktem Tab (gestellte
       Uhr, zehn Minuten) ohne Aktions- und Kartenabruf; beim Zurück-
       kommen sofort; Gegenfall sichtbar → es wird gefragt.
   6 · Datenbank, zweite Quelle datenbank/stand-anon-funktionen.sql:
       Jede für anon offene security-definer-Funktion hat eine Bremse
       oder steht NAMENTLICH mit Grund in einer der Listen unten; was
       aussteht, wird von migration-schutz-2.sql geschlossen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const AUS  = path.join(OBEN, "oeffentlich");
const HEADERS = path.join(OBEN, "auslieferung", "_headers");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

/* Ausnahmen — namentlich, mit Grund (§8.1g D: kein Muster). */
const AUSGENOMMEN = {
  meine_betriebe: "steckt in RLS-Regeln und läuft dort je ZEILE; liefert anon nichts",
  ist_master: "steckt in RLS-Regeln und läuft dort je ZEILE; liefert anon false",
};
/* Leer seit alle Bremsen live sind. Wer hier etwas einträgt, nennt,
   was noch eingespielt werden muss — die Datei muss es dann schließen. */
const AUSSTEHEND = {};

/* ── _headers lesen und wie Netlify anwenden ─────────────────────── */
function regelnLesen() {
  const regeln = []; let akt = null;
  for (const roh of fs.readFileSync(HEADERS, "utf8").split("\n")) {
    if (!roh.trim() || roh.trim().startsWith("#")) continue;
    if (!/^\s/.test(roh)) { akt = { muster: roh.trim(), kopf: [] }; regeln.push(akt); continue; }
    const m = roh.trim().match(/^([A-Za-z-]+):\s*(.*)$/);
    if (m && akt) akt.kopf.push([m[1], m[2]]);
  }
  return regeln;
}
const passt = (muster, pfad) => new RegExp("^" + muster.split("*").map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$").test(pfad);
function kopfFuer(regeln, pfad) {
  const k = {};
  for (const r of regeln) if (passt(r.muster, pfad))
    for (const [name, wert] of r.kopf) k[name] = k[name] ? k[name] + ", " + wert : wert;
  return k;
}
const TYP = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".json": "application/json",
  ".css": "text/css", ".woff2": "font/woff2", ".txt": "text/plain", ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };

function serverStarten(regeln) {
  return new Promise(fertig => {
    const s = http.createServer((anf, ant) => {
      let pfad = decodeURIComponent(anf.url.split("?")[0]);
      let datei = path.join(AUS, pfad);
      if (pfad.endsWith("/")) datei = path.join(datei, "index.html");
      if (!datei.startsWith(AUS) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) { ant.writeHead(404); ant.end(); return; }
      const kopf = kopfFuer(regeln, pfad.endsWith("/") ? pfad + "index.html" : pfad);
      kopf["Content-Type"] = TYP[path.extname(datei)] || "application/octet-stream";
      ant.writeHead(200, kopf); ant.end(fs.readFileSync(datei));
    });
    s.listen(0, "127.0.0.1", () => fertig(s));
  });
}

async function seiteAuf(browser, basis, pfad, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const p = await ctx.newPage();
  const verstoss = [], fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
  await p.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", e =>
      window.__csp.push(e.violatedDirective + " ← " + (e.blockedURI || "inline") + (e.sourceFile ? " @" + e.sourceFile.split("/").pop() + ":" + e.lineNumber : "")));
    try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {}
  });
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith(basis)) return r.continue();
    const m = u.match(/^https:\/\/omoteno\.de\/((?:emoji|schriften|lib)\/[^?]+)/);
    if (m && fs.existsSync(path.join(AUS, m[1])))
      return r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: TYP[path.extname(m[1])] || "application/octet-stream", body: fs.readFileSync(path.join(AUS, m[1])) });
    if (/supabase\.co/.test(u)) return (opt.supabase || (rr => rr.fulfill({ status: 200, contentType: "application/json", body: "[]" })))(r);
    return r.abort();
  });
  const antwort = await p.goto(basis + pfad);
  await p.waitForTimeout(opt.warten || 1500);
  return { ctx, p, verstoss, fehler, antwort };
}

(async () => {
  if (!fs.existsSync(path.join(AUS, "h"))) { console.log("Kein oeffentlich/ — erst node erzeuger/bauen.js"); process.exit(1); }
  const regeln = regelnLesen();
  const server = await serverStarten(regeln);
  const basis = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();

  console.log("\n══ 1 · Kopfzeilen wie bei Netlify ══");
  for (const pfad of ["/index.html", "/admin.html", "/h/chocolamour/index.html", "/konto.html"]) {
    const k = kopfFuer(regeln, pfad), csp = k["Content-Security-Policy"] || "";
    pruef(/object-src 'none'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /base-uri 'self'/.test(csp) && /form-action 'self'/.test(csp),
      pfad + ": CSP mit object-src/frame-ancestors/base-uri/form-action", csp.slice(0, 60) + "…");
    pruef(!/jsdelivr/.test(csp), pfad + ": CSP erlaubt kein cdn.jsdelivr.net");
    pruef((csp.match(/Content-Security-Policy|default-src/g) || []).length === 1, pfad + ": genau eine Richtlinie (keine zweite, die per Komma angehängt wird)");
    pruef(/max-age=31536000/.test(k["Strict-Transport-Security"] || ""), pfad + ": HSTS ein Jahr");
    pruef(k["X-Frame-Options"] === "DENY", pfad + ": X-Frame-Options DENY");
  }
  pruef(/immutable/.test(kopfFuer(regeln, "/lib/supabase-js-2.117.3.js")["Cache-Control"] || ""), "/lib/* ein Jahr, immutable");
  pruef(/max-age=0/.test(kopfFuer(regeln, "/sw.js")["Cache-Control"] || ""), "/sw.js wird jedes Mal geprüft");
  const seiten = fs.readdirSync(path.join(OBEN, "seiten")).filter(x => x.endsWith(".html"));
  const cdn = seiten.filter(x => /<script[^>]+src="https?:\/\/(?!omoteno\.de)/.test(fs.readFileSync(path.join(OBEN, "seiten", x), "utf8")));
  pruef(!cdn.length, "keine Seite lädt ein Skript von fremder Herkunft", cdn.join(", ") || seiten.length + " Seiten");

  console.log("\n══ 2 · CSP bricht keine Seite ══");
  const LISTE = [
    ["/index.html"], ["/start.html"], ["/konto.html"], ["/kueche.html"], ["/master.html"], ["/einkauf.html"], ["/marken-studio.html"],
    ["/datenschutz.html"], ["/impressum.html"], ["/admin.html", "board"],
    ["/h/chocolamour/index.html#/speisekarte", "hub"], ["/h/blend/index.html#/speisekarte", "hub"],
  ];
  for (const [pfad, art] of LISTE) {
    const { ctx, p, fehler, antwort } = await seiteAuf(browser, basis, pfad);
    const csp = antwort && antwort.headers()["content-security-policy"];
    if (art === "hub") {
      await p.evaluate(() => { const g = document.querySelector(".gericht .ginfo"); if (g) g.click(); });
      await p.waitForTimeout(1500);
    }
    if (art === "board") {
      await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); zeichneAlles();
        const s = document.getElementById("scharf"); if (s) s.hidden = true;
        const t = document.querySelector('[data-tafel="startseite"]'); if (t) t.click(); });
      await p.waitForTimeout(2500);
    }
    const v = await p.evaluate(() => window.__csp);
    pruef(!!csp, pfad + ": mit CSP ausgeliefert");
    pruef(!v.length, pfad + ": kein CSP-Verstoß", v.slice(0, 3).join(" | ") || "still");
    if (art === "hub") {
      const lauf = await p.evaluate(() => document.querySelectorAll(".gericht").length);
      pruef(lauf > 3, pfad + ": Karte steht trotz CSP", lauf + " Gerichte");
    }
    pruef(!fehler.length, pfad + ": keine Skriptfehler", fehler.slice(0, 2).join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ 3 · supabase-js fest, mit integrity ══");
  {
    const { ctx, p } = await seiteAuf(browser, basis, "/admin.html");
    pruef(await p.evaluate(() => !!(window.supabase && window.supabase.createClient)), "echte Datei: Bibliothek geladen");
    await ctx.close();
    const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage();
    await p2.route("**/lib/supabase-js-2.117.3.js", async r => {
      const echt = fs.readFileSync(path.join(AUS, "lib", "supabase-js-2.117.3.js"), "utf8");
      r.fulfill({ status: 200, contentType: "application/javascript", body: echt + "\n;window.__boese = 1;" });
    });
    await p2.route(/supabase\.co/, r => r.abort());
    await p2.goto(basis + "/admin.html"); await p2.waitForTimeout(1200);
    pruef(await p2.evaluate(() => !window.__boese && !window.supabase), "manipulierte Datei: wird NICHT ausgeführt (integrity)");
    await ctx2.close();
  }

  console.log("\n══ 4 · HTTP 429 an allen fünf Anmeldetüren ══");
  const TUEREN = [
    { pfad: "/admin.html", mail: "#lMail", pass: "#lPass", knopf: "#lKnopf", meldung: "#lFehler" },
    { pfad: "/konto.html", mail: "#fMail", pass: "#fPass", knopf: "#torKnopf", meldung: "#torMeldung" },
    { pfad: "/kueche.html", mail: "#mail", pass: "#wort", knopf: "#torKnopf", meldung: "#torMeldung" },
    { pfad: "/master.html", mail: "#email", pass: "#password", knopf: "#loginBtn", meldung: "#loginMsg" },
    { pfad: "/einkauf.html", mail: "#email", pass: "#password", knopf: "#loginBtn", meldung: "#loginMsg" },
  ];
  for (const t of TUEREN) for (const fall of ["429", "erlaubt"]) {
    let tokenVersuch = 0;
    const { ctx, p } = await seiteAuf(browser, basis, t.pfad, { warten: 1200, supabase: r => {
      const u = r.request().url();
      if (/rpc\/admin_anmelden/.test(u)) return fall === "429"
        ? r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ code: "PT429", details: null, hint: "Zu viele Anfragen aus diesem Netz.", message: "zu_viele_anfragen" }) })
        : r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ erlaubt: true, gesperrt: false, nachricht: "" }) });
      if (/auth\/v1\/token/.test(u)) { tokenVersuch++; return r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }) }); }
      return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    } });
    const sichtbar = await p.isVisible(t.mail).catch(() => false);
    if (!sichtbar) { pruef(false, t.pfad + " (" + fall + "): Anmeldefeld sichtbar"); await ctx.close(); continue; }
    // Board: „Scharf schalten" liegt über dem Tor (wie pruef-admin-login.js).
    await p.evaluate(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
    if (await p.isVisible("#scharf").catch(() => false)) { await p.click("#scharfJetzt").catch(() => {}); await p.waitForTimeout(300); }
    await p.fill(t.mail, "probe@example.invalid"); await p.fill(t.pass, "irgendwas-langes");
    await p.click(t.knopf); await p.waitForTimeout(1200);
    const text = await p.$eval(t.meldung, el => el.textContent).catch(() => "");
    if (fall === "429") {
      pruef(/Zu viele Anmeldeversuche/.test(text), t.pfad + ": 429 → ein Satz", text.trim().slice(0, 70));
      pruef(tokenVersuch === 0, t.pfad + ": 429 → KEIN Login-Versuch danach", tokenVersuch);
    } else {
      pruef(tokenVersuch >= 1, t.pfad + ": Gegenfall erlaubt → Login-Versuch läuft", tokenVersuch);
    }
    await ctx.close();
  }

  console.log("\n══ 5 · Kein Abfragen im Hintergrund ══");
  for (const sichtbar of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.clock.install();
    /* Gezählt wird die ERSTE Anfrage von karteHolen (betriebe). Die zweite
       (Gerichtsliste) kommt unter der gestellten Uhr nie: runFor spult über
       den Abbruch-Timer von karteHolen hinweg, bevor die echte Antwort
       da ist — gemessen, ein Messfehler, kein Fehler im Hub. */
    let abrufe = { aktionen: 0, karte: 0 };
    await p.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
    await p.route("**/*", r => {
      const u = r.request().url();
      if (u.startsWith(basis)) return r.continue();
      if (/rest\/v1\/aktionen/.test(u)) abrufe.aktionen++;
      if (/rest\/v1\/betriebe/.test(u)) { abrufe.karte++; return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "af095b14-d9ef-41f4-9b97-c4422b0de63f", bestell_pause: false, hub_texte: {} }]) }); }
      if (/supabase\.co/.test(u)) return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return r.abort();
    });
    await p.goto(basis + "/h/chocolamour/index.html");
    await p.clock.runFor(3000);
    if (!sichtbar) await p.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const vorher = { ...abrufe };
    await p.clock.runFor(10 * 60 * 1000);
    /* Echte Zeit für den Route-Horcher: Die Anfrage entsteht unter der
       gestellten Uhr, gezählt wird sie erst, wenn Playwright sie
       abfängt — ohne diese Pause wackelte der Gegenfall (0 oder 1). */
    await p.waitForTimeout(800);
    const im = { aktionen: abrufe.aktionen - vorher.aktionen, karte: abrufe.karte - vorher.karte };
    if (sichtbar) {
      pruef(im.aktionen >= 3 && im.karte >= 1, "Gegenfall sichtbar: in zehn Minuten wird gefragt", JSON.stringify(im));
    } else {
      pruef(im.aktionen === 0 && im.karte === 0, "versteckt: zehn Minuten lang kein Abruf", JSON.stringify(im));
      const vor2 = abrufe.karte;
      await p.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await p.clock.runFor(1500);
      await p.waitForTimeout(800);
      pruef(abrufe.karte > vor2, "zurück im Vordergrund: Karte wird sofort geholt", (abrufe.karte - vor2) + " Abruf");
    }
    await ctx.close();
  }

  console.log("\n══ 6 · Datenbank: jede offene Funktion gebremst oder begründet ══");
  {
    const stand = fs.readFileSync(path.join(OBEN, "datenbank", "stand-anon-funktionen.sql"), "utf8")
      .split("\n").filter(z => /^[a-z_]+\s*\|/.test(z)).map(z => z.split("|").map(x => x.trim()));
    const migr = fs.readFileSync(path.join(OBEN, "datenbank", "migration-schutz-2.sql"), "utf8");
    pruef(stand.length >= 15, "zweite Quelle gelesen", stand.length + " Funktionen");
    for (const [name, bremse] of stand) {
      if (bremse === "koerper" || bremse === "trigger" || bremse === "aufgeben") { pruef(true, name + ": gebremst (" + bremse + ")"); continue; }
      if (AUSGENOMMEN[name]) { pruef(true, name + ": ausgenommen — " + AUSGENOMMEN[name]); continue; }
      if (AUSSTEHEND[name]) {
        const block = (migr.split(/create or replace function public\./).find(b => b.startsWith(name + "(")) || "");
        pruef(/perform schutz_bremsen\(/.test(block), name + ": OFFEN — " + AUSSTEHEND[name] + " (die Datei schließt es)");
        continue;
      }
      pruef(false, name + ": für anon offen OHNE Bremse und ohne Begründung");
    }
    /* Die Datei wird GANZ im SQL-Editor ausgeführt, auch wiederholt.
       Jede Funktion, die sie neu anlegt, muss die Bremse tragen —
       sonst dreht ein erneuter Lauf den Live-Stand zurück (Gegenbeweis
       08.10.: Bremse aus slug_frei entfernt, die Liste oben blieb grün,
       weil live „koerper“ steht). */
    const bloecke = migr.split(/create or replace function public\./).slice(1)
      .map(b => [b.slice(0, b.indexOf("(")), b]).filter(([n]) => n !== "schutz_bremsen");
    pruef(bloecke.length >= 8, "migration-schutz-2.sql gelesen", bloecke.length + " Funktionen");
    for (const [n, b] of bloecke)
      pruef(/\n\s*perform schutz_bremsen\(/.test(b), "migration-schutz-2.sql · " + n + ": Bremse in der Datei");
  }

  await browser.close(); server.close();
  console.log("\n" + (f ? f + " Fehler von " + n : "Alles sauber. (" + n + " Proben)"));
  process.exit(f ? 1 : 0);
})();
