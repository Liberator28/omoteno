-- ═══════════════════════════════════════════════════════════════════
--  PRÜFUNG · migration-schriften.sql (Eimer „schriften“, Regeln)
--
--  Im SQL-Editor ausführen. Endet mit raise exception 'PROBE …' —
--  alles wird zurückgedreht. Schreibproben ohne returning, gemessen
--  an der Zeilenzahl bzw. der Ausnahme (§2.3b).
--
--  Erwartet (26.09.2026, gegen den echten Bestand, Mitglied von
--  chocolamour):
--    S0 die eigene Betriebs-uuid          S1 1 (eigener Ordner geht)
--    S2 abgewiesen (fremder Ordner)       S3 abgewiesen (.svg)
--    S4 abgewiesen (Ordner keine uuid — RLS, KEIN Cast-Fehler)
--    S5 abgewiesen (..)                   S6 abgewiesen (anonym)
--    S7 0 (keine Leseregel: niemand listet die Dateien auf)
--    S8 true 1572864 font/woff2,font/woff,font/ttf,font/otf
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(nr text, ergebnis text);
grant all on probe to anon, authenticated;
do $p$
declare n int; eigen uuid := 'af095b14-d9ef-41f4-9b97-c4422b0de63f'; fremd uuid := '03793490-635a-460a-ac61-b08bbd7fd5bf';
begin
  perform set_config('request.jwt.claims', json_build_object('sub','153c5425-cd7a-42e4-a629-38cee3524951','role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  insert into probe values ('S0 meine_betriebe als Mitglied', (select string_agg(x::text, ',') from meine_betriebe() x));
  begin insert into storage.objects(bucket_id, name, owner) values ('schriften', eigen || '/hausschrift.woff2', '153c5425-cd7a-42e4-a629-38cee3524951');
    get diagnostics n = row_count; insert into probe values ('S1 eigener Ordner', n::text);
  exception when others then insert into probe values ('S1 eigener Ordner', 'abgewiesen: '||sqlerrm); end;
  begin insert into storage.objects(bucket_id, name) values ('schriften', fremd || '/fremd.woff2');
    insert into probe values ('S2 fremder Ordner', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('S2 fremder Ordner', 'abgewiesen'); end;
  begin insert into storage.objects(bucket_id, name) values ('schriften', eigen || '/boese.svg');
    insert into probe values ('S3 falsche Endung', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('S3 falsche Endung', 'abgewiesen'); end;
  begin insert into storage.objects(bucket_id, name) values ('schriften', 'x/haus.woff2');
    insert into probe values ('S4 Ordner keine uuid', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('S4 Ordner keine uuid', 'abgewiesen: '||left(sqlerrm,40)); end;
  begin insert into storage.objects(bucket_id, name) values ('schriften', eigen || '/../x.woff2');
    insert into probe values ('S5 Pfad mit ..', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('S5 Pfad mit ..', 'abgewiesen'); end;
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  perform set_config('role','anon', true);
  begin insert into storage.objects(bucket_id, name) values ('schriften', eigen || '/anon.woff2');
    insert into probe values ('S6 anonym', 'DURCH (FEHLER)');
  exception when others then insert into probe values ('S6 anonym', 'abgewiesen'); end;
  perform set_config('role','postgres', true);
  insert into probe values ('S7 Leseregel fuer schriften', (select count(*)::text from pg_policies where schemaname='storage' and tablename='objects' and cmd in ('SELECT','ALL') and coalesce(qual,'') like '%schriften%'));
  insert into probe values ('S8 Eimer', (select public::text||' '||file_size_limit||' '||array_to_string(allowed_mime_types,',') from storage.buckets where id='schriften'));
end $p$;
do $e$ declare t text; begin select string_agg(nr||' → '||ergebnis, E'\n' order by nr) into t from probe; raise exception E'PROBE\n%', t; end $e$;
