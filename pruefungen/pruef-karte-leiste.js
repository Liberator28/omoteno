/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Kategorien-Leiste in der Karte des Boards, die mitläuft

     NODE_PATH=$(npm root -g) node pruefungen/pruef-karte-leiste.js

   > Anlass (17.10.). „Man soll bei den Gerichten im Admin-Board wie
   > bei der Speisekarte die Kategorienanzeige haben, die automatisch
   > wechselt, je nachdem wo man ist.“

   Die Vorführkarte hat nur EINE Kategorie — die Probe bringt eine
   eigene Karte mit acht Kategorien mit, sonst gäbe es nichts, dem die
   Leiste folgen könnte (§8.1g C). Zweite Quelle für die Chips: die
   gezeichneten Kategorien in #karteListe.

   1 · Chips = gezeichnete Kategorien, Reihenfolge gleich, 44 px.
   2 · Gerollt: die Markierung folgt (aria-current), der aktive Chip
       steht im Bild der Leiste; oben wieder die erste.
   3 · Tipp springt: Kopf der Kategorie direkt unter der Leiste,
       Markierung genau dort. Nicht verdeckt (elementFromPoint, §3.9).
   4 · Suche: nur Kategorien mit Treffer; eine Kategorie → keine Leiste.
   5 · Neuzeichnen (▲/▼) behält die aktive Kategorie.
   6 · Lesbarkeit in dunkel/hell/schwarz/weiß, 360 und 1280 px.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const ADMIN = path.join(__dirname, "..", "seiten", "admin.html");
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };
const KATS = ["Frühstück","Bowls","Burger","Salate","Pasta","Desserts","Kuchen","Eis"];

async function board(browser, breite, licht){
  const ctx = await browser.newContext({ viewport:{ width:breite, height:844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(700);
  await p.evaluate(([kats, licht]) => {
    document.getElementById("tor").hidden = true; demoStarten();
    let i = 0;
    gerichte = [];
    kats.forEach((k, ki) => { for(let j = 0; j < 4; j++) gerichte.push({ id:"p" + (++i), betrieb_id:betriebId, karte:"speisekarte",
      kategorie:k, name:k + " " + (j + 1), beschreibung:"", preis:5 + j, verfuegbar:true, kat_sort:ki + 1, reihenfolge:j, kat_emoji:null }); });
    if(licht && typeof EINST !== "undefined"){ EINST.licht = licht; if(typeof lichtAnwenden === "function") lichtAnwenden(); }
    zeichneAlles();
    const s = document.getElementById("scharf"); if(s) s.hidden = true;
    tafelZeigen("speisekarte");
  }, [KATS, licht]);
  await p.waitForTimeout(500);
  return { ctx, p, fehler };
}
const stand = p => p.evaluate(() => {
  const l = document.getElementById("karteKatLeiste");
  const an = l.querySelector('[aria-current="true"]');
  const lr = l.getBoundingClientRect(), ar = an ? an.getBoundingClientRect() : null;
  return { an: an ? an.dataset.kl : null, imBild: ar ? ar.left >= lr.left - 1 && ar.right <= lr.right + 1 : false,
           zahlAn: l.querySelectorAll('[aria-current="true"]').length };
});

(async () => {
  const browser = await chromium.launch();
  console.log("══ 1 · Chips = gezeichnete Kategorien ══");
  let { ctx, p, fehler } = await board(browser, 390);
  const chips = await p.evaluate(() => ({
    chips: [...document.querySelectorAll("#karteKatLeiste .kl-chip")].map(c => c.dataset.kl),
    kats: [...document.querySelectorAll("#karteListe .kat[data-kat]")].map(k => k.dataset.kat),
    hoehen: [...document.querySelectorAll("#karteKatLeiste .kl-chip")].map(c => Math.round(c.getBoundingClientRect().height)),
    sichtbar: !document.getElementById("karteKatLeiste").hidden }));
  pruef(chips.kats.length === KATS.length, "Voraussetzung: acht Kategorien gezeichnet", chips.kats.join(","));
  pruef(chips.sichtbar && chips.chips.join() === chips.kats.join(), "jeder Chip eine gezeichnete Kategorie, gleiche Reihenfolge", chips.chips.join(","));
  pruef(chips.hoehen.every(h => h >= 44), "jeder Chip ≥ 44 px", chips.hoehen.join(","));
  let s = await stand(p);
  pruef(s.an === KATS[0] && s.zahlAn === 1, "oben: genau die erste markiert", JSON.stringify(s));

  console.log("══ 2 · Rollen von Hand: die Markierung folgt ══");
  for(const k of ["Salate", "Desserts", "Eis"]){
    await p.evaluate(k => { const el = document.querySelector('#karteListe .kat[data-kat="' + k + '"]');
      const l = document.getElementById("karteKatLeiste");
      scrollTo(0, el.getBoundingClientRect().top + scrollY - document.querySelector("header").offsetHeight - l.offsetHeight - 4); }, k);
    await p.waitForTimeout(500);
    s = await stand(p);
    pruef(s.an === k && s.imBild && s.zahlAn === 1, "gerollt bis „" + k + "“: markiert und im Bild der Leiste", JSON.stringify(s));
  }
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(400);
  s = await stand(p);
  pruef(s.an === KATS[0], "zurück oben: wieder die erste", s.an);

  console.log("══ 3 · Tipp springt ══");
  for(const k of ["Pasta", "Kuchen", "Bowls"]){
    await p.click('#karteKatLeiste .kl-chip[data-kl="' + k + '"]');
    await p.waitForTimeout(900);
    const r = await p.evaluate(k => {
      const kopf = document.querySelector('#karteListe .kat[data-kat="' + k + '"] .katkopf').getBoundingClientRect();
      const l = document.getElementById("karteKatLeiste").getBoundingClientRect();
      const e = document.elementFromPoint(kopf.left + 30, kopf.top + kopf.height / 2);
      const lc = document.querySelector('#karteKatLeiste [aria-current="true"]');
      const lcR = lc.getBoundingClientRect();
      const lt = document.elementFromPoint(lcR.left + lcR.width / 2, lcR.top + lcR.height / 2);
      return { kopf: Math.round(kopf.top), unterLeiste: Math.round(l.bottom), trifft: !!(e && e.closest(".katkopf")),
               chipFrei: !!(lt && lt.closest(".kl-chip") === lc), an: lc.dataset.kl };
    }, k);
    pruef(r.kopf >= r.unterLeiste && r.kopf <= r.unterLeiste + 30 && r.trifft, "Tipp auf „" + k + "“: Kopf direkt unter der Leiste, sichtbar", JSON.stringify(r));
    pruef(r.an === k && r.chipFrei, "„" + k + "“ markiert und nicht verdeckt", JSON.stringify(r));
  }

  console.log("══ 4 · Suche ══");
  await p.evaluate(() => scrollTo(0, 0));
  await p.fill("#karteSuche", "Burger");
  await p.waitForTimeout(300);
  let leer = await p.evaluate(() => ({ hidden: document.getElementById("karteKatLeiste").hidden,
    chips: document.querySelectorAll("#karteKatLeiste .kl-chip").length }));
  pruef(leer.hidden, "Suche mit Treffern in nur einer Kategorie: keine Leiste", JSON.stringify(leer));
  await p.fill("#karteSuche", " 1");
  await p.waitForTimeout(300);
  leer = await p.evaluate(() => [...document.querySelectorAll("#karteKatLeiste .kl-chip")].map(c => c.dataset.kl));
  pruef(leer.length === KATS.length, "Suche „1“: jede Kategorie hat einen Treffer → alle Chips", leer.length);
  await p.fill("#karteSuche", "");
  await p.waitForTimeout(300);

  console.log("══ 5 · Neuzeichnen behält die Stelle ══");
  await p.click('#karteKatLeiste .kl-chip[data-kl="Desserts"]');
  await p.waitForTimeout(900);
  await p.evaluate(() => zeichneKarte());
  await p.waitForTimeout(200);
  s = await stand(p);
  pruef(s.an === "Desserts", "nach zeichneKarte() bleibt „Desserts“ markiert", s.an);
  pruef(!fehler.length, "keine Seitenfehler", fehler.join(" | "));
  await ctx.close();

  console.log("══ 6 · Lesbarkeit und Breiten ══");
  const kontrast = (a, b) => { const L = c => { const [r, g, bb] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * r + .7152 * g + .0722 * bb; }; const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  for(const [breite, licht] of [[360, "dunkel"], [360, "hell"], [1280, "schwarz"], [1280, "weiss"]]){
    ({ ctx, p, fehler } = await board(browser, breite, licht));
    const farben = await p.evaluate(() => {
      const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const grund = el => { while(el){ const b = getComputedStyle(el).backgroundColor; if(!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return rgb(b); el = el.parentElement; } return [255,255,255]; };
      return [...document.querySelectorAll("#karteKatLeiste .kl-chip")].slice(0, 3).map(c => ({ s: rgb(getComputedStyle(c).color), g: grund(c) }));
    });
    const min = Math.min(...farben.map(x => kontrast(x.s, x.g)));
    const ueber = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    pruef(min >= 4.5 && ueber <= 0, breite + " px, " + licht + ": Schrift ≥ 4,5:1, kein Überlauf", min.toFixed(2) + " / " + ueber);
    await ctx.close();
  }
  await browser.close();
  console.log("\n" + (f ? f + " FEHLER" : "Alles grün.") + " (" + n + " Proben)");
  process.exit(f ? 1 : 0);
})();
