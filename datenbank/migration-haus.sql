-- ═══════════════════════════════════════════════════════════════════
--  migration-haus.sql · hub_texte.ueber („Über uns“ auf der Haus-Seite)
--
--  Wunsch (11.10.): Ein Tipp aufs Logo zeigt dem Gast eine kleine
--  Landingpage des Hauses. Den Text „Über uns“ trägt der Betrieb im
--  Board unter „Ihre Worte“ ein; er liegt bei den übrigen Worten in
--  betriebe.hub_texte — keine neue Spalte, der Hub liest ihn live.
--
--  Kopfbild und Logo liegen in betriebe.hub_stil.kopf (zwei Adressen
--  und ein Wort, gemessen < 400 Bytes) — die bestehende Schranke
--  betriebe_hub_stil_form (< 2500 Bytes) trägt das ohne Änderung. Der
--  Hub nimmt nur Dateien aus <Betrieb>/kopf/ im Eimer „gerichte“; die
--  Upload-Regeln des Eimers gelten unverändert (nur Inhaber, eigener
--  Ordner — migration-rollen.sql).
--
--  Ohne diese Migration läuft alles: hub_texte hat keine Gesamtgrenze,
--  „ueber“ wird angenommen; Board (TEXTMASS.hubUeber) und Hub
--  (kurz(…, 400)) kürzen schon. Die Schranke ist die dritte Linie für
--  jeden anderen Weg in die Tabelle (§2.3a). Additiv (§2.8).
--
--  ANGEWENDET 11.10. (Supabase-MCP, Migration „haus_ueber_und_textgroesse“).
--  Vorab: längstes „ueber“ 0 Zeichen, größtes hub_texte 2 Bytes.
--  Probe danach (zurückgedreht): 400 Zeichen → 1 Zeile · 401 →
--  abgewiesen · 600 KB → abgewiesen · andere Spalte → 1 Zeile.
-- ═══════════════════════════════════════════════════════════════════
alter table public.betriebe add constraint hub_texte_ueber check (
  coalesce(length(hub_texte ->> 'ueber'), 0) <= 400
);

-- „Texte & Schrift“ (11.10.): eigene Texte je Wörterbuchschlüssel liegen in
-- hub_texte.eigen, je Text bis zu zwölf Sprachen à 160 Zeichen. Das Board
-- lässt höchstens 120 eigene Texte zu (TX_HOECHST), der Hub nimmt höchstens
-- 400 Schlüssel an und kürzt jeden Wert (eigenSauber). Die Schranke hier
-- deckelt die Spalte als Ganzes (als Text gemessen, nicht komprimiert —
-- pg_column_size sähe nur die gepackte Größe) — sie wird bei jedem Besuch geladen.
alter table public.betriebe add constraint hub_texte_groesse check (
  octet_length(coalesce(hub_texte, '{}'::jsonb)::text) < 524288
);

-- ── PROBE (im SQL-Editor, dreht sich selbst zurück; Zeilenzahl statt
--    Ausnahme §2.3b; andere Spalte derselben Zeile §2.7) ──
-- begin;
-- create temp table probe(schritt text, ergebnis text);
-- do $$
-- declare n int; b uuid := (select id from public.betriebe order by id limit 1);
-- begin
--   update public.betriebe set hub_texte = coalesce(hub_texte,'{}'::jsonb) || jsonb_build_object('ueber', repeat('x', 400)) where id = b;
--   get diagnostics n = row_count; insert into probe values ('ueber 400 Zeichen', n::text);
--   begin
--     update public.betriebe set hub_texte = coalesce(hub_texte,'{}'::jsonb) || jsonb_build_object('ueber', repeat('x', 401)) where id = b;
--     insert into probe values ('ueber 401 Zeichen', 'NICHT abgewiesen');
--   exception when check_violation then insert into probe values ('ueber 401 Zeichen', 'abgewiesen');
--   end;
--   update public.betriebe set name = name where id = b;
--   get diagnostics n = row_count; insert into probe values ('andere Spalte', n::text);
-- end $$;
-- select * from probe;
-- rollback;
--   Erwartet: 1 · abgewiesen · 1
--   Größe: update … hub_texte = jsonb_build_object('eigen', <300 KB>) → abgewiesen.
