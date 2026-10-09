/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Gericht schnell anlegen (Wunsch 07.10.)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-gericht-schnell.js

   „Es soll schnell und einfach sein, ein Gericht anzulegen.“ Das Blatt
   zeigt oben nur Name, Preis, Kategorie und Foto; alles Weitere liegt
   unter „Mehr Angaben“. Geprüft wird, was ein Wirt WIRKLICH tut:

   1 · Ruhelage: „Mehr Angaben“ ist zu, die Beschreibung liegt nicht
       unter dem Finger, der Satz darunter nennt den Stand.
   2 · Erstes Gericht: Name, Preis mit KOMMA, Kategorie, Speichern —
       steht danach mit dem richtigen Preis in der Karte.
   3 · Vorschläge: erkannte Allergene erscheinen als Chips, NICHTS wird
       von selbst gesetzt; ein Tipp setzt genau das eine; Gegenfall
       ohne Treffer zeigt gar keine Vorschlagszeile.
   4 · „Speichern & nächstes“: Blatt bleibt offen, Kategorie und Karte
       bleiben, Name/Preis/Allergene sind leer, der Fokus steht im
       Namen. Das zweite Gericht braucht nur noch drei Schritte.
   5 · Zuletzt benutzte Kategorie ist beim nächsten Öffnen gesetzt.
   6 · Unlesbarer Preis speichert nicht und sagt warum.
   7 · Vorhandenes Gericht: Preis mit Komma angezeigt, unverändert
       gespeichert bleibt er gleich; „Speichern & nächstes“ fehlt dort.
   8 · Fokus in einem Feld unter „Mehr Angaben“ (Tab) klappt auf.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const OBEN  = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

async function neueSeite(browser, breite) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 860 }, hasTouch: breite < 500 });
  const seite = await ctx.newPage();
  const kons = [];
  seite.on("pageerror", e => kons.push(String(e).slice(0, 300)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(700);
  await seite.evaluate(() => {
    try { Object.keys(localStorage).filter(k => k.startsWith("omoteno-entwurf-")).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    document.getElementById("tor").hidden = true;
    if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
    const sch = document.getElementById("scharf"); if (sch) sch.hidden = true;
  });
  await seite.waitForTimeout(400);
  await seite.evaluate(() => document.querySelector('[data-tafel="speisekarte"]').click());
  await seite.waitForTimeout(300);
  return { ctx, seite, kons };
}

const zustand = seite => seite.evaluate(() => ({
  offen: !document.getElementById("blatt").hidden,
  name: document.getElementById("fName").value,
  preis: document.getElementById("fPreis").value,
  kat: document.getElementById("fKat").value,
  karten: fKartenWahl.slice(),
  alg: stoffeLesen("#fAllergene"),
  fokus: document.activeElement && document.activeElement.id,
  weiterSichtbar: !document.getElementById("speichernWeiter").hidden,
  stand: document.getElementById("mehrStand").textContent,
  mehrOffen: document.getElementById("mehrAuf").getAttribute("aria-expanded") === "true",
  klappHoehe: document.getElementById("mehrKlapp").getBoundingClientRect().height,
}));

async function kategorieWaehlen(seite, name) {
  await seite.click("#katKnopf");
  await seite.waitForTimeout(150);
  const chip = seite.locator("#katChips .katchip", { hasText: name }).first();
  if (await chip.count()) await chip.click();
  else { await seite.fill("#fKat", name); await seite.click("#katKnopf"); }
  await seite.waitForTimeout(150);
}

(async () => {
  const browser = await chromium.launch();

  for (const breite of [390, 1100]) {
    console.log("\n══ Breite " + breite + " px ══");
    const { ctx, seite, kons } = await neueSeite(browser, breite);

    /* Voraussetzung: eine Kategorie gibt es in der Vorführkarte. */
    const katDa = await seite.evaluate(() => katNamen(welcheKarte)[0] || "");
    pruef(!!katDa, "Vorführkarte hat eine Kategorie", katDa);
    const vorher = await seite.evaluate(() => gerichte.length);

    /* 1 · Ruhelage */
    await seite.click("#neuesGericht");
    await seite.waitForTimeout(350);
    let z = await zustand(seite);
    pruef(z.offen, "„Gericht hinzufügen“ öffnet das Blatt");
    pruef(!z.mehrOffen && z.klappHoehe < 2, "„Mehr Angaben“ ist zu", z.klappHoehe.toFixed(1) + " px");
    pruef(/Küche|Theke/.test(z.stand), "Satz unter „Mehr Angaben“ nennt den Stand", z.stand);
    pruef(z.weiterSichtbar, "„Speichern & nächstes“ steht bei einem neuen Gericht da");
    const verdeckt = await seite.evaluate(() => {
      const el = document.getElementById("fBeschr"), r = el.getBoundingClientRect();
      if (r.height < 1 || r.width < 1) return true;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 10));
      return hit !== el;
    });
    pruef(verdeckt, "Beschreibung liegt zugeklappt nicht unter dem Finger");
    const knopfH = await seite.$eval("#mehrAuf", el => el.getBoundingClientRect().height);
    pruef(knopfH >= 44, "„Mehr Angaben“ ≥ 44 px hoch", knopfH.toFixed(1));

    /* 3 · Vorschläge setzen nichts von selbst */
    await seite.fill("#fName", "Käsespätzle mit Ei");
    await seite.waitForTimeout(400);
    z = await zustand(seite);
    const chips = await seite.$$eval("#gVorschlag [data-vorschlag-allergen]", l => l.map(b => b.dataset.vorschlagAllergen));
    pruef(chips.includes("G") && chips.includes("C"), "Vorschläge Milch (G) und Ei (C) erscheinen", chips.join(","));
    pruef(z.alg === "", "nichts wird von selbst gesetzt", JSON.stringify(z.alg));
    const chipH = await seite.$eval("#gVorschlag [data-vorschlag-allergen]", el => el.getBoundingClientRect().height);
    pruef(chipH >= 44, "Vorschlags-Chip ≥ 44 px", chipH.toFixed(1));
    await seite.click('#gVorschlag [data-vorschlag-allergen="G"]');
    await seite.waitForTimeout(150);
    z = await zustand(seite);
    const nachTipp = await seite.$$eval("#gVorschlag [data-vorschlag-allergen]", l => l.map(b => b.dataset.vorschlagAllergen));
    pruef(z.alg === "G", "ein Tipp setzt genau Milch", z.alg);
    pruef(!nachTipp.includes("G") && nachTipp.includes("C"), "gesetzter Vorschlag verschwindet, der andere bleibt", nachTipp.join(","));
    pruef(/1 Allergen/.test(z.stand), "Satz zählt das Allergen", z.stand);

    /* Gegenfall: kein Treffer → keine Zeile */
    await seite.fill("#fName", "Pommes");
    await seite.waitForTimeout(400);
    const leerZeile = await seite.$eval("#gVorschlag", el => el.hidden);
    pruef(leerZeile, "ohne Treffer keine Vorschlagszeile");

    /* 2 · Erstes Gericht mit Komma-Preis */
    await seite.fill("#fName", "Testteller Eins");
    await seite.fill("#fPreis", "8,90");
    await kategorieWaehlen(seite, katDa);
    await seite.click("#speichern");
    await seite.waitForTimeout(500);
    const eins = await seite.evaluate(() => gerichte.find(g => g.name === "Testteller Eins") || null);
    pruef(!!eins, "Gericht steht nach Name, Preis, Kategorie, Speichern in der Karte");
    pruef(eins && eins.preis === 8.9, "„8,90“ wird zu 8.9", eins && eins.preis);
    pruef(eins && eins.kategorie === katDa, "Kategorie stimmt", eins && eins.kategorie);
    pruef(eins && eins.allergene === "G", "der getippte Vorschlag ist mitgespeichert", eins && eins.allergene);

    /* 5 · Zuletzt benutzte Kategorie */
    await seite.click("#neuesGericht");
    await seite.waitForTimeout(350);
    z = await zustand(seite);
    pruef(z.kat === katDa, "nächstes Gericht beginnt in der zuletzt benutzten Kategorie", z.kat);

    /* 4 · Speichern & nächstes — nur drei Schritte */
    await seite.fill("#fName", "Testteller Zwei");
    await seite.fill("#fPreis", "4.5");
    await seite.click("#speichernWeiter");
    await seite.waitForTimeout(500);
    z = await zustand(seite);
    const zwei = await seite.evaluate(() => gerichte.find(g => g.name === "Testteller Zwei") || null);
    pruef(!!zwei && zwei.preis === 4.5, "zweites Gericht in drei Schritten gespeichert", zwei && zwei.preis);
    pruef(z.offen, "Blatt bleibt offen");
    pruef(z.name === "" && z.preis === "" && z.alg === "", "Name, Preis, Allergene sind leer", JSON.stringify([z.name, z.preis, z.alg]));
    pruef(z.kat === katDa, "Kategorie bleibt", z.kat);
    pruef(z.karten.join() === (zwei ? (zwei.karten || [zwei.karte]).join() : "?"), "Karte(n) bleiben", z.karten.join());
    pruef(z.fokus === "fName", "Fokus steht im Namen", z.fokus);
    await seite.fill("#fName", "Testteller Drei");
    await seite.fill("#fPreis", "5");
    await seite.click("#speichernWeiter");
    await seite.waitForTimeout(500);
    const nachher = await seite.evaluate(() => gerichte.length);
    pruef(nachher - vorher === 3, "drei Gerichte angelegt, keins doppelt", nachher - vorher);

    /* 6 · Unlesbarer Preis */
    await seite.fill("#fName", "Testteller Kaputt");
    await seite.fill("#fPreis", "neun");
    await seite.click("#speichernWeiter");
    await seite.waitForTimeout(300);
    const kaputt = await seite.evaluate(() => ({
      da: gerichte.some(g => g.name === "Testteller Kaputt"),
      meldung: (document.getElementById("meldung") || {}).textContent || "",
      fokus: document.activeElement && document.activeElement.id }));
    pruef(!kaputt.da, "„neun“ als Preis speichert nicht");
    pruef(/Preis/.test(kaputt.meldung) && kaputt.fokus === "fPreis", "Meldung nennt den Preis, Fokus im Preisfeld", kaputt.meldung.trim());

    /* 8 · Tab in ein Feld unter „Mehr Angaben“ klappt auf */
    await seite.evaluate(() => mehrAufZu(false));
    await seite.waitForTimeout(100);
    await seite.focus("#fBeschr");
    await seite.waitForTimeout(400);
    z = await zustand(seite);
    pruef(z.mehrOffen && z.klappHoehe > 100, "Fokus in der Beschreibung klappt auf", z.klappHoehe.toFixed(0) + " px");
    await seite.fill("#fBeschr", "mit Röstzwiebeln");
    await seite.waitForTimeout(100);
    z = await zustand(seite);
    pruef(/Beschreibung/.test(z.stand), "Satz nennt die Beschreibung", z.stand);
    await seite.click("#abbrechen");
    await seite.waitForTimeout(400);

    /* 7 · Vorhandenes Gericht */
    const vorhanden = await seite.evaluate(() => {
      const g = gerichte.find(x => x.name === "Testteller Eins");
      blattOeffnen(g);
      return { preis: document.getElementById("fPreis").value, weiter: !document.getElementById("speichernWeiter").hidden };
    });
    await seite.waitForTimeout(300);
    pruef(vorhanden.preis === "8,90", "vorhandener Preis erscheint als „8,90“", vorhanden.preis);
    pruef(!vorhanden.weiter, "beim Bearbeiten kein „Speichern & nächstes“");
    await seite.click("#speichern");
    await seite.waitForTimeout(400);
    const preisDanach = await seite.evaluate(() => gerichte.find(x => x.name === "Testteller Eins").preis);
    pruef(preisDanach === 8.9, "unverändert gespeichert bleibt der Preis 8.9", preisDanach);

    pruef(kons.length === 0, "keine Fehler auf der Seite", kons.join(" | "));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " Fehler von " + n : "Alles sauber. (" + n + " Proben)"));
  process.exit(f ? 1 : 0);
})();
