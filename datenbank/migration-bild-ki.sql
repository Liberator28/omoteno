-- ═══════════════════════════════════════════════════════════════════
--  Profi-Foto und Pop-Freisteller je Gericht (Edge Function gericht-bild)
--
--  gerichte.bild_frei   Adresse des Freistellers (transparentes WebP im
--                       Speicher „gerichte“). NICHT das vorhandene
--                       gerichte.frei (boolean): das meint „eigene Datei
--                       im Verzeichnis unter bilder/frei/“ — ein anderes
--                       Ding unter einem ähnlichen Namen (CLAUDE.md §1.1a).
--
--  bild_auftraege       Ein Eintrag je Auftrag an den Bilddienst — für die
--                       Monatsgrenze je Betrieb. Das Team darf eigene
--                       Zeilen LESEN und ANLEGEN (die Edge Function läuft
--                       mit den Rechten des Aufrufers, ohne Service-
--                       Schlüssel), aber weder ändern noch löschen — sonst
--                       ließe sich die Grenze zurückdrehen.
--
--  betriebe.plan        bekommt eine CHECK-Liste (§2.3c): Die Edge
--                       Function entscheidet über den Tarif an genau
--                       diesen Werten. null bleibt erlaubt und heißt
--                       „noch keinem Tarif zugeordnet“ (Bestandskunde).
--
--  Additiv. Rechte vorher gelesen: anon hat SELECT auf gerichte auf
--  Tabellenebene — die neue Spalte ist damit für den Hub lesbar, ohne
--  weiteres grant. authenticated hat UPDATE auf gerichte (RLS: eigener
--  Betrieb). REIHENFOLGE (§2.5): vor dem Hub, der bild_frei im select
--  nennt, anwenden.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.gerichte add column if not exists bild_frei text;

comment on column public.gerichte.bild_frei is
  'Freisteller (transparentes WebP) im Speicher gerichte, vom Betrieb im Board '
  'übernommen. Pop-Ansicht im Hub. Nicht verwechseln mit frei (boolean).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gerichte_bild_frei_form') then
    alter table public.gerichte add constraint gerichte_bild_frei_form check (
      bild_frei is null or (length(bild_frei) <= 500 and bild_frei ~ '^https://'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'betriebe_plan_liste') then
    alter table public.betriebe add constraint betriebe_plan_liste check (
      plan is null or plan in ('basic', 'assistent', 'alessia'));
  end if;
end $$;

create table if not exists public.bild_auftraege (
  id           uuid primary key default gen_random_uuid(),
  betrieb_id   uuid not null references public.betriebe(id) on delete cascade,
  gericht_name text,
  art          text not null default 'profi_frei' check (art in ('profi_frei')),
  erstellt_am  timestamptz not null default now()
);
create index if not exists bild_auftraege_betrieb_zeit
  on public.bild_auftraege (betrieb_id, erstellt_am desc);

alter table public.bild_auftraege enable row level security;

drop policy if exists "bild_auftraege team liest" on public.bild_auftraege;
create policy "bild_auftraege team liest" on public.bild_auftraege
  for select to authenticated
  using (betrieb_id in (select meine_betriebe()) or ist_master());

drop policy if exists "bild_auftraege team legt an" on public.bild_auftraege;
create policy "bild_auftraege team legt an" on public.bild_auftraege
  for insert to authenticated
  with check (betrieb_id in (select meine_betriebe()) or ist_master());

revoke all on public.bild_auftraege from anon, authenticated;
grant select, insert on public.bild_auftraege to authenticated;

commit;
