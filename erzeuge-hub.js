#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   ERZEUGE-HUB

   Baut aus einer Vorlage und einem Markenblatt eine fertige
   Hub-Datei.

       node erzeuger/erzeuge-hub.js chocolamour
       node erzeuger/erzeuge-hub.js chocolamour --pruefen-nur
       node erzeuger/erzeuge-hub.js --alle

   Warum das der wichtigste Baustein ist: Bisher stand das
   Markenblatt nur in der ausgelieferten Datei und wurde von Hand
   gepflegt. Damit kostete jeder Neukunde Handarbeit — und eine
   Testversion, eine Selbstregistrierung oder auch nur zwanzig
   Kunden waren damit unmöglich.

   Was NICHT passiert: Der Hub lädt das Markenblatt nicht zur
   Laufzeit. Es steht weiterhin fest in der Datei, damit die Farben
   beim ersten Bildaufbau da sind. Erzeugt statt geladen — das ist
   der Unterschied.

   Ohne Abhängigkeiten. Kein npm install, kein Bauwerkzeug. Läuft in
   jeder Cloud-Sitzung und auf jedem Rechner mit Node.
   ═══════════════════════════════════════════════════════════════ */
"use strict";

const fs   = require("fs");
const path = require("path");

/* ─── Wo die Dateien liegen ───────────────────────────────────
   Zwei Formen sind erlaubt, und zwar aus einem praktischen Grund:
   Die dokumentierte Ordnerform (vorlagen/, markenblaetter/, dist/)
   ist die Zielform. Wer aber vom iPhone aus arbeitet, lädt Dateien
   flach in ein Verzeichnis hoch — dann liegt alles nebeneinander.
   Der Erzeuger sucht deshalb erst die Ordnerform und nimmt sonst
   das, was neben ihm liegt. Ohne diese zehn Zeilen bricht er im
   flachen Verzeichnis mit „ENOENT vorlagen/hub.vorlage.html" ab,
   und niemand sieht, dass nur der Pfad falsch war. */
const HIER     = __dirname;
const OBEN     = path.resolve(__dirname, "..");
const nimm     = (...kandidaten) => kandidaten.find(p => fs.existsSync(p)) || kandidaten[0];

const VORLAGE  = nimm(path.join(OBEN, "vorlagen", "hub.vorlage.html"),
                      path.join(HIER, "hub.vorlage.html"));
const BLAETTER = nimm(path.join(OBEN, "markenblaetter"),
                      HIER);
const WURZEL   = fs.existsSync(path.join(OBEN, "vorlagen")) ? OBEN : HIER;
const ZIEL     = path.join(WURZEL, "dist");

/* ─── Schriften und Schatten ──────────────────────────────────
   Muss deckungsgleich mit dem sein, was in der Vorlage steht.
   Deshalb wird es unten auch geprüft, statt es zu hoffen. */
const SCHRIFTEN = ["system","serif-klassisch","serif-eng","grotesk","rund"];
const SCHATTEN  = ["weich","kante","ohne"];

const FARBEN_PFLICHT = ["grund","flaeche","flaeche2","band","bandText",
  "tinte","tinteLeise","tinteStill","linie","linieStark",
  "akzent","akzent2","gut"];

/* ─── Farbrechnung ────────────────────────────────────────────
   Dieselbe Rechnung wie im Hub, im Studio und auf der
   Landingpage. Vier Kopien wären drei zu viel — aber solange die
   Zielumgebungen keine Module laden, ist die Kopie hier der Preis
   dafür, dass die PRÜFUNG überhaupt stattfindet. */
function helligkeit(hex){
  const h = String(hex||"").replace("#","");
  if(!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const v = [0,2,4].map(i => {
    const x = parseInt(h.slice(i,i+2),16)/255;
    return x <= .03928 ? x/12.92 : Math.pow((x+.055)/1.055, 2.4);
  });
  return .2126*v[0] + .7152*v[1] + .0722*v[2];
}
function kontrast(a,b){
  const l1 = helligkeit(a), l2 = helligkeit(b);
  if(l1 === null || l2 === null) return null;
  return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
}

/* ─── Prüfung ─────────────────────────────────────────────────
   Trennt bewusst zwischen FEHLER (Erzeugen wird abgebrochen) und
   WARNUNG (wird erzeugt, aber gemeldet).

   Ein zu schwacher Kontrast ist eine Warnung, kein Fehler: Es gibt
   Fälle, in denen ein Betrieb seine Hausfarbe bewusst will. Ein
   fehlender Pflichtwert dagegen ergäbe eine kaputte Datei — das
   darf nicht durchgehen. */
function pruefeMarkenblatt(mb){
  const fehler = [], warnung = [];
  const F = t => fehler.push(t), W = t => warnung.push(t);

  if(!mb || typeof mb !== "object") { F("Markenblatt ist kein Objekt"); return {fehler,warnung}; }
  if(mb.version !== 1) F("version muss 1 sein, ist: " + JSON.stringify(mb.version));

  /* Betrieb */
  const b = mb.betrieb || {};
  if(!b.name)  F("betrieb.name fehlt");
  if(!b.slug)  F("betrieb.slug fehlt");
  if(b.slug && !/^[a-z0-9-]{2,40}$/.test(b.slug))
    F("betrieb.slug darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten: " + b.slug);
  if(!b.claim) W("betrieb.claim ist leer — im Kopfband steht dann nichts unter dem Namen");

  /* Farben */
  const f = mb.farben || {};
  FARBEN_PFLICHT.forEach(k => {
    if(!f[k]) F("farben." + k + " fehlt");
    else if(!/^#[0-9a-fA-F]{6}$/.test(f[k]))
      F("farben." + k + " ist keine sechsstellige Hexfarbe: " + f[k]);
  });

  /* Abend */
  const a = mb.abend || {};
  if(a.an){
    if(typeof a.ab !== "number" || a.ab < 12 || a.ab > 23)
      F("abend.ab muss eine Stunde zwischen 12 und 23 sein, ist: " + a.ab);
    ["grund","flaeche","tinte","akzent"].forEach(k => {
      if(!a[k]) F("abend." + k + " fehlt, obwohl abend.an true ist");
    });
  }

  /* Form */
  const fo = mb.form || {};
  ["rundung","rundungKlein","rand"].forEach(k => {
    if(typeof fo[k] !== "number") F("form." + k + " fehlt oder ist keine Zahl");
  });
  if(fo.schatten && SCHATTEN.indexOf(fo.schatten) < 0)
    F("form.schatten unbekannt: " + fo.schatten + " — erlaubt: " + SCHATTEN.join(", "));

  /* Schrift */
  const s = mb.schrift || {};
  ["kopf","text"].forEach(k => {
    if(!s[k]) F("schrift." + k + " fehlt");
    else if(SCHRIFTEN.indexOf(s[k]) < 0)
      F("schrift." + k + " unbekannt: " + s[k] + " — erlaubt: " + SCHRIFTEN.join(", "));
  });
  if(s.groesse != null && (s.groesse < 0.9 || s.groesse > 1.2))
    F("schrift.groesse muss zwischen 0.9 und 1.2 liegen, ist: " + s.groesse);

  /* Bereiche */
  const ber = mb.bereiche || {};
  if(!Object.keys(ber).some(k => ber[k]))
    F("kein einziger Bereich eingeschaltet — der Gast sähe eine leere Startseite");

  /* ─── Inhalt des Hauses ─────────────────────────────────────
     Fehlt einer dieser Blöcke, zeigt der Hub den Platzhalter aus der
     Vorlage. Das ist kein Fehler — ein Haus ohne WLAN braucht kein
     WLAN —, aber es muss gesagt werden. Vorher standen diese Werte
     fest im Gerüst, und der zweite Kunde hätte die des ersten
     bekommen, ohne dass es irgendwo aufgefallen wäre. */
  if(!b.telefon && !b.mail) W("betrieb.telefon und betrieb.mail fehlen — die Kontaktseite bleibt leer");
  if(!Array.isArray(mb.zeiten) || mb.zeiten.length !== 7)
    W("zeiten fehlt oder hat nicht sieben Einträge (Sonntag zuerst) — der Hub zeigt „—\"");
  if(!mb.links || !mb.links.bewertung)
    W("links.bewertung fehlt — die Kachel „Uns bewerten\" führt ins Leere");
  if(mb.bereiche && mb.bereiche.wlan && (!mb.wlan || !mb.wlan.netz))
    W("wlan ist eingeschaltet, aber wlan.netz fehlt");
  if(!Array.isArray(mb.empfehlung) || !mb.empfehlung.length)
    W("empfehlung fehlt — auf der Startseite steht dann keine");
  if(mb.avatar && ["freundlich","ruhig","witzig"].indexOf(mb.avatar.art) < 0)
    F("avatar.art unbekannt: " + mb.avatar.art + " — erlaubt: freundlich, ruhig, witzig");
  /* Fehler, nicht Hinweis: Ein Tippfehler in figur ergäbe im Hub
     wortlos wieder den Untersetzer. Der Kunde hätte seine Figur
     ausgewählt und bekäme sie nicht — und niemand sagt es ihm. */
  if(mb.avatar && mb.avatar.figur !== undefined &&
     ["untersetzer","erdbeere"].indexOf(mb.avatar.figur) < 0)
    F("avatar.figur unbekannt: " + mb.avatar.figur + " — erlaubt: untersetzer, erdbeere");

  /* Kontrast, Tag und Abend */
  const pruefePaare = (farben, wann) => {
    [
      ["Schrift auf Grund",       farben.tinte,      farben.grund],
      ["Nebentext auf Karte",     farben.tinteLeise, farben.flaeche],
      ["Schrift im Kopfband",     farben.bandText,   farben.band],
      ["Hauptfarbe auf Karte",    farben.akzent,     farben.flaeche]
    ].forEach(([name, v, g]) => {
      const k = kontrast(v, g);
      if(k === null) return;
      if(k < 4.5) W(wann + ": " + name + " liegt bei " + k.toFixed(1) + ":1 (4,5:1 wären lesbar)");
    });
  };
  pruefePaare(f, "Tag");
  if(a.an) pruefePaare(Object.assign({}, f, a), "Abend");

  return {fehler, warnung};
}

/* ─── Markenblatt als lesbaren Quelltext schreiben ────────────
   Von Hand gesetzt statt JSON.stringify: Der Block steht im
   Quelltext der Hub-Datei und soll dort auch von Hand
   nachgebessert werden können. Eine einzeilige JSON-Zeile kann
   das nicht. */
function alsQuelltext(mb){
  const z = (schl, wert, einzug) => {
    const w = typeof wert === "string" ? '"' + wert.replace(/"/g,'\\"') + '"'
            : typeof wert === "boolean" ? String(wert)
            : typeof wert === "number"  ? String(wert)
            : JSON.stringify(wert);
    return einzug + (schl + ":").padEnd(15) + w + ",";
  };
  const block = (name, obj, reihenfolge) => {
    const schluessel = (reihenfolge || Object.keys(obj))
      .filter(k => obj[k] !== undefined);
    const zeilen = schluessel.map(k => z(k, obj[k], "    "));
    zeilen[zeilen.length-1] = zeilen[zeilen.length-1].replace(/,$/,"");
    return "  " + name + ": {\n" + zeilen.join("\n") + "\n  },";
  };

  const kopf =
"/* ═══ MARKENBLATT ═══════════════════════════════════════════\n" +
"   " + mb.betrieb.name + "\n" +
"\n" +
"   ERZEUGT — nicht von Hand bearbeiten.\n" +
"   Die Quelle ist betriebe.markenblatt in der Datenbank bzw.\n" +
"   markenblaetter/" + mb.betrieb.slug + ".json im Verzeichnis.\n" +
"   Änderungen hier gehen beim nächsten Erzeugen verloren.\n" +
"\n" +
"   Erzeugt am " + new Date().toISOString().slice(0,16).replace("T"," ") + "\n" +
"   ═════════════════════════════════════════════════════════ */\n";

  /* Listen und verschachtelte Blöcke: als JSON, aber lesbar eingerückt.
     Sie stehen in derselben Datei wie die Farben, also darf man sie
     auch nachschlagen können. */
  const liste = (name, wert) => {
    if(wert === undefined || wert === null) return null;
    const roh = JSON.stringify(wert, null, 2)
      .split("\n").map((z, i) => i === 0 ? z : "  " + z).join("\n");
    return "  " + name + ": " + roh + ",";
  };

  const teile = [
    block("betrieb",  mb.betrieb,  ["name","claim","begruessung","strasse","ort",
                                    "telefon","mail","slug"]),
    block("farben",   mb.farben,   FARBEN_PFLICHT.concat(["akzentFlaeche","akzent2Flaeche","gutFlaeche"])),
    block("abend",    mb.abend,    ["an","ab","grund","flaeche","flaeche2","band","tinte",
                                    "tinteLeise","tinteStill","linie","linieStark",
                                    "akzent","akzent2","gut","akzentFlaeche","akzent2Flaeche","gutFlaeche"]),
    block("form",     mb.form,     ["rundung","rundungKlein","rand","schatten"]),
    block("schrift",  mb.schrift,  ["kopf","text","groesse"]),
    block("logo",     mb.logo,     ["art","text","bild","hoehe"]),
    block("bereiche", mb.bereiche, null),

    /* Ab hier der Inhalt des Hauses. Fehlt ein Block, bleibt im Hub
       der Platzhalter aus der Vorlage stehen — deshalb wird er auch
       nicht leer geschrieben, sondern weggelassen. */
    mb.avatar    ? block("avatar", mb.avatar, ["figur","art","name"]) : null,
    liste("zeiten",     mb.zeiten),
    mb.links     ? block("links",     mb.links,     null) : null,
    mb.wlan      ? block("wlan",      mb.wlan,      null) : null,
    mb.trinkgeld ? liste("trinkgeld", mb.trinkgeld)       : null,
    liste("empfehlung", mb.empfehlung)
  ].filter(Boolean);
  teile[teile.length-1] = teile[teile.length-1].replace(/,$/,"");

  return kopf + "const MARKENBLATT = {\n  version: 1,\n\n" + teile.join("\n\n") + "\n};\n";
}

/* ─── Erzeugen ────────────────────────────────────────────────── */
function erzeuge(slug, nurPruefen){
  const pfad = path.join(BLAETTER, slug + ".json");
  if(!fs.existsSync(pfad)) throw new Error("Kein Markenblatt: " + pfad);

  const mb = JSON.parse(fs.readFileSync(pfad, "utf8"));
  if(mb.betrieb && mb.betrieb.slug && mb.betrieb.slug !== slug)
    throw new Error("slug im Markenblatt (" + mb.betrieb.slug + ") passt nicht zum Dateinamen (" + slug + ")");

  const {fehler, warnung} = pruefeMarkenblatt(mb);

  console.log("\n── " + slug + " ──");
  warnung.forEach(w => console.log("   Hinweis: " + w));
  fehler.forEach(f  => console.log("   FEHLER:  " + f));

  if(fehler.length){
    console.log("   → nicht erzeugt (" + fehler.length + " Fehler)");
    return false;
  }
  if(nurPruefen){
    console.log("   → geprüft, nichts geschrieben" + (warnung.length ? " (" + warnung.length + " Hinweise)" : ""));
    return true;
  }

  let vorlage = fs.readFileSync(VORLAGE, "utf8");
  if(!vorlage.includes("/*{{MARKENBLATT}}*/"))
    throw new Error("Die Vorlage hat keinen Platzhalter /*{{MARKENBLATT}}*/");

  let aus = vorlage.replace("/*{{MARKENBLATT}}*/", alsQuelltext(mb));

  /* Kopfangaben mitziehen. Der Titel steht im Browserreiter und im
     geteilten Link — er ist das Erste, was der Gast vom Haus sieht. */
  const h = t => String(t||"").replace(/[&<>"]/g, z =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[z]));
  const titel = mb.betrieb.name + (mb.betrieb.ort ? " · " + mb.betrieb.ort : "");
  aus = aus.replace(/<title>[\s\S]*?<\/title>/, "<title>" + h(titel) + "</title>");
  aus = aus.replace(/(<meta name="description" content=")[^"]*(")/,
    "$1" + h(mb.betrieb.claim || mb.betrieb.name) + "$2");
  aus = aus.replace(/(<meta name="theme-color" content=")[^"]*(")/,
    "$1" + (mb.farben.band) + "$2");

  const ordner = path.join(ZIEL, slug);
  fs.mkdirSync(ordner, {recursive:true});
  fs.writeFileSync(path.join(ordner, "index.html"), aus);

  console.log("   → dist/" + slug + "/index.html  (" +
    aus.split("\n").length + " Zeilen" +
    (warnung.length ? ", " + warnung.length + " Hinweise" : "") + ")");
  return true;
}

/* ─── Aufruf ──────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const nurPruefen = args.includes("--pruefen-nur");
/* Im flachen Verzeichnis liegen neben den Markenblättern auch andere
   JSON-Dateien. „--alle" nimmt deshalb nur, was wirklich eins ist:
   ein Objekt mit version und farben. Ohne diese Prüfung meldete der
   Erzeuger für jede fremde JSON-Datei einen Fehler — und eine
   Prüfung mit Fehlalarmen bringt einem bei, sie zu übergehen. */
function istMarkenblatt(pfad){
  try{
    const j = JSON.parse(fs.readFileSync(pfad, "utf8"));
    return !!(j && typeof j === "object" && "version" in j && "farben" in j);
  }catch(e){ return false; }
}
const slugs = args.includes("--alle")
  ? fs.readdirSync(BLAETTER)
      .filter(f => f.endsWith(".json") && istMarkenblatt(path.join(BLAETTER, f)))
      .map(f => f.slice(0,-5))
  : args.filter(a => !a.startsWith("--"));

if(!slugs.length){
  console.log("Aufruf: node erzeuger/erzeuge-hub.js <slug> [--pruefen-nur]");
  console.log("        node erzeuger/erzeuge-hub.js --alle");
  process.exit(1);
}

let fehlgeschlagen = 0;
slugs.forEach(s => { try { if(!erzeuge(s, nurPruefen)) fehlgeschlagen++; }
                     catch(e){ console.log("\n── " + s + " ──\n   FEHLER: " + e.message); fehlgeschlagen++; } });

console.log("\n" + (slugs.length - fehlgeschlagen) + " von " + slugs.length + " erledigt.\n");
process.exit(fehlgeschlagen ? 1 : 0);
