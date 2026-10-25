-- ═══════════════════════════════════════════════════════════════════
--  migration-karte-kopf.sql · Texte im Kopf der Speisekarte + „Beliebt“
--  ANGEWENDET 25.10. (Supabase-MCP, Migration „karte_kopf_und_beliebt“; Vorab: Spalte und CHECK fehlten, kein hub_texte trug
--  einen karte_*-Schlüssel). Probe danach in zurückgedrehter Transaktion: 60 Zeichen → 1 Zeile · 61 → abgewiesen · andere Spalte → 1 Zeile ·
--  beliebt setzen → 1 Zeile · anon darf beliebt lesen, nicht schreiben (auch die Tabelle nicht).
--
--  Zwei Dinge, beide additiv (§2.5, §2.8: keine Zeile beginnt mit drop):
--
--  1) hub_texte.karte_eyebrow / karte_titel / karte_text / karte_kopfzeile
--     — die Texte der Kopfkarte der Speisekarte (Startgrafik). Sie liegen bei
--     den übrigen Worten des Hauses in betriebe.hub_texte; keine neue Spalte.
--     Die Schranke ist die dritte Linie hinter Board (TEXTMASS) und Hub
--     (kurz(…, n)): 40 / 60 / 160 / 60 Zeichen — dieselben Zahlen wie in
--     erzeuger/erzeuge-hub.js (startgrafik.karte) und im Hub (KARTE_LIVE).
--     Eigene Schranke statt hub_texte_masse zu erweitern: Die Liste dort
--     wurde von mehreren Migrationen angefasst (§2.3c), ein Neuaufbau aus dem
--     Gedächtnis könnte einen Schlüssel still verlieren.
--
--  2) gerichte.beliebt boolean — Hausklassiker für „Unsere Highlights“ und das
--     Abzeichen „Beliebt“. Bis heute kennt nur das Gerüst-Verzeichnis im Hub
--     `top:true`; eine echte Karte aus der Datenbank hat keine Möglichkeit,
--     ein Gericht als beliebt zu markieren (gemessen: Spaltenliste in
--     datenbank/stand-spalten-protokoll.json). Der Hub liest `beliebt === true`
--     schon jetzt (fehlt die Spalte, ändert sich nichts).
--     Schreiben darf, wer Gerichte schreiben darf (bestehende Regeln) — die
--     Spalte erbt Recht und Regel der Tabelle; kein neues GRANT nötig.
--     Vorher lesen (§1.1a): wer schreibt, wer liest, welcher Index?
--       select indexdef from pg_indexes where tablename = 'gerichte';
--       select column_name from information_schema.columns
--        where table_name = 'gerichte' and column_name = 'beliebt';   -- erwartet: 0 Zeilen
-- ═══════════════════════════════════════════════════════════════════
alter table public.betriebe add constraint hub_texte_karte check (
      coalesce(length(hub_texte ->> 'karte_eyebrow'), 0)   <= 40
  and coalesce(length(hub_texte ->> 'karte_titel'), 0)     <= 60
  and coalesce(length(hub_texte ->> 'karte_text'), 0)      <= 160
  and coalesce(length(hub_texte ->> 'karte_kopfzeile'), 0) <= 60
);

alter table public.gerichte add column if not exists beliebt boolean not null default false;

-- ── PROBE (im SQL-Editor, dreht sich selbst zurück; Zeilenzahl statt Ausnahme §2.3b;
--    andere Spalte derselben Zeile §2.7) ──
-- begin;
-- create temp table probe(schritt text, ergebnis text);
-- do $$
-- declare n int; b uuid := (select id from public.betriebe order by id limit 1);
-- begin
--   update public.betriebe set hub_texte = coalesce(hub_texte,'{}'::jsonb) || jsonb_build_object('karte_titel', repeat('x', 60)) where id = b;
--   get diagnostics n = row_count; insert into probe values ('karte_titel 60 Zeichen', n::text);
--   begin
--     update public.betriebe set hub_texte = coalesce(hub_texte,'{}'::jsonb) || jsonb_build_object('karte_titel', repeat('x', 61)) where id = b;
--     insert into probe values ('karte_titel 61 Zeichen', 'FEHLER: angenommen');
--   exception when check_violation then insert into probe values ('karte_titel 61 Zeichen', 'abgewiesen'); end;
--   update public.betriebe set name = name where id = b;
--   get diagnostics n = row_count; insert into probe values ('andere Spalte', n::text);
--   update public.gerichte set beliebt = true where id = (select id from public.gerichte limit 1);
--   get diagnostics n = row_count; insert into probe values ('beliebt setzen', n::text);
-- end $$;
-- select * from probe;
-- rollback;
