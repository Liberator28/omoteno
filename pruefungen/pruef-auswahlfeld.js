/* ═══════════════════════════════════════════════════════════════════
   PRUEF-AUSWAHLFELD · Kategorie- und Karte-Klappfeld im Admin-Board

   Zwei native Steuerelemente wurden durch animierte Klapp-Felder
   ersetzt (Kategorie: Feld+datalist → Knopf+Panel+Chips; "Gehört zur
   Karte": <select> → Segment mit gleitendem Schieber). Die echten
   Felder (#fKat, #fKarte) bleiben unveraendert im Dokument, nur die
   Bedienoberflaeche ist neu — deshalb prüft dieses Skript vor allem,
   dass beide Seiten (neue Oberflaeche, altes Feld) synchron bleiben.

   VORFALL beim Bauen, festgehalten: Die "leer"-Klasse fuer den
   Platzhaltertext kollidierte mit der laengst vorhandenen
   ".leer"-Karte ("Diese Karte ist noch leer", admin.html Zeile 1277,
   padding 52px, zentrierter Text) — aus einer 22px-Zeile wurde eine
   126px hohe Flaeche. Gefunden per Diff der computed-style mit/ohne
   Klasse, nicht durch Ansehen. Umbenannt zu ".platzhalter". Genau das
   ist CLAUDE.md §1.1 in freier Wildbahn — deshalb hier die
   Tapflaechen-Messung als STAENDIGE Prüfung, nicht nur als einmaliger
   Handgriff.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const HIER = path.join(__dirname, "..", "seiten");

let n = 0, f = 0;
function pruef(bed, txt, det) {
  n++; if (!bed) f++;
  console.log((bed ? "  ok  " : "  FEHL") + " " + txt + (det !== undefined ? "  → " + det : ""));
}

async function board(seite) {
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
  await seite.evaluate(() => { blattOeffnen(null); });
  await seite.waitForTimeout(250);
  /* „Gehört zu“ liegt seit 07.10. unter „Mehr Angaben“. */
  await seite.click("#mehrAuf");
  await seite.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch();
  const seite = await (await browser.newContext()).newPage();
  const konsole = [];
  seite.on("pageerror", e => konsole.push(String(e)));
  seite.on("console", x => { if (x.type() === "error") konsole.push(x.text()); });
  /* Die Bibliothek kommt aus einem fremden Netz — hier absichtlich
     blockiert, wie in jeder anderen Board-Pruefung auch. */
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());

  await board(seite);

  console.log("\n══ Kategorie-Feld ══");
  pruef(await seite.isVisible("#katKnopf"), "Kategorie-Knopf sichtbar");

  /* Die Tapflaechen — der eigentliche Anlassfall dieser Datei. */
  const knopfHoehe = await seite.$eval("#katKnopf", e => e.getBoundingClientRect().height);
  pruef(knopfHoehe >= 44 && knopfHoehe < 60, "Kategorie-Knopf ist ~44px hoch, keine leere-Karte-Kollision", knopfHoehe.toFixed(1) + "px");

  const zuVorher = await seite.evaluate(() => getComputedStyle($("#katPanel")).opacity);
  pruef(parseFloat(zuVorher) === 0, "Panel ist ZU, bevor man tippt", zuVorher);

  await seite.click("#katKnopf");
  await seite.waitForTimeout(250);
  const expanded = await seite.getAttribute("#katKnopf", "aria-expanded");
  pruef(expanded === "true", "aria-expanded steht nach dem Öffnen", expanded);
  const opOffen = await seite.evaluate(() => getComputedStyle($("#katPanel")).opacity);
  pruef(parseFloat(opOffen) === 1, "Panel ist jetzt sichtbar (opacity 1)", opOffen);
  const bewegtSichPerTransform = await seite.evaluate(() =>
    getComputedStyle(document.getElementById("katPanel")).transform !== "none");
  pruef(bewegtSichPerTransform, "und bewegt sich über transform, nicht über top/left");

  const chipTexte = await seite.$$eval(".katchip", els => els.map(e => e.textContent.trim()));
  pruef(chipTexte.length > 0, "Kategorie-Chips sind aus den Demo-Daten gefüllt", chipTexte.join(", "));
  const chipHoehen = await seite.$$eval(".katchip", els => els.map(e => e.getBoundingClientRect().height));
  pruef(chipHoehen.every(h => h >= 44), "jeder Chip ist mindestens 44px hoch (§8.1d)", chipHoehen.join(", "));

  await seite.fill("#fKat", "Küc");
  await seite.waitForTimeout(80);
  const gefiltert = await seite.$$eval(".katchip", els => els.map(e => e.textContent.trim()));
  pruef(gefiltert.length > 0 && gefiltert.every(t => t.toLowerCase().includes("küc")),
    "Tippen filtert die Chips", gefiltert.join(", "));

  await seite.fill("#fKat", "");
  await seite.waitForTimeout(80);
  const ersteChip = await seite.$(".katchip");
  const chipText = (await ersteChip.textContent()).trim();
  await ersteChip.click();
  await seite.waitForTimeout(250);
  pruef((await seite.inputValue("#fKat")) === chipText, "Antippen einer Kategorie setzt #fKat (das echte Feld)");
  pruef((await seite.getAttribute("#katKnopf", "aria-expanded")) === "false", "und schließt das Panel danach");
  pruef((await seite.textContent("#katWert")).trim() === chipText, "der Knopftext zeigt den neuen Wert");

  await seite.click("#katKnopf");
  await seite.waitForTimeout(200);
  await seite.click("#fName");
  await seite.waitForTimeout(200);
  pruef((await seite.getAttribute("#katKnopf", "aria-expanded")) === "false", "Klick außerhalb schließt das Panel");

  await seite.click("#katKnopf");
  await seite.waitForTimeout(200);
  await seite.keyboard.press("Escape");
  await seite.waitForTimeout(200);
  pruef((await seite.getAttribute("#katKnopf", "aria-expanded")) === "false", "Escape schließt das Panel");

  console.log("\n══ Gehört zu (Karten, Mehrfachwahl) ══");
  /* Seit 07.10.: statt drei fester Segmente je Karte ein Chip, ein
     Gericht darf in mehreren Karten stehen. #fKarte bleibt das echte
     Feld für die ERSTE Karte — daraus leitet sich die Zuständigkeit ab. */
  pruef((await seite.inputValue("#fKarte")) === "speisekarte", "Karte startet auf speisekarte");
  const startSpur = await seite.evaluate(() => $("#fSpur").querySelector('[aria-pressed="true"]').dataset.spur);
  pruef(startSpur === "kueche", "Zuständigkeit startet auf Küche (aus der Karte hergeleitet)");

  const kartenChipHoehen = await seite.$$eval("#fKarten button", els => els.map(e => e.getBoundingClientRect().height));
  pruef(kartenChipHoehen.length >= 3 && kartenChipHoehen.every(h => h >= 44), "jeder Karten-Chip ist mindestens 44px hoch (§8.1d)", kartenChipHoehen.join(", "));

  await seite.click('#fKarten button[data-karte-wahl="getraenke"]');
  await seite.waitForTimeout(150);
  const beide = await seite.$$eval('#fKarten button[aria-pressed="true"]', els => els.map(e => e.dataset.karteWahl));
  pruef(beide.join() === "speisekarte,getraenke", "Tipp auf „Getränke“ nimmt die Karte DAZU", beide.join());
  pruef((await seite.inputValue("#fKarte")) === "speisekarte", "die erste Karte bleibt im echten Feld");
  await seite.click('#fKarten button[data-karte-wahl="speisekarte"]');
  await seite.waitForTimeout(150);
  pruef((await seite.inputValue("#fKarte")) === "getraenke", "Speisekarte abgewählt → Getränke ist die erste Karte");
  const neueSpur = await seite.evaluate(() => $("#fSpur").querySelector('[aria-pressed="true"]').dataset.spur);
  pruef(neueSpur === "theke", "die abgeleitete Zuständigkeit zieht mit — alte Logik unverändert erreichbar");
  await seite.click('#fKarten button[data-karte-wahl="getraenke"]');
  await seite.waitForTimeout(150);
  const bleibt = await seite.$$eval('#fKarten button[aria-pressed="true"]', els => els.map(e => e.dataset.karteWahl));
  pruef(bleibt.join() === "getraenke", "die letzte Karte lässt sich nicht abwählen", bleibt.join());

  console.log("\n══ Ohne Bewegung ══");
  await seite.emulateMedia({ reducedMotion: "reduce" });
  await board(seite);
  await seite.click("#katKnopf");
  const opReduziert = await seite.evaluate(() => getComputedStyle($("#katPanel")).opacity);
  pruef(parseFloat(opReduziert) === 1, "das Panel ist sofort da, kein Warten auf eine Animation, die nicht laufen soll", opReduziert);

  /* Die eigene Netzblockade oben erzeugt selbst Konsolenfehler
     (ERR_FAILED für /lib/supabase-js, die es unter file:// nicht gibt) — die zaehlen nicht als
     Befund dieser Pruefung, siehe pruef-board.js für dasselbe Muster. */
  const echteFehler = konsole.filter(k => !/ERR_FAILED|net::/.test(k));
  pruef(echteFehler.length === 0, "keine echten Fehler in der Konsole", echteFehler.slice(0, 3).join(" | ") || "still");

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
