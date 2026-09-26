-- ═══════════════════════════════════════════════════════════════════
--  MIGRATION · Eigene Schriften eines Betriebs
--
--  Wunsch (26.09.2026): Im Board Schriften wählen — aus einer Auswahl
--  oder eine eigene importieren, die direkt im Hub gilt. Die Auswahl
--  liegt unter omoteno.de/schriften/ (selbst ausgeliefert, keine
--  Google-Server). Eigene Dateien liegen hier, im Eimer „schriften“.
--  Welche Schrift gilt, steht in betriebe.hub_stil.schrift (keine neue
--  Spalte; hub_stil_form deckelt die Größe schon auf 1000 Bytes).
--
--  Regeln, bewusst enger als beim Bildereimer:
--    · öffentlich lesbar über die Adresse — der Hub lädt sie ohne
--      Anmeldung. KEINE Leseregel auf storage.objects: Wer die Adresse
--      nicht kennt, kann die Dateien nicht auflisten.
--    · hochladen nur angemeldet, nur in den Ordner eines EIGENEN
--      Betriebs (meine_betriebe(), hängt an der PIN), nur ein fester
--      Name: <betrieb-uuid>/<name>.<woff2|woff|ttf|otf>
--    · 1,5 MB, nur die vier Schrifttypen.
--  Der Cast auf uuid steht in einem CASE: AND wertet in SQL nicht
--  zwingend von links aus — ohne CASE könnte ein Ordnername wie „x“
--  mit einem Fehler statt mit „nein“ enden.
-- ═══════════════════════════════════════════════════════════════════
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('schriften', 'schriften', true, 1572864,
        array['font/woff2','font/woff','font/ttf','font/otf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "schriften team laedt hoch" on storage.objects;
create policy "schriften team laedt hoch" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'schriften'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,60}\.(woff2|woff|ttf|otf)$'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then ((storage.foldername(name))[1])::uuid in (select meine_betriebe())
             else false end
  );

commit;

-- Probe (zurückgedreht, 26.09.2026) — siehe datenbank/pruef-schriften.sql.
