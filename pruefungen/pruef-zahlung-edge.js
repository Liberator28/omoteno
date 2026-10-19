/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die beiden Zahlungs-Funktionen (zahlung-starten, stripe-webhook)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-zahlung-edge.js

   Geprüft wird der Quelltext, der WIRKLICH ausgerollt wird: index.ts wird
   mit typescript übersetzt und mit gestelltem Deno / fetch ausgeführt —
   keine Kopie hier (Muster wie pruef-alessia.js). Die Unterschrift des
   Webhooks berechnet DIESE Prüfung selbst mit Nodes crypto (zweite Quelle,
   nicht die Funktion gegen sich selbst).

   zahlung-starten: Betrag, Konto und Zahlarten kommen aus der Datenbank, nie
   aus der Anfrage; Stripe-Konto als Kopfzeile; Rückkehradresse nur auf
   omoteno.de, passend zur Herkunft, Pfad nur / oder /h/<slug>/; ein
   Stripe-Fehler wird zum Satz, nie zum Rohtext; der Schlüssel geht nur an
   api.stripe.com.
   stripe-webhook: ohne gültige Unterschrift kein einziger Aufruf; falsches
   Konto / falscher Betrag / „unpaid“ geben NICHT frei; SEPA erst bei
   async_payment_succeeded; Datenbankfehler → 500 + Eintrag frei; doppeltes
   Ereignis wird nicht noch einmal verarbeitet.
   Was hier NICHT geprüft werden kann: ein echter Stripe-Lauf.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const nodeCrypto = require("crypto");
const ts = require("typescript");

const FKT = path.join(__dirname, "..", "supabase", "functions");
let fehler = 0, n = 0;
const ok = (g, t, z) => { n++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); if (!g) fehler++; };

function laden(name, env, fetchStub) {
  const quelle = fs.readFileSync(path.join(FKT, name, "index.ts"), "utf8");
  const js = ts.transpileModule(quelle, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const rufe = [];
  let handler = null;
  const exp = {};
  const raum = {
    exports: exp, module: { exports: exp }, require: () => ({}),
    Deno: { env: { get: k => env[k] }, serve: h => { handler = h; } },
    fetch: async (url, opt) => { const r = { url: String(url), opt }; rufe.push(r); return fetchStub(r); },
    Response, Request, Headers, URL, URLSearchParams, JSON, console: { error: () => {}, log: () => {} }, Math, Number, Array, String, Date, Object,
    Promise, Error, RegExp, TextEncoder, Uint8Array, isNaN, crypto: nodeCrypto.webcrypto,
  };
  vm.createContext(raum);
  vm.runInContext(js, raum);
  return { handler, rufe, exp };
}
const json = (o, status = 200) => new Response(JSON.stringify(o), { status });
const rpcName = r => (r.url.split("/rpc/")[1] || null);
const rpcKoerper = r => JSON.parse(r.opt.body);

const BASIS = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "dienst-geheim", STRIPE_SECRET_KEY: "sk_test_GEHEIM", STRIPE_WEBHOOK_SECRET: "whsec_GEHEIM" };
const BEST = "11111111-2222-4333-8444-555555555555";
const VORB = { ok: true, zahlung_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", betrieb_id: "b", stripe_konto: "acct_1ABCDEFGHIJ", betrag_cent: 1250,
  methoden: ["card", "klarna", "paypal", "sepa_debit"], betrieb_name: "Choco L'AMouR", slug: "chocolamour", zweck: "Bestellung 11111111", versuch: 0 };

(async () => {
  /* ═══ zahlung-starten ═══ */
  console.log("\n══ zahlung-starten ══");
  const anfrage = (koerper, kopf = {}) => new Request("https://x.supabase.co/functions/v1/zahlung-starten", {
    method: "POST", headers: { "content-type": "application/json", ...kopf }, body: JSON.stringify(koerper) });

  function starten(vorb, stripeAntwort, env = BASIS) {
    return laden("zahlung-starten", env, r => {
      if (r.url.includes("api.stripe.com")) return stripeAntwort instanceof Response ? stripeAntwort : json(stripeAntwort);
      const fn = rpcName(r);
      if (fn === "zahlung_stripe_vorbereiten") return json(vorb);
      return json(null);
    });
  }
  const S_OK = { id: "cs_test_abcdefghij", url: "https://checkout.stripe.com/c/pay/cs_test_abcdefghij", expires_at: Math.floor(Date.now() / 1000) + 1800 };

  {
    const f = starten(VORB, S_OK);
    const a = await f.handler(anfrage({ bestellung_id: BEST, zurueck: "https://omoteno.de/h/chocolamour/",
      betrag_cent: 1, stripe_konto: "acct_FREMD", methoden: ["klarna"], preis: 0.01 }, { origin: "https://omoteno.de" }));
    const k = await a.json();
    const stripe = f.rufe.find(r => r.url.includes("api.stripe.com"));
    const form = new URLSearchParams(stripe.opt.body);
    ok(k.ok === true && k.url === S_OK.url, "ehrlicher Weg: Antwort ist die Bezahlseite von Stripe", k.url);
    ok(stripe.url === "https://api.stripe.com/v1/checkout/sessions", "Stripe-Adresse ist die API (keine Adresse aus der Anfrage)");
    ok(stripe.opt.headers["Stripe-Account"] === "acct_1ABCDEFGHIJ", "Konto aus der DATENBANK, nicht das gefälschte aus der Anfrage", stripe.opt.headers["Stripe-Account"]);
    ok(form.get("line_items[0][price_data][unit_amount]") === "1250", "Betrag aus der Datenbank (1250), nicht der gefälschte (1)");
    ok(form.get("line_items[0][price_data][currency]") === "eur" && form.get("mode") === "payment", "Euro, Einmalzahlung");
    const arten = [0, 1, 2, 3].map(i => form.get(`payment_method_types[${i}]`));
    ok(arten.join() === "card,klarna,paypal,sepa_debit" && form.get("payment_method_types[4]") === null, "Zahlarten = die der Datenbank, nicht die gefälschten", arten.join());
    ok(form.get("client_reference_id") === BEST && form.get("metadata[bestellung_id]") === BEST, "Bestellnummer als Verweis (client_reference_id, metadata)");
    ok(form.get("success_url") === "https://omoteno.de/h/chocolamour/?zahlung=ok#/bestellt" && form.get("cancel_url") === "https://omoteno.de/h/chocolamour/?zahlung=abbruch#/bestellt", "Rückkehr: Erfolg und Abbruch, beide ins Bestellpass-Fenster", form.get("success_url"));
    const bis = Number(form.get("expires_at")), jetzt = Date.now() / 1000;
    ok(bis > jetzt + 29 * 60 && bis < jetzt + 31 * 60, "Sitzung läuft nach 30 Minuten ab");
    ok(stripe.opt.headers["Idempotency-Key"] === `ck-${VORB.zahlung_id}-0`, "Idempotenz-Schlüssel je Zahlung und Versuch", stripe.opt.headers["Idempotency-Key"]);
    ok(stripe.opt.headers.Authorization === "Bearer sk_test_GEHEIM", "Stripe bekommt den Plattform-Schlüssel");
    const merken = f.rufe.find(r => rpcName(r) === "zahlung_session_merken");
    ok(merken && rpcKoerper(merken).p_session === S_OK.id && rpcKoerper(merken).p_bestellung === BEST && rpcKoerper(merken).p_url === S_OK.url, "Sitzung wird in der Datenbank vermerkt");
    const anSupabase = f.rufe.filter(r => !r.url.includes("api.stripe.com"));
    ok(anSupabase.every(r => !JSON.stringify(r).includes("sk_test_GEHEIM")), "Der Stripe-Schlüssel geht NIE an Supabase");
    ok(!JSON.stringify(k).includes("GEHEIM") && !JSON.stringify(k).includes("acct_"), "Antwort an den Gast enthält weder Schlüssel noch Kontonummer");
    ok(a.headers.get("access-control-allow-origin") === "https://omoteno.de", "CORS: nur die eigene Herkunft wird zurückgespiegelt");
    ok(!/card\[number\]|cvc|iban/i.test(stripe.opt.body), "In der Stripe-Anfrage stehen keine Karten- oder Kontodaten");
  }
  {
    const f = starten(VORB, S_OK);
    const a = await f.handler(anfrage({ bestellung_id: BEST }, { origin: "https://evil.example" }));
    ok(!a.headers.get("access-control-allow-origin"), "CORS: fremde Herkunft bekommt KEINEN Freibrief");
  }
  /* Rückkehradresse */
  {
    const f = starten(VORB, S_OK);
    const r = f.exp.rueckkehr;
    const NOT = "https://omoteno.de/h/chocolamour/";
    const fall = (z, o) => r(z, o, "chocolamour");
    ok(fall("https://evil.example/h/chocolamour/", null) === NOT, "fremde Domain → Notfalladresse");
    ok(fall("https://omoteno.de.evil.com/", null) === NOT, "omoteno.de.evil.com → Notfalladresse");
    ok(fall("http://omoteno.de/", null) === NOT, "http statt https → Notfalladresse");
    ok(fall("https://user:pw@omoteno.de/", null) === NOT, "Zugangsdaten in der Adresse → Notfalladresse");
    ok(fall("https://omoteno.de/admin", null) === NOT, "anderer Pfad (/admin) → Notfalladresse");
    ok(fall("https://omoteno.de/h/anderer/", null) === NOT, "Pfad eines ANDEREN Betriebs → Notfalladresse");
    ok(fall("javascript:alert(1)", null) === NOT && fall(null, null) === NOT && fall("x".repeat(400), null) === NOT, "javascript:/leer/zu lang → Notfalladresse");
    ok(fall("https://choco-lamour.omoteno.de/", "https://choco-lamour.omoteno.de") === "https://choco-lamour.omoteno.de/", "Kundenadresse mit passender Herkunft bleibt (Gerätespeicher bleibt erreichbar)");
    ok(fall("https://choco-lamour.omoteno.de/", "https://omoteno.de") === NOT, "Herkunft passt nicht zur Rückkehradresse → Notfalladresse");
    ok(fall("https://omoteno.de/h/chocolamour/?x=1#y", null) === "https://omoteno.de/h/chocolamour/", "Abfrage und Anker der Rückkehradresse werden verworfen");
  }
  {
    const f = starten({ ok: true, wiederverwendet: true, url: "https://checkout.stripe.com/c/pay/alt", versuch: 1 }, S_OK);
    const a = await f.handler(anfrage({ bestellung_id: BEST }));
    const k = await a.json();
    ok(k.url === "https://checkout.stripe.com/c/pay/alt" && !f.rufe.some(r => r.url.includes("api.stripe.com")), "Offene Sitzung wird wiederverwendet — keine zweite bei Stripe");
  }
  for (const g of ["nicht_offen", "zu_oft", "keine_art", "unbekannt"]) {
    const f = starten({ ok: false, grund: g }, S_OK);
    const k = await (await f.handler(anfrage({ bestellung_id: BEST }))).json();
    ok(k.ok === false && k.grund === g && !f.rufe.some(r => r.url.includes("api.stripe.com")), `Absage „${g}“ der Datenbank → Grund an den Hub, Stripe nicht gerufen`);
  }
  {
    const f = starten(VORB, json({ error: { message: "Invalid API key sk_test_GEHEIM", code: "x" } }, 401));
    const k = await (await f.handler(anfrage({ bestellung_id: BEST }))).json();
    ok(k.ok === false && k.grund === "stripe" && !JSON.stringify(k).includes("Invalid") && !f.rufe.some(r => rpcName(r) === "zahlung_session_merken"), "Stripe-Fehler → nur „stripe“, kein Rohtext, nichts vermerkt");
  }
  {
    const f = starten(VORB, S_OK);
    const k = await (await f.handler(anfrage({ bestellung_id: "nicht-uuid" }))).json();
    ok(k.grund === "bestellung" && f.rufe.length === 0, "ungültige Bestellnummer → kein einziger Aufruf");
    const k2 = await (await f.handler(anfrage({ bestellung_id: BEST + "' or 1=1" }))).json();
    ok(k2.grund === "bestellung" && f.rufe.length === 0, "Einschleusung in der Bestellnummer → kein Aufruf");
    const g = await f.handler(new Request("https://x/", { method: "GET" }));
    ok(g.status === 405, "GET → 405");
    const kk = await (await starten(VORB, S_OK, { ...BASIS, STRIPE_SECRET_KEY: "" }).handler(anfrage({ bestellung_id: BEST }))).json();
    ok(kk.grund === "einrichtung", "ohne Stripe-Schlüssel → „einrichtung“, kein Absturz");
  }
  {
    const f = starten({ ...VORB, betrag_cent: 20 }, S_OK);
    const k = await (await f.handler(anfrage({ bestellung_id: BEST }))).json();
    ok(k.grund === "keine_art" && !f.rufe.some(r => r.url.includes("api.stripe.com")), "Betrag unter 50 Cent aus der Datenbank → nicht an Stripe");
    const f2 = starten({ ...VORB, stripe_konto: null }, S_OK);
    const k2 = await (await f2.handler(anfrage({ bestellung_id: BEST }))).json();
    ok(k2.grund === "keine_art" && !f2.rufe.some(r => r.url.includes("api.stripe.com")), "Datenbank ohne Konto → nicht an Stripe");
  }

  /* ═══ stripe-webhook ═══ */
  console.log("\n══ stripe-webhook ══");
  const GEH = BASIS.STRIPE_WEBHOOK_SECRET;
  const unterschrift = (roh, t = Math.floor(Date.now() / 1000), geh = GEH) =>
    `t=${t},v1=${nodeCrypto.createHmac("sha256", geh).update(`${t}.${roh}`).digest("hex")}`;
  const post = (ereignis, kopf) => {
    const roh = typeof ereignis === "string" ? ereignis : JSON.stringify(ereignis);
    return new Request("https://x/functions/v1/stripe-webhook", { method: "POST", body: roh, headers: kopf === undefined ? { "stripe-signature": unterschrift(roh) } : kopf });
  };
  const SITZ = "cs_test_abcdefghij";
  const ev = (typ, o = {}, wurzel = {}) => ({ id: "evt_test_" + Math.random().toString(36).slice(2, 12) + "xx", type: typ, account: "acct_1ABCDEFGHIJ",
    data: { object: { id: SITZ, payment_status: "paid", amount_total: 1250, currency: "eur", payment_intent: "pi_test_1", payment_method_types: ["klarna"], ...o } }, ...wurzel });
  const ZEILE = { bestellung_id: BEST, betrieb_id: "b", stripe_konto: "acct_1ABCDEFGHIJ", betrag_cent: 1250, status: "offen" };

  function hook(opt = {}) {
    const f = laden("stripe-webhook", BASIS, r => {
      const fn = rpcName(r);
      if (fn === "zahlung_ereignis_neu") return json(opt.neu === undefined ? true : opt.neu);
      if (fn === "zahlung_finden") return json(opt.zeile === undefined ? ZEILE : opt.zeile);
      if (fn === "zahlung_freigeben") return opt.freigebenFehler ? new Response("boom", { status: 500 }) : json(opt.freigeben || { ok: true, betrieb_id: "b", bestellung_id: BEST });
      return json(null);
    });
    return f;
  }
  const namen = f => f.rufe.map(r => rpcName(r) || (r.url.includes("swift-processor") ? "MELDEN" : r.url));

  {
    const f = hook();
    const a = await f.handler(post(ev("checkout.session.completed")));
    ok(a.status === 200 && namen(f).join() === "zahlung_ereignis_neu,zahlung_finden,zahlung_freigeben,MELDEN", "ehrlicher Weg: Ereignis → finden → freigeben → Push ans Team", namen(f).join());
    const fr = rpcKoerper(f.rufe.find(r => rpcName(r) === "zahlung_freigeben"));
    ok(fr.p_bestellung === BEST && fr.p_konto === "acct_1ABCDEFGHIJ" && fr.p_methode === "klarna" && fr.p_ref === "pi_test_1", "freigeben bekommt Bestellung, Konto DES EREIGNISSES, Methode, Verweis", JSON.stringify(fr));
    const m = f.rufe.find(r => r.url.includes("swift-processor"));
    ok(JSON.parse(m.opt.body).record.id === BEST, "Push meldet die freigegebene Bestellung");
  }
  /* Unterschrift */
  {
    const roh = JSON.stringify(ev("checkout.session.completed"));
    const fall = async (kopf, text = roh) => { const f = hook(); const a = await f.handler(post(text, kopf)); return { s: a.status, rufe: f.rufe.length }; };
    let e = await fall({});
    ok(e.s === 400 && e.rufe === 0, "ohne Unterschrift → 400, KEIN Aufruf");
    e = await fall({ "stripe-signature": unterschrift(roh, undefined, "whsec_FALSCH") });
    ok(e.s === 400 && e.rufe === 0, "Unterschrift mit falschem Geheimnis → 400, KEIN Aufruf");
    e = await fall({ "stripe-signature": unterschrift(roh, Math.floor(Date.now() / 1000) - 400) });
    ok(e.s === 400 && e.rufe === 0, "Unterschrift von vor 400 s (Wiedereinspielen) → 400");
    e = await fall({ "stripe-signature": unterschrift(roh) }, roh.replace("1250", "1"));
    ok(e.s === 400 && e.rufe === 0, "Körper nach dem Unterschreiben verändert (Betrag) → 400");
    e = await fall({ "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=` + "0".repeat(64) });
    ok(e.s === 400 && e.rufe === 0, "erfundene Unterschrift → 400");
    e = await fall({ "stripe-signature": "müll" });
    ok(e.s === 400 && e.rufe === 0, "Müll in der Kopfzeile → 400");
    const t = Math.floor(Date.now() / 1000);
    const gut = unterschrift(roh, t);
    e = await fall({ "stripe-signature": `t=${t},v1=${"1".repeat(64)},${gut.split(",")[1]}` });
    ok(e.s === 200, "mehrere v1-Einträge: ein richtiger genügt (Schlüsselwechsel bei Stripe)");
    const f = hook({ }); const a = await f.handler(new Request("https://x/", { method: "GET" }));
    ok(a.status === 405, "GET → 405");
  }
  /* Nicht freigeben */
  {
    let f = hook({ zeile: { ...ZEILE, stripe_konto: "acct_ANDERERANDERER" } });
    await f.handler(post(ev("checkout.session.completed")));
    ok(!namen(f).includes("zahlung_freigeben") && !namen(f).includes("MELDEN"), "Konto des Ereignisses ≠ Konto der Zahlung → NICHT freigegeben");
    f = hook(); await f.handler(post(ev("checkout.session.completed", {}, { account: undefined })));
    ok(!namen(f).includes("zahlung_freigeben"), "Ereignis ohne Konto → NICHT freigegeben");
    f = hook(); await f.handler(post(ev("checkout.session.completed", { amount_total: 1 })));
    ok(!namen(f).includes("zahlung_freigeben"), "gezahlter Betrag ≠ Betrag der Datenbank (1 statt 1250) → NICHT freigegeben");
    f = hook(); await f.handler(post(ev("checkout.session.completed", { currency: "usd" })));
    ok(!namen(f).includes("zahlung_freigeben"), "andere Währung → NICHT freigegeben");
    f = hook(); await f.handler(post(ev("checkout.session.completed", { payment_status: "unpaid", payment_method_types: ["sepa_debit"] })));
    ok(!namen(f).includes("zahlung_freigeben"), "SEPA bei „completed“ noch „unpaid“ → noch NICHT freigegeben");
    f = hook(); await f.handler(post(ev("checkout.session.async_payment_succeeded", { payment_method_types: ["sepa_debit"] })));
    ok(namen(f).includes("zahlung_freigeben") && rpcKoerper(f.rufe.find(r => rpcName(r) === "zahlung_freigeben")).p_methode === "sepa_debit", "SEPA-Zahlung eingegangen (async_payment_succeeded) → freigegeben als sepa_debit");
    f = hook({ zeile: null }); await f.handler(post(ev("checkout.session.completed")));
    ok(!namen(f).includes("zahlung_freigeben"), "unbekannte Sitzung → nichts");
    f = hook({ neu: false }); const a = await f.handler(post(ev("checkout.session.completed")));
    ok(!namen(f).includes("zahlung_finden") && !namen(f).includes("zahlung_freigeben") && (await a.json()).doppelt === true, "dasselbe Ereignis ein zweites Mal → nicht noch einmal verarbeitet");
    f = hook(); await f.handler(post(ev("charge.refunded")));
    ok(f.rufe.length === 0, "nicht beachtetes Ereignis → kein Aufruf");
    f = hook({ freigeben: { ok: true, schon: true } }); await f.handler(post(ev("checkout.session.completed")));
    ok(!namen(f).includes("MELDEN"), "Zahlung war schon verbucht → kein zweiter Push");
    f = hook({ freigeben: { ok: true, rueckzahlung: true } }); await f.handler(post(ev("checkout.session.completed")));
    ok(!namen(f).includes("MELDEN"), "bezahlt, aber Bestellung nicht mehr offen → KEIN Push, Rückzahlung vermerkt");
    f = hook({ freigeben: { ok: false, grund: "konto" } }); const a2 = await f.handler(post(ev("checkout.session.completed")));
    ok(a2.status === 200 && !namen(f).includes("MELDEN"), "Datenbank lehnt ab → 200 (kein Dauerfeuer), kein Push");
  }
  /* Scheitern */
  {
    let f = hook(); await f.handler(post(ev("checkout.session.expired", { payment_status: "unpaid" })));
    let k = f.rufe.find(r => rpcName(r) === "zahlung_scheitert");
    ok(k && rpcKoerper(k).p_status === "abgelaufen" && !namen(f).includes("zahlung_freigeben"), "Sitzung abgelaufen → „abgelaufen“, nicht freigegeben");
    f = hook(); await f.handler(post(ev("checkout.session.async_payment_failed", { payment_status: "unpaid" })));
    k = f.rufe.find(r => rpcName(r) === "zahlung_scheitert");
    ok(k && rpcKoerper(k).p_status === "fehlgeschlagen", "SEPA fehlgeschlagen → „fehlgeschlagen“");
    f = hook({ zeile: { ...ZEILE, stripe_konto: "acct_ANDERERANDERER" } }); await f.handler(post(ev("checkout.session.expired", { payment_status: "unpaid" })));
    ok(!namen(f).includes("zahlung_scheitert"), "„abgelaufen“ von einem fremden Konto ändert nichts");
  }
  /* Datenbankfehler */
  {
    const f = hook({ freigebenFehler: true });
    const e = ev("checkout.session.completed");
    const a = await f.handler(post(e));
    const frei = f.rufe.find(r => rpcName(r) === "zahlung_ereignis_frei");
    ok(a.status === 500 && frei && rpcKoerper(frei).p_id === e.id, "Datenbankfehler beim Freigeben → 500 UND Ereignis wieder frei (Stripe wiederholt, nichts geht verloren)");
    ok(!namen(f).includes("MELDEN"), "…und kein Push für eine Bestellung, die nicht frei ist");
  }

  console.log(`\n${n - fehler}/${n} bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
