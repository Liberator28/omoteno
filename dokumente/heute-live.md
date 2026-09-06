# Heute live gehen

Von oben nach unten abarbeiten. Was du überspringst, fehlt später.

**Dauer:** Teil A etwa 20 Minuten, davon 15 Warten auf Netlify.

---

## Vorab: Warum es bisher nicht ging

Es liegen **vier Fassungen** der Landingpage herum: eine im
Verzeichnis, eine auf `omoteno.de`, eine auf `choco-lamour.omoteno.de`
— und die vierte ist die im Verzeichnis vor dem letzten Zusammenführen.

Der Grund ist **nicht**, dass das Verzeichnis veraltet wäre. Gemessen:

| | Größe | Zeilen |
|---|---|---|
| `seiten/omoteno-web.html` (Stand PR #4) | **163 KB** | 3 600 |
| dasselbe in `main` | 153 KB | 3 422 |

Beide enthalten „So startest du", „Omotenashi", „Wer dahintersteckt"
und beide Demo-Fenster. **Das Verzeichnis ist die neueste Fassung.**

Die Live-Seiten sind die alten Handkopien: Sie wurden per Datei-Upload
in zwei getrennte Netlify-Auftritte gelegt, an verschiedenen Tagen.
Deshalb liefern beide dasselbe `/marken-studio` aus, aber verschiedene
Startseiten.

**Schritt 2 unten löst das auf.** Danach gibt es nur noch eine Quelle,
und die Frage „welche Fassung ist live" stellt sich nie wieder.

---

# Teil A · Alle Seiten unter der richtigen Adresse

## 1 · PR #4 zusammenführen

GitHub → Pull requests → **#4** → *Merge pull request*.

Er bringt: Tagesbogen 07–03 Uhr, Preise ab 79 €, den A5 mit NFC und
QR, dichte Kundenadressen, den Weg des Wirts ans Board, Alessia.

> Ohne diesen Schritt ist `main` vom 3. September.

## 2 · Netlify: ein Auftritt statt zwei

Entscheide dich für **einen** der beiden Auftritte. Nimm den, an dem
`omoteno.de` schon hängt.

In diesem Auftritt:

1. *Site configuration → Build & deploy → Link repository*
2. GitHub → `Liberator28/omoteno`
3. Branch: **`main`**
4. **Base directory: leer lassen**
5. Publish directory und Build command: **nichts eintragen** — beides
   kommt aus `netlify.toml`

> Steht im Base directory etwas, findet Netlify die `netlify.toml`
> nicht und der Bau scheitert sofort. Das ist der häufigste Fehler.

## 3 · Domains eintragen

*Domain management* im selben Auftritt:

| Adresse | Rolle |
|---|---|
| `omoteno.de` | Primary domain |
| `www.omoteno.de` | Domain alias |
| `choco-lamour.omoteno.de` | Domain alias |

Warte, bis bei jeder ein **Netlify certificate** steht. Das dauert ein
bis zehn Minuten.

## 4 · Deploy auslösen und nachsehen

*Deploys → Trigger deploy → Deploy site*.

Im Protokoll muss stehen:

```
oeffentlich/ steht: 9 Seiten, 2 Hubs, 14 Einträge oben.
```

Steht dort stattdessen **„Cannot find module"**, ist Schritt 2 Punkt 4
nicht leer.

## 5 · Den zweiten Auftritt löschen — erst jetzt

**Nicht vorher.** Sonst zeigt die Adresse zwischendurch ins Leere.

*Site configuration → Danger zone → Delete site*.

## 6 · Im Browser gegenprüfen

Jede Adresse einmal, **hart neu laden** (iPhone: Seite schließen und
neu öffnen — der Hub darf 5 Minuten zwischengespeichert bleiben):

| Adresse | Was kommen muss |
|---|---|
| `omoteno.de` | Landingpage, Preise **79 · 149 · ab 299** |
| `www.omoteno.de` | springt auf `omoteno.de` |
| `omoteno.de/admin` | Anmeldung zum Board |
| `omoteno.de/kueche` | Anmeldung zur Küche |
| `omoteno.de/konto` · `/studio` · `/impressum` · `/datenschutz` | die jeweilige Seite |
| **`choco-lamour.omoteno.de`** | **Chocos Hub**, nicht die Landingpage |

Die Preise sind der schnellste Beweis: Stehen dort noch 29 €, siehst
du den alten Stand — dann hat Schritt 1 oder 4 nicht gegriffen.

---

# Teil B · Bestellungen ins Board und in die Küche

## 7 · Bestellen

`choco-lamour.omoteno.de` öffnen, ein Gericht wählen, abschicken.
Du bekommst eine dreistellige Nummer.

## 8 · Board

`omoteno.de/admin` → mit **E-Mail und Passwort** anmelden.

Die Bestellung muss binnen **25 Sekunden** stehen.

> 25 Sekunden ist die Obergrenze, nicht die Regel. Meist ist sie
> sofort da; fällt Realtime aus, holt das Board alle 25 s nach.

## 9 · Küche

`omoteno.de/kueche` → **dasselbe Konto** wie am Board.

Derselbe Bon muss dort stehen.

---

# Wenn nichts ankommt

Der Reihe nach, das Wahrscheinlichste zuerst:

### 1 · Falsches Konto

Board und Küche zeigen nur Häuser, in denen dein Konto Mitglied ist.

*Prüffrage:* Steht oben im Board der Name „Choco L'AMouR"? Wenn nicht,
ist es nicht das richtige Konto — nicht der falsche Code.

### 2 · Bestellpause an

*Prüffrage:* Sagt der Hub beim Absenden „Wir nehmen gerade keine
Bestellungen an"? Dann steht im Board unter *Einstellungen* die
Bestellpause auf ein.

### 3 · Die Bestellung kam gar nicht an

*Prüffrage:* Bekommst du im Hub eine **Nummer**? Wenn ja, ist sie in
der Datenbank und es liegt am Board. Wenn nein, ist sie nie
abgeschickt worden — dann Hub neu laden und noch einmal.

Ist es Nummer 3 und der Hub zeigt einen Fehler, schick mir den
genauen Wortlaut. Der sagt, welche der drei Prüfungen in
`bestellung_aufgeben` angeschlagen hat.

---

# Was heute NICHT nötig ist

Nichts davon blockiert den Betrieb:

- **Google-Anmeldung** — E-Mail und Passwort tun es. Freischalten
  nach `deployen.md` 5c, wenn du Zeit hast.
- **Alessia am Telefon** — ist gebaut, aber nicht ausgerollt.
  Schritte in `stand.md` §6.
- **Push-Meldungen** aufs Handy — das Board klingelt auch ohne.

---

# Danach, in Ruhe

- Indizes auf `bestellungen` nachsehen (`stand.md` §4) — vor dem
  ersten wirklich vollen Abend.
- „Leaked Password Protection" im Supabase-Dashboard einschalten.
- Die drei kleinen Reste aus `stand.md` §8.
