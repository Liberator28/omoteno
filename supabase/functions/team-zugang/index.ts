/* ═══════════════════════════════════════════════════════════════════
   TEAM-ZUGANG · Der Besitzer lädt sein Team selbst ein
   ═══════════════════════════════════════════════════════════════════

   Ausrollen (MIT Token-Prüfung):
     supabase functions deploy team-zugang

   Wunsch zweiter Tag: „ein Mitarbeiter-Konto und ein Besitzer-Konto“,
   entschieden: eigener Zugang je Person. Bisher konnte nur die Zentrale
   Konten anlegen (master-zugang), und konto.html riet dem Besitzer,
   seine eigenen Zugangsdaten weiterzugeben.

   Gebaut wie master-zugang: Die erste Frage an die Datenbank geht MIT
   DEM TOKEN DES AUFRUFERS — team_einladung_zaehlen() bzw. ist_inhaber()
   (migration-team.sql, migration-rollen.sql; beide hängen an der PIN).
   Erst danach wird der Dienstschlüssel angefasst.

   aktion:
     einladen   E-Mail, Rolle (team|kueche|inhaber), Anzeigename →
                Einladungsmail (Rücksprung ins Board bzw. die Küche).
                Kommt keine Mail heraus (kein eigener Mailversand
                eingerichtet), gibt es EINMAL den Link zurück, den der
                Besitzer selbst weitergibt. Gibt es die Adresse schon,
                nur die Mitgliedschaft — das Konto sieht den Betrieb beim
                nächsten Anmelden.
     aendern    Rolle, Anzeigename, Gutschein-Recht und -Grenzen.
     entfernen  aus diesem Betrieb (das Konto selbst bleibt).

   Nie gegen sich selbst, und nie den letzten Inhaber: Sonst schlösse
   ein Fehlgriff den Betrieb von seinen eigenen Einstellungen aus.
   ═══════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

const ROLLEN = ["inhaber", "team", "kueche"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SEITE = (Deno.env.get("OMOTENO_SEITE") ?? "https://omoteno.de").replace(/\/+$/, "");

const antwort = (koerper: unknown, status = 200) =>
  new Response(JSON.stringify(koerper), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      /* Liste aus @supabase/supabase-js/cors (pruefungen/stand-supabase-cors.mjs). */
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    },
  });
const fehler = (grund: string, mehr?: Record<string, unknown>) => antwort({ ok: false, grund, ...(mehr ?? {}) });

type Anfrage = {
  aktion?: string; betrieb_id?: string; email?: string; rolle?: string; nutzer_id?: string;
  anzeigename?: string; darf_gutscheine?: boolean;
  gutschein_max_betrag?: number; gutschein_max_prozent?: number; gutschein_tag_max?: number;
};

/* Grenzen wie die CHECK-Schranke betrieb_mitglieder_grenzen
   (migration-rollen.sql) — pruef-team.js hält beide gegeneinander. */
const GRENZEN = { betrag: 500, prozent: 100, tag: 100, name: 60 };

/* Number("") ist 0 und Number(true) ist 1 — beides wäre hier eine
   stille Grenze von 0 € bzw. 1 €. Nur echte Zahlen und Zahltext. */
function zahl(w: unknown, max: number): number | null {
  if (typeof w !== "number" && !(typeof w === "string" && /^\d+(\.\d{1,2})?$/.test(w.trim()))) return null;
  const n = Number(w);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return antwort({}, 200);
  if (req.method !== "POST") return antwort({ ok: false, grund: "nur_post" }, 405);

  const basis = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const dienst = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!basis || !anon || !dienst) return fehler("einrichtung");

  let a: Anfrage;
  try { a = await req.json(); } catch { return fehler("kein_json"); }
  const aktion = String(a.aktion ?? "");
  const betrieb = String(a.betrieb_id ?? "");
  if (!UUID.test(betrieb)) return fehler("betrieb");

  const alsNutzer = createClient(basis, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: wer } = await alsNutzer.auth.getUser();
  const ich = wer?.user?.id ?? "";
  if (!ich) return fehler("zugriff");

  /* Erst die Rolle, dann alles andere. Beim Einladen zählt dieselbe
     Frage gleich mit (20 je Betrieb und Tag) — vor jedem Mailversand. */
  if (aktion === "einladen") {
    const { data: z, error } = await alsNutzer.rpc("team_einladung_zaehlen", { p_betrieb: betrieb });
    if (error) return fehler("zugriff");
    const zr = z as { ok?: boolean; grund?: string } | null;
    if (!zr?.ok) return fehler(zr?.grund === "grenze" ? "grenze" : "kein_inhaber");
  } else {
    const { data: ok, error } = await alsNutzer.rpc("ist_inhaber", { p_betrieb: betrieb });
    if (error || ok !== true) return fehler("kein_inhaber");
  }

  const admin = createClient(basis, dienst, { auth: { persistSession: false, autoRefreshToken: false } });

  const rolle = String(a.rolle ?? "team");
  const nutzer = String(a.nutzer_id ?? "");
  const anzeigename = a.anzeigename == null ? null : String(a.anzeigename).trim().slice(0, GRENZEN.name) || null;

  /* Ins Protokoll (migration-protokoll.sql). Mit Dienstschlüssel ist
     auth.uid() leer, also schreibt kein Trigger — die Funktion trägt
     selbst ein, wer es war: der geprüfte Aufrufer, nie ein Feld der
     Anfrage. Scheitert der Eintrag, bleibt die Änderung trotzdem
     bestehen (§7) — das Protokoll ist Nachweis, keine Schranke. */
  async function merke(art: string, wen: string, felder: string[], nachher: Record<string, unknown> | null) {
    let ziel = wen;
    if (UUID.test(wen)) {
      const { data } = await admin.auth.admin.getUserById(wen);
      ziel = data?.user?.email ?? wen;
    }
    await admin.from("protokoll").insert({
      betrieb_id: betrieb, nutzer_id: ich, tabelle: "team", art, ziel: ziel.slice(0, 120), felder, nachher,
    });
  }

  /* Wie viele Inhaber hätte der Betrieb nach dieser Änderung? */
  async function inhaberOhne(id: string): Promise<number> {
    const { count } = await admin.from("betrieb_mitglieder")
      .select("nutzer_id", { count: "exact", head: true })
      .eq("betrieb_id", betrieb).eq("rolle", "inhaber").neq("nutzer_id", id);
    return count ?? 0;
  }

  try {
    if (aktion === "einladen") {
      const email = String(a.email ?? "").trim().toLowerCase();
      if (!MAIL.test(email) || email.length > 200) return fehler("email");
      if (!ROLLEN.includes(rolle)) return fehler("rolle");
      const ziel = SEITE + (rolle === "kueche" ? "/kueche.html" : "/admin.html");

      let id = "";
      let link: string | null = null;
      let vorhanden = false;
      let versandt = false;

      const bekannt = await admin.rpc("konto_zu_mail", { p_mail: email });
      if (typeof bekannt.data === "string" && UUID.test(bekannt.data)) {
        id = bekannt.data; vorhanden = true;
      } else {
        const { data: neu, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: ziel });
        if (!error && neu?.user?.id) {
          id = neu.user.id; versandt = true;
        } else {
          /* Meist: kein eigener Mailversand (Supabase schickt dann nur an
             das eigene Team) oder die Stundengrenze. Dann den Link selbst
             erzeugen — der Besitzer gibt ihn weiter. Nie still scheitern
             (§8.1i): der Grund geht mit. */
          const { data: g, error: gFehler } = await admin.auth.admin.generateLink({
            type: "invite", email, options: { redirectTo: ziel },
          });
          if (gFehler || !g?.user?.id) {
            return fehler("auth", { text: (gFehler ?? error)?.message ?? "unbekannt" });
          }
          id = g.user.id;
          link = g.properties?.action_link ?? null;
        }
      }

      const { error: mitFehler } = await admin.from("betrieb_mitglieder").upsert(
        { betrieb_id: betrieb, nutzer_id: id, rolle, anzeigename },
        { onConflict: "betrieb_id,nutzer_id" },
      );
      if (mitFehler) return fehler("mitglied", { text: mitFehler.message });
      await merke("neu", email, ["rolle"], { rolle });
      return antwort({ ok: true, nutzer_id: id, vorhanden, versandt, link });
    }

    if (!UUID.test(nutzer)) return fehler("nutzer");

    if (aktion === "aendern") {
      const satz: Record<string, unknown> = {};
      if (a.rolle !== undefined) {
        if (!ROLLEN.includes(rolle)) return fehler("rolle");
        if (nutzer === ich && rolle !== "inhaber") return fehler("selbst");
        if (rolle !== "inhaber" && await inhaberOhne(nutzer) === 0) return fehler("letzter_inhaber");
        satz.rolle = rolle;
      }
      if (a.anzeigename !== undefined) satz.anzeigename = anzeigename;
      if (a.darf_gutscheine !== undefined) satz.darf_gutscheine = a.darf_gutscheine === true;
      if (a.gutschein_max_betrag !== undefined) {
        const n = zahl(a.gutschein_max_betrag, GRENZEN.betrag); if (n === null) return fehler("grenze_betrag");
        satz.gutschein_max_betrag = n;
      }
      if (a.gutschein_max_prozent !== undefined) {
        const n = zahl(a.gutschein_max_prozent, GRENZEN.prozent); if (n === null) return fehler("grenze_prozent");
        satz.gutschein_max_prozent = n;
      }
      if (a.gutschein_tag_max !== undefined) {
        const n = zahl(a.gutschein_tag_max, GRENZEN.tag); if (n === null || !Number.isInteger(n)) return fehler("grenze_tag");
        satz.gutschein_tag_max = n;
      }
      if (!Object.keys(satz).length) return fehler("nichts");
      const { error, count } = await admin.from("betrieb_mitglieder")
        .update(satz, { count: "exact" }).eq("betrieb_id", betrieb).eq("nutzer_id", nutzer);
      if (error) return fehler("mitglied", { text: error.message });
      if (!count) return fehler("kein_mitglied");
      await merke("geaendert", nutzer, Object.keys(satz), satz);
      return antwort({ ok: true });
    }

    if (aktion === "entfernen") {
      if (nutzer === ich) return fehler("selbst");
      if (await inhaberOhne(nutzer) === 0) return fehler("letzter_inhaber");
      const { error, count } = await admin.from("betrieb_mitglieder")
        .delete({ count: "exact" }).eq("betrieb_id", betrieb).eq("nutzer_id", nutzer);
      if (error) return fehler("mitglied", { text: error.message });
      if (!count) return fehler("kein_mitglied");
      await merke("geloescht", nutzer, [], null);
      return antwort({ ok: true });
    }

    return fehler("aktion");
  } catch (e) {
    return fehler("ausnahme", { text: String((e as Error)?.message ?? e) });
  }
});
