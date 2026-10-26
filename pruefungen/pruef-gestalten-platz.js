/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · „Gast-Hub gestalten“: Vorschau UND Einstellungen erreichbar

     NODE_PATH=$(npm root -g) node pruefungen/pruef-gestalten-platz.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   > Anlass (17.10.). „Die Hub-Ansicht versperrt die Einstellungen …
   > man soll beides gleich gut erreichen können.“ Gemessen vorher bei
   > 390×844: Vorschau offen 348 px von oben, mit „Größer“ 658 px —
   > für die Felder blieben 122 px. Eingeklappt wurde nicht gemerkt,
   > und nach einem Neuaufbau stand „Einklappen“ über einer
   > eingeklappten Vorschau.

   Gemessen wird FREIE FLÄCHE zwischen dem, was oben klebt, und der
   Leiste unten — nicht, ob eine Klasse gesetzt ist.

   1 · Telefon 390×844: Ruhelage eingeklappt mit lebender Mini-
       Vorschau, ≥ 70 % frei; ein Tipp auf die Mini öffnet, ≥ 40 % frei;
       „Größer“ höchstens die halbe Höhe; Stellung übersteht Neuladen.
   2 · Fokus in einem Textfeld klappt ein, das Feld steht ganz im
       freien Bereich; danach kommt die gemerkte Stellung zurück.
   3 · Jeder Sprung landet im freien Bereich (elementFromPoint).
   4 · Neuaufbau (Betriebswechsel): Knopf beschriftet nach Zustand.
   5 · Desktop 1280×800: Vorschau NEBEN den Einstellungen, keine
       Überschneidung, bleibt beim Rollen stehen, Sprung bis unter
       den Kopf.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const ADMIN = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");   /* ADMIN_DATEI: Gegenbeweis auf einer Kopie */
const HUB = path.join(OBEN, "dist", "blend", "index.html");
const BASIS = "https://omoteno.test/h/";

let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

async function oeffnen(browser, breite, hoehe, ctxAlt){
  const ctx = ctxAlt || await browser.newContext({ viewport:{ width:breite, height:hoehe } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript(b => { window.HUB_VORSCHAU_BASIS = b;
    Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; }, BASIS);
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(u === BASIS + "blend/") return r.fulfill({ status:200, contentType:"text/html; charset=utf-8",
      headers:{ "Access-Control-Allow-Origin":"*" }, body: fs.readFileSync(HUB, "utf8") });
    return r.fulfill({ status:200, contentType:"application/json", headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" });
  });
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(800);
  await p.evaluate(() => { document.getElementById("tor").hidden = true;
    if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); } });
  await p.waitForTimeout(300);
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(300); }
  await p.evaluate(() => tafelZeigen("startseite"));
  /* Seit 19.10. liegt jede Gruppe hinter einer Kachel; Kopf und Vorschau
     erscheinen erst in einer Unterseite. „Schrift“ ist die Vorgabe der Proben. */
  pruef(await gruppeZu(p, "#swGruppe"), "Voraussetzung: Unterseite „Schrift“ über ihre Kachel geöffnet");
  for(let i = 0; i < 40; i++){
    const ok = await p.evaluate(() => { const h = hvAlle().gestalten; return !!(h && h.bereit); });
    if(ok) break;
    await p.waitForTimeout(150);
  }
  await p.waitForTimeout(300);
  return { ctx, p, fehler };
}
/* Was oben klebt (Kopf + Vorschau, wenn sie oben steht) und was unten
   liegt (Befehlsleiste) — dazwischen ist Platz für die Felder. */
const platz = async p => { await p.evaluate(() => {
    /* Gemessen wird KLEBEND — mitten in den Einstellungen, nicht oben
       auf der Seite, wo die Vorschau noch im Fluss steht. */
    if(document.activeElement && document.activeElement.matches("input,textarea,select")) return;
    const g = document.querySelector("#t-startseite > .egruppe.eu-jetzt") || document.getElementById("swGruppe");
    scrollTo(0, g.getBoundingClientRect().top + scrollY - 100);
  }); await p.waitForTimeout(150); return p.evaluate(() => {
  const v = document.querySelector(".gh-vorschau"), kopf = document.querySelector("header");
  const leiste = document.querySelector(".befehlsleiste");
  const vr = v.getBoundingClientRect(), kr = kopf.getBoundingClientRect();
  const unten = leiste && getComputedStyle(leiste).display !== "none" ? leiste.getBoundingClientRect().top : innerHeight;
  const oben = Math.max(kr.bottom, vr.bottom);
  const fenster = v.querySelector(".hvfenster");
  return { oben, unten, frei: (unten - oben) / innerHeight, zu: v.classList.contains("zu"),
           vH: vr.height, mini: fenster ? fenster.getBoundingClientRect().width : 0,
           zuKnopf: (v.querySelector("[data-hv-zu]") || {}).textContent,
           zuPressed: (v.querySelector("[data-hv-zu]") || { getAttribute:()=>null }).getAttribute("aria-pressed") };
}); };

(async () => {
  if(!fs.existsSync(HUB)){ console.error("Kein erzeugter Hub. Erst: node erzeuger/erzeuge-hub.js --alle"); process.exit(1); }
  const browser = await chromium.launch();

  console.log("══ 1 · Telefon 390×844 ══");
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  let { p, fehler } = await oeffnen(browser, 390, 844, ctx);
  let m = await platz(p);
  pruef(m.zu, "Ruhelage ohne gemerkte Wahl: eingeklappt", JSON.stringify(m));
  pruef(m.frei >= 0.7, "eingeklappt ≥ 70 % frei für die Einstellungen", Math.round(m.frei * 100) + " %");
  pruef(m.mini >= 40, "die Mini-Vorschau ist sichtbar (dasselbe iframe, klein)", Math.round(m.mini) + " px breit");
  pruef(m.zuKnopf === "Vorschau zeigen" && m.zuPressed === "true", "Knopf sagt, was er tut", m.zuKnopf + " / " + m.zuPressed);
  await p.click(".gh-vorschau .gh-mini");
  await p.waitForTimeout(250);
  m = await platz(p);
  pruef(!m.zu, "ein Tipp auf die Mini öffnet die Vorschau");
  pruef(m.frei >= 0.4, "geöffnet ≥ 40 % frei", Math.round(m.frei * 100) + " %");
  /* Luft unter dem Gezeigten (Meldung 25.10.: „zu wenig Abstand zwischen den oberen Blöcken“): Die Vorschau klebt, die Blöcke rollen
     unter ihrem Rand durch — sichtbar ist als Abstand, was zwischen letzter Zeile der Vorschau und ihrem Rand liegt. */
  const luft = await p.evaluate(() => { const v = document.querySelector(".gh-vorschau"), s = v.querySelector(".hvstand");
    if(!s || !s.getClientRects().length) return null; return Math.round(v.getBoundingClientRect().bottom - s.getBoundingClientRect().bottom); });
  pruef(luft !== null && luft >= 14, "geöffnet: mindestens 14 px Luft zwischen der letzten Zeile der Vorschau und ihrem unteren Rand", String(luft));
  await p.click(".gh-vorschau [data-hv-gross]");
  await p.waitForTimeout(250);
  m = await platz(p);
  const fensterH = await p.evaluate(() => document.querySelector(".gh-vorschau .hvfenster").getBoundingClientRect().height);
  pruef(fensterH <= 844 * 0.5 + 1, "„Größer“ nimmt höchstens die halbe Höhe", Math.round(fensterH) + " px");
  pruef(m.frei >= 0.2, "auch mit „Größer“ bleibt Platz für Felder", Math.round(m.frei * 100) + " %");

  /* Neuladen: die Stellung bleibt (offen + groß). */
  await p.close();
  ({ p, fehler } = await oeffnen(browser, 390, 844, ctx));
  m = await platz(p);
  const gross = await p.evaluate(() => document.querySelector(".gh-vorschau").classList.contains("gross"));
  pruef(!m.zu && gross, "Neuladen: offen und groß wie gemerkt", JSON.stringify({ zu:m.zu, gross }));
  await p.click(".gh-vorschau [data-hv-gross]");
  await p.waitForTimeout(200);

  console.log("══ 2 · Fokus in einem Feld ══");
  pruef(await gruppeZu(p, "#gh-worte"), "Voraussetzung: Unterseite „Ihre Worte“ über ihre Kachel geöffnet");
  await p.waitForTimeout(200);
  await p.focus("#hubClaim");
  await p.waitForTimeout(400);
  m = await platz(p);
  const feld = await p.evaluate(() => { const r = document.getElementById("hubClaim").getBoundingClientRect(); return { top:r.top, bottom:r.bottom }; });
  pruef(m.zu, "Fokus im Textfeld: Vorschau klappt auf die Leiste", JSON.stringify(m));
  pruef(feld.top >= m.oben - 1 && feld.bottom <= m.unten + 1, "das Feld steht ganz im freien Bereich",
    JSON.stringify({ feld, oben:m.oben, unten:m.unten }));
  await p.fill("#hubClaim", "Frisch und warm");
  await p.focus("#hubGruss");
  await p.waitForTimeout(300);
  pruef((await platz(p)).zu, "Wechsel in ein zweites Feld: bleibt eingeklappt");
  await p.evaluate(() => document.activeElement.blur());
  await p.waitForTimeout(400);
  m = await platz(p);
  pruef(!m.zu, "Fokus weg: gemerkte Stellung (offen) kommt zurück");
  const gemerkt = await p.evaluate(() => localStorage.getItem("omoteno-gh-vorschau"));
  pruef(gemerkt && JSON.parse(gemerkt).zu === false, "das automatische Einklappen wurde nicht als Wahl gemerkt", gemerkt);

  console.log("══ 3 · Jeder Sprung landet im freien Bereich ══");
  const ziele = await p.evaluate(() => [...document.querySelectorAll("[data-gh-sprung]")].map(a => a.dataset.ghSprung));
  const gruppenZahl = await p.evaluate(() => document.querySelectorAll("#t-startseite > .egruppe:not(.eu-uebersicht)").length);
  pruef(ziele.length === gruppenZahl && ziele.length >= 9, "Symbolleiste gelesen: ein Eintrag je Gruppe (zweite Quelle: die Gruppen)", ziele.length + " / " + gruppenZahl);
  for(const z of ziele){
    await p.evaluate(() => scrollTo(0, 0));
    await p.click('[data-gh-sprung="' + z + '"]');
    await p.waitForTimeout(500);
    const r = await p.evaluate(z => {
      const g = document.getElementById(z), t = g.querySelector("h2,h3,.etitel") || g;
      const tr = t.getBoundingClientRect();
      const v = document.querySelector(".gh-vorschau").getBoundingClientRect(), k = document.querySelector("header").getBoundingClientRect();
      const oben = Math.max(v.bottom, k.bottom);
      const x = tr.left + Math.min(20, tr.width / 2), y = tr.top + Math.min(8, tr.height / 2);
      const e = document.elementFromPoint(x, y);
      return { top: Math.round(tr.top), oben: Math.round(oben), trifft: !!(e && g.contains(e)) };
    }, z);
    pruef(r.top >= r.oben - 2 && r.trifft, "Wechsel zu " + z + ": Titel steht frei unter Kopf und Vorschau und wird getroffen", JSON.stringify(r));
    /* Luft zwischen Vorschau und erstem Block (Meldung 25.10.: „zu wenig Abstand zwischen den oberen Blöcken“): mindestens 12 px, nicht nur „nicht darunter“. */
    pruef(r.top - r.oben >= 12, "… mit mindestens 12 px Luft unter der Vorschau (" + z + ")", (r.top - r.oben) + " px");
  }

  console.log("══ 4 · Neuaufbau beschriftet nach Zustand ══");
  await p.click(".gh-vorschau [data-hv-zu]");
  await p.waitForTimeout(200);
  await p.evaluate(() => { const a = hvAlle(); delete a.gestalten; delete a.startseite; delete a.farben; delete a.worte; hvStart("gestalten"); });
  await p.waitForTimeout(300);
  m = await platz(p);
  pruef(m.zu && m.zuKnopf === "Vorschau zeigen" && m.zuPressed === "true", "nach dem Neuaufbau stimmt die Beschriftung",
    JSON.stringify({ zu:m.zu, knopf:m.zuKnopf, pressed:m.zuPressed }));
  pruef(!fehler.length, "keine Seitenfehler (Telefon)", fehler.join(" | "));
  await ctx.close();

  console.log("══ 5 · Desktop 1280×800: nebeneinander ══");
  ({ p, fehler } = await oeffnen(browser, 1280, 800));
  pruef(await gruppeZu(p, "#kfGruppe"), "Voraussetzung: Unterseite „Kopf & Logo“ über ihre Kachel geöffnet");
  const d = await p.evaluate(() => {
    const v = document.querySelector(".gh-vorschau").getBoundingClientRect(), g = document.getElementById("kfGruppe").getBoundingClientRect();
    const k = document.getElementById("t-startseite").querySelector(".gh-kopf").getBoundingClientRect();
    const ueber = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    return { v:[v.left, v.top, v.right, v.bottom].map(Math.round), g:[g.left, g.right].map(Math.round),
             neben: v.left >= g.right, ueberG: ueber(v, g), ueberK: ueber(v, k), zu: document.querySelector(".gh-vorschau").classList.contains("zu"),
             fenster: Math.round(document.querySelector(".gh-vorschau .hvfenster").getBoundingClientRect().height) };
  });
  pruef(!d.zu, "Desktop ohne gemerkte Wahl: Vorschau offen", JSON.stringify(d));
  pruef(d.neben && !d.ueberG && !d.ueberK, "Vorschau rechts neben den Einstellungen, keine Überschneidung", JSON.stringify(d));
  pruef(d.v[3] <= 800 + 1 && d.fenster >= 400, "die Vorschau passt in die Höhe und ist groß", d.fenster + " px");
  await p.evaluate(() => scrollTo(0, 2400));
  await p.waitForTimeout(300);
  const steht = await p.evaluate(() => { const r = document.querySelector(".gh-vorschau").getBoundingClientRect(); return { top:Math.round(r.top), h:Math.round(r.height) }; });
  pruef(steht.top >= 0 && steht.top < 200, "beim Rollen bleibt sie stehen", JSON.stringify(steht));
  await p.evaluate(() => scrollTo(0, 0));
  await p.click('[data-gh-sprung="fbGruppe"]');
  await p.waitForTimeout(500);
  const sp = await p.evaluate(() => ({ top: Math.round(document.querySelector("#fbGruppe h2.etitel").getBoundingClientRect().top),
                                       kopf: Math.round(document.querySelector("header").getBoundingClientRect().bottom) }));
  pruef(sp.top >= sp.kopf && sp.top <= sp.kopf + 220, "Wechsel am Desktop: die Unterseite beginnt gleich unter dem Kopf und der Symbolleiste (die Vorschau steht daneben)", JSON.stringify(sp));
  pruef(!fehler.length, "keine Seitenfehler (Desktop)", fehler.join(" | "));

  await browser.close();
  console.log("\n" + (f ? f + " FEHLER" : "Alles grün.") + " (" + n + " Proben)");
  process.exit(f ? 1 : 0);
})();
