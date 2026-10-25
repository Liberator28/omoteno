/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Startseite: aufklappbare Bereiche, Schnellzeile, Sortierung

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-startseite.js

   Wunsch 10.10. (dritte Nachricht): „Überarbeite am Ende die Navigation
   und Sortierung der Funktionen und Einstellungen im Hub … ordentlicher,
   aufklappbar, smart und schnell erreichbar, mit modernem Look.“

   Alle Häuser, Uhr UND Öffnungszeiten fest (§8.1j):
   1 · Bereiche: jede Gruppe ein Kopf (Knopf, ≥ 44 px, aria-expanded,
       Anzahl stimmt mit den Kacheln überein). Ruhelage: die ersten
       zwei offen, der Rest zu (zu = hidden, keine Höhe).
   2 · Ein ECHTER Tipp öffnet und schließt; der Zustand übersteht ein
       Neuladen in der Sitzung — beides an der gemessenen Höhe, nicht
       nur am Attribut.
   3 · Liefermodus: „Jetzt am Tisch“ fehlt, die nächste Gruppe rückt
       als zweite offen nach.
   4 · Schnellzeile: ≥ 2 Wege, je ≥ 44 px; die Karte führt dorthin, wo
       die Kachel hinführt (echter Tipp, Adresse gemessen); Serviceruf
       nur am Tisch; „Ihre Auswahl“ erst mit Inhalt, Zahl = Korb;
       Foodroulette genau dann, wenn das Haus sie zeigt.
   5 · Laufende Bestellung: „Ihre Bestellung“ steht vorn und ist
       hervorgehoben; Werbung (Empfehlung) rückt hinter den ersten
       Bereich. Ohne Bestellung steht sie davor.
   6 · Vorschau im Board (OMOTENO_VORSCHAU): alle Bereiche offen.
   7 · Kontrast (Schrift der Wege, Anzahl, Zahlplakette) ≥ 4,5:1 Tag
       und Abend; kein Überlauf 360–1280 px; Arabisch übersetzt;
       reduzierte Bewegung: Öffnen ohne Animation.

   Gegenbeweis (worktree, §8.1k), je rot: Vorgabe „alles offen“ →
   Ruhelage; Merken gestrichen → Neuladen; Werbung bleibt vorn →
   „rückt hinter den ersten Bereich“; Vorschau-Ausnahme gestrichen →
   Vorschau; Serviceruf-Weg gestrichen → „am Tisch steht der
   Serviceruf“.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DIST = process.env.DIST || path.join(__dirname, "..", "dist");
let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}
const HAEUSER = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, "index.html")));
/* Das Vorführhaus (Markenblatt mit „demo“) teilt den Gerätespeicher
   absichtlich nicht und merkt sich nichts über ein Neuladen hinaus —
   pruef-demo.js prüft genau das. Proben, die eine Wahl über den
   Speicher setzen oder ein Neuladen überstehen lassen, nehmen es
   ausdrücklich aus bzw. gehen dort den Weg über die Bedienung. */
const VORFUEHRHAUS = h => { try { return !!JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "markenblaetter", h + ".json"), "utf8")).demo; } catch (e) { return false; } };

function hellig(rgb) {
  const l = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
const kontrast = (a, b) => { const x = hellig(a), y = hellig(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

async function oeffnen(browser, haus, opt = {}) {
  const ctx = opt.ctx || await browser.newContext({ viewport: { width: opt.breite || 390, height: 900 },
    reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  if (!opt.ctx) await ctx.addInitScript(sp => { try { sessionStorage.setItem("omoteno-willkommen", "1"); if (sp) localStorage.setItem("tapto-sprache", sp); } catch (e) {} }, opt.sprache || null);
  if (opt.vorschau) await ctx.addInitScript(() => { window.OMOTENO_VORSCHAU = true; });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  s.on("crash", () => console.log("  !!   Seitenprozess abgestürzt (" + haus + ")"));
  await s.clock.setFixedTime(new Date(opt.uhr || "2026-10-10T14:00:00"));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await s.goto("file://" + path.join(DIST, haus, "index.html") + "#/");
  await s.waitForTimeout(600);
  await s.evaluate(() => { ZEITEN.length = 0; for (let i = 0; i < 7; i++) ZEITEN.push("10:30 – 00:30"); stunde = new Date().getHours(); zeichne(); });
  await s.waitForTimeout(250);
  return { ctx, s, fehler };
}

const bereiche = s => s.evaluate(() => [...document.querySelectorAll(".sbereich")].map(sec => {
  const k = sec.querySelector(".sb-kopf"), g = sec.querySelector(".gitter");
  return { name: k.dataset.sbAuf, auf: k.getAttribute("aria-expanded") === "true", hoch: k.getBoundingClientRect().height,
    zahl: +k.querySelector(".sb-zahl").textContent, kacheln: g.querySelectorAll("a.kachel").length,
    gitterHoehe: g.getBoundingClientRect().height, hidden: g.hidden, knopf: k.tagName };
}));

const wege = s => s.evaluate(() => [...document.querySelectorAll(".schnellzeile .sz")].map(a => {
  const r = a.getBoundingClientRect();
  return { text: a.querySelector(".sz-text").textContent, href: a.getAttribute("href"), jetzt: a.classList.contains("sz-jetzt"),
    unter: (a.querySelector(".sz-unter") || {}).textContent || "",
    zahl: a.querySelector(".sz-zahl") ? +a.querySelector(".sz-zahl").textContent : 0, w: r.width, h: r.height };
}));

async function tippen(s, sel) {
  const el = await s.$(sel);
  await el.evaluate(e => e.scrollIntoView({ block: "center" }));
  const b = await el.boundingBox();
  await s.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await s.waitForTimeout(350);
}

(async () => {
  const browser = await chromium.launch();
  pruef(HAEUSER.length >= 2, "mindestens zwei Häuser erzeugt (§8.1a)", HAEUSER.join(", "));

  for (const haus of HAEUSER) {
    /* 1 · Ruhelage */
    let { ctx, s, fehler } = await oeffnen(browser, haus);
    let b = await bereiche(s);
    pruef(b.length >= 3, haus + ": mindestens drei Bereiche (Voraussetzung)", b.map(x => x.name).join(" | "));
    pruef(b.every(x => x.knopf === "BUTTON" && x.hoch >= 44), haus + ": jeder Kopf ein Knopf ≥ 44 px", b.map(x => x.hoch.toFixed(0)).join(","));
    pruef(b.every(x => x.zahl === x.kacheln && x.kacheln > 0), haus + ": Anzahl im Kopf = Kacheln im Bereich", b.map(x => x.zahl + "/" + x.kacheln).join(","));
    pruef(b.every((x, i) => i < 2 ? (x.auf && x.gitterHoehe > 40) : (!x.auf && x.hidden && x.gitterHoehe === 0)),
      haus + ": Ruhelage — die ersten zwei offen, der Rest zu", b.map(x => (x.auf ? "auf" : "zu") + ":" + x.gitterHoehe.toFixed(0)).join(","));

    /* 2 · echter Tipp öffnet/schließt, Neuladen behält */
    await tippen(s, ".sbereich:nth-of-type(3) .sb-kopf");
    b = await bereiche(s);
    pruef(b[2].auf && !b[2].hidden && b[2].gitterHoehe > 40, haus + ": Tipp öffnet den dritten Bereich (Höhe gemessen)", b[2].gitterHoehe.toFixed(0));
    await tippen(s, ".sbereich:nth-of-type(1) .sb-kopf");
    b = await bereiche(s);
    pruef(!b[0].auf && b[0].gitterHoehe === 0, haus + ": Tipp schließt den ersten Bereich", b[0].gitterHoehe.toFixed(0));
    /* Voraussetzung selbst prüfen (§8.1g C): Überlebt die SITZUNG das
       Neuladen? Gemessen, 5 Läufe parallel: Einmal war danach der
       GANZE sessionStorage leer — auch eine fremde Probe-Marke —, ohne
       Absturz des Seitenprozesses. Das ist kopfloses Chromium unter
       Last mit file://, nicht der Hub (der löscht nirgends). Dann wird
       das benannt und das Neuladen einmal wiederholt, statt die Probe
       als Hub-Fehler rot zu melden. */
    if (VORFUEHRHAUS(haus)) console.log("  hinw " + haus + ": Vorführhaus — Sitzung lebt nur im Rahmen, kein Neulade-Probe (pruef-demo.js)");
    else {
    const gemerkt = await s.evaluate(() => { sessionStorage.setItem("probe-marke", "1"); return sessionStorage.getItem("omoteno-bereiche"); });
    const neuLaden = async () => {
      await s.reload(); await s.waitForSelector(".sb-kopf"); await s.waitForTimeout(600);
      return s.evaluate(() => sessionStorage.getItem("probe-marke") === "1");
    };
    let sitzung = await neuLaden();
    if (!sitzung) {
      console.log("  hinw " + haus + ": Umgebung hat die Sitzung beim Neuladen verloren — Stand zurückgelegt, zweiter Versuch");
      await s.evaluate(g => { sessionStorage.setItem("probe-marke", "1"); sessionStorage.setItem("omoteno-bereiche", g); }, gemerkt);
      sitzung = await neuLaden();
    }
    pruef(sitzung, haus + ": die Sitzung überlebt das Neuladen (Voraussetzung)");
    await s.evaluate(() => { ZEITEN.length = 0; for (let i = 0; i < 7; i++) ZEITEN.push("10:30 – 00:30"); stunde = new Date().getHours(); zeichne(); });
    b = await bereiche(s);
    pruef(!b[0].auf && b[2].auf && b[2].gitterHoehe > 40, haus + ": nach Neuladen in der Sitzung bleibt die Wahl", b.map(x => x.auf ? "auf" : "zu").join(",") + " · gemerkt " + gemerkt);
    }
    await s.evaluate(() => sessionStorage.removeItem("omoteno-bereiche"));

    /* 4 · Schnellzeile am Tisch */
    await s.evaluate(() => zeichne());
    let w = await wege(s);
    const kachelKarte = await s.evaluate(() => { const k = document.querySelector('.sbereich a.kachel[href^="#/"]'); return k && k.getAttribute("href"); });
    pruef(w.length >= 2 && w.every(x => x.w >= 44 && x.h >= 44), haus + ": Schnellzeile mit ≥ 2 Wegen, je ≥ 44 px", w.map(x => x.text + " " + x.w.toFixed(0) + "×" + x.h.toFixed(0)).join(" | "));
    const fr = await s.evaluate(() => foodrouletteAn());
    pruef(w.some(x => x.href === "#/entdecken") === fr, haus + ": Foodroulette genau dann, wenn das Haus sie zeigt", "an=" + fr);
    const ruf = await s.evaluate(() => KACHELN.some(k => k.schluessel === "tischruf"));
    pruef(!ruf || w.some(x => x.href === "#/service"), haus + ": am Tisch steht der Serviceruf in der Zeile", w.map(x => x.href).join(","));
    /* Seit 18.10. steht „Ihre Auswahl“ immer da (Wunsch: vier feste
       Schnellzugriffe) — leer ohne Zahl, mit einem Satz. */
    const leer = w.find(x => x.href === "#/auswahl");
    pruef(!!leer && !leer.zahl && leer.unter === await s.evaluate(() => t("Noch nichts ausgewählt")),
      haus + ": leerer Korb → „Ihre Auswahl“ ohne Zahl, mit „Noch nichts ausgewählt“", leer && (leer.zahl + " / " + leer.unter));
    pruef(w[0] && w[0].href === "#/auswahl", haus + ": Reihenfolge beginnt mit „Ihre Auswahl“", w.map(x => x.href).join(","));
    const erste = w.find(x => x.href && x.href !== "#/service" && x.href !== "#/entdecken" && x.href !== "#/auswahl");
    pruef(!!erste && erste.href === kachelKarte, haus + ": der Karten-Weg zeigt dorthin, wo die erste Kartenkachel hinführt", erste && erste.href + " / " + kachelKarte);
    await tippen(s, '.schnellzeile a.sz[href="' + erste.href + '"]');
    pruef(await s.evaluate(() => location.hash) === erste.href, haus + ": echter Tipp auf den Karten-Weg öffnet die Karte", await s.evaluate(() => location.hash));

    /* Glas wie der Zurück-Knopf, Lichtrand nur transform, im Ruhezustand
       kein Glanz (nur beim Tippen); echte Tipps auf Foodroulette und
       Serviceruf landen dort, wohin die Wege zeigen. */
    await s.evaluate(() => { location.hash = "#/"; });
    await s.waitForTimeout(350);
    const glas = await s.evaluate(() => [...document.querySelectorAll(".schnellzeile .sz")].map(a => ({
      blur: /blur/.test(getComputedStyle(a).backdropFilter || getComputedStyle(a).webkitBackdropFilter || ""),
      prem: a.classList.contains("sz-p"),
      licht: !a.querySelector(".sz-licht") ? "" : a.querySelector(".sz-licht").getAnimations().filter(x => x.playState === "running")
        .map(x => Object.keys(x.effect.getKeyframes()[0] || {}).filter(k => !["offset","easing","composite","computedOffset"].includes(k)).join("+")).join(","),
      sonst: a.getAnimations({ subtree: true }).filter(x => x.playState === "running" && !x.effect.target.classList.contains("sz-licht")).length,
      /* Premium: die gewählten Gerichte und Herzen schweben (Wunsch 24.10.) — erlaubt, solange es nur transform/opacity ist */
      fremd: a.getAnimations({ subtree: true }).filter(x => x.playState === "running").flatMap(x => Object.keys(x.effect.getKeyframes()[0] || {}).concat(x.effect.getKeyframes().flatMap(k => Object.keys(k)))).filter(k => !["offset","easing","composite","computedOffset","transform","opacity"].includes(k)).length })));
    /* Premium-Karten (Markenblatt startstil) sind Bildkarten ohne Glas und ohne Lichtrand — ihre Messung steht in
       pruef-start-premium.js; hier gilt für sie nur „in Bewegung nur transform/opacity“ (seit 24.10. schweben die Auswahl und die Herzen). */
    pruef(glas.length >= 2 && glas.every(g => g.prem ? g.fremd === 0 : (g.blur && g.licht === "transform" && g.sonst === 0)),
      haus + ": jedes Feld Glas, Lichtrand läuft nur per transform, sonst nichts in Bewegung (Premium: nur transform/opacity darf laufen — das Schweben der Auswahl)", JSON.stringify(glas[0]));
    for (const ziel of ["#/entdecken", "#/service"]) {
      if (!w.some(x => x.href === ziel)) continue;
      await s.evaluate(() => { location.hash = "#/"; });
      await s.waitForTimeout(350);
      await tippen(s, '.schnellzeile a.sz[href="' + ziel + '"]');
      pruef(await s.evaluate(() => location.hash) === ziel, haus + ": echter Tipp auf " + ziel + " öffnet ihn", await s.evaluate(() => location.hash));
    }

    /* Korb füllen → Weg mit Zahl */
    await s.evaluate(() => { const g = SPEISEKARTE[0].eintraege[0]; merk[g.n] = { n: g.n, p: g.p, m: 3 }; merkSpeichern(); location.hash = "#/"; zeichne(); });
    await s.waitForTimeout(400);
    w = await wege(s);
    const aw = w.find(x => x.href === "#/auswahl");
    const summe = await s.evaluate(() => preisText(merkSumme()));
    pruef(!!aw && aw.zahl === 3 && aw.unter === summe, haus + ": mit Inhalt im Korb trägt „Ihre Auswahl“ Zahl und Summe des Korbs", aw && (aw.zahl + " / " + aw.unter + " = " + summe));
    pruef(w.length <= 4, haus + ": höchstens vier Wege", w.length);
    /* Ungerade Zahl → das letzte Feld über die ganze Breite, keine Lücke. */
    const reihe = await s.evaluate(() => { const z = document.querySelector(".schnellzeile").getBoundingClientRect();
      const f = [...document.querySelectorAll(".schnellzeile .sz")].map(a => a.getBoundingClientRect());
      const l = f[f.length - 1]; return { n: f.length, letzte: l.width / z.width }; });
    pruef(reihe.n % 2 === 0 ? reihe.letzte < .6 : reihe.letzte > .95, haus + ": " + reihe.n + " Felder — keine halbe Reihe leer", reihe.letzte.toFixed(2));

    /* 5 · laufende Bestellung: vorn, hervorgehoben; Werbung hinter den ersten Bereich */
    const vorher = await s.evaluate(() => { const t = document.querySelector("main .tipp"), sec = document.querySelector(".sbereich");
      return t && sec ? !!(t.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING) : null; });
    pruef(vorher !== false, haus + ": ohne Bestellung steht die Empfehlung VOR den Bereichen", vorher);
    await s.evaluate(() => { vorgangMerken({ art: "bestellung", nummer: "probe-1", tisch: "4", summe: 9, bestellung: { nummer: "probe-1", tisch: "4", posten: [], summe: 9 } }); zeichne(); });
    await s.waitForTimeout(300);
    w = await wege(s);
    pruef(w[0] && w[0].jetzt && !w[0].href, haus + ": laufende Bestellung steht vorn und ist hervorgehoben", w.map(x => x.text).join(" | "));
    pruef(w.length >= 3 && w.slice(1).some(x => x.href === "#/auswahl"), haus + ": die Bestellung verdrängt keinen der Wege", w.map(x => x.text).join(" | "));
    const nachher = await s.evaluate(() => { const t = document.querySelector("main .tipp"), sec = document.querySelector(".sbereich");
      return t && sec ? !!(t.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_PRECEDING) : null; });
    pruef(nachher !== false, haus + ": mit Bestellung rückt die Empfehlung hinter den ersten Bereich", nachher);
    await tippen(s, "[data-sz-vorgang]");
    pruef(/bestellt|auswahl/.test(await s.evaluate(() => location.hash)), haus + ": Tipp auf „Ihre Bestellung“ führt zur Bestellung", await s.evaluate(() => location.hash));

    /* 3 · Liefermodus */
    await s.evaluate(() => { vorgaenge.length = 0; vorgaengeSichern(); LIEFER.an = true; liefermodus = true; location.hash = "#/"; zeichne(); });
    await s.waitForTimeout(300);
    b = await bereiche(s);
    w = await wege(s);
    pruef(!b.some(x => x.name === "Jetzt am Tisch") && b[0].auf && b[1] && b[1].auf, haus + ": Liefermodus — „Jetzt am Tisch“ fehlt, die nächste Gruppe ist offen", b.map(x => x.name + ":" + (x.auf ? "auf" : "zu")).join(" | "));
    pruef(!w.some(x => x.href === "#/service"), haus + ": Liefermodus — kein Serviceruf in der Schnellzeile");
    pruef(!fehler.length, haus + ": keine Seitenfehler", fehler[0]);
    await ctx.close();

    /* 7 · Kontrast Tag und Abend, Überlauf je Breite */
    for (const [uhr, phase] of [["2026-10-10T14:00:00", "Tag"], ["2026-10-10T21:30:00", "Abend"]]) {
      for (const breite of [360, 430, 1280]) {
        ({ ctx, s, fehler } = await oeffnen(browser, haus, { uhr, breite }));
        await s.evaluate(() => { const g = SPEISEKARTE[0].eintraege[0]; merk[g.n] = { n: g.n, p: g.p, m: 2 }; merkSpeichern(); zeichne(); });
        const k = await s.evaluate(() => {
          const lies = t => (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map((v, i, a) => /color\(/.test(t) ? v * 255 : v);
          const grundVon = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .9)) return c; } return getComputedStyle(document.documentElement).backgroundColor; };
          const paare = [];
          document.querySelectorAll(".sz-text, .sz-unter, .sb-zahl, .sz-zahl, .sb-name").forEach(el => paare.push({ was: el.className, s: getComputedStyle(el).color, g: grundVon(el) }));
          return { paare, ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        const rgb = t => { const z = (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number); return /color\(/.test(t) ? z.map(v => v * 255) : z; };
        const werte = k.paare.map(p => ({ was: p.was, k: kontrast(rgb(p.s), rgb(p.g)) }));
        const min = werte.reduce((a, x) => x.k < a.k ? x : a, { k: 99 });
        pruef(werte.length >= 5 && min.k >= 4.5, haus + " " + phase + " " + breite + "px: Schrift in Schnellzeile und Köpfen ≥ 4,5:1", "min " + min.k.toFixed(2) + " (" + min.was + ")");
        pruef(k.ueber <= 0, haus + " " + phase + " " + breite + "px: kein seitlicher Überlauf", k.ueber);
        await ctx.close();
      }
    }

    /* 6 · Vorschau: alles offen */
    ({ ctx, s } = await oeffnen(browser, haus, { vorschau: true }));
    b = await bereiche(s);
    pruef(b.length >= 3 && b.every(x => x.auf && x.gitterHoehe > 0), haus + ": Vorschau im Board — jeder Bereich offen", b.map(x => x.auf ? "auf" : "zu").join(","));
    await ctx.close();
  }

  /* Arabisch und reduzierte Bewegung */
  {
    const { ctx, s, fehler } = await oeffnen(browser, HAEUSER[0], { sprache: "ar" });
    await s.evaluate(() => { const g = SPEISEKARTE[0].eintraege[0]; merk[g.n] = { n: g.n, p: g.p, m: 1 }; merkSpeichern(); zeichne(); });
    const w = await wege(s);
    const aria = await s.evaluate(() => document.querySelector(".schnellzeile").getAttribute("aria-label"));
    pruef(w.some(x => x.text === "اختياركم") && aria === "وصول سريع", "Arabisch: Wege und Bezeichnung übersetzt", w.map(x => x.text).join(" | ") + " / " + aria);
    pruef(!fehler.length, "Arabisch: keine Seitenfehler", fehler[0]);
    await ctx.close();
  }
  {
    const { ctx, s } = await oeffnen(browser, HAEUSER[0], { ruhig: true });
    await tippen(s, ".sbereich:nth-of-type(3) .sb-kopf");
    const lauf = await s.evaluate(() => document.querySelector(".sbereich:nth-of-type(3) .gitter").getAnimations().filter(a => a.playState === "running").length);
    const hoch = await s.evaluate(() => document.querySelector(".sbereich:nth-of-type(3) .gitter").getBoundingClientRect().height);
    pruef(lauf === 0 && hoch > 40, "reduzierte Bewegung: der Bereich öffnet sofort, ohne Animation", lauf + " / " + hoch.toFixed(0));
    const szLauf = await s.evaluate(() => [...document.querySelectorAll(".schnellzeile .sz")].reduce((n, a) =>
      n + a.getAnimations({ subtree: true }).filter(x => x.playState === "running").length, 0));
    pruef(szLauf === 0, "reduzierte Bewegung: im Schnellzugriff läuft nichts (kein Lichtrand)", szLauf);
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if (f) { console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
