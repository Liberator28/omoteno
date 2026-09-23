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

/* Die zwei großen Maße kamen dazu, als das Board vollbildfähig wurde:
   Ein Küchenschirm hängt an der Wand, nicht am Tresen. Bei 2560 px
   blieb main vorher bei 1280 px stehen — die Hälfte des Schirms leer.
   pruef-vollbild.js misst das im Vollbild; hier läuft dieselbe
   Bedienprobe auf derselben Fläche. */
const MASSE = [
  { name:"Telefon",       width:390,  height:844  },
  { name:"Tresen",        width:1280, height:900  },
  { name:"Küchenschirm",  width:1920, height:1080 },
  { name:"Großer Schirm", width:2560, height:1440 }
];

/* ═══════════════════════════════════════════════════════════════════
   Kein Kästchen ohne Schreiber — die zweite Quelle

   VORFALL. Unter „Bestellungen" stand ein Kästchen „Reservierung".
   Es filterte auf bestellungen.quelle === "reservierung" — einen Wert,
   den keine Bestellzeile je trägt: Der Hub schreibt "tisch" und
   "service", der Telefonweg "telefon", und eine Reservierung landet
   ausdrücklich NICHT in bestellungen, sondern in einer eigenen
   Tabelle. Der Zähler daneben stand darum dauerhaft auf 0. Der Wirt
   hat es gemeldet, nicht die Prüfung.

   Eine Schleife über das Vorhandene hätte das nie gefunden (§8.1b):
   Das Kästchen war ja da und funktionierte tadellos — es traf nur
   nichts. Deshalb wird hier gegen eine ZWEITE Quelle gehalten: die
   Stellen, die den Wert wirklich SCHREIBEN.

   Wichtig für den Zuschnitt: seiten/admin.html wird bewusst NICHT
   als Schreiber gezählt. Dort steht zwar quelle:"reservierung" — aber
   in einem Meldungsobjekt für die Benachrichtigung, nicht in einer
   Bestellzeile. Wer das mitzählt, baut eine Prüfung, die ihren
   eigenen Anlassfall nicht sehen kann (§8.1g).
   ═══════════════════════════════════════════════════════════════════ */
function quellenAbgleich(){
  const WURZEL = path.join(__dirname, "..");
  const admin  = fs.readFileSync(path.join(HIER, "admin.html"), "utf8");
  const hub    = fs.readFileSync(path.join(WURZEL, "vorlagen", "hub.vorlage.html"), "utf8");
  const dbDir  = path.join(WURZEL, "datenbank");

  console.log("══ Kein Filter-Kästchen ohne Schreiber ══");

  /* Zwei verschiedene Dinge, und sie werden getrennt gemessen — mein
     erster Entwurf warf sie zusammen und meldete CSS-Selektoren als
     „Kästchen". Ein Kästchen ist ein Bedienelement (sichtbarer
     Fehler), eine CSS-Regel ist toter Anstrich (stiller Fehler). */
  const kaestchen = [...new Set(
    [...admin.matchAll(/class="chip"[^>]*?data-quelle="([a-z]+)"/g)].map(m => m[1]))];

  const stile = [...new Set(
    [...admin.matchAll(/\[data-quelle=["']?([a-z]+)["']?\]/g)].map(m => m[1]))];

  /* Schreiber 1 · Der Hub reicht die Quelle an bestellung_aufgeben. */
  const schreiber = new Set(
    [...hub.matchAll(/p_quelle:\s*"([a-z]+)"/g)].map(m => m[1]));

  /* Schreiber 2 · Eine SQL-Funktion, die bestellung_aufgeben mit
     benanntem Parameter ruft — so legt bestellung_liefern ihre Zeile
     an. Weder ein INSERT noch ein JS-Literal; diese Form fehlte hier
     zuerst, und die Prüfung ging zu Recht rot, als der erste solche
     Schreiber dazukam. */
  for(const datei of fs.readdirSync(dbDir).filter(n => n.endsWith(".sql"))){
    const text = fs.readFileSync(path.join(dbDir, datei), "utf8")
      .split("\n").map(z => z.replace(/--.*$/, "")).join("\n");
    for(const m of text.matchAll(/p_quelle\s*=>\s*'([a-z]+)'/gi))
      schreiber.add(m[1].toLowerCase());
  }

  /* Schreiber 3 · Direkte INSERTs in bestellungen. Der Wert wird über
     die STELLE in der Spaltenliste gefunden, nicht geraten — und die
     Werteliste wird klammertief zerlegt, weil dort Ausdrücke wie
     nullif(trim(coalesce(p_name, '')), '') stehen, die selbst Kommas
     enthalten. */
  for(const datei of fs.readdirSync(dbDir).filter(n => n.endsWith(".sql"))){
    const text = fs.readFileSync(path.join(dbDir, datei), "utf8")
      .split("\n").map(z => z.replace(/--.*$/, "")).join("\n");
    const re = /insert\s+into\s+(?:public\.)?bestellungen\s*\(([^)]*)\)\s*values\s*\(/gi;
    let m;
    while((m = re.exec(text))){
      const spalten = m[1].split(",").map(s => s.trim().toLowerCase());
      const stelle  = spalten.indexOf("quelle");
      if(stelle === -1) continue;

      let i = m.index + m[0].length, tiefe = 0, feld = "", felder = [];
      for(; i < text.length; i++){
        const c = text[i];
        if(c === "(") tiefe++;
        else if(c === ")"){ if(tiefe === 0) break; tiefe--; }
        if(c === "," && tiefe === 0){ felder.push(feld.trim()); feld = ""; continue; }
        feld += c;
      }
      felder.push(feld.trim());

      const wert = felder[stelle] || "";
      const lit  = wert.match(/^'([a-z]+)'$/i);
      if(lit) schreiber.add(lit[1].toLowerCase());
    }
  }

  pruef(schreiber.size > 0, "es wurden überhaupt Schreiber gefunden",
    [...schreiber].sort().join(", ") || "KEINE — die Prüfung misst nichts");

  pruef(kaestchen.length > 0, "es wurden überhaupt Kästchen gefunden",
    kaestchen.join(", ") || "KEINE — dann misst die Prüfung nichts");

  const ohneSchreiber = kaestchen.filter(k => !schreiber.has(k));
  pruef(ohneSchreiber.length === 0,
    "jedes Kästchen filtert auf einen Wert, den auch jemand schreibt",
    ohneSchreiber.length ? "ohne Schreiber: " + ohneSchreiber.join(", ")
                         : kaestchen.join(", ") + " — alle gedeckt");

  const toteStile = stile.filter(s => !schreiber.has(s));
  pruef(toteStile.length === 0,
    "keine CSS-Regel malt einen quelle-Wert an, den es nicht gibt",
    toteStile.length ? "tot: " + toteStile.join(", ")
                     : stile.join(", ") + " — alle gedeckt");

  /* Andersherum ist es KEIN Fehler: „service" hat bewusst kein
     Kästchen und wird deshalb immer gezeigt. Nur gemeldet, damit man
     es beim Lesen sieht. */
  const ohneKaestchen = [...schreiber].filter(s => !kaestchen.includes(s));
  if(ohneKaestchen.length){
    console.log("  (ohne eigenes Kästchen, immer sichtbar: " +
                ohneKaestchen.join(", ") + ")");
  }
}

(async () => {
  quellenAbgleich();

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
        /* "lieferungen" ist bewusst kein eigenes Panel (siehe
           tafelZeigen()) — dieselbe Fläche wie "bestellungen", nur
           mit vorgesetztem Filter. Ein #t-lieferungen zu erwarten
           wäre also der falsche Test, nicht ein fehlendes Panel. */
        const echtesZiel = z === "lieferungen" ? "bestellungen" : z;
        const el = document.getElementById("t-" + echtesZiel);
        if(!el) return { da:false };
        return { da:true, sichtbar: !el.hidden,
                 zeichen: (el.textContent || "").trim().length,
                 knoepfe: el.querySelectorAll("button, input, select, a").length };
      }, t);
      pruef(stand.da && stand.sichtbar && stand.zeichen > 40,
        "„" + t + "“ ist gefüllt",
        stand.da ? stand.zeichen + " Zeichen, " + stand.knoepfe + " Bedienelemente" : "fehlt");
    }

    /* ── 1b · "Lieferungen" ist derselbe Ort, nur gefiltert ──
       CLAUDE.md §1.1a: kein zweiter Code-Pfad für denselben Vorgang.
       Zwei Testbestellungen (Tisch, Lieferung) zeigen, dass der
       Reiter wirklich filtert und die Rückkehr zu "Bestellungen"
       den Filter wieder öffnet — nicht nur, dass beide Reiter
       irgendeinen Text zeigen. */
    await seite.evaluate(() => {
      bestellungen.length = 0;
      bestellungen.push(
        { id:"probe-tisch", quelle:"tisch", status:"neu", tisch:"4",
          zeitpunkt:new Date().toISOString(), summe:12,
          positionen:[{name:"Probe", menge:1, preis:12}] },
        { id:"probe-liefer", quelle:"lieferung", status:"neu",
          zeitpunkt:new Date().toISOString(), summe:20,
          adresse:{ name:"Weber", strasse:"Bahnhofstr. 1", plz:"35037", ort:"Kirchhain" },
          positionen:[{name:"Probe", menge:1, preis:20}] });
      zeichneAlles();
    });
    await seite.waitForTimeout(300);

    await seite.evaluate(() => tafelZeigen("lieferungen"));
    await seite.waitForTimeout(300);
    const imLieferReiter = await seite.evaluate(() => ({
      panelId: document.querySelector(".tafel:not([hidden])").id,
      quellen: [...document.querySelectorAll("#karten [data-quelle]")]
        .map(k => k.dataset.quelle),
      badge: (document.getElementById("lieferZahl") || {}).textContent
    }));
    pruef(imLieferReiter.panelId === "t-bestellungen",
      "„Lieferungen“ zeigt dieselbe Fläche wie „Bestellungen“, keine zweite");
    pruef(imLieferReiter.quellen.length === 1 && imLieferReiter.quellen[0] === "lieferung",
      "im Lieferungen-Reiter steht nur die Lieferung, der Tisch ist herausgefiltert",
      imLieferReiter.quellen.join(",") || "leer");
    pruef(imLieferReiter.badge === "1",
      "die Anzahl offener Lieferungen steht im Reiter", imLieferReiter.badge);

    await seite.evaluate(() => tafelZeigen("bestellungen"));
    await seite.waitForTimeout(300);
    const zurueck = await seite.evaluate(() =>
      [...document.querySelectorAll("#karten [data-quelle]")].map(k => k.dataset.quelle).sort());
    pruef(zurueck.length === 2 && zurueck.join(",") === "lieferung,tisch",
      "„Bestellungen“ zeigt danach wieder alle Quellen, der Filter bleibt nicht hängen",
      zurueck.join(",") || "leer");

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

    /* VORFALL (Nutzer-Rückmeldung): Die Gerichte-Auswahl der Aktion
       war eine einzige alphabetische Liste über alle Kategorien
       hinweg — bei vielen Gerichten unbrauchbar zum Scrollen. Jetzt
       nach Kategorie gruppiert (<optgroup>), wie in der Speisekarte
       selbst. Führt ein Haus mehrere Karten (Speisekarte/Getränke/
       Cocktails), steht die Karte mit im Gruppennamen — sonst nicht,
       um bei einer einzigen Karte nicht unnötig zu beschriften. */
    const runnerGruppen = await seite.evaluate(() => {
      const sel = document.getElementById("runnerGericht");
      if(!sel) return null;
      return {
        gruppen: sel.querySelectorAll("optgroup").length,
        optionen: sel.querySelectorAll("option").length,
        ersteBeschriftung: (sel.querySelector("optgroup") || {}).label || "",
      };
    });
    pruef(!!runnerGruppen && runnerGruppen.gruppen >= 1 && runnerGruppen.optionen >= 1,
      "die Gerichte-Auswahl der Aktion ist nach Kategorie gruppiert (<optgroup>)",
      runnerGruppen ? runnerGruppen.gruppen + " Gruppen, " + runnerGruppen.optionen + " Gerichte" : "—");
    pruef(!!runnerGruppen && runnerGruppen.ersteBeschriftung.length > 0,
      "jede Gruppe trägt eine lesbare Beschriftung", runnerGruppen ? runnerGruppen.ersteBeschriftung : "—");

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
