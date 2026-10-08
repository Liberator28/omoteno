-- ═══════════════════════════════════════════════════════════════════
--  migration-protokoll.sql · Wer hat was geändert
--  (Wunsch zweiter Tag: „nachvollziehen, wer den Gutschein ausgestellt
--  hat“ — und allgemein, wer im Hub etwas geändert hat)
--
--  BEFUND: Kein Schreibweg hielt fest, WER schrieb. Bis gestern gab es
--  auch keinen Grund dafür — alle teilten einen Zugang. Mit eigenen
--  Zugängen je Person (migration-team.sql) hat jede Änderung jetzt einen
--  Namen, der sich lohnt festzuhalten.
--
--  WIE:
--   · protokoll: nur über Trigger beschrieben. Kein INSERT/UPDATE/DELETE
--     für irgendeine Rolle der Anwendung; lesen nur der Inhaber.
--   · Wer, kommt aus auth.uid() — nie aus der Anfrage. Der Name kommt aus
--     der Mitgliedschaft (anzeigename) oder der Anmelde-Adresse, im
--     Augenblick der Änderung festgehalten (eine spätere Umbenennung
--     schreibt die Geschichte nicht um).
--   · Ohne Anmeldung (Gast-Funktionen, Dienstschlüssel, Erzeuger) wird
--     nichts geschrieben: Das sind keine Entscheidungen einer Person.
--     Die Edge Function team-zugang trägt ihre Zeilen selbst ein.
--   · Nur Spalten, die sich WIRKLICH geändert haben, und keine, die nur
--     mitlaufen (Reihenfolge, Zeitstempel, automatische Übersetzungen).
--     Große Werte (Kacheln, Markenblatt) werden gekürzt gespeichert —
--     das Protokoll sagt WAS sich änderte, es ist keine Sicherung.
--   · AFTER-Trigger: Was die Wache (migration-rollen.sql) abweist, steht
--     nie im Protokoll — dort steht nur, was wirklich geschah.
--
--  ANGEWENDET (Supabase-MCP), vorher zurückgedreht an Choco gemessen:
--  Preis geändert → Zeile mit Adresse des Inhabers, vorher 10.40 →
--  nachher 11.40; NUR reihenfolge geändert → keine Zeile; Kacheln →
--  „… (2157 Zeichen)“; Team setzt ausverkauft → Zeile mit Anzeigename;
--  Team ändert Hub-Text → Wache weist ab, KEINE Zeile; ohne Anmeldung
--  geändert → keine Zeile; Team liest 0 / schreibt → abgewiesen; anon
--  liest nicht; protokoll_schreiben nicht als /rpc/ rufbar. Danach alle
--  sechs Trigger im Katalog nachgelesen.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.protokoll (
  id         bigint generated always as identity primary key,
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  nutzer_id  uuid,
  name       text,
  tabelle    text not null check (tabelle in ('betriebe','gerichte','aktionen','gutscheine','rabattcodes','team')),
  art        text not null check (art in ('neu','geaendert','geloescht')),
  ziel       text,
  felder     text[] not null default '{}',
  vorher     jsonb,
  nachher    jsonb,
  zeit       timestamptz not null default now()
);
create index if not exists protokoll_betrieb_zeit on public.protokoll (betrieb_id, zeit desc, id desc);

alter table public.protokoll enable row level security;
revoke all on public.protokoll from public, anon, authenticated;
grant select on public.protokoll to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='protokoll' and policyname='protokoll inhaber liest') then
    create policy "protokoll inhaber liest" on public.protokoll for select to authenticated
      using (public.ist_inhaber(betrieb_id));
  end if;
end $$;

-- Name im Augenblick der Änderung: Anzeigename im Betrieb, sonst Adresse.
create or replace function public.protokoll_name()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if new.name is null and new.nutzer_id is not null then
    select coalesce(nullif(m.anzeigename, ''), u.email::text) into new.name
      from auth.users u
      left join public.betrieb_mitglieder m on m.nutzer_id = u.id and m.betrieb_id = new.betrieb_id
     where u.id = new.nutzer_id;
  end if;
  return new;
end $function$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'protokoll_name' and tgrelid = 'public.protokoll'::regclass) then
    create trigger protokoll_name before insert on public.protokoll
      for each row execute function public.protokoll_name();
  end if;
end $$;

-- Ein langer Wert wird zu einem Hinweis, wie lang er war.
create or replace function public.protokoll_kurz(p jsonb)
returns jsonb language sql immutable set search_path = public as $function$
  select case when p is null then null
              when length(p::text) > 400 then to_jsonb('… (' || length(p::text) || ' Zeichen)')
              else p end;
$function$;

create or replace function public.protokoll_schreiben()
returns trigger language plpgsql security definer set search_path = public as $function$
declare
  v_uid    uuid := auth.uid();
  v_alt    jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_neu    jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_zeile  jsonb := coalesce(v_neu, v_alt);
  v_ruhig  text[] := array['reihenfolge','kat_sort','geaendert','uebersetzungen','name_uebersetzungen',
                           'hub_woerter','erzeugt_am','angelegt'];
  v_felder text[];
  v_betrieb uuid;
begin
  if v_uid is null then return null; end if;      -- keine Person, keine Entscheidung
  v_betrieb := case when tg_table_name = 'betriebe' then (v_zeile->>'id')::uuid
                    else (v_zeile->>'betrieb_id')::uuid end;
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_felder
      from jsonb_each(v_neu) n
     where n.value is distinct from v_alt->n.key and n.key <> all(v_ruhig);
    if v_felder is null then return null; end if;  -- nur Mitläufer geändert
  end if;
  insert into public.protokoll (betrieb_id, nutzer_id, tabelle, art, ziel, felder, vorher, nachher)
  values (v_betrieb, v_uid, tg_table_name,
          case tg_op when 'INSERT' then 'neu' when 'DELETE' then 'geloescht' else 'geaendert' end,
          left(coalesce(v_zeile->>'name', v_zeile->>'gericht_name', v_zeile->>'titel', v_zeile->>'code'), 120),
          coalesce(v_felder, '{}'),
          case when tg_op = 'UPDATE'
               then (select jsonb_object_agg(f, public.protokoll_kurz(v_alt->f)) from unnest(v_felder) f) end,
          case when tg_op = 'UPDATE'
               then (select jsonb_object_agg(f, public.protokoll_kurz(v_neu->f)) from unnest(v_felder) f) end);
  return null;
end $function$;

-- Trigger-Funktionen brauchen kein EXECUTE; ohne Entzug wären sie /rpc/… (§2.3a).
revoke execute on function public.protokoll_schreiben() from public, anon, authenticated;
revoke execute on function public.protokoll_name()      from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['betriebe','gerichte','aktionen','gutscheine','rabattcodes'] loop
    if not exists (select 1 from pg_trigger where tgname = 'protokoll_' || t and tgrelid = ('public.' || t)::regclass) then
      execute format('create trigger %I after insert or update or delete on public.%I
                      for each row execute function public.protokoll_schreiben()', 'protokoll_' || t, t);
    end if;
  end loop;
end $$;
