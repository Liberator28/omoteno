-- ═══════════════════════════════════════════════════════════════════
--  EINGESPIELT (15.09.2026) · MINHKEEY als echter Betrieb angelegt
--
--  Bestand vorher (nachgesehen, nicht angenommen — CLAUDE.md §1.2):
--    - dist/minhkeey und oeffentlich/h/minhkeey sind längst erzeugt
--      und ausgeliefert (Markenblatt markenblaetter/minhkeey.json),
--      aber es gab dafür KEINE Zeile in betriebe. Der ausgelieferte
--      Hub zeigte nur die eingebackene Demo-Schrift, ohne eine
--      einzige Zeile aus gerichte — kein Login, keine eigene Karte,
--      keine eigenen Bestellungen möglich.
--    - Blend dagegen hatte schon eine echte Zeile (angelegt beim
--      Beheben von "Blends Hub zeigte auf Chocos Betrieb"), aber
--      bis heute KEIN Mitglied in betrieb_mitglieder — niemand
--      konnte sich einloggen.
--
--  Diese Datei legt NUR die betriebe-Zeile für Minhkeey an (additiv,
--  eine einzige Zeile, keine Schemaänderung). Die Verknüpfung mit
--  einem Login (betrieb_mitglieder) braucht eine echte
--  auth.users-Zeile, die es zum Zeitpunkt dieser Migration noch nicht
--  gab — das folgt in einer eigenen Datei, sobald die beiden Konten
--  über das Supabase-Dashboard angelegt sind (kein MCP-Werkzeug kann
--  einen Auth-Nutzer anlegen, das Dashboard ist dafür der einzige
--  saubere Weg — ein Insert von Hand in auth.users wäre eine Baustelle
--  mit lauter Feldern, die GoTrue selbst setzt, und `signInWithPassword()`
--  danach unberechenbar).
--
--  Name und Slug aus markenblaetter/minhkeey.json (betrieb.name +
--  betrieb.claim), Muster wie bei "Blend · Cocktail & Gastro Lab"
--  übernommen, nicht neu erfunden.
-- ═══════════════════════════════════════════════════════════════════

insert into betriebe (slug, name, zustand)
values ('minhkeey', 'MINHKEEY · Asia Streetfood', 'aktiv')
on conflict (slug) do nothing;

-- Ergebnis dieses Laufs: id cb560d8c-a72b-4687-b212-0a708c28ea62
