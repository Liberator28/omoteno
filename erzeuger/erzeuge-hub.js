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
const ZIEL     = path.join(WURZEL, "dist");

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
/* Was die Figur je Bestellphase tragen kann, und welche Phasen es
   gibt — beides aus dem Gerüst, aus demselben Grund wie oben. */
const REQUISITEN       = ausGeruest(/const E_REQUISITEN = \{([\s\S]*?)\n\};/, "E_REQUISITEN");
const PHASENNAMEN      = ausGeruest(/const PHASEN = \{([\s\S]*?)\n\};/, "PHASEN");

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
function alsQuelltext(mb){
  const z = (schl, wert, einzug) => {
    const w = typeof wert === "string" ? '"' + wert.replace(/"/g,'\\"') + '"'
            : typeof wert === "boolean" ? String(wert)
            : typeof wert === "number"  ? String(wert)
            : JSON.stringify(wert);
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
    const roh = JSON.stringify(wert, null, 2)
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
    liste("zeiten",     mb.zeiten),
    mb.links     ? block("links",     mb.links,     null) : null,
    mb.wlan      ? block("wlan",      mb.wlan,      null) : null,
    mb.trinkgeld ? liste("trinkgeld", mb.trinkgeld)       : null,
    liste("kacheln",    mb.kacheln),
    liste("empfehlung", mb.empfehlung),
    liste("quiz",       mb.quiz)
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
  const schema = helligkeit(mb.farben.grund) < 0.179 ? "dark" : "light";
  if(!/<meta name="color-scheme" content="[^"]*">/.test(aus))
    throw new Error('Die Vorlage hat kein <meta name="color-scheme"> im Kopf');
  aus = aus.replace(/(<meta name="color-scheme" content=")[^"]*(")/,
    "$1" + schema + "$2");

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

  /* Das Siegel. Der Bereich zwischen den Marken wird ersetzt — nicht
     das SVG gesucht, denn davon gibt es im Hub dutzende. */
  const LOGO_MARKE = /<!--\{\{LOGO\}\}[\s\S]*?<!--\{\{\/LOGO\}\}-->/;
  if(!LOGO_MARKE.test(aus))
    throw new Error("Die Vorlage hat keine LOGO-Marke ({{LOGO}} … {{/LOGO}})");
  aus = aus.replace(LOGO_MARKE, () => siegelSVG(mb));

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
