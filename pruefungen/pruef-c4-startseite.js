/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Gast-Hub gestalten · Startseite, Block C4 (02.11.)
   Aufbau, Kacheln, Banner-Rad, Willkommen-Animation — je drei neue Funktionen.

     NODE_PATH=$(npm root -g) node pruefungen/pruef-c4-startseite.js   (braucht dist/)
     ADMIN_DATEI=… / HUB_DIST=… für Gegenbeweise auf Kopien, HUB_BASIS=… (dist des alten Stands) für den Bytevergleich

   Keine Migration: Alles lebt in hub_bloecke (Textblock von/bis), hub_kacheln (neuBis, zeigenAb), hub_banner (von, bis)
   und hub_stil (bannerTakt, ladeMix, ladeAbend). Die Uhr steht fest (§8.1j); „heute“ ist der 10.10.2026.
   Hub: ohne neue Felder wie der alte Stand (HUB_BASIS), ungültige Tage/Werte zeigen wie ohne; Zeitraum mit
   Grenztagen einschließlich; „Neu“-Plakette bis zum Tag und lesbar; Kachel ruht bis zum Tag davor; Banner nur in
   seiner Laufzeit; Takt blättert, hält bei Berührung dauerhaft, nicht außer Sicht, nicht bei reduzierter Bewegung,
   ein Neuzeichnen macht keinen zweiten Takt; Szene am Abend, Zufall nur aus der Auswahl.
   Board: Duplizieren (Block/Kachel/Banner, mit Grenze), Vorlagen ordnen nur den Entwurf, Datumsfelder 16 px,
   Nutzlast je Spalte, hub_stil frisch gelesen und zusammengeführt, 0 Zeilen → Satz, „Nochmal abspielen“ baut die
   Szene im echten Hub neu, 360/1280 px ohne Überlauf, Knöpfe ≥ 44 px.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { oeffneHub, EIMER, BETRIEB, BILD } = require("./werkzeug/start-hub");
const { gruppeZu } = require("./werkzeug/zentrale");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");
const DIST = process.env.HUB_DIST || path.join(OBEN, "dist");
const BASIS_DIST = process.env.HUB_BASIS || "";
const BASIS = "https://omoteno.test/h/";
const HEUTE = "2026-10-10";
const uhr = (tag, zeit) => tag + "T" + (zeit || "14:00:00");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + (typeof d === "string" ? d : JSON.stringify(d)).slice(0, 240) : ""));
}
const lum = c => { const m = String(c).match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const bild = n => EIMER + BETRIEB + "/banner/" + n + ".jpg";
const BANNER3 = [{ id: "a", bild: bild("a"), titel: "Eins", zielTyp: "seite", zielWert: "speisekarte", reihenfolge: 0 },
                 { id: "b", bild: bild("b"), titel: "Zwei", zielTyp: "seite", zielWert: "speisekarte", reihenfolge: 1 },
                 { id: "c", bild: bild("c"), titel: "Drei", zielTyp: "seite", zielWert: "speisekarte", reihenfolge: 2 }];
const KACHELN = [{ schluessel: "speisekarte" }, { schluessel: "getraenke" }, { schluessel: "kontakt" }, { schluessel: "bewertung" }];
const stand = p => p.evaluate(() => ({ inhalt: document.getElementById("inhalt").innerHTML }));

(async () => {
  const browser = await chromium.launch();
  const auf = (o) => oeffneHub(browser, Object.assign({ dist: DIST, haus: "blend" }, o));

  console.log("\n══ 1 · Ohne neue Felder wie vorher, ungültige Werte zeigen wie ohne ══");
  if (BASIS_DIST) {
    for (const haus of ["chocolamour", "blend", "nordstern", "minhkeey", "piugusto"]) {
      const a = await auf({ haus }); const s1 = await stand(a.p); await a.ctx.close();
      const b = await auf({ haus, dist: BASIS_DIST }); const s0 = await stand(b.p); await b.ctx.close();
      pruef(s1.inhalt.length > 200 && s1.inhalt === s0.inhalt, haus + ": Startseite Zeichen für Zeichen wie der alte Stand");
    }
  } else console.log("  (HUB_BASIS fehlt — Vergleich mit dem alten Stand übersprungen)");
  {
    const kGut = KACHELN.map(k => Object.assign({}, k)), bGut = BANNER3.slice(0, 2);
    const blockGut = [{ id: "eigen-ab12", titel: "Herbstwoche", text: "Kürbis überall." }];
    const a = await auf({ hubKacheln: kGut, banner: bGut, bloecke: blockGut }); const s1 = await stand(a.p); await a.ctx.close();
    const kSchlecht = KACHELN.map(k => Object.assign({}, k, { neuBis: "2026-02-31", zeigenAb: "morgen" }));
    const bSchlecht = bGut.map(x => Object.assign({}, x, { von: "2026-13-01", bis: "10.10.2026" }));
    const blockSchlecht = [{ id: "eigen-ab12", titel: "Herbstwoche", text: "Kürbis überall.", von: "2026-1-1", bis: 20261231 }];
    const b = await auf({ hubKacheln: kSchlecht, banner: bSchlecht, bloecke: blockSchlecht,
      hubstil: { bannerTakt: "5", ladeMix: "cafe", ladeAbend: "__proto__" } });
    const s2 = await stand(b.p); const z = await b.p.evaluate(() => [bannerTakt(), wzMixAus(HUBSTIL).length]); await b.ctx.close();
    pruef(s1.inhalt.length > 200 && s1.inhalt === s2.inhalt, "ungültige Tage (31.02., „morgen“, Monat 13, deutsches Datum, Zahl) zeigen wie ohne Feld");
    pruef(z[0] === 0 && z[1] === 0, "Takt „5“ als Text und Zufall als Zeichenkette gelten nicht", z);
  }

  console.log("\n══ 2 · Aufbau: Textblock mit Zeitraum ══");
  {
    const block = (von, bis) => [{ id: "eigen-zt01", titel: "Aktionswoche", text: "Nur kurz.", von, bis }];
    const sicht = async (tag, bl) => { const h = await auf({ uhr: uhr(tag), bloecke: bl });
      const r = await h.p.evaluate(() => !!document.querySelector('[data-eigen="eigen-zt01"]')); await h.ctx.close(); return r; };
    const w = [];
    for (const tag of ["2026-10-09", "2026-10-10", "2026-10-12", "2026-10-13"]) w.push(await sicht(tag, block("2026-10-10", "2026-10-12")));
    pruef(JSON.stringify(w) === "[false,true,true,false]", "vor/erster Tag/letzter Tag/danach: aus, an, an, aus (beide Grenztage zählen)", w);
    pruef(!(await sicht(HEUTE, block("2026-10-11", ""))), "„ab morgen“ mit leerem „bis“ → heute nicht");
    pruef(!(await sicht(HEUTE, block("2026-10-11"))) && await sicht(HEUTE, block(undefined, "2026-10-10")), "nur „ab“ bzw. nur „bis“ gilt allein");
    pruef(await sicht(HEUTE, block("2026-10-20", "2026-10-01")), "„bis“ vor „ab“ (Tippfehler) → der Block bleibt sichtbar (§7)");
  }

  console.log("\n══ 3 · Kacheln: „Neu“ bis, wieder zeigen ab ══");
  {
    const mitNeu = KACHELN.map(k => k.schluessel === "speisekarte" ? Object.assign({}, k, { neuBis: "2026-10-10" }) : k);
    const neu = async (tag, opt) => { const h = await auf(Object.assign({ uhr: uhr(tag), hubKacheln: mitNeu }, opt || {}));
      const r = await h.p.evaluate(() => { const s = document.querySelector('a.kachel[data-kachel="speisekarte"] .neu');
        if (!s) return null; const c = getComputedStyle(s); return { farbe: c.color, grund: c.backgroundColor, text: s.textContent }; });
      await h.ctx.close(); return r; };
    const heute = await neu(HEUTE), morgen = await neu("2026-10-11");
    pruef(heute && /NEU/i.test(heute.text), "am letzten Tag steht die Plakette „Neu“", heute);
    pruef(morgen === null, "am Tag danach ist sie weg", morgen);
    for (const haus of ["chocolamour", "blend", "minhkeey", "piugusto"]) for (const farbe of ["hell", "dunkel"]) {
      const r = await neu(HEUTE, { haus, farbe });
      pruef(r && kontrast(r.farbe, r.grund) >= 4.5, haus + " " + farbe + ": Plakette ≥ 4,5:1", r && kontrast(r.farbe, r.grund).toFixed(2));
    }
    const ruht = KACHELN.map(k => k.schluessel === "kontakt" ? Object.assign({}, k, { zeigenAb: "2026-10-11" }) : k);
    const da = async tag => { const h = await auf({ uhr: uhr(tag), hubKacheln: ruht });
      const r = await h.p.evaluate(() => [!!document.querySelector('a.kachel[data-kachel="kontakt"]'), !!document.querySelector('a.kachel[data-kachel="bewertung"]')]);
      await h.ctx.close(); return r; };
    const d1 = await da(HEUTE), d2 = await da("2026-10-11");
    pruef(d1[1], "Voraussetzung: die Nachbarkachel steht da", d1);
    pruef(!d1[0] && d2[0], "Kachel ruht bis zum Tag davor und kommt am Tag selbst zurück", [d1[0], d2[0]]);
  }

  console.log("\n══ 4 · Banner: Laufzeit ══");
  {
    const zeit = [Object.assign({}, BANNER3[0]), Object.assign({}, BANNER3[1], { von: "2026-10-11" }),
                  Object.assign({}, BANNER3[2], { bis: "2026-10-10" })];
    const titel = async tag => { const h = await auf({ uhr: uhr(tag), banner: zeit });
      const r = await h.p.evaluate(() => [...document.querySelectorAll("#bnSpur .bnkarte")].map(k => k.textContent.trim().split(/\s+/)[0]));
      await h.ctx.close(); return r.join(","); };
    const t1 = await titel(HEUTE), t2 = await titel("2026-10-11");
    pruef(t1 === "Eins,Drei", "heute: „Zwei“ läuft noch nicht, „Drei“ am letzten Tag", t1);
    pruef(t2 === "Eins,Zwei", "morgen: „Zwei“ da, „Drei“ abgelaufen", t2);
  }

  console.log("\n══ 5 · Banner: Wechseltempo ══");
  {
    const lauf = async (opt, schritte) => {
      const h = await auf(Object.assign({ banner: BANNER3, hubstil: { bannerTakt: 5 } }, opt));
      await h.p.evaluate(() => { const s = document.getElementById("bnSpur"); if (s) s.scrollIntoView({ block: "center", behavior: "instant" }); });
      if (opt.vorher) await opt.vorher(h.p);
      const idx = () => h.p.evaluate(() => { const s = document.getElementById("bnSpur"); if (!s) return -1;
        const k = s.querySelectorAll(".bnkarte"); const d = k[1].offsetLeft - k[0].offsetLeft; return Math.round(Math.abs(s.scrollLeft) / Math.abs(d)); });
      const r = [await idx()];
      for (const ms of schritte) { await h.p.waitForTimeout(ms); r.push(await idx()); }
      const fehler = h.fehler.slice(); await h.ctx.close(); return { r, fehler };
    };
    const a = await lauf({}, [6200, 5000, 5000]);
    pruef(a.r.join() === "0,1,2,0", "alle 5 s eine Karte weiter, am Ende zurück zur ersten", a.r);
    pruef(!a.fehler.length, "keine Seitenfehler", a.fehler);
    const b = await lauf({ hubstil: { bannerTakt: 8 } }, [6200, 3000]);
    pruef(b.r.join() === "0,0,1", "8 s: nach 6 s noch die erste, nach 9 s die zweite", b.r);
    const c = await lauf({ hubstil: {} }, [6500]);
    pruef(c.r.join() === "0,0", "ohne Wahl blättert nichts", c.r);
    const d = await lauf({ vorher: p => p.evaluate(() => document.getElementById("bnSpur").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))) }, [6500, 5000]);
    pruef(d.r.join() === "0,0,0", "eine Berührung hält das Rad für diesen Besuch an", d.r);
    const e = await lauf({ reduziert: true }, [6500]);
    pruef(e.r.join() === "0,0", "reduzierte Bewegung: nichts blättert", e.r);
    const g = await lauf({ hoehe: 600, vorher: async p => {
      await p.evaluate(() => { document.body.style.paddingBottom = "3000px"; window.scrollTo(0, 2500); });
      await p.waitForTimeout(200);
      const r = await p.evaluate(() => document.getElementById("bnSpur").getBoundingClientRect().bottom);
      pruef(r < 0, "Voraussetzung: das Rad ist aus dem Bild gerollt", r);
    } }, [6500]);
    pruef(g.r.join() === "0,0", "außer Sicht blättert nichts", g.r);
    const z = await lauf({ vorher: p => p.evaluate(() => { zeichne(); zeichne(); }) }, [6200]);
    pruef(z.r.join() === "0,1", "nach zweimal Neuzeichnen genau ein Schritt in 6 s (ein Takt, nicht drei)", z.r);
  }

  console.log("\n══ 6 · Willkommen: Abend und Zufall ══");
  {
    const szene = async (hubstil, zeit, merk) => {
      const h = await auf({ uhr: uhr(HEUTE, zeit || "13:00:00"), hubstil,
        initSkript: "try{ sessionStorage.removeItem('omoteno-willkommen'); }catch(e){}" + (merk ? "try{ localStorage.setItem('omoteno-lade-blend', " + JSON.stringify(merk) + "); }catch(e){}" : "") });
      const r = await h.p.evaluate(() => { const w = document.getElementById("willkommen"), z = document.querySelector("#wkFigur [data-wz]");
        let m = null; try { m = localStorage.getItem("omoteno-lade-blend"); } catch (e) {}
        return { offen: !!w && !w.hidden, wz: z ? z.dataset.wz : null, merk: m }; });
      await h.ctx.close(); return r;
    };
    const tag = await szene({ lade: "cafe", ladeAbend: "pizza" });
    pruef(tag.offen, "Voraussetzung: der Willkommensschirm steht", tag);
    pruef(tag.wz === "cafe", "tagsüber die Szene für den Tag", tag.wz);
    const abend = await szene({ lade: "cafe", ladeAbend: "pizza" }, "21:30:00");
    pruef(abend.wz === "pizza" && abend.merk === "cafe|pizza", "am Abend die Abendszene; gemerkt „Tag|Abend“", abend);
    const ohne = await szene({ lade: "cafe" }, "21:30:00");
    pruef(ohne.wz === "cafe" && ohne.merk === "cafe", "ohne Abendszene: auch abends die Szene des Tages, Merkwert wie vorher", ohne);
    const gesehen = new Set(); let fremd = [];
    for (let i = 0; i < 10; i++) {
      const r = await szene({ lade: "cafe", ladeMix: ["sushi", "kurier"] });
      gesehen.add(r.wz); if (["sushi", "kurier"].indexOf(r.wz) < 0) fremd.push(r.wz);
      if (["sushi", "kurier"].indexOf(String(r.merk)) < 0) fremd.push("merk:" + r.merk);
    }
    pruef(!fremd.length && gesehen.size === 2, "Zufall: zehn Besuche zeigen nur Sushi und Kurier, beide kommen vor; gemerkt wird eine davon", [...gesehen, ...fremd]);
    const eins = await szene({ lade: "cafe", ladeMix: ["sushi", "__proto__", "sushi"] });
    pruef(eins.wz === "cafe", "Zufall mit nur einer gültigen Szene gilt nicht → die feste Szene", eins.wz);
    const merkMix = await szene({ lade: "cafe", ladeMix: ["sushi", "kurier"] }, null, "kurier");
    pruef(merkMix.wz === "kurier", "die gemerkte Szene des nächsten Besuchs wird gezeigt, wenn sie in der Auswahl ist (kein Sprung)", merkMix.wz);
  }

  console.log("\n══ 7 · Board ══");
  {
    const BB = { id: BETRIEB, slug: "blend", name: "Blend", rolle: "inhaber", bestell_pause: false, hub_texte: {}, markenblatt: null,
      hub_stil: { emoji: true, fremd: { a: 1 }, lade: "cafe" },
      hub_kacheln: [{ schluessel: "speisekarte", neuBis: "2026-10-20" }, { schluessel: "getraenke" }, { schluessel: "kontakt", zeigenAb: "2026-10-15" }],
      hub_banner: BANNER3.slice(0, 2), hub_bloecke: [{ id: "eigen-ab12", titel: "Herbstwoche", text: "Kürbis", von: "2026-10-01", bis: "2026-10-31" }] };
    const oeffne = async (breite, zeilen, farbe) => {
      const ctx = await browser.newContext({ viewport: { width: breite, height: 900 }, colorScheme: farbe || "dark" });
      const p = await ctx.newPage();
      const fehler = [];
      p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
      await p.clock.setFixedTime(new Date(uhr(HEUTE)));
      await p.addInitScript(b => { window.HUB_VORSCHAU_BASIS = b; Element.prototype.requestFullscreen = function () { return Promise.resolve(); }; }, BASIS);
      await p.route("**/*", r => {
        const u = r.request().url();
        if (u.startsWith("file://")) return r.continue();
        if (u === BASIS + "blend/") return r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", headers: { "Access-Control-Allow-Origin": "*" },
          body: fs.readFileSync(path.join(DIST, "blend", "index.html"), "utf8") });
        if (u.startsWith(EIMER)) return r.fulfill({ status: 200, contentType: "image/jpeg", body: BILD["kopf-hell"] });
        return r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: "[]" });
      });
      await p.goto("file://" + ADMIN);
      await p.waitForTimeout(600);
      await p.evaluate(([bb, zeilen]) => {
        window.__updates = []; window.__zeile = JSON.parse(JSON.stringify(bb));
        function kette(tab) {
          const ruf = { schritte: [] };
          const px = new Proxy(function () {}, { get(_, k) {
            if (k === "then") return (res, rej) => {
              const hat = s => ruf.schritte.some(x => x[0] === s);
              let d = { data: [], error: null };
              if (tab === "betrieb_mitglieder") d = { data: [{ rolle: bb.rolle, betriebe: JSON.parse(JSON.stringify(window.__zeile)) }], error: null };
              else if (tab === "betriebe" && hat("update")) {
                const u = ruf.schritte.find(x => x[0] === "update")[1][0];
                window.__updates.push(JSON.parse(JSON.stringify(u)));
                if (zeilen) Object.assign(window.__zeile, JSON.parse(JSON.stringify(u)));
                d = { data: zeilen ? [{ id: bb.id }] : [], error: null };
              } else if (tab === "betriebe" && hat("maybeSingle")) d = { data: JSON.parse(JSON.stringify(window.__zeile)), error: null };
              else if (hat("maybeSingle") || hat("single")) d = { data: null, error: null };
              return Promise.resolve(d).then(res, rej);
            };
            return (...a) => { ruf.schritte.push([k, a]); return px; };
          } });
          return px;
        }
        db = { from: kette, rpc: async () => ({ data: null, error: null }), channel: () => kette("kanal"), removeChannel: async () => {},
          storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: x => ({ data: { publicUrl: x } }) }) },
          functions: { invoke: async () => ({ data: null, error: null }) },
          auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: { id: "u1" } } }),
                  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
        demo = false;
      }, [BB, zeilen]);
      await p.evaluate(async () => { document.getElementById("tor").hidden = true; await betriebWaehlen(); });
      await p.waitForTimeout(300);
      await p.evaluate(() => { const s = document.getElementById("scharf"); if (s) s.hidden = true; document.querySelector('[data-tafel="startseite"]').click(); });
      await p.waitForTimeout(500);
      return { ctx, p, fehler };
    };
    const { ctx, p, fehler } = await oeffne(1280, true);

    /* Aufbau */
    pruef(await gruppeZu(p, "#gh-aufbau"), "Voraussetzung: Unterseite „Aufbau der Startseite“ offen");
    await p.waitForTimeout(300);
    await p.click('[data-afb="eigen-ab12"] [data-afb-auf]'); await p.waitForTimeout(200);
    const felder = await p.evaluate(() => [...document.querySelectorAll('[data-afb="eigen-ab12"] input[type=date]')].map(i => ({ v: i.value, fs: getComputedStyle(i).fontSize, h: i.getBoundingClientRect().height })));
    pruef(felder.length === 2 && felder[0].v === "2026-10-01" && felder[1].v === "2026-10-31", "Textblock: gespeicherter Zeitraum steht in den Feldern", felder);
    pruef(felder.every(x => x.fs === "16px" && x.h >= 44), "Datumsfelder 16 px, ≥ 44 px hoch", felder);
    const zus = await p.evaluate(() => document.querySelector('[data-afb="eigen-ab12"] .kbkopftext i').textContent);
    pruef(/bis 31\.10\.2026/.test(zus), "Kopfzeile nennt den Zeitraum", zus);
    await p.click('[data-afb="eigen-ab12"] [data-afb-kopie]'); await p.waitForTimeout(200);
    const kop = await p.evaluate(() => { const e = AFBSTAND.filter(b => blockArt(b.id) === "eigen"); return { n: e.length, i: AFBSTAND.indexOf(e[1]) - AFBSTAND.indexOf(e[0]), gleich: e.length === 2 && e[1].titel === e[0].titel && e[1].bis === e[0].bis && e[1].id !== e[0].id }; });
    pruef(kop.n === 2 && kop.i === 1 && kop.gleich, "„Block duplizieren“: Kopie direkt darunter, gleiche Felder, eigene Kennung", kop);
    await p.evaluate(() => { for (let i = 0; i < 12; i++) { const b = AFBSTAND.find(x => blockArt(x.id) === "eigen"); afbKopieren(b); } });
    const grenze = await p.evaluate(() => [AFBSTAND.filter(b => blockArt(b.id) === "eigen").length, document.getElementById("afbSage").textContent]);
    pruef(grenze[0] === 10 && /Höchstens 10/.test(grenze[1]), "Duplizieren hält bei 10 eigenen Blöcken an und sagt es", grenze);
    await p.evaluate(() => { AFBSTAND = AFBSTAND.filter((b, i, a) => blockArt(b.id) !== "eigen" || a.findIndex(x => blockArt(x.id) === "eigen") === i); afbZeichnen(); });
    const nVorher = await p.evaluate(() => window.__updates.length);
    await p.click('[data-afb-vorlage="bar"]'); await p.waitForTimeout(200);
    const bar = await p.evaluate(() => AFBSTAND.map(b => b.id + (b.breite === "halb" ? "/halb" : "") + (b.groesse ? "/" + b.groesse : "")));
    pruef(bar[0] === "banner/gross" && bar[1] === "aktion" && bar[2] === "schnell" && bar.indexOf("begleiter/halb") > 2 && bar[bar.length - 1].indexOf("eigen-") === 0,
      "Vorlage „Bar“: Banner groß vorn, Aktion, Schnellzugriff; eigener Block hinten", bar);
    pruef(bar.length === new Set(bar.map(x => x.split("/")[0])).size, "keine Doppel, nichts fehlt", bar.length);
    pruef(await p.evaluate(() => window.__updates.length) === nVorher, "die Vorlage schreibt nichts");
    await p.fill('[data-afb="eigen-ab12"] [data-afb-bis]', "2026-12-24").catch(async () => {
      await p.click('[data-afb="eigen-ab12"] [data-afb-auf]'); await p.fill('[data-afb="eigen-ab12"] [data-afb-bis]', "2026-12-24"); });
    await p.dispatchEvent('[data-afb="eigen-ab12"] [data-afb-bis]', "change");
    await p.click("#afbSichern"); await p.waitForTimeout(400);
    const ua = await p.evaluate(() => (window.__updates.slice().reverse().find(u => u.hub_bloecke) || {}).hub_bloecke);
    const ea = ua && ua.find(b => b.id === "eigen-ab12");
    pruef(ea && ea.von === "2026-10-01" && ea.bis === "2026-12-24" && ua[0].id === "banner" && ua[0].groesse === "gross", "„Übernehmen“ schreibt Zeitraum und Reihenfolge der Vorlage", ea);

    /* Kacheln */
    pruef(await gruppeZu(p, "#gh-kacheln"), "Voraussetzung: Unterseite „Kacheln“ offen");
    const kb = await p.evaluate(() => KACHELSTAND.filter(k => k.neuBis || k.zeigenAb).map(k => k.schluessel + ":" + (k.neuBis || "") + ":" + (k.zeigenAb || "")));
    pruef(kb.join() === "speisekarte:2026-10-20:,kontakt::2026-10-15", "gespeicherte Tage gelesen", kb);
    await p.evaluate(() => { kbOffen.add("speisekarte"); kbZeichnen(); });
    const kz = await p.evaluate(() => { const z = document.querySelector('[data-kb="speisekarte"]');
      return { neu: z.querySelector("[data-kb-neubis]").value, kopie: !!z.querySelector("[data-kb-kopie]"), satz: z.querySelector(".kbkopftext i").textContent,
               h: z.querySelector("[data-kb-kopie]").getBoundingClientRect().height }; });
    pruef(kz.neu === "2026-10-20" && kz.kopie && /„Neu“ bis 20\.10\.2026/.test(kz.satz) && kz.h >= 44, "Kachelzeile: Feld, Satz in der Kopfzeile, „Kachel duplizieren“ ≥ 44 px", kz);
    pruef(await p.evaluate(() => !document.querySelector('[data-kb="getraenke"]') || (kbOffen.add("bewertung"), kbZeichnen(), !document.querySelector('[data-kb="bewertung"] [data-kb-kopie]'))),
      "feste Kachel ohne Karte (Bewertung) hat keinen Duplizieren-Knopf");
    await p.click('[data-kb="speisekarte"] [data-kb-kopie]'); await p.waitForTimeout(200);
    const kk = await p.evaluate(() => { const i = KACHELSTAND.findIndex(k => k.schluessel === "speisekarte"), k = KACHELSTAND[i + 1];
      return k && { sch: k.schluessel, art: k.art, karte: k.karte, titel: k.titel, neuBis: k.neuBis, roh: kbRoh().find(e => e.schluessel === k.schluessel) }; });
    pruef(kk && /^e-/.test(kk.sch) && kk.art === "karte" && kk.karte === "speisekarte" && /Kopie/.test(kk.titel) && kk.roh.art === "karte",
      "Kopie einer festen Karten-Kachel = eigene Karten-Kachel mit derselben Karte, direkt dahinter", kk);
    await p.evaluate(() => { const z = document.querySelector('[data-kb="speisekarte"] [data-kb-neubis]'); z.value = ""; z.dispatchEvent(new Event("change", { bubbles: true })); });
    const rohN = await p.evaluate(() => kbRoh().find(e => e.schluessel === "speisekarte"));
    pruef(rohN && !("neuBis" in rohN), "Feld geleert → kein neuBis in der Nutzlast", rohN);
    pruef(await p.evaluate(() => { const r = kbRoh(); return r.filter(e => "neuBis" in e || "zeigenAb" in e).length; }) === 2,
      "nur die Kacheln mit Tag tragen die neuen Schlüssel (kontakt + die Kopie)");

    /* Banner */
    pruef(await gruppeZu(p, "#gh-banner"), "Voraussetzung: Unterseite „Aktions-Banner-Rad“ offen");
    await p.waitForTimeout(300);
    const takt0 = await p.evaluate(() => [BNTAKT, document.querySelector('#bnTakt [aria-checked="true"]').dataset.wahl]);
    pruef(takt0[0] === 0 && takt0[1] === "", "Wechseltempo: gespeichert „Aus“ gewählt", takt0);
    await p.click('[data-bn="a"] [data-bn-kopie]'); await p.waitForTimeout(200);
    const bk = await p.evaluate(() => BANNERSTAND.map(b => b.titel + "@" + b.id.slice(0, 2)));
    pruef(bk.length === 3 && bk[0].startsWith("Eins") && bk[1].startsWith("Eins") && bk[2].startsWith("Zwei"), "„Duplizieren“: Kopie direkt hinter dem Original", bk);
    await p.evaluate(() => { const i = document.querySelector('[data-bn="b"] [data-bn-von]'); i.value = "2026-10-20"; i.dispatchEvent(new Event("change", { bubbles: true })); });
    const bz = await p.evaluate(() => ({ satz: document.querySelector('[data-bn="b"] .bnzeit .kbhinweis').textContent, von: bnFinden("b").von }));
    pruef(bz.von === "2026-10-20" && /Läuft ab 20\.10\.2026/.test(bz.satz), "Laufzeit: Feld setzt „von“, Satz sagt es", bz);
    await p.click('#bnTakt [data-wahl="8"]'); await p.waitForTimeout(800);
    const vt = await p.evaluate(() => { const h = hvAlle().gestalten; const w = h && h.frame && h.frame.contentWindow; return w && w.bannerTakt ? w.bannerTakt() : null; });
    pruef(vt === 8, "ein Tipp auf „Alle 8 s“ stellt den Takt in der Vorschau (echter Hub)", vt);
    pruef(await p.evaluate(() => window.__updates.filter(u => u.hub_stil || u.hub_banner).length) === 0, "Wählen allein schreibt nichts");
    await p.evaluate(() => { window.__zeile.hub_stil.fremd2 = "anderes Gerät"; });
    await p.click("#bnSichern"); await p.waitForTimeout(500);
    const ub = await p.evaluate(() => window.__updates.filter(u => u.hub_stil || u.hub_banner));
    const st = ub.find(u => u.hub_stil), bn = ub.find(u => u.hub_banner);
    pruef(st && st.hub_stil.bannerTakt === 8 && st.hub_stil.fremd2 === "anderes Gerät" && st.hub_stil.lade === "cafe" && st.hub_stil.fremd.a === 1,
      "Takt frisch gelesen und zusammengeführt (Fremdes, Stand eines anderen Geräts bleibt)", st && st.hub_stil);
    pruef(bn && bn.hub_banner.length === 3 && bn.hub_banner.find(b => b.id === "b").von === "2026-10-20" && !("von" in bn.hub_banner.find(b => b.id === "a")),
      "hub_banner: drei Banner, „von“ nur am gesetzten", bn && bn.hub_banner.map(b => b.id + ":" + (b.von || "")));
    await p.click('#bnTakt [data-wahl=""]'); await p.click("#bnSichern"); await p.waitForTimeout(500);
    const st2 = await p.evaluate(() => (window.__updates.slice().reverse().find(u => u.hub_stil) || {}).hub_stil);
    pruef(st2 && !("bannerTakt" in st2), "„Aus“: der Schlüssel fällt weg", st2 && Object.keys(st2));

    /* Willkommen */
    pruef(await gruppeZu(p, "#wzGruppe"), "Voraussetzung: Unterseite „Willkommen-Animation“ offen");
    await p.waitForTimeout(300);
    const wk = await p.evaluate(() => ({ modus: document.querySelector('#wzModus [aria-checked="true"]').dataset.wahl,
      abend: document.querySelector('#wzAbend [aria-checked="true"]').dataset.wahl, gesperrt: document.getElementById("wzSichern").disabled,
      knoepfe: [...document.querySelectorAll("#wzAbend [data-wahl], #wzModus [data-wahl], #wzNochmal")].map(b => Math.round(b.getBoundingClientRect().height)) }));
    pruef(wk.modus === "" && wk.abend === "" && wk.gesperrt, "gespeicherter Stand: eine Szene, abends wie tagsüber, „Übernehmen“ gesperrt", wk);
    pruef(wk.knoepfe.length === 13 && wk.knoepfe.every(h => h >= 44), "Knöpfe ≥ 44 px", wk.knoepfe);
    await p.click("#wzNochmal"); await p.waitForTimeout(800);
    const vor = await p.evaluate(() => { const w = hvAlle().gestalten.frame.contentWindow; const z = w.document.querySelector("#wkFigur [data-wz]"); if (z) z.__alt = 1; return z ? z.dataset.wz : null; });
    pruef(vor === "cafe", "„Nochmal abspielen“ zeigt die Szene im Rahmen", vor);
    await p.click("#wzNochmal"); await p.waitForTimeout(800);
    const nach = await p.evaluate(() => { const w = hvAlle().gestalten.frame.contentWindow; const z = w.document.querySelector("#wkFigur [data-wz]"); return z ? { wz: z.dataset.wz, alt: !!z.__alt, offen: !w.document.getElementById("willkommen").hidden } : null; });
    pruef(nach && nach.wz === "cafe" && !nach.alt && nach.offen, "ein zweiter Tipp baut die Szene als NEUE Elemente (Animation von vorn)", nach);
    await p.click('#wzModus [data-wahl="zufall"]'); await p.waitForTimeout(100);
    const z1 = await p.evaluate(() => ({ rolle: document.querySelector('.wz-wahl').getAttribute("role"), satz: document.getElementById("wzModusSatz").textContent, gesperrt: document.getElementById("wzSichern").disabled }));
    pruef(z1.rolle === "checkbox" && /mindestens zwei/.test(z1.satz) && z1.gesperrt, "Zufall: Häkchen, ein Satz verlangt zwei, „Übernehmen“ gesperrt", z1);
    await p.click('.wz-wahl[data-wzw="sushi"]'); await p.click('#wzAbend [data-wahl="pizza"]'); await p.waitForTimeout(150);
    pruef(await p.evaluate(() => !document.getElementById("wzSichern").disabled), "zwei angehakt → „Übernehmen“ frei");
    await p.click("#wzSichern"); await p.waitForTimeout(500);
    const sw = await p.evaluate(() => (window.__updates.slice().reverse().find(u => u.hub_stil) || {}).hub_stil);
    pruef(sw && JSON.stringify(sw.ladeMix) === '["cafe","sushi"]' && sw.ladeAbend === "pizza" && sw.lade === "cafe" && sw.fremd2 === "anderes Gerät",
      "„Übernehmen“: ladeMix, ladeAbend, lade, zusammengeführt", sw);
    await p.click('#wzModus [data-wahl=""]'); await p.click('#wzAbend [data-wahl=""]'); await p.click("#wzSichern"); await p.waitForTimeout(500);
    const sw2 = await p.evaluate(() => (window.__updates.slice().reverse().find(u => u.hub_stil) || {}).hub_stil);
    pruef(sw2 && !("ladeMix" in sw2) && !("ladeAbend" in sw2) && sw2.lade === "cafe", "zurück auf eine Szene: Zufall und Abend fallen aus der Spalte", sw2 && Object.keys(sw2));
    pruef(!fehler.length, "keine Seitenfehler im Board", fehler);
    await ctx.close();

    /* 0 Zeilen */
    const o = await oeffne(1280, false);
    await gruppeZu(o.p, "#wzGruppe"); await o.p.waitForTimeout(300);
    await o.p.click('#wzAbend [data-wahl="sushi"]'); await o.p.click("#wzSichern"); await o.p.waitForTimeout(500);
    const satz = await o.p.evaluate(() => document.getElementById("wzSatz").textContent);
    pruef(/Nur der Besitzer/.test(satz), "0 Zeilen → „Nur der Besitzer …“", satz);
    await o.ctx.close();

    /* Breiten, hell und dunkel */
    for (const [breite, farbe] of [[360, "dark"], [360, "light"], [1280, "light"]]) {
      const q = await oeffne(breite, true, farbe);
      for (const g of ["#gh-aufbau", "#gh-banner", "#wzGruppe"]) {
        await gruppeZu(q.p, g); await q.p.waitForTimeout(250);
        const u = await q.p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        pruef(u <= 0, breite + " px " + farbe + " " + g + ": kein seitlicher Überlauf", u);
      }
      await q.ctx.close();
    }
  }

  await browser.close();
  console.log("\n" + (n - f) + "/" + n + " Proben grün" + (f ? " — " + f + " FEHL" : ""));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
