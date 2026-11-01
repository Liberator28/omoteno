-- ═══════════════════════════════════════════════════════════════════
--  migration-tisch-belegung.sql · Wer sitzt wo, und ist er noch da?
--
--  Wunsch 01.11.: „… so soll man sehen wie viele Leute dort sitzen und
--  welche Bestellungen und ob ein Gast noch da ist.“
--
--  STAND: NICHT EINGESPIELT. Einspielen im SQL-Editor, zusammen mit
--  migration-saal-raeume.sql (Meter, Raster, Theke). Das Board läuft
--  ohne beide weiter wie bisher und sagt, welche Datei fehlt (§7).
--
--  Gelesen vor dem Bau (§1.2):
--  · Personen am Tisch gab es nicht — nur tische.plaetze (Stühle).
--  · tisch_sitzung_start hält EINE Sitzung je Tisch (nicht je Gerät)
--    und frischt letzte_aktivitaet bei jedem Scan und jeder Bestellung
--    auf (migration-schutz-2.sql, migration-gutschein-sicher.sql …).
--    Eine Gerätezahl gibt es daher NICHT — saal_anwesenheit liefert
--    nur „zuletzt aktiv“ und „Sitzung offen“. Keine Token, keine IP.
--
--  Teile:
--   1. Tabelle tisch_belegung (Personen, Stand da/zahlt/frei, seit).
--      Lesen: Mitglieder (Menge einmal gebildet, §2.3h). Schreiben NUR
--      über die Funktion — kein INSERT/UPDATE/DELETE-Recht (§2.3f).
--   2. tisch_belegung_setzen(): Mitglieder, auch das Team (der Kellner
--      trägt die Personen ein). Formfehler als grund, nie als Ausnahme
--      (§2.3g). Der Tisch muss im Betrieb existieren.
--   3. saal_anwesenheit(): je Tisch letzte Aktivität und ob die Sitzung
--      noch gilt. Nur Mitglieder, sonst leer.
--
--  Probe: pruefungen/pruef-saalplan-lokal.sh (lokales Postgres 16),
--  datenbank/pruef-tisch-belegung.sql — zurückgedreht.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.tisch_belegung (
  betrieb_id    uuid not null references public.betriebe(id) on delete cascade,
  tisch_nummer  text not null check (char_length(tisch_nummer) between 1 and 40),
  personen      smallint not null default 0 check (personen between 0 and 40),
  stand         text not null default 'da' check (stand in ('da', 'zahlt', 'frei')),
  seit          timestamptz not null default now(),
  geaendert_von uuid,
  geaendert_um  timestamptz not null default now(),
  primary key (betrieb_id, tisch_nummer)
);
alter table public.tisch_belegung enable row level security;
revoke all on public.tisch_belegung from public, anon, authenticated;
grant select on public.tisch_belegung to authenticated;
drop policy if exists "belegung mitglieder lesen" on public.tisch_belegung;
create policy "belegung mitglieder lesen" on public.tisch_belegung for select to authenticated
  using (betrieb_id in (select public.meine_betriebe()));

create or replace function public.tisch_belegung_setzen(p_betrieb uuid, p_tisch text, p_personen integer, p_stand text)
returns jsonb language plpgsql volatile security definer set search_path = public as $function$
declare
  v_personen integer := p_personen;
  v_zeile public.tisch_belegung%rowtype;
begin
  if auth.uid() is null or p_betrieb is null or not exists (select 1 from public.meine_betriebe() m where m = p_betrieb) then
    return jsonb_build_object('ok', false, 'grund', 'kein_recht');
  end if;
  if p_tisch is null or not exists (select 1 from public.tische t where t.betrieb_id = p_betrieb and t.nummer = p_tisch) then
    return jsonb_build_object('ok', false, 'grund', 'tisch');
  end if;
  if p_stand is null or p_stand not in ('da', 'zahlt', 'frei') then
    return jsonb_build_object('ok', false, 'grund', 'stand');
  end if;
  if v_personen is null or v_personen < 0 or v_personen > 40 then
    return jsonb_build_object('ok', false, 'grund', 'personen');
  end if;
  if p_stand = 'frei' then v_personen := 0; end if;

  insert into public.tisch_belegung as b (betrieb_id, tisch_nummer, personen, stand, seit, geaendert_von, geaendert_um)
  values (p_betrieb, p_tisch, v_personen, p_stand, now(), auth.uid(), now())
  on conflict (betrieb_id, tisch_nummer) do update
     set personen = excluded.personen,
         stand = excluded.stand,
         -- „seit“ beginnt neu, wenn ein freier Tisch wieder besetzt wird; sonst bleibt der Anfang.
         seit = case when b.stand = 'frei' and excluded.stand <> 'frei' then now()
                     when excluded.stand = 'frei' then now() else b.seit end,
         geaendert_von = auth.uid(),
         geaendert_um = now()
  returning * into v_zeile;

  return jsonb_build_object('ok', true, 'personen', v_zeile.personen, 'stand', v_zeile.stand,
    'seit', v_zeile.seit, 'geaendert_um', v_zeile.geaendert_um);
end;
$function$;
revoke execute on function public.tisch_belegung_setzen(uuid, text, integer, text) from public, anon;
grant execute on function public.tisch_belegung_setzen(uuid, text, integer, text) to authenticated;

create or replace function public.saal_anwesenheit(p_betrieb uuid)
returns table (tisch_nummer text, letzte_aktivitaet timestamptz, offen boolean)
language sql stable security definer set search_path = public as $function$
  select t.nummer, max(s.letzte_aktivitaet), bool_or(s.gueltig_bis > now())
    from public.tische t
    join public.tisch_sitzungen s on s.tisch_id = t.id
   where t.betrieb_id = p_betrieb
     and auth.uid() is not null
     and exists (select 1 from public.meine_betriebe() m where m = p_betrieb)
     and s.letzte_aktivitaet > now() - interval '12 hours'
   group by t.nummer
   order by t.nummer;
$function$;
revoke execute on function public.saal_anwesenheit(uuid) from public, anon;
grant execute on function public.saal_anwesenheit(uuid) to authenticated;
