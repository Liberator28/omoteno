/* Sucht Flex-Zeilen mit mehreren Textkindern, die NICHT umbrechen
   dürfen, und Rasterspuren ohne minmax(0,…). Genau diese beiden
   Muster haben die Landingpage auf dem Telefon seitlich schiebbar
   gemacht. */
const fs = require("fs");
const path = require("path");
/* Ohne Argument die Webseite neben sich — der alte Vorgabename
   existiert nicht mehr und ergab beim Aufruf ohne Argument ENOENT. */
const ziel = process.argv[2] ||
  ["omoteno-web.html","omoteno-landingpage.html"]
    .map(n => path.join(__dirname, n)).find(fs.existsSync);
if(!ziel || !fs.existsSync(ziel)){
  console.error("Keine Datei angegeben und keine Webseite neben dem Skript gefunden.");
  process.exit(1);
}
const s = fs.readFileSync(ziel, "utf8");
const css = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join("\n");

const regeln = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .map(m => ({ sel: m[1].trim().replace(/\s+/g, " "), body: m[2] }))
  .filter(r => !r.sel.startsWith("@") && !r.sel.startsWith("/*"));

console.log("── Flex ohne Umbruch ──");
let flexOffen = 0;
regeln.forEach(r => {
  if(!/display:\s*flex/.test(r.body)) return;
  if(/flex-wrap/.test(r.body)) return;
  if(/flex-direction:\s*column/.test(r.body)) return;
  if(/overflow-x:\s*(auto|scroll)/.test(r.body)) return;
  flexOffen++;
  console.log("   " + r.sel);
});
console.log("   → " + flexOffen + " Zeilen ohne Umbruch (jede einzeln beurteilen)");

console.log("\n── Rasterspuren, die wachsen können ──");
let offen = 0;
regeln.forEach(r => {
  const m = r.body.match(/grid-template-columns:\s*([^;]+)/);
  if(!m) return;
  const wert = m[1].trim();
  if(!/\bfr\b/.test(wert)) return;
  if(/minmax\(\s*0/.test(wert)) return;
  if(/^(1fr|repeat\([^)]*1fr[^)]*\))$/.test(wert) && !/auto/.test(wert)) {
    // 1fr allein: min-width ist auto -> kann wachsen
    offen++;
    console.log("   " + r.sel + "  →  " + wert);
  }
});
console.log("   → " + offen + " Spur(en) ohne minmax(0,…)");

console.log("\n── Feste Breiten über 360px ──");
/* (?<![-a-z]) schliesst max-width und min-width aus. Ohne das meldete
   die Pruefung 24 harmlose max-width-Angaben — und eine Pruefung mit
   Fehlalarmen bringt einem bei, sie zu uebergehen. */
let breit = 0;
regeln.forEach(r => {
  const m = r.body.match(/(?<![-a-z])width:\s*(\d{3,4})px/);
  if(!m) return;
  const px = Number(m[1]);
  if(px <= 360) return;
  if(/max-width|@media/.test(r.sel)) return;
  breit++;
  console.log("   " + r.sel + "  →  " + px + "px");
});
console.log("   → " + breit + " feste Breite(n)");

console.log("\n── Abschnittsklassen als Zusatzklasse missbraucht ──");
const abschnitte = [...s.matchAll(/<section class="(?:tafel|blatt) ([a-z-]+)"/g)].map(m => m[1]);
/* Klassen einzeln vergleichen statt \b: In „theke-gitter" trifft \b
   auch „theke", weil der Bindestrich eine Wortgrenze ist. Nur ein
   exakt gleicher Klassenname ist eine echte Kollision. */
let geliehen = 0;
[...new Set(abschnitte)].forEach(a => {
  const treffer = [...s.matchAll(/class="([^"]+)"/g)]
    .map(m => m[1].trim().split(/\s+/))
    .filter(k => k.includes(a) && !(k.includes("tafel") || k.includes("blatt")));
  if(treffer.length){
    geliehen++;
    console.log("   ." + a + " auch als Zusatzklasse: " + treffer.slice(0,3).map(k => k.join(" ")).join("  |  "));
  }
});
console.log("   → " + geliehen + " geliehene(r) Abschnittsname(n)");
console.log("   (leer = keine geliehenen Klassennamen)");
