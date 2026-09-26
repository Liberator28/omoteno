/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Notizen des Teams zu Bestellungen und Reservierungen

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-notizen.js

   Auftrag (26.09.): Mitarbeiter schreiben im Board und in der Küche
   Anmerkungen zu einer Bestellung/Reservierung. „Nur Team“ bleibt im
   Haus; „An den Gast“ sieht der Gast erst nach DOPPELTER Bestätigung.
   Bearbeiten jederzeit.

   Die Datenbankhälfte (Rechte, RLS, notiz_senden, text_anders, fremder
   Bezug, zweiter Durchgang) ist gegen den echten Bestand gefahren,
   zurückgedreht: 24 Proben, siehe migration-notizen.sql. Diese Prüfung
   hält die ANDERE Hälfte — und die Naht dazwischen (§8.1i): Was
   Board, Küche und Hub schicken, wird gegen die Signaturen und Rechte
   in migration-notizen.sql gehalten, als Quelltext.

   Die Seiten laufen mit einem gestellten Server (Board: db-Ersatz;
   Küche und Hub: page.route). Der gestellte Server vergleicht bei
   notiz_senden den Text wie der echte — das ist die einzige Regel, die
   er nachbaut, und sie steht gegen die SQL geprüft oben.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN  = path.resolve(__dirname, "..");
const SQL   = fs.readFileSync(path.join(OBEN, "datenbank", "migration-notizen.sql"), "utf8");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const KUECHE = path.join(OBEN, "seiten", "kueche.html");
const HUBQ  = path.join(OBEN, "vorlagen", "hub.vorlage.html");
const DIST  = path.join(OBEN, "dist", "chocolamour", "index.html");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

/* ── 1 · Die Naht als Quelltext ─────────────────────────────────── */
function naht() {
  console.log("\n══ Naht: was die Seiten schicken ↔ was die SQL erwartet ══");
  const sqlOhneKommentar = SQL.split("\n").map(z => z.replace(/--.*$/, "")).join("\n");
  const sig = name => {
    const m = sqlOhneKommentar.match(new RegExp("function public\\." + name + "\\(([^)]*)\\)", "i"));
    return m ? m[1].split(",").map(a => a.trim().split(/\s+/)[0]).filter(Boolean) : null;
  };
  const admin = fs.readFileSync(ADMIN, "utf8"), kueche = fs.readFileSync(KUECHE, "utf8"),
        hub = fs.readFileSync(HUBQ, "utf8");

  const senden = sig("notiz_senden");
  pruef(JSON.stringify(senden) === JSON.stringify(["p_id", "p_text"]), "notiz_senden(p_id, p_text) steht in der SQL", JSON.stringify(senden));
  pruef(/db\.rpc\("notiz_senden",\s*\{\s*p_id:[^,]+,\s*p_text:/.test(admin), "Board ruft notiz_senden mit p_id und p_text");
  pruef(/rpc\/notiz_senden[\s\S]{0,200}p_id:\s*z\.id,\s*p_text:/.test(kueche), "Küche ruft notiz_senden mit p_id und p_text");
  pruef(JSON.stringify(sig("notiz_zurueckziehen")) === '["p_id"]' &&
        /notiz_zurueckziehen",\s*\{\s*p_id/.test(admin) && /notiz_zurueckziehen[\s\S]{0,80}p_id/.test(kueche),
        "notiz_zurueckziehen(p_id) — beide Seiten schicken genau das");

  /* Gründe: Jeder Grund, den die SQL liefern kann, hat im Board einen Satz. */
  const gruende = [...new Set([...sqlOhneKommentar.matchAll(/'grund',\s*'([a-z_]+)'/g)].map(m => m[1]))];
  const sendenGruende = ["unbekannt", "geloescht", "nur_team", "text_anders"];
  pruef(sendenGruende.every(g => gruende.includes(g)), "die SQL kennt die vier Gründe von notiz_senden", gruende.join(", "));
  for (const [name, text] of [["Board", admin], ["Küche", kueche]]) {
    const fehlt = sendenGruende.filter(g => !new RegExp("\\b" + g + "\\b").test(text));
    pruef(!fehlt.length, name + ": jeder Grund von notiz_senden hat eine Antwort", fehlt.join(", ") || "alle");
  }
  pruef(/'text',\s*n\.text/.test(sqlOhneKommentar) && /data\.text/.test(admin) && /j\.text/.test(kueche),
        "text_anders bringt den neuen Text mit — und beide Seiten zeigen ihn");

  /* Spaltenrechte: was eingefügt/geändert wird, muss erlaubt sein. */
  const ins = (sqlOhneKommentar.match(/grant insert \(([^)]*)\) on public\.notizen/) || [, ""])[1].split(",").map(s => s.trim());
  const upd = (sqlOhneKommentar.match(/grant update \(([^)]*)\) on public\.notizen/) || [, ""])[1].split(",").map(s => s.trim());
  pruef(ins.length >= 5 && upd.length >= 3, "Spaltenrechte aus der SQL gelesen", "insert " + ins.join("/") + " · update " + upd.join("/"));
  pruef(!upd.includes("gesendet_text") && !upd.includes("gesendet_am"), "gesendet_* ist NICHT direkt änderbar (nur notiz_senden)");
  const kueInsert = (kueche.match(/JSON\.stringify\(\{ betrieb_id: betrieb\.id, bestellung_id: b\.id, an: z\.an, text: text \}\)/) ? ["betrieb_id", "bestellung_id", "an", "text"] : null);
  pruef(!!kueInsert && kueInsert.every(s => ins.includes(s)), "Küche fügt nur erlaubte Spalten ein", kueInsert && kueInsert.join(","));
  pruef(/update\(\{ text, an: nzZustand\.an \}\)/.test(admin) && /update\(\{ geloescht: true \}\)/.test(admin) &&
        ["text", "an", "geloescht"].every(s => upd.includes(s)), "Board ändert nur erlaubte Spalten (text, an, geloescht)");

  /* Hub ↔ Gast-Funktionen */
  pruef(JSON.stringify(sig("bestellung_nachrichten")) === '["nummer"]' &&
        /rpc\/bestellung_nachrichten[\s\S]{0,300}JSON\.stringify\(\{ nummer: v\.nummer \}\)/.test(hub),
        "Hub fragt bestellung_nachrichten mit {nummer} — die id der Bestellung");
  const resArgs = sig("reservierung_anfragen");
  const hubArgs = ((hub.match(/rpc\/reservierung_anfragen[\s\S]{0,400}?body: JSON\.stringify\(\{([\s\S]*?)\}\)/) || [, ""])[1]
    .match(/p_[a-z_]+/g) || []);
  pruef(!!resArgs && resArgs.length === hubArgs.length && resArgs.every(a => hubArgs.includes(a)),
        "Hub schickt reservierung_anfragen genau die Parameter der SQL", "SQL " + (resArgs || []).join(",") + " · Hub " + hubArgs.join(","));
  pruef(JSON.stringify(sig("reservierung_stand")) === '["nummer"]' && /rpc\/reservierung_stand[\s\S]{0,300}nummer: r\.id/.test(hub),
        "Hub fragt reservierung_stand mit {nummer} — die id aus der Antwort");
  pruef(/'id', v_id/.test(sqlOhneKommentar) && /j\.ok && j\.id/.test(hub), "die Antwort trägt die id, und der Hub merkt sie sich");
  /* Der Brems-Satz des Triggers muss im Wörterbuch stehen, sonst liest
     ein englischer Gast Deutsch. */
  for (const satz of ["Es liegen bereits Anfragen von Ihnen vor. Bitte rufen Sie uns an.",
                      "Gerade sehr viele Anfragen. Bitte kurz warten."]) {
    pruef(hub.includes('"' + satz + '":{en:'), "Wörterbuch kennt den Bremssatz", satz.slice(0, 40) + "…");
  }
}

/* ── 2 · Board ──────────────────────────────────────────────────── */
async function board(browser) {
  console.log("\n══ Board: schreiben, zweite Bestätigung, bearbeiten ══");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await s.goto("file://" + ADMIN);
  await s.waitForTimeout(700);
  await s.evaluate(() => {
    document.getElementById("tor").hidden = true;
    beispieldaten();
    /* Gestellter Server: nur notizen und die zwei Funktionen. */
    window.__srv = { notizen: [], einfuegen: [], aendern: [], rufe: [] };
    const tab = name => {
      const q = { f: [], op: "select", d: null, einzeln: false };
      q.select = () => q; q.eq = (k, v) => { q.f.push([k, v]); return q; };
      q.gte = () => q; q.order = () => q; q.single = () => { q.einzeln = true; return q; };
      q.insert = d => { q.op = "insert"; q.d = d; return q; };
      q.update = d => { q.op = "update"; q.d = d; return q; };
      q.then = (ok, nein) => Promise.resolve().then(() => {
        if (name !== "notizen") return { data: [], error: null };
        const S = window.__srv;
        if (q.op === "insert") {
          S.einfuegen.push(Object.keys(q.d));
          const z = Object.assign({ id: "n" + (S.notizen.length + 1), von_name: "probe", erstellt: new Date().toISOString(),
            gesendet_am: null, gesendet_text: null, geloescht: false, bestellung_id: null, reservierung_id: null }, q.d);
          z.text = z.text.trim(); S.notizen.push(z);
          return { data: q.einzeln ? Object.assign({}, z) : [Object.assign({}, z)], error: null };
        }
        const treffer = S.notizen.filter(z => q.f.every(([k, v]) => z[k] === v));
        if (q.op === "update") {
          S.aendern.push(Object.keys(q.d));
          treffer.forEach(z => { Object.assign(z, q.d); if (z.an === "team") { z.gesendet_am = null; z.gesendet_text = null; } });
          return { data: q.einzeln ? Object.assign({}, treffer[0]) : treffer.map(z => Object.assign({}, z)), error: null };
        }
        return { data: treffer.map(z => Object.assign({}, z)), error: null };
      }).then(ok, nein);
      return q;
    };
    db = { from: tab, rpc: (name, a) => Promise.resolve().then(() => {
      const S = window.__srv; S.rufe.push([name, a]);
      const z = S.notizen.find(x => x.id === a.p_id);
      if (!z) return { data: { ok: false, grund: "unbekannt" }, error: null };
      if (name === "notiz_senden") {
        if (z.an !== "gast") return { data: { ok: false, grund: "nur_team" }, error: null };
        if (String(a.p_text).trim() !== z.text) return { data: { ok: false, grund: "text_anders", text: z.text }, error: null };
        z.gesendet_text = z.text; z.gesendet_am = new Date().toISOString();
        return { data: { ok: true, am: z.gesendet_am }, error: null };
      }
      if (name === "notiz_zurueckziehen") { z.gesendet_text = null; z.gesendet_am = null; return { data: { ok: true }, error: null }; }
      return { data: null, error: { message: "unbekannt" } };
    }) };
    demo = false; betriebId = "B1";
    zeichneAlles(); zeichneReservierungen();
  });
  const scharf = await s.$("#scharfJetzt");
  if (scharf && await s.isVisible("#scharf")) { await scharf.click(); await s.waitForTimeout(200); }

  const erste = await s.evaluate(() => { const k = document.querySelector("#karten .bestellung"); return k ? k.dataset.id : null; });
  pruef(!!erste, "Voraussetzung: eine Bestellkarte steht da", erste);
  if (!erste) { await ctx.close(); return; }
  const statusVorher = await s.evaluate(id => bestellungen.find(b => b.id === id).status, erste);
  const karte = '#karten .bestellung[data-id="' + erste + '"]';

  await s.click(karte + " [data-nz-neu]");
  await s.waitForTimeout(250);
  const offen = await s.evaluate(() => ({ auf: !document.getElementById("nzBlatt").hidden,
    team: document.querySelector('#nzAn [data-an="team"]').getAttribute("aria-checked") }));
  pruef(offen.auf && offen.team === "true", "„+ Notiz“ öffnet das Blatt, vorgewählt „Nur Team“", JSON.stringify(offen));
  const feld = await s.evaluate(() => { const cs = getComputedStyle(document.getElementById("nzText")); return parseFloat(cs.fontSize); });
  pruef(feld >= 16, "Textfeld ≥ 16 px (sonst zoomt iOS)", feld + " px");

  await s.fill("#nzText", "  Allergie: Nüsse  ");
  await s.click("#nzWeiter");
  await s.waitForTimeout(450);
  const t1 = await s.evaluate(k => {
    const e = document.querySelector(k + " .nzeintrag");
    return { zu: document.getElementById("nzBlatt").hidden, text: e && e.querySelector(".nztext").textContent,
             marke: e && e.querySelector(".nzmarke").textContent, klasse: e && e.className };
  }, karte);
  pruef(t1.zu && t1.text === "Allergie: Nüsse" && /Nur Team/.test(t1.marke || ""), "Team-Notiz gespeichert und auf der Karte", JSON.stringify(t1));

  /* An den Gast: Stufe 1 speichert nur einen Entwurf. */
  await s.click(karte + " [data-nz-neu]");
  await s.waitForTimeout(250);
  await s.click('#nzAn [data-an="gast"]');
  const knopf = await s.textContent("#nzWeiter");
  pruef(/Bestätigung/.test(knopf), "„An den Gast“ macht aus „Speichern“ „Weiter zur Bestätigung“", knopf);
  await s.fill("#nzText", "Ihr Getränk kommt gleich");
  await s.click("#nzWeiter");
  await s.waitForTimeout(450);
  const t2 = await s.evaluate(() => {
    const S = window.__srv, z = S.notizen.find(x => x.an === "gast");
    return { stufe2: !document.getElementById("nzSchritt2").hidden, vorschau: document.getElementById("nzVorschau").textContent,
             gesendet: z && z.gesendet_am, rufe: S.rufe.length };
  });
  pruef(t2.stufe2 && t2.vorschau === "Ihr Getränk kommt gleich", "zweite Stufe zeigt GENAU den Text, den der Gast lesen wird", JSON.stringify(t2));
  pruef(!t2.gesendet && t2.rufe === 0, "nach Stufe 1 ist NICHTS gesendet (kein notiz_senden)", "gesendet=" + t2.gesendet + ", Rufe " + t2.rufe);
  const entwurf = await s.evaluate(k => { const e = [...document.querySelectorAll(k + " .nzeintrag")].pop(); return e && e.className + " | " + e.querySelector(".nzmarke").textContent; }, karte);
  pruef(/offen/.test(entwurf || "") && /noch nicht gesendet/.test(entwurf || ""), "die Karte sagt ehrlich „noch nicht gesendet“", entwurf);

  /* Dazwischen ändert jemand anderes den Text (zweites Gerät). */
  await s.evaluate(() => { window.__srv.notizen.find(x => x.an === "gast").text = "Ihr Getränk kommt in 5 Minuten"; });
  await s.click("#nzSenden");
  await s.waitForTimeout(400);
  const t3 = await s.evaluate(() => ({ stufe2: !document.getElementById("nzSchritt2").hidden,
    vorschau: document.getElementById("nzVorschau").textContent, meldung: document.getElementById("nzMeldung").textContent,
    gesendet: window.__srv.notizen.find(x => x.an === "gast").gesendet_am }));
  pruef(t3.stufe2 && t3.vorschau === "Ihr Getränk kommt in 5 Minuten" && /geändert/.test(t3.meldung) && !t3.gesendet,
        "Text inzwischen geändert → NICHT gesendet, neuer Stand steht zur Bestätigung", JSON.stringify(t3));
  await s.click("#nzSenden");
  await s.waitForTimeout(450);
  const t4 = await s.evaluate(k => {
    const z = window.__srv.notizen.find(x => x.an === "gast"), e = [...document.querySelectorAll(k + " .nzeintrag")].pop();
    return { zu: document.getElementById("nzBlatt").hidden, gt: z.gesendet_text, klasse: e.className, marke: e.querySelector(".nzmarke").textContent };
  }, karte);
  pruef(t4.zu && t4.gt === "Ihr Getränk kommt in 5 Minuten" && / gast/.test(" " + t4.klasse) && /gesendet \d/.test(t4.marke),
        "zweite Bestätigung sendet — Karte zeigt „gesendet HH:MM“", JSON.stringify(t4));

  /* Bearbeiten nach dem Senden: der Gast sieht weiter die alte Fassung. */
  await s.click(karte + " .nzeintrag.gast");
  await s.waitForTimeout(250);
  const vorbelegt = await s.inputValue("#nzText");
  pruef(vorbelegt === "Ihr Getränk kommt in 5 Minuten", "Tipp auf die Notiz öffnet sie zum Bearbeiten", vorbelegt);
  pruef(await s.isVisible("#nzZurueck"), "eine gesendete Nachricht lässt sich zurückziehen");
  await s.fill("#nzText", "Ihr Getränk kommt in 8 Minuten");
  await s.click("#nzWeiter"); await s.waitForTimeout(400);
  await s.click("#nzAendern"); await s.waitForTimeout(150);
  await s.click("#nzWeg"); await s.waitForTimeout(400);
  const t5 = await s.evaluate(k => {
    const z = window.__srv.notizen.find(x => x.an === "gast"), e = [...document.querySelectorAll(k + " .nzeintrag")].pop();
    return { text: z.text, gt: z.gesendet_text, marke: e.querySelector(".nzmarke").textContent };
  }, karte);
  pruef(t5.text === "Ihr Getränk kommt in 8 Minuten" && t5.gt === "Ihr Getränk kommt in 5 Minuten" && /Änderung noch nicht gesendet/.test(t5.marke),
        "Änderung ohne zweite Bestätigung: Gast sieht die alte Fassung, Karte sagt es", JSON.stringify(t5));

  const statusNachher = await s.evaluate(id => bestellungen.find(b => b.id === id).status, erste);
  pruef(statusVorher === statusNachher, "ein Tipp auf eine Notiz ändert den Status der Bestellung nicht", statusVorher + " → " + statusNachher);

  const masse = await s.evaluate(k => [...document.querySelectorAll(k + " .nzeintrag, " + k + " .nzneu")]
    .map(e => Math.round(e.getBoundingClientRect().height)), karte);
  pruef(masse.length >= 3 && masse.every(h => h >= 44), "jede Notiz und „+ Notiz“ ≥ 44 px hoch", masse.join(", "));

  /* Reservierung */
  await s.evaluate(() => {
    if (!reservierungen.length) reservierungen.push({ id: "r-probe", betrieb_id: "B1", name: "Familie Probe", telefon: "0170 1",
      personen: 4, wunsch: new Date(Date.now() + 3 * 3600000).toISOString(), status: "offen", quelle: "tisch", notiz: null });
    zeichneReservierungen();
  });
  await s.waitForTimeout(200);
  const res = await s.evaluate(() => { const k = document.querySelector("#resListe .res"); return k ? k.dataset.id : null; });
  pruef(!!res, "Voraussetzung: eine Reservierungskarte steht da", res);
  if (res) {
    await s.evaluate(id => document.querySelector('#resListe .res[data-id="' + id + '"] [data-nz-neu]').click(), res);
    await s.waitForTimeout(250);
    await s.fill("#nzText", "Stammgast, Fensterplatz");
    await s.click("#nzWeiter"); await s.waitForTimeout(400);
    const r = await s.evaluate(id => {
      const z = window.__srv.notizen.find(x => x.reservierung_id === id);
      const e = document.querySelector('#resListe .res[data-id="' + id + '"] .nzeintrag');
      return { gespeichert: !!z && z.bestellung_id === null, karte: e && e.querySelector(".nztext").textContent };
    }, res);
    pruef(r.gespeichert && r.karte === "Stammgast, Fensterplatz", "Notiz an einer Reservierung, mit reservierung_id statt bestellung_id", JSON.stringify(r));
  }

  const spalten = await s.evaluate(() => ({ ein: window.__srv.einfuegen, aend: window.__srv.aendern }));
  const erlaubtEin = ["betrieb_id", "bestellung_id", "reservierung_id", "an", "text"], erlaubtAend = ["text", "an", "geloescht"];
  pruef(spalten.ein.every(l => l.every(k => erlaubtEin.includes(k))) && spalten.aend.every(l => l.every(k => erlaubtAend.includes(k))),
        "Board schreibt nur Spalten mit Spaltenrecht", JSON.stringify(spalten));
  pruef(!fehler.length, "keine Ausnahme im Board", fehler.join(" | ") || "still");
  await ctx.close();
}

/* ── 3 · Küche ──────────────────────────────────────────────────── */
async function kueche(browser) {
  console.log("\n══ Küche: Notiz am Bon ══");
  const BETRIEB = "11111111-1111-1111-1111-111111111111";
  const BON = { id: "b-1", betrieb_id: BETRIEB, quelle: "tisch", status: "neu", tisch: "4",
    positionen: [{ name: "Crêpe", menge: 1, preis: 7 }], notiz: null, zeitpunkt: new Date().toISOString(),
    wartezeit_min: null, bestaetigt_um: null, kueche_fertig_um: null, theke_fertig_um: null, storno: [] };
  const SRV = { notizen: [{ id: "k1", bestellung_id: "b-1", an: "team", text: "ohne Nüsse", von_name: "anna",
    erstellt: new Date().toISOString(), gesendet_am: null, gesendet_text: null }], posts: [], rufe: [] };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.route("**/*", r => {
    const u = decodeURIComponent(r.request().url()), m = r.request().method();
    const json = b => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (u.startsWith("file://")) return r.continue();
    if (u.includes("/rest/v1/bestellungen")) return json([BON]);
    if (u.includes("/rest/v1/betriebe")) return json([{ id: BETRIEB, name: "Prüfhaus" }]);
    if (u.includes("/auth/")) return json({ access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: { id: "u1", email: "p@example.org" } });
    if (u.includes("/rest/v1/rpc/notiz_senden")) {
      const a = JSON.parse(r.request().postData() || "{}"); SRV.rufe.push(a);
      const z = SRV.notizen.find(x => x.id === a.p_id);
      if (!z) return json({ ok: false, grund: "unbekannt" });
      if (String(a.p_text).trim() !== z.text) return json({ ok: false, grund: "text_anders", text: z.text });
      z.gesendet_text = z.text; z.gesendet_am = new Date().toISOString(); return json({ ok: true, am: z.gesendet_am });
    }
    if (u.includes("/rest/v1/notizen")) {
      if (m === "GET") return json(SRV.notizen);
      if (m === "POST") {
        const d = JSON.parse(r.request().postData() || "{}"); SRV.posts.push(Object.keys(d));
        const z = Object.assign({ id: "k" + (SRV.notizen.length + 1), von_name: "probe", erstellt: new Date().toISOString(),
          gesendet_am: null, gesendet_text: null }, d);
        SRV.notizen.push(z); return r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify([z]) });
      }
    }
    return json([]);
  });
  await s.addInitScript(() => {
    localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({ access_token: "t", refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  });
  await s.goto("file://" + KUECHE);
  await s.waitForTimeout(1800);
  /* notizenHolen ist im Küchenskript nicht global (wie einstOeffnen,
     §8.1g C) — die Notizen kommen mit dem ersten Takt von selbst. */
  await s.waitForTimeout(600);
  const bon = await s.evaluate(() => {
    const b = document.querySelector('#feld .bon[data-id="b-1"]');
    return b ? { notiz: (b.querySelector(".nzeintrag .nztext") || {}).textContent || null,
                 knopf: !!b.querySelector('[data-tun="nz-neu"]') } : null;
  });
  pruef(!!bon, "Voraussetzung: der Bon steht auf dem Schirm", JSON.stringify(bon));
  if (bon) {
    pruef(bon.notiz === "ohne Nüsse" && bon.knopf, "Team-Notiz steht am Bon, „+ Notiz“ darunter", JSON.stringify(bon));
    await s.click('#feld .bon[data-id="b-1"] [data-tun="nz-neu"]');
    await s.waitForTimeout(300);
    const auf = await s.evaluate(() => { const t = document.getElementById("nzText"); return t ? parseFloat(getComputedStyle(t).fontSize) : null; });
    pruef(auf !== null && auf >= 16, "Blatt offen, Textfeld ≥ 16 px", auf);
    await s.click('#nzAn [data-w="gast"]');
    await s.fill("#nzText", "Ihr Tisch 4: Crêpe kommt gleich");
    await s.click("#nzWeiter"); await s.waitForTimeout(500);
    const st2 = await s.evaluate(() => ({ zwei: !document.getElementById("nzS2").hidden, v: document.getElementById("nzVorschau").textContent }));
    pruef(st2.zwei && st2.v === "Ihr Tisch 4: Crêpe kommt gleich" && SRV_rufe_leer(), "Küche: zweite Stufe mit Vorschau, noch nichts gesendet", JSON.stringify(st2));
    function SRV_rufe_leer() { return SRV.rufe.length === 0; }
    await s.click("#nzSenden"); await s.waitForTimeout(500);
    const g = SRV.notizen.find(x => x.an === "gast");
    pruef(!!g && g.gesendet_text === "Ihr Tisch 4: Crêpe kommt gleich" && SRV.rufe.length === 1,
          "Küche: „Wirklich senden“ schickt genau den Vorschautext", g && g.gesendet_text);
    /* „fertig()“ lädt die Notizen selbst nach. */
    await s.waitForTimeout(600);
    const marke = await s.evaluate(() => [...document.querySelectorAll('#feld .bon[data-id="b-1"] .nzeintrag')].map(e => e.className + "|" + e.querySelector(".nzmarke").textContent));
    pruef(marke.some(x => / gast\|/.test(x) && /gesendet/.test(x)), "Küche: Bon zeigt die Nachricht als gesendet", marke.join(" · "));
    pruef(SRV.posts.every(l => l.every(k => ["betrieb_id", "bestellung_id", "reservierung_id", "an", "text"].includes(k))),
          "Küche schreibt nur Spalten mit Spaltenrecht", JSON.stringify(SRV.posts));
  }
  pruef(!fehler.length, "keine Ausnahme in der Küche", fehler.join(" | ") || "still");
  await ctx.close();
}

/* ── 4 · Hub ────────────────────────────────────────────────────── */
async function hub(browser) {
  console.log("\n══ Hub: der Gast liest die Nachricht ══");
  if (!fs.existsSync(DIST)) { pruef(false, "erzeugter Hub fehlt (node erzeuger/erzeuge-hub.js --alle)"); return; }
  const NR = "22222222-2222-2222-2222-222222222222", RES = "33333333-3333-3333-3333-333333333333";
  let nachrichten = [], resStand = { ok: true, status: "offen", wunsch: new Date(Date.now() + 86400000).toISOString(), personen: 2, nachrichten: [] };
  const gesendet = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.route("**/*", r => {
    const u = r.request().url();
    const json = b => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (u.startsWith("file://")) return r.continue();
    if (u.includes("/rpc/bestellung_nachrichten")) { gesendet.push(["n", r.request().postData()]); return json(nachrichten); }
    if (u.includes("/rpc/bestellung_status")) return json([{ status: "fertig", wartezeit_min: 10, tagesnummer: 7 }]);
    if (u.includes("/rpc/reservierung_anfragen")) { gesendet.push(["r", r.request().postData()]); return json({ ok: true, id: RES }); }
    if (u.includes("/rpc/reservierung_stand")) { gesendet.push(["s", r.request().postData()]); return json(resStand); }
    if (u.includes("/rest/v1/betriebe")) return json([{ id: "af095b14-d9ef-41f4-9b97-c4422b0de63f", bestell_pause: false }]);
    if (u.includes("/rest/v1/")) return json([]);
    return r.abort();
  });
  await s.addInitScript(nr => {
    try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {}
    localStorage.setItem("omoteno-vorgaenge", JSON.stringify([{ nummer: nr, art: "bestellung", status: "arbeit", summe: 7,
      zeit: Date.now() - 60000, tagesnummer: 7,
      bestellung: { nummer: nr, tisch: "3", tagesnummer: 7, summe: 7, posten: [{ n: "Nutella Crêpe", m: 1, p: "7,00" }] } }]));
  }, NR);
  await s.goto("file://" + DIST);
  await s.waitForTimeout(1500);
  const vorher = await s.evaluate(() => { const v = document.getElementById("vstreifen"); return v && !v.hidden ? v.textContent : null; });
  pruef(!!vorher && !/Nachricht/.test(vorher), "Voraussetzung: Streifen steht, ohne Nachricht", vorher);

  nachrichten = [{ text: "Ihr Taxi ist da.", am: new Date().toISOString(), bearbeitet: false }];
  await s.evaluate(() => vorgaengeAbfragen());
  await s.waitForTimeout(600);
  const streifen = await s.evaluate(() => document.getElementById("vstreifen").textContent);
  pruef(/Neue Nachricht vom Haus/.test(streifen), "Streifen sagt „Neue Nachricht vom Haus“", streifen);
  pruef(gesendet.some(([a, b]) => a === "n" && JSON.parse(b).nummer === "22222222-2222-2222-2222-222222222222"),
        "gefragt wird mit der Nummer der eigenen Bestellung");
  const gespeichert = await s.evaluate(() => JSON.parse(localStorage.getItem("omoteno-vorgaenge"))[0].nachrichten);
  pruef(Array.isArray(gespeichert) && gespeichert[0].text === "Ihr Taxi ist da.", "Nachricht übersteht ein Neuladen (im Gerät gemerkt)");

  /* Der Text kommt vom Betrieb: er darf keine Auszeichnung einschleusen. */
  nachrichten = [{ text: "<img src=x onerror=alert(1)>Tisch frei", am: new Date().toISOString(), bearbeitet: true }];
  /* Über den Streifen, nicht über den Hash: erst der Tipp setzt
     letzteBestellung (so auch pruef-zusage.js). */
  await s.click("#vstreifen");
  await s.waitForTimeout(1500);
  await s.evaluate(() => vorgaengeAbfragen()); await s.waitForTimeout(700);
  const box = await s.evaluate(() => {
    const h = document.querySelector("#bstatus .hausnachricht");
    return h ? { text: h.querySelector(".hn-text").firstChild.textContent, img: !!h.querySelector("img"),
                 zeit: h.querySelector(".hn-zeit").textContent, titel: h.querySelector(".hn-titel").textContent } : null;
  });
  pruef(!!box && box.text === "<img src=x onerror=alert(1)>Tisch frei" && !box.img,
        "Bestätigungsseite zeigt die Nachricht als TEXT, nie als Auszeichnung", JSON.stringify(box));
  pruef(!!box && /aktualisiert/.test(box.zeit), "eine neu bestätigte Fassung heißt „aktualisiert“", box && box.zeit);

  /* Englisch: der Rahmen wird übersetzt, der Satz des Hauses nicht. */
  await s.evaluate(() => { sprache = "en"; zeichne(); });
  await s.waitForTimeout(500);
  const en = await s.evaluate(() => { const h = document.querySelector("#bstatus .hausnachricht"); return h ? h.querySelector(".hn-titel").textContent + " | " + h.querySelector(".hn-text").firstChild.textContent : null; });
  pruef(!!en && /Message from the house/.test(en) && /Tisch frei/.test(en), "Englisch: Rahmen übersetzt, Satz des Hauses wörtlich", en);
  await s.evaluate(() => { sprache = "de"; zeichne(); });

  /* Reservierung mit Nummer */
  await s.evaluate(() => { location.hash = "#/reservieren"; });
  await s.waitForTimeout(700);
  const morgen = new Date(Date.now() + 86400000);
  const tag = morgen.toISOString().slice(0, 10);
  await s.fill("#rTag", tag); await s.fill("#rZeit", "19:00"); await s.fill("#rPers", "2");
  await s.fill("#rName", "Probe Gast"); await s.fill("#rTel", "+49 170 1234567");
  await s.click('[data-aktion="reservieren"]');
  await s.waitForTimeout(900);
  const anfrage = gesendet.find(([a]) => a === "r");
  const felder = anfrage ? Object.keys(JSON.parse(anfrage[1])).sort().join(",") : "";
  pruef(felder === "p_betrieb_id,p_name,p_notiz,p_personen,p_telefon,p_wunsch", "Anfrage geht an reservierung_anfragen mit den p_-Feldern", felder);
  const karte1 = await s.evaluate(() => { const r = document.getElementById("resStand"); return r && !r.hidden ? r.textContent : null; });
  pruef(!!karte1 && /Wartet auf Bestätigung/.test(karte1) && /2 Personen/.test(karte1), "danach steht „Ihre Anfragen · Wartet auf Bestätigung“", karte1);
  resStand = Object.assign({}, resStand, { status: "bestaetigt", nachrichten: [{ text: "Fensterplatz ist reserviert.", am: new Date().toISOString(), bearbeitet: false }] });
  await s.evaluate(() => resStandHolen()); await s.waitForTimeout(600);
  const karte2 = await s.evaluate(() => document.getElementById("resStand").textContent);
  pruef(/Bestätigt/.test(karte2) && /Fensterplatz ist reserviert\./.test(karte2), "Bestätigung und Nachricht des Hauses erscheinen", karte2);
  const ueber = await s.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  pruef(ueber <= 1, "kein seitliches Schieben", ueber + " px");
  pruef(!fehler.length, "keine Ausnahme im Hub", fehler.join(" | ") || "still");
  await ctx.close();
}

(async () => {
  naht();
  const browser = await chromium.launch();
  try { await board(browser); } catch (e) { pruef(false, "Board-Teil lief durch", String(e).slice(0, 200)); }
  try { await kueche(browser); } catch (e) { pruef(false, "Küchen-Teil lief durch", String(e).slice(0, 200)); }
  try { await hub(browser); } catch (e) { pruef(false, "Hub-Teil lief durch", String(e).slice(0, 200)); }
  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
