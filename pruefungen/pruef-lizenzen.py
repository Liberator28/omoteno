#!/usr/bin/env python3
"""
PRÜFUNG · Schriften und Lizenzen (CLAUDE.md §8.1b: zweite Quelle)

    python3 pruefungen/pruef-lizenzen.py        (braucht: pip install fonttools brotli)

Anlass (19.10., Frage „sind alle Schriften legal?“): LIZENZEN.txt zählte
die Familien auf, aber niemand hielt die Urheberzeile gegen die
Schriftdatei selbst. Gefunden: Source Sans 3 trug nur „Google Inc.“ —
die Datei sagt „© 2023 Adobe … Reserved Font Name ‘Source’“. Die OFL
verlangt, dass der Urhebervermerk mitgeliefert wird.

Zweite Quelle ist hier die NAME-TABELLE der ausgelieferten Datei:
  1  jede Familie in auslieferung/schriften/ hat einen Lizenzkopf,
  2  jeder Lizenzkopf hat Dateien (nichts Verwaistes),
  3  die Urheberzeile der Datei steht im Lizenzblock (sonst: Vermerk fehlt),
  4  jeder Block trägt den OFL-1.1-Text,
  5  jede Familie, die das Board anbietet (SCHRIFT_WAHL), ist bei allen drei dabei,
  6  nichts im Verzeichnis lädt von Google (fonts.googleapis/gstatic) — außer
     in Kommentaren,
  7  der Hub nennt die Lizenzen im Impressum (OFL + Noto CC BY 4.0).
Ehrliche Grenze: Das prüft die Vermerke, nicht, ob ein Anbieter seine
Lizenz zu Recht „OFL“ nennt — das sagt der Anbieter, nicht dieses Skript.
"""
import glob, os, re, sys

OBEN = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
os.chdir(OBEN)
try:
    from fontTools.ttLib import TTFont
except ImportError:
    print("fontTools fehlt: pip install fonttools brotli — die Prüfung ist OHNE das nicht gelaufen.")
    sys.exit(2)

n = f = 0
def pruef(ok, text, detail=""):
    global n, f
    n += 1
    if not ok: f += 1
    print(("  ok   " if ok else "  FEHL ") + text + ("  → " + detail if detail else ""))

lic = open("auslieferung/schriften/LIZENZEN.txt", encoding="utf-8").read()
koepfe = list(re.finditer(r"^={70}\n(.+?) \((.+?)\)\n={70}\n", lic, re.M))
bloecke = {m.group(2): lic[m.end(): koepfe[i + 1].start() if i + 1 < len(koepfe) else len(lic)] for i, m in enumerate(koepfe)}
dateien = {}
for g in glob.glob("auslieferung/schriften/*.woff2"):
    m = re.match(r"(.+?)-latin(?:-ext)?-\d+(?:-italic)?\.woff2$", os.path.basename(g))
    dateien.setdefault(m.group(1) if m else "?" + g, []).append(g)

def norm(s):                  # Klammern (Webadressen, Mails) dürfen abweichen, der Inhaber nicht
    return re.sub(r"[^a-z0-9]", "", re.sub(r"\([^)]*\)", "", s).lower())
def ohne_doppelt(s):          # „Copyright (c) 2011, Copyright (c) 2011, …“ in der Datei
    return re.sub(r"(.{12,}?)\1+", r"\1", s)

print("\n══ Familien ↔ Lizenzköpfe ══")
pruef(not [k for k in dateien if k.startswith("?")], "jede Datei folgt dem Namensmuster", ", ".join(k for k in dateien if k.startswith("?")) or "alle")
pruef(set(dateien) == set(bloecke), "Dateifamilien = Lizenzköpfe (nichts ohne Lizenz, nichts verwaist)",
      "ohne Lizenz: %s · ohne Datei: %s" % (sorted(set(dateien) - set(bloecke)), sorted(set(bloecke) - set(dateien))))

print("\n══ Urhebervermerk gegen die Schriftdatei ══")
for fam in sorted(bloecke):
    if fam not in dateien: continue
    tt = TTFont(sorted(dateien[fam])[0])
    c = ohne_doppelt(tt["name"].getDebugName(0) or "")
    pruef(bool(c) and norm(c) in norm(bloecke[fam]), fam + ": Urheberzeile der Datei steht im Lizenzblock",
          "Datei: " + c[:90])

print("\n══ OFL-Text je Block ══")
for fam, b in sorted(bloecke.items()):
    pruef("SIL OPEN FONT LICENSE Version 1.1" in b and "PERMISSION & CONDITIONS" in b, fam + ": voller OFL-1.1-Text")

print("\n══ Was das Board anbietet ══")
adm = open("seiten/admin.html", encoding="utf-8").read()
wahl = re.findall(r'\{ s:"(\w+)",\s+familie:"([^"]+)",\s+datei:"([^"]+)"', adm)
pruef(len(wahl) >= 20, "Auswahl gelesen (zweite Quelle: SCHRIFT_WAHL)", str(len(wahl)))
fehl = [d for _, _, d in wahl if d not in bloecke or d not in dateien]
pruef(not fehl, "jede angebotene Schrift hat Datei UND Lizenzblock", ", ".join(fehl) or "alle")

print("\n══ Nichts von Google ══")
treffer = []
for pfad in glob.glob("seiten/**/*", recursive=True) + glob.glob("vorlagen/*") + glob.glob("auslieferung/**/*.css", recursive=True) + glob.glob("auslieferung/_headers"):
    if not os.path.isfile(pfad) or pfad.endswith((".png", ".jpg", ".woff2", ".json", ".webp", ".svg")): continue
    try: t = open(pfad, encoding="utf-8").read()
    except Exception: continue
    t = re.sub(r"/\*.*?\*/|<!--.*?-->", "", t, flags=re.S)       # Kommentare erzählen Geschichte, laden nichts
    for z in t.splitlines():
        if re.search(r"fonts\.(googleapis|gstatic)\.com", z):
            treffer.append(pfad + ": " + z.strip()[:80])
pruef(not treffer, "keine Seite, Vorlage oder CSS holt eine Schrift von Google", "; ".join(treffer[:3]) or "sauber")

print("\n══ Der Hub nennt die Lizenzen ══")
hub = open("vorlagen/hub.vorlage.html", encoding="utf-8").read()
pruef("/schriften/LIZENZEN.txt" in hub and "SIL Open Font License" in hub, "Impressum im Hub nennt die Schriftlizenz mit Link")
pruef("Animated Noto Emoji" in hub and "CC BY 4.0" in hub and "/emoji/LIZENZEN.txt" in hub, "Impressum im Hub nennt Noto-Emoji (CC BY 4.0) mit Link")
pruef(os.path.exists("auslieferung/emoji/LIZENZEN.txt") and os.path.exists("auslieferung/lib/LIZENZEN.txt"), "Lizenzdateien für Emoji und Bibliotheken liegen aus")

print("\n" + ("%d von %d FEHLGESCHLAGEN" % (f, n) if f else "Alles sauber (%d)" % n))
sys.exit(1 if f else 0)
