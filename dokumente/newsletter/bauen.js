// Skizze der Newsletter-Varianten: node dokumente/newsletter/bauen.js
// Baut skizze.html (vier Varianten nebeneinander, Telefonbreite, mit Notizen zur Herkunft des Musters) und skizze.png.
// Die Fotos in den Mails sind https-Adressen (wie in echt); beim Rendern beantwortet die Probe sie mit den Testbildern der
// Prüfungen — die Skizze braucht kein Netz.
const path = require("path"), fs = require("fs");
const { chromium } = require("playwright");
const N = require("../../erzeuger/newsletter-varianten.js");
const OBEN = path.join(__dirname, "..", "..");
const m = JSON.parse(fs.readFileSync(path.join(OBEN, "markenblaetter", process.argv[2] || "chocolamour") + ".json", "utf8"));
const slug = process.argv[2] || "chocolamour";
const BILD = "https://bilder.omoteno.de/skizze/";
const gerichte = [
  { name: "Waffel Classic", preis: 8.5, bild: BILD + "gericht.jpg", beliebt: true },
  { name: "Dubai Crêpe", preis: 11.9, bild: BILD + "karte.jpg", beliebt: true },
  { name: "Heiße Schokolade", preis: 4.9, bild: BILD + "gericht-weiss.jpg" }
];
const NOTIZ = {
  klassisch: "Bisher. Kopf in der Bandfarbe, Gutschein-Kasten, Abmeldelink.",
  kampagne: "Muster McDonald's: das Angebot ist der Kopf (erster Bildschirm), großes Foto, EIN Knopf, Gerichte als Kacheln mit Preis, Code als Ticket.",
  liefer: "Muster Lieferando/Uber Eats: persönliche Anrede, Gutschein als Karte mit Bedingungen, drei Schritte zum Einlösen, Favoriten mit Foto und Preis.",
  edel: "Ruhig: Serifenschrift, viel Weißraum, ein Bild, Code im feinen Rahmen."
};
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
(async () => {
  for(const art of ["gutschein", "rueckholung"]){
    const spalten = N.VARIANTEN.map(v => `<figure><figcaption><b>${v.name}</b><span>${esc(NOTIZ[v.id])}</span></figcaption>
<iframe srcdoc="${esc(N.vorschau(N.bauen(m, slug, art, v.id, gerichte)))}" width="390" height="1500"></iframe></figure>`).join("");
    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Newsletter-Skizze · ${art}</title>
<style>body{margin:0;padding:24px;background:#ECE8E2;font:14px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#222}
h1{margin:0 0 4px;font-size:22px}p.l{margin:0 0 18px;color:#555}main{display:flex;gap:18px;align-items:flex-start}
figure{margin:0;width:390px}figcaption{display:flex;flex-direction:column;gap:2px;min-height:78px;margin-bottom:8px}figcaption span{color:#555;font-size:12.5px}
iframe{border:0;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.15)}</style></head><body>
<h1>Gäste-Newsletter · ${art === "gutschein" ? "Willkommen mit Gutschein" : "„Wir vermissen Sie“"} · ${esc((m.betrieb || {}).name || slug)}</h1>
<p class="l">Vier Vorlagen in der Telefonbreite (390 px). Abgeschaut ist der Aufbau, nicht Marke oder Bild. Code, Vorname und Lieblingsgericht sind hier Beispielwerte — echt setzt sie Klaviyo beim Versand ein.</p>
<main>${spalten}</main></body></html>`;
    const datei = path.join(__dirname, "skizze-" + art + ".html");
    fs.writeFileSync(datei, html);
    const br = await chromium.launch(), p = await br.newPage({ viewport: { width: 1700, height: 1700 }, deviceScaleFactor: 1 });
    await p.route("**/*", r => { const u = r.request().url();
      if(u.startsWith(BILD)) return r.fulfill({ path: path.join(OBEN, "pruefungen", "werkzeug", "testbilder", u.slice(BILD.length)) });
      return u.startsWith("file:") || u.startsWith("about:") || u.startsWith("data:") ? r.continue() : r.abort(); });
    await p.goto("file://" + datei); await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(__dirname, "skizze-" + art + ".png"), fullPage: true });
    await br.close();
    console.log("→ " + path.relative(OBEN, datei) + " und .png");
  }
})();
