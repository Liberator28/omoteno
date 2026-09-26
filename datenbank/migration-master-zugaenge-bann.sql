-- ═══════════════════════════════════════════════════════════════════
--  MIGRATION · master_zugaenge() zeigt auch den Auth-Bann
--
--  master-zugang (Edge Function) sperrt ein Konto über ban_duration —
--  das steht in auth.users.banned_until. Ohne diese Spalte hätte die
--  Zentrale gesperrt, aber nie gezeigt, WER gesperrt ist.
--  Rückgabetyp ändert sich → drop + create (§2.1: danach genau eine
--  Fassung). Gleiche Argumente (keine), gleiche Rechte.
-- ═══════════════════════════════════════════════════════════════════
begin;
drop function if exists public.master_zugaenge();
create function public.master_zugaenge()
returns table (nutzer_id uuid, email text, betrieb_id uuid, betrieb_name text, rolle text,
               zuletzt timestamptz, bestaetigt boolean, hat_pin boolean, pin_gesperrt boolean,
               login_gesperrt boolean, ist_master boolean, pin_pflicht boolean,
               gebannt boolean, angelegt timestamptz)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.ist_master() then return; end if;
  return query
    select u.id, u.email::text, m.betrieb_id, b.name::text, m.rolle::text,
           u.last_sign_in_at, (u.email_confirmed_at is not null),
           (p.nutzer_id is not null), coalesce(p.gesperrt, false),
           coalesce(s.gesperrt, false),
           exists (select 1 from public.master_konten mk where mk.benutzer_id = u.id),
           coalesce(b.pin_pflicht, false),
           (u.banned_until is not null and u.banned_until > now()),
           u.created_at
      from auth.users u
      left join public.betrieb_mitglieder m on m.nutzer_id = u.id
      left join public.betriebe b on b.id = m.betrieb_id
      left join public.konto_pin p on p.nutzer_id = u.id
      left join public.admin_login_schutz s on s.nutzer_id = u.id
     order by b.name nulls last, u.email, u.id;
end;
$$;
revoke all on function public.master_zugaenge() from public, anon;
grant execute on function public.master_zugaenge() to authenticated;
commit;
