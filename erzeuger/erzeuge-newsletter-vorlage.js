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

function vorlageBauen(m, slug, art){
  const b = m.betrieb || {};
  const f = m.farben  || {};
  const rundung = (m.form && m.form.rundung) || 16;

  const logoBlock = (m.logo && m.logo.art === "bild" && m.logo.bild)
    ? `<img src="${esc(m.logo.bild)}" alt="${esc(b.name || "")}" width="120" style="display:block;margin:0 auto;max-width:160px;height:auto">`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;
        letter-spacing:.02em;color:${esc(f.bandText || "#FFFFFF")};text-align:center">${esc(b.name || "")}</div>`;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(b.name || "Newsletter")}</title>
</head>
<body style="margin:0;padding:0;background:${esc(f.grund || "#F5F3F0")};
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${esc(f.grund || "#F5F3F0")}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:${esc(f.flaeche || "#FFFFFF")};
    border-radius:${rundung}px;overflow:hidden">

<tr><td style="background:${esc(f.band || "#2A1A14")};padding:28px 24px">
${logoBlock}
</td></tr>

${art === "rueckholung" ? rueckholungInhalt(m, slug) : gutscheinInhalt(m, slug)}
<tr><td style="background:${esc(f.flaeche2 || "#F4EBE3")};padding:16px 28px;text-align:center">
<p style="margin:0;font-size:11.5px;line-height:1.5;color:${esc(leise(f, f.flaeche2 || "#F4EBE3"))}">
${esc(b.name || "")}${b.ort ? " · " + esc(b.ort) : ""}<br>
{% unsubscribe 'Abmelden' %}
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
`;
}

/* Ein Code aus dem Vorrat des Betriebs — derselbe Kasten in beiden Arten. */
function codeKasten(m, slug){
  const f = m.farben || {};
  const rundung = (m.form && m.form.rundung) || 16;
  return `<tr><td style="padding:0 28px 28px">
<table role="presentation" width="100%" style="background:${esc(f.flaeche2 || "#F4EBE3")};
    border:1px dashed ${esc(f.akzent || "#C8202E")};border-radius:${Math.max(rundung - 4, 8)}px">
<tr><td align="center" style="padding:22px 16px">
<div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;
    letter-spacing:.08em;color:${esc(f.akzent || "#C8202E")}">
{% coupon_code '${slug}_newsletter' %}
</div>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:0 28px 32px">
<p style="margin:0;font-size:12.5px;line-height:1.5;color:${esc(leise(f, f.flaeche || "#FFFFFF"))}">
Einfach beim nächsten Besuch im Warenkorb eintragen oder am Tisch
zeigen — der Code gilt einmal.
</p>
</td></tr>
`;
}

function gutscheinInhalt(m, slug){
  const b = m.betrieb || {};
  const f = m.farben  || {};
  return `<tr><td style="padding:32px 28px 8px">
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:${esc(f.tinte || "#2A1A14")}">
${esc(b.begruessung || "Schön, dass Sie zu unseren Gästen zählen.")}
</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${esc(f.tinte || "#2A1A14")}">
Ein kleiner Gutschein für Sie
</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:${esc(f.tinteLeise || "#846C62")}">
Danke, dass Sie sich eingetragen haben — hier ist Ihr Code für den
nächsten Besuch.
</p>
</td></tr>

${codeKasten(m, slug)}`;
}

function rueckholungInhalt(m, slug){
  const b = m.betrieb || {};
  const f = m.farben  || {};
  const lieb = `person|lookup:'omoteno_${slug}_liebling'`;
  return `<tr><td style="padding:32px 28px 8px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${esc(f.tinte || "#2A1A14")}">
Wir vermissen Sie
</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${esc(f.tinte || "#2A1A14")}">
Ihr letzter Besuch bei ${esc(b.name || "uns")} ist schon eine Weile her.
Schauen Sie doch wieder vorbei — wir freuen uns auf Sie.
</p>
{% if ${lieb} %}<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${esc(f.tinteLeise || "#846C62")}">
Ihr Lieblingsgericht bei uns: <strong style="color:${esc(f.tinte || "#2A1A14")}">{{ ${lieb} }}</strong>.
</p>{% endif %}
<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:${esc(f.tinteLeise || "#846C62")}">
Als kleines Willkommen zurück:
</p>
</td></tr>

${codeKasten(m, slug)}`;
}

/* Leise Schrift auf dem Grund, auf dem sie wirklich steht (§5.1/§5.2a):
   die leiseste Tinte des Hauses mit mindestens 4,5:1. VORFALL: Hinweis
   und Fußzeile — samt Abmeldelink — standen fest auf tinteStill, bei
   Choco 2,58:1, bei Blend 3,38:1. Ein Link ist nie Zierschrift. */
function hell(hex){
  const h = String(hex).replace("#", "");
  const k = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
}
function kontrast(a, b){
  const [x, y] = [hell(a), hell(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function leise(f, grund){
  const kandidaten = [f.tinteStill || "#A6907F", f.tinteLeise || "#846C62", f.tinte || "#2A1A14"];
  return kandidaten.find(c => kontrast(c, grund) >= 4.5) || kandidaten[kandidaten.length - 1];
}

function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function einen(slug, art){
  const pfad = path.join(BLAETTER, slug + ".json");
  if(!fs.existsSync(pfad)){
    console.log("  Markenblatt fehlt: " + pfad);
    return false;
  }
  const m = JSON.parse(fs.readFileSync(pfad, "utf8"));
  const html = vorlageBauen(m, slug, art);
  fs.mkdirSync(ZIEL, { recursive: true });
  const ausgabe = path.join(ZIEL, slug + (art === "rueckholung" ? "-rueckholung" : "") + ".html");
  fs.writeFileSync(ausgabe, html, "utf8");
  console.log("  → " + path.relative(WURZEL, ausgabe) + "  (" + html.length + " Zeichen)");
  return true;
}

(function(){
  const arg = process.argv[2];
  const i = process.argv.indexOf("--art");
  const art = i > 0 ? process.argv[i + 1] : "gutschein";
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
      if(einen(slug, art)) n++;
    }
    console.log(`\n${n} von ${namen.length} erzeugt.`);
  }else{
    einen(arg, art);
  }
})();
