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

const SPRACHEN = ["en","tr","ru","fr","es","it","pl","ar","uk","nl","ro"] as const;

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
      "Access-Control-Allow-Headers": "authorization, content-type, apikey",
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

Deno.serve(async (anfrage: Request) => {
  if (anfrage.method === "OPTIONS") return antwort({}, 200);
  if (anfrage.method !== "POST") return antwort({ fehler: "nur POST" }, 405);

  const schluessel = Deno.env.get("ANTHROPIC_API_KEY");
  if (!schluessel) {
    /* Kein Schluessel heisst NICHT "kaputt", sondern "diese Funktion
       ist noch nicht eingerichtet". Das Board darf davon nichts
       merken ausser dem Hinweis, dass nicht uebersetzt wurde. */
    return antwort({ fehler: "kein_schluessel", uebersetzt: {} }, 200);
  }

  let texte: string[] = [];
  try {
    const roh = await anfrage.json();
    texte = Array.isArray(roh?.texte) ? roh.texte : [];
  } catch {
    return antwort({ fehler: "kein_json", uebersetzt: {} }, 400);
  }

  /* Doppelte raus, Leeres raus, deckeln. Ein Satz, der bei acht
     Gerichten steht, wird sonst achtmal uebersetzt — und beim
     neunten anders. */
  texte = [...new Set(texte.map((t) => String(t ?? "").trim()).filter(Boolean))]
    .slice(0, HOECHSTENS);
  if (!texte.length) return antwort({ uebersetzt: {} }, 200);

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

  /* Das Ergebnis wird ZUSAMMENGETRAGEN, nicht in einem Zug
     abgenommen. Was schon da ist, bleibt; ein zweiter Anlauf fuellt
     nur noch die Luecken. */
  const fertig: Record<string, Record<string, string>> = {};

  /* Ein Anlauf. Liefert zurueck, was nicht vollstaendig wurde. */
  async function anlauf(
    auftrag: string[],
    nurSprachen: readonly string[],
  ): Promise<{ fehler?: string; kategorie?: string }> {
    const ergebnis = await claude.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: ANWEISUNG,
      thinking: { type: "adaptive" },
      /* Opus 5 kann eine Anfrage aus Sicherheitsgruenden ablehnen.
         fallbacks:"default" laesst sie serverseitig auf einem
         anderen Modell laufen, statt uns die Ablehnung
         zurueckzugeben — nach Ablehnungsgrund geroutet, also ohne
         dass hier ein Modell festgenagelt wird, das irgendwann
         abgekuendigt ist. */
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [werkzeugFuer(nurSprachen) as never],
      tool_choice: { type: "tool", name: "uebersetzt" },
      messages: [{
        role: "user",
        content: (nurSprachen.length === SPRACHEN.length
          ? "Uebersetze diese Texte:\n\n"
          : "Uebersetze diese Texte, aber NUR in diese Sprachen: " +
            nurSprachen.join(", ") + ".\n\n") +
          auftrag.map((t, i) => (i + 1) + ". " + t).join("\n"),
      }],
    } as never);

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
    });
  } catch (e) {
    /* Fail-open (CLAUDE.md 7). Der Wirt speichert sein Gericht auch
       dann, wenn der Uebersetzer nicht antwortet — ein Gericht, das
       sich nicht speichern laesst, kostet Umsatz; eine fehlende
       Uebersetzung kostet einen zweiten Anlauf. */
    return antwort({ fehler: String((e as Error)?.message ?? e), uebersetzt: {} }, 200);
  }
});
