/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · „Wer hat was geändert“ (migration-protokoll.sql)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-protokoll.js

   Die Zeilen schreibt die Datenbank (Trigger, gemessen in der
   zurückgedrehten Probe der Migration). Hier geprüft: Was das Board
   daraus macht, und ob die beiden Hälften zueinander passen.

   ZWEITE QUELLEN (§8.1b):
     · datenbank/stand-spalten-protokoll.json — jede Spalte der fünf
       beobachteten Tabellen braucht im Board ein Wort (AE_FELD) oder
       steht in v_ruhig der Migration. Sonst stünde im Verlauf
       „änderte ziel_gericht_name“.
     · supabase/functions/team-zugang — jede gelungene Aktion (einladen,
       ändern, entfernen) trägt sich ein; jedes Feld, das sie ändern
       kann, hat ein Wort.

   Das Board liest mit einem gestellten `db`, das die Zeilen liefert und
   jede Kette mitschreibt — gemessen wird die Abfrage, die hinausgeht
   (Sortierung bis auf id, §2.6; Seiten zu 50), und der Text, der auf
   dem Schirm steht. Jeder Wert ist Text, nie Auszeichnung (§2.3a).
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
const STAND = JSON.parse(fs.readFileSync(path.join(OBEN, "datenbank", "stand-spalten-protokoll.json"), "utf8"));
const MIG = fs.readFileSync(path.join(OBEN, "datenbank", "migration-protokoll.sql"), "utf8");
const EDGE = fs.readFileSync(path.join(OBEN, "supabase", "functions", "team-zugang", "index.ts"), "utf8");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

const JETZT = new Date().toISOString();
const ZEILEN = [
  { id: 9, zeit: JETZT, name: "Mara", tabelle: "gerichte", art: "geaendert", ziel: "Bounty Waffel",
    felder: ["preis"], vorher: { preis: 10.4 }, nachher: { preis: 11.4 } },
  { id: 8, zeit: JETZT, name: "Mara", tabelle: "gerichte", art: "geaendert", ziel: "Bounty Waffel",
    felder: ["verfuegbar"], vorher: { verfuegbar: true }, nachher: { verfuegbar: false } },
  { id: 7, zeit: JETZT, name: "wirt@example.org", tabelle: "betriebe", art: "geaendert", ziel: "Choco",
    felder: ["bestell_pause"], vorher: { bestell_pause: false }, nachher: { bestell_pause: true } },
  { id: 6, zeit: JETZT, name: "wirt@example.org", tabelle: "team", art: "neu", ziel: "neu@example.org",
    felder: ["rolle"], vorher: null, nachher: { rolle: "team" } },
  { id: 5, zeit: "2026-10-01T10:00:00Z", name: "wirt@example.org", tabelle: "gerichte", art: "geloescht",
    ziel: "Alte Suppe", felder: [], vorher: null, nachher: null },
  { id: 4, zeit: "2026-10-01T09:00:00Z", name: "wirt@example.org", tabelle: "betriebe", art: "geaendert",
    ziel: "Choco", felder: ["hub_kacheln", "hub_texte"], vorher: null, nachher: null },
  { id: 3, zeit: "2026-10-01T08:00:00Z", name: "<img src=x onerror=window.__xss=1>", tabelle: "rabattcodes",
    art: "neu", ziel: "<b>SOMMER</b>", felder: [], vorher: null, nachher: null }
];

function stelleDb() {
  return (z) => {
    window.__abfragen = [];
    const ZEILEN = z.zeilen, VIELE = z.viele, FEHLER = z.fehler;
    function kette(tab) {
      const ruf = { tab, schritte: [] };
      const p = new Proxy(function () {}, {
        get(_, k) {
          if (k === "then") return (res, rej) => {
            if (tab === "protokoll") window.__abfragen.push(ruf);
            let d;
            if (tab === "betrieb_mitglieder") d = { data: [{ rolle: z.rolle, betriebe: { id: "b1", slug: "choco", name: "Choco", bestell_pause: false, hub_texte: {} } }], error: null };
            else if (tab === "protokoll") {
              if (FEHLER) d = { data: null, error: { code: FEHLER, message: "relation does not exist" } };
              else {
                const r = ruf.schritte.find(s => s[0] === "range");
                const von = r ? r[1][0] : 0;
                const alle = VIELE ? Array.from({ length: 60 }, (_, i) => Object.assign({}, ZEILEN[0], { id: 1000 - i })) : ZEILEN;
                d = { data: alle.slice(von, r ? r[1][1] + 1 : undefined), error: null };
              }
            } else d = { data: [], error: null };
            return Promise.resolve(d).then(res, rej);
          };
          return (...a) => { ruf.schritte.push([k, a]); return p; };
        }
      });
      return p;
    }
    db = { from: kette, rpc: async () => ({ data: null, error: null }), channel: () => kette("kanal"),
      removeChannel: async () => {}, storage: { from: () => kette("speicher") },
      functions: { invoke: async () => ({ data: null, error: null }) },
      auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: { id: "u1" } } }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
    demo = false;
  };
}

async function oeffnen(browser, z) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(600);
  const scharf = await p.$("#scharfJetzt");
  if (scharf && await p.isVisible("#scharf")) { await scharf.click(); await p.waitForTimeout(150); }
  await p.evaluate(stelleDb(), z);
  await p.evaluate(async () => { document.getElementById("tor").hidden = true; await betriebWaehlen(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-tafel="einstellungen"]').click());
  await p.waitForTimeout(500);
  await euZu(p, "#aeListe");
  return { ctx, p, fehler };
}
const zeilenText = p => p.evaluate(() => [...document.querySelectorAll("#aeListe .ae-zeile")].map(r => ({
  wer: r.querySelector(".ae-wer").textContent, wann: r.querySelector(".ae-wann").textContent, was: r.querySelector(".ae-was").textContent })));

(async () => {
  console.log("\n══ Zweite Quellen ══");
  const html = fs.readFileSync(ADMIN, "utf8");
  const feldTeil = html.match(/const AE_FELD = \{([\s\S]*?)\n\};/);
  const woerter = feldTeil ? [...feldTeil[1].matchAll(/([a-z_]+):"/g)].map(m => m[1]) : [];
  const ruhig = ((MIG.match(/v_ruhig\s+text\[\] := array\[([\s\S]*?)\]/) || [])[1] || "").match(/'([a-z_]+)'/g) || [];
  const ruhigListe = ruhig.map(s => s.replace(/'/g, ""));
  pruef(woerter.length > 30 && ruhigListe.length >= 5, "Wörter aus dem Board und Mitläufer aus der Migration gelesen", woerter.length + " / " + ruhigListe.join(","));
  for (const tab of ["betriebe", "gerichte", "aktionen", "gutscheine", "rabattcodes"]) {
    const ohne = STAND[tab].filter(s => !["id", "betrieb_id"].includes(s) && !woerter.includes(s) && !ruhigListe.includes(s));
    pruef(ohne.length === 0, tab + ": jede Spalte hat ein Wort oder läuft nur mit", ohne.join(", ") || "alle " + STAND[tab].length);
  }
  const merken = (EDGE.match(/await merke\("(neu|geaendert|geloescht)"/g) || []).map(s => s.match(/"(\w+)"/)[1]);
  pruef(["neu", "geaendert", "geloescht"].every(a => merken.includes(a)), "team-zugang trägt Einladen, Ändern und Entfernen ein", merken.join(","));
  const satzFelder = [...EDGE.matchAll(/satz\.([a-z_]+) =/g)].map(m => m[1]);
  const ohneWort = [...new Set(satzFelder)].filter(s => !woerter.includes(s));
  pruef(satzFelder.length >= 5 && ohneWort.length === 0, "jedes Feld, das team-zugang ändert, hat ein Wort", ohneWort.join(", ") || satzFelder.join(","));
  pruef(/nutzer_id: ich/.test(EDGE) && !/nutzer_id: a\./.test(EDGE), "Protokoll-Name kommt vom geprüften Aufrufer, nicht aus der Anfrage");

  const browser = await chromium.launch();

  console.log("\n══ Board als Inhaber ══");
  {
    const { ctx, p, fehler } = await oeffnen(browser, { rolle: "inhaber", zeilen: ZEILEN });
    const z = await zeilenText(p);
    pruef(z.length === ZEILEN.length, "Voraussetzung: jede Zeile gezeichnet", z.length);
    const was = z.map(x => x.was);
    pruef(was[0] === "Preis von „Bounty Waffel“: 10,40 € → 11,40 €", "Preis mit Euro und Pfeil", was[0]);
    pruef(was[1] === "„Bounty Waffel“ auf ausverkauft gesetzt", "Ausverkauft als Satz", was[1]);
    pruef(was[2] === "pausierte die Bestellungen", "Bestellpause als Satz", was[2]);
    pruef(was[3] === "lud „neu@example.org“ ins Team ein", "Einladung als Satz", was[3]);
    pruef(was[4] === "löschte das Gericht „Alte Suppe“", "Löschen als Satz", was[4]);
    pruef(was[5] === "änderte Kacheln, Texte im Hub", "mehrere Felder mit Wörtern statt Spaltennamen", was[5]);
    pruef(/^heute \d\d:\d\d$/.test(z[0].wann) && /^01\.10\. \d\d:\d\d$/.test(z[4].wann), "heute mit Uhrzeit, sonst Datum", z[0].wann + " / " + z[4].wann);
    const x = await p.evaluate(() => ({ img: document.querySelectorAll("#aeListe img, #aeListe b").length, xss: window.__xss === 1,
      text: document.querySelectorAll("#aeListe .ae-zeile")[6].textContent }));
    pruef(x.img === 0 && !x.xss && /<img src=x/.test(x.text), "Name und Ziel als Text, nie als Auszeichnung", JSON.stringify(x));
    const abf = await p.evaluate(() => window.__abfragen[0].schritte.map(s => s[0] + (s[0] === "order" ? ":" + s[1][0] + ":" + s[1][1].ascending : "") + (s[0] === "eq" ? ":" + s[1][0] : "")));
    pruef(abf.includes("eq:betrieb_id") && abf.indexOf("order:zeit:false") >= 0 && abf.indexOf("order:id:false") > abf.indexOf("order:zeit:false"),
      "Abfrage: nur dieser Betrieb, neueste zuerst, bei Gleichstand nach id (§2.6)", abf.join(" "));
    const karte = await p.evaluate(() => { const b = EU_BEREICHE.find(x => x.titel === "Wer hat was geändert"); return b ? b.stand() : null; });
    pruef(karte === "4 Änderungen heute", "Kachel in der Übersicht zählt die von heute", karte);
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  console.log("\n══ Viele Zeilen, fehlende Tabelle ══");
  {
    const { ctx, p } = await oeffnen(browser, { rolle: "inhaber", zeilen: ZEILEN, viele: true });
    const vor = await p.evaluate(() => ({ n: document.querySelectorAll("#aeListe .ae-zeile").length, mehr: !document.getElementById("aeMehr").hidden }));
    pruef(vor.n === 50 && vor.mehr, "erste Seite 50 Zeilen, „Ältere zeigen“ sichtbar", JSON.stringify(vor));
    await p.click("#aeMehr");
    await p.waitForTimeout(300);
    const nach = await p.evaluate(() => ({ n: document.querySelectorAll("#aeListe .ae-zeile").length, mehr: !document.getElementById("aeMehr").hidden,
      range: window.__abfragen[window.__abfragen.length - 1].schritte.find(s => s[0] === "range")[1] }));
    pruef(nach.n === 60 && !nach.mehr && nach.range[0] === 50 && nach.range[1] === 99, "zweite Seite hängt an, danach kein Knopf mehr", JSON.stringify(nach));
    await ctx.close();
  }
  {
    const { ctx, p } = await oeffnen(browser, { rolle: "inhaber", zeilen: [], fehler: "42P01" });
    const t = await p.textContent("#aeListe");
    pruef(/noch nicht eingerichtet/.test(t), "fehlende Tabelle → ein Satz, kein rohes Postgres", t.trim());
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
