// Leer el plan de un nutricionista (PDF o foto) y convertirlo en un plan de la app. Todo en el móvil, sin IA de pago.

// ---------- 1. Sacar el texto ----------
export async function fileText(file, onStep = () => {}){
  if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)){
    onStep("Leyendo el PDF…");
    const pdfjs = await import("pdfjs-dist/build/pdf.min.mjs");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const out = [];
    for (let i = 1; i <= Math.min(doc.numPages, 40); i++){
      const page = await doc.getPage(i), tc = await page.getTextContent(), rows = new Map();
      for (const it of tc.items){ if (!it.str?.trim()) continue; const y = Math.round(it.transform[5] / 3) * 3, x = it.transform[4];
        (rows.get(y) || rows.set(y, []).get(y)).push([x, it.str]); }
      [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, r]) => out.push(r.sort((a, b) => a[0] - b[0]).map(x => x[1]).join(" ").replace(/\s+/g, " ").trim()));
      out.push("");
    }
    const text = out.join("\n");
    if (text.replace(/\s/g, "").length > 40) return text;
    onStep("El PDF es una imagen escaneada: reconociendo el texto…");
    // PDF escaneado: pasar cada página a imagen y reconocer el texto
    const imgs = [];
    for (let i = 1; i <= Math.min(doc.numPages, 6); i++){
      const page = await doc.getPage(i), vp = page.getViewport({ scale: 2 }), c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height; await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; imgs.push(c);
    }
    return ocr(imgs, onStep);
  }
  return ocr([file], onStep);
}
async function ocr(images, onStep){
  onStep("Reconociendo el texto de la imagen… (la primera vez tarda un poco)");
  const { createWorker } = await import("tesseract.js");
  const w = await createWorker("spa");
  let text = "";
  for (let i = 0; i < images.length; i++){ onStep(images.length > 1 ? `Reconociendo la página ${i + 1} de ${images.length}…` : "Reconociendo el texto…"); text += (await w.recognize(images[i])).data.text + "\n"; }
  await w.terminate();
  return text;
}

// ---------- 2. Entender el texto ----------
const nrm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const WD = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const MEAL_RX = [
  [/^(desayuno|desayunar)\b/, "Desayuno"], [/^(media manana|a media manana|almuerzo de media manana|tentempie|snack)\b/, "Snacks"],
  [/^(comida|almuerzo|almorzar)\b/, "Comida"], [/^(merienda|pre[- ]?entreno|post[- ]?entreno|antes de entrenar|despues de entrenar|recena)\b/, "Snacks"],
  [/^(cena|cenar)\b/, "Cena"],
];
const NUM = { un:1, una:1, uno:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, medio:.5, media:.5 };
// gramos por unidad habitual
const UNIT_G = [
  [/cucharadita|cdta|cdita/, 5], [/cucharada sopera|cucharada|cda\b|cdas\b/, 10], [/vaso|taza/, 200], [/tazon|bol/, 250], [/lata/, 56], [/loncha|lonchas/, 15],
  [/rebanada|rebanadas|tostada|tostadas/, 30], [/biscote|biscotes|biscotte/, 8], [/punado|punados/, 25], [/filete|filetes/, 150], [/racion|raciones/, 100],
  [/pieza|piezas/, 150], [/yogur|yogures/, 125], [/huevo|huevos/, 60], [/clara|claras/, 33], [/platano|platanos/, 120], [/manzana|manzanas|naranja|naranjas|pera|peras/, 170],
  [/kiwi|kiwis|mandarina|mandarinas/, 80], [/tortita|tortitas/, 8], [/wrap|tortilla de trigo/, 40], [/onza|onzas/, 10], [/nuez|nueces|almendra|almendras/, 5],
];
const unitG = s => { const t = " " + nrm(s) + " "; for (const [rx, g] of UNIT_G) if (new RegExp("[^a-z](" + rx.source + ")[^a-z]").test(t)) return g; return null; };

export function parsePlan(text, db){
  const lines = String(text).split(/\r?\n/).map(l => l.replace(/[•·▪●◦■□►▸•]/g, " ").replace(/^\s*[-*–]\s*/, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const days = []; let day = null, meal = null, opt = null, target = null;
  const getDay = key => { let d = days.find(x => x.key === key); if (!d){ d = { key, meals:{} }; days.push(d); } return d; };
  const items = [], unknown = [];
  const kcalRx = /(\d[\d.]{2,5})\s*(k?cal|kilocalorias|calorias)\b/i, protRx = /prote[ií]nas?\D{0,20}?(\d{2,3})\s*g/i;

  for (let raw of lines){
    let l = nrm(raw);
    if (!target){ const k = l.match(kcalRx); if (k){ const v = +k[1].replace(".", ""); if (v >= 900 && v <= 5000){ target = { kcal:v }; const p = l.match(protRx); if (p) target.p = +p[1]; } } }
    else if (target && !target.p){ const p = l.match(protRx); if (p) target.p = +p[1]; }
    // ¿día?
    const wd = WD.findIndex(w => new RegExp(`^(dia\\s*:?\\s*)?${w}\\b`).test(l));
    const dn = l.match(/^(dia|day)\s*(\d{1,2})\b/);
    if (wd >= 0 || dn){ day = getDay(wd >= 0 ? `w${wd + 1}` : `d${+dn[2]}`); meal = null; opt = null; l = l.replace(/^(dia\s*:?\s*)?\w+\s*\d*\s*[:.\-–]?\s*/, ""); if (!l) continue; }
    // ¿opción?
    const op = l.match(/^opcion\s*(\d+|[a-d])\b\s*[:.\-–)]?\s*/);
    if (op){ opt = `Opción ${op[1].toUpperCase()}`; l = l.slice(op[0].length); if (!l) continue; }
    // ¿comida?
    let isHeader = false;
    for (const [rx, m] of MEAL_RX) if (rx.test(l)){ meal = m; opt = null; isHeader = true; l = l.replace(rx, "").replace(/^[^a-z0-9]*(\(?\d{1,2}[:.h]\d{0,2}\)?)?\s*[:.\-–]?\s*/, ""); break; }
    const op2 = l.match(/^opcion\s*(\d+|[a-d])\b\s*[:.\-–)]?\s*/); if (op2){ opt = `Opción ${op2[1].toUpperCase()}`; l = l.slice(op2[0].length); }
    if (!meal || !l) continue;
    if (/^(total|kcal|calorias|proteinas|hidratos|grasas|notas?|observaciones|recomendaciones|importante)\b/.test(l) && !/\d+\s*g\s+de/.test(l)) continue;
    // separar varios alimentos en la misma línea
    const parts = l.split(/\s*(?:,|;|\+|\s(?:y|con|mas)\s(?=\d|un |una |dos |tres ))\s*/).map(x => x.trim()).filter(x => x.length > 1);
    for (const part of parts){
      const it = parseItem(part, db);
      if (!it){ if (!isHeader && part.length > 3 && /[a-z]/.test(part) && part.split(" ").length <= 8) unknown.push(part); continue; }
      const d = day || getDay("all"); (d.meals[meal] ||= []).push({ ...it, ...(opt ? { opt } : {}) }); items.push(it);
    }
  }
  const kind = days.some(d => d.key.startsWith("d")) ? "month" : days.some(d => d.key.startsWith("w")) ? "week" : "single";
  const good = days.filter(d => Object.keys(d.meals).length);
  return { kind, days:good, target, count:items.length, nodata:items.filter(i => !i.per).length, unknown:unknown.slice(0, 20) };
}

function parseItem(s, db){
  let t = nrm(s).replace(/\(.*?\)/g, m => /\d/.test(m) ? m.replace(/[()]/g, " ") : " ").replace(/\s+/g, " ").trim();
  t = t.split(/\s+o\s+(?=[a-z])/)[0];                                      // «pollo o pavo» → pollo
  let g = null, name = t, m;
  if ((m = t.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|gramos|ml|cl|l)\b\.?\s*(?:de\s+)?(.+)$/))){ g = toG(+m[1].replace(",", "."), m[2]); name = m[3]; }
  else if ((m = t.match(/^(.+?)\s*[:\-–]?\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|gramos|ml|cl|l)\b\.?/))){ g = toG(+m[2].replace(",", "."), m[3]); name = m[1]; }
  else if ((m = t.match(/^(\d+(?:[.,]\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|medio|media)\s+(.+)$/))){
    const n = NUM[m[1]] ?? +m[1].replace(",", "."), rest = m[2];
    const u = unitG(rest); name = rest.replace(/^(cucharaditas?|cucharadas?( soperas?)?|vasos?|tazas?|tazon|bol|latas?|lonchas?|rebanadas?|piezas?|punados?|filetes?|raciones?|onzas?)\s+(de\s+)?/, "");
    const f0 = matchFood(name, db); g = n * (u || f0?.unitG || 100);
  }
  name = name.replace(/\b(aprox|aproximadamente|en crudo|crudo|cocido|cocinado|peso)\b\.?/g, m2 => m2).replace(/[.:;]+$/, "").trim();
  if (!g || g <= 0 || g > 2000 || !/[a-z]{3}/.test(name)) return null;
  const f = matchFood(nrm(s).includes("crudo") ? name + " crudo" : name, db);
  const pretty = f ? f.name : name.charAt(0).toUpperCase() + name.slice(1);
  return { name:pretty, g:Math.round(g), per:f ? { kcal:f.kcal, p:f.p, c:f.c, f:f.f } : null, raw:s };
}
const toG = (v, u) => u === "kg" || u === "l" ? v * 1000 : u === "cl" ? v * 10 : v;

export const EXTRA_FOODS = [
  ["Lentejas (en crudo)",330,24,48,1.5],["Garbanzos (en crudo)",364,19,61,6],["Alubias (en crudo)",330,22,45,1.5],["Zanahoria",41,0.9,10,0.2],["Lechuga",15,1.4,2.9,0.2],
  ["Pepino",15,0.7,3.6,0.1],["Berenjena",25,1,6,0.2],["Coliflor",25,1.9,5,0.3],["Espárragos",20,2.2,3.9,0.1],["Puerro",61,1.5,14,0.3],["Pimiento rojo",31,1,6,0.3],
  ["Fresas",32,0.7,7.7,0.3],["Pera",57,0.4,15,0.1],["Melón",34,0.8,8,0.2],["Sandía",30,0.6,8,0.2],["Mandarina",53,0.8,13,0.3],["Uvas",69,0.7,18,0.2],["Piña",50,0.5,13,0.1],
  ["Yogur natural",61,3.5,4.7,3.3],["Yogur desnatado",40,4.3,5.6,0.2],["Kéfir",60,3.4,4.5,3.3],["Queso fresco",174,12,3,13],["Requesón",98,11,3.4,4.3],["Leche desnatada",35,3.4,4.9,0.1],["Leche entera",64,3.2,4.7,3.6],
  ["Bebida de avena",45,0.6,7,1.5],["Pan blanco",265,9,49,3.2],["Biscotes integrales",400,12.5,68,6.5],["Tortitas de arroz",387,8,81,2.8],["Pasta integral (en crudo)",348,13,64,2.5],
  ["Arroz integral (en crudo)",360,7.5,76,2.7],["Patata (en crudo)",77,2,17,0.1],["Pescado blanco",80,17,0,1],["Sardinas",208,25,0,11],["Caballa",205,19,0,14],["Bacalao",82,18,0,0.7],
  ["Lomo embuchado",380,50,1,20],["Pechuga de pollo (en crudo)",110,23,0,1.5],["Muslo de pollo",177,24,0,9],["Ternera magra (en crudo)",130,21,0,5],["Hamburguesa de ternera",220,18,2,16],
  ["Mermelada light",120,0.3,30,0],["Miel",304,0.3,82,0],["Cacao puro en polvo",350,20,12,22],["Crema de cacahuete",588,25,20,50],["Semillas de chía",486,17,42,31],["Aceitunas",145,1,4,15],
  ["Proteína en polvo (whey)",380,78,6,5],["Gazpacho",50,1,5,3],["Hummus",170,7,14,10],["Tomate",19,0.9,3.5,0.2],["Café",2,0.3,0,0],["Infusión",1,0,0.2,0],
].map(([name, kcal, p, c, f]) => ({ name, kcal, p, c, f }));
// buscar el alimento más parecido de nuestra base
const stem = w => w.replace(/(es|s)$/, "");
const STOP = new Set(["de","del","la","el","los","las","con","y","en","a","al","sin","para","tipo","natural","gr","g"]);
function matchFood(name, db){
  const words = nrm(name).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)).map(stem); if (!words.length) return null;
  let best = null, bs = 0;
  for (const f of db){ const fw = f._w || (f._w = nrm(f.name).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)).map(stem));
    let sc = 0; for (const w of words) if (fw.includes(w)) sc += w === fw[0] ? 2 : 1;
    if (words[0] === fw[0]) sc += 1;
    if (/crudo/.test(nrm(name)) && /crudo/.test(nrm(f.name))) sc += 1;
    sc -= .3 * fw.filter(w => !words.includes(w) && w !== "crudo").length;                 // menos puntos si el alimento tiene palabras de más (yogur de SOJA)
    if (!/crudo/.test(nrm(name)) && /crudo/.test(nrm(f.name))) sc -= .5;
    if (sc > bs || (sc === bs && best && f.name.length < best.name.length)){ bs = sc; best = f; } }
  return bs >= 1.6 ? best : null;
}

// ---------- 3. Datos del estudio (para rellenar las preguntas) ----------
export function parseStudy(text){
  const t = nrm(text), o = {}, found = [];
  const num = s => +String(s).replace(",", ".");
  let m;
  if (/\b(mujer|femenino|paciente femenina)\b/.test(t)) { o.sex = "f"; found.push("sexo"); }
  else if (/\b(hombre|varon|masculino)\b/.test(t)) { o.sex = "m"; found.push("sexo"); }
  if ((m = t.match(/edad\s*[:\-]?\s*(\d{2})\b/) || t.match(/\b(\d{2})\s*anos\b/))) { const a = +m[1]; if (a >= 14 && a <= 90){ o.age = a; found.push("edad"); } }
  if ((m = t.match(/(altura|talla|estatura)\s*[:\-]?\s*(\d[.,]\d{1,2}|\d{3})\s*(cm|m)?/))) { let h = num(m[2]); if (h < 3) h *= 100; if (h >= 120 && h <= 230){ o.h = Math.round(h); found.push("altura"); } }
  if ((m = t.match(/peso(?: actual| corporal| inicial)?\s*[:\-]?\s*(\d{2,3}(?:[.,]\d{1,2})?)\s*(kg|kilos)?/))) { const w = num(m[1]); if (w >= 30 && w <= 300){ o.w = w; found.push("peso"); } }
  if ((m = t.match(/(grasa corporal|% ?grasa|porcentaje de grasa)\s*[:\-]?\s*(\d{1,2}(?:[.,]\d)?)\s*%?/))) { o.bf = num(m[2]); found.push("% de grasa"); }
  if (/perder (peso|grasa)|perdida de (peso|grasa)|definicion|deficit|adelgaz|reducir (peso|grasa)|recomposicion/.test(t)) o.goal = "lose";
  else if (/ganar (masa|musculo|peso)|ganancia (muscular|de masa)|volumen|superavit|hipertrofia|aumentar (masa|peso)/.test(t)) o.goal = "gain";
  else if (/mantenimiento|mantener (el )?peso|normocalorica/.test(t)) o.goal = "keep";
  if (o.goal) found.push("objetivo");
  if (/sedentari/.test(t)) o.act = "sed"; else if (/muy activ|actividad\W{0,3}(muy )?alta|trabajo fisico/.test(t)) o.act = "alt";
  else if (/actividad\W{0,3}moderada|moderadamente activ/.test(t)) o.act = "mod"; else if (/actividad\W{0,3}(ligera|baja)|poco activ|ligeramente activ/.test(t)) o.act = "lig";
  if (o.act) found.push("actividad");
  if ((m = t.match(/(\d)\s*(dias|veces|sesiones)\s*(a la|por|\/|cada)\s*semana/))) { o.train = Math.min(7, +m[1]); found.push("días de entreno"); }
  const sp = ["gimnasio","pesas","fuerza","crossfit","correr","running","ciclismo","bici","natacion","futbol","padel","boxeo","yoga","pilates","hyrox","baloncesto"].filter(w => t.includes(w));
  if (sp.length) { o.sport = sp.slice(0, 3).join(", "); found.push("deporte"); }
  if (/\bvegan[oa]\b/.test(t)) o.diet = "vegan"; else if (/\bvegetarian[oa]\b|ovolacto/.test(t)) o.diet = "veg"; else if (/pescetarian/.test(t)) o.diet = "pesc";
  if (o.diet) found.push("tipo de alimentación");
  const av = [];
  for (const line of String(text).split(/\r?\n/)){ const l = nrm(line);
    if (/(alergi|intoleranc|evitar|no (debe )?tomar|no consumir|excluir|no le gusta|aversion)/.test(l)){ const v = line.split(/[:\-–]/).slice(1).join(" ").trim() || line.trim(); if (v.length < 120 && !/^(ninguna|no|niega|sin)\b/i.test(nrm(v))) av.push(v); } }
  if (av.length) { o.avoid = av.slice(0, 3).join("; ").slice(0, 160); found.push("alergias o alimentos a evitar"); }
  // objetivo de calorías y macros del estudio
  const kc = t.match(/(\d[\d.]{2,5})\s*(k?cal|kilocalorias)\b/), S = {};
  if (kc){ const v = +kc[1].replace(".", ""); if (v >= 900 && v <= 5000) S.kcal = v; }
  if ((m = t.match(/prote[ií]?nas?\D{0,25}?(\d{2,3})\s*g\b/))) S.p = +m[1];
  if ((m = t.match(/(hidratos de carbono|hidratos|carbohidratos|hc)\D{0,25}?(\d{2,3})\s*g\b/))) S.c = +m[2];
  if ((m = t.match(/(grasas|lipidos)\D{0,25}?(\d{2,3})\s*g\b/))) S.f = +m[2];
  if (S.kcal) { o.study = S; found.push("calorías" + (S.p ? " y macros" : "")); }
  return { vals:o, found };
}
