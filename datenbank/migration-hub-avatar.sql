-- ═══════════════════════════════════════════════════════════════════
--  EINGESPIELT (15.09.2026) · betriebe.hub_avatar — Figur, Stimmung
--  und Requisiten im Admin-Board
--
--  Angewendet gegen das echte Projekt UND Probe 1 live gefahren:
--  Schreiben ok (1 Zeile), zu großer Wert von der Schranke abgelehnt
--  (betriebe_hub_avatar_masse), anon liest die Spalte, schreibt aber
--  nicht. Zurückgedreht, keine echte Zeile blieb verändert.
--
--  Im SQL-Editor von Supabase ausführen. Die Proben am Dateiende
--  gehören dazu: Eine Migration, die „success" meldet, sagt NICHTS
--  darüber, ob eine Regel wirklich trägt (CLAUDE.md §2.2).
--
--  BEFUND. Welche Figur im Hub erscheint, welche Stimmung sie hat und
--  was sie je Bestellphase in der Hand hält, kommt bisher AUSSCHLIESS-
--  LICH aus dem Markenblatt und wird beim Erzeugen in die Datei
--  gebacken (vorlagen/hub.vorlage.html, avatarFigur()/avatarArt()/
--  avatarHaende() lesen nur MARKENBLATT.avatar). Eine Änderung im
--  Admin-Board bräuchte deshalb jedes Mal ein erzeuge-hub.js — das
--  widerspricht dem Zweck des Boards, dem Werkzeug des Wirts.
--
--  Derselbe Weg wie bei betriebe.hub_kacheln (migration-baukasten-
--  und-storno.sql): eine eigene Spalte, additiv, die der Hub zur
--  Laufzeit liest. KEINE eigene Prüffunktion nötig — anders als bei
--  den Kacheln (kachelBauen() übernimmt dort blind, was in der
--  Positivliste steht) validieren avatarFigur()/avatarArt()/
--  avatarHaende() im Hub JEDEN gelesenen Wert schon selbst und fallen
--  bei einem unbekannten Namen still auf Untersetzer/freundlich/die
--  Phasenvorgabe zurück (vorlagen/hub.vorlage.html, Zeile ~5601-5619).
--  Das schützt genauso vor einer kaputten Live-Spalte wie sonst vor
--  einem alten Markenblatt ohne das Feld.
--
--  Inhalt: {figur, art, haende:{neu, arbeit, fertig}} — genau das
--  bestehende avatar-Schema aus dem Markenblatt, nur als Overlay.
--
--  Additiv (§2.5): legt nur an, ändert nichts Bestehendes.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.betriebe
  add column if not exists hub_avatar jsonb;

comment on column public.betriebe.hub_avatar is
  'Figur des Hauses, im Admin-Board eingestellt: {figur, art, '
  'haende:{neu,arbeit,fertig}}. Der Hub liest sie zur Laufzeit; jeder '
  'Wert wird beim Lesen einzeln geprueft (avatarFigur/avatarArt/'
  'avatarHaende in hub.vorlage.html), ein unbekannter faellt still '
  'auf die Vorgabe zurueck.';

-- Eine Schranke, die zu dem passt, was das Board wirklich schickt:
-- zwei kurze Schluesselnamen und drei weitere fuer die Haende. 2 kB
-- sind das Zehnfache eines realistischen Eintrags — genug Luft, und
-- weit entfernt davon, dass hier grosse Daten landen koennten.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'betriebe_hub_avatar_masse')
  then
    alter table public.betriebe
      add constraint betriebe_hub_avatar_masse
      check (hub_avatar is null or pg_column_size(hub_avatar) < 2000);
  end if;
end $$;

-- Der Gast liest die Spalte mit dem anon-Schluessel. SPALTENWEISE
-- vergeben wie bei den uebrigen Kopfdaten, damit "select *" auf
-- betriebe weiterhin scheitert und plan/preis_monat/vertrag_ab nicht
-- mit herauskommen (§2.3a).
grant select (hub_avatar) on public.betriebe to anon;

-- Schreiben darf nur, wer ohnehin schon Betriebsdaten aendern darf.
-- Keine RLS-Regel wird hier angefasst: Die vorhandene Regel fuer
-- authenticated entscheidet weiterhin, WELCHE Zeile — dieses Recht
-- sagt nur, dass die neue Spalte dabei ist.
grant update (hub_avatar) on public.betriebe to authenticated;

commit;

-- ── PROBE 1 · Schreiben und Groessenschranke ───────────────────────
--   begin;
--   create temp table probe(schritt text, ergebnis text);
--   do $$
--   declare v_id uuid; v_n int;
--   begin
--     select id into v_id from betriebe limit 1;
--
--     update betriebe set hub_avatar =
--       '{"figur":"erdbeere","art":"witzig",
--         "haende":{"neu":"zettel","arbeit":"pfanne","fertig":"teller"}}'::jsonb
--      where id = v_id;
--     get diagnostics v_n = row_count;
--     insert into probe values ('schreiben', v_n || ' Zeile(n)');
--
--     -- Zu gross muss ABGELEHNT werden, sonst faengt die Schranke nicht.
--     begin
--       update betriebe set hub_avatar =
--         jsonb_build_object('figur', repeat('x', 3000)) where id = v_id;
--       insert into probe values ('zu gross', 'DURCHGELASSEN !!!');
--     exception when check_violation then
--       insert into probe values ('zu gross', 'abgelehnt (richtig)');
--     end;
--
--     update betriebe set hub_avatar = null where id = v_id;
--   end $$;
--   select * from probe;
--   rollback;
--
-- ── PROBE 2 · Rechte je Rolle (wie datenbank/pruef-rechte.sql) ─────
--   begin;
--   select set_config('request.jwt.claims', '{"role":"anon"}', true);
--   set local role anon;
--   select has_column_privilege('betriebe', 'hub_avatar', 'SELECT') as lesen,
--          has_column_privilege('betriebe', 'hub_avatar', 'UPDATE') as schreiben;
--   -- erwartet: lesen=true, schreiben=false
--   rollback;
