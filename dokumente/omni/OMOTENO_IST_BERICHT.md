# OMOTENO · Ist-Bericht (Phase 0, read-only) · Stand 31.10.2026

> **Methode.** Ausschließlich lesend. Live-Datenbank (Projekt `quxwweuvdqtjsdwgjdrh`) nur über Katalog- und
> Metadatenabfragen (`pg_catalog`, `information_schema`, `pg_policies`, `storage.buckets`, `cron.job`,
> Supabase-Advisor, Edge-Function-Liste und -Quelltext). **Keine** Migration, **kein** Schreibzugriff, **keine**
> Geheimnisse gelesen oder ausgegeben, keine Produktionsinhalte (einzige Ausnahme: gezählt wurden die *Namen* der
> Schlüssel in `bestellungen.positionen`, keine Werte).
>
> **Güte jeder Aussage:** **[L]** live im Katalog gemessen · **[R]** im Repository gelesen · **[U]** ungeprüft
> (Grund steht dabei). Eine Migration im Repo beweist nicht, dass sie live ist — der Abgleich steht in §6.

---

## 1 · Repository-Stand [R]

| | |
|---|---|
| Branch / HEAD | `claude/landingpage-design-integration-r000h9` · `cd9d04e` (Arbeitsbaum sauber, alles gepusht) |
| Struktur | `seiten/` (12 ausgelieferte HTML-Seiten), `vorlagen/hub.vorlage.html` (Gäste-Hub-Vorlage), `markenblaetter/*.json` (5 Häuser), `erzeuger/` (Hub-, Alessia-, Newsletter-Erzeuger, `bauen.js`), `datenbank/` (81 `migration-*.sql`, 32 `pruef-*.sql`), `supabase/functions/` (13 Edge Functions), `pruefungen/` (155 Browser-/Node-Prüfungen, 10 lokale Postgres-Läufe), `auslieferung/` (`_headers`, `_redirects`, Bibliotheken, Schriften), `dokumente/` |
| Build | Netlify, `node erzeuger/bauen.js` (erzeugt `dist/` + `oeffentlich/`, beide in `.gitignore`) |
| CI | **keine** (`.github/workflows` fehlt) — Prüfungen laufen nur von Hand/in Sitzungen |
| Arbeitsregeln | `CLAUDE.md` (Fehlerklassen mit Vorfällen, Prüftabelle je Bereich) |

## 2 · Architektur und Datenflüsse

- **Gäste-Hub** [R]: eine erzeugte HTML-Datei je Betrieb (`/h/<slug>/`), liest mit dem `anon`-Schlüssel nur freigegebene
  Spalten (`betriebe` Spaltenrecht, `gerichte` mit `verfuegbar=true`, laufende `aktionen`) und bestellt **nur über RPC**
  (`bestellung_aufgeben`, `_liefern`, `_abholen`), die Preise serverseitig nachrechnen (`positionen_pruefen`) [L].
- **Board** `seiten/admin.html`, **Küche** `kueche.html`, **Einkauf** `einkauf.html`, **Konto** `konto.html`, **Master**
  `master.html` [R] — Supabase Auth (E-Mail/Passwort, optional Google) + **PIN als zweiter Faktor**: `meine_betriebe()`
  liefert einen Betrieb mit `pin_pflicht` nur bei gültiger PIN-Sitzung (`pin_ok()`) [L].
- **Edge Functions** (13, alle aktiv) [L]: `uebersetzen` v9, `beleg-lesen` v3, `gericht-bild` v3, `team-zugang` v4,
  `master-zugang` v1, `newsletter-*` (2), `klaviyo-*` (2), `alessia-bestellung` v1, `swift-processor` (= `melden`) v6,
  `zahlung-starten` v1, `stripe-webhook` v1. **Ohne JWT-Prüfung:** `swift-processor`, `klaviyo-profil-melden`,
  `klaviyo-ereignis-melden`, `alessia-bestellung`, `zahlung-starten`, `stripe-webhook`.
- **Storage** [L]: `belege` privat (JPEG/PDF, 10 MB), `anfragen` privat, `gerichte` öffentlich (Bilder), `schriften`
  öffentlich (Schriftdateien).
- **Cron** [L]: 4 Jobs (siehe §5 S1).

## 3 · Tatsächlich vorhandene Funktionen (live belegt, sofern nicht anders vermerkt)

| Bereich | Live-Objekte [L] | Datenmenge live [L] |
|---|---|---|
| Bestellungen (Tisch, Telefon/Alessia, Lieferung, Abholung, Serviceruf), Storno, Restzeit, Quarantäne (`pruefen`) | `bestellungen` (34 Spalten, `positionen` als JSONB), RPCs `bestellung_*`, Trigger Bremse/Verteilen/Push/Klaviyo | 73 Bestellungen |
| Gerichte, Karten, Extras, Allergene, Altersfreigabe, Aktionen, Rabattcodes, Gutscheine | `gerichte`, `aktionen`, `rabattcodes`, `gutscheine`, Wache-Trigger | 119 Gerichte |
| Saalplan, Tische, Tischsitzung | `tische` (nur Lage-Spalten änderbar, Inhaber), `tisch_sitzungen`, `saal_einstellungen` | 20 Tische |
| Mandanten | `organisationen` (4), `betriebe` (4, jeder mit eigener Organisation), `organisation_mitglieder` (Rolle nur `zentrale`, 0 Zeilen), `betrieb_mitglieder` (3) | — |
| Einkauf E1–E5 | `lieferanten`, `artikel` (org-weit), `artikel_standort`, `lieferanten_artikel`, `einkaufsbelege`, `einkaufspositionen`, `beleg_speichern/freigeben/stornieren/verwerfen/verschieben`, Duplikat über `datei_hash` und Lieferant+Belegnummer | **0 Belege, 0 Artikel** — live nie mit echten Daten benutzt |
| Lager | `lagerbewegungen` (Arten: eingang, storno, inventur, verlust, transfer_aus/ein, korrektur), Sicht `lagerbestand`, `verlust_buchen`, `inventur_buchen`, `inventur_entwurf`, `umlagerung_*` | 0 Bewegungen |
| Rezepturen/Kalkulation | `rezepturen` (versioniert über `gueltig_ab`), `rezepturpositionen` (Menge, `verlust_prozent`), `rezeptur_speichern`, `gericht_kalkulation`/`wareneinsatz_theoretisch` [R] | 0 Rezepturen |
| Buchungsperioden | `einkauf_perioden.geschlossen`, `periode_oeffnen/_schliessen`, `periode_zu()` wird in Freigabe/Storno geprüft | — |
| Audit | `protokoll` (Trigger auf betriebe, gerichte, aktionen, gutscheine, rabattcodes, zahlungen, einkaufsbelege, …), `rechte_protokoll`, Einkaufs-Protokoll-Trigger | 122 Einträge |
| Rechte | Rollen `inhaber/manager/team/kueche`, `rechte` JSONB mit 7 Katalogrechten, `darf_lager`, `darf_gutscheine` | — |
| KI | `ki_nutzung`, `ki_budget`, `ki_preise`, `ki_kontingent`; Edge `uebersetzen`, `beleg-lesen`, `gericht-bild` | — |
| Zahlung (Stripe) | `zahlungen`, `betrieb_zahlarten`, `zahlung_ereignisse` | **0 / 0 / 0** — ausgeliefert AUS [R], DB-Wege aber live |

## 4 · Rollen- und Rechtemodell (live) [L]

- **Rolle je Betrieb** (`betrieb_mitglieder.rolle`): `inhaber`, `manager`, `team`, `kueche` (CHECK).
- **Rechte nur für Manager konfigurierbar** (`rechte_wirksam`): `kennzahlen_tag` (Standard an), `berichte_view`,
  `berichte_export`, `kosten_view`, `finanz_export` (nur mit `kosten_view`), `ziele_edit`, `ziele_approve`.
  Inhaber hat alle, Team und Küche keins. `durchsetzung`: `kosten_view`, `finanz_export`, `ziele_*` = Datenbank;
  `kennzahlen_tag`, `berichte_*` = **nur Anzeige**.
- **Zusätzliche Schalter je Mitglied:** `darf_lager` (Lager buchen/lesen), `darf_gutscheine` mit Grenzen.
- **Master** (`ist_master()`) ist in `ist_inhaber()` enthalten: Master handelt überall als Inhaber.
- **Standortbezug:** Rechte hängen am Betrieb (= Standort). Organisationsweit lesen alle Mitglieder **aller**
  Betriebe einer Organisation `artikel` und `lieferanten` (`meine_organisationen()` aus den eigenen Betrieben).

## 5 · Bestätigte Sicherheits- und Integritätsbefunde

| Nr | Befund | Schwere | Beleg |
|---|---|---|---|
| **S1** | **Live-Cron löscht jede Nacht alle Bestellungen älter als 30 Tage** (`delete from bestellungen where zeitpunkt < now() - interval '30 days'`, 03:30). Die Lösch-Kaskade nimmt **Zahlungen**, Notizen und Push-Einträge mit; Rabattcodes verlieren den Bezug. Der Job steht **nirgends im Repository**; die im Projekt entschiedene Frist ist 90 Tage (`recht/11` C), `migration-loeschfristen.sql` ist Entwurf, `recht/01` behauptet „keine Migration plant eine Löschung“. Für Omni (Lagerabgang, Rückgaben, Controlling, Liquidität) ist eine 30-Tage-Hardlöschung unvereinbar. Zwei weitere Jobs löschen `ereignisse` doppelt (gleicher Befehl, 03:30 und 03:35). | **HOCH** (Datenverlust, Repo↔Live) | [L] `cron.job`, FK `confdeltype='c'` |
| **S2** | **[ERLEDIGT 31.10.: `swift-processor` v7 = Repo-Stand, Quelle nachgelesen, Probeaufruf 400 „keine id“; alle 5 Geräte live auf `web.push.apple.com` bestehen die Liste]** **SSRF-Härtung von `melden` nicht live.** Live `swift-processor` v6 (26.09.) schickt Web-Push an jeden Endpunkt aus `push_geraete`; die Repo-Fassung (19.10.) erlaubt nur https zu den Push-Diensten der Browser. `push_geraete` darf jedes Teammitglied selbst schreiben. Ausnutzung **nicht getestet**. Die frühere Fälschungslücke (Text aus der Anfrage) ist dagegen **live geschlossen** (Funktion liest nur die id). | **MITTEL** | [L] Quelltext live, [R] `git show bf618d4` |
| **S3** | **[ERLEDIGT 31.10.: `zahlung-starten`/`stripe-webhook` v2 mit Sperre, Probeaufruf antwortet „abgeschaltet“ (damit auch belegt: `ZAHLUNG_AN` ist nicht gesetzt); EXECUTE der vier Funktionen für anon UND authenticated entzogen (`datenbank/migration-zahlung-aus-live.sql`), Advisor nachgelesen]** **Online-Zahlung live nicht abgeschaltet.** `zahlung-starten`/`stripe-webhook` v1 (19.10.) ohne die `ZAHLUNG_AN`-Sperre aus dem Repo (26.10.), beide ohne JWT; `anon` darf `bestellung_aufgeben_zahlung`, `bestellung_liefern_zahlung`, `zahlarten_oeffentlich`, `zahlung_status` ausführen. Da `betrieb_zahlarten` leer ist, bietet live kein Betrieb Zahlung an. Ob Stripe-Geheimnisse gesetzt sind und was ein direkter Aufruf bewirkt: **[U]** (nicht ohne Schreibzugriff/Geheimnisse prüfbar). | **MITTEL** | [L] Edge-Liste, Advisor |
| **S4** | **Zu weite Tabellenrechte (Tiefenverteidigung, CLAUDE.md §2.3f):** `authenticated` hat auf `gerichte`, `aktionen`, `anfragen`, `reservierungen`, `push_geraete`, `master_umsaetze` **alle** Rechte inkl. `TRUNCATE`, `TRIGGER`, `REFERENCES`. `TRUNCATE` umgeht RLS; PostgREST bietet ihn nicht an, eine künftige `security invoker`-Funktion könnte ihn erreichen. Heute hält die RLS für INSERT/UPDATE/DELETE (Regeln je Betrieb bzw. Master). | **MITTEL** | [L] `has_table_privilege` |
| **S5** | **Küche/Lager sehen Geldwerte:** Lese-Regeln von `lagerbewegungen` (`wert_netto`) und `inventuren` (`differenz_wert`) lassen neben `kosten_view` jedes Mitglied mit `darf_lager` zu — auch Rolle `kueche`. Widerspricht dem Soll („keine finanzielle Bewertung von Lagerbeständen für die Küche“). Die Sicht `lagerbestand` summiert `wert_netto` mit. | **MITTEL** | [L] `pg_policies` |
| **S6** | Unbekannte Werte werden zu 0: `lagerbestand` rechnet `sum(coalesce(wert_netto,0))`. | **MITTEL (Integrität)** | [L] Sichtdefinition |
| **S7** | `lieferanten.kundennummer`/`kontakt` für alle Mitglieder aller Betriebe der Organisation lesbar (inkl. Küche). | NIEDRIG | [L] |
| **S8** | **[OFFEN 31.10.: kein Werkzeugweg — Schalter im Supabase-Dashboard, Advisor weiter WARN]** Auth: Schutz gegen bekannte geleakte Passwörter ist aus. | NIEDRIG | [L] Advisor |
| **S9** | Einkaufsfreigabe prüft Netto-Summe (±0,02), **nicht** Steuer- und Bruttosumme; `beleg_stornieren` setzt `lieferanten_artikel.letzter_preis` nicht zurück. | NIEDRIG (Integrität) | [L] Funktionsdefinition |
| **S10** | `gericht_id` in Bestellpositionen wird serverseitig über den **Namen** gesucht (`g.name = basis`, erstes nach id); 43 von 73 Positionen tragen keine `gericht_id` (vor Einführung). | MITTEL für Omni (Lagerabgang) | [L] `positionen_pruefen`, Schlüsselzählung |

**Positiv belegt [L]:** RLS auf allen 60 Tabellen; alle `security definer`-Funktionen mit festem `search_path`; alle
3 Sichten `security_invoker`; `bestellungen` für `authenticated` nur `SELECT` + `UPDATE` auf 9 Zustandsspalten (Summe,
Positionen, Betrieb gesperrt); `betriebe` Spaltenrechte für `anon` und `authenticated`; Einkaufstabellen lesen nur mit
`kosten_view` über `betriebe_mit_recht()` (Menge vorab, kein Funktionsaufruf je Zeile); Einkaufspreise
(`lieferanten_artikel.letzter_preis`) per Spaltenrecht unlesbar; Belege privat, Lesen nur mit `kosten_view`;
Belegfreigabe mit Zeilensperre, Perioden-, Duplikat- und Summenprüfung, Storno als Gegenbuchung; Tisch-Schlüssel nicht
durch Team änderbar (`tische` ALL-Regel `false`); 23 `anon`-RPCs (Advisor) — dass jede davon gebremst oder begründet
ist, prüft `pruef-sicherheit.js` gegen `datenbank/stand-anon-funktionen.sql` [R], live nicht erneut gegengerechnet [U].

## 6 · Abweichungen Repository ↔ Live

| Objekt | Repository | Live [L] |
|---|---|---|
| Lösch-Cron `bestellungen` 30 Tage, `ereignisse` 30 Tage (doppelt) | fehlt | **aktiv** |
| `migration-loeschfristen.sql` (90 Tage u. a.) | Entwurf, Schalter `LOESCHFRISTEN_LIVE=false` | nicht eingespielt |
| `migration-gericht-fertig.sql` (`gericht_fertig_setzen`) | vorhanden, Code nutzt sie | **fehlt** (Küche fällt laut Code auf den alten Weg zurück [R]) |
| `migration-saal-raeume.sql` (Räume in Metern) | vorhanden | **fehlt** (`saal_einstellungen_setzen` ohne `raeume`) |
| `migration-vertraege.sql` (`vertrag_akzeptieren`) | Entwurf, `VERTRAEGE_AN` aus | fehlt (gewollt bis Anwaltsprüfung) |
| `migration-bild-ki-marke.sql` (`gerichte.bild_ki`) | Entwurf | fehlt (Hub zeigt ohne Spalte keine Marke) |
| Edge `melden` | 19.10. (SSRF-Positivliste) | 26.09. — **älter** |
| Edge `zahlung-starten`, `stripe-webhook` | 26.10. (`ZAHLUNG_AN`-Sperre) | 19.10. — **älter** |
| Migrationsverlauf | 81 Dateien, Namen frei | 150 Einträge (`list_migrations`), Namen 1:1 nicht abbildbar — Abgleich erfolgte über Objekte, nicht über Namen |

Übrige Edge Functions: Live-Stand ist gleich alt oder jünger als der letzte Repo-Commit [L/R]; Quelltextgleichheit
nur für `melden` geprüft [U für die übrigen].

## 7 · Lücken zwischen Ist und Soll (Auftrag §§ 4–9)

| Soll | Ist | Lücke |
|---|---|---|
| Küche nur operativ | Rolle `kueche` ohne Katalogrechte ✓; aber `darf_lager` öffnet Geldwerte (S5) | Wertspalten trennen |
| Manager-Rechte je Person **und Standort** | je Betrieb ✓ (7 Rechte) | Einkauf/Lager/Freigabe als eigene Rechte fehlen |
| Freigabegrenzen je Manager/Standort, Selbstfreigabe im Limit, Protokoll | `beleg_freigeben` **nur Inhaber**, keine Grenzen | Neues Recht + Limit-Tabelle + Protokoll |
| Bestellung beim Lieferanten → Lieferung (Teillieferung) → Rechnung → Zahlung (Teilzahlung, Skonto) | ein Beleg = Rechnung = Lagerzugang; keine Bestellung, Lieferung, Fälligkeit, Zahlung | Vier Vorgänge fehlen bis auf die Rechnung |
| Steuer/Summen/Toleranzen | Netto ±0,02 | Steuer, Brutto, konfigurierbare Toleranz |
| KI nur Vorschlag | `beleg-lesen` legt Entwurf an, Freigabe nur durch Mensch ✓ [R/L] | — |
| Artikelstamm je Organisation, Bestand je Standort, Preis je Standort/Lieferant | ✓ Stamm org-weit, Bestand/Preis je Betrieb über Belege | Manueller Kalkulationspreis, Übertragung auf Standorte, Historie manueller Preise, gewichteter Durchschnitt (heute letzter Preis je Position) |
| Lagerabgang aus abgeschlossener Bestellung mit Rezeptversion, idempotent, negativ erlaubt, Fehlmengenprotokoll | **existiert nicht** (keine Bewegungsart `verbrauch`); `gericht_id` über Namen; Bestellungen werden nach 30 Tagen gelöscht (S1) | Fundament fehlt: stabile ID, Archiv statt Löschen, Verbrauchsbuchung |
| Storno/Rückgabe als Gegenbuchung | für Einkaufsbelege ✓; für Bestellungen kein Lagerbezug | mit Verbrauchsbuchung mitbauen |
| Inventur fortsetzen, Grund, zweite Freigabe ab Schwelle | Entwurf + Buchung ✓ [L], Grund/Schwelle/Zweitfreigabe [U]/fehlt | Schwellen + Zweitfreigabe |
| Verderb/Schwund/Bruch getrennt, MHD optional | `verlust` mit Notiz; keine Unterarten; kein MHD | Unterarten, optionales MHD |
| Rezepturen: Halbfertig, Einheiten, Ausbeute, Varianten, Versionen | Versionen ✓, Verlust % ✓; Positionen nur `artikel_id` | Halbfertigprodukte, Varianten |
| Controlling mit Formel/Qualitätsstatus, Liquidität ohne Scheinbank | Auswertung im Board (Anzeige) [R]; keine Liquidität | Kennzahlen-Katalog, Qualitätsstatus, Zahlungsverpflichtungen |
| Audit mit Org/Standort/Transaktion/Grund | `protokoll` je Betrieb mit vorher/nachher ✓; keine Organisation, keine Transaktions-ID, Grund nur teils | Felder ergänzen |

## 8 · Ungeprüft (mit Grund)

- Ob die Stripe-, VAPID-, Anthropic-, fal-, Klaviyo-, Vapi-Geheimnisse gesetzt sind — Katalog zeigt es nicht, Geheimnisse
  werden nicht gelesen.
- Wirkung von S2/S3 bei echtem Aufruf — nur mit Schreibzugriff/externen Diensten prüfbar, bewusst nicht ausgeführt.
- Quelltextgleichheit der übrigen 10 Edge Functions mit dem Repo.
- Sicherungen/PITR, Auth-Einstellungen außer Passwortschutz (Site URL, Mailversand), Netlify-Projekteinstellungen.
- Ob die Proben aus `datenbank/pruef-rechte.sql` und `pruef-missbrauch.sql` live grün sind — die Dateien drehen sich
  selbst zurück, schreiben aber innerhalb ihrer Transaktion; nach Auftrag §2 Nr. 2/3 nicht ausgeführt.
- Inhaltliche Logik von `inventur_buchen`, `verlust_buchen`, `umlagerung_*`, `rezeptur_*` (nur Existenz und Rechte gelesen).

## 9 · Wiederverwendbar (nicht neu erfinden)

`betriebe_mit_recht()` / `hat_recht()` / `rechte_katalog()` (Rechtekern, schnell durch Mengenbildung) · `periode_zu()` ·
Muster von `beleg_freigeben` (Sperre, Gründe als JSON statt Ausnahme, Gegenbuchung) · `protokoll_schreiben`/`protokoll_einkauf`
Trigger · `positionen_pruefen` (Preisrechnung) · `lagerbewegungen` als Bewegungsjournal · Wache-Trigger
(`gericht_rolle_wache`, `betrieb_rolle_wache`, `mitglied_rechte_wache`) · lokale Postgres-Prüfläufe
(`pruefungen/*-lokal.sh`) als sichere Testumgebung · Prüfmuster aus CLAUDE.md §2.3b (Zeilenzahl statt Ausnahme).
