/* ═══════════════════════════════════════════════════════════════════
   NEWSLETTER-VORLAGE-SETZEN · Das Board wählt das Aussehen der Mails,
   diese Funktion ersetzt die Vorlagen des Hauses in Klaviyo.
   ═══════════════════════════════════════════════════════════════════

   Ausrollen MIT Token-Prüfung (verify_jwt) — gerufen aus dem Board, nur
   für den Inhaber:
     supabase functions deploy newsletter-vorlage-setzen

   EINGANG {betrieb_id, variante, html:{gutschein, rueckholung}} — das
   HTML baut das Board aus dem geteilten Block NEWSLETTER-VARIANTEN
   (erzeuger/newsletter-varianten.js), mit den Farben und Gerichten des
   Hauses. Die Funktion vertraut ihm NICHT blind:
   1. Inhaber? ist_inhaber(p_betrieb) MIT dem Token des Aufrufers. Nein →
      {grund:'kein_zugriff'}, kein einziger Aufruf an Klaviyo.
   2. Form: Variante aus der Liste, je Mail ≤ 100 000 Zeichen, kein
      <script>, kein on…=-Attribut, kein javascript:, und die Pflicht-Tags
      dieses Hauses: {% coupon_code '<slug>_newsletter' %} und
      {% unsubscribe … %}. Sonst {grund:'ungueltig'}.
   3. Vorlagen-IDs aus klaviyo_flows (Lesen nur für den Inhaber, RLS),
      nur was wie eine Klaviyo-ID aussieht (§2.3a).
   4. Ohne KLAVIYO_API_KEY: {grund:'kein_schluessel'} — die Wahl ist im
      Board trotzdem gespeichert (hub_stil.newsletter), das Board sagt es.

   EHRLICHE GRENZE: In Klaviyo hängt eine Flow-Mail an IHRER Kopie einer
   Vorlage. Ob vorlage_id in klaviyo_flows die Vorlage der Flow-Mail ist
   (dann wirkt das Ersetzen sofort) oder die Ausgangsvorlage (dann muss
   die Mail im Flow einmal neu zugewiesen werden), steht nirgends im
   Verzeichnis — prüfen beim ersten echten Aufruf mit Schlüssel.
   Nicht ausgerollt (Supabase am 01.11. aus dieser Sitzung nicht
   erreichbar).
   ═══════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const KLAVIYO_KEY = Deno.env.get("KLAVIYO_API_KEY") ?? "";
const KLAVIYO_REV = "2024-10-15";
const VARIANTEN = ["klassisch", "kampagne", "liefer", "edel"];
const ID_FORM = /^[A-Za-z0-9]{1,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRENZE = 100_000;

const antwort = (koerper: unknown, status = 200) =>
  new Response(JSON.stringify(koerper), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    },
  });

/* Die Mail ist erlaubt, wenn sie die Pflicht-Tags dieses Hauses trägt und nichts Ausführbares enthält. */
export function mailOk(html: unknown, slug: string): boolean {
  if (typeof html !== "string" || !html || html.length > GRENZE) return false;
  if (/<script\b/i.test(html) || /\son[a-z]+\s*=/i.test(html) || /javascript:/i.test(html)) return false;
  if (!html.includes(`{% coupon_code '${slug}_newsletter' %}`)) return false;
  if (!/\{% unsubscribe[^%]*%\}/.test(html)) return false;
  return true;
}

async function vorlageSetzen(id: string, html: string): Promise<boolean> {
  const r = await fetch(`https://a.klaviyo.com/api/templates/${id}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_KEY}`,
      revision: KLAVIYO_REV,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: { type: "template", id, attributes: { html } } }),
  }).catch(() => null);
  return !!r && r.ok;
}

Deno.serve(async (anfrage) => {
  if (anfrage.method === "OPTIONS") return antwort({}, 200);
  if (anfrage.method !== "POST") return antwort({ fehler: "nur POST" }, 405);
  let roh: any;
  try { roh = await anfrage.json(); } catch { return antwort({ ok: false, grund: "ungueltig" }); }
  const betriebId = String(roh?.betrieb_id ?? "");
  const variante = String(roh?.variante ?? "");
  if (!UUID.test(betriebId)) return antwort({ ok: false, grund: "kein_zugriff" });
  if (!VARIANTEN.includes(variante)) return antwort({ ok: false, grund: "ungueltig" });

  const alsNutzer = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: anfrage.headers.get("authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: inhaber, error: e1 } = await alsNutzer.rpc("ist_inhaber", { p_betrieb: betriebId });
  if (e1 || inhaber !== true) return antwort({ ok: false, grund: "kein_zugriff" });

  const { data: betrieb } = await alsNutzer.from("betriebe").select("slug").eq("id", betriebId).maybeSingle();
  const slug = String(betrieb?.slug ?? "").replace(/[^a-z0-9-]/g, "");
  if (!slug) return antwort({ ok: false, grund: "kein_zugriff" });
  const html = roh?.html ?? {};
  if (!mailOk(html.gutschein, slug) || !mailOk(html.rueckholung, slug)) return antwort({ ok: false, grund: "ungueltig" });

  const { data: flows } = await alsNutzer.from("klaviyo_flows").select("art, vorlage_id").eq("betrieb_id", betriebId);
  const ziele = (Array.isArray(flows) ? flows : [])
    .map((f: any) => ({ art: String(f?.art ?? ""), id: String(f?.vorlage_id ?? "") }))
    .filter((f) => ID_FORM.test(f.id) && (f.art === "willkommen" || f.art === "rueckholung"));
  if (!ziele.length) return antwort({ ok: false, grund: "keine_vorlagen" });
  if (!KLAVIYO_KEY) return antwort({ ok: false, grund: "kein_schluessel" });

  let ersetzt = 0;
  for (const z of ziele) {
    if (await vorlageSetzen(z.id, z.art === "rueckholung" ? html.rueckholung : html.gutschein)) ersetzt++;
  }
  if (!ersetzt) return antwort({ ok: false, grund: "klaviyo" });
  return antwort({ ok: true, variante, ersetzt, von: ziele.length });
});
