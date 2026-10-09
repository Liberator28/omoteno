/* ═══════════════════════════════════════════════════════════════════
   KLAVIYO-PROFIL-MELDEN · Ein Gast hat seine E-Mail hinterlegt
   ═══════════════════════════════════════════════════════════════════

   Ausrollen:
     supabase functions deploy klaviyo-profil-melden --no-verify-jwt
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

   NEU (migration-klaviyo-besuch.sql): Der Trigger schickt NUR noch
   {gast_id, art} — art 'neu' (Adresse hinterlegt) oder 'besuch' (neuer
   Besuch, besuche stieg). Den Inhalt holt diese Funktion selbst über
   klaviyo_gast_stand() (CLAUDE.md §2.3d: eine gefälschte Anfrage kann
   so höchstens einen echten Gast neu melden, keinen Text einschleusen).
   Gesetzt werden Profil-Eigenschaften je Betrieb im gemeinsamen Konto:
     omoteno_<slug>_letzter_besuch  (ISO-Datum — daran hängt der
                                     Rückhol-Flow „20 Tage danach“)
     omoteno_<slug>_besuche, omoteno_<slug>_bestellungen,
     omoteno_<slug>_liebling        (für persönliche Mails)
   Upsert über /api/profile-import/ (Form gegen das Schema des
   Klaviyo-Werkzeugs create_or_update_profile gehalten) statt
   /api/profiles/ + 409-Behandlung. In die Liste nur bei art 'neu'.

   NICHT GEGEN DIE ECHTE KLAVIYO-API GETESTET. Die Arbeitsumgebung hat
   keinen Klaviyo-Schluessel fuer Ausfuehrungen in dieser Funktion
   (nur die MCP-Werkzeuge dieser Sitzung, die etwas anderes sind als
   ein Deno-Aufruf zur Laufzeit). Die Form der Aufrufe folgt Klaviyos
   dokumentierter JSON:API-Form (Revision 2024-10-15); der erste echte
   Lauf ist deiner. Deshalb faellt unten alles fail-open aus.
   ═══════════════════════════════════════════════════════════════════ */

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KLAVIYO_KEY    = Deno.env.get("KLAVIYO_API_KEY") ?? "";
const KLAVIYO_REV    = "2024-10-15";
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

type GastStand = {
  email: string; slug: string; name: string; liste: string | null;
  besuche: number | null; letzter_besuch: string | null; bestellungen: number | null;
  liebling: string | null;
};

/* Über die Funktion der Datenbank, nicht über die Tabellen: Sie entscheidet
   auch, ob überhaupt gemeldet wird (Newsletter an, Adresse da). */
async function gastLaden(gastId: string): Promise<GastStand | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/klaviyo_gast_stand`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_gast: gastId }),
  });
  if (!r.ok) return null;
  const roh = await r.json().catch(() => null);
  return roh && typeof roh === "object" && roh.email ? roh as GastStand : null;
}

/* Eigenschaften je Betrieb — ein Konto für alle Häuser, also mit Slug im Namen. */
function eigenschaften(g: GastStand): Record<string, unknown> {
  const p = `omoteno_${g.slug}_`;
  const e: Record<string, unknown> = { betrieb_slug: g.slug, betrieb_name: g.name };
  if (g.letzter_besuch) e[p + "letzter_besuch"] = new Date(g.letzter_besuch).toISOString();
  if (g.besuche != null) e[p + "besuche"] = g.besuche;
  if (g.bestellungen != null) e[p + "bestellungen"] = g.bestellungen;
  if (g.liebling) e[p + "liebling"] = String(g.liebling).slice(0, 80);
  return e;
}

async function klaviyo(pfad: string, koerper: unknown) {
  return await fetch(`https://a.klaviyo.com/api/${pfad}/`, {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_KEY}`,
      revision: KLAVIYO_REV,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(koerper),
  });
}

Deno.serve(async (anfrage) => {
  if (anfrage.method !== "POST") return antwort({ fehler: "nur POST" }, 405);

  const mitgeschickt = anfrage.headers.get("x-omoteno-trigger-secret") ?? "";
  if (!(await echt(mitgeschickt))) return antwort({ fehler: "nicht erlaubt" }, 401);

  let roh: any;
  try { roh = await anfrage.json(); }
  catch { return antwort({ fehler: "kein_json" }, 400); }

  const gastId = String(roh?.gast_id || "");
  const art = roh?.art === "besuch" ? "besuch" : roh?.art === "neu" ? "neu" : "";
  if (!UUID.test(gastId) || !art) return antwort({ fehler: "gast_id oder art fehlt" }, 400);

  /* Fail-open wie bei uebersetzen: Kein Schluessel heisst "noch nicht
     eingerichtet", nicht "kaputt". */
  if (!KLAVIYO_KEY) return antwort({ fehler: "kein_schluessel" }, 200);

  const gast = await gastLaden(gastId);
  if (!gast) return antwort({ ok: true, gemeldet: false }, 200);

  try {
    const profil = await klaviyo("profile-import", {
      data: { type: "profile", attributes: { email: gast.email, properties: eigenschaften(gast) } },
    });
    if (art === "besuch") return antwort({ ok: profil.ok });
    if (!gast.liste) return antwort({ ok: profil.ok, fehler: "keine_liste" }, 200);
    /* In die Liste nur beim ersten Hinterlegen — löst Klaviyos eigenes
       Double-Opt-in aus, falls die Liste es verlangt. */
    const liste = await klaviyo("profile-subscription-bulk-create-jobs", {
      data: {
        type: "profile-subscription-bulk-create-job",
        attributes: {
          profiles: {
            data: [{
              type: "profile",
              attributes: { email: gast.email, subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } } },
            }],
          },
        },
        relationships: { list: { data: { type: "list", id: gast.liste } } },
      },
    });
    return antwort({ ok: profil.ok && (liste.ok || liste.status === 202) });
  } catch (e) {
    console.error(e);
    return antwort({ fehler: String((e as Error)?.message ?? e) }, 200);
  }
});
