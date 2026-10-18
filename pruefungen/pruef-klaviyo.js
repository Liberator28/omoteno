/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Klaviyo: Besuche melden, Vorlagen, Übersicht für den Besitzer

     NODE_PATH=$(npm root -g) node pruefungen/pruef-klaviyo.js

   Vier Nähte, jede gegen eine ZWEITE Quelle gehalten (§8.1b, §8.1i):

   1. SQL → Board. Jedes Feld, das das Board aus der Übersicht liest
      (nluZeichnen: z.<feld>), baut gaeste_uebersicht() in
      migration-gaeste-uebersicht.sql wirklich. Ein verrutschter Name
      zeigte still „0“ — und 0 sieht aus wie „keine Gäste“.
   2. Edge → Board. Jeder Grund, den newsletter-uebersicht zurückgeben
      kann, hat im Board einen Satz (Ausnahmen namentlich). Und
      newsletter-vorrat-auffuellen prüft den Klaviyo-Schlüssel, BEVOR
      sie einen Code anlegt (Befund 09.10.: 20 Codes in Supabase, 0 bei
      Klaviyo, und das Board sagte „20 neue Codes angelegt“).
   3. Datenbank → Klaviyo → Vorlage. Was die Vorlagen per
      person|lookup lesen, setzt klaviyo-profil-melden auch; der
      Besuchs-Trigger meldet nur eine ERHÖHUNG von besuche, der
      Bestell-Trigger nichts Markiertes und keinen Serviceruf. Die
      erzeugten Vorlagen tragen Coupon-Tag und Abmeldelink, und ihre
      Schrift hat ≥ 4,5:1 auf dem Grund, auf dem sie steht (im Browser
      gerechnet, nicht aus dem Markenblatt abgeschrieben).
   4. Was der Gast liest. Der Satz neben dem E-Mail-Feld im Hub nennt,
      was gemerkt wird und dass Klaviyo verschickt — in jeder Sprache;
      die Datenschutzseite führt Klaviyo als Dienstleister. Kein
      „wöchentlich“ mehr im Board: Einen Wochen-Ablauf gibt es nicht.

   Dazu das Board selbst, mit gestelltem db und gestellter Funktion
   (über den ECHTEN Weg betriebWaehlen(), wie pruef-rollen.js):
   Zahlen, Abläufe mit Stand und Link, die Codes-Lücke als Satz,
   fehlender Schlüssel als Satz (Zahlen bleiben), Netzfehler als Satz,
   Team ruft die Funktion gar nicht erst, Werte aus Klaviyo landen
   nie als Auszeichnung, 360 px ohne Überlauf, Kontrast hell UND
   dunkel.

   EHRLICHE GRENZE: Die echte Klaviyo-API (Flow-Stand, Codes zählen)
   ist hier gestellt. Gemessen ist sie nur über das Klaviyo-Werkzeug
   (dieselben Adressen, am 09.10.) und erst mit gesetztem
   KLAVIYO_API_KEY am Server.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");

/* Seit 18.10. liegt jede Einstellungsgruppe hinter einer Kachel. Öffnet
   die Unterseite, in der `sel` steht — über einen ECHTEN Tipp auf die
   Kachel (vorher „Alle Einstellungen“, falls eine andere offen ist).
   Gibt false, wenn es die Gruppe nicht gibt (Voraussetzung, §8.1g). */
async function euZu(p, sel) {
  const id = await p.evaluate(s => {
    const el = document.querySelector(s);
    const g = el && el.closest("#t-einstellungen > .egruppe");
    return g && !g.classList.contains("eu-uebersicht") ? g.id : null;
  }, sel);
  if (!id) return false;
  if (await p.evaluate(i => document.getElementById("t-einstellungen").dataset.euOffen === i, id)) return true;
  if (await p.isVisible("#euZurueck")) await p.click("#euZurueck");
  await p.click('[data-eu-seite="' + id + '"]');
  await p.waitForTimeout(150);
  return p.evaluate(i => document.getElementById("t-einstellungen").dataset.euOffen === i, id);
}
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const lies = p => fs.readFileSync(path.join(OBEN, p), "utf8");
const ADMIN = path.join(OBEN, "seiten", "admin.html");

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

const admin   = lies("seiten/admin.html");
const sqlUeb  = lies("datenbank/migration-gaeste-uebersicht.sql");
const sqlBes  = lies("datenbank/migration-klaviyo-besuch.sql");
const edgeUeb = lies("supabase/functions/newsletter-uebersicht/index.ts");
const edgeVor = lies("supabase/functions/newsletter-vorrat-auffuellen/index.ts");
const edgePro = lies("supabase/functions/klaviyo-profil-melden/index.ts");
const hub     = lies("vorlagen/hub.vorlage.html");
const ds      = lies("seiten/datenschutz.html");

/* ── 1 · SQL → Board ─────────────────────────────────────────────── */
console.log("\n══ 1 · Felder der Übersicht: Board liest, was die SQL baut ══");
const sqlFelder = new Set([...sqlUeb.matchAll(/'([a-z_0-9]+)',\s*(?:count|\(|true|coalesce|jsonb)/g)].map(m => m[1]));
const zeichnen = (admin.match(/function nluZeichnen\(antw\)\{[\s\S]*?\n\}/) || [""])[0];
pruef(zeichnen.length > 200, "nluZeichnen im Board gefunden", zeichnen.length + " Zeichen");
const boardFelder = new Set([...zeichnen.matchAll(/\bz\.([a-z_0-9]+)/g)].map(m => m[1]));
pruef(boardFelder.size >= 8, "Board liest mindestens acht Felder", [...boardFelder].join(", "));
const fehlend = [...boardFelder].filter(x => !sqlFelder.has(x));
pruef(fehlend.length === 0, "jedes gelesene Feld baut gaeste_uebersicht() auch", fehlend.length ? "fehlt: " + fehlend.join(", ") : [...sqlFelder].join(", "));
pruef(/rpc\("gaeste_uebersicht",\s*\{\s*p_betrieb:/.test(edgeUeb) && /gaeste_uebersicht\(p_betrieb uuid\)/.test(sqlUeb),
  "Edge ruft gaeste_uebersicht mit dem Parameternamen der Funktion");
pruef(/not public\.ist_inhaber\(p_betrieb\)/.test(sqlUeb) && /revoke execute on function public\.gaeste_uebersicht\(uuid\) from public, anon/.test(sqlUeb),
  "nur Inhaber, anon ohne EXECUTE");

/* ── 2 · Edge → Board ────────────────────────────────────────────── */
console.log("\n══ 2 · Gründe der Funktionen haben im Board einen Satz ══");
const gruende = new Set([...edgeUeb.matchAll(/grund:\s*(?:fehlt \? )?"([a-z_]+)"(?:\s*:\s*"([a-z_]+)")?/g)].flatMap(m => [m[1], m[2]]).filter(Boolean));
const AUSNAHMEN = { kein_json: "kommt nur bei kaputtem Aufruf, das Board schickt immer JSON → allgemeiner Satz" };
const satzBlock = (admin.match(/const NLU_GRUND = \{[\s\S]*?\n\};/) || [""])[0];
const ohneSatz = [...gruende].filter(g => !AUSNAHMEN[g] && !new RegExp("\\b" + g + ":").test(satzBlock));
pruef(gruende.size >= 4, "Gründe der Übersicht-Funktion gelesen", [...gruende].join(", "));
pruef(ohneSatz.length === 0, "jeder Grund hat einen Satz (Ausnahmen namentlich)", ohneSatz.join(", ") || Object.keys(AUSNAHMEN).join(", ") + " ausgenommen");
const iSchl = edgeVor.indexOf("if (!KLAVIYO_KEY)"), iAnl = edgeVor.indexOf('rpc("rabattcode_anlegen"');
pruef(iSchl > 0 && iAnl > 0 && iSchl < iAnl, "Vorrat: Schlüssel geprüft, BEVOR ein Code angelegt wird",
  "Schlüssel bei " + iSchl + ", rabattcode_anlegen bei " + iAnl);
pruef(/if \(!KLAVIYO_KEY\) return antwort\(\{ ok: false, fehler: "kein_klaviyo_schluessel" \}\)/.test(edgeVor),
  "ohne Schlüssel: ok:false mit Grund (nicht ok:true)");
pruef(/kein_klaviyo_schluessel: "[^"]*nichts angelegt/.test(admin), "Board sagt ohne Schlüssel „nichts angelegt“");
pruef(!/Bearer|pk_[A-Za-z0-9]{10,}/.test(edgeUeb), "kein Schlüssel im Quelltext der Übersicht");

/* ── 3 · Datenbank → Klaviyo → Vorlage ───────────────────────────── */
console.log("\n══ 3 · Trigger, Eigenschaften, Vorlagen ══");
const besuch = (sqlBes.match(/function public\.gaeste_besuch_melden\(\)[\s\S]*?end \$function\$/) || [""])[0];
pruef(/new\.besuche is not distinct from old\.besuche or new\.besuche < old\.besuche then return new/.test(besuch),
  "Besuchs-Trigger meldet nur eine Erhöhung von besuche");
pruef(/newsletter_aktiv is true/.test(besuch) && /email/.test(besuch), "… nur mit Adresse und eingeschaltetem Newsletter");
pruef(/jsonb_build_object\('gast_id', new\.id, 'art', 'besuch'\)/.test(besuch), "… schickt nur eine id, den Inhalt holt die Funktion (§2.3d)");
const bestell = (sqlBes.match(/function public\.bestellung_klaviyo_melden\(\)[\s\S]*?end \$function\$/) || [""])[0];
pruef(/coalesce\(new\.pruefen, false\)/.test(bestell) && /new\.quelle = 'service'/.test(bestell),
  "Bestell-Trigger meldet nichts Markiertes und keinen Serviceruf");
const gesetzt = new Set([...edgePro.matchAll(/e\[p \+ "([a-z_]+)"\]/g)].map(m => m[1]));
pruef(gesetzt.has("letzter_besuch") && gesetzt.has("liebling"), "klaviyo-profil-melden setzt letzter_besuch und liebling", [...gesetzt].join(", "));

execFileSync("node", [path.join(OBEN, "erzeuger/erzeuge-newsletter-vorlage.js"), "--alle"], { stdio: "pipe" });
execFileSync("node", [path.join(OBEN, "erzeuger/erzeuge-newsletter-vorlage.js"), "--alle", "--art", "rueckholung"], { stdio: "pipe" });
const slugs = fs.readdirSync(path.join(OBEN, "markenblaetter")).filter(x => x.endsWith(".json")).map(x => x.slice(0, -5));
const vorlagen = [];
for (const slug of slugs) for (const art of ["gutschein", "rueckholung"]) {
  const datei = path.join(OBEN, "dist-newsletter", slug + (art === "rueckholung" ? "-rueckholung" : "") + ".html");
  vorlagen.push({ slug, art, datei, html: fs.readFileSync(datei, "utf8") });
}
for (const v of vorlagen) {
  const coupon = v.html.includes("{% coupon_code '" + v.slug + "_newsletter' %}");
  const ab = /\{% unsubscribe/.test(v.html);
  const lookups = [...v.html.matchAll(/lookup:'omoteno_([a-z0-9]+)_([a-z_]+)'/g)];
  const fremd = lookups.filter(m => m[1] !== v.slug || !gesetzt.has(m[2])).map(m => m[0]);
  pruef(coupon && ab && fremd.length === 0, v.slug + " · " + v.art + ": Coupon-Tag, Abmeldelink, nur gesetzte Eigenschaften",
    (coupon ? "" : "Coupon fehlt ") + (ab ? "" : "Abmeldung fehlt ") + (fremd.length ? "fremd: " + fremd.join(", ") : lookups.length + " lookup"));
}

/* ── 4 · Was der Gast liest ──────────────────────────────────────── */
console.log("\n══ 4 · Satz im Hub, Datenschutz, keine falschen Versprechen ══");
const hubSatz = (hub.match(/t\("(Wofür: [^"]+)"\)/) || [])[1] || "";
pruef(/Klaviyo/.test(hubSatz) && /zuletzt/.test(hubSatz) && /gern bestellen/.test(hubSatz),
  "Hub-Satz nennt Besuch, Lieblingsbestellung und Klaviyo", hubSatz.slice(0, 70) + " …");
const eintrag = hub.split("\n").find(z => z.startsWith('"' + hubSatz.replace(/"/g, '\\"') + '":{')) || "";
const sprachen = [...eintrag.matchAll(/(?:\{|,)([a-z]{2}):"((?:[^"\\]|\\.)*)"/g)];
pruef(sprachen.length === 11, "Wörterbucheintrag in elf Sprachen", sprachen.map(m => m[1]).join(" "));
const ohneK = sprachen.filter(m => !/Klaviyo/.test(m[2])).map(m => m[1]);
pruef(ohneK.length === 0, "jede Übersetzung nennt Klaviyo", ohneK.join(", ") || "alle");
const tabelle = (ds.match(/id="empfaenger"[\s\S]*?<\/table>/) || [""])[0];
pruef(/<td>Klaviyo, Inc\.<\/td>/.test(tabelle), "Datenschutz: Klaviyo in der Liste der Dienstleister");
const hubAbschnitt = (ds.match(/id="hub"[\s\S]*?<h2/) || [""])[0];
pruef(/Klaviyo/.test(hubAbschnitt) && /letzten Besuchs/.test(hubAbschnitt) && /Abmeldelink/.test(hubAbschnitt),
  "Datenschutz: was an Klaviyo geht, und der Widerspruch");
pruef(!/wöchentlich|Wochen-Flow/i.test(admin), "Board verspricht keinen wöchentlichen Gutschein");

/* ── Board mit gestellter Funktion ───────────────────────────────── */
function stelleDb() {
  return ({ rolle, antwort, fehler }) => {
    window.__aufrufe = [];
    function ergebnis(z) {
      if (z.tab === "betrieb_mitglieder")
        return { data: [{ rolle, betriebe: { id: "b-probe", slug: "chocolamour", name: "Probe", bestell_pause: false,
          newsletter_aktiv: true, hub_texte: {} } }], error: null };
      return { data: z.einzeln ? null : [], error: null, count: 20 };
    }
    function kette(tab) {
      const z = { tab, einzeln: false };
      const p = new Proxy(function () {}, {
        get(_, k) {
          if (k === "then") return (res) => res(ergebnis(z));
          return () => { if (k === "maybeSingle" || k === "single") z.einzeln = true; return p; };
        },
        apply() { return p; }
      });
      return p;
    }
    db = {
      from: kette, rpc: () => kette("rpc"), channel: () => kette("kanal"), removeChannel: async () => {},
      storage: { from: () => kette("speicher") },
      functions: { invoke: async (name, o) => {
        window.__aufrufe.push({ name, body: o && o.body });
        if (name !== "newsletter-uebersicht") return { data: null, error: null };
        if (fehler) return { data: null, error: { message: "Failed to fetch" } };
        return { data: antwort, error: null };
      } },
      auth: {
        getSession: async () => ({ data: { session: null } }),
        getUser: async () => ({ data: { user: { id: "u1", email: "probe@example.org" } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
      }
    };
    demo = false;
  };
}

const ZAHLEN = { ok: true, gaeste: 37, mit_mail: 12, aktiv_20: 9, vermisst: 4, vorrat: 20, eingeloest_30: 3,
  umsatz_code_30: 41.5, newsletter_aktiv: true, liste: true,
  flows: [{ art: "rueckholung", flow_id: "X7LHLy" }, { art: "willkommen", flow_id: "Vw3752" }] };

async function oeffnen(browser, fall, breite) {
  const ctx = await browser.newContext({ viewport: { width: breite || 390, height: 900 } });
  const seite = await ctx.newPage();
  const fehler = [];
  seite.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await seite.addInitScript(w => { window.__fw = w; }, farbWerkzeug.toString());
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(600);
  const scharf = await seite.$("#scharfJetzt");
  if (scharf && await seite.isVisible("#scharf")) { await scharf.click(); await seite.waitForTimeout(150); }
  await seite.evaluate(stelleDb(), fall);
  await seite.evaluate(async () => {
    document.getElementById("tor").hidden = true;
    try { localStorage.setItem(merkSchluessel(), "b-probe"); } catch (e) {}
    await betriebWaehlen();
  });
  await seite.waitForTimeout(500);
  return { ctx, seite, fehler };
}

const lesen = () => {
  const t = s => [...document.querySelectorAll(s)];
  return {
    kacheln: t("#nluKacheln .aw-kpi").map(k => k.querySelector(".aw-titel").textContent + "=" + k.querySelector(".aw-wert").textContent),
    klein: t("#nluKacheln .aw-klein").map(k => k.textContent),
    ablaeufe: t("#nluAblaeufe .nlu-ablauf").map(li => ({
      name: (li.querySelector(".nlu-name") || {}).textContent,
      stand: (li.querySelector(".nlu-stand") || {}).textContent || "",
      href: (li.querySelector("a") || {}).href, ziel: (li.querySelector("a") || {}).target,
      rel: (li.querySelector("a") || {}).rel })),
    satz: document.querySelector("#nluSatz").textContent,
    warn: document.querySelector("#nluSatz").classList.contains("warn"),
    bilder: document.querySelectorAll("#nlUebersicht img, #nlUebersicht [onerror]").length,
    aufrufe: window.__aufrufe
  };
};

(async () => {
  const browser = await chromium.launch();

  console.log("\n══ Board · Inhaber, Klaviyo antwortet (Entwürfe, 0 Codes bei Klaviyo) ══");
  {
    const antwort = { ok: true, zahlen: ZAHLEN, klaviyo: { ok: true, codes_frei: 0, codes_mehr: false,
      flows: [{ id: "X7LHLy", name: "<img src=x onerror=alert(1)>", status: "draft" }, { id: "Vw3752", status: "<b>live</b>" }] } };
    const { ctx, seite, fehler } = await oeffnen(browser, { rolle: "inhaber", antwort });
    const s = await seite.evaluate(lesen);
    const ruf = s.aufrufe.filter(a => a.name === "newsletter-uebersicht");
    pruef(ruf.length === 1 && JSON.stringify(ruf[0].body) === '{"betrieb_id":"b-probe"}',
      "genau ein Aufruf, Nutzlast nur die Betriebs-id", JSON.stringify(ruf.map(r => r.body)));
    pruef(s.kacheln.join("|") === "Gäste mit E-Mail=12|Da in 20 Tagen=9|Vermisst=4|Mit Code bestellt=3",
      "vier Zahlen aus der Antwort", s.kacheln.join(" | "));
    pruef(s.klein[0] === "von 37 Gästen" && /41,50 €/.test(s.klein[3]), "Bezug und Umsatz mit Code", s.klein.join(" | "));
    pruef(s.ablaeufe.length === 2 && s.ablaeufe[0].name === "Erinnerung nach 20 Tagen" && s.ablaeufe[1].name === "Willkommensgutschein",
      "zwei Abläufe mit eigenem Namen (nicht dem aus Klaviyo)", s.ablaeufe.map(a => a.name).join(", "));
    pruef(s.ablaeufe[0].stand === "Entwurf" && s.ablaeufe[1].stand === "Unbekannt",
      "Stand als Wort; ein unbekannter Wert wird „Unbekannt“, nicht Auszeichnung", s.ablaeufe.map(a => a.stand).join(", "));
    pruef(s.bilder === 0, "nichts aus Klaviyo als Auszeichnung im Block", s.bilder + " img/onerror");
    pruef(s.ablaeufe[0].href === "https://www.klaviyo.com/flow/X7LHLy/edit" && s.ablaeufe[0].ziel === "_blank" && /noopener/.test(s.ablaeufe[0].rel),
      "Link auf den Ablauf in Klaviyo, neues Fenster, noopener", s.ablaeufe[0].href);
    pruef(/20 freie Codes in omoteno, 0 bei Klaviyo/.test(s.satz) && /Ohne Codes bei Klaviyo/.test(s.satz) && s.warn,
      "die Lücke Supabase ↔ Klaviyo steht als Warnung da", s.satz.slice(0, 90) + " …");
    pruef(/Entwürfe/.test(s.satz), "„alles Entwurf“ wird gesagt (keine Mail geht hinaus)");
    pruef(fehler.length === 0, "keine Seitenfehler", fehler.join(" | "));

    /* Bild: Gruppe sichtbar machen, Überlauf und Kontrast bei 360 px. */
    await tafel(seite, "einstellungen");
    pruef(await euZu(seite, "#nlUebersicht"), "Voraussetzung: Unterseite Newsletter über ihre Kachel geöffnet");
    for (const breite of [360, 1280]) {
      await seite.setViewportSize({ width: breite, height: 900 });
      for (const licht of ["dunkel", "hell"]) {
        await seite.evaluate(l => document.body.classList.toggle("hell", l === "hell"), licht);
        await seite.evaluate(() => document.getElementById("nlUebersicht").scrollIntoView());
        await seite.waitForTimeout(120);
        const m = await seite.evaluate(messen);
        if (!m.sichtbar) { pruef(false, breite + " px " + licht + ": Übersicht sichtbar (Voraussetzung)"); continue; }
        pruef(m.ueberlauf <= 1, breite + " px " + licht + ": nichts läuft seitlich über", m.ueberlauf + " px");
        const schlecht = m.paare.filter(p => p.k < 4.5);
        pruef(schlecht.length === 0, breite + " px " + licht + ": jede Schrift ≥ 4,5:1 (" + m.paare.length + " Stellen)",
          schlecht.length ? schlecht.map(p => p.was + " " + p.k.toFixed(2)).join(", ") : "kleinste " + Math.min(...m.paare.map(p => p.k)).toFixed(2));
        pruef(m.links.every(h => h >= 44), breite + " px " + licht + ": Links ≥ 44 px hoch", m.links.join(", "));
      }
    }
    await ctx.close();
  }

  console.log("\n══ Board · Schlüssel fehlt: Zahlen bleiben, ein Satz sagt warum ══");
  {
    const { ctx, seite } = await oeffnen(browser, { rolle: "inhaber", antwort: { ok: true, zahlen: ZAHLEN, klaviyo: { ok: false, grund: "kein_schluessel" } } });
    const s = await seite.evaluate(lesen);
    pruef(s.kacheln.length === 4, "Zahlen aus der Datenbank stehen trotzdem", s.kacheln.length + " Kacheln");
    pruef(/KLAVIYO_API_KEY/.test(s.satz) && s.warn, "Satz nennt den fehlenden Schlüssel", s.satz.slice(0, 80) + " …");
    pruef(s.ablaeufe.every(a => a.stand === "") && s.ablaeufe.length === 2, "Abläufe ohne erfundenen Stand, Link bleibt");
    await ctx.close();
  }

  console.log("\n══ Board · Netz weg, Migration fehlt ══");
  {
    const { ctx, seite } = await oeffnen(browser, { rolle: "inhaber", fehler: true });
    const s = await seite.evaluate(lesen);
    pruef(s.kacheln.length === 0 && /Übersicht nicht geladen/.test(s.satz), "Netzfehler: keine Zahlen, ein Satz", s.satz);
    await ctx.close();
    const b = await oeffnen(browser, { rolle: "inhaber", antwort: { ok: false, grund: "fehlt" } });
    const s2 = await b.seite.evaluate(lesen);
    pruef(/migration-gaeste-uebersicht\.sql/.test(s2.satz), "Migration fehlt: nennt die Datei", s2.satz);
    await b.ctx.close();
  }

  console.log("\n══ Board · Team ══");
  {
    const { ctx, seite } = await oeffnen(browser, { rolle: "team", antwort: { ok: true, zahlen: ZAHLEN, klaviyo: { ok: false, grund: "kein_schluessel" } } });
    const s = await seite.evaluate(lesen);
    const inert = await seite.evaluate(() => !!document.getElementById("nlUebersicht").closest("[inert]"));
    pruef(s.aufrufe.filter(a => a.name === "newsletter-uebersicht").length === 0, "Team ruft die Übersicht gar nicht erst");
    pruef(s.kacheln.length === 0 && /nur der Besitzer/.test(s.satz), "Team sieht keine Zahl, nur den Satz", s.satz);
    pruef(inert, "Block liegt in der gesperrten Gruppe (inert)");
    await ctx.close();
  }

  console.log("\n══ Vorlagen · Kontrast im gerenderten Bild ══");
  {
    const ctx = await browser.newContext({ viewport: { width: 600, height: 900 } });
    const seite = await ctx.newPage();
    await seite.addInitScript(w => { window.__fw = w; }, farbWerkzeug.toString());
    await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    for (const v of vorlagen) {
      await seite.goto("file://" + v.datei);
      const m = await seite.evaluate(messenVorlage);
      const schlecht = m.filter(p => p.k < 4.5);
      pruef(m.length > 5 && schlecht.length === 0, v.slug + " · " + v.art + ": jede Schrift ≥ 4,5:1 (" + m.length + " Stellen)",
        schlecht.length ? schlecht.map(p => JSON.stringify(p.was) + " " + p.k.toFixed(2)).join(", ") : "kleinste " + Math.min(...m.map(p => p.k)).toFixed(2));
    }
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? "✗ " + f + " von " + n + " Proben rot." : "✓ Alle " + n + " Proben grün."));
  process.exit(f ? 1 : 0);
})();

async function tafel(seite, name) {
  await seite.evaluate(n => { const k = document.querySelector('[data-tafel="' + n + '"]'); if (k) k.click(); }, name);
  await seite.waitForTimeout(300);
}

/* Läuft im Browser. Effektiver Grund = erste nicht durchsichtige
   Fläche in den Vorfahren (deckend gemischt). */
function farbWerkzeug() {
  /* Glas meldet sich als color(srgb 0.98 0.97 0.94 / 0.8) — Anteile
     0…1, nicht 0…255. Ohne diese Umrechnung las die Probe die helle
     Glasfläche als fast schwarz und meldete 1,35:1 (selbst erlebt). */
  const rgb = s => {
    s = String(s);
    const m = s.match(/[\d.]+/g) || [0, 0, 0, 0];
    const k = /^color\(srgb/.test(s) ? 255 : 1;
    return { r: m[0] * k, g: m[1] * k, b: m[2] * k, a: m[3] == null ? 1 : +m[3] };
  };
  const lum = c => [c.r, c.g, c.b].map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const grund = el => {
    const schichten = [];
    for (let e = el; e; e = e.parentElement) {
      const c = rgb(getComputedStyle(e).backgroundColor);
      if (c.a > 0) { schichten.push(c); if (c.a >= 1) break; }
    }
    let g = { r: 255, g: 255, b: 255 };
    for (const c of schichten.reverse()) g = { r: c.r * c.a + g.r * (1 - c.a), g: c.g * c.a + g.g * (1 - c.a), b: c.b * c.a + g.b * (1 - c.a) };
    return g;
  };
  const kontrast = el => {
    const g = grund(el), c = rgb(getComputedStyle(el).color);
    const t = { r: c.r * c.a + g.r * (1 - c.a), g: c.g * c.a + g.g * (1 - c.a), b: c.b * c.a + g.b * (1 - c.a) };
    const [x, y] = [lum(t), lum(g)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  return { kontrast };
}

function messen() {
  const { kontrast } = (new Function("return (" + window.__fw + ")()"))();
  const block = document.getElementById("nlUebersicht");
  const r = block.getBoundingClientRect();
  if (!r.width || !r.height) return { sichtbar: false };
  const gruppe = block.closest(".egruppe");
  const ueberlauf = Math.max(block.scrollWidth - block.clientWidth, gruppe.scrollWidth - gruppe.clientWidth,
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const paare = [...block.querySelectorAll("b,i,.aw-titel,.aw-wert,.aw-klein,.nlu-name,.nlu-stand,.nlu-link,.nlu-satz")]
    .filter(el => el.textContent.trim())
    .map(el => ({ was: el.className || el.tagName, k: kontrast(el) }));
  const links = [...block.querySelectorAll("a")].map(a => Math.round(a.getBoundingClientRect().height));
  return { sichtbar: true, ueberlauf, paare, links };
}

function messenVorlage() {
  const { kontrast } = (new Function("return (" + window.__fw + ")()"))();
  /* {% if %}/{% endif %} sind Klaviyos Steuerzeichen und verschwinden
     beim Versand — sie stehen als Text in der Zelle und hätten sonst
     die Vorgabefarbe auf dem Grund gemessen (1,18:1, ein Fehlalarm). */
  const echt = t => t.replace(/\{%[^%]*%\}/g, "").trim();
  const blaetter = [...document.querySelectorAll("body *")].filter(el =>
    [...el.childNodes].some(k => k.nodeType === 3 && echt(k.textContent)) && el.getBoundingClientRect().width);
  return blaetter.map(el => ({ was: el.textContent.trim().slice(0, 30), k: kontrast(el) }));
}
