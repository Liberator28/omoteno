-- ═══════════════════════════════════════════════════════════════════
--  migration-saalplan.sql · Der Saalplan: Tische mit Platz auf einer Karte
--
--  Wunsch 19.10.: „eine eigene 3D-Karte aller Tische im Restaurant, in der
--  man die Tische einsetzen kann“. Die Tische gibt es längst (public.tische,
--  eine Zeile je Untersetzer, angelegt von Omoteno). Neu ist nur ihre LAGE:
--
--    x, y      Platz auf dem Plan, 0 … 100 (Raster; null = nicht platziert)
--    form      rund · eckig · lang
--    plaetze   Stühle, 1 … 20 (nur fürs Bild)
--
--  Additiv (§2.5): Solange kein Tisch eine Lage hat, ändert sich im Board
--  nichts — es bleibt die Liste.
--
--  RECHTE (§2.3f — der Fund beim Bau): authenticated hatte auf tische
--  INSERT/UPDATE/DELETE/TRUNCATE über die Regel „tische team pflegt“ (ALL,
--  jedes Mitglied). Damit konnte jedes Teammitglied die Nummer oder den
--  SCHLÜSSEL eines Untersetzers umschreiben — und mit dem Schlüssel
--  bestellt der Gast für den Tisch. Kein Browser-Weg schreibt dort (gesucht:
--  admin, konto, kueche, master, einkauf, Edge Functions — nur select).
--  Jetzt: schreiben darf nur der INHABER, und nur die vier Lagespalten.
--
--  §2.8: Die alte Regel wird NICHT gelöscht (das Werkzeug hält Zeilen mit
--  drop an), sondern stillgelegt (using false) — eine ALL-Regel mit false
--  trifft keine Zeile. Wer sie ganz entfernen will, tut es im SQL-Editor:
--      drop policy "tische team pflegt" on public.tische;
-- ═══════════════════════════════════════════════════════════════════

alter table public.tische add column if not exists x       numeric;
alter table public.tische add column if not exists y       numeric;
alter table public.tische add column if not exists form    text;
alter table public.tische add column if not exists plaetze smallint;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tische_lage_grenzen') then
    alter table public.tische add constraint tische_lage_grenzen check (
      (x is null or (x >= 0 and x <= 100)) and
      (y is null or (y >= 0 and y <= 100)) and
      (form is null or form in ('rund', 'eckig', 'lang')) and
      (plaetze is null or (plaetze >= 1 and plaetze <= 20)) and
      ((x is null) = (y is null)));
  end if;
end $$;

-- Schreiben: nur Inhaber (oder Master), nur die Lage.
alter policy "tische team pflegt" on public.tische using (false) with check (false);

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tische'
                  and policyname = 'tische inhaber legt lage') then
    create policy "tische inhaber legt lage" on public.tische for update to authenticated
      using (public.ist_inhaber(betrieb_id))
      with check (public.ist_inhaber(betrieb_id));
  end if;
end $$;

revoke insert, update, delete, truncate, references, trigger on public.tische from authenticated, anon;
grant select on public.tische to authenticated;
grant update (x, y, form, plaetze) on public.tische to authenticated;

comment on column public.tische.x is 'Saalplan: Platz von links, 0 … 100; null = nicht auf dem Plan.';
comment on column public.tische.y is 'Saalplan: Platz von oben, 0 … 100; null = nicht auf dem Plan.';
comment on column public.tische.form is 'Saalplan: rund, eckig oder lang.';
comment on column public.tische.plaetze is 'Saalplan: Zahl der Stühle im Bild (1 … 20).';
