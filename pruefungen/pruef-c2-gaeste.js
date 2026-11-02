/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Einstellungen „Gäste gewinnen“ — je drei neue Funktionen
   (Plan Teil C, Block C2c, 02.11.)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-c2-gaeste.js
     ADMIN_DATEI=… für Gegenbeweise auf Kopien

   Newsletter: Vorschau als Telefon (375 px) oder Desktop (≤ 640 px), gemerkt
     nur auf diesem Gerät (Unsinn → Telefon); bis zu drei Gerichte selbst
     wählen — die Vorschau nennt genau diese zuerst, dasselbe Gericht zählt
     einmal, eine gespeicherte ID eines gelöschten Gerichts lässt keine Lücke;
     „Übernehmen“ schreibt hub_stil ZUSAMMENGEFÜHRT bis in newsletter hinein
     (Variante, Gerichte, Fremdes darunter bleibt), < 2500 Byte (Schranke
     betriebe_hub_stil_form); Neuöffnen zeigt die Wahl (§8.1m); „HTML
     herunterladen“ = genau die Mail aus nlvHtml.
   Rabattcodes: alle eigenen Codes, eingeteilt Aktiv / Eingelöst /
     Abgelaufen (Zahlen stimmen), „Beenden“ nur bei aktiven, „Code kopieren“
     legt genau den Code ab, „Als Vorlage“ füllt das Formular und schreibt
     NICHTS; Name nur als Text.
   Gutscheine: dieselbe Einteilung, Vorlagen füllen Titel/Text ohne Aufruf,
     CSV genau der gezeigten Auswahl mit Formelschutz, Druck der offenen aus
     dem Rahmen, Werte nur als Text.
   Dazu 360/390/1280 px ohne Überlauf, Knöpfe ≥ 44 px, Felder 16 px,
   Schrift der Filterknöpfe ≥ 4,5:1 hell und dunkel, kein Seitenfehler.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + (typeof d === "string" ? d : JSON.stringify(d)) : ""));
}

const GERICHTE = [
  { id: "g1", name: "Apfelstrudel", preis: 6.5, verfuegbar: true, karte: "Hauptkarte", kategorie: "Süßes", reihenfolge: 0, beliebt: true },
  { id: "g2", name: "Bratkartoffeln", preis: 7, verfuegbar: true, karte: "Hauptkarte", kategorie: "Warmes", reihenfolge: 1 },
  { id: "g3", name: "Chili sin Carne", preis: 11, verfuegbar: true, karte: "Hauptkarte", kategorie: "Warmes", reihenfolge: 2 },
  { id: "g4", name: "Dinkelbrot", preis: 4, verfuegbar: true, karte: "Hauptkarte", kategorie: "Brot", reihenfolge: 3 },
  { id: "g5", name: "Erdbeer-Tiramisu", preis: 7.9, verfuegbar: true, karte: "Hauptkarte", kategorie: "Süßes", reihenfolge: 4 }
];
const tag = d => new Date(Date.now() + d * 864e5).toISOString();
const CODES = [
  { id: "r1", code: "SOMMERAB12CD34EF", betrag: null, prozent: 10, ziel_gericht_id: null, ziel_gericht_name: null, gueltig_bis: null, angelegt_am: tag(-1), angelegt_name: "<img src=x onerror=window.__xss=1>", eingeloest: false, eingeloest_am: null },
  { id: "r2", code: "GERICHTGH56JK78", betrag: 3.5, prozent: null, ziel_gericht_id: "g3", ziel_gericht_name: "Chili sin Carne", gueltig_bis: tag(10), angelegt_am: tag(-2), angelegt_name: "Anna", eingeloest: false, eingeloest_am: null },
  { id: "r3", code: "WEGLM90NP12", betrag: 2, prozent: null, ziel_gericht_id: null, ziel_gericht_name: null, gueltig_bis: null, angelegt_am: tag(-3), angelegt_name: "Ben", eingeloest: true, eingeloest_am: tag(-1) },
  { id: "r4", code: "ALTQR34ST56", betrag: null, prozent: 5, ziel_gericht_id: null, ziel_gericht_name: null, gueltig_bis: tag(-2), angelegt_am: tag(-9), angelegt_name: "Ben", eingeloest: false, eingeloest_am: null }
];
const GUTSCHEINE = [
  { id: "s1", titel: "=HYPERLINK(\"http://x\")", beschreibung: "Formel", code: "DANKEAB12CD34", gueltig_bis: null, gast_id: null, angelegt: tag(-1), angelegt_name: "Anna", eingeloest_am: null },
  { id: "s2", titel: "<img src=x onerror=window.__xss=2>Kaffee", beschreibung: null, code: "DANKEEF56GH78", gueltig_bis: tag(5), gast_id: "x", angelegt: tag(-2), angelegt_name: null, eingeloest_am: null },
  { id: "s3", titel: "Dessert", beschreibung: null, code: "DANKEJK90LM12", gueltig_bis: null, gast_id: null, angelegt: tag(-4), angelegt_name: "Ben", eingeloest_am: tag(-1) },
  { id: "s4", titel: "Alt", beschreibung: null, code: "DANKENP34QR56", gueltig_bis: tag(-1), gast_id: null, angelegt: tag(-6), angelegt_name: "Ben", eingeloest_am: null }
];

function stelleDb() {
  return (z) => {
    window.__updates = []; window.__rpc = []; window.__stil = z.stil;
    function kette(tab) {
      const ruf = { tab, schritte: [] };
      const p = new Proxy(function () {}, {
        get(_, k) {
          if (k === "then") return (res, rej) => {
            const hat = s => ruf.schritte.some(x => x[0] === s);
            let d = { data: [], error: null };
            if (tab === "betrieb_mitglieder") d = { data: [{ rolle: "inhaber", betriebe: { id: "b1", slug: "choco", name: "Choco", bestell_pause: false, hub_texte: {}, markenblatt: null, hub_stil: JSON.parse(JSON.stringify(window.__stil)) } }], error: null };
            else if (tab === "gerichte") d = { data: JSON.parse(JSON.stringify(z.gerichte)).map(g => Object.assign({ betrieb_id: "b1" }, g)), error: null };
            else if (tab === "rabattcodes") d = { data: JSON.parse(JSON.stringify(z.codes)), error: null };
            else if (tab === "gutscheine") d = { data: JSON.parse(JSON.stringify(z.gutscheine)), error: null };
            else if (tab === "betriebe" && hat("update")) {
              const u = ruf.schritte.find(x => x[0] === "update")[1][0];
              window.__updates.push(JSON.parse(JSON.stringify(u)));
              if (u.hub_stil) window.__stil = JSON.parse(JSON.stringify(u.hub_stil));
              d = { data: [{ id: "b1" }], error: null };
            } else if (tab === "betriebe" && hat("maybeSingle")) d = { data: { hub_stil: JSON.parse(JSON.stringify(window.__stil)) }, error: null };
            return Promise.resolve(d).then(res, rej);
          };
          return (...a) => { ruf.schritte.push([k, a]); return p; };
        }
      });
      return p;
    }
    const rpc = async (name, arg) => { window.__rpc.push([name, arg]); return { data: null, error: null }; };
    db = { from: kette, rpc, channel: () => kette("kanal"), removeChannel: async () => {}, storage: { from: () => kette("speicher") },
      functions: { invoke: async (name, o) => { window.__rpc.push(["invoke:" + name, o]); return { data: { ok: true, ersetzt: 2 }, error: null }; } },
      auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: { id: "u1" } } }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
    demo = false;
  };
}

async function oeffnen(browser, z, opt = {}) {
  const ctx = opt.ctx || await browser.newContext({ viewport: { width: opt.breite || 390, height: 900 }, acceptDownloads: true });
  if (!opt.ctx) await ctx.addInitScript(() => {
    window.__kopiert = null; window.__gedruckt = 0;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async t => { window.__kopiert = t; } } });
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(k => {
      if (k.id === "druckRahmen") try { k.contentWindow.print = () => { window.__gedruckt++; }; } catch (e) {}
    }))).observe(document, { childList: true, subtree: true });
  });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(600);
  if (opt.vorher) await p.evaluate(opt.vorher);
  await p.evaluate(stelleDb(), Object.assign({ stil: { emoji: false, newsletter: { variante: "edel", fremd: 1 } }, gerichte: GERICHTE, codes: CODES, gutscheine: GUTSCHEINE }, z));
  await p.evaluate(async () => { document.getElementById("tor").hidden = true; const sc = document.getElementById("scharf"); if (sc) sc.hidden = true; await betriebWaehlen(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('[data-tafel="einstellungen"]').click());
  await p.waitForTimeout(400);
  return { ctx, p, fehler };
}
const ueberlauf = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const lum = c => { const m = String(c).match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
/* Schrift und der erste deckende Grund darunter (die Eltern hinauf) */
const farbpaare = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => {
  let g = e, bg = "rgb(0, 0, 0)";
  while (g) { const c = getComputedStyle(g).backgroundColor; const a = c.match(/rgba?\(([^)]+)\)/); if (a) { const t = a[1].split(",").map(Number); if (t.length < 4 || t[3] >= 0.99) { bg = c; break; } } g = g.parentElement; }
  return { t: e.textContent.trim().slice(0, 20), fg: getComputedStyle(e).color, bg };
}), sel);

(async () => {
  const browser = await chromium.launch();

  console.log("\n══ Newsletter ══");
  {
    const { ctx, p, fehler } = await oeffnen(browser, {}, { breite: 1280 });
    pruef(await gruppeZu(p, "#nlvZeile"), "Voraussetzung: Unterseite Gäste-Newsletter offen");
    const sel = await p.evaluate(() => [...document.querySelectorAll("[data-nlv-g]")].map(s => ({ n: s.options.length, v: s.value, fs: parseFloat(getComputedStyle(s).fontSize), h: s.getBoundingClientRect().height })));
    pruef(sel.length === 3 && sel.every(s => s.n === 6 && s.v === "" && s.fs >= 16 && s.h >= 44), "drei Auswahlfelder (Automatisch + 5 Gerichte), anfangs „Automatisch“, 16 px, ≥ 44 px", sel);
    const breite = async () => p.evaluate(() => { const f = document.getElementById("nlvVorschau"); return { w: Math.round(f.getBoundingClientRect().width), t: f.classList.contains("telefon"), d: f.classList.contains("desktop"),
      ap: [...document.querySelectorAll("[data-nlv-breite]")].map(b => b.dataset.nlvBreite + ":" + b.getAttribute("aria-pressed")).join(" ") }; });
    let b = await breite();
    pruef(b.t && b.w === 375 && /telefon:true/.test(b.ap), "Vorschau anfangs als Telefon: 375 px breit", b);
    await p.click('[data-nlv-breite="desktop"]');
    b = await breite();
    pruef(b.d && b.w > 375 && b.w <= 640 && /desktop:true/.test(b.ap), "„Desktop“: breiter als 375 und höchstens 640 px, aria-pressed folgt", b);
    const hin = await p.evaluate(() => { const h = document.getElementById("nlvGHinweis"); return { an: !h.hidden, t: h.textContent }; });
    pruef(hin.an && /keine Gerichte/.test(hin.t) && /„Kampagne“/.test(hin.t), "„Edel“ zeigt keine Gerichte — der Satz sagt es und nennt die Vorlagen, die sie zeigen", hin);
    await p.click('[data-nlv="kampagne"]');
    pruef(await p.evaluate(() => document.getElementById("nlvGHinweis").hidden), "bei „Kampagne“ kein solcher Satz");
    /* Gerichte wählen: Chili und Tiramisu */
    await p.selectOption("#nlvG1", "g3");
    await p.selectOption("#nlvG2", "g5");
    await p.selectOption("#nlvG3", "g3");
    const v = await p.evaluate(() => {
      const d = new DOMParser().parseFromString(document.getElementById("nlvVorschau").srcdoc, "text/html"), text = d.body.textContent;
      const namen = ["Apfelstrudel", "Bratkartoffeln", "Chili sin Carne", "Dinkelbrot", "Erdbeer-Tiramisu"].map(x => [x, text.indexOf(x)]).filter(x => x[1] >= 0).sort((a, b) => a[1] - b[1]).map(x => x[0]);
      return { g: nlvG.slice(), namen, satz: document.getElementById("nlvSatz").textContent };
    });
    pruef(v.g.join() === "g3,g5", "dasselbe Gericht im dritten Feld zählt einmal — gewählt sind Chili und Tiramisu", v.g);
    pruef(v.namen[0] === "Chili sin Carne" && v.namen[1] === "Erdbeer-Tiramisu", "die Vorschau nennt genau diese zuerst (nicht das als Beliebt markierte Apfelstrudel)", v.namen);
    pruef(/Gerichte geändert/.test(v.satz), "der Satz sagt, dass die Gerichte noch nicht übernommen sind", v.satz);
    pruef(await p.evaluate(() => window.__updates.length) === 0, "Wählen allein schreibt nichts");
    await p.click("#nlvUebernehmen"); await p.waitForTimeout(400);
    const up = await p.evaluate(() => window.__updates[0] || null);
    pruef(up && Object.keys(up).join() === "hub_stil" && up.hub_stil.emoji === false && up.hub_stil.newsletter.variante === "kampagne" && up.hub_stil.newsletter.fremd === 1 && JSON.stringify(up.hub_stil.newsletter.gerichte) === '["g3","g5"]',
      "„Übernehmen“ führt zusammen: emoji bleibt, newsletter.fremd bleibt, Variante und Gerichte stehen darin", up);
    pruef(up && Buffer.byteLength(JSON.stringify(up.hub_stil)) < 2500, "hub_stil bleibt unter der Schranke von 2500 Byte", up && Buffer.byteLength(JSON.stringify(up.hub_stil)));
    const inv = await p.evaluate(() => (window.__rpc.find(x => x[0] === "invoke:newsletter-vorlage-setzen") || [])[1]);
    pruef(inv && /Chili sin Carne/.test(inv.body.html.gutschein) && inv.body.html.gutschein.indexOf("Chili sin Carne") < inv.body.html.gutschein.indexOf("Erdbeer-Tiramisu"), "Klaviyo bekommt die Mail mit genau diesen Gerichten", inv && Object.keys(inv.body));
    /* Download */
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#nlvHerunterladen")]);
    const inhalt = fs.readFileSync(await dl.path(), "utf8"), soll = await p.evaluate(() => nlvHtml(nlvArt, nlvWahl));
    pruef(dl.suggestedFilename() === "newsletter-choco-gutschein-kampagne.html" && inhalt === soll, "„HTML herunterladen“ = genau die Mail, Name aus Haus, Art und Vorlage", dl.suggestedFilename());
    const knoepfe = await p.evaluate(() => [...document.querySelectorAll("#nlvZeile button")].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().height)));
    pruef(knoepfe.every(h => h >= 44), "jeder Knopf im Newsletter ≥ 44 px", knoepfe);
    pruef(!fehler.length, "kein Seitenfehler", fehler);
    /* Neuöffnen: die gespeicherte Wahl und die Breite stehen da (§8.1m) */
    const stil = await p.evaluate(() => window.__stil);
    await p.close();
    const z2 = await oeffnen(browser, { stil }, { ctx });
    await gruppeZu(z2.p, "#nlvZeile");
    const nach = await z2.p.evaluate(() => ({ v: [...document.querySelectorAll("[data-nlv-g]")].map(s => s.value), d: document.getElementById("nlvVorschau").classList.contains("desktop") }));
    pruef(nach.v.join() === "g3,g5," && nach.d, "nach dem Neuöffnen: gespeicherte Gerichte gewählt, Breite „Desktop“ gemerkt", nach);
    await z2.p.close();
    /* Unsinn: gelöschtes Gericht und Fremdes in der Liste, Unsinn als Breite */
    const z3 = await oeffnen(browser, { stil: { newsletter: { variante: "klassisch", gerichte: ["g9", '"><img src=x onerror=window.__xss=9>', "g2", 7] } } }, { ctx, vorher: () => localStorage.setItem("omoteno-nlv-breite", "riesig") });
    await gruppeZu(z3.p, "#nlvZeile");
    const un = await z3.p.evaluate(() => ({ v: [...document.querySelectorAll("[data-nlv-g]")].map(s => s.value), t: document.getElementById("nlvVorschau").classList.contains("telefon"), xss: window.__xss }));
    pruef(un.v.join() === "g2,," && un.t && un.xss === undefined, "gelöschtes Gericht lässt keine Lücke, Fremdes fällt weg, unbekannte Breite → Telefon", un);
    await ctx.close();
  }

  console.log("\n══ Rabattcodes ══");
  {
    const { ctx, p, fehler } = await oeffnen(browser, {});
    pruef(await gruppeZu(p, "#rcListe"), "Voraussetzung: Unterseite Eigene Rabattcodes offen");
    const lese = () => p.evaluate(() => ({ filter: [...document.querySelectorAll("[data-rc-filter]")].map(b => b.dataset.rcFilter + ":" + b.querySelector("b").textContent + ":" + b.getAttribute("aria-pressed")),
      zeilen: [...document.querySelectorAll("#rcListe .gs-zeile")].map(z => ({ id: z.dataset.rc, ende: !!z.querySelector("[data-rc-ende]"), frist: z.querySelector(".gs-frist").textContent })) }));
    let s = await lese();
    pruef(s.filter.join(" ") === "aktiv:2:true eingeloest:1:false abgelaufen:1:false", "Filter mit Zahlen: Aktiv 2 · Eingelöst 1 · Abgelaufen 1", s.filter);
    pruef(s.zeilen.map(z => z.id).join() === "r1,r2" && s.zeilen.every(z => z.ende), "Aktiv: genau die zwei offenen, jede mit „Beenden“", s.zeilen);
    await p.click('[data-rc-filter="eingeloest"]');
    s = await lese();
    pruef(s.zeilen.length === 1 && s.zeilen[0].id === "r3" && !s.zeilen[0].ende && /^eingelöst am /.test(s.zeilen[0].frist), "Eingelöst: r3, ohne „Beenden“, mit Datum", s.zeilen);
    await p.click('[data-rc-filter="abgelaufen"]');
    s = await lese();
    pruef(s.zeilen.length === 1 && s.zeilen[0].id === "r4" && !s.zeilen[0].ende && /^abgelaufen /.test(s.zeilen[0].frist), "Abgelaufen: r4, ohne „Beenden“", s.zeilen);
    await p.click('[data-rc-filter="aktiv"]');
    pruef(await p.evaluate(() => window.__xss === undefined && /<img src=x/.test(document.getElementById("rcListe").textContent)), "Name mit <img onerror> bleibt Text");
    await p.click('[data-rc-kopie="r1"]');
    pruef(await p.evaluate(() => window.__kopiert) === "SOMMERAB12CD34EF", "„Code kopieren“ legt genau den Code ab");
    const rpcVor = await p.evaluate(() => window.__rpc.length);
    await p.click('[data-rc-vorlage="r2"]');
    const fo = await p.evaluate(__rpcVor => ({ art: rcArt, ziel: rcZielModus, wert: document.getElementById("rcWert").value, g: document.getElementById("rcGericht").value, rpc: window.__rpc.length - __rpcVor, fokus: document.activeElement && document.activeElement.id }), rpcVor);
    pruef(fo.art === "betrag" && fo.ziel === "gericht" && fo.wert === "3.5" && fo.g === "g3" && fo.fokus === "rcWert", "„Als Vorlage“: Betrag 3,50 € für Chili ins Formular, Fokus auf dem Wert", fo);
    pruef(fo.rpc === 0 && await p.evaluate(() => window.__updates.length) === 0, "„Als Vorlage“ schreibt nichts (kein Aufruf)", fo.rpc);
    const h = await p.evaluate(() => [...document.querySelectorAll("#rcGruppe button")].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().height)));
    pruef(h.every(x => x >= 44), "jeder Knopf ≥ 44 px", h);
    pruef(!fehler.length, "kein Seitenfehler", fehler);
    await ctx.close();
  }

  console.log("\n══ Gutscheine ══");
  {
    const { ctx, p, fehler } = await oeffnen(browser, {});
    pruef(await gruppeZu(p, "#gsListe"), "Voraussetzung: Unterseite Gutscheine offen");
    const lese = () => p.evaluate(() => ({ filter: [...document.querySelectorAll("[data-gs-filter]")].map(b => b.dataset.gsFilter + ":" + b.querySelector("b").textContent),
      zeilen: [...document.querySelectorAll("#gsListe .gs-zeile")].map(z => ({ id: z.dataset.gs, ende: !!z.querySelector("[data-gs-ende]") })) }));
    let s = await lese();
    pruef(s.filter.join(" ") === "offen:2 eingeloest:1 abgelaufen:1" && s.zeilen.map(z => z.id).join() === "s1,s2" && s.zeilen.every(z => z.ende), "Offen 2 · Eingelöst 1 · Abgelaufen 1; offene mit „Beenden“", s);
    await p.click('[data-gs-filter="eingeloest"]');
    s = await lese();
    pruef(s.zeilen.length === 1 && s.zeilen[0].id === "s3" && !s.zeilen[0].ende, "Eingelöst: s3 ohne „Beenden“", s.zeilen);
    /* CSV der gezeigten Auswahl */
    let [dl] = await Promise.all([p.waitForEvent("download"), p.click("#gsCsv")]);
    let csv = fs.readFileSync(await dl.path(), "utf8").replace(/^﻿/, "").trim().split(/\r\n/);
    pruef(csv.length === 2 && /Dessert/.test(csv[1]) && /eingelöst/.test(csv[1]), "CSV: Kopf + genau die gezeigte (eingelöste) Zeile", csv);
    await p.click('[data-gs-filter="offen"]');
    [dl] = await Promise.all([p.waitForEvent("download"), p.click("#gsCsv")]);
    csv = fs.readFileSync(await dl.path(), "utf8").replace(/^﻿/, "").trim().split(/\r\n/);
    const zellen = csv.slice(1).flatMap(z => z.split(";").map(x => x.replace(/^"/, "")));
    pruef(csv.length === 3 && zellen.every(x => !/^[=+\-@\t]/.test(x)) && csv.some(z => /HYPERLINK/.test(z)), "CSV der offenen: zwei Zeilen, keine Zelle beginnt mit einem Formelzeichen", csv.slice(1));
    /* Vorlage füllt nur */
    const gsVor = await p.evaluate(() => window.__rpc.length);
    await p.click('[data-gs-vorlage="1"]');
    const vf = await p.evaluate(v => ({ t: document.getElementById("gsTitel").value, x: document.getElementById("gsText").value, rpc: window.__rpc.length - v }), gsVor);
    pruef(vf.t === "Ein Dessert aufs Haus" && vf.x.length > 0 && vf.rpc === 0, "Vorlage „Dessert“ füllt Titel und Text, ohne Aufruf", vf);
    /* Druck der offenen */
    await p.click("#gsDrucken"); await p.waitForTimeout(700);
    const d = await p.evaluate(() => { const r = document.getElementById("druckRahmen"), x = r && r.contentDocument;
      return x ? { zeilen: [...x.querySelectorAll("tbody tr")].map(t => t.querySelector("td.c").textContent), img: x.querySelectorAll("img").length, text: x.body.textContent, gedruckt: window.__gedruckt, xss: window.__xss } : null; });
    pruef(d && d.zeilen.join() === "DANKEAB12CD34,DANKEEF56GH78" && d.img === 0 && /<img src=x/.test(d.text) && d.gedruckt >= 1 && d.xss === undefined, "Druck: genau die offenen, Titel nur als Text, print() gerufen", d);
    const h = await p.evaluate(() => [...document.querySelectorAll("#gsGruppe button")].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().height)));
    pruef(h.every(x => x >= 44), "jeder Knopf ≥ 44 px", h);
    pruef(!fehler.length, "kein Seitenfehler", fehler);
    await ctx.close();
  }

  console.log("\n══ Breiten, Kontrast ══");
  for (const breite of [360, 390, 1280]) {
    for (const hell of [false, true]) {
      const { ctx, p, fehler } = await oeffnen(browser, {}, { breite });
      if (hell) await p.evaluate(() => { document.body.classList.add("hell"); });
      for (const [sel, name] of [["#nlvZeile", "Newsletter"], ["#rcListe", "Rabattcodes"], ["#gsListe", "Gutscheine"]]) {
        await gruppeZu(p, sel); await p.waitForTimeout(100);
        const u = await ueberlauf(p);
        const paare = (await farbpaare(p, ".gs-fknopf, .nlv-artknopf")).map(x => ({ t: x.t, k: +kontrast(x.fg, x.bg).toFixed(2) }));
        const schlecht = paare.filter(x => x.k < 4.5);
        pruef(u <= 0 && paare.length > 0 && !schlecht.length, name + " bei " + breite + " px " + (hell ? "hell" : "dunkel") + ": kein Überlauf, Knopfschrift ≥ 4,5:1 (" + paare.length + " Knöpfe)", schlecht.length ? schlecht : u);
      }
      pruef(!fehler.length, breite + " px " + (hell ? "hell" : "dunkel") + ": kein Seitenfehler", fehler);
      await ctx.close();
    }
  }

  await browser.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
