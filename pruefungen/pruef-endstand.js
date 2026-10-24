/* ═══════════════════════════════════════════════════════════════
   pruef-endstand.js — Eine STORNIERTE oder ABGELEHNTE Bestellung wird von Board
   und Küche nicht wieder aufgeweckt; der Saal zeigt, wie alt sein Stand ist.

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-endstand.js

   Anlass (Integrationsplan Saal↔Küche, Abschnitt 3 und 6): Die Datenbank hat
   keinen Wächter für Statusübergänge. Wer „Starten“ tippt, während der Gast
   zurückzieht, überschrieb die Stornierung („letzter gewinnt“). Und ein
   Kellner am Plan sah bei gekappter Leitung einen alten Stand wie einen
   gültigen.

   Die gestellten Gegenstellen werten den Filter WIE PostgREST aus: Eine Zeile,
   die dem Filter nicht genügt, wird nicht geschrieben und fehlt in der
   Antwort (Rückgabe der Zeilen angefordert) — sonst bliebe jeder Gegenbeweis
   grün, weil ein Stub nichts „überschreiben“ kann (§8.1g).

   1 · Küche: PATCH mit status trägt den Filter und fordert die Zeilen an; bei
       inzwischen stornierter Zeile bleibt der Server-Stand, der Toast sagt
       es OHNE „Erneut“, die Küche holt den Stand neu; ein PATCH OHNE status
       (stornierten Bon abhaken) trägt KEINEN Filter und der Bon verschwindet;
       leere Antwort (204) gilt als gelungen (fail-open).
   2 · Board: statusSetzen, bestaetigen und pruefEntscheiden lassen eine
       stornierte Zeile in Ruhe, nehmen die Anzeige zurück, sagen es und holen
       den Stand; Wege ohne status tragen keinen Filter; ohne lesbare Antwort
       gilt es als gelungen; bei mehreren Zeilen wird nur die verlorene gemeldet.
   3 · Altersband im Saal: erst ab 60 s, nach frischem Stand wieder weg, nie im
       Vorführmodus, der Plan wird dafür nicht neu gebaut, lesbar.
   ═══════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const OBEN = path.resolve(__dirname, "..");
const ADMIN = path.join(OBEN, "seiten", "admin.html");
const KUECHE = path.join(OBEN, "seiten", "kueche.html");

let n = 0, f = 0;
const pruef = (b, t, d) => { n++; if (!b) f++; console.log((b ? "  ok   " : "  FEHL ") + t + (d !== undefined ? "  → " + d : "")); };

/* ── 1 · Küche ─────────────────────────────────────────────────── */
async function kueche(browser, fall) {
  const B = "11111111-1111-1111-1111-111111111111";
  const jetzt = new Date().toISOString();
  const server = { id: "k1", betrieb_id: B, quelle: "tisch", status: fall.serverStatus, tisch: "4",
    positionen: [{ name: "Crêpe", menge: 1 }], notiz: null, zeitpunkt: jetzt, wartezeit_min: 10, bestaetigt_um: jetzt,
    kueche_fertig_um: null, theke_fertig_um: null, storno: fall.storno || [], pruefen: false };
  const log = { patches: [], gets: 0 };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.route("**/*", r => {
    const u = decodeURIComponent(r.request().url());
    const json = (b, st) => r.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(b) });
    if (u.startsWith("file://")) return r.continue();
    if (u.includes("/rest/v1/bestellungen")) {
      if (r.request().method() === "PATCH") {
        const body = JSON.parse(r.request().postData() || "{}");
        const kopf = r.request().headers();
        const orForm = /[?&]or=\(status\.is\.null,status\.not\.in\.\(storniert,abgelehnt\)\)/.test(u);
        const nurNot = /[?&]status=not\.in\./.test(u);
        const filter = orForm || nurNot;
        /* So wertet SQL aus: NULL NOT IN (…) ist „unbekannt“ → Zeile fällt heraus; „is null“ in der Klammer rettet sie. */
        const darf = !filter || (server.status == null ? orForm : !["storniert", "abgelehnt"].includes(server.status));
        log.patches.push({ u, body, filter, orForm, prefer: kopf["prefer"] || "", darf });
        if (!darf) return json(fall.stumm ? undefined : []);
        Object.assign(server, body);
        if (fall.stumm) return r.fulfill({ status: 204, body: "" });
        return /return=representation/.test(kopf["prefer"] || "") ? json([server]) : r.fulfill({ status: 204, body: "" });
      }
      log.gets++;
      return json([server]);
    }
    if (u.includes("/rest/v1/betriebe")) return json([{ id: B, name: "Prüfhaus" }]);
    if (u.includes("/auth/")) return json({ access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: { id: "u1" } });
    return json([]);
  });
  await s.addInitScript(() => {
    localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({ access_token: "t", refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  });
  await s.goto("file://" + KUECHE);
  await s.waitForTimeout(1800);
  return { s, ctx, server, log, fehler };
}

async function kuecheProben(browser) {
  console.log("\n══ 1 · Küche ══");
  /* a) normaler Bon: der Tipp trägt Filter und fordert die Zeilen an */
  {
    const k = await kueche(browser, { serverStatus: "arbeit" });
    const da = await k.s.evaluate(() => !!document.querySelector('#feld .bon [data-tun="fertig"]'));
    pruef(da, "Voraussetzung: der Bon steht mit dem Knopf „Abholbereit“ da");
    if (da) {
      await k.s.click('#feld .bon [data-tun="fertig"]');
      await k.s.waitForTimeout(700);
      const p = k.log.patches[0] || {};
      pruef(k.log.patches.length === 1 && p.body && p.body.status === "fertig", "Voraussetzung: der PATCH setzt den Status", JSON.stringify(p.body));
      pruef(p.filter === true, "PATCH mit status trägt den Filter „nicht storniert/abgelehnt“", p.u);
      pruef(p.orForm === true, "… und lässt Zeilen ohne Status durch („status is null“ in der Klammer)", p.u);
      pruef(/return=representation/.test(p.prefer), "PATCH fordert die geschriebenen Zeilen an", p.prefer);
      pruef(k.server.status === "fertig", "lebende Zeile wird geschrieben", k.server.status);
      const t = await k.s.evaluate(() => [...document.querySelectorAll("#toasts .toast")].map(x => x.textContent).join(" | "));
      pruef(/abholbereit/.test(t) && !/storniert/.test(t), "Toast wie bisher, kein falscher Alarm", t);
    }
    pruef(!k.fehler.length, "keine Ausnahme (a)", k.fehler.join(" | ") || "still");
    await k.ctx.close();
  }
  /* b) Gast hat inzwischen storniert: Server-Stand bleibt, Toast ohne „Erneut“, Neuabfrage */
  {
    const k = await kueche(browser, { serverStatus: "arbeit" });
    const da = await k.s.evaluate(() => !!document.querySelector('#feld .bon [data-tun="fertig"]'));
    pruef(da, "Voraussetzung (b): der Bon steht da");
    if (da) {
      k.server.status = "storniert";                       /* der Gast zieht zurück, bevor der Koch tippt */
      const vorher = k.log.gets;
      await k.s.click('#feld .bon [data-tun="fertig"]');
      await k.s.waitForTimeout(900);
      const p = k.log.patches[0] || {};
      pruef(p.filter === true && p.darf === false, "Voraussetzung (b): der Server hat den Filter angewandt und nichts geschrieben", JSON.stringify({ filter: p.filter, darf: p.darf }));
      pruef(k.server.status === "storniert", "die Stornierung des Gastes bleibt stehen", k.server.status);
      const t = await k.s.evaluate(() => ({
        text: [...document.querySelectorAll("#toasts .toast")].map(x => x.textContent).join(" | "),
        erneut: [...document.querySelectorAll("#toasts .toast button")].map(b => b.textContent.trim()) }));
      pruef(/inzwischen storniert/.test(t.text), "Toast sagt, dass inzwischen storniert wurde", t.text);
      pruef(!t.erneut.some(x => /Erneut/.test(x)), "kein „Erneut“ (Wiederholen wäre sinnlos)", JSON.stringify(t.erneut));
      pruef(k.log.gets > vorher, "die Küche holt den echten Stand neu", vorher + " → " + k.log.gets);
    }
    pruef(!k.fehler.length, "keine Ausnahme (b)", k.fehler.join(" | ") || "still");
    await k.ctx.close();
  }
  /* c) stornierter Bon abhaken: PATCH OHNE status, OHNE Filter, Bon verschwindet */
  {
    const k = await kueche(browser, { serverStatus: "storniert", storno: [{ name: "Crêpe", menge: 1 }] });
    const sicht = await k.s.evaluate(() => document.querySelectorAll("#feld .bon").length);
    const knopf = await k.s.evaluate(() => { const b = document.querySelector('#feld .bon [data-tun="fertig"]'); return b ? b.textContent.trim() : null; });
    pruef(sicht === 1 && !!knopf, "Voraussetzung (c): der stornierte Bon steht mit einem Abhak-Knopf da", sicht + " Bon, Knopf „" + knopf + "“");
    const vorOffen = await k.s.evaluate(() => document.getElementById("zKueche").textContent);
    pruef(vorOffen === "1", "Voraussetzung (c): vor dem Abhaken zählt der Bon als offen", "offene Küche: " + vorOffen);
    if (sicht === 1 && knopf) {
      await k.s.click('#feld .bon [data-tun="fertig"]');
      await k.s.waitForTimeout(1200);
      const p = k.log.patches[0] || {};
      pruef(k.log.patches.length === 1 && !("status" in (p.body || {})), "Voraussetzung (c): der PATCH enthält keinen Status", JSON.stringify(p.body));
      pruef(p.filter === false, "PATCH ohne status trägt KEINEN Filter (sonst bliebe der Bon stehen)", p.u);
      pruef(typeof k.server.kueche_fertig_um === "string", "kueche_fertig_um wurde geschrieben", String(k.server.kueche_fertig_um));
      /* Abhaken heißt hier nur: vom Schirm. Die Küche lässt einen abgehakten Bon absichtlich noch
         EINST.fertigZeigen Minuten stehen (Versehen zurücknehmen); er zählt aber nicht mehr als offen. */
      await k.s.waitForTimeout(4500);
      const offen = await k.s.evaluate(() => document.getElementById("zKueche").textContent);
      pruef(offen === "0", "der abgehakte stornierte Bon zählt nicht mehr als offen", "offene Küche: " + offen);
    }
    pruef(!k.fehler.length, "keine Ausnahme (c)", k.fehler.join(" | ") || "still");
    await k.ctx.close();
  }
  /* e) Zeile OHNE Status (die Spalte ist nullbar): bleibt bedienbar, NULL NOT IN (…) schlösse sie aus */
  {
    const k = await kueche(browser, { serverStatus: null });
    const da = await k.s.evaluate(() => !!document.querySelector('#feld .bon [data-tun="fertig"]'));
    pruef(da, "Voraussetzung (e): der Bon ohne Status steht da");
    if (da) {
      await k.s.click('#feld .bon [data-tun="fertig"]');
      await k.s.waitForTimeout(700);
      const p = k.log.patches[0] || {};
      pruef(p.filter === true && p.darf === true, "Voraussetzung (e): Filter gesetzt, der Server lässt die Zeile durch", JSON.stringify({ filter: p.filter, darf: p.darf }));
      pruef(k.server.status === "fertig", "die Zeile ohne Status wurde geschrieben", String(k.server.status));
      const t = await k.s.evaluate(() => [...document.querySelectorAll("#toasts .toast")].map(x => x.textContent).join(" | "));
      pruef(!/storniert/.test(t), "kein falscher Alarm", t);
    }
    await k.ctx.close();
  }
  /* d) keine lesbare Antwort: gelungen (fail-open) */
  {
    const k = await kueche(browser, { serverStatus: "arbeit", stumm: true });
    const da = await k.s.evaluate(() => !!document.querySelector('#feld .bon [data-tun="fertig"]'));
    if (da) {
      await k.s.click('#feld .bon [data-tun="fertig"]');
      await k.s.waitForTimeout(700);
      const t = await k.s.evaluate(() => [...document.querySelectorAll("#toasts .toast")].map(x => x.textContent).join(" | "));
      pruef(k.log.patches.length === 1 && /abholbereit/.test(t) && !/nicht gespeichert|storniert/.test(t), "ohne lesbare Antwort (204) gilt es als gelungen", t);
    } else pruef(false, "Voraussetzung (d): der Bon steht da");
    await k.ctx.close();
  }
}

/* ── 2 · Board ─────────────────────────────────────────────────── */
async function boardOeffnen(browser, breite) {
  const ctx = await browser.newContext({ viewport: { width: breite || 1280, height: 900 } });
  const s = await ctx.newPage();
  const fehler = [];
  s.on("pageerror", e => fehler.push(String(e).slice(0, 160)));
  await s.route("**/*", r => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await s.goto("file://" + ADMIN);
  await s.waitForTimeout(700);
  await s.evaluate(() => { document.getElementById("tor").hidden = true; demoStarten(); const sc = document.getElementById("scharf"); if (sc) sc.hidden = true; });
  await s.waitForTimeout(250);
  return { ctx, s, fehler };
}

/* Gestellte Datenbank: wertet die Kette wie PostgREST aus. */
const DB_STELLEN = () => {
  window.__srv = { rows: {}, log: [], stumm: false };
  const alle = () => Object.values(window.__srv.rows);
  db = {
    removeChannel: () => Promise.resolve(), channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    rpc: () => Promise.resolve({ data: null, error: null }),
    from: tab => ({
      update: felder => {
        const q = { ids: null, filt: [], sel: false };
        const api = {
          eq(c, v) { if (c === "id") q.ids = [v]; return api; },
          in(c, v) { if (c === "id") q.ids = v; return api; },
          not(c, op, v) { q.filt.push([c, op, v]); return api; },
          or(expr) { q.filt.push(["or", expr]); return api; },
          select() { q.sel = true; return api; },
          then(ok, nein) {
            const srv = window.__srv, gespeichert = [];
            (q.ids || []).forEach(id => {
              const z = srv.rows[id]; if (!z) return;
              const ende = ["storniert", "abgelehnt"].includes(z.status);
              const gesperrt = q.filt.some(f => {
                if (f[0] === "or") {                                    /* .or("status.is.null,status.not.in.(…)") */
                  if (z.status == null) return !/status\.is\.null/.test(f[1]);
                  return /status\.not\.in\.\(storniert,abgelehnt\)/.test(f[1]) && ende;
                }
                if (f[0] === "status" && f[1] === "in") return z.status == null || ende;   /* NULL NOT IN (…) = unbekannt */
                return false;
              });
              if (!gesperrt){ Object.assign(z, felder); gespeichert.push({ id }); }
            });
            srv.log.push({ tab, felder, filt: q.filt, sel: q.sel, ids: q.ids });
            return Promise.resolve({ data: q.sel && !srv.stumm ? gespeichert : null, error: null }).then(ok, nein);
          }
        };
        return api;
      },
      select: () => {
        const api = { eq() { return api; }, gte() { return api; }, order() { return api; }, limit() { return api; },
          then(ok, nein) { return Promise.resolve({ data: alle().map(z => ({ ...z })), error: null }).then(ok, nein); } };
        return api;
      }
    })
  };
};

async function boardProben(browser) {
  console.log("\n══ 2 · Board ══");
  const b = await boardOeffnen(browser);
  const s = b.s;
  await s.evaluate(DB_STELLEN);
  await s.evaluate(() => {
    demo = false; betriebId = "B";
    window.__melde = [];
    window.melde = (t) => { window.__melde.push(t); };
    window.confirm = () => true;
    window.nachholenAufrufe = 0;
    const echt = window.nachholen; window.nachholen = async (...a) => { window.nachholenAufrufe++; return echt(...a); };
    const vor = m => new Date(Date.now() - m * 60000).toISOString();
    const z = (id, o) => Object.assign({ id, betrieb_id: "B", quelle: "tisch", status: "arbeit", tisch: "4", summe: 12,
      positionen: [{ name: "Dubai Crêpe", menge: 2, preis: 6 }], notiz: null, zeitpunkt: vor(12), pruefen: false,
      wartezeit_min: 10, kueche_fertig_um: null, theke_fertig_um: null, gebracht_um: null }, o);
    window.__neu = (rows) => {
      bestellungen.length = 0; Object.keys(window.__srv.rows).forEach(k => delete window.__srv.rows[k]);
      rows.forEach(r => { bestellungen.push({ ...r }); window.__srv.rows[r.id] = { ...r }; bekannt.add(r.id); });
      window.__srv.log.length = 0; window.__srv.stumm = false; window.__melde.length = 0; window.nachholenAufrufe = 0;
      inArbeit.clear(); zeichneAlles();
    };
    window.__z = z;
  });
  const lokal = id => s.evaluate(i => (bestellungen.find(x => x.id === i) || {}).status, id);
  const server = id => s.evaluate(i => window.__srv.rows[i].status, id);
  const log = () => s.evaluate(() => window.__srv.log.map(l => ({ filt: l.filt, sel: l.sel, felder: Object.keys(l.felder) })));
  const melden = () => s.evaluate(() => window.__melde.join(" | "));

  /* a) lebende Zeile */
  await s.evaluate(() => window.__neu([window.__z("o1", {})]));
  await s.evaluate(() => statusSetzen("o1", "fertig")); await s.waitForTimeout(150);
  let l = (await log())[0] || {};
  pruef((await server("o1")) === "fertig" && (await lokal("o1")) === "fertig", "lebende Zeile: Server und Anzeige stehen auf „fertig“");
  pruef(JSON.stringify(l.filt) === JSON.stringify([["or", "status.is.null,status.not.in.(storniert,abgelehnt)"]]) && l.sel === true, "statusSetzen trägt den Filter und fordert die Zeilen an", JSON.stringify(l));
  pruef(!(await melden()), "kein falscher Alarm", await melden());

  /* b) inzwischen storniert */
  await s.evaluate(() => { window.__neu([window.__z("o1", {})]); window.__srv.rows.o1.status = "storniert"; });
  await s.evaluate(() => statusSetzen("o1", "fertig")); await s.waitForTimeout(450);
  pruef((await server("o1")) === "storniert", "statusSetzen: die Stornierung bleibt auf dem Server stehen", await server("o1"));
  pruef((await melden()).includes("inzwischen storniert"), "statusSetzen: der Hinweis sagt es", await melden());
  pruef((await s.evaluate(() => window.nachholenAufrufe)) >= 1, "statusSetzen: der echte Stand wird geholt");
  pruef((await lokal("o1")) === "storniert", "statusSetzen: nach dem Holen zeigt die Anzeige „storniert“, nicht den Wunsch", await lokal("o1"));

  /* c) Zusage */
  await s.evaluate(() => { window.__neu([window.__z("o1", { status: "neu", wartezeit_min: null })]); window.__srv.rows.o1.status = "abgelehnt"; });
  await s.evaluate(() => bestaetigen(bestellungen[0], 15)); await s.waitForTimeout(450);
  pruef((await server("o1")) === "abgelehnt" && (await s.evaluate(() => window.__srv.rows.o1.wartezeit_min)) === null,
    "Zusage: eine abgelehnte Zeile bekommt weder Status noch Zeit", await server("o1"));
  pruef((await melden()).includes("inzwischen storniert"), "Zusage: der Hinweis sagt es", await melden());
  pruef(!(await melden()).includes("Bestätigt"), "Zusage: kein Erfolgshinweis", await melden());

  /* d) Verwerfen einer markierten Bestellung */
  await s.evaluate(() => { window.__neu([window.__z("o1", { status: "neu", pruefen: true, pruef_grund: "Probe" })]); window.__srv.rows.o1.status = "storniert"; });
  await s.evaluate(() => pruefEntscheiden("o1", false)); await s.waitForTimeout(450);
  pruef((await server("o1")) === "storniert", "Verwerfen: aus „storniert“ wird nicht „abgelehnt“", await server("o1"));

  /* e) Wege OHNE status tragen keinen Filter und keine Rückgabe */
  await s.evaluate(() => { window.__neu([window.__z("o1", { status: "neu", pruefen: true, pruef_grund: "Probe" })]); window.__srv.rows.o1.status = "storniert"; });
  await s.evaluate(() => pruefEntscheiden("o1", true)); await s.waitForTimeout(300);
  l = (await log())[0] || {};
  pruef(l.felder && !l.felder.includes("status") && l.filt.length === 0 && l.sel === false,
    "Freigeben (ohne status) trägt keinen Filter und fordert nichts zurück", JSON.stringify(l));
  pruef((await s.evaluate(() => window.__srv.rows.o1.pruefen)) === false, "Freigeben wirkt auch bei einer stornierten Zeile (nur die Markierung fällt)");

  /* f) ohne lesbare Antwort: gelungen */
  await s.evaluate(() => { window.__neu([window.__z("o1", {})]); window.__srv.stumm = true; });
  await s.evaluate(() => statusSetzen("o1", "fertig")); await s.waitForTimeout(300);
  pruef((await lokal("o1")) === "fertig" && !(await melden()), "keine Zeilenliste in der Antwort: gilt als gelungen, Anzeige bleibt", (await lokal("o1")) + " / " + (await melden()));

  /* g) mehrere Zeilen: nur die verlorene wird gemeldet */
  await s.evaluate(() => { window.__neu([window.__z("o1", {}), window.__z("o2", {})]); window.__srv.rows.o2.status = "storniert"; });
  const r = await s.evaluate(() => bestellungSchreiben({ status: "fertig" }, ["o1", "o2"]));
  pruef(JSON.stringify(r.verloren) === '["o2"]' && !r.error, "bestellungSchreiben: von zwei Zeilen ist nur die stornierte verloren", JSON.stringify(r));
  pruef((await server("o1")) === "fertig" && (await server("o2")) === "storniert", "die lebende wurde geschrieben, die stornierte nicht");

  /* h) Zeile OHNE Status (nullbar): bleibt bedienbar */
  await s.evaluate(() => { window.__neu([window.__z("o1", { status: null })]); });
  await s.evaluate(() => statusSetzen("o1", "arbeit")); await s.waitForTimeout(250);
  pruef((await server("o1")) === "arbeit" && !(await melden()), "Zeile ohne Status: wird geschrieben, kein falscher Alarm", (await server("o1")) + " / " + (await melden()));

  pruef(!b.fehler.length, "keine Ausnahme im Board", b.fehler.join(" | ") || "still");
  await b.ctx.close();
}

/* ── 3 · Altersband ────────────────────────────────────────────── */
function hellig(rgb) { const l = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; }
const kontrast = (a, c) => { const x = hellig(a), y = hellig(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

async function bandProben(browser) {
  console.log("\n══ 3 · Altersband im Saal ══");
  for (const breite of [360, 1280]) {
    for (const hell of [false, true]) {
      const b = await boardOeffnen(browser, breite);
      const s = b.s;
      await s.evaluate(() => { tafelZeigen("reservierungen"); });
      await s.waitForTimeout(250);
      await s.evaluate(h => { document.body.classList.toggle("hell", h); }, hell);
      const tag = " (" + breite + " px, " + (hell ? "hell" : "dunkel") + ")";
      const zustand = () => s.evaluate(() => { const e = document.getElementById("spAlter"); const r = e.getBoundingClientRect();
        return { hidden: e.hidden, text: e.textContent, breite: Math.round(r.width), hoehe: Math.round(r.height), ueber: document.documentElement.scrollWidth > innerWidth + 1 }; });

      /* Vorführmodus: nie */
      await s.evaluate(() => { STAND_ZEIT = Date.now() - 600000; spAlterZeigen(); });
      pruef((await zustand()).hidden, "Vorführmodus: das Band bleibt weg, auch bei altem Stand" + tag);

      /* echter Betrieb */
      await s.evaluate(() => { demo = false; betriebId = "B"; window.__svgVor = document.getElementById("spSvg"); STAND_ZEIT = Date.now() - 30000; spAlterZeigen(); });
      pruef((await zustand()).hidden, "30 s alt: kein Band" + tag);
      await s.evaluate(() => { STAND_ZEIT = Date.now() - 90000; spAlterZeigen(); });
      let z = await zustand();
      pruef(!z.hidden && /^Stand von vor 2 Min – Verbindung prüfen$/.test(z.text), "90 s alt: das Band steht da und sagt es", z.text);
      pruef(z.hoehe >= 36 && z.breite > 0 && !z.ueber, "Band hat Maß und läuft nicht seitlich über" + tag, JSON.stringify({ h: z.hoehe, b: z.breite, ueber: z.ueber }));

      /* Lesbarkeit: Schrift gegen die gemalte Fläche */
      const k = await s.evaluate(() => { const e = document.getElementById("spAlter"), cs = getComputedStyle(e);
        const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
        let bg = nums(cs.backgroundColor), fg = nums(cs.color);
        if (bg.length === 4 && bg[3] < 1) { const body = nums(getComputedStyle(document.body).backgroundColor); const a = bg[3];
          bg = [0, 1, 2].map(i => Math.round(bg[i] * a + body[i] * (1 - a))); }
        return { bg: bg.slice(0, 3), fg: fg.slice(0, 3) }; });
      const kk = kontrast(k.fg, k.bg);
      pruef(kk >= 4.5, "Band lesbar ≥ 4,5:1" + tag, kk.toFixed(2) + ":1");

      /* Frischer Stand: weg; der Plan wurde dafür nicht neu gebaut */
      await s.evaluate(() => standFrisch());
      pruef((await zustand()).hidden, "frischer Stand: das Band verschwindet" + tag);
      pruef(await s.evaluate(() => window.__svgVor === document.getElementById("spSvg")), "der Plan wird für das Band nicht neu gebaut (dasselbe Element)" + tag);

      /* Betriebswechsel nimmt den alten Stand mit */
      await s.evaluate(() => { STAND_ZEIT = Date.now() - 200000; spAlterZeigen(); });
      pruef(!(await zustand()).hidden, "Voraussetzung: wieder sichtbar" + tag);
      await s.evaluate(() => { STAND_ZEIT = 0; spAlterZeigen(); });
      pruef((await zustand()).hidden, "ohne bekannten Stand (0) kein Band — erst nach dem ersten Laden" + tag);
      pruef(!b.fehler.length, "keine Ausnahme" + tag, b.fehler.join(" | ") || "still");
      await b.ctx.close();
    }
  }
}

(async () => {
  const browser = await chromium.launch();
  await kuecheProben(browser);
  await boardProben(browser);
  await bandProben(browser);
  await browser.close();
  console.log("\n" + (f ? f + " von " + n + " Fehler." : "alles grün (" + n + " Proben)"));
  process.exit(f ? 1 : 0);
})();
