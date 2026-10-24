/* ═══════════════════════════════════════════════════════════════════
   UEBERSETZEN · Was der Wirt tippt, in elf Sprachen
   ═══════════════════════════════════════════════════════════════════

   Ausrollen:
     supabase functions deploy uebersetzen
     supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

   OHNE --no-verify-jwt, und das ist Absicht. Anders als der
   Vapi-Webhook wird diese Funktion aus dem Admin-Board gerufen, und
   dort ist immer jemand angemeldet. Supabase prueft das Token dann
   selbst, bevor eine Zeile dieses Codes laeuft. Ohne diese Pruefung
   koennte jeder Fremde unser Sprach-Guthaben verbrauchen.

   WARUM ES DIESE FUNKTION GIBT
   ────────────────────────────
   Der Hub uebersetzt ueber ein Woerterbuch, dessen Schluessel der
   deutsche Satz ist. Was im Geruest steht, ist gepflegt; was der Wirt
   im Board eintippt, steht dort nicht und bleibt in allen zwoelf
   Sprachen deutsch. Elf Felder pro Gericht von Hand auszufuellen
   wuerde niemand tun — also tut es die Maschine, und der Wirt sieht
   das Ergebnis und darf es aendern.

   WARUM DER SCHLUESSEL HIER LIEGT UND NICHT IM BROWSER
   ────────────────────────────────────────────────────
   Ein API-Schluessel in einer ausgelieferten Seite ist kein
   Geheimnis, sondern eine Rechnung, die jemand anders bezahlt. Er
   steht ausschliesslich in den Secrets von Supabase und verlaesst
   diese Funktion nie.

   NICHT GEGEN DIE ECHTE API GETESTET. Die Arbeitsumgebung hat keinen
   Anthropic-Schluessel (gemessen: ANTHROPIC_API_KEY leer, kein
   ant-CLI). Die Form des Aufrufs folgt der SDK-Dokumentation; der
   erste echte Lauf ist deiner. Genau deshalb faellt unten alles
   fail-open aus: Geht der Aufruf schief, wird nichts uebersetzt und
   nichts kaputt.
   ═══════════════════════════════════════════════════════════════════ */
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const SPRACHEN = ["en","tr","ru","fr","es","it","pl","ar","uk","nl","ro"] as const;

/* ── Welches Modell uebersetzt ─────────────────────────────────────
   Standard ist, was die Funktion von Anfang an benutzt (Opus 5): ohne
   Secret aendert sich NICHTS, nicht ein Byte der Anfrage. Wer
   guenstiger uebersetzen will, setzt UEBERSETZER_MODELL (Supabase →
   Edge Functions → Secrets) auf einen Namen AUS DIESER LISTE. Ein
   anderer Wert (Tippfehler, ein Name, den es nicht gibt) wird NICHT an
   Anthropic geschickt, sondern faellt auf den Standard zurueck —
   sonst saehe der Wirt statt einer Uebersetzung einen 404.

   Die zwei Schalter je Modell stehen hier, weil sie sich unterscheiden
   (Stand 24.10.2026, aus der Modelluebersicht der SDK-Doku — NICHT
   gegen die echte API gelaufen):
     erzwingen  tool_choice {type:"tool"} ist bei Opus 5.5 und Sonnet 5.5
                ein 400. Dort wird "auto" geschickt und das Werkzeug im
                Auftrag namentlich verlangt; strict:true haelt die
                Argumente schemagenau. Haiku 5.5 ist nicht als
                "erzwingen" belegt und laeuft darum ebenfalls ueber auto.
     ersatz     Der serverseitige Ersatz bei Ablehnung (fallbacks:"default")
                ist fuer Haiku 5.5 nicht vorgesehen. */
const STANDARD_MODELL = "claude-opus-5";
const MODELLE: Record<string, { erzwingen: boolean; ersatz: boolean }> = {
  "claude-opus-5":     { erzwingen: true,  ersatz: true },
  "claude-opus-5-5":   { erzwingen: false, ersatz: true },
  "claude-sonnet-5-5": { erzwingen: false, ersatz: true },
  "claude-haiku-5-5":  { erzwingen: false, ersatz: false },
};
function modellWaehlen(): string {
  const wunsch = (Deno.env.get("UEBERSETZER_MODELL") ?? "").trim();
  return Object.prototype.hasOwnProperty.call(MODELLE, wunsch) ? wunsch : STANDARD_MODELL;
}

/* Wie viele Saetze auf einmal. Nicht willkuerlich: 25 Saetze x 11
   Sprachen x ~80 Zeichen sind rund 8 000 Token Antwort und passen
   sicher unter max_tokens. Mehr waere ein Aufruf, der mitten im Satz
   abbricht — und das faellt beim Lesen niemandem auf. */
const HOECHSTENS = 25;

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

/* Das Glossar ist der eigentliche Wert dieser Funktion.
   Eine allgemeine Uebersetzung macht aus "Bounty" ein "Kopfgeld" —
   genau das steht heute in der Karte, und der Gast liest es. */
const ANWEISUNG = `Du uebersetzt kurze Texte einer gastronomischen Speisekarte aus dem Deutschen.

Zielsprachen (Kuerzel genau so verwenden):
en Englisch · tr Tuerkisch · ru Russisch · fr Franzoesisch · es Spanisch
it Italienisch · pl Polnisch · ar Arabisch · uk Ukrainisch · nl Niederlaendisch
ro Rumaenisch

REGELN

1. ANREDE: Der Hub siezt. Franzoesisch "vous", Spanisch "usted",
   Italienisch "Lei", Polnisch die Panstwa-Form, Russisch/Ukrainisch
   "вы/ви", Niederlaendisch "u", Rumaenisch "dumneavoastra",
   Tuerkisch die -siniz-Form. Niemals duzen, auch nicht teilweise.
   Reine Beschriftungen ohne Ansprache bleiben unpersoenlich
   (deutsch "Milch waehlen" -> italienisch "Scegliere il latte",
   nicht "Scelga il latte") — ein Knopf spricht niemanden an.

2. EIGENNAMEN UND MARKEN BLEIBEN STEHEN. Nutella, Oreo, KitKat,
   Bounty, Lotus, Kinder Bueno, Coca Cola, Instagram, Ferrero.
   "Bounty" ist ein Schokoriegel und niemals "Kopfgeld".

3. GLOSSAR — diese Woerter immer so:
   Ashta        = die arabische Sahne. In jeder Sprache "Ashta"
                  (ru/uk "ашта", ar "قشطة"). Wo der deutsche Text
                  "arabische Sahne" sagt, ist Ashta gemeint.
   Kadayif      = Engelshaar-Teig. Bleibt "Kadayif" (ar "كنافة").
   Manakish     = arabisches Fladenbrot. Bleibt "Manakish".
   Za'atar      = Thymian-Mischung. Bleibt "Za'atar".
   Sucuk        = tuerkische Wurst. Bleibt "Sucuk".
   Lahmacun     = bleibt "Lahmacun".
   Karamellkeks = der karamellisierte Keks (Lotus/Biscoff-Art), in
                  jeder Sprache das dortige Wort dafuer, nicht der
                  Markenname.
   Milchreis    = das jeweilige Landesgericht (fr "riz au lait",
                  es "arroz con leche", it "riso al latte",
                  pl "ryz na mleku", nl "rijstpap",
                  ro "orez cu lapte", ru "молочный рис").
   Crepe/Waffel = das uebliche Wort der Zielsprache.

4. TON: kurz, appetitlich, kein Werbedeutsch. Ein Beschreibungstext
   bleibt ein Beschreibungstext und wird nicht laenger als das
   Original es hergibt.

5. PLATZHALTER wie {n}, {d}, {x} bleiben unveraendert stehen und
   muessen in jeder Sprache vorkommen.

6. ARABISCH mit arabischen Satzzeichen (، ؟), nicht mit deutschen.

7. Ist ein Text bereits ein reiner Eigenname ohne uebersetzbaren
   Anteil ("Dubai Crepe"), gib ihn unveraendert in allen Sprachen
   zurueck. Nichts erfinden.`;

/* Anthropic-Fehler in einen Grund, den das Board in Klartext kennt.
   VORFALL 26.09.: Das Board zeigte „Der Übersetzer meldet: 401
   {"type":"error",…"invalid x-api-key"}" — richtig, aber kein Wirt
   weiss, was er damit tun soll. */
function grundAus(e: unknown): string {
  const status = (e as { status?: number })?.status;
  const text = String((e as Error)?.message ?? e);
  if (status === 401 || /invalid x-api-key|authentication_error/i.test(text)) return "schluessel_ungueltig";
  if (status === 403 || /permission_error/i.test(text)) return "schluessel_ohne_recht";
  if (/credit balance/i.test(text)) return "guthaben_leer";
  if (status === 429) return "zu_viele";
  if (status === 529 || /overloaded/i.test(text)) return "ueberlastet";
  return text.slice(0, 300);
}

/* ── Wo liegt der Schluessel, und wenn nicht: was liegt dort? ──────
   VORFALL 26.09., 16:53: Das Board meldete „schluessel_form“ — unter
   ANTHROPIC_API_KEY stand etwas, das nicht mit sk-ant- beginnt. Den
   Wert kann niemand auslesen, auch nicht der Betreiber im Dashboard.
   Also sucht die Funktion selbst:
   1. einen echten API-Schluessel im richtigen Eintrag, auch mit
      Beiwerk („ANTHROPIC_API_KEY=sk-ant-…“, Anfuehrungszeichen,
      „Bearer “, Zeilenumbruch);
   2. denselben in JEDEM anderen Eintrag — wer ihn als CLAUDE_API_KEY
      angelegt hat, soll nicht daran scheitern;
   3. sonst eine ART, die sagt, was stattdessen dort steht. Nie ein
      Zeichen des Wertes: nur Kategorie, Laenge und die NAMEN
      verwandter Eintraege. */
const API_MUSTER = /sk-ant-api\d{2}-[A-Za-z0-9_-]{20,}/;
function schluesselSuchen(): { schluessel: string; art: string; laenge: number; namen: string[] } {
  const roh = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  let alle: Record<string, string> = {};
  try { alle = Deno.env.toObject(); } catch { /* ohne Leserecht: nur der eine Eintrag */ }
  const namen = Object.keys(alle)
    .filter((n) => /ANTHROP|CLAUDE/i.test(n) && n !== "ANTHROPIC_API_KEY").sort();

  const hier = roh.match(API_MUSTER);
  if (hier) return { schluessel: hier[0], art: "ok", laenge: hier[0].length, namen };
  for (const n of Object.keys(alle).sort()) {
    const t = (alle[n] ?? "").match(API_MUSTER);
    if (t) return { schluessel: t[0], art: "anderer_name", laenge: t[0].length, namen };
  }

  const v = roh.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/^Bearer\s+/i, "")
    .replace(/^ANTHROPIC_API_KEY\s*[=:]\s*/i, "").trim();
  const art =
    !v                                   ? "leer" :
    /^sk-ant-oat/i.test(v)               ? "abo_token" :
    /^sk-ant-admin/i.test(v)             ? "admin_schluessel" :
    /^sk-ant-/i.test(v)                  ? "ok" :          /* kuenftige Form: versuchen */
    /^sk-/i.test(v)                      ? "anderer_anbieter" :
    /^[A-Z][A-Z0-9_]{2,}$/.test(v)       ? "name_statt_wert" :
    /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v) ? "kennung_statt_schluessel" :
    /^https?:\/\//i.test(v)              ? "adresse" :
    /^(apikey_|key_)/i.test(v)           ? "kennung_statt_schluessel" :
    v.length < 40                        ? "zu_kurz" : "unbekannt";
  return { schluessel: art === "ok" ? v : "", art, laenge: v.length, namen };
}

/* Die kostenlose Modellliste als Beweis, dass der Schluessel gilt.
   Fuenf Minuten gemerkt: Die Diagnose unten ist ohne Anmeldung
   erreichbar und soll Anthropic nicht mit jedem Aufruf fragen. */
let gueltigGemerkt: { wert: string; bis: number } | null = null;
async function schluesselGilt(schluessel: string): Promise<string> {
  if (gueltigGemerkt && gueltigGemerkt.bis > Date.now()) return gueltigGemerkt.wert;
  let wert = "ok";
  try { await new Anthropic({ apiKey: schluessel }).models.list({ limit: 1 }); }
  catch (e) { wert = grundAus(e); }
  gueltigGemerkt = { wert, bis: Date.now() + 5 * 60 * 1000 };
  return wert;
}

Deno.serve(async (anfrage: Request) => {
  if (anfrage.method === "OPTIONS") return antwort({}, 200);
  if (anfrage.method !== "POST") return antwort({ fehler: "nur POST" }, 405);

  let roh: { texte?: unknown; probe?: unknown; diagnose?: unknown } = {};
  try {
    roh = await anfrage.json();
  } catch {
    return antwort({ fehler: "kein_json", uebersetzt: {} }, 400);
  }

  /* Diagnose ohne Anmeldung: sagt nur, OB und in welcher FORM ein
     Schluessel eingerichtet ist und ob Anthropic ihn annimmt — nie
     den Wert, nie ein Zeichen daraus. Damit laesst sich die
     Einrichtung pruefen, ohne sich ins Board einzuloggen, und es
     kostet nichts. Wer den anon-Schluessel hat, erfaehrt hoechstens,
     ob der Uebersetzer laeuft. */
  if (roh?.diagnose === true) {
    const s = schluesselSuchen();
    return antwort({
      diagnose: true, art: s.art, laenge: s.laenge, andere_namen: s.namen,
      anthropic: s.schluessel ? await schluesselGilt(s.schluessel) : "nicht_gefragt",
    }, 200);
  }

  /* Nur wer im Board angemeldet ist und einen Betrieb hat, darf das
     Guthaben verbrauchen. VORHER: jeder mit dem oeffentlichen
     anon-Schluessel (steht in jedem Hub) haette beliebig viel
     uebersetzen lassen koennen — auf Rechnung des Betreibers.
     meine_betriebe() haengt an pin_ok(): ohne zweiten Faktor leer. */
  const alsNutzer = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: anfrage.headers.get("authorization") ?? "" } } },
  );
  const [{ data: betriebe }, { data: master }] = await Promise.all([
    alsNutzer.rpc("meine_betriebe"),
    alsNutzer.rpc("ist_master"),
  ]);
  if (!(Array.isArray(betriebe) && betriebe.length) && master !== true) {
    /* 200 statt 403: supabase-js macht aus jedem Nicht-2xx eine
       Ausnahme ohne Inhalt — das Board sähe den Grund nie. */
    return antwort({ fehler: "kein_zugriff", uebersetzt: {} }, 200);
  }

  /* Den Schluessel so nehmen, wie Menschen ihn einfuegen: mit
     Leerzeichen, Zeilenumbruch, Anfuehrungszeichen oder „Bearer "
     davor. Jedes davon ergibt bei Anthropic „invalid x-api-key". */
  const gefunden = schluesselSuchen();
  const schluessel = gefunden.schluessel;
  if (!schluessel && gefunden.art !== "leer") {
    return antwort({ fehler: "schluessel_form", art: gefunden.art, laenge: gefunden.laenge,
                     andere_namen: gefunden.namen, uebersetzt: {} }, 200);
  }
  if (!schluessel) {
    /* Kein Schluessel heisst NICHT "kaputt", sondern "diese Funktion
       ist noch nicht eingerichtet". Das Board darf davon nichts
       merken ausser dem Hinweis, dass nicht uebersetzt wurde. */
    return antwort({ fehler: "kein_schluessel", uebersetzt: {} }, 200);
  }

  let texte: string[] = Array.isArray(roh?.texte) ? roh.texte as string[] : [];
  const probe = roh?.probe === true;

  /* Probe ohne Kosten: Die Modellliste kostet nichts, verlangt aber
     einen gueltigen Schluessel. Damit sagt das Board „Schluessel
     ungueltig", bevor der Wirt ein Gericht speichert. */
  if (probe) {
    try {
      await new Anthropic({ apiKey: schluessel }).models.list({ limit: 1 });
      return antwort({ probe: "ok", uebersetzt: {} }, 200);
    } catch (e) {
      return antwort({ probe: "fehler", fehler: grundAus(e), uebersetzt: {} }, 200);
    }
  }

  /* Doppelte raus, Leeres raus, deckeln. Ein Satz, der bei acht
     Gerichten steht, wird sonst achtmal uebersetzt — und beim
     neunten anders. */
  texte = [...new Set(texte.map((t) => String(t ?? "").trim()).filter(Boolean))]
    .slice(0, HOECHSTENS);
  if (!texte.length) return antwort({ uebersetzt: {} }, 200);

  /* Monatsbudget in Euro (migration-ki-nutzung.sql) — VOR dem Kontingent,
     damit eine Absage kein Kontingent verbraucht. Nur ein HARTES und
     erreichtes Budget weist ab; Fehler/fehlende Funktion lassen durch
     (fail-open, CLAUDE.md §7: der Wirt speichert sein Gericht trotzdem). */
  const { data: budget, error: budgetFehler } = await alsNutzer.rpc("ki_budget_stand");
  if (!budgetFehler && budget && budget.hart === true && budget.ueber === true) {
    return antwort({ fehler: "budget", uebersetzt: {} }, 200);
  }

  /* Tageskontingent je Betrieb (migration-ki-kontingent.sql), gezählt
     VOR dem Aufruf — wie bei gericht-bild. Vorher konnte jeder, der
     sich über konto.html registriert und einen Betrieb anlegt, in
     Schleife übersetzen lassen: auf Rechnung des Betreibers. Fehlt die
     Funktion noch (42883 bzw. PGRST202), läuft es wie bisher ohne Deckel
     weiter. */
  const { data: rest, error: kontoFehler } = await alsNutzer.rpc("ki_kontingent_nehmen", { p_anzahl: texte.length });
  if (kontoFehler && kontoFehler.code !== "42883" && kontoFehler.code !== "PGRST202") {
    return antwort({ fehler: "kein_zugriff", uebersetzt: {} }, 200);
  }
  if (!kontoFehler && typeof rest === "number" && rest < 0) {
    return antwort({ fehler: "kontingent", uebersetzt: {} }, 200);
  }

  /* Das Werkzeug wird auf die GEFRAGTEN Sprachen zugeschnitten. Beim
     zweiten Anlauf sind das nur noch die fehlenden — ein Schema, das
     dann weiter alle elf verlangt, wuerde das Modell zwingen, die
     schon fertigen neu zu erfinden. Anders und schlechter. */
  const werkzeugFuer = (sprachen: readonly string[]) => {
    const eigenschaften: Record<string, unknown> = {};
    for (const sp of sprachen) eigenschaften[sp] = { type: "string" };
    return {
      name: "uebersetzt",
      description: "Die fertigen Uebersetzungen zurueckgeben.",
      /* strict erzwingt, dass die Argumente genau zum Schema passen —
         ohne das kommt frueher oder spaeter eine Sprache zu wenig
         zurueck, und der Gast liest wieder Deutsch.

         Es ist trotzdem KEINE Garantie: Genau deshalb gibt es unten
         den zweiten Anlauf und die Liste der Luecken. Wer sich auf
         strict allein verlaesst, baut wieder Alles-oder-nichts. */
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["saetze"],
        properties: {
          saetze: {
            type: "array",
            description: "Ein Eintrag je vorgelegtem deutschen Satz, in derselben Reihenfolge.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["deutsch", ...sprachen],
              properties: { deutsch: { type: "string" }, ...eigenschaften },
            },
          },
        },
      },
    };
  };

  const claude = new Anthropic({ apiKey: schluessel });
  const bekannt = new Set(texte);
  const modell = modellWaehlen();
  const eigenschaftenModell = MODELLE[modell];

  /* Was Anthropic berechnet hat, ueber alle Anlaeufe. Gebucht wird am
     Ende (ein Eintrag je Aufruf), auch wenn ein Anlauf mittendrin
     scheitert — Kosten entstehen, sobald die Anfrage lief. */
  const verbrauch = { ein: 0, aus: 0, cache: 0 };
  const buchen = async (): Promise<boolean | null> => {
    /* Nichts verbraucht (kein Anlauf kam bis zu einer Antwort): nichts zu buchen → null. */
    if (!verbrauch.ein && !verbrauch.aus && !verbrauch.cache) return null;
    try {
      const { data, error } = await alsNutzer.rpc("ki_nutzung_buchen", {
        p_funktion: "uebersetzen", p_modell: modell,
        p_ein: Math.min(verbrauch.ein, 400000), p_aus: Math.min(verbrauch.aus, 64000), p_cache: Math.min(verbrauch.cache, 400000),
      });
      return !error && data?.gebucht === true;
    } catch { return false; }
  };

  /* Das Ergebnis wird ZUSAMMENGETRAGEN, nicht in einem Zug
     abgenommen. Was schon da ist, bleibt; ein zweiter Anlauf fuellt
     nur noch die Luecken. */
  const fertig: Record<string, Record<string, string>> = {};

  /* Ein Anlauf. Liefert zurueck, was nicht vollstaendig wurde. */
  async function anlauf(
    auftrag: string[],
    nurSprachen: readonly string[],
  ): Promise<{ fehler?: string; kategorie?: string }> {
    const nurDeutsch = nurSprachen.length === SPRACHEN.length
      ? "Uebersetze diese Texte:\n\n"
      : "Uebersetze diese Texte, aber NUR in diese Sprachen: " + nurSprachen.join(", ") + ".\n\n";
    const ergebnis = await claude.beta.messages.create({
      model: modell,
      max_tokens: 16000,
      system: ANWEISUNG,
      thinking: { type: "adaptive" },
      /* Opus 5 kann eine Anfrage aus Sicherheitsgruenden ablehnen.
         fallbacks:"default" laesst sie serverseitig auf einem
         anderen Modell laufen, statt uns die Ablehnung
         zurueckzugeben — nach Ablehnungsgrund geroutet, also ohne
         dass hier ein Modell festgenagelt wird, das irgendwann
         abgekuendigt ist. Nicht bei jedem Modell vorgesehen (MODELLE). */
      ...(eigenschaftenModell.ersatz ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
      tools: [werkzeugFuer(nurSprachen) as never],
      /* Bei Modellen, die ein erzwungenes Werkzeug ablehnen (MODELLE),
         "auto" + ausdrueckliche Aufforderung im Auftrag. */
      tool_choice: eigenschaftenModell.erzwingen ? { type: "tool", name: "uebersetzt" } : { type: "auto" },
      messages: [{
        role: "user",
        content: (eigenschaftenModell.erzwingen ? "" : "Antworte ausschliesslich, indem du das Werkzeug \"uebersetzt\" aufrufst.\n\n") +
          nurDeutsch + auftrag.map((t, i) => (i + 1) + ". " + t).join("\n"),
      }],
    } as never);

    /* Verbrauch zaehlen, BEVOR irgendetwas ausgewertet wird: Auch eine
       Ablehnung oder eine unbrauchbare Antwort hat Token gekostet. */
    const u = (ergebnis as { usage?: { input_tokens?: number; output_tokens?: number;
      cache_read_input_tokens?: number; cache_creation_input_tokens?: number } }).usage;
    verbrauch.ein   += Math.max(0, Math.floor(Number(u?.input_tokens ?? 0))) + Math.max(0, Math.floor(Number(u?.cache_creation_input_tokens ?? 0)));
    verbrauch.aus   += Math.max(0, Math.floor(Number(u?.output_tokens ?? 0)));
    verbrauch.cache += Math.max(0, Math.floor(Number(u?.cache_read_input_tokens ?? 0)));

    /* ZUERST stop_reason, DANN content. Bei einer Ablehnung steht in
       content nichts Brauchbares, und "keine_antwort" waere eine
       Falschauskunft: Der Wirt wuerde die Verbindung pruefen, wo das
       Modell abgelehnt hat. */
    if (ergebnis.stop_reason === "refusal") {
      return {
        fehler: "abgelehnt",
        kategorie: String(
          (ergebnis as { stop_details?: { category?: string } })
            .stop_details?.category ?? "",
        ),
      };
    }

    const block = ergebnis.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return { fehler: "keine_antwort" };
    const roh = (block.input as { saetze?: Array<Record<string, string>> })?.saetze ?? [];

    /* Nach dem DEUTSCHEN Satz einsortieren, nicht nach der Position.
       Eine Antwort in anderer Reihenfolge waere sonst still eine
       Uebersetzung am falschen Gericht — und das faellt erst dem Gast
       auf. Was nicht zu einem vorgelegten Satz passt, fliegt raus. */
    for (const zeile of roh) {
      const de = String(zeile?.deutsch ?? "").trim();
      if (!bekannt.has(de)) continue;
      const eintrag = fertig[de] ?? (fertig[de] = {});
      for (const sp of nurSprachen) {
        const v = String(zeile?.[sp] ?? "").trim();
        if (v) eintrag[sp] = v;
      }
    }
    return {};
  }

  /* Welche Sprachen fehlen einem Satz noch? */
  const luecken = (de: string) =>
    SPRACHEN.filter((sp) => !(fertig[de] ?? {})[sp]);

  try {
    const erster = await anlauf(texte, SPRACHEN);
    if (erster.fehler && !Object.keys(fertig).length) {
      return antwort({
        fehler: erster.fehler,
        kategorie: erster.kategorie,
        uebersetzt: {},
        gebucht: await buchen(),
      }, 200);
    }

    /* ═══ TEILERGEBNISSE ANNEHMEN ═══════════════════════════════
       VORFALL, und es war die eigentliche Ursache der Beschwerde.
       Hier stand:

         if (Object.keys(eintrag).length === SPRACHEN.length)
             fertig[de] = eintrag;

       Alles oder nichts: Fehlte EINE der elf Sprachen, flog der
       ganze Satz raus. Der Wirt sah danach elf leere Felder und
       musste glauben, der Uebersetzer sei kaputt — obwohl zehn
       Sprachen fertig dalagen und weggeworfen wurden.

       Jetzt bleibt, was da ist, und es gibt EINEN zweiten Anlauf,
       der ausschliesslich die fehlenden Sprachen holt. Genau einen:
       Ein Wiederholen bis alles voll ist waere eine Rechnung ohne
       Deckel, und beim dritten Versuch fehlt dieselbe Sprache aus
       demselben Grund.                                            */
    const nachzuholen = texte.filter((t) => luecken(t).length);
    let zweiterFehler: string | undefined;
    if (nachzuholen.length) {
      /* Die Vereinigung aller Luecken — ein Aufruf statt einer je
         Satz. */
      const fehlendeSprachen = [...new Set(nachzuholen.flatMap(luecken))];
      const zweiter = await anlauf(nachzuholen, fehlendeSprachen);
      zweiterFehler = zweiter.fehler;
    }

    /* Was jetzt noch fehlt, wird BENANNT statt verschwiegen. Der
       Wirt kann die zwei Felder selbst tippen — aber nur, wenn er
       weiss, welche. */
    const unvollstaendig: Record<string, string[]> = {};
    for (const t of texte) {
      const l = luecken(t);
      if (l.length && l.length < SPRACHEN.length) unvollstaendig[t] = l;
    }

    return antwort({
      uebersetzt: fertig,
      vorgelegt: texte.length,
      fertig: texte.filter((t) => !luecken(t).length).length,
      teilweise: unvollstaendig,
      nachgeholt: nachzuholen.length,
      fehler: zweiterFehler,
      /* false = der Verbrauch ging NICHT ins Logbuch (Migration fehlt oder
         Buchung abgewiesen) — die Uebersetzung selbst ist davon unberuehrt. */
      gebucht: await buchen(),
    });
  } catch (e) {
    /* Fail-open (CLAUDE.md 7). Der Wirt speichert sein Gericht auch
       dann, wenn der Uebersetzer nicht antwortet — ein Gericht, das
       sich nicht speichern laesst, kostet Umsatz; eine fehlende
       Uebersetzung kostet einen zweiten Anlauf. */
    return antwort({ fehler: grundAus(e), uebersetzt: {}, gebucht: await buchen() }, 200);
  }
});
