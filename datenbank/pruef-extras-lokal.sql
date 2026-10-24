-- pruef-extras-lokal.sql · Beilagen und Extras je Gericht: Schranke UND Server-Preis, lokal (pruefungen/pruef-extras-lokal.sh)
-- Teil 1 läuft vor und nach der Migration (Differenz alt/neu). Teil 2 rechnet mit der ECHTEN positionen_pruefen.
begin;
create temp table probe(schritt text, ergebnis text);
grant all on probe to authenticated, anon;
create temp table fall(nr text, p jsonb);
insert into fall values
 ('f01 klein, gültig',              '{"a":{"titel":"Beilage","art":"eine","pflicht":true,"zeilen":[{"n":"Pommes","auf":0},{"n":"Salat","auf":1.5}]}}'),
 ('f02 ohne Vorschlag',             '{"a":{"titel":"X","art":"mehrere","zeilen":[{"n":"Käse","auf":2}]}}'),
 ('f03 mit Vorschlag true',         '{"a":{"titel":"X","art":"mehrere","zeilen":[{"n":"Käse","auf":2,"vor":true}]}}'),
 ('f04 Vorschlag als Text',         '{"a":{"titel":"X","art":"mehrere","zeilen":[{"n":"Käse","auf":2,"vor":"ja"}]}}'),
 ('f05 Vorschlag als Zahl',         '{"a":{"titel":"X","art":"mehrere","zeilen":[{"n":"Käse","auf":2,"vor":1}]}}'),
 ('f06 Komma im Namen',             '{"a":{"titel":"X","art":"mehrere","zeilen":[{"n":"Kä,se","auf":2}]}}'),
 ('f07 Aufpreis 60',                '{"a":{"titel":"X","art":"mehrere","zeilen":[{"n":"Käse","auf":60}]}}'),
 ('f08 art alle',                   '{"a":{"titel":"X","art":"alle","zeilen":[{"n":"Käse","auf":1}]}}'),
 ('f09 Schlüssel groß',             '{"A":{"titel":"X","art":"eine","zeilen":[{"n":"Käse","auf":1}]}}'),
 ('f10 keine Zeilen',               '{"a":{"titel":"X","art":"eine","zeilen":[]}}'),
 ('f11 Liste statt Objekt',         '[]'),
 ('f12 null',                       null);
insert into fall select '12 Gruppen', (select jsonb_object_agg('g'||i, jsonb_build_object('titel','T','art','eine','zeilen',jsonb_build_array(jsonb_build_object('n','a','auf',0)))) from generate_series(1,12) i);
insert into fall select '13 Gruppen', (select jsonb_object_agg('g'||i, jsonb_build_object('titel','T','art','eine','zeilen',jsonb_build_array(jsonb_build_object('n','a','auf',0)))) from generate_series(1,13) i);
insert into fall select '60 Gruppen', (select jsonb_object_agg('g'||i, jsonb_build_object('titel','T','art','eine','zeilen',jsonb_build_array(jsonb_build_object('n','a','auf',0)))) from generate_series(1,60) i);
insert into fall select '61 Gruppen', (select jsonb_object_agg('g'||i, jsonb_build_object('titel','T','art','eine','zeilen',jsonb_build_array(jsonb_build_object('n','a','auf',0)))) from generate_series(1,61) i);
insert into fall select '40 Zeilen/ 41 Zeilen', (select jsonb_build_object('a', jsonb_build_object('titel','T','art','mehrere','zeilen',(select jsonb_agg(jsonb_build_object('n','z'||i,'auf',1)) from generate_series(1,41) i))));
insert into fall select 'groß: 9 kB', (select jsonb_object_agg('g'||i, jsonb_build_object('titel','T','art','mehrere','zeilen',(select jsonb_agg(jsonb_build_object('n',md5(i||'-'||j),'auf',1)) from generate_series(1,30) j))) from generate_series(1,12) i);
insert into fall select 'groß: 50 kB', (select jsonb_object_agg('g'||i, jsonb_build_object('titel','T','art','mehrere','zeilen',(select jsonb_agg(jsonb_build_object('n',md5(i||'-'||j),'auf',1)) from generate_series(1,40) j))) from generate_series(1,60) i);
-- Ergebnis je Fall: ok / zu (nur der Name der Fassung steht davor, damit das Skript alt und neu trennt)
insert into probe select :'fassung' || ' ' || nr, case when public.optionen_form_ok(p) then 'ok' else 'zu' end from fall order by nr;
select * from probe order by schritt;
rollback;
