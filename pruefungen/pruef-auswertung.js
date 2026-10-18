/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Auswertung, Einstellungen, Rundung  (Board, ohne Netz)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-auswertung.js

   1  Rechnung (awAuswerten mit gestellten Zeilen): Liefergebühr zählt,
      Rabatt abgezogen, storniert UND abgelehnt raus, Serviceruf ohne
      Umsatz, Vorzeitraum gleich lang und nur so weit gelaufen wie jetzt.
      Dazu die Naht: awLaden fragt die Geldspalten wirklich ab.
   2  Befunde gegen die Karte als zweite Quelle (§8.1b), Schwelle.
   3  Handeln: Bearbeiten / Heute aus / Als Aktion treffen das richtige
      Gericht. Ziel „2.800“ = 2800 €. CSV: BOM, „;“, Dezimalkomma,
      keine Gastdaten.
   4  Bild: kein Überlauf bei 360/390/768/1280, gleich hohe Kacheln,
      Tapflächen ≥ 44 px, Schrift auf Glas ≥ 4,5:1 gegen den wirklich
      gemalten Grund (Tag und Abend), keine Laufzeitfehler.
   5  Einstellungen: jede Zeile der Übersicht führt zu einem Bereich,
      der Zustand folgt dem Schalter; jede Tafel ist scrollbar (Safari-
      Leiste, siehe admin.html .tafel); das Figuren-Rad formt ohne
      Transition und wählt am Ende die Mitte.
   6  Rundung: --ecke und --ecke-pille in allen sechs Dateien gleich.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");

/* Seit 18.10. liegt jede Einstellungsgruppe hinter einer Kachel. Öffnet
   die Unterseite, in der `sel` steht — über einen ECHTEN Tipp auf die
   Kachel (vorher „Alle Einstellungen“, falls eine andere offen ist).
   Gibt false, wenn es die Gruppe nicht gibt (Voraussetzung, §8.1g). */
async function euZu(p, sel) {
  const id = await p.evaluate(s => {
    const el = document.querySelector(s);
    const g = el && el.closest("#t-einstellungen > .egruppe");
    return g && !g.classList.contains("eu-uebersicht") ? g.id : null;
  }, sel);
  if (!id) return false;
  if (await p.evaluate(i => document.getElementById("t-einstellungen").dataset.euOffen === i, id)) return true;
  if (await p.isVisible("#euZurueck")) await p.click("#euZurueck");
  await p.click('[data-eu-seite="' + id + '"]');
  await p.waitForTimeout(150);
  return p.evaluate(i => document.getElementById("t-einstellungen").dataset.euOffen === i, id);
}
const fs = require("fs");
const path = require("path");
const OBEN = path.resolve(__dirname, "..");
const ADMIN = "file://" + path.join(OBEN, "seiten", "admin.html");

let n = 0, f = 0;
const pruef = (gut, text, mehr) => { n++; if(!gut) f++;
  console.log((gut ? "  ok   " : "  FEHL ") + text + (mehr !== undefined ? "  → " + mehr : "")); };

async function board(br, breite, hell, tafel){
  const ctx = await br.newContext({ viewport:{ width:breite, height:844 }, acceptDownloads:true });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto(ADMIN);
  await p.waitForTimeout(700);
  await p.evaluate(([t, h]) => {
    document.getElementById("tor").hidden = true;
    demoStarten(); zeichneAlles();
    const s = document.getElementById("scharf"); if(s) s.hidden = true;
    document.body.classList.toggle("hell", h);
    tafelZeigen(t);
  }, [tafel, hell]);
  await p.waitForTimeout(700);
  return { p, ctx, fehler };
}

const lum = c => { const v = c.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); });
  return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
const kontrast = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };

(async () => {
  const br = await chromium.launch();

  /* ── 6 · Rundung: ein Wert, sechs Dateien ── */
  console.log("\n══ Rundung ══");
  const dateien = ["admin","kueche","konto","marken-studio","omoteno-web","start"];
  const werte = dateien.map(d => {
    const s = fs.readFileSync(path.join(OBEN, "seiten", d + ".html"), "utf8");
    return { d, ecke:(s.match(/--ecke:([^;]+);/) || [])[1], pille:(s.match(/--ecke-pille:([^;]+);/) || [])[1] };
  });
  pruef(werte.every(w => w.ecke === werte[0].ecke && w.ecke !== "0px"), "--ecke überall gleich und rund",
    werte.map(w => w.d + "=" + w.ecke).join(" "));
  pruef(werte.every(w => w.pille === "999px"), "--ecke-pille überall da", werte.map(w => w.d + "=" + w.pille).join(" "));

  /* ── 1 · Rechnung ── */
  console.log("\n══ Rechnung ══");
  let b = await board(br, 390, false, "auswertung");
  const quelle = fs.readFileSync(path.join(OBEN, "seiten", "admin.html"), "utf8");
  pruef(/AW_SPALTEN\s*=\s*"[^"]*liefergebuehr[^"]*rabatt_betrag/.test(quelle),
    "awLaden fragt liefergebuehr und rabatt_betrag wirklich ab (die alte Fassung nicht)");
  const r = await b.p.evaluate(() => {
    const von = new Date(2026, 8, 20, 0, 0), bis = new Date(2026, 8, 21, 0, 0);
    const z = (h, o) => Object.assign({ id:"x" + Math.random(), quelle:"tisch", status:"fertig", summe:10,
      liefergebuehr:0, rabatt_betrag:0, zeitpunkt:new Date(2026, 8, 20, h, 5).toISOString(), positionen:[] }, o);
    const zeilen = [
      z(12, { summe:20, positionen:[{ name:"Waffel", menge:2, preis:10 }] }),
      z(13, { quelle:"lieferung", summe:15, liefergebuehr:2.5, positionen:[{ name:"Crêpe (Nutella)", menge:1, preis:15 }] }),
      z(14, { summe:30, rabatt_betrag:5 }),
      z(15, { status:"storniert", summe:99 }),
      z(16, { status:"abgelehnt", summe:88 }),
      z(17, { quelle:"service", summe:0 }),
      z(9,  { summe:1000, zeitpunkt:new Date(2026, 8, 19, 12).toISOString() })   // außerhalb
    ];
    return awAuswerten(zeilen, von, bis);
  });
  pruef(Math.abs(r.umsatz - 62.5) < 1e-9, "Umsatz = 20 + (15 + 2,50 Liefergebühr) + (30 − 5 Rabatt)", r.umsatz);
  pruef(r.bestellungen === 3, "drei Bestellungen — storniert, abgelehnt, Serviceruf zählen nicht", r.bestellungen);
  pruef(r.storno === 2 && r.service === 1, "storniert+abgelehnt = 2, Serviceruf = 1 (getrennt ausgewiesen)",
    r.storno + " / " + r.service);
  pruef(r.gerichte["Crêpe"] && r.gerichte["Crêpe"].n === 1 && r.gerichte["Waffel"].umsatz === 20,
    "Gerichte: Toppings abgeschnitten, Umsatz aus Preis × Menge", JSON.stringify(Object.keys(r.gerichte)));
  const fen = await b.p.evaluate(() => { awZeitraum = "woche"; const w = awFenster();
    awZeitraum = "heute"; const h = awFenster();
    return { wTage:w.tage, wGleich:(w.von - w.vorherVon) === (w.ende - w.von) || Math.abs((w.von - w.vorherVon) - (w.ende - w.von)) <= 3600e3,
             hLauf:(h.vorherBis - h.vorherVon) === (h.bis - h.von) }; });
  pruef(fen.wTage === 7 && fen.wGleich, "7 Tage gegen die 7 Tage davor", JSON.stringify(fen));
  pruef(fen.hLauf, "heute nur bis jetzt gegen gestern bis zur selben Uhrzeit");

  /* ── 2 · Befunde ── */
  console.log("\n══ Befunde ══");
  await b.p.click('[data-zeitraum="monat"]');
  await b.p.waitForTimeout(700);
  const bef = await b.p.evaluate(() => {
    const L = awLetzte;
    const nie = gerichte.filter(g => Number(g.preis) > 0 && g.verfuegbar !== false && !L.jetzt.gerichte[g.name]).map(g => g.name);
    const texte = [...document.querySelectorAll(".aw-befund")].map(x => x.textContent.replace(/\s+/g, " "));
    const liste = awBefunde(L.jetzt, L.davor, L.f);
    const laeuft = liste.find(x => x.etikett === "Läuft gut");
    return { nie, texte, laeuftN: laeuft ? L.jetzt.gerichte[laeuft.titel].n : null, min: AW_LAEUFT_MIN };
  });
  pruef(bef.nie.length > 0, "Voraussetzung: die Beispielkarte hat Gerichte, die nie bestellt wurden", bef.nie.join(", "));
  pruef(bef.texte.some(t => bef.nie.some(nm => t.includes(nm)) || /Gerichte wurden nie bestellt/.test(t)),
    "„nie bestellt“ nennt ein Gericht, das NUR in der Karte steht (zweite Quelle)");
  /* Eine Probe, die den Fehler TREFFEN kann (§8.1g): A wächst stärker
     (+2), liegt aber unter der Schwelle; B wächst nur um 1, liegt
     darüber. Ohne Schwelle würde A genannt. */
  const schwelle = await b.p.evaluate(() => {
    const leer = () => ({ bestellungen:10, umsatz:100, storno:0, stunden:new Array(24).fill(0),
      woche:[0,1,2,3,4,5,6].map(() => new Array(24).fill(0)), gerichte:{} });
    const j = leer(), d = leer();
    j.gerichte = { "A-Gericht":{ n:2, umsatz:20 }, "B-Gericht":{ n:5, umsatz:50 } };
    d.gerichte = { "B-Gericht":{ n:4, umsatz:40 } };
    const f = { tage:7, laeuft:false };
    const l = awBefunde(j, d, f).find(x => x.etikett === "Läuft gut");
    return l ? l.titel : null;
  });
  pruef(schwelle === "B-Gericht", "„läuft gut“ nennt nichts unter " + bef.min + " Stück, auch wenn es stärker wächst", schwelle);

  /* ── 3 · Handeln ── */
  console.log("\n══ Handeln ══");
  const erstes = await b.p.evaluate(() => document.querySelector(".aw-gericht").dataset.awGericht);
  await b.p.click(".aw-gericht");
  await b.p.waitForTimeout(600);
  pruef(await b.p.evaluate(() => !document.getElementById("awBlatt").hidden), "Antippen öffnet das Gericht-Blatt", erstes);
  await b.p.click('#awBlatt [data-aw-tun="aus"]');
  await b.p.waitForTimeout(500);
  pruef(await b.p.evaluate(n => gerichte.find(g => g.name === n).verfuegbar === false, erstes),
    "„Heute aus“ schaltet genau dieses Gericht aus");
  await b.p.click('#awBlatt [data-aw-tun="aus"]');
  await b.p.waitForTimeout(400);
  await b.p.click('#awBlatt [data-aw-tun="bearbeiten"]');
  await b.p.waitForTimeout(700);
  const bearb = await b.p.evaluate(() => ({ offen: !document.getElementById("blatt").hidden,
    name: (document.getElementById("fName") || {}).value }));
  pruef(bearb.offen && bearb.name === erstes, "„Bearbeiten“ öffnet das echte Blatt des richtigen Gerichts", bearb.name);
  await b.p.evaluate(() => { blattSchliessen(); tafelZeigen("auswertung"); });
  await b.p.waitForTimeout(700);
  await b.p.click(".aw-gericht");
  await b.p.waitForTimeout(500);
  await b.p.click('#awBlatt [data-aw-tun="aktion"]');
  await b.p.waitForTimeout(700);
  const akt = await b.p.evaluate(() => { const w = document.getElementById("runnerGericht");
    return { form: !document.getElementById("runnerForm").hidden, wahl: w && w.selectedOptions[0] ? w.selectedOptions[0].textContent : "",
             tafel: !document.getElementById("t-speisekarte").hidden }; });
  pruef(akt.tafel && akt.form && akt.wahl.startsWith(erstes), "„Als Aktion setzen“ öffnet das Aktionsformular mit diesem Gericht", akt.wahl);

  await b.p.evaluate(() => tafelZeigen("auswertung"));
  await b.p.waitForTimeout(600);
  await b.p.click("#awZielAendern");
  await b.p.waitForTimeout(400);
  await b.p.fill("#awZielTag", "450"); await b.p.fill("#awZielWoche", "2.800"); await b.p.fill("#awZielMonat", "12000,50");
  await b.p.click('#awZielForm button[type="submit"]');
  await b.p.waitForTimeout(500);
  const ziel = await b.p.evaluate(() => ({ z:awZiele, ring:!!document.querySelector(".aw-ring") }));
  pruef(ziel.z.tag === 450 && ziel.z.woche === 2800 && ziel.z.monat === 12000.5,
    "Ziele: „2.800“ ist zweitausendachthundert, „12000,50“ mit Komma", JSON.stringify(ziel.z));
  pruef(ziel.ring, "mit Ziel steht der Ring an der Umsatzkachel");

  /* Naht Board → betriebe.ziele (§8.1i). Zweite Quelle ist die
     CHECK-Schranke in datenbank/migration-auswertung-ziele.sql: nur
     tag/woche/monat, Zahl, > 0, ≤ 1 000 000. Was das Board sendet, muss
     dort durchgehen — sonst fällt es still auf das Gerät zurück. */
  const mig = fs.readFileSync(path.join(OBEN, "datenbank", "migration-auswertung-ziele.sql"), "utf8");
  pruef(/::numeric <= 0/.test(mig) && /::numeric > 1000000/.test(mig) && /not in \('tag','woche','monat'\)/.test(mig),
    "Voraussetzung: die Grenzen der Schranke stehen so in der Migration");
  const naht = await b.p.evaluate(async () => {
    const proben = [{tag:0.004}, {tag:0.005}, {woche:1000000.004}, {monat:"12"}, {tag:-1}, {jahr:5}, {tag:NaN}];
    const aus = proben.map(p => awZielPruefen(p));
    const schranke = z => Object.entries(z).every(([k, v]) =>
      ["tag","woche","monat"].includes(k) && typeof v === "number" && v > 0 && v <= 1000000);
    const alle = aus.every(schranke);
    /* Umzug: gestellter Client, Spalte da, aber noch null; auf dem Gerät
       liegt ein Ziel aus der Zeit vor der Migration. */
    const alt = { db, demo, betriebId }, gesendet = [];
    const stell = ziele => ({ from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data:{ ziele }, error:null }) }) }),
      update: w => { gesendet.push(w); return { eq: async () => ({ error:null }) }; } }) });
    betriebId = "probe-betrieb"; demo = false;
    db = stell(null);
    localStorage.setItem(awZielSchluessel(), JSON.stringify({ tag:300 }));
    await awZielLaden();
    const umzug = { z:JSON.stringify(awZiele), lokal:awZielLokal, gesendet:JSON.stringify(gesendet),
      rest:localStorage.getItem(awZielSchluessel()) };
    /* Gegenfall: im Betrieb steht schon ein Ziel — das gewinnt, nichts wird gesendet. */
    gesendet.length = 0;
    db = stell({ woche:2800 });
    localStorage.setItem(awZielSchluessel(), JSON.stringify({ tag:300 }));
    await awZielLaden();
    const betrieb = { z:JSON.stringify(awZiele), gesendet:gesendet.length };
    localStorage.removeItem(awZielSchluessel());
    ({ db, demo, betriebId } = alt);
    return { aus:JSON.stringify(aus), alle, umzug, betrieb };
  });
  pruef(naht.alle, "jedes Ziel, das das Board sendet, besteht die Schranke (0,004 wird nicht zu 0)", naht.aus);
  pruef(naht.umzug.gesendet === '[{"ziele":{"tag":300}}]' && naht.umzug.z === '{"tag":300}' && !naht.umzug.lokal && naht.umzug.rest === null,
    "Ziel vom Gerät zieht einmal in den Betrieb um, wenn die Spalte noch leer ist", JSON.stringify(naht.umzug));
  pruef(naht.betrieb.z === '{"woche":2800}' && naht.betrieb.gesendet === 0,
    "steht schon ein Ziel im Betrieb, gewinnt das und nichts wird überschrieben", JSON.stringify(naht.betrieb));

  const [dl] = await Promise.all([b.p.waitForEvent("download"), b.p.click("#awCsvBestellungen")]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  const kopf = csv.replace(/^﻿/, "").split("\r\n")[0];
  pruef(csv.charCodeAt(0) === 0xfeff, "CSV mit BOM (deutsches Excel erkennt UTF-8)");
  pruef(kopf.split(";").length === 9 && /Liefergebühr;Rabatt;Umsatz/.test(kopf), "Semikolon und die Geldspalten", kopf);
  pruef(/;\d+,\d{2};/.test(csv), "Beträge mit Dezimalkomma");
  pruef(!/name|adresse|telefon|mail/i.test(kopf), "keine Gastdaten in den Spalten");
  pruef(!b.fehler.length, "keine Laufzeitfehler (Auswertung)", b.fehler[0] || "still");
  await b.ctx.close();

  /* ── 4 · Bild ── */
  console.log("\n══ Bild ══");
  for(const breite of [360, 390, 768, 1280]){
    const x = await board(br, breite, false, "auswertung");
    await x.p.click('[data-zeitraum="monat"]'); await x.p.waitForTimeout(600);
    const m = await x.p.evaluate(() => {
      const d = document.documentElement;
      const kpis = [...document.querySelectorAll(".aw-kpi")].map(k => Math.round(k.getBoundingClientRect().height));
      const klein = [...document.querySelectorAll("#t-auswertung .aw-seg, #t-auswertung .aw-tun, #t-auswertung .aw-knopf, #t-auswertung .aw-gericht, #t-auswertung .aw-mini button")]
        .filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height)).filter(h => h < 44);
      return { ueber:d.scrollWidth - d.clientWidth, kpis, klein };
    });
    pruef(m.ueber <= 0, breite + " px: kein seitlicher Überlauf", m.ueber + " px");
    pruef(new Set(m.kpis).size === 1, breite + " px: Kennzahlen gleich hoch", m.kpis.join("/"));
    pruef(!m.klein.length, breite + " px: jede Tapfläche ≥ 44 px", m.klein.join(",") || "alle");
    await x.ctx.close();
  }
  for(const hell of [false, true]){
    const x = await board(br, 390, hell, "auswertung");
    const t = await x.p.evaluate(() => {
      const zuRGBA = s => { const m = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
        if(m) return [m[1]*255, m[2]*255, m[3]*255, m[4] !== undefined ? +m[4] : 1];
        const r = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        return r ? [+r[1], +r[2], +r[3], r[4] !== undefined ? +r[4] : 1] : [0,0,0,0]; };
      const kpi = document.querySelector(".aw-kpi");
      const glas = zuRGBA(getComputedStyle(kpi).backgroundColor);
      const grund = zuRGBA(getComputedStyle(document.body).backgroundColor);
      /* Der hellste und der dunkelste Punkt des Schleiers liegen über dem
         Grund — gemischt wird gegen beide Tönungen und den Grund selbst. */
      const st = getComputedStyle(document.body);
      const toene = ["--schleier-a","--schleier-b"].map(v => zuRGBA(st.getPropertyValue(v).trim()));
      const misch = (v, h) => [0,1,2].map(i => v[i] * v[3] + h[i] * (1 - v[3]));
      const unten = [grund.slice(0,3)].concat(toene.map(tn => misch(tn, grund)));
      const flaechen = unten.map(u => misch(glas, u));
      return { flaechen, titel:zuRGBA(getComputedStyle(kpi.querySelector(".aw-titel")).color).slice(0,3),
               wert:zuRGBA(getComputedStyle(kpi.querySelector(".aw-wert")).color).slice(0,3),
               klein:zuRGBA(getComputedStyle(kpi.querySelector(".aw-klein")).color).slice(0,3) };
    });
    const schlecht = Math.min(...t.flaechen.flatMap(fl => [kontrast(t.titel, fl), kontrast(t.klein, fl), kontrast(t.wert, fl)]));
    pruef(schlecht >= 4.5, (hell ? "hell" : "dunkel") + ": Schrift auf Glas ≥ 4,5:1 über jedem Punkt des Schleiers",
      schlecht.toFixed(2) + ":1");
    pruef(!x.fehler.length, (hell ? "hell" : "dunkel") + ": keine Laufzeitfehler", x.fehler[0] || "still");
    await x.ctx.close();
  }

  /* ── 5 · Einstellungen ── */
  console.log("\n══ Einstellungen ══");
  const e = await board(br, 390, false, "einstellungen");

  /* Hell/Dunkel mit dem Finger (Vorfall: einstSpeichern() gab es nicht,
     jeder Tipp warf, bevor lichtAnwenden() lief — das Board „klemmte“).
     Gemessen wird die Klasse am body UND die gemalte Fläche, nicht nur
     EINST: EINST stand schon vorher richtig, das Bild nicht. */
  const lichtFehler = [];
  e.p.on("pageerror", x => lichtFehler.push(String(x).slice(0, 120)));
  pruef(await euZu(e.p, "#lichtWahl"), "Voraussetzung: Unterseite „Bildschirm“ über ihre Kachel geöffnet");
  const licht = [];
  for(const w of ["dunkel", "hell", "dunkel"]){
    await e.p.click('#lichtWahl [data-licht="' + w + '"]');
    await e.p.waitForTimeout(250);
    licht.push(await e.p.evaluate(() => ({ hell:document.body.classList.contains("hell"),
      grund:getComputedStyle(document.body).backgroundColor,
      gemerkt:(JSON.parse(localStorage.getItem("omoteno-einstellungen") || "{}").licht) })));
  }
  pruef(!licht[0].hell && licht[1].hell && !licht[2].hell,
    "Hell/Dunkel: Antippen schaltet das Board wirklich um (dunkel → hell → dunkel)", JSON.stringify(licht.map(x => x.hell)));
  pruef(licht[0].grund !== licht[1].grund, "die gemalte Fläche wechselt mit", licht[0].grund + " / " + licht[1].grund);
  pruef(licht[1].gemerkt === "hell" && licht[2].gemerkt === "dunkel", "die Wahl wird gemerkt", licht.map(x => x.gemerkt).join(","));
  pruef(!lichtFehler.length, "kein Laufzeitfehler beim Umschalten", lichtFehler[0] || "still");
  /* Seit 18.10.: Kacheln statt Liste, jede Gruppe eine Unterseite.
     Zweite Quelle sind die Gruppen im Reiter, nicht die Kacheln. */
  await e.p.click("#euZurueck");
  await e.p.waitForTimeout(200);
  const ue = await e.p.evaluate(() => {
    const tafel = document.getElementById("t-einstellungen");
    const kacheln = [...tafel.querySelectorAll(".eu-kachel[data-eu-seite]")];
    const gruppen = [...tafel.querySelectorAll(":scope > .egruppe[data-eu]")];
    const sichtbar = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
    const r = kacheln.map(x => x.getBoundingClientRect());
    return { kacheln:kacheln.length, gruppen:gruppen.length,
      ohneKachel: gruppen.filter(g => !kacheln.some(k => k.dataset.euSeite === g.id)).map(g => g.id),
      tot: kacheln.filter(k => !document.getElementById(k.dataset.euSeite)).map(k => k.dataset.euSeite),
      tafelLink: !!tafel.querySelector('.eu-kachel[data-eu-tafel="startseite"]'),
      einkauf: !!tafel.querySelector('a.eu-kachel[href="/einkauf.html"]'),
      gruppeSichtbar: gruppen.filter(sichtbar).map(g => g.id),
      zurueck: sichtbar(document.getElementById("euZurueck")),
      spalten: new Set(r.map(x => Math.round(x.left))).size,
      klein: r.filter(x => x.height < 44 || x.width < 44).length,
      ueberlauf: document.documentElement.scrollWidth - innerWidth,
      licht: [...tafel.querySelectorAll(".eu-kachel .eu-klicht")].map(l => l.getAnimations().map(a => Object.keys(a.effect.getKeyframes()[0] || {}).filter(k => !["offset","easing","composite","computedOffset"].includes(k)).join("+")).join(",")),
      ohneKopf: gruppen.filter(g => !g.querySelector(".eu-kopf")).map(g => g.id) };
  });
  pruef(ue.kacheln === ue.gruppen && ue.kacheln >= 10 && !ue.ohneKachel.length,
    "jede Gruppe hat ihre Kachel (zweite Quelle: die Gruppen)", ue.kacheln + " Kacheln / " + ue.gruppen + " Gruppen " + ue.ohneKachel.join(","));
  pruef(!ue.tot.length, "keine Kachel führt ins Leere", ue.tot.join(",") || "keine");
  pruef(ue.tafelLink && ue.einkauf, "Kacheln für „Gast-Hub gestalten“ und „Einkauf & Kosten“");
  pruef(!ue.gruppeSichtbar.length && !ue.zurueck, "Ruhelage: nur Kacheln, keine Gruppe, kein Zurück", ue.gruppeSichtbar.join(",") || "ja");
  pruef(ue.spalten >= 2, "390 px: Kacheln im Raster (mindestens zwei Spalten)", ue.spalten + " Spalten");
  pruef(!ue.klein && ue.ueberlauf <= 0, "Kacheln ≥ 44 px, nichts läuft seitlich über", ue.klein + " zu klein, Überlauf " + ue.ueberlauf);
  pruef(ue.licht.length === ue.kacheln + 2 && ue.licht.every(x => x === "transform"),
    "Lichtrand läuft an jeder Kachel, nur transform", [...new Set(ue.licht)].join(" | "));
  pruef(!ue.ohneKopf.length, "jede Unterseite hat Symbol, Zustand und Grafik", ue.ohneKopf.join(",") || "alle");
  /* Schrift auf Glas: Titel und Satz gegen die Glasfläche über dem
     Grund des Reiters (gemischt), beide Lichter. */
  for(const hell of [false, true]){
    await e.p.evaluate(h => document.body.classList.toggle("hell", h), hell);
    await e.p.waitForTimeout(150);
    const k = await e.p.evaluate(() => {
      const rgba = c => { const m = c.match(/[\d.]+/g).map(Number); const f = /^color\(/.test(c) ? 255 : 1;
        return [m[0] * f, m[1] * f, m[2] * f, m.length > 3 ? m[3] : 1]; };
      const kach = document.querySelector(".eu-kachel[data-eu-seite]");
      const tief = el => { for(let x = el; x; x = x.parentElement){ const c = rgba(getComputedStyle(x).backgroundColor); if(c[3] > .95) return c; } return [0,0,0,1]; };
      const grund = tief(kach.parentElement), glas = rgba(getComputedStyle(kach).backgroundColor);
      const fl = [0,1,2].map(i => glas[i] * glas[3] + grund[i] * (1 - glas[3]));
      const l = c => { const v = c.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
      const kon = (a, b) => { const x = l(a), y = l(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      return Math.min(...["b", "i"].map(t => kon(rgba(getComputedStyle(kach.querySelector(".eu-ktext " + t)).color).slice(0, 3), fl)));
    });
    pruef(k >= 4.5, (hell ? "hell" : "dunkel") + ": Kachelschrift auf Glas ≥ 4,5:1", k.toFixed(2) + ":1");
  }
  await e.p.evaluate(() => document.body.classList.remove("hell"));
  {
    await e.p.click('.eu-kachel[data-eu-tafel="startseite"]');
    await e.p.waitForTimeout(300);
    const auf = await e.p.evaluate(() => !document.getElementById("t-startseite").hidden);
    pruef(auf, "ein Tipp auf „Gast-Hub gestalten“ öffnet den Reiter „Gast-Hub“");
    await e.p.evaluate(() => tafelZeigen("einstellungen"));
    await e.p.waitForTimeout(200);
  }
  /* Echter Tipp: genau EINE Gruppe, oben „Alle Einstellungen“. */
  const melden = await e.p.evaluate(() => document.querySelector('label.ezeile:has([data-einst="ton"])').closest(".egruppe").id);
  await e.p.click('[data-eu-seite="' + melden + '"]');
  await e.p.waitForTimeout(250);
  const auf = await e.p.evaluate(() => {
    const sichtbar = el => !!el.getClientRects().length;
    const z = document.getElementById("euZurueck"), r = z.getBoundingClientRect();
    return { offen: [...document.querySelectorAll("#t-einstellungen > .egruppe")].filter(sichtbar).map(g => g.id),
      zurueck: sichtbar(z) && r.height >= 44, oben: r.top < 200, fokus: document.activeElement && document.activeElement.matches("h2.etitel") };
  });
  pruef(auf.offen.length === 1 && auf.offen[0] === melden, "ein Tipp auf die Kachel zeigt genau ihre Gruppe", auf.offen.join(","));
  pruef(auf.zurueck && auf.oben, "„Alle Einstellungen“ steht oben, ≥ 44 px");
  pruef(auf.fokus, "der Fokus springt auf die Überschrift der Unterseite");
  const tonVorher = await e.p.evaluate(() => document.querySelector('.eu-kachel [data-eu-stand="0"]').textContent);
  await e.p.click('label.ezeile:has([data-einst="ton"])');
  await e.p.waitForTimeout(300);
  const tonNach = await e.p.evaluate(() => ({ text:document.querySelector('.eu-kachel [data-eu-stand="0"]').textContent, ton:EINST.ton,
    wellen:document.querySelectorAll('[data-eu-bild="0"] .eu-welle.an').length }));
  pruef(/^Ton an/.test(tonVorher) && tonNach.ton === false && tonNach.text === "Ton aus" && tonNach.wellen === 0,
    "Schalter umgelegt → Kachel und Grafik folgen", tonVorher + " → " + tonNach.text + ", Wellen " + tonNach.wellen);
  await e.p.click('label.ezeile:has([data-einst="ton"])');
  await e.p.waitForTimeout(200);
  await e.p.click("#euZurueck");
  await e.p.waitForTimeout(200);
  const zu = await e.p.evaluate(m => ({ offen: [...document.querySelectorAll("#t-einstellungen > .egruppe[data-eu]")].filter(g => g.getClientRects().length).length,
    fokus: document.activeElement && document.activeElement.dataset.euSeite === m }), melden);
  pruef(zu.offen === 0 && zu.fokus, "„Alle Einstellungen“ führt zurück, Fokus auf der Kachel von eben", JSON.stringify(zu));
  await e.p.click('[data-eu-seite="' + melden + '"]');
  await e.p.waitForTimeout(150);
  await e.p.keyboard.press("Escape");
  await e.p.waitForTimeout(150);
  pruef(await e.p.evaluate(() => !document.getElementById("t-einstellungen").dataset.euOffen), "Escape führt zurück zu den Kacheln");
  await e.p.click('[data-eu-seite="' + melden + '"]');
  await e.p.waitForTimeout(150);
  await e.p.evaluate(() => { tafelZeigen("bestellungen"); tafelZeigen("einstellungen"); });
  await e.p.waitForTimeout(150);
  pruef(await e.p.evaluate(() => !document.getElementById("t-einstellungen").dataset.euOffen), "wer den Reiter neu betritt, beginnt bei den Kacheln");
  /* Das Figuren-Rad steht in der Gruppe „Figur des Hauses“ — offen machen. */
  await e.p.evaluate(() => { const g = document.querySelector("#avspur-figur"); const eg = g && g.closest("#t-einstellungen > .egruppe"); if(eg) euOeffnen(eg.id); });

  const rad = await e.p.evaluate(async () => {
    const spur = document.querySelector("#avspur-figur"); spur.scrollIntoView({ block:"center" });
    await new Promise(r => setTimeout(r, 300));
    let trans = 0, luecke = 0, last = performance.now();
    spur.scrollBy({ left:250, behavior:"smooth" });
    for(let i = 0; i < 60; i++){ await new Promise(r => requestAnimationFrame(r));
      const t = performance.now(); luecke = Math.max(luecke, t - last); last = t;
      trans = Math.max(trans, spur.getAnimations({ subtree:true }).filter(a => /transform|opacity/.test(a.transitionProperty || "")).length); }
    await new Promise(r => setTimeout(r, 400));
    const st = [...spur.querySelectorAll(".avstueck")];
    const nah = st.map(s => +getComputedStyle(s).getPropertyValue("--naehe") || 0);
    return { trans, luecke:Math.round(luecke), mitteAktiv: st.indexOf(spur.querySelector(".aktiv")) === nah.indexOf(Math.max(...nah)),
             stand:AVATARSTAND.figur, aktiv:spur.querySelector(".aktiv").dataset.avWert };
  });
  pruef(rad.trans === 0, "Figuren-Rad: keine Transition auf Größe/Deckkraft während des Wischens", rad.trans);
  pruef(rad.luecke <= 50, "Figuren-Rad: Bildlücken ≤ 50 ms", rad.luecke + " ms");
  pruef(rad.mitteAktiv && rad.stand === rad.aktiv, "Figuren-Rad: am Ende ist das Stück in der Mitte gewählt", rad.aktiv);

  const tafeln = await e.p.evaluate(async () => {
    const aus = [];
    for(const t of ["bestellungen","speisekarte","reservierungen","auswertung","einstellungen"]){
      tafelZeigen(t); await new Promise(r => setTimeout(r, 150));
      aus.push(t + ":" + (document.documentElement.scrollHeight > innerHeight));
    }
    return aus;
  });
  pruef(tafeln.every(x => x.endsWith("true")), "jede Tafel ist scrollbar (auch die leere „Tische“)", tafeln.join(" "));
  pruef(!e.fehler.length, "keine Laufzeitfehler (Einstellungen)", e.fehler[0] || "still");
  await e.ctx.close();

  await br.close();
  console.log("\n" + (f ? f + " von " + n + " Fehler." : n + " von " + n + " ok\nAlles sauber."));
  process.exit(f ? 1 : 0);
})();
