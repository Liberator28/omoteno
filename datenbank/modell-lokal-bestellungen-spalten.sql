-- Ergänzung des lokalen Modells für die Prüfung der Spaltenrechte auf bestellungen: die Spalten, die die Wegeliste
-- (dokumente/bestellungen-schreibwege.md) nennt, ein paar, die NICHT darauf stehen, ein Trigger des Aufrufers und eine
-- security-definer-Funktion. Läuft VOR der Migration (sie nennt die Spalten im grant).
-- Modell-Ergänzungen: die Spalten, die die Wegeliste nennt, und ein paar, die NICHT darauf stehen
alter table public.bestellungen
  add column wartezeit_min integer, add column bestaetigt_um timestamptz, add column kueche_fertig_um timestamptz,
  add column theke_fertig_um timestamptz, add column gebracht_um timestamptz, add column zugewiesen smallint,
  add column positionen jsonb default '[]', add column tisch text, add column tisch_bestaetigt boolean default false,
  add column geaendert timestamptz;
create function public.bestellung_geaendert() returns trigger language plpgsql as $$
begin new.geaendert := now(); return new; end $$;           -- Trigger des AUFRUFERS (kein security definer)
create trigger bestellung_geaendert before update on public.bestellungen for each row execute function public.bestellung_geaendert();
-- Eine security-definer-Funktion, die verbotene Spalten ändert (so arbeiten bestellung_stornieren & Co.)
create function public.probe_definer_summe(p_id uuid, p_summe numeric) returns void language plpgsql security definer set search_path = public as $$
begin update public.bestellungen set summe = p_summe where id = p_id; end $$;
grant execute on function public.probe_definer_summe(uuid, numeric) to authenticated;

