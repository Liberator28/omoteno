/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Zentrale: Kacheln und Unterseiten in „Einstellungen“
   UND „Gast-Hub gestalten“

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-zentrale.js

   > Wunsch (19.10.): „Navigation durch die Einstellungen erleichtern …
   > nicht alle Einstellungen auf einer Seite, sondern in Unterseiten,
   > übersichtlich, mit Symbolen und leuchtenden Rändern im Glas-Look.
   > Schnell, smart und einfach — wie in einer Zentrale.“

   Beide Reiter benutzen dieselbe Technik (euOeffnen/euSchliessen,
   data-eu-kacheln). Geprüft wird deshalb JEDE Kachel JEDES Reiters mit
   einem echten Tipp — nicht eine stellvertretend (§8.1a: was mehrfach
   da ist, wird mehrfach geprüft).

   1 · Aufbau je Reiter: zu jeder Gruppe genau eine Kachel (zweite Quelle:
       die Gruppen im Reiter), keine Kachel ohne Ziel, Ruhelage zeigt nur
       Kacheln, Tapfläche ≥ 44 px, Symbol je Kachel, Satz nicht abgeschnitten,
       Lichtrand läuft nur per transform.
   2 · Jede Kachel: Tipp öffnet GENAU ihre Gruppe, Überschrift hat den
       Fokus, „Alle …“ steht oben (≥ 44 px), zurück führt zur Kachel von eben.
   3 · Gast-Hub: Kopf (Symbolleiste) und Vorschau erscheinen erst in einer
       Unterseite; die Symbolleiste wechselt die Unterseite mit einem Tipp
       (aktives Symbol = aria-current); ein Tipp in der Vorschau auf einen
       Text öffnet die Gruppe „Alle Texte“.
   4 · Escape führt zurück; wer den Reiter neu betritt, beginnt bei den Kacheln.
   5 · Kachelschrift auf Glas ≥ 4,5:1, hell und dunkel.
   6 · 320/360/390/1280 px: kein Überlauf; reduzierte Bewegung: kein Lichtrand
       läuft.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const ADMIN = "file://" + (process.env.ADMIN_DATEI || path.join(__dirname, "..", "seiten", "admin.html"));
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

async function board(browser, breite, opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: breite, height: opt.hoehe || 900 }, reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
    : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await p.goto(ADMIN);
  await p.waitForTimeout(600);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); } });
  await p.waitForTimeout(300);
  const sc = await p.$("#scharfJetzt");
  if(sc && await p.isVisible("#scharf")){ await sc.click(); await p.waitForTimeout(150); }
  if(opt.hell != null) await p.evaluate(h => { EINST.licht = h ? "hell" : "dunkel"; lichtAnwenden(); }, opt.hell);
  return { ctx, p, fehler };
}
const tafelOeffnen = async (p, id) => { await p.evaluate(t => tafelZeigen(t), id); await p.waitForTimeout(350); };

/* Alles, was zum Aufbau eines Reiters zu messen ist. */
const AUFBAU = id => {
  const tafel = document.getElementById("t-" + id);
  const sichtbar = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const kacheln = [...tafel.querySelectorAll(".eu-kachel[data-eu-seite]")];
  const gruppen = [...tafel.querySelectorAll(":scope > .egruppe")].filter(g => !g.classList.contains("eu-uebersicht") && g.querySelector("h2.etitel"));
  const r = kacheln.map(k => k.getBoundingClientRect());
  const lauf = kacheln.map(k => k.querySelector(".eu-klicht").getAnimations().filter(a => a.playState === "running")
    .map(a => Object.keys(a.effect.getKeyframes()[0] || {}).filter(x => !["offset", "easing", "composite", "computedOffset"].includes(x)).join("+")).join(","));
  return {
    kacheln: kacheln.length, gruppen: gruppen.length,
    ohneKachel: gruppen.filter(g => !kacheln.some(k => k.dataset.euSeite === g.id)).map(g => g.id || g.querySelector("h2").textContent),
    tot: kacheln.filter(k => !document.getElementById(k.dataset.euSeite)).map(k => k.dataset.euSeite),
    gruppeSichtbar: gruppen.filter(sichtbar).map(g => g.id),
    zurueck: sichtbar(tafel.querySelector(":scope > .eu-zurueck")),
    kopfSichtbar: sichtbar(tafel.querySelector(".gh-kopf")) || sichtbar(tafel.querySelector(".gh-vorschau")),
    spalten: new Set(r.map(x => Math.round(x.left))).size,
    klein: r.filter(x => x.height < 44 || x.width < 44).length,
    ohneSymbol: kacheln.filter(k => !k.querySelector(".eu-symbol svg path, .eu-symbol svg circle, .eu-symbol svg rect")).map(k => k.dataset.euSeite),
    abgeschnitten: kacheln.filter(k => { const i = k.querySelector(".eu-ktext i"), b = k.querySelector(".eu-ktext b");
      return i && (i.scrollHeight > i.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1); }).map(k => k.dataset.euSeite),
    titelDoppelt: kacheln.map(k => k.querySelector(".eu-ktext b").textContent).filter((t, i, a) => a.indexOf(t) !== i),
    lauf, ueberlauf: document.documentElement.scrollWidth - innerWidth,
    ids: kacheln.map(k => k.dataset.euSeite)
  };
};

(async () => {
  const browser = await chromium.launch();
  const REITER = [["einstellungen", "Einstellungen"], ["startseite", "Gast-Hub gestalten"]];

  for(const [id, name] of REITER){
    console.log("\n══ " + name + " · Aufbau (390 px) ══");
    const { ctx, p, fehler } = await board(browser, 390);
    await tafelOeffnen(p, id);
    const a = await p.evaluate(AUFBAU, id);
    pruef(a.kacheln >= 10 && a.kacheln === a.gruppen && !a.ohneKachel.length,
      "zu jeder Gruppe genau eine Kachel (zweite Quelle: die Gruppen im Reiter)", a.kacheln + " Kacheln / " + a.gruppen + " Gruppen " + a.ohneKachel.join(","));
    pruef(!a.tot.length, "keine Kachel führt ins Leere", a.tot.join(",") || "keine");
    pruef(!a.gruppeSichtbar.length && !a.zurueck && !a.kopfSichtbar, "Ruhelage: nur Kacheln — keine Gruppe, kein Zurück, kein Kopf/Vorschau", JSON.stringify({ g: a.gruppeSichtbar, z: a.zurueck, k: a.kopfSichtbar }));
    pruef(a.spalten >= 2 && !a.klein && a.ueberlauf <= 0, "mindestens zwei Spalten, jede Kachel ≥ 44 px, kein Überlauf", a.spalten + " Spalten, " + a.klein + " zu klein, Überlauf " + a.ueberlauf);
    pruef(!a.ohneSymbol.length, "jede Kachel trägt ein gezeichnetes Symbol", a.ohneSymbol.join(",") || "alle");
    pruef(!a.abgeschnitten.length, "kein Titel und kein Satz ist abgeschnitten (Satz höchstens zwei Zeilen, vollständig)", a.abgeschnitten.join(",") || "alle vollständig");
    pruef(!a.titelDoppelt.length, "jeder Kacheltitel ist eindeutig", a.titelDoppelt.join(",") || "ja");
    pruef(a.lauf.length >= a.kacheln && a.lauf.every(x => x === "transform"), "an jeder Kachel läuft ein Lichtrand, nur transform", [...new Set(a.lauf)].join(" | "));
    pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");

    /* 2 · JEDE Kachel mit echtem Tipp. */
    console.log("══ " + name + " · jede Kachel öffnet genau ihre Gruppe ══");
    let schlecht = [];
    for(const gid of a.ids){
      await tafelOeffnen(p, id);
      await p.click("#t-" + id + ' [data-eu-seite="' + gid + '"]');
      await p.waitForTimeout(120);
      const o = await p.evaluate(([t, g]) => {
        const tafel = document.getElementById("t-" + t), sichtbar = el => !!el && el.getClientRects().length > 0;
        const offen = [...tafel.querySelectorAll(":scope > .egruppe")].filter(sichtbar).map(x => x.id);
        const z = tafel.querySelector(":scope > .eu-zurueck"), zr = z.getBoundingClientRect();
        const h = document.getElementById(g).querySelector("h2.etitel");
        return { offen, zurueck: sichtbar(z) && zr.height >= 44, fokus: document.activeElement === h,
          gh: t === "startseite" ? { kopf: sichtbar(tafel.querySelector(".gh-kopf")), vorschau: sichtbar(tafel.querySelector(".gh-vorschau")),
            aktiv: [...tafel.querySelectorAll("[data-gh-sprung][aria-current='true']")].map(x => x.dataset.ghSprung) } : null };
      }, [id, gid]);
      const gut = o.offen.length === 1 && o.offen[0] === gid && o.zurueck && o.fokus &&
        (!o.gh || (o.gh.kopf && o.gh.vorschau && o.gh.aktiv.length === 1 && o.gh.aktiv[0] === gid));
      if(!gut) schlecht.push(gid + " " + JSON.stringify(o));
      await p.click("#t-" + id + " > .eu-zurueck");
      await p.waitForTimeout(100);
      const z = await p.evaluate(([t, g]) => { const tafel = document.getElementById("t-" + t);
        return { offen: [...tafel.querySelectorAll(":scope > .egruppe")].filter(x => x.getClientRects().length && !x.classList.contains("eu-uebersicht")).length,
          fokus: document.activeElement && document.activeElement.dataset.euSeite === g }; }, [id, gid]);
      if(z.offen || !z.fokus) schlecht.push(gid + " zurück " + JSON.stringify(z));
    }
    pruef(!schlecht.length, "alle " + a.ids.length + " Kacheln: Tipp zeigt genau ihre Gruppe (Überschrift fokussiert, „Alle …“ ≥ 44 px"
      + (id === "startseite" ? ", Kopf, Vorschau und aktives Symbol da" : "") + "), zurück führt zur Kachel", schlecht.slice(0, 2).join(" | ") || a.ids.length + " von " + a.ids.length);

    /* 4 · Escape und Wiedereintritt. */
    await tafelOeffnen(p, id);
    await p.click("#t-" + id + ' [data-eu-seite="' + a.ids[1] + '"]');
    await p.waitForTimeout(100);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(120);
    pruef(await p.evaluate(t => !document.getElementById("t-" + t).dataset.euOffen, id), "Escape führt zurück zu den Kacheln");
    await p.click("#t-" + id + ' [data-eu-seite="' + a.ids[1] + '"]');
    await p.waitForTimeout(100);
    await p.evaluate(() => { tafelZeigen("bestellungen"); });
    await tafelOeffnen(p, id);
    pruef(await p.evaluate(t => !document.getElementById("t-" + t).dataset.euOffen, id), "wer den Reiter neu betritt, beginnt bei den Kacheln");
    await ctx.close();
  }

  /* 3 · Gast-Hub: Symbolleiste und Vorschau. */
  console.log("\n══ Gast-Hub gestalten · Symbolleiste und Vorschau ══");
  {
    const { ctx, p, fehler } = await board(browser, 390);
    await tafelOeffnen(p, "startseite");
    await p.click('#t-startseite [data-eu-seite="gh-kacheln"]');
    await p.waitForTimeout(150);
    const leiste = await p.evaluate(() => { const a = [...document.querySelectorAll("#t-startseite [data-gh-sprung]")];
      return { n: a.length, ohneSymbol: a.filter(x => !x.querySelector("svg path, svg circle, svg rect")).map(x => x.dataset.ghSprung),
        klein: a.filter(x => x.getBoundingClientRect().height < 44).length,
        ziele: a.filter(x => !document.getElementById(x.dataset.ghSprung)).map(x => x.dataset.ghSprung),
        kacheln: document.querySelectorAll("#t-startseite .eu-kachel").length }; });
    pruef(leiste.n === leiste.kacheln && !leiste.ohneSymbol.length && !leiste.klein && !leiste.ziele.length,
      "Symbolleiste: ein Eintrag je Kachel, jeder mit Symbol, ≥ 44 px, jedes Ziel da", JSON.stringify(leiste));
    /* Echter Tipp auf einen anderen Eintrag wechselt direkt — ohne Umweg über die Kacheln. */
    await p.$eval('#t-startseite [data-gh-sprung="fbGruppe"]', e => e.scrollIntoView({ inline: "center" }));
    await p.click('#t-startseite [data-gh-sprung="fbGruppe"]');
    await p.waitForTimeout(200);
    const w = await p.evaluate(() => ({ offen: document.getElementById("t-startseite").dataset.euOffen,
      sichtbar: [...document.querySelectorAll("#t-startseite > .egruppe")].filter(x => x.getClientRects().length).map(x => x.id),
      aktiv: [...document.querySelectorAll("#t-startseite [data-gh-sprung][aria-current='true']")].map(x => x.dataset.ghSprung),
      leisteSichtbar: document.querySelector("#t-startseite .gh-sprung").getClientRects().length > 0 }));
    pruef(w.offen === "fbGruppe" && w.sichtbar.join() === "fbGruppe" && w.aktiv.join() === "fbGruppe" && w.leisteSichtbar,
      "Tipp auf ein Symbol wechselt die Unterseite sofort (Farben), die Leiste bleibt, aktives Symbol wechselt mit", JSON.stringify(w));
    /* Das Rad der Figur steht nach dem Öffnen: Es wird erst gemessen, wenn
       die Gruppe sichtbar ist — verborgen hat jedes Stück Breite 0 (gefunden
       von pruef-figur-board nach dem Umbau: Auswahlknöpfe 0 px hoch). */
    await p.evaluate(() => { document.getElementById("t-startseite").querySelector(".eu-zurueck").click(); });
    await p.waitForTimeout(100);
    await p.click('#t-startseite [data-eu-seite="gh-figur"]');
    await p.click('#t-startseite [data-av-auf="figur"]');
    await p.waitForTimeout(500);
    const rad = await p.evaluate(() => { const spur = document.getElementById("avspur-figur"), a = spur.querySelector(".avstueck.aktiv");
      const sr = spur.getBoundingClientRect(), ar = a.getBoundingClientRect();
      return { hoehe: Math.min(...[...spur.querySelectorAll(".avstueck")].map(x => x.getBoundingClientRect().height)),
        mitte: Math.abs((ar.left + ar.width / 2) - (sr.left + sr.width / 2)), spur: sr.width }; });
    pruef(rad.spur > 100 && rad.hoehe >= 44 && rad.mitte <= 6, "Rad der Figur nach dem Öffnen: Auswahlknöpfe ≥ 44 px hoch, aktive Figur in der Mitte der Spur",
      JSON.stringify({ hoehe: Math.round(rad.hoehe), abwMitte: Math.round(rad.mitte), spur: Math.round(rad.spur) }));
    /* Ein Tipp in der Vorschau auf einen Text öffnet „Alle Texte“. */
    await p.evaluate(() => { document.getElementById("t-startseite").querySelector(".eu-zurueck").click(); });
    await p.waitForTimeout(100);
    await p.evaluate(() => { try{ window.vorschauTextGewaehlt("Speisekarte ansehen", "start"); }catch(e){ window.__fehlerText = String(e); } });
    await p.waitForTimeout(250);
    const t = await p.evaluate(() => ({ offen: document.getElementById("t-startseite").dataset.euOffen, fehler: window.__fehlerText || "",
      sichtbar: [...document.querySelectorAll("#t-startseite > .egruppe")].filter(x => x.getClientRects().length).map(x => x.id) }));
    pruef(t.offen === "txGruppe" && t.sichtbar.join() === "txGruppe" && !t.fehler, "ein Tipp auf einen Text in der Vorschau öffnet die Unterseite „Alle Texte“", JSON.stringify(t));
    pruef(!fehler.length, "keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }

  /* 5 · Kontrast der Kachelschrift auf Glas, hell und dunkel, beide Reiter. */
  console.log("\n══ Kachelschrift auf Glas ══");
  for(const hell of [false, true]) for(const [id, name] of REITER){
    const { ctx, p } = await board(browser, 390, { hell });
    await tafelOeffnen(p, id);
    const k = await p.evaluate(tafelId => {
      const rgba = c => { const m = c.match(/[\d.]+/g).map(Number); const fa = /^color\(/.test(c) ? 255 : 1; return [m[0] * fa, m[1] * fa, m[2] * fa, m.length > 3 ? m[3] : 1]; };
      const tief = el => { for(let x = el; x; x = x.parentElement){ const c = rgba(getComputedStyle(x).backgroundColor); if(c[3] > .95) return c; } return [0, 0, 0, 1]; };
      const l = c => { const v = c.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
      const kon = (a, b) => { const x = l(a), y = l(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const ks = [...document.querySelectorAll("#t-" + tafelId + " .eu-kachel[data-eu-seite]")];
      let min = 99, wo = "";
      ks.forEach(kachel => { const grund = tief(kachel.parentElement), glas = rgba(getComputedStyle(kachel).backgroundColor);
        const fl = [0, 1, 2].map(i => glas[i] * glas[3] + grund[i] * (1 - glas[3]));
        ["b", "i"].forEach(t => { const c = kon(rgba(getComputedStyle(kachel.querySelector(".eu-ktext " + t)).color).slice(0, 3), fl); if(c < min){ min = c; wo = kachel.dataset.euSeite + " " + t; } }); });
      return { min, wo, anzahl: ks.length };
    }, id);
    pruef(k.anzahl >= 10 && k.min >= 4.5, name + " · " + (hell ? "hell" : "dunkel") + ": Titel und Satz jeder Kachel ≥ 4,5:1 auf dem Glas", k.min.toFixed(2) + ":1 (" + k.wo + ")");
    await ctx.close();
  }

  /* 6 · Breiten und reduzierte Bewegung. */
  console.log("\n══ Breiten, reduzierte Bewegung ══");
  for(const breite of [320, 360, 1280]) for(const [id, name] of REITER){
    const { ctx, p } = await board(browser, breite, { hoehe: breite > 800 ? 900 : 760 });
    await tafelOeffnen(p, id);
    const a = await p.evaluate(AUFBAU, id);
    pruef(a.ueberlauf <= 0 && !a.klein && !a.abgeschnitten.length, name + " · " + breite + " px: kein Überlauf, Kacheln ≥ 44 px, nichts abgeschnitten",
      "Überlauf " + a.ueberlauf + ", zu klein " + a.klein + ", abgeschnitten " + a.abgeschnitten.join(","));
    await ctx.close();
  }
  for(const [id, name] of REITER){
    const { ctx, p } = await board(browser, 390, { ruhig: true });
    await tafelOeffnen(p, id);
    const a = await p.evaluate(AUFBAU, id);
    pruef(a.lauf.every(x => x === ""), name + " bei reduzierter Bewegung: an keiner Kachel läuft ein Lichtrand", "laufend: " + a.lauf.filter(x => x).length);
    await ctx.close();
  }

  /* 7 · Ordnung (01.11.): Abschnitte, Suche, „Zuletzt geöffnet“. Zweite Quelle bleiben die Gruppen. */
  console.log("\n══ Abschnitte, Suche, Zuletzt geöffnet ══");
  const ERWARTET = { einstellungen: ["Bestellen & Service", "Nur dieses Gerät", ["Melden", "Bildschirm", "Dieses Gerät"], "euSuche", "lautstärke", "Melden"],
                     startseite: ["Aussehen", "Texte", ["Ihre Worte", "Alle Texte"], "ghSuche", "logo", "Kopf & Logo"] };
  for(const [id, name] of REITER){
    const [erster, abName, abInhalt, suche, wort, findet] = ERWARTET[id];
    const { ctx, p, fehler } = await board(browser, 390);
    await p.evaluate(() => localStorage.removeItem("omoteno-eu-zuletzt"));
    await tafelOeffnen(p, id);
    const o = await p.evaluate(id => {
      const tafel = document.getElementById("t-" + id), ab = [...tafel.querySelectorAll(".eu-uebersicht .eu-abschnitt")];
      const kacheln = [...tafel.querySelectorAll(".eu-kachel")];
      return { titel: ab.map(a => a.querySelector(".eu-abtitel").textContent),
        jeEine: kacheln.every(k => k.closest(".eu-abschnitt")),
        inhalt: Object.fromEntries(ab.map(a => [a.querySelector(".eu-abtitel").textContent, [...a.querySelectorAll(".eu-kachel b")].map(b => b.textContent)])) };
    }, id);
    pruef(o.titel[0] === erster && o.titel.length >= 4 && o.jeEine, name + ": Kacheln in Abschnitten, „" + erster + "“ zuerst, keine Kachel außerhalb", o.titel.join(" · "));
    pruef(JSON.stringify(o.inhalt[abName]) === JSON.stringify(abInhalt), name + ": „" + abName + "“ enthält genau " + abInhalt.join(", "), JSON.stringify(o.inhalt[abName]));
    const feld = await p.evaluate(s => { const e = document.getElementById(s), r = e.getBoundingClientRect(); return { px: parseFloat(getComputedStyle(e).fontSize), h: r.height }; }, suche);
    pruef(feld.px >= 16 && feld.h >= 44, name + ": Suchfeld 16 px, ≥ 44 px hoch", JSON.stringify(feld));
    await p.fill("#" + suche, wort); await p.waitForTimeout(120);
    const t1 = await p.evaluate(id => [...document.querySelectorAll("#t-" + id + " .eu-uebersicht .eu-kachel")].filter(k => k.getClientRects().length).map(k => k.querySelector("b").textContent), id);
    pruef(t1.includes(findet) && t1.length < 6, name + ": Suche „" + wort + "“ findet „" + findet + "“ (aus dem Inhalt der Gruppe)", t1.join(", "));
    await p.fill("#" + suche, "qqxyzq"); await p.waitForTimeout(120);
    const t2 = await p.evaluate(id => ({ sicht: [...document.querySelectorAll("#t-" + id + " .eu-uebersicht .eu-kachel")].filter(k => k.getClientRects().length).length,
      leer: !document.querySelector("#t-" + id + " .eu-nichts").hidden, ab: [...document.querySelectorAll("#t-" + id + " .eu-abschnitt")].filter(a => a.getClientRects().length).length }), id);
    pruef(t2.sicht === 0 && t2.leer && t2.ab === 0, name + ": ohne Treffer ein Satz, keine leeren Abschnitte", JSON.stringify(t2));
    await p.fill("#" + suche, ""); await p.waitForTimeout(120);
    const t3 = await p.evaluate(AUFBAU, id);
    pruef(t3.kacheln === t3.gruppen && t3.klein === 0, name + ": Suche geleert → alle Kacheln wieder da", t3.kacheln + "/" + t3.gruppen);
    /* Zuletzt: echter Tipp auf die zweite Kachel, zurück, dann der Chip. */
    const ziel = t3.ids[1];
    await p.click('#t-' + id + ' .eu-kachel[data-eu-seite="' + ziel + '"]'); await p.waitForTimeout(250);
    await p.click("#t-" + id + " > .eu-zurueck"); await p.waitForTimeout(250);
    const z = await p.evaluate(([id, ziel]) => { const c = document.querySelector('#t-' + id + ' [data-eu-zuletzt="' + ziel + '"]'), r = c && c.getBoundingClientRect();
      return { da: !!c && !!c.getClientRects().length, h: r ? r.height : 0, kachel: !!(c && c.closest(".eu-kachel")), seite: !!(c && c.hasAttribute("data-eu-seite")),
        fokus: document.activeElement && document.activeElement.dataset.euSeite }; }, [id, ziel]);
    pruef(z.da && z.h >= 44 && !z.kachel && !z.seite, name + ": „Zuletzt geöffnet“ zeigt den Chip (≥ 44 px), keine zweite Kachel", JSON.stringify(z));
    pruef(z.fokus === ziel, name + ": Zurück setzt den Fokus auf die KACHEL, nicht auf den Chip", z.fokus);
    await p.click('#t-' + id + ' [data-eu-zuletzt="' + ziel + '"]'); await p.waitForTimeout(250);
    pruef(await p.evaluate(([id, ziel]) => document.getElementById("t-" + id).dataset.euOffen === ziel, [id, ziel]), name + ": Tipp auf den Chip öffnet genau diese Gruppe");
    const neu2 = await p.evaluate(() => JSON.parse(localStorage.getItem("omoteno-eu-zuletzt") || "{}"));
    pruef(Object.values(neu2).every(l => Array.isArray(l) && l.length <= 3), name + ": gemerkt höchstens drei je Reiter, nur auf diesem Gerät", JSON.stringify(neu2));
    pruef(!fehler.length, name + ": keine Laufzeitfehler", fehler[0] || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " Fehler" : "Alles sauber.") + " (" + n + " Proben)");
  process.exit(f ? 1 : 0);
})();
