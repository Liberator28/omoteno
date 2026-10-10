/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Master-Board: „Alessia am Telefon“ (master_alessia)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-master-alessia.js

   Wunsch 10.10.: „Eine gute Übersicht: der KI-Telefonagent ist für
   den Betrieb, der redet so, der hat diesen Datensatz.“ Die Liste
   kommt aus master_alessia(), das Einrichten geht über
   master_alessia_setzen() — beides in migration-telefonbestellung.sql.

   1 · je Betrieb eine Karte: Nummer, Assistent, Ton, Stand
       (Nimmt an / Aus / Keine Nummer), letzte Bestellung, 7 Tage
   2 · Tipp öffnet das Einrichten mit den gespeicherten Werten,
       Speichern schickt genau die Parameter und Schlüssel, die die
       Migration kennt (zweite Quelle: die SQL-Datei selbst)
   3 · Absage des Servers als Satz (nummer_vergeben, nummer_form),
       Name aus der Datenbank nur als Text, fehlende Migration als Satz
   EHRLICHE GRENZE: die Datenbank ist gestellt. Die Rechte selbst
   (nur Master) sind in der Migration zurückgedreht gemessen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const S = n => "file://" + path.join(__dirname, "..", "seiten", n);
const MIG = fs.readFileSync(path.join(__dirname, "..", "datenbank", "migration-telefonbestellung.sql"), "utf8");

let fehler = 0, n = 0;
function pruef(gut, text, zusatz){
  n++; console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz !== undefined ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}
const ZEILEN = [
  { betrieb_id:"b1", slug:"choco", name:"Choco <img src=x onerror=\"window.__xss=1\">", telefon_nummer:"+4964229990001",
    alessia:{ aktiv:true, assistent_id:"asst_choco", nummer_id:"pn_1", stimme:"warm, per Sie", begruessung:"Choco, hier ist Alessia." },
    letzte_bestellung:new Date(Date.now() - 600000).toISOString(), bestellungen_7_tage:12 },
  { betrieb_id:"b2", slug:"blend", name:"Blend", telefon_nummer:"+4964229990002", alessia:{ aktiv:false },
    letzte_bestellung:null, bestellungen_7_tage:0 },
  { betrieb_id:"b3", slug:"neu", name:"Neues Haus", telefon_nummer:null, alessia:null, letzte_bestellung:null, bestellungen_7_tage:0 }
];

function ersatz(alessiaAntwort){
  return "(function(antwort){" + `
    window.__rufe = { master_alessia: 0, setzen: [] };
    const nutzer = { id:"00000000-0000-0000-0000-000000000001", email:"master@probe.de" };
    const sitzung = { user:nutzer, access_token:"x" };
    const leer = () => {
      const erg = { data:[], error:null, count:0 };
      const p = new Proxy(function(){}, {
        get(_, k){
          if(k === "then") return (a, b) => Promise.resolve(erg).then(a, b);
          if(k === "single" || k === "maybeSingle") return () => Promise.resolve({ data:null, error:null });
          return () => p;
        },
        apply(){ return p; }
      });
      return p;
    };
    window.supabase = { createClient: () => ({
      auth: {
        getSession: async () => ({ data:{ session: sitzung } }),
        getUser: async () => ({ data:{ user: nutzer } }),
        signInWithPassword: async () => ({ data:{ user:nutzer, session:sitzung }, error:null }),
        signOut: async () => ({}),
        updateUser: async () => ({ data:{ user:nutzer }, error:null }),
        resetPasswordForEmail: async () => ({ error:null }),
        onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
        signInWithOAuth: async () => ({ data:{}, error:null })
      },
      rpc: async (name, param) => {
        if(name === "master_alessia"){
          window.__rufe.master_alessia++;
          if(antwort && antwort.fehlercode) return { data:null, error:{ code:antwort.fehlercode, message:antwort.fehlermeldung || "Fehler" } };
          return { data: antwort || [], error:null };
        }
        if(name === "master_alessia_setzen"){
          window.__rufe.setzen.push(param);
          return { data: window.__setzenAntwort || { ok:true }, error:null };
        }
        if(name === "ist_master") return { data:true, error:null };
      
        return { data:null, error:null };
      },
      from: () => leer(),
      channel: () => ({ on(){ return this; }, subscribe(){ return this; }, unsubscribe(){} }),
      removeChannel: () => {}, removeAllChannels: () => {},
      functions: { invoke: async () => ({ data:null, error:null }) },
      storage: { from: () => ({ getPublicUrl: () => ({ data:{ publicUrl:"" } }), upload: async () => ({}) }) }
    }) };
  ` + "})(" + JSON.stringify(alessiaAntwort) + ");";
}


async function masterOffen(browser, antwort){
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push(String(e).slice(0, 200)));
  await p.addInitScript({ content: ersatz(antwort) });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto(S("master.html"));
  await p.waitForSelector("#app:not(.hidden)", { timeout: 10000 });
  await p.waitForTimeout(500);
  return { ctx, p, kons };
}

(async () => {
  const browser = await chromium.launch();
  console.log("══ Übersicht ══");
  {
    const { ctx, p, kons } = await masterOffen(browser, ZEILEN);
    const st = await p.evaluate(() => ({
      rufe: window.__rufe.master_alessia, xss: window.__xss || 0,
      note: document.getElementById("alessiaNote").textContent,
      karten: [...document.querySelectorAll("#alessiaListe .alessia-karte")].map(k => ({
        name: k.querySelector(".z-betrieb").textContent, mail: k.querySelector(".z-mail").textContent,
        meta: k.querySelector(".z-meta").textContent, stand: k.querySelector(".stand").textContent,
        h: k.getBoundingClientRect().height }))
    }));
    pruef(st.rufe === 1, "master_alessia() wird beim Laden genau einmal gerufen", st.rufe);
    pruef(st.karten.length === 3 && st.note === "1 von 3 nehmen an", "je Betrieb eine Karte, Kopfzeile zählt die annehmenden", st.note);
    const c = st.karten[0], b = st.karten[1], x = st.karten[2];
    pruef(c.stand === "Nimmt an" && /\+4964229990001/.test(c.mail) && /asst_choco/.test(c.mail) && /warm, per Sie/.test(c.meta) && /12 in 7 Tagen/.test(c.meta) && !/zuletzt zuletzt/i.test(c.meta),
      "Karte zeigt Nummer, Assistent, Ton, Stand und Bestellungen", JSON.stringify(c));
    pruef(b.stand === "Aus" && x.stand === "Keine Nummer" && /noch keine Telefonbestellung/.test(x.meta), "„Aus“ und „Keine Nummer“ sind unterscheidbar", b.stand + " / " + x.stand);
    pruef(st.xss === 0 && /<img/.test(c.name), "Name aus der Datenbank nur als Text", c.name.slice(0, 30));
    pruef(st.karten.every(k => k.h >= 44), "jede Karte ≥ 44 px antippbar", st.karten.map(k => Math.round(k.h)).join(","));

    await p.click('#alessiaListe [data-alessia="b1"]');
    await p.waitForTimeout(250);
    const form = await p.evaluate(() => ["alNummer","alNummerId","alAssistent","alStimme","alGruss"].map(id => document.getElementById(id).value)
      .concat([document.getElementById("alAktiv").checked]));
    pruef(form.join("|") === "+4964229990001|pn_1|asst_choco|warm, per Sie|Choco, hier ist Alessia.|true", "Tipp öffnet das Einrichten mit den gespeicherten Werten", form.join(" | "));
    await p.fill("#alNummer", "+49 6422 999 0007"); await p.fill("#alAssistent", "asst_neu");
    await p.evaluate(() => { document.getElementById("alAktiv").checked = false; });
    await p.click("#alSave"); await p.waitForTimeout(300);
    const gesendet = await p.evaluate(() => window.__rufe.setzen[0]);
    const paramsMig = (MIG.match(/function public\.master_alessia_setzen\(([^)]*)\)/) || ["", ""])[1].match(/p_[a-z_]+/g) || [];
    const schluesselMig = ((MIG.match(/alessia = jsonb_strip_nulls\(jsonb_build_object\(([\s\S]*?)\)\)\)/) || ["", ""])[1].match(/'([a-z_]+)'/g) || []).map(s => s.slice(1, -1)).filter((k, i, alle) => alle.indexOf(k) === i);
    pruef(!!gesendet && Object.keys(gesendet).sort().join() === paramsMig.slice().sort().join(),
      "Speichern schickt genau die Parameter von master_alessia_setzen", gesendet && Object.keys(gesendet).join(",") + " | " + paramsMig.join(","));
    pruef(!!gesendet && Object.keys(gesendet.p_alessia).sort().join() === schluesselMig.slice().sort().join(),
      "… und genau die Alessia-Schlüssel, die die Migration speichert", gesendet && Object.keys(gesendet.p_alessia).join(",") + " | " + schluesselMig.join(","));
    pruef(!!gesendet && gesendet.p_betrieb === "b1" && gesendet.p_nummer === "+49 6422 999 0007" && gesendet.p_alessia.assistent_id === "asst_neu" && gesendet.p_alessia.aktiv === false,
      "… mit den eingetragenen Werten (Haken weg = aus)", JSON.stringify(gesendet));
    const zu = await p.evaluate(() => !document.querySelector(".overlay"));
    pruef(zu, "nach dem Speichern schließt das Blatt");

    await p.evaluate(() => { window.__setzenAntwort = { ok:false, grund:"nummer_vergeben" }; });
    await p.click('#alessiaListe [data-alessia="b2"]'); await p.waitForTimeout(200);
    await p.fill("#alNummer", "+4964229990001"); await p.click("#alSave"); await p.waitForTimeout(300);
    const satz = await p.evaluate(() => ({ text: document.getElementById("alMeldung").textContent, offen: !!document.querySelector(".overlay") }));
    pruef(satz.offen && /gehört schon einem anderen Betrieb/.test(satz.text), "vergebene Nummer: Blatt bleibt offen, ein Satz statt Fehlercode", satz.text);
    pruef(kons.length === 0, "keine Laufzeitfehler", kons.join(" | ") || "still");
    await ctx.close();
  }
  console.log("\n══ Migration fehlt ══");
  {
    const { ctx, p, kons } = await masterOffen(browser, { fehlercode:"42883", fehlermeldung:"function master_alessia() does not exist" });
    const t = await p.evaluate(() => document.getElementById("alessiaListe").textContent);
    pruef(/migration-telefonbestellung\.sql/.test(t), "sagt, welche Migration fehlt", t.trim().slice(0, 80));
    pruef(kons.length === 0, "kein Absturz", kons.join(" | ") || "still");
    await ctx.close();
  }
  await browser.close();
  console.log("\n" + (n - fehler) + " von " + n + " ok");
  console.log(fehler ? fehler + " FEHLER" : "Alles sauber.");
  process.exit(fehler ? 1 : 0);
})();
