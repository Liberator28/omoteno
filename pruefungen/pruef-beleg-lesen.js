/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Edge Function beleg-lesen (Rechnung → Entwurf)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-beleg-lesen.js

   Führt die ECHTE supabase/functions/beleg-lesen/index.ts aus: mit
   typescript übersetzt, Deno, Anthropic-SDK und supabase-js gestellt.
   Geprüft wird, was die Funktion TUT, nicht was sie verspricht:
     · Reihenfolge: Recht → Datei → Hash → Schlüssel → Kontingent →
       Claude. Eine Abweisung vorne kostet hinten nichts (kein
       Kontingent, kein Modellaufruf).
     · Anfrage an Claude: Modell, KEIN erzwungenes Werkzeug (Opus 5.5
       lehnt tool_choice tool/any ab), strukturierte Ausgabe mit einem
       Schema, das die Regeln strenger Schemata einhält; Foto als
       image/jpeg, PDF als document — mit den Bytes der Datei.
     · Zuordnung: Lieferant über den Namen, gelernte Bezeichnungen →
       Artikel + Gebinde, unbekannte bleiben offen; null bleibt null.
     · Naht: was an beleg_speichern geht, liest die SQL (zweite Quelle
       migration-einkauf-e2.sql / migration-einkauf.sql); die Arten im
       Schema = CHECK der Positionen.

   EHRLICHE GRENZE: Ob Claude eine echte Rechnung richtig liest, zeigt
   nur ein echter Lauf mit Schlüssel. Das prüft diese Datei nicht.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const ts = require("typescript");
const OBEN = path.join(__dirname, "..");
const QUELLE = path.join(OBEN, "supabase", "functions", "beleg-lesen", "index.ts");
const SQL1 = fs.readFileSync(path.join(OBEN, "datenbank", "migration-einkauf.sql"), "utf8");
const SQL2 = fs.readFileSync(path.join(OBEN, "datenbank", "migration-einkauf-e2.sql"), "utf8");

let fehler = 0, n = 0;
const ok = (g, t, z) => { n++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); if (!g) fehler++; };

const BETRIEB = "af095b14-d9ef-41f4-9b97-c4422b0de63f";
const DATEI_ID = "3f2a9c10-1b2c-4d3e-8f40-5a6b7c8d9e0f";
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("probe-jpeg-inhalt")]);
const PDF = Buffer.from("%PDF-1.4\n%probe\n");

const GELESEN = {
  lesbar: true, lieferant: "METRO Frankfurt", belegnummer: "R-77", belegdatum: "2026-10-01",
  netto: 74, steuer: 14.06, brutto: 88.06,
  positionen: [
    { text: "Weißwein 0,75 l", art: "ware", menge: 12, einheit: "Flasche", menge_je_einheit: "0,75 l", netto: 54, steuersatz: 19 },
    { text: "Mehl Type 405", art: "ware", menge: 2, einheit: "Sack", menge_je_einheit: "25 kg", netto: 20, steuersatz: 7 },
    { text: "Pfand Kiste", art: "pfand", menge: 1, einheit: null, menge_je_einheit: null, netto: null, steuersatz: null },
    { text: "Irgendwas", art: "erfunden", menge: 1, einheit: null, menge_je_einheit: null, netto: 0.5, steuersatz: 19 },
  ],
};

/* Die Funktion laden. Imports werden über require gestellt. */
function laden(opt) {
  const js = ts.transpileModule(fs.readFileSync(QUELLE, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const spur = [];           /* Reihenfolge aller Außenaufrufe */
  const anfragen = [];       /* Anfragen an Claude */
  const rpc = [];
  let handler = null;
  class Anthropic {
    constructor(o) { spur.push("anthropic:" + (o.apiKey ? "schluessel" : "leer")); }
    get beta() {
      return { messages: { create: async (p) => {
        spur.push("claude"); anfragen.push(p);
        if (opt.claudeWirft) throw Object.assign(new Error("boom"), { status: opt.claudeWirft });
        if (opt.ablehnen) return { stop_reason: "refusal", content: [] };
        return { stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(opt.gelesen || GELESEN) }] };
      } } };
    }
  }
  const tabellen = {
    einkaufsbelege: opt.schon ? [{ id: "schon-da", betrieb_id: BETRIEB, datei_hash: null, status: "entwurf" }] : [],
    betriebe: [{ id: BETRIEB, organisation_id: "org-1" }],
    lieferanten: [{ id: "l-metro", name: "Metro Frankfurt", organisation_id: "org-1", aktiv: true }, { id: "l-andere", name: "Bäckerei", organisation_id: "org-1", aktiv: true }],
    artikel: [{ id: "a-wein", basiseinheit: "ml", aktiv: true, organisation_id: "org-1" }, { id: "a-mehl", basiseinheit: "g", aktiv: true, organisation_id: "org-1" }],
    lieferanten_artikel: [{ lieferant_id: "l-metro", artikel_id: "a-wein", bezeichnung: "WEISSWEIN 0,75 L".toLowerCase() === "x" ? "" : "Weißwein 0,75 l", einkaufseinheit: "Flasche", gebinde_basis: 750 }],
  };
  function abfrage(t) {
    const filter = [];
    const p = new Proxy({}, { get(_, k) {
      if (k === "then") return (a, b) => {
        spur.push("db:" + t);
        let z = tabellen[t] || [];
        for (const [art, sp, w] of filter) z = z.filter((r) => art === "eq" ? r[sp] === w : r[sp] !== w);
        if (t === "einkaufsbelege" && opt.schon) z = tabellen.einkaufsbelege;
        return Promise.resolve({ data: z, error: null }).then(a, b);
      };
      if (k === "eq" || k === "neq") return (sp, w) => { filter.push([k, sp, w]); return p; };
      return () => p;
    } });
    return p;
  }
  const supabase = {
    createClient: () => ({
      rpc: async (name, args) => {
        spur.push("rpc:" + name); rpc.push({ name, args });
        if (name === "ist_inhaber") return { data: opt.inhaber !== false, error: null };
        if (name === "ki_kontingent_nehmen") return { data: opt.kontingent ?? 300, error: null };
        if (name === "beleg_speichern") return { data: { ok: true, id: "be-neu" }, error: null };
        return { data: null, error: null };
      },
      from: (t) => abfrage(t),
      storage: { from: (eimer) => ({ download: async (pfad) => {
        spur.push("download:" + eimer + ":" + pfad);
        const b = opt.datei || JPEG;
        return opt.dateiFehlt ? { data: null, error: { message: "not found" } } : { data: new Blob([b]), error: null };
      } }) },
    }),
  };
  const raum = {
    Deno: { env: { get: (k) => (opt.env || {})[k], toObject: () => ({ ...(opt.env || {}) }) }, serve: (h) => { handler = h; } },
    require: (m) => m === "npm:@anthropic-ai/sdk" ? { __esModule: true, default: Anthropic } : m === "npm:@supabase/supabase-js@2" ? supabase : null,
    exports: {}, module: { exports: {} },
    Response, Request, Blob, JSON, Math, Number, Array, String, Date, Object, RegExp, Uint8Array, Promise, SyntaxError, Error,
    btoa, crypto: globalThis.crypto, console: { log() {}, error() {} },
  };
  vm.createContext(raum);
  vm.runInContext(js, raum);
  return { handler, spur, anfragen, rpc };
}
const ENV = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", ANTHROPIC_API_KEY: "sk-ant-api03-" + "A".repeat(40) };
const anfrage = (koerper) => new Request("https://f/beleg-lesen", { method: "POST", headers: { authorization: "Bearer jwt" }, body: JSON.stringify(koerper) });
const PFAD = BETRIEB + "/" + DATEI_ID + ".jpg";
async function lauf(opt, koerper = { betrieb_id: BETRIEB, pfad: PFAD }) {
  const f = laden({ env: ENV, ...opt });
  const r = await f.handler(anfrage(koerper));
  return { ...f, status: r.status, a: await r.json() };
}

(async () => {
  console.log("══ 1 · Abweisungen kosten nichts ══");
  let r = await lauf({}, { betrieb_id: BETRIEB, pfad: "cb560d8c-a72b-4687-b212-0a708c28ea62/" + DATEI_ID + ".jpg" });
  ok(r.a.grund === "datei" && r.spur.length === 0, "fremder Ordner → datei, nicht einmal die Datenbank gefragt", r.spur.join(","));
  r = await lauf({}, { betrieb_id: BETRIEB, pfad: BETRIEB + "/../x.jpg" });
  ok(r.a.grund === "datei", "Pfad mit ../ → datei");
  r = await lauf({ inhaber: false });
  ok(r.a.grund === "kein_recht" && !r.spur.some((s) => /download|kontingent|claude/.test(s)), "kein Inhaber → kein_recht, keine Datei, kein Kontingent", r.spur.join(","));
  r = await lauf({ dateiFehlt: true });
  ok(r.a.grund === "datei_fehlt" && !r.spur.includes("claude"), "Datei nicht da → datei_fehlt");
  r = await lauf({ datei: Buffer.from("GIF89a-kein-jpeg") });
  ok(r.a.grund === "typ" && !r.spur.includes("claude"), "Endung .jpg, Inhalt kein JPEG → typ");
  r = await lauf({ schon: true });
  ok(r.a.grund === "datei_doppelt" && r.a.beleg === "schon-da" && !r.spur.includes("rpc:ki_kontingent_nehmen") && !r.spur.includes("claude"),
    "schon gelesen → datei_doppelt mit Beleg, KEIN Kontingent, KEIN Claude", r.spur.join(","));
  r = await lauf({ env: { SUPABASE_URL: "x", SUPABASE_ANON_KEY: "y", ANTHROPIC_API_KEY: "" } });
  ok(r.a.grund === "kein_schluessel" && !r.spur.includes("rpc:ki_kontingent_nehmen"), "kein Schlüssel → kein_schluessel, Kontingent unberührt");
  r = await lauf({ kontingent: -1 });
  ok(r.a.grund === "kontingent" && !r.spur.includes("claude"), "Kontingent leer → kontingent, kein Claude");
  ok(r.status === 200, "Abweisungen mit 200 (sonst sähe die Seite den Grund nie)", r.status);

  console.log("\n══ 2 · Reihenfolge und Anfrage an Claude ══");
  r = await lauf({});
  const i = (s) => r.spur.indexOf(s);
  ok(i("rpc:ist_inhaber") < i("download:belege:" + PFAD) && i("download:belege:" + PFAD) < i("db:einkaufsbelege") &&
     i("db:einkaufsbelege") < i("rpc:ki_kontingent_nehmen") && i("rpc:ki_kontingent_nehmen") < i("claude") && i("claude") < i("rpc:beleg_speichern"),
     "Recht → Datei → Hash-Abgleich → Kontingent → Claude → Speichern", r.spur.join(" › "));
  const kont = r.rpc.find((x) => x.name === "ki_kontingent_nehmen");
  ok(kont && kont.args.p_anzahl >= 1 && kont.args.p_anzahl <= 25, "Kontingent im erlaubten Rahmen der Funktion (1–25)", kont && kont.args.p_anzahl);
  const q = r.anfragen[0];
  ok(q && q.model === "claude-opus-5-5", "Modell claude-opus-5-5", q && q.model);
  ok(q && !("tool_choice" in q) && !("tools" in q), "kein erzwungenes Werkzeug (Opus 5.5 lehnt tool_choice tool/any ab)");
  ok(q && q.output_config && q.output_config.format && q.output_config.format.type === "json_schema", "strukturierte Ausgabe über output_config.format");
  ok(q && q.thinking && q.thinking.type === "adaptive" && !("budget_tokens" in q.thinking), "adaptives Denken, kein budget_tokens");
  ok(q && q.fallbacks === "default" && (q.betas || []).includes("server-side-fallback-2026-07-01"), "Ersatzmodell bei Ablehnung (fallbacks default)");
  const inhalt = q && q.messages[0].content;
  ok(inhalt && inhalt[0].type === "image" && inhalt[0].source.media_type === "image/jpeg" && inhalt[0].source.data === JPEG.toString("base64") && inhalt[1].type === "text",
    "Foto: image/jpeg mit genau den Bytes der Datei, Bild vor Text");
  /* Strenges Schema: jedes Objekt ohne Zusatzfelder, required = alle Felder. */
  const schemaFehler = [];
  (function gehe(s, wo) {
    if (!s || typeof s !== "object") return;
    if (s.type === "object") {
      if (s.additionalProperties !== false) schemaFehler.push(wo + ": additionalProperties");
      const k = Object.keys(s.properties || {}).sort(), req = [...(s.required || [])].sort();
      if (JSON.stringify(k) !== JSON.stringify(req)) schemaFehler.push(wo + ": required ≠ properties");
      for (const [n, v] of Object.entries(s.properties || {})) gehe(v, wo + "." + n);
    }
    if (s.items) gehe(s.items, wo + "[]");
    for (const v of s.anyOf || []) gehe(v, wo);
  })(q && q.output_config.format.schema, "$");
  ok(!schemaFehler.length, "Schema: jedes Objekt streng (additionalProperties false, alle Felder required)", schemaFehler.join("; ") || "ok");
  const artenSchema = q.output_config.format.schema.properties.positionen.items.properties.art.enum;
  const artenSql = (SQL1.match(/art\s+text not null check \(art in \(([^)]*)\)\)/) || [])[1];
  ok(artenSql && JSON.stringify([...artenSchema].sort()) === JSON.stringify(artenSql.split(",").map((x) => x.trim().replace(/'/g, "")).sort()),
    "Arten im Schema = CHECK der Positionen (zweite Quelle)", artenSql);

  r = await lauf({ datei: PDF }, { betrieb_id: BETRIEB, pfad: BETRIEB + "/" + DATEI_ID + ".pdf" });
  const d = r.anfragen[0] && r.anfragen[0].messages[0].content[0];
  ok(d && d.type === "document" && d.source.media_type === "application/pdf" && d.source.data === PDF.toString("base64"), "PDF: document/application/pdf mit den Bytes");
  const sp = r.rpc.find((x) => x.name === "beleg_speichern");
  ok(sp && sp.args.p_daten.quelle === "pdf", "PDF wird als Quelle pdf gespeichert");

  console.log("\n══ 3 · Zuordnung und Naht zu beleg_speichern ══");
  r = await lauf({});
  const s = r.rpc.find((x) => x.name === "beleg_speichern");
  const dt = s && s.args.p_daten;
  ok(s && s.args.p_beleg === null && s.args.p_betrieb === BETRIEB, "neuer Entwurf im richtigen Betrieb");
  ok(dt.lieferant_id === "l-metro" && dt.notiz === null, "„METRO Frankfurt“ → Lieferant Metro Frankfurt (Groß/klein egal)", dt.lieferant_id);
  ok(dt.datei_pfad === PFAD && dt.datei_hash === crypto.createHash("sha256").update(JPEG).digest("hex") && dt.quelle === "foto", "Pfad, SHA-256 der Datei und Quelle foto");
  ok(dt.netto === 74 && dt.steuer === 14.06 && dt.brutto === 88.06 && dt.belegnummer === "R-77" && dt.belegdatum === "2026-10-01", "Kopfdaten übernommen");
  const [w, m, pf, x] = dt.positionen;
  ok(w.artikel_id === "a-wein" && w.gebinde_basis === 750 && w.gelernt === true, "gelernte Bezeichnung → Artikel und Gebinde 750 ml", JSON.stringify(w));
  ok(!m.artikel_id && m.gebinde_basis === null && m.gebinde_text === "25 kg", "unbekannte Ware bleibt offen, Gebinde als Text für den Menschen", JSON.stringify(m));
  ok(pf.art === "pfand" && pf.netto === null, "Pfand ohne Betrag bleibt null, nicht 0", JSON.stringify(pf));
  ok(x.art === "sonstiges", "unbekannte Art wird „sonstiges“, nicht durchgereicht", x.art);
  ok(r.a.ok === true && r.a.id === "be-neu" && r.a.positionen === 4 && r.a.zugeordnet === 1, "Antwort: ok, ID, 4 Positionen, 1 zugeordnet", JSON.stringify(r.a));
  const gelesenSql = new Set([...SQL2.matchAll(/p_daten\s*->>?\s*'(\w+)'/g)].map((y) => y[1]));
  const fremd = Object.keys(dt).filter((k) => !gelesenSql.has(k));
  ok(!fremd.length, "jeder Schlüssel von p_daten wird in beleg_speichern (E2) gelesen", fremd.join(",") || [...gelesenSql].join(","));
  const posSql = new Set([...SQL1.matchAll(/\bp\s*->>?\s*'(\w+)'/g)].map((y) => y[1]));
  const POS_NUR_ANZEIGE = ["gebinde_text", "gelernt"];
  const posFremd = [...new Set(dt.positionen.flatMap(Object.keys))].filter((k) => !posSql.has(k) && !POS_NUR_ANZEIGE.includes(k));
  ok(!posFremd.length, "jeder Positionsschlüssel wird in beleg_freigeben gelesen (Ausnahme gebinde_text, gelernt)", posFremd.join(",") || "alle");

  r = await lauf({ gelesen: { ...GELESEN, lieferant: "Neuer Händler GmbH" } });
  const dn = r.rpc.find((y) => y.name === "beleg_speichern").args.p_daten;
  ok(dn.lieferant_id === null && /Neuer Händler GmbH/.test(dn.notiz) && !dn.positionen[0].artikel_id, "unbekannter Lieferant: offen, Name in der Notiz, keine fremde Zuordnung");
  r = await lauf({ gelesen: { ...GELESEN, belegdatum: "01.10.2026" } });
  ok(r.rpc.find((y) => y.name === "beleg_speichern").args.p_daten.belegdatum === null, "Datum in falscher Form → null statt Fehler");

  console.log("\n══ 4 · Ablehnung, Fehler, Unlesbares ══");
  r = await lauf({ ablehnen: true });
  ok(r.a.grund === "abgelehnt" && !r.rpc.some((y) => y.name === "beleg_speichern"), "Ablehnung → abgelehnt, nichts gespeichert");
  r = await lauf({ gelesen: { ...GELESEN, lesbar: false, positionen: [] } });
  ok(r.a.grund === "unlesbar" && !r.rpc.some((y) => y.name === "beleg_speichern"), "unlesbar → unlesbar, nichts gespeichert");
  r = await lauf({ claudeWirft: 401 });
  ok(r.a.grund === "schluessel_ungueltig", "401 → schluessel_ungueltig");
  r = await lauf({ claudeWirft: 529 });
  ok(r.a.grund === "ueberlastet", "529 → ueberlastet");

  console.log("\n" + (fehler ? fehler + " FEHLER" : "Alles grün.") + " (" + n + " Proben)");
  process.exit(fehler ? 1 : 0);
})();
