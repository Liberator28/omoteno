/* ═══════════════════════════════════════════════════════════════
   pruef-startlayout.js — Layout je Haus (Markenblatt "startlayout", nur mit startstil "premium")

   Sieben Regler (ecken, kopf, wege, produktbild, dichte, chips, navigation) und vier Profile (standard, bistro, cafe, bar).
   Braucht dist/. Uhr UND Öffnungszeiten legt werkzeug/start-hub.js fest (§8.1j); die Bilder sind neutrale Testbilder.

   Gemessen wird am gemalten Bild (getComputedStyle / Rechtecke), nicht am Quelltext:
     · Standard = unverändert: ohne Angabe und mit lauter Standardwerten kein Attribut, dieselben Maße wie vorher
     · jeder Regler wirkt an der Stelle, die er verspricht (Radien, Kopfhöhe, Bildhöhe, Dichte, Bildseite, Chips, Navigation)
     · Profile sind Vorbelegung; ein Regler schlägt das Profil; ein Wert gleich dem Standard setzt nichts
     · ungültige Werte / fremde Schlüssel / Prototyp-Namen setzen NIE ein Attribut (kein roher Wert im Bild, §2.3a)
     · jedes Profil × Start/Karte × 360/390/430/1280 px: kein Überlauf, Tapflächen ≥ 44 px, Text nicht abgeschnitten
     · Chips „aus“ lässt den klassischen Bestellart-Schalter erreichbar (§7: kein Weg verschwindet)
     · Navigation „schlank“: Name bleibt für Vorleser; „aus“: keine Leiste, keine Reserve
     · Produktbild „aus“: das Foto wird nicht geladen
     · Arabisch: Bild rechts/oben spiegelt mit der Leserichtung
   Ehrliche Grenzen: kopfloses Chromium, keine Geräte, neutrale Testbilder; Safari nicht gemessen.
   ═══════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { oeffneHub, EIMER, BETRIEB } = require("./werkzeug/start-hub.js");

let ok = 0, bad = 0;
const pruef = (name, bed, info) => { if(bed){ ok++; console.log("  ok   " + name); } else { bad++; console.log("  ROT  " + name + (info !== undefined ? "  → " + JSON.stringify(info) : "")); } };
const LIEFER = { an: true, plz: ["10115"], zeiten: { von: "11:00", bis: "23:00", tage: [1, 2, 3, 4, 5, 6, 7] } };
const KORB = ["Banane Erdbeere", "Waffel Classic", "Cola"];
const OPT = { kopf: "hell", kachelFoto: true, liefer: LIEFER, korb: KORB, breite: 390, hoehe: 844 };

/* Die zweite Quelle: Regler und Profile aus dem Gerüst gelesen, nicht noch einmal abgeschrieben. */
const GERUEST = fs.readFileSync(path.join(__dirname, "..", "vorlagen", "hub.vorlage.html"), "utf8");
const aus = n => new Function("return (" + GERUEST.match(new RegExp("const " + n + " = (\\{[\\s\\S]*?\\n\\});"))[1] + ")")();
const REGLER = aus("LAYOUT_REGLER"), PROFILE = aus("LAYOUT_PROFILE");

const ATTR = { ecken: "plEcken", kopf: "plKopf", wege: "plWege", produktbild: "plProdukt", dichte: "plDichte", chips: "plChips", navigation: "plNav" };
const attrs = p => p.evaluate(() => Object.fromEntries(Object.entries(document.body.dataset).filter(([k]) => /^pl[A-Z]/.test(k))));

/* Alle Maße, die ein Regler ändern darf, an einer Stelle: einmal vor, einmal nach. */
async function startMasse(p){
  return p.evaluate(() => {
    const px = (s, e) => { const el = document.querySelector(s); return el ? getComputedStyle(el)[e] : null; };
    const r = s => { const el = document.querySelector(s); if(!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom), r: Math.round(b.right) }; };
    return { szRadius: px(".sz.sz-p", "borderRadius"), szBild: r(".sz.sz-p .sz-bild"), szBreit: r(".sz-p.sz-breit .sz-bild"), begleiter: px(".begleiter", "borderRadius"),
      kopf: r("header"), logo: r(".logo"), chipRadius: px(".ba-chip", "borderRadius"), chip: r(".ba-chip"), bestellart: px(".bestellart", "display"),
      auswahlRadius: px(".auswahlbalken", "borderRadius"), tab: r(".hn-tab"), nav: r("#hauptnav"), tabRadius: px(".hn-tab", "borderRadius"),
      ueberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
}
async function karteMasse(p){
  await p.evaluate(() => { location.hash = "#/speisekarte"; });
  await p.waitForSelector(".gericht", { timeout: 6000 });
  await p.waitForTimeout(600);
  return p.evaluate(() => {
    const px = (s, e) => { const el = document.querySelector(s); return el ? getComputedStyle(el)[e] : null; };
    const r = (s, w) => { const el = (w || document).querySelector(s); if(!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom), r: Math.round(b.right) }; };
    const g = document.querySelector(".gericht.gmitbild") || document.querySelector(".gericht");
    return { kopfkarte: px(".kopfkarte", "borderRadius"), sucheRadius: px(".suche input", "borderRadius"), chipRadius: px(".chip", "borderRadius"),
      gericht: g ? { radius: getComputedStyle(g).borderRadius, pad: getComputedStyle(g).paddingTop, mb: getComputedStyle(g).marginBottom, r: r(":scope", null) } : null,
      g: g ? (() => { const b = g.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; })() : null,
      gbild: g ? r(".gbild", g) : null, gbildAnzeige: g && g.querySelector(".gbild") ? getComputedStyle(g.querySelector(".gbild")).display : null,
      gbildRadius: g && g.querySelector(".gbild") ? getComputedStyle(g.querySelector(".gbild")).borderRadius : null,
      gtext: g ? r(".gtext", g) : null, plus: g ? r(".gplus, .gmenge", g) : null, ueberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      hn: document.body.dataset.nav || null };
  });
}
async function lauf(browser, layout, opt){
  const h = await oeffneHub(browser, Object.assign({}, OPT, { stil: "premium", layout }, opt || {}));
  return h;
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());

  console.log("══ Gerüst-Listen ══");
  pruef("sieben Regler, vier Profile (zweite Quelle aus dem Gerüst)", Object.keys(REGLER).length === 7 && Object.keys(PROFILE).join() === "standard,bistro,cafe,bar", Object.keys(REGLER).join());
  pruef("jedes Profil nennt jeden Regler mit einem erlaubten Wert", Object.entries(PROFILE).every(([, w]) => Object.keys(REGLER).every(k => REGLER[k].indexOf(w[k]) >= 0)));
  pruef("das Profil „standard“ nimmt je Regler den ERSTEN Wert nicht an, sondern den heutigen (rund, hoch, bild, links, luftig, an, leiste)",
    JSON.stringify(PROFILE.standard) === JSON.stringify({ ecken: "rund", kopf: "hoch", wege: "bild", produktbild: "links", dichte: "luftig", chips: "an", navigation: "leiste" }));
  pruef("Attribut-Namen = Regler (kein Regler ohne Attribut)", Object.keys(REGLER).every(k => /plEcken|plKopf|plWege|plProdukt|plDichte|plChips|plNav/.test(Object.values(ATTR)[Object.keys(ATTR).indexOf(k)] || "")));

  console.log("\n══ 1 · Standard = unverändert ══");
  let ref, refKarte;
  {
    const h = await lauf(browser, null);
    pruef("ohne startlayout: kein Attribut data-pl-… am body", JSON.stringify(await attrs(h.p)) === "{}", await attrs(h.p));
    ref = await startMasse(h.p); refKarte = await karteMasse(h.p);
    pruef("Maße wie vorher: Karten 22 px, Kopf ≥ 300 px, Logo 104 px, Wege-Bild ≥ 92 px, Chip-Pille 999 px",
      ref.szRadius === "22px" && ref.kopf.h >= 300 && ref.logo.w === 104 && ref.szBild.h >= 92 && /^(999|3\.35544e\+07)px$|33554400px/.test(ref.chipRadius), JSON.stringify([ref.szRadius, ref.kopf.h, ref.logo.w, ref.szBild.h, ref.chipRadius]));
    pruef("Speisekarte wie vorher: Karte 20 px, Polster 12 px, Abstand 12 px, Bild 96 px links vom Text",
      refKarte.gericht.radius === "20px" && refKarte.gericht.pad === "12px" && refKarte.gericht.mb === "12px" && refKarte.gbild.w === 96 && refKarte.gbild.x < refKarte.gtext.x, JSON.stringify([refKarte.gericht, refKarte.gbild]));
    pruef("keine JS-Fehler", h.fehler.length === 0, h.fehler);
    await h.ctx.close();
  }
  for(const [name, l] of [["leeres Objekt", {}], ["Profil standard", { profil: "standard" }], ["alle Regler auf Standardwerten", PROFILE.standard],
    ["bistro, aber jeder Regler zurück auf Standard", Object.assign({ profil: "bistro" }, PROFILE.standard)]]){
    const h = await lauf(browser, l);
    const m = await startMasse(h.p), k = await karteMasse(h.p);
    pruef(name + ": kein Attribut und dieselben Maße wie ohne Angabe",
      JSON.stringify(await attrs(h.p)) === "{}" && JSON.stringify(m) === JSON.stringify(ref) && JSON.stringify(k) === JSON.stringify(refKarte), await attrs(h.p));
    await h.ctx.close();
  }

  console.log("\n══ 2 · Jeder Regler wirkt ══");
  {
    const h = await lauf(browser, { ecken: "eckig" }); const m = await startMasse(h.p), k = await karteMasse(h.p);
    pruef("ecken eckig: Karten 6 px, Begleiter 6 px, Chips 8 px, Karte der Speise 4 px, Bildecke 4 px, Suche und Kategorien 8 px",
      m.szRadius === "6px" && m.begleiter === "6px" && m.chipRadius === "8px" && k.gericht.radius === "4px" && k.gbildRadius === "4px" && k.sucheRadius === "8px" && k.chipRadius === "8px" && k.kopfkarte === "6px",
      JSON.stringify([m.szRadius, m.begleiter, m.chipRadius, k.gericht.radius, k.gbildRadius, k.sucheRadius, k.chipRadius, k.kopfkarte]));
    pruef("ecken eckig: nur plEcken gesetzt", JSON.stringify(await attrs(h.p)) === '{"plEcken":"eckig"}');
    pruef("ecken eckig: Auswahl-Leiste und Tab 4/4 px (Auswahl 4 = 6−2)", m.auswahlRadius === "4px" && m.tabRadius === "4px", [m.auswahlRadius, m.tabRadius]);
    await h.ctx.close();
  }
  {
    const h = await lauf(browser, { ecken: "weich" }); const m = await startMasse(h.p), k = await karteMasse(h.p);
    pruef("ecken weich: Karten 14 px, Chips 14 px, Speisekarte 12 px, Bildecke 10 px", m.szRadius === "14px" && m.chipRadius === "14px" && k.gericht.radius === "12px" && k.gbildRadius === "10px", JSON.stringify([m.szRadius, m.chipRadius, k.gericht.radius, k.gbildRadius]));
    await h.ctx.close();
  }
  {
    const h = await lauf(browser, { kopf: "kompakt" }); const m = await startMasse(h.p);
    pruef("kopf kompakt: Kopf mindestens 220 und mindestens 50 px niedriger als vorher, Logo 76 px", m.kopf.h >= 220 && m.kopf.h <= ref.kopf.h - 50 && m.logo.w === 76, JSON.stringify([m.kopf.h, ref.kopf.h, m.logo.w]));
    pruef("kopf kompakt: die Knopfzeile oben rechts deckt weder Logo noch Pille noch Slogan", await h.p.evaluate(() => { const w = document.querySelector(".kopfwahl").getBoundingClientRect();
      return [".logo", "#status", "#claim"].every(sel => { const e = document.querySelector(sel); if(!e) return true; const b = e.getBoundingClientRect(); return b.right <= w.left + 1 || b.left >= w.right - 1 || b.bottom <= w.top + 1 || b.top >= w.bottom - 1; }); }));
    pruef("kopf kompakt: Chips und Slogan liegen ganz im Kopf", await h.p.evaluate(() => { const k = document.querySelector("header").getBoundingClientRect(); return [".ba-chip", "#claim", "#status"].every(s => { const e = document.querySelector(s); if(!e) return true; const b = e.getBoundingClientRect(); return b.top >= k.top - 1 && b.bottom <= k.bottom + 1; }); }));
    await h.ctx.close();
  }
  {
    const h = await lauf(browser, { wege: "kompakt" }); const m = await startMasse(h.p);
    pruef("wege kompakt: Bildfläche 64 px, breite Karte 56 px (vorher höher)", m.szBild.h === 64 && (m.szBreit === null || m.szBreit.h === 56) && m.szBild.h < ref.szBild.h, JSON.stringify([m.szBild, m.szBreit, ref.szBild]));
    pruef("wege kompakt: Name und Zeile der Karte bleiben sichtbar (nicht abgeschnitten)", await h.p.evaluate(() => [...document.querySelectorAll(".sz-p .sz-text")].every(e => e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().height > 10)));
    await h.ctx.close();
  }
  {
    const h = await lauf(browser, { dichte: "dicht" }); const k = await karteMasse(h.p);
    pruef("dichte dicht: Polster 9, Abstand 8, Bild 76 px — Karte niedriger als vorher", k.gericht.pad === "9px" && k.gericht.mb === "8px" && k.gbild.w === 76 && k.g.h < refKarte.g.h, JSON.stringify([k.gericht, k.gbild.w, k.g.h, refKarte.g.h]));
    pruef("dichte dicht: Plus bleibt ≥ 44 px und in der Karte", k.plus.w >= 44 && k.plus.h >= 44 && k.plus.r <= k.g.r && k.plus.b <= k.g.b, JSON.stringify([k.plus, k.g]));
    await h.ctx.close();
  }
  {
    const h = await lauf(browser, { produktbild: "rechts" }); const k = await karteMasse(h.p);
    pruef("produktbild rechts: Bild rechts vom Text, ohne Überlappung", k.gbild.x >= k.gtext.r - 1 && k.gbild.r <= k.g.r + 1, JSON.stringify([k.gbild, k.gtext]));
    pruef("produktbild rechts: das Plus liegt in der Karte und ≥ 44 px", k.plus.w >= 44 && k.plus.r <= k.g.r && k.plus.b <= k.g.b, k.plus);
    await h.ctx.close();
  }
  {
    const h = await lauf(browser, { produktbild: "oben" }); const k = await karteMasse(h.p);
    pruef("produktbild oben: Bild über dem Text, so breit wie die Karte innen, 150 px", k.gbild.b <= k.gtext.y + 1 && k.gbild.h === 150 && k.gbild.w >= k.g.w - 30, JSON.stringify([k.gbild, k.gtext]));
    await h.ctx.close();
  }
  {
    /* Geladen heißt: das <img> im Gericht hat Pixel. (Anfragen zu zählen mischt die Auswahl-Leiste und die Kopfkarte hinein,
       die dasselbe Foto zeigen.) */
    const geladen = async layout => { const h = await lauf(browser, layout, { hash: "#/speisekarte" }); await h.p.waitForTimeout(900);
      const n = await h.p.evaluate(() => [...document.querySelectorAll(".gericht .gbild img")].filter(i => i.complete && i.naturalWidth > 0).length);
      const alle = await h.p.evaluate(() => document.querySelectorAll(".gericht .gbild img").length);
      const k = await karteMasse(h.p); await h.ctx.close(); return { n, alle, k }; };
    const mit = await geladen({ produktbild: "links" }), ohne = await geladen({ produktbild: "aus" });
    pruef("produktbild aus: Bild nicht angezeigt, Karte niedriger, Text füllt die Breite", ohne.k.gbildAnzeige === "none" && ohne.k.g.h < mit.k.g.h && ohne.k.gtext.w > mit.k.gtext.w + 60, JSON.stringify([ohne.k.gbildAnzeige, ohne.k.g.h, mit.k.g.h, ohne.k.gtext.w, mit.k.gtext.w]));
    pruef("produktbild aus: die Fotos in den Gerichten werden nicht geladen (mit Bild: geladen)", mit.alle >= 2 && mit.n >= 2 && ohne.n === 0, [mit.n + "/" + mit.alle, ohne.n + "/" + ohne.alle]);
  }
  {
    const h = await lauf(browser, { chips: "aus" });
    const a = await h.p.evaluate(() => { const l = document.getElementById("lieferwahl"), b = l.getBoundingClientRect(), k = l.querySelector('[data-lieferwahl="liefern"]').getBoundingClientRect();
      return { chips: getComputedStyle(document.querySelector(".bestellart")).display, schalter: getComputedStyle(l).display, w: Math.round(b.width), h: Math.round(b.height), knopf: Math.round(k.height), sichtbar: !l.hidden && b.width > 0 }; });
    pruef("chips aus: keine Bestellart-Chips, dafür ist der klassische Schalter oben da (sichtbar, ≥ 44 px)", a.chips === "none" && a.schalter !== "none" && a.sichtbar && a.knopf >= 44, JSON.stringify(a));
    await h.p.click('#lieferwahl [data-lieferwahl="liefern"]'); await h.p.waitForTimeout(500);
    pruef("… und ein echter Tipp darauf schaltet auf Lieferung (der Weg bleibt)", await h.p.evaluate(() => liefermodus === true));
    pruef("chips aus: der Kopf lässt keine leere Zeile für die Chips", (await startMasse(h.p)).kopf.h <= ref.kopf.h, 0);
    const mit = await lauf(browser, { chips: "an" });
    pruef("Gegenfall chips an: der Schalter oben ist weg (Chips übernehmen)", await mit.p.evaluate(() => getComputedStyle(document.querySelector(".kopfwahl > .lieferwahl")).display === "none"));
    await mit.ctx.close(); await h.ctx.close();
  }
  {
    const h = await lauf(browser, { navigation: "schlank" }); const m = await startMasse(h.p);
    const n = await h.p.evaluate(() => ({ navh: parseFloat(getComputedStyle(document.body).getPropertyValue("--nav-h")) || null, rect: (() => { const b = document.getElementById("hauptnav").getBoundingClientRect(); return Math.round(b.height); })(),
      tabs: [...document.querySelectorAll(".hn-tab")].map(t => { const x = t.querySelector(".hn-text").getBoundingClientRect(); return { name: t.textContent.trim(), textW: Math.round(x.width), h: Math.round(t.getBoundingClientRect().height) }; }) }));
    pruef("navigation schlank: Leiste niedriger als vorher, jeder Tab ≥ 44 px", m.nav.h < ref.nav.h && n.tabs.every(t => t.h >= 44) && n.tabs.length >= 3, JSON.stringify([m.nav.h, ref.nav.h, n.tabs]));
    pruef("navigation schlank: der Name ist NICHT display:none/visibility:hidden (sonst fehlt er den Vorlesern)", await h.p.evaluate(() => [...document.querySelectorAll(".hn-text")].every(e => { const c = getComputedStyle(e); return c.display !== "none" && c.visibility !== "hidden"; })));
    pruef("navigation schlank: der Name ist optisch weg (1 px), aber im Text da — für Vorleser", n.tabs.every(t => t.textW <= 1 && t.name.length >= 3), JSON.stringify(n.tabs));
    /* Gemessen am letzten SICHTBAREN Inhalt der Fußzeile (Links, Absätze), nicht am Kasten: der Kasten trägt die Reserve selbst. */
    const unten = async hh => hh.p.evaluate(() => { document.documentElement.scrollTop = 1e6; const f = document.querySelector("footer");
      const ende = f ? Math.max(0, ...[...f.querySelectorAll("a, p, span, button")].filter(e => e.getBoundingClientRect().height > 0).map(e => e.getBoundingClientRect().bottom)) : 0;
      return { inhaltEnde: Math.round(ende), navOben: Math.round(document.getElementById("hauptnav").getBoundingClientRect().top) }; });
    const u = await unten(h);
    pruef("navigation schlank: ganz unten endet der Inhalt der Fußzeile über der Leiste (Reserve folgt --nav-h)", u.inhaltEnde > 0 && u.inhaltEnde <= u.navOben + 1, u);
    await h.ctx.close();
  }
  {
    const h = await lauf(browser, { navigation: "aus" });
    const a = await h.p.evaluate(() => ({ hidden: document.getElementById("hauptnav").hidden, nav: document.body.dataset.nav || null, tabs: document.querySelectorAll(".hn-tab").length }));
    pruef("navigation aus: keine Leiste, kein data-nav, keine Tabs", a.hidden && a.nav === null && a.tabs === 0, a);
    await h.p.evaluate(() => { location.hash = "#/speisekarte"; }); await h.p.waitForTimeout(600);
    pruef("… auch auf der Speisekarte; der Weg zurück bleibt das „Zurück“ der Seite", await h.p.evaluate(() => document.body.dataset.nav === undefined && !!document.querySelector(".zurueck, .zurück, [data-zurueck], .glaszurueck, #zurueck")), await h.p.evaluate(() => document.body.dataset.nav || null));
    await h.ctx.close();
  }

  console.log("\n══ 3 · Profile und Überschreiben ══");
  for(const [profil, erwartet] of [["bistro", { plEcken: "weich", plKopf: "kompakt", plWege: "kompakt", plProdukt: "rechts", plDichte: "dicht" }],
    ["cafe", { plProdukt: "oben" }], ["bar", { plEcken: "eckig", plKopf: "kompakt", plWege: "kompakt", plProdukt: "aus", plDichte: "dicht", plNav: "schlank" }], ["standard", {}]]){
    const h = await lauf(browser, { profil });
    const a = await attrs(h.p);
    pruef("Profil " + profil + ": genau die Attribute, die vom Standard abweichen", JSON.stringify(a) === JSON.stringify(erwartet), a);
    await h.ctx.close();
  }
  {
    const h = await lauf(browser, { profil: "bistro", ecken: "rund", dichte: "luftig", navigation: "schlank" });
    const a = await attrs(h.p), k = await karteMasse(h.p);
    pruef("bistro mit Überschreibung: ecken rund/dichte luftig heben das Profil auf (kein Attribut), navigation schlank kommt dazu", JSON.stringify(a) === JSON.stringify({ plKopf: "kompakt", plWege: "kompakt", plProdukt: "rechts", plNav: "schlank" }), a);
    pruef("… und die Maße folgen: Ecken wie vorher, Bild rechts", k.gericht.radius === "20px" && k.gbild.x >= k.gtext.r - 1, JSON.stringify([k.gericht.radius, k.gbild.x, k.gtext.r]));
    await h.ctx.close();
  }

  console.log("\n══ 4 · Ungültiges setzt nie ein Attribut ══");
  for(const [name, l] of [["Anführungszeichen im Wert", { ecken: 'eckig" onclick="window.__x=1' }], ["Prototyp als Profil", { profil: "__proto__" }], ["constructor als Profil", { profil: "constructor" }],
    ["Zahl statt Zeichenkette", { kopf: 1 }], ["Liste statt Zeichenkette", { dichte: ["dicht"] }], ["fremder Schlüssel", { farbe: "rot", "plEcken": "eckig" }],
    ["Groß-/Kleinschreibung", { produktbild: "AUS" }], ["null", { navigation: null }], ["Zeichenkette statt Objekt", "bistro"], ["Liste statt Objekt", ["bistro"]]]){
    const h = await lauf(browser, l);
    const a = await attrs(h.p), x = await h.p.evaluate(() => ({ onclick: document.body.hasAttribute("onclick"), gesetzt: window.__x || 0 }));
    pruef("ungültig (" + name + "): kein Attribut, kein onclick", JSON.stringify(a) === "{}" && !x.onclick && !x.gesetzt, [a, x]);
    pruef("ungültig (" + name + "): keine JS-Fehler", h.fehler.length === 0, h.fehler);
    await h.ctx.close();
  }
  {
    const h = await lauf(browser, { profil: "bistro", ecken: "zackig", kopf: "riesig" });
    pruef("ein gültiger Teil bleibt, der ungültige fällt auf das PROFIL zurück (nicht auf Standard)", JSON.stringify(await attrs(h.p)) === JSON.stringify({ plEcken: "weich", plKopf: "kompakt", plWege: "kompakt", plProdukt: "rechts", plDichte: "dicht" }), await attrs(h.p));
    await h.ctx.close();
  }
  {
    const h = await oeffneHub(browser, Object.assign({}, OPT, { stil: "klassisch" }));
    await h.p.evaluate(() => { MARKENBLATT.startlayout = { profil: "bar" }; startlayoutSetzen(); zeichne(); });
    const a = await attrs(h.p), r = await h.p.evaluate(() => ({ stil: document.body.dataset.startstil || null, nav: document.body.dataset.nav || null }));
    pruef("klassischer Hub: startlayout ändert NICHTS (kein Attribut, kein Premium)", JSON.stringify(a) === "{}" && r.stil === null && r.nav === null, [a, r]);
    await h.ctx.close();
  }
  {
    const h = await lauf(browser, { profil: "bar" });
    await h.p.evaluate(() => { MARKENBLATT.startstil = "klassisch"; startstilSetzen(); startlayoutSetzen(); zeichne(); });
    pruef("Premium aus → die Layout-Attribute gehen mit (kein Rest im klassischen Bild)", JSON.stringify(await attrs(h.p)) === "{}", await attrs(h.p));
    await h.ctx.close();
  }

  console.log("\n══ 5 · Jedes Profil × Start/Karte × Breite ══");
  for(const breite of [360, 390, 430, 1280]){
    for(const profil of Object.keys(PROFILE)){
      const h = await lauf(browser, { profil }, { breite, hoehe: breite >= 1000 ? 900 : 844 });
      const m = await startMasse(h.p);
      const t = await h.p.evaluate(() => {
        const klein = [...document.querySelectorAll(".ba-chip, .hn-tab, .sz-p, .st-link .status")].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height < 43.5; }).map(e => e.className + " " + Math.round(e.getBoundingClientRect().height));
        const abg = [...document.querySelectorAll(".sz-p .sz-text, .ba-text, .hn-text")].filter(e => e.getBoundingClientRect().width > 2 && e.scrollWidth > e.clientWidth + 1).map(e => e.className);
        return { klein, abg };
      });
      pruef(`${profil} @${breite} Start: kein Überlauf, Tapflächen ≥ 44 px, nichts abgeschnitten`, m.ueberlauf <= 0 && !t.klein.length && !t.abg.length, [m.ueberlauf, t]);
      const k = await karteMasse(h.p);
      const kt = await h.p.evaluate(() => {
        const g = [...document.querySelectorAll(".gericht")];
        const klein = [...document.querySelectorAll(".gplus, .gmenge button, .chip")].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height < 43.5; }).map(e => e.className);
        const raus = g.filter(e => { const b = e.getBoundingClientRect(); return b.right > document.documentElement.clientWidth + 1 || b.left < -1; }).length;
        const text = g.filter(e => { const n = e.querySelector(".gtext"), pl = e.querySelector(".gplus, .gmenge"); if(!n || !pl) return false; const a = n.querySelector(".n").getBoundingClientRect(), b = pl.getBoundingClientRect(); return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1; }).length;
        return { klein, raus, text, n: g.length };
      });
      pruef(`${profil} @${breite} Karte: kein Überlauf, Plus/Chips ≥ 44 px, Karten im Bild, der Name liegt nie unter dem Plus`, k.ueberlauf <= 0 && !kt.klein.length && kt.raus === 0 && kt.text === 0 && kt.n >= 3, [k.ueberlauf, kt]);
      pruef(`${profil} @${breite}: keine JS-Fehler`, h.fehler.length === 0, h.fehler);
      await h.ctx.close();
    }
  }

  console.log("\n══ 6 · Arabisch (von rechts nach links) ══");
  {
    const l = await lauf(browser, { produktbild: "rechts" }, { sprache: "ar", hash: "#/speisekarte" }); const k = await karteMasse(l.p);
    pruef("produktbild rechts auf Arabisch: das Bild steht am ENDE der Zeile = links vom Text", k.gbild.r <= k.gtext.x + 1 && k.gbild.x >= k.g.x - 1, JSON.stringify([k.gbild, k.gtext]));
    pruef("… das Plus liegt in der Karte", k.plus.x >= k.g.x - 1 && k.plus.r <= k.g.r + 1, k.plus);
    await l.ctx.close();
    const o = await lauf(browser, { dichte: "dicht", ecken: "eckig", kopf: "kompakt" }, { sprache: "ar" }); const m = await startMasse(o.p);
    pruef("ar: kompakt/eckig/dicht ohne Überlauf", m.ueberlauf <= 0, m.ueberlauf);
    await o.ctx.close();
  }

  console.log("\n══ 7 · Erzeuger: prüft laut, schreibt genau das ══");
  {
    const { spawnSync } = require("child_process");
    const os = require("os");
    const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), "layout-"));
    fs.mkdirSync(path.join(wurzel, "erzeuger")); fs.mkdirSync(path.join(wurzel, "vorlagen")); fs.mkdirSync(path.join(wurzel, "markenblaetter"));
    fs.copyFileSync(path.join(__dirname, "..", "erzeuger", "erzeuge-hub.js"), path.join(wurzel, "erzeuger", "erzeuge-hub.js"));
    fs.copyFileSync(path.join(__dirname, "..", "erzeuger", "kompakt.js"), path.join(wurzel, "erzeuger", "kompakt.js"));   /* der Erzeuger lädt es seit 24.10. */
    fs.copyFileSync(path.join(__dirname, "..", "vorlagen", "hub.vorlage.html"), path.join(wurzel, "vorlagen", "hub.vorlage.html"));
    const basis = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "markenblaetter", "chocolamour.json"), "utf8"));
    const erzeuge = (inhalt, nurPruefen) => {
      fs.writeFileSync(path.join(wurzel, "markenblaetter", "probe.json"), JSON.stringify(Object.assign({}, basis, { betrieb: Object.assign({}, basis.betrieb, { slug: "probe" }) }, inhalt)));
      const r = spawnSync("node", [path.join(wurzel, "erzeuger", "erzeuge-hub.js"), "probe"].concat(nurPruefen ? ["--pruefen-nur"] : []), { encoding: "utf8" });
      return { code: r.status, text: r.stdout + r.stderr, hub: fs.existsSync(path.join(wurzel, "dist", "probe", "index.html")) ? fs.readFileSync(path.join(wurzel, "dist", "probe", "index.html"), "utf8") : "" };
    };
    pruef("Basis (Choco) geht durch — Voraussetzung der Gegenfälle", erzeuge({}, true).code === 0, erzeuge({}, true).text.slice(-120));
    for(const [name, l, teil] of [["unbekanntes Profil", { profil: "Bistro" }, "startlayout.profil unbekannt"], ["unbekannter Wert", { ecken: "zackig" }, "startlayout.ecken unbekannt"],
      ["Wert mit Anführungszeichen", { kopf: 'hoch" onclick="x' }, "startlayout.kopf unbekannt"], ["fremder Schlüssel", { farbe: "rot" }, "startlayout.farbe gibt es nicht"],
      ["Zeichenkette statt Objekt", "bistro", "muss ein Objekt sein"], ["Liste statt Objekt", ["bistro"], "muss ein Objekt sein"], ["Zahl als Wert", { dichte: 1 }, "startlayout.dichte unbekannt"]]){
      const r = erzeuge({ startlayout: l }, true);
      pruef("Erzeuger lehnt ab (" + name + ")", r.code !== 0 && r.text.indexOf(teil) >= 0, r.text.split("\n").filter(x => /FEHLER/.test(x)).join(" | ").slice(0, 160));
    }
    let r = erzeuge({ startstil: "klassisch", startlayout: { profil: "bistro" } }, true);
    pruef("Erzeuger lehnt startlayout ohne Premium ab (sonst wirkungslos und still)", r.code !== 0 && /wirkt nur mit startstil/.test(r.text));
    r = erzeuge({ startlayout: { profil: "bar", ecken: "weich", produktbild: "oben" } }, false);
    const block = (r.hub.match(/startlayout: \{([\s\S]*?)\n  \},/) || ["", ""])[1];
    const werte = Object.fromEntries([...block.matchAll(/(\w+):\s*"([^"]*)"/g)].map(m => [m[1], m[2]]));
    pruef("Erzeuger schreibt genau das Angegebene ins Markenblatt des Hubs (Profil und zwei Regler, sonst nichts)", r.code === 0 && JSON.stringify(werte) === JSON.stringify({ profil: "bar", ecken: "weich", produktbild: "oben" }), werte);
    r = erzeuge({}, false);
    pruef("ohne startlayout steht nichts davon im erzeugten Hub (Markenblatt-Zeile)", r.code === 0 && !/\n  startlayout:/.test(r.hub));
    fs.rmSync(wurzel, { recursive: true, force: true });
  }

  await browser.close();
  console.log("\n" + ok + " ok, " + bad + " rot");
  process.exit(bad ? 1 : 0);
})();
