/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Rabatt direkt am Gericht (Wunsch 07.10.)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-rabatt-gericht.js   (braucht dist/)

   „Speisen direkt rabattieren, und es wird in der Speisekarte
   angezeigt.“ Kein zweites Rabattsystem: Das Gericht-Blatt schreibt
   eine Zeile in aktionen — dieselbe Tabelle wie „Aktion starten“, die
   der Server beim Bestellen ohnehin nachrechnet.

   Board (Vorführmodus, dann mit gestelltem Speicher):
   1 · Neues Gericht: Hinweis „erst speichern“, keine Eingabe.
   2 · Vorhandenes: Prozent → Vorschau nennt neuen Preis; 100 % und ein
       Preis über dem alten sperren „Rabatt starten“.
   3 · Starten legt die Zeile an (gericht_id, Preis, Dauer heute /
       7 Tage / 365 Tage), die Kartenliste trägt „−20 %“, der Satz unter
       „Mehr Angaben“ auch; Beenden nimmt alles zurück.
   4 · Was in die Tabelle geht, hält jede Schranke der Tabelle ein
       (zweite Quelle: datenbank/stand-aktionen-schranken.sql, gelesen
       aus pg_constraint).
   Hub (gestellte aktionen-Antwort):
   5 · Die Karte zeigt neuen Preis, alten gestrichen, „−20 %“; ein
       Aktionspreis ÜBER dem Kartenpreis zeigt nichts.
   6 · „+“ legt zum Aktionspreis in den Korb; endet die Aktion, zieht der
       Korb auf den Kartenpreis nach.
   7 · Kurzer Rabatt steht im Streifen oben, ein Dauer-Rabatt nur in
       der Karte; die Restzeit sagt „Tage“, nicht „8760 Stunden“.
   8 · Die Plakette ist lesbar (≥ 4,5:1) in jedem Haus, Tag und Abend.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN  = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const HUB   = slug => path.join(OBEN, "dist", slug, "index.html");
const SCHRANKEN = path.join(OBEN, "datenbank", "stand-aktionen-schranken.sql");
const BID = "af095b14-d9ef-41f4-9b97-c4422b0de63f";

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

/* Kontrast nach WCAG, mit Deckkraft über dem Grund gemischt. */
const KONTRAST = `
  function rgb(t){ const m = t.match(/[\\d.]+/g).map(Number); return { r:m[0], g:m[1], b:m[2], a: m.length > 3 ? m[3] : 1 }; }
  function misch(o, u){ return { r:o.r*o.a + u.r*(1-o.a), g:o.g*o.a + u.g*(1-o.a), b:o.b*o.a + u.b*(1-o.a), a:1 }; }
  function lum(c){ const k = v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); }; return .2126*k(c.r) + .7152*k(c.g) + .0722*k(c.b); }
  function grundVon(el){ const ebenen = []; for(let e = el; e; e = e.parentElement){ const c = rgb(getComputedStyle(e).backgroundColor); if(c.a > 0) ebenen.push(c); if(c.a >= 1) break; }
    let g = rgb(getComputedStyle(document.documentElement).backgroundColor); if(g.a < 1) g = { r:255, g:255, b:255, a:1 };
    for(let i = ebenen.length - 1; i >= 0; i--) g = misch(ebenen[i], g); return g; }
  function kontrast(el){ const g = grundVon(el), s = misch(rgb(getComputedStyle(el).color), g); const a = lum(g), b = lum(s); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); }
`;

async function board(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 } });
  const seite = await ctx.newPage();
  const kons = [];
  seite.on("pageerror", e => kons.push(String(e).slice(0, 300)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(700);
  await seite.evaluate(() => {
    document.getElementById("tor").hidden = true;
    demoStarten(); zeichneAlles();
    const sch = document.getElementById("scharf"); if (sch) sch.hidden = true;
    document.querySelector('[data-tafel="speisekarte"]').click();
  });
  await seite.waitForTimeout(400);
  return { ctx, seite, kons };
}

(async () => {
  if (!fs.existsSync(HUB("chocolamour"))) { console.log("Kein dist/ — erst node erzeuger/erzeuge-hub.js --alle"); process.exit(1); }
  const browser = await chromium.launch();

  console.log("\n══ Board: Rabatt im Gericht-Blatt ══");
  {
    const { ctx, seite, kons } = await board(browser);
    await seite.click("#neuesGericht"); await seite.waitForTimeout(300);
    await seite.click("#mehrAuf"); await seite.waitForTimeout(350);
    const neu = await seite.evaluate(() => ({ erst: !document.getElementById("rbErst").hidden, eingabe: !document.getElementById("rbNeu").hidden }));
    pruef(neu.erst && !neu.eingabe, "neues Gericht: „erst speichern“, keine Eingabe");
    await seite.click("#abbrechen"); await seite.waitForTimeout(400);

    const g = await seite.evaluate(() => { const g = gerichte.find(x => x.preis > 2 && inKarte(x, welcheKarte)); blattOeffnen(g); return { id: g.id, name: g.name, preis: g.preis }; });
    await seite.waitForTimeout(300);
    await seite.click("#mehrAuf"); await seite.waitForTimeout(350);
    await seite.evaluate(() => document.getElementById("rbBlock").scrollIntoView({ block: "center" }));
    let z = await seite.evaluate(() => ({ erst: !document.getElementById("rbErst").hidden, eingabe: !document.getElementById("rbNeu").hidden,
      gesperrt: document.getElementById("rbStarten").disabled }));
    pruef(!z.erst && z.eingabe && z.gesperrt, "vorhandenes Gericht: Eingabe da, ohne Wert gesperrt", JSON.stringify(z));

    await seite.fill("#rbWert", "20"); await seite.waitForTimeout(80);
    const erwartet = Math.round(g.preis * 0.8 * 100) / 100;
    const vorschau = await seite.$eval("#rbVorschau", el => el.textContent);
    pruef(vorschau.includes(erwartet.toFixed(2).replace(".", ",")) && /−20 %/.test(vorschau), "20 % → Vorschau nennt den neuen Preis", vorschau);
    await seite.fill("#rbWert", "100"); await seite.waitForTimeout(80);
    pruef(await seite.$eval("#rbStarten", b => b.disabled), "100 % sperrt");
    await seite.click('[data-rb-art="preis"]'); await seite.waitForTimeout(80);
    await seite.fill("#rbWert", String(g.preis + 1).replace(".", ",")); await seite.waitForTimeout(80);
    pruef(await seite.$eval("#rbStarten", b => b.disabled), "neuer Preis über dem alten sperrt");
    const segH = await seite.$$eval("#rbArt button, #rbDauer button", l => l.map(b => ({ h: b.getBoundingClientRect().height, ueber: b.scrollWidth > b.clientWidth + 1 })));
    pruef(segH.every(x => x.h >= 44 && !x.ueber), "Segmente ≥ 44 px, kein Text läuft über (390 px)", JSON.stringify(segH));
    await seite.click('[data-rb-art="prozent"]'); await seite.fill("#rbWert", "20"); await seite.waitForTimeout(80);

    const dauer = {};
    for (const [wahl, tage] of [["heute", 0], ["woche", 7], ["offen", 365]]) {
      await seite.click('[data-rb-dauer="' + wahl + '"]');
      await seite.fill("#rbWert", "20"); await seite.waitForTimeout(60);
      await seite.click("#rbStarten"); await seite.waitForTimeout(250);
      const a = await seite.evaluate(id => { const a = aktionen.find(x => x.gericht_id === id); return a ? { ...a } : null; }, g.id);
      dauer[wahl] = a;
      if (wahl === "heute") {
        const st = await seite.evaluate(() => ({ laeuft: !document.getElementById("rbLaeuft").hidden, eingabe: !document.getElementById("rbNeu").hidden,
          stand: document.getElementById("rbStand").textContent, satz: document.getElementById("mehrStand").textContent }));
        pruef(a && a.preis_neu === erwartet && a.preis_alt === g.preis && a.gericht_name === g.name, "Starten legt die Zeile an (Preis, Name, gericht_id)", a && (a.preis_alt + " → " + a.preis_neu));
        pruef(st.laeuft && !st.eingabe && /statt/.test(st.stand), "Blatt zeigt den laufenden Rabatt statt der Eingabe", st.stand);
        pruef(/Rabatt −20 %/.test(st.satz), "Satz unter „Mehr Angaben“ nennt ihn", st.satz);
        await seite.click("#abbrechen"); await seite.waitForTimeout(400);
        /* Liste (.gzeile/.rbmarke) UND Kacheln (.kr-kachel/.kr-marke): beide tragen die Plakette. */
        const marke = await seite.evaluate(name => { const z = [...document.querySelectorAll(".gzeile, .kr-kachel")].find(x => (x.querySelector(".gname, .kr-name") || {}).textContent === name);
          const t = z ? [...z.querySelectorAll(".rbmarke, .kr-marke")].map(m => m.textContent).find(x => /^−\d+ %$/.test(x)) : ""; return t || ""; }, g.name);
        pruef(marke === "−20 %", "Kartenliste im Board trägt „−20 %“", marke);
        await seite.evaluate(id => blattOeffnen(gerichte.find(x => x.id === id)), g.id); await seite.waitForTimeout(300);
        await seite.click("#mehrAuf"); await seite.waitForTimeout(350);
      }
      const ende = a ? new Date(a.bis) : null, jetzt = new Date();
      const tageBis = ende ? (ende - jetzt) / 864e5 : -1;
      pruef(a && (tage === 0 ? ende.getDate() === jetzt.getDate() && ende.getHours() === 23 : Math.abs(tageBis - tage) < 0.01),
        "Dauer „" + wahl + "“ endet richtig", ende ? ende.toISOString() : "keine Zeile");
      await seite.evaluate(() => document.getElementById("rbBlock").scrollIntoView({ block: "center" }));
      await seite.click("#rbEnde"); await seite.waitForTimeout(250);
      const weg = await seite.evaluate(id => ({ da: aktionen.some(x => x.gericht_id === id), eingabe: !document.getElementById("rbNeu").hidden }), g.id);
      pruef(!weg.da && weg.eingabe, "Beenden nimmt den Rabatt zurück (" + wahl + ")");
    }

    /* 4 · Was in die Tabelle geht, gegen die Schranken der Tabelle */
    const schranken = fs.readFileSync(SCHRANKEN, "utf8");
    const gesendet = await seite.evaluate(async id => {
      const log = [];
      demo = false; betriebId = "b-probe";
      db = { from: tab => ({
        insert: async zeile => { log.push({ tab, zeile }); return { error: null }; },
        update: () => ({ eq: async () => ({ error: null }) }),
        select: () => ({ eq: () => ({ gte: () => ({ order: () => ({ order: async () => ({ data: [], error: null }) }) }) }) }) }) };
      document.getElementById("rbWert").value = "15"; document.getElementById("rbWert").dispatchEvent(new Event("input"));
      await document.getElementById("rbStarten").onclick();
      demo = true; db = null;
      return log;
    }, g.id);
    const z1 = gesendet[0] && gesendet[0].zeile;
    pruef(gesendet.length === 1 && gesendet[0].tab === "aktionen", "genau eine Zeile in aktionen", JSON.stringify(gesendet.map(x => x.tab)));
    if (z1) {
      const titel = String(z1.titel || "").trim();
      const pruefe = [
        ["aktionen_preis", z1.preis_neu < z1.preis_alt],
        ["aktionen_preis_alt_check", z1.preis_alt > 0],
        ["aktionen_preis_neu_check", z1.preis_neu >= 0],
        ["aktionen_titel_mass", titel.length >= 1 && titel.length <= 40],
        ["aktionen_zeit", new Date(z1.bis) > new Date(z1.von)],
      ];
      for (const [name, ok] of pruefe)
        pruef(schranken.includes(name) && ok, "Schranke " + name + " gehalten (und in der zweiten Quelle vorhanden)");
      const ueberzaehlig = pruefe.length === (schranken.match(/^aktionen_[a-z_]+\b/gm) || []).filter(x => !/fkey|pkey/.test(x)).length;
      pruef(ueberzaehlig, "keine Schranke der Tabelle ungeprüft", (schranken.match(/^aktionen_[a-z_]+\b/gm) || []).join(","));
      pruef(z1.betrieb_id === "b-probe" && z1.gericht_id === g.id, "Betrieb und gericht_id gesetzt");
    }
    pruef(kons.length === 0, "Board ohne Fehler", kons.join(" | "));
    await ctx.close();
  }

  for (const slug of ["chocolamour", "blend"]) {
    console.log("\n══ Hub " + slug + ": Rabatt in der Karte ══");
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const seite = await ctx.newPage();
    const kons = [];
    seite.on("pageerror", e => kons.push(String(e).slice(0, 300)));
    let antwort = [];
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue()
      : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await seite.route("**/rest/v1/betriebe**", r => r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify([{ id: BID, bestell_pause: false, hub_texte: {} }]) }));
    await seite.route("**/rest/v1/aktionen**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(antwort) }));
    await seite.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); localStorage.clear(); } catch (e) {} });
    await seite.goto("file://" + HUB(slug) + "#/speisekarte");
    await seite.waitForTimeout(1200);
    const drei = await seite.evaluate(() => {
      const alle = []; Object.values(SEITEN).length; // nur zum Wecken
      document.querySelectorAll(".gericht .ginfo").forEach(b => alle.push(decodeURIComponent(b.dataset.detail)));
      return alle.map(n => findeGericht(n)).filter(g => g && g.p !== "–" && preisNum(g.p) > 3).slice(0, 3).map(g => ({ n: g.n, p: preisNum(g.p) }));
    });
    pruef(drei.length === 3, "drei Gerichte mit Preis in der Karte", drei.map(x => x.n).join(" · "));
    if (drei.length < 3) { await ctx.close(); continue; }
    const [k, d, u] = drei;
    const neuK = Math.round(k.p * 0.8 * 100) / 100;
    antwort = [
      { id: "a-kurz", gericht_name: k.n, titel: "Top-Runner", preis_alt: k.p, preis_neu: neuK, bis: new Date(Date.now() + 3 * 3600e3).toISOString() },
      { id: "a-dauer", gericht_name: d.n, titel: "Top-Runner", preis_alt: d.p, preis_neu: Math.round(d.p * 0.9 * 100) / 100, bis: new Date(Date.now() + 200 * 864e5).toISOString() },
      { id: "a-teurer", gericht_name: u.n, titel: "Top-Runner", preis_alt: u.p + 5, preis_neu: u.p + 1, bis: new Date(Date.now() + 3 * 3600e3).toISOString() },
    ];
    await seite.evaluate(() => aktionenLaden());
    await seite.waitForFunction(() => aktionen.length === 3, null, { timeout: 4000 }).catch(() => {});
    await seite.waitForTimeout(300);
    const zeile = name => seite.evaluate(name => {
      const z = [...document.querySelectorAll(".gericht")].find(x => decodeURIComponent(x.querySelector(".ginfo").dataset.detail) === name);
      if (!z) return null;
      const q = s => z.querySelector(s);
      return { neu: q(".p.pneu") && q(".p.pneu").textContent, alt: q(".palt") && q(".palt").textContent,
        strich: q(".palt") ? getComputedStyle(q(".palt")).textDecorationLine : "", tag: q(".tag.rabatt") && q(".tag.rabatt").textContent,
        normal: q(".p:not(.pneu)") && q(".p:not(.pneu)").textContent };
    }, name);
    const zk = await zeile(k.n), zu = await zeile(u.n);
    const pt = v => v.toFixed(2).replace(".", ",") + " €";
    pruef(zk && zk.neu === pt(neuK) && zk.alt === pt(k.p) && zk.strich === "line-through" && zk.tag === "−20 %",
      "Karte: neuer Preis, alter gestrichen, „−20 %“", JSON.stringify(zk));
    pruef(zu && !zu.neu && !zu.tag && zu.normal === pt(u.p), "Aktionspreis über dem Kartenpreis: nichts Rabattiertes", JSON.stringify(zu));

    /* 8 · Lesbarkeit der Plakette, Tag und Abend */
    for (const [phase, h] of [["tag", 14], ["abend", 22]]) {
      /* Derselbe Griff wie pruef-gastkonto: Uhr stellen, Nacht schalten. */
      await seite.evaluate(h => { stunde = h; nachtSchalten(); }, h);
      /* Der Grund blendet über — gemessen wird erst, wenn er steht (zwei
         Ablesungen im Abstand gleich), sonst misst man den Übergang. */
      for (let i = 0, vor = ""; i < 25; i++) {
        await seite.waitForTimeout(200);
        const jetzt = await seite.evaluate(() => getComputedStyle(document.body).backgroundColor);
        if (jetzt === vor) break; vor = jetzt;
      }
      const istPhase = await seite.evaluate(() => document.body.dataset.phase);
      /* Blend hat keine Abendfassung — dort bleibt es Tag, und das ist richtig. */
      const hatAbend = await seite.evaluate(() => !!(typeof MARKE !== "undefined" && MARKE && MARKE.abend));
      if (phase === "abend" && istPhase === "tag" && slug === "blend") { console.log("  (Blend: keine Abendfassung — Tag gilt rund um die Uhr)"); continue; }
      pruef(istPhase === phase, "Voraussetzung: Phase „" + phase + "“ ist gesetzt", istPhase + (hatAbend ? "" : ""));
      const werte = await seite.evaluate(new Function("name", KONTRAST + `
        const z = [...document.querySelectorAll(".gericht")].find(x => decodeURIComponent(x.querySelector(".ginfo").dataset.detail) === name);
        return { tag: kontrast(z.querySelector(".tag.rabatt")), neu: kontrast(z.querySelector(".p.pneu")), alt: kontrast(z.querySelector(".palt")) };`), k.n);
      pruef(werte.tag >= 4.5 && werte.neu >= 4.5 && werte.alt >= 4.5, "lesbar (" + phase + "): Plakette, neuer, alter Preis ≥ 4,5:1",
        werte.tag.toFixed(2) + " / " + werte.neu.toFixed(2) + " / " + werte.alt.toFixed(2));
    }

    /* 7 · Streifen oben */
    const band = await seite.evaluate(() => [...document.querySelectorAll(".aktion .name")].map(x => x.textContent));
    pruef(band.includes(k.n) && !band.includes(d.n), "Streifen: kurzer Rabatt ja, Dauer-Rabatt nein", band.join(" · "));
    const tage = await seite.evaluate(() => { aktionen = [{ id: "x", gericht_name: "X", preis_alt: 9, preis_neu: 8, bis: new Date(Date.now() + 5 * 864e5 + 6e4).toISOString() }];
      /* Über das DOM gelesen, nicht per Muster: Vor dem Text steht seit
         09.10. der Puls-Punkt (<i class="aktion-puls">). */
      const d = document.createElement("div"); d.innerHTML = aktionBandHTML();
      return d.querySelector(".rest").textContent; });
    pruef(/5/.test(tage) && !/Stunden/.test(tage), "Restzeit über zwei Tagen in Tagen", tage);
    await seite.evaluate(() => aktionenLaden()); await seite.waitForTimeout(300);

    /* 6 · Korb zum Aktionspreis, und Nachziehen beim Ende */
    await seite.evaluate(name => { const b = document.querySelector('.gplus[data-merk="' + encodeURIComponent(name) + '"]'); b.click(); }, k.n);
    await seite.waitForTimeout(300);
    const imKorb = await seite.evaluate(name => ({ p: merk[name] && merk[name].p, summe: merkSumme() }), k.n);
    pruef(imKorb.p && Math.abs(Number(String(imKorb.p).replace(",", ".")) - neuK) < 0.001, "„+“ legt zum Aktionspreis in den Korb", JSON.stringify(imKorb));
    antwort = [];
    await seite.evaluate(() => aktionenLaden()); await seite.waitForTimeout(400);
    const danach = await seite.evaluate(name => merk[name] && preisNum(merk[name].p), k.n);
    pruef(Math.abs(danach - k.p) < 0.001, "Aktion endet → Korb zieht auf den Kartenpreis nach", danach);
    const zk2 = await zeile(k.n);
    pruef(zk2 && !zk2.tag && zk2.normal === pt(k.p), "Aktion endet → Karte zeigt wieder den normalen Preis", JSON.stringify(zk2));
    pruef(kons.length === 0, "Hub ohne Fehler", kons.join(" | "));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " Fehler von " + n : "Alles sauber. (" + n + " Proben)"));
  process.exit(f ? 1 : 0);
})();
