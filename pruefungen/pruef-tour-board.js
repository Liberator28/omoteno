/* ═══════════════════════════════════════════════════════════════
   pruef-tour-board.js — Tour und Wiki „Anleitung“ im Board (Wunsch 25.10.)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-tour-board.js
     Gegenbeweise: ADMIN_DATEI=<Pfad zu einer Kopie von seiten/admin.html>

   Der geteilte Block TOUR selbst und der Hub-Teil stehen in pruef-tour.js. Hier:

   1 · Das Wiki hält sich an das Board (zweite Quelle = das Board): jede Beschriftung, auf die ein Text sich beruft (`labels`), steht im
       Board; jede Gruppe und jeder Reiter, auf den ein Eintrag zeigt, gibt es; jede Gruppe der Einstellungen und des Gast-Hubs wird
       erklärt (Ausnahmen namentlich); jeder Reiter der unteren Leiste hat einen Bereich in der Tour. Ein umbenannter Knopf macht die
       Anleitung rot, nicht still falsch.
   2 · Das Wiki bedient sich mit echten Tipps: Kachel „Anleitung“ öffnet die Gruppe, Suche, Kapitel, Aufklappen (≥ 44 px), „Dorthin
       springen“ öffnet GENAU die genannte Gruppe, „Im Board zeigen“ startet die Tour im richtigen Bereich; ohne Treffer ein Satz.
   3 · Die Tour: jeder Schritt jedes Bereichs — Loch um das Ziel, Karte ganz im Bild und nicht auf dem Loch, Leiste nicht auf dem
       Ziel; Wischen mit Maus und Finger; Escape; nach dem Ende wieder am Ausgangsort (und in der offenen Gruppe).
   4 · Farben, Bewegung (nur transform/opacity, reduzierte Bewegung), 390 und 1280 px, keine Skriptfehler.
   Ehrliche Grenze: kopfloses Chromium, kein Gerät; Vorführmodus des Boards (gestellte Beispieldaten), nicht gegen die echte Datenbank.
   ═══════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { kontrast } = require("./werkzeug/messen.js");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");
const QUELLEN = [ADMIN, path.join(OBEN, "seiten", "kueche.html"), path.join(OBEN, "seiten", "einkauf.html")].filter(p => fs.existsSync(p));
let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if(!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };

/* Gruppen, die kein eigener Wiki-Eintrag sein müssen: die Übersichten, diese Gruppe selbst, „Dieses Gerät“ (steht im Eintrag „Betrieb, Gerät …“) */
const OHNE_EINTRAG = ["Einstellungen", "Gast-Hub gestalten", "Anleitung", "Dieses Gerät"];
/* Schritte, bei denen es im Vorführboard ein Ziel geben MUSS (zweite Quelle: so sieht das Board aus, nicht die Tour). Ein falscher Selektor ließe sonst
   den Schritt still ohne Loch stehen — und die Prüfung maße das Ziel mit demselben falschen Selektor (§8.1g C). */
const MUSS_LOCH = ["Bestellstopp", "Team-Modus", "Alle oder Außer Haus", "Woher sie kommen", "Wie weit sie sind", "Bestellung annehmen", "Welche Karte", "Karte aktiv", "Anlegen und einlesen",
  "Suchen", "Verfügbar", "Top-Runner", "Gericht finden", "Alle wieder an", "Am Tisch · jetzt", "Zeitraum", "Auf einen Blick", "Was in die Liste soll", "Datei oder Druck", "Alles, was Gäste sehen",
  "Einstellungen", "Die Anleitung", "Einkauf & Kosten"];

const farbe = s => { let m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?/.exec(s); if(m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  m = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?/.exec(s); if(m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : +m[4]]; return null; };
const schneidet = (a, b, tol) => a && b && a.l < b.r - (tol || 0) && a.r > b.l + (tol || 0) && a.t < b.b - (tol || 0) && a.b > b.t + (tol || 0);
const szene = () => {
  const r = e => { if(!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const w = document.getElementById("tourWurzel"); if(!w) return null;
  const karte = w.querySelector(".tour-karte");
  return { loch: r(w.querySelector(".tour-loch")), karte: r(karte), zeile: r(w.querySelector(".tour-zeile")), punkte: r(w.querySelector(".tour-punkte")),
    hand: w.querySelector(".tour-hand") ? 1 : 0, ohneLoch: w.dataset.ohneloch === "1", kopf: w.dataset.kopf,
    kopfWeg: (() => { const k = getComputedStyle(w.querySelector(".tour-kopf")); return +k.opacity < .05 && k.pointerEvents === "none"; })(), pos: w.dataset.pos,
    geste: (() => { const g = w.querySelector(".tour-geste"); return g && !g.hidden ? g.textContent : ""; })(),
    ueber: karte.scrollHeight > karte.clientHeight + 1, titel: w.querySelector("#tourTitel").textContent, vw: innerWidth, vh: innerHeight, breite: document.documentElement.scrollWidth };
};
const zielRect = (b, s) => `(() => { const st = boardTourDef().bereiche[${b}].schritte[${s}]; for(const sel of [].concat(st.ziel || [])){ let e = null; try{ e = document.querySelector(sel); }catch(x){}
  if(!e) continue; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if(r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none") return { l: r.left, t: r.top, r: r.right, b: r.bottom, sel }; } return null; })()`;

async function oeffnen(browser, breite, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: breite, height: breite < 600 ? 844 : 900 }, reducedMotion: opt.reduziert ? "reduce" : "no-preference" });
  const p = await ctx.newPage(), fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + ADMIN); await p.waitForTimeout(700);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; });
  await p.waitForTimeout(500);
  return { ctx, p, fehler };
}
const ruhe = p => p.waitForTimeout(950);

/* ── 1 · Wiki gegen das Board ──────────────────────────────────── */
async function quellProbe(browser){
  console.log("\n══ 1 · Das Wiki hält sich an das Board ══");
  const b = await oeffnen(browser, 390), p = b.p;
  const wiki = await p.evaluate(() => AN_WIKI.map(e => ({ id: e.id, kapitel: e.kapitel, titel: e.titel, laenge: e.text.join(" ").length, labels: e.labels || [], gruppe: e.gruppe || "", tafel: e.tafel || "", tour: e.tour || "" })));
  const kapitel = await p.evaluate(() => AN_KAPITEL);
  const bereiche = await p.evaluate(() => boardTourDef().bereiche.map(x => x.id));
  pruef(wiki.length >= 35, "Voraussetzung: das Wiki hat mindestens 35 Abschnitte", String(wiki.length));
  pruef(new Set(wiki.map(e => e.id)).size === wiki.length && new Set(wiki.map(e => e.titel)).size === wiki.length, "jede Kennung und jeder Titel kommt einmal vor");
  pruef(wiki.every(e => kapitel.includes(e.kapitel)), "jeder Abschnitt gehört zu einem bekannten Kapitel", wiki.filter(e => !kapitel.includes(e.kapitel)).map(e => e.id).join(","));
  pruef(kapitel.every(k => wiki.some(e => e.kapitel === k)), "jedes Kapitel hat Abschnitte");
  pruef(wiki.every(e => e.laenge >= 80), "jeder Abschnitt erklärt etwas (mindestens 80 Zeichen)", wiki.filter(e => e.laenge < 80).map(e => e.id).join(","));
  /* Beschriftungen: stehen im Board (oder in Küche/Einkauf) — AUSSERHALB der Wiki-Daten selbst, sonst fände sich jedes Wort in sich selbst */
  const quelle = QUELLEN.map(q => fs.readFileSync(q, "utf8")).join("\n");
  const a = quelle.indexOf("const AN_WIKI = ["), z = quelle.indexOf("/* ── Wiki: zeichnen, suchen, springen ── */");
  pruef(a > 0 && z > a, "Voraussetzung: die Wiki-Daten sind als Block auffindbar", a + " … " + z);
  const ohneWiki = quelle.slice(0, a) + quelle.slice(z);
  const fehlt = [];
  wiki.forEach(e => e.labels.forEach(l => { if(!ohneWiki.includes(l) && !ohneWiki.includes(l.replace(/&/g, "&amp;"))) fehlt.push(e.id + ": „" + l + "“"); }));
  pruef(wiki.reduce((s, e) => s + e.labels.length, 0) >= 120, "Voraussetzung: mindestens 120 Beschriftungen werden gegen das Board gehalten", String(wiki.reduce((s, e) => s + e.labels.length, 0)));
  pruef(fehlt.length === 0, "jede Beschriftung, auf die sich ein Text beruft, steht im Board", fehlt.slice(0, 6).join(" | "));
  /* Ziele */
  const gruppen = await p.evaluate(() => [...document.querySelectorAll("#t-einstellungen > .egruppe, #t-startseite > .egruppe")].map(g => { const h = g.querySelector("h2.etitel"); return h ? h.textContent.trim() : ""; }).filter(Boolean));
  const fehlGruppe = wiki.filter(e => e.gruppe && !gruppen.includes(e.gruppe)).map(e => e.id + ": " + e.gruppe);
  pruef(fehlGruppe.length === 0, "jede Gruppe, auf die ein Abschnitt zeigt, gibt es im Board", fehlGruppe.join(" | "));
  const tafeln = await p.evaluate(() => [...document.querySelectorAll(".tafel")].map(t => t.id.replace(/^t-/, "")));
  pruef(wiki.every(e => !e.tafel || tafeln.includes(e.tafel)), "jeder Reiter, auf den ein Abschnitt zeigt, ist ein Reiter des Boards", wiki.filter(e => e.tafel && !tafeln.includes(e.tafel)).map(e => e.tafel).join(","));
  pruef(wiki.every(e => !e.tour || bereiche.includes(e.tour)), "jeder Bereich, den „Im Board zeigen“ ansteuert, steht in der Tour", wiki.filter(e => e.tour && !bereiche.includes(e.tour)).map(e => e.tour).join(","));
  /* Vollständigkeit: jede Gruppe wird erklärt (zweite Quelle: die Gruppen im Board) */
  const erklaert = new Set(wiki.map(e => e.gruppe).filter(Boolean));
  const offen = gruppen.filter(g => !erklaert.has(g) && !OHNE_EINTRAG.includes(g));
  pruef(gruppen.length >= 25, "Voraussetzung: das Board hat mindestens 25 Gruppen (Einstellungen und Gast-Hub)", String(gruppen.length));
  pruef(offen.length === 0, "jede Gruppe der Einstellungen und des Gast-Hubs hat einen erklärenden Abschnitt (Ausnahmen namentlich)", offen.join(", "));
  /* Reiter der unteren Leiste ↔ Bereiche der Tour */
  const reiter = await p.evaluate(() => [...new Set([...document.querySelectorAll("#befehlsleiste [data-tafel], #mehrfach [data-tafel]")].map(x => x.dataset.tafel))]);
  const zuBereich = { bestellungen: "bestellungen", speisekarte: "karte", reservierungen: "tische", auswertung: "zahlen", ausgabe: "ausgabe", verfuegbar: "verfuegbar", startseite: "gasthub", einstellungen: "einstellungen" };
  const unbekannt = reiter.filter(r => !zuBereich[r]);
  pruef(reiter.length >= 8, "Voraussetzung: die Leiste hat mindestens acht Reiter", reiter.join(","));
  pruef(unbekannt.length === 0, "jeder Reiter der Leiste ist einem Bereich der Tour zugeordnet", unbekannt.join(","));
  pruef(reiter.every(r => !zuBereich[r] || bereiche.includes(zuBereich[r])), "und dieser Bereich steht in der Tour", reiter.filter(r => zuBereich[r] && !bereiche.includes(zuBereich[r])).join(","));
  pruef(bereiche.includes("einkauf"), "der Einkauf (eigene Seite) hat einen Bereich in der Tour");
  /* Kachel in den Einstellungen (jede Gruppe = eine Kachel, Gegenstück zu pruef-zentrale) */
  const kachel = await p.evaluate(() => !!document.querySelector('#t-einstellungen [data-eu-seite="anGruppe"]'));
  pruef(kachel, "unter Einstellungen gibt es die Kachel „Anleitung“");
  pruef(b.fehler.length === 0, "keine Skriptfehler", b.fehler.join(" | "));
  await b.ctx.close();
}

/* ── 2 · Das Wiki bedienen ─────────────────────────────────────── */
async function wikiProbe(browser, breite){
  console.log("\n══ 2 · Das Wiki bedienen · " + breite + " px ══");
  const b = await oeffnen(browser, breite), p = b.p;
  /* Zugang wie ein Mensch: Einstellungen → Kachel */
  await p.evaluate(() => tafelZeigen("einstellungen")); await p.waitForTimeout(500);
  const h0 = await p.evaluate(() => { const k = document.querySelector('#t-einstellungen [data-eu-seite="anGruppe"]'); if(!k) return null; const r = k.getBoundingClientRect(); return { h: r.height, w: r.width }; });
  pruef(h0 && h0.h >= 44, "die Kachel „Anleitung“ ist antippbar (≥ 44 px)", JSON.stringify(h0));
  await p.click('#t-einstellungen [data-eu-seite="anGruppe"]'); await p.waitForTimeout(500);
  const offen = await p.evaluate(() => { const g = document.getElementById("anGruppe"); const cs = getComputedStyle(g); return { an: g.classList.contains("eu-jetzt"), sicht: cs.display !== "none", h2: g.querySelector("h2.etitel").textContent }; });
  pruef(offen.an && offen.sicht && offen.h2 === "Anleitung", "ein Tipp auf die Kachel öffnet die Gruppe „Anleitung“", JSON.stringify(offen));
  const anzahl = await p.evaluate(() => document.querySelectorAll("#anListe .an-abschnitt").length);
  const gesamt = await p.evaluate(() => AN_WIKI.length);
  pruef(anzahl === gesamt, "alle Abschnitte stehen in der Liste", anzahl + " / " + gesamt);
  pruef((await p.evaluate(() => document.getElementById("anZahl").textContent)) === gesamt + " Abschnitte", "die Zahl über der Liste stimmt");
  /* Aufklappen */
  const sum = await p.evaluate(() => [...document.querySelectorAll("#anListe summary")].map(s => s.getBoundingClientRect().height));
  pruef(sum.length === gesamt && sum.every(h => h >= 44), "jede Zeile ≥ 44 px hoch", Math.min(...sum).toFixed(0));
  const zu = await p.evaluate(() => [...document.querySelectorAll("#anListe .an-abschnitt")].filter(d => !d.open).length);
  pruef(zu === gesamt - 1, "in der Ruhelage ist genau ein Abschnitt offen (der erste Schritt)", String(gesamt - zu));
  await p.click('#an-reiter > summary'); await p.waitForTimeout(250);
  pruef(await p.evaluate(() => document.getElementById("an-reiter").open), "ein Tipp auf die Zeile klappt sie auf");
  await p.click('#an-reiter > summary'); await p.waitForTimeout(250);
  pruef(!(await p.evaluate(() => document.getElementById("an-reiter").open)), "und beim zweiten Tipp wieder zu");
  /* Suche */
  await p.fill("#anSuche", "pausieren"); await p.waitForTimeout(250);
  let t = await p.evaluate(() => ({ n: document.querySelectorAll("#anListe .an-abschnitt").length, ids: [...document.querySelectorAll("#anListe .an-abschnitt")].map(d => d.dataset.anId), offen: [...document.querySelectorAll("#anListe .an-abschnitt")].every(d => d.open), z: document.getElementById("anZahl").textContent }));
  pruef(t.n >= 1 && t.n < gesamt && t.ids.includes("pause"), "die Suche „pausieren“ findet den Bestellstopp und nicht alles", JSON.stringify(t.ids));
  pruef(t.offen, "Treffer stehen aufgeklappt da");
  pruef(/ von /.test(t.z), "die Zahl sagt „n von m Abschnitten“", t.z);
  await p.fill("#anSuche", "xyzzyqq"); await p.waitForTimeout(250);
  pruef((await p.evaluate(() => document.querySelector("#anListe .an-leer") ? document.querySelector("#anListe .an-leer").textContent : "")).includes("Dazu steht nichts"), "ohne Treffer steht ein Satz statt einer leeren Fläche");
  await p.fill("#anSuche", ""); await p.waitForTimeout(250);
  /* Kapitel */
  await p.click('[data-an-kap="Einstellungen"]'); await p.waitForTimeout(250);
  t = await p.evaluate(() => ({ kap: [...new Set([...document.querySelectorAll("#anListe .an-abschnitt")].map(d => AN_WIKI.find(e => e.id === d.dataset.anId).kapitel))], gedrueckt: document.querySelector('[data-an-kap="Einstellungen"]').getAttribute("aria-pressed") }));
  pruef(t.kap.length === 1 && t.kap[0] === "Einstellungen" && t.gedrueckt === "true", "ein Kapitel-Chip zeigt nur dieses Kapitel", JSON.stringify(t));
  await p.click('[data-an-kap=""]'); await p.waitForTimeout(250);
  pruef((await p.evaluate(() => document.querySelectorAll("#anListe .an-abschnitt").length)) === gesamt, "„Alle“ zeigt wieder jeden Abschnitt");
  /* Aufgeklappt bleibt aufgeklappt, auch nach einem Neuzeichnen */
  await p.click('#an-pause > summary'); await p.waitForTimeout(200);
  await p.click('[data-an-kap="Tagesgeschäft"]'); await p.waitForTimeout(200); await p.click('[data-an-kap=""]'); await p.waitForTimeout(250);
  pruef(await p.evaluate(() => document.getElementById("an-pause").open), "was der Leser aufgeklappt hat, bleibt nach dem Wechsel des Kapitels offen");
  /* Dorthin springen: öffnet GENAU die genannte Gruppe */
  const springe = async (id, erwartet) => {
    await p.evaluate(() => { tafelZeigen("einstellungen"); euOeffnen("anGruppe"); }); await p.waitForTimeout(300);
    await p.evaluate(i => { const d = document.getElementById("an-" + i); d.open = true; }, id); await p.waitForTimeout(150);
    await p.click('#an-' + id + ' [data-an-oeffnen]'); await p.waitForTimeout(500);
    const ort = await p.evaluate(() => { const g = document.querySelector(".tafel:not([hidden]) > .egruppe.eu-jetzt"); const h = g && g.querySelector("h2.etitel"); const tafel = document.querySelector(".tafel:not([hidden])"); return { tafel: tafel && tafel.id, gruppe: h ? h.textContent.trim() : "" }; });
    pruef(ort.gruppe === erwartet, "„Dorthin springen“ bei „" + id + "“ öffnet die Gruppe „" + erwartet + "“", JSON.stringify(ort));
  };
  /* „Bezahlen“ (e-bezahlen) ist seit 26.10. abgeschaltet und fehlt in Board und Anleitung (pruef-zahlung-board.js: „Ausgeliefert: AUS“). */
  await springe("gh-farben", "Farben des Hubs");
  await springe("e-lieferung", "Lieferung");
  /* Reiter-Sprung */
  await p.evaluate(() => { tafelZeigen("einstellungen"); euOeffnen("anGruppe"); }); await p.waitForTimeout(300);
  await p.evaluate(() => { document.getElementById("an-verfuegbar").open = true; }); await p.click("#an-verfuegbar [data-an-oeffnen]"); await p.waitForTimeout(500);
  pruef(await p.evaluate(() => !document.getElementById("t-verfuegbar").hidden), "„Dorthin springen“ bei „Verfügbar schalten“ zeigt den Reiter Verfügbar");
  /* Im Board zeigen → Tour im richtigen Bereich */
  await p.evaluate(() => { tafelZeigen("einstellungen"); euOeffnen("anGruppe"); }); await p.waitForTimeout(300);
  await p.evaluate(() => { document.getElementById("an-zahlen").open = true; }); await p.click("#an-zahlen [data-an-zeigen]"); await ruhe(p);
  const akt = await p.evaluate(() => TOUR.laeuft() ? document.querySelector(".tour-chip[aria-current=step]").textContent : null);
  pruef(akt === "Zahlen", "„Im Board zeigen“ bei „Zahlen“ startet die Tour im Bereich „Zahlen“", String(akt));
  await p.keyboard.press("Escape"); await p.waitForTimeout(700);
  const zurueck = await p.evaluate(() => ({ tafel: document.querySelector(".tafel:not([hidden])").id, offen: document.getElementById("t-einstellungen").dataset.euOffen || "" }));
  pruef(zurueck.tafel === "t-einstellungen" && zurueck.offen === "anGruppe", "nach dem Ende ist man wieder im Wiki (Reiter und Gruppe wie vorher)", JSON.stringify(zurueck));
  pruef(b.fehler.length === 0, "keine Skriptfehler", b.fehler.join(" | "));
  await b.ctx.close();
}

/* ── 3 · Jeder Schritt ─────────────────────────────────────────── */
async function schrittProbe(browser, breite){
  console.log("\n══ 3 · Jeder Schritt der Tour · " + breite + " px ══");
  const b = await oeffnen(browser, breite), p = b.p;
  await p.evaluate(() => boardTourStarten("bestellungen")); await ruhe(p);
  const def = await p.evaluate(() => boardTourDef().bereiche.map(x => ({ id: x.id, titel: x.titel, schritte: x.schritte.map(s => ({ titel: s.titel, demo: s.demo || "" })) })));
  const chips = await p.evaluate(() => [...document.querySelectorAll(".tour-chip")].map(c => c.textContent));
  pruef(JSON.stringify(chips) === JSON.stringify(def.map(x => x.titel)), "die Chips oben sind die Bereiche, in dieser Reihenfolge", chips.join(" · "));
  let loecher = 0, schritte = 0;
  for(let bi = 0; bi < def.length; bi++) for(let s = 0; s < def[bi].schritte.length; s++){
    const st = def[bi].schritte[s], tag = " [" + def[bi].titel + " / " + st.titel + "]";
    await p.evaluate(([bi, s]) => TOUR.gehe(bi, s), [bi, s]); await ruhe(p);
    const m = await p.evaluate(szene), z = await p.evaluate(zielRect(bi, s));
    schritte++;
    if(!m){ pruef(false, "Tour läuft noch" + tag); continue; }
    pruef(m.titel === st.titel && !m.ueber, "Karte zeigt den Titel und schneidet nichts ab" + tag, m.titel);
    pruef(m.karte.l >= 0 && m.karte.r <= m.vw + .5 && m.karte.t >= 0 && m.karte.b <= m.vh + .5, "Karte ganz im Bild" + tag, [m.karte.l, m.karte.t, m.karte.r, m.karte.b].map(Math.round).join(","));
    pruef(m.breite <= m.vw, "kein Seitenüberlauf" + tag, m.breite + " / " + m.vw);
    if(MUSS_LOCH.includes(st.titel)) pruef(!!z, "Voraussetzung: das Ziel gibt es im Board" + tag, z ? z.sel : "kein Ziel gefunden");
    if(z){
      loecher++;
      pruef(!m.ohneLoch, "Loch da, weil es ein Ziel gibt" + tag, z.sel);
      if(!m.ohneLoch){
        const t = { l: Math.max(z.l, 4), t: Math.max(z.t, 4), r: Math.min(z.r, m.vw - 4), b: Math.min(z.b, m.vh - 4) };
        pruef(m.loch.l <= t.l + 1 && m.loch.t <= t.t + 1 && m.loch.r >= t.r - 1 && m.loch.b >= t.b - 1, "Loch umschließt das Ziel" + tag, "Loch " + [m.loch.l, m.loch.t, m.loch.r, m.loch.b].map(Math.round) + " Ziel " + [t.l, t.t, t.r, t.b].map(Math.round));
        /* Füllt das Ziel mehr als die Hälfte des Schirms, bleibt für die Karte kein freier Platz: sie liegt dann über dem Ziel — namentlich zugelassen */
        const gross = m.loch.h > m.vh * .5;
        if(!gross) pruef(!schneidet(m.loch, m.karte, 2), "die Karte liegt nicht auf dem Loch" + tag);
        else pruef(true, "Ziel füllt über die Hälfte des Schirms: die Karte darf darüber liegen (zugelassen)" + tag, Math.round(m.loch.h) + " von " + m.vh);
        /* Seit 31.10. springt die Leiste nicht mehr nach unten: liegt das Ziel darunter, tritt sie zurück (durchsichtig, fängt nichts). */
        pruef(m.kopf === "weg" ? m.kopfWeg : (!schneidet(m.loch, m.zeile, 2) && !schneidet(m.loch, m.punkte, 2)), "die Bereichsleiste liegt nicht auf dem Ziel (oder tritt zurück)" + tag, "Leiste " + m.kopf);
        /* Lichtkegel (31.10.): keine Hand, kein Ring — die Geste steht als Wort in der Karte. */
        pruef(m.hand === 0, "keine Hand-Zeichnung am Licht" + tag);
        if(st.demo) pruef(m.geste.length > 1, "die Geste steht als Wort in der Karte" + tag, m.geste);
        else pruef(m.geste === "", "ohne Geste kein Gesten-Wort" + tag, m.geste);
      }
    } else pruef(m.ohneLoch && m.pos === "mitte", "ohne Ziel: Karte in der Mitte, kein Loch" + tag, m.pos + " (Ziele: " + JSON.stringify(await p.evaluate(([bi, s]) => boardTourDef().bereiche[bi].schritte[s].ziel || [], [bi, s])) + ")");
  }
  pruef(loecher >= 22, "mindestens 22 Schritte haben ein echtes Loch", loecher + " von " + schritte);
  pruef(b.fehler.length === 0, "keine Skriptfehler", b.fehler.join(" | "));
  await b.ctx.close();
}

/* ── 4 · Bedienung, Farben, Bewegung ───────────────────────────── */
async function bedienProbe(browser){
  console.log("\n══ 4 · Bedienung mit echten Zeigern, Farben, Bewegung ══");
  const b = await oeffnen(browser, 390), p = b.p;
  const cdp = await b.ctx.newCDPSession(p);
  /* Start über den Eintrag „Anleitung“ unter „Mehr“ */
  await p.evaluate(() => tafelZeigen("speisekarte")); await p.waitForTimeout(400);
  await p.click("#mehrKnopf"); await p.waitForTimeout(300);
  const mt = await p.evaluate(() => { const e = document.getElementById("mehrTour"); const r = e.getBoundingClientRect(); return { h: r.height, sicht: r.width > 0, text: e.textContent.trim() }; });
  pruef(mt.sicht && mt.h >= 44 && mt.text === "Anleitung", "unter „Mehr“ gibt es „Anleitung“ (≥ 44 px)", JSON.stringify(mt));
  await p.click("#mehrTour"); await ruhe(p);
  pruef(await p.evaluate(() => TOUR.laeuft()), "ein Tipp darauf startet die Tour");
  pruef((await p.evaluate(() => document.getElementById("mehrfach").hidden)), "das Menü „Mehr“ ist dabei zu");
  const finger = async (x0, x1) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: 330 }] });
    for(let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / 6, y: 332 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
  const stand = () => p.evaluate(() => TOUR.laeuft() ? TOUR.stand() : null);
  await finger(320, 90); await ruhe(p); let st = await stand();
  pruef(st && st.bereich === 1, "Wischen nach links mit dem Finger → nächster Bereich (Karte)", String(st && st.bereich));
  await finger(90, 320); await ruhe(p); st = await stand();
  pruef(st && st.bereich === 0, "Wischen nach rechts → voriger Bereich", String(st && st.bereich));
  await p.evaluate(() => TOUR.gehe(0, 0)); await ruhe(p);
  for(let i = 0; i < 4; i++) await finger(320, 90);
  await ruhe(p); st = await stand();
  pruef(st && st.bereich === 4, "vier schnelle Wischer enden im fünften Bereich", String(st && st.bereich));
  const titelOk = await p.evaluate(() => document.getElementById("tourTitel").textContent === boardTourDef().bereiche[TOUR.stand().bereich].schritte[0].titel);
  pruef(titelOk, "und die Karte zeigt genau dessen ersten Schritt");
  await p.click('.tour-chip:nth-child(2)'); await ruhe(p); st = await stand();
  pruef(st && st.bereich === 1 && st.schritt === 0, "Tipp auf einen Chip springt in den Bereich");
  await p.keyboard.press("ArrowRight"); await ruhe(p); st = await stand();
  pruef(st && st.schritt === 1, "Pfeil rechts = weiter");
  const taps = await p.evaluate(() => [...document.querySelectorAll(".tour-chip, .tour-zu, .tour-knopf")].map(e => Math.min(e.getBoundingClientRect().height, e.getBoundingClientRect().width || 99)));
  pruef(taps.every(t => t >= 44), "jede Bedienfläche ≥ 44 px", Math.min(...taps).toFixed(0));
  /* Farben im Board: hell und dunkel */
  for(const licht of ["dunkel", "hell"]){
    await p.evaluate(l => { document.body.classList.toggle("hell", l === "hell"); }, licht); await p.waitForTimeout(300);
    const m = await p.evaluate(() => { const w = document.getElementById("tourWurzel"), c = e => { const cs = getComputedStyle(e); return { f: cs.color, g: cs.backgroundColor }; };
      const aktiv = w.querySelector(".tour-chip[aria-current=step]"), inaktiv = [...w.querySelectorAll(".tour-chip")].find(e => e !== aktiv);
      return { karte: c(w.querySelector(".tour-karte")), h2: c(w.querySelector("h2")), text: c(w.querySelector("#tourText")), stand: c(w.querySelector(".tour-stand")), haupt: c(w.querySelector(".tour-knopf.haupt")),
        neben: c(w.querySelector(".tour-knopf:not(.haupt)")), aktiv: c(aktiv), inaktiv: c(inaktiv), zu: c(w.querySelector(".tour-zu")) }; });
    const par = (name, a, g) => { const fa = farbe(a), ga = farbe(g); return { name, r: fa && ga ? kontrast(fa, ga) : 0 }; };
    const k = m.karte.g, paare = [par("Titel", m.h2.f, k), par("Text", m.text.f, k), par("Stand", m.stand.f, k), par("Weiter", m.haupt.f, m.haupt.g), par("Zurück", m.neben.f, k), par("aktiver Chip", m.aktiv.f, m.aktiv.g), par("Chip", m.inaktiv.f, m.inaktiv.g), par("Kreuz", m.zu.f, m.zu.g)];
    pruef(paare.every(x => x.r >= 4.5), licht + ": jede Schrift der Tour ≥ 4,5:1", paare.map(x => x.name + " " + x.r.toFixed(2)).join(" · "));
    pruef(farbe(k) && farbe(k)[3] === 1, licht + ": die Karte ist undurchsichtig", k);
  }
  await p.evaluate(() => document.body.classList.remove("hell"));
  /* Bewegung: nur transform/opacity */
  const a = await p.evaluate(() => { const w = document.getElementById("tourWurzel");
    const l = document.getAnimations().filter(x => x.effect && x.effect.target && (w.contains(x.effect.target) || (x.effect.target.parentElement && w.contains(x.effect.target.parentElement))));
    return { alle: l.length, unendlich: l.filter(x => x.effect.getComputedTiming().iterations === Infinity).length,
      eig: [...new Set(l.flatMap(x => x.effect.getKeyframes().flatMap(k => Object.keys(k)).filter(k => !["offset", "easing", "composite", "computedOffset"].includes(k))))] }; });
  pruef(a.unendlich === 0, "nichts läuft endlos (Lichtkegel statt Puls und Hand, 31.10.)", JSON.stringify(a));
  pruef(a.eig.every(k => ["transform", "opacity"].includes(k)), "nur transform und opacity", a.eig.join(",") || "keine");
  /* Escape: am Ausgangsort */
  await p.keyboard.press("Escape"); await p.waitForTimeout(700);
  pruef(!(await p.evaluate(() => TOUR.laeuft())) && (await p.evaluate(() => !document.getElementById("tourWurzel"))), "Escape beendet die Tour");
  pruef(await p.evaluate(() => !document.getElementById("t-speisekarte").hidden), "nach dem Ende steht das Board wieder auf dem Reiter, auf dem die Tour begann (Karte)");
  pruef(b.fehler.length === 0, "keine Skriptfehler", b.fehler.join(" | "));
  await b.ctx.close();
  /* reduzierte Bewegung */
  const r = await oeffnen(browser, 390, { reduziert: true });
  await r.p.evaluate(() => boardTourStarten("karte")); await ruhe(r.p);
  const lauf = await r.p.evaluate(() => { const l = document.getAnimations().filter(x => x.effect && x.effect.getComputedTiming().iterations === Infinity && x.playState === "running" && x.effect.target && document.getElementById("tourWurzel").contains(x.effect.target.parentElement || x.effect.target)); return l.length; });
  pruef(lauf === 0, "reduzierte Bewegung: nichts läuft endlos", String(lauf));
  await r.ctx.close();
}

(async () => {
  /* TEIL=quelle,wiki,schritt,bedien — für die Gegenbeweise im Worktree; ohne Angabe läuft alles. */
  const teil = (process.env.TEIL || "").split(",").filter(Boolean), will = k => !teil.length || teil.includes(k);
  const br = await chromium.launch();
  if(will("quelle")) await quellProbe(br);
  if(will("wiki")){ await wikiProbe(br, 390); await wikiProbe(br, 1280); }
  if(will("schritt")){ await schrittProbe(br, 390); await schrittProbe(br, 1280); }
  if(will("bedien")) await bedienProbe(br);
  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
