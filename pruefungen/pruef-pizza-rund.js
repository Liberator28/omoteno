/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Pizza rund ausschneiden (Board) und Teller-Bühne (Hub)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-pizza-rund.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   > Anlass (17.10., neuer Kunde Più Gusto): „Die Pizzen sollen gut
   > sichtbar sein, und man soll vor allem bei den Pizzen switchen
   > können. Die Pizza komplett in der Mitte ausgeschnitten, rund
   > einfügbar, erkennt automatisch die Ränder.“

   A · Erkennung (gbKreisFinden aus seiten/admin.html — die Datei selbst,
       keine Kopie) gegen gezeichnete Pizzen: auf Holz (Kruste kaum
       anders als das Brett), auf weißem und dunklem Teller (der Teller-
       Rand ist ein zweiter, größerer Kreis), versetzt, Hochformat mit
       Rauschen, klein. Fehler der Mitte und des Radius ≤ 3 % des Radius,
       Güte über der Schwelle. Gegenfall ohne Kreis: Güte UNTER der
       Schwelle (sonst behauptete das Board „erkannt“).
   B · Board über den echten Weg: Datei in #fDatei, „Rund ausschneiden“,
       der erkannte Kreis füllt den Rahmen (Mitte und Durchmesser),
       „Zuschnitt übernehmen“ lädt Quadrat UND Rund in <Betrieb>/…,
       der runde ist durchsichtig in den Ecken und deckend in der Mitte,
       und #fBildFrei trägt seine Adresse (wird zu bild_frei). Gegenfall:
       Bild ohne Kreis → Satz „nicht sicher erkannt“, Kreis mittig.
   C · Hub, Stil „teller“ (Più Gusto): je Kategorie eine Bühne, die Liste
       darunter unverändert (Zahl der .gericht); Pfeil → nächstes
       Gericht AM SELBEN Element (§4.3) mit laufender Bewegung nur auf
       transform/opacity; vom ersten zurück → letztes; echter Finger
       (CDP): langer Zug wechselt, kurzer federt zurück, die Unterseite
       wechselt dabei NICHT; „+“ legt genau das gezeigte Gericht in die
       Auswahl; „Beläge wählen“ öffnet sein Blatt; Freisteller aus der
       Datenbank steht rund auf dem Teller; reduzierte Bewegung ohne
       Animation; Arabisch gespiegelt; Pfeile ≥ 44 px; Schrift ≥ 4,5:1;
       360/430/1280 ohne Überlauf.
   D · Beläge des Betriebs: betriebe.optionen geht durch die Prüfung des
       Hubs (Anführungszeichen, Komma → weg), wird gemerkt und steht beim
       zweiten Besuch vor dem ersten Abruf da (§8.1q); die Naht zum
       Server: Trenner von optText = Trenner in positionen_pruefen,
       verbotene Zeichen in Schranke und Hub gleich (zweite Quelle:
       datenbank/migration-optionen.sql).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const HUB = path.join(OBEN, "dist", "piugusto", "index.html");
const MIGRATION = path.join(OBEN, "datenbank", "migration-optionen.sql");
const BETRIEB = "1635382f-f641-42ba-b26e-2542e16da974";
const EIMER = "https://quxwweuvdqtjsdwgjdrh.supabase.co/storage/v1/object/public/gerichte/";

let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

const admin = fs.readFileSync(ADMIN, "utf8");
const ERKENNUNG = admin.slice(admin.indexOf("function gbKreisFinden(bild){"), admin.indexOf("function gbRundStand("));
const SCHWELLE = Number((admin.match(/const GB_RUND_GUETE = ([\d.]+);/) || [])[1]);

/* Gezeichnete Pizza: Kruste, Sauce, Käse, Salami, Röstflecken — Belag
   mit eigenen runden Kanten, damit die Erkennung nicht am Belag hängt. */
const ZEICHNER = `
function zufall(s){ return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function pizza(st, cx, cy, r, z){
  st.fillStyle = "#C98B4A"; st.beginPath(); st.arc(cx, cy, r, 0, 7); st.fill();
  st.fillStyle = "#B52A1C"; st.beginPath(); st.arc(cx, cy, r * .86, 0, 7); st.fill();
  for(let i = 0; i < 40; i++){ const a = z() * 7, d = z() * r * .78; st.fillStyle = "#F2D16B";
    st.beginPath(); st.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * .12, r * .08, z() * 3, 0, 7); st.fill(); }
  for(let i = 0; i < 12; i++){ const a = z() * 7, d = z() * r * .7; st.fillStyle = "#8E1F1F";
    st.beginPath(); st.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * .09, 0, 7); st.fill(); }
  for(let i = 0; i < 25; i++){ const a = z() * 7, d = r * (.88 + z() * .1); st.fillStyle = "#8A5526";
    st.beginPath(); st.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * .02, 0, 7); st.fill(); }
}
function holz(st, w, h, z){ for(let x = 0; x < w; x += 6){ st.fillStyle = "hsl(28," + (40 + z() * 15) + "%," + (34 + z() * 10) + "%)"; st.fillRect(x, 0, 6, h); } }
function rauschen(st, w, h, z, s){ const d = st.getImageData(0, 0, w, h); for(let i = 0; i < d.data.length; i += 4){ const v = (z() - .5) * s;
  d.data[i] += v; d.data[i + 1] += v; d.data[i + 2] += v; } st.putImageData(d, 0, 0); }
function bildFall(f, saat){
  const z = zufall(saat);
  const fl = document.createElement("canvas"); fl.width = f.w; fl.height = f.h; const st = fl.getContext("2d");
  if(f.grund === "holz") holz(st, f.w, f.h, z); else { st.fillStyle = f.grund; st.fillRect(0, 0, f.w, f.h); }
  if(f.teller){ st.fillStyle = f.tellerFarbe || "#F4F2EE"; st.beginPath(); st.arc(f.cx, f.cy, f.teller, 0, 7); st.fill(); }
  if(!f.leer) pizza(st, f.cx, f.cy, f.r, z);
  else for(let i = 0; i < 60; i++){ st.fillStyle = "hsl(" + z() * 360 + ",50%,50%)"; st.fillRect(z() * f.w, z() * f.h, 30 + z() * 120, 20 + z() * 80); }
  if(f.rausch) rauschen(st, f.w, f.h, z, f.rausch);
  return fl;
}`;
const FAELLE = [
  { name:"Holz, mittig", w:1200, h:900, cx:600, cy:450, r:360, grund:"holz" },
  { name:"Holz, versetzt", w:1200, h:900, cx:520, cy:400, r:300, grund:"holz" },
  { name:"weißer Teller auf Holz (Teller-Rand größer)", w:1000, h:1000, cx:500, cy:500, r:330, teller:400, grund:"holz" },
  { name:"Hochformat mit Rauschen", w:900, h:1200, cx:450, cy:640, r:330, grund:"holz", rausch:50 },
  { name:"dunkler Teller auf Schiefer", w:1200, h:1200, cx:610, cy:590, r:420, teller:520, tellerFarbe:"#2B2B2E", grund:"#3A3F44" },
  { name:"kleine Pizza auf hellem Tisch", w:1200, h:900, cx:600, cy:450, r:190, grund:"#E9E2D6" }
];
const GEGENFALL = { name:"ohne Kreis", w:1200, h:900, grund:"holz", leer:true, rausch:40 };

async function pngVon(browser, fall, saat){
  const p = await browser.newPage();
  await p.setContent("<body></body>");
  await p.addScriptTag({ content: ZEICHNER });
  const b64 = await p.evaluate(([fall, saat]) => bildFall(fall, saat).toDataURL("image/png").split(",")[1], [fall, saat]);
  await p.close();
  return Buffer.from(b64, "base64");
}

/* ── A · Erkennung ─────────────────────────────────────────────── */
async function teilA(browser){
  console.log("\n══ A · Erkennung ══");
  pruef(ERKENNUNG.length > 2000 && SCHWELLE > 0, "gbKreisFinden und GB_RUND_GUETE aus admin.html gelesen", "Schwelle " + SCHWELLE);
  const p = await browser.newPage();
  await p.setContent("<body></body>");
  await p.addScriptTag({ content: ZEICHNER + "\n" + ERKENNUNG });
  const erg = await p.evaluate(async faelle => {
    const aus = [];
    for(let i = 0; i < faelle.length; i++){
      const fl = bildFall(faelle[i], 7 + i);
      const bild = new Image(); bild.src = fl.toDataURL("image/png"); await bild.decode();
      const t0 = performance.now(); const k = gbKreisFinden(bild);
      aus.push({ k, ms: performance.now() - t0 });
    }
    return aus;
  }, FAELLE.concat([GEGENFALL]));
  FAELLE.forEach((fa, i) => {
    const { k, ms } = erg[i];
    const em = Math.hypot(k.cx - fa.cx, k.cy - fa.cy) / fa.r * 100, er = Math.abs(k.r - fa.r) / fa.r * 100;
    pruef(em <= 3 && er <= 3 && k.guete >= SCHWELLE, fa.name + ": Mitte " + em.toFixed(1) + " %, Radius " + er.toFixed(1) + " %, Güte " + k.guete.toFixed(2),
      Math.round(ms) + " ms");
  });
  const g = erg[FAELLE.length].k;
  pruef(g.guete < SCHWELLE, "Gegenfall ohne Kreis: Güte unter der Schwelle (kein „erkannt“)", g.guete.toFixed(2));
  pruef(erg.every(e => e.ms < 1500), "jede Erkennung unter 1,5 s", erg.map(e => Math.round(e.ms)).join(" "));
  await p.close();
}

/* ── B · Board ─────────────────────────────────────────────────── */
async function teilB(browser){
  console.log("\n══ B · Board: rund ausschneiden ══");
  const pizzaPng = await pngVon(browser, FAELLE[1], 8);
  const leerPng = await pngVon(browser, GEGENFALL, 13);
  const ctx = await browser.newContext({ viewport:{ width:430, height:900 } });
  const p = await ctx.newPage();
  const fehler = []; p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://") || u.startsWith("data:") || u.startsWith("blob:")) return r.continue();
    return r.fulfill({ status:200, contentType:"application/json", headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" });
  });
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(600);
  await p.evaluate(id => {
    window.__hoch = [];
    function kette(tab){
      const p = new Proxy(function(){}, { get(_, k){
        if(k === "then") return res => res({ data: tab === "betrieb_mitglieder"
          ? [{ rolle:"inhaber", betriebe:{ id, slug:"piugusto", name:"Più Gusto", hub_stil:{}, hub_texte:{} } }] : [], error:null });
        return () => p; }, apply(){ return p; } });
      return p;
    }
    const speicher = { upload: async (pfad, blob, o) => {
        const eintrag = { pfad, typ:o && o.contentType, gr:blob.size };
        if(/-rund\./.test(pfad)) eintrag.daten = await new Promise(f => { const l = new FileReader(); l.onload = () => f(l.result); l.readAsDataURL(blob); });
        window.__hoch.push(eintrag); return { error:null }; },
      getPublicUrl: pfad => ({ data:{ publicUrl:"https://quxwweuvdqtjsdwgjdrh.supabase.co/storage/v1/object/public/gerichte/" + pfad } }) };
    db = { from:kette, rpc:() => kette("rpc"), channel:() => kette("kanal"), removeChannel:async () => {},
      storage:{ from:() => speicher }, functions:{ invoke:async () => ({ data:null, error:null }) },
      auth:{ getSession:async () => ({ data:{ session:null } }), getUser:async () => ({ data:{ user:{ id:"u1" } } }),
             onAuthStateChange:() => ({ data:{ subscription:{ unsubscribe(){} } } }) } };
    demo = false;
  }, BETRIEB);
  await p.evaluate(async id => { document.getElementById("tor").hidden = true;
    try{ localStorage.setItem(merkSchluessel(), id); }catch(e){}
    await betriebWaehlen(); }, BETRIEB);
  await p.waitForTimeout(300);
  await p.evaluate(() => { const s = document.getElementById("scharf"); if(s) s.hidden = true; blattOeffnen(null); });
  await p.waitForTimeout(400);

  await p.setInputFiles("#fDatei", { name:"pizza.png", mimeType:"image/png", buffer:pizzaPng });
  await p.waitForTimeout(700);
  const vor = await p.evaluate(() => ({ offen: !document.getElementById("gbZuschnitt").hidden,
    kreis: !document.getElementById("gbKreis").hidden, knopf: document.getElementById("gbRund").getBoundingClientRect().height }));
  pruef(vor.offen && !vor.kreis, "Zuschnitt offen, Kreis erst nach dem Tipp");
  pruef(vor.knopf >= 44, "„Rund ausschneiden“ ≥ 44 px", vor.knopf);
  await p.click("#gbRund");
  await p.waitForTimeout(400);
  const lage = await p.evaluate(() => {
    const r = document.getElementById("gbRahmen").getBoundingClientRect(), z = gbZuschnitt, k = z.kreis;
    const m = gbGrundmass() * z.zoom;
    return { breite:r.width, mx:k.cx * m + z.dx, my:k.cy * m + z.dy, d:2 * k.r * m, guete:k.guete,
      kreis:!document.getElementById("gbKreis").hidden, druck:document.getElementById("gbRund").getAttribute("aria-pressed"),
      satz:document.getElementById("gbRundStand").textContent, schief:document.getElementById("gbRundStand").classList.contains("schief") };
  });
  pruef(lage.kreis && lage.druck === "true", "Kreis sichtbar, Knopf gedrückt (aria-pressed)");
  pruef(Math.abs(lage.mx - lage.breite / 2) <= lage.breite * .03 && Math.abs(lage.my - lage.breite / 2) <= lage.breite * .03,
    "erkannte Mitte liegt in der Rahmenmitte", lage.mx.toFixed(1) + "/" + lage.my.toFixed(1) + " von " + lage.breite.toFixed(0));
  pruef(Math.abs(lage.d - lage.breite) <= lage.breite * .03, "erkannter Durchmesser füllt den Rahmen", lage.d.toFixed(1) + " / " + lage.breite.toFixed(1));
  pruef(!lage.schief && /erkannt/.test(lage.satz), "Satz: Rand erkannt", lage.satz);

  await p.click("#gbOk");
  await p.waitForTimeout(1500);
  const hoch = await p.evaluate(() => window.__hoch.map(h => ({ pfad:h.pfad, typ:h.typ, daten:h.daten || "" })));
  const rund = hoch.find(h => /-rund\.(webp|png)$/.test(h.pfad));
  pruef(hoch.length === 3 && hoch.every(h => h.pfad.startsWith(BETRIEB + "/")), "drei Uploads in <Betrieb>/ (klein, groß, rund)",
    hoch.map(h => h.pfad.split("/").pop()).join(" | "));
  pruef(rund && /^image\/(webp|png)$/.test(rund.typ), "runder Ausschnitt als WebP oder PNG (nie JPEG — keine Durchsichtigkeit)", rund && rund.typ);
  const frei = await p.evaluate(() => document.getElementById("fBildFrei").value);
  pruef(rund && frei === EIMER_URL(rund.pfad), "#fBildFrei trägt die Adresse des runden Ausschnitts (→ bild_frei)", frei.slice(-60));
  if(rund){
    const alpha = await p.evaluate(async url => {
      const b = new Image(); b.src = url; await b.decode();
      const c = document.createElement("canvas"); c.width = b.naturalWidth; c.height = b.naturalHeight;
      const s = c.getContext("2d"); s.drawImage(b, 0, 0);
      const a = (x, y) => s.getImageData(x, y, 1, 1).data[3];
      const w = c.width;
      return { w, ecken:[a(2, 2), a(w - 3, 2), a(2, w - 3), a(w - 3, w - 3)], mitte:a(w >> 1, w >> 1), rand:a(w >> 1, 3), knapp:a(w >> 1, Math.round(w * .02)) };
    }, rund.daten);
    pruef(alpha.w === 1080 && alpha.ecken.every(v => v === 0), "Ecken durchsichtig (1080 px)", alpha.ecken.join(","));
    pruef(alpha.mitte === 255 && alpha.knapp === 255, "Mitte und knapp innerhalb des Randes deckend", alpha.mitte + "/" + alpha.knapp);
  }
  const stand = await p.evaluate(() => ({ text:document.getElementById("bildStand").textContent,
    zeile:!document.getElementById("bkFreiZeile").hidden }));
  pruef(/runder Ausschnitt/.test(stand.text), "Satz nennt den runden Ausschnitt", stand.text);
  pruef(stand.zeile, "Freisteller-Zeile im Blatt zeigt den runden Ausschnitt (mit „Entfernen“)");

  /* Gegenfall: ein Bild ohne Kreis */
  await p.setInputFiles("#fDatei", { name:"bunt.png", mimeType:"image/png", buffer:leerPng });
  await p.waitForTimeout(700);
  await p.click("#gbRund");
  await p.waitForTimeout(400);
  const gegen = await p.evaluate(() => ({ satz:document.getElementById("gbRundStand").textContent,
    schief:document.getElementById("gbRundStand").classList.contains("schief"), zoom:gbZuschnitt.zoom }));
  pruef(gegen.schief && /nicht sicher erkannt/.test(gegen.satz) && gegen.zoom === 1, "ohne Kreis: Satz „nicht sicher erkannt“, Kreis mittig", gegen.satz);
  pruef(!fehler.length, "Board: keine Seitenfehler", fehler.join(" | ") || "–");
  await ctx.close();
}
const EIMER_URL = pfad => EIMER + pfad;

/* ── C · Hub, Teller ───────────────────────────────────────────── */
const FREI = "https://quxwweuvdqtjsdwgjdrh.supabase.co/storage/v1/object/public/gerichte/" + BETRIEB + "/1-pizza-rund.webp";
async function hub(browser, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport:{ width:opt.breite || 390, height:844 }, hasTouch:true, isMobile:!!opt.mobil,
    reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  const fehler = []; p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript(([sprache, opts]) => {
    try{ sessionStorage.setItem("omoteno-willkommen", "1"); if(sprache) localStorage.setItem("tapto-sprache", sprache);
         if(opts) localStorage.setItem("omoteno-optionen-piugusto", opts); }catch(e){}
  }, [opt.sprache || "", opt.gemerkt || ""]);
  await p.clock.setFixedTime(new Date("2026-10-10T14:00:00"));
  const anfragen = [];
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://") || u.startsWith("data:")) return r.continue();
    if(u.startsWith(EIMER)) return r.fulfill({ status:200, contentType:"image/png", body:opt.png || Buffer.alloc(0) });
    if(/\/rest\/v1\/betriebe\?/.test(u)){
      anfragen.push(u);
      if(opt.stumm) return r.abort();
      return r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([{ id:"b1", bestell_pause:false, hub_texte:{},
        hub_stil:{ emoji:true, karte:"teller" }, optionen: opt.optionen !== undefined ? opt.optionen : {
          "belag-kaese":{ titel:"Käse extra", art:"mehrere", zeilen:[{ n:"Burrata", auf:3.5 }, { n:"Mozza\"rella", auf:2 }, { n:"Salz, Pfeffer", auf:1 }] },
          "boese\"x":{ titel:"x", art:"mehrere", zeilen:[{ n:"a", auf:1 }] } } }]) });
    }
    if(/\/rest\/v1\/gerichte\?/.test(u) && opt.mitFrei){
      const g = JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", "piugusto.json"), "utf8")).geruestKarte.speisekarte[0].eintraege;
      return r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(g.map((e, i) => ({ id:"g" + i, karte:"speisekarte",
        kategorie:"Pizza", name:e.n, beschreibung:e.b, preis:Number(e.p.replace(",", ".")), verfuegbar:true, opt:e.opt.join(","),
        allergene:e.a.join(","), kat_emoji:"pizzakaese", bild_frei: i === 0 ? FREI : null }))) });
    }
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await p.goto("file://" + HUB + "#/speisekarte");
  await p.waitForTimeout(1300);
  return { ctx, p, fehler, anfragen };
}
async function zug(p, cdp, x, y, dx, n){
  n = n || 12;
  await cdp.send("Input.dispatchTouchEvent", { type:"touchStart", touchPoints:[{ x, y }] });
  for(let i = 1; i <= n; i++){
    await cdp.send("Input.dispatchTouchEvent", { type:"touchMove", touchPoints:[{ x:x + dx * i / n, y:y + i * .4 }] });
    await p.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type:"touchEnd", touchPoints:[] });
  await p.waitForTimeout(600);
}
const tellerStand = p => p.evaluate(() => {
  const s = document.querySelector(".tl");
  return s ? { name:s.querySelector(".tl-n").textContent, nr:(s.querySelector(".tl-nr") || {}).textContent,
               hash:location.hash, korb:s.querySelector(".tl-korb").dataset.gname } : null;
});

async function teilC(browser){
  console.log("\n══ C · Hub: Teller ══");
  const pngFrei = await pngVon(browser, { w:400, h:400, cx:200, cy:200, r:190, grund:"#00000000" }, 3);
  let { ctx, p, fehler } = await hub(browser, { mitFrei:true, png:pngFrei });
  const grund = await p.evaluate(() => ({ stil:document.body.dataset.kartenstil, tl:document.querySelectorAll(".tl").length,
    gerichte:document.querySelectorAll(".gericht").length, daten:karteDaten("speisekarte").reduce((s, g) => s + g.eintraege.length, 0) }));
  pruef(grund.stil === "teller" && grund.tl === 1, "Stil „teller“ aus hub_stil, eine Bühne je Kategorie", JSON.stringify(grund));
  pruef(grund.gerichte === grund.daten && grund.daten === 10, "Liste darunter unverändert: jedes Gericht genau einmal als .gericht", grund.gerichte);
  const bild = await p.evaluate(() => { const i = document.querySelector(".tl-teller img"); return i ? { klasse:i.className, src:i.getAttribute("src") } : null; });
  pruef(bild && bild.klasse === "tl-frei" && /-rund\.webp$/.test(bild.src), "Freisteller (bild_frei) liegt rund auf dem Teller", bild && bild.klasse);

  const s0 = await tellerStand(p);
  const el0 = await p.evaluateHandle(() => document.querySelector(".tl-teller"));
  await p.click(".tl-vor");
  await p.waitForTimeout(60);
  const lauf = await p.evaluate(() => document.querySelector(".tl-teller").getAnimations().map(a => {
    const kf = a.effect.getKeyframes(); return Object.keys(kf[0]).filter(k => !["offset","easing","composite","computedOffset"].includes(k)); }));
  const s1 = await tellerStand(p);
  const gleich = await p.evaluate(e => e === document.querySelector(".tl-teller"), el0);
  pruef(s0.name === "Pizza Liam" && s1.name === "Pizza Gamberetto" && s1.nr === "2", "Pfeil → nächstes Gericht, Zähler 2", s0.name + " → " + s1.name);
  pruef(gleich, "DASSELBE Teller-Element (Inhalt getauscht, nicht neu gebaut, §4.3)");
  pruef(lauf.length >= 1 && lauf.every(ks => ks.every(k => k === "transform" || k === "opacity")), "Bewegung läuft, nur transform/opacity", JSON.stringify(lauf));
  await p.waitForTimeout(500);
  await p.click(".tl-zurueck"); await p.waitForTimeout(80); await p.click(".tl-zurueck"); await p.waitForTimeout(500);
  const s2 = await tellerStand(p);
  pruef(s2.name === "Pizza Frutti di Mare" && s2.nr === "10", "vom ersten zurück → letztes", s2.name);

  /* „+“ auf der Bühne legt genau das gezeigte Gericht hinein */
  await p.click(".tl-korb .gplus");
  await p.waitForTimeout(400);
  const korb = await p.evaluate(() => Object.keys(merk));
  pruef(korb.length === 1 && korb[0] === "Pizza Frutti di Mare", "„+“ auf der Bühne legt genau dieses Gericht in die Auswahl", korb.join(","));
  await p.click(".tl-mehr");
  await p.waitForTimeout(500);
  const blatt = await p.evaluate(() => { const w = document.querySelector(".warenkarte, #warenkarte, .blatt.offen, [role=dialog]");
    return { text: w ? w.textContent : "", optionen: document.querySelectorAll(".ozeile").length }; });
  pruef(/Frutti di Mare/.test(blatt.text) && blatt.optionen >= 1, "„Beläge wählen“ öffnet das Blatt DIESES Gerichts mit den Belägen", blatt.optionen + " Zeilen");
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);

  /* Tapflächen, Kontrast, Überlauf */
  const mass = await p.evaluate(() => {
    const farbe = s => { const m = s.match(/[\d.]+/g).map(Number); return m.slice(0, 3); };
    const lum = c => { const k = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
      return .2126 * k[0] + .7152 * k[1] + .0722 * k[2]; };
    const grund = farbe(getComputedStyle(document.documentElement).backgroundColor !== "rgba(0, 0, 0, 0)"
      ? getComputedStyle(document.documentElement).backgroundColor : getComputedStyle(document.body).backgroundColor);
    const kontrast = el => { const a = lum(farbe(getComputedStyle(el).color)), b = lum(grund); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const pf = [...document.querySelectorAll(".tl-pfeil")].map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); });
    return { pfeile:pf, mehr:document.querySelector(".tl-mehr").getBoundingClientRect().height,
      k:[".tl-n", ".tl-b", ".tl-preis .p", ".tl-zaehler"].map(s => { const el = document.querySelector(s); return el && el.textContent.trim() ? +kontrast(el).toFixed(2) : 99; }) };
  });
  pruef(mass.pfeile.length === 2 && mass.pfeile.every(v => v >= 44) && mass.mehr >= 44, "Pfeile und „Beläge wählen“ ≥ 44 px", mass.pfeile.join("/") + " " + mass.mehr);
  pruef(mass.k.every(v => v >= 4.5), "Name, Beschreibung, Preis, Zähler ≥ 4,5:1 auf dem Grund", mass.k.join(" "));
  pruef(!fehler.length, "keine Seitenfehler", fehler.join(" | ") || "–");
  await ctx.close();

  /* Echter Finger */
  ({ ctx, p, fehler } = await hub(browser, { mobil:true }));
  const cdp = await ctx.newCDPSession(p);
  await p.evaluate(() => { const s = document.querySelector(".tl"); scrollTo(0, s.getBoundingClientRect().top + scrollY - 80); });
  await p.waitForTimeout(300);
  const box = await p.evaluate(() => { const r = document.querySelector(".tl-teller").getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height / 2 }; });
  const f0 = await tellerStand(p);
  await zug(p, cdp, box.x + 60, box.y, -180);
  const f1 = await tellerStand(p);
  pruef(f1.name !== f0.name && f1.nr === "2", "Wisch nach links → nächstes Gericht", f0.name + " → " + f1.name);
  pruef(f1.hash === "#/speisekarte", "die Unterseite wechselt dabei NICHT (.wisch-aus)", f1.hash);
  await zug(p, cdp, box.x - 60, box.y, 180);
  const f2 = await tellerStand(p);
  pruef(f2.name === f0.name, "Wisch nach rechts → zurück", f2.name);
  await zug(p, cdp, box.x, box.y, -30, 4);
  const f3 = await tellerStand(p);
  const tf = await p.evaluate(() => getComputedStyle(document.querySelector(".tl-teller")).transform);
  pruef(f3.name === f0.name && (tf === "none" || /matrix\(1, 0, 0, 1, 0, 0\)/.test(tf)), "kurzer Zug federt zurück, kein Wechsel", tf);
  pruef(!fehler.length, "Finger: keine Seitenfehler", fehler.join(" | ") || "–");
  await ctx.close();

  /* Reduzierte Bewegung */
  ({ ctx, p, fehler } = await hub(browser, { ruhig:true }));
  await p.click(".tl-vor"); await p.waitForTimeout(40);
  const ruhig = await p.evaluate(() => ({ an:document.querySelector(".tl-teller").getAnimations().length, nr:document.querySelector(".tl-nr").textContent }));
  pruef(ruhig.an === 0 && ruhig.nr === "2", "reduzierte Bewegung: Wechsel ohne Animation", JSON.stringify(ruhig));
  await ctx.close();

  /* Arabisch gespiegelt */
  ({ ctx, p, fehler } = await hub(browser, { sprache:"ar" }));
  const rtl = await p.evaluate(() => { const z = document.querySelector(".tl-zurueck").getBoundingClientRect(), v = document.querySelector(".tl-vor").getBoundingClientRect();
    return { dir:document.documentElement.dir, zurueckRechts:z.left > v.left, label:document.querySelector(".tl-vor").getAttribute("aria-label") }; });
  pruef(rtl.dir === "rtl" && rtl.zurueckRechts && rtl.label !== "Nächstes Gericht", "Arabisch: „zurück“ rechts, Beschriftung übersetzt", JSON.stringify(rtl));
  await ctx.close();

  for(const breite of [360, 430, 1280]){
    ({ ctx, p, fehler } = await hub(browser, { breite }));
    const ue = await p.evaluate(() => ({ sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth,
      teller:document.querySelector(".tl-teller").getBoundingClientRect().width }));
    pruef(ue.sw <= ue.cw && ue.teller > 150 && ue.teller <= 342, breite + " px: kein Überlauf, Teller " + Math.round(ue.teller) + " px", ue.sw + "/" + ue.cw);
    await ctx.close();
  }
}

/* ── D · Beläge des Betriebs ───────────────────────────────────── */
async function teilD(browser){
  console.log("\n══ D · Beläge des Betriebs (betriebe.optionen) ══");
  let { ctx, p } = await hub(browser, {});
  const o = await p.evaluate(() => ({ kaese:OPTIONEN["belag-kaese"] && OPTIONEN["belag-kaese"].zeilen.map(z => z.n),
    boese:Object.keys(OPTIONEN).some(k => /"/.test(k)), gemerkt:localStorage.getItem("omoteno-optionen-piugusto"),
    geruest:!!OPTIONEN.kaeserand }));
  pruef(o.kaese && o.kaese.join() === "Burrata", "nur prüfbare Zeilen kommen an (Anführungszeichen, Komma → weg)", o.kaese && o.kaese.join());
  pruef(!o.boese, "Gruppen-Schlüssel mit Anführungszeichen fällt weg");
  pruef(o.geruest, "Gerüst-Gruppen bleiben daneben bestehen");
  pruef(o.gemerkt && /Burrata/.test(o.gemerkt), "geprüfter Stand gemerkt (omoteno-optionen-<Haus>)");
  await ctx.close();
  /* Zweiter Besuch ohne Netz: die Gruppen stehen schon beim Bereinigen der gemerkten Auswahl da (§8.1q) */
  ({ ctx, p } = await hub(browser, { stumm:true, gemerkt:JSON.stringify({ "belag-kaese":{ titel:"Käse extra", art:"mehrere", zeilen:[{ n:"Burrata", auf:3.5 }] } }) }));
  const zw = await p.evaluate(() => ({ da:!!OPTIONEN["belag-kaese"], auf:optAufpreis("Pizza Liam", { "belag-kaese":["Burrata"] }),
    text:optText("Pizza Liam", { "belag-kaese":["Burrata"] }) }));
  pruef(zw.da && zw.auf === 3.5 && zw.text === "Burrata", "ohne Netz: Gruppe aus dem Gerät, Aufpreis 3,50, Bon-Text „Burrata“", JSON.stringify(zw));
  /* Was der Hub an den Server schickt: „Pizza Liam (Burrata)“ — Format wie positionen_pruefen es zerlegt */
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const tren = await p.evaluate(() => {
    OPTIONEN["t-a"] = { titel:"A", art:"mehrere", zeilen:[{ n:"X", auf:1 }, { n:"Y", auf:1 }] };
    OPTIONEN["t-b"] = { titel:"B", art:"mehrere", zeilen:[{ n:"Z", auf:1 }] };
    const g = findeGericht("Pizza Liam"); const alt = g.opt; g.opt = ["t-a", "t-b"];
    const t = optText("Pizza Liam", { "t-a":["X", "Y"], "t-b":["Z"] }); g.opt = alt; return t;
  });
  pruef(tren === "X, Y · Z", "optText trennt „, “ in der Gruppe und „ · “ zwischen Gruppen", tren);
  pruef(/regexp_split_to_table\(v_zusatz, ' · \|, '\)/.test(sql) && /substring\(v_name from ' \\\(\(\.\*\)\\\)\$'\)/.test(sql),
    "positionen_pruefen zerlegt genau dieses Format (Klammer am Ende, „ · “ und „, “)");
  pruef(/\(z->>'n'\) ~ '\[,·\(\)\]'/.test(sql) && /\/\[,·\(\)\]\/\.test\(z\.n\)/.test(fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8")),
    "verbotene Zeichen im Namen in Schranke UND Hub gleich: , · ( )");
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await teilA(browser);
  await teilB(browser);
  await teilC(browser);
  await teilD(browser);
  await browser.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
