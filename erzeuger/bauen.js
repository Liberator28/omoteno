#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   BAUEN

   Legt aus dem Arbeitsverzeichnis den Ordner an, der wirklich ins
   Netz geht.

       node erzeuger/bauen.js

   Warum es diese Datei überhaupt gibt: Netlify liefert einen
   ORDNER aus, nicht ein Verzeichnis mit Auswahl. Läge das Repo
   selbst im Netz, stünden dort auch CLAUDE.md, die Markenblätter
   der Kunden, alle Prüfskripte und der Erzeuger. Nichts davon ist
   geheim, aber nichts davon gehört an eine Adresse, die jeder
   aufrufen kann.

   Also wird zusammengestellt statt hochgeladen:

     oeffentlich/
       index.html            ← omoteno-web.html
       admin.html  kueche.html  konto.html  start.html
       marken-studio.html
       h/<slug>/index.html   ← die erzeugten Gäste-Hubs
       robots.txt  _headers  _redirects

   „oeffentlich" steht in .gitignore. Was erzeugt werden kann,
   gehört nicht in die Versionsgeschichte — und der Ordner wird bei
   jedem Auslieferungslauf neu gebaut, auf Netlify genau wie hier.

   Ohne Abhängigkeiten. Kein npm install, kein Bauwerkzeug.
   ═══════════════════════════════════════════════════════════════ */
"use strict";

const fs   = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

/* Seit dem Aufräumen liegt bauen.js in erzeuger/. Gearbeitet wird
   aber weiter im Wurzelverzeichnis: Dort stehen netlify.toml und der
   Ordner, der ins Netz geht. WURZEL ist deshalb eine Ebene höher —
   und alles darunter zeigt auf WURZEL, nicht auf __dirname. */
const HIER   = __dirname;
const WURZEL = path.resolve(__dirname, "..");
const ZIEL   = path.join(WURZEL, "oeffentlich");
/* NICHT hier prüfen, ob es dist/ gibt. Der Ordner entsteht erst in
   Schritt 1 — und auf Netlify gibt es ihn beim Start GARANTIERT
   nicht, weil er in .gitignore steht. Der erste Entwurf las
   fs.existsSync an dieser Stelle, bekam null und meldete artig
   „keiner — dist/ ist leer": Der Bau wäre durchgelaufen, hätte
   grün gemeldet und keinen einzigen Kunden-Hub ausgeliefert.
   Gefunden hat das nicht das Lesen, sondern der Trockenlauf in
   einem leeren Verzeichnis — also genau das, was Netlify tut. */
const DIST   = path.join(WURZEL, "dist");

/* Welche Seiten öffentlich sind — und unter welchem Namen.

   Die Liste ist ausdrücklich eine ERLAUBNIS, keine Ausschlussliste.
   Wer eine Datei dazustellt, die nicht ins Netz soll, muss dafür
   nichts tun. Wer eine dazustellt, die ins Netz soll, trägt sie
   hier ein und sieht dabei, dass er es tut. Andersherum — alles
   kopieren außer einer Sperrliste — geht genau einmal schief, und
   dann liegt eine Datei draußen, von der niemand wusste. */
const SEITEN = [
  ["seiten/omoteno-web.html",   "index.html"],       /* omoteno.de */
  ["seiten/admin.html",         "admin.html"],       /* das Board  */
  ["seiten/kueche.html",        "kueche.html"],      /* Küche und Theke */
  ["seiten/konto.html",         "konto.html"],
  ["seiten/start.html",         "start.html"],
  ["seiten/marken-studio.html", "marken-studio.html"],
  /* Das Master Board. Es gehoert NICHT dem Betrieb, sondern Omoteno:
     Anfragen, Kunden, Zahlen ueber alle Haeuser. Der Zugang haengt an
     ist_master() in den RLS-Regeln, nicht daran, dass die Adresse
     schwer zu erraten ist — eine unverlinkte Seite ist kein Schutz. */
  ["seiten/master.html",        "master.html"],
  /* Pflicht, nicht Kür. Beide sind aus dem Fuß von omoteno-web.html,
     konto.html und start.html verlinkt — sechs Links. Fehlt eine
     davon, bricht der Bau ab, statt eine Seite auszuliefern, deren
     Impressumslink ins Leere führt. */
  ["seiten/impressum.html",     "impressum.html"],
  ["seiten/datenschutz.html",   "datenschutz.html"],
  /* Der Service Worker. admin.html registriert ihn beim Namen
     (register("sw.js")); fehlt er im Ordner, läuft die Registrierung
     auf ein 404 und das Personal bekommt nie eine Meldung über eine
     neue Bestellung. Er MUSS in der Wurzel liegen — von dort gilt er
     für die ganze Adresse. Läge er tiefer, wäre sein Geltungsbereich
     der Unterordner und das Board davon nicht erfasst. */
  ["seiten/sw.js",              "sw.js"]
];

function weg(p){ fs.rmSync(p, { recursive:true, force:true }); }
function ordner(p){ fs.mkdirSync(p, { recursive:true }); }

/* ─── 1 · Die Gäste-Hubs erzeugen ───────────────────────────────
   Nicht eingecheckt, sondern gebaut. Der Erzeuger braucht nur
   Node — genau dafür ist er da. Damit bleibt die Regel „was
   erzeugt werden kann, gehört nicht in die Versionsgeschichte"
   heil UND die Hubs kommen trotzdem online. */
console.log("── Hubs erzeugen ──");
try{
  const raus = execFileSync(process.execPath,
    [path.join(HIER, "erzeuge-hub.js"), "--alle"], { encoding:"utf8" });
  process.stdout.write(raus.split("\n").filter(z => z.trim()).slice(-3).join("\n") + "\n");
}catch(e){
  /* Ein fehlgeschlagener Erzeuger darf NICHT zu einer halb
     gefüllten Auslieferung führen. Lieber bricht der Bau ab und
     Netlify behält die vorige Fassung online. */
  console.error("\nDer Erzeuger ist gescheitert. Es wird nichts ausgeliefert.\n");
  console.error(String((e.stdout || "") + (e.stderr || "") || e.message).slice(-1600));
  process.exit(1);
}

/* ─── 2 · Den Ordner frisch anlegen ─────────────────────────────
   Immer von Null. Ein Ordner, der Reste behält, liefert irgendwann
   eine Datei aus, die es im Verzeichnis längst nicht mehr gibt —
   und niemand findet sie, weil sie nirgends steht. */
weg(ZIEL); ordner(ZIEL);

console.log("\n── Seiten ──");
const fehlend = [];
for(const [quelle, name, freiwillig] of SEITEN){
  const von = path.join(WURZEL, quelle);
  if(!fs.existsSync(von)){
    fehlend.push(quelle + (freiwillig ? "" : "   (PFLICHT)"));
    if(!freiwillig){
      console.error("   " + quelle + " fehlt — Abbruch.");
      process.exit(1);
    }
    continue;
  }
  fs.copyFileSync(von, path.join(ZIEL, name));
  console.log("   " + quelle.padEnd(22) + " → /" + name);
}

/* ─── 3 · Die Hubs einhängen ────────────────────────────────────
   Unter /h/<slug>/, nicht unter /<slug>/. Der Grund ist banal und
   wichtig: Ein Kunde mit dem Kürzel „admin" oder „konto" würde
   sonst eine Seite von uns überdecken. Ein Präfix kostet nichts
   und schließt die ganze Klasse von Kollisionen aus. */
console.log("\n── Gäste-Hubs ──");
let hubs = 0;
if(fs.existsSync(DIST)){
  for(const slug of fs.readdirSync(DIST)){
    const datei = path.join(DIST, slug, "index.html");
    if(!fs.existsSync(datei)) continue;
    ordner(path.join(ZIEL, "h", slug));
    fs.copyFileSync(datei, path.join(ZIEL, "h", slug, "index.html"));
    console.log("   " + slug.padEnd(22) + " → /h/" + slug + "/");
    hubs++;
  }
}

/* Null Hubs ist kein Hinweis, sondern ein Abbruch.

   Es gibt Markenblätter im Verzeichnis — der Erzeuger hat oben
   gemeldet, wie viele er gebaut hat. Kommt hier trotzdem keiner an,
   stimmt etwas zwischen den beiden Schritten nicht, und eine
   Auslieferung ohne Kunden-Hubs ist schlimmer als keine: Sie sieht
   erfolgreich aus, und die Kunden sind offline. */
const blaetterOrdner = path.join(WURZEL, "markenblaetter");
const blaetter = fs.existsSync(blaetterOrdner)
  ? fs.readdirSync(blaetterOrdner).filter(n => n.endsWith(".json")).length
  : 0;
if(!hubs && blaetter){
  console.error("\n   KEIN EINZIGER HUB, obwohl " + blaetter +
    " Markenblätter da sind.\n   Es wird nichts ausgeliefert.\n");
  process.exit(1);
}
if(!hubs) console.log("   (keiner — es gibt keine Markenblätter)");

/* ─── 4 · Was Suchmaschinen dürfen ──────────────────────────────
   Das Board, die Küche und das Konto haben in einem Suchergebnis
   nichts verloren. Die Gäste-Hubs auch nicht: Wer „Chocolamour
   Speisekarte" sucht, soll die Seite des Hauses finden, nicht
   einen Bestellschirm, der ohne Tisch keinen Sinn ergibt. */
fs.writeFileSync(path.join(ZIEL, "robots.txt"),
`User-agent: *
Disallow: /admin.html
Disallow: /kueche.html
Disallow: /konto.html
Disallow: /master.html
Disallow: /h/

Sitemap: https://omoteno.de/sitemap.xml
`);

fs.writeFileSync(path.join(ZIEL, "sitemap.xml"),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://omoteno.de/</loc><priority>1.0</priority></url>
  <url><loc>https://omoteno.de/start.html</loc><priority>0.7</priority></url>
  <url><loc>https://omoteno.de/marken-studio.html</loc><priority>0.6</priority></url>
  <url><loc>https://omoteno.de/impressum.html</loc><priority>0.3</priority></url>
  <url><loc>https://omoteno.de/datenschutz.html</loc><priority>0.3</priority></url>
</urlset>
`);

/* ─── 5 · Kopfzeilen und Umleitungen ────────────────────────────
   Beide liegen als eigene Dateien im Ordner. Netlify liest sie
   von dort, und sie stehen damit im selben Ordner wie das, wofür
   sie gelten — nicht in einer Konfiguration zwei Ebenen darüber. */
for(const n of ["_headers", "_redirects"]){
  const von = path.join(WURZEL, "auslieferung", n);
  if(fs.existsSync(von)){
    fs.copyFileSync(von, path.join(ZIEL, n));
    console.log("\n   " + n + " übernommen");
  } else {
    console.log("\n   " + n + " fehlt — ohne sie geht die Seite trotzdem, " +
      "nur ohne Sicherheitskopf bzw. ohne Kundendomains.");
  }
}

/* ─── 5b · Bewegte Zeichen ──────────────────────────────────────
   Lottie-Emojis und ihr Abspieler, nach /emoji/. Der Hub lädt sie von
   https://omoteno.de/emoji/ — FEST von der Hauptadresse, nicht
   relativ: Auf den Kundenadressen (choco-lamour.omoteno.de/*) lenkt
   _redirects ALLES in den Hub-Ordner um, ein /emoji/ dort liefe ins
   Leere. Deshalb auch der CORS-Kopf in _headers.

   Fehlt der Ordner, bricht der Bau NICHT ab: Ohne die Dateien zeigt
   der Hub das Emoji des Geräts, still statt bewegt. Das ist ein
   Rückfall, kein Schaden — aber er wird laut gesagt. */
{
  const von = path.join(WURZEL, "auslieferung", "emoji");
  if(fs.existsSync(von)){
    ordner(path.join(ZIEL, "emoji"));
    let n = 0;
    for(const f of fs.readdirSync(von)){
      fs.copyFileSync(path.join(von, f), path.join(ZIEL, "emoji", f)); n++;
    }
    console.log("\n   emoji/ übernommen (" + n + " Dateien)");
  } else {
    console.log("\n   emoji/ fehlt — der Hub zeigt stille Geräte-Emojis.");
  }
}

/* ─── 5c · Schriften ────────────────────────────────────────────
   Die Webschriften, die das Board zur Wahl stellt (SIL OFL, siehe
   LIZENZEN.txt im Ordner), nach /schriften/. Dieselbe Begründung wie
   bei den Emojis: Der Hub lädt sie fest von https://omoteno.de/, auch
   auf den Kundenadressen — deshalb der CORS-Kopf in _headers. Fehlt
   der Ordner, steht die Systemschrift da: Rückfall, kein Schaden. */
{
  const von = path.join(WURZEL, "auslieferung", "schriften");
  if(fs.existsSync(von)){
    ordner(path.join(ZIEL, "schriften"));
    let n = 0;
    for(const f of fs.readdirSync(von)){
      fs.copyFileSync(path.join(von, f), path.join(ZIEL, "schriften", f)); n++;
    }
    console.log("\n   schriften/ übernommen (" + n + " Dateien)");
  } else {
    console.log("\n   schriften/ fehlt — gewählte Schriften fallen auf die Systemschrift zurück.");
  }
}

/* ─── 6 · Was noch fehlt, laut sagen ────────────────────────────
   Ein Bau, der stillschweigend etwas ausklammert, erzieht dazu,
   seine Ausgabe nicht zu lesen. */
if(fehlend.length){
  console.log("\n── Fehlt noch ──");
  fehlend.forEach(f => console.log("   " + f));
  console.log("   Diese Dateien sind aus dem Fuß der Seiten verlinkt.");
  console.log("   Bis sie da sind, führen die Links ins Leere.");
}

const zahl = fs.readdirSync(ZIEL).length;
console.log("\noeffentlich/ steht: " + (SEITEN.length - fehlend.length) +
  " Seiten, " + hubs + " Hubs, " + zahl + " Einträge oben.\n");
