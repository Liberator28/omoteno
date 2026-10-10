---
name: omoteno-arbeitsweise
description: Arbeitsregeln für Omoteno, hergeleitet aus tatsächlich gemachten Fehlern.
---

# Arbeitsweise in diesem Verzeichnis

**Vor jeder Änderung lesen. Vor jeder Übergabe prüfen.**

```bash
node erzeuger/erzeuge-hub.js --alle --pruefen-nur   # Markenblätter
node erzeuger/erzeuge-hub.js --alle                 # erzeugen
python3 pruefungen/pruef-datei.py dist/<slug>/index.html
node pruefungen/pruef-ueberlauf.js dist/<slug>/index.html
```

**Wo was liegt.** Verschoben werden Quellen, nie die Ausgabe:

```
seiten/          was ausgeliefert wird (admin, konto, kueche, web, …)
vorlagen/        hub.vorlage.html
markenblaetter/  <slug>.json
erzeuger/        erzeuge-hub.js, bauen.js
pruefungen/      alle pruef-*
auslieferung/    _headers, _redirects
datenbank/       migration-*.sql
dokumente/       alles Übrige an .md
```

In der Wurzel bleiben nur `README.md`, `CLAUDE.md`, `.gitignore` und
`netlify.toml` — letztere, weil Netlify sie NUR dort liest. Der
veröffentlichte Ordner bleibt flach (`index.html`, `admin.html`,
`h/<slug>/`); die Seiten verlinken sich absolut, `_redirects` hängt
daran.

**Hub-Dateien in `dist/` werden NIE bearbeitet.** Wer dort etwas
ändert, verliert es beim nächsten Erzeugen. Änderungen gehen entweder
in `vorlagen/hub.vorlage.html` (gilt für alle Kunden) oder in
`markenblaetter/<slug>.json` (gilt für einen).

Jede Regel hier steht, weil sie einmal gefehlt hat. Der Vorfall steht
dabei — ohne ihn ist eine Regel nur eine Meinung, die man wegdiskutiert.

---

## 0 · Die Grundregel

**Prüfen schlägt Annehmen. Immer.**

Von allen Fehlern unten hat kein einziger daran gelegen, dass etwas zu
schwer war. Jeder lag daran, dass etwas angenommen statt nachgesehen
wurde — obwohl Nachsehen dreißig Sekunden gedauert hätte.

Die zweite Hälfte davon: **Ein Ergebnis, das nicht geprüft wurde, ist
kein Ergebnis, sondern eine Behauptung.** Wer sagt „behoben", ohne es
gemessen zu haben, hat nur die Arbeit auf den Nutzer verschoben.

---

## 1 · Vor dem Schreiben lesen

### 1.1 Nie einen Namen vergeben, ohne zu prüfen, ob es ihn gibt

> **Vorfall.** Der neue Landingpage-Abschnitt bekam
> `class="tafel marke"`. `.marke` existierte längst — die Wortmarke im
> Kopf, und sie steht in derselben Regel wie `h1, h2, h3`. Der ganze
> Abschnitt erbte damit die Schlagzeilenschrift. Der Nutzer sah es
> sofort, ich vorher nicht.

Vor jeder neuen Klasse, ID, Variablen- oder Funktionsbezeichnung:

```bash
grep -n 'marke' datei.html | head        # Klasse schon da?
grep -c 'class="[^"]*\bmarke\b' datei.html
```

Gilt genauso für CSS-Variablen, `id`-Attribute und globale
JS-Bezeichner. Zwei `<script>`-Blöcke teilen sich den globalen
Namensraum — zwei `const` mit demselben Namen werfen einen Fehler und
die halbe Seite bleibt tot.

**Bei einem geteilten Block in BEIDEN Dateien nachsehen.**

> **Vorfall.** Die fünf Blätter der Erdbeerkrone hießen `.blatt`. Im
> Marken-Studio heißt das Einstellblatt auch `.blatt`, und dessen Regel
> setzt `transform:translateY(92dvh − var(--sicht))`. SVG erbt
> CSS-`transform` genauso wie HTML. Gemessen bei 900×1000: Die Krone
> stand 824 Einheiten tiefer und 672 links, die Zeichnung ragte von
> x −672,5 bis 793,7 statt 1…120,6 — die Erdbeere hatte im Studio keine
> Krone. Derselbe Block, dieselbe Zeile, im Hub völlig in Ordnung.
>
> Zwei Zeilen tiefer dasselbe mit `.guss`: Im Gerüst ist das der
> Schokoladenguss unter dem Kopfband, eine Fläche mit `drop-shadow`.
> Die Glasur auf dem Kuchen, den die Figur trägt, bekam denselben
> Schatten — gemessen `drop-shadow(rgba(42,26,20,.2) 0 3px 6px)`, wo
> `none` stehen sollte.

Ein Blick in die eigene Datei findet das nicht. Wer einen geteilten
Block anfasst, `grep`t den Namen in **jeder** Datei, in die er kopiert
wird. `pruef-figur.js` tut das jetzt für alle 41 Klassen des Blocks.

**Auch in einer zusammengesetzten Klasse steckt jedes Wort einzeln im
selben Namensraum.**

> **Vorfall.** Ein neuer Platzhaltertext im Kategorie-Feld des
> Admin-Boards bekam `class="auswahlwert leer"`. Gesucht hatte ich nur
> nach der zusammengesetzten Form `auswahlwert.leer` — die gab es
> nicht. Ein einzelnes `.leer` gab es längst: die große leere-Karte
> („Diese Karte ist noch leer"), `padding:52px 20px;text-align:center`.
> Ein Element trägt seine Klassen als **Menge**, nicht als ein Wort —
> jede passende Regel greift, auch eine, die nur eine der beiden
> Klassen kennt. Aus einer 22px hohen Zeile wurde eine 126px hohe
> Fläche. Sichtbar im Bildschirmfoto als beinahe quadratischer statt
> schmaler Knopf; gefunden nicht durch Ansehen, sondern durch einen
> Diff aus `getComputedStyle` mit und ohne die Klasse.

**Auch ein Element-Name ist ein Name.** Die neue Einstellungs-Übersicht
war ein `<nav>` — und `nav{display:flex;overflow-x:auto}` ist im Board
die Reiterleiste. Elf Zeilen standen als eine waagerechte Reihe da.
Vor jedem neuen Element-Typ: `grep -n '^nav{\|[ ,]nav{' datei.html`.

`grep -c 'class="[^"]*\bmarke\b'` prüft die zusammengesetzte Form. Für
jedes **einzelne** Wort einer neuen Mehrfachklasse zählt zusätzlich:

```bash
grep -n '^\.leer{' datei.html      # steht das Wort schon ALLEIN da?
```

### 1.1a Ein vorhandenes Feld heißt nicht, dass es das eigene ist

> **Vorfall.** Das Gastkonto sollte an `bestellungen.gast_kennung`
> hängen — das Feld war da, der Name passte, der Plan nannte es „den
> Anker". Nachgesehen: Es ist die **Quittungsnummer einer einzelnen
> Bestellung**, liegt unter einem UNIQUE-Index, und
> `bestellung_aufgeben` gibt bei bekannter Nummer die vorhandene `id`
> zurück, statt neu anzulegen. Eine Gerätekennung dort hätte geheißen:
> Ab der **zweiten** Bestellung desselben Gastes verschwindet jede
> weitere. Der Gast sieht seinen alten Bestellpass, die Küche sieht
> nichts. Im Test mit einer Bestellung unsichtbar.

Ein passender Name ist kein Beweis. Vor der Übernahme eines
vorhandenen Feldes: **wer schreibt hinein, wer liest daraus, welcher
Index liegt darauf.**

```bash
grep -n '<feld>' *.html
```
```sql
select indexdef from pg_indexes where tablename='<tabelle>';
select pg_get_functiondef(oid) from pg_proc where proname='<funktion>';
```

Und der Test dazu muss den **zweiten** Durchgang enthalten. Beim ersten
sieht jede Verwechslung dieser Art richtig aus.

### 1.2 Erst den Bestand ansehen, dann den Plan schreiben

> **Vorfall, viermal.** Der Umsetzungsplan schlug vor: eine neue Spalte
> `allergene_liste text[]` (die Daten waren längst sauber), eine
> Migration für `tagesnummer` (Spalte, Index und Leseweg existierten,
> nur das Schreiben fehlte), eine harte Sperre für Tischsitzungen (die
> falsche Risikoabwägung), einen animierten Bestellpass (war fertig
> gebaut, nur nicht verdrahtet).

Der Plan entstand aus der Dateiliste statt aus dem Code. Reihenfolge
ist umgekehrt: **erst `list_tables`, `pg_get_functiondef`, `grep`, dann
der Plan.** Ein Plan, der die halbe Arbeit doppelt vorschlägt, kostet
mehr Vertrauen, als er Zeit spart.

### 1.3 Die Datei schlägt die Erinnerung

> **Vorfall.** Ich verwies auf einen „Tische / Codes & Druck"-Bereich im
> Admin-Board. `grep` fand ihn nicht — er existierte in dieser Datei
> nicht.

Erinnerungen an frühere Sitzungen sind Hinweise, keine Tatsachen. Vor
jeder Aussage über den Bestand: nachsehen.

### 1.4 Wissen, welche Fassung man bearbeitet

> **Vorfall.** Die Arbeitsdatei des Studios hatte 1474 Zeilen, die
> ausgelieferte 1164. Der Nutzer sah einen anderen Stand als ich.

Bei Unstimmigkeit: `wc -l` auf beide, Unterschied benennen, **nicht
darüber hinweggehen.**

---

## 2 · Datenbank

### 2.1 `create or replace` ersetzt nur bei identischer Signatur

> **Vorfall, der teuer hätte werden können.** `bestellung_aufgeben`
> bekam `p_sitzung` dazu. Postgres hat nicht ersetzt, sondern eine
> **zweite** Funktion angelegt. Zwei Fassungen nebeneinander — eine mit
> Sitzungsprüfung, eine ohne. Welche PostgREST wählt, hängt davon ab,
> welche Parameter der Aufrufer schickt. Ein alter zwischengespeicherter
> Hub hätte still die ungeprüfte getroffen. Gefunden hat es der
> Sicherheitsprüfer, nicht ich.

Nach **jeder** Signaturänderung:

```sql
select p.proname, pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='<name>';
```

Mehr als eine Zeile? Alte Fassung mit vollständiger Signatur löschen.
Danach prüfen, dass der alte Aufruf mit weniger Parametern noch trägt —
PostgREST ruft über Namen auf, Vorgabewerte fangen das ab.

### 2.2 Funktionskörper werden nicht beim Anlegen geprüft

> **Vorfall.** `tisch_sitzung_start` benutzte `gen_random_bytes` aus
> pgcrypto. Die Funktion setzt `search_path` auf `public`, pgcrypto
> liegt in `extensions`. Das Anlegen ging durch, der Fehler kam erst
> beim ersten Aufruf.

Eine Migration, die `success: true` meldet, sagt **nichts** darüber, ob
die Funktion läuft. Jede neue oder geänderte Funktion wird sofort in
einer zurückgedrehten Transaktion aufgerufen:

```sql
begin;
create temp table probe(schritt text, ergebnis text);
do $$ … insert into probe values (…) … $$;
select * from probe;
rollback;
```

`raise notice` erscheint über MCP **nicht** — deshalb der Umweg über
eine temporäre Tabelle.

Bevorzugt Funktionen aus `pg_catalog` (`gen_random_uuid`, `md5`,
`encode`) statt aus Erweiterungen. Und den `search_path` bei
`security definer` **nie** aufweichen, nur um eine Abhängigkeit
erreichbar zu machen — das ist genau die Tür, gegen die er da ist.

### 2.3 Alte Berechtigungen überleben neue Regeln

> **Vorfall aus früherer Sitzung.** Alte RLS-Regeln mit
> `true`-Bedingung standen neben den neuen. Postgres verknüpft Regeln
> mit ODER — die neuen waren Zierrat. Anonymer Lesezugriff auf
> Bestellungen mehrerer Betriebe war live messbar.

Nie nur die Richtigkeit einer Regel prüfen, immer auch die
**Anhäufung**. Regelbestand auflisten, nicht nur die neue ansehen.

### 2.3a Eine RLS-Regel ist die zweite Linie, nicht die erste

> **Vorfall.** Der `anon`-Schlüssel steht in jedem Hub — richtig so.
> Er trug aber `INSERT` auf `bestellungen`. Der Hub bestellt längst
> über `bestellung_aufgeben`, und die Funktion rechnet den Preis aus
> der Karte **nach**, prüft Vertragszustand, Bestellpause,
> Tischpflicht und Tischschlüssel. Der direkte Weg in die Tabelle
> prüfte per RLS nur vier Dinge — und den Preis nicht. Gemessen:
> **99 Stück für 1 Cent gingen durch**, samt gefälschtem
> `tisch_bestaetigt=true`. Daneben stand die Sicht
> `betriebe_oeffentlich` mit `security_invoker=false`; ein anonymes
> `update` darauf änderte **alle** Betriebe auf einmal.

Ein Wächter neben einer offenen Tür ist kein Wächter. Vor jeder
Behauptung „das ist abgesichert": **beide** Ebenen ansehen.

```sql
-- Was darf die Rolle ueberhaupt anfassen?
select c.relname,
       has_table_privilege('anon',c.oid,'SELECT') as lesen,
       has_table_privilege('anon',c.oid,'INSERT') as schreiben,
       has_table_privilege('anon',c.oid,'UPDATE') as aendern
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v');
```

Die Regel entscheidet, **welche Zeilen**. Das Recht entscheidet, **ob
überhaupt**. Wer nur die Regel liest, sieht die halbe Wahrheit. Und
eine Sicht mit `security_invoker=false` umgeht die Regel vollständig —
sie läuft mit den Rechten ihres Eigentümers.

Dazu: PostgREST stellt **jede** Funktion in `public` als
`/rest/v1/rpc/<name>` bereit, sobald die Rolle `EXECUTE` hat —
Trigger-Funktionen eingeschlossen. Ein Trigger braucht dieses Recht
nicht; er läuft als Teil der Anweisung.

> **Vorfall, dieselbe Tür im Hub.** `hub_kacheln` schreibt das Team,
> der Hub las `raster`, `stil` und `farbe` daraus ungeprüft und setzte
> sie roh in `class=` und `data-farbe=`. Ein Anführungszeichen im Wert
> hätte ein eigenes Attribut aufgemacht — `onclick` an einer Kachel,
> die jeder Gast antippt. Gegenbeweis mit der Positivliste entfernt:
> `onclick` stand an der Kachel.

Was aus einer Live-Spalte in ein Attribut geht, läuft über eine feste
Liste oder `hs()` — auch wenn nur das eigene Team schreiben darf. Ein
gestohlenes Konto ist dann ein Konto, kein Zugang zu jedem Gast.

### 2.3b Zwei Messfehler, die Löcher verstecken und erfinden

> **Vorfall, beide in derselben Sitzung.** Der erste Angriffstest
> schrieb `insert … returning id` und bekam „permission denied" —
> ich hätte um ein Haar „ist zu" gemeldet. Es fehlte das
> **SELECT**-Recht für `returning`, nicht das INSERT. Ohne
> `returning` ging die Zeile durch. Kurz darauf das Gegenteil: ein
> `update betriebe set name=…` als Fremder lief **ohne Ausnahme**
> durch, und ich hätte fast ein Leck gemeldet — RLS hatte auf null
> Zeilen gefiltert, und das meldet Postgres als Erfolg.

- Beim Schreibtest **kein `returning`** benutzen, sonst misst man das
  Leserecht.
- Beim Schreibtest die **Zeilenzahl** messen (`get diagnostics n =
  row_count`), nicht die Ausnahme. `0 Zeilen` heißt „RLS hält",
  Erfolg heißt gar nichts.

`datenbank/pruef-rechte.sql` macht beides richtig und fährt 36
Angriffe und ehrliche Wege in einer zurückgedrehten Transaktion.

> **Vorfall, zwei weitere, beim ersten Lauf gegen den echten Bestand.**
> Die Proben für `betriebe.ziele` fragten „ist die Spalte da?“ über
> `information_schema.columns` — **in der Rolle `anon`**. Der Katalog
> zeigt jeder Rolle nur die Spalten, auf die sie ein Recht hat; weil
> die Migration anon das Recht nimmt, war die Spalte unsichtbar, und
> die anon-Proben meldeten sich als „nicht eingespielt“ ab — ohne
> eine Zeile. Genau weil die Sperre wirkte, fehlte der Beleg dafür.
> Daneben suchte die Probe den **fremden** Betrieb als Mitglied — die
> RLS verbirgt ihn schon beim Lesen, und die Probe hieß immer
> „nicht messbar“.

- Voraussetzungen (Spalte da? welcher Betrieb ist fremd?) werden
  **vor** dem Rollenwechsel bestimmt und mit `set_config('probe.…')`
  hinübergereicht. Unter einer eingeschränkten Rolle ist der Katalog
  so eingeschränkt wie die Rolle.
- Ein Gegenbeweis für „fremde Zeile nicht änderbar“ muss auch die
  **Lese**-Regel öffnen: `UPDATE … WHERE` trifft nur Zeilen, die die
  SELECT-Regel durchlässt. Nur die UPDATE-Regel zu öffnen, blieb grün.

### 2.3c Eine Spalte kann eine Liste führen, die nirgends im Code steht

> **Vorfall.** `bestellungen.quelle` sollte den neuen Wert
> `'lieferung'` bekommen. Kein `grep` dieses Projekts hätte gefunden,
> was dem entgegenstand: `bestellungen_quelle_check` mit
> `CHECK (quelle = ANY (ARRAY['tisch','telefon','reservierung','service']))`.
> Es gibt kein `create table bestellungen` — die Tabelle ist älter als
> diese Dateien, und die Liste lebt nur im Katalog von Postgres.
>
> Ohne Vorabfrage wäre `bestellung_liefern()` angelegt worden und
> hätte `success: true` gemeldet — ein Funktionskörper wird beim
> Anlegen nicht geprüft (§2.2). Gemerkt hätte es erst der **erste
> Gast**: Adresse getippt, Korb gefüllt, Knopf gedrückt, dann ein
> Fehler aus dem `insert`. Der Betrieb hätte ihn bei sich gesucht.

Wer einen neuen Wert in eine Spalte einführt, fragt nicht den Code,
sondern den Katalog:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.<tabelle>'::regclass and contype = 'c';
```

Und beim Erweitern bleibt **jeder** alte Wert drin — auch einer, der
heute keine Zeile hat. Der fehlende neue Wert fehlt laut; ein
verlorener alter fehlt still.

### 2.3d Was ausgerollt ist, aber nicht im Verzeichnis steht, prüft niemand

> **Vorfall.** Die Edge Function „melden“ (Push an die Geräte des
> Teams, ausgerollt als `swift-processor`, ohne JWT-Prüfung) lag
> nirgends im Verzeichnis. `pruef-edge.js` geht die Ordner unter
> `supabase/functions/` durch — über eine Funktion, die dort fehlt,
> iteriert keine Schleife (§8.1b). Sie nahm den Meldungstext
> ungeprüft aus der Anfrage: Jeder mit der Adresse konnte jedem
> Betrieb beliebigen Text als „Serviceruf“ auf die Sperrbildschirme
> des Personals schicken.

Zweite Quelle ist die **Liste der ausgerollten Funktionen**
(`list_edge_functions`), nicht der Ordner. Jede dort muss hier liegen.
Und eine Funktion ohne JWT nimmt aus der Anfrage nur einen Schlüssel
(eine id) und holt den Inhalt selbst — dann ist eine gefälschte
Anfrage wertlos, auch ohne geteiltes Geheimnis.

### 2.3e Die erste Adresse in `x-forwarded-for` schreibt der Aufrufer

> **Gemessen, bevor die Bremse gebaut wurde.** Eine Anfrage mit
> gefälschtem `X-Forwarded-For: 6.6.6.6` kam in PostgREST als
> `6.6.6.6,3.68.61.57` an. `x-real-ip` und `cf-connecting-ip` trugen
> die echte Adresse; ein gefälschtes `CF-Connecting-IP` wies Cloudflare
> schon am Rand ab (403, error 1000).

Wer nach Herkunft bremst, liest `cf-connecting-ip` (Rückfall
`x-real-ip`) — nie das erste Element von `x-forwarded-for`, sonst
wählt der Angreifer seine Adresse für jede Anfrage neu.

### 2.3f Ein haltender Wächter beweist nicht, dass die Tür zu ist

> **Vorfall.** Beim Bau von `rabattcode_team_anlegen` (Rabattcode mit
> Ziel-Gericht) fiel auf: `authenticated` hatte auf `rabattcodes`
> volles `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/`TRIGGER`/`REFERENCES`
> — obwohl der eigene Kommentar der Tabelle (migration-rechnung-
> rabatt.sql) sagt „authenticated darf NUR lesen … Schreiben läuft
> ausschließlich über die beiden Funktionen". Gemessen (CLAUDE.md
> §2.3b, mit Zeilenzahl statt Ausnahme): ein direkter `INSERT` und
> `UPDATE` als echtes Mitglied, auf den EIGENEN Betrieb, traf **0
> Zeilen** — RLS kennt für `rabattcodes` nur eine einzige
> `SELECT`-Regel, und Postgres verweigert ohne passende Regel per
> Vorgabe auch Schreiben. Der Wächter hielt also heute. Dieselbe
> offene Tür stand zufällig auf mindestens 18 weiteren Tabellen
> (`bestellungen`, `betrieb_mitglieder`, `gerichte`, `rechnungen` u. a.)
> — dort **nicht** nachgezogen, weil admin.html an mehreren echten
> Stellen direkt auf diese Tabellen schreibt und ein blindes `revoke`
> ohne Prüfung jedes einzelnen Schreibwegs das Risiko gewesen wäre,
> etwas Funktionierendes zu zerstören (CLAUDE.md §7 — Reihenfolge
> zählt).

Ein GRANT, das weiter reicht als die RLS-Regeln, die es tatsächlich
nutzen, ist eine offene Tür neben einem Wächter, der heute zufällig
hält. Er hält so lange, bis jemand eine `ALL`- oder `FOR ALL TO
authenticated`-Regel hinzufügt, ohne zu wissen, dass das GRANT längst
weiter reicht als gedacht — dann öffnet sich die Tür rückwirkend für
jede Zeile. Bei jeder neuen `security definer`-Funktion, die „die
einzige Schreibweise" für eine Tabelle sein soll: das GRANT selbst
nachsehen (`has_table_privilege('authenticated', ...)`), nicht nur die
RLS-Regel — und wenn kein Schreibweg außerhalb der Funktion existiert,
das GRANT auf genau das kürzen, was gebraucht wird. Ein Fund auf
mehreren Tabellen gleichzeitig wird nicht im selben Zug mitgezogen,
wenn die Zeit fehlt, jeden einzelnen Schreibweg dieser Tabellen zu
prüfen — er wird stattdessen ausdrücklich benannt und als eigenes
Vorhaben gemeldet (CLAUDE.md §9).

### 2.3g Eine Bremse vor einer Ausnahme zählt nicht

> **Vorfall, in der zurückgedrehten Probe gefunden.** `tisch_sitzung_start`
> bekam als erste Zeile `perform schutz_bremsen('tisch', 200)` und warf
> danach bei falschem Code eine Ausnahme. Die Ausnahme dreht die ganze
> Transaktion zurück — samt dem Eintrag im Zähler. PostgREST fährt
> jede Anfrage als eigene Transaktion. Gezählt wurden also nur
> **gültige** Codes; Aufruf 201 mit falschem Code bekam noch immer
> „Dieser Tischcode gilt hier nicht“ statt 429. Die Bremse stand da
> und bremste genau die Flut nicht, gegen die sie gebaut war.

Wer zählt, darf danach nicht werfen — der abgewiesene Fall wird als
Antwort zurückgegeben (leer, `false`, ein Grund im JSON), nicht als
Ausnahme. Und die Probe dazu ruft die Funktion mit **ungültigen**
Werten über die Grenze, nicht mit gültigen: Bei gültigen sieht jede
Bremse richtig aus.

### 2.4 Rollenwechsel allein simuliert PostgREST nicht

`set role anon` reicht nicht. Der einzige verlässliche Weg:

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub','<uuid>','role','authenticated')::text, true);
set local role authenticated;
-- Abfragen
rollback;
```

### 2.5 Migrationen additiv halten, Reihenfolge trennen

Spalte anlegen und füllen darf vor dem Code laufen — solange niemand
liest, ist das Risiko null. Erst der Code, der liest, macht es scharf.
Schalter wie `tisch_pflicht` bleiben aus, bis die physische
Voraussetzung (Untersetzer auf den Tischen) da ist.

### 2.6 Gleichstand in `order by` ist undefiniert

> **Vorfall.** Der Hub sortierte nach `karte, reihenfolge`.
> `reihenfolge` läuft pro Kategorie bei 0 los — dreizehn Kategorien,
> dreizehnfacher Gleichstand. Postgres darf bei Gleichstand
> zurückgeben, was physisch obenauf liegt. Jedes `UPDATE` schrieb die
> Zeile an eine neue Stelle, und die Kategorien sprangen im Gast-Hub.

**Jede** Sortierung endet mit einem eindeutigen Feld, in der Regel `id`.
Ohne diesen Notnagel ist die Reihenfolge Zufall, der sich als Fehler
tarnt.

### 2.7 Eine CHECK-Schranke läuft mit den Rechten dessen, der ändert

> **Vorfall, im lokalen Postgres 16 gemessen, bevor er live ging.**
> `betriebe.ziele` bekam eine Formprüfung. Weil eine CHECK-Schranke
> keine Unterabfrage enthalten darf, stand sie in einer Funktion —
> und der Funktion wurde `EXECUTE` für `authenticated` entzogen („kein
> rpc-Endpunkt“, §2.3a). Ergebnis: **jede** Änderung an `betriebe`
> durch das Team scheiterte mit „permission denied for function“,
> auch nur der Name. Liefer-, Hub- und Banner-Einstellungen wären
> live gesperrt gewesen.

Wer eine Funktion in eine Schranke, einen Standardwert oder eine
Regel hängt, gibt `EXECUTE` jeder Rolle, die die Zeile schreibt. Und
geprüft wird nicht nur die neue Spalte, sondern eine **andere** Spalte
derselben Zeile — dort zeigt sich der Fehler. Ohne Zugriff auf die
Datenbank läuft das im lokalen Postgres (`/usr/lib/postgresql/16`),
Datenverzeichnis im Heim des Postgres-Nutzers, nicht im Scratch-
Ordner (dessen Rechte werden zurückgesetzt, der Server stürzt ab).

### 2.8 Ein Werkzeug, das wartet, sieht aus wie eine Datenbank, die hängt

> **Vorfall.** `create trigger` lief über das Supabase-Werkzeug fünfmal
> 60 s in den Abbruch. Meine Theorie war eine Sperre auf der Tabelle —
> `pg_locks` leer, `pg_stat_activity` leer, die Theorie trotzdem
> weitergetragen. Erst die Halbierung fand den Grund: Die Anfrage kam
> **nie an**. Das Werkzeug hält eine Zeile, die mit `drop` oder `delete`
> beginnt, für destruktiv und wartet auf eine Bestätigung, die in einer
> Sitzung ohne Gegenüber nie kommt. Der Probelauf mit `delete` hing aus
> demselben Grund.

- Hängt eine Anfrage und die Datenbank zeigt nichts (keine Sperre,
  keine laufende Anfrage), wird **halbiert**, nicht weiter vermutet.
- Die Schranke ist Absicht und wird **nicht umgangen** — nicht durch
  Umformatieren, nicht durch zusammengesetzten Text. Was wirklich
  löscht, steht in der Datei und läuft im SQL-Editor; Proben, die
  `delete` messen müssen, ebenso.
- Oft ist die Form ohne Löschen ohnehin besser: `alter policy` statt
  `drop` + `create` lässt die Tabelle keinen Augenblick ohne Regel.

---

## 3 · CSS

### 3.1 Undefinierte Variablen fallen still auf transparent

> **Vorfall.** `--flaeche`, `--flaeche-2` und `--grau` wurden an 18
> Stellen im Admin-Board benutzt und nirgends festgelegt. `var()` ohne
> Wert ist ungültig, `background` fällt auf durchsichtig zurück.
> Schalter hatten keine Bahn, man sah nur den runden Knopf schweben —
> das waren die „Kreise", über die sich der Nutzer beschwerte.

Pflichtprüfung nach jeder CSS-Änderung:

```python
defined = set(re.findall(r'(--[a-zA-Z0-9-]+)\s*:', css))
used    = set(re.findall(r'var\((--[a-zA-Z0-9-]+)', s))
print(sorted(used - defined))     # muss leer sein
```

### 3.2 Angaben am Element schlagen jede Regel im Blatt

> **Vorfall beim Markenblatt.** Die Abendpalette lag in
> `body[data-phase="abend"]`. Zur Laufzeit gesetzte Variablen auf
> `<html>` hätten dagegen verloren. Das Markenblatt wäre wirkungslos
> geblieben, ohne dass irgendetwas kaputt aussieht.

Wer Variablen zur Laufzeit setzt, muss dieselben Variablen aus dem
Stylesheet **entfernen** — oder sie bewusst als Rückfall in `:root`
belassen, wo die Angabe am Element gewinnt. Beide Ebenen zu
bespielen und zu hoffen, ist keine Lösung.

> **Vorfall, dieselbe Falle andersherum.** `--glas:color-mix(… var(--flaeche) …)`
> stand in `:root`. `body.hell` setzt `--flaeche` neu — `--glas` aber
> nicht, und eine Variable wird dort ausgerechnet, wo sie steht. Die
> Glaskarten blieben im Hellen dunkelgrün.

Eine Variable, die aus einer anderen **abgeleitet** ist, wird in jeder
Fassung neu festgelegt, in der sich ihre Quelle ändert.

### 3.3 Jeder Abschnitt bringt seine eigenen Maße mit

> **Vorfall.** Der neue Landingpage-Abschnitt hatte kein `padding`,
> keine `h2`- und keine `.lead`-Regel. Er fiel auf globale Werte
> zurück: kein Abstand oben und unten, Fließtext in Schlagzeilenschrift.

Bevor ein Abschnitt nach dem Vorbild eines anderen gebaut wird: den
**vollständigen** Regelblock des Vorbilds lesen, nicht nur die
Klassennamen abschreiben. Und danach vergleichen:

```bash
# padding, marker, h2, lead je Abschnitt gegenüberstellen
```

### 3.4 `100vh` ist auf dem iPhone falsch

Safari rechnet die ein- und ausfahrende Adressleiste mit. Immer als
Paar schreiben, ältere Browser nehmen die erste Zeile:

```css
height:100vh;
height:100dvh;
```

### 3.5 Eingabefelder brauchen ausdrückliche Schriftfarbe und 16px

Ohne `color` nimmt Safari seine Systemfarbe — dunkel auf dunkel. Unter
16px zoomt iOS beim Antippen in die Seite. Klebende Kopfzeilen brauchen
`scroll-margin-top`.

```css
color:var(--kreide); -webkit-text-fill-color:var(--kreide);
font-size:16px; -webkit-appearance:none; scroll-margin-top:96px;
```

> **Vorfall, gemeldet vom Nutzer mit Bildschirmfoto.** Im hellen Modus
> von admin.html waren Anmeldefeld-Fläche und eingetippter Text
> **beide schwarz** — nichts vom Geschriebenen war zu lesen. Die
> Basisregel für Eingabefelder griff nur bei
> `input[type=text],input[type=number],textarea,select`; `type=email`,
> `type=password`, `type=date` und `type=tel` fielen auf Chromes
> eigene Feldfarbe zurück, und die folgt dem **Gerät**, nicht der
> Wahl auf der Seite — bei dunklem System blieb die Fläche dunkel,
> obwohl `body.hell` gesetzt war.
>
> Zwei Schichten wurden nötig, und der Gegenbeweis zeigte: **beide
> unabhängig ausreichend**, keine davon totes Gewicht. Erst mit BEIDEN
> zurückgenommen (in einem `git worktree`, §8.1k) sprang der Kontrast
> auf 1,63 — einzeln zurückgenommen blieb er grün, weil die jeweils
> andere Schicht in Chromium schon reichte:
>
> 1. Die Basisregel um `input[type=email],[type=password],[type=date],
>    [type=tel]` erweitert, mit derselben `color`/
>    `-webkit-text-fill-color`/`font-size:16px`-Reihe.
> 2. `document.documentElement.style.colorScheme` bei jedem Umschalten
>    (`lichtAnwenden()`/`einstAnwenden()`) auf `"light"`/`"dark"`
>    nachgezogen — das ist die eigentliche Ursache: Ohne diese
>    Laufzeit-Angabe bleibt `color-scheme` beim ersten, statisch
>    gesetzten Wert stehen (§5.2c), und der Browser richtet seine
>    NATIVEN Formularfarben danach, nicht nach `body.hell`.
>
> **Ehrliche Grenze:** Safaris eigentliche Eigenart — `color` wird
> ignoriert, nur `-webkit-text-fill-color` zählt — lässt sich in
> diesem (Chromium-basierten) Testumfeld nicht auslösen. Die Probe
> beweist, dass beide Schichten stehen und zusammen den gemeldeten
> Fall schließen, nicht, dass jede einzeln in jedem Browser trägt.

### 3.6 Beschriftung über die Bedienung, nicht daneben

> **Vorfall.** Beschriftung, Regler und Wert standen in einer
> Flex-Zeile. Auf dem Telefon blieb für die Beschriftung eine Spalte
> von vier Zeichen und der Text brach mitten im Wort um.

Auf schmalen Schirmen: Beschriftung oben, Bedienung darunter.

### 3.7 Gleich hohe Reihen erzwingen

Kachelraster brauchen `grid-auto-rows:1fr`, mehrzeilige Untertitel
`-webkit-line-clamp`. Sonst richtet sich jede Kachel nach ihrem eigenen
Text und die Nachbarin steht halb leer daneben.

---

### 3.8 Ein Blatt, ein Scrollbereich

> **Vorfall, gemeldet vom Nutzer mit iPhone-Bildschirmfoto.** Im
> Kategorie-Blatt des Boards lag das Emoji-Raster als eigener
> Scrollbereich (`max-height:44dvh;overflow-y:auto;
> overscroll-behavior:contain`) im scrollenden Blatt. Der Finger liegt
> fast immer auf dem Raster; das Raster lief an sein Ende und hielt
> dort fest. Gemessen: Blatt 0 von 192 px gerollt, „Sichern" bei
> y=891 unter dem Schirm, ein Wisch nach unten rollte das Raster statt
> das Blatt zu schließen. „Die Seite bleibt hängen."

Ein Scrollbereich im Scrollbereich ist auf dem Telefon fast immer
falsch: Welcher rollt, entscheidet die Stelle, auf die der Finger
zufällig fällt. Lange Auswahllisten fließen im Blatt mit.

Und gemessen wird mit dem **Finger**, nicht mit der Maus: Eine
Maus-Probe rollt nichts und hat den Fehler nie gesehen. Echte
Touch-Folgen gehen über `Input.dispatchTouchEvent` (CDP); dort rollt
Chromium wirklich. Zwei Messfallen dabei, beide getroffen:

- „Scharf schalten" im Board geht in den Vollbildmodus, und der
  kopflose Schirm ist 800×600. Danach landete jeder Finger unterhalb
  von y≈590 im Board — eine erfundene Grenze, die fast als Befund
  durchgegangen wäre. `requestFullscreen` in der Probe abklemmen.
- Der Willkommensschirm des Hubs steht in `sessionStorage`, nicht in
  `localStorage`. Mit dem falschen Schlüssel fing er den Finger je
  nach Tempo ab, und die Probe wurde rot und grün im Wechsel.

### 3.9 Gleichstand im `z-index` entscheidet die Reihenfolge im Dokument

> **Vorfall, gemeldet vom Nutzer mit Bildschirmfoto.** Das Menü „Mehr“
> im Board (`.mehrfach`) und die schwebende Leiste „Gericht
> hinzufügen / Karte einlesen“ standen beide auf `z-index:39`. Bei
> Gleichstand malt das spätere Element obenauf — auf dem Karte-Reiter
> lagen die beiden Knöpfe über „Startseite“ und „Einstellungen“, die
> Menüpunkte waren nicht zu erreichen. Auf jedem anderen Reiter fehlt
> die Leiste, dort sah alles richtig aus.

Wer eine feste Ebene anlegt, sucht zuerst jede andere mit derselben
Zahl (`grep -n 'z-index:39' datei.html`) und prüft **auf jedem Reiter**,
was ein Finger trifft (`elementFromPoint`) — nicht nur auf dem, auf dem
man gerade baut.

### 3.10 Eine Variable für mehrere Textrollen ist ein Versprechen, das nicht gehalten wird

> **Vorfall, gemeldet vom Nutzer.** „Wenn man die Schriftart für den
> Titel 'Guten Tag' ändert, ändert sich auch die für das runde Feld
> [Tischquiz-Runde/Punktzahl]." Befund: `h1,h2,.tipp .name,.gericht .n,
> .gericht .p,.wkopf .wn,.wkopf .wp,.frage,.punkte,.summe .b,.gross,
> .bnummer,.kachel.saeule strong,.tipp .preis{font-family:var(--schrift-
> kopf)}` — **dreizehn** optisch und inhaltlich unabhängige Textrollen
> (Begrüßungstitel, Tischquiz-Überschrift und -Punktzahl, Gerichtname,
> Kachel-Beschriftung, Kontostand …) hingen an EINER CSS-Variable, die
> einmal global gesetzt wurde. Jede Änderung an einer Stelle änderte
> zwangsläufig alle anderen mit — nicht, weil es gewollt war, sondern
> weil nie jemand eine zweite Variable angelegt hatte, als die zweite
> Rolle dazukam.

Ein Name wie `--schrift-kopf` beschreibt eine HERKUNFT („kommt aus dem
Kopf-Feld des Markenblatts"), keine WIRKUNG. Sobald eine Variable an
mehr als einer optisch unabhängigen Stelle verwendet wird, ist das
kein Wiederverwenden, sondern ein Versprechen an jede künftige Stelle,
die dieselbe Variable ebenfalls benutzt: „was hier steht, ändert sich
nie unabhängig von dort". Dieses Versprechen hält niemand ein, sobald
zwei Kunden(-wünsche) unterschiedliche Antworten für die beiden
Stellen brauchen. Vor der Wiederverwendung einer bestehenden
Schrift-/Farb-/Maß-Variable an einer NEUEN Stelle: **Muss diese Stelle
jemals unabhängig von den anderen änderbar sein?** Im Zweifel eine
eigene Variable mit eigenem, lebendigem `var(--x, var(--kopf))`-
Rückfall anlegen (CLAUDE.md §2.5 additiv, bestehende Kunden sehen ohne
eigenes Zutun keine Änderung) — das kostet eine Zeile CSS und eine
Zeile in der Stelle, die sie setzt, und erspart genau diesen Vorfall.

## 4 · Animation und Neuzeichnen

### 4.1 Eine Einflug-Animation gehört nur an neue Elemente

> **Vorfall.** `.bon` im Küchendisplay trug `animation:rein .3s`. Das
> Feld wird alle vier Sekunden per `innerHTML` neu aufgebaut — alle
> Karten sind dann neue Elemente und flogen erneut ein, gestaffelt.
> Das war das „Wackeln".

Animation auf einer Klasse, die nur wirklich neue Elemente tragen
(`.frisch`). Und:

### 4.2 Nicht neu zeichnen, wenn sich nichts geändert hat

Signatur bilden aus den Feldern, die zählen — **ohne Uhrzeit**, sonst
ist jede Minute ein Neuaufbau fällig. Laufende Zeiten am bestehenden
Element nachziehen. Während einer Wischgeste gar nicht neu zeichnen,
sonst rutscht die Karte dem Finger weg.

### 4.3 Wer nachrücken soll, muss dasselbe Element bleiben

> **Vorfall.** Im Wischstapel baute `edNeuZeichnen()` nach jeder Wahl
> den ganzen Stapel per `innerHTML` neu. Die zweite Karte hatte eine
> Transition auf `transform` — und sprang trotzdem auf Platz eins. Ein
> neues Element hat keinen alten Zustand, von dem eine Transition
> laufen könnte.

Karten, Zeilen, Pillen, die sich verschieben sollen: Element behalten,
nur Attribut oder Variable ändern (`data-tiefe`, `--tiefe`), wirklich
Neues anhängen und nur das einblenden. Die Prüfung dazu hält das
Element vorher und nachher gegeneinander (`oben === zweite`) und
fragt nach einer laufenden `CSSTransition` — nicht nach dem Bild.

### 4.4 Ein Selektor auf den `style`-Text misst die Schreibweise

> **Vorfall.** Die oberste Karte wurde mit
> `[style*="--tiefe:0"]` gesucht. Sobald der Finger zog, setzte das
> Skript `el.style.transform` — und der Browser schrieb das ganze
> Attribut neu als `--tiefe: 0; transform: …`, mit Leerzeichen. Der
> Selektor fand nichts mehr, zwei Prüfskripte fielen mit
> `Cannot read properties of null`.

Zustand, nach dem gesucht wird, gehört in ein eigenes Attribut
(`data-…`), nie in den `style`-Text. Den schreibt der Browser, wie er
will.

### 4.5 Was nach dem Zeichnen verdrahtet wird, braucht EINE Stelle

> **Vorfall, gemeldet vom Nutzer mit Bildschirmfoto.** Die bewegten
> Emojis waren nach dem ersten Tipp auf eine Kategorie wieder stille
> Geräte-Emojis. `bzVerdrahten()` hing an `zeichne()` — der Chip, die
> Suche und der Serviceruf bauen aber per `innerHTML` neu, ohne
> `zeichne()`. Neue Hüllen ohne Film. Die Prüfung war grün, weil sie
> nur den ersten Aufbau der Seite ansah.

Wer nach jedem Neuzeichnen etwas anschließen muss (Filme, Beobachter,
Horcher), hängt es nicht an jede Zeichenstelle — die nächste wird
vergessen. EIN `MutationObserver` sieht jede neue Hülle, einmal je
Bild gebündelt, und das Angeschlossene trägt die Klasse selbst nicht,
sonst weckt es sich selbst. Die Prüfung dazu zeichnet über **jeden**
Weg neu (Chip, Suche, fremdes `innerHTML`) und zählt danach, was
wirklich läuft.

---

## 5 · Farben, die der Kunde wählt

### 5.1 Schriftfarbe auf farbigem Grund wird gerechnet, nie gesetzt

> **Vorfall.** Der Knopf im Marken-Studio hatte fest `color:#fff`. Die
> Bar-Vorlage hat helles Säuregrün als Hauptfarbe — Weiß darauf ergibt
> **1,16:1**. Buchstäblich nicht lesbar.

Überall, wo ein Nutzer die Hintergrundfarbe bestimmt, wird die
Schriftfarbe aus der Helligkeit hergeleitet. Der Kunde bekommt seine
Farbe, der Gast bekommt Lesbarkeit.

### 5.2 Kontrast messen, nicht ansehen

Nach jeder Palettenänderung alle Paare rechnen: Schrift auf Grund,
Nebentext auf Karte, Bandschrift auf Band, Akzent auf Karte,
Knopfschrift auf Knopf — **Tag und Abend**. Grenze 4,5:1.
`pruef-kontrast.js` im Projekt macht genau das.

### 5.2a Ein Grenzwert in der Prüfung kann eine Lücke sein

> **Vorfall.** Der neue Fußzeilen-Link im Hub stand auf 9,5px und kam
> bei Choco auf **2,83:1**. `pruef-lesbarkeit.js` meldete trotzdem
> „alles sauber" — sie überspringt alles unter 10px als Zierschrift.
> Für eine Gutschrift stimmt das; für etwas, das man **antippen**
> soll, nicht.
>
> Der Fehler davor war meiner: Ich hatte `--tinte-still` gesetzt und
> in den Kommentar geschrieben „auf Pappe 4,57:1". Der Wert stimmte —
> nur ist der Grund im Hub die Farbe, die der **Kunde** gewählt hat.
> Genau §5.1, eine Ebene tiefer.

Zwei Lehren, beide gemessen:

- Eine feste Schriftfarbe im Hub ist immer falsch. Rollen wie
  `--tinte-leise` werden pro Markenblatt hergeleitet und tragen
  deshalb bei jedem Haus (Choco 4,55:1, Blend 7,44:1).
- **Ein Bedienelement ist nie Zierschrift.** Die Prüfung rechnet
  Links und Knöpfe jetzt unabhängig von der Schriftgröße. Wer einen
  Grenzwert einbaut, muss sich fragen, was er damit ungesehen
  durchlässt.

> **Vorfall, zwei Fehler hinter einer Zahl.** `pruef-lesbarkeit.js`
> meldete die Rabatt-Segmente im Board wochenlang mit 1,07:1 — und
> sie wurden als „vorbestehend“ weitergereicht. Nachgemessen: Die
> Prüfung stieg nur die **Eltern** hinauf, der Schieber unter der
> Schrift ist aber ein **Geschwister**. Die Zahl war falsch — der
> Fehler darunter echt, sogar zwei: Der Schieber war fest ⅓ breit
> bei zwei Knöpfen („Ganze Rechnung“ stand zu einem Viertel daneben),
> und im Hellen stand die feste dunkle `--sockel`-Schrift auf dem
> dunklen Hell-Messing (2,88:1).

Ein Befund, den man nicht versteht, wird nicht weitergereicht,
sondern nachgemessen — ein Fehlalarm und ein echter Fehler sehen in
der Liste gleich aus. Und Schrift auf einer Fläche, die in einer
Fassung die Helligkeit wechselt, wird in **jeder** Fassung neu
festgelegt (§3.2).

### 5.2b Hell und dunkel entscheidet der Grund, nicht die Uhr

> **Vorfall.** Die hellen Gliedmaßen der Figur hingen an
> `[data-phase="abend"]`. Das traf Choco richtig und Blend nie: Blend
> ist ein Cocktail-Lab und schon am **Tag** fast schwarz
> (`grund #0B0C0F`, Abendfassung gar nicht eingeschaltet). Gemessen:
> Gliedmaßen 1,31:1, Kaffeebohne 2,40:1 — die Beine weg, die Figur ein
> Fleck. Ein Haus, das tagsüber dunkel ist, gibt es; eine Uhr, die das
> weiß, nicht.

Alles, was von der Helligkeit des Untergrunds abhängt, wird aus der
**gemessenen Fläche** hergeleitet, nie aus der Tageszeit. Und gemessen
wird dort, wo wirklich gemalt wird: Im Hub trägt `<html>` den Grund,
`<body>` behielt abends die Tagesfarbe — wer am `body` misst, bekommt
abends „hell".

### 5.2c Ohne `color-scheme` färbt der Browser selbst um

> **Vorfall.** Ein Gast öffnete Chocos Karte auf einem Samsung mit
> eingeschaltetem Dunkelmodus. Die Figuren und einige Flächen kamen
> „viel heller" heraus als auf dem iPhone — dunkle Konturen waren hell
> geworden.
>
> Chrome auf Android und Samsung Internet haben ein „dunkles Design für
> Webseiten". Findet der Browser **keine** `color-scheme`-Angabe, hält
> er die Seite für eine, die kein Dunkel kennt, und kippt selbst die
> Helligkeiten. Gemessen: **keine einzige Datei** dieses Verzeichnisses
> hatte die Angabe.

Jede ausgelieferte Seite sagt an, was sie zeigt — und zwar das, was sie
**wirklich malt**, nicht das, was der Schalter heißt:

```css
:root{color-scheme:dark}        /* fest dunkel */
:root{color-scheme:light dark}  /* folgt wirklich dem System */
```

Drei Dinge gehören dazu, und jedes hat beim Gegenbeweis eine eigene
Lücke aufgedeckt:

- **Eine falsche Ansage ist schlimmer als keine.** Der Browser richtet
  Bedienelemente und Rollbalken danach. Deshalb wird die Ansage gegen
  den gemessenen Grund gehalten, nicht gegen die Absicht.
- **`light dark` ist eine Behauptung.** Wer das ansagt, muss dem System
  auch wirklich folgen. Im ganzen Verzeichnis tut das genau eine Seite.
- **Der erste Anstrich zählt.** Der Hub setzt sein Schema zur Laufzeit
  nach — aber der Browser entscheidet, bevor ein Skript läuft. Deshalb
  schreibt der Erzeuger zusätzlich ein `<meta name="color-scheme">` aus
  der Tagpalette des Hauses. Eine Prüfung, die nur den Laufzeitwert
  misst, bleibt grün, während der erste Anstrich falsch ist.

**Die ehrliche Grenze:** Der kopflose Browser kennt Chromes Auto Dark
Theme nicht — fünf Flag-Varianten durchprobiert, keine greift. Die
Prüfung zeigt, dass die Ansage da ist und stimmt, **nicht**, dass das
Umfärben aufhört. Der Beweis dafür steht auf dem Gerät des Gastes.

> **Vorfall, genau diese Grenze eingetroffen.** Ein Gast öffnete
> omoteno.de auf einem Xiaomi-Telefon (MIUI-Browser): Abschnitte mit
> hellem Grund zeigten gar keinen Text, nur leere helle Flächen.
> `omoteno-web.html` hatte `:root{color-scheme:light}` längst — genau
> der Fix von oben. Nachgesehen: **acht von neun statischen Seiten**
> unter `seiten/` (admin, datenschutz, impressum, konto, kueche,
> marken-studio, omoteno-web, start) hatten nur die CSS-Angabe, kein
> `<meta name="color-scheme">` im Kopf. „Der erste Anstrich zählt" war
> beim Hub-Erzeuger umgesetzt — und nie auf die Seiten übertragen, die
> von Hand ausgeliefert werden.
>
> `pruef-farbschema.js` hatte das nie sehen können: Ihre Meta-Prüfung
> filterte von Anfang an auf `startsWith("hub:")`. Eine Prüfung, die
> nur den erzeugten Hub ansieht, kann eine fehlende Angabe auf einer
> STATISCHEN Seite nicht finden — derselbe Fehler wie in §8.1a, nur
> eine Ebene höher: Was mehrfach existiert (hier: neun Kopf-Bereiche
> statt einer Vorlage), muss auch mehrfach geprüft werden.

Die Prüfung deckt jetzt beides ab, mit derselben Messung: das Meta
jeder statischen Seite gegen ihre eigene CSS-Angabe (`getComputedStyle`
auf `colorScheme`), nicht nur der erzeugte Hub gegen sein Markenblatt.

### 5.3 Bewusste Ungereimtheiten nicht wegsystematisieren

> **Vorfall.** Chocos Goldfläche am Tag war seit jeher aus dem hellen
> **Abend**gold gemischt. Meine saubere Herleitung hätte den Ton
> verändert — der Wisch wirkte danach wie Lehm statt wie Bernstein.

Vor einer Vereinheitlichung: alte und neue Werte **rechnerisch**
vergleichen und jede Abweichung einzeln entscheiden. Absicht schlägt
Systematik, wenn die Absicht besser aussieht. Dafür eine ausdrückliche
Ausnahme zulassen, statt die Regel zu verbiegen.

---

## 6 · Heuristiken gegen echte Daten prüfen

### 6.1 Eine Regel, die nur im Kopf funktioniert, funktioniert nicht

> **Vorfall A.** „Originalname immer zeigen, wenn übersetzt" — hätte 50
> Zeilen wie „Marina Waffel" unter „Marina Waffle" erzeugt. Rauschen.
> Die tragfähige Regel hing an der **Schrift**, nicht an der Sprache:
> bei arabischer und kyrillischer Schrift immer, bei lateinischer nur
> bei echter Unähnlichkeit.

> **Vorfall B.** Der Karten-Zerleger hatte drei Fehler, alle erst im
> Test gegen realistische Karten sichtbar: Trenner blieb in der
> Beschreibung hängen, `═══════` wurde als Gericht gelesen, und
> „Gulaschsuppe" ohne Preis wurde zur Kategorie und riss alle
> folgenden Gerichte mit.

**Jede Heuristik wird gegen die echten Daten laufen gelassen, bevor sie
als fertig gilt.** 102 Gerichte liegen in der Datenbank, acht
realistische Kartenformate in `pruef-import.js`. Wenn sich die Regel
dabei ändert: gut — dafür ist der Test da.

### 6.2 Die Umgebung entscheidet, nicht die Zeile

„Gulaschsuppe" kann Überschrift oder vergessener Preis sein. Was es
entscheidet, ist die Umgebung: Leerzeile davor, Großschreibung, Ziffern
in der Zeile. Wer nur die Zeile ansieht, rät.

---

## 7 · Risiko richtig herum abwägen

> **Vorfall.** Der erste Entwurf der Tischsitzung lehnte Bestellungen
> ohne gültige Sitzung ab.

Falsch herum optimiert. Die Fehler sind nicht gleich schlimm:

| | Kosten |
|---|---|
| Echter Gast kann nicht bestellen | Umsatz, Nerven, ein Gang des Kellners |
| Geisterbestellung geht durch | Ein Blick zum Tisch, schlimmstenfalls ein Teller |

**Wer beides mit derselben Härte behandelt, optimiert das seltenere
Problem auf Kosten des täglichen.** Richtige Antwort: durchlassen und
markieren, das Personal entscheidet. Strenge nur als Schalter, den der
Betrieb selbst umlegt.

Dasselbe gilt beim Ehrlichsein über Nutzen: Der Tischschlüssel ist
statisch und beweist „war am Tisch", nicht „sitzt dort". Eine Sitzung
macht daraus eine Frist, kein Schloss. Das gehört so gesagt.

---

## 8 · Die Prüfliste vor jeder Übergabe

Keine Datei geht raus, ohne dass das hier gelaufen ist:

```bash
python3 pruefungen/pruef-datei.py dist/chocolamour/index.html
```

Das Werkzeug prüft genau die Fehler, die in diesem Projekt schon
einmal passiert sind: offene CSS-Klammern, Variablen ohne Wert,
doppelte `id` im Auszeichnungstext, im Skript gesuchte Elemente ohne
Gegenstück im HTML, Namenskollisionen zwischen Skriptblöcken und die
Syntax jedes Blocks einzeln.

### 8.1 `[hidden]` hält nicht, wenn im Blatt ein `display` steht

> **Vorfall, der schwerste dieser Sitzung.** `.willkommen` setzt
> `display:flex`. Die Regel des Browsers für `[hidden]` ist eine
> UA-Regel und verliert gegen **jede** Angabe im Blatt. Das Attribut
> tat also nichts: Nach einem Neuladen INNERHALB der Sitzung
> übersprang der Willkommensschirm sich selbst, blieb aber
> undurchsichtig über dem ganzen Hub liegen und fing jeden Tipp ab.
> Der Gast sah eine leere farbige Fläche und konnte nichts mehr tun —
> bei jedem Neuladen, bei jeder Rückkehr aus dem Hintergrund. Dieselbe
> Falle stand schon zweimal im Konto und im Board; der Hub hatte die
> Gegenregel nie.

**Jede Datei bekommt ganz oben:**

```css
[hidden]{display:none !important}
```

Und: Ein Überlagerungsschirm, der nicht gebraucht wird, wird
**entfernt**, nicht nur versteckt. Gefunden hat das keine
Einzelprüfung, sondern erst `pruef-durchgang.js` — der Weg, den ein
Gast wirklich geht. Wer nur Bausteine prüft, findet keine Fehler
zwischen den Bausteinen.

### 8.1c `hidden` gibt es auf einem SVG nicht als Eigenschaft

> **Vorfall.** Untersetzer und Aufsteller bekamen je eine eigene
> Zeichnung; umgeschaltet wurde mit `el.hidden = true`. Beim Messen:
> **Eigenschaft `true`, Attribut weg, `display` weiter `block`** —
> die Fläche blieb stehen, und die zweite lag darunter. Kein Fehler,
> keine Warnung.
>
> Grund: `hidden` liegt auf **HTMLElement** und spiegelt dort aufs
> Attribut. Ein `<svg>` ist ein `SVGElement` und erbt das nicht. Die
> Zuweisung legt dann still eine gewöhnliche JS-Eigenschaft an, die
> niemand liest.

Bei allem, was kein HTML-Element ist — `<svg>` und alles darin —:

```js
el.setAttribute("hidden", "");   // statt el.hidden = true
el.removeAttribute("hidden");    // statt el.hidden = false
```

Und die Prüfung dazu darf **nicht** `el.hidden` ablesen; dort steht
für SVG immer `undefined`. Gemessen wird, was zählt:
`hasAttribute("hidden")`, `getComputedStyle(el).display` und die
Breite. Mein erster Test las die Eigenschaft und meldete deshalb
grün, als es noch kaputt war — und rot, als es schon lief.

Zusammen mit §8.1 heißt das: `[hidden]` braucht die
`display:none`-Gegenregel **und** den richtigen Weg, es zu setzen.
Eines von beidem allein reicht nie.

### 8.1a Bausteine prüfen findet nicht, was zwischen ihnen fehlt

> **Vorfall.** Der Erzeuger baute für „Blend" einen Hub mit
> `name: "Blend"` im Markenblatt — und Chocos gezeichnetem Siegel im
> Kopf, weil das SVG fest im Gerüst stand. `pruef-datei.py` war
> zufrieden, `pruef-durchgang.js` auch: Beide prüfen den Hub, den es
> gibt, nicht den Hub, den ein ZWEITER Kunde bekommt. Aufgefallen
> ist es erst beim Bedienen des ausgelieferten Ordners — die Seite
> `/h/blend/` trug im Titel „Choco L'AMouR".

Dieselbe Lehre wie beim Willkommensschirm, nur eine Ebene höher:
**Was mehrfach erzeugt wird, muss mindestens zweimal erzeugt und
verglichen werden.** Ein Test mit einem Kunden sieht jede
eingebrannte Fremdangabe für richtig an.

Und beim Ersetzen einer solchen Stelle: Der alte Stand muss
**bytegleich** herauskommen, wo er richtig war. Chocos Siegel wanderte
dafür als ausdrückliche Ausnahme ins Markenblatt (§5.3), und der
Vergleich vorher/nachher war Teil der Arbeit, nicht der Nachbereitung.

### 8.1e Ein geteilter Block muss tragen, worauf er sich stützt

> **Vorfall.** Der FIGUR-Block wird zwischen `hub.vorlage.html` und
> `marken-studio.html` kopiert, und `pruef-figur.js` vergleicht beide
> Fassungen Zeichen für Zeichen. Sie waren gleich. Trotzdem war der
> Untersetzer im Studio ein **schwarzer Fleck** und der Mund der
> Erdbeere eine gefüllte Sichel: Die Grundregeln des Zeichensatzes
> (`.figur .zug{fill:none}`, `.figur .schatten{…}`) standen im Gerüst
> **außerhalb** des Blocks und im Studio gar nicht. Ohne Regel füllt
> SVG mit Schwarz. Gemessen: `fill: rgb(0,0,0)` an fünf Klassen, in
> jeder Pose, in jeder Laune.

Ein Blockvergleich sieht nur, ob zwei Kopien gleich sind — nicht, ob
außerhalb etwas fehlt. Deshalb gilt: **Alles, worauf ein geteilter
Block sich stützt, gehört in den Block.** Und die Prüfung dazu misst
nicht den Text, sondern das gezeichnete Bild, **in jeder Datei**.

Dazu die zweite Hälfte: **Ein Schirm ist keine Messung.** Der
`.blatt`-Fehler aus §1.1 war bei 1440×900 unsichtbar (dort legt das
Studio das Einstellblatt als Seitenspalte, ohne `transform`) und bei
900×1000 offensichtlich. Meine Prüfung fuhr zuerst nur die eine Breite
— und meldete grün.

### 8.1f Auf einer bewegten Fläche misst kein Pixelvergleich

> **Vorfall, und es war eine Behauptung von mir.** Nach einem Umbau am
> Bestellpass meldete ich „Bestellpass tag: BYTEGLEICH, abend:
> BYTEGLEICH" als Beleg, dass sich nichts verändert hat. Beim nächsten
> Block wich derselbe Vergleich plötzlich ab. Gegenprobe: **dieselbe
> Datei gegen sich selbst** — auch die wich ab. Auf dem Pass laufen
> Guss, Dampf und Einflug; ein Bildschirmfoto trifft sie jedes Mal an
> einer anderen Stelle. Der frühere „BYTEGLEICH" war Glück, kein
> Messwert.

Wo etwas animiert ist, wird der **Auszeichnungstext** verglichen, nicht
das Bild: `PHASEN[s].zeichen()` und `begleiterHTML()` liefern
Zeichenketten, und die sind entweder gleich oder nicht. Ein
Pixelvergleich taugt nur auf ruhenden Flächen — und wer ihn benutzt,
lässt ihn einmal gegen sich selbst laufen, bevor er ihm glaubt.

Dieselbe Falle eine Ebene tiefer: **Eine Gruppe zu messen heißt nicht,
den Gegenstand darin zu messen.** Die Prüfung „ist die Requisite groß
genug" nahm die `getBBox()` der umgebenden Gruppe — die umfasst auch
den Dampf, und der bleibt groß, während das Ding darunter zum Punkt
schrumpft. Der Gegenbeweis blieb grün. Gemessen wird jetzt die
Requisite allein, ohne Beiwerk.

### 8.1b Eine Prüfung über das Vorhandene ist blind für das Fehlende

> **Vorfall.** `choco-lamour.omoteno.de` lieferte die Landingpage
> statt Chocos Hub: `_redirects` kannte nur die Schreibweise ohne
> Bindestrich, keine Regel passte, und Netlify liefert dann die
> Startseite des Ordners aus. `pruef-lieferung.js` hatte das nie
> sehen können — sie übersprang Regeln mit absoluter URL
> ausdrücklich (`if(von.startsWith("http")) continue`).
>
> **Der eigentliche Fehler kam danach.** Meine erste Nachbesserung
> lief über die Regeln, die in `_redirects` *dastehen*. Beim
> Gegenbeweis — Zeile testweise wieder entfernt — meldete sie
> „alles sauber". Der Anlassfall war eine **fehlende** Zeile, und
> über etwas, das nicht dasteht, iteriert keine Schleife.

Wer eine Liste durchgeht, prüft nur, ob das Vorhandene stimmt. Für
„etwas fehlt" braucht es eine **zweite Quelle**, gegen die man hält.
Hier: nicht die Regeln zählen, sondern die erzeugten Hubs — jeder
Ordner unter `/h/` ist ein Kunde, und jeder Kunde braucht eine
Adresse, die auf ihn zeigt.

**Und jede Prüfung muss ihren eigenen Anlassfall reproduzieren
können.** Korrektur testweise zurücknehmen, Prüfung laufen lassen:
Wird sie nicht rot, prüft sie nicht das, wofür man sie geschrieben
hat. Das kostet zwei Minuten und ist der einzige Beleg, der zählt.

Dazu die ehrliche Grenze, die dazugehört: Diese Prüfung fängt
„Zeile vergessen" und „Zeile zeigt ins Leere". Sie kann **nicht**
wissen, ob die Adresse auch im DNS und bei Netlify eingetragen ist —
das steht nirgends im Verzeichnis. Eine Grenze, die man nennt, ist
keine Lücke; eine, die man verschweigt, schon.

### 8.1g Eine Probe, die den Fehler nicht zeigen KANN, ist keine Probe

> **Vorfall A.** Die Prüfung „ein eigener Satz des Hauses wird nicht
> übersetzt" setzte als Probe „Wird gerade gebacken" — einen Satz, den
> es im Wörterbuch **nicht** gibt. Der wäre auch durch `t()` unverändert
> herausgekommen. Die Prüfung war grün und hätte es auch dann gemeint,
> wenn der Hub jeden Haussatz übersetzt hätte. Gegenprobe mit einem
> Satz, der im Wörterbuch **steht**: sofort rot.

> **Vorfall B.** Zwei Gegenbeweise blieben grün, weil meine Sabotage
> gar nicht griff: Einmal setzte ich einen Pfad auf x = −44, was im
> 124 Einheiten breiten Feld immer noch drin liegt; einmal suchte ich
> `body{background:` in einer Datei, die diese Zeile nicht hat. Grün
> heißt dann nicht „die Prüfung hält", sondern „ich habe nichts
> kaputtgemacht".

Eine Prüfung ist erst belegt, wenn die Probe den Fehler **treffen
kann**. Deshalb gehört zu jedem Gegenbeweis der Nachweis, dass die
Sabotage überhaupt angekommen ist — `grep -c` auf die geänderte Stelle
kostet zwei Sekunden.

> **Vorfall C, und er ist die tückischste Form davon.** Die Prüfung
> für die Wischgeste öffnete in der Küche ein Blatt und zog daran.
> Der Aufruf ging ins Leere — `einstOeffnen` ist im Küchenskript
> nicht global —, es öffnete sich also gar nichts. Die Probe
> „ein langer Zug schließt sie" prüfte danach
> `!document.querySelector(".decke")` und meldete **grün**: Wo nie
> etwas war, ist auch nichts mehr. **„Nichts da" sieht aus wie
> „geschlossen".**

Daraus die dritte Regel: **Eine Probe, deren Voraussetzung fehlschlagen
kann, muss die Voraussetzung selbst prüfen — und die Folgeproben daran
hängen.** Sonst meldet die Prüfung nicht „es funktioniert", sondern
„ich habe nichts gefunden", und das klingt gleich.

> **Vorfall D, und er stand in der Prüfung selbst.** `pruef-uebersetzung.js`
> hält gegen eine zweite Quelle: Jeder Satz, der aus Daten auf den
> Schirm kommt, braucht einen Wörterbucheintrag. Eigennamen wie
> „Dubai Crêpe" dürfen keinen haben — dafür stand dort ein **Muster**:
> Großbuchstabe, bis zu vier Wörter. Es verschluckte
> „Winken ohne zu winken", eine ganz gewöhnliche Kachelunterzeile.
> Der Gegenbeweis — Eintrag testweise entfernt — blieb **grün**. Die
> Prüfung hätte genau den Fall, für den sie geschrieben wurde, nicht
> gefunden.
>
> Ersetzt durch eine **namentliche Liste**. Wer eine Ausnahme braucht,
> schreibt sie hin; dann sieht man beim Lesen, was sie durchlässt. Ein
> Muster versteckt das.

Dazu die verwandte Falle bei Grenzwerten: **Eine Grenze, die man sich
ausdenkt, ist keine Messung.** Die harte Länge für den Satz des
Begleiters stand in meinem Entwurf auf 120 Zeichen — gemessen hatte ich
nur bis 96. Die eigene Prüfung hat den Wert widerlegt: Bei 360 px waren
120 Zeichen vier Zeilen. Nachgemessen sind es 108.

> **Vorfall E, zweimal in derselben Runde.** Gegenbeweis
> „strikt boolean entfernt“: `!!HUBSTIL.emoji` statt
> `typeof … === "boolean"`. Die Probe setzte `{emoji:"false"}` und
> erwartete „an“ — genau das liefern **beide** Fassungen. Grün. Erst
> eine Probe, bei der die Zeichenkette zum Markenblatt durchfallen
> MUSS (dort „aus“), trennt die beiden. Kurz darauf dasselbe mit
> „Transition beim Wurf nicht abgeschaltet“: Auf keinem heutigen Weg
> ändert sich an dieser Stelle `transform`, die Zeile ist Vorsorge.
> Tragend war das Abschalten beim ZIEHEN — und das prüfte niemand.

Ein grüner Gegenbeweis heißt eine von zwei Sachen: Die Prüfung ist
blind, oder die sabotierte Zeile trägt nichts. Beides muss man
herausfinden, nicht wegerklären.

> **Vorfall F, zweimal hintereinander.** „Höchstens ein Vorschlag je
> Gruppe“ im Warenkorb. Gegenbeweis: die Gruppenregel entfernt —
> grün. In der Beispielkarte hat jede Gruppe ihr eigenes Emoji, und
> die Regel „kein Emoji doppelt“ tat dasselbe. Probe mit Fotos an
> jedem Gericht (dann gibt es kein Emoji) — wieder grün: Die Plätze
> kamen aus verschiedenen Stufen (Getränk, Süßes, Herzhaftes), die
> verteilten sie schon. Erst ein Korb, in dem alle vier Plätze aus
> EINER Stufe kommen, machte die Regel tragend — und die Probe rot.

Zwei Regeln, die in den Probedaten dasselbe bewirken, verdecken
einander. Die Probe muss die Daten so bauen, dass nur noch die eine
Regel zwischen „richtig“ und „falsch“ steht.

### 8.1j Eine Prüfung, die an der Uhr hängt, prüft die Uhr

> **Vorfall.** `pruef-liefern.js` war um 10:24 UTC rot: „0 Felder“,
> „Adresse statt Tischnummer“ fehlt. Der Liefermodus war in Ordnung —
> Choco öffnet um 10:30, vorher zeigt der Hub zu Recht kein
> Bestellfeld. Für Blend hatte die Prüfung die Öffnungszeiten längst
> festgelegt, für Choco nicht. Am Nachmittag geschrieben, am
> Nachmittag grün.

Alles, was von Uhrzeit, Wochentag oder Datum abhängt, legt die Prüfung
selbst fest — für **jedes** Haus — und misst danach, dass die
Voraussetzung gilt. Eine rote Prüfung zu einer bestimmten Uhrzeit ist
kein Wackler, sondern ein Befund.

### 8.1k Gegenbeweise nie im Arbeitsordner

> **Vorfall.** Zwölf Sabotagen liefen nacheinander direkt in
> `vorlagen/hub.vorlage.html`. Währenddessen stand der Ordner jeweils
> zwanzig Minuten mit einer absichtlich kaputten Zeile da. Ein Commit
> in dieser Zeit — und der Stop-Hook verlangte genau das — hätte den
> Fehler eingecheckt. Gerettet hat eine Sicherungskopie und ein Commit
> über `git update-index --cacheinfo` an der Arbeitskopie vorbei.

Gegenbeweise laufen in einem eigenen `git worktree` auf dem
committeten Stand. Der Arbeitsordner bleibt, was er ist.

### 8.1l Syntax sauber heißt nicht: läuft

> **Vorfall.** `SEITEN.entdecken = …` stand zwanzig Zeilen VOR
> `const SEITEN = {}`. Jeder Syntaxprüfer ist damit zufrieden — erst
> beim Ausführen wirft die „temporal dead zone“ einen
> `ReferenceError`, und der Hub blieb eine leere farbige Fläche.
> `pruef-datei.py` meldete „Alles sauber“.

Nach jedem neuen Block im Skript: die Seite einmal wirklich öffnen und
`pageerror` abhören. Eine Syntaxprüfung sieht Klammern, keine
Reihenfolge.

### 8.1h Eine Fehlerbehandlung, die nie erreicht wird, ist keine

> **Vorfall, und der Nutzer hat ihn gefunden, nicht ich.** Der
> Google-Knopf im Konto führte in eine Sackgasse: rohes JSON
> („provider is not enabled") auf der Supabase-Adresse. Darunter im
> Code standen zwölf sorgfältige Zeilen, die genau diesen Text in
> Klartext übersetzen — **und die nie gelaufen sind**.
>
> Grund: `signInWithOAuth()` fragt niemanden. Es setzt die Adresse
> lokal zusammen und ruft `location.assign()` auf. Es gibt kein
> `error`, also kein `throw`, also kein `catch`. Ich hatte in einem
> früheren Bericht sogar geschrieben „der Code war in Ordnung" — der
> **Aufruf** war es, die Absicherung dahinter nicht.
>
> Gesehen hat man es an einer Stelle, die leicht zu übersehen ist:
> In der **Adresszeile** des Bildschirmfotos stand die fremde Domain.
> Wer nur die Fehlermeldung liest, sucht in der falschen Datei.

Zwei Lehren:

- **Vor jeder Fehlerbehandlung die Frage: Kann dieser Zweig überhaupt
  erreicht werden?** Eine Bibliothek, die die Seite verlässt, gibt
  nichts zurück, was man fangen könnte. Wo das droht, den Sprung
  selbst machen (`skipBrowserRedirect`), sonst ist alles darunter
  Zierrat.
- **Vorher fragen schlägt hinterher übersetzen.** Ein Weg, den es
  nicht gibt, wird gar nicht erst angeboten — und die Frage danach
  darf **fail-open** sein: Kommt sie nicht durch, bleibt der Weg
  stehen (§7).

Und die Prüfung dazu: `pruef-konto-start.js` erwähnte Google mit
keiner Zeile. Eine Seite, die eine Prüfung hat, ist nicht geprüft —
geprüft ist, was in der Prüfung **vorkommt**.

### 8.1i Zwei Hälften, jede gegen eine Erfindung der anderen geprüft

> **Vorfall, gemeldet vom Betreiber — nicht von einer der 30
> Prüfungen.** Der Gast konnte nicht stornieren: „Das geht hier gerade
> nicht." Der Hub schickte die UUID der Zeile (`zeile.id`), die
> SQL-Funktion suchte über die Quittungsnummer
> (`where gast_kennung = nummer`). Eine UUID ist nie eine
> Quittungsnummer — also nie ein Treffer, also `grund:'unbekannt'`.
>
> **Derselbe Fehler stand ein zweites Mal**, in `bestellung_restzeit`.
> Dort fiel er **stumm** aus: kein Text, kein Zeichen, der Countdown
> erschien einfach nie. Niemand hat ihn gemeldet, weil nichts fehlte,
> was jemand kannte.
>
> Warum keine Prüfung ihn fand: `pruef-storno.js` **stellt die
> Serverantwort nach** (`page.route`), `pruef-rechte.sql` prüft die
> SQL für sich allein. Beide waren grün. Jede Hälfte war gegen eine
> **Erfindung** der anderen geprüft, und die Erfindungen waren sich
> einig, während die Wirklichkeit es nicht war.

Wo ein Wert die Grenze zwischen zwei Systemen überquert, muss die
**Grenze selbst** gemessen werden — nicht jede Seite für sich. Am
besten am Stück gegen ein echtes Postgres; geht das nicht, wenigstens
die beiden Quelltexte gegeneinander (`pruef-naht.js`).

Zwei Regeln, die dabei abfielen:

- **Ein Fehler, der stumm ausfällt, wird nicht gemeldet.** Der Storno
  schrie und wurde gefunden; die Restzeit schwieg und blieb monatelang
  kaputt. Wer einen Ausfallweg baut, überlegt, ob dabei jemand etwas
  merken kann.
- **Derselbe Griff steht selten nur einmal da.** Der Fund im Storno war
  erst vollständig, als `grep` dieselbe Zeile in einer zweiten
  Migration fand. Nach jedem Befund: den Griff im ganzen Verzeichnis
  suchen, nicht nur die gemeldete Stelle reparieren.

### 8.1m Was gespeichert, aber nie gelesen wird, wird mit Leere überschrieben

> **Vorfall, gemeldet vom Nutzer mit Bildschirmfoto.** Nach dem
> Neuöffnen war das Banner-Rad im Board leer, obwohl im Hub ein Banner
> lief. `betriebeHolen()` fragte `hub_banner` nie ab — das Board
> startete jedes Mal mit einer leeren Liste. Ein Tipp auf
> „Übernehmen“ hätte den laufenden Banner in der Datenbank gelöscht.
> Die Prüfung des Rads war grün: Sie legte Banner im Board an und las
> sie im selben Durchgang zurück, ohne je neu zu laden.

Zwei Regeln:

- **Zu jedem Schreibweg gehört ein Leseweg, und die Prüfung geht über
  ein Neuladen.** Wer nur im selben Durchgang zurückliest, prüft den
  Speicher des Browsers, nicht die Datenbank.
- **Ein Formular, das eine ganze Liste ersetzt, darf erst schreiben,
  wenn es die alte gelesen hat.** Nicht gelesen heißt nicht „leer“,
  sondern „unbekannt“ — `undefined` statt `[]`, und „Übernehmen“ bleibt
  gesperrt, bis der Stand da ist.

### 8.1n Jede Tür mit einer Sperre braucht ihren eigenen Weg hinaus

> **Vorfall, gemeldet vom Nutzer mit Bildschirmfoto — er stand vor der
> eigenen Zentrale.** Drei Fehlversuche, Sperre. Die Meldung sagte
> „Entsperren: am Bestell-Board auf ‚Passwort vergessen‘ tippen“ — in
> der Zentrale selbst gab es keinen solchen Knopf. Und hätte er den
> Link doch bekommen: master.html fragte nie nach dem neuen Passwort.
> supabase-js meldet aus dem Link eine ganz normale Sitzung, die Seite
> öffnete das Dashboard, das Passwort blieb das alte, die Sperre auch.
> Board und Konto hatten den Weg längst; die dritte Tür war beim
> Einbau der Sperre vergessen worden. Im Feld darüber stand
> `placeholder="hallo@omoteno.de"` — die Adresse des echten Kontos,
> öffentlich, und auf iOS fast weiß, als wäre sie eingetragen.

- Wer eine Sperre an eine Anmeldung hängt, baut den Rückweg an
  **dieselbe** Seite: „Passwort vergessen?“, Rücksprung auf diese
  Adresse (`redirectTo`), und `type=recovery` VOR `createClient`
  merken — danach steht es nicht mehr in der Adresse.
- Ein Platzhalter ist Text auf einer öffentlichen Seite. Keine echte
  Adresse, kein echter Name darin.
- Der Rückweg hängt an Einstellungen, die nicht im Verzeichnis stehen
  (Site URL, erlaubte Rücksprung-Adressen, Mailversand in Supabase).
  Die Prüfung stellt die Antwort — ob die Mail ankommt, zeigt nur ein
  echter Versuch.

### 8.1d Ein Board im Vollbild ist eine eigene Umgebung

> **Vorfall.** Das Küchen-Board hatte einen Vollbildknopf, das
> Admin-Board keinen — gemessen bei 1280, 1920 und 2560 Pixeln. Und
> der vorhandene Knopf wusste nicht, ob er an ist: kein
> `fullscreenchange`-Horcher, kein `aria-pressed`. Chrome verlässt
> den Vollbildmodus bei Escape und gibt der Seite den Tastendruck
> **trotzdem** — ein Druck schließt also den Dialog UND wirft heraus.
> Der Koch stand danach wieder im Browserrahmen und wusste nicht,
> warum. Dazu: `main` blieb bei 1280 px stehen, auf einem
> 2560-px-Schirm war die Hälfte leer.

Ein Schirm an der Wand ist kein Tablet in der Hand. Wer etwas für den
Betrieb baut, prüft es auf der Fläche, auf der es hängt:

- **Der Zustand gehört ans Element.** `fullscreenchange` beobachten,
  `aria-pressed` nachziehen. Ein Schalter ohne Stellung ist keiner.
- **`documentElement` in den Vollbildmodus schicken**, nie einen
  Teilbaum: Alles außerhalb wird sonst schlicht nicht gezeichnet.
- **`window.open` ist im Vollbild tot.** Ein zweites Fenster öffnet
  dahinter oder gar nicht. Was drucken soll, druckt aus einem
  versteckten `<iframe>` im selben Dokument.
- **Vollbild kann nicht von selbst starten.** Der Browser verlangt
  eine Geste, und das lässt sich nicht umgehen. Man kann sich die
  Absicht merken und die erste beste Geste nehmen — mehr nicht, und
  mehr sollte man auch nicht behaupten.

Die ehrliche Grenze dazu: Der kopflose Browser hat keinen
Browserrahmen, den er verstecken könnte. Er prüft die
Fullscreen-API und das Verhalten der Seite, nicht Chrome am Tresen.
Der Escape-Fall bleibt ungeprüft — deshalb hängt nichts daran.

### 8.1o Ein leerer Anfangszustand vor dem ersten Laden sieht aus wie ein Fehler

> **Vorfall, gemeldet vom Nutzer mit Bildschirmfoto.** „Figur des
> Hauses" im Board zeigte nichts — leer. `AVATARSTAND` stand als
> `let AVATARSTAND = null;` bis zum ersten `avStandLaden()`, und
> `avZeichnen()` bricht mit `if(!AVATARSTAND) return;` sofort ab.
> Isoliert nachgestellt lief der Weg fehlerfrei durch — der genaue
> Auslöser (Race, alter Zwischenspeicher, ein Aufruf, der ausblieb)
> ließ sich nicht abschließend fassen. Behoben wurde die **Wirkung**:
> ein nie-`null`-Vorgabewert (`{ figur: AV_FIGUREN[0].s, art:
> "freundlich", haende:{…} }`), den `avAusZeile()` beim ersten
> richtigen Laden ohnehin ersetzt.
>
> Zugleich der zweite Wunsch aus derselben Meldung: „übersichtlich und
> ausklappbar, was für Gesten oder Gegenstände sie wann halten".
> `avZeichnen()` wurde von einer flachen Liste (`.avgruppe`) auf drei
> zugeklappte Zeilen umgebaut (`.kbzeile`/`avAufKlappKopf`/
> `avKlappHuelle` — dasselbe Baumuster wie der Kachel-Baukasten, nicht
> neu erfunden), die Hände-Zeile mit drei `.avunter`-Unterzeilen, eine
> je Bestellphase. Das Rad darin (`.avspur`/`.avstueck`) blieb
> unverändert. `pruefungen/pruef-figur-board.js` erwartete noch die
> alte flache Struktur (`#avListe .avgruppe`) — Gegenbeweis in einem
> `git worktree` (§8.1k) mit dem alten Assertion-Code hätte grün
> gemeldet, obwohl das Board unbedienbar wäre: genau der Fehlschluss
> aus §8.1a, nur diesmal in der Prüfung selbst. Die Prüfung wurde auf
> die neue Struktur umgeschrieben — inklusive eines echten Tipps auf
> `[data-av-auf]`, wie es der Kachel-Baukasten schon vormacht, denn
> zugeklappt hat ein Rad keine Höhe und ist mit dem Finger nicht
> erreichbar (Tapflächen-Messung also erst NACH dem Öffnen).

Ein Vorgabewert schließt die Symptom-Lücke sofort — er entbindet
nicht davon, die eigentliche Ursache zu suchen, wenn sie sich fassen
lässt. Und: Wer die Zeichenfunktion eines geteilten Board-Bausteins
umbaut, muss jede Prüfung, die dessen alte CSS-Klassen im Namen trägt,
mitziehen — sonst prüft sie ab sofort eine Struktur, die es nicht mehr
gibt, und meldet trotzdem grün.

### 8.1p Ein verzögerter Schreibvorgang kann etwas wiederbeleben, das gerade gelöscht wurde

> **Vorfall, im eigenen Test gefunden, bevor er live ging.** Der
> Entwurf-Zwischenspeicher fürs Gericht-Blatt (`entwurfSchreiben()`,
> 500 ms entprellt, klick- UND tippgetrieben) und das echte Speichern
> (`sichern()`, löscht den Entwurf nach dem Server-Aufruf) laufen
> nebeneinander her, ausgelöst vom selben Klick auf „Speichern“: Der
> Klick selbst zählt schon als Tipp-Ereignis und plant einen neuen
> Entwurf-Schreibvorgang, während `sichern()` parallel zum Server
> unterwegs ist. Kommt die Serverantwort schneller als die 500 ms
> zurück, feuert der geplante Schreibvorgang NACH dem Löschen — und
> legt den gerade gelöschten Entwurf wieder an. Der erste Test (ohne
> künstliche Verzögerung) sah das nicht: Auf localhost war der
> „echte“ Speichervorgang (Vorführmodus, kein Netz) schneller fertig
> als die 500 ms, und die Probe wäre grün gewesen, obwohl die Lücke
> längst da war (§8.1g: eine Probe muss den Fehler auch treffen
> können, nicht nur zufällig daran vorbeilaufen).

Die Abhilfe: Der Schreibvorgang prüft seine Voraussetzung ZWEIMAL —
einmal beim Planen (ist das Blatt offen?) und **erneut beim Auslösen**,
nicht nur beim Planen. Dazwischen kann geschlossen oder gelöscht worden
sein, und nur die zweite Prüfung sieht das noch. Jeder entprellte
Schreibvorgang, der neben einem expliziten Löschen herläuft, braucht
diese zweite Prüfung — sonst gewinnt manchmal der ältere, verspätete
Schreibvorgang gegen die neuere, eigentlich maßgebliche Löschung.

### 8.1q Was später gesendet wird, wird beim Einreihen eingefroren

> **Vorfall, beim Lesen vor dem Bau gefunden.** Die Bestellung des
> Gastes wartet zuerst im Gerät (Warteschlange) und geht dann an den
> Server — Name, Menge, Preis. Die Extras (Toppings, Aufpreis) las der
> Sender erst **beim Senden** aus einer Variablen, die nur im Speicher
> lag. Lud der Gast die Seite neu, bevor die Bestellung durch war,
> ging sie ohne Extras und ohne Aufpreis an die Küche; stellte er
> vorher an einem anderen Teller etwas um, bekam die wartende
> Bestellung dessen Wahl. Jede Prüfung war grün, weil keine zwischen
> Abschicken und Ankommen neu lud.

Was eine Warteschlange, ein Entwurf oder ein Wiederholungsversuch
später abschickt, trägt **alles** in sich, was beim Abschicken galt —
nicht einen Verweis auf einen Zustand, der sich bis dahin ändern
kann. Die Prüfung dazu geht genau den Zwischenweg: abschicken, Server
stumm, neu laden, etwas anderes wählen, zweiter Versuch — und liest
die Nutzlast, die wirklich hinausgeht.

### 8.2 Eine Prüfung, die nicht startet, ist keine

> **Vorfall.** `pruef-kontrast.js`, `pruef-import.js` und
> `pruef-ueberlauf.js` lasen `omoteno-marken-studio.html`,
> `omoteno-admin.html` und `omoteno-landingpage.html`. Alle drei
> Dateien heißen längst anders. Die Skripte fielen beim Start mit
> ENOENT um — drei von fünf Einträgen der Tabelle oben waren tot,
> und in der Prüfliste stand trotzdem, dass sie laufen.

Nach jeder Umbenennung: **jedes** Prüfskript einmal starten, nicht nur
das, an dem man gerade arbeitet. Skripte suchen ihre Datei neben sich
und nennen im Fehlerfall alle Namen, unter denen sie gesucht haben.

> **Eine Lehre über Prüfwerkzeuge selbst.** Die erste Fassung meldete
> `id="melde"` als Fehler — die Kennung steht in sieben Seitenvorlagen,
> von denen immer nur eine gezeichnet wird. Ein Werkzeug, das
> Fehlalarme schlägt, bringt einem bei, es zu übergehen. Dann nützt es
> gar nichts mehr. Deshalb trennt es jetzt zwischen festem
> Auszeichnungstext (Fehler) und Skriptvorlagen (nur ein Hinweis).

Dazu je nach Änderung:

| Geändert | Zusätzlich laufen lassen |
|---|---|
| Farben, Paletten, Vorlagen | `pruefungen/pruef-kontrast.js` |
| Karten-Zerleger | `pruefungen/pruef-import.js` |
| Marken-Studio, Entwurfslink | `pruefungen/pruef-studio.js` |
| **"Marke gestalten" im Board, Entwurfslink-Bridge** | `pruefungen/pruef-marke.js` — Rundlauf und die echte Naht: die im Board erzeugte Adresse wirklich im echten `marken-studio.html` geöffnet |
| Gastkonto, „Mein Tisch" im Hub | `pruefungen/pruef-gastkonto.js` (braucht `dist/`) |
| Figur des Hauses, Requisiten, Bestellpass | `pruefungen/pruef-figur.js` (braucht `dist/`) |
| **Figur/Stimmung/Requisiten wählbar im Admin-Board, ausklappbare Zeilen** | `pruefungen/pruef-figur-board.js` (braucht `dist/`) — Zweite Quelle gegen AVATAR_FIGUREN/AVATAR_ZUEGE/E_REQUISITEN und ZUGNAMEN, drei zugeklappte Zeilen (Figur/Stimmung/Hände mit drei Unterzeilen je Phase), jede beginnt zu, echter Tipp auf den Kopf öffnet sie wirklich, Rad im Board erst nach dem Öffnen bedient, Vorrang hub_avatar vor Markenblatt, stiller Rückfall bei unbekanntem Wert — im Board UND im Hub selbst |
| **Vegetarisch/Vegan als Merkmal, eigenes Zeichen** | `pruefungen/pruef-gericht-merkmale.js` (braucht `dist/`) — Board: Vegan schaltet Vegetarisch automatisch mit ein, Vegetarisch ausschalten nimmt Vegan mit; Hub: veganes Gericht zeigt NUR das Vegan-Zeichen (schließt Vegetarisch ein), nur-vegetarisches nur sein eigenes, keins ohne gesetztes Merkmal |
| **Entwurf-Zwischenspeicher im Gericht-Blatt** | `pruefungen/pruef-gericht-entwurf.js` — Entwurf übersteht Abbrechen UND Tafelwechsel, Hinweis sichtbar, „Verwerfen“ setzt zurück, kein Geisterentwurf nach echtem Speichern trotz des 500-ms-Wettlaufs (§8.1p) |
| **Foodroulette (die umbenannte Entscheidungshilfe), hub_stil-Sichtbarkeit** | `pruefungen/pruef-foodroulette.js` (braucht `dist/`) — Board-Schalter führt hub_stil zusammen statt zu ersetzen (Nachbarn wie emoji/restzeit bleiben), Hub: Standard an, „aus“ blendet die CTA aus UND leitet einen direkten Aufruf von `#/entdecken` fail-open zur Speisekarte um, strikt boolean (Zeichenkette „false“ bleibt an) |
| **Foodroulette: Glücksrad UND Karten wischen, Umschalter (Rad, Drehen, Ergebnis oben, Lust-Chips, Extras)** | `pruefungen/pruef-foodroulette-rad.js` (braucht `dist/`) — beide Häuser, Uhr fest: **Umschalter** wie der Liefer-Schalter (zwei Wege ≥ 44 px, ohne gemerkte Wahl das Rad, ein Tipp schaltet und DERSELBE Schalter bleibt mit gleitendem Daumen, Name blitzt auf und geht, gemerkt über Neuladen, Pfeiltaste wechselt ohne eine Karte zu wischen, Umschalten mitten in der Drehung beendet sie sauber, „Für mich entscheiden“ aus der Kartenansicht führt zum Rad und dreht, reduzierte Bewegung ohne Gleiten, Name in jeder Sprache im Bild bei 360 px); Rad sofort ganz im Bild (390×844), Ergebniskarte darüber, beim Öffnen dreht nichts; EIN Tipp in der Speisekarte → Seite wechselt UND das Rad dreht; während der Drehung ≥ 3 Namen oben, alle vom Rad; **Landung am gezeichneten Rad gemessen** (höchstes Feldzeichen, nicht die Rechnung des Hubs) = Name oben = Gericht hinter „Nehm ich!“, 5 Drehungen, jedes Mal ein anderes; nur `transform`, 2–4 s, Doppeltipp keine zweite Bewegung; „Nehm ich!“ legt genau dieses Gericht in `merk`; Extras (echte Choco-Namen) nie auf dem Rad, auch nicht in „Für die Runde“ über 30 Drehungen; kleine Kategorie aufgefüllt (≥ 6 Felder, nie zwei gleiche nebeneinander), jeder Lust-Chip ≥ 2 Gerichte; reduzierte Bewegung: keine Animation, Rad steht sofort richtig; 360/390/430 px hell/dunkel: Kontrast ≥ 4,5:1, Tapflächen ≥ 44 px, kein Überlauf; kein Gerichtname oben abgeschnitten (jedes Gericht, 360 px) |
| Texte im Hub, Sprachen | `pruefungen/pruef-sprache.js` |
| **Irgendein Text, den ein Gast liest** | `pruefungen/pruef-uebersetzung.js` (braucht `dist/`) — zweite Quelle, jede Sprache am gemalten Bild, Anrede, und der Weg aus dem Board |
| Freie Texte des Betriebs, Bestellpass, Begleitersatz | `pruefungen/pruef-texte.js` (braucht `dist/`) |
| **Schriften (Auswahl, eigener Import), Schriften der Seiten** | `pruefungen/pruef-schriften.js` (braucht `dist/`) — zweite Quelle: SCHRIFT_WAHL (Board) = SCHRIFT_WEB (Hub) = Dateien in `auslieferung/schriften/` = LIZENZEN.txt, `_headers` und `bauen.js`; KEINE Seite lädt von Google (`<link>` in allen `seiten/*.html`), `seiten.css` zeigt nur auf vorhandene Dateien; Hub zeichnet die gewählte Schrift (computed style + `document.fonts.check`), latin-ext genau bei Bedarf, fremder Server/Anführungszeichen/javascript:/fremder Eimer/blob: werden nicht geladen (gemessen an den Anfragen); Board: Probe je Karte, umbenannte Bilddatei abgewiesen, echte Datei in der Vorschau vor dem Hochladen, Upload in den eigenen Ordner, `hub_stil` zusammengeführt (Emoji bleibt), gespeicherte Adresse passiert das Hub-Muster. DB: `datenbank/pruef-schriften.sql` |
| **Live-Vorschau im Board (Startseite, Ihre Worte, Aktion), Vorschaumodus des Hubs** | `pruefungen/pruef-vorschau.js` (braucht `dist/`) — die Naht am Stück: echtes Board lädt die echte Hub-Datei als srcdoc (nicht per src, X-Frame-Options bleibt DENY), Tippen in Banner/Kachel/Slogan/Aktionsname erscheint im Rahmen ohne „Übernehmen“, Fokus auf den Gruß zeigt den Willkommensschirm, Kürzungshinweis unter dem Feld nur, wenn der Hub WIRKLICH kürzt (Gegenfall kurzer Text), die Vorschau meldet keinen Besuch und schickt nichts ab, ist nicht bedienbar, kein Fehler in Board und Rahmen |
| **Textgrenzen (Banner, Kacheln, Slogan, Gruß, Aktionsname, Gutschein)** | `pruefungen/pruef-textplatz.js` (braucht `dist/`) — Grenzen aus dem Board gelesen (zweite Quelle, keine Zahl in der Prüfung), Texte an der Höchstgrenze mit echten Wörtern in beiden Häusern bei 360/390/430 px: nichts läuft seitlich über, Slogan ≤ 3 Zeilen, Bannerkarte bleibt 4:3 und ihr Text in der Karte, Kacheltext ≤ 2 + 3 Zeilen (aus den echten Zeilenhöhen gerechnet), Aktionsname ≤ 2 Zeilen, Gruß passt auf den Willkommensschirm. Die DB-Hälfte: `datenbank/migration-texte-laenger.sql` (gleiche Namen, nur gelockert) |
| **Allergene/Zusatzstoffe, Kennziffern-Zuordnung** | `pruefungen/pruef-stoffe.js` (braucht `dist/`) — Rundlauf admin.html ↔ hub.vorlage.html Ziffer für Ziffer, dazu die Überlauf-Prüfung (scrollWidth/scrollHeight) am längsten echten Zusatzstoff-Text |
| Farben, hell oder dunkel | `pruefungen/pruef-lesbarkeit.js` (braucht `dist/`) |
| **Kopfband-Schmuck (Guss/Laternen), neue Markenblatt-Varianten am Kopf** | `pruefungen/pruef-kopfband.js` (braucht `dist/`) — welches Band sichtbar ist je Haus, reduzierte Bewegung |
| **Zierrat (Bambus/Tuschekleckse/Pfingstrose), neue Markenblatt-Stile** | `pruefungen/pruef-zierrat.js` (braucht `dist/`) — nur beim gewählten Haus sichtbar, kein Leck in andere Häuser, kein horizontales Überlaufen bei mehreren Breiten, Tag/Abend |
| **Thema (feste Neueinfärbung eines einzelnen Hauses, z. B. "kaiserlich")** | `pruefungen/pruef-thema.js` (braucht `dist/`) — Schalter gesetzt, Rahmen/Knopf-Stil und Kopf-Schrift wirklich da, kein Leck in andere Häuser |
| **Helle Fassung von Board und Küche, gewählte Zustände, Anmeldung im Hellen** | `pruefungen/pruef-hell.js` — jedes Bedienelement (auch in versteckten Blättern) ohne schwarze, unbunte Fläche im Hellen; gewählte Zustände Schrift ≥ 4,5:1 und vom Nachbarn unterscheidbar; Gegenfall dunkel. Voraussetzung wird selbst geprüft (gewählte Stufe unter einer Bestellung, Spur und Einstellungen der Küche über die echten Griffe); dazu `#tor` (Anmeldung) bei HELLER Wahl UND dunklem Gerät (`colorScheme:"dark"` im Kontext) — Kontrast jedes Feldes, `color-scheme` folgt der Wahl statt dem Gerät, `-webkit-text-fill-color` ausdrücklich gesetzt |
| **Irgendeine Seite, irgendeine Palette** | `pruefungen/pruef-farbschema.js` — sagt jede Seite an, was sie zeigt? |
| **WLAN-Seite im Hub, WLAN-Felder im Board, QR-Code** | `pruefungen/pruef-wlan.js` (braucht `dist/`) — Passwort steht nirgends auf der Seite (Text UND Auszeichnung), genau zwei Knöpfe ≥ 44 px ≥ 4,5:1, keine Anleitung, „Kopieren“ legt GENAU das Passwort ab, der gezeichnete QR wird mit jsQR (`pruefungen/werkzeug/`) ZURÜCKGELESEN = WIFI:-Zeile mit ; , : " \\ und Umlaut, Bibliothek erst beim Tipp und mit integrity (veränderte Datei läuft NICHT, Satz statt QR), Platzhalter „BITTE-EINTRAGEN“ = leer, live schlägt Markenblatt, Grenzen aus `migration-wlan.sql`; Board: Felder in „Ihre Worte“ mit 16 px, Übernehmen behält die anderen Worte und umgekehrt, „Auf Vorgabe zurück“ lässt das WLAN |
| **Ladezeit, Dauer-Animationen, bewegte Zeichen beim Laden** | `pruefungen/pruef-leistung.js` (braucht `dist/`) — abends keine Dauer-Animation außer transform/opacity, gelesen auch aus den `@keyframes`-Regeln selbst (Chromiums `getKeyframes()` verschweigt animierte CSS-Variablen — der alte `ledLauf` war so unsichtbar) (Voraussetzung: Goldring läuft), `.blende` ohne backdrop-filter in Ruhe, auf einer nachgestellt LANGSAMEN Seite (ein Bild hält `load` 1,5 s auf) entsteht der erste Film erst nach `load` (lokal käme `load` sonst so früh, dass kein Film es überholen könnte), danach höchstens `BZ_ZUGLEICH` zugleich (8 s gezählt), Tipp spielt sofort, Kopf außer Sicht hält an und läuft zurück im Bild weiter |
| **Gericht-Blatt (Entwurf-Hinweis, Kategorie-Panel, Preis), Leisten unten im Hub, Laternen über Zurück, Marken im Foodroulette** | `pruefungen/pruef-fotofehler.js` (braucht `dist/`) — die Fehler aus den Fotos vom 10.10., je am gezeichneten Bild: Satz und „Verwerfen“ überlappen nicht, wiederhergestellter Preis „10,90“, Kategorie-Panel so breit wie die Zeile mit 13 echten Kategorien ohne eigenen Scrollbereich, ganz unten liegt jedes Antippbare über Ruf-Streifen + Auswahl-Leiste (Wache), Zurück unter den Laternen ohne Leerstreifen, keine Marke abgeschnitten |
| Landingpage | `pruefungen/pruef-web.js` — Ladezeit, Zeitbalken, beide Fenster |
| Impressum, Datenschutz | `pruefungen/pruef-recht.js` — Ladezeit, Lesbarkeit, Marke |
| Marken-Studio (Bedienung) | `pruefungen/pruef-studio-hand.js` — Rückgängig, Sprung, Schicken, aufklappbare Abteilungen (eine offen, Kopf ≥ 44 px mit Satz), kein Markenblatt-Code ohne `?fachleute=1` (gemessen bei OFFENEM „Fertig?“), Mausklick auf Reiter im schmalen Fenster, Griff zieht trotzdem |
| Auslieferung, Umleitungen | `erzeuger/bauen.js` und dann `pruefungen/pruef-lieferung.js` |
| **Startkacheln, Bereiche, Markenblatt, iconAus-Schalter** | `pruefungen/pruef-kacheln.js` — Kreuzvergleich: kein Hub trägt fremden Text; iconAus schaltet nur das Symbol ab (strikt `=== true`, keine Zeichenkette) |
| **Irgendetwas am Hub** | `pruefungen/pruef-durchgang.js` — geht den ganzen Weg des Gastes |
| **Irgendetwas am Hub** | `pruefungen/pruef-hub-hand.js` — Neuladen, jeder Bereich, jede Sprache, hell/dunkel |
| **Willkommensschirm, Vorfenster (Speisekarte direkt oder Hub)** | `pruefungen/pruef-vorfenster.js` (braucht `dist/`) — „Speisekarte ansehen“ springt ohne Umweg und schließt den Schirm mit, „Zur Übersicht“ und ein Tipp daneben bleiben beim Hub, tiefe Links (`#/speisekarte`) überspringen den Schirm ganz, beide Knopftexte wirklich übersetzt (nicht deutsch stehengeblieben) |
| **Gericht anlegen im Board (Blatt, „Mehr Angaben“, Speichern & nächstes)** | `pruefungen/pruef-gericht-schnell.js` — Ruhelage zugeklappt, Preis mit Komma, erkannte Allergene nur als Vorschlag (nichts von selbst gesetzt, Gegenfall ohne Treffer), Serienanlage behält Karte/Kategorie und leert den Rest, unlesbarer Preis speichert nicht und sagt warum |
| **Rabatt am Gericht, Aktionspreis in der Karte** | `pruefungen/pruef-rabatt-gericht.js` (braucht `dist/`) — Board schreibt in `aktionen` innerhalb jeder Schranke (zweite Quelle `datenbank/stand-aktionen-schranken.sql`), Hub zeigt neuen und alten Preis samt „−20 %“, „+“ legt zum Aktionspreis in den Korb und zieht nach Ende nach, Dauer-Rabatt nicht im Streifen, Plakette lesbar je Haus Tag/Abend |
| **Altersfreigabe 16+/18+ (Board, Hub, Küche)** | `pruefungen/pruef-altersfreigabe.js` (braucht `dist/`) — Alkohol aus dem Namen nur VORGESCHLAGEN, gegen die echten Getränkenamen (§6.1), Frage einmal je Stufe und Sitzung auch über zweiten Weg, „Wieder herausnehmen“ nimmt nur Betroffenes, Schirm entfernt statt versteckt, Küche „Ausweis 18+“ an der Position |
| **Sicherheit: Kopfzeilen, CSP, selbst ausgelieferte Bibliotheken, 429 an den Türen, Polling, offene anon-Funktionen** | `pruefungen/pruef-sicherheit.js` — lokaler Server mit den echten `_headers` (wie Netlify zusammengeführt): CSP/HSTS/DENY, `/lib/` immutable, keine Seite lädt fremdes Skript; elf Seiten ohne `securitypolicyviolation`; manipulierte `/lib/`-Datei wird nicht ausgeführt (integrity); HTTP 429 an Board, Konto, Küche, Master gibt einen Satz und KEINEN Login-Versuch (Gegenfall: erlaubt → Versuch); versteckter Tab fragt zehn Minuten nichts, zurück holt sofort; jede anon-Funktion aus `datenbank/stand-anon-funktionen.sql` gebremst oder namentlich begründet, und jede Funktion in `migration-schutz-2.sql` trägt ihre Bremse |
| **Übergang Kachel → Unterseite, Glas-Knopf „Zurück“** | `pruefungen/pruef-reise.js` (braucht `dist/`) — seit 10.10. schlicht und ohne Verzögerung (vorher 1154 ms bis zur Karte): Adresse wechselt im SELBEN Takt wie der Tipp, neue Seite gezeichnet < 130 ms, Ebene 180–320 ms beim ersten UND zweiten Öffnen, Fläche beginnt genau auf dem Rechteck der Kachel (± 2 px) und endet über dem Schirm, kein Text, nur transform/opacity (aus `getAnimations`), Licht = Farbe der Kachel; JEDE Kachel der echten Startseite startet die Ebene, Ebene am Ende ENTFERNT, `elementFromPoint` trifft die Seite; zweiter Tipp beendet sie und sein Klick trifft nichts auf der neuen Seite; reduzierte Bewegung ohne Ebene; Zurück-Pille je Sprache übersetzt (über das echte Menü), ≥ 44 px, Licht läuft (nur transform) und steht bei reduzierter Bewegung. Kontrast der Pille: `pruef-glas.js` |
| **Gemerkte Auswahl, Extras im Korb, „Wie letztes Mal“** | `pruefungen/pruef-merken.js` (braucht `dist/`) — Neuladen behält Extras und Aufpreis, ungültige Zeile fällt still weg, **Abschicken → Server stumm → Neuladen → zweiter Versuch trägt die Extras von damals** (nicht die neue Wahl), Karte „Nochmal“ mit Summe zum heutigen Preis (Aktion), ein Tipp füllt Korb samt Extras, Chip setzt nichts von selbst, Entfallenes genannt und weggelassen, Englisch, nichts davon im Netz, Uhr UND Öffnungszeiten selbst gesetzt (§8.1j) |
| **Storno, Restzeit, jede Bestell-Funktion** | `pruefungen/pruef-naht.js` — hält den Wert, den der Hub schickt, gegen die Spalte, über die die SQL sucht |
| **Top-Runner-Streifen, Empfehlung des Hauses, "Sofort bestellen"** | `pruefungen/pruef-sofort.js` (braucht `dist/`) — Klick auf den Streifen öffnet die Vorschau, der Sofort-Knopf bestellt zum AKTIONSPREIS statt zum Kartenpreis, stiller Rückfall ohne anklickbaren Knopf, wenn das Gericht nicht mehr in der Karte steht |
| **Top-Runner als Flash-Sale (Band, Streifen, Laufschrift), Feld „Laufschrift“ im Board** | `pruefungen/pruef-runner.js` (braucht `dist/`) — Grenze aus `datenbank/migration-laufschrift.sql` gelesen; Rabatt-Plakette aus preis_alt/preis_neu nachgerechnet; Name ≥ 20 px, Preis ≥ 24 px, Gericht rechts ≥ 90 px; Kennzeichnung bleibt genau der Titel; Laufschrift wandert von links nach rechts (zwei Zeitpunkte gemessen), Streifen/Laufschrift/Puls laufen, nur transform/opacity; eigener Text + Rabatt von selbst, nur als Text (Tag/onerror wirkungslos); aus hub_texte gekürzt, Nicht-Text verworfen; reduzierte Bewegung: nichts läuft; beide Häuser hell/dunkel 360–430 px: jede Schrift ≥ 4,5:1, **Bandschrift gegen Band UND Streifen** (aus `::before` gelesen), kein Überlauf, „+“ ≥ 44 px, Name ≤ 2 Zeilen; Board: Feld nimmt höchstens die DB-Grenze, Tippen schickt an die Vorschau (mit Beispiel-Aktion), Übernehmen legt in `hub_texte.laufschrift`, Zurück leert |
| **Irgendetwas am Board** | `pruefungen/pruef-board.js` — bedient das Board von Hand, und gleicht jedes Filter-Kästchen gegen die Stellen ab, die den Wert wirklich schreiben |
| **Klapp-Felder, Segmente, animierte Auswahl im Board** | `pruefungen/pruef-auswahlfeld.js` — Tapflächen ≥ 44px, echtes Feld bleibt Quelle der Wahrheit, Endzustand ohne Bewegung |
| **Auswertung, Umsatzziele, Export, Einstellungs-Übersicht, Figuren-Rad, Rundung (`--ecke`)** | `pruefungen/pruef-auswertung.js` — Rechnung mit gestellten Zeilen (Liefergebühr, Rabatt, storniert UND abgelehnt, Serviceruf), gleich langer Vorzeitraum, „nie bestellt“ gegen die Karte, Schwelle mit Gegenfall, Handeln trifft das richtige Gericht, Ziel „2.800“, CSV, Überlauf/Kachelhöhe/Tapflächen bei 360–1280 px, Schrift auf Glas über dem Schleier, jede Tafel scrollbar, Rad ohne Transition. Dazu `datenbank/migration-auswertung-ziele.sql` (Schranke mit EXECUTE, §2.7) |
| **Warenkorb, „Passt dazu“ (bis 6 Karten, „Im Korb“ mit −/+, „Mach es komplett“, Weg zur Schwelle, Rad am Ende), Liebling-Karte mit Menge** | `pruefungen/pruef-korb-vorschlag.js` (braucht `dist/`) und `pruefungen/pruef-sofort.js` — nichts Doppeltes, nichts ohne Preis, Getränk zuerst, aber nicht nur Getränke, „+“ legt wirklich hinein, getippte Tischnummer bleibt, Englisch; **nach „+“ bleibt die Karte** („Im Korb“, −/+ je ≥ 44 px, zählt in Karte UND Korbzeile, zweimal „−“ nimmt heraus) **und die Reihe ordnet sich nicht um**; „Mach es komplett“ = dringendster Vorschlag + erstes aus der anderen Welt (Getränk ↔ Essen), Summe mit Aktionspreis, „Beides dazu“ legt beide hinein, danach kein zweites Angebot; Schwelle (frei ab / Mindestwert) als Satz mit Rest und Balken im richtigen Anteil, ohne Schwelle oder darüber kein Balken; Rad als letzte Karte öffnet Foodroulette und dreht; Kontrast jeder Schrift in „Passt dazu“ hell und dunkel (mit und ohne Kombi), 360/430 px ohne Überlauf; **Vielfalt**: höchstens eine je Gruppe (auch mit Fotos, ohne Emoji), kein Grund öfter als zweimal, derselbe Korb dieselbe Reihe, andere Körbe andere, „Im Angebot“/„Neu für Sie“ je mit Gegenfall, Satz passt zum Korb; **Details**: Korbzeile und Vorschlagskarte öffnen das Blatt der Karte (Allergene), Herausnehmen im Blatt stimmt nach dem Schließen in der Auswahl; auf der Liebling-Karte liegt kein Text unter dem Knopf (Zeilen-Rechtecke gemessen) |
| **Board oder Küche, Vollbild, Fern-Ansicht** | `pruefungen/pruef-vollbild.js` — beide Boards, drei Schirmgrößen, geteilter Block |
| Meldungen, Service Worker | `pruefungen/pruef-push.js` — sw.js wird ausgeliefert und meldet |
| **Rechte, Regeln, Funktionen in der Datenbank** | `datenbank/pruef-rechte.sql` — im SQL-Editor, dreht sich selbst zurück; TEIL 8 **Besitzer/Team** (läuft VOR Teil 7, sonst sieht das Probe-Team ohne PIN nichts): Team ändert Hub-Text/Preis nicht, Pause/Pausentext/Ausverkauft schon (§2.7), legt kein Gericht/keine Aktion/keinen Gutschein/kein Bild/keinen Profi-Foto-Auftrag an, löscht nichts — jeweils erst nachdem die Voraussetzung „Team SIEHT die Zeile“ gemessen ist; Inhaber darf alles, fremder Betrieb 0 Zeilen; TEIL 9 **Gutscheine/Codes**: Team mit Recht über Grenze/Tageslimit/falsche PIN abgewiesen, Code vom Server mit Name aus `auth.uid()`, direkt in die Tabelle abgewiesen, anon rät gebremst ohne Ausnahme, und ob der alte Weg ohne PIN noch offen ist |
| **Bestellwege des Gastes, Bremsen, Quarantäne (`pruefen`)** | `pruefungen/pruef-schutz.js` — Hub zeigt bei Bremse einen lesbaren Satz statt JSON, Küche holt `pruefen` und zeigt Markiertes NICHT als Bon (Kopfzeile „wartet auf Freigabe“), Board gibt über genau diese Spalten frei oder verwirft, Auswertung zählt Markiertes nicht. Die DB-Hälfte: `datenbank/pruef-missbrauch.sql` — zurückgedreht, gestellte Herkunft über `cf-connecting-ip` mit gefälschtem `x-forwarded-for` (§2.3e): Preis aus der Karte statt vom Gast, erfundenes Gericht markiert, Gerät/Netz/Tisch markiert vor abgewiesen, Anfragen/Ereignisse/Reservierungen/Gastzeilen/Adressen je Netz gebremst, und keine IP-Adresse im Zähler |
| **Servicerufe/Anfragen des Gastes (höchstens 4 in 10 Minuten), gebündelte Rufe im Board** | `pruefungen/pruef-anfragen.js` (braucht `dist/`) — Naht: Grenze 4 und Fenster 10 min in Hub und `migration-anfragen-bremse.sql` gleich, HINT `bremse:<Min>` hier gesetzt und dort gelesen, Serviceruf schickt `p_geraet` (vorher nie) und nur Parameter von `bestellung_aufgeben`, gezählt aus Zeilen statt Zähler (§2.3g); Hub mit gestelltem Server: Ruf 1–4 hinaus, Ruf 5 nicht (auch nach Neuladen), Server-Abweisung → Satz mit SEINEN Minuten, anderer Fehler → alter Satz, Englisch; Board: Rufe eines Tisches gleichen Standes = eine Karte „n Rufe“, Gründe gezählt, Zusage/Fertig schreiben ALLE (eine `.in`-Anfrage), Einzelruf weiter `.eq(id)`, Ausfuhr zählt jede Zeile. DB-Hälfte: zurückgedrehte Probe im Kopf der Migration |
| **Besitzer/Team im Board, „Nur der Besitzer kann das ändern“** | `pruefungen/pruef-rollen.js` — über den ECHTEN Weg (gestelltes `db` antwortet auf `betrieb_mitglieder` mit `rolle`, dann `betriebWaehlen()`); zweite Quelle: JEDE Einstellungsgruppe steht in genau einer Liste (Besitzer/Team), eine neue Gruppe ohne Entscheidung wird rot; Team: Satz in jeder Besitzer-Gruppe, kein Bedienelement erreichbar, echter Tipp auf „Lieferung an“ ändert nichts (Zustand vorher lesbar, §8.1g), Karte ohne Bearbeiten/Verschieben/Anlegen, Kategorienkopf öffnet nichts und sagt warum, „Verfügbar“ schreibt NUR `verfuegbar`, Server-Abweisung als Satz; Küche wie Team, fehlende Rolle wie Inhaber (§7); Wechsel Team-Betrieb → eigener Betrieb hebt jede Sperre auf. Die Durchsetzung selbst: `datenbank/pruef-rechte.sql` TEIL 8 |
| **„Dein Team“ im Konto (einladen, Rolle, Gutschein-Recht, entfernen), Edge Function team-zugang** | `pruefungen/pruef-team.js` — zwei zweite Quellen: jeder Grund, den `team-zugang` mit `fehler("…")` zurückgeben kann, hat auf der Seite einen Satz (Ausnahmen namentlich), GRENZEN der Funktion = CHECK `betrieb_mitglieder_grenzen`; Nutzlast je Aktion (Betrieb, Person, Rolle), ohne Mailversand erscheint der Link einmal, Grenze/letzter Inhaber als Satz, eigene Zeile ohne Rolle/Entfernen, Entfernen erst beim zweiten Tipp; Grenzfelder nehmen „7,5“ (Text, kein `type=number`) und schicken leer/unlesbar NIE (sonst stille 0 €) — dieselbe Abwehr in `zahl()` der Funktion, aus ihrem Quelltext geprüft; Team sieht nur einen Satz; 16 px, 44 px, 360 px. Die Datenbankhälfte: zurückgedrehte Probe in `migration-team.sql` |
| **„Wer hat was geändert“ (Protokoll), neue Spalte an betriebe/gerichte/aktionen/gutscheine/rabattcodes** | `pruefungen/pruef-protokoll.js` — zweite Quellen: `datenbank/stand-spalten-protokoll.json` (live gelesene Spalten) — jede hat im Board ein Wort (AE_FELD) oder steht in `v_ruhig` der Migration, sonst stünde „änderte ziel_gericht_name“ im Verlauf; `team-zugang` trägt Einladen/Ändern/Entfernen ein, mit dem GEPRÜFTEN Aufrufer als Person; Board: Sätze statt Spaltennamen (Preis mit €, ausverkauft, Bestellpause, Einladung, Löschen), Name und Ziel als Text (Gegenbeweis: `innerHTML` → `onerror` lief), Abfrage nur dieser Betrieb, neueste zuerst, Gleichstand nach `id` (§2.6), Seiten zu 50, fehlende Tabelle als Satz. Die Trigger selbst: zurückgedrehte Probe in `migration-protokoll.sql` (NUR Mitläufer → keine Zeile, abgewiesene Änderung → keine Zeile, ohne Anmeldung → keine Zeile) |
| **Zweiter Faktor (PIN), PIN-Schirm in Board/Küche/Master** | `pruefungen/pruef-pin.js` — geteilter Block in drei Dateien Zeichen für Zeichen gleich, Felder und Gründe gegen `migration-pin.sql` gehalten, Schirm nach Passwort UND bei gemerkter Sitzung, vor der PIN wird nichts geladen, Master prüft die Rolle erst danach, gesperrt/keine PIN ohne Eingabefeld, Server stumm → kein Schirm; Kontrast, 16 px, Tapflächen, 360 px. Die Erzwingung selbst: `datenbank/pruef-rechte.sql` TEIL 7 (ohne PIN 0 Zeilen, andere Anmeldung 0 Zeilen, §2.7 andere Spalte) |
| Konto, Anfrageformular, **Google-Knopf** | `pruefungen/pruef-konto-start.js` — ohne Netz, 16px, tote Links, Anbieterliste |
| **Alessia, der Telefonweg (Edge `alessia-bestellung`, `bestellung_telefon`, `alessia_wissen`, Erzeuger je Betrieb)** | `pruefungen/pruef-alessia.js` — führt die ECHTE `index.ts` aus (typescript, gestelltes Deno/fetch, gestellte Vapi-Nachricht): ohne/falsches Geheimnis kein einziger Datenbankaufruf, das Ziel kommt NUR aus der Anrufinfo (ein „gerufene_nummer/betrieb“ vom Sprachmodell wirkungslos, Gegenfall ohne Nummer → keine Bestellung), karte_lesen/bestellen → richtige Funktion, mehrere Aufrufe → je toolCallId, kein Preis vom Telefon, Absagen als Satz; Naht: gesendete Felder = Parameter in `migration-telefonbestellung.sql`, `alessia_wissen` gibt nur öffentliche Felder; je Betrieb aus `erzeuger/erzeuge-alessia.js`: alle Schutzregeln, nur der eigene Name, Werkzeuge/Argumente = was `index.ts` liest, nur Platzhalter fürs Geheimnis, `dist-alessia/` nie ausgeliefert. Die DB-Hälfte (Trennung der Häuser, Preis, Doppelanruf, Bremse, Wache „nur Master“ mit testweise geöffnetem Recht) steht als zurückgedrehte Probe in der Migration |
| **Master-Board „Alessia am Telefon“** | `pruefungen/pruef-master-alessia.js` — Karte je Betrieb (Nummer, Assistent, Ton, Nimmt an/Aus/Keine Nummer, letzte Bestellung, 7 Tage), Name nur als Text, Einrichten mit gespeicherten Werten, Speichern schickt genau Parameter und Schlüssel von `master_alessia_setzen` (aus der SQL gelesen), vergebene Nummer als Satz, fehlende Migration als Satz |
| **Telefonbestellungen** | `pruefungen/pruef-telefonbon.js` — kommt der Bon in der Küche an |
| **Zugesagte Zeit, Countdown in Küche und Hub** | `pruefungen/pruef-zusage.js` (braucht `dist/`) — beide Seiten, und der Fall „Migration fehlt noch"; dazu die Wahl **„Bestellstand beim Gast“** (`hub_stil.restzeit`): „Nur Stand“ zeigt weder im Streifen noch im Kasten Minuten, die Stufen bleiben; strikt boolean (Zeichenkette "false" = an); der Streifen aus dem Gerätespeicher wird nach dem Laden der Wahl neu gezeichnet; Board führt `hub_stil` zusammen (emoji, schrift bleiben) |
| **Kachel-Raster im Hub: Breite, Selbst-Füllen, Farbe, Bildform, ohne Symbol** | `pruefungen/pruef-kachelraster.js` (braucht `dist/`) — Packen als Rechnung (allein → ganz, zwei → halb/halb, Reihen gehen immer auf), Standard wie vorher (drei Säulen), „nur Speisekarte“ zieht sich breit, Positivliste für raster/stil/farbe/breite/bildform (Anführungszeichen MIT Bild), Schrift ≥ 4,5:1 auf jeder Farbe inkl. Mittelgrau, „flaeche“ über rein weißem Foto ≥ 4,5:1, „rund“ ist ein Kreis statt Symbol, ohne Symbol: Strich, größere Schrift, Säule unten bündig (Säule mit Nachbarn, sonst keine Säule), 360–1280 px, zwei Häuser, Uhr fest auf 14 Uhr; **Board**: geteilter Block KACHELRASTER Zeichen für Zeichen gleich (Anordnung rechnet wie der Hub), Zeilen starten zugeklappt und kompakt, Tipp auf den Namen in der Anordnung öffnet genau diese Zeile, Griff mit Maus UND Finger (CDP-Touch, Seite rollt nicht mit), Pfeiltasten, „allein in der Reihe“ wird gesagt, Farbe/eigene Farbe/Bildform/Breite gehen in `kbRoh`, Zuschnitt folgt der Bildform, Zeile bleibt nach einer Wahl offen — geöffnet über den ECHTEN Tipp (über `kbOffen` direkt war der Gegenbeweis grün); **Umsortieren**: langer Druck auf den Namen (Maus UND Finger) tauscht innerhalb der eigenen Gruppe, bleibt an der Gruppengrenze stehen (kein Sprung in eine fremde Gruppe — jede Gruppe ihr eigenes `.kbr-gitter`), ein kurzer Tipp öffnet weiterhin nur die Einstellungen (kein Doppel-Klick nach echtem Zug), Pfeil-Knöpfe als Zweitweg tauschen mit dem Nachbarn und sind an den Gruppengrenzen deaktiviert, `prefers-reduced-motion` überspringt das Nachrücken, Endposition stimmt trotzdem; **Zuschnitt** (Kachel UND Banner) mit zwei echten Fingern (CDP, zwei Kontaktpunkte): hineinzoomen bis 3×, Regler läuft mit, der Bildpunkt unter den Fingern bleibt dort — ABSEITS der Mitte gemessen (in der Mitte bliebe er auch bei naivem Zoom liegen), ein Finger schiebt, Zusammenkneifen lässt keinen Rand, Mausrad zoomt |
| **Kacheln, Symbole, Banner, Baukasten im Board** | `pruefungen/pruef-baukasten.js` (braucht `dist/`) — zweite Quelle, Zuschnitt, Schrift nie auf dem Bild |
| **Besuchsbild, Sterne, Foto** | `pruefungen/pruef-besuchsbild.js` (braucht `dist/`) — Sterne auf der Leinwand, Bild aus der Karte |
| **Fenster, Blätter, Wischgeste** | `pruefungen/pruef-wischen.js` (braucht `dist/`) — Hub, Board und Küche, auch mit reduzierter Bewegung; dazu mit echtem Finger (CDP-Touch): kein zweiter Scrollbereich im Kategorie-Blatt, Wische rollen bis „Sichern", gescrollt schließt ein Wisch nach unten NICHT, oben schließt er auch auf einem Knopf, Antippen wählt weiterhin, Schleier rollt das Board nicht, im Hub zählt ein Wisch nicht zusätzlich als „Zurück" |
| **Notizen des Teams (Board, Küche), Nachricht an den Gast, Reservierung mit Nummer** | `pruefungen/pruef-notizen.js` (braucht `dist/`) — Naht als Quelltext gegen `migration-notizen.sql` (Parameter, Gründe, Spaltenrechte), Board: Stufe 1 sendet NICHTS, Stufe 2 genau den Vorschautext, `text_anders` zeigt den neuen Stand, Bearbeiten ohne Bestätigung lässt den Gast die alte Fassung sehen, Tipp ändert keinen Status, 44 px; Küche dasselbe am Bon; Hub: Streifen „Neue Nachricht“, Text nie als Auszeichnung, Englisch nur der Rahmen, Reservierung zeigt Stand und Nachricht. Die DB-Hälfte: zurückgedrehter Probelauf, 24 Proben |
| **Storno, Frist, Ton in der Küche** | `pruefungen/pruef-storno.js` (braucht `dist/`) — Gast, Küche, und die Migration |
| **Vor jeder Übergabe, wenn mehrere Blöcke zusammenkommen** | `pruefungen/pruef-zusammenspiel.js` (braucht `dist/`) — der ganze Weg des Gastes am Stück, beide Häuser |
| **Anmeldung, Sperre, Board-Zugang** | `pruefungen/pruef-admin-login.js` — drei Fehlversuche, richtiges Passwort bleibt trotzdem draußen, Freischaltung, und der Fall „Migration fehlt noch" |
| **Anmeldung an Küche, Konto, Master; Rolle im Master; „Neues Passwort“ nach dem Reset-Link** | `pruefungen/pruef-sperre-ueberall.js` — jede Tür fragt die Sperre VOR dem Login (gesperrt/falsch → kein Login-Versuch, fehlt → niemand ausgesperrt), Master wirft Nicht-Master hinaus (auch bei gemerkter Sitzung), der Reset-Link zeigt in Board, Konto UND Master das Passwort-Formular — Adresse und Ereignis EINZELN geprüft; Master: „Passwort vergessen?“ auf der Seite selbst (Rücksprung auf diese Adresse, kein Versand ohne Adresse, „not authorized“ als Satz), nach dem Link nie das Dashboard vor dem neuen Passwort, keine echte Adresse als Platzhalter auf irgendeiner Seite (§8.1n) |
| **Master-Board: Zugänge-Übersicht (`master_zugaenge`)** | `pruefungen/pruef-master-zugaenge.js` — echte Zugangs-Zeilen (Betrieb, E-Mail, Rolle, letzter Login, Status) erscheinen als Karten, Login- UND PIN-Sperre je eigens benannt aber gleich dringlich einsortiert, unbestätigt/Master/ohne-Betrieb einzeln erkennbar, leere Antwort zeigt einen Satz statt „0 Konten“ oder Absturz, fehlende Migration (`42883`) zeigt, welche fehlt, statt der rohen Postgres-Meldung |
| **Lieferung, Liefereinstellungen, /liefern** | `pruefungen/pruef-liefern.js` (braucht `dist/`) — Board, die drei Absagen im Hub, die Naht, der **Liefer-Schalter im Kopf** (echter Tipp schaltet liefermodus UND das Adressformular im Warenkorb, Name blitzt auf und verschwindet, Tipp auf das Gewählte ändert nichts, Pfeiltasten, Name passt in jeder Sprache, am Tisch/ohne Lieferung kein Schalter, außerhalb der Zeit nennt er die Uhrzeiten), die Bewegung (nur transform/opacity, Symbolkopie im Daumen MITTEN im Gleiten deckungsgleich, schnelle Tipps: der letzte gewinnt, reduzierte Bewegung sofort am Ziel), Kontrast von Symbol und Name je Haus, Tag und Abend (Spur mit dem Grund darunter GEMISCHT, `color(srgb …)` gelesen) |
| **Kopfzeile, Sprachknopf, Knopfzeile im Kopf** | `pruefungen/pruef-kopf.js` (braucht `dist/`) — Öffnungsstand in der Knopfzeile (Ort, nicht Länge — die hinge an der Uhr), Unterseite als flache Leiste (≤ 120 px, Siegel/Name/Knöpfe auf einer Höhe, ohne Adresse/Slogan/Stand); alle Häuser, 320–1280 px und RTL: Knopfzeile mittig auf 1 px, Sprachknopf ein Kreis 44–48 px ohne Text, Lichtknopf auch bei 320 px, Liste im Bild und aktive Sprache sichtbar markiert, aria-label folgt dem Wechsel |
| **„Abholbereit“ in der Küche, „Zum Abholen“ im Board, Abholton, Bestellliste nach Stand** | `pruefungen/pruef-abholbereit.js` — Küche: Hauptknopf „Abholbereit“ schreibt `kueche_fertig_um` (PATCH gemessen); Board über den ECHTEN Weg (`live_anmelden` mit gestelltem Kanal UND `nachholen()` mit gestellter Antwort, nur die Spur ändert sich): neu fertige Spur → Leiste + Abholton genau einmal, Geladenes klingelt nicht, zweite Spur klingelt erneut, „Gebracht“ schreibt NUR `gebracht_um` dieser Zeile, später fertige Spur holt sie zurück, Serviceruf/Storniertes nie; Ton über gestelltes `tonWerk` gezählt (vier Dreieckstöne, nicht der Dreiklang; „Ton aus“ = nichts), Noten in keinem Bestellklang; Überschriften Zu prüfen · Neu · In Arbeit; Kontrast dunkel UND hell (kopflos startet das Board hell — die dunkle Fassung wird ausdrücklich gesetzt), 44 px, 390 px. DB: `migration-abholbereit.sql` |
| **Annahme-Leiste für neue Bestellungen im Board** | `pruefungen/pruef-annahme.js` — auffälligere Rahmung nur bei status="neu", In-Arbeit-ohne-Zusage bleibt bei der stillen Zeile, Tapflächen ≥44px, Kontrast Tag/Abend |
| **Leisten im Board, Filter, Reiterleiste** | `pruefungen/pruef-leisten.js` — Geometrie auf Telefon und Tresen, gemessen mit `elementFromPoint`; dazu „Mehr“ auf Karte, Bestellungen und Reservierungen: jede Zeile mit dem Finger erreichbar (§3.9) |
| **Ball-Übergang der Reiterleiste (`.leiste-pille`)** | `pruefungen/pruef-leistenpille.js` — Ruhelage, Stauchung in der Mitte, Landung, Unterbrechbarkeit, Überlauf-Rückfall auf „Mehr", `prefers-reduced-motion`, Größenwechsel ohne veralteten Sprung |
| **Zeit-/Datumsfelder, Tagesknöpfe, Preis-Paare im Board** | `pruefungen/pruef-symmetrie.js` — Ränder, gleich breite Zeilen, drei Bildschirmbreiten |
| **Animationen, Übergänge, Blätter** | `pruefungen/pruef-bewegung.js` — nur `transform`/`opacity`, Endzustand, Ausgang, Geste |
| **Edge Functions (Übersetzer, Alessia, Klaviyo-Newsletter)** | `pruefungen/pruef-edge.js` — `tsc --strict`, kein Schlüssel im Quelltext, und jede vom Browser gerufene Funktion erlaubt im Vorflug jede Kopfzeile, die supabase-js schickt (zweite Quelle: `stand-supabase-cors.mjs` aus dem Paket; Anlass: Übersetzer mit nur `OPTIONS` in den Logs). Der einzige automatische Griff darauf: Beide Playwright-Prüfungen **stellen** die Serverantwort |
| **Schwebende Fußleisten, Karte-Knöpfe** | `pruefungen/pruef-kartenknoepfe.js` — fixiert unter 760px, Fluss darüber, Endzustand nach Animation, letzte Zeile nicht verdeckt (erst nach dem Scrollen ans Ende gemessen) |
| **Glas-Flächen (backdrop-filter), neue durchscheinende Bedienoberfläche** | `pruefungen/pruef-glas.js` — backdrop-filter an jeder Glas-Fläche (admin/kueche/Hub), `prefers-reduced-transparency` fällt wirklich auf die feste Fläche zurück (nicht nur eine spätere, gleich spezifische Regel im selben Blatt), Kontrast der Schrift auf Glas gegen Schwarz UND Weiß dahinter gerechnet, je Haus im Hub |
| **Aktions-Banner-Rad (hub_banner), Board-Bedienung oder Gast-Karussell** | `pruefungen/pruef-banner-rad.js` — BANNER_SEITEN als zweite Quelle zwischen admin.html und hub.vorlage.html gegeneinander gehalten, bnAusZeile()-Rundlauf für alle vier Zieltypen + unbekannten Wert + unsicheres Bild, Anlegen/Umsortieren/Löschen im Board, im Hub: alle vier Zieltypen lösen ihr Ziel richtig auf (ungültiges Ziel bleibt sichtbar, aber nicht klickbar), ein aktion-Banner zeigt nachweislich den LIVE-Stand aus `aktionen` statt des gespeicherten, Kontrast der Bannerschrift gegen den ungünstigsten Fall (fast weißes Foto) gerechnet; Breite: Karte so breit und bündig wie die Kachelreihe, Nachbarkarte lugt ≥ 8 px herein, kein Überlaufen bei 360–1280 px; **Neuöffnen**: `betriebeHolen` liest `hub_banner`, das Rad zeigt den gespeicherten Stand, eine frische Abfrage zieht den Stand eines zweiten Geräts nach (ohne getippte Eingabe zu überschreiben), und ohne gelesenen Stand schreibt „Übernehmen“ nichts (§8.1m) |
| **Rabattcode-Einlösung, Gäste-Newsletter im Board** | `pruefungen/pruef-rabatt-board.js` — Eingabefeld auf/zu, ehrliche Meldung im Vorführmodus; die eigentliche RPC-Logik (unbekannt/abgelaufen/bereits eingelöst/kein Zugriff) steht in `datenbank/pruef-rechte.sql` Teil 3 |
| **Klaviyo: Besuche melden, Vorlagen, „Gäste & Newsletter“-Übersicht, Vorrat auffüllen** | `pruefungen/pruef-klaviyo.js` — zweite Quellen: jedes Feld, das das Board aus der Übersicht liest, baut `gaeste_uebersicht()` (migration-gaeste-uebersicht.sql); jeder Grund von `newsletter-uebersicht` hat einen Satz (Ausnahmen namentlich); `newsletter-vorrat-auffuellen` prüft den Klaviyo-Schlüssel VOR dem ersten `rabattcode_anlegen`; Besuchs-Trigger nur bei Erhöhung, Bestell-Trigger ohne Markiertes/Serviceruf; `person\|lookup` der Vorlagen ⊆ Eigenschaften aus `klaviyo-profil-melden`; erzeugte Vorlagen mit Coupon-Tag, Abmeldelink und Schrift ≥ 4,5:1 im gerenderten Bild (Klaviyos `{% %}` ausgenommen); Hub-Satz am E-Mail-Feld nennt Klaviyo in elf Sprachen, Datenschutz führt Klaviyo; kein „wöchentlich“ im Board. Board mit gestelltem `db` über `betriebWaehlen()`: Zahlen, Abläufe mit Stand und Link, Lücke Supabase↔Klaviyo als Warnung, fehlender Schlüssel → Zahlen bleiben + Satz, Netz weg/Migration fehlt → Satz, Team ruft nichts, Wert aus Klaviyo nie als Auszeichnung, 360/1280 px hell und dunkel (Glas als `color(srgb …)` gelesen) |
| **Eigene Rabattcodes anlegen (Prozent/Betrag, ganze Rechnung/Gericht)** | `pruefungen/pruef-rabattcode-ziel.js` — Segmente Art/Ziel, Vorsilbe-Bereinigung (kein selbst gewählter Code mehr), Gerichtauswahl aus der echten Speisekarte, PIN-Blatt VOR dem Anlegen, Abbrechen legt nichts an, Code vom Server (Vorsilbe + 10 Zeichen ohne 0/O/1/I); mit gestelltem `db`: Konto ohne PIN → „PIN festlegen“ mit zweitem Feld, `pin_falsch` öffnet das Blatt wieder (das verzögerte Schließen darf es danach nicht verstecken, §8.1p), Nutzlast ohne `p_code`, alter Weg `rabattcode_team_anlegen` nie gerufen, Grenze des Servers als Satz mit Einheit; die zielbewusste, gedeckelte `rechnung_rabattieren()` und der GRANT-Fund (§2.3f) stehen in `datenbank/pruef-rechte.sql` TEIL 3b und TEIL 9 |
| **Gutscheine/Codes nicht ausnutzbar: Recht je Mitglied, PIN je Ausstellung, Prüfung beim Gast** | `pruefungen/pruef-gutschein-sicher.js` (braucht `dist/`) — zweite Quelle: jeder Grund der Ausstell-Funktionen in `migration-gutschein-sicher.sql` hat im Board einen Satz, jeder Grund von `rabattcode_pruefen` im Hub; Board als Team über den ECHTEN Weg (`betriebWaehlen()`): ohne Recht beide Gruppen gesperrt, mit Recht GENAU diese beiden offen (jede andere Besitzer-Gruppe bleibt zu), Rahmen steht da, nach erneutem Öffnen weiter offen, Beenden über `gutschein_beenden`; Hub: Code VOR dem Abschicken geprüft — ungültig/falsches Gericht/zu viele/keine Antwort je ein Satz und KEINE Bestellung (die Warteschlange wiederholte eine Ablehnung zehn Minuten still), gültig → genau eine Prüfung, Bestellung mit Code, Naht Hub-Schlüssel = Parameter der Funktion, Englisch. DB-Hälfte: `datenbank/pruef-rechte.sql` TEIL 9 und der Kopf der Migration (Teil 3 „SCHARF“ erst beim Merge) |
| **Gutscheine für Stammgäste im Board, „Mein Tisch" beim Gast** | `pruefungen/pruef-gutschein-board.js` — Grenzen gegen die CHECK-Schranke, längster Server-Code passt in die Code-Schranke, Anlegen mit PIN/Beenden, kein direktes Schreiben in `gutscheine`, gesendete Parameter = Parameter von `gutschein_ausstellen` in `migration-gutschein-sicher.sql`, kein rohes JSON, Datumsfeld in der Karte, und die Naht Funktion → `gast_melden` → Hub gegen `datenbank/stand-gast-melden.sql` (bytegleiche Kopie der Live-Funktion); dazu `pruef-gastkonto.js` für den Kontrast der Karten je Haus, Tag und Abend |
| **Bildvorschau im Board (Tiefeneffekt, Zuschnitt-Vorschau)** | `pruefungen/pruef-bildschau.js` — Vignette und Schatten an `.bildschau` und `#bildCropContainer`, dabei bleibt das Zuschnitt-Rechteck selbst unverändert |
| **Aufklappbare Gerichte-Zeilen in der Speisekarte** | `pruefungen/pruef-speisekarte-klapp.js` — Ruhelage nur Name/Preis, Aufklappen zeigt Beschreibung, „Bearbeiten" öffnet weiterhin das echte Blatt (eigene Geste), Zustand übersteht ein Neuzeichnen (Suche), Tapflächen ≥44px, `prefers-reduced-motion` |
| **Bewegte Emojis, Speisekarte mit Korbknopf, Foodroulette (Rad, „Für mich entscheiden“, Lust-Chips, „Neu für Sie“), Feier nach dem Bestellen** | `pruefungen/pruef-bewegte-zeichen.js` (braucht `dist/`) — zweite Quelle: jeder im Hub genannte Codepunkt liegt als Datei in `auslieferung/emoji/`; Ruhebild in Pixeln nachgezählt; Kategorie→Emoji gegen die echten Namen; Schalter strikt boolean (Board vor Markenblatt); ohne Netz steht das Geräte-Emoji; „+“/Regler/Flug; Symmetrie bei 360 und 430 px mit `getBoundingClientRect` (1 px), Stapel und Stempel spiegelbildlich; **Karten wischen** (gemerkte Art „karten“): Nachrücken als DASSELBE Element mit laufender Transition, Wurf mindestens mit Fingertempo, Karte folgt dem Finger 1:1, Abschluss statt leerer Fläche; dazu Rad, Zeiger und „Drehen“ mittig und beide Knöpfe nach der Landung gleich breit; Bildlücken ≤ 50 ms (auch beim Drehen); kein fremder Markenname im Quelltext (namentliche Liste); Foodroulette-Knopf ganz oben in der Speisekarte (nur EIN Weg), jedes Feld des Rads mit dem Zeichen seiner Kategorie, gelandete Wahl gegen die Karte gehalten, „Details“ öffnet das Blatt (dort die Allergene), Lust-Chip gegen `gerichtOrt`, Neues vor Bestelltem, „probiert“ nach echtem Abschicken; nach jedem Neuzeichnen (Chip, Suche, fremdes `innerHTML`) laufen die Filme wieder (§4.5); eigene Zeichen (`BZ_EIGEN`, z. B. Crêpe) liegen als Datei vor und stehen in `LIZENZEN.txt`; **Takt**: der Film (Knopf „Für mich entscheiden“) spielt nach dem ersten Durchlauf WIEDER (≥ 2 Anläufe in 9 s), wartet außer Sicht auf dem Ruhebild und läuft beim Zurückrollen sofort weiter, bei reduzierter Bewegung kein Film |
| **Kategorien bearbeiten (Name, Zeichen, neu, zusammenlegen, auflösen, löschen), Emoji-Wahl je Kategorie, eigene Zeichen (Soda)** | `pruefungen/pruef-kategorien.js` (braucht `dist/`) — zweite Quelle: KAT_ZEICHEN im Board = BZ_WAHL im Hub, jede Wahl als Datei, Automatik-Regeln (BZ_KATEGORIE/BZ_KARTE) Zeichen für Zeichen gleich, Schranke aus `migration-kategorie-emoji.sql` lässt jede Wahl zu; Board von Hand mit eigener Karte (die Vorführkarte hat nur eine Kategorie): alle Gerichte umbenannt, Zusammenlegen hängt hinten an, Umzug in eine Kategorie OHNE Zeichen nimmt das alte nicht mit; Hub mit nachgestellten Zeilen: Wahl schlägt Automatik, unbekannter Wert fällt still zurück, Änderung NUR am Zeichen ändert den Fingerabdruck. Dazu `pruef-bewegte-zeichen.js` für die Ruhebilder neuer Filme |
| **Profi-Foto und Freisteller (Edge Function gericht-bild), Pop-Ansicht im Hub** | `pruefungen/pruef-profifoto.js` (braucht `dist/`) — die Naht als Quelltext: Tarif-Liste Board = Edge Function ⊆ CHECK in `migration-bild-ki.sql`, jeder Fehlergrund hat einen Satz, gesendete = gelesene Felder, Antwortfelder, gleicher Speicherordner, Reihenfolge angemeldet → gezählt → erst dann fal; Board mit gestellter Funktion: Knopf nur bei eigenem Foto und Tarif, nichts ohne Blick ersetzt, Übernehmen einzeln, „Sichern“ schreibt bild_frei; Hub mit nachgestellter Zeile und echtem PNG: schwebt ohne Rahmen, nur https, kaputter Freisteller → Foto, Detailblatt zeigt das Profi-Foto, Aufdecken springt heraus (nicht bei reduzierter Bewegung). Dazu `datenbank/pruef-rechte.sql` TEIL 5 |

Und danach, immer:

- Verhält sich das Ergebnis wie behauptet? Kopflos durchspielen, nicht
  nur die Syntax prüfen.
- Hat sich etwas verändert, das sich **nicht** verändern sollte? Alte
  und neue Werte gegenrechnen.
- Versionsparameter am Skript hochzählen (`?v=…`) wegen `sw.js`.

---

## 9 · Wie berichtet wird

- **Erst der Befund, dann die Lösung.** „Das Wackeln kommt aus Zeile
  227" ist mehr wert als „habe die Animation verbessert".
- **Gefundene Fehler nennen, auch die eigenen.** Der Kontrasttest hat
  einen 1,16:1-Knopf gefunden — das gehört in den Bericht, nicht unter
  den Tisch.
- **Nicht behauptbare Dinge nicht behaupten.** „Ich bin kein Anwalt,
  lass es vom Lebensmittelüberwachungsamt gegenlesen."
- **Widersprechen, wenn der Plan falsch ist.** Der Nutzer wollte eine
  harte Sperre; die richtige Antwort war eine Markierung — samt
  Begründung, warum.
- **In Blöcken arbeiten.** Zwei Eingriffe in dieselbe Funktion in einem
  Zug sind nicht mehr prüfbar.

---

## 10 · Was hier nicht hingehört

Diese Datei sammelt **Fehlerklassen**, keine Projektstände. Keine
Spaltennamen, keine Migrationsnummern, keine Aufgabenlisten — die
veralten und machen die Datei unbrauchbar. Neue Regel nur, wenn ein
echter Fehler dahintersteht, mit Vorfall.
