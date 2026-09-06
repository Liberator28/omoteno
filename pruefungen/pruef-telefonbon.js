/* ═══════════════════════════════════════════════════════════════════
   PRÜFUNG · Kommt eine Telefonbestellung in der Küche an?

     NODE_PATH=/opt/node22/lib/node_modules node pruefungen/pruef-telefonbon.js

   Bis zum 05.09. filterte die Küche „quelle=eq.tisch". Eine
   Bestellung, die Alessia am Telefon aufgenommen hat, wäre damit in
   der Datenbank gelandet und in der Küche NIE aufgetaucht — sie muss
   aber gekocht werden wie jede andere. Diese Prüfung hält das fest.

   Kein Netz nach außen: Die Antworten der Datenbank werden
   abgefangen und selbst gestellt.
   ═══════════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const path = require("path");

const BETRIEB = "11111111-1111-4111-8111-111111111111";
const jetzt = Date.now();

const BONS = [
  { id:"t1", betrieb_id:BETRIEB, quelle:"tisch", status:"neu", tisch:"7",
    positionen:[{name:"Dubai Crêpe",menge:2}], notiz:null,
    zeitpunkt:new Date(jetzt-4*60000).toISOString(),
    kueche_fertig_um:null, theke_fertig_um:null,
    gast_name:null, gast_telefon:null, abholung:null, wunschzeit:null, tagesnummer:11 },
  { id:"p1", betrieb_id:BETRIEB, quelle:"telefon", status:"neu", tisch:"Telefon",
    positionen:[{name:"Marina Waffel",menge:1}], notiz:"ohne Sahne",
    zeitpunkt:new Date(jetzt-2*60000).toISOString(),
    kueche_fertig_um:null, theke_fertig_um:null,
    gast_name:"Frau Meyer", gast_telefon:"0170 1234567",
    abholung:true, wunschzeit:new Date(jetzt+45*60000).toISOString(), tagesnummer:12 },
  /* Ein Serviceruf MUSS weiter draußen bleiben. */
  { id:"s1", betrieb_id:BETRIEB, quelle:"service", status:"neu", tisch:"3",
    positionen:[], notiz:null, zeitpunkt:new Date(jetzt-60000).toISOString(),
    kueche_fertig_um:null, theke_fertig_um:null,
    gast_name:null, gast_telefon:null, abholung:null, wunschzeit:null, tagesnummer:13 }
];

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport:{width:1280,height:900} });
  const p = await ctx.newPage();
  let fehler = 0, gesehen = "";
  const ok = (g,t,z) => { console.log((g?"  ok   ":"  FEHL ")+t+(z?"  → "+z:"")); if(!g) fehler++; };

  await p.route("**/*", route => {
    const u = route.request().url();
    if(u.startsWith("file://")) return route.continue();

    if(u.includes("/rest/v1/bestellungen")){
      gesehen = u;
      /* Der Server filtert wirklich — sonst prüfte der Test nur die
         Anzeige und würde einen falschen Filter übersehen. */
      const m = decodeURIComponent(u).match(/quelle=(?:eq\.(\w+)|in\.\(([^)]*)\))/);
      const erlaubt = m ? (m[1] ? [m[1]] : m[2].split(",").map(s=>s.trim())) : null;
      const raus = erlaubt ? BONS.filter(b => erlaubt.includes(b.quelle)) : BONS;
      return route.fulfill({ status:200, contentType:"application/json",
                             body:JSON.stringify(raus) });
    }
    if(u.includes("/rest/v1/betriebe")){
      return route.fulfill({ status:200, contentType:"application/json",
        body:JSON.stringify([{ id:BETRIEB, name:"Prüfhaus", slug:"pruefhaus",
                               bestell_pause:false, bestell_pause_text:"", hub_texte:{} }]) });
    }
    if(u.includes("/rest/v1/gerichte")){
      return route.fulfill({ status:200, contentType:"application/json", body:"[]" });
    }
    if(u.includes("/auth/")){
      return route.fulfill({ status:200, contentType:"application/json",
        body:JSON.stringify({ access_token:"probe-token", refresh_token:"probe-refresh",
                              expires_in:3600, token_type:"bearer",
                              user:{ id:"u1", email:"probe@example.org" } }) });
    }
    if(u.includes("/rest/v1/betrieb_mitglieder")){
      return route.fulfill({ status:200, contentType:"application/json",
        body:JSON.stringify([{ betrieb_id:BETRIEB, nutzer_id:"u1", rolle:"inhaber" }]) });
    }
    return route.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });

  /* Die Küche zeigt ohne Anmeldung nur das Tor. Die Sitzung wird
     deshalb VOR dem Laden hinterlegt — genau so, wie sie nach einer
     echten Anmeldung dort stünde. Danach fragt die Seite von selbst
     auffrischen() an, was die Abfangregel unten beantwortet. */
  await p.addInitScript(() => {
    localStorage.setItem("omoteno-kueche-sitzung", JSON.stringify({
      access_token:"probe-token", refresh_token:"probe-refresh",
      expires_at: Math.floor(Date.now()/1000) + 3600
    }));
  });
  await p.goto("file://" + path.join(process.cwd(), "seiten/kueche.html"));
  await p.waitForTimeout(1600);

  /* 1 · Fragt die Küche überhaupt nach Telefonbestellungen? */
  ok(/quelle=in\.\(tisch,telefon\)/.test(decodeURIComponent(gesehen)),
     "die Abfrage holt Tisch UND Telefon",
     (decodeURIComponent(gesehen).match(/quelle=[^&]*/) || ["(keine)"])[0]);

  /* 2 · Steht der Telefonbon auf dem Schirm? */
  const bons = await p.evaluate(() =>
    [...document.querySelectorAll("[data-id]")].map(e => e.getAttribute("data-id")));
  ok(bons.includes("p1"), "der Telefonbon steht in der Küche", bons.join(", ") || "(keiner)");
  ok(bons.includes("t1"), "der Tischbon steht weiter da");
  ok(!bons.includes("s1"), "der Serviceruf bleibt draußen");

  if(bons.includes("p1")){
    const d = await p.evaluate(() => {
      const e = document.querySelector('[data-id="p1"]');
      const t = e.querySelector(".tisch");
      const a = e.querySelector(".anrufer");
      return { kopf: t ? t.textContent.trim() : null,
               telefonKlasse: t ? t.classList.contains("telefon") : false,
               anrufer: a ? a.textContent.trim() : null,
               wunsch: a && a.querySelector(".wunsch")
                       ? a.querySelector(".wunsch").textContent.trim() : null };
    });
    ok(d.telefonKlasse, "der Kopf ist als Telefon gekennzeichnet");
    ok(/Abholung/.test(d.kopf), "er sagt Abholung statt Tisch", d.kopf);
    ok(/#12/.test(d.kopf), "die Nummer zum Ausrufen steht da", d.kopf);
    ok(d.anrufer && /Frau Meyer/.test(d.anrufer), "der Name des Anrufers steht da");
    ok(d.anrufer && /0170 1234567/.test(d.anrufer), "und seine Nummer");
    ok(d.wunsch && /\d{2}:\d{2}/.test(d.wunsch), "die Wunschzeit steht da", d.wunsch);
  }

  await br.close();
  console.log("\n" + (fehler ? fehler + " Fehler" : "Alles sauber."));
  process.exit(fehler ? 1 : 0);
})();
