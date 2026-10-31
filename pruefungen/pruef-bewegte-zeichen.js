/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Bewegte Zeichen, Speisekarte mit Korbknopf, Entdecken, Feiern

     node erzeuger/erzeuge-hub.js --alle
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-bewegte-zeichen.js

   ZWEITE QUELLEN (CLAUDE.md §8.1b):
     · auslieferung/emoji/ — jeder Codepunkt, den der Hub irgendwo
       nennt, muss dort als Datei liegen. Gezählt wird aus dem QUELLTEXT
       des Hubs, nicht aus der Liste der Dateien.
     · die echten Kategorien (Stand 25.09., aus der Datenbank gelesen)
       mit dem Emoji, das jede bekommen SOLL — hingeschrieben, nicht
       aus der Regel abgeleitet, sonst prüfte die Regel sich selbst.
     · das gemalte Bild jedes Lottie-Films: Das Ruhebild (BZ_RUHE) muss
       wirklich voll sein, nachgezählt in Pixeln.

   Die Emoji-Dateien werden im Test von der Platte geliefert (die
   feste Adresse https://omoteno.de/emoji/ wird abgefangen). Ein Teil
   läuft ausdrücklich OHNE sie: Dann muss das stille Geräte-Emoji
   stehen bleiben — nie ein leeres Feld.

   EHRLICHE GRENZE: Ob omoteno.de die Dateien mit dem CORS-Kopf
   ausliefert, sieht diese Prüfung nicht (kein Netz). Das prüft
   pruef-lieferung.js am gebauten Ordner nur als Datei; der Kopf steht
   in auslieferung/_headers.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const EMO  = path.join(OBEN, "auslieferung", "emoji");
const HUBQ = path.join(OBEN, "vorlagen", "hub.vorlage.html");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const HUB  = slug => "file://" + path.join(OBEN, "dist", slug, "index.html");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

/* Die echten Kategorien und was sie zeigen SOLLEN. */
const ERWARTET = {
  speisekarte: { "Crêpe":"crepe", "Waffel":"1f36a", "Mini-Pancakes":"pancaketurm", "Creamy Rice":"1f368",
                 "Fettuccine":"1f35d", "Obstsalat":"1f96d", "Für die Runde":"1f973",
                 "Herzhaft · Manakish":"pizzakaese", "Alle":"2728", "Beliebt":"1f525" },
  getraenke:   { "Frisch gepresst":"1f34a", "Softdrinks":"soda" },   // Wunsch: Flasche, die aufspritzt
  cocktails:   { "Kaiser · 0,5 l":"1f37e", "Cocktails":"cocktailglas", "Arabisches Eis":"1f366" }
};

/* 8×8 Pixel, einfarbig — reicht für object-fit:cover. */
const PROBEBILD = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4kOCAFTEMLQkAgsZYAf8tblAAAAAASUVORK5CYII=", "base64");

/* Bilder pro Sekunde: rAF-Zähler über ms Millisekunden, größte Lücke. */
const FLUSS = ms => new Promise(fertig => {
  const t0 = performance.now(); let letzte = t0, luecke = 0, bilder = 0;
  (function z(){
    const jetzt = performance.now(); luecke = Math.max(luecke, jetzt - letzte); letzte = jetzt; bilder++;
    if (jetzt - t0 < ms) requestAnimationFrame(z);
    else fertig({ bilder, luecke:Math.round(luecke), fps:Math.round(bilder * 1000 / (jetzt - t0)) });
  })();
});

async function oeffnen(browser, slug, hash, opt = {}) {
  const ctx = await browser.newContext({ viewport:{ width:opt.breite || 390, height:900 },
    reducedMotion: opt.ruhig ? "reduce" : "no-preference" });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(e.message));
  await s.route("**/*", r => {
    const u = r.request().url();
    /* Gerichtfotos: Die Karte verweist auf Bilder, die im Verzeichnis
       nicht liegen. Für die Proben, die ein Bild BRAUCHEN, wird ein
       echtes PNG geliefert — sonst misst man die Zeile ohne Bild. */
    if (opt.bilder && u.startsWith("file://") && /\/bilder\//.test(u))
      return r.fulfill({ status:200, contentType:"image/png", body:PROBEBILD });
    if (u.startsWith("file://")) return r.continue();
    const m = u.match(/^https:\/\/omoteno\.de\/emoji\/([^?]+)/);
    if (m) {
      if (opt.ohneEmoji) return r.abort();
      const datei = path.join(EMO, m[1]);
      if (!fs.existsSync(datei)) return r.fulfill({ status:404, body:"" });
      return r.fulfill({ status:200, headers:{ "access-control-allow-origin":"*" },
        contentType: m[1].endsWith(".js") ? "application/javascript" : "application/json",
        body: fs.readFileSync(datei) });
    }
    if (opt.stil && /\/rest\/v1\/betriebe/.test(u))
      return r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ id:"af095b14-d9ef-41f4-9b97-c4422b0de63f", bestell_pause:false, hub_stil: opt.stil }]) });
    return r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await s.addInitScript(() => { try{ sessionStorage.setItem("omoteno-willkommen","1"); }catch(e){} });
  if (opt.vorher) await s.addInitScript(opt.vorher);
  await s.goto(HUB(slug) + (hash || ""));
  await s.waitForTimeout(opt.warten || 2200);
  /* Ein Haus mit Markenblatt-Schalter „premium“ (Choco) hat eine andere Startseite und andere Produktkarten (Kopfkarte,
     Plus unten rechts statt auf der Bildecke, Kacheln unter dem Foto-Kopf). Die Proben hier gelten dem KLASSISCHEN
     Bild und sollen dort bewacht bleiben; die Premium-Fassung misst pruef-start-premium/pruef-speisekarte-premium. */
  if (opt.premium !== true) {
    const k = await s.evaluate(() => { if (MARKENBLATT.startstil !== "premium") return false;
      MARKENBLATT.startstil = "klassisch"; startstilSetzen(); zeichne(); return true; });
    if (k) await s.waitForTimeout(opt.warten ? Math.min(opt.warten, 2500) : 1800);
  }
  return { ctx, s, fehler };
}

(async () => {
  const quelle = fs.readFileSync(HUBQ, "utf8");

  console.log("\n══ Zweite Quelle: jede genannte Datei liegt bereit ══");
  const genannt = new Set();
  for (const m of quelle.matchAll(/"([0-9a-f]{4,5})"/g)) {
    /* Nur Codepunkte aus den Emoji-Tafeln und bzHTML-Aufrufen, keine
       zufälligen Hex-Zeichenketten: Der Bereich wird eingegrenzt. */
    const cp = m[1];
    const umfeld = quelle.slice(Math.max(0, m.index - 60), m.index);
    if (/BZ_|bzHTML\(|bzZeichen\(|\[\/[^\]]*\/,\s*$|[a-z_]+:\s*$/.test(umfeld) || /^(1f|2[67b])/.test(cp)) genannt.add(cp);
  }
  const fehlt = [...genannt].filter(cp => /^(1f|2[67b])/.test(cp) && !fs.existsSync(path.join(EMO, cp + ".json")));
  pruef(genannt.size >= 40, "Codepunkte im Hub gefunden", genannt.size);
  pruef(!fehlt.length, "jede genannte Datei liegt in auslieferung/emoji/", fehlt.join(",") || "alle da");
  /* Eigene Zeichen (kein Unicode-Codepunkt): jedes braucht seine Datei
     UND einen Geräte-Emoji-Rückfall, der selbst als Noto-Film existiert. */
  const eigen = JSON.parse(((quelle.match(/const BZ_EIGEN = (\{[^}]*\})/) || [])[1] || "{}").replace(/(\w+):/g, '"$1":'));
  const eigenFehlt = Object.entries(eigen).filter(([k, ersatz]) => !fs.existsSync(path.join(EMO, k + ".json")) || !/^1f|^2/.test(ersatz));
  pruef(Object.keys(eigen).length >= 1 && !eigenFehlt.length, "eigene Zeichen liegen als Datei bereit, mit Rückfall-Emoji",
    Object.entries(eigen).map(([k, e]) => k + "→" + e).join(", "));
  pruef(/crepe\.json/.test(fs.readFileSync(path.join(EMO, "LIZENZEN.txt"), "utf8")), "das eigene Zeichen steht mit Herkunft in LIZENZEN.txt");
  pruef(fs.existsSync(path.join(EMO, "lottie-5.13.0.min.js")) &&
        quelle.includes('BZ_QUELLE + "lottie-5.13.0.min.js"'), "Abspieler liegt unter dem Namen, den der Hub lädt");
  pruef(fs.existsSync(path.join(EMO, "LIZENZEN.txt")) &&
        /CC BY 4\.0/.test(fs.readFileSync(path.join(OBEN, "seiten", "impressum.html"), "utf8")),
        "Lizenzhinweis (CC BY 4.0) in LIZENZEN.txt und im Impressum");
  const kopf = fs.readFileSync(path.join(OBEN, "auslieferung", "_headers"), "utf8");
  pruef(/\/emoji\/\*\s*\n\s*Access-Control-Allow-Origin: \*/.test(kopf), "_headers gibt /emoji/* für andere Herkünfte frei");

  const browser = await chromium.launch();

  console.log("\n══ Keine fremden Marken im Quelltext ══");
  {
    /* Eine NAMENTLICHE Liste (§8.1g D) — ein Muster würde verstecken,
       was es durchlässt. Durchsucht wird alles, was ausgeliefert oder
       erzeugt wird, und die Prüfungen. Die Liste steht nur hier. */
    const MARKEN = ["lieferando", "uber eats", "ubereats", "wolt", "deliveroo", "doordash", "just eat", "justeat", "tinder"];
    const ORDNER = ["seiten", "vorlagen", "erzeuger", "pruefungen", "auslieferung", "markenblaetter", "datenbank", "supabase"];
    const treffer = [];
    const gehe = d => {
      for (const e of fs.readdirSync(d, { withFileTypes:true })) {
        const pfad = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== "emoji" && e.name !== "node_modules") gehe(pfad); continue; }
        if (!/\.(html|js|json|sql|ts|css|md|txt|toml)$|^_/.test(e.name) || pfad === __filename) continue;
        const txt = fs.readFileSync(pfad, "utf8").toLowerCase();
        for (const m of MARKEN) if (txt.includes(m)) treffer.push(path.relative(OBEN, pfad) + ": " + m);
      }
    };
    for (const o of ORDNER) if (fs.existsSync(path.join(OBEN, o))) gehe(path.join(OBEN, o));
    pruef(!treffer.length, "kein fremder Markenname in Code, Vorlagen und Prüfungen", treffer.join("; ") || "keiner");
  }

  console.log("\n══ Ruhebild: nachgezählt, nicht geglaubt ══");
  {
    const s = await browser.newPage();
    await s.setContent('<div id="f" style="width:64px;height:64px"></div><canvas id="c" width="64" height="64"></canvas>');
    await s.addScriptTag({ path: path.join(EMO, "lottie-5.13.0.min.js") });
    const ruhe = await s.evaluate(q => {
      const m = q.match(/const BZ_RUHE = (\{[^}]*\});/); return m ? JSON.parse(m[1]) : null;
    }, quelle);
    pruef(!!ruhe, "BZ_RUHE aus dem Hub gelesen", ruhe ? Object.keys(ruhe).length + " Einträge" : "fehlt");
    const zuleer = [];
    for (const datei of fs.readdirSync(EMO).filter(x => x.endsWith(".json"))) {
      const cp = datei.replace(".json", "");
      const r = await s.evaluate(async ([text, bild]) => {
        const box = document.getElementById("f"); box.innerHTML = "";
        const a = lottie.loadAnimation({ container:box, renderer:"svg", loop:false, autoplay:false, animationData:JSON.parse(text) });
        await new Promise(ok => a.addEventListener("DOMLoaded", ok));
        const c = document.getElementById("c"), x = c.getContext("2d");
        const flaeche = async i => {
          a.goToAndStop(i, true);
          const img = new Image();
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(box.querySelector("svg")));
          await img.decode(); x.clearRect(0,0,64,64); x.drawImage(img, 0, 0, 64, 64);
          const d = x.getImageData(0,0,64,64).data; let k = 0;
          for (let j = 3; j < d.length; j += 4) if (d[j] > 128) k++;
          return k;
        };
        let max = 0;
        for (let i = 0; i < a.totalFrames; i += 3) max = Math.max(max, await flaeche(i));
        const r = await flaeche(bild); a.destroy();
        return { max, r };
      }, [fs.readFileSync(path.join(EMO, datei), "utf8"), (ruhe && ruhe[cp]) || 0]);
      if (r.r < .85 * r.max) zuleer.push(cp + " (" + Math.round(100 * r.r / r.max) + " %)");
    }
    pruef(!zuleer.length, "jedes Ruhebild zeigt ≥ 85 % der vollen Fläche", zuleer.join(", ") || "alle voll");
    await s.close();
  }

  console.log("\n══ Kategorien → Emoji, gegen die echten Namen ══");
  {
    const { ctx, s } = await oeffnen(browser, "chocolamour", "", { warten:600 });
    for (const [karte, tafel] of Object.entries(ERWARTET)) {
      const ist = await s.evaluate(([k, namen]) => namen.map(nm => [nm, bzKategorie(nm, k)]), [karte, Object.keys(tafel)]);
      const falsch = ist.filter(([nm, cp]) => cp !== tafel[nm]).map(([nm, cp]) => nm + "=" + cp + " statt " + tafel[nm]);
      pruef(!falsch.length, karte + ": jede Kategorie bekommt ihr Emoji", falsch.join("; ") || ist.length + " stimmen");
      const echte = ist.filter(([nm]) => nm !== "Alle" && nm !== "Beliebt").map(([, cp]) => cp);
      pruef(new Set(echte).size === echte.length, karte + ": keine zwei Kategorien teilen ein Emoji");
    }
    await ctx.close();
  }

  console.log("\n══ Startseite, Servicerufe: laden und stehen ══");
  for (const slug of ["chocolamour", "blend", "minhkeey"]) {
    const { ctx, s, fehler } = await oeffnen(browser, slug, "");
    /* Seit 10.10. sind Bereiche ab dem dritten zugeklappt — gezählt wird
       JEDE Kachel, also erst jeden Bereich über seinen Kopf öffnen. */
    await s.$$eval('.sb-kopf[aria-expanded="false"]', ks => ks.forEach(k => k.click())).catch(() => {});
    /* Die Filme laden erst, wenn sie in Sicht kommen (IntersectionObserver).
       Erst die Zahl OHNE Rollen festhalten — unter dem Rand darf noch
       nichts geladen sein —, dann jede Kachel einmal in Sicht rollen. */
    const vorRollen = await s.evaluate(() => {
      const h = innerHeight, alle = [...document.querySelectorAll("a.kachel .bz")];
      const unten = alle.filter(el => el.getBoundingClientRect().top > h + 200);
      return { unten:unten.length, untenBereit:unten.filter(el => el.classList.contains("bz-bereit")).length };
    });
    if (vorRollen.unten)
      pruef(vorRollen.untenBereit === 0, slug + ": Kacheln weit unter dem Rand laden erst beim Hinrollen",
            vorRollen.untenBereit + " von " + vorRollen.unten + " schon geladen");
    for (let i = 0; i < 12; i++) {
      const weiter = await s.evaluate(i => {
        const k = document.querySelectorAll("a.kachel")[i];
        if (!k) return false;
        k.scrollIntoView({ block:"center" });
        return true;
      }, i);
      if (!weiter) break;
      await s.waitForTimeout(250);
    }
    await s.waitForTimeout(900);
    const st = await s.evaluate(() => ({
      kacheln: document.querySelectorAll("a.kachel").length,
      bz: document.querySelectorAll("a.kachel .bz").length,
      bereit: document.querySelectorAll("a.kachel .bz.bz-bereit").length,
      fehler: document.querySelectorAll("[data-bz-fehler]").length,
      svgImFilm: document.querySelectorAll("a.kachel .bz-film svg").length
    }));
    pruef(st.bz > 0 && st.bereit === st.bz && !st.fehler, slug + ": jedes Kachel-Zeichen lädt und steht",
      st.bereit + "/" + st.bz + " bereit, " + st.fehler + " Fehler");
    pruef(st.svgImFilm === st.bereit, slug + ": jedes bereite Zeichen hat einen gemalten Film", st.svgImFilm);
    pruef(!fehler.length, slug + ": keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    const { ctx, s } = await oeffnen(browser, "chocolamour", "#/service");
    const r = await s.evaluate(() => [...document.querySelectorAll(".rufknopf .bz")].map(b => b.dataset.bz + (b.classList.contains("bz-bereit") ? "✓" : "✗")));
    pruef(r.length === 3 && r.every(x => x.endsWith("✓")), "Servicerufe: drei bewegte Zeichen, alle bereit", r.join(" "));
    await ctx.close();
  }

  console.log("\n══ Ohne Netz: stilles Emoji, nie ein Loch ══");
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "", { ohneEmoji:true });
    /* Breite wird gemessen — zugeklappte Bereiche (seit 10.10.) erst öffnen. */
    await s.$$eval('.sb-kopf[aria-expanded="false"]', ks => ks.forEach(k => k.click())).catch(() => {});
    const st = await s.evaluate(() => {
      const els = [...document.querySelectorAll("a.kachel .bz")];
      return { n: els.length, bereit: els.filter(e => e.classList.contains("bz-bereit")).length,
               still: els.filter(e => { const x = e.querySelector(".bz-still"); return x && getComputedStyle(x).opacity === "1" && x.getBoundingClientRect().width > 8; }).length };
    });
    pruef(st.n > 0 && st.bereit === 0, "ohne Dateien wird nichts als „bereit“ markiert", st.bereit);
    pruef(st.still === st.n, "jedes Feld zeigt sichtbar das Geräte-Emoji", st.still + "/" + st.n);
    pruef(!fehler.length, "keine Ausnahme ohne Netz", fehler.join("|") || "still");
    await ctx.close();
  }

  console.log("\n══ Schalter je Haus ══");
  for (const [name, stil, erwartet] of [["Board: aus", { emoji:false }, 0], ["Board: an", { emoji:true }, 1],
                                        ["Zeichenkette \"false\" zählt NICHT als aus", { emoji:"false" }, 1]]) {
    const { ctx, s } = await oeffnen(browser, "chocolamour", "", { stil, warten:2600 });
    const st = await s.evaluate(() => ({ bz: document.querySelectorAll("a.kachel .bz").length,
                                         svg: document.querySelectorAll("a.kachel .ico svg").length }));
    pruef(erwartet ? st.bz > 0 : (st.bz === 0 && st.svg > 0), name, st.bz + " Zeichen, " + st.svg + " Striche");
    await ctx.close();
  }
  {
    const { ctx, s } = await oeffnen(browser, "chocolamour", "", { warten:800,
      vorher: () => { window.__mbAus = true; } });
    await s.evaluate(() => { MARKENBLATT.bewegteZeichen = false; zeichne(); });
    const bz = await s.evaluate(() => document.querySelectorAll("a.kachel .bz").length);
    pruef(bz === 0, "Markenblatt bewegteZeichen:false schaltet ab", bz + " Zeichen");
    /* Rangfolge: Ein UNGÜLTIGER Wert im Board darf das Markenblatt nicht
       überdecken, sondern muss zu ihm durchfallen. Erst diese Probe
       trennt „strikt boolean" von „irgendwie wahr" — die Probe oben mit
       "false" allein kann das nicht (Gegenbeweis 1 blieb dort grün). */
    const durch = await s.evaluate(() => { HUBSTIL = { emoji:"false" }; MARKENBLATT.bewegteZeichen = false; zeichne();
      return document.querySelectorAll("a.kachel .bz").length; });
    pruef(durch === 0, "ungültiger Board-Wert fällt zum Markenblatt durch (dort aus → aus)", durch + " Zeichen");
    const vorrang = await s.evaluate(() => { HUBSTIL = { emoji:false }; MARKENBLATT.bewegteZeichen = true; zeichne();
      return document.querySelectorAll("a.kachel .bz").length; });
    pruef(vorrang === 0, "gültiger Board-Wert schlägt das Markenblatt", vorrang + " Zeichen");
    await ctx.close();
  }

  console.log("\n══ Einmal spielen, nicht bei jedem Neuzeichnen ══");
  {
    const { ctx, s } = await oeffnen(browser, "chocolamour", "", { warten:4200 });
    const r = await s.evaluate(async () => {
      /* Nach dem Einmal-Spielen steht alles; ein Neuzeichnen derselben
         Seite darf nichts wieder anwerfen. */
      zeichne();
      await new Promise(ok => setTimeout(ok, 1400));
      const els = [...document.querySelectorAll("a.kachel .bz.bz-bereit")];
      return { n: els.length, laeuft: els.filter(e => e._bz && !e._bz.isPaused).length };
    });
    pruef(r.n > 0 && r.laeuft === 0, "Neuzeichnen derselben Seite spielt nichts erneut ab", r.laeuft + " von " + r.n + " laufen");
    await ctx.close();
  }
  {
    const { ctx, s } = await oeffnen(browser, "chocolamour", "", { ruhig:true, warten:2400 });
    const r = await s.evaluate(() => {
      const els = [...document.querySelectorAll("a.kachel .bz.bz-bereit")];
      return { n: els.length, laeuft: els.filter(e => e._bz && !e._bz.isPaused).length,
               bild: els.map(e => Math.round(e._bz.currentFrame) === (BZ_RUHE[e.dataset.bz] || 0)).every(Boolean) };
    });
    pruef(r.n > 0 && r.laeuft === 0 && r.bild, "Bewegung reduzieren: nichts läuft, jedes Zeichen steht auf seinem Ruhebild",
      r.laeuft + " laufen, Ruhebild " + r.bild);
    await ctx.close();
  }

  console.log("\n══ Nach dem Neuzeichnen bleiben die Filme ══");
  {
    /* VORFALL, gemeldet vom Betreiber mit Bildschirmfoto: Nach dem ersten
       Tipp auf eine Kategorie standen nur noch stille Geräte-Emojis da.
       neuKarte() zeichnete per innerHTML neu, ohne bzVerdrahten(). Diese
       Prüfung sah bis dahin nur den ERSTEN Aufbau jeder Seite. */
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/speisekarte");
    const zaehl = () => s.evaluate(() => {
      /* In BEIDEN Richtungen sichtbar: Die Chip-Leiste rollt waagrecht,
         und was rechts draußen liegt, lädt absichtlich erst beim Hinrollen. */
      const h = innerHeight, w = innerWidth;
      /* Sichtbar heißt: im Fenster UND im Ausschnitt jedes rollenden
         Vorfahren. Seit 17.10. endet die Chip-Leiste vor der Knopfzeile
         (--kw-frei, 273 von 390 px); ein Chip bei x = 352 lag im Fenster,
         aber außerhalb der Leiste — nicht gemalt, und der Hub lädt ihn
         zu Recht erst beim Hinrollen. Gezählt hatte die Probe ihn doch:
         „3/4“, rot seit dem Umbau, auf main ebenso. */
      const ausschnitt = el => {
        let r = el.getBoundingClientRect(), o = { l: r.left, t: r.top, r: r.right, b: r.bottom };
        for (let a = el.parentElement; a; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
          const q = a.getBoundingClientRect();
          o = { l: Math.max(o.l, q.left), t: Math.max(o.t, q.top), r: Math.min(o.r, q.right), b: Math.min(o.b, q.bottom) };
        }
        return o;
      };
      const sicht = [...document.querySelectorAll("#inhalt .bz")].filter(el => {
        const o = ausschnitt(el); return o.b > Math.max(o.t, 0) && o.t < h && o.r > Math.max(o.l, 0) && o.l < w; });
      return { n: sicht.length, bereit: sicht.filter(el => el.classList.contains("bz-bereit")).length };
    });
    const vorher = await zaehl();
    const chips = await s.$$(".chip.mitbz");
    await chips[2].click(); await s.waitForTimeout(1400);
    const nachChip = await zaehl();
    pruef(vorher.n > 0 && nachChip.n > 0 && nachChip.bereit === nachChip.n,
      "Kategorie gewählt: jedes sichtbare Emoji hat wieder seinen Film", nachChip.bereit + "/" + nachChip.n);
    /* Die Leiste waagrecht ans Ende rollen: Auch die dort liegenden Chips
       müssen jetzt ihren Film bekommen (neu gezeichnet, dann erst gesehen). */
    await s.evaluate(() => { const l = document.querySelector(".chips"); l.scrollLeft = l.scrollWidth; });
    await s.waitForTimeout(1400);
    const nachRollen = await zaehl();
    pruef(nachRollen.n > 0 && nachRollen.bereit === nachRollen.n, "Chip-Leiste gerollt: auch die hinteren Chips haben ihren Film",
      nachRollen.bereit + "/" + nachRollen.n);
    await s.fill("#suchfeld", "cr"); await s.waitForTimeout(1400);
    const nachSuche = await zaehl();
    pruef(nachSuche.n > 0 && nachSuche.bereit === nachSuche.n, "nach dem Tippen in die Suche ebenso", nachSuche.bereit + "/" + nachSuche.n);
    /* Irgendein Neuzeichnen, das keiner kennt: der Beobachter muss es sehen */
    await s.evaluate(() => { location.hash = "#/service"; }); await s.waitForTimeout(1400);
    await s.evaluate(() => { document.getElementById("inhalt").innerHTML = SEITEN.service(); });
    await s.waitForTimeout(1400);
    const ruf = await s.evaluate(() => { const l = [...document.querySelectorAll(".rufknopf .bz")];
      return { n: l.length, bereit: l.filter(el => el.classList.contains("bz-bereit")).length }; });
    pruef(ruf.n === 3 && ruf.bereit === 3, "Servicerufe neu gezeichnet: alle drei Filme wieder da", ruf.bereit + "/" + ruf.n);
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }

  console.log("\n══ Karte: +, Regler, Flug ══");
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/speisekarte");
    const erst = await s.evaluate(() => document.querySelectorAll(".gplus").length);
    pruef(erst > 10, "jedes bestellbare Gericht hat ein „+“", erst);
    const flug = s.waitForSelector(".korbflug", { timeout:1500 }).then(() => true).catch(() => false);
    await (await s.$$(".gplus"))[0].click();
    pruef(await flug, "ein Flug zum Balken startet");
    await s.waitForTimeout(800);
    const st = await s.evaluate(() => ({ korb: Object.values(merk).map(g => g.m), regler: !!document.querySelector(".gmenge"),
      flieger: document.querySelectorAll(".korbflug").length, zahl: document.getElementById("auswahlzahl").textContent }));
    pruef(st.korb.join() === "1" && st.regler, "„+“ legt ins Korb und wird zum Regler", JSON.stringify(st.korb));
    pruef(st.flieger === 0, "nach der Landung liegt kein Flieger mehr herum", st.flieger);
    await s.click('[data-kschritt="1"]'); await s.waitForTimeout(250);
    await s.click('[data-kschritt="1"]'); await s.waitForTimeout(250);
    pruef(await s.evaluate(() => Object.values(merk)[0].m) === 3, "Regler zählt hoch");
    for (let i = 0; i < 3; i++) { await s.click('[data-kschritt="-1"]'); await s.waitForTimeout(200); }
    const leer = await s.evaluate(() => ({ korb:Object.keys(merk).length, plus: !!document.querySelector(".gericht .gplus") }));
    pruef(leer.korb === 0 && leer.plus, "Minus bei 1 nimmt heraus, das „+“ kehrt zurück");
    const hoehe = await s.evaluate(() => { const b = document.querySelector(".gplus"); const a = getComputedStyle(b, "::after");
      return Math.round(b.getBoundingClientRect().height - 2 * parseFloat(a.top)); });
    pruef(hoehe >= 44, "Tapfläche des „+“ ≥ 44px", hoehe + "px");
    const ueber = await s.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(ueber <= 1, "kein seitliches Schieben", ueber + "px");
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }

  console.log("\n══ Foodroulette: Zeichen im Rad und oben in der Karte ══");
  {
    /* Seit 09.10. ein Glücksrad statt des Wischstapels. Hier nur, was
       die bewegten Zeichen angeht — Drehung, Landung und Bedienung
       prüft pruef-foodroulette-rad.js. Zweite Quelle für die Zeichen:
       bzKategorie über gerichtOrt, wie in der Speisekarte. */
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/entdecken");
    const rad = await s.evaluate(() => {
      const felder = [...document.querySelectorAll("#frScheibe .fr-feld")];
      return { n: felder.length, falsch: felder.filter(f => {
        const name = frFelder[+f.dataset.frFeld], o = gerichtOrt(name);
        return !o || f.textContent !== bzZeichen(bzKategorie(o.gruppe, o.karte));
      }).map(f => frFelder[+f.dataset.frFeld]) };
    });
    pruef(rad.n >= 3 && !rad.falsch.length, "jedes Feld des Rads trägt das Zeichen seiner Kategorie", rad.n + " Felder" + (rad.falsch.length ? ", falsch: " + rad.falsch.join(", ") : ""));
    await s.evaluate(() => frDrehen());
    await s.waitForTimeout(3800);
    const oben = await s.evaluate(() => {
      const e = document.getElementById("frErgebnis"), o = gerichtOrt(frErgebnis), bz = e && e.querySelector(".ed-emo .bz");
      return { name: frErgebnis, film: !!bz, cp: bz ? bz.dataset.bz : "", soll: o ? bzKategorie(o.gruppe, o.karte) : "" };
    });
    pruef(!!oben.name && oben.film && oben.cp === oben.soll, "gelandet: oben bewegt sich das Zeichen der Kategorie", JSON.stringify(oben));
    const ueber = await s.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(ueber <= 1, "kein seitliches Schieben", ueber + "px");
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }

  console.log("\n══ Takt: die Filme laufen weiter, solange man sie sieht ══");
  /* VORFALL (Nutzer, 26.09.): „Die Animationen machen nur einen
     Durchlauf, danach bleiben sie stehen." Gemessen: loop:false, und
     jeder Film spielte genau einmal je Besuch — die Orange in der
     Entscheidungshilfe Bild 19→99 in 1,6 s, danach für immer p99.
     Jede Probe stellt zuerst fest, dass es den Film überhaupt gibt
     (§8.1g C: „kein Film“ sähe sonst aus wie „steht still“). */
  const verlauf = (s, sel, ms, schritt = 250) => s.evaluate(([sel, ms, schritt]) => new Promise(fertig => {
    const spur = [], t0 = performance.now();
    (function z(){
      const el = document.querySelector(sel);
      spur.push(el && el._bz ? { p: el._bz.isPaused, f: Math.round(el._bz.currentFrame) } : null);
      if (performance.now() - t0 < ms) setTimeout(z, schritt); else fertig(spur);
    })();
  }), [sel, ms, schritt]);
  /* Wie oft beginnt ein Durchlauf? Ein Wechsel von „steht" auf „spielt". */
  const anlaeufe = spur => spur.reduce((n, x, i) => n + (i && x && !x.p && spur[i - 1] && spur[i - 1].p ? 1 : 0), 0);
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/entdecken");
    const SEL = '#frKnoepfe .fr-knopf.haupt .bz';
    const spur = await verlauf(s, SEL, 9000);
    const da = spur.filter(Boolean).length;
    pruef(da > spur.length * .9, "Foodroulette: der Film im Knopf „Für mich entscheiden“ ist da", da + " von " + spur.length + " Proben");
    if (da) {
      const n = anlaeufe(spur);
      pruef(n >= 2, "Foodroulette: nach dem ersten Durchlauf spielt der Film WIEDER (≥ 2 neue Anläufe in 9 s)",
        n + " Anläufe · " + spur.map(x => x ? (x.p ? "p" : "") + x.f : "-").join(" ").slice(0, 160));
      const laeuft = spur.filter(x => x && !x.p).length / da;
      pruef(laeuft >= .5, "Foodroulette: der Film läuft die meiste Zeit (Pausen kurz)", Math.round(laeuft * 100) + " % der Proben spielend");
    }
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    /* Außer Sicht: wartet auf dem Ruhebild und läuft erst weiter, wenn
       es wieder zu sehen ist. Ein kurzes Fenster, damit die obersten
       Kacheln sicher aus dem Bild rollen. */
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "", { breite:390 });
    await s.setViewportSize({ width:390, height:420 });
    const erste = await s.evaluate(() => {
      const el = document.querySelector(".bz.bz-bereit"); if (!el || !el._bz) return null;
      el.id = el.id || "bzProbe"; return el.id;
    });
    pruef(!!erste, "Startseite: ein bewegtes Zeichen ist bereit");
    if (erste) {
      await s.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const weg = await s.evaluate(id => document.getElementById(id).getBoundingClientRect().bottom, erste);
      pruef(weg < 0, "Voraussetzung: das Zeichen ist aus dem Bild gerollt", "unterkante " + Math.round(weg) + " px");
      await s.waitForTimeout(7000);   // länger als ein Durchlauf plus längste Pause (6 s)
      const spur = await verlauf(s, "#" + erste, 1500);
      pruef(weg < 0 && spur.every(x => x && x.p), "außer Sicht: der Film wartet auf dem Ruhebild", spur.map(x => x ? (x.p ? "p" : "") + x.f : "-").join(" "));
      const wartet = await s.evaluate(id => document.getElementById(id)._bzWartet === true, erste);
      /* Zurück INS Bild, nicht an den Anfang: Bei 420 px Höhe liegt
         das erste Zeichen womöglich auch oben noch darunter. */
      const drin = await s.evaluate(id => { const el = document.getElementById(id);
        el.scrollIntoView({ block:"center" }); const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight; }, erste);
      pruef(drin, "Voraussetzung: das Zeichen ist wieder ganz im Bild");
      const zurueck = await verlauf(s, "#" + erste, 700, 100);
      pruef(wartet && zurueck.some(x => x && !x.p), "wieder im Bild: der wartende Film spielt sofort weiter",
        "wartete " + wartet + " · " + zurueck.map(x => x ? (x.p ? "p" : "") + x.f : "-").join(" "));
    }
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    const { ctx, s } = await oeffnen(browser, "chocolamour", "#/entdecken", { ruhig:true });
    const SEL = '#frKnoepfe .fr-knopf.haupt .bz';
    const spur = await verlauf(s, SEL, 4000);
    const da = spur.filter(Boolean).length;
    pruef(!da || spur.every(x => !x || x.p), "Bewegung reduzieren: kein Film läuft", da ? spur.map(x => x ? (x.p ? "p" : "") + x.f : "-").join(" ") : "kein Film geladen");
    await ctx.close();
  }

  console.log("\n══ Symmetrie: gemessen, nicht angesehen ══");
  /* Toleranz 1 px. Jede Probe misst die Stelle selbst UND stellt vorher
     fest, dass es sie gibt (§8.1g C: „nichts da“ sieht aus wie „passt“). */
  for (const breite of [360, 430]) {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/speisekarte", { bilder:true, breite });
    const ecke = await s.evaluate(() => {
      const z = document.querySelector(".gericht.gmitbild");
      if (!z) return null;
      const b = z.querySelector(".gbild").getBoundingClientRect(), k = z.querySelector(".gplus").getBoundingClientRect();
      return { rechts:+(b.right - k.right).toFixed(1), unten:+(b.bottom - k.bottom).toFixed(1) };
    });
    pruef(!!ecke, breite + "px: eine Gerichtzeile mit Foto ist da", JSON.stringify(ecke));
    if (ecke) pruef(Math.abs(ecke.rechts - ecke.unten) <= 1,
      breite + "px: „+“ sitzt gleich weit von rechter und unterer Bildkante", "rechts " + ecke.rechts + ", unten " + ecke.unten);
    await (await s.$(".gericht.gmitbild .gplus")).click();
    await s.waitForTimeout(700);
    const regler = await s.evaluate(() => {
      const m = document.querySelector(".gericht.gmitbild .gmenge");
      if (!m) return null;
      const [minus, plus] = m.querySelectorAll("button"), z = m.querySelector(".gmz").getBoundingClientRect();
      const a = minus.getBoundingClientRect(), c = plus.getBoundingClientRect();
      return { bMinus:+a.width.toFixed(1), bPlus:+c.width.toFixed(1),
               mitte:+((a.left + a.width / 2 + c.left + c.width / 2) / 2 - (z.left + z.width / 2)).toFixed(1),
               hoch:+(m.getBoundingClientRect().top + m.getBoundingClientRect().height / 2 - (z.top + z.height / 2)).toFixed(1) };
    });
    pruef(!!regler, breite + "px: der Regler steht nach dem Tippen da");
    if (regler) {
      pruef(regler.bMinus === regler.bPlus, breite + "px: − und + gleich breit", regler.bMinus + " / " + regler.bPlus);
      pruef(Math.abs(regler.mitte) <= 1 && Math.abs(regler.hoch) <= 1, breite + "px: die Zahl steht mittig zwischen − und +",
        "waagrecht " + regler.mitte + ", senkrecht " + regler.hoch);
    }
    await s.goto(HUB("chocolamour") + "#/speisekarte"); await s.waitForTimeout(1200);
    const chip = await s.evaluate(() => {
      const c = document.querySelector(".chip.mitbz");
      if (!c) return null;
      const e = c.querySelector(".bz").getBoundingClientRect(), t = c.querySelector("span:last-child").getBoundingClientRect();
      return +((e.top + e.height / 2) - (t.top + t.height / 2)).toFixed(1);
    });
    pruef(chip !== null && Math.abs(chip) <= 1.5, breite + "px: Chip-Emoji und Wort auf einer Mittellinie", chip);
    await s.goto(HUB("chocolamour") + "#/entdecken"); await s.waitForTimeout(1200);
    const rad = await s.evaluate(() => {
      const r = document.getElementById("frRad"), z = document.getElementById("frZeiger"), m = document.querySelector(".fr-mitte");
      const seite = document.querySelector(".fr-seite");
      if (!r || !z || !m || !seite) return null;
      const a = r.getBoundingClientRect(), b = seite.getBoundingClientRect(), c = z.getBoundingClientRect(), d = m.getBoundingClientRect();
      return { links:+(a.left - b.left).toFixed(1), rechts:+(b.right - a.right).toFixed(1),
               zeiger:+((c.left + c.width / 2) - (a.left + a.width / 2)).toFixed(1),
               knopf:+((d.left + d.width / 2) - (a.left + a.width / 2)).toFixed(1),
               knopfH:+((d.top + d.height / 2) - (a.top + a.height / 2)).toFixed(1) };
    });
    pruef(!!rad, breite + "px: Rad, Zeiger und Mittelknopf da");
    if (rad) {
      pruef(Math.abs(rad.links - rad.rechts) <= 1, breite + "px: Rad mit gleichem Rand links und rechts", rad.links + " / " + rad.rechts);
      pruef(Math.abs(rad.zeiger) <= 1 && Math.abs(rad.knopf) <= 1 && Math.abs(rad.knopfH) <= 1,
        breite + "px: Zeiger und „Drehen“ genau auf der Mitte des Rads", "Zeiger " + rad.zeiger + ", Knopf " + rad.knopf + "/" + rad.knopfH);
    }
    await s.evaluate(() => frDrehen());
    await s.waitForTimeout(3800);
    const kn = await s.evaluate(() => {
      const f = document.getElementById("frFlaeche"), k = [...document.querySelectorAll("#frKnoepfe .fr-knopf")].map(x => x.getBoundingClientRect());
      if (!f || k.length !== 2) return null;
      const r = f.getBoundingClientRect();
      return { a:+k[0].width.toFixed(1), b:+k[1].width.toFixed(1), l:+(k[0].left - r.left).toFixed(1), r:+(r.right - k[1].right).toFixed(1) };
    });
    pruef(!!kn && kn.a === kn.b && Math.abs(kn.l - kn.r) <= 1,
      breite + "px: „Nochmal drehen“ und „Das nehme ich“ gleich breit, gleich weit vom Rand", JSON.stringify(kn));
    await s.evaluate(() => feiern()); await s.waitForTimeout(450);
    const fe = await s.evaluate(() => {
      const f = document.querySelector(".feier"); if (!f) return null;
      const r = f.getBoundingClientRect();
      return { mitte:+((r.left + r.right) / 2 - innerWidth / 2).toFixed(1), links:+r.left.toFixed(1), rechts:+(innerWidth - r.right).toFixed(1) };
    });
    pruef(!!fe && Math.abs(fe.mitte) <= 1 && fe.links >= 15 && fe.rechts >= 15,
      breite + "px: Feier waagrecht mittig, nie am Rand", JSON.stringify(fe));
    pruef(!fehler.length, breite + "px: keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    /* Die längste Übersetzung des Feiersatzes, bei 320 px */
    const { ctx, s } = await oeffnen(browser, "chocolamour", "#/speisekarte", { breite:320 });
    const lang = await s.evaluate(() => {
      const e = (typeof TEXTE !== "undefined" && TEXTE["Unser Vorschlag"]) || {};
      return Object.values(e).sort((a, b) => b.length - a.length)[0] || "";
    });
    await s.evaluate(txt => { feiern(); document.querySelector(".feier b").textContent = txt; }, lang);
    await s.waitForTimeout(450);
    const r = await s.evaluate(() => { const f = document.querySelector(".feier").getBoundingClientRect(); return { l:f.left, r:innerWidth - f.right }; });
    pruef(lang.length > 0, "320px: längste Übersetzung des Feiersatzes gefunden", lang);
    pruef(r.l >= 15 && r.r >= 15, "320px: auch sie bleibt im Bild", Math.round(r.l) + " / " + Math.round(r.r));
    await ctx.close();
  }

  console.log("\n══ Fluss: Bilder pro Sekunde ══");
  for (const [was, hash, tun] of [
      ["Drehen des Rads", "#/entdecken", () => { frDrehen(); }],
      ["Flug in den Korb", "#/speisekarte", () => { document.querySelector(".gplus").click(); }]]) {
    const { ctx, s } = await oeffnen(browser, "chocolamour", hash);
    const m = await s.evaluate(`(async () => { const mess = (${FLUSS.toString()})(700); (${tun.toString()})(); return await mess; })()`);
    pruef(m.luecke <= 50, was + ": keine Lücke über 50 ms zwischen zwei Bildern",
      m.fps + " Bilder/s, größte Lücke " + m.luecke + " ms");
    await ctx.close();
  }


  console.log("\n══ Karten wischen — die zweite Art neben dem Rad (Umschalter) ══");
  /* Seit 09.10. wieder da (Wunsch: Rad UND Karten, umschaltbar). Die
     Proben sind die vom 08.10., geöffnet mit gemerkter Art „karten“ —
     dieselbe Voraussetzung, die ein Gast nach dem Umschalten hat. */
  const KARTEN = () => { try{ ["chocolamour","blend","minhkeey"].forEach(h => localStorage.setItem("omoteno-fr-modus-" + h, "karten")); }catch(e){} };
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/entdecken", { vorher:KARTEN });
    const oben = () => s.$('#edStapel .ed-karte[data-tiefe="0"]');
    const wisch = async richtung => {
      const b = await (await oben()).boundingBox();
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      await s.mouse.move(x, y); await s.mouse.down();
      for (let i = 1; i <= 14; i++) await s.mouse.move(x + richtung * i * 10, y + i);
      await s.mouse.up(); await s.waitForTimeout(500);
    };
    pruef(!!(await oben()), "der Stapel liegt, oberste Karte greifbar");
    const name0 = await s.evaluate(() => decodeURIComponent(document.querySelector('#edStapel .ed-karte[data-tiefe="0"]').dataset.ed));
    await wisch(1);
    pruef(await s.evaluate(n => !!merk[n], name0), "nach rechts gewischt → in der Auswahl", name0);
    const name1 = await s.evaluate(() => decodeURIComponent(document.querySelector('#edStapel .ed-karte[data-tiefe="0"]').dataset.ed));
    await wisch(-1);
    pruef(await s.evaluate(n => !merk[n] && edPos === 2, name1), "nach links gewischt → weiter, nicht in der Auswahl", name1);
    await s.keyboard.press("ArrowRight"); await s.waitForTimeout(450);
    await s.click('[data-ed-wahl="ja"]'); await s.waitForTimeout(350);
    const lob = await s.evaluate(() => ({ lob: !!document.querySelector(".ed-lob"), ja: edJa }));
    pruef(lob.ja === 3 && lob.lob, "Taste → und Knopf zählen, die dritte Wahl gibt Lob", JSON.stringify(lob));
    await s.evaluate(() => { edPos = edStapel.length - 1; edNeuZeichnen(); });
    await s.click('[data-ed-wahl="nein"]'); await s.waitForTimeout(450);
    pruef(await s.evaluate(() => !!document.querySelector(".ed-ende")), "am Ende: Abschluss statt leerer Fläche");
    await s.click("[data-ed-neu]"); await s.waitForTimeout(300);
    pruef(await s.evaluate(() => edPos === 0 && !!document.querySelector("#edStapel")), "„Nochmal mischen“ beginnt von vorn");
    pruef(await s.evaluate(() => edStapel.every(n => !merk[n])), "was schon in der Auswahl liegt, kommt nicht erneut");
    const ueber = await s.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    pruef(ueber <= 1, "kein seitliches Schieben", ueber + "px");
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    const { ctx, s } = await oeffnen(browser, "chocolamour", "#/entdecken", { ruhig:true, vorher:KARTEN });
    const b = await (await s.$('#edStapel .ed-karte[data-tiefe="0"]')).boundingBox();
    await s.mouse.move(b.x + 100, b.y + 100); await s.mouse.down();
    for (let i = 1; i <= 5; i++) await s.mouse.move(b.x + 100 + i * 10, b.y + 100);
    const tf = await s.evaluate(() => document.querySelector('#edStapel .ed-karte[data-tiefe="0"]').style.transform);
    await s.mouse.up();
    pruef(/rotate\(0deg\)/.test(tf), "Bewegung reduzieren: die Karte folgt, neigt sich aber nicht", tf);
    await ctx.close();
  }
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/entdecken", { vorher:KARTEN });
    const SEL = '#edStapel .ed-karte[data-tiefe="0"] .ed-emo .bz';
    const spur = await verlauf(s, SEL, 9000);
    const da = spur.filter(Boolean).length;
    pruef(da > spur.length * .9, "Karten wischen: der Film der obersten Karte ist da", da + " von " + spur.length + " Proben");
    if (da) {
      const n = anlaeufe(spur);
      pruef(n >= 2, "Karten wischen: nach dem ersten Durchlauf spielt der Film WIEDER (≥ 2 neue Anläufe in 9 s)",
        n + " Anläufe · " + spur.map(x => x ? (x.p ? "p" : "") + x.f : "-").join(" ").slice(0, 160));
      const laeuft = spur.filter(x => x && !x.p).length / da;
      pruef(laeuft >= .5, "Karten wischen: der Film läuft die meiste Zeit (Pausen kurz)", Math.round(laeuft * 100) + " % der Proben spielend");
    }
    const schwebt = await s.evaluate(sel => {
      const e = document.querySelector(sel); if (!e) return null;
      const emo = e.closest(".ed-emo");
      return getComputedStyle(emo).animationName;
    }, SEL);
    pruef(schwebt === "edSchweben", "Karten wischen: das Zeichen der obersten Karte schwebt", schwebt);
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    const { ctx, s } = await oeffnen(browser, "chocolamour", "#/entdecken", { ruhig:true, vorher:KARTEN });
    const SEL = '#edStapel .ed-karte[data-tiefe="0"] .ed-emo .bz';
    const spur = await verlauf(s, SEL, 4000);
    const da = spur.filter(Boolean).length;
    pruef(!da || spur.every(x => !x || x.p), "Bewegung reduzieren: kein Film läuft", da ? spur.map(x => x ? (x.p ? "p" : "") + x.f : "-").join(" ") : "kein Film geladen");
    const schwebt = await s.evaluate(() => { const e = document.querySelector('#edStapel .ed-karte[data-tiefe="0"] .ed-emo'); return e ? getComputedStyle(e).animationName : null; });
    pruef(schwebt === "none", "Bewegung reduzieren: das Zeichen schwebt nicht", schwebt);
    await ctx.close();
  }
  for (const breite of [360, 430]) {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/speisekarte", { breite });
    await s.evaluate(() => { location.hash = "#/entdecken"; }); await s.waitForTimeout(600); await s.evaluate(() => frModusSetzen("karten", true)); await s.waitForTimeout(500);
    const ed = await s.evaluate(() => {
      const st = document.getElementById("edStapel"), k = document.querySelector('#edStapel .ed-karte[data-tiefe="0"]');
      const kn = [...document.querySelectorAll(".ed-knopf")].map(b => b.getBoundingClientRect());
      if (!st || !k || kn.length !== 2) return null;
      const r = st.getBoundingClientRect(), kr = k.getBoundingClientRect();
      const ja = getComputedStyle(k.querySelector(".ed-stempel.ja")), nein = getComputedStyle(k.querySelector(".ed-stempel.nein"));
      const winkel = cs => Math.round(Math.atan2(new DOMMatrixReadOnly(cs.transform).b, new DOMMatrixReadOnly(cs.transform).a) * 180 / Math.PI);
      return { links:+r.left.toFixed(1), rechts:+(innerWidth - r.right).toFixed(1),
               knopfA:+kn[0].width.toFixed(1), knopfB:+kn[1].width.toFixed(1),
               knopfL:+(kn[0].left - r.left).toFixed(1), knopfR:+(r.right - kn[1].right).toFixed(1),
               stJa:ja.right, stNein:nein.left, stTop:[ja.top, nein.top], wJa:winkel(ja), wNein:winkel(nein) };
    });
    pruef(!!ed, breite + "px: Entdecken-Stapel und beide Knöpfe da");
    if (ed) {
      pruef(Math.abs(ed.links - ed.rechts) <= 1, breite + "px: Stapel mit gleichem Rand links und rechts", ed.links + " / " + ed.rechts);
      pruef(ed.knopfA === ed.knopfB && Math.abs(ed.knopfL - ed.knopfR) <= 1,
        breite + "px: „Weiter“ und „Das nehme ich“ gleich breit, gleich weit vom Rand", ed.knopfA + "/" + ed.knopfB + ", " + ed.knopfL + "/" + ed.knopfR);
      pruef(ed.stJa === ed.stNein && ed.stTop[0] === ed.stTop[1] && ed.wJa === -ed.wNein,
        breite + "px: Stempel spiegelbildlich", ed.stJa + "/" + ed.stNein + ", " + ed.wJa + "°/" + ed.wNein + "°");
    }
    pruef(!fehler.length, breite + "px: keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/entdecken", { vorher:KARTEN });
    /* Nachrücken: dasselbe Element rückt vor, und es LÄUFT dabei eine
       Transition — ein neu gebautes Element hätte keine. */
    const nach = await s.evaluate(async () => {
      const zweite = document.querySelector('#edStapel .ed-karte[data-tiefe="1"]');
      if (!zweite) return null;
      edWaehlen(false);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const oben = document.querySelector('#edStapel .ed-karte[data-tiefe="0"]');
      const weg = document.querySelector('#edStapel .ed-karte[data-tiefe="weg"]');
      return { gleich: oben === zweite,
               transition: zweite.getAnimations().some(a => a.constructor.name === "CSSTransition"),
               wegOhneTransition: weg ? !weg.getAnimations().some(a => a.constructor.name === "CSSTransition") : null,
               karten: document.querySelectorAll('#edStapel .ed-karte:not([data-tiefe="weg"])').length };
    });
    pruef(!!nach, "eine zweite Karte liegt bereit");
    if (nach) {
      pruef(nach.gleich, "nach der Wahl ist die zweite Karte DASSELBE Element, jetzt oben");
      pruef(nach.transition, "sie rückt mit einer laufenden Transition nach, statt zu springen");
      pruef(nach.wegOhneTransition === true, "die fliegende Karte trägt keine Transition, die ihren Flug überdecken würde", nach.wegOhneTransition);
      pruef(nach.karten === 3, "hinten ist eine neue dritte Karte nachgelegt", nach.karten);
    }
    await s.waitForTimeout(500);
    /* Wurf mit Fingertempo: Nach dem Loslassen darf die Karte nicht
       langsamer werden als der Finger war. */
    const wurf = await s.evaluate(async () => {
      const k = document.querySelector('#edStapel .ed-karte[data-tiefe="0"]');
      const b = k.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
      const ev = (typ, px) => k.dispatchEvent(new PointerEvent(typ, { clientX:px, clientY:y, pointerId:7, bubbles:true, isPrimary:true }));
      ev("pointerdown", x);
      const zeiten = [];
      for (let i = 1; i <= 8; i++){ await new Promise(r => setTimeout(r, 16)); zeiten.push(performance.now()); document.dispatchEvent(new PointerEvent("pointermove", { clientX:x + i * 16, clientY:y, pointerId:7, bubbles:true })); }
      /* Das echte Fingertempo der letzten Züge, nicht das beabsichtigte */
      const fingerTempo = +(16 * 4 / (zeiten[7] - zeiten[3])).toFixed(2);
      const vor = k.getBoundingClientRect().left;
      document.dispatchEvent(new PointerEvent("pointerup", { clientX:x + 128, clientY:y, pointerId:7, bubbles:true }));
      /* Über die ersten drei Bilder nach dem Loslassen gemessen: Ein
         Bild Stillstand (eine noch wartende Animation) fiele hier auf. */
      const t0 = performance.now();
      for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
      const t1 = performance.now(), nachher = k.getBoundingClientRect().left;
      return { finger:fingerTempo, karte:+((nachher - vor) / (t1 - t0)).toFixed(2) };
    });
    await s.waitForTimeout(500);
    /* 1:1 am Finger: Nach einem Zug steht die Karte im NÄCHSTEN Bild
       dort, wo der Finger ist — nicht auf dem Weg dorthin. Eine
       CSS-Transition auf transform (0,28 s) ließe sie nachhinken. */
    const folgt = await s.evaluate(async () => {
      const k = document.querySelector('#edStapel .ed-karte[data-tiefe="0"]');
      const b = k.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
      k.dispatchEvent(new PointerEvent("pointerdown", { clientX:x, clientY:y, pointerId:9, bubbles:true, isPrimary:true }));
      document.dispatchEvent(new PointerEvent("pointermove", { clientX:x + 20, clientY:y, pointerId:9, bubbles:true }));
      document.dispatchEvent(new PointerEvent("pointermove", { clientX:x + 60, clientY:y, pointerId:9, bubbles:true }));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const m = new DOMMatrixReadOnly(getComputedStyle(k).transform);
      document.dispatchEvent(new PointerEvent("pointerup", { clientX:x + 60, clientY:y, pointerId:9, bubbles:true }));
      return { soll:60, ist:+m.m41.toFixed(1) };
    });
    pruef(Math.abs(folgt.ist - folgt.soll) <= 1, "die Karte folgt dem Finger ohne Verzug", "Finger +" + folgt.soll + " px, Karte +" + folgt.ist + " px");
    pruef(wurf.karte >= wurf.finger * .8, "die Karte fliegt mit mindestens dem Fingertempo weiter",
      "Finger " + wurf.finger + " px/ms, Karte " + wurf.karte + " px/ms");
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    const { ctx, s } = await oeffnen(browser, "chocolamour", "#/entdecken", { vorher:KARTEN });
    const tun = () => { edWaehlen(true); };
    const m = await s.evaluate(`(async () => { const mess = (${FLUSS.toString()})(700); (${tun.toString()})(); return await mess; })()`);
    pruef(m.luecke <= 50, "Wurf und Nachrücken: keine Lücke über 50 ms zwischen zwei Bildern",
      m.fps + " Bilder/s, größte Lücke " + m.luecke + " ms");
    await ctx.close();
  }

  console.log("\n══ Entscheidungshilfe über der Speisekarte ══");
  {
    const { ctx, s, fehler } = await oeffnen(browser, "chocolamour", "#/speisekarte");
    /* Ganz oben: seit 10.10. ÜBER dem Titel („über dem Text ‚Unsere
       Speisekarte‘“) — erstes Element der Seite, danach der Titel. */
    const ort = await s.evaluate(() => {
      const cta = document.querySelector(".eh-cta"), such = document.querySelector(".suche");
      return { da: !!cta, vorSuche: !!cta && !!such && !!(cta.compareDocumentPosition(such) & Node.DOCUMENT_POSITION_FOLLOWING),
               erstes: !!cta && cta.parentElement.firstElementChild === cta,
               danach: cta && cta.nextElementSibling && cta.nextElementSibling.tagName.toLowerCase() };
    });
    pruef(ort.da && ort.vorSuche && ort.erstes && ort.danach === "h2",
      "der Knopf steht ganz oben in der Speisekarte, über dem Titel", JSON.stringify(ort));
    const kn = await s.evaluate(() => document.querySelectorAll(".eh-cta .eh-knopf").length);
    pruef(kn === 1 && !(await s.evaluate(() => /Karten wischen|Swipe cards/.test(document.body.innerText))),
      "in der Speisekarte EIN Knopf: „Für mich entscheiden“ (Karten wischen über den Umschalter)", kn);
    const start = await s.evaluate(() => { location.hash = "#/"; return new Promise(r => setTimeout(() => r(!!document.querySelector(".eh-cta, .ed-cta")), 500)); });
    pruef(!start, "auf der Startseite steht er nicht mehr doppelt");
    await s.evaluate(() => { location.hash = "#/speisekarte"; }); await s.waitForTimeout(500);

    /* Für mich entscheiden: Seite wechselt, das Rad dreht OHNE weiteren
       Tipp, danach liegt EIN bestellbares Gericht oben. Zweite Quelle:
       die Karte selbst. */
    await s.evaluate(() => localStorage.setItem(PROBIERT_SCHLUESSEL, JSON.stringify(["Family Love"])));
    await s.click("[data-eh-los]");
    await s.waitForTimeout(300);
    const mitten = await s.evaluate(() => ({ seite: seiteJetzt, dreht: frDreht,
      laeuft: document.getElementById("frScheibe").getAnimations().some(a => a.playState === "running") }));
    pruef(mitten.seite === "entdecken" && mitten.dreht && mitten.laeuft, "„Für mich entscheiden“ öffnet das Rad und es dreht sich sofort", JSON.stringify(mitten));
    await s.waitForTimeout(3700);
    const wahl = await s.evaluate(() => {
      const w = document.getElementById("frErgebnis"), k = document.querySelector("#frKnoepfe [data-eh-nehm]");
      if (!w || !k) return null;
      const name = decodeURIComponent(k.dataset.ehNehm), g = findeGericht(name);
      return { name, dreht: frDreht, bestellbar: !!g && g.p !== "–",
               gezeigt: w.querySelector(".fr-name").textContent === t(name), neu: !!w.querySelector(".eh-neu"),
               probiert: name === "Family Love" };
    });
    pruef(!!wahl && !wahl.dreht && wahl.bestellbar && wahl.gezeigt, "danach steht EIN bestellbares Gericht oben, Name stimmt", wahl && wahl.name);
    pruef(!!wahl && wahl.neu !== wahl.probiert, "„Neu für Sie“ genau dann, wenn es nicht schon bestellt wurde", JSON.stringify(wahl));
    /* Details öffnet das echte Blatt des Gerichts */
    await s.click("#frErgebnis .eh-details"); await s.waitForTimeout(500);
    const blatt = await s.evaluate(() => ({ offen: document.body.classList.contains("fest"), name: detailName }));
    pruef(blatt.offen && blatt.name === wahl.name, "„Details“ öffnet das Blatt genau dieses Gerichts (dort die Allergene)", JSON.stringify(blatt));
    await s.keyboard.press("Escape"); await s.waitForTimeout(400);
    await s.evaluate(() => { if (document.body.classList.contains("fest")) { const z = document.querySelector("[data-zu], .warenkarte-zu"); if (z) z.click(); } });
    await s.waitForTimeout(300);
    /* „Das nehme ich“ legt in den Korb; der Knopf wird zu „Auswahl ansehen“ */
    await s.evaluate(() => document.querySelector("[data-eh-nehm]").click());
    await s.waitForTimeout(600);
    const genommen = await s.evaluate(n => ({ imKorb: !!merk[n], nehm: !!document.querySelector("#frKnoepfe [data-eh-nehm]"),
      ansehen: !!document.querySelector('#frKnoepfe a[href="#/auswahl"]') }), wahl.name);
    pruef(genommen.imKorb && !genommen.nehm && genommen.ansehen, "„Das nehme ich“ legt es in den Korb, danach „Auswahl ansehen“", JSON.stringify(genommen));

    /* Lust: nur noch Gerichte dieser Kategorie — gegen gerichtOrt gehalten */
    const lust = await s.evaluate(async () => {
      const c = [...document.querySelectorAll("[data-eh-lust]")].find(x => x.dataset.ehLust);
      if (!c) return null;
      const w = decodeURIComponent(c.dataset.ehLust);
      c.click(); await new Promise(r => setTimeout(r, 300));
      const falsch = frFelder.filter(n => { const o = gerichtOrt(n); return !o || o.karte + "|" + o.gruppe !== w; });
      return { w, n: frFelder.length, felder: document.querySelectorAll("#frScheibe .fr-feld").length, falsch,
               an: document.querySelector('[data-eh-lust="' + c.dataset.ehLust + '"]').classList.contains("an") };
    });
    pruef(!!lust && lust.n > 0 && lust.felder === lust.n && !lust.falsch.length && lust.an, "Lust-Chip: das Rad trägt nur noch Gerichte dieser Kategorie", lust && (lust.w + ", " + lust.n + " Felder"));
    /* Neues zuerst: Alles bis auf drei gilt als schon bestellt — dann
       MÜSSEN genau diese drei auf dem Rad stehen (ohne die Regel landen
       sie zufällig unter 30+ Kandidaten). */
    const reihe = await s.evaluate(() => {
      edLust = ""; const alle = edKandidaten().map(e => e.n);
      const neu = alle.slice(0, 3);
      localStorage.setItem(PROBIERT_SCHLUESSEL, JSON.stringify(alle.slice(3)));
      frFuellen();
      return { fehlt: neu.filter(n => !frFelder.includes(n)), soll: neu.join(" | "), kandidaten: alle.length };
    });
    pruef(reihe.kandidaten > 30 && !reihe.fehlt.length, "Neues kommt aufs Rad, vor schon Bestelltem",
      reihe.soll + " (von " + reihe.kandidaten + ")");
    /* Ohne Bestellhistorie ist nichts „neu“ — sonst sagte die Marke nichts */
    const leer = await s.evaluate(() => { localStorage.removeItem(PROBIERT_SCHLUESSEL); frFuellen();
      return frFelder.filter(n => ehMarkenHTML(findeGericht(n)).includes("eh-neu")).length; });
    pruef(leer === 0, "ohne Bestellung vorher steht nirgends „Neu für Sie“", leer);
    pruef(!fehler.length, "keine Ausnahme", fehler.join("|") || "still");
    await ctx.close();
  }
  {
    /* Bewegung reduzieren: Die Wahl steht sofort, keine Drehung */
    const { ctx, s } = await oeffnen(browser, "chocolamour", "#/speisekarte", { ruhig:true });
    await s.click("[data-eh-los]"); await s.waitForTimeout(300);
    const r = await s.evaluate(() => ({ wahl: frErgebnis, dreht: frDreht,
      anim: document.getElementById("frScheibe").getAnimations().length }));
    pruef(!!r.wahl && !r.dreht && r.anim === 0, "Bewegung reduzieren: die Wahl steht sofort da, ohne Drehung", JSON.stringify(r));
    await ctx.close();
  }
  {
    /* Die Bestellung merkt sich, was probiert wurde */
    const { ctx, s } = await oeffnen(browser, "chocolamour", "#/speisekarte");
    await s.evaluate(() => { try{ bestellStopp = () => null; }catch(e){} });
    const n = await s.evaluate(() => document.querySelector(".gplus").dataset.merk);
    await (await s.$(".gplus")).click(); await s.waitForTimeout(500);
    await s.evaluate(() => { location.hash = "#/auswahl"; }); await s.waitForTimeout(500);
    const feld = await s.$("#bTisch"); if (feld) await feld.fill("7");
    await s.evaluate(() => { try{ bestellSperre = 0; }catch(e){} });
    const knopf = await s.$('[data-aktion="bestellen"]');
    if (knopf) { await knopf.click(); await s.waitForTimeout(800); }
    const p = await s.evaluate(() => probiertLaden());
    pruef(!!knopf && p.includes(decodeURIComponent(n)), "nach dem Abschicken steht das Gericht in „probiert“", JSON.stringify(p));
    await ctx.close();
  }

  console.log("\n══ Feiern nach dem Abschicken ══");
  for (const ruhig of [false, true]) {
    const { ctx, s } = await oeffnen(browser, "chocolamour", "#/speisekarte", { ruhig });
    await s.evaluate(() => { try{ bestellStopp = () => null; }catch(e){} });
    await (await s.$$(".gplus"))[0].click(); await s.waitForTimeout(700);
    await s.evaluate(() => { location.hash = "#/auswahl"; }); await s.waitForTimeout(400);
    const feld = await s.$("#bTisch"); if (feld) await feld.fill("7");
    await s.evaluate(() => { try{ bestellSperre = 0; }catch(e){} });
    await s.click('[data-aktion="bestellen"]'); await s.waitForTimeout(500);
    const jetzt = await s.evaluate(() => ({ seite: seiteJetzt, feier: !!document.querySelector(".feier"),
      konf: document.querySelectorAll(".konfetti").length }));
    await s.waitForTimeout(2600);
    const danach = await s.evaluate(() => ({ feier: !!document.querySelector(".feier"), konf: document.querySelectorAll(".konfetti").length }));
    const art = ruhig ? "Bewegung reduzieren" : "normal";
    pruef(jetzt.seite === "bestellt" && jetzt.feier, art + ": nach dem Abschicken erscheint die Feier");
    pruef(ruhig ? jetzt.konf === 0 : jetzt.konf > 20, art + ": Konfetti " + (ruhig ? "bleibt aus" : "fliegt"), jetzt.konf);
    pruef(!danach.feier && !danach.konf, art + ": danach ist alles wieder weg", JSON.stringify(danach));
    await s.evaluate(() => { location.hash = "#/speisekarte"; location.hash = "#/bestellt"; });
    await s.waitForTimeout(400);
    pruef(!(await s.evaluate(() => !!document.querySelector(".feier"))), art + ": ein späterer Besuch des Passes feiert nicht erneut");
    await ctx.close();
  }

  console.log("\n══ Board: Schalter schreibt hub_stil ══");
  {
    const ctx = await browser.newContext({ viewport:{ width:390, height:900 } });
    const s = await ctx.newPage();
    await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await s.goto("file://" + ADMIN); await s.waitForTimeout(600);
    const r = await s.evaluate(async () => {
      document.getElementById("tor").hidden = true;
      const log = [];
      demo = false; betriebId = "b1";
      meineBetriebe = [{ id:"b1", hub_stil:null, markenblatt:{} }];
      db = { from: t => ({ update: w => ({ eq: (a, b) => { log.push([t, w, a, b]); return Promise.resolve({ error:null }); } }) }) };
      stilEmoji = stilEmojiAus(meineBetriebe[0]); stilZeichnen();
      const vorher = document.getElementById("stilAn").getAttribute("aria-pressed");
      await stilUmschalten();
      return { vorher, nachher: document.getElementById("stilAn").getAttribute("aria-pressed"), log,
               strikt: stilEmojiAus({ hub_stil:{ emoji:"false" } }), mb: stilEmojiAus({ markenblatt:{ bewegteZeichen:false } }) };
    });
    pruef(r.vorher === "true" && r.nachher === "false", "Schalter steht an und kippt auf aus");
    pruef(r.log.length === 1 && r.log[0][0] === "betriebe" && r.log[0][1].hub_stil && r.log[0][1].hub_stil.emoji === false,
      "schreibt betriebe.hub_stil = {emoji:false}", JSON.stringify(r.log[0] && r.log[0][1]));
    pruef(r.strikt === true && r.mb === false, "dieselbe Rangfolge wie der Hub (strikt boolean, dann Markenblatt)");
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
  console.log("Alles sauber.");
})();
