"""Eigenes bewegtes Pancake-Zeichen im Noto-Stil (1024×1024, 60 fps, 100 Bilder).

Wunsch 10.10.: „echte Pancakes, die sich stapeln“. Vier goldene Pancakes
fallen nacheinander auf den Teller und federn beim Landen (Squash &
Stretch), jeder etwas anders breit und leicht versetzt — ein Stapel aus
der Pfanne, kein Turm aus dem Baukasten. Dann landet ein Stück Butter
und schmilzt, Ahornsirup breitet sich oben aus und läuft an den Seiten
herunter, zum Schluss drei Blaubeeren. Ruhebild = letztes Bild.

Schräg von oben gesehen wie Notos 🥞 (die Oberseite ist eine hohe
Ellipse, keine Linie) und groß im Feld: Bei 48 px zählt jede Einheit.
Die Streifen-Fassung („pfannkuchen“, Pfannkuchen wie Fettuccine) bleibt
als eigenes Zeichen wählbar."""
from lottie_bau import *

DICKE = 104        # amerikanisch: dick und fluffig
OBERSEITE = 176    # Höhe der Oberseiten-Ellipse = Blickwinkel von oben
BODEN = 780        # Unterkante des untersten Pancakes

# ── Teller und Schatten ─────────────────────────────────────────────
teller = ebene("Teller", [
    gruppe(ell(512, BODEN + 6, 820, 150), verlauf([(0, "#FFFFFF"), (1, "#E9EEF2")], [512, BODEN - 70], [512, BODEN + 80])),
    gruppe(ell(512, BODEN + 18, 1000, 230), verlauf([(0, "#EEF2F5"), (1, "#CFD9E1")], [512, BODEN - 100], [512, BODEN + 130])),
    gruppe(ell(512, BODEN + 34, 1000, 230), fuell("#AEBCC8")),
])
schatten = ebene("Schatten", [gruppe(ell(512, BODEN + 148, 880, 56), fuell("#2A1A14", 13))])

# ── Ein Pancake: Oberseite, goldene Seite, gebräunte Unterkante ─────
def pancake(breite, flecken):
    h, o = DICKE, OBERSEITE
    tupfen = gruppe(*[ell(x, -h*0.5 + y, w, w*0.5) for x, y, w in flecken], fuell("#B36A2B", 50))
    return [
        gruppe(ell(-breite*0.16, -h - o*0.22, breite*0.36, o*0.16), fuell("#FFFFFF", 40)),      # Glanz
        gruppe(ell(0, -h + 4, breite - 36, o), verlauf([(0, "#FCDDA0"), (1, "#EDB15C")], [0, -h - o/2], [0, -h + o/2])),
        tupfen,
        gruppe(rechteck(0, -h/2, breite, h, h/2), verlauf([(0, "#F0AA56"), (0.5, "#DC8D3C"), (1, "#B1632A")], [0, -h], [0, 0])),
        gruppe(rechteck(0, -h/2 + 10, breite, h, h/2), fuell("#874516")),
    ]

def faellt(name, formen, x, unten, t, huepf=1.0):
    """Fällt von oben, landet bei `unten` (Unterkante), federt: Stauchen, Strecken, Ruhe."""
    return ebene(name, formen, a=(0, 0),
        p=kf([(0, [x, unten - 1000, 0]), (t, [x, unten - 1000, 0]), (t + 10, [x, unten, 0]),
              (t + 14, [x, unten - 30*huepf, 0]), (t + 19, [x, unten, 0])], ["linear", "rein", "raus", "rein"]),
        s=kf([(t + 9, [100, 100, 100]), (t + 11, [100 + 10*huepf, 100 - 18*huepf, 100]), (t + 19, [100, 100, 100]),
              (t + 21, [103, 96, 100]), (t + 27, [100, 100, 100])], "weich"),
        o=kf([(t - 1, 0), (t, 100)], "linear"))

STAPEL = [  # (Breite, x-Versatz, Landebild, Flecken (x, dy, Größe))
    (880, -10, 4,  [(-280, 8, 36), (180, 12, 26), (330, 0, 22)]),
    (846, 14, 16,  [(-300, 4, 24), (80, 14, 32), (290, -2, 20)]),
    (866, -14, 28, [(-200, 10, 30), (250, 2, 24)]),
    (830, 10, 40,  [(-290, 0, 22), (-30, 14, 26), (270, 6, 28)]),
]
pancakes = []
for k, (b, dx, t, fl) in enumerate(STAPEL):
    pancakes.append(faellt("Pancake " + str(k + 1), pancake(b, fl), 512 + dx, BODEN - k*DICKE, t, 1.0 - k*0.12))
pancakes.reverse()                     # der oberste zuerst = oben gezeichnet
OBEN = BODEN - (len(STAPEL) - 1)*DICKE  # Unterkante des obersten
DECKE = OBEN - DICKE + 4                # Mitte seiner Oberseite
X0 = 512 + STAPEL[-1][1]                # Mitte des obersten

# ── Ahornsirup: Lache oben, Tropfen an den Seiten ──────────────────
LACHE = glatt([(X0 - 300, DECKE - 6), (X0 - 190, DECKE - 62), (X0, DECKE - 74), (X0 + 190, DECKE - 58), (X0 + 312, DECKE - 2),
               (X0 + 270, DECKE + 46), (X0 + 80, DECKE + 66), (X0 - 120, DECKE + 64), (X0 - 270, DECKE + 40)], spannung=0.32)
def tropfen(x, y, t, laenge, breite=30):
    form = pfad([(-breite, 0, (0, 0), (0, 0)), (breite, 0, (0, 0), (0, 0)),
                 (breite*0.7, laenge*0.72, (2, -laenge*0.3), (0, laenge*0.12)),
                 (0, laenge, (breite*0.6, 0), (-breite*0.6, 0)),
                 (-breite*0.7, laenge*0.72, (0, laenge*0.12), (-2, -laenge*0.3))])
    return gruppe(gruppe(ell(-breite*0.25, laenge*0.8, breite*0.42, breite*0.7), fuell("#F2B068", 80)),
                  form, verlauf([(0, "#C9782C"), (1, "#8A4310")], [0, 0], [0, laenge]),
                  p=(x, y), s=kf([(t, [100, 0]), (t + 24, [100, 100])], "raus"))
sirup = ebene("Sirup", [
    gruppe(pfad(glatt([(X0 - 170, DECKE - 46), (X0, DECKE - 58), (X0 + 170, DECKE - 42)], zu=False), False),
           strich("#FFD08A", 14, 85)),
    gruppe(pfad(LACHE), verlauf([(0, "#D98A36"), (1, "#9A4D14")], [X0, DECKE - 74], [X0, DECKE + 66])),
    tropfen(X0 - 250, DECKE + 34, 64, 230, 32), tropfen(X0 - 90, DECKE + 60, 68, 120, 24),
    tropfen(X0 + 120, DECKE + 58, 66, 280, 34), tropfen(X0 + 262, DECKE + 34, 70, 170, 28),
], p=(X0, DECKE), a=(X0, DECKE),
   s=kf([(56, [20, 20, 100]), (64, [104, 104, 100]), (70, [100, 100, 100])], "raus"),
   o=kf([(55, 0), (57, 100)], "linear"))

# ── Butter: landet und schmilzt ────────────────────────────────────
butter_form = [
    gruppe(rechteck(-34, -76, 130, 16, 8), fuell("#FFFFFF", 55)),
    gruppe(rechteck(0, -50, 270, 70, 20), verlauf([(0, "#FFF6C2"), (1, "#FBE07A")], [0, -85], [0, -15])),
    gruppe(rechteck(0, -14, 270, 76, 22), verlauf([(0, "#F7D35A"), (1, "#E3AE2C")], [0, -52], [0, 24])),
]
butter = ebene("Butter", butter_form, a=(0, 0),
    p=kf([(0, [X0 + 6, DECKE - 800, 0]), (48, [X0 + 6, DECKE - 800, 0]), (56, [X0 + 6, DECKE - 6, 0]),
          (60, [X0 + 6, DECKE - 26, 0]), (64, [X0 + 6, DECKE - 6, 0])], ["linear", "rein", "raus", "rein"]),
    s=kf([(55, [100, 100, 100]), (57, [116, 80, 100]), (64, [100, 100, 100]), (92, [112, 76, 100])], ["weich", "weich", "weich"]),
    o=kf([(47, 0), (48, 100)], "linear"))

# ── Blaubeeren ─────────────────────────────────────────────────────
def beere():
    krone = gruppe(*[gruppe(rechteck(0, -32, 10, 16, 4), fuell("#1C2250"), r=w) for w in (-50, -15, 20, 55)])
    return [gruppe(ell(-11, -12, 20, 14), fuell("#FFFFFF", 55)), krone,
            gruppe(ell(0, 0, 92, 88), verlauf([(0, "#6C82E6"), (1, "#2A3577")], [-24, -28], [26, 34])),
            gruppe(ell(0, 6, 92, 88), fuell("#1C2250"))]
def beere_faellt(name, x, y, t):
    return ebene(name, beere(), a=(0, 0),
        p=kf([(0, [x, -140, 0]), (t, [x, -140, 0]), (t + 8, [x, y, 0]), (t + 12, [x, y - 18, 0]), (t + 16, [x, y, 0])],
             ["linear", "rein", "raus", "rein"]),
        s=kf([(t + 7, [100, 100, 100]), (t + 9, [118, 84, 100]), (t + 16, [100, 100, 100])], "weich"),
        o=kf([(t - 1, 0), (t, 100)], "linear"))
beeren = [beere_faellt("Blaubeere 1", X0 + 210, DECKE - 44, 72), beere_faellt("Blaubeere 2", X0 - 220, DECKE - 30, 76),
          beere_faellt("Blaubeere 3", 896, BODEN + 30, 80)]

schreiben("pancaketurm.json", "pancaketurm", beeren + [butter, sirup] + pancakes + [teller, schatten])
