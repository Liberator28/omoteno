/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Bestellung zurückziehen

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-storno.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   Zwei Minuten lang darf der Gast eine Speise streichen oder alles
   zurückziehen. Die Küche sieht es sofort, rot, mit eigenem Ton.

   Vier Dinge, für jedes eine Probe:

   1 · DER KNOPF LÜGT NICHT. Er steht da, solange die Frist läuft, und
       verschwindet danach — auch ohne dass jemand die Seite neu lädt.

   2 · GESTRICHEN WIRD ÜBER DIE STELLE, nicht über den Namen. Der Name
       in der Datenbank trägt die Zusätze mit („Dubai Crêpe (extra
       Pistazie)") und wird beim Senden aus dem damaligen Zustand der
       Auswahl gebaut. Wer später über den Namen sucht, streicht unter
       Umständen nichts — oder das Falsche.

   3 · DIE KÜCHE SIEHT, WAS WEGFÄLLT. Die gestrichene Zeile bleibt
       durchgestrichen stehen. Ein Bon, aus dem still eine Zeile
       verschwindet, ist schlimmer als keiner: Wer schon angefangen
       hat, sucht sonst den Fehler bei sich.

   4 · DER TON IST EIN ANDERER. Ein Storno, das klingt wie eine neue
       Bestellung, schickt den Koch an den Pass statt an den Bon.

   EHRLICHE GRENZE: Ob der Ton am Tresen laut genug ist, prüft das
   hier nicht. Gemessen wird, DASS der Storno-Ton läuft und dass es
   nicht derselbe ist wie bei einer neuen Bestellung — nicht, wie er
   in einer vollen Küche ankommt.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
let fehler = 0;
const ok = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };
const echt = k => k.filter(z => !/net::ERR|Failed to load|ERR_FAILED/i.test(z));
const BID = "11111111-2222-3333-4444-555555555555";

/* ── Der Gast ────────────────────────────────────────────────────── */
async function gast(br){
  console.log("\n══ Der Gast zieht zurück ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  const kons = [];
  let gesendet = null;
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));

  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await p.route("**/rest/v1/betriebe**", r => r.fulfill({ status:200,
    contentType:"application/json",
    body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) }));
  await p.route("**/rest/v1/rpc/bestellung_status", r => r.fulfill({ status:200,
    contentType:"application/json",
    body: JSON.stringify([{ status:"neu", wartezeit_min:null, tagesnummer:5 }]) }));
  await p.route("**/rest/v1/rpc/bestellung_stornieren", r => {
    gesendet = JSON.parse(r.request().postData() || "{}");
    return r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify({ ok:true, alles:false, rest:1, summe:9,
                             positionen:[{ name:"Waffel", menge:1, preis:9 }] }) });
  });
  await p.addInitScript(() => {
    localStorage.setItem("omoteno-willkommen","1");
    sessionStorage.setItem("omoteno-willkommen","1");
    localStorage.setItem("omoteno-vorgaenge", JSON.stringify([{
      nummer:"k1", art:"bestellung", status:"neu", warte:null,
      summe:12.5, zeit:Date.now(), tagesnummer:5,
      bestellung:{ nummer:"k1", tisch:"3", tagesnummer:5, summe:12.5,
        posten:[{n:"Cola",m:1,p:"3,50"},{n:"Waffel",m:1,p:"9,00"}] }
    }]));
  });
  await p.goto("file://" + path.join(OBEN, "dist", "chocolamour", "index.html"));
  await p.waitForTimeout(1600);
  await p.click("#vstreifen");
  await p.waitForTimeout(1800);

  ok(await p.evaluate(() => !!document.getElementById("stOeffnen")),
    "innerhalb der Frist steht der Knopf da");

  await p.click("#stOeffnen");
  await p.waitForTimeout(450);
  const a = await p.evaluate(() => ({
    offen: !document.getElementById("storno").hidden,
    zeilen: document.querySelectorAll("[data-storno-stelle]").length,
    aus: document.getElementById("stEinzeln").disabled }));
  ok(a.offen, "das Fenster geht auf");
  ok(a.zeilen === 2, "jede Speise steht einzeln da", a.zeilen + " Zeilen");
  ok(a.aus, "„Streichen“ ist aus, solange nichts gewählt ist");

  await p.click('[data-storno-stelle="0"]');
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.getElementById("stEinzeln").disabled),
    "nach der Auswahl geht es");

  await p.click("#stEinzeln");
  await p.waitForTimeout(900);
  ok(!!gesendet && Array.isArray(gesendet.posten) && gesendet.posten[0] === "0",
    "geschickt wird die STELLE, nicht der Name",
    gesendet ? JSON.stringify(gesendet) : "nichts gesendet");
  const b = await p.evaluate(() => ({
    zu: document.getElementById("storno").hidden,
    posten: letzteBestellung.posten.map(x => x.n).join(",") }));
  ok(b.zu, "das Fenster schließt sich danach");
  ok(b.posten === "Waffel", "der eigene Stand zieht nach", b.posten);

  /* Die Frist. Sie wird hier nur ANGEZEIGT — entschieden wird sie am
     Server; siehe die Probe in der Migration. */
  await p.evaluate(() => {
    const v = vorgaenge.find(x => x.nummer === "k1");
    v.zeit = Date.now() - 5*60*1000;
    bestellStatusSteuern("bestellt");
  });
  await p.waitForTimeout(700);
  ok(!(await p.evaluate(() => !!document.getElementById("stOeffnen"))),
    "nach zwei Minuten ist der Knopf weg");

  /* Und wenn die Migration fehlt: kein Rätsel, ein Satz. */
  await p.route("**/rest/v1/rpc/bestellung_stornieren", r =>
    r.fulfill({ status:404, contentType:"application/json", body:'{"message":"nope"}' }));
  await p.evaluate(() => {
    const v = vorgaenge.find(x => x.nummer === "k1");
    v.zeit = Date.now();
    letzteBestellung.posten = [{n:"Cola",m:1,p:"3,50"}];
    bestellStatusSteuern("bestellt");
  });
  await p.waitForTimeout(600);
  await p.click("#stOeffnen");
  await p.waitForTimeout(350);
  await p.click('[data-storno-stelle="0"]');
  await p.click("#stEinzeln");
  await p.waitForTimeout(700);
  const c = await p.evaluate(() => document.getElementById("stMeldung").textContent);
  ok(/nicht|Bescheid/i.test(c), "fehlt die Migration, sagt die Seite es im Klartext",
    c.slice(0, 46) || "(nichts)");

  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}

/* ── Die Küche ───────────────────────────────────────────────────── */
async function kueche(br){
  console.log("\n══ Die Küche sieht es ══");
  const ctx = await br.newContext({ viewport:{width:1280,height:900} });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));

  const vorMin = m => new Date(Date.now() - m*60000).toISOString();
  let stornoDrin = false;
  const bons = () => ([
    { id:"a1", betrieb_id:BID, quelle:"tisch", tisch:"3",
      status: stornoDrin === "voll" ? "storniert" : "neu",
      positionen: stornoDrin === "voll" ? []
                : stornoDrin ? [{name:"Waffel",menge:1,preis:9}]
                             : [{name:"Cola",menge:1,preis:3.5},{name:"Waffel",menge:1,preis:9}],
      storno: stornoDrin === "voll"
                ? [{name:"Cola",menge:1,preis:3.5},{name:"Waffel",menge:1,preis:9}]
                : stornoDrin ? [{name:"Cola",menge:1,preis:3.5}] : null,
      zeitpunkt: vorMin(1), kueche_fertig_um:null, theke_fertig_um:null,
      tagesnummer:5, wartezeit_min:null, bestaetigt_um:null }
  ]);
  let spalten = "", letzterPatch = null;
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(u.includes("/rest/v1/bestellungen")){
      if(r.request().method() === "PATCH"){
        letzterPatch = JSON.parse(r.request().postData() || "{}");
        return r.fulfill({ status:204, body:"" });
      }
      spalten = decodeURIComponent(u);
      return r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify(bons()) });
    }
    if(u.includes("/auth/"))
      return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify({ access_token:"t", refresh_token:"r", expires_in:3600,
                               token_type:"bearer", user:{ id:"u1" } }) });
    if(u.includes("/rest/v1/betrieb_mitglieder"))
      return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ betrieb_id:BID, nutzer_id:"u1", rolle:"inhaber" }]) });
    if(u.includes("/rest/v1/betriebe"))
      return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ id:BID, name:"Prüfhaus", slug:"pruefhaus",
                                bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  /* Den TON messen, nicht den Funktionsnamen. Das Küchenskript ist
     gekapselt — piep() und auffrischen() sind von außen gar nicht
     erreichbar, ein window.piep = … legte nur eine neue Variable an,
     die niemand ruft. Deshalb wird die Tonausgabe selbst abgefangen:
     Was gespielt wird, ist die Wahrheit; wie die Funktion heißt, ist
     eine Behauptung. */
  await p.addInitScript(() => {
    localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({
      access_token:"t", refresh_token:"r", expires_at: Math.floor(Date.now()/1000)+3600 }));
    window.__noten = [];
    const Echt = window.AudioContext || window.webkitAudioContext;
    function Falsch(){
      const c = new Echt();
      const alt = c.createOscillator.bind(c);
      c.createOscillator = function(){
        const o = alt();
        const start = o.start.bind(o);
        o.start = function(t){
          window.__noten.push({ hz: Math.round(o.frequency.value), art: o.type });
          return start(t);
        };
        return o;
      };
      return c;
    }
    window.AudioContext = Falsch;
    window.webkitAudioContext = Falsch;
  });
  await p.goto("file://" + path.join(OBEN, "seiten", "kueche.html"));
  await p.waitForTimeout(1700);

  ok(/storno/.test(spalten), "die Abfrage holt die gestrichenen Zeilen mit",
    (spalten.match(/select=[^&]*/) || ["(keine)"])[0].slice(-40));

  await p.evaluate(() => { window.__noten = []; });
  const vorher = await p.evaluate(() => document.querySelectorAll(".storno-zeile").length);
  ok(vorher === 0, "vorher steht keine gestrichene Zeile da", vorher + " Zeilen");

  /* Der eigene Takt der Küche holt die Änderung; ein Aufruf von außen
     geht nicht (siehe oben). Alle vier Sekunden — also warten. */
  stornoDrin = true;
  await p.waitForTimeout(5200);

  const d = await p.evaluate(() => {
    const k = document.querySelector('[data-id="a1"]');
    return { rot: !!k && k.classList.contains("storniert"),
             rand: k ? getComputedStyle(k).borderColor : "",
             gestrichen: document.querySelectorAll(".storno-zeile").length,
             durchgestrichen: (() => {
               const z = document.querySelector(".storno-zeile");
               return z ? getComputedStyle(z).textDecorationLine : "keine"; })(),
             text: (document.querySelector(".storno-kopf")||{}).textContent || "",
             noten: window.__noten || [] };
  });
  ok(d.rot, "der Bon wird rot", d.rand || "—");
  ok(d.gestrichen === 1, "die gestrichene Zeile steht MIT auf dem Bon",
    d.gestrichen + " Zeile(n)");
  ok(/line-through/.test(d.durchgestrichen), "und ist durchgestrichen",
    d.durchgestrichen);
  ok(/gestrichen|zurückgezogen/i.test(d.text), "mit einem Wort, das es benennt", d.text);
  /* Der Storno-Ton sind VIER fallende Rechtecktöne (660/440), der für
     eine neue Bestellung EIN Sinuston auf 880. Gemessen wird genau
     das — nicht, welche Funktion gelaufen ist. */
  const eckig = d.noten.filter(n => n.art === "square");
  const rund  = d.noten.filter(n => n.art === "sine" && n.hz === 880);
  ok(eckig.length >= 4, "der Storno-Ton läuft — vier fallende Töne",
    JSON.stringify(d.noten.slice(0, 6)));
  ok(eckig.length > 0 && eckig[0].hz > eckig[1].hz,
    "und er fällt, statt zu steigen",
    eckig.length > 1 ? eckig[0].hz + " → " + eckig[1].hz : "zu wenige Töne");
  ok(rund.length === 0, "es ist NICHT der Ton für eine neue Bestellung",
    rund.length + "× 880 Hz");

  /* Und der Griff, der den Tagesbogen kaputtmachen könnte: Hakt der
     Koch einen zurückgezogenen Bon ab, darf daraus NICHT „fertig"
     werden. Das Board rechnet den Umsatz über status !== "storniert"
     — der Bon tauchte sonst wieder im Tagesbogen auf. */
  stornoDrin = "voll";
  await p.waitForTimeout(5200);
  const knopf = await p.$('[data-id="a1"] [data-tun="fertig"]');
  if(!knopf){
    ok(false, "ein zurückgezogener Bon lässt sich abhaken", "kein Knopf gefunden");
  }else{
    await knopf.click();
    await p.waitForTimeout(700);
    ok(!!letzterPatch, "der Griff geht an den Server",
      letzterPatch ? JSON.stringify(letzterPatch) : "nichts");
    ok(!letzterPatch || letzterPatch.status !== "fertig",
      "aus „storniert“ wird NICHT „fertig“ — sonst zählt der Tagesbogen ihn wieder",
      letzterPatch ? String(letzterPatch.status) : "—");
  }

  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}

/* ── Die Migration muss beides mitbringen ────────────────────────── */
function migration(){
  console.log("\n══ Die Migration ══");
  const f = path.join(OBEN, "datenbank", "migration-baukasten-und-storno.sql");
  if(!fs.existsSync(f)){ ok(false, "migration-baukasten-und-storno.sql fehlt"); return; }
  const t = fs.readFileSync(f, "utf8");
  ok(/add column if not exists storno jsonb/.test(t), "die Spalte storno wird angelegt");
  ok(/create or replace function public\.bestellung_stornieren/.test(t),
    "die Funktion wird angelegt");
  ok(/interval '2 minutes'/.test(t), "die Frist steht im SERVER, nicht im Hub");
  ok(/set search_path to 'public'/.test(t),
    "der search_path bleibt eng (§2.2)");
  ok(/grant execute on function public\.bestellung_stornieren/.test(t),
    "und der Gast darf sie rufen");
  ok(/pg_get_function_identity_arguments/.test(t),
    "die Signaturkontrolle steht dabei (§2.1)");
}

(async () => {
  if(!fs.existsSync(path.join(OBEN, "dist", "chocolamour", "index.html"))){
    console.error("Kein erzeugter Hub in dist/. Erst: node erzeuger/erzeuge-hub.js --alle");
    process.exit(1);
  }
  migration();
  const br = await chromium.launch();
  await gast(br);
  await kueche(br);
  await br.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Keine Fehler"));
  process.exit(fehler ? 1 : 0);
})();
