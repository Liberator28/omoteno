/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Live-Vorschau im Board zeigt den ECHTEN Hub

     NODE_PATH=$(npm root -g) node pruefungen/pruef-vorschau.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle")

   > Anlass (26.09.2026). Wunsch des Betreibers: „wie ein direkter
   > Editor, wo man eine kleine Vorschau sieht wie im Hub“ — für alle
   > Textflächen des Gast-Hubs.

   Das Board lädt die ausgelieferte Hub-Datei als srcdoc (X-Frame-
   Options DENY bleibt) und ruft darin vorschauSetzen/-Zeige/-Messen.
   Geprüft wird die NAHT, nicht jede Seite für sich (§8.1i): Board und
   Hub laufen hier am Stück, der Hub ist die echte Datei aus dist/.

   1 · Startseite: Tippen in Banner- und Kacheltitel erscheint im
       Rahmen, ohne „Übernehmen“; ein zu langer Text meldet sich unter
       dem Feld — gemessen im Hub, nicht gezählt im Board.
   2 · Ihre Worte: Slogan erscheint im Kopf; Fokus auf den Gruß zeigt
       den Willkommensschirm mit diesem Gruß.
   3 · Aktion: der Aktionsname steht im Band der Vorschau.
   4 · Keine Spuren: Die Vorschau meldet keinen Besuch (gast_melden),
       schickt keine Bestellung, und ist nicht bedienbar.
   5 · Kein Fehler in Board UND Rahmen (§8.1l).
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const HUB = path.join(OBEN, "dist", "blend", "index.html");
const BASIS = "https://omoteno.test/h/";

let n = 0, f = 0;
const pruef = (g, t, z) => { n++; if(!g) f++;
  console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined ? "  → " + z : "")); };

const BILD = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#9ab"/></svg>';
const LANG_TITEL = "Probier gerne unsere neuen Speisen mit frischer Schokolade und warmem Karamell heute";
const LANG_TEXT  = ("Aus eigener Herstellung für die ganze Familie, mit frischer Schokolade, warmem Karamell " +
                    "und knusprigen Nüssen, jeden Tag frisch gebacken und mit viel Liebe serviert").slice(0, 160);

(async () => {
  if(!fs.existsSync(HUB)){ console.error("Kein erzeugter Hub. Erst: node erzeuger/erzeuge-hub.js --alle"); process.exit(1); }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const fehler = [], spuren = [];
  p.on("pageerror", e => fehler.push("Board: " + String(e).slice(0, 160)));
  p.on("console", m => { if(m.type() === "error" && !/net::ERR|Failed to load|ERR_FAILED/i.test(m.text()))
    fehler.push("Konsole: " + m.text().slice(0, 160)); });

  await p.addInitScript(b => { window.HUB_VORSCHAU_BASIS = b;
    Element.prototype.requestFullscreen = function(){ return Promise.resolve(); }; }, BASIS);
  await p.route("**/*", r => {
    const u = r.request().url();
    if(u.startsWith("file://")) return r.continue();
    if(u === BASIS + "blend/") return r.fulfill({ status:200, contentType:"text/html; charset=utf-8",
      headers:{ "Access-Control-Allow-Origin":"*" }, body: fs.readFileSync(HUB, "utf8") });
    if(u.startsWith("https://bild.test/")) return r.fulfill({ status:200, contentType:"image/svg+xml", body:BILD });
    if(/rpc\/gast_melden|rpc\/bestellung_aufgeben|rpc\/bestellung_liefern|rest\/v1\/bestellungen/.test(u) &&
       r.request().method() === "POST") spuren.push(u.replace(/^.*\/rest\/v1\//, ""));
    return r.fulfill({ status:200, contentType:"application/json",
      headers:{ "Access-Control-Allow-Origin":"*" }, body:"[]" });
  });

  await p.goto("file://" + ADMIN);
  await p.waitForTimeout(900);
  await p.evaluate(() => { document.getElementById("tor").hidden = true;
    if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); } });
  await p.waitForTimeout(300);
  const scharf = await p.$("#scharfJetzt");
  if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(300); }

  /* Der Rahmen ist bereit, wenn der Hub darin vorschauSetzen kennt. */
  const bereit = async (schl) => {
    for(let i = 0; i < 40; i++){
      const ok = await p.evaluate(s => { const h = hvAlle()[s];
        try{ return !!(h && h.bereit && typeof h.frame.contentWindow.vorschauSetzen === "function"); }
        catch(e){ return false; } }, schl);
      if(ok) return true;
      await p.waitForTimeout(150);
    }
    return false;
  };
  const imRahmen = (schl, fn, arg) => p.evaluate(([s, code, a]) => {
    const w = hvAlle()[s].frame.contentWindow;
    return new w.Function("a", code).call(w, a);
  }, [schl, fn, arg]);

  /* ── 1 · Startseite ──────────────────────────────────────────── */
  console.log("══ Startseite: Banner und Kacheln ══");
  await p.evaluate(() => tafelZeigen("startseite"));
  pruef(await bereit("startseite"), "die Vorschau lädt den echten Hub (srcdoc)");
  const vorschau = await p.evaluate(() => {
    const f = document.querySelector('[data-hv="startseite"] iframe');
    return f ? { srcdoc: !!f.srcdoc, src: f.getAttribute("src"), klick: getComputedStyle(f).pointerEvents,
                 vorschauFlag: f.contentWindow.OMOTENO_VORSCHAU === true } : null;
  });
  pruef(vorschau && vorschau.srcdoc && !vorschau.src, "Rahmen per srcdoc, nicht per src (X-Frame-Options bleibt DENY)",
    JSON.stringify(vorschau));
  pruef(vorschau && vorschau.vorschauFlag, "der Hub weiß, dass er Vorschau ist");
  pruef(vorschau && vorschau.klick === "none", "die kleine Seite ist nicht bedienbar", vorschau && vorschau.klick);

  /* Ein Banner mit Bild anlegen — ohne https-Bild zeigt der Hub keins.
     Ziel gleich mitgeben: Ein Banner OHNE Ziel ist jetzt selbst schon
     ein eigener Warnfall (unten geprüft) — der träfe hier sonst IMMER
     zu (bnNeu() startet mit zielTyp:"seite", zielWert:"") und würde
     die Kürzungswarnung nicht ersetzen (beide stehen jetzt gemeinsam),
     aber /gekürzt/ soll hier isoliert gemessen werden. */
  await p.evaluate(() => { bnNeu(); const b = BANNERSTAND[BANNERSTAND.length - 1];
    bnAendern(b.id, "bild", "https://bild.test/banner.svg");
    bnAendern(b.id, "zielWert", "speisekarte"); });
  await p.waitForTimeout(200);
  const bnFeld = await p.$('#bnListe .bnzeile:last-child [data-bn-titel]');
  pruef(!!bnFeld, "das Titelfeld des neuen Banners steht da (Voraussetzung)");
  if(bnFeld){
    const max = await bnFeld.getAttribute("maxlength");
    pruef(+max >= 80, "das Feld nimmt die langen Titel an", "maxlength " + max);
    await bnFeld.fill(LANG_TITEL.slice(0, +max));
    await (await p.$('#bnListe .bnzeile:last-child [data-bn-text]')).fill(LANG_TEXT);
    await p.waitForTimeout(700);
    const hub = await imRahmen("startseite", `
      const k = [...document.querySelectorAll(".bnkarte")].pop();
      return k ? { titel: k.querySelector(".bntxt b").textContent, text: k.querySelector(".bntxt span").textContent,
                   sichtbar: k.getBoundingClientRect().width > 0 } : null;`);
    pruef(hub && hub.titel === LANG_TITEL.slice(0, +max), "der getippte Titel steht im Hub — ohne „Übernehmen“",
      hub ? hub.titel.slice(0, 40) + "…" : "keine Karte");
    pruef(hub && hub.text === LANG_TEXT, "die Unterzeile auch", hub ? hub.text.length + " Zeichen" : "–");
    const warn = await p.evaluate(() => {
      const el = document.querySelector('#bnListe .bnzeile:last-child .hvwarn');
      return el ? el.textContent : null; });
    pruef(!!warn && /gekürzt/.test(warn), "zu lang für drei Zeilen: der Hinweis steht unter dem Feld", warn || "leer");

    /* Gegenfall: kurzer Text → kein Hinweis. Sonst wäre ein Hinweis,
       der immer dasteht, als „gemessen“ durchgegangen (§8.1g). */
    await bnFeld.fill("Neu");
    await (await p.$('#bnListe .bnzeile:last-child [data-bn-text]')).fill("");
    await p.waitForTimeout(700);
    const warn2 = await p.evaluate(() => document.querySelector('#bnListe .bnzeile:last-child .hvwarn').textContent);
    pruef(warn2 === "", "kurzer Titel: kein Hinweis", warn2 || "leer");
  }

  /* ── Ziel ohne Protokoll: darf NICHT als „kein gültiges Ziel“
     gemeldet werden (das war der eigentliche Fehlerbericht — ein
     Gast konnte auf ein Banner ohne https:// nicht tippen, und der
     Betreiber sah beim Testen im Board nichts davon, weil .bnkarte
     als <div> optisch gleich aussieht wie als <a>, CLAUDE.md §8.1h).
     bnAendern setzt zielTyp/zielWert genauso wie ein echter Klick auf
     die Segmente — kein Umweg über das <select>, das der Bedienung
     bereits pruef-board.js prüft. */
  await p.evaluate(() => {
    const b = BANNERSTAND[BANNERSTAND.length - 1];
    bnAendern(b.id, "zielTyp", "url");
    bnAendern(b.id, "zielWert", "beispiel.de");
  });
  await p.waitForTimeout(700);
  const warnOhneProtokoll = await p.evaluate(() =>
    document.querySelector('#bnListe .bnzeile:last-child .hvwarn').textContent);
  pruef(warnOhneProtokoll === "", "Adresse ohne Protokoll (der Normalfall): kein Warnhinweis", warnOhneProtokoll || "leer");
  const hrefOhneProtokoll = await imRahmen("startseite",
    `const k = [...document.querySelectorAll(".bnkarte")].pop(); return k ? { tag:k.tagName, href:k.getAttribute("href") } : null;`);
  pruef(hrefOhneProtokoll && hrefOhneProtokoll.tag === "A" && hrefOhneProtokoll.href === "https://beispiel.de",
    "…und die Karte im Rahmen ist wirklich ein klickbarer Link", JSON.stringify(hrefOhneProtokoll));

  /* Gegenfall: ein Ziel, das sich wirklich nicht auflöst (leer),
     MUSS die neue Warnung zeigen — sonst wäre der obige grüne Fall
     nur Zufall, weil die Prüfung gar nichts hätte finden können
     (§8.1g). */
  await p.evaluate(() => {
    const b = BANNERSTAND[BANNERSTAND.length - 1];
    bnAendern(b.id, "zielWert", "");
  });
  await p.waitForTimeout(700);
  const warnLeeresZiel = await p.evaluate(() =>
    document.querySelector('#bnListe .bnzeile:last-child .hvwarn').textContent);
  pruef(/kein gültiges Ziel/.test(warnLeeresZiel), "leeres Ziel: die neue Warnung steht unter dem Feld", warnLeeresZiel || "leer");
  const hrefLeeresZiel = await imRahmen("startseite",
    `const k = [...document.querySelectorAll(".bnkarte")].pop(); return k ? k.tagName : null;`);
  pruef(hrefLeeresZiel === "DIV", "…und die Karte im Rahmen ist wirklich nicht antippbar", hrefLeeresZiel);

  /* ── Umbruch: ausgewogen, eigene Zeilen, Ausrichtung ──
     VORFALL 26.09. (Bildschirmfoto): „Probier gerne unsere / neuen
     Hits“ — die zweite Zeile halb leer. Gemessen wird die Breite
     JEDER gezeichneten Zeile (Range.getClientRects), nicht die
     CSS-Angabe: text-wrap:balance, das der Browser nicht kann, sähe
     im Quelltext genauso aus. */
  const zeilenBreiten = `
    const r = document.createRange(); r.selectNodeContents(ziel);
    const zeilen = {};
    [...r.getClientRects()].forEach(q => { const y = Math.round(q.top); zeilen[y] = (zeilen[y] || 0) + q.width; });
    return Object.values(zeilen).map(Math.round);`;
  const bnFeld2 = await p.$('#bnListe .bnzeile:last-child [data-bn-titel]');
  if(bnFeld2){
    await bnFeld2.fill("Probier gerne unsere neuen Hits");
    await (await p.$('#bnListe .bnzeile:last-child [data-bn-text]')).fill("");
    await p.waitForTimeout(700);
    const hubZ = await imRahmen("startseite", `
      const b = [...document.querySelectorAll(".bnkarte .bntxt b")].pop(); if(!b) return null;
      const ziel = b; ${zeilenBreiten}`);
    const boardZ = await p.evaluate(code => {
      const el = document.querySelector("#bnListe .bnzeile:last-child .kbschau .kbstxt b");
      return el ? new Function("ziel", code)(el) : null;
    }, zeilenBreiten);
    const ausgewogen = z => !!z && z.length >= 2 && Math.min(...z) / Math.max(...z) >= 0.6;
    /* Voraussetzung: Es müssen ZWEI Zeilen sein — bei einer gibt es
       nichts auszugleichen, und die Probe wäre blind (§8.1g). */
    pruef(!!boardZ && boardZ.length >= 2, "Board-Minivorschau: der Anlass-Titel bricht um (Voraussetzung)", JSON.stringify(boardZ));
    pruef(ausgewogen(boardZ), "Board-Minivorschau: ausgewogen (kürzere Zeile ≥ 60 % der längeren)", JSON.stringify(boardZ));
    await bnFeld2.fill("Probier gerne unsere neuen Hits mit frischer Schokolade");
    await p.waitForTimeout(700);
    const hubZ2 = await imRahmen("startseite", `
      const b = [...document.querySelectorAll(".bnkarte .bntxt b")].pop(); if(!b) return null;
      const ziel = b; ${zeilenBreiten}`);
    pruef(!!hubZ2 && hubZ2.length >= 2, "Hub: der längere Titel bricht um (Voraussetzung)", JSON.stringify(hubZ2));
    pruef(ausgewogen(hubZ2), "Hub: ausgewogen (kürzere Zeile ≥ 60 % der längeren)", JSON.stringify(hubZ2));

    /* Eigene Zeile per Enter: genau dort bricht es. */
    await bnFeld2.fill("Neu bei uns\nHausgemachte Waffeln");
    await p.waitForTimeout(700);
    const enter = await imRahmen("startseite", `
      const b = [...document.querySelectorAll(".bnkarte .bntxt b")].pop(); if(!b) return null;
      const ziel = b; const z = (() => { ${zeilenBreiten} })();
      return { zeilen: z.length, text: b.textContent };`);
    pruef(enter && enter.zeilen === 2 && /Neu bei uns\nHausgemachte Waffeln/.test(enter.text),
      "Enter im Titel: der Hub bricht genau dort um", JSON.stringify(enter));
    await bnFeld2.fill("eins\n\n\nzwei\ndrei\nvier");
    await p.waitForTimeout(300);
    const bereinigt = await bnFeld2.inputValue();
    pruef(bereinigt === "eins\nzwei\ndrei", "keine Leerzeilen, höchstens drei Zeilen", JSON.stringify(bereinigt));

    /* Ausrichtung mittig. */
    await p.click('#bnListe .bnzeile:last-child [data-bn-ausricht="mitte"]');
    await p.waitForTimeout(700);
    const mitte = await imRahmen("startseite", `
      const k = [...document.querySelectorAll(".bnkarte")].pop();
      return k ? getComputedStyle(k.querySelector(".bntxt")).textAlign : null;`);
    const gewaehlt = await p.getAttribute('#bnListe .bnzeile:last-child [data-bn-ausricht="mitte"]', "aria-checked");
    pruef(mitte === "center" && gewaehlt === "true", "„Mittig“ zentriert den Text im Hub", mitte + " / " + gewaehlt);
    const gespeichert = await p.evaluate(() => bnRoh().slice(-1)[0].ausrichtung);
    pruef(gespeichert === "mitte", "die Ausrichtung geht mit „Übernehmen“ mit", gespeichert);
  }

  /* Die Kachelzeilen sind zugeklappt (26.09.) — die erste aufklappen. */
  const ersteAuf = await p.$('#kbListe .kbzeile [data-kb-auf]');
  if(ersteAuf){ await ersteAuf.click(); await p.waitForTimeout(450); }
  const kbFeld = await p.$('#kbListe .kbzeile [data-kb-titel]');
  pruef(!!kbFeld, "ein Kacheltitel-Feld steht da (Voraussetzung)");
  if(kbFeld){
    const sch = await kbFeld.evaluate(el => el.closest("[data-kb]").dataset.kb);
    await kbFeld.fill("Unsere ganze Karte");
    await p.waitForTimeout(600);
    const t = await imRahmen("startseite",
      `const k = document.querySelector('a.kachel[data-kachel="' + a + '"] .txt strong');
       return k ? k.childNodes[0].textContent : null;`, sch);
    pruef(t === "Unsere ganze Karte", "der Kacheltitel ändert sich im Hub beim Tippen", String(t));

    /* Die neuen Wahlen gehen denselben Weg (kbRoh → Rahmen): Farbe und
       Breite erscheinen im echten Hub, ohne „Übernehmen“. */
    await p.click('[data-kb="' + sch + '"] [data-kb-grund="#1E3A8A"]');
    await p.waitForTimeout(600);
    const farbe = await imRahmen("startseite",
      `const k = document.querySelector('a.kachel[data-kachel="' + a + '"]');
       return k ? { grund:k.classList.contains("hatgrund"), bg:getComputedStyle(k).backgroundColor } : null;`, sch);
    pruef(!!farbe && farbe.grund && farbe.bg === "rgb(30, 58, 138)", "eine gewählte Farbe erscheint im Hub", JSON.stringify(farbe));
    await p.click('[data-kb="' + sch + '"] [data-kb-breite="voll"]');
    await p.waitForTimeout(600);
    const spalten = await imRahmen("startseite",
      `const k = document.querySelector('a.kachel[data-kachel="' + a + '"]');
       return k ? k.dataset.spalten : null;`, sch);
    pruef(spalten === "6", "eine gewählte Breite erscheint im Hub", String(spalten));
  }

  /* ── 2 · Ihre Worte ──────────────────────────────────────────── */
  console.log("\n══ Ihre Worte: Slogan und Gruß ══");
  await p.evaluate(() => tafelZeigen("einstellungen"));
  pruef(await bereit("worte"), "die Vorschau der Einstellungen lädt");
  await p.fill("#hubClaim", "Frisch gebacken, jeden Tag, mit Liebe gemacht");
  await p.waitForTimeout(600);
  const claim = await imRahmen("worte", `return document.getElementById("claim").textContent;`);
  pruef(claim === "Frisch gebacken, jeden Tag, mit Liebe gemacht", "der Slogan steht im Kopf des Hubs", claim);
  const altVersteckt = await p.evaluate(() => document.getElementById("hubSchau").hidden);
  pruef(altVersteckt, "die alte Nachbildung bleibt verborgen, solange der echte Hub lädt");

  await p.focus("#hubGruss");
  await p.fill("#hubGruss", "Willkommen im Blend, schön dass Sie heute da sind");
  await p.waitForTimeout(600);
  const gruss = await imRahmen("worte", `
    const w = document.getElementById("willkommen");
    return w ? { sicht: !w.hidden && getComputedStyle(w).display !== "none",
                 text: document.getElementById("wkWort").textContent } : null;`);
  pruef(gruss && gruss.sicht && /schön dass Sie heute da sind/.test(gruss.text),
    "Fokus auf den Gruß zeigt den Willkommensschirm mit diesem Gruß", JSON.stringify(gruss));
  await p.focus("#hubClaim");
  await p.waitForTimeout(500);
  const weg = await imRahmen("worte", `const w = document.getElementById("willkommen"); return !w || w.hidden;`);
  pruef(weg, "zurück im Slogan: der Willkommensschirm ist wieder weg");

  /* Überlanger Slogan → Hinweis, gemessen im Hub. */
  await p.fill("#hubClaim", ("Frisch gebacken jeden Tag mit Liebe gemacht und mit warmem Karamell " +
                             "und frischer Schokolade serviert").slice(0, 90));
  await p.waitForTimeout(700);
  const cw = await p.evaluate(() => document.querySelector('[data-hvwarn="claim"]').textContent);
  const zeilen = await imRahmen("worte", `const c = document.getElementById("claim");
    return c.scrollHeight > c.clientHeight + 1;`);
  pruef(cw === (zeilen ? cw : "") && (zeilen ? /gekürzt/.test(cw) : cw === ""),
    "Hinweis zum Slogan genau dann, wenn der Hub wirklich kürzt", (zeilen ? "kürzt" : "passt") + " / „" + cw + "“");

  /* ── 3 · Aktion ─────────────────────────────────────────────── */
  console.log("\n══ Aktion: der Name im Band ══");
  await p.evaluate(() => tafelZeigen("speisekarte"));
  await p.waitForTimeout(300);
  const auf = await p.$("#runnerAuf");
  if(auf) await auf.click();
  await p.waitForTimeout(400);
  const formOffen = await p.evaluate(() => !document.getElementById("runnerForm").hidden);
  pruef(formOffen, "das Aktionsformular ist offen (Voraussetzung)");
  if(formOffen){
    await p.fill("#runnerTitel", "Happy Hour am Nachmittag");
    await p.evaluate(() => runnerVorschau());
    pruef(await bereit("aktion"), "die Vorschau der Aktion lädt");
    /* VORFALL (Bildschirmfoto, 27.09.): Die Elternseite sprang beim
       Tippen immer wieder zur Vorschau. Ursache: vorschauZeige() im
       Hub rief `el.scrollIntoView()` im srcdoc-iframe auf — ein
       gleich aufgebautes Test-iframe (.hvfenster hat overflow:hidden)
       gab das nachweislich an die ELTERNSEITE weiter, wenn die Ziel-
       Requisite (hier: das Aktionsband, weit unten im Hub) im
       eigenen Rahmen erst noch gescrollt werden musste. Gemessen wird
       hier OHNE jede Nutzergeste (nur runnerVorschau() per evaluate)
       — bewegt sich die Elternseite trotzdem, kommt das nur aus
       genau diesem Aufruf, nicht aus einer legitimen Fokus-Korrektur
       des Browsers. */
    const vorherY = await p.evaluate(() => window.scrollY);
    await p.evaluate(() => runnerVorschau());
    await p.waitForTimeout(700);
    pruef(await p.evaluate(() => window.scrollY) === vorherY,
      "die Elternseite bleibt stehen, während die Aktions-Vorschau im Rahmen scrollt",
      vorherY + " -> " + await p.evaluate(() => window.scrollY));
    const band = await imRahmen("aktion", `const k = document.querySelector(".aktion .kennz");
      return k ? k.textContent : null;`);
    pruef(band && /Happy Hour am Nachmittag/i.test(band), "der Aktionsname steht im Band der Vorschau", String(band));
  }

  /* ── 4 · Keine Spuren ───────────────────────────────────────── */
  console.log("\n══ Keine Spuren ══");
  pruef(spuren.length === 0, "die Vorschau meldet keinen Besuch und schickt nichts ab", spuren.join(", ") || "still");
  const nichtGespeichert = await p.evaluate(() => {
    const b = meineBetriebe.find(x => x.id === betriebId);
    return !b || !b.hub_texte || b.hub_texte.claim !== "Frisch gebacken, jeden Tag, mit Liebe gemacht";
  });
  pruef(nichtGespeichert, "Tippen allein speichert nichts (erst „Übernehmen“)");

  /* ── 5 · Fehler ─────────────────────────────────────────────── */
  pruef(fehler.length === 0, "kein Fehler in Board und Rahmen", fehler[0] || "still");
  await browser.close();
  console.log("\n" + (n - f) + " von " + n + " ok");
  console.log(f ? f + " Fehler." : "Alles sauber.");
  process.exit(f ? 1 : 0);
})();
