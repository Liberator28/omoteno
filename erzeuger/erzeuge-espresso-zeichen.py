"""Eigenes bewegtes Kaffee-Zeichen im Noto-Stil (1024×1024, 60 fps, 100 Bilder).

Eine Tasse landet federnd auf der Untertasse, auf der Crema zieht ein
Ring auf, ein Milchherz liegt obenauf, und drei weiche Dampfschwaden
wachsen hoch und wiegen sich. Ruhebild = letztes Bild (Dampf da)."""
import math
from lottie_bau import *

# ── Untertasse, Bohnen ─────────────────────────────────────────────
untertasse = ebene("Untertasse", [
    gruppe(ell(512, 752, 470, 118), verlauf([(0, "#E3E9EE"), (1, "#FFFFFF")], [512, 700], [512, 810])),
    gruppe(ell(512, 760, 760, 216), verlauf([(0, "#FFFFFF"), (1, "#D7E0E7")], [512, 660], [512, 860])),
    gruppe(ell(512, 776, 760, 216), fuell("#A9B8C4")),
])
schatten = ebene("Schatten", [gruppe(ell(512, 900, 640, 64), fuell("#2A1A14", 13))])
def bohne(x, y, w, t):
    return ebene("Bohne", [
        gruppe(pfad(glatt([(-6, -30), (4, 0), (-4, 30)], zu=False), False), strich("#2A140A", 7)),
        gruppe(ell(-8, -8, 14, 22), fuell("#A0643A", 80)),
        gruppe(ell(0, 0, 52, 74), verlauf([(0, "#8A4E27"), (1, "#4E2812")], [-20, -30], [20, 30])),
    ], p=(x, y), r=w,
       s=kf([(t, [0, 0, 100]), (t+8, [118, 118, 100]), (t+14, [100, 100, 100])], "raus"))

# ── Tasse ──────────────────────────────────────────────────────────
KOERPER = [(300, 470, (0, 0), (0, 0)), (724, 470, (0, 0), (0, 90)),
           (640, 716, (40, -40), (-40, 30)), (384, 716, (40, 30), (-40, -40))]
def verschoben(form, dx, dy): return [(x+dx, y+dy, i, o) for x, y, i, o in form]
herz = pfad([(512, 518, (0, 0), (0, 0)), (560, 478, (-10, 20), (14, -26)), (512, 470, (22, -14), (-22, -14)),
             (464, 478, (-14, -26), (10, 20))])
crema_ring = gruppe(ell_anim([512, 478], kf([(18, [40, 10]), (40, [330, 70])], "raus")),
                    strich("#F3D9B0", 6), o=kf([(18, 100), (42, 0)], "raus"))
tasse = ebene("Tasse", [
    gruppe(herz, fuell("#F7E9D2")),
    crema_ring,
    gruppe(ell(512, 478, 362, 70), verlauf([(0, "#D9A067"), (1, "#A8622E")], [512, 440], [512, 520])),
    gruppe(ell(512, 480, 392, 82), fuell("#4A2716")),
    gruppe(ell(512, 470, 424, 104), verlauf([(0, "#FFFFFF"), (1, "#E4EAF0")], [512, 420], [512, 520])),
    gruppe(pfad([(328, 500, (0, 0), (0, 0)), (352, 690, (-6, -80), (0, 0))], False), strich("#FFFFFF", 16, 90)),
    gruppe(pfad(KOERPER), verlauf([(0, "#FFFFFF"), (0.55, "#F1F4F7"), (1, "#C9D4DD")], [300, 600], [724, 600])),
    gruppe(pfad(verschoben(KOERPER, 0, 12)), fuell("#98A9B7")),
    gruppe(ell(746, 592, 118, 136), strich("#F4F7F9", 30)),
    gruppe(ell(750, 600, 118, 136), strich("#9FB0BE", 42)),
], p=kf(feder(0, [0, -360, 0], [0, 0, 0], 22, 0.06), "weich"),
   a=(512, 716), s=kf([(0, [100, 100, 100]), (10, [100, 100, 100]), (13, [110, 88, 100]), (19, [97, 104, 100]), (26, [100, 100, 100])], "weich"))
tasse["ks"]["p"] = kf([(0, [512, 356, 0]), (12, [512, 716, 0]), (17, [512, 700, 0]), (22, [512, 716, 0])], ["rein", "raus", "weich"])

# ── Dampf ──────────────────────────────────────────────────────────
def schwade(x, t0, richtung):
    def form(phase):
        pkt = []
        for i in range(6):
            u = i/5; y = 430 - u*280
            pkt.append((x + richtung*34*math.sin(u*math.pi*1.6 + phase)*(0.4 + u), y))
        return glatt(pkt, zu=False, spannung=0.33)
    schritte = [(t0 + k*14, form(k*0.9)) for k in range(0, 8) if t0 + k*14 <= 99]
    if schritte[-1][0] < 99: schritte.append((99, form(len(schritte)*0.9)))
    pk = pfad_anim(schritte, zu=False)
    z = zug([(t0, 0), (t0+34, 100)], kurve="raus")
    return [gruppe(pk, z, strich("#FFFFFF", 30, 72)), gruppe(pk, zug([(t0, 0), (t0+34, 100)], kurve="raus"), strich("#C8D2DA", 40, 40))]
dampf = ebene("Dampf", schwade(450, 22, 1) + schwade(522, 30, -1) + schwade(592, 26, 1),
              o=kf([(20, 0), (30, 100)], "linear"))

schreiben("espresso.json", "espresso", [dampf, tasse, bohne(264, 752, -30, 26), bohne(330, 800, 20, 32), untertasse, schatten])
