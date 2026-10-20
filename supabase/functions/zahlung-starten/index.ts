/* ═══════════════════════════════════════════════════════════════════
   ZAHLUNG-STARTEN · legt die Stripe-Bezahlseite für EINE Bestellung an

   Ausrollen OHNE Token-Prüfung (der Gast hat kein Konto):
     supabase functions deploy zahlung-starten --no-verify-jwt
   Geheimnis (nur in Supabase, nie im Verzeichnis):
     STRIPE_SECRET_KEY   (sk_live_… der PLATTFORM, Stripe Connect)

   Das Geld geht auf das Stripe-Konto des BETRIEBS (direct charge,
   Kopfzeile Stripe-Account). Omoteno hält nie Geld. Karten-, Konto- und
   PayPal-Daten gibt der Gast nur bei Stripe ein (gehostete Seite) —
   weder diese Funktion noch der Hub sehen sie.

   Aus der Anfrage wird nur die Bestellnummer und die Rückkehradresse
   gelesen. BETRAG, KONTO und ZAHLARTEN kommen aus der Datenbank
   (zahlung_stripe_vorbereiten, nur service_role). Ein gefälschter Betrag
   ist damit gar nicht erst eine Möglichkeit.

   Rückkehradresse: muss auf omoteno.de (oder einer Kundenadresse darunter)
   liegen und zur Herkunft der Anfrage passen — sonst die Hub-Adresse des
   Betriebs. Kein offener Weiterleitungsweg.
   ═══════════════════════════════════════════════════════════════════ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HERKUNFT = /^https:\/\/([a-z0-9-]+\.)?omoteno\.de$/;
const SLUG = /^[a-z0-9-]{1,60}$/;

interface Vorbereitet {
  ok: boolean; grund?: string; url?: string; wiederverwendet?: boolean; versuch?: number;
  zahlung_id?: string; stripe_konto?: string; betrag_cent?: number; methoden?: string[];
  betrieb_name?: string; slug?: string; zweck?: string;
}

function cors(origin: string | null): Record<string, string> {
  const k: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && HERKUNFT.test(origin)) k["Access-Control-Allow-Origin"] = origin;
  return k;
}

/* Wohin Stripe den Gast zurückschickt. Dieselbe Herkunft wie der Hub, in dem
   er bestellt hat (sonst fehlen ihm dort Warteschlange und Bestellpass im
   Gerätespeicher), Pfad nur „/“ oder „/h/<slug>/“ mit dem Slug DIESES Betriebs. */
export function rueckkehr(zurueck: unknown, origin: string | null, slug: string): string {
  const notfall = `https://omoteno.de/h/${slug}/`;
  if (typeof zurueck !== "string" || zurueck.length > 300) return notfall;
  let u: URL;
  try { u = new URL(zurueck); } catch { return notfall; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return notfall;
  if (!HERKUNFT.test(u.origin)) return notfall;
  if (origin && origin !== u.origin) return notfall;
  if (u.pathname !== "/" && u.pathname !== `/h/${slug}/`) return notfall;
  return u.origin + u.pathname;
}

async function rpc(fn: string, koerper: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(koerper),
  });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export function formular(v: Vorbereitet, bestellung: string, erfolg: string, abbruch: string, ablauf: number): URLSearchParams {
  const f = new URLSearchParams();
  f.set("mode", "payment");
  (v.methoden ?? []).forEach((m, i) => f.set(`payment_method_types[${i}]`, m));
  f.set("line_items[0][quantity]", "1");
  f.set("line_items[0][price_data][currency]", "eur");
  f.set("line_items[0][price_data][unit_amount]", String(v.betrag_cent));
  f.set("line_items[0][price_data][product_data][name]", `Bestellung bei ${v.betrieb_name ?? ""}`.slice(0, 120));
  f.set("line_items[0][price_data][product_data][description]", String(v.zweck ?? "").slice(0, 120));
  f.set("success_url", erfolg);
  f.set("cancel_url", abbruch);
  f.set("client_reference_id", bestellung);
  f.set("metadata[bestellung_id]", bestellung);
  f.set("metadata[zahlung_id]", String(v.zahlung_id ?? ""));
  f.set("payment_intent_data[metadata][bestellung_id]", bestellung);
  f.set("payment_intent_data[description]", String(v.zweck ?? "").slice(0, 120));
  f.set("expires_at", String(ablauf));
  return f;
}

Deno.serve(async (anfrage: Request) => {
  const origin = anfrage.headers.get("origin");
  const kopf = cors(origin);
  const antwort = (k: unknown, status = 200) => new Response(JSON.stringify(k), { status, headers: kopf });
  if (anfrage.method === "OPTIONS") return new Response(null, { status: 204, headers: kopf });
  if (anfrage.method !== "POST") return antwort({ ok: false, grund: "nur_post" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY || !STRIPE_KEY) return antwort({ ok: false, grund: "einrichtung" });

  let a: { bestellung_id?: unknown; zurueck?: unknown };
  try { a = await anfrage.json(); } catch { return antwort({ ok: false, grund: "kein_json" }); }
  const id = String(a.bestellung_id ?? "");
  if (!UUID.test(id)) return antwort({ ok: false, grund: "bestellung" });

  try {
    const v = await rpc("zahlung_stripe_vorbereiten", { p_bestellung: id }) as Vorbereitet;
    if (!v?.ok) return antwort({ ok: false, grund: v?.grund ?? "unbekannt" });
    if (v.wiederverwendet && v.url) return antwort({ ok: true, url: v.url });

    if (!v.stripe_konto || !v.slug || !SLUG.test(v.slug) || !Number.isInteger(v.betrag_cent) || (v.betrag_cent as number) < 50) {
      return antwort({ ok: false, grund: "keine_art" });
    }
    const basis = rueckkehr(a.zurueck, origin, v.slug);
    const jetzt = Math.floor(Date.now() / 1000);
    const f = formular(v, id, `${basis}?zahlung=ok#/bestellt`, `${basis}?zahlung=abbruch#/bestellt`, jetzt + 30 * 60);

    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_KEY}`,
        "Stripe-Account": v.stripe_konto,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `ck-${v.zahlung_id}-${v.versuch ?? 0}`,
      },
      body: f.toString(),
    });
    const s = await r.json().catch(() => null) as { id?: string; url?: string; expires_at?: number; error?: { message?: string; code?: string } } | null;
    if (!r.ok || !s?.id || !s.url) {
      console.error("stripe", r.status, s?.error?.code ?? "", s?.error?.message ?? "");
      return antwort({ ok: false, grund: "stripe" });
    }
    await rpc("zahlung_session_merken", {
      p_bestellung: id, p_session: s.id, p_url: s.url,
      p_ablauf: new Date((s.expires_at ?? jetzt + 30 * 60) * 1000).toISOString(),
    });
    return antwort({ ok: true, url: s.url });
  } catch (e) {
    console.error("zahlung-starten", e instanceof Error ? e.message : "fehler");
    return antwort({ ok: false, grund: "fehler" });
  }
});
