/* ═══════════════════════════════════════════════════════════════════
   KOMPAKT · nimmt Kommentare aus der AUSGELIEFERTEN Hub-Datei (24.10.)

   Anlass: „Die Seite ist relativ langsam.“ Gemessen am erzeugten Hub von
   Choco: 1,5 MB, davon 1,14 MB Skript und 280 KB Stil — und in beidem
   stehen die Begründungen, Vorfälle und Blockmarken, die für die Menschen
   im Verzeichnis gedacht sind, nicht für den Browser des Gastes. Ohne
   Kommentare: Skript 428 → 333 KB, Stil 78 → 36 KB (gzip), zusammen rund
   ein Viertel weniger Bytes auf der Leitung, und weniger, das der Browser
   lesen muss.

   Was dieser Schritt ist — und was nicht:
   · Er nimmt NUR Kommentare aus <script> (ohne src) und <style>. Kein Name
     wird verkürzt, nichts umgeschrieben, keine Zeile des Codes angefasst.
     Die Quelle (vorlagen/hub.vorlage.html) bleibt, wie sie ist; wer etwas
     ändert, ändert dort (CLAUDE.md, „Hub-Dateien in dist/ werden NIE
     bearbeitet“).
   · Er muss nicht „klug“ sein, sondern richtig: JavaScript wird mit einem
     kleinen Zeichenleser gelesen, der Zeichenketten, Schablonen (`${…}`)
     und Regex-Literale kennt. Wo eine Unsicherheit bleibt (ein „/“, das
     Teilung oder Regex sein kann), entscheidet die Vorgängersymbol-Regel;
     jeder Block wird danach als Skript übersetzt (vm.Script). Schlägt das
     fehl, bleibt der Block UNVERÄNDERT und der Erzeuger sagt es laut.
   · Der Gegenbeweis steht in pruefungen/pruef-kompakt.js: derselbe Code
     vor und nach dem Kürzen, mit TypeScripts Parser als AST ohne
     Kommentare ausgedruckt — gleich oder nicht gleich.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
const vm = require("vm");

const WORT = /[A-Za-z0-9_$]/;
/* Nach diesen Wörtern beginnt ein „/“ ein Regex-Literal, keine Teilung. */
const REGEX_NACH = new Set(["return", "typeof", "case", "in", "of", "delete", "void", "throw", "new", "else", "do", "instanceof", "yield", "await"]);

function leerzeile(aus){            /* ist der Rest der Zeile im Ausgabepuffer nur Leerraum? */
  for(let i = aus.length - 1; i >= 0; i--){
    const c = aus[i];
    if(c === "\n") return true;
    if(c !== " " && c !== "\t") return false;
  }
  return true;
}

function kuerzeJs(q){
  const aus = [];                    /* Zeichen als Feld: schnelles Zurücknehmen */
  const n = q.length;
  const schab = [];                  /* Stapel: Klammertiefe je offener ${ … } */
  let i = 0, klammer = 0;
  let wertEnde = false;              /* endet das letzte Symbol einen Ausdruck? */
  let letztesWort = "";

  const nimm = (bis) => { for(; i < bis; i++) aus.push(q[i]); };

  /* Kommentar [von, bis) ersetzen; ganze Zeilen verschwinden mit ihrem Umbruch. */
  function weg(von, bis, mitUmbruch){
    let j = bis;
    while(j < n && (q[j] === " " || q[j] === "\t")) j++;
    const folgt = j >= n || q[j] === "\n" || (q[j] === "\r" && q[j + 1] === "\n");
    if(leerzeile(aus) && folgt){
      /* Puffer bis zum Zeilenanfang zurück, Umbruch danach überspringen. */
      while(aus.length && aus[aus.length - 1] !== "\n") aus.pop();
      i = j;
      if(q[i] === "\r") i++;
      if(q[i] === "\n") i++;
      return;
    }
    i = bis;
    if(mitUmbruch) aus.push("\n");
    else if(aus.length && WORT.test(aus[aus.length - 1]) && i < n && WORT.test(q[i])) aus.push(" ");
  }

  while(i < n){
    const c = q[i], d = q[i + 1];

    if(c === "/" && d === "/"){
      let j = i + 2;
      while(j < n && q[j] !== "\n") j++;
      /* Ein Zeilenkommentar lässt seinen Umbruch stehen. */
      if(j > 0 && q[j - 1] === "\r") j--;
      const hinten = j;
      /* ganze Zeile? dann samt Umbruch fort, sonst nur den Kommentar */
      let k = i - 1; while(k >= 0 && (q[k] === " " || q[k] === "\t")) k--;
      const ganze = k < 0 || q[k] === "\n";
      if(ganze){ while(aus.length && aus[aus.length - 1] !== "\n") aus.pop();
        i = hinten; if(q[i] === "\r") i++; if(q[i] === "\n") i++; }
      else { while(aus.length && (aus[aus.length - 1] === " " || aus[aus.length - 1] === "\t")) aus.pop(); i = hinten; }
      continue;
    }
    if(c === "/" && d === "*"){
      const e = q.indexOf("*/", i + 2);
      if(e < 0){ nimm(n); break; }                    /* offen: nichts anfassen */
      const bis = e + 2, text = q.slice(i, bis);
      weg(i, bis, text.indexOf("\n") >= 0);
      continue;
    }
    if(c === '"' || c === "'"){
      const z = c; let j = i + 1;
      while(j < n && q[j] !== z){ if(q[j] === "\\") j++; j++; }
      nimm(Math.min(j + 1, n)); wertEnde = true; letztesWort = ""; continue;
    }
    if(c === "`"){
      aus.push(c); i++;
      /* Schablone: bis zum Ende oder bis ${ */
      for(;;){
        if(i >= n) break;
        const t = q[i];
        if(t === "\\"){ aus.push(t); aus.push(q[i + 1] === undefined ? "" : q[i + 1]); i += 2; continue; }
        if(t === "`"){ aus.push(t); i++; wertEnde = true; letztesWort = ""; break; }
        if(t === "$" && q[i + 1] === "{"){ aus.push("${"); i += 2; schab.push(klammer); klammer = 0; wertEnde = false; letztesWort = ""; break; }
        aus.push(t); i++;
      }
      continue;
    }
    if(c === "{"){ klammer++; aus.push(c); i++; wertEnde = false; letztesWort = ""; continue; }
    if(c === "}"){
      if(klammer === 0 && schab.length){
        /* Ende einer ${ … }: zurück in die Schablone */
        klammer = schab.pop(); aus.push(c); i++;
        for(;;){
          if(i >= n) break;
          const t = q[i];
          if(t === "\\"){ aus.push(t); aus.push(q[i + 1] === undefined ? "" : q[i + 1]); i += 2; continue; }
          if(t === "`"){ aus.push(t); i++; wertEnde = true; letztesWort = ""; break; }
          if(t === "$" && q[i + 1] === "{"){ aus.push("${"); i += 2; schab.push(klammer); klammer = 0; wertEnde = false; break; }
          aus.push(t); i++;
        }
        continue;
      }
      klammer--; aus.push(c); i++; wertEnde = false; letztesWort = ""; continue;
    }
    if(c === "/"){
      /* Teilung oder Regex? */
      const regex = !wertEnde || REGEX_NACH.has(letztesWort);
      if(regex){
        let j = i + 1, inKlasse = false;
        while(j < n){
          const t = q[j];
          if(t === "\\"){ j += 2; continue; }
          if(t === "\n") break;                       /* kein Regex: Teilung (Vorsicht) */
          if(t === "[") inKlasse = true;
          else if(t === "]") inKlasse = false;
          else if(t === "/" && !inKlasse){ j++; break; }
          j++;
        }
        while(j < n && /[a-z]/i.test(q[j])) j++;      /* Merker */
        nimm(Math.min(j, n)); wertEnde = true; letztesWort = ""; continue;
      }
      aus.push(c); i++; wertEnde = false; letztesWort = ""; continue;
    }
    if(WORT.test(c)){
      let j = i; while(j < n && WORT.test(q[j])) j++;
      const w = q.slice(i, j);
      nimm(j);
      /* Wörter, nach denen ein Ausdruck BEGINNT, beenden keinen */
      wertEnde = !REGEX_NACH.has(w); letztesWort = w; continue;
    }
    if(c === ")" || c === "]"){ aus.push(c); i++; wertEnde = true; letztesWort = ""; continue; }
    if(c === " " || c === "\t" || c === "\n" || c === "\r"){ aus.push(c); i++; continue; }
    aus.push(c); i++; wertEnde = false; letztesWort = "";
  }
  return aus.join("");
}

function kuerzeCss(q){
  const aus = []; const n = q.length; let i = 0;
  while(i < n){
    const c = q[i];
    if(c === "/" && q[i + 1] === "*"){
      const e = q.indexOf("*/", i + 2);
      if(e < 0){ aus.push(q.slice(i)); break; }
      let j = e + 2;
      while(j < n && (q[j] === " " || q[j] === "\t")) j++;
      const folgt = j >= n || q[j] === "\n" || (q[j] === "\r" && q[j + 1] === "\n");
      if(leerzeile(aus) && folgt){
        while(aus.length && aus[aus.length - 1] !== "\n") aus.pop();
        i = j; if(q[i] === "\r") i++; if(q[i] === "\n") i++;
      } else {
        i = e + 2;
        if(q.slice(i - 2 - 0, i).length && aus.length && /[\w-]/.test(aus[aus.length - 1]) && /[\w-]/.test(q[i] || "")) aus.push(" ");
      }
      continue;
    }
    if(c === '"' || c === "'"){
      let j = i + 1; while(j < n && q[j] !== c){ if(q[j] === "\\") j++; j++; }
      aus.push(q.slice(i, Math.min(j + 1, n))); i = Math.min(j + 1, n); continue;
    }
    aus.push(c); i++;
  }
  return aus.join("");
}

/* Der Auszeichnungstext einer Hub-Datei: jeder <script> ohne src und jeder <style>. */
function kompaktHtml(html, melde){
  melde = melde || (() => {});
  let vorher = 0, nachher = 0;
  const aus = html.replace(/<(script|style)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (ganz, tag, attr, inhalt) => {
    attr = attr || "";
    tag = tag.toLowerCase();
    if(tag === "script"){
      if(/\ssrc\s*=/.test(attr)) return ganz;
      const art = (attr.match(/\stype\s*=\s*["']?([^"'\s>]+)/i) || [0, ""])[1].toLowerCase();
      if(art && art !== "text/javascript" && art !== "module" && art !== "application/javascript") return ganz;   /* JSON-Daten u. ä. */
    }
    let neu;
    try{ neu = tag === "script" ? kuerzeJs(inhalt) : kuerzeCss(inhalt); }
    catch(e){ melde("Block nicht gekürzt (" + e.message + ")"); return ganz; }
    if(tag === "script"){
      try{ new vm.Script(neu, { filename:"gekuerzt.js" }); }
      catch(e){
        /* Dasselbe vor dem Kürzen: Läuft schon der Urtext nicht, ist es nicht unser Fehler — trotzdem unverändert lassen. */
        melde("Skriptblock nach dem Kürzen nicht mehr lesbar (" + String(e.message).slice(0, 80) + ") — bleibt unverändert");
        return ganz;
      }
    }
    vorher += inhalt.length; nachher += neu.length;
    return "<" + tag + attr + ">" + neu + "</" + tag + ">";
  });
  return { html:aus, vorher, nachher };
}

module.exports = { kompaktHtml, kuerzeJs, kuerzeCss };
