/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Der Gäste-Hub von Hand bedient

     node erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruef-hub-hand.js [slug]

   pruef-durchgang.js geht den Weg des Gastes einmal durch. Diese
   hier fragt die acht Dinge, die dabei NICHT vorkommen — und jedes
   davon hat schon einmal etwas kaputtgemacht:

   1 · NEULADEN innerhalb der Sitzung. Der schwerste Fehler dieses
       Projekts lag genau hier: Der Willkommensschirm blieb
       undurchsichtig über dem Hub liegen und fing jeden Tipp ab.
       Wer immer frisch öffnet, sieht das nie.
   2 · JEDER Bereich einzeln — gefüllt, und nichts schiebt seitlich.
   3 · TREFFERFLÄCHEN. Unter 32px trifft ein Finger daneben. So ist
       am 30.08. aufgefallen, dass der VORFÜHRBLOCK noch im
       ausgelieferten Hub steckte: drei Knöpfe mit 28px Höhe.
   4 · HELL UND DUNKEL, und ob die Wahl ein Neuladen überlebt.
   5 · JEDE Sprache einzeln, auf Platzhalter und seitliches Schieben.
   6 · ZWEIMAL bestellen. Beim ersten Durchgang sieht jede
       Verwechslung richtig aus (CLAUDE.md §1.1a).
   7 · Die FIGUR des Hauses — die richtige, nicht die des Nachbarn.
   8 · REDUZIERTE BEWEGUNG. Hier drehte sich die LED im Siegel
       weiter, weil die Gegenregel eine kürzere Spezifität hatte als
       die Regel, die sie aufheben sollte.

   Gefahren wird OHNE Netz nach außen: So sieht es aus, wenn das
   WLAN des Hauses klemmt.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
/* Welcher Hub? Ohne Angabe der erste in dist/. Die Datei neben sich
   suchen, nicht an einem festen Pfad — nach einer Umbenennung fällt
   eine Prüfung sonst mit ENOENT um (CLAUDE.md §8.2). */
const DIST = path.join(__dirname, "dist");
if(!fs.existsSync(DIST)){
  console.error("dist/ fehlt. Erst „node erzeuge-hub.js --alle\" laufen lassen.");
  process.exit(1);
}
const SLUG = process.argv[2] ||
  fs.readdirSync(DIST).find(n => fs.existsSync(path.join(DIST, n, "index.html")));
const PFAD = path.join(DIST, SLUG || "", "index.html");
if(!SLUG || !fs.existsSync(PFAD)){
  console.error("Kein erzeugter Hub gefunden in dist/.");
  process.exit(1);
}
console.log("Geprüft wird: " + SLUG);
const DATEI = "file://" + PFAD;
let fehler = 0, warn = 0;
const ok   = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };
const hinw = (g,t,z) => { console.log((g?"  ok   ":"  hinw ")+t+(z?"  → "+z:"")); if(!g) warn++; };

async function neu(b, w, h, opt){
  const ctx = await b.newContext(Object.assign({viewport:{width:w,height:h}}, opt||{}));
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  p.on("console", m => { if(m.type()==="error") kons.push(m.text().slice(0,150)); });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  return { ctx, p, kons };
}
const echt = k => k.filter(z => !/net::ERR|Failed to (load|fetch)|ERR_FAILED|supabase|Load failed/i.test(z));

(async () => {
  const b = await chromium.launch();

  /* ══ 1 · NEULADEN INNERHALB DER SITZUNG ══════════════════════
     Der schwerste Fehler dieses Projekts: Nach einem Neuladen lag
     der Willkommensschirm undurchsichtig ueber dem Hub und fing
     jeden Tipp ab. pruef-durchgang.js oeffnet immer frisch. */
  console.log("\n══ 1 · Neuladen innerhalb der Sitzung ══");
  {
    const { ctx, p, kons } = await neu(b, 390, 844);
    await p.goto(DATEI); await p.waitForTimeout(900);
    const schirm = await p.$("#willkommen");
    if(schirm){ await p.click("#willkommen").catch(()=>{}); await p.waitForTimeout(700); }
    for(let i = 1; i <= 3; i++){
      await p.reload(); await p.waitForTimeout(900);
      const s = await p.evaluate(() => {
        const el = document.getElementById("willkommen");
        const mitte = document.elementFromPoint(innerWidth/2, innerHeight/2);
        return { da: !!el,
                 sichtbar: el ? getComputedStyle(el).display !== "none" : false,
                 faengt: mitte ? mitte.id + "." + (mitte.className||"") : "—" };
      });
      ok(!s.sichtbar, "Neuladen " + i + ": kein Schirm ueber dem Hub",
        s.da ? (s.sichtbar ? "SICHTBAR" : "entfernt/versteckt") : "entfernt");
      ok(!/willkommen/i.test(s.faengt), "Neuladen " + i + ": die Mitte ist antippbar", s.faengt);
    }
    ok(echt(kons).length === 0, "kein Fehler nach drei Neuladen", echt(kons)[0] || "still");
    await ctx.close();
  }

  /* ══ 2 · JEDER BEREICH OEFFNET UND IST GEFUELLT ══════════════ */
  console.log("\n══ 2 · Jeder Bereich ══");
  {
    const { ctx, p, kons } = await neu(b, 390, 844);
    await p.goto(DATEI); await p.waitForTimeout(900);
    if(await p.$("#willkommen")) { await p.click("#willkommen").catch(()=>{}); await p.waitForTimeout(600); }
    const kacheln = await p.$$eval("a.kachel, .kachel[data-ziel], [data-ziel]",
      e => [...new Set(e.map(x => x.dataset.ziel || (x.getAttribute("href")||"").replace("#","")))].filter(Boolean));
    ok(kacheln.length >= 5, "die Startseite zeigt die Bereiche des Hauses", kacheln.join(", "));
    for(const z of kacheln){
      const s = await p.evaluate(async zi => {
        if(typeof zeige === "function") zeige(zi);
        else location.hash = zi;
        await new Promise(r => setTimeout(r, 420));
        const w = document.getElementById("wurzel") || document.querySelector("main") || document.body;
        const t = (w.innerText || "").replace(/\s+/g," ").trim();
        return { zeichen: t.length, anfang: t.slice(0,42),
                 knoepfe: w.querySelectorAll("button,a,input,select,textarea").length,
                 ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      }, z);
      ok(s.zeichen > 60, "„" + z + "“ ist gefuellt",
        s.zeichen + " Zeichen, " + s.knoepfe + " Bedienelemente · " + s.anfang);
      ok(s.ueber <= 1, "  und schiebt nicht seitlich", s.ueber + "px");
    }
    ok(echt(kons).length === 0, "kein Fehler beim Durchgehen", echt(kons)[0] || "still");
    await ctx.close();
  }

  /* ══ 3 · TREFFERFLAECHEN ═════════════════════════════════════
     44px ist das Mass, unter dem ein Finger danebentrifft. */
  console.log("\n══ 3 · Trefferflaechen auf dem Telefon ══");
  {
    const { ctx, p } = await neu(b, 390, 844);
    await p.goto(DATEI); await p.waitForTimeout(900);
    if(await p.$("#willkommen")) { await p.click("#willkommen").catch(()=>{}); await p.waitForTimeout(600); }
    const klein = await p.evaluate(() => [...document.querySelectorAll("button,a[href],input,select")]
      .filter(el => el.offsetParent !== null)
      .map(el => { const r = el.getBoundingClientRect();
        return { w:Math.round(r.width), h:Math.round(r.height),
                 was:(el.tagName+"."+(el.className||"")).slice(0,34),
                 text:(el.innerText||el.value||"").trim().slice(0,20) }; })
      .filter(x => x.w > 0 && x.h > 0 && Math.min(x.w,x.h) < 32));
    hinw(klein.length === 0, "keine Trefferflaeche unter 32px",
      klein.length ? klein.slice(0,4).map(x=>x.was+" "+x.w+"×"+x.h+" („"+x.text+"“)").join(" | ")
                   : "alle gross genug");
    await ctx.close();
  }

  /* ══ 4 · HELL UND DUNKEL ═════════════════════════════════════ */
  console.log("\n══ 4 · Hell und dunkel ══");
  {
    const { ctx, p, kons } = await neu(b, 390, 844);
    await p.goto(DATEI); await p.waitForTimeout(900);
    if(await p.$("#willkommen")) { await p.click("#willkommen").catch(()=>{}); await p.waitForTimeout(600); }
    const knopf = await p.$("#lichtknopf");
    ok(!!knopf, "der Lichtschalter steht im Kopf");
    if(knopf){
      const staende = [];
      for(let i = 0; i < 4; i++){
        staende.push(await p.evaluate(() => ({
          phase: document.body.dataset.phase || "—",
          grund: getComputedStyle(document.body).backgroundColor,
          schrift: getComputedStyle(document.body).color })));
        await knopf.click(); await p.waitForTimeout(400);
      }
      const versch = new Set(staende.map(s => s.phase + s.grund));
      ok(versch.size >= 2, "er schaltet wirklich um",
        staende.map(s => s.phase).join(" → "));
      /* Und die Wahl muss ein Neuladen ueberleben — genau hier lag
         der Fehler mit der const in der zeitlichen Totzone. */
      const vor = await p.evaluate(() => document.body.dataset.phase);
      await p.reload(); await p.waitForTimeout(900);
      const nach = await p.evaluate(() => document.body.dataset.phase);
      ok(vor === nach, "die Wahl ueberlebt das Neuladen", vor + " → " + nach);
    }
    ok(echt(kons).length === 0, "kein Fehler beim Umschalten", echt(kons)[0] || "still");
    await ctx.close();
  }

  /* ══ 5 · ELF SPRACHEN, JEDE EINZELN ══════════════════════════ */
  console.log("\n══ 5 · Alle Sprachen ══");
  {
    const { ctx, p, kons } = await neu(b, 390, 844);
    await p.goto(DATEI); await p.waitForTimeout(900);
    if(await p.$("#willkommen")) { await p.click("#willkommen").catch(()=>{}); await p.waitForTimeout(600); }
    const sprachen = await p.$$eval(".sprachliste button", e => e.map(x => x.dataset.sprache || x.textContent.trim()));
    ok(sprachen.length >= 8, "der Hub bietet seine Sprachen an", sprachen.length + ": " + sprachen.join(" "));
    const leer = [];
    for(const s of sprachen){
      const r = await p.evaluate(async sp => {
        if(typeof spracheSetzen === "function") spracheSetzen(sp);
        await new Promise(r => setTimeout(r, 320));
        const t = (document.body.innerText||"").replace(/\s+/g," ").trim();
        return { zeichen: t.length, rtl: document.documentElement.dir,
                 ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                 platzhalter: /undefined|\[object|NaN/.test(t) };
      }, s);
      if(r.zeichen < 200 || r.platzhalter || r.ueber > 1)
        leer.push(s + " (" + r.zeichen + " Zeichen" +
          (r.platzhalter ? ", PLATZHALTER" : "") + (r.ueber>1 ? ", schiebt "+r.ueber+"px" : "") + ")");
    }
    ok(leer.length === 0, "jede Sprache fuellt die Seite ohne Luecken",
      leer.length ? leer.join(" | ") : sprachen.length + " geprueft");
    ok(echt(kons).length === 0, "kein Fehler beim Sprachwechsel", echt(kons)[0] || "still");
    await ctx.close();
  }

  /* ══ 6 · BESTELLEN, ZWEIMAL ══════════════════════════════════
     Der zweite Durchgang ist der, in dem sich Verwechslungen
     zeigen — beim ersten sieht alles richtig aus (§1.1a). */
  console.log("\n══ 6 · Zweimal bestellen ══");
  {
    const { ctx, p, kons } = await neu(b, 390, 844);
    await p.goto(DATEI); await p.waitForTimeout(900);
    if(await p.$("#willkommen")) { await p.click("#willkommen").catch(()=>{}); await p.waitForTimeout(600); }
    for(const runde of [1, 2]){
      const r = await p.evaluate(async () => {
        if(typeof zeige === "function") zeige("speisekarte");
        await new Promise(r => setTimeout(r, 420));
        const plus = document.querySelector(".stepper button:last-child, .hub-plus, [data-mehr]");
        if(plus){ plus.click(); await new Promise(r => setTimeout(r, 220)); }
        const balken = document.querySelector(".auswahlbalken");
        return { korb: balken ? (balken.innerText||"").replace(/\s+/g," ").trim().slice(0,40) : "kein Balken",
                 sichtbar: balken ? getComputedStyle(balken).display !== "none" : false };
      });
      ok(r.sichtbar, "Runde " + runde + ": der Auswahlbalken erscheint", r.korb);
    }
    ok(echt(kons).length === 0, "kein Fehler beim zweiten Durchgang", echt(kons)[0] || "still");
    await ctx.close();
  }

  /* ══ 7 · DIE FIGUR DES HAUSES ════════════════════════════════
     Welche es sein soll, steht im MARKENBLATT — nicht hier. Die
     erste Fassung dieser Prüfung erwartete fest die Erdbeere und
     meldete für „blend" einen Fehler, dessen Figur der Untersetzer
     IST. Eine Prüfung, die eine Annahme prüft statt der Vorgabe,
     schlägt Fehlalarm, und Fehlalarme bringen einem bei, sie zu
     übergehen. */
  console.log("\n══ 7 · Die Figur des Hauses ══");
  {
    const blatt = path.join(__dirname, SLUG + ".json");
    const soll = fs.existsSync(blatt)
      ? ((JSON.parse(fs.readFileSync(blatt, "utf8")).avatar || {}).figur || "untersetzer")
      : "untersetzer";
    const { ctx, p } = await neu(b, 390, 844);
    await p.goto(DATEI); await p.waitForTimeout(900);
    const f = await p.evaluate(() => [...document.querySelectorAll("[class*='f-']")]
      .map(el => (String(el.getAttribute("class")||"").match(/f-[a-z]+/g) || []))
      .flat());
    const gefunden = [...new Set(f)];
    ok(gefunden.includes("f-" + soll),
      "die Figur aus dem Markenblatt steht im Hub", "soll f-" + soll + " · da: " +
      (gefunden.join(", ") || "keine"));
    ok(gefunden.length <= 1,
      "und keine zweite daneben", gefunden.length > 1 ? gefunden.join(" UND ") : "nur eine");
    await ctx.close();
  }

  /* ══ 8 · REDUZIERTE BEWEGUNG ═════════════════════════════════ */
  console.log("\n══ 8 · Reduzierte Bewegung ══");
  {
    const { ctx, p } = await neu(b, 390, 844, { reducedMotion:"reduce" });
    await p.goto(DATEI); await p.waitForTimeout(900);
    const l = await p.evaluate(() => [...document.querySelectorAll("*")]
      .filter(el => { const s = getComputedStyle(el);
        return s.animationName !== "none" && s.animationIterationCount === "infinite"; })
      .map(el => el.tagName.toLowerCase()+"."+(String(el.className||"").split(" ")[0])));
    ok(l.length === 0, "nichts laeuft endlos", l.length ? [...new Set(l)].join(", ") : "still");
    await ctx.close();
  }

  await b.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Keine Fehler") +
              (warn ? ", " + warn + " Hinweis(e)" : ""));
  process.exit(fehler ? 1 : 0);
})();
