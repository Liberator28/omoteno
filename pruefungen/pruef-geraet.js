#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   pruef-geraet.js · Nur dieses Gerät: drei neue Funktionen je Gruppe
   „Melden“, „Bildschirm“, „Nichts übersehen“, „Dieses Gerät“ (01.11.)

   Alles liegt in EINST (localStorage dieses Geräts), nichts geht an den
   Server. Geprüft wird am Verhalten, nicht am Quelltext:
   1 · Gerätespeicher: beschädigte Werte fallen auf die Vorgabe, der Name
       steht als Text im Kopf (kein Element aus „<img onerror>“).
   2 · Ruhezeit: auch über Mitternacht; in der Ruhe klingelt nichts, die
       Meldung erscheint trotzdem (§7).
   3 · Klang für Servicerufe: Ruf → eigener Klang, Bestellung → normaler.
   4 · Bereiche: nur Tische der gewählten Bereiche klingeln; Lieferung und
       Tische außerhalb des Plans immer (sonst hörte es niemand).
   5 · Bildschirm: kompakte Karten (gemessen), große Uhr, Rand leuchtet
       (nur opacity; reduzierte Bewegung: stilles Aufleuchten).
   6 · Nichts übersehen: eigene Schwelle für Servicerufe, Wiederholtakt,
       Titel blinkt nur bei verborgenem Tab.
   7 · Dieses Gerät: Selbsttest, „Neu laden“ erst beim zweiten Tipp.
   8 · Maße: Knöpfe ≥ 44 px, Felder 16 px, kein Seitenfehler.

   Gegenbeweise: ADMIN_DATEI zeigt auf eine Kopie.
   Ehrliche Grenzen: kopfloses Chromium; ob ein Klang „hörbar anders“ ist,
   misst keine Probe — gezählt wird, welcher Klang gewählt wurde.
   ═══════════════════════════════════════════════════════════════════ */
const path = require("path");
const { chromium } = require("playwright");
const ADMIN = "file://" + (process.env.ADMIN_DATEI || path.join(__dirname, "..", "seiten", "admin.html"));

let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined && z !== "" ? "  → " + (typeof z === "string" ? z : JSON.stringify(z)).slice(0, 220) : "")); };

async function board(br, opt){
  opt = opt || {};
  const ctx = await br.newContext({ viewport: { width: opt.breite || 390, height: 844 }, colorScheme: "dark", reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  const p = await ctx.newPage(); const pf = [];
  p.on("pageerror", e => pf.push(String(e).slice(0, 200)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.addInitScript(einst => {
    Element.prototype.requestFullscreen = () => Promise.resolve();
    if(einst) try{ localStorage.setItem("omoteno-einstellungen", JSON.stringify(einst)); }catch(e){}
  }, opt.einst || null);
  await p.goto(ADMIN); await p.waitForTimeout(700);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; });
  await p.waitForTimeout(300);
  /* Zähler für Ton und Klang — klingel() ist global, Aufrufe darin laufen über diesen Namen. */
  await p.evaluate(() => { window.__ton = []; const echt = klingel; window.klingel = k => { window.__ton.push(k == null ? "normal" : k); }; window.__echtKlingel = echt; });
  return { ctx, p, pf };
}
const gruppe = async (p, titel) => {
  await p.evaluate(() => tafelZeigen("einstellungen")); await p.waitForTimeout(200);
  if(await p.evaluate(() => !!document.getElementById("t-einstellungen").dataset.euOffen)) { await p.click("#euZurueck"); await p.waitForTimeout(150); }
  await p.click('.eu-kachel[data-eu-seite] >> text="' + titel + '"'); await p.waitForTimeout(250);
};

(async () => {
  const br = await chromium.launch();

  console.log("\n══ 1 · Gerätespeicher ══");
  {
    const { ctx, p, pf } = await board(br, { einst: { ruheAn: "ja", ruheVon: "25:00", ruheBis: "7", klangRuf: "laut", bereiche: ["<b>x</b>", 5, "Terrasse"], mahnungRuf: 7, mahnTakt: 3, kompakt: 1,
      geraetName: '<img src=x onerror="window.__x=1">Theke', titelBlink: "true" } });
    const e = await p.evaluate(() => ({ ruheAn: EINST.ruheAn, von: EINST.ruheVon, bis: EINST.ruheBis, klang: EINST.klangRuf, bereiche: EINST.bereiche, ruf: EINST.mahnungRuf, takt: EINST.mahnTakt, kompakt: EINST.kompakt, titel: EINST.titelBlink, name: EINST.geraetName }));
    pruef(e.ruheAn === false && e.von === "22:00" && e.bis === "07:00" && e.klang === "gleich" && e.ruf === -1 && e.takt === 0 && e.kompakt === false && e.titel === false,
      "beschädigte Werte fallen auf die Vorgabe (Zeit, Klang, Takt, Schwelle, Schalter nur als echtes true/false)", e);
    pruef(JSON.stringify(e.bereiche) === '["Terrasse"]', "Bereiche: nur saubere Namen bleiben", e.bereiche);
    const kopf = await p.evaluate(() => { const n = document.getElementById("gtName"); return { text: n.textContent, sicht: !n.hidden, img: !!n.querySelector("img"), lief: !!window.__x }; });
    pruef(kopf.sicht && !kopf.img && !kopf.lief && !/[<>"]/.test(kopf.text) && kopf.text.length <= 24, "Name steht als Text im Kopf, nichts läuft, höchstens 24 Zeichen", kopf);
    pruef(pf.length === 0, "keine Seitenfehler", pf);
    await ctx.close();
  }

  console.log("\n══ 2 · Ruhezeit ══");
  {
    const { ctx, p, pf } = await board(br);
    const r = await p.evaluate(() => {
      const t = (h, m) => new Date(2026, 10, 1, h, m).getTime();
      EINST.ruheAn = true; EINST.ruheVon = "22:00"; EINST.ruheBis = "07:00";
      const nacht = [gtRuheJetzt(t(23, 30)), gtRuheJetzt(t(6, 59)), gtRuheJetzt(t(7, 0)), gtRuheJetzt(t(12, 0)), gtRuheJetzt(t(22, 0))];
      EINST.ruheVon = "08:00"; EINST.ruheBis = "12:00";
      const tag = [gtRuheJetzt(t(9, 0)), gtRuheJetzt(t(12, 0)), gtRuheJetzt(t(7, 59))];
      EINST.ruheVon = "10:00"; EINST.ruheBis = "10:00"; const gleich = gtRuheJetzt(t(10, 0));
      EINST.ruheAn = false; EINST.ruheVon = "00:00"; EINST.ruheBis = "23:59"; const aus = gtRuheJetzt(t(12, 0));
      return { nacht, tag, gleich, aus };
    });
    pruef(JSON.stringify(r.nacht) === "[true,true,false,false,true]", "22:00–07:00 über Mitternacht: 23:30 und 06:59 ruhig, 07:00 und 12:00 nicht", r.nacht);
    pruef(JSON.stringify(r.tag) === "[true,false,false]" && r.gleich === false && r.aus === false, "08:00–12:00 am Tag, gleiche Zeiten = nie, ausgeschaltet = nie", r);
    const m = await p.evaluate(() => {
      EINST.ruheAn = true; EINST.ruheVon = "00:00"; EINST.ruheBis = "23:59"; window.__ton.length = 0; letzterTon = 0;
      const vorher = stauZahl; meldenGebuendelt({ quelle: "tisch", tisch: "1" });
      return { ton: window.__ton.length, gezaehlt: stauZahl - vorher };
    });
    pruef(m.ton === 0 && m.gezaehlt === 1, "in der Ruhezeit kein Ton — die Meldung wird trotzdem gezählt und gezeigt", m);
    await gruppe(p, "Melden");
    await p.evaluate(() => { EINST.ruheAn = false; einstZeichnen(); gtZeichnen(); });
    const vorher = await p.evaluate(() => document.getElementById("ruheZeile").hidden);
    await p.click('label.ezeile:has([data-einst="ruheAn"])'); await p.waitForTimeout(150);
    const nach = await p.evaluate(() => ({ an: EINST.ruheAn, zeile: !document.getElementById("ruheZeile").hidden, gemerkt: JSON.parse(localStorage.getItem("omoteno-einstellungen")).ruheAn }));
    pruef(vorher && nach.an && nach.zeile && nach.gemerkt === true, "echter Tipp auf „Ruhezeit“ zeigt die Zeiten und merkt sich die Wahl", { vorher, nach });
    await p.fill("#ruheVon", "21:30"); await p.dispatchEvent("#ruheVon", "change");
    pruef(await p.evaluate(() => EINST.ruheVon === "21:30" && JSON.parse(localStorage.getItem("omoteno-einstellungen")).ruheVon === "21:30"), "„Von“ 21:30 wird gemerkt");
    pruef(pf.length === 0, "keine Seitenfehler", pf);
    await ctx.close();
  }

  console.log("\n══ 3 · Klang für Servicerufe ══");
  {
    const { ctx, p } = await board(br);
    await gruppe(p, "Melden");
    await p.click('#klangRufWahl [data-klangruf="stark"]'); await p.waitForTimeout(100);
    const w = await p.evaluate(() => ({ e: EINST.klangRuf, gedr: document.querySelector('#klangRufWahl [data-klangruf="stark"]').getAttribute("aria-checked"), vorgespielt: window.__ton.slice(-1)[0] }));
    pruef(w.e === "stark" && w.gedr === "true" && w.vorgespielt === "stark", "Tipp auf „Stark“: gewählt, gemerkt, sofort vorgespielt", w);
    const k = await p.evaluate(() => {
      window.__ton.length = 0; letzterTon = 0; EINST.ruheAn = false; meldenGebuendelt({ quelle: "service", tisch: "4" });
      letzterTon = 0; meldenGebuendelt({ quelle: "tisch", tisch: "4" });
      EINST.klangRuf = "gleich"; letzterTon = 0; meldenGebuendelt({ quelle: "service", tisch: "4" });
      return window.__ton.slice();
    });
    pruef(JSON.stringify(k) === '["stark","normal","normal"]', "Serviceruf → eigener Klang, Bestellung → normaler, „Wie oben“ → normaler", k);
    const masse = await p.evaluate(() => [...document.querySelectorAll("#klangRufWahl .klang")].map(b => Math.round(b.getBoundingClientRect().height)));
    pruef(masse.length === 4 && masse.every(h => h >= 44), "vier Klang-Knöpfe, je ≥ 44 px", masse);
    await ctx.close();
  }

  console.log("\n══ 4 · Nur diese Bereiche ══");
  {
    const { ctx, p } = await board(br);
    await p.evaluate(() => tafelZeigen("reservierungen")); await p.waitForTimeout(500);
    await gruppe(p, "Melden");
    const chips = await p.evaluate(() => [...document.querySelectorAll("#gtBereiche [data-gt-bereich]")].map(b => b.textContent));
    pruef(chips.join("|") === "Alle|Haupt-Raum|Terrasse", "Bereiche aus dem Saalplan als Knöpfe (zweite Quelle: saalZonen)", chips);
    await p.click('#gtBereiche [data-gt-bereich="Terrasse"]'); await p.waitForTimeout(100);
    const z = await p.evaluate(() => {
      const t = nr => SAAL.tische.find(x => x.nummer === nr);
      const zone = nr => saalTischZone(t(nr));
      const haupt = SAAL.tische.find(x => x.x != null && saalTischZone(x) === "Haupt-Raum").nummer;
      const terr = SAAL.tische.find(x => x.x != null && saalTischZone(x) === "Terrasse").nummer;
      const ohne = SAAL.tische.find(x => x.x == null).nummer;
      return { bereiche: EINST.bereiche, haupt: gtTonErlaubt({ tisch: haupt }), terr: gtTonErlaubt({ tisch: terr }), ohnePlatz: gtTonErlaubt({ tisch: ohne }),
        lieferung: gtTonErlaubt({ quelle: "lieferung" }), unbekannt: gtTonErlaubt({ tisch: "999" }), gedr: document.querySelector('#gtBereiche [data-gt-bereich="Terrasse"]').getAttribute("aria-pressed") };
    });
    pruef(JSON.stringify(z.bereiche) === '["Terrasse"]' && z.gedr === "true", "Tipp auf „Terrasse“ wählt sie", z);
    pruef(!z.haupt && z.terr, "Tisch im Haupt-Raum klingelt nicht, Tisch auf der Terrasse schon", z);
    pruef(z.ohnePlatz && z.lieferung && z.unbekannt, "Tisch außerhalb des Plans, Lieferung, unbekannter Tisch klingeln immer (§7)", z);
    await p.click('#gtBereiche [data-gt-bereich=""]'); await p.waitForTimeout(100);
    pruef(await p.evaluate(() => EINST.bereiche.length === 0), "„Alle“ hebt die Auswahl auf");
    await ctx.close();
  }

  console.log("\n══ 5 · Bildschirm ══");
  {
    const { ctx, p, pf } = await board(br, { breite: 360 });
    await p.evaluate(() => tafelZeigen("bestellungen")); await p.waitForTimeout(300);
    const pad = () => p.evaluate(() => { const b = document.querySelector(".bestellung"); return b ? parseFloat(getComputedStyle(b).paddingTop) : null; });
    const vor = await pad();
    await gruppe(p, "Bildschirm");
    await p.click('label.ezeile:has([data-einst="kompakt"])');
    await p.click('label.ezeile:has([data-einst="uhrGross"])');
    await p.evaluate(() => tafelZeigen("bestellungen")); await p.waitForTimeout(300);
    const nach = await pad();
    pruef(vor != null && nach != null && nach < vor, "kompakte Karten: weniger Rand an jeder Bestellung", vor + " → " + nach);
    const uhr = await p.evaluate(() => { const u = document.getElementById("gtUhr"); return { sicht: !u.hidden && u.getClientRects().length > 0, text: u.textContent, ueber: document.documentElement.scrollWidth - innerWidth }; });
    pruef(uhr.sicht && /^\d\d:\d\d$/.test(uhr.text) && uhr.ueber <= 0, "große Uhr im Kopf (HH:MM), 360 px ohne Überlauf", uhr);
    await gruppe(p, "Bildschirm");
    await p.click('label.ezeile:has([data-einst="randBlitz"])');
    const b = await p.evaluate(() => { meldenGebuendelt({ quelle: "tisch", tisch: "1" }); const e = document.getElementById("gtBlitz");
      const a = e.getAnimations(); return { an: e.classList.contains("an"), anz: a.length, nur: a.every(x => Object.keys(x.effect.getKeyframes()[0] || {}).filter(k => !["offset", "easing", "composite", "computedOffset"].includes(k)).join() === "opacity"), tipp: getComputedStyle(e).pointerEvents }; });
    pruef(b.an && b.anz >= 1 && b.nur && b.tipp === "none", "Rand leuchtet bei neuer Meldung — nur opacity, fängt keinen Tipp", b);
    await p.evaluate(() => { EINST.randBlitz = false; document.getElementById("gtBlitz").className = "gt-blitz"; meldenGebuendelt({ quelle: "tisch" }); });
    pruef(await p.evaluate(() => !document.getElementById("gtBlitz").classList.contains("an")), "ausgeschaltet: kein Leuchten");
    pruef(pf.length === 0, "keine Seitenfehler", pf);
    await ctx.close();
  }
  {
    const { ctx, p } = await board(br, { ruhig: true, einst: { randBlitz: true } });
    const r = await p.evaluate(() => { meldenGebuendelt({ quelle: "tisch" }); const e = document.getElementById("gtBlitz"); return { still: e.classList.contains("still"), anim: e.getAnimations().length }; });
    pruef(r.still && r.anim === 0, "reduzierte Bewegung: stilles Aufleuchten, keine Animation", r);
    await ctx.close();
  }

  console.log("\n══ 6 · Nichts übersehen ══");
  {
    const { ctx, p } = await board(br);
    const s = await p.evaluate(() => {
      const vor = m => new Date(Date.now() - m * 60000).toISOString();
      const ruf = { id: "r1", quelle: "service", status: "neu", zeitpunkt: vor(6) }, tisch = { id: "t1", quelle: "tisch", status: "neu", zeitpunkt: vor(6) };
      EINST.mahnungAb = 10; EINST.mahnungRuf = 5;
      const a = [istUeberfaellig(ruf), istUeberfaellig(tisch)];
      EINST.mahnungRuf = -1; const b = [istUeberfaellig(ruf)];
      EINST.mahnungRuf = 0; EINST.mahnungAb = 5; const c = [istUeberfaellig(ruf), istUeberfaellig(tisch)];
      return { a, b, c };
    });
    pruef(JSON.stringify(s.a) === "[true,false]", "Servicerufe 5 Min, Bestellungen 10 Min: der 6 Min alte Ruf mahnt, die Bestellung nicht", s.a);
    pruef(JSON.stringify(s.b) === "[false]" && JSON.stringify(s.c) === "[false,true]", "„wie Bestellungen“ folgt der Bestellschwelle, 0 = Rufe mahnen nie", s);
    const t = await p.evaluate(() => {
      const vor = m => new Date(Date.now() - m * 60000).toISOString();
      bestellungen.length = 0; bestellungen.push({ id: "m1", quelle: "tisch", status: "neu", zeitpunkt: vor(12), positionen: [], summe: 0 });
      gemahnt.clear(); gtGemahntUm.clear(); EINST.mahnungAb = 10; EINST.mahnungRuf = -1; EINST.ruheAn = false;
      EINST.mahnTakt = 0; window.__ton.length = 0; mahnungPruefen(); mahnungPruefen();
      const einmal = window.__ton.length;
      gtGemahntUm.set("m1", Date.now() - 3 * 60000); mahnungPruefen(); const ohneTakt = window.__ton.length;
      EINST.mahnTakt = 2; gtGemahntUm.set("m1", Date.now() - 30000); mahnungPruefen(); const zuFrueh = window.__ton.length;
      gtGemahntUm.set("m1", Date.now() - 2 * 60000); mahnungPruefen(); const nachTakt = window.__ton.length;
      return { einmal, ohneTakt, zuFrueh, nachTakt };
    });
    pruef(t.einmal === 1 && t.ohneTakt === 1, "„Einmal“: genau ein Ton, auch beim nächsten Takt nicht wieder", t);
    pruef(t.zuFrueh === 1 && t.nachTakt === 2, "„Alle 2 Min“: nach 30 s still, nach 2 Min erneut", t);
    await gruppe(p, "Nichts übersehen");
    await p.click('#mahnTaktWahl [data-mahntakt="5"]'); await p.waitForTimeout(100);
    pruef(await p.evaluate(() => EINST.mahnTakt === 5 && JSON.parse(localStorage.getItem("omoteno-einstellungen")).mahnTakt === 5), "Tipp auf „Alle 5 Min“ wird gemerkt");
    /* Titel des Tabs: nur verborgen und nur mit etwas Neuem. */
    const titel = await p.evaluate(async () => {
      const ursprung = document.title; let verborgen = false;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => verborgen });
      bestellungen.length = 0; bestellungen.push({ id: "n1", quelle: "tisch", status: "neu", zeitpunkt: new Date().toISOString(), positionen: [], summe: 0 });
      EINST.titelBlink = true; const vorn = new Set(); for(let i = 0; i < 3; i++){ await new Promise(r => setTimeout(r, 850)); vorn.add(document.title); }
      const sichtbar = vorn.size === 1 ? [...vorn][0] : [...vorn].join(" | ");
      verborgen = true; const seen = new Set(); for(let i = 0; i < 3; i++){ await new Promise(r => setTimeout(r, 1000)); seen.add(document.title); }
      EINST.titelBlink = false; await new Promise(r => setTimeout(r, 1100)); const aus = document.title;
      return { ursprung, sichtbar, gesehen: [...seen], aus };
    });
    pruef(titel.sichtbar === titel.ursprung, "Tab vorn: Titel bleibt", titel.sichtbar);
    pruef(titel.gesehen.some(x => /^● 1 neue Meldung$/.test(x)) && titel.gesehen.includes(titel.ursprung), "Tab im Hintergrund: Titel wechselt zwischen „● 1 neue Meldung“ und dem Namen", titel.gesehen);
    pruef(titel.aus === titel.ursprung, "ausgeschaltet: Titel zurück", titel.aus);
    await ctx.close();
  }

  console.log("\n══ 7 · Dieses Gerät ══");
  {
    const { ctx, p, pf } = await board(br);
    await gruppe(p, "Dieses Gerät");
    await p.fill("#gtNameFeld", "Küche 2"); await p.waitForTimeout(100);
    pruef(await p.evaluate(() => document.getElementById("gtName").textContent === "Küche 2" && EINST.geraetName === "Küche 2"), "Name getippt → steht sofort im Kopf");
    await p.click("#gtTestKnopf"); await p.waitForTimeout(800);
    const t = await p.evaluate(() => [...document.querySelectorAll("#gtTest .zeile span")].map(s => s.textContent));
    pruef(t.length >= 4 && t.some(x => /Ton/.test(x)) && t.some(x => /Netz/.test(x)) && t.some(x => /Uhr/.test(x)) && t.some(x => /[Mm]ahn/.test(x)), "Selbsttest: Ton, Netz, Uhr, Mahnung — je eine Zeile", t);
    await p.evaluate(() => { window.__marke = 1; });
    await p.click("#gtLeerenKnopf"); await p.waitForTimeout(300);
    const erst = await p.evaluate(() => ({ marke: window.__marke, text: document.getElementById("gtLeerenKnopf").textContent }));
    pruef(erst.marke === 1 && /Noch einmal/.test(erst.text), "erster Tipp auf „Neu laden“ fragt nur nach — kein Neuladen", erst);
    await Promise.all([p.waitForEvent("load", { timeout: 8000 }).catch(() => null), p.click("#gtLeerenKnopf")]);
    await p.waitForTimeout(500);
    pruef(await p.evaluate(() => window.__marke === undefined), "zweiter Tipp lädt neu");
    pruef(pf.length === 0, "keine Seitenfehler", pf);
    await ctx.close();
  }

  console.log("\n══ 8 · Maße ══");
  {
    const { ctx, p, pf } = await board(br, { breite: 360 });
    const fehler = [];
    for(const g of ["Melden", "Bildschirm", "Nichts übersehen", "Dieses Gerät"]){
      await gruppe(p, g);
      await p.evaluate(() => { EINST.ruheAn = true; gtZeichnen(); });
      const m = await p.evaluate(() => {
        const g = document.querySelector("#t-einstellungen > .egruppe.eu-jetzt");
        const knoepfe = [...g.querySelectorAll("#klangRufWahl button, #mahnTaktWahl button, #gtBereiche button, #gtTestKnopf, #gtLeerenKnopf")].filter(b => b.getClientRects().length)
          .map(b => [b.textContent.trim().slice(0, 14), Math.round(b.getBoundingClientRect().height)]).filter(x => x[1] < 44);
        const felder = [...g.querySelectorAll("#ruheVon, #ruheBis, #gtNameFeld")].filter(x => x.getClientRects().length).map(x => [x.id, parseFloat(getComputedStyle(x).fontSize), Math.round(x.getBoundingClientRect().height)]).filter(x => x[1] < 16 || x[2] < 44);
        return { knoepfe, felder, ueber: document.documentElement.scrollWidth - innerWidth };
      });
      if(m.knoepfe.length || m.felder.length || m.ueber > 0) fehler.push([g, m]);
    }
    pruef(!fehler.length, "360 px: neue Knöpfe ≥ 44 px, Felder 16 px und ≥ 44 px, kein Überlauf", fehler);
    pruef(pf.length === 0, "keine Seitenfehler", pf);
    await ctx.close();
  }

  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
