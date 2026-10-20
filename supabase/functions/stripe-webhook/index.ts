/* ═══════════════════════════════════════════════════════════════════
   STRIPE-WEBHOOK · der EINZIGE Weg, auf dem eine Online-Zahlung eine
   Bestellung für die Küche freigibt.

   Ausrollen OHNE Token-Prüfung (Stripe hat kein Konto, die Echtheit
   kommt aus der Unterschrift):
     supabase functions deploy stripe-webhook --no-verify-jwt
   Geheimnis: STRIPE_WEBHOOK_SECRET (whsec_…, Endpunkt vom Typ
   „Connected accounts“ — die Zahlungen laufen auf den Konten der Betriebe).
   Ereignisse: checkout.session.completed, .async_payment_succeeded,
   .async_payment_failed, .expired.

   Reihenfolge, und jede Zeile hat einen Grund:
     1 · Unterschrift über den ROHEN Körper (HMAC-SHA256, 5 min Toleranz).
         Ohne sie: 400, nichts gelesen, kein Datenbankaufruf.
     2 · Die Sitzung wird in der DATENBANK gesucht (zahlung_finden). Was
         die Anfrage über Betrieb oder Betrag behauptet, zählt nicht.
     3 · Konto des Ereignisses = Konto der Zahlung; Betrag und Währung
         = die Zeile in der Datenbank. Stimmt etwas nicht: NICHT freigeben.
     4 · Erst bei payment_status „paid“. SEPA-Lastschrift meldet bei
         „completed“ noch „unpaid“ und wird erst später bezahlt.
     5 · Das Ereignis wird einmal vermerkt; scheitert danach etwas, wird
         der Vermerk zurückgenommen und Stripe bekommt 500 (Wiederholung).
   ═══════════════════════════════════════════════════════════════════ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const TOLERANZ = 300;

interface Sitzung {
  id?: string; payment_status?: string; amount_total?: number; currency?: string; payment_intent?: string | null;
  payment_method_types?: string[]; metadata?: Record<string, string>;
}
interface Ereignis { id?: string; type?: string; account?: string; data?: { object?: Sitzung } }

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function unterschriftOk(roh: string, kopf: string | null, geheimnis: string, jetzt = Date.now()): Promise<boolean> {
  if (!kopf || !geheimnis) return false;
  let t = "";
  const v1: string[] = [];
  for (const teil of kopf.split(",")) {
    const i = teil.indexOf("=");
    if (i < 0) continue;
    const k = teil.slice(0, i).trim(), w = teil.slice(i + 1).trim();
    if (k === "t") t = w; else if (k === "v1") v1.push(w);
  }
  if (!/^\d{9,12}$/.test(t) || !v1.length) return false;
  if (Math.abs(jetzt / 1000 - Number(t)) > TOLERANZ) return false;
  const schluessel = await crypto.subtle.importKey("raw", new TextEncoder().encode(geheimnis), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const soll = hex(await crypto.subtle.sign("HMAC", schluessel, new TextEncoder().encode(`${t}.${roh}`)));
  return v1.some((x) => gleich(x, soll));
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

/* Der Push ans Team (melden). Beiwerk: scheitert er, bleibt die Zahlung gebucht. */
async function melden(id: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/swift-processor`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record: { id } }),
    });
  } catch { /* Beiwerk */ }
}

const antwort = (k: unknown, status = 200) => new Response(JSON.stringify(k), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (anfrage: Request) => {
  if (anfrage.method !== "POST") return antwort({ fehler: "nur POST" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY || !WEBHOOK_SECRET) return antwort({ fehler: "einrichtung" }, 500);

  const roh = await anfrage.text();
  if (roh.length > 200_000) return antwort({ fehler: "zu gross" }, 413);
  if (!(await unterschriftOk(roh, anfrage.headers.get("stripe-signature"), WEBHOOK_SECRET))) {
    return antwort({ fehler: "unterschrift" }, 400);
  }
  let e: Ereignis;
  try { e = JSON.parse(roh); } catch { return antwort({ fehler: "kein_json" }, 400); }

  const art = String(e.type ?? "");
  const s = e.data?.object;
  const BEACHTET = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"];
  if (!BEACHTET.includes(art) || !s?.id || !e.id) return antwort({ ignoriert: art || "leer" });

  let neu = false;
  try {
    neu = await rpc("zahlung_ereignis_neu", { p_id: e.id }) === true;
    if (!neu) return antwort({ doppelt: true });

    const z = await rpc("zahlung_finden", { p_session: s.id }) as
      { bestellung_id: string; betrieb_id: string; stripe_konto: string; betrag_cent: number; status: string } | null;
    if (!z) return antwort({ ignoriert: "unbekannte Sitzung" });
    if (!e.account || e.account !== z.stripe_konto) {
      console.error("stripe-webhook: Konto passt nicht", e.id);
      return antwort({ ignoriert: "konto" });
    }

    if (art === "checkout.session.expired") {
      await rpc("zahlung_scheitert", { p_bestellung: z.bestellung_id, p_status: "abgelaufen" });
      return antwort({ ok: true, status: "abgelaufen" });
    }
    if (art === "checkout.session.async_payment_failed") {
      await rpc("zahlung_scheitert", { p_bestellung: z.bestellung_id, p_status: "fehlgeschlagen" });
      return antwort({ ok: true, status: "fehlgeschlagen" });
    }
    /* completed / async_payment_succeeded */
    if (s.payment_status !== "paid") return antwort({ ok: true, wartet: s.payment_status ?? "unbekannt" });
    if (s.amount_total !== z.betrag_cent || String(s.currency ?? "").toLowerCase() !== "eur") {
      console.error("stripe-webhook: Betrag oder Währung passt nicht", e.id, s.amount_total, s.currency, z.betrag_cent);
      return antwort({ ignoriert: "betrag" });
    }
    const methode = (s.payment_method_types ?? []).length === 1 ? s.payment_method_types![0] : null;
    const f = await rpc("zahlung_freigeben", {
      p_bestellung: z.bestellung_id, p_methode: methode, p_ref: s.payment_intent ?? s.id, p_konto: e.account,
    }) as { ok?: boolean; schon?: boolean; rueckzahlung?: boolean; grund?: string } | null;
    if (!f?.ok) return antwort({ ignoriert: f?.grund ?? "abgewiesen" });
    if (f.rueckzahlung) console.error("stripe-webhook: bezahlt, aber Bestellung nicht mehr offen → Rückzahlung nötig", z.bestellung_id);
    if (!f.schon && !f.rueckzahlung) await melden(z.bestellung_id);
    return antwort({ ok: true, status: "bezahlt" });
  } catch (fehler) {
    console.error("stripe-webhook", fehler instanceof Error ? fehler.message : "fehler");
    if (neu && e.id) { try { await rpc("zahlung_ereignis_frei", { p_id: e.id }); } catch { /* Stripe wiederholt trotzdem */ } }
    return antwort({ fehler: "intern" }, 500);
  }
});
