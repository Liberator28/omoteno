/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Alessias Webhook, die Teile ohne Netz

     node pruefungen/pruef-alessia.js

   Was hier NICHT geprüft werden kann: ob Vapi wirklich so schickt und
   ob die Edge Function ausgerollt läuft. Beides braucht Zugänge, die
   die Arbeitsumgebung nicht hat.

   Was hier SEHR WOHL geprüft wird: das Auslesen der Nutzlast. Genau
   dort geht bei einem fremden Webhook am ehesten etwas schief — eine
   Form ändert sich, ein Feld heißt anders, und die Bestellung landet
   still im falschen Haus oder gar nicht. Deshalb steht die Logik in
   einer reinen Funktion, die ohne Netz laufen kann.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const QUELLE = path.join(__dirname, "..", "supabase", "functions",
                         "alessia-bestellung", "index.ts");
if(!fs.existsSync(QUELLE)){
  console.error("Die Edge Function fehlt: " + QUELLE);
  process.exit(1);
}

/* Die zwei reinen Funktionen aus der TypeScript-Datei schneiden und
   die Typannotationen abstreifen. Kein Nachbau: Geprüft wird der
   Quelltext, der wirklich ausgerollt wird — eine Kopie hier würde
   irgendwann von ihm abweichen, ohne dass es jemand merkt. */
const src = fs.readFileSync(QUELLE, "utf8");
const stueck = (von, bis) => src.slice(src.indexOf(von), src.indexOf(bis));
let js = stueck("function gleichLang", "const antwort =") + "\n" +
         stueck("function nutzlastLesen", "Deno.serve");
js = js.replace("(a: string, b: string): boolean", "(a, b)")
       .replace("function nutzlastLesen(roh: any)", "function nutzlastLesen(roh)");

const raum = { module:{}, console };
vm.createContext(raum);
vm.runInContext(js + "\nmodule.exports={gleichLang,nutzlastLesen};", raum);
const { gleichLang, nutzlastLesen } = raum.module.exports;

let fehler = 0;
const ok = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };

console.log("── Das Geheimnis vergleichen ──");
ok(gleichLang("abc","abc") === true,  "gleiche Zeichenketten stimmen überein");
ok(gleichLang("abc","abd") === false, "eine Abweichung fällt durch");
ok(gleichLang("abc","abcd") === false, "andere Länge fällt durch");
ok(gleichLang("","") === true, "zwei leere sind gleich (der Aufrufer prüft auf leer)");

console.log("\n── Die Nutzlast lesen ──");
/* Form 1: toolCalls, wie Vapi es heute dokumentiert */
const a = nutzlastLesen({ message: {
  toolCalls: [{ id:"tc_1", function:{ name:"bestellung",
    arguments: JSON.stringify({ positionen:[{name:"Dubai Crêpe",menge:2}], notiz:"ohne Nuss" }) } }],
  call: { id:"call_9", phoneNumber:{ number:"+4915678505529" },
          customer:{ number:"+4917012345678", name:"Frau Meyer" } },
  transcript: "Guten Tag …" } });
ok(a.werkzeugId === "tc_1",                 "Werkzeug-Kennung gelesen", a.werkzeugId);
ok(a.gerufen === "+4915678505529",          "die ANGERUFENE Nummer entscheidet", a.gerufen);
ok(a.anrufer === "+4917012345678",          "Anrufer gelesen", a.anrufer);
ok(a.name === "Frau Meyer",                 "Name gelesen", a.name);
ok(a.positionen.length === 1 && a.positionen[0].menge === 2, "Positionen gelesen",
   JSON.stringify(a.positionen));
ok(a.notiz === "ohne Nuss",                 "Notiz gelesen", a.notiz);
ok(a.transkript === "Guten Tag …",          "Transkript gelesen");

/* Form 2: toolCallList mit bereits ausgepackten Argumenten */
const b = nutzlastLesen({ message: {
  toolCallList: [{ id:"tc_2", function:{ arguments:{ positionen:[{name:"Marina Waffel",menge:1}] } } }],
  call: { phoneNumber:{ number:"+4930111" }, customer:{ number:"+49170" } } } });
ok(b.werkzeugId === "tc_2" && b.gerufen === "+4930111" && b.positionen.length === 1,
   "zweite Form wird ebenfalls gelesen", b.gerufen);

/* Form 3: alles fehlt — es darf NICHTS werfen */
let stuerzt = false, c = null;
try { c = nutzlastLesen({}); } catch(e){ stuerzt = true; }
ok(!stuerzt, "eine leere Nutzlast stürzt nicht ab");
ok(c && c.gerufen === null,   "ohne Nummer kommt null zurück, nicht undefined-Salat");
ok(c && Array.isArray(c.positionen) && c.positionen.length === 0,
   "Positionen sind immer ein Feld", JSON.stringify(c && c.positionen));

/* Form 4: kaputtes JSON in den Argumenten */
const d = nutzlastLesen({ message: {
  toolCalls: [{ id:"tc_3", function:{ arguments:"{das ist kein json" } }],
  call: { phoneNumber:{ number:"+4930222" } } } });
ok(Array.isArray(d.positionen) && d.positionen.length === 0,
   "kaputte Argumente ergeben eine leere Bestellung, keinen Absturz");
ok(d.gerufen === "+4930222", "und die Nummer wird trotzdem gelesen");

/* Der Anrufer darf das Ziel NICHT bestimmen — sonst bestellt jemand
   in ein fremdes Haus, indem er eine Nummer mitschickt. */
const e = nutzlastLesen({ message: {
  toolCalls: [{ id:"tc_4", function:{ arguments: JSON.stringify({
    gerufene_nummer:"+49999FREMD", positionen:[] }) } }],
  call: { phoneNumber:{ number:"+4930333" }, customer:{ number:"+49170" } } } });
ok(e.gerufen === "+4930333",
   "eine mitgeschickte Nummer schlägt die echte NICHT", e.gerufen);

console.log("\n── Was die Funktion selbst zusichert ──");
ok(/x-vapi-secret/i.test(src),            "sie prüft den Geheimnis-Kopf");
ok(/if \(!VAPI_SECRET\)/.test(src),       "ohne gesetztes Geheimnis nimmt sie nichts an");
ok(!/p_summe|summe:/.test(src),           "sie schickt KEINEN Preis mit — der wird nachgerechnet");
ok(/SUPABASE_SERVICE_ROLE_KEY/.test(src), "sie nutzt den service_role, nicht den anon-Schlüssel");
ok(!/eyJ|sbp_|service_role_key\s*=\s*["']/.test(src.replace(/SUPABASE_SERVICE_ROLE_KEY/g,"")),
   "kein Schlüssel steht im Quelltext");

console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
process.exit(fehler ? 1 : 0);
