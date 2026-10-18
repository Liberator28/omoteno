-- ═══════════════════════════════════════════════════════════════════
--  daten-piugusto.sql · Neuer Kunde Più Gusto (Pizzeria), 17.10.
--
--  Quelle: die Karte des Hauses (Namen, Preise, Allergene in Worten,
--  Beläge in Preisstufen). Allergene nach dem Schlüssel von Board und
--  Hub (§6.3): Gluten A, Krebstiere B, Fisch D, Milch G, Weichtiere R.
--  Beschreibungen stehen auf der Karte nicht — sie bleiben leer, statt
--  Zutaten zu erfinden (ein erfundener Belag zöge falsche Allergene
--  nach sich). Der Betrieb trägt sie im Board nach.
--
--  „Pizza Tonno (ohne Zwiebeln)“ heißt hier „Pizza Tonno“ mit
--  „ohne Zwiebeln“ als Beschreibung: positionen_pruefen liest alles ab
--  „ (“ als Extras. Mit Klammer im Namen fände der Server das Gericht
--  nie und rechnete den Preis des Gastes (gemessen an der Funktion).
--
--  Beläge als drei Gruppen nach Art statt sechs nach Preis — jede Zeile
--  trägt ihren Preis selbst, und 34 Häkchen in einer Liste wären für
--  den Gast unübersichtlich. Preise unverändert aus der Karte.
--
--  Zustand „test“ mit Frist 30 Tage (betriebe_test_hat_frist verlangt
--  eine; erster Lauf scheiterte daran). Bis dahin gehen Bestellungen,
--  DANACH sperrt bestellung_aufgeben — vorher setzt der Master „aktiv“.
--  Kein Mitglied — Zugang über den Master.
--  Wiederholbar: nichts wird doppelt angelegt.
-- ═══════════════════════════════════════════════════════════════════

insert into public.betriebe (slug, name, zustand, test_bis, optionen, hub_stil, hub_texte)
values ('piugusto', 'Più Gusto', 'test', now() + interval '30 days',
  '{
    "belag-gemuese": {"titel":"Gemüse & Würze extra","art":"mehrere","pflicht":false,"zeilen":[
      {"n":"Knoblauch","auf":1},{"n":"Cherrytomaten","auf":1},{"n":"Ei","auf":1},{"n":"Mais","auf":1},{"n":"Kapern","auf":1},
      {"n":"Pilze","auf":1.5},{"n":"Paprika","auf":1.5},{"n":"Oliven","auf":1.5},{"n":"Zwiebel","auf":1.5},{"n":"Rucola","auf":1.5},
      {"n":"Spinat","auf":1.5},{"n":"Pesto","auf":1.5},{"n":"Peperoni mild","auf":1.5},{"n":"Peperoni scharf","auf":1.5},
      {"n":"Artischocken","auf":2},{"n":"Zucchini","auf":2},{"n":"Pommes","auf":2}]},
    "belag-kaese": {"titel":"Käse extra","art":"mehrere","pflicht":false,"zeilen":[
      {"n":"Mozzarella","auf":2},{"n":"Fetakäse","auf":2},{"n":"Hirtenkäse","auf":2},{"n":"Parmesan","auf":2},
      {"n":"Gorgonzola","auf":2},{"n":"Burrata","auf":3.5}]},
    "belag-fleisch": {"titel":"Fleisch & Fisch extra","art":"mehrere","pflicht":false,
      "hinweis":"Salami und Peperoniwurst sind halal.","zeilen":[
      {"n":"Salami","auf":1.5},{"n":"Peperoniwurst","auf":1.5},{"n":"Würstel","auf":2},{"n":"Salsiccia","auf":2},
      {"n":"Thunfisch","auf":2},{"n":"Sardellen","auf":2},{"n":"Sucuk","auf":2.5},
      {"n":"Parmaschinken","auf":3},{"n":"Bresaola","auf":3}]}
  }'::jsonb,
  '{"karte":"teller","lade":"kueche","emoji":true,"schrift":{"titel":"pacifico","kopf":"playfair"}}'::jsonb,
  '{"ueber":"Pizza aus dem Ofen, Beläge nach Wahl. Wir verwenden Halal-Salami und Halal-Peperoniwurst."}'::jsonb)
on conflict (slug) do nothing;

insert into public.gerichte (betrieb_id, karte, kategorie, kat_sort, kat_emoji, name, beschreibung, uebersetzungen,
                             preis, allergene, veg, verfuegbar, reihenfolge, opt)
select b.id, 'speisekarte', 'Pizza', 0, 'pizzakaese', p.name, p.beschr, p.ueb, p.preis, p.allergene, p.veg, true, p.nr,
       'belag-gemuese,belag-kaese,belag-fleisch'
from public.betriebe b
cross join (values
  ( 0, 'Pizza Liam',          '', null::jsonb, 13.00, 'A,G',     false),
  ( 1, 'Pizza Gamberetto',    '', null,        13.00, 'A,G,B',   false),
  ( 2, 'Pizza Popeye',        '', null,        12.50, 'A,G',     false),
  ( 3, 'Pizza Vegetaria',     '', null,        13.00, 'A,G',     true),
  ( 4, 'Pizza 4 Formaggi',    '', null,        13.00, 'A,G',     false),
  ( 5, 'Pizza Speciale',      '', null,        12.50, 'A,G',     false),
  ( 6, 'Pizza 4 Stagioni',    '', null,        13.00, 'A,G',     false),
  ( 7, 'Pizza Calzone',       '', null,        12.50, 'A,G',     false),
  ( 8, 'Pizza Tonno',         'ohne Zwiebeln',
       '{"en":"without onions","tr":"soğansız","ru":"без лука","fr":"sans oignons","es":"sin cebolla","it":"senza cipolle","pl":"bez cebuli","ar":"بدون بصل","uk":"без цибулі","nl":"zonder uien","ro":"fără ceapă"}',
                                                  10.50, 'A,G,D',   false),
  ( 9, 'Pizza Frutti di Mare','', null,        13.00, 'A,G,B,R', false)
) as p(nr, name, beschr, ueb, preis, allergene, veg)
where b.slug = 'piugusto'
  and not exists (select 1 from public.gerichte g where g.betrieb_id = b.id and g.name = p.name);
