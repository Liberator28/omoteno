/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Preisangaben und Bestellknopf (18.10.)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-preisangaben.js

   dokumente/recht/01 Befunde 3 und 8:
   · § 312j Abs. 3 BGB — der Knopf heißt „Zahlungspflichtig bestellen“,
     in jeder Sprache übersetzt.
   · § 312j Abs. 2 BGB — der zu zahlende Betrag steht UNMITTELBAR vor dem
     Knopf (vorher lagen bis zu acht Felder dazwischen), im Liefermodus
     mit Liefergebühr und dem Hinweis, dass kein Widerrufsrecht besteht.
   · § 6/§ 7 PAngV — „inkl. MwSt.“ unter jeder Karte und im Zahlteil,
     im Liefermodus die Liefergebühr unter der Karte.
   · Der Betrag läuft bei −/+ mit. Vorher blieben „Lieferung“ und
     „Zu zahlen“ beim alten Betrag stehen, nur die Zwischensumme lief.
   · Der Top-Runner-Knopf „+“ legt in den Warenkorb und heißt auch so —
     vorher kündigte er Vorlesern „Sofort bestellen“ an.

   Uhr und Öffnungszeiten setzt die Prüfung selbst (CLAUDE.md §8.1j):
   bestellStopp und liefertGerade werden für die Messung ersetzt, und
   dass der Bestellteil dann wirklich da ist, wird selbst geprüft.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const HIER = path.resolve(__dirname, "..");
const BID  = "af095b14-d9ef-41f4-9b97-c4422b0de63f";   /* frei erfunden */

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz !== undefined && zusatz !== "" ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

function erzeugteHubs(){
  const ordner = path.join(HIER, "dist");
  if(!fs.existsSync(ordner)) return [];
  return fs.readdirSync(ordner).filter(s => fs.existsSync(path.join(ordner, s, "index.html"))).sort();
}

/* Kontrast der Schrift gegen die erste deckende Fläche darunter. */
const KONTRAST = `(sel => {
  const el = document.querySelector(sel); if(!el) return null;
  const rgb = s => { const m = s.match(/[\\d.]+/g); return m ? m.map(Number) : null; };
  const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  const L = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
  const farbe = s => { if(/^color\\(srgb/.test(s)){ const m = s.match(/[\\d.]+/g).map(Number);
      return [m[0]*255, m[1]*255, m[2]*255, m.length > 3 ? m[3] : 1]; }
    const c = rgb(s); return c && c.length === 3 ? c.concat(1) : c; };
  const vorn = farbe(getComputedStyle(el).color);
  let grund = null;
  for(let n = el; n; n = n.parentElement){
    const c = farbe(getComputedStyle(n).backgroundColor);
    if(c && c[3] >= .99){ grund = c; break; }
  }
  if(!grund) grund = farbe(getComputedStyle(document.documentElement).backgroundColor) || [255,255,255,1];
  const a = L(vorn), b = L(grund);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
})`;

async function oeffnen(browser, datei, breite, sprache){
  const ctx = await browser.newContext({ viewport: { width: breite, height: 860 } });
  if(sprache) await ctx.addInitScript(sp => { try{ localStorage.setItem("tapto-sprache", sp); }catch(e){} }, sprache);
  const seite = await ctx.newPage();
  const fehlerSeite = [];
  seite.on("pageerror", e => fehlerSeite.push(e.message));
  await seite.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await seite.route("**/rest/v1/betriebe**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) }));
  await seite.goto(datei);
  await seite.waitForTimeout(500);
  await seite.evaluate(() => {
    const wk = document.querySelector(".willkommen"); if(wk) wk.remove();
    try{ bestellStopp = () => null; }catch(e){}
    try{ liefertGerade = () => true; }catch(e){}
  });
  return { ctx, seite, fehlerSeite };
}

/* Ein Gericht mit Preis in den Korb, dann zur Auswahl. */
async function einGerichtImKorb(seite){
  return seite.evaluate(() => {
    for(const quelle of [SPEISEKARTE, GETRAENKE, COCKTAILS])
      for(const gr of quelle)
        for(const e of gr.eintraege)
          if(preisNum(e.p) > 0){
            merk = { [e.n]: { n:e.n, p:e.p, b:e.b || "", m:1 } };
            merkSpeichern();
            location.hash = "#/auswahl";
            return { name:e.n, preis:preisNum(e.p) };
          }
    return null;
  });
}

(async () => {
  const hubs = erzeugteHubs();
  if(!hubs.length){ console.log("Kein erzeugter Hub in dist/."); process.exit(1); }
  const browser = await chromium.launch();

  /* ── 0 · Quelltext: kein „Sofort bestellen“ mehr ── */
  console.log("\n── Quelltext ──");
  {
    const v = fs.readFileSync(path.join(HIER, "vorlagen", "hub.vorlage.html"), "utf8");
    pruef(!/t\("Sofort bestellen"\)/.test(v), "Top-Runner-Knopf kündigt keinen Kauf an");
    pruef(/data-aktionmerk[\s\S]{0,400}t\("In den Warenkorb"\)/.test(v), "er heißt „In den Warenkorb“");
    pruef(!/t\("Bestellung abschicken"\)/.test(v), "kein alter Knopftext");
  }

  for(const slug of hubs){
    const datei = "file://" + path.join(HIER, "dist", slug, "index.html");
    for(const breite of [360, 430]){
      console.log("\n── " + slug + " · " + breite + " px ──");
      const { ctx, seite, fehlerSeite } = await oeffnen(browser, datei, breite);
      const taugt = await seite.evaluate(() => BESTELLUNG.an && serverBereit());
      if(!taugt){ console.log("  (Bestellung aus oder kein Server — nichts zu prüfen)"); await ctx.close(); continue; }

      /* 1 · Unter der Karte */
      await seite.evaluate(() => { location.hash = "#/speisekarte"; });
      await seite.waitForTimeout(400);
      const note = await seite.$eval(".preisnote", el => ({ t:el.textContent, h:el.getBoundingClientRect().height }))
        .catch(() => null);
      pruef(!!note && /inkl\. MwSt\./.test(note.t) && note.h > 0, "Karte: „inkl. MwSt.“ sichtbar", note && note.t);
      const kn = await seite.evaluate(KONTRAST + '(".preisnote")');
      pruef(kn != null && kn >= 4.5, "Karte: Preisnote lesbar", kn && kn.toFixed(2) + ":1");

      /* 2 · Am Tisch */
      const g = await einGerichtImKorb(seite);
      pruef(!!g, "Voraussetzung: Gericht mit Preis im Korb", g && g.name);
      await seite.waitForTimeout(400);
      const r = await seite.evaluate(() => {
        const k = document.querySelector('[data-aktion="bestellen"]');
        const z = document.getElementById("zahlteil");
        return { knopf: k ? k.textContent.trim() : null,
                 direkt: !!(k && z && k.previousElementSibling === z),
                 zahl: z ? z.textContent : "" };
      });
      pruef(r.knopf !== null, "Voraussetzung: Bestellteil steht da");
      pruef(r.knopf === "Zahlungspflichtig bestellen", "Knopf „Zahlungspflichtig bestellen“", r.knopf);
      pruef(r.direkt, "Zahlteil steht unmittelbar vor dem Knopf");
      const betrag = await seite.evaluate(p => preisText(p), g ? g.preis : 0);
      pruef(r.zahl.indexOf(betrag) >= 0 && /inkl\. MwSt\./.test(r.zahl), "Zahlteil: Betrag und „inkl. MwSt.“", r.zahl);
      pruef(!/Widerrufsrecht/.test(r.zahl), "am Tisch kein Widerrufssatz");
      for(const sel of [".zahlzeile span", ".zahlhinweis"]){
        const k = await seite.evaluate(KONTRAST + '(' + JSON.stringify(sel) + ')');
        pruef(k != null && k >= 4.5, "lesbar: " + sel, k && k.toFixed(2) + ":1");
      }
      const box = await seite.$eval('[data-aktion="bestellen"]', el => el.getBoundingClientRect());
      pruef(box.height >= 44, "Knopf ≥ 44 px", box.height);
      const ueber = await seite.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      pruef(ueber <= 1, "kein seitlicher Überlauf", ueber + " px");

      /* 3 · Liefermodus mit Gebühr; „+“ zieht alles nach */
      await seite.evaluate(() => {
        LIEFER.an = true; LIEFER.gebuehr = 2.5; LIEFER.gratis_ab = 0; LIEFER.mindest = 0;
        liefermodus = true;
        location.hash = "#/speisekarte";
      });
      await seite.waitForTimeout(400);
      const noteL = await seite.$eval(".preisnote", el => el.textContent).catch(() => "");
      pruef(/zzgl\. Liefergebühr 2,50/.test(noteL), "Karte im Liefermodus: Liefergebühr genannt", noteL);
      await seite.evaluate(() => { location.hash = "#/auswahl"; });
      await seite.waitForTimeout(400);
      const vorher = await seite.$eval("#zahlteil", el => el.textContent).catch(() => "");
      pruef(/inkl\. Liefergebühr 2,50/.test(vorher), "Zahlteil: Liefergebühr", vorher);
      pruef(/Widerrufsrecht besteht nicht/.test(vorher), "Zahlteil: kein Widerrufsrecht, gesagt");
      const plus = await seite.$('[data-menge][data-dir="1"]');
      pruef(!!plus, "Voraussetzung: „+“ im Korb");
      if(plus) await plus.click();
      await seite.waitForTimeout(300);
      const erwartet = await seite.evaluate(p => preisText(2 * p + 2.5), g ? g.preis : 0);
      const nachher = await seite.evaluate(() => ({
        zahl: (document.getElementById("zahlteil") || {}).textContent || "",
        liefer: (document.getElementById("liefersumme") || {}).textContent || "" }));
      pruef(nachher.zahl.indexOf(erwartet) >= 0, "nach „+“: Zahlteil zeigt den neuen Betrag", erwartet + " in „" + nachher.zahl.slice(0, 40) + "“");
      pruef(nachher.liefer.indexOf(erwartet) >= 0, "nach „+“: „Zu zahlen“ im Korb zieht mit", nachher.liefer);

      /* 4 · Mindestwert kippt beim Tippen */
      await seite.evaluate(p => {
        LIEFER.mindest = p * 3 - 0.01;
        merk[Object.keys(merk)[0]].m = 1; merkSpeichern();
        $("inhalt").innerHTML = SEITEN.auswahl();
      }, g ? g.preis : 0);
      await seite.waitForTimeout(200);
      const zu = await seite.$eval('[data-aktion="bestellen"]', el => el.disabled);
      pruef(zu === true, "Voraussetzung: unter dem Mindestwert gesperrt");
      for(let i = 0; i < 2; i++){
        const p = await seite.$('[data-menge][data-dir="1"]'); if(p) await p.click();
        await seite.waitForTimeout(250);
      }
      const offen = await seite.$eval('[data-aktion="bestellen"]', el => el.disabled).catch(() => null);
      pruef(offen === false, "über den Mindestwert getippt → Knopf frei");
      pruef(fehlerSeite.length === 0, "kein Fehler auf der Seite", fehlerSeite.join(" | "));
      await ctx.close();
    }
  }

  /* ── 5 · Englisch ── */
  console.log("\n── Englisch ──");
  {
    const slug = hubs.find(s => s !== "nordstern") || hubs[0];
    const { ctx, seite } = await oeffnen(browser, "file://" + path.join(HIER, "dist", slug, "index.html"), 390, "en");
    await einGerichtImKorb(seite);
    await seite.waitForTimeout(400);
    const k = await seite.$eval('[data-aktion="bestellen"]', el => el.textContent.trim()).catch(() => null);
    pruef(k === "Order with obligation to pay", "Knopf übersetzt", k);
    const z = await seite.$eval("#zahlteil", el => el.textContent).catch(() => "");
    pruef(/incl\. VAT/.test(z), "Zahlteil übersetzt", z);
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
