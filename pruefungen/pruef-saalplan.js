/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Der Saalplan (3D-Karte aller Tische im Board)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-saalplan.js

   Wunsch 19.10.: „eine eigene 3D-Karte aller Tische … weiße Polygone mit
   Leuchtstufen, die je nach Bedarf am Tisch eine andere Signalfarbe
   zeigen. Jeden Tisch anklicken. Eine kleine Ansicht mit allen Tischen,
   dann hereinholen — gute Auflösung.“

   Was schiefgehen kann, und je eine Probe dazu:

   1 · EIN TISCH LEUCHTET FALSCH. Farbe und Stufe werden aus den
       Bestellungen gerechnet; hier mit gestellten Bestellungen UND gestellter
       Uhr (§8.1j) am GEMALTEN Bild gemessen, nicht an der Rechenfunktion.
   2 · ETWAS WIRD UNSICHTBAR (§7). Lieferung, Telefon und ein Tisch, der nicht
       eingezeichnet ist, stehen unter „Außerhalb des Plans“; ohne Auswahl
       zeigt die Liste darunter ALLES.
   3 · DIE VERGRÖSSERUNG VERLIERT SCHÄRFE. Es ist Vektor: Schrift und
       Tapflächen behalten ihre Bildschirmgröße bei jedem Zoom (≥ 44 px).
   4 · DAS EINRICHTEN SCHREIBT ZU VIEL. Nur Inhaber; Nutzlast genau die vier
       Lagespalten; ein Server, der 0 Zeilen ändert (RLS), wird als Satz
       gemeldet, nicht als Erfolg (§2.3b).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const ADMIN = "file://" + path.join(__dirname, "..", "seiten", "admin.html");

let fehler = 0;
const pruef = (g, t, z) => { console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined && z !== "" ? "  → " + z : "")); if(!g) fehler++; };

async function neu(br, breite, hoehe, extra){
  const ctx = await br.newContext({ viewport: { width: breite, height: hoehe }, colorScheme: "dark", ...(extra || {}) });
  const p = await ctx.newPage();
  const pf = [];
  p.on("pageerror", e => pf.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
  await p.goto(ADMIN);
  await p.waitForTimeout(700);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; tafelZeigen("reservierungen"); });
  await p.waitForTimeout(400);
  return { ctx, p, pf };
}
/* Gestellte Lage: feste Uhr, feste Bestellungen (§8.1j). */
async function stelle(p){
  await p.evaluate(() => {
    const vor = m => new Date(Date.now() - m * 60000).toISOString();
    bestellungen.length = 0;
    bestellungen.push(
      { id: "x1", quelle: "service", status: "neu", tisch: "4", zeitpunkt: vor(1), notiz: "Rechnung bitte", positionen: [], summe: 0 },
      { id: "x2", quelle: "tisch", status: "neu", tisch: "10", zeitpunkt: vor(8), positionen: [{ name: "A", menge: 1, preis: 5 }], summe: 5 },
      { id: "x3", quelle: "tisch", status: "neu", tisch: "7", zeitpunkt: vor(1), positionen: [{ name: "B", menge: 1, preis: 5 }], summe: 5 },
      { id: "x4", quelle: "tisch", status: "arbeit", tisch: "2", zeitpunkt: vor(12), positionen: [{ name: "C", menge: 1, preis: 5 }], summe: 5 },
      { id: "x5", quelle: "tisch", status: "arbeit", tisch: "3", zeitpunkt: vor(15), kueche_fertig_um: vor(1), positionen: [{ name: "D", menge: 1, preis: 5 }], summe: 5 },
      { id: "x6", quelle: "tisch", status: "neu", tisch: "6", pruefen: true, pruef_grund: "Zahlung offen", zeitpunkt: vor(12), positionen: [{ name: "E", menge: 1, preis: 5 }], summe: 5 },
      { id: "x7", quelle: "lieferung", status: "neu", zeitpunkt: vor(2), liefer_adresse: { name: "Frau Test" }, positionen: [{ name: "F", menge: 1, preis: 5 }], summe: 5 },
      { id: "x8", quelle: "tisch", status: "neu", tisch: "67", zeitpunkt: vor(2), positionen: [{ name: "G", menge: 1, preis: 5 }], summe: 5 },
      { id: "x9", quelle: "tisch", status: "fertig", tisch: "8", zeitpunkt: vor(30), kueche_fertig_um: vor(25), gebracht_um: vor(20), positionen: [{ name: "H", menge: 1, preis: 5 }], summe: 5 }
    );
    bekannt.clear(); bestellungen.forEach(b => bekannt.add(b.id));
    zeigeStatus.fertig = false;
    SAAL.sig = ""; zeichneAlles();
  });
  await p.waitForTimeout(250);
}
const abzeichen = (p, nr) => p.evaluate(n => {
  const g = document.querySelector('#spSvg [data-sp-tisch="demo-t' + n + '"]');
  const c = g && g.querySelector(".sp-abz circle");
  const glow = g && g.querySelector(".sp-glow");
  return g ? { fill: c ? c.getAttribute("fill") : null, stufe: glow ? (glow.getAttribute("class").match(/s(\d)/) || [])[1] : null, st: g.dataset.st } : null;
}, nr);
const mitte = (p, sel) => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);

(async () => {
  const br = await chromium.launch();

  /* ── 1 · Stand, Farbe, Stufe ───────────────────────────────────── */
  console.log("\n══ Stand je Tisch am gemalten Bild ══");
  {
    const { ctx, p, pf } = await neu(br, 390, 844);
    await stelle(p);
    pruef(await p.evaluate(() => !document.getElementById("saal").hidden), "Voraussetzung: der Saal ist sichtbar (Plan vorhanden)");
    const n = await p.evaluate(() => document.querySelectorAll("#spSvg [data-sp-tisch]").length);
    pruef(n === 8, "im Haupt-Raum stehen 8 Tische (die Terrasse hat drei, Tisch 12 ist nirgends eingezeichnet)", String(n));
    const FARBE = { servieren: "#22D17A", ruf: "#FF3D81", neu: "#FFB300", pruefen: "#A78BFA", arbeit: "#38BDF8" };
    const erwartet = { 4: ["ruf", 1], 7: ["neu", 1], 2: ["arbeit", 1], 3: ["servieren", 1], 6: ["pruefen", 3] };
    for(const [nr, [art, stufe]] of Object.entries(erwartet)){
      const a = await abzeichen(p, nr);
      pruef(a && a.fill === FARBE[art], "Tisch " + nr + " leuchtet " + art, a ? a.fill : "kein Tisch");
      pruef(a && String(a.stufe) === String(stufe), "Tisch " + nr + ": Leuchtstufe " + stufe, a ? a.stufe : "");
    }
    /* Die Terrasse ist ein eigener Bereich: erst dort steht Tisch 10. */
    await p.click('[data-sp-zone="Terrasse"]');
    await p.waitForTimeout(150);
    const t10 = await abzeichen(p, 10);
    pruef(t10 && t10.fill === FARBE.neu && String(t10.stufe) === "3", "Terrasse: Tisch 10 leuchtet neu in Stufe 3 (8 Min)", t10 ? t10.fill + " / " + t10.stufe : "");
    await p.click('[data-sp-zone="Haupt-Raum"]');
    await p.waitForTimeout(150);
    const frei = await abzeichen(p, 1);
    pruef(frei && frei.fill === null && frei.stufe === null, "Tisch 1 ohne Bedarf: kein Abzeichen, kein Leuchten");
    const sitzt = await abzeichen(p, 8);
    pruef(sitzt && /sitzt/.test(sitzt.st || "") && sitzt.stufe === null, "Tisch 8 (alles gebracht, vor 30 Min): „Gäste da“, ohne Leuchten", sitzt ? sitzt.st : "");
    /* Stufe wächst mit der Wartezeit — dieselbe Bestellung, ältere Zeit. */
    await p.evaluate(() => { bestellungen.find(b => b.id === "x3").zeitpunkt = new Date(Date.now() - 7 * 60000).toISOString(); SAAL.sig = ""; saalZeichnen(); });
    pruef(String((await abzeichen(p, 7)).stufe) === "3", "Tisch 7 nach 7 Min Wartezeit: Stufe 3 (vorher 1)");
    await p.evaluate(() => { bestellungen.find(b => b.id === "x3").zeitpunkt = new Date(Date.now() - 4 * 60000).toISOString(); SAAL.sig = ""; saalZeichnen(); });
    pruef(String((await abzeichen(p, 7)).stufe) === "2", "nach 4 Min: Stufe 2");
    /* Wichtigstes zuerst: ein Ruf-Tisch mit ZWEI Zuständen nimmt den dringenderen. */
    await p.evaluate(() => { bestellungen.push({ id: "x10", quelle: "service", status: "neu", tisch: "2", zeitpunkt: new Date(Date.now() - 1 * 60000).toISOString(), notiz: "Hilfe", positionen: [], summe: 0 }); SAAL.sig = ""; saalZeichnen(); });
    const zwei = await abzeichen(p, 2);
    pruef(zwei && zwei.fill === FARBE.ruf && /ruf/.test(zwei.st) && /arbeit/.test(zwei.st), "Tisch 2 mit Ruf UND in Arbeit: Ruf leuchtet, beide stehen im Zustand", zwei ? zwei.fill + " | " + zwei.st : "");
    /* Bedeutung nicht nur als Farbe: Zeichen + Wort. */
    const lab = await p.evaluate(() => document.querySelector('#spSvg [data-sp-tisch="demo-t4"]').getAttribute("aria-label"));
    pruef(/Ruf/.test(lab) && /seit|gerade/.test(lab), "jeder Tisch trägt seinen Zustand als Wort (aria-label)", lab);
    pruef(pf.length === 0, "kein Seitenfehler", pf.join(" | "));
    await ctx.close();
  }

  /* ── 2 · Nichts wird unsichtbar ────────────────────────────────── */
  console.log("\n══ Nichts wird unsichtbar ══");
  {
    const { ctx, p } = await neu(br, 390, 844);
    await stelle(p);
    const alleKarten = () => p.evaluate(() => document.querySelectorAll("#karten .bestellung").length);
    const ort = () => p.evaluate(() => document.getElementById("karten").parentElement.id);
    const ohneAuswahl = await alleKarten();
    pruef(ohneAuswahl >= 7, "ohne Auswahl zeigt die Liste ALLES (offene Bestellungen)", String(ohneAuswahl));
    pruef(await ort() === "t-bestellungen", "und wohnt unter „Bestellungen“, nicht auf der Tische-Seite", await ort());
    const rest = await p.evaluate(() => ({ da: !document.getElementById("spRest").hidden, text: document.getElementById("spRest").textContent }));
    pruef(rest.da && /Lieferung 1/.test(rest.text) && /Tisch 67 1/.test(rest.text), "„Außerhalb des Plans“ nennt Lieferung und den nicht eingezeichneten Tisch 67", rest.text);
    await p.click("[data-sp-rest]");
    await p.waitForTimeout(200);
    const nurRest = await p.evaluate(() => [...document.querySelectorAll("#karten .bestellung")].map(k => k.dataset.quelle).sort().join(","));
    pruef(nurRest === "lieferung,tisch", "Tipp darauf zeigt genau die beiden", nurRest);
    pruef(await ort() === "spKartenOrt" && await p.evaluate(() => !document.getElementById("spDetail").hidden && /Außerhalb/.test(document.getElementById("spDetailTitel").textContent)),
      "die Karten ziehen in das Blatt unter dem Plan um (dieselben Griffe, kein zweiter Satz)", await ort());
    await p.click("[data-sp-rest]");
    await p.waitForTimeout(200);
    pruef(await alleKarten() === ohneAuswahl && await ort() === "t-bestellungen", "nochmal tippen: wieder alles, die Karten wohnen wieder unter „Bestellungen“");
    /* Wer mit gewähltem Tisch die Seite wechselt, findet unter „Bestellungen“ wieder ALLES. */
    await p.click('[data-sp-listetisch]');
    await p.waitForTimeout(200);
    pruef(await p.evaluate(() => SAAL.auswahl != null && SAAL.kartenDa), "Voraussetzung: ein Tisch aus der Liste links ist gewählt, die Karten sind umgezogen");
    await p.evaluate(() => tafelZeigen("bestellungen"));
    await p.waitForTimeout(150);
    pruef(await ort() === "t-bestellungen" && await alleKarten() === ohneAuswahl, "Seitenwechsel: Karten zurück unter „Bestellungen“ und ungefiltert", ohneAuswahl + " → " + await alleKarten());
    pruef(await p.evaluate(() => getComputedStyle(document.querySelector("#t-bestellungen .filterblock")).display !== "none"), "die Filter der Bestellungen stehen unberührt da");
    await ctx.close();
  }

  /* ── 2b · Seite „Tische“: Liste links, Bereiche ───────────────── */
  console.log("\n══ Seite „Tische“: Liste links, Bereiche ══");
  {
    const { ctx, p, pf } = await neu(br, 1440, 900);
    await stelle(p);
    pruef(await p.evaluate(() => document.querySelector('nav[role=tablist] [data-tafel="reservierungen"]').textContent.trim().startsWith("Tische")), "der Reiter heißt „Tische“");
    const lage = await p.evaluate(() => { const l = document.querySelector(".tisch-links").getBoundingClientRect(), h = document.querySelector(".tisch-haupt").getBoundingClientRect(); return { lb: l.width, hl: h.left, lr: l.right, ho: h.top, lo: l.top }; });
    pruef(lage.lr <= lage.hl && lage.lb >= 300 && lage.lb <= 400, "bei 1440 px: links die Liste (300–400 px), rechts der Plan, nebeneinander", Math.round(lage.lb) + " px, Plan ab " + Math.round(lage.hl));
    const zeilen = await p.evaluate(() => [...document.querySelectorAll("#spListe .sp-tz")].map(z => z.querySelector("b").textContent + "|" + z.querySelector(".sp-meter").dataset.s));
    pruef(zeilen.length === 6 && zeilen[0] === "Tisch 10|3", "links stehen die 6 Tische mit Bedarf, der dringendste (Tisch 10, Stufe 3) zuerst", zeilen.join(", "));
    const stuf = zeilen.map(z => +z.split("|")[1]);
    pruef(stuf.every((v, i) => i === 0 || stuf[i - 1] >= v), "nach Stufe geordnet (nie eine schwächere vor einer stärkeren)", stuf.join(""));
    pruef(await p.evaluate(() => [...document.querySelectorAll("#spListe .sp-tz")].every(z => z.getBoundingClientRect().height >= 44)), "jede Zeile ≥ 44 px");
    /* Bereiche */
    const zonen = await p.evaluate(() => [...document.querySelectorAll("#spZonen .sp-zone")].map(z => z.textContent.replace(/\d+$/, "").trim() + ":" + (z.querySelector(".sp-zonenzahl") || {}).textContent + ":" + z.getAttribute("aria-pressed")));
    pruef(zonen.join("|") === "Haupt-Raum:5:true|Terrasse:1:false", "Bereiche als Reiter, mit der Zahl der Tische, die gerade etwas brauchen", zonen.join("|"));
    /* Ein Tipp auf eine Zeile aus dem anderen Bereich wechselt den Bereich UND wählt */
    await p.click('#spListe .sp-tz:first-child');
    await p.waitForTimeout(500);
    const nach = await p.evaluate(() => ({ zone: SAAL.zone, auswahl: SAAL.auswahl, da: !!document.querySelector('#spSvg [data-sp-tisch="demo-t10"].gewaehlt'), karten: [...document.querySelectorAll("#spKartenOrt .bestellung .tischnr")].map(x => x.textContent.trim()) }));
    pruef(nach.zone === "Terrasse" && nach.auswahl === "10" && nach.da, "Tipp auf „Tisch 10“ links schaltet auf die Terrasse und wählt ihn dort", JSON.stringify(nach));
    pruef(nach.karten.length === 1 && /Tisch 10/.test(nach.karten[0]), "im Blatt rechts unter dem Plan stehen nur seine Bestellungen", nach.karten.join("|"));
    const blatt = await p.evaluate(() => { const d = document.getElementById("spDetail").getBoundingClientRect(), b = document.getElementById("spBuehne").getBoundingClientRect(); return d.top >= b.bottom - 1 && d.left >= document.querySelector(".tisch-haupt").getBoundingClientRect().left - 1; });
    pruef(blatt, "das Blatt liegt unter dem Plan (rechte Spalte), nicht unter der Liste");
    /* Bereich wechseln hebt die Auswahl auf */
    await p.click('[data-sp-zone="Haupt-Raum"]');
    await p.waitForTimeout(200);
    pruef(await p.evaluate(() => SAAL.auswahl === null && document.getElementById("spDetail").hidden && document.getElementById("karten").parentElement.id === "t-bestellungen"), "Bereichswechsel hebt die Auswahl auf, die Karten gehen zurück");
    /* Reservierungen bleiben bedienbar (alter Weg, dieselben Griffe) */
    await p.evaluate(() => { reservierungen.push({ id: "rr1", name: "Familie Probe", wunsch: new Date(Date.now() + 3600000).toISOString(), personen: 4, telefon: "0151 1", status: "offen", quelle: "tisch" }); zeichneReservierungen(); });
    await p.click('[data-res-ja="rr1"]');
    await p.waitForTimeout(150);
    pruef(await p.evaluate(() => reservierungen.find(r => r.id === "rr1").status === "bestaetigt"), "„Annehmen“ einer Reservierung geht auf der neuen Seite wie vorher");
    /* Liste umschalten */
    await p.click('[data-sp-liste="res"]');
    pruef(await p.evaluate(() => document.getElementById("spListeBlock").hidden && !document.getElementById("resBlock").hidden), "„Reservierung“ zeigt nur die Reservierungen");
    await p.click('[data-sp-liste="tisch"]');
    pruef(await p.evaluate(() => !document.getElementById("spListeBlock").hidden && document.getElementById("resBlock").hidden), "„Am Tisch“ zeigt nur die Tische");
    await p.click('[data-sp-liste="alle"]');
    /* Telefon: Plan oben, Listen darunter */
    pruef(pf.length === 0, "kein Seitenfehler", pf.join(" | "));
    await ctx.close();
    const t = await neu(br, 390, 844);
    await stelle(t.p);
    const ord = await t.p.evaluate(() => { const h = document.querySelector(".tisch-haupt").getBoundingClientRect(), l = document.querySelector(".tisch-links").getBoundingClientRect(); return { plan: h.top, liste: l.top, ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    pruef(ord.plan < ord.liste, "Telefon: der Plan steht oben, die Listen darunter", Math.round(ord.plan) + " < " + Math.round(ord.liste));
    pruef(ord.ueber <= 0, "Telefon: kein seitlicher Überlauf", ord.ueber + " px");
    await t.ctx.close();
  }

  /* ── 3 · Tippen, Zoomen, Schärfe ───────────────────────────────── */
  console.log("\n══ Tippen und Zoomen ══");
  for(const [breite, hoehe] of [[390, 844], [1280, 800]]){
    const { ctx, p, pf } = await neu(br, breite, hoehe);
    await stelle(p);
    const k0 = await p.evaluate(() => SAAL.kamera.k);
    const m = await mitte(p, '#spSvg [data-sp-tisch="demo-t4"] .sp-treffer');
    pruef(m.w >= 44 && m.h >= 44, breite + " px: Tapfläche eines Tisches ≥ 44 px", Math.round(m.w) + "×" + Math.round(m.h));
    const nr0 = (await mitte(p, '#spSvg [data-sp-tisch="demo-t4"] .sp-nr')).h;
    await p.mouse.click(m.x, m.y);
    await p.waitForTimeout(500);
    const nach = await p.evaluate(() => ({ auswahl: SAAL.auswahl, k: SAAL.kamera.k, pressed: document.querySelector('[data-sp-tisch="demo-t4"]').getAttribute("aria-pressed"),
      karten: [...document.querySelectorAll("#karten .bestellung")].map(k => k.querySelector(".tischnr").textContent.trim()) }));
    pruef(nach.auswahl === "4" && nach.pressed === "true", breite + " px: echter Tipp wählt Tisch 4", nach.auswahl);
    pruef(nach.k > k0 * 2, breite + " px: der Plan holt den Tisch heran", (nach.k / k0).toFixed(1) + "×");
    pruef(nach.karten.length === 1 && /Tisch 4/.test(nach.karten[0]), breite + " px: darunter steht nur Tisch 4", nach.karten.join("|"));
    const nr1 = (await mitte(p, '#spSvg [data-sp-tisch="demo-t4"] .sp-nr')).h;
    pruef(Math.abs(nr1 - nr0) <= 1.5, breite + " px: die Schrift behält ihre Bildschirmgröße beim Hereinzoomen (scharf)", nr0.toFixed(1) + " → " + nr1.toFixed(1));
    const m2 = await mitte(p, '#spSvg [data-sp-tisch="demo-t4"] .sp-treffer');
    pruef(m2.w >= 44, breite + " px: auch hereingezoomt Tapfläche ≥ 44 px", Math.round(m2.w));
    /* Rad */
    /* Auf dem Telefon führt der Tipp die Seite zu den Karten — für die Zoom-Probe wieder hinauf. */
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(700); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(100);
    pruef(breite > 760 || await p.evaluate(() => window.scrollY >= 0), breite + " px: Seite wieder oben");
    const kv = await p.evaluate(() => SAAL.kamera.k);
    const b = await mitte(p, "#spBuehne");
    await p.mouse.move(b.x, b.y); await p.mouse.wheel(0, -400);
    await p.waitForTimeout(100);
    const kw = await p.evaluate(() => SAAL.kamera.k);
    pruef(kw > kv, breite + " px: Mausrad zoomt hinein", (kw / kv).toFixed(2) + "×");
    /* Ziehen verschiebt, wählt aber nichts */
    const tx0 = await p.evaluate(() => SAAL.kamera.tx);
    const sel0 = await p.evaluate(() => SAAL.auswahl);
    await p.mouse.move(b.x - 60, b.y + 60); await p.mouse.down(); await p.mouse.move(b.x - 10, b.y + 60, { steps: 6 }); await p.mouse.up();
    await p.waitForTimeout(80);
    const tx1 = await p.evaluate(() => SAAL.kamera.tx);
    pruef(Math.abs(tx1 - tx0) > 20 && (await p.evaluate(() => SAAL.auswahl)) === sel0, breite + " px: Ziehen verschiebt den Plan, ohne etwas zu wählen", Math.round(tx1 - tx0) + " px");
    /* Zweiter Tipp hebt auf */
    await p.click('[data-sp-wz="alles"]');
    await p.waitForTimeout(500);
    const ganz = await p.evaluate(() => ({ auswahl: SAAL.auswahl, k: SAAL.kamera.k, passt: SAAL.passt }));
    pruef(ganz.auswahl === null && Math.abs(ganz.k - ganz.passt) < 0.01, breite + " px: „Alle Tische“ zeigt wieder die Übersicht", ganz.k.toFixed(3) + " / " + ganz.passt.toFixed(3));
    /* alle Tische im Bild */
    const aus = await p.evaluate(() => { const b = document.getElementById("spBuehne").getBoundingClientRect();
      return [...document.querySelectorAll("#spSvg [data-sp-tisch] .sp-koerper")].filter(g => { const r = g.getBoundingClientRect(); return r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1; }).length; });
    pruef(aus === 0, breite + " px: in der Übersicht liegt jeder Tisch ganz im Bild", aus + " außerhalb");
    /* Bedienknöpfe */
    const klein = await p.evaluate(() => [...document.querySelectorAll(".sp-werkzeug button:not([hidden]), #spLeiste .sp-chip")].filter(x => { const r = x.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).length);
    pruef(klein === 0, breite + " px: jeder Knopf des Plans ≥ 44 px", klein + " zu klein");
    /* Überlauf */
    const ueber = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(ueber <= 0, breite + " px: kein seitlicher Überlauf", ueber + " px");
    /* Zustand hervorheben */
    await p.click('[data-sp-hebe="ruf"]');
    const ops = await p.evaluate(() => ({ ruf: getComputedStyle(document.querySelector('[data-sp-tisch="demo-t4"]')).opacity, anderer: getComputedStyle(document.querySelector('[data-sp-tisch="demo-t7"]')).opacity }));
    pruef(+ops.ruf === 1 && +ops.anderer < 0.4, breite + " px: Chip „Ruf“ hebt Ruf-Tische hervor, die anderen treten zurück", ops.ruf + " / " + ops.anderer);
    await p.click('[data-sp-hebe="ruf"]');
    /* Tastatur */
    await p.focus('[data-sp-tisch="demo-t7"]');
    await p.keyboard.press("Enter");
    await p.waitForTimeout(200);
    pruef(await p.evaluate(() => SAAL.auswahl === "7"), breite + " px: Enter auf einem fokussierten Tisch wählt ihn");
    pruef(pf.length === 0, breite + " px: kein Seitenfehler", pf.join(" | "));
    await ctx.close();
  }

  /* ── 3b · Zwei Finger (echte Touch-Folgen über CDP) ───────────── */
  console.log("\n══ Zwei Finger ══");
  {
    const { ctx, p, pf } = await neu(br, 390, 844, { hasTouch: true });
    await stelle(p);
    const cdp = await ctx.newCDPSession(p);
    const m = await mitte(p, "#spBuehne");
    const k0 = await p.evaluate(() => SAAL.kamera.k);
    const berühre = (art, punkte) => cdp.send("Input.dispatchTouchEvent", { type: art, touchPoints: punkte.map((q, i) => ({ x: q.x, y: q.y, id: i + 1 })) });
    const y = m.y, cx = m.x - 30;
    await berühre("touchStart", [{ x: cx - 30, y }, { x: cx + 30, y }]);
    for(let i = 1; i <= 8; i++) await berühre("touchMove", [{ x: cx - 30 - i * 9, y }, { x: cx + 30 + i * 9, y }]);
    await berühre("touchEnd", []);
    await p.waitForTimeout(150);
    const k1 = await p.evaluate(() => SAAL.kamera.k);
    pruef(k1 > k0 * 1.8, "Auseinanderziehen mit zwei Fingern zoomt hinein", (k1 / k0).toFixed(2) + "×");
    const tx = await p.evaluate(() => SAAL.kamera.tx);
    const sel = await p.evaluate(() => SAAL.auswahl);
    await berühre("touchStart", [{ x: cx + 80, y }, { x: cx - 80, y }]);
    for(let i = 1; i <= 8; i++) await berühre("touchMove", [{ x: cx + 80 - i * 6, y }, { x: cx - 80 + i * 6, y }]);
    await berühre("touchEnd", []);
    await p.waitForTimeout(150);
    const k2 = await p.evaluate(() => SAAL.kamera.k);
    pruef(k2 < k1 * 0.7, "Zusammenziehen zoomt heraus", (k2 / k1).toFixed(2) + "×");
    pruef(await p.evaluate(() => SAAL.auswahl) === sel, "und wählt dabei keinen Tisch");
    /* Ein Finger schiebt den Plan */
    const t0 = await p.evaluate(() => SAAL.kamera.tx);
    await berühre("touchStart", [{ x: m.x - 40, y: m.y }]);
    for(let i = 1; i <= 8; i++) await berühre("touchMove", [{ x: m.x - 40 + i * 8, y: m.y }]);
    await berühre("touchEnd", []);
    await p.waitForTimeout(100);
    const t1 = await p.evaluate(() => SAAL.kamera.tx);
    pruef(Math.abs(t1 - t0) > 30, "ein Finger schiebt den Plan", Math.round(t1 - t0) + " px");
    pruef(await p.evaluate(() => window.scrollY === 0), "und die Seite rollt dabei nicht mit");
    void tx;
    pruef(pf.length === 0, "kein Seitenfehler", pf.join(" | "));
    await ctx.close();
  }

  /* ── 4 · Bewegung ──────────────────────────────────────────────── */
  console.log("\n══ Bewegung ══");
  {
    const { ctx, p } = await neu(br, 390, 844);
    await stelle(p);
    const an = await p.evaluate(() => { const g = document.querySelector('[data-sp-tisch="demo-t6"] .sp-glow'); return { name: getComputedStyle(g).animationName, prop: [...document.getAnimations()].filter(a => a.animationName === "spPuls").map(a => a.effect.getKeyframes().map(k => Object.keys(k).filter(x => !["offset", "easing", "composite", "computedOffset"].includes(x)).join()).join()).join("|") }; });
    pruef(an.name === "spPuls", "Stufe 3 pulsiert (Tisch 6, Zahlung seit 12 Min)", an.name);
    pruef(an.prop && !/transform|left|top|width|height|filter/.test(an.prop) && /opacity/.test(an.prop), "und nur über opacity", an.prop);
    const ruhig = await p.evaluate(() => { const g = document.querySelector('[data-sp-tisch="demo-t3"] .sp-glow'); return getComputedStyle(g).animationName; });
    pruef(ruhig === "none", "Stufe 1 pulsiert nicht", ruhig);
    /* Neu zeichnen setzt den Puls nicht zurück (§4.1/§4.2): gleiche Lage → dasselbe Element */
    const vorher = await p.evaluate(() => { window.__g = document.querySelector('[data-sp-tisch="demo-t6"] .sp-glow'); return true; });
    await p.evaluate(() => { zeichneAlles(); zeichneAlles(); });
    pruef(await p.evaluate(() => window.__g === document.querySelector('[data-sp-tisch="demo-t6"] .sp-glow') && document.contains(window.__g)), "unveränderter Stand: kein Neuaufbau (derselbe Glühring läuft weiter)");
    await ctx.close();
    const c2 = await neu(br, 390, 844, { reducedMotion: "reduce" });
    await stelle(c2.p);
    const r = await c2.p.evaluate(() => getComputedStyle(document.querySelector('[data-sp-tisch="demo-t6"] .sp-glow')).animationName);
    pruef(r === "none", "reduzierte Bewegung: nichts pulsiert (Stufe zeigt sich über Helligkeit)", r);
    await c2.ctx.close();
  }

  /* ── 5 · Einrichten (nur Inhaber) ──────────────────────────────── */
  console.log("\n══ Einrichten ══");
  {
    const { ctx, p, pf } = await neu(br, 1280, 800);
    await stelle(p);
    pruef(await p.evaluate(() => !document.querySelector('[data-sp-wz="einrichten"]').hidden), "Inhaber sieht „Saal einrichten“");
    await p.evaluate(() => { ROLLE = "team"; saalZeichnen(); });
    pruef(await p.evaluate(() => document.querySelector('[data-sp-wz="einrichten"]').hidden), "Team sieht es nicht");
    const sperre = await p.evaluate(() => { saalEinrichten(true); return SAAL.edit; });
    pruef(sperre === false, "und kommt auch über die Funktion nicht hinein");
    await p.evaluate(() => { ROLLE = "inhaber"; saalZeichnen(); });
    await p.click('[data-sp-wz="einrichten"]');
    await p.waitForTimeout(250);
    pruef(await p.evaluate(() => !document.getElementById("spEdit").hidden), "Einrichten öffnet das Blatt");
    const frei = await p.evaluate(() => [...document.querySelectorAll("[data-sp-setzen]")].map(b => b.textContent));
    pruef(frei.length === 1 && /12/.test(frei[0]), "Tisch 12 steht als „noch nicht auf dem Plan“", frei.join("|"));
    await p.click("[data-sp-setzen]");
    await p.waitForTimeout(200);
    const gesetzt = await p.evaluate(() => { const v = SAAL.entwurf.get("demo-t12"); return v; });
    pruef(gesetzt && gesetzt.x != null && gesetzt.form === "rund", "ein Tipp setzt Tisch 12 auf einen freien Platz", JSON.stringify(gesetzt));
    pruef(await p.evaluate(() => !!document.querySelector('#spSvg [data-sp-tisch="demo-t12"]')), "und er ist gezeichnet");
    /* Ziehen verschiebt NUR den Entwurf */
    const m = await mitte(p, '#spSvg [data-sp-tisch="demo-t12"] .sp-treffer');
    const x0 = gesetzt.x, y0 = gesetzt.y;
    await p.mouse.move(m.x, m.y); await p.mouse.down(); await p.mouse.move(m.x + 90, m.y - 20, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(120);
    const bewegt = await p.evaluate(() => SAAL.entwurf.get("demo-t12"));
    pruef(bewegt.x !== x0 || bewegt.y !== y0, "Ziehen im Einrichten bewegt den Tisch", x0 + "," + y0 + " → " + bewegt.x + "," + bewegt.y);
    pruef(await p.evaluate(() => SAAL.tische.find(t => t.id === "demo-t12").x == null), "gespeichert ist noch nichts");
    /* Form und Stühle */
    await p.evaluate(() => { SAAL.gewaehlt = "demo-t12"; SAAL.sig = ""; saalZeichnen(); });
    await p.click('[data-sp-form="lang"]');
    await p.click('[data-sp-plaetze="1"]'); await p.click('[data-sp-plaetze="1"]');
    const v2 = await p.evaluate(() => SAAL.entwurf.get("demo-t12"));
    pruef(v2.form === "lang" && v2.plaetze === 6, "Form „lang“ und 6 Stühle", JSON.stringify(v2));
    /* Abbrechen verwirft */
    await p.click("[data-sp-abbrechen]");
    pruef(await p.evaluate(() => SAAL.edit === false && SAAL.tische.find(t => t.id === "demo-t12").x == null && !document.querySelector('[data-sp-tisch="demo-t12"]')), "Abbrechen verwirft alles");
    pruef(pf.length === 0, "kein Seitenfehler", pf.join(" | "));
    await ctx.close();
  }

  /* ── 6 · Speichern gegen einen gestellten Server (§2.3b) ──────── */
  console.log("\n══ Speichern, Server gestellt ══");
  {
    const { ctx, p } = await neu(br, 1280, 800);
    await stelle(p);
    const lauf = (antwort) => p.evaluate(async ([antwort]) => {
      window.__gesendet = [];
      demo = false; betriebId = "b-1";
      const kette = (tab) => ({ update: (daten) => { const q = { daten, filter: [] };
        const o = { eq: (k, v) => { q.filter.push(k + "=" + v); return o; }, select: () => { window.__gesendet.push({ tab, daten: q.daten, filter: q.filter.slice() }); return Promise.resolve(antwort); } };
        return o; } });
      db = { from: tab => kette(tab) };
      saalEinrichten(true);
      SAAL.entwurf.get("demo-t12").x = 30; SAAL.entwurf.get("demo-t12").y = 30; SAAL.entwurf.get("demo-t12").form = "eckig"; SAAL.entwurf.get("demo-t12").plaetze = 4;
      SAAL.entwurf.get("demo-t1").x = null; SAAL.entwurf.get("demo-t1").y = null;
      saalNeuBauen();
      await saalSpeichern();
      return { edit: SAAL.edit, meld: (document.getElementById("spEditMeldung") || {}).textContent || "", gesendet: window.__gesendet };
    }, [antwort]);
    const ok = await lauf({ data: [{ id: "t" }], error: null });
    pruef(ok.edit === false && ok.gesendet.length === 2, "Erfolg: zwei Tische geändert, Einrichten schließt", ok.gesendet.length + " Anfragen");
    const kn = ok.gesendet.find(g => /demo-t12/.test(g.filter.join()));
    pruef(kn && Object.keys(kn.daten).sort().join() === "form,plaetze,x,y,zone" && kn.tab === "tische", "Nutzlast: genau x, y, form, plaetze, zone", kn ? Object.keys(kn.daten).join() : "");
    pruef(kn && kn.filter.includes("betrieb_id=b-1"), "und nur im eigenen Betrieb", kn ? kn.filter.join() : "");
    const weg = ok.gesendet.find(g => /demo-t1$/.test(g.filter.join().replace(/,.*/, "")) || /id=demo-t1,/.test(g.filter.join() + ","));
    pruef(weg && weg.daten.x === null && weg.daten.y === null && weg.daten.form === null && weg.daten.plaetze === null && weg.daten.zone === null, "„Vom Plan nehmen“ leert alle fünf zugleich (sonst lehnt die Schranke ab)", weg ? JSON.stringify(weg.daten) : "");
    await ctx.close();
    const c2 = await neu(br, 1280, 800);
    await stelle(c2.p);
    const leer = await c2.p.evaluate(async () => {
      demo = false; betriebId = "b-1";
      db = { from: () => ({ update: () => { const o = { eq: () => o, select: () => Promise.resolve({ data: [], error: null }) }; return o; } }) };
      saalEinrichten(true); SAAL.entwurf.get("demo-t12").x = 30; SAAL.entwurf.get("demo-t12").y = 30; SAAL.entwurf.get("demo-t12").form = "rund"; SAAL.entwurf.get("demo-t12").plaetze = 4; saalNeuBauen();
      await saalSpeichern();
      return { edit: SAAL.edit, meld: document.getElementById("spEditMeldung").textContent, lokal: SAAL.tische.find(t => t.id === "demo-t12").x };
    });
    pruef(leer.edit === true && /Recht/.test(leer.meld) && leer.lokal == null, "0 Zeilen geändert (RLS) → Satz, KEIN Erfolg, nichts lokal übernommen", leer.meld);
    await c2.ctx.close();
  }

  /* ── 7 · Migration fehlt ───────────────────────────────────────── */
  console.log("\n══ Migration fehlt noch ══");
  {
    const { ctx, p, pf } = await neu(br, 390, 844);
    await stelle(p);
    const r = await p.evaluate(async () => {
      demo = false; betriebId = "b-1";
      const wahl = sp => /x,y/.test(sp) ? { error: { message: "column tische.x does not exist" } } : { data: [{ id: "a", nummer: "1", aktiv: true }, { id: "b", nummer: "2", aktiv: true }], error: null };
      db = { from: tab => tab === "saal_einstellungen"
        ? { select: () => { const o = { eq: () => o, maybeSingle: () => Promise.resolve({ data: null, error: { message: "relation does not exist" } }) }; return o; } }
        : { select: sp => { const o = { eq: () => o, order: () => o, then: f => f(wahl(sp)) }; return o; } } };
      await saalLaden("b-1");
      return { fehlt: SAAL.fehlt, einst: SAAL.einstFehlt, tische: SAAL.tische.length, plan: SAAL.tische.filter(t => t.x != null).length,
        buehne: document.getElementById("spBuehne").hidden, leer: !document.getElementById("spLeer").hidden, text: document.getElementById("spLeer").textContent,
        knopf: !!document.querySelector("#spLeer [data-sp-wz=einrichten]") };
    });
    pruef(r.fehlt && r.einst && r.tische === 2 && r.plan === 0, "ohne Spalten und Tabelle: Tische ohne Lage geladen, nichts gezeichnet", JSON.stringify(r));
    pruef(r.buehne && r.leer && /noch leer/.test(r.text) && !r.knopf, "statt eines leeren Plans ein Satz — und KEIN Knopf „einrichten“, der nicht speichern könnte", r.text);
    pruef(pf.length === 0, "kein Seitenfehler", pf.join(" | "));
    await ctx.close();
  }

  /* ── 8 · Leuchtstufen und Bereiche einstellen ──────────────────── */
  console.log("\n══ Leuchtstufen und Bereiche einstellen ══");
  {
    const { ctx, p, pf } = await neu(br, 1440, 900);
    await stelle(p);
    const kontrast = (a, b) => { const l = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }; const x = l(a), y = l(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const badge = nr => p.evaluate(n => { const g = document.querySelector('#spSvg [data-sp-tisch="demo-t' + n + '"]'); const c = g && g.querySelector(".sp-abz circle"), w = g && g.querySelector(".sp-abz path"); return g ? { fill: c && c.getAttribute("fill"), glyph: w && w.getAttribute("stroke"), stufe: ((g.querySelector(".sp-glow") || { getAttribute: () => "" }).getAttribute("class").match(/s(\d)/) || [])[1] } : null; }, nr);
    pruef((await badge(4)).stufe === "1", "Voraussetzung: Tisch 4 (Ruf seit 1 Min) steht in Stufe 1");
    await p.click('[data-sp-wz="einrichten"]');
    await p.waitForTimeout(200);
    await p.click('[data-sp-tab="stufen"]');
    const reihen = await p.evaluate(() => [...document.querySelectorAll("#spEdit [data-sp-stufe]")].map(r => r.dataset.spStufe + ":" + r.querySelectorAll("[data-sp-min]").length));
    pruef(reihen.join(",") === "ruf:2,servieren:2,neu:2,pruefen:2,arbeit:0", "fünf Zeilen: vier mit Minuten, „In Arbeit“ nur mit Farbe", reihen.join(","));
    const vorgabe = await p.evaluate(() => ["ruf", "servieren", "neu", "pruefen"].map(a => a + SAAL.konfig.stufen[a].min2 + "/" + SAAL.konfig.stufen[a].min3).join(" "));
    pruef(vorgabe === "ruf2/5 servieren2/4 neu3/6 pruefen5/10", "die Vorgaben sind die alten Werte (nichts ändert sich ungefragt)", vorgabe);
    /* Zeit ändern: Vorschau am Plan sofort, Feld behält den Fokus */
    await p.fill('[data-sp-stufe="ruf"] [data-sp-min="2"]', "1");
    await p.waitForTimeout(150);
    pruef((await badge(4)).stufe === "2", "Ruf „Stufe 2 ab 1 Min“: Tisch 4 (1 Min) leuchtet sofort in Stufe 2", (await badge(4)).stufe);
    pruef(await p.evaluate(() => document.activeElement && document.activeElement.matches('[data-sp-stufe="ruf"] [data-sp-min="2"]')), "das Feld behält beim Tippen den Fokus (das Blatt baut sich nicht neu auf)");
    pruef(await p.evaluate(() => SAAL.konfig.stufen.ruf.min2 === 2), "gespeichert gilt noch der alte Wert, bis „Speichern“");
    /* Farbe wählen: Zeichen darauf wird gerechnet (§5.1) */
    const farbe = async hex => { await p.evaluate(h => { const f = document.querySelector('[data-sp-farbe="ruf"]'); f.value = h; f.dispatchEvent(new Event("input", { bubbles: true })); }, hex); await p.waitForTimeout(120); return badge(4); };
    const hell = await farbe("#ffee00"), dunkel = await farbe("#101820");
    pruef(hell.fill === "#FFEE00" && kontrast(hell.fill, hell.glyph) >= 4.5, "helle Farbe: Zeichen darauf ≥ 4,5:1", hell.fill + " / " + hell.glyph + " = " + kontrast(hell.fill, hell.glyph).toFixed(1));
    pruef(dunkel.fill === "#101820" && kontrast(dunkel.fill, dunkel.glyph) >= 4.5, "dunkle Farbe: das Zeichen wechselt und bleibt ≥ 4,5:1", dunkel.fill + " / " + dunkel.glyph + " = " + kontrast(dunkel.fill, dunkel.glyph).toFixed(1));
    await farbe("#00c8ff");
    /* Ungültig: Stufe 3 nicht nach Stufe 2 */
    await p.fill('[data-sp-stufe="neu"] [data-sp-min="3"]', "3");
    const sendungen = [];
    await p.evaluate(() => { window.__rpc = []; demo = false; betriebId = "b-1";
      db = { from: () => ({ update: () => { const o = { eq: () => o, select: () => Promise.resolve({ data: [{ id: "x" }], error: null }) }; return o; } }),
             rpc: (fn, a) => { window.__rpc.push({ fn, a: JSON.parse(JSON.stringify(a)) }); return Promise.resolve(window.__antwort || { data: { ok: true }, error: null }); } }; });
    await p.click("[data-sp-speichern]");
    await p.waitForTimeout(200);
    const schlecht = await p.evaluate(() => ({ rpc: window.__rpc.length, edit: SAAL.edit, text: (document.getElementById("spEditMeldung") || {}).textContent || "" }));
    pruef(schlecht.rpc === 0 && schlecht.edit && /Stufe 3 muss später/.test(schlecht.text), "Stufe 3 nicht nach Stufe 2: ein Satz, nichts gesendet, das Blatt bleibt offen", schlecht.text);
    await p.click('[data-sp-tab="stufen"]');
    await p.fill('[data-sp-stufe="neu"] [data-sp-min="3"]', "9");
    /* Server sagt nein (kein Recht): Satz, kein Erfolg */
    await p.evaluate(() => { window.__antwort = { data: { ok: false, grund: "kein_recht" }, error: null }; });
    await p.click("[data-sp-speichern]");
    await p.waitForTimeout(200);
    const nein = await p.evaluate(() => ({ edit: SAAL.edit, text: (document.getElementById("spEditMeldung") || {}).textContent || "", alt: SAAL.konfig.stufen.ruf.farbe }));
    pruef(nein.edit && /Recht/.test(nein.text) && nein.alt === "#FF3D81", "Server verweigert: Satz, Blatt offen, gespeichert bleibt der alte Stand", nein.text);
    /* Erfolg */
    await p.evaluate(() => { window.__antwort = { data: { ok: true }, error: null }; window.__rpc.length = 0; });
    await p.click("[data-sp-speichern]");
    await p.waitForTimeout(250);
    const ok = await p.evaluate(() => ({ edit: SAAL.edit, rpc: window.__rpc, ruf: SAAL.konfig.stufen.ruf, neu: SAAL.konfig.stufen.neu }));
    const a = ok.rpc[0];
    pruef(!ok.edit && ok.rpc.length === 1 && a.fn === "saal_einstellungen_setzen" && a.a.p_betrieb === "b-1", "Erfolg: genau EIN Aufruf von saal_einstellungen_setzen für den eigenen Betrieb", ok.rpc.length + " Aufrufe");
    pruef(a && JSON.stringify(a.a.p_daten.stufen.ruf) === JSON.stringify({ farbe: "#00C8FF", min2: 1, min3: 5 }) && JSON.stringify(a.a.p_daten.stufen.arbeit) === JSON.stringify({ farbe: "#38BDF8" }), "Nutzlast: Ruf mit Farbe und beiden Zeiten, „In Arbeit“ nur mit Farbe", JSON.stringify(a && a.a.p_daten.stufen.ruf));
    pruef(a && Object.keys(a.a.p_daten).sort().join() === "stufen,zonen", "und nichts sonst (nur stufen, zonen)");
    pruef(ok.neu.min3 === 9 && ok.ruf.farbe === "#00C8FF", "danach gilt der neue Stand", JSON.stringify(ok.ruf));
    const chip = await p.evaluate(() => document.querySelector('[data-sp-hebe="ruf"] i').style.background);
    pruef(/0, 200, 255|#00c8ff/i.test(chip), "die Legende trägt die neue Farbe", chip);
    /* Neuöffnen (§8.1m): was gespeichert wurde, kommt aus der Datenbank wieder */
    const neuLaden = await p.evaluate(async daten => {
      db = { from: tab => tab === "saal_einstellungen"
        ? { select: () => { const o = { eq: () => o, maybeSingle: () => Promise.resolve({ data: { daten }, error: null }) }; return o; } }
        : { select: () => { const o = { eq: () => o, order: () => o, then: f => f({ data: [{ id: "demo-t4", nummer: "4", aktiv: true, x: 82, y: 26, form: "lang", plaetze: 6, zone: "Haupt-Raum" }], error: null }) }; return o; } } };
      await saalLaden("b-1");
      return { ruf: SAAL.konfig.stufen.ruf, zonen: SAAL.konfig.zonen };
    }, a.a.p_daten);
    pruef(neuLaden.ruf.farbe === "#00C8FF" && neuLaden.ruf.min2 === 1, "nach dem Neuladen steht der gespeicherte Stand da", JSON.stringify(neuLaden.ruf));
    pruef(pf.length === 0, "kein Seitenfehler", pf.join(" | "));
    await ctx.close();
    /* Bereiche: umbenennen, anlegen, entfernen */
    const b = await neu(br, 1440, 900);
    await stelle(b.p);
    await b.p.click('[data-sp-wz="einrichten"]');
    await b.p.click('[data-sp-tab="bereiche"]');
    await b.p.fill('[data-sp-zname="0"]', "Saal");
    await b.p.dispatchEvent('[data-sp-zname="0"]', "change");
    await b.p.waitForTimeout(150);
    const tabs = await b.p.evaluate(() => [...document.querySelectorAll("#spZonen .sp-zone")].map(z => z.textContent.replace(/\d+$/, "").trim()));
    pruef(tabs.join("|") === "Saal|Terrasse" && await b.p.evaluate(() => document.querySelectorAll("#spSvg [data-sp-tisch]").length === 8), "Umbenennen: die Tische ziehen mit (8 im „Saal“), kein Tisch fällt heraus", tabs.join("|"));
    await b.p.click("[data-sp-zneu]");
    await b.p.waitForTimeout(100);
    pruef(await b.p.evaluate(() => saalZonen().length === 3 && saalZonen()[2] === "Bereich 3"), "„＋ Bereich“ legt „Bereich 3“ an");
    await b.p.click('[data-sp-zweg="1"]');
    await b.p.waitForTimeout(100);
    const nachweg = await b.p.evaluate(() => ({ zonen: saalZonen(), t10: saalTischZone(SAAL.tische.find(t => t.nummer === "10")) }));
    pruef(nachweg.zonen.join("|") === "Saal|Bereich 3" && nachweg.t10 === "Saal", "Entfernen der Terrasse: ihre Tische rutschen in den ersten Bereich", JSON.stringify(nachweg));
    await b.p.fill('[data-sp-zname="1"]', "Saal");
    await b.p.dispatchEvent('[data-sp-zname="1"]', "change");
    pruef(await b.p.evaluate(() => saalZonen().join("|") === "Saal|Bereich 3" && document.querySelector('[data-sp-zname="1"]').value === "Bereich 3"), "ein doppelter Name wird abgelehnt (Feld springt zurück)");
    await b.p.fill('[data-sp-zname="1"]', 'Bar <b>"x"');
    await b.p.dispatchEvent('[data-sp-zname="1"]', "change");
    pruef(await b.p.evaluate(() => saalZonen()[1] === "Bar bx"), "Sonderzeichen im Namen fallen weg (kein Element, kein Attribut)", await b.p.evaluate(() => saalZonen()[1]));
    pruef(await b.p.evaluate(() => !document.querySelector("#spZonen b:not(.sp-zonenzahl), #spZonen img, #spEdit img")), "und stehen nie als Auszeichnung da");
    await b.p.click("[data-sp-abbrechen]");
    pruef(await b.p.evaluate(() => saalZonen().join("|") === "Haupt-Raum|Terrasse"), "Abbrechen verwirft alles (Bereiche wie vorher)");
    await b.ctx.close();
  }

  await br.close();
  console.log("\n" + (fehler ? fehler + " FEHLER" : "alles grün"));
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
