/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Kategorien bearbeiten, bewegtes Zeichen je Kategorie
   (braucht dist/)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-kategorien.js

   Wunsch: Namen und Anzahl der Kategorien in Speise- und Getränkekarte
   selbst bestimmen, dazu je Kategorie ein bewegtes Zeichen wählen —
   mit einer Sodaflasche, die aufspritzt.

   1  Zweite Quelle (§8.1b): Die Wahl im Board (KAT_ZEICHEN) ist
      dieselbe Menge wie das, was der Hub annimmt (BZ_WAHL), jede
      Wahl liegt als Datei in auslieferung/emoji/, und die Regeln der
      Automatik (BZ_KATEGORIE, BZ_KARTE) sind im Board Zeichen für
      Zeichen dieselben wie im Hub — sonst zeigt das Board etwas
      anderes als der Gast sieht. Die Datenbank-Schranke lässt jeden
      Wert der Liste zu.
   2  Board von Hand: Kopf ist ein Knopf (≥ 44 px), Blatt öffnet,
      Zeichen wählen + umbenennen schreibt ALLE Gerichte der Kategorie,
      Zusammenlegen hängt hinten an, Verschieben löst auf, Löschen
      löscht nur diese Kategorie, Neue Kategorie → erstes Gericht trägt
      das gewählte Zeichen, ein umgezogenes Gericht nimmt das Zeichen
      der NEUEN Kategorie mit (nicht das alte).
   3  Hub mit nachgestellten Zeilen: gewähltes Zeichen schlägt die
      Automatik, unbekannter Wert fällt still auf die Automatik zurück,
      „Softdrinks“ zeigt ohne Wahl die Sodaflasche, eine Änderung NUR
      am Zeichen ändert den Fingerabdruck (sonst kein Neuzeichnen).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OBEN = path.resolve(__dirname, "..");
const EMO = path.join(OBEN, "auslieferung", "emoji");
const ADMIN = "file://" + path.join(OBEN, "seiten", "admin.html");
const HUB = slug => "file://" + path.join(OBEN, "dist", slug, "index.html");

let n = 0, f = 0;
const pruef = (gut, text, mehr) => { n++; if(!gut) f++;
  console.log((gut ? "  ok   " : "  FEHL ") + text + (mehr !== undefined ? "  → " + mehr : "")); };

(async () => {
  const admin = fs.readFileSync(path.join(OBEN, "seiten", "admin.html"), "utf8");
  const hub = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");

  console.log("\n══ Zweite Quelle ══");
  const wahlBoard = [...(admin.match(/const KAT_ZEICHEN = \[([\s\S]*?)\n\];/) || ["", ""])[1].matchAll(/\["([0-9a-z]+)","[^"]+"\]/g)].map(m => m[1]);
  const wahlHub = JSON.parse(((hub.match(/const BZ_WAHL = (\[[\s\S]*?\]);/) || [])[1] || "[]").replace(/\s+/g, ""));
  pruef(wahlBoard.length >= 60, "Board bietet eine große Auswahl", wahlBoard.length + " Zeichen");
  const nurBoard = wahlBoard.filter(c => !wahlHub.includes(c)), nurHub = wahlHub.filter(c => !wahlBoard.includes(c));
  pruef(!nurBoard.length && !nurHub.length && new Set(wahlBoard).size === wahlBoard.length,
    "Board-Wahl = was der Hub annimmt (und keine doppelt)", (nurBoard.join(",") || "–") + " / " + (nurHub.join(",") || "–"));
  const ohneDatei = wahlBoard.filter(c => !fs.existsSync(path.join(EMO, c + ".json")));
  pruef(!ohneDatei.length, "jede Wahl liegt als bewegter Film in auslieferung/emoji/", ohneDatei.join(",") || "alle da");
  pruef(wahlBoard.includes("soda") && fs.existsSync(path.join(OBEN, "erzeuger", "erzeuge-soda-zeichen.py")) &&
        /soda\.json/.test(fs.readFileSync(path.join(EMO, "LIZENZEN.txt"), "utf8")),
    "die Sodaflasche ist wählbar, hat ihren Erzeuger und steht in LIZENZEN.txt");
  const regelnBoard = (admin.match(/const BZ_KATEGORIE = \[[\s\S]*?\n\];/) || [""])[0];
  const regelnHub = (hub.match(/const BZ_KATEGORIE = \[[\s\S]*?\n\];/) || [""])[0];
  pruef(regelnBoard.length > 200 && regelnBoard === regelnHub, "Automatik-Regeln im Board = im Hub (Zeichen für Zeichen)");
  pruef((admin.match(/const BZ_KARTE = \{[^}]*\};/) || ["a"])[0] === (hub.match(/const BZ_KARTE = \{[^}]*\};/) || ["b"])[0],
    "Rückfall je Karte im Board = im Hub");
  const eigenB = (admin.match(/const KAT_ZEICHEN_EIGEN = (\{[^}]*\})/) || [])[1], eigenH = (hub.match(/const BZ_EIGEN = (\{[^}]*\})/) || [])[1];
  pruef(eigenB && eigenB === eigenH, "Geräte-Ersatz für eigene Zeichen gleich", eigenB + " / " + eigenH);
  const mig = fs.readFileSync(path.join(OBEN, "datenbank", "migration-kategorie-emoji.sql"), "utf8");
  const schranke = new RegExp((mig.match(/kat_emoji ~ '([^']+)'/) || [])[1] || "^$");
  const abgelehnt = wahlBoard.filter(c => !schranke.test(c));
  pruef(!abgelehnt.length, "die Datenbank-Schranke lässt jede Wahl zu", abgelehnt.join(",") || schranke.source);
  pruef(!schranke.test("../x") && !schranke.test("<b>") && !schranke.test("Soda"), "und weist Pfad, HTML und Großschrift ab");

  const br = await chromium.launch();

  console.log("\n══ Board von Hand ══");
  const ctx = await br.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  p.on("dialog", d => d.accept());
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto(ADMIN);
  await p.waitForTimeout(700);
  /* Die Vorführkarte hat nur „Küche“ — die Probe bringt eine eigene
     Karte mit mehreren Kategorien mit, sonst gäbe es nichts zu
     verschieben oder zusammenzulegen (§8.1g C). */
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten();
    let i = 0;
    const z = (kategorie, name, kat_sort, karte = "speisekarte", rf) => ({ id:"p" + (++i), betrieb_id:betriebId, karte, kategorie, name,
      beschreibung:"", preis:5 + i, verfuegbar:true, kat_sort, reihenfolge:rf ?? i, kat_emoji:null });
    /* Salate mit KLEINEREN Reihenfolge-Werten als Burger: Sonst stünden
       sie beim Zusammenlegen auch ohne Anhängen schon „hinten“, und die
       Probe könnte den Fehler nicht zeigen (Gegenbeweis S5 blieb grün). */
    gerichte = [z("Burger","Classic",1,"speisekarte",5), z("Burger","Cheese",1,"speisekarte",6), z("Burger","Veggie",1,"speisekarte",7),
                z("Salate","Caesar",2,"speisekarte",0), z("Salate","Greek",2,"speisekarte",1),
                z("Desserts","Brownie",3), z("Desserts","Tiramisu",3),
                z("Softdrinks","Cola",1,"getraenke"), z("Softdrinks","Zitrone",1,"getraenke")];
    zeichneAlles();
    const s = document.getElementById("scharf"); if(s) s.hidden = true; tafelZeigen("speisekarte"); });
  await p.waitForTimeout(500);

  const vorher = await p.evaluate(() => {
    const kats = katNamen(welcheKarte);
    const kopf = document.querySelector("[data-kted]");
    const r = kopf && kopf.getBoundingClientRect();
    return { kats, n:gerichte.length, erste:kats[0], zweite:kats[1], dritte:kats[2],
      nErste:gerichte.filter(g => (g.karte || "speisekarte") === welcheKarte && g.kategorie === kats[0]).length,
      hoch: r ? Math.round(r.height) : 0, neu: !!document.querySelector("[data-kted-neu]") };
  });
  pruef(vorher.kats.length >= 3, "Voraussetzung: die Vorführkarte hat mindestens drei Kategorien", vorher.kats.join(", "));
  if(vorher.kats.length < 3){ await br.close(); console.log("\n" + f + " Fehler."); process.exit(1); }
  pruef(vorher.hoch >= 44, "Kategorie-Kopf ist ein Knopf mit ≥ 44 px", vorher.hoch + " px");
  pruef(vorher.neu, "„Neue Kategorie“ steht unter der Liste");

  /* Zeichen wählen + umbenennen */
  await p.click('[data-kted="' + vorher.erste + '"]');
  await p.waitForTimeout(350);
  const blatt = await p.evaluate(() => ({ offen: !document.getElementById("ktedBlatt").hidden,
    name: document.getElementById("ktedName").value,
    auto: (document.querySelector('#ktedWahl [data-zeichen="auto"]') || {}).getAttribute?.call(document.querySelector('#ktedWahl [data-zeichen="auto"]'), "aria-checked"),
    zahl: document.querySelectorAll("#ktedWahl [data-zeichen]").length,
    klein: [...document.querySelectorAll("#ktedWahl [data-zeichen]")].filter(b => b.getBoundingClientRect().height < 44).length }));
  pruef(blatt.offen && blatt.name === vorher.erste, "Antippen öffnet das Blatt mit dem Namen", blatt.name);
  pruef(blatt.auto === "true" && blatt.zahl >= 61, "Auswahl steht, „Automatisch“ ist vorgewählt", blatt.zahl + " Knöpfe");
  pruef(!blatt.klein, "jede Wahl ist mindestens 44 px hoch", blatt.klein + " zu klein");
  await p.click('#ktedWahl [data-zeichen="soda"]');
  await p.fill("#ktedName", "Limo & Soda");
  await p.click("#ktedSichern");
  await p.waitForTimeout(500);
  const umb = await p.evaluate(([alt]) => {
    const neu = gerichte.filter(g => (g.karte || "speisekarte") === welcheKarte && g.kategorie === "Limo & Soda");
    const kopf = document.querySelector('[data-kted="Limo & Soda"] .kted-emo');
    return { n:neu.length, zeichen:[...new Set(neu.map(g => g.kat_emoji))].join(","),
      altDa: gerichte.some(g => g.kategorie === alt), glyph: kopf ? kopf.textContent : "" };
  }, [vorher.erste]);
  pruef(umb.n === vorher.nErste && !umb.altDa, "Umbenennen schreibt ALLE Gerichte der Kategorie um",
    umb.n + " von " + vorher.nErste);
  pruef(umb.zeichen === "soda", "alle tragen das gewählte Zeichen", umb.zeichen);
  pruef(umb.glyph.startsWith("🍾"), "der Kopf zeigt das neue Zeichen", umb.glyph);

  /* Zusammenlegen: zweite Kategorie umbenennen in eine vorhandene */
  const zus = await p.evaluate(async ([zweite]) => {
    const ziel = "Limo & Soda";
    const maxZiel = Math.max(...gerichte.filter(g => g.kategorie === ziel).map(g => g.reihenfolge ?? 0));
    const nZweite = gerichte.filter(g => (g.karte || "speisekarte") === welcheKarte && g.kategorie === zweite).length;
    const sortZiel = katSortVon(ziel, welcheKarte);
    ktedOeffnen(zweite);
    document.getElementById("ktedName").value = ziel;
    await ktedSichern();
    const drin = gerichte.filter(g => g.kategorie === ziel);
    const neuDrin = drin.slice(-nZweite);
    return { nachher: drin.length, nZweite, weg: !gerichte.some(g => g.kategorie === zweite),
      hinten: neuDrin.every(g => (g.reihenfolge ?? 0) > maxZiel),
      sort: [...new Set(drin.map(g => g.kat_sort))].join(","), sortZiel,
      zeichen: [...new Set(drin.map(g => g.kat_emoji))].join(",") };
  }, [vorher.zweite]);
  pruef(zus.weg && zus.nachher === umb.n + zus.nZweite, "Zusammenlegen: alle Gerichte in einer Kategorie", zus.nachher + " Gerichte");
  pruef(zus.hinten, "die hinzugekommenen hängen HINTER den vorhandenen");
  pruef(zus.sort === String(zus.sortZiel) && zus.zeichen === "soda", "Platz und Zeichen des Ziels gelten für alle", zus.sort + " · " + zus.zeichen);

  /* Verschieben und auflösen: dritte Kategorie nach „Limo & Soda“ */
  const versch = await p.evaluate(async ([dritte]) => {
    const n3 = gerichte.filter(g => g.kategorie === dritte).length, gesamt = gerichte.length;
    ktedOeffnen(dritte);
    document.getElementById("ktedWeg").open = true;
    const sel = document.getElementById("ktedZiel");
    const optionen = sel ? [...sel.options].map(o => o.value) : [];
    if(sel) sel.value = "Limo & Soda";
    await ktedVerschieben();
    return { n3, optionen, weg: !gerichte.some(g => g.kategorie === dritte), gesamt, jetzt: gerichte.length };
  }, [vorher.dritte]);
  pruef(!versch.optionen.includes(vorher.dritte) && versch.optionen.includes("Limo & Soda"), "Ziel-Liste ohne die eigene Kategorie", versch.optionen.join(" | "));
  pruef(versch.weg && versch.jetzt === versch.gesamt, "Verschieben löst auf und verliert kein Gericht", versch.gesamt + " → " + versch.jetzt);

  /* Neue Kategorie → erstes Gericht */
  await p.click("[data-kted-neu]");
  await p.waitForTimeout(300);
  await p.fill("#ktedName", "Tacos");
  await p.click('#ktedWahl [data-zeichen="1f32e"]');
  await p.click("#ktedSichern");
  await p.waitForTimeout(400);
  const neuBlatt = await p.evaluate(() => ({ gericht: !document.getElementById("blatt").hidden, kat: document.getElementById("fKat").value }));
  pruef(neuBlatt.gericht && neuBlatt.kat === "Tacos", "Neue Kategorie öffnet das erste Gericht, Kategorie vorbelegt", JSON.stringify(neuBlatt));
  await p.fill("#fName", "Taco al Pastor");
  await p.fill("#fPreis", "7.5");
  await p.evaluate(() => sichern(false));
  await p.waitForTimeout(400);
  const taco = await p.evaluate(() => { const g = gerichte.find(x => x.name === "Taco al Pastor");
    const kopf = document.querySelector('[data-kted="Tacos"] .kted-emo');
    return { zeichen: g && g.kat_emoji, glyph: kopf ? kopf.textContent : "", wunsch: katNeuWunsch }; });
  pruef(taco.zeichen === "1f32e" && taco.glyph.startsWith("🌮"), "das erste Gericht trägt das gewählte Zeichen", JSON.stringify(taco));
  pruef(taco.wunsch === null, "der Wunsch ist danach verbraucht (kein Zeichen für spätere Fremde)");

  /* Umziehen: ein Gericht aus „Limo & Soda“ nach „Tacos“ — nimmt 🌮, nicht 🥤 */
  const um = await p.evaluate(async () => {
    const g = gerichte.find(x => x.kategorie === "Limo & Soda");
    blattOeffnen(g); document.getElementById("fKat").value = "Tacos";
    await sichern(false);
    return { zeichen: g.kat_emoji, kat: g.kategorie };
  });
  pruef(um.kat === "Tacos" && um.zeichen === "1f32e", "ein umgezogenes Gericht nimmt das Zeichen der NEUEN Kategorie", JSON.stringify(um));
  /* Und in eine Kategorie OHNE Zeichen: Dort muss es null werden, nicht
     sein altes 🌮 behalten — sonst nähme der Hub für „Softdrinks“ den
     Taco (erstes Gericht mit Wert gewinnt). */
  const um2 = await p.evaluate(async () => {
    const g = gerichte.find(x => x.kategorie === "Tacos");
    blattOeffnen(g); document.getElementById("fKat").value = "Softdrinks";
    document.getElementById("fKarte").value = "getraenke";
    await sichern(false);
    return { zeichen: g.kat_emoji, kat: g.kategorie, karte: g.karte, wirksam: katZeichenWirksam("Softdrinks", "getraenke") };
  });
  pruef(um2.kat === "Softdrinks" && um2.zeichen === null && um2.wirksam === "soda",
    "in eine Kategorie ohne Zeichen: das alte Zeichen reist NICHT mit", JSON.stringify(um2));

  /* Löschen */
  const los = await p.evaluate(async () => {
    const vor = gerichte.length, nT = gerichte.filter(g => g.kategorie === "Tacos").length;
    ktedOeffnen("Tacos"); await ktedLoeschen();
    return { vor, nT, nach: gerichte.length, weg: !gerichte.some(g => g.kategorie === "Tacos") };
  });
  pruef(los.weg && los.nach === los.vor - los.nT, "Löschen entfernt genau diese Kategorie", los.vor + " − " + los.nT + " = " + los.nach);

  /* Automatik folgt dem getippten Namen */
  const auto = await p.evaluate(() => { ktedOeffnen(null);
    const i = document.getElementById("ktedName"); i.value = "Softdrinks"; i.dispatchEvent(new Event("input"));
    const g = document.querySelector('#ktedWahl [data-zeichen="auto"] .kted-glyph').textContent; ktedZu(); return g; });
  pruef(auto.startsWith("🍾"), "„Softdrinks“ zeigt in der Automatik die Sodaflasche", auto);

  /* 360 px: kein Überlauf im Blatt */
  await p.setViewportSize({ width:360, height:740 });
  await p.evaluate(() => ktedOeffnen(katNamen(welcheKarte)[0]));
  await p.waitForTimeout(350);
  const breit = await p.evaluate(() => { const b = document.querySelector("#ktedBlatt .blattinhalt");
    return { seite: document.documentElement.scrollWidth - document.documentElement.clientWidth, blatt: b.scrollWidth - b.clientWidth }; });
  pruef(breit.seite <= 0 && breit.blatt <= 0, "bei 360 px kein seitlicher Überlauf", JSON.stringify(breit));
  pruef(!fehler.length, "keine Laufzeitfehler im Board", fehler[0] || "still");
  await ctx.close();

  console.log("\n══ Hub mit nachgestellten Zeilen ══");
  const zeilen = zeichen => [
    { id:"a1", karte:"getraenke", kategorie:"Softdrinks", name:"Cola", beschreibung:"", preis:3, verfuegbar:true, kat_sort:1, reihenfolge:0, kat_emoji:null },
    { id:"a2", karte:"getraenke", kategorie:"Wasser", name:"Still", beschreibung:"", preis:2, verfuegbar:true, kat_sort:2, reihenfolge:0, kat_emoji:zeichen },
    { id:"a3", karte:"getraenke", kategorie:"Tee", name:"Minze", beschreibung:"", preis:3, verfuegbar:true, kat_sort:3, reihenfolge:0, kat_emoji:"quatsch" },
    { id:"a4", karte:"speisekarte", kategorie:"Crêpe", name:"Zucker", beschreibung:"", preis:5, verfuegbar:true, kat_sort:1, reihenfolge:0, kat_emoji:null },
  ];
  const hubCtx = await br.newContext({ viewport:{ width:390, height:844 } });
  const s = await hubCtx.newPage();
  const hFehler = [];
  s.on("pageerror", e => hFehler.push(String(e).slice(0, 160)));
  let aktuell = zeilen("1fad7");
  await s.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    /* Ohne Betriebszeile bricht karteHolen vor den Gerichten ab
       („Betrieb nicht gefunden“) — der erste Lauf war genau daran rot. */
    if(/\/rest\/v1\/betriebe/.test(u)) return r.fulfill({ status:200, contentType:"application/json",
      body:JSON.stringify([{ id:"af095b14-d9ef-41f4-9b97-c4422b0de63f", bestell_pause:false }]) });
    if(/\/rest\/v1\/gerichte/.test(u)) return r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(aktuell) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await s.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); localStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
  await s.goto(HUB("chocolamour") + "#/getraenke");
  await s.waitForTimeout(2500);
  const h = await s.evaluate(() => ({
    geladen: GETRAENKE.some(g => g.gruppe === "Wasser"),
    wasser: bzKategorie("Wasser", "getraenke"), soft: bzKategorie("Softdrinks", "getraenke"),
    tee: bzKategorie("Tee", "getraenke"), crepe: bzKategorie("Crêpe", "speisekarte"),
    chip: (document.querySelector('.chip[data-g="Wasser"] [data-bz]') || {}).dataset?.bz || "" }));
  pruef(h.geladen, "Voraussetzung: der Hub hat die nachgestellten Zeilen übernommen");
  pruef(h.wasser === "1fad7", "gewähltes Zeichen schlägt die Automatik", h.wasser);
  pruef(h.chip === "1fad7", "und steht im Kategorie-Chip der Getränkekarte", h.chip || "(kein Chip)");
  pruef(h.soft === "soda", "„Softdrinks“ ohne Wahl → Sodaflasche", h.soft);
  pruef(h.tee === "1f375", "unbekannter Wert fällt still auf die Automatik zurück", h.tee);
  pruef(h.crepe === "crepe", "andere Kategorien unberührt", h.crepe);
  /* Nur das Zeichen ändert sich → Fingerabdruck muss sich ändern */
  const a = await s.evaluate(() => karteFingerabdruck);
  aktuell = zeilen("1f9c3");
  await s.evaluate(() => karteHolen());
  await s.waitForTimeout(1200);
  const b = await s.evaluate(() => ({ fp: karteFingerabdruck, wasser: bzKategorie("Wasser", "getraenke") }));
  pruef(a !== b.fp && b.wasser === "1f9c3", "eine Änderung NUR am Zeichen kommt beim Gast an", b.wasser);
  pruef(!hFehler.length, "keine Laufzeitfehler im Hub", hFehler[0] || "still");
  await hubCtx.close();

  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Fehler." : n + " von " + n + " ok\nAlles sauber."));
  process.exit(f ? 1 : 0);
})();
