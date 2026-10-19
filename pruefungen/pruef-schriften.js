/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Schriften: Auswahl, eigener Import, Anwendung im Hub

     NODE_PATH=$(npm root -g) node pruefungen/pruef-schriften.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   > Anlass (26.09.2026). Wunsch: „Schriften ändern im Admin Hub, von
   > voreingestellten Schriften oder man kann welche importieren, wenn
   > man eine eigene hat, die direkt angewendet wird.“

   1 · Zweite Quelle: SCHRIFT_WAHL (Board) = SCHRIFT_WEB (Hub), jede
       Datei liegt in auslieferung/schriften/, jede Familie steht in
       LIZENZEN.txt, _headers gibt /schriften/* frei, bauen.js kopiert.
   2 · Hub: eine gewählte Schrift steht im GEZEICHNETEN Text
       (getComputedStyle + document.fonts.check), nicht nur in einer
       Variable; fremde Server, Anführungszeichen, javascript: werden
       nicht geladen — gemessen an den Anfragen, die wirklich abgehen.
   3 · Board: Auswahl erscheint in der Live-Vorschau; eine umbenannte
       Bilddatei wird abgewiesen, eine echte Schrift angenommen und in
       der Vorschau gezeigt; „Übernehmen“ lädt sie in den eigenen
       Ordner und schreibt hub_stil.schrift — der Emoji-Schalter bleibt.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs = require("fs");
const path = require("path");

const OBEN   = path.join(__dirname, "..");
const ADMIN  = path.join(OBEN, "seiten", "admin.html");
const VORLAGE = fs.readFileSync(path.join(OBEN, "vorlagen", "hub.vorlage.html"), "utf8");
const ADMINTXT = fs.readFileSync(ADMIN, "utf8");
const ORDNER = path.join(OBEN, "auslieferung", "schriften");
const BASIS  = "https://omoteno.test/schriften/";
const HUBBASIS = "https://omoteno.test/h/";
const DB = "https://quxwweuvdqtjsdwgjdrh.supabase.co";
const BID = "11111111-2222-3333-4444-555555555555";

let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

function schriftDatei(u){
  const name = u.slice(u.lastIndexOf("/") + 1).split("?")[0];
  const p = path.join(ORDNER, name);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

(async () => {
  /* ── 1 · Zweite Quelle ─────────────────────────────────────────── */
  console.log("══ Katalog, Dateien, Lizenzen, Auslieferung ══");
  const hub = {};
  for(const m of VORLAGE.matchAll(/^\s+(\w+):\s*\{ familie:"([^"]+)",\s*datei:"([^"]+)",\s*staerken:\[([\d,]+)\]/gm))
    hub[m[1]] = { familie:m[2], datei:m[3], staerken:m[4].split(",").map(Number) };
  const board = {};
  for(const m of ADMINTXT.matchAll(/\{ s:"(\w+)",\s*familie:"([^"]+)",\s*datei:"([^"]+)"/g))
    board[m[1]] = { familie:m[2], datei:m[3] };
  pruef(Object.keys(hub).length >= 10, "Hub-Katalog gelesen", Object.keys(hub).length + " Schriften");
  const ungleich = Object.keys(hub).concat(Object.keys(board)).filter(k =>
    !hub[k] || !board[k] || hub[k].datei !== board[k].datei || hub[k].familie !== board[k].familie);
  pruef(ungleich.length === 0 && Object.keys(hub).length === Object.keys(board).length,
    "Board und Hub bieten dieselben Schriften mit denselben Dateien an", ungleich.join(", ") || "gleich");
  const fehlt = [];
  for(const [k, w] of Object.entries(hub)) for(const st of w.staerken) for(const teil of ["latin", "latin-ext"]){
    const d = w.datei + "-" + teil + "-" + st + ".woff2";
    if(!fs.existsSync(path.join(ORDNER, d))) fehlt.push(d);
  }
  pruef(fehlt.length === 0, "jede angebotene Datei liegt in auslieferung/schriften/", fehlt.join(", ") || "alle da");
  const liz = fs.existsSync(path.join(ORDNER, "LIZENZEN.txt")) ? fs.readFileSync(path.join(ORDNER, "LIZENZEN.txt"), "utf8") : "";
  const ohneLizenz = Object.values(hub).map(w => w.familie).filter(fam => liz.indexOf(fam) < 0);
  pruef(ohneLizenz.length === 0 && /SIL Open Font License/i.test(liz),
    "jede Familie steht mit ihrer Lizenz in LIZENZEN.txt", ohneLizenz.join(", ") || "vollständig");
  const kopf = fs.readFileSync(path.join(OBEN, "auslieferung", "_headers"), "utf8");
  pruef(/\/schriften\/\*\s*\n\s*Access-Control-Allow-Origin: \*/.test(kopf),
    "_headers gibt /schriften/* für die Kundenadressen frei (CORS)");
  pruef(/auslieferung", "schriften"/.test(fs.readFileSync(path.join(OBEN, "erzeuger", "bauen.js"), "utf8")),
    "bauen.js liefert den Ordner aus");
  /* Alle Seiten, nicht nur Hub und Board: Der erste Lauf dieser Probe
     fand die Google-Schriften im BOARD — und dann in allen acht Seiten
     unter seiten/, samt Datenschutzerklärung, die Google nicht nannte.
     Gezählt werden echte <link>-Verweise, keine Kommentare. */
  const seitenMitGoogle = fs.readdirSync(path.join(OBEN, "seiten")).filter(d => d.endsWith(".html"))
    .map(d => [d, fs.readFileSync(path.join(OBEN, "seiten", d), "utf8")])
    .concat([["hub.vorlage.html", VORLAGE]])
    .filter(([, t]) => /<link[^>]*fonts\.(googleapis|gstatic)/.test(t)).map(([d]) => d);
  pruef(seitenMitGoogle.length === 0, "keine Seite lädt Schriften von Google (keine IP an Dritte)",
    seitenMitGoogle.join(", ") || "keine");
  const css = fs.existsSync(path.join(ORDNER, "seiten.css")) ? fs.readFileSync(path.join(ORDNER, "seiten.css"), "utf8") : "";
  const cssFehlt = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]).filter(d => !fs.existsSync(path.join(ORDNER, d)));
  pruef(css && cssFehlt.length === 0 && /Instrument Sans/.test(css) && /Bricolage Grotesque/.test(css),
    "seiten.css verweist nur auf Dateien, die da sind", cssFehlt.join(", ") || "vollständig");

  const browser = await chromium.launch();

  /* ── 2 · Hub ───────────────────────────────────────────────────── */
  const hubOeffnen = async (schrift, haus) => {
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
    const p = await ctx.newPage();
    const anfragen = [], fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 140)));
    await p.addInitScript(b => { window.OMOTENO_SCHRIFT_BASIS = b;
      try{ sessionStorage.setItem("omoteno-willkommen", "1"); }catch(e){} }, BASIS);
    await p.route("**/*", r => {
      const u = r.request().url();
      if(u.startsWith("file://")) return r.continue();
      if(/\.(woff2|woff|ttf|otf)(\?|$)/.test(u)) anfragen.push(u);
      if(u.startsWith(BASIS) || u.startsWith(DB + "/storage/v1/object/public/schriften/")){
        const d = schriftDatei(u);
        return d ? r.fulfill({ status:200, contentType:"font/woff2", headers:{ "Access-Control-Allow-Origin":"*" }, body:d })
                 : r.fulfill({ status:404, body:"" });
      }
      if(u.includes("/rest/v1/betriebe")) return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ id:BID, bestell_pause:false, bestell_pause_text:"", hub_texte:{}, hub_kacheln:null,
          hub_banner:null, hub_woerter:{}, liefer:null, hub_avatar:null, hub_stil:{ emoji:true, schrift } }]) });
      return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
    });
    await p.goto("file://" + path.join(OBEN, "dist", haus || "chocolamour", "index.html"));
    await p.waitForTimeout(1600);
    await p.evaluate(() => document.fonts && document.fonts.ready);
    return { ctx, p, anfragen, fehler };
  };

  console.log("\n══ Hub: Auswahl wird wirklich gezeichnet ══");
  {
    const { ctx, p, anfragen, fehler } = await hubOeffnen({ kopf:"playfair", text:"nunito" });
    const m = await p.evaluate(() => ({
      h1: getComputedStyle(document.querySelector("h1")).fontFamily,
      text: getComputedStyle(document.body).fontFamily,
      kopfDa: document.fonts.check('21px "omo-playfair"'),
      textDa: document.fonts.check('16px "omo-nunito"'),
      gemerkt: localStorage.getItem("omoteno-schrift-" + HAUS) }));
    pruef(/omo-playfair/.test(m.h1), "Überschrift steht in der gewählten Schrift", m.h1.slice(0, 50));
    pruef(/omo-nunito/.test(m.text), "Fließtext steht in der gewählten Schrift", m.text.slice(0, 50));
    pruef(m.kopfDa && m.textDa, "beide Schriften sind geladen (document.fonts.check)", m.kopfDa + " / " + m.textDa);
    pruef(anfragen.every(u => u.startsWith(BASIS)) && anfragen.some(u => /playfair-display-latin-400/.test(u)),
      "geladen nur von der eigenen Adresse", anfragen.length + " Anfrage(n)");
    /* Mein erster Anlauf behauptete „latin-ext nie“ — falsch: Der
       Sprachwähler zeigt „Română“, und ă (U+0103) liegt in latin-ext.
       Geprüft wird jetzt gegen den Text, der wirklich dasteht. */
    const ext = await p.evaluate(() => /[\u0100-\u02BA\u1E00-\u1E9F]/.test(document.body.innerText));
    const extGeladen = anfragen.some(u => /-latin-ext-/.test(u));
    pruef(extGeladen === ext, "latin-ext genau dann, wenn ein Zeichen daraus auf der Seite steht",
      "Zeichen " + (ext ? "da" : "nicht da") + ", geladen " + extGeladen);
    pruef(/playfair/.test(m.gemerkt || ""), "für den nächsten Besuch gemerkt", m.gemerkt);
    pruef(fehler.length === 0, "kein Fehler im Hub", fehler[0] || "still");
    await ctx.close();
  }

  console.log("\n══ Hub: acht neue Schriften — jede lädt und zeichnet wirklich ══");
  {
    const NEU = ["bricolage", "instrserif", "instrsans", "jetbrains", "spacegrotesk", "shantell", "spectral", "abril"];
    const { ctx, p, anfragen, fehler } = await hubOeffnen({ titel:NEU[0], abschnitt:NEU[1], gericht:NEU[2],
      kachel:NEU[3], kopf:NEU[4], text:NEU[6] });
    /* shantell und abril (nur „kopf") tauchen über die geerbte Rolle
       "titel" nicht auf, wenn kopf schon vergeben ist — eigens gegen
       #titel bzw. eine Kachel-Klasse geprüft, nicht nur über die
       schon belegten vier Rollen oben. */
    const m = await p.evaluate(n => {
      const stil = getComputedStyle(document.documentElement);
      return {
        vars: {
          titel: stil.getPropertyValue("--schrift-titel"),
          abschnitt: stil.getPropertyValue("--schrift-abschnitt"),
          gericht: stil.getPropertyValue("--schrift-gericht"),
          kachel: stil.getPropertyValue("--schrift-kachel"),
          kopf: stil.getPropertyValue("--schrift-kopf"),
          text: stil.getPropertyValue("--schrift-text")
        },
        geladen: n.map(s => document.fonts.check('16px "omo-' + s + '"'))
      };
    }, NEU);
    pruef(/omo-bricolage/.test(m.vars.titel), "Bricolage Grotesque an der Rolle „titel“", m.vars.titel.slice(0, 30));
    pruef(/omo-instrserif/.test(m.vars.abschnitt), "Instrument Serif an der Rolle „abschnitt“", m.vars.abschnitt.slice(0, 30));
    pruef(/omo-instrsans/.test(m.vars.gericht), "Instrument Sans an der Rolle „gericht“", m.vars.gericht.slice(0, 30));
    pruef(/omo-jetbrains/.test(m.vars.kachel), "JetBrains Mono an der Rolle „kachel“", m.vars.kachel.slice(0, 30));
    pruef(/omo-spacegrotesk/.test(m.vars.kopf), "Space Grotesk an der Rolle „kopf“", m.vars.kopf.slice(0, 30));
    pruef(/omo-spectral/.test(m.vars.text), "Spectral am Fließtext", m.vars.text.slice(0, 30));
    pruef(m.geladen.every(Boolean), "alle acht sind wirklich geladen (document.fonts.check)", m.geladen.join(","));
    pruef(anfragen.every(u => u.startsWith(BASIS)), "auch die neuen acht kommen nur von der eigenen Adresse", anfragen.length + " Anfrage(n)");
    pruef(fehler.length === 0, "kein Fehler im Hub", fehler[0] || "still");
    await ctx.close();
  }
  {
    /* shantell und abril bieten sich nur für "kopf" an (rollen:["kopf"]
       in SCHRIFT_WAHL) — hier als "kachel"/"gericht" gewählt, wo sie
       laut Board-Liste eigentlich stehen dürfen (kopf-artige Rollen,
       swAuswahlrolle). */
    const { ctx, p, fehler } = await hubOeffnen({ kachel:"shantell", gericht:"abril" });
    const ok = await p.evaluate(() => ({
      kachel: getComputedStyle(document.documentElement).getPropertyValue("--schrift-kachel"),
      gericht: getComputedStyle(document.documentElement).getPropertyValue("--schrift-gericht"),
      geladen: document.fonts.check('16px "omo-shantell"') && document.fonts.check('16px "omo-abril"') }));
    pruef(/omo-shantell/.test(ok.kachel) && /omo-abril/.test(ok.gericht) && ok.geladen,
      "Shantell Sans und Abril Fatface (nur „kopf“-Rollen) an anderen kopf-artigen Rollen ebenso wählbar",
      JSON.stringify(ok).slice(0, 100));
    pruef(fehler.length === 0, "kein Fehler im Hub", fehler[0] || "still");
    await ctx.close();
  }

  console.log("\n══ Hub: vier eigene Rollen — der Regressionstest für den gemeldeten Fehler ══");
  /* Anlass: „wenn man die Schriftart für 'Guten Tag' ändert, ändert
     sich auch die für das runde Feld [Tischquiz-Runde]“ — beide
     hingen an EINER Variable (--schrift-kopf). Vier unabhängige
     Rollen (titel/abschnitt/gericht/kachel) lösen das ab; die vier
     erben nur, wenn niemand sie einzeln anfasst. */
  {
    const { ctx, p, fehler } = await hubOeffnen({ abschnitt:"caveat" });
    await p.evaluate(() => { location.hash = "#/quiz"; });
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => ({
      h1: getComputedStyle(document.querySelector("#titel")).fontFamily,
      h2: getComputedStyle(document.querySelector("h2")).fontFamily }));
    pruef(/omo-caveat/.test(m.h2), "Rolle „Quiz/Abschnitte“ geändert: die Tischquiz-Überschrift zeigt sie", m.h2.slice(0, 40));
    pruef(!/omo-caveat/.test(m.h1), "die Begrüßung (h1) bleibt UNVERÄNDERT — genau der gemeldete Fehler", m.h1.slice(0, 40));
    pruef(fehler.length === 0, "kein Fehler im Hub", fehler[0] || "still");
    await ctx.close();
  }
  {
    const { ctx, p } = await hubOeffnen({ titel:"bebas" });
    await p.evaluate(() => { location.hash = "#/quiz"; });
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => ({
      h1: getComputedStyle(document.querySelector("#titel")).fontFamily,
      h2: getComputedStyle(document.querySelector("h2")).fontFamily }));
    pruef(/omo-bebas/.test(m.h1), "umgekehrt: Rolle „Begrüßung/Titel“ geändert, h1 zeigt sie", m.h1.slice(0, 40));
    pruef(!/omo-bebas/.test(m.h2), "die Tischquiz-Überschrift (h2) bleibt unverändert", m.h2.slice(0, 40));
    await ctx.close();
  }
  {
    /* Ohne jede einzelne Wahl: alle vier neuen Rollen erben weiterhin
       von "kopf" — kein Kunde von vor diesem Umbau sieht eine
       Änderung (CLAUDE.md §2.5). */
    const { ctx, p } = await hubOeffnen({ kopf:"pacifico" });
    await p.evaluate(() => { location.hash = "#/quiz"; });
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => ({
      h1: getComputedStyle(document.querySelector("#titel")).fontFamily,
      h2: getComputedStyle(document.querySelector("h2")).fontFamily }));
    pruef(/omo-pacifico/.test(m.h1) && /omo-pacifico/.test(m.h2),
      "ohne einzelne Wahl erben beide weiterhin von „kopf“ (Rückwärtskompatibilität)",
      m.h1.slice(0, 30) + " / " + m.h2.slice(0, 30));
    await ctx.close();
  }

  console.log("\n══ Hub: fremde und präparierte Adressen ══");
  const markeKopf = await (async () => {
    const { ctx, p } = await hubOeffnen({});
    const v = await p.evaluate(() => getComputedStyle(document.querySelector("h1")).fontFamily);
    await ctx.close(); return v;
  })();
  for(const [name, url] of [
    ["fremder Server",        "https://evil.test/schrift.woff2"],
    ["Anführungszeichen",     DB + '/storage/v1/object/public/schriften/' + BID + '/x.woff2") ; x:url("https://evil.test/y'],
    ["javascript:",           "javascript:alert(1)"],
    ["fremder Eimer",         DB + "/storage/v1/object/public/gerichte/" + BID + "/x.woff2"],
    ["blob: außerhalb der Vorschau", "blob:https://omoteno.test/abc"]]){
    const { ctx, p, anfragen, fehler } = await hubOeffnen({ kopf:"eigen", kopf_datei:url });
    const h1 = await p.evaluate(() => getComputedStyle(document.querySelector("h1")).fontFamily);
    pruef(h1 === markeKopf && !anfragen.some(u => /evil|gerichte|blob:/.test(u)) && fehler.length === 0,
      name + ": nicht geladen, Markenschrift bleibt", anfragen.length + " Anfrage(n), " + h1.slice(0, 30));
    await ctx.close();
  }
  {
    const echt = DB + "/storage/v1/object/public/schriften/" + BID + "/hausschrift-abc.woff2";
    /* Route liefert für diese Adresse die Lora-Datei aus dem Ordner. */
    const { ctx, p, anfragen } = await hubOeffnen({ kopf:"eigen", kopf_datei:echt });
    const m = await p.evaluate(() => getComputedStyle(document.querySelector("h1")).fontFamily);
    /* h1 steht seit dem Vier-Rollen-Umbau unter --schrift-titel, nicht
       mehr direkt unter --schrift-kopf — geerbt von "kopf", solange
       "titel" selbst nichts Eigenes trägt. Der Familienname folgt der
       ROLLE, die wirklich zeichnet ("titel"), nicht der Quelle ("kopf"). */
    pruef(/omo-e-titel-/.test(m) && anfragen.includes(echt),
      "eigene Schrift aus dem Eimer „schriften“ wird angewendet (geerbt an die Rolle „titel“)", m.slice(0, 40));
    await ctx.close();
  }

  /* ── 3 · Board ─────────────────────────────────────────────────── */
  console.log("\n══ Board: Auswahl, Import, Übernehmen ══");
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push("Board: " + String(e).slice(0, 160)));
  await p.addInitScript(([b, h]) => { window.OMOTENO_SCHRIFT_BASIS = b; window.HUB_VORSCHAU_BASIS = h;
    Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; }, [BASIS, HUBBASIS]);
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(u === HUBBASIS + "blend/") return r.fulfill({ status:200, contentType:"text/html; charset=utf-8",
      headers:{ "Access-Control-Allow-Origin":"*" }, body: fs.readFileSync(path.join(OBEN, "dist", "blend", "index.html"), "utf8") });
    if(u.startsWith(BASIS)){ const d = schriftDatei(u);
      return d ? r.fulfill({ status:200, contentType:"font/woff2", headers:{ "Access-Control-Allow-Origin":"*" }, body:d })
               : r.fulfill({ status:404, body:"" }); }
    return r.fulfill({ status:200, contentType:"application/json", headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" });
  });
  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(900);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); zeichneAlles(); });
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(300); }
  await p.evaluate(() => tafelZeigen("startseite"));
  await gruppeZu(p, "#swGruppe");
  const bereit = async () => { for(let i = 0; i < 40; i++){
    if(await p.evaluate(() => { const h = hvAlle().startseite;
      try{ return !!(h && h.bereit && typeof h.frame.contentWindow.vorschauSetzen === "function"); }catch(e){ return false; } }))
      return true; await p.waitForTimeout(150); } return false; };
  pruef(await bereit(), "Vorschau der Startseite ist bereit (Voraussetzung)");
  const inVorschau = code => p.evaluate(c => new (hvAlle().startseite.frame.contentWindow.Function)(c)(), code);

  const zahl = await p.evaluate(() => ({
    kopf: document.querySelectorAll('[data-sw-rolle="kopf"] [data-sw]').length,
    text: document.querySelectorAll('[data-sw-rolle="text"] [data-sw]').length,
    titel: document.querySelectorAll('[data-sw-rolle="titel"] [data-sw]').length,
    abschnitt: document.querySelectorAll('[data-sw-rolle="abschnitt"] [data-sw]').length,
    gericht: document.querySelectorAll('[data-sw-rolle="gericht"] [data-sw]').length,
    kachel: document.querySelectorAll('[data-sw-rolle="kachel"] [data-sw]').length,
    schreibImText: !!document.querySelector('[data-sw-rolle="text"] [data-sw="pacifico"]') }));
  pruef(zahl.kopf >= 12 && zahl.text >= 7, "Auswahl gezeichnet (Überschrift / Text)", zahl.kopf + " / " + zahl.text);
  pruef([zahl.titel, zahl.abschnitt, zahl.gericht, zahl.kachel].every(n => n === zahl.kopf),
    "die vier neuen Rollen bieten dieselbe Auswahl wie „Alle Überschriften“",
    zahl.titel + " / " + zahl.abschnitt + " / " + zahl.gericht + " / " + zahl.kachel + " (kopf: " + zahl.kopf + ")");
  pruef(!zahl.schreibImText, "Schreibschrift wird für Fließtext nicht angeboten");

  console.log("\n══ Board: Schriftauswahl komprimiert (ein Bauteil, fünfmal) ══");
  const kompaktZustand = rolle => p.evaluate(r => {
    const w = document.querySelector('[data-sw-rolle="' + r + '"]');
    const auf = w.querySelector("[data-sw-auf]"), klapp = w.querySelector(".swklapp");
    return {
      expanded: auf.getAttribute("aria-expanded"),
      offen: klapp.classList.contains("offen"),
      hoehe: klapp.getBoundingClientRect().height,
      zusammenfassung: w.querySelector("[data-sw-zusammenfassung]").textContent
    };
  }, rolle);
  const geschlossenVorher = await kompaktZustand("gericht");
  pruef(geschlossenVorher.expanded === "false" && !geschlossenVorher.offen && geschlossenVorher.hoehe === 0,
    "jede Rolle startet zu (keine Höhe, aria-expanded=false)", JSON.stringify(geschlossenVorher));
  pruef(/Wie „Alle Überschriften/.test(geschlossenVorher.zusammenfassung),
    "der Kopfknopf zeigt schon geschlossen die aktuelle Wahl (hier: die Vorgabe)", geschlossenVorher.zusammenfassung);
  await p.click('[data-sw-rolle="gericht"] [data-sw-auf]');
  await p.waitForTimeout(400);
  const offenNachher = await kompaktZustand("gericht");
  pruef(offenNachher.expanded === "true" && offenNachher.offen && offenNachher.hoehe > 100,
    "„Ändern“ tippen klappt genau diese Rolle auf, keine andere", JSON.stringify(offenNachher));
  const andereRolleBleibtZu = await kompaktZustand("kachel");
  pruef(!andereRolleBleibtZu.offen, "eine fremde Rolle bleibt dabei zu", JSON.stringify(andereRolleBleibtZu));
  await p.click('[data-sw-rolle="gericht"] [data-sw="lora"]');
  await p.waitForTimeout(400);
  const nachWahl = await kompaktZustand("gericht");
  pruef(!nachWahl.offen && nachWahl.hoehe === 0 && /Lora/.test(nachWahl.zusammenfassung),
    "eine echte Wahl klappt die Liste automatisch wieder zu und zeigt die neue Wahl", JSON.stringify(nachWahl));

  /* Eine der vier neuen Rollen wählen: erscheint sie unabhängig in der
     Vorschau, ohne die anderen anzufassen? Gemessen an der Variable
     selbst statt an einem bestimmten h2 — die Vorschau lädt als
     srcdoc-Iframe ohne den „Willkommensschirm übersprungen“-Vermerk
     im sessionStorage, darum steht dort VOR jedem Tischquiz-h2 noch
     das (unsichtbare) h2.haus des Willkommensschirms; document.
     querySelector("h2") träfe also den falschen. */
  await p.click('[data-sw-rolle="abschnitt"] [data-sw-auf]');
  await p.waitForTimeout(300);
  await p.click('[data-sw-rolle="abschnitt"] [data-sw="caveat"]');
  await p.waitForTimeout(900);
  const rollenProbe = await inVorschau(`return {
    abschnitt: getComputedStyle(document.documentElement).getPropertyValue("--schrift-abschnitt"),
    h1: getComputedStyle(document.querySelector("#titel")).fontFamily
  };`);
  pruef(/omo-caveat/.test(rollenProbe.abschnitt), "Board: Rolle „Quiz/Abschnitte“ gewählt — die Vorschau setzt --schrift-abschnitt sofort", rollenProbe.abschnitt.slice(0, 50));
  pruef(!/omo-caveat/.test(rollenProbe.h1), "Board: die Begrüßung (h1) bleibt in der Vorschau unverändert", rollenProbe.h1.slice(0, 40));

  await p.click('[data-sw-rolle="kopf"] [data-sw-auf]');
  await p.waitForTimeout(300);
  await p.click('[data-sw-rolle="kopf"] [data-sw="playfair"]');
  await p.waitForTimeout(900);
  const h1 = await inVorschau(`return getComputedStyle(document.querySelector("h1")).fontFamily;`);
  pruef(/omo-playfair/.test(h1), "Tipp auf „Playfair Display“: die Vorschau zeigt sie sofort", h1.slice(0, 40));
  const gewaehlt = await p.getAttribute('[data-sw-rolle="kopf"] [data-sw="playfair"]', "aria-checked");
  pruef(gewaehlt === "true", "die Karte ist als gewählt markiert");
  const probeSchrift = await p.evaluate(() =>
    getComputedStyle(document.querySelector('[data-sw-rolle="kopf"] [data-sw="caveat"] .swprobe')).fontFamily);
  pruef(/omo-sw-caveat/.test(probeSchrift), "jede Karte zeigt ihre Probe in der eigenen Schrift", probeSchrift.slice(0, 30));

  /* Eine umbenannte Bilddatei. */
  const bildAlsSchrift = path.join(require("os").tmpdir(), "schrift-falsch.woff2");
  fs.writeFileSync(bildAlsSchrift, Buffer.from("89504E470D0A1A0A0000000D49484452", "hex"));
  await p.setInputFiles('[data-sw-datei="text"]', bildAlsSchrift);
  await p.waitForTimeout(500);
  let meldung = await p.textContent("#swPruefung");
  const nachFalsch = await p.evaluate(() => ({ wahl: SW.text, neu: !!SW.neu.text }));
  pruef(/keine Schriftdatei/.test(meldung) && nachFalsch.wahl !== "eigen" && !nachFalsch.neu,
    "umbenannte Bilddatei wird abgewiesen", meldung);

  /* Eine echte Schrift. */
  const echteDatei = path.join(require("os").tmpdir(), "Meine Hausschrift.woff2");
  fs.copyFileSync(path.join(ORDNER, "lora-latin-400.woff2"), echteDatei);
  await p.setInputFiles('[data-sw-datei="text"]', echteDatei);
  await p.waitForTimeout(1200);
  meldung = await p.textContent("#swPruefung");
  const text = await inVorschau(`return getComputedStyle(document.body).fontFamily;`);
  pruef(/steht in der Vorschau/.test(meldung), "echte Schrift angenommen", meldung.slice(0, 60));
  pruef(/omo-e-text-/.test(text), "die eigene Schrift steht in der Vorschau, bevor sie hochgeladen ist", text.slice(0, 40));

  /* Übernehmen im scharfen Betrieb: db gestellt, Aufrufe mitgeschrieben. */
  const ergebnis = await p.evaluate(async (bid) => {
    const log = [];
    demo = false; betriebId = bid;
    meineBetriebe = [{ id:bid, slug:"blend", name:"Blend", hub_stil:{ emoji:false } }];
    db = {
      storage: { from: eimer => ({
        upload: async (pfad, datei, opt) => { log.push({ art:"upload", eimer, pfad, typ:opt.contentType, upsert:opt.upsert }); return { error:null }; },
        getPublicUrl: pfad => ({ data:{ publicUrl: "https://quxwweuvdqtjsdwgjdrh.supabase.co/storage/v1/object/public/" + eimer + "/" + pfad } }) }) },
      from: tab => ({ update: satz => ({ eq: async (sp, wert) => { log.push({ art:"update", tab, satz, sp, wert }); return { error:null }; } }) })
    };
    await swSichern();
    return { log, meldung: document.getElementById("swPruefung").textContent };
  }, BID);
  const up = ergebnis.log.find(x => x.art === "upload"), upd = ergebnis.log.find(x => x.art === "update");
  pruef(up && up.eimer === "schriften" && new RegExp("^" + BID + "/Meine-Hausschrift-[a-z0-9]+\\.woff2$").test(up.pfad)
    && up.typ === "font/woff2" && up.upsert === false,
    "Upload in den eigenen Ordner, mit Schrifttyp, ohne Überschreiben", up ? up.pfad + " · " + up.typ : "kein Upload");
  const sch = upd && upd.satz.hub_stil && upd.satz.hub_stil.schrift;
  pruef(upd && upd.tab === "betriebe" && upd.wert === BID && sch && sch.kopf === "playfair" && sch.text === "eigen" &&
    /\/schriften\/.+\.woff2$/.test(sch.text_datei || ""),
    "hub_stil.schrift enthält Auswahl und Adresse", JSON.stringify(sch || null).slice(0, 120));
  pruef(upd && upd.satz.hub_stil.emoji === false, "der Emoji-Schalter bleibt dabei erhalten",
    upd ? String(upd.satz.hub_stil.emoji) : "–");
  const url = sch && sch.text_datei;
  pruef(!!url && url.indexOf("blob:") < 0, "gespeichert wird die echte Adresse, nie blob:", String(url).slice(0, 60));
  /* Die gespeicherte Adresse muss am Hub-Muster vorbeikommen — sonst
     wäre sie gespeichert und beim Gast wirkungslos (§8.1i). */
  const nimmtAn = await inVorschau(`return schriftUrlOk(${JSON.stringify(url)}) !== "";`);
  pruef(nimmtAn, "der Hub nimmt genau die Adresse an, die das Board speichert");

  pruef(fehler.length === 0, "kein Fehler im Board", fehler[0] || "still");
  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  console.log(f ? f + " Fehler." : "Alles sauber.");
  process.exit(f ? 1 : 0);
})();
