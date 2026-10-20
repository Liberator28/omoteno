/* ═══════════════════════════════════════════════════════════════════
   MELDEN · Push an die Geräte des Teams, wenn eine Bestellung oder ein
   Serviceruf eingeht.

   Ausgerollt unter dem Pfad „swift-processor" (Name „melden") — so ruft
   der Trigger melde_neue_bestellung() sie auf (migration-melden-slug-
   fix.sql). --no-verify-jwt, weil die Datenbank kein Nutzertoken hat.

   VORFALL 26.09. (Sicherheitsdurchgang): Die ausgerollte Fassung stand
   nicht im Verzeichnis und nahm den Inhalt der Meldung UNGEPRÜFT aus
   dem Anfragekörper ({"record": {...}}). Jeder, der die Adresse kennt,
   konnte jedem Betrieb beliebigen Text als „Serviceruf" auf die
   Sperrbildschirme des Personals schicken.

   Jetzt: Aus dem Körper wird NUR die id gelesen. Die Zeile selbst
   kommt aus der Datenbank; gemeldet wird nur, was es gibt, was „neu"
   ist, jünger als drei Minuten — und genau EINMAL (push_gemeldet, ein
   Eintrag je Bestellung). Ein Fälscher kann höchstens eine echte
   Bestellung ein zweites Mal anstoßen, und die wird übersprungen.
   Kein geteiltes Geheimnis nötig, das zwischen SQL und Funktion
   auseinanderlaufen könnte.
   ═══════════════════════════════════════════════════════════════════ */
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE") ?? "";
const VAPID_MAIL    = Deno.env.get("VAPID_MAIL") ?? "mailto:hallo@omoteno.de";

webpush.setVapidDetails(VAPID_MAIL, VAPID_PUBLIC, VAPID_PRIVATE);

const db = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",   // umgeht RLS, läuft nur serverseitig
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Der Endpunkt eines Geräts steht in push_geraete, und das Team schreibt
   ihn selbst (Board, Upsert). web-push ruft genau diese Adresse auf —
   ohne Prüfung wäre jeder angemeldete Mitarbeiter ein Server-Request-
   Absender aus unserer Funktion heraus (Sweep 19.10., SSRF). Nur https
   und die Dienste der Browser-Hersteller. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9.-]+\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/, /^[a-z0-9.-]+\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
];
export function pushEndpunktOk(u: string): boolean {
  try {
    const a = new URL(u);
    return a.protocol === "https:" && !a.username && !a.password && (a.port === "" || a.port === "443") &&
      PUSH_HOSTS.some((r) => r.test(a.hostname));
  } catch { return false; }
}

interface Posten { menge?: number; name?: string }
interface Zeile {
  id: string; betrieb_id: string; quelle: string; status: string; tisch: string | null;
  positionen: Posten[] | null; summe: number | null; notiz: string | null; zeitpunkt: string;
  pruefen: boolean | null;
}

/* Die Zeile auf dem Sperrbildschirm. Sie muss ohne Entsperren
   verständlich sein. */
function text(b: Zeile): string {
  if (b.quelle === "service") return (b.notiz ?? "").trim() || "Ruft nach Service";
  const p: Posten[] = Array.isArray(b.positionen) ? b.positionen : [];
  let z = p.slice(0, 4).map((x) => `${x.menge ?? 1}× ${x.name ?? ""}`).join(" · ");
  if (p.length > 4) z += ` · +${p.length - 4} weitere`;
  if ((b.summe ?? 0) > 0) {
    z += (z ? "\n" : "") +
      new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(b.summe ?? 0);
  }
  if (b.notiz) z += `\nNotiz: ${b.notiz}`;
  return z || "Ohne Positionen";
}

const antwort = (k: unknown, status = 200) =>
  new Response(JSON.stringify(k), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (anfrage: Request) => {
  if (anfrage.method !== "POST") return antwort({ fehler: "nur POST" }, 405);
  try {
    const koerper = await anfrage.json().catch(() => null) as { record?: { id?: unknown }; id?: unknown } | null;
    const id = String(koerper?.record?.id ?? koerper?.id ?? "");
    if (!UUID.test(id)) return antwort({ fehler: "keine id" }, 400);

    const { data: b, error } = await db.from("bestellungen")
      .select("id, betrieb_id, quelle, status, tisch, positionen, summe, notiz, zeitpunkt, pruefen")
      .eq("id", id).maybeSingle();
    if (error) throw error;
    if (!b) return antwort({ uebersprungen: "unbekannt" });
    const zeile = b as Zeile;
    if (zeile.status !== "neu") return antwort({ uebersprungen: "nicht neu" });
    /* Markiert (migration-missbrauch.sql, Teil 2): Eine Flut soll nicht
       auf den Telefonen des Teams klingeln. Das Board zeigt sie zur
       Freigabe. */
    if (zeile.pruefen === true) return antwort({ uebersprungen: "zu prüfen" });
    if (Date.now() - Date.parse(zeile.zeitpunkt) > 3 * 60 * 1000) return antwort({ uebersprungen: "zu alt" });

    /* Genau einmal: Der Eintrag gelingt nur beim ersten Aufruf. */
    const { data: neu, error: fehlerEintrag } = await db.from("push_gemeldet")
      .upsert({ bestellung_id: id }, { onConflict: "bestellung_id", ignoreDuplicates: true })
      .select("bestellung_id");
    if (fehlerEintrag) throw fehlerEintrag;
    if (!neu || !neu.length) return antwort({ uebersprungen: "schon gemeldet" });

    const { data: geraete, error: fehlerGeraete } = await db.from("push_geraete")
      .select("endpunkt, p256dh, auth").eq("betrieb_id", zeile.betrieb_id);
    if (fehlerGeraete) throw fehlerGeraete;
    const erlaubt = (geraete ?? []).filter((g: { endpunkt: string }) => pushEndpunktOk(g.endpunkt));
    if (!geraete || !erlaubt.length) return antwort({ zugestellt: 0, grund: "kein Gerät gemeldet" });

    const wer = zeile.tisch ? `Tisch ${zeile.tisch}` : "Gast";
    const inhalt = JSON.stringify({
      id: zeile.id, quelle: zeile.quelle,
      titel: (zeile.quelle === "service" ? "Serviceruf · " : "Neue Bestellung · ") + wer,
      text: text(zeile), url: "/",
    });

    const ergebnisse = await Promise.allSettled(erlaubt.map((g: { endpunkt: string; p256dh: string; auth: string }) =>
      webpush.sendNotification({ endpoint: g.endpunkt, keys: { p256dh: g.p256dh, auth: g.auth } },
        inhalt, { TTL: 600, urgency: "high" })));

    /* Abgemeldete Geräte (404/410) aufräumen, sonst wächst die Tabelle
       endlos und jede Meldung wartet auf Zustellungen ins Leere. */
    const tot: string[] = [];
    ergebnisse.forEach((r, i) => {
      if (r.status === "rejected") {
        const code = (r.reason as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) tot.push(erlaubt[i].endpunkt);
        else console.error("Push fehlgeschlagen:", code);
      }
    });
    if (tot.length) await db.from("push_geraete").delete().in("endpunkt", tot);

    return antwort({ zugestellt: ergebnisse.filter((r) => r.status === "fulfilled").length, entfernt: tot.length });
  } catch (e) {
    console.error(e);
    return antwort({ fehler: String((e as Error)?.message ?? e) }, 500);
  }
});
