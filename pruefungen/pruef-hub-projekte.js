/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Hub-Projekte im Board (sichern, laden, umbenennen, entfernen)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-hub-projekte.js

   > Anlass (17.10.). „Man soll auch seine Hubs wie Projekte
   > zwischenspeichern können.“ Die Datenbankhälfte prüft
   > datenbank/pruef-hub-projekte.sql (zurückgedreht, live). Hier: die
   > NAHT zwischen Board und Funktionen und was der Wirt sieht.

   ZWEITE QUELLE: datenbank/migration-hub-projekte.sql — jede Funktion,
   die das Board ruft, steht dort mit genau den Parametern, die das
   Board schickt, und jeder `grund` der Funktionen hat im Board einen Satz.

   1 · Naht: Parameter = Signatur, Grund → Satz.
   2 · Liste: Name als Text (kein Tag wirkt), Farbpunkte, Stilname,
       Sicherungen zugeklappt, Knöpfe ≥ 44 px, Feld 16 px, 360 px ohne Überlauf.
   3 · Sichern: ohne Name kein Aufruf und ein Satz; mit Name genau
       p_betrieb + p_name, danach neu gelesen.
   4 · Laden erst beim zweiten Tipp; danach liest das Board die Spalten
       des Hubs neu (betrieb_mitglieder) — §8.1m.
   5 · Gründe als Satz (form), fehlende Migration als Satz.
   6 · Entfernen → archivieren, „Rückgängig“ holt zurück; Umbenennen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const MIG = fs.readFileSync(path.join(OBEN, "datenbank", "migration-hub-projekte.sql"), "utf8");
const HTML = fs.readFileSync(ADMIN, "utf8");

let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

console.log("══ 1 · Naht ══");
const SIG = {};
for(const m of MIG.matchAll(/create or replace function public\.(hub_projekt_\w+)\(([^)]*)\)/g))
  SIG[m[1]] = m[2].split(",").map(x => x.trim().split(/\s+/)[0]).filter(Boolean).sort();
pruef(Object.keys(SIG).length === 4, "vier Funktionen in der Migration gelesen", Object.keys(SIG).join(","));
const rufe = [...HTML.matchAll(/pjRufen\("(\w+)", \{([^}]*)\}/g)].map(m => [m[1], m[2].match(/p_\w+/g).sort()]);
pruef(rufe.length >= 5, "Aufrufe im Board gelesen", rufe.length);
rufe.forEach(([fn, args]) => {
  const soll = SIG[fn] || [];
  /* p_an hat einen Vorgabewert — das Board schickt ihn trotzdem immer. */
  pruef(!!SIG[fn] && args.join() === soll.join(), "Board → " + fn + "(" + args.join(", ") + ") = Signatur", soll.join(", "));
});
const gruende = [...new Set([...MIG.matchAll(/'grund', '(\w+)'/g)].map(m => m[1]))];
const satz = HTML.match(/const PJ_SATZ = \{([\s\S]*?)\n\};/);
const haben = satz ? [...satz[1].matchAll(/(\w+):/g)].map(m => m[1]) : [];
pruef(gruende.length >= 5 && gruende.every(g => haben.includes(g)), "jeder Grund der Migration hat einen Satz", gruende.filter(g => !haben.includes(g)).join(",") || gruende.join(","));

const ZEILEN = [
  { id:"p1", name:'<img src=x onerror="window.__xss=1">Herbst', art:"eigen", angelegt:"2026-10-16T18:00:00Z",
    farben:{ tag:{ grund:"#FFF8F0", band:"#3A1F14", akzent:"#C8202E" } }, karte:"buehne" },
  { id:"p2", name:"Sommer", art:"eigen", angelegt:"2026-10-15T10:00:00Z", farben:null, karte:null },
  { id:"s1", name:"Vor dem Laden von „Sommer“", art:"sicherung", angelegt:"2026-10-17T09:00:00Z", farben:null, karte:"raster" }
];

async function board(browser, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport:{ width:opt.breite || 390, height:900 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(600);
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(150); }
  await p.evaluate(([zeilen, o]) => {
    const bb = { id:"b1", slug:"blend", name:"Blend", rolle:"inhaber", bestell_pause:false, hub_texte:{}, hub_stil:{}, markenblatt:null };
    window.__rpc = []; window.__lesen = { projekte:0, mitglieder:0 }; window.__antwort = o.antwort || {};
    const antwort = z => {
      if(z.tab === "hub_projekte"){ window.__lesen.projekte++;
        if(o.fehler) return { data:null, error:{ code:o.fehler, message:"relation \"public.hub_projekte\" does not exist" } };
        return { data:zeilen, error:null }; }
      if(z.tab === "betrieb_mitglieder"){ window.__lesen.mitglieder++;
        /* Nach einem Laden steht der Stand des Projekts in betriebe. */
        const nach = window.__nachLaden && window.__rpc.some(r => r.fn === "hub_projekt_laden");
        return { data:[{ rolle:bb.rolle, betriebe:Object.assign({}, bb, nach ? { hub_stil:window.__nachLaden } : {}) }], error:null }; }
      return { data: z.einzeln ? null : [], error:null };
    };
    const kette = tab => { const z = { tab, einzeln:false };
      const p = new Proxy(function(){}, { get(_, k){ if(k === "then") return res => res(antwort(z));
        return () => { if(k === "maybeSingle" || k === "single") z.einzeln = true; return p; }; }, apply(){ return p; } }); return p; };
    /* Nur die Projekt-Aufrufe zählen; was betriebWaehlen() sonst ruft,
       bekommt eine leere Liste. */
    db = { from:kette, rpc: async (fn, args) => { if(!/^hub_projekt/.test(fn)) return { data:[], error:null };
             window.__rpc.push({ fn, args });
             return { data: window.__antwort[fn] || { ok:true }, error:null }; },
      channel:() => kette("kanal"), removeChannel:async () => {}, storage:{ from:() => kette("speicher") },
      functions:{ invoke:async () => ({ data:null, error:null }) },
      auth:{ getSession:async () => ({ data:{ session:null } }), getUser:async () => ({ data:{ user:{ id:"u1", email:"probe@example.org" } } }),
             onAuthStateChange:() => ({ data:{ subscription:{ unsubscribe(){} } } }) } };
    demo = false;
  }, [ZEILEN, opt]);
  await p.evaluate(async () => { document.getElementById("tor").hidden = true;
    try{ localStorage.setItem(merkSchluessel(), "b1"); }catch(e){} await betriebWaehlen(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-tafel="startseite"]').click());
  await p.waitForTimeout(300);
  await gruppeZu(p, "#pjGruppe");
  await p.$eval("#pjGruppe", g => g.scrollIntoView({ block:"start" }));
  return { ctx, p, fehler };
}
const klick = async (p, sel) => { await p.$eval(sel, el => el.scrollIntoView({ block:"center" })); await p.click(sel); await p.waitForTimeout(250); };

(async () => {
  const browser = await chromium.launch();
  console.log("══ 2 · Liste ══");
  let { ctx, p, fehler } = await board(browser, { breite:360 });
  const l = await p.evaluate(() => ({
    namen: [...document.querySelectorAll("#pjListe > .pj-karte .pj-name")].map(x => x.textContent),
    img: !!document.querySelector("#pjListe img"), xss: window.__xss === 1,
    punkte: document.querySelectorAll('#pjListe [data-pj="p1"] .pj-punkt').length,
    info: document.querySelector('#pjListe [data-pj="p1"] .pj-info').textContent,
    sichZu: !document.querySelector("#pjListe details.pj-sich").open,
    sichInnen: document.querySelectorAll("#pjListe details .pj-karte").length,
    knoepfe: Math.min(...[...document.querySelectorAll("#pjListe > .pj-karte button")].map(b => b.getBoundingClientRect().height)),
    feld: getComputedStyle(document.getElementById("pjName")).fontSize,
    sichern: document.getElementById("pjSichern").getBoundingClientRect().height,
    ueber: document.documentElement.scrollWidth - innerWidth,
    inhaber: document.getElementById("pjGruppe").hasAttribute("data-nur-inhaber") }));
  pruef(l.namen.length === 2 && /^<img/.test(l.namen[0]) && !l.img && !l.xss, "Name steht als Text da, kein Tag wirkt", JSON.stringify(l.namen));
  pruef(l.punkte === 3 && /Bühne/.test(l.info) && /16\.10\.2026/.test(l.info), "drei Farbpunkte, Datum und Stil", l.info);
  pruef(l.sichZu && l.sichInnen === 1, "Sicherungen in einer eigenen, zugeklappten Zeile");
  pruef(l.knoepfe >= 44 && l.sichern >= 44 && l.feld === "16px", "Knöpfe ≥ 44 px, Feld 16 px", l.knoepfe + " / " + l.sichern + " / " + l.feld);
  pruef(l.ueber <= 0 && l.inhaber, "360 px ohne Überlauf, Besitzer-Gruppe", l.ueber);

  console.log("══ 3 · Sichern ══");
  await klick(p, "#pjSichern");
  let s = await p.evaluate(() => ({ rpc: __rpc.length, satz: document.getElementById("pjSatz").textContent, sichtbar: !document.getElementById("pjSatz").hidden }));
  pruef(s.rpc === 0 && s.sichtbar && /Namen/.test(s.satz), "ohne Name: kein Aufruf, ein Satz", s.satz);
  await p.fill("#pjName", "  Winter  ");
  const vorher = await p.evaluate(() => __lesen.projekte);
  await klick(p, "#pjSichern");
  await p.waitForTimeout(200);
  s = await p.evaluate(() => ({ r: __rpc.slice(-1)[0], lesen: __lesen.projekte, feld: document.getElementById("pjName").value }));
  pruef(s.r && s.r.fn === "hub_projekt_sichern" && JSON.stringify(s.r.args) === JSON.stringify({ p_betrieb:"b1", p_name:"Winter" }),
    "Sichern schickt genau p_betrieb + p_name (getrimmt)", JSON.stringify(s.r));
  pruef(s.lesen > vorher && s.feld === "", "danach neu gelesen, Feld geleert", s.lesen + " / " + JSON.stringify(s.feld));

  console.log("══ 4 · Laden erst beim zweiten Tipp ══");
  const rpcVorher = await p.evaluate(() => __rpc.length);
  await klick(p, '#pjListe [data-pj-laden="p2"]');
  let z = await p.evaluate(() => ({ rpc: __rpc.length, text: document.querySelector('#pjListe [data-pj-laden="p2"]').textContent }));
  pruef(z.rpc === rpcVorher && /Wirklich/.test(z.text), "erster Tipp: nichts geladen, der Knopf fragt", z.text);
  const mVorher = await p.evaluate(() => __lesen.mitglieder);
  /* Was der Server nach dem Laden in betriebe stehen hat: ein anderer
     Stil der Speisekarte und eine andere Willkommen-Szene. Das Board muss
     DAS zeigen — Zählen der Abfragen allein trüge nicht (§8.1g E). */
  const stilVorher = await p.evaluate(() => document.querySelector('#ksGruppe [aria-checked="true"]').dataset.ks);
  await p.evaluate(() => { window.__nachLaden = { karte:"raster", lade:"kueche" }; });
  await klick(p, '#pjListe [data-pj-laden="p2"]');
  await p.waitForTimeout(500);
  z = await p.evaluate(() => ({ r: __rpc.slice(-1)[0], m: __lesen.mitglieder,
    ks: document.querySelector('#ksGruppe [aria-checked="true"]').dataset.ks,
    wz: (document.querySelector('#wzWahlen [aria-checked="true"]') || {}).dataset?.wzw }));
  pruef(z.r && z.r.fn === "hub_projekt_laden" && JSON.stringify(z.r.args) === JSON.stringify({ p_id:"p2" }), "zweiter Tipp lädt genau dieses Projekt", JSON.stringify(z.r));
  pruef(z.m > mVorher && stilVorher !== "raster" && z.ks === "raster" && z.wz === "kueche", "danach zeigt das Board den geladenen Stand des Servers (§8.1m)", stilVorher + " → " + z.ks + ", Szene " + z.wz);

  console.log("══ 5 · Gründe als Satz ══");
  await p.evaluate(() => { __antwort.hub_projekt_laden = { ok:false, grund:"form" }; });
  await klick(p, '#pjListe [data-pj-laden="p1"]');
  await klick(p, '#pjListe [data-pj-laden="p1"]');
  s = await p.evaluate(() => document.getElementById("pjSatz").textContent);
  pruef(/unverändert/.test(s), "form → „Ihr Hub ist unverändert“", s);

  console.log("══ 6 · Entfernen, Rückgängig, Umbenennen ══");
  await klick(p, '#pjListe [data-pj-weg="p2"]');
  z = await p.evaluate(() => ({ r: __rpc.slice(-1)[0], rueck: !!document.querySelector("#pjListe [data-pj-zurueck]") }));
  pruef(z.r.fn === "hub_projekt_archivieren" && z.r.args.p_an === true && z.r.args.p_id === "p2" && z.rueck, "Entfernen archiviert und bietet „Rückgängig“", JSON.stringify(z.r));
  await klick(p, "#pjListe [data-pj-zurueck]");
  z = await p.evaluate(() => __rpc.slice(-1)[0]);
  pruef(z.fn === "hub_projekt_archivieren" && z.args.p_an === false && z.args.p_id === "p2", "Rückgängig holt es zurück (p_an false)", JSON.stringify(z));
  await klick(p, '#pjListe [data-pj-name="p2"]');
  await p.fill('#pjListe [data-pj="p2"] input', "Sommer 2026");
  await klick(p, '#pjListe [data-pj-name-sichern="p2"]');
  z = await p.evaluate(() => __rpc.slice(-1)[0]);
  pruef(z.fn === "hub_projekt_umbenennen" && JSON.stringify(z.args) === JSON.stringify({ p_id:"p2", p_name:"Sommer 2026" }), "Umbenennen schickt id und neuen Namen", JSON.stringify(z));
  pruef(!fehler.length, "keine Seitenfehler", fehler.join(" | "));
  await ctx.close();

  ({ ctx, p, fehler } = await board(browser, { fehler:"42P01" }));
  s = await p.evaluate(() => document.getElementById("pjSatz").textContent);
  pruef(/migration-hub-projekte/.test(s), "fehlende Tabelle: ein Satz, welche Migration fehlt", s);
  await ctx.close();
  await browser.close();
  console.log("\n" + (f ? f + " FEHLER" : "Alles grün.") + " (" + n + " Proben)");
  process.exit(f ? 1 : 0);
})();
