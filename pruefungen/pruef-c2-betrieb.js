/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Einstellungen „Betrieb & Team“ und Anleitung — je drei neue
   Funktionen (Plan Teil C, Block C2a, 01.11.)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-c2-betrieb.js
     ADMIN_DATEI=… für Gegenbeweise auf Kopien

   Betrieb: Hub-Adresse (aus dem Slug, nur a–z 0–9 -), Kopieren, Teilen
     (ohne Web Share: neuer Tab), QR-Code-Aushang — der QR wird aus dem
     gedruckten Rahmen ZURÜCKGELESEN (jsQR, zweite Quelle) —, heute geöffnet
     aus dem Markenblatt (Sonntag zuerst, wie ZEITEN im Hub), Ruhetag,
     fehlende Zeiten als Satz, Wert nur als Text.
   Wer hat was geändert: Person und Bereich gehen als eq-Filter an die
     Datenbank (das gestellte db wertet sie aus), Namen der Auswahl als Text,
     leere Auswahl als Satz, CSV mit Formelschutz.
   Zugriffsrechte: Vorlagen und Übertragen sind nur Folgen von
     team_rechte_setzen — Reihenfolge (Export vor Einkauf weg, Einkauf vor
     Export dazu), erster Tipp schreibt nichts, Fehlschlag hält an und sagt,
     wie viel schon übernommen ist; Tabelle aller Personen × Rechte.
   Anleitung: „Neu im Board“ zeigt nur auf Abschnitte, die es gibt (zweite
     Quelle AN_WIKI), Merkliste übersteht ein Neuladen und verwirft
     Unbekanntes, Drucken schreibt genau diesen Abschnitt in den Rahmen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");
const QRLIB = path.join(OBEN, "auslieferung", "lib", "qrcode-generator-2.0.4.js");
const JSQR = path.join(__dirname, "werkzeug", "jsQR-1.4.0.js");
const HUB = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

const PROTOKOLL = [
  { id: 9, zeit: new Date().toISOString(), name: "Anna", tabelle: "gerichte", art: "geaendert", ziel: "Waffel", felder: ["preis"], vorher: { preis: 9 }, nachher: { preis: 10 } },
  { id: 8, zeit: new Date().toISOString(), name: "Ben", tabelle: "betriebe", art: "geaendert", ziel: null, felder: ["hub_kacheln"], vorher: {}, nachher: {} },
  { id: 7, zeit: new Date().toISOString(), name: "=HYPERLINK(\"http://x\")", tabelle: "aktionen", art: "neu", ziel: "Herbst", felder: [], vorher: {}, nachher: {} },
  { id: 6, zeit: new Date().toISOString(), name: "<img src=x onerror=window.__xss=1>", tabelle: "gerichte", art: "geloescht", ziel: "Suppe", felder: [], vorher: {}, nachher: {} },
  { id: 5, zeit: new Date().toISOString(), name: "Anna", tabelle: "team", art: "neu", ziel: "neu@example.org", felder: [], vorher: {}, nachher: {} }
];
const ALLE = ["kennzahlen_tag", "berichte_view", "berichte_export", "kosten_view", "finanz_export", "ziele_edit", "ziele_approve"];
const LISTE = () => [
  { nutzer_id: "u1", rolle: "inhaber", anzeigename: "Ich", email: "ich@example.org", ich: true, rechte: {} },
  { nutzer_id: "u2", rolle: "manager", anzeigename: "Mara", email: "mara@example.org", rechte: { kennzahlen_tag: true, kosten_view: true, finanz_export: true } },
  { nutzer_id: "u3", rolle: "manager", anzeigename: "<img src=x onerror=window.__xss=2>", email: "b@example.org", rechte: {} },
  { nutzer_id: "u4", rolle: "team", anzeigename: "Tom", email: "t@example.org", rechte: {} }
];

function stelleDb() {
  return (z) => {
    window.__abfragen = []; window.__rpc = []; window.__liste = z.liste; window.__fehlerBei = z.fehlerBei || 0;
    function kette(tab) {
      const ruf = { tab, schritte: [] };
      const p = new Proxy(function () {}, {
        get(_, k) {
          if (k === "then") return (res, rej) => {
            let d;
            if (tab === "betrieb_mitglieder") d = { data: [{ rolle: "inhaber", betriebe: { id: "b1", slug: z.slug, name: z.name, bestell_pause: false, hub_texte: {}, markenblatt: z.mb } }], error: null };
            else if (tab === "protokoll") {
              window.__abfragen.push(ruf);
              let alle = z.protokoll.slice();
              ruf.schritte.filter(s => s[0] === "eq" && s[1][0] !== "betrieb_id").forEach(s => { alle = alle.filter(r => r[s[1][0]] === s[1][1]); });
              d = { data: alle, error: null };
            } else d = { data: [], error: null };
            return Promise.resolve(d).then(res, rej);
          };
          return (...a) => { ruf.schritte.push([k, a]); return p; };
        }
      });
      return p;
    }
    const rpc = async (name, arg) => {
      if (name === "team_rechte_liste") return { data: JSON.parse(JSON.stringify(window.__liste)), error: null };
      if (name === "team_rechte_verlauf") return { data: [], error: null };
      if (name === "team_rechte_setzen") {
        window.__rpc.push([arg.p_nutzer, arg.p_recht, arg.p_an]);
        if (window.__fehlerBei && window.__rpc.length === window.__fehlerBei) return { data: { ok: false, grund: "wert" }, error: null };
        const m = window.__liste.find(x => x.nutzer_id === arg.p_nutzer);
        if (arg.p_recht === "finanz_export" && arg.p_an && !(m.rechte || {}).kosten_view) return { data: { ok: false, grund: "wert" }, error: null };
        m.rechte = Object.assign({}, m.rechte, { [arg.p_recht]: arg.p_an });
        return { data: { ok: true, eigene: m.rechte }, error: null };
      }
      return { data: null, error: null };
    };
    db = { from: kette, rpc, channel: () => kette("kanal"), removeChannel: async () => {}, storage: { from: () => kette("speicher") },
      functions: { invoke: async () => ({ data: null, error: null }) },
      auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: { id: "u1" } } }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
    demo = false;
  };
}

async function oeffnen(browser, z, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: opt.breite || 390, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(teilen => {
    window.__kopiert = null; window.__geteilt = null; window.__gedruckt = 0;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async t => { window.__kopiert = t; } } });
    Object.defineProperty(Navigator.prototype, "share", { configurable: true, value: teilen ? async d => { window.__geteilt = d; } : undefined });
    /* Druck: jeder neue Rahmen bekommt ein gezähltes print() statt des Dialogs. */
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(k => {
      if (k.id === "druckRahmen") try { k.contentWindow.print = () => { window.__gedruckt++; }; } catch (e) {}
    }))).observe(document, { childList: true, subtree: true });
  }, opt.teilen !== false);
  await ctx.route("https://omoteno.de/h/**", r => r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Hub</title>" }));
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(600);
  const scharf = await p.$("#scharfJetzt");
  if (scharf && await p.isVisible("#scharf")) { await scharf.click(); await p.waitForTimeout(150); }
  await p.evaluate(stelleDb(), Object.assign({ slug: "choco", name: "Choco L'AMouR", mb: null, protokoll: PROTOKOLL, liste: LISTE() }, z));
  await p.evaluate(async () => { document.getElementById("tor").hidden = true; await betriebWaehlen(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-tafel="einstellungen"]').click());
  await p.waitForTimeout(500);
  return { ctx, p, fehler };
}
const masse = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => {
  const r = e.getBoundingClientRect(); return { h: Math.round(r.height), fs: parseFloat(getComputedStyle(e).fontSize), t: e.textContent.trim().slice(0, 30) }; }), sel);
const ueberlauf = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const meldung = p => p.evaluate(() => (document.getElementById("meldung") || {}).textContent || "");

(async () => {
  console.log("\n══ Zweite Quellen ══");
  const html = fs.readFileSync(ADMIN, "utf8");
  const sriBoard = (html.match(/BT_QR_SRI = "([^"]+)"/) || [])[1], sriHub = (HUB.match(/QR_LIB_SRI = "([^"]+)"/) || [])[1];
  pruef(sriBoard && sriBoard === sriHub, "QR-Bibliothek im Board mit derselben Prüfsumme wie im Hub", sriBoard);
  pruef(/BT_QR_LIB = "\/lib\/qrcode-generator-2\.0\.4\.js"/.test(html) && fs.existsSync(QRLIB), "Board holt die selbst ausgelieferte Datei, und sie liegt da");

  const browser = await chromium.launch();

  console.log("\n══ Betrieb ══");
  {
    const zeiten = ["10:00 – 18:00", "Ruhetag", "11:00 – 22:00", "11:00 – 22:00", "11:00 – 22:00", "11:00 – 23:00", "<img src=x onerror=window.__xss=3>12:00"];
    const { ctx, p, fehler } = await oeffnen(browser, { slug: 'ch"o<b>co', mb: { zeiten } });
    pruef(await gruppeZu(p, "#btAdresse"), "Voraussetzung: Unterseite Betrieb offen");
    const a = await p.textContent("#btAdresse");
    pruef(a === "https://omoteno.de/h/chobco/", "Adresse aus dem Slug, nur a–z 0–9 -", a);
    const heute = await p.evaluate(z => { const d = new Date(); return { text: document.getElementById("btHeute").textContent, tag: d.getDay(), erw: z[d.getDay()] }; }, zeiten);
    pruef(heute.text.includes(heute.erw.replace(/[<>"]/g, "")) || (heute.erw === "Ruhetag" && /Ruhetag/.test(heute.text)), "Heute geöffnet = Zeile des heutigen Tages (Sonntag zuerst)", heute.text);
    const tage = await p.evaluate(() => [0, 1, 6].map(t => { const d = new Date(2026, 10, 1 + t); return btHeuteText(d); }));
    pruef(tage[0] === "Sonntag: 10:00 – 18:00", "Sonntag liest die erste Zeile", tage[0]);
    pruef(tage[1] === "Montag: Ruhetag", "Ruhetag als Ruhetag", tage[1]);
    pruef(!/[<>"]/.test(tage[2]) && await p.evaluate(() => !window.__xss), "Wert aus dem Markenblatt ohne < > \" und nie als Auszeichnung", tage[2]);
    await p.click("#btKopieren"); await p.waitForTimeout(100);
    pruef(await p.evaluate(() => window.__kopiert) === "https://omoteno.de/h/chobco/", "„Adresse kopieren“ legt genau die Adresse ab", await p.evaluate(() => window.__kopiert));
    pruef(await p.textContent("#btTeilen") === "Teilen", "mit Web Share heißt der Knopf „Teilen“");
    await p.click("#btTeilen"); await p.waitForTimeout(100);
    const g = await p.evaluate(() => window.__geteilt);
    pruef(g && g.url === "https://omoteno.de/h/chobco/" && g.title === "Choco L'AMouR", "Teilen schickt Name und Adresse", JSON.stringify(g));
    await p.addScriptTag({ path: QRLIB });
    await p.addScriptTag({ path: JSQR });
    await p.click("#btQr"); await p.waitForTimeout(700);
    const druck = await p.evaluate(async () => {
      const r = document.getElementById("druckRahmen"); if (!r) return { fehler: "kein Rahmen" };
      const d = r.contentDocument, svg = d.querySelector("svg");
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      const img = new Image(); img.src = url; await img.decode();
      const c = document.createElement("canvas"); c.width = c.height = 480;
      const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, 480, 480);
      const code = jsQR(g.getImageData(0, 0, 480, 480).data, 480, 480);
      return { h1: d.querySelector("h1").textContent, url: d.querySelector(".url").textContent, qr: code ? code.data : null, gedruckt: window.__gedruckt, img: d.querySelectorAll("img").length };
    });
    pruef(druck.qr === "https://omoteno.de/h/chobco/", "QR-Code im Aushang zurückgelesen = Adresse", druck.qr);
    pruef(druck.h1 === "Choco L'AMouR" && druck.url === "https://omoteno.de/h/chobco/" && druck.img === 0, "Aushang trägt Name und Adresse als Text", JSON.stringify(druck));
    pruef(druck.gedruckt === 1, "Druck einmal ausgelöst (aus dem Rahmen, nicht window.open)", druck.gedruckt);
    const k = await masse(p, "#btKopieren, #btTeilen, #btQr");
    pruef(k.length === 3 && k.every(x => x.h >= 44), "drei Knöpfe ≥ 44 px", JSON.stringify(k));
    pruef(await ueberlauf(p) <= 0, "kein seitlicher Überlauf bei 390 px");
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, p } = await oeffnen(browser, { slug: "blend", mb: {} }, { teilen: false });
    await gruppeZu(p, "#btAdresse");
    pruef(await p.textContent("#btTeilen") === "Im neuen Tab öffnen", "ohne Web Share: „Im neuen Tab öffnen“", await p.textContent("#btTeilen"));
    const [neu] = await Promise.all([p.context().waitForEvent("page", { timeout: 2000 }).catch(() => null), p.click("#btTeilen")]);
    pruef(neu && /\/h\/blend\/$/.test(neu.url()), "der Tipp öffnet den Hub in einem neuen Tab", neu && neu.url());
    pruef(/Markenblatt/.test(await p.textContent("#btHeute")), "ohne Zeiten im Markenblatt ein Satz statt Leere", await p.textContent("#btHeute"));
    await ctx.close();
  }
  {
    const { ctx, p } = await oeffnen(browser, { slug: "" });
    await gruppeZu(p, "#btAdresse");
    const st = await p.evaluate(() => ["#btKopieren", "#btTeilen", "#btQr"].map(s => document.querySelector(s).disabled));
    pruef(st.every(Boolean), "ohne Slug: keine Adresse, alle drei Knöpfe gesperrt", JSON.stringify(st));
    await ctx.close();
  }

  console.log("\n══ Wer hat was geändert ══");
  {
    const { ctx, p, fehler } = await oeffnen(browser, {});
    pruef(await gruppeZu(p, "#aeListe"), "Voraussetzung: Unterseite offen");
    await p.waitForTimeout(200);
    const namen = await p.evaluate(() => [...document.querySelectorAll("#aePerson option")].map(o => o.textContent));
    pruef(namen.length === 5 && namen[0] === "Alle Personen" && namen.includes("Anna") && namen.includes("<img src=x onerror=window.__xss=1>"),
      "Personen aus den Zeilen, einmal je Name, als Text", JSON.stringify(namen));
    pruef(await p.evaluate(() => !window.__xss && !document.querySelector("#aePerson img, #aeListe img")), "kein Name wird zur Auszeichnung");
    await p.selectOption("#aePerson", "Anna"); await p.waitForTimeout(250);
    const q1 = await p.evaluate(() => { const r = window.__abfragen[window.__abfragen.length - 1]; return r.schritte.filter(s => s[0] === "eq").map(s => s[1].join("=")); });
    const z1 = await p.evaluate(() => [...document.querySelectorAll("#aeListe .ae-wer")].map(x => x.textContent));
    pruef(q1.includes("name=Anna") && q1.includes("betrieb_id=b1"), "Person geht als eq-Filter an die Datenbank", q1.join(" "));
    pruef(z1.length === 2 && z1.every(x => x === "Anna"), "Liste zeigt nur diese Person", JSON.stringify(z1));
    pruef(await p.evaluate(() => document.getElementById("aePerson").options.length) === 5, "die Auswahl verliert die anderen Namen nicht");
    await p.selectOption("#aeBereich", "team"); await p.waitForTimeout(250);
    const q2 = await p.evaluate(() => window.__abfragen[window.__abfragen.length - 1].schritte.filter(s => s[0] === "eq").map(s => s[1].join("=")));
    const z2 = await p.evaluate(() => [...document.querySelectorAll("#aeListe .ae-was")].map(x => x.textContent));
    pruef(q2.includes("tabelle=team") && q2.includes("name=Anna") && z2.length === 1 && /ins Team ein/.test(z2[0]), "Bereich und Person zusammen", q2.join(" ") + " · " + z2.join("|"));
    await p.selectOption("#aeBereich", "rabattcodes"); await p.waitForTimeout(250);
    pruef(/Für diese Auswahl/.test(await p.textContent("#aeListe")), "nichts gefunden → Satz", (await p.textContent("#aeListe")).trim());
    await p.selectOption("#aePerson", ""); await p.selectOption("#aeBereich", ""); await p.waitForTimeout(250);
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#aeCsv")]);
    const csv = fs.readFileSync(await dl.path(), "utf8");
    const zeilen = csv.replace(/^\ufeff/, "").trim().split(/\r\n/);
    pruef(zeilen[0] === "Datum;Uhrzeit;Person;Bereich;Änderung" && zeilen.length === 1 + PROTOKOLL.length, "CSV: Kopf und eine Zeile je gezeigter Änderung", zeilen.length);
    pruef(/^'=HYPERLINK/.test((zeilen.find(z => /HYPERLINK/.test(z)) || "").split(";")[2].replace(/^"/, "")), "CSV: Formel als Text (Apostroph davor)", zeilen.find(z => /HYPERLINK/.test(z)));
    pruef(/^\d{1,2}\.\d{1,2}\.\d{4};\d\d:\d\d;Anna;Karte;Preis von „Waffel“/.test(zeilen[1]), "CSV: Datum, Uhrzeit, Person, Bereich als Wort, Satz", zeilen[1]);
    pruef(/ae-was|omoteno-aenderungen-\d{4}-\d\d-\d\d\.csv/.test(dl.suggestedFilename()), "Dateiname mit Datum", dl.suggestedFilename());
    const s = await masse(p, "#aePerson, #aeBereich");
    pruef(s.length === 2 && s.every(x => x.h >= 44 && x.fs >= 16), "Auswahlfelder ≥ 44 px und 16 px", JSON.stringify(s));
    pruef(await ueberlauf(p) <= 0, "kein seitlicher Überlauf");
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  console.log("\n══ Zugriffsrechte ══");
  {
    const { ctx, p, fehler } = await oeffnen(browser, {});
    pruef(await gruppeZu(p, "#zrListe"), "Voraussetzung: Unterseite offen");
    await p.waitForTimeout(300);
    const vor = await p.evaluate(() => [...document.querySelectorAll('[data-zr-person="u2"] [data-zr-vorlage]')].map(b => b.dataset.zrVorlage + ":" + b.getAttribute("aria-pressed")));
    pruef(vor.length === 4 && vor.includes("einkauf:true") && vor.filter(x => x.endsWith(":true")).length === 1, "Vorlagen je Manager, die passende ist markiert", vor.join(" "));
    pruef(await p.evaluate(() => document.querySelectorAll('[data-zr-person="u1"] [data-zr-vorlage], [data-zr-person="u4"] [data-zr-vorlage]').length) === 0, "Besitzer und Team haben keine Vorlagen");
    const sel = '[data-zr-person="u3"] [data-zr-vorlage="schicht"]';
    await p.click(sel); await p.waitForTimeout(200);
    pruef(await p.evaluate(() => window.__rpc.length) === 0 && /Noch einmal tippen/.test(await meldung(p)), "erster Tipp schreibt nichts und fragt nach", await meldung(p));
    await p.click(sel); await p.waitForTimeout(500);
    const r1 = await p.evaluate(() => window.__rpc.map(x => x.join(":")));
    pruef(JSON.stringify(r1) === JSON.stringify(["u3:kennzahlen_tag:true", "u3:berichte_view:true", "u3:ziele_edit:true", "u3:ziele_approve:true"]),
      "zweiter Tipp: genau die fehlenden Rechte, je ein Aufruf", r1.join(" "));
    pruef(await p.evaluate(() => document.querySelector('[data-zr-person="u3"] [data-zr-vorlage="schicht"]').getAttribute("aria-pressed")) === "true",
      "nach dem Neuladen ist „Schichtleitung“ markiert");
    await p.evaluate(() => { window.__rpc = []; });
    const t = '[data-zr-person="u2"] [data-zr-vorlage="tag"]';
    await p.click(t); await p.waitForTimeout(100); await p.click(t); await p.waitForTimeout(500);
    const r2 = await p.evaluate(() => window.__rpc.map(x => x.join(":")));
    pruef(JSON.stringify(r2) === JSON.stringify(["u2:finanz_export:false", "u2:kosten_view:false"]), "wegnehmen: Export vor Einkauf", r2.join(" "));
    await p.evaluate(() => { window.__rpc = []; });
    const e = '[data-zr-person="u3"] [data-zr-vorlage="einkauf"]';
    await p.click(e); await p.waitForTimeout(100); await p.click(e); await p.waitForTimeout(500);
    const r3 = await p.evaluate(() => window.__rpc.map(x => x.join(":")));
    const ki = r3.indexOf("u3:kosten_view:true"), fi = r3.indexOf("u3:finanz_export:true");
    pruef(ki >= 0 && fi > ki && r3.includes("u3:berichte_view:false"), "dazugeben: Einkauf vor Export (sonst lehnt der Server ab)", r3.join(" "));
    pruef(/übernommen/.test(await meldung(p)), "Erfolg als Satz mit Zahl", await meldung(p));
    /* Übertragen: u3 (jetzt Einkauf) → u2 (jetzt Tageszahlen) */
    await p.evaluate(() => { window.__rpc = []; });
    pruef(await p.isVisible("#zrUebertragen"), "Übertragen ab zwei Managern sichtbar");
    await p.selectOption("#zrVon", "u3"); await p.selectOption("#zrAuf", "u2");
    await p.click("#zrUebertragen"); await p.waitForTimeout(100);
    pruef(await p.evaluate(() => window.__rpc.length) === 0, "Übertragen: erster Tipp schreibt nichts");
    await p.click("#zrUebertragen"); await p.waitForTimeout(500);
    const gleich = await p.evaluate(() => { const l = window.__liste; const a = l.find(x => x.nutzer_id === "u3").rechte, b = l.find(x => x.nutzer_id === "u2").rechte;
      return ["kennzahlen_tag", "berichte_view", "berichte_export", "kosten_view", "finanz_export", "ziele_edit", "ziele_approve"].every(r => (a[r] === true) === (b[r] === true)); });
    pruef(gleich && await p.evaluate(() => window.__rpc.every(x => x[0] === "u2")), "danach hat der Empfänger genau die Rechte der Quelle, die Quelle bleibt", gleich);
    /* Tabelle */
    await p.click("#zrMatrixHuelle summary"); await p.waitForTimeout(150);
    const m = await p.evaluate(() => {
      const t = document.querySelector("#zrMatrix table"); if (!t) return null;
      const kopf = [...t.querySelectorAll("thead th")].map(x => x.textContent);
      const reihen = [...t.querySelectorAll("tbody tr")].map(r => [...r.querySelectorAll("td")].map(c => c.classList.contains("zr-ja") ? 1 : 0));
      return { kopf, reihen, img: t.querySelectorAll("img").length };
    });
    pruef(m && m.reihen.length === 7 && m.kopf.length === 5, "Tabelle: sieben Rechte × vier Personen", m && m.kopf.join(" | "));
    pruef(m && m.reihen.every(r => r[0] === 1 && r[3] === 0), "Besitzer überall ja, Team überall nein", m && JSON.stringify(m.reihen));
    const u3 = await p.evaluate(() => window.__liste.find(x => x.nutzer_id === "u3").rechte);
    const erw = ALLE.map(r => u3[r] === true ? 1 : 0);
    pruef(m && JSON.stringify(m.reihen.map(r => r[2])) === JSON.stringify(erw), "Spalte des Managers = seine Rechte", m && JSON.stringify(m.reihen.map(r => r[2])));
    pruef(m && m.img === 0 && await p.evaluate(() => !window.__xss), "Namen in Kopf und Liste als Text", m && m.kopf[2]);
    pruef(await ueberlauf(p) <= 0, "Tabelle rollt in ihrer Hülle, die Seite läuft nicht über", await p.evaluate(() => { const w = document.documentElement.clientWidth;
      return [...document.querySelectorAll("#t-einstellungen *")].filter(e => e.getBoundingClientRect().right > w + 1).slice(0, 4).map(e => e.tagName + "." + e.className + " " + Math.round(e.getBoundingClientRect().right)).join(" | "); }));
    const c = await masse(p, "#zrListe [data-zr-vorlage], #zrUebertragen, #zrMatrixHuelle summary, #zrVon, #zrAuf");
    pruef(c.length >= 10 && c.every(x => x.h >= 44), "Vorlagen, Übertragen, Tabelle ≥ 44 px", c.filter(x => x.h < 44).map(x => x.t + ":" + x.h).join(" ") || c.length);
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, p } = await oeffnen(browser, { fehlerBei: 2 });
    await gruppeZu(p, "#zrListe"); await p.waitForTimeout(300);
    const s = '[data-zr-person="u3"] [data-zr-vorlage="alles"]';
    await p.click(s); await p.waitForTimeout(100); await p.click(s); await p.waitForTimeout(500);
    const n2 = await p.evaluate(() => window.__rpc.length);
    pruef(n2 === 2, "Fehlschlag im zweiten Schritt: es wird angehalten", n2);
    pruef(/1 von 7/.test(await meldung(p)), "der Satz sagt, wie viel schon übernommen ist", await meldung(p));
    const erst = await p.evaluate(() => { const r = window.__rpc[0][1]; const k = document.querySelector('[data-zr-person="u3"] [data-zr-recht="' + r + '"]');
      return { r, an: !!(k && k.checked), zweit: !!document.querySelector('[data-zr-person="u3"] [data-zr-recht="' + window.__rpc[1][1] + '"]:checked') }; });
    pruef(erst.an && !erst.zweit, "die Liste zeigt danach den echten Stand (erster Schritt an, zweiter nicht)", JSON.stringify(erst));
    await ctx.close();
  }
  {
    const nur = LISTE().filter(x => x.nutzer_id !== "u3");
    const { ctx, p } = await oeffnen(browser, { liste: nur });
    await gruppeZu(p, "#zrListe"); await p.waitForTimeout(300);
    pruef(/ab zwei Managern/.test(await p.textContent("#zrKopie")) && !(await p.$("#zrUebertragen")), "ein Manager: Satz statt Übertragen", (await p.textContent("#zrKopie")).trim());
    await ctx.close();
  }

  console.log("\n══ Anleitung ══");
  {
    const { ctx, p, fehler } = await oeffnen(browser, {});
    pruef(await gruppeZu(p, "#anListe"), "Voraussetzung: Unterseite offen");
    const neu = await p.evaluate(() => ({ ids: AN_NEU.map(x => x.id), wiki: AN_WIKI.map(x => x.id), zeilen: document.querySelectorAll("#anNeu [data-an-neu]").length }));
    pruef(neu.ids.length >= 3 && neu.ids.every(i => neu.wiki.includes(i)) && neu.zeilen === neu.ids.length, "„Neu im Board“: jede Zeile zeigt auf einen Abschnitt, den es gibt", neu.ids.join(","));
    await p.click('#anNeu [data-an-neu="e-protokoll"]'); await p.waitForTimeout(200);
    const z = await p.evaluate(() => { const d = document.getElementById("an-e-protokoll"); const r = d.getBoundingClientRect();
      return { offen: d.open, imBild: r.top >= 0 && r.top < innerHeight, fokus: document.activeElement === d.querySelector("summary") }; });
    pruef(z.offen && z.imBild && z.fokus, "Tipp auf eine Neuigkeit öffnet den Abschnitt, rollt hin und fokussiert", JSON.stringify(z));
    await p.click('[data-an-merk="e-protokoll"]'); await p.waitForTimeout(150);
    const m1 = await p.evaluate(() => ({ speicher: localStorage.getItem("omoteno-an-merk"), chip: (document.querySelector('[data-an-kap="_merk"]') || {}).textContent || "",
      knopf: document.querySelector('[data-an-merk="e-protokoll"]').getAttribute("aria-pressed"), fokus: document.activeElement && document.activeElement.dataset.anMerk }));
    pruef(m1.speicher === '["e-protokoll"]' && /Gemerkt · 1/.test(m1.chip) && m1.knopf === "true" && m1.fokus === "e-protokoll", "Merken: im Gerät, Chip mit Zahl, Knopf gedrückt, Fokus bleibt", JSON.stringify(m1));
    await p.click('[data-an-kap="_merk"]'); await p.waitForTimeout(150);
    const nur = await p.evaluate(() => [...document.querySelectorAll("#anListe [data-an-id]")].map(d => d.dataset.anId));
    pruef(JSON.stringify(nur) === '["e-protokoll"]', "Chip „Gemerkt“ zeigt nur Gemerktes", nur.join(","));
    await p.click('[data-an-druck="e-protokoll"]'); await p.waitForTimeout(600);
    const d = await p.evaluate(() => { const r = document.getElementById("druckRahmen"); const x = r && r.contentDocument;
      const e = AN_WIKI.find(w => w.id === "e-protokoll");
      return x ? { h1: x.querySelector("h1").textContent, p: [...x.querySelectorAll("p")].map(y => y.textContent), soll: e.text, titel: e.titel, gedruckt: window.__gedruckt } : null; });
    pruef(d && d.h1 === d.titel && JSON.stringify(d.p) === JSON.stringify(d.soll), "Drucken schreibt genau diesen Abschnitt in den Rahmen", d && d.h1);
    pruef(d && d.gedruckt === 1, "Druck einmal ausgelöst", d && d.gedruckt);
    await p.reload(); await p.waitForTimeout(600);
    await p.evaluate(stelleDb(), { slug: "choco", name: "Choco", mb: null, protokoll: PROTOKOLL, liste: LISTE() });
    await p.evaluate(async () => { document.getElementById("tor").hidden = true; await betriebWaehlen(); });
    await p.evaluate(() => document.querySelector('[data-tafel="einstellungen"]').click()); await p.waitForTimeout(300);
    await gruppeZu(p, "#anListe");
    pruef(/Gemerkt · 1/.test(await p.evaluate(() => (document.querySelector('[data-an-kap="_merk"]') || {}).textContent || "")), "Merkliste übersteht ein Neuladen");
    await p.evaluate(() => { localStorage.setItem("omoteno-an-merk", '["gibtsnicht","e-melden",5,"e-melden","__proto__"]'); anZeichnen(); });
    pruef(await p.evaluate(() => JSON.stringify(anMerkLesen())) === '["e-melden"]', "Unbekanntes und Doppeltes fällt weg", await p.evaluate(() => JSON.stringify(anMerkLesen())));
    await p.evaluate(() => { localStorage.setItem("omoteno-an-merk", "{kaputt"); anZeichnen(); });
    pruef(await p.evaluate(() => !document.querySelector('[data-an-kap="_merk"]')), "kaputter Speicher: kein Chip, kein Fehler");
    await p.evaluate(() => { localStorage.setItem("omoteno-an-merk", '["e-melden"]'); anZustand.kapitel = "_merk"; anZustand.offen.add("e-melden"); anZeichnen(); });
    await p.click('[data-an-merk="e-melden"]'); await p.waitForTimeout(150);
    const leer = await p.evaluate(() => ({ chip: !!document.querySelector('[data-an-kap="_merk"]'), kap: anZustand.kapitel, n: document.querySelectorAll("#anListe [data-an-id]").length }));
    pruef(!leer.chip && leer.kap === "" && leer.n === leer.n && leer.n > 10, "letztes Gemerktes weg: Chip weg, zurück auf „Alle“", JSON.stringify(leer));
    const k = await masse(p, "#anNeu [data-an-neu], #anListe [data-an-merk], #anListe [data-an-druck]");
    pruef(k.length > 3 && k.every(x => x.h >= 44), "Neuigkeiten, Merken, Drucken ≥ 44 px", k.filter(x => x.h < 44).map(x => x.t + ":" + x.h).join(" ") || k.length);
    pruef(await ueberlauf(p) <= 0, "kein seitlicher Überlauf");
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  console.log("\n══ 360 px und 1280 px ══");
  for (const breite of [360, 1280]) {
    const { ctx, p } = await oeffnen(browser, { mb: { zeiten: ["a", "b", "c", "d", "e", "f", "g"] } }, { breite });
    for (const s of ["#btAdresse", "#aeListe", "#zrListe", "#anListe"]) {
      await gruppeZu(p, s); await p.waitForTimeout(150);
      pruef(await ueberlauf(p) <= 0, breite + " px: " + s + " ohne seitlichen Überlauf");
    }
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
