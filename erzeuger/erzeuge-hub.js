#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   ERZEUGE-HUB

   Baut aus einer Vorlage und einem Markenblatt eine fertige
   Hub-Datei.

       node erzeuger/erzeuge-hub.js chocolamour
       node erzeuger/erzeuge-hub.js chocolamour --pruefen-nur
       node erzeuger/erzeuge-hub.js --alle

   Warum das der wichtigste Baustein ist: Bisher stand das
   Markenblatt nur in der ausgelieferten Datei und wurde von Hand
   gepflegt. Damit kostete jeder Neukunde Handarbeit — und eine
   Testversion, eine Selbstregistrierung oder auch nur zwanzig
   Kunden waren damit unmöglich.

   Was NICHT passiert: Der Hub lädt das Markenblatt nicht zur
   Laufzeit. Es steht weiterhin fest in der Datei, damit die Farben
   beim ersten Bildaufbau da sind. Erzeugt statt geladen — das ist
   der Unterschied.

   Ohne Abhängigkeiten. Kein npm install, kein Bauwerkzeug. Läuft in
   jeder Cloud-Sitzung und auf jedem Rechner mit Node.
   ═══════════════════════════════════════════════════════════════ */
"use strict";

const fs   = require("fs");
const path = require("path");
const { kompaktHtml } = require("./kompakt");

/* ─── Wo die Dateien liegen ───────────────────────────────────
   Zwei Formen sind erlaubt, und zwar aus einem praktischen Grund:
   Die dokumentierte Ordnerform (vorlagen/, markenblaetter/, dist/)
   ist die Zielform. Wer aber vom iPhone aus arbeitet, lädt Dateien
   flach in ein Verzeichnis hoch — dann liegt alles nebeneinander.
   Der Erzeuger sucht deshalb erst die Ordnerform und nimmt sonst
   das, was neben ihm liegt. Ohne diese zehn Zeilen bricht er im
   flachen Verzeichnis mit „ENOENT vorlagen/hub.vorlage.html" ab,
   und niemand sieht, dass nur der Pfad falsch war. */
const HIER     = __dirname;
const OBEN     = path.resolve(__dirname, "..");
const nimm     = (...kandidaten) => kandidaten.find(p => fs.existsSync(p)) || kandidaten[0];

const VORLAGE  = nimm(path.join(OBEN, "vorlagen", "hub.vorlage.html"),
                      path.join(HIER, "hub.vorlage.html"));
const BLAETTER = nimm(path.join(OBEN, "markenblaetter"),
                      HIER);
const WURZEL   = fs.existsSync(path.join(OBEN, "vorlagen")) ? OBEN : HIER;
const ZIEL     = process.env.OMOTENO_ZIEL ? path.resolve(process.env.OMOTENO_ZIEL) : path.join(WURZEL, "dist");   /* Gegenbeweise und pruef-kompakt.js erzeugen in ein anderes Verzeichnis */

/* ─── Schriften und Schatten ──────────────────────────────────
   Muss deckungsgleich mit dem sein, was in der Vorlage steht.
   Deshalb wird es unten auch geprüft, statt es zu hoffen. */
/* Wortgleich mit den Schlüsseln in vorlagen/hub.vorlage.html und
   seiten/marken-studio.html. Eine Schrift, die dort steht und hier
   nicht, lässt jedes Markenblatt durchfallen, das sie benutzt. */
/* Beide Listen werden AUS DEM GERÜST gelesen, nicht hier doppelt
   gepflegt. Sonst laufen sie auseinander, und der Erzeuger lehnt ab,
   was der Hub kann — oder schlimmer, lässt durch, was er nicht kann. */
function ausGeruest(muster, wo){
  const datei = fs.readFileSync(path.join(__dirname, "..", "vorlagen", "hub.vorlage.html"), "utf8");
  const t = datei.match(muster);
  if(!t){
    console.error("Im Gerüst nicht gefunden: " + wo);
    process.exit(1);
  }
  return [...t[1].matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm)].map(m => m[1]);
}
const KACHELSCHLUESSEL = ausGeruest(/const KACHELARTEN = \{([\s\S]*?)\n\};/, "KACHELARTEN");
const ICONNAMEN        = ausGeruest(/const ICONS = \{([\s\S]*?)\n\};/, "ICONS");
/* Aus demselben Grund wie oben: Bis Block 6 stand hier von Hand
   ["untersetzer","erdbeere"]. Eine neunte Figur im Gerüst hätte der
   Erzeuger abgelehnt — der Kunde hätte sie im Studio gewählt und den
   Hub nicht bekommen. */
const FIGURNAMEN       = ausGeruest(/const AVATAR_FIGUREN = \{([\s\S]*?)\n\};/, "AVATAR_FIGUREN");
/* Zwei feste Werte statt aus dem Gerüst gelesen — anders als bei den
   Figuren gibt es hier (noch) keine Sammlung im Vorlage-Quelltext,
   an der man das automatisch ablesen könnte: kopfbandSetzen() im
   Gerüst kennt nur "laternen" als Sonderfall, alles andere bleibt
   beim Guss. */
const KOPFBAND_ARTEN    = ["guss", "laternen", "trikolore"];
/* Zierrat: zusätzlicher, wählbarer Gestaltungs-Zierrat (Bambus im
   Kopf, Tuschekleckse statt Farbwolken, Pfingstrosen-Knospe vor jeder
   .bereich-Überschrift). Fehlt zierrat ganz, bleibt der Hub wie
   bisher — zierratSetzen() im Gerüst kennt nur "tusche". */
const ZIERRAT_ARTEN     = ["tusche"];
/* Thema: fest gebundene Neueinfärbung samt Rahmen-/Knopf-Stil für
   EIN Haus, nicht wie zierrat als übertragbarer Stil gedacht — aber
   trotzdem über das Markenblatt geschaltet statt an den Slug
   hartkodiert (§8.1a), damit kein Codepfad je "HAUS===minhkeey"
   prüfen muss. themaSetzen() im Gerüst kennt nur "kaiserlich". */
const THEMA_ARTEN       = ["kaiserlich"];
/* Startstil: wie die STARTSEITE aussieht — „klassisch“ ist der Hub von vorher, „premium“ die Fassung mit Foto-Kopf,
   Bildkarten, Leiste „Auswahl ansehen“ und Hauptnavigation. Ein Schalter je Haus statt eines stillen Wechsels für
   alle (§2.5: bestehende Häuser sehen ohne eigenes Zutun keine Änderung). Fehlt das Feld, bleibt der Hub wie bisher;
   startstilSetzen() im Gerüst kennt nur „premium“. */
const STARTSTIL_ARTEN   = ["klassisch", "premium"];
/* Layout je Haus (nur mit startstil "premium"): Regler und Profile stehen im Gerüst (LAYOUT_REGLER, LAYOUT_PROFILE) und werden
   von dort gelesen — eine zweite Liste hier liefe auseinander, und der Kunde bekäme ein Blatt durch, das der Hub nicht kennt.
   Der Gerüst-Block ist reines JSON-artiges JavaScript; er wird als Ausdruck gelesen, nichts davon ausgeführt außer diesem. */
function layoutAusGeruest(name){
  const datei = fs.readFileSync(path.join(__dirname, "..", "vorlagen", "hub.vorlage.html"), "utf8");
  const t = datei.match(new RegExp("const " + name + " = (\\{[\\s\\S]*?\\n\\});"));
  if(!t){ console.error("Im Gerüst nicht gefunden: " + name); process.exit(1); }
  return new Function("return (" + t[1] + ")")();
}
const LAYOUT_REGLER    = layoutAusGeruest("LAYOUT_REGLER");
const LAYOUT_PROFILE   = layoutAusGeruest("LAYOUT_PROFILE");
/* Was die Figur je Bestellphase tragen kann, und welche Phasen es
   gibt — beides aus dem Gerüst, aus demselben Grund wie oben. */
const REQUISITEN       = ausGeruest(/const E_REQUISITEN = \{([\s\S]*?)\n\};/, "E_REQUISITEN");
const PHASENNAMEN      = ausGeruest(/const PHASEN = \{([\s\S]*?)\n\};/, "PHASEN");
const FIGURANLAESSE    = ausGeruest(/const AVATAR_TEXTE = \{([\s\S]*?)\n\};/, "AVATAR_TEXTE");
/* Die Längengrenzen kommen ebenfalls aus dem Gerüst. Sie hier
   abzuschreiben hieße: Wer sie dort nachmisst und ändert, ändert sie
   für den Hub und nicht für den Erzeuger — und der Kunde bekäme ein
   Blatt durch, das der Hub hinterher abschneidet. */
const TEXTMASS_HAUS = (() => {
  const datei = fs.readFileSync(
    path.join(__dirname, "..", "vorlagen", "hub.vorlage.html"), "utf8");
  const t = datei.match(/const E_TEXTMASS = \{([\s\S]*?)\n\};/);
  if(!t){ console.error("Im Gerüst nicht gefunden: E_TEXTMASS"); process.exit(1); }
  const raus = {};
  for(const m of t[1].matchAll(/(\w+):\s*\{\s*gut:\s*(\d+),\s*hart:\s*(\d+)/g))
    raus[m[1]] = { gut:+m[2], hart:+m[3] };
  return raus;
})();

const SCHRIFTEN = ["system","serif-klassisch","serif-eng","serif-hoch","slab",
                   "grotesk","grotesk-eng","rund","mono","schreib"];
const SCHATTEN  = ["weich","kante","ohne"];

const FARBEN_PFLICHT = ["grund","flaeche","flaeche2","band","bandText",
  "tinte","tinteLeise","tinteStill","linie","linieStark",
  "akzent","akzent2","gut"];

/* ─── Farbrechnung ────────────────────────────────────────────
   Dieselbe Rechnung wie im Hub, im Studio und auf der
   Landingpage. Vier Kopien wären drei zu viel — aber solange die
   Zielumgebungen keine Module laden, ist die Kopie hier der Preis
   dafür, dass die PRÜFUNG überhaupt stattfindet. */
/* Diese Datei hatte helligkeit() und kontrast() ZWEIMAL. In
   JavaScript werden Funktionsdeklarationen gehoben — die spätere
   Fassung gewann für die ganze Datei, die frühere war unerreichbar.
   Für gültige sechsstellige Hexfarben rechnen beide aufs Zehntel
   gleich (gemessen), es ging also nie etwas schief; die Prüfung des
   Farbformats steht ohnehin weiter oben bei FARBEN_PFLICHT. Weg damit,
   bevor jemand die tote Fassung pflegt. §1.1 */
function kontrast(a,b){
  const l1 = helligkeit(a), l2 = helligkeit(b);
  if(l1 === null || l2 === null) return null;
  return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
}

/* ─── Prüfung ─────────────────────────────────────────────────
   Trennt bewusst zwischen FEHLER (Erzeugen wird abgebrochen) und
   WARNUNG (wird erzeugt, aber gemeldet).

   Ein zu schwacher Kontrast ist eine Warnung, kein Fehler: Es gibt
   Fälle, in denen ein Betrieb seine Hausfarbe bewusst will. Ein
   fehlender Pflichtwert dagegen ergäbe eine kaputte Datei — das
   darf nicht durchgehen. */
function pruefeMarkenblatt(mb){
  const fehler = [], warnung = [];
  const F = t => fehler.push(t), W = t => warnung.push(t);

  if(!mb || typeof mb !== "object") { F("Markenblatt ist kein Objekt"); return {fehler,warnung}; }
  if(mb.version !== 1) F("version muss 1 sein, ist: " + JSON.stringify(mb.version));

  /* Betrieb */
  const b = mb.betrieb || {};
  if(!b.name)  F("betrieb.name fehlt");
  if(!b.slug)  F("betrieb.slug fehlt");
  if(b.slug && !/^[a-z0-9-]{2,40}$/.test(b.slug))
    F("betrieb.slug darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten: " + b.slug);
  if(!b.claim) W("betrieb.claim ist leer — im Kopfband steht dann nichts unter dem Namen");

  /* Das Vorführhaus der Landingpage (11.10.). Ein Markenblatt mit
     „demo“ wird ein Hub, der IMMER im Vorführmodus läuft — auch wenn
     ihn jemand direkt unter /h/<slug>/ öffnet. Seine Daten (Betrieb,
     Gerichte, Aktion) stehen hier, nicht in der Datenbank; der Hub
     beantwortet jede Anfrage selbst. Jedes Gericht bringt seine
     Übersetzungen mit — wie eine echte Zeile aus gerichte. */
  if(mb.demo !== undefined){
    const d = mb.demo;
    if(!d || typeof d !== "object" || Array.isArray(d)) F("demo muss ein Objekt sein");
    else {
      if(!d.betrieb || typeof d.betrieb.id !== "string") F("demo.betrieb.id fehlt");
      const sprachen = ["en","tr","ru","fr","es","it","pl","ar","uk","nl","ro"];
      const g = Array.isArray(d.gerichte) ? d.gerichte : [];
      if(!g.length) F("demo.gerichte ist leer — der Hub zeigte sonst die Karte aus dem Gerüst");
      ["speisekarte","getraenke","cocktails"].forEach(k => {
        if(!g.some(z => z.karte === k))
          F("demo.gerichte hat nichts in „" + k + "“ — dort bliebe die Karte aus dem Gerüst stehen");
      });
      g.forEach((z, i) => {
        const wo = "demo.gerichte[" + i + "] " + (z.name || "");
        if(!z.name || !z.kategorie || !(Number(z.preis) > 0)) F(wo + ": name, kategorie und preis sind Pflicht");
        [["name_uebersetzungen", z.name], ["uebersetzungen", z.beschreibung]].forEach(([feld, text]) => {
          if(!text) return;
          const fehlt = sprachen.filter(s => !z[feld] || !String(z[feld][s] || "").trim());
          if(fehlt.length) F(wo + ": " + feld + " fehlt für " + fehlt.join(","));
        });
      });
    }
  }

  /* Eigene Gerüst-Karte (17.10., Più Gusto). Die Karten im Gerüst sind
     Chocos echte Karte. Gemessen: Getränke und Cocktails werden live nur
     ersetzt, wenn die Datenbank dort etwas hat — ein Haus, das nur Pizzen
     pflegt, bekäme sonst unter „Getränke“, in „Passt dazu“ und im Rad
     Chocos Säfte angeboten, offline sogar Chocos Crêpes. Mit
     geruestKarte steht stattdessen DIESE Karte im Hub (fehlende Karten
     leer); live ersetzt die Datenbank sie wie gewohnt. */
  if(mb.geruestKarte !== undefined){
    const gk = mb.geruestKarte;
    const ALLERG = /^[A-HLMNOPR]$/;
    if(!gk || typeof gk !== "object" || Array.isArray(gk)) F("geruestKarte muss ein Objekt sein");
    else {
      Object.keys(gk).forEach(k => {
        if(["speisekarte","getraenke","cocktails"].indexOf(k) < 0) F("geruestKarte." + k + ": nur speisekarte, getraenke, cocktails");
        else if(!Array.isArray(gk[k])) F("geruestKarte." + k + " muss eine Liste von Gruppen sein");
        else gk[k].forEach((gr, i) => {
          const wo = "geruestKarte." + k + "[" + i + "]";
          if(!gr || typeof gr.gruppe !== "string" || !gr.gruppe.trim() || !Array.isArray(gr.eintraege) || !gr.eintraege.length)
            return F(wo + ": gruppe und eintraege sind Pflicht");
          gr.eintraege.forEach((e, j) => {
            const w2 = wo + ".eintraege[" + j + "] " + ((e && e.n) || "");
            if(!e || typeof e.n !== "string" || !e.n.trim()) return F(w2 + ": n (Name) fehlt");
            /* positionen_pruefen liest alles ab „ (“ als Extras — mit Klammer
               im Namen fände der Server das Gericht nie. */
            if(e.n.indexOf(" (") >= 0) F(w2 + ": „ (“ im Namen — der Server läse den Rest als Extras");
            if(!/^\d{1,4},\d{2}$/.test(String(e.p || ""))) F(w2 + ": p als Preis „13,00“");
            if(e.a !== undefined && (!Array.isArray(e.a) || e.a.some(x => !ALLERG.test(x))))
              F(w2 + ": a nur Buchstaben aus dem Schlüssel A–R ohne I, J, K, Q (§6.3)");
          });
        });
      });
    }
  }

  /* Farben */
  const f = mb.farben || {};
  FARBEN_PFLICHT.forEach(k => {
    if(!f[k]) F("farben." + k + " fehlt");
    else if(!/^#[0-9a-fA-F]{6}$/.test(f[k]))
      F("farben." + k + " ist keine sechsstellige Hexfarbe: " + f[k]);
  });

  /* Abend */
  const a = mb.abend || {};
  if(a.an){
    if(typeof a.ab !== "number" || a.ab < 12 || a.ab > 23)
      F("abend.ab muss eine Stunde zwischen 12 und 23 sein, ist: " + a.ab);
    ["grund","flaeche","tinte","akzent"].forEach(k => {
      if(!a[k]) F("abend." + k + " fehlt, obwohl abend.an true ist");
    });
  }

  /* Form */
  const fo = mb.form || {};
  ["rundung","rundungKlein","rand"].forEach(k => {
    if(typeof fo[k] !== "number") F("form." + k + " fehlt oder ist keine Zahl");
  });
  if(fo.schatten && SCHATTEN.indexOf(fo.schatten) < 0)
    F("form.schatten unbekannt: " + fo.schatten + " — erlaubt: " + SCHATTEN.join(", "));

  /* Schrift */
  const s = mb.schrift || {};
  ["kopf","text"].forEach(k => {
    if(!s[k]) F("schrift." + k + " fehlt");
    else if(SCHRIFTEN.indexOf(s[k]) < 0)
      F("schrift." + k + " unbekannt: " + s[k] + " — erlaubt: " + SCHRIFTEN.join(", "));
  });
  /* zahl ist neu und deshalb freiwillig (§2.5): Ein Markenblatt von
     gestern muss weiter bauen. Steht aber etwas Falsches drin, ist
     das ein Fehler und kein stiller Rückfall — sonst bekäme der
     Kunde wortlos die Schreibmaschine, die er gerade abgewählt hat. */
  if(s.zahl && SCHRIFTEN.indexOf(s.zahl) < 0)
    F("schrift.zahl unbekannt: " + s.zahl + " — erlaubt: " + SCHRIFTEN.join(", "));
  if(s.groesse != null && (s.groesse < 0.9 || s.groesse > 1.2))
    F("schrift.groesse muss zwischen 0.9 und 1.2 liegen, ist: " + s.groesse);

  /* Kacheln — freiwillig (§2.5). Fehlt der Block, leitet der Hub die
     Liste aus bereiche ab; fehlt auch das, bleibt sein Platzhalter.
     Steht aber etwas Falsches drin, wird angehalten: Eine Kachel mit
     unbekanntem Schlüssel verschwindet sonst wortlos, und der Wirt
     sucht den Fehler bei sich. */
  if(mb.kacheln !== undefined){
    if(!Array.isArray(mb.kacheln)) F("kacheln muss eine Liste sein");
    else mb.kacheln.forEach((k, i) => {
      const wo = "kacheln[" + i + "]";
      if(!k || typeof k !== "object"){ F(wo + " ist kein Eintrag"); return; }
      if(!k.schluessel) F(wo + ".schluessel fehlt");
      else if(KACHELSCHLUESSEL.indexOf(k.schluessel) < 0)
        F(wo + ".schluessel unbekannt: " + k.schluessel +
          " — erlaubt: " + KACHELSCHLUESSEL.join(", "));
      if(k.titel !== undefined && typeof k.titel !== "string")
        F(wo + ".titel muss Text sein");
      if(k.icon !== undefined && ICONNAMEN.indexOf(k.icon) < 0)
        F(wo + ".icon unbekannt: " + k.icon + " — erlaubt: " + ICONNAMEN.join(", "));
      /* emoji ist ein FREIES Feld — also gehört eine Grenze daran.
         Zwei Zeichen reichen für jedes Emoji samt Variantenselektor;
         wer mehr hineinschreibt, meint keinen Bildschriftzeichen,
         sondern schiebt Text ins Symbolfeld. Gemessen wird in
         Codepunkten, nicht in Bytes: „👨‍🍳" sind drei. */
      if(k.emoji !== undefined && k.emoji !== ""){
        if(typeof k.emoji !== "string") F(wo + ".emoji muss Text sein");
        else if([...k.emoji].length > 4)
          F(wo + '.emoji ist zu lang: "' + k.emoji + '" — höchstens 4 Zeichen');
      }
      /* banner ist eine ADRESSE, und Adressen sind der Weg, auf dem
         fremder Code in eine Seite kommt. Deshalb nur https, nichts
         anderes: kein javascript:, kein data:, kein Pfad ins eigene
         Verzeichnis, den es beim Kunden gar nicht gibt. Der Hub prüft
         dasselbe noch einmal beim Zeichnen — zwei Schranken, damit
         keine davon allein trägt. */
      if(k.banner !== undefined && k.banner !== ""){
        if(typeof k.banner !== "string") F(wo + ".banner muss Text sein");
        else if(!/^https:\/\//i.test(k.banner))
          F(wo + '.banner muss mit https:// beginnen: "' + k.banner + '"');
      }
      /* iconAus ist ein echtes boolean-Feld. Eine Zeichenkette "false"
         wäre in JS wahr (!!"false" === true) und würde das Symbol
         genau umgekehrt zur Absicht abschalten — deshalb hier prüfen,
         nicht erst beim Zeichnen bemerken. */
      if(k.iconAus !== undefined && typeof k.iconAus !== "boolean")
        F(wo + ".iconAus muss true oder false sein");
      /* Breite, Bildform, Farbe: dieselben Listen wie KACHEL_WERTE im
         Hub. Der Hub fällt still zurück — hier wird angehalten, damit
         der Tippfehler nicht still verschwindet. */
      if(k.breite !== undefined && ["drittel","halb","voll"].indexOf(k.breite) < 0)
        F(wo + '.breite muss "drittel", "halb" oder "voll" sein');
      if(k.bildform !== undefined && ["seite","flaeche","rund"].indexOf(k.bildform) < 0)
        F(wo + '.bildform muss "seite", "flaeche" oder "rund" sein');
      if(k.grund !== undefined && k.grund !== "" && !/^#[0-9a-f]{6}$/i.test(String(k.grund)))
        F(wo + '.grund muss eine Farbe wie "#A83A2E" sein');
    });
    const doppelt = {};
    (Array.isArray(mb.kacheln) ? mb.kacheln : []).forEach(k => {
      if(!k || !k.schluessel) return;
      if(doppelt[k.schluessel]) F("kacheln: " + k.schluessel + " steht zweimal drin");
      doppelt[k.schluessel] = true;
    });
  }

  /* Bereiche */
  const ber = mb.bereiche || {};
  if(!Object.keys(ber).some(k => ber[k]))
    F("kein einziger Bereich eingeschaltet — der Gast sähe eine leere Startseite");

  /* ─── Inhalt des Hauses ─────────────────────────────────────
     Fehlt einer dieser Blöcke, zeigt der Hub den Platzhalter aus der
     Vorlage. Das ist kein Fehler — ein Haus ohne WLAN braucht kein
     WLAN —, aber es muss gesagt werden. Vorher standen diese Werte
     fest im Gerüst, und der zweite Kunde hätte die des ersten
     bekommen, ohne dass es irgendwo aufgefallen wäre. */
  if(!b.telefon && !b.mail) W("betrieb.telefon und betrieb.mail fehlen — die Kontaktseite bleibt leer");
  if(!b.strasse || !b.ort) W("betrieb.strasse oder betrieb.ort fehlt — keine Anschrift auf der Kontaktseite, kein Weg dorthin");
  if(!Array.isArray(mb.zeiten) || mb.zeiten.length !== 7)
    W("zeiten fehlt oder hat nicht sieben Einträge (Sonntag zuerst) — der Hub zeigt „—\"");
  if(!mb.links || !mb.links.bewertung)
    W("links.bewertung fehlt — die Kachel „Uns bewerten\" führt ins Leere");
  if(mb.bereiche && mb.bereiche.wlan && (!mb.wlan || !mb.wlan.netz))
    W("wlan ist eingeschaltet, aber wlan.netz fehlt");
  if(!Array.isArray(mb.empfehlung) || !mb.empfehlung.length)
    W("empfehlung fehlt — auf der Startseite steht dann keine");

  /* Das Quiz ist der einzige Bereich, dessen Inhalt NAMENTLICH auf
     ein Haus zeigt: Zwei der Fragen im Gerüst lauten „Seit wann gibt
     es Choco L'AMouR?" und „In welcher Stadt hat Choco L'AMouR
     zuerst eröffnet?". Wer den Bereich einschaltet und keine eigenen
     Fragen mitbringt, stellt seinen Gästen Fragen über ein fremdes
     Café. Das fällt beim Bauen niemandem auf — der Bereich ist ja
     gefüllt. Deshalb hier, laut. */
  /* Aber nicht für das Haus, ÜBER das die Fragen gehen — dort sind
     sie richtig. Eine Warnung, die auch dann kommt, wenn alles
     stimmt, bringt einem bei, Warnungen zu übergehen. */
  const QUIZ_HAUS = "Choco L'AMouR";
  if(mb.bereiche && mb.bereiche.quiz &&
     !(Array.isArray(mb.quiz) && mb.quiz.length) &&
     (b.name || "").trim() !== QUIZ_HAUS)
    W("quiz ist eingeschaltet, aber es fehlen eigene Fragen — der Hub " +
      "zeigt dann die Fragen aus dem Gerüst, und zwei davon handeln " +
      "namentlich von " + QUIZ_HAUS);
  if(mb.avatar && ["freundlich","ruhig","witzig"].indexOf(mb.avatar.art) < 0)
    F("avatar.art unbekannt: " + mb.avatar.art + " — erlaubt: freundlich, ruhig, witzig");
  /* Fehler, nicht Hinweis: Ein Tippfehler in figur ergäbe im Hub
     wortlos wieder den Untersetzer. Der Kunde hätte seine Figur
     ausgewählt und bekäme sie nicht — und niemand sagt es ihm. */
  if(mb.avatar && mb.avatar.figur !== undefined &&
     FIGURNAMEN.indexOf(mb.avatar.figur) < 0)
    F("avatar.figur unbekannt: " + mb.avatar.figur +
      " — erlaubt: " + FIGURNAMEN.join(", "));
  /* Derselbe Grund wie bei figur: ein Tippfehler bliebe wortlos beim
     Guss statt beim gewählten Schmuck. Fehlt kopfband ganz, bleibt es
     beim Guss — die Vorgabe für jedes bestehende Markenblatt. */
  if(mb.kopfband !== undefined && KOPFBAND_ARTEN.indexOf(mb.kopfband) < 0)
    F("kopfband unbekannt: " + mb.kopfband +
      " — erlaubt: " + KOPFBAND_ARTEN.join(", "));
  /* Derselbe Grund wie bei kopfband: ein Tippfehler bliebe wortlos
     ohne Zierrat. Fehlt zierrat ganz, bleibt der Hub wie bisher. */
  if(mb.zierrat !== undefined && ZIERRAT_ARTEN.indexOf(mb.zierrat) < 0)
    F("zierrat unbekannt: " + mb.zierrat +
      " — erlaubt: " + ZIERRAT_ARTEN.join(", "));
  /* Dieselbe Begründung wie bei zierrat: ein Tippfehler in thema
     bliebe wortlos ohne die neue Einfärbung. */
  /* Strikt boolean: Ein "false" in Anführungszeichen wäre im Hub
     kein boolean und fiele still auf „an" zurück — das Haus hätte
     abgeschaltet und sähe trotzdem Emojis. Lieber hier laut. */
  if(mb.bewegteZeichen !== undefined && typeof mb.bewegteZeichen !== "boolean")
    F("bewegteZeichen muss true oder false sein (ohne Anführungszeichen), steht: " +
      JSON.stringify(mb.bewegteZeichen));
  if(mb.thema !== undefined && THEMA_ARTEN.indexOf(mb.thema) < 0)
    F("thema unbekannt: " + mb.thema +
      " — erlaubt: " + THEMA_ARTEN.join(", "));
  /* Ein Tippfehler („Premium“, „premiun“) bliebe sonst wortlos beim alten Hub — der Kunde hätte umgestellt und sähe nichts. */
  if(mb.startstil !== undefined && STARTSTIL_ARTEN.indexOf(mb.startstil) < 0)
    F("startstil unbekannt: " + JSON.stringify(mb.startstil) +
      " — erlaubt: " + STARTSTIL_ARTEN.join(", "));
  /* Layout je Haus: jeder Tippfehler wäre sonst ein stiller Rückfall auf den Standard, und der Kunde sähe nichts. */
  if(mb.startlayout !== undefined){
    const sl = mb.startlayout;
    if(mb.startstil !== "premium")
      F("startlayout wirkt nur mit startstil \"premium\" — steht: " + JSON.stringify(mb.startstil));
    if(!sl || typeof sl !== "object" || Array.isArray(sl)) F("startlayout muss ein Objekt sein, steht: " + JSON.stringify(sl));
    else for(const [k, v] of Object.entries(sl)){
      if(k === "profil"){
        if(!Object.prototype.hasOwnProperty.call(LAYOUT_PROFILE, v))
          F("startlayout.profil unbekannt: " + JSON.stringify(v) + " — erlaubt: " + Object.keys(LAYOUT_PROFILE).join(", "));
      } else if(!Object.prototype.hasOwnProperty.call(LAYOUT_REGLER, k)){
        F("startlayout." + k + " gibt es nicht — erlaubt: profil, " + Object.keys(LAYOUT_REGLER).join(", "));
      } else if(LAYOUT_REGLER[k].indexOf(v) < 0){
        F("startlayout." + k + " unbekannt: " + JSON.stringify(v) + " — erlaubt: " + LAYOUT_REGLER[k].join(", "));
      }
    }
  }
  /* Dieselbe Begründung wie bei figur: Ein Tippfehler in haende
     ergäbe im Hub wortlos wieder die Vorgabe. Der Kunde hätte seine
     Pfanne gewählt und bekäme den Kuchenstapel. */
  if(mb.avatar && mb.avatar.haende !== undefined){
    if(typeof mb.avatar.haende !== "object" || Array.isArray(mb.avatar.haende))
      F("avatar.haende muss ein Objekt sein, z. B. " +
        '{"arbeit":"pfanne"} — ist: ' + JSON.stringify(mb.avatar.haende));
    else for(const [phase, ding] of Object.entries(mb.avatar.haende)){
      if(PHASENNAMEN.indexOf(phase) < 0)
        F("avatar.haende." + phase + " ist keine Bestellphase — erlaubt: " +
          PHASENNAMEN.join(", "));
      else if(REQUISITEN.indexOf(ding) < 0)
        F("avatar.haende." + phase + " unbekannt: " + ding +
          " — erlaubt: " + REQUISITEN.join(", "));
    }
  }

  /* Eigene Sätze des Hauses. Drei Dinge können schiefgehen, und jedes
     wäre im Hub still: ein Tippfehler im Schlüssel (der Satz erscheint
     nie), ein falscher Typ (die Seite zeigt „[object Object]"), und
     ein zu langer Satz (der Hub schneidet ab, und der Gastgeber sieht
     einen abgehackten Halbsatz). */
  if(mb.texte !== undefined){
    if(typeof mb.texte !== "object" || Array.isArray(mb.texte))
      F("texte muss ein Objekt sein, z. B. " +
        '{"phase":{"arbeit":"Wird gebacken"}} — ist: ' + JSON.stringify(mb.texte));
    else for(const [gruppe, satz] of Object.entries(mb.texte)){
      if(gruppe !== "phase" && gruppe !== "figur"){
        F("texte." + gruppe + " ist keine Gruppe — erlaubt: phase, figur");
        continue;
      }
      if(typeof satz !== "object" || Array.isArray(satz)){
        F("texte." + gruppe + " muss ein Objekt sein");
        continue;
      }
      const erlaubt = gruppe === "phase" ? PHASENNAMEN : FIGURANLAESSE;
      const mass = TEXTMASS_HAUS[gruppe === "phase" ? "phase" : "begleiter"];
      for(const [k, w] of Object.entries(satz)){
        if(erlaubt.indexOf(k) < 0)
          F("texte." + gruppe + "." + k + " ist kein Anlass — erlaubt: " +
            erlaubt.join(", "));
        else if(typeof w !== "string")
          F("texte." + gruppe + "." + k + " muss Text sein, ist: " + typeof w);
        else if(w.trim().length > mass.hart)
          F("texte." + gruppe + "." + k + " ist zu lang: " + w.trim().length +
            " Zeichen, erlaubt sind " + mass.hart + " — der Hub würde abschneiden");
        else if(w.trim().length > mass.gut)
          W("texte." + gruppe + "." + k + " ist " + w.trim().length +
            " Zeichen lang — ab " + mass.gut + " braucht der Satz auf " +
            "schmalen Telefonen eine Zeile mehr");
      }
    }
  }

  /* Impressum im Hub (18.10., § 5 DDG, dokumente/recht/07). Fehlende
     Angaben sind ein HINWEIS, kein Fehler: Ein Haus ohne sie soll
     erzeugt werden können — der Hub zeigt dann sichtbar „fehlt noch“
     statt still nichts. Nur Text, nichts anderes (§2.3a: der Hub setzt
     es als Text, aber ein Objekt hätte dort nichts zu suchen). */
  const RECHT_FELDER = ["firma","rechtsform","vertreten","register","ustid","wid","aufsicht","alessia"];
  if(mb.recht !== undefined){
    if(!mb.recht || typeof mb.recht !== "object" || Array.isArray(mb.recht)) F("recht muss ein Objekt sein");
    else Object.keys(mb.recht).forEach(k => {
      const w = mb.recht[k];
      if(!RECHT_FELDER.includes(k)) F("recht." + k + " ist unbekannt — erlaubt: " + RECHT_FELDER.join(", "));
      else if(k === "alessia" ? typeof w !== "boolean" : typeof w !== "string") F("recht." + k + " hat die falsche Art");
      else if(typeof w === "string" && w.length > 200) F("recht." + k + " ist länger als 200 Zeichen");
    });
  }
  const recht = (mb.recht && typeof mb.recht === "object") ? mb.recht : {};
  if(!String(recht.firma || "").trim())
    W("recht.firma fehlt — das Impressum im Hub nennt keinen Anbieter (§ 5 DDG)");
  if(/\b(GmbH|UG|AG|KG|OHG|GbR|e\.\s?K)/.test(String(recht.rechtsform || "") + " " + String(recht.firma || ""))
     && !String(recht.vertreten || "").trim())
    W("recht.vertreten fehlt — bei einer Gesellschaft muss das Impressum die Vertretung nennen");
  if(!String(b.mail || "").trim() || !String(b.strasse || "").trim())
    W("Impressum im Hub unvollständig: Anschrift und E-Mail sind Pflicht (§ 5 DDG)");

  /* Kontrast, Tag und Abend */
  const pruefePaare = (farben, wann) => {
    [
      ["Schrift auf Grund",       farben.tinte,      farben.grund],
      ["Nebentext auf Karte",     farben.tinteLeise, farben.flaeche],
      ["Schrift im Kopfband",     farben.bandText,   farben.band],
      ["Hauptfarbe auf Karte",    farben.akzent,     farben.flaeche]
    ].forEach(([name, v, g]) => {
      const k = kontrast(v, g);
      if(k === null) return;
      if(k < 4.5) W(wann + ": " + name + " liegt bei " + k.toFixed(1) + ":1 (4,5:1 wären lesbar)");
    });
  };
  pruefePaare(f, "Tag");
  if(a.an) pruefePaare(Object.assign({}, f, a), "Abend");

  return {fehler, warnung};
}

/* ─── Markenblatt als lesbaren Quelltext schreiben ────────────
   Von Hand gesetzt statt JSON.stringify: Der Block steht im
   Quelltext der Hub-Datei und soll dort auch von Hand
   nachgebessert werden können. Eine einzeilige JSON-Zeile kann
   das nicht. */
/* Text, der in einen <script>-Block wandert: JSON, das kein </script>, kein
   <!-- und keinen Zeilentrenner der Seite hineinträgt (Sicherheits-Sweep
   19.10.: ein Wert mit „</script><img onerror=…>“ im Markenblatt hätte den
   Block beendet). Für sonstige Werte bleibt die Ausgabe Zeichen für Zeichen
   gleich. */
const skriptJson = (w, ...r) => JSON.stringify(w, ...r)
  .replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--")
  .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

function alsQuelltext(mb){
  const z = (schl, wert, einzug) => {
    const w = typeof wert === "string" ? skriptJson(wert)
            : typeof wert === "boolean" ? String(wert)
            : typeof wert === "number"  ? String(wert)
            : skriptJson(wert);
    return einzug + (schl + ":").padEnd(15) + w + ",";
  };
  const block = (name, obj, reihenfolge) => {
    const schluessel = (reihenfolge || Object.keys(obj))
      .filter(k => obj[k] !== undefined);
    const zeilen = schluessel.map(k => z(k, obj[k], "    "));
    zeilen[zeilen.length-1] = zeilen[zeilen.length-1].replace(/,$/,"");
    return "  " + name + ": {\n" + zeilen.join("\n") + "\n  },";
  };

  const kopf =
"/* ═══ MARKENBLATT ═══════════════════════════════════════════\n" +
"   " + mb.betrieb.name + "\n" +
"\n" +
"   ERZEUGT — nicht von Hand bearbeiten.\n" +
"   Die Quelle ist betriebe.markenblatt in der Datenbank bzw.\n" +
"   markenblaetter/" + mb.betrieb.slug + ".json im Verzeichnis.\n" +
"   Änderungen hier gehen beim nächsten Erzeugen verloren.\n" +
"\n" +
"   Erzeugt am " + new Date().toISOString().slice(0,16).replace("T"," ") + "\n" +
"   ═════════════════════════════════════════════════════════ */\n";

  /* Listen und verschachtelte Blöcke: als JSON, aber lesbar eingerückt.
     Sie stehen in derselben Datei wie die Farben, also darf man sie
     auch nachschlagen können. */
  const liste = (name, wert) => {
    if(wert === undefined || wert === null) return null;
    const roh = skriptJson(wert, null, 2)
      .split("\n").map((z, i) => i === 0 ? z : "  " + z).join("\n");
    return "  " + name + ": " + roh + ",";
  };

  const teile = [
    block("betrieb",  mb.betrieb,  ["name","claim","begruessung","strasse","ort",
                                    "telefon","mail","slug"]),
    block("farben",   mb.farben,   FARBEN_PFLICHT.concat(["akzentFlaeche","akzent2Flaeche","gutFlaeche"])),
    block("abend",    mb.abend,    ["an","ab","grund","flaeche","flaeche2","band","tinte",
                                    "tinteLeise","tinteStill","linie","linieStark",
                                    "akzent","akzent2","gut","akzentFlaeche","akzent2Flaeche","gutFlaeche"]),
    block("form",     mb.form,     ["rundung","rundungKlein","rand","schatten"]),
    block("schrift",  mb.schrift,  ["kopf","text","zahl","groesse"]),
    block("logo",     mb.logo,     ["art","text","bild","hoehe"]),
    block("bereiche", mb.bereiche, null),

    /* Ab hier der Inhalt des Hauses. Fehlt ein Block, bleibt im Hub
       der Platzhalter aus der Vorlage stehen — deshalb wird er auch
       nicht leer geschrieben, sondern weggelassen. */
    mb.avatar    ? block("avatar", mb.avatar, ["figur","art","name"]) : null,
    mb.kopfband  ? liste("kopfband", mb.kopfband) : null,
    mb.zierrat   ? liste("zierrat", mb.zierrat) : null,
    mb.thema     ? liste("thema", mb.thema) : null,
    mb.startstil ? liste("startstil", mb.startstil) : null,
    mb.startlayout ? block("startlayout", mb.startlayout, ["profil"].concat(Object.keys(LAYOUT_REGLER))) : null,
    /* false ist ein Wert, kein Fehlen: typeof statt Wahrheitswert,
       sonst verschwände genau das Abschalten. */
    typeof mb.bewegteZeichen === "boolean" ? liste("bewegteZeichen", mb.bewegteZeichen) : null,
    liste("zeiten",     mb.zeiten),
    mb.links     ? block("links",     mb.links,     null) : null,
    mb.wlan      ? block("wlan",      mb.wlan,      null) : null,
    mb.trinkgeld ? liste("trinkgeld", mb.trinkgeld)       : null,
    mb.recht     ? liste("recht",     mb.recht)           : null,
    liste("kacheln",    mb.kacheln),
    liste("empfehlung", mb.empfehlung),
    liste("quiz",       mb.quiz),
    mb.demo ? liste("demo", mb.demo) : null
  ].filter(Boolean);
  teile[teile.length-1] = teile[teile.length-1].replace(/,$/,"");

  return kopf + "const MARKENBLATT = {\n  version: 1,\n\n" + teile.join("\n\n") + "\n};\n";
}

/* ─── Das Siegel des Hauses ───────────────────────────────────────
   Bis zum 30.08. stand Chocos gezeichnetes Siegel fest im Gerüst und
   damit in JEDEM erzeugten Hub. „Blend" bekam einen Kopf, in dem
   „Choco L'AMouR · Estd. 2023" steht.

   Drei Wege, in dieser Reihenfolge:

     logo.svg   → wird unverändert übernommen. Für gezeichnete
                  Siegel wie Chocos. Eine Ausnahme, die man
                  ausdrücklich einträgt.
     logo.bild  → eine Bilddatei, wie bisher vorgesehen.
     sonst      → gezeichnet aus Name und Farben des Hauses.

   Die Schriftfarbe im Siegel wird GERECHNET, nicht gesetzt: Auf der
   Bar-Palette mit hellem Säuregrün wäre weiße Schrift 1,16:1
   (CLAUDE.md §5.1). Der Kunde bekommt seine Farbe, der Gast bekommt
   Lesbarkeit. */
function helligkeit(hex){
  const h = String(hex || "#000000").replace("#","");
  const v = h.length === 3 ? h.split("").map(z => z+z).join("") : h;
  const c = [0,2,4].map(i => {
    const x = parseInt(v.substr(i,2),16)/255;
    return x <= .03928 ? x/12.92 : Math.pow((x+.055)/1.055, 2.4);
  });
  return .2126*c[0] + .7152*c[1] + .0722*c[2];
}
function kontrast(a, b){
  const x = helligkeit(a), y = helligkeit(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
function aufFarbe(grund, hell, dunkel){
  return kontrast(hell, grund) >= 4.5 ? hell : dunkel;
}

/* Der Name im Siegel. Ein Kreis fasst nicht beliebig viel: Zwei
   Zeilen à höchstens 13 Zeichen sind das, was bei 58px Anzeigegröße
   noch lesbar bleibt. Was länger ist, wird an einem Leerzeichen
   umgebrochen und sonst gekürzt — abgeschnitten mitten im Wort
   sieht nach Fehler aus, gekürzt mit Punkt nach Absicht. */
function siegelZeilen(name){
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if(!w.length) return ["", ""];
  if(w.length === 1) return [w[0].slice(0,15), ""];
  /* An der Stelle trennen, die beide Hälften am ähnlichsten macht */
  let besteI = 1, besteAbw = Infinity;
  for(let i = 1; i < w.length; i++){
    const a = w.slice(0,i).join(" ").length, b = w.slice(i).join(" ").length;
    if(Math.abs(a-b) < besteAbw){ besteAbw = Math.abs(a-b); besteI = i; }
  }
  const kurz = t => t.length > 15 ? t.slice(0,14) + "…" : t;
  return [kurz(w.slice(0,besteI).join(" ")), kurz(w.slice(besteI).join(" "))];
}

function siegelSVG(mb){
  const h = t => String(t == null ? "" : t).replace(/[&<>"']/g, z =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[z]));
  const logo = mb.logo || {};
  const name = mb.betrieb.name || "";

  if(logo.svg) return String(logo.svg);

  if(logo.art === "bild" && logo.bild){
    return '<img src="' + h(logo.bild) + '" alt="' + h(name) + '" ' +
           'width="88" height="88" style="border-radius:50%;object-fit:cover">';
  }

  const f      = mb.farben || {};
  const ring   = f.band   || "#123029";
  const kern   = f.grund  || "#F4F0E4";
  const akzent = f.akzent || ring;
  /* Schrift auf dem Kern, Zierstrich in der Akzentfarbe — beide
     gegen den Kern gerechnet, nicht gegen den Ring. */
  const tinte  = aufFarbe(kern, "#FFFFFF", f.tinte || "#16150F");
  const zier   = kontrast(akzent, kern) >= 3 ? akzent : tinte;
  const [oben, unten] = siegelZeilen(name);
  const kopf   = (mb.schrift && mb.schrift.kopf) === "serif"
    ? "Georgia,serif" : "system-ui,-apple-system,Helvetica,Arial,sans-serif";

  /* Dieselbe Bauart wie das gezeichnete Siegel: Ring, Kern,
     Goldrand, Wölbung. Nur die Zeichnung ist ersetzt, nicht die
     Gestalt — sonst sähe ein neuer Kunde aus wie ein Provisorium
     neben einem fertigen. */
  return '<svg viewBox="0 0 100 100" width="88" height="88" aria-label="' + h(name) + '">' +
    '<defs><radialGradient id="siegelWoelbung" cx="34%" cy="26%" r="78%">' +
      '<stop offset="0%" stop-color="#FFFFFF" stop-opacity=".55"/>' +
      '<stop offset="52%" stop-color="#FFFFFF" stop-opacity="0"/>' +
      '<stop offset="100%" stop-color="#2A1A14" stop-opacity=".16"/>' +
    '</radialGradient></defs>' +
    '<circle cx="50" cy="50" r="48" fill="' + h(ring) + '"/>' +
    '<circle cx="50" cy="50" r="33" fill="' + h(kern) + '"/>' +
    '<circle cx="50" cy="50" r="33" fill="none" stroke="' + h(zier) +
      '" stroke-opacity=".38" stroke-width=".9"/>' +
    (unten
      ? '<text x="50" y="47" text-anchor="middle" font-family="' + kopf + '" ' +
          'font-size="13" font-weight="700" fill="' + h(tinte) + '">' + h(oben) + '</text>' +
        '<text x="50" y="62" text-anchor="middle" font-family="' + kopf + '" ' +
          'font-size="13" font-weight="700" fill="' + h(tinte) + '">' + h(unten) + '</text>'
      : '<text x="50" y="56" text-anchor="middle" font-family="' + kopf + '" ' +
          'font-size="15" font-weight="700" fill="' + h(tinte) + '">' + h(oben) + '</text>') +
    '<circle cx="50" cy="50" r="49" fill="url(#siegelWoelbung)"/>' +
  '</svg>';
}

/* ─── Erzeugen ────────────────────────────────────────────────── */
function erzeuge(slug, nurPruefen){
  const pfad = path.join(BLAETTER, slug + ".json");
  if(!fs.existsSync(pfad)) throw new Error("Kein Markenblatt: " + pfad);

  const mb = JSON.parse(fs.readFileSync(pfad, "utf8"));
  if(mb.betrieb && mb.betrieb.slug && mb.betrieb.slug !== slug)
    throw new Error("slug im Markenblatt (" + mb.betrieb.slug + ") passt nicht zum Dateinamen (" + slug + ")");

  const {fehler, warnung} = pruefeMarkenblatt(mb);

  console.log("\n── " + slug + " ──");
  warnung.forEach(w => console.log("   Hinweis: " + w));
  fehler.forEach(f  => console.log("   FEHLER:  " + f));

  if(fehler.length){
    console.log("   → nicht erzeugt (" + fehler.length + " Fehler)");
    return false;
  }
  if(nurPruefen){
    console.log("   → geprüft, nichts geschrieben" + (warnung.length ? " (" + warnung.length + " Hinweise)" : ""));
    return true;
  }

  let vorlage = fs.readFileSync(VORLAGE, "utf8");
  if(!vorlage.includes("/*{{MARKENBLATT}}*/"))
    throw new Error("Die Vorlage hat keinen Platzhalter /*{{MARKENBLATT}}*/");

  let aus = vorlage.replace("/*{{MARKENBLATT}}*/", alsQuelltext(mb));

  /* Der Dateikopf nannte fest den ERSTEN Kunden mitsamt Strasse. In
     jedem erzeugten Hub, also auch in denen der anderen. Das ist
     keine Kosmetik: Wer die Datei aufmacht — der Kunde selbst, ein
     Entwickler, ein Betriebspruefer — liest dort den Namen eines
     fremden Betriebs.

     Die Kommentare, die einen Vorfall dokumentieren ("gemessen:
     Choco 2,02:1"), bleiben ausdruecklich stehen. Sie sind das
     Gedaechtnis des Projekts, und sie nennen die Haeuser, WEIL der
     Vorfall dort passiert ist. Der Unterschied ist: Das hier ist
     eine ANGABE ueber den Kunden, jene sind Notizen ueber uns. */
  const b2 = mb.betrieb || {};
  aus = aus.replace("{{KUNDE}}",
    [b2.name, b2.strasse, b2.ort].filter(Boolean).join(", ") || (b2.slug || "—"));

  /* Kopfangaben mitziehen. Der Titel steht im Browserreiter und im
     geteilten Link — er ist das Erste, was der Gast vom Haus sieht. */
  const h = t => String(t||"").replace(/[&<>"]/g, z =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[z]));
  const titel = mb.betrieb.name + (mb.betrieb.ort ? " · " + mb.betrieb.ort : "");
  aus = aus.replace(/<title>[\s\S]*?<\/title>/, "<title>" + h(titel) + "</title>");
  aus = aus.replace(/(<meta name="description" content=")[^"]*(")/,
    "$1" + h(mb.betrieb.claim || mb.betrieb.name) + "$2");
  aus = aus.replace(/(<meta name="theme-color" content=")[^"]*(")/,
    "$1" + (mb.farben.band) + "$2");
  /* Das Farbschema für den ERSTEN Anstrich, bevor ein Skript läuft.
     Danach zieht nachtSchalten() es nach. Ohne diese Zeile stünde bei
     jedem Kunden „light" — und Blend ist schon am Tag fast schwarz
     (grund #0B0C0F). Ein falsch angesagtes Schema ist schlimmer als
     keins: Der Browser richtet Bedienelemente und Rollbalken danach.
     0,179 ist der Punkt aus der sRGB-Rechnung, an dem Schwarz und
     Weiß gleich gut auf einem Grund stehen. */
  /* "only" davor: Samsung Internet und Chrome auf Android haben ein
     eigenes "dunkles Design fuer Webseiten", das eine blosse "light"/
     "dark"-Ansage als Vorschlag liest und trotzdem selbst umfaerbt —
     verblasste, ausgewaschene Farben, gemeldet vom Betreiber. "only"
     ist die ausdrueckliche Absage daran (CSS Color Adjustment,
     `color-scheme: only light`). Gilt fuers Meta UND fuer den CSS-
     Ruckfall in :root — beide muessen denselben Wert tragen, sonst
     widerspricht die Ansage sich selbst. */
  const schema = helligkeit(mb.farben.grund) < 0.179 ? "only dark" : "only light";
  if(!/<meta name="color-scheme" content="[^"]*">/.test(aus))
    throw new Error('Die Vorlage hat kein <meta name="color-scheme"> im Kopf');
  aus = aus.replace(/(<meta name="color-scheme" content=")[^"]*(")/,
    "$1" + schema + "$2");
  /* NICHT einfach /color-scheme:.../ — das faengt auch das "color-
     scheme:" IN "prefers-color-scheme:" der theme-color-Metas zwei
     Zeilen darueber. Erster Versuch tat genau das und riss beim
     Ersetzen bis zum naechsten Semikolon alles dazwischen heraus,
     samt dem echten <meta name="color-scheme">. Das negative
     Lookbehind schliesst "prefers-" davor aus. */
  if(!/(?<!prefers-)color-scheme:[^;]*;/.test(aus))
    throw new Error('Die Vorlage hat keinen CSS-Ruckfall :root{color-scheme:...} mehr');
  aus = aus.replace(/(?<!prefers-)color-scheme:[^;]*;/, "color-scheme:" + schema + ";");

  /* Der Vorführblock fliegt raus, wenn ihn niemand bestellt hat.

     Im Gerüst stand jahrelang „Vor dem Livegang diesen Block
     löschen" — als Bitte an einen Menschen, der sie irgendwann
     übersieht. Eine Bitte im Kommentar ist keine Regel; der
     Erzeuger ist eine. */
  const VORF = /<!--\{\{VORFUEHRUNG\}\}[\s\S]*?<!--\{\{\/VORFUEHRUNG\}\}-->/;
  if(!VORF.test(aus))
    throw new Error("Die Vorlage hat keine VORFUEHRUNG-Marke ({{VORFUEHRUNG}} … {{/VORFUEHRUNG}})");
  if(mb.vorfuehrung === true){
    console.log("   Hinweis: VORFÜHRBLOCK BLEIBT DRIN — dieser Hub gehört " +
                "nicht vor echte Gäste.");
  } else {
    aus = aus.replace(VORF, "");
  }

  const GERUEST_KARTE = /\/\*\{\{KARTE_GERUEST\}\}[\s\S]*?\/\*\{\{\/KARTE_GERUEST\}\}\*\//;
  if(!GERUEST_KARTE.test(aus))
    throw new Error("Die Vorlage hat keine KARTE_GERUEST-Marke ({{KARTE_GERUEST}} … {{/KARTE_GERUEST}})");
  if(mb.geruestKarte){
    /* a (Allergene) gehen nach INHALTSSTOFFE, wie die Datenbank es live tut. */
    const stoffe = {};
    const karte = k => (mb.geruestKarte[k] || []).map(gr => {
      const g = { gruppe:gr.gruppe, eintraege:gr.eintraege.map(e => {
        const x = { n:e.n, b:e.b || "", p:e.p };
        ["veg","vegan","top"].forEach(f => { if(e[f] === true) x[f] = true; });
        if(Array.isArray(e.opt) && e.opt.length) x.opt = e.opt.slice();
        if(Array.isArray(e.a) && e.a.length) stoffe[e.n] = { a:e.a.slice(), z:[] };
        return x;
      }) };
      if(gr.zeichen) g.zeichen = gr.zeichen;
      return g;
    });
    aus = aus.replace(GERUEST_KARTE, () => "/* geruestKarte aus dem Markenblatt (erzeuge-hub.js) */\n" +
      "let SPEISEKARTE = " + skriptJson(karte("speisekarte")) + ";\n" +
      "let GETRAENKE = " + skriptJson(karte("getraenke")) + ";\n" +
      "let COCKTAILS = " + skriptJson(karte("cocktails")) + ";\n" +
      "Object.assign(INHALTSSTOFFE, " + skriptJson(stoffe) + ");");
  }

  /* Das Vorführhaus läuft immer vorgeführt (siehe Prüfung oben). Der
     Schalter steht VOR dem Abfangen im ersten Skriptblock; jedes andere
     Haus bekommt an dieser Stelle nichts. */
  if(!aus.includes("/*{{DEMO_SCHALTER}}*/"))
    throw new Error("Die Vorlage hat keinen Platzhalter /*{{DEMO_SCHALTER}}*/");
  aus = aus.replace("/*{{DEMO_SCHALTER}}*/", mb.demo ? "window.OMOTENO_DEMO = true;" : "");

  /* Das Siegel. Der Bereich zwischen den Marken wird ersetzt — nicht
     das SVG gesucht, denn davon gibt es im Hub dutzende. */
  const LOGO_MARKE = /<!--\{\{LOGO\}\}[\s\S]*?<!--\{\{\/LOGO\}\}-->/;
  if(!LOGO_MARKE.test(aus))
    throw new Error("Die Vorlage hat keine LOGO-Marke ({{LOGO}} … {{/LOGO}})");
  aus = aus.replace(LOGO_MARKE, () => siegelSVG(mb));

  /* ═══════════════════════════════════════════════════════════════
     KEIN FREMDER HAUSNAME IN DIESER DATEI

     VORFALL. Der Slug stand an drei Stellen fest im Geruest. Blends
     Hub trug „chocolamour" in SERVER.betrieb und OMOTENO_DB.slug —
     er fragte also Chocos Betrieb ab, bekam Chocos id, und haette
     jede Blend-Bestellung auf Chocos Betrieb geschrieben. Dazu fuenf
     Speicherschluessel und drei E-Mail-Adressen.

     Keine Pruefung konnte es sehen: Bei Choco war jeder dieser Werte
     RICHTIG. Ein Test mit einem Kunden sieht jede eingebrannte
     Fremdangabe fuer richtig an (§8.1a).

     Deshalb hier eine ZWEITE QUELLE (§8.1b): nicht der Inhalt der
     Datei gegen sich selbst, sondern gegen die LISTE ALLER HAEUSER.
     Taucht der Name eines anderen Hauses auf, entsteht die Datei
     nicht. Das faengt auch jede kuenftige eingebrannte Angabe, nicht
     nur die drei bekannten.

     Ein Slug, der Teil eines anderen ist („blend" in „blendwerk"),
     wuerde falsch anschlagen — deshalb wird auf Wortgrenzen geprueft.
     ═══════════════════════════════════════════════════════════════ */
  const andereHaeuser = fs.readdirSync(BLAETTER)
    .filter(d => d.endsWith(".json"))
    .filter(d => d.slice(0, -5) !== slug && istMarkenblatt(path.join(BLAETTER, d)))
    .map(d => d.slice(0, -5));

  const fremd = andereHaeuser.filter(f =>
    new RegExp("(^|[^a-z0-9-])" + f.replace(/[-]/g, "\\-") + "([^a-z0-9-]|$)")
      .test(aus));

  if(fremd.length){
    /* Die Zeilen mitnennen. „Irgendwo steht ein fremder Name" ist
       eine Meldung, die man nicht abarbeiten kann. */
    const zeilen = aus.split("\n");
    const treffer = [];
    fremd.forEach(f => {
      const re = new RegExp("(^|[^a-z0-9-])" + f + "([^a-z0-9-]|$)");
      zeilen.forEach((z, i) => {
        if(re.test(z) && treffer.length < 12)
          treffer.push("     " + (i+1) + ": " + z.trim().slice(0, 90));
      });
    });
    throw new Error(
      "In dist/" + slug + " steht der Name eines ANDEREN Hauses: " +
      fremd.join(", ") + "\n" +
      "   Das ist der Fehler aus §8.1a. Der Wert gehoert ins Markenblatt\n" +
      "   oder wird aus HAUS abgeleitet, nicht ins Geruest geschrieben.\n" +
      treffer.join("\n"));
  }

  /* Kommentare raus (erzeuger/kompakt.js): rund ein Viertel weniger Bytes auf der Leitung. Erst NACH den Prüfungen
     oben — sie sehen den vollen Text. OMOTENO_OHNE_KOMPAKT=1 liefert die Datei mit Kommentaren (für Gegenbeweise). */
  if(process.env.OMOTENO_OHNE_KOMPAKT !== "1"){
    const k = kompaktHtml(aus, m => console.log("   ⚠ " + slug + ": " + m));
    aus = k.html;
    console.log("   kompakt: Skript und Stil " + Math.round(k.vorher / 1024) + " → " + Math.round(k.nachher / 1024) + " KB");
  }

  const ordner = path.join(ZIEL, slug);
  fs.mkdirSync(ordner, {recursive:true});
  fs.writeFileSync(path.join(ordner, "index.html"), aus);

  console.log("   → dist/" + slug + "/index.html  (" +
    aus.split("\n").length + " Zeilen" +
    (warnung.length ? ", " + warnung.length + " Hinweise" : "") + ")");
  return true;
}

/* ─── Aufruf ──────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const nurPruefen = args.includes("--pruefen-nur");
/* Im flachen Verzeichnis liegen neben den Markenblättern auch andere
   JSON-Dateien. „--alle" nimmt deshalb nur, was wirklich eins ist:
   ein Objekt mit version und farben. Ohne diese Prüfung meldete der
   Erzeuger für jede fremde JSON-Datei einen Fehler — und eine
   Prüfung mit Fehlalarmen bringt einem bei, sie zu übergehen. */
function istMarkenblatt(pfad){
  try{
    const j = JSON.parse(fs.readFileSync(pfad, "utf8"));
    return !!(j && typeof j === "object" && "version" in j && "farben" in j);
  }catch(e){ return false; }
}
const slugs = args.includes("--alle")
  ? fs.readdirSync(BLAETTER)
      .filter(f => f.endsWith(".json") && istMarkenblatt(path.join(BLAETTER, f)))
      .map(f => f.slice(0,-5))
  : args.filter(a => !a.startsWith("--"));

if(!slugs.length){
  console.log("Aufruf: node erzeuger/erzeuge-hub.js <slug> [--pruefen-nur]");
  console.log("        node erzeuger/erzeuge-hub.js --alle");
  process.exit(1);
}

let fehlgeschlagen = 0;
slugs.forEach(s => { try { if(!erzeuge(s, nurPruefen)) fehlgeschlagen++; }
                     catch(e){ console.log("\n── " + s + " ──\n   FEHLER: " + e.message); fehlgeschlagen++; } });

console.log("\n" + (slugs.length - fehlgeschlagen) + " von " + slugs.length + " erledigt.\n");
process.exit(fehlgeschlagen ? 1 : 0);
