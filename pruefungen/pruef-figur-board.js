/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Figur des Hauses im Admin-Board (Block C)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-figur-board.js

   Auftrag: Im Board soll wählbar sein, welche Marken-Figur im Hub
   erscheint, welche Stimmung sie hat und was sie je Bestellphase in
   der Hand hält — als drei eingeklappte Karten (kbklapp-Muster,
   dasselbe wie die Symbolwahl der Kacheln), geschrieben auf die neue
   Live-Spalte betriebe.hub_avatar (migration-hub-avatar.sql).

   ZWEITE QUELLE (CLAUDE.md §8.1b): admin.html trägt eine eigene kurze
   {schluessel,name}-Liste (AV_FIGUREN/AV_ZUEGE/AV_REQUISITEN), keine
   Kopie des geteilten FIGUR-Blocks. Dieser Teil hält sie gegen
   AVATAR_FIGUREN/AVATAR_ZUEGE/E_REQUISITEN in vorlagen/hub.vorlage.html
   und, für die Stimmungsnamen, gegen ZUGNAMEN in
   seiten/marken-studio.html — genau wie pruef-baukasten.js es für
   KACHELPLAN/KACHELARTEN schon vormacht.

   EHRLICHE GRENZE: Die eigentliche Live-Spalte (Vorrang vor dem
   Markenblatt, stiller Rückfall bei unbekanntem Wert) wird hier per
   direktem Aufruf von avAusZeile()/avStandLaden() geprüft, ohne
   Supabase — das ist derselbe Weg, den auch die Bedienung im Board
   nimmt (meineBetriebe wird von echten Antworten genauso gefüllt).
   Ob die Migration wirklich in der Produktion liegt, prüft das hier
   nicht — das kann nur ein echtes Postgres (siehe die Proben am Ende
   von migration-hub-avatar.sql, dort schon gefahren und grün).

   Gegenbeweis gefahren: den strikten Vorrang von hub_avatar vor dem
   Markenblatt testweise umgedreht (avAusZeile so geändert, dass immer
   nur die Markenblatt-Basis zählt) → „hub_avatar überschreibt das
   Markenblatt" wurde rot. Zurückgenommen → grün.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs   = require("fs");
const path = require("path");

const OBEN  = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const HUB   = path.join(OBEN, "vorlagen", "hub.vorlage.html");
const STUDIO = path.join(OBEN, "seiten", "marken-studio.html");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

/* Liest {schluessel: {name, verborgen}} aus einem Block wie
   "const AVATAR_FIGUREN = { … }" — ein einfacher Zeilen-Automat statt
   JSON.parse, weil die Objekte Funktionen enthalten. */
function schluesselNamen(text, blockStart, blockEndeMuster){
  const start = text.indexOf(blockStart);
  if(start < 0) return null;
  const ende = text.slice(start).search(blockEndeMuster);
  const block = ende < 0 ? text.slice(start) : text.slice(start, start + ende);
  const raus = {};
  let aktuell = null;
  block.split("\n").forEach(zeile => {
    const kopf = zeile.match(/^\s{2}([a-zA-Z0-9_]+):\s*\{/);
    if(kopf){ aktuell = kopf[1]; raus[aktuell] = { name:null, verborgen:false }; return; }
    if(!aktuell) return;
    const nameM = zeile.match(/name:\s*"([^"]*)"/);
    if(nameM && raus[aktuell].name === null) raus[aktuell].name = nameM[1];
    if(/verborgen:\s*true/.test(zeile)) raus[aktuell].verborgen = true;
  });
  return raus;
}

(async () => {
  const adminText = fs.readFileSync(ADMIN, "utf8");
  const hubText    = fs.readFileSync(HUB, "utf8");
  const studioText = fs.readFileSync(STUDIO, "utf8");

  console.log("\n══ Zweite Quelle: AV_FIGUREN gegen AVATAR_FIGUREN ══");
  const figurenQuelle = schluesselNamen(hubText, "const AVATAR_FIGUREN = {", /\nfunction figurSVG/);
  pruef(!!figurenQuelle, "AVATAR_FIGUREN im geteilten Block gefunden",
    figurenQuelle ? Object.keys(figurenQuelle).length + " Figuren" : "nicht gefunden");

  const avFigurenM = adminText.match(/const AV_FIGUREN = \[([\s\S]*?)\];/);
  pruef(!!avFigurenM, "AV_FIGUREN in admin.html gefunden");
  const avFiguren = avFigurenM
    ? [...avFigurenM[1].matchAll(/\{s:"([a-zA-Z0-9_]+)",\s*name:"([^"]*)"\}/g)]
        .map(m => ({ s:m[1], name:m[2] }))
    : [];
  pruef(avFiguren.length > 0, "AV_FIGUREN ist nicht leer", avFiguren.length + " Einträge");

  if(figurenQuelle && avFiguren.length){
    const wählbar = Object.keys(figurenQuelle).filter(k => !figurenQuelle[k].verborgen);
    pruef(!avFiguren.some(f2 => f2.s === "untersetzer"),
      "der Untersetzer steht NICHT zur Wahl (bleibt stiller Rückfall)");
    pruef(avFiguren.every(f2 => wählbar.indexOf(f2.s) >= 0),
      "jeder Schlüssel in AV_FIGUREN existiert wirklich und ist wählbar",
      avFiguren.filter(f2 => wählbar.indexOf(f2.s) < 0).map(f2 => f2.s).join(", ") || "alle gültig");
    pruef(wählbar.every(k => avFiguren.some(f2 => f2.s === k)),
      "keine wählbare Figur des Gerüsts fehlt im Board",
      wählbar.filter(k => !avFiguren.some(f2 => f2.s === k)).join(", ") || "keine fehlt");
    const falscherName = avFiguren.filter(f2 => figurenQuelle[f2.s] && figurenQuelle[f2.s].name !== f2.name);
    pruef(falscherName.length === 0, "Namen stimmen überein (Board zeigt denselben Namen wie der Block)",
      falscherName.map(f2 => f2.s + ": " + f2.name + " ≠ " + figurenQuelle[f2.s].name).join(", ") || "alle gleich");
  }

  console.log("\n══ Zweite Quelle: AV_ZUEGE gegen AVATAR_ZUEGE + ZUGNAMEN ══");
  const zuegeM = hubText.match(/const AVATAR_ZUEGE = \{([\s\S]*?)\nconst E_REQUISITEN/);
  const zuegeSchluessel = zuegeM
    ? [...zuegeM[1].matchAll(/^\s{2}([a-zA-Z0-9_]+):\s*\{/gm)].map(m => m[1]) : [];
  pruef(zuegeSchluessel.length > 0, "AVATAR_ZUEGE im geteilten Block gefunden",
    zuegeSchluessel.join(", "));

  const avZuegeM = adminText.match(/const AV_ZUEGE = \[([\s\S]*?)\];/);
  const avZuege = avZuegeM
    ? [...avZuegeM[1].matchAll(/\{s:"([a-zA-Z0-9_]+)",\s*name:"([^"]*)"\}/g)]
        .map(m => ({ s:m[1], name:m[2] })) : [];
  pruef(avZuege.length === 3, "genau drei Stimmungen wählbar", avZuege.length + "");
  pruef(avZuege.every(z => zuegeSchluessel.indexOf(z.s) >= 0),
    "jede gewählte Stimmung existiert wirklich in AVATAR_ZUEGE",
    avZuege.filter(z => zuegeSchluessel.indexOf(z.s) < 0).map(z => z.s).join(", ") || "alle gültig");

  const zugnamenM = studioText.match(/var ZUGNAMEN = \{([^}]*)\}/);
  const zugnamen = {};
  if(zugnamenM) [...zugnamenM[1].matchAll(/(\w+):\s*"([^"]*)"/g)].forEach(m => zugnamen[m[1]] = m[2]);
  const abweichend = avZuege.filter(z => zugnamen[z.s] && zugnamen[z.s] !== z.name);
  pruef(Object.keys(zugnamen).length === 3 && abweichend.length === 0,
    "Stimmungsnamen stimmen mit marken-studio.html (ZUGNAMEN) überein",
    abweichend.map(z => z.s + ": " + z.name + " ≠ " + zugnamen[z.s]).join(", ") || "alle gleich");

  console.log("\n══ Zweite Quelle: AV_REQUISITEN gegen E_REQUISITEN ══");
  const requisitenQuelle = schluesselNamen(hubText, "const E_REQUISITEN = {", /\nconst AVATAR_FIGUREN/);
  const avReqM = adminText.match(/const AV_REQUISITEN = \[([\s\S]*?)\];/);
  const avReq = avReqM
    ? [...avReqM[1].matchAll(/\{s:"([a-zA-Z0-9_]+)",\s*name:"([^"]*)"\}/g)]
        .map(m => ({ s:m[1], name:m[2] })) : [];
  pruef(!!requisitenQuelle && avReq.length > 0, "beide Listen gefunden",
    (requisitenQuelle ? Object.keys(requisitenQuelle).length : 0) + " gegen " + avReq.length);
  if(requisitenQuelle){
    pruef(Object.keys(requisitenQuelle).every(k => avReq.some(r => r.s === k)),
      "jede Requisite des Gerüsts steht auch im Board zur Wahl",
      Object.keys(requisitenQuelle).filter(k => !avReq.some(r => r.s === k)).join(", ") || "keine fehlt");
    pruef(avReq.every(r => requisitenQuelle[r.s]),
      "das Board erfindet keine Requisite, die es nicht gibt",
      avReq.filter(r => !requisitenQuelle[r.s]).map(r => r.s).join(", ") || "keine erfunden");
    const falsch = avReq.filter(r => requisitenQuelle[r.s] && requisitenQuelle[r.s].name !== r.name);
    pruef(falsch.length === 0, "Requisiten-Namen stimmen überein",
      falsch.map(r => r.s + ": " + r.name + " ≠ " + requisitenQuelle[r.s].name).join(", ") || "alle gleich");
  }

  /* ── Bedienung im Board: übersichtlich und ausklappbar ────────────
     Wunsch des Betreibers (26.09.): "wie ein Zahnrad rollbar" blieb
     unbedienbar (leeres #avListe, §8.1g Vorfall C). Jetzt eine
     zugeklappte Zeile je Wahl (Figur, Stimmung, Hände mit drei
     Unterzeilen je Phase) — dasselbe kbklapp/kbkopfknopf-Baumuster
     wie der Kachel-Baukasten (pruef-baukasten.js/pruef-kachelraster.js
     klicken denselben Weg: erst [data-*-auf] öffnen, dann bedienen).
     Innerhalb jeder offenen Zeile bleibt das Rad (.avspur/.avstueck)
     unverändert — Scroll-Snap zentriert die Wahl, ein Rad zeigt genau
     ein aktives Stück. */
  console.log("\n══ Bedienung: ausklappbare Zeilen, Räder darin, Auswahl, Vorschau ══");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const seite = await ctx.newPage();
  const konsole = [];
  seite.on("pageerror", e => konsole.push(String(e).slice(0, 300)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(700);
  await seite.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
  });
  await seite.waitForTimeout(500);
  const scharf = await seite.$("#scharfJetzt");
  if (scharf && await seite.isVisible("#scharf")) { await scharf.click(); await seite.waitForTimeout(200); }

  await seite.evaluate(() => document.querySelector('[data-tafel="startseite"]').click());
  await seite.waitForTimeout(400);
  await gruppeZu(seite, "#gh-figur");

  const zeilen = await seite.evaluate(() => document.querySelectorAll("#avListe > .kbzeile").length);
  pruef(zeilen === 3, "drei Zeilen stehen im Board (Figur, Stimmung, Hände)", zeilen + "");

  const unterzeilen = await seite.evaluate(() =>
    document.querySelectorAll('#avListe [data-av="haende"] .avunter').length);
  pruef(unterzeilen === 3, "die Hände-Zeile hat drei Unterzeilen, eine je Bestellphase", unterzeilen + "");

  const raeder = await seite.evaluate(() => document.querySelectorAll("#avListe .avspur").length);
  pruef(raeder === 5, "fünf Räder (Figur, Stimmung, drei Phasen der Hände)", raeder + "");

  const jeEinsAktiv = await seite.evaluate(() =>
    [...document.querySelectorAll("#avListe .avspur")].every(s =>
      s.querySelectorAll(".avstueck.aktiv").length === 1));
  pruef(jeEinsAktiv, "jedes Rad startet mit genau einem zentrierten Stück (auch zugeklappt)");

  const alleZuStart = await seite.evaluate(() =>
    [...document.querySelectorAll("#avListe [data-av-auf]")].every(k => k.getAttribute("aria-expanded") === "false")
    && [...document.querySelectorAll("#avListe .kbklapp")].every(k => !k.classList.contains("offen")));
  pruef(alleZuStart, "jede Zeile beginnt zugeklappt");

  /* Erst öffnen (echter Tipp auf den Kopf, wie im Kachel-Baukasten),
     dann bedienen — zugeklappt hat das Rad keine Höhe und ist mit dem
     Finger nicht erreichbar. */
  await seite.click('[data-av-auf="figur"]');
  await seite.waitForTimeout(400);
  const figurOffen = await seite.evaluate(() =>
    document.querySelector('[data-av-auf="figur"]').getAttribute("aria-expanded") === "true"
    && document.getElementById("avklapp-figur").classList.contains("offen"));
  pruef(figurOffen, "Tipp auf den Kopf öffnet die Figur-Zeile wirklich");

  const figurKnoepfe = await seite.evaluate(() => document.querySelectorAll('[data-av-wahl="figur"]').length);
  /* Zweite Quelle statt fester Zahl: so viele Knöpfe, wie der Hub
     wählbare Figuren kennt (seit 10.10. dreizehn — die feste 9 wäre bei
     jeder neuen Figur rot geworden, ohne dass etwas kaputt ist). */
  const wählbarZahl = figurenQuelle ? Object.keys(figurenQuelle).filter(k => !figurenQuelle[k].verborgen).length : -1;
  pruef(figurKnoepfe === wählbarZahl && figurKnoepfe >= 13, "jede wählbare Figur des Hubs steht zur Wahl", figurKnoepfe + " von " + wählbarZahl);
  const tapHoehe = await seite.evaluate(() => {
    const b = document.querySelector('[data-av-wahl="figur"]');
    return b ? b.getBoundingClientRect().height : 0;
  });
  pruef(tapHoehe >= 44, "Tapfläche ist mindestens 44px hoch (offen gemessen)", tapHoehe + "px");

  await seite.click('[data-av-wahl="figur"][data-av-wert="sushi"]');
  await seite.waitForTimeout(600); /* Smooth-Scroll + Observer brauchen etwas Zeit */
  const gewaehlt = await seite.evaluate(() => {
    const b = document.querySelector('[data-av-wahl="figur"][data-av-wert="sushi"]');
    return { aktiv: b.classList.contains("aktiv"), aria: b.getAttribute("aria-selected"),
      stand: typeof AVATARSTAND !== "undefined" ? AVATARSTAND.figur : null };
  });
  pruef(gewaehlt.aktiv && gewaehlt.aria === "true", "Auswahl markiert sich selbst (.aktiv/aria-selected)");
  pruef(gewaehlt.stand === "sushi", "und der Stand wird wirklich geschrieben, nicht nur die Optik", gewaehlt.stand);
  const nurEins = await seite.evaluate(() =>
    document.querySelectorAll('[data-av-wahl="figur"].aktiv').length);
  pruef(nurEins === 1, "genau ein Stück ist aktiv, kein zweites bleibt hängen");

  const vorschau = await seite.evaluate(() => document.getElementById("avVorschau").textContent);
  pruef(/Sushi/.test(vorschau), "die Vorschau oben zeigt die neue Wahl sofort", vorschau.trim());

  /* Tastatur: ArrowRight bewegt das Rad, ohne dass irgendwo Text
     verschwindet oder sich das Zeichen selbst verdoppelt. Erst die
     Stimmungs-Zeile öffnen — zugeklappt hat #avspur-zug keine Höhe. */
  await seite.click('[data-av-auf="zug"]');
  await seite.waitForTimeout(400);
  await seite.focus("#avspur-zug");
  const vorZug = await seite.evaluate(() => AVATARSTAND.art);
  await seite.keyboard.press("ArrowRight");
  await seite.waitForTimeout(500);
  const nachZug = await seite.evaluate(() => AVATARSTAND.art);
  pruef(nachZug !== vorZug, "Pfeiltaste bewegt das Rad auf ein anderes Stück", vorZug + " → " + nachZug);

  await seite.click("#avSichern");
  await seite.waitForTimeout(300);
  const meldung = await seite.evaluate(() => document.getElementById("avPruefung").textContent);
  pruef(/Vorführmodus/.test(meldung), "Demo-Modus meldet ehrlich statt zu behaupten", meldung.trim());

  await ctx.close();

  /* Reduzierte Bewegung: dieselbe Bedienung, ohne Trägheit. */
  const ctxR = await browser.newContext({ viewport:{ width:420, height:900 }, reducedMotion:"reduce" });
  const seiteR = await ctxR.newPage();
  const konsoleR = [];
  seiteR.on("pageerror", e => konsoleR.push(String(e).slice(0, 300)));
  await seiteR.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seiteR.goto("file://" + ADMIN);
  await seiteR.waitForTimeout(700);
  await seiteR.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
  });
  await seiteR.waitForTimeout(500);
  const scharfR = await seiteR.$("#scharfJetzt");
  if (scharfR && await seiteR.isVisible("#scharf")) { await scharfR.click(); await seiteR.waitForTimeout(200); }
  await seiteR.evaluate(() => document.querySelector('[data-tafel="startseite"]').click());
  await seiteR.waitForTimeout(400);
  await gruppeZu(seiteR, "#gh-figur");
  await seiteR.click('[data-av-auf="figur"]');
  await seiteR.waitForTimeout(200);
  await seiteR.click('[data-av-wahl="figur"][data-av-wert="burger"]');
  await seiteR.waitForTimeout(300); /* kein "smooth", darf sofort stehen */
  const sofortAktiv = await seiteR.evaluate(() =>
    document.querySelector('[data-av-wahl="figur"][data-av-wert="burger"]').classList.contains("aktiv"));
  pruef(sofortAktiv, "reduzierte Bewegung: die Wahl steht ohne Verzögerung");
  pruef(konsoleR.length === 0, "keine Ausnahme in der Konsole (reduzierte Bewegung)", konsoleR.join(" | ") || "still");
  await ctxR.close();

  pruef(konsole.length === 0, "keine Ausnahme in der Konsole", konsole.join(" | ") || "still");
  await browser.close();

  /* ── Rückfall-Kette und Vorrang, ohne Supabase ───────────────────── */
  console.log("\n══ Vorrang und Rückfall (direkt gegen avAusZeile) ══");
  const browser2 = await chromium.launch();
  const seite2 = await (await browser2.newContext()).newPage();
  const konsole2 = [];
  seite2.on("pageerror", e => konsole2.push(String(e).slice(0, 300)));
  await seite2.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite2.goto("file://" + ADMIN);
  await seite2.waitForTimeout(700);

  const ergebnisse = await seite2.evaluate(() => {
    betriebId = "t1";
    meineBetriebe = [{ id:"t1",
      markenblatt: { avatar: { figur:"burger", art:"witzig",
        haende:{ neu:"tasse", arbeit:"schale", fertig:"tuete" } } },
      hub_avatar: null }];
    avStandLaden();
    const nurMarkenblatt = JSON.parse(JSON.stringify(AVATARSTAND));

    meineBetriebe[0].hub_avatar = { figur:"eiswaffel", art:"ruhig",
      haende:{ neu:"glas", arbeit:"pfanne", fertig:"glocke" } };
    avStandLaden();
    const mitUeberschreiben = JSON.parse(JSON.stringify(AVATARSTAND));

    meineBetriebe[0].hub_avatar = { figur:"nicht-echt", art:"grantig",
      haende:{ neu:"unbekannt" } };
    avStandLaden();
    const unbekannt = JSON.parse(JSON.stringify(AVATARSTAND));

    return { nurMarkenblatt, mitUeberschreiben, unbekannt };
  });

  pruef(ergebnisse.nurMarkenblatt.figur === "burger" && ergebnisse.nurMarkenblatt.art === "witzig",
    "ohne hub_avatar gilt das Markenblatt (nicht ein blinder Vorgabewert)",
    JSON.stringify(ergebnisse.nurMarkenblatt));
  pruef(ergebnisse.mitUeberschreiben.figur === "eiswaffel" && ergebnisse.mitUeberschreiben.art === "ruhig",
    "hub_avatar überschreibt das Markenblatt", JSON.stringify(ergebnisse.mitUeberschreiben));
  pruef(ergebnisse.unbekannt.figur === "burger" && ergebnisse.unbekannt.art === "witzig" &&
    ergebnisse.unbekannt.haende.neu === "tasse",
    "ein unbekannter Wert in hub_avatar fällt auf das Markenblatt zurück, nicht auf undefined",
    JSON.stringify(ergebnisse.unbekannt));

  pruef(konsole2.length === 0, "keine Ausnahme in der Konsole (Rückfall-Teil)", konsole2.join(" | ") || "still");
  await browser2.close();

  /* ── Die Live-Spalte im HUB selbst (nicht nur im Board) ──────────
     karteHolen() lädt hub_avatar und mischt ihn vor jedem
     figurSVG()-Aufruf in MARKENBLATT.avatar ein (vorlagen/hub.vorlage.
     html). Geprüft wird direkt an avatarFigur()/avatarArt()/
     avatarHaende() — den Funktionen, die JEDE Zeichnung tatsächlich
     befragt, nicht am gemalten Bild. */
  console.log("\n══ Live-Spalte hub_avatar im Hub selbst ══");
  const DIST = path.join(OBEN, "dist", "chocolamour", "index.html");
  if(!fs.existsSync(DIST)){
    pruef(false, "dist/chocolamour/index.html fehlt — erst node erzeuger/erzeuge-hub.js --alle laufen lassen");
  } else {
    const BID = "33333333-3333-3333-3333-333333333333";
    const browser3 = await chromium.launch();
    const p = await browser3.newPage({ viewport:{ width:390, height:844 } });
    const kons3 = [];
    p.on("pageerror", e => kons3.push("JS: " + String(e).slice(0,200)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
      : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
    await p.route("**/rest/v1/betriebe**", r =>
      r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"",
          hub_texte:{}, hub_kacheln:null, hub_woerter:{}, liefer:null,
          hub_avatar:{ figur:"pizzaecke", art:"witzig",
            haende:{ neu:"glas", arbeit:"pancakes", fertig:"eis" } } }]) }));
    await p.addInitScript(() => localStorage.setItem("omoteno-willkommen","1"));
    await p.addInitScript(() => sessionStorage.setItem("omoteno-willkommen","1"));
    await p.goto("file://" + DIST);
    await p.waitForTimeout(1900);

    const gelesen = await p.evaluate(() => ({
      figur: typeof avatarFigur === "function" ? avatarFigur() : null,
      art:   typeof avatarArt === "function" ? avatarArt() : null,
      haende: typeof avatarHaende === "function" ? avatarHaende() : null,
    }));
    pruef(gelesen.figur === "pizzaecke", "hub_avatar.figur kommt im Hub an", gelesen.figur);
    pruef(gelesen.art === "witzig", "hub_avatar.art kommt im Hub an", gelesen.art);
    pruef(!!gelesen.haende && gelesen.haende.arbeit === "pancakes",
      "hub_avatar.haende kommt im Hub an", JSON.stringify(gelesen.haende));
    pruef(kons3.length === 0, "keine Ausnahme in der Konsole (gültiger Wert)", kons3.join(" | ") || "still");
    await p.close();

    /* Unbekannter Wert → stiller Rückfall, keine kaputte Seite. */
    const p2 = await browser3.newPage({ viewport:{ width:390, height:844 } });
    const kons4 = [];
    p2.on("pageerror", e => kons4.push("JS: " + String(e).slice(0,200)));
    await p2.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
      : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
    await p2.route("**/rest/v1/betriebe**", r =>
      r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"",
          hub_texte:{}, hub_kacheln:null, hub_woerter:{}, liefer:null,
          hub_avatar:{ figur:"nicht-echt", art:"grantig", haende:{ neu:"unbekannt" } } }]) }));
    await p2.addInitScript(() => localStorage.setItem("omoteno-willkommen","1"));
    await p2.addInitScript(() => sessionStorage.setItem("omoteno-willkommen","1"));
    await p2.goto("file://" + DIST);
    await p2.waitForTimeout(1900);
    const rueckfall = await p2.evaluate(() => ({
      figur: avatarFigur(), art: avatarArt(),
      neu: phasenDing ? phasenDing("neu") : null,
    }));
    pruef(rueckfall.figur === "untersetzer", "unbekannte Figur fällt auf Untersetzer zurück", rueckfall.figur);
    pruef(rueckfall.art === "freundlich", "unbekannte Stimmung fällt auf freundlich zurück", rueckfall.art);
    pruef(rueckfall.neu === "zettel", "unbekannte Requisite fällt auf die Phasenvorgabe zurück", rueckfall.neu);
    pruef(kons4.length === 0, "keine Ausnahme in der Konsole (unbekannter Wert)", kons4.join(" | ") || "still");
    await p2.close();
    await browser3.close();
  }

  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
