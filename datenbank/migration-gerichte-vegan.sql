-- ═══════════════════════════════════════════════════════════════════
--  NOCH NICHT ANGEWENDET · gerichte.vegan — eigenes Zeichen neben „vegetarisch“
--
--  Anwenden im SQL-Editor von Supabase. Additiv (CLAUDE.md §2.5): eine
--  neue Spalte mit Vorgabewert false ändert an keiner bestehenden Zeile
--  etwas, solange niemand sie liest — das Board und der Hub lesen sie
--  erst mit dem Code, der zusammen mit dieser Datei ausgeliefert wird.
--
--  BEFUND: `gerichte.veg` (vegetarisch) gibt es längst und fließt
--  bereits ungeprüft an den Gast — dieselbe Spalte diente bisher auch
--  als Behelf für „vegan“ (Gerichtsname trug das Wort von Hand, siehe
--  „Obstsalat vegan“ in der Vorführkarte). Eine eigene Spalte macht
--  daraus ein echtes, antippbares Merkmal statt eines Wortes im Namen.
--
--  Kein RLS-Eingriff nötig: `gerichte` hat bereits eine Regel, die dem
--  Team volles Schreiben und jedem (auch anon, über den öffentlichen
--  Hub) Lesen der ganzen Zeile erlaubt — genau der Weg, über den `veg`
--  heute schon beim Gast ankommt (select("*") in beiden Boards).
-- ═══════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gerichte' and column_name = 'veg')
  then raise exception 'gerichte.veg fehlt — Annahme falsch, nichts angelegt.';
  end if;
end $$;

alter table public.gerichte
  add column if not exists vegan boolean not null default false;

comment on column public.gerichte.vegan is
  'Rein pflanzlich (kein Ei, keine Milch, kein Honig) — unabhängig von '
  '„veg“ (vegetarisch), das Ei und Milch erlaubt. Ein vegan=true Gericht '
  'gilt automatisch als vegetarisch, das Board setzt beide zusammen.';

commit;

-- ── DANACH PRÜFEN ────────────────────────────────────────────────
--
-- 1 · Spalte da, richtiger Typ, richtiger Vorgabewert?
--
--   select column_name, data_type, column_default
--   from information_schema.columns
--   where table_schema='public' and table_name='gerichte' and column_name='vegan';
--
-- 2 · Bestehende Zeilen unverändert (alle false, nichts „kaputt“
--     gerechnet)?
--
--   select count(*) filter (where vegan) as vegan_ja,
--          count(*) filter (where not vegan) as vegan_nein
--   from public.gerichte;
--   → vegan_ja muss 0 sein, direkt nach dem Einspielen
--
-- 3 · Kommt sie beim Gast an, genau wie „veg“ es tut? Mit dem
--     anon-Schlüssel, wie der Hub selbst:
--
--   curl -s "$SUPABASE_URL/rest/v1/gerichte?select=name,veg,vegan&limit=1" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
