/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Master-Board: Zugänge-Übersicht (master_zugaenge)

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-master-zugaenge.js

   Nutzerwunsch (29.09.2026): "ich möchte auch, dass es mit dem
   Masterboard verbunden ist ... ich sehe auch die einzelnen Betriebe,
   die auf ihre eigenen Mails angemeldet sind ... Sobald jemand
   registriert ist, soll das automatisch im Master-Hub stehen."

   Befund vorher: public.master_zugaenge() (migration-pin.sql) war
   bereits fertig gebaut und serverseitig auf ist_master() abgesichert
   — aber von KEINER Seite aufgerufen. Reine Verdrahtungsaufgabe:
   seiten/master.html ruft jetzt sb.rpc('master_zugaenge') im selben
   Promise.all wie die übrigen Rohdaten und zeichnet eine Liste
   (Betrieb, E-Mail, Rolle, letzter Login, Status).

   Die Absicherung selbst — dass eine Nicht-Master-Sitzung serverseitig
   eine LEERE Tabelle bekommt, keinen Fehler — steht schon in
   master_zugaenge() und wird hier NICHT erneut geprüft (das ist Sache
   eines echten Postgres, nicht dieser Seite). Was HIER zählt: zeigt
   das Frontend eine leere Antwort sauber als "nichts da" statt mit
   einem Fehler abzustürzen, und zeichnet es echte Zeilen richtig.

   EHRLICHE GRENZE: Die Datenbank wird gestellt (kein echtes Postgres).
   Ob master_zugaenge() in Produktion wirklich ausgerollt ist, zeigt
   nur ein echter Aufruf dort — das prüft diese Datei nicht.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const S = n => "file://" + path.join(__dirname, "..", "seiten", n);

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

const BEISPIEL_ZUGAENGE = [
  { nutzer_id:"a1", email:"gesperrt@probe.de", betrieb_id:"b1", betrieb_name:"Gesperrtes Bistro",
    rolle:"inhaber", zuletzt:new Date(Date.now() - 3600000).toISOString(), bestaetigt:true,
    hat_pin:true, pin_gesperrt:false, login_gesperrt:true, ist_master:false, pin_pflicht:true },
  { nutzer_id:"a2", email:"pin-gesperrt@probe.de", betrieb_id:"b2", betrieb_name:"Pin-Bistro",
    rolle:"team", zuletzt:new Date(Date.now() - 7200000).toISOString(), bestaetigt:true,
    hat_pin:true, pin_gesperrt:true, login_gesperrt:false, ist_master:false, pin_pflicht:true },
  { nutzer_id:"a3", email:"neu@probe.de", betrieb_id:"b3", betrieb_name:"Frisches Café",
    rolle:"inhaber", zuletzt:null, bestaetigt:false,
    hat_pin:false, pin_gesperrt:false, login_gesperrt:false, ist_master:false, pin_pflicht:false },
  { nutzer_id:"a4", email:"master@omoteno.de", betrieb_id:null, betrieb_name:null,
    rolle:null, zuletzt:new Date(Date.now() - 60000).toISOString(), bestaetigt:true,
    hat_pin:true, pin_gesperrt:false, login_gesperrt:false, ist_master:true, pin_pflicht:false },
  { nutzer_id:"a5", email:"aktiv@probe.de", betrieb_id:"b5", betrieb_name:"Aktives Diner",
    rolle:"inhaber", zuletzt:new Date(Date.now() - 300000).toISOString(), bestaetigt:true,
    hat_pin:true, pin_gesperrt:false, login_gesperrt:false, ist_master:false, pin_pflicht:true }
];

/* Nachbau von supabase-js — dieselbe Grundform wie pruef-sperre-ueberall.js
   (Auth immer als echtes Master-Konto durch), mit einer konfigurierbaren
   Antwort auf rpc('master_zugaenge'). */
function ersatz(zugaengeAntwort){
  return "(function(antwort){" + `
    window.__rufe = { master_zugaenge: 0 };
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
      rpc: async (name) => {
        if(name === "ist_master") return { data:true, error:null };
        if(name === "master_zugaenge"){
          window.__rufe.master_zugaenge++;
          if(antwort && antwort.fehlercode) return { data:null, error:{ code:antwort.fehlercode, message:antwort.fehlermeldung || "Fehler" } };
          return { data: antwort || [], error:null };
        }
        return { data:null, error:null };
      },
      from: () => leer(),
      channel: () => ({ on(){ return this; }, subscribe(){ return this; }, unsubscribe(){} }),
      removeChannel: () => {}, removeAllChannels: () => {},
      functions: { invoke: async () => ({ data:null, error:null }) },
      storage: { from: () => ({ getPublicUrl: () => ({ data:{ publicUrl:"" } }), upload: async () => ({}) }) }
    }) };
  ` + "})(" + JSON.stringify(zugaengeAntwort) + ");";
}

async function masterOffen(browser, zugaengeAntwort){
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push(String(e).slice(0, 200)));
  await p.addInitScript({ content: ersatz(zugaengeAntwort) });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto(S("master.html"));
  /* Der Nachbau liefert von Anfang an eine gültige Sitzung — genau wie
     bei einer gemerkten Anmeldung prüft master.html die Rolle SOFORT
     beim Laden (nurMaster()) und zeigt bei einem echten Master-Konto
     direkt die Zentrale, ohne über das Anmeldeformular zu gehen. */
  await p.waitForSelector("#app:not(.hidden)", { timeout: 10000 });
  await p.waitForTimeout(400);
  return { ctx, p, kons };
}

(async () => {
  const browser = await chromium.launch();

  /* ── Echte Zeilen ─────────────────────────────────────────────── */
  console.log("══ Echte Zugänge ══");
  {
    const { ctx, p, kons } = await masterOffen(browser, BEISPIEL_ZUGAENGE);
    const stand = await p.evaluate(() => ({
      aufgerufen: window.__rufe.master_zugaenge,
      note: document.getElementById("zugaengeNote").textContent,
      karten: [...document.querySelectorAll("#zugaengeListe .zugang")].map(k => ({
        betrieb: k.querySelector(".z-betrieb").textContent,
        mail: k.querySelector(".z-mail").textContent,
        meta: k.querySelector(".z-meta").textContent,
        status: k.querySelector(".stand").textContent,
        statusKlasse: k.querySelector(".stand").className
      }))
    }));
    pruef(stand.aufgerufen === 1, "master_zugaenge() wird genau einmal beim Laden aufgerufen", stand.aufgerufen);
    pruef(stand.note === "5 Konten", "die Kopfzeile zählt die Konten", stand.note);
    pruef(stand.karten.length === 5, "alle fünf Zugänge erscheinen als Karten", stand.karten.length);

    const gesperrt = stand.karten.find(k => k.mail === "gesperrt@probe.de");
    pruef(!!gesperrt && gesperrt.status === "Gesperrt" && /s-gesperrt/.test(gesperrt.statusKlasse),
      "eine Login-Sperre zeigt „Gesperrt“", gesperrt && gesperrt.status);
    pruef(!!gesperrt && gesperrt.betrieb === "Gesperrtes Bistro", "…mit dem richtigen Betriebsnamen", gesperrt && gesperrt.betrieb);

    const pin = stand.karten.find(k => k.mail === "pin-gesperrt@probe.de");
    pruef(!!pin && /gesperrt/i.test(pin.status) && /s-gesperrt/.test(pin.statusKlasse),
      "eine PIN-Sperre wird eigens benannt, trägt aber dieselbe Dringlichkeit (s-gesperrt)", pin && pin.status);

    const neu = stand.karten.find(k => k.mail === "neu@probe.de");
    pruef(!!neu && neu.status === "Nicht bestätigt", "eine unbestätigte E-Mail wird als solche benannt", neu && neu.status);

    const master = stand.karten.find(k => k.mail === "master@omoteno.de");
    pruef(!!master && master.status === "Master" && master.betrieb === "— ohne Betrieb —",
      "ein Master-Konto ohne Betrieb wird klar als solches gezeigt, nicht als Datenlücke",
      master && JSON.stringify({ status:master.status, betrieb:master.betrieb }));

    const aktiv = stand.karten.find(k => k.mail === "aktiv@probe.de");
    pruef(!!aktiv && aktiv.status === "Aktiv" && /Vor \d|Zuletzt vor|Gerade eben/.test(aktiv.meta),
      "ein normales, aktives Konto zeigt „Aktiv“ und einen echten Zeitpunkt", aktiv && JSON.stringify(aktiv));

    const reihenfolge = stand.karten.map(k => k.mail);
    pruef(reihenfolge.indexOf("gesperrt@probe.de") < reihenfolge.indexOf("aktiv@probe.de") &&
          reihenfolge.indexOf("pin-gesperrt@probe.de") < reihenfolge.indexOf("aktiv@probe.de"),
      "gesperrte Konten stehen vor unauffälligen — wer eingreifen muss, sieht es zuerst",
      reihenfolge.join(", "));

    pruef(kons.length === 0, "keine Laufzeitfehler", kons.join(" | ") || "still");
    await ctx.close();
  }

  /* ── Leer: kein angemeldetes Konto außer dem eigenen (die RPC selbst
     würde IMMER mindestens den Master zurückgeben — der leere Fall
     prüft, dass eine leere Antwort NICHT abstürzt oder "FEHLER" zeigt,
     nicht ob er in der Praxis vorkommt). ── */
  console.log("\n══ Leere Antwort ══");
  {
    const { ctx, p, kons } = await masterOffen(browser, []);
    const stand = await p.evaluate(() => ({
      note: document.getElementById("zugaengeNote").textContent,
      text: document.getElementById("zugaengeListe").textContent
    }));
    pruef(stand.note === "—", "Kopfzeile zeigt „—“ statt „0 Konten“", stand.note);
    pruef(/kein angemeldetes Konto/i.test(stand.text), "ehrliche Meldung statt leerer Fläche", stand.text.trim().slice(0, 60));
    pruef(kons.length === 0, "keine Laufzeitfehler", kons.join(" | ") || "still");
    await ctx.close();
  }

  /* ── Migration fehlt noch (42883 = Funktion existiert nicht) ────── */
  console.log("\n══ Fall „Migration fehlt noch“ ══");
  {
    const { ctx, p, kons } = await masterOffen(browser, { fehlercode:"42883", fehlermeldung:"function master_zugaenge() does not exist" });
    const stand = await p.evaluate(() => document.getElementById("zugaengeListe").textContent);
    pruef(/migration-pin\.sql/i.test(stand), "sagt, welche Migration fehlt — keine rohe Fehlermeldung", stand.trim().slice(0, 90));
    pruef(kons.length === 0, "kein Absturz, wenn die Funktion (noch) fehlt", kons.join(" | ") || "still");
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${fehler === 0 ? "Alles sauber." : fehler + " Fehler"}`);
  if(fehler) process.exit(1);
})();
