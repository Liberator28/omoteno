/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Kopfzeile mittig, Sprachknopf nur als Symbol

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-kopf.js

   Wunsch (30.09.): „alles eher mittig", Platz sparen — der Sprachknopf
   zeigt nicht mehr „Deutsch ▾", sondern nur den Globus. Welche Sprache
   gilt, sieht man in der offenen Liste (Haken), und ein Vorlese-
   programm hört es über das aria-label.

   Gemessen, nicht angesehen, in allen Häusern und bei 320–1280 px:
   - Die Knopfzeile (.kopfwahl) steht in der Mitte des Kopfes (± 1 px),
     auch in Arabisch (RTL) — dort dreht sich nur die Reihenfolge.
   - Sprachknopf ist ein Kreis: ≤ 48 px breit, ≥ 44 px Tapfläche, und
     trägt keinen sichtbaren Text mehr.
   - Lichtknopf bleibt auch bei 320 px sichtbar und ≥ 44 px.
   - Nichts in der Zeile läuft seitlich aus dem Bild; die offene Liste
     liegt ganz im sichtbaren Bereich.
   - aria-label nennt die aktive Sprache und folgt dem Wechsel
     (übersetzt: „Language: English").
   - Die offene Liste markiert genau die aktive Sprache — aria-checked
     UND sichtbar (Haken im ::before, Farbe verschieden vom Nachbarn).

   Gegenbeweis gefahren (git worktree, §8.1k): justify-self:center an
   .kopfwahl zurück auf end → „Mitte" rot in jedem Haus; der Haken
   (::before) entfernt → „sichtbar markiert" rot; die aria-label-Zeile
   in zeichne() entfernt → „folgt dem Wechsel" rot.
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


async function oeffnen(browser, haus, breite, sprache) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 800 } });
  await ctx.addInitScript(sp => {
    try {
      sessionStorage.setItem("omoteno-willkommen", "1");
      if (sp) localStorage.setItem("tapto-sprache", sp);
    } catch (e) {}
  }, sprache || null);
  const seite = await ctx.newPage();
  const fehler = [];
  seite.on("pageerror", e => fehler.push(String(e)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + path.join(DIST, haus, "index.html"));
  await seite.waitForTimeout(500);
  if (await seite.$("#willkommen")) { await seite.click("#willkommen").catch(() => {}); await seite.waitForTimeout(600); }
  if (sprache && VORFUEHRHAUS(haus)) { await seite.evaluate(sp => { spracheSetzen(sp); zeichne(); }, sprache); await seite.waitForTimeout(300); }
  return { seite, ctx, fehler };
}

(async () => {
  const browser = await chromium.launch();
  pruef(HAEUSER.length >= 2, "mindestens zwei Häuser erzeugt (§8.1a)", HAEUSER.join(", "));

  let lieferGesehen = false;
  for (const haus of HAEUSER) {
    for (const breite of [320, 360, 390, 430, 1280]) {
      const { seite, ctx, fehler } = await oeffnen(browser, haus, breite);
      const m = await seite.evaluate(() => {
        const r = el => el.getBoundingClientRect();
        const kopf = document.querySelector("header"), wahl = document.querySelector(".kopfwahl");
        const sk = document.getElementById("sprachknopf"), lk = document.getElementById("lichtknopf");
        const zeile = Array.from(wahl.children).filter(el => getComputedStyle(el).display !== "none" && !el.hidden);
        const links = Math.min(...zeile.map(el => r(el).left)), rechts = Math.max(...zeile.map(el => r(el).right));
        return {
          kopfMitte: r(kopf).left + r(kopf).width / 2,
          zeileMitte: (links + rechts) / 2, links, rechts,
          sk: { w: r(sk).width, h: r(sk).height, text: sk.innerText.trim() },
          lk: { w: r(lk).width, h: r(lk).height, sichtbar: getComputedStyle(lk).display !== "none" },
          label: sk.getAttribute("aria-label") || "",
          ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      const k = haus + " @" + breite;
      /* Seit 17.10. (Foto 12.10.): Öffnungsstand als Glas-Pille UNTER
         dem Siegel, die Knopfzeile (Licht/Bestellart/Sprache) fest oben
         rechts an der Spalte (≤ 540 px). Nur der Ort, nicht die Länge
         (§8.1j). Sie deckt weder Siegel, Name, Stand noch Slogan. */
      const lage = await seite.evaluate(() => {
        const r = el => el.getBoundingClientRect();
        const st = document.getElementById("status"), pille = st && st.firstElementChild;
        const logo = document.getElementById("logo"), wahl = document.querySelector(".kopfwahl");
        const w = r(wahl), lo = r(logo), p = pille ? r(pille) : null;
        const spalteR = Math.min(innerWidth, (innerWidth + 540) / 2);
        const deckt = ["logo", "titel", "status", "claim"].map(id => {
          const el = document.getElementById(id); if (!el || getComputedStyle(el).display === "none") return null;
          const b = id === "status" && pille ? r(pille) : r(el);
          if (!b.width || !b.height) return null;
          const ueber = Math.min(b.right, w.right) - Math.max(b.left, w.left) > 0 && Math.min(b.bottom, w.bottom) - Math.max(b.top, w.top) > 0;
          return ueber ? id : null;
        }).filter(Boolean);
        return { inZeile: !!st && wahl.contains(st), text: st ? st.textContent.trim() : "",
                 pMitte: p ? p.left + p.width / 2 : null, lMitte: lo.left + lo.width / 2, pOben: p ? p.top : null, lUnten: lo.bottom,
                 fest: getComputedStyle(wahl).position, oben: w.top, rechts: w.right, soll: spalteR - 8, deckt };
      });
      pruef(!lage.inZeile && lage.text.length > 0 && lage.pMitte !== null && Math.abs(lage.pMitte - lage.lMitte) <= 2 && lage.pOben >= lage.lUnten - 1,
        k + ": Öffnungsstand mittig unter dem Siegel, nicht in der Knopfzeile", JSON.stringify(lage));
      pruef(lage.fest === "fixed" && lage.oben <= 12 && Math.abs(lage.rechts - lage.soll) <= 2,
        k + ": Knopfzeile fest oben rechts an der Spalte",
        lage.fest + " oben " + lage.oben.toFixed(1) + " rechts " + lage.rechts.toFixed(1) + " / soll " + lage.soll.toFixed(1));
      if (breite === 320) lieferGesehen = lieferGesehen || await seite.evaluate(() => {
        const l = document.querySelector(".kopfwahl .lieferwahl"); return !!l && getComputedStyle(l).display !== "none" && l.getBoundingClientRect().width > 0;
      });
      pruef(lage.deckt.length === 0, k + ": Knopfzeile deckt weder Siegel, Name, Stand noch Slogan", lage.deckt.join(", ") || "frei");
      pruef(m.sk.w <= 48 && m.sk.w >= 44 && m.sk.h >= 44, k + ": Sprachknopf ist ein Kreis 44–48 px",
        m.sk.w.toFixed(1) + "×" + m.sk.h.toFixed(1));
      pruef(m.sk.text === "", k + ": Sprachknopf zeigt keinen Sprachnamen", JSON.stringify(m.sk.text));
      pruef(m.lk.sichtbar && m.lk.w >= 44 && m.lk.h >= 44, k + ": Lichtknopf sichtbar, ≥ 44 px",
        m.lk.w.toFixed(1) + "×" + m.lk.h.toFixed(1));
      pruef(m.links >= 0 && m.rechts <= breite && m.ueber <= 0, k + ": nichts läuft seitlich über",
        "links " + m.links.toFixed(1) + " rechts " + m.rechts.toFixed(1) + " Überlauf " + m.ueber);
      pruef(/Deutsch/.test(m.label), k + ": aria-label nennt die Sprache", m.label);

      if (breite === 360) {
        await seite.click("#sprachknopf");
        await seite.waitForTimeout(450);
        const liste = await seite.evaluate(() => {
          const l = document.getElementById("sprachliste"), r = l.getBoundingClientRect();
          const an = l.querySelector('[aria-checked="true"]'), aus = l.querySelector('[aria-checked="false"]');
          const vor = an ? getComputedStyle(an.querySelector(".kurz"), "::before").content : "";
          return {
            offen: document.getElementById("sprachwahl").classList.contains("offen"),
            links: r.left, rechts: r.right, breite: innerWidth,
            aktiv: l.querySelectorAll('[aria-checked="true"]').length,
            aktivCode: an ? an.dataset.sprache : null,
            haken: vor, farbeAn: an ? getComputedStyle(an).color : "", farbeAus: aus ? getComputedStyle(aus).color : "",
          };
        });
        pruef(liste.offen, k + ": Tipp auf den Globus öffnet die Liste");
        pruef(liste.links >= 0 && liste.rechts <= liste.breite, k + ": offene Liste ganz im Bild",
          liste.links.toFixed(1) + "…" + liste.rechts.toFixed(1));
        pruef(liste.aktiv === 1 && liste.aktivCode === "de", k + ": genau Deutsch ist markiert", liste.aktivCode);
        pruef(/✓/.test(liste.haken) && liste.farbeAn !== liste.farbeAus, k + ": aktive Sprache sichtbar markiert",
          liste.haken + " " + liste.farbeAn + " / " + liste.farbeAus);

        await seite.click('#sprachliste [data-sprache="en"]');
        await seite.waitForTimeout(400);
        const nach = await seite.evaluate(() => ({
          label: document.getElementById("sprachknopf").getAttribute("aria-label"),
          offen: document.getElementById("sprachwahl").classList.contains("offen"),
        }));
        pruef(nach.label === "Language: English", k + ": aria-label folgt dem Wechsel (übersetzt)", nach.label);
        pruef(!nach.offen, k + ": Liste schließt nach der Wahl");
      }
      pruef(fehler.length === 0, k + ": keine Ausnahme", fehler.join(" | ") || "still");
      await ctx.close();
    }

    /* RTL: gespiegelt oben links, Liste im Bild */
    const { seite, ctx, fehler } = await oeffnen(browser, haus, 390, "ar");
    const rtl = await seite.evaluate(() => {
      const w = document.querySelector(".kopfwahl").getBoundingClientRect();
      const spalteL = Math.max(0, (innerWidth - 540) / 2);
      return { dir: document.documentElement.dir, links: w.left, soll: spalteL + 8, oben: w.top,
               label: document.getElementById("sprachknopf").getAttribute("aria-label") };
    });
    pruef(rtl.dir === "rtl" && Math.abs(rtl.links - rtl.soll) <= 2 && rtl.oben <= 12, haus + " RTL: Knopfzeile fest oben links",
      rtl.dir + " links " + rtl.links.toFixed(1) + " / soll " + rtl.soll.toFixed(1) + " oben " + rtl.oben.toFixed(1));
    pruef(/العربية/.test(rtl.label), haus + " RTL: aria-label nennt Arabisch", rtl.label);
    await seite.click("#sprachknopf");
    await seite.waitForTimeout(450);
    const rl = await seite.evaluate(() => { const r = document.getElementById("sprachliste").getBoundingClientRect(); return [r.left, r.right, innerWidth]; });
    pruef(rl[0] >= 0 && rl[1] <= rl[2], haus + " RTL: offene Liste ganz im Bild", rl.map(x => x.toFixed(1)).join(" "));
    pruef(fehler.length === 0, haus + " RTL: keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  pruef(lieferGesehen, "320 px: mindestens ein Haus zeigt den Liefer-Schalter in der Knopfzeile (Voraussetzung der Breitenprobe)");

  /* ── Kachelname auf der Unterseite (Vorfall 07.10.) ─────────────
     Die Kachel „cocktails“ heißt im Board „Kaiser und Säfte“; die
     Seite dahinter muss genauso heißen — und darf die Vorgabe-
     Unterzeile („Hinter der Bar …“) nicht mehr tragen. Gegenfall: eine
     Kachel ohne eigenen Namen behält Titel und Unterzeile wie vorher.
     Zwei Häuser (§8.1a), dazu Englisch (Rahmen übersetzt, Name nicht). */
  for (const haus of HAEUSER.slice(0, 2)) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {} });
    const seite = await ctx.newPage();
    const fehler = [];
    seite.on("pageerror", e => fehler.push(String(e)));
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
      : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await seite.route("**/rest/v1/betriebe**", r => r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify([{ id: "11111111-2222-3333-4444-555555555555", bestell_pause: false, hub_texte: {},
        hub_kacheln: [{ schluessel: "speisekarte" },
                      { schluessel: "cocktails", titel: "Kaiser und Säfte" },
                      { schluessel: "getraenke", unter: "Frisch & kalt" }] }]) }));
    await seite.goto("file://" + path.join(DIST, haus, "index.html"));
    await seite.waitForTimeout(1500);
    const lies = async ziel => {
      await seite.evaluate(z => { location.hash = z; }, ziel);
      await seite.waitForTimeout(500);
      return seite.evaluate(() => ({
        h2: (document.querySelector("#inhalt .seite h2") || {}).textContent || "",
        unter: (document.querySelector("#inhalt .seite p.unter") || {}).textContent || "",
        kachel: Array.from(document.querySelectorAll("#inhalt .kachel")).map(k => k.textContent).join("|"),
      }));
    };
    const vor = await seite.evaluate(() => KACHELN.map(k => k.schluessel + ":" + k.titel).join(","));
    pruef(/cocktails:Kaiser und Säfte/.test(vor), haus + ": Voraussetzung — die Kachel trägt den eigenen Namen", vor);
    const c = await lies("#/cocktails");
    pruef(c.h2 === "Kaiser und Säfte", haus + ": Unterseite heißt wie die Kachel", c.h2);
    pruef(!/Hinter der Bar/.test(c.unter), haus + ": keine fremde Vorgabe-Unterzeile mehr", c.unter || "(keine)");
    const s2 = await lies("#/speisekarte");
    pruef(s2.h2 === "Speisekarte" && /Küche/.test(s2.unter), haus + ": unveränderte Kachel behält Titel und Unterzeile", s2.h2 + " / " + s2.unter);
    const g = await lies("#/getraenke");
    pruef(g.h2 === "Getränkekarte" && g.unter === "Frisch & kalt", haus + ": eigene Unterzeile allein wird übernommen", g.h2 + " / " + g.unter);
    await seite.evaluate(() => { spracheSetzen("en"); });
    const e = await lies("#/cocktails");
    pruef(e.h2 === "Kaiser und Säfte", haus + ": Englisch — eigener Name bleibt", e.h2);

    /* Zurück-Knopf: Glas-Pille „‹ Zurück“ (08.10., vorher rund ohne
       Text), ≥ 44 px, klebt beim Rollen, führt heim. Übersetzung und
       das umlaufende Licht prüft pruef-reise.js. */
    await seite.evaluate(() => { spracheSetzen("de"); location.hash = "#/speisekarte"; });
    await seite.waitForTimeout(500);
    const z = await seite.evaluate(() => {
      const b = document.getElementById("zurueck"), r = b.getBoundingClientRect();
      return { an: b.classList.contains("an"), w: r.width, h: r.height, text: b.querySelector(".zr-text").textContent.trim(),
               label: b.getAttribute("aria-label"), oben: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b
                 || b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) };
    });
    pruef(z.an && z.w >= 44 && z.h >= 44 && z.text === "Zurück", haus + ": Zurück ist eine Pille „Zurück“, ≥ 44 px",
      z.w.toFixed(0) + "×" + z.h.toFixed(0) + " " + JSON.stringify(z.text));
    pruef(z.label === "Zurück zur Übersicht" && z.oben, haus + ": beschriftet und obenauf (nichts deckt ihn)", z.label + " " + z.oben);
    /* 09.10. „Spare Text im Header — kompakt“: Auf der
       Unterseite ist der Kopf EINE Leiste — Siegel, Name und Knöpfe auf
       einer Höhe, ohne Adresse, Slogan und Öffnungsstand. Vorher ~270 px. */
    const leiste = await seite.evaluate(() => {
      const r = el => el.getBoundingClientRect();
      const mitte = el => { const b = r(el); return b.top + b.height / 2; };
      const sichtbar = el => !!el && getComputedStyle(el).display !== "none" && r(el).height > 0;
      const kopf = document.querySelector("header");
      const teile = [document.getElementById("logo"), document.getElementById("titel"), document.querySelector(".kopfwahl")];
      const m = teile.map(mitte);
      return { hoehe: Math.round(r(kopf).height), versatz: Math.round(Math.max(...m) - Math.min(...m)),
               claim: sichtbar(document.getElementById("claim")), status: sichtbar(document.getElementById("status")),
               titel: document.getElementById("titel").textContent,
               /* Der Name endet vor der festen Knopfzeile (seit 17.10.):
                  kein Buchstabe darunter, auch nicht abgeschnitten-überlappend. */
               titelEnde: r(document.getElementById("titel")).right, leisteAnfang: r(document.querySelector(".kopfwahl")).left };
    });
    pruef(leiste.titelEnde <= leiste.leisteAnfang + 0.5, haus + ": Unterseite — Name endet vor der Knopfzeile",
      leiste.titelEnde.toFixed(1) + " / " + leiste.leisteAnfang.toFixed(1));
    pruef(leiste.hoehe <= 120 && leiste.versatz <= 12 && !leiste.claim && !leiste.status && leiste.titel.length > 0,
      haus + ": Unterseite — Kopf ist eine flache Leiste (Siegel, Name, Knöpfe in einer Reihe, ohne Adresse/Slogan/Stand)",
      leiste.hoehe + " px hoch, Versatz " + leiste.versatz + " px, Slogan " + leiste.claim + ", Stand " + leiste.status);
    await seite.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 1500); });
    await seite.waitForTimeout(300);
    const kl = await seite.evaluate(() => {
      /* Klebt die Kategorie-Leiste, steht der Weg zurück IN ihr (seit
         10.10.; die schwebende Pille tritt dann zurück) — dann gilt dieser. */
      /* Seit 19.10.: Ist neben der Zentrale zu wenig Platz (html.kw-eng),
         klebt die Leiste eine Zeile tiefer und „Zurück“ bleibt die
         schwebende Pille oben — die in der Leiste ist dann ausgeblendet. */
      const eng = document.documentElement.classList.contains("kw-eng");
      const b = document.body.classList.contains("kat-klebt") && !eng ? document.querySelector("#inhalt .chip-zurueck")
                                                              : document.getElementById("zurueck"), r = b.getBoundingClientRect();
      const mitte = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { top: r.top, scroll: scrollY, oben: mitte === b || b.contains(mitte) };
    });
    pruef(kl.scroll > 500 && kl.top >= 0 && kl.top < 80 && kl.oben, haus + ": beim Rollen klebt er oben und bleibt antippbar",
      "scroll " + kl.scroll + " top " + kl.top.toFixed(0));
    await seite.click("#zurueck");
    await seite.waitForTimeout(500);
    const heim = await seite.evaluate(() => ({ hash: location.hash, start: seiteJetzt }));
    pruef(heim.start === "start", haus + ": Tipp führt zur Übersicht", JSON.stringify(heim));
    pruef(fehler.length === 0, haus + ": keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  if (f) { console.log(f + " FEHL"); process.exit(1); }
  console.log("Alles sauber.");
})();
