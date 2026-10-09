/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Altersfreigabe je Gericht (Wunsch 07.10.)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-altersfreigabe.js   (braucht dist/)

   gerichte.ab_alter (16, 18 oder null — CHECK in
   datenbank/migration-altersfreigabe.sql) läuft durch drei Seiten:

   Board  · Segment „Keine · 16+ · 18+“ unter „Mehr Angaben“; aus dem
            Namen erkannter Alkohol wird VORGESCHLAGEN, nie gesetzt;
            die Erkennung läuft gegen die echten Getränkenamen aus der
            Datenbank (§6.1) und trifft dort nichts Falsches; Speichern,
            Wiederöffnen, Entwurf, Wert gegen die Schranke.
   Hub    · Plakette „18+“/„16+“ in Liste und Detail, ein unbekannter
            Wert (21) fällt still weg; die Frage kommt EINMAL je Stufe
            und Sitzung, auch über einen zweiten Weg in den Korb;
            „Wieder herausnehmen“ nimmt nur, was die Stufe braucht; der
            Schirm wird entfernt, nicht versteckt (§8.1); Englisch;
            lesbar; ruhige Bewegung.
   Küche  · „Ausweis 18+“ an genau der Position, auch mit Zusatz in
            Klammern; fehlt die Spalte (400), laufen die Spuren weiter.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN  = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const KUECHE = path.join(OBEN, "seiten", "kueche.html");
const HUB   = slug => path.join(OBEN, "dist", slug, "index.html");
const MIGR  = fs.readFileSync(path.join(OBEN, "datenbank", "migration-altersfreigabe.sql"), "utf8");
const BID = "af095b14-d9ef-41f4-9b97-c4422b0de63f";

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

/* Echte Getränke- und Cocktailnamen aus gerichte (07.10.) — keins davon
   enthält Alkohol. Chocos „Cocktails“ sind Milch- und Fruchtgetränke. */
const ECHTE_GETRAENKE = ["Ananassaft | Frisch gepresst", "Arabischer Kaiser | Kaiser · 0,5 l", "Avocado Love | Cocktails",
  "Bananelade Cocktail | Cocktails", "Bananenmilch Cocktail | Cocktails", "Choco Kaiser | Kaiser · 0,5 l",
  "Coca Cola | Softdrinks", "Coca Cola Zero | Softdrinks", "Durstlöscher | Softdrinks", "Erdbeer-Banane Cocktail | Cocktails",
  "Erdbeersaft lecker | Frisch gepresst", "Fanta | Softdrinks", "Frisch gepresster Orangensaft | Frisch gepresst",
  "Früchte Kaiser | Kaiser · 0,5 l", "Heart Attack | Cocktails", "Kiwi Zitrone | Frisch gepresst", "Mangosaft | Frisch gepresst",
  "Polo | Frisch gepresst", "Red Bull | Softdrinks", "Sprite | Softdrinks", "Strawberry Iced Matcha Latte | Iced Matcha Latte",
  "Wasser | Softdrinks", "Wassermelonensaft | Frisch gepresst", "Oriental Margherita Pizza | Herzhaft · Manakish",
  "Family Love | Für die Runde", "Kids Dream | Für die Runde", "Extra arabische Sahne | Für die Runde"];
const ERKENNUNG = [["Gin Tonic", 18], ["Ginger Ale", 0], ["Rumpsteak", 0], ["Rum Cola", 18], ["Rotwein", 16],
  ["Weizenbier", 16], ["Bierteig-Fisch", 0], ["Salat mit Weinessig", 0], ["Aperol Spritz", 16], ["Espresso Shot", 0],
  ["Tequila Shot", 18], ["Virgin Mojito", 0], ["Pils 0,0 %", 0], ["Vollkornbrot", 0], ["Eierlikör", 18], ["Bratwurst in Biersoße", 0]];

(async () => {
  if (!fs.existsSync(HUB("chocolamour"))) { console.log("Kein dist/ — erst node erzeuger/erzeuge-hub.js --alle"); process.exit(1); }
  const browser = await chromium.launch();

  /* ══ Board ══ */
  console.log("\n══ Board: Altersfreigabe im Gericht-Blatt ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 860 } });
    const s = await ctx.newPage(); const kons = [];
    s.on("pageerror", e => kons.push(String(e).slice(0, 300)));
    await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await s.goto("file://" + ADMIN); await s.waitForTimeout(700);
    await s.evaluate(() => {
      try { Object.keys(localStorage).filter(k => k.startsWith("omoteno-entwurf-")).forEach(k => localStorage.removeItem(k)); } catch (e) {}
      document.getElementById("tor").hidden = true; demoStarten(); zeichneAlles();
      const sch = document.getElementById("scharf"); if (sch) sch.hidden = true;
      document.querySelector('[data-tafel="speisekarte"]').click();
    });
    await s.waitForTimeout(400);

    const erk = await s.evaluate(f => f.map(([t, soll]) => [t, soll, alkoholStufe(t)]), ERKENNUNG);
    const daneben = erk.filter(x => x[1] !== x[2]);
    pruef(!daneben.length, "Erkennung: 16 Fälle (Ginger Ale, Rumpsteak, Weinessig, Virgin …) richtig", daneben.map(x => x[0] + "=" + x[2]).join(", ") || "alle");
    const echt = await s.evaluate(l => l.filter(x => alkoholStufe(x.replace("|", " "))), ECHTE_GETRAENKE);
    pruef(!echt.length, "echte Getränke der Datenbank: kein falscher Vorschlag (§6.1)", echt.join(", ") || ECHTE_GETRAENKE.length + " Namen geprüft");

    await s.click("#neuesGericht"); await s.waitForTimeout(300);
    await s.click("#mehrAuf"); await s.waitForTimeout(350);
    let z = await s.evaluate(() => ({ wert: fAlterWert, an: document.querySelector('#fAlter [aria-checked="true"]').textContent }));
    pruef(z.wert === null && z.an === "Keine", "neues Gericht: „Keine“", JSON.stringify(z));
    const hoehen = await s.$$eval("#fAlter button", l => l.map(b => Math.round(b.getBoundingClientRect().height)));
    pruef(hoehen.every(h => h >= 44), "Segment ≥ 44 px", hoehen.join(","));

    await s.fill("#fName", "Gin Tonic"); await s.waitForTimeout(400);
    z = await s.evaluate(() => ({ wert: fAlterWert, chip: [...document.querySelectorAll("[data-vorschlag-extra]")].map(b => b.dataset.vorschlagExtra) }));
    pruef(z.chip.includes("18") && z.wert === null, "„Gin Tonic“: 18+ vorgeschlagen, nicht gesetzt", JSON.stringify(z));
    await s.click('[data-vorschlag-extra="18"]'); await s.waitForTimeout(150);
    z = await s.evaluate(() => ({ wert: fAlterWert, an: document.querySelector('#fAlter [aria-checked="true"]').textContent,
      chip: !!document.querySelector("[data-vorschlag-extra]"), satz: document.getElementById("mehrStand").textContent }));
    pruef(z.wert === 18 && z.an === "18+" && !z.chip && /ab 18/.test(z.satz), "Tipp setzt 18+, Vorschlag weg, Satz nennt es", JSON.stringify(z));

    await s.fill("#fName", "Bananenmilch Cocktail"); await s.evaluate(() => { document.getElementById("fKat").value = "Cocktails"; });
    await s.evaluate(() => { alterSetzen(null); gVorschlaegeZeichnen(); });
    pruef(!(await s.$("[data-vorschlag-extra]")), "„Bananenmilch Cocktail“ in „Cocktails“: kein Vorschlag");

    /* Entwurf übersteht Abbrechen */
    await s.fill("#fName", "Testbier vom Fass"); await s.click('[data-ab-alter="16"]'); await s.waitForTimeout(700);
    await s.click("#abbrechen"); await s.waitForTimeout(400);
    await s.click("#neuesGericht"); await s.waitForTimeout(400);
    pruef(await s.evaluate(() => fAlterWert) === 16, "Entwurf bringt 16+ zurück");
    await s.evaluate(() => document.getElementById("entwurfVerwerfen").click()); await s.waitForTimeout(200);

    /* Speichern, Wiederöffnen, zurücknehmen */
    await s.fill("#fName", "Testgin"); await s.fill("#fPreis", "7,50");
    await s.evaluate(() => { document.getElementById("fKat").value = katNamen(welcheKarte)[0]; katWertAktualisieren(); });
    await s.click("#mehrAuf").catch(() => {}); await s.waitForTimeout(200);
    await s.evaluate(() => alterSetzen(18));
    await s.click("#speichern"); await s.waitForTimeout(500);
    const g = await s.evaluate(() => { const g = gerichte.find(x => x.name === "Testgin"); return g && { id: g.id, ab: g.ab_alter }; });
    pruef(g && g.ab === 18, "gespeichert mit ab_alter 18", JSON.stringify(g));
    await s.evaluate(id => blattOeffnen(gerichte.find(x => x.id === id)), g.id); await s.waitForTimeout(300);
    pruef(await s.evaluate(() => fAlterWert === 18 && document.querySelector('#fAlter [aria-checked="true"]').textContent === "18+"), "Wiederöffnen zeigt 18+");
    await s.click("#mehrAuf"); await s.waitForTimeout(300);
    await s.click('[data-ab-alter=""]'); await s.click("#speichern"); await s.waitForTimeout(400);
    pruef(await s.evaluate(id => gerichte.find(x => x.id === id).ab_alter === null, g.id), "„Keine“ speichert null");

    /* Was in die Tabelle geht, gegen die Schranke der Migration */
    const erlaubt = (MIGR.match(/ab_alter in \(([^)]*)\)/) || [, ""])[1].split(",").map(x => +x.trim()).filter(Boolean);
    pruef(erlaubt.join() === "16,18", "zweite Quelle: Schranke erlaubt 16 und 18", erlaubt.join());
    const segWerte = await s.$$eval("#fAlter [data-ab-alter]", l => l.map(b => b.dataset.abAlter).filter(Boolean).map(Number));
    pruef(segWerte.join() === erlaubt.join(), "Board bietet genau die Werte der Schranke an", segWerte.join());
    const gesendet = await s.evaluate(async () => {
      const log = []; demo = false; betriebId = "b-probe";
      db = { from: tab => ({ insert: z => ({ select: () => ({ single: async () => { log.push(z); return { data: { ...z, id: "neu-1" }, error: null }; } }) }),
        update: z => ({ eq: async () => { log.push(z); return { error: null }; } }) }) };
      blattOeffnen(null); document.getElementById("fName").value = "Probe Wodka"; document.getElementById("fPreis").value = "6";
      document.getElementById("fKat").value = "Bar"; alterSetzen(18);
      await sichern(false);
      demo = true; db = null; return log;
    });
    pruef(gesendet.length === 1 && gesendet[0].ab_alter === 18, "Speichern schickt ab_alter = 18 an gerichte", JSON.stringify(gesendet.map(x => x.ab_alter)));
    pruef(!kons.length, "Board ohne Fehler", kons.join(" | "));
    await ctx.close();
  }

  /* ══ Hub ══ */
  const zeilen = [
    { id: "a1", karte: "speisekarte", kategorie: "Bar", name: "Prüf-Gin", beschreibung: "Probe", preis: 8, verfuegbar: true, kat_sort: 0, reihenfolge: 0, ab_alter: 18 },
    { id: "a2", karte: "speisekarte", kategorie: "Bar", name: "Prüf-Bier", beschreibung: "Probe", preis: 4, verfuegbar: true, kat_sort: 0, reihenfolge: 1, ab_alter: 16 },
    { id: "a3", karte: "speisekarte", kategorie: "Bar", name: "Prüf-Limo", beschreibung: "Probe", preis: 3, verfuegbar: true, kat_sort: 0, reihenfolge: 2, ab_alter: null },
    { id: "a4", karte: "speisekarte", kategorie: "Bar", name: "Prüf-Komisch", beschreibung: "Probe", preis: 3, verfuegbar: true, kat_sort: 0, reihenfolge: 3, ab_alter: 21 },
  ];
  for (const slug of ["chocolamour", "blend"]) {
    console.log("\n══ Hub " + slug + " ══");
    const auf = async (opt = {}) => {
      const ctx = opt.ctx || await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
      const s = await ctx.newPage(); const kons = [];
      s.on("pageerror", e => kons.push(String(e).slice(0, 300)));
      await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
      await s.route("**/rest/v1/betriebe**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: BID, bestell_pause: false, hub_texte: {} }]) }));
      await s.route("**/rest/v1/gerichte**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(zeilen) }));
      if (!opt.ctx) await s.addInitScript(() => { try { if (!sessionStorage.getItem("omoteno-probe")) { sessionStorage.setItem("omoteno-probe", "1"); localStorage.clear(); }
        sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
      await s.goto("file://" + HUB(slug) + "#/speisekarte"); await s.waitForTimeout(1500);
      return { ctx, s, kons };
    };
    const { ctx, s, kons } = await auf();
    const tags = await s.evaluate(() => Object.fromEntries(["Prüf-Gin", "Prüf-Bier", "Prüf-Limo", "Prüf-Komisch"].map(n => {
      const z = [...document.querySelectorAll(".gericht")].find(x => decodeURIComponent(x.querySelector(".ginfo").dataset.detail) === n);
      return [n, z ? ((z.querySelector(".tag.abalter") || {}).textContent || "") : "fehlt"]; })));
    pruef(tags["Prüf-Gin"] === "18+" && tags["Prüf-Bier"] === "16+" && tags["Prüf-Limo"] === "" && tags["Prüf-Komisch"] === "",
      "Liste: 18+ / 16+ / nichts / 21 fällt still weg", JSON.stringify(tags));
    const plus = n => s.evaluate(n => document.querySelector('.gplus[data-merk="' + encodeURIComponent(n) + '"]').click(), n);
    const frage = () => s.evaluate(() => { const el = document.getElementById("alterfrage");
      return el ? { titel: el.querySelector("h2").textContent, rolle: el.getAttribute("role"), fokus: document.activeElement && document.activeElement.hasAttribute("data-alter-ja") } : null; });

    await plus("Prüf-Limo"); await s.waitForTimeout(200);
    pruef(!(await frage()), "Limo: keine Frage");
    await plus("Prüf-Bier"); await s.waitForTimeout(250);
    let fr = await frage();
    pruef(fr && fr.titel === "Ab 16 Jahren" && fr.rolle === "alertdialog" && fr.fokus, "Bier: Frage „Ab 16 Jahren“, Fokus auf „Ja“", JSON.stringify(fr));
    await s.click("[data-alter-ja]"); await s.waitForTimeout(150);
    pruef(await s.evaluate(() => !document.getElementById("alterfrage") && !!merk["Prüf-Bier"] && sessionStorage.getItem("omoteno-alter") === "16"),
      "„Ja“: Schirm entfernt (nicht versteckt), Bier bleibt, Stufe gemerkt");
    await plus("Prüf-Gin"); await s.waitForTimeout(250);
    fr = await frage();
    pruef(fr && fr.titel === "Ab 18 Jahren", "Gin: neue Frage für die höhere Stufe", fr && fr.titel);
    await s.click("[data-alter-nein]"); await s.waitForTimeout(250);
    const nach = await s.evaluate(() => ({ gin: !!merk["Prüf-Gin"], bier: !!merk["Prüf-Bier"], limo: !!merk["Prüf-Limo"], frage: !!document.getElementById("alterfrage"),
      knopf: !!document.querySelector('.gplus[data-merk="' + encodeURIComponent("Prüf-Gin") + '"]') }));
    pruef(!nach.gin && nach.bier && nach.limo && !nach.frage && nach.knopf, "„Wieder herausnehmen“: nur der Gin geht, „+“ steht wieder da", JSON.stringify(nach));

    /* Zweiter Weg in den Korb: das Detailblatt */
    await s.evaluate(() => detailOeffnen("Prüf-Gin")); await s.waitForTimeout(400);
    const detTag = await s.evaluate(() => (document.querySelector("#warenkarte .tag.abalter") || {}).textContent || "");
    pruef(detTag === "18+", "Detailblatt trägt die Plakette", detTag);
    await s.evaluate(() => document.querySelector("#warenkarte [data-wmerk]").click()); await s.waitForTimeout(300);
    fr = await frage();
    pruef(fr && fr.titel === "Ab 18 Jahren", "auch über das Detailblatt kommt die Frage", fr && fr.titel);

    /* Lesbarkeit von Plakette und Frage */
    const kontrast = await s.evaluate(() => {
      const rgb = t => { const m = t.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
      const misch = (o, u) => ({ r: o.r * o.a + u.r * (1 - o.a), g: o.g * o.a + u.g * (1 - o.a), b: o.b * o.a + u.b * (1 - o.a), a: 1 });
      const lum = c => { const k = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * k(c.r) + .7152 * k(c.g) + .0722 * k(c.b); };
      const grund = el => { const e2 = []; for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.a > 0) e2.push(c); if (c.a >= 1) break; }
        let g = rgb(getComputedStyle(document.documentElement).backgroundColor); if (g.a < 1) g = { r: 255, g: 255, b: 255, a: 1 };
        for (let i = e2.length - 1; i >= 0; i--) g = misch(e2[i], g); return g; };
      const k = el => { const g = grund(el), t = misch(rgb(getComputedStyle(el).color), g); const a = lum(g), b = lum(t); return +((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(2); };
      const fr = document.getElementById("alterfrage");
      return { satz: k(fr.querySelector("p")), titel: k(fr.querySelector("h2")), marke: k(fr.querySelector(".altermarke")),
        liste: k(document.querySelector(".gericht .tag.abalter")) };
    });
    pruef(Object.values(kontrast).every(v => v >= 4.5), "lesbar ≥ 4,5:1 (Satz, Titel, Marke, Plakette)", JSON.stringify(kontrast));
    await s.click("[data-alter-ja]"); await s.waitForTimeout(150);

    /* Neu laden in derselben Sitzung: keine zweite Frage.
       Voraussetzung „dieselbe Sitzung“ wird selbst geprüft (§8.1g):
       Der kopflose Chromium verliert unter Last beim Neuladen einer
       file://-Seite gelegentlich das sessionStorage (gemessen 1 von 12,
       dann ss=null UND der Korb leer, weil das InitScript oben ohne
       Probe-Marke localStorage leert). Dann ist es eine NEUE Sitzung, und
       eine neue Frage wäre richtig — die Probe gilt nicht. Zustand neu
       herstellen und erneut laden, höchstens dreimal. */
    let sitzungHielt = false;
    for (let versuch = 0; versuch < 3 && !sitzungHielt; versuch++) {
      await s.reload(); await s.waitForTimeout(1500);
      sitzungHielt = await s.evaluate(() => sessionStorage.getItem("omoteno-alter") === "18");
      if (!sitzungHielt) {
        await s.evaluate(() => { location.hash = "#/speisekarte"; }); await s.waitForTimeout(400);
        await plus("Prüf-Gin"); await s.waitForTimeout(250);
        if (await frage()) { await s.click("[data-alter-ja]"); await s.waitForTimeout(150); }
      }
    }
    pruef(sitzungHielt, "Voraussetzung: die Sitzung übersteht das Neuladen (Umgebung)");
    await s.evaluate(() => { location.hash = "#/speisekarte"; }); await s.waitForTimeout(400);
    const g2 = await s.evaluate(() => { delete merk["Prüf-Gin"]; merkSpeichern(); zeichne(); return true; });
    await s.waitForTimeout(300);
    await plus("Prüf-Gin"); await s.waitForTimeout(250);
    pruef(g2 && !(await frage()), "nach Neuladen in derselben Sitzung: keine zweite Frage");
    pruef(!kons.length, "Hub ohne Fehler", kons.join(" | "));
    await ctx.close();

    /* Englisch und ruhige Bewegung, frische Sitzung */
    const r = await auf({ ruhig: true });
    await r.s.evaluate(() => spracheSetzen("en")); await r.s.waitForTimeout(400);
    await r.s.evaluate(n => document.querySelector('.gplus[data-merk="' + encodeURIComponent(n) + '"]').click(), "Prüf-Gin"); await r.s.waitForTimeout(250);
    const en = await r.s.evaluate(() => { const el = document.getElementById("alterfrage"); if (!el) return null;
      return { t: el.querySelector("h2").textContent, ja: el.querySelector("[data-alter-ja]").textContent, nein: el.querySelector("[data-alter-nein]").textContent,
        anim: getComputedStyle(el.querySelector(".alterkarte")).animationName }; });
    pruef(en && en.t === "Ages 18 and up" && en.ja === "I am 18 or older" && en.nein === "Remove again", "Englisch: Frage und Knöpfe übersetzt", JSON.stringify(en));
    pruef(en && en.anim === "none", "reduzierte Bewegung: kein Einflug", en && en.anim);
    await r.ctx.close();
  }

  /* ══ Küche ══ */
  for (const fall of ["mit Spalte", "Spalte fehlt (400)"]) {
    console.log("\n══ Küche: " + fall + " ══");
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage(); const kons = [];
    p.on("pageerror", e => kons.push(String(e).slice(0, 300)));
    const BET = "11111111-1111-4111-8111-111111111111";
    const bons = [{ id: "k1", betrieb_id: BET, quelle: "tisch", status: "neu", tisch: "4",
      positionen: [{ name: "Prüf-Gin (extra Limette)", menge: 2 }, { name: "Prüf-Limo", menge: 1 }, { name: "Prüf-Bier", menge: 1 }],
      notiz: null, zeitpunkt: new Date(Date.now() - 120000).toISOString(), kueche_fertig_um: null, theke_fertig_um: null, tagesnummer: 3 }];
    let mitAlterGefragt = false;
    await p.route("**/*", route => {
      const u = decodeURIComponent(route.request().url());
      if (u.startsWith("file://")) return route.continue();
      if (u.includes("/rest/v1/bestellungen")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bons) });
      if (u.includes("/rest/v1/betriebe")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: BET, name: "Prüfhaus", slug: "p" }]) });
      if (u.includes("/rest/v1/gerichte")) {
        if (u.includes("ab_alter")) { mitAlterGefragt = true;
          if (fall !== "mit Spalte") return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "42703", message: "column gerichte.ab_alter does not exist" }) }); }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([
          { name: "Prüf-Gin", karte: "getraenke", spur: "theke", ab_alter: 18 }, { name: "Prüf-Limo", karte: "getraenke", spur: "theke", ab_alter: null },
          { name: "Prüf-Bier", karte: "getraenke", spur: "theke", ab_alter: 16 }].map(z => fall === "mit Spalte" ? z : { name: z.name, karte: z.karte, spur: z.spur })) });
      }
      if (u.includes("/auth/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: { id: "u1" } }) });
      if (u.includes("/rest/v1/betrieb_mitglieder")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ betrieb_id: BET, nutzer_id: "u1", rolle: "inhaber" }]) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await p.addInitScript(() => { localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600 })); });
    await p.goto("file://" + KUECHE); await p.waitForTimeout(2000);
    const zeilenK = await p.evaluate(() => [...document.querySelectorAll('.bon[data-id="k1"] .posten li')].map(li => ({
      name: (li.querySelector(".name") || {}).firstChild ? li.querySelector(".name").firstChild.textContent : "", ausweis: (li.querySelector(".ausweis") || {}).textContent || "" })));
    /* Spur am gezeichneten Bon ablesen — das Küchenskript ist gekapselt. */
    const spur = await p.evaluate(() => [...document.querySelectorAll('.bon[data-id="k1"] .marke')].map(m => m.classList.contains("theke") ? "theke" : m.classList.contains("kueche") ? "kueche" : "").filter(Boolean).join(","));
    pruef(mitAlterGefragt, "Küche fragt ab_alter mit ab");
    pruef(zeilenK.length === 3 && spur === "theke", "Bon steht, alle drei an der Theke (Spuren aus der Karte gelesen)", zeilenK.length + " Zeilen, Marken: " + spur);
    if (fall === "mit Spalte") {
      const m = Object.fromEntries(zeilenK.map(z => [z.name, z.ausweis]));
      pruef(m["Prüf-Gin"] === "Ausweis 18+" && m["Prüf-Bier"] === "Ausweis 16+" && m["Prüf-Limo"] === "",
        "„Ausweis 18+“ am Gin (mit Zusatz), „16+“ am Bier, nichts an der Limo", JSON.stringify(m));
    } else {
      pruef(zeilenK.every(z => !z.ausweis), "ohne Spalte: keine Marke, kein Ausfall");
    }
    pruef(!kons.length, "Küche ohne Fehler", kons.join(" | "));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " Fehler von " + n : "Alles sauber. (" + n + " Proben)"));
  process.exit(f ? 1 : 0);
})();
