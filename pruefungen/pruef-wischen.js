/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Runterwischen schließt das Fenster

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-wischen.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   > Anlass. Jedes Fenster hatte oben einen Balken, der aussieht, als
   > könnte man ihn herunterziehen — und man konnte nicht. Zum
   > Schließen musste man jedes Mal das ✕ oben rechts treffen: der
   > Griff, den man am Telefon am schlechtesten erreicht.

   Vier Dinge müssen stimmen, und für jedes steht hier eine Probe:

   1 · Ein LANGER Zug schließt.
   2 · Ein KURZER Zug schließt NICHT, sondern federt zurück. Ohne das
       wäre jedes Verrutschen beim Lesen ein Schließen.
   3 · Auf einem Bedienelement fängt gar keine Geste an. Wer einen
       Regler zieht, will den Regler bewegen.
   4 · Danach steht keine Inline-Angabe mehr am Element. Bliebe sie
       stehen, öffnete sich das Fenster beim nächsten Mal an der
       falschen Stelle — und niemand fände den Grund.

   Und: Wer Bewegung reduziert hat, bekommt dieselbe Geste mit
   demselben Ergebnis, nur ohne Mitziehen. Ein Fenster, das sich für
   diese Menschen nicht mehr schließen ließe, wäre der schlechtere
   Fehler.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
let fehler = 0;
const ok = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };
const echt = k => k.filter(z => !/net::ERR|Failed to load|ERR_FAILED/i.test(z));

/* Eine Zeigergeste, wie sie ein Finger macht: aufsetzen, in Schritten
   ziehen, loslassen. In einem Sprung gezogen sähe der Browser keine
   Geschwindigkeit — und die entscheidet mit. */
async function ziehe(p, wo, dy, schritte){
  const r = await p.evaluate(s => {
    const e = document.querySelector(s); if(!e) return null;
    const b = e.getBoundingClientRect();
    if(!b.width || !b.height) return null;
    return { x: b.left + b.width/2, y: b.top + Math.min(8, b.height/2) };
  }, wo);
  if(!r) return false;
  const n = schritte || 6;
  await p.mouse.move(r.x, r.y);
  await p.mouse.down();
  for(let i = 1; i <= n; i++){
    await p.mouse.move(r.x, r.y + dy * i / n);
    await p.waitForTimeout(16);
  }
  await p.mouse.up();
  await p.waitForTimeout(430);
  return true;
}

/* ── Der geteilte Block ──────────────────────────────────────────── */
function geteilt(){
  console.log("\n══ Der geteilte WISCHZU-Block ══");
  const A = "/* ╔═══ WISCHZU · GETEILTER BLOCK · ANFANG";
  const E = "╚═══ WISCHZU · GETEILTER BLOCK · ENDE ═══════════════════════════╝ */";
  const quellen = [
    ["vorlagen/hub.vorlage.html", path.join(OBEN, "vorlagen", "hub.vorlage.html")],
    ["seiten/admin.html",         path.join(OBEN, "seiten", "admin.html")],
    ["seiten/kueche.html",        path.join(OBEN, "seiten", "kueche.html")]
  ].map(([name, pfad]) => {
    const t = fs.readFileSync(pfad, "utf8");
    const i = t.indexOf(A), j = t.indexOf(E);
    return { name, text: (i >= 0 && j > i) ? t.slice(i, j + E.length) : null };
  });
  const ohne = quellen.filter(q => !q.text);
  if(ohne.length){ ohne.forEach(q => ok(false, "Block fehlt in " + q.name)); return; }
  quellen.slice(1).forEach(q => ok(quellen[0].text === q.text,
    "wortgleich mit " + q.name,
    quellen[0].text === q.text ? quellen[0].text.length + " Zeichen" : "weicht ab"));
  /* Der Block darf sich auf nichts stützen, was es nur in einer Datei
     gibt — sonst trägt er in der zweiten nicht (§8.1e). */
  /* Mit Wortgrenze gesucht: „t(" allein trifft auch setTimeout( und
     getBoundingClientRect( — mein erster Anlauf meldete genau das
     als Fehler. Ein Werkzeug, das Fehlalarm schlägt, bringt einem
     bei, es zu übergehen (§8.2). */
  /* Kommentare vorher weg: Der Block ERKLÄRT in seinem Kopf, dass er
     kein t() benutzt — und meine erste Fassung meldete genau diesen
     Satz als Verstoß. Ein Werkzeug, das Fehlalarm schlägt, bringt
     einem bei, es zu übergehen (§8.2). */
  const ohneKommentar = quellen[0].text
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const fremd = [/\bt\(/, /MARKENBLATT/, /BETRIEB\./, /\bEINST\./,
                 /\$\(/, /\bmelde\(/, /\bmelden\(/]
    .filter(r => r.test(ohneKommentar)).map(r => String(r));
  ok(fremd.length === 0, "der Block stützt sich auf nichts Fremdes",
    fremd.join(", ") || "rein");
}

/* ── Der Hub ─────────────────────────────────────────────────────── */
async function hub(br, ruhig){
  console.log("\n══ Hub" + (ruhig ? " · Bewegung reduziert" : "") + " ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844},
                                    reducedMotion: ruhig ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await p.addInitScript(() => localStorage.setItem("omoteno-willkommen","1"));
  await p.goto("file://" + path.join(OBEN, "dist", "chocolamour", "index.html"));
  await p.waitForTimeout(1100);

  const oeffnen = async () => {
    await p.evaluate(() => { location.hash = "#/speisekarte"; });
    await p.waitForTimeout(450);
    await p.evaluate(() => {
      const n = document.querySelector("[data-detail]");
      if(n) detailOeffnen(decodeURIComponent(n.dataset.detail));
    });
    await p.waitForTimeout(550);
    return p.evaluate(() => !!detailName);
  };

  ok(await oeffnen(), "das Gerichtfenster geht auf");
  ok(await ziehe(p, "#warenkarte .wgriff", 40), "ein kurzer Zug am Balken ist möglich");
  let a = await p.evaluate(() => ({ offen: !!detailName,
    inline: document.getElementById("warenkarte").style.transform }));
  ok(a.offen, "ein kurzer Zug schließt NICHT", a.offen ? "bleibt offen" : "zu");
  ok(a.inline === "", "und lässt keine Angabe am Element stehen",
    a.inline || "leer");

  await ziehe(p, "#warenkarte .wgriff", 320);
  a = await p.evaluate(() => ({ offen: !!detailName,
    klasse: document.getElementById("warenkarte").className,
    /* Gemessen wird der WIRKENDE Stil, nicht das Attribut (§8.1c). */
    sichtbar: getComputedStyle(document.getElementById("warenkarte")).transform,
    inline: document.getElementById("warenkarte").style.transform }));
  ok(!a.offen, "ein langer Zug schließt", a.offen ? "noch offen" : "zu");
  ok(!/\ban\b/.test(a.klasse), "die Klasse „an“ ist weg", a.klasse);
  ok(a.inline === "", "keine Inline-Angabe bleibt zurück", a.inline || "leer");

  await oeffnen();
  await ziehe(p, "#warenkarte [data-wzu]", 320);
  const b = await p.evaluate(() => !!detailName);
  ok(b, "auf einem Knopf fängt keine Geste an", b ? "bleibt offen" : "ZU");
  await p.evaluate(() => detailSchliessen());
  await p.waitForTimeout(300);

  await p.evaluate(() => storyOeffnen([{ n:"Nutella Crêpe", m:1 }]));
  await p.waitForTimeout(1300);
  await ziehe(p, "#story .wgriff", 340);
  ok(await p.evaluate(() => document.getElementById("story").hidden),
    "auch das Besuchsbild lässt sich herunterziehen");

  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}

/* ── Das Board ───────────────────────────────────────────────────── */
async function board(br){
  console.log("\n══ Board ══");
  const ctx = await br.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + path.join(OBEN, "seiten", "admin.html"));
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); }
  });
  await p.waitForTimeout(400);
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(300); }

  await p.evaluate(() => { $("#impBlatt").hidden = false; });
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById("impBlatt").hidden),
    "ein Blatt des Boards geht auf");

  await ziehe(p, "#impBlatt .griff", 40);
  ok(await p.evaluate(() => !document.getElementById("impBlatt").hidden),
    "ein kurzer Zug schließt es NICHT");

  await ziehe(p, "#impBlatt .griff", 320);
  const a = await p.evaluate(() => ({
    zu: document.getElementById("impBlatt").hidden,
    inline: document.querySelector("#impBlatt .blattinhalt").style.transform }));
  ok(a.zu, "ein langer Zug schließt es", a.zu ? "zu" : "noch offen");
  ok(a.inline === "", "keine Inline-Angabe bleibt zurück", a.inline || "leer");

  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}

/* ── Die Küche ───────────────────────────────────────────────────── */
async function kueche(br){
  console.log("\n══ Küche ══");
  const ctx = await br.newContext({ viewport:{width:1280,height:900} });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  /* Die Küche zeigt ohne Anmeldung nur das Tor — dieselbe Sitzung
     wie in pruef-telefonbon.js, sonst gibt es gar kein Blatt. */
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(u.includes("/auth/"))
      return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify({ access_token:"t", refresh_token:"r", expires_in:3600,
                               token_type:"bearer", user:{ id:"u1" } }) });
    if(u.includes("/rest/v1/betrieb_mitglieder"))
      return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ betrieb_id:"b1", nutzer_id:"u1", rolle:"inhaber" }]) });
    if(u.includes("/rest/v1/betriebe"))
      return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ id:"b1", name:"Prüfhaus", slug:"pruefhaus",
                                bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await p.addInitScript(() => {
    localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({
      access_token:"t", refresh_token:"r", expires_at: Math.floor(Date.now()/1000)+3600 }));
  });
  await p.goto("file://" + path.join(OBEN, "seiten", "kueche.html"));
  await p.waitForTimeout(1600);
  /* Über den KNOPF öffnen, nicht über die Funktion: Die ist im
     Küchenskript nicht global, und ein Aufruf von außen scheiterte
     lautlos — meine erste Fassung meldete deshalb „nichts offen".
     Von Hand bedient ist ohnehin der ehrlichere Weg. */
  const knopf = await p.$("#einstKnopf");
  if(knopf) await knopf.click();
  await p.waitForTimeout(600);

  const auf = await p.evaluate(() => !!document.querySelector(".decke .blatt"));
  ok(auf, "die Einstellungen gehen auf");
  /* Ohne dieses „wenn" bestanden die zwei Proben darunter auch dann,
     wenn gar nichts aufgegangen war: „nichts da" sieht aus wie
     „geschlossen". Genau das ist mir hier passiert. */
  if(!auf){
    ok(false, "ein kurzer Zug schließt sie NICHT", "nichts offen — nicht prüfbar");
    ok(false, "ein langer Zug schließt sie",       "nichts offen — nicht prüfbar");
  }else{
    await ziehe(p, ".decke .blatt .griff", 40);
    ok(await p.evaluate(() => !!document.querySelector(".decke .blatt")),
      "ein kurzer Zug schließt sie NICHT");

    await ziehe(p, ".decke .blatt .griff", 340);
    ok(await p.evaluate(() => !document.querySelector(".decke")),
      "ein langer Zug schließt sie");
  }

  ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
  await ctx.close();
}

(async () => {
  if(!fs.existsSync(path.join(OBEN, "dist", "chocolamour", "index.html"))){
    console.error("Kein erzeugter Hub in dist/. Erst: node erzeuger/erzeuge-hub.js --alle");
    process.exit(1);
  }
  geteilt();
  const br = await chromium.launch();
  await hub(br, false);
  await hub(br, true);
  await board(br);
  await kueche(br);
  await br.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Keine Fehler"));
  process.exit(fehler ? 1 : 0);
})();
