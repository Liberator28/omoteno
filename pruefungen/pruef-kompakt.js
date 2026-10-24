/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Kommentare aus der ausgelieferten Hub-Datei (erzeuger/kompakt.js)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-kompakt.js

   > 24.10.: „Die Seite ist relativ langsam … schneller, Qualität gleich.“
   Das Kürzen darf NUR Kommentare nehmen. Belegt wird das nicht durch
   „es läuft noch“, sondern durch den Vergleich des Codes vor und nach:
   TypeScripts Parser liest beide Fassungen, der Drucker schreibt den
   Syntaxbaum OHNE Kommentare aus — gleich oder nicht gleich. Dazu ein
   zweiter Weg, der nicht von einem Parser abhängt: Jeder Block der
   Datei wird als Skript übersetzt.

   1 · Jedes erzeugte Haus: Skript- und Stilblöcke == Quelle ohne Kommentare
       (AST-Vergleich für JS, Kommentar-Strippung gegen eine zweite
       Fassung für CSS).
   2 · Kein Block blieb ungekürzt (sonst stünde es als Hinweis im Erzeuger).
   3 · Knifflige Eingaben gegen den Parser: „/*“ in Zeichenkette, Regex mit
       Quote/Schrägstrichen, Schablone mit ${…} und Kommentar darin,
       Teilung statt Regex, Umbruch-Kommentar nach return, Zeilenende ohne
       Umbruch.
   4 · Größe: kürzer, und zwar um mindestens ein Sechstel des Skripts.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { kuerzeJs, kuerzeCss, kompaktHtml } = require("../erzeuger/kompakt");

const OBEN = path.join(__dirname, "..");
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

const druck = ts.createPrinter({ removeComments:true });
function baum(code){
  const sf = ts.createSourceFile("x.js", code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const fehler = sf.parseDiagnostics.length;
  return { text: druck.printFile(sf), fehler };
}
const bloecke = html => [...html.matchAll(/<(script|style)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi)]
  .filter(m => m[1].toLowerCase() === "style" || (!/\ssrc\s*=/.test(m[2] || "") && !/type\s*=\s*["']?(?!text\/javascript|module|application\/javascript)/i.test(m[2] || "")))
  .map(m => ({ tag:m[1].toLowerCase(), inhalt:m[3] }));

console.log("══ 3 · Knifflige Eingaben ══");
const FALL = {
  "Zeichenkette mit /*":        'var a = "/* kein Kommentar */"; // echt\nvar b = 1;',
  "Zeichenkette mit //":        'var u = "https://x.de/a"; /* weg */ var v = 2;',
  "Regex mit Quote":            'var r = /["\']+/g; /* weg */ var s = "x".replace(r, "");',
  "Regex mit //":               'var r = /a\\/\\/b/; // weg\nvar t = r.test("a//b");',
  "Regex in Klasse":            'var r = /[/*]x/; /* weg */ var q = 1;',
  "Teilung":                    'var a = 10, b = 2, c = a / b / 1; // weg\nvar d = (a + b) / 2;',
  "Schablone mit Kommentar":    'var t = `a ${ 1 /* weg */ + 2 } b // bleibt ${ "x" } c`; // weg',
  "Schablone verschachtelt":    'var t = `a ${ `b ${ 1 } /* bleibt */` } c`; /* weg */',
  "return und Umbruch-Kommentar": 'function f(){ return /* a\n b */ 1; }\n// weg\nf();',
  "Zeilenende ohne Umbruch":    'var a = 1; // weg',
  "Kommentar zwischen Wörtern": 'var a/*weg*/=1;\nvar b = a/*weg*/ + 1;',
  "ganze Zeilen":               '/* Kopf\n   mehr */\n// eins\n// zwei\nvar a = 1;\n   // eingerückt\n  /* auch */\nvar b = 2;\n',
  "Regex nach return":          'function g(s){ return /x\\/y/.test(s); } // weg',
  "Regex nach Klammer-Block":   'var a = [1]; var b = a.length / 2; var r = /a/.exec("a"); // weg',
  "Zeichenkette mit Apostroph": 'var a = "it\'s"; var b = \'a "b" c\'; // weg\nvar c = 3;'
};
for(const [name, code] of Object.entries(FALL)){
  const kurz = kuerzeJs(code);
  const a = baum(code), b = baum(kurz);
  pruef(a.fehler === 0 && b.fehler === 0 && a.text === b.text && kurz.length <= code.length, "JS: " + name, a.fehler + "/" + b.fehler + " Fehler, " + code.length + " → " + kurz.length);
}
const cssFall = 'a{b:"/* nein */"} /* weg */ c{d:e/* weg */f} /*\nweg\n*/\ng{h:url("x/*y*/z")}\n';
const cssKurz = kuerzeCss(cssFall);
pruef(/"\/\* nein \*\/"/.test(cssKurz) && /url\("x\/\*y\*\/z"\)/.test(cssKurz) && !/weg/.test(cssKurz), "CSS: Zeichenketten bleiben, Kommentare weg", JSON.stringify(cssKurz));

console.log("══ 1+2+4 · Jedes erzeugte Haus ══");
/* Die volle Fassung (mit Kommentaren) erzeugt die Prüfung selbst in ein eigenes Verzeichnis — dist/ bleibt, wie es ist
   (andere Prüfungen lesen es zugleich). Schlägt das Erzeugen fehl, ist die Prüfung rot, nicht still. */
const VOLL = fs.mkdtempSync(path.join(require("os").tmpdir(), "omoteno-voll-"));
const lauf = require("child_process").spawnSync("node", [path.join(OBEN, "erzeuger", "erzeuge-hub.js"), "--alle"],
  { env:Object.assign({}, process.env, { OMOTENO_OHNE_KOMPAKT:"1", OMOTENO_ZIEL:VOLL }), encoding:"utf8" });
pruef(lauf.status === 0, "volle Fassung (ohne Kürzen) erzeugt", String(lauf.stderr || "").slice(0, 120));
const HAEUSER = fs.readdirSync(path.join(OBEN, "dist")).filter(h => fs.existsSync(path.join(OBEN, "dist", h, "index.html")));
for(const haus of HAEUSER){
  const ist = fs.readFileSync(path.join(OBEN, "dist", haus, "index.html"), "utf8");
  /* Die volle Fassung ohne Kürzen: dieselbe Datei, nur ohne den Schritt. */
  const volle = path.join(VOLL, haus, "index.html");
  if(!fs.existsSync(volle)){ pruef(false, haus + ": volle Fassung fehlt"); continue; }
  const vorher = fs.readFileSync(volle, "utf8");
  pruef(vorher.length > ist.length, haus + ": die gelieferte Datei ist kürzer als die volle", Math.round(vorher.length / 1024) + " → " + Math.round(ist.length / 1024) + " KB");
  const A = bloecke(vorher), B = bloecke(ist);
  pruef(A.length === B.length && A.length >= 4, haus + ": gleich viele Blöcke", A.length + " / " + B.length);
  let gleich = 0, ungleich = [], laeuft = 0;
  for(let i = 0; i < Math.min(A.length, B.length); i++){
    if(A[i].tag === "script"){
      const x = baum(A[i].inhalt), y = baum(B[i].inhalt);
      if(x.fehler === 0 && y.fehler === 0 && x.text === y.text) gleich++; else ungleich.push("Skript " + i + " (" + x.fehler + "/" + y.fehler + ")");
      try{ new (require("vm").Script)(B[i].inhalt); laeuft++; }catch(e){ ungleich.push("Skript " + i + " übersetzt nicht"); }
    } else {
      const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
      /* Nur ein Vergleich, der Kommentare in Zeichenketten übersieht, wäre blind: Die Fälle oben prüfen das gezielt. */
      if(strip(A[i].inhalt) === strip(B[i].inhalt)) gleich++; else ungleich.push("Stil " + i);
    }
  }
  pruef(gleich === Math.min(A.length, B.length) && !ungleich.length, haus + ": jeder Block = voller Block ohne Kommentare (AST für Skript)", ungleich.join(", ") || gleich + " Blöcke");
  const js = (list) => list.filter(b => b.tag === "script").reduce((s, b) => s + b.inhalt.length, 0);
  pruef(js(B) <= js(A) * 0.85, haus + ": Skript um mindestens ein Sechstel kürzer", Math.round(js(A) / 1024) + " → " + Math.round(js(B) / 1024) + " KB");
}
console.log("\n" + (f ? f + " Fehler" : "Alles sauber.") + " (" + n + " Proben)");
fs.rmSync(VOLL, { recursive:true, force:true });
process.exit(f ? 1 : 0);
