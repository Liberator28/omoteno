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

/* Die Regeln aus _redirects, so weit ein Prüfserver sie braucht. */
const REGELN = fs.readFileSync(path.join(WURZEL,"_redirects"),"utf8")
  .split("\n").map(z => z.trim())
  .filter(z => z && !z.startsWith("#"))
  .map(z => z.split(/\s+/));

const server = http.createServer((a,b) => {
  const host = (a.headers.host || "").split(":")[0];
  let p = decodeURIComponent(a.url.split("?")[0]);

  /* ── Zuerst die Adressregeln ──────────────────────────────────
     Bis zum 04.09. stand hier „Domainregeln hier nicht" und die
     Schleife uebersprang jede Regel mit absoluter URL. Genau
     deshalb konnte keine Pruefung finden, dass
     choco-lamour.omoteno.de (mit Bindestrich) auf KEINE Regel
     passte — Netlify lieferte dem Gast die Landingpage aus. Das
     ist CLAUDE.md 8.2: Eine Pruefung, die die entscheidende Zeile
     gar nicht ansieht, ist fuer diesen Fall keine.

     Netlify verkettet Regeln NICHT. Greift eine Adressregel, ist
     der Weg entschieden — deshalb der Schalter. */
  let getroffen = false;
  for(const [von, nach, code] of REGELN){
    if(!von.startsWith("http")) continue;
    let u; try { u = new URL(von.replace("/*","")); } catch(e){ continue; }
    if(u.hostname !== host) continue;
    const rest = p.replace(/^\//, "");
    if(nach.startsWith("http")){
      b.writeHead(parseInt(code,10) || 301, { Location: nach.replace(":splat", rest) });
      return b.end();
    }
    p = nach.replace(":splat", rest); getroffen = true; break;
  }

  for(const [von, nach, code] of getroffen ? [] : REGELN){
    if(von.startsWith("http")) continue;             /* oben schon behandelt */
    if(von.endsWith("/*")){
      const kopf = von.slice(0,-2);
      if(p.startsWith(kopf)){ p = nach.replace(":splat", p.slice(kopf.length+1)); break; }
    } else if(von.includes(":")){
      const teile = von.split("/"), jetzt = p.split("/");
      if(teile.length === jetzt.length){
        let passt = true, werte = {};
        teile.forEach((t,i) => { if(t.startsWith(":")) werte[t.slice(1)] = jetzt[i];
                                 else if(t !== jetzt[i]) passt = false; });
        if(passt){ p = nach.replace(/:(\w+)/g, (_,k) => werte[k]); break; }
      }
    } else if(von === p){ p = nach; break; }
  }
  if(p === "/" || p.endsWith("/")) p += "index.html";
  const datei = path.join(WURZEL, p);
  if(!datei.startsWith(WURZEL) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()){
    b.writeHead(404); return b.end("404");
  }
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
  const adressen   = REGELN.filter(([von]) => von.startsWith("http"));
  pruef(adressen.length > 0, "es gibt ueberhaupt Adressregeln",
    adressen.length + " Zeile(n) in _redirects");

  for(const [von, nach, code] of adressen){
    let host; try { host = new URL(von.replace("/*","")).hostname; } catch(e){ continue; }
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
    .filter(([,nach]) => !nach.startsWith("http"))
    .map(([,nach]) => (nach.match(/^\/h\/([^/]+)/) || [,null])[1])
    .filter(Boolean));
  for(const slug of hubs){
    pruef(bedient.has(slug), ("/h/" + slug + "/").padEnd(26) + " hat eine eigene Adresse",
      bedient.has(slug) ? "ja" : "KEINE Zeile in _redirects zeigt hierher");
  }

  /* Und zeigt jede Umleitung auf eine Adresse, die es wirklich gibt?
     Ohne das koennte jemand die Zielzeile loeschen und die Umleitung
     schickte den Gast auf die Landingpage — unbemerkt. */
  for(const [von, nach] of adressen){
    if(!nach.startsWith("http")) continue;
    let zielHost; try { zielHost = new URL(nach.replace(":splat","")).hostname; } catch(e){ continue; }
    const hatRegel = adressen.some(([v, n]) => {
      try { return new URL(v.replace("/*","")).hostname === zielHost && !n.startsWith("http"); }
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
