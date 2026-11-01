#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   ERZEUGE-NEWSLETTER-VORLAGE

   Baut aus einem Markenblatt eine gebrandete HTML-E-Mail-Vorlage
   für den Klaviyo-Gäste-Newsletter — nach demselben Muster wie
   erzeuge-hub.js: Ein Markenblatt, eine erzeugte Datei, nichts von
   Hand doppelt gepflegt.

       node erzeuger/erzeuge-newsletter-vorlage.js chocolamour
       node erzeuger/erzeuge-newsletter-vorlage.js --alle
       node erzeuger/erzeuge-newsletter-vorlage.js --alle --art rueckholung
       node erzeuger/erzeuge-newsletter-vorlage.js --alle --variante kampagne   (klassisch | kampagne | liefer | edel)

   Zwei Arten:
     gutschein   (Vorgabe) → dist-newsletter/<slug>.html
                 Willkommen in der Liste, mit einem Code aus dem Vorrat.
     rueckholung → dist-newsletter/<slug>-rueckholung.html
                 „Wir vermissen Sie“ — für den Flow, der 20 Tage nach
                 omoteno_<slug>_letzter_besuch auslöst (migration-klaviyo-
                 besuch.sql setzt diese Eigenschaft bei jedem Besuch und jeder
                 Bestellung). Nennt das Lieblingsgericht, falls bekannt.

   Der Upload zu Klaviyo läuft NICHT von hier aus — dieses Skript hat
   keinen Klaviyo-Schlüssel und soll auch keinen brauchen. Hochgeladen
   wird über das Klaviyo-Werkzeug (create/update_email_template) oder in
   Klaviyo unter Content → Templates → „Code your own“.

   WARUM KEIN HOCHGELADENES LOGO. Kein Betrieb in diesem Verzeichnis
   hat ein logo.bild gesetzt — nur logo.svg (Inline-SVG, ungeeignet
   für E-Mail-Clients, die SVG meist nicht darstellen) oder gar
   nichts. Der Kopf der Vorlage benutzt deshalb denselben Rückfall
   wie der Hub selbst: Name in der Bandfarbe, keine Bildquelle.

   DER CODE. Früher stand hier {{ event.discount_code }} — in einem
   Flow, der an einer Liste oder einem Datum hängt, gibt es aber kein
   Ereignis, der Platz wäre leer geblieben. Jetzt Klaviyos Tag für
   hochgeladene Codes: {% coupon_code '<slug>_newsletter' %} — er zieht
   beim Versand einen freien Code aus dem Vorrat dieses Betriebs (den
   „Vorrat auffüllen“ im Board befüllt). Ist der Vorrat leer, schickt
   Klaviyo die Mail nicht ab — deshalb vor dem Live-Schalten in der
   Klaviyo-Vorschau einen echten Code sehen.

   PERSÖNLICH. {{ person|lookup:'omoteno_<slug>_liebling' }} steht nur
   in einem {% if %} — ohne bekanntes Lieblingsgericht fällt der Satz
   ganz weg, statt mit einer Lücke dazustehen.
   ═══════════════════════════════════════════════════════════════ */
"use strict";

const fs   = require("fs");
const path = require("path");

const HIER     = __dirname;
const OBEN     = path.resolve(__dirname, "..");
const nimm     = (...kandidaten) => kandidaten.find(p => fs.existsSync(p)) || kandidaten[0];
const BLAETTER = nimm(path.join(OBEN, "markenblaetter"), HIER);
const WURZEL   = fs.existsSync(path.join(OBEN, "markenblaetter")) ? OBEN : HIER;
const ZIEL     = path.join(WURZEL, "dist-newsletter");

/* Die Vorlagen selbst stehen seit 01.11. in newsletter-varianten.js — dieselbe Stelle, die das Board für Vorschau und
   „Übernehmen“ benutzt (geteilter Block NEWSLETTER-VARIANTEN). „klassisch“ ist Zeichen für Zeichen die frühere Vorlage. */
const NEWSLETTER = require("./newsletter-varianten.js");

function einen(slug, art, variante){
  const pfad = path.join(BLAETTER, slug + ".json");
  if(!fs.existsSync(pfad)){
    console.log("  Markenblatt fehlt: " + pfad);
    return false;
  }
  const m = JSON.parse(fs.readFileSync(pfad, "utf8"));
  const gerichte = (m.demo && Array.isArray(m.demo.gerichte)) ? m.demo.gerichte : [];
  const html = NEWSLETTER.bauen(m, slug, art, variante, gerichte);
  fs.mkdirSync(ZIEL, { recursive: true });
  const ausgabe = path.join(ZIEL, slug + (variante && variante !== "klassisch" ? "-" + variante : "") + (art === "rueckholung" ? "-rueckholung" : "") + ".html");
  fs.writeFileSync(ausgabe, html, "utf8");
  console.log("  → " + path.relative(WURZEL, ausgabe) + "  (" + html.length + " Zeichen)");
  return true;
}

(function(){
  const arg = process.argv[2];
  const i = process.argv.indexOf("--art");
  const art = i > 0 ? process.argv[i + 1] : "gutschein";
  const iv = process.argv.indexOf("--variante");
  const variante = iv > 0 ? process.argv[iv + 1] : "klassisch";
  if(NEWSLETTER.varianteSauber(variante) !== variante){
    console.log("Unbekannte Variante: " + variante + " (" + NEWSLETTER.VARIANTEN.map(v => v.id).join(" | ") + ")");
    process.exit(1);
  }
  if(!["gutschein", "rueckholung"].includes(art)){
    console.log("Unbekannte Art: " + art + " (gutschein | rueckholung)");
    process.exit(1);
  }
  if(!arg){
    console.log("Aufruf: node erzeuger/erzeuge-newsletter-vorlage.js <slug>|--alle [--art gutschein|rueckholung]");
    process.exit(1);
  }
  if(arg === "--alle"){
    const namen = fs.readdirSync(BLAETTER).filter(n => n.endsWith(".json")).map(n => n.slice(0, -5));
    let n = 0;
    for(const slug of namen){
      console.log("── " + slug + " ──");
      if(einen(slug, art, variante)) n++;
    }
    console.log(`\n${n} von ${namen.length} erzeugt.`);
  }else{
    einen(arg, art, variante);
  }
})();
