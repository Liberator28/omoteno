-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET 2026-09-25 (Supabase, Migration „kategorie_emoji“), live
--  geprobt in zurückgedrehter Transaktion: Team setzt Zeichen (5 Zeilen),
--  Umbenennen behält es, Pfad/HTML abgewiesen, anon liest, schreibt nicht.
--
--  gerichte.kat_emoji — das bewegte Zeichen einer Kategorie
--
--  Wie kat_sort ist das eine Eigenschaft der KATEGORIE, liegt aber an
--  jedem Gericht; alle Gerichte einer Kategorie tragen denselben Wert.
--  Das Board schreibt ihn beim Wählen auf alle Zeilen der Kategorie.
--
--  Wert: Name der Datei in auslieferung/emoji/ ohne ".json" —
--  ein Codepunkt ("1f37e") oder ein eigenes Zeichen ("soda", "crepe").
--  null heißt: automatisch nach dem Namen der Kategorie (BZ_KATEGORIE).
--  Der Hub nimmt nur Werte, die er kennt (BZ_WAHL); alles andere fällt
--  still auf die Automatik zurück. Die Schranke hier hält nur die Form
--  fest, damit niemand Text oder Pfade hineinschreibt.
--
--  Rechte: anon liest gerichte spaltenweise (Speisekarte im Hub) —
--  die neue Spalte wird ausdrücklich freigegeben, sonst fehlt sie dem
--  Hub still. authenticated schreibt über die bestehende Regel
--  „gerichte team schreibt“.
--
--  Additiv: legt nur an, ändert nichts Bestehendes.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.gerichte
  add column if not exists kat_emoji text;

comment on column public.gerichte.kat_emoji is
  'Bewegtes Zeichen der Kategorie (Datei in /emoji/ ohne .json), null = automatisch';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gerichte_kat_emoji_form') then
    alter table public.gerichte
      add constraint gerichte_kat_emoji_form
      check (kat_emoji is null or kat_emoji ~ '^[a-z0-9]{1,12}$');
  end if;
end $$;

grant select (kat_emoji) on public.gerichte to anon;
grant select (kat_emoji), update (kat_emoji), insert (kat_emoji) on public.gerichte to authenticated;

commit;
