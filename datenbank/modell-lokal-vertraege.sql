-- Ergänzung zu modell-lokal-zahlung.sql für die Probe der Vertragsannahme:
-- ist_inhaber(uuid) wie live (migration-rollen.sql), nur ohne PIN-Prüfung — das Modell hat keine PIN-Sitzungen.
-- Der Inhaber ist, wer in betrieb_mitglieder mit Rolle 'inhaber' steht, oder der Master.
create function public.ist_inhaber(p_betrieb uuid) returns boolean language sql stable security definer set search_path = public as
  $$ select p_betrieb in (select betrieb_id from public.betrieb_mitglieder where nutzer_id = auth.uid() and rolle = 'inhaber') or public.ist_master() $$;
revoke execute on function public.ist_inhaber(uuid) from public, anon;
grant  execute on function public.ist_inhaber(uuid) to authenticated;
