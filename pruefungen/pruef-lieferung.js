/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Der ausgelieferte Ordner

     node erzeuger/bauen.js
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-lieferung.js

   Sie bedient oeffentlich/ wie einen Webserver, folgt dabei den
   Regeln aus _redirects und fragt drei Dinge:

   1 · Kommt unter jeder Adresse die RICHTIGE Seite an? Nicht nur
       „200", sondern: Steht der Name des richtigen Hauses im Titel?
   2 · Trägt der ZWEITE Kunde seinen eigenen Namen? Am 30.08. lieferte
       /h/blend/ „Choco L'AMouR · Estd. 2023" aus — das Siegel stand
       fest im Gerüst, nur der Name daneben kam aus dem Markenblatt.
       Aufgefallen ist es erst hier, im ausgelieferten Ordner; keine
       Einzelprüfung hatte es gesehen.
   3 · Liegt etwas draußen, das nicht draußen liegen soll? Markenblätter
       der Kunden, Prüfskripte, CLAUDE.md, das Gerüst.
   4 · Landet jede KUNDENADRESSE auf ihrem eigenen Hub — und nicht
       auf der Landingpage? Am 04.09. lieferte choco-lamour.omoteno.de
       die Omoteno-Startseite aus, weil _redirects nur die Schreibweise
       ohne Bindestrich kannte. Diese Prüfung sah davon nichts: Sie
       übersprang Regeln mit absoluter URL ausdrücklich.

   Kein Netz nach außen. Gefahren wird gegen einen eigenen Server auf
   Port 8899, damit die Prüfung ohne Netlify und ohne Internet läuft.
   ═══════════════════════════════════════════════════════════════════ */
const http = require("http");

const fs = require("fs");
const path = require("path");
/* Der ausgelieferte Ordner liegt in der Wurzel, nicht neben
   diesem Skript. */
const WURZEL = path.join(__dirname, "..", "oeffentlich");
if(!fs.existsSync(WURZEL)){
  console.error("oeffentlich/ fehlt. Erst „node erzeuger/bauen.js\" laufen lassen.");
  process.exit(1);
}
const typ = { ".html":"text/html", ".txt":"text/plain", ".xml":"application/xml" };

/* Die Regeln aus _redirects, so weit ein Prüfserver sie braucht.
   Das „!" am Statuscode wird ausgelesen — es entscheidet alles. */
const REGELN = fs.readFileSync(path.join(WURZEL,"_redirects"),"utf8")
  .split("\n").map(z => z.trim())
  .filter(z => z && !z.startsWith("#"))
  .map(z => {
    const [von, nach, code] = z.split(/\s+/);
    return { von, nach, code: (code||"200").replace("!",""),
             zwang: (code||"").endsWith("!") };
  });

/* Liegt der Weg als Datei im Ordner? Genau diese Frage entscheidet bei
   Netlify, ob eine nicht erzwungene Umleitung überhaupt drankommt. */
const alsDatei = w => {
  let d = w;
  if(d === "/" || d.endsWith("/")) d += "index.html";
  const voll = path.join(WURZEL, d);
  return voll.startsWith(WURZEL) && fs.existsSync(voll) && !fs.statSync(voll).isDirectory()
       ? voll : null;
};

/* Eine Regel auf Host und Pfad anwenden. Gibt den neuen Pfad zurück,
   eine Weiterleitung, oder null. */
function anwenden(r, host, p){
  if(r.von.startsWith("http")){
    let u; try { u = new URL(r.von.replace(/\*$/,"")); } catch(e){ return null; }
    if(u.hostname !== host) return null;
    /* Der Pfadanteil der Regel: „/admin*" heißt Präfix, „/*" heißt alles. */
    const muster = u.pathname.replace(/\*$/,"");
    if(muster && muster !== "/" && !p.startsWith(muster)) return null;
    const rest = p.slice(muster === "/" ? 1 : muster.length).replace(/^\//,"");
    const ziel = r.nach.replace(":splat", rest);
    return r.nach.startsWith("http")
      ? { weiter: ziel, code: Number(r.code) || 301 }
      : { pfad: ziel };
  }
  /* Pfad-Regeln mit 301/302 sind bei Netlify eine WEITERLEITUNG, keine
     Umschreibung. Bis zum 11.10. schrieb dieser Server sie still um
     (200) — großzügiger als Netlify; aufgefallen an /demo. */
  const pfadZiel = ziel => /^30[1278]$/.test(r.code) ? { weiter: ziel, code: Number(r.code) } : { pfad: ziel };
  if(r.von.endsWith("/*")){
    const kopf = r.von.slice(0,-2);
    if(!p.startsWith(kopf)) return null;
    return { pfad: r.nach.replace(":splat", p.slice(kopf.length+1)) };
  }
  if(r.von.includes(":")){
    const teile = r.von.split("/"), jetzt = p.split("/");
    if(teile.length !== jetzt.length) return null;
    let passt = true; const werte = {};
    teile.forEach((t,i) => { if(t.startsWith(":")) werte[t.slice(1)] = jetzt[i];
                             else if(t !== jetzt[i]) passt = false; });
    return passt ? pfadZiel(r.nach.replace(/:(\w+)/g, (_,k) => werte[k])) : null;
  }
  return r.von === p ? pfadZiel(r.nach) : null;
}

/* ── Netlifys Reihenfolge, und sie ist der ganze Punkt ─────────────
   1. erzwungene Regeln („!")   — gewinnen immer
   2. eine vorhandene DATEI
   3. alle übrigen Regeln

   Der erste Entwurf dieses Servers wendete Regeln VOR den Dateien an
   und bildete Netlify damit falsch ab. Er hätte gemeldet, dass
   choco-lamour.omoteno.de/konto.html den Hub liefert — in Wahrheit
   lieferte es Omotenos Konto-Seite, weil die Datei gewinnt. Eine
   Prüfung, die großzügiger ist als die Wirklichkeit, ist schlimmer
   als keine. */
const server = http.createServer((a,b) => {
  const host = (a.headers.host || "").split(":")[0];
  let p = decodeURIComponent(a.url.split("?")[0]);

  const runde = (nurZwang) => {
    for(const r of REGELN){
      if(nurZwang && !r.zwang) continue;
      if(!nurZwang && r.zwang) continue;
      const erg = anwenden(r, host, p);
      if(!erg) continue;
      if(erg.weiter){ b.writeHead(erg.code, { Location: erg.weiter }); b.end(); return true; }
      p = erg.pfad; return true;
    }
    return false;
  };

  if(!runde(true)){          /* 1 · erzwungen */
    if(!alsDatei(p)) runde(false);   /* 2 · Datei  →  3 · der Rest */
  }
  if(b.writableEnded) return;

  const datei = alsDatei(p);
  if(!datei){ b.writeHead(404); return b.end("404"); }
  b.writeHead(200, {"Content-Type": typ[path.extname(datei)] || "application/octet-stream"});
  b.end(fs.readFileSync(datei));
});

server.listen(8899, async () => {
  const { chromium } = require("playwright");
  const br = await chromium.launch();
  let fehler = 0;
  const pruef = (gut,t,z) => { console.log((gut?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!gut) fehler++; };
  const ctx = await br.newContext({ viewport:{width:1280,height:900} });
  const p = await ctx.newPage();
  const konsole = [];
  p.on("pageerror", e => konsole.push(String(e).slice(0,140)));

  /* Nur der eigene Server ist erreichbar — kein fremdes Netz. */
  await p.route("**/*", r => r.request().url().startsWith("http://localhost:8899")
    ? r.continue() : r.abort());

  const wege = [
    /* Verglichen wird gegen den TITEL, nicht gegen innerText:
       text-transform macht aus „Preise" ein „PREISE" und aus dem
       Vergleich ein Ratespiel. */
    ["/",               "Omoteno"],
    ["/admin",          "Omoteno"],
    ["/admin.html",     "Omoteno"],
    ["/kueche",         "Küche"],
    ["/konto",          "Konto"],
    ["/einkauf",        "Einkauf"],
    ["/start",          "Omoteno"],
    ["/studio",         "Studio"],
    /* Pflichtangaben. Bis zum 30.08. fehlten beide Dateien und die
       Fußzeile verlinkte sie trotzdem — sechsmal ins Leere. */
    ["/impressum",      "Impressum"],
    ["/impressum.html", "Impressum"],
    ["/datenschutz",    "Datenschutz"],
    ["/h/chocolamour/", "Choco L'AMouR"],
    ["/h/chocolamour",  "Choco L'AMouR"],
    /* Der zweite Kunde MUSS seinen eigenen Namen tragen. */
    ["/h/blend/",       "Blend"],
    ["/robots.txt",     ""]
  ];
  for(const [weg, erwartet] of wege){
    const a = await p.goto("http://localhost:8899" + weg, { waitUntil:"domcontentloaded" });
    await p.waitForTimeout(250);
    const titel = await p.title();
    const gut = a.status() === 200 && (!erwartet || titel.indexOf(erwartet) >= 0);
    pruef(gut, weg.padEnd(20) + " liefert aus",
      a.status() + " · " + (titel || "(ohne Titel)").slice(0,44));
  }
  /* ── Die Kundenadressen ────────────────────────────────────────
     Ohne Browser, mit ausdruecklich gesetztem Host-Kopf: Fuer eine
     Umleitung bringt ein Browser nichts, und so misst die Pruefung
     genau die Schicht, um die es geht.

     Erwartet wird NICHT ein fester Name — die stuenden hier sonst
     doppelt und liefen auseinander. Verglichen wird gegen die
     Seite, die derselbe Hub unter seinem Pfad ausliefert: Die
     Adresse muss dasselbe zeigen wie /h/<slug>/, und auf keinen
     Fall die Landingpage. */
  const ueberHost = (host, weg) => new Promise(r => {
    http.request({ host:"127.0.0.1", port:8899, path:weg, headers:{ Host:host } }, res => {
      let roh = ""; res.on("data", c => roh += c); res.on("end", () => r({
        code : res.statusCode,
        ziel : res.headers.location || "",
        titel: (roh.match(/<title>([^<]*)<\/title>/) || [,""])[1].trim()
      }));
    }).on("error", e => r({ code:0, ziel:"", titel:"FEHLER " + e.message })).end();
  });

  console.log("\n── Die Kundenadressen ──");
  const startseite = (await ueberHost("localhost", "/")).titel;
  /* Die Adressregeln als {von, nach, code, zwang} — seit der Server
     Netlifys Reihenfolge abbildet, sind Regeln Objekte, keine Felder. */
  const adressen   = REGELN.filter(r => r.von.startsWith("http"));
  pruef(adressen.length > 0, "es gibt ueberhaupt Adressregeln",
    adressen.length + " Zeile(n) in _redirects");

  for(const {von, nach, code} of adressen){
    /* Nur die Regeln, die den ganzen Host abfangen. Die drei
       Betriebswege („/admin*") werden weiter unten eigens geprueft. */
    let u; try { u = new URL(von.replace(/\*$/,"")); } catch(e){ continue; }
    if(u.pathname !== "/") continue;
    const host = u.hostname;
    const a = await ueberHost(host, "/");

    if(nach.startsWith("http")){
      const soll = nach.replace(":splat","");
      pruef(a.code === 301 && a.ziel.startsWith(soll),
        host.padEnd(26) + " leitet auf die echte Adresse",
        a.code + " → " + (a.ziel || "(ohne Ziel)"));
      continue;
    }

    /* Dieselbe Seite wie unter ihrem Pfad — und nicht die Startseite. */
    const direkt = await ueberHost("localhost", nach.replace(":splat",""));
    pruef(a.code === 200 && a.titel !== "" && a.titel === direkt.titel,
      host.padEnd(26) + " zeigt seinen eigenen Hub",
      a.code + " · „" + (a.titel || "(ohne Titel)").slice(0,38) + "“");
    pruef(a.titel !== startseite,
      host.padEnd(26) + " zeigt NICHT die Landingpage",
      a.titel === startseite ? "genau der Fehler vom 04.09." : "richtig");
  }

  /* ── Beschattung: liefert eine Kundenadresse fremde Seiten? ───
     Netlify bedient zuerst eine vorhandene DATEI. Der veroeffentlichte
     Ordner ist flach — admin.html, konto.html, kueche.html liegen
     darin. Ohne „!" an der Hub-Regel gewinnt also die Datei, und ein
     Gast an Chocos Tisch erreicht unter Chocos Adresse Omotenos
     Anmeldung. Genau das war auf dem Bildschirmfoto vom 04.09. */
  console.log("\n── Fremde Seiten unter Kundenadressen ──");
  /* Nur echte KUNDEN-Hubs — deren Regel zeigt nach /h/<slug>/.
     admin.omoteno.de zeigt bewusst nach /admin.html: das ist die
     eigene Adresse des Boards, kein Kunde, und soll dort genau
     Omotenos Seite zeigen. Ohne dieses Sieb faengt jede neue
     Nicht-Kunden-Adresse mit „/*"-Regel hier einen Fehlalarm. */
  const hubHosts = [...new Set(adressen
    .filter(r => !r.nach.startsWith("http") && /^\/h\//.test(r.nach))
    .map(r => { try { return new URL(r.von.replace(/\*$/,"")).hostname; }
                catch(e){ return null; } })
    .filter(Boolean))];
  for(const host of hubHosts){
    for(const weg of ["/konto.html", "/admin.html", "/kueche.html", "/index.html"]){
      const a = await ueberHost(host, weg);
      const fremd = a.code === 200 && /Omoteno|Küche/i.test(a.titel) &&
                    !/Choco|Blend/i.test(a.titel);
      pruef(!fremd, (host + weg).padEnd(44) + " zeigt NICHT Omotenos Seite",
        a.code + (a.ziel ? " → " + a.ziel : " · „" + (a.titel||"(ohne Titel)").slice(0,26) + "“"));
    }
  }

  /* ── Der Weg des Wirts an sein eigenes Board ──────────────────── */
  console.log("\n── Vom Hub ins eigene Board ──");
  for(const [host, weg, ziel] of [
        ["choco-lamour.omoteno.de", "/admin",  "https://omoteno.de/admin"],
        ["choco-lamour.omoteno.de", "/kueche", "https://omoteno.de/kueche"],
        ["choco-lamour.omoteno.de", "/konto",  "https://omoteno.de/konto"],
        ["blend.omoteno.de",        "/admin",  "https://omoteno.de/admin"]]){
    const a = await ueberHost(host, weg);
    pruef(a.code === 301 && a.ziel === ziel,
      (host + weg).padEnd(44) + " fuehrt nach omoteno.de",
      a.code + " → " + (a.ziel || "(ohne Ziel)"));
  }

  /* ── Eine Seite, eine Adresse ─────────────────────────────────── */
  console.log("\n── www ──");
  for(const weg of ["/", "/konto", "/konto.html"]){
    const a = await ueberHost("www.omoteno.de", weg);
    pruef(a.code === 301 && a.ziel.startsWith("https://omoteno.de/"),
      ("www.omoteno.de" + weg).padEnd(44) + " springt auf omoteno.de",
      a.code + " → " + (a.ziel || "(ohne Ziel)"));
  }

  /* ── Ist JEDER Hub unter einer Adresse erreichbar? ────────────
     Der erste Entwurf dieser Pruefung lief nur ueber die Regeln,
     die in _redirects DASTEHEN — und war deshalb blind fuer den
     Fehler, wegen dem es sie gibt: eine FEHLENDE Regel. Beim
     Gegenbeweis (Zeile testweise entfernt) meldete sie „alles
     sauber". Eine Pruefung, die den eigenen Anlassfall nicht
     reproduziert, prueft nichts.

     Deshalb kommt die Wahrheit jetzt von der anderen Seite: aus
     den erzeugten Hubs. Jeder Ordner unter /h/ ist ein Kunde, und
     jeder Kunde braucht mindestens eine Adresse, die auf ihn
     zeigt.

     Was diese Pruefung NICHT kann: wissen, ob die Adresse auch im
     DNS und bei Netlify eingetragen ist. Das steht nirgends im
     Verzeichnis. Sie faengt „Zeile vergessen" und „Zeile zeigt
     ins Leere" — nicht „Zeile heisst anders als die Domain". */
  const hubs = fs.existsSync(path.join(WURZEL,"h"))
    ? fs.readdirSync(path.join(WURZEL,"h")).filter(n =>
        fs.existsSync(path.join(WURZEL,"h",n,"index.html"))) : [];
  const bedient = new Set(adressen
    .filter(r => !r.nach.startsWith("http"))
    .map(r => (r.nach.match(/^\/h\/([^/]+)/) || [,null])[1])
    .filter(Boolean));
  /* Das Vorführhaus der Landingpage (Markenblatt mit „demo“) hat
     bewusst KEINE eigene Domain — seine Adresse ist omoteno.de/demo.
     Dafür muss genau diese Pfad-Regel stehen und wirklich dorthin
     führen (gefragt wird der nachgestellte Netlify-Weg, nicht die Zeile). */
  const vorfuehr = slug => { try{ return !!JSON.parse(fs.readFileSync(path.join(__dirname, "..", "markenblaetter", slug + ".json"), "utf8")).demo; }catch(e){ return false; } };
  for(const slug of hubs){
    if(vorfuehr(slug)){
      const a = await ueberHost("omoteno.de", "/demo");
      pruef(a.code === 301 && a.ziel.replace(/^https?:\/\/[^/]+/, "") === "/h/" + slug + "/",
        ("/h/" + slug + "/").padEnd(26) + " (Vorführhaus) unter omoteno.de/demo erreichbar", a.code + " → " + (a.ziel || "(ohne Ziel)"));
      continue;
    }
    pruef(bedient.has(slug), ("/h/" + slug + "/").padEnd(26) + " hat eine eigene Adresse",
      bedient.has(slug) ? "ja" : "KEINE Zeile in _redirects zeigt hierher");
  }

  /* Und zeigt jede Umleitung auf eine Adresse, die es wirklich gibt?
     Ohne das koennte jemand die Zielzeile loeschen und die Umleitung
     schickte den Gast auf die Landingpage — unbemerkt. */
  for(const {von, nach} of adressen){
    if(!nach.startsWith("http")) continue;
    /* Nur Umleitungen zwischen KUNDENadressen. Die Betriebswege und
       die www-Regel zeigen absichtlich auf omoteno.de, das keinen Hub
       hat — sie hier zu fordern waere ein Fehlalarm. */
    if(/^https:\/\/omoteno\.de/.test(nach)) continue;
    let zielHost; try { zielHost = new URL(nach.replace(":splat","")).hostname; } catch(e){ continue; }
    const hatRegel = adressen.some(r => {
      try { return new URL(r.von.replace(/\*$/,"")).hostname === zielHost && !r.nach.startsWith("http"); }
      catch(e){ return false; }
    });
    pruef(hatRegel, zielHost.padEnd(26) + " ist als Ziel wirklich bedient",
      hatRegel ? "ja" : "die Umleitung zeigt auf eine Adresse ohne Regel");
  }

  /* Ein Weg, den es NICHT geben darf.
     .mcp.json steht hier, obwohl bauen.js eine feste Positivliste
     kopiert und sie deshalb ohnehin nie mitnimmt. Genau das macht die
     Zeile billig — sie kostet nichts und fängt den Tag ab, an dem
     jemand aus der Positivliste ein „alles kopieren" macht. Die Datei
     trägt zwar nur den Platzhalter ${SUPABASE_ACCESS_TOKEN} und kein
     Geheimnis, verrät draußen aber Projektkennung und Bauart. */
  for(const weg of ["/CLAUDE.md","/chocolamour.json","/erzeuge-hub.js","/pruef-web.js","/hub.vorlage.html","/.mcp.json"]){
    const a = await p.goto("http://localhost:8899" + weg);
    pruef(a.status() === 404, weg.padEnd(20) + " liegt NICHT draußen", a.status());
  }
    /* Die Supabase-Bibliothek kommt aus fremdem Netz und ist hier
     gesperrt — dass Board und Konto das MELDEN, ist genau richtig.
     Alles andere wäre ein Fehler. */
  const echt = konsole.filter(z => !/Supabase|net::ERR|Failed to (load|fetch)/i.test(z));
  pruef(echt.length === 0, "kein unerwarteter Fehler in der Konsole", echt[0] || "still");
  await br.close(); server.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
});
