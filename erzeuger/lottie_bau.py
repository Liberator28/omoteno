"""Gemeinsame Bausteine für die eigenen Lottie-Zeichen (Noto-Stil).

Die frühen Erzeuger (crepe, soda) tragen ihre Helfer je selbst; ab dem
Pfannkuchen teilen sich die Zeichen diese Datei, weil die Machart, die
sie nach Noto-Art tragen soll — Verläufe, dunkle Unterkante, Glanzkante,
Federn beim Landen, animierte Pfade — sonst fünfmal gleich dastünde.

Koordinaten: 1024×1024, 60 fps, 100 Bilder. In Lottie liegt das ZUERST
genannte Element OBEN (gruppe(glanz, flaeche, kante): glanz obenauf)."""
import json, math, os

BILDER = 100

def col(h, a=1):
    h = h.lstrip("#"); return [int(h[i:i+2], 16)/255 for i in (0, 2, 4)] + [a]
def st(v): return {"a": 0, "k": v}

# ── Zeitverläufe ────────────────────────────────────────────────────
KURVEN = {
    "weich":  ({"x": 0.45, "y": 0}, {"x": 0.3,  "y": 1}),     # ease-in-out, ausrollend
    "raus":   ({"x": 0.16, "y": 1}, {"x": 0.3,  "y": 1}),     # ease-out, schnell da
    "rein":   ({"x": 0.55, "y": 0}, {"x": 0.9,  "y": 0.7}),   # ease-in (Fallen)
    "linear": ({"x": 0,    "y": 0}, {"x": 1,    "y": 1}),
}
def kf(schritte, kurve="weich"):
    """schritte: [(bild, wert), …] — wert Zahl oder Liste. kurve je Abschnitt
    als Name oder Liste von Namen (eine weniger als Schritte)."""
    out = []
    for i, (t, v) in enumerate(schritte):
        k = {"t": t, "s": v if isinstance(v, list) else [v]}
        if i < len(schritte) - 1:
            name = kurve[i] if isinstance(kurve, list) else kurve
            o, n = KURVEN[name]; d = len(k["s"])
            k["o"] = {"x": [o["x"]]*d, "y": [o["y"]]*d}
            k["i"] = {"x": [n["x"]]*d, "y": [n["y"]]*d}
        out.append(k)
    return {"a": 1, "k": out}
def wert(v): return v if isinstance(v, dict) else st(v)

def feder(t0, von, nach, dauer=24, ueber=0.18):
    """Landen mit Nachschwingen: von → über das Ziel → zurück → ruhig."""
    def mix(a, b, f):
        if isinstance(a, list): return [x + (y - x) * f for x, y in zip(a, b)]
        return a + (b - a) * f
    return [(t0, von), (t0 + dauer*0.45, mix(von, nach, 1 + ueber)),
            (t0 + dauer*0.75, mix(von, nach, 1 - ueber*0.4)), (t0 + dauer, nach)]

# ── Formen ──────────────────────────────────────────────────────────
def pfaddaten(punkte, zu=True):
    return {"c": zu, "v": [[p[0], p[1]] for p in punkte],
            "i": [list(p[2]) if len(p) > 2 else [0, 0] for p in punkte],
            "o": [list(p[3]) if len(p) > 3 else [0, 0] for p in punkte]}
def pfad(punkte, zu=True):
    return {"ty": "sh", "ks": st(pfaddaten(punkte, zu))}
def pfad_anim(schritte, zu=True, kurve="weich"):
    """schritte: [(bild, punkte), …] — alle mit gleich vielen Punkten."""
    out = []
    for i, (t, pk) in enumerate(schritte):
        k = {"t": t, "s": [pfaddaten(pk, zu)]}
        if i < len(schritte) - 1:
            name = kurve[i] if isinstance(kurve, list) else kurve
            o, n = KURVEN[name]
            k["o"] = {"x": [o["x"]], "y": [o["y"]]}; k["i"] = {"x": [n["x"]], "y": [n["y"]]}
        out.append(k)
    return {"ty": "sh", "ks": {"a": 1, "k": out}}
def glatt(punkte, zu=True, spannung=0.35):
    """Weicher Pfad durch Punkte (Catmull-Rom → Bezier)."""
    n = len(punkte); out = []
    for j, (x, y) in enumerate(punkte):
        a = punkte[(j-1) % n] if (zu or j > 0) else punkte[j]
        b = punkte[(j+1) % n] if (zu or j < n-1) else punkte[j]
        tx, ty = (b[0]-a[0]) * spannung, (b[1]-a[1]) * spannung
        out.append((x, y, (-tx, -ty), (tx, ty)))
    return out
def ell(x, y, w, h): return {"ty": "el", "p": wert([x, y]), "s": wert([w, h])}
def ell_anim(p, s): return {"ty": "el", "p": wert(p), "s": wert(s)}
def rechteck(x, y, w, h, r): return {"ty": "rc", "p": st([x, y]), "s": st([w, h]), "r": st(r)}
def kreisbogen(cx, cy, rx, ry, a0, a1, n=8):
    """Punkte auf einer Ellipse zwischen zwei Winkeln (Grad), mit Tangenten."""
    out = []; schritt = (a1 - a0) / n; k = 4/3 * math.tan(math.radians(schritt)/4)
    for i in range(n + 1):
        w = math.radians(a0 + schritt*i)
        x, y = cx + rx*math.cos(w), cy + ry*math.sin(w)
        dx, dy = -rx*math.sin(w)*k, ry*math.cos(w)*k
        out.append((x, y, (-dx, -dy), (dx, dy)))
    return out

# ── Füllen und Striche ──────────────────────────────────────────────
def fuell(f, a=100): return {"ty": "fl", "c": st(col(f)), "o": wert(a), "r": 1}
def verlauf(stopps, von, nach, a=100, radial=False):
    """stopps: [(0, "#hex"), (1, "#hex")] — linear von→nach, oder radial."""
    k = []
    for pos, f in stopps: k += [pos] + col(f)[:3]
    g = {"ty": "gf", "o": wert(a), "r": 1, "bm": 0, "g": {"p": len(stopps), "k": st(k)},
         "s": st(von), "e": st(nach), "t": 2 if radial else 1}
    if radial: g.update({"h": st(0), "a": st(0)})
    return g
def strich(f, b, a=100):
    return {"ty": "st", "c": st(col(f)), "o": wert(a), "w": wert(b), "lc": 2, "lj": 2, "ml": 4}
def zug(e_schritte, s_schritte=None, kurve="weich"):
    """Trim-Path: e (und optional s) in Prozent über die Zeit."""
    return {"ty": "tm", "s": kf(s_schritte, kurve) if s_schritte else st(0),
            "e": kf(e_schritte, kurve), "o": st(0), "m": 1}

# ── Gruppen und Ebenen ──────────────────────────────────────────────
def tr(p=(0, 0), a=(0, 0), s=(100, 100), r=0, o=100):
    return {"ty": "tr", "p": wert(list(p) if not isinstance(p, dict) else p),
            "a": wert(list(a) if not isinstance(a, dict) else a),
            "s": wert(list(s) if not isinstance(s, dict) else s), "r": wert(r), "o": wert(o)}
def gruppe(*teile, **t): return {"ty": "gr", "it": list(teile) + [tr(**t)]}

_zaehler = [0]
def ebene(name, formen, p=(0, 0), a=(0, 0), s=(100, 100), r=0, o=100, eltern=None, von=0):
    _zaehler[0] += 1
    def d3(v): return v if isinstance(v, dict) else st(list(v) + [0] if len(v) == 2 else list(v))
    def s3(v): return v if isinstance(v, dict) else st(list(v) + [100] if len(v) == 2 else list(v))
    e = {"ddd": 0, "ind": _zaehler[0], "ty": 4, "nm": name, "sr": 1, "ip": von, "op": BILDER, "st": 0, "bm": 0,
         "ks": {"o": wert(o), "r": wert(r), "p": d3(p), "a": d3(a), "s": s3(s)}, "ao": 0, "shapes": formen}
    if eltern: e["parent"] = eltern
    return e

def schreiben(dateiname, titel, ebenen):
    """ebenen: oberste zuerst."""
    film = {"v": "5.8.1", "fr": 60, "ip": 0, "op": BILDER, "w": 1024, "h": 1024,
            "nm": titel + " (omoteno, eigen)", "ddd": 0, "assets": [], "layers": ebenen}
    ziel = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "auslieferung", "emoji", dateiname)
    with open(ziel, "w") as f: json.dump(film, f, separators=(",", ":"))
    print("ok", dateiname, os.path.getsize(ziel), "Bytes")

def a3(v): return list(v) + [0]
def s3(v): return list(v) + [100]
