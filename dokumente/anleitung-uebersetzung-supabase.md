# Anleitung für den Chat-Claude mit Supabase-Konnektor

**Was das hier ist.** Diese Umgebung (Claude Code) erreicht Supabase
nicht — `mcp.supabase.com` liefert gemessen 403. Alles, wofür es einen
Datenbankzugang braucht, steht deshalb hier: zum Einfügen in einen Chat
mit Claude, der den Supabase-Konnektor hat.

**Reihenfolge.** Schritt 1 liest nur und ist sofort fahrbar. Schritt 2
und 3 kommen dazu, sobald die Übersetzungen fertig sind; sie schreiben.

---

## Was der Chat-Claude über dieses Projekt wissen muss

Kopiere diesen Abschnitt **immer** mit — er verhindert die Fehler, die in
diesem Projekt schon einmal teuer waren.

> **Harte Regeln. Keine davon ist verhandelbar.**
>
> 1. **Nichts an RLS-Regeln ändern**, wenn es nicht ausdrücklich hier
>    steht. Postgres verknüpft Regeln mit ODER — eine zusätzliche Regel
>    hebt eine strengere still auf.
> 2. **`search_path` bei `security definer` nie aufweichen.** Nicht, um
>    eine Erweiterung erreichbar zu machen, nicht aus Bequemlichkeit.
>    Funktionen aus `pg_catalog` (`gen_random_uuid`, `md5`, `encode`)
>    sind Funktionen aus `extensions` vorzuziehen.
> 3. **Nach jeder Signaturänderung** prüfen, dass es die Funktion nur
>    einmal gibt — `create or replace` ersetzt nur bei **identischer**
>    Signatur und legt sonst eine zweite an:
>    ```sql
>    select p.proname, pg_get_function_identity_arguments(p.oid)
>    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
>    where n.nspname = 'public' and p.proname = '<name>';
>    ```
>    Mehr als eine Zeile? Die alte Fassung mit vollständiger Signatur
>    löschen.
> 4. **Migrationen sind additiv.** `add column if not exists`, keine
>    Spalte löschen, keine Zeile löschen. Was nicht mehr gebraucht wird,
>    bleibt liegen, bis jemand ausdrücklich aufräumt.
> 5. **`success: true` ist kein Beweis.** Funktionskörper werden beim
>    Anlegen nicht geprüft. Jede neue oder geänderte Funktion wird sofort
>    in einer **zurückgedrehten** Transaktion aufgerufen. `raise notice`
>    kommt über MCP nicht an — deshalb der Umweg über eine temporäre
>    Tabelle:
>    ```sql
>    begin;
>    create temp table probe(schritt text, ergebnis text);
>    do $$ begin insert into probe values ('…', '…'); end $$;
>    select * from probe;
>    rollback;
>    ```
> 6. **Der `service_role`-Schlüssel taucht nirgends auf**, was ein
>    Browser lädt. Der `anon`-Schlüssel darf öffentlich sein, der andere
>    niemals.
> 7. **Beim Schreibtest kein `returning`** benutzen — sonst misst man das
>    Leserecht statt des Schreibrechts. Und die **Zeilenzahl** messen
>    (`get diagnostics n = row_count`), nicht die Ausnahme: `0 Zeilen`
>    heißt „RLS hält", ein Erfolg ohne Zeilen heißt gar nichts.
> 8. **Vor jedem `update` auf mehr als eine Zeile**: erst dasselbe als
>    `select` fahren und die Zeilenzahl nennen. Danach fragen, nicht
>    einfach ausführen.

---

## Schritt 1 · Die Karte auslesen  *(liest nur, sofort fahrbar)*

**Aufgabe für den Chat-Claude:**

> Führe die folgende SQL-Datei im Supabase-Projekt aus. Sie liest nur —
> kein `insert`, `update` oder `delete`. Sie besteht aus zwei Abfragen:
> die erste gibt eine Übersichtszeile mit Zahlen, die zweite ein
> einzelnes JSON-Feld.
>
> Gib mir beides vollständig zurück, **das JSON unverkürzt und ohne
> Zusammenfassung**. Kürze nichts weg, auch wenn es lang ist — daraus
> werden Übersetzungen gebaut, und ein weggelassenes Gericht bleibt
> hinterher deutsch.
>
> Wenn eine Spalte nicht existiert, ist das kein Fehler: Die Abfrage
> liest über `to_jsonb(zeile)->>'spalte'` und liefert dann `null`.
> Bricht sie trotzdem ab, gib die vollständige Fehlermeldung zurück,
> statt die Abfrage umzuschreiben.
>
> Der Betrieb steht an **zwei** Stellen als `where b.slug = '…'` —
> beide müssen denselben Wert tragen.

Die Datei: **`datenbank/export-kartentexte.sql`** aus diesem Verzeichnis.

**Was danach passiert:** Du legst das JSON hier im Verzeichnis ab, zum
Beispiel als `dokumente/kartentexte-chocolamour.json`. Damit baue ich

- die Reparatur des **deutschen** Quelltexts, wo er selbst kaputt ist
  (auf der Speisekarte stehen Sätze wie „Karamelli bis zur Kremation und
  Verbrennung" — eine Rückübersetzung aus dem Türkischen, die auch auf
  Deutsch keinen Sinn ergibt), und
- die Übersetzung jedes Textes in die elf Sprachen des Hubs.

---

## Schritt 2 · Die Struktur  *(schreibt)*

**Aufgabe für den Chat-Claude:**

> Führe `datenbank/migration-uebersetzungen.sql` aus diesem Verzeichnis
> im Supabase-Projekt aus, **in einem Rutsch und unverändert**. Sie ist
> additiv: zwei neue Spalten, drei Größenschranken, vier Spaltenrechte.
> Keine Zeile wird geändert, keine Spalte gelöscht, keine RLS-Regel
> angefasst.
>
> Am Ende der Datei steht ein Probenblock in einer Transaktion, die
> sich selbst zurückdreht. Gib mir seine Ausgabetabelle vollständig
> zurück — sechs Zeilen, und jede muss `ok` sagen:
>
> | Schritt | erwartet |
> |---|---|
> | elf Sprachen am Gericht | ok (11) |
> | Schranke am Gericht | ok — abgewiesen |
> | hub_woerter schreibbar | ok |
> | anon liest name_uebersetzungen | ok |
> | anon liest hub_woerter | ok |
> | **anon schreibt NICHT** | ok |
>
> Die letzte ist die wichtigste. Ein Leserecht ohne die Gegenprobe auf
> das Schreibrecht ist die halbe Wahrheit: Die Regel entscheidet,
> **welche** Zeilen — das Recht entscheidet, **ob überhaupt**.
>
> Meldet eine Zeile `FEHL`, führe nichts weiter aus und gib mir die
> Zeile samt Fehlertext zurück.

Was die Migration anlegt:

| | wozu |
|---|---|
| `gerichte.name_uebersetzungen jsonb` | der **Name** eines Gerichts in elf Sprachen. `uebersetzungen` gab es schon, aber nur für die Beschreibung. |
| `betriebe.hub_woerter jsonb` | alles, was kein Gericht ist: Kategorien, freie Texte, Kachelunterzeilen. Form `{ "tr": { "Deutscher Satz": "…" } }`. |

**Danach die Edge Function**, die das Übersetzen tut:

```bash
supabase functions deploy uebersetzen
supabase secrets set ANTHROPIC_API_KEY=<dein Schlüssel>
```

Ohne `--no-verify-jwt` — anders als der Vapi-Webhook wird sie aus dem
Admin-Board gerufen, wo immer jemand angemeldet ist. Supabase prüft das
Token, bevor eine Zeile des Codes läuft; sonst könnte jeder Fremde das
Sprach-Guthaben verbrauchen.

Der Schlüssel steht **ausschließlich** in den Supabase-Secrets. In eine
ausgelieferte Seite gehört er nie — dort ist er kein Geheimnis, sondern
eine Rechnung, die jemand anders bezahlt.

**Prüfen, dass sie läuft** (die Antwort muss elf Sprachen tragen):

```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/uebersetzen" \
  -H "Authorization: Bearer $EIN_ANGEMELDETES_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"texte":["Frisch gebacken, warm serviert"]}' | jq
```

## Schritt 3 · Den kaputten deutschen Quelltext reparieren  *(schreibt)*

Kommt, sobald du mir den Export aus Schritt 1 gegeben hast. Auf der
Karte stehen Sätze, die schon **auf Deutsch** keinen Sinn ergeben —
„Karamelli bis zur Kremation und Verbrennung" ist eine Rückübersetzung
aus dem Türkischen, und eine Zusatzoption heißt „Kopfgeld", weil jemand
„Bounty" übersetzt hat. Solange das in der Datenbank steht, kann keine
Übersetzung der Welt daraus etwas Gutes machen.

Du bekommst dann `UPDATE`s mit `id`, altem und neuem Wert nebeneinander
— damit vor dem Ausführen sichtbar ist, was sich ändert.

## Schritt 4 · Die vorhandene Karte einmal durchübersetzen

Neue und geänderte Gerichte übersetzt das Board von selbst. Die **102
Gerichte, die schon da sind**, hat nie jemand angefasst — für die
braucht es einen einmaligen Durchlauf. Der kommt zusammen mit Schritt 3,
als `hub_woerter`-JSON und als `UPDATE` je Gericht.
