-- ═══════════════════════════════════════════════════════════════════
--  NOCH NICHT ANGEWENDET · Zwei Dinge, ein Einspielen
--
--  Im SQL-Editor von Supabase ausführen. Die Proben am Dateiende
--  gehören dazu: Eine Migration, die „success" meldet, sagt NICHTS
--  darüber, ob die Funktion läuft (CLAUDE.md §2.2).
--
--  1 · betriebe.hub_kacheln   — der Kachel-Baukasten im Admin-Board
--  2 · bestellungen.storno    — der Gast zieht binnen zwei Minuten
--      und bestellung_stornieren()  zurück
--
--  Beide Abschnitte sind ADDITIV (§2.5): Sie legen an, sie ändern
--  nichts Bestehendes. Wer nur einen davon braucht, kann den anderen
--  stehen lassen — sie hängen nicht zusammen.
-- ═══════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════
--  1 · DER KACHEL-BAUKASTEN
--
--  BEFUND. Die Startkacheln des Hubs kommen bisher aus dem
--  MARKENBLATT und werden beim Erzeugen in die Datei gebacken. Das
--  ist richtig für Farben, Schriften und Aufbau — die stellt das
--  Marken-Studio bei der Aufnahme eines Hauses ein.
--
--  Der WIRT arbeitet aber im Admin-Board, und was er dort umstellt,
--  will er beim nächsten Öffnen des Hubs sehen und nicht beim
--  nächsten Erzeugen. Deshalb derselbe Weg wie bei hub_texte: eine
--  Spalte, die der Hub zur Laufzeit liest.
--
--  WARUM EINE EIGENE SPALTE UND NICHT hub_texte. Auf hub_texte liegt
--  eine Größenschranke (hub_texte_masse). Ihren Wert konnte ich nicht
--  nachsehen — die Datenbank ist aus meiner Arbeitsumgebung gesperrt.
--  Eine Kachelliste dort hineinzudrücken hieße raten, und Raten ist
--  genau das, wogegen §0 steht.
-- ══════════════════════════════════════════════════════════════════

begin;

alter table public.betriebe
  add column if not exists hub_kacheln jsonb;

comment on column public.betriebe.hub_kacheln is
  'Startkacheln des Gaeste-Hubs, im Admin-Board eingestellt. Liste von '
  '{schluessel, an, titel, unter, icon, banner}. Der Hub liest sie zur '
  'Laufzeit und nimmt nur Felder aus seiner eigenen Positivliste an.';

-- Eine Schranke, die zu dem passt, was der Baukasten wirklich
-- schickt: dreizehn Kacheln mit Titel, Unterzeile, Symbolnamen und
-- einer Bildadresse. 20 kB sind das Doppelte davon — genug Luft, und
-- weit entfernt davon, dass jemand eine Karte in die Spalte legt.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'betriebe_hub_kacheln_masse')
  then
    alter table public.betriebe
      add constraint betriebe_hub_kacheln_masse
      check (hub_kacheln is null or pg_column_size(hub_kacheln) < 20000);
  end if;
end $$;

-- Der Gast liest die Spalte mit dem anon-Schluessel. Das Leserecht
-- ist SPALTENWEISE vergeben — genau wie bei den uebrigen Kopfdaten,
-- damit „select *" auf betriebe weiterhin scheitert und plan,
-- preis_monat und vertrag_ab nicht mit herauskommen (§2.3a).
grant select (hub_kacheln) on public.betriebe to anon;

-- Schreiben darf nur, wer ohnehin schon Betriebsdaten aendern darf.
-- Hier wird KEINE RLS-Regel angefasst: Die vorhandene Regel fuer
-- authenticated entscheidet weiterhin, WELCHE Zeile — dieses Recht
-- sagt nur, dass die neue Spalte dabei ist.
grant update (hub_kacheln) on public.betriebe to authenticated;

commit;

-- ── PROBE 1 ──────────────────────────────────────────────────────
--   begin;
--   create temp table probe(schritt text, ergebnis text);
--   do $$
--   declare v_id uuid; v_n int;
--   begin
--     select id into v_id from betriebe limit 1;
--     update betriebe set hub_kacheln =
--       '[{"schluessel":"speisekarte","titel":"Unsere Karte"}]'::jsonb
--      where id = v_id;
--     get diagnostics v_n = row_count;
--     insert into probe values ('schreiben', v_n || ' Zeile(n)');
--
--     -- Zu gross muss ABGELEHNT werden. Faengt die Schranke nicht,
--     -- ist sie keine.
--     begin
--       update betriebe set hub_kacheln =
--         to_jsonb(repeat('x', 30000)) where id = v_id;
--       insert into probe values ('zu gross', 'DURCHGELASSEN — Schranke greift nicht');
--     exception when check_violation then
--       insert into probe values ('zu gross', 'abgelehnt, richtig');
--     end;
--   end $$;
--   select * from probe;
--   rollback;
--
-- ── PROBE 2 · liest der Gast sie? ────────────────────────────────
--   begin;
--   set local role anon;
--   select slug, hub_kacheln from betriebe where slug = 'chocolamour';
--   -- muss EINE Zeile liefern
--   rollback;
--
--   begin;
--   set local role anon;
--   select preis_monat from betriebe limit 1;
--   -- muss weiterhin mit 42501 scheitern
--   rollback;
