/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Besitzer und Team im Board (migration-rollen.sql)

     NODE_PATH=$(npm root -g) node pruefungen/pruef-rollen.js

   Die Datenbank entscheidet (Wachen + Regeln, gemessen in
   datenbank/pruef-rechte.sql TEIL 8). Das Board sagt es VORHER: Was
   nur der Besitzer ändert, ist für das Team sichtbar, aber gesperrt —
   mit Satz statt stillem Fehlen. Eine Abweisung vom Server erscheint
   als derselbe Satz, nie als rohes Postgres.

   Gemessen wird über den ECHTEN Weg: ein gestelltes `db` antwortet auf
   betrieb_mitglieder mit rolle 'team' und dann läuft betriebWaehlen()
   — nicht rolleAnwenden("team") direkt. Sonst prüfte die Probe gegen
   eine Erfindung (§8.1i): dass die Rolle aus der Abfrage überhaupt
   bis zur Sperre kommt.

   ZWEITE QUELLE (§8.1b): Jede Einstellungsgruppe des Boards muss in
   GENAU einer der beiden Listen unten stehen. Kommt eine neue Gruppe
   dazu, wird diese Prüfung rot, bis jemand entschieden hat, wem sie
   gehört — ein Vergessen fällt sonst nie auf.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const ADMIN = path.join(__dirname, "..", "seiten", "admin.html");

const NUR_INHABER = ["Bewegte Emojis", "Kopf & Logo", "Texte & Schrift", "Schrift", "Farben des Hubs", "Kacheln", "Aktions-Banner-Rad",
  "Ihre Worte im Gast-Hub", "Lieferung", "Gäste-Newsletter", "Eigene Rabattcodes",
  "Gutscheine für Stammgäste", "Bestellstand beim Gast", "Foodroulette", "Figur des Hauses",
  "Wer hat was geändert"];
const AUCH_TEAM = ["Auf einen Blick", "Melden", "Bildschirm", "Nichts übersehen", "Betrieb", "Dieses Gerät"];
const SATZ = "Nur der Besitzer kann das ändern.";

let n = 0, f = 0;
function pruef(b, t, d) {
  n++; if (!b) f++;
  console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : ""));
}

/* Gestelltes Supabase: jede Kette (from().select().eq().order()…) ist
   dasselbe Objekt und löst beim await auf. Schreibende Aufrufe werden
   mitgeschrieben; die Wache wird nachgestellt wie live gemessen. */
function stelleDb(betriebe) {
  return (betriebe) => {
    window.__schreib = [];
    const GERICHTE = [
      { id: "g1", betrieb_id: "b-team", name: "Probe-Crêpe", preis: 6.5, verfuegbar: true,
        karte: "speisekarte", kategorie: "Crêpes", reihenfolge: 0, kat_sort: 0 },
      { id: "g2", betrieb_id: "b-team", name: "Probe-Waffel", preis: 5, verfuegbar: true,
        karte: "speisekarte", kategorie: "Crêpes", reihenfolge: 1, kat_sort: 0 }
    ];
    function rolleVon(id) { const b = betriebe.find(x => x.id === id); return b ? b.rolle : null; }
    function antwort(z) {
      if (z.op !== "select") {
        window.__schreib.push({ tab: z.tab, op: z.op, daten: z.daten });
        const team = rolleVon(betriebId) !== "inhaber";
        if (team && z.tab === "gerichte" && z.op === "update" &&
            Object.keys(z.daten || {}).some(k => k !== "verfuegbar" && k !== "geaendert"))
          return { data: null, error: { message: "nur_inhaber", code: "42501" } };
        return { data: null, error: null };
      }
      if (z.tab === "betrieb_mitglieder")
        return { data: betriebe.map(b => ({ rolle: b.rolle,
          betriebe: { id: b.id, slug: b.id, name: b.name, bestell_pause: false, hub_texte: {} } })), error: null };
      if (z.tab === "gerichte") return { data: GERICHTE.filter(g => g.betrieb_id === betriebId || true)
        .map(g => Object.assign({}, g, { betrieb_id: betriebId })), error: null };
      return { data: z.einzeln ? null : [], error: null };
    }
    function kette(tab) {
      const z = { tab, op: "select", daten: null, einzeln: false };
      const p = new Proxy(function () {}, {
        get(_, k) {
          if (k === "then") return (res) => res(antwort(z));
          return (...a) => {
            if (["update", "insert", "upsert", "delete"].includes(k)) { z.op = k; z.daten = a[0]; }
            if (k === "maybeSingle" || k === "single") z.einzeln = true;
            return p;
          };
        },
        apply() { return p; }
      });
      return p;
    }
    db = {
      from: kette,
      rpc: () => kette("rpc"),
      channel: () => kette("kanal"),
      removeChannel: async () => {},
      storage: { from: () => kette("speicher") },
      functions: { invoke: async () => ({ data: null, error: null }) },
      auth: {
        getSession: async () => ({ data: { session: null } }),
        getUser: async () => ({ data: { user: { id: "u1", email: "probe@example.org" } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
      }
    };
    demo = false;
  };
}

async function oeffnen(browser, betriebe, breite) {
  const ctx = await browser.newContext({ viewport: { width: breite || 390, height: 900 } });
  const seite = await ctx.newPage();
  const fehler = [];
  seite.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await seite.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await seite.goto("file://" + ADMIN);
  await seite.waitForTimeout(600);
  const scharf = await seite.$("#scharfJetzt");
  if (scharf && await seite.isVisible("#scharf")) { await scharf.click(); await seite.waitForTimeout(150); }
  await seite.evaluate(stelleDb(), betriebe);
  await seite.evaluate(async () => {
    document.getElementById("tor").hidden = true;
    try { localStorage.setItem(merkSchluessel(), "b-team"); } catch (e) {}
    await betriebWaehlen();
  });
  await seite.waitForTimeout(400);
  return { ctx, seite, fehler };
}

async function tafel(seite, name) {
  await seite.evaluate(n => { const k = document.querySelector('[data-tafel="' + n + '"]'); if (k) k.click(); }, name);
  await seite.waitForTimeout(300);
}

/* Liest jede Einstellungsgruppe: Titel, Satz da, ist ein Bedienelement
   darin noch erreichbar (nicht in [inert])? */
function gruppenLesen() {
  return [...document.querySelectorAll(".egruppe")].map(g => {
    const titel = (g.querySelector(".etitel") || {}).textContent || "";
    const satz = g.querySelector(":scope > .nur-inhaber-satz");
    const bedien = [...g.querySelectorAll("input,select,textarea,button")]
      .filter(el => !el.closest(".nur-inhaber-satz"));
    const frei = bedien.filter(el => !el.closest("[inert]")).length;
    return { titel: titel.trim(), satz: satz ? satz.textContent.trim() : "", markiert: g.hasAttribute("data-nur-inhaber"),
             bedien: bedien.length, frei };
  });
}

(async () => {
  const browser = await chromium.launch();

  /* ══ 0 · Zweite Quelle: jede Gruppe ist entschieden ══ */
  console.log("\n══ Jede Einstellungsgruppe hat eine Entscheidung ══");
  {
    const { ctx, seite } = await oeffnen(browser, [{ id: "b-team", name: "Choco", rolle: "inhaber" }]);
    const g = await seite.evaluate(gruppenLesen);
    const titel = g.map(x => x.titel);
    const offen = titel.filter(t => !NUR_INHABER.includes(t) && !AUCH_TEAM.includes(t));
    pruef(offen.length === 0, "keine Gruppe ohne Entscheidung (Besitzer oder Team)", offen.join(", ") || "alle " + titel.length);
    const fehltImBoard = NUR_INHABER.concat(AUCH_TEAM).filter(t => !titel.includes(t));
    pruef(fehltImBoard.length === 0, "jede Gruppe der Listen gibt es im Board", fehltImBoard.join(", ") || "ok");
    const falschMarkiert = g.filter(x => NUR_INHABER.includes(x.titel) !== x.markiert).map(x => x.titel);
    pruef(falschMarkiert.length === 0, "data-nur-inhaber steht genau an den Besitzer-Gruppen", falschMarkiert.join(", ") || "ok");
    await ctx.close();
  }

  /* ══ 1 · Team ══ */
  console.log("\n══ Als Team (Rolle kommt aus betrieb_mitglieder) ══");
  {
    const { ctx, seite, fehler } = await oeffnen(browser, [{ id: "b-team", name: "Choco", rolle: "team" }]);
    const rolle = await seite.evaluate(() => ({ body: document.body.dataset.rolle, ROLLE, id: betriebId }));
    pruef(rolle.body === "team" && rolle.id === "b-team", "Voraussetzung: Betrieb geöffnet, Rolle team angekommen", JSON.stringify(rolle));

    await tafel(seite, "einstellungen");
    const g = await seite.evaluate(gruppenLesen);
    for (const t of NUR_INHABER) {
      const x = g.find(y => y.titel === t);
      if (!x) { pruef(false, t + ": Gruppe gefunden"); continue; }
      pruef(x.satz === SATZ && x.bedien > 0 && x.frei === 0,
        t + ": Satz steht da, kein Bedienelement erreichbar", x.frei + " von " + x.bedien + " frei");
    }
    for (const t of AUCH_TEAM) {
      const x = g.find(y => y.titel === t);
      if (!x) continue;
      pruef(!x.satz && x.frei === x.bedien, t + ": bleibt für das Team bedienbar", x.frei + "/" + x.bedien);
    }

    /* Echter Tipp auf einen Schalter in einer Besitzer-Gruppe: Er darf
       nichts tun. elementFromPoint statt .click() — gemessen wird, was
       ein Finger trifft (§3.9). */
    const lief = await seite.evaluate(() => {
      const w = document.getElementById("lfAn"); if (!w) return null;
      const vorher = w.getAttribute("aria-pressed");
      w.scrollIntoView({ block: "center" });
      const r = w.getBoundingClientRect();
      return { vorher, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (lief) {
      await seite.mouse.click(lief.x, lief.y);
      await seite.waitForTimeout(200);
      const nach = await seite.evaluate(() => ({ an: document.getElementById("lfAn").getAttribute("aria-pressed"), schreib: window.__schreib.length }));
      /* Voraussetzung: der Zustand ist überhaupt lesbar — sonst wäre
         „vorher = nachher“ immer wahr (§8.1g). */
      pruef(lief.vorher === "true" || lief.vorher === "false", "Voraussetzung: Zustand des Schalters lesbar", lief.vorher);
      pruef(nach.an === lief.vorher && nach.schreib === 0, "Tipp auf „Lieferung an“ ändert nichts und schreibt nichts", JSON.stringify(nach));
    } else pruef(false, "Voraussetzung: Lieferungs-Schalter #lfAn gefunden");

    /* Karte */
    await tafel(seite, "speisekarte");
    const k = await seite.evaluate(() => {
      const sicht = el => !!el && getComputedStyle(el).display !== "none" && !el.closest("[hidden]");
      return {
        gerichte: document.querySelectorAll("#karteListe [data-klapp]").length,
        satz: sicht(document.getElementById("karteTeamSatz")),
        knoepfe: sicht(document.querySelector(".kartenknoepfe")),
        runner: sicht(document.getElementById("runner")),
        bearbeiten: [...document.querySelectorAll("[data-bearbeiten],[data-schieb],[data-katschieb],[data-kted-neu],[data-karte-neu],[data-karten-bearbeiten]")].filter(sicht).length,
        kopf: !!document.querySelector("[data-kted]")
      };
    });
    pruef(k.gerichte >= 2, "Voraussetzung: die Karte ist gezeichnet", k.gerichte + " Gerichte");
    pruef(k.satz, "Karte: Satz „ändert nur der Besitzer … unter Verfügbar“ sichtbar");
    pruef(!k.knoepfe && !k.runner, "Karte: „Gericht hinzufügen“, „Karte einlesen“ und Top-Runner nicht da");
    pruef(k.bearbeiten === 0, "Karte: kein Bearbeiten-, Verschiebe- oder Anlegen-Knopf sichtbar", k.bearbeiten + " sichtbar");
    if (k.kopf) {
      await seite.evaluate(() => document.querySelector("[data-kted]").click());
      await seite.waitForTimeout(250);
      const r = await seite.evaluate(() => ({
        meldung: document.getElementById("meldung").textContent,
        blatt: [...document.querySelectorAll(".blatt,.decke")].some(b => !b.hidden && getComputedStyle(b).display !== "none" && /Kategorie/.test(b.textContent))
      }));
      pruef(r.meldung === "Nur der Besitzer kann das ändern." && !r.blatt, "Tipp auf den Kategorienkopf öffnet nichts und sagt warum", r.meldung);
    } else pruef(false, "Voraussetzung: Kategorienkopf [data-kted] gezeichnet");

    /* Verfügbar: genau das darf das Team */
    await tafel(seite, "verfuegbar");
    const v = await seite.evaluate(async () => {
      window.__schreib = [];
      const box = document.querySelector('#t-verfuegbar input[type=checkbox]');
      if (!box) return null;
      box.click();
      await new Promise(r => setTimeout(r, 300));
      return { schreib: window.__schreib, meldung: document.getElementById("meldung").textContent };
    });
    pruef(v && v.schreib.length === 1 && v.schreib[0].tab === "gerichte" &&
      JSON.stringify(Object.keys(v.schreib[0].daten)) === '["verfuegbar"]' && /heute aus/.test(v.meldung),
      "Verfügbar: Team setzt ein Gericht auf aus — schreibt NUR verfuegbar", v && (JSON.stringify(v.schreib) + " · " + v.meldung));

    /* Abweisung vom Server wird ein Satz */
    const m = await seite.evaluate(() => {
      const aus = [];
      melde('new row violates row-level security policy for table "gerichte"', true); aus.push(document.getElementById("meldung").textContent);
      melde("nur_inhaber", true); aus.push(document.getElementById("meldung").textContent);
      return aus;
    });
    pruef(m.every(x => x === SATZ), "RLS-Abweisung und Wache erscheinen als Satz, nicht als Postgres", m.join(" | "));

    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  /* ══ 2 · Küche zählt wie Team, unbekannt wie Inhaber ══ */
  console.log("\n══ Küche, unbekannte Rolle ══");
  {
    const { ctx, seite } = await oeffnen(browser, [{ id: "b-team", name: "Choco", rolle: "kueche" }]);
    pruef(await seite.evaluate(() => document.body.dataset.rolle) === "team", "Rolle küche → wie Team gesperrt");
    await ctx.close();
  }
  {
    const { ctx, seite } = await oeffnen(browser, [{ id: "b-team", name: "Choco", rolle: null }]);
    const r = await seite.evaluate(() => ({ rolle: document.body.dataset.rolle, saetze: document.querySelectorAll(".egruppe > .nur-inhaber-satz").length }));
    pruef(r.rolle === "inhaber" && r.saetze === 0, "Rolle fehlt → keine Sperre in der Anzeige (der Server hält trotzdem, §7)", JSON.stringify(r));
    await ctx.close();
  }

  /* ══ 3 · Inhaber, und der Wechsel zwischen zwei Betrieben ══ */
  console.log("\n══ Inhaber; Wechsel Team-Betrieb → eigener Betrieb ══");
  {
    const { ctx, seite, fehler } = await oeffnen(browser, [
      { id: "b-team", name: "Choco", rolle: "team" },
      { id: "b-eigen", name: "Blend", rolle: "inhaber" }]);
    const vor = await seite.evaluate(() => document.body.dataset.rolle);
    pruef(vor === "team", "Voraussetzung: zuerst im Team-Betrieb", vor);
    await seite.evaluate(async () => { await betriebOeffnen("b-eigen"); });
    await seite.waitForTimeout(300);
    await tafel(seite, "einstellungen");
    const g = await seite.evaluate(gruppenLesen);
    const gesperrt = g.filter(x => x.satz || x.frei < x.bedien).map(x => x.titel);
    pruef(gesperrt.length === 0, "nach dem Wechsel: keine Gruppe mehr gesperrt, kein Satz übrig", gesperrt.join(", ") || "alle frei");
    await tafel(seite, "speisekarte");
    const k = await seite.evaluate(() => ({
      satz: !document.getElementById("karteTeamSatz").hidden,
      knoepfe: getComputedStyle(document.querySelector(".kartenknoepfe")).display !== "none",
      bearbeiten: [...document.querySelectorAll("[data-bearbeiten]")].length
    }));
    pruef(!k.satz && k.knoepfe, "Karte: kein Team-Satz, „Gericht hinzufügen“ wieder da", JSON.stringify(k));
    pruef(fehler.length === 0, "keine Skriptfehler", fehler.join(" | "));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (f ? f + " von " + n + " Proben FEHLGESCHLAGEN" : "Alle " + n + " Proben bestanden."));
  process.exit(f ? 1 : 0);
})();
