/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Härtungen aus dem Sicherheits-Sweep vom 19.10.

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=$(npm root -g) node pruefungen/pruef-haertung.js

   Je Eintrag: der Fall, der vorher durchging, und der Gegenfall, der
   weiter gehen muss (Voraussetzung, §8.1g).
     1 · melden: Push-Endpunkt nur https + Dienste der Browser-Hersteller
         (SSRF: das Team schreibt push_geraete.endpunkt selbst)
     2 · master: „mailto:“ nur mit schlichter Adresse (kein ?bcc=, &body=)
     3 · Erzeuger: ein Wert mit </script> im Markenblatt beendet den Block nicht
     4 · Küche: Gerichtname „constructor“ liefert keine Funktion als Alter
     5 · Board: Personenzahl einer Reservierung läuft nicht als HTML
     6 · Hub: Fotos von fremden Servern werden nicht geladen (IP der Gäste)
   Ehrliche Grenze: (1) prüft die Regel, nicht den echten Push-Dienst.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os");
const { spawnSync } = require("child_process");
const OBEN = path.resolve(__dirname, "..");
let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++; console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

(async () => {
  console.log("\n══ 1 · Push-Endpunkte (melden) ══");
  { const ts = require("typescript");
    const src = fs.readFileSync(path.join(OBEN, "supabase/functions/melden/index.ts"), "utf8");
    const a = src.indexOf("const PUSH_HOSTS"), b = src.indexOf("interface Posten");
    pruef(a > 0 && b > a, "Voraussetzung: Regel im Quelltext gefunden");
    if(a > 0 && b > a){
    const js = ts.transpileModule(src.slice(a, b).replace("export function", "function") + "\nmodule.exports = pushEndpunktOk;", { compilerOptions: { module: "commonjs", target: "es2020" } }).outputText;
    const m = { exports: {} }; new Function("module", js)(m);
    const ok = m.exports;
    const gut = ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/xyz",
      "https://web.push.apple.com/QAbc", "https://wns2-par02p.notify.windows.com/w/?token=1", "https://jp.push.apple.com/x"];
    const schlecht = ["http://fcm.googleapis.com/x", "https://169.254.169.254/latest/meta-data", "https://fcm.googleapis.com.evil.example/x",
      "https://evil.example/fcm.googleapis.com", "https://fcm.googleapis.com@evil.example/x", "https://fcm.googleapis.com:8443/x",
      "https://localhost/x", "https://[::1]/x", "ftp://web.push.apple.com/x", "javascript:alert(1)", "", "nichts"];
    pruef(gut.every(ok), "die echten Dienste (Chrome, Firefox, Safari, Edge) werden zugestellt", gut.filter(x => !ok(x)).join(" | ") || gut.length + " von " + gut.length);
    pruef(!schlecht.some(ok), "alles andere wird nicht angerufen", schlecht.filter(ok).join(" | ") || schlecht.length + " abgewiesen"); } }

  console.log("\n══ 2 · mailto im Master ══");
  { const t = fs.readFileSync(path.join(OBEN, "seiten/master.html"), "utf8");
    const m = /if\(m && (\/\^.*?\$\/)\.test\(m\.getAttribute\('data-mail'\)\)\)/.exec(t);
    pruef(!!m, "Voraussetzung: die Prüfung steht vor dem mailto");
    if(m){ const re = new Function("return " + m[1])();
      const gut = ["gast@restaurant.de", "a.b-c@sub.domain.example"], schlecht = ["x@y.de?bcc=boese@x.de", "x@y.de&body=hallo", "x@y.de,boese@x.de", "x y@z.de", "x@y.de%0ABcc:a@b.de", "<x>@y.de", "ohne-at"];
      pruef(gut.every(x => re.test(x)), "gewöhnliche Adressen gehen durch", gut.join(" | "));
      pruef(!schlecht.some(x => re.test(x)), "Parameter-Einschleusung wird nicht zum Link", schlecht.filter(x => re.test(x)).join(" | ") || schlecht.length + " abgewiesen"); } }

  console.log("\n══ 3 · Erzeuger: </script> im Markenblatt ══");
  { const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "erz-"));
    for(const d of ["erzeuger", "vorlagen", "markenblaetter"]) fs.cpSync(path.join(OBEN, d), path.join(tmp, d), { recursive: true });
    fs.mkdirSync(path.join(tmp, "auslieferung")); 
    const bl = path.join(tmp, "markenblaetter", "chocolamour.json"), j = JSON.parse(fs.readFileSync(bl, "utf8"));
    j.betrieb.claim = 'Hallo</script><img src=x onerror=window.__x=1>\\ und "Anführung"';
    fs.writeFileSync(bl, JSON.stringify(j));
    const r = spawnSync("node", ["erzeuger/erzeuge-hub.js", "chocolamour"], { cwd: tmp, encoding: "utf8" });
    const ziel = path.join(tmp, "dist", "chocolamour", "index.html");
    pruef(fs.existsSync(ziel), "Voraussetzung: der Erzeuger hat den Hub gebaut", r.status === 0 ? "ja" : (r.stdout + r.stderr).slice(-160));
    if(fs.existsSync(ziel)){
      const h = fs.readFileSync(ziel, "utf8");
      pruef(!/<\/script><img src=x onerror/.test(h), "kein rohes </script><img …> im Hub");
      pruef(/Hallo<\\\/script>/.test(h), "der Wert steht trotzdem da, mit entschärftem </script>");
      const br = await chromium.launch(); const p = await br.newPage(); const fehler = [];
      p.on("pageerror", e => fehler.push(String(e).slice(0, 100)));
      await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
      await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
      await p.goto("file://" + ziel); await p.waitForTimeout(1500);
      const x = await p.evaluate(() => ({ x: window.__x || null, claim: (document.getElementById("claim") || {}).textContent, bild: !!document.querySelector("img[src=x]") }));
      pruef(x.x === null && !x.bild && !fehler.length, "im Browser läuft nichts und es gibt keinen Skriptfehler", JSON.stringify(x).slice(0, 120) + (fehler[0] || ""));
      await br.close(); }
    fs.rmSync(tmp, { recursive: true, force: true }); }

  const br = await chromium.launch();

  console.log("\n══ 4 · Küche: „constructor“ als Gerichtname ══");
  { /* alterVon liegt im Küchenskript nicht global — die ECHTE Funktion wird aus der Datei geschnitten und gerufen. */
    const t = fs.readFileSync(path.join(OBEN, "seiten/kueche.html"), "utf8");
    const a = t.indexOf("function alterVon(posten){"), e = t.indexOf("\n}", a) + 2;
    pruef(a > 0 && e > a, "Voraussetzung: die Funktion steht im Quelltext");
    const alterVon = new Function("alterNachName", t.slice(a, e) + "\nreturn alterVon;")({ bier: 16 });
    const r = { bier: alterVon({ name: "Bier" }), bier2: alterVon({ name: "Bier (0,5 l)" }), c: alterVon({ name: "constructor" }),
                t: alterVon({ name: "toString" }), p: alterVon({ name: "__proto__" }), h: alterVon({ name: "hasOwnProperty" }) };
    pruef(r.bier === 16 && r.bier2 === 16, "Voraussetzung: ein echtes Gericht findet sein Alter (auch mit Größe)", JSON.stringify(r));
    pruef(r.c === 0 && r.t === 0 && r.p === 0 && r.h === 0, "„constructor“, „toString“, „__proto__“, „hasOwnProperty“ liefern 0 statt einer Funktion", JSON.stringify(r)); }

  console.log("\n══ 5 · Board: Personenzahl als Text ══");
  { const p = await br.newPage({ viewport: { width: 1280, height: 900 } }); const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 100))); p.on("dialog", d => d.dismiss());
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto("file://" + path.join(OBEN, "seiten/admin.html")); await p.waitForTimeout(700);
    await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const s = document.getElementById("scharf"); if(s) s.hidden = true; });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => { window.__x = [];
      reservierungen.length = 0;
      reservierungen.push({ id: "r1", betrieb_id: "B", name: "Anna", status: "offen", quelle: "tisch", wunsch: new Date(Date.now() + 36e5).toISOString(),
        personen: '4<img src=x onerror=__x.push("P")>', telefon: "", notiz: "" });
      Object.keys(zeigeRes).forEach(k => zeigeRes[k] = true);
      zeichneReservierungen();
      const z = document.getElementById("resListe");
      return { karten: z.querySelectorAll("article.res").length, img: z.querySelectorAll("img").length, text: z.textContent.includes("<img") };
    });
    await p.waitForTimeout(200);
    const gef = await p.evaluate(() => window.__x);
    pruef(r.karten === 1, "Voraussetzung: die Reservierung wurde gezeichnet", r.karten);
    pruef(r.img === 0 && !gef.length && r.text, "die Nutzlast steht als Text da und läuft nicht", JSON.stringify({ img: r.img, gefeuert: gef, alsText: r.text }));
    await p.close(); }

  console.log("\n══ 6 · Hub: Fotos nur aus dem eigenen Speicher ══");
  { const slug = "chocolamour", ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage(); const fremd = [], eigen = [], fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 100)));
    await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} });
    const html = fs.readFileSync(path.join(OBEN, "dist", slug, "index.html"), "utf8");
    const basis = (/url:\s*"(https:\/\/[a-z0-9]+\.supabase\.co)"/.exec(html) || [])[1];
    pruef(!!basis, "Voraussetzung: Adresse des eigenen Speichers im Hub gefunden", basis);
    const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const eigenesFoto = basis + "/storage/v1/object/public/gerichte/00000000-0000-4000-8000-000000000001/a.png";
    await p.route("**/*", r => {
      const u = r.request().url();
      if(u.startsWith("file://")) return r.continue();
      if(/fremd\.example|bilder\.example/.test(u)){ fremd.push(u); return r.fulfill({ status: 200, contentType: "image/png", body: PNG }); }
      if(u.startsWith(basis + "/storage/")){ eigen.push(u); return r.fulfill({ status: 200, contentType: "image/png", body: PNG }); }
      const j = b => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
      if(/\/rest\/v1\/betriebe\?/.test(u)) return j([{ id: "b1" }]);
      if(/\/rest\/v1\/gerichte\?/.test(u)) return j([
        { id: "g1", betrieb_id: "b1", karte: "speisekarte", verfuegbar: true, name: "Fremdfoto-Crêpe", beschreibung: "x", kategorie: "Crêpe", kat_sort: 1, reihenfolge: 1, preis: 5, bild: "https://fremd.example/foto.jpg", bild_frei: "https://bilder.example/frei.png", frei: true },
        { id: "g2", betrieb_id: "b1", karte: "speisekarte", verfuegbar: true, name: "Eigenfoto-Crêpe", beschreibung: "y", kategorie: "Crêpe", kat_sort: 1, reihenfolge: 2, preis: 6, bild: eigenesFoto }]);
      return j([]);
    });
    await p.goto("file://" + path.join(OBEN, "dist", slug, "index.html") + "#/speisekarte"); await p.waitForTimeout(2500);
    const zeigt = await p.evaluate(() => [...document.querySelectorAll(".gericht")].map(g => g.textContent.trim().slice(0, 30)));
    pruef(zeigt.some(t => /Fremdfoto/.test(t)) && zeigt.some(t => /Eigenfoto/.test(t)), "Voraussetzung: beide Gerichte stehen in der Karte", zeigt.join(" | "));
    await p.evaluate(() => { const b = [...document.querySelectorAll(".ginfo")].find(x => /Fremdfoto/.test(x.textContent)); if(b) b.click(); });
    await p.waitForTimeout(800);
    await p.keyboard.press("Escape");
    await p.evaluate(() => { const b = [...document.querySelectorAll(".ginfo")].find(x => /Eigenfoto/.test(x.textContent)); if(b) b.click(); });
    await p.waitForTimeout(800);
    pruef(eigen.length >= 1, "Voraussetzung: das Foto aus dem eigenen Speicher wurde geladen", eigen.length + " Anfragen");
    pruef(!fremd.length, "kein einziges Foto vom fremden Server wurde angefragt (die IP der Gäste bleibt bei uns)", fremd.join(" | ") || "0 Anfragen");
    pruef(!fehler.length, "kein Skriptfehler", fehler[0] || "still");
    await ctx.close(); }

  await br.close();
  console.log("\n" + (f ? f + " von " + n + " FEHLGESCHLAGEN" : "Alles sauber (" + n + ")"));
  process.exit(f ? 1 : 0);
})();
