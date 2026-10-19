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
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; });
  await p.waitForTimeout(300);
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
    pruef(n === 11, "11 von 12 Tischen sind eingezeichnet (Tisch 12 nicht)", String(n));
    const FARBE = { servieren: "#22D17A", ruf: "#FF3D81", neu: "#FFB300", pruefen: "#A78BFA", arbeit: "#38BDF8" };
    const erwartet = { 4: ["ruf", 1], 10: ["neu", 3], 7: ["neu", 1], 2: ["arbeit", 1], 3: ["servieren", 1], 6: ["pruefen", 3] };
    for(const [nr, [art, stufe]] of Object.entries(erwartet)){
      const a = await abzeichen(p, nr);
      pruef(a && a.fill === FARBE[art], "Tisch " + nr + " leuchtet " + art, a ? a.fill : "kein Tisch");
      pruef(a && String(a.stufe) === String(stufe), "Tisch " + nr + ": Leuchtstufe " + stufe, a ? a.stufe : "");
    }
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
    const ohneAuswahl = await alleKarten();
    pruef(ohneAuswahl >= 7, "ohne Auswahl zeigt die Liste darunter ALLES (offene Bestellungen)", String(ohneAuswahl));
    const rest = await p.evaluate(() => ({ da: !document.getElementById("spRest").hidden, text: document.getElementById("spRest").textContent }));
    pruef(rest.da && /Lieferung 1/.test(rest.text) && /Tisch 67 1/.test(rest.text), "„Außerhalb des Plans“ nennt Lieferung und den nicht eingezeichneten Tisch 67", rest.text);
    await p.click("[data-sp-rest]");
    await p.waitForTimeout(150);
    const nurRest = await p.evaluate(() => [...document.querySelectorAll("#karten .bestellung")].map(k => k.dataset.quelle).sort().join(","));
    pruef(nurRest === "lieferung,tisch", "Tipp darauf zeigt genau die beiden", nurRest);
    pruef(await p.evaluate(() => document.body.classList.contains("saal-sel") && getComputedStyle(document.querySelector("#t-bestellungen .filterblock")).display !== "none"), "mit Auswahl stehen die Filter wieder da");
    await p.click("[data-sp-rest]");
    await p.waitForTimeout(150);
    pruef(await alleKarten() === ohneAuswahl, "nochmal tippen: wieder alles");
    pruef(await p.evaluate(() => getComputedStyle(document.querySelector("#t-bestellungen .filterblock")).display === "none"), "ohne Auswahl ersetzen die Zustands-Chips die Filter");
    /* Umschalten auf Liste: alles wie vorher */
    await p.click('[data-saal-ansicht="liste"]');
    await p.waitForTimeout(150);
    pruef(await p.evaluate(() => document.getElementById("saal").hidden && !document.body.classList.contains("saal-an")), "„Liste“ blendet den Saal aus");
    pruef(await alleKarten() === ohneAuswahl, "und die Liste zeigt dasselbe");
    pruef(await p.evaluate(() => { try { return localStorage.getItem(SAAL_MERK) === "liste"; } catch(e){ return true; } }), "die Wahl bleibt gemerkt");
    await ctx.close();
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
    await p.focus('[data-sp-tisch="demo-t10"]');
    await p.keyboard.press("Enter");
    await p.waitForTimeout(200);
    pruef(await p.evaluate(() => SAAL.auswahl === "10"), breite + " px: Enter auf einem fokussierten Tisch wählt ihn");
    pruef(pf.length === 0, breite + " px: kein Seitenfehler", pf.join(" | "));
    await ctx.close();
  }

  /* ── 4 · Bewegung ──────────────────────────────────────────────── */
  console.log("\n══ Bewegung ══");
  {
    const { ctx, p } = await neu(br, 390, 844);
    await stelle(p);
    const an = await p.evaluate(() => { const g = document.querySelector('[data-sp-tisch="demo-t10"] .sp-glow'); return { name: getComputedStyle(g).animationName, prop: [...document.getAnimations()].filter(a => a.animationName === "spPuls").map(a => a.effect.getKeyframes().map(k => Object.keys(k).filter(x => !["offset", "easing", "composite", "computedOffset"].includes(x)).join()).join()).join("|") }; });
    pruef(an.name === "spPuls", "Stufe 3 pulsiert", an.name);
    pruef(an.prop && !/transform|left|top|width|height|filter/.test(an.prop) && /opacity/.test(an.prop), "und nur über opacity", an.prop);
    const ruhig = await p.evaluate(() => { const g = document.querySelector('[data-sp-tisch="demo-t3"] .sp-glow'); return getComputedStyle(g).animationName; });
    pruef(ruhig === "none", "Stufe 1 pulsiert nicht", ruhig);
    /* Neu zeichnen setzt den Puls nicht zurück (§4.1/§4.2): gleiche Lage → dasselbe Element */
    const vorher = await p.evaluate(() => { window.__g = document.querySelector('[data-sp-tisch="demo-t10"] .sp-glow'); return true; });
    await p.evaluate(() => { zeichneAlles(); zeichneAlles(); });
    pruef(await p.evaluate(() => window.__g === document.querySelector('[data-sp-tisch="demo-t10"] .sp-glow') && document.contains(window.__g)), "unveränderter Stand: kein Neuaufbau (derselbe Glühring läuft weiter)");
    await ctx.close();
    const c2 = await neu(br, 390, 844, { reducedMotion: "reduce" });
    await stelle(c2.p);
    const r = await c2.p.evaluate(() => getComputedStyle(document.querySelector('[data-sp-tisch="demo-t10"] .sp-glow')).animationName);
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
    pruef(kn && Object.keys(kn.daten).sort().join() === "form,plaetze,x,y" && kn.tab === "tische", "Nutzlast: genau x, y, form, plaetze", kn ? Object.keys(kn.daten).join() : "");
    pruef(kn && kn.filter.includes("betrieb_id=b-1"), "und nur im eigenen Betrieb", kn ? kn.filter.join() : "");
    const weg = ok.gesendet.find(g => /demo-t1$/.test(g.filter.join().replace(/,.*/, "")) || /id=demo-t1,/.test(g.filter.join() + ","));
    pruef(weg && weg.daten.x === null && weg.daten.y === null && weg.daten.form === null && weg.daten.plaetze === null, "„Vom Plan nehmen“ leert alle vier zugleich (sonst lehnt die Schranke ab)", weg ? JSON.stringify(weg.daten) : "");
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
      demo = false; betriebId = "b-1"; let n = 0;
      db = { from: () => ({ select: (sp) => { const o = { eq: () => o, order: () => o, then: (f) => f(/x,y/.test(sp) ? { error: { message: "column tische.x does not exist" } } : { data: [{ id: "a", nummer: "1", aktiv: true }, { id: "b", nummer: "2", aktiv: true }], error: null }) }; return o; } }) };
      await saalLaden("b-1");
      return { fehlt: SAAL.fehlt, tische: SAAL.tische.length, plan: SAAL.tische.filter(t => t.x != null).length, segment: document.getElementById("saalAnsicht").hidden, saal: document.getElementById("saal").hidden, einr: document.querySelector('[data-sp-wz="einrichten"]').hidden };
    });
    pruef(r.fehlt && r.tische === 2 && r.plan === 0, "ohne Spalten: Tische ohne Lage geladen, nichts gezeichnet", JSON.stringify(r));
    pruef(r.segment && r.saal, "ohne Plan und ohne Migration bleibt es die Liste (kein leerer Saal)");
    pruef(pf.length === 0, "kein Seitenfehler", pf.join(" | "));
    await ctx.close();
  }

  await br.close();
  console.log("\n" + (fehler ? fehler + " FEHLER" : "alles grün"));
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
