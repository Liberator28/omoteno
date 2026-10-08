/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Gutscheine für Stammgäste im Admin-Board

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-gutschein-board.js

   Auftrag: Der Wirt legt Gutscheine selbst an, der Gast sieht sie
   unter „Mein Tisch". Bisher ging das nur in der Datenbank.

   ZWEI ZWEITE QUELLEN (CLAUDE.md §8.1b, §8.1i):
     · datenbank/migration-gutscheine-masse.sql — die Längen- und
       Code-Schranke. Das Board muss dieselben Grenzen haben, sonst
       bietet es an, was die Datenbank ablehnt (oder umgekehrt).
     · datenbank/stand-gast-melden.sql — bytegleiche Kopie der
       Live-Funktion. Das Board schreibt Spalten, der Hub liest
       Schlüssel; die Naht wird gegen DIESEN Text gehalten, nicht
       gegen eine Erfindung einer der beiden Seiten.

   Der Schreibweg selbst läuft mit einem gestellten `db`, der jeden
   Aufruf mitschreibt — gemessen wird, WAS das Board schickt.

   Seit migration-gutschein-sicher.sql: Ausstellen über
   gutschein_ausstellen() mit PIN, Beenden über gutschein_beenden(),
   den Code vergibt der Server (nur eine Vorsilbe ist wählbar). Die
   dritte zweite Quelle ist DIESE Migration: Parameter der Funktion und
   die Spalten, in die sie schreibt.

   EHRLICHE GRENZE: RLS und die CHECK-Schranke sind hier nicht
   geprüft, sondern live in einer zurückgedrehten Transaktion
   (Protokoll am Ende von migration-gutscheine-masse.sql).

   Gegenbeweis GEFAHREN (CLAUDE.md §8.1g), jeweils mit grep -c
   belegt, dass die Sabotage ankam, danach zurückgenommen:
     1. gsCodeSauber() ohne toUpperCase → „Code wird beim Tippen
        bereinigt" rot.
     2. TEXTMASS.gsTitel.hart auf 61 → „Titelgrenze = Datenbank" rot.
     3. insert-Schlüssel beschreibung → text → „jede geschriebene
        Spalte gibt es" und „Naht" rot.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN  = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const HUBQ  = path.join(OBEN, "vorlagen", "hub.vorlage.html");
/* Seit 26.09. gilt die Schranke aus migration-texte-laenger.sql
   (Titel 80, Text 240) — sie ersetzt die aus migration-gutscheine-
   masse.sql unter demselben Namen. Gelesen wird die JÜNGSTE Fassung;
   die alte Datei ist Geschichte. */
const MIG   = path.join(OBEN, "datenbank", "migration-texte-laenger.sql");
const STAND = path.join(OBEN, "datenbank", "stand-gast-melden.sql");
const SICHER = path.join(OBEN, "datenbank", "migration-gutschein-sicher.sql");

/* ── Zweite Quelle 3: gutschein_ausstellen in der Migration ──────── */
function ausstellenLesen() {
  const sql = fs.readFileSync(SICHER, "utf8");
  const kopf = sql.match(/function public\.gutschein_ausstellen\(([\s\S]*?)\)\s*returns/);
  const params = kopf ? [...kopf[1].matchAll(/\b(p_\w+)\s/g)].map(m => m[1]) : [];
  const ins = sql.match(/insert into public\.gutscheine \(([^)]*)\)/);
  const spalten = ins ? ins[1].split(",").map(x => x.trim()) : [];
  const praefix = sql.match(/v_praefix !~ '\^\[A-Z0-9\]\{0,(\d+)\}\$'/);
  const zeichen = sql.match(/for i in 0\.\.(\d+) loop/);
  return { params, spalten, praefixMax: praefix ? +praefix[1] : null, codeLaenge: zeichen ? +zeichen[1] + 1 : null };
}

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

/* Spalten von public.gutscheine, live aus information_schema gelesen
   (2026-09-24). Ändert sich die Tabelle, muss diese Liste mit. */
const SPALTEN = ["id","betrieb_id","gast_id","titel","beschreibung","code",
                 "gueltig_bis","eingeloest_am","angelegt"];

/* ── Zweite Quelle 1: die Schranke in der Migration ─────────────── */
function schrankeLesen() {
  const sql = fs.readFileSync(MIG, "utf8");
  const titel = sql.match(/char_length\(titel\) between (\d+) and (\d+)/);
  const text  = sql.match(/char_length\(beschreibung\) <= (\d+)/);
  const code  = sql.match(/code ~ '(\^\[A-Z0-9-\]\{(\d+),(\d+)\}\$)'/);
  return {
    titelMax: titel ? +titel[2] : null,
    textMax:  text  ? +text[1]  : null,
    codeMin:  code  ? +code[2]  : null,
    codeMax:  code  ? +code[3]  : null
  };
}

/* ── Zweite Quelle 2: was gast_melden aus welcher Spalte macht ───── */
function nahtLesen() {
  const sql = fs.readFileSync(STAND, "utf8");
  const block = sql.match(/jsonb_build_object\(\s*('titel'[\s\S]*?)\)\s*order by/);
  if (!block) return null;
  const paare = {};
  for (const m of block[1].matchAll(/'(\w+)',\s*g\.(\w+)/g)) paare[m[1]] = m[2];
  return paare;   /* { titel:"titel", text:"beschreibung", code:"code", bis:"gueltig_bis" } */
}

async function boardOeffnen(browser, breite) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 900 } });
  const seite = await ctx.newPage();
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(600);
  await seite.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
  });
  await seite.waitForTimeout(300);
  const scharf = await seite.$("#scharfJetzt");
  if (scharf && await seite.isVisible("#scharf")) { await scharf.click(); await seite.waitForTimeout(150); }
  await seite.evaluate(() => {
    const k = document.querySelector('[data-tafel="einstellungen"]');
    if (k) k.click();
  });
  await seite.waitForTimeout(400);
  return { ctx, seite };
}

async function anzahlZeilen(seite) { return seite.$$eval(".gs-zeile", z => z.length); }
async function meldung(seite) { return seite.$eval("#meldung", m => m.textContent); }

(async () => {
  const browser = await chromium.launch();

  console.log("\n══ Zweite Quelle: Grenzen von Board und Datenbank ══");
  const s = schrankeLesen();
  pruef(s.titelMax && s.textMax && s.codeMax, "Schranke aus der Migration gelesen", JSON.stringify(s));

  const a = ausstellenLesen();
  pruef(a.params.length >= 5 && a.spalten.length >= 5 && a.praefixMax && a.codeLaenge,
    "gutschein_ausstellen aus migration-gutschein-sicher.sql gelesen", JSON.stringify(a));
  pruef(a.praefixMax + 1 + a.codeLaenge <= s.codeMax,
    "längster Server-Code (Vorsilbe + „-“ + Zufall) passt in die Code-Schranke",
    (a.praefixMax + 1 + a.codeLaenge) + " ≤ " + s.codeMax);

  const { ctx, seite } = await boardOeffnen(browser, 390);
  const board = await seite.evaluate(() => ({
    titel: TEXTMASS.gsTitel && TEXTMASS.gsTitel.hart,
    text:  TEXTMASS.gsText && TEXTMASS.gsText.hart,
    maxT:  document.getElementById("gsTitel").maxLength,
    maxP:  document.getElementById("gsPraefix").maxLength
  }));
  pruef(board.titel === s.titelMax, "Titelgrenze im Board = Datenbank", board.titel + " / " + s.titelMax);
  pruef(board.text === s.textMax, "Textgrenze im Board = Datenbank", board.text + " / " + s.textMax);
  pruef(board.maxT === s.titelMax && board.maxP === a.praefixMax, "Felder nehmen nicht mehr an als die Datenbank",
    "Titel " + board.maxT + ", Vorsilbe " + board.maxP + " / " + a.praefixMax);

  console.log("\n══ Formular ══");
  pruef(await seite.isVisible("#gsGruppe"), "Gutschein-Gruppe steht im Reiter Einstellungen");
  pruef(!(await seite.$("#gsCode")), "kein Feld für einen selbst gewählten Code mehr");

  await seite.fill("#gsPraefix", "");
  await seite.type("#gsPraefix", "kaffee für 2");
  const sauber = await seite.inputValue("#gsPraefix");
  pruef(sauber === "KAFFEEFU", "Vorsilbe wird beim Tippen bereinigt und auf 8 gekürzt", sauber);

  const hoehen = await seite.evaluate(() => ["#gsTitel", "#gsText", "#gsPraefix", "#gsBis", "#gsAnlegen"]
    .map(id => Math.round(document.querySelector(id).getBoundingClientRect().height)));
  pruef(hoehen.every(h => h >= 44), "Tapflächen ≥ 44px", hoehen.join(", "));
  /* Vorfall beim ersten Bildschirmfoto: Das Datumsfeld ragte bei 390px
     über den Kartenrand und stand 28px höher als das Code-Feld. */
  const lage = await seite.evaluate(() => {
    const karte = document.getElementById("gsGruppe").getBoundingClientRect();
    const rand = parseFloat(getComputedStyle(document.getElementById("gsGruppe")).paddingRight);
    const d = document.getElementById("gsBis").getBoundingClientRect();
    const c = document.getElementById("gsPraefix").getBoundingClientRect();
    return { ueber: Math.round(d.right - (karte.right - rand)), dh: Math.round(d.height), ch: Math.round(c.height),
             dy: Math.round(d.top - c.top) };
  });
  pruef(lage.ueber <= 0, "Datumsfeld bleibt in der Karte", lage.ueber + "px über dem Rand");
  pruef(Math.abs(lage.dh - lage.ch) <= 4 && Math.abs(lage.dy) <= 2, "Datums- und Vorsilbe-Feld gleich hoch, auf einer Linie",
    "Höhe " + lage.dh + "/" + lage.ch + ", Versatz " + lage.dy + "px");
  const schrift = await seite.evaluate(() => ["#gsTitel", "#gsPraefix"]
    .map(id => parseFloat(getComputedStyle(document.querySelector(id)).fontSize)));
  pruef(schrift.every(x => x >= 16), "Eingabefelder 16px (kein Zoom auf iOS)", schrift.join(", "));

  console.log("\n══ Anlegen mit PIN, Beenden (Vorführmodus) ══");
  const vorher = await anzahlZeilen(seite);
  await seite.fill("#gsTitel", "Ein Heißgetränk aufs Haus");
  await seite.fill("#gsText", "Weil Sie öfter bei uns sind.");
  await seite.fill("#gsPraefix", "DANKE");
  await seite.click("#gsAnlegen");
  await seite.waitForSelector("#apBlatt:not([hidden])", { timeout: 2000 }).catch(() => {});
  pruef(await seite.isVisible("#apBlatt") && await anzahlZeilen(seite) === vorher,
    "erst das PIN-Blatt, noch nichts angelegt");
  await seite.fill("#apPin", "12345678");
  await seite.click("#apOk");
  await seite.waitForTimeout(400);
  pruef(await anzahlZeilen(seite) === vorher + 1, "neuer Gutschein steht in der Liste");
  pruef(/DANKE-[A-HJ-NP-Z2-9]{10}/.test(await seite.textContent("#gsListe")), "mit Vorsilbe und 10 Zeichen Zufall");
  pruef(/ausgestellt von/.test(await seite.textContent("#gsListe")), "die Liste nennt, wer ausgestellt hat");
  pruef(/Mein Tisch/.test(await meldung(seite)), "Meldung sagt, wo der Gast ihn sieht", await meldung(seite));
  pruef(await seite.inputValue("#gsTitel") === "", "Formular danach leer");

  await seite.fill("#gsTitel", "");
  await seite.click("#gsAnlegen");
  await seite.waitForTimeout(200);
  pruef(await anzahlZeilen(seite) === vorher + 1, "leerer Titel legt nichts an");

  await seite.fill("#gsTitel", "Gestern");
  await seite.fill("#gsBis", "2020-01-01");
  await seite.click("#gsAnlegen");
  await seite.waitForTimeout(200);
  pruef(await anzahlZeilen(seite) === vorher + 1, "Datum in der Vergangenheit legt nichts an");
  await seite.fill("#gsBis", "");

  seite.once("dialog", d => d.dismiss());
  await seite.click(".gs-zeile [data-gs-ende]");
  await seite.waitForTimeout(200);
  pruef(await anzahlZeilen(seite) === vorher + 1, "Beenden abgebrochen → bleibt stehen");
  seite.once("dialog", d => d.accept());
  await seite.click(".gs-zeile [data-gs-ende]");
  await seite.waitForTimeout(200);
  pruef(await anzahlZeilen(seite) === vorher, "Beenden bestätigt → verschwindet");

  const ueber = await seite.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  pruef(ueber <= 1, "390px: kein seitliches Schieben", ueber + "px");

  console.log("\n══ Fehlertexte: nie rohes JSON (§8.1h) ══");
  const texte = await seite.evaluate(() => [
    gsFehlerText({ code: "23505", message: "duplicate key value violates unique constraint \"gutscheine_betrieb_id_code_key\"" }),
    gsFehlerText({ code: "23514", message: "new row violates check constraint \"gutscheine_masse\"" }),
    gsFehlerText({ code: "42501", message: "new row violates row-level security policy" }),
    gsFehlerText({ message: "{\"code\":\"XX000\"}" }),
    gsFehlerText(null)
  ]);
  pruef(/schon/.test(texte[0]), "23505 → Code schon vergeben", texte[0]);
  pruef(/passen nicht/.test(texte[1]), "23514 → Grenze verletzt", texte[1]);
  pruef(/Berechtigung/.test(texte[2]), "42501 → Berechtigung", texte[2]);
  pruef(texte.every(t => !/[{}"]/.test(t)), "kein Fehlertext enthält JSON");

  console.log("\n══ Echter Schreibweg (gestellter db) ══");
  const aufrufe = await seite.evaluate(async () => {
    const log = [];
    const rpc = (name, args) => {
      log.push(["rpc", name, JSON.parse(JSON.stringify(args || {}))]);
      if(name === "gutschein_recht") return Promise.resolve({ data: { ok:true, inhaber:true, pin:true }, error: null });
      if(name === "gutschein_ausstellen") return Promise.resolve({ data: { ok:true, code:"KUCHEN-ABCDEFGHJK", id:"x" }, error: null });
      if(name === "gutschein_beenden") return Promise.resolve({ data: { ok:true }, error: null });
      return Promise.resolve({ data: null, error: null });
    };
    const kette = (tabelle) => {
      const k = {
        select: () => k, eq: (a, b) => (log.push(["eq", tabelle, a, b]), k),
        is: () => k, or: (x) => (log.push(["or", tabelle, x]), k),
        order: () => k,
        then: (ok) => ok({ data: [], error: null }),
        insert: (zeile) => { log.push(["insert", tabelle, zeile]); return Promise.resolve({ error: null }); },
        update: (w) => { log.push(["update", tabelle, w]); return { eq: (a, b) => (log.push(["eq", tabelle, a, b]), Promise.resolve({ error: null })) }; }
      };
      return k;
    };
    demo = false;
    db = { from: kette, rpc };
    betriebId = "af095b14-d9ef-41f4-9b97-c4422b0de63f";
    grRecht = null; grFuer = null;
    document.getElementById("gsTitel").value = "Kuchen aufs Haus";
    document.getElementById("gsText").value = "";
    document.getElementById("gsPraefix").value = "KUCHEN";
    document.getElementById("gsBis").value = "2030-01-15";
    document.getElementById("gsForm").requestSubmit();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById("apPin").value = "40918273";
    document.getElementById("apOk").click();
    await new Promise(r => setTimeout(r, 400));
    return log;
  });
  pruef(!aufrufe.some(a => a[0] === "insert" || (a[0] === "update" && a[1] === "gutscheine")),
    "kein direktes Schreiben in gutscheine mehr");
  const ruf = aufrufe.find(a => a[0] === "rpc" && a[1] === "gutschein_ausstellen");
  pruef(!!ruf, "Ausstellen geht über gutschein_ausstellen");
  if (ruf) {
    const args = ruf[2];
    const fremd = Object.keys(args).filter(k => !a.params.includes(k));
    pruef(!fremd.length, "jeder gesendete Parameter steht in der Funktion", fremd.join(",") || Object.keys(args).join(","));
    pruef(args.p_betrieb === "af095b14-d9ef-41f4-9b97-c4422b0de63f", "p_betrieb ist das eigene Haus");
    pruef(args.p_pin === "40918273" && args.p_praefix === "KUCHEN" && args.p_titel === "Kuchen aufs Haus",
      "PIN, Vorsilbe und Titel in der Nutzlast", JSON.stringify(args));
    pruef(!("p_code" in args) && !("p_gast_id" in args), "kein selbst gewählter Code, kein Gast");
    /* Die Naht läuft jetzt über die Spalten, in die die FUNKTION schreibt. */
    const zeile = {};
    for (const sp of a.spalten) zeile[sp] = true;
    const fremdSp = a.spalten.filter(k => !SPALTEN.includes(k) && !["angelegt_von", "angelegt_name"].includes(k));
    pruef(!fremdSp.length, "jede Spalte, die die Funktion schreibt, gibt es", fremdSp.join(",") || a.spalten.join(","));
    const bis = new Date(args.p_gueltig_bis);
    pruef(bis.getFullYear() === 2030 && bis.getMonth() === 0 && bis.getDate() === 15 && bis.getHours() === 23,
      "gültig bis = Ende des gewählten Tages (Ortszeit)", zeile.gueltig_bis);

    console.log("\n══ Naht Board → gast_melden → Hub (§8.1i) ══");
    const naht = nahtLesen();
    pruef(!!naht, "gast_melden-Zuordnung aus stand-gast-melden.sql gelesen", JSON.stringify(naht));
    if (naht) {
      const hub = fs.readFileSync(HUBQ, "utf8");
      for (const [schluessel, spalte] of Object.entries(naht)) {
        pruef(spalte in zeile,
          "Board schreibt „" + spalte + "“, das gast_melden als „" + schluessel + "“ ausgibt");
        pruef(new RegExp("\\bg\\." + schluessel + "\\b").test(hub),
          "Hub liest g." + schluessel);
      }
    }
  }
  const ende = aufrufe.filter(a => a[0] === "or");
  pruef(ende.length && /gueltig_bis\.gt\."/.test(ende[0][2]), "Liste lädt nur nicht abgelaufene (Zeitstempel in Anführungszeichen)",
    ende.length ? ende[0][2] : "kein or()");

  await ctx.close();
  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
