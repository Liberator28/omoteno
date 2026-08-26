#!/usr/bin/env python3
"""Grundprüfung für jede Omoteno-HTML-Datei.

    python3 pruef-datei.py chocolamour-hub-v7.html

Prüft, was in diesem Projekt schon einmal schiefgegangen ist:
offene CSS-Klammern, Variablen ohne Wert, doppelte id-Attribute,
im Skript gesuchte Elemente, die es im HTML nicht gibt, und
Namenskollisionen zwischen mehreren Skriptblöcken.
"""
import re, sys, subprocess, tempfile, os

if len(sys.argv) < 2:
    sys.exit("Aufruf: python3 pruef-datei.py <datei.html>")

pfad = sys.argv[1]
s = open(pfad, encoding="utf-8").read()
css = "\n".join(re.findall(r'<style[^>]*>(.*?)</style>', s, re.S))
bloecke = re.findall(r'<script[^>]*>(.*?)</script>', s, re.S)
js = "\n".join(bloecke)
fehler = 0

def sagen(name, wert, gut):
    global fehler
    ok = (wert == gut) if not isinstance(gut, str) else True
    if not ok: fehler_zaehlen()
    print(f"  {name:<38}{wert}")

klammern = css.count("{") - css.count("}")
print(f"\n{pfad}")
print(f"  CSS-Klammern (soll 0)                 {klammern}")
if klammern: fehler += 1

defined = set(re.findall(r'(--[a-zA-Z0-9-]+)\s*:', css)) | \
          set(re.findall(r'setProperty\("(--[a-zA-Z0-9-]+)"', s))
mitRueckfall = set(re.findall(r'var\((--[a-zA-Z0-9-]+)\s*,', s))
ohne = set(re.findall(r'var\((--[a-zA-Z0-9-]+)\s*\)', s)) - defined
print(f"  Variablen ohne Wert und ohne Rückfall {sorted(ohne) or 'keine'}")
if ohne: fehler += 1

# Doppelte id: nur im festen Auszeichnungstext ein echter Fehler.
# Ids, die ein Skript in Seitenvorlagen erzeugt, kommen mehrfach im
# Quelltext vor, aber immer nur eine Vorlage steht gleichzeitig im
# Bild. Sonst meldet das Werkzeug Fehlalarme und man gewöhnt sich an,
# es zu übergehen — dann nützt es gar nichts mehr.
markup = re.sub(r'<script[^>]*>.*?</script>', '', s, flags=re.S)
feste = re.findall(r'\bid="([^"]+)"', markup)
dop = sorted(i for i in set(feste) if feste.count(i) > 1)
print(f"  doppelte id im Auszeichnungstext      {dop or 'keine'}")
if dop: fehler += 1

erzeugt = [i for i in re.findall(r'\bid=\\?"([^"\\]+)', js) if "+" not in i and "${" not in i]
mehrfach = sorted(i for i in set(erzeugt) if erzeugt.count(i) > 1)
if mehrfach:
    print(f"  (Hinweis) id in mehreren Vorlagen     {mehrfach}")

# Alle id-Werte, gleich ob fest ausgezeichnet oder vom Skript erzeugt.
alle_ids = set(feste) | set(erzeugt)
gesucht = set(re.findall(r'\$\("#?([A-Za-z0-9_-]+)"\)', js))
fehlend = sorted(gesucht - alle_ids)
print(f"  im Skript gesucht, im HTML fehlend    {fehlend or 'keine'}")
if fehlend: fehler += 1

if len(bloecke) > 1:
    def oben(b):
        return set(m.group(1) for m in
                   re.finditer(r'^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)', b, re.M))
    namen, koll = [], set()
    for b in bloecke:
        n = oben(b)
        for vorher in namen: koll |= (n & vorher)
        namen.append(n)
    print(f"  Namenskollisionen ({len(bloecke)} Skriptblöcke)     {sorted(koll) or 'keine'}")
    if koll: fehler += 1

for i, b in enumerate(bloecke):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(b); tmp = f.name
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
    os.unlink(tmp)
    print(f"  Skriptblock {i+1} Syntax                 {'ok' if r.returncode == 0 else 'FEHLER'}")
    if r.returncode: fehler += 1; print("   ", r.stderr.strip().split("\n")[0])

print(f"\n  {'Alles sauber.' if not fehler else str(fehler) + ' Punkt(e) zu klären.'}\n")
sys.exit(1 if fehler else 0)
