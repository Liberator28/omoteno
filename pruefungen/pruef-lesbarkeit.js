/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Lesbarkeit, hell wie dunkel

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-lesbarkeit.js

   Sie geht über JEDES Element mit Text, mischt die durchscheinenden
   Flächen darunter zusammen und rechnet den Kontrast. Nicht ein paar
   ausgewählte Paare — alles, was auf dem Schirm steht.

   Warum so grob: Eine Palette umzustellen heißt nicht, zwei Farben zu
   tauschen. Es heißt, dass irgendwo eine Zeile steht, an die niemand
   gedacht hat — ein Platzhalter, ein Hinweis, eine Zahl in einer
   Bedeutungsfarbe. Die findet man nur, indem man alles nachrechnet.

   Grenze 4,5:1; ab 24px und fett genügen 3:1 (WCAG). Reine
   Zierschrift unter 10px und Elemente ohne sichtbaren Text werden
   übersprungen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

/* dist/ liegt in der Wurzel, die Seiten in seiten/ - beides eine
   Ebene hoeher als dieses Skript. */
const HIER   = path.resolve(__dirname, "..");
const SEITEN = path.join(HIER, "seiten");
const BID  = "af095b14-d9ef-41f4-9b97-c4422b0de63f";

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

const SWEEP = `
(() => {
  /* Chromium gibt eine aus color-mix() berechnete Farbe nicht als
     rgb()/rgba() zurueck, sondern als "color(srgb r g b)" mit Werten
     0..1 statt 0..255. Ohne diesen Zweig liest die einfache Ziffern-
     Regex darunter 0.94 als "94" auf 255-Skala und rechnet eine fast
     schwarze Flaeche — Vorfall vom 24.09., dieselbe Falle, die
     pruefungen/pruef-annahme.js' parseRgb() bereits kennt. */
  const zahl = t => {
    const s = String(t);
    const srgb = s.match(/color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)/);
    if(srgb){
      const werte = [+srgb[1]*255, +srgb[2]*255, +srgb[3]*255];
      if(srgb[4] !== undefined) werte.push(+srgb[4]);
      return werte;
    }
    return (s.match(/[\\d.]+/g) || []).map(Number);
  };
  const kanal = c => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
  const leucht = p => .2126*kanal(p[0]) + .7152*kanal(p[1]) + .0722*kanal(p[2]);
  const mischen = (oben, unten) => {
    const a = oben.length > 3 ? oben[3] : 1;
    return [0,1,2].map(i => Math.round(oben[i]*a + unten[i]*(1-a)));
  };
  /* Ein Verlauf steht in backgroundImage, nicht in backgroundColor —
     dort liest man rgba(0,0,0,0) und steigt am Element vorbei.

     VORFALL beim Master Board: Der Anmeldeknopf traegt
     background:linear-gradient(#F5B87C,#E4913F) mit dunkler Schrift.
     Gegen den Verlauf gerechnet sind das 7,06:1 im schlechtesten
     Fall; wer daran vorbeisteigt, rechnet gegen die dunkle Seite
     dahinter und meldet 1,07:1 — Fehlalarm. Und ein Werkzeug, das
     Fehlalarme schlaegt, bringt einem bei, es zu uebergehen (§8.2).

     Genommen wird die UNGUENSTIGSTE Kante des Verlaufs: Text muss
     ueber der ganzen Flaeche lesbar sein, nicht nur oben. */
  function verlaufStopps(st){
    /* color(srgb …) auch: color-mix() in einem Verlauf kommt so heraus.
       (Doppelter Rückstrich: Das hier steht in einer Vorlagenzeichenkette,
       ein einfacher fiele dort weg und die Klammer wäre keine mehr.)
       Vorher stieg die Prüfung an einem solchen Verlauf (Foodroulette-
       Rad) vorbei und rechnete gegen einen fremden Grund (1,11:1). */
    const t = String(st.backgroundImage || "").match(/rgba?\([^)]*\)|color\\(srgb [^)]*\\)/g);
    if(!t || !t.length) return null;
    return t.map(zahl).filter(v => v.length >= 3 && (v.length < 4 || v[3] > 0));
  }
  /* Ein gleitender Schieber (.segmentschieber im Board) ist kein
     Elternteil, sondern ein GESCHWISTER unter der Schrift: absolut
     gesetzt, eigene deckende Fläche, niedrigere Ebene. Wer nur die
     Eltern hinaufsteigt, rechnet dunkle Schrift gegen den dunklen
     Grund daneben — so meldete diese Prüfung „Prozent“ mit 1,07:1.

     Die Hälfte davon war echt: Der Schieber war fest ⅓ breit, die
     Rabatt-Segmente haben zwei Knöpfe, und „Ganze Rechnung“ stand zu
     einem Viertel neben ihm (gemessen: Text 61–172 px, Schieber
     39–143 px). Deshalb zählt ein Geschwister NUR, wenn es die ganze
     Textfläche deckt — ein zu schmaler Schieber bleibt rot. */
  function unterlage(el){
    const par = el.parentElement;
    if(!par) return null;
    const rg = document.createRange(); rg.selectNodeContents(el);
    const t = rg.getBoundingClientRect();
    if(t.width < 1) return null;
    const ebene = parseInt(getComputedStyle(el).zIndex, 10) || 0;
    for(const g of par.children){
      if(g === el || g.contains(el)) continue;
      const st = getComputedStyle(g);
      if(st.position !== "absolute" || st.display === "none" || st.visibility === "hidden") continue;
      if((parseInt(st.zIndex, 10) || 0) >= ebene) continue;
      const b = zahl(st.backgroundColor);
      if(!(b.length === 3 || (b.length === 4 && b[3] === 1))) continue;
      const r = g.getBoundingClientRect();
      if(r.left <= t.left + .5 && r.right >= t.right - .5 &&
         r.top <= t.top + .5 && r.bottom >= t.bottom - .5) return b;
    }
    return null;
  }
  function grundStapel(el){
    const u = unterlage(el);
    if(u) return [[u]];
    const stapel = []; let k = el;
    while(k){
      const st = getComputedStyle(k);
      const b = zahl(st.backgroundColor);
      if(b.length >= 3 && (b.length < 4 || b[3] > 0)) stapel.push([b]);
      if(b.length === 3 || (b.length === 4 && b[3] === 1)) break;
      const gr = verlaufStopps(st);
      if(gr && gr.length){
        stapel.push(gr);
        /* Ein Verlauf mit lauter deckenden Stopps deckt ab. */
        if(gr.every(v => v.length === 3 || v[3] === 1)) break;
      }
      k = k.parentElement;
    }
    return stapel;
  }
  /* Liefert je Verlaufskante einen fertig gemischten Grund. */
  function gruendeVon(el){
    const stapel = grundStapel(el);
    if(!stapel.length) return [[255,255,255]];
    const kanten = Math.max.apply(null, stapel.map(l => l.length));
    const raus = [];
    for(let i = 0; i < kanten; i++){
      const spur = stapel.map(l => l[Math.min(i, l.length - 1)]);
      let unten = spur.pop();
      while(spur.length) unten = mischen(spur.pop(), unten);
      raus.push(unten);
    }
    return raus;
  }
  /* Nur Elemente, die SELBST Text zeigen — sonst zählt jeder
     Container den Text seiner Kinder noch einmal mit. */
  const eigenerText = el => Array.prototype.some.call(el.childNodes,
    n => n.nodeType === 3 && n.textContent.trim().length > 0);

  const raus = [];
  document.querySelectorAll("body *").forEach(el => {
    if(!eigenerText(el)) return;
    /* Text INNERHALB einer Zeichnung hat keinen CSS-Hintergrund,
       sondern liegt auf gezeichneten Flächen. Diese Rechnung käme
       dort immer auf 1:1 und wäre nur Rauschen — die Figur und das
       Siegel prüft pruef-figur.js an ihren echten Flächen. */
    if(el.closest("svg")) return;
    const s = getComputedStyle(el);
    if(s.visibility === "hidden" || s.display === "none") return;
    if(parseFloat(s.opacity) < .15) return;
    const kasten = el.getBoundingClientRect();
    if(kasten.width < 2 || kasten.height < 2) return;
    const groesse = parseFloat(s.fontSize);
    /* Unter 10px gilt als Zierschrift und wird uebersprungen — bei
       einer Gutschrift im Fuss stimmt das.

       Bei etwas, das man ANTIPPEN soll, stimmt es nicht. Vorfall vom
       05.09.: Der Link „Fuer den Betrieb" stand auf 9,5px und kam auf
       2,83:1. Diese Pruefung meldete trotzdem „alles sauber", weil sie
       ihn wegen der Groesse gar nicht ansah. Ein Bedienelement ist nie
       Zier — es wird immer gerechnet, egal wie klein es gesetzt ist. */
    const bedienbar = el.closest("a,button,[role=button],[role=link]") !== null;
    if(groesse < 10 && !bedienbar) return;
    const dick = parseInt(s.fontWeight, 10) >= 700;
    const grenze = (groesse >= 24 || (groesse >= 18.66 && dick)) ? 3 : 4.5;

    const gruende = gruendeVon(el);
    let wert = Infinity;
    gruende.forEach(grund => {
      const vorne = mischen(zahl(s.color), grund);
      const a = leucht(vorne), b = leucht(grund);
      const k = Math.round(((Math.max(a,b)+.05)/(Math.min(a,b)+.05))*100)/100;
      if(k < wert) wert = k;
    });
    if(wert < grenze){
      raus.push({
        wert, grenze,
        wo: el.tagName.toLowerCase() +
            (el.id ? "#" + el.id : "") +
            (el.className && typeof el.className === "string"
              ? "." + el.className.trim().split(/\\s+/).slice(0,2).join(".") : ""),
        text: (el.textContent || "").trim().slice(0, 46)
      });
    }
  });
  return raus.sort((a,b) => a.wert - b.wert);
})()
`;

async function fuellen(seite){
  await seite.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await seite.route("**/rest/v1/betriebe**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"",
                              hub_texte:{} }]) }));
  await seite.addInitScript(() => {
    try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){}
  });
}

/* Jede Fläche mit den Zuständen, in denen sie geprüft wird. */
const FLAECHEN = [
  { datei:"admin.html", name:"Admin-Board",
    lagen:[["dunkel", p => p.evaluate(() => { EINST.licht="dunkel"; lichtAnwenden(); })],
           ["hell",   p => p.evaluate(() => { EINST.licht="hell";   lichtAnwenden(); })]],
    /* Das Board zeigt ohne Anmeldung nur das Tor. Der Vorführmodus
       füllt es mit Beispieldaten — genau dafür ist er da. */
    vorher: async p => {
      await p.evaluate(() => { if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); } });
      await p.waitForTimeout(300);
    },
    seiten:["bestellungen","speisekarte","auswertung","einstellungen","startseite"],
    blaettern: (p, ziel) => p.evaluate(z => { const [t, eu] = z.split("/"); tafelZeigen(t); if(eu) euOeffnen(eu); }, ziel) },

  { datei:"kueche.html", name:"Küchendisplay",
    lagen:[["dunkel", p => p.evaluate(() => { EINST.hell=false; document.body.classList.remove("hell"); })],
           ["hell",   p => p.evaluate(() => { EINST.hell=true;  document.body.classList.add("hell"); })]] },

  /* Das Master Board. Eine Lage, nicht zwei: Es malt fest dunkel
     (--bg-0 #14100E) und sagt das auch an. Ein zweiter Zustand waere
     erfunden.

     Gemessen wird die ANGEMELDETE Ansicht, nicht der Anmeldeschirm.
     Wer nur das Tor prueft, prueft vier Beschriftungen und meldet
     "alles sauber" fuer ein Brett mit Kacheln, Tabellen und
     Verlauf — gruen, weil der Gegenstand fehlt (§8.1g). */
  { datei:"master.html", name:"Master Board",
    /* ZWEI Lagen, und die erste ist der Anmeldeschirm.

       VORFALL, gefunden durch den eigenen Gegenbeweis: Mit nur der
       angemeldeten Ansicht blieb die Probe gruen, als ich die
       Knopfschrift des Anmeldeknopfs testweise auf die dunkle
       Verlaufsfarbe setzte — der Schirm traegt dort .hidden, also
       display:none, also sieht ihn der Durchgang gar nicht. Gruen,
       weil der Gegenstand fehlt (§8.1g), und das beim ERSTEN, was
       jeder zu sehen bekommt. */
    lagen:[
      ["Anmeldeschirm", async p => { await p.evaluate(() => {
          const tor = document.getElementById("loginScreen");
          const app = document.getElementById("app");
          if(tor) tor.classList.remove("hidden");
          if(app) app.classList.add("hidden");
        }); }],
      ["angemeldet", async p => { await p.evaluate(() => {
          const tor = document.getElementById("loginScreen");
          const app = document.getElementById("app");
          if(tor) tor.classList.add("hidden");
          if(app) app.classList.remove("hidden");
        }); }]
    ],
    /* Das SDK kommt von einem fremden Server und ist hier
       blockiert. Gestellt wird nur, was das Brett zum Zeichnen
       braucht — leere Listen, keine erfundenen Daten. */
    davor: p => p.addInitScript(() => {
      const leer = { data:[], error:null };
      const kette = {
        select(){ return this; }, order(){ return this; },
        gte(){ return this; }, eq(){ return this; }, limit(){ return this; },
        then(f){ return Promise.resolve(f(leer)); },
        catch(){ return Promise.resolve(leer); }
      };
      window.supabase = { createClient: () => ({
        auth: {
          getSession: () => Promise.resolve({ data:{ session:{
            user:{ id:"m1", email:"pruefung@omoteno.de" } } } }),
          signInWithPassword: () => Promise.resolve({ data:{}, error:null }),
          onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
          signOut: () => Promise.resolve({})
        },
        from: () => Object.create(kette),
        rpc: () => Promise.resolve(leer),
        storage: { from: () => ({ createSignedUrl: () => Promise.resolve(leer) }) }
      }) };
    }),
    /* Nach dem Umschalten wird gemessen, dass ueberhaupt etwas
       dasteht. Sonst meldet die Probe "nichts gefunden", und das
       klingt wie "alles sauber". */
    nachher: async (p, lage) => {
      const hoch = await p.evaluate(() => {
        const el = document.querySelector("#loginScreen:not(.hidden), #app:not(.hidden)");
        return el ? Math.round(el.getBoundingClientRect().height) : 0;
      });
      if(hoch < 200) throw new Error("Master Board · " + lage +
        ": nichts sichtbar (" + hoch + " px) — die Werte danach sagen nichts aus.");
    } },

  { hub:true, name:"Gäste-Hub",
    lagen:[["dunkel", p => p.evaluate(() => { lichtSetzen("dunkel"); })],
           ["hell",   p => p.evaluate(() => { lichtSetzen("hell");   })]],
    seiten:["", "speisekarte", "entdecken", "meintisch", "kontakt", "service"],
    blaettern: (p, ziel) => p.evaluate(z => { location.hash = "#/" + z; }, ziel) }
];

/* Die Helligkeitsleiter aus dem Board (hub_stil.farben, Wunsch 11.10.)
   in JEDEM Haus: farbLesbar prüft nur die Kernpaare — Hausfarben im
   Blatt (Guss, Wolken, Bedeutungsfarben) sieht erst diese Messung.
   Die Stufe wird über farbenAnwenden gesetzt wie aus der Spalte, die
   Voraussetzung (Grund wirklich der der Stufe) selbst geprüft. */
const STUFEN = ["weiss", "creme", "warm", "gedaempft", "dunkel", "schwarz"];
{
  const o = path.join(HIER, "dist");
  const slugs = fs.existsSync(o) ? fs.readdirSync(o).filter(x => fs.existsSync(path.join(o, x, "index.html"))) : [];
  for(const slug of slugs) FLAECHEN.push({ hub:true, slug, name:"Gäste-Hub " + slug + " · Stufe",
    lagen: STUFEN.map(st => [st, p => p.evaluate(st => {
      const sechs = q => Object.fromEntries(FARB_ROLLEN.map(r => [r, q[r]]));
      const m = farbMarke();
      const tag = farbStufeAuf(sechs(m.farben), st);
      const abend = Object.assign(farbStufeAuf(sechs(Object.assign({}, m.farben, m.abend)), st), { an:true });
      farbenAnwenden({ tag, abend });
      lichtSetzen(FARB_STUFEN.find(x => x.s === st).dunkel ? "dunkel" : "hell");
    }, st)]),
    nachher: async (p, st) => {
      const r = await p.evaluate(st => ({ ist:document.documentElement.style.getPropertyValue("--grund").trim().toUpperCase(),
        /* Dunkle Stufen laufen in der Abendfassung — deren Band gibt den Ton. */
        soll:(() => { const m = farbMarke(), dunkel = FARB_STUFEN.find(x => x.s === st).dunkel;
          const band = dunkel ? Object.assign({}, m.farben, m.abend).band : m.farben.band;
          const z = farbStufe(st, band); return z ? z.grund : "?"; })() }), st);
      if(r.ist !== r.soll) throw new Error(slug + " · " + st + ": Stufe nicht angekommen (" + r.ist + " statt " + r.soll + ")");
    },
    seiten:["", "speisekarte", "entdecken", "meintisch", "kontakt", "service"],
    blaettern: (p, ziel) => p.evaluate(z => { location.hash = "#/" + z; }, ziel) });
}

(async () => {
  const browser = await chromium.launch();

  for(const f of FLAECHEN){
    let ziel;
    if(f.hub){
      const o = path.join(HIER, "dist");
      const slug = f.slug || (fs.existsSync(o)
        ? fs.readdirSync(o).find(x => fs.existsSync(path.join(o, x, "index.html"))) : null);
      if(!slug){ console.log("\n" + f.name + ": kein erzeugter Hub, übersprungen"); continue; }
      ziel = "file://" + path.join(o, slug, "index.html");
    } else {
      if(!fs.existsSync(path.join(SEITEN, f.datei))){
        console.log("\n" + f.name + ": Datei fehlt, übersprungen"); continue;
      }
      ziel = "file://" + path.join(SEITEN, f.datei);
    }

    for(const [lage, stellen] of f.lagen){
      const ctx = await browser.newContext({ viewport:{width:390,height:844} });
      const seite = await ctx.newPage();
      await fuellen(seite);
      /* Manche Flaechen brauchen etwas, das VOR dem Laden da sein
         muss (ein gestelltes SDK). vorher kommt zu spaet dafuer. */
      if(f.davor) await f.davor(seite);
      await seite.goto(ziel);
      await seite.waitForTimeout(700);
      if(f.vorher) await f.vorher(seite);
      try{ await stellen(seite); }catch(e){}
      await seite.waitForTimeout(400);
      /* Eine Probe, deren Voraussetzung fehlschlagen kann, muss die
         Voraussetzung selbst pruefen (§8.1g, Vorfall C). */
      if(f.nachher){
        try{ await f.nachher(seite, lage); }
        catch(e){ pruef(false, "Voraussetzung", String(e.message || e)); await ctx.close(); continue; }
      }

      /* Seit 18.10. liegen die Einstellungen in Unterseiten hinter
         Kacheln: jede einzeln, ihre ids aus dem gezeichneten Board. */
      let wege = f.seiten || [null];
      if(wege.includes("einstellungen")){
        const ids = await seite.evaluate(() => [...document.querySelectorAll("#t-einstellungen [data-eu-seite]")].map(k => k.dataset.euSeite)).catch(() => []);
        pruef(ids.length >= 10, f.name + " " + lage + ": Voraussetzung: Unterseiten der Einstellungen gefunden", ids.length);
        wege = wege.flatMap(w => w === "einstellungen" ? [w, ...ids.map(i => "einstellungen/" + i)] : [w]);
      }
      const gesammelt = new Map();
      for(const w of wege){
        if(w !== null && f.blaettern){
          try{ await f.blaettern(seite, w); }catch(e){}
          await seite.waitForTimeout(350);
        }
        for(const t of await seite.evaluate(SWEEP)){
          const k = t.wo + "|" + t.text;
          if(!gesammelt.has(k) || gesammelt.get(k).wert > t.wert) gesammelt.set(k, t);
        }
      }
      const liste = [...gesammelt.values()].sort((a,b) => a.wert - b.wert);
      console.log("\n── " + f.name + " · " + lage + " ──");
      pruef(liste.length === 0, "alles über der Grenze",
        liste.length ? liste.length + " Stelle(n)" : "geprüft");
      liste.slice(0, 12).forEach(t => console.log("         " +
        t.wert.toFixed(2) + ":1 (mind. " + t.grenze + ")  " +
        t.wo.padEnd(30) + "  " + JSON.stringify(t.text)));
      await ctx.close();
    }
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fläche(n) mit Fundstellen" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
