# Übergabe · Was in Supabase und Netlify passieren muss

**An:** eine Claude-Sitzung **mit** Supabase- und Netlify-Konnektor
**Von:** der Sitzung, die am Code arbeitet (Datenbankzugang gesperrt —
gemessen: HTTP 403, `mcp.supabase.com` nicht freigegeben)
**Projekt:** Omoteno · Repo `Liberator28/omoteno` ·
Branch `claude/landingpage-design-integration-r000h9`

---

## Lies das zuerst

Dieses Projekt hat eine `CLAUDE.md` mit rund vierzig Regeln, und jede
steht dort, **weil sie einmal gefehlt hat.** Der Vorfall steht jeweils
dabei. Vier davon betreffen dich hier unmittelbar:

- **§0 · Prüfen schlägt Annehmen.** Ein Ergebnis, das nicht gemessen
  wurde, ist kein Ergebnis, sondern eine Behauptung.
- **§2.1 · `create or replace` ersetzt nur bei identischer Signatur.**
  Sonst entsteht eine **zweite** Funktion daneben, und welche
  PostgREST trifft, hängt davon ab, welche Parameter der Aufrufer
  schickt. Das ist hier schon einmal passiert — gefunden hat es der
  Sicherheitsprüfer, nicht wir.
- **§2.2 · Funktionskörper werden beim Anlegen nicht geprüft.** Eine
  Migration, die `success: true` meldet, sagt **nichts** darüber, ob
  die Funktion läuft.
- **§2.3a · Eine RLS-Regel ist die zweite Linie, nicht die erste.**
  Die Regel entscheidet, **welche Zeilen**; das Tabellenrecht
  entscheidet, **ob überhaupt**. Wer nur die Regel liest, sieht die
  halbe Wahrheit.

**Nichts hier ist dringend genug, um eine dieser Regeln zu
übergehen.** Wenn etwas unklar ist: nachfragen statt raten.

---

## Auftrag 1 · Die Migrationen einspielen (Reihenfolge zählt)

Alle Dateien liegen im Repo unter `datenbank/`.

| # | Datei | Vorbedingung |
|---|---|---|
| 1 | `pruef-bestand.sql` | keine — **reines Lesen**, zuerst |
| 2 | `migration-quelle-lieferung.sql` | keine |
| 3 | `migration-lieferung.sql` | nur wenn 2 durchgelaufen ist |

### Schritt 1 · `pruef-bestand.sql`

Ändert nichts. Beantwortet, welche Funktionen es gibt und in **wie
vielen Fassungen** (§2.1), welche Spalten da sind, welche
CHECK-Bedingungen auf `bestellungen` liegen.

**Ergebnis aller vier Abschnitte in die Antwort kopieren.** Ohne das
raten wir, welche Migration schon drin ist — und die Vermerke „NOCH
NICHT ANGEWENDET" in den Dateiköpfen sind Notizen, keine Messungen.

### Schritt 2 · `migration-quelle-lieferung.sql`

`bestellungen.quelle` trägt eine CHECK-Bedingung, die den neuen Wert
`'lieferung'` **verbietet**:

```
bestellungen_quelle_check:
  CHECK (quelle = ANY (ARRAY['tisch','telefon','reservierung','service']))
```

Diese Liste steht **nirgends im Repo** — es gibt kein
`create table bestellungen`, die Tabelle ist älter als die Dateien,
und die Liste lebt nur im Katalog von Postgres. Kein `grep` hätte sie
gefunden.

Die Datei prüft **zuerst selbst**, dass die Liste noch die gelesene
ist, und bricht sonst ab. Sie ist idempotent: zweimal gefahren sagt
sie „steht bereits" und ändert nichts.

Gegen ein nachgebautes Postgres 16 gemessen, vier Gegenbeweise (alte
Werte bleiben, `'lieferung'` erlaubt, `'unfug'` weiter 23514, falsche
Liste → Abbruch). **Wenn dein Abbruch anders aussieht als oben, nicht
forcieren — melden.**

Danach, aus dem Katalog gelesen statt behauptet:

```sql
select conname, pg_get_constraintdef(oid),
       pg_get_constraintdef(oid) ~ 'lieferung' as lieferung_erlaubt
from pg_constraint
where conrelid = 'public.bestellungen'::regclass and contype = 'c';
```

Erwartet: **genau eine** Zeile `bestellungen_quelle_check`,
`lieferung_erlaubt = true`, und **alle vier alten Werte noch drin**.

### Schritt 3 · `migration-lieferung.sql`

Legt `betriebe.liefer` (jsonb), `bestellungen.liefer_adresse` (jsonb),
`bestellungen.liefergebuehr` (numeric) und `bestellung_liefern()` an.

`bestellung_liefern()` ist eine **Hülle**: Sie prüft Liefergebiet und
Zeitfenster, rechnet die Gebühr aus `betriebe.liefer` **nach** und
ruft dann die vorhandene `bestellung_aufgeben()` auf. Deren Körper
steht nicht im Repo und wurde deshalb **nicht** angefasst — §0.

Am Ende der Datei steht eine Probe in einer zurückgedrehten
Transaktion. **Die bitte fahren** (§2.2): Eine Funktion, die sich
anlegen ließ, kann beim ersten Aufruf umfallen. Der Vorfall dazu:
`gen_random_bytes` aus pgcrypto bei `search_path = public`.

Danach die Signaturprüfung — **das ist §2.1, und sie ist nicht
optional**:

```sql
select p.proname, pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'bestellung_liefern';
```

**Mehr als eine Zeile? Nicht weitermachen — melden.**

---

## Auftrag 2 · Die Leseabfragen beantworten

`datenbank/ABFRAGEN-FUER-DICH.sql` — reines Lesen, vier Abschnitte.
Jeder blockiert gerade konkrete Arbeit:

1. **`ist_master()`** — der Körper. Das ist die Sicherheitsgrenze des
   Master Boards: Woran erkennt es den Betreiber und nicht einen
   Wirt? Ohne das wird „Kunde anlegen" nicht gebaut.
2. **Der Telefonweg** — existiert `bestellung_telefon()`, fehlt
   `betriebe.telefon_nummer`?
3. **Der Lieferstand** — sind die Migrationen aus Auftrag 1 drin?
4. **Indizes und Tabellengrößen** — für den Stresstest mit 60 Gästen.

**Ergebnisse vollständig zurückgeben, auch leere.** „Keine Zeile" ist
eine Antwort; „habe ich nicht gefunden" ist keine.

---

## Auftrag 3 · Netlify

### 3a · Der neue Kunde MINHKEEY (Foodtruck, Asia)

Sobald der Hub im Repo steht (Branch oben, `dist/minhkeey/`), braucht
die Adresse **drei** Dinge. Fehlt eines, kommt die Anfrage gar nicht
erst bei Netlify vorbei oder läuft ins Leere:

| | Wo | Was |
|---|---|---|
| 1 | Domain-Anbieter | `CNAME` für `minhkeey.omoteno.de` → `<projekt>.netlify.app` |
| 2 | Netlify | Domain management → **Add domain alias** |
| 3 | Repo | `auslieferung/_redirects` — die Zeilen stehen schon drin |

**Der Vorfall dazu:** `choco-lamour.omoteno.de` lieferte einmal die
Landingpage statt des Hubs, weil `_redirects` nur die Schreibweise
ohne Bindestrich kannte. Ein zweiter Vorfall: ohne das
**Ausrufezeichen** hinter `200` bedient Netlify zuerst eine
*vorhandene Datei* — und der veröffentlichte Ordner ist flach, dort
liegen `index.html` und `admin.html`. Eine Kundenadresse hätte damit
Omotenos Seiten ausgeliefert.

### 3b · Nachsehen, ob es angekommen ist

```bash
curl -sI https://minhkeey.omoteno.de/           | head -3
curl -s  https://minhkeey.omoteno.de/           | grep -o '<title>[^<]*'
curl -sI https://minhkeey.omoteno.de/admin      | head -3   # → 301 auf omoteno.de
curl -sI https://minhkeey.omoteno.de/liefern    | head -3   # → 301 mit ?modus=liefern
```

Der Titel muss **MINHKEEY** sein. Steht dort ein anderer Hausname, ist
die Regel falsch zugeordnet — und das ist der Fehlerfall, der uns
schon zweimal passiert ist.

### 3c · Ein Deployment auslösen

Der Branch ist gepusht, aber **noch nicht gemerged**. Was auf
`omoteno.de` liegt, ist der alte Stand — daran erkennt man es sofort:
Im Admin Board steht dort unter „Bestellungen" noch ein Kästchen
**„Reservierung"**; im neuen Stand heißt es **„Lieferung"**.

Nach dem Merge nach `main` deployt Netlify von selbst. Prüfen:

```bash
curl -s https://omoteno.de/admin.html | grep -c 'data-quelle="lieferung"'   # 1 = neu
curl -s https://omoteno.de/master.html | head -5                            # neu: muss da sein
```

---

## Auftrag 4 · Die Edge Functions ausrollen

```bash
supabase functions deploy uebersetzen
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

**Ohne `--no-verify-jwt`, und das ist Absicht.** Die Funktion wird aus
dem Admin Board gerufen, wo immer jemand angemeldet ist; Supabase
prüft das Token, bevor eine Zeile Code läuft. Ohne diese Prüfung
könnte jeder Fremde unser Sprach-Guthaben verbrauchen.

`ANTHROPIC_API_KEY` gehört **ausschließlich** in die Secrets. Ein
Schlüssel in einer ausgelieferten Seite ist kein Geheimnis, sondern
eine Rechnung, die jemand anders bezahlt. `pruef-edge.js` im Repo
prüft genau das mit.

Fehlt der Schlüssel, ist das **kein Ausfall**: Die Funktion antwortet
`{fehler:"kein_schluessel"}`, das Board speichert das Gericht trotzdem
und schreibt im Klartext „Der Übersetzer ist noch nicht eingerichtet"
(§7, fail-open).

Danach einmal echt gegen die API laufen lassen — **das ist der Lauf,
den keine Prüfung ersetzen kann.** Ein Gericht mit Namen und
Beschreibung speichern und melden, was im Board steht:

- „Gespeichert und in elf Sprachen übersetzt" → trägt.
- „Gespeichert und übersetzt. Offen: Arabisch." → Teilergebnis, das
  ist der **gewollte** neue Zustand (vorher flogen dabei alle elf raus).
- Irgendein anderer Satz → **bitte wörtlich zurückmelden.**

---

## Was du **nicht** tun sollst

- **Keine RLS-Regel ändern**, außer es steht ausdrücklich in einem
  Auftrag oben. Alte Regeln mit `true`-Bedingung standen hier einmal
  neben den neuen; Postgres verknüpft sie mit **ODER**, und anonymer
  Lesezugriff auf Bestellungen mehrerer Betriebe war live messbar.
- **Den `service_role`-Schlüssel niemals** in eine Datei schreiben,
  die im Browser landet.
- **`search_path` bei `security definer` nicht aufweichen**, auch
  nicht, um eine Abhängigkeit erreichbar zu machen. Das ist genau die
  Tür, gegen die er da ist.
- **Keine Funktion umschreiben, deren Körper du nicht gelesen hast** —
  insbesondere `bestellung_aufgeben`.
- **Kein `force`-Push**, kein Merge nach `main` ohne Rückfrage.

---

## Wie du berichten sollst

Aus `CLAUDE.md` §9, und es gilt hier genauso:

- **Erst der Befund, dann die Lösung.** „Zeile 227 wirft 23514" ist
  mehr wert als „habe es behoben".
- **Gefundene Fehler nennen, auch die eigenen.**
- **Nicht behaupten, was nicht gemessen wurde.** „Migration lief
  durch" und „die Funktion funktioniert" sind zwei verschiedene
  Aussagen (§2.2).
- Jedes Ergebnis **wörtlich**, nicht zusammengefasst. Eine
  Fehlermeldung ist ein Messwert.
