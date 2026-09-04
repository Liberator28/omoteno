-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET am 31.08.2026 auf quxwweuvdqtjsdwgjdrh
--  Zwei Migrationen: anon_schreibrechte_schliessen,
--                    triggerfunktionen_aus_dem_api_nehmen
--
--  Der anonyme Gast bekommt nur noch, was er wirklich braucht.
-- ═══════════════════════════════════════════════════════════════════
--
--  BEFUND
--
--  Der oeffentliche anon-Schluessel steht in jedem Hub. Das ist so
--  vorgesehen und richtig. Er trug aber Rechte, die keine einzige
--  Seite je benutzt hat — und an denen die Waechter vorbeifuehrten.
--
--  1) INSERT auf bestellungen.  bestellung_aufgeben rechnet den Preis
--     aus der Karte NACH und weist Unterzahlung ab; sie prueft
--     Vertragszustand, Bestellpause, Tischpflicht und Tischschluessel.
--     Der direkte Weg in die Tabelle prueft per RLS nur vier Dinge —
--     und den Preis NICHT.
--     GEMESSEN, vor der Aenderung, als anon:
--       insert into bestellungen (…, summe 0.01, tisch_bestaetigt true,
--                                 tagesnummer 500, 99 Stueck)
--       → 1 Zeile eingeschleust.
--     Ein Waechter neben einer offenen Tuer ist kein Waechter.
--
--  2) UPDATE/DELETE auf der Sicht betriebe_oeffentlich.  Sie lief mit
--     security_invoker=false und gehoert postgres — umging die RLS von
--     betriebe also vollstaendig.
--     GEMESSEN, vor der Aenderung, als anon:
--       update betriebe_oeffentlich set bestell_pause_text='GEKAPERT'
--       → 2 Zeilen geaendert, also ALLE Betriebe.
--     Damit haette jeder mit dem oeffentlichen Schluessel jedem Kunden
--     die Bestellung abschalten, jedem Gast einen beliebigen Text
--     vorsetzen oder per slug-Aenderung jeden Hub zerreissen koennen.
--
--  3) INSERT auf servicerufe — ohne Bremse, und von keiner Seite
--     benutzt: der Serviceruf laeuft als quelle='service' ueber
--     bestellung_aufgeben.
--
--  4) Voll-Rechte auf gaeste (mit E-Mail-Adressen), gutscheine und
--     aktionen. Hier hielt die RLS noch — gemessen 0 sichtbare Zeilen.
--     Aber sie war die EINZIGE Linie, und auf aktionen stand sogar
--     TRUNCATE, das RLS grundsaetzlich umgeht.
--
--  5) Fuenf TRIGGER-Funktionen standen als /rest/v1/rpc/<name> offen,
--     darunter melde_neue_bestellung mit search_path 'net, extensions,
--     public', die von sich aus einen HTTP-Aufruf nach draussen macht.
--
--  WAS NICHT ANGEFASST WURDE
--  Keine RLS-Regel, keine Funktion, kein Vorgabewert, keine Daten.
--  Nur Rechte, von denen nachgewiesen ist, dass sie niemand braucht.
--  Nachgewiesen heisst: grep ueber alle Seiten und das Hub-Geruest
--  nach jedem REST-Weg und jedem RPC-Namen.
--
--  BELEG
--  Vor dem Anwenden in einer zurueckgedrehten Transaktion gefahren,
--  danach gegen den echten Zustand wiederholt (pruef-rechte.sql):
--    10 von 10 Angriffen abgewiesen
--    10 von 10 ehrlichen Wegen unveraendert (Karte lesen, bestellen,
--    Bestellpass, Gastkonto, E-Mail hinterlegen, reservieren,
--    Ereignis melden, slug_frei)
--  Trigger feuern weiter: Reservierung, Bestellung und Ereignis liefen
--  nach dem Entzug unveraendert — ein Trigger laeuft als Teil der
--  Anweisung, nicht ueber das EXECUTE-Recht des Aufrufers.
-- ═══════════════════════════════════════════════════════════════════

-- 1 · Bestellen geht nur noch durch die Funktion.
revoke insert on public.bestellungen from anon;

-- 2 · Die Sicht wird nur noch gelesen — und mit den Rechten des
--     Aufrufers statt denen ihres Eigentuemers. Dafuer braucht anon
--     die eine Spalte, die ihm auf betriebe noch fehlte; tisch_pflicht
--     ist ein Schalter, kein Geheimnis.
revoke insert, update, delete, truncate, references, trigger
  on public.betriebe_oeffentlich from anon, authenticated;
grant select (tisch_pflicht) on public.betriebe to anon;
alter view public.betriebe_oeffentlich set (security_invoker = true);

-- 3 · Serviceruf: benutzt keine Seite.
revoke insert on public.servicerufe from anon;

-- 4 · Ueberschuss. Das LESEN der Aktionen bleibt — der Hub zeigt sie.
revoke insert, update, delete, truncate, references, trigger
  on public.aktionen from anon;
revoke all on public.gaeste     from anon;
revoke all on public.gutscheine from anon;

-- 5 · Trigger-Funktionen gehoeren nicht ins oeffentliche API.
--     PostgREST stellt JEDE Funktion in public als RPC bereit, sobald
--     die Rolle EXECUTE hat.
revoke execute on function
  public.anfragen_bremse(),
  public.bestellung_bremse(),
  public.ereignis_bremse(),
  public.reservierung_bremse(),
  public.melde_neue_bestellung(),
  public.tisch_schluessel_neu()
from anon, authenticated, public;

-- AUSDRUECKLICH GEBLIEBEN:
--   ist_master() und meine_betriebe() — sie stehen IN den RLS-Regeln
--   und werden mit den Rechten des Fragenden ausgewertet. Ein Entzug
--   wuerde jede Regel des Betriebs lahmlegen.
--   slug_frei() — konto.html ruft es beim Anlegen eines Hubs.
--   Die sechs Gast-RPCs — sie SIND der Weg, auf dem ein Gast ohne
--   Anmeldung bestellt. Der Linter warnt sie an; das ist Absicht.
