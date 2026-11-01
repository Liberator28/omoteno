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
const ADMIN_PFAD = process.env.ADMIN_DATEI || path.join(__dirname, "..", "seiten", "admin.html");   /* ADMIN_DATEI: Gegenbeweis auf einer Kopie */
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
    await p.goto("file://" + ADMIN_PFAD);
    await p.waitForTimeout(900);
    /* Diese Prüfung misst die LISTE der Bestellungen (Filterleiste unten). Das Vorführhaus hat einen
       Saalplan und öffnet damit im Saal — der ersetzt die Filter; hier namentlich die Liste wählen. */
    await p.evaluate(() => { try { localStorage.setItem("omoteno-saal-ansicht", "liste"); } catch(e){} });
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
         Zeile mit dem Finger, nicht der Kasten. (Seit 11.10. stehen
         die Karte-Knöpfe oben im Fluss — die Probe bleibt, sie fängt
         jede künftige schwebende Leiste.) */
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
  /* Die feste Leiste unten schwebte mitten im Bild (Foto vom Nutzer, iPhone Home-Bildschirm): iOS ließ den Layout-Viewport kürzer
     als das Sichtbare. Nachgestellt: ein visualViewport, dessen Unterkante 120 px unter dem Layout-Viewport liegt. Die Leiste
     muss an die Unterkante des SICHTBAREN Bereichs zurück, mit ihr Filter und „Mehr“-Fach; ohne Abstand bleibt alles stehen. */
  {
    const ctx = await br.newContext({viewport:{width:390,height:844}});
    const p = await ctx.newPage();
    const kons = [];
    p.on("pageerror", e => kons.push(String(e).slice(0,140)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + ADMIN_PFAD);
    await p.waitForTimeout(900);
    await p.evaluate(() => { document.getElementById("tor").hidden = true; if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); } });
    await p.waitForTimeout(400);
    const sch = await p.$("#scharfJetzt");
    if(sch && await p.isVisible("#scharf")){ await sch.click(); await p.waitForTimeout(300); }
    console.log("\n══ Leiste unten bei kürzerem Layout-Viewport ══");
    const messe = () => p.evaluate(() => ({ unten: Math.round(document.getElementById("befehlsleiste").getBoundingClientRect().bottom), vh: document.documentElement.clientHeight,
      versatz: document.documentElement.style.getPropertyValue("--vv-versatz") }));
    const vorher = await messe();
    ok(vorher.unten === vorher.vh, "Ruhelage: die Leiste sitzt am unteren Rand", vorher.unten + " / " + vorher.vh);
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, height:document.documentElement.clientHeight + 120, addEventListener(){} } }); leisteAnkern(); });
    await p.waitForTimeout(100);
    const kurz = await messe();
    ok(kurz.unten === kurz.vh + 120 && kurz.versatz === "120px", "Sichtbares reicht 120 px weiter: die Leiste rückt um genau 120 px nach unten", kurz.unten + " / " + (kurz.vh + 120));
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, height:document.documentElement.clientHeight + 1, addEventListener(){} } }); leisteAnkern(); });
    const rauschen = await messe();
    ok(rauschen.unten === rauschen.vh, "1 px Abstand (Rundung) bewegt nichts", rauschen.unten + " / " + rauschen.vh);
    /* Foto vom 25.10. (iPhone): die Leiste saß UNTER dem sichtbaren Rand, abgeschnitten. Ohne Eingabefeld und ohne Zoom rückt sie nach OBEN. */
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, height:document.documentElement.clientHeight - 47, addEventListener(){} } }); leisteAnkern(); });
    const abg = await messe();
    ok(abg.unten === abg.vh - 47 && abg.versatz === "-47px", "Leiste unter dem sichtbaren Rand (47 px): sie rückt um genau 47 px nach oben", abg.unten + " / " + (abg.vh - 47));
    /* Gezoomt (Pinch, Meldung 25.10.: „nach dem Reinzoomen nicht mehr unten gefixt“): Die Leiste folgt dem SICHTBAREN Rand, bleibt
       so groß wie sonst (1/Zoom) und rückt um den seitlichen Versatz. Die alte Fassung ließ sie bei scale > 1 stehen — dort
       hing sie mitten im vergrößerten Bild. Rechnung: sichtbar unten = offsetTop + height = 100 + 422 = 522. */
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:100, offsetLeft:40, scale:2, width:195, height:document.documentElement.clientHeight / 2, addEventListener(){} } }); leisteAnkern(); });
    await p.waitForTimeout(100);
    const zoom = await p.evaluate(() => { const b = document.getElementById("befehlsleiste").getBoundingClientRect(), w = document.documentElement.style;
      return { unten: Math.round(b.bottom), links: Math.round(b.left), breit: Math.round(b.width), kehr: w.getPropertyValue("--vv-kehr"), x: w.getPropertyValue("--vv-x"), vh: document.documentElement.clientHeight }; });
    ok(zoom.unten === 522, "gezoomt (scale 2): die Leiste sitzt am sichtbaren unteren Rand (522)", zoom.unten + " / 522");
    ok(zoom.kehr === "0.5000" && zoom.breit === 195, "… und ist so breit wie das Sichtbare (195 px), nicht vergrößert", "kehr " + zoom.kehr + ", Breite " + zoom.breit);
    ok(zoom.links === 40 && zoom.x === "40px", "… und folgt dem seitlichen Versatz (40 px)", zoom.links + " / " + zoom.x);
    const filterZ = await p.evaluate(() => { const f = document.querySelector("#t-bestellungen .filterblock"); if(!f) return null; const r = f.getBoundingClientRect(), b = document.getElementById("befehlsleiste").getBoundingClientRect(); return { luecke: Math.round(b.top - r.bottom), links: Math.round(r.left), breit: Math.round(r.width) }; });
    ok(!filterZ || (Math.abs(filterZ.luecke) <= 1 && filterZ.links === 40 && filterZ.breit === 195), "gezoomt: der Filterblock sitzt unverändert auf der Leiste (keine Lücke, gleiche Breite)", JSON.stringify(filterZ));
    /* Rauszoomen stellt zurück */
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, offsetLeft:0, scale:1, width:390, height:document.documentElement.clientHeight, addEventListener(){} } }); leisteAnkern(); });
    const zurueck = await p.evaluate(() => { const b = document.getElementById("befehlsleiste").getBoundingClientRect(), w = document.documentElement.style;
      return { unten: Math.round(b.bottom), links: Math.round(b.left), breit: Math.round(b.width), kehr: w.getPropertyValue("--vv-kehr"), x: w.getPropertyValue("--vv-x"), v: w.getPropertyValue("--vv-versatz"), vh: document.documentElement.clientHeight }; });
    ok(zurueck.unten === zurueck.vh && zurueck.breit === 390 && zurueck.links === 0 && zurueck.kehr === "1.0000" && zurueck.v === "0px",
      "wieder auf Zoom 1: alles zurück (unten, Breite 390, links 0, kein Versatz)", JSON.stringify(zurueck));
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, height:document.documentElement.clientHeight - 300, addEventListener(){} } }); leisteAnkern(); });
    const kuerz = await messe();
    /* Meldung 31.10. (Foto 1, iPhone): 300 px kürzer ist die TASTATUR — auch ohne Fokus in einem Textfeld (Fokus schon auf einem
       Schalter, Tastatur fährt noch). Bis dahin verlangte diese Probe „die Leiste folgt nach oben“ — sie schrieb den Fehler als Soll fest. */
    ok(kuerz.unten === kuerz.vh && kuerz.versatz === "0px", "Sichtbares 300 px kürzer (Tastatur), ohne Eingabefeld: die Leiste bleibt ganz unten", kuerz.unten + " / " + kuerz.vh + " · " + kuerz.versatz);
    const kuerzSchalter = await p.evaluate(() => { const i = document.createElement("input"); i.type = "checkbox"; document.body.appendChild(i); i.focus(); const v = leisteAnkern(); i.remove(); return v; });
    ok(kuerzSchalter === 0, "dasselbe mit fokussiertem SCHALTER (Tipp nach dem Tippen): kein Versatz", String(kuerzSchalter));
    /* Meldung 31.10. (Foto 2): iOS 26 lässt nach dem Schließen der Tastatur visualViewport.offsetTop > 0 stehen; ohne Zoom ist das
       ein Fehlwert. Die alte Rechnung schob die Leiste damit unter den Rand (Beschriftung abgeschnitten). */
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:58, offsetLeft:0, scale:1, width:390, height:document.documentElement.clientHeight, addEventListener(){} } }); leisteAnkern(); });
    const ios26 = await messe();
    ok(ios26.unten === ios26.vh && ios26.versatz === "0px", "iOS 26: offsetTop 58 ohne Zoom bei gleicher Höhe → Leiste ganz im Bild, kein Versatz", JSON.stringify(ios26));
    /* Tastatur schließt (Höhe wächst um mehr als 120 px): Versatz sofort 0, danach neu gemessen — die Leiste steht ganz unten. */
    const zu = await p.evaluate(async () => {
      const st = { offsetTop:0, offsetLeft:0, scale:1, width:390, height:document.documentElement.clientHeight - 300 };
      const ziel = new EventTarget(); ziel.offsetTop = 0;
      Object.defineProperty(window, "visualViewport", { configurable:true, get(){ return st; } });
      document.documentElement.style.setProperty("--vv-versatz", "-300px");
      leisteSichtHoehe = st.height;
      st.height = document.documentElement.clientHeight;
      const i = document.createElement("input"); document.body.appendChild(i); i.focus(); i.blur(); i.remove();
      const sofort = document.documentElement.style.getPropertyValue("--vv-versatz");
      await new Promise(r => setTimeout(r, 900));
      const b = document.getElementById("befehlsleiste").getBoundingClientRect();
      return { sofort, spaeter: document.documentElement.style.getPropertyValue("--vv-versatz"), unten: Math.round(b.bottom), vh: document.documentElement.clientHeight };
    });
    ok(zu.sofort === "0px" && zu.spaeter === "0px" && zu.unten === zu.vh, "Tastatur zu (Feld verlässt den Fokus): Versatz sofort 0, nach dem Nachmessen ganz unten", JSON.stringify(zu));
    /* iOS hängt nach der Tastatur (Foto 31.10.): innerHeight UND vv 372 px zu kurz, die Sonde bei der kurzen Höhe. */
    const haengt = await p.evaluate(async () => {
      const vh = document.documentElement.clientHeight;
      Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, offsetLeft:0, scale:1, width:390, height:vh, addEventListener(){} } });
      leisteAnkern();
      const kurz = vh - 372, rollt = [], echtScroll = window.scrollBy;
      const dH = Object.getOwnPropertyDescriptor(window, "innerHeight"), dW = Object.getOwnPropertyDescriptor(window, "innerWidth");
      window.scrollBy = (x, y) => { rollt.push(y); };
      Object.defineProperty(window, "innerHeight", { configurable:true, get: () => kurz });
      Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, offsetLeft:0, scale:1, width:390, height:kurz, addEventListener(){} } });
      const sonde = leisteSonde(), echtRect = sonde.getBoundingClientRect.bind(sonde);
      sonde.getBoundingClientRect = () => ({ top:kurz, bottom:kurz, left:0, right:1, width:1, height:0 });
      const v = leisteAnkern();
      const i = document.createElement("input"); document.body.appendChild(i); i.focus(); const mitFeld = leisteAnkern(); i.blur(); i.remove();
      Object.defineProperty(window, "innerWidth", { configurable:true, get: () => 844 }); const quer = leisteAnkern();
      Object.defineProperty(window, "innerHeight", dH); Object.defineProperty(window, "innerWidth", dW); window.scrollBy = echtScroll; sonde.getBoundingClientRect = echtRect;
      Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, offsetLeft:0, scale:1, width:390, height:vh, addEventListener(){} } }); leisteAnkern();
      return { v, rollt: rollt.length, mitFeld, quer };
    });
    ok(haengt.v === 372 && haengt.rollt >= 1, "iOS hängt (372 px zu kurz, kein Feld): Anstoß, dann rückt die Leiste genau 372 px nach unten", JSON.stringify(haengt));
    ok(haengt.mitFeld === 0 && haengt.quer === 0, "Gegenfälle: Textfeld im Fokus und Gerät quer → kein Versatz", JSON.stringify(haengt));
    const mess = await p.evaluate(() => !!document.getElementById("leisteMess"));
    ok(!mess, "ohne ?leiste=mess keine Messanzeige im Dokument", String(mess));
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, scale:1, height:document.documentElement.clientHeight - 47, addEventListener(){} } }); leisteAnkern(); });
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:-60, scale:1, height:document.documentElement.clientHeight + 120, addEventListener(){} } }); leisteAnkern(); });
    const gummi = await messe();
    ok(gummi.versatz === "-47px", "Gummiband oben (offsetTop −60): der letzte Stand bleibt, nichts zuckt", gummi.versatz);
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, height:document.documentElement.clientHeight, addEventListener(){} } }); leisteAnkern(); });
    await p.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, height:document.documentElement.clientHeight + 120, addEventListener(){} } }); leisteAnkern(); });
    const ink = await p.evaluate(() => { const i = document.createElement("input"); i.id = "ankerProbe"; document.body.appendChild(i); i.focus(); return leisteAnkern(); });
    ok(ink === 0, "mit fokussiertem Eingabefeld wird nicht verschoben (Tastatur)", String(ink));
    /* Ein Schalter im Fokus ist keine Tastatur: Die Verankerung bleibt an (die erste Fassung nahm jedes INPUT aus). */
    await p.evaluate(() => { document.getElementById("ankerProbe").remove(); Object.defineProperty(window, "visualViewport", { configurable:true, value:{ offsetTop:0, height:document.documentElement.clientHeight + 120, addEventListener(){} } }); });
    const chk = await p.evaluate(() => { const i = document.createElement("input"); i.type = "checkbox"; i.id = "ankerSchalter"; document.body.appendChild(i); i.focus(); const v = leisteAnkern(); i.remove(); return v; });
    ok(chk === 120, "ein fokussierter SCHALTER (Checkbox) hält die Verankerung nicht an", String(chk));
    const txt = await p.evaluate(() => { const i = document.createElement("input"); i.type = "email"; i.id = "ankerMail"; document.body.appendChild(i); i.focus(); const v = leisteAnkern(); i.remove(); return v; });
    ok(txt === 0, "ein fokussiertes Textfeld (E-Mail) schon (Tastatur)", String(txt));
    ok(kons.length === 0, "keine Ausnahme", kons[0] || "still");
    await ctx.close();
  }
  /* Die Verdrahtung selbst (zweite Quelle statt Aufruf von Hand): echte Ereignisse am echten visualViewport, und das Nachlaufen
     nach dem Auslaufen (iOS meldet das Einrasten nicht). Vorher hatten alle Prüfungen addEventListener(){} und riefen
     leisteAnkern() direkt — ob die Ereignisse überhaupt rechneten, sah keine. */
  {
    const ctx = await br.newContext({viewport:{width:390,height:844}});
    const p = await ctx.newPage();
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + ADMIN_PFAD);
    await p.waitForTimeout(900);
    await p.evaluate(() => { document.getElementById("tor").hidden = true; if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); } });
    await p.waitForTimeout(400);
    const sch = await p.$("#scharfJetzt");
    if(sch && await p.isVisible("#scharf")){ await sch.click(); await p.waitForTimeout(300); }
    console.log("\n══ Leiste: Ereignisse und Nachlaufen ══");
    await p.evaluate(() => {
      window.__echt = window.visualViewport;
      const st = { offsetTop:0, offsetLeft:0, scale:1, width:390, height:document.documentElement.clientHeight + 90 };
      window.__vvStand = st;
      Object.defineProperty(window, "visualViewport", { configurable:true, get(){ return window.__vvStand; } });
    });
    const v = () => p.evaluate(() => document.documentElement.style.getPropertyValue("--vv-versatz"));
    await p.evaluate(() => window.__echt.dispatchEvent(new Event("resize")));
    await p.waitForTimeout(120);
    ok(await v() === "90px", "ein echtes „resize“ am visualViewport rechnet neu", await v());
    await p.evaluate(() => { window.__vvStand.height = document.documentElement.clientHeight + 30; window.__echt.dispatchEvent(new Event("scroll")); });
    await p.waitForTimeout(120);
    ok(await v() === "30px", "ein echtes „scroll“ am visualViewport rechnet neu", await v());
    /* Nachlaufen: nach dem letzten Ereignis ändert sich der Stand ohne weiteres Ereignis (Einrasten nach dem Pinch). */
    await p.evaluate(() => { window.__echt.dispatchEvent(new Event("resize")); });
    await p.waitForTimeout(70);   /* der Bildlauf-Takt hat gerechnet (30 px), danach rastet der Stand ein — OHNE Ereignis */
    await p.evaluate(() => { window.__vvStand.height = document.documentElement.clientHeight + 55; });
    await p.waitForTimeout(40);
    const sofort = await v();
    ok(sofort === "30px", "Voraussetzung: bis hierher hat nichts nachgerechnet (Stand noch 30 px)", sofort);
    await p.waitForTimeout(700);
    ok(await v() === "55px", "ohne weiteres Ereignis holt das Nachlaufen den Endstand (55 px)", "gleich " + sofort + ", nach 0,8 s " + await v());
    await p.evaluate(() => { window.__vvStand.height = document.documentElement.clientHeight; window.dispatchEvent(new Event("gestureend")); });
    await p.waitForTimeout(120);
    ok(await v() === "0px", "„gestureend“ (Safari: Pinch zu Ende) rechnet neu", await v());
    await ctx.close();
  }
  /* Messanzeige (?leiste=mess): die Zahlen für ein Foto vom Gerät. Nur Text, fängt keinen Tipp, ohne Parameter gar nicht da (oben). */
  {
    const ctx = await br.newContext({viewport:{width:390,height:844}});
    const p = await ctx.newPage();
    const kons = [];
    p.on("pageerror", e => kons.push(String(e).slice(0,140)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + ADMIN_PFAD + "?leiste=mess");
    await p.waitForTimeout(900);
    console.log("\n══ Messanzeige ?leiste=mess ══");
    const m = await p.evaluate(() => { leisteAnkern(); const e = document.getElementById("leisteMess");
      return e ? { text: e.textContent, pe: getComputedStyle(e).pointerEvents, kinder: e.children.length } : null; });
    ok(!!m && /vv\.top/.test(m.text) && /versatz 0/.test(m.text) && /sonde 844/.test(m.text) && m.pe === "none" && m.kinder === 0,
      "mit ?leiste=mess: Zahlen als reiner Text, fängt keinen Tipp", JSON.stringify(m));
    ok(kons.length === 0, "keine Skriptfehler", kons.join(" | "));
    await ctx.close();
  }
  await br.close();
  console.log(fehler ? "\n✗ " + fehler + " Fehler." : "\n✓ Die Leisten sitzen.");
  process.exit(fehler ? 1 : 0);
})();
