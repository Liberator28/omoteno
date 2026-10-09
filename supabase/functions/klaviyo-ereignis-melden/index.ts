/* ═══════════════════════════════════════════════════════════════════
   KLAVIYO-EREIGNIS-MELDEN · Eine Bestellung mit bekannter E-Mail
   ═══════════════════════════════════════════════════════════════════

   Ausrollen:
     supabase functions deploy klaviyo-ereignis-melden --no-verify-jwt
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

   NEU (migration-klaviyo-besuch.sql): Der Trigger schickt NUR die
   bestellung_id; den Inhalt holt diese Funktion über
   klaviyo_bestellung_stand() — und die meldet nichts, was markiert
   (pruefen), storniert oder ein Serviceruf ist. Das Ereignis trägt
   Summe (value, EUR) und die Gerichte (für persönliche Mails), und
   unique_id = bestellung_id: Ein wiederholter Aufruf zählt nicht
   doppelt. Am Profil wird omoteno_<slug>_letzter_besuch mitgesetzt —
   eine Bestellung ist ein Besuch, der Rückhol-Flow rückt nach hinten.
   Form gegen das Schema des Klaviyo-Werkzeugs create_event gehalten.

   NICHT GEGEN DIE ECHTE KLAVIYO-API GETESTET (dieselbe ehrliche
   Grenze wie bei klaviyo-profil-melden) — Form folgt Klaviyos
   dokumentierter Events-API (Revision 2024-10-15). Faellt komplett
   fail-open aus: Eine Bestellung, die sich nicht melden laesst, ist
   nie ein Grund, die Bestellung selbst anzutasten — dieser Aufruf
   laeuft asynchron NACH dem eigentlichen Insert (CLAUDE.md §7).
   ═══════════════════════════════════════════════════════════════════ */

const KLAVIYO_KEY    = Deno.env.get("KLAVIYO_API_KEY") ?? "";
const KLAVIYO_REV    = "2024-10-15";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UUID           = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Echt ist ein Aufruf, dessen Kopf das Geheimnis aus dem Vault trägt.
   VORFALL (migration-klaviyo-besuch.sql): Das Geheimnis stand zweimal —
   als Edge-Secret OMOTENO_TRIGGER_SECRET und im Trigger — und die beiden
   Kopien waren verschieden: Der Probeaufruf aus der Datenbank bekam 401,
   und kein Fehler erschien irgendwo. Jetzt gibt es EINE Quelle; gefragt
   wird über klaviyo_geheimnis_ok() (nur service_role, gibt nur ja/nein). */
async function echt(wert: string): Promise<boolean> {
  if (wert.length < 32) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/klaviyo_geheimnis_ok`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_wert: wert }),
  }).catch(() => null);
  if (!r || !r.ok) return false;
  return (await r.json().catch(() => false)) === true;
}

const antwort = (koerper: unknown, status = 200) =>
  new Response(JSON.stringify(koerper), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type BestellStand = {
  email: string; slug: string; name: string; zeitpunkt: string; quelle: string;
  summe: number; rabatt_code: string | null; gerichte: string[];
};

async function bestellungLaden(id: string): Promise<BestellStand | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/klaviyo_bestellung_stand`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_bestellung: id }),
  });
  if (!r.ok) return null;
  const roh = await r.json().catch(() => null);
  return roh && typeof roh === "object" && roh.email ? roh as BestellStand : null;
}

Deno.serve(async (anfrage) => {
  if (anfrage.method !== "POST") return antwort({ fehler: "nur POST" }, 405);

  const mitgeschickt = anfrage.headers.get("x-omoteno-trigger-secret") ?? "";
  if (!(await echt(mitgeschickt))) return antwort({ fehler: "nicht erlaubt" }, 401);

  let roh: any;
  try { roh = await anfrage.json(); }
  catch { return antwort({ fehler: "kein_json" }, 400); }

  const bestellungId = String(roh?.bestellung_id || "");
  if (!UUID.test(bestellungId)) return antwort({ fehler: "bestellung_id fehlt" }, 400);
  if (!KLAVIYO_KEY) return antwort({ fehler: "kein_schluessel" }, 200);

  const b = await bestellungLaden(bestellungId);
  if (!b) return antwort({ ok: true, gemeldet: false }, 200);

  const zeit = new Date(b.zeitpunkt).toISOString();
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
            time: zeit,
            unique_id: bestellungId,
            value: Number(b.summe) || 0,
            value_currency: "EUR",
            properties: {
              betrieb_slug: b.slug,
              quelle: b.quelle,
              gerichte: (b.gerichte || []).slice(0, 20),
              anzahl_gerichte: (b.gerichte || []).length,
              mit_code: !!b.rabatt_code,
            },
            metric: { data: { type: "metric", attributes: { name: `Bestellung aufgegeben – ${b.name}` } } },
            profile: {
              data: {
                type: "profile",
                attributes: { email: b.email, properties: { [`omoteno_${b.slug}_letzter_besuch`]: zeit } },
              },
            },
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
