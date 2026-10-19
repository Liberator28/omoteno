-- ═══════════════════════════════════════════════════════════════════
--  pruef-saalplan.sql · die Rechte auf public.tische (migration-saalplan.sql)
--  Läuft im SQL-Editor oder über das Werkzeug, dreht sich selbst zurück.
--  Gemessen wird mit Zeilenzahl, nicht mit der Ausnahme (§2.3b), und die
--  Voraussetzungen (wer ist Inhaber, wer fremd) werden VOR dem Rollenwechsel
--  bestimmt (§2.3b, zweiter Teil). Gelaufen live am 19.10.2026: Inhaber legt
--  Lage (1 Zeile); Nummer und Schlüssel ändern, Tisch anlegen und löschen
--  abgewiesen; x=101, nur x ohne y, Form „dreieck“ von der Schranke
--  abgewiesen; ein Fremder, der Team des Betriebs ist: sieht 20 Tische,
--  ändert 0 Zeilen.
-- ═══════════════════════════════════════════════════════════════════
begin;
create temp table probe(schritt text, ergebnis text);
grant all on probe to authenticated;
do $$
declare b uuid; inh uuid; fremd uuid; t uuid;
begin
  select betrieb_id into b from public.tische limit 1;
  select nutzer_id into inh   from public.betrieb_mitglieder where betrieb_id = b  and rolle = 'inhaber' limit 1;
  select nutzer_id into fremd from public.betrieb_mitglieder where betrieb_id <> b and rolle = 'inhaber' limit 1;
  select id into t from public.tische where betrieb_id = b order by nummer limit 1;
  insert into probe values ('Voraussetzung Inhaber', coalesce(inh::text, 'NULL'));
  insert into probe values ('Voraussetzung Fremder', coalesce(fremd::text, 'NULL'));
  perform set_config('probe.b', b::text, true);   perform set_config('probe.t', t::text, true);
  perform set_config('probe.inh', coalesce(inh::text, ''), true);
  perform set_config('probe.f', coalesce(fremd::text, ''), true);
  -- der Fremde wird für diese Transaktion Team des Betriebs (die Lese-Regel öffnet sich damit,
  -- sonst bliebe „0 Zeilen“ immer grün — nur die UPDATE-Regel darf es halten)
  insert into public.betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (b, fremd, 'team');
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('probe.inh'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare n int;
begin
  update public.tische set x = 10, y = 20, form = 'rund', plaetze = 4 where id = current_setting('probe.t')::uuid;
  get diagnostics n = row_count; insert into probe values ('Inhaber legt Lage (erwartet 1)', n::text);
  begin update public.tische set nummer = 'X' where id = current_setting('probe.t')::uuid; insert into probe values ('Inhaber ändert nummer', 'ERFOLG (falsch)');
  exception when others then insert into probe values ('Inhaber ändert nummer', 'abgewiesen'); end;
  begin update public.tische set schluessel = 'X' where id = current_setting('probe.t')::uuid; insert into probe values ('Inhaber ändert schluessel', 'ERFOLG (falsch)');
  exception when others then insert into probe values ('Inhaber ändert schluessel', 'abgewiesen'); end;
  begin update public.tische set x = 101, y = 5 where id = current_setting('probe.t')::uuid; insert into probe values ('x = 101', 'ERFOLG (falsch)');
  exception when others then insert into probe values ('x = 101', 'abgewiesen'); end;
  begin update public.tische set x = 5, y = null where id = current_setting('probe.t')::uuid; insert into probe values ('nur x ohne y', 'ERFOLG (falsch)');
  exception when others then insert into probe values ('nur x ohne y', 'abgewiesen'); end;
  begin update public.tische set form = 'dreieck' where id = current_setting('probe.t')::uuid; insert into probe values ('Form dreieck', 'ERFOLG (falsch)');
  exception when others then insert into probe values ('Form dreieck', 'abgewiesen'); end;
  begin insert into public.tische(betrieb_id, nummer, schluessel) values (current_setting('probe.b')::uuid, 'Z', 'Z'); insert into probe values ('Inhaber legt Tisch an', 'ERFOLG (falsch)');
  exception when others then insert into probe values ('Inhaber legt Tisch an', 'abgewiesen'); end;
  begin delete from public.tische where id = current_setting('probe.t')::uuid; insert into probe values ('Inhaber löscht Tisch', 'ERFOLG (falsch)');
  exception when others then insert into probe values ('Inhaber löscht Tisch', 'abgewiesen'); end;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('probe.f'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare n int;
begin
  insert into probe values ('Team sieht Tische des Betriebs (Voraussetzung, > 0)', (select count(*)::text from public.tische where betrieb_id = current_setting('probe.b')::uuid));
  update public.tische set x = 33, y = 33, form = 'rund', plaetze = 2 where id = current_setting('probe.t')::uuid;
  get diagnostics n = row_count; insert into probe values ('TEAM legt Lage (erwartet 0 Zeilen)', n::text);
end $$;
reset role;
select * from probe;
rollback;
