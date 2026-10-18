/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Rabattcode-Einlösung auf der Bestellkarte, Newsletter-Bedienfläche

     node pruefungen/pruef-rabatt-board.js

   Auftrag: Ein Rabattcode aus dem Klaviyo-Newsletter soll im Admin-
   Board gegen eine offene Bestellung eingelöst werden können — auf
   der BESTEHENDEN Bestellkarte, nicht in einem neuen Reiter
   "Rechnungen" (den Namen trägt in diesem Projekt schon Omotenos
   eigene SaaS-Abrechnung an den Betrieb, seiten/konto.html — ein
   zweites "Rechnungen" hätte die Verwechslung aus CLAUDE.md §1.1a
   erzeugt). Dazu ein Newsletter-Schalter und ein "Vorrat
   auffüllen"-Knopf in den Einstellungen.

   EHRLICHE GRENZE: Der Demo-Modus hat keine echte Datenbank — die
   eigentliche RPC-Logik (rechnung_rabattieren, unbekannt/abgelaufen/
   bereits eingelöst/kein Zugriff) ist stattdessen in
   datenbank/pruef-rechte.sql, Teil 3, gegen echtes Postgres geprüft
   (fünf Fälle, mit Gegenbeweis). Diese Prüfung hier deckt nur, was
   sich im Browser prüfen lässt: dass die Bedienelemente da sind, das
   Eingabefeld sich richtig auf-/zuklappt, und dass ein Klick im
   Demo-Modus ehrlich "nicht verfügbar" sagt statt so zu tun, als sei
   etwas passiert.

   Gegenbeweis gefahren: die Auf-/Zuklapp-Logik in
   $("#karten").onclick testweise entfernt (der if(feld)-Block wurde
   leer geräumt) → "nach Klick: Eingabefeld sichtbar" und "hat
   wirklich display != none" wurden rot. Zurückgenommen → grün.
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

  console.log("\n══ Rabatt-Einlösung auf Bestellkarte ══");
  await seite.evaluate(() => document.querySelector('[data-tafel="bestellungen"]').click());
  await seite.waitForTimeout(400);

  const hatKarte = await seite.evaluate(() => !!document.querySelector(".bestellung"));
  pruef(hatKarte, "mindestens eine Bestellkarte im Demo-Modus sichtbar");

  if (hatKarte) {
    pruef(await seite.isVisible(".rabattoeffnen"), "„Rabattcode einlösen“-Link sichtbar");

    const versteckt1 = await seite.evaluate(() =>
      document.querySelector(".rabatteingabe")?.hasAttribute("hidden") ?? null);
    pruef(versteckt1 === true, "Eingabefeld ist anfangs versteckt (hidden-Attribut)");

    await seite.click(".rabattoeffnen");
    await seite.waitForTimeout(150);
    const versteckt2 = await seite.evaluate(() =>
      document.querySelector(".rabatteingabe")?.hasAttribute("hidden") ?? null);
    pruef(versteckt2 === false, "nach Klick: Eingabefeld sichtbar (hidden entfernt)");

    const displayNachKlick = await seite.evaluate(() =>
      getComputedStyle(document.querySelector(".rabatteingabe")).display);
    pruef(displayNachKlick !== "none", "sichtbares Feld hat wirklich display != none", displayNachKlick);

    await seite.click(".rabattoeffnen");
    await seite.waitForTimeout(150);
    const versteckt3 = await seite.evaluate(() =>
      document.querySelector(".rabatteingabe")?.hasAttribute("hidden") ?? null);
    pruef(versteckt3 === true, "zweiter Klick schließt das Feld wieder");

    await seite.click(".rabattoeffnen");
    await seite.waitForTimeout(150);
    await seite.fill(".rabattfeld", "TEST-CODE");
    await seite.click("[data-rabatteinloesen]");
    await seite.waitForTimeout(300);
    const meldung = await seite.evaluate(() => document.getElementById("meldung")?.textContent || "");
    pruef(/nicht verfügbar/i.test(meldung), "Demo-Modus meldet ehrlich statt zu behaupten", meldung.trim());
  }

  console.log("\n══ Newsletter-Bereich in Einstellungen ══");
  await seite.evaluate(() => document.querySelector('[data-tafel="einstellungen"]').click());
  await seite.waitForTimeout(300);
  pruef(await euZu(seite, "#nlAn"), "Voraussetzung: Unterseite Newsletter über ihre Kachel geöffnet");
  pruef(await seite.isVisible("#nlAn"), "Newsletter-Schalter sichtbar in Einstellungen");
  pruef(await seite.isVisible("#nlVorratAuffuellen"), "„Vorrat auffüllen“-Knopf sichtbar");

  const vorPressed = await seite.getAttribute("#nlAn", "aria-pressed");
  await seite.click("#nlAn");
  await seite.waitForTimeout(200);
  const nachPressed = await seite.getAttribute("#nlAn", "aria-pressed");
  pruef(vorPressed !== nachPressed, "Schalter reagiert auf Klick (aria-pressed wechselt)",
    vorPressed + " -> " + nachPressed);

  pruef(konsole.length === 0, "keine Ausnahme in der Konsole", konsole.join(" | ") || "still");

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
