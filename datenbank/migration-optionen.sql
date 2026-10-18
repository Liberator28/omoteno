-- ═══════════════════════════════════════════════════════════════════
--  migration-optionen.sql · Extras und Beläge je Betrieb, vom Server nachgerechnet
--
--  Anlass (17.10.): neuer Kunde Più Gusto (Pizzeria). Seine Karte führt
--  Pizzabeläge in Preisstufen von 1,00 € bis 3,50 €. Extras gab es bisher
--  nur FEST in der Vorlage (OPTIONEN in hub.vorlage.html) — für einen
--  neuen Betrieb nicht einstellbar.
--
--  Befund beim Lesen (§1.2, §2.3a): positionen_pruefen nahm den Preis
--  einer Position als greatest(Gastpreis, Kartenpreis), höchstens
--  Kartenpreis + 12 €. Den Aufpreis der Extras rechnete NIEMAND nach:
--  „Pizza Liam (Burrata)“ zum reinen Kartenpreis ging durch — die Küche
--  legt die Burrata auf, kassiert wird sie nicht.
--
--  Neu:
--   · betriebe.optionen jsonb — Gruppen {titel, art:"eine"|"mehrere",
--     pflicht, zeilen:[{n, auf}]}, Form geprüft (CHECK über eine
--     unveränderliche Funktion; EXECUTE für jeden, der betriebe
--     schreibt, §2.7). anon darf die Spalte lesen (der Hub zeigt sie).
--   · positionen_pruefen: hat der Betrieb eigene Gruppen und gehören ALLE
--     Extras einer Position zu den Gruppen dieses Gerichts, rechnet der
--     Server Kartenpreis (bzw. Aktionspreis) + Summe der Aufpreise — der
--     Preis des Gastes zählt dann nicht mehr. Sonst bleibt die alte
--     Regel (Vorlagen-Extras wie Chocos Käserand stehen nicht in der DB).
--     Gleiche Signatur (§2.1). bestellung_aufgeben, _liefern und
--     _telefon rufen sie — alle drei profitieren.
--  Additiv (§2.5). Keine Zeile beginnt mit drop oder delete (§2.8).
--
--  ANGEWENDET 17.10. (apply_migration „optionen“). Vorher live gelesen:
--  positionen_pruefen = diese Datei ohne die Extras-Teile. Zurückgedrehte
--  Proben (Inhaber Choco, Team, fremder Inhaber Minhkeey, anon):
--   · Form: gültig true; Komma im Namen, Aufpreis 60, art „alle“,
--     13 Gruppen → false.
--   · „Pizza Margherita (Knoblauch · Burrata)“, 2 Stück, Gast schickt
--     7,00 → Server 11,50 (7 + 1 + 3,50). Unbekanntes Extra → alte Regel
--     (7 + 12 = 19). Ohne Extras 7,00. Extra an einem Gericht ohne diese
--     Gruppe → alte Regel.
--   · Inhaber setzt gültige optionen: 1 Zeile; ungültige: 23514;
--     Inhaber ändert name (andere Spalte, §2.7): 1 Zeile.
--   · Team setzt optionen: 42501 nur_inhaber; Bestellpause weiter 1 Zeile.
--   · Fremder Inhaber: 0 Zeilen. anon liest die Spalte.
--   · Erster Lauf OHNE „grant update (optionen)“: auch der Inhaber hätte
--     „permission denied“ bekommen — betriebe hat nur Spaltenrechte.
--  Danach live: je Funktion eine Signatur, anon schreibt nicht, anon darf
--  optionen_form_ok nicht ausführen, Schranke gültig.
-- ═══════════════════════════════════════════════════════════════════

alter table public.betriebe add column if not exists optionen jsonb;

create or replace function public.optionen_form_ok(p jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare k text; g jsonb; z jsonb; n int := 0;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'object' or pg_column_size(p) > 8000 then return false; end if;
  for k, g in select key, value from jsonb_each(p) loop
    n := n + 1;
    if n > 12 or k !~ '^[a-z0-9-]{1,24}$' or jsonb_typeof(g) <> 'object' then return false; end if;
    if jsonb_typeof(g->'titel') <> 'string' or length(btrim(g->>'titel')) not between 1 and 40 then return false; end if;
    if coalesce(g->>'art', '') not in ('eine', 'mehrere') then return false; end if;
    if g ? 'pflicht' and jsonb_typeof(g->'pflicht') <> 'boolean' then return false; end if;
    if jsonb_typeof(g->'zeilen') <> 'array' or jsonb_array_length(g->'zeilen') not between 1 and 40 then return false; end if;
    for z in select value from jsonb_array_elements(g->'zeilen') loop
      if jsonb_typeof(z) <> 'object' or jsonb_typeof(z->'n') <> 'string' or jsonb_typeof(z->'auf') <> 'number' then return false; end if;
      -- Der Name steht später in „Gericht (Extra, Extra · Extra)“: keine Trenner darin.
      if length(btrim(z->>'n')) not between 1 and 40 or (z->>'n') ~ '[,·()]' then return false; end if;
      if (z->>'auf')::numeric < 0 or (z->>'auf')::numeric > 50 then return false; end if;
    end loop;
  end loop;
  return true;
end $$;
revoke execute on function public.optionen_form_ok(jsonb) from public, anon;
grant execute on function public.optionen_form_ok(jsonb) to authenticated, service_role;

alter table public.betriebe add constraint betriebe_optionen_form check (public.optionen_form_ok(optionen)) not valid;
alter table public.betriebe validate constraint betriebe_optionen_form;
grant select (optionen) on public.betriebe to anon;
-- authenticated schreibt betriebe nur über Spaltenrechte (gemessen 17.10.:
-- tabelle_update=false). Ohne diese Zeile könnte nicht einmal der Inhaber
-- Beläge speichern. Das Team hält betrieb_rolle_wache ab (vergleicht jede
-- Spalte außer der Bestellpause).
grant update (optionen) on public.betriebe to authenticated;

create or replace function public.positionen_pruefen(p_betrieb_id uuid, p_positionen jsonb)
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  pos jsonb; v_name text; v_basis text; v_menge integer; v_gast numeric; v_preis numeric; v_aktion numeric; v_gid uuid;
  v_raus jsonb := '[]'::jsonb; v_summe numeric := 0; v_waren numeric := 0; v_unbekannt integer := 0; v_stueck integer := 0;
  v_opt jsonb; v_gopt text; v_zusatz text; v_teil text; v_auf numeric; v_z numeric; v_alle boolean;
begin
  if p_positionen is null or jsonb_typeof(p_positionen) <> 'array' then
    return jsonb_build_object('fehler', 'Die Bestellung ist unvollständig. Bitte die Karte neu laden.');
  end if;
  if jsonb_array_length(p_positionen) > 40 then
    return jsonb_build_object('fehler', 'Zu viele Positionen in einer Bestellung. Bitte teilen Sie sie auf.');
  end if;
  select b.optionen into v_opt from betriebe b where b.id = p_betrieb_id;
  for pos in select * from jsonb_array_elements(p_positionen) loop
    if jsonb_typeof(pos) <> 'object' then
      return jsonb_build_object('fehler', 'Die Bestellung ist unvollständig. Bitte die Karte neu laden.');
    end if;
    v_name := btrim(coalesce(pos->>'name', ''));
    if length(v_name) not between 1 and 160 then
      return jsonb_build_object('fehler', 'Die Bestellung ist unvollständig. Bitte die Karte neu laden.');
    end if;
    if coalesce(pos->>'menge', '1') !~ '^[0-9]{1,3}$' then
      return jsonb_build_object('fehler', 'Eine Menge stimmt nicht. Bitte die Karte neu laden.');
    end if;
    v_menge := coalesce(pos->>'menge', '1')::integer;
    if v_menge < 1 or v_menge > 30 then
      return jsonb_build_object('fehler', 'Höchstens 30 Stück je Gericht. Für mehr sprechen Sie bitte das Personal an.');
    end if;
    v_stueck := v_stueck + v_menge;
    v_basis := btrim(split_part(v_name, ' (', 1));
    v_gast := case when coalesce(pos->>'preis', '') ~ '^[0-9]{1,5}([.][0-9]+)?$'
                   then round((pos->>'preis')::numeric, 2) end;
    v_preis := null; v_gid := null; v_gopt := null;
    select g.preis, g.id, g.opt into v_preis, v_gid, v_gopt from gerichte g
     where g.betrieb_id = p_betrieb_id and g.name = v_basis and g.verfuegbar
     order by g.id limit 1;
    if v_preis is null then
      v_unbekannt := v_unbekannt + 1;
      v_preis := least(coalesce(v_gast, 0), 500);
    else
      v_aktion := null;
      select least(v_preis, a.preis_neu) into v_aktion from aktionen a
       where a.betrieb_id = p_betrieb_id and a.gericht_name = v_basis
         and coalesce(a.aktiv, true) and now() between a.von and a.bis
       order by a.preis_neu asc, a.id limit 1;
      if v_aktion is not null then v_preis := v_aktion; end if;
      v_waren := v_waren + v_preis * v_menge;
      -- Extras aus den Gruppen DES BETRIEBS nachrechnen (17.10.).
      v_zusatz := substring(v_name from ' \((.*)\)$');
      v_auf := 0; v_alle := v_opt is not null;
      if v_alle and v_zusatz is not null then
        for v_teil in select btrim(t) from regexp_split_to_table(v_zusatz, ' · |, ') t loop
          v_z := null;
          select (z->>'auf')::numeric into v_z
            from regexp_split_to_table(coalesce(v_gopt, ''), ',') k
            cross join lateral jsonb_array_elements(coalesce(v_opt -> btrim(k) -> 'zeilen', '[]'::jsonb)) z
           where z->>'n' = v_teil
           limit 1;
          if v_z is null then v_alle := false; exit; end if;
          v_auf := v_auf + v_z;
        end loop;
      end if;
      if v_alle then
        v_preis := v_preis + v_auf;
      else
        v_preis := least(greatest(coalesce(v_gast, v_preis), v_preis), v_preis + 12);
      end if;
    end if;
    v_summe := v_summe + v_preis * v_menge;
    v_raus := v_raus || (jsonb_build_object('name', v_name, 'menge', v_menge, 'preis', round(v_preis, 2))
                         || case when v_gid is not null then jsonb_build_object('gericht_id', v_gid) else '{}'::jsonb end);
  end loop;
  if v_stueck > 100 then
    return jsonb_build_object('fehler', 'Sehr große Bestellung — bitte sprechen Sie kurz mit dem Personal.');
  end if;
  return jsonb_build_object('positionen', v_raus, 'summe', round(v_summe, 2),
                            'waren', round(v_waren, 2), 'unbekannt', v_unbekannt);
end $function$;
