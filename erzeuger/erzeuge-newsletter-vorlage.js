#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   ERZEUGE-NEWSLETTER-VORLAGE

   Baut aus einem Markenblatt eine gebrandete HTML-E-Mail-Vorlage
   für den Klaviyo-Gäste-Newsletter — nach demselben Muster wie
   erzeuge-hub.js: Ein Markenblatt, eine erzeugte Datei, nichts von
   Hand doppelt gepflegt.

       node erzeuger/erzeuge-newsletter-vorlage.js chocolamour
       node erzeuger/erzeuge-newsletter-vorlage.js --alle

   Schreibt nach dist-newsletter/<slug>.html. Der Upload zu Klaviyo
   (create_email_template) läuft NICHT von hier aus — dieses Skript
   hat keinen Klaviyo-Schlüssel und soll auch keinen brauchen. Wer
   die Vorlage hochladen will: die erzeugte Datei in Klaviyo unter
   Content → Templates → "Code your own" einfügen, oder eine Sitzung
   mit Klaviyo-MCP-Zugriff bitten, create_email_template mit dieser
   Datei aufzurufen (so ist chocolamour/blend/minhkeey einmalig schon
   hochgeladen worden).

   WARUM KEIN HOCHGELADENES LOGO. Kein Betrieb in diesem Verzeichnis
   hat ein logo.bild gesetzt — nur logo.svg (Inline-SVG, ungeeignet
   für E-Mail-Clients, die SVG meist nicht darstellen) oder gar
   nichts. Der Kopf der Vorlage benutzt deshalb denselben Rückfall
   wie der Hub selbst: Name in der Bandfarbe, keine Bildquelle.

   WARUM ZWEI ERSATZ-MERGETAGS UNGEPRÜFT SIND. {{ organization.name }}
   und der Gutschein-Code aus dem "Coupon Code"-Flow-Schritt
   ({{ event.discount_code }}) folgen Klaviyos dokumentierter Form,
   sind aber nie gegen einen echten Flow-Lauf verifiziert worden
   (diese Arbeitsumgebung kann keinen Flow auslösen). Vor dem ersten
   echten Versand im Klaviyo-Vorschaufenster prüfen, ob der Code
   wirklich dort erscheint, wo die Vorlage ihn erwartet.
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

function vorlageBauen(m){
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

<tr><td style="padding:32px 28px 8px">
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:${esc(f.tinte || "#2A1A14")}">
${esc(b.begruessung || "Schön, dass Sie zu unseren Gästen zählen.")}
</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${esc(f.tinte || "#2A1A14")}">
Ein kleiner Gutschein für Sie
</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:${esc(f.tinteLeise || "#846C62")}">
Weil Sie öfter bei uns vorbeischauen — hier ist Ihr Code für den
nächsten Besuch.
</p>
</td></tr>

<tr><td style="padding:0 28px 28px">
<table role="presentation" width="100%" style="background:${esc(f.flaeche2 || "#F4EBE3")};
    border:1px dashed ${esc(f.akzent || "#C8202E")};border-radius:${Math.max(rundung - 4, 8)}px">
<tr><td align="center" style="padding:22px 16px">
<div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;
    letter-spacing:.08em;color:${esc(f.akzent || "#C8202E")}">
{{ event.discount_code }}
</div>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:0 28px 32px">
<p style="margin:0;font-size:12.5px;line-height:1.5;color:${esc(f.tinteStill || "#A6907F")}">
Einfach beim nächsten Besuch am Tisch zeigen — unser Team löst den
Code für Sie ein.
</p>
</td></tr>

<tr><td style="background:${esc(f.flaeche2 || "#F4EBE3")};padding:16px 28px;text-align:center">
<p style="margin:0;font-size:11.5px;line-height:1.5;color:${esc(f.tinteStill || "#A6907F")}">
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

function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function einen(slug){
  const pfad = path.join(BLAETTER, slug + ".json");
  if(!fs.existsSync(pfad)){
    console.log("  Markenblatt fehlt: " + pfad);
    return false;
  }
  const m = JSON.parse(fs.readFileSync(pfad, "utf8"));
  const html = vorlageBauen(m);
  fs.mkdirSync(ZIEL, { recursive: true });
  const ausgabe = path.join(ZIEL, slug + ".html");
  fs.writeFileSync(ausgabe, html, "utf8");
  console.log("  → " + path.relative(WURZEL, ausgabe) + "  (" + html.length + " Zeichen)");
  return true;
}

(function(){
  const arg = process.argv[2];
  if(!arg){
    console.log("Aufruf: node erzeuger/erzeuge-newsletter-vorlage.js <slug>|--alle");
    process.exit(1);
  }
  if(arg === "--alle"){
    const namen = fs.readdirSync(BLAETTER).filter(n => n.endsWith(".json")).map(n => n.slice(0, -5));
    let n = 0;
    for(const slug of namen){
      console.log("── " + slug + " ──");
      if(einen(slug)) n++;
    }
    console.log(`\n${n} von ${namen.length} erzeugt.`);
  }else{
    einen(arg);
  }
})();
