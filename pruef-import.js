const fs = require("fs");
const s = fs.readFileSync("omoteno-admin.html", "utf8");
const js = [...s.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");

// Nur die Zerlegerfunktionen herausschneiden, ohne den Rest des Boards
const teile = ["impPreisAmEnde", "impNameTeilen", "impPutzen", "impRandPutzen", "impIstUeberschrift", "impZerlegen"]
  .map(n => js.match(new RegExp("(?:const IMP_TRENNER[^;]+;\\s*)?function " + n + "[\\s\\S]*?\\n\\}"))[0]);
eval(js.match(/const IMP_TRENNER = \[[^\]]*\];/)[0]);
eval(teile.join("\n"));

const proben = {
  "Gedankenstriche und Euro": `Vorspeisen
Brot & Öl — Sauerteig, Olivenöl, Salz — 6,50 €
Käseauswahl — Drei Sorten, Feigensenf — 14,90 €

Hauptgerichte
Pasta des Tages — Was der Markt hergab — 16,50 €`,

  "Führungspunkte aus Druckkarte": `GETRÄNKE
Espresso .................. 2,40
Cappuccino ................ 3,60
Latte Macchiato ........... 3,90`,

  "Klammern statt Trenner": `Kuchen
Käsekuchen (mit Sauerrahm und Vanille) 4,50
Apfelstrudel (mit Rosinen) 4,80`,

  "Zahlen im Namen": `Pizza
Pizza 4 Jahreszeiten · Schinken, Pilze, Artischocken, Oliven · 12,50
Pasta 5 Käse 14,00
Cola 0,33 l 3,20`,

  "Mengenangaben, keine Preise": `Beilagen
Pommes 200 g
Salat 150 g
Brot 2 Scheiben`,

  "Ohne Kategorie, Doppelpunkt": `Wiener Schnitzel: Kalb, Preiselbeeren, Kartoffelsalat: 24,90
Rinderroulade: Speck, Gurke, Zwiebel: 21,50`,

  "Zierzeilen und Leerzeilen": `═══════════
   DESSERTS
═══════════

Tiramisu   7,50

Panna Cotta   6,90
-----------`,

  "Vergessener Preis": `Suppen
Tomatensuppe 5,50
Gulaschsuppe
Linsensuppe 6,00`
};

let gesamt = 0;
Object.keys(proben).forEach(name => {
  const e = impZerlegen(proben[name], "Sonstiges");
  console.log("\n── " + name + " ──");
  e.treffer.forEach(t => {
    gesamt++;
    console.log("  [" + t.kat.padEnd(14) + "] " + t.name.padEnd(24) +
      (t.ohnePreis ? "KEIN PREIS" : String(t.preis.toFixed(2)).padStart(7)) +
      (t.beschr ? "   « " + t.beschr : ""));
  });
  if(e.uebersprungen) console.log("  (" + e.uebersprungen + " Zeilen verworfen)");
});
console.log("\nErkannte Zeilen gesamt:", gesamt);
