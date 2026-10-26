-- ═══════════════════════════════════════════════════════════════════
--  MIGRATION · Annahme von AGB und Auftragsverarbeitungsvertrag (AVV)
--  ENTWURF 26.10. — NOCH NICHT EINGESPIELT (Supabase war nicht erreichbar)
--
--  Rechtsbericht R1 (dokumente/recht/14-…): Ohne wirksam einbezogene AGB gilt
--  Mietrecht ohne Haftungsgrenze, ohne AVV fehlt der Art.-28-Vertrag. Diese
--  Migration hält fest, WER WANN WELCHE FASSUNG angenommen hat.
--
--  public.vertrag_annahmen   eine Zeile je Betrieb, Art (agb | avv) und Fassung
--  public.vertrag_annehmen(p_betrieb, p_fassung, p_agb, p_avv)
--       Inhaber nimmt beide an. Antwort immer jsonb { ok, grund? } — nie eine
--       Ausnahme für einen erwartbaren Fall (§2.3g).
--
--  GESCHRIEBEN wird NUR über die Funktion (security definer). Lesen dürfen die
--  Mitglieder des eigenen Betriebs; anon nichts; kein direktes INSERT/UPDATE/DELETE
--  für authenticated (§2.3a/§2.3f: das GRANT ist so eng wie die Regel).
--
--  VORAUSSETZUNG live: public.ist_inhaber(uuid) und public.meine_betriebe() aus
--  migration-rollen.sql / migration-pin.sql (stehen live).
--
--  REIHENFOLGE (§2.5): Tabelle und Funktion dürfen vor dem Konto-Code laufen.
--  Das Konto fragt sie erst ab, wenn VERTRAEGE_AN in konto.html eingeschaltet ist —
--  das geschieht NICHT vor der anwaltlichen Prüfung der Texte. Fehlt die Funktion
--  (404), läuft das Konto wie bisher: kein Zwang, keine Sperre.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.vertrag_annahmen (
  id            uuid primary key default gen_random_uuid(),
  betrieb_id    uuid not null references public.betriebe(id) on delete cascade,
  art           text not null check (art in ('agb', 'avv')),
  fassung       text not null check (fassung ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  nutzer_id     uuid not null,
  angenommen_um timestamptz not null default now(),
  unique (betrieb_id, art, fassung)
);

comment on table public.vertrag_annahmen is
  'Wer hat wann welche Fassung der AGB / des AVV angenommen. Geschrieben nur über vertrag_annehmen().';

alter table public.vertrag_annahmen enable row level security;

revoke all on table public.vertrag_annahmen from public, anon, authenticated;
grant select on table public.vertrag_annahmen to authenticated;

do $$ begin
  create policy vertrag_annahmen_lesen on public.vertrag_annahmen for select to authenticated
    using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());
exception when duplicate_object then null; end $$;

create or replace function public.vertrag_annehmen(p_betrieb uuid, p_fassung text, p_agb boolean, p_avv boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'grund', 'anmeldung');
  end if;
  if p_betrieb is null or p_fassung is null or p_fassung !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return jsonb_build_object('ok', false, 'grund', 'fassung');
  end if;
  if p_agb is not true or p_avv is not true then
    return jsonb_build_object('ok', false, 'grund', 'nicht_beide');
  end if;
  if not public.ist_inhaber(p_betrieb) then
    return jsonb_build_object('ok', false, 'grund', 'kein_inhaber');
  end if;
  insert into public.vertrag_annahmen(betrieb_id, art, fassung, nutzer_id)
    values (p_betrieb, 'agb', p_fassung, v_uid), (p_betrieb, 'avv', p_fassung, v_uid)
    on conflict (betrieb_id, art, fassung) do nothing;
  return jsonb_build_object('ok', true, 'fassung', p_fassung);
end $$;

revoke execute on function public.vertrag_annehmen(uuid, text, boolean, boolean) from public, anon;
grant  execute on function public.vertrag_annehmen(uuid, text, boolean, boolean) to authenticated;
