/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Gast-Hub gestalten · Schrift und Farben, Block C3b (02.11.)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-c3-schrift-farben.js   (braucht dist/)
     ADMIN_DATEI=… / HUB_DIST=… für Gegenbeweise auf Kopien

   Schrift: Textgröße (hub_stil.schrift.groesse, Faktor 0,95/1,05/1,1 auf die Größe des Markenblatts — gemessen an der
   Schrift des body; ungültig = wie ohne Wahl, und dann bleibt sogar das style-Attribut am <html> gleich), kein Überlauf
   bei 360 px mit „Groß“; drei Schriftpaare setzen GENAU „Alle Überschriften“ und „Text“ und zeigen es in der Vorschau,
   ohne zu schreiben; der Probesatz steht auf jeder Schriftkarte, nur als Text, ohne <>, übersteht ein Neuladen.
   Farben: vier Paletten, jede in beiden Fassungen lesbar (farbLesbar leer), ein Tipp setzt Tag UND Abend, erst
   „Übernehmen“ schreibt; die Kontrast-Ampel je Zeile stimmt mit der Herleitung überein und sagt „zu schwach“ genau
   dann, wenn farbLesbar für diese Rolle meldet (zweite Quelle); Farben aus dem Logo: ein Testlogo aus zwei bekannten
   Farben ergibt genau diese beiden Vorschläge, ein Tipp setzt sie lesbar; ohne Logo, mit grauem Logo und mit einem
   Logo ohne CORS-Freigabe je ein Satz. Beide „Übernehmen“ lesen frisch und führen zusammen, 0 Zeilen → Satz.
   Dazu 360/1280 px hell und dunkel: kein Überlauf, Knöpfe ≥ 44 px, Feld 16 px, Ampel-Schrift ≥ 4,5:1.
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

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + (typeof d === "string" ? d : JSON.stringify(d)).slice(0, 240) : ""));
}
const lum = c => { const m = String(c).match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

(async () => {
  const browser = await chromium.launch();
  const auf = o => oeffneHub(browser, Object.assign({ dist: DIST }, o));

  console.log("\n══ 1 · Hub: Textgröße ══");
  {
    const mess = async (hubstil, breite) => {
      const h = await auf({ haus: "blend", hubstil, breite: breite || 390 });
      const r = await h.p.evaluate(() => ({ px: parseFloat(getComputedStyle(document.body).fontSize),
        basis: (MARKENBLATT.schrift && typeof MARKENBLATT.schrift.groesse === "number") ? MARKENBLATT.schrift.groesse : 1,
        stil: document.documentElement.getAttribute("style") || "", ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      r.fehler = h.fehler; await h.ctx.close(); return r;
    };
    const ohne = await mess({});
    pruef(Math.abs(ohne.px - 16 * ohne.basis) < 0.05, "ohne Wahl: Schrift wie das Markenblatt (16 px × " + ohne.basis + ")", ohne.px);
    for (const [g, name] of [[0.95, "Kleiner"], [1.05, "Größer"], [1.1, "Groß"]]) {
      const m = await mess({ schrift: { groesse: g } });
      pruef(Math.abs(m.px - 16 * m.basis * g) < 0.05, name + ": " + (16 * m.basis * g).toFixed(1) + " px", m.px);
    }
    for (const kaputt of [1.2, "1.1", "__proto__", -1, null, [1.1]]) {
      const m = await mess({ schrift: { groesse: kaputt } });
      pruef(m.px === ohne.px && m.stil === ohne.stil, "ungültig " + JSON.stringify(kaputt) + ": wie ohne Wahl, style am <html> gleich", [m.px, m.stil === ohne.stil]);
    }
    const gross = await mess({ schrift: { groesse: 1.1 } }, 360);
    pruef(gross.ueber <= 0 && !gross.fehler.length, "„Groß“ bei 360 px: kein Überlauf, kein Fehler", [gross.ueber, gross.fehler]);
    const h = await auf({ haus: "blend", hubstil: { schrift: { groesse: 1.1 } }, breite: 360, hash: "#/speisekarte" });
    const k = await h.p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await h.ctx.close();
    pruef(k <= 0, "„Groß“ bei 360 px: Speisekarte ohne Überlauf", k);
  }

  console.log("\n══ 2 · Board ══");
  const BB = { id: BETRIEB, slug: "blend", name: "Blend", rolle: "inhaber", bestell_pause: false, hub_texte: {}, markenblatt: null,
    hub_stil: { emoji: false, fremd: { a: 1 }, kopf: { logo: EIMER + BETRIEB + "/kopf/logo-1.png", form: "rund" }, schrift: { kopf: "lora" } } };
  const oeffne = async (breite, zeilen, vorher) => {
    const ctx = await browser.newContext({ viewport: { width: breite, height: 900 } });
    const p = await ctx.newPage();
    const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
    await p.addInitScript(b => { window.HUB_VORSCHAU_BASIS = b; Element.prototype.requestFullscreen = function () { return Promise.resolve(); }; }, BASIS);
    if (vorher) await p.addInitScript(vorher);
    await p.route("**/*", r => {
      const u = r.request().url();
      if (u.startsWith("file://") || u.startsWith("data:")) return r.continue();
      if (u === BASIS + "blend/") return r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", headers: { "Access-Control-Allow-Origin": "*" },
        body: fs.readFileSync(path.join(DIST, "blend", "index.html"), "utf8") });
      /* Freigabe nur für eine fremde Herkunft: mit crossOrigin lädt das Bild dann nicht. Ohne jede Angabe ergänzt die
         gestellte Antwort die Freigabe offenbar selbst — gemessen, das Bild war dann lesbar (Probe zuerst grün-falsch). */
      if (u.startsWith("https://fremd.example/")) return r.fulfill({ status: 200, contentType: "image/jpeg",
        headers: { "Access-Control-Allow-Origin": "https://anders.example" }, body: BILD["kopf-hell"] });
      if (u.startsWith(EIMER)) return r.fulfill({ status: 200, contentType: "image/jpeg", headers: { "Access-Control-Allow-Origin": "*" }, body: BILD["kopf-hell"] });
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
    }, [BB, zeilen]);
    await p.evaluate(async () => { document.getElementById("tor").hidden = true; await betriebWaehlen(); });
    await p.waitForTimeout(300);
    await p.evaluate(() => { const s = document.getElementById("scharf"); if (s) s.hidden = true; document.querySelector('[data-tafel="startseite"]').click(); });
    await p.waitForTimeout(500);
    return { ctx, p, fehler };
  };
  const rahmen = (p, js) => p.evaluate(js => { const h = hvAlle().startseite || hvAlle().gestalten || hvAlle().farben;
    const w = h && h.frame && h.frame.contentWindow; if (!w) return null; return (new w.Function(js))(); }, js);

  /* ── Schrift ── */
  {
    const { ctx, p, fehler } = await oeffne(1280, true);
    pruef(await gruppeZu(p, "#swGruppe"), "Voraussetzung: Unterseite „Schrift“ offen");
    pruef(await p.evaluate(() => document.querySelector('#swGroesse [aria-checked="true"]').dataset.wahl) === "", "Textgröße: ohne Wahl „Normal“ gewählt");
    await p.click('#swGroesse [data-wahl="1.1"]'); await p.waitForTimeout(900);
    const v = await rahmen(p, "return { px: parseFloat(getComputedStyle(document.body).fontSize), mb: (MARKENBLATT.schrift && MARKENBLATT.schrift.groesse) || 1 };");
    pruef(v && Math.abs(v.px - 17.6 * v.mb) < 0.05, "„Groß“: die Vorschau (echter Hub im Rahmen) zeigt 17,6 px × Markenblatt", v);
    pruef(await p.evaluate(() => window.__updates.length) === 0, "Wählen allein schreibt nichts");
    /* Paar */
    await p.click('[data-sw-paar="modern"]'); await p.waitForTimeout(900);
    const sw = await p.evaluate(() => ({ kopf: SW.kopf, text: SW.text, titel: SW.titel, gericht: SW.gericht }));
    pruef(sw.kopf === "dmserif" && sw.text === "dmsans" && sw.titel === "" && sw.gericht === "", "„Modern“ setzt GENAU Überschriften und Text", sw);
    const vk = await rahmen(p, "const s = document.documentElement.style; return { kopf: s.getPropertyValue('--schrift-kopf'), text: s.getPropertyValue('--schrift-text') };");
    pruef(vk && /omo-dmserif/.test(vk.kopf) && /omo-dmsans/.test(vk.text), "die Vorschau zeigt das Paar", vk);
    const textrollen = await p.evaluate(() => Object.values(SW_PAARE).every(pa => SCHRIFT_WAHL.find(x => x.s === pa.text).rollen.indexOf("text") >= 0 && SCHRIFT_WAHL.some(x => x.s === pa.kopf)));
    pruef(textrollen, "jedes Paar: Textschrift aus SCHRIFT_WAHL mit Rolle „text“, Überschrift vorhanden");
    pruef(await p.evaluate(() => window.__updates.length) === 0, "ein Paar schreibt nichts");
    /* Übernehmen: frisch und zusammengeführt */
    await p.evaluate(() => { window.__stil.fremd2 = "anderes Gerät"; });
    await p.click("#swSichern"); await p.waitForTimeout(500);
    const u = await p.evaluate(() => window.__updates.pop() || null);
    const sch = u && u.hub_stil && u.hub_stil.schrift;
    pruef(sch && sch.groesse === 1.1 && sch.kopf === "dmserif" && sch.text === "dmsans", "„Übernehmen“: Schrift mit Größe 1,1 und dem Paar", sch);
    pruef(u && u.hub_stil.emoji === false && u.hub_stil.fremd.a === 1 && u.hub_stil.fremd2 === "anderes Gerät" && u.hub_stil.kopf && u.hub_stil.kopf.logo,
      "frisch gelesen und zusammengeführt: Emoji, Kopf, Fremdes und der Stand eines anderen Geräts bleiben", u && Object.keys(u.hub_stil));
    /* Normal: Schlüssel weg */
    await p.click('#swGroesse [data-wahl=""]'); await p.click("#swSichern"); await p.waitForTimeout(400);
    const u2 = await p.evaluate(() => (window.__updates.pop() || {}).hub_stil.schrift);
    pruef(u2 && !("groesse" in u2), "„Normal“: groesse steht nicht in der Spalte", u2);
    /* Probesatz */
    await p.fill("#swProbesatz", '<img src=x onerror=window.__x=1>Hallo Welt');
    const pr = await p.evaluate(() => ({ feld: document.getElementById("swProbesatz").value, karten: [...document.querySelectorAll(".swprobe")].map(e => e.textContent),
      img: document.querySelectorAll(".swliste img").length, x: window.__x }));
    pruef(pr.feld.indexOf("<") < 0 && pr.karten.length > 5 && pr.karten.every(t => t === pr.feld.trim()) && !pr.img && !pr.x,
      "Probesatz: ohne <>, auf jeder Schriftkarte, nur als Text", pr.karten.slice(0, 2));
    pruef(!fehler.length, "kein Seitenfehler", fehler);
    await ctx.close();
    /* Neuladen: Probesatz bleibt (nur dieses Gerät) */
    const z = await oeffne(1280, true, () => { try { localStorage.setItem("omoteno-sw-probesatz", "Gut gegessen"); } catch (e) {} });
    await gruppeZu(z.p, "#swGruppe");
    const nz = await z.p.evaluate(() => ({ feld: document.getElementById("swProbesatz").value, karte: document.querySelector(".swprobe").textContent }));
    pruef(nz.feld === "Gut gegessen" && nz.karte === "Gut gegessen", "Probesatz übersteht ein Neuladen", nz);
    await z.ctx.close();
    /* Ein vergifteter gespeicherter Wert (anderer Weg in den Speicher): die Karten zeichnen ihn nur als Text. */
    const zv = await oeffne(1280, true, () => { try { localStorage.setItem("omoteno-sw-probesatz", "<img src=x onerror=window.__x=1>Gut"); } catch (e) {} });
    await gruppeZu(zv.p, "#swGruppe"); await zv.p.waitForTimeout(300);
    const gv = await zv.p.evaluate(() => ({ img: document.querySelectorAll(".swliste img, .swprobe img").length, x: window.__x,
      karte: document.querySelector(".swprobe").textContent, feld: document.getElementById("swProbesatz").value }));
    pruef(!gv.img && !gv.x && gv.karte.indexOf("<") < 0 && gv.feld.indexOf("<") < 0, "vergifteter gespeicherter Probesatz: nur Text, nichts läuft", gv);
    const z2 = zv;
    /* 0 Zeilen */
    await z2.ctx.close();
    const o = await oeffne(390, false);
    await gruppeZu(o.p, "#swGruppe");
    await o.p.click('#swGroesse [data-wahl="0.95"]'); await o.p.click("#swSichern"); await o.p.waitForTimeout(400);
    pruef(/Nur der Besitzer/.test(await o.p.evaluate(() => document.getElementById("swPruefung").textContent)), "Schrift: 0 Zeilen → „Nur der Besitzer …“");
    await o.ctx.close();
  }

  /* ── Farben ── */
  {
    const { ctx, p, fehler } = await oeffne(1280, true);
    pruef(await gruppeZu(p, "#fbGruppe"), "Voraussetzung: Unterseite „Farben“ offen");
    await p.waitForTimeout(600);
    const lesbar = await p.evaluate(() => Object.entries(FB_PALETTEN).map(([k, v]) => [k, farbLesbar(v.tag).length, farbLesbar(v.abend).length]));
    pruef(lesbar.length === 4 && lesbar.every(x => !x[1] && !x[2]), "jede der vier Paletten ist Tag UND Abend lesbar (farbLesbar leer)", lesbar);
    for (const name of ["cafe", "bar", "bistro", "asia"]) {
      await p.click('[data-fb-palette="' + name + '"]');
      const r = await p.evaluate(nm => ({ tag: FB.tag.grund === FB_PALETTEN[nm].tag.grund && FB.tag.akzent2 === FB_PALETTEN[nm].tag.akzent2,
        abend: FB.abend.grund === FB_PALETTEN[nm].abend.grund && FB.abend.an === true, sperre: document.getElementById("fbSichern").disabled }), name);
      pruef(r.tag && r.abend && !r.sperre, name + ": setzt Tag und Abend, „Übernehmen“ frei", r);
    }
    pruef(await p.evaluate(() => window.__updates.length) === 0, "Paletten schreiben nichts");
    await p.waitForTimeout(900);
    const vr = await rahmen(p, "return getComputedStyle(document.documentElement).getPropertyValue('--grund').trim();");
    pruef(vr && vr.toUpperCase() === "#FBF6EE", "die Vorschau zeigt die zuletzt gewählte Palette (Asiatisch, Grund)", vr);
    /* Ampel gegen farbLesbar (zweite Quelle) */
    const amp = async () => p.evaluate(() => {
      const e = FB[FB_FASSUNG], fehlt = farbLesbar(e).map(x => x.was);
      const zuRolle = { grund: /Schrift auf Hintergrund/, flaeche: /Schrift auf (Karten|eingelassenen)/, band: /Kopfband/,
        tinte: /^Schrift auf (Hintergrund|Karten|eingelassenen)/, akzent: /^Hauptfarbe/, akzent2: /^Zweitfarbe/ };
      return [...document.querySelectorAll("[data-fb-ampel]")].map(el => ({ r: el.dataset.fbAmpel, st: el.dataset.stufe, t: el.textContent,
        meldet: fehlt.some(w => zuRolle[el.dataset.fbAmpel].test(w)), punkt: getComputedStyle(el, "::before").backgroundColor }));
    });
    let a = await amp();
    pruef(a.length === 6 && a.every(x => x.st !== "schwach" && !x.meldet && /:1 · (gut|knapp)$/.test(x.t)), "lesbare Palette: keine Zeile „zu schwach“, jede nennt Verhältnis und Wort", a.map(x => x.r + " " + x.t));
    await p.fill("#fbx-tinte", "#8A8A8A"); await p.waitForTimeout(150);
    a = await amp();
    const ti = a.find(x => x.r === "tinte");
    pruef(ti && ti.st === "schwach" && ti.meldet && /zu schwach$/.test(ti.t), "graue Schrift: Zeile „Schrift“ sagt „zu schwach“ — und farbLesbar meldet es auch", ti);
    pruef(a.every(x => (x.st === "schwach") === x.meldet), "für JEDE Zeile: „zu schwach“ genau dann, wenn farbLesbar diese Rolle meldet", a.map(x => x.r + ":" + x.st + "/" + x.meldet));
    const punkte = new Set(a.map(x => x.punkt));
    pruef(punkte.size >= 2 && ti.punkt !== a.find(x => x.r === "band").punkt, "der Punkt hat je Stufe eine eigene Farbe — das Wort steht trotzdem da", [...punkte]);
    const grenze = await p.evaluate(() => [fbAmpelStufe(4.49), fbAmpelStufe(4.5), fbAmpelStufe(5.49), fbAmpelStufe(5.5)]);
    pruef(grenze.join() === "schwach,knapp,knapp,gut", "Grenzen: < 4,5 zu schwach, < 5,5 knapp, sonst gut", grenze);
    await p.click('[data-fb-palette="cafe"]');
    /* Logo-Farben: Testlogo aus Rot (Hälfte) und Blau (Viertel), Weiß und Schwarz dazwischen zählen nicht */
    const logo = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
      x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, 64, 64); x.fillStyle = "#C8202E"; x.fillRect(0, 0, 32, 64); x.fillStyle = "#1E6FB4"; x.fillRect(32, 0, 32, 32);
      x.fillStyle = "#000000"; x.fillRect(32, 32, 8, 8); return c.toDataURL("image/png"); });
    await p.evaluate(u => { KF.logo = u; }, logo);
    await p.click("#fbLogoLesen"); await p.waitForTimeout(500);
    const vor = await p.evaluate(() => [...document.querySelectorAll("[data-fb-logo]")].map(b => [b.dataset.fbLogo, b.dataset.fbFarbe, Math.round(b.getBoundingClientRect().height)]));
    const nah = (h, soll) => { const a = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), b = [1, 3, 5].map(i => parseInt(soll.slice(i, i + 2), 16)); return a.every((v, i) => Math.abs(v - b[i]) <= 8); };
    pruef(vor.length === 2 && vor[0][0] === "akzent" && nah(vor[0][1], "#C8202E") && vor[1][0] === "akzent2" && nah(vor[1][1], "#1E6FB4"),
      "Testlogo Rot/Blau: Hauptfarbe ≈ #C8202E, Zweitfarbe ≈ #1E6FB4 (Weiß/Schwarz zählen nicht)", vor);
    pruef(vor.every(x => x[2] >= 44), "Vorschlag-Knöpfe ≥ 44 px", vor.map(x => x[2]));
    await p.click('[data-fb-logo="akzent"]');
    const gesetzt = await p.evaluate(() => ({ ak: FB.tag.akzent, prob: fbProbleme().filter(x => /Hauptfarbe/.test(x.was)).length }));
    pruef(gesetzt.prob === 0 && /^#[0-9A-F]{6}$/.test(gesetzt.ak), "ein Tipp setzt die Hauptfarbe — lesbar nachgezogen", gesetzt);
    for (const [quelle, muster, name] of [["", /Logo hoch/, "ohne Logo"], ["https://fremd.example/logo.png", /nicht auslesen/, "Logo ohne CORS-Freigabe"]]) {
      await p.evaluate(u => { KF.logo = u; }, quelle);
      await p.click("#fbLogoLesen"); await p.waitForTimeout(700);
      const s = await p.evaluate(() => ({ satz: document.getElementById("fbLogoSatz").textContent, n: document.querySelectorAll("[data-fb-logo]").length }));
      pruef(muster.test(s.satz) && !s.n, name + ": ein Satz, keine Vorschläge", s.satz);
    }
    const grau = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d");
      x.fillStyle = "#777777"; x.fillRect(0, 0, 32, 32); return c.toDataURL("image/png"); });
    await p.evaluate(u => { KF.logo = u; }, grau);
    await p.click("#fbLogoLesen"); await p.waitForTimeout(500);
    pruef(/keine kräftige Farbe/.test(await p.evaluate(() => document.getElementById("fbLogoSatz").textContent)), "graues Logo: ein Satz statt eines Vorschlags");
    /* Übernehmen frisch */
    await p.evaluate(() => { window.__stil.fremd3 = 7; });
    await p.click("#fbSichern"); await p.waitForTimeout(500);
    const fu = await p.evaluate(() => window.__updates.pop() || null);
    pruef(fu && fu.hub_stil.farben && fu.hub_stil.farben.tag.grund === "#F7F1E8" && fu.hub_stil.fremd3 === 7 && fu.hub_stil.emoji === false,
      "„Übernehmen“: Farben der Palette, frisch zusammengeführt (Stand eines anderen Geräts bleibt)", fu && Object.keys(fu.hub_stil));
    pruef(!fehler.length, "kein Seitenfehler", fehler);
    await ctx.close();
    const o = await oeffne(390, false);
    await gruppeZu(o.p, "#fbGruppe"); await o.p.waitForTimeout(500);
    await o.p.click('[data-fb-palette="bar"]'); await o.p.click("#fbSichern"); await o.p.waitForTimeout(400);
    pruef(/Nur der Besitzer/.test(await o.p.evaluate(() => document.getElementById("fbPruefung").textContent)), "Farben: 0 Zeilen → „Nur der Besitzer …“");
    await o.ctx.close();
  }

  /* ── Breiten, Größen, Kontrast ── */
  for (const [breite, hell] of [[360, false], [360, true], [1280, true]]) {
    const o = await oeffne(breite, true);
    if (hell) await o.p.evaluate(() => document.body.classList.add("hell"));
    await gruppeZu(o.p, "#swGruppe");
    const s = await o.p.evaluate(() => ({ ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      knopf: [...document.querySelectorAll("#swGroesse [data-wahl], [data-sw-paar]")].map(b => Math.round(b.getBoundingClientRect().height)),
      feld: parseFloat(getComputedStyle(document.getElementById("swProbesatz")).fontSize) }));
    await gruppeZu(o.p, "#fbGruppe"); await o.p.waitForTimeout(400);
    const fb = await o.p.evaluate(() => {
      const bg = el => { let g = el; while (g) { const c = getComputedStyle(g).backgroundColor; const a = c.match(/rgba?\(([^)]+)\)/); if (a) { const t = a[1].split(",").map(Number); if (t.length < 4 || t[3] >= .99) return c; } g = g.parentElement; } return "rgb(0,0,0)"; };
      return { ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        knopf: [...document.querySelectorAll("[data-fb-palette], #fbLogoLesen")].map(b => Math.round(b.getBoundingClientRect().height)),
        amp: [...document.querySelectorAll("[data-fb-ampel]")].filter(e => e.getClientRects().length).map(e => [getComputedStyle(e).color, bg(e)]) };
    });
    const tag = breite + " px " + (hell ? "hell" : "dunkel") + ": ";
    pruef(s.ueber <= 0 && fb.ueber <= 0, tag + "kein Überlauf", [s.ueber, fb.ueber]);
    pruef(s.knopf.length === 7 && s.knopf.every(h => h >= 44) && fb.knopf.every(h => h >= 44), tag + "Knöpfe ≥ 44 px", s.knopf.concat(fb.knopf));
    pruef(s.feld >= 16, tag + "Probesatz-Feld 16 px", s.feld);
    const schlecht = fb.amp.map(([c, b]) => kontrast(c, b)).filter(k => k < 4.5);
    pruef(fb.amp.length === 6 && !schlecht.length, tag + "Ampel-Schrift ≥ 4,5:1", schlecht);
    await o.ctx.close();
  }

  await browser.close();
  console.log(`\n${n - f} von ${n} ok`);
  if (f) { console.log(f + " Fehler"); process.exit(1); }
})();
