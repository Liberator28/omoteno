-- ═══════════════════════════════════════════════════════════════════
--  migration-team.sql · Der Besitzer verwaltet sein Team selbst
--  (Wunsch zweiter Tag: „Mitarbeiter-Konto und Besitzer-Konto“,
--  Entscheidung: eigener Zugang je Person, Einladung per E-Mail)
--
--  BEFUND: Einladen konnte bisher nur die Zentrale über die Edge
--  Function master-zugang — keine Seite rief sie. konto.html sagte dem
--  Besitzer „Für dein Personal: dieselben Zugangsdaten wie hier“. Damit
--  war jede Änderung im Hub eine Änderung „des Besitzers“, egal wer
--  tippte, und eine Rolle hätte nie wirken können.
--
--  WAS HIER LIEGT (die Datenbankhälfte; Einladen/Ändern/Entfernen läuft
--  in supabase/functions/team-zugang, weil nur die Auth-Admin-
--  Schnittstelle ein Konto anlegen kann):
--   · team_liste(betrieb)           — nur Inhaber: wer ist im Team.
--   · team_einladung_zaehlen(betrieb) — nur Inhaber: 20 Einladungen je
--     Betrieb und Tag. Die Edge Function ruft sie MIT DEM TOKEN DES
--     AUFRUFERS, bevor sie den Dienstschlüssel anfasst. Abgewiesen wird
--     mit Antwort, nicht mit Ausnahme — sonst dreht die Ausnahme den
--     Zähler zurück (§2.3g).
--   · konto_zu_mail(mail)           — nur service_role: die Edge
--     Function findet ein bestehendes Konto, ohne dass ein Besitzer
--     über sie erfährt, welche Adressen es bei Omoteno gibt.
--
--  ANGEWENDET (Supabase-MCP). Vorher zurückgedreht, Rolle über
--  request.jwt.claims (§2.4): Inhaber sieht beide Zeilen (sich selbst
--  mit ich=true); Einladung 20 → ok, 21 → {grund:'grenze'} (als Antwort,
--  nicht als Ausnahme, §2.3g); Team: team_liste 0 Zeilen,
--  team_einladung_zaehlen → kein_inhaber; anon: team_liste abgewiesen;
--  konto_zu_mail für Inhaber abgewiesen, für service_role erlaubt; je
--  Funktion genau eine Fassung (§2.1).
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_liste(p_betrieb uuid)
returns table (nutzer_id uuid, email text, anzeigename text, rolle text, ich boolean,
               zuletzt timestamptz, bestaetigt boolean, hat_pin boolean, pin_gesperrt boolean,
               darf_gutscheine boolean, gutschein_max_betrag numeric, gutschein_max_prozent numeric,
               gutschein_tag_max integer)
language plpgsql stable security definer set search_path = public as $function$
begin
  if not public.ist_inhaber(p_betrieb) then return; end if;
  return query
    select m.nutzer_id, u.email::text, m.anzeigename, m.rolle::text, (m.nutzer_id = auth.uid()),
           u.last_sign_in_at, (u.email_confirmed_at is not null),
           (p.nutzer_id is not null), coalesce(p.gesperrt, false),
           m.darf_gutscheine, m.gutschein_max_betrag, m.gutschein_max_prozent, m.gutschein_tag_max
      from public.betrieb_mitglieder m
      join auth.users u on u.id = m.nutzer_id
      left join public.konto_pin p on p.nutzer_id = m.nutzer_id
     where m.betrieb_id = p_betrieb
     order by case m.rolle when 'inhaber' then 0 when 'team' then 1 else 2 end, u.email, m.nutzer_id;
end $function$;

create or replace function public.team_einladung_zaehlen(p_betrieb uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public as $function$
declare v_n integer;
begin
  if not public.ist_inhaber(p_betrieb) then
    return jsonb_build_object('ok', false, 'grund', 'kein_inhaber');
  end if;
  v_n := public.schutz_zaehlen('team_einladen:' || p_betrieb::text, 1440);
  if v_n > 20 then
    return jsonb_build_object('ok', false, 'grund', 'grenze');
  end if;
  return jsonb_build_object('ok', true);
end $function$;

create or replace function public.konto_zu_mail(p_mail text)
returns uuid
language sql stable security definer set search_path = public as $function$
  select id from auth.users where lower(email) = lower(btrim(p_mail)) order by id limit 1;
$function$;

revoke execute on function public.team_liste(uuid)             from public, anon;
revoke execute on function public.team_einladung_zaehlen(uuid) from public, anon;
revoke execute on function public.konto_zu_mail(text)          from public, anon, authenticated;
grant  execute on function public.team_liste(uuid)             to authenticated;
grant  execute on function public.team_einladung_zaehlen(uuid) to authenticated;
grant  execute on function public.konto_zu_mail(text)          to service_role;
