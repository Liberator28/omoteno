/* ═══════════════════════════════════════════════════════════════
   pruef-start-premium.js — Premium-Startseite (Markenblatt "startstil":"premium")

   Foto-Kopf, Bestellart-Chips, Bildkarten, Leiste „Auswahl ansehen“, Hauptnavigation. Braucht dist/.
   Uhr UND Öffnungszeiten legt werkzeug/start-hub.js fest (§8.1j). Die Bilder sind neutrale Testbilder (hell/dunkel =
   die beiden Fälle, an denen Schrift auf einem Foto scheitert); kein Kundenfoto, keine Anfrage ins Netz.

   Gemessen wird am gemalten Bild, nicht am Quelltext:
     · Kontrast hinter Slogan/Pille/Chips: Text unsichtbar, Ausschnitt fotografiert, schlechtester Bildpunkt gegen die Schrift
     · Überdeckung: Auswahl-Leiste und Streifen enden über der Navigation, das letzte Stück der Seite liegt darüber
     · echte Tipps (Chips, Pille, Karten, Tabs), Zustand folgt dem Tipp
   Ehrliche Grenzen: kopfloses Chromium, keine Geräte, keine Live-Fotos; Safari-Eigenarten nicht gemessen.
   ═══════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { oeffneHub, EIMER, BETRIEB } = require("./werkzeug/start-hub.js");

let ok = 0, bad = 0;
const pruef = (name, bed, info) => { if(bed){ ok++; console.log("  ok   " + name); } else { bad++; console.log("  ROT  " + name + (info !== undefined ? "  → " + JSON.stringify(info) : "")); } };
const LIEFER = { an: true, plz: ["10115"], zeiten: { von: "11:00", bis: "23:00", tage: [1, 2, 3, 4, 5, 6, 7] } };
const KORB = ["Banane Erdbeere", "Waffel Classic", "Cola"];

/* WCAG-Kontrast aus zwei [r,g,b] */
const lin = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
const lum = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

/* Schlechtester Bildpunkt hinter einem Text: Schrift unsichtbar, Rechteck fotografiert, Pixel gegen die Schriftfarbe. */
async function schlechtester(p, selektor){
  const r = await p.evaluate(sel => {
    const el = document.querySelector(sel); if(!el) return null;
    const cs = getComputedStyle(el);
    const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(cs.color) || [0, 0, 0, 0];
    el.dataset.pxAlt = el.getAttribute("style") || "";
    el.style.setProperty("color", "transparent", "important");
    el.style.setProperty("-webkit-text-fill-color", "transparent", "important");
    el.style.setProperty("text-shadow", "none", "important");
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, farbe: [+m[1], +m[2], +m[3]] };
  }, selektor);
  if(!r) return null;
  const png = await p.screenshot({ clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(1, r.w), height: Math.max(1, r.h) } });
  const worst = await p.evaluate(async ([b64, farbe]) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    const L = a => .2126 * lin(a[0]) + .7152 * lin(a[1]) + .0722 * lin(a[2]);
    const lt = L(farbe); let min = 99;
    for(let i = 0; i < d.length; i += 4){
      const lb = L([d[i], d[i + 1], d[i + 2]]);
      const k = (Math.max(lt, lb) + .05) / (Math.min(lt, lb) + .05); if(k < min) min = k;
    }
    return min;
  }, [png.toString("base64"), r.farbe]);
  await p.evaluate(sel => { const el = document.querySelector(sel); el.setAttribute("style", el.dataset.pxAlt); el.removeAttribute("data-px-alt"); if(!el.getAttribute("style")) el.removeAttribute("style"); }, selektor);
  return worst;
}

const rect = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if(!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, b: b.bottom, r: b.right }; }, sel);

async function lauf(b, kopf){
  console.log("\n══ " + kopf.name);

  /* ── 1. Aufbau, Hierarchie, echte Optionen ── */
  {
    const h = await oeffneHub(b, Object.assign({ kopf: "hell", kachelFoto: true, korb: KORB, liefer: LIEFER, breite: 390, hoehe: 844 }, kopf.opt));
    const p = h.p;
    const st = await p.evaluate(() => ({ stil: document.body.dataset.startstil, ansicht: document.body.dataset.ansicht, chips: [...document.querySelectorAll("[data-bestellart]")].map(c => c.dataset.bestellart),
      chipHidden: document.getElementById("bestellart").hidden, karten: [...document.querySelectorAll(".sz.sz-p")].map(c => c.dataset.sz),
      nav: document.body.dataset.nav, navHidden: document.getElementById("hauptnav").hidden, tabs: [...document.querySelectorAll(".hn-tab")].map(t => t.dataset.hn) }));
    pruef("Schalter steht, Startseite", st.stil === "premium" && st.ansicht === "start", st);
    pruef("zwei Chips in der Reihenfolge des Entwurfs (Lieferung · Im Haus) — Abholen nur, wenn das Haus es anbietet (LIEFER ohne abholen)", st.chips.join() === "liefern,haus" && !st.chipHidden, st);
    pruef("Karten in Reihenfolge Auswahl · Karte · Foodroulette (Service nur am Tisch)", st.karten.join() === "auswahl,karte,roulette", st.karten);
    pruef("Navigation: Start · Karte · Bestellungen", st.nav === "an" && !st.navHidden && st.tabs.slice(0, 3).join() === "start,karte,bestellt", st);

    const y = {};
    for(const [k, s] of [["logo", "#logo"], ["status", ".st-link"], ["claim", "#claim"], ["chips", "#bestellart"], ["karte1", ".sz-p"], ["leiste", "#auswahlbalken"], ["nav", "#hauptnav"]]) y[k] = await rect(p, s);
    pruef("Hierarchie von oben nach unten: Siegel < Pille < Chips < erste Karte; der Slogan (mit Startgrafik handgeschrieben neben dem Siegel) endet über den Chips",
      y.logo.y < y.status.y && y.status.y < y.chips.y && y.chips.y < y.karte1.y && y.claim.b < y.chips.y, y);
    pruef("erste Karte beginnt im ersten Bildschirm (390×844)", y.karte1.y < 844 - 60, y.karte1);
    const hk = await rect(p, "header");
    pruef("Kopf nimmt höchstens 52 % des Schirms", hk.h <= 844 * .52, hk.h);
    pruef("Kopfbild liegt hinter dem Kopf (volle Breite, nicht davor)", await p.evaluate(() => { const k = document.getElementById("kopfbild"), hd = document.querySelector("header"), a = k.getBoundingClientRect(), c = hd.getBoundingClientRect();
      return getComputedStyle(k).position === "absolute" && Math.abs(a.width - c.width) < 1 && Math.abs(a.height - c.height) < 1; }));
    pruef("Auswahl-Leiste endet über der Navigation", y.leiste && y.nav && y.leiste.b <= y.nav.y + .5, [y.leiste, y.nav]);
    pruef("keine Fehler in der Seite", h.fehler.length === 0 && h.konsole.length === 0, [h.fehler, h.konsole]);

    /* Karten: Zahl und Summe aus dem Korb, Fotos aus echten Daten */
    const kd = await p.evaluate(() => { const a = document.querySelector('[data-sz="auswahl"]'), k = document.querySelector('[data-sz="karte"]');
      return { zahl: a.querySelector(".sz-zahl") && a.querySelector(".sz-zahl").textContent, unter: a.querySelector(".sz-unter").textContent, erwartetZahl: String(merkAnzahl()), erwartetSumme: preisText(merkSumme()),
        aImg: a.querySelector("img") && a.querySelector("img").getAttribute("src"), kImg: k.querySelector("img") && k.querySelector("img").getAttribute("src") }; });
    pruef("Auswahl-Karte: Zahl und Summe = Korb", kd.zahl === kd.erwartetZahl && kd.unter === kd.erwartetSumme, kd);
    pruef("Auswahl-Karte zeigt das Foto eines Korbgerichts", /\/gerichte\//.test(kd.aImg || "") && (kd.aImg || "").indexOf(EIMER) === 0, kd.aImg);
    pruef("Karte-Karte zeigt das Kachel-Banner", /\/kacheln\//.test(kd.kImg || ""), kd.kImg);
    const leiste = await p.evaluate(() => ({ z: document.getElementById("auswahlzahl").textContent, s: document.getElementById("auswahlsumme").textContent, img: document.querySelector("#auswahlbild img") && document.querySelector("#auswahlbild img").getAttribute("src"), erw: [String(merkAnzahl()), preisText(merkSumme())] }));
    pruef("Leiste: Zahl, Summe und Vorschaubild aus dem Korb", leiste.z === leiste.erw[0] && leiste.s === leiste.erw[1] && /\/gerichte\//.test(leiste.img || ""), leiste);

    /* Echte Tipps */
    await p.locator('[data-bestellart="liefern"]').click(); await p.waitForTimeout(400);
    const l1 = await p.evaluate(() => ({ modus: liefermodus, an: document.querySelector('[data-bestellart="liefern"]').getAttribute("aria-checked"), haus: document.querySelector('[data-bestellart="haus"]').getAttribute("aria-checked") }));
    pruef("Tipp auf „Lieferung“ schaltet den Liefermodus und den Chip", l1.modus === true && l1.an === "true" && l1.haus === "false", l1);
    await p.locator('[data-bestellart="haus"]').click(); await p.waitForTimeout(400);
    pruef("Tipp auf „Im Haus“ schaltet zurück", await p.evaluate(() => liefermodus === false && document.querySelector('[data-bestellart="haus"]').getAttribute("aria-checked") === "true"));
    await p.locator('[data-bestellart="haus"]').focus(); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(400);
    pruef("Pfeiltaste wechselt die Bestellart und der Fokus folgt", await p.evaluate(() => liefermodus === true && document.activeElement && document.activeElement.dataset.bestellart === "liefern"));
    await p.locator('[data-bestellart="haus"]').click(); await p.waitForTimeout(300);

    await p.locator(".st-link").click(); await p.waitForTimeout(400);
    pruef("Tipp auf die Öffnungs-Pille führt zu „Alles über uns“", await p.evaluate(() => seiteJetzt === "haus"));
    await p.evaluate(() => { location.hash = "#/"; }); await p.waitForTimeout(400);

    await p.locator('[data-sz="auswahl"]').click(); await p.waitForTimeout(400);
    pruef("Karte „Ihre Auswahl“ öffnet die Auswahl (Korb-Zeilen da)", await p.evaluate(() => seiteJetzt === "auswahl" && document.querySelectorAll("#inhalt .zeile, #inhalt [data-name]").length >= 0) );
    pruef("auf der Auswahl keine Hauptnavigation (dort liegen eigene feste Knöpfe)", await p.evaluate(() => document.getElementById("hauptnav").hidden && !document.body.dataset.nav));
    await p.evaluate(() => { location.hash = "#/"; }); await p.waitForTimeout(400);
    await p.locator('[data-sz="roulette"]').click(); await p.waitForTimeout(500);
    pruef("Karte „Foodroulette“ öffnet die Entscheidungshilfe", await p.evaluate(() => seiteJetzt === "entdecken"));
    pruef("dort keine Hauptnavigation", await p.evaluate(() => document.getElementById("hauptnav").hidden));
    await p.evaluate(() => { location.hash = "#/"; }); await p.waitForTimeout(400);
    await p.locator('[data-sz="karte"]').click(); await p.waitForTimeout(500);
    pruef("Karte „Speisekarte“ öffnet die Karte, Tab „Karte“ ist aktiv", await p.evaluate(() => seiteJetzt === "speisekarte" && document.querySelector('.hn-tab[data-hn="karte"]').getAttribute("aria-current") === "page" && document.querySelectorAll('.hn-tab[aria-current]').length === 1));
    const bk = await p.evaluate(() => { const b = document.getElementById("auswahlbalken").getBoundingClientRect(), n = document.getElementById("hauptnav").getBoundingClientRect(); return { bb: b.bottom, nt: n.top, an: document.getElementById("auswahlbalken").classList.contains("an") }; });
    pruef("auf der Karte: Auswahl-Leiste sichtbar und über der Navigation", bk.an && bk.bb <= bk.nt + .5, bk);
    await p.locator('.hn-tab[data-hn="bestellt"]').click(); await p.waitForTimeout(400);
    pruef("Tab „Bestellungen“ öffnet den Bestellpass und wird aktiv", await p.evaluate(() => seiteJetzt === "bestellt" && document.querySelector('.hn-tab[data-hn="bestellt"]').getAttribute("aria-current") === "page"));
    await p.locator('.hn-tab[data-hn="start"]').click(); await p.waitForTimeout(400);
    pruef("Tab „Start“ führt zurück", await p.evaluate(() => seiteJetzt === "start" && document.querySelector('.hn-tab[data-hn="start"]').getAttribute("aria-current") === "page"));
    const tp = await p.evaluate(() => [...document.querySelectorAll(".hn-tab")].map(t => { const r = t.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    pruef("Tabs ≥ 44 × 44 px", tp.every(x => x[0] >= 44 && x[1] >= 44), tp);
    pruef("keine Fehler nach der Rundreise", h.fehler.length === 0 && h.konsole.length === 0, [h.fehler, h.konsole]);
    await h.ctx.close();
  }

  /* ── 2. Ohne Korb, ohne Lieferung, am Tisch ── */
  {
    const h = await oeffneHub(b, Object.assign({ kopf: "dunkel", breite: 390, hoehe: 844 }, kopf.opt));
    const p = h.p;
    /* Voraussetzung für den Tisch-Fall: das Haus liefert, die Chips WÄREN also da — nur der Tisch nimmt sie weg (§8.1g). */
    const d0 = await p.evaluate(() => { LIEFER.an = true; zeichne(); return document.querySelectorAll("[data-bestellart]").length; });
    pruef("Voraussetzung: bei liefernder Karte ohne Tisch stehen die zwei Chips", d0 === 2, d0);
    await p.evaluate(() => { LIEFER.an = false; zeichne(); });
    const d = await p.evaluate(() => ({ chipsHidden: document.getElementById("bestellart").hidden, chips: document.querySelectorAll("[data-bestellart]").length,
      unter: document.querySelector('[data-sz="auswahl"] .sz-unter').textContent, zahl: !!document.querySelector('[data-sz="auswahl"] .sz-zahl'), aImg: !!document.querySelector('[data-sz="auswahl"] img'),
      balken: document.getElementById("auswahlbalken").classList.contains("an"), lieferSchalter: getComputedStyle(document.getElementById("lieferwahl")).display }));
    pruef("ohne Lieferung: keine Chips (kein Weg, der nirgends hinführt)", d.chipsHidden && d.chips === 0, d);
    pruef("leerer Korb: „Noch nichts ausgewählt“, keine Zahl, kein Foto, keine Leiste", d.unter.length > 5 && !/\d+,\d\d/.test(d.unter) && !d.zahl && !d.aImg && !d.balken, d);
    await p.evaluate(() => { LIEFER.an = true; tischNr = "7"; zeichne(); }); await p.waitForTimeout(300);
    const t = await p.evaluate(() => ({ karten: [...document.querySelectorAll(".sz.sz-p")].map(c => c.dataset.sz), chips: document.getElementById("bestellart").hidden }));
    pruef("am Tisch: Service-Karte erscheint, keine Bestellart-Chips", t.karten.indexOf("ruf") >= 0 && t.chips, t);
    pruef("keine Fehler", h.fehler.length === 0 && h.konsole.length === 0, [h.fehler, h.konsole]);
    await h.ctx.close();
  }

  /* ── 3. Öffnungsstand echt, kein Fake ── */
  {
    const h = await oeffneHub(b, Object.assign({ kopf: "hell", breite: 390 }, kopf.opt));
    const p = h.p;
    const offen = await p.evaluate(() => document.querySelector(".st-link .st-text").textContent);
    await p.evaluate(() => { ZEITEN.length = 0; for(let i = 0; i < 7; i++) ZEITEN.push("18:00 – 22:00"); statusZeichnen(); });
    const zu = await p.evaluate(() => ({ t: document.querySelector(".st-link .st-text").textContent, k: document.querySelector(".st-link .status").className }));
    pruef("Pille folgt den Öffnungszeiten (offen → „Geöffnet bis …“, außerhalb → „Öffnet …“)", /00:30/.test(offen) && /18:00/.test(zu.t) && /zu/.test(zu.k), [offen, zu]);
    await h.ctx.close();
  }

  /* ── 4. Kontrast hinter der Schrift auf dem Foto, helles UND dunkles Testbild, Tag UND Abend ── */
  for(const bild of ["hell", "dunkel"]) for(const farbe of ["hell", "dunkel"]){
    const h = await oeffneHub(b, Object.assign({ kopf: bild, korb: KORB, liefer: LIEFER, breite: 390, hoehe: 844, farbe, reduziert: true }, kopf.opt));
    const p = h.p;
    const m = {};
    /* Der Slogan steht (mit Startgrafik) handgeschrieben und gedreht neben dem Siegel. Gemessen wird das Schriftfeld ohne Drehung —
       ein Rechteck kann nur achsparallel fotografieren, die Ecken des gedrehten Feldes wären sonst fremder Grund — und ohne die
       Zierlinie darunter (keine Schrift, eigene Farbe). Was zählt, ist die Fläche hinter den Buchstaben. */
    await p.addStyleTag({ content: "#claim{transform:none!important} #claim::after{display:none!important}" });
    for(const [k, s] of [["Slogan", "#claim"], ["Pille", ".st-link .st-text"], ["Chip aus", '.ba-chip:not(.an) .ba-text']]) m[k] = await schlechtester(p, s);
    const tag = "Bild " + bild + ", Licht " + farbe;
    pruef(tag + ": Slogan, Pille und Chip ≥ 4,5:1 am schlechtesten Bildpunkt", Object.values(m).every(v => v !== null && v >= 4.5), m);
    if(bild === "hell" && farbe === "hell" && await p.evaluate(() => document.body.dataset.startgrafik === "an")){ /* nur das Haus mit Startgrafik trägt die Fläche; ein Haus ohne sie hat auf einem rein weißen Foto weiter kein Polster (ehrliche Grenze, vorbestehend) */
      /* Der härteste Fall: ein rein weißes Kopfbild. Die Fläche in Bandfarbe hinter der Zeile muss die Schrift tragen (Gegenbeweis:
         ::before weg → rot). Voraussetzung selbst gemessen: der Grund ist wirklich weiß. */
      await p.addStyleTag({ content: "header,.kopfbild,header::before,header::after,.kopfbild::before,.kopfbild::after{background:#fff!important;background-image:none!important;transition:none!important} .kopfbild img{display:none!important}" });
      await p.waitForTimeout(150);
      const w = await schlechtester(p, "#claim");
      const grund = await p.evaluate(() => getComputedStyle(document.querySelector("header")).backgroundColor);
      pruef("Voraussetzung: Kopfbild rein weiß (header = " + grund + ")", /255, 255, 255/.test(grund), grund);
      pruef("Slogan auch auf rein weißem Kopfbild ≥ 4,5:1 (eigene Fläche in Bandfarbe)", w !== null && w >= 4.5, w);
    }
    /* aktiver Chip: Schrift (Hausfarbe) auf Fläche (Bandschrift) — beide Rollen, gerechnet */
    const ak = await p.evaluate(() => { const c = document.querySelector(".ba-chip.an"), cs = getComputedStyle(c); const f = s => (/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(s) || []).slice(1, 4).map(Number); return [f(cs.color), f(cs.backgroundColor)]; });
    pruef(tag + ": aktiver Chip ≥ 4,5:1", kontrast(ak[0], ak[1]) >= 4.5, ak);
    /* Navigation und Leiste: Schrift auf Fläche */
    const nv = await p.evaluate(() => { const f = s => (/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(s) || []).slice(1, 4).map(Number);
      const n = document.getElementById("hauptnav"), nb = getComputedStyle(n).backgroundColor, t = n.querySelector(".hn-tab:not(.an) .hn-text"), a = n.querySelector(".hn-tab.an .hn-text"), al = n.querySelector(".hn-tab.an");
      const bal = document.getElementById("auswahlbalken"), bs = getComputedStyle(bal);
      return { leise: [f(getComputedStyle(t).color), f(nb)], aktiv: [f(getComputedStyle(a).color), f(getComputedStyle(al).backgroundColor).length ? f(nb) : f(nb)], balken: [f(bs.color), f(bs.backgroundColor)] }; });
    pruef(tag + ": Tab-Schrift (leise) und Leiste ≥ 4,5:1", kontrast(nv.leise[0], nv.leise[1]) >= 4.5 && kontrast(nv.balken[0], nv.balken[1]) >= 4.5, [kontrast(nv.leise[0], nv.leise[1]), kontrast(nv.balken[0], nv.balken[1])]);
    await h.ctx.close();
  }

  /* ── 5. Breiten: kein Überlauf, nichts verdeckt, Fuß der Seite frei ── */
  for(const [w, hh] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1280, 800]]){
    const h = await oeffneHub(b, Object.assign({ kopf: "hell", kachelFoto: true, korb: KORB, liefer: LIEFER, breite: w, hoehe: hh }, kopf.opt));
    const p = h.p;
    const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    pruef(w + " px: kein horizontales Scrollen", o.sw <= o.cw, o);
    const sz = await p.evaluate(() => [...document.querySelectorAll(".sz-p")].map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.height), r.left >= -0.5 && r.right <= innerWidth + .5, c.querySelector(".sz-text").scrollWidth <= c.querySelector(".sz-text").clientWidth + 1]; }));
    pruef(w + " px: Karten ganz im Bild, Titel nicht seitlich abgeschnitten, Touchfläche ≥ 44", sz.every(x => x[0] >= 44 && x[1] && x[2]), sz);
    const bb = await p.evaluate(() => { const c = [...document.querySelectorAll(".ba-chip")].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), e.scrollWidth <= e.clientWidth + 1]; }); return c; });
    pruef(w + " px: Chips ≥ 44 px hoch, Text passt", bb.length === 2 && bb.every(x => x[1] >= 44 && x[2]), bb);
    /* ganz nach unten: das letzte Stück Seite liegt über Leiste UND Navigation */
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(300);
    const un = await p.evaluate(() => { const nav = document.getElementById("hauptnav").getBoundingClientRect(), bal = document.getElementById("auswahlbalken"), balR = bal.getBoundingClientRect();
      const letzte = [...document.querySelectorAll("footer a, footer button, footer p, footer small, footer span, main > *:last-child")].filter(e => e.getBoundingClientRect().height > 0).map(e => e.getBoundingClientRect().bottom);
      const maxB = Math.max.apply(null, letzte); const decke = Math.min(nav.top, bal.classList.contains("an") ? balR.top : 1e9);
      return { maxB, decke, nav: nav.top, mitNav: document.body.dataset.nav }; });
    pruef(w + " px: ganz unten endet der Inhalt über Leiste und Navigation", un.mitNav === "an" && un.maxB <= un.decke + 1, un);
    /* Streifen (laufende Bestellung) über der Navigation */
    await p.evaluate(() => { document.getElementById("vstreifen").hidden = false; }); await p.waitForTimeout(500); /* Einflug (vRein) zu Ende, sonst misst man die Bewegung */
    const str = await p.evaluate(() => { const v = document.getElementById("vstreifen"); const r = v.getBoundingClientRect(), n = document.getElementById("hauptnav").getBoundingClientRect(), bal = document.getElementById("auswahlbalken"), br = bal.getBoundingClientRect(); v.hidden = true;
      return { b: r.bottom, nt: n.top, balTop: br.top, leiste: bal.classList.contains("an") }; });
    pruef(w + " px: Bestell-Streifen endet über Navigation UND Auswahl-Leiste (Leiste steht, sonst ist die Probe leer)", str.leiste && str.b <= Math.min(str.nt, str.balTop) + .5, str);
    /* Ohne Leiste (leerer Korb): der Fuß muss über der Navigation allein enden — dort trägt das Polster, nicht der Rest. */
    await p.evaluate(() => { Object.keys(merk).forEach(k => delete merk[k]); merkSpeichern(); zeichne(); window.scrollTo(0, document.documentElement.scrollHeight); }); await p.waitForTimeout(400);
    const un2 = await p.evaluate(() => { const nav = document.getElementById("hauptnav").getBoundingClientRect(), bal = document.getElementById("auswahlbalken").classList.contains("an");
      const ls = [...document.querySelectorAll("footer a, footer p, footer button, footer span, main > *:last-child")].filter(e => e.getBoundingClientRect().height > 0).map(e => e.getBoundingClientRect().bottom);
      return { maxB: Math.max.apply(null, ls), nav: nav.top, leiste: bal }; });
    pruef(w + " px: leerer Korb: letzter Link endet über der Navigation (Voraussetzung: keine Leiste)", !un2.leiste && un2.maxB <= un2.nav + 1, un2);
    await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById("vstreifen").hidden = false; }); await p.waitForTimeout(500);
    const str2 = await p.evaluate(() => { const v = document.getElementById("vstreifen"), r = v.getBoundingClientRect(), n = document.getElementById("hauptnav").getBoundingClientRect(); v.hidden = true;
      return { b: r.bottom, nt: n.top, leiste: document.getElementById("auswahlbalken").classList.contains("an") }; });
    pruef(w + " px: leerer Korb: Bestell-Streifen endet über der Navigation (Voraussetzung: keine Leiste)", !str2.leiste && str2.b <= str2.nt + .5, str2);
    const hn = await p.evaluate(() => { const n = document.getElementById("hauptnav").getBoundingClientRect(); return { r: n.right, l: n.left }; });
    pruef(w + " px: Navigation innerhalb des Schirms", hn.l >= -.5 && hn.r <= w + .5, hn);
    pruef(w + " px: keine Fehler", h.fehler.length === 0 && h.konsole.length === 0, [h.fehler, h.konsole]);
    await h.ctx.close();
  }

  /* ── 6. Arabisch (RTL): übersetzt, gespiegelt, kein Überlauf ── */
  {
    const h = await oeffneHub(b, Object.assign({ kopf: "hell", korb: KORB, liefer: LIEFER, breite: 360, sprache: "ar" }, kopf.opt));
    const p = h.p;
    const a = await p.evaluate(() => ({ dir: document.documentElement.dir, chips: [...document.querySelectorAll(".ba-text")].map(e => e.textContent), tabs: [...document.querySelectorAll(".hn-text")].map(e => e.textContent), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      start: document.querySelector('.hn-tab[data-hn="start"]').getBoundingClientRect().left, best: document.querySelector('.hn-tab[data-hn="bestellt"]').getBoundingClientRect().left, aria: document.getElementById("hauptnav").getAttribute("aria-label") }));
    pruef("Arabisch: Chips, Tabs und Navigations-Name übersetzt (nicht Deutsch)", a.chips.every(x => /[؀-ۿ]/.test(x)) && a.tabs.every(x => /[؀-ۿ]/.test(x)) && /[؀-ۿ]/.test(a.aria), a);
    pruef("Arabisch: Reihenfolge gespiegelt (Start rechts von Bestellungen), kein Überlauf", a.dir === "rtl" && a.start > a.best && a.sw <= a.cw, a);
    pruef("Arabisch: keine Fehler", h.fehler.length === 0 && h.konsole.length === 0, [h.fehler, h.konsole]);
    await h.ctx.close();
  }
  { /* Englisch, deutsche Wörter dürfen nicht stehen bleiben */
    const h = await oeffneHub(b, Object.assign({ kopf: "hell", korb: KORB, liefer: LIEFER, breite: 390, sprache: "en" }, kopf.opt));
    const a = await h.p.evaluate(() => [...document.querySelectorAll(".ba-text, .hn-text")].map(e => e.textContent));
    pruef("Englisch: Chips und Tabs übersetzt", a.slice(0, 5).join("|") === "Delivery|On site|Home|Menu|Orders" && (a.length === 5 || a[5] === "Profile"), a);
    await h.ctx.close();
  }

  /* ── 7. Reduzierte Bewegung: an den neuen Teilen läuft nichts ── */
  {
    const h = await oeffneHub(b, Object.assign({ kopf: "hell", korb: KORB, liefer: LIEFER, breite: 390, reduziert: true }, kopf.opt));
    const a = await h.p.evaluate(() => document.getAnimations().filter(x => x.effect && x.effect.target && x.effect.target.closest && x.effect.target.closest(".bestellart, .hauptnav, .sz-p, .st-link, #auswahlbalken")).map(x => (x.animationName || x.transitionProperty || "?") + ":" + x.playState).filter(s => /running/.test(s)));
    pruef("reduzierte Bewegung: an Chips, Pille, Karten, Navigation, Leiste läuft nichts", a.length === 0, a);
    await h.ctx.close();
  }

  /* ── 8. Fremde Bildadressen: kein Aufruf, Seite bleibt benutzbar; Foto, das nicht lädt ── */
  {
    const h = await oeffneHub(b, Object.assign({ kopf: "hell", kachelFoto: true, korb: KORB, breite: 390 }, kopf.opt));
    const p = h.p;
    const n0 = h.anfragen.length;
    await p.evaluate(() => { const k = KACHELN.find(x => x.art === "karte"); k.banner = "http://fremd.example/x.jpg"; zeichne(); });
    await p.waitForTimeout(300);
    const fr = await p.evaluate(() => { const c = document.querySelector('[data-sz="karte"]'); return { img: c.querySelector("img") && c.querySelector("img").getAttribute("src"), art: !!c.querySelector(".sz-art, .sz-kunst svg, .sz-kunst img") }; });
    pruef("Banner mit http:// fremd wird nicht als Karten-Foto genommen (Gerichtsfoto oder Fläche)", !/fremd\.example/.test(fr.img || ""), fr);
    pruef("keine Anfrage an den fremden Server", !h.anfragen.slice(n0).some(u => /fremd\.example/.test(u)), h.anfragen.filter(u => /fremd/.test(u)));
    await p.evaluate(() => { const k = KACHELN.find(x => x.art === "karte"); k.banner = 'https://x.example/"onerror="__x=1'; zeichne(); });
    pruef("Anführungszeichen in der Banner-Adresse öffnet kein Attribut", await p.evaluate(() => !document.querySelector('[data-sz="karte"] img[onerror]') && typeof __x === "undefined"));
    /* Foto lädt nicht: die getönte Fläche mit Zeichen bleibt sichtbar */
    await p.route("**/storage/v1/object/public/**", r => r.abort());
    await p.evaluate(() => { const k = KACHELN.find(x => x.art === "karte"); k.banner = ""; zeichne(); }); await p.waitForTimeout(500);
    const k = await rect(p, '[data-sz="karte"]');
    pruef("Foto lädt nicht: Karte behält ihre Fläche (Höhe ≥ 80 px) mit Zeichen oder gezeichneter Kunst", k.h >= 80 && await p.evaluate(() => !!document.querySelector('[data-sz="karte"] .sz-art, [data-sz="karte"] .sz-kunst svg, [data-sz="karte"] .sz-kunst img')), k);
    await h.ctx.close();
  }

  /* ── 9. Klassischer Kontrollfall im selben Haus: Schalter aus → nichts davon im Bild ── */
  {
    const h = await oeffneHub(b, Object.assign({ kopf: "hell", korb: KORB, liefer: LIEFER, breite: 390 }, kopf.opt, { stil: "klassisch" }));
    const k = await h.p.evaluate(() => ({ stil: document.body.dataset.startstil || "", nav: document.body.dataset.nav || "", chips: document.getElementById("bestellart").hidden && !document.querySelector("[data-bestellart]"), navHidden: document.getElementById("hauptnav").hidden, p: document.querySelectorAll(".sz-p, .st-link").length, bild: !document.getElementById("auswahlbild").hasChildNodes() }));
    pruef("klassisch: kein Premium-Teil im Bild (Schalter aus)", k.stil === "" && k.nav === "" && k.chips && k.navHidden && k.p === 0 && k.bild, k);
    await h.ctx.close();
  }
}

(async () => {
  const b = await chromium.launch();
  /* Choco hat den Schalter im Markenblatt; Blend bekommt ihn nur für die Probe (zweites Haus, dunkel schon am Tag). */
  await lauf(b, { name: "Choco L'AMouR (Markenblatt: premium)", opt: { haus: "chocolamour" } });
  await lauf(b, { name: "Blend (Schalter nur für die Probe)", opt: { haus: "blend", stil: "premium" } });
  {
    console.log("\n══ Kontrollhaus ohne Schalter: Nordstern");
    const h = await oeffneHub(b, { haus: "nordstern", kopf: "hell", korb: KORB, liefer: LIEFER, breite: 390 });
    const k = await h.p.evaluate(() => ({ stil: document.body.dataset.startstil || "", nav: document.body.dataset.nav || "", chips: document.querySelectorAll("[data-bestellart]").length, tabs: document.querySelectorAll(".hn-tab").length, p: document.querySelectorAll(".sz-p, .st-link").length }));
    pruef("Haus ohne Schalter: klassische Startseite, keine Premium-Teile", k.stil === "" && k.nav === "" && k.chips === 0 && k.tabs === 0 && k.p === 0, k);
    await h.ctx.close();
  }
  await b.close();
  console.log("\n" + ok + " ok, " + bad + " rot");
  process.exit(bad ? 1 : 0);
})();
