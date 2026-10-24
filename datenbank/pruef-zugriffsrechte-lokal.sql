-- pruef-zugriffsrechte-lokal.sql · Wer darf welche Finanzzahl lesen, wer darf Rechte vergeben, wer sieht Teamziele?
-- Läuft NUR lokal (pruefungen/pruef-zugriffsrechte-lokal.sh), NACH migration-zugriffsrechte.sql und -scharf.sql, mit den ECHTEN
-- Funktionen und Lese-Regeln der Einkaufsseite. Alles in einer zurückgedrehten Transaktion; Zeile je Probe: Name|Ergebnis.
-- Regeln (CLAUDE.md §2.3b/§2.4): Schreibtest ohne returning, Zeilenzahl statt Ausnahme, Voraussetzungen (Mitgliedschaft,
-- „die Zeile EXISTIERT“) selbst gemessen, Rollen wie PostgREST (jwt-Claims + set role).
begin;
create temp table probe(schritt text, ergebnis text);
grant all on probe to authenticated, anon;
create function pg_temp.als(p_nutzer uuid, p_sitzung text default 's') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_nutzer, 'role', 'authenticated', 'session_id', p_sitzung)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
-- Was sieht dieses Konto, gezählt über ALLE Tabellen der Einkaufsseite (die Regel entscheidet, welche Zeilen).
create function public.zz_sicht(p_betrieb uuid) returns text language sql stable security invoker set search_path = public as $$
  select concat_ws(' ',
    'belege='||(select count(*) from public.einkaufsbelege),
    'pos='   ||(select count(*) from public.einkaufspositionen),
    'lager=' ||(select count(*) from public.lagerbewegungen),
    'inv='   ||(select count(*) from public.inventuren),
    'rez='   ||(select count(*) from public.rezepturen),
    'rezpos='||(select count(*) from public.rezepturpositionen),
    'per='   ||(select count(*) from public.einkauf_perioden),
    'uml='   ||(select count(*) from public.umlagerungen),
    'umlpos='||(select count(*) from public.umlagerungspositionen),
    'stor='  ||(select count(*) from storage.objects where bucket_id = 'belege'),
    'ap='    ||(select count(*) from public.artikel_preise),
    'kosten='||(select count(*) from public.gericht_kosten_portion('0e000000-0000-0000-0000-00000000000a') where kosten is not null),
    'kalk='  ||(select count(*) from public.gericht_kalkulation(p_betrieb)),
    'we='    ||coalesce((public.wareneinsatz_theoretisch(p_betrieb, now() - interval '2 days', now() + interval '1 day') ->> 'positionen'), 'null'))
$$;

-- ════ K · Katalog (Rechte, Schranken, Funktionen) ═════════════════════════════════════
insert into probe select 'K1 Schranke der Rollen nennt manager UND jeden alten Wert',
  (select (d like '%''manager''%' and d like '%''inhaber''%' and d like '%''team''%' and d like '%''kueche''%')::text
     from (select pg_get_constraintdef(oid) d from pg_constraint where conrelid='public.betrieb_mitglieder'::regclass and conname='betrieb_mitglieder_rolle_check') x);
insert into probe select 'K2 anon hat auf KEINE neue Funktion EXECUTE',
  (select bool_and(not has_function_privilege('anon', p.oid, 'execute'))::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('hat_recht','meine_rechte','rechte_wirksam','team_rechte_setzen','team_rechte_liste','team_rechte_verlauf',
      'teamziel_speichern','teamziel_freigeben','teamziel_archivieren','teamaufgabe_haken','teamziele_stand','finanz_export_belege','teamziel_nachziehen','mitglied_rechte_wache'));
insert into probe select 'K3 teamziel_nachziehen und die Wache sind für authenticated KEIN Endpunkt',
  (select bool_and(not has_function_privilege('authenticated', p.oid, 'execute'))::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('teamziel_nachziehen','mitglied_rechte_wache'));
insert into probe select 'K4 authenticated darf Ziele/Aufgaben/Erfolge/Protokoll NICHT schreiben (kein einziges Schreibrecht)',
  (select (not (has_table_privilege('authenticated','public.team_ziele','INSERT') or has_table_privilege('authenticated','public.team_ziele','UPDATE') or has_table_privilege('authenticated','public.team_ziele','DELETE')
           or has_table_privilege('authenticated','public.team_aufgaben','INSERT') or has_table_privilege('authenticated','public.team_aufgaben','UPDATE') or has_table_privilege('authenticated','public.team_aufgaben','DELETE')
           or has_table_privilege('authenticated','public.team_erfolge','INSERT') or has_table_privilege('authenticated','public.team_erfolge','UPDATE') or has_table_privilege('authenticated','public.team_erfolge','DELETE')
           or has_table_privilege('authenticated','public.rechte_protokoll','SELECT') or has_table_privilege('authenticated','public.rechte_protokoll','INSERT')))::text);
insert into probe select 'K5 anon liest keine Einkaufs-, Ziel- oder Rechte-Tabelle',
  (select bool_and(not has_table_privilege('anon', c, 'SELECT'))::text from unnest(array['public.einkaufsbelege','public.einkaufspositionen','public.lagerbewegungen','public.inventuren',
    'public.rezepturen','public.rezepturpositionen','public.einkauf_perioden','public.umlagerungen','public.umlagerungspositionen','public.lieferanten_artikel','public.team_ziele','public.team_aufgaben','public.team_erfolge','public.rechte_protokoll']) c);
insert into probe select 'K6 genau EINE Fassung je neuer Funktion (§2.1)',
  (select count(*)::text from (select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('hat_recht','meine_rechte','rechte_wirksam','rechte_katalog','rechte_form_ok','team_rechte_setzen','team_rechte_liste','team_rechte_verlauf',
      'teamziel_speichern','teamziel_freigeben','teamziel_archivieren','teamaufgabe_haken','teamziele_stand','finanz_export_belege','teamziel_nachziehen') group by 1 having count(*) <> 1) x);
insert into probe select 'K7 Katalog: sieben Rechte, davon genau ein Standard-Recht des Managers',
  (select count(*)||'/'||count(*) filter (where standard_manager) from public.rechte_katalog());
insert into probe select 'K8 rechte_form_ok: unbekanntes Recht abgewiesen', public.rechte_form_ok('{"gewinn":true}'::jsonb)::text;
insert into probe select 'K9 rechte_form_ok: Zeichenkette statt boolean abgewiesen', public.rechte_form_ok('{"kosten_view":"ja"}'::jsonb)::text;
insert into probe select 'K10 rechte_form_ok: Liste statt Objekt abgewiesen', public.rechte_form_ok('[]'::jsonb)::text;
insert into probe select 'K11 rechte_form_ok: gültige Form angenommen', public.rechte_form_ok('{"kosten_view":true,"ziele_edit":false}'::jsonb)::text;
do $$ begin
  begin update public.betrieb_mitglieder set rechte = '{"gewinn":true}'::jsonb where nutzer_id = '22222222-2222-2222-2222-222222222221';
        insert into probe values ('K12 Schranke auf der Spalte weist ein erfundenes Recht ab','ERFOLG (falsch)');
  exception when check_violation then insert into probe values ('K12 Schranke auf der Spalte weist ein erfundenes Recht ab','abgewiesen'); end;
end $$;
insert into probe select 'K13 Anhäufung: jede Lese-Regel (SELECT/ALL) der zehn Tabellen trägt hat_recht (keine alte „true“-Regel daneben)',
  (select count(*)::text from pg_policies where schemaname='public' and cmd in ('SELECT','ALL')
     and tablename in ('einkaufsbelege','einkaufspositionen','lagerbewegungen','inventuren','rezepturen','rezepturpositionen','einkauf_perioden','umlagerungen','umlagerungspositionen')
     and coalesce(qual,'') not like '%hat_recht%');
insert into probe select 'K14 Belegfotos: die Regel im Speicher trägt hat_recht',
  (select (count(*) = 1 and bool_and(qual like '%hat_recht%'))::text from pg_policies where schemaname='storage' and tablename='objects' and policyname='belege mitglied liest');
insert into probe select 'K15 Anhäufung: auf storage.objects keine zweite Lese-Regel für den Eimer „belege“',
  (select count(*)::text from pg_policies where schemaname='storage' and tablename='objects' and cmd in ('SELECT','ALL'));
insert into probe select 'K17 Preise der Lieferanten: authenticated liest lieferanten_artikel.letzter_preis nicht (Spaltenrecht aus E4, kein Fall für Teil B)', (not has_column_privilege('authenticated','public.lieferanten_artikel','letzter_preis','select'))::text;
insert into probe select 'K16 beide Kalkulations-Funktionen prüfen hat_recht',
  (select bool_and(prosrc like '%hat_recht%')::text from pg_proc where proname in ('gericht_kalkulation','wareneinsatz_theoretisch'));

-- ════ W · wirksame Rechte (reine Rechnung) ═════════════════════════════════════════════
create function pg_temp.w(p_rolle text, p_rechte jsonb) returns text language sql stable as $$
  select string_agg(key||'='||(case when value::boolean then 'ja' else 'nein' end), ' ' order by key) from jsonb_each_text(public.rechte_wirksam(p_rolle, p_rechte)) $$;
insert into probe select 'W1 Manager ohne Angabe: nur die Tageszahlen', pg_temp.w('manager', '{}');
insert into probe select 'W2 Manager mit Finanzexport OHNE Einkauf und Kalkulation: Export bleibt aus', pg_temp.w('manager', '{"finanz_export":true}');
insert into probe select 'W3 Team mit allem „ja“ in der Spalte: nichts', pg_temp.w('team', '{"kosten_view":true,"finanz_export":true,"ziele_edit":true}');
insert into probe select 'W4 Küche: nichts', pg_temp.w('kueche', '{"kosten_view":true}');
insert into probe select 'W5 unbekannte Rolle: nichts', pg_temp.w('chef', '{"kosten_view":true}');
insert into probe select 'W6 Inhaber: alles', pg_temp.w('inhaber', '{}');
insert into probe select 'W7 Manager darf Tageszahlen auch ausdrücklich verlieren', pg_temp.w('manager', '{"kennzahlen_tag":false,"kosten_view":true}');

-- ════ I · Inhaber (A) ═══════════════════════════════════════════════════════════════
select pg_temp.als('11111111-1111-1111-1111-111111111111');
insert into probe select 'I1 Voraussetzung: Inhaber ist Mitglied und sieht seinen Betrieb (erwartet 1)', (select count(*) from public.betriebe where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into probe select 'I2 Inhaber sieht Einkauf/Lager/Rezeptur/Kalkulation/Belegfotos NUR des eigenen Betriebs', public.zz_sicht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into probe select 'I3 Inhaber: kosten_view', public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','kosten_view')::text;
insert into probe select 'I4 Inhaber: erfundenes Recht „gewinn“ gibt es nicht', public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','gewinn')::text;
insert into probe select 'I5 Inhaber A hat in Betrieb B kein Recht', public.hat_recht('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','kosten_view')::text;
insert into probe select 'I6 Betrieb NULL und Recht NULL: false', (public.hat_recht(null,'kosten_view') or public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null))::text;
insert into probe select 'I7 Finanzexport des Inhabers: ok, eine Zeile', (select (r->>'ok')||'/'||jsonb_array_length(r->'zeilen') from (select public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 5, current_date) r) x);
insert into probe select 'I8 Finanzexport fremder Betrieb: kein_recht', (public.finanz_export_belege('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', current_date - 5, current_date)->>'grund');
insert into probe select 'I9 Zeitraum falsch herum: zeitraum', (public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date, current_date - 5)->>'grund');
insert into probe select 'I10 Zeitraum über 400 Tage: zeitraum', (public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 401, current_date)->>'grund');
insert into probe select 'I11 Zeitraum NULL: zeitraum', (public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, current_date)->>'grund');
insert into probe select 'I12 meine_rechte: Rolle und kosten_view', (select (r->>'rolle')||'/'||(r->'rechte'->>'kosten_view') from (select public.meine_rechte('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') r) x);
insert into probe select 'I13 Liste „Dein Team“: sieben Konten, Reihenfolge Inhaber zuerst', (select count(*)||'/'||(array_agg(rolle order by ord))[1] from (select *, row_number() over () ord from public.team_rechte_liste('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) x);
do $$ declare n int; begin
  begin update public.betrieb_mitglieder set rechte = '{"kosten_view":true}'::jsonb where nutzer_id = '22222222-2222-2222-2222-222222222221';
        get diagnostics n = row_count; insert into probe values ('I14 Inhaber schreibt direkt in betrieb_mitglieder.rechte (nur über die Funktion)','ERFOLG ('||n||' Zeilen, falsch)');
  exception when sqlstate '42501' then insert into probe values ('I14 Inhaber schreibt direkt in betrieb_mitglieder.rechte (nur über die Funktion)','abgewiesen'); end;
  begin insert into public.team_ziele(betrieb_id, titel) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Direkt');
        insert into probe values ('I15 Inhaber schreibt direkt in team_ziele','ERFOLG (falsch)');
  exception when sqlstate '42501' then insert into probe values ('I15 Inhaber schreibt direkt in team_ziele','abgewiesen'); end;
end $$;
reset role;

-- ════ M · Manager ohne zusätzliche Rechte (A) ═════════════════════════════════════════
select pg_temp.als('22222222-2222-2222-2222-222222222221');
insert into probe select 'M0 Voraussetzung: Manager ist Mitglied und sieht den Betrieb (erwartet 1)', (select count(*) from public.betriebe where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into probe select 'M1 Manager sieht standardmäßig KEINE Einkaufs-/Lager-/Rezeptur-/Kalkulationszahl, kein Belegfoto', public.zz_sicht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into probe select 'M2 Manager: Tageszahlen ja', public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','kennzahlen_tag')::text;
insert into probe select 'M3 Manager: kosten_view nein', public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','kosten_view')::text;
insert into probe select 'M4 Manager: Berichte/Export/Finanzexport/Ziele nein', (select count(*) filter (where public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', r))::text from unnest(array['berichte_view','berichte_export','finanz_export','ziele_edit','ziele_approve']) r);
insert into probe select 'M5 Finanzexport ohne Recht: kein_recht', (public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 5, current_date)->>'grund');
insert into probe select 'M6 Rechte vergeben: kein_inhaber (auch für ein anderes Konto)', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','kosten_view', false)->>'grund');
insert into probe select 'M7 Rechte vergeben: kein_inhaber (für sich selbst heraufsetzen)', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','kosten_view', true)->>'grund');
insert into probe select 'M8 Liste „Dein Team“ und Verlauf: leer', (select count(*) from public.team_rechte_liste('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))||'/'||(select count(*) from public.team_rechte_verlauf('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
insert into probe select 'M9 Bestelldaten bleiben lesbar (Küche und Board brauchen die Bons) — der Befund, kein Fehler', (select count(*)::text from public.bestellungen where betrieb_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
do $$ declare n int; begin
  begin update public.betrieb_mitglieder set rechte = '{"kosten_view":true}'::jsonb where nutzer_id = '22222222-2222-2222-2222-222222222221';
        get diagnostics n = row_count; insert into probe values ('M10 Manager schreibt die eigenen Rechte direkt','ERFOLG ('||n||' Zeilen, falsch)');
  exception when sqlstate '42501' then insert into probe values ('M10 Manager schreibt die eigenen Rechte direkt','abgewiesen'); end;
  begin update public.betrieb_mitglieder set rolle = 'inhaber' where nutzer_id = '22222222-2222-2222-2222-222222222221';
        get diagnostics n = row_count; insert into probe values ('M11 Manager macht sich zum Inhaber','ERFOLG ('||n||' Zeilen, falsch)');
  exception when sqlstate '42501' then insert into probe values ('M11 Manager macht sich zum Inhaber','abgewiesen'); end;
end $$;
reset role;

-- ════ F · Manager mit „Einkauf und Kalkulation“ (A) ═══════════════════════════════════
select pg_temp.als('22222222-2222-2222-2222-222222222222');
insert into probe select 'F1 Manager mit kosten_view sieht seinen Betrieb A — und nur den', public.zz_sicht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into probe select 'F2 kosten_view allein gibt keinen Export', (public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 5, current_date)->>'grund');
insert into probe select 'F3 und keine Rechtevergabe', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','kosten_view', true)->>'grund');
insert into probe select 'F4 und keine Ziele', public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ziele_edit')::text;
reset role;

-- ════ T · Team, Küche, Lager (A): Spalte vergiftet, nichts wirkt ═════════════════════════
select pg_temp.als('33333333-3333-3333-3333-333333333331');
insert into probe select 'T0 Voraussetzung: die Spalte des Teams trägt kosten_view (Vergiftung angekommen, erwartet 1)', (select count(*) from public.betrieb_mitglieder where nutzer_id='33333333-3333-3333-3333-333333333331' and (rechte->>'kosten_view')::boolean) || '';
insert into probe select 'T1 Team: Betrieb sichtbar (erwartet 1)', (select count(*) from public.betriebe where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into probe select 'T2 Team (Spalte vergiftet) sieht keine Finanzzahl', public.zz_sicht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into probe select 'T3 Team: kein einziges Recht', (select count(*) filter (where public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', recht))::text from public.rechte_katalog());
insert into probe select 'T4 Team: meine_rechte zeigt Rolle team und nichts erlaubt', (select (r->>'rolle')||'/'||(select count(*) from jsonb_each_text(r->'rechte') where value='true') from (select public.meine_rechte('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') r) x);
insert into probe select 'T5 Team: Finanzexport kein_recht', (public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 5, current_date)->>'grund');
insert into probe select 'T6 Team: Ziel anlegen kein_recht (trotz „ziele_edit“ in der Spalte)', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'Heimlich', null, null, '[{"titel":"x"}]'::jsonb)->>'grund');
reset role;
select pg_temp.als('33333333-3333-3333-3333-333333333332');
insert into probe select 'T7 Küche (Spalte vergiftet) sieht keine Finanzzahl', public.zz_sicht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into probe select 'T8 Küche: Bons weiter lesbar (erwartet 1)', (select count(*) from public.bestellungen where betrieb_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
reset role;
select pg_temp.als('33333333-3333-3333-3333-333333333333');
insert into probe select 'T9 Lager-Mitglied: Lagerwerte bleiben (vom Inhaber vergeben), sonst nichts', public.zz_sicht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into probe select 'T10 Lager-Mitglied: kosten_view nein', public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','kosten_view')::text;
reset role;

-- ════ X · Fremde und Ketten ═══════════════════════════════════════════════════════════
select pg_temp.als('44444444-4444-4444-4444-444444444444');
insert into probe select 'X1 Inhaber B sieht NUR B (Belege, Positionen, Lager … dort eine Zeile)', public.zz_sicht('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into probe select 'X2 Inhaber B fragt die Kalkulation von A: nichts', (select count(*) from public.gericht_kalkulation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))::text;
insert into probe select 'X3 Inhaber B: Finanzexport A kein_recht', (public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 5, current_date)->>'grund');
insert into probe select 'X4 Inhaber B vergibt Rechte in A: kein_inhaber', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','kosten_view', true)->>'grund');
insert into probe select 'X5 Inhaber B vergibt in B an ein Konto aus A: kein_mitglied', (public.team_rechte_setzen('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222221','kosten_view', true)->>'grund');
insert into probe select 'X6 Inhaber B liest Liste und Verlauf von A: leer', (select count(*) from public.team_rechte_liste('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))||'/'||(select count(*) from public.team_rechte_verlauf('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
reset role;
select pg_temp.als('55555555-5555-5555-5555-555555555555');
insert into probe select 'X7 Manager B (kosten_view in B) sieht A nicht, B ja', public.zz_sicht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into probe select 'X8 Manager B: dieselbe Rechnung für den eigenen Betrieb', public.zz_sicht('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into probe select 'X9 Manager B: kosten_view in A nein, in B ja', public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','kosten_view')::text||'/'||public.hat_recht('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','kosten_view')::text;
reset role;
select pg_temp.als('77777777-7777-7777-7777-777777777777');
insert into probe select 'X10 Manager einer Kette (nur Standort C, kosten_view): Umlagerung C→D, Belege nur von C', public.zz_sicht('cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into probe select 'X11 derselbe Manager: kein Recht an Standort D', public.hat_recht('cccccccc-cccc-cccc-cccc-cccccccccccc','kosten_view')::text||'/'||public.hat_recht('dddddddd-dddd-dddd-dddd-dddddddddddd','kosten_view')::text;
reset role;
select pg_temp.als('66666666-6666-6666-6666-666666666666');
insert into probe select 'X12 Inhaber beider Standorte sieht beide Belege (zwei) und die Umlagerung', public.zz_sicht('cccccccc-cccc-cccc-cccc-cccccccccccc');
reset role;
select pg_temp.als('99999999-9999-9999-9999-999999999999');
insert into probe select 'X13 Master: alles, jeder Betrieb (vier Belege), Recht in jedem Betrieb', public.zz_sicht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')||' '||public.hat_recht('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','finanz_export')::text;
reset role;

-- ════ P · PIN-pflichtiger Betrieb (E) ═════════════════════════════════════════════════
select pg_temp.als('88888888-8888-8888-8888-888888888888', 'ohne-pin');
insert into probe select 'P1 Manager im PIN-Haus OHNE PIN-Sitzung: kein Recht, nicht einmal die Tageszahlen', public.hat_recht('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','kennzahlen_tag')::text||'/'||public.hat_recht('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','kosten_view')::text;
reset role;
select pg_temp.als('88888888-8888-8888-8888-888888888888', 'sE');
insert into probe select 'P2 derselbe MIT PIN-Sitzung: Tageszahlen und kosten_view', public.hat_recht('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','kennzahlen_tag')::text||'/'||public.hat_recht('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','kosten_view')::text;
reset role;
select pg_temp.als('88888888-8888-8888-8888-888888888889', 'ohne-pin');
insert into probe select 'P3 Inhaber im PIN-Haus OHNE PIN-Sitzung: kein Recht, keine Rechtevergabe', public.hat_recht('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','kosten_view')::text||'/'||(public.team_rechte_setzen('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','88888888-8888-8888-8888-888888888888','berichte_view', true)->>'grund');
reset role;
select pg_temp.als('88888888-8888-8888-8888-888888888889', 'sE');
insert into probe select 'P4 Inhaber MIT PIN-Sitzung: darf', public.hat_recht('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','kosten_view')::text||'/'||(public.team_rechte_setzen('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','88888888-8888-8888-8888-888888888888','berichte_view', true)->>'ok');
reset role;

-- ════ A · anon ═════════════════════════════════════════════════════════════════════════
set local role anon;
do $$ begin
  begin perform public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','kennzahlen_tag'); insert into probe values ('A1 anon ruft hat_recht','ERFOLG (falsch)');
  exception when sqlstate '42501' then insert into probe values ('A1 anon ruft hat_recht','abgewiesen'); end;
  begin perform public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 5, current_date); insert into probe values ('A2 anon ruft den Finanzexport','ERFOLG (falsch)');
  exception when sqlstate '42501' then insert into probe values ('A2 anon ruft den Finanzexport','abgewiesen'); end;
  begin perform count(*) from public.einkaufsbelege; insert into probe values ('A3 anon liest Einkaufsbelege','ERFOLG (falsch)');
  exception when sqlstate '42501' then insert into probe values ('A3 anon liest Einkaufsbelege','abgewiesen'); end;
  begin perform public.teamziele_stand('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'); insert into probe values ('A4 anon liest Teamziele','ERFOLG (falsch)');
  exception when sqlstate '42501' then insert into probe values ('A4 anon liest Teamziele','abgewiesen'); end;
  begin perform public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','kosten_view', true); insert into probe values ('A5 anon vergibt Rechte','ERFOLG (falsch)');
  exception when sqlstate '42501' then insert into probe values ('A5 anon vergibt Rechte','abgewiesen'); end;
end $$;
reset role;

-- ════ S · Rechte vergeben, widerrufen, protokollieren ═════════════════════════════════
select pg_temp.als('11111111-1111-1111-1111-111111111111');
insert into probe select 'S1 Inhaber schaltet kosten_view für Mia frei (ok, Recht wirksam)', (select (r->>'ok')||'/'||(r->'rechte'->>'kosten_view')||'/'||(r->'eigene'->>'kosten_view') from (select public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','kosten_view', true) r) x);
insert into probe select 'S2 unbekanntes Recht: recht_unbekannt', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','gewinn', true)->>'grund');
insert into probe select 'S3 Recht als Einschleusung: recht_unbekannt', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','kosten_view"}'' or true --', true)->>'grund');
insert into probe select 'S4 für sich selbst: selbst', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','kosten_view', true)->>'grund');
insert into probe select 'S5 für ein Team-Konto: kein_manager', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333331','kosten_view', true)->>'grund');
insert into probe select 'S6 für ein fremdes Konto: kein_mitglied', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','44444444-4444-4444-4444-444444444444','kosten_view', true)->>'grund');
insert into probe select 'S7 Wert fehlt: wert', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','kosten_view', null)->>'grund');
insert into probe select 'S8 im fremden Betrieb B: kein_inhaber', (public.team_rechte_setzen('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','55555555-5555-5555-5555-555555555555','kosten_view', false)->>'grund');
insert into probe select 'S9 Verlauf zeigt genau die EINE erfolgreiche Änderung, mit Namen statt Kennung', (select count(*)||'/'||min(von_name)||'/'||min(ziel_name)||'/'||min(recht) from public.team_rechte_verlauf('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
reset role;
-- Widerruf gilt sofort für eine schon angemeldete Sitzung: dieselben Claims, vorher/nachher.
select pg_temp.als('22222222-2222-2222-2222-222222222221');
insert into probe select 'S10 Mia (angemeldet, freigeschaltet) sieht Belege', (select count(*) from public.einkaufsbelege);
reset role;
select pg_temp.als('11111111-1111-1111-1111-111111111111');
insert into probe select 'S11 Inhaber nimmt kosten_view zurück (ok)', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','kosten_view', false)->>'ok');
reset role;
select pg_temp.als('22222222-2222-2222-2222-222222222221');
insert into probe select 'S12 DIESELBE Sitzung danach: keine Belege, keine Kalkulation', public.zz_sicht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
reset role;
-- Finanzexport nur zusammen mit kosten_view
select pg_temp.als('11111111-1111-1111-1111-111111111111');
insert into probe select 'S13 Inhaber schaltet NUR finanz_export für Mia an (ok)', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','finanz_export', true)->>'ok');
reset role;
select pg_temp.als('22222222-2222-2222-2222-222222222221');
insert into probe select 'S14 Mia: finanz_export ohne kosten_view wirkt nicht', public.hat_recht('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','finanz_export')::text||'/'||(public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 5, current_date)->>'grund');
reset role;
select pg_temp.als('11111111-1111-1111-1111-111111111111');
insert into probe select 'S15 Inhaber schaltet kosten_view dazu (ok)', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','kosten_view', true)->>'ok');
reset role;
select pg_temp.als('22222222-2222-2222-2222-222222222221');
insert into probe select 'S16 Mia: mit beidem exportiert sie genau ihre Belege', (select (r->>'ok')||'/'||jsonb_array_length(r->'zeilen') from (select public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 5, current_date) r) x);
insert into probe select 'S17 Mia: Export des fremden Betriebs B bleibt kein_recht', (public.finanz_export_belege('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', current_date - 5, current_date)->>'grund');
insert into probe select 'S18 Mia: die Zeile des Exports trägt nur Beleg-Felder (keine Lager-/Rezeptur-Werte)', (select string_agg(k, ',' order by k) from (select jsonb_object_keys((public.finanz_export_belege('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 5, current_date)->'zeilen')->0) k) x);
reset role;
-- Rollenwechsel nimmt die Rechte mit (Wache), als Eigentümer geschrieben
update public.betrieb_mitglieder set rolle = 'team' where nutzer_id = '22222222-2222-2222-2222-222222222221';
insert into probe select 'S19 Manager → Team: Rechte der Spalte sind zurückgesetzt', (select rechte::text from public.betrieb_mitglieder where nutzer_id = '22222222-2222-2222-2222-222222222221');
update public.betrieb_mitglieder set rolle = 'manager' where nutzer_id = '22222222-2222-2222-2222-222222222221';
insert into probe select 'S20 Team → Manager: kommt ohne Rechte zurück (kein Recht „reist“ mit)', (select rechte::text from public.betrieb_mitglieder where nutzer_id = '22222222-2222-2222-2222-222222222221');
insert into public.betrieb_mitglieder(betrieb_id, nutzer_id, rolle, anzeigename, rechte) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222223','team','Zoe-B','{"kosten_view":true}');
insert into probe select 'S21 Neues Team-Mitglied mit Rechten im Insert: Spalte wird geleert', (select rechte::text from public.betrieb_mitglieder where betrieb_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and nutzer_id='22222222-2222-2222-2222-222222222223');

-- ════ Z · Teamziele ════════════════════════════════════════════════════════════════════
select pg_temp.als('22222222-2222-2222-2222-222222222223');
create temp table zid(k text, id uuid);
grant all on zid to authenticated;
create temp table aid_entwurf(id uuid);
grant all on aid_entwurf to authenticated;
insert into zid select 'z1', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '  Zehn Bewertungen  ', 'Bis Freitag', current_date + 7, '[{"titel":"Karte erklären"},{"titel":"Nach Bewertung fragen"}]'::jsonb)->>'id')::uuid;
insert into probe select 'Z1 Manager mit ziele_edit legt ein Ziel mit zwei Aufgaben an', (select count(*) from zid)||'/'||(select status||'/'||titel from public.team_ziele where id=(select id from zid where k='z1'));
reset role;
insert into aid_entwurf select id from public.team_aufgaben where ziel_id = (select id from zid where k='z1') order by pos limit 1;
insert into probe select 'Z1b Voraussetzung: der Entwurf trägt Aufgaben (Eigentümer gemessen, erwartet 2)', (select count(*) from public.team_aufgaben where ziel_id = (select id from zid where k='z1'));
select pg_temp.als('33333333-3333-3333-3333-333333333331');
insert into probe select 'Z2 Team sieht den Entwurf NICHT (Tabelle und Funktion)', (select count(*) from public.team_ziele)||'/'||(select count(*) from public.team_aufgaben)||'/'||jsonb_array_length(public.teamziele_stand('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')->'ziele');
insert into probe select 'Z3 Team: Aufgabe eines Entwurfs abhaken: nicht_freigegeben', (public.teamaufgabe_haken((select id from aid_entwurf), true)->>'grund');
reset role;
select pg_temp.als('22222222-2222-2222-2222-222222222223');
insert into probe select 'Z4 Manager mit ziele_approve gibt frei (ok)', (public.teamziel_freigeben((select id from zid where k='z1'), true)->>'ok');
reset role;
select pg_temp.als('33333333-3333-3333-3333-333333333331');
insert into probe select 'Z5 Team sieht jetzt das Ziel mit beiden Aufgaben', (select count(*) from public.team_ziele)||'/'||(select count(*) from public.team_aufgaben)||'/'||(public.teamziele_stand('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')->'darf'->>'edit');
insert into probe select 'Z6 Team: keine E-Mail, kein Geld im Stand', (public.teamziele_stand('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::text !~* '(@|summe|umsatz|preis|netto)')::text;
insert into probe select 'Z7 Team legt kein Ziel an / gibt nichts frei', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'X', null, null, '[]'::jsonb)->>'grund')||'/'||(public.teamziel_freigeben((select id from zid where k='z1'), false)->>'grund')||'/'||(public.teamziel_archivieren((select id from zid where k='z1'))->>'grund');
insert into probe select 'Z8 Team hakt die erste Aufgabe ab (ok, 1 von 2, Ziel bleibt freigegeben)', (select (r->>'ok')||'/'||(r->>'erledigt')||'/'||(r->>'gesamt')||'/'||(r->>'status') from (select public.teamaufgabe_haken((select id from public.team_aufgaben order by pos limit 1), true) r) x);
insert into probe select 'Z9 Team hakt die zweite ab → Ziel erreicht', (select (r->>'status')||'/'||(r->>'erledigt') from (select public.teamaufgabe_haken((select id from public.team_aufgaben order by pos desc limit 1), true) r) x);
insert into probe select 'Z10 gemeinsamer Erfolg ist da, mit Titel ohne Leerzeichen am Rand', (select count(*)||'/'||min(titel) from public.team_erfolge);
insert into probe select 'Z11 „erledigt von“ im Stand ist der Anzeigename', (select string_agg(a->>'von', ',' order by a->>'titel') from jsonb_array_elements(public.teamziele_stand('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')->'ziele'->0->'aufgaben') a);
insert into probe select 'Z12 wieder öffnen: Ziel zurück auf freigegeben', (select (r->>'status') from (select public.teamaufgabe_haken((select id from public.team_aufgaben order by pos desc limit 1), false) r) x);
insert into probe select 'Z12b … und der gemeinsame Erfolg ist weg (eigene Anweisung, sonst sähe sie ihre Änderung nicht)', (select count(*) from public.team_erfolge);
reset role;
select pg_temp.als('44444444-4444-4444-4444-444444444444');
insert into probe select 'Z13 Fremder Betrieb: Stand kein_zugang, Tabellen leer', (public.teamziele_stand('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')->>'grund')||'/'||(select count(*) from public.team_ziele)||'/'||(select count(*) from public.team_aufgaben)||'/'||(select count(*) from public.team_erfolge);
reset role;
-- die Aufgabe selbst (id als Eigentümer geholt) von einem Fremden abhaken
create temp table aid as select id from public.team_aufgaben order by pos limit 1;
grant all on aid to authenticated;
select pg_temp.als('44444444-4444-4444-4444-444444444444');
insert into probe select 'Z14 Fremder hakt eine echte Aufgabe fremden Betriebs ab: kein_zugang', (public.teamaufgabe_haken((select id from aid), false)->>'grund');
insert into probe select 'Z15 Inhaber B legt in B ein NEUES Ziel an, dessen Aufgabe-id aus A stammt: aufgaben', (public.teamziel_speichern('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, 'Klau', null, null, jsonb_build_array(jsonb_build_object('id', (select id from aid), 'titel','x')))->>'grund');
insert into probe select 'Z15b … und in B ist nichts angelegt (als Inhaber B gelesen — er sähe es)', (select count(*) from public.team_ziele where betrieb_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::text;
insert into probe select 'Z16 Inhaber B ändert das Ziel aus A über den eigenen Betrieb: unbekannt', (public.teamziel_speichern('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', (select id from zid where k='z1'), 'Klau', null, null, '[{"titel":"x"}]'::jsonb)->>'grund');
reset role;
select pg_temp.als('22222222-2222-2222-2222-222222222223');
insert into probe select 'Z17 Eingaben: Titel leer', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '   ', null, null, '[]'::jsonb)->>'grund');
insert into probe select 'Z18 Eingaben: Titel 81 Zeichen', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, repeat('x', 81), null, null, '[]'::jsonb)->>'grund');
insert into probe select 'Z19 Eingaben: Beschreibung 301 Zeichen', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'T', repeat('x', 301), null, '[]'::jsonb)->>'grund');
insert into probe select 'Z20 Eingaben: Frist im Jahr 1900', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'T', null, date '1900-01-01', '[]'::jsonb)->>'grund');
insert into probe select 'Z21 Eingaben: 13 Aufgaben', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'T', null, null, (select jsonb_agg(jsonb_build_object('titel','a'||g)) from generate_series(1,13) g))->>'grund');
insert into probe select 'Z22 Eingaben: Aufgabe ohne Titel', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'T', null, null, '[{"titel":""}]'::jsonb)->>'grund');
insert into probe select 'Z23 Eingaben: Aufgaben kein Array', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'T', null, null, '{"titel":"x"}'::jsonb)->>'grund');
insert into probe select 'Z24 Eingaben: Aufgaben NULL', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'T', null, null, null)->>'grund');
insert into probe select 'Z25 Eingaben: id keine UUID', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from zid where k='z1'), 'T', null, null, '[{"id":"x''; --","titel":"a"}]'::jsonb)->>'grund');
insert into probe select 'Z26 Freigeben ohne Aufgaben: keine_aufgaben', (select (public.teamziel_freigeben((r->>'id')::uuid, true)->>'grund') from (select public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'Leer', null, null, '[]'::jsonb) r) x);
insert into probe select 'Z27 Anlegen in fremdem Betrieb B: kein_recht', (public.teamziel_speichern('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, 'T', null, null, '[]'::jsonb)->>'grund');
reset role;
-- Grenze: höchstens 20 nicht archivierte Ziele je Betrieb (als Eigentümer aufgefüllt, dann über die Funktion geprüft)
insert into public.team_ziele(betrieb_id, titel) select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Füller '||g from generate_series(1, 20 - (select count(*) from public.team_ziele where betrieb_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and status <> 'archiviert')) g;
select pg_temp.als('22222222-2222-2222-2222-222222222223');
insert into probe select 'Z28 21. Ziel: grenze', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'Zu viel', null, null, '[]'::jsonb)->>'grund');
reset role;
-- Manager mit NUR ziele_edit: Änderung an einem freigegebenen Ziel geht zurück in die Freigabe
select pg_temp.als('11111111-1111-1111-1111-111111111111');
insert into probe select 'Z29 Inhaber schaltet ziele_edit (ohne approve) für Mia an (ok)', (public.team_rechte_setzen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','ziele_edit', true)->>'ok');
reset role;
select pg_temp.als('22222222-2222-2222-2222-222222222221');
insert into probe select 'Z30 Mia (edit, kein approve): Freigeben kein_recht', (public.teamziel_freigeben((select id from zid where k='z1'), true)->>'grund');
insert into probe select 'Z31 Mia ändert das freigegebene Ziel (ok)', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from zid where k='z1'), 'Zehn Bewertungen', 'Neu', null, (select jsonb_agg(jsonb_build_object('id', a.id, 'titel', a.titel) order by a.pos) from public.team_aufgaben a where a.ziel_id=(select id from zid where k='z1')))->>'ok');
insert into probe select 'Z31b … danach ist es wieder ein Entwurf (eigene Anweisung)', (select status from public.team_ziele where id=(select id from zid where k='z1'));
reset role;
select pg_temp.als('33333333-3333-3333-3333-333333333331');
insert into probe select 'Z32 Team sieht das zurückgezogene Ziel nicht mehr', (select count(*) from public.team_ziele where id=(select id from zid where k='z1'));
reset role;
select pg_temp.als('22222222-2222-2222-2222-222222222223');
insert into probe select 'Z33 Archivieren (ok)', (public.teamziel_archivieren((select id from zid where k='z1'))->>'ok');
insert into probe select 'Z33b … und weg aus dem Stand (eigene Anweisung)', (select count(*) from jsonb_array_elements(public.teamziele_stand('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')->'ziele') z where z->>'id' = (select id::text from zid where k='z1'));
insert into probe select 'Z34 Archiviertes lässt sich nicht mehr ändern', (public.teamziel_speichern('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from zid where k='z1'), 'Wieder', null, null, '[{"titel":"x"}]'::jsonb)->>'grund');
reset role;

select * from probe;
rollback;
