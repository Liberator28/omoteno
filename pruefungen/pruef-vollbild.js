/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Board und Küche im Vollbild

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-vollbild.js

   Anlass: Ein Küchenschirm hängt an der Wand, ein Tresen-Tablet steht
   am Pass. Browserrahmen und Adresszeile sind dort Störungen. Geprüft
   wird, was man den Dateien NICHT ansieht:

   1 · GIBT ES DEN WEG ÜBERHAUPT? Der Admin hatte bis heute keinen
       Vollbildknopf. Gemessen bei 1280, 1920 und 2560: „NEIN".

   2 · WEISS DER KNOPF, OB ER AN IST? Chrome verlässt den Vollbildmodus
       bei Escape, und die Seite bekommt den Tastendruck trotzdem — ein
       Druck schließt also den Dialog UND wirft heraus. Verhindern kann
       das keine Seite. Was sie kann: sofort zeigen, dass sie draußen
       ist. Ohne fullscreenchange-Horcher ist der Knopf ein Schalter
       ohne Stellung.

   3 · WIRD DER SCHIRM GENUTZT? Gemessen: Bei 2560 px blieb main bei
       1280 px stehen — die Hälfte leer, und der Bereich, für den das
       Board im Vollbild hängt, hatte drei Kartenspalten statt sieben.

   4 · IST DER GETEILTE BLOCK GLEICH? Dieselbe Mechanik liegt in beiden
       Dateien. Zwei Fassungen, die auseinanderlaufen, sind schlimmer
       als eine schlechte.

   EHRLICHE GRENZE: Der kopflose Browser hat keinen Browserrahmen, den
   er verstecken könnte. Diese Prüfung misst die Fullscreen-API und das
   Verhalten der Seite — NICHT, wie Chrome am Tresen darauf reagiert.
   Der Escape-Fall aus 2 lässt sich hier nicht nachstellen; gemessen
   blieb der Vollbildmodus stehen. Deshalb hängt nichts hier daran.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const SEITEN = path.join(__dirname, "..", "seiten");
const BOARDS = [
  { name:"Admin-Board", datei:"admin.html", knopf:"vollbildKnopf",
    oeffnen: () => {
      document.getElementById("tor").hidden = true;
      if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); }
    } },
  { name:"Küchen-Board", datei:"kueche.html", knopf:"vollbildKnopf",
    oeffnen: () => {
      document.getElementById("tor").hidden = true;
      document.getElementById("schirm").hidden = false;
    } }
];
const MASSE = [
  { name:"Tresen-Tablet", w:1280, h:900  },
  { name:"Küchenschirm",  w:1920, h:1080 },
  { name:"Großer Schirm", w:2560, h:1440 }
];

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

/* ── 1 · Der geteilte Block, Zeichen für Zeichen ─────────────────── */
function bloeckeVergleichen(){
  console.log("\n══ Der geteilte Vollbild-Block ══");
  const marke = /\/\* ╔═══ VOLLBILD · GETEILTER BLOCK · ANFANG[\s\S]*?\/\* ╚═══ VOLLBILD · GETEILTER BLOCK · ENDE ═+╝ \*\//;
  const stuecke = BOARDS.map(b => {
    const t = fs.readFileSync(path.join(SEITEN, b.datei), "utf8").match(marke);
    return { name:b.datei, text: t ? t[0] : null };
  });
  const fehlend = stuecke.filter(x => !x.text);
  if(fehlend.length){
    fehlend.forEach(x => pruef(false, "Block fehlt in " + x.name));
    return;
  }
  pruef(stuecke[0].text === stuecke[1].text,
    "beide Fassungen sind wortgleich",
    stuecke[0].text.length + " Zeichen");
}

(async () => {
  for(const b of BOARDS){
    if(!fs.existsSync(path.join(SEITEN, b.datei))){
      console.log(b.datei + " fehlt."); process.exit(1);
    }
  }
  bloeckeVergleichen();

  const browser = await chromium.launch();
  for(const b of BOARDS){
    for(const m of MASSE){
      const ctx = await browser.newContext({ viewport:{ width:m.w, height:m.h } });
      const seite = await ctx.newPage();
      const konsole = [];
      /* Das Netz kappe ich gleich SELBST — dann meldet der Browser
         die geblockte Bibliothek als „Failed to load resource". Das
         ist mein eigener Aufbau und kein Befund. Wer ihn mitzählt,
         bringt sich bei, die Prüfung zu übergehen (§8.2).
         Gezählt wird deshalb nur, was das SKRIPT wirft. */
      const eigenerAufbau = t => /Failed to load resource|ERR_FAILED|ERR_BLOCKED/i.test(t);
      seite.on("pageerror", e => konsole.push(String(e).slice(0,110)));
      seite.on("console", x => {
        const t = x.text();
        if(x.type() === "error" && !eigenerAufbau(t)) konsole.push(t.slice(0,110));
      });
      /* Ohne Netz: Genau so hängt ein Küchenschirm, wenn das WLAN
         zickt — und genau dann darf nichts weiß werden. */
      await seite.route("**/*", r => r.request().url().startsWith("file://")
        ? r.continue() : r.abort());
      await seite.goto("file://" + path.join(SEITEN, b.datei));
      await seite.waitForTimeout(900);
      await seite.evaluate(b.oeffnen);
      await seite.waitForTimeout(400);

      /* Die Sperrschicht „Board noch nicht scharf" fängt jeden Tipp
         ab — genau dafür ist sie da. Weggeklickt wird sie wie von
         einem Menschen, nicht versteckt; denselben Weg geht schon
         pruef-board.js. Ohne das lief diese Prüfung in einen
         30-Sekunden-Zeitverzug statt in einen Befund. */
      const scharf = await seite.$("#scharfJetzt");
      if(scharf && await seite.isVisible("#scharf")){
        await scharf.click();
        await seite.waitForTimeout(300);
      }

      console.log("\n══ " + b.name + " · " + m.name + " " + m.w + "×" + m.h + " ══");

      /* 2 · Der Knopf ist da und sichtbar */
      const knopf = await seite.$("#" + b.knopf);
      const sichtbar = knopf ? await knopf.isVisible() : false;
      pruef(sichtbar, "Vollbildknopf ist da und sichtbar");

      if(sichtbar){
        /* 3 · Er schaltet — und der Zustand steht am Element */
        await knopf.click();
        await seite.waitForTimeout(350);
        const drin = await seite.evaluate(() => !!document.fullscreenElement);
        pruef(drin, "Klick führt ins Vollbild");
        const gedrueckt = await seite.getAttribute("#" + b.knopf, "aria-pressed");
        pruef(gedrueckt === "true",
          "der Knopf weiß, dass er an ist",
          "aria-pressed=" + gedrueckt);
        const beschriftung = await seite.getAttribute("#" + b.knopf, "aria-label");
        pruef(/verlassen/i.test(beschriftung || ""),
          "und sagt, was ein zweiter Druck tut", beschriftung);

        /* 4 · Im Vollbild ist alles noch da und nichts läuft über */
        const lage = await seite.evaluate(() => {
          const d = document.documentElement;
          return {
            quer: d.scrollWidth - d.clientWidth,
            fenster: d.clientWidth,
            main: document.querySelector("main")
              ? Math.round(document.querySelector("main").getBoundingClientRect().width) : null,
            bedienbar: document.querySelectorAll(
              "button:not([hidden]),a[href],input,select,textarea").length
          };
        });
        pruef(lage.quer <= 1, "nichts läuft waagerecht über",
          lage.quer > 1 ? lage.quer + " px" : "kein Überlauf");
        pruef(lage.bedienbar > 5, "die Bedienelemente sind noch da",
          lage.bedienbar + " Stück");

        /* 5 · Der Schirm wird genutzt. Nur dort, wo er groß genug ist,
           um überhaupt eine Frage zu sein. */
        if(lage.main !== null && m.w >= 1600){
          const anteil = Math.round(lage.main / lage.fenster * 100);
          pruef(anteil >= 85,
            "der große Schirm wird genutzt",
            "main " + lage.main + " px von " + lage.fenster + " (" + anteil + " %)");
        }

        /* 6 · Und wieder heraus, mit demselben Knopf */
        await seite.click("#" + b.knopf);
        await seite.waitForTimeout(350);
        const draussen = await seite.evaluate(() => !document.fullscreenElement);
        pruef(draussen, "derselbe Knopf führt wieder heraus");
        const wieder = await seite.getAttribute("#" + b.knopf, "aria-pressed");
        pruef(wieder === "false", "und stellt sich zurück", "aria-pressed=" + wieder);
      }

      pruef(konsole.length === 0, "kein Fehler in der Konsole",
        konsole.length ? konsole[0] : "still");
      await ctx.close();
    }
  }
  await browser.close();

  console.log(fehler ? "\n  " + fehler + " Fehler." : "\n  Alles sauber.");
  process.exit(fehler ? 1 : 0);
})();
