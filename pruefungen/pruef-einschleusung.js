/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Eingeschleuster Code aus Live-Spalten führt im Hub nichts aus

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-einschleusung.js

   Anlass (Sicherheits-Sweep 19.10.): Name, Beschreibung, Kategorie,
   Aktionstitel, Pausentext, hub_woerter und Übersetzungen kamen roh in
   innerHTML und Attribute; `<img src=x onerror=…>` (28 Zeichen, unter
   jeder Längenschranke) lief bei jedem Gast. CLAUDE.md §2.3a verlangte
   das Gegenteil, die Prüfungen sahen es nicht: Sie setzten Anführungs-
   zeichen in EIN Feld, nicht in alle.

   Gemessen wird das Ergebnis, nicht der Quelltext: `pruefungen/werkzeug/
   hub-vergiftet.js` stellt die Antworten der Datenbank nach, JEDES Feld
   trägt eine eigene Marke, und die Nutzlast ruft `__x.push(Marke)` auf.
   Jede Marke in `gefeuert` ist ein Befund. Fünf Nutzlast-Arten (Tag,
   JS-String, Attribut mit " und mit ', javascript:-URL), zwei Sprachen.

   Voraussetzungen (§8.1g): die Marken müssen im DOM ANKOMMEN. „Nichts
   gefeuert“ gilt nur für Felder, die erreicht wurden — die Liste unten
   ist die Mindestmenge. Gegenbeweis im Worktree auf dem alten Stand.
   Ehrliche Grenze: Die Datenbank ist nachgestellt, nicht befragt; nicht
   erreicht werden WLAN, Lieferung, hub_stil (nur Positivlisten gelesen).
   ═══════════════════════════════════════════════════════════════════ */
const { spawnSync } = require("child_process");
const path = require("path");
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };
const WERKZEUG = path.join(__dirname, "werkzeug", "hub-vergiftet.js");
const MINDESTENS = ["gericht.name.speisekarte", "gericht.beschreibung.speisekarte", "gericht.kategorie.speisekarte",
  "gericht.stoff_hinweis", "betrieb.bestell_pause_text", "aktion.titel", "texte.claim", "texte.ueber", "texte.karte_titel", "texte.karte_text", "texte.karte_kopfzeile", "kachel.titel", "banner.titel"];
/* Auf Englisch ersetzt die Übersetzungsspalte die Beschreibung: dort zählt die statt ihrer. */
const MINDESTENS_EN = MINDESTENS.map(m => m === "gericht.beschreibung.speisekarte" ? "gericht.uebersetzungen.en" : m)
  .concat(["gericht.name_uebersetzungen.en", "woerter.*"]);
const LAEUFE = [["html", "de"], ["attr", "de"], ["sq", "de"], ["js", "de"], ["url", "de"], ["html", "en"], ["attr", "en"]];
const haus = process.env.HAUS || "chocolamour";

for(const [art, sprache] of LAEUFE){
  console.log("\n══ " + haus + " · Nutzlast „" + art + "“ · " + sprache + " ══");
  const r = spawnSync("node", [WERKZEUG, haus, art, sprache], { encoding: "utf8", timeout: 240000, env: process.env });
  const aus = (r.stdout || "") + (r.stderr || "");
  const gef = /gefeuert: (\[.*\])/.exec(aus), err = /ERREICHT\(Marke im DOM\): (\[.*\])/.exec(aus), pe = /pageerrors: (\[.*)/.exec(aus);
  pruef(!!gef && !!err, "Voraussetzung: der Lauf hat gemessen", gef ? "ja" : aus.slice(-200));
  if(!gef || !err) continue;
  const erreicht = JSON.parse(err[1]), gefeuert = JSON.parse(gef[1]);
  const soll = sprache === "en" ? MINDESTENS_EN : MINDESTENS;
  const fehlt = soll.filter(m => !erreicht.includes(m));
  pruef(!fehlt.length, "Voraussetzung: die Marken kamen im DOM an (Mindestmenge " + soll.length + " Felder)", fehlt.join(", ") || erreicht.length + " Felder erreicht");
  pruef(!gefeuert.length, "keine Nutzlast wurde ausgeführt", gefeuert.length ? gefeuert.slice(0, 4).join(" | ") : "0 von " + erreicht.length + " Feldern");
  pruef(!pe || /pageerrors: \[\]/.test(pe[0]), "kein Seitenfehler");
}
console.log("\n" + (f ? f + " von " + n + " FEHLGESCHLAGEN" : "Alles sauber (" + n + ")"));
process.exit(f ? 1 : 0);
