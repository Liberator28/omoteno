-- Bestand NACH Teil A und B: Manager mit unterschiedlichen Rechten, vergiftete Spalten, PIN-Sitzungen, ein Ziel.
-- Läuft NUR lokal, als Eigentümer (ohne RLS), und bleibt stehen — die Proben drehen sich selbst zurück.
insert into public.betrieb_mitglieder(betrieb_id, nutzer_id, rolle, anzeigename, rechte) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222221','manager','Mia','{}'),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','manager','Karl','{"kosten_view":true}'),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222223','manager','Zoe','{"ziele_edit":true,"ziele_approve":true}'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','55555555-5555-5555-5555-555555555555','manager','Bo','{"kosten_view":true}'),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','77777777-7777-7777-7777-777777777777','manager','Cora','{"kosten_view":true}'),
 ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','88888888-8888-8888-8888-888888888888','manager','Emil','{"kosten_view":true}');
-- Eine Spalte, die ein Finanzrecht an Team/Küche trägt (so etwas darf nie wirken): als Eigentümer hineingeschrieben.
update public.betrieb_mitglieder set rechte = '{"kosten_view":true,"finanz_export":true,"berichte_view":true,"ziele_edit":true,"ziele_approve":true}'::jsonb
 where betrieb_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and rolle in ('team', 'kueche');
insert into public.pin_sitzungen(nutzer_id, sitzung, bis) values
 ('88888888-8888-8888-8888-888888888888','sE', now() + interval '1 hour'),
 ('88888888-8888-8888-8888-888888888889','sE', now() + interval '1 hour');
