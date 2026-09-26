/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Lange Texte an der neuen Grenze — trägt der Hub sie?

     NODE_PATH=$(npm root -g) node pruefungen/pruef-textplatz.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   > Anlass (26.09.2026). Der Betreiber schickte ein Bildschirmfoto:
   > Der Bannertitel brach nach „Probier gerne unsere neuen Speis" ab,
   > 32 Zeichen. Gewünscht: mehr Buchstaben für jede Textfläche des
   > Gast-Hubs. Die Grenzen sind seitdem höher
   > (datenbank/migration-texte-laenger.sql) — und damit muss der Hub
   > Texte tragen, die er vorher nie gesehen hat.

   Zweite Quelle für die Zahlen ist das Board selbst (maxlength und
   TEXTMASS in seiten/admin.html), nicht eine Zahl in dieser Datei:
   Wird dort eine Grenze wieder angehoben, misst diese Prüfung die
   neue mit.

   Gemessen wird das GEZEICHNETE Bild (getBoundingClientRect), bei
   360, 390 und 430 px, in beiden Häusern:
     · nichts läuft seitlich über
     · der Slogan wird höchstens dreizeilig
     · die Bannerkarte bleibt 4:3, ihr Text bleibt IN der Karte
     · Kacheln einer Reihe bleiben gleich hoch (§3.7), Titel ≤ 2,
       Unterzeile ≤ 3 Zeilen
     · der Aktionsname bleibt höchstens zweizeilig
     · der Gruß auf dem Willkommensschirm passt auf den Schirm
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN  = path.join(__dirname, "..");
const ADMIN = fs.readFileSync(path.join(OBEN, "seiten", "admin.html"), "utf8");
const HAEUSER = ["chocolamour", "blend"];
const BREITEN = [360, 390, 430];

let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

/* Die Grenzen aus dem Board lesen — dort stehen sie für den Wirt. */
function grenze(muster){
  const m = ADMIN.match(muster);
  return m ? +m[1] : null;
}
const G = {
  bnTitel:  grenze(/data-bn-titel maxlength="(\d+)"/),
  bnText:   grenze(/data-bn-text maxlength="(\d+)"/),
  kbTitel:  grenze(/data-kb-titel maxlength="(\d+)"/),
  kbUnter:  grenze(/data-kb-unter maxlength="(\d+)"/),
  claim:    grenze(/hubClaim:\s*\{\s*gut:\d+,\s*hart:(\d+)/),
  gruss:    grenze(/hubGruss:\s*\{\s*gut:\d+,\s*hart:(\d+)/),
  runner:   grenze(/hubRunner:\s*\{\s*gut:\d+,\s*hart:(\d+)/)
};

/* Echte Wörter, keine Buchstabenkette: „xxxx…" bricht nie um und
   misst deshalb etwas, das kein Wirt je tippt (§8.1g). */
const WOERTER = ["Probier","gerne","unsere","neuen","Speisen","mit","frischer",
  "Schokolade","und","warmem","Karamell","aus","eigener","Herstellung","heute",
  "besonders","lecker","für","die","ganze","Familie"];
function textMit(len){
  let s = "", i = 0;
  while(s.length < len) s += (s ? " " : "") + WOERTER[i++ % WOERTER.length];
  return s.slice(0, len).trim();
}

(async () => {
  console.log("══ Grenzen aus dem Board ══");
  pruef(Object.values(G).every(v => v > 0), "alle sieben Grenzen gefunden", JSON.stringify(G));
  pruef(G.bnTitel >= 60 && G.bnText >= 120, "Banner nimmt deutlich mehr als 32/60 Zeichen",
    G.bnTitel + " / " + G.bnText);

  const BILD = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#caa"/></svg>';
  const browser = await chromium.launch();

  for(const haus of HAEUSER){
    const datei = path.join(OBEN, "dist", haus, "index.html");
    if(!fs.existsSync(datei)){ pruef(false, haus + ": kein erzeugter Hub", "erst erzeuge-hub.js --alle"); continue; }
    for(const breite of BREITEN){
      console.log("\n══ " + haus + " · " + breite + " px ══");
      const ctx = await browser.newContext({ viewport:{ width:breite, height:844 } });
      const p = await ctx.newPage();
      const kons = [];
      p.on("pageerror", e => kons.push(String(e).slice(0, 140)));
      await p.route("**/*", r => r.request().url().startsWith("file://")
        ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
      await p.route("https://bild.test/**", r =>
        r.fulfill({ status:200, contentType:"image/svg+xml", body:BILD }));
      await p.route("**/rest/v1/betriebe**", r => r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ id:"11111111-2222-3333-4444-555555555555",
          bestell_pause:false, bestell_pause_text:"",
          hub_texte:{ claim:textMit(G.claim), gruss:textMit(G.gruss), runner_titel:textMit(G.runner) },
          hub_banner:[
            { id:"b1", an:true, bild:"https://bild.test/a.svg", titel:textMit(G.bnTitel),
              text:textMit(G.bnText), farbe:"", zielTyp:"seite", zielWert:"speisekarte", reihenfolge:0 },
            { id:"b2", an:true, bild:"https://bild.test/b.svg", titel:"Kurz",
              text:"", farbe:"", zielTyp:"seite", zielWert:"speisekarte", reihenfolge:1 }],
          hub_kacheln:[
            { schluessel:"speisekarte", titel:textMit(G.kbTitel), unter:textMit(G.kbUnter) },
            { schluessel:"tischruf",    titel:"Service",           unter:"Kurz Bescheid geben" },
            { schluessel:"bewertung",   titel:textMit(G.kbTitel), unter:textMit(G.kbUnter) },
            { schluessel:"wlan",        titel:"WLAN",              unter:"" }],
          hub_woerter:{}, liefer:null, hub_avatar:null }]) }));
      /* Der Hub merkt sich den Willkommensschirm in sessionStorage. */
      await p.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){} });
      await p.goto("file://" + datei);
      await p.waitForTimeout(1600);

      const m = await p.evaluate((runner) => {
        const zeilen = el => {
          if(!el) return -1;
          const s = getComputedStyle(el);
          const zh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.25;
          return Math.round(el.getBoundingClientRect().height / zh);
        };
        const raus = { ueber: document.documentElement.scrollWidth - innerWidth };
        const c = document.getElementById("claim");
        raus.claimLang = c ? c.textContent.length : 0;
        raus.claimZeilen = zeilen(c);

        const karte = document.querySelector('.bnkarte[data-bn="0"]');
        if(karte){
          const k = karte.getBoundingClientRect();
          const txt = karte.querySelector(".bntxt").getBoundingClientRect();
          raus.bn = { da:true, verh: +(k.height / k.width).toFixed(3),
            textDrin: txt.top >= k.top - 0.5 && txt.bottom <= k.bottom + 0.5,
            titel: zeilen(karte.querySelector(".bntxt b")),
            unter: zeilen(karte.querySelector(".bntxt span")),
            titelLang: (karte.querySelector(".bntxt b") || {}).textContent.length };
        }else raus.bn = { da:false };

        /* Kacheln nach Reihe (gleiches top) gruppieren. */
        const kacheln = [...document.querySelectorAll("a.kachel")].filter(e => e.offsetParent);
        const reihen = {};
        kacheln.forEach(e => { const r = e.getBoundingClientRect();
          (reihen[Math.round(r.top)] = reihen[Math.round(r.top)] || []).push(Math.round(r.height)); });
        raus.reihenUngleich = Object.values(reihen).filter(h => h.length > 1 && Math.max(...h) - Math.min(...h) > 1).length;
        raus.kachelnMehrere = Object.values(reihen).some(h => h.length > 1);
        /* Listenform (eine Kachel je Reihe): Dort gibt es keine
           Nachbarin, die mitgezogen würde. Gemessen wird stattdessen,
           dass der Textblock der LANGEN Kachel nie höher wird als
           2 Titelzeilen + 3 Unterzeilen — aus den echten Zeilenhöhen
           gerechnet, nicht geschätzt (§8.1g: meine erste Zahl, 56 px,
           war erfunden und verglich gegen eine Kachel ohne Unterzeile). */
        const lh = el => { const st = getComputedStyle(el);
          return parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.25; };
        const lang = kacheln.find(e => ((e.querySelector(".txt strong") || {}).textContent || "").length > 30);
        if(lang){
          const st = lang.querySelector(".txt strong"), sp = lang.querySelector(".txt > span");
          const spSicht = sp && getComputedStyle(sp).display !== "none";
          const darf = 2 * lh(st) + (spSicht ? 3 * lh(sp) : 0) + 6;
          raus.wachstum = { ist: Math.round(lang.querySelector(".txt").getBoundingClientRect().height),
                            darf: Math.round(darf) };
        }else raus.wachstum = null;
        raus.kTitel = Math.max(0, ...kacheln.map(e => zeilen(e.querySelector(".txt strong"))));
        raus.kUnter = Math.max(0, ...kacheln.map(e => {
          const s = e.querySelector(".txt > span");
          return s && getComputedStyle(s).display !== "none" ? zeilen(s) : 0; }));
        raus.kLang = Math.max(0, ...kacheln.map(e => ((e.querySelector(".txt strong") || {}).textContent || "").length));

        /* Aktionsband mit dem langen Namen. */
        aktionen = [{ id:"m", gericht_name:"Dubai Crêpe", titel:runner, preis_alt:15.9, preis_neu:11.9,
                      bis:new Date(Date.now() + 3600000).toISOString() }];
        zeichne();
        const kz = document.querySelector(".aktion .kennz");
        raus.runner = kz ? { zeilen: zeilen(kz), lang: kz.textContent.length } : null;
        raus.ueberNachAktion = document.documentElement.scrollWidth - innerWidth;
        aktionen = []; zeichne();
        return raus;
      }, textMit(G.runner));

      pruef(m.ueber <= 0 && m.ueberNachAktion <= 0, "nichts läuft seitlich über",
        m.ueber + " / " + m.ueberNachAktion + " px");
      pruef(m.claimLang >= G.claim - 1, "der Slogan kommt in voller Länge an (nicht mehr bei 48 gekürzt)",
        m.claimLang + " Zeichen");
      pruef(m.claimZeilen >= 1 && m.claimZeilen <= 3, "der Slogan bleibt höchstens dreizeilig", m.claimZeilen + " Zeile(n)");
      pruef(m.bn.da, "die lange Bannerkarte ist gezeichnet");
      if(m.bn.da){
        pruef(m.bn.titelLang >= G.bnTitel - 1, "Bannertitel kommt ungekürzt im Hub an", m.bn.titelLang + " Zeichen");
        pruef(Math.abs(m.bn.verh - 0.75) < 0.02, "die Bannerkarte bleibt 4:3", m.bn.verh);
        pruef(m.bn.textDrin, "der Bannertext bleibt IN der Karte");
        pruef(m.bn.titel <= 3 && m.bn.unter <= 3, "Bannertitel und Unterzeile höchstens dreizeilig",
          m.bn.titel + " / " + m.bn.unter);
      }
      if(m.kachelnMehrere){
        pruef(m.reihenUngleich === 0, "Raster: Kacheln einer Reihe bleiben gleich hoch", m.reihenUngleich + " ungleiche Reihe(n)");
      }else{
        pruef(m.wachstum !== null, "Liste: die lange Kachel steht da (Voraussetzung)");
        pruef(m.wachstum !== null && m.wachstum.ist <= m.wachstum.darf,
          "Liste: der Text der langen Kachel bleibt bei 2 + 3 Zeilen",
          m.wachstum ? m.wachstum.ist + " px, erlaubt " + m.wachstum.darf : "–");
      }
      pruef(m.kLang >= G.kbTitel - 1, "der lange Kacheltitel kommt an", m.kLang + " Zeichen");
      pruef(m.kTitel <= 2 && m.kUnter <= 3, "Kacheltitel ≤ 2, Unterzeile ≤ 3 Zeilen", m.kTitel + " / " + m.kUnter);
      pruef(m.runner && m.runner.lang >= G.runner - 1 && m.runner.zeilen <= 2,
        "der Aktionsname kommt ganz an und bleibt höchstens zweizeilig",
        m.runner ? m.runner.lang + " Zeichen, " + m.runner.zeilen + " Zeile(n)" : "kein Band");
      pruef(kons.length === 0, "kein Fehler in der Konsole", kons[0] || "still");
      await ctx.close();
    }

    /* Der Gruß auf dem Willkommensschirm — nur beim ersten Öffnen. */
    const ctx = await browser.newContext({ viewport:{ width:360, height:640 } });
    const p = await ctx.newPage();
    await p.route("**/*", r => r.request().url().startsWith("file://")
      ? r.continue() : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
    await p.goto("file://" + datei);
    await p.waitForTimeout(250);
    /* Der Schirm liest den Gruß beim Start aus BETRIEB — der lange
       Gruß wird deshalb direkt eingesetzt, nicht über den Abgleich. */
    const w = await p.evaluate((gruss) => {
      const wort = document.getElementById("wkWort");
      if(!wort || !document.getElementById("willkommen")) return null;
      wort.textContent = gruss;
      const r = wort.getBoundingClientRect(), s = document.getElementById("willkommen").getBoundingClientRect();
      return { unten: Math.round(r.bottom), oben: Math.round(r.top), schirm: Math.round(s.bottom),
               breit: document.documentElement.scrollWidth - innerWidth };
    }, textMit(G.gruss));
    pruef(!!w, haus + " · der Willkommensschirm steht (Voraussetzung)");
    if(w) pruef(w.oben >= 0 && w.unten <= w.schirm && w.breit <= 0,
      haus + " · ein Gruß mit " + G.gruss + " Zeichen passt bei 360×640 auf den Schirm",
      "oben " + w.oben + ", unten " + w.unten + " von " + w.schirm);
    await ctx.close();
  }
  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  console.log(f ? f + " Fehler." : "Alles sauber.");
  process.exit(f ? 1 : 0);
})();
