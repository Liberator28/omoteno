/* ╔═══ NEWSLETTER-VARIANTEN · GETEILTER BLOCK · ANFANG ═══════════════╗
   Die E-Mail-Vorlagen des Gäste-Newsletters (Klaviyo) — EINE Stelle für den Erzeuger (erzeuger/erzeuge-newsletter-vorlage.js,
   als Modul) und das Board (seiten/admin.html, Vorschau und „Übernehmen“). Wortgleich in erzeuger/newsletter-varianten.js und
   seiten/admin.html; pruefungen/pruef-newsletter-varianten.js hält beide Zeichen für Zeichen gleich.

   Wunsch 31.10.: „Skizziere zuerst eine E-Mail anhand von [großen Ketten], [Lieferdiensten] und anderen Diensten … mit geschmackvollem,
   anziehendem Design. Man soll zwischen Varianten wechseln und es aktiv im Admin-Board steuern können.“ Übernommen wird der
   AUFBAU, nicht Marke, Bild oder Wortlaut (Recherche: dokumente/newsletter/skizze.html):
     klassisch  die bisherige Mail, Zeichen für Zeichen (Vorgabe — ohne Wahl ändert sich nichts).
     kampagne   Muster großer Ketten: das Angebot IST der Kopf (erster Bildschirm), ein großes Foto, EIN kräftiger Knopf,
                Gerichte als Kacheln mit Preis, Text in kurzen beschrifteten Blöcken, der Code als Ticket.
     liefer     Muster großer Lieferdienste: persönliche Anrede, der Gutschein als Karte mit Bedingungen, drei Schritte
                „So lösen Sie ihn ein“, eine Favoritenliste (Foto links, Preis rechts), Knopf zur Karte.
     edel       ruhig: Serifenschrift, viel Weißraum, ein Foto, wenig Text.
   Schrift auf Farbe wird GERECHNET (§5.1): jede Farbe aus lesbar(grund, kandidaten) mit ≥ 4,5:1. Fotos nur über https, ohne
   Anführungszeichen und Spitzklammern; Name und Preis nur als maskierter Text (§8.1w). Die Klaviyo-Tags bleiben in jeder
   Variante: {% coupon_code '<slug>_newsletter' %}, {% unsubscribe %}, das Lieblingsgericht nur in {% if %}.
   Ohne DOM, ohne Node — läuft im Board und im Erzeuger gleich. */
const NEWSLETTER = (function(){
  "use strict";
  const VARIANTEN = [
    { id:"klassisch", name:"Klassisch", satz:"Ruhig und bewährt: Kopf in Ihrer Farbe, Gutschein-Kasten." },
    { id:"kampagne",  name:"Kampagne",  satz:"Das Angebot ganz groß, ein Foto, ein Knopf — wie bei den großen Ketten." },
    { id:"liefer",    name:"Persönlich", satz:"Mit Anrede, Gutschein-Karte, drei Schritten und Ihren Favoriten." },
    { id:"edel",      name:"Edel",      satz:"Viel Weißraum, Serifenschrift, ein Bild — für die feine Küche." }
  ];
  const ARTEN = ["gutschein", "rueckholung"];
  const varianteSauber = v => VARIANTEN.some(x => x.id === v) ? v : "klassisch";
  const artSauber = a => ARTEN.indexOf(a) >= 0 ? a : "gutschein";

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


  /* ── Gemeinsames der neuen Varianten ─────────────────────────────── */
  const HEX = /^#[0-9A-Fa-f]{6}$/;
  const farbe = (x, v) => (typeof x === "string" && HEX.test(x)) ? x : v;
  /* die erste Farbe mit ≥ 4,5:1 auf dem Grund, sonst Schwarz oder Weiß — was mehr Kontrast hat */
  function lesbar(grund, kandidaten){
    for(const c of kandidaten) if(HEX.test(c || "") && kontrast(c, grund) >= 4.5) return c;
    return kontrast("#111111", grund) >= kontrast("#FFFFFF", grund) ? "#111111" : "#FFFFFF";
  }
  function palette(m){
    const f = m.farben || {};
    const p = {
      grund: farbe(f.grund, "#F5F3F0"), flaeche: farbe(f.flaeche, "#FFFFFF"), flaeche2: farbe(f.flaeche2, "#F4EBE3"),
      band: farbe(f.band, "#2A1A14"), akzent: farbe(f.akzent, "#C8202E")
    };
    p.tinte = lesbar(p.flaeche, [farbe(f.tinte, "#2A1A14")]);
    p.leise = lesbar(p.flaeche, [f.tinteLeise, f.tinte]);
    p.bandText = lesbar(p.band, [f.bandText, "#FFFFFF", "#111111"]);
    p.knopfText = lesbar(p.akzent, ["#FFFFFF", "#111111"]);
    p.akzentAufFlaeche = lesbar(p.flaeche, [p.akzent, p.tinte]);
    p.ticket = p.flaeche2;
    p.ticketText = lesbar(p.flaeche2, [p.akzent, p.tinte]);
    p.ticketLeise = lesbar(p.flaeche2, [f.tinteLeise, p.tinte]);
    p.rund = Math.max(0, Math.min(28, +((m.form && m.form.rundung) || 16) || 16));
    return p;
  }
  const BILD_OK = /^https:\/\/[^\s"'<>()\\]{1,480}$/;
  const preisText = x => { const n = typeof x === "number" ? x : parseFloat(String(x == null ? "" : x).replace(",", "."));
    return isFinite(n) && n > 0 ? n.toFixed(2).replace(".", ",") + " €" : ""; };
  /* Höchstens drei Gerichte: zuerst die als „Beliebt“ markierten, dann die mit Foto; ohne Namen keins. */
  function gerichteWaehlen(liste){
    const g = (Array.isArray(liste) ? liste : []).filter(x => x && typeof x.name === "string" && x.name.trim() && x.verfuegbar !== false);
    const rang = x => (x.beliebt === true ? 0 : 2) + (typeof x.bild === "string" && BILD_OK.test(x.bild) ? 0 : 1);
    return g.map((x, i) => [x, i]).sort((a, b) => rang(a[0]) - rang(b[0]) || a[1] - b[1]).slice(0, 3)
      .map(([x]) => ({ name: x.name.trim().slice(0, 60), preis: preisText(x.preis),
        bild: (typeof x.bild === "string" && BILD_OK.test(x.bild)) ? x.bild : "" }));
  }
  const hubUrl = slug => "https://omoteno.de/h/" + encodeURIComponent(String(slug || "").replace(/[^a-z0-9-]/g, "")) + "/";
  const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
  const SERIF = "Georgia,'Times New Roman',serif";
  function huelle(m, p, schrift, vorschau, innen){
    const b = m.betrieb || {};
    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(b.name || "Newsletter")}</title>
</head>
<body style="margin:0;padding:0;background:${p.grund};font-family:${schrift};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(vorschau)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.grund}">
<tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${p.flaeche};border-radius:${p.rund}px;overflow:hidden">
${innen}
<tr><td style="background:${p.ticket};padding:18px 28px;text-align:center">
<p style="margin:0;font-size:12px;line-height:1.6;color:${p.ticketLeise}">
${esc(b.name || "")}${b.ort ? " · " + esc(b.ort) : ""}<br>
Sie bekommen diese E-Mail, weil Sie sich bei uns eingetragen haben.<br>
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
  const lieb = slug => `person|lookup:'omoteno_${slug}_liebling'`;
  const knopf = (p, text, url, voll) => `<table role="presentation" cellpadding="0" cellspacing="0" ${voll ? 'width="100%"' : ""} style="margin:0 auto">
<tr><td align="center" style="background:${p.akzent};border-radius:999px">
<a href="${esc(url)}" style="display:block;padding:16px 30px;font-size:16px;font-weight:700;letter-spacing:.01em;color:${p.knopfText};text-decoration:none">${esc(text)}</a>
</td></tr></table>`;
  const code = (p, slug, groesse) => `<span style="font-family:'Courier New',monospace;font-size:${groesse || 24}px;font-weight:700;letter-spacing:.12em;word-break:break-all;color:${p.ticketText}">{% coupon_code '${slug}_newsletter' %}</span>`;

  /* ── kampagne: Muster großer Ketten ──────────────────────────────── */
  function kampagne(m, slug, art, liste){
    const p = palette(m), b = m.betrieb || {}, g = gerichteWaehlen(liste);
    const zurueck = art === "rueckholung";
    const kopfzeile = zurueck ? "Wir haben Ihren Platz frei gehalten." : "Ein Geschenk für Ihren nächsten Besuch.";
    const unter = zurueck ? `Ihr letzter Besuch bei ${esc(b.name || "uns")} ist eine Weile her. Kommen Sie wieder — mit einem Gutschein von uns.`
                          : "Danke, dass Sie dabei sind. Ihr Gutschein wartet unten — einfach beim nächsten Besuch einlösen.";
    const held = g.find(x => x.bild);
    const fotoKopf = held ? `<tr><td style="padding:0 20px"><img src="${esc(held.bild)}" alt="${esc(held.name)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:${Math.max(p.rund - 4, 6)}px"></td></tr>` : "";
    const kachel = x => `<td width="50%" valign="top" style="padding:6px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.ticket};border-radius:${Math.max(p.rund - 6, 6)}px;overflow:hidden">
${x.bild ? `<tr><td><img src="${esc(x.bild)}" alt="" width="250" style="display:block;width:100%;height:auto"></td></tr>` : ""}
<tr><td style="padding:12px 14px">
<div style="font-size:15px;font-weight:700;line-height:1.3;color:${lesbar(p.ticket, [p.tinte])}">${esc(x.name)}</div>
${x.preis ? `<div style="margin-top:4px;font-size:15px;font-weight:800;color:${p.ticketText}">${esc(x.preis)}</div>` : ""}
</td></tr></table></td>`;
    const paare = []; for(let i = 0; i < Math.min(g.length, 2); i++) paare.push(g[i]);
    const kacheln = paare.length ? `<tr><td style="padding:26px 22px 4px">
<p style="margin:0 0 4px 6px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${p.akzentAufFlaeche}">Beliebt bei uns</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${paare.map(kachel).join("")}${paare.length === 1 ? '<td width="50%"></td>' : ""}</tr></table>
</td></tr>` : "";
    const innen = `<tr><td style="background:${p.band};padding:18px 28px">
<div style="font-size:15px;font-weight:800;letter-spacing:.06em;color:${p.bandText}">${esc(b.name || "")}</div>
</td></tr>
<tr><td style="background:${p.band};padding:8px 28px 30px">
<p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${p.bandText}">Nur für Sie · Gutschein</p>
<h1 style="margin:0 0 12px;font-size:34px;line-height:1.1;font-weight:800;color:${p.bandText}">${kopfzeile}</h1>
<p style="margin:0;font-size:16px;line-height:1.5;color:${p.bandText}">${unter}</p>
</td></tr>
${fotoKopf ? `<tr><td style="background:${p.band};height:24px;line-height:24px;font-size:0">&nbsp;</td></tr>` + fotoKopf : ""}
<tr><td style="padding:26px 28px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.ticket};border:2px dashed ${p.ticketText};border-radius:${Math.max(p.rund - 4, 8)}px">
<tr><td align="center" style="padding:18px 14px 6px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${p.ticketLeise}">Ihr Code</td></tr>
<tr><td align="center" style="padding:0 14px 18px">${code(p, slug, 26)}</td></tr>
</table>
</td></tr>
${zurueck ? `{% if ${lieb(slug)} %}<tr><td style="padding:8px 28px 0"><p style="margin:0;font-size:15px;line-height:1.5;color:${p.tinte}">Ihr Lieblingsgericht wartet: <strong>{{ ${lieb(slug)} }}</strong></p></td></tr>{% endif %}` : ""}
<tr><td style="padding:22px 28px 6px">${knopf(p, "Jetzt Karte öffnen", hubUrl(slug), true)}</td></tr>
<tr><td style="padding:2px 28px 0;text-align:center"><p style="margin:0;font-size:12.5px;line-height:1.5;color:${p.leise}">Gilt einmal · im Warenkorb eintragen oder am Tisch zeigen</p></td></tr>
${kacheln}
<tr><td style="height:26px;line-height:26px;font-size:0">&nbsp;</td></tr>`;
    return huelle(m, p, SANS, kopfzeile + " " + (b.name || ""), innen);
  }

  /* ── liefer: Muster großer Lieferdienste ────────────────────────── */
  function liefer(m, slug, art, liste){
    const p = palette(m), b = m.betrieb || {}, g = gerichteWaehlen(liste);
    const zurueck = art === "rueckholung";
    const titel = zurueck ? "Lust auf ein Wiedersehen?" : "Ihr Gutschein ist da";
    const satz = zurueck ? `Bei ${esc(b.name || "uns")} ist es ohne Sie zu ruhig. Ihr Gutschein für den nächsten Besuch:`
                         : `Schön, dass Sie dabei sind. Hier ist Ihr persönlicher Gutschein für ${esc(b.name || "uns")}:`;
    const schritt = (n, t) => `<tr><td width="36" valign="top" style="padding:6px 0">
<div style="width:28px;height:28px;line-height:28px;border-radius:14px;text-align:center;font-size:14px;font-weight:800;background:${p.akzent};color:${p.knopfText}">${n}</div></td>
<td valign="middle" style="padding:6px 0 6px 10px;font-size:15px;line-height:1.4;color:${p.tinte}">${t}</td></tr>`;
    const zeile = x => `<tr><td style="padding:8px 0;border-top:1px solid ${p.ticket}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${x.bild ? `<td width="64" valign="middle"><img src="${esc(x.bild)}" alt="" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:12px"></td>` : ""}
<td valign="middle" style="padding:0 0 0 ${x.bild ? 12 : 0}px;font-size:15px;font-weight:700;line-height:1.3;color:${p.tinte}">${esc(x.name)}</td>
<td valign="middle" align="right" style="font-size:15px;font-weight:800;white-space:nowrap;color:${p.akzentAufFlaeche}">${esc(x.preis)}</td>
</tr></table></td></tr>`;
    const favoriten = g.length ? `<tr><td style="padding:24px 28px 4px">
<h2 style="margin:0 0 6px;font-size:18px;color:${p.tinte}">Unsere Favoriten</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${g.map(zeile).join("")}</table>
</td></tr>` : "";
    const innen = `<tr><td style="padding:22px 28px 6px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:17px;font-weight:800;color:${p.tinte}">${esc(b.name || "")}</td>
<td align="right"><span style="display:inline-block;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;background:${p.akzent};color:${p.knopfText}">Gutschein</span></td>
</tr></table></td></tr>
<tr><td style="padding:14px 28px 4px">
<p style="margin:0 0 4px;font-size:15px;font-weight:600;color:${p.leise}">Hallo{% if first_name %} {{ first_name }}{% endif %},</p>
<h1 style="margin:0 0 8px;font-size:26px;line-height:1.2;color:${p.tinte}">${titel}</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:${p.leise}">${satz}</p>
</td></tr>
<tr><td style="padding:18px 28px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.ticket};border-radius:${Math.max(p.rund - 2, 8)}px;border-left:8px solid ${p.akzent}">
<tr><td style="padding:18px 20px 4px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${p.ticketLeise}">Ihr Code</td></tr>
<tr><td style="padding:0 20px 6px">${code(p, slug, 24)}</td></tr>
<tr><td style="padding:0 20px 18px;font-size:13px;line-height:1.5;color:${p.ticketLeise}">Gilt einmal · für Ihre nächste Bestellung oder Ihren nächsten Besuch</td></tr>
</table></td></tr>
${zurueck ? `{% if ${lieb(slug)} %}<tr><td style="padding:14px 28px 0"><p style="margin:0;font-size:15px;line-height:1.5;color:${p.tinte}">Wie wäre es wieder mit <strong>{{ ${lieb(slug)} }}</strong>?</p></td></tr>{% endif %}` : ""}
<tr><td style="padding:22px 28px 4px">
<h2 style="margin:0 0 6px;font-size:18px;color:${p.tinte}">So lösen Sie ihn ein</h2>
<table role="presentation" cellpadding="0" cellspacing="0">
${schritt(1, "Karte öffnen — im Lokal per Tisch-Code oder über den Knopf unten")}
${schritt(2, "Gerichte auswählen")}
${schritt(3, "Den Code im Warenkorb eintragen oder am Tisch zeigen")}
</table></td></tr>
${favoriten}
<tr><td style="padding:24px 28px 30px">${knopf(p, "Zur Speisekarte", hubUrl(slug), true)}</td></tr>`;
    return huelle(m, p, SANS, titel + " · " + (b.name || ""), innen);
  }

  /* ── edel: ruhig, viel Weißraum ──────────────────────────────────── */
  function edel(m, slug, art, liste){
    const p = palette(m), b = m.betrieb || {}, g = gerichteWaehlen(liste);
    const zurueck = art === "rueckholung";
    const held = g.find(x => x.bild);
    const titel = zurueck ? "Es ist Zeit für ein Wiedersehen" : "Willkommen an unserem Tisch";
    const satz = zurueck ? "Wir würden uns freuen, Sie bald wieder bei uns zu begrüßen. Als kleine Aufmerksamkeit:"
                         : "Danke für Ihr Vertrauen. Als kleine Aufmerksamkeit für Ihren nächsten Besuch:";
    const innen = `<tr><td align="center" style="padding:40px 32px 8px">
<div style="font-family:${SERIF};font-size:15px;letter-spacing:.32em;text-transform:uppercase;color:${p.tinte}">${esc(b.name || "")}</div>
<div style="width:40px;height:1px;margin:18px auto 0;background:${p.tinte};opacity:.35;line-height:1px;font-size:0">&nbsp;</div>
</td></tr>
${held ? `<tr><td style="padding:22px 32px 0"><img src="${esc(held.bild)}" alt="${esc(held.name)}" width="496" style="display:block;width:100%;height:auto;border-radius:${Math.min(p.rund, 10)}px"></td></tr>` : ""}
<tr><td align="center" style="padding:30px 36px 6px">
<h1 style="margin:0 0 14px;font-family:${SERIF};font-size:28px;line-height:1.25;font-weight:400;color:${p.tinte}">${titel}</h1>
<p style="margin:0;font-family:${SERIF};font-size:16px;line-height:1.7;color:${p.leise}">${satz}</p>
</td></tr>
${zurueck ? `{% if ${lieb(slug)} %}<tr><td align="center" style="padding:12px 36px 0"><p style="margin:0;font-family:${SERIF};font-size:16px;font-style:italic;line-height:1.6;color:${p.tinte}">{{ ${lieb(slug)} }} wartet auf Sie.</p></td></tr>{% endif %}` : ""}
<tr><td align="center" style="padding:26px 36px 8px">
<div style="display:inline-block;padding:16px 26px;border:1px solid ${p.tinte};border-radius:${Math.min(p.rund, 8)}px">${code(p, slug, 22).replace("color:" + p.ticketText, "color:" + p.tinte)}</div>
<p style="margin:12px 0 0;font-size:12.5px;line-height:1.5;color:${p.leise}">Gilt einmal · beim nächsten Besuch</p>
</td></tr>
<tr><td align="center" style="padding:22px 36px 40px">
<a href="${esc(hubUrl(slug))}" style="display:inline-block;padding:13px 26px;border:1px solid ${p.tinte};border-radius:999px;font-family:${SERIF};font-size:15px;color:${p.tinte};text-decoration:none">Unsere Karte ansehen</a>
</td></tr>`;
    return huelle(m, p, SERIF, titel + " · " + (b.name || ""), innen);
  }

  /* Nur zum Ansehen (Board, Skizze): Klaviyos Platzhalter durch Beispielwerte ersetzen — der lange Platzhalter des Codes
     machte jede Mail breiter als das Telefon. Was an Klaviyo geht, ist immer bauen() ohne diese Ersetzung. */
  function vorschau(html, beispiel){
    const b = Object.assign({ code: "WILLKOMMEN-7K2Q", vorname: "Anna", liebling: "Waffel Classic" }, beispiel || {});
    const t = x => String(x).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[c]);
    return String(html)
      .replace(/\{% coupon_code '[a-z0-9_-]+' %\}/g, t(b.code))
      .replace(/\{% unsubscribe '([^']*)' %\}/g, (x, w) => '<a href="#" style="color:inherit">' + t(w) + "</a>")
      .replace(/\{% if first_name %\} \{\{ first_name \}\}\{% endif %\}/g, " " + t(b.vorname))
      .replace(/\{% if person\|lookup:'[a-z0-9_]+' %\}([\s\S]*?)\{% endif %\}/g, "$1")
      .replace(/\{\{ person\|lookup:'[a-z0-9_]+' \}\}/g, t(b.liebling));
  }
  /* bauen(markenblatt, slug, art, variante, gerichte) → vollständiges HTML der E-Mail */
  function bauen(m, slug, art, variante, gerichte){
    m = (m && typeof m === "object") ? m : {};
    slug = String(slug || "").replace(/[^a-z0-9-]/g, "");
    art = artSauber(art); variante = varianteSauber(variante);
    if(variante === "kampagne") return kampagne(m, slug, art, gerichte);
    if(variante === "liefer") return liefer(m, slug, art, gerichte);
    if(variante === "edel") return edel(m, slug, art, gerichte);
    return vorlageBauen(m, slug, art);
  }
  return { VARIANTEN, ARTEN, varianteSauber, artSauber, gerichteWaehlen, bauen, vorschau, kontrast };
})();
/* ╚═══ NEWSLETTER-VARIANTEN · GETEILTER BLOCK · ENDE ═════════════════╝ */
if(typeof module !== "undefined" && module.exports) module.exports = NEWSLETTER;
