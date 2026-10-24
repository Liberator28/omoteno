-- Bestand VOR den Migrationen: Betriebe, Ketten, Konten (nur die drei alten Rollen) und Zahlen in jeder Einkaufstabelle.
-- Läuft NUR lokal (pruefungen/pruef-zugriffsrechte-lokal.sh).
insert into auth.users(id, email) values
 ('11111111-1111-1111-1111-111111111111','inhaber-a@probe.invalid'),('22222222-2222-2222-2222-222222222221','manager-a@probe.invalid'),
 ('22222222-2222-2222-2222-222222222222','manager-k@probe.invalid'),('22222222-2222-2222-2222-222222222223','manager-z@probe.invalid'),
 ('33333333-3333-3333-3333-333333333331','team-a@probe.invalid'),('33333333-3333-3333-3333-333333333332','kueche-a@probe.invalid'),
 ('33333333-3333-3333-3333-333333333333','lager-a@probe.invalid'),('44444444-4444-4444-4444-444444444444','inhaber-b@probe.invalid'),
 ('55555555-5555-5555-5555-555555555555','manager-b@probe.invalid'),('66666666-6666-6666-6666-666666666666','inhaber-cd@probe.invalid'),
 ('77777777-7777-7777-7777-777777777777','manager-c@probe.invalid'),('88888888-8888-8888-8888-888888888888','manager-e@probe.invalid'),
 ('99999999-9999-9999-9999-999999999999','master@probe.invalid'),('88888888-8888-8888-8888-888888888889','inhaber-e@probe.invalid');
insert into public.master_konten(benutzer_id, email) values ('99999999-9999-9999-9999-999999999999','master@probe.invalid');
insert into public.organisationen(id, name) values
 ('0a000000-0000-0000-0000-000000000001','Org A'),('0a000000-0000-0000-0000-000000000002','Org B'),('0a000000-0000-0000-0000-000000000003','Kette X');
insert into public.betriebe(id, name, slug, organisation_id, pin_pflicht) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Choco','choco','0a000000-0000-0000-0000-000000000001', false),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Blend','blend','0a000000-0000-0000-0000-000000000002', false),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','Kette C','kc','0a000000-0000-0000-0000-000000000003', false),
 ('dddddddd-dddd-dddd-dddd-dddddddddddd','Kette D','kd','0a000000-0000-0000-0000-000000000003', false),
 ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','Pin-Haus','pin',null, true);
insert into public.betrieb_mitglieder(betrieb_id, nutzer_id, rolle, anzeigename, darf_lager) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','inhaber','Ina', false),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333331','team','Tim', false),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333332','kueche','Kai', false),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333','team','Lea', true),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','44444444-4444-4444-4444-444444444444','inhaber','Ben', false),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','66666666-6666-6666-6666-666666666666','inhaber','Cem', false),
 ('dddddddd-dddd-dddd-dddd-dddddddddddd','66666666-6666-6666-6666-666666666666','inhaber','Cem', false),
 ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','88888888-8888-8888-8888-888888888889','inhaber','Eva', false);

-- Zahlen: je Betrieb dieselbe kleine Geschichte (A, B, C, D)
insert into public.artikel(id, organisation_id, name, basiseinheit) select ('0b000000-0000-0000-0000-00000000000'||n)::uuid, o, 'Mehl '||n, 'g'
  from (values (1,'0a000000-0000-0000-0000-000000000001'::uuid),(2,'0a000000-0000-0000-0000-000000000002'::uuid),(3,'0a000000-0000-0000-0000-000000000003'::uuid)) v(n,o);
insert into public.lieferanten(id, organisation_id, name) select ('0c000000-0000-0000-0000-00000000000'||n)::uuid, o, 'Lieferant '||n
  from (values (1,'0a000000-0000-0000-0000-000000000001'::uuid),(2,'0a000000-0000-0000-0000-000000000002'::uuid),(3,'0a000000-0000-0000-0000-000000000003'::uuid)) v(n,o);
insert into public.lieferanten_artikel(lieferant_id, artikel_id, bezeichnung, gebinde_basis, letzter_preis) select
  ('0c000000-0000-0000-0000-00000000000'||n)::uuid, ('0b000000-0000-0000-0000-00000000000'||n)::uuid, 'Mehl 1 kg', 1000, 1.2 from generate_series(1,3) n;
insert into public.einkaufsbelege(id, betrieb_id, lieferant_id, belegnummer, belegdatum, netto, steuer, brutto, status, freigegeben_am) values
 ('0d000000-0000-0000-0000-00000000000a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','0c000000-0000-0000-0000-000000000001','RE-A',current_date,100,7,107,'freigegeben',now()),
 ('0d000000-0000-0000-0000-00000000000b','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','0c000000-0000-0000-0000-000000000002','RE-B',current_date,200,14,214,'freigegeben',now()),
 ('0d000000-0000-0000-0000-00000000000c','cccccccc-cccc-cccc-cccc-cccccccccccc','0c000000-0000-0000-0000-000000000003','RE-C',current_date,300,21,321,'freigegeben',now()),
 ('0d000000-0000-0000-0000-00000000000d','dddddddd-dddd-dddd-dddd-dddddddddddd','0c000000-0000-0000-0000-000000000003','RE-D',current_date,400,28,428,'freigegeben',now());
insert into public.einkaufspositionen(beleg_id, pos, text, art, artikel_id, menge, gebinde_basis, netto) values
 ('0d000000-0000-0000-0000-00000000000a',1,'Mehl','ware','0b000000-0000-0000-0000-000000000001',10,1000,100),
 ('0d000000-0000-0000-0000-00000000000b',1,'Mehl','ware','0b000000-0000-0000-0000-000000000002',10,1000,200),
 ('0d000000-0000-0000-0000-00000000000c',1,'Mehl','ware','0b000000-0000-0000-0000-000000000003',10,1000,300),
 ('0d000000-0000-0000-0000-00000000000d',1,'Mehl','ware','0b000000-0000-0000-0000-000000000003',10,1000,400);
insert into public.lagerbewegungen(betrieb_id, artikel_id, art, menge_basis, wert_netto) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','0b000000-0000-0000-0000-000000000001','eingang',10000,100),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','0b000000-0000-0000-0000-000000000002','eingang',10000,200);
insert into public.inventuren(betrieb_id, positionen, differenz_wert) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,-5),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',1,-7);
insert into public.einkauf_perioden(betrieb_id, monat) select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', date_trunc('month', current_date - 30)::date;
insert into public.gerichte(id, betrieb_id, name, preis, kategorie, karte) values
 ('0e000000-0000-0000-0000-00000000000a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Crêpe',9,'Süß','speisekarte'),
 ('0e000000-0000-0000-0000-00000000000b','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Mojito',8,'Drinks','getraenke');
insert into public.rezepturen(id, betrieb_id, gericht_id, gueltig_ab) values
 ('0f000000-0000-0000-0000-00000000000a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','0e000000-0000-0000-0000-00000000000a', now() - interval '10 days'),
 ('0f000000-0000-0000-0000-00000000000b','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','0e000000-0000-0000-0000-00000000000b', now() - interval '10 days');
insert into public.rezepturpositionen(rezeptur_id, artikel_id, menge_basis) values
 ('0f000000-0000-0000-0000-00000000000a','0b000000-0000-0000-0000-000000000001',100),
 ('0f000000-0000-0000-0000-00000000000b','0b000000-0000-0000-0000-000000000002',50);
insert into public.umlagerungen(id, organisation_id, von_betrieb, nach_betrieb, status) values
 ('10000000-0000-0000-0000-00000000000c','0a000000-0000-0000-0000-000000000003','cccccccc-cccc-cccc-cccc-cccccccccccc','dddddddd-dddd-dddd-dddd-dddddddddddd','unterwegs');
insert into public.umlagerungspositionen(umlagerung_id, pos, artikel_id, menge_basis, wert_netto) values
 ('10000000-0000-0000-0000-00000000000c',1,'0b000000-0000-0000-0000-000000000003',1000,12);
insert into public.bestellungen(id, betrieb_id, quelle, status, summe, positionen, zeitpunkt) values
 ('20000000-0000-0000-0000-00000000000a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','tisch','neu',18,'[{"name":"Crêpe","menge":2,"preis":9}]'::jsonb, now()),
 ('20000000-0000-0000-0000-00000000000b','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','tisch','neu',8,'[{"name":"Mojito","menge":1,"preis":8}]'::jsonb, now());
insert into storage.objects(bucket_id, name) values
 ('belege','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/0d000000-0000-0000-0000-00000000000a.pdf'),
 ('belege','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/0d000000-0000-0000-0000-00000000000b.pdf');
