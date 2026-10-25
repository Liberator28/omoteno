/* ═══════════════════════════════════════════════════════════════
   werkzeug/messen.js — Messhelfer für die Premium-Prüfungen (Startseite, Speisekarte)

   kontrast(a, b)        WCAG-Kontrast zweier [r,g,b]
   schlechtester(p, sel) Schrift unsichtbar, Rechteck fotografiert, schlechtester Bildpunkt gegen die Schriftfarbe
   rect(p, sel)          getBoundingClientRect eines Elements (oder null)
   ═══════════════════════════════════════════════════════════════ */
/* WCAG-Kontrast aus zwei [r,g,b] */
const lin = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
const lum = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

/* Schlechtester Bildpunkt hinter einem Text: Schrift unsichtbar, Rechteck fotografiert, Pixel gegen die Schriftfarbe. */
async function schlechtester(p, selektor, nurText){
  const r = await p.evaluate(([sel, nurText]) => {
    const el = document.querySelector(sel); if(!el) return null;
    const cs = getComputedStyle(el);
    const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(cs.color) || [0, 0, 0, 0];
    el.dataset.pxAlt = el.getAttribute("style") || "";
    el.style.setProperty("color", "transparent", "important");
    el.style.setProperty("-webkit-text-fill-color", "transparent", "important");
    el.style.setProperty("text-shadow", "none", "important");
    /* nurText: das Rechteck der Buchstaben (Range) statt des ganzen Feldes — ein Feld, das breiter ist als sein Text, misst sonst
       auch Nachbarn, die den Text gar nicht berühren (Zierherz neben dem Preis). */
    let b = el.getBoundingClientRect();
    if(nurText){ const rg = document.createRange(); rg.selectNodeContents(el); const t = rg.getBoundingClientRect(); if(t.width > 0 && t.height > 0) b = t; }
    return { x: b.x, y: b.y, w: b.width, h: b.height, farbe: [+m[1], +m[2], +m[3]] };
  }, [selektor, !!nurText]);
  if(!r) return null;
  const png = await p.screenshot({ clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(1, r.w), height: Math.max(1, r.h) } });
  const worst = await p.evaluate(async ([b64, farbe]) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    const L = a => .2126 * lin(a[0]) + .7152 * lin(a[1]) + .0722 * lin(a[2]);
    const lt = L(farbe); let min = 99;
    for(let i = 0; i < d.length; i += 4){
      const lb = L([d[i], d[i + 1], d[i + 2]]);
      const k = (Math.max(lt, lb) + .05) / (Math.min(lt, lb) + .05); if(k < min) min = k;
    }
    return min;
  }, [png.toString("base64"), r.farbe]);
  await p.evaluate(sel => { const el = document.querySelector(sel); el.setAttribute("style", el.dataset.pxAlt); el.removeAttribute("data-px-alt"); if(!el.getAttribute("style")) el.removeAttribute("style"); }, selektor);
  return worst;
}

const rect = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if(!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, b: b.bottom, r: b.right }; }, sel);


module.exports = { lin, lum, kontrast, schlechtester, rect };
