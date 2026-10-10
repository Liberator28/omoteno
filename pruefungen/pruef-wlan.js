/* ═══════════════════════════════════════════════════════════════════
   pruef-wlan.js — WLAN für Gäste: Passwort verborgen, zwei Knöpfe, QR

   Wunsch 10.10.: „Das Passwort soll dort nicht stehen, sondern drunter
   zwei Buttons — Passwort kopieren und WLAN-QR-Code anzeigen. Das
   Passwort trägt man im Admin-Board ein. Ohne lange Erklärung.“

   Was hier gemessen wird, und warum so:
   1 · Das Passwort steht NIRGENDS im Text der Seite (innerText und
       Auszeichnung von #inhalt), auch nicht nach dem Kopieren.
   2 · Genau zwei Knöpfe, je ≥ 44 px, Schrift ≥ 4,5:1, keine Anleitung.
   3 · „Kopieren“ legt GENAU das Passwort in die Zwischenablage
       (gestellte clipboard.writeText, sie fängt den echten Aufruf).
   4 · Der QR-Code wird gezeichnet und mit jsQR (pruefungen/werkzeug/)
       ZURÜCKGELESEN — gegen eine eigene, unabhängig geschriebene
       Erwartung im WIFI:-Format, mit ; , : " \ und Umlaut im Namen und
       im Passwort. Wer nur „ein SVG ist da“ prüft, prüft nichts.
   5 · Die QR-Bibliothek kommt erst beim Tipp (vorher keine Anfrage),
       und mit integrity: Eine veränderte Datei wird NICHT ausgeführt,
       der Gast bekommt einen Satz (Gegenfall gemessen).
   6 · Live (hub_texte) schlägt Markenblatt; der Platzhalter
       „BITTE-EINTRAGEN“ zählt als leer; Netzname nur als Text.
   7 · Grenzen aus datenbank/migration-wlan.sql (zweite Quelle): Hub
       kürzt genau dort, das Board-Feld nimmt genau so viel.
   8 · Board: Felder in „Ihre Worte“, Vorschau bekommt die Werte,
       „Übernehmen“ legt sie in hub_texte, OHNE die anderen Worte zu
       verlieren (und umgekehrt), „Auf Vorgabe zurück“ lässt das WLAN.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const HUB = slug => "file://" + path.join(OBEN, "dist", slug, "index.html");
const ADMIN = "file://" + path.join(OBEN, "seiten", "admin.html");
const LIB = path.join(OBEN, "auslieferung", "lib", "qrcode-generator-2.0.4.js");
const JSQR = path.join(__dirname, "werkzeug", "jsQR-1.4.0.js");
const MIG = fs.readFileSync(path.join(OBEN, "datenbank", "migration-wlan.sql"), "utf8");
const G_NETZ = +(MIG.match(/'wlan_netz'\), 0\) <= (\d+)/) || [])[1];
const G_PASS = +(MIG.match(/'wlan_passwort'\), 0\) <= (\d+)/) || [])[1];
for (const slug of ["chocolamour", "blend"]) if (!fs.existsSync(path.join(OBEN, "dist", slug, "index.html"))) {
  console.error("dist/ fehlt — erst node erzeuger/erzeuge-hub.js --alle"); process.exit(1);
}

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

/* Die Erwartung, unabhängig vom Hub geschrieben: WIFI:-Format nach
   ZXing, Sonderzeichen \ ; , : " mit Backslash. */
function erwartet(netz, pass) {
  const m = s => s.split("").map(c => '\\;,:"'.includes(c) ? "\\" + c : c).join("");
  return "WIFI:T:WPA;S:" + m(netz) + ";P:" + m(pass) + ";;";
}

const NETZ = 'Café "Süd";1';
const PASS = 'p;a,ss:wö\\rd"42';

async function hubAuf(browser, slug, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: opt.breite || 390, height: 844 } });
  const s = await ctx.newPage();
  const fehler = [], libAnfragen = [];
  s.on("pageerror", e => fehler.push(e.message));
  await s.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith("file://")) return r.continue();
    if (/\/lib\/qrcode-generator-2\.0\.4\.js$/.test(u)) {
      libAnfragen.push(u);
      let body = fs.readFileSync(LIB, "utf8");
      if (opt.manipuliert) body = body.replace("var qrcode = function() {", "window.__boese = 1;\nvar qrcode = function() {");
      return r.fulfill({ status: 200, contentType: "application/javascript", headers: { "access-control-allow-origin": "*" }, body });
    }
    return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await s.addInitScript(() => {
    try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch (e) {}
    window.__kopie = [];
    try {
      Object.defineProperty(navigator, "clipboard", { configurable: true,
        value: { writeText: t => { window.__kopie.push(t); return Promise.resolve(); } } });
    } catch (e) {}
  });
  await s.goto(HUB(slug) + "#/");
  await s.waitForTimeout(900);
  return { ctx, s, fehler, libAnfragen };
}

async function qrLesen(s) {
  await s.addScriptTag({ path: JSQR });
  return s.evaluate(async () => {
    const svg = document.querySelector("#wlanQr svg");
    if (!svg) return { fehler: "kein SVG" };
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement("canvas"); c.width = c.height = 480;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, 480, 480);
    const d = g.getImageData(0, 0, 480, 480);
    const code = jsQR(d.data, 480, 480);
    if (!code) return { fehler: "nicht lesbar" };
    /* jsQR liefert die Bytes; als UTF-8 lesen. */
    return { text: new TextDecoder("utf-8").decode(new Uint8Array(code.binaryData)) };
  });
}

function lum(rgb) {
  const m = String(rgb).match(/[\d.]+/g); if (!m) return null;
  const k = m.slice(0, 3).map(v => { v = +v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  return .2126 * k[0] + .7152 * k[1] + .0722 * k[2];
}
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return x === null || y === null ? 0 : (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

(async () => {
  const browser = await chromium.launch();
  pruef(G_NETZ === 32 && G_PASS === 63, "Voraussetzung: Grenzen aus migration-wlan.sql gelesen", G_NETZ + " / " + G_PASS);

  for (const slug of ["chocolamour", "blend"]) {
    console.log("\n══ " + slug + " ══");

    /* ── Platzhalter aus dem Markenblatt zählt als leer ── */
    if (slug === "chocolamour") {
      const { ctx, s, fehler } = await hubAuf(browser, slug);
      await s.evaluate(() => { location.hash = "#/wlan"; });
      await s.waitForTimeout(400);
      const m = await s.evaluate(() => ({ text: document.getElementById("inhalt").innerText,
        knoepfe: document.querySelectorAll(".wlan-knoepfe .knopf").length }));
      pruef(!/BITTE/i.test(m.text) && m.knoepfe === 0 && /Team/.test(m.text),
        "Markenblatt-Platzhalter „BITTE-EINTRAGEN“ wird nicht gezeigt — stattdessen ein Satz", JSON.stringify(m.text.slice(0, 120)));
      pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
      await ctx.close();
    }

    /* ── Live-Werte: verborgen, zwei Knöpfe, Kopieren, QR ── */
    {
      const { ctx, s, fehler, libAnfragen } = await hubAuf(browser, slug);
      await s.evaluate(([netz, pass]) => {
        betriebsTeileAnwenden({ hub_texte: { wlan_netz: netz, wlan_passwort: pass } }, true);
        location.hash = "#/wlan";
      }, [NETZ, PASS]);
      await s.waitForTimeout(450);
      const m = await s.evaluate(pass => {
        const inh = document.getElementById("inhalt");
        const k = [...inh.querySelectorAll(".wlan-knoepfe .knopf")].map(b => {
          const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
          let bg = cs.backgroundColor, el = b;
          while (el && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { el = el.parentElement; bg = el ? getComputedStyle(el).backgroundColor : "rgb(0,0,0)"; }
          return { text: b.textContent.trim(), w: r.width, h: r.height, farbe: cs.color, grund: bg };
        });
        return { sichtbar: inh.innerText.includes(pass), html: inh.innerHTML.includes(pass) || inh.innerHTML.includes(pass.replace(/"/g, "&quot;")),
                 netz: (inh.querySelector(".wlan-netz") || {}).textContent || "", k,
                 hinweis: !!inh.querySelector(".hinweis"), ueber: document.documentElement.scrollWidth - innerWidth };
      }, PASS);
      pruef(!m.sichtbar && !m.html, "das Passwort steht nirgends auf der Seite (Text und Auszeichnung)");
      pruef(m.netz.includes(NETZ), "der Netzname steht da (live aus hub_texte, als Text)", m.netz);
      pruef(m.k.length === 2 && m.k.every(b => b.w >= 44 && b.h >= 44), "genau zwei Knöpfe, je ≥ 44 px",
        m.k.map(b => b.text + " " + Math.round(b.w) + "×" + Math.round(b.h)).join(" | "));
      pruef(m.k.every(b => kontrast(b.farbe, b.grund) >= 4.5), "Schrift der Knöpfe ≥ 4,5:1",
        m.k.map(b => kontrast(b.farbe, b.grund).toFixed(2)).join(" / "));
      pruef(!m.hinweis, "keine lange Erklärung (kein Hinweis-Kasten)");
      pruef(m.ueber <= 0, "390 px: nichts läuft seitlich über", m.ueber + " px");
      pruef(libAnfragen.length === 0, "QR-Bibliothek noch NICHT geladen (erst beim Tipp)", libAnfragen.length + " Anfragen");

      await s.click('.wlan-knoepfe [data-aktion="kopieren"]');
      await s.waitForTimeout(200);
      const kopie = await s.evaluate(() => window.__kopie.slice());
      pruef(kopie.length === 1 && kopie[0] === PASS, "„Passwort kopieren“ legt GENAU das Passwort in die Zwischenablage", JSON.stringify(kopie));
      const nachher = await s.evaluate(pass => document.getElementById("inhalt").innerText.includes(pass), PASS);
      pruef(!nachher, "auch nach dem Kopieren steht das Passwort nicht auf dem Schirm");

      const qk = '.wlan-knoepfe [data-aktion="wlanqr"]';
      await s.click(qk);
      await s.waitForFunction(() => !!document.querySelector("#wlanQr svg"), null, { timeout: 4000 }).catch(() => {});
      const z = await s.evaluate(q => { const b = document.querySelector(q), feld = document.getElementById("wlanQr");
        const r = feld.getBoundingClientRect();
        return { offen: !feld.hidden, aria: b.getAttribute("aria-expanded"), text: b.textContent.trim(), breite: r.width,
                 imBild: r.left >= 0 && r.right <= innerWidth }; }, qk);
      pruef(z.offen && z.aria === "true" && z.text === "QR-Code ausblenden", "Tipp zeigt den QR-Code, der Knopf sagt es (aria-expanded)", JSON.stringify(z));
      pruef(z.breite >= 200 && z.imBild, "QR-Code groß genug zum Scannen und ganz im Bild", Math.round(z.breite) + " px");
      pruef(libAnfragen.length === 1, "QR-Bibliothek genau einmal geholt", libAnfragen.length);
      const gelesen = await qrLesen(s);
      const soll = erwartet(NETZ, PASS);
      pruef(gelesen.text === soll, "QR-Code zurückgelesen = WIFI:-Zeile mit maskierten Sonderzeichen und Umlaut",
        JSON.stringify(gelesen.text || gelesen.fehler) + " (soll " + JSON.stringify(soll) + ")");
      await s.click(qk);
      const zu = await s.evaluate(q => ({ hidden: document.getElementById("wlanQr").hidden,
        aria: document.querySelector(q).getAttribute("aria-expanded") }), qk);
      pruef(zu.hidden && zu.aria === "false", "zweiter Tipp blendet ihn wieder aus", JSON.stringify(zu));
      pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
      await ctx.close();
    }
  }

  console.log("\n══ Sicherheit, Grenzen, Sprache ══");
  {
    const { ctx, s, fehler } = await hubAuf(browser, "chocolamour", { manipuliert: true });
    await s.evaluate(() => { betriebsTeileAnwenden({ hub_texte: { wlan_netz: "Gast", wlan_passwort: "geheim123" } }, true); location.hash = "#/wlan"; });
    await s.waitForTimeout(400);
    await s.click('.wlan-knoepfe [data-aktion="wlanqr"]');
    await s.waitForTimeout(1200);
    const m = await s.evaluate(() => ({ boese: window.__boese === 1, svg: !!document.querySelector("#wlanQr svg"),
      satz: (document.getElementById("wlanQr").textContent || "").trim() }));
    pruef(!m.boese && !m.svg && /Kopieren geht trotzdem/.test(m.satz),
      "veränderte Bibliotheksdatei wird NICHT ausgeführt (integrity), der Gast bekommt einen Satz", JSON.stringify(m));
    await ctx.close();
  }
  {
    const { ctx, s, fehler } = await hubAuf(browser, "chocolamour");
    const m = await s.evaluate(([gn, gp]) => {
      window.__xss = 0;
      betriebsTeileAnwenden({ hub_texte: { wlan_netz: '<img src=x onerror="window.__xss=1">', wlan_passwort: "a" } }, true);
      location.hash = "#/wlan";
      return new Promise(ok => setTimeout(() => {
        const r = { xss: window.__xss, text: (document.querySelector(".wlan-netz") || {}).textContent || "" };
        betriebsTeileAnwenden({ hub_texte: { wlan_netz: "N".repeat(gn + 10), wlan_passwort: "P".repeat(gp + 10) } }, true);
        r.netzLaenge = wlanDaten().netz.length; r.passLaenge = wlanDaten().passwort.length;
        betriebsTeileAnwenden({ hub_texte: { wlan_netz: 42, wlan_passwort: { x: 1 } } }, true);
        r.zahl = JSON.stringify(wlanDaten());
        betriebsTeileAnwenden({ hub_texte: { wlan_netz: "Live-Netz", wlan_passwort: "live" } }, true);
        r.live = wlanDaten().netz;
        ok(r);
      }, 350));
    }, [G_NETZ, G_PASS]);
    pruef(m.xss === 0 && m.text.includes("<img"), "Netzname nur als Text (onerror läuft nicht)", JSON.stringify(m.text));
    pruef(m.netzLaenge === G_NETZ && m.passLaenge === G_PASS, "Hub kürzt genau an den Grenzen der Datenbank", m.netzLaenge + " / " + m.passLaenge);
    pruef(m.live === "Live-Netz" && !/\[object|42/.test(m.zahl), "live schlägt Markenblatt; Nicht-Text wird verworfen", m.live + " · " + m.zahl);
    /* Englisch über das echte Menü. */
    await s.evaluate(() => { location.hash = "#/wlan"; });
    await s.waitForTimeout(300);
    await s.click("#sprachknopf"); await s.click('#sprachliste [data-sprache="en"]');
    await s.waitForTimeout(400);
    const en = await s.evaluate(() => [...document.querySelectorAll(".wlan-knoepfe .knopf")].map(b => b.textContent.trim()));
    pruef(en[0] === "Copy password" && en[1] === "Show QR code", "Englisch: beide Knöpfe übersetzt", en.join(" | "));
    pruef(!fehler.length, "keine Ausnahme", fehler.join(" | ") || "still");
    await ctx.close();
  }
  {
    const { ctx, s } = await hubAuf(browser, "blend", { breite: 360 });
    await s.evaluate(() => { betriebsTeileAnwenden({ hub_texte: { wlan_netz: "Ein-sehr-langer-WLAN-Name-mit-32", wlan_passwort: "x" } }, true); location.hash = "#/wlan"; });
    await s.waitForTimeout(400);
    await s.click('.wlan-knoepfe [data-aktion="wlanqr"]');
    await s.waitForTimeout(800);
    const u = await s.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    pruef(u <= 0, "360 px mit langem Namen und offenem QR: nichts läuft über", u + " px");
    await ctx.close();
  }

  console.log("\n══ Board: Felder, Vorschau, Übernehmen ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
    const p = await ctx.newPage(); const fehler = [];
    p.on("pageerror", e => fehler.push(String(e).slice(0, 200)));
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto(ADMIN); await p.waitForTimeout(700);
    await p.evaluate(() => { document.getElementById("tor").hidden = true;
      if (typeof demoStarten === "function") { demoStarten(); zeichneAlles(); } });
    await p.waitForTimeout(400);
    await p.evaluate(() => { HUBTEXTE = { claim: "Alt-Slogan", wlan_netz: "Gast-Alt", wlan_passwort: "alt123" };
      const r = document.querySelector('[data-tafel="einstellungen"]'); if (r) r.click(); });
    await p.waitForTimeout(400);
    const felder = await p.evaluate(() => ["hubWlanNetz", "hubWlanPasswort"].map(id => { const el = document.getElementById(id);
      return el ? { max: +el.getAttribute("maxlength"), wert: el.value, gruppe: (el.closest(".egruppe").querySelector(".etitel") || {}).textContent,
        groesse: parseFloat(getComputedStyle(el).fontSize) } : null; }));
    pruef(felder.every(Boolean) && felder[0].max === G_NETZ && felder[1].max === G_PASS,
      "Board: zwei Felder, nehmen genau so viel wie die Datenbank", JSON.stringify(felder.map(x => x && x.max)));
    pruef(felder.every(x => x && x.gruppe === "Ihre Worte im Gast-Hub" && x.groesse >= 16), "… in „Ihre Worte im Gast-Hub“, Schrift ≥ 16 px");
    pruef(felder[0].wert === "Gast-Alt" && felder[1].wert === "alt123", "gespeicherter Stand wird in die Felder geladen", felder.map(x => x.wert).join(" / "));
    const r = await p.evaluate(async () => {
      const gesendet = [];
      const alt = hvSenden; hvSenden = (art, teil, ziel) => { gesendet.push(teil); };
      const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
      set("hubWlanNetz", "Gast-Neu"); set("hubWlanPasswort", "neu456");
      hvSenden = alt;
      const vor = (gesendet[gesendet.length - 1] || {}).hub_texte || {};
      await hubTexteSichern();
      const a = Object.assign({}, HUBTEXTE);
      document.getElementById("hubTexteZurueck").click();
      const nachZurueck = [document.getElementById("hubClaim").value, document.getElementById("hubWlanNetz").value, document.getElementById("hubWlanPasswort").value];
      await hubTexteSichern();
      return { vor, a, nachZurueck, b: Object.assign({}, HUBTEXTE) };
    });
    pruef(r.vor.wlan_netz === "Gast-Neu" && r.vor.wlan_passwort === "neu456", "Tippen schickt das WLAN an die Vorschau", JSON.stringify(r.vor));
    pruef(r.a.wlan_netz === "Gast-Neu" && r.a.wlan_passwort === "neu456" && r.a.claim === "Alt-Slogan",
      "„Übernehmen“ legt das WLAN in hub_texte UND behält den Slogan", JSON.stringify(r.a));
    pruef(r.nachZurueck[0] === "" && r.nachZurueck[1] === "Gast-Neu" && r.nachZurueck[2] === "neu456",
      "„Auf Vorgabe zurück“ leert die Worte, lässt das WLAN", JSON.stringify(r.nachZurueck));
    pruef(r.b.wlan_passwort === "neu456" && !r.b.claim, "… und das nächste „Übernehmen“ verliert das Passwort nicht", JSON.stringify(r.b));
    pruef(!fehler.length, "keine Ausnahme im Board", fehler.join(" | ") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  console.log(f ? f + " FEHLER" : "Alles sauber.");
  process.exit(f ? 1 : 0);
})();
