/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Das Marken-Studio von Hand bedient

     NODE_PATH=/opt/node22/lib/node_modules node pruef-studio-hand.js

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
const DATEI = KANDIDATEN.map(n => path.join(__dirname, n)).find(fs.existsSync);
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

    /* ── 2 · Rückgängig ── */
    await p.click('[data-vorlage="' + vorlagen[0] + '"]');
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
