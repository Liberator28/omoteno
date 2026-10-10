/* ═══════════════════════════════════════════════════════════════════
   ALESSIA · Der Webhook, den Vapi für JEDEN Betrieb ruft (neu 10.10.)
   ═══════════════════════════════════════════════════════════════════

   Ausrollen (einmal, gilt für alle Betriebe):
     supabase functions deploy alessia-bestellung --no-verify-jwt
     supabase secrets set VAPI_SECRET=<derselbe Wert wie in Vapi>

   --no-verify-jwt ist Absicht: Vapi schickt kein Supabase-Token. Die
   Echtheit hängt am gemeinsamen Geheimnis im Kopf X-Vapi-Secret — es
   steht ganz vorn und bricht ab, bevor irgendetwas gelesen wird.

   Zwei Werkzeuge, beide hier:
     karte_lesen  → alessia_wissen()    was der Hub jedem Gast zeigt
     bestellen    → bestellung_telefon() Preis aus der Karte NACHGERECHNET

   TRENNUNG DER BETRIEBE: Welches Haus gemeint ist, steht NUR in der
   Anrufinfo von Vapi (angerufene Nummer bzw. Vapi-Nummer-ID). Nie in
   den Argumenten, die das Sprachmodell füllt — sonst könnte ein
   Anrufer („bestell das bei Blend“) oder ein verhörtes Wort die
   Bestellung in eine fremde Küche legen. Die Datenbank prüft danach
   jedes Gericht gegen genau diese eine Karte.

   Ehrliche Grenze: Gegen einen echten Vapi-Anruf ist das hier nicht
   getestet (keine Vapi-Verbindung aus der Arbeitsumgebung). Die Form
   folgt Vapis tool-calls-Nachricht; weicht sie ab, ist
   „nutzlastLesen“ die einzige Stelle, die angepasst werden muss.
   ═══════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPI_SECRET  = Deno.env.get("VAPI_SECRET") ?? "";

/* Zeitgleicher Vergleich: Ein gewöhnliches === verrät über die
   Laufzeit, wie viele Zeichen stimmen. */
function gleichLang(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const antwort = (koerper: unknown, status = 200) =>
  new Response(JSON.stringify(koerper), { status, headers: { "Content-Type": "application/json" } });

type Aufruf = { id: string | null; name: string; argumente: Record<string, unknown> };
type Nutzlast = {
  aufrufe: Aufruf[];
  gerufen: string | null;
  nummerId: string | null;
  anrufer: string | null;
  rufId: string | null;
  transkript: string | null;
};

/* Vapi verpackt Werkzeugaufrufe verschachtelt und nicht immer gleich;
   beides wird gelesen. Was fehlt, wird null — kein Absturz. */
function nutzlastLesen(roh: any): Nutzlast {
  const nachricht = roh?.message ?? roh ?? {};
  const liste: any[] = Array.isArray(nachricht?.toolCallList) ? nachricht.toolCallList
    : Array.isArray(nachricht?.toolCalls) ? nachricht.toolCalls
    : nachricht?.functionCall ? [nachricht.functionCall] : [];
  const aufrufe: Aufruf[] = liste.map((w: any) => {
    let arg = w?.function?.arguments ?? w?.arguments ?? w?.parameters ?? {};
    if (typeof arg === "string") { try { arg = JSON.parse(arg); } catch { arg = {}; } }
    if (!arg || typeof arg !== "object" || Array.isArray(arg)) arg = {};
    return { id: w?.id ?? w?.toolCallId ?? null, name: String(w?.function?.name ?? w?.name ?? ""), argumente: arg };
  });
  const anruf = nachricht?.call ?? roh?.call ?? {};
  const text = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  return {
    aufrufe,
    /* Nur aus der Anrufinfo — NIE aus den Argumenten (siehe oben). */
    gerufen:  text(nachricht?.phoneNumber?.number) ?? text(anruf?.phoneNumber?.number),
    nummerId: text(anruf?.phoneNumberId) ?? text(nachricht?.phoneNumber?.id),
    anrufer:  text(anruf?.customer?.number) ?? text(nachricht?.customer?.number),
    rufId:    text(anruf?.id),
    transkript: text(nachricht?.artifact?.transcript) ?? text(nachricht?.transcript),
  };
}

/* Welche Funktion ein Werkzeug ruft, und mit welchen Feldern. Die
   Feldnamen sind dieselben wie die Parameter in
   datenbank/migration-telefonbestellung.sql (pruef-alessia.js hält
   beide gegeneinander). */
function rpcFuer(a: Aufruf, d: Nutzlast): { fn: string; koerper: Record<string, unknown> } | null {
  if (a.name === "karte_lesen") {
    return { fn: "alessia_wissen", koerper: { p_gerufene_nummer: d.gerufen, p_nummer_id: d.nummerId } };
  }
  if (a.name === "bestellen") {
    const arg = a.argumente;
    const pos = Array.isArray(arg.positionen) ? arg.positionen.slice(0, 40)
      .filter((p: any) => p && typeof p === "object")
      .map((p: any) => ({ name: String(p.name ?? "").slice(0, 160), menge: Number.isFinite(+p.menge) ? Math.trunc(+p.menge) : 1 })) : [];
    const zeit = typeof arg.wunschzeit === "string" && !isNaN(Date.parse(arg.wunschzeit)) ? arg.wunschzeit : null;
    return { fn: "bestellung_telefon", koerper: {
      p_gerufene_nummer: d.gerufen,
      p_nummer_id:       d.nummerId,
      p_anrufer:         d.anrufer,
      p_name:            typeof arg.name === "string" ? arg.name.slice(0, 80) : null,
      p_positionen:      pos,
      p_notiz:           typeof arg.notiz === "string" ? arg.notiz.slice(0, 500) : null,
      p_wunschzeit:      zeit,
      p_transkript:      d.transkript ? d.transkript.slice(0, 8000) : null,
      p_ruf_id:          d.rufId,
    } };
  }
  return null;
}

/* Was Alessia vorliest — nie ein Fehlercode, nie ein Stück Technik. */
function ergebnisText(fn: string, erg: any): string {
  if (fn === "alessia_wissen") {
    if (!erg?.ok) return "Ich kann die Karte gerade nicht abrufen. Bitte rufen Sie das Restaurant direkt an.";
    return JSON.stringify({ betrieb: erg.betrieb, nimmt_an: erg.nimmt_an, pause_satz: erg.pause_satz ?? null,
                            abholung: erg.abholung, lieferung_im_hub: erg.lieferung_im_hub, karte: erg.karte });
  }
  return typeof erg?.sagen === "string" ? erg.sagen : (erg?.ok ? "Notiert." : "Das hat gerade nicht geklappt.");
}

async function rpc(fn: string, koerper: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(koerper),
  });
  if (!r.ok) { console.error(fn + " abgelehnt:", r.status, (await r.text()).slice(0, 300)); return null; }
  return await r.json();
}

async function bearbeiten(anfrage: Request): Promise<Response> {
  if (anfrage.method !== "POST") return antwort({ error: "nur POST" }, 405);
  if (!VAPI_SECRET) {
    console.error("VAPI_SECRET ist nicht gesetzt — es wird nichts angenommen.");
    return antwort({ error: "nicht eingerichtet" }, 503);
  }
  if (!gleichLang(anfrage.headers.get("x-vapi-secret") ?? "", VAPI_SECRET)) return antwort({ error: "nicht erlaubt" }, 401);

  let roh: any;
  try { roh = await anfrage.json(); } catch { return antwort({ error: "kein JSON" }, 400); }
  const d = nutzlastLesen(roh);
  /* Andere Vapi-Nachrichten (Statusmeldungen, Gesprächsende) haben
     keinen Werkzeugaufruf — still quittieren. */
  if (!d.aufrufe.length) return antwort({ ok: true });

  const results = [];
  for (const a of d.aufrufe) {
    let result = "Das kann ich hier nicht.";
    if (!d.gerufen && !d.nummerId) {
      result = "Ich kann gerade nicht zuordnen, welches Restaurant Sie angerufen haben. Bitte rufen Sie direkt an.";
    } else {
      const auftrag = rpcFuer(a, d);
      if (auftrag) {
        const erg = await rpc(auftrag.fn, auftrag.koerper);
        result = erg === null ? "Das hat gerade nicht geklappt. Bitte versuchen Sie es in einem Moment noch einmal."
                              : ergebnisText(auftrag.fn, erg);
      }
    }
    results.push({ toolCallId: a.id, result });
  }
  return antwort({ results });
}

Deno.serve(bearbeiten);
