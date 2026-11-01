/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Newsletter-Varianten (klassisch, kampagne, liefer, edel)

   Wunsch 31.10.: Newsletter nach dem Muster von McDonald's/Lieferando,
   zwischen Varianten wechseln, im Board steuern. Geprüft wird:
   1 · Der geteilte Block NEWSLETTER-VARIANTEN steht Zeichen für Zeichen
       gleich in erzeuger/newsletter-varianten.js und seiten/admin.html.
   2 · „klassisch“ ist bytegleich mit der Vorlage von vorher (zweite Quelle:
       der Erzeuger aus git, Stand 7a7a08b) — fünf Häuser, beide Arten.
   3 · Jede Variante × Art × Haus: Pflicht-Tags (Code DIESES Hauses,
       Abmeldelink), nichts Ausführbares, Bilder nur https; gerendert bei
       360 und 600 px: kein Überlauf, jede Schrift ≥ 4,5:1 auf ihrem Grund.
   4 · Eingeschleustes: Gerichtname <img onerror>, Bild mit Anführungszeichen,
       http-Bild, javascript: → nichts davon kommt als Auszeichnung heraus.
   5 · Board (gestelltes db über betriebWaehlen()): vier Karten, gespeicherte
       Wahl markiert, Tipp ändert die Vorschau, „Übernehmen“ liest frisch und
       schreibt hub_stil ZUSAMMENGEFÜHRT (Nachbarn bleiben), ruft die Funktion
       mit beiden Mails, Satz je Ausgang; ungelesen gesperrt; 0 Zeilen →
       „Nur der Besitzer“; Tapflächen ≥ 44 px; Vorschau ist ein Rahmen ohne Skript.
   6 · Edge Function newsletter-vorlage-setzen (echte index.ts, gestelltes
       Deno/fetch/supabase-js): kein Inhaber → kein Klaviyo-Aufruf; Mail ohne
       Code-Tag / mit <script> / mit on…= → ungueltig; ohne Schlüssel →
       kein_schluessel; sonst PATCH je Vorlage mit dem richtigen HTML.
   Ehrliche Grenze: kein Lauf gegen Klaviyo; ob Klaviyo die Vorlage annimmt und
   ob die Flow-Mail damit wechselt, zeigt nur der echte Aufruf.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");
const { chromium } = require("playwright");
const ts = require("typescript");
const { gruppeZu } = require("./werkzeug/zentrale.js");

const OBEN = path.join(__dirname, "..");
const MODUL = process.env.NL_MODUL || path.join(OBEN, "erzeuger", "newsletter-varianten.js");
const ADMIN = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");
const EDGE = process.env.NL_EDGE || path.join(OBEN, "supabase", "functions", "newsletter-vorlage-setzen", "index.ts");
const HAEUSER = ["chocolamour", "blend", "minhkeey", "nordstern", "piugusto"];
let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if(!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + String(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 220) : "")); };

const N = require(MODUL);
const marke = h => JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", h + ".json"), "utf8"));
const BILD = "https://bilder.omoteno.de/probe/";
const GERICHTE = [
  { name: "Waffel Classic", preis: 8.5, bild: BILD + "gericht.jpg", beliebt: true },
  { name: "Dubai Crêpe", preis: "11,90", bild: BILD + "karte.jpg" },
  { name: "Heiße Schokolade", preis: 4.9 }
];

/* ── 1 · Block ───────────────────────────────────────────────────── */
function blockTeil(t){ const a = t.indexOf("/* ╔═══ NEWSLETTER-VARIANTEN · GETEILTER BLOCK · ANFANG"), e = t.indexOf("/* ╚═══ NEWSLETTER-VARIANTEN · GETEILTER BLOCK · ENDE");
  return a < 0 || e < 0 ? null : t.slice(a, t.indexOf("\n", e)); }
console.log("\n══ 1 · Der geteilte Block ══");
{
  const m = blockTeil(fs.readFileSync(MODUL, "utf8")), b = blockTeil(fs.readFileSync(ADMIN, "utf8"));
  pruef(!!m && !!b, "der Block steht im Modul und im Board");
  pruef(m === b, "Modul und Board Zeichen für Zeichen gleich", m && b && m !== b ? "ab Zeichen " + [...m].findIndex((c, i) => c !== b[i]) : "gleich");
  pruef(JSON.stringify(N.VARIANTEN.map(v => v.id)) === JSON.stringify(["klassisch", "kampagne", "liefer", "edel"]), "vier Varianten, klassisch zuerst (Vorgabe)", N.VARIANTEN.map(v => v.id));
  pruef(N.varianteSauber("__proto__") === "klassisch" && N.varianteSauber('kampagne"') === "klassisch" && N.varianteSauber(undefined) === "klassisch" && N.varianteSauber("edel") === "edel",
    "Positivliste: Unbekanntes, Anführungszeichen, __proto__ → klassisch");
  const edge = fs.readFileSync(EDGE, "utf8");
  const ev = (edge.match(/const VARIANTEN = \[([^\]]+)\]/) || [])[1] || "";
  pruef(ev.split(",").map(x => x.trim().replace(/"/g, "")).join(",") === N.VARIANTEN.map(v => v.id).join(","), "die Edge Function kennt dieselben Varianten (Naht)", ev);
}

/* ── 2 · klassisch bytegleich ────────────────────────────────────── */
console.log("\n══ 2 · klassisch = die Vorlage von vorher ══");
{
  let alt = "";
  try{ alt = execSync("git show 7a7a08b:erzeuger/erzeuge-newsletter-vorlage.js", { cwd: OBEN, encoding: "utf8" }); }catch(e){}
  pruef(alt.includes("function vorlageBauen"), "Voraussetzung: die frühere Vorlage ist aus git lesbar");
  if(alt){
    const a = alt.indexOf("function vorlageBauen(m, slug, art){"), b = alt.indexOf("function einen(slug, art){");
    const vorher = new Function("m", "slug", "art", alt.slice(a, b) + ";return vorlageBauen(m,slug,art);");
    for(const h of HAEUSER) for(const art of ["gutschein", "rueckholung"]){
      const x = vorher(marke(h), h, art), y = N.bauen(marke(h), h, art, "klassisch", GERICHTE);
      pruef(x === y, h + " · " + art + ": klassisch bytegleich", x === y ? x.length + " Zeichen" : "erste Abweichung bei " + [...x].findIndex((c, i) => c !== y[i]));
    }
  }
}

/* ── 3/4 · Inhalt, Sicherheit ───────────────────────────────────── */
console.log("\n══ 3 · Pflicht-Tags, nichts Ausführbares, nur https ══");
const alle = [];
for(const h of HAEUSER) for(const v of N.VARIANTEN) for(const art of N.ARTEN){
  const html = N.bauen(marke(h), h, art, v.id, GERICHTE);
  alle.push({ h, v: v.id, art, html });
}
{
  const fehl = alle.filter(x => !x.html.includes(`{% coupon_code '${x.h}_newsletter' %}`) || !/\{% unsubscribe '[^']+' %\}/.test(x.html));
  pruef(!fehl.length, "jede Mail (" + alle.length + ") trägt den Code DIESES Hauses und den Abmeldelink", fehl.map(x => x.h + "/" + x.v + "/" + x.art));
  const ruck = alle.filter(x => x.art === "rueckholung" && x.v !== "klassisch" && !x.html.includes(`{% if person|lookup:'omoteno_${x.h}_liebling' %}`));
  pruef(!ruck.length, "„Wir vermissen Sie“: das Lieblingsgericht steht in jeder neuen Variante, nur im {% if %}", ruck.map(x => x.h + "/" + x.v));
  const boes = alle.filter(x => /<script\b|\son[a-z]+\s*=|javascript:/i.test(x.html));
  pruef(!boes.length, "keine Mail enthält <script>, on…= oder javascript:", boes.map(x => x.h + "/" + x.v));
  const src = alle.flatMap(x => [...x.html.matchAll(/<img[^>]+src="([^"]*)"/g)].map(m => m[1]));
  pruef(src.length > 10 && src.every(u => u.startsWith("https://")), "Bilder nur über https (" + src.length + " Bilder)", src.filter(u => !u.startsWith("https://")));
  const neueOhneBild = alle.filter(x => x.v === "kampagne" && !x.html.includes(BILD + "gericht.jpg"));
  pruef(!neueOhneBild.length, "Voraussetzung: die Probe-Gerichte erscheinen (sonst prüfte 4 nichts)", neueOhneBild.length);
}
console.log("\n══ 4 · Eingeschleustes ══");
const giftMails = [];
{
  const gift = [
    { name: '<img src=x onerror="window.__x=1">', preis: 5, bild: BILD + 'a.jpg" onerror="window.__x=2', beliebt: true },
    { name: 'Probe" onerror="window.__x=3', preis: 4, bild: BILD + "gift.jpg", beliebt: true },
    { name: "Normal", preis: "<b>9</b>", bild: "http://unsicher.example/b.jpg" },
    { name: "Link", preis: 3, bild: "javascript:alert(1)" }
  ];
  for(const v of N.VARIANTEN){
    const html = N.bauen(marke("chocolamour"), "chocolamour", "gutschein", v.id, gift);
    giftMails.push({ v: v.id, html });
    // Textebene: kein fremdes Bild, kein javascript:, kein Preis als Auszeichnung.
    // Ob ein Name zum Tag/Attribut wird, misst giftDom() am geparsten DOM — ein
    // Textmuster trennt „steht maskiert im alt-Wert“ nicht von „echtes Attribut“.
    pruef(!/http:\/\/unsicher/.test(html) && !/javascript:/i.test(html) && !/<b>9<\/b>/.test(html),
      v.id + ": kein http-Bild, kein javascript:, Preis nie als Auszeichnung");
    if(v.id === "kampagne" || v.id === "liefer") pruef(html.includes("&lt;img src=x onerror="), v.id + ": Voraussetzung: der vergiftete Name kommt als Text an");
  }
  const slugGift = N.bauen(marke("chocolamour"), "x' %}{% evil", "gutschein", "kampagne", []);
  pruef(!/\{% evil/.test(slugGift), "ein Slug mit Klaviyo-Syntax wird bereinigt");
}

/* ── 4b · Eingeschleustes am geparsten DOM ──────────────────────── */
async function giftDom(browser){
  console.log("\n══ 4b · Eingeschleustes am geparsten DOM ══");
  const p = await browser.newPage();
  await p.route("**/*", r => r.request().url().startsWith("about:") ? r.continue() : r.abort());
  for(const x of giftMails){
    await p.setContent(x.html, { waitUntil: "load" });
    const m = await p.evaluate(() => ({
      on: [...document.querySelectorAll("*")].filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).map(e => e.outerHTML.slice(0, 80)),
      fremd: [...document.images].map(i => i.getAttribute("src")).filter(s => !/^https:\/\//.test(s || "")),
      lief: typeof window.__x !== "undefined",
      fett: document.querySelectorAll("b").length,
      alt: [...document.images].map(i => i.alt).filter(a => a.includes("onerror"))
    }));
    pruef(!m.on.length && !m.fremd.length && !m.lief && !m.fett, x.v + ": im DOM kein on…-Attribut, kein fremdes Bild, nichts ausgeführt", m);
    if(x.v === "edel") pruef(m.alt.length === 1 && m.alt[0] === 'Probe" onerror="window.__x=3', "edel: Voraussetzung: der vergiftete Name steht als alt-Text des Fotos", m.alt);
  }
  await p.close();
}

/* ── 3b · Gerendert: Überlauf und Kontrast ──────────────────────── */
async function gerendert(browser){
  console.log("\n══ 3b · Gerendert: 360 und 600 px, Kontrast ≥ 4,5:1 ══");
  for(const breite of [360, 600]){
    const ctx = await browser.newContext({ viewport: { width: breite, height: 900 } });
    const p = await ctx.newPage();
    await p.route("**/*", r => { const u = r.request().url();
      if(u.startsWith(BILD)) return r.fulfill({ path: path.join(__dirname, "werkzeug", "testbilder", u.slice(BILD.length).replace(/[^a-z.-]/g, "") || "gericht.jpg") });
      return u.startsWith("about:") || u.startsWith("data:") ? r.continue() : r.abort(); });
    const ueber = [], schwach = [];
    for(const x of alle){
      await p.setContent(N.vorschau(x.html), { waitUntil: "load" });
      const m = await p.evaluate(() => {
        const lum = c => { const v = c.slice(0, 3).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
        const rgb = s => { const m = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/.exec(s); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
        const grund = e => { for(let k = e; k; k = k.parentElement){ const c = rgb(getComputedStyle(k).backgroundColor); if(c && c[3] > .5) return c; } return [255, 255, 255, 1]; };
        const schlecht = [];
        document.querySelectorAll("body *").forEach(e => {
          const eigen = [...e.childNodes].some(t => t.nodeType === 3 && t.textContent.trim().length > 1);
          if(!eigen) return; const cs = getComputedStyle(e); if(cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < .1) return;
          if(e.closest('[style*="display:none"]')) return;
          const a = rgb(cs.color), b = grund(e); if(!a) return;
          const [h, d] = [lum(a), lum(b)].sort((x, y) => y - x), r = (h + .05) / (d + .05);
          if(r < 4.5) schlecht.push(e.textContent.trim().slice(0, 30) + " " + r.toFixed(2));
        });
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, schlecht };
      });
      if(m.sw > m.cw + 1) ueber.push(x.h + "/" + x.v + "/" + x.art + " " + m.sw);
      if(m.schlecht.length) schwach.push(x.h + "/" + x.v + "/" + x.art + ": " + m.schlecht.slice(0, 2).join(" | "));
    }
    pruef(!ueber.length, breite + " px: keine Mail läuft seitlich über (" + alle.length + " Mails)", ueber.slice(0, 4));
    pruef(!schwach.length, breite + " px: jede Schrift ≥ 4,5:1 auf ihrem Grund", schwach.slice(0, 4));
    await ctx.close();
  }
}

/* ── 5 · Board ───────────────────────────────────────────────────── */
function stelleDb(){
  return ({ stil, zeilen, funktion }) => {
    window.__a = { update: [], invoke: [], gelesen: 0 };
    let gespeichert = JSON.parse(JSON.stringify(stil));
    const MB = { betrieb: { name: "Probe" }, farben: { grund: "#F7F1EA", flaeche: "#FFFFFF", flaeche2: "#F4EBE3", band: "#2A1A14", bandText: "#FFFFFF", tinte: "#2A1A14", tinteLeise: "#6E5A50", akzent: "#C8202E" } };
    function ergebnis(z){
      if(z.tab === "betrieb_mitglieder") return { data: [{ rolle: "inhaber", betriebe: { id: "b-probe", slug: "chocolamour", name: "Probe", bestell_pause: false,
        newsletter_aktiv: true, hub_texte: {}, hub_stil: gespeichert, markenblatt: MB } }], error: null };
      if(z.tab === "betriebe" && z.update){ window.__a.update.push(z.update); if(zeilen === 0) return { data: [], error: null }; gespeichert = z.update.hub_stil; return { data: [{ id: "b-probe" }], error: null }; }
      if(z.tab === "betriebe" && z.einzeln){ window.__a.gelesen++; return { data: { hub_stil: gespeichert }, error: null }; }
      return { data: z.einzeln ? null : [], error: null, count: 0 };
    }
    function kette(tab){
      const z = { tab, einzeln: false, update: null };
      const p = new Proxy(function(){}, { get(_, k){
        if(k === "then") return res => res(ergebnis(z));
        return (...a) => { if(k === "maybeSingle" || k === "single") z.einzeln = true; if(k === "update") z.update = a[0]; return p; };
      }, apply(){ return p; } });
      return p;
    }
    db = { from: kette, rpc: () => kette("rpc"), channel: () => kette("kanal"), removeChannel: async () => {}, storage: { from: () => kette("speicher") },
      functions: { invoke: async (name, o) => { window.__a.invoke.push({ name, body: o && o.body });
        if(name === "newsletter-vorlage-setzen") return funktion === "fehlt" ? { data: null, error: { message: "404" } } : { data: funktion, error: null };
        return { data: null, error: null }; } },
      auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: { id: "u1", email: "probe@example.org" } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }) } };
    demo = false;
  };
}
async function board(browser, fall){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const p = await ctx.newPage(), fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + ADMIN); await p.waitForTimeout(600);
  await p.evaluate(stelleDb(), fall);
  await p.evaluate(async () => { document.getElementById("tor").hidden = true; try{ localStorage.setItem(merkSchluessel(), "b-probe"); }catch(e){} await betriebWaehlen(); tafelZeigen("einstellungen"); });
  await p.waitForTimeout(400);
  const offen = await gruppeZu(p, "#nlvZeile");
  return { ctx, p, fehler, offen };
}
async function boardProbe(browser){
  console.log("\n══ 5 · Board ══");
  const { ctx, p, fehler, offen } = await board(browser, { stil: { emoji: false, newsletter: { variante: "liefer" } }, zeilen: 1, funktion: { ok: true, ersetzt: 2 } });
  pruef(offen, "Voraussetzung: die Gruppe „Gäste-Newsletter“ öffnet über ihre Kachel");
  const s = await p.evaluate(() => ({ karten: [...document.querySelectorAll("#nlvWahl [data-nlv]")].map(k => [k.dataset.nlv, k.getAttribute("aria-checked"), Math.round(k.getBoundingClientRect().height)]),
    vorschau: document.getElementById("nlvVorschau").srcdoc.length, sandbox: document.getElementById("nlvVorschau").getAttribute("sandbox"),
    hatPersoenlich: /So lösen Sie ihn ein/.test(document.getElementById("nlvVorschau").srcdoc), uebernehmen: !document.getElementById("nlvUebernehmen").disabled,
    art: [...document.querySelectorAll("[data-nlv-art]")].map(k => Math.round(k.getBoundingClientRect().height)) }));
  pruef(s.karten.length === 4 && s.karten.filter(k => k[1] === "true").map(k => k[0]).join() === "liefer", "vier Karten, die gespeicherte Wahl („liefer“) ist markiert", s.karten);
  pruef(s.karten.every(k => k[2] >= 44) && s.art.every(h => h >= 44), "jede Karte und jeder Umschalter ≥ 44 px", s);
  pruef(s.vorschau > 1000 && s.hatPersoenlich && s.sandbox === "", "die Vorschau zeigt die gespeicherte Vorlage, in einem Rahmen ohne Skript (sandbox)", s);
  pruef(s.uebernehmen, "gelesener Stand: „Übernehmen“ ist frei");
  /* Wahl → Vorschau */
  await p.click('[data-nlv="kampagne"]'); await p.waitForTimeout(100);
  const k = await p.evaluate(() => ({ an: document.querySelector('[data-nlv="kampagne"]').getAttribute("aria-checked"), v: document.getElementById("nlvVorschau").srcdoc }));
  pruef(k.an === "true" && /Ein Geschenk für Ihren nächsten Besuch/.test(k.v) && !/\{% coupon_code/.test(k.v), "Tipp auf „Kampagne“ markiert sie, die Vorschau wechselt und zeigt Beispielwerte statt Klaviyo-Tags");
  await p.click('[data-nlv-art="rueckholung"]'); await p.waitForTimeout(100);
  pruef(await p.evaluate(() => /Wir haben Ihren Platz frei gehalten/.test(document.getElementById("nlvVorschau").srcdoc)), "Umschalter „Wir vermissen Sie“ zeigt die zweite Mail");
  /* Übernehmen */
  await p.click("#nlvUebernehmen"); await p.waitForTimeout(400);
  const a = await p.evaluate(() => ({ a: window.__a, satz: document.getElementById("nlvSatz").textContent }));
  const up = a.a.update[0] || {}, inv = a.a.invoke.find(x => x.name === "newsletter-vorlage-setzen") || {};
  pruef(a.a.gelesen >= 1, "vor dem Schreiben wird frisch gelesen (§8.1m)", a.a.gelesen);
  pruef(up.hub_stil && up.hub_stil.newsletter && up.hub_stil.newsletter.variante === "kampagne" && up.hub_stil.emoji === false && Object.keys(up).join() === "hub_stil",
    "geschrieben wird NUR hub_stil, zusammengeführt (emoji bleibt), mit newsletter.variante = kampagne", up);
  pruef(inv.body && inv.body.variante === "kampagne" && /\{% coupon_code 'chocolamour_newsletter' %\}/.test(inv.body.html.gutschein) && /Wir haben Ihren Platz/.test(inv.body.html.rueckholung),
    "die Funktion bekommt beide Mails mit echten Klaviyo-Tags (nicht die Vorschau)", inv.body && Object.keys(inv.body));
  pruef(/in Klaviyo übernommen \(2 Vorlagen\)/.test(a.satz), "Satz: gespeichert und in Klaviyo übernommen", a.satz);
  pruef(!fehler.length, "keine Skriptfehler", fehler);
  await ctx.close();
  /* Funktion fehlt → Satz, Wahl trotzdem gespeichert */
  {
    const b = await board(browser, { stil: {}, zeilen: 1, funktion: "fehlt" });
    await b.p.click('[data-nlv="edel"]'); await b.p.click("#nlvUebernehmen"); await b.p.waitForTimeout(400);
    const r = await b.p.evaluate(() => ({ satz: document.getElementById("nlvSatz").textContent, up: window.__a.update.length }));
    pruef(r.up === 1 && /gespeichert/.test(r.satz) && /HTML kopieren/.test(r.satz), "Funktion fehlt: Wahl gespeichert, Satz nennt den Ersatzweg „HTML kopieren“", r);
    await b.ctx.close();
  }
  /* 0 Zeilen (RLS) → kein Erfolg, keine Funktion */
  {
    const b = await board(browser, { stil: {}, zeilen: 0, funktion: { ok: true, ersetzt: 2 } });
    await b.p.click('[data-nlv="edel"]'); await b.p.click("#nlvUebernehmen"); await b.p.waitForTimeout(400);
    const r = await b.p.evaluate(() => ({ satz: document.getElementById("nlvSatz").textContent, inv: window.__a.invoke.filter(x => x.name === "newsletter-vorlage-setzen").length }));
    pruef(/Nur der Besitzer/.test(r.satz) && r.inv === 0, "0 Zeilen geschrieben: „Nur der Besitzer“, Klaviyo wird nicht gerufen (§2.3b)", r);
    await b.ctx.close();
  }
  /* ungelesen gesperrt */
  {
    const b = await board(browser, { stil: {}, zeilen: 1, funktion: { ok: true } });
    const r = await b.p.evaluate(() => { nlvStand = undefined; nlvZeichnen(); return document.getElementById("nlvUebernehmen").disabled; });
    pruef(r === true, "ohne gelesenen Stand ist „Übernehmen“ gesperrt (§8.1m)");
    await b.ctx.close();
  }
}

/* ── 6 · Edge Function ───────────────────────────────────────────── */
async function edgeProbe(){
  console.log("\n══ 6 · Edge Function newsletter-vorlage-setzen ══");
  const js = ts.transpileModule(fs.readFileSync(EDGE, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  async function lauf({ inhaber, schluessel, flows, koerper }){
    const rufe = [];
    let handler = null;
    const kette = tab => { const z = { tab }; const p = new Proxy(function(){}, { get(_, k){
      if(k === "then") return res => res(tab === "klaviyo_flows" ? { data: flows } : { data: { slug: "chocolamour" } });
      return () => p; }, apply(){ return p; } }); return p; };
    const klient = { rpc: async (name) => { rufe.push("rpc:" + name); return { data: inhaber, error: null }; }, from: tab => { rufe.push("from:" + tab); return kette(tab); } };
    const exp = {};
    const raum = { exports: exp, module: { exports: exp }, require: () => ({ createClient: () => klient }),
      Deno: { env: { get: k => ({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", KLAVIYO_API_KEY: schluessel ? "pk_geheim" : "" })[k] }, serve: h => { handler = h; } },
      fetch: async (url, opt) => { rufe.push({ url: String(url), opt }); return new Response("{}", { status: 200 }); },
      Response, Request, Headers, URL, JSON, console: { error(){}, log(){} }, Math, Number, Array, String, Object, Promise, Error, RegExp };
    vm.createContext(raum); vm.runInContext(js, raum);
    const r = await handler(new Request("https://x.supabase.co/functions/v1/newsletter-vorlage-setzen", { method: "POST", headers: { authorization: "Bearer t" }, body: JSON.stringify(koerper) }));
    return { a: await r.json(), rufe, exp };
  }
  const html = { gutschein: N.bauen(marke("chocolamour"), "chocolamour", "gutschein", "kampagne", GERICHTE), rueckholung: N.bauen(marke("chocolamour"), "chocolamour", "rueckholung", "kampagne", GERICHTE) };
  const ID = "11111111-2222-4333-8444-555555555555", FL = [{ art: "willkommen", vorlage_id: "RjSG5g" }, { art: "rueckholung", vorlage_id: "X8LYv4" }, { art: "willkommen", vorlage_id: "bad id\"" }];
  const ok = await lauf({ inhaber: true, schluessel: true, flows: FL, koerper: { betrieb_id: ID, variante: "kampagne", html } });
  const patches = ok.rufe.filter(x => typeof x === "object");
  pruef(ok.a.ok === true && ok.a.ersetzt === 2 && patches.length === 2, "Inhaber mit Schlüssel: genau zwei Vorlagen ersetzt (die ungültige ID nicht angefasst)", ok.a);
  pruef(patches.every(x => x.opt.method === "PATCH" && /^https:\/\/a\.klaviyo\.com\/api\/templates\/(RjSG5g|X8LYv4)\/$/.test(x.url)), "PATCH an /api/templates/<id>/", patches.map(x => x.url));
  const b1 = JSON.parse(patches.find(x => x.url.includes("RjSG5g")).opt.body), b2 = JSON.parse(patches.find(x => x.url.includes("X8LYv4")).opt.body);
  pruef(b1.data.attributes.html === html.gutschein && b2.data.attributes.html === html.rueckholung, "Willkommen bekommt die Gutschein-Mail, Rückholung die Rückhol-Mail");
  const fremd = await lauf({ inhaber: false, schluessel: true, flows: FL, koerper: { betrieb_id: ID, variante: "kampagne", html } });
  pruef(fremd.a.grund === "kein_zugriff" && !fremd.rufe.some(x => typeof x === "object"), "kein Inhaber: kein_zugriff, kein einziger Aufruf an Klaviyo", fremd.a);
  for(const [name, boes] of [["ohne Code-Tag", html.gutschein.replace(/\{% coupon_code[^%]*%\}/, "CODE")], ["mit <script>", html.gutschein.replace("</body>", "<script>x()</script></body>")],
    ["mit onerror=", html.gutschein.replace("<table", '<table onerror="x()"')], ["Code eines anderen Hauses", html.gutschein.replace(/chocolamour_newsletter/g, "blend_newsletter")], ["zu groß", html.gutschein + "x".repeat(100001)]]){
    const r = await lauf({ inhaber: true, schluessel: true, flows: FL, koerper: { betrieb_id: ID, variante: "kampagne", html: { gutschein: boes, rueckholung: html.rueckholung } } });
    pruef(r.a.grund === "ungueltig" && !r.rufe.some(x => typeof x === "object"), "Mail " + name + " → ungueltig, nichts an Klaviyo", r.a);
  }
  const v = await lauf({ inhaber: true, schluessel: true, flows: FL, koerper: { betrieb_id: ID, variante: "__proto__", html } });
  pruef(v.a.grund === "ungueltig", "unbekannte Variante → ungueltig", v.a);
  const k = await lauf({ inhaber: true, schluessel: false, flows: FL, koerper: { betrieb_id: ID, variante: "edel", html } });
  pruef(k.a.grund === "kein_schluessel" && !k.rufe.some(x => typeof x === "object"), "ohne Klaviyo-Schlüssel: kein_schluessel", k.a);
  const leer = await lauf({ inhaber: true, schluessel: true, flows: [], koerper: { betrieb_id: ID, variante: "edel", html } });
  pruef(leer.a.grund === "keine_vorlagen", "ohne eingetragene Abläufe: keine_vorlagen", leer.a);
}

(async () => {
  const browser = await chromium.launch();
  await giftDom(browser);
  await gerendert(browser);
  await boardProbe(browser);
  await browser.close();
  await edgeProbe();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
