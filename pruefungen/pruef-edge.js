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
  env: { get(k: string): string | undefined };
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
  }
  export default Anthropic;
}
declare module "npm:@supabase/supabase-js@2" {
  export function createClient(a: string, b: string, c?: unknown): any;
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
    ? "\n✓ Beide Funktionen prüfen durch. (Nicht geprüft: der echte API-Lauf.)"
    : "\n✗ " + fehler + " Fehler.");
  process.exit(fehler ? 1 : 0);
})();
