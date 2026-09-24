-- ═══════════════════════════════════════════════════════════════════
--  STAND, NICHT ANWENDEN · public.gast_melden, live gelesen
--
--  Die Funktion ist älter als diese Dateien und stand bisher in keiner
--  Migration. Diese Kopie ist bytegleich mit pg_get_functiondef()
--  (md5 d5b2e51f1728d864156cf5b66a434713, 2821 Byte, gelesen
--  2026-09-24) und dient als zweite Quelle für
--  pruefungen/pruef-gutschein-board.js: Das Board schreibt Spalten
--  von `gutscheine`, der Hub liest Schlüssel aus dieser Funktion —
--  die Naht dazwischen wird gegen DIESEN Text gehalten (§8.1i).
--
--  Weicht die Live-Funktion ab, ist diese Datei veraltet, nicht die
--  Datenbank. Prüfen:
--    select md5(pg_get_functiondef('public.gast_melden'::regproc));
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.gast_melden(p_slug text, p_kennung text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_betrieb uuid;
  v_gast    public.gaeste%rowtype;
  v_neu     boolean := false;
  v_lieblinge jsonb;
  v_gutscheine jsonb;
begin
  -- Kennung ist eine Geraetekennung, kein Freitext.
  if p_kennung is null or length(p_kennung) < 8 or length(p_kennung) > 64
     or p_kennung !~ '^[A-Za-z0-9_-]+$' then
    return jsonb_build_object('ok', false, 'grund', 'kennung');
  end if;

  select id into v_betrieb from public.betriebe where slug = p_slug;
  if v_betrieb is null then
    return jsonb_build_object('ok', false, 'grund', 'betrieb');
  end if;

  select * into v_gast from public.gaeste
   where betrieb_id = v_betrieb and kennung = p_kennung;

  if not found then
    insert into public.gaeste(betrieb_id, kennung)
      values (v_betrieb, p_kennung)
      returning * into v_gast;
    v_neu := true;
  else
    -- Ein Besuch, nicht ein Seitenaufruf: Erst nach vier Stunden
    -- Pause zaehlt es als neuer Besuch. Sonst waere jeder Neuladen
    -- ein Besuch, und der Zaehler waere wertlos.
    update public.gaeste
       set besuche = besuche + case when letzter_besuch < now() - interval '4 hours' then 1 else 0 end,
           letzter_besuch = now()
     where id = v_gast.id
     returning * into v_gast;
  end if;

  -- Lieblingsspeisen aus den eigenen Bestellungen. Gelesen wird
  -- b.geraet, NICHT b.gast_kennung: gast_kennung ist die
  -- Quittungsnummer einer einzelnen Bestellung (UNIQUE) und je
  -- Bestellung eine andere - darueber faende man nie mehr als eine.
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'mal', mal) order by mal desc, name), '[]'::jsonb)
    into v_lieblinge
  from (
    select p->>'name' as name, sum(coalesce((p->>'menge')::int, 1)) as mal
      from public.bestellungen b
      cross join lateral jsonb_array_elements(coalesce(b.positionen, '[]'::jsonb)) as p
     where b.betrieb_id = v_betrieb
       and b.geraet = p_kennung
       and p->>'name' is not null
     group by 1
     order by 2 desc, 1
     limit 3
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
           'titel', g.titel, 'text', g.beschreibung, 'code', g.code,
           'bis', g.gueltig_bis) order by g.gueltig_bis nulls last, g.id), '[]'::jsonb)
    into v_gutscheine
  from public.gutscheine g
   where g.betrieb_id = v_betrieb
     and (g.gast_id = v_gast.id or g.gast_id is null)
     and g.eingeloest_am is null
     and (g.gueltig_bis is null or g.gueltig_bis > now());

  return jsonb_build_object(
    'ok', true,
    'neu', v_neu,
    'besuche', v_gast.besuche,
    'seit', v_gast.erster_besuch,
    'lieblinge', v_lieblinge,
    'gutscheine', v_gutscheine
  );
end $function$
