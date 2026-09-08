/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Landingpage, kopflos durchgespielt

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-web.js

   Sie fragt sieben Dinge, die man einer Datei nicht ansieht:

   1 · Wie lange bis zum ERSTEN BILD, wenn der Schriftdienst nicht
       antwortet? Am 30.08. waren es 12 605 ms, weil der Stilbogen
       von fonts.googleapis.com blockierend eingebunden war. Der
       Besucher sah bis dahin nichts — kein Text, kein Gerüst. Das
       ist die Zahl, um die es hier geht.
   2 · Steht der Name des LAUFENDEN SCHRITTS auf jeder Breite im
       Bild? Bis zum 30.08. blendete eine Medienregel ihn unter
       700px aus; der Gast sah sechs namenlose Punkte.
   3 · Lassen sich Hub-Fenster UND Board-Fenster öffnen, bedienen
       und schließen — und rollt die Seite danach wieder? Ein
       Fenster, das die Seite feststellt, ist schlimmer als keines.
   4 · Schiebt etwas seitlich? Und wer?
   5 · Bei prefers-reduced-motion: läuft nichts endlos.
   6 · Ohne Netz: steht die Seite trotzdem vollständig?
   7 · Am Träger-Modell: Liegt der Schatten UNTER dem Gegenstand?
       Passt jede Zeile auf die A5-Fläche? Läuft eine Bewegung über
       ein Layout-Merkmal? Und wie lange dauert die Antwort auf ein
       Antippen? Gemessen am 08.09.: Der Schatten lag OBEN
       (elementFromPoint traf ihn bei 9,8 px Überlappung), die
       Schlagzeile lief von x −9 bis 109 in einer 100 breiten Fläche,
       zwei Balken liefen über `width`, und vom Tipp bis zum offenen
       Hub vergingen 820 ms.

   Gefahren wird OHNE Netz nach außen. Jede Anfrage, die nicht
   file:// ist, wird abgewiesen — genauso, wie es hinter einer Firma,
   mit Werbeblocker oder in einem schlechten Funkloch aussieht. Wenn
   die Seite DAS übersteht, übersteht sie alles.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

/* Die Datei hieß einmal omoteno-landingpage.html. Nach der
   Umbenennung fielen drei Prüfskripte mit ENOENT um und liefen
   monatelang nicht mehr, während in der Prüfliste stand, dass sie
   laufen (CLAUDE.md §8.2). Deshalb sucht auch diese ihre Datei
   neben sich und nennt im Fehlerfall alle Namen. */
const KANDIDATEN = ["omoteno-web.html", "omoteno-landingpage.html", "index.html"];
const DATEI = KANDIDATEN.map(n => path.join(__dirname, "..", "seiten", n))
                        .find(fs.existsSync);
if(!DATEI){
  console.error("Keine Landingpage gefunden. Gesucht: " + KANDIDATEN.join(", "));
  process.exit(1);
}
const ADRESSE = "file://" + DATEI;

/* Die Grenze für das erste Bild. 500 ms ist nicht willkürlich: Es
   ist die Schwelle, unterhalb derer ein Seitenaufbau als
   „sofort" wahrgenommen wird. Darüber beginnt das Warten. */
const GRENZE_MS = 500;

const MASSE = [
  { name:"Telefon kurz", width:390,  height:664 },
  { name:"Telefon",      width:390,  height:844 },
  { name:"Tablet",       width:820,  height:1180 },
  { name:"Rechner",      width:1440, height:900 }
];

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

/* Der Auffangkanal MUSS zuerst registriert werden. Wird er nach den
   Ausnahmen gesetzt, greift er nie — der Fehler hat in diesem
   Projekt schon einmal eine Stunde gekostet. */
async function ohneNetz(seite){
  await seite.route("**/*", r =>
    r.request().url().startsWith("file://") ? r.continue() : r.abort());
}

(async () => {
  const browser = await chromium.launch();

  /* ══ 1 · Ladezeit ══════════════════════════════════════════════
     Zwei Fälle, weil sie verschiedene Dinge messen: Der Dienst
     ANTWORTET NICHT (hängt) ist der schlimme — ein abgewiesener
     Link scheitert sofort, ein hängender blockiert, solange der
     Browser wartet. Genau das war der 12-Sekunden-Fall. */
  console.log("\n══ Erstes Bild ══");
  for(const [was, art] of [["Schriftdienst hängt", "haengen"],
                           ["Schriftdienst abgewiesen", "abweisen"],
                           ["alles erreichbar", "durch"]]){
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
    const seite = await ctx.newPage();
    await seite.route("**/*", r => {
      const u = r.request().url();
      if(u.startsWith("file://")) return r.continue();
      if(/fonts\.(googleapis|gstatic)\.com/.test(u)){
        if(art === "haengen")  return new Promise(() => {});   /* nie antworten */
        if(art === "abweisen") return r.abort();
        return r.abort();          /* auch „durch" hat hier kein Netz */
      }
      return r.abort();
    });
    await seite.goto(ADRESSE, { waitUntil:"domcontentloaded" });
    await seite.waitForTimeout(900);
    const farbe = await seite.evaluate(() => {
      const f = performance.getEntriesByType("paint")
        .find(x => x.name === "first-contentful-paint");
      return Math.round((f || {}).startTime || -1);
    });
    const text = (await seite.textContent("h1")) || "";
    pruef(farbe >= 0 && farbe < GRENZE_MS,
      was.padEnd(26) + "erstes Bild unter " + GRENZE_MS + " ms",
      farbe + " ms");
    pruef(text.trim().length > 10, "  und die Überschrift steht schon da",
      text.trim().replace(/\s+/g," ").slice(0, 46));
    await ctx.close();
  }

  /* Kein blockierender Fremdlink mehr im Kopf — das ist die
     Ursache, nicht nur die Wirkung. */
  const quelle = fs.readFileSync(DATEI, "utf8");
  let kopf = quelle.slice(0, quelle.indexOf("</head>"));

  /* Was in <noscript> steht, blockiert nichts, was der Besucher
     sonst schon sähe — dort läuft ohnehin kein Skript, das etwas
     nachladen könnte. Also erst herausnehmen. */
  kopf = kopf.replace(/<noscript>[\s\S]*?<\/noscript>/gi, "");

  /* Und die Ereignisbehandlung ebenfalls. Die erste Fassung dieser
     Prüfung schlug hier Fehlalarm: Der ENTBLOCKTE Link trägt
     onload="this.onload=null;this.rel='stylesheet'" — der Regex fand
     das rel='stylesheet' IM Handler und meldete genau die Zeile als
     Fehler, die den Fehler behebt. Ein Werkzeug, das Fehlalarm
     schlägt, bringt einem bei, es zu übergehen (CLAUDE.md §8.2). */
  const ohneHandler = kopf.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
                          .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");

  const blockend = (ohneHandler.match(/<link\b[^>]*>/gi) || [])
    .filter(z => /\brel\s*=\s*["']?stylesheet["']?/i.test(z))
    .filter(z => /https?:\/\//i.test(z));

  pruef(blockend.length === 0,
    "kein blockierender Stilbogen aus fremdem Netz im Kopf",
    blockend.length ? blockend[0].replace(/\s+/g," ").slice(0, 70) : "keiner");

  /* ══ 2–5 · je Maß ══════════════════════════════════════════════ */
  for(const m of MASSE){
    const ctx = await browser.newContext({ viewport:{ width:m.width, height:m.height } });
    const seite = await ctx.newPage();
    const konsole = [];
    seite.on("pageerror", e => konsole.push(String(e).slice(0,150)));
    seite.on("console", x => { if(x.type() === "error") konsole.push(x.text().slice(0,150)); });
    await ohneNetz(seite);
    await seite.goto(ADRESSE);
    /* Weicher Bildlauf würde jede Messung um Hunderte Millisekunden
       verfälschen — hier wird gemessen, nicht zugesehen. */
    await seite.addStyleTag({ content:"html{scroll-behavior:auto !important}" });
    await seite.waitForTimeout(400);

    console.log("\n══ " + m.name + " " + m.width + "×" + m.height + " ══");

    /* ── 2 · Der laufende Schritt hat einen Namen ── */
    const halt = await seite.evaluate(() => {
      const e = document.getElementById("abendHalt");
      return e ? { oben:e.offsetTop, hoch:e.offsetHeight } : null;
    });
    if(!halt){
      pruef(false, "die angeheftete Erzählung ist da", "#abendHalt fehlt");
    } else {
      const anzahl = await seite.evaluate(() => document.querySelectorAll(".szene").length);
      const namenlos = [];
      for(let i = 0; i < anzahl; i++){
        const weg = halt.hoch - m.height;
        await seite.evaluate(y => scrollTo(0, y),
          halt.oben + weg * (i / (anzahl - 1)) + 4);
        await seite.waitForTimeout(420);
        const s = await seite.evaluate(() => {
          const k = document.querySelector('.stufe[aria-current="true"]');
          if(!k) return { fehlt:true };
          const sp = k.querySelector("span");
          if(!sp) return { fehlt:true };
          const r = sp.getBoundingClientRect();
          const l = k.parentElement.getBoundingClientRect();
          return {
            name: sp.textContent.trim(),
            /* Sichtbar heißt: nicht display:none, breiter als null,
               INNERHALB der Leiste (die waagerecht rollt) und im
               Bild. Jede dieser vier Bedingungen war schon einmal
               die, an der es scheiterte. */
            sichtbar: getComputedStyle(sp).display !== "none" && r.width > 4 &&
                      r.left >= l.left - 1 && r.right <= l.right + 1 &&
                      r.top >= 0 && r.bottom <= innerHeight
          };
        });
        if(s.fehlt || !s.sichtbar) namenlos.push(i + (s.name ? " (" + s.name + ")" : ""));
      }
      pruef(namenlos.length === 0,
        "der Name des laufenden Schritts steht im Bild",
        namenlos.length ? "namenlos bei Szene " + namenlos.join(", ")
                        : "alle " + anzahl + " Szenen benannt");
    }

    /* ── 3 · Beide Fenster ── */
    await seite.evaluate(() => scrollTo(0, 0));
    await seite.waitForTimeout(200);

    for(const [wie, oeffner, ruhig] of [
      ["Hub",   "[data-hub]",   "#hubfenster"],
      ["Board", "[data-board]", "#boardfenster"]
    ]){
      const vorher = await seite.evaluate(() => scrollY);
      const auf = await seite.evaluate(w => {
        const k = document.querySelector(w);
        if(!k) return false;
        k.click(); return true;
      }, oeffner);
      if(!auf){ pruef(false, wie + "-Fenster hat einen Öffner", oeffner + " fehlt"); continue; }
      await seite.waitForTimeout(600);
      pruef(await seite.isVisible(ruhig), wie + "-Fenster geht auf");
      pruef(await seite.evaluate(() => document.documentElement.classList.contains("starr")),
        "  die Seite dahinter steht still");

      /* Bedienen: irgendein Knopf im Fenster muss etwas tun, ohne
         die Konsole zu füllen. */
      const getan = await seite.evaluate(r => {
        const k = document.querySelector(r + " button:not([disabled]):not(.hub-zu)");
        if(!k) return "kein Knopf";
        k.click(); return "getippt";
      }, ruhig);
      pruef(getan === "getippt", "  und lässt sich bedienen", getan);

      await seite.keyboard.press("Escape");
      await seite.waitForTimeout(500);
      pruef(!(await seite.isVisible(ruhig)), "  Escape macht es zu");
      pruef(!(await seite.evaluate(() => document.documentElement.classList.contains("starr"))),
        "  und gibt die Seite frei");
      const rollt = await seite.evaluate(async v => {
        scrollTo(0, v + 500);
        await new Promise(r => setTimeout(r, 250));
        const da = scrollY > v + 100;
        scrollTo(0, v);
        return da;
      }, vorher);
      pruef(rollt, "  die Seite rollt danach messbar wieder");
    }

    /* ── 4 · Schiebt etwas seitlich? ── */
    await seite.evaluate(() => scrollTo(0, 0));
    const schub = await seite.evaluate(() => {
      const ueber = document.documentElement.scrollWidth -
                    document.documentElement.clientWidth;
      if(ueber <= 1) return { ueber:0 };
      /* Wer schiebt? Benennen, nicht nur melden. */
      let schuld = null, breit = 0;
      document.querySelectorAll("body *").forEach(el => {
        const r = el.getBoundingClientRect();
        if(r.right > document.documentElement.clientWidth + 1 && r.width > breit){
          breit = r.width; schuld = el;
        }
      });
      return { ueber, wer: schuld
        ? schuld.tagName.toLowerCase() + (schuld.id ? "#" + schuld.id : "") +
          (typeof schuld.className === "string" && schuld.className
            ? "." + schuld.className.trim().split(/\s+/).slice(0,2).join(".") : "") +
          " (" + Math.round(breit) + "px)"
        : "unbekannt" };
    });
    pruef(schub.ueber <= 1, "nichts schiebt seitlich",
      schub.ueber ? schub.ueber + "px durch " + schub.wer : "0px");

    /* ── 6 · Ohne Netz steht die Seite ── */
    const stand = await seite.evaluate(() => ({
      zeichen: document.body.innerText.replace(/\s+/g," ").trim().length,
      abschnitte: document.querySelectorAll("section, .abend").length,
      leere: [...document.querySelectorAll("img")].filter(i => !i.complete || !i.naturalWidth).length
    }));
    pruef(stand.zeichen > 3000 && stand.abschnitte >= 5,
      "ohne Netz steht die Seite vollständig",
      stand.zeichen + " Zeichen, " + stand.abschnitte + " Abschnitte");

    const echt = konsole.filter(z => !/net::ERR|Failed to load resource/i.test(z));
    pruef(echt.length === 0, "kein Fehler in der Konsole", echt[0] || "still");
    await ctx.close();
  }

  /* ══ Das Board-Fenster im Ablauf ═══════════════════════════════
     Nicht „geht auf und zu" — das steht oben. Hier geht es um den
     Handgriff aus Szene 3: Bestellung annehmen, Wartezeit zusagen.
     Ein Fenster, das nur aufgeht, zeigt nichts; eines, in dem der
     Ablauf wirklich läuft, ist das Verkaufsargument. */
  console.log("\n══ Das Board bedienen ══");
  const bCtx = await browser.newContext({ viewport:{ width:1440, height:900 } });
  const brett = await bCtx.newPage();
  await ohneNetz(brett);
  await brett.goto(ADRESSE);
  await brett.waitForTimeout(400);
  await brett.evaluate(() => document.querySelector("[data-board]").click());
  await brett.waitForTimeout(500);

  const an = await brett.$('[data-bon] [data-tun="an"]');
  pruef(!!an, "die neue Bestellung trägt ihren Handgriff bei sich");
  if(an){
    await an.click(); await brett.waitForTimeout(250);
    const zeiten = await brett.$$('[data-tun="zeit"]');
    pruef(zeiten.length >= 3, "nach dem Annehmen stehen die Wartezeiten da",
      zeiten.length + " Knöpfe");
    if(zeiten[1]){ await zeiten[1].click(); await brett.waitForTimeout(250); }
    const stand = await brett.textContent(".brett-stand").catch(() => "");
    pruef(/zugesagt/.test(stand || ""), "die Zusage steht am Bon",
      (stand || "").trim().slice(0, 46));
  }

  /* Alle drei Ansichten gefüllt — ein Reiter, der leer aufgeht, ist
     schlimmer als keiner. */
  for(const [a, was] of [["pass",".brett-spalten"], ["zahlen",".brett-zahl"],
                         ["bons",".brett-bon"]]){
    await brett.click('[data-ansicht="' + a + '"]');
    await brett.waitForTimeout(220);
    pruef(await brett.isVisible("#boardKoerper " + was), "„" + a + "“ ist gefüllt",
      (await brett.textContent("#boardWo")).trim());
  }
  /* Die Abbildung aus einer Szene muss die Ansicht DIESER Szene
     öffnen, nicht irgendeine. */
  await brett.keyboard.press("Escape");
  await brett.waitForTimeout(400);
  await brett.evaluate(() => document.querySelector('[data-board="zahlen"]').click());
  await brett.waitForTimeout(500);
  pruef(/Auswertung/.test(await brett.textContent("#boardWo")),
    "die Abbildung aus Szene 6 öffnet die Ansicht aus Szene 6",
    (await brett.textContent("#boardWo")).trim());
  /* Zwei modale Fenster übereinander wären zweimal html.starr und
     ein Schließer, der das falsche zumacht. */
  await brett.click("#boardZumHub");
  await brett.waitForTimeout(600);
  pruef(await brett.isVisible("#hubfenster") && !(await brett.isVisible("#boardfenster")),
    "der Wechsel ins Hub-Fenster schließt das Board, statt zu stapeln");
  await brett.keyboard.press("Escape");
  await brett.waitForTimeout(400);
  pruef(!(await brett.evaluate(() => document.documentElement.classList.contains("starr"))),
    "und danach steht die Seite nicht fest");
  await bCtx.close();

  /* ══ 5 · Reduzierte Bewegung ═══════════════════════════════════
     Wer das einstellt, hat einen Grund — Migräne, Schwindel,
     Reisekrankheit. Eine Endlos-Animation ist dann kein Zierrat
     mehr, sondern der Grund, die Seite zu schließen. */
  console.log("\n══ Reduzierte Bewegung ══");
  const ruheCtx = await browser.newContext({
    viewport:{ width:390, height:844 }, reducedMotion:"reduce" });
  const ruhe = await ruheCtx.newPage();
  await ohneNetz(ruhe);
  await ruhe.goto(ADRESSE);
  await ruhe.waitForTimeout(700);
  const laufend = await ruhe.evaluate(() => [...document.querySelectorAll("*")]
    .filter(el => {
      const s = getComputedStyle(el);
      return s.animationName !== "none" && s.animationIterationCount === "infinite";
    })
    .map(el => el.tagName.toLowerCase() +
      (typeof el.className === "string" && el.className
        ? "." + el.className.trim().split(/\s+/)[0] : "")));
  pruef(laufend.length === 0, "nichts läuft endlos",
    laufend.length ? [...new Set(laufend)].join(", ") : "still");
  /* Und der Inhalt muss trotzdem da sein — „auf"-Elemente werden
     ohne Animation aufgedeckt, nicht versteckt gelassen. */
  const versteckt = await ruhe.evaluate(() => [...document.querySelectorAll(".auf")]
    .filter(el => getComputedStyle(el).opacity === "0").length);
  pruef(versteckt === 0, "und trotzdem ist alles zu sehen",
    versteckt ? versteckt + " unsichtbare Blöcke" : "nichts verborgen");
  await ruheCtx.close();

  /* ══ 7 · Bewegung und Tiefe am Träger ══════════════════════════
     Vier Messungen, und jede misst das GEMALTE, nicht den Quelltext.
     Der Unterschied ist nicht theoretisch: `getComputedStyle().zIndex`
     hätte auch dann „1" gemeldet, wenn der Schatten weiter obenauf
     läge — die Regel ist nicht das Bild (Skill `bewegung` §6). */
  console.log("\n══ Bewegung und Tiefe am Träger ══");

  /* 7a · Der Schatten liegt unter dem Gegenstand.
     Zwei Breiten, weil derselbe Fehler bei 1440×900 einmal unsichtbar
     war und bei 900×1000 offensichtlich (CLAUDE.md §8.1e). Und zwei
     Zustände, weil er beim Heranfahren weiter nach unten reicht. */
  for(const vp of [{ w:390, h:844 }, { w:1280, h:900 }]){
    const tCtx = await browser.newContext({ viewport:{ width:vp.w, height:vp.h } });
    const t = await tCtx.newPage();
    await ohneNetz(t);
    await t.goto(ADRESSE);
    await t.waitForTimeout(1500);
    for(const heran of [false, true]){
      const r = await t.evaluate((heran) => {
        const pl = document.querySelector(".plinth");
        if(!pl) return null;
        pl.classList.toggle("heran", heran);
        const st = document.getElementById("deckel").getBoundingClientRect();
        const sc = document.querySelector(".tischschatten").getBoundingClientRect();
        const ueber = st.bottom - sc.top;
        if(ueber <= 0) return { ueber:0 };
        const el = document.elementFromPoint((st.left + st.right) / 2,
                     (Math.max(st.top, sc.top) + Math.min(st.bottom, sc.bottom)) / 2);
        return { ueber:+ueber.toFixed(1),
                 imDeckel: !!(el && el.closest("#deckel")),
                 treffer: el ? (el.id || (el.className.baseVal || el.className || "")
                                          .toString().trim().split(/\s+/)[0] || el.tagName)
                             : "nichts" };
      }, heran);
      /* „Keine Überlappung" wäre kein Beweis, sondern eine Probe, die
         den Fehler nicht treffen KANN (CLAUDE.md §8.1g). Deshalb ist
         sie hier ein Fehler und keine stille Ausnahme. */
      pruef(!!r && r.ueber > 0, vp.w + "px" + (heran ? " heran" : "      ") +
        " · Schatten und Gegenstand überlappen überhaupt",
        r ? r.ueber + " px" : "kein Modell");
      if(r && r.ueber > 0){
        pruef(r.imDeckel, vp.w + "px" + (heran ? " heran" : "      ") +
          " · in der Überlappung liegt der GEGENSTAND obenauf", r.treffer);
      }
    }

    /* 7b · Jede Zeile passt auf die A5-Fläche.
       Alle <text>, nicht nur die eine, die einmal herausragte —
       sonst prüft die Prüfung meinen Fund statt die Fläche. */
    const zeilen = await t.evaluate(() => {
      const svg = document.querySelector(".f-hoch");
      if(!svg) return null;
      const war = svg.hasAttribute("hidden");
      svg.removeAttribute("hidden");
      const vb = svg.getAttribute("viewBox").split(/\s+/).map(Number);
      const r = [...svg.querySelectorAll("text")].map(e => {
        const b = e.getBBox();
        return { text:e.textContent.trim(), x1:+b.x.toFixed(1),
                 x2:+(b.x + b.width).toFixed(1), drin: b.x >= vb[0] && b.x + b.width <= vb[0] + vb[2] };
      });
      if(war) svg.setAttribute("hidden", "");
      return { breite:vb[2], zeilen:r };
    });
    pruef(!!zeilen && zeilen.zeilen.length >= 3, vp.w + "px · die A5-Fläche trägt ihre Zeilen",
      zeilen ? zeilen.zeilen.length + " Zeilen" : "keine Fläche");
    if(zeilen) for(const z of zeilen.zeilen){
      pruef(z.drin, vp.w + "px · „" + z.text.slice(0, 26) + "“ passt in die Fläche",
        "x " + z.x1 + " … " + z.x2 + " von 0 … " + zeilen.breite);
    }
    await tCtx.close();
  }

  /* 7c · Keine Bewegung über ein Layout-Merkmal.
     Kommentare vorher weg: Ein Beispiel im Fließtext darf keinen
     Fehlalarm schlagen — ein Werkzeug, das das tut, bringt einem bei,
     es zu übergehen (CLAUDE.md §8.2). */
  const quelltext = fs.readFileSync(DATEI, "utf8");
  const stile = (quelltext.match(/<style[^>]*>[\s\S]*?<\/style>/g) || [])
    .join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const LAYOUT = ["width", "height", "top", "left", "right", "bottom", "margin", "padding"];
  const schuldig = [];
  for(const m of stile.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/g)){
    for(const teil of m[1].split(",")){
      const merkmal = teil.trim().split(/\s+/)[0];
      if(LAYOUT.includes(merkmal)) schuldig.push(merkmal + " in „" + teil.trim() + "“");
    }
  }
  pruef(schuldig.length === 0, "kein Übergang läuft über ein Layout-Merkmal",
    schuldig.length ? [...new Set(schuldig)].join(", ") : LAYOUT.length + " Merkmale geprüft");

  /* 7d · Die Antwort auf das Antippen.
     Gemessen wird das, was der Gast erlebt: vom Klick bis zum offenen
     Hub. Nicht die Zahl im Quelltext — zwischen dem Ende der Bewegung
     und dem offenen Fenster liegen noch Bildtakt und showModal.
     Grenze 500 ms: Der Skill `bewegung` §3 gibt einem ganzen Schirm
     320–500 ms. Einzüge (`animation … both`) und Pulse (`infinite`)
     sind hier ausdrücklich NICHT gemeint — die dürfen länger laufen,
     sie sind Vorführung und keine Bedienung. */
  const aCtx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const a = await aCtx.newPage();
  await ohneNetz(a);
  await a.goto(ADRESSE);
  await a.waitForTimeout(1500);
  const antwort = await a.evaluate(async () => {
    const f = document.getElementById("hubfenster");
    const t0 = performance.now();
    document.getElementById("deckel").click();
    await new Promise(res => {
      const i = setInterval(() => { if(f.open){ clearInterval(i); res(); } }, 4);
      setTimeout(() => { clearInterval(i); res(); }, 5000);
    });
    return { offen:f.open, ms:Math.round(performance.now() - t0) };
  });
  pruef(antwort.offen, "das Antippen öffnet den Hub");
  pruef(antwort.offen && antwort.ms <= 500,
    "und zwar innerhalb von 500 ms", antwort.ms + " ms");

  /* Der Schatten darf nicht vor dem Gegenstand ankommen: Er läuft
     mit, sonst löst er sich optisch vom Ding. */
  const paar = await a.evaluate(() => {
    const pl = document.querySelector(".plinth");
    pl.classList.add("heran");
    const d = getComputedStyle(document.querySelector(".tischschatten")).transitionDuration;
    return d.split(",").map(v => parseFloat(v) * (/ms/.test(v) ? 1 : 1000));
  });
  pruef(paar.every(v => v > 0 && v <= 500), "der Schatten läuft mit dem Gegenstand",
    paar.join(" / ") + " ms");

  /* Und die beiden Balken laufen wirklich über transform: Nach einem
     Bildlauf muss sich die Matrix ändern und die Breite NICHT. */
  await a.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  const balken = await a.evaluate(async () => {
    const b = document.getElementById("fortschritt");
    const vorher = { tf:getComputedStyle(b).transform, w:getComputedStyle(b).width };
    scrollTo(0, document.documentElement.scrollHeight / 2);
    await new Promise(r => setTimeout(r, 400));
    return { vorher, tf:getComputedStyle(b).transform, w:getComputedStyle(b).width };
  });
  pruef(balken.tf !== balken.vorher.tf && balken.w === balken.vorher.w,
    "der Fortschrittsbalken wächst über transform, nicht über width",
    balken.vorher.tf + " → " + balken.tf + ", Breite " + balken.w);
  await aCtx.close();

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
