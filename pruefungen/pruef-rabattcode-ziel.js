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

   EHRLICHE GRENZE: Der Demo-Modus hat keine echte Datenbank — die
   eigentliche RPC-Logik (rabattcode_team_anlegen, rabattcode_beenden,
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
const path = require("path");

const ADMIN = path.join(__dirname, "..", "seiten", "admin.html");
let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

(async () => {
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

  pruef(await seite.isVisible("#rcGruppe"), "Gruppe „Eigene Rabattcodes“ sichtbar");
  const codeVorschlag = await seite.inputValue("#rcCode");
  pruef(/^AKTION-[A-Z0-9]{4}$/.test(codeVorschlag), "Code-Feld startet mit einem echten Vorschlag", codeVorschlag);

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

  console.log("\n══ Code wird beim Tippen bereinigt ══");
  await seite.fill("#rcCode", "äi 20%");
  const bereinigt = await seite.inputValue("#rcCode");
  pruef(bereinigt === "AEI-20", "Umlaut, Leerzeichen und Prozentzeichen werden bereinigt", bereinigt);

  console.log("\n══ Anlegen: ganze Rechnung, Prozent ══");
  const anzahlVorher = await seite.evaluate(() => rabattcodeTeam.length);
  await seite.fill("#rcCode", "PROBE-RECHNUNG");
  await seite.fill("#rcWert", "15");
  await seite.click("#rcAnlegen");
  await seite.waitForTimeout(300);
  const nachAnlegen1 = await seite.evaluate(() => ({
    laenge: rabattcodeTeam.length,
    eintrag: rabattcodeTeam.find(g => g.code === "PROBE-RECHNUNG"),
  }));
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

  console.log("\n══ Anlegen: bestimmtes Gericht, fester Betrag ══");
  await seite.click("[data-rc-art='betrag']");
  await seite.click("[data-rc-ziel='gericht']");
  await seite.waitForTimeout(150);
  const gerichtName = await seite.evaluate(() => {
    const sel = document.getElementById("rcGericht");
    sel.selectedIndex = 0;
    return sel.options[0]?.textContent.split(" — ")[0] || "";
  });
  await seite.fill("#rcCode", "PROBE-GERICHT");
  // input[type=number] nimmt nur den Punkt (Browser-Vorgabe) — die
  // Komma-Bereinigung im Code (rcWert.value.replace(",", ".")) fängt
  // Firefox/andere Locale-Eingaben ab, hier reicht der native Weg.
  await seite.fill("#rcWert", "2.50");
  await seite.click("#rcAnlegen");
  await seite.waitForTimeout(300);
  const nachAnlegen2 = await seite.evaluate(() =>
    rabattcodeTeam.find(g => g.code === "PROBE-GERICHT"));
  pruef(!!nachAnlegen2 && nachAnlegen2.betrag === 2.5 && nachAnlegen2.prozent === null,
    "fester Betrag korrekt übernommen (2.50 → 2.5)", JSON.stringify(nachAnlegen2));
  pruef(nachAnlegen2.ziel_gericht_name === gerichtName,
    "das gewählte Gericht wird als Ziel übernommen", nachAnlegen2.ziel_gericht_name + " / " + gerichtName);

  console.log("\n══ Validierung: nichts Falsches kommt durch ══");
  const vorFalsch = await seite.evaluate(() => rabattcodeTeam.length);
  await seite.click("[data-rc-art='prozent']");
  await seite.click("[data-rc-ziel='rechnung']");
  await seite.fill("#rcCode", "PROBE-ZUVIEL");
  await seite.fill("#rcWert", "150");
  await seite.click("#rcAnlegen");
  await seite.waitForTimeout(250);
  let meldung = (await seite.evaluate(() => document.getElementById("meldung")?.textContent || "")).trim();
  pruef(/prozent|betrag/i.test(meldung) && await seite.evaluate(() => rabattcodeTeam.length) === vorFalsch,
    "150 % wird abgewiesen, nichts angelegt", meldung);

  await seite.fill("#rcCode", "PROBE-RECHNUNG"); // Code, den es schon gibt
  await seite.fill("#rcWert", "10");
  await seite.click("#rcAnlegen");
  await seite.waitForTimeout(250);
  meldung = (await seite.evaluate(() => document.getElementById("meldung")?.textContent || "")).trim();
  pruef(/schon|vergeben/i.test(meldung) && await seite.evaluate(() => rabattcodeTeam.length) === vorFalsch,
    "ein doppelter Code wird ehrlich abgewiesen, nichts angelegt", meldung);

  console.log("\n══ Beenden ══");
  const vorBeenden = await seite.evaluate(() => rabattcodeTeam.length);
  await seite.click('.gs-zeile[data-rc] [data-rc-ende]');
  await seite.waitForTimeout(250);
  const nachBeenden = await seite.evaluate(() => rabattcodeTeam.length);
  pruef(nachBeenden === vorBeenden - 1, "„Beenden“ entfernt genau einen Eintrag aus dem Bestand", nachBeenden);

  pruef(konsole.length === 0, "keine Ausnahme in der Konsole", konsole.join(" | ") || "still");

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
