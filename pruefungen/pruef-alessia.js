/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Alessias Webhook (neu 10.10.)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-alessia.js

   Geprüft wird der Quelltext, der WIRKLICH ausgerollt wird: index.ts
   wird mit typescript übersetzt und mit gestelltem Deno, gestelltem
   fetch und gestellter Vapi-Nachricht ausgeführt — keine Kopie hier.

   1 · Echtheit: ohne / mit falschem Geheimnis nichts gelesen, kein
       einziger Datenbankaufruf (gemessen am gestellten fetch).
   2 · Trennung der Betriebe: Die angerufene Nummer kommt NUR aus der
       Anrufinfo. Ein Argument „gerufene_nummer“ oder „betrieb“ vom
       Sprachmodell ändert NICHTS am Ziel (Gegenfall gemessen).
   3 · karte_lesen → alessia_wissen, bestellen → bestellung_telefon,
       mehrere Werkzeugaufrufe in einer Nachricht → je eine Antwort mit
       der richtigen toolCallId.
   4 · Die Naht (§8.1i): jedes Feld, das die Funktion schickt, ist ein
       Parameter von bestellung_telefon / alessia_wissen in
       datenbank/migration-telefonbestellung.sql — und umgekehrt.
   5 · Alessia liest nur Sätze vor: Datenbank-Absage → ihr „sagen“,
       Datenbank weg → ein Satz, nie ein Fehlercode oder Stack.
   6 · Was die Karte an Alessia gibt, sind nur öffentliche Felder (aus
       der Migration gelesen): kein Umsatz, keine Gäste, kein Team.
   7 · Der erzeugte Assistent je Betrieb: alle Schutzregeln, nur der
       eigene Name, Werkzeuge/Argumente = was die Server-Funktion liest
       (zweite Quelle: index.ts), kein Geheimnis in der Datei.
   Was hier NICHT geprüft werden kann: ein echter Vapi-Anruf.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

const QUELLE = path.join(__dirname, "..", "supabase", "functions", "alessia-bestellung", "index.ts");
const MIG = fs.readFileSync(path.join(__dirname, "..", "datenbank", "migration-telefonbestellung.sql"), "utf8");

let fehler = 0, n = 0;
const ok = (g, t, z) => { n++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); if (!g) fehler++; };

/* Die Funktion laden: übersetzen, Deno stellen, Handler abgreifen. */
function laden(env, antworten) {
  const js = ts.transpileModule(fs.readFileSync(QUELLE, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const rufe = [];
  let handler = null;
  const raum = {
    Deno: { env: { get: k => env[k] }, serve: h => { handler = h; } },
    fetch: async (url, opt) => {
      const fn = String(url).split("/rpc/")[1];
      const koerper = JSON.parse(opt.body);
      rufe.push({ fn, koerper, kopf: opt.headers });
      const a = antworten(fn, koerper);
      if (a === "kaputt") return new Response("boom", { status: 500 });
      return new Response(JSON.stringify(a), { status: 200 });
    },
    Response, Request, JSON, console: { error: () => {}, log: () => {} }, Math, Number, Array, String, Date, isNaN,
  };
  vm.createContext(raum);
  vm.runInContext(js, raum);
  return { handler, rufe };
}
const ENV = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "dienst", VAPI_SECRET: "geheim-123" };
const anfrage = (koerper, geheim = "geheim-123") => new Request("https://f/alessia", {
  method: "POST", headers: geheim === null ? {} : { "x-vapi-secret": geheim }, body: JSON.stringify(koerper) });

const VAPI = (aufrufe, extra = {}) => ({ message: Object.assign({
  type: "tool-calls",
  toolCallList: aufrufe,
  phoneNumber: { id: "pn_choco", number: "+4964229990001" },
  call: { id: "call_42", phoneNumberId: "pn_choco", customer: { number: "+491701234567" } },
  artifact: { transcript: "AI: Hallo … User: Zwei Dubai Crêpe" },
}, extra) });
const werkzeug = (id, name, arg) => ({ id, type: "function", function: { name, arguments: JSON.stringify(arg) } });

(async () => {
  console.log("── Echtheit ──");
  for (const [g, soll] of [[null, 401], ["falsch-123", 401], ["geheim-12", 401]]) {
    const { handler, rufe } = laden(ENV, () => ({ ok: true }));
    const r = await handler(anfrage(VAPI([werkzeug("t1", "bestellen", { positionen: [{ name: "X" }] })]), g));
    ok(r.status === soll && rufe.length === 0, "Geheimnis " + JSON.stringify(g) + " → " + soll + ", kein Datenbankaufruf", r.status + " / " + rufe.length);
  }
  {
    const { handler, rufe } = laden(Object.assign({}, ENV, { VAPI_SECRET: "" }), () => ({ ok: true }));
    const r = await handler(anfrage(VAPI([]), ""));
    ok(r.status === 503 && rufe.length === 0, "ohne gesetztes VAPI_SECRET wird nichts angenommen", r.status);
  }

  console.log("\n── Werkzeuge, Antworten, Trennung ──");
  {
    const { handler, rufe } = laden(ENV, fn => fn === "alessia_wissen"
      ? { ok: true, betrieb: "Choco L'AMouR", nimmt_an: true, abholung: true, lieferung_im_hub: false, karte: [{ name: "Dubai Crêpe", preis: 15.9 }] }
      : { ok: true, nummer: 101, summe: 31.8, sagen: "Notiert — Ihre Abholnummer ist 101. Das macht 31,80 Euro." });
    const r = await handler(anfrage(VAPI([
      werkzeug("t_karte", "karte_lesen", {}),
      /* Das Sprachmodell versucht, das Ziel zu setzen — muss wirkungslos sein. */
      werkzeug("t_best", "bestellen", { name: "Anna", positionen: [{ name: "Dubai Crêpe", menge: 2 }], notiz: "ohne Nuss",
        wunschzeit: "2026-10-10T18:30:00+02:00", gerufene_nummer: "+4964229990002", betrieb: "blend", p_gerufene_nummer: "+4964229990002" }),
    ])));
    const k = await r.json();
    ok(r.status === 200 && Array.isArray(k.results) && k.results.length === 2, "zwei Werkzeugaufrufe → zwei Antworten", JSON.stringify(k).slice(0, 80));
    ok(k.results[0].toolCallId === "t_karte" && k.results[1].toolCallId === "t_best", "jede Antwort trägt ihre toolCallId");
    ok(rufe[0].fn === "alessia_wissen" && rufe[1].fn === "bestellung_telefon", "karte_lesen → alessia_wissen, bestellen → bestellung_telefon",
      rufe.map(x => x.fn).join(", "));
    const b = rufe[1].koerper;
    ok(b.p_gerufene_nummer === "+4964229990001" && b.p_nummer_id === "pn_choco",
      "das Ziel kommt aus der Anrufinfo — „gerufene_nummer/betrieb“ vom Sprachmodell wirkungslos", b.p_gerufene_nummer + " / " + b.p_nummer_id);
    ok(b.p_anrufer === "+491701234567" && b.p_ruf_id === "call_42" && b.p_name === "Anna" && b.p_notiz === "ohne Nuss"
      && b.p_positionen.length === 1 && b.p_positionen[0].menge === 2 && /Zwei Dubai/.test(b.p_transkript) && b.p_wunschzeit,
      "Anrufer, Anruf-ID, Name, Notiz, Positionen, Transkript, Wunschzeit übergeben", JSON.stringify(b).slice(0, 160));
    ok(!("preis" in b.p_positionen[0]) && !Object.keys(b).some(x => /summe|preis/.test(x)), "kein Preis vom Telefon geht an die Datenbank (sie rechnet selbst)");
    ok(/Abholnummer ist 101/.test(k.results[1].result), "Alessia bekommt den Satz der Datenbank zum Vorlesen", k.results[1].result);
    const wissen = JSON.parse(k.results[0].result);
    ok(wissen.betrieb === "Choco L'AMouR" && wissen.karte.length === 1, "karte_lesen gibt die Karte als Daten", k.results[0].result.slice(0, 80));
    ok(rufe.every(x => x.kopf.Authorization === "Bearer dienst"), "Datenbankaufrufe mit dem Dienstschlüssel (nicht dem öffentlichen)");
  }
  {
    /* Gegenfall: Steht keine Nummer in der Anrufinfo, darf ein Argument sie NICHT ersetzen. */
    const { handler, rufe } = laden(ENV, () => ({ ok: true, sagen: "x" }));
    const ohne = VAPI([werkzeug("t1", "bestellen", { positionen: [{ name: "A" }], gerufene_nummer: "+4964229990002" })],
      { phoneNumber: undefined, call: { id: "c", customer: { number: "+49170" } } });
    const r = await (await handler(anfrage(ohne))).json();
    ok(rufe.length === 0 && /nicht zuordnen/.test(r.results[0].result), "ohne Nummer in der Anrufinfo: keine Bestellung, ein Satz — das Argument zählt nicht",
      rufe.length + " Aufrufe · " + r.results[0].result);
  }
  {
    const { handler, rufe } = laden(ENV, fn => fn === "bestellung_telefon" ? "kaputt" : { ok: false });
    const r = await (await handler(anfrage(VAPI([werkzeug("a", "bestellen", { positionen: [{ name: "A" }] }), werkzeug("b", "karte_lesen", {}), werkzeug("c", "rm_rf", {})])))).json();
    ok(/nicht geklappt/.test(r.results[0].result) && !/500|boom|error/i.test(r.results[0].result), "Datenbank weg → ein Satz, kein Fehlercode", r.results[0].result);
    ok(/Karte gerade nicht/.test(r.results[1].result), "Karte nicht abrufbar → ein Satz", r.results[1].result);
    ok(r.results[2].result === "Das kann ich hier nicht." && rufe.length === 2, "unbekanntes Werkzeug ruft nichts auf", rufe.length);
  }
  {
    const { handler, rufe } = laden(ENV, () => ({ ok: true }));
    const r = await handler(anfrage({ message: { type: "status-update", status: "ended" } }));
    ok(r.status === 200 && rufe.length === 0, "andere Vapi-Nachrichten (Status) werden still quittiert");
    const kaputt = await handler(new Request("https://f", { method: "POST", headers: { "x-vapi-secret": "geheim-123" }, body: "{kein json" }));
    ok(kaputt.status === 400, "kein JSON → 400, nichts gelesen");
  }

  console.log("\n── Die Naht: Edge Function ↔ Migration (zweite Quelle) ──");
  const params = name => {
    const m = MIG.match(new RegExp("function public\\." + name + "\\(([\\s\\S]*?)\\)\\s*\\n?\\s*returns", "i"));
    return m ? [...m[1].matchAll(/(p_[a-z_]+)/g)].map(x => x[1]) : [];
  };
  {
    const { handler, rufe } = laden(ENV, () => ({ ok: true, sagen: "x", karte: [] }));
    await handler(anfrage(VAPI([werkzeug("a", "bestellen", { positionen: [] }), werkzeug("b", "karte_lesen", {})])));
    for (const r of rufe) {
      const soll = params(r.fn), ist = Object.keys(r.koerper);
      ok(soll.length > 0 && ist.every(k => soll.includes(k)) && soll.every(k => ist.includes(k)),
        r.fn + ": gesendete Felder = Parameter der Funktion in der Migration", "gesendet " + ist.join(",") + " | Migration " + soll.join(","));
    }
  }
  {
    const m = MIG.match(/create or replace function public\.alessia_wissen[\s\S]*?\nend \$\$;/);
    const felder = m ? [...m[0].matchAll(/'([a-z_]+)',\s*(?:g\.|b\.|\(|not |true|case|coalesce|left|nullif)/g)].map(x => x[1]) : [];
    const verboten = felder.filter(f => /umsatz|summe|gast|telefon|mail|code|rabatt|mitglied|vertrag|preis_monat|kennung|bestellung/.test(f));
    ok(felder.length >= 8 && verboten.length === 0, "alessia_wissen gibt nur öffentliche Felder heraus", felder.join(", ") + (verboten.length ? " — VERBOTEN: " + verboten.join(",") : ""));
    ok(/revoke all on function public\.bestellung_telefon[\s\S]*?from public, anon, authenticated/.test(MIG)
      && /revoke all on function public\.alessia_wissen[\s\S]*?from public, anon, authenticated/.test(MIG),
      "bestellung_telefon / alessia_wissen: kein anon, kein authenticated (nur über diese Funktion)");
  }

  console.log("\n── Der erzeugte Vapi-Assistent je Betrieb (erzeuger/erzeuge-alessia.js) ──");
  {
    const { execFileSync } = require("child_process");
    const WURZEL = path.join(__dirname, "..");
    execFileSync("node", [path.join(WURZEL, "erzeuger", "erzeuge-alessia.js"), "--alle"], { stdio: "pipe" });
    const slugs = fs.readdirSync(path.join(WURZEL, "markenblaetter")).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5));
    const namen = Object.fromEntries(slugs.map(sl => [sl, (JSON.parse(fs.readFileSync(path.join(WURZEL, "markenblaetter", sl + ".json"), "utf8")).betrieb || {}).name || sl]));
    const erz = fs.readFileSync(path.join(WURZEL, "erzeuger", "erzeuge-alessia.js"), "utf8");
    const regelZahl = (erz.match(/const REGELN = \[([\s\S]*?)\n\];/) || ["", ""])[1].split("\n").filter(z => /^\s*"/.test(z)).length;
    /* Zweite Quelle: welche Werkzeuge und Argumente die Server-Funktion WIRKLICH liest. */
    const index = fs.readFileSync(QUELLE, "utf8");
    const werkzeugeServer = [...index.matchAll(/a\.name === "([a-z_]+)"/g)].map(x => x[1]).sort();
    const argServer = [...index.matchAll(/arg\.([a-z_]+)/g)].map(x => x[1]);
    for (const sl of slugs) {
      const a = JSON.parse(fs.readFileSync(path.join(WURZEL, "dist-alessia", sl + ".json"), "utf8"));
      const regeln = (a.systemprompt.match(/^\d+\. /gm) || []).length;
      const fremde = slugs.filter(x => x !== sl).map(x => namen[x]).filter(nm => nm && a.systemprompt.includes(nm) || a.firstMessage.includes(nm));
      ok(regeln === regelZahl && regelZahl >= 10, sl + ": alle " + regelZahl + " Schutzregeln im Systemprompt", regeln);
      ok(a.systemprompt.includes(namen[sl]) && a.firstMessage.includes(namen[sl]) && fremde.length === 0,
        sl + ": nennt nur sich selbst, keinen anderen Betrieb", fremde.join(",") || namen[sl]);
      const w = a.tools.map(t => t.function.name).sort();
      ok(JSON.stringify(w) === JSON.stringify(werkzeugeServer), sl + ": Werkzeuge = die, die die Server-Funktion kennt", w.join(",") + " | " + werkzeugeServer.join(","));
      const best = a.tools.find(t => t.function.name === "bestellen");
      const props = Object.keys(best.function.parameters.properties);
      ok(props.every(p => argServer.includes(p)) && argServer.every(p => props.includes(p)),
        sl + ": Argumente von „bestellen“ = die, die die Server-Funktion liest", props.join(",") + " | " + [...new Set(argServer)].join(","));
      ok(!props.some(p => /nummer|betrieb|preis|summe/.test(p)), sl + ": kein Argument für Ziel oder Preis (beides entscheidet der Server)", props.join(","));
      /* KI-VO Art. 50, § 201 StGB (18.10.) */
      ok(a.firstMessage.startsWith("Hallo, hier ist Alessia, die KI-Assistentin von " + namen[sl] + ".")
        && /als Text mitgeschrieben/.test(a.firstMessage),
        sl + ": Begrüßung beginnt mit dem KI-Hinweis und sagt, dass mitgeschrieben wird", a.firstMessage.slice(0, 70));
      ok(!!a.artifactPlan && a.artifactPlan.recordingEnabled === false, sl + ": Tonaufnahme ausdrücklich aus");
      ok(/dass du eine KI bist/.test(a.systemprompt) && /nie als Mensch/.test(a.systemprompt),
        sl + ": auf Nachfrage immer „ich bin eine KI“");
      const roh = JSON.stringify(a);
      ok(a.tools.every(t => /\/functions\/v1\/alessia-bestellung$/.test(t.server.url)) && !/geheim|sk_|eyJ/.test(roh) && /<VAPI_SECRET>/.test(roh),
        sl + ": beide Werkzeuge auf die eine Server-Adresse, nur ein Platzhalter für das Geheimnis");
    }
    /* Ein eigener Gruß ersetzt nur den freien Teil, nie den Hinweis. */
    {
      const sl = slugs[0];
      execFileSync("node", [path.join(WURZEL, "erzeuger", "erzeuge-alessia.js"), sl, "--gruss", "Ciao! Was darf es sein?"], { stdio: "pipe" });
      const a = JSON.parse(fs.readFileSync(path.join(WURZEL, "dist-alessia", sl + ".json"), "utf8"));
      ok(/KI-Assistentin/.test(a.firstMessage) && /Ciao! Was darf es sein\?$/.test(a.firstMessage),
        sl + " mit --gruss: eigener Gruß hinter dem Pflichtsatz, nicht statt seiner", a.firstMessage);
      execFileSync("node", [path.join(WURZEL, "erzeuger", "erzeuge-alessia.js"), sl], { stdio: "pipe" });
    }
    ok(!fs.readFileSync(path.join(WURZEL, "erzeuger", "bauen.js"), "utf8").includes("dist-alessia")
      && /dist-alessia\//.test(fs.readFileSync(path.join(WURZEL, ".gitignore"), "utf8")),
      "dist-alessia/ wird weder ausgeliefert noch eingecheckt");
  }

  console.log("\n" + (n - fehler) + " von " + n + " ok");
  console.log(fehler ? fehler + " FEHLER" : "Alles sauber.");
  process.exit(fehler ? 1 : 0);
})();
