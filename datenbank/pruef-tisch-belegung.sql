-- pruef-tisch-belegung.sql · Rechte und Grenzen von migration-tisch-belegung.sql
-- Zurückgedreht. Zeilenzahl statt Ausnahme (§2.3b), Voraussetzungen VOR dem Rollenwechsel (§2.3b),
-- die meisten Proben rufen mit UNGÜLTIGEN Werten (§2.3g), und der ZWEITE Durchgang auf denselben Tisch
-- ist Teil der Probe (§1.1a). Lauf: pruefungen/pruef-saalplan-lokal.sh (lokales Postgres 16).
begin;
create temp table probe(schritt text, ergebnis text);
grant all on probe to authenticated, anon;
do $$
declare b uuid; b2 uuid; inh uuid; team uuid; fremd uuid := '33333333-3333-3333-3333-333333333333'; t1 uuid; t2 uuid;
begin
  select betrieb_id into b from public.tische where nummer = '20' limit 1;
  select id into b2 from public.betriebe where id <> b limit 1;
  select nutzer_id into inh  from public.betrieb_mitglieder where betrieb_id = b  and rolle = 'inhaber' limit 1;
  select nutzer_id into team from public.betrieb_mitglieder where betrieb_id = b2 and rolle = 'inhaber' limit 1;
  insert into auth.users(id, email) values (fremd, 'fremd@probe.invalid') on conflict do nothing;
  insert into public.betrieb_mitglieder(betrieb_id, nutzer_id, rolle) values (b, team, 'team');
  select id into t1 from public.tische where betrieb_id = b and nummer = '1';
  select id into t2 from public.tische where betrieb_id = b and nummer = '2';
  insert into public.tisch_sitzungen(token, betrieb_id, tisch_id, gueltig_bis, letzte_aktivitaet) values
    ('geheim-1', b, t1, now() + interval '20 minutes', now() - interval '3 minutes'),
    ('geheim-2', b, t2, now() - interval '5 minutes',  now() - interval '50 minutes');
  perform set_config('probe.b', b::text, true); perform set_config('probe.b2', b2::text, true);
  perform set_config('probe.inh', inh::text, true); perform set_config('probe.team', team::text, true);
  perform set_config('probe.fremd', fremd::text, true);
  insert into probe values ('TB00 Voraussetzung', (b is not null and b2 is not null and inh is not null and team is not null and t1 is not null and t2 is not null)::text);
end $$;

-- ── Inhaber ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('probe.inh'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare b uuid := current_setting('probe.b')::uuid; r jsonb;
begin
  r := public.tisch_belegung_setzen(b, '1', 4, 'da');       insert into probe values ('TB01 Inhaber setzt 4 an Tisch 1', (r->>'ok') || '/' || (r->>'personen'));
end $$;
-- now() steht in einer Transaktion still: „seit“ wird als Superuser eine Stunde zurückgesetzt, sonst wären
-- „bleibt“ und „beginnt neu“ ununterscheidbar (§8.1g).
reset role;
update public.tisch_belegung set seit = now() - interval '1 hour' where tisch_nummer = '1';
set local role authenticated;
do $$
declare b uuid := current_setting('probe.b')::uuid; r jsonb;
begin
  r := public.tisch_belegung_setzen(b, '1', 3, 'zahlt');    insert into probe values ('TB02 zweiter Durchgang: 3, zahlt', (r->>'ok') || '/' || (r->>'personen') || '/' || (r->>'stand'));
  insert into probe values ('TB05 seit bleibt beim zweiten Durchgang', ((r->>'seit')::timestamptz < now() - interval '50 minutes')::text);
end $$;
-- Nachmessen in einer EIGENEN Anweisung (§8.1l, Schnappschuss)
insert into probe select 'TB03 eine Zeile je Tisch (zweiter Durchgang überschreibt)', count(*)::text from public.tisch_belegung where tisch_nummer = '1';
insert into probe select 'TB04 gespeichert: 3 Personen', personen::text from public.tisch_belegung where tisch_nummer = '1';
do $$
declare b uuid := current_setting('probe.b')::uuid; r jsonb;
begin
  r := public.tisch_belegung_setzen(b, '1', 3, 'frei');     insert into probe values ('TB06 frei setzt Personen auf 0', (r->>'personen'));
end $$;
reset role;
update public.tisch_belegung set seit = now() - interval '1 hour' where tisch_nummer = '1';
set local role authenticated;
do $$
declare b uuid := current_setting('probe.b')::uuid; r jsonb;
begin
  r := public.tisch_belegung_setzen(b, '1', 2, 'da');
  insert into probe values ('TB07 wieder besetzt: seit beginnt neu', ((r->>'seit')::timestamptz >= now())::text);
  r := public.tisch_belegung_setzen(b, '99', 2, 'da');      insert into probe values ('TB10 unbekannter Tisch', r::text);
  r := public.tisch_belegung_setzen(b, null, 2, 'da');      insert into probe values ('TB10b Tisch null', r::text);
  r := public.tisch_belegung_setzen(current_setting('probe.b2')::uuid, '1', 2, 'da'); insert into probe values ('TB11 Tisch im fremden Betrieb', r::text);
  r := public.tisch_belegung_setzen(b, '1', 41, 'da');      insert into probe values ('TB12 41 Personen', r::text);
  r := public.tisch_belegung_setzen(b, '1', -1, 'da');      insert into probe values ('TB13 -1 Personen', r::text);
  r := public.tisch_belegung_setzen(b, '1', null, 'da');    insert into probe values ('TB14 Personen null', r::text);
  r := public.tisch_belegung_setzen(b, '1', 2, 'weg');      insert into probe values ('TB15 Stand weg', r::text);
  r := public.tisch_belegung_setzen(b, '1', 2, null);       insert into probe values ('TB16 Stand null', r::text);
  r := public.tisch_belegung_setzen(b, '1'' or ''1''=''1', 2, 'da'); insert into probe values ('TB17 Tisch mit Anführungszeichen', r::text);
end $$;
insert into probe select 'TB18 Stand nach allen Abweisungen unverändert', personen || '/' || stand from public.tisch_belegung where tisch_nummer = '1';
do $$ begin
  begin insert into public.tisch_belegung(betrieb_id, tisch_nummer, personen) values (current_setting('probe.b')::uuid, '2', 5);
        insert into probe values ('TB21 direkt einfügen', 'durch'); exception when others then insert into probe values ('TB21 direkt einfügen', 'abgewiesen'); end;
  begin update public.tisch_belegung set personen = 9 where tisch_nummer = '1';
        insert into probe values ('TB22 direkt ändern', 'durch'); exception when others then insert into probe values ('TB22 direkt ändern', 'abgewiesen'); end;
end $$;
insert into probe select 'TB50 Anwesenheit Tisch 1 offen', offen::text from public.saal_anwesenheit(current_setting('probe.b')::uuid) where tisch_nummer = '1';
insert into probe select 'TB51 Anwesenheit Tisch 2 abgelaufen', offen::text from public.saal_anwesenheit(current_setting('probe.b')::uuid) where tisch_nummer = '2';
insert into probe select 'TB52 Anwesenheit nur Tische mit Sitzung', count(*)::text from public.saal_anwesenheit(current_setting('probe.b')::uuid);
insert into probe select 'TB53 Anwesenheit eines fremden Betriebs', count(*)::text from public.saal_anwesenheit(current_setting('probe.b2')::uuid);
reset role;

-- ── Team (Kellner) ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('probe.team'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.tisch_belegung_setzen(current_setting('probe.b')::uuid, '2', 5, 'da'); insert into probe values ('TB20 Team trägt Personen ein', (r->>'ok'));
end $$;
insert into probe select 'TB23 Team liest die Belegung', count(*)::text from public.tisch_belegung;
reset role;

-- ── Fremder (Mitglied keines Betriebs) ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('probe.fremd'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into probe select 'TB31 Fremder liest Belegung (erwartet 0)', count(*)::text from public.tisch_belegung;
do $$
declare r jsonb;
begin
  r := public.tisch_belegung_setzen(current_setting('probe.b')::uuid, '1', 2, 'da'); insert into probe values ('TB32 Fremder setzt', r::text);
end $$;
insert into probe select 'TB33 Fremder liest Anwesenheit (erwartet 0)', count(*)::text from public.saal_anwesenheit(current_setting('probe.b')::uuid);
reset role;

-- ── anon ──
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  begin perform public.tisch_belegung_setzen(current_setting('probe.b')::uuid, '1', 2, 'da');
        insert into probe values ('TB40 anon setzt', 'durch'); exception when others then insert into probe values ('TB40 anon setzt', 'abgewiesen'); end;
  begin perform count(*) from public.tisch_belegung;
        insert into probe values ('TB41 anon liest', 'durch'); exception when others then insert into probe values ('TB41 anon liest', 'abgewiesen'); end;
  begin perform count(*) from public.saal_anwesenheit(current_setting('probe.b')::uuid);
        insert into probe values ('TB42 anon Anwesenheit', 'durch'); exception when others then insert into probe values ('TB42 anon Anwesenheit', 'abgewiesen'); end;
end $$;
reset role;

-- ── Katalog ──
insert into probe select 'TB60 genau eine Fassung tisch_belegung_setzen', count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'tisch_belegung_setzen';
insert into probe select 'TB61 genau eine Fassung saal_anwesenheit', count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'saal_anwesenheit';
insert into probe select 'TB62 Rückgabe ohne Token', (not exists (select 1 from pg_proc p where p.proname = 'saal_anwesenheit' and pg_get_function_result(p.oid) ilike '%token%'))::text;
insert into probe select 'TB63 authenticated darf nicht schreiben', (not has_table_privilege('authenticated', 'public.tisch_belegung', 'INSERT') and not has_table_privilege('authenticated', 'public.tisch_belegung', 'UPDATE') and not has_table_privilege('authenticated', 'public.tisch_belegung', 'DELETE'))::text;

select schritt || '|' || coalesce(ergebnis, 'NULL') from probe order by schritt;
rollback;
