"""Eigenes bewegtes Cocktail-Zeichen im Noto-Stil (1024×1024, 60 fps, 100 Bilder).

Ein Martiniglas mit Sonnenuntergangs-Verlauf schwingt herein, eine
Kirsche plumpst hinein (Spritzer fliegen), die Orangenscheibe sitzt am
Rand, zum Schluss klappt ein Papierschirmchen federnd auf; Bläschen
steigen. Ruhebild = letztes Bild."""
import math
from lottie_bau import *

KELCH = [(252, 300, (0, 0), (30, 112)), (512, 574, (-96, -6), (96, -6)), (772, 300, (-30, 112), (0, 0))]
FLUESSIG = [(290, 330, (0, 0), (24, 90)), (512, 548, (-80, -6), (80, -6)), (734, 330, (-24, 90), (0, 0))]

glas = ebene("Glas", [
    # Glanz auf dem Kelch
    gruppe(pfad([(300, 332, (0, 0), (10, 60)), (420, 500, (-40, -30), (0, 0))], False), strich("#FFFFFF", 14, 85)),
    # Rand
    gruppe(ell(512, 300, 520, 70), strich("#FFFFFF", 8, 90)),
    gruppe(ell(512, 300, 520, 70), strich("#A9CFE0", 16)),
    # Zuckerrand
    gruppe(*[ell(512 + 256*math.cos(w), 300 + 34*math.sin(w), 12, 10) for w in [i*math.pi/9 for i in range(18)]], fuell("#FFFFFF")),
    # Oberfläche + Flüssigkeit
    gruppe(ell(512, 330, 444, 52), verlauf([(0, "#FFD2A8"), (1, "#FFB07A")], [300, 330], [730, 330])),
    gruppe(pfad(FLUESSIG), verlauf([(0, "#FFB547"), (0.55, "#FF7A63"), (1, "#E24C7A")], [512, 330], [512, 548])),
    # Kelch (Glas)
    gruppe(pfad(KELCH), strich("#BFE0EE", 12)),
    gruppe(pfad(KELCH), fuell("#E9F7FF", 55)),
    gruppe(pfad(KELCH), strich("#86B6CB", 22)),
    # Stiel und Fuß
    gruppe(rechteck(512, 690, 22, 240, 10), verlauf([(0, "#FFFFFF"), (1, "#B8D8E6")], [500, 690], [524, 690])),
    gruppe(ell(512, 812, 300, 56), verlauf([(0, "#F4FBFF"), (1, "#B5D6E4")], [512, 790], [512, 840])),
    gruppe(ell(512, 820, 300, 56), fuell("#86B6CB")),
], p=kf([(0, [512, 812, 0]), (18, [512, 812, 0])], "weich"), a=(512, 812),
   r=kf([(0, -14), (10, 5), (18, -2), (26, 0)], "weich"),
   s=kf([(0, [60, 60, 100]), (10, [104, 104, 100]), (18, [99, 99, 100]), (26, [100, 100, 100])], "weich"),
   o=kf([(0, 0), (4, 100)], "linear"))

schatten = ebene("Schatten", [gruppe(ell(512, 880, 420, 50), fuell("#2A1A14", 13))])

# ── Orangenscheibe am Rand ─────────────────────────────────────────
segmente = [gruppe(pfad([(0, 0), (round(math.cos(i*math.pi/4)*56, 1), round(math.sin(i*math.pi/4)*56, 1))], False),
                   strich("#FFE7B8", 7)) for i in range(8)]
orange = ebene("Orange", segmente + [
    gruppe(ell(0, 0, 118, 118), verlauf([(0, "#FFC34D"), (1, "#FF9A1F")], [-40, -40], [40, 40])),
    gruppe(ell(0, 0, 134, 134), fuell("#FFF0CC")),
    gruppe(ell(0, 0, 152, 152), fuell("#F07A12")),
    gruppe(ell(4, 6, 152, 152), fuell("#B85408")),
], p=(292, 290), r=-18, s=kf([(8, [0, 0, 100]), (18, [112, 112, 100]), (26, [100, 100, 100])], "raus"))

# ── Kirsche ────────────────────────────────────────────────────────
kirsche = ebene("Kirsche", [
    gruppe(pfad([(0, -30), (20, -100, (-6, 30), (0, 0))], False), strich("#6B8E23", 8)),
    gruppe(ell(-14, -12, 18, 22), fuell("#FFFFFF", 80)),
    gruppe(ell(0, 0, 70, 66), verlauf([(0, "#FF4D5E"), (1, "#A10F24")], [-20, -24], [20, 30])),
], p=kf([(0, [560, -140, 0]), (30, [560, -140, 0]), (44, [560, 334, 0]), (50, [560, 316, 0]), (56, [560, 334, 0])],
        ["linear", "rein", "raus", "weich"]),
   s=kf([(43, [100, 100, 100]), (46, [118, 84, 100]), (51, [96, 104, 100]), (58, [100, 100, 100])], "weich"),
   o=kf([(29, 0), (31, 100)], "linear"))
def spritzer(dx, dy, g):
    return gruppe(ell(0, 0, g, g), fuell("#FF8A6A"),
                  p=kf([(44, [560, 330]), (60, [560+dx, 330+dy]), (72, [560+dx*1.2, 330+dy+60])], ["raus", "rein"]),
                  o=kf([(44, 0), (46, 100), (66, 100), (72, 0)], "linear"))
spritzer_eb = ebene("Spritzer", [spritzer(-90, -110, 22), spritzer(-40, -150, 16), spritzer(50, -140, 18), spritzer(100, -90, 20), spritzer(10, -170, 12)])

# ── Schirmchen ─────────────────────────────────────────────────────
dach = []
for i in range(4):
    w0, w1 = 180 + i*45, 180 + (i+1)*45
    bogen = kreisbogen(0, 0, 110, 70, w0, w1, 2)
    dach.append(gruppe(pfad([(0, 0)] + bogen), fuell(["#3FB6C8", "#FFFFFF", "#3FB6C8", "#FFFFFF"][i])))
schirm = ebene("Schirmchen", [
    gruppe(ell(0, -72, 12, 12), fuell("#F2B84B")),
    *dach,
    gruppe(pfad(kreisbogen(0, 4, 112, 74, 180, 360, 4), False), strich("#1E7F8F", 10)),
    gruppe(pfad([(0, -70), (0, 140)], False), strich("#C98A4E", 9)),
], p=(676, 352), a=(0, 140), r=20,
   s=kf([(58, [8, 100, 100]), (68, [112, 100, 100]), (74, [95, 100, 100]), (80, [100, 100, 100])], "raus"),
   o=kf([(56, 0), (58, 100)], "linear"))

# ── Bläschen ───────────────────────────────────────────────────────
def blase(x, t, g):
    return gruppe(ell(0, 0, g, g), strich("#FFFFFF", 4, 90),
                  p=kf([(t, [x, 520]), (t+40, [x+8, 360])], "weich"), o=kf([(t, 0), (t+6, 100), (t+36, 100), (t+40, 0)], "linear"))
blasen = ebene("Bläschen", [blase(480, 20, 18), blase(540, 36, 14), blase(500, 52, 20), blase(560, 60, 12), blase(470, 58, 14)])

schreiben("cocktailglas.json", "cocktail", [schirm, spritzer_eb, kirsche, orange, blasen, glas, schatten])
