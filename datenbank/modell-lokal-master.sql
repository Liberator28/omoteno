create type public.betrieb_zustand as enum ('test','aktiv','pausiert','gekuendigt');
alter table public.betriebe add column zustand public.betrieb_zustand not null default 'aktiv', add column test_bis timestamptz,
  add column plan text, add column preis_monat numeric, add column vertrag_ab date, add column gekuendigt_zum date,
  add column rechnung_an jsonb, add column hub_texte jsonb, add column bestell_pause boolean default false,
  add column bestell_pause_text text, add column tisch_pflicht boolean default false, add column markenblatt jsonb,
  add column hub_kacheln jsonb, add column hub_woerter jsonb, add column liefer jsonb, add column newsletter_aktiv boolean,
  add column hub_avatar jsonb, add column hub_banner jsonb, add column hub_stil jsonb, add column ziele jsonb;
alter table public.betriebe add constraint betriebe_plan_liste check (plan is null or plan = any (array['basic','assistent','alessia']));
alter table public.betriebe add constraint betriebe_test_hat_frist check (zustand <> 'test' or test_bis is not null);
-- So steht es live: UPDATE auf die ganze Tabelle.
grant update on public.betriebe to authenticated;
grant select (plan, preis_monat, zustand, test_bis, hub_texte) on public.betriebe to authenticated;
create table public.rechnungen(id uuid primary key default gen_random_uuid(), betrieb_id uuid references public.betriebe(id) on delete cascade,
  nummer text unique, zeitraum_von date, zeitraum_bis date, netto numeric, steuersatz numeric, brutto numeric, posten jsonb,
  gestellt_am date, faellig_am date, bezahlt_am date, datei text, angelegt timestamptz default now());
alter table public.rechnungen enable row level security;
create policy "rechnung inhaber liest" on public.rechnungen for select to authenticated using (betrieb_id in (select meine_betriebe()) or ist_master());
grant select, insert, update, delete on public.rechnungen to authenticated;
insert into public.admin_login_schutz(nutzer_id, fehlversuche, gesperrt) values ('00000000-0000-0000-0000-00000000000a', 3, true);
