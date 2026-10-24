/* ═══════════════════════════════════════════════════════════════════
   GERICHT-BILD · Aus einem Handyfoto ein Profi-Foto und einen Freisteller
   ═══════════════════════════════════════════════════════════════════

   Ausrollen:
     supabase functions deploy gericht-bild
     supabase secrets set FAL_KEY=...

   MIT JWT-Prüfung: gerufen wird nur aus dem Board, dort ist immer
   jemand angemeldet. Ohne Prüfung könnte jeder Fremde unser
   Bild-Guthaben verbrauchen.

   WAS SIE TUT
   ───────────
   Zwei Aufträge an fal.ai, parallel, beide auf DASSELBE Foto:
     1. BiRefNet v2      stellt das Gericht frei (transparentes PNG) —
                         die „Pop-Ansicht“ im Hub.
     2. Bria Product Shot setzt das Gericht in ein Studiofoto:
                         neuer Hintergrund, Licht, Schatten. Mit
                         placement_type "original" bleibt das Gericht
                         an seiner Stelle und in seiner Größe.
   Beide malen das Gericht NICHT neu. Das ist der Grund für diese Wahl:
   „1:1 ohne Abweichungen“ geht nur, wenn die Pixel des Gerichts
   erhalten bleiben. Ein Bildgenerator, der den Teller neu zeichnet,
   liefert schönere Bilder und eine andere Portion — beim Essen ist
   das Irreführung.

   WARUM KEIN SERVICE-SCHLÜSSEL
   ────────────────────────────
   Die Funktion arbeitet mit dem Token des Aufrufers. Ob er zum Betrieb
   gehört, ob er hochladen darf, wie viele Aufträge es schon gab — das
   entscheidet RLS, genau wie im Board. Ein Service-Schlüssel hier wäre
   eine zweite, weitere Tür neben der ersten (CLAUDE.md §2.3a).

   NICHT GEGEN DIE ECHTE API GETESTET. Die Arbeitsumgebung erreicht
   fal.ai nicht (Netz gesperrt) und hat keinen Schlüssel. Die Form der
   Aufrufe folgt der Dokumentation von fal; der erste echte Lauf ist
   deiner. Darum fällt alles fail-open aus: Geht etwas schief, bleibt
   das Originalfoto, und der Betrieb liest, was fehlt.
   ═══════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

/* Die EINE Stelle, die über den Tarif entscheidet. Dieselben Werte
   stehen als CHECK auf betriebe.plan (migration-bild-ki.sql). null =
   noch keinem Tarif zugeordnet = Bestandskunde = frei (CLAUDE.md §7:
   lieber ein Bild zu viel als ein zahlender Kunde, der gesperrt ist). */
const PLAENE_BILD_KI = ["assistent", "alessia"];
const GRENZE_MONAT = 200;
const WARTEN_MS = 90_000;

/* Die Szene für das Profi-Foto. Bewusst schlicht: hell, neutral,
   weiches Licht. Eine „Szene“ mit Holztisch und Kräutern wäre
   hübscher — und würde Dinge zeigen, die nicht auf dem Teller liegen. */
const SZENE =
  "professional food photography, clean light neutral studio backdrop, " +
  "soft natural daylight from the side, gentle realistic shadow under the plate, " +
  "no extra food, no props, no garnish added";

type Fehler = "ungueltig" | "quelle" | "zugriff" | "tarif" | "grenze" | "budget" |
              "kein_schluessel" | "anbieter" | "speichern";

/* Die zwei fal-Modelle, wie sie in ki_preise (migration-ki-nutzung.sql)
   stehen. Je erfolgreichem Bild eine Buchung — fal berechnet nach Bild,
   nicht nach Token. */
const MODELL_FREI = "fal-ai/birefnet/v2";
const MODELL_PROFI = "fal-ai/bria/product-shot";

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
const fehler = (f: Fehler, mehr?: Record<string, unknown>) => antwort({ fehler: f, ...(mehr ?? {}) });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Ein Aufruf an fal, synchron, mit Frist. */
async function fal(modell: string, eingabe: Record<string, unknown>, schluessel: string): Promise<unknown> {
  const halt = new AbortController();
  const uhr = setTimeout(() => halt.abort(), WARTEN_MS);
  try {
    const r = await fetch("https://fal.run/" + modell, {
      method: "POST",
      headers: { "Authorization": "Key " + schluessel, "Content-Type": "application/json" },
      body: JSON.stringify(eingabe),
      signal: halt.signal,
    });
    if (!r.ok) throw new Error(modell + " antwortet " + r.status);
    return await r.json();
  } finally {
    clearTimeout(uhr);
  }
}

/* Das Ergebnis liegt bei fal nur vorübergehend. Es wird abgeholt und
   in den eigenen Speicher gelegt — unter dem Ordner des Betriebs, mit
   dem Token des Aufrufers (RLS „bilder team laedt hoch“). */
async function ablegen(
  db: ReturnType<typeof createClient>, adresse: string, betrieb: string, endung: "jpg" | "png",
): Promise<string> {
  const r = await fetch(adresse);
  if (!r.ok) throw new Error("abholen " + r.status);
  const daten = new Uint8Array(await r.arrayBuffer());
  const pfad = betrieb + "/" + Date.now() + "-" + (endung === "png" ? "frei" : "profi") + "." + endung;
  const { error } = await db.storage.from("gerichte").upload(pfad, daten, {
    contentType: endung === "png" ? "image/png" : "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return db.storage.from("gerichte").getPublicUrl(pfad).data.publicUrl as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return antwort({ ok: true });

  let eingabe: { betrieb_id?: unknown; quelle?: unknown; gericht?: unknown };
  try { eingabe = await req.json(); } catch { return fehler("ungueltig"); }
  const betrieb = String(eingabe.betrieb_id ?? "");
  const quelle = String(eingabe.quelle ?? "");
  const gericht = String(eingabe.gericht ?? "").slice(0, 120) || null;
  if (!UUID.test(betrieb) || !quelle) return fehler("ungueltig");

  const basis = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const db = createClient(basis, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });

  /* Nur Fotos aus dem EIGENEN Ordner. Sonst schickte jemand eine
     beliebige Adresse durch unser Guthaben. */
  const ordner = basis + "/storage/v1/object/public/gerichte/" + betrieb + "/";
  if (!quelle.startsWith(ordner) || quelle.includes("..")) return fehler("quelle");

  /* Ein angemeldeter Mensch, nicht der öffentliche anon-Schlüssel, der
     in jedem Hub steht. Gemessen: anon scheitert heute schon an der
     Spalte plan — aber nur, weil ihm genau dieses eine Spaltenrecht
     fehlt. Eine Tür, die an einem vergessenen grant hängt, ist keine. */
  const { data: wer } = await db.auth.getUser();
  if (!wer?.user) return fehler("zugriff");

  /* Gehört der Aufrufer zum Betrieb? RLS liefert die Zeile nur dann. */
  const { data: haus } = await db.from("betriebe").select("id, plan").eq("id", betrieb).maybeSingle();
  if (!haus) return fehler("zugriff");
  const plan = (haus as { plan: string | null }).plan;
  if (plan !== null && !PLAENE_BILD_KI.includes(plan)) return fehler("tarif", { plan });

  const schluessel = Deno.env.get("FAL_KEY") ?? "";
  if (!schluessel) return fehler("kein_schluessel");

  /* Monatsbudget in Euro: nur ein HARTES, erreichtes Budget weist ab;
     Fehler/fehlende Funktion lassen durch (fail-open, §7). */
  const { data: budget, error: budgetFehler } = await db.rpc("ki_budget_stand", { p_betrieb: betrieb });
  if (!budgetFehler && budget && budget.hart === true && budget.ueber === true) return fehler("budget");

  const monatsanfang = new Date();
  monatsanfang.setUTCDate(1); monatsanfang.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from("bild_auftraege")
    .select("id", { count: "exact", head: true })
    .eq("betrieb_id", betrieb).gte("erstellt_am", monatsanfang.toISOString());
  if ((count ?? 0) >= GRENZE_MONAT) return fehler("grenze", { grenze: GRENZE_MONAT });

  /* Gezählt wird VOR dem Aufruf: Kosten entstehen bei fal, sobald der
     Auftrag läuft — auch wenn danach etwas schiefgeht. Ohne returning
     (sonst misst man das Leserecht, §2.3b).
     Und dieser Eintrag IST die Tür: RLS lässt ihn nur für Mitglieder des
     Betriebs zu. Scheitert er, geht kein Auftrag an fal hinaus. */
  const { error: nichtGezaehlt } = await db.from("bild_auftraege")
    .insert({ betrieb_id: betrieb, gericht_name: gericht });
  if (nichtGezaehlt) return fehler("zugriff");

  try {
    const [frei, profi] = await Promise.allSettled([
      fal("fal-ai/birefnet/v2", {
        image_url: quelle,
        model: "General Use (Heavy)",
        operating_resolution: "2048x2048",
        refine_foreground: true,
      }, schluessel),
      fal("fal-ai/bria/product-shot", {
        image_url: quelle,
        scene_description: SZENE,
        placement_type: "original",
        optimize_description: false,
        num_results: 1,
        fast: false,
      }, schluessel),
    ]);

    const freiAdresse = frei.status === "fulfilled"
      ? (frei.value as { image?: { url?: string } })?.image?.url : undefined;
    const profiAdresse = profi.status === "fulfilled"
      ? (profi.value as { images?: Array<{ url?: string }> })?.images?.[0]?.url : undefined;
    if (!freiAdresse && !profiAdresse) return fehler("anbieter");

    /* Verbrauch ins Logbuch: je Bild, das fal wirklich geliefert hat. Ein
       Fehler dabei blockiert nie das Foto (fail-open), wird aber gemeldet. */
    const buche = async (modell: string): Promise<boolean> => {
      try {
        const { data, error } = await db.rpc("ki_nutzung_buchen", {
          p_funktion: "bild_profi_frei", p_modell: modell, p_ein: 0, p_aus: 0, p_cache: 0, p_bilder: 1, p_betrieb: betrieb,
        });
        return !error && data?.gebucht === true;
      } catch { return false; }
    };
    const gebuchtFrei  = freiAdresse  ? await buche(MODELL_FREI)  : true;
    const gebuchtProfi = profiAdresse ? await buche(MODELL_PROFI) : true;

    const aus: { frei?: string; profi?: string; teilweise?: boolean } = {};
    try {
      if (freiAdresse) aus.frei = await ablegen(db, freiAdresse, betrieb, "png");
      if (profiAdresse) aus.profi = await ablegen(db, profiAdresse, betrieb, "jpg");
    } catch {
      if (!aus.frei && !aus.profi) return fehler("speichern");
    }
    /* Eines von beiden reicht, um es anzubieten — ehrlich markiert. */
    if (!aus.frei || !aus.profi) aus.teilweise = true;
    return antwort({ ...aus, gebucht: gebuchtFrei && gebuchtProfi });
  } catch {
    return fehler("anbieter");
  }
});
