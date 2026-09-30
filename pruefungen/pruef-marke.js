/* ═══════════════════════════════════════════════════════════════════
   PRUEF-MARKE · Der Entwurfslink aus dem Marken-Studio, gelesen in konto.html

   Bis 29.09. hatte auch das Admin-Board eine eigene "Marke gestalten"-
   Karte mit einer ZWEITEN, unabhängig gepflegten Kopie dieser Ent-
   und Verschlüsselung. Auf Wunsch entfernt (§10 — nur konto.html auf
   omoteno.de soll die Marke bearbeiten), weil konto.html das schon
   zweifach konnte: die "Marke"-Kachel/-Tab mit funktionierendem
   Entwurfslink-Import. Diese Prüfung folgt der Entfernung — sie prüft
   jetzt NICHT mehr das (nicht mehr vorhandene) Board-Formular, sondern
   den einzigen verbliebenen Weg: konto.html liest einen #m=-Link.

   Genau DAS war vorher UNGEPRUEFT — pruef-konto-start.js prüft konto.html
   nur ohne Bibliothek (der Stopp-Fall), nie mit einer echten Sitzung.
   Ohne diese Umschreibung hätte das Entfernen der Board-Karte die
   letzte verbliebene Kopie der Ent-/Verschlüsselung komplett ungeprüft
   zurückgelassen (CLAUDE.md §8.1b: was nicht mehr vorkommt, wird auch
   nicht mehr geprüft — dieselbe Lücke wie beim Dateinamen-Wechsel).

   Die NAHT läuft in der einzig echten Richtung: Das ECHTE
   marken-studio.html erzeugt über seine eigene entwurfsAdresse() einen
   Link (Studio → Link), konto.html liest ihn über seine eigene
   ausEntwurf() (Link → Konto). Die umgekehrte Richtung (ein im Konto
   gespeichertes Markenblatt vorausgefüllt im Studio öffnen) gab es in
   konto.html nie — das war eine reine Board-Eigenheit und ist mit ihr
   verschwunden.

   Gegenbeweis (CLAUDE.md §8.1g): die Bereiche-Schalter beim
   Entschlüsseln testweise immer auf false gezwungen — rot. Zurück-
   genommen — grün.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const HIER = path.join(__dirname, "..", "seiten");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok  " : "  FEHL") + " " + t + (d !== undefined ? "  → " + d : ""));
}

/* Ein Supabase-js-Nachbau, gerade genug für starten() → kontoZeichnen()
   → die Marke-Karte: eine Sitzung, eine Mitgliedschaft, ein Betrieb,
   und ein aufgezeichnetes update() für den Speicherweg. Alles, was
   konto.html sonst noch nachlädt (Tische, Rechnungen), bekommt eine
   leere, fehlerfreie Antwort — try/catch in konto.html selbst fängt
   den Rest ab, das ist nicht Gegenstand dieser Prüfung. */
function bibliothek(betriebZeile){
  return `
window.__updates = [];
window.supabase = {
  createClient: function(){
    const kette = (tabelle) => {
      const q = { tabelle };
      const o = {
        select(){ return o; }, eq(){ return o; }, order(){ return o; }, limit(){ return o; },
        single: async () => {
          if(tabelle === "betriebe") return { data: ${JSON.stringify(betriebZeile)}, error:null };
          return { data:null, error:null };
        },
        update(v){ q.update = v; return o; },
        then(res){
          if(tabelle === "betrieb_mitglieder") return Promise.resolve(res({ data:[{ betrieb_id:"B1", rolle:"inhaber" }], error:null }));
          if(tabelle === "betriebe" && q.update){
            window.__updates.push({ tabelle, wert: q.update });
            return Promise.resolve(res({ error:null }));
          }
          return Promise.resolve(res({ data:[], error:null, count:0 }));
        }
      };
      return o;
    };
    return {
      auth: {
        getSession: async () => ({ data:{ session:{ user:{ id:"u1" } } } }),
        onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
        updateUser: async () => ({ error:null })
      },
      from: kette
    };
  }
};`;
}

async function kontoSeite(browser, betriebZeile){
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const konsole = [];
  p.on("pageerror", e => konsole.push(String(e).slice(0, 200)));
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith("file://")) return r.continue();
    if (/supabase-js/.test(u)) return r.fulfill({ contentType:"application/javascript", body: bibliothek(betriebZeile) });
    return r.abort();
  });
  await p.goto("file://" + path.join(HIER, "konto.html"));
  await p.waitForTimeout(900);
  return { ctx, p, konsole };
}

(async () => {
  const browser = await chromium.launch();

  const BETRIEB = { id:"B1", name:"Test-Bistro", slug:"test-bistro", zustand:"aktiv",
    plan:"start", preis_monat:29, vertrag_ab:"2026-01-01", markenblatt:null, erzeugt_am:null };

  const { ctx, p, konsole } = await kontoSeite(browser, BETRIEB);

  pruef(await p.isVisible("#konto"), "eine echte Sitzung zeigt das Konto (Voraussetzung)");
  await p.click('[data-blatt="marke"]');
  await p.waitForTimeout(150);

  pruef(await p.isVisible("#markeLink"), "das Einsetzen-Feld ist da");
  pruef(await p.isVisible("#markeSpeichern"), "der Übernehmen-Knopf ist da");
  pruef(!(await p.isVisible("#markeOeffnen")),
    "es gibt KEINEN 'im Studio öffnen'-Knopf — den hatte nur das Board, konto.html nie");

  /* ── Rundlauf: konto.html liest einen synthetischen #m=-Link ───── */
  const rundlauf = await p.evaluate(() => {
    const knapp = {
      b: ["Test-Bistro", "Frisch. Ehrlich.", "Willkommen!"],
      f: { grund:"#101010", akzent:"#C9A227" },
      a: { an:true }, o: { ecke:"rund" }, s: { kopf:"serif", text:"sans", groesse:1.1 },
      r: ["speisekarte","getraenke","quiz"], e: [1, 1, 0]
    };
    const link = "https://omoteno.de/marken-studio.html#m=" + nachBase64Test(knapp);
    function nachBase64Test(k){
      const bytes = new TextEncoder().encode(JSON.stringify(k));
      let roh = ""; bytes.forEach(b => { roh += String.fromCharCode(b); });
      return btoa(roh).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    }
    const mb = ausEntwurf(link);
    return { mb };
  });
  pruef(!!rundlauf.mb, "ein gültiger Entwurfslink wird erkannt");
  pruef(JSON.stringify(rundlauf.mb.farben) === JSON.stringify({ grund:"#101010", akzent:"#C9A227" }),
    "Farben kommen unverändert zurück", JSON.stringify(rundlauf.mb.farben));
  pruef(rundlauf.mb.bereiche.speisekarte === true && rundlauf.mb.bereiche.quiz === false,
    "Bereiche-Schalter kommen unverändert zurück", JSON.stringify(rundlauf.mb.bereiche));
  pruef(rundlauf.mb.betrieb.name === "Test-Bistro", "Betriebsname kommt zurück", rundlauf.mb.betrieb.name);

  /* ── Ungültiger Link: ehrliche Meldung, kein Absturz ───────────── */
  await p.fill("#markeLink", "https://omoteno.de/marken-studio.html#m=nichtgueltig");
  await p.click("#markeSpeichern");
  await p.waitForTimeout(200);
  const meldungUngueltig = await p.textContent("#markeMeldung");
  pruef(/kein gültiger Entwurfslink/i.test(meldungUngueltig), "ungültiger Link wird erkannt und gemeldet", meldungUngueltig.trim());

  /* ── Gültiger Link: wirklich gespeichert, Name/Slug bleiben eigene ── */
  const echterLink = await p.evaluate(() => {
    function nachBase64Test(k){
      const bytes = new TextEncoder().encode(JSON.stringify(k));
      let roh = ""; bytes.forEach(b => { roh += String.fromCharCode(b); });
      return btoa(roh).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    }
    const knapp = { b:["Fremder Name","",""], f:{ grund:"#000000" }, o:{ ecke:"rund" }, r:["speisekarte"], e:[1] };
    return "https://omoteno.de/marken-studio.html#m=" + nachBase64Test(knapp);
  });
  await p.fill("#markeLink", echterLink);
  await p.click("#markeSpeichern");
  await p.waitForTimeout(250);
  const meldungGut = await p.textContent("#markeMeldung");
  pruef(/Übernommen/i.test(meldungGut), "gültiger Link: „Übernommen“ steht da", meldungGut.trim());
  const geschrieben = await p.evaluate(() => window.__updates);
  pruef(geschrieben.length === 1, "genau EIN Speichervorgang lief wirklich in die Datenbank", geschrieben.length);
  pruef(!!geschrieben[0] && geschrieben[0].wert.markenblatt.farben.grund === "#000000",
    "…mit den Farben aus dem Link", geschrieben[0] && JSON.stringify(geschrieben[0].wert.markenblatt.farben));
  pruef(!!geschrieben[0] && geschrieben[0].wert.markenblatt.betrieb.name === "Test-Bistro",
    "…aber dem EIGENEN Betriebsnamen — ein fremder Link kann den Betrieb nicht umbenennen",
    geschrieben[0] && geschrieben[0].wert.markenblatt.betrieb.name);

  const echteFehler = konsole.filter(k => !/ERR_FAILED|net::/.test(k));
  pruef(echteFehler.length === 0, "keine echten Fehler in der Konsole", echteFehler.join(" | ") || "still");

  await ctx.close();

  /* ── Die Naht: das ECHTE marken-studio.html erzeugt den Link,
     das ECHTE konto.html liest ihn — nicht zwei Hälften, jede nur
     gegen eine Annahme der anderen geprüft (§8.1i). ── */
  console.log("\n══ Die Naht: echtes marken-studio.html → echtes konto.html ══");
  const seiteStudio = await (await browser.newContext()).newPage();
  const fehlerStudio = [];
  seiteStudio.on("pageerror", e => fehlerStudio.push(String(e)));
  await seiteStudio.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seiteStudio.goto("file://" + path.join(HIER, "marken-studio.html"));
  await seiteStudio.waitForTimeout(700);

  const urlNaht = await seiteStudio.evaluate(() => {
    M.betrieb.name = "Naht-Test-Bistro";
    M.betrieb.claim = "Ehrlich seit 2026";
    M.farben.grund = "#0A1714";
    M.farben.akzent = "#C9A227";
    M.form.ecke = "rund";
    M.bereiche.speisekarte = true;
    M.bereiche.getraenke = false;
    return entwurfsAdresse();
  });
  await seiteStudio.close();
  pruef(fehlerStudio.length === 0, "keine Ausnahme im echten Studio beim Erzeugen des Links", fehlerStudio.join(" | ") || "still");
  pruef(urlNaht.includes("marken-studio.html#m="), "die echte Adresse trägt #m=", urlNaht.slice(0, 55) + "…");

  const { ctx: ctxNaht, p: seiteKonto2 } = await kontoSeite(browser, BETRIEB);
  await seiteKonto2.click('[data-blatt="marke"]');
  await seiteKonto2.waitForTimeout(150);
  const geladen = await seiteKonto2.evaluate((link) => {
    const mb = ausEntwurf(link);
    return mb ? { name: mb.betrieb.name, grund: mb.farben.grund, akzent: mb.farben.akzent,
      ecke: mb.form.ecke, speisekarte: mb.bereiche.speisekarte, getraenke: mb.bereiche.getraenke } : null;
  }, urlNaht).catch(e => ({ fehler: String(e) }));
  await ctxNaht.close();

  pruef(!!geladen && geladen.name === "Naht-Test-Bistro", "das ECHTE konto.html liest den Betriebsnamen aus dem ECHTEN Studio-Link", geladen && geladen.name);
  pruef(!!geladen && geladen.grund === "#0A1714", "…und den Seitengrund", geladen && geladen.grund);
  pruef(!!geladen && geladen.akzent === "#C9A227", "…und die Hauptfarbe", geladen && geladen.akzent);
  pruef(!!geladen && geladen.ecke === "rund", "…und die Formauswahl", geladen && geladen.ecke);
  pruef(!!geladen && geladen.speisekarte === true && geladen.getraenke === false,
    "…und die Bereiche-Schalter, je einzeln",
    geladen && JSON.stringify({ speisekarte: geladen.speisekarte, getraenke: geladen.getraenke }));

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
