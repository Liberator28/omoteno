/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Übersetzungen

     node pruefungen/pruef-sprache.js

   > Vorfall. Nach den Blöcken „Mein Tisch", „Top-Runner" und
   > „Weitersagen" standen 38 Sätze in ALLEN zwölf Sprachen auf
   > Deutsch. t() gibt bei fehlendem Eintrag stillschweigend das
   > Original zurück — das ist richtig für Eigennamen wie
   > „Nutella Crêpe", aber falsch für „Mein Tisch". Sichtbar wurde es
   > erst, wenn ein Gast die Sprache wechselte.

   Diese Prüfung liest jede Zeichenkette, die im Hub durch t() geht,
   und meldet, was im Wörterbuch fehlt oder unvollständig ist.

   Zwei Ausnahmen, ausdrücklich:
   - ZEICHEN wie „…" oder „{n}×" brauchen keine Übersetzung.
   - SPEISENAMEN stehen absichtlich nicht alle drin: „Nutella Crêpe"
     heißt überall so. Deshalb ist die Liste unten eine Liste von
     OBERFLÄCHENTEXTEN — was der Hub selbst sagt, nicht was auf der
     Karte steht. Namen aus der Datenbank kommen gar nicht hierher.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");

/* Das Geruest liegt in vorlagen/, eine Ebene hoeher. */
const DATEI = path.join(__dirname, "..", "vorlagen", "hub.vorlage.html");
if(!fs.existsSync(DATEI)){
  console.error("hub.vorlage.html nicht gefunden.");
  process.exit(1);
}
const s = fs.readFileSync(DATEI, "utf8");

/* Sprachen aus der Datei lesen, nicht hier doppelt pflegen — aber
   NUR aus dem SPRACHEN-Block. Frei gesucht traf das Muster auch ein
   Beispiel im Kommentar darüber, und „pl" stand zweimal in der
   Liste. Eine erfundene Sprache hätte die Prüfung Lücken melden
   lassen, die es nicht gibt. */
const sprBlock = (() => {
  const i = s.indexOf("const SPRACHEN = [");
  if(i < 0){ console.error("SPRACHEN nicht gefunden."); process.exit(1); }
  return s.slice(i, s.indexOf("];", i));
})();
const spr = [...sprBlock.matchAll(/code:"([a-z]{2})"/g)].map(m => m[1])
  .filter(c => c !== "de");

/* t("…") und t("…" + "…") — Verkettungen zusammenziehen, sonst gilt
   die halbe Zeichenkette als Schlüssel und die Prüfung lügt. */
const stueck = '(?:"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\')';
const ruf = new RegExp("\\bt\\(\\s*(" + stueck + "(?:\\s*\\+\\s*" + stueck + ")*)", "g");
const gebraucht = new Set();
for(const m of s.matchAll(ruf)){
  const teile = [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)]
    .map(x => (x[1] !== undefined ? x[1] : x[2]));
  /* \n und \" in Quelltextform wieder herstellen, wie es der
     Schlüssel im Wörterbuch auch ist. */
  gebraucht.add(teile.join(""));
}

const blk = s.slice(s.indexOf("const TEXTE = {"));
const schluessel = new Map();
for(const m of blk.matchAll(/^"((?:[^"\\]|\\.)*)"\s*:\s*\{([^\n]*)\}/gm)){
  schluessel.set(m[1], m[2]);
}

/* Was ohne Übersetzung auskommt: reine Zeichen und Platzhalter. */
const OHNE_WORT = /^[\s\p{P}\p{S}\d]*(\{[a-zäöüß]+\}[\s\p{P}\p{S}\d]*)*$/u;

let fehlt = [], luecken = [];
for(const k of [...gebraucht].sort()){
  if(OHNE_WORT.test(k)) continue;
  if(!schluessel.has(k)){ fehlt.push(k); continue; }
  const zeile = schluessel.get(k);
  const ohne = spr.filter(c => !new RegExp("\\b" + c + "\\s*:").test(zeile));
  if(ohne.length) luecken.push([k, ohne]);
}

/* Platzhalter müssen in jeder Sprache stehen — sonst fehlt dem Gast
   die Zahl oder der Name mitten im Satz. */
let platzhalter = [];
for(const [k, zeile] of schluessel){
  const soll = [...k.matchAll(/\{([a-zäöüß]+)\}/g)].map(m => m[0]);
  if(!soll.length) continue;
  for(const c of spr){
    const m = new RegExp(c + ':"((?:[^"\\\\]|\\\\.)*)"').exec(zeile);
    if(!m) continue;
    const fehlend = soll.filter(p => m[1].indexOf(p) < 0);
    if(fehlend.length) platzhalter.push([k, c, fehlend.join(" ")]);
  }
}

console.log("Sprachen (ohne Deutsch): " + spr.join(", "));
console.log("Oberflächentexte durch t(): " + gebraucht.size);
console.log("Einträge im Wörterbuch:     " + schluessel.size);

console.log("\n── Ohne jeden Eintrag ──");
if(!fehlt.length) console.log("  keine");
fehlt.forEach(k => console.log("  FEHLT  " + JSON.stringify(k.slice(0, 88))));

console.log("\n── Eintrag da, Sprache fehlt ──");
if(!luecken.length) console.log("  keine");
luecken.forEach(([k, o]) => console.log("  LÜCKE  " + o.join(",") + "  " +
  JSON.stringify(k.slice(0, 70))));

console.log("\n── Platzhalter verloren ──");
if(!platzhalter.length) console.log("  keine");
platzhalter.forEach(([k, c, p]) => console.log("  WEG    " + c + " " + p + "  " +
  JSON.stringify(k.slice(0, 60))));

const summe = fehlt.length + luecken.length + platzhalter.length;
console.log("\n" + (summe ? summe + " Punkt(e) zu klären." : "Alles sauber."));
process.exit(summe ? 1 : 0);
