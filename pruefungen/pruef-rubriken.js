/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Ganze Rubriken der Startseite verschieben, umbenennen, anlegen

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-rubriken.js
     (braucht dist/ — vorher „node erzeuger/erzeuge-hub.js --alle“)

   Wunsch: „Man muss zu weit nach unten scrollen, um an die Karten zu
   kommen — ich will ganze aufklappbare Rubriken verschieben und erstellen
   können, so wie ‚Jetzt am Tisch‘.“

   Die Rubrik ist keine eigene Tabelle, sondern der Name an den Kacheln
   (hub_kacheln[].gruppe) und die Reihenfolge der Liste. Drei Dinge können
   schiefgehen, und für jedes steht hier eine Probe:

   1 · ALTE HÄUSER ÄNDERN SICH. Ohne eigene Wahl darf kbRoh() KEIN Feld
       „gruppe“ schicken und die Reihenfolge bleibt die der Vorgabe.
   2 · BOARD UND HUB MEINEN NICHT DASSELBE. Was das Board speichert, muss
       im Hub als dieselbe Rubrik in derselben Reihenfolge ankommen —
       gemessen am gezeichneten Hub, nicht an der Liste (§8.1i).
   3 · EIN NAME IST EINE LIVE-SPALTE. Anführungszeichen und Spitzklammern
       im Rubriknamen öffnen kein Attribut und kein Element (§8.1w). Und
       „nur am Tisch“ hängt an der Kachel-Art, nicht am Namen: wird „Jetzt
       am Tisch“ umbenannt, darf der Liefermodus sie trotzdem nicht zeigen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const { gruppeZu } = require("./werkzeug/zentrale");
const fs = require("fs");
const path = require("path");

const OBEN = path.join(__dirname, "..");
const ADMIN = "file://" + path.join(OBEN, "seiten", "admin.html");
const HUB = path.join(OBEN, "dist", "chocolamour", "index.html");
if(!fs.existsSync(HUB)){ console.error(HUB + " fehlt — erst „node erzeuger/erzeuge-hub.js --alle“."); process.exit(1); }

let fehler = 0;
const pruef = (g, t, z) => { console.log((g ? "  ok   " : "  FEHL ") + t + (z !== undefined && z !== "" ? "  → " + z : "")); if(!g) fehler++; };
const echt = k => k.filter(z => !/net::ERR|Failed to load|ERR_FAILED/i.test(z));

(async () => {
  const br = await chromium.launch();

  /* ── Board ─────────────────────────────────────────────────────── */
  console.log("\n══ Board · Rubriken ══");
  const ctx = await br.newContext({ viewport:{ width:390, height:900 }, hasTouch:true });
  const p = await ctx.newPage();
  const pf = [];
  p.on("pageerror", e => pf.push(String(e).slice(0, 160)));
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
  await p.goto(ADMIN);
  await p.waitForTimeout(800);
  await p.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); zeichneAlles();
    const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; tafelZeigen("startseite");
    kbAusZeile([]); kbZeichnen(); });
  await p.waitForTimeout(400);
  const da = await gruppeZu(p, "#gh-kacheln");
  pruef(da, "Voraussetzung: die Unterseite „Kacheln“ ist offen");

  const rubriken = () => p.evaluate(() => [...document.querySelectorAll("#kbAnordnung [data-kbr-rubrik]")].map(k => k.dataset.kbrRubrik));
  const stand = () => p.evaluate(() => ({
    folge: kbBloecke().map(b => b.name),
    zerrissen: (() => { const n = kbBloecke().map(b => b.name); return n.length !== new Set(n).size; })(),
    roh: kbRoh()
  }));

  const v0 = await rubriken();
  pruef(v0.length >= 3, "Voraussetzung: mindestens drei Rubriken in der Anordnung", v0.join(" | "));
  const s0 = await stand();
  pruef(!s0.roh.some(e => "gruppe" in e), "ohne eigene Wahl schickt kbRoh() kein Feld „gruppe“");
  pruef(s0.folge.join("|") === v0.join("|"), "Reihenfolge ohne Wahl = Vorgabe", s0.folge.join(" | "));

  /* Tapflächen und Zustand der Knöpfe */
  const knoepfe = await p.evaluate(() => [...document.querySelectorAll("#kbAnordnung .kbr-rknopf")].map(b => ({
    h: b.getBoundingClientRect().height, b: b.getBoundingClientRect().width, aus: b.disabled, l: b.getAttribute("aria-label") })));
  pruef(knoepfe.length === v0.length * 3 && knoepfe.every(k => k.h >= 44 && k.b >= 44), "jeder Rubrik-Knopf ≥ 44 px", knoepfe.length + " Knöpfe");
  pruef(knoepfe[1].aus === true, "die oberste Rubrik kann nicht weiter nach oben");
  pruef(knoepfe[knoepfe.length - 1].aus === true, "die unterste Rubrik kann nicht weiter nach unten");

  /* Ganze Rubrik mit echtem Tipp verschieben */
  const erste = v0[0];
  await p.click('#kbAnordnung [data-kbr-rubrik="' + erste + '"] [data-kbr-rrunter]');
  await p.waitForTimeout(100);
  const v1 = await rubriken(), s1 = await stand();
  pruef(v1[0] === v0[1] && v1[1] === erste, "Tipp auf ▼ setzt „" + erste + "“ hinter die nächste Rubrik", v1.join(" | "));
  pruef(!s1.zerrissen, "keine Rubrik ist in zwei Stücke zerfallen");
  const kartenGespeichert = s1.roh.map(e => e.schluessel);
  pruef(kartenGespeichert.indexOf("tischruf") < kartenGespeichert.indexOf("speisekarte"),
    "die gespeicherte Liste folgt: „Jetzt am Tisch“ steht jetzt vor der Karte");
  pruef(!s1.roh.some(e => "gruppe" in e), "reines Verschieben speichert keinen Namen (nur die Reihenfolge)");
  pruef(await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute("data-kbr-rrunter")), "der Fokus bleibt auf dem Knopf der verschobenen Rubrik");
  await p.click('#kbAnordnung [data-kbr-rubrik="' + erste + '"] [data-kbr-rhoch]');
  await p.waitForTimeout(100);
  pruef((await rubriken()).join("|") === v0.join("|"), "Tipp auf ▲ stellt die alte Reihenfolge wieder her");

  /* Neue Rubrik über die Auswahl der Kachel — der Name ist absichtlich böse. */
  await p.evaluate(() => { window.prompt = () => 'Frühstück <b>"x\' &'; });
  await p.evaluate(() => { kbOffen.add("quiz"); kbZeichnen(); });
  await p.selectOption('#kbListe [data-kb="quiz"] [data-kb-rubrik]', "");
  await p.waitForTimeout(150);
  const s2 = await stand(), v2 = await rubriken();
  const neuName = (s2.roh.find(e => e.schluessel === "quiz") || {}).gruppe;
  pruef(neuName === "Frühstück b x" || neuName === "Frühstück bx" || /^Frühstück b/.test(neuName || ""),
    "neue Rubrik: Spitzklammern, Anführungszeichen und & fehlen im Namen", JSON.stringify(neuName));
  pruef(!/[<>"'&]/.test(neuName || ""), "kein Sonderzeichen im gespeicherten Namen");
  pruef(v2.includes(neuName) && v2.length === v0.length + 1, "die neue Rubrik erscheint in der Anordnung", v2.join(" | "));
  pruef(s2.roh.filter(e => "gruppe" in e).length === 1, "nur die eine Kachel trägt einen eigenen Namen");
  pruef(!s2.zerrissen, "auch jetzt ist jede Rubrik am Stück");
  pruef(await p.evaluate(() => !document.querySelector("#kbAnordnung [data-kbr-rubrik] img, #kbAnordnung [data-kbr-rubrik] b")),
    "der Name steht als Text im Kopf (kein Element eingeschleust)");

  /* Umbenennen — alle Kacheln der Rubrik ziehen mit */
  await p.evaluate(() => { window.prompt = () => "Am Tisch"; });
  await p.click('#kbAnordnung [data-kbr-rubrik="Jetzt am Tisch"] [data-kbr-rname]');
  await p.waitForTimeout(100);
  const s3 = await stand();
  const tisch = ["tischruf", "wlan", "quiz", "musikwunsch", "meintisch"];
  pruef(tisch.filter(t => t !== "quiz").every(t => (s3.roh.find(e => e.schluessel === t) || {}).gruppe === "Am Tisch"),
    "Umbenennen setzt den Namen an JEDER Kachel der Rubrik");
  pruef((await rubriken()).includes("Am Tisch") && !(await rubriken()).includes("Jetzt am Tisch"), "die Anordnung zeigt den neuen Namen");

  /* Rundlauf: speichern → neu lesen */
  const rund = await p.evaluate(() => { const r = JSON.parse(JSON.stringify(kbRoh())); const vor = kbBloecke().map(b => b.name + ":" + b.kacheln.map(k => k.schluessel).join(","));
    kbAusZeile(r); const nach = kbBloecke().map(b => b.name + ":" + b.kacheln.map(k => k.schluessel).join(",")); return { vor, nach }; });
  pruef(rund.vor.join("/") === rund.nach.join("/"), "Neuladen (kbRoh → kbAusZeile) liefert dieselben Rubriken in derselben Reihenfolge", rund.nach.length + " Rubriken");

  /* Zurück auf Vorgabe */
  await p.evaluate(() => { kbAusZeile([]); kbZeichnen(); });
  pruef(!(await stand()).roh.some(e => "gruppe" in e), "„Zurücksetzen“ nimmt jede eigene Rubrik wieder weg");

  /* Obergrenze */
  const grenze = await p.evaluate(() => { window.prompt = () => "X"; let n = 0;
    for(let i = 0; i < 14; i++){ const k = KACHELSTAND[i % KACHELSTAND.length];
      window.prompt = () => "R" + i; const vor = kbRubriken().length; kbInRubrik(k.schluessel, ""); if(kbRubriken().length > vor) n++; }
    return { rubriken: kbRubriken().length, hoechst: KB_RUBRIKEN_HOECHST }; });
  pruef(grenze.rubriken <= grenze.hoechst, "nie mehr als " + grenze.hoechst + " Rubriken", String(grenze.rubriken));
  pruef(pf.length === 0, "kein Seitenfehler im Board", pf.join(" | "));
  await ctx.close();

  /* ── Hub: Board-Liste → gezeichnete Startseite ─────────────────── */
  console.log("\n══ Hub · gezeichnete Rubriken ══");
  const hc = await br.newContext({ viewport:{ width:390, height:900 } });
  const h = await hc.newPage();
  const hf = [];
  h.on("pageerror", e => hf.push(String(e).slice(0, 160)));
  await h.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await h.addInitScript(() => { try { sessionStorage.setItem("omoteno-willkommen", "1"); } catch(e){} });
  /* Uhr und Öffnungszeiten legt die Prüfung selbst fest (§8.1j): Außerhalb der Öffnungszeit zeichnet der Hub
     die Kacheln, die ein offenes Haus voraussetzen, nicht — um 7 Uhr fehlte dadurch die Rubrik „Früh“. */
  await h.clock.setFixedTime(new Date("2026-10-10T14:00:00"));
  await h.goto("file://" + HUB + "#/");
  await h.waitForTimeout(1200);
  await h.evaluate(() => { ZEITEN.length = 0; for (let i = 0; i < 7; i++) ZEITEN.push("10:30 – 00:30"); stunde = new Date().getHours(); zeichne(); });

  const zeig = roh => h.evaluate(r => {
    KACHELN.length = 0;
    r.filter(e => e.an !== false).map(e => kachelBauen(e.schluessel, e)).filter(Boolean).forEach(k => KACHELN.push(k));
    zeichne();
    return [...document.querySelectorAll(".sb-kopf")].map(k => k.querySelector(".sb-name").textContent);
  }, roh);
  const alle = ["speisekarte","getraenke","cocktails","tischruf","wlan","quiz","musikwunsch","meintisch","bewertung","reservierung","instagram","kontakt","trinkgeld"]
    .map(s => ({ schluessel: s }));

  const vorgabe = await zeig(alle);
  pruef(vorgabe[0] === "DIE KARTE" && vorgabe.includes("JETZT AM TISCH"), "Voraussetzung: Vorgabe zeigt „Die Karte“ zuerst", vorgabe.join(" | "));

  const umgestellt = alle.filter(e => !["speisekarte","getraenke","cocktails"].includes(e.schluessel))
    .concat(alle.filter(e => ["speisekarte","getraenke","cocktails"].includes(e.schluessel)));
  const ordnung = await zeig(umgestellt);
  const noch = vorgabe.filter(x => x !== "DIE KARTE");
  pruef(ordnung[ordnung.length - 1] === "DIE KARTE" || ordnung.indexOf("DIE KARTE") > ordnung.indexOf("JETZT AM TISCH"),
    "die Liste mit der Karte hinten zeichnet „Die Karte“ weiter unten", ordnung.join(" | "));
  pruef(ordnung.length === vorgabe.length, "keine Rubrik geht verloren oder zerfällt", ordnung.length + " von " + vorgabe.length);

  const boese = 'Früh <img src=x onerror=window.__x=1> "a\' &';
  const mitName = alle.map(e => e.schluessel === "quiz" ? { ...e, gruppe: boese } : e);
  const named = await zeig(mitName);
  pruef(await h.evaluate(() => !window.__x && !document.querySelector(".sb-kopf img")), "ein Rubrikname mit <img onerror> bleibt Text (läuft nichts)");
  pruef(named.some(n => /FRÜH/.test(n) && !/[<>"]/.test(n)), "der Name erscheint ohne Sonderzeichen", named.join(" | "));
  const attr = await h.evaluate(() => [...document.querySelectorAll(".sb-kopf")].every(k => k.getAttribute("onerror") === null && [...k.attributes].every(a => !/^on/i.test(a.name))));
  pruef(attr, "kein Kopf trägt ein eigenes Ereignis-Attribut");

  /* Liefermodus: „nur am Tisch“ hängt an der Art, nicht am Namen */
  const umbenannt = alle.map(e => ["tischruf","wlan","quiz","musikwunsch","meintisch"].includes(e.schluessel) ? { ...e, gruppe: "Am Tisch" } : e);
  const lief = await h.evaluate(r => {
    const vorher = { an: LIEFER.an, modus: liefermodus };
    try { LIEFER.an = true; liefermodus = true; } catch(e){ return { fehler: String(e) }; }
    KACHELN.length = 0;
    r.map(e => kachelBauen(e.schluessel, e)).filter(Boolean).forEach(k => KACHELN.push(k));
    const sichtbar = sichtbareKacheln().map(k => k.schluessel);
    LIEFER.an = vorher.an; liefermodus = vorher.modus;
    return { sichtbar };
  }, umbenannt);
  pruef(!lief.fehler, "Voraussetzung: Liefermodus lässt sich stellen", lief.fehler);
  pruef(lief.sichtbar && !lief.sichtbar.includes("tischruf") && !lief.sichtbar.includes("wlan") && lief.sichtbar.includes("speisekarte"),
    "Liefermodus: die umbenannte Tisch-Rubrik bleibt weg, die Karte bleibt", (lief.sichtbar || []).join(","));
  pruef(hf.length === 0, "kein Seitenfehler im Hub", hf.join(" | "));
  await hc.close();

  await br.close();
  console.log("\n" + (fehler ? fehler + " FEHLER" : "alles grün"));
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
