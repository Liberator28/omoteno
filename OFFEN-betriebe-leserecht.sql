-- ═══════════════════════════════════════════════════════════════════
--  OFFEN · Der Gast kann die Kopfdaten seines Lokals nicht lesen
--
--  NICHT ANGEWENDET. Diese Datei ist zum Selbst-Ausführen im
--  Supabase-SQL-Editor. Rechte an einer laufenden Datenbank ändere
--  ich nicht von mir aus.
--
--  ── BEFUND ────────────────────────────────────────────────────
--  Der Gäste-Hub liest beim Start (hub.vorlage.html, Zeile ~8381):
--
--      /rest/v1/betriebe?slug=eq.<slug>
--        &select=id,bestell_pause,bestell_pause_text,hub_texte
--
--  Die Rolle „anon" hat auf public.betriebe KEIN Leserecht.
--  Nachgewiesen, nicht vermutet:
--
--      set local role anon;
--      select 1 from betriebe;
--      → ERROR 42501: permission denied for table betriebe
--
--  ── WARUM DAS SO SCHWER WIEGT ─────────────────────────────────
--  Der Aufruf steht im SELBEN try-Block wie das Laden der Karte,
--  und die Karte braucht die id aus seinem Ergebnis:
--
--      const b = await hol(".../betriebe?...");   ← wirft hier
--      betriebId = b[0].id;
--      const zeilen = await hol(".../gerichte?betrieb_id=eq."+b[0].id+...);
--
--  „hol" wirft bei !response.ok. Damit bricht die ganze Kette ab:
--
--    · die LIVE-KARTE lädt nie — der Gast sieht die Karte, die beim
--      Erzeugen in die Datei gebacken wurde. Preisänderungen im
--      Board erreichen ihn nicht.
--    · betriebId bleibt null. bestellung_aufgeben verlangt aber
--      p_betrieb_id uuid → DER GAST KANN NICHT BESTELLEN.
--    · bestell_pause wirkt nicht — der Schalter „wir nehmen gerade
--      keine Bestellungen an" im Board bleibt ohne Wirkung.
--    · hub_texte wirken nicht — Slogan, Begrüßung und der Titel der
--      Top-Runner-Aktion aus dem Board erreichen den Hub nicht.
--
--  Der Hub fällt dabei sauber zurück (console.warn „Karte kommt aus
--  dem Quelltext") — es sieht also nicht kaputt aus. Genau deshalb
--  fällt es ohne Messung nicht auf.
--
--  Der Rest der Rechte ist richtig gesetzt und wurde mitgeprüft:
--    gerichte   · anon liest (nur verfuegbar = true)   ✓
--    aktionen   · anon liest (nur laufende)            ✓
--    reservierungen, ereignisse · anon wirft ein, liest nicht  ✓
--    bestellungen · anon hat gar keinen Zugriff        ✓
--  Es fehlt genau EINE Stelle.
--
--  ── WARUM SPALTENWEISE UND NICHT „grant select on betriebe" ───
--  In betriebe stehen auch plan, preis_monat, vertrag_ab,
--  gekuendigt_zum, rechnung_an und test_bis — die Geschäftsdaten
--  JEDES Kunden. Ein Recht auf die ganze Tabelle machte sie für
--  jeden lesbar, der die öffentliche Adresse kennt.
--
--  ── GEPRÜFT IN EINER ZURÜCKGEDREHTEN TRANSAKTION ──────────────
--    1 Kopfdaten lesen ......... chocolamour · pause=false   ✓
--    2 Spalte preis_monat ...... verweigert                  ✓
--      Spalte plan ............. verweigert                  ✓
--      Spalte vertrag_ab ....... verweigert                  ✓
--      Spalte gekuendigt_zum ... verweigert                  ✓
--      Spalte rechnung_an ...... verweigert                  ✓
--      Spalte test_bis ......... verweigert                  ✓
--      Spalte zustand .......... verweigert                  ✓
--      Spalte angelegt ......... verweigert                  ✓
--    3 select * versuchen ...... verweigert                  ✓
-- ═══════════════════════════════════════════════════════════════════

begin;

-- Nur die sechs Spalten, die der Hub tatsächlich liest.
grant select (id, slug, name, bestell_pause, bestell_pause_text, hub_texte)
  on public.betriebe to anon;

-- RLS ist auf betriebe aktiv. Ohne passende Regel greift auch ein
-- Spaltenrecht nicht — beide Ebenen müssen zustimmen.
-- „using (true)" ist hier richtig: Welche Zeile der Gast bekommt,
-- entscheidet der slug in seiner Adresse, und ein Lokalname ist
-- keine schützenswerte Angabe. Die Grenze zieht das SPALTENRECHT.
create policy "gast liest kopfdaten"
  on public.betriebe
  for select
  to anon
  using (true);

commit;

-- ── DANACH PRÜFEN ────────────────────────────────────────────────
-- Muss eine Zeile liefern:
--
--   begin;
--   set local role anon;
--   select slug, bestell_pause from betriebe where slug = 'chocolamour';
--   rollback;
--
-- Muss scheitern (42501):
--
--   begin;
--   set local role anon;
--   select preis_monat from betriebe limit 1;
--   rollback;
--
-- Und im Browser: den Hub öffnen, Konsole ansehen. Vorher stand dort
-- „[Omoteno] Karte kommt aus dem Quelltext: HTTP 401".
-- Danach muss dort „[Omoteno] Karte geladen" stehen.
