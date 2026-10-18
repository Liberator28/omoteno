/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Übersetzungen, gegen eine ZWEITE Quelle gehalten

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-uebersetzung.js
     (braucht dist/ — vorher: node erzeuger/erzeuge-hub.js --alle)

   > Vorfall, 09.09. Der Nutzer schickte fünf Bildschirmfotos: deutsche
   > Sätze mitten in der türkischen und der arabischen Karte. Gemessen
   > waren es zwei getrennte Fehler.
   >
   > 77 Einträge — genau die Gerichtbeschreibungen — trugen nur en, tr
   > und ar; in acht Sprachen las der Gast die ganze Karte auf Deutsch.
   > Und 25 Sätze aus KACHELARTEN, AVATAR_TEXTE und den Markenblättern
   > hatten überhaupt keinen Eintrag.
   >
   > pruef-sprache.js meldete beides nicht — sie liest die
   > t("wörtlicher Text")-Aufrufe im Quelltext. Eine Kachelunterzeile
   > steht aber in DATEN, nicht als Literal. Über etwas, das nicht
   > dasteht, iteriert keine Schleife (CLAUDE.md §8.1b).

   Deshalb hält diese Prüfung gegen eine zweite Quelle: nicht gegen
   die Aufrufe, sondern gegen alles, was aus DATEN auf den Schirm
   kommt — KACHELARTEN, AVATAR_TEXTE, OPTIONEN, die Karte im Gerüst
   und beide Markenblätter.

   Und danach misst sie das GEMALTE: In jeder der zwölf Sprachen darf
   auf dem Schirm kein deutscher Wörterbuchschlüssel stehen, für den
   es eine Übersetzung gibt. Das ist keine Heuristik — es ist der
   Beweis, dass t() an dieser Stelle wirklich gelaufen ist.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const HIER    = path.resolve(__dirname, "..");
const VORLAGE = path.join(HIER, "vorlagen", "hub.vorlage.html");
const HUBS    = ["chocolamour", "blend"]
  .map(s => ({ slug:s, datei: path.join(HIER, "dist", s, "index.html") }))
  .filter(h => fs.existsSync(h.datei));

if(!fs.existsSync(VORLAGE)){
  console.error("vorlagen/hub.vorlage.html nicht gefunden.");
  process.exit(1);
}
if(!HUBS.length){
  console.error("Kein Hub in dist/. Vorher: node erzeuger/erzeuge-hub.js --alle");
  process.exit(1);
}

let fehler = 0;
function pruef(gut, text, zusatz){
  console.log((gut ? "  ok   " : "  FEHL ") + text + (zusatz ? "  → " + zusatz : ""));
  if(!gut) fehler++;
}

const s = fs.readFileSync(VORLAGE, "utf8");

/* Die Sprachen aus der Datei lesen, nicht hier zweitpflegen — und nur
   aus dem SPRACHEN-Block, sonst trifft das Muster auch das Beispiel
   im Kommentar darüber. */
const sprBlock = s.slice(s.indexOf("const SPRACHEN = ["),
                         s.indexOf("];", s.indexOf("const SPRACHEN = [")));
const SPR = [...sprBlock.matchAll(/code:"([a-z]{2})"/g)].map(m => m[1]).filter(c => c !== "de");

/* Das Wörterbuch als echtes Objekt, nicht über Muster: Die Werte
   tragen Apostrophe, Klammern und Anführungszeichen aus zwölf
   Sprachen, und ein regulärer Ausdruck stolpert früher oder später
   über eines davon. */
const iT = s.indexOf("const TEXTE = {");
const jT = s.indexOf("\n};", iT);
const TEXTE = new Function("return " + s.slice(iT + "const TEXTE = ".length, jT + 2))();

/* ══ 0 · Der Browser darf nicht ein zweites Mal übersetzen ═════════
   > Vorfall, 10.09. Auf zwei Bildschirmfotos des Nutzers standen
   > Sätze wie „Karamelli bis zur Kremation und Verbrennung" — weder
   > im Wörterbuch noch in der Datenbank vorhanden (gemessen im
   > kompletten Export der 103 Gerichte: keine Zeile enthält
   > „Kremation"). Der Hub übersetzt sich SELBST; ohne translate="no"
   > übersetzt Chrome/Safari eine schon-türkische Seite ein ZWEITES
   > Mal, und genau daraus entstehen solche Sätze.

   NUR die Vorlage bekommt die Ansage: Die anderen acht ausgelieferten
   Seiten haben kein eigenes Sprachsystem (gemessen: 0 Treffer für
   SPRACHEN/TEXTE/spracheSetzen) — dort übersetzt der Browser einmal,
   richtig, und soll das auch dürfen. */
console.log("══ Der Browser darf nicht doppelt übersetzen ══");
pruef(/<html[^>]*\btranslate="no"/.test(s), 'die Vorlage trägt <html translate="no">');
pruef(/<meta\s+name="google"\s+content="notranslate">/.test(s),
  "und die Google-Meta-Angabe dazu");

/* ══ 1 · Ist jeder Eintrag vollständig? ═════════════════════════════ */
console.log("\n══ Das Wörterbuch selbst ══");
const unvoll = Object.keys(TEXTE)
  .map(k => [k, SPR.filter(c => !TEXTE[k][c])])
  .filter(([, o]) => o.length);
pruef(unvoll.length === 0, "jeder Eintrag trägt alle " + SPR.length + " Sprachen",
  unvoll.length
    ? unvoll.length + " unvollständig, z. B. „" + unvoll[0][0].slice(0, 40) +
      "“ ohne " + unvoll[0][1].join(",")
    : Object.keys(TEXTE).length + " Einträge");

/* ══ 2 · Die zweite Quelle ══════════════════════════════════════════
   Eigennamen und Marken gehören ausdrücklich NICHT ins Wörterbuch:
   „Nutella Crêpe“ heißt überall so, und ein übersetzter Markenname
   wäre schlimmer als ein deutscher. Die Liste steht hier benannt und
   nicht als stille Ausnahme — wer einen Namen hinzufügt, muss sich
   dabei ansehen, was er damit ungesehen durchlässt (CLAUDE.md §8.1g). */
/* Die Ausnahmen stehen NAMENTLICH da, nicht als Muster.
   > Vorfall, im ersten Gegenbeweis dieser Prüfung. Hier stand ein
   > Muster „Grossbuchstabe, bis zu vier Woerter = Eigenname". Es
   > verschluckte „Winken ohne zu winken" — eine ganz normale
   > Kachelunterzeile aus Blends Markenblatt. Der Gegenbeweis (Eintrag
   > testweise entfernt) blieb gruen, und die Pruefung haette den
   > Anlassfall, fuer den sie geschrieben wurde, nicht gefunden.
   >
   > Ein selbst erdachter Grenzwert ist keine Messung (CLAUDE.md
   > §5.2a). Wer eine Ausnahme braucht, schreibt sie hin — dann sieht
   > man beim Lesen, was sie ungesehen durchlaesst. */
const EIGENNAMEN = new Set([
  "Choco L'AMouR", "Blend", "Omoteno",
  "Dubai Crêpe", "Family Love", "Negroni Sbagliato",
  "Campari, Vermouth, Spumante.",
  "Don't get mad, get chocolate.",     /* Claim, englisch mit Absicht */
  "Cocktail & Gastro Lab",             /* Claim, englisch mit Absicht */
  "ChocoLamour-Gast",                  /* WLAN-Name */
  "erdbeere", "platte", "croissant",   /* Figurenkennung, nie sichtbar */
  "Café Nordstern", "Nordstern-Gast"   /* Vorführhaus der Landingpage, WLAN-Name */
]);
const KEIN_WORT  = /^[\s\p{P}\p{S}\d]*$/u;

function blockText(name, muster){
  const a = s.indexOf(name);
  if(a < 0) return [];
  const b = s.indexOf("\n};", a);
  return [...s.slice(a, b).matchAll(muster)].map(m => m[1]).filter(x => x && x.trim());
}

const ausDaten = new Map();          // Text → wo er herkommt
const merke = (wo, t) => { if(t && t.trim() && !ausDaten.has(t)) ausDaten.set(t, wo); };

blockText("const KACHELARTEN", /titel:"((?:[^"\\]|\\.)*)"/g).forEach(t => merke("KACHELARTEN.titel", t));
blockText("const KACHELARTEN", /unter:"((?:[^"\\]|\\.)*)"/g).forEach(t => merke("KACHELARTEN.unter", t));
blockText("const AVATAR_TEXTE", /:\s*"((?:[^"\\]|\\.)*)"/g).forEach(t => merke("AVATAR_TEXTE", t));
blockText("const OPTIONEN", /titel:\s*"((?:[^"\\]|\\.)*)"/g).forEach(t => merke("OPTIONEN.titel", t));
blockText("const OPTIONEN", /hinweis:\s*"((?:[^"\\]|\\.)*)"/g).forEach(t => merke("OPTIONEN.hinweis", t));

/* Die Karte im Gerüst: b: ist die Beschreibung, gruppe: die Kategorie.
   Der Name (n:) bleibt draußen — das sind Eigennamen. */
[...s.matchAll(/\bb:\s*"((?:[^"\\]|\\.)*)"/g)].forEach(m => merke("Karte im Gerüst", m[1]));
[...s.matchAll(/\bgruppe:\s*"((?:[^"\\]|\\.)*)"/g)].forEach(m => merke("Kategorie", m[1]));

/* Und beide Markenblätter — das ist die Stelle, an der ein ZWEITES
   Haus einen Satz mitbringt, den es im Gerüst nie gab (§8.1a). */
const MB_TECH = new Set(["schluessel","icon","slug","code","farbe","stil","raster","gruppe",
  "ziel","bild","logo","schrift","version","hex","typ","art","id","klasse","form","instagram",
  "google","maps","web","tel","mail","ssid","passwort","figur","netz","strasse","ort","name",
  "claim","gericht","was","zeiten","links","wlan","trinkgeld","kopfband","zierrat","thema"]);
/* Eine eigene Offline-Karte im Markenblatt (geruestKarte, zuerst bei
   Più Gusto) folgt derselben Regel wie die Karte im Gerüst oben: der
   Name (n) ist ein Eigenname, a/zeichen/opt sind Schlüssel und Kürzel,
   p ist ein Preis. Beschreibung (b) und Kategorie (gruppe) gehen durch
   t() und brauchen einen Eintrag — gruppe also hier ausdrücklich, obwohl
   es sonst in MB_TECH steht. Namentlich, nicht als Muster (§8.1g D). */
const GERUEST_OHNE = new Set(["n", "a", "zeichen", "opt", "p"]);
function ausMarkenblatt(o, wo){
  if(Array.isArray(o)) return o.forEach(v => ausMarkenblatt(v, wo));
  if(o && typeof o === "object")
    return Object.keys(o).forEach(k => {
      /* Ein Feld, das mit "_" beginnt, ist eine interne Notiz von mir
         an mich selbst (z. B. _hinweis, _zeiten_hinweis) — nie im Hub
         gerendert, deshalb keine Übersetzung nötig. */
      if(k.startsWith("_")) return;
      if(k === "demo" && /^markenblatt\/[^.]+$/.test(wo)) return demoPruefen(o[k], wo + ".demo");
      if(/\.geruestKarte\b/.test(wo)){
        if(GERUEST_OHNE.has(k)) return;
        if(k === "gruppe") return merke(wo + ".gruppe", o[k]);
      }
      if(!MB_TECH.has(k)) ausMarkenblatt(o[k], wo + "." + k);
    });
  if(typeof o === "string") merke(wo, o);
}
/* Das Vorführhaus (demo) bringt seine Gerichte wie echte Zeilen aus
   gerichte mit: Name und Beschreibung tragen ihre Übersetzungen
   SELBST (name_uebersetzungen / uebersetzungen), genau wie live — das
   ist die zweite Quelle für diese Texte, nicht das Wörterbuch. Die
   Kategorie dagegen geht live wie hier durch t(), braucht also einen
   Eintrag. Technische Felder (karte, allergene, id …) sind kein Text. */
const DEMO_SPRACHEN = ["en","tr","ru","fr","es","it","pl","ar","uk","nl","ro"];
const demoLuecken = [];
function demoPruefen(d, wo){
  (d && Array.isArray(d.gerichte) ? d.gerichte : []).forEach((z, i) => {
    merke(wo + ".gerichte.kategorie", z.kategorie);
    [["name", "name_uebersetzungen"], ["beschreibung", "uebersetzungen"]].forEach(([feld, ue]) => {
      if(!z[feld]) return;
      const fehlt = DEMO_SPRACHEN.filter(s => !(z[ue] && String(z[ue][s] || "").trim()));
      if(fehlt.length) demoLuecken.push(wo + ".gerichte[" + i + "]." + feld + " (" + z[feld] + "): " + fehlt.join(","));
    });
  });
}
for(const f of fs.readdirSync(path.join(HIER, "markenblaetter")).filter(f => f.endsWith(".json")))
  ausMarkenblatt(JSON.parse(fs.readFileSync(path.join(HIER, "markenblaetter", f), "utf8")),
                 "markenblatt/" + f.replace(".json",""));

console.log("\n══ Was aus Daten kommt ══");
pruef(demoLuecken.length === 0, "Gerichte des Vorführhauses tragen jede Sprache in der eigenen Zeile",
  demoLuecken.slice(0, 3).join(" | ") || "vollständig");
const ohneEintrag = [];
for(const [t, wo] of ausDaten){
  if(KEIN_WORT.test(t)) continue;
  if(/^(?:https?:|#|@|rgba?\(|\d)/.test(t)) continue;
  if(TEXTE[t]) continue;
  if(EIGENNAMEN.has(t)) continue;
  ohneEintrag.push(wo + ": " + t);
}
pruef(ohneEintrag.length === 0,
  ausDaten.size + " Texte aus Daten haben einen Wörterbucheintrag",
  ohneEintrag.length ? ohneEintrag.slice(0, 4).join(" | ") + (process.env.ALLE ? "\n      " + ohneEintrag.join("\n      ") : "") : "keine Lücke");

/* ══ 3 · Die Anrede bleibt in jeder Sprache dieselbe ════════════════
   > Vorfall, 09.09. Gemessen: Polnisch duzte in 29 Eintraegen und
   > siezte in 7, Italienisch duzte in 10 und siezte in 35. Kein
   > einzelner Satz war falsch — zusammen lasen sie sich billig, und
   > genau das war eine der Klagen des Nutzers.

   Der Hub siezt auf Deutsch. Wo eine Sprache beides kennt, muss sie
   sich entscheiden — und zwar überall gleich.

   Die ehrliche Grenze, und sie steht hier, statt einen Fehlalarm zu
   bauen: TÜRKISCH ist nicht dabei. „alınsın“ und „olsun“ sind
   Optative, „masanızı“ ist die Höflichkeitsform — ein regulärer
   Ausdruck unterscheidet das nicht von der zweiten Person Singular
   und schlug bei allen dreien an. Ein Werkzeug, das Fehlalarme
   schlägt, bringt einem bei, es zu übergehen (CLAUDE.md §8.2).
   Arabisch fehlt aus demselben Grund: Die Höflichkeitsform ist dort
   eine andere Konstruktion, kein anderes Pronomen.                 */
console.log("\n══ Die Anrede ══");
const W = re => new RegExp("(?:^|[\\s(„\"'»])(?:" + re + ")(?=$|[\\s.,;:!?)\"'“«»])", "i");
const ANREDE = {
  fr:{ du:W("tu|ton|ta|tes|toi"),                sie:W("vous|votre|vos") },
  es:{ du:W("tú|tu|tus|ti|elige|toca|mira"),     sie:W("usted|su|sus|elija|toque|mire") },
  it:{ du:W("tu|tuo|tua|tuoi|tue|scegli|tocca|scrivi"), sie:W("lei|suo|sua|suoi|sue|scelga|tocchi|scriva") },
  ru:{ du:W("ты|твой|твоя|твои|тебя|тебе"),      sie:W("вы|ваш|ваша|ваши|вас|вам") },
  uk:{ du:W("ти|твій|твоя|твої|тебе|тобі"),      sie:W("ви|ваш|ваша|ваші|вас|вам") },
  pl:{ du:W("ty|twój|twoja|twoje|ciebie|tobie"), sie:W("pan|pani|państwo|państwa|państwu") },
  nl:{ du:W("je|jij|jouw|jullie"),               sie:W("u|uw") },
  ro:{ du:W("tu|tău|ta|tăi|tale|ție"),           sie:W("dumneavoastră|dvs") }
};
/* Namentlich, nicht als Muster: Wo das Deutsche selbst unpersönlich
   ist („wie man es nicht erwartet“), ist das niederländische „je“
   ebenfalls unpersönlich und richtig. */
const ANREDE_AUSNAHME = new Set(["Gestapelt, wie man es nicht erwartet"]);
for(const c of Object.keys(ANREDE)){
  const geduzt = Object.keys(TEXTE).filter(k => {
    const v = TEXTE[k][c];
    return v && !ANREDE_AUSNAHME.has(k) &&
           ANREDE[c].du.test(v) && !ANREDE[c].sie.test(v);
  });
  pruef(geduzt.length === 0, c + " · siezt durchgehend, wie das Deutsche",
    geduzt.length ? geduzt.length + " geduzt, z. B. „" + TEXTE[geduzt[0]][c].slice(0, 44) + "“"
                  : "keine Abweichung");
}

/* ══ 4 · Das Gemalte, in jeder Sprache ══════════════════════════════ */
(async () => {
  const browser = await chromium.launch();

  for(const hub of HUBS){
    console.log("\n══ " + hub.slug + " · jede Sprache am fertigen Bild ══");
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
    const seite = await ctx.newPage();

    /* Ohne Netz nach außen — und die Karte kommt aus einer Zeile mit
       eigenen Übersetzungen, damit auch der Weg aus der DATENBANK
       mitgeprüft wird und nicht nur der aus dem Gerüst. */
    await seite.route("**/*", r => r.request().url().startsWith("file://")
      ? r.continue()
      : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
    await seite.route("**/rest/v1/betriebe**", r =>
      r.fulfill({ status:200, contentType:"application/json",
        body: JSON.stringify([{ id:"af095b14-d9ef-41f4-9b97-c4422b0de63f",
          bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) }));
    await seite.route("**/rest/v1/gerichte**", r =>
      r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify([{
        id:"11111111-1111-1111-1111-111111111111", name:"Probe Crêpe",
        kategorie:"Crêpe", beschreibung:"Kekscreme und Krümel",
        uebersetzungen:{ tr:"SONDERWEG-TR", ru:"SONDERWEG-RU" },
        preis:9.9, karte:"speisekarte", verfuegbar:true,
        kat_sort:0, reihenfolge:0 }]) }));

    await seite.goto("file://" + hub.datei);
    await seite.waitForTimeout(900);

    /* Der Weg aus der Datenbank: Was in der Spalte steht, muss den
       Eintrag im Gerüst überschreiben — sonst nützt dem Wirt jede
       Übersetzung nichts, die er selbst pflegt. */
    const ausDB = await seite.evaluate(() => ({
      tr: typeof TEXTE === "object" && TEXTE["Kekscreme und Krümel"]
            ? TEXTE["Kekscreme und Krümel"].tr : null,
      ru: typeof TEXTE === "object" && TEXTE["Kekscreme und Krümel"]
            ? TEXTE["Kekscreme und Krümel"].ru : null
    }));
    pruef(ausDB.tr === "SONDERWEG-TR" && ausDB.ru === "SONDERWEG-RU",
      "Übersetzungen aus der Datenbank landen im Wörterbuch",
      ausDB.tr + " / " + ausDB.ru);

    for(const code of ["de"].concat(SPR)){
      const rest = await seite.evaluate(async (code) => {
        spracheSetzen(code);
        zeichne();
        await new Promise(r => setTimeout(r, 60));
        const raus = [];
        const geh = el => {
          for(const k of el.childNodes){
            if(k.nodeType === 3){
              const t = k.textContent.trim();
              if(t) raus.push(t);
            } else if(k.nodeType === 1){
              /* Der Willkommensschirm wird EINMAL gezeichnet, direkt
                 nach spracheLaden(), und danach nie wieder. Ihn hier
                 mitzumessen hiesse, etwas zu verlangen, was der Code
                 nie behauptet hat — er ist beim Umschalten laengst
                 fertig. Seine eigene Frage steht als eigene Probe
                 darunter: Kommt er beim WIEDERKEHRENDEN Gast in
                 dessen Sprache hoch? */
              if(k.id === "willkommen") continue;
              /* .urname zeigt den deutschen Originalnamen ABSICHTLICH
                 neben der Übersetzung (urnameHTML(), CLAUDE.md §6.1
                 Vorfall A) — Personal und Gast sollen dasselbe Wort
                 vor sich haben. Deutsch bleibt hier stehen, weil es
                 stehen soll, nicht weil t() versagt hat. Gemessen: bei
                 „Frisch gepresster Orangensaft" hätte diese Prüfung
                 sonst eine korrekte Übersetzung als Fehler gemeldet —
                 ihr eigener Anlassfall, nicht der des Hubs. */
              if(typeof k.className === "string" && k.className.split(/\s+/).includes("urname")) continue;
              const st = getComputedStyle(k);
              if(st.display === "none" || st.visibility === "hidden") continue;
              geh(k);
            }
          }
        };
        geh(document.body);
        return raus;
      }, code);

      if(code === "de"){
        pruef(rest.length > 20, "de · die Seite trägt überhaupt Text",
          rest.length + " Textknoten");
        continue;
      }
      /* Ein sichtbarer Text, der WÖRTLICH ein deutscher Schlüssel ist,
         obwohl es dafür eine andere Übersetzung gibt, beweist: t() ist
         hier nicht gelaufen. Wo Übersetzung und Original gleich sind
         („Instagram“, „Nutella“), ist nichts zu beweisen. */
      const deutschGeblieben = [...new Set(rest)].filter(t =>
        TEXTE[t] && TEXTE[t][code] && TEXTE[t][code] !== t);
      pruef(deutschGeblieben.length === 0,
        code + " · kein deutscher Satz stehengeblieben",
        deutschGeblieben.length
          ? deutschGeblieben.slice(0, 3).map(t => "„" + t.slice(0, 34) + "“").join(", ")
          : rest.length + " Textknoten geprüft");
    }
    await ctx.close();

    /* ── Der Willkommensschirm beim wiederkehrenden Gast ──────────
       Der Hub startet absichtlich immer auf Deutsch; nur wer im Menü
       aktiv gewählt hat, bekommt seine Sprache wieder (Zeile ~6700).
       Genau dieser Gast sieht als ERSTES den Willkommensschirm — und
       der wird gezeichnet, nachdem spracheLaden() gelaufen ist. Ob
       diese Reihenfolge hält, ist von aussen nicht zu sehen: Steht
       der Schirm ein paar Zeilen hoeher, ist er deutsch und niemand
       merkt es, weil er nach drei Sekunden verschwindet. */
    const wCtx = await browser.newContext({ viewport:{ width:390, height:844 } });
    await wCtx.addInitScript(() => {
      try{ localStorage.setItem("tapto-sprache", "tr"); }catch(e){}
    });
    const wSeite = await wCtx.newPage();
    await wSeite.route("**/*", r => r.request().url().startsWith("file://")
      ? r.continue()
      : r.fulfill({ status:200, contentType:"application/json", body:"[]" }));
    await wSeite.goto("file://" + hub.datei);
    await wSeite.waitForTimeout(400);
    const wk = await wSeite.evaluate(() => {
      const el = document.getElementById("willkommen");
      if(!el || el.hidden) return null;
      return { wort: (document.getElementById("wkWort")  || {}).textContent,
               tipp: (document.getElementById("wkTipp")  || {}).textContent };
    });
    pruef(!!wk, "der Willkommensschirm steht beim ersten Besuch überhaupt",
      wk ? "sichtbar" : "nicht gefunden");
    if(wk){
      const nochDeutsch = ["wort","tipp"].filter(f =>
        TEXTE[wk[f]] && TEXTE[wk[f]].tr && TEXTE[wk[f]].tr !== wk[f]);
      pruef(nochDeutsch.length === 0,
        "und beim türkischen Gast auf Türkisch, nicht auf Deutsch",
        nochDeutsch.length ? nochDeutsch.join(",") + " deutsch: „" + wk.wort + "“"
                           : "„" + wk.wort + "“ · „" + wk.tipp + "“");
    }
    await wCtx.close();
  }

  /* ══ 5 · Der Weg im Board ═══════════════════════════════════════
     Der Wirt tippt einen deutschen Satz. Ab hier muss er in elf
     Sprachen ankommen, ohne dass der Wirt ein Sprachfeld sieht.

     Zwei Dinge werden gemessen, und das zweite ist das wichtigere:
     dass Speichern auch dann geht, wenn der Uebersetzer schweigt.
     Ein Gericht, das sich nicht speichern laesst, weil ein fremder
     Dienst nicht antwortet, kostet Umsatz (CLAUDE.md §7).          */
  console.log("\n══ Der Weg im Board ══");
  const ADMIN = path.join(HIER, "seiten", "admin.html");
  if(!fs.existsSync(ADMIN)){
    pruef(false, "seiten/admin.html gefunden");
  }else{
    for(const fall of [
      { name:"Übersetzer antwortet",
        antwort: (texte) => {
          const u = {};
          for(const t of texte){
            u[t] = {};
            for(const c of SPR) u[t][c] = c.toUpperCase() + ":" + t;
          }
          return { uebersetzt: u };
        } },
      { name:"Übersetzer schweigt", antwort: null },

      /* DER TEILFALL, und er ist der Anlassfall dieses Blocks.

         Vorher schrieb die Funktion einen Satz nur, wenn ALLE elf
         Sprachen zurueckkamen. Fehlte eine, flog der ganze Satz raus
         — der Wirt sah elf leere Felder und musste glauben, der
         Uebersetzer sei kaputt, obwohl zehn Sprachen fertig dalagen.

         Hier kommen zehn von elf: Arabisch fehlt. Erwartet wird, dass
         die zehn ANKOMMEN und dass das Board sagt, welche offen ist. */
      { name:"Übersetzer liefert zehn von elf", teil: true,
        antwort: (texte) => {
          const u = {}, offen = {};
          for(const t of texte){
            u[t] = {};
            for(const c of SPR) if(c !== "ar") u[t][c] = c.toUpperCase() + ":" + t;
            offen[t] = ["ar"];
          }
          return { uebersetzt: u, teilweise: offen, vorgelegt: texte.length, fertig: 0 };
        } },

      /* Und der Grund, den DU beheben kannst, sobald du ihn liest. */
      { name:"Schlüssel fehlt", grund: "kein_schluessel", soll: /ANTHROPIC_API_KEY|eingerichtet/i,
        antwort: () => ({ fehler: "kein_schluessel", uebersetzt: {} }) },

      /* VORFALL 26.09., 16:53, live gemessen: Unter ANTHROPIC_API_KEY
         standen 17 Zeichen — so lang wie der Name selbst. Das Board
         zeigte „Der Übersetzer meldet: schluessel_form“. Die Funktion
         liefert jetzt Art und Länge (nie den Wert), und das Board
         muss daraus einen Satz machen, nach dem man handeln kann. */
      { name:"Schlüssel falsch eingetragen", grund: "schluessel_form",
        soll: /17 Zeichen.*sk-ant-api03-/,
        antwort: () => ({ fehler: "schluessel_form", art: "zu_kurz", laenge: 17,
                          andere_namen: [], uebersetzt: {} }) }
    ]){
      const bCtx = await browser.newContext({ viewport:{ width:390, height:844 } });
      const b = await bCtx.newPage();
      const kaputt = [];
      b.on("pageerror", e => kaputt.push(String(e).slice(0, 120)));

      let gerufen = 0;
      await b.route("**/*", r => {
        const u = r.request().url();
        if(u.startsWith("file://")) return r.continue();
        if(/functions\/v1\/uebersetzen/.test(u)){
          gerufen++;
          if(!fall.antwort) return r.abort();          /* der Dienst schweigt */
          const d = JSON.parse(r.request().postData() || "{}");
          return r.fulfill({ status:200, contentType:"application/json",
            body: JSON.stringify(fall.antwort(d.texte || [])) });
        }
        return r.abort();
      });
      await b.goto("file://" + ADMIN);
      await b.waitForTimeout(800);
      await b.evaluate(() => {
        document.getElementById("tor").hidden = true;
        if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); }
      });
      await b.waitForTimeout(300);

      /* Der Uebersetzer wird in der Demo-Betriebsart absichtlich NICHT
         gerufen — dort ist niemand angemeldet, und der Aufruf käme als
         401 zurück. Diese Probe muss also den scharfen Weg fahren.

         Der Ersatz für db ist bewusst dünn und ruft für
         functions.invoke ein echtes fetch: So geht der Aufruf durch
         die Route dieser Prüfung, und die URL und die Nutzlast werden
         wirklich gemessen — nicht nur, dass eine Funktion aufgerufen
         wurde. Was gespeichert wird, landet im Speicher, nicht in
         einer Datenbank; darum geht es hier nicht. */
      await b.evaluate(() => {
        demo = false;
        betriebId = "11111111-2222-3333-4444-555555555555";
        const nichts = async () => ({ data:null, error:null });
        db = {
          functions: { invoke: async (name, o) => {
            try{
              const r = await fetch(SUPABASE_URL + "/functions/v1/" + name, {
                method:"POST",
                headers:{ "Content-Type":"application/json" },
                body: JSON.stringify((o && o.body) || {})
              });
              if(!r.ok) return { data:null, error:{ message:"http " + r.status } };
              return { data: await r.json(), error:null };
            }catch(e){ return { data:null, error:{ message:String(e) } }; }
          } },
          from: () => ({
            update: (satz) => ({ eq: async (_f, id) => {
              const g = gerichte.find(x => x.id === id);
              if(g) Object.assign(g, satz);
              return { error:null };
            } }),
            insert: (satz) => ({ select: () => ({ single: async () => {
              const g = Object.assign({}, satz, { id:"probe-" + gerichte.length });
              return { data:g, error:null };
            } }) }),
            delete: () => ({ eq: nichts })
          })
        };
      });

      /* Die zwei alten Handfelder duerfen nicht mehr da sein: zwei von
         zwoelf Sprachen sind schlimmer als keine — der Gast findet
         dann NUR auf Englisch und Tuerkisch etwas. */
      const weg = await b.evaluate(() => ({
        alteFelder: !!document.getElementById("fBeschrEn") ||
                    !!document.getElementById("fBeschrTr"),
        stand: !!document.getElementById("uebStand"),
        knopf: !!document.getElementById("uebJetzt")
      }));
      pruef(!weg.alteFelder && weg.stand && weg.knopf,
        fall.name + " · das Blatt zeigt einen Sprachstand statt zwei Handfelder",
        "alteFelder=" + weg.alteFelder + " stand=" + weg.stand);

      /* Ein Gericht anlegen — genau so, wie der Wirt es tut. */
      const stand = await b.evaluate(async () => {
        blattOeffnen(null);
        document.getElementById("fName").value   = "Probe Waffel";
        document.getElementById("fBeschr").value = "Frisch gebacken, warm serviert";
        document.getElementById("fKat").value    = "Waffel";
        document.getElementById("fPreis").value  = "9.90";
        await sichern(false);
        await new Promise(r => setTimeout(r, 600));
        const g = gerichte.find(x => x.name === "Probe Waffel");
        return g ? {
          da: true,
          name: g.name_uebersetzungen ? Object.keys(g.name_uebersetzungen).length : 0,
          beschr: g.uebersetzungen ? Object.keys(g.uebersetzungen).length : 0,
          probe: g.uebersetzungen ? g.uebersetzungen.tr : null
        } : { da:false };
      });

      /* IMMER: das Gericht ist gespeichert. Das ist die Zusage, die
         nicht von einem fremden Dienst abhaengen darf. */
      pruef(stand.da, fall.name + " · das Gericht ist gespeichert",
        stand.da ? "in der Karte" : "nicht angelegt");

      if(fall.teil){
        /* Zehn von elf muessen ANKOMMEN. Vorher waren es null. */
        pruef(stand.beschr === SPR.length - 1,
          "Teilfall · die zehn gelieferten Sprachen werden behalten",
          stand.beschr + " von " + SPR.length + " (Arabisch fehlt absichtlich)");
        pruef(stand.probe === "TR:Frisch gebacken, warm serviert",
          "Teilfall · und sie stehen am richtigen Text", String(stand.probe));
        /* Und der Wirt muss LESEN, welche fehlt — sonst kann er die
           eine nicht nachtragen. */
        /* Gemessen wird die MELDEZEILE, nicht das Blatt. Mein erster
           Anlauf las #uebStand — und das stand nach dem Speichern
           schon wieder auf "Wird beim Speichern übersetzt", weil das
           Blatt zu ist. Die Probe war rot und hat damit einen echten
           Fehler gefunden: Die Auskunft kam nirgends an (§8.1h). */
        const anzeige = await b.evaluate(() => {
          const m = document.getElementById("melde") ||
                    document.querySelector(".melde, #meldung, .meldung");
          const s = document.getElementById("uebStand");
          return [(m ? m.textContent : ""), (s ? s.textContent : "")].join(" | ");
        });
        pruef(/Arabisch/.test(anzeige),
          "Teilfall · das Board benennt die fehlende Sprache",
          anzeige.slice(0, 92) || "keine Anzeige");
      }else if(fall.grund){
        /* Der Grund im Klartext. "kein_schluessel" ist etwas, das der
           Betreiber beheben kann — aber nur, wenn er es liest. */
        const anzeige = await b.evaluate(() => {
          const m = document.getElementById("melde") ||
                    document.querySelector(".melde, #meldung, .meldung");
          const s = document.getElementById("uebStand");
          return [(m ? m.textContent : ""), (s ? s.textContent : "")].join(" | ");
        });
        pruef(fall.soll.test(anzeige),
          fall.name + " · der Grund steht im Klartext da",
          anzeige.slice(0, 110) || "keine Anzeige");
        pruef(!anzeige.includes(fall.grund),
          fall.name + " · und nicht als Maschinenwort",
          anzeige.includes(fall.grund) ? "roher Grund: " + fall.grund : "Klartext");
      }else if(fall.antwort){
        pruef(stand.name === SPR.length && stand.beschr === SPR.length,
          "Übersetzer antwortet · Name und Beschreibung in " + SPR.length + " Sprachen",
          "Name " + stand.name + ", Beschreibung " + stand.beschr);
        pruef(stand.probe === "TR:Frisch gebacken, warm serviert",
          "Übersetzer antwortet · die Antwort landet am richtigen Text", String(stand.probe));
      }else{
        pruef(stand.name === 0 && stand.beschr === 0,
          "Übersetzer schweigt · nichts Halbes wird geschrieben",
          "Name " + stand.name + ", Beschreibung " + stand.beschr);
        pruef(gerufen > 0, "Übersetzer schweigt · es wurde überhaupt versucht",
          gerufen + " Aufruf(e)");
      }
      pruef(kaputt.length === 0, fall.name + " · kein Fehler in der Konsole",
        kaputt[0] || "still");
      await bCtx.close();
    }
  }

  await browser.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
