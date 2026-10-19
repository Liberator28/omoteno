-- EINGESPIELT am 19.10.2026 (apply_migration „grant_engen_schreibrechte_ohne_weg“).
-- §2.3f: authenticated behält auf diesen Tabellen nur, was ein Browser-Weg oder
-- eine RLS-Regel wirklich nutzt. Vorher geprüft: kein Schreibweg in seiten/*.html,
-- vorlagen/*.html, Edge Functions (auch nicht über Zeilenumbruch); keine
-- Nicht-security-definer-Funktion schreibt dort. Rückgängig: grant … to authenticated.
revoke insert, update, delete, truncate, references, trigger on public.rechnungen from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.gaeste from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.tisch_sitzungen from authenticated;
revoke insert, delete, truncate, references, trigger on public.betriebe from authenticated;
revoke insert, delete, truncate, references, trigger on public.bestellungen from authenticated;
revoke insert, delete, truncate, references, trigger on public.ereignisse from authenticated;
revoke insert, delete, truncate, references, trigger on public.servicerufe from authenticated;
-- Bewusst NICHT gekürzt (Browser schreibt dort wirklich oder Regel erlaubt es):
-- aktionen, gerichte, reservierungen, tische, push_geraete, anfragen, master_umsaetze,
-- artikel, lieferanten, lieferanten_artikel, bild_auftraege — je Schreibweg einzeln zu prüfen.
