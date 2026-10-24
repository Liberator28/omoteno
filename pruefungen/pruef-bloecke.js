/* ═════════════════════════════════════════════════════════════════
   PRÜFUNG · Aufbau der Startseite aus Blöcken (hub_bloecke)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-bloecke.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle“)
     Gegenbeweise im Worktree: HUB_DIST=<dist> VORLAGE=<hub.vorlage.html> ADMIN_DATEI=<admin.html>
     Byteprobe gegen einen Stand von vorher: HUB_BASIS=<dist des alten Standes>

   Wunsch: „Unterteile die gesamte Startseite in Blöcke … in den Einstellungen per
   Drag and drop verschieben, neue Blöcke erstellen, Reihenfolge, Größe und Breite, Textinhalt —
   dabei soll kein Text aus Versehen markiert werden.“

   Fünf Dinge können schiefgehen, für jedes steht eine Probe da:

   1 · ALTE HÄUSER ÄNDERN SICH. Ohne eingestellten Aufbau (null, []) ist die Startseite Zeichen für
       Zeichen die von vorher (HUB_BASIS), und es gibt keine einzige Block-Hülle (§2.5/§8.1a).
   2 · EINE LIVE-SPALTE IST FREMDER TEXT. Alles aus hub_bloecke geht durch EINE Positivliste
       (bloeckeSauber), im Hub UND im Board wortgleich (§2.3a/§8.1w): ein Anführungszeichen im Titel,
       ein javascript:-Ziel, ein <img onerror> öffnen nichts.
   3 · NICHTS VERSCHWINDET STILL. Eine ausgeblendete Rubrik nimmt dem Gast nicht den Weg zur Karte;
       was der Aufbau nicht nennt (neue Rubrik, später ergänzter Block), folgt hinten (§7).
   4 · BOARD UND HUB MEINEN DASSELBE. Was das Board an die Vorschau und in die Datenbank schickt,
       kommt im Hub als dieselbe Reihenfolge an — am gezeichneten Hub gemessen (§8.1i); gelesen wird vor
       dem Schreiben (§8.1m); null Zeilen heißen „kein Recht“ (§2.3b).
   5 · NICHTS WIRD AUS VERSEHEN MARKIERT. Liste und Griff sind nicht markierbar, ein Doppeltipp auf
       einen Namen markiert nichts, nach dem Ziehen steht keine Auswahl — und der Griff rollt die Seite
       nicht mit (echter Finger über CDP, §3.8).
   ═════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { oeffneHub } = require("./werkzeug/start-hub");
const { gruppeZu } = require("./werkzeug/zentrale");
const { schlechtester, kontrast } = require("./werkzeug/messen");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const VORLAGE = process.env.VORLAGE || path.join(OBEN, "vorlagen", "hub.vorlage.html");
const ADMIN_DATEI = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");
const ADMIN = "file://" + ADMIN_DATEI;
const MIGRATION = path.join(OBEN, "datenbank", "migration-hub-bloecke.sql");
const HAEUSER = ["chocolamour", "blend", "minhkeey", "nordstern", "piugusto"];
const DIST = process.env.HUB_DIST || path.join(OBEN, "dist");
if(!fs.existsSync(path.join(DIST, "chocolamour", "index.html"))){ console.error(DIST + " fehlt — erst „node erzeuger/erzeuge-hub.js --alle“."); process.exit(1); }

let fehler = 0;
const pruef = (g, t, z) => { console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined && z !== "" ? "  → " + z : "")); if(!g) fehler++; };
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const echt = k => k.filter(z => !/net::ERR|Failed to load|ERR_FAILED/i.test(z));

const hubQuelle = fs.readFileSync(VORLAGE, "utf8");
const adminQuelle = fs.readFileSync(ADMIN_DATEI, "utf8");
const migration = fs.readFileSync(MIGRATION, "utf8");
const teil = (s, von, bis) => { const a = s.indexOf(von), b = a < 0 ? -1 : s.indexOf(bis, a + von.length); return a >= 0 && b > a ? s.slice(a, b + bis.length) : null; };

/* Ein Eigener-Block-Eintrag mit Vorgaben. */
const eigen = (id, o) => Object.assign({ id, titel: "Heute Waffeltag", text: "Alle Waffeln mit extra Sauce." }, o || {});
const AB = "eigen-ab12", CD = "eigen-cd34", EF = "eigen-ef56";

(async () => {
  const br = await chromium.launch();

  /* ══ A · Quelltext: geteilter Block, Zahlen, zweite Quellen ══════════════ */
  console.log("\n══ A · Quelltext ══");
  const blH = teil(hubQuelle, "/* BLOECKE — GETEILTER BLOCK", "/* ENDE BLOECKE */");
  const blA = teil(adminQuelle, "/* BLOECKE — GETEILTER BLOCK", "/* ENDE BLOECKE */");
  pruef(!!blH && !!blA && blH.length > 1500, "der geteilte Block steht in beiden Dateien", blH ? blH.length + " Zeichen" : "fehlt im Hub");
  pruef(blH === blA, "geteilter Block Zeichen für Zeichen gleich (Hub = Board)");
  const zoomJs = /const BLOCK_ZOOM = \{ klein:([\d.]+), gross:([\d.]+) \}/.exec(hubQuelle);
  const zoomCss = [/\.sblock\[data-groesse="klein"\]\{zoom:([\d.]+)\}/.exec(hubQuelle), /\.sblock\[data-groesse="gross"\]\{zoom:([\d.]+)\}/.exec(hubQuelle)];
  pruef(zoomJs && zoomCss[0] && zoomCss[1] && +zoomJs[1] === +zoomCss[0][1] && +zoomJs[2] === +zoomCss[1][1],
        "Größen: BLOCK_ZOOM = die Zoomwerte im CSS", zoomJs ? zoomJs[1] + " / " + zoomJs[2] : "");
  const maxEintraege = /BLOCK_GRENZEN = \{[^}]*max:(\d+)/.exec(hubQuelle);
  const maxSql = /jsonb_array_length\(hub_bloecke\) <= (\d+)/.exec(migration);
  pruef(maxEintraege && maxSql && maxEintraege[1] === maxSql[1], "Höchstzahl der Blöcke: Hub = Schranke der Migration", maxEintraege && maxSql ? maxEintraege[1] + " = " + maxSql[1] : "");
  pruef(/select=[^"]*hub_bloecke/.test(hubQuelle), "der Hub fragt hub_bloecke ab");
  pruef(/grant select \(hub_bloecke\) on public\.betriebe to anon/.test(migration) && /grant update \(hub_bloecke\) on public\.betriebe to authenticated/.test(migration),
        "Migration: anon liest, authenticated schreibt — spaltenweise");
  const ziele = [...adminQuelle.matchAll(/\["(#\/[a-z0-9-]+)","/g)].map(m => m[1]);
  pruef(ziele.length >= 8, "Board kennt Ziele für Textblock-Knöpfe", ziele.length + "");
  const einst = [...(teil(adminQuelle, "const AFB_EINSTELLUNG = {", "};") || "").matchAll(/g:"([A-Za-z-]+)"/g)].map(m => m[1]);
  const gruppenIds = einst.filter(g => !new RegExp('id="' + g + '"').test(adminQuelle));
  pruef(einst.length >= 6 && gruppenIds.length === 0, "jeder Weg „Texte & Einstellungen“ führt zu einer Gruppe, die es gibt", gruppenIds.join(", ") || einst.length + " Wege");
  const beschr = (teil(adminQuelle, "const AFB_BESCHREIBUNG = {", "};") || "");
  const festIds = (/const BLOCK_FEST = \[([^\]]+)\]/.exec(hubQuelle) || ["", ""])[1].match(/"([a-z]+)"/g).map(x => x.replace(/"/g, ""));
  pruef(festIds.length === 6 && festIds.every(id => new RegExp("\\b" + id + ":").test(beschr)), "jeder feste Block hat im Board einen Satz, was er ist", festIds.join(" "));

  /* ══ B · Die Positivliste (im Hub) ═══════════════════════════════════════ */
  console.log("\n══ B · Positivliste ══");
  {
    const h = await oeffneHub(br, { haus: "chocolamour" });
    const s = await h.p.evaluate(() => {
      const aus = {};
      const f = (n, x) => { aus[n] = bloeckeSauber(x); };
      f("kein Array", { id: "schnell" }); f("null", null); f("Text", "schnell");
      f("unbekannte Kennung", [{ id: "kopf" }, { id: "x" }, { id: "rubrik:" }, { id: "eigen-" }, { id: "eigen-ABC" }, { id: "__proto__" }, { id: "constructor" }]);
      f("doppelt", [{ id: "schnell" }, { id: "schnell", an: false }]);
      f("Rubrik mit Anführungszeichen", [{ id: 'rubrik:A"B' }, { id: "rubrik:A<b>" }, { id: "rubrik:A'B" }, { id: "rubrik:A&B" }]);
      f("Rubrik zu lang", [{ id: "rubrik:" + "x".repeat(29) }, { id: "rubrik:" + "x".repeat(28) }]);
      f("an streng", [{ id: "schnell", an: "false" }, { id: "begleiter", an: 0 }, { id: "aktion", an: false }]);
      f("breite", [{ id: "schnell", breite: "halb" }, { id: "banner", breite: "halb" }, { id: "begleiter", breite: "halb" }, { id: "eigen-ab12", breite: "halb" }, { id: "nochmal", breite: "viertel" }]);
      f("groesse", [{ id: "schnell", groesse: "gross" }, { id: "schnell", groesse: "klein" }]);
      f("groesse2", [{ id: "begleiter", groesse: "gross" }, { id: "aktion", groesse: "riesig" }, { id: "banner", groesse: "" }]);
      f("Eintrag kein Objekt", [null, 3, "x", [], { id: "aktion" }]);
      f("eigen Text", [{ id: "eigen-ab12", titel: '<img src=x onerror=1>"Hallo"', text: "a<b>b\u0000c", knopf: "<i>Go</i>", look: "neon", ziel: "https://a.de/x" }]);
      f("eigen Ziele", ["javascript:alert(1)", 'https://a.de/a"b', "https://a.de/a b", "http://a.de", "#/speisekarte", "#/a b", "#/UPPER", "#/", "https://a.de/ok", " https://a.de/ok "]
        .map((z, i) => ({ id: "eigen-z" + i + "x", ziel: z })));
      f("eigen Länge", [{ id: "eigen-ab12", titel: "t".repeat(60), text: "x".repeat(400), knopf: "k".repeat(40) }]);
      f("41", Array.from({ length: 41 }, (_, i) => ({ id: "eigen-a" + String(i).padStart(2, "0") })));
      return aus;
    });
    pruef(gleich(s["kein Array"], []) && gleich(s["null"], []) && gleich(s["Text"], []), "kein Array → leer (Vorgabe)");
    pruef(s["unbekannte Kennung"].length === 0, "unbekannte Kennungen, auch __proto__ und constructor, fallen weg", JSON.stringify(s["unbekannte Kennung"].map(b => b.id)));
    pruef(s["doppelt"].length === 1 && s["doppelt"][0].an === true, "doppelte Kennung: die erste gilt");
    pruef(s["Rubrik mit Anführungszeichen"].length === 0, "Rubrikname mit \" < ' & wird verworfen");
    pruef(s["Rubrik zu lang"].length === 1 && s["Rubrik zu lang"][0].id.length === 7 + 28, "Rubrikname: 28 Zeichen gelten, 29 nicht");
    pruef(gleich(s["an streng"].map(b => b.an), [true, true, false]), "an gilt nur als aus bei echtem false (nicht bei Text oder 0)");
    pruef(gleich(s["breite"].map(b => b.breite), ["voll", "voll", "halb", "halb", "voll"]), "halb nur für Blöcke, die in einer halben Spalte lesbar bleiben", JSON.stringify(s["breite"].map(b => b.id + ":" + b.breite)));
    pruef(s["groesse"][0].groesse === "" && s["groesse"].length === 1, "Schnellzugriff: „groß“ wird nicht übernommen");
    pruef(gleich(s["groesse2"].map(b => b.groesse), ["gross", "", ""]), "Größe nur klein/groß, sonst Normal");
    pruef(gleich(s["Eintrag kein Objekt"].map(b => b.id), ["aktion"]), "Einträge, die kein Objekt sind, fallen weg");
    const e = s["eigen Text"][0];
    pruef(e && !/[<>]/.test(e.titel + e.text + e.knopf) && !/"/.test(e.titel) && !/\u0000/.test(e.text) && e.look === "karte",
          "Text ohne < > und \", Steuerzeichen weg, unbekanntes Aussehen → Karte", JSON.stringify(e));
    const z = s["eigen Ziele"].map(b => b.ziel);
    pruef(gleich(z, ["", "", "", "", "#/speisekarte", "", "", "", "https://a.de/ok", "https://a.de/ok"]),
          "Ziele: nur #/seite oder https ohne Leerzeichen/Anführungszeichen", JSON.stringify(z));
    const l = s["eigen Länge"][0];
    pruef(l.titel.length === 40 && l.text.length === 280 && l.knopf.length === 24, "Längen: Titel 40, Text 280, Knopf 24", [l.titel.length, l.text.length, l.knopf.length].join("/"));
    pruef(s["41"].length === 40, "höchstens 40 Blöcke");
    pruef(echt(h.fehler).length === 0, "keine Skriptfehler", echt(h.fehler).join(" | "));
    await h.ctx.close();
  }

  /* ══ C · Der Hub zeichnet den Aufbau ═════════════════════════════════════ */
  console.log("\n══ C · Hub ══");
  const struktur = p => p.evaluate(() => [...document.querySelectorAll("#inhalt [data-sblock]")].map(e => {
    const r = e.getBoundingClientRect();
    return { id: e.dataset.sblock, groesse: e.dataset.groesse || "", top: Math.round(r.top + scrollY), left: Math.round(r.left), breite: Math.round(r.width), imReihe: !!e.closest(".sblock-reihe") };
  }));
  const ids = s => s.map(x => x.id);

  /* C1 · ohne Aufbau */
  {
    const h0 = await oeffneHub(br, { haus: "chocolamour" });
    const s0 = await struktur(h0.p);
    pruef(s0.length === 0, "ohne Aufbau gibt es keine einzige Block-Hülle", s0.length + "");
    await h0.ctx.close();
    for(const art of [[], null]){
      const h = await oeffneHub(br, { haus: "chocolamour", bloecke: art });
      const n = await h.p.evaluate(() => document.querySelectorAll("#inhalt .sblock, #inhalt .sblock-reihe, #inhalt .sblock-eigen").length);
      pruef(n === 0, "Aufbau " + JSON.stringify(art) + " = keine Hüllen");
      await h.ctx.close();
    }
    if(process.env.HUB_BASIS){
      for(const haus of HAEUSER){
        const a = await oeffneHub(br, { haus }), b = await oeffneHub(br, { haus, dist: process.env.HUB_BASIS });
        const ha = await a.p.evaluate(() => document.getElementById("inhalt").innerHTML), hb = await b.p.evaluate(() => document.getElementById("inhalt").innerHTML);
        pruef(ha === hb && ha.length > 3000, haus + ": Startseite ohne Aufbau Zeichen für Zeichen wie der alte Stand", ha.length + " Zeichen");
        await a.ctx.close(); await b.ctx.close();
      }
    }else console.log("  ----  (HUB_BASIS nicht gesetzt: die Byteprobe gegen den alten Stand läuft nur mit einem Vergleichsstand)");
  }

  /* C2 · Reihenfolge, ausgeblendet, Unbekanntes hinten */
  {
    const L = [eigen(AB, { look: "band" }), { id: "rubrik:Die Karte" }, { id: "begleiter" }, { id: "schnell" }, { id: "aktion", an: false },
               eigen(CD, { titel: "Zwei", text: "Zweiter Block" }), { id: "rubrik:Für Ihren nächsten Besuch" }];
    const h = await oeffneHub(br, { haus: "chocolamour", bloecke: L });
    const s = await struktur(h.p);
    const soll = [AB, "rubrik:Die Karte", "begleiter", "schnell", CD, "rubrik:Für Ihren nächsten Besuch"];
    const gelistet = ids(s).filter(i => soll.includes(i));
    pruef(gleich(gelistet, [AB, "rubrik:Die Karte", "begleiter", "schnell", CD, "rubrik:Für Ihren nächsten Besuch"].filter(i => ids(s).includes(i))) && gelistet.length >= 5,
          "die Blöcke stehen in der Reihenfolge des Aufbaus (am Dokument gemessen)", ids(s).join(" › "));
    pruef(gleich(s.map(x => x.top).slice().sort((a, b) => a - b), s.map(x => x.top)), "und liegen auch von oben nach unten so");
    pruef(!ids(s).includes("aktion"), "ein ausgeblendeter Block fehlt");
    const letzteGelistet = Math.max(...soll.map(i => ids(s).indexOf(i)));
    const ungenannt = ids(s).filter(i => !soll.includes(i) && i !== "aktion");
    pruef(ungenannt.every(i => ids(s).indexOf(i) > letzteGelistet), "was der Aufbau nicht nennt, folgt hinten — nichts verschwindet", ungenannt.join(", ") || "(nichts Ungenanntes sichtbar)");
    pruef(ungenannt.includes("rubrik:Jetzt am Tisch"), "Voraussetzung: „Jetzt am Tisch“ ist ungenannt und trotzdem da");
    pruef(echt(h.fehler).length === 0, "keine Skriptfehler", echt(h.fehler).join(" | "));
    await h.ctx.close();
  }

  /* C3 · Rubrik ausgeblendet: Karte bleibt erreichbar */
  {
    const h = await oeffneHub(br, { haus: "chocolamour", bloecke: [{ id: "rubrik:Die Karte", an: false }] });
    const r = await h.p.evaluate(() => ({
      rubriken: [...document.querySelectorAll("#inhalt .sb-name")].map(e => e.textContent),
      karteWeg: !!document.querySelector('#inhalt .schnellzeile a[href="#/speisekarte"]'),
      kachelKarte: !!document.querySelector('#inhalt [data-kachel="speisekarte"]'),
      wischen: sichtbareKacheln().map(k => k.schluessel)
    }));
    pruef(!r.rubriken.some(n => /KARTE/.test(n)) && r.rubriken.length >= 1, "die ausgeblendete Rubrik „Die Karte“ steht nicht auf der Startseite", r.rubriken.join(" | "));
    pruef(!r.kachelKarte, "ihre Kacheln auch nicht");
    pruef(r.karteWeg, "der Schnellzugriff führt trotzdem zur Speisekarte (nichts wird unerreichbar, §7)");
    pruef(!r.wischen.includes("speisekarte") && r.wischen.length >= 3, "das Wischen zwischen Unterseiten folgt der Startseite: Karte nicht dabei", r.wischen.join(","));
    await h.ctx.close();
  }

  /* C4 · Breite: zwei halbe teilen eine Reihe, einer allein steht ganz */
  {
    const L = [eigen(AB, { breite: "halb" }), eigen(CD, { breite: "halb", titel: "Rechts" }), eigen(EF, { breite: "halb", titel: "Allein" }),
               { id: "schnell", breite: "halb" }, { id: "begleiter", breite: "halb" }, eigen("eigen-gh78", { titel: "Daneben", breite: "halb" })];
    const h = await oeffneHub(br, { haus: "chocolamour", bloecke: L, breite: 390 });
    const s = await struktur(h.p);
    const by = id => s.find(x => x.id === id);
    const spalte = await h.p.evaluate(() => document.getElementById("inhalt").getBoundingClientRect().width);
    pruef(by(AB) && by(CD) && by(AB).imReihe && by(CD).imReihe && by(AB).top === by(CD).top && by(CD).left > by(AB).left,
          "zwei halbe Blöcke stehen nebeneinander in einer Reihe", [by(AB), by(CD)].map(x => x && x.left + "/" + x.top).join(" | "));
    pruef(Math.abs(by(AB).breite - by(CD).breite) <= 1 && by(AB).breite < spalte / 2, "gleich breit, jeder unter der halben Spalte", by(AB).breite + " / " + by(CD).breite + " von " + Math.round(spalte));
    pruef(by(EF) && !by(EF).imReihe && by(EF).breite >= spalte - 1, "ein einzelner halber Block steht ganz (wie im Kachelraster)", by(EF) && by(EF).breite);
    pruef(by("schnell") && !by("schnell").imReihe && by("schnell").breite >= spalte - 1, "der Schnellzugriff bleibt trotz „halb“ ganz breit");
    pruef(by("begleiter") && by("eigen-gh78") && by("begleiter").imReihe && by("eigen-gh78").imReihe && by("begleiter").top === by("eigen-gh78").top,
          "Figur mit Satz (halb) und Textblock (halb) teilen sich eine Reihe");
    const texte = await h.p.evaluate(() => [...document.querySelectorAll("#inhalt .sblock-reihe .sblock-eigen, #inhalt .sblock-reihe .begleiter")].map(e => ({ sw: e.scrollWidth, cw: e.clientWidth })));
    pruef(texte.length >= 3 && texte.every(t => t.sw <= t.cw + 1), "in der halben Spalte läuft nichts über", JSON.stringify(texte));
    await h.ctx.close();
  }

  /* C5 · Größe */
  {
    const L = [eigen(AB, { groesse: "klein" }), eigen(CD, { groesse: "gross", titel: "Groß" }), eigen(EF, { titel: "Normal" }), { id: "schnell", groesse: "gross" }, { id: "begleiter", groesse: "klein" }];
    const h = await oeffneHub(br, { haus: "chocolamour", bloecke: L, breite: 390 });
    const r = await h.p.evaluate(() => { const g = id => document.querySelector('[data-sblock="' + id + '"]');
      const z = id => g(id) ? +getComputedStyle(g(id)).zoom : null;
      return { klein: z("eigen-ab12"), gross: z("eigen-cd34"), normal: z("eigen-ef56"), schnell: z("schnell"), schnellAttr: g("schnell") && g("schnell").dataset.groesse || "", begleiter: z("begleiter"),
               breiten: ["eigen-ab12", "eigen-cd34", "eigen-ef56", "schnell"].map(id => Math.round(g(id).getBoundingClientRect().width)) }; });
    pruef(Math.abs(r.klein - .88) < .001 && Math.abs(r.gross - 1.1) < .001 && r.normal === 1, "klein = 0,88, groß = 1,1, normal = 1 (berechneter Zoom)", [r.klein, r.gross, r.normal].join(" / "));
    pruef(r.schnell === 1 && r.schnellAttr === "", "Schnellzugriff: „groß“ greift nicht (bräche „Foodroulette“ im Wort)", r.schnell + " / " + r.schnellAttr);
    pruef(Math.abs(r.begleiter - .88) < .001, "Figur mit Satz kann klein sein");
    pruef(new Set(r.breiten).size === 1, "jeder Block füllt weiter die Breite — Zoom ändert Maße, nicht den Platz", r.breiten.join(" / "));
    await h.ctx.close();
  }

  /* C6 · Eigener Textblock: Inhalt, Fremdtext, Knopf */
  {
    const vergiftet = { id: AB, titel: '<img src=x onerror="window.__x=1">', text: 'Er sagte "Hallo" <script>window.__x=2</script> \'x\'', knopf: "Zur Karte", ziel: "#/speisekarte" };
    const h = await oeffneHub(br, { haus: "chocolamour", bloecke: [vergiftet,
      eigen(CD, { titel: "Link", text: "Extern", knopf: "Los", ziel: "https://beispiel.de/seite" }),
      eigen(EF, { titel: "Böse", text: "Ziel falsch", knopf: "Los", ziel: 'https://a.de/a"onmouseover="window.__x=3' }),
      { id: "eigen-gh78", titel: "", text: "" }, eigen("eigen-ij90", { titel: "Nur Titel", text: "" })] });
    const r = await h.p.evaluate(() => {
      const el = id => document.querySelector('[data-eigen="' + id + '"]');
      const a = id => el(id) && el(id).querySelector("a.knopf");
      return { x: window.__x, bilder: document.querySelectorAll("#inhalt .sblock-eigen img").length, skripte: document.querySelectorAll("#inhalt .sblock-eigen script").length,
        titel: el("eigen-ab12") && el("eigen-ab12").querySelector("h2").textContent, text: el("eigen-ab12") && el("eigen-ab12").querySelector("p").textContent,
        h2: el("eigen-ab12") && el("eigen-ab12").querySelector("h2").tagName,
        intern: a("eigen-ab12") && { href: a("eigen-ab12").getAttribute("href"), target: a("eigen-ab12").getAttribute("target"), hoehe: a("eigen-ab12").getBoundingClientRect().height },
        extern: a("eigen-cd34") && { href: a("eigen-cd34").getAttribute("href"), target: a("eigen-cd34").getAttribute("target"), rel: a("eigen-cd34").getAttribute("rel") },
        boese: el("eigen-ef56") && !!a("eigen-ef56"), leer: !!el("eigen-gh78"), nurTitel: el("eigen-ij90") && el("eigen-ij90").querySelectorAll("p").length,
        attribute: [...document.querySelectorAll("#inhalt .sblock-eigen, #inhalt .sblock-eigen *")].some(e => [...e.attributes].some(at => /^on/i.test(at.name))) };
    });
    pruef(r.x === undefined && r.bilder === 0 && r.skripte === 0 && !r.attribute, "<img onerror>, <script> und Anführungszeichen im Text laufen nicht und öffnen nichts", "x=" + r.x);
    pruef(r.titel && !/[<>]/.test(r.titel) && /Hallo/.test(r.text) && r.h2 === "H2", "der Text steht als Text da", r.titel + " | " + r.text);
    pruef(r.intern && r.intern.href === "#/speisekarte" && r.intern.target === null && r.intern.hoehe >= 44, "Knopf zu einer Seite des Hubs: im selben Tab, ≥ 44 px", JSON.stringify(r.intern));
    pruef(r.extern && r.extern.target === "_blank" && /noopener/.test(r.extern.rel), "Knopf zu einer https-Adresse: neuer Tab mit noopener", JSON.stringify(r.extern));
    pruef(r.boese === false, "ein Ziel mit Anführungszeichen ergibt keinen Knopf (kein eigenes Attribut)");
    pruef(r.leer === false, "ein Textblock ohne Titel und Text macht keine Fläche auf");
    pruef(r.nurTitel === 0, "nur ein Titel: kein leerer Absatz");
    await h.p.evaluate(() => { document.querySelector('[data-eigen="eigen-ab12"] a.knopf').click(); });
    await h.p.waitForTimeout(300);
    pruef(await h.p.evaluate(() => /speisekarte/.test(location.hash)), "ein Tipp auf den Knopf führt zur Speisekarte", await h.p.evaluate(() => location.hash));
    await h.ctx.close();
  }

  /* C6b · Die Senke schützt selbst (§8.1w: „am Senke zählt hs() trotzdem“). C6 geht durch bloeckeSauber(), das <> ohnehin
     entfernt — ein Renderer ohne hs() bliebe dort grün. Hier kommt der Aufbau OHNE die Prüfung in die Seite. */
  {
    const h = await oeffneHub(br, { haus: "chocolamour", bloecke: null });
    await h.p.evaluate(({ id }) => {
      window.__y = undefined;
      BLOECKE = [{ id, an: true, breite: "voll", groesse: "", look: "karte", titel: '<img src=x onerror="window.__y=1">',
        text: '<img src=x onerror="window.__y=2">', knopf: '<b onmouseover="window.__y=3">Los</b>', ziel: '#/speisekarte"onmouseover="window.__y=4' }];
      zeichne();
    }, { id: AB });
    await h.p.waitForTimeout(500);
    const r = await h.p.evaluate(id => { const el = document.querySelector('[data-eigen="' + id + '"]');
      return { da: !!el, y: window.__y, bilder: el ? el.querySelectorAll("img, b").length : -1,
        attribute: el ? [...el.querySelectorAll("*")].some(e => [...e.attributes].some(at => /^on/i.test(at.name))) : null,
        text: el ? el.textContent : "" }; }, AB);
    pruef(r.da, "Voraussetzung: der von Hand gesetzte Textblock steht auf der Seite", r.text.slice(0, 60));
    pruef(r.y === undefined && r.bilder === 0 && r.attribute === false, "ohne vorgeschaltete Prüfung: <img onerror>, <b onmouseover> und ein Ziel mit Anführungszeichen bleiben Text (hs() am Senke)", JSON.stringify({ y: r.y, bilder: r.bilder, attribute: r.attribute }));
    await h.ctx.close();
  }

  /* C7 · Lesbarkeit der eigenen Blöcke — am gemalten Bild, beide Aussehen, hell und dunkel, zwei Häuser */
  {
    let min = 99, wo = "";
    for(const haus of ["chocolamour", "blend", "minhkeey"]) for(const farbe of ["hell", "dunkel"]){
      const h = await oeffneHub(br, { haus, farbe, bloecke: [eigen(AB, { look: "karte", knopf: "Los", ziel: "#/speisekarte" }), eigen(CD, { look: "band", knopf: "Los", ziel: "#/speisekarte" })] });
      for(const sel of ['[data-eigen="' + AB + '"] h2', '[data-eigen="' + AB + '"] p', '[data-eigen="' + AB + '"] .knopf',
                        '[data-eigen="' + CD + '"] h2', '[data-eigen="' + CD + '"] p', '[data-eigen="' + CD + '"] .knopf']){
        await h.p.evaluate(s => document.querySelector(s).scrollIntoView({ block: "center" }), sel);
        /* Der Knopf ist abgerundet: In den Ecken liegt der Grund des Blocks, ein Pixelvergleich stieße dort auf die Schriftfarbe
           selbst (1,00:1 — ein Messfehler, kein Befund). Beim Knopf zählt das Paar aus Schrift- und Flächenfarbe. */
        const k = /\.knopf$/.test(sel)
          ? await h.p.evaluate(s => { const c = getComputedStyle(document.querySelector(s)); return [c.color, c.backgroundColor]; }, sel).then(([a, b]) => {
              const rgb = x => (/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(x) || [0, 0, 0, 0]).slice(1, 4).map(Number);
              return kontrast(rgb(a), rgb(b)); })
          : await schlechtester(h.p, sel);
        if(k !== null && k < min){ min = k; wo = haus + "/" + farbe + " " + sel.replace(/\[data-eigen="eigen-/, "[").replace(/"\]/, "]"); }
      }
      await h.ctx.close();
    }
    pruef(min >= 4.5, "jede Schrift im Textblock ≥ 4,5:1 (Karte und Band × 3 Häuser × hell/dunkel; das Vorführhaus nimmt keinen Aufbau aus der Datenbank)", min.toFixed(2) + " am schlechtesten: " + wo);
  }

  /* C8 · kein Überlauf bei jeder Breite, auch mit allem zugleich */
  {
    const lang = "Donaudampfschifffahrtsgesellschaftskapitänsmützenabzeichen ".repeat(5);
    const L = [eigen(AB, { text: lang, titel: "T".repeat(40), knopf: "K".repeat(24), ziel: "#/speisekarte", breite: "halb", groesse: "gross" }),
               eigen(CD, { text: lang, breite: "halb", groesse: "gross" }), { id: "begleiter", groesse: "gross" }, { id: "schnell", groesse: "klein" },
               { id: "nochmal", breite: "halb", groesse: "gross" }, { id: "empfehlung", breite: "halb", groesse: "gross" }, { id: "rubrik:Die Karte", groesse: "gross" },
               { id: "rubrik:Jetzt am Tisch", groesse: "klein" }];
    let alle = true, rep = [];
    for(const haus of ["chocolamour", "blend"]) for(const b of [320, 360, 390, 430]){
      const h = await oeffneHub(br, { haus, bloecke: L, breite: b });
      const o = await h.p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      if(o.sw > o.cw + 1){ alle = false; rep.push(haus + "@" + b + ": " + o.sw + ">" + o.cw); }
      await h.ctx.close();
    }
    pruef(alle, "kein seitlicher Überlauf bei 320/360/390/430 px, zwei Häuser, alles zugleich", rep.join(" | "));
  }

  /* C9 · Gemerkt im Gerät: nur das Geprüfte, ohne Netz ab dem ersten Anstrich */
  {
    const L = [eigen(AB, { titel: "Zuerst" }), { id: "rubrik:Die Karte" }, { id: "begleiter" }];
    const h = await oeffneHub(br, { haus: "chocolamour", bloecke: L });
    const gemerkt = await h.p.evaluate(() => { try{ return JSON.parse(localStorage.getItem("omoteno-bloecke-chocolamour")); }catch(e){ return "kaputt"; } });
    pruef(Array.isArray(gemerkt) && gemerkt.length === 3 && gemerkt[0].id === AB && gemerkt[0].look === "karte", "der Aufbau wird im Gerät gemerkt (geprüfte Form)", JSON.stringify(gemerkt).slice(0, 120));
    await h.ctx.setOffline(true);
    await h.p.reload(); await h.p.waitForTimeout(900);
    const s = await struktur(h.p);
    pruef(ids(s)[0] === AB && ids(s).includes("rubrik:Die Karte"), "zweiter Besuch ohne Netz: der Aufbau steht schon im ersten Bild", ids(s).join(" › "));
    await h.p.evaluate(() => betriebsTeileAnwenden({ hub_bloecke: null }, false));
    pruef(await h.p.evaluate(() => localStorage.getItem("omoteno-bloecke-chocolamour") === null), "ein Haus, das zur Vorgabe zurückkehrt, löscht den gemerkten Stand");
    await h.ctx.close();
    const gift = await oeffneHub(br, { haus: "chocolamour", bloecke: [{ id: AB, titel: "<b>x</b>", ziel: "javascript:1", look: "grell" }, { id: "kopf" }, { id: "eigen-zz99", titel: 'a"b' }] });
    const g = await gift.p.evaluate(() => localStorage.getItem("omoteno-bloecke-chocolamour"));
    pruef(g && !/[<>]|javascript|grell|"kopf"/.test(g) && /eigen-zz99/.test(g), "gemerkt wird nie der rohe Wert aus der Spalte", g);
    await gift.ctx.close();
  }

  /* ══ D · Das Board ══════════════════════════════════════════════════════ */
  console.log("\n══ D · Board ══");
  const ctx = await br.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const p = await ctx.newPage();
  const pf = [];
  p.on("pageerror", e => pf.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
  await p.goto(ADMIN); await p.waitForTimeout(800);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); zeichneAlles();
    const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; tafelZeigen("startseite"); kbAusZeile([]); kbZeichnen(); });
  await p.waitForTimeout(400);
  const da = await gruppeZu(p, "#gh-aufbau");
  pruef(da, "Voraussetzung: die Unterseite „Aufbau“ ist über ihre Kachel offen");
  const kachel = await p.evaluate(() => { const k = document.querySelector('[data-eu-seite="gh-aufbau"]'); return !!k; });
  pruef(kachel, "es gibt eine Kachel „Aufbau“ in „Gast-Hub gestalten“");

  const reihe = () => p.evaluate(() => AFBSTAND.map(b => b.id));
  const domReihe = () => p.evaluate(() => [...document.querySelectorAll("#afbListe > [data-afb]")].map(e => e.dataset.afb));
  const rubBoard = await p.evaluate(() => kbRubriken().filter(g => KACHELSTAND.some(k => k.an && kbGruppeVon(k.schluessel) === g)));
  const r0 = await reihe();
  pruef(gleich(r0, festIds.concat(rubBoard.map(g => "rubrik:" + g))), "ohne eigene Wahl: sechs feste Blöcke, dann die Rubriken der Kacheln (zweite Quelle: Anordnung)", r0.join(" "));
  pruef(gleich(await domReihe(), r0), "die gezeichnete Liste hat eine Zeile je Block, in dieser Reihenfolge");
  pruef(await p.evaluate(() => afbRoh() === null), "ohne eigene Wahl schickt afbRoh() nichts (null = Vorgabe)");
  const kopfFest = await p.evaluate(() => { const f = document.querySelector("#gh-aufbau .afb-fest"); return f ? { t: f.textContent, knopf: !!f.querySelector("[data-afb-gehe='kfGruppe']") } : null; });
  pruef(kopfFest && /Kopf/.test(kopfFest.t) && /oben/.test(kopfFest.t) && kopfFest.knopf, "der Kopf steht fest oben, mit Weg zu „Kopf & Logo“");

  /* Markierung: Zustand und echte Gesten */
  const us = await p.evaluate(() => ({
    liste: getComputedStyle(document.getElementById("afbListe")).userSelect, griff: getComputedStyle(document.querySelector("[data-afb-griff]")).userSelect,
    ta: (() => { AFB_OFFEN.add(AFBSTAND.find(b => blockArt(b.id) === "eigen") ? "x" : "x"); return ""; })() }));
  pruef(us.liste === "none" && us.griff === "none", "Liste und Griff sind nicht markierbar (user-select: none)", us.liste + " / " + us.griff);
  const sel0 = await p.evaluate(async () => {
    const z = document.querySelector('[data-afb="schnell"] .kbkopftext b');
    const r = z.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await p.mouse.dblclick(sel0.x, sel0.y); await p.mouse.click(sel0.x, sel0.y, { clickCount: 3 });
  const nachDoppel = await p.evaluate(() => ({ text: String(getSelection()), offen: AFB_OFFEN.size }));
  pruef(nachDoppel.text === "", "Doppel- und Dreifachtipp auf einen Blocknamen markiert keinen Text", JSON.stringify(nachDoppel.text));
  await p.evaluate(() => { AFB_OFFEN.clear(); afbZeichnen(); });

  /* Zeile öffnen: Bedienelemente, Größen */
  await p.click('[data-afb="begleiter"] [data-afb-auf]'); await p.waitForTimeout(300);
  const off = await p.evaluate(() => {
    const z = document.querySelector('[data-afb="begleiter"]');
    const h = el => el.getBoundingClientRect().height, b = el => el.getBoundingClientRect().width;
    return { breite: [...z.querySelectorAll("[data-afb-breite]")].map(e => e.dataset.afbBreite), groesse: [...z.querySelectorAll("[data-afb-groesse]")].map(e => e.dataset.afbGroesse),
      klein: [...z.querySelectorAll("button, [data-afb-griff]")].filter(e => h(e) < 44 || b(e) < 44).map(e => e.className + ":" + Math.round(b(e)) + "x" + Math.round(h(e))),
      weg: !!z.querySelector("[data-afb-gehe='gh-figur']") };
  });
  pruef(gleich(off.breite, ["voll", "halb"]) && gleich(off.groesse, ["klein", "", "gross"]), "geöffnet: Breite ganz/halb, Größe klein/normal/groß", JSON.stringify(off.breite) + JSON.stringify(off.groesse));
  pruef(off.klein.length === 0, "jede Bedienfläche ≥ 44 px (Knöpfe, Griff; der Schalter ist der des ganzen Boards, 51 × 31)", off.klein.join(" | ") || "ok");
  pruef(off.weg, "Weg zu den Einstellungen dieses Blocks (Figur)");
  await p.click('[data-afb="schnell"] [data-afb-auf]'); await p.waitForTimeout(300);
  const sn = await p.evaluate(() => { const z = document.querySelector('[data-afb="schnell"]'); return { breite: z.querySelectorAll("[data-afb-breite]").length, groesse: [...z.querySelectorAll("[data-afb-groesse]")].map(e => e.dataset.afbGroesse), satz: z.textContent }; });
  pruef(sn.breite === 0 && /volle Breite/.test(sn.satz) && gleich(sn.groesse, ["klein", ""]) && /Größer geht hier nicht/.test(sn.satz), "Schnellzugriff: keine Breitenwahl (sagt warum), kein „groß“ (sagt warum)");
  await p.evaluate(() => { AFB_OFFEN.clear(); afbZeichnen(); });

  /* Verschieben ohne Ziehen: Pfeile im geöffneten Block */
  await p.click('[data-afb="aktion"] [data-afb-auf]'); await p.waitForTimeout(250);
  await p.evaluate(() => document.querySelector('[data-afb="aktion"] [data-afb-hoch]').scrollIntoView({ block: "center" }));
  await p.click('[data-afb="aktion"] [data-afb-hoch]'); await p.waitForTimeout(150);
  const nachHoch = await reihe();
  pruef(nachHoch[1] === "aktion" && nachHoch[2] === "begleiter", "„Nach oben“ tauscht mit dem Nachbarn", nachHoch.slice(0, 4).join(" "));
  pruef(await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute("data-afb-hoch")), "der Fokus bleibt am Knopf (mehrmals tippbar)");
  await p.click('[data-afb="aktion"] [data-afb-runter]'); await p.waitForTimeout(150);
  pruef(gleich(await reihe(), r0), "„Nach unten“ stellt es wieder her");
  pruef(await p.evaluate(() => afbRoh() === null || Array.isArray(afbRoh())), "…");
  pruef(await p.evaluate(() => { const z = document.querySelector('[data-afb="schnell"]'); AFB_OFFEN.add("schnell"); afbZeichnen(); return document.querySelector('[data-afb="schnell"] [data-afb-hoch]').disabled; }), "der oberste Block kann nicht weiter nach oben");
  await p.evaluate(() => { AFB_OFFEN.clear(); afbZeichnen(); });
  pruef(await p.evaluate(() => afbRoh() === null), "wieder in der Vorgabe-Reihenfolge ⇒ wieder null (nichts zu speichern)");

  /* Ziehen mit der Maus am Griff */
  await p.evaluate(() => { AFBGEAENDERT = false; });
  await p.evaluate(() => { document.querySelector('[data-afb="schnell"]').scrollIntoView({ block: "start" }); scrollBy(0, -140); });
  await p.waitForTimeout(150);
  const gb = await p.locator('[data-afb="banner"] [data-afb-griff]').boundingBox(), zb = await p.locator('[data-afb="schnell"]').boundingBox();
  await p.mouse.move(gb.x + 22, gb.y + 22); await p.mouse.down(); await p.mouse.move(gb.x + 22, zb.y + 6, { steps: 14 });
  const mitten = await p.evaluate(() => ({ zieht: document.body.classList.contains("afb-zieht"), sel: String(getSelection()), us: getComputedStyle(document.body).userSelect, bewegt: !!document.querySelector(".afb-zeile.zieht") }));
  pruef(mitten.zieht && mitten.bewegt && mitten.sel === "" && mitten.us === "none", "beim Ziehen: Seite unmarkierbar, nichts ausgewählt, Zeile abgehoben", JSON.stringify(mitten));
  await p.mouse.up(); await p.waitForTimeout(250);
  const nachZug = await reihe();
  pruef(nachZug[0] === "banner" && nachZug[1] === "schnell", "Ziehen am Griff verschiebt den Block (Maus)", nachZug.slice(0, 3).join(" "));
  pruef(gleich(await domReihe(), nachZug), "und die gezeichnete Liste folgt dem Stand");
  pruef(await p.evaluate(() => AFBGEAENDERT === true), "Ziehen gilt als Änderung (Voraussetzung vorher selbst auf „nicht geändert“ gestellt)");
  const nach = await p.evaluate(() => ({ sel: String(getSelection()), zieht: document.body.classList.contains("afb-zieht"), roh: afbRoh().map(e => e.id), fokus: document.activeElement && document.activeElement.hasAttribute("data-afb-griff") }));
  pruef(nach.sel === "" && !nach.zieht, "danach keine Auswahl und kein Zieh-Zustand mehr");
  pruef(nach.roh[0] === "banner" && nach.roh.length === nachZug.length, "afbRoh() trägt die neue Reihenfolge (alle Blöcke)", nach.roh.slice(0, 3).join(" "));
  pruef(nach.fokus, "der Fokus steht danach am Griff des verschobenen Blocks");
  pruef(await p.evaluate(() => /Platz 1 von/.test(document.getElementById("afbSage").textContent)), "die neue Stelle wird angesagt (aria-live)", await p.evaluate(() => document.getElementById("afbSage").textContent));

  /* Tastatur am Griff */
  await p.focus('[data-afb="banner"] [data-afb-griff]'); await p.keyboard.press("ArrowDown"); await p.waitForTimeout(100);
  pruef(gleich((await reihe()).slice(0, 2), ["schnell", "banner"]), "Pfeil runter am Griff verschiebt (ohne Ziehen)");
  await p.keyboard.press("ArrowUp"); await p.waitForTimeout(100);

  /* Ziehen mit dem Finger (CDP): Seite rollt nicht mit, Block wandert */
  const cdp = await ctx.newCDPSession(p);
  await p.evaluate(() => { document.querySelector('[data-afb="schnell"]').scrollIntoView({ block: "start" }); scrollBy(0, -140); });
  await p.waitForTimeout(150);
  const g2 = await p.locator('[data-afb="nochmal"] [data-afb-griff]').boundingBox(), z2 = await p.locator('[data-afb="begleiter"]').boundingBox();
  const y0 = await p.evaluate(() => scrollY);
  const tp = (typ, x, y) => cdp.send("Input.dispatchTouchEvent", { type: typ, touchPoints: typ === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  await tp("touchStart", g2.x + 22, g2.y + 22);
  for(let i = 1; i <= 14; i++){ await tp("touchMove", g2.x + 22, g2.y + 22 + (z2.y + 8 - g2.y - 22) * i / 14); await p.waitForTimeout(16); }
  const fingerMitten = await p.evaluate(() => ({ zieht: document.body.classList.contains("afb-zieht"), sel: String(getSelection()) }));
  await tp("touchEnd"); await p.waitForTimeout(300);
  const y1 = await p.evaluate(() => scrollY), nachFinger = await reihe();
  pruef(fingerMitten.zieht && fingerMitten.sel === "", "mit dem Finger: Zieh-Zustand, nichts ausgewählt", JSON.stringify(fingerMitten));
  pruef(Math.abs(y1 - y0) <= 2, "der Griff rollt die Seite nicht mit (touch-action)", y0 + " → " + y1);
  pruef(nachFinger.indexOf("nochmal") < nachFinger.indexOf("begleiter"), "Ziehen mit dem Finger verschiebt den Block", nachFinger.slice(0, 6).join(" "));
  /* Wischen neben dem Griff rollt die Seite (der Rest der Zeile ist keine Zieh-Fläche) */
  await p.evaluate(() => scrollTo(0, 0));
  const t1 = await p.locator('[data-afb="schnell"] .kbkopftext').boundingBox();
  const y2 = await p.evaluate(() => scrollY);
  await tp("touchStart", t1.x + 40, t1.y + 20);
  for(let i = 1; i <= 10; i++){ await tp("touchMove", t1.x + 40, t1.y + 20 - 14 * i); await p.waitForTimeout(16); }
  await tp("touchEnd"); await p.waitForTimeout(400);
  const y3 = await p.evaluate(() => scrollY);
  pruef(y3 > y2 + 20 && gleich(await reihe(), nachFinger), "ein Wisch auf dem Namen rollt die Seite und verschiebt nichts", y2 + " → " + y3);

  /* Schalter, Breite, Größe → afbRoh */
  await p.evaluate(() => { AFBSTAND = afbVorgabe(); AFBGEAENDERT = false; AFB_OFFEN.clear(); afbZeichnen(); document.querySelector('[data-afb="schnell"]').scrollIntoView({ block: "start" }); scrollBy(0, -140); });
  await p.waitForTimeout(100);
  await p.click('[data-afb="aktion"] .kipp'); await p.waitForTimeout(100);
  const aus = await p.evaluate(() => ({ zeile: document.querySelector('[data-afb="aktion"]').classList.contains("aus"), roh: afbRoh() }));
  pruef(aus.zeile && aus.roh && aus.roh.find(e => e.id === "aktion").an === false && aus.roh.filter(e => "an" in e).length === 1, "Schalter aus: Zeile gedämpft, nur dieser Block trägt an:false", JSON.stringify(aus.roh && aus.roh.filter(e => "an" in e)));
  await p.click('[data-afb="begleiter"] [data-afb-auf]'); await p.waitForTimeout(250);
  await p.click('[data-afb="begleiter"] [data-afb-breite="halb"]'); await p.click('[data-afb="begleiter"] [data-afb-groesse="klein"]'); await p.waitForTimeout(100);
  const bg = await p.evaluate(() => ({ roh: afbRoh().find(e => e.id === "begleiter"), zus: document.querySelector('[data-afb="begleiter"] .kbkopftext i').textContent, gewaehlt: [...document.querySelectorAll('[data-afb="begleiter"] [aria-checked="true"]')].map(e => e.textContent) }));
  pruef(bg.roh.breite === "halb" && bg.roh.groesse === "klein" && /Halb breit · Klein/.test(bg.zus), "Breite „Halb“ und Größe „Klein“ gehen in den Aufbau und in die Kopfzeile", JSON.stringify(bg.roh) + " | " + bg.zus);
  pruef(gleich(bg.gewaehlt, ["Halb", "Klein"]), "die gewählten Stellungen sind markiert (aria-checked)", bg.gewaehlt.join(","));
  pruef(await p.evaluate(() => { const roh = afbRoh(); return JSON.stringify(bloeckeSauber(roh).map(b => [b.id, b.an, b.breite, b.groesse])) === JSON.stringify(AFBSTAND.map(b => [b.id, b.an, blockHalbOk(b.id) ? b.breite : "voll", b.groesse])); }),
        "Rundlauf: was das Board schickt, übersteht die Prüfung des Hubs unverändert");

  /* Eigener Textblock */
  await p.evaluate(() => { AFB_OFFEN.clear(); afbZeichnen(); });
  await p.click("#afbNeuText"); await p.waitForTimeout(250);
  const neu = await p.evaluate(() => { const z = AFBSTAND[0]; return { id: z.id, art: blockArt(z.id), offen: AFB_OFFEN.has(z.id), fokus: document.activeElement && document.activeElement.hasAttribute("data-afb-titel"), schrift: getComputedStyle(document.activeElement).fontSize }; });
  pruef(neu.art === "eigen" && neu.offen && neu.fokus, "„＋ Eigener Textblock“ legt oben einen an, öffnet ihn, Fokus im Titel", JSON.stringify(neu));
  pruef(parseFloat(neu.schrift) >= 16, "Eingabefeld ≥ 16 px (kein iOS-Zoom)", neu.schrift);
  await p.keyboard.type("Heute Waffeltag");
  const tipp = await p.evaluate(() => ({ kopf: document.querySelector('[data-afb="' + AFBSTAND[0].id + '"] .kbkopftext b').textContent, fokus: document.activeElement && document.activeElement.hasAttribute("data-afb-titel"), wert: document.activeElement.value }));
  pruef(tipp.kopf === "Heute Waffeltag" && tipp.fokus && tipp.wert === "Heute Waffeltag", "Tippen zieht die Kopfzeile nach und behält den Fokus im Feld (kein Neuaufbau)", JSON.stringify(tipp));
  const textfeld = await p.evaluate(() => getComputedStyle(document.querySelector("[data-afb-text]")).userSelect);
  pruef(textfeld === "text", "Eingabefelder bleiben markierbar (Text lässt sich bearbeiten)", textfeld);
  await p.focus("[data-afb-text]"); await p.keyboard.type("Alle Waffeln mit extra Sauce.");
  await p.focus("[data-afb-knopf]"); await p.keyboard.type("Zur Karte");
  /* Knopf ohne Ziel → Satz, kein Speichern */
  const ps1 = await p.evaluate(() => afbPruefen());
  pruef(ps1.length === 1 && /braucht ein Ziel/.test(ps1[0]), "Knopftext ohne Ziel wird beanstandet — mit dem Namen des Blocks", ps1.join(" | "));
  await p.selectOption("[data-afb-ziel]", "link"); await p.waitForTimeout(100);
  await p.fill("[data-afb-link]", "http://unsicher.de");
  const ps2 = await p.evaluate(() => afbPruefen());
  pruef(ps2.some(x => /https:\/\//.test(x)), "ein Link ohne https wird beanstandet", ps2.join(" | "));
  await p.fill("[data-afb-link]", "https://beispiel.de/waffel");
  await p.selectOption("[data-afb-ziel]", "#/speisekarte"); await p.waitForTimeout(100);
  pruef(await p.evaluate(() => afbPruefen().length === 0), "mit einem Ziel der Hub-Seiten ist der Block in Ordnung");
  await p.click('[data-afb="' + neu.id + '"] [data-afb-look="band"]');
  const roh1 = await p.evaluate(() => afbRoh().find(e => blockArt(e.id) === "eigen"));
  pruef(roh1 && roh1.titel === "Heute Waffeltag" && roh1.text === "Alle Waffeln mit extra Sauce." && roh1.knopf === "Zur Karte" && roh1.ziel === "#/speisekarte" && roh1.look === "band",
        "afbRoh trägt Titel, Text, Knopf, Ziel und Aussehen des Textblocks", JSON.stringify(roh1));
  /* entfernen erst beim zweiten Tipp */
  await p.evaluate(id => document.querySelector('[data-afb="' + id + '"] [data-afb-loeschen]').scrollIntoView({ block: "center" }), neu.id);
  await p.click('[data-afb="' + neu.id + '"] [data-afb-loeschen]');
  pruef(await p.evaluate(id => !!afbFinden(id), neu.id), "Entfernen: der erste Tipp fragt nur");
  await p.click('[data-afb="' + neu.id + '"] [data-afb-loeschen]'); await p.waitForTimeout(100);
  pruef(await p.evaluate(id => !afbFinden(id), neu.id), "der zweite Tipp entfernt den Block");
  /* Obergrenze eigener Blöcke */
  await p.evaluate(() => { for(let i = 0; i < 12; i++) document.getElementById("afbNeuText").click(); });
  pruef(await p.evaluate(() => AFBSTAND.filter(b => blockArt(b.id) === "eigen").length) === 10, "höchstens zehn eigene Textblöcke");

  /* Vorschau-Weg: Board → Hub (Naht, §8.1i) */
  await p.evaluate(() => { AFBGEAENDERT = false; AFBSTAND = afbVorgabe(); AFB_OFFEN.clear(); afbZeichnen(); window.__gesendet = []; const alt = hvSenden; window.hvSenden = function(){ window.__gesendet.push(JSON.parse(JSON.stringify(arguments[1]))); return alt.apply(this, arguments); }; });
  pruef(await p.evaluate(() => { AFBGESPEICHERT = undefined; window.__gesendet.length = 0; hvStartseite(); return !("hub_bloecke" in (window.__gesendet[0] || {})); }), "ungelesener Stand: die Vorschau bekommt KEINEN Aufbau (sonst zeigte sie die Vorgabe statt des Hauses, §8.1m)");
  await p.evaluate(() => { AFBGESPEICHERT = []; });

  await p.evaluate(() => {
    AFBSTAND = afbVorgabe(); AFBGEAENDERT = true;
    AFBSTAND.unshift(Object.assign(afbNeuEintrag("eigen-ab12"), { titel: "Vorschau-Block", text: "Aus dem Board", knopf: "Los", ziel: "#/speisekarte" }));
    const i = AFBSTAND.findIndex(b => b.id === "aktion"); AFBSTAND[i].an = false;
    const j = AFBSTAND.findIndex(b => b.id === "rubrik:Jetzt am Tisch"); const [x] = AFBSTAND.splice(j, 1); AFBSTAND.splice(1, 0, x);
    window.__gesendet.length = 0; afbGeaendert(); afbZeichnen();
  });
  const payload = await p.evaluate(() => window.__gesendet[window.__gesendet.length - 1]);
  const gesendet = payload && payload.hub_bloecke;
  pruef(Array.isArray(gesendet) && gesendet[0].id === "eigen-ab12", "jede Änderung geht sofort an die Vorschau (hub_bloecke im Entwurf)", gesendet && gesendet.map(e => e.id).slice(0, 3).join(" "));
  const hv = await oeffneHub(br, { haus: "blend", vorschau: true });
  await hv.p.evaluate(e => vorschauSetzen(e), payload);
  await hv.p.waitForTimeout(400);
  const ss = await struktur(hv.p);
  const erwartet = gesendet.filter(e => e.an !== false).map(e => e.id).filter(id => ids(ss).includes(id));
  pruef(ids(ss)[0] === "eigen-ab12" && gleich(ids(ss).filter(i => erwartet.includes(i)), erwartet) && !ids(ss).includes("aktion"),
        "die Vorschau im Hub zeigt genau diese Reihenfolge, ohne den ausgeblendeten Block (Board → Hub am gezeichneten Bild)", ids(ss).join(" › "));
  pruef(ids(ss).indexOf("rubrik:Jetzt am Tisch") >= 0 && ids(ss).indexOf("rubrik:Jetzt am Tisch") < ids(ss).indexOf("rubrik:Die Karte") || !ids(ss).includes("rubrik:Jetzt am Tisch"),
        "eine verschobene Rubrik steht im Hub an der neuen Stelle", ids(ss).join(" › "));
  await hv.ctx.close();

  /* Speichern: gelesen vor geschrieben, null Zeilen, Fehler als Satz */
  const stelleDb = () => p.evaluate(() => {
    window.__schrieb = []; window.__lesen = { data: { hub_bloecke: null }, error: null }; window.__antwort = { data: [{ id: "b1" }], error: null };
    demo = false; betriebId = "b1"; meineBetriebe = [{ id: "b1", name: "Probe", rolle: "inhaber" }];
    db = { from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(window.__lesen) }) }),
      update: daten => ({ eq: () => ({ select: () => { window.__schrieb.push(daten); return Promise.resolve(window.__antwort); } }) }) }) };
  });
  await stelleDb();
  await p.evaluate(() => { window.__lesen = { data: { hub_bloecke: [{ id: "schnell", an: false }, { id: "nochmal" }, { id: "begleiter" }] }, error: null }; });
  await p.evaluate(() => afbStandLaden()); await p.waitForTimeout(150);
  const gel = await p.evaluate(() => ({ ids: AFBSTAND.map(b => b.id), schnellAn: afbFinden("schnell").an, gespeichert: AFBGESPEICHERT.length, knopf: document.getElementById("afbSichern").disabled, vorschau: !!window.__gesendet.length }));
  pruef(gel.ids[0] === "schnell" && gel.schnellAn === false && gel.ids[1] === "nochmal" && gel.ids.length >= 10, "der gespeicherte Aufbau wird beim Öffnen gelesen und angezeigt (nach Neuladen, §8.1m); Ungenanntes hängt hinten an", gel.ids.slice(0, 4).join(" ") + " … " + gel.ids.length);
  pruef(gel.knopf === false, "gelesen ⇒ „Übernehmen“ ist frei");
  await p.evaluate(() => { window.__lesen = { data: null, error: { message: "boom" } }; });
  await p.evaluate(() => afbStandLaden()); await p.waitForTimeout(150);
  const unles = await p.evaluate(() => ({ knopf: document.getElementById("afbSichern").disabled, satz: document.getElementById("afbLese").textContent, sichtbar: !document.getElementById("afbLese").hidden }));
  pruef(unles.knopf === true && unles.sichtbar && /nicht gelesen/.test(unles.satz), "Lesefehler ⇒ „Übernehmen“ gesperrt und ein Satz (nicht gelesen ist nicht leer)", unles.satz);
  await p.evaluate(() => document.getElementById("afbSichern").click()); await p.waitForTimeout(100);
  pruef(await p.evaluate(() => window.__schrieb.length) === 0, "und es wird nichts geschrieben");

  await p.evaluate(() => { window.__lesen = { data: { hub_bloecke: null }, error: null }; });
  await p.evaluate(() => afbStandLaden()); await p.waitForTimeout(150);
  await p.evaluate(() => { const [b] = AFBSTAND.splice(AFBSTAND.findIndex(x => x.id === "banner"), 1); AFBSTAND.unshift(b); afbGeaendert(); afbZeichnen(); });
  await p.evaluate(() => document.getElementById("afbSichern").click()); await p.waitForTimeout(200);
  const gs = await p.evaluate(() => ({ n: window.__schrieb.length, daten: window.__schrieb[0], satz: document.getElementById("afbPruefung").textContent, geaendert: AFBGEAENDERT, gesp: AFBGESPEICHERT.length }));
  pruef(gs.n === 1 && gs.daten && Array.isArray(gs.daten.hub_bloecke) && gs.daten.hub_bloecke[0].id === "banner" && Object.keys(gs.daten).join() === "hub_bloecke",
        "Übernehmen schreibt genau hub_bloecke, in der gewählten Reihenfolge", JSON.stringify(gs.daten).slice(0, 120));
  pruef(/Übernommen/.test(gs.satz) && gs.geaendert === false && gs.gesp > 0, "nach dem Schreiben gilt der Stand als gespeichert", gs.satz);
  await p.evaluate(() => { AFBSTAND = afbVorgabe(); AFBGEAENDERT = true; afbZeichnen(); window.__schrieb.length = 0; });
  await p.evaluate(() => document.getElementById("afbSichern").click()); await p.waitForTimeout(200);
  pruef(await p.evaluate(() => window.__schrieb.length === 1 && window.__schrieb[0].hub_bloecke === null), "zurück auf die Vorgabe schreibt null (keine Liste, die jeden Vorgabewert mitschleppt)");
  /* null Zeilen = kein Recht (§2.3b) */
  await p.evaluate(() => { window.__antwort = { data: [], error: null }; AFBSTAND = afbVorgabe(); AFBSTAND.reverse(); AFBGEAENDERT = true; afbZeichnen(); window.__schrieb.length = 0; });
  await p.evaluate(() => document.getElementById("afbSichern").click()); await p.waitForTimeout(200);
  const ohneRecht = await p.evaluate(() => ({ satz: document.getElementById("afbPruefung").textContent, noch: AFBGEAENDERT, melde: document.querySelector("#toast, .toast") ? document.querySelector("#toast, .toast").textContent : "" }));
  pruef(/Nur der Besitzer/.test(ohneRecht.satz) && ohneRecht.noch === true && !/Übernommen/.test(ohneRecht.satz), "0 Zeilen getroffen ⇒ „Nur der Besitzer …“ statt Erfolg (die Regel hat verweigert)", ohneRecht.satz);
  await p.evaluate(() => { window.__antwort = { data: null, error: { message: 'new row violates check constraint "betriebe_hub_bloecke_form"' } }; });
  await p.evaluate(() => document.getElementById("afbSichern").click()); await p.waitForTimeout(200);
  pruef(await p.evaluate(() => /Zu viele oder zu lange/.test(document.getElementById("afbPruefung").textContent)), "Schranke der Datenbank ⇒ ein Satz, kein rohes Postgres");
  await p.evaluate(() => { window.__antwort = { data: null, error: { message: 'column "hub_bloecke" of relation "betriebe" does not exist' } }; });
  await p.evaluate(() => document.getElementById("afbSichern").click()); await p.waitForTimeout(200);
  pruef(await p.evaluate(() => /migration-hub-bloecke\.sql/.test(document.getElementById("afbPruefung").textContent)), "fehlende Migration ⇒ der Satz nennt die Datei");
  /* ungültiger Textblock sperrt das Senden */
  await p.evaluate(() => { window.__antwort = { data: [{ id: "b1" }], error: null }; AFBSTAND = afbVorgabe(); AFBSTAND.unshift(Object.assign(afbNeuEintrag("eigen-ab12"), { titel: "X", knopf: "Los", ziel: "" })); AFBGEAENDERT = true; afbZeichnen(); window.__schrieb.length = 0; });
  await p.evaluate(() => document.getElementById("afbSichern").click()); await p.waitForTimeout(150);
  pruef(await p.evaluate(() => window.__schrieb.length === 0 && /braucht ein Ziel/.test(document.getElementById("afbPruefung").textContent)), "ein beanstandeter Textblock wird nicht gesendet, der Satz steht da");

  /* Rubriken-Pfeile in der Anordnung, solange ein eigener Aufbau gilt */
  await p.evaluate(() => { AFBGEAENDERT = false; AFBGESPEICHERT = []; AFBSTAND = afbVorgabe(); kbZeichnen(); });
  const pf0 = await p.evaluate(() => [...document.querySelectorAll("#kbAnordnung .kbr-rknopf[data-kbr-rrunter]")].map(b => b.disabled));
  await p.evaluate(() => { AFBGEAENDERT = true; kbZeichnen(); });
  const pf1 = await p.evaluate(() => ({ knoepfe: [...document.querySelectorAll("#kbAnordnung .kbr-rknopf[data-kbr-rhoch], #kbAnordnung .kbr-rknopf[data-kbr-rrunter]")].map(b => b.disabled), satz: !!document.querySelector("#kbAnordnung .kbr-aufbau") }));
  pruef(pf0.filter(x => !x).length >= 1, "Voraussetzung: ohne eigenen Aufbau lassen sich Rubriken in der Anordnung verschieben");
  pruef(pf1.knoepfe.every(x => x) && pf1.satz, "mit eigenem Aufbau sind diese Pfeile gesperrt und ein Satz verweist auf den Aufbau (eine Wahrheit, nicht zwei)");
  /* Umbenennen zieht den Block mit */
  const umb = await p.evaluate(() => { window.prompt = () => "Neu benannt"; const alt = afbRubriken()[1]; AFBGEAENDERT = true; afbStandAusSpeicher([]); AFBSTAND = afbVorgabe();
    const i = AFBSTAND.findIndex(b => b.id === "rubrik:" + alt); kbRubrikUmbenennen(alt);
    return { alt, i, jetzt: AFBSTAND.findIndex(b => b.id === "rubrik:Neu benannt"), weg: !AFBSTAND.some(b => b.id === "rubrik:" + alt) }; });
  pruef(umb.jetzt === umb.i && umb.weg, "Rubrik umbenennen: der Block zieht samt Platz mit", JSON.stringify(umb));

  pruef(pf.length === 0, "keine Skriptfehler im Board", pf.join(" | "));
  await ctx.close();

  await br.close();
  console.log("\n" + (fehler ? fehler + " Proben FEHLGESCHLAGEN" : "Alle Proben bestanden."));
  process.exit(fehler ? 1 : 0);
})();
