/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Naht zwischen Hub und Datenbank

     node pruefungen/pruef-naht.js

   ── DER VORFALL, DER DIESE PRÜFUNG ERZWUNGEN HAT ──────────────────

   Der Gast konnte nicht stornieren. Der Hub schickte die UUID der
   Zeile (`bestellungen.id`), die SQL suchte über die Quittungsnummer
   (`gast_kennung`). Eine UUID ist nie eine Quittungsnummer — also nie
   ein Treffer, also „Das geht hier gerade nicht." Derselbe Fehler
   stand ein zweites Mal in bestellung_restzeit; dort fiel er stumm
   aus, und der Countdown war monatelang tot, ohne dass es jemand
   meldete.

   Gefunden hat es KEINE der 30 Prüfungen. Der Grund ist die
   eigentliche Lehre: pruef-storno.js STELLT die Serverantwort NACH
   (`page.route(...)`). Der Test beweist, dass die Oberfläche richtig
   reagiert — nie, dass die beiden Hälften zusammenpassen. Jede Hälfte
   wurde gegen eine Erfindung der anderen geprüft, und beide Tests
   waren grün, während die Sache kaputt war. Das ist CLAUDE.md §8.1a
   eine Ebene tiefer: Wer Bausteine prüft, findet nicht, was ZWISCHEN
   ihnen fehlt.

   Diese Prüfung hält deshalb die zweite Quelle dagegen: Was der Hub
   schickt, gegen die Spalte, über die die Datenbank sucht.

   ── DIE EHRLICHE GRENZE ───────────────────────────────────────────

   Sie liest DATEIEN. Sie kann nicht wissen, ob die Migration in der
   echten Datenbank auch eingespielt ist — dort steht möglicherweise
   noch die alte Fassung. Das beweisen nur die Proben am Ende von
   datenbank/migration-bestellnummer.sql, gefahren im SQL-Editor.
   Eine Grenze, die man nennt, ist keine Lücke.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");

const WURZEL = path.join(__dirname, "..");
const DB     = path.join(WURZEL, "datenbank");
const HUB    = path.join(WURZEL, "vorlagen", "hub.vorlage.html");

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

if(!fs.existsSync(HUB)){
  console.error("vorlagen/hub.vorlage.html nicht gefunden.");
  process.exit(1);
}

/* SQL-Zeilenkommentare weg, BEVOR gesucht wird. Sonst zählt der
   Befundtext im Kopf einer Migration als Code — und der zitiert die
   falsche Zeile absichtlich. */
function ohneKommentare(s){
  return s.split("\n").map(z => z.replace(/--.*$/, "")).join("\n");
}

/* Eine Funktion, die als überholt markiert ist, wird übersprungen —
   aber laut, mit Namen. Der Marker muss sagen, WER sie ablöst; sonst
   ist er nur ein Weg, eine Prüfung stillzulegen. */
const MARKER = /ÜBERHOLT durch ([a-z0-9.\-]+\.sql)/i;

console.log("══ Jede Bestellfunktion sucht über dieselbe Spalte ══");

const dateien = fs.readdirSync(DB).filter(n => n.endsWith(".sql")).sort();
let gefunden = 0, uebersprungen = [];

for(const name of dateien){
  const roh = fs.readFileSync(path.join(DB, name), "utf8");
  const text = ohneKommentare(roh);

  /* Jede Funktionsdefinition einzeln herausschneiden: vom „create or
     replace function" bis zum nächsten — oder bis zum Dateiende. */
  const stellen = [...text.matchAll(/create\s+or\s+replace\s+function\s+public\.(bestellung_[a-z_]+)\s*\(/gi)];

  for(let i = 0; i < stellen.length; i++){
    const fname = stellen[i][1];
    const von   = stellen[i].index;
    const bis   = i + 1 < stellen.length ? stellen[i + 1].index : text.length;
    const koerper = text.slice(von, bis);

    /* Nur Funktionen, die eine Bestellung über einen Parameter
       „nummer" heraussuchen. Alles andere geht diese Prüfung nichts
       an. */
    const suchen = [...koerper.matchAll(/where\s+(?:[a-z_]+\.)?([a-z_]+)\s*=\s*nummer\b/gi)];
    if(!suchen.length) continue;

    /* Steht der Marker im ROHTEXT über dieser Stelle? Gesucht wird im
       Kommentarblock unmittelbar davor — 600 Zeichen reichen dafür. */
    const rohVon = roh.indexOf("function public." + fname);
    const davor  = roh.slice(Math.max(0, rohVon - 600), rohVon);
    const m = davor.match(MARKER);
    if(m){
      uebersprungen.push(name + " · " + fname + " (abgelöst von " + m[1] + ")");
      pruef(fs.existsSync(path.join(DB, m[1])),
        name + " · " + fname + ": die ablösende Datei gibt es wirklich", m[1]);
      continue;
    }

    gefunden++;
    const spalten = [...new Set(suchen.map(s => s[1].toLowerCase()))];
    pruef(spalten.length === 1 && spalten[0] === "id",
      name + " · " + fname + "() sucht über die id",
      "gefunden: " + spalten.join(", "));
  }
}

pruef(gefunden > 0, "es wurde überhaupt eine gültige Definition geprüft",
  gefunden + " Funktion(en)");
if(uebersprungen.length){
  console.log("  (übersprungen, weil abgelöst)");
  uebersprungen.forEach(u => console.log("     " + u));
}

console.log("\n══ Was der Hub in „nummer\" hineinlegt ══");

const hub = fs.readFileSync(HUB, "utf8");

/* 1 · Der Wert selbst muss aus der id der Zeile stammen. */
pruef(/const\s+nummer\s*=\s*zeile\s*&&\s*zeile\.id\s*\?\s*zeile\.id/.test(hub),
  "letzteBestellung.nummer wird aus zeile.id gefüllt");

/* 2 · Auch der Weg nach einem Verbindungsabbruch reicht die id
       weiter — nicht die Kennung, mit der dort gesucht wurde. */
pruef(/wsErfolg\(\s*e\s*,\s*\{\s*id:\s*da\.id\s*\}\s*\)/.test(hub),
  "die Wiederfindung reicht ebenfalls die id weiter");

/* 3 · Nirgends darf eine Kennung als „nummer" verschickt werden.
       Genau diese Verwechslung war der Fehler. */
const falsch = [...hub.matchAll(/nummer\s*:\s*([A-Za-z_$][\w.$]*)/g)]
  .map(m => m[1])
  .filter(v => /kennung/i.test(v));
pruef(falsch.length === 0,
  "keine Kennung wird als „nummer\" verschickt",
  falsch.length ? falsch.join(", ") : "keine");

/* 4 · Und die Gegenrichtung: bestellung_gefunden sucht über die
       Kennung und MUSS deshalb „kennung" heißen, nicht „nummer".
       Sonst hätte man zwei Bedeutungen unter einem Namen — die
       Wurzel des ganzen Vorfalls. */
const gefundenRuf = hub.match(/rpc\/bestellung_gefunden[\s\S]{0,400}?body:\s*JSON\.stringify\(\s*\{([^}]*)\}/);
pruef(gefundenRuf && /kennung\s*:/.test(gefundenRuf[1]),
  "bestellung_gefunden wird mit „kennung\" gerufen, nicht mit „nummer\"",
  gefundenRuf ? gefundenRuf[1].trim().slice(0, 60) : "Aufruf nicht gefunden");

console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
process.exit(fehler ? 1 : 0);
