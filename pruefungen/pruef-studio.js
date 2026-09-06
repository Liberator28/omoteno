const fs = require("fs");
const path = require("path");
/* Die Datei hieß einmal omoteno-marken-studio.html. Nach der
   Umbenennung fiel diese Prüfung mit ENOENT um und wurde damit
   monatelang nicht mehr gelesen — eine Prüfung, die nicht läuft, ist
   keine. Deshalb sucht sie ihre Datei jetzt neben sich. */
const KANDIDATEN = ["marken-studio.html", "omoteno-marken-studio.html", "markenstudio.html"];
const datei = KANDIDATEN.map(n => path.join(__dirname, "..", "seiten", n))
                        .find(fs.existsSync);
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
     "eigeneTexte, schriftAuf, kontrast, BEREICH_FOLGE, holM:()=>M, setzM:x=>{M=x}, holReihe:()=>M.reihe };");
const A = module.exports;

console.log("── Entwurf verschicken ──");
let fehler = 0;
/* FRISCH laden, nicht nur laden. Seit dem Stilwechsel Texte des
   Kunden übernimmt, schleppt ein gewöhnliches vorlageLaden() den Namen
   aus dem vorigen Durchgang mit — und dann vergleicht diese Prüfung
   „KAPUTT" mit „KAPUTT" und meldet zufrieden „gleich". Gemessen: mit
   sabotiertem Namen im Link wurde nur die ERSTE von vier Zeilen rot,
   die anderen drei waren blind. Das zweite Argument ist deshalb keine
   Feinheit, sondern die Bedingung dafür, dass hier überhaupt etwas
   gemessen wird (CLAUDE.md §2.3b). */
Object.keys(A.VORLAGEN).forEach(v => {
  A.vorlageLaden(v, true);
  /* Die Figur wird absichtlich VERSTELLT, bevor der Link entsteht:
     Bliebe sie auf der Vorgabe, könnte der Vergleich hinterher auch
     dann „gleich" melden, wenn der Link sie gar nicht mitnimmt. */
  A.holM().avatar = { figur:"erdbeere", art:"witzig", name:"Fräulein Fraise" };
  /* Dasselbe Spiel für die Kachelüberschreibungen: Bleiben sie leer,
     könnte der Vergleich hinterher auch dann „gleich" melden, wenn
     der Link sie gar nicht mitnimmt. Ein Feld, das mitfährt, aber
     nicht verglichen wird, fährt ungeprüft (§2.3b). */
  A.holM().kachel = { speisekarte:{ titel:"Unsere Karte", icon:"teller" },
                      tischruf:{ emoji:"🔔" } };
  const vorher = JSON.parse(JSON.stringify(A.holM()));
  const adresse = A.entwurfsAdresse();
  // Anderen Ausgangszustand herstellen, dann aus der Adresse lesen
  A.vorlageLaden(v === "loft" ? "linde" : "loft", true);
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
  const kachelGleich = JSON.stringify(nachher.kachel || {}) ===
                       JSON.stringify(vorher.kachel || {});

  if(!(ok && gleich && namegleich && reihegleich && anGleich && figurGleich && kachelGleich)) fehler++;
  console.log("  " + v.padEnd(11),
    "gelesen:", ok ? "ja " : "NEIN",
    "| Farben:", gleich ? "gleich" : "ABWEICHUNG",
    "| Name:", namegleich ? "gleich" : "ABWEICHUNG",
    "| Reihenfolge:", reihegleich ? "gleich" : "ABWEICHUNG",
    "| Schalter:", anGleich ? "gleich" : "ABWEICHUNG",
    "| Figur:", figurGleich ? "gleich" : "ABWEICHUNG",
    "| Kacheln:", kachelGleich ? "gleich" : "ABWEICHUNG",
    "| Länge:", adresse.length);
});
console.log("  Fehler:", fehler);

console.log("\n── Umlaute und Sonderzeichen ──");
A.vorlageLaden("linde", true);
const m = A.holM();
m.betrieb.name = "Café Größenwahn – „Süß & Scharf\"";
m.betrieb.claim = "Ötzis Küche · 100 % echt";
const ad = A.entwurfsAdresse();
A.vorlageLaden("loft", true);
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

/* ═══════════════════════════════════════════════════════════════════
   Der Stilwechsel darf den Text des Kunden nicht wegwerfen

   Ein Stil zu wechseln heißt: andere Farben, andere Schrift, andere
   Form. Es heißt nicht, dass das Haus wieder „Café Nordstern" heißt.
   Wer drei Stile durchprobiert, tippte seinen Namen sonst dreimal.

   Geprüft wird beides — dass Eigenes bleibt UND dass Vorlagentext
   weicht. Nur das erste zu prüfen ginge auch mit einer Funktion, die
   gar nichts mehr wechselt.
   ═══════════════════════════════════════════════════════════════════ */
console.log("\n── Eigener Text überlebt den Stilwechsel ──");
{
  const p = (gut, text, zusatz) => {
    console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
    if(!gut) fehler++;
  };

  /* 1 · Angefasste Felder bleiben */
  A.vorlageLaden("nordstern", true);
  const m1 = A.holM();
  m1.betrieb.name        = "Zur Goldenen Gans";
  m1.betrieb.claim       = "Seit 1888";
  m1.betrieb.begruessung = "Grüß Gott.";
  m1.avatar.name         = "Gustl";
  A.vorlageLaden("loft");
  const n = A.holM();
  p(n.betrieb.name        === "Zur Goldenen Gans", "Name bleibt",       n.betrieb.name);
  p(n.betrieb.claim       === "Seit 1888",         "Zeile bleibt",      n.betrieb.claim);
  p(n.betrieb.begruessung === "Grüß Gott.",        "Begrüßung bleibt",  n.betrieb.begruessung);
  p(n.avatar.name         === "Gustl",             "Figurname bleibt",  n.avatar.name);
  /* Die Wortmarke hängt am Namen, solange sie Text ist — sonst stünde
     im Band weiter der Name der alten Vorlage. */
  p(n.logo.text === "Zur Goldenen Gans", "Wortmarke zieht mit", n.logo.text);
  /* Und der Stil selbst MUSS gewechselt haben. */
  p(n.farben.grund === A.VORLAGEN.loft.tag.grund, "Farben sind die neuen", n.farben.grund);
  p(n.schrift.kopf === A.VORLAGEN.loft.kopf,      "Schrift ist die neue",  n.schrift.kopf);

  /* 2 · Unangetastete Felder weichen */
  A.vorlageLaden("nordstern", true);
  A.vorlageLaden("vespa");
  const u = A.holM();
  p(u.betrieb.name  === A.VORLAGEN.vespa.name,  "Unberührter Name weicht",  u.betrieb.name);
  p(u.betrieb.claim === A.VORLAGEN.vespa.claim, "Unberührte Zeile weicht",  u.betrieb.claim);
  p(u.betrieb.begruessung === A.VORLAGEN.vespa.gruss, "Unberührter Gruß weicht", u.betrieb.begruessung);

  /* 3 · Ohne Quellvorlage gehört ALLES dem Kunden. Das ist der Fall
     nach „Markenblatt einlesen" und nach einem Entwurf aus der
     Adresse — dort steht quelleName auf leer, und dann gibt es
     nichts, wogegen man halten könnte. */
  A.vorlageLaden("linde", true);
  const e = A.holM();
  e.betrieb.name = A.VORLAGEN.linde.name;      /* absichtlich UNVERÄNDERT */
  A.entwurfsAdresse();
  A.vorlageLaden("linde", true);
  A.holM().betrieb.name = "Eingelesenes Haus";
  /* quelleName künstlich leeren, wie es entwurfLesen() und einlesen tun */
  eval("quelleName = ''");
  const eigen = A.eigeneTexte();
  p(eigen.name === "Eingelesenes Haus",
    "Ohne Quellvorlage gilt jeder Text als eigener", String(eigen.name));
}

if(fehler) console.log("\n  " + fehler + " Fehler.");
else console.log("\n  Alles sauber.");
process.exit(fehler ? 1 : 0);
