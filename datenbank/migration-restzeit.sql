-- ═══════════════════════════════════════════════════════════════════
--  NOCH NICHT ANGEWENDET · Der Gast soll sehen, wie lange es noch dauert
--
--  Anwenden im SQL-Editor von Supabase. Danach die zwei Proben ganz
--  unten fahren — eine Migration, die „success" meldet, sagt NICHTS
--  darüber, ob die Funktion läuft (CLAUDE.md §2.2).
--
--  ── BEFUND ────────────────────────────────────────────────────
--  Das Admin-Board sagt eine Zeit zu und schreibt beides:
--
--      bestellungen.wartezeit_min   z. B. 20
--      bestellungen.bestaetigt_um   Zeitpunkt der Zusage
--
--  Die Küche liest die Tabelle direkt und kann daraus herunterzählen.
--  Der GAST kann das nicht: Er bekommt seinen Stand über
--
--      /rest/v1/rpc/bestellung_status  →  status, wartezeit_min,
--                                         tagesnummer
--
--  und das ist absichtlich so eng — dürfte er die Tabelle lesen, läse
--  er die Bestellungen aller Betriebe mit. Es fehlt ihm aber der
--  ZEITPUNKT. Er weiß „20 Minuten", nicht „ab wann".
--
--  ── WARUM EINE ZWEITE FUNKTION UND KEINE GEÄNDERTE ────────────
--  1) bestellung_status wird NICHT angefasst. Ihren Körper konnte ich
--     nicht lesen (die Datenbank ist aus meiner Umgebung gesperrt),
--     und eine Funktion neu zu schreiben, die man nicht gesehen hat,
--     ist genau die Annahme, gegen die §0 steht. Additiv ist das
--     Risiko null (§2.5) — der alte Weg trägt unverändert weiter.
--  2) Eine Änderung der Rückgabespalten ginge ohnehin nicht mit
--     „create or replace": Postgres verlangt dafür ein DROP, und ein
--     DROP auf die Funktion, an der der Gäste-Hub hängt, ist genau
--     die Art Eingriff, die man nicht nebenbei macht.
--
--  ── WARUM SEKUNDEN VOM SERVER UND KEIN ZEITSTEMPEL ────────────
--  Die Uhr des Gastes ist nicht die Uhr des Hauses. Ein Telefon, das
--  zwei Minuten falsch geht, zeigte sonst zwei Minuten falsch. Der
--  Server rechnet, der Hub zählt lokal herunter und holt sich alle
--  15 Sekunden den echten Wert zurück.
--
--  Der Wert wird bei 0 abgeschnitten. Der Gast sieht NIE ein Minus:
--  Bei 0 steht „Jeden Moment" statt „+3 Minuten". Er kann an einer
--  Verspätung nichts ändern; der Koch kann es, und der sieht sie
--  deshalb in der Küche (§7).
--
--  ── WAS SIE HERAUSGIBT ────────────────────────────────────────
--  Eine Zahl oder NULL. Keine Zeile, keinen Namen, keinen Preis.
--    NULL  = keine Zusage (oder es gibt die Nummer nicht)
--    0     = zugesagte Zeit ist um, oder die Bestellung ist fertig
--    n     = so viele Sekunden noch
--
--  Wer eine fremde Quittungsnummer errät, erfährt eine Restzeit.
--  Dieselbe Enge wie bestellung_status, und die Nummer ist ein
--  Zufallswert mit 32 Zeichen.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── Zuerst die Annahme prüfen, auf der alles steht ──────────────
-- Steht die Spalte anders da als erwartet, bricht die Migration hier
-- ab, statt eine Funktion anzulegen, die still immer NULL liefert.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bestellungen'
      and column_name = 'gast_kennung')
  then raise exception 'bestellungen.gast_kennung fehlt — Annahme falsch, nichts angelegt.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bestellungen'
      and column_name in ('wartezeit_min'))
  then raise exception 'bestellungen.wartezeit_min fehlt.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bestellungen'
      and column_name in ('bestaetigt_um'))
  then raise exception 'bestellungen.bestaetigt_um fehlt.';
  end if;
end $$;

-- ÜBERHOLT durch migration-bestellnummer.sql — NICHT mehr einspielen.
-- Dieselbe Verwechslung wie beim Storno: Die Suche unten geht über
-- gast_kennung, gerufen wird mit der id. Der Countdown fiel dadurch
-- stumm aus. Die gültige Fassung steht in migration-bestellnummer.sql.
create or replace function public.bestellung_restzeit(nummer text)
returns integer
language sql
stable
security definer
-- Der search_path bleibt eng. make_interval, now() und greatest kommen
-- aus pg_catalog, es wird nichts aus „extensions" gebraucht (§2.2).
set search_path = public
as $$
  select case
           when b.status = 'fertig' then 0
           when b.wartezeit_min is null or b.bestaetigt_um is null then null
           else greatest(0, ceil(extract(epoch from
                  (b.bestaetigt_um + make_interval(mins => b.wartezeit_min)) - now()
                ))::integer)
         end
  from public.bestellungen b
  where b.gast_kennung = nummer
  limit 1;
$$;

-- Der Gast ruft mit dem anon-Schlüssel. Das Recht gilt der FUNKTION,
-- nicht der Tabelle — auf bestellungen hat anon weiterhin gar nichts.
revoke all on function public.bestellung_restzeit(text) from public;
grant execute on function public.bestellung_restzeit(text) to anon, authenticated;

commit;

-- ── DANACH PRÜFEN ────────────────────────────────────────────────
--
-- 1 · Genau EINE Fassung? (§2.1 — „create or replace" ersetzt nur bei
--     identischer Signatur, sonst steht plötzlich eine zweite da.)
--
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'bestellung_restzeit';
--
--   → muss GENAU EINE Zeile liefern: bestellung_restzeit | nummer text
--
-- 2 · Läuft sie wirklich? Der Körper wird beim Anlegen NICHT geprüft
--     (§2.2). Diese Probe legt eine Bestellung an, fragt, und dreht
--     alles zurück. raise notice erscheint über MCP nicht — deshalb
--     der Umweg über eine temporäre Tabelle.
--
--   begin;
--   create temp table probe(schritt text, ergebnis text);
--   do $$
--   declare v_betrieb uuid; v_rest integer;
--   begin
--     select id into v_betrieb from betriebe limit 1;
--
--     insert into bestellungen (betrieb_id, quelle, status, summe,
--                               gast_kennung, wartezeit_min, bestaetigt_um)
--     values (v_betrieb, 'tisch', 'arbeit', 1.00,
--             'probe_restzeit_0001', 20, now() - interval '5 minutes');
--     select bestellung_restzeit('probe_restzeit_0001') into v_rest;
--     insert into probe values ('20 Min zugesagt, 5 vorbei', coalesce(v_rest::text,'NULL'));
--     -- erwartet: rund 900 (15 Minuten)
--
--     update bestellungen set bestaetigt_um = now() - interval '40 minutes'
--      where gast_kennung = 'probe_restzeit_0001';
--     select bestellung_restzeit('probe_restzeit_0001') into v_rest;
--     insert into probe values ('Zeit ist um', coalesce(v_rest::text,'NULL'));
--     -- erwartet: 0, NIEMALS negativ
--
--     update bestellungen set wartezeit_min = null, bestaetigt_um = null
--      where gast_kennung = 'probe_restzeit_0001';
--     select bestellung_restzeit('probe_restzeit_0001') into v_rest;
--     insert into probe values ('ohne Zusage', coalesce(v_rest::text,'NULL'));
--     -- erwartet: NULL
--
--     select bestellung_restzeit('gibt_es_nicht_0001') into v_rest;
--     insert into probe values ('unbekannte Nummer', coalesce(v_rest::text,'NULL'));
--     -- erwartet: NULL
--   end $$;
--   select * from probe;
--   rollback;
--
-- 3 · Und der Weg, den der Gast wirklich geht — über PostgREST, mit
--     dem anon-Schlüssel, wie im Hub:
--
--   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/bestellung_restzeit" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--        -H "Content-Type: application/json" \
--        -d '{"nummer":"<echte Quittungsnummer>"}'
--
--   Ein Rollenwechsel allein bildet PostgREST nicht ab (§2.4).
