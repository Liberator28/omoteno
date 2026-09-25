/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · „Passt dazu“ im Warenkorb  (braucht dist/)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-korb-vorschlag.js

   Wunsch des Betreibers: Im Warenkorb sollen andere Speisen oder
   Ergänzungen vorgeschlagen werden. Gemessen wird gegen die ECHTE Karte
   beider Häuser (§8.1a — ein Haus sieht jede eingebrannte Annahme für
   richtig an):
     · nichts, was schon im Korb liegt, nichts ohne Preis
     · fehlt ein Getränk, steht zuerst ein Getränk da
     · „+“ legt wirklich in den Korb, die Zeile erscheint, der
       Vorschlag verschwindet — und eine getippte Tischnummer bleibt
     · Übersetzung (Englisch), keine Laufzeitfehler, kein Überlauf
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const OBEN = path.resolve(__dirname, "..");

let n = 0, f = 0;
const pruef = (gut, text, mehr) => { n++; if(!gut) f++;
  console.log((gut ? "  ok   " : "  FEHL ") + text + (mehr !== undefined ? "  → " + mehr : "")); };

async function hubAuf(br, haus, breite, korb){
  const ctx = await br.newContext({ viewport:{ width:breite, height:844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await p.addInitScript(([slug, korb]) => {
    localStorage.setItem("omoteno-willkommen", "1");
    localStorage.setItem("omoteno-merk-" + slug, JSON.stringify(korb));
  }, [haus, korb]);
  await p.goto("file://" + path.join(OBEN, "dist", haus, "index.html") + "#/auswahl");
  await p.waitForTimeout(1200);
  return { p, ctx, fehler };
}

(async () => {
  const br = await chromium.launch();
  for(const haus of ["chocolamour", "blend"]){
    console.log("\n══ " + haus + " ══");
    /* Ein Gericht aus der Speisekarte, KEIN Getränk — dann muss die
       Getränke-Regel greifen. Welches, sagt die Karte selbst.
       Ehrliche Grenze: Ohne Datenbank zeigt jeder Hub die Beispielkarte
       aus der Vorlage (auch Blend) — live kommt die Karte des Hauses
       aus gerichte. Die Regel wird hier also zweimal an derselben
       Karte gemessen; der Unterschied der Häuser liegt in Farbe,
       Rundung und Sprache, die sehr wohl je Haus greifen. */
    const probe = await hubAuf(br, haus, 390, {});
    const erstes = await probe.p.evaluate(() => {
      for(const gr of SPEISEKARTE) for(const e of gr.eintraege) if(e.p !== "–") return { n:e.n, p:e.p };
      return null; });
    await probe.ctx.close();
    pruef(!!erstes, "Voraussetzung: die Karte hat ein bestellbares Gericht", erstes && erstes.n);
    if(!erstes) continue;

    const { p, ctx, fehler } = await hubAuf(br, haus, 390, { [erstes.n]: { n:erstes.n, p:erstes.p, b:"", m:1 } });
    const lage = await p.evaluate(name => {
      const karten = [...document.querySelectorAll(".dazu-karte")];
      const namen = karten.map(k => decodeURIComponent(k.querySelector("[data-dazu]").dataset.dazu));
      const ohnePreis = namen.filter(x => { const g = findeGericht(x); return !g || g.p === "–"; });
      const orte = namen.map(x => (gerichtOrt(x) || {}).karte);
      return { anzahl:karten.length, namen, doppelt:namen.includes(name), ohnePreis, erstesOrt:orte[0],
        getraenkeDa: GETRAENKE.some(gr => gr.eintraege.some(e => e.p !== "–")) || COCKTAILS.some(gr => gr.eintraege.some(e => e.p !== "–")),
        kopf:(document.querySelector(".dazu-kopf") || {}).textContent || "" };
    }, erstes.n);
    pruef(lage.anzahl >= 1 && lage.anzahl <= 4, "ein bis vier Vorschläge stehen da", lage.anzahl + ": " + lage.namen.join(", "));
    pruef(!lage.doppelt, "nichts, was schon im Korb liegt");
    pruef(!lage.ohnePreis.length, "nichts ohne Preis", lage.ohnePreis.join(", ") || "keins");
    if(lage.getraenkeDa)
      pruef(lage.erstesOrt === "getraenke" || lage.erstesOrt === "cocktails",
        "kein Getränk im Korb → zuerst ein Getränk", lage.erstesOrt);
    pruef(lage.kopf === "Passt dazu", "Überschrift „Passt dazu“", lage.kopf);

    /* Stabil: zweimal zeichnen, dieselbe Reihe (§4.2 — kein Zufall). */
    const zweimal = await p.evaluate(() => {
      const a = dazuVorschlaege().map(x => x.e.n).join("|");
      const b = dazuVorschlaege().map(x => x.e.n).join("|");
      return a === b; });
    pruef(zweimal, "dieselbe Reihenfolge bei jedem Zeichnen");

    /* Tischnummer tippen, dann „+“ — die Nummer muss bleiben. */
    const tisch = await p.$("#bTisch");
    if(tisch) await tisch.fill("12");
    const erster = lage.namen[0];
    await p.click('.dazu-karte [data-dazu="' + encodeURIComponent(erster) + '"]');
    await p.waitForTimeout(500);
    const nach = await p.evaluate(name => ({
      imKorb: !!merk[name],
      zeile: !!document.querySelector('[data-zeile="' + encodeURIComponent(name) + '"]'),
      nochVorgeschlagen: !!document.querySelector('.dazu-karte [data-dazu="' + encodeURIComponent(name) + '"]'),
      tisch: (document.getElementById("bTisch") || {}).value,
      artikel: (document.getElementById("artikelzahl") || {}).textContent }), erster);
    pruef(nach.imKorb, "„+“ legt es in den Korb", erster);
    pruef(nach.zeile, "die Zeile erscheint in der Auswahl");
    pruef(!nach.nochVorgeschlagen, "und steht nicht mehr bei den Vorschlägen");
    if(tisch) pruef(nach.tisch === "12", "eine getippte Tischnummer bleibt stehen", nach.tisch);

    /* Kein Überlauf auf dem schmalsten Telefon. */
    await p.setViewportSize({ width:360, height:780 });
    await p.waitForTimeout(200);
    const breit = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(breit <= 0, "bei 360 px kein seitlicher Überlauf", breit + " px");

    /* Englisch */
    await p.evaluate(() => { spracheSetzen("en"); zeichne(); });
    await p.waitForTimeout(400);
    const en = await p.evaluate(() => (document.querySelector(".dazu-kopf") || {}).textContent || "");
    pruef(en === "Goes well with it", "übersetzt (Englisch)", en || "(nicht gefunden)");

    pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }
  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Fehler." : n + " von " + n + " ok\nAlles sauber."));
  process.exit(f ? 1 : 0);
})();
