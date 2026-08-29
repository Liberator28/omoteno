const fs = require("fs");
const path = require("path");
/* Die Datei hieß einmal omoteno-marken-studio.html. Nach der
   Umbenennung fiel diese Prüfung mit ENOENT um und wurde damit
   monatelang nicht mehr gelesen — eine Prüfung, die nicht läuft, ist
   keine. Deshalb sucht sie ihre Datei jetzt neben sich. */
const KANDIDATEN = ["marken-studio.html", "omoteno-marken-studio.html", "markenstudio.html"];
const datei = KANDIDATEN.map(n => path.join(__dirname, n)).find(fs.existsSync);
if(!datei){
  console.error("Kein Marken-Studio gefunden. Gesucht: " + KANDIDATEN.join(", "));
  process.exit(1);
}
const s = fs.readFileSync(datei, "utf8");
const js = s.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

// Sehr schlanker Ersatz fuer Browserdinge
const gesetzt = {};
const el = () => ({ style:{setProperty(k,v){gesetzt[k]=v;}}, innerHTML:"", value:"",
  textContent:"", checked:false, hidden:false, dataset:{}, children:[],
  querySelector:()=>el(), querySelectorAll:()=>[], closest:()=>null,
  setAttribute(){}, getAttribute(){}, hasAttribute(){}, removeAttribute(){},
  addEventListener(){}, getBoundingClientRect:()=>({top:0,height:40}),
  classList:{add(){},remove(){},toggle(){},contains:()=>false}, scrollTo(){}, focus(){} });

global.document = { getElementById:()=>el(), querySelector:()=>el(),
  querySelectorAll:()=>[], addEventListener(){}, documentElement:el(), body:el(),
  createElement:()=>el() };
global.window = { addEventListener(){}, innerHeight:800, scrollTo(){},
  matchMedia:()=>({matches:false, addEventListener(){}}), requestAnimationFrame:f=>f() };
global.location = { origin:"https://omoteno.de", pathname:"/studio", hash:"" };
global.navigator = {};
global.requestAnimationFrame = f => f();
global.setTimeout = () => 0;
global.clearTimeout = () => 0;
global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;
global.btoa = t => Buffer.from(t, "binary").toString("base64");
global.atob = t => Buffer.from(t, "base64").toString("binary");

eval(js + "\nmodule.exports = { VORLAGEN, entwurfsAdresse, entwurfLesen, vorlageLaden, " +
     "schriftAuf, kontrast, BEREICH_FOLGE, holM:()=>M, setzM:x=>{M=x}, holReihe:()=>M.reihe };");
const A = module.exports;

console.log("── Entwurf verschicken ──");
let fehler = 0;
Object.keys(A.VORLAGEN).forEach(v => {
  A.vorlageLaden(v);
  /* Die Figur wird absichtlich VERSTELLT, bevor der Link entsteht:
     Bliebe sie auf der Vorgabe, könnte der Vergleich hinterher auch
     dann „gleich" melden, wenn der Link sie gar nicht mitnimmt. */
  A.holM().avatar = { figur:"erdbeere", art:"witzig", name:"Fräulein Fraise" };
  const vorher = JSON.parse(JSON.stringify(A.holM()));
  const adresse = A.entwurfsAdresse();
  // Anderen Ausgangszustand herstellen, dann aus der Adresse lesen
  A.vorlageLaden(v === "loft" ? "linde" : "loft");
  global.location.hash = adresse.slice(adresse.indexOf("#"));
  const ok = A.entwurfLesen();
  const nachher = A.holM();

  const gleich = ["grund","flaeche","band","tinte","linie","akzent","akzent2","gut"]
    .every(k => nachher.farben[k] === vorher.farben[k]);
  const namegleich = nachher.betrieb.name === vorher.betrieb.name;
  const reihegleich = JSON.stringify(nachher.reihe) === JSON.stringify(vorher.reihe);
  const anGleich = A.BEREICH_FOLGE.every(k => !!nachher.bereiche[k] === !!vorher.bereiche[k]);
  const figurGleich = nachher.avatar && vorher.avatar &&
    ["figur","art","name"].every(k => nachher.avatar[k] === vorher.avatar[k]);

  if(!(ok && gleich && namegleich && reihegleich && anGleich && figurGleich)) fehler++;
  console.log("  " + v.padEnd(11),
    "gelesen:", ok ? "ja " : "NEIN",
    "| Farben:", gleich ? "gleich" : "ABWEICHUNG",
    "| Name:", namegleich ? "gleich" : "ABWEICHUNG",
    "| Reihenfolge:", reihegleich ? "gleich" : "ABWEICHUNG",
    "| Schalter:", anGleich ? "gleich" : "ABWEICHUNG",
    "| Figur:", figurGleich ? "gleich" : "ABWEICHUNG",
    "| Länge:", adresse.length);
});
console.log("  Fehler:", fehler);

console.log("\n── Umlaute und Sonderzeichen ──");
A.vorlageLaden("linde");
const m = A.holM();
m.betrieb.name = "Café Größenwahn – „Süß & Scharf\"";
m.betrieb.claim = "Ötzis Küche · 100 % echt";
const ad = A.entwurfsAdresse();
A.vorlageLaden("loft");
global.location.hash = ad.slice(ad.indexOf("#"));
A.entwurfLesen();
console.log("  hin:    Café Größenwahn – „Süß & Scharf\"");
console.log("  zurück: " + A.holM().betrieb.name);
console.log("  gleich:", A.holM().betrieb.name === "Café Größenwahn – „Süß & Scharf\"");

console.log("\n── Kaputte Adresse ──");
["#m=nichtsGueltiges", "#m=", "#", "#m=" + Buffer.from("{}").toString("base64")]
  .forEach(hs => {
    global.location.hash = hs;
    let abgestuerzt = false, gelesen;
    try { gelesen = A.entwurfLesen(); } catch(e){ abgestuerzt = true; }
    console.log("  " + JSON.stringify(hs).padEnd(28),
      abgestuerzt ? "ABSTURZ" : (gelesen ? "angenommen" : "sauber abgelehnt"));
  });
