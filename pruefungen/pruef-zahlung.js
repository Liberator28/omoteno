/* ═══════════════════════════════════════════════════════════════════
   pruef-zahlung.js — Online bezahlen und Überweisung im Gast-Hub

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-zahlung.js

   Der Hub wird mit gestellter Datenbank geöffnet (page.route). Was gemessen
   wird, ist der Weg des Gastes, nicht ein Baustein:

   A · Ohne Zahlarten (Standard, Migration fehlt, 404, Vorführhaus): nichts
       Neues sichtbar, Bestellung geht über die ALTE Funktion, und es wird
       genau EINMAL gefragt (kein Dauerfeuer).
   B · Mit Zahlarten: Auswahl im Warenkorb (Tisch: zwei Wege, Lieferung:
       drei), jede Fläche ≥ 44 px, Schrift ≥ 4,5:1 hell und dunkel, Tipp
       schaltet, Getipptes im Feld bleibt, kein Überlauf bei 360 px.
   C · Abschicken: die ZAHLUNGS-Funktion mit p_zahlart, sonst dieselben
       Felder wie vorher; die alte Funktion wird NICHT gerufen; danach geht
       der Hub zur Bezahlseite — und nur zu checkout.stripe.com.
   D · Die Wahl ist beim Absenden EINGEFROREN (§8.1q): Server stumm, Neuladen,
       zweiter Versuch trägt noch immer die Zahlart von damals.
   E · Rückkehr von Stripe (?zahlung=ok|abbruch): Bestellseite wird aus dem
       Gerätespeicher neu aufgebaut, Adresse bereinigt, „Zahlung wird bestätigt“
       bzw. „abgebrochen“ + Knopf, danach Bezahlt → normaler Bestellpass.
   F · Überweisung (nur Lieferung): Bankdaten NUR aus der Datenbank-Antwort,
       als Text (onerror bleibt Text), Kopieren legt genau die IBAN ab.
   G · Der Streifen sagt „Zahlung offen“, solange nicht bezahlt ist.
   H · Zahlung abgewiesen („Zahlungsart gibt es nicht“): kein Dauerversuch,
       ein Satz.
   I · Datenschutz nennt Stripe/Klarna/PayPal NUR, wenn das Haus sie hat.
   J · Alle neuen Sätze in allen elf Sprachen (aus dem Wörterbuch, nicht
       aus dieser Datei).

   Die Uhr steht fest, Öffnungszeiten setzt die Prüfung selbst (§8.1j).
   Was hier NICHT geprüft werden kann: eine echte Bezahlseite von Stripe.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DIST = process.env.DIST || path.join(__dirname, "..", "dist");
const HAEUSER = ["chocolamour", "blend"].filter(h => fs.existsSync(path.join(DIST, h, "index.html")));
if (HAEUSER.length < 2) { console.error("dist/ fehlt — erst node erzeuger/erzeuge-hub.js --alle"); process.exit(1); }
const BID = "11111111-2222-3333-4444-555555555555";
const ID1 = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
const UHR = new Date("2026-10-08T14:00:00");
const STRIPE_URL = "https://checkout.stripe.com/c/pay/cs_test_abcdefghij";
const ALLE = { stripe: true, karte: true, klarna: true, paypal: true, sepa: true, ueberweisung: true };
const NUR_STRIPE = { stripe: true, karte: true, klarna: true, paypal: true, sepa: false, ueberweisung: false };

let n = 0, f = 0;
function pruef(b, t, d) { n++; if (!b) f++; console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : "")); }

/* ── die gestellte Datenbank ─────────────────────────────────────── */
function netzNeu(o) {
  return Object.assign({
    zarten: ALLE,              // Antwort von zahlarten_oeffentlich; null → 404; "kaputt" → 500
    zartenAnfragen: 0,
    gesendet: [],              // { fn, body }
    starten: [],               // Körper an zahlung-starten
    startenAntwort: { ok: true, url: STRIPE_URL },
    stumm: false,
    abweisung: null,           // Text einer abgelehnten Bestellung
    status: { ok: true, status: "offen", art: "stripe", methode: null, betrag_cent: 1800, zweck: "Bestellung AAAAAAAA", ueberweisung: null },
    statusAnfragen: 0,
    stripeBesucht: [],
    alle: []
  }, o || {});
}

async function hubAuf(browser, haus, netz, opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: opt.breite || 390, height: 844 }, colorScheme: opt.schema || "light" });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.clock.setFixedTime(UHR);
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith("file://")) return r.continue();
    const body = r.request().postData() || "";
    netz.alle.push(u);
    const j = (status, wert) => r.fulfill({ status, contentType: "application/json", body: wert === undefined ? "" : JSON.stringify(wert) });
    if (/checkout\.stripe\.com/.test(u)) { netz.stripeBesucht.push(u); return r.fulfill({ status: 200, contentType: "text/html", body: "<title>stripe</title>" }); }
    if (/rest\/v1\/betriebe/.test(u)) {
      const z = { id: BID, bestell_pause: false, bestell_pause_text: "", hub_texte: {}, hub_kacheln: null, hub_woerter: null };
      if (opt.liefer) z.liefer = opt.liefer;
      return j(200, [z]);
    }
    const rpc = (/rpc\/([a-z_]+)/.exec(u) || [])[1];
    if (rpc === "zahlarten_oeffentlich") {
      netz.zartenAnfragen++;
      if (netz.zarten === null) return j(404, { message: "not found" });
      if (netz.zarten === "kaputt") return j(500, {});
      return j(200, netz.zarten);
    }
    if (rpc === "bestellung_aufgeben" || rpc === "bestellung_aufgeben_zahlung" || rpc === "bestellung_liefern" || rpc === "bestellung_liefern_zahlung") {
      const b = JSON.parse(body || "{}");
      netz.gesendet.push({ fn: rpc, body: b });
      if (netz.stumm) return r.fulfill({ status: 503, body: "" });
      if (netz.abweisung) return j(400, { message: netz.abweisung });
      const mitZ = /_zahlung$/.test(rpc);
      const z = mitZ ? { id: "z1", art: b.p_zahlart, status: "offen", betrag_cent: 1800 } : null;
      if (/aufgeben/.test(rpc)) return j(200, mitZ ? { ok: true, id: ID1, zahlung: z } : ID1);
      return j(200, Object.assign({ ok: true, id: ID1 }, mitZ ? { zahlung: z } : {}));
    }
    if (rpc === "zahlung_status") { netz.statusAnfragen++; return j(200, netz.status); }
    if (/functions\/v1\/zahlung-starten/.test(u)) { netz.starten.push(JSON.parse(body || "{}")); return j(200, netz.startenAntwort); }
    if (/rest\/v1\/aktionen/.test(u)) return j(200, []);
    if (rpc === "gast_melden") return j(200, { ok: true, neu: false, besuche: 1, lieblinge: [], gutscheine: [] });
    if (rpc === "bestellung_status") return j(200, [{ status: "neu", wartezeit_min: null, tagesnummer: 7 }]);
    return j(200, []);
  });
  await p.addInitScript(([slug, korb, vor]) => {
    try {
      sessionStorage.setItem("omoteno-willkommen", "1");
      localStorage.setItem("omoteno-willkommen", "1");
      if (korb) localStorage.setItem("omoteno-merk-" + slug, JSON.stringify({ "Waffel": { n: "Waffel", m: 2, p: "9,00" } }));
      if (vor && !localStorage.getItem("omoteno-vorgaenge")) localStorage.setItem("omoteno-vorgaenge", JSON.stringify(vor));
    } catch (e) {}
  }, [haus, opt.korb !== false, opt.vorgang || null]);
  await p.goto("file://" + path.join(DIST, haus, "index.html") + (opt.suffix || ""));
  await p.waitForTimeout(1300);
  await p.evaluate(() => { if (typeof ZEITEN === "undefined") return; ZEITEN.length = 0; for (let i = 0; i < 7; i++) ZEITEN.push("00:00 - 23:59"); });
  if (opt.licht) { await p.evaluate(w => lichtSetzen(w), opt.licht); await p.waitForTimeout(1100); }
  if (opt.zu !== false) { await p.evaluate(() => { location.hash = "#/auswahl"; }); await p.waitForTimeout(700); }
  return { p, ctx, fehler };
}

const anzahl = (netz, fn) => netz.gesendet.filter(x => x.fn === fn).length;

/* Kontrast: Schrift gegen den ersten deckenden Grund darüber (color(srgb …) wird gelesen). */
const KONTRAST = `(sel) => {
  const lies = c => {
    let m = /^rgba?\\(([^)]+)\\)$/.exec(c);
    if (m) { const t = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [t[0], t[1], t[2], t.length > 3 ? t[3] : 1]; }
    m = /^color\\(srgb ([^)]+)\\)$/.exec(c);
    if (m) { const t = m[1].split(/[ \\/]+/).filter(Boolean).map(Number); return [t[0] * 255, t[1] * 255, t[2] * 255, t.length > 3 ? t[3] : 1]; }
    return [0, 0, 0, 0];
  };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const el = document.querySelector(sel); if (!el) return null;
  const cs = getComputedStyle(el);
  let schrift = lies(cs.webkitTextFillColor && cs.webkitTextFillColor !== "rgba(0, 0, 0, 0)" ? cs.webkitTextFillColor : cs.color);
  const ketten = []; for (let e = el; e; e = e.parentElement) ketten.push(lies(getComputedStyle(e).backgroundColor));
  let grund = [255, 255, 255];
  for (let i = ketten.length - 1; i >= 0; i--) { const [r, g, b, a] = ketten[i]; if (a > 0) grund = [r * a + grund[0] * (1 - a), g * a + grund[1] * (1 - a), b * a + grund[2] * (1 - a)]; }
  const s = [schrift[0] * schrift[3] + grund[0] * (1 - schrift[3]), schrift[1] * schrift[3] + grund[1] * (1 - schrift[3]), schrift[2] * schrift[3] + grund[2] * (1 - schrift[3])];
  const a = lum(s), b = lum(grund);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}`;

(async () => {
  const browser = await chromium.launch();

  for (const haus of HAEUSER) {
    console.log("\n══ " + haus + " ══");

    /* ── A · nichts angeboten ─────────────────────────────────── */
    for (const [name, zarten] of [["Haus ohne Zahlarten", { stripe: false, ueberweisung: false }], ["Migration fehlt (404)", null], ["Fehler 500", "kaputt"]]) {
      const netz = netzNeu({ zarten });
      const { p, fehler } = await hubAuf(browser, haus, netz);
      const s = await p.evaluate(() => ({ zw: document.querySelectorAll(".zw").length, wahl: !!document.querySelector(".zahlwahl"), knopf: !!document.querySelector('[data-aktion="bestellen"]') }));
      pruef(s.knopf, "Voraussetzung (" + name + "): Bestellknopf ist da");
      pruef(s.zw === 0 && !s.wahl, name + ": keine Zahlungswahl sichtbar", s.zw);
      await p.evaluate(() => { location.hash = "#/"; }); await p.waitForTimeout(300);
      await p.evaluate(() => { location.hash = "#/auswahl"; }); await p.waitForTimeout(500);
      pruef(netz.zartenAnfragen === 1, name + ": genau EINE Anfrage nach den Zahlarten, kein Dauerfeuer", netz.zartenAnfragen);
      if (await p.$("#bTisch")) await p.fill("#bTisch", "7");
      await p.click('[data-aktion="bestellen"]'); await p.waitForTimeout(900);
      pruef(anzahl(netz, "bestellung_aufgeben") === 1 && anzahl(netz, "bestellung_aufgeben_zahlung") === 0,
        name + ": Bestellung geht über die ALTE Funktion", netz.gesendet.map(x => x.fn).join());
      const hinweis = await p.evaluate(() => /Hier wird nicht bezahlt/.test(document.body.innerText) || /Bezahlt wird beim Personal/.test(document.body.innerText));
      pruef(hinweis, name + ": der gewohnte Satz „bezahlt wird beim Personal“ steht weiter da");
      pruef(fehler.length === 0, name + ": kein Seitenfehler", fehler.join("|"));
      await p.context().close();
    }

    /* ── B · Auswahl am Tisch ─────────────────────────────────── */
    for (const [schema, licht] of [["light", "hell"], ["dark", "dunkel"]]) {
      const netz = netzNeu({ zarten: NUR_STRIPE });
      const { p, fehler } = await hubAuf(browser, haus, netz, { schema, licht });
      const opts = await p.evaluate(() => [...document.querySelectorAll(".zw")].map(b => ({
        id: b.dataset.zahlwahl, an: b.getAttribute("aria-pressed"), h: Math.round(b.getBoundingClientRect().height), b: Math.round(b.getBoundingClientRect().width),
        t: b.innerText.replace(/\s+/g, " ").trim() })));
      pruef(opts.length === 2 && opts[0].id === "ort" && opts[1].id === "stripe", "Tisch (" + licht + "): zwei Wege — beim Personal, online (keine Überweisung am Tisch)", opts.map(o => o.id).join());
      pruef(opts.length === 2 && opts[0].an === "true" && opts[1].an === "false", "Tisch (" + licht + "): ohne Wahl gilt „beim Personal“", opts.map(o => o.an).join());
      pruef(opts.length === 2 && opts.every(o => o.h >= 44), "Tisch (" + licht + "): jede Fläche ≥ 44 px hoch", opts.map(o => o.h).join());
      pruef(opts.length === 2 && /Bankkarte|Karte/.test(opts[1].t) && /Klarna/.test(opts[1].t) && /PayPal/.test(opts[1].t) && !/SEPA/.test(opts[1].t),
        "Tisch (" + licht + "): der Weg nennt genau die Arten, die das Haus hat (kein SEPA)", opts[1] && opts[1].t);
      const k = {};
      for (const sel of [".zw b", ".zw small", ".zahlwahl + .zahlhinweis, .zahlhinweis"]) k[sel] = await p.evaluate(`(${KONTRAST})(${JSON.stringify(sel)})`);
      pruef(k[".zw b"] >= 4.5 && k[".zw small"] >= 4.5, "Tisch (" + licht + "): Schrift der Wege ≥ 4,5:1", [k[".zw b"], k[".zw small"]].map(x => x && x.toFixed(2)).join(" / "));

      // getipptes Feld bleibt, Wahl schaltet
      if (await p.$("#bTisch")) await p.fill("#bTisch", "7");
      await p.fill("#bNotiz", "ohne Zwiebeln");
      await p.click('[data-zahlwahl="stripe"]'); await p.waitForTimeout(300);
      const s1 = await p.evaluate(() => ({ notiz: document.getElementById("bNotiz").value, tisch: (document.getElementById("bTisch") || {}).value,
        an: document.querySelector('[data-zahlwahl="stripe"]').getAttribute("aria-pressed"), fokus: document.activeElement && document.activeElement.dataset.zahlwahl,
        satz: (document.getElementById("zahlsatz") || {}).innerText || "", altHinweis: /Hier wird nicht bezahlt/.test(document.body.innerText) }));
      pruef(s1.an === "true" && s1.fokus === "stripe", "Tipp schaltet auf „online“, Fokus bleibt auf dem Weg", s1.fokus);
      pruef(s1.notiz === "ohne Zwiebeln" && s1.tisch === "7", "Getipptes (Tisch, Anmerkung) bleibt beim Umschalten");
      pruef(/Stripe/.test(s1.satz) && !s1.altHinweis, "Online: Satz zu Stripe steht da, der Satz „hier wird nicht bezahlt“ ist weg", s1.satz.slice(0, 40));
      await p.click('[data-zahlwahl="ort"]'); await p.waitForTimeout(300);
      const s2 = await p.evaluate(() => ({ satz: !!document.getElementById("zahlsatz"), alt: /Hier wird nicht bezahlt/.test(document.body.innerText) }));
      pruef(!s2.satz && s2.alt, "zurück auf „beim Personal“: Stripe-Satz weg, alter Satz wieder da");
      pruef(fehler.length === 0, "kein Seitenfehler", fehler.join("|"));
      await p.context().close();
    }

    /* ── 360 px: kein Überlauf ──────────────────────────────── */
    {
      const netz = netzNeu({ zarten: ALLE });
      const { p } = await hubAuf(browser, haus, netz, { breite: 360, liefer: { an: true, plz: ["35037"], mindest: 0, gebuehr: 2.5, gratis_ab: 0, dauer_min: 30, bar: true, karte: true }, suffix: "?modus=liefern" });
      await p.waitForTimeout(400);
      const o = await p.evaluate(() => ({ ids: [...document.querySelectorAll(".zw")].map(b => b.dataset.zahlwahl), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        raus: [...document.querySelectorAll(".zw, .zw b, .zw small")].filter(e => e.scrollWidth > e.clientWidth + 1).length }));
      pruef(o.ids.join() === "ort,stripe,ueberweisung", "Lieferung: drei Wege, Überweisung nur hier", o.ids.join());
      pruef(o.sw <= o.cw && o.raus === 0, "360 px: kein seitlicher Überlauf, kein abgeschnittener Text", o.sw + "/" + o.cw + ", raus=" + o.raus);
      await p.context().close();
    }

    /* ── C · Abschicken am Tisch ────────────────────────────── */
    {
      const netz = netzNeu({ zarten: NUR_STRIPE });
      const { p, fehler } = await hubAuf(browser, haus, netz);
      if (await p.$("#bTisch")) await p.fill("#bTisch", "7");
      await p.click('[data-zahlwahl="stripe"]'); await p.waitForTimeout(250);
      await p.click('[data-aktion="bestellen"]');
      await p.waitForURL(/checkout\.stripe\.com/, { timeout: 8000 }).catch(() => {});
      const z = netz.gesendet.filter(x => x.fn === "bestellung_aufgeben_zahlung");
      pruef(z.length === 1 && anzahl(netz, "bestellung_aufgeben") === 0, "Online: die Zahlungs-Funktion wird gerufen, die alte NICHT", netz.gesendet.map(x => x.fn).join());
      const b = z[0] && z[0].body || {};
      pruef(b.p_zahlart === "stripe" && b.p_quelle === "tisch" && b.p_tisch === "7" && b.p_summe === 18 && b.p_betrieb_id === BID
            && Array.isArray(b.p_positionen) && b.p_positionen.length === 1 && b.p_gast_kennung && b.p_geraet,
        "…mit Zahlart UND allen Feldern von vorher (Tisch, Summe, Positionen, Kennung, Gerät)", JSON.stringify(Object.keys(b).sort()));
      pruef(netz.starten.length === 1 && netz.starten[0].bestellung_id === ID1, "danach: zahlung-starten mit genau dieser Bestellnummer", JSON.stringify(netz.starten[0]));
      pruef(netz.starten.length === 1 && !("betrag" in netz.starten[0]) && !("betrag_cent" in netz.starten[0]) && !("stripe_konto" in netz.starten[0]),
        "…und OHNE Betrag oder Konto (die kommen aus der Datenbank)", Object.keys(netz.starten[0] || {}).join());
      pruef(netz.stripeBesucht.length === 1 && netz.stripeBesucht[0] === STRIPE_URL, "der Hub geht zur Bezahlseite — genau zu ihrer Adresse", netz.stripeBesucht.join());
      pruef(fehler.length === 0, "kein Seitenfehler", fehler.join("|"));
      await p.context().close();
    }
    /* Fremde Adresse als Bezahlseite → der Hub springt NICHT */
    {
      const netz = netzNeu({ zarten: NUR_STRIPE, startenAntwort: { ok: true, url: "https://evil.example/pay" } });
      const { p } = await hubAuf(browser, haus, netz);
      if (await p.$("#bTisch")) await p.fill("#bTisch", "7");
      await p.click('[data-zahlwahl="stripe"]'); await p.click('[data-aktion="bestellen"]');
      await p.waitForTimeout(1800);
      const url = p.url();
      pruef(!/evil\.example/.test(url) && netz.alle.every(u => !/evil\.example/.test(u)), "eine fremde Adresse als „Bezahlseite“ wird NICHT aufgerufen", url.slice(0, 40));
      const satz = await p.evaluate(() => { const z = document.getElementById("zahlfehler"); return z && !z.hidden ? z.innerText : ""; });
      pruef(/zahlen Sie beim Personal/.test(satz), "…stattdessen steht im Block ein sichtbarer Satz, der den Ausweg nennt (kein #melde auf dieser Seite)", satz.slice(0, 50));
      await p.context().close();
    }

    /* ── D · eingefroren (§8.1q) ────────────────────────────── */
    {
      const netz = netzNeu({ zarten: NUR_STRIPE, stumm: true });
      const { p } = await hubAuf(browser, haus, netz);
      if (await p.$("#bTisch")) await p.fill("#bTisch", "7");
      await p.click('[data-zahlwahl="stripe"]'); await p.click('[data-aktion="bestellen"]');
      await p.waitForTimeout(900);
      const erst = netz.gesendet.length;
      pruef(erst >= 1 && netz.gesendet[0].fn === "bestellung_aufgeben_zahlung", "Voraussetzung: der erste Versuch ging hinaus (und scheiterte)", erst);
      // anderes Angebot nach dem Neuladen: keine Zahlarten mehr — die wartende Bestellung muss trotzdem ihre Zahlart tragen
      netz.zarten = { stripe: false, ueberweisung: false }; netz.stumm = false;
      await p.clock.setFixedTime(new Date(UHR.getTime() + 10 * 60000));
      await p.reload(); await p.waitForTimeout(1500);
      await p.evaluate(() => { if (typeof wsAbarbeiten === "function") { warteschlange.forEach(e => e.naechster = 0); wsAbarbeiten(); } });
      await p.waitForTimeout(1500);
      const zw = netz.gesendet.slice(erst);
      pruef(zw.length >= 1 && zw.every(x => x.fn === "bestellung_aufgeben_zahlung" && x.body.p_zahlart === "stripe"),
        "Neuladen + zweiter Versuch: trägt noch die Zahlart von damals (nicht die neue Lage)", zw.map(x => x.fn + ":" + x.body.p_zahlart).join());
      pruef(zw.length >= 1 && zw[0].body.p_gast_kennung === netz.gesendet[0].body.p_gast_kennung, "…mit derselben Quittungsnummer (keine Doppelbestellung)");
      await p.context().close();
    }

    /* ── E · Rückkehr von Stripe ────────────────────────────── */
    const VORGANG = [{ art: "bestellung", nummer: ID1, status: "neu", zeit: Date.now(), tisch: "7", summe: 18,
      zahlung: { art: "stripe", status: "offen", betrag_cent: 1800 },
      bestellung: { nummer: ID1, tisch: "7", posten: [{ n: "Waffel", m: 2, p: "9,00" }], summe: 18, notiz: "" } }];
    {
      const netz = netzNeu({ zarten: NUR_STRIPE });
      const { p, fehler } = await hubAuf(browser, haus, netz, { korb: false, zu: false, vorgang: VORGANG, suffix: "?zahlung=ok#/bestellt" });
      await p.waitForTimeout(600);
      const s = await p.evaluate(() => ({ url: location.href, h2: (document.querySelector("#inhalt h2") || {}).innerText, haken: !!document.querySelector(".haken"),
        block: (document.querySelector(".zahlblock") || {}).innerText || "", knopf: !!document.querySelector("[data-zahlung-los]"), pass: !!document.getElementById("bpass") }));
      pruef(!/\?zahlung/.test(s.url), "Rückkehr ok: ?zahlung=… ist aus der Adresse entfernt", s.url.replace(/^.*dist/, ""));
      pruef(/Fast geschafft/.test(s.h2) && !s.haken && !s.pass, "Bestellseite aus dem Gerät aufgebaut: „Fast geschafft“, kein Haken, kein Küchenpass", s.h2);
      pruef(/Zahlung wird bestätigt/.test(s.block) && !s.knopf, "…„Zahlung wird bestätigt“, noch kein zweiter Bezahlknopf (Doppelzahlung)", s.block.slice(0, 40));
      pruef(netz.statusAnfragen >= 1, "…der Hub fragt die Zahlung ab", netz.statusAnfragen);
      netz.status = Object.assign({}, netz.status, { status: "bezahlt", methode: "klarna" });
      await p.waitForFunction(() => !!document.getElementById("bpass"), null, { timeout: 9000 }).catch(() => {});
      const t = await p.evaluate(() => ({ h2: (document.querySelector("#inhalt h2") || {}).innerText, block: (document.querySelector(".zahlblock") || {}).innerText || "", pass: !!document.getElementById("bpass"),
        streifen: (document.getElementById("vstreifen") || {}).innerText || "" }));
      pruef(/Bestellung ist da/.test(t.h2) && t.pass && /Bezahlt/.test(t.block), "nach „bezahlt“: normaler Bestellpass und „Bezahlt“", t.h2 + " / " + t.block.slice(0, 20));
      const hinweis = await p.evaluate(() => /Bezahlt wird beim Personal/.test(document.body.innerText));
      pruef(!hinweis, "…und der Satz „bezahlt wird beim Personal“ steht NICHT mehr da (wäre falsch)");
      pruef(fehler.length === 0, "kein Seitenfehler", fehler.join("|"));
      await p.context().close();
    }
    {
      const netz = netzNeu({ zarten: NUR_STRIPE });
      const { p } = await hubAuf(browser, haus, netz, { korb: false, zu: false, vorgang: VORGANG, suffix: "?zahlung=abbruch#/bestellt" });
      await p.waitForTimeout(600);
      const s = await p.evaluate(() => ({ block: (document.querySelector(".zahlblock") || {}).innerText || "", knopf: document.querySelector("[data-zahlung-los]") ? Math.round(document.querySelector("[data-zahlung-los]").getBoundingClientRect().height) : 0 }));
      pruef(/abgebrochen/.test(s.block) && s.knopf >= 44, "Rückkehr abbruch: Satz „abgebrochen“ + Knopf „Jetzt bezahlen“ ≥ 44 px", s.block.slice(0, 50));
      const kb = await p.evaluate(`(${KONTRAST})("[data-zahlung-los]")`);
      pruef(kb >= 4.5, "Bezahlknopf: Schrift ≥ 4,5:1", kb && kb.toFixed(2));
      await p.click("[data-zahlung-los]");
      await p.waitForURL(/checkout\.stripe\.com/, { timeout: 6000 }).catch(() => {});
      pruef(netz.starten.length === 1 && netz.starten[0].bestellung_id === ID1 && netz.stripeBesucht.length === 1, "Tipp auf „Jetzt bezahlen“ holt eine neue Bezahlseite und geht hin", netz.starten.length + "/" + netz.stripeBesucht.length);
      await p.context().close();
    }
    /* ── G · Streifen ───────────────────────────────────────── */
    {
      const netz = netzNeu({ zarten: NUR_STRIPE });
      const { p } = await hubAuf(browser, haus, netz, { korb: false, zu: false, vorgang: VORGANG });
      await p.evaluate(() => { location.hash = "#/speisekarte"; }); await p.waitForTimeout(700);
      const st = await p.evaluate(() => { const e = document.getElementById("vstreifen"); return { sicht: e && !e.hidden, text: e ? e.innerText : "" }; });
      pruef(st.sicht && /Zahlung offen/.test(st.text), "Streifen auf jeder Seite: „Zahlung offen – bitte bezahlen“", st.text.replace(/\s+/g, " ").slice(0, 60));
      netz.status = Object.assign({}, netz.status, { status: "bezahlt" });
      await p.evaluate(() => vorgaengeAbfragen()); await p.waitForTimeout(900);
      const st2 = await p.evaluate(() => (document.getElementById("vstreifen") || {}).innerText || "");
      pruef(!/Zahlung offen/.test(st2), "…nach der Zahlung steht er nicht mehr da, auch ohne die Bestellseite zu öffnen", st2.replace(/\s+/g, " ").slice(0, 50));
      await p.context().close();
    }
    /* ── H · abgewiesen ─────────────────────────────────────── */
    {
      const netz = netzNeu({ zarten: NUR_STRIPE, abweisung: "Diese Zahlungsart gibt es hier gerade nicht." });
      const { p } = await hubAuf(browser, haus, netz);
      if (await p.$("#bTisch")) await p.fill("#bTisch", "7");
      await p.click('[data-zahlwahl="stripe"]'); await p.click('[data-aktion="bestellen"]');
      await p.waitForTimeout(1500);
      const s = await p.evaluate(() => ({ strip: (document.getElementById("wsstreifen") || {}).innerText || "", zustand: warteschlange.map(e => e.zustand + ":" + (e.grund || "")).join() }));
      pruef(netz.gesendet.length === 1, "abgewiesene Zahlungsart: KEIN Dauerversuch (ein Aufruf)", netz.gesendet.length);
      pruef(/Zahlungsart gibt es gerade nicht/.test(s.strip) && /gescheitert:zahlart/.test(s.zustand), "…ein Satz sagt es dem Gast", s.strip.replace(/\s+/g, " ").slice(0, 60));
      await p.context().close();
    }

    /* ── F · Überweisung (Lieferung) ────────────────────────── */
    {
      const bank = { iban: "DE89370400440532013000", kontoinhaber: "Choco <img src=x onerror=window.__x=1> GmbH", bic: "COBADEFFXXX", bank: "Commerzbank" };
      const VORG_U = [{ art: "bestellung", nummer: ID1, status: "neu", zeit: Date.now(), summe: 18,
        zahlung: { art: "ueberweisung", status: "offen", betrag_cent: 2050 },
        bestellung: { nummer: ID1, tisch: null, posten: [{ n: "Waffel", m: 2, p: "9,00" }], summe: 18, notiz: "" } }];
      const netz = netzNeu({ zarten: ALLE, status: { ok: true, status: "offen", art: "ueberweisung", methode: null, betrag_cent: 2050, zweck: "Bestellung AAAAAAAA", ueberweisung: bank } });
      const { p, fehler } = await hubAuf(browser, haus, netz, { korb: false, zu: false, vorgang: VORG_U, suffix: "#/bestellt" });
      await p.evaluate(() => { letzteBestellung = vorgaenge[0].bestellung; location.hash = "#/"; }); await p.waitForTimeout(200);
      await p.evaluate(() => { location.hash = "#/bestellt"; }); await p.waitForTimeout(1500);
      const s = await p.evaluate(() => ({ text: document.querySelector(".zahlblock") ? document.querySelector(".zahlblock").innerText : "", img: document.querySelectorAll(".zahlblock img").length,
        x: window.__x === 1, koepfe: [...document.querySelectorAll(".bkopie")].map(b => Math.round(b.getBoundingClientRect().height)), h2: (document.querySelector("#inhalt h2") || {}).innerText }));
      pruef(/DE89370400440532013000/.test(s.text.replace(/\s/g, "")) && /COBADEFFXXX/.test(s.text) && /Bestellung AAAAAAAA/.test(s.text) && /20,50/.test(s.text),
        "Überweisung: IBAN, BIC, Verwendungszweck, Betrag stehen da", s.text.replace(/\s+/g, " ").slice(0, 80));
      pruef(s.img === 0 && !s.x && /onerror/.test(s.text), "Name des Empfängers nur als Text (<img onerror> bleibt Text, läuft nicht)");
      pruef(s.koepfe.length >= 3 && s.koepfe.every(h => h >= 44), "Kopieren-Knöpfe ≥ 44 px", s.koepfe.join());
      pruef(/Fast geschafft/.test(s.h2), "kein Haken, solange nicht eingegangen", s.h2);
      await p.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
      await p.evaluate(() => { window.__kopiert = null; Object.defineProperty(navigator, "clipboard", { value: { writeText: t => { window.__kopiert = t; return Promise.resolve(); } }, configurable: true }); });
      await p.click('.bankzeile:has-text("IBAN") .bkopie'); await p.waitForTimeout(200);
      const kop = await p.evaluate(() => window.__kopiert);
      pruef(kop === "DE89370400440532013000", "Kopieren legt GENAU die IBAN ab (ohne Leerzeichen)", kop);
      pruef(fehler.length === 0, "kein Seitenfehler", fehler.join("|"));
      await p.context().close();
    }

    /* ── I · Datenschutz ─────────────────────────────────────── */
    {
      const lies = async zarten => {
        const netz = netzNeu({ zarten });
        const { p } = await hubAuf(browser, haus, netz, { zu: false });
        await p.evaluate(() => { location.hash = "#/datenschutz"; }); await p.waitForTimeout(900);
        const t = await p.evaluate(() => document.getElementById("inhalt").innerText);
        await p.context().close();
        return t;
      };
      const keins = await lies({ stripe: false, ueberweisung: false });
      pruef(!/Stripe|Klarna|PayPal \(Europe\)|Überweisung/.test(keins.replace(/Trinkgeld[\s\S]*?PayPal[\s\S]*?\./, "")), "Datenschutz ohne Zahlarten: kein Wort zu Stripe, Klarna, Überweisung");
      const nurKarte = await lies({ stripe: true, karte: true, klarna: false, paypal: false, sepa: false, ueberweisung: false });
      pruef(/Stripe Payments Europe/.test(nurKarte) && !/Klarna Bank/.test(nurKarte) && !/SEPA-Lastschrift erteilen/.test(nurKarte) && !/Bei einer Überweisung/.test(nurKarte),
        "Datenschutz mit nur Karte: Stripe ja, Klarna/SEPA/Überweisung nein");
      const alles = await lies(ALLE);
      pruef(/Klarna Bank AB/.test(alles) && /Mandat/.test(alles) && /Bei einer Überweisung/.test(alles) && /Datenschutz\/?|Data Privacy/.test(alles), "Datenschutz mit allem: Klarna, SEPA, Überweisung genannt");
    }
  }

  /* ── J · Übersetzungen ───────────────────────────────────────────── */
  console.log("\n══ Sprachen ══");
  {
    const netz = netzNeu({ zarten: ALLE });
    const { p } = await hubAuf(browser, HAEUSER[0], netz, { zu: false });
    const fehlt = await p.evaluate(() => {
      const keys = ["SO BEZAHLEN SIE", "So bezahlen Sie", "Beim Personal", "Wie immer am Tisch", "Bei Lieferung", "Online bezahlen", "Überweisung", "Vorab auf unser Konto", "Bankkarte",
        "Sie bezahlen auf der sicheren Seite von Stripe. Karten- und Kontodaten sehen weder wir noch das Haus. Die Küche bekommt Ihre Bestellung, sobald die Zahlung bestätigt ist.",
        "Nach dem Bestellen sehen Sie die Bankverbindung. Die Küche beginnt erst, wenn Ihre Überweisung beim Haus eingegangen ist – das kann ein bis zwei Werktage dauern.",
        "Für eine Online-Zahlung ist der Betrag zu klein. Bitte zahlen Sie beim Personal.", "Fast geschafft!", "Ihre Bestellung ist vorgemerkt. Sie geht an die Küche, sobald bezahlt ist.",
        "Jetzt bezahlen", "Zahlung wird bestätigt …", "Das dauert nur einen Moment. Bei Lastschrift kann es länger dauern – sagen Sie dann dem Personal Bescheid.",
        "Die Zahlung wurde abgebrochen. Ihre Bestellung ist noch nicht in der Küche.", "Die Zahlung hat nicht geklappt. Sie können es noch einmal versuchen – oder beim Personal bezahlen.",
        "Bezahlt", "Danke, Ihre Zahlung ist angekommen.", "Bitte jetzt überweisen", "Empfänger", "Bank", "Betrag", "Verwendungszweck", "Kopieren", "Kopiert.",
        "Bitte genau so angeben, damit wir Ihre Zahlung zuordnen können.", "Die Küche beginnt, sobald Ihre Überweisung eingegangen ist.", "Zahlung offen – bitte bezahlen",
        "Warten auf Ihre Überweisung", "Diese Bestellung ist nicht mehr offen.", "Zu viele Versuche. Bitte sagen Sie dem Personal Bescheid.",
        "Das Bezahlen klappt gerade nicht. Bitte versuchen Sie es gleich noch einmal oder zahlen Sie beim Personal.", "Diese Zahlungsart gibt es gerade nicht"];
      const codes = SPRACHEN.map(s => s.code).filter(c => c !== "de");
      const luecken = [];
      for (const c of codes) {
        const alt = sprache; sprache = c;
        for (const k of keys) { const v = t(k); if (k === "Bank" && (c === "en" || c === "pl" || c === "nl")) continue; /* gleiches Wort, namentlich */ if (v === k || !String(v).trim()) luecken.push(c + ": " + k.slice(0, 30)); }
        sprache = alt;
      }
      return { codes: codes.length, luecken };
    });
    pruef(fehlt.codes === 11, "Voraussetzung: elf Fremdsprachen im Hub", fehlt.codes);
    pruef(fehlt.luecken.length === 0, "jeder neue Satz ist in allen elf Sprachen übersetzt (t() liefert nicht den deutschen Schlüssel)", fehlt.luecken.slice(0, 4).join(" | "));
    // am gemalten Bild: Englisch, Warenkorb
    await p.evaluate(() => spracheSetzen("en")); await p.waitForTimeout(300);
    await p.evaluate(() => { location.hash = "#/auswahl"; }); await p.waitForTimeout(700);
    const en = await p.evaluate(() => ({ wahl: (document.querySelector(".zahlwahl") || {}).innerText || "", label: [...document.querySelectorAll(".label")].map(l => l.innerText).join("|") }));
    pruef(/How to pay/i.test(en.label) && /Pay online/.test(en.wahl) && /With the staff/.test(en.wahl), "Englisch am Bild: „HOW TO PAY“, „Pay online“, „With the staff“", en.wahl.replace(/\s+/g, " ").slice(0, 60));
    await spracheArabisch(p, pruef);
    await p.context().close();
  }

  await browser.close();
  console.log("\n" + (n - f) + "/" + n + " bestanden");
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

async function spracheArabisch(p, pruef) {
  await p.evaluate(() => spracheSetzen("ar")); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = "#/"; }); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = "#/auswahl"; }); await p.waitForTimeout(700);
  const ar = await p.evaluate(() => {
    const w = document.querySelector(".zahlwahl");
    return { dir: document.documentElement.dir, text: w ? w.innerText : "", sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  pruef(ar.dir === "rtl" && /ادفع/.test(ar.text) && ar.sw <= ar.cw, "Arabisch: rechts-nach-links, übersetzt, kein Überlauf", ar.text.replace(/\s+/g, " ").slice(0, 40));
}
