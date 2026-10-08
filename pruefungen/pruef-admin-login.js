/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Drei Fehlversuche sperren die Anmeldung im Board

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-admin-login.js

   Die Datenbankseite (migration-admin-login-schutz.sql) prüft sich
   selbst per Proben in einer zurückgedrehten Transaktion — steht in
   der Migrationsdatei. Hier geht es um die andere Hälfte: Ruft
   admin.html die Prüfung wirklich VOR jedem echten Supabase-Login,
   zeigt es den richtigen Schirm, und lässt es niemanden aus, wenn
   die Prüfung selbst mal nicht erreichbar ist?

   Die echte @supabase/supabase-js-Bibliothek liegt seit 08.10. unter
   /lib/ und ist unter file:// nicht erreichbar (und mit integrity
   geschützt — untergeschoben würde sie abgewiesen). Ersetzt durch einen dünnen Ersatz, der GENAU die
   Methoden trägt, die admin.html tatsächlich ruft — nicht mehr, nicht
   weniger. Wer diesen Ersatz erweitert, prüft ihn zuerst gegen
   `grep -oE 'db\.(auth\.[a-zA-Z]+|from|rpc|functions\.[a-zA-Z]+)'
   seiten/admin.html`, sonst bleibt eine neue Methode unbemerkt fehlen
   und die Seite läuft im Test gegen eine Lücke, nicht gegen den
   echten Bestand.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ADMIN = path.join(__dirname, "..", "seiten", "admin.html");
if(!fs.existsSync(ADMIN)){
  console.error("seiten/admin.html nicht gefunden.");
  process.exit(1);
}

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

/* Ein einziges addInitScript für den Fall "Sperrprüfung antwortet
   ganz normal", mit einem Schalter, der den 3. Fehlversuch, danach
   den 4. (richtiges Passwort, weiter gesperrt) durchspielt. */
function ersatzSupabase(){
  return () => {
    let versuche = 0, gesperrt = false;
    window.__aufrufe = { admin_anmelden: [], signInWithPassword: [], resetPasswordForEmail: [] };
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data:{ session:null } }),
          signInWithPassword: async ({email, password}) => {
            window.__aufrufe.signInWithPassword.push({email, password});
            return { error: password === "richtig123" ? null : { message:"Invalid login credentials" } };
          },
          resetPasswordForEmail: async (mail) => {
            window.__aufrufe.resetPasswordForEmail.push(mail);
            return { error:null };
          },
          signOut: async () => ({}),
          onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } })
        },
        rpc: async (name, args) => {
          if(name !== "admin_anmelden") return { data:null, error:{message:"unbekannte Funktion: " + name} };
          window.__aufrufe.admin_anmelden.push(args);
          if(gesperrt) return { data:{erlaubt:false, gesperrt:true,
            nachricht:"weiterhin gesperrt"}, error:null };
          if(args.p_passwort === "richtig123")
            return { data:{erlaubt:true, gesperrt:false, nachricht:""}, error:null };
          versuche++;
          if(versuche >= 3){
            gesperrt = true;
            return { data:{erlaubt:false, gesperrt:true, nachricht:"jetzt gesperrt"}, error:null };
          }
          return { data:{erlaubt:false, gesperrt:false, nachricht:"E-Mail oder Passwort stimmt nicht.",
            verbleibend: 3 - versuche}, error:null };
        },
        from: () => ({ select: () => ({ eq: () => Promise.resolve({data:[], error:null}) }) }),
        functions: { invoke: async () => ({ data:null, error:null }) }
      })
    };
  };
}

async function tor(seite){
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(700);
  const scharf = await seite.$("#scharfJetzt");
  if(scharf && await seite.isVisible("#scharf")){ await scharf.click(); await seite.waitForTimeout(300); }
}

async function versuch(seite, pass){
  await seite.fill("#lMail", "wirt@choco.de");
  await seite.fill("#lPass", pass);
  await seite.click("#lKnopf");
  await seite.waitForTimeout(250);
  return seite.evaluate(() => ({
    gesperrt: !document.getElementById("lGesperrt").hidden,
    fehler: !document.getElementById("lFehler").hidden,
    fehlerText: document.getElementById("lFehler").textContent
  }));
}

(async () => {
  const browser = await chromium.launch();

  /* ══ 1 · Der Weg zur Sperre ══════════════════════════════════════ */
  console.log("══ Drei Fehlversuche sperren ══");
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const seite = await ctx.newPage();
  const kons = [];
  seite.on("pageerror", e => kons.push(String(e).slice(0, 150)));
  seite.on("console", m => { if(m.type() === "error" && !/net::ERR|Failed to load resource/i.test(m.text())) kons.push(m.text().slice(0, 150)); });

  await seite.addInitScript(ersatzSupabase());
  await tor(seite);

  const v1 = await versuch(seite, "falsch1");
  pruef(v1.fehler && !v1.gesperrt, "1. Fehlversuch: Fehlermeldung, noch keine Sperre");
  pruef(/2 Versuche/.test(v1.fehlerText), "und die Restzahl steht dabei", v1.fehlerText);

  const v2 = await versuch(seite, "falsch2");
  pruef(v2.fehler && !v2.gesperrt, "2. Fehlversuch: weiterhin nur eine Fehlermeldung");
  pruef(/ein Versuch/.test(v2.fehlerText), "und warnt vor dem letzten Versuch", v2.fehlerText);

  const v3 = await versuch(seite, "falsch3");
  pruef(v3.gesperrt && !v3.fehler, "3. Fehlversuch: jetzt gesperrt");

  /* Der eigentliche Zweck der Sperre: Ein RICHTIGES Passwort bleibt
     draußen, solange gesperrt=true — sonst wäre die Sperre nur ein
     Hindernis für den Angreifer, der noch rät, nicht für den, der
     durch Zufall oder Beobachtung ans richtige Passwort kam. */
  const v4 = await versuch(seite, "richtig123");
  pruef(v4.gesperrt, "4. Versuch mit dem RICHTIGEN Passwort bleibt draußen");

  const signIn = await seite.evaluate(() => window.__aufrufe.signInWithPassword.length);
  pruef(signIn === 0, "der echte Supabase-Login wurde dabei kein einziges Mal versucht",
    signIn + " Aufruf(e)");

  /* ══ 2 · Die Freischaltung ═══════════════════════════════════════ */
  console.log("\n══ Freischaltung über die E-Mail ══");
  const entsperrKlick = await seite.evaluate(async () => {
    document.getElementById("lGesperrtSenden").click();
    await new Promise(r => setTimeout(r, 250));
    return { aufgerufen: window.__aufrufe.resetPasswordForEmail.slice() };
  });
  pruef(entsperrKlick.aufgerufen.length === 1 && entsperrKlick.aufgerufen[0] === "wirt@choco.de",
    "der Entsperr-Knopf schickt den Reset-Link an die eingetragene Adresse",
    JSON.stringify(entsperrKlick.aufgerufen));

  await ctx.close();

  /* ══ 3 · "Passwort vergessen?" auch ohne Sperre ══════════════════ */
  console.log("\n══ „Passwort vergessen?“ auch ohne Sperre ══");
  const ctx2 = await browser.newContext({ viewport:{ width:390, height:844 } });
  const seite2 = await ctx2.newPage();
  await seite2.addInitScript(ersatzSupabase());
  await tor(seite2);
  const vergessen = await seite2.evaluate(async () => {
    document.getElementById("lMail").value = "wirt@choco.de";
    document.getElementById("lVergessen").click();
    await new Promise(r => setTimeout(r, 250));
    return {
      standSichtbar: !document.getElementById("lVergessenStand").hidden,
      aufgerufen: window.__aufrufe.resetPasswordForEmail.slice()
    };
  });
  pruef(vergessen.standSichtbar && vergessen.aufgerufen.length === 1,
    "„Passwort vergessen?“ funktioniert unabhängig von einer Sperre");
  await ctx2.close();

  /* ══ 4 · Fehlt die Migration, sperrt nichts ═══════════════════════
     CLAUDE.md §7: Ein fehlender Baustein darf niemals jeden aussperren,
     der eigentlich rein dürfte. Antwortet admin_anmelden() gar nicht
     (Funktion existiert noch nicht), muss die Seite auf den alten,
     ungeschützten Weg zurückfallen — nicht auf "niemand kommt rein". */
  console.log("\n══ Migration fehlt noch: niemand wird ausgesperrt ══");
  const ctx3 = await browser.newContext({ viewport:{ width:390, height:844 } });
  const seite3 = await ctx3.newPage();
  await seite3.addInitScript(() => {
    window.__aufrufe = { signInWithPassword: [] };
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data:{ session:null } }),
          signInWithPassword: async ({email, password}) => {
            window.__aufrufe.signInWithPassword.push({email, password});
            return { error: password === "richtig123" ? null : { message:"Invalid login credentials" } };
          },
          resetPasswordForEmail: async () => ({ error:null }),
          signOut: async () => ({}),
          onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } })
        },
        rpc: async (name) => ({ data:null, error:{ message:"Could not find the function public." + name } }),
        from: () => ({ select: () => ({ eq: () => Promise.resolve({data:[], error:null}) }) }),
        functions: { invoke: async () => ({ data:null, error:null }) }
      })
    };
  });
  await tor(seite3);
  await seite3.fill("#lMail", "wirt@choco.de");
  await seite3.fill("#lPass", "richtig123");
  await seite3.click("#lKnopf");
  await seite3.waitForTimeout(400);
  const ruecksprung = await seite3.evaluate(() => ({
    signInAufrufe: window.__aufrufe.signInWithPassword.length,
    torNochOffen: !document.getElementById("tor").hidden
  }));
  pruef(ruecksprung.signInAufrufe === 1 && !ruecksprung.torNochOffen,
    "ohne die Migration läuft die Anmeldung wie zuvor, ungeschützt aber funktionsfähig",
    JSON.stringify(ruecksprung));
  await ctx3.close();

  pruef(kons.length === 0, "kein Fehler in der Konsole", kons[0] || "still");

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
