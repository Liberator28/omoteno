/* ═══════════════════════════════════════════════════════════════════
   KLAVIYO-EREIGNIS-MELDEN · Eine Bestellung mit bekannter E-Mail
   ═══════════════════════════════════════════════════════════════════

   Ausrollen:
     supabase functions deploy klaviyo-ereignis-melden --no-verify-jwt
     supabase secrets set OMOTENO_TRIGGER_SECRET=<derselbe Wert wie im SQL-Trigger>
     supabase secrets set KLAVIYO_API_KEY=pk_...

   Aufgerufen von bestellung_klaviyo_melden() (siehe
   migration-newsletter-klaviyo.sql) — derselbe Geheimnis-Kopf wie bei
   klaviyo-profil-melden, aus demselben Grund: ein DB-Trigger hat kein
   Nutzertoken.

   WOZU. Das Klaviyo-Ereignis "Bestellung aufgegeben – <Betrieb>" ist
   die Grundlage fuer die 20-Tage-Retargeting-Segmentierung aus
   Block E: ein Segment "war in der Liste, hat dieses Ereignis aber
   20 Tage nicht ausgeloest" kann nur greifen, wenn hier ueberhaupt
   Ereignisse ankommen. Der Name traegt den Betrieb, weil EIN
   gemeinsamer Klaviyo-Account fuer alle Haeuser laeuft — ohne den
   Betrieb im Namen wuerde eine Bestellung bei Chocolamour auch das
   Segment von Minhkeey ausloesen.

   NICHT GEGEN DIE ECHTE KLAVIYO-API GETESTET (dieselbe ehrliche
   Grenze wie bei klaviyo-profil-melden) — Form folgt Klaviyos
   dokumentierter Events-API (Revision 2024-10-15). Faellt komplett
   fail-open aus: Eine Bestellung, die sich nicht melden laesst, ist
   nie ein Grund, die Bestellung selbst anzutasten — dieser Aufruf
   laeuft asynchron NACH dem eigentlichen Insert (CLAUDE.md §7).
   ═══════════════════════════════════════════════════════════════════ */

const TRIGGER_SECRET = Deno.env.get("OMOTENO_TRIGGER_SECRET") ?? "";
const KLAVIYO_KEY    = Deno.env.get("KLAVIYO_API_KEY") ?? "";
const KLAVIYO_REV    = "2024-10-15";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function gleichLang(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const antwort = (koerper: unknown, status = 200) =>
  new Response(JSON.stringify(koerper), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function betriebNameLaden(betriebId: string) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/betriebe?id=eq.${betriebId}&select=slug,name`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!r.ok) return null;
  const zeilen = await r.json();
  return Array.isArray(zeilen) && zeilen[0] ? zeilen[0] : null;
}

Deno.serve(async (anfrage) => {
  if (anfrage.method !== "POST") return antwort({ fehler: "nur POST" }, 405);

  if (!TRIGGER_SECRET) {
    console.error("OMOTENO_TRIGGER_SECRET ist nicht gesetzt — es wird nichts angenommen.");
    return antwort({ fehler: "nicht eingerichtet" }, 503);
  }
  const mitgeschickt = anfrage.headers.get("x-omoteno-trigger-secret") ?? "";
  if (!gleichLang(mitgeschickt, TRIGGER_SECRET)) {
    return antwort({ fehler: "nicht erlaubt" }, 401);
  }

  let roh: any;
  try { roh = await anfrage.json(); }
  catch { return antwort({ fehler: "kein_json" }, 400); }

  const betriebId = String(roh?.betrieb_id || "");
  const email = String(roh?.email || "").trim();
  const zeitpunkt = roh?.zeitpunkt ? String(roh.zeitpunkt) : new Date().toISOString();
  if (!betriebId || !email) return antwort({ fehler: "betrieb_id oder email fehlt" }, 400);

  if (!KLAVIYO_KEY) return antwort({ fehler: "kein_schluessel" }, 200);

  const betrieb = await betriebNameLaden(betriebId);
  if (!betrieb) return antwort({ fehler: "betrieb_unbekannt" }, 200);

  try {
    const r = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${KLAVIYO_KEY}`,
        revision: KLAVIYO_REV,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            time: zeitpunkt,
            properties: { betrieb_slug: betrieb.slug },
            metric: {
              data: {
                type: "metric",
                attributes: { name: `Bestellung aufgegeben – ${betrieb.name}` },
              },
            },
            profile: { data: { type: "profile", attributes: { email } } },
          },
        },
      }),
    });
    return antwort({ ok: r.ok || r.status === 202 });
  } catch (e) {
    console.error(e);
    return antwort({ fehler: String((e as Error)?.message ?? e) }, 200);
  }
});
