/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Foodroulette als Glücksrad

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-foodroulette-rad.js

   Wunsch (09.10., mit Bildschirmfoto der alten Seite „Help me choose“):
   „Bei dem Foodroulette soll man direkt das Rad sehen und wenn man auf
   Für mich entscheiden drückt soll sich das Rad schon drehen und man
   sieht sofort oben was man bekommt.“ Entschieden: nur noch das Rad,
   kein Wischstapel.

   ZWEITE QUELLEN (CLAUDE.md §8.1b):
     · Welches Feld unter dem Zeiger steht, wird am GEZEICHNETEN Rad
       gemessen: das Feldzeichen, dessen Mitte am höchsten liegt — nicht
       über frFeldUnterZeiger(), sonst prüfte die Rechnung sich selbst.
     · Was in den Korb geht, liest merk — nicht die Anzeige.
     · Extras: die echten Namen der Choco-Karte im erzeugten Hub
       („Zusätzliche Beilage“, „Extra arabische Sahne“ in „Für die
       Runde“) — der Vorfall vom Bildschirmfoto.

   Uhr fest auf 14 Uhr (§8.1j). Beide Häuser, hell und dunkel.

   EHRLICHE GRENZE: Das Gefühl der Drehung (Kurve, Tick) misst keine
   Zahl. Gemessen wird: es läuft, nur transform, 2–4 s, und die Landung
   stimmt mit dem überein, was oben steht und in den Korb geht.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const HUB  = slug => "file://" + path.join(OBEN, "dist", slug, "index.html");
const HAEUSER = ["chocolamour", "blend"];
const EXTRAS = ["Zusätzliche Beilage", "Extra arabische Sahne"];

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

async function oeffnen(browser, slug, hash, opt = {}) {
  const ctx = await browser.newContext({ viewport:{ width:opt.breite || 390, height:opt.hoehe || 844 },
    reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(e.message));
  await s.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith("file://")) return r.continue();
    if (/omoteno\.de\/emoji\//.test(u)) return r.abort();   // Geräte-Emoji genügt hier
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await s.addInitScript(() => {
    try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){}
    const echt = Date, fest = new echt(2026, 9, 9, 14, 0, 0).getTime();
    Date = class extends echt { constructor(...a){ super(...(a.length ? a : [fest])); } static now(){ return fest; } };
  });
  await s.goto(HUB(slug) + (hash || ""));
  await s.waitForTimeout(1600);
  return { ctx, s, fehler };
}

/* Das Feld, dessen Zeichen gerade am höchsten steht, ist das unter dem
   Zeiger. Gemessen am Bild, unabhängig von der Rechnung im Hub. */
const OBEN_FELD = () => {
  const felder = [...document.querySelectorAll("#frScheibe .fr-feld-emo")];
  if (!felder.length) return null;
  let best = null, y = Infinity;
  felder.forEach(e => { const r = e.getBoundingClientRect(), m = r.top + r.height / 2; if (m < y) { y = m; best = e; } });
  return frFelder[+best.closest(".fr-feld").dataset.frFeld];
};

(async () => {
  const browser = await chromium.launch();
  const quelle = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");

  console.log("\n══ Umschalter: Rad oder Karten (wie der Liefer-Schalter) ══");
  /* Wunsch (09.10., zweite Nachricht): „Nicht nur das Rad, sondern
     beides mit einem Switch Button wie beim Lieferservice“. */
  for (const slug of HAEUSER) {
    const { ctx, s, fehler } = await oeffnen(browser, slug, "#/entdecken");
    const vor = await s.evaluate(() => {
      const w = document.getElementById("frWahl"); if (!w) return null;
      w.dataset.probe = "1";
      const k = [...w.querySelectorAll('[role="radio"]')];
      return { wahl: w.dataset.wahl, n: k.length, an: k.filter(x => x.getAttribute("aria-checked") === "true").map(x => x.dataset.frwahl),
               rad: !!document.getElementById("frRad"), stapel: !!document.getElementById("edStapel"),
               hoehe: Math.round(w.getBoundingClientRect().height), ziele: k.map(x => Math.round(x.getBoundingClientRect().width)) };
    });
    pruef(!!vor && vor.n === 2 && vor.wahl === "rad" && vor.an.join() === "rad" && vor.rad && !vor.stapel,
      slug + ": Umschalter mit zwei Wegen, ohne gemerkte Wahl steht das Rad", JSON.stringify(vor));
    pruef(!!vor && vor.hoehe >= 44 && vor.ziele.every(b => b >= 44), slug + ": jeder Weg ≥ 44 px", vor && (vor.hoehe + " hoch, " + vor.ziele.join("/") + " breit"));
    await s.click('[data-frwahl="karten"]');
    await s.waitForTimeout(80);
    const mitten = await s.evaluate(() => {
      const w = document.getElementById("frWahl"), d = w.querySelector(".fw-daumen");
      return { gleich: w.dataset.probe === "1", wahl: w.dataset.wahl, modus: frModus,
               gleitet: d.getAnimations().some(a => a.constructor.name === "CSSTransition" && a.transitionProperty === "transform"),
               zeigt: w.classList.contains("zeigt"), name: w.querySelector(".fw-name span").textContent,
               stapel: !!document.querySelector('#edStapel .ed-karte[data-tiefe="0"]'), rad: !!document.getElementById("frRad") };
    });
    pruef(mitten.gleich && mitten.wahl === "karten" && mitten.modus === "karten", slug + ": ein Tipp schaltet um — DERSELBE Schalter bleibt stehen", JSON.stringify(mitten));
    pruef(mitten.gleitet, slug + ": der Daumen gleitet (laufende Transition auf transform), statt zu springen");
    pruef(mitten.stapel && !mitten.rad, slug + ": darunter liegt jetzt der Kartenstapel, kein Rad");
    pruef(mitten.zeigt && mitten.name === "Karten wischen", slug + ": der Name blitzt auf", mitten.name);
    await s.waitForTimeout(2200);
    pruef(await s.evaluate(() => !document.getElementById("frWahl").classList.contains("zeigt")), slug + ": … und verschwindet wieder");
    /* Gemerkt: nach dem Neuladen dieselbe Art */
    await s.reload(); await s.waitForTimeout(1400);
    const nachLaden = await s.evaluate(() => ({ modus: frModus, stapel: !!document.getElementById("edStapel") }));
    pruef(nachLaden.modus === "karten" && nachLaden.stapel, slug + ": nach dem Neuladen bleibt die gewählte Art", JSON.stringify(nachLaden));
    /* Pfeiltaste auf dem Schalter: wechselt und nimmt den Fokus mit — und wischt NICHT die Karte */
    const vorKarte = await s.evaluate(() => edPos);
    await s.focus('[data-frwahl="karten"]'); await s.keyboard.press("ArrowLeft"); await s.waitForTimeout(150);
    const taste = await s.evaluate(v => ({ modus: frModus, fokus: document.activeElement && document.activeElement.dataset.frwahl, edPos, vorher: v }), vorKarte);
    pruef(taste.modus === "rad" && taste.fokus === "rad" && taste.edPos === taste.vorher, slug + ": Pfeiltaste wechselt die Art, Fokus geht mit, keine Karte gewischt", JSON.stringify(taste));
    /* Mitten in der Drehung umschalten: die Drehung endet, nichts bleibt hängen */
    await s.click(".fr-mitte"); await s.waitForTimeout(300);
    await s.click('[data-frwahl="karten"]'); await s.waitForTimeout(200);
    await s.click('[data-frwahl="rad"]'); await s.waitForTimeout(200);
    const ab = await s.evaluate(() => ({ dreht: frDreht, anim: document.getElementById("frScheibe").getAnimations().length,
      knopf: !document.querySelector('#frKnoepfe [aria-disabled="true"]') }));
    pruef(!ab.dreht && ab.anim === 0 && ab.knopf, slug + ": Umschalten mitten in der Drehung beendet sie sauber", JSON.stringify(ab));
    await s.waitForTimeout(3500);
    pruef(!fehler.length, slug + ": keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    /* Aus der Kartenansicht: „Für mich entscheiden“ in der Speisekarte führt zum Rad und dreht */
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/speisekarte");
    await s.evaluate(() => localStorage.setItem("omoteno-fr-modus-chocolamour", "karten"));
    await s.reload(); await s.waitForTimeout(1400);
    pruef(await s.evaluate(() => frModus === "karten"), "Voraussetzung: gemerkte Art ist „Karten“");
    await s.click(".eh-cta [data-eh-los]"); await s.waitForTimeout(250);
    const r = await s.evaluate(() => ({ modus: frModus, laeuft: !!document.getElementById("frScheibe") &&
      document.getElementById("frScheibe").getAnimations().some(a => a.playState === "running") }));
    pruef(r.modus === "rad" && r.laeuft, "„Für mich entscheiden“ aus der Kartenansicht: Rad, und es dreht", JSON.stringify(r));
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    /* Bewegung reduzieren: der Daumen springt, die Art wechselt trotzdem */
    const { ctx, s } = await oeffnen(browser, "chocolamour", "#/entdecken", { ruhig:true });
    await s.click('[data-frwahl="karten"]'); await s.waitForTimeout(60);
    const r = await s.evaluate(() => ({ modus: frModus, anim: document.querySelector("#frWahl .fw-daumen").getAnimations().length,
      x: new DOMMatrixReadOnly(getComputedStyle(document.querySelector("#frWahl .fw-daumen")).transform).m41 }));
    pruef(r.modus === "karten" && r.anim === 0 && r.x === 56, "Bewegung reduzieren: Daumen sofort am Ziel, kein Gleiten", JSON.stringify(r));
    await ctx.close();
  }
  {
    /* Der Name passt in jeder Sprache ins Bild (360 px) */
    const { ctx, s } = await oeffnen(browser, "chocolamour", "#/entdecken", { breite:360 });
    const r = await s.evaluate(async () => {
      const aus = [];
      for (const sp of SPRACHEN.map(x => x.code)) {
        spracheSetzen(sp); await new Promise(res => setTimeout(res, 120));
        for (const art of ["karten", "rad"]) {
          frModusSetzen(art); await new Promise(res => setTimeout(res, 800));
          const n = document.querySelector("#frWahl .fw-name").getBoundingClientRect();
          if (n.left < 0 || n.right > innerWidth) aus.push(sp + "/" + art + " " + Math.round(n.left) + "…" + Math.round(n.right));
        }
      }
      spracheSetzen("de");
      return aus;
    });
    pruef(!r.length, "360 px: der aufblitzende Name bleibt in jeder Sprache im Bild", r.join(", ") || "alle");
    await ctx.close();
  }

  for (const slug of HAEUSER) {
    console.log("\n══ " + slug + " · Rad sofort, Drehen ohne zweiten Tipp ══");
    {
      const { ctx, s, fehler } = await oeffnen(browser, slug, "#/entdecken");
      const r = await s.evaluate(() => {
        const rad = document.getElementById("frRad"), erg = document.getElementById("frErgebnis");
        if (!rad || !erg) return null;
        const a = rad.getBoundingClientRect(), b = erg.getBoundingClientRect();
        return { felder: document.querySelectorAll("#frScheibe .fr-feld").length, vielfalt: new Set(frFelder).size,
                 unten: Math.round(a.bottom), hoehe: innerHeight, obenDrueber: b.bottom <= a.top,
                 dreht: frDreht };
      });
      pruef(!!r && r.felder >= 3 && r.vielfalt >= 3, "das Rad steht da, mit mindestens drei Gerichten", JSON.stringify(r));
      pruef(!!r && r.unten <= r.hoehe, "390×844: das ganze Rad ist ohne Scrollen zu sehen", r && (r.unten + " ≤ " + r.hoehe));
      pruef(!!r && r.obenDrueber, "die Karte mit dem Ergebnis steht ÜBER dem Rad");
      pruef(!!r && !r.dreht, "beim bloßen Öffnen dreht noch nichts");
      pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
      await ctx.close();
    }
    {
      /* Eingang aus der Speisekarte: EIN Tipp, das Rad dreht schon */
      const { ctx, s, fehler } = await oeffnen(browser, slug, "#/speisekarte");
      const knopf = await s.$(".eh-cta [data-eh-los]");
      pruef(!!knopf, "in der Speisekarte steht „Für mich entscheiden“");
      if (knopf) {
        await knopf.click();
        await s.waitForTimeout(250);
        const r = await s.evaluate(() => {
          const sch = document.getElementById("frScheibe");
          return { seite: seiteJetzt, laeuft: !!sch && sch.getAnimations().some(a => a.playState === "running") };
        });
        pruef(r.seite === "entdecken" && r.laeuft, "ein Tipp: die Seite wechselt und das Rad dreht sich schon", JSON.stringify(r));
        /* Während der Drehung: oben wechseln die Namen — alle vom Rad */
        const spur = await s.evaluate(() => new Promise(fertig => {
          const namen = [], t0 = performance.now();
          (function z(){
            const e = document.querySelector("#frErgebnis .fr-name");
            if (e && frDreht) namen.push(e.textContent);
            if (performance.now() - t0 < 2000) setTimeout(z, 40); else fertig(namen);
          })();
        }));
        const erlaubt = await s.evaluate(() => frFelder.map(x => t(x)));
        const versch = [...new Set(spur)];
        pruef(versch.length >= 3, "während der Drehung zeigt die Karte oben laufend, was unter dem Zeiger steht", versch.length + " Namen: " + versch.slice(0, 5).join(" · "));
        pruef(spur.length > 0 && spur.every(x => erlaubt.includes(x)), "jeder gezeigte Name steht auf dem Rad",
          spur.filter(x => !erlaubt.includes(x)).join(", ") || "alle");
        await s.waitForTimeout(2200);
      }
      pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
      await ctx.close();
    }

    console.log("\n══ " + slug + " · Landung = Anzeige = Korb, fünf Drehungen ══");
    {
      const { ctx, s, fehler } = await oeffnen(browser, slug, "#/entdecken");
      const ergebnisse = [];
      let stimmt = 0, anim = null, doppel = null;
      for (let i = 0; i < 5; i++) {
        const knopf = i === 0 ? ".fr-mitte" : '#frKnoepfe [data-eh-los]';
        await s.click(knopf);
        if (i === 0) {
          await s.waitForTimeout(100);
          /* Doppeltipp: ein zweiter Tipp mitten in der Drehung startet nichts */
          await s.evaluate(() => document.querySelector(".fr-mitte").click());
          await s.click("#frKnoepfe [data-eh-los]", { force:true }).catch(() => {});
          anim = await s.evaluate(() => {
            const a = document.getElementById("frScheibe").getAnimations();
            const props = new Set();
            a.forEach(x => x.effect.getKeyframes().forEach(k => Object.keys(k).forEach(p => props.add(p))));
            ["offset", "easing", "composite", "computedOffset"].forEach(p => props.delete(p));
            return { zahl: a.length, props: [...props], dauer: a[0] ? a[0].effect.getComputedTiming().duration : 0 };
          });
          doppel = anim.zahl;
        }
        await s.waitForTimeout(i === 0 ? 3700 : 2900);
        const r = await s.evaluate((OBEN_FELD) => {
          const unter = (new Function("return (" + OBEN_FELD + ")()"))();
          const k = document.querySelector("#frKnoepfe [data-eh-nehm]");
          return { dreht: frDreht, unter, ergebnis: frErgebnis, oben: document.querySelector("#frErgebnis .fr-name").textContent,
                   nehm: k ? decodeURIComponent(k.dataset.ehNehm) : null, soll: frErgebnis ? t(frErgebnis) : "" };
        }, OBEN_FELD.toString());
        ergebnisse.push(r.ergebnis);
        if (!r.dreht && r.unter === r.ergebnis && r.oben === r.soll && r.nehm === r.ergebnis) stimmt++;
        else console.log("        Drehung " + (i + 1) + ": " + JSON.stringify(r));
      }
      pruef(stimmt === 5, "5 von 5: Feld unter dem Zeiger = Name oben = Gericht hinter „Nehm ich!“", stimmt + " von 5 · " + ergebnisse.join(" · "));
      pruef(ergebnisse.every((x, i) => !i || x !== ergebnisse[i - 1]), "„Nochmal drehen“ bringt jedes Mal ein anderes Gericht", ergebnisse.join(" → "));
      pruef(!!anim && anim.props.length === 1 && anim.props[0] === "transform", "nur transform wird bewegt", anim && anim.props.join(","));
      pruef(!!anim && anim.dauer >= 2000 && anim.dauer <= 4000, "Dauer zwischen 2 und 4 s", anim && anim.dauer + " ms");
      pruef(doppel === 1, "ein zweiter Tipp während der Drehung startet keine zweite Bewegung", doppel);
      /* Nehm ich! legt GENAU das Gericht in den Korb */
      const korb = await s.evaluate(() => {
        const vorher = Object.keys(merk);
        document.querySelector("#frKnoepfe [data-eh-nehm]").click();
        return { neu: Object.keys(merk).filter(k => !vorher.includes(k)), soll: frErgebnis,
                 ansehen: !!document.querySelector('#frKnoepfe a[href="#/auswahl"]') };
      });
      pruef(korb.neu.length === 1 && korb.neu[0] === korb.soll && korb.ansehen, "„Nehm ich!“ legt genau dieses Gericht in den Korb", JSON.stringify(korb));
      pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
      await ctx.close();
    }
  }

  console.log("\n══ Lust und Extras (Choco, echte Namen) ══");
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/entdecken", { ruhig:true });
    const voraus = await s.evaluate(EX => alleKarten().some(([k, d]) => d.some(gr => gr.eintraege.some(e => EX.includes(e.n)))), EXTRAS);
    pruef(voraus, "Voraussetzung: die Extras stehen wirklich in der Karte des Hubs");
    /* 30-mal neu füllen mit „Alle“: nie ein Extra auf dem Rad */
    const alle = await s.evaluate(EX => { const treffer = [];
      for (let i = 0; i < 30; i++) { edLust = ""; frFuellen(); frFelder.forEach(x => { if (EX.includes(x)) treffer.push(x); }); }
      return treffer; }, EXTRAS);
    pruef(!alle.length, "30× neu gefüllt: nie ein Extra auf dem Rad", alle.join(", ") || "keins");
    /* Die Kategorie MIT den Extras: dort müssten sie sonst landen */
    const runde = await s.evaluate(() => [...document.querySelectorAll("[data-eh-lust]")].find(c => /F%C3%BCr%20die%20Runde/.test(c.dataset.ehLust)) ? true : false);
    pruef(runde, "Voraussetzung: der Chip „Für die Runde“ ist da");
    if (runde) {
      await s.evaluate(() => [...document.querySelectorAll("[data-eh-lust]")].find(c => /F%C3%BCr%20die%20Runde/.test(c.dataset.ehLust)).click());
      await s.waitForTimeout(200);
      const r = await s.evaluate(async EX => {
        const gelandet = [];
        for (let i = 0; i < 30; i++) {
          const k = document.querySelector("#frKnoepfe [data-eh-los]") || document.querySelector(".fr-mitte");
          k.click(); await new Promise(res => setTimeout(res, 20));
          gelandet.push(frErgebnis);
        }
        return { gelandet, felder: frFelder.slice(), extra: gelandet.filter(x => EX.includes(x)).concat(frFelder.filter(x => EX.includes(x))) };
      }, EXTRAS);
      pruef(!r.extra.length && r.gelandet.every(Boolean), "„Für die Runde“, 30 Drehungen: nie ein Extra", [...new Set(r.gelandet)].join(" / "));
      pruef(r.felder.length >= 6 && new Set(r.felder).size >= 2, "wenige Gerichte: das Rad wird aufgefüllt (≥ 6 Felder), nie zwei Hälften", r.felder.length + " Felder: " + r.felder.join(" · "));
      pruef(r.felder.every((x, i) => x !== r.felder[(i + 1) % r.felder.length]), "aufgefüllt: nie zwei gleiche Felder nebeneinander");
    }
    /* Ein anderer Chip: alle Felder aus genau dieser Kategorie */
    const lust = await s.evaluate(async () => {
      const c = [...document.querySelectorAll("[data-eh-lust]")].filter(x => x.dataset.ehLust)[0];
      const w = decodeURIComponent(c.dataset.ehLust); c.click();
      await new Promise(r => setTimeout(r, 200));
      return { w, falsch: frFelder.filter(x => { const o = gerichtOrt(x); return !o || o.karte + "|" + o.gruppe !== w; }), n: frFelder.length };
    });
    pruef(lust.n >= 3 && !lust.falsch.length, "Lust-Chip: jedes Feld aus dieser Kategorie", lust.w + ", " + lust.n + " Felder");
    /* Chips nur, wo es etwas zu wählen gibt */
    const chips = await s.evaluate(EX => [...document.querySelectorAll("[data-eh-lust]")].filter(c => c.dataset.ehLust).map(c => {
      const [k, g] = decodeURIComponent(c.dataset.ehLust).split("|");
      const gr = (alleKarten().find(x => x[0] === k) || [0, []])[1].find(x => x.gruppe === g);
      return gr ? gr.eintraege.filter(e => e.p !== "–" && !EX.includes(e.n)).length : 0;
    }), EXTRAS);
    pruef(chips.length > 0 && chips.every(x => x >= 2), "jeder Lust-Chip hat mindestens zwei Gerichte", chips.join(","));
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }

  console.log("\n══ Hochwertiges Rad (10.10.): Ausholen, Lauflicht, Glas, Lichtkegel ══");
  /* Wunsch: „nicht so billig — modern, smooth, high definition“. Was
     davon messbar ist: das Glas steht still, während die Scheibe dreht;
     die LEDs laufen NUR während der Drehung (nur opacity); das Rad holt
     zuerst aus (Winkel kurz kleiner als am Start); nach der Landung
     leuchtet der Keil unter dem Zeiger, in der nächsten Drehung nicht. */
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/entdecken");
    const vor = await s.evaluate(() => ({ glas: !!document.querySelector("#frRad .fr-glas"), treffer: !!document.querySelector("#frRad .fr-treffer"),
      licht: document.querySelector("#frRad .fr-lichter i").getAnimations({ subtree:true }).filter(a => a.playState === "running").length,
      w: (() => { const m = new DOMMatrix(getComputedStyle(document.getElementById("frScheibe")).transform); return Math.atan2(m.b, m.a) * 180 / Math.PI; })() }));
    pruef(vor.glas && vor.treffer, "Voraussetzung: Glas und Lichtkegel stehen im Rad");
    pruef(vor.licht === 0, "in Ruhe läuft kein Lauflicht", vor.licht);
    await s.evaluate(() => frDrehen());
    await s.waitForTimeout(110);
    const anfang = await s.evaluate(() => { const m = new DOMMatrix(getComputedStyle(document.getElementById("frScheibe")).transform); return Math.atan2(m.b, m.a) * 180 / Math.PI; });
    const d = ((anfang - vor.w + 540) % 360) - 180;
    pruef(d < -0.5 && d > -9, "das Rad holt zuerst aus (dreht kurz zurück)", d.toFixed(2) + "°");
    await s.waitForTimeout(500);
    const mitten = await s.evaluate(() => {
      const props = new Set(), lichter = document.querySelectorAll("#frRad .fr-lichter i");
      let laufend = 0;
      lichter.forEach(i => i.getAnimations({ pseudoElement: "::before" }).concat(i.getAnimations({ subtree:true })).forEach(a => {
        if (a.playState === "running"){ laufend++; a.effect.getKeyframes().forEach(k => Object.keys(k).forEach(x => { if (!["offset","computedOffset","easing","composite"].includes(x)) props.add(x); })); } }));
      const glas = document.querySelector("#frRad .fr-glas");
      /* Ein eigenes transform „none“ genügt nicht: Läge das Glas IN der
         Scheibe, drehte es mit ihr (§8.1g — die Probe muss den Fehler
         treffen können). */
      return { laufend, props:[...props], glas: getComputedStyle(glas).transform + (glas.closest("#frScheibe") ? " (in der Scheibe!)" : ""),
        treffer: +getComputedStyle(document.querySelector("#frRad .fr-treffer")).opacity, dreht: frDreht };
    });
    pruef(mitten.dreht && mitten.laufend >= 12 && mitten.props.every(x => x === "opacity"), "während der Drehung: Lauflicht über die LEDs, nur opacity",
      mitten.laufend + " · " + mitten.props.join(","));
    pruef(mitten.glas === "none", "das Glas dreht nicht mit (steht still über der Scheibe)", mitten.glas);
    pruef(mitten.treffer < 0.05, "während der Drehung kein Lichtkegel", mitten.treffer);
    await s.waitForTimeout(3600);
    const nach = await s.evaluate(() => ({ dreht: frDreht, treffer: +getComputedStyle(document.querySelector("#frRad .fr-treffer")).opacity,
      licht: [...document.querySelectorAll("#frRad .fr-lichter i")].reduce((n, i) => n + i.getAnimations({ subtree:true }).filter(a => a.playState === "running").length, 0) }));
    pruef(!nach.dreht && nach.treffer > 0.95 && nach.licht === 0, "gelandet: Keil unter dem Zeiger leuchtet, Lauflicht steht", JSON.stringify(nach));
    pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ Bewegung reduzieren ══");
  for (const slug of HAEUSER) {
    const { ctx, s, fehler } = await oeffnen(browser, slug, "#/speisekarte", { ruhig:true });
    await s.click(".eh-cta [data-eh-los]");
    await s.waitForTimeout(400);
    const r = await s.evaluate((OBEN_FELD) => {
      const unter = (new Function("return (" + OBEN_FELD + ")()"))();
      return { anim: document.getElementById("frScheibe").getAnimations().length, ergebnis: frErgebnis, unter,
               oben: document.querySelector("#frErgebnis .fr-name").textContent, soll: frErgebnis ? t(frErgebnis) : "-" };
    }, OBEN_FELD.toString());
    pruef(r.anim === 0 && !!r.ergebnis && r.unter === r.ergebnis && r.oben === r.soll,
      slug + ": keine Drehung, das Rad steht sofort richtig, das Ergebnis oben", JSON.stringify(r));
    pruef(!fehler.length, slug + ": keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }

  console.log("\n══ Maße, Tapflächen, Kontrast (360/390/430, hell und dunkel) ══");
  const KONTRAST = () => {
    const zahl = t => { const s = String(t);
      const m = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
      if (m) return [m[1] * 255, m[2] * 255, m[3] * 255].concat(m[4] !== undefined ? [+m[4]] : []);
      return (s.match(/[\d.]+/g) || []).map(Number); };
    const kanal = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
    const L = p => .2126 * kanal(p[0]) + .7152 * kanal(p[1]) + .0722 * kanal(p[2]);
    const misch = (o, u) => { const a = o.length > 3 ? o[3] : 1; return [0, 1, 2].map(i => o[i] * a + u[i] * (1 - a)); };
    const grund = el => { const st = []; let k = el;
      while (k) { const b = zahl(getComputedStyle(k).backgroundColor);
        if (b.length >= 3 && (b.length < 4 || b[3] > 0)) st.push(b);
        if (b.length === 3 || b[3] === 1) break; k = k.parentElement; }
      let u = st.length ? st.pop() : [255, 255, 255]; if (u.length > 3) u = misch(u, [255, 255, 255]);
      while (st.length) u = misch(st.pop(), u); return u; };
    const sel = ["#frErgebnis .fr-name", "#frErgebnis .fr-meta", "#frErgebnis .fr-etikett", "#frErgebnis .eh-details",
                 ".fr-mitte", "#frKnoepfe .fr-knopf"];
    const aus = [];
    sel.forEach(q => document.querySelectorAll(q).forEach(el => {
      if (!el.textContent.trim()) return;
      const c = zahl(getComputedStyle(el).color), g = grund(el);
      const a = L(misch(c, g)), b = L(g), r = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      aus.push([q, +r.toFixed(2)]);
    }));
    return aus;
  };
  for (const slug of HAEUSER) for (const licht of ["hell", "dunkel"]) for (const breite of [360, 390, 430]) {
    const { ctx, s, fehler } = await oeffnen(browser, slug, "#/entdecken", { breite, ruhig:true });
    await s.evaluate(l => lichtSetzen(l), licht);
    await s.waitForTimeout(150);
    const lage = slug + " · " + licht + " · " + breite + "px";
    const vorher = await s.evaluate(KONTRAST.toString().replace(/^\(\) => /, "(() => ") + ")()");
    await s.click(".fr-mitte"); await s.waitForTimeout(300);
    const nachher = await s.evaluate(KONTRAST.toString().replace(/^\(\) => /, "(() => ") + ")()");
    const alle = vorher.concat(nachher), schlecht = alle.filter(x => x[1] < 4.5);
    pruef(alle.length >= 8 && !schlecht.length, lage + ": Schrift in Karte, Rad und Knöpfen ≥ 4,5:1",
      schlecht.length ? schlecht.map(x => x.join(" ")).join(", ") : alle.length + " Stellen, kleinste " + Math.min(...alle.map(x => x[1])));
    const m = await s.evaluate(() => {
      const ziele = [...document.querySelectorAll(".fr-mitte, #frKnoepfe .fr-knopf, #frErgebnis .eh-details")].map(e => e.getBoundingClientRect());
      return { ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
               klein: ziele.filter(r => r.height < 44 || r.width < 44).length, ziele: ziele.length };
    });
    pruef(m.ueber <= 1 && m.ziele >= 3 && !m.klein, lage + ": kein Überlauf, jede Tapfläche ≥ 44 px", JSON.stringify(m));
    pruef(!fehler.length, lage + ": keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }

  console.log("\n══ Name ganz lesbar (jedes Gericht der Karte, 360 px) ══");
  /* Vorfall (eigenes Bildschirmfoto, Blend): gelandet stand
     „Frisch gepresster…“ — das Wort „Details“ nahm dem Namen die
     Breite. Zweite Quelle: JEDES Gericht der Karte, nicht nur, was
     zufällig gelandet ist. */
  for (const slug of HAEUSER) {
    const { ctx, s, fehler } = await oeffnen(browser, slug, "#/entdecken", { breite:360, ruhig:true });
    const r = await s.evaluate(() => {
      const namen = edKandidaten().map(e => e.n), ab = [];
      namen.forEach(nm => { frLanden(nm); const e = document.querySelector("#frErgebnis .fr-name");
        if (e.scrollHeight > e.clientHeight + 1) ab.push(nm); });
      return { n: namen.length, ab };
    });
    pruef(r.n > 10 && !r.ab.length, slug + ": kein Gerichtname wird oben abgeschnitten", r.n + " Namen" + (r.ab.length ? ", abgeschnitten: " + r.ab.join(" · ") : ""));
    pruef(!fehler.length, slug + ": keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  console.log(f ? f + " FEHLER" : "Alles sauber.");
  process.exit(f ? 1 : 0);
})();
