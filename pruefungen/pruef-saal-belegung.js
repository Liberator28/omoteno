#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   pruef-saal-belegung.js · Wer sitzt wo, und ist er noch da? (Wunsch 01.11.)

   1 · Naht als Quelltext: gesendete Parameter = Signatur in
       migration-tisch-belegung.sql, gelesene Spalten ⊆ Tabelle und Rückgabe
       von saal_anwesenheit (§8.1i).
   2 · Plan mit gestellter Belegung: Schild am RICHTIGEN Tisch (3/4, zahlt,
       still, frei), ungültige Zeilen fallen weg, Schild fängt keinen Tipp,
       Schrift ≥ 4,5:1.
   3 · Liste links: Gäste im Haus, Personen je Zeile, „Besetzt · alles gut“
       in eigener Hülle (die Zeilen mit Bedarf bleiben, was sie waren).
   4 · Blatt des Tisches mit echten Tipps: − / +, „Zahlt gerade“, „Tisch
       frei“ — Nutzlast genau so, Server-Absage nimmt zurück und sagt warum,
       der jüngste Tipp gewinnt gegen eine langsamere ältere Antwort (§8.1ae).
   4b· Migration fehlt: Plan ohne Schilder wie vorher, „+“ sendet NICHTS und
       nennt die Datei.
   5 · Assistent: Maße → Raum in Metern, Tische im Raum, ≥ 2 m auseinander;
       Getipptes übersteht ein Neuzeichnen; Unsinn → Satz, kein Editor.
   6 · Maße: Knöpfe ≥ 44 px, Felder 16 px, 360 px ohne Überlauf, kein Fehler.

   Ehrliche Grenzen: gestellte Datenbank (die echte Funktion prüft
   pruef-saalplan-lokal.sh); kopfloses Chromium; der 30-s-Takt (nur bei
   sichtbarem Tab) ist nicht gemessen.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OBEN = path.join(__dirname, "..");
const ADMIN_DATEI = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");
const ADMIN = "file://" + ADMIN_DATEI;
const MIG = fs.readFileSync(path.join(OBEN, "datenbank", "migration-tisch-belegung.sql"), "utf8");
const SRC = fs.readFileSync(ADMIN_DATEI, "utf8");

let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined && z !== "" ? "  → " + (typeof z === "string" ? z : JSON.stringify(z)).slice(0, 240) : "")); };

/* ── 1 · Naht ─────────────────────────────────────────────────────── */
console.log("\n══ 1 · Naht Board ↔ Migration ══");
{
  const sig = (MIG.match(/function public\.tisch_belegung_setzen\(([^)]*)\)/) || [])[1] || "";
  const param = [...sig.matchAll(/(p_[a-z_]+)/g)].map(m => m[1]);
  const ruf = (SRC.match(/db\.rpc\("tisch_belegung_setzen", \{([^}]*)\}/) || [])[1] || "";
  const gesendet = [...ruf.matchAll(/(p_[a-z_]+):/g)].map(m => m[1]);
  pruef(param.length === 4 && JSON.stringify(gesendet.slice().sort()) === JSON.stringify(param.slice().sort()), "gesendete Parameter = Signatur von tisch_belegung_setzen", { param, gesendet });
  const spalten = ((MIG.match(/create table if not exists public\.tisch_belegung \(([\s\S]*?)\n\);/) || [])[1] || "").split("\n").map(z => (z.trim().match(/^([a-z_]+)\s/) || [])[1]).filter(Boolean);
  const gelesen = ((SRC.match(/from\("tisch_belegung"\)\.select\("([^"]+)"\)/) || [])[1] || "").split(",");
  pruef(gelesen.length >= 4 && gelesen.every(s => spalten.includes(s)), "gelesene Spalten stehen in der Tabelle", { gelesen, spalten });
  const rueck = ((MIG.match(/returns table \(([^)]*)\)/) || [])[1] || "").split(",").map(z => z.trim().split(/\s+/)[0]);
  pruef(["tisch_nummer", "letzte_aktivitaet", "offen"].every(k => rueck.includes(k) && SRC.includes("z." + k)), "das Board liest genau, was saal_anwesenheit zurückgibt", rueck);
  const gruende = [...new Set([...MIG.matchAll(/'grund', '([a-z_]+)'/g)].map(m => m[1]))];
  pruef(gruende.includes("kein_recht") && gruende.includes("tisch") && /grund === "kein_recht"/.test(SRC) && /grund === "tisch"/.test(SRC), "die Gründe kein_recht und tisch haben im Board einen eigenen Satz (stand/personen kann das Board nicht schicken)", gruende);
  pruef(/STAND: NICHT EINGESPIELT/.test(MIG), "die Migration sagt im Kopf, dass sie nicht live ist");
}

/* ── Werkzeuge ────────────────────────────────────────────────────── */
async function neu(br, breite, hoehe){
  const ctx = await br.newContext({ viewport: { width: breite, height: hoehe }, colorScheme: "dark" });
  const p = await ctx.newPage(); const pf = [];
  p.on("pageerror", e => pf.push(String(e).slice(0, 200)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
  await p.goto(ADMIN); await p.waitForTimeout(700);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; tafelZeigen("reservierungen"); });
  await p.waitForTimeout(400);
  return { ctx, p, pf };
}
/* Feste Lage (§8.1j) und eine gestellte Datenbank. `fehlt` = Migration nicht eingespielt. */
async function stelle(p, fehlt){
  await p.evaluate(async fehlt => {
    const vor = m => new Date(Date.now() - m * 60000).toISOString();
    bestellungen.length = 0;
    bestellungen.push(
      { id: "x1", quelle: "service", status: "neu", tisch: "4", zeitpunkt: vor(1), notiz: "Rechnung bitte", positionen: [], summe: 0 },
      { id: "x2", quelle: "tisch", status: "neu", tisch: "10", zeitpunkt: vor(8), positionen: [{ name: "A", menge: 1, preis: 5 }], summe: 5 },
      { id: "x4", quelle: "tisch", status: "arbeit", tisch: "2", zeitpunkt: vor(12), positionen: [{ name: "C", menge: 2, preis: 5 }], summe: 10 },
      { id: "x5", quelle: "tisch", status: "arbeit", tisch: "3", zeitpunkt: vor(15), kueche_fertig_um: vor(1), positionen: [{ name: "D", menge: 1, preis: 5 }], summe: 5 },
      { id: "x6", quelle: "tisch", status: "fertig", tisch: "6", zeitpunkt: vor(40), kueche_fertig_um: vor(35), gebracht_um: vor(33), positionen: [{ name: "E", menge: 1, preis: 5 }], summe: 5 },
      { id: "x7", quelle: "tisch", status: "neu", tisch: "1", zeitpunkt: vor(2), positionen: [{ name: "Waffel", menge: 2, preis: 6.5 }, { name: "Kaffee", menge: 1, preis: 3.2 }], summe: 16.2 },
      { id: "x9", quelle: "tisch", status: "fertig", tisch: "8", zeitpunkt: vor(50), kueche_fertig_um: vor(45), gebracht_um: vor(44), positionen: [{ name: "H", menge: 1, preis: 5 }], summe: 5 }
    );
    bekannt.clear(); bestellungen.forEach(b => bekannt.add(b.id));
    zeigeStatus.fertig = false;
    window.__rpc = []; window.__antworten = []; window.__lesen = 0;
    demo = false; betriebId = "b-1";
    const belegung = window.__belegung = [
      { tisch_nummer: "1", personen: 3, stand: "da", seit: vor(30), geaendert_um: vor(2) },
      { tisch_nummer: "4", personen: 5, stand: "zahlt", seit: vor(90), geaendert_um: vor(3) },
      { tisch_nummer: "6", personen: 0, stand: "frei", seit: vor(10), geaendert_um: vor(10) },
      { tisch_nummer: "9", personen: 2, stand: "da", seit: vor(20), geaendert_um: vor(5) },
      { tisch_nummer: "3", personen: 2, stand: "weg", seit: vor(5), geaendert_um: vor(5) },     // ungültig: Stand
      { tisch_nummer: "5", personen: 99, stand: "da", seit: vor(5), geaendert_um: vor(5) },     // ungültig: Personen
      { tisch_nummer: 7, personen: 2, stand: "da", seit: vor(5), geaendert_um: vor(5) }         // ungültig: Nummer keine Zeichenkette
    ];
    const anw = [{ tisch_nummer: "2", letzte_aktivitaet: vor(3), offen: true }, { tisch_nummer: "8", letzte_aktivitaet: vor(35), offen: true }];
    const fehler = { code: "PGRST205", message: "relation does not exist" };
    db = {
      from: tab => { const o = { select: () => o, eq: () => o, order: () => o,
        then: (ok, nein) => { window.__lesen++; return Promise.resolve(tab === "tisch_belegung" ? (fehlt ? { data: null, error: fehler } : { data: window.__belegung, error: null }) : { data: [], error: null }).then(ok, nein); } }; return o; },
      rpc: (fn, a) => {
        if(fn === "saal_anwesenheit") return Promise.resolve(fehlt ? { data: null, error: { code: "PGRST202", message: "fehlt" } } : { data: anw, error: null });
        window.__rpc.push({ fn, a: JSON.parse(JSON.stringify(a)) });
        if(fehlt) return Promise.resolve({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
        const vorgabe = window.__antworten.shift();
        const antwort = vorgabe || { ms: 10, r: { data: { ok: true, personen: a.p_stand === "frei" ? 0 : a.p_personen, stand: a.p_stand, seit: vor(30), geaendert_um: new Date().toISOString() }, error: null } };
        return new Promise(res => setTimeout(() => res(antwort.r), antwort.ms));
      }
    };
    SAAL.beleg = new Map(); SAAL.anw = new Map(); SAAL.belegSatz = ""; SAAL.belegFehlt = false; SAAL.belegNr = new Map();
    await saalBelegLaden("b-1");
    SAAL.sig = ""; zeichneAlles();
  }, !!fehlt);
  await p.waitForTimeout(250);
}
const schild = (p, nr) => p.evaluate(n => { const g = document.querySelector('#spSvg [data-sp-tisch="demo-t' + n + '"] .sp-bel'); return g ? { text: g.querySelector("text").textContent, art: g.dataset.bel } : null; }, nr);
const lum = c => { const v = c.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
const rgb = s => (String(s).match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const kontrast = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

(async () => {
  const br = await chromium.launch();

  /* ── 2 · Plan ───────────────────────────────────────────────────── */
  console.log("\n══ 2 · Schilder im Plan ══");
  {
    const { ctx, p, pf } = await neu(br, 1440, 900);
    await stelle(p);
    const s1 = await schild(p, 1), s4 = await schild(p, 4), s6 = await schild(p, 6), s2 = await schild(p, 2), s8 = await schild(p, 8), s3 = await schild(p, 3), s5 = await schild(p, 5), s7 = await schild(p, 7), s10 = await schild(p, 10);
    pruef(s1 && s1.text === "3/4" && s1.art === "da", "Tisch 1: eingetragen 3 von 4 Plätzen", s1);
    pruef(s4 && s4.text === "5/6 · zahlt" && s4.art === "zahlt", "Tisch 4: 5 von 6, zahlt gerade", s4);
    pruef(s6 && s6.text === "frei" && s6.art === "frei", "Tisch 6: als frei eingetragen, NACH der letzten Bestellung", s6);
    pruef(s2 && s2.text === "da" && s2.art === "da", "Tisch 2: niemand eingetragen, Tischsitzung offen → „da“", s2);
    pruef(s8 && s8.text === "da · still" && s8.art === "still", "Tisch 8: Sitzung offen, seit 35 Min nichts → „still“", s8);
    pruef(!s3 && !s5 && !s7, "ungültige Zeilen (Stand „weg“, 99 Personen, Nummer als Zahl) setzen kein Schild", { s3, s5, s7 });
    pruef(!s10, "Tisch 10: nur aus der Bestellung bekannt und nicht still → kein zusätzliches Schild (das Zeichen sagt es schon)", s10);
    /* Ein echter Tipp auf den RAND des breiten Schilds (außerhalb des Trefferkreises) wählt den Tisch. */
    const rand = await p.evaluate(() => { const r = document.querySelector('#spSvg [data-sp-tisch="demo-t4"] .sp-bel rect').getBoundingClientRect(); return { x: r.right - 4, y: r.top + r.height / 2, w: r.width }; });
    await p.mouse.click(rand.x, rand.y); await p.waitForTimeout(250);
    const gew = await p.evaluate(() => SAAL.auswahl);
    pruef(rand.w > 60 && gew === "4", "echter Tipp auf den Rand des Schilds „5/6 · zahlt“ wählt Tisch 4", { breite: Math.round(rand.w), auswahl: gew });
    await p.evaluate(() => saalAbwaehlen()); await p.waitForTimeout(150);
    const farben = await p.evaluate(() => [...document.querySelectorAll("#spSvg .sp-bel")].map(g => ({ art: g.dataset.bel, f: getComputedStyle(g.querySelector("rect")).fill, t: getComputedStyle(g.querySelector("text")).fill })));
    const schwach = farben.filter(x => kontrast(x.f, x.t) < 4.5);
    pruef(farben.length >= 5 && !schwach.length, "Schrift auf jedem Schild ≥ 4,5:1 (" + [...new Set(farben.map(x => x.art))].join(", ") + ")", schwach);
    const neuBestellt = await p.evaluate(() => { bestellungen.push({ id: "x10", quelle: "tisch", status: "neu", tisch: "6", zeitpunkt: new Date().toISOString(), positionen: [{ name: "Z", menge: 1, preis: 4 }], summe: 4 }); zeichneAlles(); const g = document.querySelector('#spSvg [data-sp-tisch="demo-t6"] .sp-bel'); return g ? g.querySelector("text").textContent : null; });
    pruef(neuBestellt !== "frei", "nach „frei“ bestellt Tisch 6 neu → das Schild sagt nicht mehr „frei“", neuBestellt);
    const lbl = await p.evaluate(() => document.querySelector('#spSvg [data-sp-tisch="demo-t4"]').getAttribute("aria-label"));
    pruef(/5 Personen/.test(lbl) && /zahlt gerade/.test(lbl), "Vorleser: der Tisch nennt Personen und Zustand", lbl);
    pruef(pf.length === 0, "keine Seitenfehler", pf);
    await ctx.close();
  }

  /* ── 3 · Liste links ────────────────────────────────────────────── */
  console.log("\n══ 3 · Liste links ══");
  {
    const { ctx, p } = await neu(br, 1440, 900);
    await stelle(p);
    const l = await p.evaluate(() => ({
      gesamt: document.getElementById("spGesamt").hidden ? null : document.getElementById("spGesamt").textContent,
      bedarf: [...document.querySelectorAll("#spListe .sp-tz b")].map(b => b.textContent),
      ruhig: [...document.querySelectorAll("#spListe .sp-ruhig .sp-tr b")].map(b => b.textContent),
      zahl: document.getElementById("spListeZahl").textContent,
      plaetze6: SAAL.tische.find(t => t.nummer === "6").plaetze,
      frei: +((document.getElementById("spGesamt").textContent.match(/(\d+) freie/) || [])[1] || -1)
    }));
    pruef(l.gesamt && /^10 Gäste im Haus · \d+ freie Plätze$/.test(l.gesamt), "Gesamtzeile: 3 + 5 + 2 = 10 Gäste (nur eingetragene Personen)", l.gesamt);
    pruef(l.frei >= l.plaetze6, "der frei eingetragene Tisch 6 zählt zu den freien Plätzen", l.frei + " ≥ " + l.plaetze6);
    pruef(l.bedarf.includes("Tisch 4 · 5 Personen"), "Zeile mit Bedarf nennt die Personen (Tisch 4, Ruf)", l.bedarf);
    pruef(l.ruhig.length === 1 && l.ruhig[0] === "Tisch 9 · 2 Personen", "„Besetzt · alles gut“: genau Tisch 9 (eingetragen, kein Bedarf)", l.ruhig);
    pruef(!l.ruhig.some(x => x.startsWith("Tisch 4")) && l.bedarf.length === +l.zahl, "„Besetzt · alles gut“ wiederholt keinen Tisch mit Bedarf; die Zahl am Reiter zählt nur Bedarf", { ruhig: l.ruhig, zahl: l.zahl, bedarf: l.bedarf.length });
    const eigen = await p.evaluate(() => { const r = document.querySelector("#spListe .sp-ruhig"); return r ? { klasseTz: !!r.querySelector(".sp-tz"), h: [...r.querySelectorAll(".sp-tr")].map(b => b.getBoundingClientRect().height) } : null; });
    pruef(!eigen || (!eigen.klasseTz && eigen.h.every(h => h >= 44)), "„Besetzt“-Zeilen tragen eine eigene Klasse (nicht .sp-tz) und sind ≥ 44 px", eigen);
    await ctx.close();
  }

  /* ── 4 · Blatt des Tisches ──────────────────────────────────────── */
  console.log("\n══ 4 · Blatt des gewählten Tisches ══");
  {
    const { ctx, p, pf } = await neu(br, 1440, 900);
    await stelle(p);
    await p.evaluate(() => saalWaehlen(SAAL.tische.find(t => t.nummer === "1")));
    await p.waitForTimeout(250);
    const b0 = await p.evaluate(() => ({ sicht: !document.getElementById("spBeleg").hidden, zahl: document.getElementById("spBelZahl").textContent, text: document.getElementById("spBeleg").innerText }));
    pruef(b0.sicht && b0.zahl === "3" && /von 4 Plätzen/.test(b0.text), "Blatt: 3 Gäste von 4 Plätzen", b0.zahl);
    pruef(/1 Bestellung · 3 Gerichte · 16,20 €/.test(b0.text), "Summe dieses Besuchs aus den gestellten Bestellungen (2 + 1 Gerichte, 16,20 €)", b0.text.replace(/\n/g, " | "));
    pruef(/vom Service eingetragen/.test(b0.text) && /Besetzt seit/.test(b0.text), "Herkunft und „besetzt seit“ stehen da");
    const masse = await p.evaluate(() => [...document.querySelectorAll("#spBeleg button")].map(b => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height), Math.round(b.getBoundingClientRect().width)]));
    pruef(masse.length === 4 && masse.every(m => m[1] >= 44 && m[2] >= 44), "vier Knöpfe, jeder ≥ 44 × 44 px", masse);
    await p.click('#spBeleg [data-sp-bel="plus"]'); await p.waitForTimeout(150);
    let r = await p.evaluate(() => ({ rpc: window.__rpc.slice(), zahl: document.getElementById("spBelZahl").textContent, s: document.querySelector('#spSvg [data-sp-tisch="demo-t1"] .sp-bel text').textContent }));
    pruef(r.rpc.length === 1 && JSON.stringify(r.rpc[0]) === JSON.stringify({ fn: "tisch_belegung_setzen", a: { p_betrieb: "b-1", p_tisch: "1", p_personen: 4, p_stand: "da" } }), "„+“: genau ein Aufruf, Nutzlast {Betrieb, Tisch 1, 4, da}", r.rpc);
    pruef(r.zahl === "4" && r.s === "4/4", "Blatt und Schild zeigen 4", r);
    await p.click('#spBeleg [data-sp-bel="zahlt"]'); await p.waitForTimeout(150);
    r = await p.evaluate(() => ({ a: window.__rpc[1] && window.__rpc[1].a, gedr: document.querySelector('#spBeleg [data-sp-bel="zahlt"]').getAttribute("aria-pressed"), s: document.querySelector('#spSvg [data-sp-tisch="demo-t1"] .sp-bel text').textContent }));
    pruef(r.a && r.a.p_stand === "zahlt" && r.a.p_personen === 4 && r.gedr === "true" && r.s === "4/4 · zahlt", "„Zahlt gerade“: Stand zahlt, Personen bleiben, Knopf gedrückt", r);
    await p.click('#spBeleg [data-sp-bel="frei"]'); await p.waitForTimeout(150);
    r = await p.evaluate(() => ({ a: window.__rpc[2] && window.__rpc[2].a, s: document.querySelector('#spSvg [data-sp-tisch="demo-t1"] .sp-bel text') ? document.querySelector('#spSvg [data-sp-tisch="demo-t1"] .sp-bel text').textContent : null, minus: document.querySelector('#spBeleg [data-sp-bel="minus"]').disabled, frei: document.querySelector('#spBeleg [data-sp-bel="frei"]').disabled }));
    pruef(r.a && r.a.p_stand === "frei" && r.a.p_personen === 0 && r.s === "frei" && r.minus && r.frei, "„Tisch frei“: 0 Personen, Schild „frei“, − und „frei“ gesperrt", r);
    /* Server sagt nein → zurück + Satz */
    await p.evaluate(() => { window.__antworten.push({ ms: 10, r: { data: { ok: false, grund: "kein_recht" }, error: null } }); });
    await p.click('#spBeleg [data-sp-bel="plus"]'); await p.waitForTimeout(200);
    r = await p.evaluate(() => ({ zahl: document.getElementById("spBelZahl").textContent, satz: (document.querySelector("#spBeleg .sp-bel-satz") || {}).textContent, s: document.querySelector('#spSvg [data-sp-tisch="demo-t1"] .sp-bel text').textContent }));
    pruef(r.zahl === "0" && r.s === "frei" && /nur Mitglieder/.test(r.satz || ""), "Absage „kein_recht“: Stand zurück auf „frei“, Satz statt Erfolg", r);
    /* Wettlauf: ältere Antwort langsam, jüngere schnell — der jüngste Tipp entscheidet (§8.1ae) */
    await p.evaluate(() => {
      window.__antworten.push({ ms: 400, r: { data: { ok: true, personen: 1, stand: "da", seit: new Date().toISOString(), geaendert_um: new Date().toISOString() }, error: null } });
      window.__antworten.push({ ms: 20, r: { data: { ok: true, personen: 2, stand: "da", seit: new Date().toISOString(), geaendert_um: new Date().toISOString() }, error: null } });
    });
    await p.click('#spBeleg [data-sp-bel="plus"]'); await p.click('#spBeleg [data-sp-bel="plus"]'); await p.waitForTimeout(700);
    r = await p.evaluate(() => ({ zahl: document.getElementById("spBelZahl").textContent, s: document.querySelector('#spSvg [data-sp-tisch="demo-t1"] .sp-bel text').textContent }));
    pruef(r.zahl === "2" && r.s === "2/4", "zwei schnelle Tipps, die ältere Antwort kommt zuletzt: es bleibt 2", r);
    /* Ein Neuladen vom Server darf einen laufenden Tipp nicht überschreiben (§8.1p) */
    await p.evaluate(() => { window.__antworten.push({ ms: 400, r: { data: { ok: true, personen: 3, stand: "da", seit: new Date().toISOString(), geaendert_um: new Date().toISOString() }, error: null } }); });
    await p.click('#spBeleg [data-sp-bel="plus"]'); await p.waitForTimeout(30);
    const mitten = await p.evaluate(async () => { window.__belegung.find(z => z.tisch_nummer === "1").personen = 7; await saalBelegLaden("b-1"); saalZeichnen(); return document.getElementById("spBelZahl").textContent; });
    pruef(mitten === "3", "ein Neuladen während des Tipps setzt nicht den älteren Server-Stand (getippt 3, Server liefert noch 7)", mitten);
    await p.waitForTimeout(500);
    pruef(pf.length === 0, "keine Seitenfehler", pf);
    await ctx.close();
  }

  /* ── 4b · Migration fehlt ───────────────────────────────────────── */
  console.log("\n══ 4b · Migration fehlt ══");
  {
    const { ctx, p, pf } = await neu(br, 1440, 900);
    await stelle(p, true);
    const z = await p.evaluate(() => ({ schilder: [...document.querySelectorAll("#spSvg .sp-bel text")].map(t => t.textContent), gesamt: document.getElementById("spGesamt").hidden, ruhig: !!document.querySelector("#spListe .sp-ruhig"), fehlt: SAAL.belegFehlt }));
    pruef(z.fehlt && z.gesamt && !z.ruhig, "ohne Migration: keine Gesamtzeile, keine „Besetzt“-Zeilen", z);
    pruef(z.schilder.length === 2 && z.schilder.every(t => t === "still"), "ohne Migration nur „still“ an den beiden Tischen mit alten Bestellungen (6, 8) — keine Personen, kein „da“", z.schilder);
    await p.evaluate(() => saalWaehlen(SAAL.tische.find(t => t.nummer === "1"))); await p.waitForTimeout(200);
    await p.click('#spBeleg [data-sp-bel="plus"]'); await p.waitForTimeout(200);
    const r = await p.evaluate(() => ({ rpc: window.__rpc.length, satz: (document.querySelector("#spBeleg .sp-bel-satz") || {}).textContent, zahl: document.getElementById("spBelZahl").textContent }));
    pruef(r.rpc === 0 && /migration-tisch-belegung\.sql/.test(r.satz || "") && r.zahl === "0", "„+“ sendet nichts und nennt die fehlende Datei", r);
    pruef(pf.length === 0, "keine Seitenfehler", pf);
    await ctx.close();
  }

  /* ── 5 · Assistent ──────────────────────────────────────────────── */
  console.log("\n══ 5 · Assistent für einen leeren Saal ══");
  {
    const { ctx, p, pf } = await neu(br, 390, 844);
    await p.evaluate(() => { SAAL.tische.forEach(t => { t.x = null; t.y = null; }); SAAL.sig = ""; saalZeichnen(); });
    await p.waitForTimeout(200);
    const felder = await p.evaluate(() => ["spAsB", "spAsT", "spAsP"].map(id => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return [id, parseFloat(getComputedStyle(e).fontSize), Math.round(r.height)]; }));
    pruef(felder.every(f => f[1] >= 16 && f[2] >= 44), "drei Felder, je 16 px Schrift und ≥ 44 px hoch", felder);
    await p.fill("#spAsB", "abc"); await p.click('[data-sp-wz="assistent"]'); await p.waitForTimeout(150);
    const unsinn = await p.evaluate(() => ({ edit: SAAL.edit, satz: document.getElementById("spAsSatz").hidden ? null : document.getElementById("spAsSatz").textContent }));
    pruef(!unsinn.edit && /zwischen 2 und 60 Metern/.test(unsinn.satz || ""), "„abc“: Satz, kein Editor", unsinn);
    for(const falsch of ["1,5", "61", "12,25"]){
      await p.fill("#spAsB", falsch); await p.click('[data-sp-wz="assistent"]'); await p.waitForTimeout(80);
      pruef(!(await p.evaluate(() => SAAL.edit)), "„" + falsch + "“ wird abgewiesen (Grenzen wie die Datenbank: 2–60 m, eine Nachkommastelle)");
    }
    await p.fill("#spAsB", "9,5"); await p.fill("#spAsT", "7");
    await p.evaluate(() => { SAAL.sig = ""; saalZeichnen(); });
    pruef(await p.inputValue("#spAsB") === "9,5", "Getipptes übersteht ein Neuzeichnen des Plans");
    await p.click('[data-sp-wz="assistent"]'); await p.waitForTimeout(400);
    const a = await p.evaluate(() => {
      const r = saalRaumVon(SAAL.zone), pos = [...SAAL.entwurf.values()].filter(v => v.x != null);
      let naechst = 99;
      pos.forEach((v, i) => pos.forEach((w, j) => { if(i < j) naechst = Math.min(naechst, Math.hypot((v.x - w.x) / 100 * r.b, (v.y - w.y) / 100 * r.t)); }));
      return { edit: SAAL.edit, b: SAAL.konfigEntwurf.raeume[0].b, t: SAAL.konfigEntwurf.raeume[0].t, n: pos.length, drin: pos.every(v => v.x >= 0 && v.x <= 100 && v.y >= 0 && v.y <= 100), naechst, plaetze: [...new Set(pos.map(v => v.plaetze))], meldung: document.getElementById("meldung").textContent };
    });
    pruef(a.edit && a.b === 9.5 && a.t === 7, "Editor offen, Raum 9,5 × 7 m", a);
    pruef(a.n >= 4 && a.drin && a.naechst >= 2 && a.plaetze.join() === "4", "Tische im Raum, je ≥ 2 m auseinander, 4 Plätze", { n: a.n, naechst: a.naechst.toFixed(2) });
    pruef(/9,5 × 7 m angelegt, \d+ Tische verteilt/.test(a.meldung) && /ohne Platz/.test(a.meldung), "Meldung nennt Maße, verteilte Tische und die, die nicht hineinpassten", a.meldung);
    const ueber = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    pruef(ueber <= 0, "390 px: kein seitlicher Überlauf", ueber);
    pruef(pf.length === 0, "keine Seitenfehler", pf);
    await ctx.close();
  }

  /* ── 6 · Telefon ────────────────────────────────────────────────── */
  console.log("\n══ 6 · 360 px ══");
  {
    const { ctx, p, pf } = await neu(br, 360, 780);
    await stelle(p);
    await p.evaluate(() => saalWaehlen(SAAL.tische.find(t => t.nummer === "4"))); await p.waitForTimeout(250);
    const m = await p.evaluate(() => ({ ueber: document.documentElement.scrollWidth - innerWidth, blatt: document.getElementById("spBeleg").getBoundingClientRect().width, info: getComputedStyle(document.querySelector("#spBeleg .sp-bel-info")).color, grund: getComputedStyle(document.getElementById("spBeleg")).backgroundColor }));
    pruef(m.ueber <= 0 && m.blatt <= 360, "360 px: Blatt passt, kein Überlauf", m);
    pruef(kontrast(m.info, m.grund) >= 4.5, "Nebentext im Blatt ≥ 4,5:1", kontrast(m.info, m.grund).toFixed(2));
    pruef(pf.length === 0, "keine Seitenfehler", pf);
    await ctx.close();
  }

  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
