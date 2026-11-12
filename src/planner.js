// Generador de planes de nutrición SIN IA (gratis, funciona en el móvil al instante).
// Elige platos de un recetario según la dieta, alergias, gustos, tiempo y presupuesto,
// y calcula los gramos de cada ingrediente para cumplir las kcal y los macros de cada toma.

// Alimentos por 100 g: [nombre, kcal, proteína, hidratos, grasa, etiquetas]
const F = {
  pollo:["Pechuga de pollo",110,23,0,1.5,"meat"], pavo:["Pechuga de pavo",105,24,0,1,"meat"], ternera:["Ternera magra",130,21,0,5,"meat cara"],
  cerdo:["Lomo de cerdo",150,22,0,6.5,"meat cerdo"], pavof:["Pavo en lonchas",100,19,2,1.5,"meat"], jamon:["Jamón serrano",240,30,0,13,"meat cerdo"],
  merluza:["Merluza",75,16,0,1,"fish"], salmon:["Salmón",208,20,0,13,"fish cara"], atun:["Atún al natural (lata)",105,24,0,1,"fish"],
  gambas:["Gambas",85,19,0,1,"shellfish cara"], huevo:["Huevo",145,12.5,0.7,10,"egg"], claras:["Claras de huevo",48,10.9,0.7,0.2,"egg"],
  tofu:["Tofu",120,13,2,7,"soja"], lentejas:["Lentejas cocidas",116,9,17,0.4,""], garbanzos:["Garbanzos cocidos",140,7.5,20,2.5,""],
  yogurp:["Yogur alto en proteína",60,10,4,0.2,"dairy"], batido:["Queso fresco batido 0%",46,8,3.5,0.1,"dairy"], burgos:["Queso fresco tipo Burgos 0%",70,11,4,0.5,"dairy"],
  mozza:["Mozzarella light",160,20,2,8,"dairy"], leche:["Leche semidesnatada",46,3.2,4.8,1.6,"dairy"], soja:["Bebida de soja",40,3.3,2.5,1.8,"soja"],
  arroz:["Arroz (en crudo)",350,7,78,0.6,""], pasta:["Pasta (en crudo)",355,12,72,1.5,"gluten"], patata:["Patata",77,2,17,0.1,""],
  boniato:["Boniato",86,1.6,20,0.1,""], pan:["Pan integral",250,10,43,3.5,"gluten"], avena:["Copos de avena",370,13,60,7,"gluten"],
  quinoa:["Quinoa (en crudo)",368,14,64,6,""], cuscus:["Cuscús (en crudo)",360,12.5,72,1.5,"gluten"], wrap:["Tortillas de trigo integrales",300,9,48,7,"gluten"],
  tmaiz:["Tortitas de maíz",380,8,80,3,""], platano:["Plátano",89,1.1,23,0.3,""], manzana:["Manzana",52,0.3,14,0.2,""],
  frutosr:["Frutos rojos",50,0.8,11,0.3,""], kiwi:["Kiwi",61,1.1,15,0.5,""], naranja:["Naranja",47,0.9,12,0.1,""],
  brocoli:["Brócoli",34,2.8,7,0.4,""], ensalada:["Ensalada variada",18,1.4,3,0.2,""], verduras:["Verduras para saltear",35,2,6,0.3,""],
  tomate:["Tomate",19,0.9,3.5,0.2,""], calabacin:["Calabacín",17,1.2,3,0.3,""], judias:["Judías verdes",31,1.8,7,0.1,""],
  espinacas:["Espinacas",23,2.9,3.6,0.4,""], pimiento:["Pimiento",25,1,5,0.3,""], tomatet:["Tomate triturado",30,1.5,5,0.2,""],
  champi:["Champiñones",22,3,3,0.3,""], yogsoja:["Yogur de soja natural",50,4,2.5,2.5,"soja"], hummus:["Hummus",170,7,14,10,""], cebolla:["Cebolla",40,1.1,9,0.1,""],
  aceite:["Aceite de oliva virgen extra",884,0,0,100,""], aguacate:["Aguacate",160,2,9,15,""], nueces:["Nueces",654,15,14,65,"nuts"],
  almendras:["Almendras",579,21,22,50,"nuts"], cacahuete:["Crema de cacahuete",588,25,20,50,"nuts"], choco:["Chocolate negro 85%",600,10,20,50,""],
};
// Límites de gramos por alimento [mín, máx]
const LIM = { yogsoja:[125,400], hummus:[40,120], aceite:[3,25], nueces:[5,35], almendras:[5,35], cacahuete:[5,30], choco:[5,25], aguacate:[20,120], huevo:[50,180], soja:[150,400],
  lentejas:[150,450], garbanzos:[100,350], jamon:[20,80], pavof:[30,120], batido:[100,350], yogurp:[120,400], mozza:[20,100] };
const lim = (k, role) => LIM[k] || (role === "P" ? [50, 260] : role === "C" ? [20, 320] : [3, 60]);

// Recetario. P = proteína, C = hidratos, F = grasa (se calculan sus gramos); V/X = cantidad fija.
// q = rápido de hacer; k = palabras para «me gusta».
const R = [
  // Desayunos
  {m:"Desayuno", t:"Porridge de avena con plátano", P:"batido", C:"avena", F:"cacahuete", X:[["platano",100]], q:1, k:"avena porridge platano"},
  {m:"Desayuno", t:"Tostadas con pavo y tomate", P:"pavof", C:"pan", F:"aceite", X:[["tomate",60]], q:1, k:"tostada pan pavo"},
  {m:"Desayuno", t:"Tortilla francesa con tostada y kiwi", P:"claras", C:"pan", F:"huevo", X:[["kiwi",100]], q:1, k:"tortilla huevo tostada"},
  {m:"Desayuno", t:"Yogur con avena, frutos rojos y nueces", P:"yogurp", C:"avena", F:"nueces", X:[["frutosr",80]], q:1, k:"yogur avena fruta"},
  {m:"Desayuno", t:"Tostadas con aguacate y tofu revuelto", P:"tofu", C:"pan", F:"aguacate", X:[["tomate",50]], k:"aguacate tostada tofu"},
  {m:"Desayuno", t:"Porridge de avena con soja y plátano", P:"soja", C:"avena", F:"cacahuete", X:[["platano",100]], q:1, k:"avena porridge"},
  {m:"Desayuno", t:"Tortitas de maíz con queso fresco y jamón", P:"burgos", C:"tmaiz", F:"jamon", q:1, k:"jamon queso tortitas"},
  // Comidas
  {m:"Comida", t:"Pollo al horno con patatas y ensalada", P:"pollo", C:"patata", F:"aceite", V:["ensalada",120], k:"pollo patata horno"},
  {m:"Comida", t:"Arroz con pollo y verduras", P:"pollo", C:"arroz", F:"aceite", V:["verduras",150], k:"arroz pollo"},
  {m:"Comida", t:"Pasta con atún y tomate", P:"atun", C:"pasta", F:"aceite", X:[["tomatet",120]], q:1, k:"pasta atun macarrones espaguetis"},
  {m:"Comida", t:"Lentejas estofadas con verduras", P:"lentejas", C:"patata", F:"aceite", V:["verduras",100], k:"lentejas legumbre cuchara"},
  {m:"Comida", t:"Ternera salteada con quinoa y brócoli", P:"ternera", C:"quinoa", F:"aceite", V:["brocoli",150], k:"ternera carne quinoa"},
  {m:"Comida", t:"Merluza en salsa verde con patata", P:"merluza", C:"patata", F:"aceite", V:["judias",120], k:"merluza pescado"},
  {m:"Comida", t:"Salmón con boniato y brócoli", P:"salmon", C:"boniato", F:"aceite", V:["brocoli",150], k:"salmon pescado boniato"},
  {m:"Comida", t:"Garbanzos con espinacas y huevo", P:"garbanzos", C:"pan", F:"aceite", V:["espinacas",120], X:[["huevo",60]], k:"garbanzos legumbre"},
  {m:"Comida", t:"Lomo con arroz y pimientos", P:"cerdo", C:"arroz", F:"aceite", V:["pimiento",120], k:"lomo cerdo arroz"},
  {m:"Comida", t:"Curry de tofu y garbanzos con arroz", P:"tofu", C:"arroz", F:"aceite", V:["espinacas",100], X:[["garbanzos",100]], k:"curry tofu arroz"},
  {m:"Comida", t:"Wrap de pollo con aguacate", P:"pollo", C:"wrap", F:"aguacate", V:["ensalada",80], q:1, k:"wrap burrito pollo"},
  {m:"Comida", t:"Bowl de pavo, arroz y aguacate", P:"pavo", C:"arroz", F:"aguacate", V:["pimiento",100], k:"bowl poke arroz pavo"},
  {m:"Comida", t:"Gambas al ajillo con arroz", P:"gambas", C:"arroz", F:"aceite", V:["verduras",120], k:"gambas marisco arroz"},
  {m:"Comida", t:"Macarrones boloñesa de pavo", P:"pavo", C:"pasta", F:"aceite", X:[["tomatet",120],["cebolla",40]], k:"pasta macarrones bolonesa"},
  {m:"Comida", t:"Cuscús con pollo y verduras", P:"pollo", C:"cuscus", F:"aceite", V:["calabacin",120], q:1, k:"cuscus pollo"},
  {m:"Comida", t:"Lentejas con arroz y verduras", P:"lentejas", C:"arroz", F:"aceite", V:["verduras",120], k:"lentejas legumbre arroz"},
  // Cenas
  {m:"Cena", t:"Tortilla de espinacas con ensalada", P:"claras", C:"pan", F:"huevo", V:["espinacas",100], X:[["ensalada",100]], q:1, k:"tortilla huevo"},
  {m:"Cena", t:"Merluza a la plancha con calabacín y patata", P:"merluza", C:"patata", F:"aceite", V:["calabacin",150], k:"merluza pescado"},
  {m:"Cena", t:"Pavo con calabacín y quinoa", P:"pavo", C:"quinoa", F:"aceite", V:["calabacin",150], k:"pavo quinoa"},
  {m:"Cena", t:"Salmón con ensalada y patata", P:"salmon", C:"patata", F:"aceite", V:["ensalada",120], k:"salmon pescado"},
  {m:"Cena", t:"Ensalada de atún, huevo y garbanzos", P:"atun", C:"garbanzos", F:"aceite", V:["ensalada",120], X:[["huevo",60]], q:1, k:"ensalada atun"},
  {m:"Cena", t:"Revuelto de tofu con verduras y pan", P:"tofu", C:"pan", F:"aceite", V:["verduras",150], q:1, k:"tofu revuelto"},
  {m:"Cena", t:"Hamburguesa de pollo casera con boniato", P:"pollo", C:"boniato", F:"aceite", V:["ensalada",80], k:"hamburguesa pollo"},
  {m:"Cena", t:"Pizza de wrap con pavo y mozzarella", P:"pavof", C:"wrap", F:"mozza", X:[["tomatet",60],["champi",50]], q:1, k:"pizza wrap"},
  {m:"Cena", t:"Crema de calabacín con huevos a la plancha", P:"claras", C:"patata", F:"huevo", V:["calabacin",250], k:"crema verdura huevo"},
  {m:"Cena", t:"Champiñones con gambas y pan", P:"gambas", C:"pan", F:"aceite", V:["champi",150], q:1, k:"gambas champinones"},
  {m:"Cena", t:"Tacos de pollo con pimientos", P:"pollo", C:"wrap", F:"aguacate", V:["pimiento",100], q:1, k:"tacos fajitas pollo mexicano"},
  {m:"Cena", t:"Sartén de tofu, judías y arroz", P:"tofu", C:"arroz", F:"aceite", V:["judias",150], k:"tofu arroz"},
  // Snacks (media mañana + merienda)
  {m:"Snacks", t:"Yogur proteico con manzana y nueces", P:"yogurp", C:"manzana", F:"nueces", q:1, k:"yogur fruta"},
  {m:"Snacks", t:"Queso batido con frutos rojos y almendras", P:"batido", C:"frutosr", F:"almendras", q:1, k:"queso batido fruta"},
  {m:"Snacks", t:"Bocadillo de jamón y fruta", P:"jamon", C:"pan", F:"aceite", X:[["naranja",150]], q:1, k:"bocadillo jamon"},
  {m:"Snacks", t:"Bocadillo de pavo y plátano", P:"pavof", C:"pan", F:"aceite", X:[["platano",100]], q:1, k:"bocadillo pavo"},
  {m:"Snacks", t:"Batido de soja con plátano y almendras", P:"soja", C:"platano", F:"almendras", q:1, k:"batido platano"},
  {m:"Snacks", t:"Yogur de soja con avena y nueces", P:"yogsoja", C:"avena", F:"nueces", X:[["frutosr",60]], q:1, k:"yogur avena"},
  {m:"Snacks", t:"Hummus con tortitas de maíz y tomate", P:"hummus", C:"tmaiz", F:"aceite", X:[["tomate",80]], q:1, k:"hummus"},
  {m:"Snacks", t:"Tortitas de maíz con crema de cacahuete y plátano", P:"tofu", C:"tmaiz", F:"cacahuete", X:[["platano",80]], q:1, k:"tortitas cacahuete"},
];
R.forEach((r, i) => r.id = i);
// en el snack de tortitas el tofu no pega: mejor queso batido salvo en dieta vegana
R.find(r => r.t.startsWith("Tortitas de maíz con crema")).P = "batido";

const SHARE = { Desayuno:.25, Comida:.35, Cena:.27, Snacks:.13 };
const MEALS = ["Desayuno", "Comida", "Cena", "Snacks"];
const nrm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Lo que la persona NO come. Mejor quitar de más que poner algo que no puede comer.
const GROUPS = [
  [/lactosa|lacteo|\bleche|queso|yogur|nata\b|mantequilla|caseina|proteina de (la )?leche/, ["dairy"], "lácteos"],
  [/gluten|celiac|trigo|harina|cebada|centeno/, ["gluten"], "gluten"],
  [/marisco|gamba|crustace|langostino|molusco/, ["shellfish"], "marisco"],
  [/pescado|\bpez\b|\bpeces\b/, ["fish", "shellfish"], "pescado y marisco"],
  [/huevo|\bclaras?\b/, ["egg"], "huevo"],
  [/frutos? secos?|\bnuez|nueces|almendra|cacahuete|\bmani\b|avellana|anacardo|pistacho/, ["nuts", "cacahuete"], "frutos secos"],
  [/cerdo|porcino|jamon|\blomo\b|chorizo|embutido|fiambre|bacon|beicon|panceta/, ["cerdo"], "cerdo"],
  [/embutido|fiambre|lonchas/, ["pavof", "jamon"], "embutidos"],
  [/carnes? rojas?/, ["ternera", "cerdo", "jamon"], "carne roja"],
  [/\bcarnes?\b(?! rojas?)/, ["meat"], "carne"],
  [/\bpollo/, ["pollo"], "pollo"], [/\bpavo/, ["pavo", "pavof"], "pavo"], [/ternera|vacuno|\bvaca\b/, ["ternera"], "ternera"],
  [/soja|tofu|edamame/, ["#soja"], "soja"],
  [/legumbre/, ["lentejas", "garbanzos", "hummus", "#soja"], "legumbres"],
  [/lenteja/, ["lentejas"], "lentejas"], [/garbanzo|hummus/, ["garbanzos", "hummus"], "garbanzos"],
  [/\bfrutas?\b/, ["platano", "manzana", "frutosr", "kiwi", "naranja"], "fruta"],
  [/frutos? rojos?|fresa|arandano|frambuesa/, ["frutosr"], "frutos rojos"], [/platano|banana/, ["platano"], "plátano"],
  [/verdura|vegetal|hortaliza/, ["verduras", "brocoli", "espinacas", "calabacin", "judias", "pimiento", "champi", "ensalada", "cebolla"], "verduras"],
  [/\bpan\b|panes|tostada|bocadillo/, ["pan"], "pan"], [/\barroz/, ["arroz"], "arroz"], [/pasta|macarron|espagueti|fideo/, ["pasta"], "pasta"],
  [/avena/, ["avena"], "avena"], [/patata/, ["patata"], "patata"], [/boniato/, ["boniato"], "boniato"],
  [/\bmaiz/, ["tmaiz"], "maíz"], [/tomate/, ["tomate", "tomatet"], "tomate"], [/cebolla/, ["cebolla"], "cebolla"],
  [/champi|seta|hongo/, ["champi"], "champiñones"], [/aguacate/, ["aguacate"], "aguacate"], [/brocoli/, ["brocoli"], "brócoli"],
  [/espinaca/, ["espinacas"], "espinacas"], [/pimiento/, ["pimiento"], "pimiento"], [/calabacin/, ["calabacin"], "calabacín"],
  [/judia|\bvainas?\b/, ["judias"], "judías verdes"], [/lechuga|ensalada/, ["ensalada"], "ensalada"],
  [/\batun/, ["atun"], "atún"], [/salmon/, ["salmon"], "salmón"], [/merluza/, ["merluza"], "merluza"],
  [/chocolate|cacao/, ["choco"], "chocolate"], [/aceite/, ["aceite"], "aceite"], [/kiwi/, ["kiwi"], "kiwi"], [/naranja|citric/, ["naranja"], "naranja"],
  [/manzana/, ["manzana"], "manzana"], [/quinoa/, ["quinoa"], "quinoa"], [/cuscus/, ["cuscus"], "cuscús"],
];
const TITLE_RX = [[/\bajos?\b|ajillo/, /ajillo|salsa verde/, "ajo"], [/picante|curry|especia/, /curry|tacos|fajita/, "picante"]];
const STOP = /^(frutos?$|secos?$|alergi|alergic|intoleran|celiac|nada|ningun|tengo|gusta|gustan|puedo|comer|como|tambien|pero|sobre|todo|toda|tipo|cualquier|odio|evito|prefiero|mejor|nunca|alimento|comida|producto|derivad|ademas|menos|poco|mucho|nunca|algun|cosas|bien|mal|sienta|sientan|hace|dieta|siempre|veces|crudo|cocido|frito|asado|nada|soy|estoy|para|porque|cuando|esta|este|estos|estas|otro|otra|otros|otras|roja|rojo|blanca|blanco|verde|natural)/;
const STEM = (w) => w.length > 5 ? w.replace(/(es|s)$/, "") : w.length > 4 ? w.replace(/s$/, "") : w;
function blocked(v){
  const a = nrm(v.avoid), tags = new Set(), keys = new Set(), title = [], labels = [];
  if (v.diet === "veg" || v.diet === "vegan" || v.diet === "pesc") tags.add("meat");
  if (v.diet === "veg" || v.diet === "vegan") { tags.add("fish"); tags.add("shellfish"); }
  if (v.diet === "vegan") { tags.add("egg"); tags.add("dairy"); }
  for (const [rx, list, l] of GROUPS) if (rx.test(a)) { for (const x of list) x[0] === "#" ? tags.add(x.slice(1)) : (F[x] ? keys : tags).add(x); labels.push(l); }
  for (const [rx, trx, l] of TITLE_RX) if (rx.test(a)) { title.push(trx); labels.push(l); }
  if (v.budget === "low") tags.add("cara");
  // cualquier otra palabra que nombre un alimento o un plato
  const words = a.split(/[^a-zñ]+/).filter(w => w.length >= 4 && !STOP.test(w)).map(STEM).filter(w => w.length >= 4);
  const NAME_STOP = /^(para|crudo|lata|natural|tipo|variada|fresco|virgen|extra|alto|integrales|semidesnatada|cocidos?|cocidas)$/;
  for (const w of words) for (const [k, f] of Object.entries(F)) if (nrm(f[0]).split(/[^a-zñ]+/).filter(x => x.length >= 4 && !NAME_STOP.test(x)).some(x => x.startsWith(w) || w.startsWith(x))) { if (!keys.has(k)) { keys.add(k); labels.push(f[0].toLowerCase()); } }
  return { tags, keys, title, words, labels: [...new Set(labels)] };
}
const foodOk = (k, B) => { const f = F[k]; if (!f || B.keys.has(k)) return false; const tg = f[5].split(" ").filter(Boolean); return !tg.some(t => B.tags.has(t)); };
function recipeOk(r, B){
  if (![r.P, r.C, r.F].every(k => foodOk(k, B))) return false;
  if ((r.X || []).some(([k]) => !foodOk(k, B))) return false;
  const t = nrm(r.t + " " + r.k);
  if (B.title.some(rx => rx.test(t))) return false;
  if (B.words.some(w => t.split(/[^a-zñ]+/).some(x => x.startsWith(w)))) return false;
  return true;
}
// alimentos de un plan que la persona ha dicho que no come (para avisar en planes viejos)
export function planConflicts(plan, v){
  const B = blocked(v), bad = new Set();
  for (const d of plan?.days || []) for (const m of Object.values(d.meals || {})) {
    for (const i of m.items || []) if (i.key && !foodOk(i.key, B)) bad.add(i.name);
    const r = R[m.tpl]; if (r && !recipeOk(r, B) && ![...(m.items||[])].some(i => i.key && !foodOk(i.key, B))) bad.add(m.t);
  }
  return [...bad];
}
export const avoidLabels = v => blocked(v).labels;
const VEG_ALT = ["ensalada", "verduras", "brocoli", "calabacin", "judias", "espinacas", "pimiento", "tomate"];

// gramos de P, C y F para acercarse a [p, c, f] de la toma (sistema 3x3 + límites)
function solve(r, tp, tc, tf, B){
  const fixed = [...(r.X || [])]; if (r.V){ let [vk, vg] = r.V; if (!foodOk(vk, B)) vk = VEG_ALT.find(x => foodOk(x, B)); if (vk) fixed.push([vk, vg]); }
  let p = tp, c = tc, f = tf;
  for (const [k, g] of fixed){ const x = F[k]; p -= x[2]*g/100; c -= x[3]*g/100; f -= x[4]*g/100; }
  const ks = [r.P, r.C, r.F], M = ks.map(k => [F[k][2]/100, F[k][3]/100, F[k][4]/100]);   // columnas: P, C, F
  const det = (a) => a[0][0]*(a[1][1]*a[2][2]-a[1][2]*a[2][1]) - a[0][1]*(a[1][0]*a[2][2]-a[1][2]*a[2][0]) + a[0][2]*(a[1][0]*a[2][1]-a[1][1]*a[2][0]);
  const A = [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]], b = [p, c, f];
  const D = det(A); let x;
  if (Math.abs(D) > 1e-9) x = [0, 1, 2].map(j => det(A.map((row, i) => row.map((v, jj) => jj === j ? b[i] : v))) / D);
  else x = [p / Math.max(.01, M[0][0]), c / Math.max(.01, M[1][1]), f / Math.max(.01, M[2][2])];
  const roles = ["P", "C", "F"];
  const out = ks.map((k, i) => { const [lo, hi] = lim(k, roles[i]); const g = Math.min(hi, Math.max(lo, isFinite(x[i]) ? x[i] : lo)); return [k, Math.round(g / 5) * 5 || 5]; });
  const all = [...out, ...fixed]; const seen = new Map();
  for (const [k, g] of all) seen.set(k, (seen.get(k) || 0) + g);
  return [...seen].map(([k, g]) => ({ key:k, name:F[k][0], g, per:{ kcal:F[k][1], p:F[k][2], c:F[k][3], f:F[k][4] } }));
}
const kcalOf = items => items.reduce((a, i) => a + i.per.kcal*i.g/100, 0);

function rng(seed){ let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const TRAIN_DAYS = { 0:[], 1:[3], 2:[2,4], 3:[1,3,5], 4:[1,2,4,5], 5:[1,2,3,5,6], 6:[1,2,3,4,5,6], 7:[1,2,3,4,5,6,7] };

function buildMeal(r, t, share, B, train){
  const ck = train ? 1.1 : 1;                                           // días de entreno: algo más de hidratos
  const items = solve(r, t.p*share, t.c*share*ck, t.f*share, B);
  // ajuste fino a las kcal de la toma escalando lo calculado (no lo fijo)
  const goal = t.kcal*share + (train ? t.c*share*.1*4 : 0), k = kcalOf(items);
  if (k > 0 && Math.abs(goal/k - 1) > .05){ const fac = Math.max(.75, Math.min(1.3, goal/k));
    for (const i of items) if ([r.P, r.C, r.F].includes(i.key)){ const [lo, hi] = lim(i.key, i.key===r.P?"P":i.key===r.C?"C":"F"); i.g = Math.min(hi, Math.max(lo, Math.round(i.g*fac/5)*5)); } }
  return { t:r.t, tpl:r.id, items };
}

export function makePlan(v, t, seed = Date.now()){
  const B = blocked(v), rand = rng(seed), likes = nrm(v.like).split(/[^a-zñ]+/).filter(w => w.length >= 3);
  const score = r => (likes.some(w => r.k.includes(w) || nrm(r.t).includes(w)) ? 2 : 0) + (v.cook === "poco" && r.q ? 1 : 0) + rand()*1.5;
  const pick = m => R.filter(r => r.m === m && recipeOk(r, B)).map(r => [score(r), r]).sort((a, b) => b[0]-a[0]).map(x => x[1]);
  const pools = Object.fromEntries(MEALS.map(m => [m, pick(m)]));
  if (MEALS.some(m => !pools[m].length)) return null;
  const train = new Set(TRAIN_DAYS[Math.max(0, Math.min(7, +v.train || 0))]);
  const rot = { Desayuno: Math.min(3, pools.Desayuno.length), Comida: 7, Cena: 7, Snacks: Math.min(3, pools.Snacks.length) };
  const days = [];
  for (let d = 1; d <= 7; d++){
    const meals = {};
    for (const m of MEALS){ const P = pools[m], r = P[(d-1) % Math.min(rot[m], P.length)]; meals[m] = buildMeal(r, t, SHARE[m], B, train.has(d)); }
    days.push({ d, train:train.has(d), meals });
  }
  return { title:titleFor(v), summary:summaryFor(v, t, train.size), tips:tipsFor(v, t), target:t, days, seed, B:[...B.tags] };
}
// cambiar un plato concreto por otro que encaje
export function swapMeal(plan, v, d, m){
  const B = blocked(v), day = plan.days.find(x => x.d === d); if (!day) return plan;
  const used = new Set(plan.days.map(x => x.meals[m]?.tpl));
  const pool = R.filter(r => r.m === m && recipeOk(r, B));
  const cur = day.meals[m]?.tpl, fresh = pool.filter(r => !used.has(r.id));
  const list = fresh.length ? fresh : pool.filter(r => r.id !== cur); if (!list.length) return plan;
  const r = list[Math.floor(Math.random() * list.length)];
  day.meals[m] = buildMeal(r, plan.target, SHARE[m], B, day.train);
  return plan;
}
function titleFor(v){ return { lose:"Plan definición", keep:"Plan equilibrio", gain:"Plan volumen" }[v.goal] + (v.diet === "veg" ? " vegetariano" : v.diet === "vegan" ? " vegano" : v.diet === "pesc" ? " pescetariano" : ""); }
function summaryFor(v, t, n){
  const g = { lose:"perder grasa sin perder músculo: un déficit moderado y mucha proteína para que no pases hambre", keep:"mantener tu peso comiendo variado y con proteína suficiente", gain:"ganar músculo con un pequeño superávit y proteína en todas las comidas" }[v.goal];
  return `Pensado para ${g}. Cada día suma unas ${Math.round(t.kcal)} kcal y ${t.p} g de proteína repartidas en 4 tomas${n ? `, con un poco más de hidratos los ${n} días que entrenas` : ""}. Los gramos son en crudo y ya están calculados para ti.`;
}
function tipsFor(v, t){
  const w = +v.w || 70, T = [];
  T.push(`Bebe unos ${(Math.round(w*0.035*10)/10).toString().replace(".", ",")} litros de agua al día${+v.train ? " (algo más los días de entreno)" : ""}.`);
  T.push(v.cook === "poco" ? "Cocina el domingo arroz, pollo y verduras para 3 días y guárdalos en táperes: entre semana solo tendrás que calentar." : "Usa una báscula de cocina las primeras semanas: aprenderás a calcular las raciones a ojo.");
  if (v.goal === "lose") T.push("Pésate 1-2 veces por semana en ayunas y fíjate en la media: lo normal es bajar entre 0,3 y 0,7 kg por semana.");
  if (v.goal === "gain") T.push("Si en 2-3 semanas tu peso no sube, añade un puñado de frutos secos o un poco más de arroz o pasta al día.");
  if (+v.train) T.push("Los días de entreno, haz la comida o el snack con hidratos 1-3 horas antes y toma proteína en la comida siguiente.");
  if (v.diet === "vegan") T.push("En una dieta vegana conviene tomar vitamina B12: consúltalo con tu médico o farmacéutico.");
  if (v.budget === "low") T.push("Compra pollo, legumbres, huevos y arroz en formato grande y congela por raciones: es lo que más abarata el plan.");
  T.push("Las especias, el vinagre, el limón y el café o el té sin azúcar los puedes usar libremente.");
  return T.slice(0, 5);
}
// lista de alimentos (por 100 g) para reconocer los de un plan subido
export const PLANNER_FOODS = Object.values(F).map(([name, kcal, p, c, f]) => ({ name, kcal, p, c, f }));
