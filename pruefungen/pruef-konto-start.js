/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Konto und Anfrageformular von Hand bedient

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-konto-start.js

   Beide Seiten waren bis zum 30.08. von KEINER Prüfung angefasst.
   Gefunden hat diese hier beim ersten Lauf: Das <select> für die
   Öffnungszeiten stand auf 15px. Unter 16px zoomt iOS beim Antippen
   in die Seite hinein, und der Gastronom muss danach wieder
   herauszoomen, um den Rest des Formulars zu sehen (CLAUDE.md §3.5).

   Gefahren wird OHNE Netz nach außen. Für konto.html ist das der
   entscheidende Fall: Die Seite lädt supabase-js von jsdelivr, und
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

    /* Die Bibliothek kommt von jsdelivr und ist hier gesperrt. Genau
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
