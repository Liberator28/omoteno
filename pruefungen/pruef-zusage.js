/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Zusage und ihr Countdown

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-zusage.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   Das Admin-Board sagt eine Zeit zu (bestellungen.wartezeit_min plus
   bestaetigt_um). Zwei Seiten zeigen sie herunterlaufend, und sie
   zeigen sie ABSICHTLICH verschieden:

     Küche  · zählt weiter, wenn die Zeit um ist: „+3′" in Rot.
              Der Koch KANN etwas daran ändern.
     Hub    · hört bei 0 auf und sagt „Jeden Moment".
              Der Gast kann es nicht — eine Uhr im Minus vor einem
              wartenden Menschen ist ein Vorwurf, keine Auskunft
              (CLAUDE.md §7).

   Und der Fall, der beim Ausliefern zuerst eintritt: Die Migration
   für bestellung_restzeit ist noch nicht angewendet. Dann muss der
   Hub GENAU das zeigen, was er vorher zeigte — die feste Zusage. Ein
   erfundener Startzeitpunkt liefe beim Wiederöffnen von vorn los.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const WURZEL = path.join(__dirname, "..");
const KUECHE = path.join(WURZEL, "seiten", "kueche.html");
if(!fs.existsSync(KUECHE)){
  console.error("kueche.html nicht gefunden — gesucht unter " + KUECHE);
  process.exit(1);
}
function hubDatei(){
  const d = path.join(WURZEL, "dist");
  if(!fs.existsSync(d)) return null;
  for(const o of fs.readdirSync(d)){
    const f = path.join(d, o, "index.html");
    if(fs.existsSync(f)) return "file://" + f;
  }
  return null;
}

let fehler = 0;
const ok = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };

const BETRIEB = "11111111-2222-3333-4444-555555555555";
const vorMin = m => new Date(Date.now() - m*60000).toISOString();

/* ─────────────────────────────────────────────────────────────────
   1 · DIE KÜCHE
   ───────────────────────────────────────────────────────────────── */
const BONS = () => ([
  /* 20 Minuten zugesagt, 5 davon vorbei → noch 15′, Balken bei 25 % */
  { id:"mit", betrieb_id:BETRIEB, quelle:"tisch", status:"arbeit", tisch:"3",
    positionen:[{name:"Pfannkuchen",menge:1}], zeitpunkt:vorMin(9),
    kueche_fertig_um:null, theke_fertig_um:null, tagesnummer:1,
    wartezeit_min:20, bestaetigt_um:vorMin(5) },
  /* 10 zugesagt, 13 vorbei → +3′ und die Karte ist rot */
  { id:"ueber", betrieb_id:BETRIEB, quelle:"tisch", status:"arbeit", tisch:"4",
    positionen:[{name:"Suppe",menge:1}], zeitpunkt:vorMin(40),
    kueche_fertig_um:null, theke_fertig_um:null, tagesnummer:2,
    wartezeit_min:10, bestaetigt_um:vorMin(13) },
  /* Keine Zusage → alles wie vorher, plus die Knöpfe zum Setzen */
  { id:"ohne", betrieb_id:BETRIEB, quelle:"tisch", status:"neu", tisch:"5",
    positionen:[{name:"Salat",menge:1}], zeitpunkt:vorMin(4),
    kueche_fertig_um:null, theke_fertig_um:null, tagesnummer:3,
    wartezeit_min:null, bestaetigt_um:null },
  /* Schon in Arbeit, aber ohne Zusage. Dieser Bon ist der einzige, an
     dem die Signatur wirklich hängt: Tippt der Koch hier eine Zeit,
     bleibt der status auf „arbeit" — es ändert sich AUSSCHLIESSLICH
     wartezeit_min. Zählt die Signatur das nicht mit, bleiben die
     Knöpfe stehen, bis zufällig etwas anderes den Bon anfasst.
     Mein erster Gegenbeweis lief über den Bon oben und blieb grün:
     Dort wechselt der status von „neu" auf „arbeit" und baut die
     Karte ohnehin neu. Eine Probe, die den Fehler nicht treffen
     KANN, ist keine Probe (CLAUDE.md §8.1g). */
  { id:"laeuft", betrieb_id:BETRIEB, quelle:"tisch", status:"arbeit", tisch:"6",
    positionen:[{name:"Waffel",menge:2}], zeitpunkt:vorMin(6),
    kueche_fertig_um:null, theke_fertig_um:null, tagesnummer:4,
    wartezeit_min:null, bestaetigt_um:null }
]);

async function kueche(br){
  console.log("\n══ Küche · die Zusage läuft ab");
  const ctx = await br.newContext({ viewport:{width:1280,height:900} });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,140)));
  let abfrage = "", patch = null;

  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(u.includes("/rest/v1/bestellungen")){
      if(r.request().method() === "PATCH"){
        patch = JSON.parse(r.request().postData() || "{}");
        return r.fulfill({ status:204, body:"" });
      }
      abfrage = decodeURIComponent(u);
      return r.fulfill({ status:200, contentType:"application/json",
                         body:JSON.stringify(BONS()) });
    }
    if(u.includes("/rest/v1/betriebe"))
      return r.fulfill({ status:200, contentType:"application/json",
        body:JSON.stringify([{ id:BETRIEB, name:"Prüfhaus", slug:"pruefhaus",
                               bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) });
    if(u.includes("/auth/"))
      return r.fulfill({ status:200, contentType:"application/json",
        body:JSON.stringify({ access_token:"t", refresh_token:"r", expires_in:3600,
                              token_type:"bearer", user:{ id:"u1" } }) });
    if(u.includes("/rest/v1/betrieb_mitglieder"))
      return r.fulfill({ status:200, contentType:"application/json",
        body:JSON.stringify([{ betrieb_id:BETRIEB, nutzer_id:"u1", rolle:"inhaber" }]) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });

  await p.addInitScript(() => {
    localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({
      access_token:"t", refresh_token:"r", expires_at: Math.floor(Date.now()/1000)+3600 }));
  });
  await p.goto("file://" + KUECHE);
  await p.waitForTimeout(1800);

  /* Zweite Quelle (§8.1b): Die Anzeige kann nur zeigen, was die
     ABFRAGE geholt hat. Wer nur die Karte prüft, übersieht eine
     vergessene Spalte — die Zusage wäre dann still immer leer. */
  ok(/wartezeit_min/.test(abfrage) && /bestaetigt_um/.test(abfrage),
    "die Abfrage holt Zusage und Zeitpunkt mit",
    (abfrage.match(/select=[^&]*/) || ["(keine)"])[0].slice(-46));

  const lies = id => p.evaluate(k => {
    const e = document.querySelector('[data-id="'+k+'"]');
    if(!e) return null;
    const w = e.querySelector(".wartet"), m = e.querySelector(".mass span");
    const c = e.querySelector('[data-tun="zeit"]');
    return { text: w ? w.textContent.trim() : "",
             breite: m ? m.style.width : "",
             rot: e.classList.contains("sehr-spaet"),
             chips: e.querySelectorAll('[data-tun="zeit"]').length,
             chipHoch: c ? Math.round(c.getBoundingClientRect().height) : 0 };
  }, id);

  const mit = await lies("mit");
  ok(!!mit && /noch/.test(mit.text) && /15′/.test(mit.text),
    "mit Zusage zählt der Bon herunter", mit ? mit.text : "(kein Bon)");
  ok(!!mit && mit.breite === "25%",
    "der Balken läuft gegen die Zusage, nicht gegen rotAb", mit ? mit.breite : "—");

  const ueb = await lies("ueber");
  ok(!!ueb && /\+3′/.test(ueb.text),
    "ist die Zeit um, zählt die Küche weiter", ueb ? ueb.text : "—");
  ok(!!ueb && ueb.rot, "und die Karte steht auf Rot", ueb ? String(ueb.rot) : "—");

  const ohne = await lies("ohne");
  ok(!!ohne && /wartet/.test(ohne.text),
    "ohne Zusage bleibt es bei der gelaufenen Zeit", ohne ? ohne.text : "—");
  ok(!!ohne && ohne.chips === 4,
    "und der Koch bekommt vier Knöpfe, um selbst eine zu geben",
    ohne ? ohne.chips + " Stück" : "—");
  ok(!!ohne && ohne.chipHoch >= 44,
    "die Knöpfe sind mit der ganzen Hand zu treffen (44px)",
    ohne ? ohne.chipHoch + "px" : "—");
  ok(!!mit && mit.chips === 0,
    "wo eine Zusage steht, sind die Knöpfe weg", mit ? mit.chips + " Stück" : "—");

  /* Tippen: Was geht wirklich an den Server, und was macht die Karte? */
  await p.click('[data-id="ohne"] [data-tun="zeit"][data-min="15"]');
  await p.waitForTimeout(700);
  ok(!!patch && patch.wartezeit_min === 15,
    "der Tipp schickt die Minuten an den Server",
    patch ? JSON.stringify(patch).slice(0,74) : "(nichts gesendet)");
  ok(!!patch && !!patch.bestaetigt_um,
    "und den Zeitpunkt dazu — eine Zahl ohne Startpunkt ist keine Zusage");
  ok(!!patch && patch.status === "arbeit",
    "der Bon geht zugleich in Arbeit", patch ? patch.status : "—");

  const danach = await lies("ohne");
  ok(!!danach && /noch/.test(danach.text) && danach.chips === 0,
    "die Karte zeigt sofort die Restzeit, die Knöpfe verschwinden",
    danach ? danach.text + ", " + danach.chips + " Knöpfe" : "—");

  /* Und derselbe Tipp auf einem Bon, der SCHON läuft. Hier ändert sich
     nur wartezeit_min — der einzige Weg, an dem die Signatur hängt. */
  await p.click('[data-id="laeuft"] [data-tun="zeit"][data-min="20"]');
  await p.waitForTimeout(700);
  const lief = await lies("laeuft");
  ok(!!lief && /noch/.test(lief.text) && lief.chips === 0,
    "auch auf einem laufenden Bon zieht die Karte sofort nach",
    lief ? lief.text + ", " + lief.chips + " Knöpfe" : "—");

  ok(kons.length === 0, "kein Fehler in der Konsole", kons[0] || "still");
  await ctx.close();
}

/* ─────────────────────────────────────────────────────────────────
   2 · DER HUB
   ───────────────────────────────────────────────────────────────── */
async function hub(br, datei){
  console.log("\n══ Hub · was der Gast sieht");

  async function fall(name, antwort, erwartetStreifen, erwartetGross){
    const ctx = await br.newContext({ viewport:{width:390,height:844} });
    const p = await ctx.newPage();
    const kons = [];
    let gefragt = 0;
    p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,140)));

    await p.route("**/*", r => r.request().url().startsWith("file://")
      ? r.continue()
      : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
    await p.route("**/rest/v1/betriebe**", r =>
      r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ id:BETRIEB, bestell_pause:false,
                                bestell_pause_text:"", hub_texte:{} }]) }));
    await p.route("**/rest/v1/rpc/bestellung_status", r =>
      r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ status:"arbeit", wartezeit_min:20, tagesnummer:7 }]) }));
    await p.route("**/rest/v1/rpc/bestellung_restzeit", r => {
      gefragt++;
      return antwort === 404
        ? r.fulfill({ status:404, contentType:"application/json", body:'{"message":"nicht da"}' })
        : r.fulfill({ status:200, contentType:"application/json", body:String(antwort) });
    });

    await p.addInitScript(() => {
      localStorage.setItem("omoteno-willkommen", "1");
      localStorage.setItem("omoteno-vorgaenge", JSON.stringify([{
        nummer:"probe_kennung_0001", art:"bestellung", status:"arbeit",
        warte:20, summe:12.5, zeit:Date.now(), tagesnummer:7,
        bestellung:{ nummer:"probe_kennung_0001", tisch:"3", tagesnummer:7,
                     summe:12.5, posten:[{n:"Nutella Crêpe",m:1,p:"7,50"}] }
      }]));
    });
    await p.goto(datei);
    await p.waitForTimeout(2200);
    const streifen = await p.evaluate(() => {
      const w = document.querySelector(".vwarte");
      return w ? w.textContent.trim() : "(kein Streifen)";
    });
    /* Über den Streifen gehen, nicht über den Hash: Erst der Tipp setzt
       letzteBestellung, und ohne die steigt bestellStatusSteuern aus. */
    await p.click("#vstreifen");
    await p.waitForTimeout(2400);
    const gross = await p.evaluate(() => {
      const b = document.querySelector(".bs-warte b");
      return b ? b.textContent.trim() : "(keine Anzeige)";
    });

    ok(streifen === erwartetStreifen, name + " · Streifen", streifen);
    ok(gross === erwartetGross,       name + " · große Anzeige", gross);
    ok(kons.length === 0,             name + " · Konsole still", kons[0] || "still");
    await ctx.close();
    return gefragt;
  }

  await fall("15 Minuten übrig", 900, "noch 15 Min", "noch ca. 15 Minuten");
  await fall("Zeit ist um",        0, "Jeden Moment", "Jeden Moment");
  await fall("keine Zusage",  "null", "ca. 20 Min",   "ca. 20 Minuten");

  /* Der Fall beim Ausliefern: Die Migration steht noch nicht. Der Hub
     muss dann GENAU das zeigen, was er vorher zeigte — und aufhören zu
     fragen, statt alle 15 Sekunden ins Leere zu greifen. */
  const gefragt = await fall("Migration fehlt (404)", 404, "ca. 20 Min", "ca. 20 Minuten");
  ok(gefragt === 1, "nach einer 404 fragt der Hub nicht weiter",
     gefragt + " Anfrage(n)");
}

(async () => {
  const datei = hubDatei();
  if(!datei){
    console.error("Kein erzeugter Hub in dist/. Erst: node erzeuger/erzeuge-hub.js --alle");
    process.exit(1);
  }
  const br = await chromium.launch();
  await kueche(br);
  await hub(br, datei);
  await br.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Keine Fehler"));
  process.exit(fehler ? 1 : 0);
})();
