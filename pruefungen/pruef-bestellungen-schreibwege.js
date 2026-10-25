/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Schreibwege auf `bestellungen` gegen die vorbereitete Spaltenkürzung

     node pruefungen/pruef-bestellungen-schreibwege.js

   Hält drei Dinge gegeneinander (CLAUDE.md §2.3f, §8.1b — „eine Prüfung über das Vorhandene ist blind
   für das Fehlende“, darum zwei Richtungen):
     · der QUELLTEXT (admin.html, kueche.html, alle anderen Seiten, die Hub-Vorlage, die Edge Functions):
       jeder direkte Schreibweg auf bestellungen und jede Spalte, die er setzt
     · die WEGELISTE (dokumente/bestellungen-schreibwege.md)
     · das GRANT in datenbank/migration-bestellungen-spaltenrechte.sql
   Rot, sobald ein neuer Schreibweg oder eine neue Spalte auftaucht, die die Migration nicht kennt — und ebenso,
   wenn die Migration Rechte vergibt, die kein Weg nutzt (kleinste Rechte).

   EHRLICHE GRENZE: Das ist eine Lese-Prüfung des Quelltextes. Dynamisch zusammengesetzte Spaltennamen
   (felder[x] = …) sieht sie nicht — die Zählung der Schreibstellen macht das sichtbar (jede Stelle ist
   namentlich aufgeführt). Das Live-GRANT liest sie nicht; dafür stehen die Lesefragen im Kopf der Migration.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const OBEN = path.join(__dirname, "..");
const lies = (...p) => fs.readFileSync(path.join(OBEN, ...p), "utf8");

let bad = 0, n = 0;
const pruef = (g, t, z) => { n++; console.log((g ? "  ok   " : "  ROT  ") + t + (z !== undefined ? "  → " + (typeof z === "string" ? z : JSON.stringify(z)) : "")); if (!g) bad++; };

const BOARD = lies("seiten", "admin.html"), KUECHE = lies("seiten", "kueche.html");
const MIG = lies("datenbank", "migration-bestellungen-spaltenrechte.sql"), DOC = lies("dokumente", "bestellungen-schreibwege.md");

/* Text einer Funktion: ab ihrer Kopfzeile bis zur nächsten Funktion auf oberster Ebene. */
function funktion(text, kopf){
  const i = text.search(kopf); if (i < 0) return "";
  const rest = text.slice(i + 1), j = rest.search(/\n(?:async )?function \w+\(|\n\$\(["']#karten["']\)\.addEventListener/);
  return j < 0 ? rest : rest.slice(0, j);
}
const schluessel = literal => [...literal.matchAll(/(?:^|[,{\s])([a-z_]+)\s*:/g)].map(m => m[1]);

/* ── 1 · Die Schreibwege, einzeln benannt ─────────────────────────── */
const WEGE = [
  { name: "Board · statusSetzen → bestellungSchreiben", text: funktion(BOARD, /async function statusSetzen\(/),
    gefunden: t => [...t.matchAll(/\b(?:satz|felder)\.(\w+)\s*=/g)].map(m => m[1]).concat((t.match(/const satz = \{([^}]*)\}/) || ["", ""])[1] ? schluessel(t.match(/const satz = \{([^}]*)\}/)[1]).concat(["status"]) : []) },
  { name: "Board · bestaetigen (Zusage)", text: funktion(BOARD, /async function bestaetigen\(/),
    gefunden: t => schluessel((t.match(/bestellungSchreiben\(\{([^}]*)\}/) || ["", ""])[1]) },
  { name: "Board · pruefEntscheiden (freigeben / verwerfen)", text: funktion(BOARD, /async function pruefEntscheiden\(/),
    gefunden: t => schluessel(((t.match(/const felder = [^\n]*/) || [""])[0]).replace(/^const felder = /, "").replace(/[?:]\s*\{/g, ",{")) },
  { name: "Board · abholGebracht", text: funktion(BOARD, /async function abholGebracht\(/),
    gefunden: t => schluessel((t.match(/\.update\(\{([^}]*)\}\)/) || ["", ""])[1]) },
  { name: "Board · Team-Modus (zuweisen)", text: BOARD.slice(BOARD.indexOf('$("#karten").addEventListener("change", async e => {\n  const sel = e.target.closest("[data-tmzuw]")'), BOARD.indexOf('$("#karten").addEventListener("change", async e => {\n  const sel = e.target.closest("[data-tmzuw]")') + 900),
    gefunden: t => schluessel((t.match(/\.update\(\{([^}]*)\}\)/) || ["", ""])[1]) },
  { name: "Küche · ausfuehren → setzeBon", text: funktion(KUECHE, /function ausfuehren\(/),
    gefunden: t => [...t.matchAll(/\bfelder\.(\w+)\s*=/g)].map(m => m[1]) },
];
const grantText = (MIG.match(/grant update \(([\s\S]*?)\)\s*on public\.bestellungen/) || ["", ""])[1];
const GRANT = grantText.split(",").map(x => x.trim()).filter(Boolean).sort();

console.log("══ 1 · Jeder Schreibweg einzeln ══");
const alle = new Set();
for (const w of WEGE) {
  const cols = [...new Set(w.gefunden(w.text))].sort();
  cols.forEach(c => alle.add(c));
  pruef(w.text.length > 200 && cols.length > 0, w.name + ": gefunden, setzt " + cols.length + " Spalten", cols.join(","));
  pruef(cols.every(c => GRANT.includes(c)), w.name + ": jede Spalte steht im GRANT der Migration", cols.filter(c => !GRANT.includes(c)).join(",") || "alle");
}

console.log("\n══ 2 · Nichts Weiteres schreibt direkt (die Zählung der Schreibstellen) ══");
const zaehle = (text, re) => (text.match(re) || []).length;
const SEITEN = fs.readdirSync(path.join(OBEN, "seiten")).filter(f => f.endsWith(".html"));
const schreibstellen = {};
for (const f of SEITEN) {
  const t = lies("seiten", f);
  const c = zaehle(t, /from\(\s*["']bestellungen["']\s*\)\s*\.(?:update|insert|upsert|delete)\(/g);
  const r = zaehle(t, /["'`]\/rest\/v1\/bestellungen[?"'`][^;]*?method\s*:\s*["']?(?:PATCH|POST|PUT|DELETE)/g) + zaehle(t, /\/rest\/v1\/bestellungen\?id=eq\./g);
  if (c || r) schreibstellen[f] = { supabaseJs: c, rest: r };
}
pruef(JSON.stringify(schreibstellen) === JSON.stringify({ "admin.html": { supabaseJs: 3, rest: 0 }, "kueche.html": { supabaseJs: 0, rest: 1 } }),
  "genau drei Stellen im Board (supabase-js) und eine in der Küche (REST) — jede steht oben namentlich", schreibstellen);
const hub = lies("vorlagen", "hub.vorlage.html");
pruef(zaehle(hub, /from\(\s*["']bestellungen["']\s*\)\s*\.(?:update|insert|upsert|delete)\(/g) === 0 && !/rest\/v1\/bestellungen[^"'`]*["'`][^;]{0,160}PATCH/.test(hub), "der Gast-Hub schreibt nie direkt in bestellungen (nur über Funktionen)");
const fn = fs.readdirSync(path.join(OBEN, "supabase", "functions"));
const edgeSchreiber = fn.filter(d => {
  const f = path.join(OBEN, "supabase", "functions", d, "index.ts");
  return fs.existsSync(f) && /from\(\s*["']bestellungen["']\s*\)\s*\.(?:update|insert|upsert|delete)\(/.test(fs.readFileSync(f, "utf8"));
});
pruef(edgeSchreiber.length === 0, "keine Edge Function schreibt direkt in bestellungen", edgeSchreiber.join(",") || "keine");

console.log("\n══ 3 · Wegeliste, Quelltext und GRANT sind dieselbe Menge ══");
const quelltext = [...alle].sort();
pruef(JSON.stringify(quelltext) === JSON.stringify(GRANT), "die Vereinigung der Spalten im Quelltext = das GRANT der Migration (keine fehlt, keine ist überflüssig)", { quelltext, grant: GRANT });
const docSpalten = (DOC.match(/Vereinigung: \*\*(\d+) Spalten\*\* — ([^\n]*(?:\n[^\n]+)?)/) || []);
const docListe = (docSpalten[2] || "").match(/`(\w+)`/g) || [];
pruef(docListe.map(x => x.replace(/`/g, "")).sort().join() === GRANT.join() && Number(docSpalten[1]) === GRANT.length, "die Wegeliste im Dokument nennt dieselben Spalten und die richtige Zahl", docListe.length + " / " + docSpalten[1]);
pruef(GRANT.length === 9, "neun Spalten (gekürzt von 34)");
pruef(!/\b(summe|positionen|rabatt_betrag|betrieb_id|quelle|gast_kennung|liefergebuehr)\b/.test(grantText), "Preis, Summe, Positionen, Rabatt, Betrieb stehen NICHT im GRANT");
pruef(/EINGESPIELT am \d{2}\.\d{2}\.\d{4}/.test(MIG.split("\n")[1] || MIG.slice(0, 200)) && !/NOCH NICHT EINGESPIELT/.test(MIG.slice(0, 400)), "die Migration trägt im Kopf „EINGESPIELT am <Datum>“ (seit 25.10.2026 live) und nicht mehr „NOCH NICHT“");
const lesefragen = (MIG.match(/select column_name from information_schema\.column_privileges/g) || []).length + (MIG.match(/pg_trigger t join pg_proc/g) || []).length + (MIG.match(/not p\.prosecdef/g) || []).length;
pruef(lesefragen === 3, "die drei Lesefragen vor dem Einspielen stehen im Kopf (Spalten-Ist, Trigger, Nicht-definer-Funktionen)", lesefragen);

console.log("\n" + (n - bad) + " von " + n + " ok");
console.log(bad ? bad + " ROT" : "Alles sauber.");
process.exit(bad ? 1 : 0);
