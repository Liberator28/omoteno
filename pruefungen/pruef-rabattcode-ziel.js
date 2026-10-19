/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Eigene Rabattcodes — Prozent/Betrag, ganze Rechnung/Gericht

     node pruefungen/pruef-rabattcode-ziel.js

   Auftrag des Betreibers (27.09., „das hatte ich dir schon einmal
   gesagt"): Beim Anlegen eines Rabattcodes soll wählbar sein, ob er
   prozentual oder als fester Betrag wirkt — und ob er beim Einlösen
   im Board die GANZE Rechnung oder nur ein VORHER gewähltes Gericht
   trifft. Neue Gruppe „Eigene Rabattcodes" in den Einstellungen
   (#rcGruppe), getrennt vom Klaviyo-Newsletter-Vorrat (CLAUDE.md
   §1.1a — ein passender Name ist kein Beweis: „Rabattcode-Vorrat"
   zählt automatisch vergebene Codes, von Hand angelegte hätten die
   Zahl dort verfälscht).

   Seit migration-gutschein-sicher.sql: kein selbst gewählter Code mehr
   (nur eine Vorsilbe), PIN je Ausstellung im eigenen Blatt #apBlatt,
   den Code vergibt der Server (rabattcode_ausstellen).

   EHRLICHE GRENZE: Der Demo-Modus hat keine echte Datenbank — die
   eigentliche RPC-Logik (rabattcode_ausstellen, rabattcode_beenden,
   das zielbewusste und gedeckelte rechnung_rabattieren, und der GRANT-
   Fund: authenticated durfte bislang direkt auf rabattcodes schreiben)
   ist in datenbank/pruef-rechte.sql TEIL 3 und TEIL 3b gegen echtes
   Postgres geprüft. Diese Prüfung hier deckt, was sich im Browser
   prüfen lässt: die Segmente, die Code-Bereinigung, die Gerichtauswahl,
   die Formularvalidierung, das Anlegen/Beenden im Demo-Modus und die
   Darstellung in der Liste.

   Gegenbeweis (CLAUDE.md §8.1k, git worktree): siehe Bericht.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const path = require("path");

const ADMIN = path.join(__dirname, "..", "seiten", "admin.html");
let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

(async () => {
  /* PIN-Blatt bedienen: muss offen sein (Voraussetzung, §8.1g C). */
  async function pinEingeben(pin){
    await seite.waitForSelector("#apBlatt:not([hidden])", { timeout: 2000 }).catch(() => {});
    const offen = await seite.isVisible("#apBlatt");
    pruef(offen, "PIN-Blatt geht auf, bevor etwas angelegt wird");
    if(!offen) return;
    await seite.fill("#apPin", pin);
    await seite.click("#apOk");
    await seite.waitForTimeout(350);
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const seite = await ctx.newPage();
  const konsole = [];
  seite.on("pageerror", e => konsole.push(String(e).slice(0, 300)));
  seite.on("dialog", d => d.accept());
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

  console.log("\n══ Aufruf, Vorschlag, Grundzustand ══");
  await seite.evaluate(() => document.querySelector('[data-tafel="einstellungen"]').click());
  await seite.waitForTimeout(400);
  pruef(await gruppeZu(seite, "#rcGruppe"), "Voraussetzung: Unterseite Rabattcodes über ihre Kachel geöffnet");

  pruef(await seite.isVisible("#rcGruppe"), "Gruppe „Eigene Rabattcodes“ sichtbar");
  pruef(!(await seite.$("#rcCode")), "kein Feld für einen selbst gewählten Code mehr");
  pruef(await seite.inputValue("#rcPraefix") === "", "Vorsilbe startet leer (freiwillig)");

  pruef(await seite.getAttribute("[data-rc-art='prozent']", "aria-checked") === "true",
    "Art-Segment startet auf „Prozent“");
  pruef((await seite.textContent("#rcWertLabel")).trim() === "Prozent", "Wertlabel zeigt „Prozent“");
  pruef(await seite.getAttribute("[data-rc-ziel='rechnung']", "aria-checked") === "true",
    "Ziel-Segment startet auf „Ganze Rechnung“");
  pruef(await seite.getAttribute("#rcGerichtFeld", "hidden") !== null, "Gericht-Auswahl anfangs versteckt");

  console.log("\n══ Segmente wirklich umschalten ══");
  await seite.click("[data-rc-art='betrag']");
  await seite.waitForTimeout(150);
  pruef(await seite.getAttribute("[data-rc-art='betrag']", "aria-checked") === "true",
    "Klick auf „Fester Betrag“ schaltet das Segment um");
  pruef((await seite.textContent("#rcWertLabel")).trim() === "Betrag in Euro",
    "Wertlabel wechselt auf „Betrag in Euro“");
  await seite.click("[data-rc-art='prozent']");
  await seite.waitForTimeout(150);

  await seite.click("[data-rc-ziel='gericht']");
  await seite.waitForTimeout(150);
  pruef(await seite.getAttribute("#rcGerichtFeld", "hidden") === null,
    "Klick auf „Ein Gericht“ zeigt die Gerichtauswahl");
  const anzahlGerichte = await seite.evaluate(() => document.getElementById("rcGericht").options.length);
  pruef(anzahlGerichte > 0, "Gerichtauswahl ist gefüllt (dieselbe Liste wie die Speisekarte)", anzahlGerichte);
  await seite.click("[data-rc-ziel='rechnung']");
  await seite.waitForTimeout(150);
  pruef(await seite.getAttribute("#rcGerichtFeld", "hidden") !== null,
    "zurück auf „Ganze Rechnung“ versteckt die Gerichtauswahl wieder");

  console.log("\n══ Vorsilbe wird beim Tippen bereinigt ══");
  await seite.fill("#rcPraefix", "");
  await seite.type("#rcPraefix", "äi 20%-x");
  const bereinigt = await seite.inputValue("#rcPraefix");
  pruef(bereinigt === "AEI20X", "Umlaut, Leerzeichen, Bindestrich und Prozentzeichen raus, groß", bereinigt);
  await seite.fill("#rcPraefix", "");
  await seite.type("#rcPraefix", "SOMMERFEST");
  pruef((await seite.inputValue("#rcPraefix")).length === 8, "höchstens 8 Zeichen", await seite.inputValue("#rcPraefix"));

  console.log("\n══ Anlegen: ganze Rechnung, Prozent ══");
  const anzahlVorher = await seite.evaluate(() => rabattcodeTeam.length);
  await seite.fill("#rcPraefix", "PROBE");
  await seite.fill("#rcWert", "15");
  await seite.click("#rcAnlegen");
  await seite.waitForTimeout(200);
  pruef(await seite.evaluate(() => rabattcodeTeam.length) === anzahlVorher, "vor der PIN ist nichts angelegt");
  await pinEingeben("12345678");
  const nachAnlegen1 = await seite.evaluate(() => ({
    laenge: rabattcodeTeam.length,
    eintrag: rabattcodeTeam[0],
  }));
  pruef(/^PROBE-[A-HJ-NP-Z2-9]{10}$/.test(nachAnlegen1.eintrag && nachAnlegen1.eintrag.code),
    "Code = Vorsilbe + 10 Zeichen ohne 0/O/1/I", nachAnlegen1.eintrag && nachAnlegen1.eintrag.code);
  pruef((await seite.evaluate(() => document.getElementById("meldung")?.textContent || "")).includes(nachAnlegen1.eintrag.code),
    "die Meldung nennt den neuen Code");
  pruef(nachAnlegen1.laenge === anzahlVorher + 1, "ein neuer Eintrag im Demo-Bestand", nachAnlegen1.laenge);
  pruef(!!nachAnlegen1.eintrag && nachAnlegen1.eintrag.prozent === 15 && nachAnlegen1.eintrag.betrag === null,
    "Prozent gesetzt, Betrag leer", JSON.stringify(nachAnlegen1.eintrag));
  pruef(nachAnlegen1.eintrag.ziel_gericht_name === null, "kein Ziel-Gericht — gilt der ganzen Rechnung");

  const zeileText = await seite.evaluate(() => {
    const z = document.querySelector('.gs-zeile[data-rc]');
    return z ? z.textContent : "";
  });
  pruef(zeileText.includes("15") && zeileText.includes("%") && zeileText.includes("Ganze Rechnung"),
    "die Liste zeigt Prozent und „Ganze Rechnung“", zeileText.trim());
  pruef(await seite.isVisible('.gs-zeile[data-rc] [data-rc-ende]'), "„Beenden“-Knopf steht an der Zeile");
  pruef(zeileText.includes("ausgestellt von"), "die Liste nennt, wer ausgestellt hat", zeileText.trim());

  console.log("\n══ Anlegen: bestimmtes Gericht, fester Betrag ══");
  await seite.click("[data-rc-art='betrag']");
  await seite.click("[data-rc-ziel='gericht']");
  await seite.waitForTimeout(150);
  const gerichtName = await seite.evaluate(() => {
    const sel = document.getElementById("rcGericht");
    sel.selectedIndex = 0;
    return sel.options[0]?.textContent.split(" — ")[0] || "";
  });
  await seite.fill("#rcPraefix", "");
  // input[type=number] nimmt nur den Punkt (Browser-Vorgabe) — die
  // Komma-Bereinigung im Code (rcWert.value.replace(",", ".")) fängt
  // Firefox/andere Locale-Eingaben ab, hier reicht der native Weg.
  await seite.fill("#rcWert", "2.50");
  await seite.click("#rcAnlegen");
  await pinEingeben("12345678");
  const nachAnlegen2 = await seite.evaluate(() => rabattcodeTeam[0]);
  pruef(/^[A-HJ-NP-Z2-9]{10}$/.test(nachAnlegen2 && nachAnlegen2.code), "ohne Vorsilbe: nur die 10 Zeichen", nachAnlegen2 && nachAnlegen2.code);
  pruef(!!nachAnlegen2 && nachAnlegen2.betrag === 2.5 && nachAnlegen2.prozent === null,
    "fester Betrag korrekt übernommen (2.50 → 2.5)", JSON.stringify(nachAnlegen2));
  pruef(nachAnlegen2.ziel_gericht_name === gerichtName,
    "das gewählte Gericht wird als Ziel übernommen", nachAnlegen2.ziel_gericht_name + " / " + gerichtName);

  console.log("\n══ Validierung: nichts Falsches kommt durch ══");
  const vorFalsch = await seite.evaluate(() => rabattcodeTeam.length);
  await seite.click("[data-rc-art='prozent']");
  await seite.click("[data-rc-ziel='rechnung']");
  await seite.fill("#rcWert", "150");
  await seite.click("#rcAnlegen");
  await seite.waitForTimeout(250);
  let meldung = (await seite.evaluate(() => document.getElementById("meldung")?.textContent || "")).trim();
  pruef(/prozent|betrag/i.test(meldung) && await seite.evaluate(() => rabattcodeTeam.length) === vorFalsch,
    "150 % wird abgewiesen, nichts angelegt", meldung);

  pruef(!(await seite.isVisible("#apBlatt")), "bei falschem Wert wird gar nicht erst nach der PIN gefragt");

  /* Abbrechen im PIN-Blatt legt nichts an. */
  await seite.fill("#rcWert", "10");
  await seite.click("#rcAnlegen");
  await seite.waitForSelector("#apBlatt:not([hidden])", { timeout: 2000 }).catch(() => {});
  pruef(await seite.isVisible("#apBlatt"), "Voraussetzung: PIN-Blatt offen");
  await seite.click("#apWeg");
  await seite.waitForTimeout(400);
  pruef(await seite.evaluate(() => rabattcodeTeam.length) === vorFalsch && !(await seite.isVisible("#apBlatt")),
    "„Abbrechen“ im PIN-Blatt legt nichts an und schließt");
  pruef(await seite.evaluate(() => !document.getElementById("rcAnlegen").disabled), "Knopf danach wieder bedienbar");
  /* Keine 8 Ziffern: das Blatt bleibt und sagt warum. */
  await seite.click("#rcAnlegen");
  await seite.waitForSelector("#apBlatt:not([hidden])", { timeout: 2000 }).catch(() => {});
  await seite.fill("#apPin", "1234");
  await seite.click("#apOk");
  await seite.waitForTimeout(250);
  pruef(await seite.isVisible("#apBlatt") && /acht Ziffern/.test(await seite.textContent("#apMeldung")),
    "vier Ziffern: Blatt bleibt offen, Satz „acht Ziffern“", await seite.textContent("#apMeldung"));
  await seite.click("#apWeg");
  await seite.waitForTimeout(400);

  console.log("\n══ Beenden ══");
  const vorBeenden = await seite.evaluate(() => rabattcodeTeam.length);
  await seite.click('.gs-zeile[data-rc] [data-rc-ende]');
  await seite.waitForTimeout(250);
  const nachBeenden = await seite.evaluate(() => rabattcodeTeam.length);
  pruef(nachBeenden === vorBeenden - 1, "„Beenden“ entfernt genau einen Eintrag aus dem Bestand", nachBeenden);

  console.log("\n══ Echter Weg: gestelltes db, PIN festlegen, falsche PIN, Grenze ══");
  const rpc = await seite.evaluate(async () => {
    const log = [];
    let antworten = [], hatPin = false;
    const altDb = db, altDemo = demo, altBetrieb = betriebId;
    betriebId = betriebId || "b-probe";      /* wie nach echter Anmeldung */
    db = {
      rpc: (name, args) => {
        log.push([name, JSON.parse(JSON.stringify(args || {}))]);
        if(name === "gutschein_recht") return Promise.resolve({ data: { ok:true, inhaber:true, pin:hatPin }, error:null });
        if(name === "pin_erstmals_setzen"){ hatPin = true; return Promise.resolve({ data: { ok:true }, error:null }); }
        if(name === "rabattcode_ausstellen") return Promise.resolve({ data: antworten.shift() || { ok:false }, error:null });
        return Promise.resolve({ data: null, error: null });
      },
      from: () => { const k = new Proxy(function(){}, { get(_, p){ if(p === "then") return r => r({ data: [], error: null }); return () => k; } }); return k; }
    };
    demo = false; grRecht = null; grFuer = null;
    window.__rcLog = log;
    window.__rcAntworten = a => { antworten = a; };
    window.__rcZurueck = () => { db = altDb; demo = altDemo; betriebId = altBetrieb; grRecht = null; grFuer = null; };
    return true;
  });
  await seite.evaluate(() => window.__rcAntworten([{ ok:false, grund:"pin_falsch" }, { ok:true, code:"SOMMER-ABCDEFGHJK", id:"x" }]));
  await seite.click("[data-rc-art='prozent']");
  await seite.click("[data-rc-ziel='rechnung']");
  await seite.fill("#rcPraefix", "sommer");
  await seite.fill("#rcWert", "10");
  await seite.click("#rcAnlegen");
  await seite.waitForSelector("#apBlatt:not([hidden])", { timeout: 2000 }).catch(() => {});
  pruef((await seite.textContent("#apTitel")).includes("festlegen") && await seite.isVisible("#apPin2"),
    "Konto ohne PIN: Blatt fragt gleich „PIN festlegen“ mit zweitem Feld");
  await seite.fill("#apPin", "40918273"); await seite.fill("#apPin2", "40918274");
  await seite.click("#apOk"); await seite.waitForTimeout(250);
  pruef(/nicht gleich/.test(await seite.textContent("#apMeldung")), "zwei verschiedene Eingaben: Satz, nichts gesetzt");
  await seite.fill("#apPin2", "40918273");
  await seite.click("#apOk"); await seite.waitForTimeout(400);
  pruef(await seite.isVisible("#apBlatt") && /stimmt nicht/.test(await seite.textContent("#apHilfe")),
    "Server sagt pin_falsch → Blatt kommt wieder mit Satz", await seite.textContent("#apHilfe"));
  await seite.fill("#apPin", "40918273");
  await seite.click("#apOk"); await seite.waitForTimeout(500);
  const log = await seite.evaluate(() => window.__rcLog);
  const setz = log.find(x => x[0] === "pin_erstmals_setzen");
  const aus = log.filter(x => x[0] === "rabattcode_ausstellen");
  pruef(!!setz && setz[1].p_pin === "40918273", "pin_erstmals_setzen mit der gewählten PIN gerufen");
  pruef(aus.length === 2, "rabattcode_ausstellen zweimal (falsche PIN, dann richtig)", aus.length);
  const a1 = aus[aus.length - 1] && aus[aus.length - 1][1];
  pruef(a1 && a1.p_pin === "40918273" && a1.p_praefix === "SOMMER" && a1.p_prozent === 10 && a1.p_betrag === null,
    "Nutzlast: PIN, Vorsilbe groß, Prozent, kein Betrag", JSON.stringify(a1));
  pruef(a1 && !("p_code" in a1), "kein selbst gewählter Code in der Nutzlast");
  pruef(!log.some(x => x[0] === "rabattcode_team_anlegen"), "der alte Weg ohne PIN wird nicht mehr gerufen");
  pruef((await seite.evaluate(() => document.getElementById("meldung")?.textContent || "")).includes("SOMMER-ABCDEFGHJK"),
    "Meldung nennt den Code vom Server");

  await seite.evaluate(() => window.__rcAntworten([{ ok:false, grund:"ueber_grenze", grenze: 20 }]));
  await seite.fill("#rcWert", "25");
  await seite.click("#rcAnlegen");
  await seite.waitForSelector("#apBlatt:not([hidden])", { timeout: 2000 }).catch(() => {});
  await seite.fill("#apPin", "40918273");
  await seite.click("#apOk"); await seite.waitForTimeout(400);
  meldung = (await seite.evaluate(() => document.getElementById("meldung")?.textContent || "")).trim();
  pruef(/über Ihrer Grenze \(20 %\)/.test(meldung), "Grenze des Servers als Satz mit Einheit", meldung);
  await seite.evaluate(() => window.__rcZurueck());

  pruef(konsole.length === 0, "keine Ausnahme in der Konsole", konsole.join(" | ") || "still");

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
