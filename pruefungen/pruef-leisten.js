/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Wo die Leisten im Board wirklich sitzen

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-leisten.js

   Auf dem Telefon liegen ZWEI Leisten fest am unteren Rand: die
   Reiterleiste und darüber die Filter. Beides ist Geometrie, und
   Geometrie sieht man einer Datei nicht an.

   Gemessen wird, was ein Finger trifft, nicht was ein Kasten sagt:

   1 · Sitzen die Filter FEST und über der Reiterleiste — nicht
       darunter, wo sie unerreichbar wären?
   2 · Klebt die Reiterleiste an der Unterkante des Fensters?
   3 · Und der Punkt, der beim Bauen fast schiefging: Ist die LETZTE
       Bestellkarte nach dem Scrollen noch frei, oder liegt sie unter
       der Glasfläche? Mein erster Anlauf maß sie dort, wo sie gerade
       zufällig lag — weit unter dem Fenster — und sagte damit nichts
       über Erreichbarkeit. Erst nach dem Scrollen ans Ende ist die
       Frage überhaupt gestellt.
   4 · Am Tresen muss all das NICHT gelten: Dort stehen die Filter
       im Fluss und es gibt keine Reiterleiste. Ein Kreuzvergleich,
       damit die Regel nicht überall gilt, wo sie nicht hingehört.

   Die Antippprobe nimmt elementFromPoint. Ein Kasten kann
   rechnerisch passen und trotzdem verdeckt sein — der Gegenbeweis
   zu Punkt 3 meldete genau das: "chip" statt "die Karte".
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
let fehler = 0;
const ok = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };
(async () => {
  const br = await chromium.launch();
  for(const m of [{n:"Telefon",w:390,h:844},{n:"Tresen",w:1280,h:900}]){
    const ctx = await br.newContext({viewport:{width:m.w,height:m.h}});
    const p = await ctx.newPage();
    const kons = [];
    p.on("pageerror", e => kons.push(String(e).slice(0,140)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + path.join(__dirname, "..", "seiten", "admin.html"));
    await p.waitForTimeout(900);
    await p.evaluate(() => { document.getElementById("tor").hidden = true;
      if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); } });
    await p.waitForTimeout(500);
    const sch = await p.$("#scharfJetzt");
    if(sch && await p.isVisible("#scharf")){ await sch.click(); await p.waitForTimeout(300); }
    await p.evaluate(() => tafelZeigen("bestellungen"));
    await p.waitForTimeout(400);

    console.log("\n══ " + m.n + " " + m.w + "×" + m.h + " ══");
    /* GANZ NACH UNTEN scrollen. Ohne das misst man, wo die letzte
       Karte gerade zufaellig liegt — meist weit unter dem Fenster —
       und nicht, ob man an sie HERANKOMMT. Genau dafuer ist das
       padding-bottom da, und genau das soll gemessen werden. */
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(400);
    const g = await p.evaluate(() => {
      const q = s => document.querySelector(s);
      const kasten = el => { if(!el) return null; const r = el.getBoundingClientRect();
        return { top:Math.round(r.top), bottom:Math.round(r.bottom),
                 hoch:Math.round(r.height), pos:getComputedStyle(el).position }; };
      const letzte = [...document.querySelectorAll(".bestellung")].pop();
      return { filter: kasten(q("#t-bestellungen .filterblock")),
               leiste: kasten(q(".befehlsleiste")),
               letzteKarte: kasten(letzte),
               fenster: window.innerHeight,
               /* Was liegt WIRKLICH an der Stelle des ersten Chips? */
               letzteTrifft: (() => {
                 const k = [...document.querySelectorAll(".bestellung")].pop();
                 if(!k) return "keine Karte";
                 const r = k.getBoundingClientRect();
                 const y = Math.min(r.bottom - 6, window.innerHeight - 2);
                 const el = document.elementFromPoint(r.left + r.width/2, y);
                 return el ? (el === k || k.contains(el) ? "die Karte" :
                   (el.id || el.className || el.tagName)) : "nichts";
               })(),
               obenauf: (() => { const c = q("#quellenFilter .chip");
                 if(!c) return "kein Chip";
                 const r = c.getBoundingClientRect();
                 const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
                 return el ? (el === c || c.contains(el) ? "der Chip" :
                   (el.id || el.className || el.tagName)) : "nichts"; })() };
    });
    console.log("     Fenster " + g.fenster + " px");
    if(g.filter) console.log("     Filter:  " + JSON.stringify(g.filter));
    if(g.leiste) console.log("     Leiste:  " + JSON.stringify(g.leiste));

    if(m.w <= 760){
      ok(g.filter && g.filter.pos === "fixed", "die Filter sind unten festgesetzt",
         g.filter ? g.filter.pos : "fehlt");
      ok(g.filter && g.leiste && g.filter.bottom <= g.leiste.top + 1,
         "sie liegen ÜBER der Reiterleiste, nicht darunter",
         g.filter && g.leiste ? "Filter endet " + g.filter.bottom + ", Leiste beginnt " + g.leiste.top : "—");
      ok(g.leiste && Math.abs(g.leiste.bottom - g.fenster) <= 1,
         "die Reiterleiste klebt an der Unterkante",
         g.leiste ? g.leiste.bottom + " von " + g.fenster : "—");
      ok(g.obenauf === "der Chip", "und ein Finger trifft wirklich den Chip", g.obenauf);
      ok(!g.letzteKarte || g.letzteKarte.bottom <= g.filter.top + 1,
         "ganz unten gescrollt ist die letzte Karte noch frei",
         g.letzteKarte ? "Karte endet " + g.letzteKarte.bottom + ", Filter beginnt " + g.filter.top : "keine Karte");
      /* Und der Gegenstand selbst: Trifft ein Finger die letzte Karte
         oder die Glasflaeche darueber? Der Kasten kann rechnerisch
         passen und trotzdem verdeckt sein. */
      ok(g.letzteTrifft === "die Karte",
         "und ein Finger trifft sie auch", g.letzteTrifft);
      /* „Mehr“ auf jedem Reiter, der eine schwebende Leiste hat.
         VORFALL 26.09. (Bildschirmfoto): Auf dem Karte-Reiter lagen
         „Gericht hinzufügen“ und „Karte einlesen“ (.kartenknoepfe,
         z-index 39) über dem Menü (.mehrfach, ebenfalls 39) — bei
         Gleichstand gewinnt das spätere Element. Gemessen wird jede
         Zeile mit dem Finger, nicht der Kasten. */
      for(const tafel of ["speisekarte", "bestellungen", "reservierungen"]){
        await p.evaluate(t => { window.scrollTo(0, 0); tafelZeigen(t); }, tafel);
        await p.waitForTimeout(300);
        await p.click("#mehrKnopf");
        await p.waitForTimeout(450);
        const mehr = await p.evaluate(() => {
          const f = document.getElementById("mehrfach");
          if(!f || f.hidden) return { offen:false, zeilen:[] };
          return { offen:true, zeilen:[...f.querySelectorAll("button")].map(b => {
            const r = b.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { text:b.textContent.trim(), frei: !!el && (el === b || b.contains(el)),
                     trifft: el ? (el.id || el.className || el.tagName) : "nichts" };
          }) };
        });
        ok(mehr.offen && mehr.zeilen.length >= 3, tafel + ": „Mehr“ öffnet sich", mehr.zeilen.length + " Zeilen");
        const verdeckt = mehr.zeilen.filter(z => !z.frei);
        ok(mehr.offen && !verdeckt.length, tafel + ": jede Zeile in „Mehr“ ist mit dem Finger erreichbar",
           verdeckt.map(z => z.text + " unter " + z.trifft).join(" | ") || "alle frei");
        await p.keyboard.press("Escape");
        await p.evaluate(() => { const f = document.getElementById("mehrfach");
          if(f && !f.hidden) document.getElementById("mehrKnopf").click(); });
        await p.waitForTimeout(200);
      }
    } else {
      ok(g.filter && g.filter.pos === "static", "am Tresen bleiben die Filter oben stehen",
         g.filter ? g.filter.pos : "fehlt");
      ok(!g.leiste || g.leiste.hoch === 0, "und es gibt keine Reiterleiste unten");
    }
    ok(kons.length === 0, "keine Ausnahme", kons[0] || "still");
    await ctx.close();
  }
  await br.close();
  console.log(fehler ? "\n✗ " + fehler + " Fehler." : "\n✓ Die Leisten sitzen.");
  process.exit(fehler ? 1 : 0);
})();
