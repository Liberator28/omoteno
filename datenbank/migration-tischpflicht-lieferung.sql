-- ═══════════════════════════════════════════════════════════════════
--  migration-tischpflicht-lieferung.sql · Tischpflicht darf Lieferung und Abholung nicht abweisen
--  (Fund 25.10., beim Bau der Abholung)
--
--  NOCH NICHT EINGESPIELT. Vorschlag, lokal in Postgres 16 geprüft (pruefungen/pruef-tischpflicht-lokal.sh), aber nie
--  gegen die Live-Datenbank gelaufen — diese Umgebung hatte keinen Zugang. Vor dem Einspielen die drei Lesefragen unten
--  beantworten; der Block bricht LAUT ab, wenn eine Funktion nicht so aussieht, wie er sie erwartet.
--
--  DER BEFUND (gemessen, nicht angenommen). bestellung_aufgeben prüft die Tischpflicht VOR der Quelle:
--      if not bestaetigt and b.tisch_pflicht then raise exception 'Zum Bestellen bitte kurz den Untersetzer …'
--  und bestellung_liefern wie bestellung_abholen rufen genau diese Funktion mit p_quelle 'lieferung' und ohne Tisch.
--  Ein Haus mit eingeschalteter Tischpflicht UND eingeschalteter Lieferung/Abholung weist also JEDE Lieferung und
--  Abholung mit einem Satz über den Untersetzer ab — und der Gast, der zu Hause oder unterwegs ist, kann ihn nicht
--  antippen. Probe: pruefungen/pruef-tischpflicht-lokal.sh (T2: „Ausnahme: Zum Bestellen bitte kurz den Untersetzer …“).
--  Die Probe in migration-lieferung.sql (Zeile ~322) hatte diese Frage offen gelassen („Probe 3 beantwortet es“).
--
--  WARUM KEIN EINFACHES „p_quelle <> 'lieferung'“ in bestellung_aufgeben. bestellung_aufgeben ist für anon aufrufbar.
--  Mit dieser Lockerung könnte jeder die Roh-Funktion mit p_quelle 'lieferung' rufen und die Tischpflicht umgehen —
--  eine Bestellung ohne Adresse, ohne Namen, vom Sofa. Die Tischpflicht hielte nur noch gegen Leute, die nicht wissen,
--  dass es den Parameter gibt (§2.3a: ein Wächter neben einer offenen Tür).
--
--  DIE LÖSUNG: Nur die beiden Funktionen, die Name/Telefon bzw. Anschrift prüfen, nehmen die Tischpflicht aus. Sie
--  setzen unmittelbar vor dem Aufruf eine Einstellung, die NUR für die laufende Transaktion gilt
--  (set_config(…, true)); bestellung_aufgeben liest sie über tischpflicht_ausnahme_nehmen() und löscht sie dabei —
--  die Ausnahme gilt für GENAU EINEN Aufruf. Ein Client kann diese Einstellung nicht setzen (PostgREST erlaubt es nicht;
--  pg_catalog ist nicht als /rpc freigegeben) und eine Roh-Anfrage trägt sie nie.
--
--  WIE DIE DREI FUNKTIONEN GEÄNDERT WERDEN. Nicht als neuer Funktionskörper, den ich aus einer Datei im Verzeichnis
--  abschriebe (die Live-Fassung kann davon abweichen, §1.3), sondern als Textersatz an der LIVE-Definition
--  (pg_get_functiondef): genau eine Fundstelle je Anker, sonst Abbruch. Die Signatur bleibt dieselbe — es gibt weiter
--  genau EINE Fassung je Funktion (§2.1); der Abschluss zählt nach.
--
--  LESEFRAGEN VOR DEM EINSPIELEN (jede einzeln, nicht „success: true“ glauben, §2.2):
--    select p.proname, count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and p.proname in ('bestellung_aufgeben','bestellung_liefern','bestellung_abholen') group by 1;
--        → jeweils 1
--    select pg_get_functiondef('public.bestellung_aufgeben(uuid,text,text,numeric,text,jsonb,text,text,text,text,text)'::regprocedure)
--        like '%if not bestaetigt and b.tisch_pflicht then%';          → true
--    select count(*) from betriebe where tisch_pflicht;                → wie viele Häuser betrifft es heute?
-- ═══════════════════════════════════════════════════════════════════
begin;

-- Der Helfer liest die Ausnahme UND nimmt sie sofort zurück: Sie gilt für genau einen Aufruf von bestellung_aufgeben,
-- nicht für den Rest der Transaktion (die Probe T8 misst genau das). Er ist kein Endpunkt: kein EXECUTE für Clients (§2.3a).
create or replace function public.tischpflicht_ausnahme_nehmen(p_quelle text)
returns boolean language plpgsql volatile set search_path to 'public' as $h$
declare v boolean;
begin
  v := p_quelle = 'lieferung' and coalesce(current_setting('omoteno.ohne_tischpflicht', true), '') = '1';
  perform set_config('omoteno.ohne_tischpflicht', '', true);
  return v;
end
$h$;
revoke all on function public.tischpflicht_ausnahme_nehmen(text) from public, anon, authenticated;

do $mig$
declare
  d text;
  fn regprocedure;
  anker text;
  neu text;
  n int;
  namen text[] := array['bestellung_aufgeben','bestellung_liefern','bestellung_abholen'];
  name text;
begin
  foreach name in array namen loop
    select p.oid::regprocedure into fn
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = name;
    if fn is null then raise exception 'Funktion % nicht gefunden — nichts geändert', name; end if;
    if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = name) <> 1 then
      raise exception 'Funktion % hat mehr als eine Fassung — erst aufräumen (§2.1)', name;
    end if;
    d := pg_get_functiondef(fn);

    if name = 'bestellung_aufgeben' then
      anker := $a$if not bestaetigt and b.tisch_pflicht then$a$;
      neu   := $a$if tischpflicht_ausnahme_nehmen(p_quelle) is not true and not bestaetigt and b.tisch_pflicht then$a$;
    else
      anker := $a$v_id := bestellung_aufgeben($a$;
      neu   := $a$perform set_config('omoteno.ohne_tischpflicht', '1', true);
  v_id := bestellung_aufgeben($a$;
    end if;

    n := (length(d) - length(replace(d, anker, ''))) / length(anker);
    if n <> 1 then
      raise exception 'Funktion %: Anker „%“ kommt % mal vor (erwartet: genau 1) — nichts geändert', name, anker, n;
    end if;
    execute replace(d, anker, neu);
  end loop;
end
$mig$;

-- Abschluss: weiter genau eine Fassung je Funktion, und die Änderung steht wirklich drin.
do $chk$
declare r record;
begin
  for r in select p.proname, count(*) c from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname = 'public' and p.proname in ('bestellung_aufgeben','bestellung_liefern','bestellung_abholen') group by 1 loop
    if r.c <> 1 then raise exception 'Nach der Änderung hat % % Fassungen', r.proname, r.c; end if;
  end loop;
  if pg_get_functiondef('public.bestellung_aufgeben(uuid,text,text,numeric,text,jsonb,text,text,text,text,text)'::regprocedure) not like '%tischpflicht_ausnahme_nehmen%' then
    raise exception 'bestellung_aufgeben trägt die Ausnahme nicht';
  end if;
end
$chk$;

commit;
