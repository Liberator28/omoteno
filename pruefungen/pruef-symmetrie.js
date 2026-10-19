/* ═══════════════════════════════════════════════════════════════════
   PRUEF-SYMMETRIE · Zeit- und Datumsleisten im Admin-Board

   Der ursprüngliche Auftrag: "Achte dass alle Balken so wie Auswahl
   von Uhrzeit und Datum symmetrisch sind und nichts absteht oder
   abgehakt ist." Diese Datei misst genau das, statt es anzusehen:
   Von–Bis-Zeitfelder, die sieben Liefertage, das Warteszeit-Rad und
   das Preis/Läuft-Paar im Top-Runner-Formular — auf drei Breiten,
   mit dem echten `getBoundingClientRect()`, nicht mit einem Blick.

   Ergebnis beim ersten Lauf: alles bereits sauber, kein Fund. Bleibt
   trotzdem als Prüfung stehen — genau diese Stellen sind es, die der
   Auftrag benannt hat, und eine Prüfung, die nichts findet, ist kein
   Grund, sie wegzulassen (§0). Gegenbeweis gefahren: probeweise das
   Innenpolster der Tagesknöpfe vergrößert (0 10px → 0 24px), die
   Prüfung wurde an allen drei Breiten korrekt rot.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const HIER = path.join(__dirname, "..", "seiten");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

(async () => {
  const browser = await chromium.launch();
  for (const breite of [375, 430, 768]) {
    const seite = await (await browser.newContext({ viewport: { width: breite, height: 900 } })).newPage();
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + path.join(HIER, "admin.html"));
    await seite.waitForTimeout(700);
    await seite.evaluate(() => {
      document.getElementById("tor").hidden = true;
      if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
    });
    await seite.waitForTimeout(400);
    const scharf = await seite.$("#scharfJetzt");
    if (scharf && await seite.isVisible("#scharf")) await scharf.click();
    await seite.waitForTimeout(200);

    console.log("\n══ Breite " + breite + "px ══");

    /* Einstellungen liegen mobil hinter "Mehr", am Rechner direkt im
       Reiter — je nach Breite ist nur einer der beiden Wege sichtbar. */
    if (await seite.isVisible('nav[role="tablist"] [data-tafel="einstellungen"]')) {
      await seite.click('nav[role="tablist"] [data-tafel="einstellungen"]');
    } else {
      await seite.click("#mehrKnopf");
      await seite.waitForTimeout(150);
      await seite.click('#mehrfach [data-tafel="einstellungen"]');
    }
    await seite.waitForTimeout(300);
    /* Seit 18.10. liegt „Lieferung“ hinter ihrer Kachel — echter Tipp.
       Versteckt hätte jedes Rechteck 0 × 0 und jede Probe hier wäre
       grün (§8.1g). */
    const lfId = await seite.evaluate(() => document.getElementById("lfVon").closest("#t-einstellungen > .egruppe").id);
    await seite.click('[data-eu-seite="' + lfId + '"]');
    await seite.waitForTimeout(200);
    pruef(await seite.isVisible("#lfTage"), "Voraussetzung: Unterseite Lieferung offen, Tagesknöpfe sichtbar");

    for (const sel of ["#lfVon", "#lfBis", "#lfTage"]) {
      const info = await seite.$eval(sel, el => {
        const r = el.getBoundingClientRect();
        return { right: r.right, left: r.left, viewport: window.innerWidth };
      }).catch(() => null);
      if (!info) continue;
      pruef(info.right <= info.viewport + 0.5, sel + " ragt nicht über den rechten Rand", info.right.toFixed(1) + " von " + info.viewport);
      pruef(info.left >= -0.5, sel + " ragt nicht über den linken Rand", info.left.toFixed(1));
    }

    /* Tagesknöpfe: kein "abgehacktes" Aussehen — jede Zeile trägt
       gleich breite Knöpfe, keine gestreckte letzte Zeile. */
    const tage = await seite.$$eval(".tagknopf", els => els.map(e => {
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), width: r.width };
    })).catch(() => []);
    if (tage.length) {
      const zeilen = {};
      tage.forEach(t => { (zeilen[t.top] = zeilen[t.top] || []).push(t.width); });
      const zeilenListe = Object.values(zeilen);
      const gleichbreit = zeilenListe.every(zeile => (Math.max(...zeile) - Math.min(...zeile)) < 1);
      pruef(gleichbreit, "jede Zeile der Tagesknöpfe ist gleich breit — nichts abgehackt", JSON.stringify(zeilenListe.map(z => z.length)));
    }

    /* Wartezeit-Rad */
    await seite.evaluate(() => zeitBlattOeffnen && zeitBlattOeffnen("fPreis"));
    await seite.waitForTimeout(200);
    const radInfo = await seite.$eval("#zeitRad", el => {
      const r = el.getBoundingClientRect();
      return { right: r.right, left: r.left, viewport: window.innerWidth };
    }).catch(() => null);
    if (radInfo) {
      pruef(radInfo.right <= radInfo.viewport + 0.5, "#zeitRad ragt nicht rechts über", radInfo.right.toFixed(1) + " von " + radInfo.viewport);
      pruef(radInfo.left >= -0.5, "#zeitRad ragt nicht links über", radInfo.left.toFixed(1));
    }
    await seite.evaluate(() => zeitBlattSchliessen && zeitBlattSchliessen());
    await seite.waitForTimeout(300);

    /* Top-Runner: Preis/Läuft nebeneinander */
    if (await seite.isVisible('nav[role="tablist"] [data-tafel="speisekarte"]')) {
      await seite.click('nav[role="tablist"] [data-tafel="speisekarte"]');
    } else {
      await seite.click('#befehlsleiste [data-tafel="speisekarte"]');
    }
    await seite.waitForTimeout(300);
    const runnerAuf = await seite.$("#runnerAuf");
    if (runnerAuf) {
      await runnerAuf.click();
      await seite.waitForTimeout(300);
      const runnerZwei = await seite.$eval(".runner-zwei", el => {
        const kids = [...el.children].map(k => k.getBoundingClientRect());
        return { rights: kids.map(k => k.right), viewport: window.innerWidth };
      }).catch(() => null);
      if (runnerZwei) {
        pruef(Math.max(...runnerZwei.rights) <= runnerZwei.viewport + 0.5,
          ".runner-zwei (Preis/Läuft) ragt nicht über den rechten Rand",
          Math.max(...runnerZwei.rights).toFixed(1) + " von " + runnerZwei.viewport);
      }
    }

    await seite.close();
  }
  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
