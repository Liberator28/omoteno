/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Kopfband-Schmuck (Guss / Laternen)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-kopfband.js

   Auftrag: Der Schokoladenguss unter dem Kopfband passt zu keinem
   Haus, das keine Schokolade verkauft. minhkeey (Asia Streetfood)
   bekommt stattdessen eine Reihe Papierlaternen — auf Wunsch, ohne
   Farbe zu erfinden (--gold = akzent2 des Hauses).

   Beide Bänder stehen fertig im Auszeichnungstext jedes Hubs; welches
   sichtbar ist, entscheidet kopfbandSetzen() zur Laufzeit anhand
   MARKENBLATT.kopfband — "laternen" schaltet um, alles andere
   (auch ein fehlendes Feld) bleibt beim Guss. Genau das wird hier
   gemessen, nicht angenommen.

   Gegenbeweis gefahren: markenblaetter/minhkeey.json testweise auf
   kopfband:"guss" gesetzt, neu erzeugt — die Prüfung wurde an genau
   den beiden Zusicherungen für minhkeey rot. Zurückgenommen → grün.

   Erweitert um Wind-Schwingen, Innenglühen, Tempelbalken: Jede Laterne
   trägt jetzt eine verschachtelte .schwung-Ebene (Dauerrotation) und
   eine .gluehen-Ellipse (Dauer-Opazität), beide per --schwungversatz/
   --gluehversatz je Laterne entkoppelt. Geprüft wird hier zusätzlich:
   reduzierte Bewegung friert BEIDE neuen Ebenen im richtigen
   Endzustand ein (nicht nur die bestehende .laterne-Klasse), und die
   Streuung wirkt wirklich — zwei Laternen zur selben Zeit tragen
   unterschiedliche transform-Werte, nicht nur irgendeine Rotation.

   Gegenbeweis für die Erweiterung: --schwungversatz aus dem CSS
   entfernt (testweise `calc(var(--schwungversatz,0s) * -1)` durch
   `0s` ersetzt) → die Desync-Zusicherung wurde rot (alle sieben
   Laternen trugen denselben transform-Wert). Zurückgenommen → grün.
   Für die reduzierte Bewegung: `.laternen .schwung{animation:none;
   transform:none}` testweise entfernt → genau diese Zusicherung wurde
   rot (transform blieb "matrix(...)" statt "none"). Zurückgenommen →
   grün.

   Erweitert um Balken/Laterne als echte Bilder (1:1 aus Referenzbild
   übernommen statt gezeichnet): Die Laternen haben jetzt ein eigenes
   Seitenverhältnis und wachsen mit der Kartenbreite — ohne Freiraum
   unter dem Kopfband hätte die Quaste in die erste Karte gehangen
   (genau beobachtet, dann behoben: html.hat-laternen main{margin-top}).
   Geprüft wird hier, dass dieser Freiraum wirklich da ist (kein
   Überlapp) — UND dass er bei den Guss-Häusern NICHT dazukommt (kein
   unnötiger Leerraum, wo der Guss ohnehin kurz bleibt).

   Gegenbeweis: `html.hat-laternen main{margin-top:150px}` testweise
   auf `0px` gesetzt → die Überlapp-Zusicherung wurde rot (Laternen-
   Unterkante lag unterhalb der main-Oberkante). Zurückgenommen → grün.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

(async () => {
  const browser = await chromium.launch();

  for (const [haus, erwartetGuss, erwartetLaternen] of [
    ["chocolamour", false, true],
    ["blend", false, true],
    ["minhkeey", true, false],
  ]) {
    const seite = await (await browser.newContext()).newPage();
    const konsole = [];
    seite.on("pageerror", e => konsole.push(String(e)));
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + path.join(DIST, haus, "index.html"));
    await seite.waitForTimeout(300);

    const zustand = await seite.evaluate(() => ({
      gussVerborgen: document.querySelector(".guss").hasAttribute("hidden"),
      laternenVerborgen: document.querySelector(".laternen").hasAttribute("hidden"),
      laternenAnzahl: document.querySelectorAll(".laternen .laterne").length,
    }));
    pruef(zustand.gussVerborgen === erwartetGuss,
      haus + ": .guss hidden=" + zustand.gussVerborgen, "erwartet " + erwartetGuss);
    pruef(zustand.laternenVerborgen === erwartetLaternen,
      haus + ": .laternen hidden=" + zustand.laternenVerborgen, "erwartet " + erwartetLaternen);
    if (haus === "minhkeey")
      pruef(zustand.laternenAnzahl === 7, "minhkeey: sieben Laternen gezeichnet", zustand.laternenAnzahl);
    pruef(konsole.length === 0, haus + ": keine Ausnahme in der Konsole", konsole.join(" | ") || "still");

    /* Freiraum unter den Laternen: bei minhkeey muss main() unterhalb
       der Laternen-Unterkante beginnen (kein Überlapp mit der Quaste),
       bei den Guss-Häusern darf html.hat-laternen erst gar nicht
       gesetzt sein — sonst stünde main() dort unnötig weit unten. */
    if (haus === "minhkeey") {
      await seite.waitForTimeout(900); // Einflug fertig, Maße stehen
      const masse = await seite.evaluate(() => {
        const laternenUnten = document.querySelector(".laternen").getBoundingClientRect().bottom;
        const mainOben = document.querySelector("main").getBoundingClientRect().top;
        return { laternenUnten, mainOben, hatKlasse: document.documentElement.classList.contains("hat-laternen") };
      });
      pruef(masse.hatKlasse, "minhkeey: html trägt hat-laternen");
      pruef(masse.mainOben >= masse.laternenUnten,
        "minhkeey: main beginnt unterhalb der Laternen (kein Überlapp)",
        "main=" + masse.mainOben.toFixed(1) + " Laternen-Unterkante=" + masse.laternenUnten.toFixed(1));
    } else {
      const hatKlasse = await seite.evaluate(() => document.documentElement.classList.contains("hat-laternen"));
      pruef(!hatKlasse, haus + ": html trägt hat-laternen NICHT (Guss braucht keinen Zusatz-Freiraum)");
    }
    await seite.close();
  }

  /* Reduzierte Bewegung: die Laternen müssen sofort im Endzustand
     stehen (opacity 1, kein translateY) statt auf eine Animation zu
     warten, die nie läuft — dieselbe Falle wie beim Guss. */
  const seiteRuhig = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
  await seiteRuhig.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seiteRuhig.goto("file://" + path.join(DIST, "minhkeey", "index.html"));
  await seiteRuhig.waitForTimeout(150);
  const ruhig = await seiteRuhig.evaluate(() => {
    const el = document.querySelector(".laternen .laterne");
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, transform: cs.transform };
  });
  pruef(ruhig.opacity === "1", "reduzierte Bewegung: Laterne sofort sichtbar", ruhig.opacity);
  pruef(ruhig.transform === "none", "reduzierte Bewegung: keine Transform-Reste", ruhig.transform);

  /* Dieselbe Prüfung für die beiden NEUEN Dauerschleifen — dieselbe
     Falle wie beim Guss/der äußeren .laterne: eine abgeschaltete
     Animation ohne korrekten Endzustand hinterlässt einen falschen
     Ruhewert. */
  const ruhigNeu = await seiteRuhig.evaluate(() => {
    const l = document.querySelector(".laternen .laterne");
    const schwung = l.querySelector(".schwung");
    const gluehen = l.querySelector(".gluehen");
    return {
      schwungTransform: getComputedStyle(schwung).transform,
      gluehenOpacity: getComputedStyle(gluehen).opacity,
    };
  });
  pruef(ruhigNeu.schwungTransform === "none",
    "reduzierte Bewegung: kein Windschwingen", ruhigNeu.schwungTransform);
  pruef(ruhigNeu.gluehenOpacity === "0.5",
    "reduzierte Bewegung: Glühen steht auf der Mitte des Pulses", ruhigNeu.gluehenOpacity);
  await seiteRuhig.close();

  /* Streuung: Ohne --schwungversatz/--gluehversatz würden alle sieben
     Laternen im exakten Gleichtakt schwingen — ein Windstoß, der jede
     Laterne gleichzeitig gleich weit auslenkt, sieht aus wie eine
     einzige, siebenfach kopierte Bewegung. Gemessen wird deshalb, ob
     zur selben Millisekunde tatsächlich unterschiedliche
     transform-Werte anliegen. */
  const seiteBewegt = await (await browser.newContext()).newPage();
  await seiteBewegt.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seiteBewegt.goto("file://" + path.join(DIST, "minhkeey", "index.html"));
  await seiteBewegt.waitForTimeout(2500); // Einflug vorbei, mitten in der Schwungschleife
  const streuung = await seiteBewegt.evaluate(() => {
    const laternen = [...document.querySelectorAll(".laternen .laterne")];
    return laternen.map(l => getComputedStyle(l.querySelector(".schwung")).transform);
  });
  const einzigartig = new Set(streuung);
  pruef(einzigartig.size >= 2,
    "Laternen schwingen versetzt (nicht im Gleichtakt)",
    einzigartig.size + " von " + streuung.length + " unterschiedliche Werte");
  await seiteBewegt.close();

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
