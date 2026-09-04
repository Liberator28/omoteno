/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Meldung über eine neue Bestellung

     node erzeuger/bauen.js
     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-push.js

   admin.html registriert einen Service Worker beim Namen:

       navigator.serviceWorker.register("sw.js")

   Bis zum 30.08. gab es diese Datei nicht — weder im Verzeichnis noch
   im ausgelieferten Ordner. Die Registrierung lief auf ein 404,
   pushEinrichten() gab {ok:false} zurück, und das Personal bekam nie
   eine Meldung über eine neue Bestellung. Alles andere war fertig:
   VAPID-Schlüssel, die Tabelle push_geraete und die Edge-Funktion
   „melden", die längst sendet.

   Ein echter Webpush lässt sich kopflos nicht auslösen. Deshalb wird
   die push-Behandlung mit GENAU der Nachricht aufgerufen, die
   „melden" schickt: { id, quelle, titel, text, url }. Ändert sich
   das Format auf einer der beiden Seiten, fällt es hier auf.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
/* Der ausgelieferte Ordner liegt in der Wurzel, nicht neben
   diesem Skript. */
const WURZEL = path.join(__dirname, "..", "oeffentlich");
if(!fs.existsSync(path.join(WURZEL, "sw.js"))){
  console.error("oeffentlich/sw.js fehlt. Erst „node erzeuger/bauen.js\" laufen lassen.");
  process.exit(1);
}
let fehler = 0;
const ok = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };

const typ = {".html":"text/html",".js":"text/javascript",".txt":"text/plain"};
const server = http.createServer((a,b) => {
  let p = a.url.split("?")[0];
  if(p === "/") p = "/index.html";
  const d = path.join(WURZEL, p);
  if(!d.startsWith(WURZEL) || !fs.existsSync(d) || fs.statSync(d).isDirectory()){
    b.writeHead(404); return b.end("404");
  }
  b.writeHead(200, {"Content-Type": typ[path.extname(d)] || "application/octet-stream"});
  b.end(fs.readFileSync(d));
});

server.listen(8901, async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ serviceWorkers:"allow" });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push(String(e).slice(0,140)));

  /* 1 · Wird sw.js ueberhaupt ausgeliefert? */
  const a = await p.goto("http://localhost:8901/sw.js");
  ok(a.status() === 200, "sw.js wird ausgeliefert", "HTTP " + a.status());
  const quelle = await a.text();
  ok(/addEventListener\("push"/.test(quelle), "und behandelt das push-Ereignis");
  ok(/notificationclick/.test(quelle), "und das Antippen der Meldung");

  /* 2 · Laesst er sich registrieren? Genau wie admin.html es tut. */
  await p.goto("http://localhost:8901/admin.html");
  const reg = await p.evaluate(async () => {
    try{
      const r = await navigator.serviceWorker.register("sw.js");
      await navigator.serviceWorker.ready;
      return { ok:true, umfang:r.scope, aktiv: !!r.active };
    }catch(e){ return { ok:false, grund: e.message }; }
  });
  ok(reg.ok, "das Board kann ihn registrieren", reg.ok ? reg.umfang : reg.grund);
  ok(reg.ok && /:8901\/$/.test(reg.umfang || ""),
    "sein Geltungsbereich ist die ganze Adresse, nicht ein Unterordner", reg.umfang);

  /* 3 · Meldet er sich mit dem, was "melden" schickt? */
  const sw = ctx.serviceWorkers()[0];
  if(!sw){ ok(false, "der Service Worker laeuft"); }
  else {
    ok(true, "der Service Worker laeuft");
    const gemeldet = await sw.evaluate(async () => {
      /* Die Nachricht der Edge-Funktion, Wort fuer Wort nachgebaut */
      const nachricht = { id:"abc", quelle:"bestellung",
        titel:"Neue Bestellung · Tisch 7", text:"2× Dubai Crêpe\n41,20 €", url:"/" };
      const gesehen = [];
      const echt = self.registration.showNotification.bind(self.registration);
      self.registration.showNotification = (t, o) => { gesehen.push({t, o}); return Promise.resolve(); };
      const e = new Event("push");
      e.data = { json: () => nachricht, text: () => JSON.stringify(nachricht) };
      e.waitUntil = pr => pr;
      self.dispatchEvent(e);
      await new Promise(r => setTimeout(r, 60));
      self.registration.showNotification = echt;
      return gesehen;
    });
    ok(gemeldet.length === 1, "eine push-Nachricht ergibt genau EINE Meldung",
      gemeldet.length + " Meldung(en)");
    if(gemeldet.length){
      ok(gemeldet[0].t === "Neue Bestellung · Tisch 7",
        "mit dem Titel des Absenders", gemeldet[0].t);
      ok(/Dubai/.test(gemeldet[0].o.body || ""),
        "und den Positionen im Text", (gemeldet[0].o.body||"").split("\n")[0]);
    }
  }

  const echt = kons.filter(z => !/net::ERR|Failed to load/i.test(z));
  ok(echt.length === 0, "kein Fehler in der Konsole", echt[0] || "still");
  await br.close(); server.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
});
