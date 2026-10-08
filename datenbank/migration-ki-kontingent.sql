-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET 08.10. (Supabase-MCP) · migration-ki-kontingent.sql
--  Tageskontingent für die Übersetzung — vorher zurückgedreht geprüft:
--  400 je Tag, danach -1 ohne Abbuchung, > 25 je Aufruf abgewiesen,
--  anon ohne Recht.
--
--  BEFUND (08.10.): Die Edge Function „uebersetzen“ ruft Anthropic auf
--  Rechnung des Betreibers. Sie verlangt nur, dass der Aufrufer
--  Mitglied IRGENDEINES Betriebs ist — und über konto.html kann sich
--  jeder registrieren und einen Betrieb anlegen. 25 Texte je Aufruf,
--  aber beliebig viele Aufrufe: Ein Skript (oder ein KI-Agent) hätte
--  das Guthaben in einer Nacht verbrannt.
--
--  WIE: Zählen VOR dem Aufruf, wie bei gericht-bild (bild_auftraege).
--  Je Betrieb und Kalendertag (Europe/Berlin) höchstens 400 Texte —
--  eine ganze Karte mit 100 Gerichten (Name + Beschreibung) passt
--  zweimal hinein. Betriebe, die noch keinem Tarif zugeordnet sind und
--  jünger als 7 Tage (Selbstregistrierung), bekommen 60.
--  ki_kontingent_nehmen() bucht nur, wenn es reicht — sonst -1, und
--  nichts wird abgebucht. Master ist nicht gedeckelt.
--
--  Die Edge Function läuft auch ohne diese Migration weiter (Funktion
--  fehlt → 42883 → ohne Deckel, wie bisher). Erst mit ihr greift der
--  Deckel.
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.ki_kontingent (
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  tag        date not null,
  texte      integer not null default 0,
  primary key (betrieb_id, tag)
);
alter table public.ki_kontingent enable row level security;
revoke all on public.ki_kontingent from anon, authenticated;

create or replace function public.ki_kontingent_nehmen(p_anzahl integer)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  v_betrieb uuid; v_tag date := (now() at time zone 'Europe/Berlin')::date;
  v_grenze integer := 400; v_jetzt integer; v_plan text; v_alt timestamptz;
begin
  if ist_master() then return 999999; end if;
  select b into v_betrieb from meine_betriebe() b limit 1;
  if v_betrieb is null or p_anzahl is null or p_anzahl < 1 or p_anzahl > 25 then return -1; end if;
  select plan, angelegt into v_plan, v_alt from betriebe where id = v_betrieb;
  if v_plan is null and v_alt > now() - interval '7 days' then v_grenze := 60; end if;
  insert into ki_kontingent(betrieb_id, tag, texte) values (v_betrieb, v_tag, 0)
    on conflict (betrieb_id, tag) do nothing;
  update ki_kontingent set texte = texte + p_anzahl
   where betrieb_id = v_betrieb and tag = v_tag and texte + p_anzahl <= v_grenze
   returning texte into v_jetzt;
  if v_jetzt is null then return -1; end if;
  return v_grenze - v_jetzt;
end $$;
revoke execute on function public.ki_kontingent_nehmen(integer) from public, anon;
grant execute on function public.ki_kontingent_nehmen(integer) to authenticated;
