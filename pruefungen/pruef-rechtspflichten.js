/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Rechtspflichten aus dem Bericht „Mit KI gebaute Software verkaufen“ (Hessen, Stand 25.10.2026)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-rechtspflichten.js

   Setzt die Befunde R1–R11 aus dokumente/recht/14-… als Prüfung um — jede Zeile hält etwas gegen eine ZWEITE QUELLE
   (Datei, Migration, gerenderte Seite), nie nur gegen die eigene Annahme:

     R1  AGB und AVV: Seiten da, in jeder Fußzeile verlinkt, im Bau und in den Weiterleitungen; „nur Unternehmer“; § 536a;
         KI-Kapitel; kein Satz über § 146a AO; Entwurf-Kasten + sichtbare „Angabe fehlt noch“-Stellen (kein erfundener Wert);
         Konto: Annahme aus, solange VERTRAEGE_AN aus ist; eingeschaltet (Kopie) bedient mit gestelltem supabase: zwei Haken,
         genau die Parameter der Migration, jeder Grund der Funktion hat einen Satz, fehlende Funktion sperrt nichts.
     R2  Erzeuger --streng (Wegwerf-Verzeichnis): ein echtes Haus ohne Anbieter ist ein Fehler, das Vorführhaus nicht, ohne
         --streng (Netlify-Bau) bleibt es ein Hinweis.
     R3  Hub (beide Häuser): Aktionspreis OHNE durchgestrichenen Preis und OHNE „−x %“ — Karte und Detailblatt.
     R4  Allergen-Satz ohne „Gewähr“, mit „vor der Bestellung“ (alle elf Sprachen vorhanden).
     R5  Landingpage: keine DSGVO-Plakette, kein § 146a-Satz, „netto“, „nur Unternehmer“, „Datenbank in Frankfurt“.
     R7  Datenschutzerklärung nennt Stripe.
     R8  „KI-bearbeitet“: Marke nur bei echtem true, Kontrast ≥ 4,5:1 auch auf weißem Foto; Board schickt bild_ki nur mit Spalte.
     R9  Board: Mehrweg-Hinweis (§§ 33, 34 VerpackG) in der Gruppe Lieferung.
     R11 Entwicklungsnachweis und Urhebervermerk da; Impressum ohne Schutzbehauptung.

   EHRLICHE GRENZEN: Die Texte der Verträge sind Entwürfe und nicht anwaltlich geprüft — diese Prüfung beweist, dass sie da sind und
   zu Code und Datenbank passen, nicht, dass sie rechtlich tragen. Die Annahme im Konto ist nur mit gestelltem supabase bedient.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const os   = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const OBEN   = path.resolve(__dirname, "..");
const SEITEN = process.env.SEITEN_DIR || path.join(OBEN, "seiten");
const DIST   = process.env.HUB_DIST || path.join(OBEN, "dist");
const ADMIN  = process.env.ADMIN_DATEI || path.join(SEITEN, "admin.html");
const ERZEUGER = process.env.ERZEUGER_DATEI || path.join(OBEN, "erzeuger", "erzeuge-hub.js");
const lies = p => fs.readFileSync(p, "utf8");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}
const text = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

(async () => {
  /* ══ R1 · AGB und AVV als Seiten ══ */
  console.log("\n══ R1 · AGB und AVV ══");
  const agb = lies(path.join(SEITEN, "agb.html")), avv = lies(path.join(SEITEN, "avv.html"));
  const agbT = text(agb), avvT = text(avv);
  pruef(/<title>[^<]*Geschäftsbedingungen/.test(agb) && /<title>[^<]*Auftragsverarbeitung/.test(avv), "beide Seiten tragen ihren Titel");
  pruef(/nur\s+für\s+Unternehmer|ausschließlich mit Unternehmern/.test(agbT) && /Verbraucher können keinen Vertrag schließen/.test(agbT), "AGB § 1: nur Unternehmer, Verbraucher ausgeschlossen");
  pruef(/§ 536a Abs\. 1 Alt\. 1/.test(agbT), "AGB § 9: verschuldensunabhängige Haftung nach § 536a BGB ausgeschlossen");
  pruef(/KI-Funktionen/.test(agbT) && /Alessia/.test(agbT) && /Anlage 2 des Auftragsverarbeitungsvertrags/.test(agbT) && /ist eine KI|eine KI ist/.test(agbT), "AGB § 2 Abs. 5: KI-Funktionen, Ergebnisse als Vorschlag, Unterauftragnehmer, KI-Hinweis der Telefon-Assistentin");
  pruef(!/146a|TSE\b/.test(agbT), "AGB: keine rechtliche Aussage zu § 146a AO / TSE (Bericht R5/R14: nicht bestätigt)");
  pruef(/§§ 33, 34\s+VerpackG/.test(agbT), "AGB § 4 Abs. 7: Verpackungspflichten beim Kunden");
  pruef(/zwölf Monaten gezahlten Entgelte/.test(agbT), "AGB § 9: Deckelung auf zwölf Monatsentgelte");
  for (const [name, html] of [["AGB", agb], ["AVV", avv]]) {
    pruef(/hinweis-kasten entwurf/.test(html) && /nicht rechtlich geprüft/.test(html), name + ": Entwurf-Kasten sichtbar (nicht rechtlich geprüft)");
    pruef(/class="offen">[^<]*Angabe fehlt noch/.test(html), name + ": fehlende Angaben stehen SICHTBAR als „Angabe fehlt noch“");
    pruef(!/\{[^}]{2,60}\}/.test(text(html)), name + ": keine leere Platzhalter-Klammer {…} im Text");
    pruef(/href="agb\.html"/.test(html) && /href="avv\.html"/.test(html) && /href="impressum\.html"/.test(html) && /href="datenschutz\.html"/.test(html), name + ": Fußzeile verlinkt AGB, AVV, Impressum, Datenschutz");
  }
  pruef(/Anlage 1/.test(avvT) && /Anlage 2/.test(avvT) && /Anlage 3/.test(avvT) && /Stripe Payments Europe/.test(avvT) && /Anthropic/.test(avvT), "AVV: drei Anlagen, Stripe und Anthropic als Unterauftragsverarbeiter");
  pruef(/Frankfurt/.test(avvT), "AVV: Datenbank in Frankfurt (wie Datenschutzerklärung)");
  /* die Seiten sind verlinkt */
  for (const [datei, muster] of [["omoteno-web.html", /href="\/agb\.html"[\s\S]{0,200}href="\/avv\.html"/], ["konto.html", /href="\/agb\.html"[\s\S]{0,120}href="\/avv\.html"/],
                                  ["start.html", /href="agb\.html"[\s\S]{0,120}href="avv\.html"/], ["datenschutz.html", /href="agb\.html"[\s\S]{0,120}href="avv\.html"/],
                                  ["impressum.html", /href="agb\.html"[\s\S]{0,120}href="avv\.html"/]]) {
    pruef(muster.test(lies(path.join(SEITEN, datei))), datei + ": Fußzeile verlinkt AGB und Auftragsverarbeitung");
  }
  /* im Bau, in der Sitemap, in den Weiterleitungen (zweite Quelle: die Dateien selbst) */
  const bauen = lies(path.join(OBEN, "erzeuger", "bauen.js")), umleit = lies(path.join(OBEN, "auslieferung", "_redirects"));
  pruef(/\["seiten\/agb\.html",\s+"agb\.html"\]/.test(bauen) && /\["seiten\/avv\.html",\s+"avv\.html"\]/.test(bauen), "bauen.js liefert agb.html und avv.html aus");
  pruef(/omoteno\.de\/agb\.html/.test(bauen) && /omoteno\.de\/avv\.html/.test(bauen), "Sitemap nennt beide");
  pruef(/^\/agb\s+\/agb\.html\s+200/m.test(umleit) && /^\/avv\s+\/avv\.html\s+200/m.test(umleit), "_redirects: /agb und /avv");

  /* Konto: Annahme */
  console.log("\n══ R1 · Konto: Annahme der Verträge ══");
  const konto = lies(path.join(SEITEN, "konto.html"));
  const mig = lies(path.join(OBEN, "datenbank", "migration-vertraege.sql"));
  pruef(/const VERTRAEGE_AN = false;/.test(konto), "Voraussetzung: im ausgelieferten Konto ist die Annahme AUS (erst nach der Prüfung der Texte)");
  const sig = mig.match(/function public\.vertrag_annehmen\(([^)]*)\)/);
  const parameter = sig ? sig[1].split(",").map(x => x.trim().split(/\s+/)[0]) : [];
  pruef(parameter.join() === "p_betrieb,p_fassung,p_agb,p_avv", "Migration: Parameter der Funktion gelesen", parameter.join());
  const rpc = konto.match(/db\.rpc\("vertrag_annehmen",\s*\{([^}]*)\}/);
  const gesendet = rpc ? [...rpc[1].matchAll(/(p_[a-z]+):/g)].map(m => m[1]) : [];
  pruef(gesendet.join() === parameter.join(), "Naht: das Konto schickt genau diese Parameter", gesendet.join());
  const gruende = [...new Set([...mig.matchAll(/'grund',\s*'([a-z_]+)'/g)].map(m => m[1]))];
  const satzTeil = konto.match(/const VERTRAG_GRUND = \{([\s\S]*?)\n\};/);
  const saetze = satzTeil ? [...satzTeil[1].matchAll(/^\s*([a-z_]+):/gm)].map(m => m[1]) : [];
  pruef(gruende.length === 4 && gruende.every(g => saetze.includes(g)), "Naht: jeder Grund der Funktion hat im Konto einen Satz", gruende.join(", ") + " / " + saetze.join(", "));
  pruef(/revoke execute on function public\.vertrag_annehmen[\s\S]*?from public, anon/.test(mig) && /grant select on table public\.vertrag_annahmen to authenticated;/.test(mig),
    "Migration: anon ohne EXECUTE, authenticated nur lesen (Recht + Regel, §2.3a)");

  const browser = await chromium.launch();
  const BIB = `
    window.__rpc = []; window.__annahmen = []; window.__annahmenFehler = null; window.__rpcAntwort = { data:{ ok:true }, error:null }; window.__rpcWirft = false;
    window.supabase = { createClient: function(){
      function kette(tab){
        const z = { einzeln:false };
        const p = new Proxy(function(){}, { get(_, k){
          if(k === "then") return (res, rej) => {
            const d = tab === "betrieb_mitglieder" ? { data:[{ betrieb_id:"b1", rolle:"inhaber" }], error:null }
              : tab === "betriebe" ? { data:{ id:"b1", slug:"choco", name:"Choco", plan:"start" }, error:null }
              : tab === "vertrag_annahmen" ? { data: window.__annahmenFehler ? null : window.__annahmen, error: window.__annahmenFehler }
              : { data: z.einzeln ? null : [], count:0, error:null };
            return Promise.resolve(d).then(res, rej);
          };
          return (...a) => { if(k === "single" || k === "maybeSingle") z.einzeln = true; return p; };
        } });
        return p;
      }
      return {
        auth: { getSession: async () => ({ data:{ session:{ user:{ id:"11111111-1111-4111-8111-111111111111", email:"wirt@example.org" } } }, error:null }),
                getUser: async () => ({ data:{ user:{ id:"11111111-1111-4111-8111-111111111111" } } }),
                onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }), signOut: async () => ({}) },
        from: kette,
        rpc: async (name, args) => { window.__rpc.push({ name, args });
          if(name === "vertrag_annehmen"){ if(window.__rpcWirft) throw new Error("404"); return window.__rpcAntwort; }
          return { data:null, error:null }; },
        functions: { invoke: async () => ({ data:{ ok:true }, error:null }) },
        storage: { from: () => kette("speicher") }
      };
    } };`;
  async function kontoOeffnen(datei) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const p = await ctx.newPage(); const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.addInitScript(BIB);
    await p.route("**/*", r => { const u = r.request().url(); if (/supabase-js/.test(u)) return r.abort(); return u.startsWith("file://") ? r.continue() : r.abort(); });
    await p.goto("file://" + datei);
    await p.waitForTimeout(900);
    await p.evaluate(() => { const k = document.querySelector('[data-blatt="vertrag"]'); if (k) k.click(); });
    await p.waitForTimeout(400);
    return { ctx, p, fehler };
  }
  {
    const { ctx, p, fehler } = await kontoOeffnen(path.join(SEITEN, "konto.html"));
    const zu = await p.evaluate(() => ({ da: !!document.getElementById("vtTafel"), hidden: document.getElementById("vtTafel").hidden, rpc: window.__rpc.length }));
    pruef(zu.da && zu.hidden && zu.rpc === 0, "ausgeliefert (Annahme AUS): Tafel verborgen, nichts angefragt", JSON.stringify(zu));
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  const kopie = path.join(os.tmpdir(), "konto-vertraege-" + process.pid + ".html");
  fs.writeFileSync(kopie, konto.replace("const VERTRAEGE_AN = false;", "const VERTRAEGE_AN = true;"));
  {
    const { ctx, p, fehler } = await kontoOeffnen(kopie);
    const a = await p.evaluate(() => ({ tafel: !document.getElementById("vtTafel").hidden, annahme: !document.getElementById("vtAnnahme").hidden,
      knopf: document.getElementById("vtKnopf").disabled, hakenHoehe: Math.round(document.querySelector(".vt-haken").getBoundingClientRect().height),
      schrift: parseFloat(getComputedStyle(document.querySelector(".vt-haken")).fontSize) }));
    pruef(a.tafel && a.annahme, "Voraussetzung (Kopie mit Schalter an): Tafel und Haken stehen da, noch nichts angenommen", JSON.stringify(a));
    pruef(a.knopf, "Knopf ist ohne Haken gesperrt");
    pruef(a.hakenHoehe >= 44 && a.schrift >= 16, "Haken ≥ 44 px hoch, Schrift 16 px", a.hakenHoehe + " / " + a.schrift);
    await p.click("#vtAgb");
    pruef(await p.evaluate(() => document.getElementById("vtKnopf").disabled), "ein Haken genügt nicht");
    await p.click("#vtAvv");
    pruef(!(await p.evaluate(() => document.getElementById("vtKnopf").disabled)), "beide Haken schalten den Knopf frei");
    /* Server verweigert: jeder Grund als Satz */
    for (const g of gruende) {
      await p.evaluate(gr => { window.__rpcAntwort = { data:{ ok:false, grund:gr }, error:null }; }, g);
      await p.click("#vtKnopf"); await p.waitForTimeout(250);
      const m = await p.evaluate(() => { const e = document.getElementById("vtMeldung"); return e.hidden ? "" : e.textContent; });
      pruef(m.length > 10 && !/ok|grund|undefined|\{/.test(m), "Grund „" + g + "“ → ein Satz statt Rohtext", m);
    }
    /* Erfolg */
    await p.evaluate(() => { window.__rpcAntwort = { data:{ ok:true }, error:null }; window.__annahmen = [
      { art:"agb", fassung:"2026-10-26", angenommen_um:"2026-10-26T10:00:00Z" }, { art:"avv", fassung:"2026-10-26", angenommen_um:"2026-10-26T10:00:00Z" }]; });
    await p.click("#vtKnopf"); await p.waitForTimeout(400);
    const e = await p.evaluate(() => ({ aufruf: window.__rpc.filter(x => x.name === "vertrag_annehmen").pop(), annahme: document.getElementById("vtAnnahme").hidden,
      stand: document.getElementById("vtStand").textContent }));
    pruef(e.aufruf && e.aufruf.args.p_betrieb === "b1" && e.aufruf.args.p_agb === true && e.aufruf.args.p_avv === true && /^\d{4}-\d{2}-\d{2}$/.test(e.aufruf.args.p_fassung),
      "Aufruf trägt Betrieb, beide Häkchen und eine Fassung im Datumsformat", JSON.stringify(e.aufruf && e.aufruf.args));
    pruef(e.annahme && /Angenommen am/.test(e.stand), "danach: Stand mit Datum, Haken weg", e.stand);
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    /* Die Funktion gibt es noch nicht (404): kein Zwang, kein Absturz, das Konto bleibt bedienbar */
    const { ctx, p, fehler } = await kontoOeffnen(kopie);
    await p.evaluate(() => { window.__rpcWirft = true; });
    await p.click("#vtAgb"); await p.click("#vtAvv"); await p.click("#vtKnopf"); await p.waitForTimeout(300);
    const m = await p.evaluate(() => document.getElementById("vtMeldung").textContent);
    pruef(/noch nicht freigeschaltet/.test(m) && /wie bisher weiter/.test(m), "fehlende Funktion: Satz, Konto läuft weiter", m);
    pruef(await p.evaluate(() => !!document.querySelector('[data-blatt="uebersicht"]') && !document.getElementById("konto").hidden), "Konto bleibt offen (fail-open, §7)");
    await ctx.close();
    /* Die Tabelle gibt es noch nicht: Satz statt Haken */
    const k2 = await kontoOeffnen(kopie);
    await k2.p.evaluate(() => { window.__annahmenFehler = { message:"relation does not exist" }; });
    await k2.p.evaluate(() => vertraegeZeichnen()); await k2.p.waitForTimeout(300);
    const s = await k2.p.evaluate(() => ({ stand: document.getElementById("vtStand").textContent, annahme: document.getElementById("vtAnnahme").hidden }));
    pruef(/nicht möglich/.test(s.stand) && s.annahme, "Tabelle fehlt: Satz, keine Haken, kein Zwang", JSON.stringify(s));
    await k2.ctx.close();
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
  }
  fs.rmSync(kopie, { force: true });

  /* ══ R2 · Erzeuger --streng ══ */
  console.log("\n══ R2 · Erzeuger --streng (nur im Prüflauf) ══");
  {
    const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), "rp-"));
    for (const d of ["erzeuger", "vorlagen", "markenblaetter"]) fs.mkdirSync(path.join(wurzel, d));
    fs.copyFileSync(ERZEUGER, path.join(wurzel, "erzeuger", "erzeuge-hub.js"));
    fs.copyFileSync(path.join(OBEN, "erzeuger", "kompakt.js"), path.join(wurzel, "erzeuger", "kompakt.js"));
    fs.copyFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), path.join(wurzel, "vorlagen", "hub.vorlage.html"));
    const basis = JSON.parse(lies(path.join(OBEN, "markenblaetter", "chocolamour.json")));
    const lauf = (inhalt, args, ohne) => {
      const mb = Object.assign({}, basis, { betrieb: Object.assign({}, basis.betrieb, { slug: "probe" }) }, inhalt);
      (ohne || []).forEach(k => { delete mb[k]; });
      fs.writeFileSync(path.join(wurzel, "markenblaetter", "probe.json"), JSON.stringify(mb));
      const r = spawnSync("node", [path.join(wurzel, "erzeuger", "erzeuge-hub.js"), "probe", "--pruefen-nur"].concat(args), { encoding: "utf8" });
      return { code: r.status, text: r.stdout + r.stderr };
    };
    const echtOhne = { betrieb: Object.assign({}, basis.betrieb, { slug: "probe", mail: "", strasse: "" }), recht: {} };
    const a = lauf(echtOhne, ["--streng"], ["demo"]);
    pruef(a.code !== 0 && /\[streng\] recht\.firma fehlt/.test(a.text) && /\[streng\] Anschrift und E-Mail/.test(a.text), "echtes Haus ohne Anbieter, Anschrift, E-Mail: --streng lehnt ab", a.text.split("\n").filter(x => /FEHLER/.test(x)).join(" | ").slice(0, 160));
    const b = lauf(echtOhne, [], ["demo"]);
    pruef(b.code === 0 && /Hinweis: recht\.firma fehlt/.test(b.text), "ohne --streng (Netlify-Bau) bleibt es ein Hinweis — kein Hub geht vom Netz", b.text.slice(-160));
    const c = lauf({ recht: { firma: "Probe GmbH", rechtsform: "GmbH", vertreten: "A. Beispiel" }, betrieb: Object.assign({}, basis.betrieb, { slug: "probe", mail: "a@b.de", strasse: "Weg 1" }) }, ["--streng"], ["demo"]);
    pruef(c.code === 0, "vollständige Angaben: --streng geht durch (Voraussetzung der Gegenfälle)", c.text.slice(-200));
    const d = lauf(echtOhne, ["--streng"], []);
    const demoDa = !!basis.demo;
    const nord = JSON.parse(lies(path.join(OBEN, "markenblaetter", "nordstern.json")));
    pruef(!!nord.demo, "Voraussetzung: das Vorführhaus (Nordstern) trägt „demo“");
    fs.writeFileSync(path.join(wurzel, "markenblaetter", "probe.json"), JSON.stringify(Object.assign({}, nord, { betrieb: Object.assign({}, nord.betrieb, { slug: "probe", mail: "", strasse: "" }), recht: {} })));
    const e = spawnSync("node", [path.join(wurzel, "erzeuger", "erzeuge-hub.js"), "probe", "--pruefen-nur", "--streng"], { encoding: "utf8" });
    pruef(e.status === 0, "das Vorführhaus (demo) ist auch unter --streng erlaubt", (e.stdout + e.stderr).slice(-160));
    fs.rmSync(wurzel, { recursive: true, force: true });
  }

  /* ══ R3, R4, R8 · Hub ══ */
  console.log("\n══ R3/R4/R8 · Hub (Aktionspreis, Allergen-Satz, KI-Marke) ══");
  const AKTION = { id: "probe", gericht_name: "Dubai Crêpe", titel: null, preis_alt: 12.9, preis_neu: 8.9 };
  for (const slug of ["chocolamour", "blend"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const s = await ctx.newPage(); const fehler = [];
    s.on("pageerror", e => fehler.push(e.message));
    await s.route("**/*", r => { const u = r.request().url(); if (u.startsWith("file://")) return r.continue();
      if (/probe\.png/.test(u)) return r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
      return r.fulfill({ status: 200, contentType: "application/json", body: "[]" }); });
    await s.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); sessionStorage.setItem("omoteno-reise", "1"); } catch (e) {} });
    await s.goto("file://" + path.join(DIST, slug, "index.html") + "#/speisekarte");
    await s.waitForTimeout(1000);
    await s.evaluate(a => { aktionen = [Object.assign({}, a, { bis: new Date(Date.now() + 7200e3).toISOString() })]; zeichne(); }, AKTION);
    await s.waitForTimeout(400);
    const k = await s.evaluate(() => {
      const z = [...document.querySelectorAll(".gericht")].find(x => { const i = x.querySelector(".ginfo"); return i && decodeURIComponent(i.dataset.detail) === "Dubai Crêpe"; });
      if (!z) return null;
      const preis = z.querySelector(".gpz") || z;
      return { html: preis.innerHTML, text: preis.textContent, streich: !!z.querySelector("s, .palt, del"), prozent: /[%−]/.test(preis.textContent),
               marke: (z.querySelector(".tag.rabatt") || {}).textContent, neu: (z.querySelector(".p.pneu") || {}).textContent };
    });
    pruef(!!k, slug + ": Voraussetzung: das Gericht mit Aktion steht in der Karte");
    pruef(k && !k.streich && !k.prozent, slug + ": Karte zeigt weder durchgestrichenen Preis noch „−x %“", k && JSON.stringify({ streich: k.streich, text: k.text }));
    pruef(k && /8,90/.test(k.neu || "") && k.marke === "Aktion", slug + ": Aktionspreis 8,90 € und die Marke „Aktion“", k && (k.neu + " / " + k.marke));
    await s.evaluate(() => detailOeffnen("Dubai Crêpe")); await s.waitForTimeout(600);
    const d = await s.evaluate(() => { const w = document.getElementById("warenkarte"); return { text: w.innerText, streich: !!w.querySelector("s, .palt, del"), prozent: /[%−]\s?\d|\d\s?%/.test(w.innerText) }; });
    pruef(!d.streich && !d.prozent && /8,90/.test(d.text), slug + ": Detailblatt: nur der Aktionspreis", JSON.stringify({ streich: d.streich, prozent: d.prozent }));
    pruef(/vor der Bestellung/.test(d.text) && !/Gewähr/.test(d.text) && /stammen vom Betrieb/.test(d.text), slug + ": Allergen-Satz ohne „Gewähr“, mit „vor der Bestellung“", d.text.split("\n").filter(x => /Allergien/.test(x)).join(" ").slice(0, 160));
    await s.evaluate(() => detailSchliessen()); await s.waitForTimeout(500);

    /* R4: der Satz hat in jeder Sprache einen Eintrag, ohne „Gewähr“-Entsprechung zu behalten (zweite Quelle: TEXTE) */
    const sprachen = await s.evaluate(() => { const e = TEXTE["Bei Allergien oder Unverträglichkeiten fragen Sie bitte vor der Bestellung unser Serviceteam. Die Angaben zu Allergenen und Zusatzstoffen stammen vom Betrieb."];
      return e ? Object.keys(e).sort().join(",") : null; });
    pruef(sprachen === "ar,en,es,fr,it,nl,pl,ro,ru,tr,uk", slug + ": Allergen-Satz in allen elf Sprachen", sprachen);

    /* R8: KI-Marke */
    const marke = async (ki) => s.evaluate(([k]) => { const g = findeGericht("Dubai Crêpe"); g.bild = "probe.png"; delete g.bf; if (k === undefined) delete g.ki; else g.ki = k;
      detailOeffnen("Dubai Crêpe"); return null; }, [ki]).then(async () => { await s.waitForTimeout(700);
        const r = await s.evaluate(() => { const m = document.querySelector("#warenkarte .wki"); if (!m) return null;
          const cs = getComputedStyle(m), q = m.getBoundingClientRect(), b = document.querySelector("#warenkarte .wbild").getBoundingClientRect();
          return { text: m.textContent, sicht: cs.visibility, innen: q.left >= b.left && q.right <= b.right && q.top >= b.top && q.bottom <= b.bottom + 1, bg: cs.backgroundColor, fg: cs.color, fingerfrei: cs.pointerEvents }; });
        await s.evaluate(() => detailSchliessen()); await s.waitForTimeout(500); return r; });
    const mit = await marke(1);
    pruef(mit && mit.text === "KI-bearbeitet" && mit.innen && mit.sicht === "visible" && mit.fingerfrei === "none", slug + ": KI-Marke im Detailblatt, im Bild, fängt keinen Tipp", JSON.stringify(mit));
    if (mit) {
      const zahl = t => (String(t).match(/[\d.]+/g) || []).map(Number);
      const bg = zahl(mit.bg), fg = zahl(mit.fg);
      const misch = (o, u) => [0, 1, 2].map(i => o[i] * (o[3] === undefined ? 1 : o[3]) + u[i] * (1 - (o[3] === undefined ? 1 : o[3])));
      const kanal = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
      const L = p => .2126 * kanal(p[0]) + .7152 * kanal(p[1]) + .0722 * kanal(p[2]);
      const auf = misch(bg, [255, 255, 255]);   // schlechtester Fall: rein weißes Foto
      const v = (Math.max(L(fg), L(auf)) + .05) / (Math.min(L(fg), L(auf)) + .05);
      pruef(v >= 4.5, slug + ": Marke auf rein weißem Foto ≥ 4,5:1", v.toFixed(2));
    }
    pruef((await marke(undefined)) === null, slug + ": ohne Feld (Spalte noch nicht da) keine Marke");
    pruef((await marke(0)) === null, slug + ": ki nicht gesetzt (false) → keine Marke");
    const roh = await s.evaluate(() => { const z = { bild_ki: "true" }; return z.bild_ki === true; });
    pruef(roh === false, slug + ": Voraussetzung der nächsten Zeile: die Zeichenkette „true“ ist nicht true");
    pruef(/if\(z\.bild_ki === true\) e\.ki = 1;/.test(lies(path.join(OBEN, "vorlagen", "hub.vorlage.html"))), slug + ": Hub liest bild_ki nur als echtes true (Zeichenkette zählt nicht)");
    pruef(!fehler.length, slug + ": keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }

  /* ══ R5, R7, R11 · Seiten ══ */
  console.log("\n══ R5/R7/R11 · Landingpage, Datenschutz, Impressum, Nachweis ══");
  const web = lies(path.join(SEITEN, "omoteno-web.html")), webT = text(web);
  pruef(!/class="beleg">\s*DSGVO\s*</.test(web) && /AV-Vertrag inklusive/.test(web), "Landingpage: keine „DSGVO“-Plakette (unbelegte Konformität), stattdessen „AV-Vertrag inklusive“");
  pruef(!/146a|keine TSE|Kassenfunktion nach/.test(webT), "Landingpage: keine Aussage zu § 146a AO / TSE (nicht bestätigt, passt nicht zur Online-Zahlung)");
  pruef(/Omoteno ersetzt deine Kasse nicht/.test(webT), "Landingpage: „Omoteno ersetzt deine Kasse nicht“");
  pruef(/Ab 79 € netto im Monat/.test(web) && /nur an Unternehmer|ausschließlich an Unternehmer/.test(webT), "Landingpage: „netto“ im Meta-Text und „ausschließlich an Unternehmer“ im Preisfuß");
  pruef(!/Server in Frankfurt/.test(web) && /Datenbank in Frankfurt/.test(web), "Landingpage: „Datenbank in Frankfurt“ statt „Server“ (Netlify liefert weltweit aus)");
  pruef(/Stripe Payments Europe/.test(text(lies(path.join(SEITEN, "datenschutz.html")))), "Datenschutzerklärung nennt Stripe als Empfänger");
  const imp = text(lies(path.join(SEITEN, "impressum.html")));
  pruef(!/unterliegen dem deutschen Urheberrecht/.test(imp) && /Soweit\s+daran Urheber- oder sonstige Schutzrechte bestehen/.test(imp), "Impressum: Urheberrecht ohne Schutzbehauptung (R11)");
  pruef(fs.existsSync(path.join(OBEN, "dokumente", "entwicklungsnachweis.md")) && /Wer was tut/.test(lies(path.join(OBEN, "dokumente", "entwicklungsnachweis.md"))), "Entwicklungsnachweis liegt vor");
  pruef(fs.existsSync(path.join(OBEN, "dokumente", "urhebervermerk.txt")) && /nicht abschließend geklärt/.test(lies(path.join(OBEN, "dokumente", "urhebervermerk.txt"))), "Urhebervermerk ohne Schutzbehauptung liegt vor");
  pruef(!fs.existsSync(path.join(OBEN, "LICENSE")), "Wurzelverzeichnis bleibt, wie CLAUDE.md es verlangt (kein LICENSE dort)");

  /* ══ R8 Board · R9 ══ */
  console.log("\n══ R8/R9 · Board ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
    const p = await ctx.newPage(); const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + ADMIN); await p.waitForTimeout(700);
    await p.evaluate(() => { document.getElementById("tor").hidden = true; if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); } });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const mw = document.getElementById("lfMehrweg");
      return { mehrweg: mw ? mw.textContent.replace(/\s+/g, " ") : null, inGruppe: !!(mw && mw.closest(".egruppe") && /Lieferung/.test(mw.closest(".egruppe").querySelector(".etitel").textContent)),
               ohneSpalte: bildKiSpalteDa(), mitSpalte: (() => { const alt = gerichte; gerichte = [{ id: 1, name: "x", bild_ki: false }]; const w = bildKiSpalteDa(); gerichte = alt; return w; })() };
    });
    pruef(r.mehrweg && /§§ 33, 34 VerpackG/.test(r.mehrweg) && /fünf Beschäftigten/.test(r.mehrweg) && /80 m²/.test(r.mehrweg) && /LUCID/.test(r.mehrweg) && r.inGruppe,
      "Gruppe Lieferung: Mehrweg-Hinweis mit Ausnahme (5 Beschäftigte, 80 m²) und LUCID", r.mehrweg && r.mehrweg.slice(0, 80));
    pruef(r.ohneSpalte === false && r.mitSpalte === true, "Board schickt bild_ki nur, wenn die Spalte in den gelesenen Zeilen vorkommt", JSON.stringify({ ohne: r.ohneSpalte, mit: r.mitSpalte }));
    const admin = lies(ADMIN);
    pruef(/if\(bildKiSpalteDa\(\)\) satz\.bild_ki = \$\("#fBildKi"\)\.value === "1";/.test(admin), "Gericht-Blatt: bild_ki wird nur mit Spalte in den Satz gelegt");
    pruef(/bkErgebnis\.profi;\s*\n\s*\$\("#fBildKi"\)\.value = "1";/.test(admin) && /bkErgebnis\.frei;\s*\n\s*\$\("#fBildKi"\)\.value = "1";/.test(admin), "Profi-Foto UND Freisteller übernehmen setzen die Kennzeichnung");
    pruef(/\$\("#fBild"\)\.value = data\.publicUrl;\s*\n\s*\$\("#fBildKi"\)\.value = "";/.test(admin), "ein neu hochgeladenes Foto nimmt die Kennzeichnung wieder weg");
    pruef(!fehler.length, "keine Ausnahme im Board", fehler.join("|") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  console.log(f ? f + " FEHLER" : "Alles sauber.");
  process.exit(f ? 1 : 0);
})();
