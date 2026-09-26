-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET 2026-09-25 („tarife_starter_pro_enterprise“). Lokal 12
--  Proben (datenbank/pruef-tarife-lokal.sql), live zurückgedreht:
--  null frei, Starter ohne Newsletter, Pro ohne Alessia, „gold“ abgewiesen.
--
--  MIGRATION · Tarife Starter / Pro / Enterprise
--
--  Wunsch 25.09.2026, bestätigt: Starter 199 €, Pro 249 €, Enterprise
--  499 € im Monat. Was welcher Tarif kann, steht an GENAU EINER Stelle
--  in der Datenbank: tarif_hat(). Board, Master und Edge Functions
--  fragen sie; die Kopie TARIFE in admin.html und master.html (für die
--  Anzeige „ab Pro“) hält pruefungen/pruef-tarife.js Zeile für Zeile
--  gegen diese Datei.
--
--  §2.3c: Die Schranke betriebe_plan_liste wird ERWEITERT, nicht
--  ersetzt — basic, assistent, alessia bleiben gültig (heute ohne
--  Zeile, aber ein verlorener alter Wert fehlt still). Sie zählen wie
--  starter, pro, enterprise.
--
--  §7: plan = null heißt Bestandskunde vor den Tarifen — alles frei,
--  bis der Master einen Tarif setzt. Niemand verliert über Nacht eine
--  Funktion, die er heute benutzt.
-- ═══════════════════════════════════════════════════════════════════
begin;

alter table public.betriebe drop constraint if exists betriebe_plan_liste;
alter table public.betriebe add constraint betriebe_plan_liste
  check (plan is null or plan = any (array['starter','pro','enterprise','basic','assistent','alessia']));

-- Die Rangfolge: 0 Starter, 1 Pro, 2 Enterprise. Alte Namen gleichwertig.
create or replace function public.tarif_stufe(p_plan text)
returns integer
language sql immutable
set search_path to 'public'
as $$
  select case p_plan
    when 'starter' then 0 when 'basic' then 0
    when 'pro' then 1 when 'assistent' then 1
    when 'enterprise' then 2 when 'alessia' then 2
    else null end;
$$;

-- DIE Matrix. Merkmal → kleinste Stufe, die es hat.
--   TARIF-MATRIX ANFANG (pruef-tarife.js liest zwischen den Markern)
--   hub, admin, kueche, uebersetzung, reservierung, gutscheine, auswertung  → 0
--   lieferung, newsletter, auswertung_voll, export, assistent, bild_ki      → 1
--   alessia, standorte, studio, vorrang                                     → 2
--   TARIF-MATRIX ENDE
create or replace function public.tarif_merkmal_stufe(p_merkmal text)
returns integer
language sql immutable
set search_path to 'public'
as $$
  select case p_merkmal
    when 'hub' then 0 when 'admin' then 0 when 'kueche' then 0 when 'uebersetzung' then 0
    when 'reservierung' then 0 when 'gutscheine' then 0 when 'auswertung' then 0
    when 'lieferung' then 1 when 'newsletter' then 1 when 'auswertung_voll' then 1
    when 'export' then 1 when 'assistent' then 1 when 'bild_ki' then 1
    when 'alessia' then 2 when 'standorte' then 2 when 'studio' then 2 when 'vorrang' then 2
    else null end;
$$;

create or replace function public.tarif_hat(p_betrieb uuid, p_merkmal text)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select case
    when public.tarif_merkmal_stufe(p_merkmal) is null then false        -- unbekanntes Merkmal: nie
    when b.plan is null then true                                          -- Bestandskunde: alles frei (§7)
    else coalesce(public.tarif_stufe(b.plan) >= public.tarif_merkmal_stufe(p_merkmal), false)
  end
  from public.betriebe b where b.id = p_betrieb;
$$;

-- KI-Fotos je Monat. Bestandskunden (null) behalten die bisherige Grenze.
create or replace function public.tarif_bilder_monat(p_plan text)
returns integer
language sql immutable
set search_path to 'public'
as $$
  select case
    when p_plan is null then 200
    when public.tarif_stufe(p_plan) = 1 then 150
    when public.tarif_stufe(p_plan) = 2 then 600
    else 0 end;
$$;

grant execute on function public.tarif_stufe(text), public.tarif_merkmal_stufe(text),
  public.tarif_bilder_monat(text) to anon, authenticated;
revoke all on function public.tarif_hat(uuid, text) from public, anon;
grant execute on function public.tarif_hat(uuid, text) to authenticated;

-- Der Master sieht auch die Rabattcodes eines Betriebs (bisher nur das Team).
drop policy if exists rabattcodes_eigene_lesen on public.rabattcodes;
create policy rabattcodes_eigene_lesen on public.rabattcodes
  for select to authenticated
  using (betrieb_id in (select public.meine_betriebe()) or public.ist_master());

commit;
