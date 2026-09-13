-- ═══════════════════════════════════════════════════════════════════
--  ZUSAMMENFASSUNG · Sitzung vom 13.09.
--
--  Diese Sitzung hatte live Zugriff auf Supabase (Projekt
--  "Project Blend Hub", quxwweuvdqtjsdwgjdrh) über das MCP-Werkzeug
--  "Supabase" (Grossbuchstabe — zu unterscheiden von den in dieser
--  Sitzung nicht erreichbaren "supabase"/"supabase-schreiben").
--
--  ALLES UNTEN STEHENDE IST BEREITS ANGEWENDET UND GEGENGEPRÜFT.
--  Nachgewiesen über list_migrations gegen die echte Datenbank —
--  nicht nur "sollte laufen", sondern in der Versionsliste bestätigt:
--
--    20260913104650  betriebe_liefer_leserecht
--    20260913111029  admin_login_schutz_rls_aktivieren
--
--  Diese Datei ist NICHT zum erneuten Ausführen gedacht (beide
--  Änderungen stehen schon in der Datenbank) — sie ist die
--  Übergabe, falls eine spätere Sitzung ohne Datenbankzugriff
--  nachvollziehen muss, was passiert ist, oder falls doch etwas
--  von Hand nachgetragen werden soll. Die einzelnen, ausführlich
--  kommentierten Originaldateien stehen daneben:
--
--    datenbank/migration-betriebe-liefer-leserecht.sql
--    datenbank/migration-admin-login-schutz-rls.sql
-- ═══════════════════════════════════════════════════════════════════


-- ── 1 · Der Gast-Hub konnte betriebe nicht mehr vollständig lesen ────
--
-- BEFUND: Seit der Lieferfunktion (Liefern 1-5) liest der Hub beim
-- Start auch betriebe.liefer mit. Das Spaltenrecht für die Rolle
-- "anon" wurde dabei nie erweitert. Postgres verweigert die GANZE
-- Abfrage, sobald auch nur eine ausgewählte Spalte kein Recht trägt —
-- seit der Lieferfunktion schlug deshalb nicht nur "liefer", sondern
-- der komplette Kartenabruf fehl: die LIVE-Karte, bestellPause,
-- hub_texte, hub_kacheln, hub_woerter erreichten keinen Gast mehr,
-- egal welches Haus. Nachgewiesen über query_logs: wiederholt
-- "permission denied for table betriebe" von anon, zuletzt mehrfach
-- am 12./13.09.
--
-- Betroffen war JEDES Haus, nicht nur eines mit Lieferung — die
-- Spalte steht bei allen in derselben SELECT-Anfrage.

grant select (liefer) on public.betriebe to anon;

-- Geprüft: begin; set local role anon;
-- select id, bestell_pause, hub_texte, hub_kacheln, hub_woerter, liefer
--   from betriebe where slug = 'chocolamour'; rollback;
-- → liefert alle sechs Felder. Geschäftsspalten (preis_monat etc.)
--   bleiben weiterhin verweigert.


-- ── 2 · admin_login_schutz hatte Row Level Security aus ─────────────
--
-- BEFUND: Einzige Tabelle im Schema ohne RLS. Der generische Hinweis
-- dazu ("anyone with the anon key can read or modify every row") ist
-- die Standardformulierung für jede Tabelle ohne RLS — nachgemessen
-- statt geglaubt: Weder anon noch authenticated haben überhaupt ein
-- GRANT auf diese Tabelle (nur service_role, postgres). Beide Rollen
-- wurden mit 42501 "permission denied" abgewiesen. RLS war hier also
-- nicht die aktive Tür — trotzdem als Verteidigung in der Tiefe an,
-- falls später ein GRANT dazukommt, ohne dass jemand an RLS denkt.

alter table public.admin_login_schutz enable row level security;

-- Geprüft: relrowsecurity=true, relforcerowsecurity=false (Eigentümer
-- bleibt frei) — admin_anmelden()/admin_login_entsperren() sind
-- SECURITY DEFINER und laufen als Eigentümer, von RLS unberührt.
-- select count(*) from admin_login_schutz; → weiterhin normal lesbar.
-- pruefungen/pruef-admin-login.js → weiterhin "Alles sauber".


-- ── 3 · Die Edge Function "uebersetzen" war nie ausgerollt ──────────
--
-- Kein SQL, sondern eine Infrastruktur-Lücke: Der Quelltext lag
-- fertig in supabase/functions/uebersetzen/index.ts, wurde aber nie
-- deployt. Das Board meldete "ist die Funktion uebersetzen
-- ausgerollt?" — zu Recht. Jetzt deployt und aktiv (list_edge_functions
-- bestätigt status: ACTIVE).
--
-- OFFEN, NICHT VON MIR GEPRÜFT: Ob in den Supabase-Secrets ein
-- ANTHROPIC_API_KEY hinterlegt ist. Ohne ihn antwortet die Funktion
-- jetzt ehrlich mit "kein_schluessel" statt mit "nicht erreichbar" —
-- das ist der Fortschritt, den diese Sitzung bringen konnte. Ob
-- wirklich übersetzt wird, zeigt sich erst beim nächsten Speichern
-- eines Gerichts im Board. Kein MCP-Werkzeug dieser Sitzung kann
-- Secrets lesen oder setzen — das geht nur über die Supabase-CLI
-- oder das Dashboard (Project Settings → Edge Functions → Secrets).


-- ── GEFUNDEN, ABSICHTLICH NICHT ANGEFASST ────────────────────────────
--
-- supabase/functions/alessia-bestellung/index.ts liegt ebenfalls
-- fertig im Repo und ist laut list_edge_functions NICHT deployt
-- (nur "melden" und jetzt "uebersetzen" sind aktiv). Nicht Teil
-- dieser Sitzung angefragt, deshalb nicht angerührt — falls der
-- Telefonbestellweg (Alessia) genutzt werden soll, braucht es
-- denselben Ausroll-Schritt wie bei "uebersetzen".
-- ═══════════════════════════════════════════════════════════════════
