# Startgrafik, Abholen, Speisekarte nach Entwurf (24./25.10.)

Stand: Branch `claude/landingpage-design-integration-r000h9`. Alles unten ist im Verzeichnis, **nichts davon ist gegen die
Live-Datenbank gelaufen** (der Supabase-Zugang war in dieser Sitzung nicht erreichbar). Migrationen sind Vorschläge.

## Was gebaut ist

| Teil | Wo | Geprüft von |
|---|---|---|
| Willkommen-Knöpfe: „Zur Startseite“ + Symbol an beiden | `vorlagen/hub.vorlage.html` (`wkKnoepfe()`) | `pruef-willkommen-knoepfe.js` |
| Abholen als dritte Bestellart (Chip, Warenkorb, Bestellpass; Board-Schalter + Vorlauf; Küche zeigt Name/Telefon/Zeit) | Hub, `seiten/admin.html`, `seiten/kueche.html` | `pruef-abholen.js` (18 Gegenbeweise) |
| Gezeichnete Startgrafiken (Maskottchen, Wunderbox, Teller, Glocke, Sticker, Botschaft, Schokoguss) | Hub-Block `START-GRAFIKEN`; Markenblatt-Feld `startgrafik` (nur mit `startstil: "premium"`) | `pruef-startgrafik.js` |
| Schweben der gewählten Gerichte in „Ihre Auswahl“ | Hub (`.sz-k-auswahl`) | `pruef-startgrafik.js` §3 |
| Glas-Knopfzeile (Apple-Art) über dem Kopfbild | Hub (`.kopfwahl`, `body[data-kw]`) | `pruef-startgrafik.js` §4 |
| Speisekarte: Kopfkarte (Kennzeile, Titel, Text, Herz), „Unsere Highlights“, Pillen mit Zeichen, Abzeichen „Beliebt“, Pfeil, Strich-Symbole in den Chips | Hub (`karteSeite`, `gerichtHTML`) | `pruef-startgrafik.js` §5 |
| Board: „Kopf der Speisekarte“ (4 Felder in „Ihre Worte“), Schalter „Beliebt“ am Gericht | `seiten/admin.html` | `pruef-startgrafik.js` §6b |

Markenblatt (Choco): `startgrafik: { figur, sticker, botschaft[2], karte: { eyebrow, titel, text, kopfzeile } }`. Der Erzeuger
lehnt alles ab, was er nicht kennt (Positivliste, keine `< > " \``). Alle Texte laufen im Hub durch `t()` — jeder Satz hat
einen Wörterbucheintrag in elf Sprachen (`pruef-uebersetzung.js` hält sie gegen das Markenblatt).

## Einspielreihenfolge (nichts davon ist eingespielt)

1. `datenbank/migration-karte-kopf.sql` — CHECK `hub_texte_karte` (40/60/160/60 Zeichen) und Spalte `gerichte.beliebt`.
   Additiv (kein `drop`). Der Hub liest `beliebt === true` schon heute (fehlt die Spalte, ändert sich nichts); der Board-Schalter
   erscheint erst, wenn die Spalte in den gelesenen Zeilen vorkommt. Lokal in Postgres 16 geprobt (60/61 Zeichen, andere
   Spalte derselben Zeile, `beliebt` setzen).
2. `datenbank/migration-tischpflicht-lieferung.sql` — Tischpflicht darf Lieferung und Abholung nicht abweisen (CLAUDE.md §2.3i).
   Lesefragen im Dateikopf **vorher** beantworten; der Block bricht laut ab, wenn eine Funktion anders aussieht.
   Probe: `pruefungen/pruef-tischpflicht-lokal.sh`.

## Offen (benannt, nicht verschwiegen)

- **Grafiken sind Nachzeichnungen** des Entwurfs, nicht seine Originale. Wer die Originale hat, ersetzt die Zeichnungen im Block
  (`SG.*`); die Prüfung misst Feld, Füllung und Überdeckung, nicht die Ähnlichkeit.
- **Ohne `migration-karte-kopf.sql`** zeigt eine echte Karte keine „Highlights“ (es gibt dort kein „beliebt“); nur das Gerüst-Haus
  hat `top:true`.
- **Abholen nur mit Zahlung vor Ort**; eine Online-Zahlung braucht eine neue Funktion `bestellung_abholen_zahlung` (eigenes Vorhaben).
- Der Name im Kopf der Unterseiten wird bei schmalen Telefonen mit „…“ gekürzt, weil die Knopfzeile Platz braucht.
- Ein Haus ohne Startgrafik hat auf einem rein weißen Kopfbild weiter kein Polster hinter dem Slogan (vorbestehend, nicht angefasst).
- Nur kopfloses Chromium; Glas-Look und iOS-Leiste nicht auf einem iPhone gesehen.
- Das Wörterbuch (186 KB gzip) liegt weiter in der Hub-Datei.
