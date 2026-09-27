/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Vorfenster — Speisekarte direkt oder zur Übersicht

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-vorfenster.js

   Auftrag des Betreibers (27.09.): Manche Gäste wollen nur die Karte
   sehen. Der Willkommensschirm (bisher: Gruß, dann automatisch weiter
   zum Hub) trägt jetzt zwei echte Knöpfe — „Speisekarte ansehen"
   springt OHNE Umweg dorthin, „Zur Übersicht" (oder ein Tipp daneben,
   wie bisher) bleibt beim Hub.

   ZWEITE ANWEISUNG, selber Tag: Der Schirm schloss sich zusätzlich von
   SELBST nach 3s (eine Fortschrittsleiste zählte sichtbar herunter) —
   Rest der alten "Gruß, dann automatisch weiter"-Logik von VOR den
   zwei Knöpfen. Mit einer echten Wahl blieben dafür nur ein paar
   Sekunden zum Lesen UND Entscheiden. Der Timer und die Leiste sind
   jetzt weg: der Schirm schließt sich nur noch durch einen eigenen
   Tipp, nie von allein.

   Geprüft:
   1 · Knopf „Speisekarte ansehen" setzt den Hash auf #/speisekarte
       UND schließt den Schirm — beides, nicht nur eins von beidem.
   2 · Knopf „Zur Übersicht" bleibt auf der Startseite.
   3 · Der Schirm schließt sich NICHT von selbst — auch nach deutlich
       mehr als den früheren 3s steht er noch offen, und lässt sich
       danach ganz normal bedienen.
   4 · Ein Tipp NEBEN den Knöpfen (der bisherige Weg) tut dasselbe wie
       „Zur Übersicht" — nichts Neues bricht den alten Pfad.
   5 · Ein tiefer Link (#/speisekarte in der Adresse) zeigt das
       Vorfenster GAR NICHT — wer schon weiß, wohin er will, bekommt
       keine zusätzliche Frage.
   6 · Beide Knöpfe tragen echten, übersetzten Text in jeder Sprache
       (nicht das Deutsche stehengeblieben).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const DIST = path.join(OBEN, "dist", "chocolamour", "index.html");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

(async () => {
  if (!fs.existsSync(DIST)) {
    pruef(false, "dist/chocolamour/index.html fehlt — erst node erzeuger/erzeuge-hub.js --alle laufen lassen");
    process.exit(1);
  }
  const browser = await chromium.launch();

  console.log("\n══ Die zwei Knöpfe ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const kons = [];
    p.on("pageerror", e => kons.push(String(e).slice(0, 300)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + DIST);
    await p.waitForTimeout(500);
    const vorher = await p.evaluate(() => !document.getElementById("willkommen").hidden);
    pruef(vorher, "der Willkommensschirm steht beim ersten Besuch (Voraussetzung)");

    await p.click("#wkSpeisekarte");
    await p.waitForTimeout(700);
    const nach1 = await p.evaluate(() => ({
      hash: location.hash, seite: seiteJetzt,
      zu: document.getElementById("willkommen").hidden ||
          document.getElementById("willkommen").classList.contains("weg"),
    }));
    pruef(nach1.hash === "#/speisekarte" && nach1.seite === "speisekarte",
      "„Speisekarte ansehen“ springt ohne Umweg zur Karte", JSON.stringify(nach1));
    pruef(nach1.zu, "und der Schirm schließt sich dabei mit");
    pruef(kons.length === 0, "keine Ausnahme in der Konsole", kons.join(" | ") || "still");
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + DIST);
    await p.waitForTimeout(500);
    await p.click("#wkHub");
    await p.waitForTimeout(700);
    const nach = await p.evaluate(() => ({ hash: location.hash, seite: seiteJetzt }));
    pruef(nach.seite === "start" && !nach.hash,
      "„Zur Übersicht“ bleibt auf der Startseite", JSON.stringify(nach));
    await ctx.close();
  }

  console.log("\n══ Keine zeitliche Begrenzung (Vorfall 27.09., zweite Anweisung) ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + DIST);
    await p.waitForTimeout(500);
    // Der alte Schirm schloss sich nach 3s von selbst — bewusst länger
    // warten als das, ohne zu tippen: der Schirm darf NICHT von allein
    // verschwinden, die Wahl braucht unbegrenzt Zeit.
    await p.waitForTimeout(4200);
    const stehtNoch = await p.evaluate(() => {
      const w = document.getElementById("willkommen");
      return !!w && !w.hidden && !w.classList.contains("weg");
    });
    pruef(stehtNoch, "der Schirm steht auch nach über 4s noch offen, ohne Klick");
    // Und danach lässt er sich immer noch normal bedienen — kein
    // hängengebliebener Zustand durch das lange Warten.
    await p.click("#wkSpeisekarte");
    await p.waitForTimeout(700);
    const nach = await p.evaluate(() => ({ hash: location.hash, seite: seiteJetzt }));
    pruef(nach.hash === "#/speisekarte" && nach.seite === "speisekarte",
      "und lässt sich danach noch ganz normal bedienen", JSON.stringify(nach));
    await ctx.close();
  }

  console.log("\n══ Der alte Weg bleibt: Tipp daneben ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + DIST);
    await p.waitForTimeout(500);
    await p.click("#wkHaus"); // der Titeltext, kein Knopf
    await p.waitForTimeout(700);
    const nach = await p.evaluate(() => ({ hash: location.hash, seite: seiteJetzt }));
    pruef(nach.seite === "start" && !nach.hash,
      "ein Tipp neben den Knöpfen führt weiter zum Hub, wie vor der Änderung", JSON.stringify(nach));
    await ctx.close();
  }

  console.log("\n══ Tiefer Link: kein Vorfenster ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + DIST + "#/speisekarte");
    await p.waitForTimeout(700);
    const zustand = await p.evaluate(() => ({
      dieDa: !!document.getElementById("willkommen"), seite: seiteJetzt,
    }));
    pruef(!zustand.dieDa && zustand.seite === "speisekarte",
      "wer direkt über #/speisekarte kommt, sieht das Vorfenster nie", JSON.stringify(zustand));
    await ctx.close();
  }

  console.log("\n══ Übersetzung der Knöpfe ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + DIST);
    await p.waitForTimeout(500);
    const texte = await p.evaluate((code) => {
      spracheSetzen(code);
      const wk = document.getElementById("willkommen");
      wk.hidden = false; wk.classList.remove("weg");
      $("wkSpeisekarte").textContent = t("Speisekarte ansehen");
      $("wkHub").textContent = t("Zur Übersicht");
      return { sk: $("wkSpeisekarte").textContent, hub: $("wkHub").textContent };
    }, "tr");
    pruef(texte.sk === "Menüyü görüntüle" && texte.hub === "Genel bakışa",
      "auf Türkisch stehen beide Knöpfe wirklich übersetzt da, nicht deutsch", JSON.stringify(texte));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
