/* ═══════════════════════════════════════════════════════════════════
   MASTER-ZUGANG · Konten anlegen und verwalten, nur für den Master
   ═══════════════════════════════════════════════════════════════════

   Ausrollen (MIT Token-Prüfung):
     supabase functions deploy master-zugang

   Wunsch 25.09.2026: „Ich kann direkt Zugänge freischalten, ohne dass
   Besitzer erst eine Bestätigungsmail akzeptieren müssen.“

   Das geht nur mit der Admin-Schnittstelle von Supabase Auth — und die
   braucht den Service-Schlüssel. Der liegt AUSSCHLIESSLICH hier (in den
   Umgebungsvariablen der Funktion, von Supabase gesetzt), nie im
   Browser. Deshalb ist die erste Zeile jeder Anfrage die Frage an die
   Datenbank MIT DEM TOKEN DES AUFRUFERS: ist_master()? Die Antwort
   hängt an master_konten UND an der PIN (migration-pin.sql). Erst
   danach wird der Service-Schlüssel überhaupt angefasst.

   Was sie kann (aktion):
     anlegen      E-Mail, Passwort, Betrieb, Rolle → Konto sofort
                  bestätigt; gibt es die Adresse schon, nur Mitgliedschaft
     bestaetigen  eine offene Registrierung ohne Mail freischalten
     passwort     neues Passwort setzen (hebt die 3-Fehlversuche-Sperre
                  über den vorhandenen Trigger auf)
     sperren      Konto sperren / wieder zulassen (Auth-Bann)
     rolle        Rolle in einem Betrieb ändern
     entfernen    aus einem Betrieb entfernen (das Konto bleibt)

   Nie gegen sich selbst: Der Master kann sich nicht sperren oder
   entfernen — sonst schlösse ein Fehlgriff die Zentrale ab.
   ═══════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

const ROLLEN = ["inhaber", "team", "kueche"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  aktion?: string; email?: string; passwort?: string; betrieb_id?: string;
  rolle?: string; nutzer_id?: string; an?: boolean;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return antwort({}, 200);
  if (req.method !== "POST") return antwort({ ok: false, grund: "nur_post" }, 405);

  const basis = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const dienst = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!basis || !anon || !dienst) return fehler("einrichtung");

  const alsNutzer = createClient(basis, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });

  /* Erst die Rolle, dann alles andere. */
  const { data: istMaster, error: rolleFehler } = await alsNutzer.rpc("ist_master");
  if (rolleFehler || istMaster !== true) return fehler("kein_master");
  const { data: wer } = await alsNutzer.auth.getUser();
  const ich = wer?.user?.id ?? "";

  let a: Anfrage;
  try { a = await req.json(); } catch { return fehler("kein_json"); }
  const aktion = String(a.aktion ?? "");

  const admin = createClient(basis, dienst, { auth: { persistSession: false, autoRefreshToken: false } });

  const nutzer = String(a.nutzer_id ?? "");
  const betrieb = String(a.betrieb_id ?? "");
  const rolle = String(a.rolle ?? "inhaber");
  if (["bestaetigen", "passwort", "sperren", "rolle", "entfernen"].includes(aktion) && !UUID.test(nutzer)) {
    return fehler("nutzer");
  }
  if (["sperren", "entfernen"].includes(aktion) && nutzer === ich) return fehler("selbst");
  if (["anlegen", "rolle", "entfernen"].includes(aktion) && !UUID.test(betrieb)) return fehler("betrieb");
  if (["anlegen", "rolle"].includes(aktion) && !ROLLEN.includes(rolle)) return fehler("rolle");

  try {
    if (aktion === "anlegen") {
      const email = String(a.email ?? "").trim().toLowerCase();
      const passwort = String(a.passwort ?? "");
      if (!MAIL.test(email)) return fehler("email");
      if (passwort.length < 10) return fehler("passwort_kurz");
      const { data: haus } = await admin.from("betriebe").select("id").eq("id", betrieb).maybeSingle();
      if (!haus) return fehler("betrieb");

      let id = "";
      let vorhanden = false;
      const { data: neu, error } = await admin.auth.admin.createUser({
        email, password: passwort, email_confirm: true,
      });
      if (error) {
        if (!/already|registered|exists/i.test(error.message)) return fehler("auth", { text: error.message });
        /* Die Adresse gibt es schon: dann nur die Mitgliedschaft.
           Gesucht über master_zugaenge() mit dem Token des Masters —
           dieselbe Liste, die er in der Zentrale sieht. */
        const { data: liste } = await alsNutzer.rpc("master_zugaenge");
        const treffer = (liste as Array<{ nutzer_id: string; email: string }> | null ?? [])
          .find((z) => (z.email ?? "").toLowerCase() === email);
        if (!treffer) return fehler("auth", { text: error.message });
        id = treffer.nutzer_id;
        vorhanden = true;
      } else {
        id = neu.user?.id ?? "";
      }
      const { error: mitFehler } = await admin.from("betrieb_mitglieder")
        .upsert({ betrieb_id: betrieb, nutzer_id: id, rolle }, { onConflict: "betrieb_id,nutzer_id" });
      if (mitFehler) return fehler("mitglied", { text: mitFehler.message });
      return antwort({ ok: true, nutzer_id: id, vorhanden });
    }

    if (aktion === "bestaetigen") {
      const { error } = await admin.auth.admin.updateUserById(nutzer, { email_confirm: true });
      return error ? fehler("auth", { text: error.message }) : antwort({ ok: true });
    }

    if (aktion === "passwort") {
      const passwort = String(a.passwort ?? "");
      if (passwort.length < 10) return fehler("passwort_kurz");
      const { error } = await admin.auth.admin.updateUserById(nutzer, { password: passwort });
      return error ? fehler("auth", { text: error.message }) : antwort({ ok: true });
    }

    if (aktion === "sperren") {
      /* 100 Jahre heißt bei Supabase „gesperrt“; "none" hebt es auf. */
      const { error } = await admin.auth.admin.updateUserById(nutzer, { ban_duration: a.an ? "876000h" : "none" });
      return error ? fehler("auth", { text: error.message }) : antwort({ ok: true });
    }

    if (aktion === "rolle") {
      const { error, count } = await admin.from("betrieb_mitglieder")
        .update({ rolle }, { count: "exact" }).eq("betrieb_id", betrieb).eq("nutzer_id", nutzer);
      if (error) return fehler("mitglied", { text: error.message });
      return count ? antwort({ ok: true }) : fehler("kein_mitglied");
    }

    if (aktion === "entfernen") {
      const { error, count } = await admin.from("betrieb_mitglieder")
        .delete({ count: "exact" }).eq("betrieb_id", betrieb).eq("nutzer_id", nutzer);
      if (error) return fehler("mitglied", { text: error.message });
      return count ? antwort({ ok: true }) : fehler("kein_mitglied");
    }

    return fehler("aktion");
  } catch (e) {
    return fehler("ausnahme", { text: String((e as Error)?.message ?? e) });
  }
});
