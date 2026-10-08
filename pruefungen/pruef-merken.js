/* ═══════════════════════════════════════════════════════════════════
   pruef-merken.js — gemerkte Auswahl mit allen Extras (Wunsch 08.10.)

   Anlass, zwei Teile:

   A · Ein Fehler, gefunden beim Lesen vor dem Bau: merk[] lag im
       localStorage, optWahl (die Extras) nur im Speicher. Und die
       Bestellung wartete in der Warteschlange OHNE ihre Extras — der
       Sender las sie erst beim Senden aus optWahl. Neuladen zwischen
       Abschicken und Ankommen ⇒ Bon ohne Extras, Preis ohne Aufpreis.
       Die Probe dazu geht genau diesen Weg: Abschicken, Server stumm,
       Neuladen, zweiter Versuch — und liest die gesendete Nutzlast.

   B · Der Wunsch: „Der Browser merkt sich die Auswahl samt Toppings
       und schlägt sie vor — ein Knopf, sofort die richtige Auswahl.“
       Entschieden: nur auf dem Gerät. Gemessen wird: Chip im Blatt
       setzt NICHTS von selbst, ein Tipp setzt genau die alte Wahl;
       Karte „Nochmal wie letztes Mal“ mit Summe zum HEUTIGEN Preis
       (Aktionspreis eingeschlossen), ein Tipp füllt den Korb samt
       Extras; was es nicht mehr gibt, wird genannt und fehlt; nichts
       davon geht an den Server.

   Die Uhr steht fest auf 14 Uhr (§8.1j).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DIST = process.env.DIST || path.join(__dirname, "..", "dist");
const HAEUSER = ["chocolamour", "blend"].filter(h => fs.existsSync(path.join(DIST, h, "index.html")));
if (HAEUSER.length < 2) { console.error("dist/ fehlt — erst node erzeuger/erzeuge-hub.js --alle"); process.exit(1); }
const BID = "11111111-2222-3333-4444-555555555555";
const G = "L'AMouR Crêpe";
/* Uhr UND Öffnungszeiten legt die Prüfung selbst fest (§8.1j) —
   Blends Markenblatt hat an jedem Tag „Ruhetag“, Choco öffnet 10:30.
   Muster aus pruef-liefern.js. */
const UHR = { chocolamour: "2026-10-08T14:00:00", blend: "2026-10-08T14:00:00" };
async function zeitenAuf(p) {
  await p.evaluate(() => {
    if (typeof ZEITEN === "undefined") return;
    ZEITEN.length = 0;
    for (let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59");
  });
}
const spaeter = s => new Date(new Date(s).getTime() + 10 * 60000);

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

async function hubAuf(ctx, haus, netz) {
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.clock.setFixedTime(netz.uhr);
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith("file://")) return r.continue();
    const body = r.request().postData() || "";
    netz.alle.push(u + " " + body);
    if (/rest\/v1\/betriebe/.test(u)) return r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify([{ id: BID, bestell_pause: false, bestell_pause_text: "", hub_texte: {} }]) });
    if (/rpc\/bestellung_aufgeben/.test(u)) {
      netz.bestellungen.push(JSON.parse(body || "{}"));
      return netz.stumm ? r.fulfill({ status: 503, body: "" })
        : r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify("aaaaaaaa-bbbb-cccc-dddd-000000000001") });
    }
    if (/rest\/v1\/aktionen/.test(u)) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(netz.aktionen || []) });
    if (/rpc\/gast_melden/.test(u)) return r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, neu: false, besuche: 1, lieblinge: [], gutscheine: [] }) });
    return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await p.goto("file://" + path.join(DIST, haus, "index.html"));
  await p.waitForTimeout(1300);
  await zeitenAuf(p);
  return { p, fehler };
}

async function extrasWaehlen(p, namen) {
  await p.evaluate(g => detailOeffnen(g), G);
  await p.waitForTimeout(350);
  for (const z of namen) {
    await p.click('#warenkarte [data-ozeile="' + encodeURIComponent(z) + '"]');
    await p.waitForTimeout(80);
  }
}

(async () => {
  const browser = await chromium.launch();

  for (const haus of HAEUSER) {
    console.log("\n══ " + haus + " ══");
    const netz = { alle: [], bestellungen: [], stumm: false, aktionen: [], uhr: new Date(UHR[haus]) };
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
    let { p, fehler } = await hubAuf(ctx, haus, netz);
    const grund = await p.evaluate(g => preisNum(korbPreis(findeGericht(g))), G);
    pruef(grund > 0, "Voraussetzung: " + G + " steht mit Preis in der Karte", grund);
    const offen = await p.evaluate(() => jetztOffen());
    pruef(offen.offen, "Voraussetzung: das Haus hat zur gestellten Uhrzeit geöffnet", offen.text);

    /* ── A1 · Neuladen behält die Extras ───────────────────────── */
    await extrasWaehlen(p, ["Erdbeere", "Nutella"]);
    await p.click('#warenkarte [data-wmerk]');
    await p.waitForTimeout(200);
    await p.reload(); await p.waitForTimeout(1300); await zeitenAuf(p);
    const nachLaden = await p.evaluate(g => ({ text: optText(g), auf: optAufpreis(g), summe: merkSumme(), im: !!merk[g] }), G);
    pruef(nachLaden.im && /Erdbeere/.test(nachLaden.text) && /Nutella/.test(nachLaden.text),
      "Neuladen: Gericht UND Extras stehen noch im Korb", nachLaden.text);
    pruef(Math.abs(nachLaden.summe - (grund + 4)) < 0.001, "Neuladen: die Summe trägt den Aufpreis", nachLaden.summe.toFixed(2));

    /* ── A2 · Ungültiges im Speicher fällt still weg ──────────── */
    await p.evaluate(g => {
      const roh = JSON.parse(localStorage.getItem(hSchluessel("opt")));
      roh[g].suess.push("Drachenfrucht");
      localStorage.setItem(hSchluessel("opt"), JSON.stringify(roh));
    }, G);
    await p.reload(); await p.waitForTimeout(1300); await zeitenAuf(p);
    const bereinigt = await p.evaluate(g => optText(g), G);
    pruef(!/Drachenfrucht/.test(bereinigt) && /Erdbeere/.test(bereinigt),
      "eine Zeile, die es nicht gibt, landet nicht auf dem Bon", bereinigt);

    /* ── A3 · Abschicken, Server stumm, Neuladen, zweiter Versuch ─ */
    netz.stumm = true;
    await p.evaluate(() => { location.hash = "#/auswahl"; });
    await p.waitForTimeout(400);
    if (await p.$("#bTisch")) await p.fill("#bTisch", "7");
    await p.click('[data-aktion="bestellen"]');
    await p.waitForTimeout(800);
    pruef(netz.bestellungen.length >= 1, "Voraussetzung: der erste Versuch ging hinaus (und scheiterte)", netz.bestellungen.length);
    /* Danach eine ANDERE Wahl am selben Gericht — auch die darf die
       wartende Bestellung nicht verändern. */
    await p.evaluate(g => { optWahl[g] = { suess: ["Banane"] }; }, G);
    netz.stumm = false;
    const vorher = netz.bestellungen.length;
    /* Zeit vergeht: Die Warteschlange versucht es erst nach einer
       Pause erneut (naechster). Unter der festen Uhr käme sie nie. */
    await p.clock.setFixedTime(spaeter(UHR[haus]));
    await p.reload(); await p.waitForTimeout(2500); await zeitenAuf(p);
    const zweiter = netz.bestellungen.slice(vorher).pop();
    const pos = zweiter && zweiter.p_positionen && zweiter.p_positionen[0];
    pruef(!!pos, "Voraussetzung: nach dem Neuladen kam der zweite Versuch", pos ? pos.name : "keiner");
    if (pos) {
      pruef(/Erdbeere/.test(pos.name) && /Nutella/.test(pos.name) && !/Banane/.test(pos.name),
        "zweiter Versuch: der Bon trägt die Extras von damals", pos.name);
      pruef(Math.abs(pos.preis - (grund + 4)) < 0.001, "zweiter Versuch: Preis mit Aufpreis", pos.preis);
    }

    /* ── B1 · Karte „Nochmal wie letztes Mal“ ─────────────────── */
    await p.evaluate(() => { location.hash = "#/"; });
    await p.waitForTimeout(500);
    const karte = await p.evaluate(() => {
      const k = document.querySelector(".nmkarte");
      if (!k) return null;
      return { text: k.textContent, preis: (k.querySelector(".kpreis") || {}).textContent || "" };
    });
    pruef(!!karte && karte.text.includes(G) && /Erdbeere/.test(karte.text), "Startseite: „Nochmal wie letztes Mal“ mit Gericht und Extras",
      karte ? karte.text.replace(/\s+/g, " ").slice(0, 90) : "fehlt");
    const soll = await p.evaluate(x => preisText(x), grund + 4);
    pruef(!!karte && karte.preis === soll, "die Summe stimmt", karte && karte.preis + " (soll " + soll + ")");

    /* Heutiger Preis: Läuft eine Aktion auf dem Gericht, zählt sie. */
    netz.aktionen = [{ id: "a1", gericht_name: G, titel: null, preis_alt: grund, preis_neu: grund - 3,
      bis: new Date("2026-10-08T18:00:00").toISOString() }];
    await p.evaluate(() => aktionenLaden());
    await p.waitForTimeout(500);
    await p.evaluate(() => zeichne());
    await p.waitForTimeout(300);
    const heute = await p.evaluate(() => (document.querySelector(".nmkarte .kpreis") || {}).textContent || "");
    const sollHeute = await p.evaluate(x => preisText(x), grund - 3 + 4);
    pruef(heute === sollHeute, "die Summe nimmt den Preis von HEUTE (Aktion)", heute + " (soll " + sollHeute + ")");
    netz.aktionen = [];
    await p.evaluate(() => aktionenLaden()); await p.waitForTimeout(400);

    /* ── B2 · ein Tipp füllt den Korb samt Extras ─────────────── */
    await p.evaluate(() => zeichne()); await p.waitForTimeout(250);
    await p.click("[data-nochmal]");
    await p.waitForTimeout(400);
    const voll = await p.evaluate(g => ({ hash: location.hash, im: !!merk[g], text: optText(g), summe: merkSumme() }), G);
    pruef(voll.hash === "#/auswahl" && voll.im && /Erdbeere/.test(voll.text) && /Nutella/.test(voll.text),
      "ein Tipp: Korb samt Extras, weiter zur Auswahl", JSON.stringify(voll));

    /* ── B3 · Chip „Wie letztes Mal“ setzt nichts von selbst ───── */
    await p.evaluate(g => { delete merk[g]; merkSpeichern(); optWahl[g] = {}; detailOeffnen(g); }, G);
    await p.waitForTimeout(400);
    const chip = await p.evaluate(g => ({ da: !!document.querySelector("#warenkarte .wieletzt"),
      was: (document.querySelector("#warenkarte .wieletzt") || {}).textContent || "", jetzt: optText(g) }), G);
    pruef(chip.da && /Erdbeere/.test(chip.was), "Blatt: Chip „Wie letztes Mal“ mit den alten Extras", chip.was);
    pruef(chip.jetzt === "", "der Chip setzt NICHTS von selbst", JSON.stringify(chip.jetzt));
    await p.click("#warenkarte .wieletzt");
    await p.waitForTimeout(250);
    const nachChip = await p.evaluate(g => ({ text: optText(g), chip: !!document.querySelector("#warenkarte .wieletzt"),
      knopf: (document.querySelector("#warenkarte [data-wmerk] .kpreis") || {}).textContent || "" }), G);
    const sollKnopf = await p.evaluate(x => preisText(x), grund + 4);
    pruef(/Erdbeere/.test(nachChip.text) && /Nutella/.test(nachChip.text) && !nachChip.chip,
      "ein Tipp setzt genau die alte Wahl (und der Chip geht)", nachChip.text);
    pruef(nachChip.knopf === sollKnopf, "der Knopf zeigt den Preis mit Extras", nachChip.knopf + " (soll " + sollKnopf + ")");
    const chipFlaeche = await p.evaluate(() => { const r = document.querySelector("#warenkarte [data-wmerk]").getBoundingClientRect(); return r.height; });
    await p.evaluate(() => detailSchliessen()); await p.waitForTimeout(300);

    /* ── B4 · Entfallenes wird genannt und fehlt ──────────────── */
    await p.evaluate(g => {
      merk = {}; merkSpeichern();
      const z = JSON.parse(localStorage.getItem(hSchluessel("zuletzt")));
      z.b.posten[0].w.suess.push("Drachenfrucht");
      z.b.posten.push({ n: "Gibt-es-nicht-Crêpe", m: 2, w: {} });
      localStorage.setItem(hSchluessel("zuletzt"), JSON.stringify(z));
      location.hash = "#/"; zeichne();
    }, G);
    await p.waitForTimeout(400);
    const fehlt = await p.evaluate(() => (document.querySelector(".nmkarte .nm-fehlt") || {}).textContent || "");
    pruef(/Gibt-es-nicht-Crêpe/.test(fehlt), "die Karte nennt, was es nicht mehr gibt", fehlt);
    await p.click("[data-nochmal]");
    await p.waitForTimeout(400);
    const nach = await p.evaluate(g => ({ namen: Object.keys(merk), text: optText(g),
      melde: (document.getElementById("melde") || {}).textContent || "" }), G);
    pruef(nach.namen.length === 1 && nach.namen[0] === G && !/Drachenfrucht/.test(nach.text),
      "übernommen wird nur, was es gibt", JSON.stringify(nach.namen) + " " + nach.text);
    pruef(/Gibt-es-nicht-Crêpe/.test(nach.melde) && /Drachenfrucht/.test(nach.melde),
      "und gesagt, was fehlt (Gericht UND Extra)", nach.melde);

    /* ── B5 · Englisch, nichts an den Server ──────────────────── */
    await p.evaluate(() => { merk = {}; merkSpeichern(); spracheSetzen("en"); location.hash = "#/"; zeichne(); });
    await p.waitForTimeout(400);
    const en = await p.evaluate(() => (document.querySelector(".nmkarte strong") || {}).textContent || "");
    pruef(en === "Again, like last time", "Englisch: die Karte ist übersetzt", en);
    await p.evaluate(() => { spracheSetzen("de"); zeichne(); });
    const verraten = netz.alle.filter(x => /zuletzt|"w":\{/.test(x));
    pruef(verraten.length === 0, "nichts vom Gemerkten ging an den Server", verraten.length + " Anfragen");

    /* ── B6 · Maße: Knopf ≥ 44 px, kein Überlauf bei 360 px ────── */
    await p.setViewportSize({ width: 360, height: 780 });
    await p.waitForTimeout(250);
    const mass = await p.evaluate(() => {
      const k = document.querySelector(".nmkarte"), b = k && k.querySelector("[data-nochmal]");
      return k ? { knopf: b.getBoundingClientRect().height, ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        rechts: k.getBoundingClientRect().right } : null;
    });
    pruef(!!mass && mass.knopf >= 44 && mass.ueber <= 0 && mass.rechts <= 360,
      "360 px: Knopf ≥ 44 px, nichts schiebt seitlich", JSON.stringify(mass));
    pruef(chipFlaeche >= 44, "Blatt-Knopf ≥ 44 px", chipFlaeche);
    pruef(fehler.length === 0, "keine Skriptfehler", fehler[0] || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " Fehler von " + n : "Alles sauber. (" + n + " Proben)"));
  process.exit(f ? 1 : 0);
})();
