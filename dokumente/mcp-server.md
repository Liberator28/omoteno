# Der Supabase-Zugang für Claude Code

`.mcp.json` in der Wurzel meldet den Supabase-MCP-Server an. JSON kennt
keine Kommentare — hier steht deshalb, warum die Datei so aussieht, wie
sie aussieht.

---

## Zwei Einträge, nicht einer

```
supabase             lesen  (read_only=true)   ← der Normalfall
supabase-schreiben   lesen und schreiben       ← die Ausnahme
```

`quxwweuvdqtjsdwgjdrh` ist die **Produktionsdatenbank**. Dort liegen
echte Bestellungen und die E-Mail-Adressen echter Gäste. Supabase rät
für echte Daten ausdrücklich zu `read_only`, und der weitaus größte
Teil der Arbeit ist ohnehin Nachsehen: Tabellen auflisten, Regeln
prüfen, Kontraste rechnen, einen Verdacht messen.

Deshalb ist Lesen die Voreinstellung und Schreiben eine bewusste Wahl.
Wer eine Migration anwenden will, sagt das ausdrücklich — so wie es
bei den bisherigen Migrationen auch lief.

Mit `read_only=true` führt Supabase jede Abfrage als lesender
Postgres-Nutzer aus. `apply_migration` und jedes schreibende
`execute_sql` schlagen dann fehl. Das ist kein Fehler, sondern die
Sperre, die greift.

## Warum `project_ref` drinsteht

Zwei Dinge auf einmal:

1. Der Server sieht **nur** dieses eine Projekt.
2. Die Konto-Werkzeuge sind damit automatisch abgeschaltet —
   `create_project`, `pause_project`, `list_organizations`. Ein
   Missgriff kann also kein zweites Projekt anlegen oder ein fremdes
   anhalten.

## Warum kein Token in der Datei steht

`.mcp.json` trägt nur den Platzhalter:

```json
"Authorization": "Bearer ${SUPABASE_ACCESS_TOKEN}"
```

Claude Code setzt den Wert zur Laufzeit ein. Genau diese Form steht in
Supabases eigener Doku für Claude Code.

Ein Token im Klartext wäre nicht bloß unschön, sondern dauerhaft:

- Er bliebe **für immer** in der Git-Historie, auch nach dem Löschen.
  Nur ein Umschreiben der Geschichte oder ein neuer Token hilft dann.
- Netlify klont das Verzeichnis bei **jedem** Bau.
- Ein privates Repo bleibt nicht zwangsläufig privat.
- GitHubs Secret Scanning kann den Push blockieren.

## Den Token setzen

**Am eigenen Rechner** — in die Shell-Konfiguration
(`~/.zshrc`, `~/.bashrc`):

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."
```

Danach das Terminal neu öffnen, sonst ist die Variable nicht da.

**Für Claude Code im Web** — in den Umgebungseinstellungen der
Ausführungsumgebung als Variable `SUPABASE_ACCESS_TOKEN` hinterlegen.
Dort ist sie kein Bestandteil des Repos.

### Lieber ein Token mit Zuschnitt

Supabase kennt zwei Sorten:

| | |
|---|---|
| **Klassisch** | trägt das **ganze Konto** — jede Organisation, jedes Projekt, auch alle, die es heute noch gar nicht gibt |
| **Zugeschnitten** (`sbp_fc…`) | nur die Projekte und Rechte, die man auswählt |

Nimm einen zugeschnittenen, begrenzt auf dieses eine Projekt. Wenn er
je abhandenkommt, bleibt der Schaden klein.

Anlegen: Supabase-Dashboard → Account → Access Tokens.

## Wenn die Variable fehlt

Die Datei lädt trotzdem. Claude Code meldet die fehlende Variable, und
der Server verbindet nicht — der Platzhalter bleibt als Text stehen und
Supabase weist ihn ab. Sichtbar wird das mit `/mcp`: dort steht, welche
Server verbunden sind.

## Was hier bewusst nicht steht

**`features=`.** Supabase empfiehlt, die Werkzeuggruppen zu
beschränken, um die Angriffsfläche zu verkleinern. Die Doku nennt die
Gruppen aber nur als Überschriften („Debugging", „Development") und
nicht als exakte Schlüssel. Ein falscher Wert würde Werkzeuge still
abschalten — und still ist die schlechteste Art zu scheitern. Wer es
nachtragen will, findet die gültigen Werte hier:

<https://supabase.com/docs/guides/ai-tools/mcp>

Angehängt wird es an die URL, hinter `project_ref`:

```
...?project_ref=quxwweuvdqtjsdwgjdrh&read_only=true&features=database,docs
```

## Prompt Injection — der Grund, Werkzeugaufrufe zu lesen

Der Server legt eine Datenbank neben ein Sprachmodell, und in der
Datenbank stehen Texte, die **Fremde** hineingeschrieben haben: Notizen
an Bestellungen, Namen, Reservierungswünsche. Ein Text kann Anweisungen
enthalten, die aussehen wie deine.

Supabase umhüllt Abfrageergebnisse mit einer Warnung dagegen, aber das
ist kein Schloss. Die Bestätigung vor jedem Werkzeugaufruf angeschaltet
lassen und hinsehen, was da ausgeführt werden soll — besonders bei
allem, was schreibt.

## Verwandt

- `datenbank/pruef-rechte.sql` — fährt 36 Angriffe und ehrliche Wege
  in einer Transaktion, die sich selbst zurückdreht. Nach jeder
  Änderung an Rechten, Regeln oder Funktionen laufen lassen.
- `CLAUDE.md` §2 — die Regeln für Arbeit an der Datenbank, jede mit
  dem Vorfall dahinter.
