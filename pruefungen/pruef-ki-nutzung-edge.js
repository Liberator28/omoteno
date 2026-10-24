/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · KI-Nutzung in den Edge Functions uebersetzen und gericht-bild
   (beleg-lesen: Abschnitt 5 in pruef-beleg-lesen.js)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-ki-nutzung-edge.js

   Führt die ECHTEN index.ts aus (typescript, Deno / Anthropic / supabase-js /
   fetch gestellt). Geprüft wird, was die Funktionen TUN:
     · Standardmodell: die Anfrage an Claude ist OHNE Secret Zeichen für
       Zeichen die der Fassung von vor dieser Änderung (83ad407) — wer
       nichts einstellt, merkt nichts.
     · UEBERSETZER_MODELL: nur Namen aus der Liste; Opus 5.5 / Sonnet 5.5 /
       Haiku 5.5 bekommen KEIN erzwungenes Werkzeug (tool_choice tool = 400),
       Haiku keinen serverseitigen Ersatz; ein unbekannter Name geht NIE an
       Anthropic, sondern fällt auf den Standard.
     · Reihenfolge: Recht → Budget → Kontingent → Claude → Buchung.
     · Buchung: Token beider Anläufe summiert, auch bei Ablehnung; Fehler der
       Buchung blockiert nie die Antwort, wird aber als gebucht:false gemeldet.
     · Naht: gesendete Schlüssel = Parameter von ki_nutzung_buchen /
       ki_budget_stand in migration-ki-nutzung.sql; jedes Modell, das gebucht
       werden kann, steht im Preis-Seed der Migration.
     · gericht-bild: je gelieferten Bild eine Buchung, nichts bei Fehlschlag.

   EHRLICHE GRENZE: Nie gegen die echte Anthropic-/fal-API gelaufen. Ob ein
   Modell die Anfrage so akzeptiert (z. B. strict-Werkzeug mit auto), zeigt
   erst ein echter Lauf.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");
const ts = require("typescript");
const OBEN = path.join(__dirname, "..");
const FN = (n) => path.join(OBEN, "supabase", "functions", n, "index.ts");
const SQL = fs.readFileSync(path.join(OBEN, "datenbank", "migration-ki-nutzung.sql"), "utf8");

let fehler = 0, n = 0;
const ok = (g, t, z) => { n++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); if (!g) fehler++; };

const SPRACHEN = ["en", "tr", "ru", "fr", "es", "it", "pl", "ar", "uk", "nl", "ro"];
const BASIS = "83ad407";   /* letzter Stand VOR dieser Änderung */
const ALT = execSync(`git -C "${OBEN}" show ${BASIS}:supabase/functions/uebersetzen/index.ts`, { encoding: "utf8" });

const js = (text) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;

/* ── uebersetzen ──────────────────────────────────────────────────── */
function ladeUeb(quelle, opt) {
  const spur = [], anfragen = [], rpc = [];
  let handler = null, nummer = 0;
  class Anthropic {
    constructor() { spur.push("anthropic"); }
    get models() { return { list: async () => ({}) }; }
    get beta() { return { messages: { create: async (p) => {
      spur.push("claude"); anfragen.push(p); nummer++;
      if (opt.claudeWirft) throw Object.assign(new Error("boom"), { status: opt.claudeWirft });
      const usage = { input_tokens: 1000 * nummer, output_tokens: 500 * nummer, cache_read_input_tokens: nummer === 1 ? 50 : 0, cache_creation_input_tokens: 0 };
      if (opt.ablehnen) return { stop_reason: "refusal", stop_details: { category: "cyber" }, content: [], usage };
      const werkzeug = p.tools[0].input_schema.properties.saetze.items;
      const sprachen = werkzeug.required.filter((x) => x !== "deutsch");
      /* erster Anlauf lässt Französisch weg → zweiter Anlauf läuft (beide mit usage) */
      const liefern = (de) => { const z = { deutsch: de }; for (const sp of sprachen) if (!(opt.luecke && nummer === 1 && sp === "fr")) z[sp] = sp + ":" + de; return z; };
      const texte = [...p.messages[0].content.matchAll(/^\d+\. (.*)$/gm)].map((m) => m[1]);
      return opt.keinWerkzeug
        ? { stop_reason: "end_turn", content: [{ type: "text", text: "Hier" }], usage }
        : { stop_reason: "tool_use", content: [{ type: "tool_use", name: "uebersetzt", input: { saetze: texte.map(liefern) } }], usage };
    } } }; }
  }
  const supabase = { createClient: () => ({ rpc: async (name, args) => {
    spur.push("rpc:" + name); rpc.push({ name, args });
    if (name === "meine_betriebe") return { data: ["b-1"], error: null };
    if (name === "ist_master") return { data: false, error: null };
    if (name === "ki_budget_stand") return opt.budgetFehler ? { data: null, error: { code: "PGRST202" } } : { data: opt.budget ?? { ueber: false, warnung: false, hart: false }, error: null };
    if (name === "ki_kontingent_nehmen") return { data: opt.kontingent ?? 300, error: null };
    if (name === "ki_nutzung_buchen") return opt.buchenFehler ? { data: null, error: { code: "PGRST202" } } : { data: { gebucht: true, preis_fehlt: true }, error: null };
    return { data: null, error: null };
  } }) };
  const raum = {
    Deno: { env: { get: (k) => (opt.env || {})[k], toObject: () => ({ ...(opt.env || {}) }) }, serve: (h) => { handler = h; } },
    require: (m) => m === "npm:@anthropic-ai/sdk" ? { __esModule: true, default: Anthropic } : m === "npm:@supabase/supabase-js@2" ? supabase : null,
    exports: {}, module: { exports: {} }, Response, Request, JSON, Math, Number, Array, String, Date, Object, RegExp, Set, Promise, Error, console: { log() {}, error() {} },
  };
  vm.createContext(raum); vm.runInContext(js(quelle), raum);
  return { handler, spur, anfragen, rpc };
}
const ENV = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", ANTHROPIC_API_KEY: "sk-ant-api03-" + "A".repeat(40) };
const ueb = async (opt = {}, texte = ["Dubai Crepe", "Milchreis mit Ashta"], quelle) => {
  const f = ladeUeb(quelle ?? fs.readFileSync(FN("uebersetzen"), "utf8"), { ...opt, env: { ...ENV, ...(opt.env || {}) } });
  const r = await f.handler(new Request("https://f/uebersetzen", { method: "POST", headers: { authorization: "Bearer jwt" }, body: JSON.stringify({ texte }) }));
  return { ...f, status: r.status, a: await r.json() };
};

/* ── gericht-bild ─────────────────────────────────────────────────── */
const BETRIEB = "af095b14-d9ef-41f4-9b97-c4422b0de63f";
const QUELLE = "https://x.supabase.co/storage/v1/object/public/gerichte/" + BETRIEB + "/foto.jpg";
function ladeBild(opt) {
  const spur = [], rpc = [], fal = [];
  let handler = null;
  const kette = (wert) => { const p = new Proxy({}, { get(_, k) {
    if (k === "then") return (a, b) => Promise.resolve(wert).then(a, b);
    return () => p;
  } }); return p; };
  const supabase = { createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    from: (t) => {
      spur.push("db:" + t);
      if (t === "betriebe") { const p = new Proxy({}, { get(_, k) { return k === "maybeSingle" ? async () => ({ data: { id: BETRIEB, plan: null } }) : () => p; } }); return p; }
      if (t === "bild_auftraege") { const p = new Proxy({}, { get(_, k) { if (k === "insert") return async () => { spur.push("insert:bild_auftraege"); return { error: null }; }; if (k === "then") return (a, b) => Promise.resolve({ count: 0 }).then(a, b); return () => p; } }); return p; }
      return kette({ data: null });
    },
    rpc: async (name, args) => {
      spur.push("rpc:" + name); rpc.push({ name, args });
      if (name === "ki_budget_stand") return opt.budgetFehler ? { data: null, error: { code: "42883" } } : { data: opt.budget ?? { ueber: false, warnung: false, hart: false }, error: null };
      if (name === "ki_nutzung_buchen") return opt.buchenFehler ? { data: null, error: { code: "PGRST202" } } : { data: { gebucht: true }, error: null };
      return { data: null, error: null };
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: "https://x.supabase.co/storage/v1/object/public/gerichte/" + p } }) }) },
  }) };
  const fetchStell = async (url) => {
    if (String(url).startsWith("https://fal.run/")) {
      const modell = String(url).slice("https://fal.run/".length); fal.push(modell); spur.push("fal:" + modell);
      if ((opt.falFehlt || []).includes(modell)) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => modell.includes("birefnet") ? { image: { url: "https://fal.media/frei.png" } } : { images: [{ url: "https://fal.media/profi.jpg" }] } };
    }
    return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  const raum = {
    Deno: { env: { get: (k) => ({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", FAL_KEY: "fal-schluessel" })[k] }, serve: (h) => { handler = h; } },
    require: (m) => m === "npm:@supabase/supabase-js@2" ? supabase : null,
    exports: {}, module: { exports: {} }, Response, Request, JSON, Math, Number, Array, String, Date, Object, RegExp, Promise, Error, Uint8Array, AbortController, setTimeout, clearTimeout,
    fetch: fetchStell, console: { log() {}, error() {} },
  };
  vm.createContext(raum); vm.runInContext(js(fs.readFileSync(FN("gericht-bild"), "utf8")), raum);
  return { handler, spur, rpc, fal };
}
const bild = async (opt = {}) => {
  const f = ladeBild(opt);
  const r = await f.handler(new Request("https://f/gericht-bild", { method: "POST", headers: { Authorization: "Bearer jwt" }, body: JSON.stringify({ betrieb_id: BETRIEB, quelle: QUELLE, gericht: "Dubai Crepe" }) }));
  return { ...f, a: await r.json() };
};

const params = (name) => {
  const m = SQL.match(new RegExp("create or replace function public\\." + name + "\\(([\\s\\S]*?)\\)\\s*returns"));
  return m ? [...m[1].matchAll(/(p_\w+)/g)].map((x) => x[1]) : [];
};

(async () => {
  console.log("══ 1 · Standardmodell: nichts ändert sich ══");
  let neu = await ueb(), alt = await ueb({}, undefined, ALT);
  ok(neu.anfragen.length === 1 && alt.anfragen.length === 1, "ein Anlauf in beiden Fassungen", neu.anfragen.length + "/" + alt.anfragen.length);
  ok(JSON.stringify(neu.anfragen[0]) === JSON.stringify(alt.anfragen[0]), "Anfrage an Claude ohne Secret = Zeichen für Zeichen die von " + BASIS);
  ok(neu.anfragen[0].model === "claude-opus-5" && neu.anfragen[0].tool_choice.type === "tool" && neu.anfragen[0].fallbacks === "default", "Opus 5, erzwungenes Werkzeug, Ersatz bei Ablehnung");
  ok(neu.a.fertig === 2 && neu.a.uebersetzt["Dubai Crepe"].en === "en:Dubai Crepe", "Übersetzungen kommen an", JSON.stringify(neu.a).slice(0, 120));

  console.log("\n══ 2 · UEBERSETZER_MODELL ══");
  for (const [name, erzwingen, ersatz] of [["claude-opus-5-5", false, true], ["claude-sonnet-5-5", false, true], ["claude-haiku-5-5", false, false], ["claude-opus-5", true, true]]) {
    const r = await ueb({ env: { UEBERSETZER_MODELL: name } });
    const q = r.anfragen[0];
    ok(q.model === name, name + " wird angefragt", q.model);
    ok(erzwingen ? q.tool_choice.type === "tool" : q.tool_choice.type === "auto", name + ": tool_choice " + (erzwingen ? "tool (wie bisher)" : "auto — kein erzwungenes Werkzeug (400 bei Opus 5.5/Sonnet 5.5)"), JSON.stringify(q.tool_choice));
    ok(ersatz ? q.fallbacks === "default" && q.betas.includes("server-side-fallback-2026-07-01") : !("fallbacks" in q) && !("betas" in q), name + ": serverseitiger Ersatz " + (ersatz ? "ja" : "nicht gesendet"));
    ok(erzwingen || /Werkzeug "uebersetzt" aufrufst/.test(q.messages[0].content), name + ": Auftrag verlangt das Werkzeug namentlich (wo nicht erzwungen)");
    ok(q.tools[0].strict === true && q.thinking.type === "adaptive" && !("budget_tokens" in q.thinking) && !("temperature" in q), name + ": strict-Werkzeug, adaptives Denken, keine Sampling-Parameter");
    ok(r.a.fertig === 2, name + ": Antwort wird verarbeitet");
  }
  for (const schlecht of ["gpt-4o", "claude-opus-5\"; drop", "claude-opus-9", "CLAUDE-OPUS-5-5", "", "__proto__", "constructor"]) {
    const r = await ueb({ env: { UEBERSETZER_MODELL: schlecht } });
    ok(r.anfragen[0].model === "claude-opus-5", "ungültiger Wert " + JSON.stringify(schlecht) + " → Standard, nichts Fremdes an Anthropic", r.anfragen[0].model);
  }

  console.log("\n══ 3 · Reihenfolge: Recht → Budget → Kontingent → Claude → Buchung ══");
  let r = await ueb();
  const i = (s) => r.spur.indexOf(s);
  ok(i("rpc:meine_betriebe") < i("rpc:ki_budget_stand") && i("rpc:ki_budget_stand") < i("rpc:ki_kontingent_nehmen") && i("rpc:ki_kontingent_nehmen") < i("claude") && i("claude") < i("rpc:ki_nutzung_buchen"),
    "Reihenfolge stimmt", r.spur.join(" › "));
  r = await ueb({ budget: { ueber: true, warnung: true, hart: true } });
  ok(r.a.fehler === "budget" && !r.spur.includes("claude") && !r.spur.includes("rpc:ki_kontingent_nehmen") && !r.spur.includes("rpc:ki_nutzung_buchen") && r.status === 200,
    "hartes, erreichtes Budget → budget (200), KEIN Claude, KEIN Kontingent, keine Buchung", r.spur.join(","));
  r = await ueb({ budget: { ueber: true, warnung: true, hart: false } });
  ok(r.a.fertig === 2 && r.spur.includes("claude"), "weiches Budget, erreicht → übersetzt weiter");
  r = await ueb({ budget: { ueber: false, warnung: true, hart: true } });
  ok(r.a.fertig === 2, "hartes Budget, nur gewarnt (noch nicht erreicht) → übersetzt weiter");
  r = await ueb({ budgetFehler: true });
  ok(r.a.fertig === 2 && r.spur.includes("claude"), "Budget-Funktion fehlt → fail-open, wie bisher");
  r = await ueb({ kontingent: -1 });
  ok(r.a.fehler === "kontingent" && !r.spur.includes("claude"), "Kontingent leer → kontingent, kein Claude");

  console.log("\n══ 4 · Buchung ══");
  r = await ueb({ luecke: true });
  const b = r.rpc.filter((x) => x.name === "ki_nutzung_buchen");
  ok(r.anfragen.length === 2 && b.length === 1, "zwei Anläufe, EINE Buchung je Aufruf", r.anfragen.length + " Anläufe, " + b.length + " Buchungen");
  ok(b[0] && b[0].args.p_funktion === "uebersetzen" && b[0].args.p_modell === "claude-opus-5" && b[0].args.p_ein === 3000 && b[0].args.p_aus === 1500 && b[0].args.p_cache === 50,
    "Token beider Anläufe summiert (1000+2000 ein, 500+1000 aus, 50 aus dem Cache)", JSON.stringify(b[0] && b[0].args));
  ok(r.a.gebucht === true, "Antwort: gebucht:true");
  r = await ueb({ env: { UEBERSETZER_MODELL: "claude-haiku-5-5" } });
  ok(r.rpc.find((x) => x.name === "ki_nutzung_buchen").args.p_modell === "claude-haiku-5-5", "gebucht wird das Modell, das WIRKLICH lief");
  r = await ueb({ ablehnen: true });
  ok(r.a.fehler === "abgelehnt" && r.rpc.some((x) => x.name === "ki_nutzung_buchen") && r.a.gebucht === true, "Ablehnung hat Token gekostet → gebucht");
  r = await ueb({ keinWerkzeug: true });
  ok(r.a.fehler === "keine_antwort" && r.rpc.some((x) => x.name === "ki_nutzung_buchen"), "Antwort ohne Werkzeugaufruf (bei auto möglich) → keine_antwort, trotzdem gebucht");
  r = await ueb({ claudeWirft: 529 });
  ok(r.a.fehler === "ueberlastet" && !r.rpc.some((x) => x.name === "ki_nutzung_buchen") && r.a.gebucht === null, "Aufruf scheitert vor jeder Antwort → nichts verbraucht, nichts gebucht (gebucht:null)");
  r = await ueb({ buchenFehler: true });
  ok(r.a.fertig === 2 && r.a.gebucht === false, "Buchung scheitert (Migration fehlt) → Übersetzung kommt trotzdem, gebucht:false statt Schweigen", JSON.stringify(r.a).slice(0, 100));
  ok(r.status === 200, "…mit 200");

  console.log("\n══ 5 · Naht zur Migration ══");
  const gesendet = [...new Set(r.rpc.filter((x) => x.name === "ki_nutzung_buchen").flatMap((x) => Object.keys(x.args)))];
  ok(gesendet.length > 0 && gesendet.every((k) => params("ki_nutzung_buchen").includes(k)), "uebersetzen: gesendete Schlüssel = Parameter von ki_nutzung_buchen", gesendet.join(","));
  const bilder = await bild();
  const gesBild = [...new Set(bilder.rpc.filter((x) => x.name === "ki_nutzung_buchen").flatMap((x) => Object.keys(x.args)))];
  ok(gesBild.length > 0 && gesBild.every((k) => params("ki_nutzung_buchen").includes(k)), "gericht-bild: gesendete Schlüssel = Parameter von ki_nutzung_buchen", gesBild.join(","));
  const stand = bilder.rpc.filter((x) => x.name === "ki_budget_stand").flatMap((x) => Object.keys(x.args));
  ok(stand.every((k) => params("ki_budget_stand").includes(k)), "ki_budget_stand: gesendete Schlüssel = Parameter", stand.join(",") || "(keine)");
  const quelleUeb = fs.readFileSync(FN("uebersetzen"), "utf8");
  const modelle = [...quelleUeb.match(/const MODELLE[\s\S]*?\n\};/)[0].matchAll(/"(claude-[a-z0-9-]+)":/g)].map((x) => x[1]);
  const seed = new Set([...SQL.matchAll(/\('((?:claude|fal-ai)[^']*)',\s*'(?:token|bild)'/g)].map((x) => x[1]));
  ok(modelle.length === 4 && modelle.every((m) => seed.has(m)), "jedes wählbare Modell steht im Preis-Seed der Migration (sonst fehlte es im Master-Board)", modelle.filter((m) => !seed.has(m)).join(",") || modelle.join(","));
  ok(["fal-ai/birefnet/v2", "fal-ai/bria/product-shot"].every((m) => seed.has(m)), "beide fal-Modelle stehen im Seed");
  ok(quelleUeb.includes('claude.beta.messages.create') && !/service_role|SERVICE_ROLE/.test(quelleUeb), "kein Service-Schlüssel in der Funktion (§2.3a)");

  console.log("\n══ 6 · gericht-bild ══");
  r = await bild();
  const bb = r.rpc.filter((x) => x.name === "ki_nutzung_buchen");
  ok(r.a.frei && r.a.profi && bb.length === 2, "beide Bilder da → zwei Buchungen", r.a.teilweise ? "teilweise" : bb.length);
  ok(bb.every((x) => x.args.p_funktion === "bild_profi_frei" && x.args.p_bilder === 1 && x.args.p_ein === 0 && x.args.p_aus === 0 && x.args.p_betrieb === BETRIEB), "je Bild: Funktion bild_profi_frei, 1 Bild, keine Token, richtiger Betrieb");
  ok(JSON.stringify(bb.map((x) => x.args.p_modell).sort()) === JSON.stringify(["fal-ai/birefnet/v2", "fal-ai/bria/product-shot"]), "gebucht werden die zwei fal-Modelle");
  ok(r.a.gebucht === true, "Antwort: gebucht:true");
  const j = (s) => r.spur.indexOf(s);
  ok(j("rpc:ki_budget_stand") < j("insert:bild_auftraege") && j("insert:bild_auftraege") < j("fal:fal-ai/birefnet/v2") && j("fal:fal-ai/birefnet/v2") < j("rpc:ki_nutzung_buchen"),
    "Budget → Auftrag zählen → fal → Buchung", r.spur.join(" › "));
  r = await bild({ budget: { ueber: true, warnung: true, hart: true } });
  ok(r.a.fehler === "budget" && !r.spur.some((s) => s.startsWith("fal:")) && !r.spur.includes("insert:bild_auftraege") && !r.spur.includes("rpc:ki_nutzung_buchen"),
    "hartes, erreichtes Budget → budget, KEIN fal, kein gezählter Auftrag, keine Buchung", r.spur.join(","));
  r = await bild({ budget: { ueber: true, warnung: true, hart: false } });
  ok(r.a.frei && r.a.profi, "weiches Budget → Foto wird gemacht");
  r = await bild({ budgetFehler: true });
  ok(r.a.frei && r.a.profi, "Budget-Funktion fehlt → fail-open");
  r = await bild({ falFehlt: ["fal-ai/bria/product-shot"] });
  const b1 = r.rpc.filter((x) => x.name === "ki_nutzung_buchen");
  ok(r.a.frei && !r.a.profi && r.a.teilweise === true && b1.length === 1 && b1[0].args.p_modell === "fal-ai/birefnet/v2", "nur der Freisteller geliefert → nur der wird gebucht (fal berechnet, was es liefert)", JSON.stringify(b1.map((x) => x.args.p_modell)));
  r = await bild({ falFehlt: ["fal-ai/bria/product-shot", "fal-ai/birefnet/v2"] });
  ok(r.a.fehler === "anbieter" && !r.rpc.some((x) => x.name === "ki_nutzung_buchen"), "fal liefert nichts → anbieter, nichts gebucht");
  r = await bild({ buchenFehler: true });
  ok(r.a.frei && r.a.profi && r.a.gebucht === false, "Buchung scheitert → Fotos kommen trotzdem, gebucht:false", JSON.stringify(Object.keys(r.a)));

  console.log("\n" + (fehler ? fehler + " FEHLER" : "Alles grün.") + " (" + n + " Proben)");
  process.exit(fehler ? 1 : 0);
})();
