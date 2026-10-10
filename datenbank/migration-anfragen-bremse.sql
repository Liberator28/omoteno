-- ═══════════════════════════════════════════════════════════════════
-- migration-anfragen-bremse.sql — höchstens 4 Anfragen je Gast in 10 Minuten
--
-- Wunsch 10.10. (Foto: zehn „Bitte einmal an den Tisch“ von Tisch 12,
-- alle „ZU PRÜFEN“): „Jeder Gast darf nur 4 Anfragen pro 10 Minuten
-- stellen.“
--
-- Befund vorher (live gelesen):
--   · Der Hub schickte den Serviceruf OHNE p_geraet — die Gerätebremse
--     in bestellung_aufgeben griff also nie. Es blieb nur die
--     Tischbremse (weich 6 = markieren, hart 20 = abweisen).
--   · Abweisen kam erst beim 21. Ruf; bis dahin wurde nur markiert —
--     genau die Liste auf dem Foto.
--   · reservierung_anfragen kannte nur die Netz-Bremse des Triggers.
--
-- Was hier geändert wird (gleiche Signaturen, §2.1):
--   (d) bestellung_aufgeben, nur p_quelle = 'service': gezählt werden
--       die ECHTEN Zeilen der letzten 10 Minuten — je Gerät (4), ohne
--       Gerät je Tisch (4), und je Tisch insgesamt (8; deckt den Gast,
--       der seine Gerätekennung wechselt). Darüber: Ausnahme mit
--       HINT 'bremse:<Minuten>' — der Hub liest daraus seinen Satz.
--
--       §2.3g („wer zählt, darf danach nicht werfen“) trifft hier nicht:
--       gezählt werden bereits festgeschriebene Bestellungen, kein
--       Zähler in derselben Transaktion. Eine Ausnahme dreht nichts
--       zurück, was gezählt hätte.
--   (e) reservierung_anfragen: NICHT geändert. Eine erste Fassung tat
--       es und wurde zurückgenommen — der Trigger reservierung_bremse
--       hält schon 3 je Telefon/Name in einer Stunde (siehe unten).
--
-- Eingespielt über DO-Blöcke, die die LIVE-Fassung lesen und genau an
-- einer Stelle ergänzen (die Funktion ist groß und wurde mehrfach
-- nachgezogen — eine Abschrift hier könnte älter sein als live). Jeder
-- Block prüft, dass sein Anker genau einmal vorkommt.
-- Keine Zeile beginnt mit drop/delete (§2.8).
-- ═══════════════════════════════════════════════════════════════════

-- ── (d) bestellung_aufgeben ───────────────────────────────────────
do $mig$
declare
  alt  text := pg_get_functiondef('public.bestellung_aufgeben(uuid,text,text,numeric,text,jsonb,text,text,text,text,text)'::regprocedure);
  neu  text;
  anker1 text := E'  v_n         integer;\n';
  anker2 text := E'  v_herkunft := schutz_herkunft();\n';
  zusatz text := $z$
  -- (d) Servicerufe: höchstens 4 je Gast in 10 Minuten (Wunsch 10.10.).
  -- Gezählt werden festgeschriebene Zeilen, kein Zähler — die Ausnahme
  -- dreht also nichts zurück, was gezählt hätte (§2.3g).
  if p_quelle = 'service' then
    if p_geraet is not null or tisch_final is not null then
      select count(*), min(zeitpunkt) into v_n, v_erste
        from bestellungen
       where betrieb_id = p_betrieb_id and quelle = 'service'
         and zeitpunkt > now() - interval '10 minutes'
         and case when p_geraet is not null then geraet = p_geraet
                  else lower(tisch) = lower(tisch_final) end;
      if v_n >= 4 then
        raise exception 'Sie haben gerade schon mehrmals gerufen – das Team weiß Bescheid.'
          using errcode = 'P0001',
                hint = 'bremse:' || greatest(1, ceil(extract(epoch from (v_erste + interval '10 minutes' - now())) / 60))::int;
      end if;
    end if;
    if tisch_final is not null then
      select count(*), min(zeitpunkt) into v_n, v_erste
        from bestellungen
       where betrieb_id = p_betrieb_id and quelle = 'service'
         and zeitpunkt > now() - interval '10 minutes'
         and lower(tisch) = lower(tisch_final);
      if v_n >= 8 then
        raise exception 'Von diesem Tisch wurde gerade schon mehrmals gerufen – das Team weiß Bescheid.'
          using errcode = 'P0001',
                hint = 'bremse:' || greatest(1, ceil(extract(epoch from (v_erste + interval '10 minutes' - now())) / 60))::int;
      end if;
    end if;
  end if;
$z$;
begin
  if position('(d) Servicerufe' in alt) > 0 then
    raise notice 'schon eingespielt'; return;
  end if;
  if (length(alt) - length(replace(alt, anker1, ''))) / length(anker1) <> 1
     or (length(alt) - length(replace(alt, anker2, ''))) / length(anker2) <> 1 then
    raise exception 'Anker nicht eindeutig — Live-Fassung weicht ab, nichts geändert';
  end if;
  neu := replace(alt, anker1, anker1 || E'  v_erste     timestamptz;\n');
  neu := replace(neu, anker2, zusatz || anker2);
  execute neu;
end $mig$;

-- ── (e) reservierung_anfragen — eingespielt und ZURÜCKGENOMMEN ──────
-- Die erste Fassung bremste auch hier (4 je Nummer in 10 Minuten). Die
-- Probe zeigte: der Trigger reservierung_bremse hält schon strenger —
-- 3 Anfragen je Telefon ODER Name in einer Stunde, dazu 4 je Netz. Der
-- Zusatz konnte also nie entscheiden (§8.1g, tragende Regel). Dieser
-- Block nimmt ihn wieder heraus, wo er steht; die Funktion ist danach
-- zeichengleich mit der Fassung vor dieser Migration.
do $mig$
declare
  alt  text := pg_get_functiondef('public.reservierung_anfragen(uuid,text,text,integer,timestamptz,text)'::regprocedure);
  a    integer := position('  -- (e) höchstens 4' in alt);
  e    integer := position(E'  begin\n    insert into reservierungen' in alt);
  neu  text;
begin
  if a = 0 then raise notice 'nicht eingespielt — nichts zu tun'; return; end if;
  neu := substr(alt, 1, a - 1) || substr(alt, e);
  neu := replace(neu, E'declare v_id uuid; v_n integer; v_erste timestamptz;\n', E'declare v_id uuid;\n');
  execute neu;
end $mig$;
