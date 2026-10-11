/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Karte-Knöpfe oben: „Gericht hinzufügen“, „＋ Kategorie“,
   „Karte einlesen“

     node pruefungen/pruef-kartenknoepfe.js

   Wunsch 11.10.: „bei der Speisekarte Kategorien hinzufügen und Karte
   einlesen direkt oben sehen“. Bis dahin schwebten zwei Knöpfe unter
   760 px am unteren Rand (fixiert, z-index 39, Glas), und „＋ Neue
   Kategorie“ stand erst am Ende der Liste. Jetzt stehen alle drei im
   Fluss oben, direkt unter den Karten-Chips.

   Gemessen auf Telefon und Tresen:
     - im Fluss (nicht fixiert), über der ersten Kategorie, ≥ 44 px,
       nichts ragt aus dem Bild, kein seitliches Überlaufen;
     - ein Finger trifft jeden Knopf (elementFromPoint);
     - jeder Knopf öffnet sein Blatt;
     - ganz unten gescrollt liegt über der letzten Zeile nichts mehr
       (die alte Leiste brauchte dafür 132 px Polster);
     - „＋ Neue Kategorie“ am Listenende bleibt als zweiter Weg.

   Gegenbeweis (worktree): position:fixed zurück → „im Fluss“ und „über
   der Liste“ rot; Knopf „＋ Kategorie“ entfernt → rot.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const ADMIN = path.join(__dirname, "..", "seiten", "admin.html");
let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

async function boardOeffnen(seite) {
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(700);
  await seite.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
    const sch = document.getElementById("scharf"); if (sch) sch.hidden = true;
  });
  await seite.waitForTimeout(400);
  await seite.evaluate(() => document.querySelector('[data-tafel="speisekarte"]').click());
  await seite.waitForTimeout(500);
}

const blattOffen = (seite, id) => seite.evaluate(i => { const b = document.getElementById(i); return !!b && !b.hidden; }, id);
const blattZu = (seite, id) => seite.evaluate(i => { const b = document.getElementById(i); if (b) b.hidden = true; }, id);

(async () => {
  const browser = await chromium.launch();

  for (const m of [{ name: "Telefon 360px", width: 360, height: 760 }, { name: "Telefon 390px", width: 390, height: 844 },
                   { name: "Tresen 1024px", width: 1024, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: { width: m.width, height: m.height }, hasTouch: m.width < 500 });
    const seite = await ctx.newPage();
    const konsole = [];
    seite.on("pageerror", e => konsole.push(String(e).slice(0, 200)));
    await boardOeffnen(seite);
    console.log("\n══ " + m.name + " ══");

    const info = await seite.evaluate(() => {
      const el = document.querySelector(".kartenknoepfe");
      const liste = document.getElementById("karteListe").getBoundingClientRect();
      const kn = ["neuesGericht", "neueKategorie", "karteImport"].map(id => {
        const b = document.getElementById(id); const r = b.getBoundingClientRect();
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { id, h: Math.round(r.height), l: r.left, r: r.right, unten: r.bottom, frei: !!t && (t === b || b.contains(t)) };
      });
      return { pos: getComputedStyle(el).position, listeOben: liste.top, kn,
               sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    });
    pruef(info.pos !== "fixed", "Knöpfe stehen im Fluss", info.pos);
    pruef(info.kn.every(k => k.unten <= info.listeOben + 1), "alle drei über der Liste", info.kn.map(k => Math.round(k.unten)).join(",") + " ≤ " + Math.round(info.listeOben));
    pruef(info.kn.every(k => k.h >= 44), "je ≥ 44 px hoch", info.kn.map(k => k.h).join(","));
    pruef(info.kn.every(k => k.l >= 0 && k.r <= info.cw), "nichts ragt aus dem Bild");
    pruef(info.kn.every(k => k.frei), "ein Finger trifft jeden Knopf", info.kn.filter(k => !k.frei).map(k => k.id).join(",") || "alle");
    pruef(info.sw === info.cw, "kein seitliches Überlaufen", info.sw + "/" + info.cw);

    await seite.click("#neuesGericht"); await seite.waitForTimeout(350);
    pruef(await blattOffen(seite, "blatt"), "„Gericht hinzufügen“ öffnet das Gericht-Blatt");
    await blattZu(seite, "blatt"); await seite.waitForTimeout(200);
    await seite.click("#neueKategorie"); await seite.waitForTimeout(350);
    pruef(await blattOffen(seite, "ktedBlatt"), "„＋ Kategorie“ öffnet das Kategorie-Blatt");
    await blattZu(seite, "ktedBlatt"); await seite.waitForTimeout(200);
    await seite.click("#karteImport"); await seite.waitForTimeout(350);
    pruef(await blattOffen(seite, "impBlatt"), "„Karte einlesen“ öffnet das Einlese-Blatt");
    await blattZu(seite, "impBlatt"); await seite.waitForTimeout(200);

    await seite.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await seite.waitForTimeout(250);
    const ende = await seite.evaluate(() => {
      const zeilen = [...document.querySelectorAll("#karteListe .gzeile")];
      const neu = document.querySelector("#karteListe [data-kted-neu]");
      const letzte = (neu || zeilen[zeilen.length - 1]);
      if (!letzte) return null;
      const r = letzte.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { frei: !!t && (t === letzte || letzte.contains(t)), zweiterWeg: !!neu, trifft: t ? (t.id || t.className) : "nichts" };
    });
    pruef(ende && ende.frei, "ganz unten: die letzte Zeile ist mit dem Finger erreichbar", ende && ende.trifft);
    pruef(ende && ende.zweiterWeg, "„＋ Neue Kategorie“ am Listenende bleibt");

    pruef(konsole.length === 0, "keine Ausnahme in der Konsole", konsole.join(" | ") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
