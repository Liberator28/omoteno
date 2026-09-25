"""Eigenes bewegtes Crêpe-Zeichen im Noto-Stil (1024×1024, 60 fps, 100 Bilder).
Ein gefalteter Halbmond-Crêpe auf einem Teller; der Schokoladenstreifen zieht
sich auf, eine Erdbeere fällt federnd darauf, Puderzucker rieselt. Ruhebild =
letztes Bild (alles sichtbar)."""
import json, math
K = 0.5523
def col(h, a=1):
    h = h.lstrip("#"); return [int(h[i:i+2],16)/255 for i in (0,2,4)] + [a]
def st(v): return {"a":0,"k":v}
def pfad(punkte, zu=True):
    # punkte: [(x,y,(inx,iny),(outx,outy))]
    return {"ty":"sh","ks":{"a":0,"k":{"c":zu,"v":[[p[0],p[1]] for p in punkte],
            "i":[list(p[2]) for p in punkte],"o":[list(p[3]) for p in punkte]}}}
def fuell(f, a=100): return {"ty":"fl","c":st(col(f)),"o":st(a),"r":1}
def strich(f, b): return {"ty":"st","c":st(col(f)),"o":st(100),"w":st(b),"lc":2,"lj":2}
def tr(): return {"ty":"tr","p":st([0,0]),"a":st([0,0]),"s":st([100,100]),"r":st(0),"o":st(100)}
def gruppe(*teile): return {"ty":"gr","it":list(teile)+[tr()]}
def ell(x,y,w,h): return {"ty":"el","p":st([x,y]),"s":st([w,h])}
def ease(): return {"i":{"x":[0.25],"y":[1]},"o":{"x":[0.4],"y":[0]}}
def kf(schritte, dim):
    out=[]
    for i,(t,v) in enumerate(schritte):
        k={"t":t,"s":v if isinstance(v,list) else [v]}
        if i < len(schritte)-1:
            k.update({"i":{"x":[0.3]*dim,"y":[1]*dim},"o":{"x":[0.45]*dim,"y":[0]*dim}})
        out.append(k)
    return {"a":1,"k":out}
def ebene(name, formen, ks=None, ind=1):
    k = ks or {}
    return {"ddd":0,"ind":ind,"ty":4,"nm":name,"sr":1,"ip":0,"op":100,"st":0,"bm":0,
            "ks":{"o":k.get("o",st(100)),"r":k.get("r",st(0)),"p":k.get("p",st([0,0,0])),
                  "a":k.get("a",st([0,0,0])),"s":k.get("s",st([100,100,100]))},
            "ao":0,"shapes":formen}

# Halbmond: flache Kante unten bei y=620, Scheitel oben
def halbmond(cx, y, rx, ry, sag=18):
    L=(cx-rx,y); T=(cx,y-ry); R=(cx+rx,y)
    return pfad([(L[0],L[1],(-0,sag*1.2),(0,-K*ry)), (T[0],T[1],(-K*rx,0),(K*rx,0)),
                 (R[0],R[1],(0,-K*ry),(-rx*0.4,sag))], True)

teller = gruppe(ell(512,760,980,300), fuell("#E6DED2"))
teller_innen = gruppe(ell(512,748,840,236), fuell("#FBF8F3"))
schatten = gruppe(ell(512,930,780,70), fuell("#2A1A14",14))
crepe_rand = gruppe(halbmond(512,740,420,500), fuell("#D9953F"))
crepe = gruppe(halbmond(512,726,404,484), fuell("#F2BE62"))
klappe = gruppe(halbmond(470,726,300,300,10), fuell("#E7A94E"))
klappe_licht = gruppe(halbmond(450,700,250,262,8), fuell("#F6CD7C"))
crepe_licht = gruppe(halbmond(430,640,170,160,6), fuell("#FADCA0",80))
falz = gruppe(pfad([(110,726,(0,0),(0,0)),(914,726,(0,0),(0,0))], False), strich("#C98233",26))
flecken = gruppe(*[ell(x,y,w,h) for x,y,w,h in [(260,600,40,26),(360,470,30,20),(640,380,34,22),(780,560,40,26),(540,300,26,18),(300,680,28,18),(700,680,32,20),(820,660,24,16)]], fuell("#C98233",70))
drizzle_pkt = [(190,640),(285,470),(380,650),(480,400),(580,660),(680,420),(770,640),(850,540)]
drizzle = {"ty":"gr","it":[
    pfad([(x,y,(-28,0),(28,0)) for x,y in drizzle_pkt], False),
    {"ty":"tm","s":st(0),"e":kf([(18,[0]),(52,[100])],1),"o":st(0),"m":1},
    strich("#4A2615",40), tr()]}
drizzle_glanz = {"ty":"gr","it":[
    pfad([(x+6,y-8,(-28,0),(28,0)) for x,y in drizzle_pkt], False),
    {"ty":"tm","s":st(0),"e":kf([(24,[0]),(58,[100])],1),"o":st(0),"m":1},
    strich("#7A4A2E",10), tr()]}
# Erdbeere (von oben, Herzform) mit Kelch
erd = [(-62,-40,(0,-34),(0,-34)),(0,-62,(-30,0),(30,0)),(62,-40,(0,-34),(0,34)),(0,78,(46,-20),(-46,-20))]
beere_koerper = gruppe(pfad([(x,y,i,o) for x,y,i,o in [(-64,-30,(0,40),(0,-40)),(0,-62,(-42,0),(42,0)),(64,-30,(0,-40),(0,40)),(0,80,(52,-30),(-52,-30))]]), fuell("#E23241"))
beere_licht = gruppe(ell(-22,-18,34,44), fuell("#F56A74",80))
kerne = gruppe(*[ell(x,y,9,12) for x,y in [(-30,0),(0,-24),(28,2),(-10,30),(18,36),(0,8),(-36,-30),(34,-28)]], fuell("#FFE08A"))
kelch = gruppe(*[ell(x,y,w,h) for x,y,w,h in [(-26,-66,48,24),(26,-66,48,24),(0,-74,26,40)]], fuell("#3E9B4A"))
beere = ebene("Erdbeere", [kelch, kerne, beere_licht, beere_koerper], {
    "s": st([175,175,100]),
    "p": kf([(0,[640,-60,0]),(34,[640,-60,0]),(52,[640,360,0]),(60,[640,336,0]),(68,[640,352,0]),(74,[640,348,0])],3),
    "o": kf([(0,[0]),(34,[0]),(38,[100])],1),
    "r": kf([(34,[-18]),(56,[8]),(70,[-4]),(78,[0])],1)}, ind=1)
banane = ebene("Banane", [gruppe(*[ell(x,y,96,84) for x,y in [(330,560),(470,610)]], fuell("#F7E7A1")), gruppe(*[ell(x,y,60,52) for x,y in [(330,560),(470,610)]], fuell("#EFD98A")), gruppe(*[ell(x,y,14,12) for x,y in [(330,560),(470,610)]], fuell("#B89A4A"))],
    {"o": kf([(0,[0]),(26,[0]),(32,[100])],1), "s": kf([(26,[80,80,100]),(36,[104,104,100]),(42,[100,100,100])],3), "a": st([400,585,0]), "p": st([400,585,0])}, ind=6)
zucker = ebene("Puderzucker", [gruppe(*[ell(x,y,16,16) for x,y in [(250,560),(330,420),(450,520),(560,330),(610,560),(720,470),(800,600),(400,680),(690,380),(520,680),(880,660),(180,690)]], fuell("#FFFFFF"))],
    {"o": kf([(0,[0]),(70,[0]),(84,[100])],1)}, ind=2)
crepe_eb = ebene("Crêpe", [drizzle_glanz, drizzle, flecken, falz, klappe_licht, klappe, crepe_licht, crepe, crepe_rand], {
    "a": st([512,726,0]), "p": st([512,726,0]),
    "s": kf([(0,[92,92,100]),(10,[106,96,100]),(20,[98,103,100]),(28,[100,100,100])],3)}, ind=3)
teller_eb = ebene("Teller", [teller_innen, teller], ind=4)
schatten_eb = ebene("Schatten", [schatten], ind=5)
film = {"v":"5.8.1","fr":60,"ip":0,"op":100,"w":1024,"h":1024,"nm":"crepe (omoteno, eigen)","ddd":0,"assets":[],
        "layers":[beere, zucker, banane, crepe_eb, teller_eb, schatten_eb]}
import os
ziel = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "auslieferung", "emoji", "crepe.json")
json.dump(film, open(ziel,"w"), separators=(",",":"))
print("ok", len(json.dumps(film)))
