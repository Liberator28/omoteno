-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION · Uebersetzungen fuer alles, was der Betrieb selbst schreibt
--
--   Im Supabase SQL-Editor in EINEM Rutsch ausfuehren.
--   Additiv: keine Spalte wird geloescht, keine Zeile geaendert.
--
-- Warum
-- ─────
-- Der Hub uebersetzt ueber ein Woerterbuch, dessen Schluessel der
-- DEUTSCHE Satz ist. Was im Geruest steht, ist gepflegt. Was der Wirt
-- im Board eintippt, steht dort nicht — und bleibt deshalb in allen
-- zwoelf Sprachen deutsch.
--
-- Halb da war das schon: gerichte.uebersetzungen gibt es, der Hub
-- mischt sie zur Laufzeit ins Woerterbuch (hub.vorlage.html ~10301).
-- Nur zwei Dinge fehlten, und beide sind der Grund fuer diese Datei:
--
--   1. Es sind zwei Sprachen (en, tr) statt elf.  Das ist keine
--      Schema-Frage — jsonb nimmt jeden Schluessel. Es ist eine Frage
--      der SCHRANKE: Die Groessengrenze unten muss elf Sprachen
--      tragen, sonst weist die Datenbank ab, was der Uebersetzer
--      schickt.
--   2. Es ist nur die BESCHREIBUNG. Der Gerichtname geht durch
--      dieselbe t()-Funktion und hatte nirgends eine Uebersetzung.
--
-- Und was kein Gericht ist — Kategorien, freie Texte, die Unterzeilen
-- der Startkacheln — hatte gar keinen Platz. Dafuer betriebe.hub_woerter.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────
-- 1 · Der Name eines Gerichts
--
--     Eigene Spalte statt eines Unterobjekts in "uebersetzungen".
--     Der Hub macht daraus heute  TEXTE[beschreibung] = {...spalte}
--     — ein zusaetzlicher Schluessel "name" darin waere ab sofort eine
--     Sprache namens "name", und t() haette sie als solche behandelt.
--     Zwei Spalten sind haesslicher und koennen das nicht.
-- ───────────────────────────────────────────────────────────────────
alter table public.gerichte
  add column if not exists name_uebersetzungen jsonb;

-- ───────────────────────────────────────────────────────────────────
-- 2 · Alles, was kein Gericht ist
--
--     Form wie das Woerterbuch im Hub, nur nach Sprache zuerst:
--       { "tr": { "Deutscher Satz": "Turkce cumle" }, "ru": { … } }
--
--     Nach Sprache zuerst, weil der Hub genau EINE Sprache braucht und
--     der Rest ihn nichts angeht.
-- ───────────────────────────────────────────────────────────────────
alter table public.betriebe
  add column if not exists hub_woerter jsonb;

-- ───────────────────────────────────────────────────────────────────
-- 3 · Groessenschranken
--
--     Warum ueberhaupt: Der Hub laedt diese Spalten bei JEDEM Besuch.
--     Ohne Grenze schreibt irgendwann jemand ein halbes Kochbuch
--     hinein, und das Cafe-WLAN traegt es beim Gast aus.
--
--     Die Zahlen sind gerechnet, nicht geraten:
--       Gericht: 11 Sprachen x ~90 Zeichen Beschreibung  ~ 1 200
--                dazu Schluessel und Klammern            ~ 1 800
--                Sicherheitsfaktor 2                     = 4 000
--       Betrieb: ~120 eigene Saetze x 11 Sprachen x ~60  ~ 80 000
--                Sicherheitsfaktor 2                     = 160 000
--
--     Die Schranken heissen wie die vorhandenen (…_masse), damit das
--     Board seine Fehlermeldung wiedererkennt: admin.html prueft auf
--     /hub_texte_masse|check/ und sagt dann Klartext statt Rohfehler.
-- ───────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'gerichte_uebersetzungen_masse') then
    alter table public.gerichte
      add constraint gerichte_uebersetzungen_masse
      check (uebersetzungen is null
             or length(uebersetzungen::text) <= 4000);
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'gerichte_name_uebersetzungen_masse') then
    alter table public.gerichte
      add constraint gerichte_name_uebersetzungen_masse
      check (name_uebersetzungen is null
             or length(name_uebersetzungen::text) <= 4000);
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'betriebe_hub_woerter_masse') then
    alter table public.betriebe
      add constraint betriebe_hub_woerter_masse
      check (hub_woerter is null
             or length(hub_woerter::text) <= 160000);
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────────
-- 4 · Rechte
--
--     Die Regel entscheidet, WELCHE Zeilen. Das Recht entscheidet, OB
--     ueberhaupt (CLAUDE.md 2.3a). Beides ansehen, nicht nur eines.
--
--     Spaltenrecht, nicht Tabellenrecht: anon darf diese zwei Spalten
--     LESEN und sonst nichts Neues. Schreiben darf nur, wer angemeldet
--     ist — und welche ZEILE, entscheidet weiter die vorhandene
--     RLS-Regel, an der hier nichts geaendert wird.
-- ───────────────────────────────────────────────────────────────────
grant select (name_uebersetzungen) on public.gerichte  to anon, authenticated;
grant select (hub_woerter)         on public.betriebe  to anon, authenticated;

grant update (name_uebersetzungen) on public.gerichte  to authenticated;
grant update (hub_woerter)         on public.betriebe  to authenticated;

commit;

-- ───────────────────────────────────────────────────────────────────
-- 5 · Proben
--
--     "success: true" sagt NICHTS darueber, ob es laeuft (CLAUDE.md
--     2.2). Deshalb hier ein Durchlauf, der sich selbst zurueckdreht.
--     raise notice kommt ueber MCP nicht an — darum die temporaere
--     Tabelle.
--
--     Diese Proben liefen gegen ein echtes Postgres 16, bevor die
--     Datei ausgeliefert wurde. Was sie bei DIR melden, zaehlt aber
--     mehr als das.
-- ───────────────────────────────────────────────────────────────────
begin;
create temp table probe(schritt text, ergebnis text);

do $$
declare
  v_id uuid;
  v_lang int;
  v_ok boolean;
begin
  -- 1 · Die Spalten sind da und nehmen elf Sprachen an
  select id into v_id from public.gerichte limit 1;
  if v_id is null then
    insert into probe values ('Gerichte vorhanden', 'KEINE — Proben uebersprungen');
    return;
  end if;

  update public.gerichte
     set name_uebersetzungen = jsonb_build_object(
           'en','x','tr','x','ru','x','fr','x','es','x','it','x',
           'pl','x','ar','x','uk','x','nl','x','ro','x')
   where id = v_id;

  select count(*) into v_lang
    from jsonb_object_keys((select name_uebersetzungen
                              from public.gerichte where id = v_id)) k;
  insert into probe values ('elf Sprachen am Gericht',
    case when v_lang = 11 then 'ok (' || v_lang || ')'
         else 'FEHL (' || v_lang || ')' end);

  -- 2 · Die Schranke haelt wirklich. Eine Grenze, die man nicht
  --     ueberschreitet, ist keine gemessene Grenze.
  begin
    update public.gerichte
       set name_uebersetzungen = jsonb_build_object('en', repeat('x', 5000))
     where id = v_id;
    insert into probe values ('Schranke am Gericht', 'FEHL — 5000 Zeichen gingen durch');
  exception when check_violation then
    insert into probe values ('Schranke am Gericht', 'ok — abgewiesen');
  end;

  -- 3 · Dasselbe am Betrieb
  update public.betriebe
     set hub_woerter = jsonb_build_object('tr', jsonb_build_object('Probe','Deneme'))
   where id = (select id from public.betriebe limit 1);
  select (hub_woerter #>> '{tr,Probe}') = 'Deneme' into v_ok
    from public.betriebe limit 1;
  insert into probe values ('hub_woerter schreibbar',
    case when v_ok then 'ok' else 'FEHL' end);

  -- 4 · Das Leserecht fuer anon steht wirklich auf der SPALTE
  insert into probe values ('anon liest name_uebersetzungen',
    case when has_column_privilege('anon','public.gerichte','name_uebersetzungen','SELECT')
         then 'ok' else 'FEHL' end);
  insert into probe values ('anon liest hub_woerter',
    case when has_column_privilege('anon','public.betriebe','hub_woerter','SELECT')
         then 'ok' else 'FEHL' end);

  -- 5 · Und anon darf NICHT schreiben. Das ist die Haelfte, die man
  --     vergisst: Ein Waechter neben einer offenen Tuer ist keiner.
  insert into probe values ('anon schreibt NICHT',
    case when has_column_privilege('anon','public.gerichte','name_uebersetzungen','UPDATE')
         then 'FEHL — anon darf schreiben' else 'ok' end);
end $$;

select * from probe;
rollback;
