/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Figur des Hauses

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-figur.js

   Was hier geprüft wird und warum:

   1 · NICHTS RAGT HERAUS. Die Erdbeere hält Flasche, Zettel und
       Teller neben sich. Im ersten Entwurf lag die Frucht randbündig
       im Feld und die Flasche wurde abgeschnitten — auf dem Schirm
       sah es aus wie ein Zeichenfehler.

   2 · DIE VORGABE TRÄGT. Ein Markenblatt ohne avatar.figur muss den
       Untersetzer bekommen, nicht nichts. Und ein Tippfehler in
       figur muss den Erzeuger anhalten, statt wortlos den
       Untersetzer zu liefern.

   3 · KEIN EMOJI IM BESTELLPASS. Dort standen 🧾🍳🔔 — auf jedem
       Gerät ein anderes Bild, in dem Feld, auf das der wartende Gast
       am längsten schaut.

   4 · KONTRAST WIRD GERECHNET. Gemessen am fertigen Bild, weil
       Schürze und Flächen durchscheinend sein können und nur der
       Browser weiß, was darunter liegt. Tag und Abend.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

/* Vier verschiedene Orte, deshalb einzeln benannt statt ein HIER
   fuer alles: dist/ und der Erzeuger liegen in der Wurzel, das
   Geruest in vorlagen/, das Studio in seiten/, die Markenblaetter
   in markenblaetter/. */
const OBEN     = path.resolve(__dirname, "..");
const HIER     = OBEN;
const SEITEN   = path.join(OBEN, "seiten");
const VORLAGEN = path.join(OBEN, "vorlagen");
const BLAETTER = path.join(OBEN, "markenblaetter");
const ERZEUGER = path.join(OBEN, "erzeuger");
const BID  = "af095b14-d9ef-41f4-9b97-c4422b0de63f";
const MASSE = [
  { name: "iPhone SE", width: 390, height:  664 },
  { name: "iPhone 14", width: 390, height:  844 },
  { name: "iPad",      width: 820, height: 1180 },
  { name: "Rechner",   width: 1440, height: 900 }
];

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

function erzeugteHubs(){
  const ordner = path.join(HIER, "dist");
  if(!fs.existsSync(ordner)) return [];
  return fs.readdirSync(ordner)
    .filter(s => fs.existsSync(path.join(ordner, s, "index.html")))
    .sort();
}

async function verdrahten(seite){
  /* Auffangroute ZUERST: Playwright prüft die zuletzt registrierte
     Route zuerst. Andersherum schluckt sie alles. */
  await seite.addInitScript(() => {
    try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){}
  });
  await seite.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await seite.route("**/rest/v1/betriebe**", r =>
    r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"" }]) }));
}

/* ═══ Kontrast am fertigen Bild ═══════════════════════════════════ */
const MESSUNG = `
(() => {
  const zahl = t => (String(t).match(/[\\d.]+/g) || []).map(Number);
  const kanal = c => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
  const leucht = p => .2126*kanal(p[0]) + .7152*kanal(p[1]) + .0722*kanal(p[2]);
  const mischen = (oben, unten) => {
    const a = oben.length > 3 ? oben[3] : 1;
    return [0,1,2].map(i => Math.round(oben[i]*a + unten[i]*(1-a)));
  };
  function grundVon(el){
    const stapel = []; let k = el;
    while(k){
      const s = getComputedStyle(k);
      const b = zahl(s.backgroundColor);
      /* Bei SVG zählt die Füllung als Grund — die Schürze ist kein
         background, sondern ein fill. */
      const f = k.namespaceURI && k.namespaceURI.indexOf("svg") >= 0 ? zahl(s.fill) : [];
      const nimm = (b.length >= 3 && (b.length < 4 || b[3] > 0)) ? b
                 : (f.length >= 3 && (f.length < 4 || f[3] > 0)) ? f : null;
      if(nimm) stapel.push(nimm);
      if(nimm && (nimm.length === 3 || nimm[3] === 1)) break;
      k = k.parentElement;
    }
    let unten = stapel.pop() || [255,255,255];
    while(stapel.length) unten = mischen(stapel.pop(), unten);
    return unten;
  }
  function wert(vorne, grund){
    const v = mischen(vorne, grund), a = leucht(v), b = leucht(grund);
    return Math.round(((Math.max(a,b)+.05)/(Math.min(a,b)+.05))*100)/100;
  }
  const raus = [];

  /* NICHT mehr .f-erdbeere beim Namen: Seit es mehr als eine Figur
     gibt, wäre jede weitere hier ungeprüft mitgefahren. Gemessen wird,
     was gerade auf der Seite steht. */
  const figur = document.querySelector("svg.figur");
  /* Doppelt maskiert, weil dieser Text ein Template-Literal ist: \\b
     wird zu \b im Browser. Einfach geschrieben landete hier das
     Rückschritt-Zeichen, der Name blieb „figur f-erdbeere". */
  const name  = figur ? (figur.getAttribute("class") || "").replace(/.*\\bf-/, "") : "—";

  /* Der Buchstabe auf der Schürze: --band-text auf --band. */
  const mono = document.querySelector("svg.figur .mono");
  if(mono){
    const sch = document.querySelector("svg.figur .schuerze");
    raus.push({ name:name + " · Monogramm auf Schürze", gross:false,
      wert: wert(zahl(getComputedStyle(mono).fill),
                 zahl(getComputedStyle(sch).fill)) });
  }

  /* Die Knopfschrift auf der Hausfarbe — hier stand einmal fest Weiß. */
  const knopf = document.querySelector(".knopf:not(.zweit)");
  if(knopf){
    const s = getComputedStyle(knopf);
    raus.push({ name:"Knopfschrift auf Hauptfarbe", gross:false,
      wert: wert(zahl(s.color), grundVon(knopf)) });
  }

  /* Arme und Beine liegen auf dem Grund des Hauses, nicht auf der
     Frucht. Abends ist der fast schwarz. */
  const bein = document.querySelector("svg.figur .bein");
  if(bein){
    const seite = document.querySelector(".bpass") || document.body;
    raus.push({ name:name + " · Gliedmaßen auf Grund", gross:true,
      wert: wert(zahl(getComputedStyle(bein).stroke), grundVon(seite)) });
  }

  /* Der Körper gegen seinen Grund — sonst ist die Figur ein Fleck.
     Jede Figur nennt ihren Körper anders: frucht, leib, scheibe.

     ZWEI WEGE, EINE FRAGE. Eine Figur hebt sich von ihrem Grund
     entweder durch ihre FARBE ab (die rote Frucht, das braune Brot)
     oder durch ihren UMRISS (der Untersetzer ist eine helle Scheibe
     auf hellem Grund — das ist Absicht). Deshalb wird beides gerechnet
     und der BESSERE Wert zählt. Zwei frühere Fassungen dieser Zeile
     waren beide falsch: Wer nur die Füllung misst, meldet beim
     Untersetzer 1,10:1; wer nur den Umriss misst, meldet abends bei
     jeder Figur 1,3:1, weil eine dunkle Kontur auf dunklem Grund
     nichts trennen muss, solange der Körper selbst leuchtet.

     Und bewusst KEIN Grenzwert, ab dem umgeschaltet wird: Ein
     Grenzwert in einer Prüfung ist eine Lücke, die man nicht sieht
     (§5.2a). „Einer von beiden trägt" kommt ohne aus. */
  const koerper = document.querySelector("svg.figur .frucht, svg.figur .leib, svg.figur .scheibe");
  if(koerper){
    const seite = document.querySelector(".bpass") || document.body;
    const g  = grundVon(seite), cs = getComputedStyle(koerper);
    const wf = wert(zahl(cs.fill), g);
    const wu = (cs.stroke && cs.stroke !== "none") ? wert(zahl(cs.stroke), g) : 0;
    raus.push({ name:name + " · Körper oder Umriss auf Grund", gross:true,
      wert: Math.max(wf, wu),
      wie: (wf >= wu ? "Füllung " : "Umriss ") +
           Math.max(wf, wu).toFixed(2) + ", das andere " + Math.min(wf, wu).toFixed(2) });
  }
  return raus;
})()
`;

/* Liegt alles im Feld? getBBox() rechnet ohne Konturbreite, deshalb
   ein kleiner Spielraum. */
const RANDMESSUNG = `
(() => {
  return Array.prototype.map.call(document.querySelectorAll("svg.figur"), s => {
    const vb = s.viewBox.baseVal, b = s.getBBox();
    const pass = s.closest(".bpass");
    return { wo: pass ? pass.className : (s.getAttribute("class") || ""),
             links: Math.round((b.x - vb.x)*10)/10,
             oben:  Math.round((b.y - vb.y)*10)/10,
             rechts:Math.round((vb.x + vb.width  - b.x - b.width)*10)/10,
             unten: Math.round((vb.y + vb.height - b.y - b.height)*10)/10 };
  });
})()
`;

(async () => {
  const hubs = erzeugteHubs();
  if(!hubs.length){
    console.log("Kein erzeugter Hub in dist/. Erst „node erzeuger/erzeuge-hub.js --alle“ laufen lassen.");
    process.exit(1);
  }

  /* ───── 0 · Laufen Gerüst und Studio auseinander? ─────
     Es gibt bewusst kein Bauwerkzeug, geteilter Code wird kopiert.
     Eine Kopie ohne Wächter läuft irgendwann auseinander — dann
     gestaltet der Kunde im Studio eine andere Figur, als sein Gast
     im Hub bekommt. Deshalb Zeichen für Zeichen. */
  console.log("\n── Gerüst und Studio ──");
  {
    const hub    = fs.readFileSync(path.join(VORLAGEN, "hub.vorlage.html"), "utf8");
    const studio = fs.readFileSync(path.join(SEITEN, "marken-studio.html"), "utf8");
    const bloecke = [
      ["Zeichnung (JS)",
       /\/\* ╔═══ FIGUR · GETEILTER BLOCK · ANFANG[\s\S]*?\/\* ╚═══ FIGUR · GETEILTER BLOCK · ENDE ═+╝ \*\//],
      ["Farben (CSS)",
       /\/\* ╔═══ FIGUR · GETEILTER BLOCK \(CSS\) · ANFANG[\s\S]*?\/\* ╚═══ FIGUR · GETEILTER BLOCK \(CSS\) · ENDE ═+╝ \*\//]
    ];
    for(const [name, muster] of bloecke){
      const a = hub.match(muster), b = studio.match(muster);
      if(!a || !b){
        pruef(false, name + ": Block fehlt in " + (!a ? "hub.vorlage.html" : "marken-studio.html"));
        continue;
      }
      const gleich = a[0] === b[0];
      let wo = "";
      if(!gleich){
        const za = a[0].split("\n"), zb = b[0].split("\n");
        for(let i = 0; i < Math.max(za.length, zb.length); i++)
          if(za[i] !== zb[i]){ wo = "erste Abweichung in Zeile " + (i+1) + " des Blocks"; break; }
      }
      pruef(gleich, name + ": Gerüst und Studio sind wortgleich",
        gleich ? a[0].split("\n").length + " Zeilen" : wo);
    }
  }

  /* ───── 0b · Trägt eine Klasse des Blocks einen fremden Namen? ─────
     Vorfall. Die fünf Blätter der Erdbeerkrone hießen .blatt. Im
     Studio heißt das Einstellblatt AUCH .blatt, und dessen Regel setzt
     transform:translateY(92dvh − --sicht) — SVG erbt CSS-transform
     genauso wie HTML. Gemessen bei 900×1000: Die Krone stand 824
     Einheiten tiefer und 672 links, die Zeichnung ragte von x −672,5
     bis 793,7 statt 1…120,6. Die Erdbeere hatte im Studio keine Krone.

     Das ist §1.1 in seiner teuersten Form: Der besetzte Name lag in
     der ANDEREN Datei, in die der Block kopiert wird. Ein Blick in die
     eigene Datei hätte nichts gefunden. Deshalb prüft das hier für
     JEDE Datei und JEDE Klasse des Blocks — nicht für die eine, die
     einmal wehgetan hat. */
  console.log("\n── Namen des geteilten Blocks ──");
  {
    const hub    = fs.readFileSync(path.join(VORLAGEN, "hub.vorlage.html"), "utf8");
    const studio = fs.readFileSync(path.join(SEITEN, "marken-studio.html"), "utf8");
    const a = hub.indexOf("/* ╔═══ FIGUR · GETEILTER BLOCK · ANFANG");
    const b = hub.indexOf("FIGUR · GETEILTER BLOCK · ENDE", a);
    const namen = [...new Set([...hub.slice(a, b).matchAll(/class="([a-zA-Z0-9 _-]+)"/g)]
      .flatMap(m => m[1].split(/\s+/)).filter(Boolean))]
      .filter(n => n !== "figur" && !/^f-/.test(n)).sort();
    pruef(namen.length > 10, "Klassen im Block gefunden", namen.length + ": " + namen.join(" "));

    for(const [wo, text] of [["Gerüst", hub], ["Studio", studio]]){
      const css = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join("\n");
      /* GANZE Selektoren lesen, nicht Ausschnitte. Meine erste Fassung
         suchte je Klasse ein Muster und bekam bei ".figur .auge{" den
         Treffer " .auge{" — der Vorfahre lag VOR dem Fund und fiel aus
         der Prüfung „gehört zur Figur?" heraus. Zwei Fehlalarme, und
         genau die machen ein Werkzeug wertlos (§8.2). Deshalb wird die
         Regel zerlegt: alles vor der Klammer ist die Selektorliste,
         Komma trennt die einzelnen. */
      const treffer = [];
      const ohneKommentar = css.replace(/\/\*[\s\S]*?\*\//g, "");
      for(const teil of ohneKommentar.split("}")){
        const k = teil.indexOf("{");
        if(k < 0) continue;
        for(const sel of teil.slice(0, k).split(",")){
          const s = sel.trim();
          if(!s || s.startsWith("@")) continue;
          /* Alles, was irgendwo .figur oder .f-… nennt, ist die Figur
             selbst und damit keine Kollision. */
          if(/\.figur\b|\.f-/.test(s)) continue;
          /* NUR das linkeste Glied. Eine Regel wie ".guss .kante" trifft
             unsere .kante nur, wenn sie IN einem .guss liegt — das tut
             sie nie. Wer solche Selektoren mitzählt, meldet Kollisionen,
             die keine sind. Gezählt wird deshalb, was OHNE Vorfahren
             greift: ".blatt", ".guss", ".hub,.blatt,…".

             Die Grenze dazu, ausdrücklich: Ein Selektor mit einem
             Vorfahren, der ohnehin alles umfasst (body .blatt), rutscht
             hier durch. Das ist keine Lücke, solange man sie nennt —
             und die Folge davon fangen die Messungen am gezeichneten
             Bild (Überlauf, schwarze Fläche, Kontrast). */
          const erstes = s.split(/[\s>+~]+/)[0];
          for(const n of namen)
            if(new RegExp("(^|[(])\\." + n + "(?![\\w-])").test(erstes))
              treffer.push(n + " ← \"" + s + "\"");
        }
      }
      pruef(treffer.length === 0, wo + ": kein Name des Blocks ist dort schon vergeben",
        treffer[0] || namen.length + " Namen geprüft");
    }
  }

  /* ───── 1 · Der Erzeuger hält bei unbekannter Figur an ───── */
  console.log("\n── Erzeuger ──");
  {
    const quelle = hubs.map(s => path.join(BLAETTER, s + ".json")).filter(fs.existsSync)[0];
    if(!quelle){
      pruef(false, "kein Markenblatt zum Prüfen gefunden");
    } else {
      const mb = JSON.parse(fs.readFileSync(quelle, "utf8"));
      /* Der Pruefling muss dorthin, wo der Erzeuger seine Blaetter
     sucht - sonst findet er ihn nicht und die Pruefung misst
     einen Fehler, den es gar nicht gibt. */
    const probe = path.join(BLAETTER, "pruefling.json");
      try {
        /* unbekannter Wert → Fehler, nichts wird geschrieben */
        mb.betrieb.slug = "pruefling";
        mb.avatar = Object.assign({}, mb.avatar, { figur: "banane" });
        fs.writeFileSync(probe, JSON.stringify(mb));
        let hielt = false, meldung = "";
        try { execFileSync("node", [path.join(ERZEUGER, "erzeuge-hub.js"),
                 "pruefling", "--pruefen-nur"],
                { cwd: OBEN, encoding: "utf8", stdio: "pipe" }); }
        catch(e){ hielt = true; meldung = String(e.stdout || "") + String(e.stderr || ""); }
        pruef(hielt && /figur unbekannt/.test(meldung),
          "unbekannte Figur hält den Erzeuger an", meldung.trim().split("\n").pop());

        /* ganz ohne figur → läuft durch */
        delete mb.avatar.figur;
        fs.writeFileSync(probe, JSON.stringify(mb));
        let lief = true;
        try { execFileSync("node", [path.join(ERZEUGER, "erzeuge-hub.js"),
                 "pruefling", "--pruefen-nur"],
                { cwd: OBEN, encoding: "utf8", stdio: "pipe" }); }
        catch(e){ lief = false; }
        pruef(lief, "Markenblatt ohne figur läuft weiter");

        /* ZWEITE QUELLE (§8.1b). Die Positivliste des Erzeugers gegen
           die Figuren im Gerüst zu halten, ist der einzige Weg, eine
           FEHLENDE Zeile zu finden — über eine Liste, die es nicht
           gibt, iteriert keine Schleife. Bis Block 6 stand im Erzeuger
           ["untersetzer","erdbeere"] von Hand: Eine dritte Figur hätte
           der Kunde im Studio gewählt und seinen Hub nicht bekommen. */
        const geruest = fs.readFileSync(path.join(VORLAGEN, "hub.vorlage.html"), "utf8");
        const tabelle = geruest.match(/const AVATAR_FIGUREN = \{([\s\S]*?)\n\};/);
        const figuren = tabelle
          ? [...tabelle[1].matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm)].map(m => m[1])
          : [];
        pruef(figuren.length >= 2, "Figuren im Gerüst gefunden", figuren.join(", "));
        for(const f of figuren){
          mb.avatar = Object.assign({}, mb.avatar, { figur: f });
          fs.writeFileSync(probe, JSON.stringify(mb));
          let ok = true, sagt = "";
          try { execFileSync("node", [path.join(ERZEUGER, "erzeuge-hub.js"),
                   "pruefling", "--pruefen-nur"],
                  { cwd: OBEN, encoding: "utf8", stdio: "pipe" }); }
          catch(e){ ok = false; sagt = String(e.stdout || "") + String(e.stderr || ""); }
          pruef(ok, "der Erzeuger kennt die Figur „" + f + "“",
            ok ? "" : sagt.trim().split("\n").pop());
        }
      } finally {
        if(fs.existsSync(probe)) fs.unlinkSync(probe);
        const raus = path.join(HIER, "dist", "pruefling");
        if(fs.existsSync(raus)) fs.rmSync(raus, { recursive:true, force:true });
      }
    }
  }

  const browser = await chromium.launch();

  /* ───── 2 · Jedes Haus: Figur, Züge, Ränder, Bestellpass ───── */
  for(const slug of hubs){
    const datei = "file://" + path.join(HIER, "dist", slug, "index.html");

    for(const [phase, stunde] of [["Tag", 14], ["Abend", 22]]){
      const ctx = await browser.newContext({ viewport: MASSE[1] });
      const seite = await ctx.newPage();
      await verdrahten(seite);
      await seite.goto(datei);
      await seite.waitForTimeout(400);
      await seite.evaluate(h => { stunde = h; nachtSchalten(); }, stunde);

      const figur = await seite.evaluate(() => avatarFigur());
      console.log("\n── " + slug + " · " + phase + " · Figur: " + figur + " ──");

      /* alle drei Züge und alle Haltungen nebeneinander bauen */
      await seite.evaluate(() => {
        const wk = document.querySelector(".willkommen"); if(wk) wk.remove();
        const posen = ["neu","arbeit","fertig"];
        let h = '<div class="seite">' + posen.map(s => phaseHTML(s, 217)).join("");
        ["freundlich","ruhig","witzig"].forEach(a => {
          MARKENBLATT.avatar = Object.assign({}, MARKENBLATT.avatar, { art:a });
          h += begleiterHTML("start");
        });
        h += '<a class="knopf" href="#/">Knopf zur Messung</a>';
        document.getElementById("inhalt").innerHTML = h + '</div>';
      });
      await seite.waitForTimeout(300);

      const paesse = await seite.$$(".bpass");
      pruef(paesse.length === 3, "drei Phasen gezeichnet", "n=" + paesse.length);

      const text = await seite.textContent("#inhalt");
      const emoji = (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [])
        .filter(z => "✓✕★".indexOf(z) < 0);
      pruef(emoji.length === 0, "kein Emoji im Bestellpass", emoji.join(" ") || "keins");

      const zeichen = await seite.$$(".bp-zeichen svg");
      pruef(zeichen.length === 3, "jede Phase hat ein gezeichnetes Bild",
        "n=" + zeichen.length);

      const raender = await seite.evaluate(RANDMESSUNG);
      const eng = raender.filter(r => Math.min(r.links, r.oben, r.rechts, r.unten) < -2);
      pruef(eng.length === 0, "nichts ragt aus dem Feld",
        eng.length ? JSON.stringify(eng[0]) : raender.length + " Figuren geprüft");

      for(const w of await seite.evaluate(MESSUNG)){
        const grenze = w.gross ? 3 : 4.5;
        pruef(w.wert >= grenze,
          w.name.padEnd(38) + w.wert.toFixed(2) + ":1",
          w.wie || ("mind. " + grenze));
      }

      /* JEDE Figur auf dem echten Bestellpass, nicht nur die, die das
         Haus gewählt hat. Sonst käme eine neue Figur erst beim ersten
         Kunden ans Licht, der sie nimmt. Hier ist der richtige Ort für
         den Kontrast: Die Datei hat ihre Tageszeit selbst geschaltet,
         und die Figur steht auf der Karte, auf der sie im Betrieb
         steht — nicht auf einer Fläche, die die Prüfung sich baut. */
      const figuren = await seite.evaluate(() => Object.keys(AVATAR_FIGUREN));
      for(const fk of figuren){
        await seite.evaluate(f => {
          MARKENBLATT.avatar = Object.assign({}, MARKENBLATT.avatar,
            { figur:f, art:"freundlich" });
          document.getElementById("inhalt").innerHTML =
            '<div class="seite">' + phaseHTML("arbeit", 217) + begleiterHTML("start") + '</div>';
        }, fk);
        await seite.waitForTimeout(120);
        for(const w of await seite.evaluate(MESSUNG)){
          const grenze = w.gross ? 3 : 4.5;
          pruef(w.wert >= grenze,
            w.name.padEnd(38) + w.wert.toFixed(2) + ":1",
            w.wie || ("mind. " + grenze));
        }
      }
      await ctx.close();
    }
  }

  /* ───── 2b · JEDE Figur, in BEIDEN Dateien ─────
     Vorher prüfte dieser Lauf `.f-erdbeere` beim Namen — eine dritte
     Figur wäre ungeprüft mitgefahren. Und er prüfte nur den Hub. Der
     Anlassfall: Die Grundregeln des Zeichensatzes standen im Gerüst
     AUSSERHALB des geteilten Blocks und im Studio gar nicht. Ohne
     Regel füllt SVG mit Schwarz — der Untersetzer war im Studio ein
     schwarzer Fleck, der Mund der Erdbeere eine gefüllte Sichel.
     Der Blockvergleich oben konnte das nicht sehen: Beide Blöcke
     waren ja gleich. Was ZWISCHEN den Blöcken fehlt, findet nur eine
     Messung am gezeichneten Bild, und zwar in JEDER Datei (§8.1a). */
  console.log("\n── Jede Figur, in beiden Dateien ──");
  {
    const orte = [
      { name: "Hub",    datei: "file://" + path.join(HIER, "dist", hubs[0], "index.html"),
        wirt: "#inhalt" },
      /* ZWEI Schirme für das Studio. Meine erste Fassung fuhr nur
         1440×900 — und genau dort hat das Einstellblatt kein
         transform, weil die breite Fassung es als Seitenspalte legt.
         Der Blattfehler oben war bei 1440 unsichtbar und bei 900
         offensichtlich. Ein Schirm ist keine Messung (§8.1d). */
      { name: "Studio breit", datei: "file://" + path.join(SEITEN, "marken-studio.html"),
        wirt: "#figurschau", masse: MASSE[3] },
      { name: "Studio schmal", datei: "file://" + path.join(SEITEN, "marken-studio.html"),
        wirt: "#figurschau", masse: { width: 900, height: 1000 } }
    ];
    for(const ort of orte){
      const ctx = await browser.newContext({ viewport: ort.masse || MASSE[3] });
      const seite = await ctx.newPage();
      const skriptfehler = [];
      seite.on("pageerror", e => skriptfehler.push(String(e)));
      await verdrahten(seite);
      await seite.goto(ort.datei);
      await seite.waitForTimeout(600);

      for(const phase of ["tag", "abend"]){
        const fund = await seite.evaluate(({ wirt, phase }) => {
          const host = document.querySelector(wirt) || document.body;
          const wk = document.querySelector(".willkommen"); if(wk) wk.remove();
          /* DIE TAGESZEIT GEHÖRT DORTHIN, WO DIE DATEI SIE HAT. Im Hub
             an den body — nachtSchalten() setzt Palette UND data-phase.
             Im Studio an den Vorschaukasten, genau wie figurZeichnen().
             Meine erste Fassung setzte data-phase im Hub auf #inhalt:
             Dann stand --glied auf Abend, während der Grund noch Tag
             war, und die Kontrastwerte waren erfunden (§2.3b). */
          if(typeof nachtSchalten === "function"){
            stunde = phase === "abend" ? 22 : 14;
            nachtSchalten();
          } else if(typeof markeAnwenden === "function" && typeof M === "object"){
            markeAnwenden(host, M, phase === "abend");
            host.setAttribute("data-phase", phase);
          }

          const zahl = t => (String(t).match(/[\d.]+/g) || []).map(Number);
          const kanal = c => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
          const leucht = p => .2126*kanal(p[0]) + .7152*kanal(p[1]) + .0722*kanal(p[2]);
          const mischen = (o, u) => { const a = o.length > 3 ? o[3] : 1;
            return [0,1,2].map(i => Math.round(o[i]*a + u[i]*(1-a))); };
          function grundVon(el){
            const st = []; let k = el;
            while(k){
              const s = getComputedStyle(k);
              const b = zahl(s.backgroundColor);
              const f = k.namespaceURI && k.namespaceURI.indexOf("svg") >= 0 ? zahl(s.fill) : [];
              const n = (b.length >= 3 && (b.length < 4 || b[3] > 0)) ? b
                      : (f.length >= 3 && (f.length < 4 || f[3] > 0)) ? f : null;
              if(n) st.push(n);
              if(n && (n.length === 3 || n[3] === 1)) break;
              k = k.parentElement;
            }
            let u = st.pop() || [255,255,255];
            while(st.length) u = mischen(st.pop(), u);
            return u;
          }
          const wert = (v, g) => { const m = mischen(v, g), a = leucht(m), b = leucht(g);
            return Math.round(((Math.max(a,b)+.05)/(Math.min(a,b)+.05))*100)/100; };

          /* KEIN Kontrast hier. Der gehört in Abschnitt 2, wo die
             Figur auf dem echten Bestellpass steht und die Datei ihre
             Tageszeit selbst schaltet. Meine erste Fassung maß den
             Grund am Elternknoten — im Studio war das die dunkle Hülle
             des Werkzeugs, nicht die Fläche des Kunden, und im Hub ein
             fester dunkler Kasten. Beide Male erfundene Zahlen. */
          const raus = { schwarz: [], ueber: [], figuren: [] };
          for(const fk of Object.keys(AVATAR_FIGUREN)){
            raus.figuren.push(fk);
            for(const pose of ["winken","zettel","giessen","teller"])
              for(const zug of ["freundlich","ruhig","witzig"]){
                host.innerHTML = figurSVG(200, fk, zug, "Choco Lamour", pose);
                const svg = host.querySelector("svg.figur");
                const wo = fk + "/" + pose + "/" + zug;

                /* a · Keine schwarze Fläche. In diesem Zeichensatz ist
                   keine Farbe reines Schwarz — --tinte ist bei Choco
                   rgb(42,26,20). Wer hier 0,0,0 misst, misst eine Regel,
                   die es nicht gibt. */
                /* NUR bemalte Formen. Ein <g> trägt per Vorgabe
                   fill:rgb(0,0,0) und malt trotzdem nichts — meine
                   erste Fassung meldete daraus 180 Fehlalarme. Ein
                   Werkzeug, das Fehlalarme schlägt, bringt einem bei,
                   es zu übergehen (§8.2). */
                const FORMEN = "path,circle,ellipse,rect,line,polygon,polyline,text";
                for(const el of svg.querySelectorAll(FORMEN)){
                  const s = getComputedStyle(el);
                  if(s.fill === "rgb(0, 0, 0)" || s.stroke === "rgb(0, 0, 0)")
                    raus.schwarz.push(wo + " · " + (el.getAttribute("class") || el.tagName) +
                      " (fill " + s.fill + ", stroke " + s.stroke + ")");
                }

                /* b · Nichts ragt aus dem Feld. getBBox rechnet ohne
                   Konturbreite, deshalb 1,6 Einheiten Spielraum. */
                const vb = svg.viewBox.baseVal, bb = svg.getBBox();
                if(bb.x < vb.x-1.6 || bb.y < vb.y-1.6 ||
                   bb.x+bb.width  > vb.x+vb.width +1.6 ||
                   bb.y+bb.height > vb.y+vb.height+1.6)
                  raus.ueber.push(wo + "  x " + bb.x.toFixed(1) + "…" +
                    (bb.x+bb.width).toFixed(1) + "  y " + bb.y.toFixed(1) + "…" +
                    (bb.y+bb.height).toFixed(1) + "  Feld " + vb.width + "×" + vb.height);

              }
          }
          return raus;
        }, { wirt: ort.wirt, phase });

        const kopf = ort.name + " · " + (phase === "abend" ? "Abend" : "Tag");
        pruef(fund.schwarz.length === 0, kopf + ": keine schwarze Fläche",
          fund.schwarz.length ? fund.schwarz.length + "× — " + fund.schwarz[0]
                              : fund.figuren.length + " Figuren × 12 Fassungen");
        pruef(fund.ueber.length === 0, kopf + ": nichts ragt aus dem Feld",
          fund.ueber[0] || "alle im Feld");
      }
      pruef(skriptfehler.length === 0, ort.name + ": kein Skriptfehler",
        skriptfehler[0] || "keiner");
      await ctx.close();
    }
  }

  /* ───── 2c · Gehört die Schürze dem HAUS? ─────
     Der Gegenbeweis hat hier eine Lücke aufgedeckt, die ich sonst
     übersehen hätte: Ersetzt man var(--band) durch eine feste Farbe,
     blieb die ganze Prüfung GRÜN. Der Kontrast Monogramm/Schürze
     stimmte ja weiterhin — nur eben bei jedem Haus derselbe.

     Kontrast beantwortet „ist es lesbar", nicht „ist es seins". Für
     die zweite Frage braucht es eine zweite Quelle (§8.1b): zwei
     Häuser mit verschiedenen Bandfarben, dieselbe Figur, und die
     Schürzen müssen sich unterscheiden. */
  if(hubs.length >= 2){
    console.log("\n── Die Schürze gehört dem Haus ──");
    const gemessen = {};
    for(const slug of hubs.slice(0, 2)){
      const ctx = await browser.newContext({ viewport: MASSE[1] });
      const seite = await ctx.newPage();
      await verdrahten(seite);
      await seite.goto("file://" + path.join(HIER, "dist", slug, "index.html"));
      await seite.waitForTimeout(400);
      gemessen[slug] = await seite.evaluate(() => {
        const wk = document.querySelector(".willkommen"); if(wk) wk.remove();
        const raus = {};
        for(const fk of Object.keys(AVATAR_FIGUREN)){
          document.getElementById("inhalt").innerHTML =
            figurSVG(200, fk, "freundlich", "Probe", "winken");
          const sch = document.querySelector("svg.figur .schuerze");
          const mono = document.querySelector("svg.figur .mono");
          /* GETRENNT, nicht als ein Schlüssel. Meine erste Fassung
             verglich „Schürze / Monogramm" am Stück — und blieb beim
             Gegenbeweis grün, weil die feste Schürze zwar überall
             gleich war, das Monogramm aber weiter dem Haus gehörte.
             Ein zusammengesetzter Wert versteckt, welche Hälfte
             stimmt. */
          if(sch) raus[fk] = {
            schuerze: getComputedStyle(sch).fill,
            mono: mono ? getComputedStyle(mono).fill : "—" };
        }
        return raus;
      });
      await ctx.close();
    }
    const [a, b] = hubs.slice(0, 2);
    const traeger = Object.keys(gemessen[a]);
    pruef(traeger.length > 0, "Figuren mit Schürze gefunden", traeger.join(", "));
    for(const fk of traeger)
      for(const teil of ["schuerze", "mono"])
        pruef(gemessen[a][fk][teil] !== gemessen[b][fk][teil],
          fk + " · " + (teil === "mono" ? "Monogramm" : "Schürze") +
          " trägt die Farbe des Hauses",
          a + " " + gemessen[a][fk][teil] + "  ≠  " + b + " " + gemessen[b][fk][teil]);
  } else {
    pruef(false, "zweites Haus zum Vergleich fehlt — Schürze ungeprüft");
  }

  /* ───── 3 · Maße ───── */
  console.log("\n── Maße ──");
  for(const m of MASSE){
    const ctx = await browser.newContext({ viewport: m });
    const seite = await ctx.newPage();
    await verdrahten(seite);
    await seite.goto("file://" + path.join(HIER, "dist", hubs[0], "index.html"));
    await seite.waitForTimeout(400);
    await seite.evaluate(() => {
      const wk = document.querySelector(".willkommen"); if(wk) wk.remove();
      document.getElementById("inhalt").innerHTML = '<div class="seite">' +
        ["neu","arbeit","fertig"].map(s => phaseHTML(s, 217)).join("") + '</div>';
    });
    await seite.waitForTimeout(300);
    const ueber = await seite.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(ueber <= 1, m.name + ": kein seitliches Schieben", "Überstand " + ueber + "px");
    await ctx.close();
  }

  /* ───── 4 · Bewegung reduzieren ───── */
  console.log("\n── prefers-reduced-motion ──");
  {
    const ctx = await browser.newContext({ viewport: MASSE[1], reducedMotion: "reduce" });
    const seite = await ctx.newPage();
    await verdrahten(seite);
    await seite.goto("file://" + path.join(HIER, "dist", hubs[0], "index.html"));
    await seite.waitForTimeout(400);
    await seite.evaluate(() => {
      const wk = document.querySelector(".willkommen"); if(wk) wk.remove();
      document.getElementById("inhalt").innerHTML = '<div class="seite">' +
        ["neu","arbeit","fertig"].map(s => phaseHTML(s, 217)).join("") + '</div>';
    });
    await seite.waitForTimeout(300);
    const laeuft = await seite.evaluate(() =>
      Array.prototype.filter.call(
        document.querySelectorAll(".bpass *"),
        el => getComputedStyle(el).animationIterationCount === "infinite" &&
              getComputedStyle(el).animationName !== "none"
      ).map(el => el.getAttribute("class") || el.tagName));
    pruef(laeuft.length === 0, "nichts läuft endlos", laeuft.join(", ") || "keins");
    /* Die HALTUNG muss bleiben — sie trägt die Phase, nicht die Bewegung. */
    const sichtbar = await seite.$$(".bp-zeichen svg");
    pruef(sichtbar.length === 3, "die Haltungen stehen trotzdem");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
