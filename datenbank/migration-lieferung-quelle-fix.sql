-- ═══════════════════════════════════════════════════════════════════
--  BEREITS ANGEWENDET (2026-09-23) · bestellung_aufgeben() lehnte
--  quelle='lieferung' ab — jede Lieferbestellung scheiterte live
--
--  ── BEFUND ─────────────────────────────────────────────────────
--  bestellung_liefern() (migration-lieferung.sql) ruft ihre eigene
--  Aufruferin bestellung_aufgeben() ausdrücklich mit
--  p_quelle => 'lieferung' auf. bestellung_aufgeben() selbst prüfte
--  aber weiterhin nur:
--
--    if p_quelle is null or p_quelle not in ('tisch','service') then
--      raise exception 'Quelle ungueltig';
--
--  Die CHECK-Regel der Tabelle (bestellungen_quelle_check,
--  migration-quelle-lieferung.sql) erlaubte 'lieferung' bereits —
--  nur die Funktion selbst wurde nie nachgezogen, als
--  bestellung_liefern() angelegt wurde. Bestätigt durch einen
--  echten Aufruf in einer zurückgedrehten Transaktion:
--  bestellung_liefern(...) warf "FEHLER: Quelle ungueltig". Jede
--  Lieferbestellung ist seither serverseitig gescheitert — Adresse
--  getippt, Korb gefüllt, Knopf gedrückt, dann ein Fehler, den
--  niemand erwartet hat.
--
--  ── ZWEITER FUND BEIM NACHSEHEN DESSELBEN KÖRPERS (§2.3a) ────────
--  Die serverseitige Preisnachrechnung
--
--    if p_quelle = 'tisch' and jsonb_array_length(...) > 0 then
--
--  lief bisher NUR für quelle='tisch'. Die Quelle einfach um
--  'lieferung' zu erweitern, ohne diese Zeile mitzuziehen, hätte
--  eine neue, ungeprüfte Preis-Manipulationslücke für
--  Lieferbestellungen geöffnet — der Gast hätte jeden Preis
--  schicken können, die Funktion hätte ihn nie gegen gerichte.preis
--  nachgerechnet. Deshalb ändert dieser Fix beide Stellen in
--  derselben create-or-replace-Anweisung, nicht nur die erste.
--
--  ── ANGEWENDETER FIX (identische Signatur, §2.1) ─────────────────
--    1. p_quelle not in ('tisch','service')
--       → p_quelle not in ('tisch','service','lieferung')
--    2. if p_quelle = 'tisch' and jsonb_array_length(...)
--       → if p_quelle in ('tisch','lieferung') and jsonb_array_length(...)
--
--  Vor dem echten Anwenden in einer zurückgedrehten Transaktion mit
--  vier Fällen geprüft: Lieferung/richtiger Preis → geht durch;
--  Lieferung/manipulierter Preis (0,01 statt 20,00) → korrekt
--  abgelehnt; Tisch/richtiger Preis → unverändert erfolgreich;
--  Tisch/manipulierter Preis → unverändert abgelehnt. Danach echt
--  angewendet und über pg_get_function_identity_arguments bestätigt:
--  genau eine Fassung der Funktion existiert (kein zweites,
--  parallel laufendes Duplikat, §2.1). Anschließend erneut über den
--  echten bestellung_liefern()-Aufruf (nicht gemockt, §8.1i) mit
--  denselben vier Fällen bestätigt — alle vier wie erwartet.
--
--  Die Tagesnummer-Vergabe (nur für quelle='tisch') war NICHT Teil
--  dieses Fixes — Lieferbestellungen bekommen weiterhin keine
--  Tagesnummer. Das ist unverändertes, vorbestehendes Verhalten und
--  wird hier bewusst nicht mitgezogen, um diese Änderung auf den
--  gemeldeten Fehler zu beschränken (§9: keine zwei Änderungen an
--  derselben Funktion in einem Zug).
--
--  Diese Datei dokumentiert die bereits live angewendete Änderung,
--  falls die Funktion je aus einer älteren Sicherung wiederhergestellt
--  werden muss. Erneutes Ausführen ist unschädlich (create or
--  replace, identische Signatur).
-- ═══════════════════════════════════════════════════════════════════

begin;

CREATE OR REPLACE FUNCTION public.bestellung_aufgeben(p_betrieb_id uuid, p_quelle text, p_tisch text DEFAULT NULL::text, p_summe numeric DEFAULT 0, p_notiz text DEFAULT NULL::text, p_positionen jsonb DEFAULT '[]'::jsonb, p_gast_kennung text DEFAULT NULL::text, p_tisch_schluessel text DEFAULT NULL::text, p_sitzung text DEFAULT NULL::text, p_geraet text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  neue        uuid;
  b           record;
  t           record;
  s           record;
  tisch_final text;
  bestaetigt  boolean := false;
  basis_summe numeric := 0;
  pos         jsonb;
  treffer     numeric;
  name_roh    text;
  name_basis  text;
  tagesnr     smallint := null;
  tagesbeginn timestamptz;
begin
  if p_betrieb_id is null then raise exception 'Betrieb fehlt' using errcode='P0001'; end if;
  if p_quelle is null or p_quelle not in ('tisch','service','lieferung') then
    raise exception 'Quelle ungueltig' using errcode='P0001';
  end if;

  select id, slug, bestell_pause, bestell_pause_text, tisch_pflicht, zustand, test_bis
    into b from betriebe where id = p_betrieb_id;
  if not found then raise exception 'Betrieb unbekannt' using errcode='P0001'; end if;

  -- ── Vertragszustand ────────────────────────────────────────────
  -- Die Texte richten sich an den GAST, nicht an den Betreiber. Er
  -- kann nichts dafuer und soll nicht raten muessen, was los ist.
  if b.zustand = 'gekuendigt' then
    raise exception 'Hier kann gerade nicht bestellt werden. Bitte wenden Sie sich an das Personal.'
      using errcode='P0001';
  end if;
  if b.zustand = 'pausiert' then
    raise exception 'Die Bestellung am Tisch ist vorübergehend abgeschaltet. Bitte wenden Sie sich an das Personal.'
      using errcode='P0001';
  end if;
  if b.zustand = 'test' and b.test_bis is not null and b.test_bis < now() then
    raise exception 'Die Testphase dieses Hubs ist abgelaufen. Bitte wenden Sie sich an das Personal.'
      using errcode='P0001';
  end if;

  if p_gast_kennung is not null
     and (length(p_gast_kennung) < 8 or length(p_gast_kennung) > 80) then
    raise exception 'Kennung ungueltig' using errcode='P0001';
  end if;

  -- Die Geraetekennung ist etwas anderes als die Quittungsnummer
  -- darueber: sie bleibt ueber Bestellungen hinweg gleich. Ein
  -- unsauberer Wert wird verworfen, nicht abgewiesen - eine
  -- Bestellung scheitert nicht an einem Wiedererkennungsmerkmal.
  if p_geraet is not null
     and (length(p_geraet) < 8 or length(p_geraet) > 64
          or p_geraet !~ '^[A-Za-z0-9_-]+$') then
    p_geraet := null;
  end if;

  if p_notiz is not null and length(p_notiz) > 500 then
    raise exception 'Anmerkung zu lang' using errcode='P0001';
  end if;
  if p_positionen is not null and jsonb_array_length(p_positionen) > 60 then
    raise exception 'Zu viele Positionen' using errcode='P0001';
  end if;

  if b.bestell_pause then
    raise exception '%', coalesce(nullif(b.bestell_pause_text,''),
      'Wir nehmen gerade keine Bestellungen an.') using errcode='P0001';
  end if;

  tisch_final := p_tisch;

  if p_sitzung is not null and p_sitzung <> '' then
    select si.id, si.tisch_id, ti.nummer
      into s
      from tisch_sitzungen si
      join tische ti on ti.id = si.tisch_id
     where si.token = p_sitzung
       and si.betrieb_id = p_betrieb_id
       and si.gueltig_bis > now()
       and ti.aktiv
     limit 1;

    if found then
      tisch_final := s.nummer;
      bestaetigt  := true;
      update tisch_sitzungen
         set letzte_aktivitaet = now(),
             gueltig_bis       = now() + interval '4 hours'
       where id = s.id;
    end if;
  end if;

  if not bestaetigt and p_tisch_schluessel is not null and p_tisch_schluessel <> '' then
    select ti.nummer, ti.aktiv into t
      from tische ti
     where ti.schluessel = p_tisch_schluessel
       and ti.betrieb_id = p_betrieb_id;
    if not found or not t.aktiv then
      raise exception 'Dieser Tischcode gilt hier nicht.' using errcode='P0001';
    end if;
    tisch_final := t.nummer;
    bestaetigt  := true;
  end if;

  if not bestaetigt and b.tisch_pflicht then
    raise exception 'Zum Bestellen bitte kurz den Untersetzer auf Ihrem Tisch antippen.'
      using errcode='P0001';
  end if;

  if tisch_final is not null and length(tisch_final) > 20 then
    raise exception 'Tischangabe ungueltig' using errcode='P0001';
  end if;

  if p_quelle in ('tisch','lieferung') and jsonb_array_length(coalesce(p_positionen,'[]'::jsonb)) > 0 then
    for pos in select * from jsonb_array_elements(p_positionen) loop
      name_roh := coalesce(pos->>'name','');
      name_basis := btrim(split_part(name_roh, ' (', 1));
      select preis into treffer from gerichte
       where betrieb_id = p_betrieb_id and name = name_basis
       limit 1;
      if treffer is not null then
        basis_summe := basis_summe
          + treffer * greatest(1, coalesce((pos->>'menge')::numeric, 1));
      end if;
    end loop;

    if basis_summe > 0 and coalesce(p_summe,0) < basis_summe - 0.01 then
      raise exception 'Der Preis stimmt nicht. Bitte die Karte neu laden.'
        using errcode='P0001';
    end if;
  end if;

  if p_gast_kennung is not null then
    select id into neue from bestellungen where gast_kennung = p_gast_kennung limit 1;
    if neue is not null then return neue; end if;
  end if;

  if p_quelle = 'tisch' then
    perform pg_advisory_xact_lock(hashtext('tagesnummer:' || p_betrieb_id::text));
    tagesbeginn := date_trunc('day', now() at time zone 'Europe/Berlin')
                     at time zone 'Europe/Berlin';
    select coalesce(max(tagesnummer), 99) + 1 into tagesnr
      from bestellungen
     where betrieb_id = p_betrieb_id
       and zeitpunkt >= tagesbeginn;
    if tagesnr > 999 then tagesnr := null; end if;
  end if;

  insert into bestellungen
    (betrieb_id, quelle, status, tisch, summe, summe_gast, notiz,
     positionen, gast_kennung, tagesnummer, tisch_bestaetigt, geraet)
  values
    (p_betrieb_id, p_quelle, 'neu', tisch_final,
     coalesce(p_summe,0), coalesce(p_summe,0),
     p_notiz, coalesce(p_positionen,'[]'::jsonb), p_gast_kennung,
     tagesnr, bestaetigt, p_geraet)
  returning id into neue;

  return neue;
end;
$function$;

commit;

-- ═══════════════════════════════════════════════════════════════════
--  DANACH PRÜFEN · aus dem Katalog gelesen, nicht behauptet (§0)
-- ═══════════════════════════════════════════════════════════════════
--
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and p.proname='bestellung_aufgeben';
--
--   Erwartet: GENAU EINE Zeile (kein Duplikat mit anderer Signatur,
--   §2.1). Danach ein echter Aufruf von bestellung_liefern() mit
--   korrektem UND manipuliertem Preis in einer zurückgedrehten
--   Transaktion — kein gemockter Test, siehe §8.1i.
-- ═══════════════════════════════════════════════════════════════════
