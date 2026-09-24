-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET (quxwweuvdqtjsdwgjdrh) · betriebe.hub_banner — das
--  Aktions-Banner-Rad
--
--  Live geprüft: Spalte, Größen-/Stückzahl-Schranke (12 Banner /
--  8000 Byte, per Python-Probe mit echten Feldlängen ~364 Byte je
--  Eintrag) und Rechte (anon nur lesen, authenticated nur schreiben)
--  bestätigt — siehe die Proben am Dateiende, die genau das nachweisen
--  und beide vor dem echten Anwenden in einer zurückgedrehten
--  Transaktion liefen (CLAUDE.md §2.2). Diese Datei bleibt als
--  Dokumentation der Änderung im Repo stehen.
--
--  BEFUND. Der Kachel-Baukasten (betriebe.hub_kacheln) überschreibt
--  dreizehn FESTE Plätze — er kann kein neues, freies Banner anlegen,
--  löschen oder umsortieren (KACHELPLAN.map() in admin.html bindet
--  KACHELSTAND fest an die dreizehn Schlüssel). Das Banner-Rad ist
--  dagegen eine echte, freie Liste: der Wirt legt so viele Banner an,
--  wie er will, jedes mit eigenem Bild/Text/Ziel. Deshalb eine EIGENE
--  Spalte statt eines Umbaus von hub_kacheln — dasselbe Muster wie
--  hub_kacheln selbst neben hub_texte (siehe deren eigener Kommentar):
--  ein anderer Zweck bekommt einen anderen Platz, statt eine
--  bestehende Positivliste zu verbiegen.
--
--  Additiv (CLAUDE.md §2.5): legt nur an, ändert nichts Bestehendes.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.betriebe
  add column if not exists hub_banner jsonb;

comment on column public.betriebe.hub_banner is
  'Aktions-Banner-Rad des Gaeste-Hubs, im Admin-Board eingestellt. Liste '
  'von {id, an, bild, titel, text, farbe, zielTyp, zielWert, reihenfolge}. '
  'zielTyp ist "produkt" (zielWert = Gerichtname, wie aktionen.gericht_name), '
  '"seite" (zielWert = eine der SEITEN-Routen im Hub), "url" (zielWert = '
  'externe https-Adresse) oder "aktion" (zielWert = aktionen.id — Preis und '
  'Restzeit werden dann LIVE aus der aktionen-Tabelle gelesen, nie aus '
  'dieser Spalte, damit kein zweiter, unabhaengiger Preispfad entsteht, '
  'CLAUDE.md §2.3a). Der Hub liest die Liste zur Laufzeit und nimmt nur '
  'Felder aus seiner eigenen Positivliste an.';

-- GEMESSEN, nicht von hub_kacheln übernommen (CLAUDE.md §1.3): ein
-- realistischer Banner-Eintrag mit langem Bild-Pfad, vollem Titel,
-- Unterzeile und einem Produkt-Ziel liegt bei ~364 Byte (Python-
-- Probe mit echten Feldlängen). Ein Banner-Rad mit mehr als zwölf
-- Karten ist als wischbares Karussell ohnehin nicht mehr bedienbar —
-- deshalb zwei Schranken zugleich: eine Stückzahl-Grenze, die das
-- UX-Limit direkt abbildet, und eine Byte-Grenze knapp über dem
-- doppelten dessen, was zwölf realistische Einträge wirklich wiegen
-- (~4,4 kB gemessen, 8 kB Schranke).
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'betriebe_hub_banner_masse')
  then
    alter table public.betriebe
      add constraint betriebe_hub_banner_masse
      check (hub_banner is null or (
        jsonb_typeof(hub_banner) = 'array'
        and jsonb_array_length(hub_banner) <= 12
        and pg_column_size(hub_banner) < 8000
      ));
  end if;
end $$;

-- Gleiches Muster wie bei hub_kacheln: spaltenweises Leserecht für
-- anon (damit "select *" auf betriebe weiterhin an plan/preis_monat/
-- vertrag_ab scheitert, §2.3a), Schreibrecht nur für authenticated —
-- KEINE neue RLS-Regel, die bestehende entscheidet weiterhin, WELCHE
-- Zeile.
grant select (hub_banner) on public.betriebe to anon;
grant update (hub_banner) on public.betriebe to authenticated;

commit;

-- ── PROBE 1 · Schreiben, Lesen, Größen- und Stückzahl-Schranke ────
--   begin;
--   create temp table probe(schritt text, ergebnis text);
--   do $$
--   declare v_id uuid; v_n int;
--   begin
--     select id into v_id from betriebe limit 1;
--
--     update betriebe set hub_banner =
--       '[{"id":"b_test0001","an":true,"bild":"https://x/y.jpg",
--          "titel":"Testbanner","text":"","farbe":"gold",
--          "zielTyp":"url","zielWert":"https://example.com",
--          "reihenfolge":0}]'::jsonb
--      where id = v_id;
--     get diagnostics v_n = row_count;
--     insert into probe values ('schreiben (gueltig)', v_n || ' Zeile(n)');
--
--     -- Dreizehn Banner müssen ABGELEHNT werden (Grenze ist zwölf).
--     begin
--       update betriebe set hub_banner = (
--         select jsonb_agg(jsonb_build_object(
--           'id','b_'||g,'an',true,'bild','https://x/y.jpg',
--           'titel','T','text','','farbe','gold',
--           'zielTyp','url','zielWert','https://example.com',
--           'reihenfolge',g))
--         from generate_series(1,13) g
--       ) where id = v_id;
--       insert into probe values ('13 Banner', 'FEHLER: nicht abgelehnt');
--     exception when check_violation then
--       insert into probe values ('13 Banner', 'abgelehnt (richtig)');
--     end;
--
--     -- Kein Array (z. B. ein einzelnes Objekt) muss ABGELEHNT werden.
--     begin
--       update betriebe set hub_banner = '{"id":"b_x"}'::jsonb
--        where id = v_id;
--       insert into probe values ('kein Array', 'FEHLER: nicht abgelehnt');
--     exception when check_violation then
--       insert into probe values ('kein Array', 'abgelehnt (richtig)');
--     end;
--   end $$;
--   select * from probe;
--   rollback;
--
-- ── PROBE 2 · Rechte, wie ein echter anon/authenticated-Aufruf ────
--   begin;
--   select set_config('request.jwt.claims', '{"role":"anon"}', true);
--   set local role anon;
--   -- Muss gehen (Leserecht):
--   select hub_banner from betriebe limit 1;
--   -- Muss "permission denied" werfen (kein Schreibrecht für anon):
--   -- update betriebe set hub_banner = '[]'::jsonb;
--   rollback;
-- ═══════════════════════════════════════════════════════════════════
