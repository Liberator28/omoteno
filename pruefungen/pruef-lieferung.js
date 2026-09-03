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
  let p = decodeURIComponent(a.url.split("?")[0]);
  for(const [von, nach, code] of REGELN){
    if(von.startsWith("http")) continue;             /* Domainregeln hier nicht */
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
