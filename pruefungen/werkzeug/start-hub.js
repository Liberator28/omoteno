/* ═══════════════════════════════════════════════════════════════
   werkzeug/start-hub.js — öffnet einen erzeugten Hub mit nachgestellten Live-Daten

   Für die Startseite (pruef-start-premium.js und die Gestaltung): Kopfbild, Kachel-Foto, Gerichte mit Foto und ein
   gefüllter Korb — also alles, was die Premium-Startseite mit Bildern zeigt. Die Bilder sind NEUTRALE Testbilder
   (werkzeug/testbilder/, Verläufe und Kreise): „hell“ und „dunkel“ stehen für die beiden Fälle, an denen Schrift auf
   einem Foto scheitert (§5.1/§5.2). Kein Foto eines Kunden, nichts wird ausgeliefert.

   Uhr UND Öffnungszeiten legt dieses Werkzeug fest (§8.1j) — eine Prüfung, die nur zur Mittagszeit grün ist, prüft die Uhr.
   ═══════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..", "..");
const DIST = path.join(OBEN, "dist");
const BILDER = path.join(__dirname, "testbilder");
const PROJEKT = "https://quxwweuvdqtjsdwgjdrh.supabase.co";
const EIMER = PROJEKT + "/storage/v1/object/public/gerichte/";
const BETRIEB = "11111111-2222-3333-4444-555555555555";

const lies = n => fs.readFileSync(path.join(BILDER, n));
const BILD = { "kopf-hell": lies("kopf-hell.jpg"), "kopf-dunkel": lies("kopf-dunkel.jpg"), karte: lies("karte.jpg"),
  "gericht-weiss": lies("gericht-weiss.jpg"), gericht: lies("gericht.jpg") };

/* Drei Gerichte mit Foto, eines ohne: genug für Korb, Karte und „Ohne Foto“. */
function gerichteZeilen(bildName){
  const z = (id, name, kat, preis, bild, o) => Object.assign({ id, betrieb_id: "b1", name, kategorie: kat, karte: "speisekarte", karten: ["speisekarte"],
    preis, beschreibung: "Frisch gemacht.", allergene: "", verfuegbar: true, veg: false, vegan: false, reihenfolge: 0, kat_sort: 1,
    kat_emoji: null, bild: bild ? EIMER + BETRIEB + "/" + bild : "", bild_frei: null }, o);
  return [
    z("g1", "Banane Erdbeere", "Süßes", 10.9, bildName + ".jpg", { reihenfolge: 0 }),
    z("g2", "Waffel Classic", "Süßes", 8.5, bildName + ".jpg", { reihenfolge: 1 }),
    z("g3", "Cola", "Getränke", 3.2, "", { kat_sort: 2 })
  ];
}

/* opt: haus, breite, hoehe, kopf ("hell" | "dunkel" | null), kachelFoto (bool), gerichtFoto ("gericht" | "gericht-weiss"),
        uhr, sprache, farbe ("hell" | "dunkel" für die Wahl des Gastes), stil ("premium" erzwingen, auch bei Häusern ohne
        Schalter), layout (Objekt wie markenblatt.startlayout, null = ohne), korb ([Gerichtname, …]), hash, reduziert, skala,
        vorschau (true: wie im Board-Rahmen, vorschauSetzen() nimmt Entwürfe), optionen (Objekt wie betriebe.optionen: Gruppen für Extras/Beilagen), bloecke (Liste wie betriebe.hub_bloecke, null = ohne Aufbau), dist (anderer dist-Ordner, auch HUB_DIST), zeilen (Funktion: ändert die nachgestellten Gerichtzeilen — Preis, Allergene, Merkmale), gerichteFehler (true: die
        Datenbank antwortet 500) */
async function oeffneHub(browser, opt){
  opt = opt || {};
  const haus = opt.haus || "chocolamour";
  const ctx = await browser.newContext({
    viewport: { width: opt.breite || 390, height: opt.hoehe || 844 }, deviceScaleFactor: opt.skala || 1,
    reducedMotion: opt.reduziert ? "reduce" : "no-preference"
  });
  const p = await ctx.newPage();
  const fehler = [], anfragen = [], konsole = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
  p.on("console", m => { if(m.type() === "error" && !/Failed to load resource/.test(m.text())) konsole.push(m.text().slice(0, 160)); });
  await p.clock.setFixedTime(new Date(opt.uhr || "2026-10-10T14:00:00"));
  await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
  if(opt.vorschau) await p.addInitScript(() => { window.OMOTENO_VORSCHAU = true; });
  if(opt.sprache) await p.addInitScript(s => { try{ localStorage.setItem("tapto-sprache", s); }catch(e){} }, opt.sprache);
  if(opt.farbe) await p.addInitScript(f => { try{ localStorage.setItem("omoteno-licht", f); localStorage.setItem("tapto-licht", f); }catch(e){} }, opt.farbe);

  const bildName = opt.gerichtFoto || "gericht";
  const stil = {};
  if(opt.kopf) stil.kopf = { bild: EIMER + BETRIEB + "/kopf/bild-1.jpg" };
  const kacheln = opt.kachelFoto ? [{ schluessel: "speisekarte", titel: "Unsere Speisekarte", banner: EIMER + BETRIEB + "/kacheln/speisekarte-1.jpg", breite: "voll", iconAus: true, bildform: "flaeche" }] : null;

  await p.route("**/*", r => {
    const u = r.request().url();
    anfragen.push(u);
    if(u.startsWith("file://")) return r.continue();
    if(u.indexOf(EIMER) === 0){
      const n = /\/kopf\//.test(u) ? ("kopf-" + (opt.kopf || "hell")) : /\/kacheln\//.test(u) ? "karte" : bildName;
      return r.fulfill({ status: 200, contentType: "image/jpeg", body: BILD[n] || BILD.gericht });
    }
    if(/\/rest\/v1\/betriebe\?/.test(u)) return r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify([{ id: "b1", bestell_pause: false, hub_texte: {}, hub_stil: stil, hub_kacheln: kacheln, hub_bloecke: opt.bloecke || null, optionen: opt.optionen || null, hub_banner: null, hub_avatar: null,
        karten: null, liefer: opt.liefer || null }]) });
    if(/\/rest\/v1\/gerichte\?/.test(u)){
      if(opt.gerichteFehler) return r.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' });
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(opt.zeilen ? opt.zeilen(gerichteZeilen(bildName)) : gerichteZeilen(bildName)) });
    }
    return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await p.goto("file://" + path.join(opt.dist || process.env.HUB_DIST || DIST, haus, "index.html") + (opt.hash || "#/"));
  await p.waitForTimeout(1200);
  /* Öffnungszeiten selbst festlegen (der Hub liest sie aus dem Markenblatt). */
  await p.evaluate(() => { try{ ZEITEN.length = 0; for(let i = 0; i < 7; i++) ZEITEN.push("10:30 – 00:30"); stunde = new Date().getHours(); }catch(e){} });
  if(opt.stil === "premium") await p.evaluate(() => { MARKENBLATT.startstil = "premium"; startstilSetzen(); zeichne(); });
  if(opt.stil === "klassisch") await p.evaluate(() => { MARKENBLATT.startstil = "klassisch"; startstilSetzen(); zeichne(); });
  /* layout: das Markenblatt-Feld startlayout (Objekt) wie der Erzeuger es schriebe; null = ohne. Funktioniert nur mit Premium. */
  if(opt.layout !== undefined) await p.evaluate(l => { MARKENBLATT.startlayout = l === null ? undefined : l; startlayoutSetzen(); zeichne(); hauptNavZeichnen(); }, opt.layout);
  if(opt.korb && opt.korb.length){
    await p.evaluate(namen => {
      namen.forEach(n => { const g = findeGericht(n); if(g) merk[n] = { n: g.n, p: g.p, b: g.b || "", m: 1 }; });
      merkSpeichern(); zeichne();
    }, opt.korb);
  }
  await p.waitForTimeout(500);
  return { ctx, p, fehler, konsole, anfragen };
}

module.exports = { oeffneHub, BILD, EIMER, BETRIEB, DIST, OBEN };
