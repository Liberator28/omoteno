-- ═══════════════════════════════════════════════════════════════════
--  migration-zugriffsrechte-scharf.sql · TEIL B · Einkaufs- und Kalkulationszahlen nur mit Recht „kosten_view“
--
--  NOCH NICHT EINGESPIELT. Voraussetzung: migration-zugriffsrechte.sql (TEIL A) liegt, und admin.html,
--  einkauf.html, konto.html und die Edge Function team-zugang sind ausgerollt (§2.5/§7). Läuft diese Datei
--  VOR einkauf.html, bekommt ein Team-Konto Fehler statt eines Satzes.
--
--  BEFUND (dokumente/zugriffsrechte-befund.md): Die Lese-Regeln der Einkaufstabellen prüften nur
--  „Mitglied dieses Betriebs“. Team und Küche lasen damit Einkaufsbelege, Lagerwerte, Rezepturen und die
--  Kalkulation direkt über die REST-Schnittstelle — die Oberfläche versteckte nur etwas.
--
--  VERHALTENSÄNDERUNG, bewusst: Bestehende Team-Konten verlieren Einkauf und Kalkulation. Der Inhaber setzt
--  jemanden unter „Dein Team“ auf Manager und schaltet „Einkauf und Kalkulation“ frei.
--
--  Vorgehen:
--   1. Bestand je Tabelle LESEN: Gibt es eine Lese-Regel (SELECT oder ALL), die dieser Katalog nicht kennt,
--      bricht die Migration LAUT ab (Anhäufung, §2.3 — Regeln werden mit ODER verknüpft, eine alte „true“-Regel
--      machte jede neue zu Zierrat).
--   2. Regeln mit ALTER POLICY ändern, nie drop+create (§2.8: die Tabelle ist keinen Augenblick ohne Regel).
--   3. Die beiden Kalkulations-Funktionen an GENAU der Stelle ändern, die den Zugriff prüft (Muster E4); fehlt die
--      Stelle und ist sie nicht schon ersetzt, bricht die Migration ab, statt still nichts zu tun.
--
--  Bewusst NICHT geändert (und im Bericht genannt):
--   · lieferanten_artikel: seit E4 kann authenticated die Spalte letzter_preis gar nicht lesen (Spaltenrecht, migration-
--     einkauf-e4.sql) — die Zeile trägt nur Stammdaten (Bezeichnung, Einheit). Die Probe misst das Spaltenrecht.
--   · artikel_standort / lieferanten_standort / inventur_entwurf (e5c): Mindestbestand, Lagerort, Liefertage,
--     Mindestbestellwert, Zählstand — betrieblich, keine Kosten.
--   · bestellungen (Küche und Board brauchen die Bons; Umsatz je Bestellung bleibt für Mitglieder lesbar).
--   · lagerbewegungen/inventuren bleiben für Mitglieder mit „darf_lager“ lesbar (Lagerbuchung braucht den Bestand);
--     beide tragen Werte (wert_netto, differenz_wert). Das Recht vergibt der Inhaber ausdrücklich.
--   · zentrale_vergleich (Zentrale einer Kette, eigene Rolle in organisation_mitglieder).
--
--  Keine Zeile beginnt mit drop oder delete (§2.8).
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Bestand lesen: nur bekannte Lese-Regeln ──────────────────────────────────────────
do $$
declare
  v_bekannt constant jsonb := jsonb_build_object(
    'einkaufsbelege',        jsonb_build_array('beleg betrieb liest'),
    'einkaufspositionen',    jsonb_build_array('position betrieb liest'),
    'lagerbewegungen',       jsonb_build_array('bewegung betrieb liest'),
    'inventuren',            jsonb_build_array('inventur betrieb liest'),
    'rezepturen',            jsonb_build_array('rezeptur betrieb liest'),
    'rezepturpositionen',    jsonb_build_array('rezepturposition betrieb liest'),
    'einkauf_perioden',      jsonb_build_array('einkauf_perioden_lesen'),
    'umlagerungen',          jsonb_build_array('umlagerung beteiligte lesen'),
    'umlagerungspositionen', jsonb_build_array('umlagerungsposition beteiligte lesen'));
  t text; r record; v_fremd text := '';
begin
  for t in select jsonb_object_keys(v_bekannt) loop
    if to_regclass('public.' || t) is null then
      raise exception 'Tabelle public.% fehlt — Einkauf-Migrationen nicht (vollständig) eingespielt', t;
    end if;
    for r in select policyname, cmd from pg_policies
              where schemaname = 'public' and tablename = t and cmd in ('SELECT', 'ALL')
                and not ((v_bekannt -> t) ? policyname::text) loop
      v_fremd := v_fremd || format(E'\n  %s: „%s“ (%s)', t, r.policyname, r.cmd);
    end loop;
    -- Eine bekannte Regel, die fehlt, ist genauso ein Befund: ALTER POLICY fände sie nicht.
    for r in select value as n from jsonb_array_elements_text(v_bekannt -> t) loop
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = r.n) then
        v_fremd := v_fremd || format(E'\n  %s: erwartete Regel „%s“ fehlt', t, r.n);
      end if;
    end loop;
  end loop;
  if v_fremd <> '' then
    raise exception 'Unbekannter Regelbestand — erst ansehen, dann entscheiden:%', v_fremd;
  end if;
end $$;

-- ── 2 · Lese-Regeln ──────────────────────────────────────────────────────────────────────
-- Immer „betrieb_id in (select betriebe_mit_recht('kosten_view'))“: die Menge entsteht EINMAL je Anfrage (hat_recht je Zeile
-- wäre bei großen Tabellen — Lagerbewegungen — um Größenordnungen langsamer, gemessen).
alter policy "beleg betrieb liest" on public.einkaufsbelege
  using (betrieb_id in (select public.betriebe_mit_recht('kosten_view')));
alter policy "position betrieb liest" on public.einkaufspositionen
  using (exists (select 1 from public.einkaufsbelege e where e.id = beleg_id
                  and e.betrieb_id in (select public.betriebe_mit_recht('kosten_view'))));
-- Lagerwerte: kosten_view ODER das ausdrücklich vergebene Lagerrecht (darf_lager, wie darf_lager_buchen(): Mitglied dieses
-- Betriebs, mit PIN). Der Inhaber steckt in kosten_view.
alter policy "bewegung betrieb liest" on public.lagerbewegungen
  using (betrieb_id in (select public.betriebe_mit_recht('kosten_view'))
      or betrieb_id in (select m.betrieb_id from public.betrieb_mitglieder m
                         where m.nutzer_id = auth.uid() and m.darf_lager and m.betrieb_id in (select public.meine_betriebe())));
alter policy "inventur betrieb liest" on public.inventuren
  using (betrieb_id in (select public.betriebe_mit_recht('kosten_view'))
      or betrieb_id in (select m.betrieb_id from public.betrieb_mitglieder m
                         where m.nutzer_id = auth.uid() and m.darf_lager and m.betrieb_id in (select public.meine_betriebe())));
alter policy "rezeptur betrieb liest" on public.rezepturen
  using (betrieb_id in (select public.betriebe_mit_recht('kosten_view')));
alter policy "rezepturposition betrieb liest" on public.rezepturpositionen
  using (exists (select 1 from public.rezepturen r where r.id = rezeptur_id
                  and r.betrieb_id in (select public.betriebe_mit_recht('kosten_view'))));
alter policy einkauf_perioden_lesen on public.einkauf_perioden
  using (betrieb_id in (select public.betriebe_mit_recht('kosten_view')));
alter policy "umlagerung beteiligte lesen" on public.umlagerungen
  using (von_betrieb in (select public.betriebe_mit_recht('kosten_view'))
      or nach_betrieb in (select public.betriebe_mit_recht('kosten_view')));
alter policy "umlagerungsposition beteiligte lesen" on public.umlagerungspositionen
  using (exists (select 1 from public.umlagerungen u where u.id = umlagerung_id
                  and (u.von_betrieb in (select public.betriebe_mit_recht('kosten_view'))
                    or u.nach_betrieb in (select public.betriebe_mit_recht('kosten_view')))));

-- Belegfotos (Rechnungen) im Speicher: gleiche Regel. Der Ordner-Test bleibt (nur eine UUID als erster Ordner).
-- (storage.objects gehört nicht uns: fehlt die Regel oder darf sie diese Rolle nicht ändern, bricht es laut ab.)
alter policy "belege mitglied liest" on storage.objects
  using (bucket_id = 'belege' and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(name))[1])::uuid in (select public.betriebe_mit_recht('kosten_view'))
    else false end);

-- ── 3 · Die beiden Kalkulations-Funktionen: Zugriff = Recht, nicht Mitgliedschaft ──────────
do $$
declare
  d text;
  v_alt_k constant text := '(p_betrieb in (select public.meine_betriebe()) or public.ist_master())';
  v_neu_k constant text := 'public.hat_recht(p_betrieb, ''kosten_view'')';
  v_alt_w constant text := '(p_betrieb in (select public.meine_betriebe()) or public.ist_master() or public.darf_vergleichen(p_betrieb))';
  v_neu_w constant text := '(public.hat_recht(p_betrieb, ''kosten_view'') or public.darf_vergleichen(p_betrieb))';
begin
  d := pg_get_functiondef('public.gericht_kalkulation(uuid, timestamptz)'::regprocedure);
  if position(v_alt_k in d) > 0 then
    execute replace(d, v_alt_k, v_neu_k);
  elsif position(v_neu_k in d) = 0 then
    raise exception 'gericht_kalkulation: Zugriffsstelle nicht gefunden (Live-Fassung weicht ab) — von Hand prüfen';
  end if;
  d := pg_get_functiondef('public.wareneinsatz_theoretisch(uuid, timestamptz, timestamptz)'::regprocedure);
  if position(v_alt_w in d) > 0 then
    execute replace(d, v_alt_w, v_neu_w);
  elsif position(v_neu_w in d) = 0 then
    raise exception 'wareneinsatz_theoretisch: Zugriffsstelle nicht gefunden (Live-Fassung weicht ab) — von Hand prüfen';
  end if;
end $$;

commit;

-- ── Nach dem Einspielen live LESEN (nicht „success“ glauben) ────────────────────────────────
--   select tablename, policyname, cmd, qual from pg_policies where schemaname='public'
--    and tablename in ('einkaufsbelege','einkaufspositionen','lagerbewegungen','inventuren','rezepturen','rezepturpositionen',
--                      'einkauf_perioden','umlagerungen','umlagerungspositionen') order by 1,2;   -- jede qual trägt betriebe_mit_recht
--   select polname, pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'storage.objects'::regclass and polname = 'belege mitglied liest';
--   select proname, prosrc like '%hat_recht%' as ok from pg_proc where proname in ('gericht_kalkulation','wareneinsatz_theoretisch');
--   select has_column_privilege('authenticated','public.lieferanten_artikel','letzter_preis','select');   -- muss false sein (E4)
