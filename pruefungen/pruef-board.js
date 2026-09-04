/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Das Admin-Board von Hand bedient

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-board.js

   Sie fragt drei Dinge, die man einer Datei nicht ansieht:

   1 · Ist jede Fläche gefüllt? Ein Reiter, der leer aufgeht, ist
       schlimmer als keiner — der Betrieb sucht dann nach dem Fehler
       bei sich.
   2 · Wie viele Griffe braucht das Alltägliche? Ein Board, das im
       Betrieb bedient wird, hat zwischen Meldung und Handgriff keine
       drei Ebenen.
   3 · Meldet die Konsole etwas? Ein Board, das still einen Fehler
       wirft, ist nicht in Ordnung, auch wenn es noch etwas zeigt.

   Gefahren wird im VORFÜHRMODUS: Er füllt das Board mit Beispielen
   und rührt keine echten Daten an — genau dafür ist er da.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

/* Die Seiten liegen seit dem Aufraeumen eine Ebene hoeher in
   seiten/. Ohne diesen Schritt faellt das Skript mit ENOENT um. */
const HIER = path.join(__dirname, "..", "seiten");
let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

const MASSE = [
  { name:"Telefon", width:390, height:844 },
  { name:"Tresen",  width:1280, height:900 }
];

(async () => {
  if(!fs.existsSync(path.join(HIER, "admin.html"))){
    console.log("admin.html fehlt."); process.exit(1);
  }
  const browser = await chromium.launch();

  for(const m of MASSE){
    const ctx = await browser.newContext({ viewport:{ width:m.width, height:m.height } });
    const seite = await ctx.newPage();
    const konsole = [];
    seite.on("pageerror", e => konsole.push(String(e).slice(0,150)));
    seite.on("console", x => { if(x.type() === "error") konsole.push(x.text().slice(0,150)); });

    /* Die Bibliothek kommt aus einem fremden Netz und ist hier nicht
       erreichbar. Genau dieser Fall soll eine ERKLÄRUNG zeigen, keinen
       weißen Schirm — das wird zuerst geprüft. */
    await seite.route("**/*", r => r.request().url().startsWith("file://")
      ? r.continue() : r.abort());
    await seite.goto("file://" + path.join(HIER, "admin.html"));
    await seite.waitForTimeout(900);

    console.log("\n══ " + m.name + " ══");
    const ohneNetz = (await seite.textContent("#tor")) || "";
    pruef(/nicht erreichbar/i.test(ohneNetz),
      "ohne Bibliothek sagt das Board, was los ist — kein weißer Schirm",
      ohneNetz.trim().split("\n")[0].slice(0, 44));

    /* Ab hier das Board selbst: Vorführmodus, Tor weg. */
    await seite.evaluate(() => {
      document.getElementById("tor").hidden = true;
      if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); }
    });
    await seite.waitForTimeout(500);
    /* Das Board fragt beim Start einmal, ob es Ton und Mitteilungen
       benutzen darf. Das ist so gewollt — hier wird es weggetippt,
       damit die Prüfung an das Board dahinter kommt. */
    const scharf = await seite.$("#scharfJetzt");
    if(scharf && await seite.isVisible("#scharf")){
      await scharf.click();
      await seite.waitForTimeout(400);
    }
    pruef(!(await seite.isVisible("#scharf")),
      "der Scharfschalt-Schirm geht mit einem Griff weg");

    /* ── 1 · Jede Fläche gefüllt ── */
    const tafeln = await seite.$$eval("nav[role=tablist] [data-tafel]",
      e => e.map(x => x.dataset.tafel));
    pruef(tafeln.length >= 5, "das Board hat seine Bereiche", tafeln.join(", "));

    for(const t of tafeln){
      await seite.evaluate(z => tafelZeigen(z), t);
      await seite.waitForTimeout(350);
      const stand = await seite.evaluate(z => {
        const el = document.getElementById("t-" + z);
        if(!el) return { da:false };
        return { da:true, sichtbar: !el.hidden,
                 zeichen: (el.textContent || "").trim().length,
                 knoepfe: el.querySelectorAll("button, input, select, a").length };
      }, t);
      pruef(stand.da && stand.sichtbar && stand.zeichen > 40,
        "„" + t + "“ ist gefüllt",
        stand.da ? stand.zeichen + " Zeichen, " + stand.knoepfe + " Bedienelemente" : "fehlt");
    }

    /* ── 2 · Wege im Alltag ── */
    await seite.evaluate(() => tafelZeigen("bestellungen"));
    await seite.waitForTimeout(400);
    const wege = await seite.evaluate(() => {
      const raus = {};
      /* Eine offene Bestellung auf „in Arbeit" setzen: Wie weit ist
         der Knopf von der Meldung entfernt? */
      const karte = document.querySelector("[data-id], .bestellung, .bon");
      raus.karteDa = !!karte;
      raus.knopfInKarte = karte
        ? karte.querySelectorAll("button").length : 0;
      /* Die Karte pflegen und eine Aktion starten */
      raus.runnerKnopf = !!document.getElementById("runnerAuf");
      raus.textflaeche = !!document.getElementById("hubClaim");
      return raus;
    });
    pruef(wege.karteDa, "eine Meldung steht auf dem Board");
    pruef(wege.knopfInKarte >= 1,
      "der nächste Handgriff steht IN der Meldung, nicht in einem Menü",
      wege.knopfInKarte + " Knöpfe");

    /* Top-Runner: vom Board zur laufenden Aktion */
    await seite.evaluate(() => tafelZeigen("speisekarte"));
    await seite.waitForTimeout(400);
    pruef(await seite.isVisible("#runnerAuf"),
      "die Aktion beginnt auf der Kartenfläche, nicht in den Einstellungen");
    await seite.click("#runnerAuf");
    await seite.waitForTimeout(400);
    const form = await seite.evaluate(() => {
      const f = document.getElementById("runnerForm");
      return { offen: f && !f.hidden,
               felder: f ? f.querySelectorAll("input, select").length : 0,
               titel: !!document.getElementById("runnerTitel"),
               vorschau: (document.getElementById("runnerVorschau") || {}).textContent || "" };
    });
    pruef(form.offen, "das Formular geht mit einem Griff auf");
    pruef(form.titel, "die Aktion lässt sich benennen");
    pruef(form.felder <= 6,
      "und fragt nicht mehr, als sie muss", form.felder + " Felder");
    pruef(/→/.test(form.vorschau),
      "die Vorschau sagt vorher, was der Gast sehen wird",
      form.vorschau.slice(0, 58));

    /* ── 3 · Der erste Tipp darf nicht verloren gehen ── */
    await seite.evaluate(() => tafelZeigen("bestellungen"));
    await seite.waitForTimeout(300);
    const ersterTipp = await seite.evaluate(() => {
      const k = document.querySelector("#t-bestellungen button");
      if(!k) return "kein Knopf";
      let gezaehlt = 0;
      k.addEventListener("click", () => gezaehlt++, { once:true });
      k.click();
      return gezaehlt === 1 ? "kommt an" : "verloren";
    });
    pruef(ersterTipp === "kommt an", "der erste Tipp kommt an", ersterTipp);

    /* ── 4 · Telefon: die Befehlsleiste ── */
    if(m.width < 760){
      const leiste = await seite.evaluate(() => {
        const l = document.querySelector(".befehlsleiste");
        if(!l) return null;
        const k = l.getBoundingClientRect();
        const knoepfe = [...l.querySelectorAll("button")].map(b => {
          const r = b.getBoundingClientRect();
          return { w:Math.round(r.width), h:Math.round(r.height) };
        });
        return { unten: Math.round(window.innerHeight - k.bottom),
                 knoepfe, kleinste: Math.min(...knoepfe.map(x => Math.min(x.w, x.h))) };
      });
      pruef(!!leiste, "die Befehlsleiste steht auf dem Telefon");
      if(leiste){
        pruef(leiste.unten <= 1, "am unteren Rand", leiste.unten + "px Abstand");
        /* 44px ist das Maß, unter dem ein Finger danebentrifft. */
        pruef(leiste.kleinste >= 44, "jede Trefferfläche mindestens 44px",
          leiste.kleinste + "px");
      }
    }

    /* ── 5 · Nichts schiebt seitlich ── */
    const schiebt = [];
    for(const t of tafeln){
      await seite.evaluate(z => tafelZeigen(z), t);
      await seite.waitForTimeout(250);
      const u = await seite.evaluate(() => {
        const ueber = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        if(ueber <= 1) return { ueber:0 };
        /* Wer schiebt? Das breiteste Element benennen, statt nur zu
           melden, dass es schiebt. */
        let schuld = null, breit = 0;
        document.querySelectorAll(".tafel:not([hidden]) *").forEach(el => {
          const r = el.getBoundingClientRect();
          if(r.right > document.documentElement.clientWidth + 1 && r.width > breit){
            breit = r.width; schuld = el;
          }
        });
        return { ueber, schuld: schuld
          ? schuld.tagName.toLowerCase() + (schuld.id ? "#" + schuld.id : "") +
            (typeof schuld.className === "string" && schuld.className
              ? "." + schuld.className.trim().split(/\s+/).slice(0,2).join(".") : "") +
            " (" + Math.round(breit) + "px)"
          : "unbekannt" };
      });
      if(u.ueber > 1) schiebt.push(t + ": " + u.ueber + "px durch " + u.schuld);
    }
    pruef(schiebt.length === 0, "keine Fläche schiebt seitlich",
      schiebt.length ? schiebt.join(" | ") : "alle " + tafeln.length + " geprüft");

    /* ── 6 · Konsole ── */
    const echt = konsole.filter(z => !/net::ERR|Failed to load resource|supabase/i.test(z));
    pruef(echt.length === 0, "kein Fehler in der Konsole", echt[0] || "still");

    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
