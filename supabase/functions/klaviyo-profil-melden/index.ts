/* ═══════════════════════════════════════════════════════════════════
   KLAVIYO-PROFIL-MELDEN · Ein Gast hat seine E-Mail hinterlegt
   ═══════════════════════════════════════════════════════════════════

   Ausrollen:
     supabase functions deploy klaviyo-profil-melden --no-verify-jwt
     supabase secrets set OMOTENO_TRIGGER_SECRET=<derselbe Wert wie im SQL-Trigger>
     supabase secrets set KLAVIYO_API_KEY=pk_...
     supabase secrets set SUPABASE_URL=... (steht meist schon)
     supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...

   --no-verify-jwt ist Absicht, genau wie bei alessia-bestellung: Der
   Aufrufer ist ein Datenbank-TRIGGER (gaeste_klaviyo_melden(), siehe
   migration-newsletter-klaviyo.sql), kein eingeloggter Browser. Die
   Echtheit haengt am gemeinsamen Geheimnis im Kopf
   X-Omoteno-Trigger-Secret, nicht an einem Supabase-Nutzertoken.

   WAS DIESE FUNKTION TUT
   ───────────────────────
   1. Betrieb nachschlagen (Name, Klaviyo-Listen-ID) — der Trigger
      schickt nur betrieb_id und email, keine Markendaten, damit die
      Datenbank nicht wissen muss, wie Klaviyo aussieht.
   2. Profil in Klaviyo anlegen/aktualisieren, mit einer eigenen
      Eigenschaft "betrieb_slug" — WICHTIG, weil der Klaviyo-Account
      EIN gemeinsamer Omoteno-Account fuer alle Betriebe ist, keiner
      pro Haus. Ohne diese Eigenschaft liesse sich in Segmenten/Flows
      nicht nach Betrieb unterscheiden.
   3. Profil der Liste des Betriebs hinzufuegen — ueber den
      Bulk-Subscribe-Job, der Klaviyos EIGENES Double-Opt-in ausloest,
      falls die Liste danach verlangt. Genau das loest das im Hub
      schon gegebene Versprechen ein ("Sie hoeren erst von uns, wenn
      Sie die Adresse bestaetigt haben") — ohne dass Omoteno selbst
      eine Bestaetigungsmail bauen muss.

   Fehlt betriebe.klaviyo_liste_id (Block D noch nicht gelaufen), wird
   das Profil trotzdem angelegt, aber niemandem zugeordnet — mit
   fehler:"keine_liste" gemeldet, nicht als harter Fehler, damit ein
   Gast, der zufaellig als erster seine Adresse eintraegt, nichts
   davon merkt (CLAUDE.md §7: die Kosten eines stillen Ausfalls hier
   sind klein, ein kaputter Speichervorgang waere teuer).

   NICHT GEGEN DIE ECHTE KLAVIYO-API GETESTET. Die Arbeitsumgebung hat
   keinen Klaviyo-Schluessel fuer Ausfuehrungen in dieser Funktion
   (nur die MCP-Werkzeuge dieser Sitzung, die etwas anderes sind als
   ein Deno-Aufruf zur Laufzeit). Die Form der Aufrufe folgt Klaviyos
   dokumentierter JSON:API-Form (Revision 2024-10-15); der erste echte
   Lauf ist deiner. Deshalb faellt unten alles fail-open aus.
   ═══════════════════════════════════════════════════════════════════ */

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TRIGGER_SECRET = Deno.env.get("OMOTENO_TRIGGER_SECRET") ?? "";
const KLAVIYO_KEY    = Deno.env.get("KLAVIYO_API_KEY") ?? "";
const KLAVIYO_REV    = "2024-10-15";

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

async function betriebLaden(betriebId: string) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/betriebe?id=eq.${betriebId}&select=id,slug,name,klaviyo_liste_id`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!r.ok) return null;
  const zeilen = await r.json();
  return Array.isArray(zeilen) && zeilen[0] ? zeilen[0] : null;
}

async function klaviyoProfilAnlegen(email: string, betrieb: { slug: string; name: string }) {
  const r = await fetch("https://a.klaviyo.com/api/profiles/", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_KEY}`,
      revision: KLAVIYO_REV,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        type: "profile",
        attributes: {
          email,
          properties: { betrieb_slug: betrieb.slug, betrieb_name: betrieb.name },
        },
      },
    }),
  });
  const roh = await r.json().catch(() => ({}));
  /* Klaviyo antwortet mit 409 + der vorhandenen ID, wenn das Profil
     schon existiert — das ist kein Fehler, sondern der Normalfall bei
     einem wiederkehrenden Gast. */
  if (r.status === 409) {
    const vorhandeneId = roh?.errors?.[0]?.meta?.duplicate_profile_id;
    return vorhandeneId ?? null;
  }
  if (!r.ok) return null;
  return roh?.data?.id ?? null;
}

async function klaviyoListeEintragen(email: string, listeId: string) {
  const r = await fetch("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_KEY}`,
      revision: KLAVIYO_REV,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        type: "profile-subscription-bulk-create-job",
        attributes: {
          profiles: {
            data: [{
              type: "profile",
              attributes: {
                email,
                subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
              },
            }],
          },
        },
        relationships: { list: { data: { type: "list", id: listeId } } },
      },
    }),
  });
  return r.ok || r.status === 202;
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
  if (!betriebId || !email) return antwort({ fehler: "betrieb_id oder email fehlt" }, 400);

  if (!KLAVIYO_KEY) {
    /* Fail-open wie bei uebersetzen: Kein Schluessel heisst "noch
       nicht eingerichtet", nicht "kaputt". */
    return antwort({ fehler: "kein_schluessel" }, 200);
  }

  const betrieb = await betriebLaden(betriebId);
  if (!betrieb) return antwort({ fehler: "betrieb_unbekannt" }, 200);

  try {
    await klaviyoProfilAnlegen(email, betrieb);
    if (!betrieb.klaviyo_liste_id) {
      return antwort({ ok: true, fehler: "keine_liste" }, 200);
    }
    const eingetragen = await klaviyoListeEintragen(email, betrieb.klaviyo_liste_id);
    return antwort({ ok: eingetragen });
  } catch (e) {
    console.error(e);
    return antwort({ fehler: String((e as Error)?.message ?? e) }, 200);
  }
});
