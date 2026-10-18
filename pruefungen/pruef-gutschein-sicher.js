/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Gutscheine und Codes, nicht ausnutzbar
   (datenbank/migration-gutschein-sicher.sql)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-gutschein-sicher.js

   Braucht dist/ (node erzeuger/erzeuge-hub.js --alle).

   1 · ZWEITE QUELLE: Jeder Grund, den die Ausstell-Funktionen der
       Migration zurückgeben, hat im Board einen Satz — ein neuer Grund
       ohne Satz würde als „bitte Verbindung prüfen“ gemeldet, also
       als Lüge. Dasselbe für rabattcode_pruefen ↔ Hub.
   2 · BOARD, TEAM: Über den echten Weg (gestelltes db antwortet auf
       betrieb_mitglieder mit rolle 'team', dann betriebWaehlen()).
       Ohne Recht bleiben die beiden Gruppen gesperrt; mit Recht gehen
       GENAU diese beiden auf — jede andere Besitzer-Gruppe bleibt zu —
       und der Rahmen des Mitglieds steht da. Beenden läuft über
       gutschein_beenden, nicht über die Tabelle.
   3 · HUB: Ein Code wird VOR dem Abschicken geprüft. Ungültig, falsches
       Gericht, zu viele Versuche, keine Antwort — jedes Mal ein Satz und
       KEINE Bestellung (die Warteschlange würde eine Ablehnung zehn
       Minuten still wiederholen). Gültig → genau eine Prüfung, dann geht
       die Bestellung mit dem Code hinaus. Englisch übersetzt.

   EHRLICHE GRENZE: Was der Server wirklich tut (Freigabe je Gerät,
   Zählen ohne Werfen, Teilstorno-Deckel), ist zurückgedreht gegen den
   echten Bestand gemessen — Protokoll im Kopf der Migration.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");

/* Seit 18.10. liegt jede Einstellungsgruppe hinter einer Kachel. Öffnet
   die Unterseite, in der `sel` steht — über einen ECHTEN Tipp auf die
   Kachel (vorher „Alle Einstellungen“, falls eine andere offen ist).
   Gibt false, wenn es die Gruppe nicht gibt (Voraussetzung, §8.1g). */
async function euZu(p, sel) {
  const id = await p.evaluate(s => {
    const el = document.querySelector(s);
    const g = el && el.closest("#t-einstellungen > .egruppe");
    return g && !g.classList.contains("eu-uebersicht") ? g.id : null;
  }, sel);
  if (!id) return false;
  if (await p.evaluate(i => document.getElementById("t-einstellungen").dataset.euOffen === i, id)) return true;
  if (await p.isVisible("#euZurueck")) await p.click("#euZurueck");
  await p.click('[data-eu-seite="' + id + '"]');
  await p.waitForTimeout(150);
  return p.evaluate(i => document.getElementById("t-einstellungen").dataset.euOffen === i, id);
}
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const MIG = path.join(OBEN, "datenbank", "migration-gutschein-sicher.sql");
const DIST = process.env.DIST || path.join(OBEN, "dist");
const HAUS = "chocolamour";
const BID = "11111111-2222-3333-4444-555555555555";
const G = "L'AMouR Crêpe";

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

/* Gründe, die eine Funktion der Migration als Antwort gibt. */
function gruende(sql, name) {
  const teile = sql.split(/create or replace function public\./);
  const block = teile.find(b => b.startsWith(name + "(")) || "";
  const ende = block.indexOf("$function$;", block.indexOf("$function$") + 10);
  const koerper = ende > 0 ? block.slice(0, ende) : block;
  return [...new Set([...koerper.matchAll(/'grund',\s*'(\w+)'/g)].map(m => m[1])
    .concat([...koerper.matchAll(/return '(\w+)'/g)].map(m => m[1]))
    .concat([...koerper.matchAll(/then '(\w+)' else '(\w+)'/g)].flatMap(m => [m[1], m[2]])))];
}

/* Gestelltes Supabase für das Board (Muster pruef-rollen.js). */
function stelleDb() {
  return (cfg) => {
    window.__log = [];
    function antwort(z) {
      if (z.tab === "rpc") {
        window.__log.push(["rpc", z.name, z.args]);
        if (z.name === "gutschein_recht") return { data: cfg.recht, error: null };
        if (z.name === "gutschein_beenden") return { data: { ok: true }, error: null };
        return { data: null, error: null };
      }
      if (z.op !== "select") { window.__log.push([z.op, z.tab]); return { data: null, error: null }; }
      if (z.tab === "betrieb_mitglieder")
        return { data: [{ rolle: cfg.rolle, betriebe: { id: "b-team", slug: "b-team", name: "Probe", bestell_pause: false, hub_texte: {} } }], error: null };
      if (z.tab === "gutscheine")
        return { data: [{ id: "gs-1", titel: "Kaffee aufs Haus", beschreibung: "", code: "DANKE-ABCDEFGHJK",
                          gueltig_bis: null, gast_id: null, angelegt: new Date().toISOString(), angelegt_name: "Mara" }], error: null };
      return { data: z.einzeln ? null : [], error: null };
    }
    function kette(tab, name, args) {
      const z = { tab, op: "select", einzeln: false, name, args };
      const p = new Proxy(function () {}, {
        get(_, k) {
          if (k === "then") return (res) => res(antwort(z));
          return (...a) => {
            if (["update", "insert", "upsert", "delete"].includes(k)) z.op = k;
            if (k === "maybeSingle" || k === "single") z.einzeln = true;
            return p;
          };
        },
        apply() { return p; }
      });
      return p;
    }
    db = {
      from: t => kette(t),
      rpc: (name, args) => kette("rpc", name, args),
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
  };
}

async function boardAls(browser, cfg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const seite = await ctx.newPage();
  const fehler = [];
  seite.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  seite.on("dialog", d => d.accept());
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(600);
  const scharf = await seite.$("#scharfJetzt");
  if (scharf && await seite.isVisible("#scharf")) { await scharf.click(); await seite.waitForTimeout(150); }
  await seite.evaluate(stelleDb(), cfg);
  await seite.evaluate(async () => {
    document.getElementById("tor").hidden = true;
    try { localStorage.setItem(merkSchluessel(), "b-team"); } catch (e) {}
    await betriebWaehlen();
  });
  await seite.waitForTimeout(300);
  await seite.evaluate(() => document.querySelector('[data-tafel="einstellungen"]').click());
  await seite.waitForTimeout(500);
  return { ctx, seite, fehler };
}

function gruppe(id) {
  const g = document.getElementById(id);
  const satz = g.querySelector(":scope > .nur-inhaber-satz");
  const knopf = g.querySelector("button[type=submit]");
  return { satz: !!satz, gesperrt: !!(knopf && knopf.closest("[inert]")) };
}

(async () => {
  const browser = await chromium.launch();

  console.log("\n══ 1 · Zweite Quelle: jeder Grund hat einen Satz ══");
  const sql = fs.readFileSync(MIG, "utf8");
  const board = ["gutschein_recht", "rabattcode_ausstellen", "gutschein_ausstellen", "gutschein_beenden",
                 "rabattcode_beenden", "pin_ausstellung_pruefen"].flatMap(fn => gruende(sql, fn));
  const setzen = gruende(sql, "pin_erstmals_setzen");
  const gast = gruende(sql, "rabattcode_pruefen");
  pruef(board.length >= 15 && setzen.length >= 3 && gast.length >= 3, "Gründe aus der Migration gelesen",
    board.length + " / " + setzen.length + " / " + gast.join(","));
  const html = fs.readFileSync(ADMIN, "utf8");
  const satzBlock = (html.match(/const AUSSTELL_GRUND = \{([\s\S]*?)\n\};/) || [])[1] || "";
  const setzBlock = (html.match(/const AP_SETZ_GRUND = \{([\s\S]*?)\n\};/) || [])[1] || "";
  /* pin_falsch fragt neu (kein Satz in der Liste, sondern im Blatt). */
  const ohne = [...new Set(board)].filter(g => g !== "pin_falsch" && !new RegExp("\\b" + g + ":").test(satzBlock));
  pruef(!ohne.length, "Board: jeder Grund der Ausstell-Funktionen hat einen Satz", ohne.join(", ") || "alle");
  pruef(/pin_falsch/.test(html.match(/async function mitPin[\s\S]*?\n\}/)[0]), "pin_falsch fragt im Blatt erneut");
  const ohneSetz = setzen.filter(g => !new RegExp("\\b" + g + ":").test(setzBlock));
  pruef(!ohneSetz.length, "Board: jeder Grund von pin_erstmals_setzen hat einen Satz", ohneSetz.join(", ") || "alle");
  const hub = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");
  const hubTeil = (hub.match(/Code VOR dem Senden prüfen[\s\S]*?In die Warteschlange/) || [""])[0];
  const ohneHub = gast.filter(g => g !== "ungueltig" && !hubTeil.includes('"' + g + '"'));
  pruef(gast.includes("ungueltig") && !ohneHub.length, "Hub: jeder Grund von rabattcode_pruefen hat einen eigenen Satz (ungueltig = Rückfall)",
    ohneHub.join(", ") || gast.join(", "));

  console.log("\n══ 2 · Board, Team ohne Recht ══");
  {
    const { ctx, seite, fehler } = await boardAls(browser, { rolle: "team", recht: { ok: false, grund: "kein_recht" } });
    const r = await seite.evaluate(() => ({ rolle: document.body.dataset.rolle }));
    pruef(r.rolle === "team", "Voraussetzung: Board läuft als Team", r.rolle);
    for (const id of ["rcGruppe", "gsGruppe"]) {
      const g = await seite.evaluate(gruppe, id);
      pruef(g.satz && g.gesperrt, id + ": Satz da, Anlegen nicht erreichbar", JSON.stringify(g));
    }
    pruef(await seite.evaluate(() => document.getElementById("rcRahmen").hidden), "kein Rahmen ohne Recht");
    pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ 2 · Board, Team mit Recht ══");
  {
    const recht = { ok: true, inhaber: false, pin: true, max_betrag: 10, max_prozent: 20, tag_max: 5, heute: 1 };
    const { ctx, seite, fehler } = await boardAls(browser, { rolle: "team", recht });
    const ruf = await seite.evaluate(() => window.__log.filter(x => x[0] === "rpc" && x[1] === "gutschein_recht").length);
    pruef(ruf >= 1, "Voraussetzung: Board fragt gutschein_recht", ruf);
    for (const id of ["rcGruppe", "gsGruppe"]) {
      const g = await seite.evaluate(gruppe, id);
      pruef(!g.satz && !g.gesperrt, id + ": für dieses Mitglied offen", JSON.stringify(g));
    }
    const andere = await seite.evaluate(() => [...document.querySelectorAll(".egruppe[data-nur-inhaber]:not([data-gutschein-recht])")]
      .filter(g => !g.querySelector(":scope > .nur-inhaber-satz")).map(g => (g.querySelector(".etitel") || {}).textContent));
    pruef(andere.length === 0, "jede andere Besitzer-Gruppe bleibt gesperrt", andere.join(", ") || "alle zu");
    const rahmen = await seite.evaluate(() => ({ an: !document.getElementById("rcRahmen").hidden, t: document.getElementById("rcRahmen").textContent }));
    pruef(rahmen.an && /10,00 €/.test(rahmen.t) && /20 %/.test(rahmen.t) && /5 je Tag/.test(rahmen.t) && /heute 1/.test(rahmen.t),
      "Rahmen des Mitglieds steht über dem Formular", rahmen.t);
    /* Neu öffnen (rolleAnwenden sperrt wieder) — der zwischengespeicherte
       Stand muss die Gruppen erneut öffnen. */
    await seite.evaluate(async () => { await betriebWaehlen(); });
    await seite.evaluate(() => document.querySelector('[data-tafel="einstellungen"]').click());
    await seite.waitForTimeout(500);
    const nochmal = await seite.evaluate(gruppe, "gsGruppe");
    pruef(!nochmal.satz && !nochmal.gesperrt, "nach erneutem Öffnen des Betriebs weiter offen", JSON.stringify(nochmal));

    /* Beenden über die Funktion, nicht über die Tabelle. */
    pruef(/ausgestellt von Mara/.test(await seite.textContent("#gsListe")), "Liste nennt, wer ausgestellt hat");
    pruef(await euZu(seite, "#gsListe"), "Voraussetzung: Unterseite Gutscheine über ihre Kachel geöffnet");
    await seite.click('#gsListe [data-gs-ende="gs-1"]');
    await seite.waitForTimeout(400);
    const log = await seite.evaluate(() => window.__log);
    pruef(log.some(x => x[0] === "rpc" && x[1] === "gutschein_beenden" && x[2] && x[2].p_id === "gs-1"),
      "Beenden ruft gutschein_beenden mit der id");
    pruef(!log.some(x => x[0] !== "rpc" && x[0] !== "select" && x[1] === "gutscheine"), "kein direktes Schreiben in gutscheine");
    pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ 3 · Hub: Code vor dem Abschicken ══");
  if (!fs.existsSync(path.join(DIST, HAUS, "index.html"))) {
    pruef(false, "dist/ fehlt — erst node erzeuger/erzeuge-hub.js --alle");
  } else {
    const netz = { pruefen: [], bestellungen: [], antwort: null, weg: false };
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.clock.setFixedTime(new Date("2026-10-08T14:00:00"));
    await p.route("**/*", r => {
      const u = r.request().url();
      if (u.startsWith("file://")) return r.continue();
      const body = r.request().postData() || "";
      if (/rest\/v1\/betriebe/.test(u)) return r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify([{ id: BID, bestell_pause: false, bestell_pause_text: "", hub_texte: {} }]) });
      if (/rpc\/rabattcode_pruefen/.test(u)) {
        netz.pruefen.push(JSON.parse(body || "{}"));
        if (netz.weg) return r.abort();
        return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(netz.antwort) });
      }
      if (/rpc\/bestellung_aufgeben/.test(u)) {
        netz.bestellungen.push(JSON.parse(body || "{}"));
        return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify("aaaaaaaa-bbbb-cccc-dddd-000000000001") });
      }
      if (/rpc\/gast_melden/.test(u)) return r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, neu: false, besuche: 1, lieblinge: [], gutscheine: [] }) });
      return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await p.goto("file://" + path.join(DIST, HAUS, "index.html"));
    await p.waitForTimeout(1300);
    await p.evaluate(() => { if (typeof ZEITEN !== "undefined") { ZEITEN.length = 0; for (let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59"); } });
    await p.evaluate(g => detailOeffnen(g), G);
    await p.waitForTimeout(350);
    await p.click('#warenkarte [data-wmerk]');
    await p.waitForTimeout(250);
    const imKorb = await p.evaluate(g => !!merk[g], G);
    pruef(imKorb, "Voraussetzung: " + G + " liegt im Korb");

    async function versuch(code, antwort, weg) {
      netz.antwort = antwort; netz.weg = !!weg;
      await p.evaluate(() => { location.hash = "#/auswahl"; });
      await p.waitForTimeout(400);
      if (await p.$("#bTisch")) await p.fill("#bTisch", "7");
      await p.fill("#bRabattcode", code);
      const vorP = netz.pruefen.length, vorB = netz.bestellungen.length;
      await p.click('[data-aktion="bestellen"]');
      await p.waitForTimeout(900);
      return { pruefungen: netz.pruefen.length - vorP, bestellt: netz.bestellungen.length - vorB,
               satz: await p.evaluate(() => (document.getElementById("melde") || {}).textContent || ""),
               hash: await p.evaluate(() => location.hash) };
    }

    let v = await versuch("falsch 1", { ok: false, grund: "ungueltig" });
    pruef(v.pruefungen === 1 && v.bestellt === 0, "ungültig: geprüft, NICHT bestellt", JSON.stringify(v));
    pruef(/Dieser Code gilt hier nicht\./.test(v.satz), "ungültig: Satz", v.satz);
    const nutz = netz.pruefen[netz.pruefen.length - 1];
    pruef(nutz.p_code === "FALSCH1" && nutz.p_betrieb === BID && /^[A-Za-z0-9_-]{8,64}$/.test(nutz.p_geraet || ""),
      "Nutzlast: Code groß ohne Leerzeichen, Betrieb, Gerätekennung", JSON.stringify(nutz));
    pruef(Array.isArray(nutz.p_namen) && nutz.p_namen.includes(G), "Nutzlast: Namen im Korb (für das Ziel-Gericht)", JSON.stringify(nutz.p_namen));
    /* Naht (§8.1i): gesendete Schlüssel = Parameter der Funktion in der Migration. */
    const kopf = sql.match(/function public\.rabattcode_pruefen\(([\s\S]*?)\)\s*returns/);
    const params = kopf ? [...kopf[1].matchAll(/\b(p_\w+)\s/g)].map(m => m[1]).sort() : [];
    pruef(params.length === 4 && JSON.stringify(Object.keys(nutz).sort()) === JSON.stringify(params),
      "Naht: Hub schickt genau die Parameter von rabattcode_pruefen", Object.keys(nutz).sort().join(",") + " / " + params.join(","));
    /* Und die Freigabe hängt am Gerät: dieselbe Form in beiden Funktionen. */
    const form = [...sql.matchAll(/\^\[A-Za-z0-9_-\]\{8,64\}\$|length\(p_geraet\) < 8 or length\(p_geraet\) > 64/g)].length;
    pruef(form >= 2, "Gerätekennung: rabattcode_pruefen und bestellung_aufgeben prüfen dieselbe Form", form);
    pruef(await p.evaluate(g => !!merk[g], G) && v.hash === "#/auswahl", "Korb bleibt, Gast bleibt in der Auswahl");

    v = await versuch("ZIEL50", { ok: false, grund: "gericht_fehlt", ziel: "Bounty Waffel" });
    pruef(v.bestellt === 0 && /Bounty Waffel/.test(v.satz), "Ziel-Gericht fehlt: Satz nennt das Gericht, nicht bestellt", v.satz);
    v = await versuch("RATE25", { ok: false, grund: "zu_viele" });
    pruef(v.bestellt === 0 && /Zu viele Versuche/.test(v.satz), "zu viele Versuche: Satz, nicht bestellt", v.satz);
    v = await versuch("GUT-1", null, true);
    pruef(v.bestellt === 0 && /nicht prüfen/.test(v.satz), "keine Antwort: Satz, NICHT still ohne Code bestellt", v.satz);
    v = await versuch("GUT-1", { ok: false });
    pruef(v.bestellt === 0, "Antwort ohne Grund: nicht bestellt", v.satz);

    v = await versuch("gut-1", { ok: true, prozent: 10, betrag: null, ziel: null });
    pruef(v.pruefungen === 1, "gültig: genau EINE Prüfung (der zweite Klick zählt nicht nochmal)", v.pruefungen);
    pruef(v.bestellt === 1 && netz.bestellungen[netz.bestellungen.length - 1].p_rabattcode === "GUT-1",
      "gültig: Bestellung geht mit dem Code hinaus", JSON.stringify(netz.bestellungen.slice(-1).map(b => b.p_rabattcode)));
    pruef(v.hash === "#/bestellt", "gültig: Gast landet auf der Bestätigung", v.hash);

    /* Ohne Code: keine Prüfung. */
    await p.evaluate(g => detailOeffnen(g), G);
    await p.waitForTimeout(300);
    await p.click('#warenkarte [data-wmerk]');
    await p.waitForTimeout(200);
    await p.evaluate(() => { bestellSperre = 0; });
    v = await versuch("", null);
    pruef(v.pruefungen === 0 && v.bestellt === 1, "ohne Code: keine Prüfung, Bestellung geht", JSON.stringify(v));

    /* Englisch */
    await p.evaluate(g => { spracheSetzen("en"); detailOeffnen(g); }, G);
    await p.waitForTimeout(300);
    await p.click('#warenkarte [data-wmerk]');
    await p.waitForTimeout(200);
    await p.evaluate(() => { bestellSperre = 0; });
    v = await versuch("X1", { ok: false, grund: "ungueltig" });
    pruef(/This code isn't valid here\./.test(v.satz), "Englisch: Satz übersetzt", v.satz);
    v = await versuch("X1", { ok: false, grund: "gericht_fehlt", ziel: "Bounty Waffel" });
    pruef(/only applies to “Bounty Waffel”/.test(v.satz), "Englisch: Platzhalter gefüllt", v.satz);
    pruef(!fehler.length, "keine Ausnahme im Hub", fehler.join(" | ") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " Fehler von " + n : "Alles sauber. (" + n + " Proben)"));
  process.exit(f ? 1 : 0);
})();
