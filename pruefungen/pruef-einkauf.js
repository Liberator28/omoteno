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

   E4 (Ketten, migration-einkauf-e4.sql): Gründe, Signaturen und
   gelesene Spalten gegen die Migration; lieferanten_artikel ohne die
   Preisspalte, die E4 dem Team entzieht (Spaltenrecht als zweite
   Quelle); Reiter „Standorte“ nur mit einer Kette, Zeitraum, höchster
   Wareneinsatz markiert; Zentrale ohne eigenen Betrieb sieht NUR die
   Zahlen und lädt keine Belege; „In anderen Standort übernehmen“ nur
   mit Inhaber-Recht in derselben Kette, jeder Grund als Satz.

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
const SQL3 = fs.readFileSync(path.join(OBEN, "datenbank", "migration-einkauf-e3.sql"), "utf8");
const SQL4 = fs.readFileSync(path.join(OBEN, "datenbank", "migration-einkauf-e4.sql"), "utf8");
const SQL5 = fs.readFileSync(path.join(OBEN, "datenbank", "migration-einkauf-e5a.sql"), "utf8");
const SQL6 = fs.readFileSync(path.join(OBEN, "datenbank", "migration-einkauf-e5b.sql"), "utf8");
const SQL8 = fs.readFileSync(path.join(OBEN, "datenbank", "migration-einkauf-e5c.sql"), "utf8");
const EDGE = fs.readFileSync(path.join(OBEN, "supabase", "functions", "beleg-lesen", "index.ts"), "utf8");
const HTML = fs.readFileSync(path.join(OBEN, "seiten", "einkauf.html"), "utf8");

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

/* ── 1 · Naht als Quelltext ─────────────────────────────────────── */
console.log("\n══ 1 · Naht zur Migration ══");
const gruendeSql = [...new Set([...(SQL + SQL2 + SQL3).matchAll(/'grund',\s*'(\w+)'/g)].map(m => m[1]))];
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
/* E5-C hat inventur_buchen um p_stichtag erweitert (alte Fassung im
   archiv) — es gilt die jüngste Migration, die die Funktion anlegt. */
{
  const SQL7 = fs.readFileSync(path.join(OBEN, "datenbank", "migration-einkauf-e5c.sql"), "utf8");
  const m = SQL7.match(/create or replace function public\.inventur_buchen\(([^)]*)\)/);
  if(m) SIGNATUR.inventur_buchen = m[1].split(",").map(x => x.trim().split(/\s+/)[0]).filter(Boolean).sort();
}
/* Der Pfad, den die Seite baut, muss durch die Prüfung der Funktion
   (zweite Quelle: die Regel in beleg-lesen) UND durch die Speicherregel. */
const PFAD_EDGE = (() => { const m = EDGE.match(/new RegExp\("\^" \+ betrieb \+ "\/" \+ UUID \+ "([^"]+)"\)/); return m ? JSON.parse('"' + m[1] + '"') : null; })();
pruef(!!PFAD_EDGE, "Pfadregel aus beleg-lesen gelesen", PFAD_EDGE);
pruef(Object.values(SIGNATUR).every(Boolean), "Signaturen aus der Migration gelesen", JSON.stringify(SIGNATUR));
const datenGelesen = new Set([...SQL.matchAll(/p_daten\s*->>?\s*'(\w+)'/g)].map(m => m[1]));
const posGelesen = new Set([...SQL.matchAll(/\bp\s*->>?\s*'(\w+)'/g)].map(m => m[1]));
const POS_NUR_SEITE = ["gebinde_text"];   /* namentlich: hält „0,75 l“ zum Wiederanzeigen */

/* E3: rezeptur_speichern, gericht_kalkulation, wareneinsatz_theoretisch */
function sqlParameter3(fn){
  const m = SQL3.match(new RegExp("function public\\." + fn + "\\(([^)]*)\\)"));
  return m ? m[1].split(",").map(s => s.trim().split(/\s+/)[0]).filter(Boolean).sort() : null;
}
for(const fn of ["rezeptur_speichern", "gericht_kalkulation", "wareneinsatz_theoretisch"]) SIGNATUR[fn] = sqlParameter3(fn);
const rezPosGelesen = new Set([...SQL3.matchAll(/\bz\s*->>?\s*'(\w+)'/g)].map(m => m[1]));
const felderSql3 = [...new Set([...SQL3.matchAll(/'feld',\s*'(\w+)'/g)].map(m => m[1]))];
const rezFeldSeite = (() => { const b = HTML.match(/const REZ_FELD = \{([\s\S]*?)\};/); return b ? [...b[1].matchAll(/(\w+):"/g)].map(m => m[1]) : []; })();
pruef(felderSql3.length >= 4 && felderSql3.every(f => rezFeldSeite.includes(f)), "E3: jedes 'feld' von rezeptur_speichern hat einen Satz", felderSql3.filter(f => !rezFeldSeite.includes(f)).join(", ") || felderSql3.join(","));
/* Spalten, die die Seite aus gericht_kalkulation liest = Spalten der Funktion. */
const kalkSpalten = (() => { const m = SQL3.match(/function public\.gericht_kalkulation[\s\S]*?returns table \(([\s\S]*?)\)\s*language/); return m ? m[1].split(",").map(x => x.trim().split(/\s+/)[0]) : []; })();
const kalkBlock = (HTML.match(/═══ Kalkulation \(E3[\s\S]*?\/\* ═══ /) || [""])[0];
const kalkGelesen = [...new Set([...kalkBlock.matchAll(/\bz\.(\w+)/g)].map(m => m[1]))];
const kalkFremd = kalkGelesen.filter(k => !kalkSpalten.includes(k));
pruef(kalkSpalten.length >= 10 && !kalkFremd.length, "E3: jede gelesene Spalte liefert gericht_kalkulation", kalkFremd.join(", ") || kalkGelesen.join(","));
const weSchluessel = [...new Set([...SQL3.matchAll(/'(\w+)',\s*(?:count|coalesce|round)/g)].map(m => m[1]))];
const weGelesen = [...new Set([...kalkBlock.matchAll(/\bwe\.(\w+)/g)].map(m => m[1]))];
pruef(weGelesen.length >= 3 && weGelesen.every(k => weSchluessel.includes(k)), "E3: jeder gelesene Wert liefert wareneinsatz_theoretisch", weGelesen.filter(k => !weSchluessel.includes(k)).join(", ") || weGelesen.join(","));
const rezSpalten = new Set([...(SQL3.match(/create table if not exists public\.rezepturen \(([\s\S]*?)\n\);/) || ["", ""])[1].matchAll(/^\s*(\w+)\s/gm)].map(m => m[1]));
const rezSelect = (HTML.match(/from\("rezepturen"\)\.select\("([^"]+)"/) || ["", ""])[1].replace(/\(.*\)/, "").split(",").map(x => x.trim()).filter(x => x && x !== "rezepturpositionen");
pruef(rezSelect.length >= 5 && rezSelect.every(c => rezSpalten.has(c)), "E3: gelesene Spalten von rezepturen gibt es", rezSelect.filter(c => !rezSpalten.has(c)).join(", ") || rezSelect.join(","));

/* E4: Ketten */
function fnKoerper(sql, fn){ const i = sql.indexOf("function public." + fn + "("); if(i < 0) return ""; const j = sql.indexOf("$function$;", i); return sql.slice(i, j < 0 ? undefined : j); }
function fnParameter(sql, fn){ const m = fnKoerper(sql, fn).match(/^function public\.\w+\(([^)]*)\)/); return m ? m[1].split(",").map(x => x.trim().split(/\s+/)[0]).filter(Boolean).sort() : null; }
function fnSpalten(sql, fn){ const m = fnKoerper(sql, fn).match(/returns table \(([\s\S]*?)\)\s*language/); return m ? m[1].split(",").map(x => x.trim().split(/\s+/)[0]) : []; }
const gruendeVon = (sql, fn) => [...new Set([...fnKoerper(sql, fn).matchAll(/'grund',\s*'(\w+)'/g)].map(m => m[1]))];
for(const fn of ["zentrale_vergleich", "rezeptur_uebertragen", "meine_ketten"]) SIGNATUR[fn] = fnParameter(SQL4, fn);
pruef(SIGNATUR.zentrale_vergleich && SIGNATUR.zentrale_vergleich.join() === "p_bis,p_org,p_von" && SIGNATUR.rezeptur_uebertragen && SIGNATUR.rezeptur_uebertragen.join() === "p_gericht,p_ziel_betrieb",
  "E4: Signaturen aus der Migration gelesen", JSON.stringify({ v:SIGNATUR.zentrale_vergleich, u:SIGNATUR.rezeptur_uebertragen }));
const uebGruendeSql = gruendeVon(SQL4, "rezeptur_uebertragen");
const uebGruendeSeite = (() => { const b = HTML.match(/const UEB_GRUENDE = \{([\s\S]*?)\n\};/); return b ? [...b[1].matchAll(/^\s*(\w+):/gm)].map(m => m[1]) : []; })();
pruef(uebGruendeSql.length >= 4 && uebGruendeSql.every(g => uebGruendeSeite.includes(g)), "E4: jeder Grund von rezeptur_uebertragen hat einen Satz", uebGruendeSql.filter(g => !uebGruendeSeite.includes(g)).join(", ") || uebGruendeSql.join(","));
/* Die übrigen E4-Funktionen der Seite (inventur_buchen, verlust_buchen
   in neuer Fassung) — die master_* gehören nach master.html. */
const e4SeitenGruende = ["inventur_buchen", "verlust_buchen"].flatMap(fn => gruendeVon(SQL4, fn));
pruef(e4SeitenGruende.length >= 4 && e4SeitenGruende.every(g => gruendeSeite.includes(g)), "E4: Gründe der neuen inventur_/verlust_buchen haben einen Satz", e4SeitenGruende.filter(g => !gruendeSeite.includes(g)).join(", ") || e4SeitenGruende.join(","));
const kettenBlock = (HTML.match(/═══ Ketten \(E4[\s\S]*?\/\* ═══ /) || [""])[0];
const vglSpalten = fnSpalten(SQL4, "zentrale_vergleich");
const vglGelesen = [...new Set([...(kettenBlock.match(/function standorteZeichnen[\s\S]*?\n\}/) || [""])[0].matchAll(/\bx\.(\w+)/g)].map(m => m[1]))];
pruef(vglSpalten.length >= 12 && vglGelesen.length >= 8 && vglGelesen.every(k => vglSpalten.includes(k)), "E4: jede gelesene Spalte liefert zentrale_vergleich", vglGelesen.filter(k => !vglSpalten.includes(k)).join(", ") || vglGelesen.join(","));
const kettenSpalten = fnSpalten(SQL4, "meine_ketten");
const kettenGelesen = [...new Set([...(kettenBlock.match(/async function kettenLaden[\s\S]*?\n\}/) || [""])[0].matchAll(/\bk\.(\w+)/g)].map(m => m[1]))];
pruef(kettenGelesen.length >= 2 && kettenGelesen.every(k => kettenSpalten.includes(k)), "E4: jede gelesene Spalte liefert meine_ketten", kettenGelesen.filter(k => !kettenSpalten.includes(k)).join(", ") || kettenGelesen.join(","));
/* Zweite Quelle Spaltenrecht: E4 gibt authenticated auf lieferanten_artikel
   nur noch diese Spalten. Liest die Seite eine andere, scheitert die GANZE
   Abfrage live mit 42501 — die gestellte Datenbank merkt das nicht. */
const laRecht = ((SQL4.match(/grant select \(([^)]*)\)\s*on public\.lieferanten_artikel/) || ["", ""])[1]).split(",").map(x => x.trim()).filter(Boolean);
const laSelect = ((HTML.match(/from\("lieferanten_artikel"\)\.select\("([^"]+)"/) || ["", ""])[1]).split(",").map(x => x.trim()).filter(Boolean);
pruef(laRecht.length >= 5 && laSelect.length >= 3 && laSelect.every(c => laRecht.includes(c)) && !laRecht.includes("letzter_preis"),
  "E4: lieferanten_artikel nur mit erlaubten Spalten gelesen (kein letzter_preis)", laSelect.filter(c => !laRecht.includes(c)).join(", ") || laSelect.join(","));

/* E5-A: neue Gründe, feste Preisreihenfolge */
const e5Gruende = ["beleg_speichern", "beleg_freigeben"].flatMap(fn => [...new Set([...((SQL5.match(new RegExp("create or replace function public\\." + fn + "\\([\\s\\S]*?\\nend \\$\\$;")) || [""])[0]).matchAll(/'grund',\s*'(\w+)'/g)].map(m => m[1]))]);
pruef(e5Gruende.includes("doppelt_standort") && e5Gruende.includes("datum") && e5Gruende.every(g => gruendeSeite.includes(g)),
  "E5-A: jeder Grund von beleg_speichern/beleg_freigeben hat einen Satz", e5Gruende.filter(g => !gruendeSeite.includes(g)).join(", ") || e5Gruende.join(","));
const viewSpalten = ((SQL5.match(/create or replace view public\.artikel_preise[\s\S]*?select([\s\S]*?)\bfrom\b/) || ["", ""])[1])
  .split(",").map(x => x.trim().split(/\s+/).pop().replace(/^\w+\./, "")).filter(Boolean);
const prSelect = ((HTML.match(/from\("artikel_preise"\)\.select\("([^"]+)"/) || ["", ""])[1]).split(",").map(x => x.trim());
pruef(prSelect.includes("freigegeben_am") && prSelect.includes("pos") && prSelect.every(c => viewSpalten.includes(c)),
  "E5-A: artikel_preise mit freigegeben_am und pos gelesen — jede Spalte gibt es in der Sicht", prSelect.filter(c => !viewSpalten.includes(c)).join(", ") || prSelect.join(","));
const prOrdnung = [...((HTML.match(/from\("artikel_preise"\)[\s\S]*?\.limit\(/) || [""])[0]).matchAll(/\.order\("(\w+)"/g)].map(m => m[1]).join(">");
const sqlOrdnung = [...((SQL5.match(/function public\.artikel_preis_betrieb[\s\S]*?limit 1/) || [""])[0]).matchAll(/pr\.(\w+) desc/g)].map(m => m[1]).join(">");
pruef(prOrdnung === sqlOrdnung && /freigegeben_am/.test(sqlOrdnung), "E5-A: Seite sortiert die Preise wie artikel_preis_betrieb", prOrdnung + " / " + sqlOrdnung);

/* E5-B: Umlagerung, Beleg verschieben, Standorte der Kette */
const e5bFn = ["umlagerung_anlegen", "umlagerung_annehmen", "umlagerung_zurueckziehen", "beleg_verschieben"];
const e5bKoerper = fn => (SQL6.match(new RegExp("create or replace function public\\." + fn + "\\([\\s\\S]*?\\nend \\$\\$;")) || [""])[0];
const e5bGruende = [...new Set(e5bFn.flatMap(fn => [...e5bKoerper(fn).matchAll(/'grund',\s*'(\w+)'/g)].map(m => m[1])))];
pruef(e5bGruende.length >= 8 && e5bGruende.every(g => gruendeSeite.includes(g)), "E5-B: jeder Grund der Umlagerungs-Funktionen hat einen Satz",
  e5bGruende.filter(g => !gruendeSeite.includes(g)).join(", ") || e5bGruende.join(","));
const posFelder = [...new Set(e5bFn.flatMap(fn => [...e5bKoerper(fn).matchAll(/'feld',\s*'(\w+)'/g)].map(m => m[1])))];
const posFeldSeite = (() => { const b = HTML.match(/const POS_FELD = \{([\s\S]*?)\n\};/); return b ? [...b[1].matchAll(/(\w+):"/g)].map(m => m[1]) : []; })();
pruef(posFelder.length >= 5 && posFelder.every(f => posFeldSeite.includes(f)), "E5-B: jedes 'feld' einer Position hat einen Satz", posFelder.filter(f => !posFeldSeite.includes(f)).join(", ") || posFelder.join(","));
const SIG6 = {};
for(const fn of [...e5bFn, "kette_standorte"]){
  const m = SQL6.match(new RegExp("function public\\." + fn + "\\(([^)]*)\\)"));
  SIG6[fn] = m ? m[1].split(",").map(x => x.trim().split(/\s+/)[0]).filter(Boolean).sort() : null;
}
pruef(Object.values(SIG6).every(Boolean), "E5-B: Signaturen aus der Migration gelesen", JSON.stringify(SIG6));
const tabSpalten = t => new Set([...((SQL6.match(new RegExp("create table if not exists public\\." + t + " \\(([\\s\\S]*?)\\n\\);")) || ["", ""])[1]).matchAll(/^\s*(\w+)\s/gm)].map(m => m[1]));
const umSel = ((HTML.match(/from\("umlagerungen"\)\.select\("([^"]+)"/) || ["", ""])[1]);
const umKopf = umSel.replace(/umlagerungspositionen\([^)]*\)/, "").split(",").map(x => x.trim()).filter(Boolean);
const umPosSel = ((umSel.match(/umlagerungspositionen\(([^)]*)\)/) || ["", ""])[1]).split(",").map(x => x.trim()).filter(Boolean);
pruef(umKopf.length >= 6 && umKopf.every(c => tabSpalten("umlagerungen").has(c)) && umPosSel.length >= 4 && umPosSel.every(c => tabSpalten("umlagerungspositionen").has(c)),
  "E5-B: gelesene Spalten von umlagerungen und -positionen gibt es", [...umKopf, ...umPosSel].filter(c => !tabSpalten("umlagerungen").has(c) && !tabSpalten("umlagerungspositionen").has(c)).join(", ") || "alle");

/* E5-C: Sortiment, Lieferanten je Standort, Zählung */
const e5cFn = ["artikel_standort_setzen", "lieferant_standort_setzen", "inventur_entwurf_sichern", "inventur_buchen"];
const e5cKoerper = fn => (SQL8.match(new RegExp("create or replace function public\\." + fn + "\\([\\s\\S]*?\\nend \\$\\$;")) || [""])[0];
const e5cGruende = [...new Set(e5cFn.flatMap(fn => [...e5cKoerper(fn).matchAll(/'grund',\s*'(\w+)'/g)].map(m => m[1])))];
pruef(e5cGruende.includes("stichtag") && e5cGruende.every(g => gruendeSeite.includes(g)), "E5-C: jeder Grund hat einen Satz",
  e5cGruende.filter(g => !gruendeSeite.includes(g)).join(", ") || e5cGruende.join(","));
const SIG8 = {};
for(const fn of e5cFn){ const m = SQL8.match(new RegExp("create or replace function public\\." + fn + "\\(([^)]*)\\)")); SIG8[fn] = m ? m[1].split(",").map(x => x.trim().split(/\s+/)[0]).filter(Boolean).sort() : null; }
pruef(Object.values(SIG8).every(Boolean), "E5-C: Signaturen gelesen", JSON.stringify(SIG8));
const tab8 = t => new Set([...((SQL8.match(new RegExp("create table if not exists public\\." + t + " \\(([\\s\\S]*?)\\n\\);")) || ["", ""])[1]).matchAll(/^\s*(\w+)\s/gm)].map(m => m[1]));
const sel8 = t => ((HTML.match(new RegExp('from\\("' + t + '"\\)\\.select\\("([^"]+)"')) || ["", ""])[1]).split(",").map(x => x.trim()).filter(Boolean);
const fremd8 = ["artikel_standort", "lieferanten_standort", "inventur_entwurf"].flatMap(t => sel8(t).filter(c => !tab8(t).has(c)).map(c => t + "." + c));
pruef(["artikel_standort", "lieferanten_standort", "inventur_entwurf"].every(t => sel8(t).length >= 3) && !fremd8.length, "E5-C: gelesene Spalten gibt es in den Tabellen", fremd8.join(", ") || "alle");
/* Jeder Schlüssel, den die Seite in p_daten schickt, wird in der SQL gelesen. */
const datenSql = fn => new Set([...e5cKoerper(fn).matchAll(/p_daten\s*->>?\s*'(\w+)'/g)].map(m => m[1]));
/* Aus dem Körper der Seiten-Funktion, die die SQL-Funktion ruft. */
const SEITEN_FN = { artikel_standort_setzen:"sortimentSichern", lieferant_standort_setzen:"liefStandortSichern" };
const datenSeite = fn => {
  const koerper = (HTML.match(new RegExp("async function " + SEITEN_FN[fn] + "\\([\\s\\S]*?\\n\\}")) || [""])[0];
  const b = (koerper.match(/const daten = \{([\s\S]*?)\};/) || ["", ""])[1];
  return [...b.replace(/\[[^\]]*\]|\([^)]*\)/g, "").matchAll(/(\w+):/g)].map(m => m[1]);
};
for(const fn of ["artikel_standort_setzen", "lieferant_standort_setzen"]){
  const ds = datenSeite(fn), dq = datenSql(fn);
  pruef(ds.length >= 3 && ds.every(k => dq.has(k)), "E5-C: jeder Schlüssel in p_daten von " + fn + " wird gelesen", ds.filter(k => !dq.has(k)).join(", ") || ds.join(","));
}

/* ── 2 · Gestellte Datenbank ────────────────────────────────────── */
const ORG = "org-1", BETRIEB = "af095b14-0000-4000-8000-000000000001";
const KEINE_RECHTE = { kennzahlen_tag:false, berichte_view:false, berichte_export:false, kosten_view:false, finanz_export:false, ziele_edit:false, ziele_approve:false };
/* Seit migration-zugriffsrechte.sql sieht den Einkauf nur, wer „Einkauf und Kalkulation“ hat: Besitzer immer, ein Manager nur
   nach Freigabe, Team und Küche nie. Wer „nur ansehen“ prüfen will, ist deshalb ein Manager mit diesem Recht. */
function grundDaten(rolle){
  const d = grundDaten0(rolle);
  if(rolle === "manager") d.antworten.meine_rechte = { rolle, rechte: Object.assign({}, KEINE_RECHTE, { kosten_view:true }) };
  return d;
}
function grundDaten0(rolle){
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
    ],
    /* E3: Tiramisu hatte einmal eine Rezeptur mit Wein (r-t-alt), heute
       keine — es darf bei einer Weinpreis-Änderung NICHT erscheinen. */
    rezepturen: [
      { id: "r-2", betrieb_id: BETRIEB, gericht_id: "g-pizza", gueltig_ab: "2026-10-12T08:00:00Z", portionen: 2, mwst: 7, notiz: "mehr Mehl",
        rezepturpositionen: [{ artikel_id: "a-mehl", menge_basis: 400, verlust_prozent: 10 }, { artikel_id: "a-wein", menge_basis: 300, verlust_prozent: 0 }] },
      { id: "r-1", betrieb_id: BETRIEB, gericht_id: "g-pizza", gueltig_ab: "2026-10-02T08:00:00Z", portionen: 2, mwst: 7, notiz: null,
        rezepturpositionen: [{ artikel_id: "a-mehl", menge_basis: 200, verlust_prozent: 10 }] },
      { id: "r-s", betrieb_id: BETRIEB, gericht_id: "g-sal", gueltig_ab: "2026-10-03T08:00:00Z", portionen: 1, mwst: 7, notiz: null,
        rezepturpositionen: [{ artikel_id: "a-wein", menge_basis: 100, verlust_prozent: 0 }] },
      { id: "r-t-alt", betrieb_id: BETRIEB, gericht_id: "g-tira", gueltig_ab: "2026-09-01T08:00:00Z", portionen: 1, mwst: 7, notiz: null,
        rezepturpositionen: [{ artikel_id: "a-wein", menge_basis: 50, verlust_prozent: 0 }] }
    ],
    antworten: {
      gericht_kalkulation: [
        { gericht_id: "g-pizza", name: "Pizza Margherita", kategorie: "Pizza", karte: "speisekarte", preis: 7, aktionspreis: 5.9, rezeptur_id: "r-2",
          gueltig_ab: "2026-10-12T08:00:00Z", mwst: 7, portionen: 2, kosten: 0.414, positionen: 2, ohne_preis: 0, wareneinsatz: 0.0633, wareneinsatz_aktion: 0.0751 },
        { gericht_id: "g-sal", name: "Salat", kategorie: "Salate", karte: "speisekarte", preis: 3.21, aktionspreis: null, rezeptur_id: "r-s",
          gueltig_ab: "2026-10-03T08:00:00Z", mwst: 7, portionen: 1, kosten: 1.2, positionen: 1, ohne_preis: 0, wareneinsatz: 0.4, wareneinsatz_aktion: null },
        { gericht_id: "g-tira", name: "Tiramisu", kategorie: "Dessert", karte: "speisekarte", preis: 5.5, aktionspreis: null, rezeptur_id: null,
          gueltig_ab: null, mwst: null, portionen: null, kosten: null, positionen: 0, ohne_preis: 0, wareneinsatz: null, wareneinsatz_aktion: null }
      ],
      wareneinsatz_theoretisch: { positionen: 5, portionen: 6, umsatz_brutto: 30, wareneinsatz: 0.85, umsatz_mit_rezeptur: 21, ohne_rezeptur: 2, ueber_namen: 1 }
    }
  };
}

function ersatz(start){
  return "(function(D){" + `
    window.__D = D;
    window.__rufe = [];            /* {name, args} */
    window.__schreib = [];         /* {tabelle, art, werte, filter} */
    window.__vorPin = 0; window.__pinOk = !D.pinPflicht;
    window.__lesen = [];
    const nutzer = { id:"u-1", email:"wirt@probe.de" };
    const sitzung = D.ohneSitzung ? null : { user:nutzer, access_token:"x" };
    function abfrage(tabelle){
      const q = { tabelle, filter:[], art:"select", werte:null };
      const fertig = () => {
        const langsam = D.langsam && q.filter.some(([k, v]) => k === "betrieb_id" && v === D.langsam);
        if(langsam) return new Promise(r => setTimeout(() => r(fertigJetzt()), D.langsamMs || 700));
        return fertigJetzt();
      };
      const fertigJetzt = () => {
        if(!window.__pinOk) window.__vorPin++;
        if(q.art !== "select"){
          window.__schreib.push({ tabelle, art:q.art, werte:q.werte, filter:q.filter });
          const f = (D.schreibFehler || {})[tabelle];
          return { data:null, error: f || null };
        }
        window.__lesen.push(tabelle);
        if((D.leseFehler || {})[tabelle]) return { data:null, error: D.leseFehler[tabelle] };
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
        if(D.langsam && args && args.p_betrieb === D.langsam) await new Promise(r => setTimeout(r, D.langsamMs || 700));
        if(name === "pin_status") return { data: D.pinPflicht ? { pflicht:true, ok:false, hat_pin:true, gesperrt:false } : { pflicht:false, ok:true }, error:null };
        if(name === "pin_pruefen"){ window.__pinOk = args.p_pin === "12345678"; return { data: window.__pinOk ? { ok:true } : { ok:false, grund:"falsch", verbleibend:4 }, error:null }; }
        if(name === "admin_anmelden") return { data:{ erlaubt:true }, error:null };
        if((D.rpcFehler || {})[name]) return { data:null, error: D.rpcFehler[name] };
        if(name === "meine_rechte" && D.rechteJe && args) return { data: D.rechteJe[args.p_betrieb] || { rolle:null, rechte:{} }, error:null };
        const a = (D.antworten || {})[name];
        if(a) return { data: JSON.parse(JSON.stringify(a)), error:null };
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
        download: async pfad => { window.__geladen = pfad; return D.dlFehler ? { data:null, error:{ message:"x" } } : { data: new Blob([new Uint8Array([0xff, 0xd8, 1, 2])]), error:null }; },
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
  pruef(/betrifft Pizza Margherita, Salat/.test(preis) && !/Tiramisu/.test(preis), "E3: Preisänderung nennt die betroffenen Gerichte — nur gültige Fassungen (Tiramisu nicht)", preis.replace(/\s+/g, " ").slice(0, 140));
  const we = { b: (await p.textContent("#kWe")).replace(/\s/g, " "), u: (await p.textContent("#kWeUnter")).replace(/\s/g, " ") };
  pruef(we.b === "0,85 €" && /4 % vom Bruttoumsatz/.test(we.u) && /2 verkaufte Positionen ohne Rezeptur/.test(we.u), "E3: Wareneinsatz des Monats mit Anteil und Lücke", JSON.stringify(we));
  const weRuf = (await rufe(p, "wareneinsatz_theoretisch"))[0];
  pruef(weRuf && JSON.stringify(Object.keys(weRuf.args).sort()) === JSON.stringify(SIGNATUR.wareneinsatz_theoretisch) && new Date(weRuf.args.p_von).getDate() === 1,
    "E3: wareneinsatz_theoretisch mit genau seinen Parametern, ab Monatsanfang", JSON.stringify(weRuf && weRuf.args));
  const kRuf = (await rufe(p, "gericht_kalkulation"))[0];
  pruef(kRuf && kRuf.args.p_betrieb === BETRIEB && Object.keys(kRuf.args).every(k => SIGNATUR.gericht_kalkulation.includes(k)), "E3: gericht_kalkulation für diesen Betrieb", JSON.stringify(kRuf && kRuf.args));

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
  await p.evaluate(() => { window.__D.antworten.beleg_freigeben = { ok:false, grund:"summe", positionen:54, beleg:60 }; });
  await p.fill("#eNetto", "60"); await p.fill(pos + ' [data-f="netto"]', "54"); await p.fill(pos + ' [data-f="menge"]', "12");
  await p.click('[data-aktion="freigeben"]'); await p.waitForTimeout(350);
  const satz = (await p.textContent("#eMeldung")).replace(/\s/g, " ");
  pruef(/54,00 €/.test(satz) && /60,00 €/.test(satz) && !/summe\b|"grund"/.test(satz), "summe → Satz mit beiden Beträgen, kein Rohtext", satz);
  await p.evaluate(() => { window.__D.antworten.beleg_freigeben = { ok:false, grund:"doppelt" }; });
  await p.click('[data-aktion="freigeben"]'); await p.waitForTimeout(350);
  pruef(/schon freigegeben/.test(await p.textContent("#eMeldung")), "doppelt → Satz", await p.textContent("#eMeldung"));
  await p.evaluate(() => { delete window.__D.antworten.beleg_freigeben; });

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
    d.antworten["fn:beleg-lesen"] = { ok:true, id:"be-entwurf", positionen:3, zugeordnet:1, lieferant:"Großmarkt" };
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
    await p.evaluate(() => { window.__D.antworten.inventur_buchen = { ok:true, buchungen:1, differenz_wert:-4 }; });
    await p.click("#invBuchen"); await p.waitForTimeout(200);
    const inv = (await rufe(p, "inventur_buchen"))[0];
    pruef(inv && JSON.stringify(Object.keys(inv.args).sort()) === JSON.stringify(SIGNATUR.inventur_buchen), "Parameter = Signatur von inventur_buchen", inv && Object.keys(inv.args).join(","));
    pruef(inv && inv.args.p_zaehlung.length === 1 && inv.args.p_zaehlung[0].artikel_id === "a-mehl" && inv.args.p_zaehlung[0].menge === 20500,
      "„20,5“ kg → 20500 g; leeres Feld (Wein) nicht als 0 gezählt", JSON.stringify(inv && inv.args.p_zaehlung));
    await p.click('[data-aktion="artikel-auf"][data-id="a-wein"]');
    await p.fill("#vMenge", "1,5"); await p.fill("#vGrund", "Bruch");
    await p.evaluate(() => { window.__D.antworten.verlust_buchen = { ok:true, wert:-10.8 }; });
    await p.click('[data-aktion="verlust"]'); await p.waitForTimeout(200);
    const vl = (await rufe(p, "verlust_buchen"))[0];
    pruef(vl && JSON.stringify(Object.keys(vl.args).sort()) === JSON.stringify(SIGNATUR.verlust_buchen) && vl.args.p_menge === 1500 && vl.args.p_notiz === "Bruch",
      "Verlust 1,5 l → 1500 ml mit Grund", JSON.stringify(vl && vl.args));
    pruef(!kons.length, "keine Ausnahme beim Einlesen, Inventur, Verlust", kons[0]);
    await ctx.close();
  }

  /* ── E3 · Kalkulation und Rezeptur ─────────────────────────────── */
  console.log("\n══ 14 · Kalkulation und Rezeptur (E3) ══");
  {
    const { ctx, p, kons } = await oeffnen(browser, grundDaten("inhaber"));
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="kalkulation"]');
    const liste = () => p.evaluate(() => [...document.querySelectorAll("#kalkListe [data-gericht]")].map(z => z.dataset.gericht + "|" + z.querySelector(".rechts").textContent.replace(/\s/g, " ") + "|" + (z.querySelector(".pille.hoch") ? "hoch" : "")));
    const alle = await liste();
    pruef(alle.length === 3 && /^g-pizza\|6,3 %\|$/.test(alle[0]) && /^g-sal\|40 %\|hoch$/.test(alle[1]) && /^g-tira\|Keine Rezeptur/.test(alle[2]), "Liste: Wareneinsatz je Gericht, über 35 % markiert, ohne Rezeptur benannt", alle.join(" ; "));
    const pizzaUnter = (await p.textContent('[data-gericht="g-pizza"] .unter')).replace(/\s/g, " ");
    pruef(/Kosten 0,41 € je Portion/.test(pizzaUnter) && /Aktion 5,90 € \(7,5 %\)/.test(pizzaUnter), "Kosten und Aktion getrennt mit eigenem Wareneinsatz", pizzaUnter);
    await p.click('#kFilter [data-filter="ohne"]');
    pruef(JSON.stringify((await liste()).map(x => x.split("|")[0])) === '["g-tira"]', "Filter „Ohne Rezeptur“ zeigt nur Tiramisu");
    await p.click('#kFilter [data-filter="hoch"]');
    pruef(JSON.stringify((await liste()).map(x => x.split("|")[0])) === '["g-sal"]', "Filter „Über 35 %“ zeigt nur den Salat");
    await p.click('#kFilter [data-filter="alle"]');
    await p.fill("#kSuche", "pizza");
    pruef((await liste()).length === 1, "Suche findet die Pizza");
    await p.fill("#kSuche", "");

    /* Editor */
    await p.click('[data-gericht="g-pizza"]');
    const ed = await p.evaluate(() => ({
      zeilen: [...document.querySelectorAll("#rezPosListe [data-rpos]")].map(z => z.querySelector("select").value + ":" + z.querySelector('[data-rf="menge"]').value + ":" + z.querySelector('[data-rf="verlust"]').value),
      text: document.getElementById("kalkEdit").textContent.replace(/\s/g, " ") }));
    pruef(JSON.stringify(ed.zeilen) === '["a-wein:300:","a-mehl:400:10"]', "Editor zeigt die GÜLTIGE Fassung (400 g, 10 %), nach Name sortiert", JSON.stringify(ed.zeilen));
    pruef(/Gültige Fassung seit 12\.10\.2026 · 2 Fassungen/.test(ed.text) && /Frühere Fassungen/.test(ed.text) && /02\.10\.2026/.test(ed.text), "Stand und frühere Fassung sichtbar", ed.text.slice(0, 160));
    pruef(/1 Zutat ohne Einkaufspreis/.test(ed.text), "Mehl ohne Einkaufspreis wird gesagt, nicht als 0 gerechnet");
    await p.fill('[data-rpos="0"] [data-rf="menge"]', "150,5");
    const kost = (await p.textContent("#rezZahlen")).replace(/\s/g, " ");
    pruef(/0,54 €/.test(kost) && await p.evaluate(() => document.activeElement && document.activeElement.dataset.rf === "menge"), "„150,5“ ml Wein → Vorschau 0,54 € je Portion, Fokus bleibt im Feld", kost.slice(0, 80));
    /* Verlust auf einer Zutat MIT Preis — beim Mehl (ohne Preis) wäre er wirkungslos. */
    await p.fill('[data-rpos="0"] [data-rf="verlust"]', "10");
    const mitVerlust = (await p.textContent("#rezZahlen")).replace(/\s/g, " ");
    pruef(/0,60 €/.test(mitVerlust), "10 % Verlust auf den Wein → 150,5 × 1,1 × 0,0072 ÷ 2 = 0,60 €", mitVerlust.slice(0, 40));
    await p.fill('[data-rpos="0"] [data-rf="verlust"]', "");
    await p.fill('[data-rpos="1"] [data-rf="verlust"]', "abc");
    await p.evaluate(() => { window.__rufe.length = 0; });
    await p.click('[data-aktion="rez-sichern"]'); await p.waitForTimeout(150);
    pruef((await rufe(p, "rezeptur_speichern")).length === 0 && /Zutat 2: Verlust ist nicht lesbar/.test(await p.textContent("#rMeldung")), "Unlesbares geht nicht hinaus, Satz nennt die Zeile", await p.textContent("#rMeldung"));
    await p.fill('[data-rpos="1"] [data-rf="verlust"]', "10");
    await p.click('[data-aktion="rpos-neu"]');
    await p.click('#rMwst [data-mwst="19"]');
    await p.fill("#rNotiz", "weniger Wein");
    await p.click('[data-aktion="rez-sichern"]'); await p.waitForTimeout(300);
    const rs = (await rufe(p, "rezeptur_speichern"))[0];
    pruef(rs && JSON.stringify(Object.keys(rs.args).sort()) === JSON.stringify(SIGNATUR.rezeptur_speichern), "Parameter = Signatur von rezeptur_speichern", rs && Object.keys(rs.args).join(","));
    pruef(rs && JSON.stringify(rs.args.p_positionen) === '[{"artikel_id":"a-wein","menge_basis":150.5,"verlust_prozent":0},{"artikel_id":"a-mehl","menge_basis":400,"verlust_prozent":10}]'
      && rs.args.p_portionen === 2 && rs.args.p_mwst === 19 && rs.args.p_notiz === "weniger Wein" && rs.args.p_gericht === "g-pizza",
      "Nutzlast: Komma gelesen, leeres Verlust = 0, leere Zeile weggelassen, MwSt 19", JSON.stringify(rs && rs.args));
    const fremd = rs ? Object.keys(rs.args.p_positionen[0]).filter(k => !rezPosGelesen.has(k)) : ["?"];
    pruef(!fremd.length, "jeder Schlüssel einer Zutat wird in rezeptur_speichern gelesen", fremd.join(",") || [...rezPosGelesen].join(","));
    const nachher = await p.evaluate(() => window.__rufe.map(r => r.name));
    pruef(nachher.indexOf("gericht_kalkulation") > nachher.indexOf("rezeptur_speichern") && /gesichert/.test(await p.textContent("#toast")), "nach dem Sichern neu vom Server gerechnet", nachher.join(","));
    /* Gründe vom Server, Zeile richtig zurückgerechnet */
    await p.click('[data-aktion="rpos-neu"]');
    const n = await p.evaluate(() => document.querySelectorAll("#rezPosListe [data-rpos]").length);
    await p.selectOption('[data-rpos="' + (n - 1) + '"] [data-rf="artikel_id"]', "a-mehl");
    await p.fill('[data-rpos="' + (n - 1) + '"] [data-rf="menge"]', "5");
    await p.selectOption('[data-rpos="1"] [data-rf="artikel_id"]', "");
    await p.fill('[data-rpos="1"] [data-rf="menge"]', ""); await p.fill('[data-rpos="1"] [data-rf="verlust"]', "");
    await p.evaluate(() => { window.__D.antworten.rezeptur_speichern = { ok:false, grund:"position", pos:2, feld:"doppelt" }; });
    await p.click('[data-aktion="rez-sichern"]'); await p.waitForTimeout(250);
    pruef(new RegExp("Zutat " + n + ": Dieser Artikel steht schon").test(await p.textContent("#rMeldung")), "Server-Position 2 = Zeile " + n + " auf der Seite (leere Zeile dazwischen)", await p.textContent("#rMeldung"));
    await p.evaluate(() => { window.__D.antworten.rezeptur_speichern = { ok:false, grund:"kein_recht" }; });
    await p.click('[data-aktion="rez-sichern"]'); await p.waitForTimeout(250);
    pruef(/Nur der Besitzer kann Rezepturen ändern/.test(await p.textContent("#rMeldung")), "kein_recht → Satz für Rezepturen");
    await p.evaluate(() => { window.__D.antworten.rezeptur_speichern = { ok:false, grund:"mwst" }; });
    await p.click('[data-aktion="rez-sichern"]'); await p.waitForTimeout(250);
    pruef(/7 %, 19 % oder 0 %/.test(await p.textContent("#rMeldung")), "mwst → Satz");
    /* Freigabe mit Preisänderung nennt betroffene Gerichte */
    await p.evaluate(() => { delete window.__D.antworten.rezeptur_speichern; window.__D.antworten.beleg_freigeben = { ok:true, positionen:1, preisaenderungen:[{ artikel_id:"a-mehl", prozent:50 }] }; });
    await p.click('.reiter [data-ansicht="belege"]');
    await p.click('#belegListe [data-beleg="be-entwurf"]');
    await p.click('[data-aktion="freigeben"]'); await p.waitForTimeout(350);
    pruef(/betrifft 1 Gericht \(siehe Kalkulation\)/.test(await p.textContent("#toast")), "Freigabe mit Preisänderung: betroffene Gerichte gezählt", await p.textContent("#toast"));
    pruef(!kons.length, "keine Ausnahme in der Kalkulation", kons[0]);
    await ctx.close();
  }
  {
    const { ctx, p } = await oeffnen(browser, grundDaten("manager"));
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="kalkulation"]');
    await p.click('[data-gericht="g-pizza"]');
    const t = await p.evaluate(() => ({ felder: document.querySelectorAll("#kalkEdit input, #kalkEdit select").length, sichern: !!document.querySelector('[data-aktion="rez-sichern"]'),
      text: document.getElementById("kalkEdit").textContent.replace(/\s/g, " ") }));
    pruef(t.felder === 0 && !t.sichern && /Mehl 405/.test(t.text) && /400 g/.test(t.text), "Manager mit Kosten-Recht: Rezeptur nur ansehen", JSON.stringify({ f:t.felder, s:t.sichern }));
    await ctx.close();
  }
  {
    /* Migration fehlt: Satz in der Kalkulation, der Rest der Seite lebt. */
    const d = grundDaten("inhaber");
    d.rpcFehler = { gericht_kalkulation: { code:"PGRST202", message:"Could not find the function public.gericht_kalkulation in the schema cache" } };
    const { ctx, p, kons } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    pruef((await p.textContent("#kMonat")).replace(/\s/g, " ") === "64,80 €" && await p.isHidden("#ladefehler"), "ohne E3-Migration: Übersicht unverändert, kein Ladefehler oben");
    await p.click('.reiter [data-ansicht="kalkulation"]');
    pruef(/noch nicht eingerichtet \(migration-einkauf-e3\.sql\)/.test(await p.textContent("#kalkFehler")) && await p.isVisible("#kalkFehler"), "… und in der Kalkulation ein Satz statt leerer Fläche");
    pruef(!kons.length, "keine Ausnahme ohne Migration", kons[0]);
    await ctx.close();
  }

  /* ── 10b · Rechte: Einkauf und Kalkulation nur mit Recht (migration-zugriffsrechte.sql) ── */
  console.log("\n══ 10b · Rechte: gesperrt ist gesperrt, Export nur mit Recht ══");
  const MIGR = fs.readFileSync(path.join(OBEN, "datenbank", "migration-zugriffsrechte.sql"), "utf8");
  {
    const kopf = MIGR.indexOf("function public.finanz_export_belege(");
    const sig = MIGR.slice(kopf, MIGR.indexOf(")", kopf)).match(/p_[a-z_]+/g);
    const gruende = [...new Set([...MIGR.slice(kopf, MIGR.indexOf("end $function$;", kopf)).matchAll(/'grund',\s*'(\w+)'/g)].map(m => m[1]))];
    const seite = HTML.match(/const EXPORT_GRUND = \{([\s\S]*?)\n\};/);
    const gebaut = seite ? [...seite[1].matchAll(/^\s*(\w+):/gm)].map(m => m[1]) : [];
    const rpcStelle = HTML.match(/rpc\("finanz_export_belege",\s*\{([^}]*)\}/);
    const gesendet = rpcStelle ? [...rpcStelle[1].matchAll(/(p_\w+)\s*:/g)].map(m => m[1]) : [];
    pruef(JSON.stringify(sig) === JSON.stringify(gesendet), "finanz_export_belege: gesendete Parameter = Signatur der Migration", JSON.stringify(gesendet) + " · " + JSON.stringify(sig));
    pruef(gruende.length >= 2 && gruende.every(g => gebaut.includes(g)), "jeder Grund des Exports hat auf der Seite einen Satz", gruende.join(","));
  }
  const KEIN_DATUM = ["einkaufsbelege", "lagerbestand", "artikel_preise", "lieferanten", "artikel", "lieferanten_artikel", "rezepturen", "lagerbewegungen"];
  for(const [rolle, rechte, was] of [["team", {}, "Team"], ["kueche", {}, "Küche"], ["manager", { kennzahlen_tag:true, berichte_view:true, berichte_export:true }, "Manager ohne Einkauf-Recht"]]){
    const d = grundDaten(rolle);
    d.antworten.meine_rechte = { rolle, rechte: Object.assign({}, KEINE_RECHTE, rechte) };
    const { ctx, p, kons } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.waitForTimeout(250);
    const g = await p.evaluate(() => ({ gesperrt: document.body.classList.contains("gesperrt"), satz: document.getElementById("gesperrtSatz").getClientRects().length > 0,
      reiter: document.querySelector(".reiter").getClientRects().length > 0, text: document.body.innerText, gelesen: window.__lesen.slice(), rufe: window.__rufe.map(r => r.name) }));
    pruef(g.gesperrt && g.satz && !g.reiter, was + ": nur der Satz „gesperrt“, keine Reiter", JSON.stringify({ g: g.gesperrt, s: g.satz, r: g.reiter }));
    pruef(!g.gelesen.some(t => KEIN_DATUM.includes(t)), was + ": kein einziger Einkaufs-/Lager-/Rezeptur-Zugriff", g.gelesen.join(","));
    pruef(!g.rufe.some(n => /gericht_kalkulation|wareneinsatz_theoretisch|finanz_export_belege|zentrale_vergleich/.test(n)), was + ": keine Kalkulations-/Export-Funktion gerufen", g.rufe.join(","));
    pruef(!/Mehl 405|64,80|Weinhandel/.test(g.text), was + ": kein Wert der Seite im Dokument");
    pruef(await p.evaluate(() => document.getElementById("exportZeile").getClientRects().length === 0), was + ": kein Export");
    pruef(!kons.length, was + ": keine Ausnahme", kons[0]);
    await ctx.close();
  }
  {
    /* meine_rechte fehlt (Migration noch nicht eingespielt): im Zweifel weniger, nie mehr */
    const d = grundDaten("team"); d.rpcFehler = { meine_rechte: { code:"PGRST202", message:"Could not find the function public.meine_rechte" } };
    const { ctx, p } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 }); await p.waitForTimeout(250);
    pruef(await p.evaluate(() => document.body.classList.contains("gesperrt")), "Team ohne Antwort von meine_rechte: gesperrt");
    await ctx.close();
    const d2 = grundDaten("inhaber"); d2.rpcFehler = { meine_rechte: { code:"PGRST202", message:"Could not find the function public.meine_rechte" } };
    const o2 = await oeffnen(browser, d2);
    await o2.p.waitForSelector("#app:not([hidden])", { timeout: 5000 }); await o2.p.waitForTimeout(250);
    pruef(await o2.p.evaluate(() => !document.body.classList.contains("gesperrt")) && (await o2.p.textContent("#kMonat")).replace(/\s/g, " ") === "64,80 €", "Besitzer ohne Antwort: wie bisher (der Server hält ohnehin)");
    await o2.ctx.close();
  }
  {
    /* Export */
    const d = grundDaten("manager");
    d.antworten.meine_rechte = { rolle:"manager", rechte: Object.assign({}, KEINE_RECHTE, { kosten_view:true }) };
    const { ctx, p } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="belege"]');
    pruef(await p.evaluate(() => document.getElementById("exportZeile").getClientRects().length === 0), "Manager mit nur Einkauf-Recht: kein Export-Knopf");
    await ctx.close();
  }
  {
    const d = grundDaten("manager");
    d.antworten.meine_rechte = { rolle:"manager", rechte: Object.assign({}, KEINE_RECHTE, { kosten_view:true, finanz_export:true }) };
    d.antworten.finanz_export_belege = { ok:true, zeilen:[
      { belegdatum:"2026-10-02", belegnummer:"=HYPERLINK(\"http://x\")", lieferant:"Weinhandel; Probe", netto:100, steuer:7, brutto:107, status:"freigegeben" },
      { belegdatum:"2026-10-03", belegnummer:"R-2", lieferant:"@SUMME(1)", netto:12.5, steuer:0.88, brutto:13.38, status:"freigegeben" }] };
    const { ctx, p } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="belege"]');
    pruef(await p.isVisible("#exportKnopf") && await p.evaluate(() => ["exportVon", "exportBis", "exportKnopf"].every(i => document.getElementById(i).getBoundingClientRect().height >= 43.5 && getComputedStyle(document.getElementById(i)).fontSize !== "")), "Manager mit Export-Recht: Knopf und Zeitraum da, ≥ 44 px");
    await p.evaluate(() => { window.__csv = null; const alt = URL.createObjectURL.bind(URL); URL.createObjectURL = b => { b.text().then(t => { window.__csv = t; }); return alt(b); }; });
    await p.fill("#exportVon", "2026-10-01"); await p.fill("#exportBis", "2026-10-31");
    await p.click("#exportKnopf"); await p.waitForTimeout(400);
    const r = await rufe(p, "finanz_export_belege");
    pruef(r.length === 1 && JSON.stringify(r[0].args) === JSON.stringify({ p_betrieb: BETRIEB, p_von: "2026-10-01", p_bis: "2026-10-31" }), "Export ruft finanz_export_belege mit Betrieb und Zeitraum", JSON.stringify(r.map(x => x.args)));
    const csv = await p.evaluate(() => window.__csv);
    pruef(csv && csv.split("\r\n")[0].replace("﻿", "") === "Belegdatum;Belegnummer;Lieferant;Netto;Steuer;Brutto;Status" && /;12,50;0,88;13,38;/.test(csv), "CSV: Kopfzeile, Zahlen mit Komma", (csv || "").slice(0, 120));
    pruef(csv && !/(^|;)=HYPERLINK|(^|;)@SUMME/m.test(csv) && /'=HYPERLINK/.test(csv) && /'@SUMME/.test(csv), "Zellen mit Formelzeichen vorn bekommen ein ' (kein =, @ als erstes Zeichen)");
    pruef(csv && /"Weinhandel; Probe"/.test(csv), "Semikolon in einer Zelle wird in Anführungszeichen gesetzt");
    await p.evaluate(() => { window.__D.antworten.finanz_export_belege = { ok:false, grund:"kein_recht" }; });
    await p.click("#exportKnopf"); await p.waitForTimeout(300);
    pruef(/fehlt dir das Recht/.test(await p.textContent("#ladefehler")) && await p.isVisible("#ladefehler"), "Abweisung „kein_recht“ erscheint als Satz");
    await p.fill("#exportVon", ""); const vor = (await rufe(p, "finanz_export_belege")).length;
    await p.click("#exportKnopf"); await p.waitForTimeout(200);
    pruef((await rufe(p, "finanz_export_belege")).length === vor && /höchstens 400 Tagen/.test(await p.textContent("#ladefehler")), "ohne Datum geht nichts hinaus, der Satz nennt die Grenze");
    await ctx.close();
  }
  {
    /* Standortwechsel: das Recht gilt je Betrieb, und nichts vom vorigen bleibt stehen */
    const d = grundDaten("inhaber");
    d.mitglieder.push({ rolle:"team", betriebe:{ id:"b-zwei", name:"Café Zwei", organisation_id: ORG } });
    d.rechteJe = { [BETRIEB]: { rolle:"inhaber", rechte: Object.assign({}, KEINE_RECHTE, { kosten_view:true, finanz_export:true }) }, "b-zwei": { rolle:"team", rechte: KEINE_RECHTE } };
    const { ctx, p } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.selectOption("#betriebWahl", BETRIEB); await p.waitForTimeout(300);
    pruef((await p.textContent("#kMonat")).replace(/\s/g, " ") === "64,80 €" && !(await p.evaluate(() => document.body.classList.contains("gesperrt"))), "Voraussetzung: im eigenen Betrieb sind die Zahlen da");
    await p.selectOption("#betriebWahl", "b-zwei"); await p.waitForTimeout(400);
    const z = await p.evaluate(() => ({ gesperrt: document.body.classList.contains("gesperrt"), text: document.querySelector("main").textContent, belege: document.querySelectorAll("#belegListe .zeile").length }));
    pruef(z.gesperrt && !/64,80|Mehl 405|Weinhandel|Pizza/.test(z.text) && z.belege === 0, "Wechsel in einen Betrieb ohne Recht: gesperrt, und die Zahlen des anderen Betriebs sind weg (auch im versteckten Dokument, textContent)", JSON.stringify({ g: z.gesperrt, b: z.belege }));
    await p.selectOption("#betriebWahl", BETRIEB); await p.waitForTimeout(400);
    pruef((await p.textContent("#kMonat")).replace(/\s/g, " ") === "64,80 €" && !(await p.evaluate(() => document.body.classList.contains("gesperrt"))), "und zurück: die Zahlen kommen wieder");
    await ctx.close();
  }

  /* ── 11 · Manager mit Einkauf-Recht ───────────────────────────── */
  console.log("\n══ 10 · Manager mit Einkauf-Recht (früher Team): nur ansehen ══");
  {
    const { ctx, p } = await oeffnen(browser, grundDaten("manager"));
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    pruef(await p.isVisible("#lesesatz"), "Manager: Satz statt Bedienung");
    await p.click('.reiter [data-ansicht="belege"]');
    pruef(!(await p.isVisible("#belegNeu")) && !(await p.isVisible("#einlesenKnopf")), "Manager: weder erfassen noch einlesen");
    await p.click('#belegListe [data-beleg="be-entwurf"]'); await p.waitForTimeout(150);
    const f = await p.evaluate(() => document.querySelectorAll("#belegEdit input, #belegEdit select").length);
    pruef(f === 0 && /Mehl 405/.test(await p.textContent("#belegEdit")), "Manager: Entwurf nur ansehen", f + " Felder");
    await p.click('.reiter [data-ansicht="artikel"]');
    pruef(!(await p.isVisible("#aAnlegen")) && !(await p.isVisible('[data-aktion="artikel-auf"]')) && !(await p.isVisible("#inventurKnopf")), "Manager: Artikel weder anlegen noch ändern, keine Inventur");
    await ctx.close();
  }

  /* ── E4 · Ketten ───────────────────────────────────────────────── */
  console.log("\n══ E4 · Standorte, Zentrale, gemeinsame Rezeptur ══");
  const KETTE_ANTWORT = [{ organisation_id: ORG, name: "Kette Probe", standorte: 3, zentrale: false }];
  const VERGLEICH_ANTWORT = [
    { betrieb_id: BETRIEB, name: "Café Probe", einkauf_netto: 50, belege: 2, lagerwert: 48.8, verlust_wert: -1.2, inventur_wert: 0, umsatz_brutto: 20,
      wareneinsatz: 3, umsatz_mit_rezeptur: 10, ohne_rezeptur: 1, gerichte: 3, mit_rezeptur: 2 },
    { betrieb_id: "b-zwei", name: "Café Zwei", einkauf_netto: 50, belege: 1, lagerwert: 0, verlust_wert: 0, inventur_wert: 2.5, umsatz_brutto: 8,
      wareneinsatz: 4, umsatz_mit_rezeptur: 8, ohne_rezeptur: 0, gerichte: 1, mit_rezeptur: 1 },
    { betrieb_id: "b-drei", name: "Café Drei", einkauf_netto: 0, belege: 0, lagerwert: 0, verlust_wert: 0, inventur_wert: 0, umsatz_brutto: 0,
      wareneinsatz: 0, umsatz_mit_rezeptur: 0, ohne_rezeptur: 0, gerichte: 0, mit_rezeptur: 0 }
  ];
  const mitKette = (rolle) => { const d = grundDaten(rolle); d.antworten.meine_ketten = KETTE_ANTWORT; d.antworten.zentrale_vergleich = VERGLEICH_ANTWORT; return d; };
  {
    /* Ohne Kette kein Reiter — die Voraussetzung „meine_ketten gefragt“ selbst gemessen (§8.1g C). */
    const { ctx, p } = await oeffnen(browser, grundDaten("inhaber"));
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    pruef((await rufe(p, "meine_ketten")).length === 1 && await p.isHidden("#reiterStandorte"), "ohne Kette: meine_ketten gefragt, kein Reiter „Standorte“");
    pruef(!(await rufe(p, "zentrale_vergleich")).length, "ohne Kette: kein Vergleich geholt");
    await ctx.close();
  }
  {
    const { ctx, p, kons } = await oeffnen(browser, mitKette("inhaber"));
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    pruef(await p.isVisible("#reiterStandorte"), "mit Kette: Reiter „Standorte“ sichtbar");
    pruef(!(await rufe(p, "zentrale_vergleich")).length, "… Vergleich erst beim Öffnen des Reiters geholt");
    await p.click("#reiterStandorte"); await p.waitForTimeout(150);
    const r1 = (await rufe(p, "zentrale_vergleich"))[0];
    const monat = await p.evaluate(a => { const j = new Date(), v = new Date(a.p_von), b = new Date(a.p_bis);
      return { von: v.getTime() === new Date(j.getFullYear(), j.getMonth(), 1).getTime(), bis: Math.abs(b - j) < 60000 }; }, r1 ? r1.args : {});
    pruef(r1 && r1.args.p_org === ORG && Object.keys(r1.args).sort().join() === SIGNATUR.zentrale_vergleich.join() && monat.von && monat.bis,
      "Vergleich: genau die Parameter der Funktion, ab dem 1. bis jetzt", JSON.stringify(r1 && r1.args));
    const zeilen = await p.evaluate(() => [...document.querySelectorAll("#standortTabelle tr[data-standort]")].map(tr => ({ id: tr.dataset.standort, text: tr.textContent.replace(/\s+/g, " "), hoch: !!tr.querySelector(".pille.hoch") })));
    pruef(zeilen.length === 3, "drei Standorte, drei Zeilen", zeilen.length);
    const a = zeilen.find(z => z.id === BETRIEB) || { text:"" }, b = zeilen.find(z => z.id === "b-zwei") || {}, c = zeilen.find(z => z.id === "b-drei") || { text:"" };
    pruef(/50,00 €/.test(a.text) && /2 Belege/.test(a.text) && /48,80 €/.test(a.text) && /−1,20 €|-1,20 €/.test(a.text) && /2 \/ 3/.test(a.text) && /30\s?%/.test(a.text),
      "Zeile Café Probe: Einkauf, Belege, Lager, Verlust, Rezepturen, 30 %", a.text);
    pruef(b.hoch && !a.hoch && !c.hoch && /1 Beleg(?!e)/.test(b.text), "höchster Wareneinsatz (50 %) markiert, sonst keiner; „1 Beleg“", JSON.stringify(zeilen.map(z => z.hoch)));
    pruef(/ohne Rezeptur/.test(c.text) && !/NaN|Infinity/.test(zeilen.map(z => z.text).join()), "ohne Umsatz mit Rezeptur: „ohne Rezeptur“, kein NaN", c.text);
    /* Name eines Standorts ist Text, nie Auszeichnung */
    await p.evaluate(() => { window.__D.antworten.zentrale_vergleich[0].name = '<img src=x onerror="window.__boese=1">'; });
    await p.click('#sZeitraum [data-zeitraum="vormonat"]'); await p.waitForTimeout(150);
    const r2 = (await rufe(p, "zentrale_vergleich")).pop();
    const vor = await p.evaluate(a => { const j = new Date(), v = new Date(a.p_von), b = new Date(a.p_bis), erster = new Date(j.getFullYear(), j.getMonth(), 1);
      return { von: v.getTime() === new Date(j.getFullYear(), j.getMonth() - 1, 1).getTime(), bisVor: b < erster, bisTag: b.getDate() === new Date(erster - 1).getDate() && b.getMonth() === new Date(erster - 1).getMonth() }; }, r2.args);
    pruef(vor.von && vor.bisVor && vor.bisTag, "„Letzter Monat“: vom 1. bis zum letzten Tag des Vormonats (der 1. dieses Monats zählt nicht mit)", JSON.stringify({ ...vor, args: r2.args }));
    pruef(await p.getAttribute('#sZeitraum [data-zeitraum="vormonat"]', "aria-checked") === "true", "Zeitraum-Wahl zeigt ihre Stellung");
    pruef(!(await p.evaluate(() => window.__boese)) && /<img/.test(await p.textContent("#standortTabelle")), "Standortname als Text, nicht als Auszeichnung");
    pruef(!kons.length, "keine Ausnahme im Vergleich", kons[0]);
    await ctx.close();
  }
  {
    const d = mitKette("inhaber"); d.rpcFehler = { zentrale_vergleich: { code:"PGRST202", message:"Could not find the function public.zentrale_vergleich in the schema cache" } };
    const { ctx, p, kons } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click("#reiterStandorte"); await p.waitForTimeout(150);
    pruef(/noch nicht eingerichtet \(migration-einkauf-e4\.sql\)/.test(await p.textContent("#standortFehler")) && await p.isVisible("#standortFehler"), "E4-Migration fehlt: Satz statt leerer Fläche");
    pruef(!kons.length, "… ohne Ausnahme", kons[0]);
    await ctx.close();
  }
  {
    /* Zentrale ohne eigenen Betrieb: nur Zahlen, keine Belege geladen. */
    const d = mitKette("inhaber"); d.mitglieder = [];
    const { ctx, p, kons } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 }); await p.waitForTimeout(200);
    const z = await p.evaluate(() => ({
      reiter: [...document.querySelectorAll(".reiter [data-ansicht]")].filter(k => !k.hidden).map(k => k.dataset.ansicht),
      name: document.getElementById("betriebName").textContent, fehler: document.getElementById("ladefehler").hidden ? "" : document.getElementById("ladefehler").textContent,
      zeilen: document.querySelectorAll("#standortTabelle tr[data-standort]").length, gelesen: window.__lesen.filter(t => t !== "betrieb_mitglieder") }));
    pruef(z.reiter.join() === "standorte" && z.name === "Kette Probe" && !z.fehler && z.zeilen === 3, "Zentrale ohne Betrieb: nur „Standorte“, Name der Kette, drei Zeilen", JSON.stringify(z));
    pruef(!z.gelesen.length, "Zentrale ohne Betrieb: keine einzige Tabelle gelesen (nur Zahlen über die Funktion)", z.gelesen.join(","));
    pruef(!kons.length, "… ohne Ausnahme", kons[0]);
    await ctx.close();
  }
  {
    const d = grundDaten("inhaber"); d.mitglieder = [];
    const { ctx, p } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 }); await p.waitForTimeout(150);
    pruef(/kein Betrieb/.test(await p.textContent("#ladefehler")) && await p.isHidden("#reiterStandorte"), "ohne Betrieb und ohne Kette: wie bisher „kein Betrieb“");
    await ctx.close();
  }
  /* Gemeinsame Rezeptur */
  const zweiStandorte = (rolleZwei, orgZwei) => { const d = grundDaten("inhaber");
    d.mitglieder.push({ rolle: rolleZwei, betriebe: { id: "b-zwei", name: "Café Zwei", organisation_id: orgZwei } }); return d; };
  {
    const { ctx, p, kons } = await oeffnen(browser, zweiStandorte("inhaber", ORG));
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="kalkulation"]'); await p.click('[data-gericht="g-pizza"]');
    const opt = await p.evaluate(() => [...document.querySelectorAll("#rZiel option")].map(o => o.value));
    pruef(opt.join() === "b-zwei", "Übernehmen: nur der andere eigene Standort steht zur Wahl", opt.join());
    await p.click('[data-aktion="rez-uebertragen"]'); await p.waitForTimeout(200);
    const u = (await rufe(p, "rezeptur_uebertragen"))[0];
    pruef(u && u.args.p_gericht === "g-pizza" && u.args.p_ziel_betrieb === "b-zwei" && Object.keys(u.args).sort().join() === SIGNATUR.rezeptur_uebertragen.join(),
      "Übernehmen schickt genau Gericht und Ziel", JSON.stringify(u && u.args));
    pruef(/Übernommen nach Café Zwei/.test(await p.textContent("#rUebMeldung")), "… und sagt, wohin", await p.textContent("#rUebMeldung"));
    for(const g of uebGruendeSql){
      await p.evaluate(g => { window.__D.antworten.rezeptur_uebertragen = { ok:false, grund:g }; }, g);
      await p.click('[data-aktion="rez-uebertragen"]'); await p.waitForTimeout(150);
      const t = await p.textContent("#rUebMeldung");
      pruef(t && !/hat nicht geklappt|\(/.test(t) && await p.getAttribute("#rUebMeldung", "class") === "meldung fehler", "Grund „" + g + "“ als Satz", t);
    }
    await p.click('.reiter [data-ansicht="kalkulation"]');
    await p.click('[data-gericht="g-tira"]');
    pruef(!(await p.$('[data-aktion="rez-uebertragen"]')), "Gericht ohne Rezeptur: nichts zu übernehmen");
    pruef(!kons.length, "keine Ausnahme beim Übernehmen", kons[0]);
    await ctx.close();
  }
  for(const [rolle, org, was] of [["team", ORG, "anderer Standort nur als Team"], ["inhaber", "org-fremd", "anderer Standort in fremder Kette"]]){
    const { ctx, p } = await oeffnen(browser, zweiStandorte(rolle, org));
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="kalkulation"]'); await p.click('[data-gericht="g-pizza"]');
    pruef(await p.isVisible('[data-aktion="rez-sichern"]') && !(await p.$('[data-aktion="rez-uebertragen"]')), was + ": kein „Übernehmen“ (Editor steht)");
    await ctx.close();
  }
  {
    /* Selbst nur Team im aktuellen Betrieb, Inhaber im anderen: auch kein Übernehmen. */
    const d = grundDaten("manager"); d.mitglieder.push({ rolle: "inhaber", betriebe: { id: "b-zwei", name: "Café Zwei", organisation_id: ORG } });
    const { ctx, p } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.selectOption("#betriebWahl", BETRIEB); await p.waitForTimeout(150);
    await p.click('.reiter [data-ansicht="kalkulation"]'); await p.click('[data-gericht="g-pizza"]');
    pruef(!(await p.$('[data-aktion="rez-uebertragen"]')) && !(await p.$('[data-aktion="rez-sichern"]')), "Manager im eigenen Standort: weder sichern noch übernehmen");
    await ctx.close();
  }

  /* ── E5-A · Mehrere Standorte verlässlich ──────────────────────── */
  console.log("\n══ 15 · Mehrere Standorte verlässlich (E5-A) ══");
  {
    /* Veraltete Antwort: A antwortet langsam, B schnell — nach dem
       Wechsel auf B darf A's späte Antwort nichts mehr überschreiben. */
    const d = zweiStandorte("inhaber", ORG);
    d.einkaufsbelege.push({ id: "be-zwei", betrieb_id: "b-zwei", lieferant_id: "l-2", belegnummer: "Z-9", belegdatum: "2026-10-10", netto: 5, steuer: null, brutto: null,
      status: "entwurf", quelle: "manuell", notiz: null, positionen_entwurf: [], angelegt: "2026-10-10T08:00:00Z" });
    const { ctx, p, kons } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="belege"]');
    await p.selectOption("#betriebWahl", "b-zwei"); await p.waitForTimeout(200);
    pruef(/Z-9/.test(await p.textContent("#belegListe")) && !/R-100/.test(await p.textContent("#belegListe")), "Voraussetzung: B zeigt nur seinen Beleg");
    await p.evaluate(b => { window.__D.langsam = b; }, BETRIEB);
    await p.selectOption("#betriebWahl", BETRIEB); await p.waitForTimeout(60);
    await p.selectOption("#betriebWahl", "b-zwei");
    await p.waitForTimeout(1300);
    const liste = await p.textContent("#belegListe"), name = await p.textContent("#betriebName");
    pruef(/Café Zwei/.test(name) && /Z-9/.test(liste) && !/R-100/.test(liste), "schneller Wechsel A → B: die späte Antwort von A überschreibt B nicht", name + " · " + liste.replace(/\s+/g, " ").slice(0, 80));
    pruef(!kons.length, "kein Seitenfehler beim Wechsel", kons.join(" | "));
    await ctx.close();
  }
  {
    /* Neuer Beleg nach Mitternacht (Berlin) trägt den Berliner Tag. */
    const ctx = await browser.newContext({ viewport:{ width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.clock.setFixedTime(new Date("2026-10-17T22:30:00Z"));
    await p.addInitScript({ content: ersatz(grundDaten("inhaber")) });
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto(SEITE);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="belege"]'); await p.click("#belegNeu");
    const datum = await p.inputValue("#eDatum").catch(() => "");
    pruef(datum === "2026-10-18", "neuer Beleg um 00:30 Berliner Zeit: Datum 18.10. (nicht der UTC-Tag 17.10.)", datum);
    await ctx.close();
  }
  {
    const d = grundDaten("inhaber");
    const { ctx, p } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="belege"]');
    await p.click('#belegListe [data-beleg="be-entwurf"]'); await p.waitForTimeout(150);
    await p.evaluate(() => { window.__D.antworten.beleg_freigeben = { ok:false, grund:"doppelt_standort", standort:"Café Nord" }; });
    await p.click('[data-aktion="freigeben"]'); await p.waitForTimeout(350);
    const t1 = await p.textContent("#eMeldung");
    pruef(/Café Nord/.test(t1) && /falschen Standort/.test(t1), "doppelt_standort → Satz mit dem Namen des anderen Standorts", t1);
    await p.evaluate(() => { window.__D.antworten.beleg_freigeben = { ok:false, grund:"datum" }; });
    await p.click('[data-aktion="freigeben"]'); await p.waitForTimeout(350);
    pruef(/400 Tage/.test(await p.textContent("#eMeldung")), "datum → Satz", await p.textContent("#eMeldung"));
    await p.evaluate(() => { window.__D.antworten.beleg_freigeben = { ok:true, positionen:1, preisaenderungen:[],
      zuordnungen:[{ pos:1, bezeichnung:"Mehl 405 25 kg", artikel_vorher:"a-wein", artikel_jetzt:"a-mehl", gebinde_vorher:750, gebinde_jetzt:25000 }] }; });
    await p.click('[data-aktion="freigeben"]'); await p.waitForTimeout(400);
    const m = await p.evaluate(() => { const e = document.getElementById("eMeldung"); return { t: e.textContent, sicht: !e.hidden, fehler: e.classList.contains("fehler"), rolle: e.getAttribute("role") }; });
    pruef(m.sicht && /Hauswein weiß/.test(m.t) && /Mehl 405/.test(m.t) && /alle Standorte/.test(m.t) && !m.fehler && m.rolle === "status",
      "geänderte gelernte Zuordnung wird nach der Freigabe genannt (alt → neu, als Hinweis, nicht als Fehler)", JSON.stringify(m));
    await ctx.close();
  }
  {
    const d = grundDaten("inhaber");
    d.antworten["fn:beleg-lesen"] = { ok:true, id:"be-entwurf", positionen:1, zugeordnet:1, hinweis:"datei_doppelt_standort", standort:"Café Nord", datum_verworfen:"2062-10-01" };
    const { ctx, p } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="belege"]');
    await p.setInputFiles("#einlesenDatei", { name:"rechnung.pdf", mimeType:"application/pdf", buffer: Buffer.from("%PDF-1.4\n%e5\n") });
    await p.waitForTimeout(600);
    const t = await p.textContent("#eMeldung").catch(() => "");
    pruef(/Café Nord/.test(t) && /2062-10-01/.test(t), "Einlesen: gleiche Datei an anderem Standort und verworfenes Datum werden gesagt", t);
    await ctx.close();
  }

  /* ── E5-B · Ware zwischen Standorten ───────────────────────────── */
  console.log("\n══ 16 · Umlagerung, Zentraleinkauf, Beleg verschieben (E5-B) ══");
  const UMLAGER = () => [
    { id:"u-ein", von_betrieb:"b-zwei", nach_betrieb:BETRIEB, status:"unterwegs", notiz:"Dienstag", beleg_id:null, angelegt:"2026-10-16T08:00:00Z",
      umlagerungspositionen:[{ pos:1, artikel_id:"a-wein", menge_basis:3000, wert_netto:18, menge_angekommen:null }, { pos:2, artikel_id:"a-mehl", menge_basis:2000, wert_netto:4, menge_angekommen:null }] },
    { id:"u-aus", von_betrieb:BETRIEB, nach_betrieb:"b-zwei", status:"unterwegs", notiz:null, beleg_id:null, angelegt:"2026-10-15T08:00:00Z",
      umlagerungspositionen:[{ pos:1, artikel_id:"a-wein", menge_basis:1500, wert_netto:9, menge_angekommen:null }] },
    { id:"u-alt", von_betrieb:BETRIEB, nach_betrieb:"b-zwei", status:"angenommen", notiz:null, beleg_id:null, angelegt:"2026-10-01T08:00:00Z", angenommen_am:"2026-10-02T08:00:00Z",
      umlagerungspositionen:[{ pos:1, artikel_id:"a-mehl", menge_basis:1000, wert_netto:2, menge_angekommen:600 }] }
  ];
  const mitLager = (rolle) => { const d = zweiStandorte(rolle || "inhaber", ORG); d.antworten.kette_standorte = [{ id:"b-zwei", name:"Café Zwei" }]; d.umlagerungen = UMLAGER(); return d; };
  {
    const { ctx, p } = await oeffnen(browser, grundDaten("inhaber"));
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    /* Seit E5-C hat jeder Standort „Lager“ (Nachbestellen) — den Teil
       Umlagerungen aber nur mit Kette. */
    await p.click('.reiter [data-ansicht="lager"]'); await p.waitForTimeout(100);
    pruef(await p.isVisible("#nachListe") && await p.isHidden("#umTeil"), "ohne Kette und ohne Umlagerung: „Lager“ ohne den Teil Umlagerungen");
    await ctx.close();
  }
  {
    const { ctx, p, kons } = await oeffnen(browser, mitLager());
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    pruef(await p.isVisible("#reiterLager"), "mit anderem Standort in der Kette: Reiter „Lager“ da");
    await p.click('.reiter [data-ansicht="lager"]'); await p.waitForTimeout(100);
    const t = await p.evaluate(() => ({ ein: document.getElementById("umEin").textContent, aus: document.getElementById("umAus").textContent, alt: document.getElementById("umVerlauf").textContent,
      felder: document.querySelectorAll('[data-um="u-ein"] [data-um-an]').length, ziel: [...document.querySelectorAll("#umZiel option")].map(o => o.textContent) }));
    pruef(/Von Café Zwei/.test(t.ein) && t.felder === 2 && /An Café Zwei/.test(t.aus) && /Fehlmenge/.test(t.alt) && t.ziel.join() === "Café Zwei",
      "eingehend mit je einem Feld pro Position, ausgehend, Verlauf mit Fehlmenge, Ziel aus kette_standorte", JSON.stringify(t).slice(0, 200));
    /* Schicken */
    await p.click('[data-aktion="um-schicken"]'); await p.waitForTimeout(150);
    pruef(!(await rufe(p, "umlagerung_anlegen")).length && /mindestens einen Artikel/.test(await p.textContent("#umMeldung")), "leer abschicken → Satz, kein Aufruf");
    await p.selectOption('#umZeilen [data-umf="artikel_id"]', "a-wein");
    await p.fill('#umZeilen [data-umf="menge"]', "viel");
    await p.click('[data-aktion="um-schicken"]'); await p.waitForTimeout(150);
    pruef(!(await rufe(p, "umlagerung_anlegen")).length && /Menge/.test(await p.textContent("#umMeldung")), "unlesbare Menge → Satz, kein Aufruf", await p.textContent("#umMeldung"));
    await p.fill('#umZeilen [data-umf="menge"]', "1,5");
    await p.evaluate(() => { window.__D.antworten.umlagerung_anlegen = { ok:true, id:"u-neu", wert:9, bestand_negativ:["a-wein"] }; });
    await p.click('[data-aktion="um-schicken"]'); await p.waitForTimeout(300);
    const an = (await rufe(p, "umlagerung_anlegen"))[0];
    pruef(an && an.args.p_von === BETRIEB && an.args.p_nach === "b-zwei" && JSON.stringify(an.args.p_positionen) === JSON.stringify([{ artikel_id:"a-wein", menge_basis:1500 }])
      && Object.keys(an.args).sort().join() === SIG6.umlagerung_anlegen.join(), "„1,5“ l Wein → 1500 ml, genau die Parameter der Funktion", JSON.stringify(an && an.args));
    const mm = await p.evaluate(() => { const m = document.getElementById("umMeldung"); return { t: m.textContent, fehler: m.classList.contains("fehler"), sicht: !m.hidden }; });
    pruef(mm.sicht && /Minus/.test(mm.t) && /Hauswein weiß/.test(mm.t) && !mm.fehler, "Bestand ins Minus → gesagt, als Hinweis (abgeschickt ist es trotzdem)", JSON.stringify(mm));
    await p.evaluate(() => { window.__D.antworten.umlagerung_anlegen = { ok:false, grund:"position", pos:1, feld:"preis" }; });
    await p.selectOption('#umZeilen [data-umf="artikel_id"]', "a-mehl"); await p.fill('#umZeilen [data-umf="menge"]', "2");
    await p.click('[data-aktion="um-schicken"]'); await p.waitForTimeout(300);
    pruef(/Position 1: hat an diesem Standort noch keinen Einkaufspreis/.test(await p.textContent("#umMeldung")), "Grund „preis“ → Satz", await p.textContent("#umMeldung"));
    /* Annehmen */
    await p.fill('[data-um="u-ein"] [data-um-an="2"]', "5");
    await p.click('[data-aktion="um-annehmen"][data-id="u-ein"]'); await p.waitForTimeout(150);
    pruef(!(await rufe(p, "umlagerung_annehmen")).length && /mehr als geschickt/.test(await p.textContent('[data-um-meldung="u-ein"]')), "mehr angekommen als geschickt → Satz, kein Aufruf");
    await p.fill('[data-um="u-ein"] [data-um-an="2"]', "1,5");
    await p.evaluate(() => { window.__D.antworten.umlagerung_annehmen = { ok:true, wert:21, fehlwert:1 }; });
    await p.click('[data-aktion="um-annehmen"][data-id="u-ein"]'); await p.waitForTimeout(300);
    const ann = (await rufe(p, "umlagerung_annehmen"))[0];
    pruef(ann && ann.args.p_id === "u-ein" && JSON.stringify(ann.args.p_mengen) === JSON.stringify([{ pos:2, menge_angekommen:1500 }]) && Object.keys(ann.args).sort().join() === SIG6.umlagerung_annehmen.join(),
      "leeres Feld = alles, „1,5“ kg Mehl → 1500 g, nur diese Position geschickt", JSON.stringify(ann && ann.args));
    pruef(/Fehlmenge 1,00\s€/.test(await p.textContent("#toast")), "Fehlmenge im Satz genannt", await p.textContent("#toast"));
    /* Zurückziehen erst beim zweiten Tipp */
    await p.click('[data-aktion="um-zurueck"][data-id="u-aus"]'); await p.waitForTimeout(100);
    pruef(!(await rufe(p, "umlagerung_zurueckziehen")).length, "Zurückziehen: erster Tipp ruft nichts");
    await p.click('[data-aktion="um-zurueck"][data-id="u-aus"]'); await p.waitForTimeout(300);
    const zr = (await rufe(p, "umlagerung_zurueckziehen"))[0];
    pruef(zr && zr.args.p_id === "u-aus" && Object.keys(zr.args).join() === SIG6.umlagerung_zurueckziehen.join(), "zweiter Tipp zieht genau diese Umlagerung zurück", JSON.stringify(zr && zr.args));
    /* Zentraleinkauf aus dem freigegebenen Beleg */
    await p.click('.reiter [data-ansicht="belege"]'); await p.click('#belegListe [data-beleg="be-frei"]'); await p.waitForTimeout(250);
    await p.click('[data-aktion="um-aus-beleg"]'); await p.waitForTimeout(150);
    const vor = await p.evaluate(() => ({ lager: !document.getElementById("v-lager").hidden, art: document.querySelector('#umZeilen [data-umf="artikel_id"]').value,
      menge: document.querySelector('#umZeilen [data-umf="menge"]').value, hinweis: document.getElementById("umAusBeleg").textContent }));
    pruef(vor.lager && vor.art === "a-wein" && vor.menge === "9" && /R-100/.test(vor.hinweis), "„An Standort weitergeben“: Lager offen, Wein 9 l aus dem Beleg", JSON.stringify(vor));
    await p.fill('#umZeilen [data-umf="menge"]', "4");
    await p.evaluate(() => { window.__D.antworten.umlagerung_anlegen = { ok:true, id:"u-z", wert:24, bestand_negativ:[] }; window.__rufe = []; });
    await p.click('[data-aktion="um-schicken"]'); await p.waitForTimeout(300);
    const zb = (await rufe(p, "umlagerung_anlegen"))[0];
    pruef(zb && zb.args.p_beleg === "be-frei" && zb.args.p_positionen[0].menge_basis === 4000, "mit Beleg als Preisquelle, 4 l = 4000 ml", JSON.stringify(zb && zb.args));
    pruef(!kons.length, "keine Seitenfehler", kons.join(" | "));
    await ctx.close();
  }
  {
    /* Entwurf an den anderen eigenen Standort, mit Kopie der Datei */
    const { ctx, p, kons } = await oeffnen(browser, mitLager());
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="belege"]'); await p.click('#belegListe [data-beleg="be-entwurf"]'); await p.waitForTimeout(150);
    const ziele = await p.evaluate(() => [...document.querySelectorAll("#eVerschiebenZiel option")].map(o => o.value));
    pruef(ziele.join() === "b-zwei", "Verschieben: nur der andere eigene Standort", ziele.join());
    await p.evaluate(() => { window.__D.antworten.beleg_verschieben = { ok:false, grund:"datei" }; });
    await p.click('[data-aktion="beleg-verschieben"]'); await p.waitForTimeout(300);
    const v1 = (await rufe(p, "beleg_verschieben"))[0], hoch = await p.evaluate(() => window.__hoch), geladen = await p.evaluate(() => window.__geladen);
    pruef(geladen === BETRIEB + "/11111111-2222-4333-8444-555555555555.jpg" && hoch && /^b-zwei\/[0-9a-f-]{36}\.jpg$/.test(hoch.pfad) && hoch.eimer === "belege",
      "alte Datei geladen, Kopie in den Ordner des Ziels hochgeladen", JSON.stringify({ geladen, hoch }));
    pruef(v1 && v1.args.p_beleg === "be-entwurf" && v1.args.p_ziel === "b-zwei" && v1.args.p_pfad === hoch.pfad && Object.keys(v1.args).sort().join() === SIG6.beleg_verschieben.join(),
      "beleg_verschieben mit Beleg, Ziel und dem Pfad der Kopie", JSON.stringify(v1 && v1.args));
    pruef(/Kopie der Rechnung ist im anderen Standort nicht angekommen/.test(await p.textContent("#eMeldung")), "Grund „datei“ → eigener Satz", await p.textContent("#eMeldung"));
    await p.evaluate(() => { window.__D.antworten.beleg_verschieben = { ok:true, id:"be-entwurf", betrieb:"b-zwei" }; });
    await p.click('[data-aktion="beleg-verschieben"]'); await p.waitForTimeout(400);
    pruef(/Café Zwei/.test(await p.textContent("#betriebName")) && /Café Zwei/.test(await p.textContent("#toast")), "danach steht der Standort des Ziels offen", await p.textContent("#toast"));
    pruef(!kons.length, "keine Seitenfehler", kons.join(" | "));
    await ctx.close();
  }
  {
    const d = mitLager(); d.dlFehler = true;
    const { ctx, p } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="belege"]'); await p.click('#belegListe [data-beleg="be-entwurf"]'); await p.waitForTimeout(150);
    await p.click('[data-aktion="beleg-verschieben"]'); await p.waitForTimeout(300);
    pruef(!(await rufe(p, "beleg_verschieben")).length && /nicht kopieren/.test(await p.textContent("#eMeldung")), "Datei nicht ladbar → Satz, NICHT verschoben (sonst Beleg ohne Datei)");
    await ctx.close();
  }
  {
    /* Team: sieht Unterwegs, kann nichts buchen */
    const d = mitLager(); d.mitglieder[0].rolle = "manager"; d.rolle = "manager"; d.antworten.meine_rechte = { rolle: "manager", rechte: Object.assign({}, KEINE_RECHTE, { kosten_view:true }) };
    const { ctx, p } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.selectOption("#betriebWahl", BETRIEB); await p.waitForTimeout(150);
    await p.click('.reiter [data-ansicht="lager"]'); await p.waitForTimeout(100);
    const tm = await p.evaluate(() => ({ an: !!document.querySelector('[data-aktion="um-annehmen"]') && document.querySelector('[data-aktion="um-annehmen"]').offsetParent !== null,
      form: document.getElementById("umNeuKarte").offsetParent !== null, ein: /Von Café Zwei/.test(document.getElementById("umEin").textContent) }));
    pruef(tm.ein && !tm.an && !tm.form, "Manager sieht, was unterwegs ist, kann aber weder annehmen noch schicken", JSON.stringify(tm));
    await ctx.close();
  }

  /* ── E5-C · Sortiment, Lieferanten je Standort, Nachbestellen, Zählliste ── */
  console.log("\n══ 17 · Sortiment und Nachbestellen je Standort (E5-C) ══");
  const mitSortiment = () => { const d = grundDaten("inhaber");
    /* 30,5 l mind., 18 l da → 12,5 l fehlen: KEIN Vielfaches der 0,75-l-Flasche,
       sonst rundeten auf und ab gleich (§8.1g F). */
    d.artikel_standort = [{ betrieb_id: BETRIEB, artikel_id:"a-wein", aktiv:true, mindestbestand:30500, lagerort:"Bar", reihenfolge:null },
                          { betrieb_id: BETRIEB, artikel_id:"a-mehl", aktiv:true, mindestbestand:null, lagerort:"Keller", reihenfolge:null },
                          { betrieb_id: "b-anders", artikel_id:"a-mehl", aktiv:false, mindestbestand:1, lagerort:"Fremd", reihenfolge:null }];
    d.lieferanten_standort = [{ betrieb_id: BETRIEB, lieferant_id:"l-1", kundennummer:"K-HIER", ansprechpartner:null, liefertage:["mo","do"], mindestbestellwert:200 }];
    d.inventur_entwurf = [{ betrieb_id: BETRIEB, daten:{ "a-mehl":"2,5" }, stichtag:"2026-10-16T18:00:00Z", geaendert:"2026-10-16T18:05:00Z" }];
    return d; };
  {
    const { ctx, p, kons } = await oeffnen(browser, mitSortiment());
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.evaluate(() => { window.__kopiert = null; navigator.clipboard.writeText = async t => { window.__kopiert = t; }; });
    await p.click('.reiter [data-ansicht="lager"]'); await p.waitForTimeout(100);
    const nb = await p.evaluate(() => ({ text: (document.querySelector("[data-nachtext]") || {}).textContent || "", karte: document.getElementById("nachListe").textContent,
      wa: (document.querySelector('#nachListe a[href^="https://wa.me/"]') || {}).href || "", um: document.getElementById("umTeil").hidden }));
    pruef(/Bestellung Café Probe — Kd\.-Nr\. K-HIER/.test(nb.text) && /• 17 × Flasche Wein 0,75 l \(je 750 ml\)/.test(nb.text),
      "Wein: 30,5 l mind., 18 l da → 12,5 l fehlen = 17 Flaschen (aufgerundet), Bezeichnung des Lieferanten, Kd.-Nr. DIESES Standorts", nb.text);
    pruef(!/Mehl/.test(nb.text), "Mehl ohne Mindestbestand steht nicht auf der Liste (der fremde Standort setzt ihn nicht)");
    pruef(/ca\. 91,80\s€/.test(nb.karte) && /Mindestbestellwert von 200,00\s€/.test(nb.karte) && /Liefert Mo, Do/.test(nb.karte), "unter dem Mindestbestellwert (91,80 €) gesagt, Liefertage genannt", nb.karte.slice(0, 160));
    pruef(nb.wa && decodeURIComponent(nb.wa.split("text=")[1]) === nb.text && nb.um, "WhatsApp-Link trägt genau den Text; ohne Kette kein Umlagerungsteil");
    await p.click('[data-aktion="nach-kopieren"]'); await p.waitForTimeout(100);
    pruef((await p.evaluate(() => window.__kopiert)) === nb.text && !(await rufe(p, "umlagerung_anlegen")).length, "„Text kopieren“ legt genau den Text ab, verschickt nichts");
    /* Artikel: Standort-Angaben */
    await p.click('.reiter [data-ansicht="artikel"]');
    await p.click('[data-aktion="artikel-auf"][data-id="a-mehl"]');
    await p.fill("#soMin", "abc"); await p.click('[data-aktion="sort-sichern"]'); await p.waitForTimeout(100);
    pruef(!(await rufe(p, "artikel_standort_setzen")).length && /Mindestbestand/.test(await p.textContent("#soMeldung")), "unlesbarer Mindestbestand → Satz, kein Aufruf");
    await p.fill("#soMin", "5"); await p.fill("#soOrt", " Keller ");
    await p.click('[data-aktion="sort-sichern"]'); await p.waitForTimeout(250);
    const ss = (await rufe(p, "artikel_standort_setzen"))[0];
    pruef(ss && ss.args.p_betrieb === BETRIEB && ss.args.p_artikel === "a-mehl" && JSON.stringify(ss.args.p_daten) === JSON.stringify({ aktiv:true, mindestbestand:5000, lagerort:"Keller", reihenfolge:null })
      && Object.keys(ss.args).sort().join() === SIG8.artikel_standort_setzen.join(), "5 kg → 5000 g, Lagerort getrimmt, genau die Parameter", JSON.stringify(ss && ss.args));
    /* Die Zeile bleibt nach dem Sichern offen. */
    await p.click('[data-aktion="sort-aktiv"][data-id="a-mehl"]'); await p.waitForTimeout(250);
    const sa = (await rufe(p, "artikel_standort_setzen"))[1];
    pruef(sa && sa.args.p_daten.aktiv === false, "„Hier nicht mehr führen“ → aktiv false nur für diesen Standort", JSON.stringify(sa && sa.args.p_daten));
    /* Lieferant je Standort */
    await p.click('.reiter [data-ansicht="lieferanten"]');
    await p.click('[data-aktion="lief-auf"][data-id="l-1"]');
    const vor = await p.evaluate(() => ({ kunde: document.getElementById("lsKunde").value, mo: document.querySelector('[data-tag="mo"]').getAttribute("aria-pressed") }));
    pruef(vor.kunde === "K-HIER" && vor.mo === "true", "gespeicherte Angaben dieses Standorts stehen im Formular", JSON.stringify(vor));
    await p.click('[data-tag="do"]'); await p.click('[data-tag="fr"]');
    await p.fill("#lsMbw", "150,50");
    await p.click('[data-aktion="lst-sichern"]'); await p.waitForTimeout(250);
    const ls = (await rufe(p, "lieferant_standort_setzen"))[0];
    pruef(ls && JSON.stringify(ls.args.p_daten) === JSON.stringify({ kundennummer:"K-HIER", ansprechpartner:null, liefertage:["mo","fr"], mindestbestellwert:150.5 })
      && Object.keys(ls.args).sort().join() === SIG8.lieferant_standort_setzen.join(), "Liefertage umgeschaltet (Do aus, Fr an), 150,50 € gelesen", JSON.stringify(ls && ls.args));
    pruef(!kons.length, "keine Seitenfehler", kons.join(" | "));
    await ctx.close();
  }
  {
    /* Zählliste: Lagerort-Reihenfolge, Zwischenstand, Stichtag */
    const d = mitSortiment();
    d.artikel_standort[0].aktiv = false;   /* Wein hier nicht mehr geführt, aber 18 l Bestand */
    const { ctx, p } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="artikel"]');
    pruef(/nicht hier/.test(await p.textContent("#artikelListe")), "Artikel hier abgeschaltet → „nicht hier“");
    await p.click("#inventurKnopf");
    const z = await p.evaluate(() => ({ reihe: [...document.querySelectorAll("#invListe h4, #invListe [data-inv]")].map(e => e.tagName === "H4" ? "#" + e.textContent : e.dataset.inv),
      mehl: document.querySelector('[data-inv="a-mehl"]')?.value, stand: !document.getElementById("invStand").hidden, wein: document.querySelector('[data-inv="a-wein"]')?.closest("label").textContent || "(Wein fehlt in der Zählliste)",
      stich: document.getElementById("invStichtag").value }));
    pruef(z.reihe.join() === "#Bar,a-wein,#Keller,a-mehl", "Zählliste nach Lagerort (Bar vor Keller), mit Überschriften", z.reihe.join());
    pruef(z.mehl === "2,5" && z.stand && /hier nicht mehr geführt/.test(z.wein), "Zwischenstand aus der Datenbank vorausgefüllt; nicht mehr geführter Wein mit Bestand bleibt zählbar", JSON.stringify(z));
    await p.click('.reiter [data-ansicht="belege"]'); await p.click("#belegNeu");
    const opt = await p.evaluate(() => [...document.querySelectorAll('[data-f="artikel_id"] option')].map(o => o.value).filter(Boolean));
    pruef(!opt.includes("a-wein") && opt.includes("a-mehl"), "im Beleg nicht mehr wählbar, was hier nicht geführt wird", opt.join());
    await p.click('.reiter [data-ansicht="artikel"]'); await p.click("#inventurKnopf");
    if(await p.isHidden("#inventurKarte")) await p.click("#inventurKnopf");
    await p.fill('[data-inv="a-wein"]', "17");
    await p.fill("#invStichtag", "2026-10-16T20:00");
    await p.click("#invZwischen"); await p.waitForTimeout(250);
    const zw = (await rufe(p, "inventur_entwurf_sichern"))[0];
    pruef(zw && zw.args.p_daten["a-wein"] === "17" && zw.args.p_daten["a-mehl"] === "2,5" && zw.args.p_stichtag === new Date("2026-10-16T20:00").toISOString()
      && Object.keys(zw.args).sort().join() === SIG8.inventur_entwurf_sichern.join(), "Zwischenstand: getippte Werte wie getippt, Stichtag als Zeitpunkt", JSON.stringify(zw && zw.args));
    await p.evaluate(() => { window.__D.antworten.inventur_buchen = { ok:false, grund:"stichtag" }; });
    await p.click("#invBuchen"); await p.waitForTimeout(250);
    const ib = (await rufe(p, "inventur_buchen"))[0];
    pruef(ib && ib.args.p_stichtag === new Date("2026-10-16T20:00").toISOString() && /62 Tage/.test(await p.textContent("#invMeldung")), "Buchen schickt den Stichtag; Grund „stichtag“ als Satz", JSON.stringify(ib && ib.args.p_stichtag));
    await ctx.close();
  }
  {
    const d = mitSortiment(); d.leseFehler = { artikel_standort: { message:"relation does not exist", code:"42P01" } };
    const { ctx, p, kons } = await oeffnen(browser, d);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    await p.click('.reiter [data-ansicht="lager"]'); await p.waitForTimeout(100);
    pruef(/migration-einkauf-e5c/.test(await p.textContent("#nachListe")) && /R-100/.test(await p.evaluate(() => JSON.stringify(window.__D.einkaufsbelege))) && !kons.length,
      "ohne E5-C-Migration: Satz im Lager, Rest der Seite lädt weiter");
    await p.click('.reiter [data-ansicht="belege"]');
    pruef(/R-100/.test(await p.textContent("#belegListe")), "… Belege weiterhin da");
    await ctx.close();
  }

  /* ── 12 · Maße, Kontrast, Überlauf ─────────────────────────────── */
  console.log("\n══ 11 · 360 und 1280 px ══");
  for(const breite of [360, 1280]){
    /* Zwei eigene Standorte in einer Kette: dann stehen auch „Standorte“
       und „In anderen Standort übernehmen“ im Bild und werden mitgemessen. */
    const d = zweiStandorte("inhaber", ORG); d.antworten.meine_ketten = KETTE_ANTWORT; d.antworten.zentrale_vergleich = VERGLEICH_ANTWORT;
    d.antworten.kette_standorte = [{ id:"b-zwei", name:"Café Zwei mit einem recht langen Namen" }];
    d.artikel_standort = [{ betrieb_id: BETRIEB, artikel_id:"a-wein", aktiv:true, mindestbestand:30000, lagerort:"Bar", reihenfolge:null }];
    d.lieferanten_standort = [{ betrieb_id: BETRIEB, lieferant_id:"l-1", kundennummer:"K-HIER-SEHR-LANG-0001234567", ansprechpartner:null, liefertage:["mo","do"], mindestbestellwert:200 }];
    d.umlagerungen = [{ id:"u-m", von_betrieb:"b-zwei", nach_betrieb:BETRIEB, status:"unterwegs", notiz:null, angelegt:"2026-10-16T08:00:00Z",
      umlagerungspositionen:[{ pos:1, artikel_id:"a-wein", menge_basis:3000, wert_netto:18, menge_angekommen:null }] }];
    const { ctx, p } = await oeffnen(browser, d, breite);
    await p.waitForSelector("#app:not([hidden])", { timeout: 5000 });
    for(const ansicht of ["uebersicht", "belege", "artikel", "kalkulation", "kalk-edit", "lieferanten", "lager", "standorte"]){
      await p.click('.reiter [data-ansicht="' + (ansicht === "kalk-edit" ? "kalkulation" : ansicht) + '"]');
      if(ansicht === "kalk-edit") await p.click('[data-gericht="g-pizza"]');
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
