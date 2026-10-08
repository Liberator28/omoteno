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
   ZUSÄTZLICH, dass der Nutzer Inhaber dieses Betriebs ist, und
   schreibt erst DANN mit dem service_role-Schlüssel.

   WAS SIE TUT
   1. Erzeugt <anzahl> zufällige Codes.
   2. Schreibt sie über rabattcode_anlegen in Supabase (service_role).
   3. Lädt dieselben Code-Strings zum Coupon dieses Betriebs in
      Klaviyo hoch (external_id = "<slug>_newsletter" — dasselbe
      Muster, mit dem die drei Coupons in dieser Sitzung angelegt
      wurden). Schritt 2 zuerst, dann 3 — ein Code ist in Supabase
      immer gültig, BEVOR Klaviyo ihn je verschicken könnte, nie
      umgekehrt.

   ÜBERARBEITET (migration-gutschein-sicher.sql, Wunsch „keine
   Gutscheine ausnutzbar“). Befund vorher:
     · jedes Mitglied durfte auffüllen, beliebig oft, je 100 Codes;
     · Codes aus Math.random, nur 6 Zeichen (32^6 ≈ 10^9) — nicht
       kryptografisch, und für einen Rabatt zu kurz;
     · Klaviyo-Endpunkt coupon-bulk-create-jobs mit attributes.codes —
       weder Pfad noch Körper stimmten mit der Schnittstelle überein
       (zweite Quelle: Schema des Klaviyo-Werkzeugs
       bulk_create_coupon_codes: /coupon-code-bulk-create-jobs/,
       attributes["coupon-codes"].data[] mit type "coupon-code" und
       relationships.coupon). Der Upload ist vermutlich nie gelungen.
     · Abweisungen kamen als 403 — supabase-js meldet das als
       allgemeinen Fehler, das Board sagte „Verbindung prüfen“.
   Jetzt: nur der Inhaber (gutschein_recht().inhaber, also mit PIN-
   Pflicht), höchstens 50 je Aufruf und 4 Aufrufe je Tag und Betrieb,
   10 Zeichen aus crypto.getRandomValues, Abweisung als 200 mit Grund.

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

/* 10 Zeichen aus 32 (ohne I/1/O/0) = 2^50. 256 ist durch 32 teilbar:
   jedes Zeichen gleich wahrscheinlich. Vorsilbe höchstens 8 Zeichen →
   höchstens 19, die Schranke rabattcodes_code_form erlaubt 24. */
function codeErzeugen(slug: string): string {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const zufall = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => zeichen[b % 32]).join("");
  const vor = slug.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return vor ? vor + "-" + zufall : zufall;
}

async function klaviyoCodesHochladen(externalId: string, codes: string[], bis: string) {
  const r = await fetch("https://a.klaviyo.com/api/coupon-code-bulk-create-jobs/", {
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
          "coupon-codes": {
            data: codes.map((code) => ({
              type: "coupon-code",
              attributes: { unique_code: code, expires_at: bis },
              relationships: { coupon: { data: { type: "coupon", id: externalId } } },
            })),
          },
        },
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
  const anzahl = Math.min(Math.max(Number(roh?.anzahl) || 20, 1), 50);
  if (!betriebId) return antwort({ fehler: "betrieb_id fehlt" }, 400);

  /* Nur der Inhaber — gefragt MIT dem Token des Aufrufers über
     gutschein_recht() (hängt an meine_betriebe(), also an der PIN-
     Pflicht, und an ist_inhaber()). Ein Mitglied mit Gutschein-Recht
     stellt einzelne Codes im Board aus, keine Hunderte. */
  const { data: recht } = await alsNutzer.rpc("gutschein_recht", { p_betrieb: betriebId });
  if (!recht || !recht.ok || !recht.inhaber) return antwort({ ok: false, fehler: "kein_zugriff" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  /* Tagesdeckel je Betrieb. Gezählt wird VOR dem Schreiben und nie
     danach geworfen (§2.3g) — die Antwort sagt den Grund. */
  const { data: aufrufe } = await admin.rpc("schutz_zaehlen", { p_schluessel: "vorrat:" + betriebId, p_min: 1440 });
  if (typeof aufrufe === "number" && aufrufe > 4) return antwort({ ok: false, fehler: "grenze" });
  const { data: betrieb } = await admin
    .from("betriebe").select("slug").eq("id", betriebId).maybeSingle();
  if (!betrieb) return antwort({ fehler: "betrieb_unbekannt" }, 404);

  const codes: string[] = [];
  for (let i = 0; i < anzahl; i++) codes.push(codeErzeugen(betrieb.slug));

  /* Erst in Supabase — jeder Code ist gültig, bevor Klaviyo ihn kennt. */
  const bis = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
  for (const code of codes) {
    const { error } = await admin.rpc("rabattcode_anlegen", {
      p_betrieb_id: betriebId,
      p_code: code,
      p_betrag: 2.00,
      p_prozent: null,
      p_gueltig_bis: bis,
    });
    if (error) {
      console.error("rabattcode_anlegen fehlgeschlagen:", error.message);
      return antwort({ fehler: "supabase_schreibfehler", details: error.message }, 200);
    }
  }

  if (!KLAVIYO_KEY) return antwort({ ok: true, angelegt: codes.length, fehler: "kein_klaviyo_schluessel" });

  try {
    const hochgeladen = await klaviyoCodesHochladen(`${betrieb.slug}_newsletter`, codes, bis);
    return antwort({ ok: true, angelegt: codes.length, klaviyo: hochgeladen });
  } catch (e) {
    console.error(e);
    return antwort({ ok: true, angelegt: codes.length, fehler: String((e as Error)?.message ?? e) });
  }
});
