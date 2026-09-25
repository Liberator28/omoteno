/* ═══════════════════════════════════════════════════════════════════
   NEWSLETTER-VORRAT-AUFFUELLEN · Neue Rabattcodes für den Klaviyo-Flow
   ═══════════════════════════════════════════════════════════════════

   Ausrollen (MIT Token-Prüfung, anders als die beiden Klaviyo-Melde-
   Functions — diese hier wird aus dem eingeloggten Admin-Board
   gerufen, genau wie uebersetzen):
     supabase functions deploy newsletter-vorrat-auffuellen
     supabase secrets set KLAVIYO_API_KEY=pk_...

   WARUM ES DIESE FUNKTION BRAUCHT. rabattcode_anlegen() in
   migration-rechnung-rabatt.sql ist ABSICHTLICH nur für service_role
   freigegeben (CLAUDE.md §2.3a) — der anon/authenticated-Schlüssel im
   Browser darf keine beliebigen Rabattcodes erzeugen. Der
   "Vorrat auffüllen"-Knopf im Board läuft aber mit dem
   authenticated-Schlüssel. Diese Funktion ist die einzige Brücke:
   Sie prüft das Nutzertoken (verify_jwt, kein --no-verify-jwt), prüft
   ZUSÄTZLICH per betrieb_mitglieder, dass der Nutzer wirklich zu
   diesem Betrieb gehört, und schreibt erst DANN mit dem
   service_role-Schlüssel.

   WAS SIE TUT
   1. Erzeugt <anzahl> zufällige Codes.
   2. Schreibt sie über rabattcode_anlegen in Supabase (service_role).
   3. Lädt dieselben Code-Strings zum Coupon dieses Betriebs in
      Klaviyo hoch (external_id = "<slug>_newsletter" — dasselbe
      Muster, mit dem die drei Coupons in dieser Sitzung angelegt
      wurden). Schritt 2 zuerst, dann 3 — ein Code ist in Supabase
      immer gültig, BEVOR Klaviyo ihn je verschicken könnte, nie
      umgekehrt.

   NICHT GEGEN DIE ECHTE KLAVIYO-API GETESTET (dieselbe ehrliche
   Grenze wie bei den beiden anderen Klaviyo-Funktionen).
   ═══════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KLAVIYO_KEY  = Deno.env.get("KLAVIYO_API_KEY") ?? "";
const KLAVIYO_REV  = "2024-10-15";

const antwort = (koerper: unknown, status = 200) =>
  new Response(JSON.stringify(koerper), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      /* Genau die Liste, die supabase-js selbst als nötig ausgibt
         (@supabase/supabase-js/cors, SUPABASE_HEADERS, Stand 2.117.2 —
         Kopie in pruefungen/stand-supabase-cors.mjs). VORFALL: Hier
         fehlte x-client-info; der Browser brach nach dem OPTIONS ab,
         die Funktion sah nie einen POST, das Board sagte „keine
         Verbindung“. pruef-edge.js hält jede Funktion gegen die Liste. */
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    },
  });

function codeErzeugen(slug: string): string {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne verwechselbare I/1/O/0
  let zufall = "";
  for (let i = 0; i < 6; i++) zufall += zeichen[Math.floor(Math.random() * zeichen.length)];
  return slug.toUpperCase().slice(0, 8) + "-" + zufall;
}

async function klaviyoCodesHochladen(externalId: string, codes: string[]) {
  const r = await fetch("https://a.klaviyo.com/api/coupon-bulk-create-jobs/", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_KEY}`,
      revision: KLAVIYO_REV,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        type: "coupon-code-bulk-create-job",
        attributes: {
          codes: codes.map((code) => ({ id: code, attributes: { unique_code: code } })),
        },
        relationships: { coupon: { data: { type: "coupon", id: externalId } } },
      },
    }),
  });
  return r.ok || r.status === 202;
}

Deno.serve(async (anfrage) => {
  if (anfrage.method === "OPTIONS") return antwort({}, 200);
  if (anfrage.method !== "POST") return antwort({ fehler: "nur POST" }, 405);

  /* Nutzertoken aus dem Header — dieselbe Sitzung wie im Board.
     Ein eigener Client MIT diesem Token, damit betrieb_mitglieder
     unter der echten RLS-Regel des Nutzers gelesen wird, nicht mit
     Admin-Rechten (CLAUDE.md §2.4-Muster: Rollenwechsel simulieren,
     nicht nur behaupten). */
  const authHeader = anfrage.headers.get("authorization") ?? "";
  const alsNutzer = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });

  let roh: any;
  try { roh = await anfrage.json(); }
  catch { return antwort({ fehler: "kein_json" }, 400); }

  const betriebId = String(roh?.betrieb_id || "");
  const anzahl = Math.min(Math.max(Number(roh?.anzahl) || 20, 1), 100);
  if (!betriebId) return antwort({ fehler: "betrieb_id fehlt" }, 400);

  const { data: mitglied } = await alsNutzer
    .from("betrieb_mitglieder")
    .select("betrieb_id")
    .eq("betrieb_id", betriebId)
    .maybeSingle();
  if (!mitglied) return antwort({ fehler: "kein_zugriff" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: betrieb } = await admin
    .from("betriebe").select("slug").eq("id", betriebId).maybeSingle();
  if (!betrieb) return antwort({ fehler: "betrieb_unbekannt" }, 404);

  const codes: string[] = [];
  for (let i = 0; i < anzahl; i++) codes.push(codeErzeugen(betrieb.slug));

  /* Erst in Supabase — jeder Code ist gültig, bevor Klaviyo ihn kennt. */
  for (const code of codes) {
    const { error } = await admin.rpc("rabattcode_anlegen", {
      p_betrieb_id: betriebId,
      p_code: code,
      p_betrag: 2.00,
      p_prozent: null,
      p_gueltig_bis: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
    });
    if (error) {
      console.error("rabattcode_anlegen fehlgeschlagen:", error.message);
      return antwort({ fehler: "supabase_schreibfehler", details: error.message }, 200);
    }
  }

  if (!KLAVIYO_KEY) return antwort({ ok: true, angelegt: codes.length, fehler: "kein_klaviyo_schluessel" });

  try {
    const hochgeladen = await klaviyoCodesHochladen(`${betrieb.slug}_newsletter`, codes);
    return antwort({ ok: true, angelegt: codes.length, klaviyo: hochgeladen });
  } catch (e) {
    console.error(e);
    return antwort({ ok: true, angelegt: codes.length, fehler: String((e as Error)?.message ?? e) });
  }
});
