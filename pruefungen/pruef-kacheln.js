/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Startkacheln gehören dem Haus

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-kacheln.js

   Anlass, gemessen an den ausgelieferten Dateien:

   1 · BLENDS STARTSEITE WAR CHOCOS STARTSEITE. Elf Kacheln, Wort für
       Wort dieselben — „Süße Karte", „Kaiser & Eis", und unter
       Instagram stand @chocol.amour_kirchhain. KACHELN stand fest im
       Gerüst, der Erzeuger fasste den Block nicht an.

   2 · MARKENBLATT.bereiche WAR TOT. Der Erzeuger schrieb ihn, der Hub
       las ihn nirgends. Choco stand auf quiz:true/musikwunsch:false,
       Blend genau umgekehrt — und beide zeigten Tischquiz und keinen
       Musikwunsch.

   3 · CHOCOS INSTAGRAM-KACHEL FÜHRTE INS LEERE. „ziel:LINKS.instagram"
       ist ein WERT, eingefroren beim Anlegen der Liste; LINKS wird
       erst tausend Zeilen später aus dem Markenblatt gefüllt. Die
       Kachel behielt "". href="" lädt die Seite neu.

   WORAUS DIE PRÜFUNG IHRE WAHRHEIT ZIEHT: nicht aus dem Hub allein —
   der wäre immer mit sich selbst einig. Sondern aus den
   MARKENBLÄTTERN daneben (§8.1b). Der Kern ist der Kreuzvergleich:
   Jede Kachel jedes Hubs wird gegen die Markenblätter ALLER ANDEREN
   gehalten. Ein Hub, der den Text eines fremden Hauses trägt, fällt
   dabei auf — und genau das wäre am 05.09. passiert.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN     = path.resolve(__dirname, "..");
const BLAETTER = path.join(OBEN, "markenblaetter");
const DIST     = path.join(OBEN, "dist");

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

function haeuser(){
  if(!fs.existsSync(DIST)) return [];
  return fs.readdirSync(DIST)
    .filter(s => fs.existsSync(path.join(DIST, s, "index.html")))
    .map(slug => {
      const bl = path.join(BLAETTER, slug + ".json");
      return {
        slug,
        hub: path.join(DIST, slug, "index.html"),
        blatt: fs.existsSync(bl) ? JSON.parse(fs.readFileSync(bl, "utf8")) : null
      };
    });
}

/* Alles, was ein Haus an eigenem Text in seine Kacheln schreibt.
   Kurze und leere Texte fallen raus: „Getränke" steht bei jedem
   Haus und beweist gar nichts. */
function eigeneTexte(blatt){
  const raus = [];
  ((blatt && blatt.kacheln) || []).forEach(k => {
    [k.titel, k.unter].forEach(x => {
      if(typeof x === "string" && x.trim().length >= 8) raus.push(x.trim());
    });
  });
  return raus;
}

(async () => {
  const h = haeuser();
  if(h.length < 2){
    console.error("Mindestens zwei erzeugte Hubs nötig — was mehrfach\n" +
                  "erzeugt wird, muss mehrfach verglichen werden (§8.1a).\n" +
                  "Erst „node erzeuger/erzeuge-hub.js --alle“ laufen lassen.");
    process.exit(1);
  }
  const browser = await chromium.launch();

  /* Was jeder Hub wirklich zeichnet — einmal einlesen, dann prüfen. */
  const gezeigt = {};
  for(const x of h){
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    await p.route("**/*", r => r.request().url().startsWith("file://")
      ? r.continue() : r.abort());
    await p.goto("file://" + x.hub);
    await p.waitForTimeout(1300);
    gezeigt[x.slug] = await p.$$eval(".kachel", e => e.map(el => {
      const svg = el.querySelector(".ico svg");
      return {
        titel: el.querySelector("strong") ? el.querySelector("strong").textContent.trim() : "",
        unter: el.querySelector(".txt span:not(.neu)")
          ? el.querySelector(".txt span:not(.neu)").textContent.trim() : "",
        ziel:  el.getAttribute("href") || "",
        /* Am gezeichneten Bild gemessen: ICONS[k.icon] || "" fällt
           still auf leer zurück, und eine Kachel ohne Symbol sieht
           nicht kaputt aus, sondern nur karg. */
        symbolBreit: svg ? Math.round(svg.getBoundingClientRect().width) : 0
      };
    }));
    await p.close();
  }
  await browser.close();

  /* ── 0 · Ein Alphabet für beide Seiten ──────────────────────────
     Der Hub zeichnete Striche, das Studio zeigte Emoji — der Kunde
     sah in der Vorschau also etwas anderes, als er bekam. Seit dem
     geteilten Block zeichnen beide dasselbe; hier wird das gehalten. */
  console.log("\n══ Der geteilte ICONS-Block ══");
  const marke = /\/\* ╔═══ ICONS · GETEILTER BLOCK · ANFANG[\s\S]*?\/\* ╚═══ ICONS · GETEILTER BLOCK · ENDE ═+╝ \*\//;
  const quellen = [
    { name:"vorlagen/hub.vorlage.html", pfad: path.join(OBEN, "vorlagen", "hub.vorlage.html") },
    { name:"seiten/marken-studio.html", pfad: path.join(OBEN, "seiten", "marken-studio.html") }
  ].map(q => {
    const t = fs.readFileSync(q.pfad, "utf8").match(marke);
    return { name:q.name, text: t ? t[0] : null };
  });
  const ohne = quellen.filter(q => !q.text);
  if(ohne.length){
    ohne.forEach(q => pruef(false, "Block fehlt in " + q.name));
  } else {
    pruef(quellen[0].text === quellen[1].text,
      "beide Fassungen sind wortgleich", quellen[0].text.length + " Zeichen");
  }
  const symbolNamen = quellen[0].text
    ? [...quellen[0].text.matchAll(/^  ([a-z]+):/gm)].map(m => m[1]) : [];
  pruef(symbolNamen.length >= 30, "genug Symbole für fünf je Funktion",
    symbolNamen.length + " Stück");

  /* Jeder Vorschlag zeigt auf ein Symbol, das es gibt. Eine Liste,
     die auf einen erfundenen Namen zeigt, ist ein leerer Knopf. */
  const vorschlagBlock = quellen[0].text
    ? fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8")
        .match(/const KACHELSYMBOLE = \{([\s\S]*?)\n\};/) : null;
  if(vorschlagBlock){
    const tote = [...vorschlagBlock[1].matchAll(/"([a-z]+)"/g)]
      .map(m => m[1]).filter(n => symbolNamen.indexOf(n) < 0);
    pruef(tote.length === 0, "jeder Symbolvorschlag existiert",
      tote.length ? [...new Set(tote)].join(", ") : "alle");
  }

  /* ── 1 · Kein Hub trägt den Text eines anderen Hauses ──────────── */
  console.log("\n══ Kreuzvergleich: fremder Text im Hub ══");
  h.forEach(x => {
    const fremd = [];
    h.filter(y => y.slug !== x.slug).forEach(y => {
      const meins = eigeneTexte(x.blatt);
      eigeneTexte(y.blatt).forEach(txt => {
        if(meins.indexOf(txt) >= 0) return;   /* beide sagen dasselbe: erlaubt */
        gezeigt[x.slug].forEach(k => {
          if(k.titel === txt || k.unter === txt)
            fremd.push(y.slug + ": „" + txt + "“");
        });
      });
    });
    pruef(fremd.length === 0, x.slug.padEnd(14) + " zeigt nur eigenen Text",
      fremd.length ? fremd.join(" · ") : gezeigt[x.slug].length + " Kacheln");
  });

  /* ── 2 · Was das Markenblatt sagt, steht auch da ───────────────── */
  console.log("\n══ Kachel für Kachel gegen das Markenblatt ══");
  h.forEach(x => {
    const soll = ((x.blatt && x.blatt.kacheln) || []).filter(k => k.an !== false);
    if(!soll.length){
      pruef(true, x.slug.padEnd(14) + " hat keine eigene Kachelliste (Rückfall gilt)");
      return;
    }
    /* Nicht jede gewünschte Kachel MUSS erscheinen — trinkgeld und
       instagram blenden sich selbst aus, wenn das Haus sie nicht
       eingerichtet hat. Geprüft wird die Gegenrichtung: Was da ist,
       muss gewollt sein, und die Reihenfolge muss stimmen. */
    const titelSoll = soll.map(k => k.titel).filter(Boolean);
    const titelIst  = gezeigt[x.slug].map(k => k.titel.replace(/NEU$/, ""));
    const unerwuenscht = titelIst.filter(t => titelSoll.indexOf(t) < 0);
    pruef(unerwuenscht.length === 0,
      x.slug.padEnd(14) + " zeigt nichts Ungewolltes",
      unerwuenscht.length ? unerwuenscht.join(", ") : "keine");

    const reihe = titelIst.filter(t => titelSoll.indexOf(t) >= 0);
    const sortiert = reihe.slice().sort((a, b) => titelSoll.indexOf(a) - titelSoll.indexOf(b));
    pruef(reihe.join("|") === sortiert.join("|"),
      x.slug.padEnd(14) + " hält die Reihenfolge des Markenblatts",
      reihe.slice(0, 3).join(" · ") + " …");
  });

  /* ── 3 · Kein Ziel ist leer ────────────────────────────────────── */
  console.log("\n══ Jede Kachel führt irgendwohin ══");
  h.forEach(x => {
    const leer = gezeigt[x.slug].filter(k => !k.ziel || k.ziel === "#");
    pruef(leer.length === 0, x.slug.padEnd(14) + " hat kein leeres Ziel",
      leer.length ? leer.map(k => k.titel).join(", ")
                  : gezeigt[x.slug].length + " Ziele, alle gefüllt");
    /* Ein äußerer Verweis muss zur Laufzeit aufgelöst sein — genau
       der Fall, der bei Choco auf "" stand. */
    const aussen = gezeigt[x.slug].filter(k => /^https?:/.test(k.ziel));
    aussen.forEach(k => pruef(k.ziel.length > 12,
      x.slug.padEnd(14) + " „" + k.titel + "“ ist aufgelöst", k.ziel));
  });

  /* ── 3b · Was da sein MUSS, ist auch da ────────────────────────────
     Der erste Entwurf dieser Prüfung lief nur über die Kacheln, die
     der Hub ZEIGT — und blieb beim Gegenbeweis grün. Grund: Ein
     Ziel, das leer bleibt, wird von konfigPruefen() entfernt. Die
     Kachel ist dann nicht kaputt, sie ist WEG, und über etwas, das
     nicht dasteht, iteriert keine Schleife (§8.1b).

     Deshalb hier die zweite Quelle: Das Markenblatt sagt, ob das Haus
     die Voraussetzung hat. Hat es sie, MUSS die Kachel erscheinen —
     hat es sie nicht, darf sie es nicht. Beide Richtungen, sonst
     genügte eine Fassung, die nie etwas zeigt. */
  console.log("\n══ Was das Haus eingerichtet hat, erscheint auch ══");
  const BEDINGT = {
    instagram: b => !!(b.links && b.links.instagram),
    trinkgeld: b => !!(b.trinkgeld && b.trinkgeld.paypal),
    wlan:      b => !!(b.wlan && b.wlan.netz)
  };
  h.forEach(x => {
    const eigen = (x.blatt && x.blatt.kacheln) || [];
    Object.keys(BEDINGT).forEach(schl => {
      const gewollt = eigen.find(e => e.schluessel === schl && e.an !== false);
      if(!gewollt) return;                     /* nicht bestellt, nichts zu prüfen */
      const kann = BEDINGT[schl](x.blatt || {});
      const da = gezeigt[x.slug].some(g => g.titel.replace(/NEU$/, "") === gewollt.titel);
      pruef(kann === da,
        x.slug.padEnd(14) + " „" + gewollt.titel + "“ " +
          (kann ? "ist eingerichtet und steht da" : "ist nicht eingerichtet und fehlt"),
        kann === da ? "stimmt" : (kann ? "eingerichtet, aber NICHT sichtbar"
                                       : "nicht eingerichtet, aber sichtbar"));
    });
  });

  /* ── 3c · Jede Kachel trägt ein gezeichnetes Symbol ────────────── */
  console.log("\n══ Jede Kachel hat ein Symbol ══");
  h.forEach(x => {
    const ohneBild = gezeigt[x.slug].filter(k => k.symbolBreit <= 0);
    pruef(ohneBild.length === 0, x.slug.padEnd(14) + " zeichnet überall ein Symbol",
      ohneBild.length ? ohneBild.map(k => k.titel).join(", ")
                      : gezeigt[x.slug].length + " Kacheln, alle mit Strich");
  });

  /* ── 4 · bereiche wirkt wirklich ───────────────────────────────── */
  console.log("\n══ Abgeschaltete Bereiche sind wirklich weg ══");
  h.forEach(x => {
    const ber = (x.blatt && x.blatt.bereiche) || {};
    const aus = Object.keys(ber).filter(k => ber[k] === false);
    if(!aus.length){ pruef(true, x.slug.padEnd(14) + " hat nichts abgeschaltet"); return; }
    /* Der Schlüssel steht im Markenblatt, der Titel im Hub. Über die
       eigene Kachelliste verbunden — und wo es keine gibt, über die
       Vorgabe, die dann ohnehin greift. */
    const eigen = (x.blatt && x.blatt.kacheln) || [];
    const uebrig = aus.filter(schl => {
      const k = eigen.find(e => e.schluessel === schl);
      const titel = k && k.titel;
      return titel && gezeigt[x.slug].some(g => g.titel.replace(/NEU$/, "") === titel);
    });
    pruef(uebrig.length === 0,
      x.slug.padEnd(14) + " zeigt keinen abgeschalteten Bereich",
      uebrig.length ? uebrig.join(", ") : "aus: " + aus.join(", "));
  });

  console.log(fehler ? "\n  " + fehler + " Fehler." : "\n  Alles sauber.");
  process.exit(fehler ? 1 : 0);
})();
