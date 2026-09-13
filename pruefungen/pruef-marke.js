/* ═══════════════════════════════════════════════════════════════════
   PRUEF-MARKE · "Marke gestalten" im Admin-Board

   Bisher ging der Weg vom Marken-Studio zum gespeicherten Markenblatt
   nur über konto.html: Entwurf verschicken, Link kopieren, auf einer
   anderen Seite einsetzen. Diese Prüfung deckt den neuen, direkten Weg
   im Admin-Board ab — wortgleiche Entschlüsselung wie in konto.html
   (§1.1: kein zweiter, abweichender Ort für dieselbe Logik), dazu neu
   die GEGENRICHTUNG: das gespeicherte Markenblatt zurück in dieselbe
   #m=-Form bringen, damit "Im Marken-Studio öffnen" mit dem aktuellen
   Stand aufgeht statt mit den Vorgaben des Studios.

   Gegenbeweis gefahren: die Bereiche-Schalter beim Entschlüsseln
   testweise immer auf false gezwungen — die Prüfung wurde korrekt rot.
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
  const seite = await (await browser.newContext()).newPage();
  const konsole = [];
  seite.on("pageerror", e => konsole.push(String(e)));
  seite.on("console", x => { if (x.type() === "error") konsole.push(x.text()); });
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

  if (await seite.isVisible('nav[role="tablist"] [data-tafel="einstellungen"]')) {
    await seite.click('nav[role="tablist"] [data-tafel="einstellungen"]');
  } else {
    await seite.click("#mehrKnopf");
    await seite.waitForTimeout(150);
    await seite.click('#mehrfach [data-tafel="einstellungen"]');
  }
  await seite.waitForTimeout(300);

  pruef(await seite.isVisible("#markeOeffnen"), "Karte 'Marke gestalten' ist da");
  pruef(await seite.isVisible("#markeLink"), "Einsetzen-Feld ist da");

  const rundlauf = await seite.evaluate(() => {
    const mb = {
      version: 1,
      betrieb: { name: "Test-Bistro", claim: "Frisch. Ehrlich.", begruessung: "Willkommen!" },
      farben: { grund: "#101010", akzent: "#C9A227" },
      abend: { an: true },
      form: { ecke: "rund" },
      schrift: { kopf: "serif", text: "sans", groesse: 1.1 },
      bereiche: { speisekarte: true, getraenke: true, quiz: false },
      reihe: ["speisekarte", "getraenke", "quiz"]
    };
    const url = markeEntwurfsAdresse(mb);
    const zurueck = markeAusEntwurf(url);
    return { url, zurueck, mbFarben: mb.farben };
  });
  pruef(rundlauf.url.includes("marken-studio.html#m="), "die Adresse zeigt aufs Marken-Studio mit #m=", rundlauf.url.slice(0, 50) + "…");
  pruef(JSON.stringify(rundlauf.zurueck.farben) === JSON.stringify(rundlauf.mbFarben), "Farben kommen beim Rundlauf unverändert zurück");
  pruef(rundlauf.zurueck.bereiche.speisekarte === true && rundlauf.zurueck.bereiche.quiz === false,
    "Bereiche-Schalter kommen unverändert zurück", JSON.stringify(rundlauf.zurueck.bereiche));
  pruef(rundlauf.zurueck.betrieb.name === "Test-Bistro", "Betriebsname kommt zurück", rundlauf.zurueck.betrieb.name);

  await seite.fill("#markeLink", "https://omoteno.de/marken-studio.html#m=nichtgueltig");
  await seite.click("#markeSpeichern");
  await seite.waitForTimeout(200);
  const meldungUngueltig = await seite.textContent("#markeMeldung");
  pruef(/kein gültiger Entwurfslink/i.test(meldungUngueltig), "ungültiger Link wird erkannt und gemeldet", meldungUngueltig.trim());

  const echterLink = await seite.evaluate(() => markeEntwurfsAdresse({
    version: 1, betrieb: { name: "X" }, farben: { grund: "#000" }, form: { ecke: "rund" },
    bereiche: { speisekarte: true }, reihe: ["speisekarte"]
  }));
  await seite.fill("#markeLink", echterLink);
  await seite.click("#markeSpeichern");
  await seite.waitForTimeout(200);
  const meldungDemo = await seite.textContent("#markeMeldung");
  pruef(/Vorführmodus/i.test(meldungDemo), "im Vorführmodus wird das ehrlich gesagt, nicht stillschweigend 'gespeichert'", meldungDemo.trim());

  const geoeffnetMit = await seite.evaluate(() => {
    let erfasst = null;
    const alt = window.open;
    window.open = (url) => { erfasst = url; return null; };
    document.getElementById("markeOeffnen").click();
    window.open = alt;
    return erfasst;
  });
  pruef(typeof geoeffnetMit === "string" && geoeffnetMit.includes("marken-studio.html"),
    "der Öffnen-Knopf öffnet das Marken-Studio", geoeffnetMit);

  const echteFehler = konsole.filter(k => !/ERR_FAILED|net::/.test(k));
  pruef(echteFehler.length === 0, "keine echten Fehler in der Konsole", echteFehler.join(" | ") || "still");

  await seite.close();

  /* ── Die Naht: nicht nur admin.html gegen sich selbst, sondern die
     erzeugte Adresse wirklich im ECHTEN Marken-Studio geoeffnet (§8.1i
     — zwei Haelften, jede nur gegen eine Erfindung der anderen
     geprueft, ist keine Pruefung der Grenze selbst). ── */
  console.log("\n══ Die Naht: admin.html → echtes marken-studio.html ══");
  const seiteAdmin2 = await (await browser.newContext()).newPage();
  await seiteAdmin2.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seiteAdmin2.goto("file://" + path.join(HIER, "admin.html"));
  await seiteAdmin2.waitForTimeout(700);
  await seiteAdmin2.evaluate(() => { document.getElementById("tor").hidden = true; });

  const mbNaht = {
    version: 1,
    betrieb: { name: "Naht-Test-Bistro", claim: "Ehrlich seit 2026", begruessung: "Willkommen!" },
    farben: { grund:"#0A1714", flaeche:"#14332B", flaeche2:"#0D1F1A", band:"#123029",
              bandText:"#EDE7D9", tinte:"#16150F", tinteLeise:"#5C5849", tinteStill:"#9DB0A5",
              linie:"#CFC6AE", linieStark:"#8A7F75", akzent:"#C9A227", akzent2:"#4FA5A8", gut:"#6FAE6A" },
    form: { ecke: "rund" },
    schrift: { kopf: "serif", text: "sans", groesse: 1 },
    bereiche: { speisekarte: true, getraenke: false },
    reihe: ["speisekarte", "getraenke"]
  };
  const urlNaht = await seiteAdmin2.evaluate((mb) => markeEntwurfsAdresse(mb), mbNaht);
  await seiteAdmin2.close();

  const hashNaht = urlNaht.split("#")[1];
  const seiteStudio = await (await browser.newContext()).newPage();
  const fehlerStudio = [];
  seiteStudio.on("pageerror", e => fehlerStudio.push(String(e)));
  await seiteStudio.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seiteStudio.goto("file://" + path.join(HIER, "marken-studio.html") + "#" + hashNaht);
  await seiteStudio.waitForTimeout(700);

  const geladen = await seiteStudio.evaluate(() => ({
    name: M.betrieb.name, grund: M.farben.grund, akzent: M.farben.akzent,
    ecke: M.form.ecke, speisekarte: M.bereiche.speisekarte, getraenke: M.bereiche.getraenke
  })).catch(e => ({ fehler: String(e) }));

  pruef(geladen.name === "Naht-Test-Bistro", "das ECHTE Marken-Studio liest den Betriebsnamen", geladen.name);
  pruef(geladen.grund === "#0A1714", "…und den Seitengrund", geladen.grund);
  pruef(geladen.akzent === "#C9A227", "…und die Hauptfarbe", geladen.akzent);
  pruef(geladen.ecke === "rund", "…und die Formauswahl", geladen.ecke);
  pruef(geladen.speisekarte === true && geladen.getraenke === false, "…und die Bereiche-Schalter, je einzeln",
    JSON.stringify({ speisekarte: geladen.speisekarte, getraenke: geladen.getraenke }));
  pruef(fehlerStudio.length === 0, "keine Ausnahme beim Einlesen im echten Studio", fehlerStudio.join(" | ") || "still");

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
