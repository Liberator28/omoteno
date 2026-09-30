/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Der Lieferweg, von der Einstellung bis zur Bestellung

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-liefern.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   Der Liefermodus geht über DREI Dateien: Der Wirt stellt ihn im
   Board ein (admin.html), der Gast bestellt im Hub (dist/…), und die
   Küche muss den Bon sehen (kueche.html). Jede für sich war grün —
   und genau das war beim Storno die Falle (§8.1i): Zwei Hälften, jede
   gegen eine Erfindung der anderen geprüft, und die Erfindungen waren
   sich einig, während die Wirklichkeit es nicht war.

   Deshalb hält diese Prüfung beide Seiten gegeneinander:

   1 · DAS BOARD. Kann der Wirt die Lieferung überhaupt bedienen?
       Und verweigert es die zwei Eingaben, die eine Falle wären —
       „an, aber ohne eine einzige Postleitzahl" und „Von ohne Bis"?

   2 · DER HUB. Drei Absagen, die der Gast sehen MUSS, bevor er sein
       ganzes Formular ausfüllt: Migration fehlt noch, Postleitzahl
       außerhalb des Gebiets, außerhalb der Lieferzeit. Eine Absage
       nach dem Ausfüllen ist eine Absage zu spät.

   2b · DER SCHALTER. Seit 30.09. schaltet der Gast nicht mehr über
       ein Band auf der Startseite, sondern über zwei Symbole im Kopf
       (Besteck / Roller). Gemessen: der echte Tipp und seine Folge
       im Warenkorb, der aufblitzende Name, Bewegung und Kontrast.
       Gegenbeweis gefahren (worktree): lieferWahlZeichnen() nicht
       gerufen → „steht im Kopf“ rot; Gegenlauf der Symbolkopie
       entfernt → „deckungsgleich“ und „Endlage“ rot; tischNr aus der
       Bedingung → „am Tisch kein Schalter“ rot; opacity:1 am Namen
       entfernt → „zeigt kurz den Namen“ rot.

   3 · DIE NAHT. Was das Board speichert und was der Hub liest, muss
       dasselbe Feld sein. Gemessen wird am Auszeichnungstext der
       einen Datei gegen den der anderen — nicht gegen meine Annahme.

   EHRLICHE GRENZE: Ich erreiche die echte Datenbank nicht. Die
   Serverantworten sind hier gestellt. Was diese Prüfung zeigen kann,
   ist, dass HUB und BOARD dieselbe Form benutzen und dass jede Absage
   den Gast erreicht — nicht, dass bestellung_liefern() auf deinem
   Server durchläuft. Dafür steht die Probe am Ende von
   migration-lieferung.sql.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN   = path.join(__dirname, "..");
const SEITEN = path.join(OBEN, "seiten");
let fehler = 0;
const ok = (g, t, z) => {
  console.log((g ? "  ok   " : "  FEHL ") + t + (z ? "  → " + z : ""));
  if(!g) fehler++;
};
/* Ein blockiertes Netz meldet sich in der Konsole. Das ist hier so
   gewollt und kein Fehler der Seite. */
const echt = k => k.filter(z => !/net::ERR|Failed to load|ERR_FAILED/i.test(z));

const BID = "11111111-2222-3333-4444-555555555555";

/* Eine Einstellung, wie sie der Wirt im Board erzeugt. Genau die Form,
   die lfSichern() baut — sie steht hier ausgeschrieben, damit ein
   Formwechsel auffällt, statt still durchzurutschen. */
const LIEFER_AN = {
  an: true, plz: ["35037", "35039"],
  mindest: 15, gebuehr: 2.5, gratis_ab: 30, dauer_min: 45,
  bar: true, karte: true
};

/* ═══════════════════════════════════════════════════════════════════
   1 · DAS BOARD · Kann der Wirt die Lieferung bedienen?
   ═══════════════════════════════════════════════════════════════════ */
async function board(br){
  console.log("\n══ Das Board · Liefereinstellungen ══");
  const ctx = await br.newContext({ viewport:{ width:390, height:844 } });
  const p   = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));

  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue() : r.abort());
  await p.goto("file://" + path.join(SEITEN, "admin.html"));
  await p.waitForTimeout(900);

  /* Denselben Weg nimmt pruef-board.js. Er wird von dort übernommen
     und nicht neu erfunden: Mein erster Anlauf klickte gegen das
     Login-Tor und meldete „Knopf nicht erreichbar" — ein Fehler der
     Prüfung, nicht des Boards. */
  await p.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); }
  });
  await p.waitForTimeout(400);
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(300); }

  await p.evaluate(() => tafelZeigen("einstellungen"));
  await p.waitForTimeout(400);

  const da = await p.evaluate(() => ({
    bereich: !!document.getElementById("lfAn"),
    tage:    document.querySelectorAll("#lfTage .tagknopf").length,
    felder:  ["lfPlz","lfMindest","lfGebuehr","lfGratis","lfDauer","lfVon","lfBis"]
               .filter(id => !!document.getElementById(id)).length
  }));
  ok(da.bereich && da.felder === 7, "der Bereich steht und ist vollständig",
     da.felder + " Felder");
  ok(da.tage === 7, "sieben Tage zur Wahl", da.tage + " Knöpfe");

  /* Antippflächen. 44 px ist keine Meinung, sondern die Zahl aus
     §8.1d — ein Wirt bedient das mit dem Daumen, zwischen zwei
     Tischen.

     GEMESSEN WIRD, WAS EIN FINGER TRIFFT, nicht das Kästchen des
     Elements. Mein erster Anlauf nahm getBoundingClientRect() — die
     sieht ein ::before nicht, mit dem man eine Fläche vergrößert,
     ohne die Optik anzufassen. Sie meldete deshalb rot, als es schon
     lief. Dieselbe Lehre wie §8.1c: Nicht die Eigenschaft ablesen,
     sondern das Ergebnis.

     elementFromPoint am oberen und unteren Rand eines 44-px-Bandes
     um die Mitte: Landet dort das Element selbst (oder etwas darin),
     ist die Fläche da. */
  const klein = await p.evaluate(() => {
    const zu = [];
    document.querySelectorAll("#lfTage .tagknopf, #lfAn, #lfBar, #lfKarte, #lfSichern")
      .forEach(el => {
        /* elementFromPoint arbeitet nur INNERHALB des Sichtfensters.
           Der Liefer-Bereich liegt weit unten; ohne dieses Scrollen
           kam für JEDEN Knopf „nichts da" heraus — auch für die, die
           in Ordnung sind. Das war der Hinweis: Wenn alles rot ist,
           ist meist die Probe kaputt, nicht das Produkt (§8.1g). */
        el.scrollIntoView({ block:"center" });
        const r = el.getBoundingClientRect();
        const mx = r.left + r.width / 2, my = r.top + r.height / 2;
        const trifft = y => {
          const t = document.elementFromPoint(mx, y);
          return !!t && (t === el || el.contains(t));
        };
        const breit = r.width >= 44;
        const hoch  = trifft(my - 21) && trifft(my + 21);
        if(!breit || !hoch)
          zu.push((el.id || el.textContent.trim()) + " " +
                  Math.round(r.width) + "×" + (hoch ? "44+" : Math.round(r.height)));
      });
    return zu;
  });
  ok(klein.length === 0, "jede Antippfläche trifft auf 44 px",
     klein.length ? klein.join(", ") : "alle");

  /* ── Die erste Falle: an, aber ohne Liefergebiet ──────────────
     Ohne diese Absage füllt der Gast das ganze Formular aus und
     bekommt am Ende „wir liefern nicht zu Ihnen". */
  await p.evaluate(() => {
    document.getElementById("lfAn").setAttribute("aria-pressed", "true");
    document.getElementById("lfPlz").value = "";
  });
  await p.click("#lfSichern");
  await p.waitForTimeout(400);
  const m1 = (await p.textContent("#lfPruefung") || "").trim();
  ok(/Postleitzahl/i.test(m1), "„an ohne Liefergebiet“ wird abgelehnt", m1.slice(0, 52));

  /* ── Die zweite Falle: halbes Zeitfenster ────────────────────
     „Von 18:00, Bis leer" hieße für liefertGerade() „immer" — der
     Wirt hätte etwas anderes gemeint. */
  await p.evaluate(() => {
    document.getElementById("lfPlz").value = "35037, 35039";
    document.getElementById("lfVon").value = "18:00";
    document.getElementById("lfBis").value = "";
  });
  await p.click("#lfSichern");
  await p.waitForTimeout(400);
  const m2 = (await p.textContent("#lfPruefung") || "").trim();
  ok(/beide Zeiten/i.test(m2), "„Von ohne Bis“ wird abgelehnt", m2.slice(0, 52));

  /* ── Was wirklich in betriebe.liefer landet ──────────────────
     Der Vorführmodus speichert absichtlich nichts. Für diese eine
     Frage wird er ausgeschaltet und db durch eine Attrappe ersetzt,
     die nur MITSCHREIBT — sonst misst die Prüfung ihre eigene
     Freundlichkeit statt des Ergebnisses (§8.1g). */
  const gespeichert = await p.evaluate(async () => {
    let mit = null;
    window.demo = false;
    demo = false;
    db = { from: () => ({ update: (w) => ({ eq: () => { mit = w; return Promise.resolve({ error:null }); } }) }) };
    meineBetriebe = [{ id: betriebId = "b1", liefer: null }];
    document.getElementById("lfAn").setAttribute("aria-pressed", "true");
    document.getElementById("lfPlz").value     = "35037, 35039, unfug, 4";
    document.getElementById("lfMindest").value = "15";
    document.getElementById("lfGebuehr").value = "2,50";
    document.getElementById("lfGratis").value  = "30";
    document.getElementById("lfDauer").value   = "45";
    document.getElementById("lfVon").value     = "18:00";
    document.getElementById("lfBis").value     = "01:00";
    document.getElementById("lfKarte").setAttribute("aria-pressed", "true");
    LFTAGE = [5, 6, 7];
    await lfSichern();
    return { mit: mit, rueck: document.getElementById("lfPruefung").textContent };
  });
  const g = gespeichert.mit && gespeichert.mit.liefer;
  ok(!!g, "das Sichern schreibt in die Spalte „liefer“",
     g ? "ja" : JSON.stringify(gespeichert.mit));
  ok(!!g && g.plz.join(",") === "35037,35039",
     "Unfug in der Postleitzahlenliste fällt heraus", g ? g.plz.join(",") : "—");
  ok(!!g && g.gebuehr === 2.5, "Komma und Punkt gelten beide als Dezimalzeichen",
     g ? String(g.gebuehr) : "—");
  ok(!!g && g.zeiten && g.zeiten.von === "18:00" && g.zeiten.bis === "01:00" &&
     g.zeiten.tage.join(",") === "5,6,7",
     "Zeitfenster und Wochentage kommen mit",
     g && g.zeiten ? JSON.stringify(g.zeiten) : "—");

  /* Der Zwischenstand muss auch überleben, dass der Wirt den Reiter
     wechselt — sonst tippt er zweimal. */
  const nachWechsel = await p.evaluate(async () => {
    tafelZeigen("bestellungen"); tafelZeigen("einstellungen");
    lfFuellen();
    return [...document.querySelectorAll("#lfTage .tagknopf")]
      .filter(k => k.getAttribute("aria-pressed") === "true")
      .map(k => k.dataset.tag).join(",");
  });
  ok(nachWechsel === "5,6,7", "die Tagesknöpfe behalten ihren Stand", nachWechsel || "leer");

  ok(echt(kons).length === 0, "das Board wirft dabei keinen Fehler",
     echt(kons)[0] || "still");
  await ctx.close();
}

/* ═══════════════════════════════════════════════════════════════════
   2 · DER HUB · Drei Absagen, die den Gast rechtzeitig erreichen
   ═══════════════════════════════════════════════════════════════════ */

/* Ein Hub im gewünschten Zustand. `liefer` ist das, was aus der
   Datenbank käme — undefined heißt „Migration fehlt noch". */
async function hubAuf(br, haus, liefer, adresszusatz){
  const ctx = await br.newContext({ viewport:{ width:390, height:844 } });
  const p   = await ctx.newPage();
  const kons = [];
  const gesendet = [];
  p.on("pageerror", e => kons.push("JS: " + String(e).slice(0,150)));

  const zeile = { id: BID, bestell_pause:false, bestell_pause_text:"",
                  hub_texte:{}, hub_kacheln:null, hub_woerter:null };
  if(liefer !== undefined) zeile.liefer = liefer;

  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue()
    : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await p.route("**/rest/v1/betriebe**", r => r.fulfill({ status:200,
    contentType:"application/json", body: JSON.stringify([zeile]) }));
  await p.route("**/rest/v1/rpc/bestellung_liefern", r => {
    gesendet.push(JSON.parse(r.request().postData() || "{}"));
    return r.fulfill({ status:200, contentType:"application/json",
      body: JSON.stringify({ ok:true, id:"neu-1", gebuehr:2.5, summe:22.5 }) });
  });
  await p.route("**/rest/v1/rpc/bestellung_aufgeben", r => {
    gesendet.push({ FALSCHER_WEG: JSON.parse(r.request().postData() || "{}") });
    return r.fulfill({ status:200, contentType:"application/json", body:'"neu-2"' });
  });

  /* Zwei Waffeln zu je 9 Euro liegen im Korb — 18 Euro, über dem
     Mindestbestellwert von 15 und unter der Gratisschwelle von 30.
     Absicht: Die Gebühr muss sichtbar werden. */
  /* Der Korbschluessel haengt am HAUS (omoteno-merk-<slug>) — beide
     Huebe liegen auf derselben Domain, localStorage haengt am
     Ursprung, nicht am Pfad. Genau hier hat diese Pruefung den
     Fehler gefunden, dass im Geruest ueberall „das erste Haus"
     stand: Blend kam mit 0 Adressfeldern heraus, weil sein Korb
     unter einem fremden Schluessel lag. Wer den Schluessel hier
     festschreibt, prueft ab dem zweiten Haus nichts mehr. */
  await p.addInitScript(slug => {
    localStorage.setItem("omoteno-willkommen", "1");
    sessionStorage.setItem("omoteno-willkommen", "1");
    localStorage.setItem("omoteno-merk-" + slug, JSON.stringify({
      "Waffel": { n:"Waffel", m:2, p:"9,00" }
    }));
  }, haus);
  /* „@OHNE@" heisst: ohne ?modus=liefern aufrufen. Ein eigener
     Schalter statt einer zweiten, fast gleichen Funktion — zwei
     Kopien wuerden auseinanderlaufen. */
  const ohne = String(adresszusatz || "").indexOf("@OHNE@") === 0;
  const rest = ohne ? String(adresszusatz).slice(6) : (adresszusatz || "");
  await p.goto("file://" + path.join(OBEN, "dist", haus, "index.html") +
               (ohne ? (rest || "") : "?modus=liefern" + rest));
  await p.waitForTimeout(1500);
  /* Öffnungszeiten für JEDES Haus festlegen, nicht nur für Blend: Choco
     öffnet um 10:30. Vorher zeigt der Hub zu Recht kein Bestellfeld,
     und diese Prüfung wurde morgens rot („0 Felder“), obwohl der
     Liefermodus in Ordnung war — gemessen am 25.09. um 10:24 UTC. Eine
     Prüfung, die an der Uhr des Rechners hängt, prüft die Uhr. */
  await p.evaluate(() => {
    if (typeof ZEITEN === "undefined") return;
    ZEITEN.length = 0;
    for (let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59");
  });
  await p.evaluate(() => { location.hash = "#/auswahl"; });
  await p.waitForTimeout(800);
  return { p, ctx, kons, gesendet, echt: () => echt(kons) };
}

/* Wie hubAuf, nur ohne „?modus=liefern" — fuer den Umschalter, der
   ja genau den Weg HINEIN pruefen soll. */
async function hubOhneModus(br, haus, liefer, suffix){
  const h = await hubAuf(br, haus, liefer, "@OHNE@" + (suffix || ""));
  /* hubAuf landet auf der Auswahl — dort gehoert das Band nicht hin,
     es steht auf der STARTSEITE. Mein erster Anlauf suchte es auf
     der falschen Seite und meldete „kein Band", wo eines war. */
  await h.p.evaluate(() => { location.hash = "#/"; });
  await h.p.waitForTimeout(700);
  return h;
}

async function hubOhneMigration(br){
  console.log("\n══ Der Hub · die Migration fehlt noch ══");
  const h = await hubAuf(br, "chocolamour", undefined);
  const stand = await h.p.evaluate(() => ({
    modus:   liefermodus,
    an:      LIEFER.an,
    adresse: !!document.getElementById("lStrasse"),
    tisch:   !!document.getElementById("bTisch")
  }));
  /* §7: Der seltenere Fall darf nicht den täglichen kaputtmachen.
     Ohne Spalte bleibt der Hub ein ganz normaler Hub — der Gast merkt
     nichts, statt vor einem halben Formular zu stehen. */
  ok(!stand.an, "ohne Spalte bleibt die Lieferung aus", "LIEFER.an=" + stand.an);
  ok(!stand.adresse && stand.tisch,
     "der Gast bekommt die gewohnte Tischfrage, kein halbes Adressformular");
  ok(h.echt().length === 0, "und die Seite wirft dabei keinen Fehler",
     h.echt()[0] || "still");
  await h.ctx.close();
}

async function hubImGebiet(br){
  console.log("\n══ Der Hub · Lieferung an, alles richtig ══");
  /* Fenster bewusst offen: Von und Bis bleiben leer, das heißt
     „immer". Dieser Durchgang misst den Weg, nicht die Uhr. */
  const h = await hubAuf(br, "chocolamour", LIEFER_AN);
  const stand = await h.p.evaluate(() => ({
    modus: liefermodus, an: LIEFER.an,
    felder: ["lName","lStrasse","lPlz","lOrt","lTelefon"]
              .filter(i => !!document.getElementById(i)).length,
    tisch: !!document.getElementById("bTisch"),
    text:  document.querySelector(".seite").textContent
  }));
  ok(stand.modus && stand.an, "der Liefermodus ist an");
  ok(stand.felder === 5 && !stand.tisch,
     "Adresse statt Tischnummer", stand.felder + " Felder");
  ok(/2,50|2\.50/.test(stand.text), "die Liefergebühr steht da, bevor bestellt wird");
  ok(/20,50|20\.50/.test(stand.text), "und die Summe, die an der Tür bezahlt wird");
  ok(/Tür|Tuer/i.test(stand.text), "der Gast liest, dass an der Tür bezahlt wird");

  /* Die Absage bei fremder Postleitzahl — und zwar OHNE dass etwas
     gesendet wird. Eine Bestellung, die erst der Server ablehnt, hat
     den Gast schon Zeit gekostet. */
  await h.p.evaluate(() => {
    const s = (id, w) => document.getElementById(id).value = w;
    s("lName","Weber"); s("lStrasse","Bahnhofstr. 1"); s("lPlz","99999");
    s("lOrt","Kirchhain"); s("lTelefon","0173 1");
  });
  await h.p.click('[data-aktion="bestellen"]');
  await h.p.waitForTimeout(600);
  const abs = (await h.p.textContent("#melde") || "").trim();
  ok(/liefern wir leider nicht|liefern.*nicht/i.test(abs),
     "fremde Postleitzahl: Absage im Hub, nichts gesendet", abs.slice(0, 46));
  ok(h.gesendet.length === 0, "und wirklich nichts gesendet",
     h.gesendet.length + " Aufrufe");

  /* Jetzt richtig. */
  await h.p.evaluate(() => { document.getElementById("lPlz").value = "35037"; });
  await h.p.click('[data-aktion="bestellen"]');
  await h.p.waitForTimeout(1400);
  const s = h.gesendet[0];
  ok(!!s && !s.FALSCHER_WEG,
     "die Bestellung geht über bestellung_liefern, nicht über bestellung_aufgeben",
     s ? (s.FALSCHER_WEG ? "falscher Weg" : "richtig") : "nichts gesendet");
  ok(!!s && s.p_adresse && s.p_adresse.plz === "35037" && s.p_adresse.telefon,
     "die Adresse ist vollständig dabei",
     s && s.p_adresse ? JSON.stringify(s.p_adresse).slice(0, 60) : "—");
  ok(!!s && s.p_summe === 18,
     "geschickt wird die WARENsumme — die Gebühr rechnet der Server",
     s ? String(s.p_summe) : "—");
  ok(h.echt().length === 0, "keine Fehler auf dem Weg", h.echt()[0] || "still");
  await h.ctx.close();
}

async function hubUmschalter(br){
  console.log("\n══ Der Liefer-Schalter im Kopf ══");

  /* Seit 30.09. kein Band mehr auf der Startseite, sondern zwei
     Symbole im Kopf (Wunsch: „wie ein Switch … man sieht normal nur
     die Icons, beim Umschalten kurz den Namen"). Gemessen wird der
     echte Tipp und seine Folge — liefermodus, das Adressformular im
     Warenkorb, der aufblitzende Name —, nicht nur die Attribute
     (§8.1g: eine Probe, die den Fehler nicht treffen kann, ist keine). */
  const a = await hubOhneModus(br, "chocolamour", LIEFER_AN);
  const lesen = () => a.p.evaluate(() => {
    const w = document.getElementById("lieferwahl");
    const k = s => w.querySelector('[data-lieferwahl="' + s + '"]');
    const r = el => el.getBoundingClientRect();
    const n = w.querySelector(".lw-name");
    return {
      sichtbar: !w.hidden && getComputedStyle(w).display !== "none",
      imKopf: !!w.closest("header .kopfwahl"),
      wahl: w.dataset.wahl, modus: liefermodus,
      haus: k("haus").getAttribute("aria-checked"), liefern: k("liefern").getAttribute("aria-checked"),
      tab: [k("haus").tabIndex, k("liefern").tabIndex],
      masse: [r(k("haus")).width, r(k("haus")).height, r(k("liefern")).width, r(k("liefern")).height],
      nameDeckt: +getComputedStyle(n).opacity, nameText: n.textContent.trim(),
      zeigt: w.classList.contains("zeigt"),
      hash: location.hash, suche: location.search,
      label: k("liefern").getAttribute("aria-label") || "",
    };
  });
  const s0 = await lesen();
  ok(s0.sichtbar && s0.imKopf, "der Schalter steht im Kopf, wo das Haus liefert");
  ok(s0.haus === "true" && s0.liefern === "false" && s0.wahl === "haus",
     "Ausgangslage: im Haus gewählt", s0.wahl);
  ok(s0.tab[0] === 0 && s0.tab[1] === -1, "nur der gewählte Knopf liegt in der Tab-Reihenfolge", s0.tab.join("/"));
  ok(s0.masse.every(m => m >= 44), "beide Knöpfe ≥ 44 × 44 px", s0.masse.map(Math.round).join(" "));
  ok(s0.nameDeckt === 0, "in Ruhe nur Symbole, kein Name", "opacity " + s0.nameDeckt);
  ok(!(await a.p.evaluate(() => !!document.querySelector(".lieferband"))), "das alte Band ist weg");
  /* Ohne sichtbaren Schalter tippt keine Folgeprobe irgendwohin — sie
     würden mit einer Zeitüberschreitung abbrechen, statt zu sagen,
     woran es liegt (§8.1g, Vorfall C). */
  if(!s0.sichtbar){
    ok(false, "Folgeproben des Schalters übersprungen", "kein sichtbarer Schalter");
    await a.ctx.close();
    return;
  }

  await a.p.click('[data-lieferwahl="liefern"]');
  await a.p.waitForTimeout(950);
  const s1 = await lesen();
  ok(s1.modus === true && s1.wahl === "liefern" && s1.liefern === "true" && s1.haus === "false",
     "ein Tipp auf den Roller schaltet liefermodus wirklich ein", "modus=" + s1.modus);
  ok(s1.zeigt && s1.nameDeckt === 1 && s1.nameText === "Lieferung",
     "und zeigt kurz den Namen", JSON.stringify([s1.nameDeckt, s1.nameText]));
  ok(!s1.hash.includes("liefern") && !s1.suche, "keine Adresse bleibt hängen",
     JSON.stringify([s1.hash, s1.suche]));
  await a.p.waitForTimeout(2000);
  const s1b = await lesen();
  ok(!s1b.zeigt && s1b.nameDeckt === 0 && s1b.modus === true,
     "danach wieder nur Symbole, der Zustand bleibt", "opacity " + s1b.nameDeckt);

  /* Die Folge im Warenkorb — dort entscheidet sich, ob der Schalter
     etwas tut. */
  await a.p.evaluate(() => { location.hash = "#/auswahl"; });
  await a.p.waitForTimeout(700);
  ok(await a.p.evaluate(() => !!document.getElementById("lStrasse")),
     "im Warenkorb steht jetzt das Adressformular");
  const bleibt = await lesen();
  ok(bleibt.sichtbar && bleibt.wahl === "liefern", "der Schalter steht auch auf anderen Seiten", bleibt.wahl);

  await a.p.click('[data-lieferwahl="haus"]');
  await a.p.waitForTimeout(950);
  const s2 = await lesen();
  ok(s2.modus === false && s2.wahl === "haus", "Besteck schaltet zurück ins Haus", "modus=" + s2.modus);
  ok(s2.nameText === "Im Haus", "Name beim Zurückschalten", s2.nameText);
  ok(await a.p.evaluate(() => !document.getElementById("lStrasse")),
     "und das Adressformular ist wieder fort");

  /* Tipp auf das schon gewählte Symbol: nichts ändert sich, aber der
     Name erklärt es. */
  await a.p.waitForTimeout(2000);
  await a.p.click('[data-lieferwahl="haus"]');
  await a.p.waitForTimeout(950);
  const s3 = await lesen();
  ok(s3.modus === false && s3.zeigt && s3.nameText === "Im Haus",
     "Tipp auf das gewählte Symbol zeigt nur den Namen", JSON.stringify([s3.modus, s3.nameText]));

  /* Tastatur wie in jeder Radiogruppe. */
  await a.p.focus('[data-lieferwahl="haus"]');
  await a.p.keyboard.press("ArrowRight");
  await a.p.waitForTimeout(200);
  const s4 = await a.p.evaluate(() => ({ modus: liefermodus,
    fokus: document.activeElement && document.activeElement.dataset.lieferwahl }));
  ok(s4.modus === true && s4.fokus === "liefern", "Pfeiltaste wechselt und nimmt den Fokus mit", JSON.stringify(s4));
  ok(a.echt().length === 0, "kein Fehler beim Umschalten", a.echt()[0] || "still");
  await a.ctx.close();

  /* Englisch: der Name kommt aus dem Wörterbuch, nicht deutsch stehen
     geblieben. */
  const en = await hubOhneModus(br, "chocolamour", LIEFER_AN);
  await en.p.evaluate(() => { spracheSetzen("en"); zeichne(); });
  await en.p.waitForTimeout(300);
  await en.p.click('[data-lieferwahl="liefern"]');
  await en.p.waitForTimeout(900);
  const sEn = await en.p.evaluate(() => ({
    name: document.querySelector(".lw-name").textContent.trim(),
    gruppe: document.getElementById("lieferwahl").getAttribute("aria-label"),
    haus: document.querySelector('[data-lieferwahl="haus"]').getAttribute("aria-label") }));
  ok(sEn.name === "Delivery" && sEn.gruppe === "Order type" && /restaurant/i.test(sEn.haus),
     "Englisch: Name und Beschriftungen übersetzt", JSON.stringify(sEn));

  /* Jede Sprache: passt der Name in die Pille? Nicht angenommen,
     an der gemalten Breite gemessen (white-space:nowrap, overflow
     hidden — ein zu langer Name würde still abgeschnitten). */
  const zuLang = await en.p.evaluate(() => {
    const n = document.querySelector(".lw-name"), sp = n.querySelector("span");
    const aus = [];
    for(const s of SPRACHEN){
      spracheSetzen(s.code); zeichne();
      for(const w of ["haus", "liefern"]){
        sp.textContent = lwNameText(w);
        if(sp.scrollWidth > n.clientWidth - 12) aus.push(s.code + ":" + sp.textContent + " " + sp.scrollWidth + "/" + (n.clientWidth - 12));
      }
    }
    for(const x of ["18:00–01:00", t("Gerade zu")]){
      sp.textContent = x;
      if(sp.scrollWidth > n.clientWidth - 12) aus.push(x);
    }
    spracheSetzen("de"); zeichne();
    return aus;
  });
  ok(zuLang.length === 0, "der Name passt in jeder Sprache in die Pille", zuLang.join(" | ") || "alle 12");
  await en.ctx.close();

  /* Tiefer Link #/liefern bzw. ?modus=liefern: der Schalter zeigt es. */
  const b2 = await hubAuf(br, "chocolamour", LIEFER_AN);
  const s5 = await b2.p.evaluate(() => ({ modus: liefermodus, wahl: document.getElementById("lieferwahl").dataset.wahl }));
  ok(s5.modus && s5.wahl === "liefern", "mit dem Lieferlink steht der Schalter auf Lieferung", s5.wahl);
  await b2.ctx.close();

  /* Am Tisch KEIN Schalter. Wer am Untersetzer sitzt, soll sich nicht
     zu sich nach Hause liefern lassen. */
  const c = await hubOhneModus(br, "chocolamour", LIEFER_AN, "?t=7");
  ok(await c.p.evaluate(() => document.getElementById("lieferwahl").hidden),
     "am Tisch steht kein Liefer-Schalter");
  await c.ctx.close();

  /* Haus liefert nicht → kein Schalter. Der häufigste Fall. */
  const d = await hubOhneModus(br, "chocolamour", undefined);
  const dd = await d.p.evaluate(() => {
    const w = document.getElementById("lieferwahl");
    return { hidden: w.hidden, display: getComputedStyle(w).display };
  });
  ok(dd.hidden && dd.display === "none", "ohne Liefereinstellung steht auch kein Schalter da", JSON.stringify(dd));
  await d.ctx.close();

  /* Außerhalb der Lieferzeit steht der Schalter TROTZDEM — und sagt
     die Uhrzeiten, im Namen und in der Beschriftung. */
  const jetzt = new Date();
  const hh = d2 => String(d2.getHours()).padStart(2,"0") + ":" +
                   String(d2.getMinutes()).padStart(2,"0");
  const zu = Object.assign({}, LIEFER_AN, { zeiten: {
    von: hh(new Date(jetzt.getTime() + 2*3600*1000)),
    bis: hh(new Date(jetzt.getTime() + 4*3600*1000)), tage: [] } });
  const e = await hubOhneModus(br, "chocolamour", zu);
  const s6 = await e.p.evaluate(() => ({
    jetzt: liefertGerade(), sichtbar: !document.getElementById("lieferwahl").hidden,
    label: document.querySelector('[data-lieferwahl="liefern"]').getAttribute("aria-label") }));
  ok(!s6.jetzt, "Voraussetzung: das Fenster ist gerade zu");
  ok(s6.sichtbar, "der Schalter steht auch außerhalb der Lieferzeit da");
  ok(s6.label.includes(zu.zeiten.von) && s6.label.includes(zu.zeiten.bis),
     "die Beschriftung nennt die Uhrzeiten", s6.label);
  await e.p.click('[data-lieferwahl="liefern"]');
  await e.p.waitForTimeout(900);
  const s6n = await e.p.evaluate(() => document.querySelector(".lw-name").textContent.trim());
  ok(s6n.includes(zu.zeiten.von) && s6n.includes(zu.zeiten.bis), "der aufblitzende Name nennt sie auch", s6n);
  await e.ctx.close();
}

/* ══════════════════════════════════════════════════════════════════
   DIE BEWEGUNG · Daumen, Kopie, Name

   Nur transform/opacity (Bewegungs-Skill §1). Die Symbolkopie im
   Daumen läuft gegenläufig mit derselben Kurve — gemessen MITTEN in
   der Bewegung, dass Daumen + Kopie = 0 bleibt (sonst stünden die
   Symbole während des Gleitens doppelt). Unterbrechbar, und bei
   reduzierter Bewegung sofort am Ziel, der Name trotzdem lesbar.
   ══════════════════════════════════════════════════════════════════ */
async function hubPille(br){
  console.log("\n══ Die Bewegung des Schalters ══");
  const h = await hubOhneModus(br, "chocolamour", LIEFER_AN);
  const x = sel => `(new DOMMatrix(getComputedStyle(document.querySelector("${sel}")).transform)).m41`;
  const eig = await h.p.evaluate(() => [".lw-daumen", ".lw-innen", ".lw-name"].map(s =>
    getComputedStyle(document.querySelector(s)).transitionProperty));
  ok(eig.every(e => e.split(",").every(p => /^\s*(transform|opacity)\s*$/.test(p))),
     "Übergänge nur auf transform und opacity", eig.join(" | "));
  await h.p.click('[data-lieferwahl="liefern"]');
  await h.p.waitForTimeout(110);
  const mitte = await h.p.evaluate(x => {
    const d = eval(x[0]), i = eval(x[1]);
    const laeuft = document.querySelector(".lw-daumen").getAnimations().some(a => a instanceof CSSTransition);
    const quetscht = document.querySelector(".lw-koerper").getAnimations().some(a => a instanceof CSSAnimation);
    return { d, i, laeuft, quetscht };
  }, [x(".lw-daumen"), x(".lw-innen")]);
  ok(mitte.laeuft && mitte.d > 0 && mitte.d < 60, "der Daumen gleitet (laufende Transition, unterwegs)", mitte.d.toFixed(1) + " px");
  ok(Math.abs(mitte.d + mitte.i) <= 0.5, "die Symbolkopie bleibt deckungsgleich (Daumen + Kopie = 0)",
     mitte.d.toFixed(2) + " + " + mitte.i.toFixed(2));
  ok(mitte.quetscht, "der Daumen staucht sich beim Losfahren");
  const origin = await h.p.evaluate(() => getComputedStyle(document.querySelector(".lw-name")).transformOrigin);
  ok(parseFloat(origin) > 40, "der Name wächst von der gewählten Seite aus (rechts)", origin);
  await h.p.waitForTimeout(700);
  const ende = await h.p.evaluate(x => ({ d: eval(x[0]), i: eval(x[1]) }), [x(".lw-daumen"), x(".lw-innen")]);
  ok(Math.abs(ende.d - 44) < 0.5 && Math.abs(ende.i + 44) < 0.5, "Endlage: Daumen auf dem Roller", ende.d + " / " + ende.i);

  /* Unterbrechen: sofort zurück — der letzte Tipp gewinnt, eine Uhr. */
  await h.p.click('[data-lieferwahl="haus"]');
  await h.p.waitForTimeout(60);
  await h.p.click('[data-lieferwahl="liefern"]');
  await h.p.waitForTimeout(60);
  await h.p.click('[data-lieferwahl="haus"]');
  await h.p.waitForTimeout(2500);
  const nach = await h.p.evaluate(x => ({ d: eval(x[0]), modus: liefermodus,
    zeigt: document.getElementById("lieferwahl").classList.contains("zeigt"),
    deckt: +getComputedStyle(document.querySelector(".lw-name")).opacity }), [x(".lw-daumen")]);
  ok(!nach.modus && Math.abs(nach.d) < 0.5 && !nach.zeigt && nach.deckt === 0,
     "drei schnelle Tipps: der letzte gewinnt, danach Ruhe", JSON.stringify(nach));
  ok(h.echt().length === 0, "kein Fehler in der Bewegung", h.echt()[0] || "still");
  await h.ctx.close();

  /* Reduzierte Bewegung: kein Gleiten, keine Stauchung, Name sofort. */
  const r = await hubOhneModus(br, "chocolamour", LIEFER_AN);
  await r.p.emulateMedia({ reducedMotion: "reduce" });
  await r.p.click('[data-lieferwahl="liefern"]');
  await r.p.waitForTimeout(40);
  const still = await r.p.evaluate(x => ({
    mq: matchMedia("(prefers-reduced-motion: reduce)").matches,
    d: eval(x[0]), deckt: +getComputedStyle(document.querySelector(".lw-name")).opacity,
    anim: document.querySelector(".lw-koerper").getAnimations().length +
          document.querySelector(".lw-daumen").getAnimations().length }), [x(".lw-daumen")]);
  ok(still.mq, "Voraussetzung: reduzierte Bewegung ist wirklich an");
  if(still.mq){
    ok(Math.abs(still.d - 44) < 0.5 && still.anim === 0, "reduzierte Bewegung: sofort am Ziel, nichts läuft",
       JSON.stringify(still));
    ok(still.deckt === 1, "und der Name ist trotzdem zu lesen", "opacity " + still.deckt);
  }
  await r.ctx.close();
}

/* ══════════════════════════════════════════════════════════════════
   KONTRAST DES SCHALTERS · beide Häuser, beide Phasen
   (früher: des Bandes — der Vorfall darunter gilt weiter)

   VORFALL, und er war meiner. Das Band trug im eingeschalteten
   Zustand „color:var(--gold)" auf „background:var(--gold-flaeche)" —
   Gold auf goldgetönter Fläche. Gemessen: Choco 2,02:1, Blend
   1,00:1. Bei Blend war der Titel buchstäblich unsichtbar; dessen
   Hauptfarbe ist ein helles Grün, aus dem --gold-flaeche gemischt
   wird. Genau §5.1, und zehn Zeilen darüber stand mein eigener
   Kommentar, der davor warnt.

   Warum pruef-lesbarkeit.js es NICHT fand: Sie fährt über die Seite,
   wie sie ohne Datenbank aussieht — und ohne Datenbank ist
   LIEFER.an false, also ist das Band gar nicht da. Eine Prüfung war
   grün, weil der Gegenstand fehlte (§8.1g). Deshalb wird hier
   gemessen, wo das Band wirklich steht.
   ══════════════════════════════════════════════════════════════════ */
const lum = c => { const [r,g,b] = c.map(v => { v /= 255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
  return 0.2126*r + 0.7152*g + 0.0722*b; };
/* Farbe mit Deckkraft lesen. Eine Glasfläche (color-mix mit
   transparent) gibt Chromium als „color(srgb 0.97 0.95 0.93 / 0.82)"
   zurück, Werte 0..1. Die erste Fassung las jede Farbe per /\d+/ —
   daraus wurde 0, 97, 0 … und ein Kontrast, den es nicht gibt
   (dieselbe Falle steht in pruef-glas.js). */
const zuRGBA = t => {
  t = String(t);
  const s = t.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
  if(s) return [s[1]*255, s[2]*255, s[3]*255, s[4] !== undefined ? +s[4] : 1];
  const r = t.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if(r) return [+r[1], +r[2], +r[3], r[4] !== undefined ? +r[4] : 1];
  throw new Error("Farbe nicht lesbar: " + t);
};
const zuRGB = t => zuRGBA(t).slice(0,3);
/* Schichten von oben nach unten übereinander mischen, bis eine deckt. */
const gemalt = schichten => {
  let aus = [255,255,255], rest = 1, summe = [0,0,0];
  for(const c of schichten){
    const [r,g,b,a] = zuRGBA(c);
    summe = [summe[0] + r*a*rest, summe[1] + g*a*rest, summe[2] + b*a*rest];
    rest *= (1 - a);
    if(rest < 0.001) break;
  }
  aus = summe.map((v,i) => v + aus[i]*rest);
  return "rgb(" + aus.map(v => v.toFixed(2)).join(", ") + ")";
};
const kontrast = (a, b) => {
  const l1 = lum(zuRGB(a)), l2 = lum(zuRGB(b));
  return (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
};

async function bandKontrast(br){
  console.log("\n══ Kontrast des Schalters ══");
  for(const haus of ["chocolamour", "blend"]){
    for(const phase of ["tag", "abend"]){
      const h = await hubOhneModus(br, haus, LIEFER_AN);
      /* VORFALL in dieser Prüfung selbst (Band-Zeit): Hier stand einmal
         eine Funktion, die es im Hub nicht gibt, und die Abend-Hälfte
         maß viermal den Tag (§8.1g). Umgeschaltet wird über den echten
         Schalter des Gastes, und die Voraussetzung wird gemessen. */
      const phaseDa = await h.p.evaluate(ph => {
        lichtSetzen(ph === "abend" ? "dunkel" : "hell");
        return document.body.dataset.phase;
      }, phase);
      await h.p.waitForTimeout(500);
      ok(phaseDa === phase, "Voraussetzung: " + haus + " steht wirklich auf " + phase, phaseDa);
      await h.p.evaluate(() => {
        const w = document.getElementById("lieferwahl");
        w.querySelector(".lw-name span").textContent = "Lieferung";
        w.classList.add("zeigt");
      });
      await h.p.waitForTimeout(900);
      const m = await h.p.evaluate(() => {
        const g = el => getComputedStyle(el);
        const w = document.getElementById("lieferwahl");
        const schichten = [];
        for(let n = w; n; n = n.parentElement){
          const c = g(n).backgroundColor;
          if(c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) schichten.push(c);
        }
        const k = w.querySelector(".lw-koerper"), n = w.querySelector(".lw-name");
        return { spur: schichten, symbol: g(w.querySelector('[data-lieferwahl="liefern"]')).color,
                 daumen: g(k).backgroundColor, daumenSymbol: g(k).color,
                 name: g(n).backgroundColor, nameSchrift: g(n).color };
      });
      await h.ctx.close();
      const wo = haus + " · " + phase + " · ";
      const spur = gemalt(m.spur);
      const k1 = kontrast(m.symbol, spur), k2 = kontrast(m.daumenSymbol, m.daumen), k3 = kontrast(m.nameSchrift, m.name);
      /* Symbole sind Bedienelemente ohne Text: 3:1 (WCAG 1.4.11) auf der
         Spur. Symbol im Daumen und der Name sind dasselbe Paar wie
         Schrift auf Band: 4,5:1. */
      ok(k1 >= 3, wo + "Symbol auf der Spur ≥ 3:1", k1.toFixed(2) + ":1");
      ok(k2 >= 4.5, wo + "Symbol im Daumen ≥ 4,5:1", k2.toFixed(2) + ":1");
      ok(k3 >= 4.5, wo + "Name in der Pille ≥ 4,5:1", k3.toFixed(2) + ":1");
    }
  }
}

/* ══════════════════════════════════════════════════════════════════
   DIE ADRESSE · /liefern
   ══════════════════════════════════════════════════════════════════ */
function adresse(){
  console.log("\n══ Die Adresse /liefern ══");
  const um = fs.readFileSync(path.join(OBEN, "auslieferung", "_redirects"), "utf8");
  const zeilen = um.split("\n").filter(z => z.trim() && !z.trim().startsWith("#"));

  /* ZWEITE QUELLE (§8.1b): nicht die Regeln zaehlen, sondern die
     erzeugten Haeuser. Jeder Ordner unter dist/ ist ein Kunde, und
     jeder Kunde braucht einen Liefer-Link. Eine Schleife ueber das
     Vorhandene haette „Zeile vergessen" nie gefunden. */
  const haeuser = fs.readdirSync(path.join(OBEN, "dist"))
    .filter(d => fs.existsSync(path.join(OBEN, "dist", d, "index.html")));

  /* Erst der Weg ohne eigene Adresse: eine Regel fuer alle. */
  ok(zeilen.some(z => /^\/h\/:slug\/liefern/.test(z.trim())),
     "Haeuser ohne eigene Adresse haben /h/<slug>/liefern");

  /* Und jetzt der Punkt, an dem mein erster Versuch VERSAGT hat:
     Die Probe „hat irgendeine Regel" blieb gruen, als ich Blends
     Zeile testweise loeschte — die allgemeine /h/:slug-Regel deckte
     sie ab. Sie deckt aber nur omoteno.de ab, NICHT die eigene
     Adresse des Kunden.

     Dort schluckt die Hub-Regel („…/* → /h/<slug>/:splat 200!") den
     Pfad /liefern und liefert /h/<slug>/liefern aus — es gibt die
     Datei nicht. Genau der Vorfall aus §8.1b, nur eine Ebene
     weiter: Es fehlt eine ZEILE, und ueber etwas, das nicht
     dasteht, iteriert keine Schleife.

     Zweite Quelle sind deshalb die HUB-REGELN: Wer eine eigene
     Adresse hat, braucht dort auch einen Liefer-Link. */
  const eigene = [];
  zeilen.forEach(z => {
    const m = z.match(/^(https:\/\/[^\s\/]+)\/\*\s+\/h\/([a-z0-9-]+)\//);
    if(m) eigene.push({ domain: m[1], haus: m[2] });
  });
  ok(eigene.length > 0, "die Kundenadressen sind lesbar",
     eigene.map(e => e.haus).join(", ") || "keine gefunden");

  eigene.forEach(e => {
    const hat = zeilen.some(z => z.startsWith(e.domain + "/liefern"));
    ok(hat, "„" + e.haus + "“ hat /liefern auf seiner EIGENEN Adresse",
       hat ? e.domain + "/liefern" : "fehlt — die Hub-Regel schluckt es");
  });

  /* Und jedes erzeugte Haus muss ueberhaupt irgendwie erreichbar
     sein — entweder ueber eine eigene Adresse oder ueber /h/. */
  haeuser.forEach(h => {
    const erreichbar = eigene.some(e => e.haus === h) ||
      zeilen.some(z => /^\/h\/:slug/.test(z.trim()));
    ok(erreichbar, "„" + h + "“ ist ueberhaupt erreichbar");
  });

  /* Und die Regel muss den Modus wirklich mitgeben — ein /liefern,
     das ohne ?modus=liefern landet, zeigt die gewoehnliche
     Tischfrage, und niemand merkt es. */
  const lz = zeilen.filter(z => /\/liefern/.test(z));
  ok(lz.length > 0 && lz.every(z => /modus=liefern/.test(z)),
     "jede Liefer-Regel gibt ?modus=liefern mit", lz.length + " Regeln");

  /* 301 und nicht 200: Bei einem Umschreiben bleibt die Adresse
     stehen, der Hub sieht die Zielabfrage NIE, und BILDER.basis ist
     relativ — die Karte kaeme ohne Bilder. */
  ok(lz.every(z => /\b301/.test(z)),
     "und springt sichtbar (301), statt still umzuschreiben (200)",
     lz.every(z => /\b301/.test(z)) ? "alle 301" : "ein 200 dabei");

  /* Reihenfolge: Die Liefer-Regel muss VOR der Hub-Regel desselben
     Hauses stehen, sonst schluckt die den Pfad. */
  const iLief = zeilen.findIndex(z => /\/liefern/.test(z));
  const iHub  = zeilen.findIndex(z => /200!/.test(z) && /\/h\//.test(z));
  ok(iLief > -1 && iHub > -1 && iLief < iHub,
     "die Liefer-Regel steht vor der Hub-Regel",
     "Liefern Zeile " + iLief + ", Hub Zeile " + iHub);
}

async function hubZu(br){
  console.log("\n══ Der Hub · außerhalb der Lieferzeit ══");
  /* Ein Fenster, das JETZT sicher geschlossen ist, wird aus der
     aktuellen Uhrzeit gerechnet — eine feste Uhrzeit hinzuschreiben
     wäre eine Prüfung, die zwei Stunden am Tag lügt. */
  const jetzt = new Date();
  const in2h  = new Date(jetzt.getTime() + 2*3600*1000);
  const in4h  = new Date(jetzt.getTime() + 4*3600*1000);
  const hh = d => String(d.getHours()).padStart(2,"0") + ":" +
                  String(d.getMinutes()).padStart(2,"0");
  const zu = Object.assign({}, LIEFER_AN,
    { zeiten: { von: hh(in2h), bis: hh(in4h), tage: [] } });

  const h = await hubAuf(br, "chocolamour", zu);
  const stand = await h.p.evaluate(() => ({
    jetzt: liefertGerade(),
    aus:   !!document.querySelector('[data-aktion="bestellen"][disabled]'),
    text:  document.querySelector(".seite").textContent
  }));
  ok(!stand.jetzt, "liefertGerade() sagt nein");
  ok(stand.aus, "der Bestellknopf ist aus, statt ins Leere zu führen");
  ok(/liefern gerade nicht/i.test(stand.text),
     "und der Gast liest, warum — mit den Uhrzeiten");
  ok(new RegExp(zu.zeiten.von.replace(":", ":")).test(stand.text),
     "das Fenster steht im Klartext da", zu.zeiten.von + "–" + zu.zeiten.bis);
  await h.ctx.close();
}

async function hubAmTisch(br){
  console.log("\n══ Der Untersetzer gewinnt ══");
  /* Wer über ?t=7 hereinkommt, SITZT im Lokal. Ein Adressformular
     wäre dort schlicht falsch — und ?modus=liefern steht in der
     Adresszeile, also könnte es jeder anhängen. */
  const h = await hubAuf(br, "chocolamour", LIEFER_AN, "&t=7");
  const stand = await h.p.evaluate(() => ({
    modus: liefermodus,
    adresse: !!document.getElementById("lStrasse"),
    tisch: (document.querySelector(".seite").textContent.match(/Tisch\s*7/) || [""])[0]
  }));
  ok(!stand.modus, "am Tisch ist der Liefermodus aus, auch mit ?modus=liefern");
  ok(!stand.adresse, "kein Adressformular am Tisch");
  ok(!!stand.tisch, "stattdessen steht die Tischnummer da", stand.tisch || "fehlt");
  await h.ctx.close();
}

/* ═══════════════════════════════════════════════════════════════════
   3 · DIE NAHT · Board, Hub und Küche über dieselbe Form
   ═══════════════════════════════════════════════════════════════════ */
function naht(){
  console.log("\n══ Die Naht · dasselbe Feld auf beiden Seiten ══");
  const adm = fs.readFileSync(path.join(SEITEN, "admin.html"), "utf8");
  const hub = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");
  const kue = fs.readFileSync(path.join(SEITEN, "kueche.html"), "utf8");

  /* Was lfSichern() schreibt, muss karteHolen() lesen. Beide Listen
     kommen aus den Dateien, keine ist von mir hingeschrieben — sonst
     prüfte ich meine Erinnerung gegen meine Erinnerung (§8.1i). */
  const schreibt = (adm.match(/an:\s*an\("lfAn"\)[\s\S]{0,400}?\n\s*\};/) || [""])[0];
  const felder = ["an","plz","mindest","gebuehr","gratis_ab","dauer_min","bar","karte"];
  const fehlend = felder.filter(f => !new RegExp("\\b" + f + ":").test(schreibt));
  ok(fehlend.length === 0, "das Board schreibt jedes Feld, das der Hub kennt",
     fehlend.length ? "fehlt: " + fehlend.join(", ") : felder.length + " Felder");

  const liest = felder.filter(f => new RegExp("lf\\." + f + "\\b").test(hub));
  ok(liest.length === felder.length, "und der Hub liest jedes davon",
     liest.length + "/" + felder.length);

  /* Die eine Zeile, an der der ganze Block hing: Ohne „lieferung" im
     Filter der Küche wäre der Bon im Board sichtbar und am Herd
     unsichtbar. Ein Bon, den niemand kocht. */
  ok(/quelle=in\.\([^)]*lieferung/.test(kue),
     "die Küche fragt Lieferbestellungen überhaupt ab");
  ok(/liefer_adresse/.test(kue) && /liefergebuehr/.test(kue),
     "und holt die Spalten dazu mit");

  /* Die Gebühr ist Geld. Sie darf nur aus der Spalte kommen, nie aus
     einer Zahl des Browsers (§2.3a — dort gingen 99 Stück für 1 Cent
     durch, weil eine Zahl aus dem Browser geglaubt wurde). */
  ok(!/p_gebuehr|p_liefergebuehr/.test(hub),
     "der Hub schickt KEINE Gebühr mit — die rechnet der Server");
}

(async () => {
  for(const h of ["chocolamour", "blend"]){
    if(!fs.existsSync(path.join(OBEN, "dist", h, "index.html"))){
      console.log("dist/" + h + "/index.html fehlt — erst „node erzeuger/erzeuge-hub.js --alle“.");
      process.exit(1);
    }
  }
  naht();
  adresse();
  const br = await chromium.launch();
  await board(br);
  await hubOhneMigration(br);
  await hubImGebiet(br);
  await hubZu(br);
  await hubAmTisch(br);
  await hubUmschalter(br);
  await hubPille(br);
  await bandKontrast(br);

  /* Zwei Häuser, nicht eines. Ein Test mit einem Kunden sieht jede
     eingebrannte Fremdangabe für richtig an (§8.1a). */
  console.log("\n══ Das zweite Haus · Blend im Liefermodus ══");
  const b = await hubAuf(br, "blend", LIEFER_AN);

  /* VORAUSSETZUNG, und sie wird GEPRÜFT, nicht angenommen (§8.1g,
     Vorfall C): Blends Markenblatt trägt keine „zeiten" — der Hub
     hält das Haus deshalb für geschlossen und zeigt gar kein
     Bestellfeld. Mein erster Anlauf meldete darum „0 Felder" und ich
     hätte den Fehler im Liefermodus gesucht, wo keiner war.

     Die Öffnungszeiten werden hier zur Laufzeit gesetzt — Blends
     Markenblatt anzufassen wäre eine Änderung an den Daten eines
     Kunden, nur damit ein Test grün wird. Und danach wird gemessen,
     dass die Voraussetzung wirklich gilt: Sonst meldet die Prüfung
     „nichts gefunden" und das klingt wie „geschlossen". */
  const vor = await b.p.evaluate(() => {
    ZEITEN.length = 0;
    for(let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59");
    zeichne();
    return { stopp: !!bestellStopp() };
  });
  ok(!vor.stopp, "Voraussetzung: mit Öffnungszeiten nimmt Blend Bestellungen an",
     vor.stopp ? "gilt NICHT — die Folgeproben sagen nichts aus" : "gilt");

  await b.p.waitForTimeout(400);
  const bs = await b.p.evaluate(() => ({
    an: LIEFER.an,
    felder: ["lName","lStrasse","lPlz","lOrt","lTelefon"]
              .filter(i => !!document.getElementById(i)).length,
    titel: document.title
  }));
  ok(!vor.stopp && bs.an && bs.felder === 5,
     "auch Blend liefert, mit denselben Feldern", bs.felder + " Felder");
  ok(!/Choco/i.test(bs.titel), "und trägt dabei keinen fremden Namen", bs.titel);

  /* Der eigentliche Grund, warum dieses zweite Haus hier steht: Der
     Slug stand einmal fest im Gerüst, und Blend fragte damit den
     Betrieb des ERSTEN Hauses ab. Choco sah dabei richtig aus. */
  const eigen = await b.p.evaluate(() => ({
    haus: HAUS, server: SERVER.betrieb, dbslug: OMOTENO_DB.slug,
    korb: MERK_SCHLUESSEL, adresse: LIEFERADRESSE_SCHLUESSEL
  }));
  const alleEigen = Object.values(eigen).every(w => /blend/.test(String(w)));
  ok(alleEigen, "jeder Hausname in Blends Hub ist Blends eigener",
     JSON.stringify(eigen));
  await b.ctx.close();

  await br.close();
  console.log(fehler === 0
    ? "\n✓ Der Lieferweg trägt — Einstellung, Absagen, Bestellung, beide Häuser."
    : "\n✗ " + fehler + " Fehler.");
  process.exit(fehler ? 1 : 0);
})();
