/* ═══════════════════════════════════════════════════════════════════
   NEWSLETTER-UEBERSICHT · Was Klaviyo gerade für diesen Betrieb tut
   ═══════════════════════════════════════════════════════════════════

   Ausrollen MIT Token-Prüfung (verify_jwt) — gerufen aus dem Board,
   nur für den Inhaber:
     supabase functions deploy newsletter-uebersicht

   WAS SIE TUT
   1. Fragt gaeste_uebersicht(p_betrieb) MIT dem Token des Aufrufers
      (ist_inhaber, also mit PIN-Pflicht). Wer nicht Inhaber ist,
      bekommt {ok:false, grund:'kein_zugriff'} — die Zahlen aus der
      eigenen Datenbank verlassen die Funktion nur für den Inhaber.
   2. Holt aus Klaviyo je gespeichertem Flow (Tabelle klaviyo_flows)
      Name und Status (draft / manual / live) und zählt die freien
      Codes im Coupon <slug>_newsletter (Status UNASSIGNED).
   3. Fehlt KLAVIYO_API_KEY oder antwortet Klaviyo nicht, steht das
      als Grund in der Antwort — die Zahlen aus Supabase kommen
      trotzdem (fail-open, §7; stumm ausfallen ist verboten, §8.1i).

   Zweite Quelle für die Adressen: das Klaviyo-Werkzeug (get_flow,
   get_coupon_codes) hat am 09.10. genau diese Formen zurückgegeben —
   /api/flows/<id>/?fields[flow]=… und /api/coupon-codes/?filter=
   and(equals(coupon.id,"…"),equals(status,"UNASSIGNED")).

   EHRLICHE GRENZE: Versand-, Öffnungs- und Klickzahlen je Flow holt
   sie NICHT — Klaviyos Bericht dafür verlangt eine Umsatz-Metrik,
   die es in diesem Konto erst nach den ersten echten Ereignissen
   gibt. Das Board verlinkt deshalb je Flow auf Klaviyo selbst. Und:
   gegen die echte Klaviyo-API läuft der Weg erst, wenn der Schlüssel
   gesetzt ist.
   ═══════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const KLAVIYO_KEY  = Deno.env.get("KLAVIYO_API_KEY") ?? "";
const KLAVIYO_REV  = "2024-10-15";
/* Mehr als 500 freie Codes zählt sie nicht genau („500+“) — fünf
   Seiten sind die Obergrenze an Anfragen je Aufruf. */
const SEITEN_MAX = 5;

const antwort = (koerper: unknown, status = 200) =>
  new Response(JSON.stringify(koerper), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      /* Dieselbe Liste wie in newsletter-vorrat-auffuellen (supabase-js
         SUPABASE_HEADERS, Kopie in pruefungen/stand-supabase-cors.mjs). */
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    },
  });

async function klaviyo(pfad: string): Promise<any | null> {
  const r = await fetch("https://a.klaviyo.com/api/" + pfad, {
    headers: {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_KEY}`,
      revision: KLAVIYO_REV,
      Accept: "application/json",
    },
  }).catch(() => null);
  if (!r || !r.ok) return null;
  return await r.json().catch(() => null);
}

/* Flow-IDs kommen aus der eigenen Tabelle, trotzdem nur, was wie eine
   Klaviyo-ID aussieht, in die Adresse (§2.3a). */
const ID_FORM = /^[A-Za-z0-9]{4,32}$/;

async function flowStand(id: string) {
  if (!ID_FORM.test(id)) return { id, status: "unbekannt" };
  const j = await klaviyo(`flows/${id}/?fields[flow]=name,status,archived`);
  const a = j?.data?.attributes;
  if (!a) return { id, status: "unbekannt" };
  return { id, name: String(a.name ?? ""), status: a.archived ? "archiviert" : String(a.status ?? "unbekannt") };
}

async function freieCodes(coupon: string): Promise<{ anzahl: number; mehr: boolean } | null> {
  const filter = encodeURIComponent(`and(equals(coupon.id,"${coupon}"),equals(status,"UNASSIGNED"))`);
  let pfad: string | null = `coupon-codes/?fields[coupon-code]=status&page[size]=100&filter=${filter}`;
  let anzahl = 0;
  for (let i = 0; i < SEITEN_MAX && pfad; i++) {
    const j = await klaviyo(pfad);
    if (!j || !Array.isArray(j.data)) return null;
    anzahl += j.data.length;
    const weiter: string | null = j.links?.next ?? null;
    pfad = weiter ? weiter.replace("https://a.klaviyo.com/api/", "") : null;
  }
  return { anzahl, mehr: pfad !== null };
}

Deno.serve(async (anfrage) => {
  if (anfrage.method === "OPTIONS") return antwort({}, 200);
  if (anfrage.method !== "POST") return antwort({ fehler: "nur POST" }, 405);

  let roh: any;
  try { roh = await anfrage.json(); }
  catch { return antwort({ ok: false, grund: "kein_json" }); }
  const betriebId = String(roh?.betrieb_id || "");
  if (!betriebId) return antwort({ ok: false, grund: "kein_zugriff" });

  const alsNutzer = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: anfrage.headers.get("authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: zahlen, error } = await alsNutzer.rpc("gaeste_uebersicht", { p_betrieb: betriebId });
  /* Nur „Funktion unbekannt“ heißt „Migration fehlt“; eine Abweisung
     (anon ohne EXECUTE: 42501) ist kein Zugriff — sonst sagte das
     Board einem Fremden, es fehle eine Migration. */
  if (error) {
    const fehlt = error.code === "42883" || error.code === "PGRST202";
    return antwort({ ok: false, grund: fehlt ? "fehlt" : "kein_zugriff" });
  }
  if (!zahlen || zahlen.ok !== true) return antwort({ ok: false, grund: zahlen?.grund ?? "kein_zugriff" });

  if (!KLAVIYO_KEY) return antwort({ ok: true, zahlen, klaviyo: { ok: false, grund: "kein_schluessel" } });

  const { data: betrieb } = await alsNutzer.from("betriebe").select("slug").eq("id", betriebId).maybeSingle();
  const slug = String(betrieb?.slug ?? "");
  const flowIds: string[] = Array.isArray(zahlen.flows) ? zahlen.flows.map((f: any) => String(f?.flow_id ?? "")) : [];

  const [flows, codes] = await Promise.all([
    Promise.all(flowIds.map(flowStand)),
    slug ? freieCodes(`${slug}_newsletter`) : Promise.resolve(null),
  ]);
  const erreicht = flows.some((f) => f.status !== "unbekannt") || codes !== null;
  return antwort({
    ok: true,
    zahlen,
    klaviyo: erreicht
      ? { ok: true, flows, codes_frei: codes?.anzahl ?? null, codes_mehr: codes?.mehr ?? false }
      : { ok: false, grund: "keine_antwort" },
  });
});
