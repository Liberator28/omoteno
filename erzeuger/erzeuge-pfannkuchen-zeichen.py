"""Eigenes bewegtes Pfannkuchen-Zeichen im Noto-Stil (1024×1024, 60 fps, 100 Bilder).

Wunsch: „zerschnittene Pfannkuchen wie Fettuccine serviert, mit
Schokosoße und Erdbeeren". Also kein Stapel, sondern ein Nest aus
goldenen Pfannkuchen-Bändern auf dem Teller — die Bänder legen sich
eines nach dem anderen hinein, die Schokoladensauce zieht sich glänzend
darüber und tropft, zwei halbe und eine ganze Erdbeere fallen federnd
darauf, zum Schluss Puderzucker. Ruhebild = letztes Bild."""
import math
from lottie_bau import *

# ── Teller ──────────────────────────────────────────────────────────
teller = ebene("Teller", [
    gruppe(ell(512, 668, 720, 196), verlauf([(0, "#FFFFFF"), (1, "#E9EEF2")], [512, 580], [512, 760])),
    gruppe(ell(512, 676, 900, 290), verlauf([(0, "#EEF2F5"), (1, "#CFD9E1")], [512, 540], [512, 820])),
    gruppe(ell(512, 694, 900, 290), fuell("#AEBCC8")),
])
schatten = ebene("Schatten", [gruppe(ell(512, 858, 760, 70), fuell("#2A1A14", 13))])

# ── Nest aus Bändern: hinten zuerst gezeichnet (also zuletzt genannt) ──
def band(j, n):
    y0 = 560 + j*22; breite = 210 + j*30; wel = 12 + j*3
    hoehe = 150 * (1 - j/(n+1.5))
    pkt = []
    for i in range(9):
        t = i/8
        x = 512 - breite + 2*breite*t + 14*math.sin(j*2.3)
        y = y0 - hoehe*math.sin(math.pi*t) + wel*math.sin(t*3*math.pi + j*1.7)
        pkt.append((x, y))
    form = glatt(pkt, zu=False, spannung=0.3)
    start = 2 + j*3
    z = lambda: zug([(start, 0), (start+22, 100)], kurve="raus")
    glanz = gruppe(pfad([(x, y-17, i, o) for x, y, i, o in form], False), z(), strich("#FFF1CC", 12, 90))
    rand = gruppe(pfad([(x, y+14, i, o) for x, y, i, o in form], False), z(), strich("#D98A34", 16))
    koerper = gruppe(pfad(form, False), z(), strich("#F4BC62", 60))
    kante = gruppe(pfad([(x, y+4, i, o) for x, y, i, o in form], False), z(), strich("#A95F1C", 72))
    return [glanz, rand, koerper, kante]
N = 6
baender = []
for j in reversed(range(N)): baender = band(j, N) + baender   # vordere (große j) zuerst = oben
nest = ebene("Nest", baender, p=(512, 650), a=(512, 650),
             s=kf([(0, [88, 88, 100]), (14, [104, 98, 100]), (24, [99, 101, 100]), (32, [100, 100, 100])], "weich"))

# ── Schokoladensauce ────────────────────────────────────────────────
sauce_pkt = [(250, 560), (320, 470), (400, 560), (480, 420), (560, 540), (640, 430), (720, 540), (780, 500)]
sauce_form = glatt(sauce_pkt, zu=False, spannung=0.28)
def sauce_zug(verschub, farbe, b, a=100, t=(26, 54)):
    return gruppe(pfad([(x+verschub[0], y+verschub[1], i, o) for x, y, i, o in sauce_form], False),
                  zug([(t[0], 0), (t[1], 100)]), strich(farbe, b, a))
def tropfen(x, y, t, laenge):
    form = pfad([(0, -6, (0, 0), (0, 0)), (14, laenge*0.6, (0, -laenge*0.3), (0, laenge*0.25)),
                 (0, laenge, (10, 0), (-10, 0)), (-14, laenge*0.6, (0, laenge*0.25), (0, -laenge*0.3))])
    return gruppe(gruppe(ell(-4, laenge*0.72, 7, 12), fuell("#A0633F")), form, fuell("#4E2614"),
                  p=(x, y), s=kf([(t, [100, 0]), (t+14, [100, 100])], "raus"))
sauce = ebene("Sauce", [
    sauce_zug((-5, -8), "#B77650", 8, 90, (30, 58)),
    sauce_zug((0, 0), "#5A2C15", 30),
    tropfen(322, 476, 46, 58), tropfen(560, 540, 50, 50), tropfen(722, 540, 54, 64), tropfen(400, 560, 56, 44),
    sauce_zug((0, 5), "#351709", 40),
])

# ── Erdbeeren ───────────────────────────────────────────────────────
HERZ = [(-64, -30, (0, 40), (0, -40)), (0, -62, (-42, 0), (42, 0)), (64, -30, (0, -40), (0, 40)), (0, 82, (52, -30), (-52, -30))]
def skaliert(form, f, dy=0):
    return [(x*f, y*f+dy, (i[0]*f, i[1]*f), (o[0]*f, o[1]*f)) for x, y, i, o in form]
def kelch():
    blatt = lambda w: gruppe(pfad([(0, 0, (0, 0), (0, 0)), (34, -8, (-14, -10), (10, 6)), (0, 10, (18, 2), (0, 0))]),
                             fuell("#3E9B4A"), r=w, p=(0, -58))
    return gruppe(gruppe(ell(0, -74, 14, 26), fuell("#2F7A38")), blatt(-150), blatt(-100), blatt(-60), blatt(-20), blatt(30))
def beere_halb():
    kerne = gruppe(*[ell(math.cos(w)*44, math.sin(w)*50+6, 7, 10) for w in [i*math.pi/5 for i in range(10)]], fuell("#FFE38F"))
    return [kelch(), kerne,
            gruppe(pfad(skaliert(HERZ, 0.42, -2)), fuell("#FFF3EE")),
            gruppe(pfad(skaliert(HERZ, 0.8, 2)), verlauf([(0, "#FFB3AE"), (1, "#FF6C74")], [0, -40], [0, 70])),
            gruppe(pfad(HERZ), fuell("#E22A3A")),
            gruppe(pfad(skaliert(HERZ, 1.06, 4)), fuell("#A5162A"))]
def beere_ganz():
    kerne = gruppe(*[ell(x, y, 8, 12) for x, y in [(-30, 0), (0, -24), (28, 2), (-10, 30), (18, 36), (0, 8), (-36, -28), (34, -26), (-22, 48), (8, 58)]], fuell("#FFE08A"))
    return [kelch(), gruppe(ell(-24, -18, 30, 46), fuell("#FF8C94", 70)), kerne,
            gruppe(pfad(HERZ), verlauf([(0, "#FF4B57"), (1, "#C41A2E")], [-40, -50], [40, 80])),
            gruppe(pfad(skaliert(HERZ, 1.06, 4)), fuell("#9E1426"))]
def faellt(name, formen, x, y, t, drehung, gross):
    q = gross
    return ebene(name, formen,
        p=kf([(0, [x, -140, 0]), (t-16, [x, -140, 0]), (t, [x, y, 0]), (t+6, [x, y-22, 0]), (t+12, [x, y, 0])], ["linear", "rein", "raus", "weich"]),
        s=kf([(t-1, [q, q, 100]), (t+2, [q*1.16, q*0.82, 100]), (t+7, [q*0.95, q*1.06, 100]), (t+14, [q, q, 100])], "weich"),
        r=kf([(t-16, drehung-24), (t, drehung+6), (t+14, drehung)], "weich"),
        o=kf([(t-17, 0), (t-15, 100)], "linear"))
beeren = [
    faellt("Erdbeere ganz", beere_ganz(), 512, 356, 64, 4, 112),
    faellt("Erdbeere halb 2", beere_halb(), 664, 440, 58, 22, 96),
    faellt("Erdbeere halb 1", beere_halb(), 356, 446, 52, -20, 100),
]

# ── Puderzucker ─────────────────────────────────────────────────────
punkte = [(300, 500), (360, 470), (430, 520), (470, 470), (560, 500), (610, 470), (700, 500), (740, 540),
          (330, 560), (600, 560), (460, 580), (680, 580), (400, 470), (560, 440)]
zucker = ebene("Puderzucker", [gruppe(*[ell(x, y, 13, 13) for x, y in punkte], fuell("#FFFFFF"))],
               p=kf([(74, [0, -26, 0]), (88, [0, 0, 0])], "raus"), o=kf([(72, 0), (82, 100)], "raus"))

schreiben("pfannkuchen.json", "pfannkuchen", [zucker] + beeren + [sauce, nest, teller, schatten])
