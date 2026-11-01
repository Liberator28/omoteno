/* ═══════════════════════════════════════════════════════════════
   pruef-tour.js — die geführte Tour des Gast-Hubs („Anleitung“, Wunsch 25.10.)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-tour.js     (braucht dist/)
     Gegenbeweise: HUB_DIST=<Verzeichnis>  VORLAGE=<hub.vorlage.html>  ADMIN_DATEI=<admin.html>

   Gebaut ist:
   · der geteilte Block TOUR (Schleier mit Loch, Bereichsleiste oben, Karte, Hand-Vorführung, Wischen zwischen Bereichen) —
     wortgleich in vorlagen/hub.vorlage.html und seiten/admin.html;
   · im Hub die Definition `tourDef()` (Start · Speisekarte · Ihre Auswahl · Foodroulette · Am Tisch · Bestellung), der schwebende Knopf
     „Anleitung“ beim ersten Besuch, ein Weg zurück über die Haus-Seite, elf Sprachen.

   Was schiefgehen kann, und je eine Probe dazu:
   1 · Die beiden Kopien des Blocks sind Zeichen für Zeichen gleich, und der Block trägt sich selbst (Stil im Block, §8.1e).
   2 · Der Knopf: nur Start und Speisekarte, ganz im Bild, ≥ 44 px, lesbar, NIE über einer festen Leiste unten (die Auswahl-Leiste fährt
       ein — gemessen nach dem Einfahren), nichts im Gerät vor dem ersten Tipp (§ 25 TDDDG), danach genau ein Eintrag, Neuladen ohne Knopf;
       Vorführhaus merkt sich nichts; nicht über dem Begrüßungsschirm, nicht über einem offenen Blatt.
   3 · Jeder Schritt jedes Hauses: das Loch umschließt das Ziel, die Karte liegt ganz im Bild und nie auf dem Loch, die Bereichsleiste nie
       auf dem Ziel (Sprachknopf oben!), die Hand steht im Loch; Schritte ohne Ziel zeigen eine Karte in der Mitte statt zu hängen.
   4 · Bedienung mit echten Zeigern: Tipp auf einen Bereich, Weiter/Zurück, Pfeiltasten, Escape, Wischen links/rechts (Maus UND Finger über
       CDP), kurzes und senkrechtes Wischen tun nichts, schnelles Wischen endet im richtigen Bereich (§8.1v), arabisch gespiegelt.
   5 · Nach dem Ende: Schleier weg, Adresse wie vorher, Pfeiltasten tun nichts mehr.
   6 · Texte: jeder Satz der Tour ist ein Wörterbuchschlüssel mit allen elf Sprachen (zweite Quelle: TEXTE), je Sprache passt die Karte bei
       360 px, kein Überlauf.
   7 · Farben: Schrift auf Karte, Nebentext, Knopf, Chip (aktiv/inaktiv) ≥ 4,5:1 in jedem Haus, hell/dunkel.
   8 · Bewegung: nur transform/opacity, bei reduzierter Bewegung läuft nichts endlos (und OHNE reduzierte läuft etwas — sonst sähe die Probe
       nichts, §8.1g).
   Ehrliche Grenzen: kopfloses Chromium, kein Gerät; die Vorführung ist eine Zeichnung der Geste; der Board-Teil steht in pruef-tour-board.js.
   ═══════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { oeffneHub, DIST } = require("./werkzeug/start-hub.js");
const { kontrast } = require("./werkzeug/messen.js");

const OBEN = path.resolve(__dirname, "..");
const VORLAGE = process.env.VORLAGE || path.join(OBEN, "vorlagen", "hub.vorlage.html");
const ADMIN = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");
let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if(!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };
const HAEUSER = ["chocolamour", "blend", "nordstern", "minhkeey", "piugusto"].filter(h => fs.existsSync(path.join(process.env.HUB_DIST || DIST, h, "index.html")));
const KORB = h => h === "nordstern" ? "Porridge" : "Waffel Classic";   /* das Vorführhaus hat seine eigene Karte */
const SPRACHEN = ["en", "tr", "ru", "fr", "es", "it", "pl", "ar", "uk", "nl", "ro"];

/* Schritte, bei denen es in JEDEM Haus ein Ziel geben muss (zweite Quelle: das ist die Oberfläche, nicht die Tour) */
const MUSS_LOCH = ["Sprache und Licht", "Suchen", "Kategorien", "Gericht ansehen", "Zur Auswahl hinzufügen", "Die Auswahl-Leiste"];
/* Schritte, die ohne Ziel eine Karte in der Mitte zeigen dürfen */
const OHNE_ZIEL_OK = ["Willkommen"];   /* seit 31.10. haben alle anderen Schritte ein Ersatzziel */
/* Wörterbuch: gleich dem Deutschen ist erlaubt, wo die Sprache dasselbe Wort hat (namentlich, kein Muster — §8.1g D) */
const GLEICH_OK = { "Start": ["pl", "nl"], "Bestellen": ["nl"], "Foodroulette": SPRACHEN };

const szene = () => {
  const r = e => { if(!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const w = document.getElementById("tourWurzel"); if(!w) return null;
  const karte = w.querySelector(".tour-karte");
  return { loch: r(w.querySelector(".tour-loch")), karte: r(karte), zeile: r(w.querySelector(".tour-zeile")), punkte: r(w.querySelector(".tour-punkte")),
    hand: w.querySelector(".tour-hand") ? 1 : 0, ohneLoch: w.dataset.ohneloch === "1", kopf: w.dataset.kopf,
    kopfWeg: (() => { const k = getComputedStyle(w.querySelector(".tour-kopf")); return +k.opacity < .05 && k.pointerEvents === "none"; })(), pos: w.dataset.pos,
    geste: (() => { const g = w.querySelector(".tour-geste"); return g && !g.hidden ? g.textContent : ""; })(), ueber: karte.scrollHeight > karte.clientHeight + 1,
    titel: w.querySelector("#tourTitel").textContent, text: w.querySelector("#tourText").textContent, stand: w.querySelector(".tour-stand").textContent,
    vw: innerWidth, vh: innerHeight, breite: document.documentElement.scrollWidth };
};
/* Das Ziel eines Schritts, unabhängig vom Block gesucht (eigene Sichtbarkeitsregel) */
const zielRect = (b, s) => `(() => { const st = tourDef().bereiche[${b}].schritte[${s}]; for(const sel of [].concat(st.ziel || [])){ let e = null; try{ e = document.querySelector(sel); }catch(x){}
  if(!e) continue; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if(r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none") return { l: r.left, t: r.top, r: r.right, b: r.bottom, sel }; } return null; })()`;
const schneidet = (a, b, tol) => a && b && a.l < b.r - (tol || 0) && a.r > b.l + (tol || 0) && a.t < b.b - (tol || 0) && a.b > b.t + (tol || 0);

/* Farbe lesen: rgb(…) und color(srgb …) */
const farbe = s => { let m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?/.exec(s); if(m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  m = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?/.exec(s); if(m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : +m[4]]; return null; };

async function warteRuhe(p){ await p.waitForTimeout(950); }

/* ── 1 · Block gleich, Block trägt sich selbst ─────────────────── */
function blockTeil(datei){
  const s = fs.readFileSync(datei, "utf8");
  const a = s.indexOf("/* ╔═══ TOUR · GETEILTER BLOCK · ANFANG"), b = s.indexOf("/* ╚═══ TOUR · GETEILTER BLOCK · ENDE");
  if(a < 0 || b < 0) return null;
  return s.slice(a, s.indexOf("\n", b));
}
function blockProbe(){
  console.log("\n══ 1 · Der geteilte Block ══");
  const h = blockTeil(VORLAGE), b = blockTeil(ADMIN);
  pruef(!!h && !!b, "der Block steht in beiden Dateien (Hub-Vorlage und Board)", (h ? "Hub " + h.length : "Hub fehlt") + " / " + (b ? "Board " + b.length : "Board fehlt"));
  pruef(h === b, "die beiden Kopien sind Zeichen für Zeichen gleich", h && b ? (h === b ? "gleich" : "ungleich ab Zeichen " + [...h].findIndex((c, i) => c !== b[i])) : "");
  if(h){
    /* Er trägt sich selbst: der Stil entsteht IM Block, die Seite liefert nur Farbrollen (§8.1e) */
    pruef(/id = "tourStil"/.test(h) && /\.tour-loch\{/.test(h) && /\.tour-karte\{/.test(h), "Stil, Licht und Karte stehen im Block");
    /* Lichtkegel (31.10.): keine Dauer-Animation, keine Hand, kein Ring in der Hausfarbe am Licht */
    pruef(!/@keyframes/.test(h) && !/tour-hand/.test(h), "keine Keyframes und keine Hand im Block (das Licht steht still)", [...h.matchAll(/@keyframes ([a-z-]+)/g)].map(m => m[1]).join(",") || "keine");
    const lochRegel = (h.match(/\.tour-loch\{[^}]*\}/) || [""])[0];
    pruef(lochRegel && !/--tour-akzent/.test(lochRegel) && /200vmax/.test(lochRegel) && /inset/.test(lochRegel), "das Licht hat keinen Rand in der Hausfarbe, aber einen weichen Übergang (inset) und den dunklen Raum (200vmax)", lochRegel.slice(0, 120));
    const farben = [...h.matchAll(/var\((--tour-[a-z-]+)/g)].map(m => m[1]);
    const rollen = [...new Set(farben)].filter(x => x !== "--tour-kh");   /* --tour-kh ist ein Maß (Höhe der Leiste), keine Farbe */
    pruef(rollen.sort().join(",") === "--tour-akzent,--tour-akzent-schrift,--tour-karte,--tour-leise,--tour-linie,--tour-schrift", "der Block liest genau sechs Farbrollen der Seite", rollen.join(" "));
    pruef(!/color:#fff[;"]/.test(h.replace(/var\(--tour-[a-z-]+,#fff\)/g, "")), "keine feste Schriftfarbe im Block (nur Rückfälle hinter einer Rolle, §5.1)");
  }
  for(const [name, datei] of [["Hub", VORLAGE], ["Board", ADMIN]]){
    const s = fs.readFileSync(datei, "utf8");
    const m = /#tourWurzel\{([^}]*)\}/.exec(s);
    const rollen = m ? [...m[1].matchAll(/(--tour-[a-z-]+):/g)].map(x => x[1]).sort().join(",") : "";
    pruef(rollen === "--tour-akzent,--tour-akzent-schrift,--tour-karte,--tour-leise,--tour-linie,--tour-schrift", name + ": die Seite legt alle sechs Farbrollen am Element fest (nicht in :root, §3.2)", rollen || "fehlt");
  }
}

/* ── 2 · Der schwebende Knopf ──────────────────────────────────── */
async function knopfProbe(browser, haus){
  console.log("\n══ 2 · Knopf beim ersten Besuch · " + haus + " ══");
  const h = await oeffneHub(browser, { haus, korb: [KORB(haus)] }), p = h.p;
  await p.waitForTimeout(900);
  const schluessel = () => p.evaluate(() => { const k = []; try{ for(let i = 0; i < localStorage.length; i++) k.push(localStorage.key(i)); }catch(e){} return k.filter(x => /omoteno-tour-|omoteno-geraet-|omoteno-stammgast-/.test(x)); });
  const stand = () => p.evaluate(() => { const e = document.getElementById("tourPille"); if(!e || e.hidden) return null; const r = e.getBoundingClientRect();
    const los = e.querySelector(".tour-pille-los").getBoundingClientRect(), weg = e.querySelector(".tour-pille-weg").getBoundingClientRect();
    const bar = id => { const x = document.getElementById(id); if(!x || x.hidden) return null; const cs = getComputedStyle(x); if(id === "auswahlbalken" && !x.classList.contains("an")) return null;
      const b = x.getBoundingClientRect(); return (b.width > 0 && cs.visibility !== "hidden") ? { t: b.top, l: b.left, r: b.right } : null; };
    const cs = getComputedStyle(e);
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, vw: innerWidth, vh: innerHeight, losH: los.height, losB: los.width, wegH: weg.height, wegB: weg.width,
      bg: cs.backgroundColor, farbe: cs.color, wegFarbe: getComputedStyle(e.querySelector(".tour-pille-weg")).color, text: e.querySelector(".tp-text").textContent,
      balken: bar("auswahlbalken"), nav: bar("hauptnav"), streifen: bar("vstreifen") }; });
  let s = await stand();
  pruef(!!s, "der Knopf ist da (erster Besuch, Start)", s ? s.text : "versteckt");
  if(s){
    pruef(s.l >= 0 && s.r <= s.vw && s.t >= 0 && s.b <= s.vh, "ganz im Bild", Math.round(s.l) + "…" + Math.round(s.r) + " / " + Math.round(s.t) + "…" + Math.round(s.b));
    pruef(s.losH >= 44 && s.losB >= 44 && s.wegH >= 44 && s.wegB >= 44, "beide Flächen ≥ 44 px", [s.losB, s.losH, s.wegB, s.wegH].map(Math.round).join("×"));
    const hoechste = [s.balken, s.nav, s.streifen].filter(Boolean).map(x => x.t);
    pruef(hoechste.length >= 1, "Voraussetzung: mindestens eine feste Leiste unten steht (Auswahl-Leiste mit Korb)", JSON.stringify({ balken: !!s.balken, nav: !!s.nav, streifen: !!s.streifen }));
    pruef(hoechste.every(t => s.b <= t + 1), "liegt über jeder festen Leiste unten, nicht auf ihr", "Knopf unten " + Math.round(s.b) + " / Leisten oben " + hoechste.map(Math.round).join(","));
    const bg = farbe(s.bg), tx = farbe(s.farbe), wg = farbe(s.wegFarbe);
    pruef(bg && tx && wg && kontrast(tx, bg) >= 4.5 && kontrast(wg, bg) >= 4.5, "Schrift und Kreuz ≥ 4,5:1", bg && tx && wg ? kontrast(tx, bg).toFixed(2) + " / " + kontrast(wg, bg).toFixed(2) : "unlesbar");
  }
  pruef((await schluessel()).length === 0, "vor dem ersten Tipp liegt nichts davon im Gerät (§ 25 TDDDG)", JSON.stringify(await schluessel()));
  /* Orte: nur Start und Speisekarte */
  const sichtbarBei = async hash => { await p.evaluate(x => { location.hash = x; }, hash); await p.waitForTimeout(900); return !!(await stand()); };
  pruef(await sichtbarBei("#/speisekarte"), "auch auf der Speisekarte");
  pruef(!(await sichtbarBei("#/auswahl")), "nicht auf „Ihre Auswahl“ (dort bestellt man, nichts schwebt davor)");
  pruef(!(await sichtbarBei("#/haus")), "nicht auf der Haus-Seite");
  await p.evaluate(() => { location.hash = "#/"; }); await p.waitForTimeout(700);
  /* Begrüßungsschirm und Blatt */
  await p.evaluate(() => { const w = document.createElement("div"); w.id = "willkommen"; w.className = "willkommen"; document.body.appendChild(w); tourPilleAbgleichen(); });
  pruef(!(await stand()), "nicht über dem Begrüßungsschirm");
  await p.evaluate(() => { document.getElementById("willkommen").remove(); tourPilleAbgleichen(); });
  pruef(!!(await stand()), "danach wieder da (Voraussetzung der nächsten Probe)");
  await p.evaluate(() => { document.getElementById("warenkarte").classList.add("an"); tourPilleAbgleichen(); });
  pruef(!(await stand()), "nicht über einem offenen Blatt");
  await p.evaluate(() => { document.getElementById("warenkarte").classList.remove("an"); tourPilleAbgleichen(); });
  /* Wegtippen: ausdrückliche Handlung → genau ein Eintrag, Neuladen ohne Knopf */
  await p.click("[data-tour-weg]"); await p.waitForTimeout(300);
  pruef(!(await stand()), "✕ blendet den Knopf aus");
  const k1 = await schluessel();
  const vorfuehr = haus === "nordstern";
  if(vorfuehr) pruef(k1.length === 0, "Vorführhaus: auch nach ✕ nichts im Gerät (merkt sich nichts)", JSON.stringify(k1));
  else pruef(k1.length === 1 && /^omoteno-tour-/.test(k1[0]), "nach ✕ genau ein Eintrag: " + k1.join(","), JSON.stringify(k1));
  await p.reload(); await p.waitForTimeout(1600);
  const nachLaden = await stand();
  if(vorfuehr) pruef(!!nachLaden, "Vorführhaus: nach dem Neuladen wieder der Knopf (nichts gemerkt)");
  else pruef(!nachLaden, "nach dem Neuladen bleibt der Knopf weg");
  pruef(h.fehler.length === 0, "keine Skriptfehler", h.fehler.join(" | "));
  await h.ctx.close();
}

/* ── 3 · Jeder Schritt jedes Hauses ────────────────────────────── */
async function schrittProbe(browser, haus){
  console.log("\n══ 3 · Jeder Schritt · " + haus + " (390 px) ══");
  const h = await oeffneHub(browser, { haus, korb: [KORB(haus)] }), p = h.p;
  await p.evaluate(() => { document.getElementById("tourPille") && (document.getElementById("tourPille").hidden = true); });
  const erster = await p.evaluate(() => { tourStarten(); return TOUR.laeuft(); });
  pruef(erster, "Tour startet (tourStarten)");
  await p.waitForTimeout(900);
  const def = await p.evaluate(() => tourDef().bereiche.map(b => ({ titel: b.titel, schritte: b.schritte.map(s => ({ titel: s.titel, demo: s.demo || "", hatZiel: !!(s.ziel && s.ziel.length) })) })));
  const chips = await p.evaluate(() => [...document.querySelectorAll(".tour-chip")].map(c => c.textContent));
  pruef(JSON.stringify(chips) === JSON.stringify(def.map(b => b.titel)), "die Chips oben sind die Bereiche der Tour, in dieser Reihenfolge", chips.join(" · "));
  pruef(chips.length >= 5, "mindestens fünf Bereiche (Start, Speisekarte, Auswahl, …, Bestellung)", String(chips.length));
  const hatRoulette = await p.evaluate(() => foodrouletteAn());
  pruef(hatRoulette === chips.includes("Foodroulette"), "Foodroulette steht genau dann in der Tour, wenn das Haus sie hat", "an=" + hatRoulette);
  let loecher = 0, schritte = 0;
  for(let b = 0; b < def.length; b++) for(let s = 0; s < def[b].schritte.length; s++){
    const st = def[b].schritte[s], tag = " [" + def[b].titel + " / " + st.titel + "]";
    await p.evaluate(([b, s]) => TOUR.gehe(b, s), [b, s]);
    await warteRuhe(p);
    const m = await p.evaluate(szene), z = await p.evaluate(zielRect(b, s));
    schritte++;
    if(!m){ pruef(false, "Tour läuft noch" + tag); continue; }
    pruef(m.titel.length > 0 && !m.ueber, "Karte zeigt den Titel und schneidet nichts ab" + tag, m.titel);
    pruef(m.karte.l >= 0 && m.karte.r <= m.vw + .5 && m.karte.t >= 0 && m.karte.b <= m.vh + .5, "Karte ganz im Bild" + tag, [m.karte.l, m.karte.t, m.karte.r, m.karte.b].map(Math.round).join(","));
    pruef(m.breite <= m.vw, "kein Seitenüberlauf" + tag, m.breite + " / " + m.vw);
    if(MUSS_LOCH.includes(st.titel)) pruef(!!z, "Voraussetzung: das Ziel gibt es in diesem Haus" + tag, z ? z.sel : "kein Ziel gefunden");
    if(z){
      loecher++;
      pruef(!m.ohneLoch, "Loch da, weil es ein Ziel gibt" + tag, z.sel);
      if(!m.ohneLoch){
        const t = { l: Math.max(z.l, 4), t: Math.max(z.t, 4), r: Math.min(z.r, m.vw - 4), b: Math.min(z.b, m.vh - 4) };   /* der Block hält 4 px Abstand zum Bildrand */
        pruef(m.loch.l <= t.l + 1 && m.loch.t <= t.t + 1 && m.loch.r >= t.r - 1 && m.loch.b >= t.b - 1, "Loch umschließt das Ziel" + tag,
          "Loch " + [m.loch.l, m.loch.t, m.loch.r, m.loch.b].map(Math.round) + " Ziel " + [t.l, t.t, t.r, t.b].map(Math.round));
        pruef(!schneidet(m.loch, m.karte, 2), "die Karte liegt nicht auf dem Loch" + tag);
        /* Seit 31.10. springt die Leiste nicht mehr nach unten: liegt das Ziel darunter, tritt sie zurück (durchsichtig, fängt nichts). */
        pruef(m.kopf === "weg" ? m.kopfWeg : (!schneidet(m.loch, m.zeile, 2) && !schneidet(m.loch, m.punkte, 2)), "die Bereichsleiste liegt nicht auf dem Ziel (oder tritt zurück)" + tag, "Leiste " + m.kopf);
        /* Lichtkegel (31.10.): keine Hand, kein Ring — die Geste steht als Wort in der Karte. */
        pruef(m.hand === 0, "keine Hand-Zeichnung am Licht" + tag);
        if(st.demo) pruef(m.geste.length > 1, "die Geste steht als Wort in der Karte" + tag, m.geste);
        else pruef(m.geste === "", "ohne Geste kein Gesten-Wort" + tag, m.geste);
      }
    } else {
      pruef(m.ohneLoch && m.pos === "mitte", "ohne Ziel: Karte in der Mitte, kein Loch" + tag, m.pos);
      pruef(OHNE_ZIEL_OK.includes(st.titel), "dass dieser Schritt ohne Ziel bleibt, ist namentlich vorgesehen" + tag);
    }
  }
  pruef(loecher >= 8, "mindestens acht Schritte haben ein echtes Loch", loecher + " von " + schritte);
  pruef(h.fehler.length === 0, "keine Skriptfehler", h.fehler.join(" | "));
  await h.ctx.close();
}

/* ── 4/5 · Bedienung, Ende ─────────────────────────────────────── */
async function bedienProbe(browser, haus){
  console.log("\n══ 4 · Bedienung mit echten Zeigern · " + haus + " ══");
  const h = await oeffneHub(browser, { haus, korb: [KORB(haus)] }), p = h.p;
  const cdp = await h.ctx.newCDPSession(p);
  const stand = () => p.evaluate(() => TOUR.laeuft() ? TOUR.stand() : null);
  const lauf = () => p.evaluate(() => TOUR.laeuft());
  await p.evaluate(() => { location.hash = "#/speisekarte"; }); await p.waitForTimeout(700);
  const von = await p.evaluate(() => location.hash);
  /* Start über den ECHTEN Tipp auf den Knopf */
  await p.waitForTimeout(500);
  await p.click("[data-tour-los]"); await warteRuhe(p);
  pruef(await lauf(), "echter Tipp auf „Anleitung“ startet die Tour");
  pruef((await p.evaluate(() => document.getElementById("tourPille").hidden)) === true, "der Knopf verschwindet, solange die Tour läuft");
  pruef((await p.evaluate(() => { const k = []; for(let i = 0; i < localStorage.length; i++) k.push(localStorage.key(i)); return k.filter(x => /omoteno-tour-/.test(x)).length; })) === (haus === "nordstern" ? 0 : 1), "der Start ist die ausdrückliche Handlung: genau jetzt wird gemerkt (Vorführhaus nicht)");
  const dlg = await p.evaluate(() => { const w = document.getElementById("tourWurzel"); return { rolle: w.getAttribute("role"), modal: w.getAttribute("aria-modal"), name: w.getAttribute("aria-labelledby"), akt: document.querySelector(".tour-chip[aria-current=step]").textContent }; });
  pruef(dlg.rolle === "dialog" && dlg.modal === "true" && dlg.name === "tourTitel", "ein Dialog mit Titel (für Vorleser)", JSON.stringify(dlg));
  pruef(dlg.akt === "Start", "oben steht, wo man ist: der aktive Chip ist „Start“", dlg.akt);
  const taps = await p.evaluate(() => [...document.querySelectorAll(".tour-chip, .tour-zu, .tour-knopf")].map(e => Math.min(e.getBoundingClientRect().height, e.getBoundingClientRect().width || 99)));
  pruef(taps.every(t => t >= 44), "jede Bedienfläche ≥ 44 px", Math.min(...taps).toFixed(0));
  /* Tipp auf einen Bereich */
  await p.click('.tour-chip:nth-child(2)'); await warteRuhe(p);
  let st = await stand();
  pruef(st && st.bereich === 1 && st.schritt === 0, "Tipp auf einen Chip springt in den Bereich", JSON.stringify(st && [st.bereich, st.schritt]));
  await p.click(".tour-knopf.haupt"); await warteRuhe(p); st = await stand();
  pruef(st.bereich === 1 && st.schritt === 1, "Weiter geht einen Schritt", JSON.stringify([st.bereich, st.schritt]));
  await p.click(".tour-knopf:not(.haupt)"); await warteRuhe(p); st = await stand();
  pruef(st.bereich === 1 && st.schritt === 0, "Zurück geht einen Schritt zurück", JSON.stringify([st.bereich, st.schritt]));
  await p.keyboard.press("ArrowRight"); await warteRuhe(p); st = await stand();
  pruef(st.schritt === 1, "Pfeil rechts = weiter");
  await p.keyboard.press("ArrowLeft"); await warteRuhe(p); st = await stand();
  pruef(st.schritt === 0, "Pfeil links = zurück");
  /* Wischen mit der Maus */
  const wischMaus = async (x0, y0, x1, y1) => { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await p.mouse.move(x1, y1, { steps: 4 }); await p.mouse.up(); };
  await p.evaluate(() => TOUR.gehe(1, 0)); await warteRuhe(p);
  await wischMaus(320, 330, 90, 335); await warteRuhe(p); st = await stand();
  pruef(st.bereich === 2 && st.schritt === 0, "Wischen nach links (Maus) → nächster Bereich", JSON.stringify([st.bereich, st.schritt]));
  await wischMaus(90, 330, 320, 335); await warteRuhe(p); st = await stand();
  pruef(st.bereich === 1, "Wischen nach rechts (Maus) → voriger Bereich", String(st.bereich));
  await wischMaus(250, 330, 215, 331); await p.waitForTimeout(300); st = await stand();
  pruef(st.bereich === 1, "ein kurzer Zug (35 px) wechselt nichts", String(st.bereich));
  await wischMaus(200, 250, 190, 520); await p.waitForTimeout(300); st = await stand();
  pruef(st.bereich === 1, "ein senkrechter Zug wechselt nichts", String(st.bereich));
  /* Wischen mit dem Finger (CDP) — hier rollt Chromium wirklich, eine Mausprobe sähe das nicht (§3.8) */
  const finger = async (x0, y0, x1, y1) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
    for(let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / 6, y: y0 + (y1 - y0) * i / 6 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const scrollVorher = await p.evaluate(() => scrollY);
  await finger(320, 330, 90, 335); await warteRuhe(p); st = await stand();
  pruef(st.bereich === 2, "Wischen nach links mit dem FINGER → nächster Bereich", String(st.bereich));
  await finger(90, 330, 320, 335); await warteRuhe(p); st = await stand();
  pruef(st.bereich === 1, "Wischen nach rechts mit dem Finger → voriger Bereich", String(st.bereich));
  await finger(200, 250, 200, 560); await p.waitForTimeout(400);
  pruef((await p.evaluate(() => scrollY)) === scrollVorher, "ein senkrechter Fingerzug rollt die Seite DAHINTER nicht", scrollVorher + " → " + await p.evaluate(() => scrollY));
  /* Schnell: sechs Wischer hintereinander, ohne zu warten */
  await p.evaluate(() => TOUR.gehe(0, 0)); await warteRuhe(p);
  for(let i = 0; i < 4; i++) await finger(320, 330, 90, 335);
  await warteRuhe(p); st = await stand();
  const anzahl = await p.evaluate(() => document.querySelectorAll(".tour-chip").length);
  pruef(st.bereich === Math.min(4, anzahl - 1), "vier schnelle Wischer enden im Bereich " + Math.min(4, anzahl - 1) + " (von " + anzahl + ")", String(st.bereich));
  const m = await p.evaluate(szene);
  pruef(m && m.titel === (await p.evaluate(() => tourDef().bereiche[TOUR.stand().bereich].schritte[0].titel)), "und die Karte zeigt zum Schluss genau den ersten Schritt DIESES Bereichs (kein Rest eines früheren Gangs)", m && m.titel);
  /* Escape beendet; danach wie vorher */
  await p.keyboard.press("Escape"); await p.waitForTimeout(700);
  pruef(!(await lauf()) && (await p.evaluate(() => !document.getElementById("tourWurzel"))), "Escape beendet die Tour, der Schleier ist weg");
  pruef((await p.evaluate(() => location.hash)) === von, "die Adresse ist wieder die von vorher", von + " → " + await p.evaluate(() => location.hash));
  const x = await p.evaluate(() => { const s = location.hash; document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); return s === location.hash; });
  pruef(x, "nach dem Ende tun die Pfeiltasten nichts mehr");
  /* Ende über „Fertig“ */
  await p.evaluate(() => { tourStarten(); }); await warteRuhe(p);
  const letzte = await p.evaluate(() => { const b = tourDef().bereiche; return [b.length - 1, b[b.length - 1].schritte.length - 1]; });
  await p.evaluate(([b, s]) => TOUR.gehe(b, s), letzte); await warteRuhe(p);
  pruef((await p.evaluate(() => document.querySelector(".tour-knopf.haupt").textContent)) === "Fertig", "im letzten Schritt heißt der Knopf „Fertig“");
  await p.click(".tour-knopf.haupt"); await p.waitForTimeout(700);
  pruef(!(await lauf()), "„Fertig“ beendet die Tour");
  /* Weg zurück: die Haus-Seite */
  await p.evaluate(() => { location.hash = "#/haus"; }); await p.waitForTimeout(800);
  const hb = await p.evaluate(() => { const b = document.querySelector("[data-tour-los]"); if(!b) return null; const r = b.getBoundingClientRect(); return { h: r.height, w: r.width }; });
  pruef(hb && hb.h >= 44, "auf der Haus-Seite führt ein Knopf „Anleitung“ zurück (≥ 44 px)", JSON.stringify(hb));
  await p.click("[data-tour-los]"); await warteRuhe(p);
  pruef(await lauf(), "echter Tipp auf diesen Knopf startet die Tour wieder");
  await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  pruef(h.fehler.length === 0, "keine Skriptfehler", h.fehler.join(" | "));
  await h.ctx.close();
}

/* ── 4b · Arabisch gespiegelt ──────────────────────────────────── */
async function rtlProbe(browser){
  console.log("\n══ 4b · Arabisch (von rechts nach links) ══");
  const h = await oeffneHub(browser, { haus: "chocolamour", sprache: "ar", korb: ["Waffel Classic"] }), p = h.p;
  const cdp = await h.ctx.newCDPSession(p);
  await p.evaluate(() => { tourStarten(); }); await warteRuhe(p);
  const rtl = await p.evaluate(() => getComputedStyle(document.documentElement).direction);
  pruef(rtl === "rtl", "Voraussetzung: die Seite läuft von rechts nach links", rtl);
  await p.evaluate(() => TOUR.gehe(2, 0)); await warteRuhe(p);
  const finger = async (x0, x1) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: 330 }] });
    for(let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / 6, y: 332 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
  await finger(90, 320); await warteRuhe(p);
  let st = await p.evaluate(() => TOUR.stand());
  pruef(st.bereich === 3, "Wischen nach RECHTS führt im Arabischen zum nächsten Bereich", String(st.bereich));
  await finger(320, 90); await warteRuhe(p);
  st = await p.evaluate(() => TOUR.stand());
  pruef(st.bereich === 2, "Wischen nach LINKS führt zurück", String(st.bereich));
  await p.keyboard.press("ArrowLeft"); await warteRuhe(p);
  st = await p.evaluate(() => TOUR.stand());
  pruef(st.bereich === 2 && st.schritt === 1, "Pfeil links = weiter (gespiegelt)", JSON.stringify([st.bereich, st.schritt]));
  const dirKopf = await p.evaluate(() => getComputedStyle(document.querySelector(".tour-chips")).direction);
  pruef(dirKopf === "rtl", "die Chips laufen von rechts", dirKopf);
  pruef(h.fehler.length === 0, "keine Skriptfehler", h.fehler.join(" | "));
  await h.ctx.close();
}

/* ── 6 · Texte: Wörterbuch und jede Sprache ───────────────────── */
async function textProbe(browser){
  console.log("\n══ 6 · Texte in elf Sprachen ══");
  const h = await oeffneHub(browser, { haus: "chocolamour", korb: ["Waffel Classic"] }), p = h.p;
  const alle = await p.evaluate(() => {
    const ks = new Set(["Anleitung", "Anleitung schließen", "Anleitung ausblenden", "Bereiche", "Bereich", "Schritt", "Fertig", "Weiter", "Zurück"]);
    /* mit Foodroulette UND Serviceruf/Mein Tisch: die Definition ruft foodrouletteAn() und sichtbareKacheln(), beides bleibt, wie es ist */
    const def = tourDef();
    def.bereiche.forEach(b => { ks.add(b.titel); b.schritte.forEach(s => { ks.add(s.titel); ks.add(s.text); }); });
    return { keys: [...ks], tabelle: Object.fromEntries([...ks].map(k => [k, TEXTE[k] || null])) };
  });
  const fehlt = [], gleich = [];
  for(const k of alle.keys){
    const e = alle.tabelle[k];
    if(!e){ if(!GLEICH_OK[k]) fehlt.push(k); continue; }
    for(const l of SPRACHEN){
      if(!e[l] || !String(e[l]).trim()) { fehlt.push(k + " [" + l + "]"); continue; }
      if(e[l] === k && !(GLEICH_OK[k] || []).includes(l)) gleich.push(k + " [" + l + "]");
    }
  }
  pruef(alle.keys.length >= 30, "Voraussetzung: die Tour hat mindestens 30 Sätze", String(alle.keys.length));
  pruef(fehlt.length === 0, "jeder Satz der Tour ist ein Wörterbuchschlüssel mit allen elf Sprachen", fehlt.slice(0, 5).join(" | "));
  pruef(gleich.length === 0, "keine Sprache zeigt den deutschen Satz stehen (außer namentlich erlaubt)", gleich.slice(0, 5).join(" | "));
  /* Knopfnamen in den Sätzen: die Sprache nennt den Knopf so, wie der Knopf heißt */
  const knoepfe = await p.evaluate(() => ({ b: TEXTE["Zahlungspflichtig bestellen"], f: TEXTE["Für mich entscheiden"], n: TEXTE["Das nehme ich"], a: TEXTE["Anleitung"],
    sb: TEXTE["Erst „Zahlungspflichtig bestellen“ schickt Ihre Bestellung an das Haus. Davor steht, was Sie zahlen."],
    sd: TEXTE["Tippen Sie auf „Für mich entscheiden“. Mit „Das nehme ich“ übernehmen Sie das Ergebnis in Ihre Auswahl."],
    sl: TEXTE["Diese Anleitung finden Sie jederzeit wieder: Tippen Sie oben auf das Logo und dann auf „Anleitung“."] }));
  const falsch = [];
  for(const l of SPRACHEN){
    if(!knoepfe.sb[l].includes(knoepfe.b[l])) falsch.push("bestellen " + l);
    if(!knoepfe.sd[l].includes(knoepfe.f[l]) || !knoepfe.sd[l].includes(knoepfe.n[l])) falsch.push("drehen " + l);
    if(!knoepfe.sl[l].includes(knoepfe.a[l])) falsch.push("anleitung " + l);
  }
  pruef(falsch.length === 0, "jede Sprache nennt Knöpfe in ihren Sätzen so, wie sie auf dem Knopf stehen", falsch.join(", "));
  await h.ctx.close();
}
async function sprachPassProbe(browser){
  console.log("\n══ 6b · Jede Sprache, die längsten Karten bei 360 px ══");
  for(const l of SPRACHEN){
    const h = await oeffneHub(browser, { haus: "chocolamour", breite: 360, hoehe: 740, sprache: l, korb: ["Waffel Classic"] }), p = h.p;
    await p.evaluate(() => { tourStarten(); }); await warteRuhe(p);
    /* die vier längsten Texte dieser Sprache */
    const lang = await p.evaluate(() => { const l = []; tourDef().bereiche.forEach((b, i) => b.schritte.forEach((s, j) => l.push([i, j, t(s.text).length + t(s.titel).length]))); return l.sort((a, b) => b[2] - a[2]).slice(0, 4); });
    let schlecht = [];
    for(const [b, s] of lang){
      await p.evaluate(([b, s]) => TOUR.gehe(b, s), [b, s]); await warteRuhe(p);
      const m = await p.evaluate(szene);
      const t = await p.evaluate(() => { const w = document.getElementById("tourWurzel"); const h2 = w.querySelector("h2"), pp = w.querySelector("#tourText"); return { h: h2.scrollWidth > h2.clientWidth + 1, p: pp.scrollWidth > pp.clientWidth + 1 }; });
      if(!m || m.ueber || t.h || t.p || m.karte.l < 0 || m.karte.r > m.vw + .5 || m.karte.t < 0 || m.karte.b > m.vh + .5 || m.breite > m.vw) schlecht.push(b + "/" + s + (m ? JSON.stringify({ u: m.ueber, k: [m.karte.t, m.karte.b].map(Math.round), t }) : " keine"));
    }
    pruef(schlecht.length === 0, l + ": die vier längsten Karten passen (ganz im Bild, nichts abgeschnitten)", schlecht.join(" | "));
    pruef(h.fehler.length === 0, l + ": keine Skriptfehler", h.fehler.join(" | "));
    await h.ctx.close();
  }
}

/* ── 7 · Farben ────────────────────────────────────────────────── */
async function farbProbe(browser, haus, licht){
  const h = await oeffneHub(browser, { haus, farbe: licht, korb: [KORB(haus)] }), p = h.p;
  await p.evaluate(() => { tourStarten(); }); await warteRuhe(p);
  const messung = await p.evaluate(() => {
    const w = document.getElementById("tourWurzel"), c = e => { const cs = getComputedStyle(e); return { f: cs.color, g: cs.backgroundColor }; };
    const aktiv = w.querySelector(".tour-chip[aria-current=step]"), inaktiv = [...w.querySelectorAll(".tour-chip")].find(e => e !== aktiv);
    return { karte: c(w.querySelector(".tour-karte")), h2: c(w.querySelector("h2")), text: c(w.querySelector("#tourText")), stand: c(w.querySelector(".tour-stand")),
      haupt: c(w.querySelector(".tour-knopf.haupt")), neben: c(w.querySelector(".tour-knopf:not(.haupt)")), aktiv: c(aktiv), inaktiv: c(inaktiv), zu: c(w.querySelector(".tour-zu")) };
  });
  const paar = (name, a, g) => { const fa = farbe(a), ga = farbe(g || a); return { name, r: fa && ga ? kontrast(fa, ga) : 0 }; };
  const k = messung.karte.g;
  const paare = [paar("Titel auf Karte", messung.h2.f, k), paar("Text auf Karte", messung.text.f, k), paar("Stand auf Karte", messung.stand.f, k),
    paar("Knopf Weiter", messung.haupt.f, messung.haupt.g), paar("Knopf Zurück auf Karte", messung.neben.f, k),
    paar("aktiver Chip", messung.aktiv.f, messung.aktiv.g), paar("Chip", messung.inaktiv.f, messung.inaktiv.g), paar("Kreuz", messung.zu.f, messung.zu.g)];
  const schlecht = paare.filter(x => x.r < 4.5);
  pruef(paare.every(x => x.r > 0) && !schlecht.length, haus + " · " + licht + ": jede Schrift der Tour ≥ 4,5:1", paare.map(x => x.name + " " + x.r.toFixed(2)).join(" · "));
  /* Der Hintergrund der Karte ist undurchsichtig, sonst wäre der Kontrast eine Annahme */
  const a = farbe(k); pruef(a && a[3] === 1, haus + " · " + licht + ": die Karte ist undurchsichtig", k);
  await h.ctx.close();
}

/* ── 8 · Bewegung ─────────────────────────────────────────────── */
async function bewegungProbe(browser, haus){
  console.log("\n══ 8 · Bewegung · " + haus + " ══");
  for(const reduziert of [false, true]){
    const h = await oeffneHub(browser, { haus, reduziert, korb: [KORB(haus)] }), p = h.p;
    await p.evaluate(() => { tourStarten(); TOUR.gehe(1, 0); }); await warteRuhe(p);
    const a = await p.evaluate(() => { const w = document.getElementById("tourWurzel");
      const l = document.getAnimations().filter(x => x.effect && x.effect.target && w.contains(x.effect.target) || (x.effect && x.effect.target && x.effect.target.parentElement && w.contains(x.effect.target.parentElement)));
      const unendlich = l.filter(x => x.effect.getComputedTiming().iterations === Infinity);
      const eig = [...new Set(l.flatMap(x => x.effect.getKeyframes().flatMap(k => Object.keys(k)).filter(k => !["offset", "easing", "composite", "computedOffset"].includes(k))))];
      return { alle: l.length, unendlich: unendlich.length, eig, laufend: unendlich.filter(x => x.playState === "running").length }; });
    pruef(a.unendlich === 0, (reduziert ? "reduzierte Bewegung: " : "") + "nichts läuft endlos (das Licht pulsiert nicht)", JSON.stringify(a));
    pruef(a.eig.every(k => ["transform", "opacity"].includes(k)), "nur transform und opacity", a.eig.join(",") || "keine");
    /* Übergänge: nur transform/opacity, bei reduzierter Bewegung keiner */
    const tr = await p.evaluate(() => [".tour-loch", ".tour-schild", ".tour-kopf"].map(sel => { const e = document.querySelector(sel); const cs = getComputedStyle(e);
      return { sel, eig: cs.transitionProperty, dauer: cs.transitionDuration }; }));
    const nurTO = tr.every(x => x.eig.split(",").map(z => z.trim()).every(z => ["transform", "opacity", "all", "none"].includes(z) && z !== "all"));
    pruef(nurTO, "Übergänge nur über transform/opacity", JSON.stringify(tr));
    if(reduziert) pruef(tr.every(x => x.dauer.split(",").every(d => parseFloat(d) === 0)), "reduzierte Bewegung: kein Übergang", JSON.stringify(tr.map(x => x.dauer)));
    const geste = await p.evaluate(() => { const g = document.querySelector(".tour-geste"); return { da: !!g && !g.hidden, text: g ? g.textContent : "" }; });
    pruef(geste.da && geste.text.length > 1, "die Geste steht als Wort in der Karte (auch bei reduzierter Bewegung)", JSON.stringify(geste));
    await h.ctx.close();
  }
}

/* ── 9 · Licht am gemalten Bild ─────────────────────────────────
   Wunsch 31.10.: „wie in einem LED-Raum — das Licht kommt vom Bereich, der Rest ist stark abgedunkelt“. Gemessen wird am Bild:
   dasselbe Bild mit und ohne Tour (die Tour unsichtbar geschaltet, nichts sonst ändert sich). Im Licht (Mitte des Ziels) gleich,
   außerhalb (fern vom Licht, nicht unter Karte und Leiste) mindestens 80 % dunkler, und am Rand des Lichts keine Linie, die heller
   ist als das Licht selbst (der alte Ring in der Hausfarbe wäre eine solche Linie). */
async function lichtProbe(browser, haus){
  console.log("\n══ 9 · Licht · " + haus + " ══");
  const h = await oeffneHub(browser, { haus, korb: [KORB(haus)] }), p = h.p;
  await p.evaluate(() => { tourStarten(); }); await p.waitForTimeout(600);
  await p.evaluate(() => TOUR.gehe(0, 2)); await p.waitForTimeout(1300);   /* Start / Schnellzugriff */
  const g = await p.evaluate(() => TOUR.stand().gemessen);
  pruef(!!g, "Voraussetzung: der Schritt hat ein Licht", JSON.stringify(g));
  if(g){
    const pix = async () => { const buf = await p.screenshot(); return buf.toString("base64"); };
    const mit = await pix();
    await p.evaluate(() => { document.getElementById("tourWurzel").style.visibility = "hidden"; }); await p.waitForTimeout(80);
    const ohne = await pix();
    await p.evaluate(() => { document.getElementById("tourWurzel").style.visibility = ""; });
    const karte = await p.evaluate(() => { const r = document.querySelector(".tour-karte").getBoundingClientRect(); return { t: r.top, b: r.bottom }; });
    const kopf = await p.evaluate(() => document.querySelector(".tour-kopf").getBoundingClientRect().bottom);
    const m = await p.evaluate(async ([a, b, g, karte, kopf]) => {
      const lade = async s => { const i = new Image(); i.src = "data:image/png;base64," + s; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
        const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
      const A = await lade(a), B = await lade(b), W = A.width;
      const hell = (D, x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return .2126 * D.data[i] + .7152 * D.data[i + 1] + .0722 * D.data[i + 2]; };
      const mittel = (D, x0, y0, x1, y1) => { let s = 0, n = 0; for(let y = y0; y < y1; y += 3) for(let x = x0; x < x1; x += 3){ s += hell(D, x, y); n++; } return s / Math.max(1, n); };
      /* im Licht: die innere Hälfte des Ziels */
      const cx0 = g.x + g.b * .3, cx1 = g.x + g.b * .7, cy0 = g.y + g.h * .3, cy1 = g.y + g.h * .7;
      const innenMit = mittel(A, cx0, cy0, cx1, cy1), innenOhne = mittel(B, cx0, cy0, cx1, cy1);
      /* außerhalb: Streifen zwischen Kopfleiste und Licht bzw. unter dem Licht, 60 px Abstand, nicht unter der Karte */
      const proben = [];
      for(let y = kopf + 8; y < A.height - 4; y += 6){ if(y > g.y - 60 && y < g.y + g.h + 60) continue; if(y > karte.t - 4 && y < karte.b + 4) continue;
        for(let x = 10; x < W - 10; x += 8) proben.push([x, y]); }
      let am = 0, ao = 0; proben.forEach(([x, y]) => { am += hell(A, x, y); ao += hell(B, x, y); });
      am /= Math.max(1, proben.length); ao /= Math.max(1, proben.length);
      /* Rand: die Kante des Lichtfelds (1–3 px außen) darf nicht heller sein als das Licht innen (kein Ring) */
      let rand = 0; for(let x = g.x + 10; x < g.x + g.b - 10; x += 4){ rand = Math.max(rand, hell(A, x, g.y - 2), hell(A, x, g.y + g.h + 2)); }
      return { innenMit, innenOhne, aussenMit: am, aussenOhne: ao, proben: proben.length, rand };
    }, [mit, ohne, g, karte, kopf]);
    pruef(m.proben > 50, "Voraussetzung: genug Bildpunkte außerhalb des Lichts", String(m.proben));
    pruef(Math.abs(m.innenMit - m.innenOhne) <= 4, "im Licht steht die Seite unverdunkelt (Mitte des Ziels mit/ohne Tour gleich)", m.innenMit.toFixed(1) + " / " + m.innenOhne.toFixed(1));
    pruef(m.aussenOhne > 8 && m.aussenMit <= .2 * m.aussenOhne + 2, "außerhalb des Lichts mindestens 80 % dunkler", m.aussenMit.toFixed(1) + " / " + m.aussenOhne.toFixed(1));
    pruef(m.rand <= Math.max(m.innenMit, m.innenOhne) + 6, "am Rand des Lichts keine Linie, die heller ist als das Licht (kein Ring)", m.rand.toFixed(1) + " / " + m.innenMit.toFixed(1));
  }
  /* Die leere Auswahl-Leiste ist nur aus dem Bild geschoben — sie bekommt kein Licht (Fund 31.10., Foto) */
  const h2 = await oeffneHub(browser, { haus }), q = h2.p;
  await q.evaluate(() => { tourStarten(); }); await q.waitForTimeout(500);
  const bi = await q.evaluate(() => tourDef().bereiche.findIndex(b => b.id === "auswahl"));
  await q.evaluate(b => TOUR.gehe(b, 0), bi); await q.waitForTimeout(1500);
  const ab = await q.evaluate(() => { const st = TOUR.stand(), e = document.getElementById("auswahlbalken"), r = e ? e.getBoundingClientRect() : null;
    return { g: st.gemessen, vh: innerHeight, balkenAn: !!e && e.classList.contains("an"), balken: r && { t: r.top, b: r.bottom } }; });
  pruef(!ab.balkenAn, "Voraussetzung: leerer Korb, die Auswahl-Leiste ist nicht „an“", JSON.stringify(ab.balken));
  pruef(!!ab.g && ab.g.y + ab.g.h <= ab.vh + 1 && ab.g.y >= 0 && ab.g.h > 30, "leerer Korb: das Licht steht auf einem Ersatzziel im Bild, nicht unter dem Rand", JSON.stringify(ab.g));
  pruef(h.fehler.length === 0 && h2.fehler.length === 0, "keine Skriptfehler", h.fehler.concat(h2.fehler).join(" | "));
  await h.ctx.close(); await h2.ctx.close();
}

/* ── Vorführhaus im Showcase: kein Knopf, keine Tour ─────────── */
async function showcaseProbe(browser){
  console.log("\n══ Showcase der Landingpage (OMOTENO_DEMO_OHNE_GRUSS) ══");
  const h = await oeffneHub(browser, { haus: "nordstern", initSkript: "window.OMOTENO_DEMO_OHNE_GRUSS = true;" }), p = h.p;
  await p.waitForTimeout(1500);
  const da = await p.evaluate(() => { const e = document.getElementById("tourPille"); return !!e && !e.hidden; });
  pruef(!da, "im Telefon der Landingpage steht kein schwebender Knopf");
  await h.ctx.close();
}

(async () => {
  /* TEIL=block,knopf,schritt,bedien,rtl,text,sprache,farbe,bewegung,showcase — für die Gegenbeweise im Worktree; ohne Angabe läuft alles. */
  const teil = (process.env.TEIL || "").split(",").filter(Boolean), will = k => !teil.length || teil.includes(k);
  const haeuserFuer = k => (process.env.HAEUSER ? process.env.HAEUSER.split(",") : HAEUSER);
  if(will("block")) blockProbe();
  const br = await chromium.launch();
  if(will("knopf")) for(const haus of haeuserFuer()) await knopfProbe(br, haus);
  if(will("schritt")) for(const haus of haeuserFuer()) await schrittProbe(br, haus);
  if(will("bedien")) for(const haus of ["chocolamour", "nordstern"]) await bedienProbe(br, haus);
  if(will("rtl")) await rtlProbe(br);
  if(will("text")) await textProbe(br);
  if(will("sprache")) await sprachPassProbe(br);
  if(will("farbe")){
    console.log("\n══ 7 · Farben ══");
    for(const haus of haeuserFuer()) for(const licht of ["hell", "dunkel"]) await farbProbe(br, haus, licht);
  }
  if(will("bewegung")) for(const haus of ["chocolamour", "nordstern"]) await bewegungProbe(br, haus);
  if(will("licht")) for(const haus of ["chocolamour", "blend", "nordstern"]) await lichtProbe(br, haus);
  if(will("showcase")) await showcaseProbe(br);
  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
