/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Einkauf & Kosten (seiten/einkauf.html, Stufe E1)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-einkauf.js

   Die Datenbankhälfte prüft datenbank/pruef-einkauf.sql (zurückgedreht,
   live). Hier zählt die Seite und die NAHT zur Datenbank:
     · Zweite Quelle migration-einkauf.sql: Jeder Grund, den eine
       Funktion zurückgeben kann, hat einen Satz; die gesendeten
       Parameter sind genau die der Funktion; jeder Schlüssel in
       p_daten und in einer Position wird dort auch gelesen
       (Ausnahme namentlich: gebinde_text, nur zum Wiederanzeigen).
     · Der echte Weg über Tippen und Tippen: 12 × 0,75 l für 54 €
       zeigt 9 l und 6,00 €/l, schickt gebinde_basis 750.
     · „7,5“ geht als 7,5 hinaus, leer als null, Unlesbares nie.
     · Freigegeben = nur ansehen; Storno erst beim zweiten Tipp.
     · Team sieht einen Satz statt Bedienung.
     · PIN vor den Daten; Kontrast, 44 px, kein Überlauf.

   EHRLICHE GRENZE: Die Datenbank ist gestellt. Ob die Funktionen live
   so antworten, belegt pruef-einkauf.sql, nicht diese Datei.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OBEN = path.join(__dirname, "..");
const SEITE = "file://" + path.join(OBEN, "seiten", "einkauf.html");
const SQL = fs.readFileSync(path.join(OBEN, "datenbank", "migration-einkauf.sql"), "utf8");
const SQL2 = fs.readFileSync(path.join(OBEN, "datenbank", "migration-einkauf-e2.sql"), "utf8");
const EDGE = fs.readFileSync(path.join(OBEN, "supabase", "functions", "beleg-lesen", "index.ts"), "utf8");
const HTML = fs.readFileSync(path.join(OBEN, "seiten", "einkauf.html"), "utf8");

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

/* ── 1 · Naht als Quelltext ─────────────────────────────────────── */
console.log("\n══ 1 · Naht zur Migration ══");
const gruendeSql = [...new Set([...(SQL + SQL2).matchAll(/'grund',\s*'(\w+)'/g)].map(m => m[1]))];
/* Dritte Quelle: jeder Grund, den beleg-lesen zurückgeben kann —
   nein("…") und die Rückgaben von grundAus(). */
const gruendeEdge = [...new Set([...EDGE.matchAll(/nein\("(\w+)"/g), ...EDGE.matchAll(/return "(\w+)";/g)].map(m => m[1]))];
const gruendeSeite = (() => {
  const blk = HTML.match(/const GRUENDE = \{([\s\S]*?)\n\};/);
  return blk ? [...blk[1].matchAll(/^\s*(\w+):/gm)].map(m => m[1]) : [];
})();
pruef(gruendeSql.length >= 10, "Gründe aus der Migration gelesen", gruendeSql.length + " Gründe");
const ohneSatz = gruendeSql.filter(g => !gruendeSeite.includes(g));
pruef(!ohneSatz.length, "jeder Grund der Funktionen hat einen Satz auf der Seite", ohneSatz.join(", ") || "alle");
pruef(gruendeEdge.length >= 12, "Gründe aus beleg-lesen gelesen", gruendeEdge.join(", "));
const ohneSatzEdge = gruendeEdge.filter(g => !gruendeSeite.includes(g));
pruef(!ohneSatzEdge.length, "jeder Grund von beleg-lesen hat einen Satz auf der Seite", ohneSatzEdge.join(", ") || "alle");

function sqlParameter(fn){
  const m = SQL.match(new RegExp("function public\\." + fn + "\\(([^)]*)\\)"));
  return m ? m[1].split(",").map(s => s.trim().split(/\s+/)[0]).filter(Boolean).sort() : null;
}
const SIGNATUR = {};
for(const fn of ["beleg_speichern", "beleg_freigeben", "beleg_stornieren", "beleg_verwerfen"]) SIGNATUR[fn] = sqlParameter(fn);
function sqlParameter2(fn){
  const m = SQL2.match(new RegExp("function public\\." + fn + "\\(([^)]*)\\)"));
  return m ? m[1].split(",").map(s => s.trim().split(/\s+/)[0]).filter(Boolean).sort() : null;
}
for(const fn of ["inventur_buchen", "verlust_buchen"]) SIGNATUR[fn] = sqlParameter2(fn);
/* Der Pfad, den die Seite baut, muss durch die Prüfung der Funktion
   (zweite Quelle: die Regel in beleg-lesen) UND durch die Speicherregel. */
const PFAD_EDGE = (() => { const m = EDGE.match(/new RegExp\("\^" \+ betrieb \+ "\/" \+ UUID \+ "([^"]+)"\)/); return m ? JSON.parse('"' + m[1] + '"') : null; })();
pruef(!!PFAD_EDGE, "Pfadregel aus beleg-lesen gelesen", PFAD_EDGE);
pruef(Object.values(SIGNATUR).every(Boolean), "Signaturen aus der Migration gelesen", JSON.stringify(SIGNATUR));
const datenGelesen = new Set([...SQL.matchAll(/p_daten\s*->>?\s*'(\w+)'/g)].map(m => m[1]));
const posGelesen = new Set([...SQL.matchAll(/\bp\s*->>?\s*'(\w+)'/g)].map(m => m[1]));
const POS_NUR_SEITE = ["gebinde_text"];   /* namentlich: hält „0,75 l“ zum Wiederanzeigen */

/* ── 2 · Gestellte Datenbank ────────────────────────────────────── */
const ORG = "org-1", BETRIEB = "af095b14-0000-4000-8000-000000000001";
function grundDaten(rolle){
  return {
    rolle,
    mitglieder: [{ rolle, betriebe: { id: BETRIEB, name: "Café Probe", organisation_id: ORG } }],
    artikel: [
      { id: "a-wein", organisation_id: ORG, name: "Hauswein weiß", kategorie: "Wein", basiseinheit: "ml", aktiv: true },
      { id: "a-mehl", organisation_id: ORG, name: "Mehl 405", kategorie: "Trocken", basiseinheit: "g", aktiv: true }
    ],
    lieferanten: [
      { id: "l-1", organisation_id: ORG, name: "Weinhandel Probe", kundennummer: "K-7", kontakt: null, aktiv: true },
      { id: "l-2", organisation_id: ORG, name: "Großmarkt", kundennummer: null, kontakt: null, aktiv: true }
    ],
    einkaufsbelege: [
      { id: "be-frei", betrieb_id: BETRIEB, lieferant_id: "l-1", belegnummer: "R-100", belegdatum: new Date().toISOString().slice(0, 10),
        netto: 64.8, steuer: 12.31, brutto: 77.11, status: "freigegeben", quelle: "manuell", notiz: null, positionen_entwurf: [], angelegt: new Date().toISOString() },
      { id: "be-entwurf", betrieb_id: BETRIEB, lieferant_id: "l-2", belegnummer: "G-5", belegdatum: new Date().toISOString().slice(0, 10),
        netto: 20, steuer: null, brutto: null, status: "entwurf", quelle: "manuell", notiz: null,
        positionen_entwurf: [{ text: "Mehl 405 25 kg", art: "ware", artikel_id: "a-mehl", menge: 1, gebinde_basis: 25000, gebinde_text: "25 kg", netto: 20, steuersatz: 7 }],
        angelegt: new Date().toISOString(), datei_pfad: BETRIEB + "/11111111-2222-4333-8444-555555555555.jpg" }
    ],
    einkaufspositionen: [
      { beleg_id: "be-frei", pos: 1, text: "Wein 0,75 l", art: "ware", artikel_id: "a-wein", menge: 12, einkaufseinheit: "Flasche", gebinde_basis: 750, menge_basis: 9000, netto: 64.8, steuersatz: 19 }
    ],
    lagerbestand: [{ betrieb_id: BETRIEB, artikel_id: "a-wein", menge_basis: 18000, wert_netto: 118.8 }],
    artikel_preise: [
      { betrieb_id: BETRIEB, artikel_id: "a-wein", preis_basis: 0.0072, belegdatum: "2026-10-05", position_id: "p2", lieferant_id: "l-1" },
      { betrieb_id: BETRIEB, artikel_id: "a-wein", preis_basis: 0.006, belegdatum: "2026-10-01", position_id: "p1", lieferant_id: "l-1" }
    ],
    lieferanten_artikel: [
      { id: "z-1", lieferant_id: "l-1", artikel_id: "a-wein", bezeichnung: "Wein 0,75 l", einkaufseinheit: "Flasche", gebinde_basis: 750, letzter_preis: 5.4, letzter_preis_am: "2026-10-05" }
    ]
  };
}

function ersatz(start){
  return "(function(D){" + `
    window.__D = D;
    window.__rufe = [];            /* {name, args} */
    window.__schreib = [];         /* {tabelle, art, werte, filter} */
    window.__vorPin = 0; window.__pinOk = !D.pinPflicht;
    const nutzer = { id:"u-1", email:"wirt@probe.de" };
    const sitzung = D.ohneSitzung ? null : { user:nutzer, access_token:"x" };
    function abfrage(tabelle){
      const q = { tabelle, filter:[], art:"select", werte:null };
      const fertig = () => {
        if(!window.__pinOk) window.__vorPin++;
        if(q.art !== "select"){
          window.__schreib.push({ tabelle, art:q.art, werte:q.werte, filter:q.filter });
          const f = (D.schreibFehler || {})[tabelle];
          return { data:null, error: f || null };
        }
        let quelle = { betrieb_mitglieder:D.mitglieder }[tabelle] || D[tabelle] || [];
        for(const [k, v] of q.filter) quelle = quelle.filter(z => z[k] === v);
        return { data: JSON.parse(JSON.stringify(quelle)), error:null };
      };
      const p = new Proxy({}, { get(_, k){
        if(k === "then") return (a, b) => Promise.resolve(fertig()).then(a, b);
        if(k === "eq") return (sp, w) => { q.filter.push([sp, w]); return p; };
        if(k === "insert"){ return w => { q.art = "insert"; q.werte = w; return p; }; }
        if(k === "update"){ return w => { q.art = "update"; q.werte = w; return p; }; }
        return () => p;
      }});
      return p;
    }
    window.supabase = { createClient: () => ({
      auth: {
        getSession: async () => ({ data:{ session: sitzung } }),
        signInWithPassword: async () => ({ data:{ user:nutzer, session:{ user:nutzer } }, error:null }),
        signOut: async () => ({}),
        updateUser: async () => ({ data:{ user:nutzer }, error:null }),
        resetPasswordForEmail: async () => ({ error:null }),
        onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } })
      },
      rpc: async (name, args) => {
        window.__rufe.push({ name, args: JSON.parse(JSON.stringify(args || {})) });
        if(name === "pin_status") return { data: D.pinPflicht ? { pflicht:true, ok:false, hat_pin:true, gesperrt:false } : { pflicht:false, ok:true }, error:null };
        if(name === "pin_pruefen"){ window.__pinOk = args.p_pin === "12345678"; return { data: window.__pinOk ? { ok:true } : { ok:false, grund:"falsch", verbleibend:4 }, error:null }; }
        if(name === "admin_anmelden") return { data:{ erlaubt:true }, error:null };
        const a = (D.antworten || {})[name];
        if(a) return { data:a, error:null };
        if(name === "beleg_speichern") return { data:{ ok:true, id: args.p_beleg || "be-neu" }, error:null };
        return { data:{ ok:true }, error:null };
      },
      from: t => abfrage(t),
      storage: { from: eimer => ({
        upload: async (pfad, blob, opt) => {
          const b = new Uint8Array(await blob.arrayBuffer());
          window.__hoch = { eimer, pfad, typ: opt && opt.contentType, groesse: b.length, kopf: [b[0], b[1], b[2], b[3]] };
          return D.hochFehler ? { data:null, error:{ message:"x" } } : { data:{ path: pfad }, error:null };
        },
        createSignedUrl: async (pfad, sek) => { window.__signiert = { eimer, pfad, sek }; return { data:{ signedUrl:"about:blank#" + pfad }, error:null }; }
      }) },
      functions: { invoke: async (name, opt) => {
        window.__rufe.push({ name: "fn:" + name, args: JSON.parse(JSON.stringify((opt && opt.body) || {})) });
        const a = (D.antworten || {})["fn:" + name];
        return a ? { data:a, error:null } : { data:null, error:{ message:"weg" } };
      } }
    }) };
  ` + "})(" + JSON.stringify(start) + ");";
}

async function oeffnen(browser, daten, breite){
  const ctx = await browser.newContext({ viewport:{ width: breite || 390, height: 844 } });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push(String(e).slice(0, 200)));
  await p.addInitScript({ content: ersatz(daten) });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto(SEITE);
  return { ctx, p, kons };
}
const rufe = (p, name) => p.evaluate(n => window.__rufe.filter(r => r.name === n), name);

/* Kontrast: jede sichtbare Schrift gegen den ersten deckenden Grund darüber. */
async function kontrastMin(p){
  return p.evaluate(() => {
    const rgb = s => { const m = s.match(/rgba?\(([^)]+)\)/); if(!m) return null; const v = m[1].split(",").map(x => parseFloat(x)); return { r:v[0], g:v[1], b:v[2], a: v.length > 3 ? v[3] : 1 }; };
    const L = c => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const mische = (o, u) => ({ r: o.r * o.a + u.r * (1 - o.a), g: o.g * o.a + u.g * (1 - o.a), b: o.b * o.a + u.b * (1 - o.a), a:1 });
    function grund(el){
      const kette = []; for(let e = el; e; e = e.parentElement) kette.push(getComputedStyle(e).backgroundColor);
      let c = rgb(getComputedStyle(document.body).backgroundColor);
      for(let i = kette.length - 1; i >= 0; i--){ const b = rgb(kette[i]); if(b && b.a > 0) c = b.a >= 1 ? b : mische(b, c); }
      return c;
    }
    let min = 99, wo = "";
    for(const el of document.querySelectorAll("body *")){
      if(!el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
      const hatText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if(!hatText) continue;
      const r = el.getBoundingClientRect(); if(!r.width || !r.height) continue;
      const st = getComputedStyle(el); if(st.visibility === "hidden" || parseFloat(st.opacity) === 0) continue;
      const f = rgb(st.color), g = grund(el); if(!f || !g) continue;
      const ff = f.a < 1 ? mische(f, g) : f;
      const a = L(ff), b = L(g), k = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      if(k < min){ min = k; wo = (el.id || el.className || el.tagName) + " „" + el.textContent.trim().slice(0, 30) + "“"; }
    }
    return { min: Math.round(min * 100) / 100, wo };
  });
}
async function kleineZiele(p){
  return p.evaluate(() => [...document.querySelectorAll("button, a, select, input")].filter(el => {
    if(!el.offsetParent) return false;
    const r = el.getBoundingClientRect(); if(!r.width) return false;
    if(el.closest(".pin-decke")) return false;
    return r.height < 43.5 || (r.width < 43.5 && el.tagName !== "INPUT");
  }).map(el => (el.id || el.textContent.trim().slice(0, 20) || el.tagName) + " " + Math.round(el.getBoundingClientRect().height)));
}
const ueberlauf = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());

  /* ── 3 · Anmeldung und PIN vor den Daten ───────────────────────── */
  console.log("\n══ 2 · Anmeldung, PIN vor den Daten ══");
  {
    const d = grundDaten("inhaber"); d.ohneSitzung = true; d.pinPflicht = true;
    const { ctx, p, kons } = await oeffnen(browser, d);
    await p.waitForTimeout(300);
    pruef(await p.isVisible("#loginBox") && !(await p.isVisible("#app")), "ohne Sitzung: Anmeldung steht, Einkauf verborgen");
    pruef(await p.isVisible("#vergessenBtn"), "„Passwort vergessen?“ auf der Seite selbst");
    await p.fill("#email", "wirt@probe.de"); await p.fill("#password", "richtig123"); await p.click("#loginBtn");
    await p.waitForSelector(".pin-decke", { timeout: 4000 }).catch(() => {});
    const vor = await p.evaluate(() => ({ schirm: !!document.querySelector(".pin-decke"), daten: window.__vorPin, app: !document.getElementById("app").hidden }));
    pruef(vor.schirm && vor.daten === 0 && !vor.app, "PIN-Schirm steht, vorher keine einzige Abfrage", JSON.stringify(vor));
    pruef((await rufe(p, "admin_anmelden")).length === 1, "Sperre am Board-Weg gefragt (admin_anmelden)");
    await p.fill("#pin-feld", "12345678");
    await p.waitForSelector("#app:not([hidden])", { timeout: 4000 }).catch(() => {});
    pruef(await p.isVisible("#app") && (await p.textContent("#betriebName")) === "Café Probe", "richtige PIN: Einkauf öffnet mit dem Betrieb");
    pruef(!kons.length, "keine Ausnahme", kons[0]);
    await ctx.close();
  }

  /* ── 4 · Übersicht ─────────────────────────────────────────────── */
  console.log("\n══ 3 · Übersicht ══");
  const d0 = grundDaten("inhaber");
  const { ctx, p, kons } = await oeffnen(browser, d0);
  await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
  await p.waitForTimeout(200);
  pruef((await p.textContent("#kMonat")).replace(/\s/g, " ") === "64,80 €", "Monatssumme = freigegebene Belege netto", await p.textContent("#kMonat"));
  pruef((await p.textContent("#kEntwuerfe")) === "1", "ein offener Entwurf gezählt");
  const preis = await p.textContent("#preisListe");
  pruef(/\+20 %/.test(preis) && /6,00\s€ \/ l/.test(preis) && /7,20\s€ \/ l/.test(preis), "Preisänderung +20 % mit €/l vorher → jetzt", preis.replace(/\s+/g, " ").slice(0, 90));

  /* ── 5 · Beleg erfassen über den echten Weg ────────────────────── */
  console.log("\n══ 4 · Beleg erfassen und freigeben ══");
  await p.click('.reiter [data-ansicht="belege"]');
  await p.click("#belegNeu");
  await p.selectOption("#eLieferant", "l-2");
  await p.fill("#eNummer", "N-1");
  await p.fill("#eNetto", "54");
  await p.fill("#eSteuer", "");
  const pos = '#posListe [data-pos="0"]';
  await p.fill(pos + ' [data-f="text"]', "Weißwein 0,75");
  await p.selectOption(pos + ' [data-f="artikel_id"]', "a-wein");
  await p.fill(pos + ' [data-f="menge"]', "12");
  await p.fill(pos + ' [data-f="gebinde"]', "0,75 l");
  await p.fill(pos + ' [data-f="netto"]', "54");
  await p.fill(pos + ' [data-f="steuersatz"]', "19");
  const erg = (await p.textContent('[data-ergebnis="0"]')).replace(/\s/g, " ");
  pruef(/9 l/.test(erg) && /6,00 € \/ l/.test(erg), "12 × 0,75 l für 54 € zeigt 9 l und 6,00 €/l", erg);
  pruef(/passt/.test(await p.getAttribute("#summenzeile", "class")), "Summe der Positionen passt zum Beleg");
  await p.click('[data-aktion="freigeben"]');
  await p.waitForTimeout(300);
  const sp = await rufe(p, "beleg_speichern"), fg = await rufe(p, "beleg_freigeben");
  pruef(sp.length === 1 && fg.length === 1 && fg[0].args.p_beleg === "be-neu", "erst speichern, dann genau diese ID freigeben", sp.length + " / " + fg.length);
  const nl = sp[0] ? sp[0].args : {};
  pruef(JSON.stringify(Object.keys(nl).sort()) === JSON.stringify(SIGNATUR.beleg_speichern), "Parameter = Signatur von beleg_speichern", Object.keys(nl).join(","));
  pruef(JSON.stringify(Object.keys(fg[0] ? fg[0].args : {}).sort()) === JSON.stringify(SIGNATUR.beleg_freigeben), "Parameter = Signatur von beleg_freigeben");
  const dk = Object.keys(nl.p_daten || {}).filter(k => !datenGelesen.has(k));
  pruef(!dk.length, "jeder Schlüssel in p_daten wird in der SQL gelesen", dk.join(", ") || [...datenGelesen].join(","));
  const p0 = (nl.p_daten && nl.p_daten.positionen && nl.p_daten.positionen[0]) || {};
  const pk = Object.keys(p0).filter(k => !posGelesen.has(k) && !POS_NUR_SEITE.includes(k));
  pruef(!pk.length, "jeder Schlüssel einer Position wird in beleg_freigeben gelesen (Ausnahme gebinde_text)", pk.join(", ") || "alle");
  pruef(p0.gebinde_basis === 750 && p0.menge === 12 && p0.netto === 54 && p0.artikel_id === "a-wein", "Position: gebinde_basis 750 ml, Menge 12, Netto 54", JSON.stringify(p0));
  pruef(nl.p_daten.steuer === null && nl.p_daten.netto === 54, "leeres Feld geht als null, nicht als 0", "steuer " + JSON.stringify(nl.p_daten.steuer));

  /* ── 6 · Zahlen: Komma, Unlesbares, Gewicht ≠ Volumen ──────────── */
  console.log("\n══ 5 · Zahlen lesen ══");
  await p.evaluate(() => { window.__rufe.length = 0; });
  await p.click('.reiter [data-ansicht="belege"]');
  await p.click("#belegNeu");
  await p.selectOption("#eLieferant", "l-2");
  await p.fill("#eNetto", "7,5");
  await p.fill(pos + ' [data-f="text"]', "Mehl");
  await p.selectOption(pos + ' [data-f="artikel_id"]', "a-mehl");
  await p.fill(pos + ' [data-f="gebinde"]', "1 l");
  pruef(/nicht umgerechnet/.test(await p.textContent('[data-ergebnis="0"]')), "Gewichtsartikel mit „1 l“: Satz statt Umrechnung");
  await p.click('[data-aktion="sichern"]'); await p.waitForTimeout(150);
  pruef((await rufe(p, "beleg_speichern")).length === 0 && /nicht umgerechnet/.test(await p.textContent("#eMeldung")), "… und es geht nichts hinaus");
  await p.fill(pos + ' [data-f="gebinde"]', "1 kg");
  await p.fill(pos + ' [data-f="netto"]', "abc");
  await p.click('[data-aktion="sichern"]'); await p.waitForTimeout(150);
  pruef((await rufe(p, "beleg_speichern")).length === 0 && /Netto ist nicht lesbar/.test(await p.textContent("#eMeldung")), "Netto „abc“: nichts geschickt, Satz", await p.textContent("#eMeldung"));
  await p.fill(pos + ' [data-f="netto"]', "7,5");
  await p.click('[data-aktion="sichern"]'); await p.waitForTimeout(250);
  const k2 = await rufe(p, "beleg_speichern");
  const d2 = k2[0] ? k2[0].args.p_daten : {};
  pruef(k2.length === 1 && d2.netto === 7.5 && d2.positionen[0].netto === 7.5 && d2.positionen[0].gebinde_basis === 1000, "„7,5“ geht als 7,5, „1 kg“ als 1000 g", JSON.stringify({ n: d2.netto, g: d2.positionen && d2.positionen[0].gebinde_basis }));

  /* ── 7 · Gelernte Zuordnung ────────────────────────────────────── */
  console.log("\n══ 6 · Zuordnung lernt ══");
  await p.click('[data-aktion="liste"]');
  await p.click("#belegNeu");
  await p.selectOption("#eLieferant", "l-1");
  await p.fill(pos + ' [data-f="text"]', "wein 0,75 l");
  await p.press(pos + ' [data-f="text"]', "Tab");
  await p.waitForTimeout(100);
  const gel = await p.evaluate(s => ({ art: document.querySelector(s + ' [data-f="artikel_id"]').value, geb: document.querySelector(s + ' [data-f="gebinde"]').value,
    hinweis: !!document.querySelector(s + " .gelernt") }), pos);
  pruef(gel.art === "a-wein" && gel.geb === "750 ml" && gel.hinweis, "Text wie beim letzten Mal → Artikel und Gebinde vorgeschlagen, sichtbar markiert", JSON.stringify(gel));

  /* ── 8 · Gründe vom Server als Satz ────────────────────────────── */
  console.log("\n══ 7 · Gründe als Satz ══");
  await p.evaluate(() => { window.__D.antworten = { beleg_freigeben: { ok:false, grund:"summe", positionen:54, beleg:60 } }; });
  await p.fill("#eNetto", "60"); await p.fill(pos + ' [data-f="netto"]', "54"); await p.fill(pos + ' [data-f="menge"]', "12");
  await p.click('[data-aktion="freigeben"]'); await p.waitForTimeout(350);
  const satz = (await p.textContent("#eMeldung")).replace(/\s/g, " ");
  pruef(/54,00 €/.test(satz) && /60,00 €/.test(satz) && !/summe\b|"grund"/.test(satz), "summe → Satz mit beiden Beträgen, kein Rohtext", satz);
  await p.evaluate(() => { window.__D.antworten = { beleg_freigeben: { ok:false, grund:"doppelt" } }; });
  await p.click('[data-aktion="freigeben"]'); await p.waitForTimeout(350);
  pruef(/schon freigegeben/.test(await p.textContent("#eMeldung")), "doppelt → Satz", await p.textContent("#eMeldung"));
  await p.evaluate(() => { window.__D.antworten = {}; });

  /* ── 9 · Freigegeben: nur ansehen, Storno beim zweiten Tipp ────── */
  console.log("\n══ 8 · Freigegebener Beleg ══");
  await p.click('[data-aktion="liste"]');
  await p.click('#belegListe [data-beleg="be-frei"]');
  await p.waitForTimeout(150);
  const ansehen = await p.evaluate(() => ({ felder: document.querySelectorAll("#belegEdit input, #belegEdit select, #belegEdit textarea").length,
    text: document.getElementById("belegEdit").textContent.replace(/\s/g, " ") }));
  pruef(ansehen.felder === 0, "kein Eingabefeld am freigegebenen Beleg", ansehen.felder + " Felder");
  pruef(/9 l/.test(ansehen.text) && /7,20 € \/ l/.test(ansehen.text), "Positionen aus einkaufspositionen mit Menge und Preis", ansehen.text.slice(0, 120));
  await p.evaluate(() => { window.__rufe.length = 0; });
  await p.click('[data-aktion="stornieren"]'); await p.waitForTimeout(100);
  pruef((await rufe(p, "beleg_stornieren")).length === 0 && /Nochmal tippen/.test(await p.textContent('[data-aktion="stornieren"]')), "erster Tipp storniert nichts, sagt was passiert");
  await p.click('[data-aktion="stornieren"]'); await p.waitForTimeout(200);
  const st = await rufe(p, "beleg_stornieren");
  pruef(st.length === 1 && st[0].args.p_beleg === "be-frei" && JSON.stringify(Object.keys(st[0].args).sort()) === JSON.stringify(SIGNATUR.beleg_stornieren), "zweiter Tipp: genau ein beleg_stornieren mit dieser ID");

  /* ── 10 · Artikel ──────────────────────────────────────────────── */
  console.log("\n══ 9 · Artikel ══");
  await p.click('.reiter [data-ansicht="artikel"]');
  const best = (await p.textContent("#artikelListe")).replace(/\s/g, " ");
  pruef(/18 l/.test(best) && /zuletzt 7,20 € \/ l/.test(best), "Bestand 18 l und letzter Preis je Liter", best.slice(0, 80));
  await p.fill("#aName", "Hafermilch"); await p.click('#aEinheit [data-einheit="ml"]'); await p.click("#aAnlegen"); await p.waitForTimeout(150);
  const ins = await p.evaluate(() => window.__schreib.filter(s => s.tabelle === "artikel" && s.art === "insert"));
  pruef(ins.length === 1 && ins[0].werte.basiseinheit === "ml" && ins[0].werte.organisation_id === "org-1" && ins[0].werte.kategorie === null, "Artikel: Einheit, Organisation, leere Kategorie als null", JSON.stringify(ins[0] && ins[0].werte));
  await p.evaluate(() => { window.__D.schreibFehler = { artikel: { code:"23505", message:"duplicate key" } }; });
  await p.fill("#aName", "Hauswein weiß"); await p.click("#aAnlegen"); await p.waitForTimeout(150);
  pruef(/gibt es schon/.test(await p.textContent("#aMeldung")), "doppelter Name → Satz", await p.textContent("#aMeldung"));
  await p.evaluate(() => { window.__D.schreibFehler = {}; });
  await p.click('[data-aktion="artikel-auf"][data-id="a-wein"]');
  const upd0 = await p.evaluate(() => window.__schreib.length);
  await p.fill("#aeName", "Hauswein trocken"); await p.click('[data-aktion="artikel-sichern"]'); await p.waitForTimeout(150);
  const upd = await p.evaluate(n => window.__schreib.slice(n), upd0);
  pruef(upd.length === 1 && JSON.stringify(Object.keys(upd[0].werte).sort()) === '["kategorie","name"]', "Ändern schreibt nur name/kategorie (basiseinheit ist fest)", JSON.stringify(upd[0] && upd[0].werte));
  pruef(!kons.length, "keine Ausnahme im ganzen Durchgang", kons[0]);
  await ctx.close();

  /* ── E2 · Rechnung einlesen, Datei, Inventur, Verlust ──────────── */
  console.log("\n══ 12 · Rechnung einlesen (E2) ══");
  {
    const d = grundDaten("inhaber");
    d.antworten = { "fn:beleg-lesen": { ok:true, id:"be-entwurf", positionen:3, zugeordnet:1, lieferant:"Großmarkt" } };
    const { ctx, p, kons } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="belege"]');
    pruef(await p.isVisible("#einlesenKnopf"), "„Rechnung einlesen“ für den Inhaber da");
    /* Ein echtes PNG (1×1) — die Seite muss daraus ein JPEG machen. */
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await p.setInputFiles("#einlesenDatei", { name:"rechnung.png", mimeType:"image/png", buffer: png });
    await p.waitForFunction(() => window.__rufe.some(r => r.name === "fn:beleg-lesen"), null, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(300);
    const hoch = await p.evaluate(() => window.__hoch);
    const ruf = (await rufe(p, "fn:beleg-lesen"))[0];
    pruef(hoch && hoch.eimer === "belege" && hoch.typ === "image/jpeg" && hoch.kopf[0] === 0xff && hoch.kopf[1] === 0xd8, "Foto als echtes JPEG in den privaten Eimer", JSON.stringify(hoch));
    const pfadOk = hoch && new RegExp("^" + BETRIEB + "/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" + PFAD_EDGE).test(hoch.pfad);
    pruef(pfadOk, "Pfad passt auf die Regel von beleg-lesen", hoch && hoch.pfad);
    pruef(ruf && ruf.args.betrieb_id === BETRIEB && ruf.args.pfad === hoch.pfad && Object.keys(ruf.args).length === 2, "Funktion bekommt nur Betrieb und Pfad", JSON.stringify(ruf && ruf.args));
    pruef(/Mehl 405/.test(await p.textContent("#belegEdit")) && await p.isVisible('[data-aktion="datei"]'), "danach steht der Entwurf offen, mit „Rechnung ansehen“");
    pruef(/3 Positionen gelesen, 1 davon zugeordnet/.test(await p.textContent("#toast")), "Satz: gelesen und zugeordnet", await p.textContent("#toast"));
    await p.evaluate(() => { window.open = () => ({ close(){}, location:{ href:"" } }); });
    await p.click('[data-aktion="datei"]'); await p.waitForTimeout(150);
    const sig = await p.evaluate(() => window.__signiert);
    pruef(sig && sig.eimer === "belege" && sig.pfad === BETRIEB + "/11111111-2222-4333-8444-555555555555.jpg" && sig.sek <= 600, "Rechnung ansehen: kurzer signierter Link auf genau diese Datei", JSON.stringify(sig));
    /* PDF bleibt PDF */
    await p.evaluate(() => { window.__D.antworten["fn:beleg-lesen"] = { ok:false, grund:"kein_schluessel" }; window.__hoch = null; });
    await p.click('.reiter [data-ansicht="belege"]');
    await p.setInputFiles("#einlesenDatei", { name:"rechnung.pdf", mimeType:"application/pdf", buffer: Buffer.from("%PDF-1.4\n%probe\n") });
    await p.waitForTimeout(500);
    const hoch2 = await p.evaluate(() => window.__hoch);
    pruef(hoch2 && /\.pdf$/.test(hoch2.pfad) && hoch2.typ === "application/pdf" && hoch2.kopf[0] === 0x25, "PDF geht unverändert als PDF", JSON.stringify(hoch2));
    pruef(/noch nicht eingerichtet/.test(await p.textContent("#lesestand")), "kein Schlüssel → Satz, Weg „von Hand“ genannt", await p.textContent("#lesestand"));
    /* Doppelt → vorhandenen Beleg öffnen */
    await p.evaluate(() => { window.__D.antworten["fn:beleg-lesen"] = { ok:false, grund:"datei_doppelt", beleg:"be-frei" }; });
    await p.setInputFiles("#einlesenDatei", { name:"rechnung.pdf", mimeType:"application/pdf", buffer: Buffer.from("%PDF-1.4\n%zwei\n") });
    await p.waitForTimeout(500);
    pruef(/R-100/.test(await p.textContent("#belegEdit")) && /schon eingelesen/.test(await p.textContent("#lesestand")), "dieselbe Rechnung nochmal → vorhandener Beleg offen, Satz");
    /* Netz weg → Satz, nichts hängt */
    await p.evaluate(() => { delete window.__D.antworten["fn:beleg-lesen"]; });
    await p.click('.reiter [data-ansicht="belege"]');
    await p.setInputFiles("#einlesenDatei", { name:"rechnung.pdf", mimeType:"application/pdf", buffer: Buffer.from("%PDF-1.4\n%drei\n") });
    await p.waitForTimeout(500);
    pruef(/Keine Verbindung zum Lesedienst/.test(await p.textContent("#lesestand")), "Lesedienst weg → Satz statt Hängen");

    console.log("\n══ 13 · Inventur und Verlust (E2) ══");
    await p.click('.reiter [data-ansicht="artikel"]');
    await p.click("#inventurKnopf");
    pruef(await p.isVisible("#inventurKarte") && (await p.getAttribute("#inventurKnopf", "aria-expanded")) === "true", "Inventur öffnet");
    await p.fill('[data-inv="a-mehl"]', "abc");
    await p.evaluate(() => { window.__rufe.length = 0; });
    await p.click("#invBuchen"); await p.waitForTimeout(100);
    pruef((await rufe(p, "inventur_buchen")).length === 0 && /nicht lesbar/.test(await p.textContent("#invMeldung")), "„abc“ → nichts gebucht, Satz");
    await p.fill('[data-inv="a-mehl"]', "20,5");
    await p.evaluate(() => { window.__D.antworten = { inventur_buchen:{ ok:true, buchungen:1, differenz_wert:-4 } }; });
    await p.click("#invBuchen"); await p.waitForTimeout(200);
    const inv = (await rufe(p, "inventur_buchen"))[0];
    pruef(inv && JSON.stringify(Object.keys(inv.args).sort()) === JSON.stringify(SIGNATUR.inventur_buchen), "Parameter = Signatur von inventur_buchen", inv && Object.keys(inv.args).join(","));
    pruef(inv && inv.args.p_zaehlung.length === 1 && inv.args.p_zaehlung[0].artikel_id === "a-mehl" && inv.args.p_zaehlung[0].menge === 20500,
      "„20,5“ kg → 20500 g; leeres Feld (Wein) nicht als 0 gezählt", JSON.stringify(inv && inv.args.p_zaehlung));
    await p.click('[data-aktion="artikel-auf"][data-id="a-wein"]');
    await p.fill("#vMenge", "1,5"); await p.fill("#vGrund", "Bruch");
    await p.evaluate(() => { window.__D.antworten = { verlust_buchen:{ ok:true, wert:-10.8 } }; });
    await p.click('[data-aktion="verlust"]'); await p.waitForTimeout(200);
    const vl = (await rufe(p, "verlust_buchen"))[0];
    pruef(vl && JSON.stringify(Object.keys(vl.args).sort()) === JSON.stringify(SIGNATUR.verlust_buchen) && vl.args.p_menge === 1500 && vl.args.p_notiz === "Bruch",
      "Verlust 1,5 l → 1500 ml mit Grund", JSON.stringify(vl && vl.args));
    pruef(!kons.length, "keine Ausnahme beim Einlesen, Inventur, Verlust", kons[0]);
    await ctx.close();
  }

  /* ── 11 · Team ─────────────────────────────────────────────────── */
  console.log("\n══ 10 · Team ══");
  {
    const { ctx, p } = await oeffnen(browser, grundDaten("team"));
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    pruef(await p.isVisible("#lesesatz"), "Team: Satz statt Bedienung");
    await p.click('.reiter [data-ansicht="belege"]');
    pruef(!(await p.isVisible("#belegNeu")) && !(await p.isVisible("#einlesenKnopf")), "Team: weder erfassen noch einlesen");
    await p.click('#belegListe [data-beleg="be-entwurf"]'); await p.waitForTimeout(150);
    const f = await p.evaluate(() => document.querySelectorAll("#belegEdit input, #belegEdit select").length);
    pruef(f === 0 && /Mehl 405/.test(await p.textContent("#belegEdit")), "Team: Entwurf nur ansehen", f + " Felder");
    await p.click('.reiter [data-ansicht="artikel"]');
    pruef(!(await p.isVisible("#aAnlegen")) && !(await p.isVisible('[data-aktion="artikel-auf"]')) && !(await p.isVisible("#inventurKnopf")), "Team: Artikel weder anlegen noch ändern, keine Inventur");
    await ctx.close();
  }

  /* ── 12 · Maße, Kontrast, Überlauf ─────────────────────────────── */
  console.log("\n══ 11 · 360 und 1280 px ══");
  for(const breite of [360, 1280]){
    const { ctx, p } = await oeffnen(browser, grundDaten("inhaber"), breite);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    for(const ansicht of ["uebersicht", "belege", "artikel", "lieferanten"]){
      await p.click('.reiter [data-ansicht="' + ansicht + '"]');
      if(ansicht === "belege") await p.click("#belegNeu");
      if(ansicht === "lieferanten") await p.click('[data-aktion="lief-auf"][data-id="l-1"]');
      await p.waitForTimeout(80);
      const u = await ueberlauf(p), k = await kontrastMin(p), z = await kleineZiele(p);
      pruef(u <= 0, breite + " px · " + ansicht + ": kein seitlicher Überlauf", u + " px");
      pruef(k.min >= 4.5, breite + " px · " + ansicht + ": Schrift ≥ 4,5:1", k.min + " " + k.wo);
      pruef(!z.length, breite + " px · " + ansicht + ": jedes Ziel ≥ 44 px", z.join("; "));
    }
    await ctx.close();
  }
  {
    const d = grundDaten("inhaber"); d.ohneSitzung = true;
    const { ctx, p } = await oeffnen(browser, d, 360);
    await p.waitForTimeout(200);
    const k = await kontrastMin(p), z = await kleineZiele(p);
    const fs16 = await p.evaluate(() => [...document.querySelectorAll("#tor input")].every(i => parseFloat(getComputedStyle(i).fontSize) >= 16));
    pruef(k.min >= 4.5 && !z.length && fs16, "Anmeldung: Kontrast, 44 px, Felder 16 px", k.min + " " + z.join(";"));
    const schema = await p.evaluate(() => ({ meta: document.querySelector('meta[name="color-scheme"]').content, css: getComputedStyle(document.documentElement).colorScheme }));
    pruef(schema.meta === "only dark" && /dark/.test(schema.css), "color-scheme: meta und CSS sagen dasselbe", JSON.stringify(schema));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " FEHLER" : "Alles grün."));
  process.exit(fehler ? 1 : 0);
})();
