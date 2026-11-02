/* ═══════════════════════════════════════════════════════════════════
   pruef-gericht-fertig.js — „Dieses Gericht ist fertig, bitte servieren“
   und die Küche auf dem Saalplan

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-gericht-fertig.js
     (Gegenbeweise: ADMIN_DATEI=<Kopie von admin.html> KUECHE_DATEI=<Kopie von kueche.html>)

   Wunsch 25.10.: „Man soll einstellen, wo die Küche ist auf der Karte. Dann soll
   der Koch im Küchenboard dem Service Bescheid sagen können, welche Speise fertig
   ist, damit sie zum Tisch gebracht werden kann.“

   1 · KÜCHE (kueche.html, gestellter Server, der die Funktion wie die
       Datenbank ausführt): jede Zeile des Bons hat ihren Knopf (≥ 44 px);
       ein echter Tipp ruft gericht_fertig_setzen mit GENAU dieser Nummer;
       zweiter Tipp nimmt zurück; „gebracht“ ist nicht mehr antippbar;
       „Abholbereit“ für den ganzen Bon meldet nur die noch offenen Gerichte
       und schreibt weiter kueche_fertig_um (alter Weg trägt); „Wieder öffnen“
       nimmt nur die nicht gebrachten zurück; ein zweiter Koch (Server ändert
       die Zeile) erscheint nach dem nächsten Abruf; Fehler (Netz, storniert,
       Migration fehlt) rollen den Knopf zurück und sagen es; fehlt die Spalte
       (400), lädt die Küche weiter; stornierte Bons tragen keinen Knopf.
   2 · BOARD (admin.html): „Zum Abholen“ zeigt NUR die gemeldeten Gerichte
       („1 von 3 fertig“), die Bestellkarte markiert sie und nennt „Bitte
       servieren“, Ton genau einmal je jüngerer Meldung, „Gebracht“ sendet genau
       die Nummern, die am Schirm standen (gerichte_gebracht_setzen), Absage →
       Zustand zurück und ein Satz; Namen nur als Text; kaputte Spalte
       (Liste, Text, Schlüssel „x“, Nummer außerhalb) stürzt nichts ab.
   3 · SAAL: „Servieren ×n“ am Tisch, gestrichelte Linie vom Pass zum Tisch
       (nur mit Küche und nur zu Tischen mit Servieren), Küche mit Maß
       (gemalt, in Metern), nach „Gebracht“ keine Linie mehr; Einrichten:
       Küche einzeichnen/ändern/entfernen, nur EINE im Gebäude, Nutzlast
       trägt „kueche“ nur dort, wo eine steht.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = "file://" + (process.env.ADMIN_DATEI ? path.resolve(process.env.ADMIN_DATEI) : path.join(OBEN, "seiten", "admin.html"));
const KUECHE = "file://" + (process.env.KUECHE_DATEI ? path.resolve(process.env.KUECHE_DATEI) : path.join(OBEN, "seiten", "kueche.html"));

let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if(!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined && d !== "" ? "  → " + d : "")); };
const nah = (a, b, tol) => Math.abs(a - b) <= tol;

/* ── 1 · Küche ──────────────────────────────────────────────────── */
async function kueche(browser){
  console.log("\n══ 1 · Küche: jedes Gericht für sich fertig melden ══");
  const B = "11111111-1111-1111-1111-111111111111";
  const stand = {
    modus: "ok", rpc: [], patch: [], gets: 0, spalteFehlt: false,
    bons: [
      { id: "k1", betrieb_id: B, quelle: "tisch", status: "arbeit", tisch: "4", notiz: null, zeitpunkt: new Date().toISOString(),
        wartezeit_min: 15, bestaetigt_um: new Date().toISOString(), kueche_fertig_um: null, theke_fertig_um: null, storno: [], pruefen: false,
        positionen: [{ name: "Suppe", menge: 1 }, { name: "Steak (medium)", menge: 2 }, { name: "Cola", menge: 1 }], positionen_fertig: {} },
      { id: "k2", betrieb_id: B, quelle: "tisch", status: "storniert", tisch: "9", notiz: null, zeitpunkt: new Date().toISOString(),
        wartezeit_min: null, bestaetigt_um: null, kueche_fertig_um: null, theke_fertig_um: null, storno: [], pruefen: false,
        positionen: [{ name: "Salat", menge: 1 }], positionen_fertig: {} }
    ]
  };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.route("**/*", r => {
    const u = decodeURIComponent(r.request().url()), m = r.request().method();
    const json = (b, st) => r.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(b) });
    if(u.startsWith("file://")) return r.continue();
    if(u.includes("/rest/v1/rpc/gericht_fertig_setzen")){
      const a = JSON.parse(r.request().postData() || "{}"); stand.rpc.push(a);
      if(stand.modus === "404") return json({ message: "function not found" }, 404);
      if(stand.modus === "netz") return r.abort();
      if(stand.modus === "storniert") return json({ ok: false, grund: "storniert" });
      /* wie die Funktion: ergänzt nur, ändert nie ein gebrachtes zurück */
      const bon = stand.bons.find(x => x.id === a.p_bestellung), pf = bon.positionen_fertig;
      a.p_positionen.forEach(i => {
        if(a.p_fertig !== false){ if(!pf[String(i)]) pf[String(i)] = { f: new Date().toISOString() }; }
        else if(pf[String(i)] && !pf[String(i)].g) delete pf[String(i)];
      });
      return json({ ok: true, fertig: pf });
    }
    if(u.includes("/rest/v1/bestellungen")){
      if(m === "PATCH"){
        const id = (u.match(/id=eq\.([^&]+)/) || [])[1], body = JSON.parse(r.request().postData() || "{}");
        stand.patch.push({ id, body });
        const bon = stand.bons.find(x => x.id === id); if(bon) Object.assign(bon, body);
        return /return=representation/.test(r.request().headers()["prefer"] || "") ? json(bon ? [bon] : []) : json([]);
      }
      stand.gets++;
      if(stand.spalteFehlt && /positionen_fertig/.test(u)) return json({ message: "column bestellungen.positionen_fertig does not exist" }, 400);
      return json(stand.bons.map(b => { const k = JSON.parse(JSON.stringify(b)); if(stand.spalteFehlt) delete k.positionen_fertig; return k; }));
    }
    if(u.includes("/rest/v1/gerichte")) return json([{ name: "Cola", karte: "getraenke", spur: "theke" }, { name: "Suppe", karte: "speisen", spur: "kueche" }, { name: "Steak", karte: "speisen", spur: "kueche" }]);
    if(u.includes("/rest/v1/betriebe")) return json([{ id: B, name: "Prüfhaus" }]);
    if(u.includes("/auth/")) return json({ access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: { id: "u1" } });
    return json([]);
  });
  await s.addInitScript(() => {
    localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  });
  await s.goto(KUECHE);
  await s.waitForSelector('#feld .bon [data-tun="gericht"]', { timeout: 6000 }).catch(() => {});
  const knoepfe = () => s.evaluate(() => [...document.querySelectorAll('#feld .bon[data-id="k1"] [data-tun="gericht"], #feld [data-tun="gericht"][data-id="k1"]')].map(k => ({
    pos: k.dataset.pos, text: k.textContent.trim(), an: k.getAttribute("aria-pressed"), aus: k.disabled, klasse: k.className, h: k.getBoundingClientRect().height, b: k.getBoundingClientRect().width })));
  /* Auf den Endzustand warten, nicht auf eine Zeit: der Bon fliegt beim ersten Aufbau ein (Höhe 43,9 px mitten im Einflug). */
  await s.waitForFunction(() => document.querySelector("#feld .bon") && document.querySelector("#feld .bon").getAnimations({ subtree: true }).every(a => a.playState !== "running"), null, { timeout: 5000 }).catch(() => {});
  let kn = await knoepfe();
  pruef(kn.length === 3 && kn.map(k => k.pos).join() === "0,1,2", "Voraussetzung: der Bon zeigt drei Zeilen, jede mit ihrem Knopf (Nummer = Platz in den Positionen)", JSON.stringify(kn.map(k => k.pos + ":" + k.text)));
  pruef(kn.length && kn.every(k => k.h >= 44 && k.b >= 44 && k.an === "false" && k.text === "Fertig"), "alle Knöpfe ≥ 44 px, anfangs „Fertig“, aria-pressed false", JSON.stringify(kn.map(k => [Math.round(k.b), Math.round(k.h), k.an, k.text])));
  pruef(!(await s.evaluate(() => !!document.querySelector('#feld [data-id="k2"][data-tun="gericht"]'))), "ein stornierter Bon trägt keinen Fertig-Knopf");

  /* Tipp auf „Steak“ (Nummer 1) — mitten im Bon, nicht die erste Zeile */
  await s.click('#feld [data-tun="gericht"][data-pos="1"]');
  await s.waitForTimeout(500);
  pruef(stand.rpc.length === 1 && stand.rpc[0].p_bestellung === "k1" && JSON.stringify(stand.rpc[0].p_positionen) === "[1]" && stand.rpc[0].p_fertig === true,
    "echter Tipp ruft gericht_fertig_setzen mit genau Bon k1, Nummer [1], fertig=true", JSON.stringify(stand.rpc));
  kn = await knoepfe();
  pruef(kn[1].text === "✓ Fertig" && kn[1].an === "true" && /fertig/.test(kn[1].klasse) && kn[0].text === "Fertig" && kn[2].text === "Fertig", "nur diese Zeile ist markiert, die anderen unberührt", JSON.stringify(kn.map(k => k.text)));
  const toast = await s.evaluate(() => [...document.querySelectorAll("#toasts .toast")].map(t => t.textContent).join(" | "));
  pruef(/Tisch 4/.test(toast) && /Steak/.test(toast) && /Service/.test(toast), "Toast nennt Tisch, Gericht und den Service", toast);
  pruef(stand.patch.length === 0, "ein einzelnes Gericht schreibt NICHT in die Bestellung (kein PATCH) — nur die Funktion", JSON.stringify(stand.patch));

  /* Zurücknehmen */
  await s.click('#feld [data-tun="gericht"][data-pos="1"]');
  await s.waitForTimeout(400);
  pruef(stand.rpc.length === 2 && stand.rpc[1].p_fertig === false && JSON.stringify(stand.rpc[1].p_positionen) === "[1]", "zweiter Tipp nimmt zurück (fertig=false)", JSON.stringify(stand.rpc[1]));
  kn = await knoepfe();
  pruef(kn[1].text === "Fertig" && kn[1].an === "false", "Knopf steht wieder auf „Fertig“");

  /* Der Service hat Suppe schon gebracht: nicht mehr antippbar, ruft nichts */
  stand.bons[0].positionen_fertig["0"] = { f: new Date(Date.now() - 60000).toISOString(), g: new Date().toISOString() };
  await s.waitForFunction(() => { const k = document.querySelector('#feld [data-tun="gericht"][data-pos="0"]'); return k && k.disabled; }, null, { timeout: 9000 }).catch(() => {});
  kn = await knoepfe();
  pruef(kn[0].aus && kn[0].text === "Gebracht" && /gebracht/.test(kn[0].klasse), "Suppe: vom Service gebracht → Knopf „Gebracht“, gesperrt (zweiter Koch/Board änderte die Zeile, Abruf zeigt es)", JSON.stringify(kn[0]));
  const vor = stand.rpc.length;
  await s.click('#feld [data-tun="gericht"][data-pos="0"]', { force: true, timeout: 1500 }).catch(() => {});
  await s.waitForTimeout(250);
  pruef(stand.rpc.length === vor, "ein Tipp auf das Gebrachte ruft nichts", stand.rpc.length - vor);

  /* Zweiter Koch am zweiten Schirm hakt Cola ab */
  stand.bons[0].positionen_fertig["2"] = { f: new Date().toISOString() };
  await s.waitForFunction(() => { const k = document.querySelector('#feld [data-tun="gericht"][data-pos="2"]'); return k && k.getAttribute("aria-pressed") === "true"; }, null, { timeout: 9000 }).catch(() => {});
  kn = await knoepfe();
  pruef(kn[2].an === "true" && kn[2].text === "✓ Fertig", "Cola, am anderen Schirm gemeldet, steht nach dem nächsten Abruf auch hier da", JSON.stringify(kn[2]));

  /* „Abholbereit“ für den ganzen Bon: Steak noch offen → nur [1] */
  stand.rpc.length = 0; stand.patch.length = 0;
  await s.click('#feld .bon[data-id="k1"] [data-tun="fertig"], #feld [data-tun="fertig"][data-id="k1"]');
  await s.waitForTimeout(700);
  const rest = stand.rpc.filter(a => a.p_fertig === true);
  pruef(rest.length === 1 && JSON.stringify(rest[0].p_positionen) === "[1]", "„Abholbereit“ meldet nur das noch OFFENE Gericht (Steak = [1]); Suppe (gebracht) und Cola (schon gemeldet) bleiben", JSON.stringify(stand.rpc));
  pruef(stand.patch.length >= 1 && typeof stand.patch[0].body.kueche_fertig_um === "string" && typeof stand.patch[0].body.theke_fertig_um === "string",
    "… und der alte Weg läuft weiter: kueche_fertig_um UND theke_fertig_um stehen im PATCH", JSON.stringify(stand.patch.map(p => Object.keys(p.body))));
  const eg = stand.bons[0].positionen_fertig;
  pruef(eg["0"].g && eg["1"] && !eg["1"].g && eg["2"], "Zeile in der Datenbank: Suppe gebracht, Steak und Cola fertig");

  /* „Wieder öffnen“ nimmt nur Nicht-Gebrachtes zurück */
  await s.waitForSelector('#feld [data-tun="oeffnen"]', { timeout: 6000 }).catch(() => {});
  stand.rpc.length = 0;
  const hatOeffnen = await s.evaluate(() => !!document.querySelector('#feld [data-tun="oeffnen"]'));
  pruef(hatOeffnen, "Voraussetzung: der abgehakte Bon bietet „Wieder öffnen“ an");
  if(hatOeffnen){
    await s.click('#feld [data-tun="oeffnen"]');
    await s.waitForTimeout(700);
    const zur = stand.rpc.filter(a => a.p_fertig === false);
    pruef(zur.length === 1 && zur[0].p_positionen.slice().sort().join() === "1,2", "„Wieder öffnen“ nimmt Steak und Cola zurück, NICHT die gebrachte Suppe", JSON.stringify(stand.rpc));
    pruef(!!stand.bons[0].positionen_fertig["0"] && !stand.bons[0].positionen_fertig["1"] && !stand.bons[0].positionen_fertig["2"], "Zeile in der Datenbank: nur Suppe bleibt");
  }

  /* Fehlerwege */
  await s.waitForTimeout(300);
  stand.modus = "netz"; stand.rpc.length = 0;
  await s.click('#feld [data-tun="gericht"][data-pos="1"]');
  await s.waitForTimeout(500);
  kn = await knoepfe();
  const tN = await s.evaluate(() => [...document.querySelectorAll("#toasts .toast")].map(t => t.textContent).join(" | "));
  pruef(kn[1].text === "Fertig" && kn[1].an === "false", "Netz weg: der Knopf springt zurück (nichts vorgetäuscht)");
  pruef(/Nicht gespeichert/.test(tN) && /Erneut/.test(tN), "… mit Satz und „Erneut“", tN);
  stand.modus = "storniert";
  await s.click('#feld [data-tun="gericht"][data-pos="1"]');
  await s.waitForTimeout(500);
  const tS = await s.evaluate(() => [...document.querySelectorAll("#toasts .toast")].map(t => t.textContent).join(" | "));
  pruef(/storniert/.test(tS), "Bestellung inzwischen storniert: Satz sagt es", tS);
  kn = await knoepfe();
  pruef(kn.length === 0 || kn[1].text === "Fertig", "… und es bleibt nichts markiert");
  stand.modus = "404";
  await s.click('#feld [data-tun="gericht"][data-pos="2"]').catch(() => {});
  await s.waitForTimeout(500);
  const t4 = await s.evaluate(() => [...document.querySelectorAll("#toasts .toast")].map(t => t.textContent).join(" | "));
  pruef(/migration-gericht-fertig\.sql/.test(t4), "Migration fehlt (404): der Satz nennt die Datei", t4);
  pruef(!fehler.length, "keine Ausnahme in der Küche", fehler.join(" | ") || "still");
  await ctx.close();

  /* Spalte fehlt noch (400): die Küche lädt trotzdem, Knöpfe da */
  {
    stand.modus = "ok"; stand.spalteFehlt = true; stand.bons[0].positionen_fertig = {}; stand.gets = 0;
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p2 = await c2.newPage(); const f2 = []; const geladen = [];
    p2.on("pageerror", e => f2.push(String(e).slice(0, 160)));
    await p2.route("**/*", r => { const u = decodeURIComponent(r.request().url()); if(u.startsWith("file://")) return r.continue(); return ctx2route(r, u); });
    function ctx2route(r, u){
      const json = (b, st) => r.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(b) });
      if(u.includes("/rest/v1/bestellungen") && r.request().method() === "GET"){
        if(/positionen_fertig/.test(u)) return json({ message: "column does not exist" }, 400);
        geladen.push(u);
        return json(stand.bons.map(b => { const k = JSON.parse(JSON.stringify(b)); delete k.positionen_fertig; return k; }));
      }
      if(u.includes("/rest/v1/betriebe")) return json([{ id: B, name: "Prüfhaus" }]);
      if(u.includes("/auth/")) return json({ access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: { id: "u1" } });
      return json([]);
    }
    await p2.addInitScript(() => { localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600 })); });
    await p2.goto(KUECHE);
    await p2.waitForSelector("#feld .bon", { timeout: 7000 }).catch(() => {});
    const da = await p2.evaluate(() => ({ bons: document.querySelectorAll("#feld .bon").length, knoepfe: document.querySelectorAll('#feld [data-tun="gericht"]').length }));
    pruef(da.bons >= 1 && da.knoepfe === 3, "Spalte positionen_fertig fehlt noch (400): die Küche lädt weiter, die Bons stehen da, die Knöpfe auch", JSON.stringify(da));
    pruef(!f2.length, "… ohne Ausnahme", f2.join(" | "));
    /* Gelungen ist erst die Stufe, die NUR die fehlende Spalte weglässt: „zugewiesen“ (Team-Modus) und „pruefen“ bleiben (zwei Gürtel, §8.1g G —
       ohne diese Frage trägt die erste Rückfallstufe nichts, weil die zweite alles auffängt). */
    pruef(geladen.length >= 1 && /zugewiesen/.test(geladen[0]) && /pruefen/.test(geladen[0]), "… und die Rückfallstufe lässt nur die fehlende Spalte weg (zugewiesen, pruefen bleiben)", geladen[0] || "keine Abfrage gelungen");
    await c2.close();
  }
}

/* ── 2 · Board ──────────────────────────────────────────────────── */
async function boardNeu(browser, breite, hoehe){
  const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe || 900 }, colorScheme: "dark" });
  const p = await ctx.newPage();
  const pf = [];
  p.on("pageerror", e => pf.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
  await p.goto(ADMIN);
  await p.waitForTimeout(700);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; });
  await p.waitForTimeout(400);
  return { ctx, p, pf };
}
function hellig(rgb){ const l = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; }
const kontrast = (a, b) => { const x = hellig(a), y = hellig(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = t => (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(v => v <= 1 && /color\(/.test(t) ? v * 255 : v);

async function board(browser, breite){
  console.log("\n══ 2 · Board " + breite + " px: Zum Abholen mit einzelnen Gerichten ══");
  const { ctx, p, pf } = await boardNeu(browser, breite);
  await p.evaluate(() => { tafelZeigen("reservierungen"); });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const vor = m => new Date(Date.now() - m * 60000).toISOString();
    bestellungen.length = 0;
    bestellungen.push(
      { id: "g1", betrieb_id: "B", quelle: "tisch", status: "arbeit", tisch: "4", summe: 20, zeitpunkt: vor(14), wartezeit_min: 15, pruefen: false,
        positionen: [{ name: "Suppe", menge: 1, preis: 6 }, { name: "Steak (medium)", menge: 2, preis: 7 }, { name: "<img src=x onerror=window.__pwn=1>Salat", menge: 1, preis: 5 }],
        positionen_fertig: { "0": { f: vor(5) } }, kueche_fertig_um: null, theke_fertig_um: null, gebracht_um: null },
      { id: "g2", betrieb_id: "B", quelle: "tisch", status: "storniert", tisch: "8", summe: 6, zeitpunkt: vor(14), pruefen: false,
        positionen: [{ name: "Kuchen", menge: 1, preis: 6 }], positionen_fertig: { "0": { f: vor(2) } } },
      { id: "g3", betrieb_id: "B", quelle: "tisch", status: "arbeit", tisch: "6", summe: 6, zeitpunkt: vor(10), pruefen: false,
        positionen: [{ name: "Kaffee", menge: 1, preis: 3 }, { name: "Torte", menge: 1, preis: 3 }], positionen_fertig: [{ f: vor(1) }, { f: vor(1) }] },
      { id: "g4", betrieb_id: "B", quelle: "tisch", status: "arbeit", tisch: "7", summe: 6, zeitpunkt: vor(10), pruefen: false,
        positionen: [{ name: "Tee", menge: 1, preis: 3 }], positionen_fertig: { x: { f: vor(1) }, "9": { f: vor(1) }, "0": "kaputt" } }
    );
    Object.keys(zeigeStatus).forEach(k => zeigeStatus[k] = k !== "fertig");
    Object.keys(zeigeQuelle).forEach(k => zeigeQuelle[k] = true);
    bekannt.clear(); bestellungen.forEach(b => bekannt.add(b.id));
    window.__abholTon = 0; EINST.ton = true;
    zeichneAlles();
  });
  await p.waitForTimeout(250);
  const leiste = () => p.evaluate(() => ({
    sichtbar: !document.getElementById("abholen").hidden,
    wer: [...document.querySelectorAll("#abholListe .abkarte")].map(k => k.querySelector(".abwer").textContent),
    spur: [...document.querySelectorAll("#abholListe .abkarte")].map(k => k.querySelector(".abspur").textContent.replace(/\s+/g, " ").trim()),
    was: [...document.querySelectorAll("#abholListe .abkarte")].map(k => (k.querySelector(".abwas") || {}).textContent || ""),
    ton: window.__abholTon,
    img: document.querySelectorAll("#abholListe img, #karten img").length, pwn: window.__pwn === 1 }));
  let l = await leiste();
  pruef(l.sichtbar && JSON.stringify(l.wer) === '["Tisch 4"]', "Zum Abholen: nur Tisch 4 (storniert, Liste statt Objekt und kaputte Schlüssel zählen nicht)", JSON.stringify(l.wer));
  pruef(/1 von 3 fertig/.test(l.spur[0] || ""), "… „1 von 3 fertig“", l.spur[0]);
  pruef(/Suppe/.test(l.was[0]) && !/Steak|Salat/.test(l.was[0]), "… nennt NUR das fertige Gericht, nicht den ganzen Bon", l.was[0]);
  pruef(l.img === 0 && !l.pwn, "Gerichtname mit <img onerror> bleibt Text (nirgends ein Bild, nichts ausgeführt)");
  pruef(l.ton === 0, "beim Laden klingelt nichts");

  /* Bestellkarte (Reiter Bestellungen) */
  await p.evaluate(() => tafelZeigen("bestellungen"));
  await p.waitForTimeout(300);
  const karte = await p.evaluate(() => {
    const k = document.querySelector('#karten [data-id="g1"]'); if(!k) return null;
    return { markiert: [...k.querySelectorAll(".pos")].map(e => e.classList.contains("pbereit")), text: (k.querySelector(".servieren-zeile") || {}).textContent || "",
      marke: [...k.querySelectorAll(".gfertig")].map(e => e.textContent.trim()), btn: !!k.querySelector(".servieren-zeile [data-gebracht]") };
  });
  pruef(karte && JSON.stringify(karte.markiert) === "[true,false,false]" && karte.marke.join() === "✓ fertig", "Bestellkarte: nur Suppe trägt die Marke „✓ fertig“", JSON.stringify(karte));
  pruef(karte && /Bitte servieren/.test(karte.text) && /1× Suppe/.test(karte.text) && !/Steak/.test(karte.text) && karte.btn, "… Zeile „Bitte servieren: 1× Suppe“ mit eigenem „Gebracht“-Knopf", karte && karte.text.replace(/\s+/g, " "));
  const knopfMass = await p.evaluate(() => { const b = document.querySelector('#karten [data-id="g1"] .servieren-zeile [data-gebracht]').getBoundingClientRect(); return { h: b.height, b: b.width, ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  pruef(knopfMass.h >= 44 && knopfMass.b >= 44 && knopfMass.ueber <= 0, "„Gebracht“ in der Karte ≥ 44 px, kein seitliches Überlaufen", JSON.stringify(knopfMass));
  const farben = await p.evaluate(() => {
    /* Wirksamer Grund: alle Ebenen von innen nach außen übereinander gerechnet (die Zeile ist ein 12-%-Grün auf der Karte). */
    const lies = t => { const z = (t.match(/[\d.]+/g) || []).map(Number); const sr = /color\(/.test(t); const c = z.slice(0, 3).map(v => sr ? v * 255 : v); return { c, a: z.length > 3 ? z[3] : 1 }; };
    const grund = el => { const ebenen = []; for(let e = el; e; e = e.parentElement){ const b = lies(getComputedStyle(e).backgroundColor); if(b.a > 0) ebenen.push(b); if(b.a >= 1) break; }
      let c = [255, 255, 255]; ebenen.reverse().forEach(b => { c = c.map((v, i) => v * (1 - b.a) + b.c[i] * b.a); }); return c; };
    const mess = sel => { const e = document.querySelector(sel); return e ? { fg: lies(getComputedStyle(e).color).c, bg: grund(e) } : null; };
    document.body.classList.remove("hell");
    const dunkel = { marke: mess('#karten [data-id="g1"] .gfertig'), zeile: mess('#karten [data-id="g1"] .servieren-zeile span') };
    document.body.classList.add("hell");
    const hell = { marke: mess('#karten [data-id="g1"] .gfertig'), zeile: mess('#karten [data-id="g1"] .servieren-zeile span') };
    document.body.classList.remove("hell");
    return { dunkel, hell };
  });
  const ks = [];
  for(const [name, v] of [["dunkel Marke", farben.dunkel.marke], ["dunkel Zeile", farben.dunkel.zeile], ["hell Marke", farben.hell.marke], ["hell Zeile", farben.hell.zeile]]){
    if(v) ks.push([name, kontrast(v.fg, v.bg)]);
  }
  pruef(ks.length === 4 && ks.every(([, k]) => k >= 4.5), "Kontrast ≥ 4,5:1: Marke und „Bitte servieren“, dunkel und hell", ks.map(([a, b]) => a + " " + b.toFixed(2)).join(" · "));

  /* Live-Leitung mit gestelltem Kanal: der ECHTE Handler aus live_anmelden */
  await p.evaluate(() => {
    window.__h = {}; window.__rpc = []; window.__log = []; window.__antwort = { data: { ok: true, gebracht: 2 }, error: null };
    const kette = (felder) => { const k = { _f: [] }; k.eq = (a, b) => { k._f.push([a, b]); return k; };
      k.then = (ok, nein) => { window.__log.push({ felder, filter: k._f }); return Promise.resolve({ error: null }).then(ok, nein); }; return k; };
    demo = false; betriebId = betriebId || "B";
    db = { from: () => ({ update: felder => kette(felder), select: () => ({}) }),
      rpc: (fn, a) => { window.__rpc.push({ fn, a: JSON.parse(JSON.stringify(a)) }); return Promise.resolve(window.__antwort); },
      channel: () => { const c = { on(art, cfg, fn) { window.__h[cfg.table + ":" + cfg.event] = fn; return c; }, subscribe() { return c; } }; return c; },
      removeChannel() {} };
    live_anmelden(betriebId || "B", ladeMarke);
    window.__osc = [];
    tonWerk = { state: "running", currentTime: 0, destination: {},
      createOscillator() { const o = { type: "", frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; window.__osc.push(o); return o; },
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } };
  });
  const update = neu => p.evaluate(z => { window.__h["bestellungen:UPDATE"]({ new: z }); }, neu);
  const zeile = id => p.evaluate(i => JSON.parse(JSON.stringify(bestellungen.find(b => b.id === i))), id);
  pruef(await p.evaluate(() => typeof window.__h["bestellungen:UPDATE"] === "function"), "Voraussetzung: Live-Handler für UPDATE angemeldet");
  const jetzt = () => new Date().toISOString();

  /* Der Koch meldet das Steak (Nummer 1): jüngere Meldung → Ton genau einmal */
  let g1 = await zeile("g1");
  g1.positionen_fertig["1"] = { f: jetzt() };
  await update(g1); await p.waitForTimeout(250);
  l = await leiste();
  pruef(l.ton === 1, "zweites Gericht gemeldet → Abholton genau einmal", l.ton);
  pruef(/2 von 3 fertig/.test(l.spur[0] || "") && /Suppe/.test(l.was[0]) && /Steak/.test(l.was[0]) && !/Salat/.test(l.was[0]), "… Karte zeigt „2 von 3 fertig“ mit Suppe und Steak", l.spur[0] + " / " + l.was[0]);
  const osc = await p.evaluate(() => window.__osc.length);
  pruef(osc === 4, "es erklingen die vier Abholtöne", osc);
  await update(g1); await p.waitForTimeout(200);
  pruef((await leiste()).ton === 1, "dieselbe Nachricht noch einmal: kein zweiter Ton");
  /* Zurücknehmen klingelt nicht */
  const g1b = await zeile("g1"); delete g1b.positionen_fertig["1"];
  await update(g1b); await p.waitForTimeout(200);
  l = await leiste();
  pruef(l.ton === 1 && /1 von 3 fertig/.test(l.spur[0]), "ein zurückgenommenes Gericht klingelt nicht und verschwindet von der Karte", l.ton + " / " + l.spur[0]);
  await update(g1); await p.waitForTimeout(200);
  pruef((await leiste()).ton === 2, "wieder gemeldet (jünger): klingelt erneut");

  /* „Gebracht“: genau die Nummern, die am Schirm standen */
  await p.evaluate(() => { window.__rpc.length = 0; window.__log.length = 0; });
  /* Zwischenzeitlich meldet der Koch das Salat-Gericht (Nummer 2) — der Schirm kennt es noch nicht */
  await p.click('#abholListe .abkarte[data-abid="g1"] [data-gebracht]');
  await p.waitForTimeout(300);
  const rpc = await p.evaluate(() => window.__rpc), upd = await p.evaluate(() => window.__log);
  pruef(rpc.length === 1 && rpc[0].fn === "gerichte_gebracht_setzen" && rpc[0].a.p_bestellung === "g1" && JSON.stringify(rpc[0].a.p_positionen) === "[0,1]",
    "„Gebracht“ ruft gerichte_gebracht_setzen mit genau [0,1] — den Gerichten, die am Schirm standen", JSON.stringify(rpc));
  pruef(upd.length === 0, "… und schreibt NICHT zusätzlich gebracht_um in die Tabelle (das macht der Server, sobald alle gebracht sind)", JSON.stringify(upd));
  l = await leiste();
  pruef(l.wer.length === 0, "die Karte verschwindet aus „Zum Abholen“", JSON.stringify(l.wer));
  const nachher = await zeile("g1");
  pruef(nachher.positionen_fertig["0"].g && nachher.positionen_fertig["1"].g && !nachher.positionen_fertig["2"] && !nachher.gebracht_um, "lokal: 0 und 1 gebracht, 2 unberührt, gebracht_um bleibt leer (nicht alle gebracht)", JSON.stringify(nachher.positionen_fertig));
  const kk = await p.evaluate(() => [...document.querySelectorAll('#karten [data-id="g1"] .gfertig')].map(e => e.textContent.trim()));
  pruef(kk.join() === "gebracht,gebracht", "Bestellkarte: beide tragen „gebracht“", kk.join());

  /* Das letzte Gericht fertig und gebracht → gebracht_um gesetzt (alle) */
  const g1c = await zeile("g1"); g1c.positionen_fertig["2"] = { f: jetzt() };
  await update(g1c); await p.waitForTimeout(250);
  l = await leiste();
  pruef(l.wer.join() === "Tisch 4" && /1 von 3 fertig/.test(l.spur[0]) && /Salat/.test(l.was[0]), "ein weiteres Gericht (Nr. 2) → Karte kommt zurück, mit nur diesem", l.spur[0] + " / " + l.was[0]);
  await p.waitForTimeout(300);
  l = await leiste();
  pruef(l.img === 0 && !l.pwn, "der vergiftete Name (<img onerror>) steht JETZT in der Karte und bleibt Text (erst hier kommt er in „Zum Abholen“)", "Bilder " + l.img + ", ausgeführt " + l.pwn);
  await p.evaluate(() => { window.__rpc.length = 0; });
  await p.click('#abholListe .abkarte[data-abid="g1"] [data-gebracht]'); await p.waitForTimeout(300);
  const g1d = await zeile("g1");
  pruef(JSON.stringify((await p.evaluate(() => window.__rpc))[0].a.p_positionen) === "[2]" && typeof g1d.gebracht_um === "string", "nur [2] gesendet; jetzt ist JEDES gebracht → gebracht_um lokal gesetzt", JSON.stringify(g1d.positionen_fertig));

  /* Absage: Zustand zurück und Satz */
  const g1e = await zeile("g1"); delete g1e.gebracht_um; g1e.gebracht_um = null;
  g1e.positionen_fertig = { "0": { f: jetzt() } };
  await update(g1e); await p.waitForTimeout(200);
  await p.evaluate(() => { window.__rpc.length = 0; window.__antwort = { data: { ok: false, grund: "storniert" }, error: null }; });
  await p.click('#abholListe .abkarte[data-abid="g1"] [data-gebracht]'); await p.waitForTimeout(350);
  l = await leiste();
  const msg = await p.evaluate(() => { const m = document.getElementById("meldung"); return m && !m.hidden ? m.textContent : ""; });
  pruef(l.wer.join() === "Tisch 4" && !(await zeile("g1")).positionen_fertig["0"].g, "Absage (storniert): die Karte steht wieder da, nichts ist als gebracht vorgetäuscht");
  pruef(/storniert/.test(msg), "… und ein Satz sagt warum", msg);
  await p.evaluate(() => { window.__antwort = { data: null, error: { message: "Could not find the function public.gerichte_gebracht_setzen" } }; });
  await p.click('#abholListe .abkarte[data-abid="g1"] [data-gebracht]'); await p.waitForTimeout(350);
  const msg2 = await p.evaluate(() => { const m = document.getElementById("meldung"); return m && !m.hidden ? m.textContent : ""; });
  pruef(/migration-gericht-fertig\.sql/.test(msg2) && (await leiste()).wer.join() === "Tisch 4", "Funktion fehlt: Satz nennt die Migration, Zustand zurück");

  /* gebracht_um später als die Meldung: gilt als gebracht (alter Weg) */
  const g1f = await zeile("g1"); g1f.positionen_fertig = { "0": { f: new Date(Date.now() - 120000).toISOString() } }; g1f.gebracht_um = new Date(Date.now() - 30000).toISOString();
  await update(g1f); await p.waitForTimeout(200);
  pruef((await leiste()).wer.length === 0, "Meldung VOR gebracht_um zählt als gebracht (Bon vom alten Weg abgeschlossen)");
  pruef(!pf.length, "keine Ausnahme im Board " + breite, pf.join(" | ") || "still");
  await ctx.close();
}

/* ── 3 · Saal: Servieren, Weg vom Pass, Küche einzeichnen ────────── */
async function saal(browser){
  console.log("\n══ 3 · Saalplan: Küche, Pass, Wege, Einrichten ══");
  const { ctx, p, pf } = await boardNeu(browser, 1440, 900);
  await p.evaluate(() => {
    tafelZeigen("reservierungen");
    window.__welt = (cx, cy, z) => {
      const r = document.getElementById("spBuehne").getBoundingClientRect(), c = SAAL.kamera;
      const px = (cx - r.left - c.tx) / c.k, py = (cy - r.top - c.ty) / c.k + z * SAAL_U;
      const a = px / (SAAL_C * SAAL_U), b = py / (0.5 * SAAL_U);
      return { x: (a + b) / 2, y: (b - a) / 2 };
    };
    window.__ecken = (el, z) => {
      const svg = document.getElementById("spSvg"), m = el.getScreenCTM();
      return [...el.points].map(pt => { const q = svg.createSVGPoint(); q.x = pt.x; q.y = pt.y; const w = q.matrixTransform(m); return window.__welt(w.x, w.y, z); });
    };
  });
  await p.waitForTimeout(500);
  const stelle = (extra) => p.evaluate(ex => {
    const vor = m => new Date(Date.now() - m * 60000).toISOString();
    bestellungen.length = 0;
    bestellungen.push(
      { id: "s1", quelle: "tisch", status: "arbeit", tisch: "2", zeitpunkt: vor(14), summe: 15,
        positionen: [{ name: "A", menge: 1, preis: 5 }, { name: "B", menge: 1, preis: 5 }, { name: "C", menge: 1, preis: 5 }],
        positionen_fertig: { "0": { f: vor(6) }, "1": { f: vor(2) } } },
      { id: "s2", quelle: "tisch", status: "arbeit", tisch: "7", zeitpunkt: vor(9), summe: 5, positionen: [{ name: "D", menge: 1, preis: 5 }], positionen_fertig: {} },
      { id: "s3", quelle: "tisch", status: "neu", tisch: "10", zeitpunkt: vor(1), summe: 5, positionen: [{ name: "E", menge: 1, preis: 5 }] });
    (ex || []).forEach(x => bestellungen.push(x));
    bekannt.clear(); bestellungen.forEach(b => bekannt.add(b.id));
    SAAL.sig = ""; zeichneAlles();
  }, extra);
  await stelle();
  await p.waitForTimeout(300);
  const tischArten = nr => p.evaluate(n => { const st = saalStand(), t = st.tische.get(saalNk(n)); return t ? Object.fromEntries(Object.entries(t.arten).map(([a, x]) => [a, x.n])) : null; }, nr);
  const a2 = await tischArten("2");
  pruef(a2 && a2.servieren === 2, "Tisch 2: zwei Gerichte am Pass → „Servieren ×2“ (nicht ×1 je Bon)", JSON.stringify(a2));
  const bes = await p.evaluate(() => { const t = SAAL.tische.find(x => x.nummer === "2"); return saalBeschreibung(t, saalStand().tische.get(saalNk("2"))); });
  pruef(/Servieren ×2/.test(bes) && /Min/.test(bes), "… Beschreibung für Vorleser nennt „Servieren ×2“ und die Wartezeit", bes);
  pruef(!(await tischArten("7")) || !(await tischArten("7")).servieren, "Tisch 7 (nichts gemeldet): nicht „Servieren“");

  /* Küche im Bild */
  const kb = await p.evaluate(() => {
    const el = document.querySelector("#spSvg .sp-k-kueche .o"); if(!el) return null;
    const e = window.__ecken(el, SAAL_BODEN + 1.5);
    return { b: Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y), t: Math.hypot(e[3].x - e[0].x, e[3].y - e[0].y), x: e[0].x, y: e[0].y,
      pass: !!document.querySelector("#spSvg .sp-k-pass"), text: !!document.querySelector("#spSvg .sp-kuechentext"), aria: (document.querySelector("#spSvg .sp-kueche") || {}).getAttribute && document.querySelector("#spSvg .sp-kueche").getAttribute("aria-label") };
  });
  const lay = await p.evaluate(() => saalLay()[0]);
  pruef(kb && nah(kb.b, 1.4, 0.06) && nah(kb.t, 1.5, 0.06), "Vorführhaus: die Küche ist im Bild 1,4 × 1,5 m groß (am gemalten Bild gemessen)", kb && kb.b.toFixed(2) + " × " + kb.t.toFixed(2));
  pruef(kb && nah(kb.x, lay.ox + 0.2, 0.08) && nah(kb.y, lay.oy + 0.2, 0.08), "… und steht 0,2 m / 0,2 m von der Raumecke", kb && kb.x.toFixed(2) + "/" + kb.y.toFixed(2));
  pruef(kb && kb.pass && /Pass zur/.test(kb.aria || ""), "… mit Pass auf einer Seite, Vorleser hört Maß und Seite", kb && kb.aria);

  /* Wege */
  const wege = () => p.evaluate(() => {
    const w = document.querySelector("#spSvg .sp-weg"); if(!w) return { da: false };
    const d = w.getAttribute("d"), st = getComputedStyle(w);
    return { da: true, teile: (d.match(/M/g) || []).length, dash: st.strokeDasharray, ruhe: st.pointerEvents, klasse: w.getAttribute("class"), farbe: w.style.stroke };
  });
  let w = await wege();
  pruef(w.da && w.teile === 1 && w.dash !== "none" && w.ruhe === "none", "genau EINE gestrichelte Linie (Tisch 2), fängt keinen Tipp", JSON.stringify(w));
  /* Ein zweiter Tisch mit Servieren → zweite Teilstrecke, nur zu Tischen DES Raums mit Küche */
  await stelle([{ id: "s4", quelle: "tisch", status: "arbeit", tisch: "10", zeitpunkt: new Date(Date.now() - 600000).toISOString(), summe: 5, positionen: [{ name: "Z", menge: 1, preis: 5 }], positionen_fertig: { "0": { f: new Date(Date.now() - 60000).toISOString() } } }]);
  w = await wege();
  const zone10 = await p.evaluate(() => { const t = SAAL.tische.find(x => x.nummer === "10"); return t ? saalTischZone(t) : null; });
  const zoneKue = await p.evaluate(() => saalLay()[saalKuecheRaum()].zone);
  const erwartet = 1 + (zone10 && zone10 === (await p.evaluate(() => saalLay()[saalKuecheRaum()].zone)) ? 1 : 0);
  pruef(w.da && w.teile === erwartet, "Linie nur zu Tischen im Raum der Küche (Tisch 10: " + zone10 + ", Küche: " + zoneKue + ")", "Teile " + w.teile + " erwartet " + erwartet);
  /* Nach Gebracht keine Linie mehr */
  await p.evaluate(() => { bestellungen.forEach(b => { if(b.positionen_fertig) Object.keys(b.positionen_fertig).forEach(k => { b.positionen_fertig[k].g = new Date().toISOString(); }); }); SAAL.sig = ""; zeichneAlles(); });
  await p.waitForTimeout(250);
  w = await wege();
  pruef(!w.da, "alles gebracht → keine Linie, kein „Servieren“", JSON.stringify(await tischArten("2")));

  /* Einrichten: Küche */
  await p.evaluate(() => { window.__rpc = []; demo = false; betriebId = "b-1";
    db = { rpc: (fn, a) => { window.__rpc.push({ fn, a: JSON.parse(JSON.stringify(a)) }); return Promise.resolve({ data: { ok: true }, error: null }); }, from: () => { const o = { update: () => o, eq: () => o, select: () => Promise.resolve({ data: [{ id: "x" }], error: null }) }; return o; } }; });
  await p.click('[data-sp-wz="einrichten"]'); await p.click('[data-sp-tab="masse"]');
  /* Seit 02.11. liegen die Meterfelder eingeklappt unter „Genaue Maße eintippen“ — echter Tipp öffnet sie. */
  await p.click("#spEdit [data-sp-genau] > summary");
  const ed = await p.evaluate(() => ({
    felder: [...document.querySelectorAll('#spEdit input[data-sp-kf]')].map(i => ({ f: i.dataset.spKf, v: i.value, fs: parseFloat(getComputedStyle(i).fontSize), h: i.getBoundingClientRect().height })),
    weg: !!document.querySelector("[data-sp-kueche-weg]"), neu: !!document.querySelector("[data-sp-kueche-neu]") }));
  pruef(ed.felder.length === 4 && ed.felder.every(x => x.fs >= 16 && x.h >= 44) && ed.weg && !ed.neu, "Haupt-Raum hat die Küche: vier Felder (16 px, ≥ 44 px), „Küche entfernen“, kein zweites „einzeichnen“", JSON.stringify(ed.felder.map(x => x.f + "=" + x.v)));
  /* Breite ändern: wächst sofort */
  await p.click('#spEdit [data-sp-kf="b"]'); await p.fill('#spEdit [data-sp-kf="b"]', "3,5"); await p.waitForTimeout(200);
  const kb2 = await p.evaluate(() => { const el = document.querySelector("#spSvg .sp-k-kueche .o"); const e = window.__ecken(el, SAAL_BODEN + 1.5); return { b: Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y), fokus: document.activeElement && document.activeElement.dataset.spKf }; });
  pruef(nah(kb2.b, 3.5, 0.06) && kb2.fokus === "b", "„3,5“ getippt: die Küche wächst sofort auf 3,5 m, das Feld behält den Fokus", kb2.b.toFixed(2) + " · " + kb2.fokus);
  /* Unsinn springt zurück */
  for(const v of ["abc", "0,2", "99", ""]){
    await p.fill('#spEdit [data-sp-kf="b"]', v); await p.evaluate(() => document.querySelector('#spEdit [data-sp-kf="b"]').dispatchEvent(new Event("change", { bubbles: true })));
    const nach = await p.evaluate(() => ({ v: document.querySelector('#spEdit [data-sp-kf="b"]').value, b: SAAL.konfigEntwurf.raeume[0].kueche.b }));
    pruef(nach.b === 3.5 && nach.v === "3,5", "Eingabe „" + v + "“ ändert nichts, das Feld springt auf 3,5 zurück", JSON.stringify(nach));
  }
  /* Zu groß für den Raum: die Küche bleibt im Raum */
  await p.fill('#spEdit [data-sp-kf="b"]', "30");
  const gross = await p.evaluate(() => { const r = SAAL.konfigEntwurf.raeume[0]; return { b: r.kueche.b, x: r.kueche.x, raum: r.b }; });
  pruef(gross.x + gross.b <= gross.raum + 1e-9, "30 m breite Küche in 12-m-Raum: bleibt im Raum", JSON.stringify(gross));
  await p.fill('#spEdit [data-sp-kf="b"]', "3,5");
  /* Speichern: Nutzlast trägt „kueche“ nur im Raum mit Küche */
  await p.click("[data-sp-speichern]"); await p.waitForTimeout(300);
  let a = await p.evaluate(() => window.__rpc[0]);
  pruef(a && a.fn === "saal_einstellungen_setzen" && a.a.p_daten.raeume[0].kueche && a.a.p_daten.raeume[0].kueche.b === 3.5 && Object.keys(a.a.p_daten.raeume[0].kueche).sort().join() === "b,t,x,y" && !("kueche" in a.a.p_daten.raeume[1]),
    "Nutzlast: kueche {b,t,x,y} nur im Haupt-Raum, nicht in der Terrasse", JSON.stringify(a && a.a.p_daten.raeume.map(r => Object.keys(r).join())));
  /* Entfernen und woanders einzeichnen: nur eine im Gebäude */
  await p.evaluate(() => { window.__rpc.length = 0; });
  await p.click('[data-sp-wz="einrichten"]'); await p.click('[data-sp-tab="masse"]');
  await p.click("[data-sp-kueche-weg]");
  pruef(await p.evaluate(() => !SAAL.konfigEntwurf.raeume[0].kueche && !document.querySelector("#spSvg .sp-k-kueche") && !!document.querySelector("[data-sp-kueche-neu]")), "„Küche entfernen“: weg aus dem Bild, „einzeichnen“ wieder angeboten");
  await p.click("[data-sp-kueche-neu]");
  const neuK = await p.evaluate(() => SAAL.konfigEntwurf.raeume[0].kueche);
  pruef(neuK && neuK.b >= 1 && neuK.t >= 1 && neuK.x >= 0 && neuK.y >= 0, "„Küche einzeichnen“ legt eine vernünftige Küche an", JSON.stringify(neuK));
  /* Zweiter Bereich: keine zweite Küche anbietbar */
  await p.evaluate(() => { SAAL.zone = saalZonen()[1]; saalEditZeichnen(); });
  const zwei = await p.evaluate(() => ({ neu: !!document.querySelector("[data-sp-kueche-neu]"), satz: (([...document.querySelectorAll("#spEdit .sp-editblock")].find(b => (b.querySelector(".sp-editname") || {}).textContent === "Küche") || document.body).querySelector(".sp-hinweis") || {}).textContent || "" }));
  pruef(!zwei.neu && /Küche steht im Bereich/.test(zwei.satz), "in der Terrasse: kein zweites „einzeichnen“, der Satz nennt den Bereich mit der Küche", zwei.satz);
  /* Auch erzwungen darf es nur eine geben */
  await p.click("[data-sp-speichern]"); await p.waitForTimeout(300);
  a = await p.evaluate(() => window.__rpc[0]);
  const mitKueche = a ? a.a.p_daten.raeume.filter(r => r.kueche).length : -1;
  pruef(mitKueche === 1, "gespeichert: genau EINE Küche im Gebäude", mitKueche);
  pruef(!pf.length, "keine Ausnahme im Saalplan", pf.join(" | ") || "still");
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try { await kueche(browser); } catch(e){ pruef(false, "Küchen-Teil lief durch", String(e).slice(0, 300)); }
  for(const b of [1280, 390]){ try { await board(browser, b); } catch(e){ pruef(false, "Board-Teil " + b + " lief durch", String(e).slice(0, 300)); } }
  try { await saal(browser); } catch(e){ pruef(false, "Saal-Teil lief durch", String(e).slice(0, 300)); }
  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if(f){ console.log(f + " FEHLER"); process.exit(1); }
  console.log("Alles sauber.");
})();
