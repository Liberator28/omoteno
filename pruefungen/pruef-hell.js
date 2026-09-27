/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Helle Fassung von Board und Küche: keine schwarzen Balken

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-hell.js

   Wunsch des Betreibers (26.09.): „Mach die schwarzen Balken in der
   hellen Version zur Eingabe in helleren Hintergrund und dunkle
   Schrift.“ Gemessen, nicht angesehen: Schwarz waren die GEWÄHLTEN
   Zustände, die background:var(--kreide) trugen — im Hellen ist
   --kreide die Tinte (#16150F). Unter jeder Bestellung stand so die
   gewählte Stufe „Neu / In Arbeit / Fertig“ als schwarzer Balken.

   Zweite Quelle ist nicht eine Liste von Klassen (die sähe nur, was
   ich schon kenne, §8.1b), sondern JEDES Bedienelement der Seite:
   button, input, select, textarea, [aria-pressed], [role=radio] —
   auch die in versteckten Blättern (der berechnete Stil gilt dort
   genauso). Ausnahmen stehen namentlich da (§8.1g D).

   Dazu je gewählter Zustand: Schrift auf Fläche ≥ 4,5:1, und die Wahl
   ist von einem ungewählten Nachbarn zu unterscheiden (Fläche oder
   Rand anders). Und der Gegenfall: Im Dunkeln bleibt es, wie es war.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const OBEN = path.resolve(__dirname, "..");

let n = 0, f = 0;
const pruef = (gut, text, mehr) => { n++; if(!gut) f++;
  console.log((gut ? "  ok   " : "  FEHL ") + text + (mehr !== undefined ? "  → " + mehr : "")); };

/* Namentlich, mit Grund. Kein Muster. */
const AUSNAHMEN = {
  "admin.html": {},
  "kueche.html": {}
};

/* Im Browser: Farben lesen (rgb() UND color(srgb …), wie color-mix sie
   ausgibt), Helligkeit und Kontrast rechnen. */
const MESSEN = () => {
  const farbe = c => {
    let m = c.match(/^rgba?\(([^)]+)\)/);
    if(m){ const t = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
      return { r:t[0] / 255, g:t[1] / 255, b:t[2] / 255, a:t.length > 3 ? t[3] : 1 }; }
    m = c.match(/^color\(srgb ([^)]+)\)/);
    if(m){ const t = m[1].split(/[ \/]+/).filter(Boolean).map(Number);
      return { r:t[0], g:t[1], b:t[2], a:t.length > 3 ? t[3] : 1 }; }
    return null;
  };
  const lum = f => { const k = x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4);
    return .2126 * k(f.r) + .7152 * k(f.g) + .0722 * k(f.b); };
  const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const name = el => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    ([...el.classList].length ? "." + [...el.classList].join(".") : "");
  const dunkel = [], gewaehlt = [];
  document.querySelectorAll('button,input,select,textarea,[aria-pressed],[role="radio"]').forEach(el => {
    if(["checkbox", "radio", "range", "file", "hidden", "color"].includes(el.type)) return;
    const cs = getComputedStyle(el);
    const bg = farbe(cs.backgroundColor);
    /* „Schwarz“ heißt: dunkel UND unbunt. Ein grüner Schalter in „an“
       (#3A6329, Helligkeit 0,10) ist eine Bedeutungsfarbe, kein Balken. */
    const unbunt = bg && (Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b)) < .12;
    if(bg && bg.a >= .5 && lum(bg) < .1 && unbunt) dunkel.push(name(el) + " " + cs.backgroundColor);
    const an = el.getAttribute("aria-pressed") === "true" || el.getAttribute("aria-checked") === "true" ||
               el.classList.contains("an");
    if(an && bg && bg.a >= .5 && el.textContent.trim()){
      const tx = farbe(cs.color);
      const nachbar = [...(el.parentElement ? el.parentElement.children : [])].find(x => x !== el &&
        x.tagName === el.tagName && !(x.getAttribute("aria-pressed") === "true" || x.classList.contains("an")));
      let anders = null;
      if(nachbar){ const ns = getComputedStyle(nachbar);
        anders = ns.backgroundColor !== cs.backgroundColor || ns.borderColor !== cs.borderColor || ns.boxShadow !== cs.boxShadow; }
      gewaehlt.push({ el:name(el), k: tx ? kontrast(tx, bg) : 0, anders });
    }
  });
  return { dunkel, gewaehlt };
};

async function seite(br, datei, licht){
  const ctx = await br.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
  await p.goto("file://" + path.join(OBEN, "seiten", datei));
  await p.waitForTimeout(800);
  await p.evaluate(licht => {
    const tor = document.getElementById("tor"); if(tor) tor.hidden = true;
    if(typeof demoStarten === "function"){ demoStarten(); if(typeof zeichneAlles === "function") zeichneAlles(); }
    const s = document.getElementById("scharf"); if(s) s.hidden = true;
    /* Küche: kein Vorführmodus. Gewählte Zustände entstehen dort über
       die echten Griffe — eine Spur antippen, die Einstellungen öffnen.
       EINST liegt dort in einer Hülle (nicht global) — hell wird deshalb
       NACH den Griffen gesetzt, sonst schaltete einstAnwenden() zurück. */
    if(document.getElementById("spuren")){
      const spur = document.querySelector('#spuren [data-spur="kueche"]'); if(spur) spur.click();
      const ek = document.getElementById("einstKnopf"); if(ek) ek.click();
    }
    document.body.classList.toggle("hell", licht === "hell");
  }, licht);
  await p.waitForTimeout(400);
  return { p, ctx, fehler };
}

(async () => {
  const br = await chromium.launch();
  for(const datei of ["admin.html", "kueche.html"]){
    console.log("\n══ " + datei + " · hell ══");
    const { p, ctx, fehler } = await seite(br, datei, "hell");
    /* Voraussetzung (§8.1g C): Es gibt überhaupt einen gewählten
       Zustand — sonst meldete die Probe „nichts Schwarzes“, weil
       nichts gewählt ist. */
    const tafeln = datei === "admin.html" ? ["bestellungen", "speisekarte", "reservierungen", "einstellungen"] : [null];
    const alle = { dunkel:new Set(), gewaehlt:[] };
    for(const t of tafeln){
      if(t) await p.evaluate(t => { if(typeof tafelZeigen === "function") tafelZeigen(t); }, t);
      await p.waitForTimeout(250);
      const m = await p.evaluate(MESSEN);
      m.dunkel.forEach(x => alle.dunkel.add(x));
      alle.gewaehlt.push(...m.gewaehlt);
    }
    const ausn = AUSNAHMEN[datei];
    const echt = [...alle.dunkel].filter(x => !Object.keys(ausn).some(a => x.startsWith(a + " ")));
    const schritte = alle.gewaehlt.filter(g => /\.schritt\b|\.spuren|reihe|button/.test(g.el));
    pruef(alle.gewaehlt.length > 0, "Voraussetzung: es gibt gewählte Zustände", alle.gewaehlt.length + " Stück");
    if(datei === "admin.html")
      pruef(alle.gewaehlt.some(g => /\.schritt/.test(g.el)), "Voraussetzung: eine gewählte Stufe unter einer Bestellung ist da");
    pruef(echt.length === 0, "kein Bedienelement mit schwarzer Fläche", echt.slice(0, 6).join(" | ") || "keins");
    const schwach = alle.gewaehlt.filter(g => g.k < 4.5);
    pruef(!schwach.length, "gewählte Zustände: Schrift ≥ 4,5:1",
      schwach.map(g => g.el + " " + g.k.toFixed(2)).slice(0, 4).join(" | ") ||
      "kleinster Wert " + Math.min(...alle.gewaehlt.map(g => g.k)).toFixed(2));
    const gleich = schritte.filter(g => g.anders === false);
    pruef(!gleich.length, "die Wahl ist vom Nachbarn zu unterscheiden", gleich.map(g => g.el).slice(0, 4).join(" | ") || "ja");
    pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();

    /* Gegenfall: Im Dunkeln bleibt die Wahl, wie sie war (hell auf dunkel). */
    const d = await seite(br, datei, "dunkel");
    if(datei === "admin.html") await d.p.evaluate(() => tafelZeigen("bestellungen"));
    const dm = await d.p.evaluate(MESSEN);
    pruef(dm.gewaehlt.length > 0 && dm.gewaehlt.every(g => g.k >= 4.5), "dunkel: gewählte Zustände weiter lesbar",
      dm.gewaehlt.length + " Stück");
    await d.ctx.close();
  }
  /* ── Anmeldung: #lMail/#lPass (admin.html), .tor input (kueche.html) ──
     VORFALL 26.09. (Bildschirmfoto): #lMail/#lPass hatten KEINE eigene
     Klasse und standen in KEINER CSS-Regel — email/password fehlten in
     der Feld-Liste. Ohne color/-webkit-text-fill-color nimmt Safari
     seine Systemfarbe (§3.5): Im Hellen ein schwarzes Feld, schwarze
     Schrift. Der bisherige seite()-Helfer prüft das nie — er ruft
     demoStarten() und blendet #tor damit aus. Hier bleibt #tor offen. */
  console.log("\n══ Anmeldung (#tor), hell, GERÄT auf Dunkel ══");
  /* colorScheme:"dark" am Kontext — sonst reproduziert kein Chromium
     den gemeldeten Fehler: Ohne echtes "Gerät steht auf Dunkel" bleibt
     ein ungestyltes Feld auch in Chromium hell (nicht "schwarz auf
     schwarz"), und der Gegenbeweis (Regel entfernt) bliebe grün, ohne
     dass die Probe blind wäre — sie hätte nur nie den Fall gemessen,
     der den Fehler zeigt (§8.1g). */
  for(const datei of ["admin.html", "kueche.html"]){
    const ctx = await br.newContext({ viewport:{ width:390, height:844 }, colorScheme:"dark" });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    if(datei === "admin.html"){
      /* Ohne echten Netzzugriff (auch abgefangen) zeigt admin.html sonst
         die "Gerade nicht erreichbar"-Ersatzseite und #tor verliert
         genau die Felder, die hier gemessen werden. Ein gestelltes
         window.supabase reicht — dieselbe Technik wie in
         pruef-sperre-ueberall.js, hier auf das Nötigste verkürzt. */
      await p.addInitScript(() => {
        window.supabase = { createClient: () => ({
          auth: { onAuthStateChange:() => ({ data:{ subscription:{ unsubscribe(){} } } }),
                  getSession: async () => ({ data:{ session:null } }),
                  signInWithPassword: async () => ({ data:{}, error:null }),
                  resetPasswordForEmail: async () => ({ error:null }),
                  signOut: async () => ({}) },
          from: () => ({ select(){ return this; }, eq(){ return this; },
                         then(res){ res({ data:[], error:null }); } }),
          rpc: async () => ({ data:null, error:null }),
          channel: () => ({ on(){ return this; }, subscribe(){ return this; }, unsubscribe(){} }),
          removeChannel(){}, removeAllChannels(){},
          functions: { invoke: async () => ({ data:null, error:null }) },
          storage: { from: () => ({ getPublicUrl: () => ({ data:{ publicUrl:"" } }), upload: async () => ({}) }) }
        }) };
      });
    }
    await p.goto("file://" + path.join(OBEN, "seiten", datei));
    await p.waitForTimeout(800);
    /* kueche.html: EINST ist Modul-privat (IIFE) und die Anmeldung
       läuft dort NIE durch lichtAnwenden() — vor dem Einloggen zeigt
       sie immer die dunkle Vorgabe (kein gemeldeter Fehler, also keine
       hell-Umschaltung hier). Strukturell wird trotzdem geprüft, dass
       -webkit-text-fill-color gesetzt ist (§3.5), unabhängig davon. */
    const r = await p.evaluate(datei => {
      if(datei === "admin.html"){
        EINST.licht = "hell"; lichtAnwenden();
        document.getElementById("lNeuTeil").hidden = false;
      }
      const farbe = c => {
        let m = c.match(/^rgba?\(([^)]+)\)/);
        if(m){ const t = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
          return { r:t[0] / 255, g:t[1] / 255, b:t[2] / 255, a:t.length > 3 ? t[3] : 1 }; }
        m = c.match(/^color\(srgb ([^)]+)\)/);
        if(m){ const t = m[1].split(/[ \/]+/).filter(Boolean).map(Number);
          return { r:t[0], g:t[1], b:t[2], a:t.length > 3 ? t[3] : 1 }; }
        return null;
      };
      const lum = f => { const k = x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4);
        return .2126 * k(f.r) + .7152 * k(f.g) + .0722 * k(f.b); };
      const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const felder = [...document.querySelectorAll(
        datei === "admin.html" ? "#lMail,#lPass,#lNeu1,#lNeu2" : "#mail,#wort")]
        .filter(el => el.getClientRects().length > 0);
      return {
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        felder: felder.map(el => {
          const cs = getComputedStyle(el);
          const bg = farbe(cs.backgroundColor), tx = farbe(cs.color);
          return { id: el.id, bg: cs.backgroundColor, farbe: cs.color,
                   webkitFill: cs.webkitTextFillColor,
                   k: (bg && tx) ? kontrast(bg, tx) : 0 };
        })
      };
    }, datei);
    pruef(r.felder.length >= (datei === "admin.html" ? 4 : 2), datei + ": Voraussetzung: alle Anmeldefelder stehen da", r.felder.length);
    if(datei === "admin.html"){
      pruef(r.colorScheme === "light", datei + ": color-scheme folgt der hellen Wahl, nicht dem Gerät", r.colorScheme);
      const schwach = r.felder.filter(x => x.k < 4.5);
      pruef(!schwach.length, datei + ": jedes Anmeldefeld ≥ 4,5:1 (Schrift auf Fläche)",
        schwach.map(x => x.id + " " + x.k.toFixed(2) + " (" + x.bg + "/" + x.farbe + ")").join(" | ") || "kleinster Wert " + Math.min(...r.felder.map(x => x.k)).toFixed(2));
    }
    const ohneFill = r.felder.filter(x => !x.webkitFill || x.webkitFill === "rgb(0, 0, 0)" && x.farbe !== "rgb(0, 0, 0)");
    pruef(r.felder.every(x => x.webkitFill && x.webkitFill !== "rgba(0, 0, 0, 0)"), datei + ": -webkit-text-fill-color ausdrücklich gesetzt",
      r.felder.map(x => x.id + "=" + x.webkitFill).join(" | "));
    pruef(!fehler.length, datei + ": keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }

  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Fehler." : n + " von " + n + " ok\nAlles sauber."));
  process.exit(f ? 1 : 0);
})();
