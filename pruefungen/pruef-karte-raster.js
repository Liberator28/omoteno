/* ═══════════════════════════════════════════════════════════════
   pruef-karte-raster.js — Die Karte als Foto-Kacheln (Wunsch 20.10., Vorlage „Gerichte“)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-karte-raster.js

   Gebaut ist: Kacheln je Kategorie mit Foto, Panel links mit Zählern (ab 900 px), Häkchen zum
   Auswählen, ⋯-Menü (Bearbeiten, Verschieben, Foto ansehen), gestrichelte Kachel „Neues Gericht in …“,
   Umschalter Kacheln/Liste, Filter, und Verschieben in eine andere Kategorie (oder Karte).

   Was schiefgehen kann, und je eine Probe dazu:
   1 · Struktur: eine Kachel je Gericht, ein Abschnitt je Kategorie, die gestrichelte Kachel zuerst,
       Panel mit Zählern nur breit, Filter/Suche/Panel zeigen genau das Richtige, die Liste bleibt da.
   2 · Das Foto: nur https ohne Sonderzeichen kommt in ein src (ein Anführungszeichen öffnet kein
       Attribut), die kleine Fassung wo es sie gibt, Name nur als Text, „Foto ansehen“ zeigt das Bild.
   3 · Auswahl: ein Häkchen baut das Raster NICHT neu (dasselbe Element), die Leiste zählt, liegt
       nicht unter einem fremden Element, „Alle sichtbaren“ und „Aufheben“.
   4 · Menü: öffnet/schließt (zweiter Tipp, daneben, Escape), liegt ganz im Bild und obenauf.
   5 · Verschieben: Nutzlast GENAU die Felder von sichern(), Reihenfolge, neue Kategorie, andere Karte,
       „liegt schon dort“, zu lang/leer; Server verweigert (0 Zeilen) oder Netz fehlt → lokal bleibt
       alles beim Alten und der Satz sagt es; halb gelungen → nur das Gelungene ist übernommen.
   6 · Team: keine Häkchen, keine Bearbeiten-Kachel, kein Verschieben, nur „Foto ansehen“.
   7 · Maße: nichts läuft seitlich über (360/390/1280), Tapflächen ≥ 44 px, gleich hohe Reihen,
       lesbar ≥ 4,5:1 hell und dunkel, bei 1280 nutzt die Kachelliste die Breite.
   ═══════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");

let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if (!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };

const BASIS = "https://qux.supabase.co/storage/v1/object/public/gerichte/B/";
const DATEN = () => {
  const z = (id, name, kat, o) => Object.assign({ id, betrieb_id: "B", name, kategorie: kat, karte: "speisekarte", karten: ["speisekarte"], preis: 9.5, beschreibung: "",
    allergene: "", verfuegbar: true, veg: false, vegan: false, reihenfolge: 0, kat_sort: 1, kat_emoji: null, bild: "", bild_frei: null }, o);
  return [
    z("g1", "Pizza Margherita", "Pizza", { reihenfolge: 0, veg: true, bild: "https://qux.supabase.co/storage/v1/object/public/gerichte/B/p1-q1080.webp" }),
    z("g2", "Pizza Salami", "Pizza", { reihenfolge: 1, verfuegbar: false, preis: 11 }),
    z("g3", "Cola", "Getränke", { reihenfolge: 0, kat_sort: 2, preis: 3.2, bild: "http://unsicher.example/cola.webp" }),
    z("g4", "Eis", "Dessert", { reihenfolge: 0, kat_sort: 3, preis: 4, vegan: true, bild: 'https://qux.test/a.webp" onerror="window.__x=1' }),
    z("g5", "<img src=x onerror=window.__x=1>", "Dessert", { reihenfolge: 1, kat_sort: 3, preis: 5, bild: "https://qux.supabase.co/storage/v1/object/public/gerichte/B/alt.jpg", bild_frei: "https://qux.supabase.co/storage/v1/object/public/gerichte/B/frei.png" })
  ];
};

async function oeffnen(browser, breite, opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: breite, height: breite < 600 ? 844 : 900 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  if (opt.liste) await p.addInitScript(() => { try { localStorage.setItem("omoteno-karte-ansicht", "liste"); } catch (e) {} });
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(600);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const sc = document.getElementById("scharf"); if (sc) sc.hidden = true; });
  await p.waitForTimeout(200);
  await p.evaluate(daten => {
    const g = new Function("return (" + daten + ")()")();
    demo = false; betriebId = "B";
    window.__melde = []; window.melde = t => { window.__melde.push(t); };
    window.__uebs = []; window.katUebersetzen = (name, leise) => { window.__uebs.push([name, leise]); };
    window.__db = { log: [], modus: "ok", n: 0 };
    db = { removeChannel: () => Promise.resolve(), channel: () => ({ on() { return this; }, subscribe() { return this; } }), rpc: () => Promise.resolve({ data: null, error: null }),
      from: tab => ({ update: satz => { const q = { f: [] };
        const api = { eq(c, v) { q.f.push([c, v]); return api; }, select() { q.sel = true; return api; },
          then(ok, nein) { const d = window.__db; d.n++; d.log.push({ tab, satz, f: q.f, sel: q.sel });
            const id = (q.f.find(x => x[0] === "id") || [])[1]; let res;
            if (d.modus === "netz") res = { data: null, error: { message: "x" } };
            else if (d.modus === "sperre") res = { data: [], error: null };
            else if (d.modus === "zweitesFehlt" && d.n === 2) res = { data: null, error: { message: "x" } };
            else res = { data: [{ id }], error: null };
            return Promise.resolve(res).then(ok, nein); } };
        return api; } }) };
    gerichte = g; welcheKarte = "speisekarte"; KR_ANSICHT = "raster"; krKat = ""; krFilter = "alle"; krWahl.clear(); suchtext = "";
    tafelZeigen("speisekarte"); zeichneKarte();
  }, DATEN.toString());
  await p.waitForTimeout(250);
  return { ctx, p, fehler };
}
const kacheln = p => p.evaluate(() => [...document.querySelectorAll("#karteListe .kr-kachel")].map(k => k.querySelector(".kr-name").textContent));
const melden = p => p.evaluate(() => window.__melde.join(" | "));

/* ── 1 + 2 · Struktur und Foto ─────────────────────────────────── */
async function struktur(browser) {
  console.log("\n══ 1 · Struktur, Panel, Filter, Suche ══");
  for (const breite of [390, 1280]) {
    const b = await oeffnen(browser, breite), p = b.p, tag = " (" + breite + " px)";
    const s = await p.evaluate(() => ({
      ansicht: KR_ANSICHT, kacheln: document.querySelectorAll("#karteListe .kr-kachel").length, abschnitte: [...document.querySelectorAll("#karteListe .kat")].map(k => k.dataset.kat),
      neuErst: [...document.querySelectorAll("#karteListe .kr-raster")].map(r => r.firstElementChild.classList.contains("kr-neu")),
      neuText: [...document.querySelectorAll("#karteListe .kr-neu")].map(x => x.textContent.trim()),
      panel: getComputedStyle(document.querySelector(".kr-panel")).display,
      panelZahlen: [...document.querySelectorAll(".kr-pk")].map(x => x.querySelector("span:nth-child(2)").textContent + ":" + x.querySelector("b").textContent),
      zeilen: document.querySelectorAll("#karteListe .gzeile").length }));
    pruef(s.ansicht === "raster" && s.kacheln === 5 && s.zeilen === 0, "Vorgabe sind Kacheln: eine je Gericht, keine Listenzeilen" + tag, s.kacheln + " Kacheln");
    pruef(JSON.stringify(s.abschnitte) === '["Pizza","Getränke","Dessert"]', "ein Abschnitt je Kategorie, in der Reihenfolge von kat_sort" + tag, s.abschnitte.join(","));
    pruef(s.neuErst.length === 3 && s.neuErst.every(x => x), "die gestrichelte Kachel steht in jedem Abschnitt zuerst" + tag);
    pruef(s.neuText.join("|") === "＋Neues Gericht in Pizza|＋Neues Gericht in Getränke|＋Neues Gericht in Dessert", "und nennt ihre Kategorie" + tag, s.neuText.join("|"));
    pruef(s.panelZahlen.join(",") === "Alle:5,Pizza:2,Getränke:1,Dessert:2", "Panel mit Zählern" + tag, s.panelZahlen.join(","));
    pruef(breite >= 900 ? s.panel !== "none" : s.panel === "none", (breite >= 900 ? "Panel steht da" : "Panel ist unter 900 px weg") + tag, s.panel);
    /* gestrichelte Kachel öffnet das leere Blatt MIT der Kategorie */
    await p.click('#karteListe .kr-neu[data-leerkat-gericht="Getränke"]'); await p.waitForTimeout(250);
    const blatt = await p.evaluate(() => ({ offen: !document.getElementById("blatt").hidden, kat: document.getElementById("fKat").value, name: document.getElementById("fName").value }));
    pruef(blatt.offen && blatt.kat === "Getränke" && blatt.name === "", "„Neues Gericht in Getränke“ öffnet ein leeres Blatt mit dieser Kategorie" + tag, JSON.stringify(blatt));
    await p.evaluate(() => blattSchliessen()); await p.waitForTimeout(300);

    /* Der zweite Weg zu „Neue Kategorie“ steht am Ende der Liste und ist IMMER sichtbar (das Panel fehlt unter 900 px) */
    const nk = await p.evaluate(() => { const e = document.querySelector("#karteListe [data-kted-neu]"); const r = e ? e.getBoundingClientRect() : null;
      return { da: !!e, sichtbar: !!r && r.width > 0 && r.height > 0 }; });
    pruef(nk.da && nk.sichtbar, "„＋ Neue Kategorie“ am Ende ist sichtbar — auch ohne Panel" + tag, JSON.stringify(nk));
    await p.evaluate(() => document.querySelector("#karteListe [data-kted-neu]").click()); await p.waitForTimeout(250);
    pruef(await p.evaluate(() => !document.getElementById("ktedBlatt").hidden && document.getElementById("ktedTitel").textContent === "Neue Kategorie"), "und öffnet das Blatt „Neue Kategorie“" + tag);
    await p.evaluate(() => ktedZu()); await p.waitForTimeout(350);
    if (breite >= 900) {
      await p.evaluate(() => document.querySelector("[data-kr-neukat]").click()); await p.waitForTimeout(250);
      pruef(await p.evaluate(() => !document.getElementById("ktedBlatt").hidden), "der Knopf im Panel öffnet es ebenso" + tag);
      await p.evaluate(() => ktedZu()); await p.waitForTimeout(350);
    }

    /* Panel-Wahl wirkt nur breit */
    await p.evaluate(() => { krKat = "Pizza"; zeichneKarte(); });
    const nach = await kacheln(p);
    pruef(breite >= 900 ? nach.join(",") === "Pizza Margherita,Pizza Salami" : nach.length === 5,
      breite >= 900 ? "Panel „Pizza“ zeigt nur die Pizzen" + tag : "unter 900 px wird die Panel-Wahl ignoriert (kein Weg zurück ohne Panel)" + tag, nach.join(","));
    await p.evaluate(() => { krKat = ""; zeichneKarte(); });

    /* Filter */
    await p.evaluate(() => { krFilter = "aus"; zeichneKarte(); });
    pruef((await kacheln(p)).join(",") === "Pizza Salami", "Filter „Nicht verfügbar“" + tag, (await kacheln(p)).join(","));
    pruef(await p.evaluate(() => document.querySelectorAll("#karteListe .kr-neu").length) === 0, "mit Filter keine gestrichelte Kachel (sie wäre eine Kachel zwischen Treffern)" + tag);
    await p.evaluate(() => { krFilter = "ohnefoto"; zeichneKarte(); });
    const ohne = await kacheln(p);
    pruef(ohne.join(",") === "Pizza Salami,Cola,Eis", "Filter „Ohne Foto“: auch das mit unsicherer Adresse zählt als ohne", ohne.join(","));
    await p.evaluate(() => { krFilter = "alle"; zeichneKarte(); });
    /* Suche */
    await p.evaluate(() => { suchtext = "salami"; zeichneKarte(); });
    pruef((await kacheln(p)).join(",") === "Pizza Salami", "Suche zeigt nur den Treffer" + tag);
    pruef(await p.evaluate(() => document.querySelectorAll("#karteListe .kr-neu").length) === 0, "und keine gestrichelte Kachel" + tag);
    await p.evaluate(() => { suchtext = "zzz"; zeichneKarte(); });
    pruef(/Nichts gefunden/.test(await p.evaluate(() => document.getElementById("karteListe").textContent)), "ohne Treffer ein Satz statt leerer Fläche" + tag);
    await p.evaluate(() => { suchtext = ""; zeichneKarte(); });

    /* Umschalter */
    await p.evaluate(() => document.querySelector('[data-kr-ansicht="liste"]').click()); await p.waitForTimeout(150);
    const li = await p.evaluate(() => ({ zeilen: document.querySelectorAll("#karteListe .gzeile").length, kacheln: document.querySelectorAll("#karteListe .kr-kachel").length,
      gespeichert: localStorage.getItem("omoteno-karte-ansicht"), filterWeg: document.getElementById("krFilter").hidden,
      gedrueckt: document.querySelector('[data-kr-ansicht="liste"]').getAttribute("aria-pressed") }));
    pruef(li.zeilen === 5 && li.kacheln === 0 && li.gespeichert === "liste" && li.filterWeg && li.gedrueckt === "true", "Umschalter: die Liste von vorher ist da, gemerkt, Filter weg" + tag, JSON.stringify(li));
    await p.reload(); await p.waitForTimeout(500);
    pruef(await p.evaluate(() => KR_ANSICHT) === "liste", "die Wahl übersteht ein Neuladen" + tag);
    await p.evaluate(() => localStorage.removeItem("omoteno-karte-ansicht"));
    pruef(!b.fehler.length, "keine Ausnahme" + tag, b.fehler.join(" | ") || "still");
    await b.ctx.close();
  }
}

async function fotos(browser) {
  console.log("\n══ 2 · Das Foto ══");
  const b = await oeffnen(browser, 390), p = b.p;
  const t = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll("#karteListe .kr-kachel")].map(k => [k.dataset.krId,
    { src: (k.querySelector("img") || {}).src || "", platz: !!k.querySelector(".kr-platz"), name: k.querySelector(".kr-name").textContent }])));
  pruef(t.g1.src.endsWith("/p1-q320.webp"), "Foto: die kleine Fassung (-q320), wo die große (-q1080) die Board-Fassung ist", t.g1.src);
  pruef(t.g5.src.endsWith("/alt.jpg"), "Foto ohne -q1080: die Adresse, wie sie steht", t.g5.src);
  pruef(!t.g3.src && t.g3.platz, "http-Adresse kommt in kein src — Platzhalter mit dem Zeichen der Kategorie", t.g3.src || "kein Bild");
  pruef(!t.g4.src && t.g4.platz && !(await p.evaluate(() => window.__x)), "Anführungszeichen in der Adresse öffnet kein Attribut (kein onerror)", t.g4.src || "kein Bild");
  pruef(t.g5.name === "<img src=x onerror=window.__x=1>" && !(await p.evaluate(() => window.__x || document.querySelector("#karteListe .kr-name img"))), "Gerichtname mit Markup bleibt Text", t.g5.name);
  const eintrag = async id => { await p.evaluate(i => document.querySelector('.kr-kachel[data-kr-id="' + i + '"] [data-kr-menue]').click(), id); await p.waitForTimeout(100);
    return p.evaluate(() => [...document.querySelectorAll(".kr-menue [role=menuitem]")].map(x => x.textContent.trim())); };
  pruef((await eintrag("g1")).join("|") === "Bearbeiten|Verschieben …|Foto ansehen", "Menü mit Foto: Bearbeiten, Verschieben, Foto ansehen");
  await p.evaluate(() => document.querySelector('.kr-menue [data-kr-foto]').click()); await p.waitForTimeout(150);
  const foto = await p.evaluate(() => ({ offen: !document.getElementById("krFoto").hidden, src: document.getElementById("krFotoBild").src, name: document.getElementById("krFotoName").textContent,
    was: document.getElementById("krFotoWas").textContent, menue: document.querySelectorAll(".kr-menue").length }));
  pruef(foto.offen && foto.src.endsWith("/p1-q1080.webp") && foto.name === "Pizza Margherita" && !foto.menue, "„Foto ansehen“ zeigt die GROSSE Fassung, nennt das Gericht, Menü ist zu", JSON.stringify(foto));
  await p.evaluate(() => document.getElementById("krFotoZu").click()); await p.waitForTimeout(350);
  pruef(await p.evaluate(() => document.getElementById("krFoto").hidden && !document.getElementById("krFotoBild").getAttribute("src")), "Schließen leert das Bild");
  pruef((await eintrag("g2")).join("|") === "Bearbeiten|Verschieben …", "Menü ohne Foto: kein „Foto ansehen“");
  await p.evaluate(() => krMenueZu());
  await p.evaluate(() => document.querySelector('.kr-kachel[data-kr-id="g5"] [data-kr-menue]').click());
  await p.evaluate(() => document.querySelector('.kr-menue [data-kr-foto]').click()); await p.waitForTimeout(150);
  pruef(/Freisteller/.test(await p.evaluate(() => document.getElementById("krFotoWas").textContent)), "Gericht mit Freisteller: der Satz nennt ihn");
  await p.keyboard.press("Escape"); await p.waitForTimeout(350);
  pruef(await p.evaluate(() => document.getElementById("krFoto").hidden), "Escape schließt das Foto");
  pruef(!b.fehler.length, "keine Ausnahme", b.fehler.join(" | ") || "still");
  await b.ctx.close();
}

/* ── 3 + 4 · Auswahl und Menü ─────────────────────────────────── */
async function auswahl(browser) {
  console.log("\n══ 3 · Auswahl ══");
  for (const breite of [390, 1280]) {
    const b = await oeffnen(browser, breite), p = b.p, tag = " (" + breite + " px)";
    await p.evaluate(() => { window.__g1 = document.querySelector('.kr-kachel[data-kr-id="g1"]'); window.__raster = document.querySelector("#karteListe .kr-raster"); });
    const leiste = () => p.evaluate(() => { const e = document.getElementById("krAuswahl"); return { hidden: e.hidden, text: e.querySelector("[data-kr-zahl]").textContent }; });
    pruef((await leiste()).hidden, "ohne Auswahl keine Leiste" + tag);
    await p.click('[data-kr-wahl="g1"]');
    let l = await leiste();
    const k1 = await p.evaluate(() => ({ an: document.querySelector('[data-kr-wahl="g1"]').getAttribute("aria-checked"), rolle: document.querySelector('[data-kr-wahl="g1"]').getAttribute("role"),
      markiert: window.__g1.hasAttribute("data-gewaehlt"), selbes: window.__g1 === document.querySelector('.kr-kachel[data-kr-id="g1"]'), raster: window.__raster === document.querySelector("#karteListe .kr-raster") }));
    pruef(!l.hidden && l.text === "1 Gericht ausgewählt", "ein Häkchen: die Leiste zählt" + tag, l.text);
    pruef(k1.an === "true" && k1.rolle === "checkbox" && k1.markiert, "Häkchen ist role=checkbox, steht auf true, die Kachel ist markiert" + tag, JSON.stringify(k1));
    pruef(k1.selbes && k1.raster, "das Raster wurde dafür NICHT neu gebaut (dasselbe Element, §4.2)" + tag);
    await p.click('[data-kr-wahl="g2"]');
    pruef((await leiste()).text === "2 Gerichte ausgewählt", "zwei Häkchen: Mehrzahl" + tag, (await leiste()).text);
    /* Leiste liegt obenauf (§3.9): Mitte der Leiste trifft die Leiste, auch nach dem Rollen */
    await p.evaluate(() => window.scrollTo(0, 500)); await p.waitForTimeout(250);
    const ob = await p.evaluate(() => { const e = document.getElementById("krAuswahl"), r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { sichtbar: r.top >= 0 && r.bottom <= innerHeight, trifft: !!t && e.contains(t) }; });
    pruef(ob.sichtbar && ob.trifft, "gerollt klebt die Leiste und liegt obenauf (nicht unter Kopf oder Kategorien-Leiste)" + tag, JSON.stringify(ob));
    await p.evaluate(() => window.scrollTo(0, 0));
    /* Suche löscht die Auswahl nicht, wenn das Gericht bleibt */
    await p.evaluate(() => { suchtext = "pizza"; zeichneKarte(); });
    pruef(await p.evaluate(() => document.querySelector('.kr-kachel[data-kr-id="g1"]').hasAttribute("data-gewaehlt")) && (await leiste()).text === "2 Gerichte ausgewählt", "ein Neuzeichnen (Suche) behält die Auswahl" + tag);
    await p.evaluate(() => { suchtext = ""; zeichneKarte(); });
    await p.click("[data-kr-alle]");
    pruef((await leiste()).text === "5 Gerichte ausgewählt", "„Alle sichtbaren“ wählt jede Kachel" + tag, (await leiste()).text);
    await p.click("[data-kr-weg]");
    l = await leiste();
    pruef(l.hidden && await p.evaluate(() => document.querySelectorAll("#karteListe [data-gewaehlt]").length === 0 && document.querySelectorAll('#karteListe [aria-checked="true"]').length === 0), "„Aufheben“ räumt alles, die Leiste geht" + tag);
    /* Filter + „Alle sichtbaren“: nur die sichtbaren */
    await p.evaluate(() => { krFilter = "aus"; zeichneKarte(); });
    await p.click('[data-kr-wahl="g2"]'); await p.click("[data-kr-alle]");
    pruef((await leiste()).text === "1 Gericht ausgewählt", "„Alle sichtbaren“ meint die SICHTBAREN (Filter „Nicht verfügbar“: eines)" + tag, (await leiste()).text);
    await p.evaluate(() => { krFilter = "alle"; krWahl.clear(); zeichneKarte(); });
    /* gelöschtes Gericht fällt aus der Auswahl */
    await p.click('[data-kr-wahl="g3"]');
    await p.evaluate(() => { gerichte = gerichte.filter(g => g.id !== "g3"); zeichneKarte(); });
    pruef((await leiste()).hidden, "ein Gericht, das es nicht mehr gibt, fällt aus der Auswahl" + tag);
    pruef(!b.fehler.length, "keine Ausnahme" + tag, b.fehler.join(" | ") || "still");
    await b.ctx.close();
  }
}

async function menue(browser) {
  console.log("\n══ 4 · ⋯-Menü ══");
  for (const breite of [360, 1280]) {
    const b = await oeffnen(browser, breite), p = b.p, tag = " (" + breite + " px)";
    const offen = () => p.evaluate(() => document.querySelectorAll(".kr-menue").length);
    /* linke UND rechte Kachel einer Reihe: das Menü bleibt ganz im Bild */
    for (const id of ["g1", "g2"]) {
      await p.evaluate(i => document.querySelector('.kr-kachel[data-kr-id="' + i + '"] [data-kr-menue]').click(), id);
      await p.waitForTimeout(100);
      const m = await p.evaluate(() => { const e = document.querySelector(".kr-menue"), r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { links: Math.round(r.left), rechts: Math.round(r.right), breite: innerWidth, obenauf: !!t && e.contains(t), hoch: Math.round(Math.min(...[...e.querySelectorAll("button")].map(x => x.getBoundingClientRect().height))),
          expanded: e.parentElement.querySelector("[data-kr-menue]").getAttribute("aria-expanded") }; });
      pruef(m.links >= 0 && m.rechts <= m.breite, "Menü von " + id + " liegt ganz im Bild" + tag, m.links + " … " + m.rechts + " von " + m.breite);
      pruef(m.obenauf && m.hoch >= 44 && m.expanded === "true", "Menü von " + id + " liegt obenauf, Einträge ≥ 44 px, aria-expanded" + tag, JSON.stringify({ obenauf: m.obenauf, hoch: m.hoch, e: m.expanded }));
      await p.evaluate(() => krMenueZu());
    }
    await p.evaluate(() => document.querySelector('[data-kr-menue="g1"]').click());
    await p.evaluate(() => document.querySelector('[data-kr-menue="g1"]').click());
    pruef((await offen()) === 0, "zweiter Tipp auf ⋯ schließt" + tag);
    await p.evaluate(() => document.querySelector('[data-kr-menue="g1"]').click());
    await p.evaluate(() => document.querySelector('[data-kr-menue="g2"]').click());
    pruef((await offen()) === 1 && await p.evaluate(() => !!document.querySelector('.kr-kachel[data-kr-id="g2"] .kr-menue')), "nur EIN Menü zugleich" + tag);
    await p.mouse.click(2, 300); await p.waitForTimeout(80);
    pruef((await offen()) === 0, "Tipp daneben schließt" + tag);
    await p.evaluate(() => document.querySelector('[data-kr-menue="g1"]').click());
    await p.keyboard.press("Escape");
    pruef((await offen()) === 0, "Escape schließt" + tag);
    await p.evaluate(() => document.querySelector('[data-kr-menue="g1"]').click());
    await p.evaluate(() => document.querySelector('.kr-menue [data-bearbeiten]').click()); await p.waitForTimeout(250);
    const bl = await p.evaluate(() => ({ offen: !document.getElementById("blatt").hidden, name: document.getElementById("fName").value }));
    pruef(bl.offen && bl.name === "Pizza Margherita", "„Bearbeiten“ im Menü öffnet DAS Gericht" + tag, JSON.stringify(bl));
    await p.evaluate(() => blattSchliessen()); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('.kr-kachel[data-kr-id="g3"] .kr-karte').click()); await p.waitForTimeout(250);
    pruef(await p.evaluate(() => document.getElementById("fName").value) === "Cola", "ein Tipp auf die Kachel öffnet das Blatt (wie „Bearbeiten“)" + tag);
    await p.evaluate(() => blattSchliessen()); await p.waitForTimeout(300);
    pruef(!b.fehler.length, "keine Ausnahme" + tag, b.fehler.join(" | ") || "still");
    await b.ctx.close();
  }
}

/* ── 5 · Verschieben ──────────────────────────────────────────── */
async function verschieben(browser) {
  console.log("\n══ 5 · Verschieben ══");
  const b = await oeffnen(browser, 390), p = b.p;
  const log = () => p.evaluate(() => window.__db.log.map(l => ({ keys: Object.keys(l.satz).sort().join(","), satz: l.satz, id: (l.f.find(x => x[0] === "id") || [])[1], betrieb: (l.f.find(x => x[0] === "betrieb_id") || [])[1], sel: l.sel, tab: l.tab })));
  const oeffneFuer = async ids => {
    await p.evaluate(i => { krWahl.clear(); i.forEach(x => krWahl.add(x)); krVerschiebenOeffnen(i); }, ids);
    await p.waitForTimeout(100);
  };
  /* a) zwei Pizzen → Getränke */
  await p.evaluate(() => { krWahl.add("g1"); krWahl.add("g2"); zeichneKarte(); });
  await p.click("[data-kr-verschieben]"); await p.waitForTimeout(150);
  const bl = await p.evaluate(() => ({ offen: !document.getElementById("krBlatt").hidden, titel: document.getElementById("krTitel").textContent,
    ziele: [...document.querySelectorAll("#krZiele [data-kr-ziel]")].map(x => x.dataset.krZiel + ":" + x.querySelector("b").textContent), karte: !document.getElementById("krKarteWahl").hidden,
    optionen: [...document.querySelectorAll("#krKarte option")].map(o => o.value) }));
  pruef(bl.offen && bl.titel === "2 Gerichte verschieben", "Leiste → Blatt „2 Gerichte verschieben“", bl.titel);
  pruef(bl.ziele.join(",") === "Pizza:2,Getränke:1,Dessert:2", "Ziele: jede Kategorie mit Zähler", bl.ziele.join(","));
  pruef(bl.karte && bl.optionen.join(",") === "speisekarte,getraenke,cocktails", "bei mehreren Karten wählbar", bl.optionen.join(","));
  await p.click('[data-kr-ziel="Getränke"]');
  pruef(await p.evaluate(() => document.querySelector('[data-kr-ziel="Getränke"]').getAttribute("aria-checked")) === "true", "Ziel ist gewählt (role=radio)");
  await p.click("#krOk"); await p.waitForTimeout(300);
  let L = await log();
  pruef(L.length === 2 && L.every(x => x.tab === "gerichte" && x.sel === true && x.betrieb === "B"), "zwei Schreibvorgänge, je Gericht, im eigenen Betrieb, mit Rückgabe der Zeile", JSON.stringify(L.map(x => x.id)));
  pruef(L.every(x => x.keys === "geaendert,kat_emoji,kat_sort,kategorie,reihenfolge"), "Nutzlast GENAU die Felder von sichern(): kategorie, kat_sort, kat_emoji, reihenfolge (+ geaendert)", L[0] && L[0].keys);
  pruef(L.every(x => x.satz.kategorie === "Getränke" && x.satz.kat_sort === 2) && L[0].satz.reihenfolge === 1 && L[1].satz.reihenfolge === 2,
    "kat_sort der Zielkategorie (2), Reihenfolge hinten angehängt (1, 2) in der gewählten Folge", JSON.stringify(L.map(x => [x.satz.kat_sort, x.satz.reihenfolge])));
  const nach = await p.evaluate(() => ({ g1: gerichte.find(g => g.id === "g1").kategorie, abschnitte: [...document.querySelectorAll("#karteListe .kat")].map(k => k.dataset.kat), wahl: krWahl.size,
    zu: document.getElementById("krBlatt").hidden, gz: document.querySelectorAll('#karteListe .kat[data-kat="Getränke"] .kr-kachel').length }));
  pruef(nach.g1 === "Getränke" && nach.wahl === 0 && nach.gz === 3 && nach.abschnitte.join(",") === "Getränke,Dessert", "lokal übernommen: Getränke hat drei, Pizza ist verschwunden, Auswahl leer", JSON.stringify(nach));
  pruef(/2 Gerichte verschoben nach „Getränke“/.test(await melden(p)), "Hinweis nennt Zahl und Ziel", await melden(p));
  await p.waitForTimeout(350);
  pruef(await p.evaluate(() => document.getElementById("krBlatt").hidden), "das Blatt ist zu");

  /* b) neue Kategorie per Eintippen */
  await p.evaluate(() => { window.__db.log.length = 0; window.__uebs.length = 0; });
  await oeffneFuer(["g4"]);
  await p.fill("#krNeu", "  Neuheiten   neu "); await p.click("#krOk"); await p.waitForTimeout(300);
  L = await log();
  pruef(L.length === 1 && L[0].satz.kategorie === "Neuheiten neu" && L[0].satz.kat_sort === 4 && L[0].satz.kat_emoji === null && L[0].satz.reihenfolge === 0,
    "neue Kategorie: Name bereinigt, kat_sort = größter + 1, Zeichen automatisch (null), erstes Gericht", JSON.stringify(L[0] && L[0].satz));
  pruef(JSON.stringify(await p.evaluate(() => window.__uebs)) === '[["Neuheiten neu",true]]', "die neue Kategorie wird übersetzt (wie bei sichern())");
  pruef((await p.evaluate(() => [...document.querySelectorAll("#karteListe .kat")].map(k => k.dataset.kat))).includes("Neuheiten neu"), "der neue Abschnitt steht da");

  /* c) liegt schon dort */
  await p.evaluate(() => { window.__db.log.length = 0; window.__melde.length = 0; });
  await oeffneFuer(["g3"]);
  await p.click('[data-kr-ziel="Getränke"]'); await p.click("#krOk"); await p.waitForTimeout(300);
  pruef((await log()).length === 0 && /Liegt schon dort/.test(await melden(p)), "Gericht liegt schon in der Kategorie: nichts geschrieben, Satz sagt es", await melden(p));

  /* d) leer und zu lang */
  await p.evaluate(() => { window.__melde.length = 0; });
  await oeffneFuer(["g3"]); await p.click("#krOk");
  pruef(/Wähle eine Kategorie/.test(await melden(p)) && (await log()).length === 0 && !(await p.evaluate(() => document.getElementById("krBlatt").hidden)), "ohne Wahl: Satz, nichts geschrieben, Blatt bleibt offen");
  await p.fill("#krNeu", "x".repeat(41)).catch(() => {});
  await p.evaluate(() => { document.getElementById("krNeu").value = "x".repeat(41); window.__melde.length = 0; });
  await p.click("#krOk");
  pruef(/Höchstens 40/.test(await melden(p)) && (await log()).length === 0, "41 Zeichen: Satz, nichts geschrieben", await melden(p));
  await p.evaluate(() => krVerschiebenZu()); await p.waitForTimeout(350);

  /* e) andere Karte */
  await p.evaluate(() => { window.__db.log.length = 0; });
  await oeffneFuer(["g5"]);
  await p.selectOption("#krKarte", "getraenke"); await p.waitForTimeout(100);
  const z2 = await p.evaluate(() => [...document.querySelectorAll("#krZiele [data-kr-ziel]")].map(x => x.dataset.krZiel));
  pruef(z2.length === 0 || !z2.includes("Getränke"), "andere Karte: die Zielliste zeigt die Kategorien DIESER Karte (hier keine)", z2.join(","));
  await p.fill("#krNeu", "Kaltes"); await p.click("#krOk"); await p.waitForTimeout(300);
  L = await log();
  pruef(L.length === 1 && JSON.stringify(L[0].satz.karten) === '["getraenke"]' && L[0].satz.karte === "getraenke" && L[0].satz.kategorie === "Kaltes",
    "andere Karte: karten und karte folgen (nur die Zielkarte), Kategorie dort neu", JSON.stringify(L[0] && [L[0].satz.karten, L[0].satz.karte]));
  pruef(!(await kacheln(p)).includes("<img src=x onerror=window.__x=1>"), "das Gericht ist aus der Karte „Speisekarte“ verschwunden");

  /* f) Gericht in zwei Karten: nur die aktuelle wird ersetzt */
  await p.evaluate(() => { gerichte.find(g => g.id === "g4").karten = ["speisekarte", "cocktails"]; window.__db.log.length = 0; });
  await oeffneFuer(["g4"]);
  await p.selectOption("#krKarte", "getraenke"); await p.fill("#krNeu", "Süßes"); await p.click("#krOk"); await p.waitForTimeout(300);
  L = await log();
  pruef(L.length === 1 && JSON.stringify(L[0].satz.karten) === '["cocktails","getraenke"]' && L[0].satz.karte === "getraenke",
    "Gericht in zwei Karten: die aktuelle wird durch die Zielkarte ersetzt, die andere bleibt", JSON.stringify(L[0] && L[0].satz.karten));

  /* g) Server verweigert (0 Zeilen) */
  await p.evaluate(() => { window.__db.log.length = 0; window.__db.modus = "sperre"; window.__db.n = 0; window.__melde.length = 0; });
  const vorher = await p.evaluate(() => gerichte.map(g => g.id + ":" + g.kategorie).join("|"));
  await oeffneFuer(["g3"]); await p.fill("#krNeu", "Verboten"); await p.click("#krOk"); await p.waitForTimeout(300);
  pruef(/nur der Besitzer/.test(await melden(p)), "0 geschriebene Zeilen = „kein Recht“, nicht „gelungen“ (§2.3b)", await melden(p));
  pruef(await p.evaluate(() => gerichte.map(g => g.id + ":" + g.kategorie).join("|")) === vorher, "und lokal bleibt alles beim Alten");
  pruef(!(await p.evaluate(() => document.getElementById("krBlatt").hidden)), "das Blatt bleibt offen (man kann es anders versuchen)");
  /* h) Netz weg */
  await p.evaluate(() => { window.__db.modus = "netz"; window.__melde.length = 0; });
  await p.click("#krOk"); await p.waitForTimeout(300);
  pruef(/Nicht gespeichert/.test(await melden(p)) && await p.evaluate(() => gerichte.map(g => g.id + ":" + g.kategorie).join("|")) === vorher, "Netzfehler: Satz, lokal unverändert", await melden(p));
  await p.evaluate(() => krVerschiebenZu()); await p.waitForTimeout(350);
  /* i) halb gelungen */
  await p.evaluate(() => { window.__db.modus = "zweitesFehlt"; window.__db.n = 0; window.__db.log.length = 0; window.__melde.length = 0; });
  await p.evaluate(() => { gerichte.find(g => g.id === "g3").kategorie = "Getränke"; });
  await oeffneFuer(["g1", "g2"]);
  await p.fill("#krNeu", "Halb"); await p.click("#krOk"); await p.waitForTimeout(300);
  const halb = await p.evaluate(() => ({ g1: gerichte.find(g => g.id === "g1").kategorie, g2: gerichte.find(g => g.id === "g2").kategorie }));
  pruef(halb.g1 === "Halb" && halb.g2 !== "Halb" && /1 schon verschoben/.test(await melden(p)), "halb gelungen: nur das Gelungene ist übernommen, der Satz nennt es", JSON.stringify(halb) + " / " + await melden(p));
  pruef(!b.fehler.length, "keine Ausnahme", b.fehler.join(" | ") || "still");
  await b.ctx.close();
}

/* ── 6 · Team ─────────────────────────────────────────────────── */
async function team(browser) {
  console.log("\n══ 6 · Team ══");
  const b = await oeffnen(browser, 1280), p = b.p;
  await p.evaluate(() => { rolleAnwenden("team"); zeichneKarte(); });
  const t = await p.evaluate(() => ({ haken: document.querySelectorAll("[data-kr-wahl]").length, neu: document.querySelectorAll(".kr-neu").length, leiste: !!document.getElementById("krAuswahl"),
    bearbeiten: document.querySelectorAll("#karteListe [data-bearbeiten]").length, karteKnopf: document.querySelectorAll("#karteListe button.kr-karte").length,
    mehr: [...document.querySelectorAll("[data-kr-menue]")].map(x => x.dataset.krMenue), neukat: document.querySelectorAll("[data-kr-neukat]").length, kachel: document.querySelectorAll(".kr-kachel").length }));
  pruef(t.kachel === 5 && t.haken === 0 && !t.leiste && t.neu === 0 && t.neukat === 0, "Team sieht alle Kacheln, aber keine Häkchen, keine Leiste, keine gestrichelte Kachel, kein „Neue Kategorie“ im Panel", JSON.stringify(t));
  pruef(t.bearbeiten === 0 && t.karteKnopf === 0, "Team: keine Kachel ist ein Bearbeiten-Knopf (nur ansehen)", JSON.stringify({ b: t.bearbeiten, k: t.karteKnopf }));
  pruef(t.mehr.join(",") === "g1,g5", "⋯ nur dort, wo es etwas zu zeigen gibt (Foto): g1, g5", t.mehr.join(","));
  await p.evaluate(() => document.querySelector('[data-kr-menue="g1"]').click());
  pruef(await p.evaluate(() => [...document.querySelectorAll(".kr-menue [role=menuitem]")].map(x => x.textContent.trim()).join("|")) === "Foto ansehen", "Team-Menü: nur „Foto ansehen“");
  await p.evaluate(() => krMenueZu());
  /* ein erzwungener Schreibversuch kommt am Server nicht vorbei (gestellt: 0 Zeilen) */
  await p.evaluate(() => { window.__db.modus = "sperre"; });
  const r = await p.evaluate(() => gerichteVerschieben(["g1"], { kategorie: "Getränke" }));
  pruef(r.ok === false && r.grund === "kein_recht", "Team-Schreibversuch: abgewiesen als „kein_recht“", JSON.stringify(r));
  pruef(await p.evaluate(() => gerichte.find(g => g.id === "g1").kategorie) === "Pizza", "und nichts verschoben");
  await p.evaluate(() => { rolleAnwenden("inhaber"); zeichneKarte(); });
  pruef(await p.evaluate(() => document.querySelectorAll("[data-kr-wahl]").length) === 5, "zurück zum Besitzer: Häkchen wieder da");
  pruef(!b.fehler.length, "keine Ausnahme", b.fehler.join(" | ") || "still");
  await b.ctx.close();
}

/* ── 7 · Maße und Lesbarkeit ──────────────────────────────────── */
const lum = c => { const v = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const kontrast = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
async function masse(browser) {
  console.log("\n══ 7 · Maße und Lesbarkeit ══");
  for (const breite of [360, 390, 1280]) {
    const b = await oeffnen(browser, breite), p = b.p, tag = " (" + breite + " px)";
    await p.evaluate(() => { window.__neu = true; });
    const m = await p.evaluate(() => {
      const r = e => e.getBoundingClientRect();
      const ks = [...document.querySelectorAll("#karteListe .kr-kachel")];
      const reihen = {}; ks.forEach(k => { const y = Math.round(r(k).top); (reihen[y] = reihen[y] || []).push(Math.round(r(k).height)); });
      const alleNeu = [...document.querySelectorAll("#karteListe .kr-raster")].map(g => [...g.children].map(c => Math.round(r(c).top) + ":" + Math.round(r(c).height)));
      const spalten = new Set([...document.querySelectorAll("#karteListe .kr-raster")][0] ? [...document.querySelector("#karteListe .kr-raster").children].map(c => Math.round(r(c).left)) : []).size;
      return { ueber: document.documentElement.scrollWidth > innerWidth + 1, breiteMin: Math.min(...ks.map(k => Math.round(r(k).width))),
        gleich: Object.values(reihen).every(h => new Set(h).size === 1), spalten, listeBreite: Math.round(r(document.getElementById("karteListe")).width),
        haken: [...document.querySelectorAll("[data-kr-wahl]")].map(x => [Math.round(r(x).width), Math.round(r(x).height)]),
        mehr: [...document.querySelectorAll("[data-kr-menue]")].map(x => [Math.round(r(x).width), Math.round(r(x).height)]),
        karteHoch: Math.min(...[...document.querySelectorAll(".kr-karte")].map(x => Math.round(r(x).height))),
        bildVerh: (() => { const x = r(document.querySelector(".kr-bild")); return +(x.width / x.height).toFixed(2); })(),
        schalter: [...document.querySelectorAll(".kr-schalter button, .kr-fchip")].map(x => Math.round(r(x).height)), pk: [...document.querySelectorAll(".kr-pk")].filter(x => r(x).height).map(x => Math.round(r(x).height)) };
    });
    pruef(!m.ueber, "kein seitliches Überlaufen" + tag);
    pruef(m.breiteMin >= 140, "jede Kachel ≥ 140 px breit" + tag, m.breiteMin + " px");
    pruef(m.gleich, "gleich hohe Kacheln je Reihe (§3.7)" + tag);
    pruef(m.haken.every(([w, h]) => w >= 44 && h >= 44) && m.mehr.every(([w, h]) => w >= 44 && h >= 44), "Häkchen und ⋯ haben ≥ 44 × 44 px Tapfläche" + tag, JSON.stringify([m.haken[0], m.mehr[0]]));
    pruef(m.karteHoch >= 100 && m.schalter.every(h => h >= 44) && m.pk.every(h => h >= 44), "Kachel, Umschalter, Filter und Panel-Einträge ≥ 44 px" + tag, JSON.stringify({ k: m.karteHoch, s: Math.min(...m.schalter), p: m.pk.length ? Math.min(...m.pk) : "–" }));
    pruef(m.bildVerh > 1.3 && m.bildVerh < 1.37, "Foto-Fläche 4:3" + tag, String(m.bildVerh));
    if (breite === 1280) {
      pruef(m.listeBreite > 1000 && m.spalten >= 3, "bei 1280 px nutzt die Kachelliste die Breite (≥ 1000 px, ≥ 3 Spalten)", m.listeBreite + " px, " + m.spalten + " Spalten");
    }
    if (breite !== 1280) pruef(m.spalten === 2, "am Telefon zwei Spalten" + tag, m.spalten + " Spalten");

    /* Lesbarkeit hell und dunkel */
    for (const hell of [false, true]) {
      await p.evaluate(h => { document.body.classList.toggle("hell", h); }, hell);
      await p.waitForTimeout(150);
      const k = await p.evaluate(() => {
        const zahl = c => (c.match(/[\d.]+/g) || []).map(Number);
        const grund = el => { let e = el; while(e){ const c = zahl(getComputedStyle(e).backgroundColor); if(c.length >= 3 && (c.length === 3 || c[3] === 1)) return c.slice(0, 3);
          if(c.length === 4 && c[3] > 0 && c[3] < 1){ const unten = grund(e.parentElement); return [0,1,2].map(i => Math.round(c[i] * c[3] + unten[i] * (1 - c[3]))); }
          e = e.parentElement; } return [255, 255, 255]; };
        const farbe = (sel, wie) => { const el = document.querySelector(sel); if(!el) return null; return { fg: zahl(getComputedStyle(el).color).slice(0, 3), bg: grund(el), wie }; };
        return [farbe(".kr-name", "Name"), farbe(".kr-preis", "Preis"), farbe(".kr-kategorie", "Kategorie"), farbe(".kr-marke", "Marke"), farbe(".kr-marke.aus", "Marke „aus“"),
          farbe(".kr-neu", "Neue Kachel"), farbe(".kr-pk", "Panel-Eintrag"), farbe('.kr-pk[aria-pressed="true"]', "Panel gewählt"), farbe('.kr-schalter button[aria-pressed="true"]', "Umschalter an"),
          farbe('.kr-schalter button[aria-pressed="false"]', "Umschalter aus"), farbe('.kr-fchip[aria-pressed="false"]', "Filter aus"), farbe('.kr-fchip[aria-pressed="true"]', "Filter an")].filter(Boolean);
      });
      const schlecht = k.map(x => ({ w: x.wie, c: +kontrast(x.fg, x.bg).toFixed(2) })).filter(x => x.c < 4.5);
      pruef(k.length >= 10 && schlecht.length === 0, "jede Schrift ≥ 4,5:1 (" + (hell ? "hell" : "dunkel") + ")" + tag, schlecht.length ? JSON.stringify(schlecht) : k.length + " Paare");
    }
    pruef(!b.fehler.length, "keine Ausnahme" + tag, b.fehler.join(" | ") || "still");
    await b.ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  await struktur(browser);
  await fotos(browser);
  await auswahl(browser);
  await menue(browser);
  await verschieben(browser);
  await team(browser);
  await masse(browser);
  await browser.close();
  console.log("\n" + (f ? f + " von " + n + " Fehler." : "alles grün (" + n + " Proben)"));
  process.exit(f ? 1 : 0);
})();
