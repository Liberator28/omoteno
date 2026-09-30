"""Eigenes bewegtes Pizza-Zeichen im Noto-Stil (1024×1024, 60 fps, 100 Bilder).

Eine ganze Pizza auf dem Holzbrett; ein Stück wird herausgehoben, und
der Käse zieht sich in Fäden zwischen Stück und Pizza — die Fäden hängen
an beiden Enden fest (nicht ins Leere), werden beim Ziehen dünner und
wippen mit dem Stück nach. Stück und Fäden teilen dieselbe Bahn: beide
werden aus pose() Bild für Bild gerechnet, sonst liefen die Fadenenden
dem Stück davon. Ruhebild = letztes Bild."""
import math
from lottie_bau import *

C = (440, 660)                  # Mitte der Pizza = Spitze des Stücks
RX, RY = 330, 200
W0, W1 = -44, -4                # Winkel des Stücks (Grad)

def ell_pkt(w, f=1.0):
    r = math.radians(w); return (C[0] + RX*f*math.cos(r), C[1] + RY*f*math.sin(r))

def pose(t):
    """(dx, dy, drehung) des Stücks im Bild t."""
    if t <= 18: return (0.0, 0.0, 0.0)
    if t <= 48:
        u = (t - 18) / 30; s = 1.9
        e = 1 + (s+1)*(u-1)**3 + s*(u-1)**2          # ease-out-back
        return (120*e, -200*e, -12*e)
    v = (t - 48) / 51 * 2*math.pi
    return (120 + 7*math.sin(v), -200 + 5*math.sin(2*v), -12 + 1.6*math.sin(v))

def welt(pkt, t):
    dx, dy, r = pose(t); a = math.radians(r)
    x, y = pkt[0] - C[0], pkt[1] - C[1]
    return (C[0] + dx + x*math.cos(a) - y*math.sin(a), C[1] + dy + x*math.sin(a) + y*math.cos(a))

BILDER_POSE = list(range(0, 100, 3)) + [99]

# ── Brett ──────────────────────────────────────────────────────────
maserung = gruppe(*[gruppe(pfad(glatt([(C[0]-300+i*20, C[1]-150+i*60), (C[0]+i*10, C[1]-130+i*60+14), (C[0]+300-i*20, C[1]-150+i*60)], zu=False), False),
                           strich("#B27440", 6, 60)) for i in range(6)])
brett = ebene("Brett", [
    maserung,
    gruppe(ell(C[0], C[1], 800, 520), verlauf([(0, "#D9A066"), (1, "#C0834A")], [C[0], C[1]-260], [C[0], C[1]+260])),
    gruppe(ell(C[0], C[1]+20, 800, 520), fuell("#935A2C")),
    gruppe(ell(C[0], C[1]+190, 700, 80), fuell("#2A1A14", 14)),
])

# ── Pizza (mit Lücke) ──────────────────────────────────────────────
def keil(f=1.0, dx=0, dy=0):
    bogen = kreisbogen(C[0], C[1], RX*f, RY*f, W0, W1, 4)
    return [(C[0]+dx, C[1]+dy, (0, 0), (0, 0))] + [(x+dx, y+dy, i, o) for x, y, i, o in bogen]
def peperoni(x, y, g=1.0):
    return [gruppe(ell(x-10*g, y-8*g, 22*g, 10*g), fuell("#FFFFFF", 55)),
            gruppe(ell(x, y, 60*g, 40*g), verlauf([(0, "#E8583F"), (1, "#C2331F")], [x, y-20*g], [x, y+20*g])),
            gruppe(ell(x, y+4*g, 66*g, 46*g), fuell("#9C2616"))]
def basilikum(x, y, w):
    return gruppe(pfad([(0, -18, (-14, 0), (14, 0)), (22, 0, (0, -12), (0, 12)), (0, 18, (14, 0), (-14, 0)), (-22, 0, (0, 12), (0, -12))]),
                  verlauf([(0, "#5DB04C"), (1, "#2E7A34")], [0, -18], [0, 18]), p=(x, y), r=w)
kaese_flecken = gruppe(*[ell(x, y, w, h) for x, y, w, h in
    [(330, 610, 70, 30), (420, 740, 90, 34), (560, 740, 60, 24), (250, 690, 40, 18), (380, 560, 50, 20)]], fuell("#FFF1B8", 90))
luecke = [gruppe(pfad(keil(1.02)), fuell("#B37644")),
          gruppe(pfad(keil(1.0, 0, -10)), fuell("#8A5226", 55))]
pizza = ebene("Pizza", luecke + [
    basilikum(360, 640, 20), basilikum(520, 790, -30), basilikum(260, 730, 60),
    *peperoni(300, 620), *peperoni(430, 700), *peperoni(560, 770, 0.9), *peperoni(330, 770, 0.85), *peperoni(470, 560, 0.8),
    kaese_flecken,
    gruppe(ell(C[0], C[1], RX*2*0.86, RY*2*0.86), verlauf([(0, "#FFE28A"), (1, "#FFC53D")], [C[0], C[1]-180], [C[0], C[1]+180])),
    gruppe(ell(C[0], C[1]+4, RX*2*0.9, RY*2*0.9), fuell("#D9442C")),
    gruppe(ell(C[0]-40, C[1]-60, RX*2*0.96, RY*2*0.9), fuell("#F9C979", 70)),
    gruppe(ell(C[0], C[1], RX*2, RY*2), verlauf([(0, "#F4B45C"), (1, "#D5822F")], [C[0], C[1]-200], [C[0], C[1]+200])),
    gruppe(ell(C[0], C[1]+14, RX*2, RY*2), fuell("#A85F22")),
], p=(C[0], C[1]), a=(C[0], C[1]),
   s=kf([(0, [70, 70, 100]), (8, [106, 106, 100]), (14, [98, 98, 100]), (20, [100, 100, 100])], "weich"),
   o=kf([(0, 0), (4, 100)], "linear"))

# ── Stück ──────────────────────────────────────────────────────────
stueck_formen = [
    *peperoni(*ell_pkt(-20, 0.55), 0.8), *peperoni(*ell_pkt(-30, 0.78), 0.7),
    gruppe(pfad(keil(0.84)), verlauf([(0, "#FFE38E"), (1, "#FFC53D")], [C[0], C[1]-60], [C[0]+300, C[1]])),
    gruppe(pfad(keil(0.9)), fuell("#D9442C")),
    gruppe(pfad(keil(1.0)), verlauf([(0, "#F5B75F"), (1, "#D07C2C")], [C[0], C[1]-80], [C[0]+320, C[1]])),
    gruppe(pfad(keil(1.0, 0, 14)), fuell("#9C561E")),
]
def spur(fn):
    """Keyframes je Bild aus BILDER_POSE, linear — stimmt mit den Fäden überein."""
    return {"a": 1, "k": [dict({"t": t, "s": fn(t)}, **({"o": {"x": [0]*len(fn(t)), "y": [0]*len(fn(t))},
                                                     "i": {"x": [1]*len(fn(t)), "y": [1]*len(fn(t))}} if n < len(BILDER_POSE)-1 else {}))
                           for n, t in enumerate(BILDER_POSE)]}
stueck = ebene("Stück", stueck_formen,
               p=spur(lambda t: [C[0]+pose(t)[0], C[1]+pose(t)[1], 0]), a=(C[0], C[1]),
               r=spur(lambda t: [pose(t)[2]]), o=kf([(0, 0), (4, 100)], "linear"), eltern=pizza["ind"])

# ── Käsefäden ──────────────────────────────────────────────────────
ANKER = [ell_pkt(-24, 0.12), ell_pkt(-40, 0.45), ell_pkt(-8, 0.5), ell_pkt(-26, 0.7)]
def faden_pfad(a, t):
    b = welt(a, t); dist = math.hypot(b[0]-a[0], b[1]-a[1])
    sack = 30 + dist*0.18
    m = ((a[0]+b[0])/2, (a[1]+b[1])/2 + sack)
    return [(a[0], a[1], (0, 0), (0, sack*0.6)), (m[0], m[1], (-(b[0]-a[0])*0.25, 0), ((b[0]-a[0])*0.25, 0)),
            (b[0], b[1], (0, sack*0.6), (0, 0))]
def faden(a, dicke):
    schritte = [(t, faden_pfad(a, t)) for t in BILDER_POSE]
    pk = pfad_anim(schritte, zu=False, kurve="linear")
    breite = lambda f: kf([(18, dicke*f), (48, dicke*0.6*f), (99, dicke*0.64*f)], "raus")
    return [gruppe(pk, strich("#FFF6CF", breite(0.28), 90)),
            gruppe(pk, strich("#FFD659", breite(1.0))),
            gruppe(pk, strich("#E9A62B", breite(1.35)))]
faeden = ebene("Käsefäden", sum([faden(a, d) for a, d in zip(ANKER, [40, 32, 30, 26])], []),
               o=kf([(18, 0), (22, 100)], "linear"), eltern=pizza["ind"])

schreiben("pizzakaese.json", "pizza", [stueck, faeden, pizza, brett])
