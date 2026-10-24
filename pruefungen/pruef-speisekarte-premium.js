/* ═══════════════════════════════════════════════════════════════
   pruef-speisekarte-premium.js — Speisekarte der Premium-Startseite (Markenblatt "startstil":"premium")

   Kopfkarte, Suche als Pille, Kategorie-Chips, Produktkarten, Allergen-Pille, Mengen, Leiste, Navigation. Braucht dist/.
   Uhr UND Öffnungszeiten legt werkzeug/start-hub.js fest (§8.1j); die Bilder sind neutrale Testbilder.

   Preise, Namen und Allergene kommen aus nachgestellten DATENZEILEN (opt.zeilen) — nichts steht im Quelltext der Prüfung
   als „erwartet“, was nicht aus denselben Zeilen gelesen wurde. Allergene: nur was in der Zeile steht; eine Zeile
   ohne Angabe zeigt KEINE Pille (unbekannt ≠ frei, §0).
   Ehrliche Grenzen: kopfloses Chromium, keine Geräte, keine Live-Fotos, keine echte Datenbank.
   ═══════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { oeffneHub, BILD } = require("./werkzeug/start-hub.js");
const { kontrast, schlechtester, rect } = require("./werkzeug/messen.js");

let ok = 0, bad = 0;
const pruef = (name, bed, info) => { if(bed){ ok++; console.log("  ok   " + name); } else { bad++; console.log("  ROT  " + name + (info !== undefined ? "  → " + JSON.stringify(info) : "")); } };

/* Zeilen: Waffel mit zwei Allergenen, Banane mit einem + vegan, Cola ohne Angabe, Preise verändert (nicht die Vorgabe). */
const ZEILEN = rows => rows.map(r => {
  if(r.name === "Waffel Classic") return Object.assign({}, r, { allergene: "A,G", preis: 9.2 });
  if(r.name === "Banane Erdbeere") return Object.assign({}, r, { allergene: "G", preis: 11.4, veg: true, vegan: false });
  if(r.name === "Cola") return Object.assign({}, r, { preis: 3.6 });
  return r;
});
const OPT = { kopf: "hell", kachelFoto: true, zeilen: ZEILEN, hash: "#/speisekarte", breite: 390, hoehe: 844 };
const komma = n => n.toFixed(2).replace(".", ",") + " €";

async function lauf(b, kopf){
  console.log("\n══ " + kopf.name);

  /* ── 1. Aufbau, Daten, Karten ── */
  {
    const h = await oeffneHub(b, Object.assign({}, OPT, kopf.opt));
    const p = h.p;
    const a = await p.evaluate(() => ({
      seite: seiteJetzt, stil: document.body.dataset.kartenstil,
      kk: !!document.querySelector(".seite > .kopfkarte h2"), h2: document.querySelector(".kopfkarte h2").textContent,
      kkImg: document.querySelector(".kk-bild img") && document.querySelector(".kk-bild img").getAttribute("src"),
      karten: [...document.querySelectorAll(".gericht")].map(g => ({ n: g.querySelector(".n").textContent.trim(), p: g.querySelector(".p").textContent.trim(),
        tags: [...g.querySelectorAll(".gmerk .tag")].map(t => t.className.replace("tag ", "") + ":" + t.textContent.trim()), titel: (g.querySelector(".gallerg") || {}).title || "" })),
      chips: [...document.querySelectorAll(".chip")].map(c => c.dataset.g),
      gruppen: [...document.querySelectorAll(".gruppe")].map(g => g.dataset.gruppe) }));
    pruef("Speisekarte im Stil „liste“, Kopfkarte mit Überschrift", a.seite === "speisekarte" && a.stil === "liste" && a.kk && a.h2.length > 2, a);
    pruef("Kopfkarte zeigt das Kachel-Banner (echtes Bild der Kachel)", /\/kacheln\//.test(a.kkImg || ""), a.kkImg);
    const e = Object.fromEntries(a.karten.map(k => [k.n, k]));
    pruef("drei Produktkarten, Namen aus den Datenzeilen", ["Banane Erdbeere", "Waffel Classic", "Cola"].every(n => e[n]), a.karten.map(k => k.n));
    pruef("Preise = die Zeilen (nicht die Vorgabe 10,90 / 8,50 / 3,20)", e["Waffel Classic"].p === komma(9.2) && e["Banane Erdbeere"].p === komma(11.4) && e["Cola"].p === komma(3.6), a.karten.map(k => k.p));
    pruef("Kategorien dynamisch aus den Daten (Live-Zeilen kennen kein „Beliebt“): Alle · Süßes · Getränke", a.chips.join("|") === "Alle|Süßes|Getränke" && a.gruppen.join("|") === "Süßes|Getränke", [a.chips, a.gruppen]);
    pruef("Allergene nur aus der Zeile: Waffel „Allergene · 2“, Banane der eine Name, Cola KEINE Pille",
      e["Waffel Classic"].tags.some(t => /^gallerg:Allergene · 2$/.test(t)) && e["Banane Erdbeere"].tags.some(t => /^gallerg:Milch/.test(t)) && !e["Cola"].tags.some(t => /gallerg/.test(t)), a.karten);
    pruef("Pille nennt im title ALLE Namen der Zeile (Gluten, Milch)", /Glutenhaltiges Getreide/.test(e["Waffel Classic"].titel) && /Milch/.test(e["Waffel Classic"].titel), e["Waffel Classic"].titel);
    pruef("Merkmal „Vegetarisch“ der Banane als Pille in der Merkmalzeile, Waffel ohne", e["Banane Erdbeere"].tags.some(t => /^veg:/.test(t)) && !e["Waffel Classic"].tags.some(t => /^veg:/.test(t)), a.karten);
    pruef("keine Fehler", h.fehler.length === 0 && h.konsole.length === 0, [h.fehler, h.konsole]);

    pruef("ganz oben ist „Alle“ markiert (die Gruppenüberschrift darf nicht schon unter der Leiste stehen — katJetzt misst mit 8 px)", await p.evaluate(() => JSON.stringify([...document.querySelectorAll("#inhalt .chip.an")].map(c => c.dataset.g)) === '["Alle"]'));
    /* Layout: Bild links vom Text, Plus rechts unten, Touchflächen */
    const l = await p.evaluate(() => { const g = [...document.querySelectorAll(".gericht")].find(x => /Waffel/.test(x.textContent)); const r = s => { const e = g.querySelector(s); if(!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, r: b.right, y: b.y, b: b.bottom, w: b.width, h: b.height }; };
      return { bild: r(".gbild"), text: r(".gtext"), plus: r(".gplus"), preis: r(".p") }; });
    const gb = await p.evaluate(() => { const g = [...document.querySelectorAll(".gericht")].find(x => /Waffel/.test(x.textContent)).getBoundingClientRect(); return { r: g.right, b: g.bottom }; });
    pruef("Bild links vom Text, Plus rechts neben/unter dem Preis, innerhalb der Karte", l.bild && l.bild.r <= l.text.x + 1 && l.plus.r <= gb.r + 1 && l.plus.x > l.preis.r - 2 && l.plus.b <= gb.b + 1, l);
    pruef("Plus ≥ 44 × 44 px", l.plus.w >= 44 && l.plus.h >= 44, l.plus);

    /* Suche */
    await p.fill("#suchfeld", "waff"); await p.waitForTimeout(500);
    const s1 = await p.evaluate(() => ({ n: [...document.querySelectorAll(".gericht .n")].map(x => x.textContent.trim()), leer: !!document.querySelector(".seite > .leer"), wert: document.getElementById("suchfeld").value }));
    pruef("Suche „waff“ zeigt genau die Waffel, Feld behält den Text", s1.n.length === 1 && /Waffel/.test(s1.n[0]) && s1.wert === "waff", s1);
    await p.fill("#suchfeld", "xyzzy"); await p.waitForTimeout(500);
    const s2 = await p.evaluate(() => ({ n: document.querySelectorAll(".gericht").length, leer: (document.querySelector(".leer") || {}).textContent || "" }));
    pruef("Suche ohne Treffer: verständlicher Satz statt leerer Fläche", s2.n === 0 && s2.leer.length > 10, s2);
    await p.locator(".clear.an").click(); await p.waitForTimeout(400);
    pruef("Löschen-Kreuz bringt alle Gerichte zurück", await p.evaluate(() => document.querySelectorAll(".gericht").length === 3));

    /* Filter */
    await p.locator(".sf-knopf").click(); await p.waitForTimeout(300);
    pruef("Filterknopf öffnet das Filterfeld (aria-expanded)", await p.evaluate(() => document.querySelector(".sf-knopf").getAttribute("aria-expanded") === "true" && !document.getElementById("sfFeld").hidden));
    await p.locator('.sf-chip[data-sf="vegan"]').click(); await p.waitForTimeout(400);
    const f1 = await p.evaluate(() => ({ n: document.querySelectorAll(".gericht").length, weg: !!document.querySelector(".sf-weg"), zahl: (document.querySelector(".sf-zahl") || {}).textContent }));
    pruef("Filter „Vegan“ (kein Gericht vegan): leer, „Filter zurücksetzen“ da, Zahl am Knopf", f1.n === 0 && f1.weg && f1.zahl === "1", f1);
    await p.locator(".leer .sf-weg").click(); await p.waitForTimeout(400);
    pruef("Zurücksetzen bringt alle drei zurück, Zahl am Knopf weg", await p.evaluate(() => document.querySelectorAll(".gericht").length === 3 && !document.querySelector(".sf-zahl")));
    await p.locator('.sf-chip[data-sf="veg"]').click(); await p.waitForTimeout(400);
    pruef("Filter „Vegetarisch“ lässt genau die Banane (Merkmal aus der Zeile) stehen", await p.evaluate(() => { const n = [...document.querySelectorAll(".gericht .n")].map(x => x.textContent.trim()); return n.length === 1 && /Banane/.test(n[0]); }));
    await p.locator('.sf-chip[data-sf="veg"]').click(); await p.waitForTimeout(300);
    await p.locator(".sf-knopf").click(); await p.waitForTimeout(300);

    /* Mengen, Summe, Leiste */
    const plusW = p.locator('.gericht:has-text("Waffel") .gplus');
    await plusW.click(); await p.waitForTimeout(500);
    const m1 = await p.evaluate(() => ({ m: merk["Waffel Classic"] && merk["Waffel Classic"].m, z: document.getElementById("auswahlzahl").textContent, s: document.getElementById("auswahlsumme").textContent, bal: document.getElementById("auswahlbalken").classList.contains("an"), mz: (document.querySelector('.gericht:has(.n)') && [...document.querySelectorAll(".gmz")].map(x => x.textContent)) }));
    pruef("„+“ legt die Waffel in die Auswahl: Menge 1, Leiste da, Zahl 1, Summe = Zeile", m1.m === 1 && m1.bal && m1.z === "1" && m1.s === komma(9.2) && m1.mz.join() === "1", m1);
    await p.locator('.gericht:has-text("Waffel") [data-kschritt="1"]').click(); await p.waitForTimeout(400);
    const m2 = await p.evaluate(() => ({ z: document.getElementById("auswahlzahl").textContent, s: document.getElementById("auswahlsumme").textContent, mz: [...document.querySelectorAll(".gmz")].map(x => x.textContent) }));
    pruef("Mengenregler „+“: Menge 2, Summe 2 × Preis", m2.z === "2" && m2.s === komma(18.4) && m2.mz.join() === "2", m2);
    await p.locator('.gericht:has-text("Cola") .gplus').click(); await p.waitForTimeout(400);
    pruef("zweites Gericht: Zahl 3, Summe addiert", await p.evaluate(([z, s]) => document.getElementById("auswahlzahl").textContent === "3" && document.getElementById("auswahlsumme").textContent === s, [3, komma(18.4 + 3.6)]));
    for(let i = 0; i < 2; i++){ await p.locator('.gericht:has-text("Waffel") [data-kschritt="-1"]').click(); await p.waitForTimeout(350); }
    const m3 = await p.evaluate(() => ({ weg: !merk["Waffel Classic"], plus: !!document.querySelector('.gericht .gplus[data-merk="Waffel%20Classic"]'), z: document.getElementById("auswahlzahl").textContent, s: document.getElementById("auswahlsumme").textContent }));
    pruef("zweimal „−“ nimmt die Waffel heraus, das „+“ kehrt zurück, Rest = Cola", m3.weg && m3.plus && m3.z === "1" && m3.s === komma(3.6), m3);
    await p.locator('.gericht:has-text("Cola") [data-kschritt="-1"]').click(); await p.waitForTimeout(500);
    pruef("letztes Gericht heraus: Leiste verschwindet", await p.evaluate(() => !document.getElementById("auswahlbalken").classList.contains("an")));

    /* Details auf und zu */
    await p.locator('.gericht:has-text("Waffel") .ginfo').click(); await p.waitForTimeout(700);
    const d = await p.evaluate(() => ({ an: document.getElementById("warenkarte").classList.contains("an"), name: (document.querySelector("#warenkarte .wn") || {}).textContent, stoffe: [...document.querySelectorAll("#warenkarte .wname")].map(x => x.textContent) }));
    pruef("Tipp auf die Karte öffnet das Detailblatt mit den Allergenen AUS DER ZEILE (Gluten, Milch)", d.an && /Waffel/.test(d.name || "") && d.stoffe.some(x => /Gluten/.test(x)) && d.stoffe.some(x => /Milch/.test(x)) && d.stoffe.length === 2, d);
    await p.keyboard.press("Escape"); await p.waitForTimeout(600);
    pruef("Escape schließt das Detailblatt", await p.evaluate(() => !document.getElementById("warenkarte").classList.contains("an")));
    await p.locator('.gericht:has-text("Cola") .ginfo').click(); await p.waitForTimeout(700);
    pruef("Gericht ohne Angabe: Blatt sagt „noch nicht hinterlegt“, behauptet nichts", await p.evaluate(() => /noch nicht hinterlegt/.test(document.getElementById("warenkarte").textContent) && !document.querySelector("#warenkarte .wstoff")));
    await p.keyboard.press("Escape"); await p.waitForTimeout(500);
    pruef("keine Fehler nach der Bedienung", h.fehler.length === 0 && h.konsole.length === 0, [h.fehler, h.konsole]);
    await h.ctx.close();
  }

  /* ── 2. Kopfkarte: Text auf dem Schleier, helles UND dunkles Foto, Tag UND Abend ── */
  for(const foto of ["kopf-hell", "kopf-dunkel"]) for(const farbe of ["hell", "dunkel"]){
    const h = await oeffneHub(b, Object.assign({}, OPT, kopf.opt, { farbe, reduziert: true }));
    const p = h.p;
    await p.evaluate(([b64]) => { const k = KACHELN.find(x => x.art === "karte"); k.unter = "Frisch gemacht, jeden Tag."; zeichne();
      const i = document.querySelector(".kk-bild img"); i.src = "data:image/jpeg;base64," + b64; return i.decode(); }, [BILD[foto].toString("base64")]);
    await p.waitForTimeout(400);
    const m = { Titel: await schlechtester(p, ".kopfkarte h2"), Zeile: await schlechtester(p, ".kopfkarte .unter") };
    pruef("Foto " + foto.slice(5) + ", Licht " + farbe + ": Titel und Zeile ≥ 4,5:1 am schlechtesten Bildpunkt", Object.values(m).every(v => v !== null && v >= 4.5), m);
    await h.ctx.close();
  }

  /* ── 3. Kopfkarte ohne Foto, Karte ohne Bilder, Foto lädt nicht ── */
  {
    const h = await oeffneHub(b, Object.assign({}, OPT, kopf.opt, { kachelFoto: false }));
    const p = h.p;
    await p.evaluate(() => { alleKarten().forEach(([, d]) => d.forEach(g => g.eintraege.forEach(e => { e.bild = ""; e.bf = ""; }))); zeichne(); });
    await p.waitForTimeout(300);
    const k = await p.evaluate(() => ({ bild: !!document.querySelector(".kk-bild"), kk: !!document.querySelector(".kopfkarte"), gb: document.querySelectorAll(".gbild").length, n: document.querySelectorAll(".gericht").length,
      pl: [...document.querySelectorAll(".gericht .gplus")].map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }) }));
    pruef("ohne irgendein Foto: Kopfkarte ohne Bildkasten, Karten ohne leeren Bildplatz, Plus bleibt", k.kk && !k.bild && k.gb === 0 && k.n === 3 && k.pl.length === 3 && k.pl.every(x => x[0] >= 44), k);
    const n0 = h.anfragen.length;
    await p.evaluate(() => { const k = KACHELN.find(x => x.art === "karte"); k.banner = "http://fremd.example/x.jpg"; zeichne(); }); await p.waitForTimeout(300);
    pruef("Banner mit http:// fremd wird nicht ins Kopfbild genommen, keine Anfrage dorthin", await p.evaluate(() => !document.querySelector(".kk-bild")) && !h.anfragen.slice(n0).some(u => /fremd\.example/.test(u)), h.anfragen.filter(u => /fremd/.test(u)));
    const sp = await p.evaluate(() => { const g = document.querySelector(".gericht"), t = g.querySelector(".gtext").getBoundingClientRect(), r = g.getBoundingClientRect(); return { links: t.x - r.x, w: t.width }; });
    pruef("ohne Bild rückt der Text nach vorn (kein Leerraum links)", sp.links < 20, sp);
    await h.ctx.close();
  }
  {
    const h = await oeffneHub(b, Object.assign({}, OPT, kopf.opt));
    const p = h.p;
    await p.route("**/storage/v1/object/public/**", r => r.abort());
    await p.evaluate(() => zeichne()); await p.waitForTimeout(800);
    const k = await p.evaluate(() => ({ n: document.querySelectorAll(".gericht").length, plus: document.querySelectorAll(".gericht .gplus").length, namen: [...document.querySelectorAll(".gericht .n")].every(x => x.textContent.trim().length > 2),
      preise: [...document.querySelectorAll(".gericht .p")].every(x => /\d,\d\d/.test(x.textContent)) }));
    pruef("Fotos laden nicht: alle Karten mit Name, Preis und Plus bleiben", k.n === 3 && k.plus === 3 && k.namen && k.preise, k);
    await h.ctx.close();
  }

  /* ── 4. Datenbank antwortet mit Fehler: Seite bleibt benutzbar ── */
  {
    const h = await oeffneHub(b, Object.assign({}, OPT, kopf.opt, { gerichteFehler: true }));
    const p = h.p;
    const k = await p.evaluate(() => ({ seite: seiteJetzt, n: document.querySelectorAll(".gericht").length, such: !!document.getElementById("suchfeld"), chips: document.querySelectorAll(".chip").length }));
    pruef("Datenbank 500: keine JS-Fehler, Seite steht mit Suche und Karte (Rückfallkarte des Hauses)", h.fehler.length === 0 && k.seite === "speisekarte" && k.such && k.chips >= 1, [k, h.fehler]);
    await h.ctx.close();
  }

  /* ── 5. Breiten: nichts läuft über, nichts verdeckt, Fuß frei ── */
  for(const [w, hh] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1280, 800]]){
    const h = await oeffneHub(b, Object.assign({}, OPT, kopf.opt, { breite: w, hoehe: hh, korb: ["Waffel Classic", "Cola"] }));
    const p = h.p;
    const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    pruef(w + " px: kein horizontales Scrollen", o.sw <= o.cw, o);
    const c = await p.evaluate(() => ({ chips: [...document.querySelectorAll(".chip")].map(x => Math.round(x.getBoundingClientRect().height)), suche: document.getElementById("suchfeld").getBoundingClientRect().height,
      knopf: (() => { const r = document.querySelector(".sf-knopf").getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
      karten: [...document.querySelectorAll(".gericht")].map(g => { const r = g.getBoundingClientRect(); const t = g.querySelector(".gtext").getBoundingClientRect(); return { ein: r.left >= -.5 && r.right <= innerWidth + .5, text: t.width, plus: (() => { const q = g.querySelector(".gplus, .gmenge").getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height), q.right <= r.right + .5 && q.left >= r.left - .5]; })() }; }) }));
    pruef(w + " px: Chips ≥ 44 px, Suchfeld ≥ 48, Filterknopf 44 × 44", c.chips.every(x => x >= 44) && c.suche >= 48 && c.knopf[0] >= 44 && c.knopf[1] >= 44, c);
    pruef(w + " px: jede Karte im Bild, Textspalte ≥ 100 px, Plus/Regler ≥ 44 hoch und in der Karte", c.karten.every(k => k.ein && k.text >= 100 && k.plus[1] >= 44 && k.plus[2]), c.karten);
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(300);
    const un = await p.evaluate(() => { const nav = document.getElementById("hauptnav").getBoundingClientRect(), bal = document.getElementById("auswahlbalken"), br = bal.getBoundingClientRect();
      const ls = [...document.querySelectorAll(".hinweis, .hinweis *, footer a, footer p, footer button, .gericht, .preisnote")].filter(e => e.getBoundingClientRect().height > 0).map(e => e.getBoundingClientRect().bottom);
      return { maxB: Math.max.apply(null, ls), decke: Math.min(nav.top, bal.classList.contains("an") ? br.top : 1e9), nav: nav.top, tab: document.querySelector('.hn-tab[aria-current="page"]') && document.querySelector('.hn-tab[aria-current="page"]').dataset.hn }; });
    pruef(w + " px: ganz unten endet der Inhalt über Leiste und Navigation, Tab „Karte“ aktiv", un.maxB <= un.decke + 1 && un.tab === "karte", un);
    pruef(w + " px: keine Fehler", h.fehler.length === 0 && h.konsole.length === 0, [h.fehler, h.konsole]);
    await h.ctx.close();
  }

  /* ── 6. Mit dem Finger rollen: klebende Leiste, Chips verdecken nichts ── */
  {
    const h = await oeffneHub(b, Object.assign({}, OPT, kopf.opt, { korb: ["Cola"] }));
    const p = h.p;
    await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(300);
    const v = await p.evaluate(() => { const c = document.querySelector(".chips").getBoundingClientRect(), n = document.getElementById("hauptnav").getBoundingClientRect();
      const punkt = [...document.querySelectorAll(".chip")].map(ch => { const r = ch.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e && ch.contains(e); });
      return { oben: c.top, punkt, navTop: n.top }; });
    pruef("gerollt: Chips kleben oben (unter der Kopfleiste, ≤ 100 px) und jeder Chip ist antippbar (nichts liegt darüber)", v.oben <= 100 && v.punkt.length >= 3 && v.punkt.every(Boolean), v);
    await h.ctx.close();
  }

  /* ── 7. Arabisch: Bild am Anfang (rechts), Plus links, Kopfkarte gespiegelt ── */
  {
    const h = await oeffneHub(b, Object.assign({}, OPT, kopf.opt, { sprache: "ar", breite: 360 }));
    const p = h.p;
    const a = await p.evaluate(() => { const g = document.querySelector(".gericht.gmitbild"); const r = g.getBoundingClientRect(), bi = g.querySelector(".gbild").getBoundingClientRect(), pl = g.querySelector(".gplus, .gmenge").getBoundingClientRect(), t = g.querySelector(".gtext").getBoundingClientRect();
      const kb = document.querySelector(".kk-bild"), kk = document.querySelector(".kopfkarte").getBoundingClientRect(), kbr = kb ? kb.getBoundingClientRect() : null;
      return { dir: document.documentElement.dir, bildRechts: bi.right >= r.right - 20 && bi.x > t.x, plusLinks: pl.left <= r.left + 20, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, kkBildLinks: kbr ? kbr.x <= kk.x + 2 : null, name: document.querySelector(".kopfkarte h2").textContent }; });
    pruef("Arabisch: Bild rechts, Plus links, Kopfkarte-Foto links (gespiegelt), kein Überlauf", a.dir === "rtl" && a.bildRechts && a.plusLinks && a.sw <= a.cw && a.kkBildLinks === true, a);
    pruef("Arabisch: keine Fehler", h.fehler.length === 0 && h.konsole.length === 0, [h.fehler, h.konsole]);
    await h.ctx.close();
  }

  /* ── 8. Reduzierte Bewegung ── */
  {
    const h = await oeffneHub(b, Object.assign({}, OPT, kopf.opt, { reduziert: true }));
    const a = await h.p.evaluate(() => document.getAnimations().filter(x => x.effect && x.effect.target && x.effect.target.closest && x.effect.target.closest(".kopfkarte, .gericht, .chips, .suche")).map(x => (x.animationName || x.transitionProperty || "?") + ":" + x.playState).filter(s => /running/.test(s)));
    pruef("reduzierte Bewegung: an Kopfkarte, Karten, Chips, Suche läuft nichts", a.length === 0, a);
    await h.ctx.close();
  }

  /* ── 9. Kontrollfall: Schalter aus → nichts Neues im Bild ── */
  {
    const h = await oeffneHub(b, Object.assign({}, OPT, kopf.opt, { stil: "klassisch" }));
    await h.p.evaluate(() => { location.hash = "#/speisekarte"; }); await h.p.waitForTimeout(500);
    const k = await h.p.evaluate(() => ({ kk: !!document.querySelector(".kopfkarte"), gm: !!document.querySelector(".gmerk"), gallerg: !!document.querySelector(".gallerg"), tagImN: !!document.querySelector(".gericht .n .tag"), nav: !!document.body.dataset.nav, h2: !!document.querySelector(".seite > h2") }));
    pruef("klassisch: Titel als h2 in der Seite, keine Kopfkarte, keine Pillenreihe, Merkmale im Namen", !k.kk && !k.gm && !k.gallerg && k.tagImN && !k.nav && k.h2, k);
    await h.ctx.close();
  }
}

(async () => {
  const b = await chromium.launch();
  await lauf(b, { name: "Choco L'AMouR (Markenblatt: premium)", opt: { haus: "chocolamour" } });
  await lauf(b, { name: "Blend (Schalter nur für die Probe)", opt: { haus: "blend", stil: "premium" } });
  await b.close();
  console.log("\n" + ok + " ok, " + bad + " rot");
  process.exit(bad ? 1 : 0);
})();
