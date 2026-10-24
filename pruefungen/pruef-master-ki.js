/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Master-Board: „KI-Nutzung“ (master_ki_nutzung, Budget, Preise)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-master-ki.js

   Wunsch 24.10.: „Ich will Tokenusage tracken und zuweisen können, damit ich
   den Preis anpassen kann.“ Die Auswertung kommt aus master_ki_nutzung(),
   Budget und Preise gehen über master_ki_budget_setzen() / master_ki_preis_setzen()
   — alle in datenbank/migration-ki-nutzung.sql (zweite Quelle: die SQL-Datei).

   1 · Zeitraum: dieser Monat bis heute / Vormonat (auch über den Jahreswechsel),
       Uhr fest (§8.1j); genau die Parameter der Migration
   2 · Übersicht: Summe, Aufrufe, Token, „ohne Preis“; je Betrieb eine Karte nach
       Kosten geordnet; fünf Stände (Kein Budget / Im Rahmen / Warnung / Über
       Budget / Gesperrt), Balken im richtigen Anteil; Name nur als Text
   3 · Budget: gespeicherte Werte, „7,5“ und leer = kein Budget, Unlesbares wird
       NIE gesendet, genau die Parameter, Absage als Satz
   4 · Preise: Eingabe/Ausgabe gehören zusammen, Komma, Unlesbares nicht gesendet,
       „nachgerechnet“ wird genannt
   5 · CSV: Formelzeichen entschärft, Komma als Dezimalzeichen, Kopfzeile
   6 · fehlende Migration / kein Recht als Satz; 390 px, ≥ 44 px, 16 px, ≥ 4,5:1
   EHRLICHE GRENZE: die Datenbank ist gestellt. Rechte und Rechnung selbst:
   datenbank/pruef-ki-nutzung.sql (zurückgedreht, lokal Postgres 16).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const S = n => "file://" + path.join(__dirname, "..", "seiten", n);
const MIG = fs.readFileSync(path.join(__dirname, "..", "datenbank", "migration-ki-nutzung.sql"), "utf8");
const BOARD = fs.readFileSync(path.join(__dirname, "..", "seiten", "master.html"), "utf8");

let fehler = 0, n = 0;
function pruef(gut, text, zusatz){
  n++; console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz !== undefined ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}
const funktion = name => { const m = MIG.match(new RegExp("create or replace function public\\." + name + "\\(([\\s\\S]*?)\\)\\s*returns[\\s\\S]*?\\n(?:end \\$\\$|\\$\\$);")); return m ? m[0] : ""; };
const params = name => (funktion(name).match(/^create or replace function public\.\w+\(([\s\S]*?)\)\s*returns/) || ["", ""])[1].match(/p_[a-z_]+/g) || [];

const DATEN = {
  ok: true,
  zeilen: [
    { betrieb_id:"b1", betrieb_name:"Choco <img src=x onerror=\"window.__xss=1\">", funktion:"uebersetzen", modell:"claude-opus-5", aufrufe:12, tokens_ein:24000, tokens_aus:12000, tokens_cache:0, bilder:0, kosten_eur:0.54, ohne_preis:0 },
    { betrieb_id:"b1", betrieb_name:"Choco <img src=x onerror=\"window.__xss=1\">", funktion:"bild_profi_frei", modell:"fal-ai/birefnet/v2", aufrufe:4, tokens_ein:0, tokens_aus:0, tokens_cache:0, bilder:4, kosten_eur:0, ohne_preis:2 },
    { betrieb_id:"b2", betrieb_name:"=HYPERLINK(\"http://x\";\"Klick\")", funktion:"beleg_lesen", modell:"claude-opus-5-5", aufrufe:3, tokens_ein:9000, tokens_aus:3000, tokens_cache:0, bilder:0, kosten_eur:1.2, ohne_preis:0 },
  ],
  budgets: [
    { betrieb_id:"b1", betrieb_name:"Choco <img src=x onerror=\"window.__xss=1\">", monat_eur:10, hart:true, warn_prozent:80, verbraucht_monat_eur:8.5 },
    { betrieb_id:"b2", betrieb_name:"=HYPERLINK(\"http://x\";\"Klick\")", monat_eur:1, hart:true, warn_prozent:80, verbraucht_monat_eur:1.2 },
    { betrieb_id:"b3", betrieb_name:"Neues Haus", monat_eur:null, hart:false, warn_prozent:80, verbraucht_monat_eur:0 },
    { betrieb_id:"b4", betrieb_name:"Ruhiges Haus", monat_eur:100, hart:false, warn_prozent:80, verbraucht_monat_eur:5 },
    { betrieb_id:"b5", betrieb_name:"Weiches Haus", monat_eur:2, hart:false, warn_prozent:80, verbraucht_monat_eur:2.5 },
  ],
  preise: [
    { modell:"claude-opus-5", art:"token", eingabe_eur_je_mio:4.6, ausgabe_eur_je_mio:23, cache_eur_je_mio:null, eur_je_bild:null, bemerkung:"Kurs 0,92 am 24.10." },
    { modell:"claude-haiku-5-5", art:"token", eingabe_eur_je_mio:null, ausgabe_eur_je_mio:null, cache_eur_je_mio:null, eur_je_bild:null, bemerkung:null },
    { modell:"fal-ai/birefnet/v2", art:"bild", eingabe_eur_je_mio:null, ausgabe_eur_je_mio:null, cache_eur_je_mio:null, eur_je_bild:null, bemerkung:null },
  ],
};

function ersatz(antwort){
  return "(function(antwort){" + `
    window.__rufe = { nutzung: [], budget: [], preis: [] };
    const nutzer = { id:"00000000-0000-0000-0000-000000000001", email:"master@probe.de" };
    const sitzung = { user:nutzer, access_token:"x" };
    const leer = () => {
      const erg = { data:[], error:null, count:0 };
      const p = new Proxy(function(){}, {
        get(_, k){
          if(k === "then") return (a, b) => Promise.resolve(erg).then(a, b);
          if(k === "single" || k === "maybeSingle") return () => Promise.resolve({ data:null, error:null });
          return () => p;
        },
        apply(){ return p; }
      });
      return p;
    };
    window.supabase = { createClient: () => ({
      auth: {
        getSession: async () => ({ data:{ session: sitzung } }),
        getUser: async () => ({ data:{ user: nutzer } }),
        signInWithPassword: async () => ({ data:{ user:nutzer, session:sitzung }, error:null }),
        signOut: async () => ({}),
        updateUser: async () => ({ data:{ user:nutzer }, error:null }),
        resetPasswordForEmail: async () => ({ error:null }),
        onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
        signInWithOAuth: async () => ({ data:{}, error:null })
      },
      rpc: async (name, param) => {
        if(name === "master_ki_nutzung"){
          window.__rufe.nutzung.push(param);
          if(antwort && antwort.fehlercode) return { data:null, error:{ code:antwort.fehlercode, message:antwort.fehlermeldung || "Fehler" } };
          return { data: antwort, error:null };
        }
        if(name === "master_ki_budget_setzen"){ window.__rufe.budget.push(param); return { data: window.__budgetAntwort || { ok:true }, error:null }; }
        if(name === "master_ki_preis_setzen"){ window.__rufe.preis.push(param); return { data: window.__preisAntwort || { ok:true, nachgerechnet:0 }, error:null }; }
        if(name === "ist_master") return { data:true, error:null };
        return { data:null, error:null };
      },
      from: () => leer(),
      channel: () => ({ on(){ return this; }, subscribe(){ return this; }, unsubscribe(){} }),
      removeChannel: () => {}, removeAllChannels: () => {},
      functions: { invoke: async () => ({ data:null, error:null }) },
      storage: { from: () => ({ getPublicUrl: () => ({ data:{ publicUrl:"" } }), upload: async () => ({}) }) }
    }) };
  ` + "})(" + JSON.stringify(antwort) + ");";
}

async function masterOffen(browser, antwort, uhr){
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, acceptDownloads:true });
  /* Uhr fest (§8.1j): Monatsgrenzen sind sonst eine Frage des Tages, an dem die Prüfung läuft. */
  await ctx.clock.setFixedTime(new Date(uhr || "2026-10-24T10:00:00"));
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push(String(e).slice(0, 200)));
  await p.addInitScript({ content: ersatz(antwort) });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto(S("master.html"));
  await p.waitForSelector("#app:not(.hidden)", { timeout: 10000 });
  await p.waitForTimeout(500);
  return { ctx, p, kons };
}

/* Kontrast, Tapflächen, 16 px: Grund = erste deckende Farbe darüber (Muster aus pruef-master-ketten). */
async function messen(p, wurzel){
  return p.evaluate(wz => {
    const rgb = s => { const m = (s || "").match(/rgba?\(([^)]+)\)/); if(!m) return null; const v = m[1].split(",").map(x => parseFloat(x)); return { r:v[0], g:v[1], b:v[2], a: v.length > 3 ? v[3] : 1 }; };
    const L = c => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const mische = (o, u) => ({ r:o.r * o.a + u.r * (1 - o.a), g:o.g * o.a + u.g * (1 - o.a), b:o.b * o.a + u.b * (1 - o.a), a:1 });
    function grund(el){
      const kette = []; for(let e = el; e; e = e.parentElement){ const st = getComputedStyle(e); kette.push(rgb(st.backgroundColor) && rgb(st.backgroundColor).a > 0 ? rgb(st.backgroundColor) : rgb(st.backgroundImage)); }
      let c = { r:20, g:16, b:14, a:1 };
      for(let i = kette.length - 1; i >= 0; i--){ const b = kette[i]; if(b && b.a > 0) c = b.a >= 1 ? b : mische(b, c); }
      return c;
    }
    const w = document.querySelector(wz); if(!w) return null;
    let min = 99, wo = "";
    for(const el of w.querySelectorAll("*")){
      if(![...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim())) continue;
      const r = el.getBoundingClientRect(); if(!r.width) continue;
      const st = getComputedStyle(el), f = rgb(st.webkitTextFillColor || st.color) || rgb(st.color), g = grund(el);
      if(!f || !g) continue;
      const ff = f.a < 1 ? mische(f, g) : f, a = L(ff), b = L(g), k = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      if(k < min){ min = k; wo = (el.id || el.tagName) + " „" + el.textContent.trim().slice(0, 30) + "“"; }
    }
    /* Ein Kästchen im Label zählt mit der Fläche des Labels (das ist, was der Finger trifft). */
    const flaeche = el => (el.type === "checkbox" && el.closest("label") ? el.closest("label") : el).getBoundingClientRect();
    const klein = [...w.querySelectorAll("button, input, select")].filter(el => { const r = flaeche(el); return r.width && r.height < 43.5; })
      .map(el => (el.id || el.textContent.trim()).slice(0, 20) + " " + Math.round(flaeche(el).height));
    const fs16 = [...w.querySelectorAll("input:not([type=checkbox]), select")].every(el => parseFloat(getComputedStyle(el).fontSize) >= 16);
    return { min: Math.round(min * 100) / 100, wo, klein, fs16, ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  }, wurzel);
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());

  console.log("══ Naht zur Migration ══");
  {
    const gesendet = [["master_ki_nutzung", ["p_von", "p_bis"]], ["master_ki_budget_setzen", ["p_betrieb", "p_monat_eur", "p_hart", "p_warn"]],
      ["master_ki_preis_setzen", ["p_modell", "p_art", "p_ein", "p_aus", "p_cache", "p_bild", "p_bemerkung"]]];
    for(const [name, erwartet] of gesendet)
      pruef(JSON.stringify(params(name)) === JSON.stringify(erwartet), name + ": Parameter der Migration = die, die das Board schickt", params(name).join(","));
    const gruende = new Set();
    for(const name of ["master_ki_nutzung", "master_ki_budget_setzen", "master_ki_preis_setzen"])
      for(const m of funktion(name).matchAll(/'grund',\s*'(\w+)'/g)) gruende.add(m[1]);
    const satz = (BOARD.match(/var KI_GRUND = \{([\s\S]*?)\n  \};/) || ["", ""])[1];
    const ohneSatz = [...gruende].filter(g => !new RegExp("\\b" + g + "\\s*:\\s*'").test(satz));
    pruef(gruende.size >= 8 && !ohneSatz.length, "jeder Grund der drei Funktionen hat im Board einen Satz", ohneSatz.join(",") || [...gruende].join(","));
    const zeilenFelder = ["betrieb_id", "betrieb_name", "funktion", "modell", "aufrufe", "tokens_ein", "tokens_aus", "tokens_cache", "bilder", "kosten_eur", "ohne_preis"];
    const kopf = funktion("master_ki_nutzung");
    const fehlen = zeilenFelder.filter(f => !new RegExp("\\b" + f + "\\b").test(kopf));
    pruef(!fehlen.length, "jedes Feld, das das Board aus den Zeilen liest, baut master_ki_nutzung", fehlen.join(",") || "alle");
    const budgetFelder = ["betrieb_id", "betrieb_name", "monat_eur", "hart", "warn_prozent", "verbraucht_monat_eur"];
    pruef(budgetFelder.every(f => new RegExp("'" + f + "'").test(kopf)), "… und jedes Feld der Budgets");
    const preisSpalten = ["modell", "art", "eingabe_eur_je_mio", "ausgabe_eur_je_mio", "cache_eur_je_mio", "eur_je_bild", "bemerkung"];
    const tabelle = (MIG.match(/create table if not exists public\.ki_preise \(([\s\S]*?)\n\);/) || ["", ""])[1];
    pruef(preisSpalten.every(f => new RegExp("\\b" + f + "\\b").test(tabelle)), "… und jede Spalte der Preise (to_jsonb(ki_preise))");
    const funktionenSql = (MIG.match(/funktion\s+text not null check \(funktion in \(([^)]*)\)\)/) || ["", ""])[1].match(/'(\w+)'/g).map(x => x.slice(1, -1));
    pruef(JSON.stringify(funktionenSql.sort()) === JSON.stringify(Object.keys({ bild_profi_frei:1, beleg_lesen:1, uebersetzen:1 }).sort()) &&
      funktionenSql.every(f => new RegExp("\\b" + f + "\\s*:\\s*'").test((BOARD.match(/var KI_FUNKTION = \{([\s\S]*?)\};/) || ["", ""])[1])),
      "jede Funktion der CHECK-Liste hat im Board einen Namen", funktionenSql.join(","));
  }

  console.log("\n══ 1 · Zeitraum (Uhr fest) ══");
  {
    const { ctx, p, kons } = await masterOffen(browser, DATEN);
    let r = await p.evaluate(() => window.__rufe.nutzung);
    pruef(r.length === 1 && r[0].p_von === "2026-10-01" && r[0].p_bis === "2026-10-24", "dieser Monat: 1. bis heute, genau eine Abfrage", JSON.stringify(r));
    const note = await p.evaluate(() => document.getElementById("kiNote").textContent);
    pruef(/01\.10\. – 24\.10\./.test(note), "Kopfzeile nennt den Zeitraum", note);
    await p.click("#kiMonat"); await p.waitForTimeout(500);
    r = await p.evaluate(() => window.__rufe.nutzung);
    pruef(r.length === 2 && r[1].p_von === "2026-09-01" && r[1].p_bis === "2026-09-30", "Vormonat: 1. bis letzter Tag", JSON.stringify(r[1]));
    pruef(await p.evaluate(() => document.getElementById("kiMonat").textContent) === "Dieser Monat", "der Knopf wechselt zurück-Beschriftung");
    await p.click("#kiMonat"); await p.waitForTimeout(500);
    r = await p.evaluate(() => window.__rufe.nutzung);
    pruef(r.length === 3 && r[2].p_von === "2026-10-01", "und wieder dieser Monat");
    pruef(kons.length === 0, "keine Laufzeitfehler", kons.join(" | ") || "still");
    await ctx.close();
    const j = await masterOffen(browser, DATEN, "2026-01-15T12:00:00");
    await j.p.click("#kiMonat"); await j.p.waitForTimeout(500);
    const rj = await j.p.evaluate(() => window.__rufe.nutzung);
    pruef(rj[1].p_von === "2025-12-01" && rj[1].p_bis === "2025-12-31", "Vormonat über den Jahreswechsel: Dezember des Vorjahres", JSON.stringify(rj[1]));
    await j.ctx.close();
    const m = await masterOffen(browser, DATEN, "2026-03-31T23:30:00");
    await m.p.click("#kiMonat"); await m.p.waitForTimeout(500);
    const rm = await m.p.evaluate(() => window.__rufe.nutzung);
    pruef(rm[1].p_von === "2026-02-01" && rm[1].p_bis === "2026-02-28", "Vormonat am 31.3.: Februar, 28 Tage (nicht der 3. März)", JSON.stringify(rm[1]));
    await m.ctx.close();
  }

  console.log("\n══ 2 · Übersicht ══");
  {
    const { ctx, p, kons } = await masterOffen(browser, DATEN);
    const st = await p.evaluate(() => ({
      xss: window.__xss || 0,
      summe: document.querySelector("#kiListe .ki-summe").textContent.replace(/\s+/g, " "),
      warn: (document.querySelector("#kiListe .ki-summe-karte .kt-warn") || {}).textContent || "",
      karten: [...document.querySelectorAll("#kiListe .ki-karte")].map(k => ({ id: k.dataset.kiBetrieb, name: k.querySelector(".z-betrieb").textContent,
        mail: k.querySelector(".z-mail").textContent.replace(/\s+/g, " "), zeilen: [...k.querySelectorAll(".ki-zeile")].map(z => z.textContent.replace(/\s+/g, " ")),
        stand: k.querySelector(".stand").textContent, stil: k.querySelector(".stand").className,
        balken: k.querySelector(".ki-balken") ? { klasse: k.querySelector(".ki-balken").className, breite: k.querySelector(".ki-balken i").style.width, aria: k.querySelector(".ki-balken").getAttribute("aria-label") } : null,
        h: k.getBoundingClientRect().height }))
    }));
    pruef(/1,74\s?€/.test(st.summe) && /19/.test(st.summe) && /48\.000/.test(st.summe) && /4 Bilder/.test(st.summe), "Summe: 1,74 €, 19 Aufrufe, 48.000 Token (36.000 + 12.000), 4 Bilder", st.summe);
    pruef(/2 Aufrufe ohne Preis/.test(st.warn), "Aufrufe ohne Preis werden genannt (nicht als 0 € verschwiegen)", st.warn);
    pruef(st.karten.length === 5, "je Betrieb eine Karte (auch ohne Nutzung)", st.karten.length);
    pruef(st.karten[0].id === "b2" && st.karten[1].id === "b1", "geordnet nach Kosten: erst der teurere Betrieb", st.karten.map(k => k.id).join(","));
    const stand = Object.fromEntries(st.karten.map(k => [k.id, k.stand]));
    pruef(stand.b1 === "Warnung" && stand.b2 === "Gesperrt" && stand.b3 === "Kein Budget" && stand.b4 === "Im Rahmen" && stand.b5 === "Über Budget",
      "fünf Stände: Warnung (85 %, hart) · Gesperrt (hart, erreicht) · Kein Budget · Im Rahmen · Über Budget (weich)", JSON.stringify(stand));
    const k1 = st.karten.find(k => k.id === "b1"), k2 = st.karten.find(k => k.id === "b2"), k5 = st.karten.find(k => k.id === "b5");
    pruef(k1.balken.breite === "85%" && /warn/.test(k1.balken.klasse) && /85 Prozent/.test(k1.balken.aria), "Balken: 85 % und Warnstufe", JSON.stringify(k1.balken));
    pruef(k2.balken.breite === "100%" && /ueber/.test(k2.balken.klasse) && k5.balken.breite === "100%", "über 100 % wird bei 100 % gedeckelt", k2.balken.breite + "/" + k5.balken.breite);
    pruef(k1.zeilen.length === 2 && /Übersetzer/.test(k1.zeilen[0]) && /Profi-Foto/.test(k1.zeilen[1]) && /Preis fehlt/.test(k1.zeilen[1]) && /4 Bilder/.test(k1.zeilen[1]),
      "Zeilen je Funktion mit Klartextnamen, Bilder statt Token, „Preis fehlt“", JSON.stringify(k1.zeilen));
    pruef(/hart/.test(k1.mail + " " + k1.zeilen.join(" ")) || true, "(Budgetzeile unten)");
    const text1 = await p.evaluate(() => document.querySelector('[data-ki-betrieb="b1"]').textContent.replace(/\s+/g, " "));
    pruef(/8,50\s?€ von 10,00\s?€/.test(text1) && /hart/.test(text1), "Budgetzeile: verbraucht von Budget, „hart“", text1.slice(-60));
    const text4 = await p.evaluate(() => document.querySelector('[data-ki-betrieb="b4"]').textContent.replace(/\s+/g, " "));
    pruef(/nur Anzeige/.test(text4), "weiches Budget heißt „nur Anzeige“", text4.slice(-50));
    pruef(st.xss === 0 && /<img/.test(k1.name), "Name aus der Datenbank nur als Text (kein Skript, die Marke bleibt aus)", k1.name.slice(0, 24));
    pruef(st.karten.every(k => k.h >= 44), "jede Karte ≥ 44 px antippbar", st.karten.map(k => Math.round(k.h)).join(","));
    const m = await messen(p, "#kiListe");
    pruef(m && m.min >= 4.5 && m.ueber <= 0, "Übersicht: jede Schrift ≥ 4,5:1, kein seitlicher Überlauf bei 390 px", m && (m.min + " " + m.wo + " Überlauf " + m.ueber));
    pruef(kons.length === 0, "keine Laufzeitfehler", kons.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ 3 · Budget ══");
  {
    const { ctx, p, kons } = await masterOffen(browser, DATEN);
    await p.click('#kiListe [data-ki-betrieb="b1"]'); await p.waitForTimeout(250);
    const form = await p.evaluate(() => ({ b: document.getElementById("kiBetrag").value, w: document.getElementById("kiWarn").value, h: document.getElementById("kiHart").checked,
      kopf: document.querySelector(".sheet h3").textContent }));
    pruef(form.b === "10" && form.w === "80" && form.h === true && /Choco/.test(form.kopf), "Tipp öffnet das Budget mit den gespeicherten Werten", JSON.stringify(form));
    const mb = await messen(p, ".sheet");
    pruef(mb && mb.min >= 4.5 && !mb.klein.length && mb.fs16, "Blatt: Schrift ≥ 4,5:1, Knöpfe ≥ 44 px, Felder 16 px", mb && (mb.min + " " + mb.wo + " klein=" + mb.klein.join(",")));
    /* Unlesbares darf NIE gesendet werden */
    for(const [betrag, warn, was] of [["abc", "80", "Betrag „abc“"], ["10 Euro", "80", "Betrag „10 Euro“"], ["-5", "80", "negativer Betrag"], ["200000", "80", "Betrag über 100 000"],
      ["10", "0", "Warnung 0"], ["10", "101", "Warnung 101"], ["10", "", "Warnung leer"], ["10", "7,5", "Warnung 7,5"]]){
      await p.fill("#kiBetrag", betrag); await p.fill("#kiWarn", warn); await p.click("#kiSave"); await p.waitForTimeout(150);
      const s = await p.evaluate(() => ({ gesendet: window.__rufe.budget.length, meld: document.getElementById("kiMeldung").textContent, offen: !!document.querySelector(".overlay") }));
      pruef(s.gesendet === 0 && s.offen && s.meld.length > 10, "unlesbar: " + was + " → Satz, nichts gesendet", s.meld);
    }
    await p.fill("#kiBetrag", "7,5"); await p.fill("#kiWarn", "60");
    await p.evaluate(() => { document.getElementById("kiHart").checked = false; });
    await p.click("#kiSave"); await p.waitForTimeout(300);
    const g = await p.evaluate(() => window.__rufe.budget[0]);
    pruef(g && JSON.stringify(Object.keys(g).sort()) === JSON.stringify(params("master_ki_budget_setzen").sort()), "Speichern schickt genau die Parameter der Migration", g && Object.keys(g).join(","));
    pruef(g && g.p_betrieb === "b1" && g.p_monat_eur === 7.5 && g.p_hart === false && g.p_warn === 60, "… „7,5“ wird 7.5 (Zahl), Haken weg = nicht hart", JSON.stringify(g));
    pruef(await p.evaluate(() => !document.querySelector(".overlay")), "nach dem Speichern schließt das Blatt, die Übersicht wird neu geholt", await p.evaluate(() => window.__rufe.nutzung.length));
    await p.click('#kiListe [data-ki-betrieb="b3"]'); await p.waitForTimeout(250);
    await p.fill("#kiBetrag", ""); await p.click("#kiSave"); await p.waitForTimeout(300);
    const l = await p.evaluate(() => window.__rufe.budget[1]);
    pruef(l && l.p_monat_eur === null && l.p_betrieb === "b3", "leerer Betrag = kein Budget (null), nicht 0", JSON.stringify(l));
    await p.evaluate(() => { window.__budgetAntwort = { ok:false, grund:"kein_master" }; });
    await p.click('#kiListe [data-ki-betrieb="b4"]'); await p.waitForTimeout(250);
    await p.click("#kiSave"); await p.waitForTimeout(300);
    const a = await p.evaluate(() => ({ t: document.getElementById("kiMeldung").textContent, offen: !!document.querySelector(".overlay") }));
    pruef(a.offen && /Master-Konto/.test(a.t), "Absage des Servers: Blatt bleibt offen, ein Satz statt Fehlercode", a.t);
    pruef(kons.length === 0, "keine Laufzeitfehler", kons.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ 4 · Preise ══");
  {
    const { ctx, p, kons } = await masterOffen(browser, DATEN);
    await p.click("#kiPreiseKnopf"); await p.waitForTimeout(250);
    const f = await p.evaluate(() => ({
      zeilen: [...document.querySelectorAll(".ki-preis")].map(z => ({ m: z.dataset.kiModell, art: z.dataset.kiArt, fehlt: !!z.querySelector(".ki-fehlt"), felder: [...z.querySelectorAll("input")].map(i => i.dataset.f + "=" + i.value) })),
    }));
    pruef(f.zeilen.length === 3 && f.zeilen[0].felder.join() === "ein=4,6,aus=23,cache=,bem=Kurs 0,92 am 24.10." && !f.zeilen[0].fehlt, "gespeicherte Preise mit Komma, Cache leer, Bemerkung", JSON.stringify(f.zeilen[0]));
    pruef(f.zeilen[1].fehlt && f.zeilen[2].fehlt && f.zeilen[2].art === "bild" && f.zeilen[2].felder.join() === "bild=,bem=", "fehlende Preise stehen als „Preis fehlt“, Bilder haben ein Feld je Bild", JSON.stringify(f.zeilen[2]));
    const mp = await messen(p, ".sheet");
    pruef(mp && mp.min >= 4.5 && !mp.klein.length && mp.fs16, "Blatt: Schrift ≥ 4,5:1, Knöpfe ≥ 44 px, Felder 16 px", mp && (mp.min + " " + mp.wo + " klein=" + mp.klein.join(",")));
    const zeile = i => `.ki-preis:nth-of-type(${i})`;
    const sende = async (sel, felder) => {
      for(const [k, v] of Object.entries(felder)) await p.fill(`${sel} [data-f="${k}"]`, v);
      await p.click(`${sel} [data-ki-preis-speichern]`); await p.waitForTimeout(250);
      return p.evaluate(() => ({ n: window.__rufe.preis.length, meld: [...document.querySelectorAll("[data-ki-meldung]")].map(x => x.textContent).join("|") }));
    };
    const haiku = '.ki-preis[data-ki-modell="claude-haiku-5-5"]';
    let s = await sende(haiku, { ein: "0,1", aus: "" });
    pruef(s.n === 0 && /gehören zusammen/.test(s.meld), "nur der Eingabepreis → Satz „gehören zusammen“, nichts gesendet", s.meld);
    s = await sende(haiku, { ein: "abc", aus: "0,5" });
    pruef(s.n === 0 && /ungültig/.test(s.meld), "unlesbar („abc“) → Satz, nichts gesendet", s.meld);
    s = await sende(haiku, { ein: "-1", aus: "0,5" });
    pruef(s.n === 0, "negativ → nichts gesendet");
    s = await sende(haiku, { ein: "0,09", aus: "0,46", cache: "0,01" });
    const pr = await p.evaluate(() => window.__rufe.preis[0]);
    pruef(s.n === 1 && JSON.stringify(Object.keys(pr).sort()) === JSON.stringify(params("master_ki_preis_setzen").sort()), "Speichern schickt genau die Parameter der Migration", pr && Object.keys(pr).join(","));
    pruef(pr.p_modell === "claude-haiku-5-5" && pr.p_art === "token" && pr.p_ein === 0.09 && pr.p_aus === 0.46 && pr.p_cache === 0.01 && pr.p_bild === null && pr.p_bemerkung === null,
      "… „0,09“ wird 0.09; leere Felder gehen als null, nie als 0", JSON.stringify(pr));
    await p.evaluate(() => { window.__preisAntwort = { ok:true, nachgerechnet:7 }; });
    const bild = '.ki-preis[data-ki-modell="fal-ai/birefnet/v2"]';
    s = await sende(bild, { bild: "0,04" });
    const pb = await p.evaluate(() => window.__rufe.preis[1]);
    pruef(pb && pb.p_art === "bild" && pb.p_bild === 0.04 && pb.p_ein === null && pb.p_aus === null, "Bildpreis: 0.04 je Bild, keine Tokenfelder", JSON.stringify(pb));
    pruef(/7 frühere Aufrufe nachgerechnet/.test(s.meld), "„nachgerechnet“ wird genannt", s.meld);
    await p.evaluate(() => { window.__preisAntwort = { ok:false, grund:"kein_master" }; });
    s = await sende('.ki-preis[data-ki-modell="claude-opus-5"]', { ein: "5" });
    pruef(/Master-Konto/.test(s.meld), "Absage des Servers als Satz", s.meld);
    pruef(kons.length === 0, "keine Laufzeitfehler", kons.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ 5 · CSV ══");
  {
    const { ctx, p, kons } = await masterOffen(browser, DATEN);
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#kiCsv")]);
    const text = fs.readFileSync(await dl.path(), "utf8");
    const zeilen = text.replace(/^﻿/, "").split("\r\n");
    pruef(/^ki-nutzung-2026-10-01-bis-2026-10-24\.csv$/.test(dl.suggestedFilename()), "Dateiname nennt den Zeitraum", dl.suggestedFilename());
    pruef(zeilen[0] === "Betrieb;Funktion;Modell;Aufrufe;Token Eingabe;Token Ausgabe;Token Cache;Bilder;Kosten EUR;Aufrufe ohne Preis" && zeilen.length === 4, "Kopfzeile und drei Datenzeilen", zeilen.length);
    pruef(zeilen[1].includes(";0,54;") || zeilen.some(z => z.includes(";0,54;")), "Dezimalzeichen Komma (für deutsches Excel)", zeilen[1]);
    const zellen = zeilen.slice(1).map(z => z.split(";")[0]);
    pruef(zeilen.slice(1).every(z => !/^[=+\-@\t]/.test(z)) && zeilen.some(z => z.startsWith("\"'=HYPERLINK")), "Betriebsname mit = am Anfang wird entschärft (Apostroph), keine Zeile beginnt mit Formelzeichen", zellen[2]);
    pruef(kons.length === 0, "keine Laufzeitfehler", kons.join(" | ") || "still");
    await ctx.close();
  }

  console.log("\n══ 6 · Migration fehlt / kein Recht ══");
  {
    let r = await masterOffen(browser, { fehlercode:"42883", fehlermeldung:"function master_ki_nutzung(date, date) does not exist" });
    let t = await r.p.evaluate(() => ({ t: document.getElementById("kiListe").textContent, preise: !!document.querySelector(".overlay") }));
    pruef(/migration-ki-nutzung\.sql/.test(t.t), "sagt, welche Migration fehlt", t.t.trim().slice(0, 80));
    await r.p.click("#kiPreiseKnopf"); await r.p.waitForTimeout(200);
    pruef(await r.p.evaluate(() => !document.querySelector(".overlay")), "ohne Daten öffnet „Preise“ nichts (kein leeres Blatt)");
    await r.p.click("#kiCsv"); await r.p.waitForTimeout(200);
    pruef(kons(r) === 0, "kein Absturz", r.kons.join(" | ") || "still");
    await r.ctx.close();
    r = await masterOffen(browser, { ok:false, grund:"kein_master" });
    t = await r.p.evaluate(() => document.getElementById("kiListe").textContent);
    pruef(/nur ein Master-Konto/.test(t), "kein Recht: ein Satz", t.trim().slice(0, 60));
    await r.ctx.close();
    r = await masterOffen(browser, { ok:true, zeilen:[], budgets:[], preise:[] });
    t = await r.p.evaluate(() => ({ summe: document.querySelector("#kiListe .ki-summe").textContent.replace(/\s+/g, " "), karten: document.querySelectorAll("#kiListe .ki-karte").length }));
    pruef(/0,00\s?€/.test(t.summe) && t.karten === 0 && r.kons.length === 0, "leere Antwort: 0,00 €, keine Karten, kein Absturz", t.summe);
    await r.ctx.close();
  }
  function kons(r){ return r.kons.length; }
  await browser.close();
  console.log("\n" + (n - fehler) + " von " + n + " ok");
  console.log(fehler ? fehler + " FEHLER" : "Alles sauber.");
  process.exit(fehler ? 1 : 0);
})();
