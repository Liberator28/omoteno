/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Eigene Karten (bis 20), Gerichte in mehreren Karten

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-karten.js

   Wunsch (07.10.): Mittags-, Abend- oder andere Karten anlegen, bis zu
   20, jede einer Kachel zuweisbar; ein Gericht darf in mehreren Karten
   stehen; Kategorien ohne Gericht. Die Datenbank-Hälfte steht in
   datenbank/migration-karten.sql (Schranken live geprüft).

   HUB, mit nachgestellter Serverantwort (zwei Häuser, §8.1a):
   - „#/k-mittag“ zeigt die eigene Karte unter ihrem Namen und
     Unterzeile, mit genau den Gerichten, die sie in gerichte.karten
     tragen — ein Gericht in zwei Karten steht in beiden.
   - Ohne die Spalte karten gilt wie bisher die eine Karte (Rückfall).
   - Positivliste: ein Eintrag „kontakt“ im Verzeichnis oder an einem
     Gericht überschreibt die Kontaktseite NICHT.
   - Umbenannte feste Karte: Name aus dem Verzeichnis im Seitenkopf;
     Grundname im Verzeichnis lässt die Seite wie vorher.
   - Ein Gericht aus der eigenen Karte lässt sich in den Korb legen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DIST = process.env.DIST || path.join(__dirname, "..", "dist");
let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}
const BID = "11111111-2222-3333-4444-555555555555";

const GERICHTE = [
  { id: "a", name: "Tagessuppe", kategorie: "Suppen", preis: 6.5, karte: "speisekarte", karten: ["speisekarte", "k-mittag"], verfuegbar: true },
  { id: "b", name: "Mittagsteller", kategorie: "Teller", preis: 11.9, karte: "k-mittag", karten: ["k-mittag"], verfuegbar: true },
  { id: "c", name: "Hausbrause", kategorie: "Kalt", preis: 3.5, karte: "getraenke", verfuegbar: true },
  { id: "d", name: "Falle", kategorie: "Böse", preis: 1, karte: "speisekarte", karten: ["kontakt"], verfuegbar: true },
];

async function hub(browser, haus, karten) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
  const seite = await ctx.newPage();
  const fehler = [];
  seite.on("pageerror", e => fehler.push(String(e)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await seite.route("**/rest/v1/betriebe**", r => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify([{ id: BID, bestell_pause: false, hub_texte: {}, karten }]) }));
  await seite.route("**/rest/v1/gerichte**", r => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(GERICHTE) }));
  await seite.goto("file://" + path.join(DIST, haus, "index.html"));
  await seite.waitForTimeout(1600);
  /* Öffnungszeiten fest (§8.1j), sonst fehlt außerhalb der Zeit der Korbknopf. */
  await seite.evaluate(() => { if (typeof ZEITEN !== "undefined") { ZEITEN.length = 0; for (let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59"); } });
  return { ctx, seite, fehler };
}
async function lies(seite, ziel) {
  await seite.evaluate(z => { location.hash = z; }, ziel);
  await seite.waitForTimeout(500);
  return seite.evaluate(() => ({
    seite: seiteJetzt,
    h2: (document.querySelector("#inhalt .seite h2") || {}).textContent || "",
    unter: (document.querySelector("#inhalt .seite > p.unter") || {}).textContent || "",
    gerichte: Array.from(document.querySelectorAll("#inhalt .gericht .n, #inhalt .gericht [data-gname]"))
      .map(e => e.textContent.trim()).join("|"),
    text: document.getElementById("inhalt").textContent,
  }));
}

(async () => {
  const browser = await chromium.launch();
  const haeuser = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html"))).slice(0, 2);

  for (const haus of haeuser) {
    const { ctx, seite, fehler } = await hub(browser, haus, [
      { id: "k-mittag", name: "Mittagskarte", unter: "Werktags 11–15 Uhr" },
      { id: "kontakt", name: "Böse" },
      { id: "speisekarte", name: "Speisekarte" },
    ]);
    const vor = await seite.evaluate(() => ({ extra: Object.keys(KARTEN_EXTRA), verz: KARTEN_VERZ.map(k => k.id) }));
    pruef(vor.extra.join() === "k-mittag", haus + ": Voraussetzung — genau die eigene Karte ist geladen", JSON.stringify(vor));

    const m = await lies(seite, "#/k-mittag");
    pruef(m.seite === "k-mittag" && m.h2 === "Mittagskarte" && /11–15/.test(m.unter),
      haus + ": eigene Karte unter ihrem Namen und Unterzeile", m.h2 + " / " + m.unter);
    pruef(/Tagessuppe/.test(m.text) && /Mittagsteller/.test(m.text) && !/Hausbrause/.test(m.text),
      haus + ": genau ihre Gerichte", m.text.slice(0, 0) + ["Tagessuppe", "Mittagsteller", "Hausbrause"].map(x => x + ":" + m.text.includes(x)).join(" "));
    const s = await lies(seite, "#/speisekarte");
    pruef(/Tagessuppe/.test(s.text) && !/Mittagsteller/.test(s.text), haus + ": Gericht in zwei Karten steht in beiden, das andere nur in seiner",
      ["Tagessuppe", "Mittagsteller"].map(x => x + ":" + s.text.includes(x)).join(" "));
    /* Vorrang: Name auf der Kachel (Markenblatt oder Board) vor dem
       Kartennamen — die Erwartung wird aus KACHELN gelesen, nicht fest. */
    const kachel = await seite.evaluate(() => { const k = KACHELN.find(x => x.schluessel === "speisekarte");
      return k ? { titel: k.titel, unter: k.unter, grund: KACHELARTEN.speisekarte.titel } : null; });
    const erwartet = kachel && kachel.titel && kachel.titel !== kachel.grund ? kachel.titel : "Speisekarte";
    pruef(s.h2 === erwartet, haus + ": Grundname im Verzeichnis lässt die feste Seite wie vorher", s.h2 + " (erwartet " + erwartet + ")");
    const g = await lies(seite, "#/getraenke");
    pruef(/Hausbrause/.test(g.text), haus + ": ohne Spalte karten gilt die eine Karte (Rückfall)");
    const k = await lies(seite, "#/kontakt");
    pruef(!/Falle/.test(k.text) && /Öffnungszeiten|WANN WIR DA SIND/i.test(k.text),
      haus + ": „kontakt“ im Verzeichnis und am Gericht überschreibt die Kontaktseite nicht", k.h2);

    await lies(seite, "#/k-mittag");
    const plus = await seite.$('#inhalt [data-merk="' + encodeURIComponent("Mittagsteller") + '"]');
    pruef(!!plus, haus + ": Korbknopf am Gericht der eigenen Karte");
    if (plus) {
      await plus.click();
      await seite.waitForTimeout(500);
      const imKorb = await seite.evaluate(() => !!merk["Mittagsteller"]);
      pruef(imKorb, haus + ": Tipp legt es wirklich in den Korb");
    }
    pruef(fehler.length === 0, haus + ": keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();

    /* Umbenannte feste Karte */
    const r = await hub(browser, haus, [{ id: "speisekarte", name: "Hauptkarte", unter: "Alles frisch" }]);
    const u = await lies(r.seite, "#/speisekarte");
    const kk = await r.seite.evaluate(() => { const k = KACHELN.find(x => x.schluessel === "speisekarte");
      return { titel: k.titel, unter: k.unter || "", grund: KACHELARTEN.speisekarte.titel }; });
    const kachelEigen = kk.titel && kk.titel !== kk.grund;
    const eT = kachelEigen ? kk.titel : "Hauptkarte";
    const eU = kachelEigen ? kk.unter : (kk.unter || "Alles frisch");
    pruef(u.h2 === eT && u.unter === eU, haus + ": umbenannte feste Karte — Kachelname vor Kartenname",
      u.h2 + " / " + u.unter + " (erwartet " + eT + " / " + eU + ")");
    /* Und ohne eigenen Kachelnamen muss der Kartenname wirklich greifen:
       Kachel zur Laufzeit auf den Grundnamen zurück, neu zeichnen. */
    const ohne = await r.seite.evaluate(() => { const k = KACHELN.find(x => x.schluessel === "speisekarte");
      k.titel = KACHELARTEN.speisekarte.titel; k.unter = ""; location.hash = "#/"; return true; });
    const u2 = await lies(r.seite, "#/speisekarte");
    pruef(ohne && u2.h2 === "Hauptkarte" && u2.unter === "Alles frisch", haus + ": ohne Kachelnamen gilt der Kartenname",
      u2.h2 + " / " + u2.unter);
    await r.ctx.close();
  }

  /* ══ BOARD (Vorführmodus, eigene Probedaten) ══════════════════════
     - Karten-Chips aus dem Verzeichnis, „＋ Karte“ und „✎ Karten“.
     - Neue Karte im Blatt anlegen → Chip erscheint, Verzeichnis trägt
       sie, Schlüssel „k-…“.
     - Gericht in zwei Karten: Mehrfachwahl speichert karten = [beide],
       karte = die erste; es steht in beiden Listen.
     - Karte entfernen: ein Gericht NUR in dieser Karte zieht in die
       gewählte um, eines in zwei Karten verliert nur diese — keins geht
       verloren.
     - Höchstens 20 Karten: „Neue Karte“ ist danach gesperrt.
     - Leere Kategorie in der neuen Karte, ohne Gericht. */
  {
    const ADMIN = "file://" + path.join(__dirname, "..", "seiten", "admin.html");
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    p.on("dialog", d => d.accept());
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto(ADMIN);
    await p.waitForTimeout(700);
    await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten();
      let i = 0;
      const z = (kategorie, name, karte) => ({ id: "p" + (++i), betrieb_id: betriebId, karte, karten: [karte], kategorie, name,
        beschreibung: "", preis: 5 + i, verfuegbar: true, kat_sort: 1, reihenfolge: i, kat_emoji: null });
      gerichte = [z("Burger", "Classic", "speisekarte"), z("Burger", "Cheese", "speisekarte"), z("Softdrinks", "Cola", "getraenke")];
      KARTENSTAND = [];
      zeichneAlles();
      const sch = document.getElementById("scharf"); if(sch) sch.hidden = true;
      tafelZeigen("speisekarte");
    });
    await p.waitForTimeout(400);
    const chips = await p.$$eval("#kartenWahl .chip", els => els.map(e => e.textContent.trim()));
    pruef(chips.slice(0, 3).join("|") === "Speisekarte|Getränke|Cocktails" && chips.includes("＋ Karte") && chips.some(c => /Karten/.test(c)),
      "Board: Karten-Chips aus dem Verzeichnis + „＋ Karte“ + „✎ Karten“", chips.join(" | "));

    await p.click("#kartenWahl [data-karte-neu]");
    await p.waitForTimeout(350);
    const offen = await p.evaluate(() => !document.getElementById("kvBlatt").hidden);
    pruef(offen, "Board: „＋ Karte“ öffnet das Karten-Blatt");
    const felder = await p.$$("#kvListe [data-kv-name]");
    await felder[felder.length - 1].fill("Mittagskarte");
    const unter = await p.$$("#kvListe [data-kv-unter]");
    await unter[unter.length - 1].fill("Werktags 11–15 Uhr");
    await p.click("#kvSichern");
    await p.waitForTimeout(450);
    const nachNeu = await p.evaluate(() => ({ verz: KARTENSTAND.map(k => k.id + ":" + k.name).join(","),
      chips: [...document.querySelectorAll("#kartenWahl .chip[data-karte]")].map(e => e.dataset.karte).join(",") }));
    pruef(/k-mittagskarte:Mittagskarte/.test(nachNeu.verz) && /k-mittagskarte/.test(nachNeu.chips),
      "Board: neue Karte steht im Verzeichnis (k-…) und als Chip", JSON.stringify(nachNeu));

    /* Gericht in zwei Karten */
    const zwei = await p.evaluate(async () => {
      const g = gerichte.find(x => x.name === "Classic");
      blattOeffnen(g);
      document.querySelector('#fKarten [data-karte-wahl="k-mittagskarte"]').click();
      await sichern(false);
      welcheKarte = "k-mittagskarte"; zeichneKarte();
      const inMittag = [...document.querySelectorAll("#karteListe .gname")].map(e => e.textContent);
      welcheKarte = "speisekarte"; zeichneKarte();
      const inSpeise = [...document.querySelectorAll("#karteListe .gname")].map(e => e.textContent);
      return { karten: g.karten.join(","), karte: g.karte, inMittag, inSpeise };
    });
    pruef(zwei.karten === "speisekarte,k-mittagskarte" && zwei.karte === "speisekarte",
      "Board: Mehrfachwahl speichert beide Karten, die erste bleibt karte", JSON.stringify(zwei.karten + " / " + zwei.karte));
    pruef(zwei.inMittag.includes("Classic") && zwei.inSpeise.includes("Classic") && !zwei.inMittag.includes("Cheese"),
      "Board: das Gericht steht in beiden Listen, das andere nur in seiner", zwei.inMittag.join(",") + " / " + zwei.inSpeise.join(","));

    /* Leere Kategorie in der neuen Karte */
    await p.evaluate(() => { document.querySelector('#kartenWahl [data-karte="k-mittagskarte"]').click(); });
    await p.waitForTimeout(250);
    await p.click("[data-kted-neu]");
    await p.waitForTimeout(300);
    await p.fill("#ktedName", "Suppen");
    await p.click("#ktedSichern");
    await p.waitForTimeout(400);
    const leerKat = await p.evaluate(() => ({ kopf: !!document.querySelector('.leer-kat [data-kted="Suppen"]'),
      verz: ((KARTENSTAND.find(k => k.id === "k-mittagskarte") || {}).kategorien || []).map(x => x.name).join(",") }));
    pruef(leerKat.kopf && leerKat.verz === "Suppen", "Board: Kategorie ohne Gericht in der eigenen Karte", JSON.stringify(leerKat));

    /* Karte entfernen: Speisekarte weg, Ziel Getränke */
    const weg = await p.evaluate(async () => {
      kvOeffnen(false);
      const i = kvEntwurf.findIndex(k => k.id === "speisekarte");
      document.querySelector('[data-kv-weg="' + i + '"]').click();
      const sel = document.querySelector('[data-kv-ziel="' + i + '"]');
      if(sel){ sel.value = "getraenke"; sel.dispatchEvent(new Event("change", { bubbles: true })); }
      await new Promise(r => { document.getElementById("kvSichern").click(); setTimeout(r, 400); });
      const c = gerichte.find(x => x.name === "Classic"), ch = gerichte.find(x => x.name === "Cheese");
      return { anzahl: gerichte.length, classic: c.karten.join(","), cheese: ch.karten.join(","), cheeseKarte: ch.karte,
               verz: KARTENSTAND.map(k => k.id).join(",") };
    });
    pruef(weg.anzahl === 3, "Board: beim Entfernen einer Karte geht kein Gericht verloren", weg.anzahl);
    pruef(weg.classic === "k-mittagskarte", "Board: Gericht in zwei Karten verliert nur die entfernte", weg.classic);
    pruef(weg.cheese === "getraenke" && weg.cheeseKarte === "getraenke", "Board: Gericht nur in der entfernten zieht ins Ziel", weg.cheese);
    pruef(!/speisekarte/.test(weg.verz), "Board: die Karte ist aus dem Verzeichnis", weg.verz);

    /* Höchstens 20 */
    const zwanzig = await p.evaluate(() => {
      kvOeffnen(false);
      while(kvEntwurf.length < 20) kvEntwurf.push({ id: null, name: "Karte " + kvEntwurf.length, unter: "", kategorien: [], _neu: true });
      kvZeichnen();
      const gesperrt = document.getElementById("kvNeu").disabled;
      kvZu();
      return gesperrt;
    });
    pruef(zwanzig, "Board: bei 20 Karten ist „Neue Karte“ gesperrt");
    pruef(fehler.length === 0, "Board: keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if (f) { console.log(f + " FEHL"); process.exit(1); }
  console.log("Alles sauber.");
})();
