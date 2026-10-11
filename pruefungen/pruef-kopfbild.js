/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Kopfbild, eigenes Logo, Haus-Seite (Wunsch 11.10.)
   (braucht dist/)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-kopfbild.js

   „Ganz oben ein Hintergrundbild … der Rand des Bildes ist die Mitte
   vom Kreis-Logo. Das Logo im Board einfügbar und zuschneidbar, rund
   oder eckig. Ein Tipp aufs Logo zeigt alle wichtigen Infos.“

   1 · Naht (zweite Quelle): Der Pfad, unter dem das Board hochlädt,
       passt auf das Muster, das der Hub annimmt (kopfBildOk) — beide
       aus den Dateien gelesen, nicht hier abgeschrieben.
   2 · Hub, alle Häuser, 360/390/430/1280 px:
       - ohne Kopf: kein Bild, Logo 58 px, kein data-kopfbild (§2.5);
       - mit Bild: Bild geladen, reicht über die ganze Breite, LOGO-
         MITTE AUF DER BILDKANTE (±1 px) und waagerecht mittig, kein
         Seitenüberlauf, Öffnungsanzeige ≥ 4,5:1 auf ihrer Fläche
         (über Weiß UND Schwarz gemischt — das Foto darunter ist
         beliebig);
       - eigenes Logo rund (Kreis) / eckig (22 %), Siegel weg;
       - Unterseite: kein Kopfbild, schmale Leiste;
       - fremder Server, http:, javascript:, Anführungszeichen,
         anderer Ordner → nichts geladen (Anfragen gezählt), kein Bild.
   3 · Haus-Seite: echter Tipp aufs Logo → #/haus; Name, Slogan,
       Woche (7 Zeilen), „Über uns“ aus hub_texte als TEXT (ein
       <img onerror> bleibt Text), jede Zeile ≥ 4,5:1, Knöpfe ≥ 44 px,
       kein Überlauf; zweiter Tipp aufs Logo → zurück zur Übersicht;
       Arabisch: Beschriftung des Logos übersetzt.
   4 · Zweiter Besuch ohne Netz: das gemerkte Kopfbild steht sofort.
   5 · Board (gestelltes db über betriebWaehlen, echte Hub-Datei in der
       Vorschau): Gruppe nur Inhaber, Bild wählen → Zuschnitt 16:9,
       Logo → 1:1 mit runder bzw. eckiger Maske; Vorschau zeigt Bild
       und Form; „Übernehmen“ lädt nach <Betrieb>/kopf/ hoch, führt
       hub_stil zusammen (Nachbarn bleiben, < 600 Bytes); „Über uns“
       in „Ihre Worte“ geht in hub_texte.ueber und lässt unbekannte
       Schlüssel stehen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const DIST = process.env.DIST || path.join(OBEN, "dist");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const BASIS = "https://omoteno.test/h/";
/* Das Vorführhaus fragt die Datenbank nie (pruef-demo.js) — eine
   gestellte Zeile mit Kopfbild käme dort gar nicht an. Namentlich
   ausgenommen, nicht per Muster. */
const VORFUEHRHAUS = h => { try{ return !!JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", h + ".json"), "utf8")).demo; }catch(e){ return false; } };
const HAEUSER = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html")) && !VORFUEHRHAUS(d));
const BETRIEB = "11111111-2222-3333-4444-555555555555";
const EIMER = "https://quxwweuvdqtjsdwgjdrh.supabase.co/storage/v1/object/public/gerichte/";
const BILD = EIMER + BETRIEB + "/kopf/bild-1760000000000.jpg";
const LOGO = EIMER + BETRIEB + "/kopf/logo-1760000000000.png";

let n = 0, f = 0;
function pruef(b, t, d){
  n++; if(!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

/* Testbilder werden hier gemalt — keine Binärdatei im Verzeichnis. */
async function bilderMalen(br){
  const p = await br.newPage({ viewport:{ width:800, height:450 } });
  await p.setContent(`<body style="margin:0"><canvas id=c width=800 height=450></canvas><script>
    const c=document.getElementById('c').getContext('2d');const g=c.createLinearGradient(0,0,800,450);
    g.addColorStop(0,'#ffffff');g.addColorStop(.5,'#f0d9b0');g.addColorStop(1,'#20120c');c.fillStyle=g;c.fillRect(0,0,800,450);</script></body>`);
  const kopf = await p.screenshot({ type:"jpeg", quality:80 });
  await p.setViewportSize({ width:256, height:256 });
  await p.setContent(`<body style="margin:0;background:#1d4a3c;display:grid;place-items:center;height:256px;font:700 120px Georgia;color:#f4e9d2">N</body>`);
  const logo = await p.screenshot();
  await p.close();
  return { kopf, logo };
}

const MESSUNG = `(() => {
  const zahl = t => { const s = String(t); const w = (s.match(/[\\d.]+/g) || []).map(Number);
    return /^color\\(srgb/.test(s) ? w.map((x, i) => i < 3 ? x * 255 : x) : w; };
  const kanal = c => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
  const leucht = p => .2126*kanal(p[0]) + .7152*kanal(p[1]) + .0722*kanal(p[2]);
  const mischen = (o, u) => { const a = o.length > 3 ? o[3] : 1; return [0,1,2].map(i => o[i]*a + u[i]*(1-a)); };
  const kontrast = (a, b) => { const x = leucht(a), y = leucht(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
  /* Grund eines Elements: die erste deckende Fläche die Eltern hinauf;
     halbdurchsichtige Flächen werden über den Rest gemischt. */
  const grund = (el, unten) => {
    const stapel = [];
    for(let e = el; e; e = e.parentElement){ const b = zahl(getComputedStyle(e).backgroundColor);
      if(b.length && !(b.length > 3 && b[3] === 0)) stapel.push(b); if(b.length && (b.length < 4 || b[3] === 1)) break; }
    let g = unten || zahl(getComputedStyle(document.documentElement).backgroundColor);
    for(let i = stapel.length - 1; i >= 0; i--) g = mischen(stapel[i], g);
    return g;
  };
  return { zahl, kontrast, grund, mischen };
})()`;

async function hubOeffnen(br, haus, breite, opt){
  opt = opt || {};
  const ctx = opt.ctx || await br.newContext({ viewport:{ width:breite, height:844 } });
  const p = await ctx.newPage();
  const fehler = [], geladen = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
  if(opt.sprache) await p.addInitScript(s => { try{ localStorage.setItem("tapto-sprache", s); }catch(e){} }, opt.sprache);
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(/\.(jpg|jpeg|png|webp)(\?|$)/.test(u) || u.startsWith("http://")) geladen.push(u);
    if(u.startsWith(EIMER + BETRIEB + "/kopf/")) return r.fulfill({ status:200,
      contentType: u.endsWith(".png") ? "image/png" : "image/jpeg", body: u.endsWith(".png") ? opt.bilder.logo : opt.bilder.kopf });
    if(opt.offline) return r.abort();
    if(/\/rest\/v1\/betriebe\?/.test(u)) return r.fulfill({ status:200, contentType:"application/json",
      body:JSON.stringify([{ id:"b1", bestell_pause:false, hub_texte:opt.texte || {}, hub_stil:opt.stil || {} }]) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await p.goto("file://" + path.join(DIST, haus, "index.html") + (opt.hash || "#/"));
  await p.waitForTimeout(1300);
  return { ctx, p, fehler, geladen };
}

const kopfMessen = p => p.evaluate(m => {
  const M = eval(m);
  const bild = document.getElementById("kopfbild"), img = bild.querySelector("img");
  const logo = document.getElementById("logo");
  const rb = bild.getBoundingClientRect(), rl = logo.getBoundingClientRect();
  const rk = document.querySelector("header").getBoundingClientRect();
  const st = document.querySelector("#status .status");
  let stK = null;
  if(st){
    const fl = M.zahl(getComputedStyle(st).backgroundColor), schrift = M.zahl(getComputedStyle(st).color);
    stK = Math.min(M.kontrast(schrift, M.mischen(fl, [255,255,255])), M.kontrast(schrift, M.mischen(fl, [0,0,0])));
  }
  const eigen = document.getElementById("logoEigen");
  const siegel = logo.querySelector(":scope > svg, :scope > img");
  return {
    an: document.body.dataset.kopfbild === "an", anzeige: getComputedStyle(bild).display,
    geladen: !!(img && img.complete && img.naturalWidth > 0),
    links: Math.round(rb.left - rk.left), rechts: Math.round(rb.right - rk.right), vw: innerWidth, kopfMitte: rk.left + rk.width / 2,
    kante: rb.bottom, logoMitteY: rl.top + rl.height / 2, logoMitteX: rl.left + rl.width / 2, logoGr: Math.round(rl.width),
    ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    stK, eigen: getComputedStyle(eigen).display !== "none" && !!eigen.querySelector("img"),
    siegelSicht: siegel ? getComputedStyle(siegel).display !== "none" : false,
    radius: getComputedStyle(logo).borderRadius, form: document.body.dataset.logoform || "rund"
  };
}, MESSUNG);

(async () => {
  const br = await chromium.launch();
  const bilder = await bilderMalen(br);

  console.log("\n══ 1 · Naht Board → Hub ══");
  const admin = fs.readFileSync(ADMIN, "utf8"), vorlage = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");
  const muster = (vorlage.match(/function kopfBildOk[\s\S]*?\n\s*(\/\^\[0-9a-f\][^\n]*?\$\/)\s*\n/) || [])[1];
  const pfadBau = (admin.match(/const pfad = betriebId \+ "\/kopf\/" \+ art \+ "-" \+ Date\.now\(\) \+ "\." \+ endung;/) || [])[0];
  const eimerBoard = /db\.storage\.from\("gerichte"\)\.upload\(pfad/.test(admin);
  const eimerHub = /object\/public\/gerichte\//.test((vorlage.match(/function kopfBildOk[\s\S]*?\n\}/) || [""])[0]);
  pruef(!!muster && !!pfadBau, "Muster im Hub und Pfad im Board gefunden", (muster || "–").slice(0, 60));
  if(muster){
    const re = eval(muster);
    const proben = ["bild", "logo"].flatMap(a => ["webp", "jpg"].map(e => BETRIEB + "/kopf/" + a + "-" + Date.now() + "." + e));
    pruef(proben.every(x => re.test(x)), "jeder Pfad, den das Board baut, passt auf das Muster des Hubs", proben[0]);
    pruef(!re.test(BETRIEB + "/kacheln/bild-1.jpg") && !re.test("../kopf/x.jpg") && !re.test(BETRIEB + "/kopf/x.svg"),
      "anderer Ordner, Pfadsprung, SVG passen nicht");
  }
  pruef(eimerBoard && eimerHub, "Board lädt in den Eimer, den der Hub annimmt (gerichte)");

  console.log("\n══ 2 · Hub: Kopfbild und Logo ══");
  for(const haus of HAEUSER){
    for(const breite of [360, 390, 430, 1280]){
      const ohne = await hubOeffnen(br, haus, breite, { bilder });
      const o = await kopfMessen(ohne.p);
      pruef(!o.an && o.anzeige === "none" && o.logoGr === 58 && o.siegelSicht && !o.eigen,
        haus + " " + breite + ": ohne Kopf alles wie vorher", JSON.stringify({ an:o.an, gr:o.logoGr }));
      await ohne.ctx.close();

      const mit = await hubOeffnen(br, haus, breite, { bilder, stil:{ emoji:false, kopf:{ bild:BILD, logo:LOGO, form:"rund" } } });
      const m = await kopfMessen(mit.p);
      pruef(m.an && m.geladen, haus + " " + breite + ": Kopfbild geladen");
      pruef(m.links <= 0 && m.rechts >= 0, haus + " " + breite + ": Bild über die ganze Breite des Kopfbands", m.links + " / " + m.rechts);
      pruef(Math.abs(m.logoMitteY - m.kante) <= 1, haus + " " + breite + ": Logo-Mitte auf der Bildkante",
        Math.round(m.logoMitteY) + " / " + Math.round(m.kante));
      pruef(Math.abs(m.logoMitteX - m.kopfMitte) <= 1, haus + " " + breite + ": Logo waagerecht mittig", Math.round(m.logoMitteX) + " / " + Math.round(m.kopfMitte));
      pruef(m.ueber <= 0, haus + " " + breite + ": kein Seitenüberlauf", m.ueber);
      pruef(m.stK === null || m.stK >= 4.5, haus + " " + breite + ": Öffnungsanzeige auf dem Foto ≥ 4,5:1", m.stK && m.stK.toFixed(2));
      pruef(m.eigen && !m.siegelSicht && m.radius === "50%", haus + " " + breite + ": eigenes Logo rund, Siegel weg", m.radius);
      if(breite === 390){
        await mit.p.evaluate(() => { location.hash = "#/speisekarte"; });
        await mit.p.waitForTimeout(400);
        const u = await kopfMessen(mit.p);
        pruef(u.anzeige === "none" && u.logoGr === 40 && u.eigen, haus + ": Unterseite ohne Kopfbild, schmale Leiste mit Logo", u.anzeige + " / " + u.logoGr);
      }
      pruef(!mit.fehler.length, haus + " " + breite + ": keine Seitenfehler", mit.fehler.join(" | ") || "–");
      await mit.ctx.close();
    }
    const eck = await hubOeffnen(br, haus, 390, { bilder, stil:{ kopf:{ logo:LOGO, form:"eckig" } } });
    const e = await kopfMessen(eck.p);
    pruef(e.eigen && e.form === "eckig" && e.radius === "22%" && !e.an, haus + ": Logo eckig, ohne Kopfbild bleibt der Kopf", e.radius);
    await eck.ctx.close();
  }

  console.log("\n══ 2b · Nur das eigene Ordnermuster wird geladen ══");
  const boese = ["https://boese.example/kopf.jpg", "http://quxwweuvdqtjsdwgjdrh.supabase.co/storage/v1/object/public/gerichte/" + BETRIEB + "/kopf/b.jpg",
    "javascript:alert(1)", EIMER + BETRIEB + "/kopf/b.jpg\" onerror=\"window.__x=1", EIMER + BETRIEB + "/kacheln/b.jpg",
    EIMER + "fremd/kopf/b.jpg"];
  for(const u of boese){
    const h = await hubOeffnen(br, HAEUSER[0], 390, { bilder, stil:{ kopf:{ bild:u, logo:u } } });
    const m = await kopfMessen(h.p);
    const x = await h.p.evaluate(() => window.__x === 1);
    pruef(!m.an && !m.eigen && !h.geladen.some(g => g.indexOf("b.jpg") >= 0 || g.indexOf("boese") >= 0) && !x,
      "verworfen: " + u.slice(0, 70), h.geladen.join(",") || "nichts geladen");
    await h.ctx.close();
  }

  console.log("\n══ 3 · Haus-Seite hinter dem Logo ══");
  for(const haus of HAEUSER){
    const h = await hubOeffnen(br, haus, 390, { bilder, stil:{ kopf:{ bild:BILD, logo:LOGO, form:"eckig" } },
      texte:{ ueber:"Seit 2019 backen wir selbst.\n<img src=x onerror=\"window.__x=1\">" } });
    await h.p.click("#logo");
    await h.p.waitForTimeout(500);
    const s = await h.p.evaluate(m => {
      const M = eval(m);
      const seite = document.querySelector("#inhalt .hp");
      if(!seite) return null;
      const texte = [...seite.querySelectorAll("h2,p,.zeile span,.knopf,h3")].filter(el => el.getClientRects().length && el.textContent.trim());
      const schlecht = texte.map(el => { const k = M.kontrast(M.zahl(getComputedStyle(el).color), M.grund(el));
        return { t: el.textContent.trim().slice(0, 30), k }; }).filter(x => x.k < 4.5);
      const knoepfe = [...seite.querySelectorAll(".knopf")].map(k => k.getBoundingClientRect().height);
      const ueber = seite.querySelector(".hp-ueber p");
      return { hash: location.hash, name: (seite.querySelector(".hp-name") || {}).textContent,
        zeilen: seite.querySelectorAll(".zeile").length, schlecht, knoepfe,
        ueberText: ueber ? ueber.textContent : "", ueberImg: ueber ? ueber.querySelectorAll("img").length : -1,
        bild: !!seite.querySelector(".hp-bild img"), logoEck: !!seite.querySelector(".hp-logo.eckig img"),
        ueberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        x: window.__x === 1, label: document.getElementById("logo").getAttribute("aria-label") };
    }, MESSUNG);
    pruef(s && s.hash === "#/haus", haus + ": echter Tipp aufs Logo öffnet die Haus-Seite", s && s.hash);
    if(!s) continue;
    const mb = JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", haus + ".json"), "utf8"));
    pruef(s.name === (mb.betrieb && mb.betrieb.name), haus + ": Name aus dem Markenblatt", s.name);
    pruef(s.zeilen === 7 && s.bild && s.logoEck, haus + ": Woche, Kopfbild und eckiges Logo da", s.zeilen);
    pruef(/Seit 2019/.test(s.ueberText) && /<img/.test(s.ueberText) && s.ueberImg === 0 && !s.x,
      haus + ": „Über uns“ als Text, ein <img onerror> bleibt Text");
    pruef(!s.schlecht.length, haus + ": jede Schrift ≥ 4,5:1", s.schlecht.map(x => x.t + " " + x.k.toFixed(2)).join(" | ") || "alle");
    pruef(s.knoepfe.length >= 2 && s.knoepfe.every(x => x >= 44), haus + ": Knöpfe ≥ 44 px", s.knoepfe.map(Math.round).join(","));
    pruef(s.ueberlauf <= 0, haus + ": kein Seitenüberlauf", s.ueberlauf);
    pruef(s.label !== "Alles über uns", haus + ": auf der Haus-Seite führt das Logo zurück (Beschriftung)", s.label);
    await h.p.click("#logo"); await h.p.waitForTimeout(400);
    const zurueck = await h.p.evaluate(() => ({ h: location.hash, a: document.body.dataset.ansicht }));
    pruef(zurueck.a === "start", haus + ": zweiter Tipp aufs Logo → Übersicht", zurueck.h);
    pruef(!h.fehler.length, haus + ": keine Seitenfehler", h.fehler.join(" | ") || "–");
    await h.ctx.close();
  }
  {
    const h = await hubOeffnen(br, HAEUSER[0], 390, { bilder, sprache:"ar" });
    const a = await h.p.evaluate(() => ({ l: document.getElementById("logo").getAttribute("aria-label"), dir: document.documentElement.dir }));
    pruef(a.l && a.l !== "Alles über uns" && a.dir === "rtl", "Arabisch: Beschriftung des Logos übersetzt", a.l);
    await h.ctx.close();
  }

  console.log("\n══ 4 · Zweiter Besuch ohne Netz ══");
  {
    const ctx = await br.newContext({ viewport:{ width:390, height:844 } });
    const eins = await hubOeffnen(br, HAEUSER[0], 390, { ctx, bilder, stil:{ kopf:{ bild:BILD } } });
    await eins.p.close();
    const zwei = await hubOeffnen(br, HAEUSER[0], 390, { ctx, bilder, offline:true });
    const m = await kopfMessen(zwei.p);
    pruef(m.an && m.geladen, "gemerktes Kopfbild steht ohne Datenbank");
    await ctx.close();
  }

  console.log("\n══ 5 · Board: Kopf & Logo ══");
  {
    const ctx = await br.newContext({ viewport:{ width:390, height:900 } });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.addInitScript(b => { window.HUB_VORSCHAU_BASIS = b;
      Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; }, BASIS);
    await p.route("**/*", r => {
      const u = r.request().url();
      if(u.startsWith("file://")) return r.continue();
      if(u === BASIS + "blend/") return r.fulfill({ status:200, contentType:"text/html; charset=utf-8",
        headers:{ "Access-Control-Allow-Origin":"*" }, body:fs.readFileSync(path.join(DIST, "blend", "index.html"), "utf8") });
      if(u.startsWith(EIMER)) return r.fulfill({ status:200, contentType:"image/jpeg", body:bilder.kopf });
      return r.fulfill({ status:200, contentType:"application/json", headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" });
    });
    await p.goto("file://" + ADMIN);
    await p.waitForTimeout(600);
    const BB = { id:BETRIEB, slug:"blend", name:"Blend", rolle:"inhaber", bestell_pause:false,
      hub_texte:{ claim:"Hallo", eigen:{ "Speisekarte":{ de:"Karte" } } },
      hub_stil:{ emoji:false, schrift:{ kopf:"fraunces" } }, markenblatt:null };
    await p.evaluate(bb => {
      window.__schreib = []; window.__hoch = [];
      function antwort(z){
        if(z.op !== "select"){ window.__schreib.push({ tab:z.tab, op:z.op, daten:JSON.parse(JSON.stringify(z.daten || null)) });
          return { data:null, error:null }; }
        if(z.tab === "betrieb_mitglieder") return { data:[{ rolle:bb.rolle, betriebe:Object.assign({}, bb) }], error:null };
        return { data: z.einzeln ? null : [], error:null };
      }
      function kette(tab){
        const z = { tab, op:"select", daten:null, einzeln:false };
        const p = new Proxy(function(){}, { get(_, k){
          if(k === "then") return res => res(antwort(z));
          return (...a) => { if(["update","insert","upsert","delete"].includes(k)){ z.op = k; z.daten = a[0]; }
            if(k === "maybeSingle" || k === "single") z.einzeln = true; return p; }; }, apply(){ return p; } });
        return p;
      }
      const speicher = { upload: async (pfad, blob, o) => { window.__hoch.push({ pfad, typ:o && o.contentType, gr:blob.size }); return { error:null }; },
        getPublicUrl: pfad => ({ data:{ publicUrl:"https://quxwweuvdqtjsdwgjdrh.supabase.co/storage/v1/object/public/gerichte/" + pfad } }) };
      db = { from:kette, rpc:() => kette("rpc"), channel:() => kette("kanal"), removeChannel:async () => {},
        storage:{ from:() => speicher }, functions:{ invoke:async () => ({ data:null, error:null }) },
        auth:{ getSession:async () => ({ data:{ session:null } }),
               getUser:async () => ({ data:{ user:{ id:"u1", email:"probe@example.org" } } }),
               onAuthStateChange:() => ({ data:{ subscription:{ unsubscribe(){} } } }) } };
      demo = false;
    }, BB);
    await p.evaluate(async id => { document.getElementById("tor").hidden = true;
      try{ localStorage.setItem(merkSchluessel(), id); }catch(e){}
      await betriebWaehlen(); }, BB.id);
    await p.waitForTimeout(300);
    await p.evaluate(() => { const s = document.getElementById("scharf"); if(s) s.hidden = true;
      document.querySelector('[data-tafel="startseite"]').click(); });
    await p.waitForTimeout(500);
    const gr = await p.evaluate(() => { const g = document.getElementById("kfGruppe");
      return { da:!!g, inhaber:g && g.hasAttribute("data-nur-inhaber"), sichern:document.getElementById("kfSichern").disabled }; });
    pruef(gr.da && gr.inhaber && gr.sichern, "Gruppe da, nur Inhaber, „Übernehmen“ erst nach einer Änderung");

    const datei = { name:"kopf.jpg", mimeType:"image/jpeg", buffer:bilder.kopf };
    await p.click("#kfBildWahl");
    await p.setInputFiles("#kfDatei", datei);
    await p.waitForTimeout(500);
    const z1 = await p.evaluate(() => { const b = document.getElementById("kfBlatt"), r = document.getElementById("kfRahmen").getBoundingClientRect();
      return { offen:!b.hidden, art:b.dataset.art, format:r.width / r.height, maske:getComputedStyle(b.querySelector(".kfmaske")).display }; });
    pruef(z1.offen && z1.art === "bild" && Math.abs(z1.format - 16 / 9) < 0.02 && z1.maske === "none", "Kopfbild: Zuschnitt 16:9 ohne Maske", z1.format.toFixed(3));
    await p.click("#kfBlattOk"); await p.waitForTimeout(700);

    await p.click("#kfLogoWahl");
    await p.setInputFiles("#kfDatei", { name:"logo.png", mimeType:"image/png", buffer:bilder.logo });
    await p.waitForTimeout(500);
    await p.evaluate(() => { document.querySelector('#kfForm [data-kf-form="eckig"]').click(); });
    const z2 = await p.evaluate(() => { const b = document.getElementById("kfBlatt"), r = document.getElementById("kfRahmen").getBoundingClientRect();
      return { art:b.dataset.art, format:r.width / r.height, maske:getComputedStyle(b.querySelector(".kfmaske")).borderRadius }; });
    pruef(z2.art === "logo" && Math.abs(z2.format - 1) < 0.02 && z2.maske === "50%", "Logo: Zuschnitt 1:1 mit runder Maske", z2.maske);
    await p.click("#kfBlattOk"); await p.waitForTimeout(700);
    await p.click('#kfForm [data-kf-form="eckig"]'); await p.waitForTimeout(800);

    const hoch = await p.evaluate(() => window.__hoch);
    pruef(hoch.length === 2 && hoch.every(h => h.pfad.startsWith(BETRIEB + "/kopf/") && /\/kopf\/(bild|logo)-\d+\.(webp|jpg)$/.test(h.pfad)),
      "zwei Uploads in <Betrieb>/kopf/", hoch.map(h => h.pfad + " " + h.typ).join(" | "));
    const rahmen = await p.evaluate(() => { const h = hvAlle().startseite; if(!h || !h.frame) return null;
      const d = h.frame.contentWindow.document; const img = d.querySelector("#kopfbild img");
      return { an:d.body.dataset.kopfbild, form:d.body.dataset.logoform, logo:d.body.dataset.logo, img:!!img }; });
    pruef(rahmen && rahmen.an === "an" && rahmen.img && rahmen.logo === "eigen" && rahmen.form === "eckig",
      "Vorschau zeigt Kopfbild und eckiges Logo, bevor gespeichert ist", JSON.stringify(rahmen));

    await p.click("#kfSichern"); await p.waitForTimeout(400);
    const schreib = await p.evaluate(() => window.__schreib.filter(w => w.tab === "betriebe" && w.op === "update"));
    const stil = schreib.length ? schreib[schreib.length - 1].daten.hub_stil : null;
    pruef(stil && stil.emoji === false && stil.schrift && stil.schrift.kopf === "fraunces" && stil.kopf && stil.kopf.form === "eckig" &&
          /\/kopf\/bild-/.test(stil.kopf.bild) && /\/kopf\/logo-/.test(stil.kopf.logo),
      "„Übernehmen“ führt hub_stil zusammen (Emoji, Schrift bleiben)", JSON.stringify(stil).slice(0, 160));
    pruef(stil && JSON.stringify(stil).length < 600, "hub_stil bleibt klein", stil && JSON.stringify(stil).length + " Bytes");

    /* „Über uns“ in „Ihre Worte“ */
    await p.evaluate(() => tafelZeigen("einstellungen"));
    await p.waitForTimeout(400);
    await p.evaluate(() => { const f = document.getElementById("hubUeber"); f.value = "Seit 2019 hier."; f.dispatchEvent(new Event("input", { bubbles:true })); });
    await p.evaluate(() => hubTexteSichern());
    await p.waitForTimeout(300);
    const worte = await p.evaluate(() => window.__schreib.filter(w => w.tab === "betriebe" && w.daten && w.daten.hub_texte).pop());
    const ht = worte && worte.daten.hub_texte;
    pruef(ht && ht.ueber === "Seit 2019 hier." && ht.claim === "Hallo" && ht.eigen && ht.eigen.Speisekarte,
      "„Über uns“ geht in hub_texte.ueber, unbekannte Schlüssel bleiben stehen", JSON.stringify(ht));
    pruef(!fehler.length, "Board: keine Seitenfehler", fehler.join(" | ") || "–");
    await ctx.close();
  }

  await br.close();
  console.log("\n" + (f ? f + " von " + n + " FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden"));
  process.exit(f ? 1 : 0);
})();
