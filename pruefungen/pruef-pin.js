/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Zweiter Faktor: der PIN-Schirm in Board, Küche und Master

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-pin.js

   Der Schutz sitzt in der Datenbank (migration-pin.sql, geprüft in
   datenbank/pruef-rechte.sql TEIL 7). Diese Prüfung fragt, ob die
   drei Oberflächen ihn BEDIENBAR machen:

   1 · Der geteilte Block steht in allen drei Dateien wortgleich.
   2 · In jeder Datei, auf JEDEM Weg hinein (Passwort und gemerkte
       Sitzung): Pflicht → Schirm, und VOR der richtigen PIN wird
       nichts geladen. Falsche PIN → Restversuche. Richtige → weiter.
   3 · Keine Pflicht → kein Schirm. Server stumm → kein Schirm (§7).
   4 · Gesperrt / keine PIN vergeben → kein Eingabefeld, klarer Satz,
       Abmelden führt hinaus.
   5 · Gemessen, nicht angesehen: Tapflächen, 16 px, Kontrast der
       Schrift auf der Karte, kein Überlauf bei 360 px.

   Die Serverantworten sind gestellt (supabase-js bzw. fetch). Die
   Naht zur echten Funktion: Die Felder, die der Block liest
   (pflicht, ok, hat_pin, gesperrt, verbleibend, grund), werden gegen
   den Quelltext von migration-pin.sql gehalten — nicht erfunden.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const WURZEL = path.join(__dirname, "..");
const S = n => "file://" + path.join(WURZEL, "seiten", n);

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

/* ── 1 · Der Block, dreimal ─────────────────────────────────────── */
console.log("══ Geteilter Block ══");
const ANF = "/* ╔═══ PIN · GETEILTER BLOCK · ANFANG", END = "PIN · GETEILTER BLOCK · ENDE ═══";
const bloecke = {};
for(const d of ["admin.html", "kueche.html", "master.html"]){
  const s = fs.readFileSync(path.join(WURZEL, "seiten", d), "utf8");
  const a = s.indexOf(ANF), e = s.indexOf(END);
  bloecke[d] = a >= 0 && e > a ? s.slice(a, e) : null;
  pruef(!!bloecke[d], d + " trägt den Block");
}
const namen = Object.keys(bloecke).filter(k => bloecke[k]);
pruef(namen.length === 3 && namen.every(k => bloecke[k] === bloecke[namen[0]]),
  "alle drei Kopien sind Zeichen für Zeichen gleich",
  namen.map(k => k + " " + (bloecke[k] || "").length).join(", "));

/* Die Naht: Jedes Feld, das der Block liest, muss die SQL-Funktion
   auch liefern. Zweite Quelle ist die Migration, nicht diese Datei. */
const sql = fs.readFileSync(path.join(WURZEL, "datenbank", "migration-pin.sql"), "utf8");
const liest = [...new Set([...(bloecke[namen[0]] || "").matchAll(/\b[sa]\.(pflicht|ok|hat_pin|gesperrt|verbleibend|grund)\b/g)].map(m => m[1]))];
const fehlt = liest.filter(f => !new RegExp("'" + f + "'").test(sql));
pruef(liest.length >= 5 && fehlt.length === 0, "jedes gelesene Feld liefert migration-pin.sql",
  fehlt.length ? "fehlt: " + fehlt.join(", ") : liest.join(", "));
const gruende = [...new Set([...(bloecke[namen[0]] || "").matchAll(/a\.grund === "([a-z_]+)"/g)].map(m => m[1]))];
const gruendeSql = [...new Set([...sql.matchAll(/'grund', '([a-z_]+)'/g), ...sql.matchAll(/then '([a-z_]+)' else '([a-z_]+)'/g)].flatMap(m => m.slice(1)))];
pruef(gruende.every(g => gruendeSql.includes(g)), "jeder Grund, auf den der Block hört, kommt aus der SQL",
  gruende.filter(g => !gruendeSql.includes(g)).join(", ") || gruende.join(", "));

/* ── Ersatz für supabase-js mit PIN-Antworten ─────────────────────── */
function ersatz(lage){
  return "(function(lage){" + `
    window.__rufe = { status:0, pruefen:[], signOut:0, master:0, from:0, ladenVorPin:0 };
    let pinFrei = false;
    const nutzer = { id:"00000000-0000-0000-0000-000000000001", email:"wirt@probe.de" };
    let sitzung = lage.sitzung ? { user:nutzer, access_token:"x" } : null;
    const kette = () => {
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
        getUser: async () => ({ data:{ user: sitzung ? nutzer : null } }),
        signInWithPassword: async () => { sitzung = { user:nutzer, access_token:"x" }; return { data:{ user:nutzer, session:sitzung }, error:null }; },
        signOut: async () => { window.__rufe.signOut++; sitzung = null; return {}; },
        updateUser: async () => ({ data:{}, error:null }),
        resetPasswordForEmail: async () => ({ error:null }),
        onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } })
      },
      rpc: async (name, args) => {
        if(name === "admin_anmelden") return { data:{ erlaubt:true }, error:null };
        if(name === "pin_status"){ window.__rufe.status++;
          if(lage.stumm) return { data:null, error:{ message:"Could not find the function public.pin_status" } };
          return { data: Object.assign({ angemeldet:true, pflicht:true, hat_pin:true, ok:pinFrei, gesperrt:false, verbleibend:5, master:false }, lage.status || {}), error:null }; }
        if(name === "pin_pruefen"){ window.__rufe.pruefen.push(args.p_pin);
          if(args.p_pin === "48151623"){ pinFrei = true; return { data:{ ok:true }, error:null }; }
          return { data:{ ok:false, grund:"falsch", verbleibend: 5 - window.__rufe.pruefen.length }, error:null }; }
        if(name === "ist_master"){ window.__rufe.master++; return { data:true, error:null }; }
        return { data:null, error:null };
      },
      from: () => { window.__rufe.from++; if(!pinFrei && lage.status && lage.status.pflicht !== false && !lage.stumm) window.__rufe.ladenVorPin++; return kette(); },
      channel: () => ({ on(){ return this; }, subscribe(){ return this; }, unsubscribe(){} }),
      removeChannel: () => {}, removeAllChannels: () => {},
      functions: { invoke: async () => ({ data:null, error:null }) },
      storage: { from: () => ({ getPublicUrl: () => ({ data:{ publicUrl:"" } }), upload: async () => ({}) }) }
    }) };
  ` + "})(" + JSON.stringify(lage) + ");";
}

async function seite(browser, datei, lage, breite){
  const ctx = await browser.newContext({ viewport:{ width: breite || 390, height:844 } });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push(String(e).slice(0, 160)));
  await p.addInitScript({ content: ersatz(lage) });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto(S(datei));
  await p.waitForTimeout(600);
  const scharf = await p.$("#scharfJetzt");
  /* Der PIN-Schirm liegt über „Board scharf schalten“ — erst die PIN,
     dann der Ton. Solange er steht, wird unten nichts angetippt. */
  const pinDa = await p.$(".pin-decke");
  if(!pinDa && scharf && await p.isVisible("#scharf").catch(() => false)){ await scharf.click(); await p.waitForTimeout(200); }
  return { ctx, p, kons };
}

/* Wie der Mensch hineinkommt — je Datei. */
const WEGE = {
  "admin.html":  async p => { await p.fill("#lMail", "wirt@probe.de"); await p.fill("#lPass", "richtig123"); await p.click("#lKnopf"); },
  "master.html": async p => { await p.fill("#email", "wirt@probe.de"); await p.fill("#password", "richtig123"); await p.click("#loginBtn"); },
};
const WEITER = {
  "admin.html":  p => p.evaluate(() => document.getElementById("tor").hidden),
  "master.html": p => p.evaluate(() => getComputedStyle(document.getElementById("app")).display !== "none"),
};

async function schirm(p){
  return p.evaluate(() => {
    const d = document.querySelector(".pin-decke");
    if(!d) return { da:false };
    const feld = document.getElementById("pin-feld");
    return { da:true, feld: !!feld && !document.getElementById("pin-eingabe").hidden,
      text: document.getElementById("pin-text").textContent,
      meldung: document.getElementById("pin-meldung").textContent };
  });
}
async function tippen(p, ziffern){
  await p.click("#pin-eingabe");
  await p.keyboard.type(ziffern, { delay: 15 });
  await p.waitForTimeout(350);
}

(async () => {
  const browser = await chromium.launch();

  for(const datei of ["admin.html", "master.html"]){
    console.log("\n══ " + datei + " ══");
    for(const [weg, lage] of [["nach dem Passwort", {}], ["mit gemerkter Sitzung (Neuladen)", { sitzung:true }]]){
      const { ctx, p, kons } = await seite(browser, datei, Object.assign({ status:{} }, lage));
      if(weg === "nach dem Passwort") await WEGE[datei](p);
      await p.waitForTimeout(600);
      let sch = await schirm(p);
      pruef(sch.da && sch.feld, datei + " · " + weg + ": PIN-Schirm steht", JSON.stringify(sch).slice(0, 90));
      if(!sch.da){ await ctx.close(); continue; }
      const vor = await p.evaluate(() => ({ weiter: 0, laden: window.__rufe.ladenVorPin, master: window.__rufe.master }));
      pruef(vor.laden === 0 && (datei !== "master.html" || vor.master === 0),
        datei + " · " + weg + ": vor der PIN wird nichts geladen", JSON.stringify(vor));
      await tippen(p, "11223344");
      sch = await schirm(p);
      pruef(sch.da && /nicht richtig/.test(sch.meldung) && /Noch 4 Versuche/.test(sch.meldung),
        datei + " · falsche PIN: Satz mit Restversuchen", sch.meldung);
      await tippen(p, "48151623");
      await p.waitForTimeout(500);
      sch = await schirm(p);
      const weiter = await WEITER[datei](p);
      const r = await p.evaluate(() => window.__rufe);
      pruef(!sch.da && weiter && r.pruefen.length === 2,
        datei + " · richtige PIN: Schirm weg, es geht weiter", JSON.stringify({ schirm:sch.da, weiter, versuche:r.pruefen.length }));
      if(datei === "master.html") pruef(r.master >= 1, "master.html · Rolle erst NACH der PIN geprüft", "ist_master " + r.master + "×");
      pruef(kons.length === 0, datei + " · " + weg + ": keine Ausnahme", kons[0] || "still");
      await ctx.close();
    }
    /* Ohne Pflicht, und wenn der Server nichts sagt */
    for(const [fall, lage] of [["ohne Pflicht", { status:{ pflicht:false } }], ["Server stumm (Migration fehlt)", { stumm:true }]]){
      const { ctx, p } = await seite(browser, datei, lage);
      await WEGE[datei](p);
      await p.waitForTimeout(700);
      const sch = await schirm(p);
      const weiter = await WEITER[datei](p);
      pruef(!sch.da && weiter, datei + " · " + fall + ": kein Schirm, es geht weiter", JSON.stringify({ schirm:sch.da, weiter }));
      await ctx.close();
    }
    /* Gesperrt und keine PIN vergeben: kein Feld, klarer Satz, Abmelden */
    for(const [fall, status, muster] of [["gesperrt", { gesperrt:true, verbleibend:0 }, /gesperrt/],
                                         ["keine PIN vergeben", { hat_pin:false }, /noch keine PIN/]]){
      const { ctx, p } = await seite(browser, datei, { status });
      await WEGE[datei](p);
      await p.waitForTimeout(600);
      const sch = await schirm(p);
      pruef(sch.da && !sch.feld && muster.test(sch.text), datei + " · " + fall + ": Satz statt Eingabe", sch.text);
      if(sch.da){
        await p.click("#pin-aus");
        await p.waitForTimeout(500);
        const n = await p.evaluate(() => ({ weg: !document.querySelector(".pin-decke"), aus: window.__rufe.signOut }));
        const drin = await WEITER[datei](p);
        pruef(n.weg && n.aus >= 1 && !drin, datei + " · " + fall + ": Abmelden führt hinaus", JSON.stringify(Object.assign(n, { drin })));
      }
      await ctx.close();
    }
  }

  /* ── Küche: fetch statt supabase-js ─────────────────────────────── */
  console.log("\n══ kueche.html ══");
  async function kueche(lage){
    const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
    const p = await ctx.newPage();
    const kons = [];
    p.on("pageerror", e => kons.push(String(e).slice(0, 160)));
    const r = { status:0, pruefen:[], betriebeVorPin:0, betriebe:0 };
    let frei = false;
    await p.route("**/*", async q => {
      const u = q.request().url();
      if(u.startsWith("file://")) return q.continue();
      const json = (b, s) => q.fulfill({ status: s || 200, contentType:"application/json", body: JSON.stringify(b) });
      if(/rpc\/admin_anmelden/.test(u)) return json({ erlaubt:true });
      if(/auth\/v1\/token/.test(u)) return json({ access_token:"a", refresh_token:"r" });
      if(/rpc\/pin_status/.test(u)){ r.status++;
        if(lage.stumm) return json({ message:"Could not find the function" }, 404);
        return json(Object.assign({ pflicht:true, hat_pin:true, ok:frei, gesperrt:false, verbleibend:5 }, lage.status || {})); }
      if(/rpc\/pin_pruefen/.test(u)){ const a = JSON.parse(q.request().postData() || "{}"); r.pruefen.push(a.p_pin);
        if(a.p_pin === "48151623"){ frei = true; return json({ ok:true }); }
        return json({ ok:false, grund:"falsch", verbleibend: 5 - r.pruefen.length }); }
      if(/rest\/v1\/betriebe/.test(u)){ r.betriebe++; if(!frei && !lage.stumm && !(lage.status && lage.status.pflicht === false)) r.betriebeVorPin++;
        return json([{ id:"10000000-0000-0000-0000-000000000001", name:"Probehaus" }]); }
      if(/rest\/v1\//.test(u)) return json([]);
      return q.abort();
    });
    if(lage.sitzung) await p.addInitScript(() => { try{ localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({ access_token:"a", refresh_token:"r" })); }catch(e){} });
    await p.goto(S("kueche.html"));
    await p.waitForTimeout(600);
    if(!lage.sitzung){
      await p.fill("#mail", "wirt@probe.de"); await p.fill("#wort", "richtig123"); await p.click("#torKnopf");
      await p.waitForTimeout(600);
    }
    return { ctx, p, r, kons };
  }
  const kuecheWeiter = p => p.evaluate(() => !document.getElementById("schirm").hidden);
  for(const [weg, lage] of [["nach dem Passwort", {}], ["mit gemerkter Sitzung (Neuladen)", { sitzung:true }]]){
    const { ctx, p, r, kons } = await kueche(lage);
    let sch = await schirm(p);
    pruef(sch.da && sch.feld, "kueche.html · " + weg + ": PIN-Schirm steht", JSON.stringify(sch).slice(0, 90));
    if(sch.da){
      pruef(r.betriebeVorPin === 0 && !(await kuecheWeiter(p)), "kueche.html · " + weg + ": vor der PIN keine Bons, kein Display", "Betriebe geladen " + r.betriebe + "×");
      await tippen(p, "11223344");
      sch = await schirm(p);
      pruef(/Noch 4 Versuche/.test(sch.meldung), "kueche.html · falsche PIN: Restversuche", sch.meldung);
      await tippen(p, "48151623");
      await p.waitForTimeout(600);
      sch = await schirm(p);
      pruef(!sch.da && await kuecheWeiter(p) && r.betriebe >= 1, "kueche.html · richtige PIN: Display läuft", JSON.stringify({ schirm:sch.da, betriebe:r.betriebe }));
    }
    pruef(kons.length === 0, "kueche.html · " + weg + ": keine Ausnahme", kons[0] || "still");
    await ctx.close();
  }
  for(const [fall, lage] of [["ohne Pflicht", { status:{ pflicht:false } }], ["Server stumm (Migration fehlt)", { stumm:true }]]){
    const { ctx, p } = await kueche(lage);
    const sch = await schirm(p);
    pruef(!sch.da && await kuecheWeiter(p), "kueche.html · " + fall + ": kein Schirm, Display läuft");
    await ctx.close();
  }
  {
    const { ctx, p } = await kueche({ status:{ gesperrt:true, verbleibend:0 } });
    const sch = await schirm(p);
    pruef(sch.da && !sch.feld && /gesperrt/.test(sch.text), "kueche.html · gesperrt: Satz statt Eingabe", sch.text);
    if(sch.da){
      await p.click("#pin-aus"); await p.waitForTimeout(400);
      const n = await p.evaluate(() => ({ tor: !document.getElementById("tor").hidden, sitzung: localStorage.getItem("omoteno-kueche-sitzung") }));
      pruef(n.tor && !n.sitzung, "kueche.html · Abmelden: zurück am Tor, Sitzung vergessen", JSON.stringify(n));
    }
    await ctx.close();
  }

  /* ── 5 · Gemessen ─────────────────────────────────────────────────── */
  console.log("\n══ Maße ══");
  const L = c => { const v = c.match(/[\d.]+/g).slice(0, 3).map(x => { x = +x / 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); });
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const K = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  for(const breite of [360, 1280]){
    const { ctx, p } = await seite(browser, "admin.html", { status:{} }, breite);
    await WEGE["admin.html"](p);
    await p.waitForTimeout(600);
    const m = await p.evaluate(() => {
      const q = s => document.querySelector(s), cs = e => getComputedStyle(e);
      const karte = cs(q(".pin-karte")).backgroundColor;
      const r = e => e.getBoundingClientRect();
      return { karte, text: cs(q(".pin-text")).color, titel: cs(q(".pin-titel")).color, meldung: cs(q(".pin-meldung")).color,
        aus: cs(q(".pin-aus")).color, los: cs(q(".pin-los")).color, losGrund: cs(q(".pin-los")).backgroundColor,
        feldPx: parseFloat(cs(q("#pin-feld")).fontSize), knoepfe: [r(q(".pin-los")).height, r(q(".pin-aus")).height],
        eingabeHoch: r(q("#pin-eingabe")).height,
        ueberlauf: document.documentElement.scrollWidth - innerWidth, karteRechts: r(q(".pin-karte")).right, breit: innerWidth };
    });
    const paare = [["Satz", m.text, m.karte], ["Titel", m.titel, m.karte], ["Fehlermeldung", m.meldung, m.karte],
                   ["Abmelden", m.aus, m.karte], ["Knopfschrift", m.los, m.losGrund]];
    const schwach = paare.map(([n, a, b]) => [n, K(a, b)]).filter(([, k]) => k < 4.5);
    pruef(schwach.length === 0, breite + " px · jede Schrift ≥ 4,5:1 auf ihrem Grund",
      schwach.map(([n, k]) => n + " " + k.toFixed(2)).join(", ") || paare.map(([n, a, b]) => n + " " + K(a, b).toFixed(1)).join(", "));
    pruef(m.feldPx >= 16, breite + " px · Eingabe 16 px (kein Zoomen auf iOS)", m.feldPx + " px");
    pruef(Math.min(...m.knoepfe) >= 44 && m.eingabeHoch >= 44, breite + " px · Tapflächen ≥ 44 px", m.knoepfe.concat(m.eingabeHoch).map(Math.round).join("/"));
    pruef(m.ueberlauf <= 0 && m.karteRechts <= m.breit - 15, breite + " px · kein Überlauf, 16 px Rand", JSON.stringify({ ueberlauf:m.ueberlauf, rechts:Math.round(m.karteRechts) }));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
