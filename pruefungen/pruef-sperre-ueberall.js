/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Sperre gilt an jeder Tür, und es gibt einen Weg heraus

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-sperre-ueberall.js

   VORFALL (25.09.2026, beim Lesen gefunden, nicht gemeldet):
   · Die Sperre nach drei Fehlversuchen (admin_anmelden) stand NUR im
     Bestell-Board. Küche, Konto und Master meldeten sich direkt an —
     mit demselben Konto ließ sich dort beliebig weiterraten.
   · Die Zentrale (master.html) prüfte die Rolle nie. Jedes Konto kam
     hinein; nur die RLS-Regeln hielten Fremdes fern.
   · Aufgehoben wird die Sperre erst, wenn sich das Passwort ändert
     (Trigger admin_login_entsperren). Keine Seite ließ es ändern: Der
     Link aus „Passwort vergessen“ meldete an, fragte aber nie nach
     einem neuen Passwort. Wer gesperrt war, blieb es.

   pruef-admin-login.js prüft die Sperre im Board. Diese hier hält
   jede ANDERE Tür dagegen — und den Weg hinaus.

   Die Bibliothek (supabase-js) kommt aus einem Netz, das hier gesperrt
   ist; sie wird durch einen Ersatz gestellt, der genau die Methoden
   trägt, die die Seiten rufen. Die Küche benutzt keine Bibliothek,
   sondern fetch — dort wird das Netz gestellt (page.route).

   EHRLICHE GRENZE: Wer die Auth-Schnittstelle von Supabase direkt
   anspricht, umgeht jede dieser Seiten. Diese Sperre schützt die Türen,
   die ein Mensch benutzt. Den Datenzugriff schützt serverseitig erst
   die PIN (pin_ok() in meine_betriebe) — siehe pruef-rechte.sql.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");
const S = n => "file://" + path.join(__dirname, "..", "seiten", n);

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

/* Ein Ersatz für supabase-js. `lage` steuert, was die Datenbank sagt:
   sperre: "gesperrt" | "falsch" | "erlaubt" | "fehlt"
   master: true | false | "fehler"
   sitzung: true | false
   wieder: true → PASSWORD_RECOVERY wird gemeldet */
function ersatz(lage){
  return "(function(lage){" + `
    window.__rufe = { anmelden:[], signIn:[], signOut:0, updateUser:[], master:0 };
    const nutzer = { id:"00000000-0000-0000-0000-000000000001", email:"wirt@probe.de" };
    let sitzung = lage.sitzung ? { user:nutzer, access_token:"x" } : null;
    const horcher = [];
    const kette = () => {
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
    window.supabase = { createClient: () => {
      const c = {
        auth: {
          getSession: async () => ({ data:{ session: sitzung } }),
          getUser: async () => ({ data:{ user: sitzung ? nutzer : null } }),
          signInWithPassword: async (a) => { window.__rufe.signIn.push(a); sitzung = { user:nutzer, access_token:"x" };
            return { data:{ user:nutzer, session:sitzung }, error:null }; },
          signOut: async () => { window.__rufe.signOut++; sitzung = null; horcher.forEach(f => f("SIGNED_OUT", null)); return {}; },
          updateUser: async (a) => { window.__rufe.updateUser.push(a); return { data:{ user:nutzer }, error:null }; },
          resetPasswordForEmail: async () => ({ error:null }),
          onAuthStateChange: (f) => { horcher.push(f);
            if(lage.wieder) setTimeout(() => f("PASSWORD_RECOVERY", sitzung), 30);
            return { data:{ subscription:{ unsubscribe(){} } } }; },
          signInWithOAuth: async () => ({ data:{}, error:null })
        },
        rpc: async (name, args) => {
          if(name === "admin_anmelden"){
            window.__rufe.anmelden.push(args);
            if(lage.sperre === "fehlt") return { data:null, error:{ message:"Could not find the function" } };
            if(lage.sperre === "gesperrt") return { data:{ erlaubt:false, gesperrt:true, nachricht:"Der Zugang ist gesperrt." }, error:null };
            if(lage.sperre === "falsch") return { data:{ erlaubt:false, gesperrt:false, nachricht:"E-Mail oder Passwort stimmt nicht.", verbleibend:2 }, error:null };
            return { data:{ erlaubt:true, gesperrt:false, nachricht:"" }, error:null };
          }
          if(name === "ist_master"){
            window.__rufe.master++;
            if(lage.master === "fehler") return { data:null, error:{ message:"Netz" } };
            return { data: lage.master === true, error:null };
          }
          return { data:null, error:null };
        },
        from: () => kette(),
        channel: () => ({ on(){ return this; }, subscribe(){ return this; }, unsubscribe(){} }),
        removeChannel: () => {},
        removeAllChannels: () => {},
        functions: { invoke: async () => ({ data:null, error:null }) },
        storage: { from: () => ({ getPublicUrl: () => ({ data:{ publicUrl:"" } }), upload: async () => ({}) }) }
      };
      return c;
    } };
  ` + "})(" + JSON.stringify(lage) + ");";
}

async function seiteMit(browser, datei, lage, zusatz){
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push(String(e).slice(0, 160)));
  await p.addInitScript({ content: ersatz(lage) });
  await p.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto(S(datei) + (zusatz || ""));
  await p.waitForTimeout(700);
  return { ctx, p, kons };
}

(async () => {
  const browser = await chromium.launch();

  /* ══ 1 · Küche ═══════════════════════════════════════════════════ */
  console.log("══ Küche ══");
  for(const [fall, antwort, erwartToken] of [
    ["gesperrt", { status:200, body:{ erlaubt:false, gesperrt:true, nachricht:"Der Zugang ist gesperrt." } }, 0],
    ["falsch",   { status:200, body:{ erlaubt:false, gesperrt:false, nachricht:"E-Mail oder Passwort stimmt nicht.", verbleibend:1 } }, 0],
    ["erlaubt",  { status:200, body:{ erlaubt:true, gesperrt:false, nachricht:"" } }, 1],
    ["fehlt",    { status:404, body:{ message:"Could not find the function" } }, 1]]){
    const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
    const p = await ctx.newPage();
    const rufe = { sperre:0, token:0 };
    await p.route("**/*", async r => {
      const u = r.request().url();
      if(u.startsWith("file://")) return r.continue();
      if(/\/rest\/v1\/rpc\/admin_anmelden/.test(u)){ rufe.sperre++;
        return r.fulfill({ status:antwort.status, contentType:"application/json", body:JSON.stringify(antwort.body) }); }
      if(/\/auth\/v1\/token/.test(u)){ rufe.token++;
        return r.fulfill({ status:400, contentType:"application/json", body:JSON.stringify({ error_description:"Probe: hier endet es" }) }); }
      return r.abort();
    });
    await p.goto(S("kueche.html"));
    await p.waitForTimeout(500);
    await p.evaluate(() => { try{ localStorage.clear(); }catch(e){} });
    if(!(await p.isVisible("#mail"))){ pruef(false, "Küche · Anmeldeschirm steht (" + fall + ")"); await ctx.close(); continue; }
    await p.fill("#mail", "wirt@probe.de");
    await p.fill("#wort", "raten123");
    await p.click("#torKnopf");
    await p.waitForTimeout(500);
    const text = await p.textContent("#torMeldung");
    pruef(rufe.sperre === 1 && rufe.token === erwartToken,
      "Küche · „" + fall + "“: Sperre gefragt, Anmeldung " + (erwartToken ? "versucht" : "NICHT versucht"),
      "Sperre " + rufe.sperre + "×, Token " + rufe.token + "× · „" + text.trim().slice(0, 70) + "“");
    if(fall === "gesperrt") pruef(/gesperrt/.test(text) && /Passwort vergessen/.test(text),
      "Küche · gesperrt: sagt, wo man entsperrt", text.trim().slice(0, 90));
    if(fall === "falsch") pruef(/Noch ein Versuch/.test(text), "Küche · warnt vor dem letzten Versuch", text.trim());
    await ctx.close();
  }

  /* ══ 2 · Master ══════════════════════════════════════════════════ */
  console.log("\n══ Master ══");
  const anmeldenMaster = async p => {
    await p.fill("#email", "wirt@probe.de");
    await p.fill("#password", "raten123");
    await p.click("#loginBtn");
    await p.waitForTimeout(700);
    return p.evaluate(() => ({
      app: !document.getElementById("app").classList.contains("hidden") && getComputedStyle(document.getElementById("app")).display !== "none",
      login: getComputedStyle(document.getElementById("loginScreen")).display !== "none",
      text: (document.getElementById("loginMsg") || {}).textContent || "",
      rufe: window.__rufe
    }));
  };
  {
    const { ctx, p, kons } = await seiteMit(browser, "master.html", { sperre:"gesperrt", master:true });
    const r = await anmeldenMaster(p);
    pruef(r.rufe.anmelden.length === 1 && r.rufe.signIn.length === 0 && !r.app,
      "Master · gesperrt: kein Login-Versuch, keine Zentrale", JSON.stringify({ sperre:r.rufe.anmelden.length, signIn:r.rufe.signIn.length }));
    pruef(/gesperrt/.test(r.text), "Master · sagt „gesperrt“", r.text.slice(0, 80));
    pruef(kons.length === 0, "Master · keine Ausnahme", kons[0] || "still");
    await ctx.close();
  }
  {
    const { ctx, p } = await seiteMit(browser, "master.html", { sperre:"erlaubt", master:false });
    const r = await anmeldenMaster(p);
    pruef(r.rufe.signIn.length === 1 && r.rufe.master >= 1 && r.rufe.signOut >= 1 && !r.app,
      "Master · Wirt-Konto (kein Master): angemeldet, geprüft, sofort wieder abgemeldet",
      JSON.stringify({ signIn:r.rufe.signIn.length, ist_master:r.rufe.master, signOut:r.rufe.signOut, app:r.app }));
    pruef(/keinen Zugang/.test(r.text), "Master · und sagt, warum", r.text.slice(0, 80));
    await ctx.close();
  }
  {
    const { ctx, p } = await seiteMit(browser, "master.html", { sperre:"erlaubt", master:"fehler" });
    const r = await anmeldenMaster(p);
    pruef(!r.app && /nicht erreichbar/.test(r.text), "Master · Rolle nicht prüfbar: Tür bleibt zu, mit Grund", r.text.slice(0, 80));
    await ctx.close();
  }
  {
    const { ctx, p } = await seiteMit(browser, "master.html", { sperre:"erlaubt", master:true });
    const r = await anmeldenMaster(p);
    pruef(r.rufe.master >= 1 && r.rufe.signOut === 0 && r.app, "Master · echtes Master-Konto kommt hinein",
      JSON.stringify({ ist_master:r.rufe.master, signOut:r.rufe.signOut, app:r.app }));
    await ctx.close();
  }
  {
    /* Eine gemerkte Sitzung eines Wirts darf beim Neuladen nicht
       durchrutschen — der zweite Weg hinein. */
    const { ctx, p } = await seiteMit(browser, "master.html", { sperre:"erlaubt", master:false, sitzung:true });
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({ app: getComputedStyle(document.getElementById("app")).display !== "none", rufe: window.__rufe }));
    pruef(r.rufe.master >= 1 && r.rufe.signOut >= 1 && !r.app, "Master · gemerkte Sitzung eines Wirts: beim Laden abgemeldet",
      JSON.stringify({ ist_master:r.rufe.master, signOut:r.rufe.signOut, app:r.app }));
    await ctx.close();
  }

  /* ══ 3 · Konto ═══════════════════════════════════════════════════ */
  console.log("\n══ Konto ══");
  {
    const { ctx, p, kons } = await seiteMit(browser, "konto.html", { sperre:"gesperrt" });
    await p.fill("#fMail", "wirt@probe.de");
    await p.fill("#fPass", "raten123");
    await p.click("#torKnopf");
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({ text: document.getElementById("torMeldung").textContent, rufe: window.__rufe }));
    pruef(r.rufe.anmelden.length === 1 && r.rufe.signIn.length === 0, "Konto · gesperrt: kein Login-Versuch",
      JSON.stringify({ sperre:r.rufe.anmelden.length, signIn:r.rufe.signIn.length }));
    pruef(/gesperrt/.test(r.text) && /Passwort vergessen/.test(r.text), "Konto · sagt, wie man herauskommt", r.text.slice(0, 90));
    pruef(kons.length === 0, "Konto · keine Ausnahme", kons[0] || "still");
    await ctx.close();
  }
  {
    const { ctx, p } = await seiteMit(browser, "konto.html", { sperre:"fehlt" });
    await p.fill("#fMail", "wirt@probe.de");
    await p.fill("#fPass", "richtig123");
    await p.click("#torKnopf");
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => window.__rufe);
    pruef(r.signIn.length === 1, "Konto · Sperrprüfung fehlt: niemand ausgesperrt (§7)", "signIn " + r.signIn.length + "×");
    await ctx.close();
  }
  /* Zwei Wege, auf denen der Link sich zeigt: die Adresse (type=recovery,
     klassischer Ablauf) und das Ereignis PASSWORD_RECOVERY (auch beim
     PKCE-Ablauf mit ?code=). Jeder wird EINZELN geprüft — zusammen
     würde der eine den Ausfall des anderen verdecken. */
  for(const [weg, lage, adresse] of [["nur Adresse", { sitzung:true }, "#access_token=x&type=recovery"],
                                     ["nur Ereignis", { sitzung:true, wieder:true }, ""]]){
    const { ctx, p } = await seiteMit(browser, "konto.html", lage, adresse);
    const neu = await p.evaluate(() => !document.getElementById("neuPass").hidden);
    pruef(neu, "Konto · " + weg + ": „Neues Passwort“ erscheint");
    await ctx.close();
  }
  {
    const { ctx, p, kons } = await seiteMit(browser, "konto.html", { sitzung:true, wieder:true }, "#access_token=x&type=recovery");
    const sicht = await p.evaluate(() => ({ neu: !document.getElementById("neuPass").hidden, konto: !document.getElementById("konto").hidden }));
    pruef(sicht.neu && !sicht.konto, "Konto · nach dem Link steht „Neues Passwort“, nicht das Konto", JSON.stringify(sicht));
    if(sicht.neu){
    await p.fill("#npEins", "neuesPasswort1");
    await p.fill("#npZwei", "anderes");
    await p.click("#npKnopf");
    await p.waitForTimeout(250);
    let r = await p.evaluate(() => ({ text: document.getElementById("npMeldung").textContent, rufe: window.__rufe.updateUser.length }));
    pruef(/nicht gleich/.test(r.text) && r.rufe === 0, "Konto · zwei ungleiche Eingaben werden nicht gespeichert", r.text);
    await p.fill("#npZwei", "neuesPasswort1");
    await p.click("#npKnopf");
    await p.waitForTimeout(500);
    r = await p.evaluate(() => ({ rufe: window.__rufe.updateUser, neu: !document.getElementById("neuPass").hidden, hash: location.hash }));
    pruef(r.rufe.length === 1 && r.rufe[0].password === "neuesPasswort1" && !r.neu && !/recovery/.test(r.hash),
      "Konto · das neue Passwort wird gesetzt, das Formular verschwindet, die Adresse ist sauber", JSON.stringify(r));
    } else pruef(false, "Konto · Formular-Proben übersprungen — die Voraussetzung fehlt");
    pruef(kons.length === 0, "Konto · keine Ausnahme", kons[0] || "still");
    await ctx.close();
  }

  /* ══ 4 · Board: der Weg aus der Sperre ══════════════════════════ */
  console.log("\n══ Board ══");
  for(const [weg, lage, adresse] of [["nur Adresse", { sitzung:true }, "#access_token=x&type=recovery"],
                                     ["nur Ereignis", { sitzung:true, wieder:true }, ""]]){
    const { ctx, p } = await seiteMit(browser, "admin.html", lage, adresse);
    await p.waitForTimeout(200);
    const neu = await p.evaluate(() => !document.getElementById("tor").hidden && !document.getElementById("lNeuTeil").hidden);
    pruef(neu, "Board · " + weg + ": „Neues Passwort“ erscheint");
    await ctx.close();
  }
  {
    const { ctx, p, kons } = await seiteMit(browser, "admin.html", { sitzung:true, wieder:true }, "#access_token=x&type=recovery");
    const scharf = await p.$("#scharfJetzt");
    if(scharf && await p.isVisible("#scharf")){ await scharf.click(); await p.waitForTimeout(300); }
    const sicht = await p.evaluate(() => ({ tor: !document.getElementById("tor").hidden,
      neu: !document.getElementById("lNeuTeil").hidden, login: !document.getElementById("lAnmeldeteil").hidden }));
    pruef(sicht.tor && sicht.neu && !sicht.login, "Board · nach dem Link steht „Neues Passwort“ statt der Anmeldung", JSON.stringify(sicht));
    if(sicht.neu){
    await p.fill("#lNeu1", "kurz");
    await p.fill("#lNeu2", "kurz");
    await p.click("#lNeuKnopf");
    await p.waitForTimeout(250);
    let r = await p.evaluate(() => ({ text: document.getElementById("lNeuFehler").textContent, n: window.__rufe.updateUser.length }));
    pruef(/acht Zeichen/.test(r.text) && r.n === 0, "Board · zu kurz wird nicht gespeichert", r.text);
    await p.fill("#lNeu1", "neuesPasswort1");
    await p.fill("#lNeu2", "neuesPasswort1");
    await p.click("#lNeuKnopf");
    await p.waitForTimeout(700);
    r = await p.evaluate(() => ({ rufe: window.__rufe.updateUser, tor: !document.getElementById("tor").hidden, hash: location.hash }));
    pruef(r.rufe.length === 1 && r.rufe[0].password === "neuesPasswort1" && !r.tor && !/recovery/.test(r.hash),
      "Board · neues Passwort gesetzt, Board offen, Adresse sauber", JSON.stringify(r));
    } else pruef(false, "Board · Formular-Proben übersprungen — die Voraussetzung fehlt");
    pruef(kons.length === 0, "Board · keine Ausnahme", kons[0] || "still");
    await ctx.close();
  }
  {
    /* Ohne den Link: ganz normal das Board, kein Passwort-Formular. */
    const { ctx, p } = await seiteMit(browser, "admin.html", { sitzung:true });
    const sicht = await p.evaluate(() => ({ tor: !document.getElementById("tor").hidden }));
    pruef(!sicht.tor, "Board · ohne Link kein Passwort-Formular", JSON.stringify(sicht));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
