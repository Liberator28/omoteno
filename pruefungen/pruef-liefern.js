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
  console.log("\n══ Der sichtbare Umschalter ══");

  /* 1 · Haus liefert, Gast nicht am Tisch → Band da, fuehrt HINEIN.
         Seit "#/liefern" eine echte Hash-Route ist (statt eines vollen
         Seiten-Neuaufbaus über "?modus=liefern"), wird hier wirklich
         GEKLICKT und der neue Zustand gemessen — ein bloßer Blick auf
         href haette den Fall verpasst, in dem der Klick zwar navigiert,
         aber liefermodus() nie wirklich wahr wird (CLAUDE.md §8.1g:
         eine Probe, die den echten Fehler nicht treffen kann, ist
         keine Probe). */
  const a = await hubOhneModus(br, "chocolamour", LIEFER_AN);
  const s1vorher = await a.p.evaluate(() => {
    const b = document.querySelector(".lieferband");
    return b ? { da:true, ziel:b.getAttribute("href"),
                 text:b.textContent.replace(/\s+/g," ").trim(),
                 an:b.classList.contains("an"),
                 hoch:Math.round(b.getBoundingClientRect().height) }
             : { da:false };
  });
  ok(s1vorher.da, "ohne Liefermodus steht das Band auf der Startseite");
  ok(s1vorher.ziel === "#/liefern",
     "und sein Ziel ist die echte Hash-Route", s1vorher.ziel || "kein Ziel");
  ok(!s1vorher.an, "es sieht dabei nicht aus wie der eingeschaltete Zustand");
  ok(s1vorher.hoch >= 44, "und man kann es antippen", s1vorher.hoch + " px hoch");

  await a.p.click(".lieferband");
  await a.p.waitForTimeout(500);
  const s1nachher = await a.p.evaluate(() => ({
    modus: liefermodus, hash: location.hash, suche: location.search,
    an: (document.querySelector(".lieferband") || {}).classList
          ? document.querySelector(".lieferband").classList.contains("an") : false
  }));
  ok(s1nachher.modus === true, "der Klick schaltet liefermodus wirklich ein",
     "modus=" + s1nachher.modus);
  ok(s1nachher.an, "und das Band zeigt danach den eingeschalteten Zustand");
  ok(!s1nachher.hash && !s1nachher.suche,
     "die Adresse räumt sich danach auf (kein #/liefern, kein ?modus hängen)",
     JSON.stringify({hash:s1nachher.hash, suche:s1nachher.suche}));
  ok(a.echt().length === 0, "kein Fehler beim Umschalten", a.echt()[0] || "still");
  await a.ctx.close();

  /* 2 · Im Liefermodus fuehrt dasselbe Band ZURUECK — jetzt ein
         <button>, kein <a href> mehr (siehe lieferBandHTML): zwei
         Wege für denselben Klick (JS-Abschalten UND native
         Hash-Navigation) waeren sonst nie ganz dasselbe Ziel gewesen. */
  const b2 = await hubAuf(br, "chocolamour", LIEFER_AN);
  await b2.p.evaluate(() => { location.hash = "#/"; });
  await b2.p.waitForTimeout(700);
  const s2vorher = await b2.p.evaluate(() => {
    const b = document.querySelector(".lieferband");
    return b ? { da:true, istKnopf: b.tagName === "BUTTON",
                 hatHref: b.hasAttribute("href"),
                 an:b.classList.contains("an") } : { da:false };
  });
  ok(s2vorher.da && s2vorher.an, "im Liefermodus traegt das Band den eingeschalteten Zustand");
  ok(s2vorher.istKnopf && !s2vorher.hatHref,
     "es ist ein Knopf ohne eigenes Sprungziel, nicht mehr ein Link");

  await b2.p.click(".lieferband.an");
  await b2.p.waitForTimeout(500);
  const s2nachher = await b2.p.evaluate(() => ({
    modus: liefermodus, hash: location.hash,
    an: !!document.querySelector(".lieferband.an")
  }));
  ok(s2nachher.modus === false, "der Klick schaltet liefermodus wirklich aus",
     "modus=" + s2nachher.modus);
  ok(s2nachher.hash === "#/", "und führt zurück auf die Startseite", s2nachher.hash);
  ok(!s2nachher.an, "das Band zeigt danach wieder den ausgeschalteten Zustand");
  ok(b2.echt().length === 0, "kein Fehler beim Zurückschalten", b2.echt()[0] || "still");
  await b2.ctx.close();

  /* 3 · Am Tisch KEIN Band. Wer am Untersetzer sitzt, soll sich
         nicht zu sich nach Hause liefern lassen. */
  const c = await hubOhneModus(br, "chocolamour", LIEFER_AN, "?t=7");
  ok(!(await c.p.evaluate(() => !!document.querySelector(".lieferband"))),
     "am Tisch steht kein Lieferband");
  await c.ctx.close();

  /* 4 · Haus liefert nicht → kein Band. Der haeufigste Fall von
         allen: Die meisten Haeuser liefern nicht. */
  const d = await hubOhneModus(br, "chocolamour", undefined);
  ok(!(await d.p.evaluate(() => !!document.querySelector(".lieferband"))),
     "ohne Liefereinstellung steht auch kein Band da");
  await d.ctx.close();

  /* 5 · Ausserhalb der Lieferzeit steht das Band TROTZDEM — mit den
         Uhrzeiten. Ein Band, das verschwindet, laesst den Gast
         raetseln, ob es je eines gab. */
  const jetzt = new Date();
  const hh = d2 => String(d2.getHours()).padStart(2,"0") + ":" +
                   String(d2.getMinutes()).padStart(2,"0");
  const zu = Object.assign({}, LIEFER_AN, { zeiten: {
    von: hh(new Date(jetzt.getTime() + 2*3600*1000)),
    bis: hh(new Date(jetzt.getTime() + 4*3600*1000)), tage: [] } });
  const e = await hubOhneModus(br, "chocolamour", zu);
  const s5 = await e.p.evaluate(() => {
    const b = document.querySelector(".lieferband");
    return { da: !!b, text: b ? b.textContent : "", jetzt: liefertGerade() };
  });
  ok(!s5.jetzt, "Voraussetzung: das Fenster ist gerade zu");
  ok(s5.da, "das Band steht auch ausserhalb der Lieferzeit da");
  ok(new RegExp(zu.zeiten.von).test(s5.text),
     "und nennt die Uhrzeiten statt einzuladen",
     s5.text.replace(/\s+/g," ").trim().slice(0, 54));
  await e.ctx.close();
}

/* ══════════════════════════════════════════════════════════════════
   KONTRAST DES BANDES · beide Häuser, beide Phasen, beide Zustände

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
const zuRGB = t => (String(t).match(/\d+/g) || [0,0,0]).slice(0,3).map(Number);
const kontrast = (a, b) => {
  const l1 = lum(zuRGB(a)), l2 = lum(zuRGB(b));
  return (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
};

async function bandKontrast(br){
  console.log("\n══ Kontrast des Bandes ══");
  for(const haus of ["chocolamour", "blend"]){
    for(const phase of ["tag", "abend"]){
      for(const modus of ["aus", "an"]){
        const h = modus === "an"
          ? await hubAuf(br, haus, LIEFER_AN)
          : await hubOhneModus(br, haus, LIEFER_AN);
        await h.p.evaluate(ph => {
          document.body.dataset.phase = ph;
          document.documentElement.dataset.phase = ph;
          if(typeof paletteAnwenden === "function") paletteAnwenden(ph);
          location.hash = "#/";
        }, phase);
        await h.p.waitForTimeout(600);
        const m = await h.p.evaluate(() => {
          const b = document.querySelector(".lieferband");
          if(!b) return null;
          const g = el => getComputedStyle(el);
          /* Der wirklich GEMALTE Grund: durchsichtige Flächen
             durchlaufen, bis eine Farbe kommt. Wer am Element misst,
             bekommt „rgba(0,0,0,0)" und rechnet gegen Schwarz —
             dieselbe Lehre wie §5.2b. */
          const grund = el => { let n = el;
            while(n){ const c = g(n).backgroundColor;
              if(c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
              n = n.parentElement; }
            return "rgb(255, 255, 255)"; };
          return { band: grund(b),
                   titel: g(b.querySelector(".lbt b")).color,
                   unter: g(b.querySelector(".lbt span")).color };
        });
        await h.ctx.close();
        const wo = haus + " · " + phase + " · Modus " + modus;
        if(!m){ ok(false, wo, "kein Band gefunden"); continue; }
        const kt = kontrast(m.titel, m.band), ku = kontrast(m.unter, m.band);
        ok(kt >= 4.5 && ku >= 4.5, wo,
           "Titel " + kt.toFixed(2) + ":1, Unterzeile " + ku.toFixed(2) + ":1");
      }
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
