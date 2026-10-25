-- ═══════════════════════════════════════════════════════════════════
--  EINGESPIELT am 25.10.2026 · migration-bestellungen-spaltenrechte.sql (Lesefragen live: 34 Spalten, Trigger alle security definer)
--  Vorbereitet am 24.10.2026. Einspielen NUR mit ausdrücklicher Freigabe
--  des Betreibers und erst nach den Lesefragen unten (CLAUDE.md §2.3f, §2.5).
--
--  BEFUND (dokumente/saal-kueche-integration.md, Abschnitt 4): `authenticated`
--  darf UPDATE auf die GANZE Tabelle bestellungen — 34 Spalten, darunter
--  summe, positionen, rabatt_betrag, betrieb_id, quelle, gast_kennung. Heute
--  hält das nur die RLS-Regel (eigener Betrieb); sie unterscheidet nicht
--  zwischen Team und Inhaber und nicht zwischen „Status“ und „Preis“. Ein
--  gestohlenes Team-Konto könnte die Summe einer Bestellung ändern — nicht
--  über das Board, aber über die offene REST-Tür.
--  INSERT, DELETE, TRUNCATE usw. sind schon zu (migration-grant-engen.sql,
--  19.10.). Offen ist nur UPDATE.
--
--  WIE: UPDATE wird auf die Spalten gekürzt, die Board und Küche WIRKLICH
--  schreiben (dokumente/bestellungen-schreibwege.md, geprüft von
--  pruefungen/pruef-bestellungen-schreibwege.js gegen den Quelltext):
--    status, wartezeit_min, bestaetigt_um     Zusage / Starten / Zurück / Fertig
--    kueche_fertig_um, theke_fertig_um        Abholbereit je Spur
--    gebracht_um                              „Gebracht“ im Board
--    zugewiesen                               Team-Modus (Nummer 1–99)
--    pruefen, pruef_grund                     Freigeben / Verwerfen einer markierten Bestellung
--  Alles andere läuft über Funktionen mit security definer
--  (bestellung_aufgeben, bestellung_stornieren, rechnung_rabattieren, …) —
--  die brauchen kein Spaltenrecht des Aufrufers.
--
--  VOR DEM EINSPIELEN LESEN (Live-Katalog, nicht aus dem Gedächtnis; §0, §1.2):
--   1) Welche UPDATE-Spalten hat authenticated JETZT?
--        select column_name from information_schema.column_privileges
--         where table_schema='public' and table_name='bestellungen'
--           and grantee='authenticated' and privilege_type='UPDATE' order by 1;
--      Erwartet: 34 Zeilen (alle Spalten). Weichen sie ab, ist die Wegeliste
--      NICHT mehr vollständig — erst klären.
--   2) Schreibt irgendein Trigger auf bestellungen als AUFRUFER weiter?
--        select t.tgname, p.proname, p.prosecdef
--          from pg_trigger t join pg_proc p on p.oid=t.tgfoid
--         where t.tgrelid='public.bestellungen'::regclass and not t.tgisinternal;
--      Ein Trigger mit prosecdef=false, der selbst UPDATE auf bestellungen
--      ausführt, bräuchte das Recht für seine Spalten.
--   3) Nicht-security-definer-Funktionen, die bestellungen ändern:
--        select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--         where n.nspname='public' and not p.prosecdef
--           and pg_get_functiondef(p.oid) ~* 'update +(public\.)?bestellungen';
--      Erwartet: keine Zeile.
--   4) Code vor dem Recht (§2.5/§7): die ausgelieferten Seiten müssen den Stand
--      dieser Wegeliste haben (Board und Küche); ein alter zwischengespeicherter
--      Tab, der eine andere Spalte schreibt, bekäme „permission denied“ —
--      das Board zeigt dann „Konnte nicht gespeichert werden“, die Küche den
--      „Erneut“-Knopf. Kein stilles Verschlucken, aber auch kein Verlust von Umsatz
--      (der Gast bestellt über bestellung_aufgeben, nicht über diese Tür).
--
--  NACH DEM EINSPIELEN MESSEN (zurückgedrehte Transaktion, §2.3b: Zeilenzahl,
--  nicht Ausnahme; kein `returning` im Schreibtest):
--   · als Teammitglied: update bestellungen set status='arbeit' → 1 Zeile
--   · als Teammitglied: update bestellungen set summe=0 → permission denied
--   · datenbank/pruef-bestellungen-spaltenrechte.sql (lokal: pruefungen/pruef-bestellungen-spaltenrechte-lokal.sh)
--
--  RÜCKGÄNGIG: grant update on public.bestellungen to authenticated;
--  Additiv im Sinne von §2.5: Es wird Recht genommen, keine Spalte geändert.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- Erst das Tabellenrecht, dann die Spalten. (Spaltenrechte, die früher einzeln vergeben wurden,
-- z. B. zugewiesen aus migration-teammodus.sql, bleiben — und stehen ohnehin in der Liste.)
revoke update on public.bestellungen from authenticated;

grant update (
  status, wartezeit_min, bestaetigt_um,
  kueche_fertig_um, theke_fertig_um,
  gebracht_um, zugewiesen,
  pruefen, pruef_grund
) on public.bestellungen to authenticated;

commit;
