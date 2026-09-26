/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Edge Functions typprüfen

     node pruefungen/pruef-edge.js

   WARUM ES DIESE PRÜFUNG BRAUCHT — und das ist der eigentliche Punkt:

   pruef-uebersetzung.js STELLT die Serverantwort (page.route). Sie
   prüft damit das Board gegen eine Erfindung, nicht gegen die
   Funktion. Und pruef-alessia.js macht dasselbe für den Telefonweg.
   Beide Hälften waren jahrelang grün, während niemand die Funktionen
   selbst angefasst hat — genau die Falle aus §8.1i: Zwei Hälften,
   jede gegen eine Erfindung der anderen geprüft, und die Erfindungen
   waren sich einig.

   Deno gibt es in dieser Arbeitsumgebung nicht (gemessen: `which
   deno` leer). Was es gibt, ist der TypeScript-Prüfer. Der findet
   kein falsches Verhalten — aber er findet jeden Tippfehler in einem
   Feldnamen, jede Variable, die es nicht gibt, und jede Form, die
   nicht zusammenpasst. Bei Code, der nie lokal läuft, ist das der
   Unterschied zwischen „gelesen" und „geprüft".

   EHRLICHE GRENZE, und sie ist groß: Diese Prüfung sagt NICHTS
   darüber, ob der Aufruf gegen die echte Anthropic-API durchgeht,
   ob das Modell antwortet, oder ob die Ablehnungsbehandlung greift.
   Der erste echte Lauf gehört dem Betreiber. Was sie sagt: Der Code
   ist in sich schlüssig, und kein Feldname ist verrutscht.
   ═══════════════════════════════════════════════════════════════════ */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const FUNKTIONEN = path.join(OBEN, "supabase", "functions");
let fehler = 0;
const ok = (g, t, z) => {
  console.log((g ? "  ok   " : "  FEHL ") + t + (z ? "  → " + z : ""));
  if(!g) fehler++;
};

/* Deno und npm:-Einfuhren kennt tsc nicht. Sie werden gestellt —
   knapp, aber typisiert genug, dass ein verrutschter Feldname
   auffällt. Ein `any` für das SDK wäre bequem und würde genau die
   Fehler durchlassen, um die es hier geht. */
const STELLEN = `
declare const Deno: {
  env: { get(k: string): string | undefined; toObject(): Record<string, string> };
  serve(h: (r: Request) => Response | Promise<Response>): void;
};
declare module "npm:@anthropic-ai/sdk" {
  interface Block { type: string; input?: unknown }
  interface Antwort {
    content: Block[];
    stop_reason?: string;
    stop_details?: { category?: string } | null;
    usage?: unknown;
  }
  class Anthropic {
    constructor(o: { apiKey: string });
    messages: { create(p: Record<string, unknown>): Promise<Antwort> };
    beta: { messages: { create(p: Record<string, unknown>): Promise<Antwort> } };
    models: { list(p?: Record<string, unknown>): Promise<unknown> };
  }
  export default Anthropic;
}
declare module "npm:@supabase/supabase-js@2" {
  export function createClient(a: string, b: string, c?: unknown): any;
}
declare module "jsr:@supabase/supabase-js@2" {
  export function createClient(a: string, b: string, c?: unknown): any;
}
declare module "npm:web-push@3.6.7" {
  const webpush: {
    setVapidDetails(mail: string, pub: string, priv: string): void;
    sendNotification(ziel: unknown, inhalt: string, opt?: unknown): Promise<unknown>;
  };
  export default webpush;
}
`;

function tscPfad(){
  for(const p of ["/opt/node22/bin/tsc", "tsc"]){
    try{ execFileSync(p, ["--version"], { stdio:"ignore" }); return p; }
    catch(e){}
  }
  return null;
}

(function(){
  console.log("\n══ Edge Functions ══");

  if(!fs.existsSync(FUNKTIONEN)){
    ok(false, "supabase/functions gefunden");
    process.exit(1);
  }
  const namen = fs.readdirSync(FUNKTIONEN)
    .filter(d => fs.existsSync(path.join(FUNKTIONEN, d, "index.ts")));
  ok(namen.length > 0, "Funktionen gefunden", namen.join(", "));

  /* ── Vorflug (CORS): Welche Kopfzeilen schickt der Browser? ──
     VORFALL: „uebersetzen“ erlaubte nur authorization, content-type,
     apikey. supabase-js schickt dazu x-client-info — der Browser brach
     nach dem OPTIONS ab, in den Logs stand nur „OPTIONS 200“, nie ein
     POST, und das Board sagte „keine Verbindung“. Der Schlüssel war
     nie das Problem. Derselbe Griff stand in „newsletter-vorrat-
     auffuellen“ (§8.1i: derselbe Griff steht selten nur einmal da).

     Zweite Quelle, nicht abgeschrieben: pruefungen/stand-supabase-
     cors.mjs ist die bytegleiche Datei dist/cors.mjs aus dem Paket
     @supabase/supabase-js (Stand 2.117.2) — die Liste, die die
     Bibliothek selbst als nötig ausgibt. Neue Fassung: `npm pack
     @supabase/supabase-js@2`, Datei ersetzen, diese Prüfung laufen
     lassen. Und welche Funktionen der Browser ruft, steht nicht hier,
     sondern wird aus den Seiten gelesen (functions.invoke, /functions/v1/). */
  const cors = fs.readFileSync(path.join(__dirname, "stand-supabase-cors.mjs"), "utf8");
  const listeRoh = (cors.match(/const SUPABASE_HEADERS = \[([\s\S]*?)\]/) || [])[1] || "";
  const pflicht = [...listeRoh.matchAll(/"([^"]+)"/g)].map(m => m[1].toLowerCase());
  ok(pflicht.includes("x-client-info") && pflicht.length >= 4,
     "die Kopfzeilen-Liste aus supabase-js ist gelesen", pflicht.join(", "));

  const gerufen = new Map();
  for(const ordner of ["seiten", "vorlagen"]){
    const wo = path.join(OBEN, ordner);
    if(!fs.existsSync(wo)) continue;
    for(const d of fs.readdirSync(wo).filter(d => d.endsWith(".html"))){
      const t = fs.readFileSync(path.join(wo, d), "utf8");
      for(const m of t.matchAll(/functions\.invoke\(\s*["'`]([a-z0-9-]+)["'`]|\/functions\/v1\/([a-z0-9-]+)/g)){
        const n = m[1] || m[2];
        if(!gerufen.has(n)) gerufen.set(n, []);
        gerufen.get(n).push(ordner + "/" + d);
      }
    }
  }
  ok(gerufen.size > 0, "die Seiten rufen Funktionen", [...gerufen.keys()].join(", "));

  for(const n of namen){
    const s = fs.readFileSync(path.join(FUNKTIONEN, n, "index.ts"), "utf8");
    const erlaubt = (s.match(/"Access-Control-Allow-Headers":\s*"([^"]*)"/) || [])[1];
    if(!gerufen.has(n) && erlaubt === undefined) continue; // nur vom Server gerufen
    ok(/method\s*===\s*"OPTIONS"/.test(s), "„" + n + "“ beantwortet den Vorflug (OPTIONS)");
    const hat = (erlaubt || "").toLowerCase().split(",").map(x => x.trim());
    const fehlt = pflicht.filter(h => !hat.includes(h));
    ok(fehlt.length === 0, "„" + n + "“ erlaubt jede Kopfzeile, die supabase-js schickt",
       fehlt.length ? "fehlt: " + fehlt.join(", ") + (gerufen.has(n) ? "  (gerufen aus " + gerufen.get(n).join(", ") + ")" : "") : "alle " + pflicht.length);
  }
  for(const [n, wo] of gerufen){
    ok(namen.includes(n), "die Seite ruft „" + n + "“ — und die Funktion liegt im Verzeichnis", wo.join(", "));
  }

  const tsc = tscPfad();
  if(!tsc){
    /* Eine Prüfung, die nicht startet, ist keine — aber sie darf auch
       nicht so tun, als hätte sie geprüft. */
    console.log("  ——   tsc nicht gefunden, übersprungen (nicht: bestanden)");
    process.exit(0);
  }

  /* Der SCHLÜSSEL darf in keiner dieser Dateien stehen. Das ist die
     eine Prüfung hier, die kein Typprüfer macht, und die wichtigste:
     Ein Schlüssel im Quelltext ist kein Geheimnis, sondern eine
     Rechnung, die jemand anders bezahlt. */
  for(const n of namen){
    const s = fs.readFileSync(path.join(FUNKTIONEN, n, "index.ts"), "utf8");
    const leck = s.match(/sk-ant-[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{30,}/g);
    ok(!leck, "„" + n + "“ trägt keinen Schlüssel im Quelltext",
       leck ? leck[0].slice(0, 14) + "…" : "keiner");
    ok(/Deno\.env\.get/.test(s) || !/apiKey|service_role/.test(s),
       "„" + n + "“ holt Geheimnisse aus der Umgebung");
  }

  const arbeit = fs.mkdtempSync(path.join(os.tmpdir(), "omoteno-edge-"));
  fs.writeFileSync(path.join(arbeit, "stellen.d.ts"), STELLEN);

  for(const n of namen){
    const ziel = path.join(arbeit, n + ".ts");
    fs.copyFileSync(path.join(FUNKTIONEN, n, "index.ts"), ziel);
    let aus = "";
    let gut = true;
    try{
      execFileSync(tsc, ["--noEmit", "--strict", "--target", "es2022",
        "--lib", "es2022,dom", "--module", "esnext",
        "--moduleResolution", "bundler",
        path.join(arbeit, "stellen.d.ts"), ziel],
        { stdio:["ignore", "pipe", "pipe"] });
    }catch(e){
      gut = false;
      aus = String((e.stdout || "") + (e.stderr || "")).trim();
    }
    ok(gut, "„" + n + "“ ist in sich schlüssig (tsc --strict)",
       gut ? "keine Beanstandung" : aus.split("\n").slice(0, 3).join(" | "));
  }

  console.log(fehler === 0
    ? "\n✓ Alle Funktionen prüfen durch. (Nicht geprüft: der echte API-Lauf.)"
    : "\n✗ " + fehler + " Fehler.");
  process.exit(fehler ? 1 : 0);
})();
