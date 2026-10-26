/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Abholen als dritte Bestellart — Board, Hub, Küche, Naht

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-abholen.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   Anlass (25.10.): „Abholen“ soll ein echter dritter Chip sein. Die Datenbank kannte den Weg seit migration-abholen.sql
   (bestellung_abholen, Schalter betriebe.liefer->'abholen'); Hub, Küche und Board-Einstellung kannten ihn nicht, und
   lfSichern() baute betriebe.liefer bei jedem „Übernehmen“ frisch aus den Feldern — es hätte den Schlüssel „abholen“
   gelöscht (§8.1m).

   Gemessen wird der Weg am Stück, jede Seite gegen die ANDERE und gegen die SQL als zweite Quelle (§8.1i):

   1 · BOARD     Schalter und Vorlauf stehen da (≥ 44 px); Übernehmen behält „abholen“ und fremde Schlüssel, nimmt ein
                 geleertes Zeitfenster zurück, lässt „abholen“ OHNE Postleitzahl zu; die Karte zeigt Telefon und Abholzeit,
                 die Herkunft heißt „Abholung“ (Karte, Zähler, Ausfuhr, Auswertung).
   2 · HUB       Chips in der Reihenfolge des Entwurfs, nur wenn es die Art gibt; der echte Tipp schaltet; Warenkorb mit Name,
                 Telefon, Zeit — ohne Adresse, ohne Tisch, ohne Online-Zahlung; die Nutzlast ist Parameter für Parameter die
                 Signatur von bestellung_abholen; Zeitfenster; Absage durch den Server → keine zehn Minuten Wiederholen;
                 Neuladen zwischen Abschicken und Ankommen behält die Angaben von damals (§8.1q).
   3 · KÜCHE     Der Bon sagt „Abholung“ und nennt Name, Telefon, Zeit; eine Lieferung bleibt, wie sie war.
   4 · NAHT      Parameter und Gründe der SQL gegen das, was der Hub schickt und kennt.

   EHRLICHE GRENZEN: Die Serverantworten sind gestellt (kein Supabase-Zugang in dieser Umgebung); die SQL selbst läuft in
   pruefungen/pruef-tischpflicht-lokal.sh. Gemessen mit kopflosem Chromium, nicht auf einem Gerät.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs = require("fs");
const path = require("path");

const OBEN   = path.join(__dirname, "..");
const SEITEN = path.join(OBEN, "seiten");
const SQL    = fs.readFileSync(path.join(OBEN, "datenbank", "migration-abholen.sql"), "utf8");
const HUBQ   = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");
let fehler = 0, n = 0;
const ok = (g, t, z) => { n++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined && z !== "" ? "  → " + z : "")); if(!g) fehler++; };
const echt = k => k.filter(z => !/net::ERR|Failed to load|ERR_FAILED/i.test(z));
const BID = "11111111-2222-3333-4444-555555555555";

/* Die Parameter von bestellung_abholen, aus der SQL gelesen (zweite Quelle). */
const SIGNATUR = (() => {
  const m = /function public\.bestellung_abholen\(([\s\S]*?)\)\s*returns/.exec(SQL);
  return m ? m[1].split("\n").map(z => (/^\s*(p_[a-z_]+)\s/.exec(z) || [])[1]).filter(Boolean) : [];
})();
const GRUENDE = [...SQL.matchAll(/'grund',\s*'([a-z]+)'/g)].map(m => m[1]);

const LIEFER_BEIDE = { an: true, plz: ["35037"], mindest: 0, gebuehr: 2.5, gratis_ab: 0, dauer_min: 40, bar: true, karte: false,
                       abholen: true, abhol_min: 20 };

/* Ein Hub mit gestellter Datenbank. opt: tisch, antwort (Funktion für bestellung_abholen), hash, breite, still, speichern */
async function hubAuf(br, haus, liefer, opt){
  opt = opt || {};
  const ctx = await br.newContext({ viewport:{ width: opt.breite || 390, height: 844 }, reducedMotion: opt.still ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  const kons = [], gesendet = [], falsch = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0, 160)));
  await p.clock.setFixedTime(new Date("2026-10-10T14:00:00"));
  const zeile = { id: BID, bestell_pause: false, bestell_pause_text: "", hub_texte: {}, hub_kacheln: null, hub_woerter: null };
  if(liefer !== undefined) zeile.liefer = liefer;
  const steuer = { antwort: opt.antwort || null, aus: false };
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await p.route("**/rest/v1/betriebe**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([zeile]) }));
  await p.route("**/rest/v1/rpc/bestellung_abholen", r => {
    if(steuer.aus) return r.abort();
    const k = JSON.parse(r.request().postData() || "{}");
    gesendet.push(k);
    const a = steuer.antwort ? steuer.antwort(k) : { ok: true, id: "ab-" + gesendet.length, ware: 10.9, summe: 10.9, nummer: 101 };
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(a) });
  });
  for(const f of ["bestellung_liefern", "bestellung_aufgeben", "bestellung_liefern_zahlung", "bestellung_aufgeben_zahlung"])
    await p.route("**/rest/v1/rpc/" + f, r => { falsch.push(f); return r.fulfill({ status: 200, contentType: "application/json", body: '"x"' }); });
  await p.addInitScript(([slug, tisch, speichern]) => {
    try{
      sessionStorage.setItem("omoteno-willkommen", "1");
      localStorage.setItem("omoteno-willkommen", "1");
      if(!speichern) localStorage.setItem("omoteno-merk-" + slug, JSON.stringify({ "Waffel": { n: "Waffel", m: 1, p: "9,00" }, "Cola": { n: "Cola", m: 2, p: "3,20" } }));
      if(tisch) sessionStorage.setItem("omoteno-tisch", tisch);
    }catch(e){}
  }, [haus, opt.tisch || "", !!opt.nichtFuellen]);
  await p.goto("file://" + path.join(OBEN, "dist", haus, "index.html") + (opt.hash || ""));
  await p.waitForTimeout(1500);
  await p.evaluate(() => { try{ ZEITEN.length = 0; for(let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59"); stunde = 14; zeichne(); }catch(e){} });
  await p.waitForTimeout(300);
  return { p, ctx, kons, gesendet, falsch, steuer, echt: () => echt(kons) };
}
const auswahl = async h => { await h.p.evaluate(() => { location.hash = "#/auswahl"; }); await h.p.waitForTimeout(700); };
const start = async h => { await h.p.evaluate(() => { location.hash = "#/"; }); await h.p.waitForTimeout(700); };
const chipsLesen = h => h.p.evaluate(() => [...document.querySelectorAll("#bestellart [data-bestellart]")].map(c => {
  const r = c.getBoundingClientRect();
  return { art: c.dataset.bestellart, text: c.textContent.trim(), an: c.getAttribute("aria-checked") === "true", h: Math.round(r.height), b: Math.round(r.width) };
}));

/* ═══════════════════════════════════════════════════════════════════ 1 · BOARD */
async function board(br){
  console.log("\n══ 1 · Das Board ══");
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + path.join(SEITEN, "admin.html"));
  await p.waitForTimeout(900);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); } });
  await p.waitForTimeout(400);
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(300); }
  await p.evaluate(() => tafelZeigen("einstellungen"));
  await p.waitForTimeout(400);
  ok(await gruppeZu(p, "#lfAn"), "Voraussetzung: Unterseite Lieferung über ihre Kachel geöffnet");

  const da = await p.evaluate(() => {
    const miss = el => { el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); const mx = r.left + r.width / 2, my = r.top + r.height / 2;
      const trifft = y => { const t = document.elementFromPoint(mx, y); return !!t && (t === el || el.contains(t)); };
      return { b: Math.round(r.width), hoch: trifft(my - 21) && trifft(my + 21) }; };
    const a = document.getElementById("lfAbholen"), m = document.getElementById("lfAbholMin");
    return { schalter: !!a, feld: !!m, a: a && miss(a), m: m && getComputedStyle(m).fontSize, nachbar: getComputedStyle(document.getElementById("lfDauer")).fontSize };
  });
  ok(da.schalter && da.feld, "Schalter „Zum Abholen bestellen“ und Feld „Vorlauf“ stehen da");
  ok(da.a && da.a.b >= 44 && da.a.hoch, "der Schalter trifft auf 44 px", da.a && da.a.b + " breit");
  /* Alle Felder des Boards stehen auf 15 px (vorbestehend, nicht Sache dieser Änderung) — das neue Feld darf nicht kleiner sein als sein Nachbar. */
  ok(parseFloat(da.m) >= parseFloat(da.nachbar), "das Vorlauf-Feld ist so groß wie das Nachbarfeld (beide " + da.nachbar + "; die 16-px-Regel für alle Board-Felder ist ein eigenes Vorhaben)", da.m);

  /* Das Sichern gegen eine Attrappe, die nur mitschreibt (§8.1g). */
  const lauf = (alt, setzen) => p.evaluate(async ([alt, setzen]) => {
    let mit = null; demo = false;
    db = { from: () => ({ update: w => ({ eq: () => { mit = w; return Promise.resolve({ error: null }); } }) }) };
    meineBetriebe = [{ id: betriebId = "b1", liefer: alt }];
    lfFuellen();
    eval(setzen);
    await lfSichern();
    return { mit: mit && mit.liefer, satz: document.getElementById("lfPruefung").textContent };
  }, [alt, setzen]);
  const alt = { an: true, plz: ["35037"], mindest: 0, gebuehr: 2.5, gratis_ab: 0, dauer_min: 40, bar: true, karte: false,
                abholen: true, abhol_min: 20, zeiten: { von: "10:00", bis: "11:00", tage: [1] }, fremd_neu: "bleibt" };
  const r1 = await lauf(alt, "0");
  ok(!!r1.mit && r1.mit.abholen === true && r1.mit.abhol_min === 20,
     "Übernehmen OHNE Änderung behält „abholen“ und den Vorlauf (vorher: Schlüssel gelöscht, §8.1m)", JSON.stringify(r1.mit && { a: r1.mit.abholen, m: r1.mit.abhol_min }));
  ok(!!r1.mit && r1.mit.fremd_neu === "bleibt", "ein Schlüssel, den das Formular nicht kennt, bleibt stehen", r1.mit && r1.mit.fremd_neu);
  const r2 = await lauf(alt, 'document.getElementById("lfVon").value = ""; document.getElementById("lfBis").value = ""; LFTAGE = [];');
  ok(!!r2.mit && !("zeiten" in r2.mit), "ein geleertes Zeitfenster verschwindet (kein Rest aus dem alten Stand)", r2.mit && JSON.stringify(r2.mit.zeiten));
  const r3 = await lauf({ an: false, plz: [] }, 'document.getElementById("lfAbholen").setAttribute("aria-pressed","true"); document.getElementById("lfAbholMin").value = "15";');
  ok(!!r3.mit && r3.mit.abholen === true && r3.mit.abhol_min === 15 && r3.mit.an === false,
     "Abholung an OHNE Lieferung und OHNE Postleitzahl ist erlaubt", r3.mit ? JSON.stringify({ an: r3.mit.an, abholen: r3.mit.abholen, min: r3.mit.abhol_min }) : r3.satz);
  const r4 = await lauf({}, 'document.getElementById("lfAbholen").setAttribute("aria-pressed","true"); document.getElementById("lfAbholMin").value = "9999";');
  ok(!!r4.mit && r4.mit.abhol_min === 240, "der Vorlauf ist auf 240 Minuten gedeckelt", r4.mit && r4.mit.abhol_min);
  const r5 = await lauf({ an: true, plz: ["35037"], abholen: true }, 'document.getElementById("lfAbholen").setAttribute("aria-pressed","false");');
  ok(!!r5.mit && r5.mit.abholen === false, "Ausschalten schreibt wirklich false (nicht „bleibt stehen“)", r5.mit && r5.mit.abholen);
  ok(/Lieferung und Abholung sind aus|Übernommen/.test(r5.satz), "die Meldung nennt beides", r5.satz.slice(0, 60));

  /* Kachel der Zentrale */
  const kachel = await p.evaluate(() => { const e = EU_BEREICHE.find(b => b.titel === "Lieferung");
    document.getElementById("lfAn").setAttribute("aria-pressed", "false");
    document.getElementById("lfAbholen").setAttribute("aria-pressed", "true");
    return { satz: e.satz, stand: e.stand() }; });
  ok(/Abholung/.test(kachel.stand) && kachel.satz.length <= 40, "die Kachel nennt die Abholung im Stand (und der Satz bleibt ≤ 40 Zeichen)", kachel.stand + " | " + kachel.satz.length);

  /* Karte, Herkunft, Zähler */
  const karte = await p.evaluate(() => {
    const jetzt = new Date();
    const ab = { id: "ab1", quelle: "lieferung", abholung: true, gast_name: "Murat Yildiz", gast_telefon: "+49 151 2345", wunschzeit: new Date(jetzt.getTime() + 3600e3).toISOString(),
      status: "neu", positionen: [{ name: "Waffel", menge: 1, preis: 9 }], summe: 9, zeitpunkt: jetzt.toISOString(), tagesnummer: 101 };
    const li = { id: "li1", quelle: "lieferung", abholung: false, gast_name: "", status: "neu", positionen: [{ name: "Waffel", menge: 1, preis: 9 }], summe: 9, zeitpunkt: jetzt.toISOString(),
      liefer_adresse: { name: "Frau Weber", strasse: "Musterweg 1", plz: "35037", ort: "Marburg", telefon: "0173 1" }, liefergebuehr: 2.5 };
    bestellungen = [ab, li];
    tafelZeigen("bestellungen"); zeichneAlles();
    const kab = document.querySelector('[data-id="ab1"]') || [...document.querySelectorAll("#karten > *")].find(e => /Murat/.test(e.textContent));
    const kli = [...document.querySelectorAll("#karten > *")].find(e => /Weber/.test(e.textContent));
    return { ab: kab ? kab.textContent.replace(/\s+/g, " ") : null, li: kli ? kli.textContent.replace(/\s+/g, " ") : null,
      tel: !!(kab && kab.querySelector('a[href^="tel:+49"]')), herkunft: [quelleText(ab), quelleText(li)], key: [quelleKey(ab), quelleKey(li)],
      chip: document.querySelector('[data-quelle="lieferung"]').textContent.replace(/\s+/g, " ").trim(), seg: document.querySelector('[data-ansicht="lieferung"]').textContent.trim() };
  });
  ok(!!karte.ab && /Abholung/.test(karte.ab) && /Murat Yildiz/.test(karte.ab), "die Abholkarte nennt „Abholung“ und den Namen", karte.ab && karte.ab.slice(0, 70));
  ok(!!karte.ab && /Abholzeit \d\d:\d\d Uhr/.test(karte.ab), "und die Abholzeit", karte.ab && (karte.ab.match(/Abholzeit[^A-Z]*Uhr/) || [""])[0]);
  ok(karte.tel, "das Telefon ist antippbar (tel:)");
  ok(!!karte.ab && !/Liefern an/.test(karte.ab), "keine Lieferadresse auf der Abholkarte");
  ok(!!karte.li && /Liefern an/.test(karte.li) && /Marburg/.test(karte.li) && !/Abholung/.test(karte.li), "eine Lieferung bleibt eine Lieferung (Adresse, kein „Abholung“)");
  ok(karte.herkunft.join("|") === "Abholung|Lieferung" && karte.key.join("|") === "abholung|lieferung", "Herkunft: Abholung ≠ Lieferung (Ausfuhr, Auswertung)", karte.herkunft.join("|"));
  ok(/Abholung/.test(karte.chip) && karte.seg === "Außer Haus" || /Außer Haus/.test(karte.seg), "Filter nennen beide Arten", karte.chip + " | " + karte.seg);

  /* Auswertung: getrennte Posten */
  const aw = await p.evaluate(() => { try{
    const aus = { quellen: {} }; const bs = bestellungen.slice();
    bs.forEach(b => { const qk = quelleKey(b) || "tisch"; (aus.quellen[qk] = aus.quellen[qk] || { n: 0 }).n++; });
    return Object.keys(aus.quellen).sort().join(","); }catch(e){ return String(e); } });
  ok(aw === "abholung,lieferung", "die Auswertung führt Abholung und Lieferung getrennt", aw);
  ok(echt(kons).length === 0, "das Board wirft keinen Fehler", echt(kons)[0] || "still");
  await ctx.close();
}

/* ═══════════════════════════════════════════════════════════════════ 2 · HUB */
async function hub(br){
  console.log("\n══ 2 · Der Hub · die Chips ══");
  let h = await hubAuf(br, "chocolamour", LIEFER_BEIDE);
  const premium = await h.p.evaluate(() => startPremium());
  ok(premium, "Voraussetzung: Choco läuft mit der Premium-Startseite");
  await start(h);
  let c = await chipsLesen(h);
  ok(c.map(x => x.art).join(",") === "abholen,liefern,haus", "Reihenfolge wie im Entwurf: Abholen · Lieferung · Im Haus", c.map(x => x.art).join(","));
  ok(c.length === 3 && c.every(x => x.h >= 44), "jeder Chip ≥ 44 px hoch", c.map(x => x.h).join("/"));
  ok(c.filter(x => x.an).map(x => x.art).join() === "haus", "ohne Wahl steht „Im Haus“", c.filter(x => x.an).map(x => x.art).join());
  await h.p.click('[data-bestellart="abholen"]');
  await h.p.waitForTimeout(500);
  let z = await h.p.evaluate(() => ({ a: abholmodus, l: liefermodus, aktiv: abholenAktiv(), kachelnTisch: sichtbareKachelnRoh().some(k => k.nurTisch), alt: document.getElementById("lieferwahl").dataset.wahl,
    checked: [...document.querySelectorAll("#bestellart [aria-checked=true]")].map(x => x.dataset.bestellart).join() }));
  ok(z.a && !z.l && z.aktiv && z.checked === "abholen", "echter Tipp auf „Abholen“ schaltet (nie zugleich Lieferung)", JSON.stringify(z));
  ok(!z.kachelnTisch, "Kacheln „nur am Tisch“ fehlen bei Abholung (wie bei Lieferung)");
  ok(z.alt === "abholen", "der alte Schalter (auf Unterseiten) zeigt weder Besteck noch Roller als gewählt", z.alt);
  await h.p.click('[data-bestellart="liefern"]');
  await h.p.waitForTimeout(400);
  z = await h.p.evaluate(() => ({ a: abholmodus, l: liefermodus }));
  ok(!z.a && z.l, "Tipp auf „Lieferung“ nimmt die Abholung heraus", JSON.stringify(z));
  await h.p.focus('[data-bestellart="liefern"]');
  await h.p.keyboard.press("ArrowLeft");
  await h.p.waitForTimeout(400);
  z = await h.p.evaluate(() => ({ a: abholmodus, l: liefermodus, fokus: document.activeElement && document.activeElement.dataset.bestellart }));
  ok(z.a && !z.l && z.fokus === "abholen", "Pfeil nach links wechselt zum vorigen Chip und der Fokus folgt", JSON.stringify(z));
  await h.p.keyboard.press("ArrowRight"); await h.p.keyboard.press("ArrowRight");
  await h.p.waitForTimeout(400);
  z = await h.p.evaluate(() => ({ a: abholmodus, l: liefermodus }));
  ok(!z.a && !z.l, "die Reihe schließt sich (nach „Im Haus“ wieder von vorn, hier: zurück bis Haus)", JSON.stringify(z));
  ok(h.echt().length === 0, "kein Seitenfehler", h.echt()[0] || "still");
  await h.ctx.close();

  /* Nur die Arten, die es gibt */
  h = await hubAuf(br, "chocolamour", { abholen: true, abhol_min: 0 });
  await start(h);
  c = await chipsLesen(h);
  ok(c.map(x => x.art).join(",") === "abholen,haus", "nur Abholung eingeschaltet: Abholen · Im Haus (kein Lieferchip ohne Lieferung)", c.map(x => x.art).join(","));
  await h.p.click('[data-bestellart="abholen"]');
  await h.p.waitForTimeout(400);
  ok(await h.p.evaluate(() => abholenAktiv()), "und der Tipp geht, auch wenn der alte Schalter (Lieferung aus) versteckt ist");
  await h.ctx.close();

  h = await hubAuf(br, "chocolamour", Object.assign({}, LIEFER_BEIDE, { abholen: false }), { hash: "#/abholen" });
  await start(h);
  c = await chipsLesen(h);
  ok(c.map(x => x.art).join(",") === "liefern,haus", "Abholung aus: kein Abholchip", c.map(x => x.art).join(","));
  ok(!(await h.p.evaluate(() => abholmodus || abholenAktiv())), "und der Link #/abholen bleibt wirkungslos (nichts wählbar machen, was es nicht gibt)");
  await h.ctx.close();

  h = await hubAuf(br, "chocolamour", LIEFER_BEIDE, { hash: "?modus=abholen" });
  ok(await h.p.evaluate(() => abholenAktiv()), "der Link ?modus=abholen schaltet ein (wie ?modus=liefern)");
  await h.ctx.close();
  h = await hubAuf(br, "chocolamour", LIEFER_BEIDE, { hash: "#/abholen" });
  const nachLink = await h.p.evaluate(() => ({ a: abholenAktiv(), hash: location.hash }));
  ok(nachLink.a && nachLink.hash === "", "#/abholen schaltet ein und räumt die Adresse auf (kein Wiederöffnen beim Neuladen)", JSON.stringify(nachLink));
  await h.ctx.close();

  /* Am Tisch gibt es keine Abholung */
  h = await hubAuf(br, "chocolamour", LIEFER_BEIDE, { hash: "#/abholen" });
  await h.p.evaluate(() => { tischNr = "7"; liefermodusAbgleichen(); zeichne(); });
  const tisch = await h.p.evaluate(() => ({ a: abholmodus, angebot: abholAngebot(), chips: !document.getElementById("bestellart").hidden }));
  ok(!tisch.a && !tisch.angebot && !tisch.chips, "wer am Tisch sitzt, sieht keine Abholung (Untersetzer gewinnt)", JSON.stringify(tisch));
  await h.ctx.close();

  /* Ein Haus ohne Premium-Startseite behält seinen Zwei-Wege-Schalter */
  h = await hubAuf(br, "blend", Object.assign({}, LIEFER_BEIDE), { hash: "#/abholen" });
  const klass = await h.p.evaluate(() => ({ p: startPremium(), angebot: abholAngebot(), a: abholmodus, chips: !document.getElementById("bestellart").hidden }));
  ok(!klass.p && !klass.angebot && !klass.a && !klass.chips, "klassische Startseite: kein Abholchip, #/abholen ohne Wirkung (ehrliche Grenze: nur Premium)", JSON.stringify(klass));
  await h.ctx.close();
}

async function warenkorb(br){
  console.log("\n══ 2b · Hub · der Warenkorb bei Abholung ══");
  const h = await hubAuf(br, "chocolamour", LIEFER_BEIDE, { hash: "#/abholen" });
  /* Online-Zahlung wäre vorhanden — für die Abholung darf sie trotzdem nicht erscheinen. */
  await h.p.evaluate(() => { ZAHLARTEN.geladen = true; ZAHLARTEN.stripe = true; ZAHLARTEN.karte = true; ZAHLARTEN.ueberweisung = true; zahlWahl = "stripe"; });
  await auswahl(h);
  const w = await h.p.evaluate(() => {
    const e = id => document.getElementById(id);
    const r = e("aZeit") && e("aZeit").getBoundingClientRect();
    return { name: !!e("aName"), tel: !!e("aTelefon"), zeit: !!e("aZeit"), adresse: !!e("lStrasse"), tisch: !!e("bTisch"), zahlwahl: !!document.querySelector(".zahlwahl"),
      online: zahlartOnline(), knopf: (document.querySelector('[data-aktion="bestellen"]') || {}).textContent, knopfAus: !!(document.querySelector('[data-aktion="bestellen"]') || {}).disabled,
      hinweis: [...document.querySelectorAll(".hinweis")].map(x => x.textContent).join(" | "), zahlteil: (e("zahlteil") || {}).textContent || "",
      zeitFont: e("aZeit") ? parseFloat(getComputedStyle(e("aZeit")).fontSize) : 0, zeitHoch: r ? Math.round(r.height) : 0,
      min: e("aZeit") && e("aZeit").min, max: e("aZeit") && e("aZeit").max, hilfe: (e("aZeitHilfe") || {}).textContent };
  });
  ok(w.name && w.tel && w.zeit, "Name, Telefon und Abholzeit stehen da");
  ok(!w.adresse && !w.tisch, "keine Adressfelder, keine Tischfrage");
  ok(!w.zahlwahl && w.online === null, "keine Wahl der Zahlart und keine Online-Zahlung, obwohl das Haus sie hätte", "online=" + w.online);
  ok(/Zahlungspflichtig bestellen/.test(w.knopf) && !w.knopfAus, "der Knopf heißt „Zahlungspflichtig bestellen“ und ist frei", w.knopf);
  ok(/Bezahlt wird bei der Abholung/.test(w.hinweis) && /20 Minuten/.test(w.hinweis), "der Hinweis nennt: bezahlt wird bei der Abholung, Vorlauf 20 Minuten", w.hinweis.slice(0, 120));
  ok(/inkl\. MwSt\./.test(w.zahlteil) && /Widerrufsrecht/.test(w.zahlteil) && !/Liefergebühr/.test(w.zahlteil), "Zahlteil: Endpreis, Widerrufshinweis, keine Liefergebühr", w.zahlteil.replace(/\s+/g, " ").slice(0, 120));
  ok(w.zeitFont >= 16 && w.zeitHoch >= 44, "das Zeitfeld hat 16 px und ≥ 44 px", w.zeitFont + " px / " + w.zeitHoch + " px");
  ok(w.min === "14:20" && /^\d\d:\d\d$/.test(w.max), "frühestens jetzt + Vorlauf (14:00 + 20 min)", w.min + " … " + w.max);
  ok(/14:20/.test(w.hilfe || ""), "der Satz darunter nennt die früheste Zeit", w.hilfe);
  /* Lieferung zeigt weiter ihre Felder und nicht die der Abholung */
  await h.p.evaluate(() => { lieferWahl("liefern"); });
  await auswahl(h);
  const l = await h.p.evaluate(() => ({ adresse: !!document.getElementById("lStrasse"), name: !!document.getElementById("aName"), zahlwahl: !!document.querySelector(".zahlwahl"), online: zahlartOnline() }));
  ok(l.adresse && !l.name && l.zahlwahl && l.online === "stripe", "Gegenfall Lieferung: Adresse, Zahlwahl, Online-Zahlung wie vorher", JSON.stringify(l));
  ok(h.echt().length === 0, "kein Seitenfehler", h.echt()[0] || "still");
  await h.ctx.close();
}

async function bestellen(br){
  console.log("\n══ 2c · Hub · die Bestellung ══");
  /* a · ohne Zeit */
  let h = await hubAuf(br, "chocolamour", LIEFER_BEIDE, { hash: "#/abholen" });
  await auswahl(h);
  await h.p.click('[data-aktion="bestellen"]');
  await h.p.waitForTimeout(400);
  ok(h.gesendet.length === 0 && /Name und Telefon/.test(await h.p.evaluate(() => document.getElementById("melde") ? document.getElementById("melde").textContent : "")),
     "ohne Name und Telefon geht nichts hinaus und der Satz steht da", h.gesendet.length + " Anfragen");
  await h.p.fill("#aName", "  Murat Yildiz ");
  await h.p.fill("#aTelefon", "0151 2345678");
  await h.p.fill("#bNotiz", "ohne Sahne");
  await h.p.click('[data-aktion="bestellen"]');
  await h.p.waitForTimeout(1500);
  const k = h.gesendet[0] || {};
  ok(h.gesendet.length === 1, "genau eine Bestellung geht hinaus", h.gesendet.length);
  ok(SIGNATUR.length === 10, "zweite Quelle gelesen: 10 Parameter in migration-abholen.sql", SIGNATUR.join(","));
  const fremd = Object.keys(k).filter(x => SIGNATUR.indexOf(x) < 0), fehlt = SIGNATUR.filter(x => !(x in k));
  ok(!fremd.length && !fehlt.length, "die Nutzlast ist Parameter für Parameter die Signatur der SQL (§8.1i)", fremd.length || fehlt.length ? "fremd: " + fremd + " · fehlt: " + fehlt : "stimmt");
  ok(k.p_name === "Murat Yildiz" && k.p_telefon === "0151 2345678", "Name getrimmt, Telefon unverändert", JSON.stringify([k.p_name, k.p_telefon]));
  ok(k.p_abholzeit === null, "ohne gewählte Zeit: p_abholzeit ist null (so bald wie möglich)", JSON.stringify(k.p_abholzeit));
  ok(Array.isArray(k.p_positionen) && k.p_positionen.length === 2 && k.p_positionen[1].menge === 2 && Math.abs(k.p_summe - 15.4) < 0.01,
     "Positionen und Summe wie im Korb (Waffel 9 + 2 × Cola 3,20)", JSON.stringify(k.p_summe));
  ok(k.p_notiz === "ohne Sahne" && typeof k.p_gast_kennung === "string" && k.p_gast_kennung.length >= 8, "Notiz und Quittungsnummer kommen mit (Kennung ≥ 8 Zeichen)", k.p_gast_kennung);
  ok(h.falsch.length === 0, "nicht über bestellung_liefern / bestellung_aufgeben / *_zahlung", h.falsch.join(",") || "nur bestellung_abholen");
  /* Bestätigungsseite */
  const best = await h.p.evaluate(() => ({ hash: location.hash, text: document.getElementById("inhalt").textContent.replace(/\s+/g, " "),
    pass: (document.querySelector(".bp-text") || {}).textContent, tisch: !!document.querySelector(".btisch") && document.querySelector(".btisch").textContent }));
  ok(best.hash === "#/bestellt" && /Abholung so bald wie möglich/.test(best.text), "Bestätigung: „Abholung so bald wie möglich“", best.tisch);
  ok(/abholbereit/.test(best.text) && !/kommen gleich zu Ihnen an den Tisch/.test(best.text), "und der Satz spricht von Abholung, nicht vom Tisch");
  ok(/Bezahlt wird bei der Abholung/.test(best.text), "Hinweis: bezahlt wird bei der Abholung");
  const pass = await h.p.evaluate(() => ({ fertigAbhol: phaseHTML("fertig", 101, true), fertigTisch: phaseHTML("fertig", 101, false), neuAbhol: phaseHTML("neu", 101, true), neuTisch: phaseHTML("neu", 101, false) }));
  ok(/bitte abholen/.test(pass.fertigAbhol) && !/Tisch/.test(pass.fertigAbhol), "Bestellpass „Fertig“ heißt bei Abholung „bitte abholen“", pass.fertigAbhol.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60));
  ok(/kommt zum Tisch/.test(pass.fertigTisch) && pass.neuAbhol === pass.neuTisch, "Gegenfall: am Tisch unverändert; die anderen Phasen gleich");
  ok(h.echt().length === 0, "kein Seitenfehler", h.echt()[0] || "still");
  await h.ctx.close();

  /* b · Zeitfenster */
  h = await hubAuf(br, "chocolamour", LIEFER_BEIDE, { hash: "#/abholen" });
  await auswahl(h);
  await h.p.fill("#aName", "Gast"); await h.p.fill("#aTelefon", "0151 1");
  const zeitVersuch = async z => { await h.p.fill("#aZeit", z); await h.p.click('[data-aktion="bestellen"]'); await h.p.waitForTimeout(500); };
  for(const schlecht of ["13:00", "14:10", "00:30"]){
    const vorher = h.gesendet.length;
    await zeitVersuch(schlecht);
    const satz = await h.p.evaluate(() => (document.getElementById("melde") || {}).textContent || "");
    ok(h.gesendet.length === vorher && /zwischen 14:20 und 2\d:\d\d Uhr|zwischen 14:20 und 23:59 Uhr/.test(satz), "Zeit " + schlecht + " geht nicht hinaus, der Satz nennt das Fenster", satz.slice(0, 70));
  }
  await zeitVersuch("14:35");
  await h.p.waitForTimeout(800);
  ok(h.gesendet.length === 1 && h.gesendet[0].p_abholzeit === "14:35", "14:35 geht hinaus und kommt als „14:35“ an", JSON.stringify(h.gesendet.map(x => x.p_abholzeit)));
  const best2 = await h.p.evaluate(() => document.getElementById("inhalt").textContent.replace(/\s+/g, " "));
  ok(/Abholung um 14:35 Uhr/.test(best2), "die Bestätigung nennt die Zeit", (best2.match(/Abholung um[^A-Z]*Uhr/) || [""])[0]);
  await h.ctx.close();

  /* c · der Server lehnt grundsätzlich ab: keine zehn Minuten Wiederholen */
  for(const grund of ["aus", "angaben", "zeit"]){
    h = await hubAuf(br, "chocolamour", LIEFER_BEIDE, { hash: "#/abholen", antwort: () => ({ ok: false, grund }) });
    await auswahl(h);
    await h.p.fill("#aName", "Gast"); await h.p.fill("#aTelefon", "0151 1");
    await h.p.click('[data-aktion="bestellen"]');
    await h.p.waitForTimeout(1800);
    await h.p.evaluate(() => { warteschlange.forEach(e => e.naechster = 0); return wsAbarbeiten(); });
    await h.p.waitForTimeout(800);
    const st = await h.p.evaluate(() => ({ z: warteschlange.map(e => e.zustand + ":" + (e.grund || "")).join(","), titel: (document.querySelector(".wsstreifen .wstitel") || {}).textContent }));
    ok(h.gesendet.length === 1 && /gescheitert:abholung/.test(st.z), "Absage „" + grund + "“: ein Versuch, dann endgültig (nicht zehn Minuten Wiederholen)", h.gesendet.length + " Anfragen · " + st.z);
    ok(/Diese Abholung ist gerade nicht möglich/.test(st.titel || ""), "und der Gast liest, was los ist (mit dem Ausweg „Bestellung zeigen“)", st.titel);
    await h.ctx.close();
  }
  ok(["aus", "angaben", "zeit"].every(g => GRUENDE.indexOf(g) >= 0), "zweite Quelle: die drei Gründe gibt es in der SQL", [...new Set(GRUENDE)].join(","));
  /* eine Absage, die man wiederholen kann (Preis): bleibt in der Warteschlange */
  h = await hubAuf(br, "chocolamour", LIEFER_BEIDE, { hash: "#/abholen", antwort: () => ({ ok: false, grund: "abgewiesen" }) });
  await auswahl(h);
  await h.p.fill("#aName", "Gast"); await h.p.fill("#aTelefon", "0151 1");
  await h.p.click('[data-aktion="bestellen"]');
  await h.p.waitForTimeout(1500);
  const bleibt = await h.p.evaluate(() => warteschlange.map(e => e.zustand).join(","));
  ok(bleibt === "offen", "Gegenfall: „abgewiesen“ ist keine Grundsatz-Absage — die Bestellung bleibt im Gerät und wird wiederholt", bleibt);
  await h.ctx.close();

  /* d · eingefroren beim Einreihen (§8.1q) */
  h = await hubAuf(br, "chocolamour", LIEFER_BEIDE, { hash: "#/abholen" });
  h.steuer.aus = true;
  await auswahl(h);
  await h.p.fill("#aName", "Erika Muster"); await h.p.fill("#aTelefon", "0171 999"); await h.p.fill("#aZeit", "15:10");
  await h.p.click('[data-aktion="bestellen"]');
  await h.p.waitForTimeout(1500);
  ok(h.gesendet.length === 0, "Voraussetzung: der Server ist stumm, die Bestellung wartet im Gerät");
  const kennung1 = await h.p.evaluate(() => warteschlange[0] && warteschlange[0].kennung);
  await h.p.reload();
  await h.p.waitForTimeout(1500);
  /* nach dem Neuladen etwas ganz anderes wählen */
  await h.p.evaluate(() => { merk = { "Cola": { n: "Cola", m: 5, p: "3,20" } }; merkSpeichern(); });
  h.steuer.aus = false;
  await h.p.evaluate(() => { warteschlange.forEach(e => e.naechster = 0); return wsAbarbeiten(); });
  await h.p.waitForTimeout(1200);
  const z2 = h.gesendet[0] || {};
  ok(h.gesendet.length === 1 && z2.p_name === "Erika Muster" && z2.p_telefon === "0171 999" && z2.p_abholzeit === "15:10",
     "nach Neuladen und anderer Wahl geht Name, Telefon und Zeit VON DAMALS hinaus", JSON.stringify([z2.p_name, z2.p_telefon, z2.p_abholzeit]));
  ok(z2.p_positionen && z2.p_positionen.some(x => x.name === "Waffel") && !z2.p_positionen.some(x => x.menge === 5), "und der Korb von damals, nicht die neue Wahl", JSON.stringify(z2.p_positionen && z2.p_positionen.map(x => x.name + "×" + x.menge)));
  ok(z2.p_gast_kennung === kennung1, "und dieselbe Quittungsnummer (ein Wiederholungsversuch legt nicht doppelt an)", String(z2.p_gast_kennung).slice(0, 12));
  await h.ctx.close();

  /* e · nach Mitternacht gibt es keine feste Zeit mehr */
  h = await hubAuf(br, "chocolamour", LIEFER_BEIDE, { hash: "#/abholen" });
  await h.p.clock.setFixedTime(new Date("2026-10-10T23:50:00"));
  await auswahl(h);
  const spaet = await h.p.evaluate(() => ({ f: abholFenster(), hilfe: (document.getElementById("aZeitHilfe") || {}).textContent, min: document.getElementById("aZeit") && document.getElementById("aZeit").getAttribute("min") }));
  ok(!spaet.f.heuteNoch && /keine feste Zeit mehr/.test(spaet.hilfe || "") && spaet.min === null, "um 23:50 mit 20 min Vorlauf: keine feste Zeit mehr, das Feld hat keine Grenzen und sagt es", JSON.stringify([spaet.f.heuteNoch, spaet.hilfe && spaet.hilfe.slice(0, 40), spaet.min]));
  await h.ctx.close();
}

async function sprachen(br){
  console.log("\n══ 2d · Hub · Sprachen und Recht ══");
  const h = await hubAuf(br, "chocolamour", LIEFER_BEIDE, { hash: "#/abholen" });
  const SCHL = ["Abholen", "TELEFON FÜR RÜCKFRAGEN", "ABHOLZEIT (OPTIONAL)", "Leer lassen heißt: so bald wie möglich. Frühestens {z} Uhr.",
    "Heute geht keine feste Zeit mehr – wir bereiten Ihre Bestellung so bald wie möglich vor.", "Bitte füllen Sie Name und Telefon aus.",
    "Bitte wählen Sie eine Abholzeit zwischen {von} und {bis} Uhr – oder lassen Sie das Feld leer.", "Bezahlt wird bei der Abholung, direkt bei uns.",
    "Frühestens in etwa {m} Minuten abholbereit.", "Wir haben Ihre Bestellung erhalten. Sobald sie abholbereit ist, sehen Sie es hier.",
    "Abholung um {z} Uhr", "Abholung so bald wie möglich", "Bezahlt wird bei der Abholung. Sollte etwas nicht stimmen, sagen Sie uns bitte kurz Bescheid.",
    "Fertig — bitte abholen", "Ist abholbereit", "Diese Abholung ist gerade nicht möglich"];
  /* Jeder Satz, den der Quelltext mit t("…") ruft, steht im Wörterbuch — die Liste oben ist die zweite Quelle, der Quelltext die erste. */
  const imText = SCHL.filter(s => HUBQ.indexOf('t("' + s + '"') >= 0 || HUBQ.indexOf("t('" + s + "'") >= 0 || HUBQ.indexOf('"' + s + '"') >= 0);
  ok(imText.length === SCHL.length, "jeder neue Satz kommt im Quelltext vor (die Liste ist nicht erfunden)", SCHL.length - imText.length + " fehlen");
  const luecken = await h.p.evaluate(s => s.filter(k => !TEXTE[k] || ["en","tr","ru","fr","es","it","pl","ar","uk","nl","ro"].some(c => !TEXTE[k][c])), SCHL);
  ok(luecken.length === 0, "alle 16 Sätze tragen alle elf Sprachen", luecken.join(" | "));
  /* Am gemalten Bild: Arabisch, Türkisch — der Chip heißt nicht deutsch */
  for(const code of ["ar", "tr", "en"]){
    await h.p.evaluate(c => { spracheSetzen(c); location.hash = "#/"; zeichne(); }, code);
    await h.p.waitForTimeout(500);
    const t = await h.p.evaluate(() => (document.querySelector('[data-bestellart="abholen"] .ba-text') || {}).textContent);
    ok(!!t && t !== "Abholen", code + ": der Abholchip ist übersetzt", t);
  }
  await h.p.evaluate(() => { spracheSetzen("de"); });
  /* Datenschutz nennt die Abholung, nur wenn es sie gibt */
  const ds = async liefer => { const x = await hubAuf(br, "chocolamour", liefer); const t = await x.p.evaluate(() => SEITEN.datenschutz().replace(/<[^>]+>/g, " ")); await x.ctx.close(); return t; };
  const beide = await ds(LIEFER_BEIDE), nurA = await ds({ abholen: true }), nurL = await ds({ an: true, plz: ["1"] }), keine = await ds({});
  ok(/4 · Lieferung und Abholung/.test(beide) && /4 · Abholung/.test(nurA) && !/Lieferung/.test((nurA.match(/4 · [^\n]{0,40}/) || [""])[0]) && /4 · Lieferung/.test(nurL) && !/Abholung/.test((nurL.match(/4 · [^\n]{0,40}/) || [""])[0]) && !/4 · (Lieferung|Abholung)/.test(keine),
     "Datenschutz: der Abschnitt „4“ nennt genau die Arten, die das Haus anbietet (vier Fälle)");
  await h.ctx.close();
}

/* ═══════════════════════════════════════════════════════════════════ 3 · KÜCHE */
async function kueche(br){
  console.log("\n══ 3 · Die Küche ══");
  const BETRIEB = "11111111-1111-4111-8111-111111111111";
  const jetzt = Date.now();
  const BONS = [
    { id: "a1", betrieb_id: BETRIEB, quelle: "lieferung", status: "neu", tisch: null, positionen: [{ name: "Waffel", menge: 1 }], notiz: null, zeitpunkt: new Date(jetzt - 2 * 60000).toISOString(),
      kueche_fertig_um: null, theke_fertig_um: null, gast_name: "Murat Yildiz", gast_telefon: "0151 2345678", abholung: true, wunschzeit: new Date(jetzt + 45 * 60000).toISOString(), tagesnummer: 101, liefer_adresse: null, liefergebuehr: 0 },
    { id: "a2", betrieb_id: BETRIEB, quelle: "lieferung", status: "neu", tisch: null, positionen: [{ name: "Cola", menge: 2 }], notiz: null, zeitpunkt: new Date(jetzt - 3 * 60000).toISOString(),
      kueche_fertig_um: null, theke_fertig_um: null, gast_name: null, gast_telefon: null, abholung: true, wunschzeit: null, tagesnummer: 102, liefer_adresse: null, liefergebuehr: 0 },
    { id: "l1", betrieb_id: BETRIEB, quelle: "lieferung", status: "neu", tisch: null, positionen: [{ name: "Crêpe", menge: 1 }], notiz: null, zeitpunkt: new Date(jetzt - 4 * 60000).toISOString(),
      kueche_fertig_um: null, theke_fertig_um: null, gast_name: null, gast_telefon: null, abholung: false, wunschzeit: null, tagesnummer: 103,
      liefer_adresse: { name: "Frau Weber", strasse: "Musterweg 1", plz: "35037", ort: "Marburg", telefon: "0173 1" }, liefergebuehr: 2.5 }
  ];
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0, 160)));
  await p.route("**/*", route => {
    const u = route.request().url();
    if(u.startsWith("file://")) return route.continue();
    if(u.includes("/rest/v1/bestellungen")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(BONS) });
    if(u.includes("/rest/v1/betriebe")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: BETRIEB, name: "Prüfhaus", slug: "pruefhaus", bestell_pause: false, bestell_pause_text: "", hub_texte: {} }]) });
    if(u.includes("/auth/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: { id: "u1", email: "p@example.org" } }) });
    if(u.includes("/rest/v1/betrieb_mitglieder")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ betrieb_id: BETRIEB, nutzer_id: "u1", rolle: "inhaber" }]) });
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await p.addInitScript(() => { localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600 })); });
  await p.goto("file://" + path.join(SEITEN, "kueche.html"));
  await p.waitForTimeout(1800);
  const bon = id => p.evaluate(i => { const e = document.querySelector('[data-id="' + i + '"]'); return e ? e.textContent.replace(/\s+/g, " ") : null; }, id);
  const a1 = await bon("a1"), a2 = await bon("a2"), l1 = await bon("l1");
  ok(!!a1 && /Abholung/.test(a1) && !/Lieferung/.test(a1.slice(0, 40)), "der Bon heißt „Abholung“ (nicht „Lieferung“)", a1 && a1.slice(0, 60));
  ok(!!a1 && /Zum Abholen/.test(a1) && /Murat Yildiz/.test(a1) && /0151 2345678/.test(a1), "und nennt Name und Telefon", a1 && (a1.match(/Zum Abholen[^A-Z]*/) || [""])[0]);
  ok(!!a1 && /\d\d:\d\d Uhr/.test(a1), "und die gewünschte Abholzeit", a1 && (a1.match(/\d\d:\d\d Uhr/) || [""])[0]);
  ok(!!a2 && /So bald wie möglich/.test(a2) && /ohne Namen/.test(a2), "ohne Zeit: „So bald wie möglich“; ohne Namen steht es da statt leer", a2 && a2.slice(0, 80));
  ok(!!l1 && /Lieferung/.test(l1) && /Liefern an/.test(l1) && /Marburg/.test(l1) && !/Zum Abholen/.test(l1), "Gegenfall: die Lieferung bleibt eine Lieferung mit Adresse", l1 && l1.slice(0, 80));
  ok(echt(kons).length === 0, "die Küche wirft keinen Fehler", echt(kons)[0] || "still");
  await ctx.close();
}

/* ═══════════════════════════════════════════════════════════════════ 4 · NAHT */
function naht(){
  console.log("\n══ 4 · Die Naht ══");
  const BOARD = fs.readFileSync(path.join(SEITEN, "admin.html"), "utf8");
  const form = (/const LF_FORMULAR = \[([^\]]*)\]/.exec(BOARD) || [0, ""])[1].replace(/["\s]/g, "").split(",");
  ok(form.includes("abholen") && form.includes("abhol_min"), "das Board schreibt abholen und abhol_min", form.join(","));
  ok(/LIEFER\.abholen\s*=\s*lf\.abholen === true/.test(HUBQ) && /lf\.abhol_min/.test(HUBQ), "der Hub liest genau diese Schlüssel (abholen strikt true)");
  ok(/'abholen'\)::boolean/.test(SQL), "und die SQL liest den Schlüssel „abholen“ aus betriebe.liefer", "ja");
  /* Jeder Schlüssel, den das Formular setzt, kennt der Hub (sonst schreibt das Board ins Leere). */
  const hubLiest = [...HUBQ.matchAll(/lf\.([a-z_]+)/g)].map(m => m[1]);
  const ohne = form.filter(k => k !== "zeiten" && hubLiest.indexOf(k) < 0 && k !== "plz");
  ok(ohne.length === 0, "kein Schlüssel des Formulars bleibt vom Hub ungelesen", ohne.join(",") || "alle gelesen");
  ok(!/p_quelle:\s*"abholung"/.test(HUBQ), "der Hub erfindet keine Quelle „abholung“ (die CHECK-Liste kennt sie nicht, §2.3c)");
}

(async () => {
  const br = await chromium.launch();
  try{
    naht();
    await board(br);
    await hub(br);
    await warenkorb(br);
    await bestellen(br);
    await sprachen(br);
    await kueche(br);
  }finally{ await br.close(); }
  console.log("\n" + (fehler ? fehler + " von " + n + " Fehler." : n + " von " + n + " ok\nAlles sauber."));
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
