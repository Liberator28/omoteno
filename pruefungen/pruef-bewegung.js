/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Die Bewegung im Admin-Board

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-bewegung.js

   „Gute Bewegung merkt man nicht, schlechte schon." Eine Animation,
   die man nur ANGESCHAUT hat, ist eine Behauptung — deshalb wird hier
   gemessen, und zwar das, was schiefgehen kann:

   1 · LÄUFT SIE AUF DER GRAFIKKARTE? Jede Bewegung darf nur
       transform und opacity anfassen. Alles andere zwingt den Browser,
       Layout oder Anstrich neu zu rechnen — bei jedem Bild.

   2 · STEHT DER ENDZUSTAND? Der teuerste Fehler bei
       prefers-reduced-motion ist ein Element, das nur nicht mehr
       einfliegt und deshalb unsichtbar liegen bleibt — dieselbe Falle
       wie [hidden] ohne Gegenregel (CLAUDE.md §8.1).

   3 · GEHT DAS BLATT WIRKLICH ZU? Der Ausgang ist neu: Vorher
       verschwanden alle fünf Blätter schlagartig. Eine Animation, die
       das Schließen VERZÖGERT, ist schlimmer als keine — wenn das
       Blatt danach liegen bleibt, ist das Board blockiert.

   4 · UND ZWEIMAL TIPPEN? Eine Bewegung, die unter einer neuen
       begraben wird, lässt den Gegenstand hängen.

   5 · DIE WISCHGESTE geht über DIESELBEN Schließfunktionen. Sie hat
       das Blatt schon hinausgeschoben; eine zweite Animation wäre ein
       Sprung zurück an den offenen Platz und dann wieder hinaus.
       Erkannt wird das am Zustand, nicht an einer Absprache — genau
       deshalb wird es hier gemessen (§8.1i).

   EHRLICHE GRENZE: Bilder pro Sekunde sagen im kopflosen Browser
   wenig — er zeichnet ohne Schirm und ohne Druck. Gemessen wird
   deshalb, WAS animiert wird und WO es endet, nicht wie flüssig es
   auf dem Gerät des Wirts aussieht. Der Beweis dafür steht am Tresen.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SEITEN = path.join(__dirname, "..", "seiten");
let fehler = 0;
const ok = (g, t, z) => {
  console.log((g ? "  ok   " : "  FEHL ") + t + (z ? "  → " + z : ""));
  if(!g) fehler++;
};

/* ── 1 · Nur transform und opacity, aus dem Quelltext gelesen ───── */
function eigenschaften(){
  console.log("\n══ Was überhaupt animiert wird ══");
  const s = fs.readFileSync(path.join(SEITEN, "admin.html"), "utf8");

  /* Die Keyframes. Gelesen wird mit Klammerzählung, nicht mit einem
     Muster bis zur nächsten „}" — sonst endet man mitten drin. */
  const erlaubt = ["transform", "opacity", "transform-origin"];
  const schlimm = [];
  const re = /@keyframes\s+([A-Za-z-]+)\s*\{/g;
  let m;
  while((m = re.exec(s))){
    let i = re.lastIndex, tief = 1;
    while(tief && i < s.length){
      if(s[i] === "{") tief++;
      else if(s[i] === "}") tief--;
      i++;
    }
    const koerper = s.slice(re.lastIndex, i - 1);
    const eig = [...new Set([...koerper.matchAll(/([a-z-]+)\s*:/g)].map(x => x[1]))];
    const raus = eig.filter(e => !erlaubt.includes(e));
    if(raus.length) schlimm.push(m[1] + ": " + raus.join(", "));
  }
  ok(schlimm.length === 0, "jede Keyframe-Bewegung läuft auf der Grafikkarte",
     schlimm.length ? schlimm.join(" | ") : "nur transform und opacity");

  /* Übergänge auf Eigenschaften, die Layout kosten. background,
     color und border-color sind reiner Anstrich und bleiben erlaubt —
     sie sind der normale Weg für einen Druckzustand. Was Layout
     auslöst, ist es nicht. */
  const teuer = /transition:[^;}]*\b(width|height|top|left|right|bottom|margin|padding|box-shadow|filter)\b/g;
  const treffer = (s.match(teuer) || []).map(t => t.slice(0, 66));
  ok(treffer.length === 0, "kein Übergang auf einer Eigenschaft, die Layout kostet",
     treffer.length ? treffer.join(" | ") : "keiner");

  /* Die Kurve des Hauses, nicht das CSS-Schlüsselwort: ease-out als
     Wort ist cubic-bezier(0,0,.58,1) und fällt schwächer. */
  /* INNERHALB von prefers-reduced-motion ist „linear" Absicht: Dort
     soll nichts beschleunigen, dort soll es möglichst nicht auffallen.
     Ausgenommen wird deshalb nach ORT und Grund, nicht per Muster —
     ein Muster hätte auch echte Fundstellen verschluckt, und genau
     das ist §8.1g, Vorfall D. Die Bereiche werden mit
     Klammerzählung bestimmt, nicht geraten. */
  const ruhigBereiche = [];
  const rm = /@media[^{]*prefers-reduced-motion[^{]*\{/g;
  let r;
  while((r = rm.exec(s))){
    let i = rm.lastIndex, tief = 1;
    while(tief && i < s.length){
      if(s[i] === "{") tief++;
      else if(s[i] === "}") tief--;
      i++;
    }
    ruhigBereiche.push([r.index, i]);
  }
  const imRuhigen = pos => ruhigBereiche.some(([a2, b2]) => pos >= a2 && pos < b2);

  /* Gleichförmige Dauerbewegung ist die eine Ausnahme des Skills
     bewegung (§2: „was sich endlos dreht“): Räder, Straße und Wolken der
     Lieferungs-Szene laufen mit fester Geschwindigkeit — eine Kurve
     ließe den Roller bei jeder Runde ruckeln. Namentlich, nicht per
     Muster (§8.1g D); NUR „linear“, nur diese. Dazu seit 18.10. das
     umlaufende Licht im Rand der Einstellungs-Kacheln (euLauf) — es
     dreht endlos wie das des Zurück-Knopfs im Hub. */
  const GLEICHFOERMIG = ["wzDrehen", "wzStrasse", "wzWolke", "euLauf", "wzStrahlen", "wzHaeuser"];
  /* Eine Angabe kann mehrere Animationen tragen („animation:a 1s x, b 2s y“).
     Die erste Fassung dieser Prüfung sah nur die ERSTE (19.10. aufgefallen:
     „wzStrahlen 56s linear“ stand an zweiter Stelle und wäre durchgerutscht).
     Deshalb: die Angabe an Kommas AUSSERHALB von Klammern teilen — in
     cubic-bezier(…) stehen auch welche — und jedes Stück einzeln lesen. */
  const teile = deklaration => { const aus = []; let tiefe = 0, start = 0;
    for(let i = 0; i < deklaration.length; i++){ const c = deklaration[i];
      if(c === "(") tiefe++; else if(c === ")") tiefe--;
      else if(c === "," && !tiefe){ aus.push(deklaration.slice(start, i)); start = i + 1; } }
    aus.push(deklaration.slice(start)); return aus; };
  const wort = [];
  for(const m of s.matchAll(/animation:([^;}]*)/g)){
    if(imRuhigen(m.index)) continue;
    for(const stueck of teile(m[1])){
      const ohneKlammern = stueck.replace(/\([^)]*\)/g, "()");
      const kw = ohneKlammern.match(/(?:^|\s)(ease-out|ease-in-out|ease-in|linear)(?=\s|$)/);
      if(!kw) continue;
      const name = (stueck.trim().match(/^[A-Za-z][\w-]*/) || [""])[0];
      if(kw[1] === "linear" && GLEICHFOERMIG.includes(name)) continue;
      wort.push(("animation:" + stueck.trim()).slice(0, 52));
    }
  }
  ok(wort.length === 0, "keine Bewegung auf dem schwächeren CSS-Schlüsselwort",
     wort.length ? wort.join(" | ") : "alle auf den Kurven des Hauses");
  console.log("         (" + ruhigBereiche.length +
              " prefers-reduced-motion-Bereiche ausgenommen — dort ist linear Absicht)");

  /* Und die Gegenkurve muss es überhaupt geben. Ohne sie hat das
     Board nur Eingänge — genau der Stand vor diesem Block. */
  ok(/--ease-in\s*:/.test(s), "es gibt eine Kurve für Ausgänge (--ease-in)");
  ok(/--t-blatt-raus\s*:/.test(s), "und eine kürzere Dauer dafür");
}

async function aufmachen(br, ruhig){
  const ctx = await br.newContext({ viewport:{ width:390, height:844 },
    reducedMotion: ruhig ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  const kons = [];
  p.on("pageerror", e => kons.push(String(e).slice(0, 150)));
  await p.route("**/*", r => r.request().url().startsWith("file://")
    ? r.continue() : r.abort());
  await p.goto("file://" + path.join(SEITEN, "admin.html"));
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    document.getElementById("tor").hidden = true;
    if(typeof demoStarten === "function"){ demoStarten(); zeichneAlles(); }
  });
  await p.waitForTimeout(400);
  const sch = await p.$("#scharfJetzt");
  if(sch && await p.isVisible("#scharf")){ await sch.click(); await p.waitForTimeout(300); }
  return { p, ctx, kons };
}

/* ── 2 bis 4 · Das Blatt geht auf und wieder zu ─────────────────── */
async function blattWeg(br, ruhig){
  console.log("\n══ Das Blatt " + (ruhig ? "· ohne Bewegung" : "· mit Bewegung") + " ══");
  const h = await aufmachen(br, ruhig);

  await h.p.evaluate(() => tafelZeigen("speisekarte"));
  await h.p.waitForTimeout(300);
  await h.p.evaluate(() => blattOeffnen && blattOeffnen(null));
  await h.p.waitForTimeout(500);

  /* Voraussetzung, und sie wird GEPRÜFT: Wo nie etwas offen war, ist
     auch nichts mehr zu — und „nichts da" sieht aus wie
     „geschlossen" (§8.1g, Vorfall C). */
  const offen = await h.p.evaluate(() => !document.getElementById("blatt").hidden);
  ok(offen, "Voraussetzung: das Blatt ist offen",
     offen ? "offen" : "ging nicht auf — alles Weitere sagt nichts aus");
  if(!offen){ await h.ctx.close(); return; }

  await h.p.evaluate(() => blattSchliessen());

  if(ruhig){
    /* Ohne Bewegung muss es SOFORT zu sein, nicht nach 200 ms. */
    await h.p.waitForTimeout(40);
    ok(await h.p.evaluate(() => document.getElementById("blatt").hidden),
       "ohne Bewegung ist es sofort zu — keine Wartezeit für nichts");
  } else {
    /* Mitten in der Bewegung: noch offen, und die Klasse trägt. */
    await h.p.waitForTimeout(80);
    const mitten = await h.p.evaluate(() => {
      const b = document.getElementById("blatt");
      const i = b.querySelector(".blattinhalt");
      return { offen: !b.hidden, geht: b.classList.contains("geht"),
               bewegt: getComputedStyle(i).animationName };
    });
    ok(mitten.offen && mitten.geht, "während des Ausgangs liegt es noch da",
       JSON.stringify(mitten));
    ok(mitten.bewegt === "blattRunter", "und fährt nach unten heraus", mitten.bewegt);

    /* Und danach ist es WEG. Eine Animation, die das Schließen
       verzögert und dann vergisst, blockiert das ganze Board. */
    await h.p.waitForTimeout(320);
    const danach = await h.p.evaluate(() => {
      const b = document.getElementById("blatt");
      return { zu: b.hidden, klasse: b.classList.contains("geht") };
    });
    ok(danach.zu, "danach ist es wirklich zu", JSON.stringify(danach));
    ok(!danach.klasse, "und die Klasse ist wieder weg — sonst bliebe sie beim Öffnen kleben");
  }

  ok(h.kons.length === 0, "keine Ausnahme", h.kons[0] || "still");
  await h.ctx.close();
}

/* ── 4 · Zweimal tippen ─────────────────────────────────────────── */
async function zweimal(br){
  console.log("\n══ Zweimal geschlossen ══");
  const h = await aufmachen(br, false);
  await h.p.evaluate(() => tafelZeigen("speisekarte"));
  await h.p.waitForTimeout(300);
  await h.p.evaluate(() => blattOeffnen && blattOeffnen(null));
  await h.p.waitForTimeout(450);
  ok(await h.p.evaluate(() => !document.getElementById("blatt").hidden),
     "Voraussetzung: offen");
  /* Zwei Aufrufe dicht hintereinander. Der zweite darf keine zweite
     Animation starten und den ersten Abschluss nicht verlieren. */
  await h.p.evaluate(() => { blattSchliessen(); blattSchliessen(); });
  await h.p.waitForTimeout(420);
  ok(await h.p.evaluate(() => document.getElementById("blatt").hidden),
     "auch nach zwei Aufrufen ist es zu, nicht hängen geblieben");
  ok(h.kons.length === 0, "keine Ausnahme", h.kons[0] || "still");
  await h.ctx.close();
}

/* ── 5 · Die Wischgeste und der Ausgang dürfen sich nicht doppeln ─ */
async function wischen(br){
  console.log("\n══ Wischgeste über denselben Weg ══");
  const h = await aufmachen(br, false);
  await h.p.evaluate(() => tafelZeigen("speisekarte"));
  await h.p.waitForTimeout(300);
  await h.p.evaluate(() => blattOeffnen && blattOeffnen(null));
  await h.p.waitForTimeout(450);
  ok(await h.p.evaluate(() => !document.getElementById("blatt").hidden),
     "Voraussetzung: offen");

  /* Die Geste stellt eine Inline-Angabe. Genau daran erkennt der
     Ausgang, dass er sich heraushalten muss. Hier wird der Zustand
     nachgestellt, den die Geste beim Aufruf von zu() hinterlässt. */
  const stand = await h.p.evaluate(() => {
    const i = document.querySelector("#blatt .blattinhalt");
    i.style.transform = "translate3d(0,400px,0)";
    blattSchliessen();
    const b = document.getElementById("blatt");
    return { sofortZu: b.hidden, keineKlasse: !b.classList.contains("geht") };
  });
  ok(stand.sofortZu, "ein schon hinausgeschobenes Blatt schließt SOFORT",
     stand.sofortZu ? "sofort" : "wartete auf eine zweite Animation");
  ok(stand.keineKlasse, "und bekommt keine zweite Bewegung übergezogen");
  ok(h.kons.length === 0, "keine Ausnahme", h.kons[0] || "still");
  await h.ctx.close();
}

/* ── Der Endzustand bei reduzierter Bewegung ────────────────────── */
async function endzustand(br){
  console.log("\n══ Ohne Bewegung ist alles sichtbar ══");
  const h = await aufmachen(br, true);
  /* Die gestaffelten „Mehr"-Knöpfe sind der Fall, der schiefgehen
     KANN: animation-delay plus both heisst, dass ein Knopf vor
     seinem Beginn auf dem Anfangsbild liegt — also unsichtbar. */
  const mehr = await h.p.$("#mehrKnopf");
  if(mehr){ await mehr.click(); await h.p.waitForTimeout(300); }
  const unsichtbar = await h.p.evaluate(() => {
    const raus = [];
    document.querySelectorAll(".mehrfach button, .blattinhalt, .bestellung").forEach(el => {
      const s = getComputedStyle(el);
      if(el.getBoundingClientRect().height > 0 && parseFloat(s.opacity) < .9)
        raus.push((el.id || el.className || el.tagName) + " opacity " + s.opacity);
    });
    return raus;
  });
  ok(unsichtbar.length === 0, "kein Element bleibt halb durchsichtig liegen",
     unsichtbar.length ? unsichtbar.join(" | ") : "alles sichtbar");
  ok(h.kons.length === 0, "keine Ausnahme", h.kons[0] || "still");
  await h.ctx.close();
}

(async () => {
  eigenschaften();
  const br = await chromium.launch();
  await blattWeg(br, false);
  await blattWeg(br, true);
  await zweimal(br);
  await wischen(br);
  await endzustand(br);
  await br.close();
  console.log(fehler === 0
    ? "\n✓ Die Bewegung trägt — Grafikkarte, Endzustand, Ausgang, Geste."
    : "\n✗ " + fehler + " Fehler.");
  process.exit(fehler ? 1 : 0);
})();
