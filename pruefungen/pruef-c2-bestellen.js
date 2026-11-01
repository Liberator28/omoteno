/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Einstellungen „Lieferung“ und „Bestellstand beim Gast“ — je drei
   neue Funktionen (Plan Teil C, Block C2b, 01.11.)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-c2-bestellen.js   (braucht dist/)
     ADMIN_DATEI=… / HUB_DIST=… für Gegenbeweise auf Kopien

   Lieferung (Hub liest betriebe.liefer):
     · pause_bis — eine Uhrzeit höchstens 6 h voraus blendet die Lieferung aus und sagt, ab wann wieder geliefert wird;
       vergangen, zu weit, kein Text → keine Pause (§7: lieber liefern als still zu sein).
     · zu — Tage „JJJJ-MM-TT“; heute darin → „Heute liefern wir nicht.“; anderer Tag oder kaputter Wert → liefert.
     · Board: „30 Min pausieren“ liest frisch, schreibt NUR pause_bis zusammengeführt, 0 Zeilen = Satz; „Pause beenden“;
       geschlossene Tage anlegen/entfernen (kein vergangener Tag, höchstens 60); PLZ-Prüfer sagt, ob, ab wie viel und was
       eine Lieferung dorthin kostet — gerechnet wie der Hub (lieferGebuehrFuer), ohne Netz.
   Bestellstand (hub_stil):
     · verzug — feste Liste übersetzter Sätze, nur wenn die Zeit um ist; unbekannt/__proto__ → kein Satz.
     · vibration — nur beim Wechsel auf „fertig“, nicht beim Wiederherstellen; nur bei echtem true.
     · nummerGross — Bestellnummer groß; ohne Wahl ist der Pass Zeichen für Zeichen wie vorher.
     · Board: drei Wahlen, „Übernehmen“ führt hub_stil zusammen (Nachbarn bleiben).
   Uhr fest (§8.1j). Der Server kennt Pause und geschlossene Tage NICHT — das steht im Bericht, nicht hier.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { oeffneHub } = require("./werkzeug/start-hub");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");
const DIST = process.env.HUB_DIST || path.join(OBEN, "dist");
const UHR = "2026-10-10T14:00:00";

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}
const LF = o => Object.assign({ an: true, plz: ["35037"], mindest: 15, gebuehr: 2.5, gratis_ab: 30, dauer_min: 45, bar: true }, o);

async function hubFall(browser, liefer, sprache) {
  const h = await oeffneHub(browser, { haus: "chocolamour", liefer, uhr: UHR, sprache, dist: DIST });
  const r = await h.p.evaluate(() => ({ gerade: liefertGerade(), satz: lieferZuSatz(), name: lwNameText("liefern"),
    label: (document.querySelector('[data-lieferwahl="liefern"]') || {}).title || "" }));
  return Object.assign(h, { r });
}

(async () => {
  const browser = await chromium.launch();
  const jetzt = new Date(UHR).getTime();

  console.log("\n══ Hub · Lieferpause ══");
  {
    const { ctx, r, fehler } = await hubFall(browser, LF({}));
    pruef(r.gerade === true && r.satz === "", "Voraussetzung: ohne Pause liefert das Haus um 14 Uhr", JSON.stringify(r));
    await ctx.close();
  }
  {
    const bis = new Date(jetzt + 30 * 60e3).toISOString();
    const { ctx, p, r, fehler } = await hubFall(browser, LF({ pause_bis: bis }));
    pruef(r.gerade === false, "pause_bis in 30 Min: liefert gerade nicht", JSON.stringify(r));
    pruef(r.satz === "Wir liefern wieder ab 14:30 Uhr.", "Satz nennt die Uhrzeit des Endes", r.satz);
    pruef(r.name === "Zurzeit zu", "Pille sagt „Zurzeit zu“, keine Lieferzeiten", r.name);
    pruef(/14:30/.test(r.label), "Bestellart nennt den Grund (Vorleser/Titel)", r.label);
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }
  {
    const bis = new Date(jetzt + 30 * 60e3).toISOString();
    const { ctx, r } = await hubFall(browser, LF({ pause_bis: bis }), "en");
    pruef(r.satz === "We deliver again from 14:30.", "Englisch übersetzt", r.satz);
    await ctx.close();
  }
  for (const [name, wert] of [["vergangen", new Date(jetzt - 60e3).toISOString()], ["7 h voraus", new Date(jetzt + 7 * 3600e3).toISOString()],
                              ["Zahl", jetzt + 60e4], ["Unsinn", "morgen"], ["Liste", ["x"]]]) {
    const { ctx, r } = await hubFall(browser, LF({ pause_bis: wert }));
    pruef(r.gerade === true && r.satz === "", "pause_bis " + name + " → keine Pause", JSON.stringify(r));
    await ctx.close();
  }

  console.log("\n══ Hub · Geschlossene Tage ══");
  {
    const { ctx, r } = await hubFall(browser, LF({ zu: ["2026-10-09", "2026-10-10"] }));
    pruef(r.gerade === false && r.satz === "Heute liefern wir nicht.", "heute in der Liste: liefert nicht, mit Satz", JSON.stringify(r));
    await ctx.close();
  }
  {
    const { ctx, r } = await hubFall(browser, LF({ zu: ["2026-10-11", "10.10.2026", 20261010, "<img src=x onerror=1>"] }));
    pruef(r.gerade === true && r.satz === "", "anderer Tag, andere Schreibweise, Zahl, Auszeichnung → liefert", JSON.stringify(r));
    await ctx.close();
  }
  {
    const { ctx, r } = await hubFall(browser, LF({ zu: ["2026-10-10"] }), "ar");
    pruef(r.satz === "لا نقوم بالتوصيل اليوم.", "Arabisch übersetzt", r.satz);
    await ctx.close();
  }

  console.log("\n══ Hub · Bestellstand ══");
  async function standFall(stil, antwortStatus, rest, opt = {}) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 140)));
    await p.clock.setFixedTime(new Date(UHR));
    let status = antwortStatus;
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await p.route("**/rest/v1/betriebe**", r => r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify([Object.assign({ id: "b1", bestell_pause: false, bestell_pause_text: "", hub_texte: {} }, stil !== undefined ? { hub_stil: stil } : {})]) }));
    await p.route("**/rest/v1/rpc/bestellung_status", r => r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify([{ status, wartezeit_min: 20, tagesnummer: 7 }]) }));
    await p.route("**/rest/v1/rpc/bestellung_restzeit", r => r.fulfill({ status: 200, contentType: "application/json", body: String(rest) }));
    await p.addInitScript(st => {
      window.__vib = 0; navigator.vibrate = () => { window.__vib++; return true; };
      try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {}
      localStorage.setItem("omoteno-vorgaenge", JSON.stringify([{ nummer: "probe_kennung_0001", art: "bestellung", status: st,
        warte: 20, summe: 12.5, zeit: Date.now(), tagesnummer: 7,
        bestellung: { nummer: "probe_kennung_0001", tisch: "3", tagesnummer: 7, summe: 12.5, posten: [{ n: "Nutella Crêpe", m: 1, p: "7,50" }] } }]));
    }, opt.startStatus || "arbeit");
    if (opt.sprache) await p.addInitScript(s => { try { localStorage.setItem("tapto-sprache", s); } catch (e) {} }, opt.sprache);
    await p.goto("file://" + path.join(DIST, "chocolamour", "index.html") + "#/");
    await p.waitForTimeout(2000);
    await p.click("#vstreifen").catch(() => {});
    await p.waitForTimeout(2400);
    const m = await p.evaluate(() => ({
      verzug: (document.querySelector(".bs-verzug") || {}).textContent || "",
      gross: (document.querySelector(".bs-warte b") || {}).textContent || "",
      stufen: document.querySelectorAll(".bs-stufe").length,
      nummer: (() => { const x = document.querySelector("#bpass .bp-nummer"); return x ? { klasse: x.className, fs: parseFloat(getComputedStyle(x).fontSize), text: x.textContent } : null; })(),
      vib: window.__vib, pass: (document.getElementById("bpass") || {}).outerHTML || ""
    }));
    await ctx.close();
    return Object.assign(m, { fehler });
  }
  {
    const m = await standFall({ verzug: "geduld" }, "arbeit", 0);
    pruef(m.stufen >= 3, "Voraussetzung: Bestellstand steht da", m.stufen);
    pruef(m.gross === "Jeden Moment" && m.verzug === "Es dauert einen Moment länger — danke für Ihre Geduld.", "Zeit um + „geduld“ → Satz unter „Jeden Moment“", m.verzug);
    pruef(m.fehler.length === 0, "keine Skriptfehler", m.fehler.join(" | "));
  }
  {
    const m = await standFall({ verzug: "geduld" }, "arbeit", 600);
    pruef(m.stufen >= 3 && m.verzug === "", "Zeit läuft noch → kein Satz", m.gross);
  }
  for (const w of ["__proto__", "constructor", "<b>x</b>", "Heute ist viel los", true]) {
    const m = await standFall({ verzug: w }, "arbeit", 0);
    pruef(m.stufen >= 3 && m.verzug === "", "verzug " + JSON.stringify(w) + " → kein Satz", m.verzug);
  }
  {
    const m = await standFall({ verzug: "viel" }, "arbeit", 0, { sprache: "en" });
    pruef(m.verzug === "We are very busy right now. Your order is coming shortly.", "Englisch übersetzt", m.verzug);
  }
  {
    const a = await standFall({ vibration: true }, "fertig", 0);
    pruef(a.vib === 1, "vibration an: Wechsel auf „fertig“ vibriert genau einmal", a.vib);
    const b = await standFall({ vibration: true }, "fertig", 0, { startStatus: "fertig" });
    pruef(b.vib === 0, "schon fertig gespeichert (Neuladen) → keine Vibration", b.vib);
    const c = await standFall({ vibration: "true" }, "fertig", 0);
    pruef(c.vib === 0, "vibration als Text → aus", c.vib);
    const d = await standFall({}, "fertig", 0);
    pruef(d.vib === 0, "ohne Wahl → keine Vibration", d.vib);
  }
  {
    const ohne = await standFall({}, "arbeit", 600);
    const mit = await standFall({ nummerGross: true }, "arbeit", 600);
    const text = await standFall({ nummerGross: "ja" }, "arbeit", 600);
    pruef(ohne.nummer && mit.nummer && mit.nummer.fs >= 54 && ohne.nummer.fs < 50, "nummerGross: Nummer groß (≥ 54 px statt 44)", ohne.nummer && (ohne.nummer.fs + " → " + mit.nummer.fs));
    pruef(text.nummer && text.nummer.fs === ohne.nummer.fs, "nummerGross als Text → wie vorher", text.nummer && text.nummer.fs);
    pruef(ohne.pass.length > 50 && !/bp-gross/.test(ohne.pass), "ohne Wahl trägt der Pass keine neue Klasse");
  }

  /* ═══ Board ═══ */
  function stelleDb() {
    return (z) => {
      window.__liefer = z.liefer; window.__stil = z.stil; window.__schreib = []; window.__nullZeilen = false;
      function kette(tab) {
        const ruf = { tab, schritte: [] };
        const p = new Proxy(function () {}, {
          get(_, k) {
            if (k === "then") return (res, rej) => {
              let d = { data: [], error: null };
              const sel = (ruf.schritte.find(s => s[0] === "select") || [0, [""]])[1][0] || "";
              const upd = ruf.schritte.find(s => s[0] === "update");
              if (tab === "betrieb_mitglieder") d = { data: [{ rolle: "inhaber", betriebe: { id: "b1", slug: "choco", name: "Choco", bestell_pause: false, hub_texte: {},
                liefer: JSON.parse(JSON.stringify(z.cacheLiefer || z.liefer)), hub_stil: JSON.parse(JSON.stringify(z.cacheStil || z.stil)) } }], error: null };
              else if (tab === "betriebe" && upd) {
                window.__schreib.push(JSON.parse(JSON.stringify(upd[1][0])));
                if (window.__nullZeilen) d = { data: [], error: null };
                else { if (upd[1][0].liefer) window.__liefer = upd[1][0].liefer; if (upd[1][0].hub_stil) window.__stil = upd[1][0].hub_stil; d = { data: [{ id: "b1" }], error: null }; }
              } else if (tab === "betriebe" && /liefer/.test(sel)) d = { data: { liefer: JSON.parse(JSON.stringify(window.__liefer)) }, error: null };
              else if (tab === "betriebe" && /hub_stil/.test(sel)) d = { data: { hub_stil: JSON.parse(JSON.stringify(window.__stil)) }, error: null };
              return Promise.resolve(d).then(res, rej);
            };
            return (...a) => { ruf.schritte.push([k, a]); return p; };
          }
        });
        return p;
      }
      db = { from: kette, rpc: async () => ({ data: null, error: null }), channel: () => kette("kanal"), removeChannel: async () => {}, storage: { from: () => kette("speicher") },
        functions: { invoke: async () => ({ data: null, error: null }) },
        auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: { id: "u1" } } }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
      demo = false;
    };
  }
  async function board(z, breite) {
    const ctx = await browser.newContext({ viewport: { width: breite || 390, height: 900 } });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + ADMIN);
    await p.waitForTimeout(600);
    await p.evaluate(() => { const sc = document.getElementById("scharf"); if (sc) sc.hidden = true; });
    await p.evaluate(stelleDb(), z);
    await p.evaluate(async () => { document.getElementById("tor").hidden = true; await betriebWaehlen(); });
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('[data-tafel="einstellungen"]').click());
    await p.waitForTimeout(400);
    return { ctx, p, fehler };
  }
  const melde = p => p.evaluate(() => (document.getElementById("meldung") || {}).textContent || "");
  const masse = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => {
    const r = e.getBoundingClientRect(); return { id: e.id || e.textContent.trim().slice(0, 14), h: Math.round(r.height), fs: parseFloat(getComputedStyle(e).fontSize) }; }), sel);

  console.log("\n══ Board · Kurz pausieren ══");
  {
    const basis = LF({ zeiten: { von: "11:00", bis: "22:00", tage: [] } });
    const { ctx, p, fehler } = await board({ liefer: Object.assign({}, basis, { fremd: 1 }), cacheLiefer: basis, stil: {} });
    pruef(await gruppeZu(p, "#lfPause30"), "Voraussetzung: Unterseite Lieferung offen");
    pruef(/läuft/.test(await p.textContent("#lfPauseStand")) && await p.isHidden("#lfPauseEnde"), "Ruhe: „Die Lieferung läuft.“, kein „Pause beenden“", await p.textContent("#lfPauseStand"));
    const t0 = await p.evaluate(() => Date.now());
    await p.click("#lfPause30"); await p.waitForTimeout(300);
    const w1 = await p.evaluate(() => window.__schreib[window.__schreib.length - 1]);
    const pb1 = Date.parse(w1.liefer.pause_bis);
    pruef(Object.keys(w1).join() === "liefer" && Math.abs(pb1 - t0 - 30 * 60e3) < 5000, "schreibt NUR liefer, pause_bis = jetzt + 30 Min", w1.liefer.pause_bis);
    pruef(w1.liefer.fremd === 1 && w1.liefer.gebuehr === 2.5 && w1.liefer.zeiten.von === "11:00", "frisch gelesen: ein Schlüssel eines anderen Geräts und alle anderen bleiben", JSON.stringify(Object.keys(w1.liefer)));
    pruef(/Pausiert bis/.test(await p.textContent("#lfPauseStand")) && await p.isVisible("#lfPauseEnde") && (await p.textContent("#lfPause30")) === "30 Min verlängern",
      "danach: Stand mit Uhrzeit, „Pause beenden“, „30 Min verlängern“", await p.textContent("#lfPauseStand"));
    await p.click("#lfPause30"); await p.waitForTimeout(300);
    const pb2 = Date.parse((await p.evaluate(() => window.__schreib[window.__schreib.length - 1])).liefer.pause_bis);
    pruef(Math.abs(pb2 - pb1 - 30 * 60e3) < 5000, "verlängern rechnet vom alten Ende, nicht von jetzt", Math.round((pb2 - t0) / 60e3) + " Min");
    await p.click("#lfPauseEnde"); await p.waitForTimeout(300);
    const w3 = await p.evaluate(() => window.__schreib[window.__schreib.length - 1]);
    pruef(!("pause_bis" in w3.liefer) && w3.liefer.fremd === 1 && /läuft/.test(await p.textContent("#lfPauseStand")), "„Pause beenden“ nimmt nur pause_bis weg", JSON.stringify(Object.keys(w3.liefer)));
    await p.evaluate(() => { window.__liefer.pause_bis = new Date(Date.now() + 5.9 * 3600e3).toISOString(); });
    await p.click("#lfPause30"); await p.waitForTimeout(300);
    const pb4 = Date.parse((await p.evaluate(() => window.__schreib[window.__schreib.length - 1])).liefer.pause_bis);
    pruef(pb4 - Date.now() <= 6 * 3600e3, "nie weiter als 6 Stunden voraus (sonst läse der Hub einen Fehlwert)", Math.round((pb4 - Date.now()) / 60e3) + " Min");
    await p.evaluate(() => { window.__nullZeilen = true; });
    await p.click("#lfPauseEnde"); await p.waitForTimeout(300);
    pruef(/Nur der Besitzer/.test(await melde(p)) && await p.evaluate(() => !!lfPauseBis()), "0 Zeilen → Satz, der Stand im Board bleibt", await melde(p));
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, p } = await board({ liefer: LF({ an: false }), stil: {} });
    await gruppeZu(p, "#lfPause30");
    pruef(await p.isDisabled("#lfPause30") && /aus/.test(await p.textContent("#lfPauseStand")), "Lieferung aus: Pausieren gesperrt, mit Satz", await p.textContent("#lfPauseStand"));
    await ctx.close();
  }

  console.log("\n══ Board · Geschlossene Tage ══");
  {
    const heute = new Date(); const tag = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const morgen = tag(new Date(heute.getTime() + 86400e3)), gestern = tag(new Date(heute.getTime() - 86400e3)), bald = tag(new Date(heute.getTime() + 5 * 86400e3));
    const { ctx, p, fehler } = await board({ liefer: LF({ zu: [gestern, morgen, "kaputt", morgen] }), stil: {} });
    await gruppeZu(p, "#lfZuListe");
    const liste = () => p.evaluate(() => [...document.querySelectorAll("#lfZuListe [data-lf-zu-weg]")].map(k => k.dataset.lfZuWeg));
    pruef(JSON.stringify(await liste()) === JSON.stringify([morgen]), "gespeicherte Liste: vergangene, kaputte und doppelte Tage fallen weg", JSON.stringify(await liste()));
    await p.fill("#lfZuTag", bald); await p.click("#lfZuDazu"); await p.waitForTimeout(100);
    pruef(JSON.stringify(await liste()) === JSON.stringify([morgen, bald]), "Tag hinzufügen, sortiert", JSON.stringify(await liste()));
    await p.fill("#lfZuTag", gestern); await p.click("#lfZuDazu"); await p.waitForTimeout(100);
    pruef((await liste()).length === 2 && /vorbei/.test(await melde(p)), "vergangener Tag → Satz, nichts eingetragen", await melde(p));
    await p.fill("#lfZuTag", bald); await p.click("#lfZuDazu"); await p.waitForTimeout(100);
    pruef((await liste()).length === 2 && /schon/.test(await melde(p)), "doppelter Tag → Satz", await melde(p));
    pruef(await p.evaluate(() => window.__schreib.length) === 0, "bis „Übernehmen“ wird nichts geschrieben");
    await p.click('[data-lf-zu-weg="' + morgen + '"]'); await p.waitForTimeout(100);
    pruef(JSON.stringify(await liste()) === JSON.stringify([bald]), "Tipp auf einen Tag entfernt ihn", JSON.stringify(await liste()));
    await p.click("#lfSichern"); await p.waitForTimeout(400);
    const w = await p.evaluate(() => window.__schreib[window.__schreib.length - 1]);
    pruef(w && JSON.stringify(w.liefer.zu) === JSON.stringify([bald]) && w.liefer.gebuehr === 2.5, "„Übernehmen“ schreibt zu mit den übrigen Feldern", w && JSON.stringify(w.liefer.zu));
    await p.click('[data-lf-zu-weg="' + bald + '"]'); await p.click("#lfSichern"); await p.waitForTimeout(400);
    const w2 = await p.evaluate(() => window.__schreib[window.__schreib.length - 1]);
    pruef(w2 && !("zu" in w2.liefer), "leere Liste → Schlüssel zu fehlt", w2 && JSON.stringify(Object.keys(w2.liefer)));
    const m = await masse(p, "#lfZuTag, #lfZuDazu");
    pruef(m.length === 2 && m.every(x => x.h >= 44) && m[0].fs >= 16, "Datumsfeld 16 px, Felder ≥ 44 px", JSON.stringify(m));
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  console.log("\n══ Board · Liefergebiet prüfen ══");
  {
    const { ctx, p, fehler } = await board({ liefer: LF({ plz: ["35037", "35039"] }), stil: {} });
    await gruppeZu(p, "#lfTestPlz");
    const fall = async (plz, wert) => { await p.fill("#lfTestPlz", plz); await p.fill("#lfTestWert", wert); return p.textContent("#lfTestErgebnis"); };
    const a = await fall("35037", "20");
    pruef(a === "Liefert nach 35037: Liefergebühr 2,50 €, zusammen 22,50 € · ab 30,00 € kostenlos.", "im Gebiet, über Mindestwert: Gebühr und Summe", a);
    const b = await fall("35039", "30");
    pruef(/ohne Liefergebühr, zusammen 30,00 €/.test(b), "ab „kostenlos ab“ ohne Gebühr", b);
    const c = await fall("35037", "10");
    pruef(/fehlen 5,00 €/.test(c), "unter Mindestwert: was fehlt", c);
    const d = await fall("35099", "20");
    pruef(/Nach 35099 liefern Sie nicht/.test(d), "außerhalb: liefert nicht", d);
    const e = await fall("12", "20");
    pruef(/vier oder fünf/.test(e), "Unsinn → Satz", e);
    await p.fill("#lfGebuehr", "3,00"); await p.fill("#lfTestPlz", "35037"); await p.fill("#lfTestWert", "20");
    pruef(/Liefergebühr 3,00 €/.test(await p.textContent("#lfTestErgebnis")), "rechnet mit dem Feld, auch vor „Übernehmen“", await p.textContent("#lfTestErgebnis"));
    await p.fill("#lfPlz", "35037, 35099"); await p.fill("#lfTestPlz", "35099");
    pruef(/Liefert nach 35099/.test(await p.textContent("#lfTestErgebnis")), "geänderte Postleitzahlen gelten sofort", await p.textContent("#lfTestErgebnis"));
    await p.click("#lfAn"); await p.waitForTimeout(50);
    pruef(/ausgeschaltet/.test(await p.textContent("#lfTestErgebnis")), "Lieferung ausgeschaltet → Satz", await p.textContent("#lfTestErgebnis"));
    const m = await masse(p, "#lfTestPlz, #lfTestWert, #lfPlz, #lfMindest, #lfGebuehr, #lfGratis, #lfDauer, #lfAbholMin");
    pruef(m.length === 8 && m.every(x => x.h >= 44 && x.fs >= 16), "alle Felder der Lieferung 16 px und ≥ 44 px (vorher 15 px ohne type)", JSON.stringify(m.filter(x => x.h < 44 || x.fs < 16)));
    pruef(await p.evaluate(() => window.__schreib.length) === 0, "der Prüfer schreibt nichts");
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
    /* Naht: dieselben Fälle in der Rechnung des Hubs */
    const h = await oeffneHub(browser, { haus: "chocolamour", liefer: LF({}), uhr: UHR, dist: DIST });
    const g = await h.p.evaluate(() => [lieferGebuehrFuer(20), lieferGebuehrFuer(30), lieferGebuehrFuer(29.99)]);
    pruef(JSON.stringify(g) === "[2.5,0,2.5]", "Naht: der Hub rechnet dieselben Fälle gleich (20 → 2,50 · 30 → 0 · 29,99 → 2,50)", JSON.stringify(g));
    await h.ctx.close();
  }

  console.log("\n══ Board · Bestellstand ══");
  {
    const html = fs.readFileSync(ADMIN, "utf8"), hub = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");
    const satz = (t, n) => { const m = t.match(new RegExp("const " + n + " = \\{([\\s\\S]*?)\\};")); return m ? [...m[1].matchAll(/(\w+):\s*"([^"]+)"/g)].map(x => x[1] + "=" + x[2]).join("|") : ""; };
    const sb = satz(html, "VZ_SAETZE"), sh = satz(hub, "VERZUG_SAETZE");
    pruef(sb.length > 50 && sb === sh, "Sätze im Board = Sätze im Hub (zweite Quelle)", sb.slice(0, 60));
    const stil = { restzeit: false, emoji: false, fremd: "x" };
    const { ctx, p, fehler } = await board({ liefer: LF({}), stil: Object.assign({}, stil, { neu: 1 }), cacheStil: stil });
    pruef(await gruppeZu(p, "#vzWahl"), "Voraussetzung: Unterseite Bestellstand offen");
    pruef(await p.getAttribute('#vzWahl [data-vz=""]', "aria-checked") === "true", "ohne Wahl: „Keiner“");
    await p.click('#vzWahl [data-vz="geduld"]'); await p.waitForTimeout(300);
    const w1 = await p.evaluate(() => window.__schreib[window.__schreib.length - 1]);
    pruef(w1 && Object.keys(w1).join() === "hub_stil" && w1.hub_stil.verzug === "geduld" && w1.hub_stil.restzeit === false && w1.hub_stil.fremd === "x" && w1.hub_stil.neu === 1,
      "Tipp schreibt verzug, frisch gelesen und zusammengeführt", JSON.stringify(w1 && w1.hub_stil));
    pruef(/danke für Ihre Geduld/.test(await p.textContent("#vzVorschau")) && await p.getAttribute('#vzWahl [data-vz="geduld"]', "aria-checked") === "true", "Vorschau zeigt den Satz, Wahl markiert");
    await p.click('#vzWahl [data-vz=""]'); await p.waitForTimeout(300);
    const w2 = await p.evaluate(() => window.__schreib[window.__schreib.length - 1]);
    pruef(!("verzug" in w2.hub_stil) && w2.hub_stil.restzeit === false, "„Keiner“ nimmt nur verzug weg", JSON.stringify(w2.hub_stil));
    await p.click("label.ezeile:has(#vzVib)"); await p.waitForTimeout(300);
    const w3 = await p.evaluate(() => window.__schreib[window.__schreib.length - 1]);
    pruef(w3.hub_stil.vibration === true, "Vibration an → vibration:true", JSON.stringify(w3.hub_stil));
    await p.click("label.ezeile:has(#vzGross)"); await p.waitForTimeout(300);
    const w4 = await p.evaluate(() => window.__schreib[window.__schreib.length - 1]);
    pruef(w4.hub_stil.nummerGross === true && w4.hub_stil.vibration === true, "große Nummer an, Vibration bleibt", JSON.stringify(w4.hub_stil));
    await p.click("label.ezeile:has(#vzVib)"); await p.waitForTimeout(300);
    const w5 = await p.evaluate(() => window.__schreib[window.__schreib.length - 1]);
    pruef(!("vibration" in w5.hub_stil) && w5.hub_stil.nummerGross === true, "Vibration aus → Schlüssel weg", JSON.stringify(w5.hub_stil));
    await p.evaluate(() => { window.__nullZeilen = true; });
    await p.click("label.ezeile:has(#vzVib)"); await p.waitForTimeout(300);
    pruef(/Nur der Besitzer/.test(await melde(p)) && !(await p.isChecked("#vzVib")), "0 Zeilen → Satz, Schalter springt zurück", await melde(p));
    const m = await masse(p, "#vzWahl [data-vz]");
    pruef(m.length === 4 && m.every(x => x.h >= 44), "vier Wahlen ≥ 44 px", JSON.stringify(m));
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }
  for (const br of [360, 1280]) {
    const { ctx, p } = await board({ liefer: LF({ zu: ["2099-12-24", "2099-12-25", "2099-12-26", "2099-12-31"] }), stil: {} }, br);
    for (const s of ["#lfPause30", "#vzWahl"]) {
      await gruppeZu(p, s); await p.waitForTimeout(150);
      const u = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      pruef(u <= 0, br + " px: " + s + " ohne seitlichen Überlauf", u);
    }
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
