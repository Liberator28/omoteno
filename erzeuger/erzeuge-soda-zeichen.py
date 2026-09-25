"""Eigenes bewegtes Soda-Zeichen im Noto-Stil (1024×1024, 60 fps, 100 Bilder).
Eine grüne Glasflasche mit Zitronen-Etikett wird geschüttelt, der rote
Kronkorken springt ab, Schaum und Tropfen spritzen aus dem Hals. Ruhebild =
letztes Bild: die offene Flasche mit Schaumkrone (nichts Leeres, nichts
Halbes — dieselbe Regel wie beim Crêpe, BZ_RUHE).

Es gibt kein Unicode-Emoji für eine Sodaflasche; auf dem Gerät steht
ersatzweise 🥤 (BZ_EIGEN.soda in hub.vorlage.html)."""
import json, os
K = 0.5523
def col(h, a=1):
    h = h.lstrip("#"); return [int(h[i:i+2],16)/255 for i in (0,2,4)] + [a]
def st(v): return {"a":0,"k":v}
def pfad(punkte, zu=True):
    return {"ty":"sh","ks":{"a":0,"k":{"c":zu,"v":[[p[0],p[1]] for p in punkte],
            "i":[list(p[2]) for p in punkte],"o":[list(p[3]) for p in punkte]}}}
def fuell(f, a=100): return {"ty":"fl","c":st(col(f)),"o":st(a),"r":1}
def tr(): return {"ty":"tr","p":st([0,0]),"a":st([0,0]),"s":st([100,100]),"r":st(0),"o":st(100)}
def gruppe(*teile): return {"ty":"gr","it":list(teile)+[tr()]}
def ell(x,y,w,h): return {"ty":"el","p":st([x,y]),"s":st([w,h])}
def rechteck(x,y,w,h,r): return {"ty":"rc","p":st([x,y]),"s":st([w,h]),"r":st(r)}
def kf(schritte, dim, weich=(0.45,0.3)):
    out=[]
    for i,(t,v) in enumerate(schritte):
        k={"t":t,"s":v if isinstance(v,list) else [v]}
        if i < len(schritte)-1:
            k.update({"i":{"x":[weich[1]]*dim,"y":[1]*dim},"o":{"x":[weich[0]]*dim,"y":[0]*dim}})
        out.append(k)
    return {"a":1,"k":out}
def ebene(name, formen, ks=None, ind=1, parent=None):
    k = ks or {}
    e = {"ddd":0,"ind":ind,"ty":4,"nm":name,"sr":1,"ip":0,"op":100,"st":0,"bm":0,
         "ks":{"o":k.get("o",st(100)),"r":k.get("r",st(0)),"p":k.get("p",st([0,0,0])),
               "a":k.get("a",st([0,0,0])),"s":k.get("s",st([100,100,100]))},
         "ao":0,"shapes":formen}
    if parent: e["parent"] = parent
    return e

# ── Flasche (Koordinaten im Bild; Ebene dreht um den Boden 512/912) ──
def flasche_umriss(d=0):
    # d: Aufweitung für den dunklen Rand
    L, R, Hl, Hr = 380-d, 644+d, 464-d, 560+d
    return pfad([
        (Hl, 214-d, (0,0), (0,0)),
        (Hl, 318,   (0,0), (0,60)),
        (L,  468,   (0,-70), (0,0)),
        (L,  872,   (0,0), (0,24+d)),
        (L+40, 914+d, (-24,0), (0,0)),
        (R-40, 914+d, (0,0), (24,0)),
        (R,  872,   (0,24+d), (0,0)),
        (R,  468,   (0,0), (0,-70)),
        (Hr, 318,   (0,60), (0,0)),
        (Hr, 214-d, (0,0), (0,0)),
    ])
glas_rand  = gruppe(flasche_umriss(14), fuell("#23704D"))
glas       = gruppe(flasche_umriss(0),  fuell("#5FC08E"))
fluessig   = gruppe(rechteck(512, 700, 236, 392, 30), fuell("#9BE6B8"))
glanz      = gruppe(rechteck(424, 640, 34, 360, 17), fuell("#FFFFFF", 55))
glanz_hals = gruppe(rechteck(484, 270, 16, 90, 8),   fuell("#FFFFFF", 50))
etikett_r  = gruppe(rechteck(512, 668, 280, 176, 22), fuell("#C98A12"))
etikett    = gruppe(rechteck(512, 668, 264, 160, 18), fuell("#F7C948"))
zitrone_s  = gruppe(ell(512, 668, 112, 112), fuell("#FFFFFF"))
zitrone    = gruppe(ell(512, 668, 96, 96), fuell("#FFE066"))
zitrone_k  = gruppe(*[ell(512+30*dx, 668+30*dy, 20, 28) for dx,dy in
                     [(0,-1),(0.87,-0.5),(0.87,0.5),(0,1),(-0.87,0.5),(-0.87,-0.5)]], fuell("#FFF3B0"))
# Bläschen im Glas: steigen einmal auf (Ebene mit eigener Bewegung)
blasen_f = [gruppe(ell(x, 0, r, r), fuell("#E9FFF1", 85)) for x, r in [(470,22),(548,16),(508,12),(580,18),(446,14)]]

flasche = ebene("Flasche", [glanz_hals, glanz, zitrone_k, zitrone, zitrone_s, etikett, etikett_r,
                             fluessig, glas, glas_rand], {
    "a": st([512, 912, 0]), "p": st([512, 912, 0]),
    # schütteln, dann beim Knall kurz stauchen
    "r": kf([(0,[0]),(4,[-7]),(8,[7]),(12,[-7]),(16,[7]),(20,[-3]),(24,[0])], 1, (0.4,0.6)),
    "s": kf([(0,[100,100,100]),(24,[100,100,100]),(28,[105,93,100]),(34,[98,103,100]),(42,[100,100,100])], 3)},
    ind=10)

blasen = ebene("Bläschen", blasen_f, {
    "p": kf([(0,[0,860,0]),(60,[0,520,0])], 3, (0.3,0.7)),
    "o": kf([(0,[0]),(6,[100]),(50,[100]),(60,[0])], 1)}, ind=9, parent=10)

# ── Kronkorken: sitzt auf dem Hals, springt beim Bild 24 ab ──
korken_f = [gruppe(rechteck(0, 0, 124, 40, 8), fuell("#B8202E")),
            gruppe(*[rechteck(-48+16*i, 22, 10, 14, 3) for i in range(7)], fuell("#B8202E")),
            gruppe(rechteck(-18, -8, 60, 10, 5), fuell("#FF8A94", 90))]
korken = ebene("Kronkorken", korken_f, {
    "p": kf([(0,[512,196,0]),(24,[512,196,0]),(40,[736,-90,0])], 3, (0.2,0.8)),
    "r": kf([(24,[0]),(40,[560])], 1, (0.2,0.8)),
    "o": kf([(0,[100]),(36,[100]),(40,[0])], 1)}, ind=8, parent=10)

# ── Schaumkrone: wächst aus dem Hals und bleibt (Ruhebild) ──
# Weiß allein verschwindet auf hellem Grund (Bildprobe: auf der weißen
# Kachel war die Krone unsichtbar). Deshalb ein Minzrand dahinter.
_blasen = [(0,0,190,130),(-78,22,120,100),(78,22,120,100),(-34,-52,116,104),(40,-58,110,100),(0,-102,90,80)]
schaum_f = [gruppe(*[ell(x+8, y+10, w*0.7, h*0.5) for x,y,w,h in [(-30,-30,60,40),(34,-40,50,36)]], fuell("#FFFFFF")),
            gruppe(*[ell(x, y, w, h) for x,y,w,h in _blasen], fuell("#F4FFF8")),
            gruppe(*[ell(x, y, w+18, h+18) for x,y,w,h in _blasen], fuell("#8FD3AE"))]
schaum = ebene("Schaum", schaum_f, {
    "a": st([0, 40, 0]), "p": st([512, 214, 0]),
    "s": kf([(0,[0,0,100]),(25,[0,0,100]),(34,[128,128,100]),(44,[92,92,100]),(54,[104,104,100]),(62,[100,100,100])], 3),
    "o": kf([(0,[0]),(25,[0]),(27,[100])], 1)}, ind=7, parent=10)

# Ein Schaumfaden läuft den Hals hinunter
faden = ebene("Schaumfaden", [gruppe(rechteck(0, 0, 30, 120, 15), fuell("#F4FFF8")),
                              gruppe(ell(0, 58, 40, 40), fuell("#F4FFF8")),
                              gruppe(rechteck(0, 0, 44, 132, 22), fuell("#8FD3AE")),
                              gruppe(ell(0, 58, 54, 54), fuell("#8FD3AE"))], {
    "a": st([0, -60, 0]), "p": st([546, 236, 0]),
    "s": kf([(0,[100,0,100]),(40,[100,0,100]),(70,[100,100,100])], 3),
    "o": kf([(0,[0]),(40,[0]),(42,[100])], 1)}, ind=6, parent=10)

# ── Spritzer: Tropfen fliegen im Bogen und vergehen ──
tropfen = []
# Scheitel der Bögen bleibt im Bild (y ≥ 30): Die erste Fassung flog bis
# y = −230 und wurde oben abgeschnitten — gesehen am Einzelbild 40.
ziele = [(-230,-150),(-150,-170),(-60,-170),(40,-170),(140,-165),(230,-150),(-300,-60),(300,-70),(-110,-120),(110,-130)]
for n,(dx,dy) in enumerate(ziele):
    start = 25 + (n % 4)
    gross = 48 + (n % 3) * 14
    tropfen.append(ebene("Tropfen %d" % n, [gruppe(ell(-gross*0.18, -gross*0.2, gross*0.32, gross*0.36), fuell("#FFFFFF")),
                                            gruppe(ell(0, 0, gross, gross*1.25), fuell("#6FCF9A" if n % 2 else "#A7E8C4"))], {
        "p": kf([(0,[512,200,0]),(start,[512,200,0]),(start+18,[512+dx,200+dy,0]),(start+40,[512+dx*1.15,200+dy+220,0])], 3, (0.25,0.75)),
        "s": kf([(start,[40,40,100]),(start+12,[100,100,100]),(start+40,[70,70,100])], 3),
        "o": kf([(0,[0]),(start,[0]),(start+2,[100]),(start+28,[100]),(start+40,[0])], 1)},
        ind=20+n))

boden = ebene("Schatten", [gruppe(ell(512, 930, 360, 56), fuell("#123A28", 18))], ind=30)

film = {"v":"5.8.1","fr":60,"ip":0,"op":100,"w":1024,"h":1024,"nm":"soda (omoteno, eigen)","ddd":0,"assets":[],
        "layers":tropfen + [schaum, faden, korken, blasen, flasche, boden]}
ziel = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "auslieferung", "emoji", "soda.json")
json.dump(film, open(ziel, "w"), separators=(",", ":"))
print("ok", len(json.dumps(film)))
