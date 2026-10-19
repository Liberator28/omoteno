/* Reiter mit Kacheln (Einstellungen, Gast-Hub gestalten): öffnet die
   Unterseite, in der `sel` steht — über einen ECHTEN Tipp auf ihre Kachel,
   nicht über euOeffnen(): Wer nur die Funktion ruft, prüft nie, ob die
   Kachel da ist und trifft (§8.1g). Ist eine andere Unterseite offen, geht
   der Weg über „Alle …“ zurück, wie ein Mensch ihn ginge.

   Gibt true, wenn die Unterseite danach offen ist; false, wenn es zu `sel`
   keine Gruppe gibt oder der Reiter nicht sichtbar ist — der Aufrufer
   macht daraus eine eigene Voraussetzung („Probe, deren Voraussetzung
   fehlschlagen kann, prüft sie selbst“). */
async function gruppeZu(p, sel){
  const info = await p.evaluate(s => {
    const el = document.querySelector(s);
    const g = el && el.closest(".tafel[data-eu-kacheln] > .egruppe");
    if(!g || g.classList.contains("eu-uebersicht")) return null;
    const t = g.parentElement;
    return { id: g.id, tafel: t.id, offen: t.dataset.euOffen || "", sichtbar: !t.hidden };
  }, sel);
  if(!info || !info.sichtbar) return false;
  if(info.offen === info.id) return true;
  /* Die Einblendung „Vollbild?“ des Boards läge über den Kacheln und finge
     den Tipp (der kopflose Browser meldet sie immer) — wie ein Mensch sie
     wegtippt, nur ohne den Umweg über den Vollbildmodus (§3.8). */
  await p.evaluate(() => { const sc = document.getElementById("scharf"); if(sc) sc.hidden = true; });
  if(info.offen) await p.click("#" + info.tafel + " > .eu-zurueck");
  await p.click("#" + info.tafel + ' [data-eu-seite="' + info.id + '"]');
  await p.waitForTimeout(150);
  return p.evaluate(([t, i]) => document.getElementById(t).dataset.euOffen === i, [info.tafel, info.id]);
}
module.exports = { gruppeZu };
