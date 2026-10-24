-- ═══════════════════════════════════════════════════════════════════
--  EINGESPIELT 24.10.2026 (live gelesen: eine Fassung, EXECUTE nur authenticated, vor:true gültig, vor:"ja" abgelehnt, Bestand ohne Verstoß) · Beilagen und Extras je Gericht
--
--  Wunsch (24.10.): „für jedes Gericht Beilagen und Extras einstellen — Überschriften, welche
--  Zutaten wie viel kosten, und eine Voreinstellung als Vorschlag.“
--
--  BEFUND (§1.2, gelesen, nicht angenommen). Der Weg steht schon: betriebe.optionen hält Gruppen
--  {titel, art, pflicht, hinweis, zeilen:[{n, auf}]}, gerichte.opt nennt je Gericht die Schlüssel seiner
--  Gruppen, positionen_pruefen rechnet die Aufpreise vom Server nach (nur aus den Gruppen, die am Gericht
--  hängen), der Hub zeigt, speichert, merkt und bereinigt sie. Eine eigene Gruppe JE GERICHT ist also
--  nichts Neues für Server und Hub — sie ist eine Gruppe, die nur an diesem einen Gericht hängt.
--  Deshalb legt das Board sie unter dem Schlüssel g-<8 Zeichen der Gericht-id>-<name> in betriebe.optionen
--  ab: kein zweiter Preisweg, kein zweiter Speicher, nichts, was der Server nicht schon prüft.
--
--  Was fehlte, und das einzige, was sich hier ändert (create or replace, GLEICHE Signatur, §2.1):
--   · Die Schranke optionen_form_ok ließ höchstens 12 Gruppen und 8000 Bytes zu — eine Pizzakarte mit
--     dreißig eigenen Gruppen passt nicht. Jetzt 60 Gruppen, 40000 Bytes (gemessen: das größte Haus
--     heute 808 Bytes).
--   · „Vorschlag“: je Zeile ein optionales Feld vor (boolean). Der Server braucht es nicht — er rechnet,
--     was der Gast bestellt — die Schranke prüft nur die Form.
--  Alles andere bleibt Zeichen für Zeichen: jede Form, die bisher gültig war, ist es weiter (Differenztest
--  in pruefungen/pruef-extras-lokal.sh).
--
--  EXECUTE bleibt, wie es war (nur authenticated und service_role, §2.7) — create or replace behält die
--  Rechte. Keine Zeile beginnt mit drop oder delete (§2.8).
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.optionen_form_ok(p jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare k text; g jsonb; z jsonb; n int := 0;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'object' or pg_column_size(p) > 40000 then return false; end if;
  for k, g in select key, value from jsonb_each(p) loop
    n := n + 1;
    if n > 60 or k !~ '^[a-z0-9-]{1,24}$' or jsonb_typeof(g) <> 'object' then return false; end if;
    if jsonb_typeof(g->'titel') <> 'string' or length(btrim(g->>'titel')) not between 1 and 40 then return false; end if;
    if coalesce(g->>'art', '') not in ('eine', 'mehrere') then return false; end if;
    if g ? 'pflicht' and jsonb_typeof(g->'pflicht') <> 'boolean' then return false; end if;
    if jsonb_typeof(g->'zeilen') <> 'array' or jsonb_array_length(g->'zeilen') not between 1 and 40 then return false; end if;
    for z in select value from jsonb_array_elements(g->'zeilen') loop
      if jsonb_typeof(z) <> 'object' or jsonb_typeof(z->'n') <> 'string' or jsonb_typeof(z->'auf') <> 'number' then return false; end if;
      -- Der Name steht später in „Gericht (Extra, Extra · Extra)“: keine Trenner darin.
      if length(btrim(z->>'n')) not between 1 and 40 or (z->>'n') ~ '[,·()]' then return false; end if;
      if (z->>'auf')::numeric < 0 or (z->>'auf')::numeric > 50 then return false; end if;
      -- Neu: Vorschlag je Zeile.
      if z ? 'vor' and jsonb_typeof(z->'vor') <> 'boolean' then return false; end if;
    end loop;
  end loop;
  return true;
end $$;
