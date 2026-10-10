/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Thema "kaiserlich" (Minhkeeys Gold/Rot-Neueinfärbung)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-thema.js

   Auftrag: Minhkeey sollte nach einem Bildschirmfoto (Goldrahmen,
   dunkles Lack-Rot, chinesisch angehauchte Verzierung) neu gestaltet
   werden — nur für dieses eine Haus, fest (Nutzerentscheidung), Karten
   und Knöpfe eingeschlossen. Das Referenzbild trug an mehreren Stellen
   fremde Signaturen ("STINKY", ".MINKEEY") und eindeutiges
   Marktplatz-Bedienelemente-Chrome (X-Knopf, "1 von 2", Teilen-Symbol,
   Graffiti-Tapete unter der Statusleiste) — dieselbe Art Fund wie beim
   ersten Zierrat-Auftrag. Deshalb NUR als Stimmungsvorlage benutzt:
   Farben aus dem Bild abgelesen (gerechnet, nicht dieselben Pixel),
   Rahmen/Knöpfe selbst gebaut, keine Bildausschnitte übernommen.

   Drei echte Bausteine, alle über body[data-thema="kaiserlich"]
   geschaltet (themaSetzen() im Gerüst, MARKENBLATT.thema):
     - farben/abend in minhkeey.json — komplett neue Palette, jedes
       Paar gerechnet (siehe _hinweis dort und pruef-kontrast.js)
     - die vorhandenen tusche-Variablen (Bambus, Kleckse, Knospe)
       umgefärbt, nicht neu gebaut — Wiederverwendung, s. hub.vorlage
     - a.kachel/a.tipp/.begleiter bekommen eine goldene Innenlinie,
       die Kopf-Leiste (.kopfwahl, seit 10.10.) einen Goldring statt des mattweißen
       Rands aus der Grundausstattung

   Erweitert nach einer zweiten Nutzerprobe (weiteres Bildschirmfoto,
   diesmal mit Browser-Rahmen und iOS-Teilen-Leiste — auch das kein
   echter Screenshot der eigenen Seite, sondern ein generiertes Mockup
   mit denselben Fremd-Signaturen wie beim ersten Bild): Auftrag war,
   Stil und Technik zu verbinden, ohne Funktion zu verlieren. Zwei
   Bausteine dafür, beide reine CSS, keine neue Bilddatei:
     - .ico bekommt einen geprägten Rand (box-shadow inset, hell oben/
       dunkel unten) statt der flachen Fläche — wirkt wie eine
       geschnitzte Plakette.
     - a.kachel/a.tipp bekommen zwei gegenüberliegende Goldwinkel
       (::before/::after) statt eines vollen Zierrahmens — dieselbe
       Wirkung wie die Schnörkel-Ecken im Bild, bleibt aber bei jeder
       Kartengröße scharf.

   Gegenbeweis gefahren: "thema":"kaiserlich" in minhkeey.json
   testweise entfernt, neu erzeugt → alle sechs minhkeey-Zusicherungen
   unten wurden rot (kein data-thema, Standardschrift statt Serif,
   kein Goldring/Medaillon/Eckwinkel an den Karten/Knöpfen).
   Zurückgenommen → grün. Für die Erweiterung eigens: border-top-width
   des ::before testweise auf 0 gesetzt → genau die Eckwinkel-
   Zusicherung wurde rot, keine der anderen. Zurückgenommen → grün.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

(async () => {
  const browser = await chromium.launch();

  /* 1 · minhkeey: Schalter gesetzt, Karten/Knöpfe tragen die goldene
     Innenlinie, Kopf-Schrift ist die Serife aus dem Markenblatt. */
  {
    const seite = await (await browser.newContext()).newPage();
    const konsole = [];
    seite.on("pageerror", e => konsole.push(String(e)));
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + path.join(DIST, "minhkeey", "index.html"));
    await seite.waitForTimeout(300);
    await seite.click("body");
    await seite.waitForTimeout(800);

    const info = await seite.evaluate(() => {
      const kachel = document.querySelector("a.kachel");
      /* Seit 10.10. trägt die verbundene Leiste (.kopfwahl) den Goldring,
         die Knöpfe darin sind randlos. */
      const licht = document.querySelector(".kopfwahl");
      const h1 = document.querySelector("h1");
      const ico = document.querySelector("a.kachel .ico");
      const eckeVorher = kachel ? getComputedStyle(kachel, "::before") : null;
      return {
        thema: document.body.dataset.thema,
        kachelSchatten: kachel ? getComputedStyle(kachel).boxShadow : "kein a.kachel",
        lichtRand: licht ? getComputedStyle(licht).borderTopColor : "keine .kopfwahl",
        kopfSchrift: h1 ? getComputedStyle(h1).fontFamily : "kein h1",
        icoSchatten: ico ? getComputedStyle(ico).boxShadow : "kein .ico",
        eckeBreite: eckeVorher ? eckeVorher.borderTopWidth : "kein ::before",
      };
    });
    pruef(info.thema === "kaiserlich", "minhkeey: body trägt data-thema=kaiserlich", info.thema);
    pruef(/rgba?\(0,\s*0,\s*0/.test(info.kachelSchatten) === false && info.kachelSchatten.includes("inset"),
      "minhkeey: a.kachel trägt die goldene Innenlinie (inset)", info.kachelSchatten);
    pruef(info.lichtRand.includes("224") || /rgba?\(224/.test(info.lichtRand),
      "minhkeey: die Kopf-Leiste trägt den Goldring statt des mattweißen Rands", info.lichtRand);
    pruef(/Iowan|Palatino|Charter/.test(info.kopfSchrift),
      "minhkeey: Kopf-Schrift ist die Serife aus dem Markenblatt", info.kopfSchrift);
    pruef(info.icoSchatten.includes("inset"),
      "minhkeey: .ico-Medaillon trägt die geprägte Innenlinie", info.icoSchatten);
    pruef(parseFloat(info.eckeBreite) > 0,
      "minhkeey: a.kachel trägt den goldenen Eckwinkel (::before)", info.eckeBreite);
    pruef(konsole.length === 0, "minhkeey: keine Ausnahme in der Konsole", konsole.join(" | ") || "still");
    await seite.close();
  }

  /* 2 · Choco und Blend: kein Leck — kein data-thema, kein Goldring,
     Standardschrift bleibt (§8.1a: geteilte Vorlage, jedes andere Haus
     muss "kaiserlich" NICHT sehen, solange es nicht selbst gewählt
     wurde). */
  for (const haus of ["chocolamour", "blend"]) {
    const seite = await (await browser.newContext()).newPage();
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + path.join(DIST, haus, "index.html"));
    await seite.waitForTimeout(300);
    await seite.click("body");
    await seite.waitForTimeout(800);
    const info = await seite.evaluate(() => {
      const kachel = document.querySelector("a.kachel");
      const eckeVorher = kachel ? getComputedStyle(kachel, "::before") : null;
      return {
        thema: document.body.dataset.thema || null,
        kachelSchatten: kachel ? getComputedStyle(kachel).boxShadow : "kein a.kachel",
        eckeBreite: eckeVorher ? eckeVorher.borderTopWidth : "kein ::before",
      };
    });
    pruef(info.thema === null, haus + ": kein data-thema", info.thema);
    pruef(!info.kachelSchatten.includes("inset"),
      haus + ": a.kachel ohne die goldene Innenlinie", info.kachelSchatten);
    pruef(parseFloat(info.eckeBreite) === 0,
      haus + ": a.kachel ohne den goldenen Eckwinkel", info.eckeBreite);
    await seite.close();
  }

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
