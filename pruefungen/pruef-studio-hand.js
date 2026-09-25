/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Das Marken-Studio von Hand bedient

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-studio-hand.js

   pruef-studio.js prüft den Entwurfslink rechnerisch — hin, zurück,
   gleich. Diese hier fasst das Studio an und fragt vier Dinge, die
   man dem Quelltext nicht ansieht:

   1 · Ist die Knopfschrift auf JEDER Kundenfarbe lesbar? Der Knopf
       trug bis zum 30.08. fest color:#fff auf var(--leih) — auf dem
       Säuregrün der Bar-Vorlage sind das 1,16:1. Der Vorfall stand
       schon in CLAUDE.md §5.1 und war trotzdem noch live.
   2 · Nimmt „Zurück" wirklich zurück — und ergibt ein gezogener
       Regler EINEN Schritt statt dreißig?
   3 · Springt ein Tipp in der Vorschau zur richtigen Abteilung?
   4 · Was passiert beim Schicken, wenn die Datenbank nicht
       erreichbar ist? Der Entwurf darf nicht verloren gehen und die
       Seite nicht weiß werden.

   Gefahren wird OHNE Netz nach außen — genau der Fall aus 4.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const KANDIDATEN = ["marken-studio.html", "omoteno-marken-studio.html"];
const DATEI = KANDIDATEN.map(n => path.join(__dirname, "..", "seiten", n))
                        .find(fs.existsSync);
if(!DATEI){
  console.error("Kein Marken-Studio gefunden. Gesucht: " + KANDIDATEN.join(", "));
  process.exit(1);
}
const ADRESSE = "file://" + DATEI;

const { chromium } = require("playwright");
let fehler = 0;
const pruef = (gut, text, zusatz) => {
  console.log((gut?"  ok   ":"  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
};
const L = h => { const c=[1,3,5].map(i=>{const v=parseInt(h.substr(i,2),16)/255;
  return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055,2.4);});
  return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
const K = (a,b) => { const x=L(a),y=L(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
const hex = rgb => "#" + rgb.match(/\d+/g).slice(0,3)
  .map(n => (+n).toString(16).padStart(2,"0")).join("").toUpperCase();

(async () => {
  const b = await chromium.launch();
  for(const [n,w,h] of [["Telefon",390,844],["Rechner",1440,900]]){
    const ctx = await b.newContext({ viewport:{width:w,height:h} });
    const p = await ctx.newPage();
    const konsole = [];
    p.on("pageerror", e => konsole.push(String(e).slice(0,150)));
    p.on("console", m => { if(m.type()==="error") konsole.push(m.text().slice(0,150)); });
    /* Die Datenbank ist hier NICHT erreichbar — genau der Fall, den
       das Schicken auffangen muss. */
    await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await p.goto(ADRESSE);
    await p.waitForTimeout(500);
    console.log("\n══ " + n);

    /* ── 1 · Knopfkontrast über ALLE Vorlagen, Tag und Abend ── */
    const vorlagen = await p.$$eval("[data-vorlage]", e => e.map(x => x.dataset.vorlage));
    let schwach = [];
    for(const v of vorlagen){
      for(const abend of [false, true]){
        await p.click('[data-vorlage="' + v + '"]');
        await p.waitForTimeout(150);
        if(abend){ await p.click("[data-abend]"); await p.waitForTimeout(150); }
        const m = await p.evaluate(() => {
          const k = document.getElementById("schicken");
          const s = getComputedStyle(k);
          return { vg:s.color, hg:s.backgroundColor };
        });
        const wert = K(hex(m.vg), hex(m.hg));
        if(wert < 4.5) schwach.push(v + (abend?" abend":" tag") + " " + wert.toFixed(2));
      }
    }
    pruef(schwach.length === 0, "die Knopfschrift ist auf jeder Kundenfarbe lesbar",
      schwach.length ? schwach.join(" | ") : vorlagen.length*2 + " Paare geprüft, alle ≥ 4,5:1");

    /* ── 1b · Aufgeräumt: kein Code, eine Abteilung offen ──
       VORFALL: Auf dem Telefon eines Kunden stand „const MARKENBLATT =
       {…}“ mitten im Studio. Das Markenblatt als Text ist Werkzeug
       für das Team und nur mit ?fachleute=1 da. Und zehn offene
       Abteilungen waren eine Liste, in der man sucht — jetzt ist
       immer nur eine offen, und jeder Kopf sagt in einem Satz, was
       drin ist. */
    const zustand = () => p.evaluate(() => ({
      code: /MARKENBLATT/.test(document.body.innerText),
      ausgabeSichtbar: !!document.getElementById("ausgabe").offsetParent,
      kopierenSichtbar: !!document.getElementById("kopieren").offsetParent,
      offen: [...document.querySelectorAll('.abt-kopf[aria-expanded="true"]')].map(k => k.dataset.abtauf),
      rumpfAuf: [...document.querySelectorAll(".abt-rumpf")].filter(r => !r.hidden).map(r => r.id),
      markiert: [...document.querySelectorAll('[data-abtziel][aria-current="true"]')].map(b => b.dataset.abtziel),
    }));
    let z = await zustand();
    pruef(!z.code && !z.ausgabeSichtbar && !z.kopierenSichtbar,
      "kein Markenblatt-Code sichtbar, kein Kopieren/Einlesen für jedermann", JSON.stringify({code:z.code, feld:z.ausgabeSichtbar, knopf:z.kopierenSichtbar}));
    pruef(z.offen.join() === "vorlagen" && z.rumpfAuf.join() === "rumpf-vorlagen",
      "beim Start ist genau „Schnellstart“ offen", z.offen.join() + " / " + z.rumpfAuf.join());
    const koepfe = await p.$$eval(".abt-kopf", ks => ks.map(k => ({ abt:k.dataset.abtauf,
      hoch:Math.round(k.getBoundingClientRect().height),
      satz:(k.querySelector(".abt-satz") || {}).textContent || "" })));
    const schlecht = koepfe.filter(k => k.hoch < 44 || k.satz.trim().length < 12 || k.satz.length > 80);
    pruef(koepfe.length === 10 && schlecht.length === 0,
      "jede der 10 Abteilungen hat einen Kopf ≥ 44 px mit einem kurzen Satz",
      schlecht.map(k => k.abt + " " + k.hoch + "px „" + k.satz + "“").join(" | ") || koepfe.map(k => k.hoch).join("/"));
    /* Tippen mit dem Finger auf „Das Haus“: auf, die anderen zu. */
    await p.evaluate(() => { if(typeof zuRaste === "function") zuRaste(2); });
    await p.waitForTimeout(500);
    await p.click('.abt-kopf[data-abtauf="haus"]');
    await p.waitForTimeout(300);
    z = await zustand();
    pruef(z.offen.join() === "haus" && z.rumpfAuf.join() === "rumpf-haus" && z.markiert.join() === "haus",
      "Tipp auf „Das Haus“ öffnet es, schließt den Rest, der Reiter zeigt es", JSON.stringify(z.offen) + " " + JSON.stringify(z.markiert));
    pruef(await p.isVisible("#fName"), "das Namensfeld ist danach bedienbar");
    /* Nach einem Bildlauf darf die Markierung nicht auf „Schnellstart“ zurückfallen. */
    await p.evaluate(() => { const b = document.getElementById("blattinhalt"); b.scrollTop = b.scrollHeight; b.dispatchEvent(new Event("scroll")); });
    await p.waitForTimeout(300);
    z = await zustand();
    pruef(z.markiert.join() === "haus", "nach dem Bildlauf bleibt der Reiter auf der offenen Abteilung", z.markiert.join());
    /* Ein Sprung über die Reiterleiste öffnet die Abteilung. */
    /* Die Reiterleiste sitzt im Griff — auf dem großen Schirm gibt es
       keinen Griff, dort sind die Köpfe selbst die Navigation. Dann
       der zweite Weg zum Sprung: derselbe, den ein Tipp in der
       Vorschau nimmt. */
    if(await p.isVisible('[data-abtziel="schrift"]')) await p.click('[data-abtziel="schrift"]');
    else await p.evaluate(() => abteilungZeigen("schrift"));
    await p.waitForTimeout(500);
    z = await zustand();
    pruef(z.offen.join() === "schrift" && z.rumpfAuf.join() === "rumpf-schrift",
      "ein Tipp in der Reiterleiste öffnet „Schrift“", z.offen.join());
    /* Auf dem Telefon mit der MAUS (schmales Fenster am Rechner):
       Früher fing der Griff den Zeiger schon beim Drücken, der Klick
       ging an den Griff, die Reiterleiste war tot. Und der Griff muss
       trotzdem noch ziehen. */
    if(await p.isVisible('[data-abtziel="form"]')){
      await p.locator('[data-abtziel="form"]').scrollIntoViewIfNeeded();
      const k = await p.locator('[data-abtziel="form"]').boundingBox();
      await p.mouse.click(k.x + k.width/2, k.y + k.height/2);
      await p.waitForTimeout(500);
      z = await zustand();
      pruef(z.markiert.join() === "form" && z.offen.join() === "form", "ein Mausklick auf einen Reiter wirkt (Griff fängt ihn nicht ab)", z.markiert.join());
      const vorRaste = await p.evaluate(() => raste);
      const g = await p.locator(".griffstrich").boundingBox();
      await p.mouse.move(g.x + g.width/2, g.y + 2);
      await p.mouse.down();
      for(let i = 1; i <= 12; i++) await p.mouse.move(g.x + g.width/2, g.y + 2 + i * 40);
      await p.mouse.up();
      await p.waitForTimeout(700);
      const nachRaste = await p.evaluate(() => raste);
      pruef(nachRaste < vorRaste, "der Griff zieht das Blatt trotzdem herunter", vorRaste + " → " + nachRaste);
      await p.evaluate(() => zuRaste(2));
      await p.waitForTimeout(500);
      await p.evaluate(() => abteilungZeigen("schrift"));
      await p.waitForTimeout(400);
    }
    /* Zweiter Tipp auf den offenen Kopf klappt zu. */
    await p.click('.abt-kopf[data-abtauf="schrift"]');
    await p.waitForTimeout(250);
    z = await zustand();
    pruef(z.offen.length === 0 && z.rumpfAuf.length === 0, "ein zweiter Tipp klappt wieder zu", z.offen.join() || "alles zu");
    /* Kopieren ohne sichtbares Feld: der Rückfall muss trotzdem tragen. */
    const kopie = await p.evaluate(() => {
      const alt = navigator.clipboard;
      try{ Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }); }catch(e){}
      let markiert = "", gefragt = false;
      const exec = document.execCommand, frag = window.prompt;
      document.execCommand = function(){ markiert = String(window.getSelection()) || (document.activeElement && document.activeElement.value) || ""; return true; };
      window.prompt = function(){ gefragt = true; return null; };
      inZwischenablage("https://beispiel/#m=abc", "Adresse kopiert");
      document.execCommand = exec; window.prompt = frag;
      try{ Object.defineProperty(navigator, "clipboard", { value: alt, configurable: true }); }catch(e){}
      return { markiert, gefragt, meldung: document.getElementById("meldung").textContent,
               reste: document.querySelectorAll("body > textarea").length };
    });
    pruef(kopie.markiert === "https://beispiel/#m=abc" && !kopie.gefragt && /kopiert/.test(kopie.meldung) && kopie.reste === 0,
      "ohne Zwischenablage-Schnittstelle wird trotzdem kopiert — ohne das versteckte Feld, ohne Reste", JSON.stringify(kopie));
    /* Für Fachleute ist alles noch da. */
    const f = await ctx.newPage();
    await f.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
    await f.goto(ADRESSE + "?fachleute=1");
    await f.waitForTimeout(400);
    await f.evaluate(() => abteilungZeigen("teilen"));
    await f.waitForTimeout(500);
    const fach = await f.evaluate(() => ({ feld: !!document.getElementById("ausgabe").offsetParent,
      knopf: !!document.getElementById("kopieren").offsetParent,
      inhalt: /const MARKENBLATT/.test(document.getElementById("ausgabe").value) }));
    pruef(fach.feld && fach.knopf && fach.inhalt, "mit ?fachleute=1 sind Markenblatt, Kopieren und Einlesen da", JSON.stringify(fach));
    await f.close();

    /* ── 2 · Rückgängig ── */
    await p.evaluate(() => abteilungZeigen("vorlagen"));
    await p.waitForTimeout(400);
    await p.click('[data-vorlage="' + vorlagen[0] + '"]');
    await p.waitForTimeout(300);
    await p.click('.abt-kopf[data-abtauf="haus"]');
    await p.waitForTimeout(300);
    const vorher = await p.inputValue("#fName");
    await p.fill("#fName", "Testhaus Eins");
    await p.waitForTimeout(700);              /* Drosselung abwarten */
    pruef(!(await p.isDisabled("#zurueck")), "nach einer Änderung ist „Zurück“ scharf");
    await p.click("#zurueck");
    await p.waitForTimeout(300);
    pruef(await p.inputValue("#fName") === vorher, "und nimmt sie zurück",
      "„" + (await p.inputValue("#fName")) + "“ statt „Testhaus Eins“");
    pruef(!(await p.isDisabled("#vorwaerts")), "„Vor“ ist danach scharf");
    await p.click("#vorwaerts");
    await p.waitForTimeout(300);
    pruef(await p.inputValue("#fName") === "Testhaus Eins", "und stellt sie wieder her");

    /* Gedrosselt? Ein gezogener Regler darf EINEN Schritt ergeben. */
    const vorZug = await p.evaluate(() => verlauf.length);
    await p.evaluate(() => {
      const r = document.getElementById("fRundung");
      for(let i=0;i<30;i++){
        r.value = 4 + i;
        r.dispatchEvent(new Event("input", {bubbles:true}));
      }
    });
    await p.waitForTimeout(800);
    const nachZug = await p.evaluate(() => verlauf.length);
    pruef(nachZug - vorZug === 1, "dreißig Regler-Ereignisse ergeben EINEN Schritt",
      (nachZug - vorZug) + " Einträge");

    /* Der Stapel darf nicht endlos wachsen. */
    pruef(await p.evaluate(() => VERLAUF_TIEF) === 40, "der Stapel ist gedeckelt", "40");

    /* Tastenkürzel */
    await p.evaluate(() => document.body.focus());
    await p.keyboard.press("Control+z");
    await p.waitForTimeout(300);
    pruef(await p.evaluate(() => M.form.rundung) !== 33,
      "Strg+Z nimmt den Reglerzug zurück", "rundung = " + await p.evaluate(() => M.form.rundung));

    /* ── 3 · Antippen in der Vorschau ── */
    for(const [wahl, abt, qx, qy] of [[".hkachel","bereiche",0.86,0.5],
                                  [".hgruss","haus",0.86,0.5],
                                  /* Der FREIE Grund unten, nicht eine Kachel darauf. */
                                  [".hinhalt","farben",0.5,0.985]]){
      /* Das Blatt herunterfahren, sonst liegt es auf dem Telefon
         ueber der Vorschau und faengt den Tipp ab. */
      await p.evaluate(() => { if(typeof zuRaste === "function") zuRaste(0); });
      await p.waitForTimeout(900);   /* Blattanimation ausklingen lassen, sonst wandert der Kasten zwischen Messen und Tippen */
      await p.evaluate(() => document.getElementById("blattinhalt").scrollTop = 0);
      /* Nicht in die Ecke tippen: Der Telefonrahmen (.geraet) liegt
         mit seiner Rundung ueber der linken oberen Ecke des Bandes.
         Ein Gast wuerde dort auch nicht hintippen. */
      const kasten = await p.locator(wahl).first().boundingBox();
      const px = kasten.x + kasten.width * qx, py = kasten.y + kasten.height * qy;
      await p.mouse.click(px, py);
      await p.waitForTimeout(1400);
      const jetzt = await p.evaluate(() => {
        const a = document.querySelector('[data-abtziel][aria-current="true"]');
        return a ? a.dataset.abtziel : "—";
      });
      pruef(jetzt === abt, "„" + wahl + "“ springt zu „" + abt + "“", jetzt);
    }

    /* ── 4 · Schicken ohne Netz ── */
    await p.evaluate(() => abteilungZeigen("teilen"));
    await p.waitForTimeout(400);
    await p.click("#schicken");
    await p.waitForTimeout(400);
    pruef(/E-Mail/.test(await p.textContent("#schickMeldung")),
      "ohne E-Mail wird nicht geschickt, sondern gefragt");
    await p.fill("#sMail", "wirt@lokal.de");
    await p.fill("#sName", "Elias");
    await p.click("#schicken");
    await p.waitForTimeout(900);
    const meldung = await p.textContent("#schickMeldung");
    pruef(/nicht erreichbar/.test(meldung),
      "bei toter Datenbank sagt es, was los ist", meldung.trim().slice(0,52));
    const mailto = await p.getAttribute("#schickMeldung a", "href");
    /* Im mailto ist der Text URL-kodiert: aus "#m=" wird "%23m%3D". */
    pruef(!!mailto && /%23m%3D/i.test(mailto),
      "und der Entwurf steckt vollständig im Ersatzweg",
      mailto ? "mailto mit " + mailto.length + " Zeichen" : "kein Ersatz");
    pruef(!(await p.isDisabled("#schicken")), "der Knopf ist danach wieder bedienbar");
    /* Die Seite darf dabei NICHT weiß geworden sein. */
    pruef((await p.textContent("body")).length > 400, "die Seite steht noch");

    /* ── 5 · Werbeschleuder ── */
    await p.evaluate(() => { document.getElementById("sFalle").value = "http://spam"; });
    await p.click("#schicken");
    await p.waitForTimeout(300);
    pruef(/melden uns/.test(await p.textContent("#schickMeldung")),
      "die Falle schluckt still", (await p.textContent("#schickMeldung")).trim().slice(0,30));

    const echt = konsole.filter(z => !/net::ERR|Failed to load|Failed to fetch/i.test(z));
    pruef(echt.length === 0, "kein Fehler in der Konsole", echt[0] || "still");
    await ctx.close();
  }
  await b.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
