/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · „Passt dazu“ im Warenkorb  (braucht dist/)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-korb-vorschlag.js

   Wunsch des Betreibers: Im Warenkorb sollen andere Speisen oder
   Ergänzungen vorgeschlagen werden. Gemessen wird gegen die ECHTE Karte
   beider Häuser (§8.1a — ein Haus sieht jede eingebrannte Annahme für
   richtig an):
     · nichts, was schon im Korb liegt, nichts ohne Preis
     · fehlt ein Getränk, steht zuerst ein Getränk da
     · „+“ legt wirklich in den Korb, die Zeile erscheint, der
       Vorschlag verschwindet — und eine getippte Tischnummer bleibt
     · Übersetzung (Englisch), keine Laufzeitfehler, kein Überlauf
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const OBEN = path.resolve(__dirname, "..");

let n = 0, f = 0;
const pruef = (gut, text, mehr) => { n++; if(!gut) f++;
  console.log((gut ? "  ok   " : "  FEHL ") + text + (mehr !== undefined ? "  → " + mehr : "")); };

async function hubAuf(br, haus, breite, korb){
  const ctx = await br.newContext({ viewport:{ width:breite, height:844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await p.addInitScript(([slug, korb]) => {
    /* Der Willkommensschirm steht in sessionStorage (CLAUDE.md §3.8). */
    try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){}
    localStorage.setItem("omoteno-willkommen", "1");
    localStorage.setItem("omoteno-merk-" + slug, JSON.stringify(korb));
  }, [haus, korb]);
  await p.goto("file://" + path.join(OBEN, "dist", haus, "index.html") + "#/auswahl");
  await p.waitForTimeout(1200);
  return { p, ctx, fehler };
}

/* ── Nicht eintönig ─────────────────────────────────────────────
   Vorfall (Bildschirmfoto): vier Karten „AUCH BELIEBT“, viermal
   dasselbe Emoji — alle aus einer Gruppe. Gemessen an der echten
   Rechnung (dazuVorschlaege) UND am gezeichneten Bild. */
async function vielfalt(br, haus, erstes){
  console.log("  ── Vielfalt");
  const { p, ctx, fehler } = await hubAuf(br, haus, 390, { [erstes.n]: { n:erstes.n, p:erstes.p, b:"", m:1 } });
  const r = await p.evaluate(() => {
    const liste = dazuVorschlaege();
    const gruppen = liste.map(x => x.karte + "|" + x.gruppe);
    const gruende = liste.map(x => x.grund);
    const zaehl = {}; gruende.forEach(g => { zaehl[g] = (zaehl[g] || 0) + 1; });
    const alleGruppen = new Set();
    [["speisekarte", SPEISEKARTE], ["getraenke", GETRAENKE], ["cocktails", COCKTAILS]].forEach(([k, d]) =>
      d.forEach(gr => { if(gr.eintraege.some(e => e.p !== "–")) alleGruppen.add(k + "|" + gr.gruppe); }));
    const bild = [...document.querySelectorAll(".dazu-karte .dazu-grund")].map(x => x.textContent.trim());
    const emos = [...document.querySelectorAll(".dazu-karte .dazu-emo")].map(x => x.textContent);
    return { n:liste.length, gruppen, gruende, zaehl, alleGruppen:alleGruppen.size, bild, emos,
             satz:(document.querySelector(".dazu-satz") || {}).textContent || "" };
  });
  pruef(new Set(r.gruppen).size === r.gruppen.length, "höchstens eine Karte je Gruppe", r.gruppen.join(", "));
  /* Gegenbeweis A blieb grün (§8.1g E): Ohne Fotos hat jede Gruppe ihr
     eigenes Emoji, und die Emoji-Regel deckte die Gruppenregel mit ab.
     Mit Fotos an jedem Gericht gibt es kein Emoji — dann hält nur die
     Gruppenregel. */
  /* Und ein Korb, in dem ALLE vier Plätze aus derselben Stufe kommen:
     Getränk, Süßes und Herzhaftes liegen schon drin, nichts ist
     „beliebt“ — sonst verteilen Stufen und Vorsprung die Plätze schon
     auf Gruppen, und die Gruppenregel trüge nichts (zweiter grüner
     Gegenbeweis). */
  const mitFotos = await p.evaluate(() => {
    const merkBild = [], alt = merk;
    [SPEISEKARTE, GETRAENKE, COCKTAILS].forEach(d => d.forEach(gr => gr.eintraege.forEach(e => {
      merkBild.push([e, e.bild, e.top]); e.bild = "https://example.org/probe.jpg"; e.top = false; })));
    const erstes = (daten, bed) => { for(const gr of daten) if(bed(gr)) for(const e of gr.eintraege) if(e.p !== "–") return e; return null; };
    const korb = [erstes(GETRAENKE, () => true) || erstes(COCKTAILS, () => true),
                  erstes(SPEISEKARTE, gr => DAZU_SUESS.test(gr.gruppe || "")),
                  erstes(SPEISEKARTE, gr => !DAZU_SUESS.test(gr.gruppe || ""))].filter(Boolean);
    merk = {}; korb.forEach(e => { merk[e.n] = { n:e.n, p:e.p, b:"", m:1 }; });
    const g = dazuVorschlaege().map(x => x.karte + "|" + x.gruppe);
    merk = alt;
    merkBild.forEach(([e, b, t]) => { e.bild = b; e.top = t; });
    return g;
  });
  pruef(new Set(mitFotos).size === mitFotos.length, "auch mit Fotos (kein Emoji) höchstens eine je Gruppe", mitFotos.join(", "));
  /* Fehlt ein Getränk, sind alle Getränke gleich dringend — ohne Grenze
     je Stufe war die ganze Reihe Getränke (gemessen beim Bauen). */
  const essenDa = r.gruppen.some(g => g.startsWith("speisekarte|"));
  pruef(essenDa || r.alleGruppen <= 4, "nicht nur Getränke, wenn die Karte mehr hergibt", r.gruppen.join(", "));
  if(r.alleGruppen >= 4)
    pruef(new Set(r.gruende).size >= 2, "mindestens zwei verschiedene Gründe", r.gruende.join(", "));
  pruef(Object.entries(r.zaehl).every(([g, z]) => z <= 2 || g === "Mal etwas anderes"),
    "kein Grund öfter als zweimal", JSON.stringify(r.zaehl));
  pruef(!r.bild.some(x => /auch beliebt/i.test(x)), "kein „Auch beliebt“ mehr auf den Karten", r.bild.join(", "));
  if(r.emos.length >= 2)
    pruef(new Set(r.emos).size >= Math.min(r.emos.length, 2), "nicht überall dasselbe Emoji", r.emos.join(" "));
  pruef(r.satz === "Dazu noch etwas zu trinken?", "Satz geht auf den Korb ein (Essen ohne Getränk)", r.satz);

  /* Andere Körbe → andere Reihen; derselbe Korb → dieselbe. Probe mit
     vier Körben: Mindestens zwei Reihen müssen sich unterscheiden. */
  const reihen = await p.evaluate(() => {
    const essen = [];
    SPEISEKARTE.forEach(gr => gr.eintraege.forEach(e => { if(e.p !== "–") essen.push(e); }));
    const out = [];
    for(let i = 0; i < Math.min(4, essen.length); i++){
      const alt = merk; merk = { [essen[i * 3 % essen.length].n]: { n:essen[i * 3 % essen.length].n, p:essen[i * 3 % essen.length].p, b:"", m:1 } };
      out.push(dazuVorschlaege().map(x => x.e.n).join("|"));
      out.push(dazuVorschlaege().map(x => x.e.n).join("|"));
      merk = alt;
    }
    return out;
  });
  const paare = []; for(let i = 0; i < reihen.length; i += 2) paare.push(reihen[i] === reihen[i + 1]);
  pruef(paare.every(Boolean), "derselbe Korb zweimal → dieselbe Reihe", paare.join(","));
  const verschieden = new Set(reihen.filter((_, i) => i % 2 === 0)).size;
  pruef(verschieden >= 2, "verschiedene Körbe → nicht immer dieselbe Reihe", verschieden + " verschiedene von " + reihen.length / 2);

  /* Gründe, die auf den Gast eingehen — jeder mit Gegenfall. */
  const gruende = await p.evaluate(name => {
    const ziel = dazuVorschlaege()[1] || dazuVorschlaege()[0];
    const n = ziel.e.n;
    aktionen = [{ id:"probe", gericht_name:n, bis:new Date(Date.now() + 3600e3).toISOString() }];
    const mitAktion = (dazuVorschlaege().find(x => x.e.n === n) || {}).grund;
    aktionen = [];
    const ohneAktion = (dazuVorschlaege().find(x => x.e.n === n) || {}).grund;
    /* „Neu für Sie“: Der Gast hat schon etwas bestellt, dieses nicht. */
    localStorage.setItem(hSchluessel("probiert"), JSON.stringify([name]));
    const neuFuerSie = dazuVorschlaege().some(x => x.grund === "Neu für Sie");
    localStorage.removeItem(hSchluessel("probiert"));
    const ohneVerlauf = dazuVorschlaege().some(x => x.grund === "Neu für Sie");
    return { n, mitAktion, ohneAktion, neuFuerSie, ohneVerlauf };
  }, erstes.n);
  pruef(gruende.mitAktion === "Im Angebot", "läuft eine Aktion, steht „Im Angebot“", gruende.n + ": " + gruende.mitAktion);
  pruef(gruende.ohneAktion !== "Im Angebot", "ohne Aktion nicht", gruende.ohneAktion);
  pruef(gruende.neuFuerSie, "mit Bestellverlauf: „Neu für Sie“ bei Unbekanntem");
  pruef(!gruende.ohneVerlauf, "ohne Verlauf kein „Neu für Sie“ (sonst wäre ALLES neu)");
  pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
  await ctx.close();
}

/* ── Details aus dem Korb ──────────────────────────────────────────
   Wunsch: „sobald man die Speisen im Warenkorb anklickt, kann man
   nicht die Allergene oder sonstige genauere Details einsehen“. Jetzt
   öffnet der Tipp das Blatt der Karte. Herausnehmen im Blatt muss nach
   dem Schließen in der Auswahl stimmen, eine getippte Tischnummer
   bleibt. */
async function details(br, haus, erstes){
  console.log("  ── Details aus dem Korb");
  const { p, ctx, fehler } = await hubAuf(br, haus, 390, { [erstes.n]: { n:erstes.n, p:erstes.p, b:"", m:1 } });
  const zeile = '.merkzeile[data-zeile="' + encodeURIComponent(erstes.n) + '"] [data-detail]';
  pruef(!!(await p.$(zeile)), "die Korbzeile ist ein Griff zu den Details");
  const tisch = await p.$("#bTisch");
  if(tisch) await tisch.fill("7");
  await p.click(zeile);
  await p.waitForTimeout(500);
  const blatt = await p.evaluate(() => {
    const k = document.getElementById("warenkarte");
    return { offen: !!k && k.classList.contains("an"), name: detailName,
             allergene: !!(k && k.querySelector(".wgruppe")), hatInfo: !!INHALTSSTOFFE[detailName],
             raus: !!(k && k.querySelector("[data-wmerk]")) };
  });
  pruef(blatt.offen && blatt.name === erstes.n, "Tipp öffnet das Blatt dieses Gerichts", blatt.name);
  if(blatt.hatInfo) pruef(blatt.allergene, "mit Allergenen und Zusatzstoffen");
  pruef(blatt.raus, "Voraussetzung: im Blatt kann man es herausnehmen");
  await p.click("#warenkarte [data-wmerk]");
  await p.waitForTimeout(250);
  await p.evaluate(() => detailSchliessen());
  await p.waitForTimeout(500);
  const nach = await p.evaluate(name => ({
    imKorb: !!merk[name],
    zeile: !!document.querySelector('.merkzeile[data-zeile="' + encodeURIComponent(name) + '"]'),
    tisch: (document.getElementById("bTisch") || {}).value
  }), erstes.n);
  pruef(!nach.imKorb, "im Blatt herausgenommen …");
  pruef(!nach.zeile, "… und nach dem Schließen steht die Zeile nicht mehr in der Auswahl");
  if(nach.tisch !== undefined) pruef(nach.tisch === "7" || nach.tisch === "", "Tischnummer bleibt oder Seite ist leer", nach.tisch);

  /* Vorschlagskarte: Bild/Name öffnen Details, „+“ legt hinein. */
  const q = await hubAuf(br, haus, 390, { [erstes.n]: { n:erstes.n, p:erstes.p, b:"", m:1 } });
  const info = await q.p.$(".dazu-karte .dazu-info");
  pruef(!!info, "Vorschlagskarte hat einen Griff zu den Details");
  if(info){
    const ziel = decodeURIComponent(await info.getAttribute("data-detail"));
    await info.click(); await q.p.waitForTimeout(500);
    const off = await q.p.evaluate(() => ({ name:detailName, imKorbVorher:null }));
    pruef(off.name === ziel, "Tipp auf die Vorschlagskarte öffnet ihre Details", off.name);
    await q.p.evaluate(() => detailSchliessen()); await q.p.waitForTimeout(300);
    const plus = await q.p.evaluate(z => !!merk[z], ziel);
    pruef(!plus, "ein Tipp auf die Details legt nichts in den Korb");
  }
  pruef(!fehler.length && !q.fehler.length, "keine Laufzeitfehler", (fehler[0] || q.fehler[0]) || "still");
  await ctx.close(); await q.ctx.close();
}


/* ── Mach es komplett, Schwelle, Rad am Ende, Kontrast ─────────────── */
async function mehr(br, haus, erstes){
  console.log("  ── Mach es komplett, Weg zur Schwelle, Rad");
  const { p, ctx, fehler } = await hubAuf(br, haus, 390, { [erstes.n]: { n:erstes.n, p:erstes.p, b:"", m:1 } });
  const k = await p.evaluate(() => {
    const b = document.querySelector("[data-dazu-beide]");
    if(!b) return null;
    const namen = b.dataset.dazuBeide.split("|").map(decodeURIComponent);
    return { namen, welten: namen.map(n => karteIstGetraenk((gerichtOrt(n) || {}).karte)),
             preis: (b.querySelector(".dazu-beide-preis") || {}).textContent,
             soll: preisText(namen.reduce((s, n) => s + preisNum(korbPreis(findeGericht(n))), 0)),
             vorne: dazuVorschlaege()[0].e.n };
  });
  pruef(!!k && k.namen.length === 2 && k.welten[0] !== k.welten[1], "„Mach es komplett“: zwei Dinge, ein Getränk und etwas zu essen", k && k.namen.join(" + "));
  pruef(!!k && k.namen[0] === k.vorne, "… das erste ist der dringendste Vorschlag", k && k.vorne);
  pruef(!!k && k.preis === k.soll, "… mit der Summe der beiden (Aktionspreis zählt)", k && (k.preis + " = " + k.soll));
  if(k){
    await p.click("[data-dazu-beide]"); await p.waitForTimeout(500);
    const r = await p.evaluate(namen => ({ drin: namen.map(n => !!merk[n]),
      karten: namen.map(n => { const x = document.querySelector('.dazu-karte[data-name="' + encodeURIComponent(n) + '"]'); return !!x && x.classList.contains("drin"); }),
      weg: !document.querySelector("[data-dazu-beide]"), satz: document.querySelector(".dazu-satz").textContent }), k.namen);
    pruef(r.drin.every(Boolean) && r.karten.every(Boolean), "„Beides dazu“ legt beide in den Korb, beide Karten „Im Korb“", JSON.stringify(r));
    pruef(r.weg && r.satz === "Gute Wahl! Noch etwas dazu?", "danach kein zweites Angebot, der Satz lobt", r.satz);
  }
  /* Schwelle: Lieferung mit „frei ab 30 €“ — und Gegenfall ohne Schwelle */
  const z = await p.evaluate(() => {
    const lese = () => { const e = document.querySelector(".dazu-ziel"); if(!e) return null;
      const i = e.querySelector(".dazu-ziel-spur i");
      return { text: e.querySelector(".dazu-ziel-text").textContent, x: +new DOMMatrixReadOnly(getComputedStyle(i).transform).a.toFixed(2) }; };
    const alt = { an:LIEFER.an, g:LIEFER.gratis_ab, m:LIEFER.mindest, lm:liefermodus };
    LIEFER.an = true; LIEFER.mindest = 0; LIEFER.gratis_ab = 30; liefermodus = true;
    const summe = merkSumme();
    auswahlNeuMitFeldern(); const mit = lese();
    LIEFER.gratis_ab = 0; auswahlNeuMitFeldern(); const ohne = lese();
    LIEFER.gratis_ab = Math.max(1, Math.floor(summe) - 1); auswahlNeuMitFeldern(); const erreicht = lese();
    LIEFER.an = alt.an; LIEFER.gratis_ab = alt.g; LIEFER.mindest = alt.m; liefermodus = alt.lm; auswahlNeuMitFeldern();
    return { summe, mit, ohne, erreicht, soll: t("Noch {b} bis zur kostenlosen Lieferung", {b: preisText(30 - summe)}), anteil: +(summe / 30).toFixed(2) };
  });
  pruef(!!z.mit && z.mit.text === z.soll && Math.abs(z.mit.x - z.anteil) <= .02, "Lieferung frei ab 30 €: Satz mit dem Rest und Balken im richtigen Anteil", JSON.stringify(z.mit) + " soll " + z.anteil);
  pruef(!z.ohne && !z.erreicht, "ohne Schwelle oder schon darüber: kein Balken", JSON.stringify([z.ohne, z.erreicht]));
  /* Rad am Ende der Reihe: führt ins Foodroulette und dreht */
  const rad = await p.$(".dazu-reihe .dazu-rad");
  pruef(!!rad, "am Ende der Reihe: „Das Rad entscheiden lassen“");
  if(rad){
    const letzte = await p.evaluate(() => { const r = [...document.querySelectorAll(".dazu-reihe > *")]; return r[r.length - 1].classList.contains("dazu-rad"); });
    pruef(letzte, "… als letzte Karte");
    await p.evaluate(() => { const r = document.querySelector(".dazu-reihe"); r.scrollLeft = r.scrollWidth; });
    await rad.click(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ seite: seiteJetzt, modus: frModus,
      laeuft: !!document.getElementById("frScheibe") && document.getElementById("frScheibe").getAnimations().some(a => a.playState === "running") }));
    pruef(r.seite === "entdecken" && r.modus === "rad" && r.laeuft, "… ein Tipp: Foodroulette öffnet und das Rad dreht", JSON.stringify(r));
  }
  pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
  await ctx.close();

  /* Kontrast: jede Schrift in der Reihe, hell und dunkel, mit einer Karte „Im Korb“ */
  for(const licht of ["hell", "dunkel"]){
    const q = await hubAuf(br, haus, 390, { [erstes.n]: { n:erstes.n, p:erstes.p, b:"", m:1 } });
    await q.p.evaluate(l => lichtSetzen(l), licht);
    /* Hell/Dunkel blendet über (Farbübergang) — erst danach messen. */
    await q.p.waitForTimeout(900);
    await q.p.evaluate(() => { LIEFER.an = true; LIEFER.gratis_ab = 99; liefermodus = true; auswahlNeuMitFeldern(); });
    /* Zweimal gemessen: vorher steht „Mach es komplett“, nachher eine Karte „Im Korb“. */
    const KONTRAST = () => {
      const zahl = t => { const s = String(t);
        const m = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
        if(m) return [m[1] * 255, m[2] * 255, m[3] * 255].concat(m[4] !== undefined ? [+m[4]] : []);
        return (s.match(/[\d.]+/g) || []).map(Number); };
      const kanal = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
      const L = p => .2126 * kanal(p[0]) + .7152 * kanal(p[1]) + .0722 * kanal(p[2]);
      const misch = (o, u) => { const a = o.length > 3 ? o[3] : 1; return [0, 1, 2].map(i => o[i] * a + u[i] * (1 - a)); };
      /* Ein Verlauf steht in backgroundImage, nicht in backgroundColor
         (Gegenbeweis 09.10.: die Rad-Karte mit Verlauf blieb ungemessen,
         die Probe stieg an ihr vorbei auf den Seitengrund). Gerechnet
         wird gegen JEDE Kante des Verlaufs, gemeldet die schlechteste. */
      const kanten = st => (String(st.backgroundImage).match(/color\(srgb[^)]*\)|rgba?\([^)]*\)/g) || []).map(zahl).filter(v => v.length >= 3);
      const gruende = el => { const st = []; let k = el;
        while(k){ const cs = getComputedStyle(k), b = zahl(cs.backgroundColor), v = kanten(cs);
          if(v.length){ st.push(v); if(v.every(x => x.length === 3 || x[3] === 1)) break; }
          if(b.length >= 3 && (b.length < 4 || b[3] > 0)) st.push([b]);
          if(b.length === 3 || b[3] === 1) break; k = k.parentElement; }
        if(!st.length) return [[255, 255, 255]];
        const n = Math.max(...st.map(l => l.length)), aus = [];
        for(let i = 0; i < n; i++){
          const spur = st.map(l => l[Math.min(i, l.length - 1)]);
          let u = spur.pop(); if(u.length > 3) u = misch(u, [255, 255, 255]);
          while(spur.length) u = misch(spur.pop(), u);
          aus.push(u);
        }
        return aus; };
      const aus = [];
      document.querySelectorAll(".dazu-satz, .dazu-pille, .dazu-name, .dazu-preis, .dazu-menge, .dazu-ziel-text, .dazu-rad .dazu-grund, .dazu-rad .dazu-name, .dazu-beide, .dazu-komplett-text .dazu-grund, .dazu-komplett-text b").forEach(el => {
        if(!el.textContent.trim()) return;
        const c = zahl(getComputedStyle(el).color);
        const werte = gruende(el).map(g => { const a = L(misch(c, g)), b = L(g); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); });
        aus.push([el.className, +Math.min(...werte).toFixed(2)]);
      });
      return aus;
    };
    const vorher = await q.p.evaluate(KONTRAST);
    pruef(vorher.some(x => /dazu-grund/.test(x[0])) && await q.p.evaluate(() => !!document.querySelector(".dazu-komplett")), "Voraussetzung: „Mach es komplett“ steht beim Messen da");
    await q.p.click(".dazu-reihe [data-dazu]"); await q.p.waitForTimeout(400);
    const r = vorher.concat(await q.p.evaluate(KONTRAST));
    const schlecht = r.filter(x => x[1] < 4.5);
    pruef(r.length >= 8 && !schlecht.length, licht + ": jede Schrift in „Passt dazu“ ≥ 4,5:1",
      schlecht.length ? schlecht.map(x => x.join(" ")).join(", ") : r.length + " Stellen, kleinste " + Math.min(...r.map(x => x[1])));
    for(const breite of [360, 430]){
      await q.p.setViewportSize({ width:breite, height:844 }); await q.p.waitForTimeout(150);
      const m = await q.p.evaluate(() => ({ ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        klein: [...document.querySelectorAll(".dazu-plus, .dazu-menge button, .dazu-beide, .dazu-rad")].filter(b => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length }));
      pruef(m.ueber <= 0 && !m.klein, licht + " · " + breite + " px: kein Überlauf, jede Tapfläche ≥ 44 px", JSON.stringify(m));
    }
    pruef(!q.fehler.length, licht + ": keine Laufzeitfehler", q.fehler[0] || "still");
    await q.ctx.close();
  }
}

(async () => {
  const br = await chromium.launch();
  for(const haus of ["chocolamour", "blend"]){
    console.log("\n══ " + haus + " ══");
    /* Ein Gericht aus der Speisekarte, KEIN Getränk — dann muss die
       Getränke-Regel greifen. Welches, sagt die Karte selbst.
       Ehrliche Grenze: Ohne Datenbank zeigt jeder Hub die Beispielkarte
       aus der Vorlage (auch Blend) — live kommt die Karte des Hauses
       aus gerichte. Die Regel wird hier also zweimal an derselben
       Karte gemessen; der Unterschied der Häuser liegt in Farbe,
       Rundung und Sprache, die sehr wohl je Haus greifen. */
    const probe = await hubAuf(br, haus, 390, {});
    const erstes = await probe.p.evaluate(() => {
      for(const gr of SPEISEKARTE) for(const e of gr.eintraege) if(e.p !== "–") return { n:e.n, p:e.p };
      return null; });
    await probe.ctx.close();
    pruef(!!erstes, "Voraussetzung: die Karte hat ein bestellbares Gericht", erstes && erstes.n);
    if(!erstes) continue;

    const { p, ctx, fehler } = await hubAuf(br, haus, 390, { [erstes.n]: { n:erstes.n, p:erstes.p, b:"", m:1 } });
    const lage = await p.evaluate(name => {
      const karten = [...document.querySelectorAll(".dazu-karte:not(.dazu-rad)")];
      const namen = karten.map(k => decodeURIComponent(k.querySelector("[data-dazu]").dataset.dazu));
      const ohnePreis = namen.filter(x => { const g = findeGericht(x); return !g || g.p === "–"; });
      const orte = namen.map(x => (gerichtOrt(x) || {}).karte);
      return { anzahl:karten.length, namen, doppelt:namen.includes(name), ohnePreis, erstesOrt:orte[0],
        getraenkeDa: GETRAENKE.some(gr => gr.eintraege.some(e => e.p !== "–")) || COCKTAILS.some(gr => gr.eintraege.some(e => e.p !== "–")),
        kopf:(document.querySelector(".dazu-kopf") || {}).textContent || "" };
    }, erstes.n);
    pruef(lage.anzahl >= 1 && lage.anzahl <= 6, "ein bis sechs Vorschläge stehen da", lage.anzahl + ": " + lage.namen.join(", "));
    pruef(!lage.doppelt, "nichts, was schon im Korb liegt");
    pruef(!lage.ohnePreis.length, "nichts ohne Preis", lage.ohnePreis.join(", ") || "keins");
    if(lage.getraenkeDa)
      pruef(lage.erstesOrt === "getraenke" || lage.erstesOrt === "cocktails",
        "kein Getränk im Korb → zuerst ein Getränk", lage.erstesOrt);
    pruef(lage.kopf === "Passt dazu", "Überschrift „Passt dazu“", lage.kopf);

    /* Stabil: zweimal zeichnen, dieselbe Reihe (§4.2 — kein Zufall). */
    const zweimal = await p.evaluate(() => {
      const a = dazuVorschlaege().map(x => x.e.n).join("|");
      const b = dazuVorschlaege().map(x => x.e.n).join("|");
      return a === b; });
    pruef(zweimal, "dieselbe Reihenfolge bei jedem Zeichnen");

    /* Tischnummer tippen, dann „+“ — die Nummer muss bleiben. */
    const tisch = await p.$("#bTisch");
    if(tisch) await tisch.fill("12");
    const erster = lage.namen[0];
    await p.click('.dazu-karte [data-dazu="' + encodeURIComponent(erster) + '"]');
    await p.waitForTimeout(500);
    const nach = await p.evaluate(name => ({
      imKorb: !!merk[name],
      zeile: !!document.querySelector('[data-zeile="' + encodeURIComponent(name) + '"]'),
      nochVorgeschlagen: !!document.querySelector('.dazu-karte [data-dazu="' + encodeURIComponent(name) + '"]'),
      tisch: (document.getElementById("bTisch") || {}).value,
      artikel: (document.getElementById("artikelzahl") || {}).textContent }), erster);
    pruef(nach.imKorb, "„+“ legt es in den Korb", erster);
    pruef(nach.zeile, "die Zeile erscheint in der Auswahl");
    /* Seit 09.10.: Die Karte BLEIBT stehen („Im Korb“, −/+), und die
       Reihe ordnet sich nicht um — sonst verlor der Gast, was er gerade
       angetippt hatte (vorher: Karte weg, ganze Reihe neu). */
    const karte = await p.evaluate(name => {
      const k = document.querySelector('.dazu-karte[data-name="' + encodeURIComponent(name) + '"]');
      const reihe = [...document.querySelectorAll(".dazu-karte:not(.dazu-rad)")].map(x => decodeURIComponent(x.dataset.name));
      const knoepfe = k ? [...k.querySelectorAll("[data-dazu-m]")].map(b => b.getBoundingClientRect()) : [];
      return { da: !!k, drin: !!k && k.classList.contains("drin"), zahl: k && (k.querySelector(".dazu-mz") || {}).textContent,
               pille: k && (k.querySelector(".dazu-pille") || {}).textContent, plus: !!(k && k.querySelector("[data-dazu]")),
               reihe, ziele: knoepfe.map(r => Math.round(Math.min(r.width, r.height))) };
    }, erster);
    pruef(karte.da && karte.drin && karte.zahl === "1" && !karte.plus, "die Karte bleibt stehen, „Im Korb“ mit −/+", JSON.stringify(karte));
    pruef(karte.reihe.join("|") === lage.namen.join("|"), "die Reihe ordnet sich nach „+“ nicht um", karte.reihe.join(", "));
    pruef(karte.ziele.length === 2 && karte.ziele.every(x => x >= 44), "−/+ auf der Karte je ≥ 44 px", karte.ziele.join("/"));
    await p.click('.dazu-karte[data-name="' + encodeURIComponent(erster) + '"] [data-dazu-m="1"]');
    await p.waitForTimeout(400);
    const zwei = await p.evaluate(name => ({ m: (merk[name] || {}).m, mz: (document.querySelector('.dazu-karte[data-name="' + encodeURIComponent(name) + '"] .dazu-mz') || {}).textContent,
      zeile: (document.querySelector('.merkzeile[data-zeile="' + encodeURIComponent(name) + '"] .mz') || {}).textContent }), erster);
    pruef(zwei.m === 2 && zwei.mz === "2" && zwei.zeile === "2", "„+“ auf der Karte zählt hoch — in Karte UND Korbzeile", JSON.stringify(zwei));
    await p.click('.dazu-karte[data-name="' + encodeURIComponent(erster) + '"] [data-dazu-m="-1"]'); await p.waitForTimeout(300);
    await p.click('.dazu-karte[data-name="' + encodeURIComponent(erster) + '"] [data-dazu-m="-1"]'); await p.waitForTimeout(400);
    const raus = await p.evaluate(name => ({ imKorb: !!merk[name],
      plus: !!document.querySelector('.dazu-karte[data-name="' + encodeURIComponent(name) + '"] [data-dazu]') }), erster);
    pruef(!raus.imKorb && raus.plus, "zweimal „−“ nimmt es heraus, die Karte zeigt wieder „+“", JSON.stringify(raus));
    if(tisch) pruef(nach.tisch === "12", "eine getippte Tischnummer bleibt stehen", nach.tisch);

    /* Kein Überlauf auf dem schmalsten Telefon. */
    await p.setViewportSize({ width:360, height:780 });
    await p.waitForTimeout(200);
    const breit = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(breit <= 0, "bei 360 px kein seitlicher Überlauf", breit + " px");

    /* Englisch */
    await p.evaluate(() => { spracheSetzen("en"); zeichne(); });
    await p.waitForTimeout(400);
    const en = await p.evaluate(() => (document.querySelector(".dazu-kopf") || {}).textContent || "");
    pruef(en === "Goes well with it", "übersetzt (Englisch)", en || "(nicht gefunden)");

    pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();

    await vielfalt(br, haus, erstes);
    await mehr(br, haus, erstes);
    await details(br, haus, erstes);
  }
  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Fehler." : n + " von " + n + " ok\nAlles sauber."));
  process.exit(f ? 1 : 0);
})();
