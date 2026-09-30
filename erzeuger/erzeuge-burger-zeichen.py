"""Eigenes bewegtes Burger-Zeichen im Noto-Stil (1024×1024, 60 fps, 100 Bilder).

Die Schichten fallen nacheinander von oben aufeinander und federn beim
Landen (Boden, Patty, Käse, Tomate, Salat, Deckel mit Sesam), der Käse
läuft an den Ecken herunter, dahinter schlagen Grillflammen hoch und
flackern. Ruhebild = letztes Bild."""
import math
from lottie_bau import *

def verschoben(form, dx, dy): return [(x+dx, y+dy, i, o) for x, y, i, o in form]

def faellt(name, formen, unten, t, huepf=1.0):
    return ebene(name, formen, a=(512, unten),
        p=kf([(0, [512, unten-520, 0]), (t, [512, unten-520, 0]), (t+10, [512, unten, 0]),
              (t+14, [512, unten-26*huepf, 0]), (t+19, [512, unten, 0])], ["linear", "rein", "raus", "rein"]),
        s=kf([(t+9, [100, 100, 100]), (t+11, [100+12*huepf, 100-15*huepf, 100]), (t+19, [100, 100, 100]),
              (t+21, [104, 95, 100]), (t+27, [100, 100, 100])], "weich"),
        o=kf([(t-1, 0), (t, 100)], "linear"))

# ── Boden ──────────────────────────────────────────────────────────
boden = faellt("Boden", [
    gruppe(pfad(glatt([(260, 742), (512, 732), (764, 742)], zu=False), False), strich("#FFD891", 10, 70)),
    gruppe(rechteck(512, 770, 560, 96, 44), verlauf([(0, "#F6BE65"), (1, "#D78330")], [512, 722], [512, 818])),
    gruppe(rechteck(512, 784, 560, 96, 44), fuell("#A45A1C")),
], 832, 4, 0.8)

# ── Patty ──────────────────────────────────────────────────────────
krumen = gruppe(*[ell(x, y, w, w*0.7) for x, y, w in
                  [(300, 690, 14), (370, 704, 10), (450, 684, 12), (540, 700, 14), (620, 686, 10), (700, 702, 12), (410, 716, 9), (660, 716, 9)]],
                fuell("#9A5F36"))
patty = faellt("Patty", [
    krumen,
    gruppe(pfad(glatt([(250, 670), (512, 658), (774, 670)], zu=False), False), strich("#A86A40", 9, 80)),
    gruppe(rechteck(512, 692, 628, 96, 46), verlauf([(0, "#8A4E2A"), (1, "#512914")], [512, 644], [512, 740])),
    gruppe(rechteck(512, 704, 628, 96, 46), fuell("#341709")),
], 752, 10)

# ── Käse mit Tropfen ───────────────────────────────────────────────
def tropfen(x, t, laenge):
    return gruppe(pfad([(-26, 0), (26, 0), (18, laenge*0.7, (4, -10), (0, 14)), (0, laenge, (10, 0), (-10, 0)),
                        (-18, laenge*0.7, (0, 14), (-4, -10))]),
                  verlauf([(0, "#FFCB35"), (1, "#F0A21A")], [0, 0], [0, laenge]),
                  p=(x, 646), s=kf([(t, [100, 0]), (t+22, [100, 100])], "raus"))
kaese = faellt("Käse", [
    gruppe(pfad(glatt([(236, 628), (512, 622), (788, 628)], zu=False), False), strich("#FFF0A8", 8, 90)),
    tropfen(300, 30, 70), tropfen(470, 34, 48), tropfen(640, 32, 82), tropfen(748, 36, 44),
    gruppe(pfad([(212, 624), (512, 610), (812, 624), (800, 650), (224, 650)]), verlauf([(0, "#FFD84A"), (1, "#F5AE1E")], [512, 610], [512, 650])),
], 650, 16, 0.6)

# ── Tomate ─────────────────────────────────────────────────────────
tomate = faellt("Tomate", [
    gruppe(*[ell(x, 600, 70, 14) for x in (340, 470, 600, 700)], fuell("#FF8C7A", 80)),
    gruppe(rechteck(512, 602, 580, 40, 20), verlauf([(0, "#FF5A45"), (1, "#C7291C")], [512, 582], [512, 622])),
], 622, 22, 0.5)

# ── Salat ──────────────────────────────────────────────────────────
welle = []
for i in range(15):
    x = 196 + i*45; welle.append((x, 586 + (22 if i % 2 else 4)))
salat_form = [(210, 548, (0, 0), (0, 0)), (814, 548, (0, 0), (0, 0))] + \
             [(x, y, (12, 0), (-12, 0)) for x, y in reversed(welle)]
salat = faellt("Salat", [
    gruppe(pfad(glatt([(240, 556), (512, 546), (784, 556)], zu=False), False), strich("#C9F28A", 8, 80)),
    gruppe(pfad(salat_form), verlauf([(0, "#8ED34B"), (1, "#3E9B32")], [512, 546], [512, 610])),
    gruppe(pfad(verschoben(salat_form, 0, 8)), fuell("#2C7A2A")),
], 600, 26, 0.5)

# ── Deckel ─────────────────────────────────────────────────────────
DECKEL = [(212, 566, (0, 0), (-4, -150)), (512, 318, (-190, 0), (190, 0)), (812, 566, (4, -150), (0, 0))]
def sesam(x, y, w):
    return gruppe(gruppe(ell(0, 0, 24, 13), fuell("#FFF4D8")), gruppe(ell(2, 4, 24, 13), fuell("#B8732E", 70)), p=(x, y), r=w)
deckel = faellt("Deckel", [
    *[sesam(x, y, w) for x, y, w in [(420, 380, -20), (512, 360, 5), (604, 380, 25), (350, 440, -40), (470, 430, 10),
                                      (560, 432, -15), (670, 440, 35), (300, 510, -50), (730, 510, 45)]],
    gruppe(ell(0, 0, 170, 64), fuell("#FFFFFF", 32), p=(420, 404), r=-22),
    gruppe(pfad(DECKEL), verlauf([(0, "#FAC56E"), (0.7, "#E6973D"), (1, "#C9762A")], [512, 318], [512, 566])),
    gruppe(pfad(verschoben(DECKEL, 0, 14)), fuell("#9C561C")),
], 580, 34, 1.4)

# ── Flammen ────────────────────────────────────────────────────────
def zunge(x, hoehe, breite, phase, k):
    lean = 18*math.sin(phase + k*1.3); h = hoehe*(1 + 0.08*math.sin(phase*2 + k))
    return [(x - breite, 0, (0, 0), (-breite*0.1, -h*0.35)),
            (x - breite*0.35 + lean*0.5, -h*0.6, (-breite*0.3, h*0.2), (breite*0.1, -h*0.15)),
            (x + lean, -h, (-breite*0.15, h*0.12), (breite*0.15, h*0.12)),
            (x + breite*0.35 + lean*0.5, -h*0.6, (-breite*0.1, -h*0.15), (breite*0.3, h*0.2)),
            (x + breite, 0, (breite*0.1, -h*0.35), (0, 0))]
def flamme(x, hoehe, breite, seed):
    schritte_a = [(t, zunge(x, hoehe, breite, seed, n)) for n, t in enumerate(range(40, 100, 7))] + [(99, zunge(x, hoehe, breite, seed, 9))]
    schritte_i = [(t, zunge(x, hoehe*0.58, breite*0.5, seed+1, n)) for n, t in enumerate(range(40, 100, 7))] + [(99, zunge(x, hoehe*0.58, breite*0.5, seed+1, 9))]
    return [gruppe(pfad_anim(schritte_i), verlauf([(0, "#FFF3A0"), (1, "#FFC22E")], [x, -hoehe*0.6], [x, 0])),
            gruppe(pfad_anim(schritte_a), verlauf([(0, "#FFB02E"), (0.6, "#FF6A1F"), (1, "#E0361A")], [x, -hoehe], [x, 0]))]
flammen = ebene("Flammen",
    flamme(196, 360, 62, 0.3) + flamme(262, 270, 52, 1.9) + flamme(762, 270, 52, 2.7) + flamme(828, 360, 62, 4.1),
    p=(0, 812), a=(0, 0), s=kf([(38, [100, 0, 100]), (52, [100, 108, 100]), (60, [100, 100, 100])], "raus"),
    o=kf([(38, 0), (42, 100)], "linear"))

schatten = ebene("Schatten", [gruppe(ell(512, 872, 720, 60), fuell("#2A1A14", 16))])

schreiben("burgerstapel.json", "burger", [deckel, salat, tomate, kaese, patty, boden, flammen, schatten])
