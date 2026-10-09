/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · „Dein Team“ im Konto (migration-team.sql, team-zugang)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-team.js

   Der Besitzer lädt Personen ein, ändert die Rolle, gibt das Recht für
   Gutscheine samt Grenzen und entfernt — jede Person mit eigenem
   Zugang. Gemessen wird, WAS die Seite an die Edge Function schickt und
   wie sie jede Antwort in einen Satz übersetzt; die Antworten selbst
   sind gestellt.

   ZWEI ZWEITE QUELLEN (§8.1b):
     · supabase/functions/team-zugang/index.ts — jeder Grund, den die
       Funktion mit fehler("…") zurückgeben kann, braucht auf der Seite
       einen Satz. Ausgenommen nur, was die Seite nie auslösen kann —
       namentlich unten in NIE_VON_DER_SEITE, kein Muster (§8.1g D).
     · datenbank/migration-rollen.sql — die CHECK-Schranke
       betrieb_mitglieder_grenzen gegen GRENZEN in der Funktion und die
       Felder auf der Seite (max-Attribute).

   EHRLICHE GRENZE: Ob die Einladungsmail ankommt, hängt am
   Mailversand (SMTP) in Supabase — das zeigt nur ein echter Versuch.
   Die Rechte selbst: datenbank/pruef-rechte.sql TEIL 8 und die
   zurückgedrehte Probe in migration-team.sql.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const KONTO = path.join(OBEN, "seiten", "konto.html");
const EDGE = path.join(OBEN, "supabase", "functions", "team-zugang", "index.ts");
const MIG = path.join(OBEN, "datenbank", "migration-rollen.sql");

/* Gründe, die die Seite gar nicht auslösen kann: sie schickt immer
   JSON per POST mit gültiger Aktion, Betrieb und Nutzer aus der Liste. */
const NIE_VON_DER_SEITE = ["nur_post", "kein_json", "betrieb", "aktion", "nutzer", "nichts", "ausnahme"];

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

const BIBLIOTHEK = `
window.__aufrufe = []; window.__antwort = { ok:true, versandt:true };
window.__rolle = window.__rolle || "inhaber";
window.supabase = { createClient: function(){
  const TEAM = [
    { nutzer_id:"11111111-1111-4111-8111-111111111111", email:"wirt@example.org", anzeigename:null, rolle:"inhaber", ich:true,
      zuletzt:new Date().toISOString(), bestaetigt:true, hat_pin:true, pin_gesperrt:false,
      darf_gutscheine:false, gutschein_max_betrag:10, gutschein_max_prozent:20, gutschein_tag_max:5 },
    { nutzer_id:"22222222-2222-4222-8222-222222222222", email:"service@example.org", anzeigename:"Mara", rolle:"team", ich:false,
      zuletzt:null, bestaetigt:false, hat_pin:false, pin_gesperrt:false,
      darf_gutscheine:false, gutschein_max_betrag:10, gutschein_max_prozent:20, gutschein_tag_max:5 }
  ];
  function kette(tab){
    const z = { tab, einzeln:false };
    const p = new Proxy(function(){}, {
      get(_, k){
        /* Wie bei supabase-js: then gibt ein Promise zurück, sonst
           bricht jedes .then(…).catch(…) der Seite. */
        if(k === "then") return (res, rej) => {
          const d = tab === "betrieb_mitglieder" ? { data:[{ betrieb_id:"b1", rolle:window.__rolle }], error:null }
            : tab === "betriebe" ? { data:{ id:"b1", slug:"choco", name:"Choco", plan:"start" }, error:null }
            : { data: z.einzeln ? null : [], count:0, error:null };
          return Promise.resolve(d).then(res, rej);
        };
        return (...a) => { if(k === "single" || k === "maybeSingle") z.einzeln = true; return p; };
      }
    });
    return p;
  }
  return {
    auth: {
      getSession: async () => ({ data:{ session:{ user:{ id:"11111111-1111-4111-8111-111111111111", email:"wirt@example.org" } } }, error:null }),
      getUser: async () => ({ data:{ user:{ id:"11111111-1111-4111-8111-111111111111" } } }),
      onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
      signOut: async () => ({})
    },
    from: kette,
    rpc: async (name, args) => {
      window.__aufrufe.push({ rpc:name, args });
      /* Wie die Datenbank: team_liste ist für Nicht-Inhaber leer. */
      if(name === "team_liste") return { data: window.__rolle === "inhaber" ? TEAM : [], error:null };
      return { data:null, error:null };
    },
    functions: { invoke: async (name, o) => {
      window.__aufrufe.push({ fn:name, body:o && o.body });
      return { data: window.__antwort, error:null };
    } },
    storage: { from: () => kette("speicher") }
  };
} };`;

async function oeffnen(browser, rolle, breite) {
  const ctx = await browser.newContext({ viewport: { width: breite || 390, height: 900 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await p.addInitScript("window.__rolle = " + JSON.stringify(rolle) + ";");
  await p.addInitScript(BIBLIOTHEK);
  await p.route("**/*", r => {
    const u = r.request().url();
    if (/supabase-js/.test(u)) return r.abort();
    return u.startsWith("file://") ? r.continue() : r.abort();
  });
  await p.goto("file://" + KONTO);
  await p.waitForTimeout(900);
  await p.evaluate(() => { const k = document.querySelector('[data-blatt="zugaenge"]'); if (k) k.click(); });
  await p.waitForTimeout(400);
  return { ctx, p, fehler };
}

const meldung = p => p.evaluate(() => { const m = document.getElementById("teamMeldung"); return m.hidden ? "" : m.textContent; });
const letzter = p => p.evaluate(() => { const a = window.__aufrufe.filter(x => x.fn); return a.length ? a[a.length - 1] : null; });
const anzahlFn = p => p.evaluate(() => window.__aufrufe.filter(x => x.fn).length);

(async () => {
  /* ══ 0 · Zweite Quellen ══ */
  console.log("\n══ Zweite Quellen: Gründe der Funktion, Grenzen der Datenbank ══");
  const edge = fs.readFileSync(EDGE, "utf8");
  const gruende = [...new Set([...edge.matchAll(/fehler\("([a-z_]+)"/g)].map(m => m[1]))];
  pruef(gruende.length >= 10, "Gründe aus team-zugang gelesen", gruende.join(", "));
  const konto = fs.readFileSync(KONTO, "utf8");
  const satzTeil = konto.match(/const TEAM_GRUND = \{([\s\S]*?)\n\};/);
  const saetze = satzTeil ? [...satzTeil[1].matchAll(/^\s*([a-z_]+):/gm)].map(m => m[1]) : [];
  const ohne = gruende.filter(g => !saetze.includes(g) && !NIE_VON_DER_SEITE.includes(g));
  pruef(ohne.length === 0, "jeder Grund, den die Seite auslösen kann, hat einen Satz", ohne.join(", ") || "alle");

  const mig = fs.readFileSync(MIG, "utf8");
  const sch = {
    betrag: +(mig.match(/gutschein_max_betrag\s+between 0 and (\d+)/) || [])[1],
    prozent: +(mig.match(/gutschein_max_prozent between 0 and (\d+)/) || [])[1],
    tag: +(mig.match(/gutschein_tag_max\s+between 0 and (\d+)/) || [])[1],
    name: +(mig.match(/length\(anzeigename\) between 1 and (\d+)/) || [])[1]
  };
  const g = edge.match(/const GRENZEN = \{ betrag: (\d+), prozent: (\d+), tag: (\d+), name: (\d+) \}/);
  pruef(g && +g[1] === sch.betrag && +g[2] === sch.prozent && +g[3] === sch.tag && +g[4] === sch.name,
    "Grenzen der Funktion = CHECK-Schranke", JSON.stringify(sch) + " / " + (g ? g.slice(1).join(",") : "nicht gefunden"));

  /* Die Zahlprüfung der Funktion selbst, aus ihrem Quelltext: „“ und
     true dürfen nie als 0 € bzw. 1 € durchgehen (Anlassfall: ein
     deutsches Telefon schickt aus einem Zahlenfeld mit Komma „“). */
  const zt = edge.match(/function zahl\(w: unknown, max: number\): number \| null \{[\s\S]*?\n\}/);
  if (zt) {
    const zahl = new Function("return " + zt[0].replace("(w: unknown, max: number): number | null", "(w, max)"))();
    const faelle = [["", null], [" ", null], [true, null], [null, null], ["7.5", 7.5], [7.5, 7.5], ["501", null], ["-1", null], ["2e2", null]];
    const falsch = faelle.filter(([e, s]) => zahl(e, 500) !== s).map(([e]) => JSON.stringify(e));
    pruef(falsch.length === 0, "Funktion: leer, true, Exponent, negativ und zu groß werden abgewiesen", falsch.join(", ") || "alle " + faelle.length);
  } else pruef(false, "Voraussetzung: zahl() in team-zugang gefunden");

  const browser = await chromium.launch();

  /* ══ 1 · Besitzer ══ */
  console.log("\n══ Als Besitzer ══");
  {
    const { ctx, p, fehler } = await oeffnen(browser, "inhaber");
    const liste = await p.evaluate(() => [...document.querySelectorAll(".tm-zeile")].map(z => ({
      wer: z.querySelector(".tm-wer b").textContent,
      rolleWahl: !!z.querySelector("[data-tm-rolle]"), raus: !!z.querySelector("[data-tm-raus]"),
      haken: !!z.querySelector("[data-tm-gutschein]")
    })));
    pruef(liste.length === 2, "Voraussetzung: zwei Zeilen aus team_liste", liste.length);
    const ich = liste.find(x => / · du$/.test(x.wer)), mara = liste.find(x => /Mara/.test(x.wer));
    pruef(ich && !ich.rolleWahl && !ich.raus, "eigene Zeile: weder Rolle ändern noch entfernen");
    pruef(mara && mara.rolleWahl && mara.raus && mara.haken, "Team-Zeile: Rolle, Gutschein-Recht, Entfernen");
    pruef(await p.isVisible("#teamForm"), "Einladungsformular sichtbar");

    /* Einladen, Mail ging hinaus */
    await p.fill("#tmMail", " Neu@Example.org ");
    await p.fill("#tmName", "Jo");
    await p.selectOption("#tmRolle", "kueche");
    await p.click("#tmEinladen");
    await p.waitForTimeout(300);
    const e1 = await letzter(p);
    pruef(e1 && e1.fn === "team-zugang" && e1.body.aktion === "einladen" && e1.body.betrieb_id === "b1" &&
      e1.body.email === "Neu@Example.org" && e1.body.rolle === "kueche" && e1.body.anzeigename === "Jo",
      "Einladen schickt Aktion, Betrieb, Adresse, Rolle, Namen", JSON.stringify(e1 && e1.body));
    pruef(/unterwegs/.test(await meldung(p)), "versandt → Satz „Einladung … unterwegs“", await meldung(p));
    pruef(await p.inputValue("#tmMail") === "", "Feld danach leer");

    /* Ohne Mail: Link einmal zeigen */
    await p.evaluate(() => { window.__antwort = { ok:true, versandt:false, link:"https://x.supabase.co/auth/v1/verify?token=abc&type=invite" }; });
    await p.fill("#tmMail", "zwei@example.org");
    await p.click("#tmEinladen");
    await p.waitForTimeout(300);
    const l = await p.evaluate(() => ({ sicht: !document.getElementById("tmLink").hidden, text: document.getElementById("tmLinkText").textContent }));
    pruef(l.sicht && /type=invite/.test(l.text), "kein Mailversand → Link sichtbar zum Weitergeben", l.text);

    /* Grenze und falsche Adresse */
    await p.evaluate(() => { window.__antwort = { ok:false, grund:"grenze" }; });
    await p.fill("#tmMail", "drei@example.org");
    await p.click("#tmEinladen");
    await p.waitForTimeout(300);
    pruef(/20 Einladungen/.test(await meldung(p)), "Grenze → Satz statt JSON", await meldung(p));
    const vorher = await anzahlFn(p);
    await p.fill("#tmMail", "kaputt@");
    await p.click("#tmEinladen");
    await p.waitForTimeout(200);
    pruef(await anzahlFn(p) === vorher && /nicht vollständig/.test(await meldung(p)), "unvollständige Adresse: kein Aufruf, ein Satz");

    /* Rolle ändern, letzter Inhaber */
    await p.evaluate(() => { window.__antwort = { ok:false, grund:"letzter_inhaber" }; });
    const zeile = '[data-tm="22222222-2222-4222-8222-222222222222"]';
    await p.selectOption(zeile + " [data-tm-rolle]", "inhaber");
    await p.waitForTimeout(300);
    const r1 = await letzter(p);
    pruef(r1.body.aktion === "aendern" && r1.body.nutzer_id === "22222222-2222-4222-8222-222222222222" && r1.body.rolle === "inhaber",
      "Rolle ändern schickt genau diese Person und Rolle", JSON.stringify(r1.body));
    pruef(/mindestens einen Besitzer/.test(await meldung(p)), "Abweisung als Satz", await meldung(p));

    /* Gutschein-Recht und Grenzen */
    await p.evaluate(() => { window.__antwort = { ok:true }; });
    await p.click(zeile + " [data-tm-gutschein]");
    await p.waitForTimeout(300);
    const r2 = await letzter(p);
    pruef(r2.body.aktion === "aendern" && r2.body.darf_gutscheine === true, "Haken schickt darf_gutscheine true", JSON.stringify(r2.body));
    pruef(await p.isVisible(zeile + " .tm-grenzen"), "danach stehen die Grenzen da");
    await p.fill(zeile + " [data-tm-betrag]", "7,5");
    await p.click(zeile + " [data-tm-grenzen]");
    await p.waitForTimeout(300);
    const r3 = await letzter(p);
    pruef(r3.body.gutschein_max_betrag === 7.5 && r3.body.gutschein_max_prozent === 20 && r3.body.gutschein_tag_max === 5,
      "Sichern schickt alle drei Grenzen als Zahl — „7,5“ mit Komma wird 7.5", JSON.stringify(r3.body));
    const maxe = await p.evaluate(z => ["[data-tm-betrag]", "[data-tm-prozent]", "[data-tm-tag]"].map(s => +document.querySelector(z + " " + s).dataset.max), zeile);
    pruef(maxe[0] === sch.betrag && maxe[1] === sch.prozent && maxe[2] === sch.tag, "Felder tragen die Grenzen der Datenbank", maxe.join("/"));
    /* Der Anlassfall: leer darf nie als 0 € hinausgehen. */
    for (const [feld, wert] of [["[data-tm-betrag]", ""], ["[data-tm-betrag]", "abc"], ["[data-tm-prozent]", "120"], ["[data-tm-tag]", "2,5"]]) {
      await p.fill(zeile + " [data-tm-betrag]", "7,5"); await p.fill(zeile + " [data-tm-prozent]", "20"); await p.fill(zeile + " [data-tm-tag]", "5");
      await p.fill(zeile + " " + feld, wert);
      const vor = await anzahlFn(p);
      await p.click(zeile + " [data-tm-grenzen]");
      await p.waitForTimeout(150);
      pruef(await anzahlFn(p) === vor && /bitte|Höchstens/i.test(await meldung(p)),
        "„" + wert + "“ in " + feld + ": kein Aufruf, ein Satz", await meldung(p));
    }

    /* Entfernen: zwei Tipps */
    const v = await anzahlFn(p);
    await p.click(zeile + " [data-tm-raus]");
    await p.waitForTimeout(150);
    pruef(await anzahlFn(p) === v && /Wirklich/.test(await p.textContent(zeile + " [data-tm-raus]")), "erster Tipp auf Entfernen fragt nur");
    await p.click(zeile + " [data-tm-raus]");
    await p.waitForTimeout(300);
    const r4 = await letzter(p);
    pruef(r4.body.aktion === "entfernen" && r4.body.nutzer_id === "22222222-2222-4222-8222-222222222222", "zweiter Tipp entfernt genau diese Person");

    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  /* ══ 2 · Team im Konto ══ */
  console.log("\n══ Als Team ══");
  {
    const { ctx, p, fehler } = await oeffnen(browser, "team");
    const s = await p.evaluate(() => ({ form: !document.getElementById("teamForm").hidden,
      text: document.getElementById("teamListe").textContent }));
    pruef(!s.form && /nur ein Besitzer/.test(s.text), "kein Formular, ein Satz", s.text);
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  /* ══ 3 · Telefon: 16 px, 44 px, nichts läuft seitlich über ══ */
  console.log("\n══ 360 px ══");
  {
    const { ctx, p } = await oeffnen(browser, "inhaber", 360);
    await p.click('[data-tm="22222222-2222-4222-8222-222222222222"] [data-tm-gutschein]');
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const t = document.getElementById("teamTafel");
      const felder = [...t.querySelectorAll("input:not([type=checkbox]),select")];
      const knoepfe = [...t.querySelectorAll("button,select,label.tm-haken")].filter(e => e.offsetParent);
      return {
        klein: felder.filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.id || e.className || e.tagName),
        niedrig: knoepfe.filter(e => e.getBoundingClientRect().height < 44 - 0.5).map(e => (e.textContent || e.tagName).trim().slice(0, 20)),
        breit: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ueber: [...t.querySelectorAll("*")].filter(e => e.getBoundingClientRect().right > t.getBoundingClientRect().right + 1).length
      };
    });
    pruef(m.klein.length === 0, "jedes Feld 16 px (kein Zoom auf iOS)", m.klein.join(", ") || "ok");
    pruef(m.niedrig.length === 0, "jede Tapfläche ≥ 44 px", m.niedrig.join(", ") || "ok");
    pruef(m.breit <= 0 && m.ueber === 0, "nichts läuft seitlich über", m.breit + " px / " + m.ueber + " Elemente");
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
