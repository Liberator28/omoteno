/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Gast-Hub gestalten · Aussehen, Block C3a (02.11.)
   Kopf & Logo, Figur des Hauses, Bewegte Emojis — je drei neue Wahlen.

     NODE_PATH=$(npm root -g) node pruefungen/pruef-c3-aussehen.js   (braucht dist/)
     ADMIN_DATEI=… / HUB_DIST=… für Gegenbeweise auf Kopien

   Alles lebt in betriebe.hub_stil (kopf.lage/dunkel/logoGroesse, figur, emojiTempo/emojiWo/emojiEinmal).
   Ohne Wahl ist der Hub Zeichen für Zeichen der alte: dieselbe Startseite (#inhalt), keine neuen Attribute —
   gemessen in fünf Häusern; ungültige Werte (Anführungszeichen, __proto__, Zahl als Text) ebenso.
   Hub, am gemalten Bild: Bildausschnitt (object-position), Abdunkeln (Helligkeit des Bildes sinkt, die Fläche fängt
   keinen Tipp), Logogröße in allen drei Kopfarten (klassisch ohne Bild, mit Bild — Mitte bleibt auf der Bildkante —,
   Premium), Begleiter-Größe, „Wo“ (Startseite/nirgends; Bestellstand bleibt), Abendstimmung nach der Uhr,
   Emoji-Tempo (Abspielgeschwindigkeit der Filme), Emoji-Ort (nur Kacheln bzw. nur Speisekarte bekommen Filme),
   „einmal“ (kein zweiter Durchlauf in 9 s, ein Tipp spielt wieder).
   Board: Felder für Ausschnitt/Abdunkeln nur mit Kopfbild, gespeicherter Stand gewählt, ein Tipp färbt die
   Vorschau (der echte Hub im Rahmen), „Übernehmen“ liest frisch und führt zusammen (Fremdes bleibt), 0 Zeilen →
   Satz, 44 px, Kontrast der gewählten Knöpfe hell und dunkel, 360/1280 px ohne Überlauf.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { oeffneHub, EIMER, BETRIEB, BILD } = require("./werkzeug/start-hub");
const { gruppeZu } = require("./werkzeug/zentrale");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = process.env.ADMIN_DATEI || path.join(OBEN, "seiten", "admin.html");
const DIST = process.env.HUB_DIST || path.join(OBEN, "dist");
const BASIS = "https://omoteno.test/h/";
const KOPF = EIMER + BETRIEB + "/kopf/bild-1.jpg";
const EMO = path.join(OBEN, "auslieferung", "emoji");
/* Die Emoji-Dateien von der Platte statt von https://omoteno.de/emoji/ (wie pruef-bewegte-zeichen). */
const emojiRouten = async p => p.route("https://omoteno.de/emoji/**", r => {
  const datei = path.join(EMO, decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/emoji\//, "")));
  if (!datei.startsWith(EMO) || !fs.existsSync(datei)) return r.fulfill({ status: 404, body: "" });
  return r.fulfill({ status: 200, contentType: /\.js$/.test(datei) ? "application/javascript" : "application/json",
    headers: { "Access-Control-Allow-Origin": "*" }, body: fs.readFileSync(datei) });
});

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + (typeof d === "string" ? d : JSON.stringify(d)).slice(0, 240) : ""));
}
const lum = c => { const m = String(c).match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

/* Stand der Startseite, wie ihn ein Gast bekommt: Auszeichnung, Attribute am body, am Kopfbild und am Logo. */
const stand = p => p.evaluate(() => {
  const k = document.getElementById("kopfbild");
  return { inhalt: document.getElementById("inhalt").innerHTML,
           body: Object.keys(document.body.dataset).sort().map(x => x + "=" + document.body.dataset[x]).join(" "),
           kopf: k ? k.outerHTML : "", logo: (document.querySelector(".logo") || {}).outerHTML || "" };
});
/* Mittlere Helligkeit eines gemalten Rechtecks (Bildschirmfoto im Browser selbst gelesen). */
async function helligkeit(p, r) {
  const b64 = (await p.screenshot({ clip: { x: r.x + 4, y: r.y + 4, width: r.w - 8, height: r.h - 8 } })).toString("base64");
  return p.evaluate(async d => {
    const img = new Image(); img.src = "data:image/png;base64," + d; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data; let s = 0;
    for (let i = 0; i < px.length; i += 4) s += .2126 * px[i] + .7152 * px[i + 1] + .0722 * px[i + 2];
    return s / (px.length / 4);
  }, b64);
}

(async () => {
  const browser = await chromium.launch();
  const auf = (o) => oeffneHub(browser, Object.assign({ dist: DIST }, o));

  console.log("\n══ 1 · Ohne Wahl und mit ungültigen Werten: der Hub ist der alte ══");
  const UNGUELTIG = { figur: { groesse: "riesig", wo: '"><img src=x onerror=window.__x=1>', abendArt: "__proto__" },
    emojiTempo: "schnell", emojiWo: "constructor", emojiEinmal: "true",
    kopf: { bild: KOPF, lage: "links", dunkel: "30", logoGroesse: "__proto__" } };
  for (const haus of ["chocolamour", "blend", "nordstern", "minhkeey", "piugusto"]) {
    const a = await auf({ haus, kopf: "hell" });
    const s1 = await stand(a.p); await a.ctx.close();
    const b = await auf({ haus, kopf: "hell", hubstil: UNGUELTIG });
    const s2 = await stand(b.p); const x = await b.p.evaluate(() => window.__x); await b.ctx.close();
    pruef(s1.inhalt.length > 200 && s1.inhalt === s2.inhalt && s1.body === s2.body && s1.kopf === s2.kopf && s1.logo === s2.logo && !x,
      haus + ": ungültige Wahlen ändern weder Startseite noch Attribute", s1.inhalt === s2.inhalt ? [s1.body, s2.body] : "inhalt verschieden");
    pruef(!/data-kopflage|data-logogr/.test(s1.body) && !/data-dunkel/.test(s1.kopf), haus + ": ohne Wahl kein neues Attribut", s1.body);
  }

  console.log("\n══ 2 · Kopf: Bildausschnitt und Abdunkeln ══");
  {
    const lage = async w => { const h = await auf({ haus: "blend", kopf: "hell", hubstil: { kopf: Object.assign({ bild: KOPF }, w) } });
      const r = await h.p.evaluate(() => { const i = document.querySelector("#kopfbild img"); return i ? getComputedStyle(i).objectPosition : null; });
      await h.ctx.close(); return r; };
    const l0 = await lage({}), lo = await lage({ lage: "oben" }), lu = await lage({ lage: "unten" });
    pruef(l0 === "50% 50%", "ohne Wahl: Bildmitte", l0);
    pruef(/^50% 0(%|px)$/.test(lo), "„Oben“: object-position 50% 0", lo);
    pruef(lu === "50% 100%", "„Unten“: object-position 50% 100%", lu);

    const mess = async (w, opt) => {
      const h = await auf(Object.assign({ haus: "blend", kopf: "hell", hubstil: { kopf: Object.assign({ bild: KOPF }, w) } }, opt || {}));
      await h.p.waitForTimeout(300);
      const r = await h.p.evaluate(() => { const k = document.getElementById("kopfbild"), b = k.getBoundingClientRect(), v = getComputedStyle(k, "::before");
        const mx = b.left + b.width / 2, my = b.top + b.height / 2, t = document.elementFromPoint(mx, my);
        return { x: b.left, y: b.top, w: b.width, h: b.height, bg: v.backgroundColor, inhalt: v.content, pe: v.pointerEvents, treffer: t && (t.closest("#kopfbild") ? "kopfbild" : t.tagName) }; });
      r.hell = await helligkeit(h.p, r);
      await h.ctx.close(); return r;
    };
    const ohne = await mess({}), d30 = await mess({ dunkel: 30 }), d50 = await mess({ dunkel: 50 });
    pruef(ohne.inhalt === "none" || ohne.inhalt === "normal", "ohne Wahl keine Dunkelfläche", ohne.inhalt);
    pruef(d30.bg === "rgba(0, 0, 0, 0.3)" && d30.pe === "none", "30 %: Fläche rgba(0,0,0,0.3), fängt keinen Tipp", d30.bg + " " + d30.pe);
    pruef(ohne.hell > 0 && d30.hell < ohne.hell * 0.8 && d50.hell < d30.hell, "am gemalten Bild: 30 % dunkler als ohne, 50 % dunkler als 30 %",
      [ohne.hell, d30.hell, d50.hell].map(v => v.toFixed(1)));
    pruef(d30.treffer === ohne.treffer, "ein Tipp auf die Bildmitte trifft dasselbe wie ohne Abdunkeln", [ohne.treffer, d30.treffer]);
  }

  console.log("\n══ 3 · Logogröße in allen drei Kopfarten ══");
  {
    const logo = async (opt, gr) => {
      const st = { kopf: Object.assign(opt.kopf ? { bild: KOPF } : {}, gr ? { logoGroesse: gr } : {}) };
      const h = await auf(Object.assign({ hubstil: st, breite: opt.breite || 390 }, opt));
      await h.p.waitForTimeout(300);
      const r = await h.p.evaluate(() => { const l = document.querySelector(".logo").getBoundingClientRect(), k = document.getElementById("kopfbild").getBoundingClientRect();
        const svg = document.querySelector(".logo svg"), sv = svg ? svg.getBoundingClientRect() : null;
        return { w: l.width, h: l.height, mitte: l.top + l.height / 2, kante: k.bottom, kopfAn: document.body.dataset.kopfbild === "an",
                 svg: sv ? [sv.width, sv.height] : null, ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      await h.ctx.close(); return r;
    };
    for (const [name, opt, soll] of [["klassisch ohne Bild", { haus: "blend" }, [47.6, 58, 69.6]],
                                     ["klassisch mit Bild", { haus: "blend", kopf: "hell" }, [65.6, 80, 96]],
                                     ["Premium mit Bild", { haus: "chocolamour", kopf: "hell", stil: "premium" }, [85.3, 104, 124.8]]]) {
      const w = [];
      for (const gr of ["klein", "", "gross"]) w.push(await logo(opt, gr));
      pruef(w.every((m, i) => Math.abs(m.w - soll[i]) < 1.5 && Math.abs(m.h - soll[i]) < 1.5), name + ": klein/normal/groß = " + soll.join("/") + " px", w.map(m => m.w.toFixed(1)));
      if (name === "klassisch ohne Bild") pruef(w.every((m, i) => m.svg && Math.abs(m.svg[0] - soll[i]) < 1.5), name + ": das gezeichnete Siegel wächst mit", w.map(m => m.svg));
      if (opt.kopf && !opt.stil) pruef(w.every(m => m.kopfAn && Math.abs(m.mitte - m.kante) <= 1), name + ": die Logo-Mitte bleibt auf der Bildkante (±1 px)", w.map(m => (m.mitte - m.kante).toFixed(1)));
      const schmal = await logo(Object.assign({ breite: 320 }, opt), "gross");
      pruef(schmal.ueber <= 0, name + ": groß bei 320 px ohne Überlauf", schmal.ueber);
    }
    /* Unterseiten behalten die schmale Leiste */
    const h = await auf({ haus: "blend", hash: "#/speisekarte", hubstil: { kopf: { logoGroesse: "gross" } } });
    const u = await h.p.evaluate(() => document.querySelector(".logo").getBoundingClientRect().width);
    await h.ctx.close();
    const h0 = await auf({ haus: "blend", hash: "#/speisekarte" });
    const u0 = await h0.p.evaluate(() => document.querySelector(".logo").getBoundingClientRect().width);
    await h0.ctx.close();
    pruef(Math.abs(u - u0) < 0.5, "Unterseite: das Logo der Leiste bleibt gleich groß", [u0, u]);
  }

  console.log("\n══ 4 · Figur: Größe, wo, Abendstimmung ══");
  {
    const fig = async (figur, opt) => {
      const h = await auf(Object.assign({ haus: "blend", hubstil: figur ? { figur } : {} }, opt || {}));
      await h.p.waitForTimeout(200);
      const r = await h.p.evaluate(() => { const b = document.querySelector("#inhalt .begleiter .figur");
        /* Gemessen wird die Größe ohne das Atmen (transform scale), nicht der bewegte Rahmen. */
        return { da: !!b, w: b ? parseFloat(getComputedStyle(b).width) : 0, h: b ? parseFloat(getComputedStyle(b).height) : 0,
                 svg: b ? b.outerHTML : "", art: avatarArt(), tisch: begleiterHTML("meintisch") !== "", bestellt: begleiterHTML("bestellt") !== "",
                 pass: phasenBild("neu", "zettel", 104).length > 50 }; });
      r.fehler = h.fehler; await h.ctx.close(); return r;
    };
    const vor = await fig(null);
    pruef(vor.da && Math.abs(vor.w - 48) < 1 && vor.tisch, "Voraussetzung: ohne Wahl steht der Begleiter (48 px) auf der Startseite und auf „Mein Tisch“", vor);
    const kl = await fig({ groesse: "klein" }), gr = await fig({ groesse: "gross" });
    pruef(Math.abs(kl.w - 40) < 1 && Math.abs(kl.h - 40) < 1 && Math.abs(gr.w - 60) < 1 && Math.abs(gr.h - 60) < 1, "Größe am gemalten Begleiter: klein 40, groß 60 px", [kl.w, gr.w]);
    const st = await fig({ wo: "start" }), aus = await fig({ wo: "aus" });
    pruef(st.da && !st.tisch && !st.bestellt, "„Startseite“: Begleiter nur dort", st);
    pruef(!aus.da && !aus.tisch && aus.pass, "„Nirgends“: kein Begleiter, der Bestellstand behält sein Bild", { da: aus.da, pass: aus.pass });
    const abend0 = await fig(null, { uhr: "2026-10-10T20:00:00" }), abend = await fig({ abendArt: "ruhig" }, { uhr: "2026-10-10T20:00:00" });
    const tag = await fig({ abendArt: "ruhig" }, { uhr: "2026-10-10T14:00:00" });
    pruef(abend.art === "ruhig" && abend0.art !== "ruhig" && abend.svg !== abend0.svg, "20 Uhr: Stimmung „ruhig“ (Haus: „" + abend0.art + "“) — die gezeichnete Figur ändert sich", [abend0.art, abend.art]);
    pruef(tag.art === vor.art, "14 Uhr: die Tagesstimmung bleibt", [vor.art, tag.art]);
    const licht = await fig({ abendArt: "ruhig" }, { uhr: "2026-10-10T14:00:00", farbe: "dunkel" });
    pruef(licht.art === vor.art, "die Lichtwahl „Dunkel“ des Gastes macht mittags keinen Abend", licht.art);
    pruef(![vor, kl, gr, st, aus, abend, tag].some(x => x.fehler.length), "kein Seitenfehler");
  }

  console.log("\n══ 5 · Bewegte Emojis: Tempo, Ort, einmal ══");
  {
    const filme = async (hubstil, hash, warten) => {
      const h = await auf({ haus: "blend", hubstil: Object.assign({ emoji: true }, hubstil), hash: hash || "#/", routen: emojiRouten });
      await h.p.evaluate(() => { window.__fertig = new Map();
        const hake = () => bzFilme.forEach(a => { if (a.__gehakt) return; a.__gehakt = 1;
          a.addEventListener("complete", () => { const el = a.wrapper && a.wrapper.parentElement; const k = el ? el.dataset.bzSchl : "?"; window.__fertig.set(k, (window.__fertig.get(k) || 0) + 1); }); });
        hake(); window.__hake = setInterval(hake, 100); });
      await h.p.waitForTimeout(warten || 3500);
      const r = await h.p.evaluate(() => ({
        los: [...document.querySelectorAll(".bz[data-bz-los]")].map(e => e.dataset.bzSchl),
        ohne: [...document.querySelectorAll(".bz:not([data-bz-los])")].map(e => e.dataset.bzSchl),
        speed: [...bzFilme].map(a => a.playSpeed), fertig: [...window.__fertig.entries()] }));
      r.h = h; return r;
    };
    const vs = await filme({}); await vs.h.ctx.close();
    const vk = await filme({}, "#/speisekarte"); await vk.h.ctx.close();
    pruef(vs.los.some(s => /^(kachel|sz|ruf):/.test(s)) && vk.los.some(s => /^(ks|kst|tl|chip|eh):/.test(s)),
      "Voraussetzung: ohne Wahl laufen Filme auf Kacheln (Start) und in der Speisekarte", [vs.los.slice(0, 4), vk.los.slice(0, 4)]);
    pruef(vs.speed.length && vs.speed.every(s => s === 1), "ohne Wahl: normale Geschwindigkeit", vs.speed);
    const ru = await filme({ emojiTempo: "ruhig" }); await ru.h.ctx.close();
    pruef(ru.speed.length && ru.speed.every(s => s === 0.6), "„Ruhig“: jeder Film mit 0,6-facher Geschwindigkeit", ru.speed);
    const ks = await filme({ emojiWo: "kacheln" }, "#/speisekarte"); await ks.h.ctx.close();
    pruef(ks.ohne.length > 0 && !ks.los.some(s => /^(ks|kst|tl|chip|eh):/.test(s)), "„Kacheln“: in der Speisekarte startet kein Film", ks.los);
    const kk = await filme({ emojiWo: "kacheln" }); await kk.h.ctx.close();
    pruef(kk.los.some(s => /^(kachel|sz|ruf):/.test(s)), "„Kacheln“: auf der Startseite laufen sie weiter", kk.los.slice(0, 4));
    const sk = await filme({ emojiWo: "karte" }); await sk.h.ctx.close();
    pruef(!sk.los.some(s => /^(kachel|sz|ruf):/.test(s)) && sk.ohne.length > 0, "„Speisekarte“: auf den Kacheln startet kein Film", sk.los);
    const sk2 = await filme({ emojiWo: "karte" }, "#/speisekarte"); await sk2.h.ctx.close();
    pruef(sk2.los.some(s => /^(ks|kst|tl|chip|eh):/.test(s)), "„Speisekarte“: dort laufen sie", sk2.los.slice(0, 4));

    const wd = await filme({}, "#/", 16000); await wd.h.ctx.close();
    pruef(wd.fertig.some(([, z]) => z >= 2), "Voraussetzung: ohne Wahl spielt mindestens ein Film in 16 s zweimal", wd.fertig);
    const ein = await filme({ emojiEinmal: true }, "#/", 16000);
    pruef(ein.fertig.length > 0 && ein.fertig.every(([, z]) => z === 1), "„Einmal“: jeder Film genau einmal in 16 s", ein.fertig);
    /* ein Tipp spielt trotzdem */
    const getippt = await ein.h.p.evaluate(async () => {
      const el = [...document.querySelectorAll(".bz.bz-bereit")].find(e => e._bz && e.getBoundingClientRect().height > 0 && !e.closest(".ed-seite"));
      if (!el) return null;
      const k = el.closest("a,button") || el; k.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      bzSpielen(el, true);
      await new Promise(r => setTimeout(r, 120));
      return { schl: el.dataset.bzSchl, laeuft: !el._bz.isPaused };
    });
    pruef(getippt && getippt.laeuft, "„Einmal“: ein Tipp spielt den Film wieder", getippt);
    await ein.h.ctx.close();
  }

  console.log("\n══ 6 · Board ══");
  {
    const BB = { id: BETRIEB, slug: "blend", name: "Blend", rolle: "inhaber", bestell_pause: false, hub_texte: {}, markenblatt: null,
      hub_stil: { emoji: true, schrift: { kopf: "fraunces" }, fremd: { a: 1 },
        kopf: { bild: KOPF, logo: EIMER + BETRIEB + "/kopf/logo-1.png", form: "eckig", lage: "unten", dunkel: 20 },
        figur: { wo: "start" }, emojiTempo: "ruhig" } };
    const oeffne = async (breite, bb, zeilen) => {
      const ctx = await browser.newContext({ viewport: { width: breite, height: 900 } });
      const p = await ctx.newPage();
      const fehler = [];
      p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
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
        window.__updates = []; window.__stil = JSON.parse(JSON.stringify(bb.hub_stil));
        function kette(tab) {
          const ruf = { schritte: [] };
          const px = new Proxy(function () {}, { get(_, k) {
            if (k === "then") return (res, rej) => {
              const hat = s => ruf.schritte.some(x => x[0] === s);
              let d = { data: [], error: null };
              if (tab === "betrieb_mitglieder") d = { data: [{ rolle: bb.rolle, betriebe: Object.assign({}, bb, { hub_stil: JSON.parse(JSON.stringify(window.__stil)) }) }], error: null };
              else if (tab === "betriebe" && hat("update")) {
                const u = ruf.schritte.find(x => x[0] === "update")[1][0];
                window.__updates.push(JSON.parse(JSON.stringify(u)));
                if (zeilen && u.hub_stil) window.__stil = JSON.parse(JSON.stringify(u.hub_stil));
                d = { data: zeilen ? [{ id: bb.id }] : [], error: null };
              } else if (tab === "betriebe" && hat("maybeSingle")) d = { data: { hub_stil: JSON.parse(JSON.stringify(window.__stil)) }, error: null };
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
      }, [bb, zeilen]);
      await p.evaluate(async () => { document.getElementById("tor").hidden = true; await betriebWaehlen(); });
      await p.waitForTimeout(300);
      await p.evaluate(() => { const s = document.getElementById("scharf"); if (s) s.hidden = true; document.querySelector('[data-tafel="startseite"]').click(); });
      await p.waitForTimeout(500);
      return { ctx, p, fehler };
    };
    const gewaehlt = (p, id) => p.evaluate(i => { const b = document.querySelector("#" + i + ' [aria-checked="true"]'); return b ? b.dataset.wahl : null; }, id);
    const rahmen = p => p.evaluate(() => { const h = hvAlle().startseite || hvAlle().gestalten; const w = h && h.frame && h.frame.contentWindow;
      if (!w) return null; const d = w.document, k = d.getElementById("kopfbild");
      return { lage: d.body.dataset.kopflage || "", logogr: d.body.dataset.logogr || "", dunkel: k ? k.dataset.dunkel || "" : "",
               tempo: w.emojiWahl ? w.emojiWahl().tempo : "?", wo: w.emojiWahl ? w.emojiWahl().wo : "?", einmal: w.emojiWahl ? w.emojiWahl().einmal : "?", figur: w.figurWahl ? w.figurWahl() : null }; });

    const { ctx, p, fehler } = await oeffne(1280, BB, true);
    pruef(await gruppeZu(p, "#kfGruppe"), "Voraussetzung: Unterseite „Kopf & Logo“ offen");
    const v = await p.evaluate(() => ({ lage: !document.getElementById("kfLageFeld").hidden, dunkel: !document.getElementById("kfDunkelFeld").hidden }));
    pruef(v.lage && v.dunkel, "mit Kopfbild: Felder für Ausschnitt und Abdunkeln sichtbar", v);
    pruef(await gewaehlt(p, "kfLage") === "unten" && await gewaehlt(p, "kfDunkel") === "20" && await gewaehlt(p, "kfLogoGr") === "",
      "der gespeicherte Stand ist gewählt (unten, 20 %, normal)");
    const knoepfe = await p.evaluate(() => [...document.querySelectorAll("#kfLage [data-wahl], #kfDunkel [data-wahl], #kfLogoGr [data-wahl]")]
      .map(b => Math.round(b.getBoundingClientRect().height)));
    pruef(knoepfe.length === 12 && knoepfe.every(h => h >= 44), "jeder Knopf ≥ 44 px hoch", knoepfe);
    await p.click('#kfLage [data-wahl="oben"]'); await p.click('#kfDunkel [data-wahl="40"]'); await p.click('#kfLogoGr [data-wahl="gross"]');
    await p.waitForTimeout(900);
    const r1 = await rahmen(p);
    pruef(r1 && r1.lage === "oben" && r1.dunkel === "40" && r1.logogr === "gross", "ein Tipp färbt die Vorschau: der echte Hub im Rahmen zeigt oben, 40 %, groß", r1);
    pruef(await p.evaluate(() => window.__updates.length) === 0, "Wählen allein schreibt nichts");
    await p.evaluate(() => { window.__stil.fremd2 = "anderes Gerät"; });
    await p.click("#kfSichern"); await p.waitForTimeout(400);
    const u1 = await p.evaluate(() => window.__updates.pop() || null);
    const k1 = u1 && u1.hub_stil && u1.hub_stil.kopf;
    pruef(k1 && k1.lage === "oben" && k1.dunkel === 40 && k1.logoGroesse === "gross" && k1.form === "eckig" && /bild-1/.test(k1.bild) && /logo-1/.test(k1.logo),
      "„Übernehmen“ schreibt kopf mit Bild, Logo, Form und den drei Wahlen", k1);
    pruef(u1 && u1.hub_stil.emoji === true && u1.hub_stil.fremd.a === 1 && u1.hub_stil.fremd2 === "anderes Gerät" && u1.hub_stil.schrift.kopf === "fraunces",
      "frisch gelesen und zusammengeführt: Emoji, Schrift, Fremdes und der Stand eines anderen Geräts bleiben", u1 && Object.keys(u1.hub_stil));
    /* Mitte und Normal stehen nicht in der Spalte */
    await p.click('#kfLage [data-wahl=""]'); await p.click('#kfDunkel [data-wahl="0"]'); await p.click('#kfLogoGr [data-wahl=""]');
    await p.click("#kfSichern"); await p.waitForTimeout(400);
    const k2 = await p.evaluate(() => (window.__updates.pop() || {}).hub_stil.kopf);
    pruef(k2 && !("lage" in k2) && !("dunkel" in k2) && !("logoGroesse" in k2) && k2.form === "eckig", "Mitte, „Aus“ und Normal: die Schlüssel fallen weg", k2);
    /* ohne Kopfbild: keine Felder, und ein Ausschnitt geht nicht in die Spalte */
    /* Erst wieder einen Ausschnitt und eine Dunkelstufe wählen — sonst kann die Probe den Fehler nicht treffen (§8.1g). */
    await p.click('#kfLage [data-wahl="oben"]'); await p.click('#kfDunkel [data-wahl="30"]');
    pruef(await p.evaluate(() => kfRoh().lage === "oben" && kfRoh().dunkel === 30), "Voraussetzung: mit Bild stehen Ausschnitt und Dunkelstufe im Entwurf");
    await p.click("#kfBildWeg"); await p.waitForTimeout(200);
    const v2 = await p.evaluate(() => ({ lage: document.getElementById("kfLageFeld").hidden, dunkel: document.getElementById("kfDunkelFeld").hidden, roh: kfRoh() }));
    pruef(v2.lage && v2.dunkel && !("lage" in v2.roh) && !("dunkel" in v2.roh), "ohne Kopfbild: Felder weg, kein Ausschnitt im Entwurf", v2);

    /* Figur */
    pruef(await gruppeZu(p, "#gh-figur"), "Voraussetzung: Unterseite „Figur des Hauses“ offen");
    pruef(await gewaehlt(p, "fgWo") === "start" && await gewaehlt(p, "fgGroesse") === "" && await gewaehlt(p, "fgAbend") === "", "Figur: gespeicherter Stand gewählt (Startseite, normal, wie tagsüber)");
    await p.click('#fgGroesse [data-wahl="klein"]'); await p.click('#fgAbend [data-wahl="ruhig"]'); await p.click('#fgWo [data-wahl=""]');
    await p.waitForTimeout(900);
    const r2 = await rahmen(p);
    pruef(r2 && r2.figur && r2.figur.groesse === "klein" && r2.figur.abendArt === "ruhig" && r2.figur.wo === "", "Vorschau übernimmt die Figur-Wahl", r2 && r2.figur);
    await p.click("#avSichern"); await p.waitForTimeout(500);
    const ups = await p.evaluate(() => window.__updates.splice(0));
    const fu = ups.find(u => u.hub_stil);
    pruef(ups.some(u => u.hub_avatar) && fu && JSON.stringify(fu.hub_stil.figur) === '{"groesse":"klein","abendArt":"ruhig"}' && fu.hub_stil.emojiTempo === "ruhig",
      "„Übernehmen“: hub_avatar wie bisher und hub_stil.figur zusammengeführt (Überall = kein wo)", ups);
    await p.click("#avSichern"); await p.waitForTimeout(400);
    pruef(!(await p.evaluate(() => window.__updates.splice(0))).some(u => u.hub_stil), "unberührter Auftritt: zweites Übernehmen schreibt hub_stil nicht");

    /* Emojis */
    pruef(await gruppeZu(p, "#gh-emojis"), "Voraussetzung: Unterseite „Bewegte Emojis“ offen");
    pruef(await gewaehlt(p, "emTempo") === "ruhig" && await gewaehlt(p, "emWo") === "" && await p.evaluate(() => document.getElementById("emSichern").disabled),
      "Emojis: gespeichert „Ruhig“, „Überall“, Übernehmen erst nach einer Änderung");
    await p.click('#emTempo [data-wahl=""]'); await p.click('#emWo [data-wahl="karte"]'); await p.click("#emEinmal");
    await p.waitForTimeout(900);
    const r3 = await rahmen(p);
    /* „karte“ und „einmal“ weichen vom Stand der Datenbank im Rahmen ab — nur der Entwurf kann sie dorthin bringen. */
    pruef(r3 && r3.wo === "karte" && r3.einmal === true && r3.tempo === "", "Vorschau übernimmt Ort, „einmal“ und Tempo", r3);
    await p.click("#emSichern"); await p.waitForTimeout(400);
    const eu = await p.evaluate(() => window.__updates.pop() || null);
    pruef(eu && !("emojiTempo" in eu.hub_stil) && eu.hub_stil.emojiWo === "karte" && eu.hub_stil.emojiEinmal === true && eu.hub_stil.emoji === true && eu.hub_stil.figur && eu.hub_stil.fremd2,
      "„Übernehmen“: Normal fällt weg, Ort und „einmal“ stehen darin, der Rest bleibt", eu && eu.hub_stil);
    pruef(eu && Buffer.byteLength(JSON.stringify(eu.hub_stil)) < 2500, "hub_stil bleibt unter 2500 Byte", eu && Buffer.byteLength(JSON.stringify(eu.hub_stil)));
    const aus = await p.evaluate(() => { stilEmoji = false; stilZeichnen(); return document.getElementById("emWahl").getAttribute("aria-disabled"); });
    pruef(aus === "true", "bewegte Emojis aus: die drei Wahlen treten zurück");
    pruef(!fehler.length, "kein Seitenfehler im Board", fehler);
    await ctx.close();

    /* 0 Zeilen = kein Recht */
    const z = await oeffne(390, BB, false);
    await gruppeZu(z.p, "#gh-emojis");
    await z.p.click('#emWo [data-wahl="kacheln"]'); await z.p.click("#emSichern"); await z.p.waitForTimeout(400);
    pruef(/Nur der Besitzer/.test(await z.p.evaluate(() => document.getElementById("emPruefung").textContent)), "0 Zeilen zurück → „Nur der Besitzer …“ statt „übernommen“");
    await gruppeZu(z.p, "#kfGruppe");
    await z.p.click('#kfLogoGr [data-wahl="klein"]'); await z.p.click("#kfSichern"); await z.p.waitForTimeout(400);
    pruef(/Nur der Besitzer/.test(await z.p.evaluate(() => document.getElementById("kfStand").textContent)), "Kopf & Logo: 0 Zeilen → derselbe Satz");
    await z.ctx.close();

    /* Breiten, Kontrast hell und dunkel */
    for (const [breite, hell] of [[360, false], [360, true], [1280, true]]) {
      const o = await oeffne(breite, BB, true);
      if (hell) await o.p.evaluate(() => { document.body.classList.add("hell"); });
      const ergebnis = [];
      for (const g of ["#kfGruppe", "#gh-figur", "#gh-emojis"]) {
        await gruppeZu(o.p, g);
        ergebnis.push(await o.p.evaluate(g => {
          const sel = g + ' [data-wahl][aria-checked="true"]';
          return { ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            paare: [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).map(e => {
              const c = getComputedStyle(e).color; let bg = getComputedStyle(e).backgroundColor;
              if (/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { const s = e.parentElement.querySelector(".segmentschieber"); bg = s ? getComputedStyle(s).backgroundColor : bg; }
              return [e.textContent.trim(), c, bg]; }) };
        }, g));
      }
      const schlecht = ergebnis.flatMap(e => e.paare).map(([t, c, b]) => [t, kontrast(c, b)]).filter(x => x[1] < 4.5);
      pruef(ergebnis.every(e => e.ueber <= 0), breite + " px " + (hell ? "hell" : "dunkel") + ": kein Überlauf", ergebnis.map(e => e.ueber));
      pruef(ergebnis.flatMap(e => e.paare).length >= 6 && !schlecht.length, breite + " px " + (hell ? "hell" : "dunkel") + ": gewählte Knöpfe ≥ 4,5:1", schlecht);
      await o.ctx.close();
    }
  }

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
})();
