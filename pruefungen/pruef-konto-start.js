/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Konto und Anfrageformular von Hand bedient

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-konto-start.js

   Beide Seiten waren bis zum 30.08. von KEINER Prüfung angefasst.
   Gefunden hat diese hier beim ersten Lauf: Das <select> für die
   Öffnungszeiten stand auf 15px. Unter 16px zoomt iOS beim Antippen
   in die Seite hinein, und der Gastronom muss danach wieder
   herauszoomen, um den Rest des Formulars zu sehen (CLAUDE.md §3.5).

   Gefahren wird OHNE Netz nach außen. Für konto.html ist das der
   entscheidende Fall: Die Seite lädt supabase-js aus /lib/ (selbst ausgeliefert), und
   wenn das ausbleibt, darf sie NICHT weiß werden, sondern muss
   sagen, was los ist.

   Was hier bewusst NICHT als Fehler zählt:
     · der Stopp „Supabase-Bibliothek nicht geladen" in konto.html.
       Er ist Absicht — die Erklärung steht schon auf dem Schirm,
       und der throw hält an, bevor createClient() eine Zeile weiter
       mit einer nutzloseren Meldung abstürzt.
     · die Falle für Werbeschleudern in start.html. Sie ist 1px
       groß, liegt bei -9999px und wird von keinem Menschen
       angetippt.
   Ein Test, der beides meldet, schlägt Fehlalarm — und Fehlalarme
   bringen einem bei, ihn zu übergehen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
/* Die beiden Seiten liegen in seiten/, eine Ebene hoeher. */
const SEITEN = path.join(__dirname, "..", "seiten");
let fehler = 0, hinweise = 0;
const ok   = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };
const hinw = (g,t,z) => { console.log((g?"  ok   ":"  hinw ")+t+(z?"  → "+z:"")); if(!g) hinweise++; };
/* Der Stopp in konto.html ist ABSICHT: Die Seite zeigt erst die
   Erklaerung und wirft dann, damit supabase.createClient() eine Zeile
   weiter nicht mit einer nutzloseren Meldung abstuerzt. Ein Test, der
   das als Fehler meldet, schlaegt Fehlalarm — und Fehlalarme bringen
   einem bei, den Test zu uebergehen. */
const echt = k => k.filter(z =>
  !/net::ERR|Failed to (load|fetch)|ERR_FAILED|Load failed/i.test(z) &&
  !/Supabase-Bibliothek nicht geladen/.test(z));

/* ═══ Die Kontoseite MIT Bibliothek, aber weiter ohne Netz ═══════
   Der Abschnitt oben fährt die Seite so, wie sie aussieht, wenn
   supabase-js nicht durchkommt. Für den Google-Knopf brauche ich
   das Gegenteil: Die Bibliothek muss da sein, sonst hält der throw
   in konto.html das ganze Skript an und der Knopf lebt gar nicht.

   Statt ins Netz zu gehen, wird die Bibliothek GESTELLT — ein
   Nachbau mit genau den Methoden, die die Seite beim Laden und
   beim Klick anfasst. Der Nachbau ahmt dabei die Stelle nach, um
   die es geht: OHNE skipBrowserRedirect springt er selbst weg,
   genau wie das Original. So reproduziert der Gegenbeweis den
   echten Anlassfall und nicht eine Bequemlichkeit von mir.

   `anbieter`: true | false  → so antwortet /auth/v1/settings
               "fehler"      → die Frage kommt nicht durch */
const BIBLIOTHEK = `
window.supabase = {
  createClient: function(adresse, schluessel){
    return {
      auth: {
        getSession:        async () => ({ data:{ session:null }, error:null }),
        onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
        signInWithOAuth:   async (o) => {
          window.__oauth = JSON.parse(JSON.stringify(o));
          const f = new URLSearchParams({
            provider: o.provider,
            redirect_to: (o.options || {}).redirectTo || ""
          });
          const ziel = adresse + "/auth/v1/authorize?" + f.toString();
          /* Genau wie im Original: ohne skipBrowserRedirect geht die
             Bibliothek selbst weg, und alles danach ist toter Code. */
          if(!(o.options || {}).skipBrowserRedirect) location.assign(ziel);
          return { data:{ provider:o.provider, url:ziel }, error:null };
        },
        signInWithPassword:    async () => ({ error:null }),
        signUp:                async () => ({ data:null, error:null }),
        resetPasswordForEmail: async () => ({ error:null }),
        signOut:               async () => ({})
      },
      rpc:  async () => ({ data:null, error:null }),
      from: () => ({ select: () => ({ limit: async () => ({ data:[], error:null }) }) }),
      storage: { from: () => ({}) }
    };
  }
};`;

async function googleSeite(b, anbieter, w, h){
  const ctx = await b.newContext({ viewport:{ width:w||390, height:h||844 } });
  const p = await ctx.newPage();
  const kons = [], gerufen = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  p.on("console", m => { if(m.type()==="error") kons.push(m.text().slice(0,150)); });

  /* Seit 08.10. liefert omoteno supabase-js selbst aus (/lib/…), mit
     integrity. Eine untergeschobene Datei an dieser Adresse weist der
     Browser ab — genau das soll er (pruef-sicherheit.js prüft es). Der
     Ersatz kommt deshalb VOR dem Laden, die echte Datei wird
     abgewiesen wie früher der Weg zu jsdelivr. */
  await p.addInitScript(BIBLIOTHEK);
  await p.route("**/*", r => {
    const u = r.request().url();
    gerufen.push(u);
    if(/supabase-js/.test(u))            return r.abort();
    if(u.startsWith("file://"))          return r.continue();
    if(/\/auth\/v1\/settings/.test(u)){
      if(anbieter === "fehler")          return r.abort();
      return r.fulfill({ contentType:"application/json",
        body: JSON.stringify({ external:{ google: !!anbieter, email:true } }) });
    }
    /* Der Sprung zu authorize wird mit 204 beantwortet, nicht
       abgewiesen. Grund, und der hat mich eine Runde gekostet:
       Ein abgewiesener Hauptrahmen-Sprung setzt in Chromium eine
       FEHLERSEITE — der JS-Zusammenhang der Seite ist dann weg,
       und window.__oauth war null, obwohl der Aufruf stattgefunden
       hatte. Auf 204 bleibt der Browser stehen, wo er ist.
       Der Versuch steht trotzdem in `gerufen`. */
    if(/\/auth\/v1\/authorize/.test(u)) return r.fulfill({ status:204, body:"" });
    /* Alles Übrige — Schriften und dergleichen — wird abgewiesen. */
    return r.abort();
  });

  await p.goto("file://" + path.join(SEITEN, "konto.html"));
  await p.waitForTimeout(900);
  return { ctx, p, kons, gerufen };
}

async function seite(b, datei, w, h){
  const ctx = await b.newContext({ viewport:{width:w,height:h} });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));
  p.on("console", m => { if(m.type()==="error") kons.push(m.text().slice(0,150)); });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + path.join(SEITEN, datei));
  await p.waitForTimeout(1100);
  return { ctx, p, kons };
}

(async () => {
  /* Die Dateien neben sich suchen, nicht an einem festen Pfad — nach
     einer Umbenennung fällt eine Prüfung sonst mit ENOENT um und wird
     nicht mehr gelesen (CLAUDE.md §8.2). */
  for(const d of ["konto.html","start.html"]){
    if(!fs.existsSync(path.join(SEITEN, d))){
      console.error(d + " fehlt neben dem Skript."); process.exit(1);
    }
  }
  const b = await chromium.launch();

  /* ══ KONTO ══════════════════════════════════════════════════ */
  for(const [n,w,h] of [["Telefon",390,844],["Rechner",1280,900]]){
    const { ctx, p, kons } = await seite(b, "konto.html", w, h);
    console.log("\n══ konto.html · " + n);

    /* Die Bibliothek (/lib/…) gibt es unter file:// nicht. Genau
       dieser Fall soll eine ERKLAERUNG zeigen, keinen weissen Schirm. */
    const txt = (await p.textContent("body")) || "";
    ok(txt.replace(/\s+/g," ").trim().length > 120,
      "die Seite steht, obwohl die Bibliothek fehlt", txt.replace(/\s+/g," ").trim().slice(0,54));
    ok(/nicht erreichbar|nicht geladen|keine Verbindung/i.test(txt),
      "und sagt, was los ist", (txt.match(/[^.]*nicht erreichbar[^.]*/i)||["—"])[0].trim().slice(0,60));

    /* Nichts darf seitlich schieben, kein Knopf darf ins Leere fuehren. */
    const ueber = await p.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(ueber <= 1, "nichts schiebt seitlich", ueber + "px");

    const tote = await p.evaluate(() => [...document.querySelectorAll('a[href]')]
      .map(a => a.getAttribute("href"))
      .filter(h => h && !/^(https?:|mailto:|tel:|#)/.test(h))
      .filter(h => !["/impressum.html","/datenschutz.html","/start.html",
                     "/marken-studio.html","/konto.html","/admin.html",
                     "impressum.html","datenschutz.html"].includes(h)));
    ok(tote.length === 0, "kein Link zeigt ins Leere", tote.join(", ") || "alle bekannt");

    /* Eingabefelder: 16px und ausdrueckliche Schriftfarbe (§3.5) */
    const felder = await p.evaluate(() => [...document.querySelectorAll("input,textarea,select")]
      .filter(el => el.offsetParent !== null)
      .map(el => { const s = getComputedStyle(el);
        return { typ: el.type || el.tagName, gr: parseFloat(s.fontSize),
                 farbe: s.color, id: el.id || "(ohne id)" }; }));
    const zuKlein = felder.filter(f => f.gr < 16);
    hinw(zuKlein.length === 0, "jedes Eingabefeld hat mindestens 16px (sonst zoomt iOS)",
      zuKlein.length ? zuKlein.map(f => f.id+" "+f.gr+"px").join(", ") : felder.length + " Felder");

    ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
    await ctx.close();
  }

  /* ══ DER GOOGLE-KNOPF ═══════════════════════════════════════
     > Vorfall. Der Knopf führte in eine Sackgasse: Er schickte den
     > Browser zu Supabase, wo rohes JSON stand
     > („provider is not enabled"). Die Übersetzung in konto.html
     > hat das NIE gefangen — signInWithOAuth() fragt niemanden, es
     > springt sofort. Und diese Prüfung hier erwähnte Google mit
     > keiner Zeile; sie konnte es also gar nicht sehen.

     Vier Proben. Die dritte ist die, die einem Kunden den Weg nicht
     nehmen darf (CLAUDE.md §7). */
  {
    console.log("\n══ konto.html · Google");

    /* 1 · Anbieter AUS → Knopf und Trenner sind wirklich weg.
           Gemessen wird display, nicht das Attribut (§8.1c). */
    {
      const { ctx, p, kons } = await googleSeite(b, false);
      const m = await p.evaluate(() => {
        const k = document.getElementById("googleKnopf");
        const t = document.getElementById("oderMail");
        return {
          knopf:   k ? getComputedStyle(k).display : "fehlt",
          trenner: t ? getComputedStyle(t).display : "fehlt",
          tor:     !document.getElementById("tor").hidden,
          mail:    !!document.getElementById("fMail")
        };
      });
      ok(m.knopf === "none", "Anbieter aus: der Google-Knopf ist weg", m.knopf);
      ok(m.trenner === "none", "und der Trenner „oder mit E-Mail\" mit ihm", m.trenner);
      ok(m.tor && m.mail, "der Weg über E-Mail steht weiter offen",
        m.tor ? "Tor sichtbar, Feld da" : "Tor zu");
      ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
      await ctx.close();
    }

    /* 2 · Anbieter AN → Knopf da und groß genug zum Antippen.
           44px ist die Fingerkuppe, nicht der Geschmack. */
    {
      const { ctx, p, kons } = await googleSeite(b, true);
      const m = await p.evaluate(() => {
        const k = document.getElementById("googleKnopf");
        const t = document.getElementById("oderMail");
        if(!k) return { fehlt:true };
        const r = k.getBoundingClientRect();
        return { anzeige:getComputedStyle(k).display, hoch:Math.round(r.height),
                 breit:Math.round(r.width),
                 trenner: t ? getComputedStyle(t).display : "fehlt" };
      });
      ok(!m.fehlt && m.anzeige !== "none", "Anbieter an: der Knopf ist da", m.anzeige);
      ok(m.trenner !== "none", "und der Trenner auch", m.trenner);
      ok(m.hoch >= 44, "der Knopf ist mindestens 44px hoch", m.hoch + "×" + m.breit + "px");
      ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
      await ctx.close();
    }

    /* 3 · Die Frage kommt nicht durch → der Knopf BLEIBT.
           Fail-open. Ein Kunde, der sich nicht anmelden kann,
           kostet mehr als eine seltene Sackgasse (§7). */
    {
      const { ctx, p, kons } = await googleSeite(b, "fehler");
      const anzeige = await p.evaluate(() => {
        const k = document.getElementById("googleKnopf");
        return k ? getComputedStyle(k).display : "fehlt";
      });
      ok(anzeige !== "none" && anzeige !== "fehlt",
        "Frage scheitert: der Knopf bleibt trotzdem stehen", anzeige);
      ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
      await ctx.close();
    }

    /* 4 · Der Klick. Der Sprung muss UNS gehören — sonst ist alles
           unter signInWithOAuth wieder toter Code. Gemessen wird,
           was die Bibliothek übergeben bekommt, und wohin die Seite
           danach zu gehen versucht. */
    {
      const { ctx, p, kons, gerufen } = await googleSeite(b, true);
      const vorher = gerufen.length;
      await p.click("#googleKnopf");
      await p.waitForTimeout(700);
      const o = await p.evaluate(() => window.__oauth || null);
      ok(!!o, "signInWithOAuth wurde aufgerufen", o ? o.provider : "gar nicht");
      ok(!!o && o.options && o.options.skipBrowserRedirect === true,
        "die Seite behält den Sprung bei sich (skipBrowserRedirect)",
        o && o.options ? String(o.options.skipBrowserRedirect) : "—");
      ok(!!o && o.options && /konto\.html$/.test(String(o.options.redirectTo || "")),
        "und schickt auf die Kontoseite zurück",
        (o && o.options && o.options.redirectTo || "—").slice(-40));
      const ziel = gerufen.slice(vorher).find(u => /\/auth\/v1\/authorize/.test(u)) || "";
      ok(/provider=google/.test(ziel), "der Sprung geht zu authorize?provider=google",
        ziel ? ziel.replace(/^https?:\/\/[^/]+/, "…").slice(0,70) : "kein Sprung");
      ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
      await ctx.close();
    }
  }

  /* ══ ANFRAGEFORMULAR ════════════════════════════════════════ */
  for(const [n,w,h] of [["Telefon",390,844],["Rechner",1280,900]]){
    const { ctx, p, kons } = await seite(b, "start.html", w, h);
    console.log("\n══ start.html · " + n);

    const txt = (await p.textContent("body")) || "";
    ok(txt.replace(/\s+/g," ").trim().length > 200, "das Formular steht",
      txt.replace(/\s+/g," ").trim().slice(0,54));

    /* Durch die Schritte gehen — jeder muss Felder haben und weiter fuehren. */
    const schritte = await p.evaluate(() => {
      const b = document.querySelectorAll(".balken-teil, [data-schritt]");
      return b.length;
    });
    hinw(schritte > 0, "der Fortschrittsbalken ist da", schritte + " Teile");

    const weiter = await p.$('[data-nav="weiter"]');
    ok(!!weiter, "es gibt einen Weiter-Knopf");
    if(weiter){
      /* Leer weiterklicken muss GEBREMST werden, nicht durchgehen. */
      await weiter.click(); await p.waitForTimeout(500);
      const gemeckert = await p.evaluate(() =>
        document.querySelectorAll(".feld.falsch, [aria-invalid=true], .fehler").length);
      hinw(gemeckert > 0, "leeres Weiterklicken wird bemaengelt statt durchgelassen",
        gemeckert + " Feld(er) markiert");
    }

    /* Die Falle fuer Werbeschleudern muss unsichtbar sein. */
    const falle = await p.evaluate(() => {
      const f = document.getElementById("falle");
      if(!f) return "keine";
      const r = f.getBoundingClientRect();
      return (r.width <= 2 || r.height <= 2 || r.left < -1000) ? "unsichtbar" : "SICHTBAR";
    });
    ok(falle !== "SICHTBAR", "die Falle fuer Werbeschleudern ist unsichtbar", falle);

    const ueber = await p.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(ueber <= 1, "nichts schiebt seitlich", ueber + "px");

    const felder = await p.evaluate(() => [...document.querySelectorAll("input,textarea,select")]
      .filter(el => el.offsetParent !== null)
      .map(el => ({ gr: parseFloat(getComputedStyle(el).fontSize), id: el.id || el.name || "(ohne)" })));
    /* Die Falle fuer Werbeschleudern zaehlt nicht: Sie ist 1px gross,
       liegt bei -9999px und wird von keinem Menschen angetippt. */
    const zuKlein = felder.filter(f => f.gr < 16 && f.id !== "falle");
    hinw(zuKlein.length === 0, "jedes Eingabefeld hat mindestens 16px",
      zuKlein.length ? zuKlein.slice(0,4).map(f => f.id+" "+f.gr+"px").join(", ")
                     : felder.length + " Felder");

    ok(echt(kons).length === 0, "kein Fehler in der Konsole", echt(kons)[0] || "still");
    await ctx.close();
  }

  await b.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Keine Fehler") +
              (hinweise ? ", " + hinweise + " Hinweis(e)" : ""));
  process.exit(fehler ? 1 : 0);
})();
