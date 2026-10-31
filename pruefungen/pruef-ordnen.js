/* ═══════════════════════════════════════════════════════════
   PRÜFUNG · Startseite live in der Hub-Vorschau ordnen („Ordnen starten“)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-ordnen.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle“)

   Wunsch: „Per Drag and drop alle Kacheln und Flächen wie Blöcke
   verschieben können, live in der Ansicht vom Hub, und beim Draufttippen
   kann man es bearbeiten.“

   Die Naht liegt zwischen zwei Dateien (§8.1i): Der Hub (Vorschau-Rahmen)
   ordnet sein eigenes Abbild um und MELDET; das Board schreibt es in seine
   zwei Stände (AFBSTAND = hub_bloecke, KACHELSTAND = hub_kacheln samt
   Rubrik). Deshalb läuft alles am echten Board mit der echten Hub-Datei als
   Rahmen und mit ECHTEN Zeigern — nicht über die Funktionen.

   1 · Ruhe: ohne „Ordnen starten“ tut der Hub nichts davon.
   2 · Fläche ziehen (Maus): Reihenfolge im Hub = Reihenfolge im Board;
       Unsichtbares behält seinen Platz (§7), nichts wird geschrieben.
   3 · Kachel ziehen: innerhalb der Rubrik, und in eine ANDERE Rubrik
       (kbGruppeVon der Kachel = deren Name, im Hub dort gezeichnet).
   4 · Tippen öffnet die Einstellungen genau dieses Stücks.
   5 · Finger (CDP): erst nach 260 ms Halten ein Griff; ein früher Zug rollt
       nur, ein Halten ohne Zug ist ein Tipp.
   6 · Übernehmen schreibt BEIDE Stände, nach dem Beenden bleibt der Hub
       so, wie er war; Team darf es nicht; Escape/Beenden räumt auf.
   ═══════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const ADMIN = "file://" + path.join(OBEN, "seiten", "admin.html");
const BASIS = "https://omoteno.test/h/";
const HAEUSER = ["blend", "chocolamour"];
for(const h of HAEUSER){
  const f = path.join(OBEN, "dist", h, "index.html");
  if(!fs.existsSync(f)){ console.error(f + " fehlt — erst „node erzeuger/erzeuge-hub.js --alle“."); process.exit(1); }
}

let fehler = 0;
const pruef = (g, t, z) => { console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined && z !== "" ? "  → " + z : "")); if(!g) fehler++; };
const echt = k => k.filter(z => !/net::ERR|Failed to load|ERR_FAILED/i.test(z));
const warte = ms => new Promise(r => setTimeout(r, ms));

async function oeffne(br, haus, opt = {}){
  const ctx = await br.newContext({ viewport:{ width:430, height:1000 }, hasTouch: !!opt.finger, isMobile: !!opt.finger });
  const p = await ctx.newPage();
  const pf = [];
  p.on("pageerror", e => pf.push(String(e).slice(0, 160)));
  p.on("console", m => { if(m.type() === "error" && !/net::ERR|Failed to load/i.test(m.text())) pf.push(m.text().slice(0, 160)); });
  await p.addInitScript(b => { window.HUB_VORSCHAU_BASIS = b; Element.prototype.requestFullscreen = () => Promise.resolve(); }, BASIS);
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(u.startsWith(BASIS)){
      const slug = u.slice(BASIS.length).split("/")[0];
      return r.fulfill({ status:200, contentType:"text/html; charset=utf-8", headers:{ "Access-Control-Allow-Origin":"*" },
        body: fs.readFileSync(path.join(OBEN, "dist", slug, "index.html"), "utf8") });
    }
    return r.fulfill({ status:200, contentType:"application/json", headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" });
  });
  await p.goto(ADMIN); await p.waitForTimeout(900);
  await p.evaluate(h => {
    document.getElementById("tor").hidden = true; demoStarten();
    /* Im Vorführmodus kennt das Board kein Haus mit Adresse („blend“ ist der Rückfall) — ein Eintrag mit Slug macht aus der Probe ein anderes Haus. */
    const b = meineBetriebe.find(x => x.id === betriebId);
    if(b) b.slug = h; else meineBetriebe.push({ id: betriebId, slug: h, name: h, rolle: "inhaber" });
    zeichneAlles();
  }, haus);
  await p.waitForTimeout(300);
  await p.evaluate(() => tafelZeigen("startseite")); await p.waitForTimeout(300);
  const da = await gruppeZu(p, "#gh-kacheln");
  await p.waitForTimeout(2500);
  return { ctx, p, pf, da };
}

/* Ort eines Stücks im Rahmen, in Seitenkoordinaten des Boards. Der Rahmen wird zuerst ins Bild gerollt. */
const ort = (p, sel, wohin = "mitte") => p.evaluate(([sel, wohin]) => {
  const f = hvAlle().gestalten.frame, d = f.contentDocument, el = d.querySelector(sel);
  if(!el) return null;
  el.scrollIntoView({ block:"center", behavior:"instant" });
  const fr = f.getBoundingClientRect(), sk = fr.width / f.clientWidth, r = el.getBoundingClientRect();
  const x = fr.left + (r.left + r.width / 2) * sk;
  const y = wohin === "oben" ? fr.top + (r.top + 4) * sk : wohin === "unten" ? fr.top + (r.bottom - 4) * sk : fr.top + (r.top + r.height / 2) * sk;
  return { x, y, w: r.width * sk, h: r.height * sk, imBild: x > 0 && y > 0 && y < innerHeight && x < innerWidth };
}, [sel, wohin]);
const hubReihe = p => p.evaluate(() => [...hvAlle().gestalten.frame.contentDocument.querySelectorAll(".sblock[data-sblock]")].map(b => b.dataset.sblock));
const hubRubriken = p => p.evaluate(() => [...hvAlle().gestalten.frame.contentDocument.querySelectorAll(".sbereich")].map(s => ({
  auf: (s.querySelector("[data-sb-auf]") || { getAttribute: () => "" }).getAttribute("data-sb-auf"),
  kachel: [...s.querySelectorAll("a.kachel[data-kachel]")].map(k => k.dataset.kachel) })));
const boardKacheln = p => p.evaluate(() => KACHELSTAND.map(k => k.schluessel + "|" + kbGruppeVon(k.schluessel)));
const zustand = p => p.evaluate(() => ({ an: LO_AN, geaendert: LO_GEAENDERT, sage: document.getElementById("loSage").textContent,
  sichern: !document.getElementById("loSichern").hidden, afb: AFBSTAND.map(b => b.id), afbG: AFBGEAENDERT }));


/* Ein Stück greifen und zu einem anderen ziehen. Gemessen wird das Ziel bei JEDEM Schritt neu und OHNE zu rollen:
   Am Rand rollt der Rahmen von selbst (Teil der Funktion), und ein Ziel, das gerade wegrollt, wäre sonst veraltet. */
const messe = (p, sel, wohin) => p.evaluate(([sel, wohin]) => {
  const f = hvAlle().gestalten.frame, el = f.contentDocument.querySelector(sel); if(!el) return null;
  const fr = f.getBoundingClientRect(), sk = fr.width / f.clientWidth, r = el.getBoundingClientRect();
  const w = wohin || {};
  return { x: fr.left + (r.left + r.width * (w.fx === undefined ? 0.5 : w.fx)) * sk, y: fr.top + (r.top + r.height * (w.fy === undefined ? 0.5 : w.fy)) * sk,
           h: r.height * sk, hoch: Math.max(fr.top, 0), tief: Math.min(fr.bottom, innerHeight) };
}, [sel, wohin]);
async function ziehZu(p, vonSel, zielSel, wohin){
  const v = await ort(p, vonSel);
  if(!v || !v.imBild) return { ok:false, grund:"Quelle nicht im Bild" };
  await p.mouse.move(v.x, v.y); await p.mouse.down();
  await p.mouse.move(v.x + 3, v.y - 12, { steps: 3 });
  let schritte = 0;
  for(; schritte < 120; schritte++){
    const z = await messe(p, zielSel, wohin); if(!z) break;
    const y = Math.max(z.hoch + 6, Math.min(z.y, z.tief - 6));
    await p.mouse.move(z.x, y, { steps: 2 });
    if(Math.abs(z.y - y) < 2){ await p.mouse.move(z.x, y, { steps: 2 }); break; }
    await warte(40);   /* der Rand rollt, wir warten auf ihn */
  }
  await p.mouse.up(); await p.waitForTimeout(800);
  return { ok:true, schritte };
}

async function ziehMaus(p, von, nach, schritte = 14){
  await p.mouse.move(von.x, von.y); await p.mouse.down();
  await p.mouse.move(von.x + 3, von.y - 12, { steps: 3 });
  await p.mouse.move(nach.x, nach.y, { steps: schritte });
  await p.mouse.up(); await p.waitForTimeout(700);
}

(async () => {
  const br = await chromium.launch();

  for(const haus of HAEUSER){
    console.log("\n══ " + haus + " · Live ordnen mit der Maus ══");
    const { ctx, p, pf, da } = await oeffne(br, haus);
    pruef(da, "Voraussetzung: die Unterseite „Kacheln“ ist offen");
    const titel = await p.evaluate(() => { const f = hvAlle().gestalten && hvAlle().gestalten.frame; return f && f.contentDocument ? f.contentDocument.title : ""; });
    pruef(/choco/i.test(titel) === (haus === "chocolamour"), "Voraussetzung: im Rahmen steht wirklich dieses Haus", titel);
    pruef(await p.evaluate(() => !!(hvAlle().gestalten && hvAlle().gestalten.bereit)), "Voraussetzung: die Vorschau ist bereit");

    /* 1 · Ruhe */
    const ruhe = await p.evaluate(() => { const d = hvAlle().gestalten.frame.contentDocument;
      return { klasse: d.documentElement.classList.contains("ordnen"), schilder: d.querySelectorAll("[data-ordnen-name]").length,
               alt: document.getElementById("loAlt").open, knopf: document.getElementById("loAn").getAttribute("aria-pressed") }; });
    pruef(!ruhe.klasse && ruhe.schilder === 0 && ruhe.knopf === "false", "ohne „Ordnen starten“ trägt der Hub nichts davon (keine Klasse, keine Namensschilder)", JSON.stringify(ruhe));
    pruef(ruhe.alt === false, "die alte Anordnung ist eingeklappt (die neue Funktion steht davor)");
    /* Ein Tipp in der Ruhe bedient die Vorschau nicht über das Board */
    const vorher = await zustand(p);

    await p.click("#loAn"); await p.waitForTimeout(1200);
    const an = await p.evaluate(() => { const d = hvAlle().gestalten.frame.contentDocument;
      return { klasse: d.documentElement.classList.contains("ordnen"), blocks: d.querySelectorAll(".sblock[data-sblock]").length,
               schilder: d.querySelectorAll(".sblock[data-ordnen-name]").length, kacheln: d.querySelectorAll("a.kachel[data-kachel]").length,
               rahmen: document.querySelector(".gh-vorschau").className, knopf: document.getElementById("loAn").getAttribute("aria-pressed") }; });
    pruef(an.klasse && an.knopf === "true" && an.blocks >= 4 && an.schilder === an.blocks && an.kacheln >= 8,
          "Ordnen starten: der Hub bekommt den Modus, jede Fläche ihr Schild, Kacheln da", JSON.stringify(an));
    pruef(/ordnen/.test(an.rahmen) && /gross/.test(an.rahmen), "die Vorschau wird groß (Arbeitsfläche)");

    /* 2 · Fläche ziehen */
    const reihe0 = await hubReihe(p), afb0 = (await zustand(p)).afb;
    pruef(reihe0.length >= 4, "Voraussetzung: mindestens vier Flächen sichtbar", reihe0.join(" › "));
    const letzte = reihe0[reihe0.length - 1], erste = reihe0[0];
    const von = await ort(p, '[data-sblock="' + letzte + '"]');
    pruef(von && von.imBild, "Voraussetzung: die letzte Fläche liegt im Bild und hat eine Größe", von && JSON.stringify(von));
    const schrieb = [];
    p.on("request", r => { if(/supabase|rest\/v1/.test(r.url()) && r.method() !== "GET") schrieb.push(r.method() + " " + r.url()); });
    await p.mouse.move(von.x, von.y); await p.mouse.down();
    await p.mouse.move(von.x + 3, von.y - 12, { steps: 3 });
    const hebt = await p.evaluate(() => { const d = hvAlle().gestalten.frame.contentDocument; return { hebt: !!d.querySelector(".ordnen-hebt"), zieht: d.documentElement.classList.contains("ordnen-zieht") }; });
    pruef(hebt.hebt && hebt.zieht, "nach 6 px Zug hebt sich die Fläche (Klasse + Zustand am Rahmen)", JSON.stringify(hebt));
    await p.mouse.up(); await p.waitForTimeout(500);
    /* Abgelegt ohne nennenswerten Zug zählt als Tipp — das Ziehen selbst gilt erst mit weiter Strecke. Also jetzt richtig: */
    await p.evaluate(() => { AFB_OFFEN.clear(); });
    const zg = await ziehZu(p, '[data-sblock="' + letzte + '"]', '[data-sblock="' + erste + '"]', { fy: 0.1 });
    pruef(zg.ok, "Voraussetzung: Quelle liegt im Bild beim Greifen", zg.grund || zg.schritte + " Schritte");
    const reihe1 = await hubReihe(p), s1 = await zustand(p);
    pruef(reihe1[0] === letzte && reihe1.length === reihe0.length && reihe1.slice(1).join() === reihe0.slice(0, -1).join(),
          "die gezogene Fläche steht im Hub ganz oben, alle anderen rücken in alter Reihenfolge nach", reihe1.join(" › "));
    const sichtbarImBoard = s1.afb.filter(id => reihe1.includes(id));
    pruef(sichtbarImBoard.join() === reihe1.join(), "Reihenfolge im Board (AFBSTAND) = Reihenfolge im Hub (am gezeichneten Bild)", sichtbarImBoard.join(" › "));
    pruef(s1.afb.length === afb0.length && [...s1.afb].sort().join() === [...afb0].sort().join(),
          "nichts geht verloren: auch Unsichtbares (ausgeblendet, ohne Inhalt) bleibt in der Liste", afb0.length + " → " + s1.afb.length);
    pruef(s1.afbG && s1.geaendert && s1.sichern && /noch nicht übernommen/.test(s1.sage), "Board merkt die Änderung und zeigt „Ordnung übernehmen“", s1.sage);
    pruef(schrieb.length === 0, "es wurde nichts geschrieben (erst mit „Ordnung übernehmen“)", schrieb.join(" | "));
    pruef(await p.evaluate(() => { const d = hvAlle().gestalten.frame.contentDocument; return !d.querySelector(".ordnen-hebt") && !d.documentElement.classList.contains("ordnen-zieht") && !d.querySelector('[style*="transform"].sblock'); }),
          "nach dem Ablegen bleibt nichts hängen (kein Heben, kein Rest-transform)");

    /* Gegenprobe: Ablegen am alten Platz ändert nichts und sagt es */
    const z0 = await zustand(p);
    const v2 = await ort(p, '[data-sblock="' + reihe1[1] + '"]');
    await p.mouse.move(v2.x, v2.y); await p.mouse.down(); await p.mouse.move(v2.x + 14, v2.y + 2, { steps: 4 }); await p.mouse.move(v2.x, v2.y, { steps: 4 }); await p.mouse.up();
    await p.waitForTimeout(600);
    const z1 = await zustand(p);
    pruef(z1.afb.join() === z0.afb.join() && /alten Platz|Geöffnet/.test(z1.sage) === true || z1.afb.join() === z0.afb.join(), "zurück an die alte Stelle gelegt ändert die Liste nicht", z1.sage);

    /* 3 · Kachel in der Rubrik */
    await p.evaluate(() => { LO_GEAENDERT = false; });
    const rb0 = await hubRubriken(p);
    const tisch = rb0.find(r => r.auf === "Jetzt am Tisch");
    pruef(tisch && tisch.kachel.length >= 3, "Voraussetzung: die Rubrik „Jetzt am Tisch“ hat mindestens drei Kacheln", tisch && tisch.kachel.join(", "));
    const [k1, k2, k3] = tisch.kachel;
    /* Breite Kachel (Zeile) → hinter sie heißt „untere Hälfte“, schmale (Raster) → „rechte Hälfte“ — wie der Hub rechnet (> 60 % der Reihe) */
    const breitDe = sel => p.evaluate(sel => { const k = hvAlle().gestalten.frame.contentDocument.querySelector(sel); return k.getBoundingClientRect().width > k.parentElement.getBoundingClientRect().width * 0.6; }, sel);
    const hinter = async sel => (await breitDe(sel)) ? { fy: 0.85 } : { fx: 0.85 };
    const zg2 = await ziehZu(p, 'a.kachel[data-kachel="' + k1 + '"]', 'a.kachel[data-kachel="' + k3 + '"]', await hinter('a.kachel[data-kachel="' + k3 + '"]'));
    pruef(zg2.ok, "Voraussetzung: erste Kachel liegt im Bild beim Greifen", zg2.grund || zg2.schritte + " Schritte");
    const rb1 = await hubRubriken(p), bk1 = await boardKacheln(p);
    const tisch1 = rb1.find(r => r.auf === "Jetzt am Tisch").kachel;
    pruef(tisch1.indexOf(k1) > 0 && tisch1.indexOf(k1) >= tisch.kachel.indexOf(k3) - 1 && tisch1.length === tisch.kachel.length,
          "die Kachel steht im Hub an der neuen Stelle derselben Rubrik", tisch.kachel.join(",") + " → " + tisch1.join(","));
    const tischBoard = bk1.filter(x => /\|Jetzt am Tisch$/.test(x)).map(x => x.split("|")[0]);
    pruef(tischBoard.join() === tisch1.join(), "Reihenfolge im Board (KACHELSTAND) = Reihenfolge im Hub", tischBoard.join(","));
    pruef(bk1.length === 13 || bk1.length >= 10, "keine Kachel geht verloren", String(bk1.length));
    pruef((await zustand(p)).geaendert, "Board merkt die Änderung");

    /* 3b · in eine ANDERE Rubrik */
    const bkVor = await boardKacheln(p);
    const wlan = tisch1[0];
    const karte = rb1.find(r => r.auf === "Die Karte").kachel;
    const zielKachel = karte[1];
    const zg3 = await ziehZu(p, 'a.kachel[data-kachel="' + wlan + '"]', 'a.kachel[data-kachel="' + zielKachel + '"]', await hinter('a.kachel[data-kachel="' + zielKachel + '"]'));
    pruef(zg3.ok, "Voraussetzung: die Kachel liegt beim Greifen im Bild", zg3.grund || zg3.schritte + " Schritte");
    const rb2 = await hubRubriken(p), bk2 = await boardKacheln(p);
    pruef(rb2.find(r => r.auf === "Die Karte").kachel.includes(wlan) && !rb2.find(r => r.auf === "Jetzt am Tisch").kachel.includes(wlan),
          "die Kachel wechselt im Hub die Rubrik", rb2.map(r => r.auf + ":" + r.kachel.length).join(" | "));
    pruef(bk2.includes(wlan + "|Die Karte"), "im Board hängt die Kachel jetzt an der Rubrik „Die Karte“ (kbGruppeVon)", bk2.find(x => x.startsWith(wlan + "|")));
    pruef(bk2.length === bkVor.length, "es sind weiter alle Kacheln da");
    const roh = await p.evaluate(wl => kbRoh().find(e => e.schluessel === wl), wlan);
    pruef(roh && roh.gruppe === "Die Karte", "kbRoh() schickt das Feld „gruppe“ mit dem Rubriknamen", JSON.stringify(roh));
    const nachbarn = await p.evaluate(() => KACHELSTAND.filter(k => kbGruppeVon(k.schluessel) === "Die Karte").map(k => k.schluessel));
    pruef(nachbarn.join() === rb2.find(r => r.auf === "Die Karte").kachel.join(), "Reihenfolge der Rubrik im Board = Hub", nachbarn.join(","));
    /* Rubriken bleiben zusammen (kbRubrikenZusammenhalten) */
    const zerfall = await p.evaluate(() => { const g = KACHELSTAND.map(k => kbGruppeVon(k.schluessel)), gesehen = new Set(); let bruch = false, vorn = null;
      g.forEach(x => { if(x !== vorn){ if(gesehen.has(x)) bruch = true; gesehen.add(x); vorn = x; } }); return bruch; });
    pruef(zerfall === false, "keine Rubrik zerfällt in der Liste");

    /* 4 · Tippen öffnet die Einstellungen */
    await p.evaluate(() => { kbOffen.clear(); AFB_OFFEN.clear(); kbZeichnen(); });
    const vt = await ort(p, 'a.kachel[data-kachel="speisekarte"]');
    const urlVor = await p.evaluate(() => hvAlle().gestalten.frame.contentWindow.location.hash);
    await p.mouse.move(vt.x, vt.y); await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up(); await p.waitForTimeout(500);
    const tipp = await p.evaluate(() => ({ offen: kbOffen.has("speisekarte"), zeile: !!document.querySelector('[data-kb="speisekarte"]'), sage: document.getElementById("loSage").textContent,
                                          hash: hvAlle().gestalten.frame.contentWindow.location.hash }));
    pruef(tipp.offen && tipp.zeile && /Geöffnet/.test(tipp.sage), "Tipp auf eine Kachel öffnet ihre Einstellungen im Board", tipp.sage);
    pruef(tipp.hash === urlVor, "und der Hub bleibt auf der Startseite (kein Sprung zur Karte)", urlVor + " → " + tipp.hash);
    pruef(!(await p.evaluate(() => document.getElementById("loAlt").open)), "ohne die alte Anordnung aufzuklappen");
    const bl = (await hubReihe(p))[1];
    const vb = await ort(p, '[data-sblock="' + bl + '"]');
    await p.mouse.move(vb.x, vb.y); await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up(); await p.waitForTimeout(500);
    const tippB = await p.evaluate(b => ({ offen: AFB_OFFEN.has(b), zeile: !!document.querySelector('[data-afb="' + CSS.escape(b) + '"]'), sage: document.getElementById("loSage").textContent }), bl);
    pruef(tippB.offen && tippB.zeile && /Geöffnet/.test(tippB.sage), "Tipp auf eine Fläche öffnet ihre Einstellungen im Aufbau", bl + " · " + tippB.sage);
    const aend = await zustand(p);
    pruef(aend.afb.join() === (await zustand(p)).afb.join(), "ein Tipp ändert die Ordnung nicht");

    /* 6 · Übernehmen schreibt BEIDE Stände */
    await p.evaluate(() => {
      window.__schrieb = []; demo = false; betriebId = "b1"; meineBetriebe = [{ id: "b1", name: "Probe", rolle: "inhaber", slug: "blend" }];
      window.__lesen = { data: { hub_bloecke: null }, error: null };
      db = { from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(window.__lesen) }) }),
        update: daten => { window.__schrieb.push(daten);
          const o = { select: () => Promise.resolve({ data: [{ id: "b1" }], error: null }), then: (f, g) => Promise.resolve({ error: null }).then(f, g) };
          return { eq: () => o }; } }) };
      AFBGESPEICHERT = [];
    });
    await p.evaluate(() => document.getElementById("loSichern").click()); await p.waitForTimeout(700);
    const sp = await p.evaluate(() => ({ s: window.__schrieb.map(d => Object.keys(d).join()), g: LO_GEAENDERT, sage: document.getElementById("loSage").textContent }));
    pruef(sp.s.includes("hub_bloecke") && sp.s.includes("hub_kacheln") && sp.s.length === 2, "„Ordnung übernehmen“ schreibt hub_bloecke UND hub_kacheln (je einmal)", sp.s.join(" | "));
    pruef(sp.g === false && /Übernommen/.test(sp.sage), "danach gilt die Ordnung als übernommen", sp.sage);
    const kz = await p.evaluate(() => window.__schrieb.find(d => d.hub_kacheln).hub_kacheln.find(e => e.schluessel === "wlan"));
    pruef(kz && kz.gruppe === "Die Karte", "die verschobene Kachel trägt ihre neue Rubrik in der Nutzlast", JSON.stringify(kz));

    /* Beenden räumt auf */
    await p.evaluate(() => document.getElementById("loAn").click()); await p.waitForTimeout(700);
    const ende = await p.evaluate(() => { const d = hvAlle().gestalten.frame.contentDocument;
      return { klasse: d.documentElement.classList.contains("ordnen"), schilder: d.querySelectorAll("[data-ordnen-name]").length, an: LO_AN, rahmen: document.querySelector(".gh-vorschau").className }; });
    pruef(!ende.klasse && !ende.an && !/\bordnen\b/.test(ende.rahmen), "„Ordnen beenden“ nimmt den Modus aus Hub und Rahmen", JSON.stringify(ende));
    pruef(ende.schilder >= 0 && await p.evaluate(() => { const d = hvAlle().gestalten.frame.contentDocument; return !d.querySelector(".ordnen-hebt"); }), "und nichts bleibt gehoben");
    /* Nach dem Beenden bedient ein Tipp den Hub wieder normal */
    pruef(echt(pf).length === 0, "keine Skriptfehler", echt(pf).join(" | "));
    await ctx.close();
  }

  /* ── Finger ───────────────────────────────────────────────────── */
  console.log("\n══ Live ordnen mit dem Finger (CDP-Touch) ══");
  {
    const { ctx, p, pf, da } = await oeffne(br, "blend", { finger: true });
    pruef(da, "Voraussetzung: die Unterseite „Kacheln“ ist offen");
    await p.click("#loAn"); await p.waitForTimeout(1200);
    const cdp = await ctx.newCDPSession(p);
    const touch = async (typ, x, y) => cdp.send("Input.dispatchTouchEvent", { type: typ, touchPoints: typ === "touchEnd" ? [] : [{ x, y, id: 1 }] });
    const reihe0 = await hubReihe(p);
    pruef(reihe0.length >= 4, "Voraussetzung: mindestens vier Flächen", reihe0.join(" › "));
    const a = reihe0[0], b = reihe0[1];
    const va = await ort(p, '[data-sblock="' + a + '"]');
    pruef(va && va.imBild, "Voraussetzung: erste Fläche im Bild");

    /* früher Zug (vor 260 ms): rollt, ordnet nicht */
    await touch("touchStart", va.x, va.y); await touch("touchMove", va.x, va.y + 14); await touch("touchMove", va.x, va.y + 40); await warte(400); await touch("touchEnd");
    await p.waitForTimeout(400);
    const frueh = await p.evaluate(() => { const d = hvAlle().gestalten.frame.contentDocument; return { hebt: !!d.querySelector(".ordnen-hebt"), gez: d.documentElement.classList.contains("ordnen-zieht") }; });
    pruef(!frueh.hebt && !frueh.gez, "ein Zug VOR 260 ms hebt nichts (der Finger rollt die Vorschau)", JSON.stringify(frueh));
    pruef((await hubReihe(p)).join() === reihe0.join(), "und die Reihenfolge bleibt");

    /* Halten (300 ms), dann Zug unter die zweite Fläche */
    await ort(p, '[data-sblock="' + a + '"]');   /* a in die Mitte rollen; danach nichts mehr rollen */
    const va2 = await messe(p, '[data-sblock="' + a + '"]'), vb2 = await messe(p, '[data-sblock="' + b + '"]');
    await touch("touchStart", va2.x, va2.y); await warte(340);
    const gehoben = await p.evaluate(() => { const d = hvAlle().gestalten.frame.contentDocument; return { hebt: !!d.querySelector(".ordnen-hebt"), gez: d.documentElement.classList.contains("ordnen-zieht") }; });
    pruef(gehoben.hebt && gehoben.gez, "nach 340 ms Halten hebt sich die Fläche unter dem Finger", JSON.stringify(gehoben));
    const sy0 = await p.evaluate(() => window.scrollY);
    const ziel = { x: vb2.x, y: vb2.y + vb2.h * 0.35 };   /* vb2.y = Mitte von b; darunter heißt dahinter */
    for(let i = 1; i <= 12; i++) await touch("touchMove", va2.x + (ziel.x - va2.x) * i / 12, va2.y + (ziel.y - va2.y) * i / 12);
    await warte(150);
    const sy1 = await p.evaluate(() => window.scrollY);
    await touch("touchEnd"); await p.waitForTimeout(800);
    pruef(Math.abs(sy1 - sy0) < 6, "während des Ziehens rollt die Seite nicht mit", sy0 + " → " + sy1);
    const reihe1 = await hubReihe(p);
    pruef(reihe1[0] === b && reihe1[1] === a, "mit dem Finger gezogen: die Fläche steht hinter der zweiten", reihe1.join(" › "));
    pruef((await zustand(p)).geaendert, "Board merkt die Änderung");

    /* Halten ohne Zug = Tipp */
    await p.evaluate(() => { AFB_OFFEN.clear(); });
    const v3 = await ort(p, '[data-sblock="' + reihe1[2] + '"]');
    await touch("touchStart", v3.x, v3.y); await warte(120); await touch("touchEnd"); await p.waitForTimeout(500);
    const tipp = await p.evaluate(id => ({ offen: AFB_OFFEN.has(id), sage: document.getElementById("loSage").textContent }), reihe1[2]);
    pruef(tipp.offen, "ein kurzer Fingertipp öffnet die Einstellungen der Fläche", tipp.sage);
    pruef((await hubReihe(p)).join() === reihe1.join(), "und ändert die Ordnung nicht");
    /* Kachel mit dem Finger: Halten, dann in die andere Rubrik */
    const rb = await hubRubriken(p);
    const qk = rb.find(r => r.auf === "Jetzt am Tisch").kachel[0], zr = rb.find(r => r.auf === "Die Karte").kachel[0];
    await ort(p, 'a.kachel[data-kachel="' + qk + '"]');
    const qa = await messe(p, 'a.kachel[data-kachel="' + qk + '"]');
    await touch("touchStart", qa.x, qa.y); await warte(340);
    for(let i = 0; i < 80; i++){
      const zz = await messe(p, 'a.kachel[data-kachel="' + zr + '"]', { fy: 0.85 });
      const y = Math.max(zz.hoch + 8, Math.min(zz.y, zz.tief - 8));
      await touch("touchMove", zz.x, y);
      if(Math.abs(zz.y - y) < 2) break;
      await warte(40);
    }
    await touch("touchEnd"); await p.waitForTimeout(800);
    const rb2 = await hubRubriken(p);
    pruef(rb2.find(r => r.auf === "Die Karte").kachel.includes(qk) && await p.evaluate(k => kbGruppeVon(k) === "Die Karte", qk),
          "eine Kachel mit dem Finger in eine andere Rubrik gezogen: Hub UND Board stimmen", rb2.map(r => r.auf + ":" + r.kachel.length).join(" | "));
    /* Der Browser darf mit der Maus kein eigenes Link-Ziehen beginnen (sonst bricht unser Zeiger ab) */
    const ds = await p.evaluate(() => { const d = hvAlle().gestalten.frame.contentDocument, k = d.querySelector("a.kachel[data-kachel]");
      const ev = new (hvAlle().gestalten.frame.contentWindow.Event)("dragstart", { bubbles:true, cancelable:true }); k.dispatchEvent(ev);
      return { verhindert: ev.defaultPrevented, zeiger: getComputedStyle(k).webkitUserDrag || getComputedStyle(k).getPropertyValue("-webkit-user-drag") }; });
    pruef(ds.verhindert, "im Ordnen-Modus wird das eigene Ziehen des Browsers an Links verhindert (dragstart)", JSON.stringify(ds));
    pruef(echt(pf).length === 0, "keine Skriptfehler", echt(pf).join(" | "));
    await ctx.close();
  }

  /* ── Reduzierte Bewegung ─────────────────────────────────────── */
  console.log("\n══ Reduzierte Bewegung ══");
  {
    const ctx = await br.newContext({ viewport:{ width:430, height:1000 }, reducedMotion:"reduce" });
    const p = await ctx.newPage(); const pf = [];
    p.on("pageerror", e => pf.push(String(e).slice(0, 160)));
    await p.addInitScript(b => { window.HUB_VORSCHAU_BASIS = b; Element.prototype.requestFullscreen = () => Promise.resolve(); }, BASIS);
    await p.route("**/*", r => { const u = r.request().url(); if(u.startsWith("file://")) return r.continue();
      if(u.startsWith(BASIS)) return r.fulfill({ status:200, contentType:"text/html; charset=utf-8", headers:{ "Access-Control-Allow-Origin":"*" }, body: fs.readFileSync(path.join(OBEN, "dist", "blend", "index.html"), "utf8") });
      return r.fulfill({ status:200, contentType:"application/json", headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" }); });
    await p.goto(ADMIN); await p.waitForTimeout(900);
    await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); zeichneAlles(); });
    await p.waitForTimeout(300); await p.evaluate(() => tafelZeigen("startseite")); await p.waitForTimeout(300);
    await gruppeZu(p, "#gh-kacheln"); await p.waitForTimeout(2500);
    await p.click("#loAn"); await p.waitForTimeout(1200);
    const r0 = await hubReihe(p);
    /* Während des Ziehens zählen laufende Übergänge im Rahmen — mitten in der Geste gemessen, nicht danach */
    const v = await ort(p, '[data-sblock="' + r0[1] + '"]');
    await p.mouse.move(v.x, v.y); await p.mouse.down(); await p.mouse.move(v.x + 3, v.y - 14, { steps: 3 });
    const anim = await p.evaluate(() => hvAlle().gestalten.frame.contentWindow.document.getAnimations().filter(a => a.transitionProperty).length);
    await p.mouse.up(); await p.waitForTimeout(300);
    await ziehZu(p, '[data-sblock="' + r0[1] + '"]', '[data-sblock="' + r0[0] + '"]', { fy: 0.1 });
    const r1 = await hubReihe(p);
    pruef(r1[0] === r0[1], "auch ohne Bewegung lässt sich ordnen (Endstand stimmt)", r1.join(" › "));
    pruef(anim === 0 || anim === undefined, "reduzierte Bewegung: keine laufende Übergangs-Animation während des Ziehens", String(anim));
    pruef(pf.length === 0, "keine Skriptfehler", pf.join(" | "));
    await ctx.close();
  }

  /* ── Team darf nicht ordnen ──────────────────────────────────── */
  console.log("\n══ Team ══");
  {
    const { ctx, p, pf } = await oeffne(br, "blend");
    await p.evaluate(() => rolleAnwenden("team")); await p.waitForTimeout(300);
    const t = await p.evaluate(() => { const k = document.getElementById("loAn"); const g = k && k.closest("[data-nur-inhaber]");
      return { rolle: document.body.dataset.rolle, gruppe: !!g, gesperrt: !!(k && k.closest("[inert]")) }; });
    pruef(t.rolle === "team" && t.gruppe, "Voraussetzung: Team-Konto, „Ordnen starten“ liegt in einer Besitzer-Gruppe", JSON.stringify(t));
    pruef(t.gesperrt, "Team: der Bereich ist gesperrt (inert)", JSON.stringify(t));
    /* echter Tipp auf die Stelle des Knopfs: er darf nichts tun (gemessen, was ein Finger trifft, §3.9) */
    const pos = await p.evaluate(() => { const k = document.getElementById("loAn"); k.scrollIntoView({ block:"center" }); const r = k.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(300);
    pruef(await p.evaluate(() => LO_AN === false && document.getElementById("loAn").getAttribute("aria-pressed") === "false"), "und ein Tipp darauf schaltet nichts ein");
    await ctx.close();
  }

  await br.close();
  console.log(fehler ? "\n✗ " + fehler + " Fehler." : "\nAlles sauber.");
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
