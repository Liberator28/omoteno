const fs = require("fs");
const js = fs.readFileSync("omoteno-marken-studio.html", "utf8")
  .match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

const stub = {style:{setProperty(){}}, innerHTML:"", value:"", textContent:"", checked:false,
  hidden:false, offsetTop:0, offsetHeight:600, scrollTop:0, dataset:{},
  querySelector:()=>stub, querySelectorAll:()=>[], closest:()=>null, setAttribute(){},
  getAttribute(){}, hasAttribute(){}, removeAttribute(){}, select(){}, setSelectionRange(){},
  addEventListener(){}, scrollTo(){}, focus(){},
  classList:{add(){},remove(){},toggle(){},contains:()=>false}};
global.document = {getElementById:()=>stub, addEventListener(){}, querySelector:()=>stub,
  querySelectorAll:()=>[], documentElement:stub, body:stub, createElement:()=>stub};
global.window = {addEventListener(){}, innerWidth:390, innerHeight:844,
  matchMedia:()=>({matches:false, addEventListener(){}})};
global.navigator = {};
global.requestAnimationFrame = f => f();
global.setTimeout = () => 0;
global.clearTimeout = () => 0;
global.location = {origin:"https://omoteno.de", pathname:"/studio", hash:""};
global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;
global.btoa = t => Buffer.from(t,"binary").toString("base64");
global.atob = t => Buffer.from(t,"base64").toString("binary");

eval(js + "\nmodule.exports = { VORLAGEN, schriftAuf };");
const { VORLAGEN, schriftAuf } = module.exports;

const lum = hex => {
  const c = hex.replace("#","");
  const v = [0,2,4].map(i => {
    let x = parseInt(c.slice(i,i+2),16)/255;
    return x <= .03928 ? x/12.92 : Math.pow((x+.055)/1.055, 2.4);
  });
  return .2126*v[0] + .7152*v[1] + .0722*v[2];
};
const k = (a,b) => {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
};

let schwach = 0;
Object.keys(VORLAGEN).forEach(n => {
  const v = VORLAGEN[n], t = v.tag, a = Object.assign({}, t, v.abend);
  console.log("\n" + v.name);
  [
    ["Schrift auf Grund    ", k(t.tinte, t.grund),          4.5],
    ["Nebentext auf Karte  ", k(t.tinteLeise, t.flaeche),   4.5],
    ["Bandschrift auf Band ", k(t.bandText, t.band),        4.5],
    ["Hauptfarbe auf Karte ", k(t.akzent, t.flaeche),       4.5],
    ["Knopfschrift         ", k(schriftAuf(t.akzent), t.akzent), 4.5],
    ["Bestaetigungsschrift ", k(schriftAuf(t.gut), t.gut),       4.5],
    ["ABEND Schrift/Grund  ", k(a.tinte, a.grund),          4.5],
    ["ABEND Haupt/Karte    ", k(a.akzent, a.flaeche),       4.5]
  ].forEach(([name, wert, soll]) => {
    const ok = wert >= soll;
    if(!ok) schwach++;
    console.log("  " + name, wert.toFixed(2).padStart(6),
      ok ? "gut" : (wert >= 3 ? "nur grosse Schrift" : "ZU SCHWACH"));
  });
});
console.log("\nUnter 4.5:1 insgesamt:", schwach);
