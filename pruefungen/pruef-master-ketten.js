/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Master-Board: „Ketten & Standorte“ (Einkauf E4)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-master-ketten.js

   Plan E4: Der Master legt Organisationen zusammen und vergibt die
   „Zentrale der Kette“. Die Funktionen stehen in
   datenbank/migration-einkauf-e4.sql — sie ist die zweite Quelle für
   Parameter und Gründe.

   1 · je Organisation eine Karte: Standorte, Zentrale, Anzahl
   2 · Zusammenlegen erst beim ZWEITEN Tipp; Wechsel der Auswahl nimmt
       die Bestätigung zurück; gesendet werden genau die Parameter der
       Funktion; das Ergebnis nennt die Zahlen samt „umbenannt“
   3 · Zentrale per E-Mail hinzufügen, Entfernen erst beim zweiten Tipp
   4 · jeder Grund der Funktionen ein Satz, Blatt bleibt offen
   5 · Name aus der Datenbank nur als Text; Kontrast, 44 px, 390 px;
       fehlende Migration als Satz
   EHRLICHE GRENZE: die Datenbank ist gestellt. Was das Zusammenlegen
   wirklich tut, belegt datenbank/pruef-einkauf-e4.sql (zurückgedreht).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const S = n => "file://" + path.join(__dirname, "..", "seiten", n);
const SQL = fs.readFileSync(path.join(__dirname, "..", "datenbank", "migration-einkauf-e4.sql"), "utf8");
const HTML = fs.readFileSync(path.join(__dirname, "..", "seiten", "master.html"), "utf8");

let fehler = 0, n = 0;
function pruef(gut, text, zusatz){
  n++; console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz !== undefined ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

/* ── Naht als Quelltext ── */
console.log("══ Naht zur Migration ══");
function koerper(fn){ const i = SQL.indexOf("function public." + fn + "("); const j = SQL.indexOf("$function$;", i); return i < 0 ? "" : SQL.slice(i, j); }
function parameter(fn){ const m = koerper(fn).match(/^function public\.\w+\(([^)]*)\)/); return m ? m[1].split(",").map(x => x.trim().split(/\s+/)[0]).filter(Boolean).sort() : []; }
const gruende = fn => [...new Set([...koerper(fn).matchAll(/'grund',\s*'(\w+)'/g)].map(m => m[1]))];
const satzSchluessel = name => { const b = HTML.match(new RegExp("var " + name + " = \\{([\\s\\S]*?)\\n  \\};")); return b ? [...b[1].matchAll(/^\s*(\w+):/gm)].map(m => m[1]) : []; };
const SIG = { zusammen: parameter("master_organisation_zusammenlegen"), zentrale: parameter("master_zentrale_setzen") };
pruef(SIG.zusammen.join() === "p_name,p_quelle,p_ziel" && SIG.zentrale.join() === "p_an,p_email,p_org", "Signaturen aus der Migration gelesen", JSON.stringify(SIG));
const gZ = gruende("master_organisation_zusammenlegen"), gS = gruende("master_zentrale_setzen");
const sZ = satzSchluessel("KT_GRUND_ZUSAMMEN"), sS = satzSchluessel("KT_GRUND_ZENTRALE");
pruef(gZ.length >= 4 && gZ.every(g => sZ.includes(g)), "jeder Grund von master_organisation_zusammenlegen hat einen Satz", gZ.filter(g => !sZ.includes(g)).join(",") || gZ.join(","));
pruef(gS.length >= 4 && gS.every(g => sS.includes(g)), "jeder Grund von master_zentrale_setzen hat einen Satz", gS.filter(g => !sS.includes(g)).join(",") || gS.join(","));
/* Was die Seite aus master_ketten liest, baut die Funktion. */
const ketteSchl = [...new Set([...koerper("master_ketten").matchAll(/'(\w+)',\s*(?:o|b|m|u)\.\w+/g)].map(m => m[1]))];
const ktBlock = (HTML.match(/6\.5d KETTEN[\s\S]*?data-kette'\)\);/) || [""])[0];
const gelesen = [...new Set([...ktBlock.matchAll(/\b(?:o|x|b|m)\.(\w+)/g)].map(m => m[1]))].filter(k => !["length"].includes(k));
pruef(ketteSchl.length >= 5 && gelesen.length >= 5 && gelesen.every(k => ketteSchl.includes(k) || ["betriebe", "zentrale"].includes(k)),
  "jedes gelesene Feld liefert master_ketten", gelesen.filter(k => !ketteSchl.includes(k) && !["betriebe", "zentrale"].includes(k)).join(",") || gelesen.join(","));

const ORGS = [
  { id:"o-choco", name:"Choco <img src=x onerror=\"window.__xss=1\">", betriebe:[{ id:"b1", name:"Choco Mitte", slug:"choco" }, { id:"b2", name:"Choco Süd", slug:"choco-sued" }],
    zentrale:[{ nutzer_id:"u-z", email:"zentrale@probe.de" }] },
  { id:"o-blend", name:"Blend", betriebe:[{ id:"b3", name:"Blend", slug:"blend" }], zentrale:[] },
  { id:"o-minh", name:"Minhkeey", betriebe:[{ id:"b4", name:"Minhkeey", slug:"minhkeey" }], zentrale:[] }
];

function ersatz(antwort){
  return "(function(antwort){" + `
    window.__rufe = { ketten: 0, zusammen: [], zentrale: [] };
    window.__antwort = {};
    const nutzer = { id:"00000000-0000-0000-0000-000000000001", email:"master@probe.de" };
    const sitzung = { user:nutzer, access_token:"x" };
    const leer = () => {
      const erg = { data:[], error:null, count:0 };
      const p = new Proxy(function(){}, {
        get(_, k){
          if(k === "then") return (a, b) => Promise.resolve(erg).then(a, b);
          if(k === "single" || k === "maybeSingle") return () => Promise.resolve({ data:null, error:null });
          return () => p;
        },
        apply(){ return p; }
      });
      return p;
    };
    window.supabase = { createClient: () => ({
      auth: {
        getSession: async () => ({ data:{ session: sitzung } }),
        getUser: async () => ({ data:{ user: nutzer } }),
        signInWithPassword: async () => ({ data:{ user:nutzer, session:sitzung }, error:null }),
        signOut: async () => ({}),
        updateUser: async () => ({ data:{ user:nutzer }, error:null }),
        resetPasswordForEmail: async () => ({ error:null }),
        onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
        signInWithOAuth: async () => ({ data:{}, error:null })
      },
      rpc: async (name, param) => {
        if(name === "master_ketten"){
          window.__rufe.ketten++;
          if(antwort && antwort.fehlercode) return { data:null, error:{ code:antwort.fehlercode, message:antwort.fehlermeldung || "Fehler" } };
          return { data: antwort, error:null };
        }
        if(name === "master_organisation_zusammenlegen"){ window.__rufe.zusammen.push(param); return { data: window.__antwort.zusammen || { ok:true, betriebe:1, artikel:12, lieferanten:3, umbenannt:2 }, error:null }; }
        if(name === "master_zentrale_setzen"){ window.__rufe.zentrale.push(param); return { data: window.__antwort.zentrale || { ok:true, aktiv: param.p_an }, error:null }; }
        if(name === "ist_master") return { data:true, error:null };
        return { data:null, error:null };
      },
      from: () => leer(),
      channel: () => ({ on(){ return this; }, subscribe(){ return this; }, unsubscribe(){} }),
      removeChannel: () => {}, removeAllChannels: () => {},
      functions: { invoke: async () => ({ data:null, error:null }) },
      storage: { from: () => ({ getPublicUrl: () => ({ data:{ publicUrl:"" } }), upload: async () => ({}) }) }
    }) };
  ` + "})(" + JSON.stringify(antwort) + ");";
}

async function masterOffen(browser, antwort){
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push(String(e).slice(0, 200)));
  await p.addInitScript({ content: ersatz(antwort) });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto(S("master.html"));
  await p.waitForSelector("#app:not(.hidden)", { timeout: 10000 });
  await p.waitForTimeout(500);
  return { ctx, p, kons };
}

/* Kontrast im Blatt: Grund = erste deckende Farbe darüber, ein Verlauf zählt mit seiner ersten Farbe. */
async function blattMessen(p){
  return p.evaluate(() => {
    const rgb = s => { const m = (s || "").match(/rgba?\(([^)]+)\)/); if(!m) return null; const v = m[1].split(",").map(x => parseFloat(x)); return { r:v[0], g:v[1], b:v[2], a: v.length > 3 ? v[3] : 1 }; };
    const L = c => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const mische = (o, u) => ({ r:o.r * o.a + u.r * (1 - o.a), g:o.g * o.a + u.g * (1 - o.a), b:o.b * o.a + u.b * (1 - o.a), a:1 });
    function grund(el){
      const kette = []; for(let e = el; e; e = e.parentElement){ const st = getComputedStyle(e); kette.push(rgb(st.backgroundColor) && rgb(st.backgroundColor).a > 0 ? rgb(st.backgroundColor) : rgb(st.backgroundImage)); }
      let c = { r:0, g:0, b:0, a:1 };
      for(let i = kette.length - 1; i >= 0; i--){ const b = kette[i]; if(b && b.a > 0) c = b.a >= 1 ? b : mische(b, c); }
      return c;
    }
    const sheet = document.querySelector(".sheet"); if(!sheet) return null;
    let min = 99, wo = "";
    for(const el of sheet.querySelectorAll("*")){
      if(![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect(); if(!r.width) continue;
      const st = getComputedStyle(el), f = rgb(st.webkitTextFillColor || st.color) || rgb(st.color), g = grund(el);
      if(!f || !g) continue;
      const ff = f.a < 1 ? mische(f, g) : f, a = L(ff), b = L(g), k = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      if(k < min){ min = k; wo = (el.id || el.tagName) + " „" + el.textContent.trim().slice(0, 30) + "“"; }
    }
    const klein = [...sheet.querySelectorAll("button, input, select")].filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height < 43.5; })
      .map(el => (el.id || el.textContent.trim()) + " " + Math.round(el.getBoundingClientRect().height));
    const fs16 = [...sheet.querySelectorAll("input, select")].every(el => parseFloat(getComputedStyle(el).fontSize) >= 16);
    return { min: Math.round(min * 100) / 100, wo, klein, fs16, ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  console.log("\n══ Übersicht ══");
  {
    const { ctx, p, kons } = await masterOffen(browser, { ok:true, organisationen: ORGS });
    const st = await p.evaluate(() => ({
      rufe: window.__rufe.ketten, xss: window.__xss || 0, note: document.getElementById("kettenNote").textContent,
      karten: [...document.querySelectorAll("#kettenListe .kette-karte")].map(k => ({ id: k.dataset.kette, name: k.querySelector(".z-betrieb").textContent,
        mail: k.querySelector(".z-mail").textContent, meta: k.querySelector(".z-meta").textContent, stand: k.querySelector(".stand").textContent, h: k.getBoundingClientRect().height }))
    }));
    pruef(st.rufe === 1, "master_ketten() beim Laden genau einmal gerufen", st.rufe);
    pruef(st.karten.length === 3 && st.note === "1 Kette mit mehreren Standorten", "je Organisation eine Karte, Kopfzeile zählt die Ketten", st.note);
    const c = st.karten[0];
    pruef(/Choco Mitte, Choco Süd/.test(c.mail) && /zentrale@probe\.de/.test(c.meta) && c.stand === "2 Standorte", "Karte: Standorte, Zentrale der Kette, Anzahl", JSON.stringify(c));
    pruef(st.karten[1].stand === "1 Standort" && /keine Zentrale/.test(st.karten[1].meta), "Einzelbetrieb: „1 Standort“, „keine Zentrale der Kette“", st.karten[1].meta);
    pruef(st.xss === 0 && /<img/.test(c.name), "Name aus der Datenbank nur als Text");
    pruef(st.karten.every(k => k.h >= 44), "jede Karte ≥ 44 px", st.karten.map(k => Math.round(k.h)).join(","));

    /* Zusammenlegen */
    await p.click('#kettenListe [data-kette="o-choco"]'); await p.waitForTimeout(250);
    const opt = await p.evaluate(() => [...document.querySelectorAll("#ktQuelle option")].map(o => o.value));
    pruef(opt.join() === "o-blend,o-minh", "Auswahl: nur die ANDEREN Organisationen", opt.join());
    const m = await blattMessen(p);
    pruef(m && m.min >= 4.5, "Blatt: jede Schrift ≥ 4,5:1", m && (m.min + " " + m.wo));
    pruef(m && !m.klein.length && m.fs16 && m.ueber <= 0, "Blatt: Ziele ≥ 44 px, Felder 16 px, kein Überlauf bei 390 px", m && JSON.stringify({ k:m.klein, f:m.fs16, u:m.ueber }));
    await p.click("#ktZusammen"); await p.waitForTimeout(150);
    const nach1 = await p.evaluate(() => ({ rufe: window.__rufe.zusammen.length, knopf: document.getElementById("ktZusammen").textContent, satz: document.getElementById("ktMeldung").textContent }));
    pruef(nach1.rufe === 0 && nach1.knopf === "Ja, zusammenlegen" && /Nicht rückgängig/.test(nach1.satz) && /Blend/.test(nach1.satz), "erster Tipp: nichts gesendet, fragt mit Namen nach", JSON.stringify(nach1));
    await p.selectOption("#ktQuelle", "o-minh"); await p.waitForTimeout(80);
    pruef(await p.textContent("#ktZusammen") === "Zusammenlegen", "andere Auswahl nimmt die Bestätigung zurück");
    await p.click("#ktZusammen"); await p.waitForTimeout(80);
    pruef(await p.evaluate(() => window.__rufe.zusammen.length) === 0, "… und braucht wieder zwei Tipps");
    await p.click("#ktZusammen"); await p.waitForTimeout(350);
    const ges = await p.evaluate(() => window.__rufe.zusammen[0]);
    pruef(ges && Object.keys(ges).sort().join() === SIG.zusammen.join() && ges.p_ziel === "o-choco" && ges.p_quelle === "o-minh" && ges.p_name === null,
      "zweiter Tipp: genau die Parameter der Funktion, Ziel = diese Kette, leerer Name = null", JSON.stringify(ges));
    const nach2 = await p.evaluate(() => ({ zu: !document.querySelector(".overlay"), toast: (document.getElementById("toast") || {}).textContent || "", neu: window.__rufe.ketten }));
    pruef(nach2.zu && /1 Standort\(e\), 12 Artikel, 3 Lieferanten — 2 mit Standort-Zusatz/.test(nach2.toast) && nach2.neu === 2, "Ergebnis mit Zahlen samt „umbenannt“, Blatt zu, Liste neu geladen", JSON.stringify(nach2));

    /* Name mitgeben, Gründe als Satz */
    await p.click('#kettenListe [data-kette="o-choco"]'); await p.waitForTimeout(250);
    await p.fill("#ktName", "  Choco Gruppe  ");
    await p.evaluate(() => { window.__antwort.zusammen = { ok:false, grund:"gleich" }; });
    await p.click("#ktZusammen"); await p.click("#ktZusammen"); await p.waitForTimeout(300);
    const g = await p.evaluate(() => ({ ges: window.__rufe.zusammen[1], satz: document.getElementById("ktMeldung").textContent, offen: !!document.querySelector(".overlay"), knopf: document.getElementById("ktZusammen").textContent }));
    pruef(g.ges && g.ges.p_name === "Choco Gruppe", "Name getrimmt mitgeschickt", g.ges && g.ges.p_name);
    pruef(g.offen && /nicht mit sich selbst/.test(g.satz) && g.knopf === "Zusammenlegen", "Absage: Blatt bleibt offen, Satz, Bestätigung zurückgesetzt", JSON.stringify(g));
    for(const grund of gZ){
      await p.evaluate(gr => { window.__antwort.zusammen = { ok:false, grund:gr }; }, grund);
      await p.click("#ktZusammen"); await p.click("#ktZusammen"); await p.waitForTimeout(200);
      const t = await p.textContent("#ktMeldung");
      pruef(t && !/Verbindung/.test(t) && !/\b[a-z]+_[a-z]+\b/.test(t), "Zusammenlegen „" + grund + "“ → Satz", t);
    }

    /* Zentrale der Kette */
    await p.fill("#ktMail", "keine-adresse");
    await p.click("#ktZAdd"); await p.waitForTimeout(150);
    pruef(await p.evaluate(() => window.__rufe.zentrale.length) === 0 && /gültige E-Mail/.test(await p.textContent("#ktZMeldung")), "ungültige Adresse: nichts gesendet, Satz");
    await p.evaluate(() => { window.__antwort.zentrale = { ok:false, grund:"kein_konto" }; });
    await p.fill("#ktMail", " neu@probe.de ");
    await p.click("#ktZAdd"); await p.waitForTimeout(250);
    const z1 = await p.evaluate(() => ({ ges: window.__rufe.zentrale[0], satz: document.getElementById("ktZMeldung").textContent, offen: !!document.querySelector(".overlay") }));
    pruef(z1.ges && Object.keys(z1.ges).sort().join() === SIG.zentrale.join() && z1.ges.p_org === "o-choco" && z1.ges.p_email === "neu@probe.de" && z1.ges.p_an === true,
      "Hinzufügen: genau die Parameter, Adresse getrimmt, an = true", JSON.stringify(z1.ges));
    pruef(z1.offen && /noch kein Konto/.test(z1.satz), "kein_konto: Blatt bleibt offen, Satz", z1.satz);
    for(const grund of gS){
      await p.evaluate(gr => { window.__antwort.zentrale = { ok:false, grund:gr }; }, grund);
      await p.click("#ktZAdd"); await p.waitForTimeout(200);
      const t = await p.textContent("#ktZMeldung");
      pruef(t && !/Verbindung/.test(t) && !/\b[a-z]+_[a-z]+\b/.test(t), "Zentrale „" + grund + "“ → Satz", t);
    }
    await p.evaluate(() => { window.__antwort.zentrale = null; window.__rufe.zentrale = []; });
    await p.click('[data-kz-weg="zentrale@probe.de"]'); await p.waitForTimeout(100);
    pruef(await p.evaluate(() => window.__rufe.zentrale.length) === 0 && await p.textContent('[data-kz-weg="zentrale@probe.de"]') === "Wirklich?", "Entfernen: erster Tipp fragt nur");
    await p.click('[data-kz-weg="zentrale@probe.de"]'); await p.waitForTimeout(300);
    const z2 = await p.evaluate(() => window.__rufe.zentrale[0]);
    pruef(z2 && z2.p_email === "zentrale@probe.de" && z2.p_an === false && z2.p_org === "o-choco", "zweiter Tipp: abgeschaltet (an = false), nichts gelöscht", JSON.stringify(z2));
    pruef(!kons.length, "keine Laufzeitfehler", kons.join(" | ") || "still");
    await ctx.close();
  }
  console.log("\n══ Migration fehlt, kein Recht ══");
  for(const [antwort, erwartet, was] of [
    [{ fehlercode:"PGRST202", fehlermeldung:"Could not find the function public.master_ketten in the schema cache" }, /migration-einkauf-e4\.sql/, "Migration fehlt: sagt welche"],
    [{ ok:false, grund:"kein_recht" }, /nur ein Master-Konto/, "kein Recht: Satz statt „keine Organisation“"]]){
    const { ctx, p, kons } = await masterOffen(browser, antwort);
    const t = await p.evaluate(() => document.getElementById("kettenListe").textContent);
    pruef(erwartet.test(t) && !kons.length, was, t.trim().slice(0, 80));
    await ctx.close();
  }
  await browser.close();
  console.log("\n" + (n - fehler) + " von " + n + " ok");
  console.log(fehler ? fehler + " FEHLER" : "Alles sauber.");
  process.exit(fehler ? 1 : 0);
})();
