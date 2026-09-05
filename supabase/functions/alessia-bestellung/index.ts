/* ═══════════════════════════════════════════════════════════════════
   ALESSIA · Der Webhook, den Vapi ruft
   ═══════════════════════════════════════════════════════════════════

   Ausrollen:
     supabase functions deploy alessia-bestellung --no-verify-jwt
     supabase secrets set VAPI_SECRET=<derselbe Wert wie in Vapi>

   --no-verify-jwt ist Absicht: Vapi schickt kein Supabase-Token.
   Die Echtheit haengt stattdessen am gemeinsamen Geheimnis im Kopf
   X-Vapi-Secret. Ohne diese Pruefung koennte JEDER Bestellungen in
   fremde Kuechen legen — deshalb steht sie ganz vorn und bricht ab,
   bevor irgendetwas gelesen wird.

   WAS DIESE FUNKTION NICHT TUT: Sie glaubt Alessia keinen Preis. Der
   wird in bestellung_telefon() aus der Karte NACHGERECHNET. Ein
   Sprachmodell am Telefon kann sich verhoeren, und ein Anrufer kann
   alles behaupten. Massgeblich ist die Karte (CLAUDE.md 2.3a).

   NICHT GEGEN VAPI GETESTET. Die Arbeitsumgebung erreicht weder
   Supabase noch Vapi. Die Form der Nutzlast unten folgt Vapis
   dokumentiertem tool-call-Format; weicht deine Fassung ab, ist
   „nutzlastLesen" die einzige Stelle, die angepasst werden muss.
   ═══════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPI_SECRET  = Deno.env.get("VAPI_SECRET") ?? "";

/* Zeitgleicher Vergleich. Ein gewoehnliches === verraet ueber die
   Laufzeit, wie viele Zeichen stimmen — bei einem Geheimnis, das
   beliebig oft geraten werden darf, ist das der Unterschied zwischen
   „nicht zu erraten" und „in ein paar tausend Versuchen". */
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

/* Vapi verpackt einen Werkzeugaufruf verschachtelt und nicht immer
   gleich. Hier wird beides gelesen, statt sich auf eine Form zu
   verlassen — und was fehlt, faellt auf undefined statt auf einen
   Absturz. */
function nutzlastLesen(roh: any) {
  const nachricht = roh?.message ?? roh;
  const werkzeug =
    nachricht?.toolCalls?.[0] ??
    nachricht?.toolCallList?.[0] ??
    nachricht?.functionCall ??
    null;

  let argumente = werkzeug?.function?.arguments ?? werkzeug?.parameters ?? {};
  if (typeof argumente === "string") {
    try { argumente = JSON.parse(argumente); } catch { argumente = {}; }
  }

  const anruf = nachricht?.call ?? roh?.call ?? {};
  return {
    werkzeugId: werkzeug?.id ?? werkzeug?.toolCallId ?? null,
    /* Die ANGERUFENE Nummer entscheidet, in welches Haus die
       Bestellung geht. Niemals die des Anrufers — die kann jeder
       faelschen, und sie sagt ohnehin nichts ueber das Restaurant. */
    gerufen:  anruf?.phoneNumber?.number ?? anruf?.phoneNumberId ?? argumente?.gerufene_nummer ?? null,
    anrufer:  anruf?.customer?.number ?? argumente?.anrufer ?? null,
    name:     argumente?.name ?? anruf?.customer?.name ?? null,
    positionen: Array.isArray(argumente?.positionen) ? argumente.positionen : [],
    notiz:      argumente?.notiz ?? null,
    abholung:   argumente?.abholung ?? true,
    wunschzeit: argumente?.wunschzeit ?? null,
    transkript: nachricht?.transcript ?? nachricht?.artifact?.transcript ?? null,
    rufId:      anruf?.id ?? null,
  };
}

Deno.serve(async (anfrage) => {
  if (anfrage.method !== "POST") return antwort({ error: "nur POST" }, 405);

  /* ── Echtheit zuerst, vor allem anderen ── */
  if (!VAPI_SECRET) {
    console.error("VAPI_SECRET ist nicht gesetzt — es wird nichts angenommen.");
    return antwort({ error: "nicht eingerichtet" }, 503);
  }
  const mitgeschickt = anfrage.headers.get("x-vapi-secret") ?? "";
  if (!gleichLang(mitgeschickt, VAPI_SECRET)) {
    return antwort({ error: "nicht erlaubt" }, 401);
  }

  let roh: any;
  try { roh = await anfrage.json(); }
  catch { return antwort({ error: "kein JSON" }, 400); }

  const d = nutzlastLesen(roh);
  if (!d.gerufen) {
    return antwort({ error: "keine gerufene Nummer in der Nutzlast" }, 400);
  }

  /* ── In die Datenbank, ueber die gepruefte Funktion ── */
  const ruf = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bestellung_telefon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      p_gerufene_nummer: String(d.gerufen),
      p_anrufer:    d.anrufer ? String(d.anrufer) : null,
      p_name:       d.name ? String(d.name) : null,
      p_positionen: d.positionen,
      p_notiz:      d.notiz,
      p_abholung:   d.abholung !== false,
      p_wunschzeit: d.wunschzeit,
      p_transkript: d.transkript,
      p_ruf_id:     d.rufId,
    }),
  });

  if (!ruf.ok) {
    const text = await ruf.text();
    console.error("bestellung_telefon abgelehnt:", ruf.status, text.slice(0, 400));
    /* Alessia bekommt einen Satz, den sie vorlesen kann — keinen
       Fehlercode. Der Anrufer soll nicht in der Leitung raten. */
    return antwort({
      results: [{
        toolCallId: d.werkzeugId,
        result: "Das hat gerade nicht geklappt. Bitte versuchen Sie es in einem Moment noch einmal.",
      }],
    });
  }

  const erg = await ruf.json();
  return antwort({
    results: [{
      toolCallId: d.werkzeugId,
      result: erg?.sagen ?? (erg?.ok ? "Notiert." : "Das hat nicht geklappt."),
    }],
  });
});
