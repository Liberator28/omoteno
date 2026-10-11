/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Karte einlesen (Zerleger, Vorschau, Übernehmen)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-import.js

   Vorher stand hier eine Datei, die zerlegte und nur AUSGAB — keine
   einzige Erwartung. Darunter fiel nicht auf, dass Zeilen ohne Preis
   mit preis:0 und verfuegbar:true in die Karte gingen (Gast sah
   „0,00 €“), obwohl der Kommentar im Zerleger das Gegenteil versprach.

   1 · Zerleger: 25 Kartenformate, je mit erwarteten Gerichten (Name,
       Preis, Kategorie, Kürzel). Alte Formate bleiben, neue: Preis mit
       € / EUR davor, „9,-“, „1.250,00“, „ab“, OCR-O, Größen je ein
       Gericht, Größen aus der Kopfzeile, zwei Preise markiert,
       Nummern, Kürzel in Klammern / hochgestellt / am Ende, Legende,
       Beschreibung oder Preis in der Folgezeile, Überschrift ohne
       Leerzeile, Spalten, Karte ganz ohne Kommapreise.
   2 · Zweite Quelle: Jedes erkannte Kürzel steht in ALLERGENE bzw.
       ZUSATZSTOFFE des Boards; die Tabellen werden aus der Datei
       gelesen, nicht hier abgeschrieben.
   3 · Board von Hand (Vorführmodus): Knöpfe „Gericht hinzufügen“,
       „＋ Kategorie“, „Karte einlesen“ OBEN über der Liste, ≥ 44 px;
       Vorschau: ohne Preis abgewählt und „Preis fehlt“, Häkchen ohne
       Preis geht nicht, getippter Preis nimmt es auf, Name und
       Kategorie änderbar, Kürzel-Chip abwählbar; „anlegen“ legt GENAU
       die gewählten an, keines mit preis 0, Kürzel und Größe stimmen;
       die Liste ist kein eigener Scrollbereich (§3.8).
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
if(!fs.existsSync(ADMIN)){ console.error("Datei nicht gefunden: " + ADMIN); process.exit(1); }
const s = fs.readFileSync(ADMIN, "utf8");

let n = 0, f = 0;
function pruef(b, t, d){
  n++; if(!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

/* ── Zerleger aus der Datei holen ──────────────────────────────── */
const js = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
const block = (js.match(/\/\* Wie Speisekarten Preise schreiben[\s\S]*?(?=\/\* ─── Vorschau)/) || [""])[0];
const tabellen = ["ALLERGENE", "ZUSATZSTOFFE"].map(nm => (js.match(new RegExp("const " + nm + " = \\[[\\s\\S]*?\\n\\];")) || [""])[0]);
if(!block || tabellen.some(t => !t)){ console.error("Zerleger oder Tabellen nicht gefunden"); process.exit(1); }
const kiste = {};
vm.createContext(kiste);
vm.runInContext(tabellen.join("\n") + "\n" + block +
  "\nthis.impZerlegen = impZerlegen; this.ALLERGENE = ALLERGENE; this.ZUSATZSTOFFE = ZUSATZSTOFFE;", kiste);
const { impZerlegen, ALLERGENE, ZUSATZSTOFFE } = kiste;

/* Erwartung: [name, preis|null, kat?, {a:"A,C", z:"2,3", beschr:/re/, mehrere:true}] */
const proben = [
  ["Gedankenstriche und Euro", `Vorspeisen
Brot & Öl — Sauerteig, Olivenöl, Salz — 6,50 €
Käseauswahl — Drei Sorten, Feigensenf — 14,90 €

Hauptgerichte
Pasta des Tages — Was der Markt hergab — 16,50 €`,
   [["Brot & Öl", 6.5, "Vorspeisen", { beschr:/Sauerteig, Olivenöl, Salz$/ }], ["Käseauswahl", 14.9, "Vorspeisen"], ["Pasta des Tages", 16.5, "Hauptgerichte"]]],

  ["Führungspunkte aus Druckkarte", `GETRÄNKE
Espresso .................. 2,40
Cappuccino ................ 3,60
Latte Macchiato ........... 3,90`,
   [["Espresso", 2.4, "GETRÄNKE"], ["Cappuccino", 3.6], ["Latte Macchiato", 3.9]]],

  ["Klammern statt Trenner", `Kuchen
Käsekuchen (mit Sauerrahm und Vanille) 4,50
Apfelstrudel (mit Rosinen) 4,80`,
   [["Käsekuchen", 4.5, "Kuchen", { beschr:/Sauerrahm/ }], ["Apfelstrudel", 4.8, "Kuchen", { beschr:/Rosinen/ }]]],

  ["Zahlen im Namen", `Pizza
Pizza 4 Jahreszeiten · Schinken, Pilze, Artischocken, Oliven · 12,50
Pasta 5 Käse 14,00
Cola 0,33 l 3,20`,
   [["Pizza 4 Jahreszeiten", 12.5], ["Pasta 5 Käse", 14], ["Cola 0,33 l", 3.2]]],

  ["Mengenangaben, keine Preise", `Beilagen
Pommes 200 g
Salat 150 g
Brot 2 Scheiben`,
   [["Pommes 200 g", null, "Beilagen"], ["Salat 150 g", null], ["Brot 2 Scheiben", null]]],

  ["Ohne Kategorie, Doppelpunkt", `Wiener Schnitzel: Kalb, Preiselbeeren, Kartoffelsalat: 24,90
Rinderroulade: Speck, Gurke, Zwiebel: 21,50`,
   [["Wiener Schnitzel", 24.9, "Sonstiges"], ["Rinderroulade", 21.5, "Sonstiges"]]],

  ["Zierzeilen und Leerzeilen", `═══════════
   DESSERTS
═══════════

Tiramisu   7,50

Panna Cotta   6,90
-----------`,
   [["Tiramisu", 7.5, "DESSERTS"], ["Panna Cotta", 6.9, "DESSERTS"]]],

  ["Vergessener Preis bleibt sichtbar, ohne Preis", `Suppen
Tomatensuppe 5,50
Gulaschsuppe
Linsensuppe 6,00`,
   [["Tomatensuppe", 5.5, "Suppen"], ["Gulaschsuppe", null, "Suppen"], ["Linsensuppe", 6, "Suppen"]]],

  ["Währung davor (€ und EUR)", `Burger
Classic Burger € 11,90
Cheese Burger EUR 12,90
Veggie Burger €13,50`,
   [["Classic Burger", 11.9], ["Cheese Burger", 12.9], ["Veggie Burger", 13.5]]],

  ["Strich statt Cent, Tausenderpunkt", `Grill
Rumpsteak 300 g 29,-
Tomahawk für 4 Personen 1.250,00
Bratwurst 4,–`,
   [["Rumpsteak 300 g", 29], ["Tomahawk für 4 Personen", 1250], ["Bratwurst", 4]]],

  ["„ab“ vor dem Preis", `Pizza
Pizza nach Wahl ab 9,90`,
   [["Pizza nach Wahl", 9.9, "Pizza", { ab:true }]]],

  ["Texterkennung: O statt Null", `Kaffee
Espresso 2,4O
Cappuccino 3,6O €`,
   [["Espresso", 2.4], ["Cappuccino", 3.6]]],

  ["Größen je ein Gericht", `Softdrinks
Cola 0,3l 2,80 / 0,5l 3,90
Pils 0,3 2,90 0,5 3,90
Pizza Margherita Ø26 cm 8,50 Ø32 cm 11,50
Rotwein Glas 5,50 Flasche 24,00`,
   [["Cola 0,3l", 2.8, "Softdrinks"], ["Cola 0,5l", 3.9], ["Pils 0,3 l", 2.9], ["Pils 0,5 l", 3.9],
    ["Pizza Margherita Ø26 cm", 8.5], ["Pizza Margherita Ø32 cm", 11.5], ["Rotwein Glas", 5.5], ["Rotwein Flasche", 24]]],

  ["Größen aus der Kopfzeile", `Säfte 0,2 l 0,4 l
Apfelsaft 2,50 3,90
Orangensaft 2,80 4,20`,
   [["Apfelsaft 0,2 l", 2.5, "Säfte"], ["Apfelsaft 0,4 l", 3.9, "Säfte"], ["Orangensaft 0,2 l", 2.8], ["Orangensaft 0,4 l", 4.2]]],

  ["Zwei Preise ohne Größe werden markiert", `Snacks
Nachos 6,50 8,90`,
   [["Nachos", 6.5, "Snacks", { mehrere:true }]]],

  ["Nummern vorne", `Pizza
12. Margherita 8,50
13) Salami 9,50
Nr. 14 Funghi 9,90`,
   [["Margherita", 8.5], ["Salami", 9.5], ["Funghi", 9.9]]],

  ["Durchnummeriert ohne Punkt", `Pizza
21 Margherita 8,50
22 Salami 9,50
23 Quattro Formaggi 10,50
4 Käse Pizza 11,00`,
   [["Margherita", 8.5], ["Salami", 9.5], ["Quattro Formaggi", 10.5], ["Käse Pizza", 11]]],

  ["Kürzel in Klammern, hochgestellt, am Ende", `Imbiss
Currywurst (2,3,A,G) 4,50
Schnitzel¹˒³ (A,C,G) 12,90
Pizza Salami A, G 9,50
Apfelstrudel (mit Rosinen) 4,80
Frikadelle (S) 3,50`,
   [["Currywurst", 4.5, "Imbiss", { a:"A,G", z:"2,3" }], ["Schnitzel", 12.9, "Imbiss", { a:"A,C,G", z:"1,3" }],
    ["Pizza Salami", 9.5, "Imbiss", { a:"A,G", z:"" }], ["Apfelstrudel", 4.8, "Imbiss", { a:"", z:"", beschr:/Rosinen/ }],
    ["Frikadelle", 3.5, "Imbiss", { a:"", beschr:/^S$/ }]]],

  ["Schlüssel a–n wird umgerechnet (i, k, l)", `Bowls
Sesam-Bowl (a,f,k) 12,90
Sellerie-Salat (i,j) 8,50
Spritz (l) 6,50`,
   [["Sesam-Bowl", 12.9, "Bowls", { a:"A,F,N" }], ["Sellerie-Salat", 8.5, "Bowls", { a:"L,M" }], ["Spritz", 6.5, "Bowls", { a:"O" }]]],

  ["Legende ist kein Gericht", `Salate
Caesar Salad (A,C,D) 11,50

A = Gluten, C = Eier, D = Fisch
1 = mit Farbstoff, 2 = mit Konservierungsstoff`,
   [["Caesar Salad", 11.5, "Salate", { a:"A,C,D" }]]],

  ["Beschreibung in der Folgezeile", `Hauptgerichte
Wiener Schnitzel 18,90
vom Kalb, mit Kartoffelsalat
Zwiebelrostbraten 22,50
mit Bratkartoffeln und Röstzwiebeln`,
   [["Wiener Schnitzel", 18.9, "Hauptgerichte", { beschr:/^vom Kalb, mit Kartoffelsalat$/ }],
    ["Zwiebelrostbraten", 22.5, "Hauptgerichte", { beschr:/Bratkartoffeln/ }]]],

  ["Preis in der Folgezeile", `Vorspeisen
Bruschetta
6,50
Burrata mit Tomaten
9,80`,
   [["Bruschetta", 6.5, "Vorspeisen"], ["Burrata mit Tomaten", 9.8, "Vorspeisen"]]],

  ["Name, darunter Beschreibung mit Preis", `Brot
Brot & Öl
mit Sauerteig und Olivenöl 6,50`,
   [["Brot & Öl", 6.5, "Brot", { beschr:/^mit Sauerteig und Olivenöl$/ }]]],

  ["Überschrift ohne Leerzeile davor", `Vorspeisen
Bruschetta 6,50
Hauptgerichte
Lasagne 13,90
Desserts:
Tiramisu 6,90`,
   [["Bruschetta", 6.5, "Vorspeisen"], ["Lasagne", 13.9, "Hauptgerichte"], ["Tiramisu", 6.9, "Desserts"]]],

  ["Zwei Spalten in einer Zeile", `Kaffee
Espresso 2,40      Cappuccino 3,60
Americano 2,90     Flat White 3,90`,
   [["Espresso", 2.4], ["Cappuccino", 3.6], ["Americano", 2.9], ["Flat White", 3.9]]],

  ["Karte ganz ohne Kommapreise", `Burger
Classic 11
Bacon 13
Veggie 12
Pommes 200 g`,
   [["Classic", 11], ["Bacon", 13], ["Veggie", 12], ["Pommes 200 g", null]]],

  ["vegan/vegetarisch nur als Vorschlag", `Bowls
Buddha Bowl (vegan) 12,90
Halloumi Bowl (v) 13,50`,
   [["Buddha Bowl", 12.9, "Bowls", { vegan:true }], ["Halloumi Bowl", 13.5, "Bowls", { veg:true }]]],

  /* Echte Karte: Chocos Gerüstkarte als Text, so wie man sie aus der
     Webseite kopieren würde. */
];

/* Chocos Gerüstkarte aus der Hub-Vorlage als Text (§6.1: gegen echte Daten) */
const hub = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");
const chocoBlock = (hub.match(/let SPEISEKARTE = \[[\s\S]*?\n\];/) || [""])[0];
const chocoZeilen = [];
const chocoErw = [];
[...chocoBlock.matchAll(/gruppe:\s*"([^"]+)",\s*eintraege:\s*\[([\s\S]*?)\n\s*\]\s*\}/g)].forEach(m => {
  chocoZeilen.push("", m[1]);
  [...m[2].matchAll(/n:\s*"([^"]+)",\s*b:\s*"([^"]*)",\s*p:\s*"([\d,]+)"/g)].forEach(g => {
    chocoZeilen.push(g[1] + (g[2] ? " — " + g[2] : "") + " — " + g[3] + " €");
    chocoErw.push([g[1], Number(g[3].replace(",", ".")), m[1]]);
  });
});
if(chocoErw.length >= 10) proben.push(["Chocos Gerüstkarte (echte Namen)", chocoZeilen.join("\n"), chocoErw]);

/* Dasselbe mit der Karte des Vorführhauses, wie man sie aus einer
   Webseite kopiert: Kategorie als Zeile, Gericht mit Allergenen in
   Klammern und Preis. */
const nord = JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", "nordstern.json"), "utf8")).demo.gerichte
  .slice().sort((a, b) => (a.karte + a.kat_sort).localeCompare(b.karte + b.kat_sort) || a.reihenfolge - b.reihenfolge);
const nordZeilen = [], nordErw = [];
let nordKat = null;
nord.forEach(g => {
  if(g.kategorie !== nordKat){ nordZeilen.push("", g.kategorie); nordKat = g.kategorie; }
  const kz = String(g.allergene || "").split(",").map(x => x.trim()).filter(Boolean);
  nordZeilen.push(g.name + (kz.length ? " (" + kz.join(",") + ")" : "") + " · " + g.beschreibung + " · " + g.preis.toFixed(2).replace(".", ",") + " €");
  nordErw.push([g.name, g.preis, g.kategorie, { a: kz.join(",") }]);
});
proben.push(["Karte des Vorführhauses (Kürzel aus den echten Zeilen)", nordZeilen.join("\n"), nordErw]);

console.log("\n══ Zerleger ══");
proben.forEach(([titel, text, erw]) => {
  const e = impZerlegen(text, "Sonstiges");
  const fehler = [];
  if(e.treffer.length !== erw.length) fehler.push(`${e.treffer.length} statt ${erw.length} Gerichte: ` + e.treffer.map(t => t.name).join(" | "));
  erw.forEach(([name, preis, kat, mehr], i) => {
    const t = e.treffer[i];
    if(!t){ return; }
    if(t.name !== name) fehler.push(`Name „${t.name}“ statt „${name}“`);
    if(preis === null ? !t.ohnePreis || t.preis !== 0 : Math.abs(t.preis - preis) > 0.001 || t.ohnePreis)
      fehler.push(`${name}: Preis ${t.preis}${t.ohnePreis ? " (ohne)" : ""} statt ${preis}`);
    if(kat && t.kat !== kat) fehler.push(`${name}: Kategorie „${t.kat}“ statt „${kat}“`);
    if(mehr){
      if(mehr.a !== undefined && t.allergene.join(",") !== mehr.a) fehler.push(`${name}: Allergene „${t.allergene}“ statt „${mehr.a}“`);
      if(mehr.z !== undefined && t.zusatz.join(",") !== mehr.z) fehler.push(`${name}: Zusatzstoffe „${t.zusatz}“ statt „${mehr.z}“`);
      if(mehr.beschr && !mehr.beschr.test(t.beschr)) fehler.push(`${name}: Beschreibung „${t.beschr}“`);
      if(mehr.ab && !t.ab) fehler.push(`${name}: „ab“ nicht erkannt`);
      if(mehr.mehrere && !t.mehrerePreise) fehler.push(`${name}: mehrere Preise nicht markiert`);
      if(mehr.vegan && !t.vorschlagVegan) fehler.push(`${name}: vegan nicht vorgeschlagen`);
      if(mehr.veg && !t.vorschlagVeg) fehler.push(`${name}: vegetarisch nicht vorgeschlagen`);
    }
    /* Vorschläge setzen nie selbst etwas */
    if(t.veg || t.vegan) fehler.push(`${name}: Merkmal von selbst gesetzt`);
  });
  pruef(!fehler.length, titel, fehler.length ? fehler.join("; ") : e.treffer.length + " Gerichte");
});

console.log("\n══ Unklarer Schlüssel: fragen statt raten ══");
{
  const text = `Salate\nWaldorf (a,l) 9,50\nCaesar (a,c,d) 11,50`;
  const auto = impZerlegen(text, "x"), board = impZerlegen(text, "x", "board"), an = impZerlegen(text, "x", "an");
  pruef(auto.schema === "unklar" && auto.treffer[0].allergene.join(",") === "A" && auto.treffer[0].allergeneUnklar.join(",") === "L",
    "nur L/M/N: Schlüssel unklar, L wird NICHT gesetzt, sondern zurückgehalten", auto.schema + " / " + auto.treffer[0].allergene + " / " + auto.treffer[0].allergeneUnklar);
  pruef(board.treffer[0].allergene.join(",") === "A,L" && an.treffer[0].allergene.join(",") === "A,O",
    "nach Wahl: L = Sellerie (Board) bzw. L = Schwefel → O (a–n)", board.treffer[0].allergene + " / " + an.treffer[0].allergene);
  const omo = impZerlegen(`Drinks\nSpritz (o) 6,50\nWaldorf (a,l) 9,50`, "x");
  pruef(omo.schema === "board" && omo.treffer[1].allergene.join(",") === "A,L", "O/P/R in der Karte → Board-Schlüssel, L bleibt Sellerie", omo.schema + " / " + omo.treffer[1].allergene);
}

console.log("\n══ Zweite Quelle: Kürzel ══");
const alleKz = new Set();
proben.forEach(([, text]) => impZerlegen(text, "x").treffer.forEach(t => {
  t.allergene.forEach(k => alleKz.add("a:" + k)); t.zusatz.forEach(k => alleKz.add("z:" + k)); }));
const fremd = [...alleKz].filter(k => {
  const [art, w] = k.split(":");
  return !(art === "a" ? ALLERGENE : ZUSATZSTOFFE).some(r => r[0] === w);
});
pruef(alleKz.size >= 6 && !fremd.length, "jedes erkannte Kürzel steht in ALLERGENE/ZUSATZSTOFFE des Boards",
  fremd.join(",") || [...alleKz].join(","));

/* ── Board von Hand ────────────────────────────────────────────── */
(async () => {
  let chromium;
  try { ({ chromium } = require("playwright")); } catch (e) { console.error("playwright fehlt"); process.exit(1); }
  const br = await chromium.launch();

  for (const breite of [390, 1100]) {
    console.log("\n══ Board · " + breite + " px ══");
    const ctx = await br.newContext({ viewport: { width: breite, height: 860 }, hasTouch: breite < 500 });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + ADMIN);
    await p.waitForTimeout(700);
    await p.evaluate(() => {
      document.getElementById("tor").hidden = true;
      demoStarten(); zeichneAlles();
      const sch = document.getElementById("scharf"); if (sch) sch.hidden = true;
      document.querySelector('[data-tafel="speisekarte"]').click();
    });
    await p.waitForTimeout(400);

    /* Knöpfe oben, vor der Liste */
    const lage = await p.evaluate(() => {
      const r = id => document.getElementById(id).getBoundingClientRect();
      const liste = document.getElementById("karteListe").getBoundingClientRect();
      const cs = getComputedStyle(document.querySelector(".kartenknoepfe"));
      return { g: r("neuesGericht"), k: r("neueKategorie"), i: r("karteImport"), listeOben: liste.top,
               pos: cs.position, vw: innerWidth };
    });
    pruef(lage.pos !== "fixed", "Knöpfe stehen im Fluss, nicht schwebend", lage.pos);
    pruef([lage.g, lage.k, lage.i].every(r => r.bottom <= lage.listeOben + 1 && r.height >= 44 && r.width > 0),
      "„Gericht hinzufügen“, „＋ Kategorie“, „Karte einlesen“ oben über der Liste, je ≥ 44 px",
      [lage.g, lage.k, lage.i].map(r => Math.round(r.top) + "/" + Math.round(r.height)).join(" "));
    pruef([lage.g, lage.k, lage.i].every(r => r.left >= 0 && r.right <= lage.vw), "kein Knopf ragt aus dem Bild");

    await p.click("#neueKategorie");
    await p.waitForTimeout(350);
    const katOffen = await p.evaluate(() => { const b = document.getElementById("ktedBlatt"); return !!b && !b.hidden; });
    pruef(katOffen, "„＋ Kategorie“ öffnet das Kategorie-Blatt");
    await p.evaluate(() => { if (typeof ktedZu === "function") ktedZu(); const b = document.getElementById("ktedBlatt"); if (b) b.hidden = true; });
    await p.waitForTimeout(300);

    await p.click("#karteImport");
    await p.waitForTimeout(350);
    const vorher = await p.evaluate(() => gerichte.length);
    await p.fill("#impText", `Getränke
Cola 0,3l 2,80 / 0,5l 3,90
Hauswein
Currywurst (2,3,A) 4,50
Apfelschorle 3,20`);
    await p.waitForTimeout(250);
    const v1 = await p.evaluate(() => {
      const z = [...document.querySelectorAll("#impListe .impzeile")].map(x => ({
        name: x.querySelector("[data-imp-name]").value, preis: x.querySelector("[data-imp-preis]").value,
        an: x.querySelector("[data-imp-an]").getAttribute("aria-pressed") === "true",
        ohne: x.classList.contains("ohnepreis"),
        notiz: getComputedStyle(x.querySelector(".impnotiz"), "::before").content,
        chips: [...x.querySelectorAll("[data-imp-kz]")].map(c => c.textContent).join(",") }));
      const l = getComputedStyle(document.getElementById("impListe"));
      return { z, knopf: document.getElementById("impUebernehmen").textContent, ov: l.overflowY, mh: l.maxHeight };
    });
    const haus = v1.z.find(x => x.name === "Hauswein");
    pruef(v1.z.length === 5 && v1.z[0].name === "Cola 0,3l" && v1.z[1].name === "Cola 0,5l",
      "Vorschau: Größen als je ein Gericht", v1.z.map(x => x.name).join(" | "));
    pruef(haus && haus.ohne && !haus.an && haus.preis === "" && /Preis fehlt/.test(haus.notiz),
      "ohne Preis: abgewählt, Feld leer, Satz „Preis fehlt“", JSON.stringify(haus));
    pruef(v1.knopf === "4 Gerichte anlegen", "Knopf zählt nur, was angelegt wird", v1.knopf);
    pruef((v1.z.find(x => x.name === "Currywurst") || {}).chips === "A,2,3", "Kürzel als Chips", (v1.z.find(x => x.name === "Currywurst") || {}).chips);
    pruef(v1.ov !== "auto" && v1.ov !== "scroll" && v1.mh === "none", "Vorschau ist kein eigener Scrollbereich (§3.8)", v1.ov + " / " + v1.mh);

    /* Häkchen ohne Preis geht nicht */
    const hausZeile = p.locator("#impListe .impzeile", { has: p.locator('[data-imp-name][value="Hauswein"]') });
    await hausZeile.locator("[data-imp-an]").click();
    await p.waitForTimeout(150);
    const nachHaken = await p.evaluate(() => document.getElementById("impUebernehmen").textContent);
    pruef(nachHaken === "4 Gerichte anlegen", "Häkchen ohne Preis nimmt nichts auf", nachHaken);

    /* Preis tippen → aufgenommen; Name und Kategorie ändern; Chip abwählen */
    await hausZeile.locator("[data-imp-preis]").fill("5,5");
    await p.waitForTimeout(100);
    await p.locator("#impListe [data-imp-name]").nth(4).fill("Apfelschorle groß");
    await p.locator("#impListe [data-imp-kat]").first().fill("Kalte Getränke");
    await p.locator('#impListe [data-imp-kz="z:3"]').click();
    await p.waitForTimeout(150);
    const nach = await p.evaluate(() => ({
      knopf: document.getElementById("impUebernehmen").textContent,
      haken: document.querySelectorAll('#impListe [data-imp-an][aria-pressed="true"]').length }));
    pruef(nach.knopf === "5 Gerichte anlegen" && nach.haken === 5, "getippter Preis nimmt das Gericht auf", nach.knopf);

    /* Ein Gericht abwählen */
    await p.locator("#impListe [data-imp-an]").nth(1).click();
    await p.waitForTimeout(100);
    /* Text ändern → neu zerlegt, Änderungen bleiben */
    await p.fill("#impKat", "Sonstiges");
    await p.waitForTimeout(200);
    const bleibt = await p.evaluate(() => ({
      knopf: document.getElementById("impUebernehmen").textContent,
      name: document.querySelectorAll("#impListe [data-imp-name]")[4].value,
      preis: [...document.querySelectorAll("#impListe .impzeile")].find(x => x.querySelector("[data-imp-name]").value === "Hauswein").querySelector("[data-imp-preis]").value }));
    pruef(bleibt.knopf === "4 Gerichte anlegen" && bleibt.name === "Apfelschorle groß" && bleibt.preis === "5,50",
      "nach erneutem Zerlegen bleiben Häkchen, Name und Preis", JSON.stringify(bleibt));

    await p.click("#impUebernehmen");
    await p.waitForTimeout(500);
    const neu = await p.evaluate(v => gerichte.slice(v).map(g => ({ name: g.name, preis: g.preis, kat: g.kategorie,
      a: g.allergene, z: g.zusatzstoffe, karten: g.karten, verf: g.verfuegbar })), vorher);
    pruef(neu.length === 4, "genau die vier gewählten angelegt", neu.map(g => g.name).join(" | "));
    pruef(neu.every(g => g.preis > 0), "keines mit Preis 0", neu.map(g => g.preis).join(","));
    pruef(!neu.some(g => g.name === "Cola 0,5l"), "abgewähltes fehlt");
    const cw = neu.find(g => g.name === "Currywurst") || {};
    pruef(cw.a === "A" && cw.z === "2", "Kürzel übernommen, abgewählter Chip nicht", cw.a + " / " + cw.z);
    pruef(neu.every(g => g.kat === "Kalte Getränke"), "geänderte Kategorie übernommen", [...new Set(neu.map(g => g.kat))].join(","));
    pruef(neu.some(g => g.name === "Hauswein" && g.preis === 5.5), "nachgetragener Preis übernommen");
    pruef(neu.every(g => Array.isArray(g.karten) && g.karten.length === 1), "karten gesetzt wie beim Gericht-Blatt");
    /* Unklarer Schlüssel in der Vorschau: Frage sichtbar, L erst nach Wahl */
    await p.click("#karteImport"); await p.waitForTimeout(350);
    await p.fill("#impText", "Salate\nWaldorf (a,l) 9,50");
    await p.waitForTimeout(200);
    const fr = await p.evaluate(() => ({ sicht: !document.getElementById("impSchema").hidden,
      knoepfe: [...document.querySelectorAll("#impSchema [data-imp-schema]")].map(b => Math.round(b.getBoundingClientRect().height)),
      chips: [...document.querySelectorAll("#impListe [data-imp-kz]")].map(c => c.textContent).join(","),
      notiz: document.querySelector("#impListe .impnotiz").textContent }));
    pruef(fr.sicht && fr.knoepfe.length === 2 && fr.knoepfe.every(h => h >= 44) && fr.chips === "A" && /L/.test(fr.notiz),
      "unklarer Schlüssel: Frage mit zwei Knöpfen ≥ 44 px, L noch nicht gesetzt", JSON.stringify(fr));
    await p.click('#impSchema [data-imp-schema="board"]'); await p.waitForTimeout(200);
    const nachWahl = await p.evaluate(() => [...document.querySelectorAll("#impListe [data-imp-kz]")].map(c => c.textContent).join(","));
    pruef(nachWahl === "A,L", "nach der Wahl steht L als Chip", nachWahl);
    await p.click("#impAbbrechen"); await p.waitForTimeout(300);

    pruef(!fehler.length, "keine Seitenfehler", fehler.join(" | ") || "–");
    await ctx.close();
  }
  await br.close();
  console.log("\n" + (f ? f + " von " + n + " FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden"));
  process.exit(f ? 1 : 0);
})();
