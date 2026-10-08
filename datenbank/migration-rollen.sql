-- ═══════════════════════════════════════════════════════════════════
--  migration-rollen.sql · Besitzer, Team, Küche — mit Wirkung
--  (Wunsch zweiter Tag: „Mitarbeiter- und Besitzer-Konto mit
--  Rechteeinschränkungen, damit ein Mitarbeiter nichts Falsches einbaut,
--  das die Gäste direkt sehen“)
--
--  BEFUND (live gelesen): betrieb_mitglieder.rolle gab es längst
--  (inhaber/team/kueche, Liste nur in der Edge master-zugang), aber
--  keine Regel und keine Funktion las sie. Jede Schreibregel hing an
--  meine_betriebe() ohne Rolle — jedes Mitglied durfte alles, was der
--  Gast sieht. Live: 3 Mitglieder, alle 'inhaber'.
--
--  ENTSCHIEDEN: Das Team führt den Betrieb (Bestellungen, Reservierungen,
--  Notizen, Ausverkauft, Bestellpause, Code an einer Bestellung
--  einlösen). Alles, was der Gast im Hub sieht, ändert nur der Inhaber
--  (Preise, Gerichte anlegen/ändern/löschen, Startseite, Texte, Figur,
--  Schrift, Lieferung, Karten, Aktionen/Rabatte, Gutscheine, Newsletter).
--
--  WIE: Die Datenbank entscheidet, nicht das Board (UI-Ausblenden hält
--  niemanden auf). Zwei Werkzeuge:
--   · Regeln (RLS), wo eine ganze Operation nur dem Inhaber gehört
--     (Gericht anlegen/löschen, Aktionen, Gutscheine, Bilder hochladen).
--   · Trigger-Wache, wo das Team EINE Spalte einer Zeile ändern darf
--     (gerichte.verfuegbar, betriebe.bestell_pause/_text) — Postgres
--     kennt keine Spalten-Regeln je Rolle der Anwendung.
--  Die Wache greift nur für die Rolle 'authenticated'. Security-definer-
--  Funktionen (Master, Gastwege) laufen als Eigentümer und bleiben
--  unberührt. Alle heutigen Mitglieder sind Inhaber → niemand verliert
--  ohne eigenes Zutun etwas (§2.5).
--
--  ANGEWENDET (Supabase-MCP, in Stücken 1, 2, 3a/3b, Trigger, 4, 4b).
--  Vorher in zurückgedrehter Transaktion, Zeilenzahl statt Ausnahme
--  (§2.3b), Rolle über request.jwt.claims (§2.4); das Team war ein
--  echtes Konto, testweise als 'team' bei Choco eingetragen:
--   Team:    Rolle 'team', liest 104 Gerichte (Voraussetzung);
--            hub_texte → 42501 nur_inhaber; bestell_pause → 1;
--            bestell_pause_text → 1 (andere Spalte derselben Zeile, §2.7);
--            Preis → 42501; verfuegbar → 1; Gericht anlegen → RLS;
--            Gericht löschen → 0 (Team SIEHT das Gericht); Aktion,
--            Gutschein, Bild, Bildauftrag anlegen → RLS; vorhandenen
--            Gutschein ändern/löschen → 0 (Team SIEHT ihn).
--   Inhaber: hub_texte, Preis, anlegen, löschen, Aktion, Gutschein,
--            Bild, Bildauftrag → je 1; fremder Betrieb → 0.
--   postgres (wie Master-/Gast-Funktionen): hub_texte → 1.
--  Gegenbeweis (zurückgedreht): Wachen aus, Teil 4 nicht eingespielt →
--  Team: hub_texte, Preis, Gericht anlegen, Gutschein je 1.
--  Danach die Anhäufung gelesen (§2.3): keine Team-Schreibregel mehr auf
--  gerichte (außer UPDATE + Wache), aktionen, gutscheine, Bildern,
--  Schriften, bild_auftraege.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Spalten der Mitgliedschaft ─────────────────────────────────
alter table public.betrieb_mitglieder
  add column if not exists anzeigename           text,
  add column if not exists darf_gutscheine       boolean      not null default false,
  add column if not exists gutschein_max_betrag  numeric(8,2) not null default 10,
  add column if not exists gutschein_max_prozent numeric(5,2) not null default 20,
  add column if not exists gutschein_tag_max     integer      not null default 5;

do $$ begin
  alter table public.betrieb_mitglieder
    add constraint betrieb_mitglieder_rolle_check check (rolle in ('inhaber','team','kueche'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.betrieb_mitglieder
    add constraint betrieb_mitglieder_grenzen check (
      (anzeigename is null or length(anzeigename) between 1 and 60)
      and gutschein_max_betrag  between 0 and 500
      and gutschein_max_prozent between 0 and 100
      and gutschein_tag_max     between 0 and 100);
exception when duplicate_object then null; end $$;

-- ── 2 · Wer ist Inhaber? (gebaut wie meine_betriebe, also MIT PIN) ──
create or replace function public.meine_betriebe_inhaber()
returns setof uuid language sql stable security definer set search_path = public as $function$
  select m.betrieb_id
    from public.betrieb_mitglieder m
    join public.betriebe b on b.id = m.betrieb_id
   where m.nutzer_id = auth.uid()
     and m.rolle = 'inhaber'
     and (b.pin_pflicht is not true or public.pin_ok());
$function$;

create or replace function public.ist_inhaber(p_betrieb uuid)
returns boolean language sql stable security definer set search_path = public as $function$
  select p_betrieb in (select public.meine_betriebe_inhaber()) or public.ist_master();
$function$;

/* Für das Board: welche Rolle habe ich hier? 'master' für die Zentrale,
   null für Fremde (dann sieht das Board ohnehin nichts). */
create or replace function public.meine_rolle(p_betrieb uuid)
returns text language sql stable security definer set search_path = public as $function$
  select case
    when public.ist_master() then 'master'
    else (select m.rolle from public.betrieb_mitglieder m
           where m.betrieb_id = p_betrieb and m.nutzer_id = auth.uid()
             and p_betrieb in (select public.meine_betriebe()))
  end;
$function$;

-- In Regeln benutzt → EXECUTE für jede Rolle, die die Zeile schreibt (§2.7).
revoke execute on function public.meine_betriebe_inhaber() from public, anon;
revoke execute on function public.ist_inhaber(uuid)        from public, anon;
revoke execute on function public.meine_rolle(uuid)        from public, anon;
grant  execute on function public.meine_betriebe_inhaber() to authenticated;
grant  execute on function public.ist_inhaber(uuid)        to authenticated;
grant  execute on function public.meine_rolle(uuid)        to authenticated;

-- ── 3 · Wache: das Team darf je Zeile nur seine Spalten ändern ─────
-- SECURITY INVOKER mit Absicht: In einer definer-Funktion wäre
-- current_user immer der Eigentümer, und die Wache übersähe jeden
-- Aufrufer. (Fast so eingespielt — beim Durchlesen gefunden.)
create or replace function public.betrieb_rolle_wache()
returns trigger language plpgsql security invoker set search_path = public as $function$
begin
  if current_user <> 'authenticated' then return new; end if;   -- Master-/Gast-Funktionen
  if public.ist_inhaber(new.id) then return new; end if;
  if (to_jsonb(new) - array['bestell_pause','bestell_pause_text'])
     is distinct from (to_jsonb(old) - array['bestell_pause','bestell_pause_text']) then
    raise exception 'nur_inhaber' using errcode = '42501',
      hint = 'Nur der Besitzer kann das ändern.';
  end if;
  return new;
end $function$;

create or replace function public.gericht_rolle_wache()
returns trigger language plpgsql security invoker set search_path = public as $function$
begin
  if current_user <> 'authenticated' then return new; end if;
  if public.ist_inhaber(new.betrieb_id) then return new; end if;
  if (to_jsonb(new) - array['verfuegbar','geaendert'])
     is distinct from (to_jsonb(old) - array['verfuegbar','geaendert']) then
    raise exception 'nur_inhaber' using errcode = '42501',
      hint = 'Nur der Besitzer kann das ändern.';
  end if;
  return new;
end $function$;

-- Trigger brauchen kein EXECUTE; ohne Entzug wären sie /rpc/… (§2.3a).
revoke execute on function public.betrieb_rolle_wache() from public, anon, authenticated;
revoke execute on function public.gericht_rolle_wache() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'betrieb_rolle_wache' and tgrelid = 'public.betriebe'::regclass) then
    create trigger betrieb_rolle_wache before update on public.betriebe
      for each row execute function public.betrieb_rolle_wache();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'gericht_rolle_wache' and tgrelid = 'public.gerichte'::regclass) then
    create trigger gericht_rolle_wache before update on public.gerichte
      for each row execute function public.gericht_rolle_wache();
  end if;
end $$;

-- ── 4 · Regeln: ganze Operationen nur für den Inhaber ──────────────
-- OHNE drop: Die bestehenden ALL-Regeln werden umbenannt und auf
-- ist_inhaber() verengt, die Team-Wege kommen als EIGENE Regeln dazu.
-- Erlaubende Regeln verknüpft Postgres mit ODER — dieselbe Wirkung wie
-- „löschen und neu anlegen“, aber ohne einen Augenblick, in dem die
-- Tabelle gar keine Schreibregel hat. (Anlass, ehrlich: Das Supabase-
-- Werkzeug hält eine Zeile, die mit drop oder delete beginnt, für
-- „destruktiv“ und wartet auf eine Bestätigung — in einer Sitzung ohne
-- Gegenüber 60 s lang, dann Abbruch. Das ist eine Schutzschranke, kein
-- Fehler; sie wird nicht umgangen. Was wirklich löscht, läuft im
-- SQL-Editor. Hier war alter policy ohnehin die bessere Form.)
-- ist_inhaber() schließt ist_master() ein; die Zentrale bleibt also drin.

-- gerichte: Team ändert (die Wache begrenzt die Spalten), anlegen und
-- löschen nur Inhaber.
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='gerichte' and policyname='gerichte team schreibt') then
    alter policy "gerichte team schreibt" on public.gerichte rename to "gerichte inhaber pflegt";
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gerichte' and policyname='gerichte team aendert') then
    create policy "gerichte team aendert" on public.gerichte for update to authenticated
      using      (betrieb_id in (select public.meine_betriebe()) or public.ist_master())
      with check (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
  end if;
end $$;
alter policy "gerichte inhaber pflegt" on public.gerichte
  using (public.ist_inhaber(betrieb_id)) with check (public.ist_inhaber(betrieb_id));

-- aktionen: Team liest ("aktion team liest" bleibt), schreiben nur Inhaber.
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='aktionen' and policyname='aktion team pflegt') then
    alter policy "aktion team pflegt" on public.aktionen rename to "aktion inhaber pflegt";
  end if;
end $$;
alter policy "aktion inhaber pflegt" on public.aktionen
  using (public.ist_inhaber(betrieb_id)) with check (public.ist_inhaber(betrieb_id));

-- gutscheine: lesen alle Mitglieder; schreiben nur Inhaber — bis die
-- Ausstellung über gutschein_ausstellen() mit Recht + PIN läuft
-- (migration-gutschein-sicher.sql), dann wird das direkte Schreiben
-- ganz entzogen.
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='gutscheine' and policyname='gutscheine team pflegt') then
    alter policy "gutscheine team pflegt" on public.gutscheine rename to "gutscheine inhaber pflegt";
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gutscheine' and policyname='gutscheine team liest') then
    create policy "gutscheine team liest" on public.gutscheine for select to authenticated
      using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
  end if;
end $$;
alter policy "gutscheine inhaber pflegt" on public.gutscheine
  using (public.ist_inhaber(betrieb_id)) with check (public.ist_inhaber(betrieb_id));

-- Bilder und Schriften: hochladen/ersetzen/löschen nur Inhaber. Namen
-- bleiben (das Board kennt sie nicht, Supabase zeigt sie nur an).
alter policy "bilder team laedt hoch" on storage.objects
  with check (bucket_id = 'gerichte'
    and ((storage.foldername(name))[1])::uuid in (select public.meine_betriebe_inhaber()));
alter policy "bilder team ersetzt" on storage.objects
  using (bucket_id = 'gerichte'
    and ((storage.foldername(name))[1])::uuid in (select public.meine_betriebe_inhaber()));
alter policy "bilder team loescht" on storage.objects
  using (bucket_id = 'gerichte'
    and ((storage.foldername(name))[1])::uuid in (select public.meine_betriebe_inhaber()));
alter policy "schriften team laedt hoch" on storage.objects
  with check (bucket_id = 'schriften'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,60}\.(woff2|woff|ttf|otf)$'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then ((storage.foldername(name))[1])::uuid in (select public.meine_betriebe_inhaber())
             else false end);

-- Profi-Foto: Der Eintrag in bild_auftraege IST die Tür zum bezahlten
-- fal-Aufruf (supabase/functions/gericht-bild: „Scheitert er, geht kein
-- Auftrag an fal hinaus“). Nur Inhaber — das Team kann ein fertiges
-- Profi-Foto ohnehin nicht übernehmen (Wache auf gerichte).
alter policy "bild_auftraege team legt an" on public.bild_auftraege
  with check (public.ist_inhaber(betrieb_id));

-- Bewusst NICHT verengt (Team führt den Betrieb, nichts davon sieht der
-- Gast als Inhalt des Hauses): bestellungen, reservierungen, servicerufe,
-- notizen, ereignisse, push_geraete, tische.
