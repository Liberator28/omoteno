/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Aktions-Banner-Rad (Block 2/3)

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-banner-rad.js

   Auftrag: Im Board soll der Wirt ein wischbares Bilderkarussell
   pflegen können — freie Banner (Bild/Text/Farbe/Ziel) ODER an eine
   laufende Preis-Aktion gekoppelte, live nachgezogene Banner. Vier
   Zieltypen: produkt/seite/url/aktion. Geschrieben auf die neue Live-
   Spalte betriebe.hub_banner (migration-banner-rad.sql).

   ZWEITE QUELLE (CLAUDE.md §8.1b): admin.html UND hub.vorlage.html
   führen unabhängig dieselbe Zulassungsliste BANNER_SEITEN für den
   Ziel-Typ "seite" — anders als KACHELPLAN/KACHELARTEN gibt es hier
   keinen Erzeuger, der eine Abweichung sofort sichtbar macht. Dieser
   Teil hält beide Listen gegeneinander.

   EHRLICHE GRENZE: Die Board-Bedienung (bnAusZeile/bnZeichnen/
   bnSichern) wird per direktem Funktionsaufruf geprüft, ohne
   Supabase — derselbe Weg, den pruef-figur-board.js für hub_avatar
   nimmt. Der Gast-Teil läuft gegen den echten erzeugten Hub
   (dist/chocolamour), mit gestellter Server-Antwort (page.route) —
   das prüft NICHT, ob die Migration wirklich in Produktion liegt
   (das kann nur ein echtes Postgres, siehe die Proben am Ende von
   migration-banner-rad.sql, dort schon gefahren und grün).

   Gegenbeweis GEFAHREN (nicht nur behauptet, CLAUDE.md §8.1g), beide
   Male mit grep -c belegt, dass die Sabotage wirklich ankam, danach
   zurückgenommen und wieder grün geprüft:
     1. In hub.vorlage.html die "nie aus hub_banner, immer live aus
        aktionen"-Zeilen entfernt → "aktion-Ziel zeigt den LIVE-Titel"
        wurde rot (zeigte den gespeicherten Titel). Zurückgenommen → grün.
     2. In admin.html BANNER_SEITEN um einen Eintrag erweitert, den es
        in hub.vorlage.html nicht gibt → "jede admin.html-Seite ist
        auch im Hub erlaubt" wurde rot. Zurückgenommen → grün.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN  = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const HUBQ  = path.join(OBEN, "vorlagen", "hub.vorlage.html");
const DIST  = path.join(OBEN, "dist", "chocolamour", "index.html");
const BID   = "af095b14-d9ef-41f4-9b97-c4422b0de63f";

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

/* ── Zweite Quelle: BANNER_SEITEN in beiden Dateien gleich? ──────── */
function seitenAus(datei) {
  const text = fs.readFileSync(datei, "utf8");
  const treffer = text.match(/const BANNER_SEITEN = (\[[\s\S]*?\]);/);
  if (!treffer) return null;
  /* admin.html: [{ s:"speisekarte", name:"Speisekarte" }, …]
     hub.vorlage.html: ["speisekarte","getraenke", …] — zwei Formen,
     beide über dieselbe Zeichenkette gelesen. */
  const alsObjekte = [...treffer[1].matchAll(/\bs\s*:\s*"([a-z]+)"/g)].map(m => m[1]);
  if (alsObjekte.length) return alsObjekte;
  return [...treffer[1].matchAll(/"([a-z]+)"/g)].map(m => m[1]);
}

function kreuzvergleichSeiten() {
  console.log("\n══ Zweite Quelle · BANNER_SEITEN in admin.html vs. hub.vorlage.html ══");
  const admin = seitenAus(ADMIN);
  const hub   = seitenAus(HUBQ);
  pruef(!!admin && admin.length > 0, "admin.html führt BANNER_SEITEN", admin ? admin.length + " Einträge" : "nicht gefunden");
  pruef(!!hub && hub.length > 0, "hub.vorlage.html führt BANNER_SEITEN (Erlaubnisliste in bannerZiel)", hub ? hub.length + " Einträge" : "nicht gefunden");
  if (admin && hub) {
    const fehlendInHub   = admin.filter(s => !hub.includes(s));
    const fehlendInAdmin = hub.filter(s => !admin.includes(s));
    pruef(fehlendInHub.length === 0, "jede admin.html-Seite ist auch im Hub erlaubt", fehlendInHub.join(",") || "keine fehlt");
    pruef(fehlendInAdmin.length === 0, "jede Hub-Seite steht auch im Board zur Auswahl", fehlendInAdmin.join(",") || "keine fehlt");
  }
}

/* ── Board: bn* direkt gegen eine gestellte Zeile, kein Supabase ─── */
async function boardPruefen() {
  console.log("\n══ Board · bnAusZeile/bnSichern (direkter Aufruf) ══");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const seite = await ctx.newPage();
  const konsole = [];
  seite.on("pageerror", e => konsole.push(String(e).slice(0, 200)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(700);
  await seite.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); }
  });
  await seite.waitForTimeout(400);
  const scharf = await seite.$("#scharfJetzt");
  if (scharf && await seite.isVisible("#scharf")) { await scharf.click(); await seite.waitForTimeout(200); }
  await seite.evaluate(() => document.querySelector('[data-tafel="startseite"]').click());
  await seite.waitForTimeout(300);

  /* Rundlauf: eine rohe Zeile mit allen vier Zieltypen (plus einem
     ungültigen fünften) direkt durch bnAusZeile schicken. */
  const rundlauf = await seite.evaluate(() => {
    bnAusZeile([
      { id:"b1", an:true, bild:"https://x/a.jpg", titel:"A", zielTyp:"produkt", zielWert:"Dubai Crêpe" },
      { id:"b2", an:true, bild:"https://x/b.jpg", titel:"B", zielTyp:"seite", zielWert:"speisekarte" },
      { id:"b3", an:true, bild:"https://x/c.jpg", titel:"C", zielTyp:"url", zielWert:"https://example.com" },
      { id:"b4", an:true, bild:"https://x/d.jpg", titel:"D", zielTyp:"aktion", zielWert:"11111111-1111-1111-1111-111111111111" },
      { id:"b5", an:true, bild:"https://x/e.jpg", titel:"E", zielTyp:"nichtvorhanden", zielWert:"x" },
      { id:"b6", an:true, bild:"javascript:alert(1)", titel:"F", zielTyp:"url", zielWert:"https://x" },
    ]);
    return BANNERSTAND.map(b => ({ id:b.id, zielTyp:b.zielTyp, bild:b.bild }));
  });
  pruef(rundlauf.length === 6, "alle sechs Zeilen kommen durch bnAusZeile", rundlauf.length + " Stück");
  ["produkt","seite","url","aktion"].forEach((typ, i) => {
    const eintrag = rundlauf[i];
    pruef(!!eintrag && eintrag.zielTyp === typ, "Zeile " + (i+1) + " behält zielTyp=" + typ, eintrag && eintrag.zielTyp);
  });
  pruef(rundlauf[4].zielTyp === "seite", "unbekannter zielTyp fällt still auf 'seite' zurück (kein Absturz)", rundlauf[4].zielTyp);
  pruef(rundlauf[5].bild === "", "javascript:-Bild wird verworfen (nur https:// erlaubt)", JSON.stringify(rundlauf[5].bild));

  /* Anlegen, Umsortieren, Löschen. */
  const bedienung = await seite.evaluate(() => {
    bnAusZeile([]);
    bnNeu(); bnNeu(); bnNeu();
    BANNERSTAND[0].titel = "Erstes";
    BANNERSTAND[1].titel = "Zweites";
    BANNERSTAND[2].titel = "Drittes";
    const vorTitel = BANNERSTAND.map(b => b.titel);
    bnVerschieben(BANNERSTAND[0].id, 1);
    const nachVerschieben = BANNERSTAND.map(b => b.titel);
    const weg = BANNERSTAND[2].id;
    BANNERSTAND = BANNERSTAND.filter(b => b.id !== weg);
    return { vorTitel, nachVerschieben, nachLoeschen: BANNERSTAND.map(b => b.titel), reihenfolgen: BANNERSTAND.map(b => b.reihenfolge) };
  });
  pruef(bedienung.vorTitel.join(",") === "Erstes,Zweites,Drittes", "drei neue Banner in Reihenfolge angelegt", bedienung.vorTitel.join(","));
  pruef(bedienung.nachVerschieben.join(",") === "Zweites,Erstes,Drittes", "Verschieben tauscht die Reihenfolge", bedienung.nachVerschieben.join(","));
  pruef(bedienung.nachLoeschen.join(",") === "Zweites,Erstes", "Löschen entfernt genau das eine Banner", bedienung.nachLoeschen.join(","));

  pruef(konsole.length === 0, "keine Ausnahme auf dem ganzen Weg", konsole.join(" | ") || "still");
  await browser.close();
}

/* ── Gast-Hub: alle vier Zieltypen, live-aktion, verwaiste Aktion ── */
async function hubPruefen() {
  console.log("\n══ Gast-Hub · Karussell, vier Zieltypen ══");
  if (!fs.existsSync(DIST)) { console.log("  kein erzeugter Hub, übersprungen (node erzeuger/erzeuge-hub.js --alle)"); return; }

  const AKTION_ID = "11111111-1111-1111-1111-111111111111";
  const BANNER = [
    { id:"b1", an:true, bild:"https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800",
      titel:"Seite", text:"", farbe:"", zielTyp:"seite", zielWert:"getraenke", reihenfolge:0 },
    { id:"b2", an:true, bild:"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
      titel:"Produkt", text:"", farbe:"", zielTyp:"produkt", zielWert:"Dubai Crêpe", reihenfolge:1 },
    { id:"b3", an:true, bild:"https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
      titel:"UNGÜLTIG (nicht klickbar)", text:"", farbe:"", zielTyp:"seite", zielWert:"nirgendwo", reihenfolge:2 },
    { id:"b4", an:true, bild:"https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800",
      titel:"gespeicherter FALSCHER Titel", text:"gespeicherter FALSCHER Text",
      farbe:"rot", zielTyp:"aktion", zielWert:AKTION_ID, reihenfolge:3 },
  ];

  async function geoeffnet(banner, aktionen) {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const seite = await ctx.newPage();
    const konsole = [];
    seite.on("pageerror", e => konsole.push(String(e).slice(0, 200)));
    await seite.route("**/*", r => {
      const url = r.request().url();
      if (url.startsWith("file://")) return r.continue();
      if (url.includes("/rest/v1/betriebe")) {
        return r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify([{
          id: BID, bestell_pause:false, bestell_pause_text:"", hub_texte:{},
          hub_kacheln:null, hub_banner: banner, hub_woerter:{}, liefer:null, hub_avatar:null
        }]) });
      }
      if (url.includes("/rest/v1/aktionen")) {
        return r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify(aktionen) });
      }
      return r.abort();
    });
    await seite.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){} });
    await seite.goto("file://" + DIST);
    await seite.waitForTimeout(1200);
    return { browser, seite, konsole };
  }

  const { browser, seite, konsole } = await geoeffnet(BANNER, [
    { id: AKTION_ID, gericht_name:"Dubai Crêpe", titel:"Live-Aktion", preis_alt:15.90, preis_neu:9.90,
      bis: new Date(Date.now() + 3600000).toISOString() }
  ]);

  const karten = await seite.evaluate(() => {
    const spur = document.getElementById("bnSpur");
    if (!spur) return null;
    return [...spur.querySelectorAll(".bnkarte")].map(k => ({
      tag: k.tagName, href: k.getAttribute("href"), dataDetail: k.getAttribute("data-detail"),
      titel: k.querySelector("b").textContent
    }));
  });
  pruef(!!karten && karten.length === 4, "alle vier Banner erscheinen im Rad", karten ? karten.length : "kein #bnSpur");
  if (karten) {
    pruef(karten[0].tag === "A" && karten[0].href === "#/getraenke", "seite-Ziel: echter Hash-Link", JSON.stringify(karten[0]));
    pruef(karten[1].tag === "BUTTON" && karten[1].dataDetail === encodeURIComponent("Dubai Crêpe"), "produkt-Ziel: data-detail auf den Gerichtnamen", JSON.stringify(karten[1]));
    pruef(karten[2].tag === "DIV", "ungültiges seite-Ziel: sichtbar, aber NICHT klickbar (kein toter Link)", karten[2].tag);
    pruef(karten[3].titel === "Live-Aktion", "aktion-Ziel zeigt den LIVE-Titel, nicht den gespeicherten", karten[3].titel);
  }

  /* Klick auf das produkt-Banner öffnet wirklich das Gerichtsdetail. */
  await seite.click(".bnkarte:nth-child(2)");
  await seite.waitForTimeout(400);
  const offen = await seite.evaluate(() => {
    const k = document.getElementById("warenkarte");
    return k && k.classList.contains("an") ? k.textContent.slice(0, 20) : null;
  });
  pruef(!!offen && offen.includes("Dubai"), "Klick auf das produkt-Banner öffnet das echte Gerichtsdetail", offen);

  /* Kontrast der Schrift auf dem Scrim gegen den ungünstigsten Fall
     (Schwarz UND Weiß dahinter) — dasselbe Verfahren wie
     pruefungen/pruef-glas.js für die anderen Glas-Flächen. */
  function relLum([r,g,b]){ const v=[r,g,b].map(x=>{const c=x/255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)}); return .2126*v[0]+.7152*v[1]+.0722*v[2]; }
  function kontrast(a,b){ const l1=relLum(a),l2=relLum(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); }
  const scrim = await seite.evaluate(() => {
    const k = document.querySelector(".bnkarte");
    const txt = getComputedStyle(k.querySelector(".bntxt b")).color;
    const roh = txt.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    return roh ? [+roh[1], +roh[2], +roh[3]] : null;
  });
  if (scrim) {
    const schwarz = kontrast(scrim, [38.25,38.25,38.25]);  // rgba(0,0,0,.85) über Weiß
    pruef(schwarz >= 4.5, "Bannerschrift ≥ 4.5:1 im ungünstigsten Fall (fast weißes Foto, Scrim .82)", schwarz.toFixed(2) + ":1 (Text " + JSON.stringify(scrim) + ")");
  }

  pruef(konsole.length === 0, "keine Ausnahme auf dem ganzen Weg", konsole.join(" | ") || "still");
  await browser.close();

  /* Breite (Auftrag: „Der Banner kann ruhig breiter sein, die Seiten
     sollen voll aussehen"). Vorher 87 % der Innenbreite — bei 360 px
     250 statt 330 px. Gemessen wird gegen die ZWEITE Quelle auf der
     Seite, die Kachelreihe darunter: Die Karte ist genau so breit und
     steht genau so weit links. Dazu: kein seitliches Überlaufen der
     Seite, und die Nachbarkarte lugt sichtbar herein (≥ 8 px), sonst
     sieht niemand, dass es weitergeht. */
  console.log("\n══ Gast-Hub · Breite des Rads ══");
  for (const breite of [360, 430, 768, 1280]) {
    const b2 = await chromium.launch();
    const ctx = await b2.newContext({ viewport: { width: breite, height: 900 } });
    const s2 = await ctx.newPage();
    await s2.route("**/*", r => {
      const url = r.request().url();
      if (url.startsWith("file://")) return r.continue();
      if (url.includes("/rest/v1/betriebe")) return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ id: BID, bestell_pause:false, hub_texte:{}, hub_kacheln:null,
          hub_banner: BANNER.slice(0, 3), hub_woerter:{}, liefer:null, hub_avatar:null }]) });
      if (url.includes("/rest/v1/")) return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
      return r.abort();
    });
    await s2.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){} });
    await s2.goto("file://" + DIST);
    await s2.waitForTimeout(1000);
    const m = await s2.evaluate(() => {
      const spur = document.getElementById("bnSpur"), git = document.querySelector("#inhalt .gitter");
      if (!spur || !git) return null;
      const rad = spur.parentElement.getBoundingClientRect();
      const k = spur.querySelectorAll(".bnkarte"), a = k[0].getBoundingClientRect(), b = k[1].getBoundingClientRect();
      const g = git.getBoundingClientRect();
      return { kl: a.left, kw: a.width, gl: g.left, gw: g.width, lugt: rad.right - b.left,
               sw: document.documentElement.scrollWidth, iw: innerWidth };
    });
    if (!m) { pruef(false, breite + " px: Rad und Kachelreihe vorhanden", "fehlt"); await b2.close(); continue; }
    pruef(Math.abs(m.kw - m.gw) <= 1 && Math.abs(m.kl - m.gl) <= 1,
      breite + " px: Karte so breit wie die Kachelreihe und bündig", "Karte " + Math.round(m.kl) + "/" + Math.round(m.kw) + " · Kacheln " + Math.round(m.gl) + "/" + Math.round(m.gw));
    pruef(m.lugt >= 8, breite + " px: Nachbarkarte lugt ≥ 8 px herein", Math.round(m.lugt) + " px");
    pruef(m.sw <= m.iw, breite + " px: kein seitliches Überlaufen der Seite", m.sw + " / " + m.iw);
    await b2.close();
  }
}

(async () => {
  kreuzvergleichSeiten();
  await boardPruefen();
  await hubPruefen();

  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
