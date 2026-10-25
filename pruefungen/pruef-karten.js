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

async function hub(browser, haus, karten, kacheln) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
  const seite = await ctx.newPage();
  const fehler = [];
  seite.on("pageerror", e => fehler.push(String(e)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await seite.route("**/rest/v1/betriebe**", r => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify([Object.assign({ id: BID, bestell_pause: false, hub_texte: {}, karten },
      kacheln ? { hub_kacheln: kacheln } : {})]) }));
  await seite.route("**/rest/v1/gerichte**", r => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(GERICHTE) }));
  await seite.goto("file://" + path.join(DIST, haus, "index.html"));
  await seite.waitForTimeout(1600);
  /* Öffnungszeiten fest (§8.1j), sonst fehlt außerhalb der Zeit der Korbknopf. */
  await seite.evaluate(() => { if (typeof ZEITEN !== "undefined") { ZEITEN.length = 0; for (let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59"); } });
  /* Diese Prüfung gilt dem Benennen der Karten (Kachel vor Kartenname). Mit Startgrafik trägt die Speisekarte die Kopfkarte des Hauses
     (Titel/Text aus dem Markenblatt, pruef-startgrafik.js) — die Namensregel wird deshalb OHNE sie geprüft. */
  await seite.evaluate(() => { if (typeof MARKENBLATT !== "undefined") { MARKENBLATT.startgrafik = undefined; sgDekoStand = "#"; zeichne(); } });
  return { ctx, seite, fehler };
}
async function lies(seite, ziel) {
  await seite.evaluate(z => { location.hash = z; }, ziel);
  await seite.waitForTimeout(500);
  return seite.evaluate(() => ({
    seite: seiteJetzt,
    h2: (document.querySelector("#inhalt .seite h2") || {}).textContent || "",
    /* Klassisch steht die Unterzeile direkt unter der Überschrift der Seite, im Premium-Stil (Choco) in der Kopfkarte (.kopfkarte p.unter). */
    unter: (document.querySelector("#inhalt .seite > p.unter, #inhalt .seite .kopfkarte p.unter") || {}).textContent || "",
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

  /* ══ L3 · HUB: eigene Kacheln, Karte je Kachel, Zeitplan ═══════════
     - Eine eigene Karten-Kachel führt auf ihre Karte, eine Link-Kachel
       nach draußen (neues Fenster).
     - Positivliste: ein Link mit Anführungszeichen (Attribut-Ausbruch)
       oder javascript: erzeugt KEINE Kachel; kein onclick im Dokument.
     - Die feste Speisekarten-Kachel mit Zeitplan zeigt in der Zeit die
       Abendkarte — die Zeitrechnung mit fester Uhr geprüft (§8.1j),
       auch über Mitternacht. */
  for (const haus of haeuser) {
    const KACHELN_PROBE = [
      { schluessel: "speisekarte", plan: [{ von: "00:00", bis: "23:59", karte: "k-abend" }] },
      { schluessel: "e-mittag1", art: "karte", karte: "k-mittag", titel: "Mittagstisch" },
      { schluessel: "e-link001", art: "link", link: "https://example.org/shop", titel: "Unser Shop" },
      { schluessel: "e-boese01", art: "link", link: 'https://x.de" onclick="alert(1)', titel: "Böse 1" },
      { schluessel: "e-boese02", art: "link", link: "javascript:alert(1)", titel: "Böse 2" },
      { schluessel: "e-BOESE", art: "karte", karte: "k-mittag", titel: "Böse 3" },
    ];
    const { ctx, seite, fehler } = await hub(browser, haus, [
      { id: "k-mittag", name: "Mittagskarte" }, { id: "k-abend", name: "Abendkarte", unter: "Ab 17 Uhr" }], KACHELN_PROBE);
    await seite.evaluate(() => { location.hash = "#/"; });
    await seite.waitForTimeout(600);
    const k = await seite.evaluate(() => {
      const a = sch => document.querySelector('#inhalt a.kachel[data-kachel="' + sch + '"]');
      const href = sch => a(sch) ? a(sch).getAttribute("href") : null;
      return { mittag: href("e-mittag1"), link: href("e-link001"),
               linkZiel: a("e-link001") ? a("e-link001").getAttribute("target") : null,
               boese: ["e-boese01", "e-boese02", "e-BOESE"].map(href),
               onclick: document.querySelectorAll("[onclick]").length,
               speise: href("speisekarte") };
    });
    pruef(k.mittag === "#/k-mittag", haus + ": eigene Karten-Kachel führt auf ihre Karte", k.mittag);
    pruef(k.link === "https://example.org/shop" && k.linkZiel === "_blank", haus + ": Link-Kachel öffnet draußen", k.link + " " + k.linkZiel);
    pruef(k.boese.every(x => x === null) && k.onclick === 0, haus + ": Positivliste — kein Ausbruch, kein javascript:, kein falscher Schlüssel",
      JSON.stringify(k.boese) + " onclick:" + k.onclick);
    pruef(k.speise === "#/k-abend", haus + ": feste Kachel mit Zeitplan zeigt in der Zeit die andere Karte", k.speise);
    const m = await lies(seite, "#/k-mittag");
    pruef(m.h2 === "Mittagstisch", haus + ": Seite trägt den Namen der eigenen Kachel", m.h2);
    const ab = await lies(seite, "#/k-abend");
    pruef(ab.h2 === "Abendkarte" && ab.unter === "Ab 17 Uhr", haus + ": über den Zeitplan erreichte Karte heißt wie im Verzeichnis", ab.h2 + " / " + ab.unter);
    const uhr = await seite.evaluate(() => {
      const k = { schluessel: "speisekarte", karte: "speisekarte",
                  plan: [{ von: "11:00", bis: "15:00", karte: "k-mittag" }, { von: "22:00", bis: "02:00", karte: "k-abend" }] };
      const um = (h, m) => kachelKarte(k, new Date(2026, 9, 7, h, m));
      return [um(10, 59), um(11, 0), um(14, 59), um(15, 0), um(23, 30), um(1, 30), um(2, 0)].join(",");
    });
    pruef(uhr === "speisekarte,k-mittag,k-mittag,speisekarte,k-abend,k-abend,speisekarte",
      haus + ": Zeitplan mit fester Uhr: Grenzen und über Mitternacht", uhr);
    pruef(fehler.length === 0, haus + ": keine Ausnahme (L3)", fehler.join(" | ") || "still");
    await ctx.close();
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
      const inMittag = [...document.querySelectorAll("#karteListe .gname, #karteListe .kr-name")].map(e => e.textContent);
      welcheKarte = "speisekarte"; zeichneKarte();
      const inSpeise = [...document.querySelectorAll("#karteListe .gname, #karteListe .kr-name")].map(e => e.textContent);
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

    /* L3 · Kacheln anlegen, Karte zuweisen, Zeitplan, Link, löschen */
    const kb = await p.evaluate(() => {
      kbAusZeile([]);
      KARTENSTAND = [{ id: "speisekarte", name: "Speisekarte", unter: "", kategorien: [] },
                     { id: "k-mittag", name: "Mittagskarte", unter: "", kategorien: [] }];
      tafelZeigen("startseite"); kbZeichnen();
      document.getElementById("kbNeuKarte").click();
      const neu = KACHELSTAND.find(k => /^e-/.test(k.schluessel) && k.art === "karte");
      const zeile = document.querySelector('[data-kb="' + neu.schluessel + '"]');
      const sel = zeile.querySelector("[data-kb-karte]");
      sel.value = "k-mittag"; sel.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector('[data-kb="speisekarte"] [data-kb-auf]').click();
      document.querySelector('[data-kb="speisekarte"] [data-kb-plan-neu]').click();
      document.getElementById("kbNeuLink").click();
      const link = KACHELSTAND.find(k => k.art === "link");
      const feld = document.querySelector('[data-kb="' + link.schluessel + '"] [data-kb-link]');
      feld.value = 'https://x.de" onclick="1'; feld.dispatchEvent(new Event("input", { bubbles: true }));
      const boeseGespeichert = link.link;
      feld.value = "https://example.org/shop"; feld.dispatchEvent(new Event("input", { bubbles: true }));
      const roh = kbRoh();
      const rundlauf = (kbAusZeile(JSON.parse(JSON.stringify(roh))), KACHELSTAND.map(k => k.schluessel + ":" + (k.karte || "") + ":" + (k.plan || []).length + ":" + (k.link || "")).join("|"));
      const gruppeMittag = kbGruppeVon(neu.schluessel);
      const festLoeschbar = !!document.querySelector('[data-kb="speisekarte"] [data-kb-loeschen]');
      kbZeichnen();
      document.querySelector('[data-kb="' + link.schluessel + '"] [data-kb-auf]') && null;
      kbOffen.add(link.schluessel); kbZeichnen();
      document.querySelector('[data-kb="' + link.schluessel + '"] [data-kb-loeschen]').click();
      return { roh: roh.filter(e => /^e-|speisekarte/.test(e.schluessel)), boeseGespeichert, rundlauf, gruppeMittag, festLoeschbar,
               nachLoeschen: KACHELSTAND.some(k => k.schluessel === link.schluessel) };
    });
    const eKarte = kb.roh.find(e => e.art === "karte"), eLink = kb.roh.find(e => e.art === "link"), eSpeise = kb.roh.find(e => e.schluessel === "speisekarte");
    pruef(eKarte && eKarte.karte === "k-mittag" && eKarte.titel, "Board: neue Karten-Kachel schreibt Art, Karte und Titel", JSON.stringify(eKarte));
    pruef(kb.gruppeMittag === "Die Karte", "Board: sie steht in der Gruppe „Die Karte“", kb.gruppeMittag);
    pruef(eSpeise && Array.isArray(eSpeise.plan) && eSpeise.plan.length === 1 && eSpeise.plan[0].karte === "k-mittag",
      "Board: Zeitplan an der festen Kachel geht in hub_kacheln", JSON.stringify(eSpeise && eSpeise.plan));
    pruef(kb.boeseGespeichert === "" && eLink && eLink.link === "https://example.org/shop",
      "Board: Link nur als saubere https-Adresse", JSON.stringify([kb.boeseGespeichert, eLink && eLink.link]));
    pruef(/e-[a-z0-9]+:k-mittag:0:/.test(kb.rundlauf) && /speisekarte:speisekarte:1:/.test(kb.rundlauf),
      "Board: Rundlauf kbRoh → kbAusZeile behält eigene Kacheln und Zeitplan", kb.rundlauf.slice(0, 160));
    pruef(!kb.festLoeschbar && !kb.nachLoeschen, "Board: eigene Kachel lässt sich löschen, feste nicht (nur ausblenden)",
      JSON.stringify({ fest: kb.festLoeschbar, nochDa: kb.nachLoeschen }));
    pruef(fehler.length === 0, "Board: keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if (f) { console.log(f + " FEHL"); process.exit(1); }
  console.log("Alles sauber.");
})();
