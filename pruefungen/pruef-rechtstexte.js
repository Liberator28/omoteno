/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Impressum und Datenschutz im Gästehub (18.10.)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-rechtstexte.js

   dokumente/recht/01 Befund 1: Der Hub hatte keins von beiden.
   · Fußzeile jeder Ansicht: „Impressum · Datenschutz“, ≥ 44 px,
     lesbar; ein echter Tipp öffnet die Seite.
   · Impressum zeigt, was im Markenblatt steht, und „Angabe fehlt noch“
     statt still nichts; das Vorführhaus nennt Omoteno.
   · Werte aus dem Markenblatt nur als Text (Tag/onerror wirkungslos).
   · Datenschutz: Abschnitte nur für Funktionen, die das Haus nutzt
     (Gegenfall: Lieferung an → Abschnitt da).
   · ZWEITE QUELLE: jeder Speicherschlüssel der Vorlage steht in
     SPEICHER_EINTRAEGE — statisch aus dem Quelltext UND zur Laufzeit
     nach Bestellen, „Mein Tisch“, Sprache, Reservierung; und kein
     Eintrag ohne Schlüssel in der Vorlage.
   · Keine Löschfrist auf der Seite, solange LOESCHFRISTEN_LIVE aus ist
     (sonst wäre es eine Behauptung, CLAUDE.md §0).
   · Link über dem Bestellknopf und am E-Mail-Feld; Englisch übersetzt.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const HIER = path.resolve(__dirname, "..");
const BID  = "af095b14-d9ef-41f4-9b97-c4422b0de63f";
const VORLAGE = fs.readFileSync(path.join(HIER, "vorlagen", "hub.vorlage.html"), "utf8");

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz !== undefined && zusatz !== "" ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}
const hubs = () => {
  const o = path.join(HIER, "dist");
  return fs.existsSync(o) ? fs.readdirSync(o).filter(s => fs.existsSync(path.join(o, s, "index.html"))).sort() : [];
};

const KONTRAST = `(el => {
  const farbe = s => { if(/^color\\(srgb/.test(s)){ const m = s.match(/[\\d.]+/g).map(Number);
      return [m[0]*255, m[1]*255, m[2]*255, m.length > 3 ? m[3] : 1]; }
    const m = s.match(/[\\d.]+/g); if(!m) return null; const c = m.map(Number); return c.length === 3 ? c.concat(1) : c; };
  const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  const L = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
  const vorn = farbe(getComputedStyle(el).color);
  let grund = null;
  for(let n = el; n; n = n.parentElement){ const c = farbe(getComputedStyle(n).backgroundColor); if(c && c[3] >= .99){ grund = c; break; } }
  if(!grund) grund = farbe(getComputedStyle(document.documentElement).backgroundColor) || [255,255,255,1];
  const a = L(vorn), b = L(grund); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
})`;

async function oeffnen(browser, datei, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: opt.breite || 390, height: 844 } });
  if(opt.sprache) await ctx.addInitScript(sp => { try{ localStorage.setItem("tapto-sprache", sp); }catch(e){} }, opt.sprache);
  const seite = await ctx.newPage();
  const fehlerSeite = [];
  seite.on("pageerror", e => fehlerSeite.push(e.message));
  await seite.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await seite.route("**/rest/v1/betriebe**", r => r.fulfill({ status:200, contentType:"application/json",
    body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) }));
  await seite.route("**/rest/v1/rpc/gast_melden", r => r.fulfill({ status:200, contentType:"application/json",
    body: JSON.stringify({ ok:true, besuche:1, lieblinge:[], gutscheine:[] }) }));
  await seite.route("**/rest/v1/rpc/bestellung_aufgeben", r => r.fulfill({ status:200, contentType:"application/json",
    body: JSON.stringify("11111111-2222-3333-4444-000000000001") }));
  await seite.route("**/rest/v1/rpc/reservierung_anfragen", r => r.fulfill({ status:200, contentType:"application/json",
    body: JSON.stringify({ ok:true, nummer:"R-12", id:"11111111-2222-3333-4444-000000000002" }) }));
  await seite.goto(datei);
  await seite.waitForTimeout(500);
  await seite.evaluate(() => { const wk = document.querySelector(".willkommen"); if(wk) wk.remove();
    try{ bestellStopp = () => null; }catch(e){} });
  return { ctx, seite, fehlerSeite };
}
const kontrastVon = (seite, sel) =>
  seite.evaluate(KONTRAST + "(document.querySelector(" + JSON.stringify(sel) + "))").catch(() => null);
const geh = async (seite, h) => { await seite.evaluate(x => { location.hash = x; }, h); await seite.waitForTimeout(350); };

(async () => {
  const liste = hubs();
  if(!liste.length){ console.log("Kein erzeugter Hub in dist/."); process.exit(1); }
  const browser = await chromium.launch();

  /* ── 1 · Zweite Quelle: Speicherschlüssel der Vorlage ↔ Liste ── */
  console.log("\n── Speicherschlüssel ↔ SPEICHER_EINTRAEGE ──");
  const block = (VORLAGE.match(/const SPEICHER_EINTRAEGE = \[([\s\S]*?)\n\];/) || ["", ""])[1];
  const eintraege = [...block.matchAll(/m:"([^"]+)"/g)].map(x => x[1]);
  pruef(eintraege.length >= 20, "Voraussetzung: Liste gelesen", eintraege.length);
  const schluessel = new Set();
  for(const x of VORLAGE.matchAll(/hSchluessel\("([a-z-]+)"\)/g)) schluessel.add("omoteno-" + x[1] + "-");
  for(const x of VORLAGE.matchAll(/"(omoteno-[a-z-]+)"/g)) if(x[1] !== "omoteno-") schluessel.add(x[1]);
  for(const x of VORLAGE.matchAll(/"(tapto-[a-z-]+)"/g)) schluessel.add(x[1]);
  const fehlt = [...schluessel].filter(k => !eintraege.includes(k));
  pruef(fehlt.length === 0, schluessel.size + " Schlüssel der Vorlage stehen in der Liste", fehlt.join(", "));
  const tot = eintraege.filter(e => !schluessel.has(e));
  pruef(tot.length === 0, "kein Eintrag ohne Schlüssel in der Vorlage", tot.join(", "));
  pruef(/const LOESCHFRISTEN_LIVE = false;/.test(VORLAGE) || /const LOESCHFRISTEN_LIVE = true;/.test(VORLAGE),
    "Voraussetzung: Schalter für die Löschfristen gefunden");

  for(const slug of liste){
    const datei = "file://" + path.join(HIER, "dist", slug, "index.html");
    console.log("\n── " + slug + " ──");
    const { ctx, seite, fehlerSeite } = await oeffnen(browser, datei);

    /* 2 · Fußzeile auf Start und Unterseite */
    for(const h of ["#/", "#/speisekarte"]){
      await geh(seite, h);
      const l = await seite.$$eval("#rechtFuss .rechtlink", els => els.map(e => {
        const r = e.getBoundingClientRect(); return { t:e.textContent.trim(), h:r.height, w:r.width, href:e.getAttribute("href") }; }));
      pruef(l.length === 2 && l[0].href === "#/impressum" && l[1].href === "#/datenschutz",
        h + ": Fußzeile mit Impressum und Datenschutz", l.map(x => x.t).join(" · "));
      pruef(l.every(x => x.h >= 44 && x.w >= 44), h + ": beide ≥ 44 px", l.map(x => Math.round(x.h)).join("/"));
      const k = await kontrastVon(seite, "#rechtFuss .rechtlink");
      pruef(k != null && k >= 4.5, h + ": lesbar", k && k.toFixed(2) + ":1");
    }
    /* echter Tipp */
    await seite.locator("#rechtFuss .rechtlink").first().scrollIntoViewIfNeeded();
    await seite.locator("#rechtFuss .rechtlink").first().click();
    await seite.waitForTimeout(400);
    pruef(await seite.evaluate(() => location.hash) === "#/impressum", "Tipp öffnet #/impressum");
    const imp = await seite.textContent("#inhalt");
    const vor = await seite.evaluate(() => window.OMOTENO_DEMO === true || !!MARKENBLATT.demo);
    const mb = await seite.evaluate(() => ({ r: MARKENBLATT.recht || {}, b: BETRIEB }));
    pruef(/Angaben nach § 5 DDG/.test(imp), "Impressum: Überschrift nach § 5 DDG");
    if(vor){
      pruef(/Vorführung/.test(imp) && /hallo@omoteno\.de/.test(imp), "Vorführhaus: als Vorführung gekennzeichnet, Omoteno als Anbieter");
    } else {
      for(const [n, w] of [["Straße", mb.b.strasse], ["Ort", mb.b.ort], ["E-Mail", mb.b.mail], ["Telefon", mb.b.telefon], ["Firma", mb.r.firma]])
        pruef(w ? imp.indexOf(w) >= 0 : /Angabe fehlt noch/.test(imp),
          "Impressum: " + n + (w ? " steht da" : " fehlt → „Angabe fehlt noch“ sichtbar"), w || "");
    }

    /* 3 · Datenschutz */
    await geh(seite, "#/datenschutz");
    let ds = await seite.textContent("#inhalt");
    pruef(/Wer verantwortlich ist/.test(ds) && /Art\. 28 DSGVO/.test(ds), "Datenschutz: Verantwortlicher und Omoteno als Auftragsverarbeiter");
    pruef(/§ 25 TDDDG/.test(ds), "Datenschutz: Geräte-Einträge erklärt");
    const zeilen = await seite.$$eval(".rs-eintrag", els => els.length);
    pruef(zeilen === eintraege.length, "jede Zeile der Liste auf der Seite", zeilen + " von " + eintraege.length);
    const live = /const LOESCHFRISTEN_LIVE = true;/.test(VORLAGE);
    pruef(live || !/90 Tagen|24 Monate|30 Tagen|30 Tage nach/.test(ds),
      "keine Löschfrist genannt, solange sie nicht live ist");
    const hatLiefer = await seite.evaluate(() => LIEFER.an);
    pruef(hatLiefer === /Lieferung/.test(ds.replace(/Lieferanschrift/g, "")), "Abschnitt Lieferung genau dann, wenn das Haus liefert", String(hatLiefer));
    await seite.evaluate(() => { LIEFER.an = true; MARKENBLATT.recht = Object.assign({}, MARKENBLATT.recht, { alessia:true }); zeichne(); });
    await seite.waitForTimeout(300);
    ds = await seite.textContent("#inhalt");
    pruef(/4 · Lieferung/.test(ds), "Gegenfall: Lieferung an → Abschnitt da");
    pruef(/Alessia/.test(ds) && /KI-Assistentin/.test(ds), "Gegenfall: Alessia an → Abschnitt da");
    const ueber = await seite.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(ueber <= 1, "kein seitlicher Überlauf", ueber + " px");
    for(const sel of [".rechtseite p", ".rs-eintrag span"]){
      const k = await kontrastVon(seite, sel);
      pruef(k != null && k >= 4.5, "lesbar: " + sel, k && k.toFixed(2) + ":1");
    }

    /* 4 · Nur Text */
    if(!vor){
      await seite.evaluate(() => { MARKENBLATT.recht = { firma:'<img src=x onerror="window.__lecks=1">"><b>X</b>' }; location.hash = "#/impressum"; zeichne(); });
      await seite.waitForTimeout(300);
      const t = await seite.evaluate(() => ({ img: document.querySelectorAll("#inhalt img[src='x']").length,
        b: document.querySelectorAll("#inhalt b").length, lecks: window.__lecks === 1,
        text: document.getElementById("inhalt").textContent.indexOf("<img") >= 0 }));
      pruef(t.img === 0 && !t.lecks && t.text, "Markenblatt-Wert erscheint nur als Text", JSON.stringify(t));
    }
    pruef(fehlerSeite.length === 0, "kein Fehler auf der Seite", fehlerSeite.join(" | "));
    await ctx.close();
  }

  /* ── 5 · Laufzeit: was wirklich im Gerät landet ── */
  console.log("\n── Zur Laufzeit abgelegte Schlüssel ──");
  {
    const slug = liste.find(s => s !== "nordstern") || liste[0];
    const { ctx, seite, fehlerSeite } = await oeffnen(browser, "file://" + path.join(HIER, "dist", slug, "index.html"));
    const taugt = await seite.evaluate(() => BESTELLUNG.an && serverBereit());
    pruef(taugt, "Voraussetzung: Haus mit Bestellung und Server", slug);
    /* Mein Tisch einschalten, Sprache wählen, bestellen, Ruf, Liefermodus */
    await geh(seite, "#/meintisch");
    const an = await seite.$('[data-aktion="stammgastAn"]'); if(an){ await an.click(); await seite.waitForTimeout(400); }
    const post = await seite.$$eval(".gastpost .rechtlink", els => els.map(e => e.getAttribute("href")));
    pruef(post.includes("#/datenschutz"), "am E-Mail-Feld: Link zur Datenschutzerklärung");
    await seite.evaluate(() => {
      for(const gr of SPEISEKARTE) for(const e of gr.eintraege) if(preisNum(e.p) > 0){
        merk = { [e.n]: { n:e.n, p:e.p, b:"", m:1 } }; merkSpeichern(); return; }
    });
    await geh(seite, "#/auswahl");
    const ueberKnopf = await seite.$$eval("#zahlteil .rechtlink", els => els.map(e => e.getAttribute("href")));
    pruef(ueberKnopf.length === 2, "über dem Bestellknopf: Impressum und Datenschutz", ueberKnopf.join(","));
    const feld = await seite.$("#bTisch"); if(feld) await feld.fill("7");
    const k = await seite.$('[data-aktion="bestellen"]'); if(k){ await k.click(); await seite.waitForTimeout(900); }
    await geh(seite, "#/speisekarte");
    const roh = await seite.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)));
    const listeLauf = await seite.evaluate(() => SPEICHER_EINTRAEGE.map(e => e.m));
    const fremd = roh.filter(k => !listeLauf.some(m => k === m || k.startsWith(m)));
    pruef(roh.length >= 5, "Voraussetzung: Einträge entstanden", roh.length);
    pruef(fremd.length === 0, roh.length + " Einträge im Gerät — jeder steht in der Liste", fremd.join(", "));
    pruef(fehlerSeite.length === 0, "kein Fehler auf der Seite", fehlerSeite.join(" | "));
    await ctx.close();
  }

  /* ── 6 · Englisch ── */
  console.log("\n── Englisch ──");
  {
    const slug = liste.find(s => s !== "nordstern") || liste[0];
    const { ctx, seite } = await oeffnen(browser, "file://" + path.join(HIER, "dist", slug, "index.html"), { sprache:"en" });
    const l = await seite.$$eval("#rechtFuss .rechtlink", els => els.map(e => e.textContent.trim()));
    pruef(l.join("|") === "Legal notice|Privacy", "Fußzeile übersetzt", l.join(" · "));
    await geh(seite, "#/datenschutz");
    pruef(/only available in German/.test(await seite.textContent("#inhalt")), "sagt, dass der Text deutsch ist");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
