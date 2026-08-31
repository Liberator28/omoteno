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
| Gastkonto, „Mein Tisch" im Hub | `pruefungen/pruef-gastkonto.js` (braucht `dist/`) |
| Figur des Hauses, Bestellpass | `pruefungen/pruef-figur.js` (braucht `dist/`) |
| Texte im Hub, Sprachen | `pruefungen/pruef-sprache.js` |
| Freie Texte des Betriebs | `pruefungen/pruef-texte.js` (braucht `dist/`) |
| Farben, hell oder dunkel | `pruefungen/pruef-lesbarkeit.js` (braucht `dist/`) |
| Landingpage | `pruefungen/pruef-web.js` — Ladezeit, Zeitbalken, beide Fenster |
| Impressum, Datenschutz | `pruefungen/pruef-recht.js` — Ladezeit, Lesbarkeit, Marke |
| Marken-Studio (Bedienung) | `pruefungen/pruef-studio-hand.js` — Rückgängig, Sprung, Schicken |
| Auslieferung, Umleitungen | `erzeuger/bauen.js` und dann `pruefungen/pruef-lieferung.js` |
| **Irgendetwas am Hub** | `pruefungen/pruef-durchgang.js` — geht den ganzen Weg des Gastes |
| **Irgendetwas am Hub** | `pruefungen/pruef-hub-hand.js` — Neuladen, jeder Bereich, jede Sprache, hell/dunkel |
| **Irgendetwas am Board** | `pruefungen/pruef-board.js` — bedient das Board von Hand |
| Meldungen, Service Worker | `pruefungen/pruef-push.js` — sw.js wird ausgeliefert und meldet |
| Konto, Anfrageformular | `pruefungen/pruef-konto-start.js` — ohne Netz, 16px, tote Links |

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
