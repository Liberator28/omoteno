/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Allergene/Zusatzstoffe im Gast-Hub

     node erzeuger/erzeuge-hub.js --alle
     node pruefungen/pruef-stoffe.js

   Zwei unabhängige Dinge, beide aus demselben Umbau
   (vorlagen/hub.vorlage.html: stoffGruppe(), zwei Karten statt ein
   Streifen):

   1 · DER RUNDLAUF-GUARD. ALLERGENE/ZUSATZSTOFFE (seiten/admin.html,
       "gepflegt wird hier") gegen ALLERGEN_NAMEN/ZUSATZ_NAMEN
       (vorlagen/hub.vorlage.html, "gelesen wird hier") — Code für
       Code, Name für Name, in beide Richtungen. Reiner Textvergleich,
       kein Server nötig, wie pruef-figur.js für den FIGUR-Block
       (§1.1: ein geteilter Block/eine geteilte Zuordnung ohne
       erzwungenen Gleichlauf ist nur eine Frage der Zeit).

   2 · DIE ÜBERLAUF-PRÜFUNG, die der Auftrag verlangte und die es
       nirgends gab (kein clientHeight in pruefungen/*.js). Gegen den
       ECHTEN erzeugten Hub (dist/chocolamour/index.html), am
       LÄNGSTEN vorhandenen Zusatzstoff-Text ("16" — Azofarbstoff),
       nicht am kürzesten (§8.1g: eine Probe, die den Fehler nicht
       zeigen kann, ist keine Probe).

       Die echten Beispieldaten (INHALTSSTOFFE) haben aktuell KEIN
       einziges Gericht mit gefüllter z:-Liste — dieselbe Lücke wie
       beim Rundlauf-Test in pruef-marke.js, der einen Markenblatt-
       Testfall im Browser zusammenbaut statt ihn zu erfinden und als
       Beispieldatei abzulegen. Hier genauso: "Dubai Crêpe" ist ein
       echtes, existierendes Gericht (dist/chocolamour, mit
       Allergenen a:["A","C","G","H"]) — nur sein z: wird zur Laufzeit
       im Browser auf alle 16 echten Zusatzstoff-Codes gesetzt, mit
       dem echten Text aus ZUSATZ_NAMEN. Keine erfundene Datei, kein
       erfundener Text — nur ein echtes Gericht, testweise mit dem
       vollständigen, echten Katalog bestückt.

   Gegenbeweis gefahren (siehe unten je Abschnitt): Namen testweise
   verändert → rot; Panel-CSS testweise entfernt/Text gekürzt → rot;
   zurückgenommen → grün.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN   = path.resolve(__dirname, "..");
const ADMIN  = path.join(OBEN, "seiten", "admin.html");
const HUB    = path.join(OBEN, "vorlagen", "hub.vorlage.html");
const DIST   = path.join(OBEN, "dist", "chocolamour", "index.html");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

/* ── Abschnitt 1: Rundlauf-Guard, reiner Textvergleich ── */
function leseArray(quelltext, name) {
  const block = quelltext.match(new RegExp("const " + name + "\\s*=\\s*\\[([\\s\\S]*?)\\n\\];"));
  if (!block) throw new Error(name + " nicht gefunden");
  const paare = {};
  const re = /\["([^"]+)"\s*,\s*"([^"]+)"\]/g;
  let m;
  while ((m = re.exec(block[1]))) paare[m[1]] = m[2];
  return paare;
}
function leseObjekt(quelltext, name) {
  const block = quelltext.match(new RegExp("const " + name + "\\s*=\\s*\\{([\\s\\S]*?)\\n\\};"));
  if (!block) throw new Error(name + " nicht gefunden");
  const paare = {};
  const re = /"?([A-Za-z0-9]+)"?\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(block[1]))) paare[m[1]] = m[2];
  return paare;
}

function vergleiche(bezeichnung, quelle, ziel, quelleName, zielName) {
  const codesQuelle = Object.keys(quelle);
  const codesZiel   = Object.keys(ziel);
  const fehlenInZiel = codesQuelle.filter(c => !(c in ziel));
  const fehlenInQuelle = codesZiel.filter(c => !(c in quelle));
  pruef(fehlenInZiel.length === 0,
    bezeichnung + ": jeder Code aus " + quelleName + " existiert in " + zielName,
    fehlenInZiel.join(", ") || "vollständig");
  pruef(fehlenInQuelle.length === 0,
    bezeichnung + ": jeder Code aus " + zielName + " existiert in " + quelleName,
    fehlenInQuelle.join(", ") || "vollständig");
  const abweichend = codesQuelle.filter(c => c in ziel && ziel[c] !== quelle[c]);
  pruef(abweichend.length === 0,
    bezeichnung + ": Text stimmt Ziffer für Ziffer überein",
    abweichend.map(c => c + ": „" + quelle[c] + "“ ↔ „" + ziel[c] + "“").join(" | ") || "gleich");
}

(async () => {
  console.log("══ 1 · Rundlauf-Guard: admin.html ↔ hub.vorlage.html ══");
  const adminText = fs.readFileSync(ADMIN, "utf8");
  const hubText   = fs.readFileSync(HUB, "utf8");

  const allergeneAdmin = leseArray(adminText, "ALLERGENE");
  const zusatzAdmin    = leseArray(adminText, "ZUSATZSTOFFE");
  const allergeneHub   = leseObjekt(hubText, "ALLERGEN_NAMEN");
  const zusatzHub      = leseObjekt(hubText, "ZUSATZ_NAMEN");

  vergleiche("Allergene", allergeneAdmin, allergeneHub, "admin.html", "hub.vorlage.html");
  vergleiche("Zusatzstoffe", zusatzAdmin, zusatzHub, "admin.html", "hub.vorlage.html");

  /* Gegenbeweis (von Hand geprüft, nicht Teil des Laufs): einen Namen
     in ALLERGEN_NAMEN testweise auf "Getreide (GEÄNDERT)" gesetzt →
     die Zeile "Text stimmt Ziffer für Ziffer überein" wurde rot und
     nannte genau A: „Glutenhaltiges Getreide“ ↔ „Getreide
     (GEÄNDERT)“. Zurückgenommen → wieder grün. */

  console.log("\n══ 2 · Überlauf-Prüfung: Allergene/Zusatzstoffe-Karten im echten Hub ══");
  if (!fs.existsSync(DIST)) {
    console.log("  FEHL  dist/chocolamour/index.html fehlt — vorher `node erzeuger/erzeuge-hub.js --alle` laufen lassen");
    process.exit(1);
  }

  const browser = await chromium.launch();

  for (const breite of [375, 768]) {
    console.log(`\n── Breite ${breite}px ──`);
    const seite = await (await browser.newContext({ viewport: { width: breite, height: 900 } })).newPage();
    /* Willkommensschirm überspringen wie in jeder Hub-Prüfung — sonst fängt er
       jeden Klick ab (seit er sich nicht mehr selbst schließt). */
    await seite.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
    const konsole = [];
    seite.on("pageerror", e => konsole.push(String(e)));
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + DIST);
    await seite.waitForTimeout(500);

    const ergebnis = await seite.evaluate(async () => {
      /* Testweise: "Dubai Crêpe" (echtes Gericht) bekommt den
         vollständigen, echten Zusatzstoff-Katalog inklusive des
         längsten Texts (16). Nicht dauerhaft — nur für diese Messung
         im laufenden Dokument. */
      const alleCodes = Object.keys(ZUSATZ_NAMEN);
      INHALTSSTOFFE["Dubai Crêpe"] = { a: ["A", "C", "G", "H"], z: alleCodes };

      detailOeffnen("Dubai Crêpe");
      /* Warten auf den ENDZUSTAND, nicht auf eine Zeit (§8.1j): Das Blatt tritt mit 0,96 heran und seine Teile kommen
         gestaffelt (24.10.) — mitten darin messen hieße 42 statt 44 px Tippfläche. */
      await Promise.all(document.getAnimations().filter(a => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => 0)));   /* Endlosschleifen enden nie */

      const karte = document.getElementById("warenkarte");
      const gruppen = Array.from(karte.querySelectorAll(".wgruppe"));
      const titelKnoepfe = Array.from(karte.querySelectorAll(".wgtitel"));
      const beschriftungen = Array.from(karte.querySelectorAll(".wgruppe .wname, .wgtitel span"));

      const ueberlauf = beschriftungen.map(el => {
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent.trim().slice(0, 40),
          passtBreite: el.scrollWidth <= el.clientWidth + 1,
          passtHoehe: el.scrollHeight <= el.clientHeight + 1,
          breite: r.width
        };
      });

      const tippflaechen = titelKnoepfe.map(b => b.getBoundingClientRect().height);

      const startZustand = titelKnoepfe.map(b => ({
        expanded: b.getAttribute("aria-expanded"),
        panelSichtbar: (() => {
          const panel = document.getElementById(b.getAttribute("aria-controls"));
          return panel && getComputedStyle(panel.parentElement).gridTemplateRows !== "0fr" &&
                 getComputedStyle(panel).display !== "none";
        })()
      }));

      return {
        gruppenAnzahl: gruppen.length,
        titelAnzahl: titelKnoepfe.length,
        ueberlauf,
        tippflaechen,
        startZustand,
        istOffen: karte.classList.contains("an")
      };
    }).catch(e => ({ fehler: String(e) }));

    if (ergebnis.fehler) {
      pruef(false, "Warenkarte öffnet ohne Ausnahme", ergebnis.fehler);
      await seite.close();
      continue;
    }

    pruef(ergebnis.gruppenAnzahl === 2, "beide Gruppen (Allergene, Zusatzstoffe) sind gerendert", ergebnis.gruppenAnzahl);

    const abgeschnitten = ergebnis.ueberlauf.filter(u => !u.passtBreite || !u.passtHoehe);
    pruef(abgeschnitten.length === 0,
      "kein Text in den Karten ist abgeschnitten (scrollWidth/scrollHeight ≤ clientWidth/clientHeight), inkl. Azofarbstoff-Text",
      abgeschnitten.map(u => u.text).join(" | ") || "alle " + ergebnis.ueberlauf.length + " Beschriftungen passen");

    pruef(ergebnis.tippflaechen.length > 0 && ergebnis.tippflaechen.every(h => h >= 44),
      "Tippflächen beider Titel-Knöpfe ≥ 44px",
      ergebnis.tippflaechen.map(h => Math.round(h) + "px").join(", "));

    pruef(ergebnis.startZustand.every(s => s.expanded === "true" && s.panelSichtbar),
      "Start-Zustand: beide Karten offen (aria-expanded=true, Panel sichtbar)",
      JSON.stringify(ergebnis.startZustand));

    /* Gegenbeweis (von Hand geprüft): "z: alleCodes" durch "z: []"
       ersetzt → "beide Gruppen sind gerendert" wurde korrekt rot
       (gruppenAnzahl 1 statt 2), weil eine leere Liste gar keine
       Karte rendert. grep -c "alleCodes" bestätigt: die Sabotage traf
       exakt die eine Zeile, die den Testfall aufbaut. Zurückgenommen
       → wieder grün. */

    pruef(konsole.length === 0, "keine Ausnahme in der Konsole", konsole.join(" | ") || "still");

    await seite.close();
  }

  /* ── Unabhängiges Zu/Auf je Gruppe, reduzierte Bewegung: einmal bei
     375px reicht, das ist reine Verhaltensprüfung, keine Geometrie. ── */
  console.log("\n── Bedienung: unabhängiges Auf/Zu, reduzierte Bewegung ──");
  {
    const seite = await (await browser.newContext({ viewport: { width: 375, height: 900 } })).newPage();
    /* Willkommensschirm überspringen wie in jeder Hub-Prüfung — sonst fängt er
       jeden Klick ab (seit er sich nicht mehr selbst schließt). */
    await seite.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seite.goto("file://" + DIST);
    await seite.waitForTimeout(500);
    await seite.evaluate(() => {
      INHALTSSTOFFE["Dubai Crêpe"] = { a: ["A", "C", "G", "H"], z: Object.keys(ZUSATZ_NAMEN) };
      detailOeffnen("Dubai Crêpe");
    });
    await seite.waitForTimeout(150);

    const vorher = await seite.evaluate(() => {
      const knoepfe = Array.from(document.querySelectorAll("#warenkarte .wgtitel"));
      return knoepfe.map(b => b.getAttribute("aria-expanded"));
    });
    pruef(vorher.length === 2 && vorher.every(v => v === "true"), "vor dem Klick: beide offen", vorher.join(", "));

    await seite.click("#warenkarte .wgtitel:first-of-type");
    await seite.waitForTimeout(400);
    const nachher = await seite.evaluate(() => {
      const knoepfe = Array.from(document.querySelectorAll("#warenkarte .wgtitel"));
      return knoepfe.map(b => b.getAttribute("aria-expanded"));
    });
    pruef(nachher[0] === "false" && nachher[1] === "true",
      "Zuklappen der ersten Karte lässt die zweite unverändert offen", nachher.join(", "));

    /* Gegenbeweis (tatsächlich gefahren, nicht nur behauptet): den
       Klick-Handler testweise auf "wg.closest('#warenkarte')" statt
       "wg.closest('.wgruppe')" umgestellt. aria-expanded blieb dabei
       überraschend korrekt (das setzt der Handler unabhängig vom
       Ziel) — diese eine Zusicherung allein hätte den Fehler NICHT
       gefunden. Gefunden hat ihn die Prüfung weiter unten
       (reduzierte Bewegung, Spurhöhe): Der CSS-Selektor
       ".wgruppe.zu .wgklapp" griff nicht mehr, weil #warenkarte
       niemals die Klasse .wgruppe trägt — die Spur blieb bei 202px
       statt 0px. Lehre: aria-expanded allein beweist keine
       Kollabierung, nur die gemessene Geometrie tut das (§8.1g).
       grep -c bestätigte, dass die Sabotage exakt die eine Zeile
       traf. Zurückgenommen → wieder grün. */

    /* Reduzierte Bewegung: Panel muss sofort im Endzustand stehen. */
    const seiteReduziert = await (await browser.newContext({ viewport: { width: 375, height: 900 }, reducedMotion: "reduce" })).newPage();
    /* Willkommensschirm überspringen wie in jeder Hub-Prüfung — sonst fängt er
       jeden Klick ab (seit er sich nicht mehr selbst schließt). */
    await seiteReduziert.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
    await seiteReduziert.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await seiteReduziert.goto("file://" + DIST);
    await seiteReduziert.waitForTimeout(500);
    await seiteReduziert.evaluate(() => {
      INHALTSSTOFFE["Dubai Crêpe"] = { a: ["A", "C", "G", "H"], z: Object.keys(ZUSATZ_NAMEN) };
      detailOeffnen("Dubai Crêpe");
    });
    await seiteReduziert.click("#warenkarte .wgtitel:first-of-type");
    /* Keine Wartezeit — bei reduzierter Bewegung ist der Endzustand
       sofort da, nicht erst nach der (abgeschalteten) Transition. */
    const sofort = await seiteReduziert.evaluate(() => {
      const knopf = document.querySelector("#warenkarte .wgtitel:first-of-type");
      const panel = document.getElementById(knopf.getAttribute("aria-controls"));
      return getComputedStyle(panel.parentElement).gridTemplateRows;
    });
    /* getComputedStyle löst grid-template-rows immer in Pixel auf,
       nie in "0fr" — der aufgelöste Wert ist bei 0fr aber die
       tatsächliche Spurhöhe, hier also "0px". Das IST der
       Endzustand: die Spur ist wirklich kollabiert, nicht nur auf
       dem Weg dorthin. */
    pruef(sofort === "0px", "prefers-reduced-motion: Panel steht sofort im Endzustand (Spur 0px), ohne auf die Transition zu warten", sofort);

    await seite.close();
    await seiteReduziert.close();
  }

  await browser.close();

  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
