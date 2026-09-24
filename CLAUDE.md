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
| **Figur/Stimmung/Requisiten wählbar im Admin-Board** | `pruefungen/pruef-figur-board.js` (braucht `dist/`) — Zweite Quelle gegen AVATAR_FIGUREN/AVATAR_ZUEGE/E_REQUISITEN und ZUGNAMEN, Bedienung im Board, Vorrang hub_avatar vor Markenblatt, stiller Rückfall bei unbekanntem Wert — im Board UND im Hub selbst |
| Texte im Hub, Sprachen | `pruefungen/pruef-sprache.js` |
| **Irgendein Text, den ein Gast liest** | `pruefungen/pruef-uebersetzung.js` (braucht `dist/`) — zweite Quelle, jede Sprache am gemalten Bild, Anrede, und der Weg aus dem Board |
| Freie Texte des Betriebs, Bestellpass, Begleitersatz | `pruefungen/pruef-texte.js` (braucht `dist/`) |
| **Allergene/Zusatzstoffe, Kennziffern-Zuordnung** | `pruefungen/pruef-stoffe.js` (braucht `dist/`) — Rundlauf admin.html ↔ hub.vorlage.html Ziffer für Ziffer, dazu die Überlauf-Prüfung (scrollWidth/scrollHeight) am längsten echten Zusatzstoff-Text |
| Farben, hell oder dunkel | `pruefungen/pruef-lesbarkeit.js` (braucht `dist/`) |
| **Kopfband-Schmuck (Guss/Laternen), neue Markenblatt-Varianten am Kopf** | `pruefungen/pruef-kopfband.js` (braucht `dist/`) — welches Band sichtbar ist je Haus, reduzierte Bewegung |
| **Zierrat (Bambus/Tuschekleckse/Pfingstrose), neue Markenblatt-Stile** | `pruefungen/pruef-zierrat.js` (braucht `dist/`) — nur beim gewählten Haus sichtbar, kein Leck in andere Häuser, kein horizontales Überlaufen bei mehreren Breiten, Tag/Abend |
| **Thema (feste Neueinfärbung eines einzelnen Hauses, z. B. "kaiserlich")** | `pruefungen/pruef-thema.js` (braucht `dist/`) — Schalter gesetzt, Rahmen/Knopf-Stil und Kopf-Schrift wirklich da, kein Leck in andere Häuser |
| **Irgendeine Seite, irgendeine Palette** | `pruefungen/pruef-farbschema.js` — sagt jede Seite an, was sie zeigt? |
| Landingpage | `pruefungen/pruef-web.js` — Ladezeit, Zeitbalken, beide Fenster |
| Impressum, Datenschutz | `pruefungen/pruef-recht.js` — Ladezeit, Lesbarkeit, Marke |
| Marken-Studio (Bedienung) | `pruefungen/pruef-studio-hand.js` — Rückgängig, Sprung, Schicken |
| Auslieferung, Umleitungen | `erzeuger/bauen.js` und dann `pruefungen/pruef-lieferung.js` |
| **Startkacheln, Bereiche, Markenblatt, iconAus-Schalter** | `pruefungen/pruef-kacheln.js` — Kreuzvergleich: kein Hub trägt fremden Text; iconAus schaltet nur das Symbol ab (strikt `=== true`, keine Zeichenkette) |
| **Irgendetwas am Hub** | `pruefungen/pruef-durchgang.js` — geht den ganzen Weg des Gastes |
| **Irgendetwas am Hub** | `pruefungen/pruef-hub-hand.js` — Neuladen, jeder Bereich, jede Sprache, hell/dunkel |
| **Storno, Restzeit, jede Bestell-Funktion** | `pruefungen/pruef-naht.js` — hält den Wert, den der Hub schickt, gegen die Spalte, über die die SQL sucht |
| **Top-Runner-Streifen, Empfehlung des Hauses, "Sofort bestellen"** | `pruefungen/pruef-sofort.js` (braucht `dist/`) — Klick auf den Streifen öffnet die Vorschau, der Sofort-Knopf bestellt zum AKTIONSPREIS statt zum Kartenpreis, stiller Rückfall ohne anklickbaren Knopf, wenn das Gericht nicht mehr in der Karte steht |
| **Irgendetwas am Board** | `pruefungen/pruef-board.js` — bedient das Board von Hand, und gleicht jedes Filter-Kästchen gegen die Stellen ab, die den Wert wirklich schreiben |
| **Klapp-Felder, Segmente, animierte Auswahl im Board** | `pruefungen/pruef-auswahlfeld.js` — Tapflächen ≥ 44px, echtes Feld bleibt Quelle der Wahrheit, Endzustand ohne Bewegung |
| **Board oder Küche, Vollbild, Fern-Ansicht** | `pruefungen/pruef-vollbild.js` — beide Boards, drei Schirmgrößen, geteilter Block |
| Meldungen, Service Worker | `pruefungen/pruef-push.js` — sw.js wird ausgeliefert und meldet |
| **Rechte, Regeln, Funktionen in der Datenbank** | `datenbank/pruef-rechte.sql` — im SQL-Editor, dreht sich selbst zurück |
| Konto, Anfrageformular, **Google-Knopf** | `pruefungen/pruef-konto-start.js` — ohne Netz, 16px, tote Links, Anbieterliste |
| **Alessia, der Telefonweg** | `pruefungen/pruef-alessia.js` — liest die Nutzlast, ohne Netz |
| **Telefonbestellungen** | `pruefungen/pruef-telefonbon.js` — kommt der Bon in der Küche an |
| **Zugesagte Zeit, Countdown in Küche und Hub** | `pruefungen/pruef-zusage.js` (braucht `dist/`) — beide Seiten, und der Fall „Migration fehlt noch" |
| **Kacheln, Symbole, Banner, Baukasten im Board** | `pruefungen/pruef-baukasten.js` (braucht `dist/`) — zweite Quelle, Zuschnitt, Schrift nie auf dem Bild |
| **Besuchsbild, Sterne, Foto** | `pruefungen/pruef-besuchsbild.js` (braucht `dist/`) — Sterne auf der Leinwand, Bild aus der Karte |
| **Fenster, Blätter, Wischgeste** | `pruefungen/pruef-wischen.js` (braucht `dist/`) — Hub, Board und Küche, auch mit reduzierter Bewegung |
| **Storno, Frist, Ton in der Küche** | `pruefungen/pruef-storno.js` (braucht `dist/`) — Gast, Küche, und die Migration |
| **Vor jeder Übergabe, wenn mehrere Blöcke zusammenkommen** | `pruefungen/pruef-zusammenspiel.js` (braucht `dist/`) — der ganze Weg des Gastes am Stück, beide Häuser |
| **Anmeldung, Sperre, Board-Zugang** | `pruefungen/pruef-admin-login.js` — drei Fehlversuche, richtiges Passwort bleibt trotzdem draußen, Freischaltung, und der Fall „Migration fehlt noch" |
| **Lieferung, Liefereinstellungen, /liefern** | `pruefungen/pruef-liefern.js` (braucht `dist/`) — Board, die drei Absagen im Hub, die Naht, der Kontrast des Bandes |
| **Annahme-Leiste für neue Bestellungen im Board** | `pruefungen/pruef-annahme.js` — auffälligere Rahmung nur bei status="neu", In-Arbeit-ohne-Zusage bleibt bei der stillen Zeile, Tapflächen ≥44px, Kontrast Tag/Abend |
| **Leisten im Board, Filter, Reiterleiste** | `pruefungen/pruef-leisten.js` — Geometrie auf Telefon und Tresen, gemessen mit `elementFromPoint` |
| **Ball-Übergang der Reiterleiste (`.leiste-pille`)** | `pruefungen/pruef-leistenpille.js` — Ruhelage, Stauchung in der Mitte, Landung, Unterbrechbarkeit, Überlauf-Rückfall auf „Mehr", `prefers-reduced-motion`, Größenwechsel ohne veralteten Sprung |
| **Zeit-/Datumsfelder, Tagesknöpfe, Preis-Paare im Board** | `pruefungen/pruef-symmetrie.js` — Ränder, gleich breite Zeilen, drei Bildschirmbreiten |
| **Animationen, Übergänge, Blätter** | `pruefungen/pruef-bewegung.js` — nur `transform`/`opacity`, Endzustand, Ausgang, Geste |
| **Edge Functions (Übersetzer, Alessia, Klaviyo-Newsletter)** | `pruefungen/pruef-edge.js` — `tsc --strict` und kein Schlüssel im Quelltext. Der einzige automatische Griff darauf: Beide Playwright-Prüfungen **stellen** die Serverantwort |
| **Schwebende Fußleisten, Karte-Knöpfe** | `pruefungen/pruef-kartenknoepfe.js` — fixiert unter 760px, Fluss darüber, Endzustand nach Animation, letzte Zeile nicht verdeckt (erst nach dem Scrollen ans Ende gemessen) |
| **Glas-Flächen (backdrop-filter), neue durchscheinende Bedienoberfläche** | `pruefungen/pruef-glas.js` — backdrop-filter an jeder Glas-Fläche (admin/kueche/Hub), `prefers-reduced-transparency` fällt wirklich auf die feste Fläche zurück (nicht nur eine spätere, gleich spezifische Regel im selben Blatt), Kontrast der Schrift auf Glas gegen Schwarz UND Weiß dahinter gerechnet, je Haus im Hub |
| **Rabattcode-Einlösung, Gäste-Newsletter im Board** | `pruefungen/pruef-rabatt-board.js` — Eingabefeld auf/zu, ehrliche Meldung im Vorführmodus; die eigentliche RPC-Logik (unbekannt/abgelaufen/bereits eingelöst/kein Zugriff) steht in `datenbank/pruef-rechte.sql` Teil 3 |
| **Bildvorschau im Board (Tiefeneffekt, Zuschnitt-Vorschau)** | `pruefungen/pruef-bildschau.js` — Vignette und Schatten an `.bildschau` und `#bildCropContainer`, dabei bleibt das Zuschnitt-Rechteck selbst unverändert |
| **Aufklappbare Gerichte-Zeilen in der Speisekarte** | `pruefungen/pruef-speisekarte-klapp.js` — Ruhelage nur Name/Preis, Aufklappen zeigt Beschreibung, „Bearbeiten" öffnet weiterhin das echte Blatt (eigene Geste), Zustand übersteht ein Neuzeichnen (Suche), Tapflächen ≥44px, `prefers-reduced-motion` |

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
