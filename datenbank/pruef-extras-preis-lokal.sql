-- pruef-extras-preis-lokal.sql · rechnet der Server die Extras JE GERICHT richtig nach? (lokal, ECHTE positionen_pruefen)
-- Gruppen je Gericht liegen als g-<8 Zeichen der Gericht-id>-<name> in betriebe.optionen und hängen über gerichte.opt
-- NUR an diesem Gericht. Gleiche Zutat, anderer Preis an einem anderen Gericht: jedes Gericht bekommt SEINEN Preis.
begin;
create temp table probe(schritt text, ergebnis text);
insert into public.betriebe(id, optionen) values ('b1b1b1b1-0000-0000-0000-000000000001', $j$
 {"milch":{"titel":"Milch wählen","art":"eine","pflicht":true,"zeilen":[{"n":"Kuhmilch","auf":0},{"n":"Hafermilch","auf":0.5}]},
  "g-aaaaaaaa-beilage":{"titel":"Beilage","art":"eine","pflicht":true,"zeilen":[{"n":"Pommes","auf":0,"vor":true},{"n":"Salat","auf":1.5},{"n":"Suppe","auf":2.2}]},
  "g-aaaaaaaa-extra":{"titel":"Extras","art":"mehrere","zeilen":[{"n":"Käse","auf":1},{"n":"Speck","auf":1.5,"vor":true}]},
  "g-bbbbbbbb-beilage":{"titel":"Beilage","art":"eine","pflicht":true,"zeilen":[{"n":"Pommes","auf":0.5},{"n":"Reis","auf":1}]}}
$j$::jsonb);
insert into public.gerichte(id, betrieb_id, name, preis, verfuegbar, opt) values
 ('aaaaaaaa-1111-1111-1111-111111111111','b1b1b1b1-0000-0000-0000-000000000001','Burger',10,true,'g-aaaaaaaa-beilage,g-aaaaaaaa-extra,milch'),
 ('bbbbbbbb-2222-2222-2222-222222222222','b1b1b1b1-0000-0000-0000-000000000001','Schnitzel',12,true,'g-bbbbbbbb-beilage'),
 ('cccccccc-3333-3333-3333-333333333333','b1b1b1b1-0000-0000-0000-000000000001','Suppe',5,true,null);
create or replace function pg_temp.preis(p_name text, p_gast numeric, p_menge int default 1) returns text language sql as $$
  select (public.positionen_pruefen('b1b1b1b1-0000-0000-0000-000000000001'::uuid,
          jsonb_build_array(jsonb_build_object('name', p_name, 'preis', p_gast, 'menge', p_menge)))->'positionen'->0->>'preis') $$;
insert into probe values ('P1 Burger (Pommes), Gast zahlt 10',                          pg_temp.preis('Burger (Pommes)', 10));
insert into probe values ('P2 Burger (Salat · Käse), Gast will 1 zahlen → Server',      pg_temp.preis('Burger (Salat · Käse)', 1));
insert into probe values ('P3 Schnitzel (Pommes) — SEIN Preis, nicht der vom Burger',   pg_temp.preis('Schnitzel (Pommes)', 12));
insert into probe values ('P4 Burger (Pommes) — dort ohne Aufpreis',                    pg_temp.preis('Burger (Pommes)', 10));
insert into probe values ('P5 Schnitzel (Reis)',                                        pg_temp.preis('Schnitzel (Reis)', 1));
insert into probe values ('P6 Burger (Hafermilch · Speck · Salat) — eigene UND geteilte Gruppe', pg_temp.preis('Burger (Hafermilch · Speck · Salat)', 1));
insert into probe values ('P7 Burger (Reis) — Reis hängt am Schnitzel: alte Regel, Gast 1',  pg_temp.preis('Burger (Reis)', 1));
insert into probe values ('P8 Burger (Reis) — alte Regel, Gast 11',                     pg_temp.preis('Burger (Reis)', 11));
insert into probe values ('P9 Burger (Reis) — alte Regel, Gast 99 (gedeckelt auf +12)', pg_temp.preis('Burger (Reis)', 99));
insert into probe values ('P10 Schnitzel (Salat) — Salat gehört dem Burger',            pg_temp.preis('Schnitzel (Salat)', 1));
insert into probe values ('P11 Suppe ohne Gruppen, mit Wunsch (Käse)',                  pg_temp.preis('Suppe (Käse)', 1));
insert into probe values ('P12 Burger (Speck) — „Vorschlag“ ändert den Preis nicht',    pg_temp.preis('Burger (Speck)', 1));
insert into probe values ('P13 Burger (Gold) — unbekanntes Extra, Gast 10.50',          pg_temp.preis('Burger (Gold)', 10.50));
insert into probe values ('P14 Burger ohne Extras, Gast 1',                             pg_temp.preis('Burger', 1));
insert into probe values ('P15 Summe: 2 × Burger (Salat) + 1 × Schnitzel (Reis)',
  (public.positionen_pruefen('b1b1b1b1-0000-0000-0000-000000000001'::uuid,
     '[{"name":"Burger (Salat)","preis":1,"menge":2},{"name":"Schnitzel (Reis)","preis":1,"menge":1}]'::jsonb)->>'summe'));
select * from probe order by length(schritt), schritt;
rollback;
