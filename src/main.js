import { createClient } from "@supabase/supabase-js";
import "./style.css";
import { microFor, microFromOFF, MICRO_KEYS } from "./micros.js";

let sb = null;

(() => {
/* ================= utilidades ================= */
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,"0");
const iso = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parseDay = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const addDays = (s,n) => { const d = parseDay(s); d.setDate(d.getDate()+n); return iso(d); };
const today = () => iso(new Date());
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const r0 = n => Math.round(+n||0);
const r1 = n => Math.round((+n||0)*10)/10;
const fmt = n => r0(n).toLocaleString("es-ES");
const rid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const MES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DIA = ["dom","lun","mar","mié","jue","vie","sáb"];
function dayLabel(s){ const t = today(); if (s===t) return "Hoy"; if (s===addDays(t,-1)) return "Ayer"; if (s===addDays(t,1)) return "Mañana";
  const d = parseDay(s); return DIA[d.getDay()]+" "+d.getDate()+" "+MES[d.getMonth()]; }
const longDay = s => { const d = parseDay(s); return DIA[d.getDay()]+" "+d.getDate()+" "+MES[d.getMonth()]; };
const shortDay = s => { const d = parseDay(s); return d.getDate()+" "+MES[d.getMonth()]; };
function fmtDur(ms){ const m = Math.max(0,Math.round(ms/60000)); return m>=60 ? Math.floor(m/60)+" h "+pad(m%60)+" min" : m+" min"; }
function clock(ms){ const s = Math.max(0,Math.floor(ms/1000)); const h=Math.floor(s/3600), m=Math.floor(s%3600/60); return (h? h+":"+pad(m) : m)+":"+pad(s%60); }
const e1rm = (kg,reps) => reps>0 ? kg*(1+reps/30) : kg;
const weekStart = s => { const d = parseDay(s); return addDays(s, -((d.getDay()+6)%7)); };

/* ================= catálogos ================= */
const LIB = [["Press banca","Pecho"],["Press inclinado con mancuernas","Pecho"],["Aperturas con mancuernas","Pecho"],["Cruces en polea","Pecho"],["Flexiones","Pecho"],
["Dominadas","Espalda"],["Jalón al pecho","Espalda"],["Remo con barra","Espalda"],["Remo con mancuerna","Espalda"],["Remo en polea baja","Espalda"],["Peso muerto","Espalda"],
["Press militar","Hombros"],["Press con mancuernas sentado","Hombros"],["Elevaciones laterales","Hombros"],["Pájaros","Hombros"],["Face pull","Hombros"],
["Curl con barra","Bíceps"],["Curl martillo","Bíceps"],["Curl en polea","Bíceps"],
["Extensión de tríceps en polea","Tríceps"],["Press francés","Tríceps"],["Fondos","Tríceps"],
["Sentadilla","Piernas"],["Sentadilla búlgara","Piernas"],["Prensa","Piernas"],["Extensión de cuádriceps","Piernas"],["Curl femoral","Piernas"],["Peso muerto rumano","Piernas"],["Zancadas","Piernas"],["Elevación de gemelos","Piernas"],
["Hip thrust","Glúteos"],["Patada de glúteo en polea","Glúteos"],
["Crunch abdominal","Core"],["Plancha","Core"],["Elevación de piernas colgado","Core"],["Rueda abdominal","Core"]];
const TR = [[/^incline/,"Press inclinado con mancuernas"],[/^bench press|^bench$/,"Press banca"],[/romanian deadlift|^rdl/,"Peso muerto rumano"],[/^deadlift/,"Peso muerto"],
  [/bulgarian/,"Sentadilla búlgara"],[/^(back )?squat|^front squat/,"Sentadilla"],[/^(overhead|military|standing) press|^ohp/,"Press militar"],[/^(seated )?(dumbbell )?shoulder press|^arnold/,"Press con mancuernas sentado"],
  [/^pull ?up|^chin ?up/,"Dominadas"],[/lat pulldown|pulldown/,"Jalón al pecho"],[/seated (cable )?row|cable row/,"Remo en polea baja"],[/(single arm|one arm|dumbbell) row|row.*dumbbell/,"Remo con mancuerna"],[/bent over row|barbell row|^row/,"Remo con barra"],
  [/lateral raise/,"Elevaciones laterales"],[/rear delt|reverse fly/,"Pájaros"],[/face pull/,"Face pull"],[/hammer curl/,"Curl martillo"],[/curl.*cable|cable curl/,"Curl en polea"],[/leg curl|hamstring curl/,"Curl femoral"],[/(bicep|biceps|barbell|ez bar)? ?curl/,"Curl con barra"],
  [/pushdown|triceps? extension.*cable|rope/,"Extensión de tríceps en polea"],[/skull ?crusher|french press/,"Press francés"],[/dip/,"Fondos"],[/leg press/,"Prensa"],[/leg extension/,"Extensión de cuádriceps"],
  [/hip thrust|glute bridge/,"Hip thrust"],[/kickback/,"Patada de glúteo en polea"],[/lunge/,"Zancadas"],[/calf/,"Elevación de gemelos"],[/(chest )?fly|flye/,"Aperturas con mancuernas"],[/crossover|cable fly/,"Cruces en polea"],
  [/push ?up/,"Flexiones"],[/hanging (knee|leg) raise|leg raise/,"Elevación de piernas colgado"],[/ab wheel|rollout/,"Rueda abdominal"],[/plank/,"Plancha"],[/crunch|sit ?up/,"Crunch abdominal"]];
function suggestES(name){ const b = norm(name).replace(/\(.*?\)/g,"").replace(/\s+/g," ").trim(); for (const [re,t] of TR) if (re.test(b)) return t; return ""; }
const isKnown = n => LIB.some(x=>x[0]===n) || (S.exlib||[]).some(x=>x.name===n);
function unreviewed(){ return allExerciseNames().used.filter(n=>!isKnown(n)); }
function sessionsOf(n){ return S.workouts.filter(w=>w.exercises.some(e=>e.name===n)).length; }
const MUSCLES = ["Pecho","Espalda","Hombros","Bíceps","Tríceps","Piernas","Glúteos","Core","Otros"];
function muscleOf(name){
  const own = (S.exlib||[]).find(x=>x.name===name); if (own) return own.muscle || "Otros";
  const hit = LIB.find(x=>x[0]===name); if (hit) return hit[1];
  const n = name.toLowerCase();
  const rules = [[/hip thrust|glute|glúteo|gluteo|kickback/,"Glúteos"],[/leg curl|femoral|hamstring|rumano|romanian|stiff/,"Piernas"],
    [/bench|chest|pec|fly|flye|aperturas|cruces|push ?up|flexion|press banca|inclin/,"Pecho"],
    [/tricep|tríceps|skull|francés|dip|fondos|pushdown/,"Tríceps"],[/curl|bicep|bíceps|martillo|hammer/,"Bíceps"],
    [/squat|sentadilla|leg press|prensa|lunge|zancada|calf|gemelo|leg ext|cuádriceps|step/,"Piernas"],
    [/shoulder|lateral|overhead|military|militar|arnold|face pull|rear delt|pájaro|hombro/,"Hombros"],
    [/row|remo|pull|dominada|lat |jalón|chin|deadlift|peso muerto|back/,"Espalda"],
    [/crunch|plank|plancha|ab |abs|abdominal|core|leg raise|elevación de piernas|wheel/,"Core"]];
  for (const [re,m] of rules) if (re.test(n)) return m;
  return "Otros";
}
const FOODS = [
["Pechuga de pollo (cocinada)",165,31,0,3.6,"filete",150],["Pechuga de pavo (cocinada)",135,30,0,1,"filete",150],["Filete de ternera",158,26,0,6,"filete",150],
["Carne picada mixta",250,17,0,20,"ración",125],["Salmón",208,20,0,13,"filete",150],["Merluza",86,17,0,1.8,"filete",150],["Atún en lata (al natural)",116,26,0,1,"lata",56],
["Gambas cocidas",99,24,0.2,0.3,"ración",100],["Huevo",143,12.6,0.7,9.5,"unidad",60],["Clara de huevo",52,11,0.7,0.2,"unidad",33],["Jamón serrano",241,30,0,13,"loncha",15],
["Fiambre de pavo",104,18,3,2,"loncha",15],["Tofu",76,8,1.9,4.8,"ración",100],["Arroz blanco (cocido)",130,2.7,28,0.3,"plato",200],["Arroz integral (cocido)",112,2.6,23,0.9,"plato",200],
["Pasta (cocida)",158,5.8,31,0.9,"plato",200],["Quinoa (cocida)",120,4.4,21,1.9,"plato",180],["Patata cocida",87,1.9,20,0.1,"unidad",170],["Boniato asado",90,2,21,0.2,"unidad",150],
["Pan blanco",265,9,49,3.2,"rebanada",30],["Pan integral",247,13,41,3.4,"rebanada",30],["Copos de avena",389,16.9,66,6.9,"ración",40],["Cereales de desayuno",380,7,84,2,"bol",40],
["Lentejas (cocidas)",116,9,20,0.4,"plato",250],["Garbanzos (cocidos)",164,8.9,27,2.6,"plato",250],["Leche semidesnatada",46,3.4,4.8,1.6,"vaso",250],["Leche entera",64,3.2,4.7,3.6,"vaso",250],
["Bebida de avena",45,1,6.5,1.5,"vaso",250],["Yogur natural",61,3.5,4.7,3.3,"unidad",125],["Yogur griego",115,6,4,9,"unidad",125],["Yogur proteico",60,10,4,0.2,"unidad",120],
["Queso fresco batido 0%",46,8,3.5,0.2,"ración",125],["Queso curado",400,26,0,33,"loncha",20],["Mozzarella",280,28,3,17,"ración",60],["Proteína whey",380,78,6,5,"cacito",30],
["Plátano",89,1.1,23,0.3,"unidad",120],["Manzana",52,0.3,14,0.2,"unidad",180],["Naranja",47,0.9,12,0.1,"unidad",160],["Fresas",32,0.7,7.7,0.3,"taza",150],["Kiwi",61,1.1,15,0.5,"unidad",75],
["Sandía",30,0.6,7.6,0.2,"tajada",280],["Aguacate",160,2,8.5,14.7,"medio",80],["Brócoli",34,2.8,7,0.4,"ración",150],["Ensalada mixta",20,1.2,3.5,0.2,"plato",150],["Tomate",18,0.9,3.9,0.2,"unidad",120],
["Aceite de oliva",884,0,0,100,"cucharada",10],["Almendras",579,21,22,50,"puñado",25],["Nueces",654,15,14,65,"puñado",25],["Crema de cacahuete",588,25,20,50,"cucharada",16],
["Hummus",166,8,14,9.6,"ración",50],["Chocolate negro 85%",600,10,20,50,"onza",10],["Miel",304,0.3,82,0,"cucharada",20],["Galletas",480,7,68,20,"unidad",8],
["Tortilla de patata",196,6.5,14,13,"pincho",120],["Pizza",266,11,33,10,"porción",110],["Hamburguesa completa",250,13,24,11,"unidad",220],["Patatas fritas de bolsa",536,7,53,35,"bolsa",40],
["Café con leche",30,1.9,2.8,1.2,"taza",200],["Zumo de naranja",45,0.7,10,0.2,"vaso",200],["Refresco de cola",42,0,10.6,0,"lata",330],["Cerveza",43,0.5,3.6,0,"caña",200]
].map(([name,kcal,p,c,f,sn,sg]) => ({name,kcal,p,c,f,servings:[{n:sn,g:sg}]}));
const MEALS = ["Desayuno","Comida","Cena","Snacks"];

/* ================= estado y almacenamiento ================= */
const S = { workouts:[], diary:{}, foods:[], routines:[], exlib:[], body:{},
  settings:{kcal:2200,p:140,c:230,f:70,days:4,rest:90,stepGoal:10000,addEx:false}, active:null, media:{}, health:{days:{}, wos:[]} };
let tab = "home", day = today(), metric = "kg", progEx = "";
let memMode = false, activeLoaded = false, user = null;
const AI_ON = import.meta.env.VITE_AI_ENABLED === "true";
const SIGNUP_OPEN = import.meta.env.VITE_ALLOW_SIGNUP === "true";
const TRAIN_ON = false;   // sección de entrenos oculta por ahora: poner true para volver a mostrarla
const INVITE_REQUIRED = import.meta.env.VITE_INVITE_REQUIRED === "true";
const smp = AI_ON ? {} : null;
const MAX_VIDEO_MB = 50;
let rest = null, audio = null, banner = "", importState = null;

function applyDoc(id, v){
  if (id.startsWith("w-")) { S.workouts = S.workouts.filter(w=>"w-"+w.id!==id); if (v) S.workouts.push(v); S.workouts.sort((a,b)=>b.start-a.start); }
  else if (id.startsWith("d-")) { if (v && v.entries && v.entries.length) S.diary[id.slice(2)] = v.entries; else delete S.diary[id.slice(2)]; }
  else if (id==="settings") S.settings = {...S.settings, ...(v||{})};
  else if (id==="foods") S.foods = v?.list || [];
  else if (id==="plan") S.plan = v?.days || {};
  else if (id==="plandates") S.planDates = v?.days ? v : null;
  else if (id==="routines") S.routines = v?.list || [];
  else if (id==="exlib") S.exlib = v?.list || [];
  else if (id==="body") S.body = v?.log || {};
  else if (id==="active") S.active = v || null;
  else if (id==="media"){ S.media = JSON.parse(JSON.stringify(v?.map || {})); for (const m of Object.values(S.media)) m.url = mediaUrls[m.id] || ""; queueMediaUrls(); }
  else if (id==="health") S.health = {days:v?.days||{}, wos:v?.wos||[]};
}
let q = Promise.resolve();
function enqueue(fn){ const p = q.then(fn); q = p.catch(()=>{}); return p; }
const strip = (id, v) => { if (id!=="media" || !v?.map) return v; const map = {}; for (const [k,m] of Object.entries(v.map)) map[k] = {id:m.id, type:m.type}; return {map}; };
async function put(id, v){
  applyDoc(id, v);
  try { await enqueue(async () => { const { error } = await sb.from("docs").upsert({user_id:user.id, id, data:strip(id, v)}); if (error) throw error; }); return true; }
  catch(e){ console.error(e); setBanner("No se pudo guardar el último cambio. Revisa la conexión e inténtalo otra vez."); return false; }
}
async function putMany(pairs, onProgress){
  pairs.forEach(([id,v]) => applyDoc(id, v));
  try { for (let i=0; i<pairs.length; i+=100){ const rows = pairs.slice(i,i+100).map(([id,v]) => ({user_id:user.id, id, data:strip(id, v)}));
      await enqueue(async () => { const { error } = await sb.from("docs").upsert(rows); if (error) throw error; }); onProgress?.(Math.min(i+100, pairs.length), pairs.length); }
    return true; }
  catch(e){ console.error(e); setBanner("No se pudo guardar todo. Revisa la conexión e inténtalo otra vez."); return false; }
}
async function del(id){
  applyDoc(id, null);
  try { await enqueue(async () => { const { error } = await sb.from("docs").delete().eq("user_id", user.id).eq("id", id); if (error) throw error; }); return true; }
  catch(e){ console.error(e); setBanner("No se pudo borrar. Inténtalo otra vez."); return false; }
}
const putDay = d => S.diary[d]?.length ? put("d-"+d, {entries:S.diary[d]}) : del("d-"+d);
function setBanner(t){ banner = t; const b = $("bannerBox"); if (b){ b.textContent = t; b.hidden = !t; } }

/* ---- vídeos (Supabase Storage, carpeta privada por usuario) ---- */
const mediaUrls = {}; let mediaT = null;
function queueMediaUrls(){ clearTimeout(mediaT); mediaT = setTimeout(resolveMediaUrls, 50); }
async function resolveMediaUrls(){
  if (!sb || !user) return; const missing = Object.values(S.media).map(m=>m.id).filter(id => id && !mediaUrls[id]); if (!missing.length) return;
  const { data, error } = await sb.storage.from("videos").createSignedUrls(missing, 60*60*24*7); if (error || !data) return;
  for (const d of data) if (d.signedUrl) mediaUrls[d.path] = d.signedUrl;
  for (const m of Object.values(S.media)) m.url = mediaUrls[m.id] || "";
  if (sheetCtx?.kind==="exinfo"){ const prev = sheetCtx.prev; openExInfo(sheetCtx.name, sheetCtx.from); sheetCtx.prev = prev; }
  render();
}
const assets = {
  async upload(file){ const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("videos").upload(path, file, {contentType:file.type || undefined, upsert:false});
    if (error) throw {code: /mime|type/i.test(error.message) ? "invalid_request" : "upload", message:error.message};
    const { data } = await sb.storage.from("videos").createSignedUrl(path, 60*60*24*7); mediaUrls[path] = data?.signedUrl || "";
    return {id:path, url:mediaUrls[path], contentType:file.type}; },
  async delete(path){ await sb.storage.from("videos").remove([path]); }
};

/* ---- descargas ---- */
const dl = { async save({filename, data}){
  const blob = data instanceof Blob ? data : new Blob([data], {type: filename.endsWith(".json") ? "application/json" : "text/csv;charset=utf-8"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000); } };

/* ---- IA (función /api/estimate en Vercel) ---- */
async function aiEstimate(text){
  const { data:{ session } } = await sb.auth.getSession();
  const r = await fetch("/api/estimate", {method:"POST", headers:{"content-type":"application/json", authorization:"Bearer " + (session?.access_token || "")}, body:JSON.stringify({text})});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw {code: j.code || (r.status===429 ? "rate_limited" : r.status===401 ? "not_granted" : "error")};
  return j;
}

/* ---- arranque: sesión, carga de datos y sincronización en vivo ---- */
let renderT = null; const scheduleRender = () => { clearTimeout(renderT); renderT = setTimeout(render, 120); };
async function loadAll(){
  const rows = []; for (let from = 0;; from += 1000){
    const { data, error } = await sb.from("docs").select("id,data").order("id").range(from, from+999);
    if (error) throw error; rows.push(...data); if (data.length < 1000) break; }
  Object.assign(S, {plan:{}, planDates:null, workouts:[], diary:{}, foods:[], routines:[], exlib:[], body:{}, media:{}, health:{days:{}, wos:[]}, settings:{kcal:2200,p:140,c:230,f:70,days:4,rest:90,stepGoal:10000,addEx:false}, active:null});
  for (const r of rows) applyDoc(r.id, r.data);
  activeLoaded = true;
}
async function start(u){
  if (user) return; user = u; $("auth").hidden = true; $("app").hidden = false;
  setBanner("Cargando tus datos…"); render();
  try { await loadAll(); setBanner(""); loadPremium(); } catch(e){ console.error(e); setBanner("No se pudieron cargar tus datos. Revisa la conexión y vuelve a abrir la app."); }
  render(); checkHash();
  if (!S.settings.onboarded && !location.hash.includes("watch")) openGoalWizard(true);
  sb.channel("docs-" + user.id).on("postgres_changes", {event:"*", schema:"public", table:"docs", filter:`user_id=eq.${user.id}`}, p => {
    const id = p.new?.id ?? p.old?.id; if (!id || id==="active") return;
    applyDoc(id, p.eventType==="DELETE" ? null : p.new.data); scheduleRender();
  }).subscribe();
}
function authView(mode, msg){
  if (mode==="signup" && !SIGNUP_OPEN) mode = "login";
  const A = $("auth"); A.hidden = false; $("app").hidden = true;
  const m = msg ? `<p class="${msg.ok?"note":"msg"}" style="${msg.ok?"color:var(--ok)":""}">${esc(msg.t)}</p>${msg.resend?`<button type="button" class="btn soft" data-resend="${esc(msg.resend)}">Reenviar email de confirmación</button>`:""}` : "";
  if (mode==="reset"){ A.className = "auth"; A.innerHTML = `<form class="auth-card" id="fReset"><h1>Nueva contraseña</h1><label class="f">Contraseña nueva<input id="aPass" type="password" minlength="6" required autocomplete="new-password"></label>${m}<button class="btn" type="submit">Guardar contraseña</button></form>`; return; }
  const signup = mode==="signup", forgot = mode==="forgot";
  const card = `<form class="auth-card" id="fAuth" data-mode="${mode}">
    <div class="brand"><span class="brand-mark" aria-hidden="true"></span><h1>beinghealthy</h1></div>
    <p class="note">${signup?(INVITE_REQUIRED?"Crea tu cuenta con tu email. Necesitas el código de invitación que te han pasado.":"Crea tu cuenta para guardar tus entrenos y comidas."):forgot?"Te enviamos un email para cambiar la contraseña.":SIGNUP_OPEN?"Tus entrenos, comidas y progreso en un solo sitio.":"Acceso solo por invitación. Entra con el email y la contraseña que te han dado."}</p>
    <label class="f">Email<input id="aEmail" type="email" required autocomplete="email"></label>
    ${forgot?"":`<label class="f">Contraseña${signup?" (mín. 6 caracteres)":""}<input id="aPass" type="password" minlength="6" required autocomplete="${signup?"new-password":"current-password"}"></label>`}
    ${signup?`<label class="consent"><input type="checkbox" id="aConsent" required> <span>He leído y acepto los <a href="/terminos.html" target="_blank" rel="noopener">términos de uso</a> y la <a href="/privacidad.html" target="_blank" rel="noopener">política de privacidad</a>, y doy mi consentimiento expreso para que se traten los datos de salud que yo introduzca (peso, comidas, entrenos y actividad).</span></label>`:""}
    ${signup&&INVITE_REQUIRED?`<label class="f">Código de invitación<input id="aInvite" required autocomplete="off" autocapitalize="characters" placeholder="ABCD-1234"></label>`:""}
    ${m}<button class="btn" type="submit">${signup?"Crear cuenta":forgot?"Enviar email":"Entrar"}</button>
    <div class="auth-links">${signup?`<button type="button" class="link" data-auth="login">Ya tengo cuenta</button>`:SIGNUP_OPEN?`<button type="button" class="link" data-auth="signup">Crear cuenta</button>`:"<span></span>"}
      ${forgot?`<button type="button" class="link" data-auth="login">Volver</button>`:`<button type="button" class="link" data-auth="forgot">He olvidado mi contraseña</button>`}</div>
    <p class="note legal"><a href="/terminos.html" target="_blank" rel="noopener">Términos</a> · <a href="/privacidad.html" target="_blank" rel="noopener">Privacidad</a></p></form>`;
  A.className = "landing"; A.innerHTML = landingHTML(card, mode);
}
const ICONS = {
  lift:'<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  food:'<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.5 1-4 3.5-4 7v3h4"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  play:'<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>',
  watch:'<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3M12 9.5V12l1.5 1.5"/>',
  swap:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  scan:'<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M16 8v8"/>',
  ring:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 8 8"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>',
  fire:'<path d="M12 21c-3.9 0-7-2.8-7-6.5 0-3.2 2.4-5.2 3.6-7.5.6 1.8 1.6 2.8 2.9 3.3C11.3 7.5 12.5 4.8 15 3c-.3 3 3.9 5.6 3.9 11.2C18.9 18.3 15.9 21 12 21z"/>'};
const ic = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
function landingHTML(card, mode){
  const feat = (k,t,d) => `<div class="lf-item"><span class="lf-ic">${ic(k)}</span><h3>${t}</h3><p>${d}</p></div>`;
  const faq = (q,a) => `<details class="lf-faq"><summary>${q}</summary><p>${a}</p></details>`;
  return `<header class="lh"><div class="lh-in"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><b>beinghealthy</b></a>
      <nav>${SIGNUP_OPEN?`<button class="btn soft" data-auth="signup" data-go>Crear cuenta</button>`:""}<button class="btn ghost" data-auth="login" data-go>Entrar</button></nav></div></header>
    <section class="hero"><div class="hero-txt">
        <span class="kicker">Gratis · En el móvil y el ordenador</span>
        <h1>Tu dieta, <em>al gramo</em>, sin complicarte.</h1>
        <p class="lead">Mete tu plan de comidas una vez y cada día te lo encuentras puesto. Escribe los gramos que has comido, marca ✓ y la app calcula tus calorías y tus macros.</p>
        <div class="hero-cta">${SIGNUP_OPEN?`<button class="btn big" data-auth="signup" data-go>Crear cuenta gratis</button>`:""}<button class="btn ghost big" data-auth="login" data-go>Ya tengo cuenta</button></div>
        <p class="note">Funciona en iPhone, Android y ordenador. Se instala en la pantalla de inicio como una app.</p>
      </div>
      <div class="hero-side">
        <div class="phone" aria-hidden="true">
          <div class="ph-top"><b>HOY · DÍA 11</b><span class="ph-chip">🔥 6 días</span></div>
          <div class="ph-ringrow"><svg viewBox="0 0 132 132" class="ph-ring"><circle cx="66" cy="66" r="54"/><circle cx="66" cy="66" r="54" class="fg" stroke-dasharray="339.3" stroke-dashoffset="128"/></svg>
            <div class="ph-ringc"><b>624</b><span>kcal restantes</span></div></div>
          <div class="ph-mac"><i style="--w:62%;--c:var(--carb)"></i><i style="--w:48%;--c:var(--fat)"></i><i style="--w:81%;--c:var(--prot)"></i></div>
          <div class="ph-card"><b class="ph-ex">COMIDA · TERNERA CON PATATA</b>
            <div class="ph-item ok"><em>✓</em><span>Ternera magra</span><b>150 g</b></div>
            <div class="ph-item ok"><em>✓</em><span>Patata</span><b>300 g</b></div>
            <div class="ph-item"><em>✓</em><span>Verduras</span><b>250 g</b></div>
            <div class="ph-item"><em>✓</em><span>Aceite de oliva</span><b>5 g</b></div></div>
          <div class="ph-scan"><span class="ph-bars" aria-hidden="true"></span><span><b>Yogur natural · Pascual</b><small>62 kcal · P 3,6 · C 4,8 · G 3,1 por 100 g</small></span></div>
        </div>
      </div>
    </section>
    <section class="lf"><h2 class="lsec">Todo lo que necesitas para comer bien</h2>
      <div class="lf-grid">
        ${feat("food","Tu plan, ya puesto","Mete tu plan semanal o de un mes y cada día aparece en su desayuno, comida y cena. Solo escribes los gramos.")}
        ${feat("scan","Escanea el código de barras ⭐","Apunta con la cámara al paquete y la app trae sus kcal, proteínas, hidratos y grasas por 100 g. Función Premium: 3 € al mes.")}
        ${feat("ring","Calorías y macros del día","Un anillo te dice cuánto te queda, y las barras cuánta proteína, hidratos y grasa llevas.")}
        ${feat("target","Tu objetivo, calculado","Con tu peso, altura, edad y actividad te proponemos calorías y proteína. Y si tu plan trae objetivo por día, se usa ese.")}
        ${feat("chart","Tu progreso a la vista","Peso corporal y calorías de las últimas semanas, para ver la tendencia y no fijarte en un solo día.")}
        ${feat("fire","Racha de días","Cada día que apuntas suma a tu racha. Ver la llama encendida ayuda a no saltarse días.")}
        ${feat("swap","Trae tus datos","Importa tu historial de comidas de MyFitnessPal y descarga los tuyos cuando quieras.")}
        ${feat("lock","Privado","Tus datos solo los ves tú. Puedes descargarlos o borrar tu cuenta en cualquier momento.")}
      </div></section>
    <section class="lsteps"><h2 class="lsec">Empieza en un minuto</h2>
      <ol><li><b>Crea tu cuenta</b><span>Con tu email y una contraseña. Confirma desde el correo que te llega.</span></li>
        <li><b>Pon tu objetivo o tu plan</b><span>Calcula tus calorías en un paso, o mete el plan de comidas que ya sigues.</span></li>
        <li><b>Apunta lo que comes</b><span>Gramos y ✓. O escanea el código de barras de lo que no esté en tu plan.</span></li></ol></section>
    <section class="lauth" id="lauth"><div class="lauth-txt"><h2 class="lsec">${mode==="signup"?"Crea tu cuenta":mode==="forgot"?"Recupera tu contraseña":"Entra en tu cuenta"}</h2><p class="note">${mode==="signup"?"Es gratis. Solo necesitas un email.":mode==="forgot"?"Te enviamos un enlace para elegir una nueva.":"¿Aún no tienes cuenta? Créala gratis en un minuto."}</p></div>${card}</section>
    <section class="lfaqs"><h2 class="lsec">Preguntas frecuentes</h2>
      ${faq("¿Cuánto cuesta?","La app es gratis. El escáner de códigos de barras es Premium: 3 € al mes, que se pagan por Bizum desde la propia app. No se renueva solo: cada mes decides si sigues.")}
      ${faq("¿Tengo que descargar algo?","No. Es una web que funciona en el navegador. En el iPhone, abre la web en Safari, pulsa Compartir y «Añadir a pantalla de inicio» para tenerla como una app.")}
      ${faq("¿Puedo meter la dieta que ya sigo?","Sí. En Diario › Crear a mano montas cada día de la semana con sus alimentos y gramos habituales. A partir de ahí, cada día te aparece ya puesto y solo cambias los gramos si hace falta.")}
      ${faq("¿Y si un producto no sale al escanearlo?","Los datos vienen de Open Food Facts, una base de datos abierta. Si un producto no está, créalo en «Crear» copiando la etiqueta y se queda guardado para la próxima vez.")}
      ${faq("¿Puedo pasar mis datos de MyFitnessPal?","Sí. Exporta el archivo «Nutrition Summary» desde la web de MyFitnessPal e impórtalo en Perfil › Importar.")}
      ${faq("¿Quién puede ver mis datos?","Solo tú. Cada cuenta ve únicamente sus propios datos. Más detalles en la política de privacidad.")}
      ${faq("¿Sirve como consejo médico o nutricional?","No. Es una herramienta para registrar lo que comes y ver tu progreso. Las calorías propuestas son orientativas: para un plan de dieta, consulta a un dietista-nutricionista.")}
    </section>
    <footer class="lfoot"><span>© ${new Date().getFullYear()} beinghealthy</span><span><a href="/terminos.html">Términos</a> · <a href="/privacidad.html">Privacidad</a></span></footer>`;
}
document.addEventListener("click", async e => { const rs = e.target.closest("[data-resend]");
  if (rs){ rs.disabled = true; const { error } = await sb.auth.resend({type:"signup", email:rs.dataset.resend, options:{emailRedirectTo:location.origin}});
    authView("login", error ? {t: /rate|seconds|limit/i.test(error.message) ? "Espera un minuto antes de pedir otro email." : "No se pudo reenviar. Inténtalo en un rato."} : {ok:true, t:"Te hemos enviado otro email de confirmación. Revisa también el spam."}); return; }
  const b = e.target.closest("[data-auth]"); if (!b) return; authView(b.dataset.auth);
  if (b.hasAttribute("data-go")) setTimeout(() => { $("lauth")?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth", block:"start"}); $("aEmail")?.focus({preventScroll:true}); }, 30); });
document.addEventListener("submit", async e => {
  if (e.target.id==="fAuth"){ e.preventDefault(); const mode = e.target.dataset.mode, email = $("aEmail").value.trim(), pass = $("aPass")?.value, btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    if (mode==="login"){ const { error } = await sb.auth.signInWithPassword({email, password:pass}); if (error && /confirm/i.test(error.message)){ authView("login", {t:"Confirma tu email antes de entrar: revisa tu bandeja de entrada y la carpeta de spam.", resend:email}); }
      else if (error) authView("login", {t: /confirm/i.test(error.message) ? "Confirma tu email antes de entrar (revisa tu bandeja de entrada)." : SIGNUP_OPEN ? "Email o contraseña incorrectos." : "Email o contraseña incorrectos. Si aún no tienes acceso, pídeselo a quien te pasó el enlace."}); }
    else if (mode==="signup"){ const invite = ($("aInvite")?.value || "").trim().toUpperCase();
      const meta = {consent_at:new Date().toISOString(), consent_version:"2026-11"}; if (invite) meta.invite = invite;
      const { data, error } = await sb.auth.signUp({email, password:pass, options:{emailRedirectTo:location.origin, data:meta}});
      if (error) authView("signup", {t: /registered|exists/i.test(error.message) ? "Ya hay una cuenta con ese email. Entra con tu contraseña." : /password/i.test(error.message) ? "La contraseña debe tener al menos 6 caracteres." : /signups? (are )?not allowed|disabled/i.test(error.message) ? "El registro está cerrado ahora mismo." : /rate|limit/i.test(error.message) ? "Demasiados intentos. Espera unos minutos." : INVITE_REQUIRED ? "Ese código de invitación no es válido o ya se ha usado." : "No se pudo crear la cuenta. Inténtalo otra vez."});
      else if (!data.session) authView("login", {ok:true, t:"Te hemos enviado un email para confirmar la cuenta. Ábrelo y luego entra aquí. Si no llega, mira en spam.", resend:email}); }
    else { const { error } = await sb.auth.resetPasswordForEmail(email, {redirectTo:location.origin}); authView("login", error ? {t:"No se pudo enviar el email."} : {ok:true, t:"Si existe una cuenta con ese email, te llegará un enlace para cambiar la contraseña."}); } }
  if (e.target.id==="fReset"){ e.preventDefault(); const { error } = await sb.auth.updateUser({password:$("aPass").value});
    if (error) authView("reset", {t:"No se pudo cambiar. Usa al menos 6 caracteres."}); else { $("auth").hidden = true; if (!user){ const { data:{ session } } = await sb.auth.getSession(); if (session) start(session.user); } } }
});
async function init(){
  const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key){ $("auth").hidden = false; $("auth").innerHTML = `<div class="auth-card"><h1>Falta configuración</h1><p class="note">Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en las variables de entorno (archivo .env en local o en Vercel) y vuelve a desplegar.</p></div>`; return; }
  sb = createClient(url, key);
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev==="PASSWORD_RECOVERY") { authView("reset"); return; }
    if (ev==="SIGNED_OUT") { location.reload(); return; }
    if (session?.user && !user && ev!=="INITIAL_SESSION") setTimeout(() => start(session.user), 0);
  });
  const { data:{ session } } = await sb.auth.getSession();
  if (session?.user && !location.hash.includes("type=recovery")) start(session.user); else if (!location.hash.includes("type=recovery")) authView("login");
}
async function deleteAccount(){
  const { data:{ session } } = await sb.auth.getSession();
  const r = await fetch("/api/delete-account", {method:"POST", headers:{authorization:"Bearer " + (session?.access_token || "")}});
  const j = await r.json().catch(() => ({})); return {ok:r.ok, code:j.code};
}
async function deleteAllData(){
  const { error } = await sb.from("docs").delete().eq("user_id", user.id);
  const paths = Object.values(S.media).map(m=>m.id).filter(Boolean);
  const { data:files } = await sb.storage.from("videos").list(user.id, {limit:1000});
  const all = [...new Set([...paths, ...(files||[]).map(f=>`${user.id}/${f.name}`)])];
  if (all.length) await sb.storage.from("videos").remove(all);
  return !error;
}

/* ================= cálculos ================= */
const doneSets = w => w.exercises.reduce((n,e)=>n+e.sets.length,0);
const volume = w => w.exercises.reduce((v,e)=>v+e.sets.reduce((a,s)=>a+(+s.kg||0)*(+s.reps||0),0),0);
function prevFor(name){ for (const w of S.workouts){ const e = w.exercises.find(x=>x.name===name); if (e) return e.sets; } return null; }
function allExerciseNames(){ const used = []; for (const w of S.workouts) for (const e of w.exercises) if (!used.includes(e.name)) used.push(e.name);
  const rest = [...LIB.map(x=>x[0]), ...S.exlib.map(x=>x.name)].filter(n=>!used.includes(n)); return {used, all:[...used, ...rest]}; }
const dayTotals = d => (S.diary[d]||[]).reduce((t,e)=>({kcal:t.kcal+(+e.kcal||0),p:t.p+(+e.p||0),c:t.c+(+e.c||0),f:t.f+(+e.f||0)}),{kcal:0,p:0,c:0,f:0});
const workoutDays = () => new Set(S.workouts.map(w=>iso(new Date(w.start))));
function bestsBefore(name, beforeStart){ let kg=0, rm=0, has=false;
  for (const w of S.workouts) if (w.start<beforeStart) for (const e of w.exercises) if (e.name===name) for (const s of e.sets){ has=true; kg=Math.max(kg,+s.kg||0); rm=Math.max(rm,e1rm(+s.kg||0,+s.reps||0)); }
  return {kg,rm,has}; }

/* ================= render principal ================= */
function render(){
  if (!TRAIN_ON && tab==="train") tab = "home";
  const tb = $("tabbar"); tb.classList.toggle("six", TRAIN_ON); tb.querySelector('[data-tab="train"]').hidden = !TRAIN_ON;
  document.querySelectorAll("#tabbar button").forEach(b => { b.toggleAttribute("aria-current", b.dataset.tab===tab); if (b.dataset.tab===tab) b.setAttribute("aria-current","page");
    b.classList.toggle("live", b.dataset.tab==="train" && !!S.active); });
  const top = `<div id="bannerBox" class="banner" ${banner?"":"hidden"}>${esc(banner)}</div>`;
  const views = {home:viewHome, train:viewTrain, food:viewFood, nutri:viewNutri, progress:viewProgress, profile:viewProfile};
  $("main").innerHTML = top + views[tab]();
  if (tab !== lastTab){ lastTab = tab; $("main").classList.remove("enter"); void $("main").offsetWidth; $("main").classList.add("enter"); }
  requestAnimationFrame(() => document.querySelectorAll("[data-ring]").forEach(el => el.style.strokeDashoffset = el.dataset.ring));
  tick();
}
let lastTab = null;

/* ---------- confeti ---------- */
function confetti(){
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas"); c.className = "confetti"; document.body.appendChild(c);
  const x = c.getContext("2d"), W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio;
  const cols = ["#2C6CF0","#F5A64C","#1B8550","#7C55E6","#0D9DAE","#E8364F"];
  const P = Array.from({length:140}, () => ({x:W/2 + (Math.random()-.5)*W*.2, y:H*.35, vx:(Math.random()-.5)*W*.018, vy:-Math.random()*H*.022 - H*.006,
    r:(4 + Math.random()*5)*devicePixelRatio, c:cols[Math.random()*cols.length|0], a:Math.random()*6, s:(Math.random()-.5)*.3}));
  const t0 = performance.now();
  (function f(t){ const k = (t - t0) / 1800; x.clearRect(0,0,W,H);
    for (const p of P){ p.vy += H*.0009; p.x += p.vx; p.y += p.vy; p.a += p.s; x.save(); x.globalAlpha = Math.max(0, 1-k); x.translate(p.x,p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r/2,-p.r/4,p.r,p.r/2); x.restore(); }
    if (k < 1) requestAnimationFrame(f); else c.remove(); })(t0);
}

/* ---------- racha ---------- */
function streak(){
  const active = d => (S.diary[d]||[]).length || S.workouts.some(w => iso(new Date(w.start))===d);
  let d = today(); if (!active(d)) d = addDays(d,-1); let n = 0;
  while (active(d) && n < 999){ n++; d = addDays(d,-1); }
  return n;
}
function greet(){ const h = new Date().getHours(); return h<6 ? "Buenas noches" : h<14 ? "Buenos días" : h<21 ? "Buenas tardes" : "Buenas noches"; }

/* ---------- Inicio ---------- */
function viewHome(){
  const t = today(), ws = weekStart(t), wd = workoutDays();
  const count = [...wd].filter(d=>d>=ws && d<=addDays(ws,6)).length;
  const tot = dayTotals(t), remaining = goalsFor(t).kcal - tot.kcal;
  const dots = ["L","M","X","J","V","S","D"].map((l,i)=>{ const d = addDays(ws,i); return `<div>${l}<i class="${wd.has(d)?"on":""} ${d===t?"today":""}"></i></div>`; }).join("");
  const feed = S.workouts.slice(0,15).map(workoutCard).join("");
  const st = streak(), td = parseDay(today());
  return `<div class="hello"><div><span class="hello-date">${DIA[td.getDay()]} ${td.getDate()} ${MES[td.getMonth()]}</span><h1>${greet()}</h1></div>
    <div class="streak ${st?"on":""}" title="Días seguidos apuntando comidas o entrenando"><span class="fire" aria-hidden="true">🔥</span><b>${st}</b><span>${st===1?"día":"días"} de racha</span></div></div>
  ${!TRAIN_ON ? homeFood(t, tot, remaining) : `<div class="top">${S.active?`<button class="btn" data-act="tab" data-tab="train">Seguir entreno · <span data-elapsed></span></button>`:""}</div>
  <div class="grid2">
    <div class="card"><h2>Esta semana</h2><div><span class="big">${count}</span> <span class="note">/ ${S.settings.days} entrenos</span></div><div class="dots">${dots}</div></div>
    <div class="card today"><h2>Hoy</h2><div><span class="big" style="color:${remaining<0?"var(--danger)":"var(--accent)"}">${fmt(Math.abs(remaining))}</span> <span class="note">kcal ${remaining<0?"de más":"restantes"}</span></div>
      <div class="note tnum">P ${r0(tot.p)} · C ${r0(tot.c)} · G ${r0(tot.f)} g</div>
      <button class="btn soft" data-act="tab" data-tab="food">Abrir diario</button></div>
  </div>
  <div class="top"><h2>Entrenos</h2>${S.workouts.length?`<span class="note">${S.workouts.length} en total</span>`:""}</div>
  ${feed || `<div class="empty"><span>Aún no hay entrenos guardados. Empieza uno o importa tu historial de Hevy o Strong.</span>
     <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn" data-act="start-empty">Empezar entreno</button><button class="btn ghost" data-act="tab" data-tab="profile">Importar</button></div></div>`}`}`;
}
function homeFood(t, tot, remaining){
  const g = goalsFor(t), P = curPlan(t), dishes = P.dishes || {};
  const meals = MEALS.map(m => { const items = (P[m]||[]).filter(f => !f.opt || f.opt === (planOpts(P[m]).length ? planOpts(P[m])[0] : null));
      const logged = (S.diary[t]||[]).filter(e => e.meal===m), lk = logged.reduce((a,e)=>a+(+e.kcal||0),0);
      if (!items.length && !logged.length) return "";
      const pk = items.reduce((a,f)=>a+nutr(f,f.g).kcal,0);
      return `<button class="hm-row" data-act="tab" data-tab="food"><span class="hm-m">${m}</span><span class="hm-d">${esc(dishes[m] || (items.length ? items.filter(f => !/aceite|leche desnatada \(en el café\)/i.test(f.name)).slice(0,3).map(f => f.name.replace(/\s*\(.*?\)/g,"")).join(", ") : logged.map(e=>e.name).join(", ")))}</span>
        <span class="hm-k ${logged.length?"ok":""}">${logged.length ? "✓ "+fmt(lk) : fmt(pk)} kcal</span></button>`; }).join("");
  return `<div class="card today"><h2>Hoy</h2><div><span class="big">${fmt(Math.abs(remaining))}</span> <span class="note">kcal ${remaining<0?"de más":"restantes"} de ${fmt(g.kcal)}</span></div>
      <div class="hm-mac">${[["Proteínas",tot.p,g.p],["Carbohidratos",tot.c,g.c],["Grasas",tot.f,g.f]].map(([l,v,o])=>`<div><span>${l}</span><b>${r0(v)} / ${r0(o)} g</b><i style="--w:${Math.min(100,o?v/o*100:0)}%"></i></div>`).join("")}</div>
      <button class="btn soft" data-act="tab" data-tab="food">Abrir diario</button></div>
    ${meals ? `<div class="card"><div class="top"><h2>${P._n ? "Hoy toca · día "+P._n : "Hoy toca"}</h2><button class="link" data-act="tab" data-tab="food">Ver diario</button></div><div class="hm-list">${meals}</div></div>`
      : `<div class="card"><h2>Tu plan de comidas</h2><p class="note">Importa tu plan y aquí verás qué te toca comer cada día.</p><button class="btn" data-act="tab" data-tab="food">Ir al Diario</button></div>`}`;
}
const WTYPES = {Running:"Correr",Walking:"Caminar",Cycling:"Ciclismo",TraditionalStrengthTraining:"Fuerza",FunctionalStrengthTraining:"Fuerza funcional",HighIntensityIntervalTraining:"HIIT",
  Swimming:"Natación",Soccer:"Fútbol",Basketball:"Baloncesto",Tennis:"Tenis",Paddle:"Pádel",PickleBall:"Pickleball",Elliptical:"Elíptica",Rowing:"Remo",Yoga:"Yoga",Hiking:"Senderismo",CoreTraining:"Core",
  Cooldown:"Enfriamiento",StairClimbing:"Escaleras",MixedCardio:"Cardio mixto",Dance:"Baile",Boxing:"Boxeo",CrossTraining:"Cross training",Pilates:"Pilates",Other:"Otro"};
const wname = t => WTYPES[t] || t.replace(/([a-z])([A-Z])/g,"$1 $2");
function wline(w){ const parts = [fmtDur(w.end-w.start)]; if (w.km) parts.push(r1(w.km).toLocaleString("es-ES")+" km"); if (w.kcal) parts.push(fmt(w.kcal)+" kcal");
  return `<div class="li" style="cursor:default"><span class="n"><b>${esc(wname(w.type))}</b><small>${dayLabel(iso(new Date(w.start)))} · ${parts.join(" · ")}</small></span><span class="note">⌚</span></div>`; }
function activityCard(){
  const H = S.health, t = today(), dates = Object.keys(H.days).sort();
  if (!dates.length && !H.wos.length) return `<div class="card"><h2>Actividad · Apple Watch</h2><p class="note">Trae tus pasos, calorías activas y entrenos del Apple Watch.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="shortcut-guide">Configurar atajo</button><button class="btn ghost" data-act="tab" data-tab="profile">Importar historial</button></div></div>`;
  const ref = H.days[t] ? t : dates[dates.length-1], d = H.days[ref] || {steps:0,kcal:0}, goal = S.settings.stepGoal || 10000;
  const bars = []; for (let i=6;i>=0;i--){ const k = addDays(ref||t,-i); bars.push({k, v:H.days[k]?.steps||0}); }
  const mx = Math.max(goal, ...bars.map(b=>b.v));
  const svg = `<svg viewBox="0 0 210 64" role="img" aria-label="Pasos de los últimos 7 días" style="width:100%;max-width:260px;height:auto">${bars.map((b,i)=>{ const h = b.v/mx*48;
    return `<rect x="${i*30+5}" y="${52-h}" width="20" height="${Math.max(h,1)}" rx="3" fill="${b.v>=goal?"var(--ok)":"var(--accent)"}" opacity="${b.k===ref?1:.55}"/><text x="${i*30+15}" y="63" text-anchor="middle" font-size="9" fill="var(--muted)">${"DLMXJVS"[parseDay(b.k).getDay()]}</text>`; }).join("")}
    <line x1="0" x2="210" y1="${52-goal/mx*48}" y2="${52-goal/mx*48}" stroke="var(--muted)" stroke-dasharray="3 3"/></svg>`;
  const recent = [...H.wos].sort((a,b)=>b.start-a.start).slice(0,3);
  return `<div class="card"><div class="top"><h2>Actividad · Apple Watch</h2><span class="note">${ref===t?"Hoy":"Último dato: "+dayLabel(ref).toLowerCase()}</span></div>
    <div class="top" style="align-items:flex-end"><div><span class="big">${fmt(d.steps)}</span> <span class="note">/ ${fmt(goal)} pasos</span>
      <div class="bar" style="margin-top:8px;width:180px;max-width:100%"><i style="width:${Math.min(100,d.steps/goal*100)}%;background:${d.steps>=goal?"var(--ok)":"var(--accent)"}"></i></div>
      <div class="note tnum" style="margin-top:6px">${fmt(d.kcal)} kcal activas</div></div>${svg}</div>
    ${recent.length?`<div class="list">${recent.map(wline).join("")}</div>`:""}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn soft" data-act="watch-paste">Pegar datos de hoy</button><button class="btn ghost" data-act="shortcut-guide">Configurar atajo</button></div></div>`;
}
function workoutCard(w){
  const d = iso(new Date(w.start)), t = new Date(w.start);
  const lines = w.exercises.slice(0,4).map(e=>`<div>${e.sets.length} series · <b>${esc(e.name)}</b></div>`).join("") + (w.exercises.length>4?`<div>+ ${w.exercises.length-4} ejercicios más</div>`:"");
  return `<button class="card wcard" data-act="open-workout" data-id="${esc(w.id)}">
    <div><h3>${esc(w.title||"Entreno")}${w.example?'<span class="ex-tag">ejemplo</span>':""}</h3><div class="note">${dayLabel(d)} · ${pad(t.getHours())}:${pad(t.getMinutes())}</div></div>
    <div class="wstats"><div><span>Duración</span><b>${w.end?fmtDur(w.end-w.start):"—"}</b></div><div><span>Volumen</span><b>${fmt(volume(w))} kg</b></div>${w.prs?`<div><span>Récords</span><b class="trophy">🏆 ${w.prs}</b></div>`:""}</div>
    <div class="wlines">${lines}</div></button>`;
}

/* ---------- Entrenar ---------- */
function viewTrain(){
  if (S.active) return viewActive();
  const routines = S.routines.map(r=>`<div class="card rcard"><div class="top"><h3>${esc(r.name)}${r.example?'<span class="ex-tag">ejemplo</span>':""}</h3>
      <button class="iconb" data-act="edit-routine" data-id="${esc(r.id)}" aria-label="Editar rutina">✎</button></div>
      <div class="rx">${r.exercises.map(e=>esc(e.name)).join(", ")||"Sin ejercicios"}</div>
      <button class="btn" data-act="start-routine" data-id="${esc(r.id)}">Empezar rutina</button></div>`).join("");
  return `<h1>Entrenar</h1>
  <button class="btn block" data-act="start-empty" style="padding:14px">+ Empezar entreno vacío</button>
  ${(()=>{ const n = unreviewed().length; return n ? `<div class="card"><h3>${n} ejercicio${n>1?"s":""} importado${n>1?"s":""} por revisar</h3><p class="note">Ponles nombre en español, su grupo muscular y tu vídeo.</p><button class="btn soft" data-act="open-review">Revisar ejercicios</button></div>` : ""; })()}
  <button class="btn ghost block" data-act="open-lib">Mis ejercicios y vídeos</button>
  <div class="top"><h2>Rutinas</h2><button class="link" data-act="new-routine">+ Nueva rutina</button></div>
  ${routines || `<div class="empty">Crea rutinas para empezar tus entrenos habituales con un toque.</div>`}`;
}
function viewActive(){
  const a = S.active;
  const vol = a.exercises.reduce((v,e)=>v+e.sets.filter(s=>s.done).reduce((x,s)=>x+(+s.kg||0)*(+s.reps||0),0),0);
  const nd = a.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0);
  const cards = a.exercises.map((e,ei)=>{
    const prev = prevFor(e.name) || []; let num = 0;
    const rows = e.sets.map((s,si)=>{ const lab = s.t==="w"?"W":s.t==="f"?"F":s.t==="d"?"D":String(++num); const p = prev[si];
      return `<div class="set ${s.done?"done":""}" data-ei="${ei}" data-si="${si}">
        <button class="st st-${s.t}" data-act="settype" aria-label="Tipo de serie: ${lab}">${lab}</button>
        <button class="prev" data-act="useprev" ${p?"":"disabled"}>${p?`${r1(p.kg)} kg × ${p.reps}`:"—"}</button>
        <input id="kg-${ei}-${si}" inputmode="decimal" data-f="kg" value="${esc(s.kg)}" placeholder="${p?r1(p.kg):""}" aria-label="Kilos">
        <input id="rp-${ei}-${si}" inputmode="numeric" data-f="reps" value="${esc(s.reps)}" placeholder="${p?p.reps:""}" aria-label="Repeticiones">
        <button class="chk" data-act="check" aria-label="Marcar serie hecha">✓</button>
        <button class="x" data-act="delset" aria-label="Quitar serie">×</button></div>${restLine(e, ei, s, si)}`; }).join("");
    return `<div class="ex-card" data-ei="${ei}"><div class="ex-head"><button class="exname" data-act="ex-info" data-name="${esc(e.name)}"><span class="play ${S.media[e.name]?"has":""}" aria-hidden="true">▶</span><h3>${esc(e.name)}</h3></button><div class="tools">
      ${ei>0?`<button class="iconb" data-act="ex-up" aria-label="Subir ejercicio">↑</button>`:""}<button class="iconb" data-act="ex-remove" aria-label="Quitar ejercicio">🗑</button></div></div>
      <button class="restchip" data-act="ex-rest" data-ei="${ei}" data-si="-1">⏱ Descanso: ${fmtRest(e.rest ?? restFor(e.name))}</button>
      <div class="set-h"><span>Serie</span><span>Anterior</span><span>Kg</span><span>Reps</span><span>✓</span><span></span></div>${rows}
      <button class="addset" data-act="addset">+ Añadir serie</button></div>`; }).join("");
  return `<div class="live-head">
    <div class="top"><input class="title-in" id="wTitle" value="${esc(a.title)}" aria-label="Nombre del entreno"><button class="btn" data-act="finish">Terminar</button></div>
    <div class="wstats"><div><span>Duración</span><b data-elapsed>0:00</b></div><div><span>Volumen</span><b id="liveVol">${fmt(vol)} kg</b></div><div><span>Series</span><b id="liveSets">${nd}</b></div></div>
  </div>
  <div id="liveMsg" class="msg" hidden></div>
  ${cards || `<div class="empty">Añade tu primer ejercicio para empezar a apuntar series.</div>`}
  <button class="btn block" data-act="add-ex">+ Añadir ejercicio</button>
  <div id="discardBox"><button class="btn danger block" data-act="discard">Descartar entreno</button></div>
  <p class="note">Toca el número de serie para marcarla como calentamiento (W), al fallo (F) o drop set (D). Toca «Anterior» para copiar lo que hiciste la última vez.</p>`;
}
let saveT = null;
function saveActive(){ clearTimeout(saveT); saveT = setTimeout(() => { if (S.active) put("active", S.active); }, 700); }
function updateLiveStats(){ const a = S.active; if (!a) return;
  const vol = a.exercises.reduce((v,e)=>v+e.sets.filter(s=>s.done).reduce((x,s)=>x+(+s.kg||0)*(+s.reps||0),0),0);
  const nd = a.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0);
  if ($("liveVol")) $("liveVol").textContent = fmt(vol)+" kg"; if ($("liveSets")) $("liveSets").textContent = nd; }
function startWorkout(title, exercises){
  if (S.active){ tab = "train"; render(); return; }
  exercises.forEach(e => { if (e.rest==null) e.rest = restFor(e.name); });
  S.active = {id:rid(), title, start:Date.now(), exercises};
  activeLoaded = true; put("active", S.active); tab = "train"; render(); scrollTo(0,0);
}
const blankSets = (n, types) => Array.from({length:n}, (_,i)=>({t:types?.[i]||"n", kg:"", reps:"", done:false}));
async function finishWorkout(){
  const a = S.active;
  const exs = a.exercises.map(e=>({name:e.name, sets:e.sets.filter(s=>s.done).map(s=>({t:s.t, kg:+String(s.kg).replace(",",".")||0, reps:+s.reps||0}))})).filter(e=>e.sets.length);
  if (!exs.length){ const m = $("liveMsg"); m.textContent = "Marca al menos una serie como hecha (✓) antes de terminar."; m.hidden = false; scrollTo(0,0); return; }
  const prList = [];
  for (const e of exs){ const b = bestsBefore(e.name, a.start); if (!b.has) continue;
    const kg = Math.max(...e.sets.map(s=>s.kg)), rm = Math.max(...e.sets.map(s=>e1rm(s.kg,s.reps)));
    if (kg>b.kg) prList.push(`${e.name}: ${r1(kg)} kg de peso máximo`); else if (rm>b.rm+0.01) prList.push(`${e.name}: ${r0(rm)} kg de 1RM estimado`); }
  const w = {id:String(a.start), title:a.title.trim()||"Entreno", start:a.start, end:Date.now(), exercises:exs, prs:prList.length, prList};
  clearTimeout(saveT); stopRest();
  S.active = null; await put("w-"+w.id, w); await del("active");
  tab = "home"; render();
  confetti();
  openSheet("Entreno guardado", `<div class="done-hero"><span class="note">${esc(w.title)}</span><span class="big">${fmt(volume(w))} kg</span><span class="note">${fmtDur(w.end-w.start)} · ${doneSets(w)} series · ${exs.length} ejercicios</span></div>
    ${prList.length?`<div class="card"><h2>🏆 Nuevos récords</h2>${prList.map(p=>`<div>${esc(p)}</div>`).join("")}</div>`:""}
    <button class="btn soft" data-act="routine-from" data-id="${esc(w.id)}">Guardar como rutina</button><button class="btn" data-act="close">Listo</button>`);
}

/* descanso */
const REST_OPTS = [0,30,45,60,75,90,120,150,180,240,300];
const fmtRest = sec => sec>0 ? clock(sec*1000) : "Sin descanso";
const restFor = name => S.settings.restByEx?.[name] ?? S.settings.rest ?? 90;
const restOf = (e, s) => s.rest ?? e.rest ?? restFor(e.name);
function restLine(e, ei, s, si){
  const sec = restOf(e, s), live = rest && rest.ei===ei && rest.si===si;
  if (live) return `<button class="restline live" data-act="set-rest" data-ei="${ei}" data-si="${si}" aria-label="Cambiar descanso de esta serie">⏱ <span data-restlive>${clock(rest.end-Date.now())}</span></button>`;
  return `<button class="restline ${s.done?"ok":""} ${sec>0?"":"off"}" data-act="set-rest" data-ei="${ei}" data-si="${si}" aria-label="Cambiar descanso de esta serie">${s.done?"✓ ":"⏱ "}${sec>0?clock(sec*1000):"sin descanso"}${s.rest!=null?" ·":""}</button>`;
}
function nextSetText(){ const a = S.active; if (!a || !rest) return "";
  for (let ei=rest.ei; ei<a.exercises.length; ei++){ const e = a.exercises[ei]; const from = ei===rest.ei ? rest.si+1 : 0;
    for (let si=from; si<e.sets.length; si++){ const s = e.sets[si]; if (s.done) continue; const p = (prevFor(e.name)||[])[si];
      const kg = s.kg!=="" ? s.kg : p ? r1(p.kg) : "", reps = s.reps!=="" ? s.reps : p ? p.reps : "";
      return `Siguiente: ${e.name}${kg!==""||reps!==""?` · ${kg||0} kg × ${reps||"?"}`:""}`; } }
  return "Último ejercicio: puedes terminar el entreno"; }
function startRest(sec, ei, si){ rest = {end:Date.now()+sec*1000, total:sec*1000, ei, si}; $("restNext").textContent = nextSetText(); tick(); }
function stopRest(){ const live = document.querySelector("[data-restlive]"); if (live){ const b = live.parentElement; b.classList.remove("live"); b.classList.add("ok"); b.textContent = "✓ descanso hecho"; }
  rest = null; $("restbar").hidden = true; }
function openRestPicker(ei, si){
  const e = S.active.exercises[ei], forSet = si>=0, cur = forSet ? restOf(e, e.sets[si]) : (e.rest ?? restFor(e.name));
  openSheet(forSet ? "Descanso tras esta serie" : "Descanso de " + e.name, `<p class="note">${forSet ? "Solo para esta serie. Útil si haces un calentamiento corto o una serie más pesada." : "Se usa en todas las series de este ejercicio y la app lo recuerda para la próxima vez."}</p>
    <div class="restgrid">${REST_OPTS.map(v=>`<button data-act="rest-pick" data-v="${v}" aria-pressed="${v===cur}">${v?clock(v*1000):"Sin descanso"}</button>`).join("")}</div>
    ${forSet?`<button class="btn soft" data-act="rest-all">Usar ${fmtRest(cur)} en todas las series de este ejercicio</button>`:""}`, {kind:"restpick", ei, si});
}
function beep(){ try { audio ||= new (window.AudioContext||window.webkitAudioContext)(); const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.value = 880; g.gain.setValueAtTime(.2, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime+.6);
  o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime+.6); } catch {} }
function tick(){
  if (S.active) document.querySelectorAll("[data-elapsed]").forEach(el => el.textContent = clock(Date.now()-S.active.start));
  if (rest){ const left = rest.end-Date.now();
    if (left<=0){ stopRest(); beep(); try { navigator.vibrate?.([200,100,200]); } catch {} }
    else { $("restbar").hidden = false; $("restT").textContent = clock(left); $("restProg").style.width = (100*left/rest.total)+"%";
      document.querySelectorAll("[data-restlive]").forEach(el => el.textContent = clock(left)); } }
}
setInterval(tick, 1000);

/* ---------- Diario ---------- */
function viewFood(){
  const tot = dayTotals(day), g = goalsFor(day), exK = 0, remaining = g.kcal - tot.kcal + exK;
  const mac = (lab,v,goal,color) => `<div class="macro"><span>${lab}</span><b>${r0(v)} <span class="note">/ ${goal} g</span></b><div class="bar"><i style="width:${Math.min(100,goal?v/goal*100:0)}%;background:${color}"></i></div></div>`;
  const meals = MEALS.map(m=>{
    const list = (S.diary[day]||[]).filter(e=>e.meal===m), k = list.reduce((a,e)=>a+(+e.kcal||0),0);
    const y = (S.diary[addDays(day,-1)]||[]).some(e=>e.meal===m);
    return `<div class="card meal"><div class="meal-h"><h3>${m}</h3><b>${fmt(k)}</b></div>
      ${list.map(e=>`${e.plan?`<div class="entry-wrap"><button class="pl-chk on" data-act="plan-undo" data-id="${esc(e.id)}" aria-label="Desmarcar ${esc(e.name)}" title="Desmarcar">✓</button>`:""}<button class="entry" data-act="edit-entry" data-id="${esc(e.id)}"><span class="n">${esc(e.name)}${e.ex?'<span class="ex-tag">ejemplo</span>':""}<small>${entryDetail(e)}</small></span><span class="k">${fmt(e.kcal)}</span></button>${e.plan?"</div>":""}`).join("")}
      ${planRows(m)}
      <div class="meal-f"><button class="link" data-act="add-food" data-meal="${m}">+ AÑADIR ALIMENTO</button>${!list.length&&y?`<button class="link" data-act="copy-yesterday" data-meal="${m}" style="color:var(--muted)">Copiar de ayer</button>`:""}</div></div>`; }).join("");
  return `<div class="daynav"><button class="iconb" data-act="day-prev" aria-label="Día anterior">‹</button>
    <div style="text-align:center"><div class="lbl">${dayLabel(day)}</div>${day!==today()?`<button class="link" data-act="day-today" style="padding:0;font-size:13px">Volver a hoy</button>`:""}</div>
    <button class="iconb" data-act="day-next" aria-label="Día siguiente">›</button></div>
  <div class="card"><h2>Calorías restantes</h2>${g.fromPlan?`<p class="note goal-src">Objetivo del día según tu plan: ${esc(g.label)}</p>`:""}
    ${(() => { const R = 54, C = 2*Math.PI*R, pct = Math.min(1, g.kcal ? tot.kcal/g.kcal : 0), over = tot.kcal > g.kcal;
      return `<div class="ring-wrap"><svg class="ring" viewBox="0 0 132 132" role="img" aria-label="${fmt(tot.kcal)} de ${fmt(g.kcal)} kcal">
        <circle cx="66" cy="66" r="${R}" class="ring-bg"/><circle cx="66" cy="66" r="${R}" class="ring-fg ${over?"over":""}" stroke-dasharray="${C}" style="stroke-dashoffset:${C}" data-ring="${C*(1-pct)}"/></svg>
        <div class="ring-c"><b class="${remaining<0?"neg":""}">${fmt(Math.abs(remaining))}</b><span>${remaining<0?"de más":"restantes"}</span></div></div>`; })()}
    <div class="equation"><div><div class="big">${fmt(g.kcal)}</div><span>Objetivo</span></div><div class="op">−</div><div><div class="big">${fmt(tot.kcal)}</div><span>Alimentos</span></div></div>
    <div class="macros">${mac("Carbohidratos",tot.c,g.c,"var(--carb)")}${mac("Grasas",tot.f,g.f,"var(--fat)")}${mac("Proteínas",tot.p,g.p,"var(--prot)")}</div>
    ${planBar()}</div>
  ${planEmpty()}
  ${meals}`;
}
/* ---------- Nutrientes (al estilo MyFitnessPal) ---------- */
let nutriSub = "nut", nutriRange = "dia";
const NUTRI = [ // clave, nombre, unidad, objetivo(g, kcal), tipo: goal = llegar · limit = no pasarse · none = sin objetivo, sangría
  ["p","Proteínas","g",g=>g.p,"goal",0], ["c","Carbohidratos","g",g=>g.c,"goal",0], ["fib","Fibra","g",g=>Math.round(Math.max(25,14*g.kcal/1000)),"goal",1],
  ["azu","Azúcar","g",g=>Math.round(90*g.kcal/2000),"limit",1], ["f","Grasas","g",g=>g.f,"goal",0], ["sat","Saturadas","g",g=>Math.round(g.kcal*.1/9),"limit",1],
  ["poli","Poliinsaturadas","g",null,"none",1], ["mono","Monoinsaturadas","g",null,"none",1], ["col","Colesterol","mg",()=>300,"limit",0],
  ["na","Sodio","mg",()=>2000,"limit",0], ["k","Potasio","mg",()=>3500,"goal",0], ["ca","Calcio","mg",()=>800,"goal",0], ["fe","Hierro","mg",()=>14,"goal",0],
  ["mg","Magnesio","mg",()=>375,"goal",0], ["va","Vitamina A","µg",()=>800,"goal",0], ["vc","Vitamina C","mg",()=>80,"goal",0], ["vd","Vitamina D","µg",()=>5,"goal",0],
  ["b12","Vitamina B12","µg",()=>2.5,"goal",0], ["fol","Ácido fólico","µg",()=>200,"goal",0] ];
const nutriDays = () => nutriRange === "sem" ? Array.from({length:7}, (_,i) => addDays(day, i-6)) : [day];
function entryMicros(e){
  const base = microFor(e.name), m = e.per?.m ? {...(base||{}), ...e.per.m} : base; if (!m) return null;
  const g = +e.g || (e.per?.kcal ? (+e.kcal||0) / e.per.kcal * 100 : 0), k = g/100;
  const o = {}; for (const key of MICRO_KEYS) o[key] = (+m[key]||0) * k; o.na = o.sal * 400; return o;
}
function nutriData(){
  const ds = nutriDays(), logged = ds.filter(d => (S.diary[d]||[]).length), n = Math.max(1, logged.length);
  const tot = {kcal:0,p:0,c:0,f:0}, items = [], meals = Object.fromEntries(MEALS.map(m=>[m,0])); let kcalNoData = 0, noData = 0;
  for (const d of ds) for (const e of (S.diary[d]||[])){
    for (const k of ["kcal","p","c","f"]) tot[k] += +e[k]||0;
    meals[e.meal] = (meals[e.meal]||0) + (+e.kcal||0);
    const m = entryMicros(e); if (m) items.push({e, m}); else { noData++; kcalNoData += +e.kcal||0; }
  }
  const val = {}; for (const r of NUTRI) val[r[0]] = (["p","c","f"].includes(r[0]) ? tot[r[0]] : items.reduce((a,x)=>a+(x.m[r[0]]||0),0)) / n;
  for (const k in tot) tot[k] /= n; for (const k in meals) meals[k] /= n;
  return {tot, val, items, meals, noData, kcalNoData:kcalNoData/n, n, logged:logged.length, g:goalsFor(day)};
}
const nfmt = (v, u) => u === "g" ? (v < 10 ? String(r1(v)).replace(".",",") : fmt(v)) : (v < 10 ? String(r1(v)).replace(".",",") : fmt(v));
function viewNutri(){
  const D = nutriData(), g = D.g, sem = nutriRange === "sem";
  const head = `<div class="daynav"><button class="iconb" data-act="day-prev" aria-label="Día anterior">‹</button>
    <div style="text-align:center"><div class="lbl">${sem ? `Semana hasta ${dayLabel(day).toLowerCase()}` : dayLabel(day)}</div>${day!==today()?`<button class="link" data-act="day-today" style="padding:0;font-size:13px">Volver a hoy</button>`:""}</div>
    <button class="iconb" data-act="day-next" aria-label="Día siguiente">›</button></div>
    <div class="seg nu-seg" role="tablist">${[["cal","Calorías"],["nut","Nutrientes"],["mac","Macros"]].map(([k,l])=>`<button role="tab" data-act="nutri-sub" data-k="${k}" ${nutriSub===k?'aria-selected="true" class="on"':""}>${l}</button>`).join("")}</div>
    <div class="nu-range">${[["dia","Día"],["sem","Semana"]].map(([k,l])=>`<button data-act="nutri-range" data-k="${k}" class="${nutriRange===k?"on":""}">${l}</button>`).join("")}${sem?`<span class="note">Media de ${D.logged || 0} día${D.logged===1?"":"s"} con registros</span>`:""}</div>`;
  if (!D.items.length && !D.noData) return head + `<div class="card nu-empty"><h3>Aún no hay nada apuntado</h3><p class="note">Cuando añadas comidas en el Diario, aquí verás tus proteínas, hidratos, grasas, fibra, azúcar, vitaminas y minerales.</p><button class="btn" data-act="tab" data-tab="food">Ir al Diario</button></div>`;
  let body = "";
  if (nutriSub === "cal"){
    const totK = D.tot.kcal || 1, cols = ["var(--accent)","var(--carb)","var(--prot)","var(--fat)"];
    body = `<div class="card"><div class="nu-big"><div><b>${fmt(D.tot.kcal)}</b><span>Total</span></div><div><b>${fmt(g.kcal)}</b><span>Objetivo</span></div><div><b class="${D.tot.kcal>g.kcal?"neg":""}">${fmt(g.kcal - D.tot.kcal)}</b><span>Restan</span></div></div>
      <div class="bar nu-main"><i style="width:${Math.min(100, D.tot.kcal/g.kcal*100)}%"></i></div></div>
      <div class="card"><h3>Por comida</h3>${MEALS.map((m,i)=>`<div class="nu-row"><div class="nu-l"><span>${m}</span><span class="note">${fmt(D.meals[m])} kcal · ${r0(D.meals[m]/totK*100)} %</span></div><div class="bar"><i style="width:${D.meals[m]/totK*100}%;background:${cols[i]}"></i></div></div>`).join("")}</div>`;
  } else if (nutriSub === "mac"){
    const kp = D.tot.p*4, kc = D.tot.c*4, kf = D.tot.f*9, sum = kp+kc+kf || 1, gs = g.p*4 + g.c*4 + g.f*9 || 1;
    const pc = [kc/sum*100, kf/sum*100, kp/sum*100], gp = [g.c*4/gs*100, g.f*9/gs*100, g.p*4/gs*100];
    const pie = `conic-gradient(var(--carb) 0 ${pc[0]}%, var(--fat) ${pc[0]}% ${pc[0]+pc[1]}%, var(--prot) ${pc[0]+pc[1]}% 100%)`;
    body = `<div class="card nu-mac"><div class="nu-pie" style="background:${sum>1?pie:"var(--line)"}"><span>${fmt(D.tot.kcal)}<small>kcal</small></span></div>
      <div class="nu-tbl"><div class="nu-th"><span></span><span>Total</span><span>Objetivo</span></div>
      ${[["Carbohidratos","var(--carb)",D.tot.c],["Grasas","var(--fat)",D.tot.f],["Proteínas","var(--prot)",D.tot.p]].map(([l,c,gr],i)=>`<div class="nu-tr"><span><i class="dot" style="background:${c}"></i>${l}<small class="note">${r0(gr)} g</small></span><b>${r0(pc[i])} %</b><span>${r0(gp[i])} %</span></div>`).join("")}</div></div>
      <p class="note nu-foot">Porcentaje de las calorías que vienen de cada macro (4 kcal por gramo de proteína o hidrato, 9 por gramo de grasa).</p>`;
  } else {
    body = `<div class="card nu-list"><div class="nu-th"><span></span><span>Total</span><span>Objetivo</span><span>Restan</span></div>
      ${NUTRI.map(([k,l,u,gf,type,ind]) => { const v = D.val[k], goal = gf ? gf(g) : null, left = goal!=null ? goal - v : null;
        const pct = goal ? Math.min(100, v/goal*100) : 0, bad = type==="limit" && left < 0, ok = type==="goal" && left <= 0;
        const col = bad ? "var(--danger)" : ok ? "var(--ok)" : ["p"].includes(k)?"var(--prot)":["c","fib","azu"].includes(k)?"var(--carb)":["f","sat","poli","mono"].includes(k)?"var(--fat)":"var(--accent)";
        return `<button class="nu-item ${ind?"ind":""}" data-act="nutri-detail" data-k="${k}"><div class="nu-tr"><span class="nu-n">${l}</span><b>${nfmt(v,u)}</b><span>${goal!=null?nfmt(goal,u):"-"}</span><span class="${bad?"neg":ok?"pos":""}">${left==null?"-":ok?"✓":nfmt(left,u)}</span><span class="nu-u">${u} ›</span></div>
          ${goal!=null?`<div class="bar"><i style="width:${pct}%;background:${col}"></i></div>`:""}</button>`; }).join("")}</div>
      ${D.noData?`<p class="note nu-foot">${D.noData} alimento${D.noData>1?"s":""} sin datos de vitaminas y minerales (${fmt(D.kcalNoData)} kcal): cuentan en calorías y macros pero no en el resto.</p>`:""}
      <p class="note nu-foot">Fibra, azúcar, vitaminas y minerales son estimaciones a partir de tablas de composición de alimentos (o de la etiqueta, si lo escaneaste). Objetivos orientativos según las recomendaciones de la UE y la OMS para adultos; el azúcar, las saturadas, el colesterol y el sodio son límites que conviene no pasar.</p>`;
  }
  return head + body;
}
function openNutriDetail(k){
  const r = NUTRI.find(x => x[0]===k); if (!r) return; const [, l, u] = r, D = nutriData();
  const get = x => ["p","c","f"].includes(k) ? (+x.e[k]||0) : (x.m[k]||0);
  const src = ["p","c","f"].includes(k) ? nutriDays().flatMap(d => (S.diary[d]||[]).map(e => ({e}))) : D.items;
  const agg = {}; for (const x of src){ const v = get(x); if (v > 0) agg[x.e.name] = (agg[x.e.name]||0) + v; }
  const list = Object.entries(agg).sort((a,b)=>b[1]-a[1]), tot = list.reduce((a,x)=>a+x[1],0) || 1;
  openSheet(l, list.length ? `<p class="note">${nutriRange==="sem"?"Últimos 7 días":dayLabel(day)}: de dónde sale tu ${l.toLowerCase()}.</p>
    ${list.slice(0,15).map(([n,v])=>`<div class="nu-row"><div class="nu-l"><span>${esc(n)}</span><b>${nfmt(v,u)} ${u}</b></div><div class="bar"><i style="width:${v/tot*100}%"></i></div></div>`).join("")}`
    : `<p class="note">Ningún alimento apuntado aporta ${l.toLowerCase()}.</p>`);
}
/* ---------- plan semanal ---------- */
const WDAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const wdayOf = d => (parseDay(d).getDay()+6)%7 + 1;   // 1 = lunes … 7 = domingo
const planDay = n => S.plan?.[n] || {};
const planHas = n => MEALS.some(m => (planDay(n)[m]||[]).length);
function datedPlan(d){                                            // plan mensual: día N del plan = día N del mes
  const P = S.planDates; if (!P?.days) return null;
  if (P.mode === "month"){ const n = Math.min(parseDay(d).getDate(), P.days.length); return P.days[n-1] ? {...P.days[n-1], _n:n} : null; }
  return P.days[d] || null; }
const curPlan = d => datedPlan(d) || planDay(wdayOf(d));           // lo que toca ese día
const planIdFor = d => datedPlan(d) ? d : String(wdayOf(d));
const hasPlanFor = d => MEALS.some(m => (curPlan(d)[m]||[]).length);
function goalsFor(d){            // objetivo del día: el del plan si lo trae, si no el general
  const T = curPlan(d).target; if (!T) return S.settings;
  return {...S.settings, kcal:T.kcal, p:T.p ?? S.settings.p, fromPlan:true, label:T.label || `${fmt(T.kcal)} kcal · ${T.p} g proteína`};
}
function planLabel(d){ const P = datedPlan(d); if (!P) return `Plan del ${WDAYS[wdayOf(d)-1].toLowerCase()}`;
  return `${esc(S.planDates.title||"Plan")} · día ${P._n}`; }
const planDraft = {};                                 // gramos escritos hoy, antes de añadir
const nutr = (f, g) => { const k = (+g||0)/100; return {kcal:f.per.kcal*k, p:f.per.p*k, c:f.per.c*k, f:f.per.f*k}; };
const savePlan = () => put("plan", {days:S.plan});
function planEmpty(){
  const n = wdayOf(day); if (hasPlanFor(day)) return "";
  const any = Object.keys(S.plan||{}).some(k=>planHas(k));
  return `<div class="card plan-empty"><div><h3>Tu plan de comidas</h3><p class="note">${any ? `No tienes nada planificado para el ${WDAYS[n-1].toLowerCase()}.` : "Importa tu plan (semanal o de un mes): cada día aparecerá ya puesto en su desayuno, comida y cena, y solo tendrás que escribir los gramos."}</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><label class="btn" style="cursor:pointer">Importar mi plan<input type="file" id="impPlan" accept=".json,application/json" hidden></label><button class="btn ghost" data-act="plan-edit" data-d="${n}">${any?"Editar plan":"Crear a mano"}</button></div></div>`;
}
const planOpts = items => [...new Set(items.map(f=>f.opt).filter(Boolean))];
function planOpt(m, items){
  const o = planOpts(items); if (!o.length) return null;
  const logged = (S.diary[day]||[]).find(e => e.meal===m && e.plan && e.opt); if (logged) return logged.opt;
  return planDraft[day+"|"+m+"|opt"] ?? o[0];
}
function planPending(m){            // [alimento, índice] planificados para este día y comida que aún no están apuntados
  const n = planIdFor(day), items = curPlan(day)[m] || [], L = (S.diary[day]||[]).filter(e => e.meal===m && e.plan);
  if (L.some(e => e.plan===n+"-"+m)) return [];   // apuntado con la versión anterior
  const done = new Set(L.map(e => e.plan)), o = planOpt(m, items);
  return items.map((f,i)=>[f,i]).filter(([f,i]) => !done.has(n+"-"+m+"-"+i) && (!f.opt || f.opt===o));
}
const planG = (m,i,f) => parseNum(planDraft[day+"|"+m+"|"+i] ?? f.g);
function planRows(m){
  const pend = planPending(m); if (!pend.length) return "";
  const items = curPlan(day)[m], opts = planOpts(items), o = planOpt(m, items);
  const anyOptLogged = (S.diary[day]||[]).some(e => e.meal===m && e.plan && e.opt);
  const chips = opts.length>1 && !anyOptLogged ? `<div class="chips pl-opts">${opts.map(x=>`<button class="chip" data-act="plan-opt" data-m="${m}" data-o="${esc(x)}" aria-pressed="${x===o}">${esc(x)}</button>`).join("")}</div>` : "";
  const rows = pend.map(([f,i]) => { const key = day+"|"+m+"|"+i, g = planDraft[key] ?? f.g, v = nutr(f, parseNum(g));
    return `<div class="pl-row pend"><button class="pl-chk" data-act="plan-one" data-m="${m}" data-i="${i}" aria-label="Apuntar ${esc(f.name)}">✓</button>
      <span class="n">${esc(f.name)}<small data-plk="${esc(key)}">${fmt(v.kcal)} kcal · P ${r0(v.p)} · C ${r0(v.c)} · G ${r0(v.f)}</small></span>
      <label class="pl-g"><input id="pl-${esc(key)}" data-pl="${esc(key)}" inputmode="decimal" value="${esc(g)}" aria-label="Gramos de ${esc(f.name)}"><span>g</span></label></div>`; }).join("");
  const tot = pend.reduce((a,[f,i]) => a + nutr(f, planG(m,i,f)).kcal, 0);
  const dish = curPlan(day).dishes?.[m];
  return `<div class="pl-box"><div class="pl-tag">Según tu plan · escribe los gramos y marca ✓</div>${dish?`<div class="pl-dish">${esc(dish)}</div>`:""}${chips}${rows}
    ${pend.length>1?`<button class="btn soft pl-all" data-act="plan-add" data-m="${m}"><span data-plt="${m}">Apuntar todo · ${fmt(tot)} kcal</span></button>`:""}</div>`;
}
function planBar(){
  const n = wdayOf(day); if (!hasPlanFor(day)) return "";
  const pend = MEALS.flatMap(m => planPending(m).map(([f,i]) => nutr(f, planG(m,i,f)).kcal));
  const dated = !!datedPlan(day);
  return `<div class="plan-bar"><span>${pend.length ? `${planLabel(day)}: <b data-plday>${fmt(pend.reduce((a,b)=>a+b,0))} kcal</b> por apuntar` : `${planLabel(day)} apuntado ✓`}</span>
    <span>${pend.length?`<button class="link" data-act="plan-add-all">Apuntar todo el día</button> · `:""}${dated?`<button class="link" data-act="plan30-off">Quitar plan mensual</button>`:`<button class="link" data-act="plan-edit" data-d="${n}">Editar plan</button>`}</span></div>
`;
}
function updatePlanRow(key){
  const [d, m, i] = key.split("|"), f = curPlan(d)[m]?.[+i]; if (!f) return;
  const v = nutr(f, parseNum(planDraft[key] ?? f.g)); const el = document.querySelector(`[data-plk="${CSS.escape(key)}"]`);
  if (el) el.textContent = `${fmt(v.kcal)} kcal · P ${r0(v.p)} · C ${r0(v.c)} · G ${r0(v.f)}`;
  const t = document.querySelector(`[data-plt="${CSS.escape(m)}"]`); if (t) t.textContent = `Apuntar todo · ${fmt(planPending(m).reduce((a,[f2,j]) => a + nutr(f2, planG(m,j,f2)).kcal, 0))} kcal`;
  const dt = document.querySelector("[data-plday]"); if (dt) dt.textContent = fmt(MEALS.flatMap(mm => planPending(mm).map(([f2,j]) => nutr(f2, planG(mm,j,f2)).kcal)).reduce((a,b)=>a+b,0)) + " kcal";
}
function logPlan(m, list){
  const n = planIdFor(day);
  const entries = list.map(([f,i]) => ({f, i, g: planG(m,i,f)})).filter(x => x.g > 0).map(({f,i,g}) => { const v = nutr(f, g);
    return {id:rid(), meal:m, name:f.name, qty:g, unit:"g", g, per:f.per, servings:f.servings||[], kcal:v.kcal, p:v.p, c:v.c, f:v.f, plan:n+"-"+m+"-"+i, ...(f.opt?{opt:f.opt}:{}), src:"de tu plan"}; });
  if (entries.length) (S.diary[day] ||= []).push(...entries);
}
/* editor del plan */
function openPlanEditor(n){
  const P = planDay(n);
  openSheet("Plan semanal", `<div class="chips">${WDAYS.map((w,i)=>`<button class="chip" data-act="plan-day" data-d="${i+1}" aria-pressed="${i+1===n}">${w.slice(0,3)}${planHas(i+1)?" ·":""}</button>`).join("")}</div>
    <p class="note">Pon lo que sueles comer el ${WDAYS[n-1].toLowerCase()} y los gramos habituales. En el Diario podrás cambiar los gramos de cada día.</p>
    ${MEALS.map(m=>`<div class="card meal"><div class="meal-h"><h3>${m}</h3><b>${fmt((P[m]||[]).reduce((a,f)=>a+nutr(f,f.g).kcal,0))} kcal</b></div>
      ${(P[m]||[]).map((f,i)=>`<div class="pl-row" style="padding:8px 14px"><span class="n">${esc(f.name)}<small>${f.opt?esc(f.opt)+" · ":""}${fmt(f.per.kcal)} kcal / 100 g</small></span>
        <label class="pl-g"><input id="pe-${n}-${m}-${i}" data-pe="${n}|${m}|${i}" inputmode="decimal" value="${esc(f.g)}" aria-label="Gramos habituales"><span>g</span></label>
        <button class="x" data-act="plan-del" data-m="${m}" data-i="${i}" aria-label="Quitar">×</button></div>`).join("")}
      <div class="meal-f"><button class="link" data-act="plan-pick" data-m="${m}">+ AÑADIR ALIMENTO</button></div></div>`).join("")}
    <label class="btn ghost" style="cursor:pointer;text-align:center">Importar mi plan (.json)<input type="file" id="impPlan" accept=".json,application/json" hidden></label>
    <div id="planCopy"><button class="btn ghost" data-act="plan-copy">Copiar el ${WDAYS[n-1].toLowerCase()} a otros días</button></div>
    <button class="btn" data-act="close">Listo</button>`, {kind:"plan", n});
}
function openPlanPicker(n, m){
  openSheet(`Añadir a ${m} · ${WDAYS[n-1]}`, `<button class="link" data-act="plan-back" style="align-self:flex-start">‹ Volver al plan</button>
    <input id="ppq" placeholder="Busca un alimento" autocomplete="off" aria-label="Buscar alimento"><div id="ppres"></div>
    <p class="note">¿No está? Créalo con los valores de la etiqueta:</p>
    <div class="grid2"><label class="f">Nombre<input id="ppN"></label><label class="f">Kcal / 100 g<input id="ppK" inputmode="decimal"></label>
      <label class="f">Proteínas / 100 g<input id="ppP" inputmode="decimal"></label><label class="f">Carbohidratos / 100 g<input id="ppC" inputmode="decimal"></label>
      <label class="f">Grasas / 100 g<input id="ppF" inputmode="decimal"></label><label class="f">Gramos habituales<input id="ppG" inputmode="decimal" value="100"></label></div>
    <span class="msg" id="ppMsg" hidden></span><button class="btn soft" data-act="plan-create">Crear y añadir</button>`, {kind:"planpick", n, m, q:""});
  drawPlanPicker();
}
function drawPlanPicker(){
  const c = sheetCtx, f = c.q.trim().toLowerCase(), seen = new Set();
  c.list = [...S.foods, ...recentFoods(), ...FOODS].filter(x => { if (seen.has(x.name)) return false; seen.add(x.name); return !f || x.name.toLowerCase().includes(f); }).slice(0,30);
  $("ppres").innerHTML = `<div class="list">${c.list.map((x,i)=>`<button class="li" data-act="plan-pick-food" data-i="${i}"><span class="n">${esc(x.name)}<small>${fmt(x.kcal)} kcal · P ${r1(x.p)} · C ${r1(x.c)} · G ${r1(x.f)} por 100 g</small></span><span>+</span></button>`).join("") || `<div class="li note" style="cursor:default">Sin resultados</div>`}</div>`;
}
function planAddFood(n, m, x, g){
  const P = (S.plan[n] ||= {}); (P[m] ||= []).push({name:x.name, per:{kcal:+x.kcal, p:+x.p, c:+x.c, f:+x.f}, servings:x.servings||[], g:r0(g)});
  savePlan(); openPlanEditor(n);
}
function entryDetail(e){ const parts = []; if (e.qty) parts.push(`${r1(e.qty)} ${e.unit==="g"?"g":e.unit}`); parts.push(`P ${r0(e.p)} · C ${r0(e.c)} · G ${r0(e.f)}`); if (e.src) parts.push(e.src); return esc(parts.join(" · ")); }

/* ---------- Progreso ---------- */
function lineChart(points, o){
  const W=600,H=220,L=46,R=14,T=14,B=30;
  if (!points.length) return `<p class="note">${o.empty}</p>`;
  const ys = points.map(p=>p.y).concat(o.goal!=null?[o.goal]:[]);
  let lo = Math.min(...ys), hi = Math.max(...ys); if (o.zero) lo = 0; if (hi===lo){ hi+=5; lo=Math.max(0,lo-5); }
  const span = hi-lo, st = Math.pow(10,Math.floor(Math.log10(span/4))), nice = [1,2,2.5,5,10].map(m=>m*st).find(s=>span/s<=5) || st*10;
  lo = Math.floor(lo/nice)*nice; hi = Math.ceil(hi/nice)*nice;
  const x = i => points.length===1 ? (L+W-R)/2 : L + i*(W-L-R)/(points.length-1);
  const y = v => T + (hi-v)/(hi-lo)*(H-T-B);
  let g = "";
  for (let v=lo; v<=hi+1e-9; v+=nice) g += `<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${r1(v).toLocaleString("es-ES")}</text>`;
  const every = Math.ceil(points.length/6);
  points.forEach((p,i)=>{ if (i%every===0 || i===points.length-1) g += `<text x="${x(i)}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--muted)">${p.x}</text>`; });
  if (o.bars){ const bw = Math.max(6,(W-L-R)/points.length*0.6);
    points.forEach((p,i)=>{ if (p.y>0) g += `<rect x="${x(i)-bw/2}" y="${y(p.y)}" width="${bw}" height="${Math.max(0,y(lo)-y(p.y))}" rx="3" fill="${o.goal&&p.y>o.goal?(o.okOver?"var(--ok)":"var(--danger)"):o.color}"/>`; });
    if (o.goal) g += `<line x1="${L}" x2="${W-R}" y1="${y(o.goal)}" y2="${y(o.goal)}" stroke="var(--ink)" stroke-dasharray="5 4" stroke-width="1.5"/>`;
  } else { const d = points.map((p,i)=>(i?"L":"M")+x(i)+" "+y(p.y)).join(" ");
    g += `<path d="${d} L${x(points.length-1)} ${y(lo)} L${x(0)} ${y(lo)} Z" fill="${o.color}" opacity=".12"/><path d="${d}" fill="none" stroke="${o.color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    points.forEach((p,i)=> g += `<circle cx="${x(i)}" cy="${y(p.y)}" r="${i===points.length-1?5:3}" fill="${o.color}"/>`); }
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)}">${g}</svg></div>`;
}
function viewProgress(){
  const {used} = allExerciseNames(); if (!used.includes(progEx)) progEx = used[0] || "";
  const sessions = [...S.workouts].reverse().map(w=>({w, e:w.exercises.find(e=>e.name===progEx)})).filter(x=>x.e);
  const val = s => metric==="kg" ? Math.max(...s.e.sets.map(z=>+z.kg||0)) : metric==="rm" ? Math.max(...s.e.sets.map(z=>e1rm(+z.kg||0,+z.reps||0))) : s.e.sets.reduce((a,z)=>a+(+z.kg||0)*(+z.reps||0),0);
  const pts = sessions.slice(-20).map(s=>({x:shortDay(iso(new Date(s.w.start))), y:r1(val(s))}));
  let rec = "";
  if (sessions.length){ const all = sessions.flatMap(s=>s.e.sets);
    const bestKg = Math.max(...all.map(s=>+s.kg||0)), bestRm = Math.max(...all.map(s=>e1rm(+s.kg||0,+s.reps||0))), bestVol = Math.max(...sessions.map(s=>s.e.sets.reduce((a,z)=>a+(+z.kg||0)*(+z.reps||0),0))), bestReps = Math.max(...all.map(s=>+s.reps||0));
    rec = `<div class="records"><div><span>Peso máximo</span><b>${r1(bestKg)} kg</b></div><div><span>1RM estimado</span><b>${r0(bestRm)} kg</b></div><div><span>Mejor volumen</span><b>${fmt(bestVol)} kg</b></div><div><span>Más reps</span><b>${bestReps}</b></div></div>`; }
  // músculos esta semana
  const ws = weekStart(today()), cnt = {};
  for (const w of S.workouts){ const d = iso(new Date(w.start)); if (d<ws) continue; for (const e of w.exercises){ const m = muscleOf(e.name); cnt[m] = (cnt[m]||0)+e.sets.filter(s=>s.t!=="w").length; } }
  const maxM = Math.max(1,...Object.values(cnt));
  const mus = MUSCLES.filter(m=>cnt[m]).map(m=>`<div class="mrow"><span>${m}</span><div class="bar"><i style="width:${cnt[m]/maxM*100}%;background:var(--accent)"></i></div><b>${cnt[m]}</b></div>`).join("");
  // peso corporal
  const bw = Object.entries(S.body).sort(([a],[b])=>a<b?-1:1);
  const bwPts = bw.slice(-30).map(([d,v])=>({x:shortDay(d), y:+v.kg}));
  const bwDiff = bw.length>1 ? r1(bw[bw.length-1][1].kg - bw[0][1].kg) : null;
  const kp = []; for (let i=13;i>=0;i--){ const d = addDays(today(),-i); kp.push({x:shortDay(d), y:r0(dayTotals(d).kcal)}); }
  const seg = (m,l) => `<button data-act="metric" data-m="${m}" aria-pressed="${metric===m}">${l}</button>`;
  return `<h1>Progreso</h1>
  ${TRAIN_ON ? `  <div class="card"><h2>Ejercicio</h2>
    ${used.length?`<select id="progEx" aria-label="Ejercicio">${used.map(n=>`<option ${n===progEx?"selected":""}>${esc(n)}</option>`).join("")}</select>
    <button class="btn soft" data-act="ex-info" data-name="${esc(progEx)}">▶ Ver vídeo y técnica</button><div class="seg">${seg("kg","Peso máx.")}${seg("rm","1RM est.")}${seg("vol","Volumen")}</div>
    ${lineChart(pts,{color:"var(--accent)",label:"Progreso de "+progEx,empty:""})}${rec}`:`<p class="note">Cuando guardes entrenos verás aquí tu progreso por ejercicio.</p>`}</div>
  <div class="card"><h2>Series por músculo · esta semana</h2>${mus || `<p class="note">Sin series esta semana todavía.</p>`}</div>
` : ""}
  <div class="card"><div class="top"><h2>Peso corporal</h2>${bwDiff!=null?`<span class="note tnum">${bwDiff>0?"+":""}${bwDiff.toLocaleString("es-ES")} kg desde ${shortDay(bw[0][0])}</span>`:""}</div>
    <form id="fWeight" style="display:flex;gap:8px"><input id="bwIn" inputmode="decimal" placeholder="Peso de hoy (kg)" value="${S.body[today()]?.kg??""}" aria-label="Peso de hoy en kg"><button class="btn" type="submit">Guardar</button></form>
    ${lineChart(bwPts,{color:"var(--ok)",label:"Peso corporal",empty:"Apunta tu peso para ver la tendencia."})}</div>
  <div class="card"><div class="top"><h2>Calorías · 14 días</h2><span class="note">línea = objetivo</span></div>${lineChart(kp,{bars:true,zero:true,goal:S.settings.kcal,color:"var(--prot)",label:"Calorías de los últimos 14 días"})}</div>`;
}

/* ---------- Perfil ---------- */
function viewProfile(){
  const g = S.settings, mk = r0(g.p*4+g.c*4+g.f*9);
  const imp = importState ? `<div class="card imp"><h3>${esc(importState.title)}</h3><p class="note">${esc(importState.summary)}</p>
      ${importState.review?`<button class="btn" data-act="open-review">Revisar ${importState.review} ejercicio${importState.review>1?"s":""} importado${importState.review>1?"s":""}</button>`:""}
      ${importState.items?.length?`<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="imp-confirm" ${importState.busy?"disabled":""}>${importState.busy?"Importando…":"Importar"}</button><button class="btn ghost" data-act="imp-cancel" ${importState.busy?"disabled":""}>Cancelar</button></div>`:`<button class="btn ghost" data-act="imp-cancel">Cerrar</button>`}
      <span class="note" id="impProg">${esc(importState.progress||"")}</span></div>` : "";
  return `<h1>Perfil</h1>
  <div class="card"><h2>Premium</h2>${isPremium() ? `<p><b>⭐ ${esc(premiumStatus())}</b></p><p class="note">Tienes el escáner de códigos de barras en Diario › Añadir alimento › Escanear.</p>` : premiumPitch()}
    ${adminInfo.admin ? `<button class="btn" data-act="admin">Panel de administración</button>` : ""}</div>
  <div class="card"><h2>Cuenta</h2><div class="top"><span style="overflow-wrap:anywhere">${esc(user?.email||"")}</span><button class="btn ghost" data-act="logout">Cerrar sesión</button></div>
    <form id="fPass" class="stack"><label class="f">Cambiar contraseña<input id="newPass" type="password" minlength="6" autocomplete="new-password" placeholder="Nueva contraseña (mín. 6 caracteres)"></label><button class="btn soft" type="submit">Guardar contraseña</button><span class="note" id="passMsg"></span></form></div>
  <form class="card" id="fGoals"><div class="top"><h2>Objetivos diarios</h2><button type="button" class="link" data-act="wizard">Calcular mis objetivos</button></div>
    <div class="grid2"><label class="f">Calorías (kcal)<input id="gKcal" type="number" min="0" step="10" value="${g.kcal}"></label>
      <label class="f">Proteínas (g)<input id="gP" type="number" min="0" step="5" value="${g.p}"></label>
      <label class="f">Carbohidratos (g)<input id="gC" type="number" min="0" step="5" value="${g.c}"></label>
      <label class="f">Grasas (g)<input id="gF" type="number" min="0" step="5" value="${g.f}"></label>
      <label class="f">Entrenos por semana<input id="gDays" type="number" min="1" max="7" value="${g.days}"></label>
      <label class="f">Descanso por defecto (s)<input id="gRest" type="number" min="0" step="15" value="${g.rest}"></label></div>
    <p class="note tnum">Tus macros suman ${fmt(mk)} kcal${Math.abs(mk-g.kcal)>100?` (${mk>g.kcal?"+":""}${fmt(mk-g.kcal)} respecto al objetivo)`:""}.</p>
    <button class="btn" type="submit">Guardar objetivos</button><span class="note" id="goalMsg"></span></form>
  <div class="card"><h2>Importar</h2>
    <label class="f" ${TRAIN_ON?"":"hidden"}>Entrenos · CSV de Hevy o Strong<input type="file" id="impW" accept=".csv,text/csv"></label>
    <label class="f">Comidas · CSV de MyFitnessPal<input type="file" id="impF" accept=".csv,text/csv"></label>
    <label class="f">Copia de seguridad o plan semanal (.json)<input type="file" id="impJ" accept=".json,application/json"></label>
    <p class="note">En Hevy: Perfil › Ajustes › Exportar e importar datos › Exportar entrenos. En MyFitnessPal (web): Ajustes › Exportar datos; usa el archivo «Nutrition Summary». Si vuelves a importar el mismo archivo no se duplica nada.</p></div>
  ${imp}
  <div class="card"><h2>Exportar</h2>
    ${dl?`<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" data-act="export-json">Copia completa (.json)</button><button class="btn ghost" data-act="export-w">Entrenos (.csv)</button><button class="btn ghost" data-act="export-f">Comidas (.csv)</button></div>`:`<p class="note">Las descargas no están disponibles en esta vista.</p>`}</div>
  <div class="card"><h2>Datos de ejemplo</h2><p class="note">Tres semanas inventadas de entrenos, comidas y peso para ver cómo funciona todo. Salen marcadas como «ejemplo» y se borran de golpe.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" data-act="load-ex">Cargar ejemplos</button><button class="btn danger" data-act="clear-ex">Borrar ejemplos</button></div><span class="note" id="exMsg"></span></div>
  <div class="card"><h2>Tus datos y tu cuenta</h2><p class="note">Tus datos solo los ves tú. Puedes descargarlos en «Exportar», borrarlos o eliminar tu cuenta por completo.</p>
    <div id="wipeBox" class="stack"><button class="btn danger block" data-act="wipe">Borrar todos mis datos</button><button class="btn danger block" data-act="delacc">Eliminar mi cuenta</button></div></div>
  <p class="note legal"><a href="/terminos.html" target="_blank" rel="noopener">Términos de uso</a> · <a href="/privacidad.html" target="_blank" rel="noopener">Política de privacidad</a></p>`;
}

/* ================= hoja inferior ================= */
let sheetCtx = null;
function openSheet(title, html, ctx){ sheetCtx = ctx||null; $("sheetTitle").textContent = title; $("sheetBody").innerHTML = html; $("sheet").hidden = false; document.body.style.overflow = "hidden"; }
function closeSheet(){ stopScan(); if (sheetCtx?.kind==="wizard" && !S.settings.onboarded) put("settings", {...S.settings, onboarded:true}); if (sheetCtx?.kind==="watch") clearHash(); if (sheetCtx?.kind==="plan"){ clearTimeout(window._pe); savePlan(); setTimeout(render, 0); } $("sheet").hidden = true; document.body.style.overflow = ""; sheetCtx = null; }

/* --- selector de ejercicios --- */
function openPicker(target){
  const ctx = {kind:"picker", target, sel:[], filter:"", muscle:""};
  openSheet("Añadir ejercicio", `<input id="pkSearch" placeholder="Buscar ejercicio" autocomplete="off" aria-label="Buscar ejercicio">
    <div class="chips" id="pkChips"></div><div id="pkList"></div>
    <button class="btn" id="pkGo" data-act="picker-confirm" disabled>Añadir</button>`, ctx);
  drawPicker();
}
function drawPicker(){
  const c = sheetCtx; const {used, all} = allExerciseNames(); const f = c.filter.trim().toLowerCase();
  $("pkChips").innerHTML = ["", ...MUSCLES.slice(0,-1)].map(m=>`<button class="chip" data-act="pk-muscle" data-m="${m}" aria-pressed="${c.muscle===m}">${m||"Todos"}</button>`).join("");
  const list = all.filter(n=>(!f || n.toLowerCase().includes(f)) && (!c.muscle || muscleOf(n)===c.muscle));
  const exact = all.some(n=>n.toLowerCase()===f);
  $("pkList").innerHTML = `<div class="list">${f && !exact?`<button class="li" data-act="pk-create"><span class="n">Crear «${esc(c.filter.trim())}»<small>Ejercicio nuevo</small></span><span>+</span></button>`:""}
    ${list.slice(0,80).map(n=>`<div class="pkrow"><button class="iconb play-b ${S.media[n]?"has":""}" data-act="ex-info" data-name="${esc(n)}" data-from="picker" aria-label="Ver vídeo de ${esc(n)}">▶</button><button class="li ${c.sel.includes(n)?"sel":""}" data-act="pk-toggle" data-name="${esc(n)}"><span class="n">${esc(n)}<small>${muscleOf(n)}${used.includes(n)?" · usado":""}</small></span><span class="ck">${c.sel.includes(n)?"✓":""}</span></button></div>`).join("") || `<div class="li note">Sin resultados</div>`}</div>`;
  $("pkGo").disabled = !c.sel.length; $("pkGo").textContent = c.sel.length ? `Añadir ${c.sel.length} ejercicio${c.sel.length>1?"s":""}` : "Añadir";
}
function pickerConfirm(){
  const c = sheetCtx; if (!c.sel.length) return;
  if (c.target==="active"){ for (const n of c.sel){ const p = prevFor(n); S.active.exercises.push({name:n, rest:restFor(n), sets:blankSets(p?p.length:3, p?.map(s=>s.t))}); }
    closeSheet(); saveActive(); render(); }
  else if (c.target==="wedit"){ const w = c.wdraft; w.exercises.push(...c.sel.map(n=>({name:n, sets:[{t:"n",kg:0,reps:0}]}))); openWorkoutEditor(w.id, w); }
  else { routineDraft.exercises.push(...c.sel.map(n=>({name:n, sets:3}))); openRoutineEditor(); }
}

/* --- editor de rutinas --- */
let routineDraft = null;
function openRoutineEditor(){
  const r = routineDraft;
  openSheet(r.isNew?"Nueva rutina":"Editar rutina", `<label class="f">Nombre<input id="rdName" value="${esc(r.name)}" placeholder="Empuje" autocomplete="off"></label>
    <div class="list">${r.exercises.map((e,i)=>`<div class="li" style="cursor:default"><span class="n">${esc(e.name)}<small>${e.sets} series</small></span>
      <span style="display:flex;gap:2px"><button class="iconb" data-act="rd-minus" data-i="${i}" aria-label="Menos series">−</button><button class="iconb" data-act="rd-plus" data-i="${i}" aria-label="Más series">+</button><button class="iconb" data-act="rd-remove" data-i="${i}" aria-label="Quitar">×</button></span></div>`).join("") || `<div class="li note" style="cursor:default">Aún sin ejercicios</div>`}</div>
    <button class="btn soft" data-act="rd-add">+ Añadir ejercicio</button>
    <button class="btn" data-act="rd-save">Guardar rutina</button>
    ${r.isNew?"":`<div id="rdDel"><button class="btn danger block" data-act="rd-delete">Borrar rutina</button></div>`}`, {kind:"routine"});
}
const syncDraftName = () => { const n = $("rdName"); if (n && routineDraft) routineDraft.name = n.value; };

/* --- ficha de ejercicio con vídeo --- */
function exHistory(name){ const out = []; for (const w of S.workouts){ const e = w.exercises.find(x=>x.name===name); if (e) out.push({w,e}); if (out.length>=3) break; } return out; }
function openExInfo(name, from){
  const m = S.media[name], hist = exHistory(name);
  const yt = "https://www.youtube.com/results?search_query=" + encodeURIComponent("técnica " + name + " gimnasio");
  const media = m && !m.url ? `<div class="vid-empty">Cargando vídeo…</div>` : m ? (m.type?.startsWith("image/") ? `<img class="vid" src="${esc(m.url)}" alt="Demostración de ${esc(name)}">` : `<video class="vid" src="${esc(m.url)}" controls playsinline loop muted autoplay></video>`)
    : `<div class="vid-empty">Aún no hay vídeo para este ejercicio.${assets?"<br>Sube uno tuyo o un GIF de la técnica.":""}</div>`;
  let all = []; for (const w of S.workouts) for (const e of w.exercises) if (e.name===name) all.push(...e.sets);
  const best = all.length ? Math.max(...all.map(s=>+s.kg||0)) : null, rm = all.length ? Math.max(...all.map(s=>e1rm(+s.kg||0,+s.reps||0))) : null;
  openSheet(name, `${from==="picker"||from==="lib"?`<button class="link" data-act="ex-info-back" style="align-self:flex-start">‹ Volver a ${from==="lib"?"mis ejercicios":"la lista"}</button>`:""}
    ${media}
    <span class="note">${muscleOf(name)}</span>
    <a class="btn ${m?"ghost":""} yt" href="${yt}" target="_blank" rel="noopener">Ver técnica en YouTube ↗</a>
    ${assets?`<label class="btn soft" style="cursor:pointer">${m?"Cambiar vídeo":"Subir vídeo o GIF"}<input type="file" id="exVid" accept="video/*,image/gif,image/webp,image/png,image/jpeg" hidden></label>
      <span class="note" id="vidMsg">${m?"":`Vídeos de hasta ${MAX_VIDEO_MB} MB. Graba tu serie con el móvil o guarda un GIF de la técnica.`}</span>
      ${m?`<div id="vidDel"><button class="btn danger block" data-act="vid-del">Quitar vídeo</button></div>`:""}`:`<p class="note">Entra con tu cuenta para subir vídeos.</p>`}
    <details class="card"><summary style="cursor:pointer;font-weight:600">Editar nombre y grupo muscular</summary>
      <div class="stack" style="margin-top:10px"><label class="f">Nombre<input id="exNewName" value="${esc(name)}"></label>
      <label class="f">Grupo muscular<select id="exMuscle">${MUSCLES.map(m=>`<option ${m===muscleOf(name)?"selected":""}>${m}</option>`).join("")}</select></label>
      ${suggestES(name)&&suggestES(name)!==name?`<button class="link" data-act="ex-sug" data-v="${esc(suggestES(name))}" style="align-self:flex-start">Usar «${esc(suggestES(name))}»</button>`:""}
      <p class="note">El cambio se aplica a todos tus entrenos, rutinas y al vídeo. Si eliges un nombre que ya existe, se junta su historial.</p>
      <button class="btn" data-act="ex-rename">Guardar</button><span class="note" id="renMsg"></span></div></details>
    ${best!=null?`<div class="records"><div><span>Peso máximo</span><b>${r1(best)} kg</b></div><div><span>1RM estimado</span><b>${r0(rm)} kg</b></div></div>`:""}
    ${hist.length?`<h2>Últimas veces</h2>${hist.map(({w,e})=>`<div class="tnum"><b>${dayLabel(iso(new Date(w.start)))}</b> · <span class="note">${e.sets.filter(s=>s.t!=="w").map(s=>`${r1(s.kg)}×${s.reps}`).join(", ")}</span></div>`).join("")}`:""}`,
    {kind:"exinfo", name, from, prev: from==="picker"||from==="lib" ? sheetCtx : null});
}
async function uploadVideo(file){
  const c = sheetCtx, msg = t => { const el = $("vidMsg"); if (el) el.textContent = t; };
  if (file.size > MAX_VIDEO_MB*1024*1024){ msg(`El archivo pesa más de ${MAX_VIDEO_MB} MB. Recórtalo o grábalo en menor calidad.`); return; }
  msg("Subiendo…");
  try { const old = S.media[c.name]; const r = await assets.upload(file);
    await put("media", {map:{...S.media, [c.name]:{id:r.id, url:r.url, type:r.contentType||file.type}}});
    if (old?.id && !Object.entries(S.media).some(([k,v])=>k!==c.name && v.id===old.id)) assets.delete(old.id).catch(()=>{});
    openExInfo(c.name, c.from); if (c.prev) sheetCtx.prev = c.prev; render(); }
  catch(e){ msg(e?.code==="not_granted" ? "No tienes permiso para subir archivos aquí." : e?.code==="invalid_request" ? "Ese formato no se puede subir. Prueba con MP4, MOV o GIF." : "No se pudo subir. Inténtalo otra vez."); }
}

/* --- biblioteca de ejercicios --- */
function openLibrary(prev){
  const ctx = prev || {kind:"lib", q:"", f:"all"};
  openSheet("Mis ejercicios", `<input id="libSearch" placeholder="Buscar ejercicio" autocomplete="off" value="${esc(ctx.q)}" aria-label="Buscar ejercicio"><div class="chips" id="libChips"></div><div id="libList"></div>
    <button class="btn soft" data-act="lib-new">+ Crear ejercicio</button>`, ctx);
  drawLibrary();
}
function drawLibrary(){
  const c = sheetCtx, {used, all} = allExerciseNames(), rev = unreviewed(), q = c.q.trim().toLowerCase();
  const chip = (f,l) => `<button class="chip" data-act="lib-f" data-f="${f}" aria-pressed="${c.f===f}">${l}</button>`;
  $("libChips").innerHTML = chip("all","Todos") + chip("used","Usados") + chip("video","Con vídeo") + (rev.length?chip("rev",`Por revisar (${rev.length})`):"");
  const list = all.filter(n => (!q || n.toLowerCase().includes(q)) && (c.f==="all" || (c.f==="used" && used.includes(n)) || (c.f==="video" && S.media[n]) || (c.f==="rev" && rev.includes(n))));
  $("libList").innerHTML = `${c.f==="rev"&&rev.length?`<button class="btn block" data-act="open-review" style="margin-bottom:10px">Revisar y traducir todos</button>`:""}<div class="list">${list.slice(0,150).map(n=>{ const k = sessionsOf(n);
    return `<button class="li" data-act="ex-info" data-name="${esc(n)}" data-from="lib"><span class="n">${esc(n)}${rev.includes(n)?'<span class="ex-tag">por revisar</span>':""}<small>${muscleOf(n)}${k?` · ${k} sesión${k>1?"es":""}`:""}</small></span><span class="play ${S.media[n]?"has":""}">▶</span></button>`; }).join("") || `<div class="li note" style="cursor:default">Nada por aquí.</div>`}</div>`;
}
async function renameExercise(oldN, newN, muscle, progress){
  newN = newN.trim(); if (!newN) return;
  if (newN !== oldN){
    const ws = S.workouts.filter(w=>w.exercises.some(e=>e.name===oldN)); let i = 0;
    for (const w of ws){ const w2 = JSON.parse(JSON.stringify(w)); w2.exercises.forEach(e=>{ if (e.name===oldN) e.name = newN; }); await put("w-"+w.id, w2); if (progress && ++i%5===0) progress(i, ws.length); }
    if (S.routines.some(r=>r.exercises.some(e=>e.name===oldN))) await put("routines", {list:S.routines.map(r=>({...r, exercises:r.exercises.map(e=>e.name===oldN?{...e,name:newN}:e)}))});
    if (S.active?.exercises.some(e=>e.name===oldN)){ S.active.exercises.forEach(e=>{ if (e.name===oldN) e.name = newN; }); await put("active", S.active); }
    if (S.media[oldN]){ const map = {...S.media}; if (!map[newN]) map[newN] = map[oldN]; delete map[oldN]; await put("media", {map}); }
  }
  const libHit = LIB.find(x=>x[0]===newN);
  const list = S.exlib.filter(x=>x.name!==oldN && x.name!==newN);
  if (!libHit || libHit[1]!==muscle) list.push({name:newN, muscle});
  await put("exlib", {list});
}
function openReview(){
  const names = unreviewed();
  if (!names.length){ openSheet("Revisar ejercicios", `<div class="empty">No queda ningún ejercicio por revisar.</div><button class="btn" data-act="open-lib">Ver mis ejercicios</button>`); return; }
  const targets = [...new Set([...LIB.map(x=>x[0]), ...S.exlib.map(x=>x.name)])].sort((a,b)=>a.localeCompare(b,"es"));
  openSheet("Revisar ejercicios importados", `<p class="note">He propuesto el nombre en español cuando lo he reconocido. Elige «Dejar como está» para mantener el nombre original; puedes cambiarlo luego desde «Mis ejercicios».</p>
    <div class="list">${names.map((n,i)=>{ const sug = suggestES(n);
      return `<div class="li" style="cursor:default;flex-wrap:wrap"><span class="n" style="flex:1 1 160px">${esc(n)}<small>${muscleOf(n)} · ${sessionsOf(n)} sesiones</small></span>
        <select data-rv="${i}" style="flex:1 1 180px" aria-label="Nombre para ${esc(n)}"><option value="">Dejar como está</option>${targets.map(t=>`<option ${t===sug?"selected":""}>${esc(t)}</option>`).join("")}</select></div>`; }).join("")}</div>
    <button class="btn" data-act="rv-apply">Aplicar cambios</button><span class="note" id="rvMsg"></span>`, {kind:"review", names});
}
async function applyReview(){
  const c = sheetCtx, btn = document.querySelector('[data-act="rv-apply"]'), msg = t => { const m = $("rvMsg"); if (m) m.textContent = t; };
  btn.disabled = true; const plan = c.names.map((n,i)=>({n, to:document.querySelector(`[data-rv="${i}"]`).value}));
  let done = 0; const keep = [];
  for (const {n,to} of plan){ if (to){ await renameExercise(n, to, muscleOf(to)); } else keep.push({name:n, muscle:muscleOf(n)}); msg(`${++done} de ${plan.length}…`); }
  if (keep.length) await put("exlib", {list:[...S.exlib.filter(x=>!keep.some(k=>k.name===x.name)), ...keep]});
  render(); openLibrary({kind:"lib", q:"", f:"used"});
}

/* --- editar entreno guardado --- */
function openWorkoutEditor(id, draft){
  const w = draft || JSON.parse(JSON.stringify(S.workouts.find(x=>x.id===id))); if (!w) return;
  const dt = new Date(w.start), loc = `${iso(dt)}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  openSheet("Editar entreno", `<label class="f">Nombre<input id="weTitle" value="${esc(w.title)}"></label>
    <div class="grid2"><label class="f">Inicio<input type="datetime-local" id="weStart" value="${loc}"></label><label class="f">Duración (min)<input id="weDur" inputmode="numeric" value="${r0((w.end-w.start)/60000)}"></label></div>
    ${w.exercises.map((e,ei)=>{ let n = 0; return `<div class="ex-card"><div class="ex-head"><h3>${esc(e.name)}</h3><button class="iconb" data-act="we-delex" data-ei="${ei}" aria-label="Quitar ejercicio">🗑</button></div>
      <div class="set-h" style="grid-template-columns:38px 1fr 1fr 26px"><span>Serie</span><span>Kg</span><span>Reps</span><span></span></div>
      ${e.sets.map((s,si)=>{ const lab = s.t==="w"?"W":s.t==="f"?"F":s.t==="d"?"D":String(++n);
        return `<div class="set" style="grid-template-columns:38px 1fr 1fr 26px"><button class="st st-${s.t}" data-act="we-type" data-ei="${ei}" data-si="${si}">${lab}</button>
          <input id="we-kg-${ei}-${si}" inputmode="decimal" data-we="${ei}:${si}:kg" value="${s.kg}" aria-label="Kilos"><input id="we-rp-${ei}-${si}" inputmode="numeric" data-we="${ei}:${si}:reps" value="${s.reps}" aria-label="Repeticiones">
          <button class="x" data-act="we-delset" data-ei="${ei}" data-si="${si}" aria-label="Quitar serie">×</button></div>`; }).join("")}
      <button class="addset" data-act="we-addset" data-ei="${ei}">+ Añadir serie</button></div>`; }).join("")}
    <button class="btn soft" data-act="we-addex">+ Añadir ejercicio</button>
    <button class="btn" data-act="we-save">Guardar cambios</button><button class="btn ghost" data-act="open-workout" data-id="${esc(w.id)}">Cancelar</button>`, {kind:"wedit", w});
}
function syncWE(){ const w = sheetCtx.w; w.title = $("weTitle").value;
  const st = parseAnyDate($("weStart").value.replace("T"," ")); const dur = parseNum($("weDur").value);
  if (st) w.start = st.getTime(); if (dur>0) w.end = w.start + dur*60000; }

/* --- detalle de entreno --- */
function openWorkout(id){
  const w = S.workouts.find(x=>x.id===id); if (!w) return;
  const t = new Date(w.start);
  openSheet(w.title||"Entreno", `<p class="note">${dayLabel(iso(t))} · ${pad(t.getHours())}:${pad(t.getMinutes())} · ${w.end?fmtDur(w.end-w.start):""} · ${fmt(volume(w))} kg</p>
    ${(w.prList||[]).length?`<div class="card"><h2>🏆 Récords</h2>${w.prList.map(p=>`<div>${esc(p)}</div>`).join("")}</div>`:""}
    ${w.exercises.map(e=>{ let n=0; return `<div class="card" style="gap:6px"><button class="exname" data-act="ex-info" data-name="${esc(e.name)}"><span class="play ${S.media[e.name]?"has":""}" aria-hidden="true">▶</span><h3 style="color:var(--accent)">${esc(e.name)}</h3></button>${e.sets.map(s=>`<div class="tnum" style="display:flex;gap:14px"><b style="width:22px" class="st-${s.t}">${s.t==="w"?"W":s.t==="f"?"F":s.t==="d"?"D":++n}</b><span>${r1(s.kg)} kg × ${s.reps}</span></div>`).join("")}</div>`; }).join("")}
    <button class="btn ghost" data-act="edit-workout" data-id="${esc(id)}">Editar entreno</button>
    <div class="grid2"><button class="btn" data-act="repeat-workout" data-id="${esc(id)}">Repetir entreno</button><button class="btn soft" data-act="routine-from" data-id="${esc(id)}">Guardar como rutina</button></div>
    <div id="wDel"><button class="btn danger block" data-act="del-workout" data-id="${esc(id)}">Borrar entreno</button></div>`, {kind:"workout", id});
}

/* --- añadir alimento --- */
function foodKey(f){ return f.name; }
function recentFoods(){ const seen = new Map(); const days = Object.keys(S.diary).sort().reverse();
  for (const d of days) for (const e of S.diary[d]) if (e.per && !seen.has(e.name)) seen.set(e.name, {name:e.name, ...e.per, servings:e.servings||[]});
  return [...seen.values()].slice(0,12); }
function openAddFood(meal){
  openSheet("Añadir a "+meal, `<div class="seg" id="ftabs"><button data-act="ftab" data-t="search" aria-pressed="true">Buscar</button><button data-act="ftab" data-t="scan" aria-pressed="false">Escáner</button><button data-act="ftab" data-t="quick" aria-pressed="false">Rápido</button><button data-act="ftab" data-t="create" aria-pressed="false">Crear</button>${smp?`<button data-act="ftab" data-t="ai" aria-pressed="false">Con IA</button>`:""}</div><div id="fpane" class="stack"></div>`,
    {kind:"food", meal, t:"search", q:"", food:null});
  drawFood();
}
function drawFood(){
  const c = sheetCtx; document.querySelectorAll("#ftabs button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.t===c.t));
  const P = $("fpane");
  if (c.t==="search"){
    if (c.food) return drawFoodDetail();
    P.innerHTML = `<input id="fq" placeholder="Busca un alimento" value="${esc(c.q)}" autocomplete="off" aria-label="Buscar alimento"><div id="fres"></div>`;
    drawFoodResults(); return;
  }
  if (c.t==="quick") P.innerHTML = `<p class="note">Apunta calorías y macros sin buscar el alimento.</p>
    <label class="f">Descripción (opcional)<input id="qName" placeholder="Menú del día"></label>
    <div class="grid2"><label class="f">Calorías<input id="qK" inputmode="numeric"></label><label class="f">Proteínas (g)<input id="qP" inputmode="decimal"></label>
    <label class="f">Carbohidratos (g)<input id="qC" inputmode="decimal"></label><label class="f">Grasas (g)<input id="qF" inputmode="decimal"></label></div>
    <span class="msg" id="qMsg" hidden></span><button class="btn" data-act="quick-add">Añadir a ${esc(c.meal)}</button>`;
  if (c.t==="create") P.innerHTML = `<p class="note">Copia los valores de la etiqueta (por 100 g). Se guarda en «Mis alimentos».</p>
    <label class="f">Nombre<input id="cName" placeholder="Tortitas de arroz Hacendado"></label>
    <div class="grid2"><label class="f">Kcal / 100 g<input id="cK" inputmode="decimal"></label><label class="f">Proteínas / 100 g<input id="cP" inputmode="decimal"></label>
    <label class="f">Carbohidratos / 100 g<input id="cC" inputmode="decimal"></label><label class="f">Grasas / 100 g<input id="cF" inputmode="decimal"></label>
    <label class="f">Ración (nombre)<input id="cSn" placeholder="unidad"></label><label class="f">Ración (g)<input id="cSg" inputmode="decimal" placeholder="9"></label></div>
    <span class="msg" id="cMsg" hidden></span><button class="btn" data-act="create-food">Crear y elegir cantidad</button>`;
  if (c.t==="scan" && !isPremium()){ P.innerHTML = premiumPitch(); return; }
  if (c.t==="scan"){ P.innerHTML = `<div class="scan"><video id="scanV" playsinline muted autoplay></video><div class="scan-frame" aria-hidden="true"></div></div>
    <p class="note" id="scanMsg" style="text-align:center">Abriendo la cámara…</p>
    <label class="btn ${IOS?"":"ghost"}" style="cursor:pointer;text-align:center">📷 Hacer una foto del código<input type="file" id="scanPhoto" accept="image/*" capture="environment" hidden></label>
    <div style="display:flex;gap:8px"><input id="scanCode" inputmode="numeric" placeholder="O escribe el código (8410…)" aria-label="Código de barras"><button class="btn soft" data-act="scan-lookup">Buscar</button></div>
    <p class="note">Los datos vienen de Open Food Facts, una base de datos abierta. Comprueba que coinciden con la etiqueta.</p>`; startScan(); return; }
  if (c.t==="ai") P.innerHTML = `<p class="note">Describe lo que has comido y la IA calcula una estimación. Revísala antes de añadirla.</p>
    <textarea id="aiText" placeholder="Un plato de macarrones con tomate y atún, una manzana y un vaso de leche"></textarea>
    <button class="btn" data-act="ai-run" id="aiBtn">Calcular</button><div id="aiOut" class="stack"></div>`;
}
const parseNum = s => { s = String(s??"").trim().replace(/\s/g,""); if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g,"").replace(",","."); else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g,""); else s = s.replace(",","."); const n = parseFloat(s); return isFinite(n)?n:0; };
function drawFoodResults(){
  const c = sheetCtx, f = c.q.trim().toLowerCase();
  const pool = [...recentFoods().map(x=>({...x, tag:"Reciente"})), ...S.foods.map(x=>({...x, tag:"Mis alimentos"})), ...FOODS];
  const seen = new Set(); const list = pool.filter(x=>{ if (seen.has(x.name)) return false; seen.add(x.name); return !f || x.name.toLowerCase().includes(f); }).slice(0,40);
  c.list = list;
  $("fres").innerHTML = `<div class="list">${list.map((x,i)=>{ const sv = x.servings?.[0]; const kc = sv ? x.kcal*sv.g/100 : x.kcal;
    return `<button class="li" data-act="pick-food" data-i="${i}"><span class="n">${esc(x.name)}<small>${x.tag?esc(x.tag)+" · ":""}${sv?`1 ${esc(sv.n)} (${sv.g} g)`:"100 g"}</small></span><span class="tnum">${fmt(kc)} kcal</span></button>`; }).join("") ||
    `<div class="li note" style="cursor:default">No está en la lista. Créalo en «Crear»${smp?" o calcúlalo «Con IA»":""}.</div>`}</div>`;
}
function drawFoodDetail(){
  const c = sheetCtx, x = c.food, units = [...(x.servings||[]).map(s=>s.n), "g"];
  const u0 = c.unit || units[0], q0 = c.qty ?? (u0==="g"?100:1);
  c.curUnit = u0;
  $("fpane").innerHTML = `${c.editId?"":`<button class="link" data-act="food-back" style="align-self:flex-start">‹ Volver</button>`}<h3>${esc(x.name)}</h3>
    <div class="grid2"><label class="f">Cantidad<input id="fdQ" inputmode="decimal" value="${q0}"></label><label class="f">Medida<select id="fdU">${units.map(u=>`<option value="${esc(u)}" ${u===u0?"selected":""}>${u==="g"?"gramos":esc(u)+" ("+x.servings.find(s=>s.n===u).g+" g)"}</option>`).join("")}</select></label></div>
    ${x.code?`<p class="note">Código ${esc(x.code)} · ${r1(x.kcal)} kcal, ${r1(x.p)} g proteína, ${r1(x.c)} g hidratos y ${r1(x.f)} g grasa por 100 g. Guardado en «Mis alimentos».</p>`:""}
    <div class="nutri" id="fdN"></div><button class="btn" data-act="food-add">${c.editId?"Guardar cambios":"Añadir a "+esc(c.meal)}</button>
    ${c.editId?`<button class="btn danger" data-act="entry-del">Quitar del diario</button>`:""}`;
  updateFoodDetail();
}
function foodCalc(){ const c = sheetCtx, x = c.food; const q = parseNum($("fdQ").value), u = $("fdU").value;
  const g = u==="g" ? q : q*(x.servings.find(s=>s.n===u)?.g||0); const k = g/100;
  return {qty:q, unit:u, g, kcal:x.kcal*k, p:x.p*k, c:x.c*k, f:x.f*k}; }
function updateFoodDetail(){ const v = foodCalc();
  $("fdN").innerHTML = `<div><b>${fmt(v.kcal)}</b><span>kcal</span></div><div><b style="color:var(--carb)">${r1(v.c)}</b><span>Carb. g</span></div><div><b style="color:var(--fat)">${r1(v.f)}</b><span>Grasas g</span></div><div><b style="color:var(--prot)">${r1(v.p)}</b><span>Prot. g</span></div>`; }
function addEntries(meal, entries){ (S.diary[day] ||= []).push(...entries.map(e=>({id:rid(), meal, ...e}))); putDay(day); render(); }
function openEditEntry(id){
  const e = (S.diary[day]||[]).find(x=>x.id===id); if (!e) return;
  if (e.per){ openSheet("Editar alimento", `<div id="fpane" class="stack"></div>`, {kind:"food", meal:e.meal, t:"search", food:{name:e.name, ...e.per, servings:e.servings||[]}, qty:e.qty, unit:e.unit, editId:id}); drawFoodDetail(); return; }
  openSheet("Editar entrada", `<label class="f">Descripción<input id="eN" value="${esc(e.name)}"></label>
    <div class="grid2"><label class="f">Calorías<input id="eK" inputmode="numeric" value="${r0(e.kcal)}"></label><label class="f">Proteínas (g)<input id="eP" inputmode="decimal" value="${r1(e.p)}"></label>
    <label class="f">Carbohidratos (g)<input id="eC" inputmode="decimal" value="${r1(e.c)}"></label><label class="f">Grasas (g)<input id="eF" inputmode="decimal" value="${r1(e.f)}"></label></div>
    <button class="btn" data-act="entry-save">Guardar cambios</button><button class="btn danger" data-act="entry-del">Quitar del diario</button>`, {kind:"entry", editId:id});
}
async function runAI(){
  const text = $("aiText").value.trim(); if (!text) return;
  const btn = $("aiBtn"); btn.disabled = true; btn.textContent = "Calculando…"; $("aiOut").innerHTML = "";
  try {
    const res = await aiEstimate(text);
    const items = (res?.items||[]).filter(i=>i && i.name).map(i=>({name:String(i.name), g:parseNum(i.grams), kcal:parseNum(i.kcal), p:parseNum(i.p), c:parseNum(i.c), f:parseNum(i.f)}));
    sheetCtx.ai = items;
    $("aiOut").innerHTML = items.length ? `<div class="list">${items.map(i=>`<div class="li" style="cursor:default"><span class="n">${esc(i.name)}<small>${r0(i.g)} g · P ${r0(i.p)} · C ${r0(i.c)} · G ${r0(i.f)}</small></span><span class="tnum">${fmt(i.kcal)} kcal</span></div>`).join("")}</div>
      <button class="btn" data-act="ai-add">Añadir ${items.length>1?"todo ":""}a ${esc(sheetCtx.meal)} · ${fmt(items.reduce((a,i)=>a+i.kcal,0))} kcal</button>` : `<p class="msg">No he podido sacar una estimación. Prueba a describirlo con más detalle.</p>`;
  } catch(e){ $("aiOut").innerHTML = `<p class="msg">${e.code==="not_granted"?"Tu sesión ha caducado. Vuelve a entrar.":e.code==="disabled"?"La estimación con IA no está activada en esta instalación.":e.code==="rate_limited"?"Demasiadas consultas seguidas. Espera un poco.":"No se pudo calcular ahora. Inténtalo otra vez."}</p>`; }
  btn.disabled = false; btn.textContent = "Calcular";
}

/* ================= Premium ================= */
let premium = null, adminInfo = {admin:false, phone:null, price:"3"};
const FREE_PREMIUM = ["ametsaule@gmail.com"];   // cuentas con Premium gratis para siempre
const isFreePremium = () => FREE_PREMIUM.includes((user?.email || "").toLowerCase());
async function callAdmin(action, body){
  const { data:{ session } } = await sb.auth.getSession();
  const r = await fetch("/api/admin", {method:"POST", headers:{"content-type":"application/json", authorization:"Bearer " + (session?.access_token || "")}, body:JSON.stringify({action, ...(body||{})})});
  const j = await r.json().catch(() => ({})); if (!r.ok) throw {code:j.code || r.status}; return j;
}
async function loadPremium(){
  const [p, a] = await Promise.allSettled([sb.from("premium").select("until,note").eq("user_id", user.id).maybeSingle(), callAdmin("me")]);
  premium = p.status==="fulfilled" ? p.value.data : null; if (a.status==="fulfilled") adminInfo = a.value;
  render(); if (sheetCtx?.kind==="food" && sheetCtx.t==="scan") drawFood();
}
const isPremium = () => adminInfo.admin || isFreePremium() || (!!premium && (!premium.until || premium.until >= today()));
const fmtPhone = p => String(p||"").replace(/\D/g,"").replace(/^(\d{3})(\d{3})(\d{3})$/,"$1 $2 $3");
function premiumStatus(){
  if (adminInfo.admin) return "Eres administrador: tienes todo activado.";
  if (isFreePremium()) return "Tienes Premium para siempre. 🎁";
  if (!premium) return "";
  if (!premium.until) return "Tienes Premium para siempre. 🎁";
  return premium.until >= today() ? `Tienes Premium hasta el ${longDay(premium.until)}.` : `Tu Premium terminó el ${longDay(premium.until)}.`;
}
function premiumPitch(){
  const ph = adminInfo.phone, concept = `Premium ${user?.email || ""}`;
  return `<div class="prem"><span class="prem-badge">⭐ Premium</span><h3>Escáner de códigos de barras</h3>
    <p class="note">Apunta al código de cualquier producto y la app saca sus kcal, proteínas, hidratos y grasas al momento.</p>
    <div class="prem-price"><b>${esc(adminInfo.price||"3")} €</b><span>al mes</span></div>
    ${ph ? `<ol class="prem-steps">
      <li><span>Envía <b>${esc(adminInfo.price||"3")} €</b> por <b>Bizum</b> al</span><div class="copy"><code>${esc(fmtPhone(ph))}</code><button class="btn soft" data-act="copy" data-v="${esc(String(ph).replace(/\D/g,""))}">Copiar</button></div></li>
      <li><span>En el concepto escribe</span><div class="copy"><code>${esc(concept)}</code><button class="btn soft" data-act="copy" data-v="${esc(concept)}">Copiar</button></div></li>
      <li><span>Te lo activamos en cuanto llegue el pago, normalmente en el mismo día. Dura un mes y no se renueva solo.</span></li></ol>
      ${premium?.until && premium.until < today() ? `<p class="note">${esc(premiumStatus())}</p>` : ""}`
    : `<p class="note">El Premium aún no está disponible. Vuelve a mirarlo pronto.</p>`}
    <p class="note">Sin Premium puedes seguir buscando alimentos y creando los tuyos con los datos de la etiqueta.</p></div>`;
}
async function openAdmin(){
  openSheet("Panel de administración", `<p class="note">Activa el Premium cuando te llegue un Bizum (busca el email que venga en el concepto) o regálalo a quien quieras.</p>
    <input id="admQ" placeholder="Buscar por email" autocomplete="off" aria-label="Buscar usuario"><div id="admList" class="stack"><p class="note">Cargando usuarios…</p></div>`, {kind:"admin", users:[], q:""});
  try { const r = await callAdmin("list"); if (sheetCtx?.kind!=="admin") return; sheetCtx.users = r.users; drawAdmin(); }
  catch(e){ $("admList").innerHTML = `<p class="msg">${e.code===403?"Tu cuenta no es administradora.":e.code==="disabled"?"Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel.":"No se pudo cargar la lista. Comprueba que has ejecutado supabase/premium.sql."}</p>`; }
}
function drawAdmin(){
  const c = sheetCtx, q = c.q.trim().toLowerCase(), list = c.users.filter(u => !q || (u.email||"").toLowerCase().includes(q));
  const act = list.filter(u => u.premium && (!u.premium.until || u.premium.until >= today())).length;
  $("admList").innerHTML = `<p class="note">${c.users.length} usuarios · ${act} con Premium activo</p><div class="list">${list.slice(0,200).map(u => { const P = u.premium, on = P && (!P.until || P.until >= today());
    return `<div class="adm-u"><div class="n"><b>${esc(u.email)}</b><small>${on ? (P.until ? `Premium hasta el ${longDay(P.until)}` : "Premium para siempre 🎁") : P ? `Caducó el ${longDay(P.until)}` : "Sin Premium"} · alta ${u.created ? longDay(u.created.slice(0,10)) : "—"}</small></div>
      <div class="adm-b"><button class="btn soft" data-act="adm-grant" data-id="${esc(u.id)}" data-m="1">+1 mes</button><button class="btn ghost" data-act="adm-gift" data-id="${esc(u.id)}">Regalar</button>${P?`<button class="btn danger" data-act="adm-revoke" data-id="${esc(u.id)}">Quitar</button>`:""}</div></div>`; }).join("") || `<div class="li note">Nadie con ese email.</div>`}</div>`;
}
async function admDo(action, body, btn){
  btn.disabled = true;
  try { await callAdmin(action, body); const r = await callAdmin("list"); if (sheetCtx?.kind==="admin"){ sheetCtx.users = r.users; drawAdmin(); }
    if (body.user_id === user.id) loadPremium(); }
  catch { btn.disabled = false; btn.textContent = "Error, reintenta"; }
}

/* ================= bienvenida: calcular objetivos ================= */
function calcGoals(v){
  const {sex, age, h, w, act, goal} = v; if (!(age>=14 && age<=100 && h>=120 && h<=230 && w>=30 && w<=300)) return null;
  const bmr = 10*w + 6.25*h - 5*age + (sex==="m" ? 5 : -161);          // Mifflin-St Jeor
  const tdee = bmr * ({sed:1.2, lig:1.375, mod:1.55, alt:1.725}[act] || 1.375);
  let kcal = tdee * ({lose:0.85, keep:1, gain:1.1}[goal] || 1);
  kcal = Math.max(kcal, sex==="m" ? 1500 : 1200, bmr);                    // no bajar de un mínimo prudente
  kcal = Math.round(kcal/10)*10;
  const p = Math.round(w * ({lose:2, keep:1.6, gain:1.8}[goal] || 1.6));
  const f = Math.round(kcal*0.27/9), c = Math.max(0, Math.round((kcal - p*4 - f*9)/4));
  return {kcal, p, c, f, tdee:Math.round(tdee/10)*10};
}
function openGoalWizard(first){
  const pr = S.settings.profile || {}, lastW = Object.entries(S.body||{}).sort(([a],[b])=>a<b?1:-1)[0]?.[1]?.kg;
  const opt = (id, cur, list) => `<select id="${id}">${list.map(([v,l])=>`<option value="${v}" ${v===cur?"selected":""}>${l}</option>`).join("")}</select>`;
  openSheet(first ? "Bienvenido a beinghealthy" : "Calcular mis objetivos", `${first?`<p class="note">Vamos a calcular cuántas calorías y proteína te convienen al día. Son 20 segundos; puedes cambiarlo cuando quieras en Perfil.</p>`:""}
    <div class="grid2"><label class="f">Sexo${opt("wSex", pr.sex||"m", [["m","Hombre"],["f","Mujer"]])}</label><label class="f">Edad<input id="wAge" type="number" inputmode="numeric" min="14" max="100" value="${pr.age||""}" placeholder="25"></label>
      <label class="f">Altura (cm)<input id="wH" type="number" inputmode="numeric" value="${pr.h||""}" placeholder="175"></label><label class="f">Peso (kg)<input id="wW" type="number" inputmode="decimal" value="${pr.w||lastW||""}" placeholder="75"></label></div>
    <label class="f">Actividad${opt("wAct", pr.act||"lig", [["sed","Poca: trabajo sentado y casi sin ejercicio"],["lig","Ligera: ejercicio 1–3 días por semana"],["mod","Moderada: ejercicio 3–5 días o trabajo de pie"],["alt","Alta: ejercicio intenso casi a diario o trabajo físico"]])}</label>
    <label class="f">Objetivo${opt("wGoal", pr.goal||"lose", [["lose","Perder grasa"],["keep","Mantenerme"],["gain","Ganar músculo"]])}</label>
    <div id="wRes" class="wres"></div>
    <button class="btn" data-act="wizard-save" id="wSave" disabled>Usar estos objetivos</button>
    ${first?`<button class="btn ghost" data-act="close">Ahora no</button>`:""}
    <p class="note">Cálculo orientativo (fórmula de Mifflin-St Jeor según tu actividad). No sustituye el consejo de un dietista-nutricionista; si tienes alguna condición de salud, consúltalo antes.</p>`, {kind:"wizard"});
  updateWizard();
}
function wizardVals(){ return {sex:$("wSex").value, age:parseNum($("wAge").value), h:parseNum($("wH").value), w:parseNum($("wW").value), act:$("wAct").value, goal:$("wGoal").value}; }
function updateWizard(){
  const v = wizardVals(), g = calcGoals(v), el = $("wRes"); if (!el) return;
  $("wSave").disabled = !g;
  el.innerHTML = g ? `<div class="wres-k"><b>${fmt(g.kcal)}</b><span>kcal al día</span></div>
      <div class="wres-m"><div><b>${g.p} g</b><span>Proteínas</span></div><div><b>${g.c} g</b><span>Carbohidratos</span></div><div><b>${g.f} g</b><span>Grasas</span></div></div>
      <p class="note">${v.goal==="lose"?`Un 15 % menos de lo que gastas (unas ${fmt(g.tdee)} kcal) para perder grasa poco a poco.`:v.goal==="gain"?`Un 10 % más de lo que gastas (unas ${fmt(g.tdee)} kcal) para ganar músculo sin coger mucha grasa.`:`Lo que gastas al día, aproximadamente.`}</p>`
    : `<p class="note">Rellena tu edad (14 o más), altura y peso para ver el cálculo.</p>`;
}

/* ================= códigos de barras ================= */
let scan = null;
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints > 1);
const CAM = {video:{facingMode:{ideal:"environment"}, width:{ideal:1920}, height:{ideal:1080}, advanced:[{focusMode:"continuous"}]}, audio:false};
async function zxReader(){
  const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]], [DecodeHintType.TRY_HARDER, true]]);
  return new BrowserMultiFormatReader(hints, {delayBetweenScanAttempts:150});
}
function stopScan(){ if (!scan) return; try { scan.stop?.(); } catch {} try { scan.stream?.getTracks().forEach(t => t.stop()); } catch {} clearInterval(scan.timer); clearTimeout(scan.hint); scan = null; }
async function startScan(){
  stopScan(); const v = $("scanV"), msg = t => { const el = $("scanMsg"); if (el) el.textContent = t; };
  if (!navigator.mediaDevices?.getUserMedia){ msg("Este navegador no deja usar la cámara. Haz una foto del código o escríbelo."); return; }
  const me = scan = {}, found = code => { if (scan !== me) return; stopScan(); try { navigator.vibrate?.(80); } catch {} lookupBarcode(code); };
  try {
    me.stream = await navigator.mediaDevices.getUserMedia(CAM).catch(() => navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}, audio:false}));
    if (scan !== me){ me.stream.getTracks().forEach(t=>t.stop()); return; }
    v.setAttribute("playsinline",""); v.muted = true; v.srcObject = me.stream; await v.play().catch(()=>{});
    msg("Pon el código de barras dentro del recuadro, a unos 15 cm.");
    me.hint = setTimeout(() => { if (scan === me) msg("¿No lo lee? Acércalo un poco, busca buena luz o pulsa «Hacer una foto del código»."); }, 8000);
    if ("BarcodeDetector" in window && (await BarcodeDetector.getSupportedFormats().catch(()=>[])).includes("ean_13")){
      const det = new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e"]});
      me.timer = setInterval(async () => { if (scan !== me || v.readyState < 2) return;
        try { const r = await det.detect(v); if (r[0]?.rawValue) found(r[0].rawValue); } catch {} }, 250);
    } else {
      const reader = await zxReader(); if (scan !== me) return;
      const ctl = await reader.decodeFromStream(me.stream, v, (res) => { if (res) found(res.getText()); });
      me.stop = () => ctl.stop();
    }
  } catch(e){ if (scan === me) scan = null; msg(e?.name==="NotAllowedError" ? (IOS ? "No hay permiso para la cámara. En el iPhone: Ajustes › Safari › Cámara › Permitir, y vuelve a abrir la app. O usa «Hacer una foto del código»." : "No has dado permiso para la cámara. Puedes hacer una foto del código o escribirlo.") : "No se pudo abrir la cámara. Usa «Hacer una foto del código» o escribe los números."); }
}
async function scanPhoto(file){
  const msg = t => { const el = $("scanMsg"); if (el) el.textContent = t; }; msg("Leyendo la foto…");
  try {
    const reader = await zxReader();
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file); });
    // las fotos del iPhone son enormes: probamos varios tamaños y giros
    for (const max of [1600, 1100, 2400, 800]) for (const rot of [0, 90]){
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth*k), h = Math.round(img.naturalHeight*k);
      const c = document.createElement("canvas"); c.width = rot ? h : w; c.height = rot ? w : h; const x = c.getContext("2d");
      if (rot){ x.translate(c.width/2, c.height/2); x.rotate(Math.PI/2); x.drawImage(img, -w/2, -h/2, w, h); } else x.drawImage(img, 0, 0, w, h);
      try { const r = reader.decodeFromCanvas(c); if (r){ URL.revokeObjectURL(img.src); return lookupBarcode(r.getText()); } } catch {}
    }
    URL.revokeObjectURL(img.src);
    msg("No encuentro el código en la foto. Haz la foto más cerca, de frente y con buena luz, o escribe los números.");
  } catch { msg("No se pudo leer la foto. Escribe los números del código."); }
}
async function lookupBarcode(code){
  const c = sheetCtx, msg = t => { const el = $("scanMsg"); if (el) el.textContent = t; };
  const mine = S.foods.find(f => f.code === code); if (mine){ c.t = "search"; c.food = mine; c.qty = null; c.unit = null; drawFood(); return; }
  msg(`Buscando ${code}…`); if ($("scanCode")) $("scanCode").value = code;
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_es,brands,nutriments,serving_quantity,quantity&lc=es`);
    const j = await r.json(); const pr = j.product, n = pr?.nutriments || {};
    let kcal = n["energy-kcal_100g"]; if (kcal == null && n["energy_100g"] != null) kcal = n["energy_100g"] / 4.184;
    if (!pr || kcal == null){ msg("Este producto no está en la base de datos o no tiene la información nutricional. Créalo en «Crear» copiando la etiqueta."); return; }
    const name = [pr.product_name_es || pr.product_name || "Producto " + code, (pr.brands||"").split(",")[0].trim()].filter(Boolean).join(" · ");
    const sq = parseFloat(pr.serving_quantity);
    const food = {name, code, kcal:r1(kcal), p:r1(n.proteins_100g||0), c:r1(n.carbohydrates_100g||0), f:r1(n.fat_100g||0), m:microFromOFF(n), servings: sq > 0 ? [{n:"ración", g:r1(sq)}] : []};
    await put("foods", {list:[...S.foods.filter(f => f.code !== code && f.name !== name), food]});
    if (sheetCtx !== c) return;
    c.t = "search"; c.food = food; c.qty = null; c.unit = null; drawFood();
  } catch { msg("No se pudo consultar el producto. Revisa la conexión e inténtalo otra vez."); }
}

/* ================= importar ================= */
function parseCSV(text){
  text = text.replace(/^﻿/,""); const first = text.split(/\r?\n/)[0] || "";
  const cnt = ch => first.split(ch).length; const delim = [",",";","\t"].sort((a,b)=>cnt(b)-cnt(a))[0];
  const rows = []; let row = [], cur = "", inQ = false;
  for (let i=0;i<text.length;i++){ const ch = text[i];
    if (inQ){ if (ch==='"'){ if (text[i+1]==='"'){ cur+='"'; i++; } else inQ = false; } else cur += ch; }
    else if (ch==='"') inQ = true; else if (ch===delim){ row.push(cur); cur=""; }
    else if (ch==="\n" || ch==="\r"){ if (ch==="\r" && text[i+1]==="\n") i++; row.push(cur); rows.push(row); row=[]; cur=""; }
    else cur += ch; }
  if (cur || row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r=>r.some(c=>c.trim()!==""));
}
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
function colIdx(h, ...keys){ for (const k of keys){ const i = h.findIndex(x=>x===k); if (i>=0) return i; } for (const k of keys){ const i = h.findIndex(x=>x.startsWith(k)); if (i>=0) return i; } return -1; }
const MON = {jan:0,ene:0,feb:1,mar:2,apr:3,abr:3,may:4,jun:5,jul:6,aug:7,ago:7,sep:8,sept:8,oct:9,nov:10,dec:11,dic:11};
function parseAnyDate(s){
  s = String(s||"").trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/))) return new Date(+m[1],m[2]-1,+m[3],+(m[4]||12),+(m[5]||0));
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-zé.]+)\s+(\d{4}),?\s*(?:(\d{1,2}):(\d{2}))?/))){ const mo = MON[norm(m[2]).replace(".","").slice(0,4)] ?? MON[norm(m[2]).slice(0,3)]; if (mo!=null) return new Date(+m[3],mo,+m[1],+(m[4]||12),+(m[5]||0)); }
  if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:,?\s+(\d{1,2}):(\d{2}))?/))){ let a=+m[1], b=+m[2], y=+m[3]; if (y<100) y+=2000; let d=a, mo=b; if (b>12 && a<=12){ d=b; mo=a; } return new Date(y,mo-1,d,+(m[4]||12),+(m[5]||0)); }
  const t = new Date(s); return isNaN(t) ? null : t;
}
function parseStrongDur(s){ const h = /(\d+)\s*h/.exec(s)?.[1]||0, m = /(\d+)\s*m/.exec(s)?.[1]||0; return (h*60 + +m)*60000; }
function importWorkoutsCSV(text, fname){
  const rows = parseCSV(text); if (rows.length<2) return {title:"Archivo vacío", summary:"No he encontrado filas en "+fname+"."};
  const h = rows[0].map(norm), body = rows.slice(1);
  let src, iTitle, iStart, iEnd, iEx, iType, iKg, iLbs, iReps, iDur, iOrder;
  if (h.includes("exercise_title") && h.includes("start_time")){ src = "Hevy";
    iTitle = colIdx(h,"title"); iStart = colIdx(h,"start_time"); iEnd = colIdx(h,"end_time"); iEx = colIdx(h,"exercise_title"); iType = colIdx(h,"set_type"); iKg = colIdx(h,"weight_kg"); iLbs = colIdx(h,"weight_lbs"); iReps = colIdx(h,"reps"); }
  else if (h.includes("exercise name") && h.includes("set order")){ src = "Strong";
    iTitle = colIdx(h,"workout name"); iStart = colIdx(h,"date"); iDur = colIdx(h,"duration"); iEx = colIdx(h,"exercise name"); iOrder = colIdx(h,"set order"); iKg = colIdx(h,"weight (kg)","weight"); iLbs = colIdx(h,"weight (lbs)"); iReps = colIdx(h,"reps"); }
  else { iStart = colIdx(h,"fecha","date"); iEx = colIdx(h,"ejercicio","exercise"); iKg = colIdx(h,"kg","peso","weight"); iReps = colIdx(h,"reps","repeticiones"); iTitle = colIdx(h,"entreno","rutina","workout","title");
    if (iStart<0 || iEx<0 || iReps<0) return {title:"Formato no reconocido", summary:`${fname} no parece una exportación de entrenos de Hevy ni de Strong. Necesito columnas de fecha, ejercicio, kg y repeticiones.`}; src = "CSV"; }
  const map = new Map(); let sets = 0, bad = 0;
  for (const r of body){
    const d = parseAnyDate(r[iStart]); if (!d){ bad++; continue; }
    const start = d.getTime(), title = (iTitle>=0 ? r[iTitle] : "") || "Entreno", key = start+"|"+title;
    let w = map.get(key); if (!w){ let end = iEnd>=0 ? parseAnyDate(r[iEnd])?.getTime() : null; if (!end && iDur>=0) end = start + parseStrongDur(r[iDur]||"");
      w = {id:String(start), title, start, end:end||start+3600e3, exercises:[], src}; map.set(key, w); }
    const name = (r[iEx]||"").trim(); if (!name) continue;
    let e = w.exercises[w.exercises.length-1]; if (!e || e.name!==name) w.exercises.push(e = {name, sets:[]});
    let kg = iKg>=0 && r[iKg]!=="" ? parseNum(r[iKg]) : (iLbs>=0 ? parseNum(r[iLbs])*0.453592 : 0);
    const st = norm(iType>=0 ? r[iType] : (iOrder>=0 && /^w/i.test(r[iOrder]) ? "warmup" : ""));
    e.sets.push({t: st.startsWith("warm")?"w": st.startsWith("fail")?"f": st.startsWith("drop")?"d":"n", kg:r1(kg), reps:r0(parseNum(r[iReps]))}); sets++;
  }
  const items = [...map.values()].filter(w=>w.exercises.length).sort((a,b)=>a.start-b.start);
  if (!items.length) return {title:"Nada que importar", summary:"No he encontrado entrenos válidos en "+fname+"."};
  const existing = items.filter(w=>S.workouts.some(x=>x.id===w.id)).length;
  return {kind:"workouts", items, title:`${src}: ${items.length} entrenos`,
    summary:`${fmt(sets)} series, del ${shortDay(iso(new Date(items[0].start)))} ${new Date(items[0].start).getFullYear()} al ${shortDay(iso(new Date(items[items.length-1].start)))} ${new Date(items[items.length-1].start).getFullYear()}.${existing?` ${existing} ya estaban y se actualizarán.`:""}${bad?` ${bad} filas sin fecha válida se saltarán.`:""}`};
}
function mapMeal(s){ const n = norm(s); if (/break|desayun/.test(n)) return "Desayuno"; if (/lunch|almuer|^comida/.test(n)) return "Comida"; if (/dinner|cena/.test(n)) return "Cena"; return "Snacks"; }
function importFoodCSV(text, fname){
  const rows = parseCSV(text); if (rows.length<2) return {title:"Archivo vacío", summary:"No he encontrado filas en "+fname+"."};
  const h = rows[0].map(norm);
  const iD = colIdx(h,"date","fecha"), iM = colIdx(h,"meal","comida","momento"), iK = colIdx(h,"calories","calorias","kcal","energia"),
        iP = colIdx(h,"protein (g)","proteinas (g)","protein","proteina"), iC = colIdx(h,"carbohydrates (g)","carbohidratos (g)","carbohydrates","carbohidratos","carbs"),
        iF = colIdx(h,"fat (g)","grasas (g)","grasa (g)","fat","grasas","grasa"), iN = colIdx(h,"food","alimento","nombre","name","note","nota");
  if (iD<0 || iK<0) return {title:"Formato no reconocido", summary:`${fname} no parece una exportación de MyFitnessPal. Usa el archivo «Nutrition Summary» (necesito columnas de fecha y calorías).`};
  const isMFP = iM>=0 && h.some(x=>x.startsWith("sodium")||x.startsWith("sodio")||x.startsWith("fiber")||x.startsWith("fibra"));
  const items = []; let bad = 0;
  for (const r of rows.slice(1)){ const d = parseAnyDate(r[iD]); if (!d){ bad++; continue; }
    const date = iso(d), meal = iM>=0 ? mapMeal(r[iM]) : "Snacks", label = iN>=0 && r[iN] && !/^(note|nota)/.test(h[iN]) ? r[iN] : (iM>=0 ? r[iM] : "Importado");
    items.push({id:"imp-"+date+"-"+norm(r[iM]||"x").replace(/[^a-z0-9]/g,"")+"-"+(iN>=0?norm(r[iN]).replace(/[^a-z0-9]/g,"").slice(0,20):items.length),
      date, meal, name: isMFP ? meal+" (MyFitnessPal)" : label, kcal:r0(parseNum(r[iK])), p:r1(iP>=0?parseNum(r[iP]):0), c:r1(iC>=0?parseNum(r[iC]):0), f:r1(iF>=0?parseNum(r[iF]):0), src:isMFP?"MyFitnessPal":"Importado"}); }
  if (!items.length) return {title:"Nada que importar", summary:"No he encontrado filas válidas en "+fname+"."};
  const days = [...new Set(items.map(i=>i.date))].sort();
  return {kind:"food", items, title:`${isMFP?"MyFitnessPal":"Comidas"}: ${days.length} día${days.length>1?"s":""}`,
    summary:`${items.length} registros del ${shortDay(days[0])} al ${shortDay(days[days.length-1])}. MyFitnessPal exporta el total de cada comida, no cada alimento, así que verás una línea por comida.${bad?` ${bad} filas sin fecha válida se saltarán.`:""}`};
}
function importJSON(text, fname){
  let d; try { d = JSON.parse(text); } catch { return {title:"Archivo no válido", summary:fname+" no es un JSON válido."}; }
  if (d?.app!=="pesa-y-plato") return {title:"Formato no reconocido", summary:"Este JSON no es una copia de beinghealthy."};
  if (d.plan30){ const n = d.plan30.days.length;
    const hoy = parseDay(today()).getDate();
    return {kind:"plan30", items:[d.plan30], title:`${d.plan30.title} · ${n} días`, summary:`Cada día del mes tendrá su menú: el día 1 de cada mes el menú del día 1, el día 2 el del día 2… Hoy (${hoy}) te toca el del día ${Math.min(hoy, n)}. Sustituye cualquier plan mensual que tuvieras.`}; }
  if (d.plan && !d.workouts && !d.diary){ const n = Object.values(d.plan).reduce((a,day)=>a+Object.values(day).reduce((b,l)=>b+l.length,0),0);
    return {kind:"backup", items:[d], title:"Plan semanal", summary:`${n} alimentos repartidos en ${Object.keys(d.plan).length} días. Sustituye por completo el plan que tengas ahora.`}; }
  return {kind:"backup", items:[d], title:"Copia de seguridad", summary:`${(d.workouts||[]).length} entrenos, ${Object.keys(d.diary||{}).length} días de comidas, ${(d.routines||[]).length} rutinas. Se mezclará con lo que ya tienes.`};
}
function loadScript(src){ return new Promise((ok,ko)=>{ const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }
async function parseHealthFile(file){
  const setP = t => { importState.progress = t; const el = $("impProg"); if (el) el.textContent = t; };
  importState = {title:"Leyendo exportación de Salud…", summary:"Puede tardar un poco si tienes mucho historial. No cierres la app.", progress:"0 %"}; render();
  const cutoff = addDays(today(),-365), steps = {}, kcal = {}, wos = []; let cur = null;
  const attrs = l => { const o = {}; for (const m of l.matchAll(/(\w+)="([^"]*)"/g)) o[m[1]] = m[2]; return o; };
  const toMs = s => new Date(String(s).replace(" ","T").replace(" ","").replace(/([+-]\d{2})(\d{2})$/,"$1:$2")).getTime();
  const toKcal = (v,u) => u==="kJ" ? v/4.184 : u==="Cal"||u==="kcal" ? v : v;
  const toKm = (v,u) => u==="m" ? v/1000 : u==="mi" ? v*1.60934 : u==="yd" ? v*0.0009144 : v;
  const pushW = () => { if (cur && cur.d>=cutoff) wos.push({id:String(cur.start), type:cur.type, start:cur.start, end:cur.end, km:r1(cur.km||0), kcal:r0(cur.kcal||0)}); cur = null; };
  function line(l){
    if (l.includes("<Record ")){
      const isS = l.includes('"HKQuantityTypeIdentifierStepCount"'), isE = l.includes('"HKQuantityTypeIdentifierActiveEnergyBurned"'); if (!isS && !isE) return;
      const a = attrs(l), d = (a.startDate||"").slice(0,10); if (d<cutoff) return;
      const tgt = isS ? steps : kcal, src = a.sourceName||"?", v = isS ? +a.value||0 : toKcal(+a.value||0, a.unit);
      (tgt[d] ||= {}); tgt[d][src] = (tgt[d][src]||0) + v;
    } else if (l.includes("<Workout ")){
      const a = attrs(l);
      cur = {type:(a.workoutActivityType||"Other").replace("HKWorkoutActivityType",""), start:toMs(a.startDate), end:toMs(a.endDate), d:(a.startDate||"").slice(0,10),
        km: a.totalDistance ? toKm(+a.totalDistance, a.totalDistanceUnit) : 0, kcal: a.totalEnergyBurned ? toKcal(+a.totalEnergyBurned, a.totalEnergyBurnedUnit) : 0};
      if (/\/>\s*$/.test(l)) pushW();
    } else if (cur && l.includes("<WorkoutStatistics ")){
      const a = attrs(l), v = +a.sum||0;
      if (a.type?.includes("ActiveEnergyBurned")) cur.kcal = toKcal(v, a.unit); else if (a.type?.includes("Distance")) cur.km = toKm(v, a.unit);
    } else if (cur && l.includes("</Workout>")) pushW();
  }
  const dec = new TextDecoder(); let buf = "";
  const feed = (chunk, final) => { buf += dec.decode(chunk, {stream:!final}); const parts = buf.split("\n"); buf = final ? "" : parts.pop(); for (const l of parts) line(l); };
  try {
    const reader = file.stream().getReader(); let read = 0, last = 0;
    const progress = () => { const pct = Math.floor(read/file.size*100); if (pct!==last){ last = pct; setP(pct+" %"); } };
    if (/\.zip$/i.test(file.name) || file.type.includes("zip")){
      const fflate = await import("fflate");
      let found = false; const uz = new fflate.Unzip(); uz.register(fflate.UnzipInflate);
      uz.onfile = f => { if (/(^|\/)export\.xml$/.test(f.name)){ found = true; f.ondata = (err, dat, fin) => { if (!err) feed(dat, fin); }; f.start(); } };
      for (;;){ const {done, value} = await reader.read(); if (done){ uz.push(new Uint8Array(0), true); break; } read += value.length; uz.push(value); progress(); await new Promise(r=>setTimeout(r,0)); }
      if (!found) throw new Error("noxml");
    } else {
      for (;;){ const {done, value} = await reader.read(); if (done){ feed(new Uint8Array(0), true); break; } read += value.length; feed(value, false); progress(); }
    }
  } catch(e){ importState = {title:"No he podido leer el archivo", summary: e?.message==="noxml" ? "El .zip no contiene export.xml. Asegúrate de elegir la exportación de la app Salud." : "Si es un .zip, prueba a descomprimirlo en el iPhone (app Archivos) y elegir el archivo export.xml de dentro."}; render(); return; }
  const days = {}; const maxSrc = o => Math.max(0, ...Object.values(o||{}));
  for (const d of new Set([...Object.keys(steps), ...Object.keys(kcal)])) days[d] = {steps:r0(maxSrc(steps[d])), kcal:r0(maxSrc(kcal[d]))};
  const nd = Object.keys(days).length;
  if (!nd && !wos.length){ importState = {title:"Sin datos del último año", summary:"No he encontrado pasos, calorías ni entrenos del último año en esta exportación."}; render(); return; }
  const avg = r0(Object.values(days).reduce((a,b)=>a+b.steps,0)/Math.max(1,nd));
  importState = {kind:"health", items:[{days, wos}], title:`Apple Salud: ${nd} días`, summary:`Media de ${fmt(avg)} pasos al día y ${wos.length} entrenos del Watch en el último año. Se mezclará con lo que ya tienes.`};
  render();
}
const APP_LINK = location.origin + "/#watch";
function parseWatchText(t){
  const parts = String(t||"").split(/[;\n|]+/).map(x=>x.trim()).filter(Boolean); if (!parts.length) return null;
  let date = today(); const dm = parts[0].match(/^(\d{4}-\d{2}-\d{2})|^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (dm){ const d = parseAnyDate(parts.shift()); if (d) date = iso(d); }
  const nums = parts.map(x=>parseNum((x.match(/-?\d[\d.,]*/)||[""])[0]));
  if (!(nums[0]>0) && !(nums[1]>0)) return null;
  return {date, steps:r0(nums[0]||0), kcal:r0(nums[1]||0)};
}
async function saveWatch(v){ const prev = S.health.days[v.date]||{};
  return mergeHealth({days:{[v.date]:{steps:v.steps||prev.steps||0, kcal:v.kcal||prev.kcal||0}}, wos:[]}); }
function clearHash(){ try { if (location.hash) history.replaceState(null, "", location.pathname + location.search); } catch {} }
function openWatchPaste(){
  openSheet("Datos del Apple Watch", `<p class="note">Toca el cuadro y elige <b>Pegar</b>. Se guarda solo.</p>
    <input id="wPaste" placeholder="Toca aquí y pega" autocomplete="off" style="font-size:20px;padding:16px;text-align:center" aria-label="Pegar datos del atajo">
    <div id="wPasteMsg" class="note" style="text-align:center;min-height:20px"></div>`, {kind:"watch"});
  setTimeout(()=>$("wPaste")?.focus(), 50);
}
async function handleWatchPaste(text){
  const v = parseWatchText(text), m = $("wPasteMsg"); if (!m) return;
  if (!v){ m.innerHTML = `<span class="msg">No reconozco esto. Debería ser algo como «8432;512» (pasos;kcal).</span>`; return; }
  const ok = await saveWatch(v); clearHash();
  m.innerHTML = ok ? `<span style="color:var(--ok);font-weight:600">✓ Guardado: ${fmt(v.steps)} pasos · ${fmt(v.kcal)} kcal activas (${dayLabel(v.date).toLowerCase()})</span>` : `<span class="msg">No se pudo guardar. Inténtalo otra vez.</span>`;
  if (ok){ $("wPaste").value = ""; render(); }
}
function openShortcutGuide(){
  const step = (n, t, d) => `<div style="display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px"><span class="play has" style="width:26px;height:26px;font-size:13px;font-weight:700">${n}</span><div><b>${t}</b>${d?`<div class="note">${d}</div>`:""}</div></div>`;
  openSheet("Configurar atajo", `<p class="note">Se hace una sola vez en el iPhone (unos 3 minutos). Después, cada noche te llega un aviso: lo tocas, pegas y listo.</p>
    <div class="card"><h2>A · Crear el atajo</h2>
      ${step(1,"Abre la app Atajos y toca +","Llámalo «beinghealthy».")}
      ${step(2,"Añade «Buscar muestras de salud»","Tipo: Pasos · Fecha de inicio: hoy · Agrupar por: Día · Límite: 1.")}
      ${step(3,"Añade «Obtener detalles de muestras de salud»","Elige «Valor».")}
      ${step(4,"Repite los pasos 2 y 3 con «Energía activa»","")}
      ${step(5,"Añade «Texto»","Mete las dos variables «Valor» separadas por punto y coma: Valor;Valor (primero pasos, luego energía).")}
      ${step(6,"Añade «Copiar al portapapeles»","")}
      ${step(7,"Añade «Abrir URL» y pega este enlace:","")}
      <div style="display:flex;gap:8px"><input id="appLink" readonly value="${APP_LINK}" aria-label="Enlace de la app"><button class="btn" data-act="copy-link">Copiar</button></div><span class="note" id="copyMsg"></span></div>
    <div class="card"><h2>B · Que se ejecute solo cada noche</h2>
      ${step(1,"En Atajos, ve a Automatización y toca +","")}
      ${step(2,"Elige «Hora del día»","Por ejemplo 22:00, diariamente.")}
      ${step(3,"Marca «Ejecutar inmediatamente»","Así no te pregunta antes de ejecutarlo.")}
      ${step(4,"Elige el atajo «beinghealthy»","")}</div>
    <p class="note">Al abrirse, la app te mostrará la pantalla para pegar. Si la pruebas ahora a mano, pulsa este botón:</p>
    <button class="btn soft" data-act="watch-paste">Probar la pantalla de pegar</button>`, {kind:"guide"});
}
function mergeHealth(h){ const days = {...S.health.days, ...h.days}; const ids = new Set((h.wos||[]).map(w=>w.id));
  const keep = Object.keys(days).sort().slice(-400), dd = {}; for (const k of keep) dd[k] = days[k];
  const wos = [...S.health.wos.filter(w=>!ids.has(w.id)), ...(h.wos||[])].sort((a,b)=>b.start-a.start).slice(0,400);
  return put("health", {days:dd, wos}); }
async function runImport(){
  const st = importState; st.busy = true; render(); const prog = t => { st.progress = t; const el = $("impProg"); if (el) el.textContent = t; };
  let n = 0;
  if (st.kind==="workouts"){ await putMany(st.items.map(w=>["w-"+w.id, w]), (i,t)=>prog(`${i} de ${t}…`)); }
  else if (st.kind==="plan30"){ const P = st.items[0];
    await put("plandates", {mode:"month", title:P.title, length:P.days.length, days:P.days}); }
  else if (st.kind==="health"){ prog("Guardando…"); await mergeHealth(st.items[0]); }
  else if (st.kind==="food"){ const byDay = {}; for (const i of st.items) (byDay[i.date] ||= []).push(i);
    const days = Object.keys(byDay); for (const d of days){ const ids = new Set(byDay[d].map(i=>i.id));
      S.diary[d] = [...(S.diary[d]||[]).filter(e=>!ids.has(e.id)), ...byDay[d].map(({date,...e})=>e)]; await put("d-"+d, {entries:S.diary[d]}); if (++n%5===0) prog(`${n} de ${days.length} días…`); } }
  else { const d = st.items[0];
    for (const w of d.workouts||[]) await put("w-"+w.id, w);
    for (const [k,v] of Object.entries(d.diary||{})){ const ids = new Set(v.map(e=>e.id)); S.diary[k] = [...(S.diary[k]||[]).filter(e=>!ids.has(e.id)), ...v]; await put("d-"+k, {entries:S.diary[k]}); }
    const merge = (a,b) => [...a.filter(x=>!b.some(y=>y.id===x.id && x.id!=null || y.name===x.name)), ...b];
    if (d.routines) await put("routines", {list:merge(S.routines, d.routines)});
    if (d.foods) await put("foods", {list:merge(S.foods, d.foods)});
    if (d.plan) await put("plan", {days: (!d.workouts && !d.diary) ? d.plan : {...S.plan, ...d.plan}});
    if (d.exlib) await put("exlib", {list:merge(S.exlib, d.exlib)});
    if (d.body) await put("body", {log:{...S.body, ...d.body}});
    if (d.health) await mergeHealth(d.health);
    if (d.settings) await put("settings", {...S.settings, ...d.settings}); }
  const nRev = st.kind==="workouts" || st.kind==="backup" ? unreviewed().length : 0;
  importState = {review:nRev, title:"Importación terminada", summary: st.kind==="plan30" ? `Listo: hoy, día ${parseDay(today()).getDate()}, tienes en el Diario el menú del día ${datedPlan(today())?._n}. Cada mes vuelve a empezar por el día 1.` : st.kind==="health" ? "Datos de Salud importados. Mira la tarjeta de actividad en Inicio." : st.kind==="workouts" ? `${st.items.length} entrenos importados.` : st.kind==="food" ? `${st.items.length} registros de comida importados.` : "Copia restaurada."};
  render();
}

/* ================= exportar ================= */
const csvCell = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
async function save(filename, data){ try { await dl.save({filename, data}); } catch(e){ if (e?.code!=="cancelled" && e?.code!=="dismissed") setBanner("No se pudo descargar el archivo."); } }
function exportJSON(){ const {active, media, ...rest} = S; save(`beinghealthy-${today()}.json`, JSON.stringify({app:"pesa-y-plato", version:2, exported:new Date().toISOString(), ...rest}, null, 1)); }
function exportW(){ const T = {n:"normal",w:"warmup",f:"failure",d:"dropset"}; const lines = [["title","start_time","end_time","exercise_title","set_index","set_type","weight_kg","reps"].join(",")];
  for (const w of [...S.workouts].reverse()) for (const e of w.exercises) e.sets.forEach((s,i)=>lines.push([w.title, new Date(w.start).toISOString(), new Date(w.end||w.start).toISOString(), e.name, i, T[s.t]||"normal", s.kg, s.reps].map(csvCell).join(",")));
  save(`entrenos-${today()}.csv`, lines.join("\n")); }
function exportF(){ const lines = [["Fecha","Comida","Alimento","Cantidad","Calorías","Proteínas (g)","Carbohidratos (g)","Grasas (g)"].join(",")];
  for (const d of Object.keys(S.diary).sort()) for (const e of S.diary[d]) lines.push([d, e.meal, e.name, e.qty?`${r1(e.qty)} ${e.unit}`:"", r0(e.kcal), r1(e.p), r1(e.c), r1(e.f)].map(csvCell).join(","));
  save(`comidas-${today()}.csv`, lines.join("\n")); }

/* ================= ejemplos ================= */
async function loadExamples(){
  const msg = t => { const el = $("exMsg"); if (el) el.textContent = t; }; msg("Cargando ejemplos…");
  const t = today();
  const R = [{id:"ex-push", name:"Empuje", exercises:[{name:"Press banca",sets:4},{name:"Press militar",sets:3},{name:"Elevaciones laterales",sets:3},{name:"Extensión de tríceps en polea",sets:3}], example:true},
             {id:"ex-pull", name:"Tirón", exercises:[{name:"Dominadas",sets:4},{name:"Remo con barra",sets:4},{name:"Jalón al pecho",sets:3},{name:"Curl con barra",sets:3}], example:true},
             {id:"ex-legs", name:"Pierna", exercises:[{name:"Sentadilla",sets:4},{name:"Peso muerto rumano",sets:3},{name:"Prensa",sets:3},{name:"Elevación de gemelos",sets:3}], example:true}];
  const base = {"Press banca":[55,8],"Press militar":[32.5,8],"Elevaciones laterales":[8,12],"Extensión de tríceps en polea":[20,12],"Dominadas":[0,7],"Remo con barra":[50,10],"Jalón al pecho":[45,10],"Curl con barra":[25,10],
    "Sentadilla":[70,8],"Peso muerto rumano":[60,10],"Prensa":[120,12],"Elevación de gemelos":[60,15]};
  const plan = [[-20,0],[-19,1],[-17,2],[-15,0],[-14,1],[-12,2],[-10,0],[-8,1],[-7,2],[-5,0],[-3,1],[-1,2]];
  let wk = 0;
  for (const [off, ri] of plan){ const r = R[ri], step = Math.floor(wk++/3); const start = parseDay(addDays(t,off)).getTime() + (18*60+ (off%3)*20)*60000;
    const exs = r.exercises.map(e=>{ const [kg,reps] = base[e.name]; const inc = kg>=50 ? 2.5 : kg>0 ? 1 : 0;
      const work = Array.from({length:e.sets},(_,i)=>({t:"n", kg:r1(kg+inc*step), reps:Math.max(5,reps-(i>1?1:0))}));
      return {name:e.name, sets: kg>=50 ? [{t:"w",kg:r1(kg*.5),reps:10}, ...work] : work}; });
    const w = {id:String(start), title:r.name, start, end:start+(55+off%4*6)*60000, exercises:exs, example:true}; await put("w-"+w.id, w); }
  await put("routines", {list:[...S.routines.filter(x=>!x.example), ...R]});
  const F = n => FOODS.find(f=>f.name===n);
  const mk = (meal, n, qty) => { const f = F(n), sv = f.servings[0], g = qty*sv.g, k = g/100; return {id:rid(), meal, name:f.name, qty, unit:sv.n, g, per:{kcal:f.kcal,p:f.p,c:f.c,f:f.f}, servings:f.servings, kcal:f.kcal*k, p:f.p*k, c:f.c*k, f:f.f*k, ex:true}; };
  const menus = [
    [["Desayuno","Copos de avena",1.5],["Desayuno","Leche semidesnatada",1],["Desayuno","Plátano",1],["Comida","Pechuga de pollo (cocinada)",1],["Comida","Arroz blanco (cocido)",1],["Comida","Ensalada mixta",1],["Comida","Aceite de oliva",1],["Snacks","Yogur proteico",1],["Snacks","Almendras",1],["Cena","Merluza",1],["Cena","Patata cocida",1],["Cena","Brócoli",1]],
    [["Desayuno","Pan integral",2],["Desayuno","Huevo",2],["Desayuno","Café con leche",1],["Comida","Lentejas (cocidas)",1],["Comida","Pan blanco",1],["Comida","Manzana",1],["Snacks","Proteína whey",1],["Snacks","Plátano",1],["Cena","Tortilla de patata",1.5],["Cena","Ensalada mixta",1],["Cena","Yogur natural",1]],
    [["Desayuno","Queso fresco batido 0%",1],["Desayuno","Fresas",1],["Desayuno","Copos de avena",1],["Comida","Pasta (cocida)",1],["Comida","Atún en lata (al natural)",2],["Comida","Tomate",1],["Snacks","Fiambre de pavo",4],["Snacks","Pan integral",2],["Cena","Salmón",1],["Cena","Boniato asado",1],["Cena","Aguacate",0.5]]];
  for (let i=6;i>=0;i--){ const d = addDays(t,-i); const ids = new Set(); const list = menus[i%3].filter(([m])=>!(i===0 && m==="Cena")).map(([m,n,q])=>mk(m,n,q));
    S.diary[d] = [...(S.diary[d]||[]), ...list]; await putDay(d); }
  const log = {...S.body}; for (let i=21;i>=0;i-=2){ const d = addDays(t,-i); if (!log[d]) log[d] = {kg:r1(82.6 - (21-i)*0.065 + ((i*7)%5-2)*0.12), example:true}; }
  await put("body", {log});
  msg("Ejemplos cargados. Mira Inicio, Diario y Progreso."); render();
}
async function clearExamples(){
  const msg = t => { const el = $("exMsg"); if (el) el.textContent = t; }; msg("Borrando ejemplos…");
  for (const w of S.workouts.filter(w=>w.example)) await del("w-"+w.id);
  for (const d of Object.keys(S.diary)) if (S.diary[d].some(e=>e.ex)){ S.diary[d] = S.diary[d].filter(e=>!e.ex); await putDay(d); }
  if (S.routines.some(r=>r.example)) await put("routines", {list:S.routines.filter(r=>!r.example)});
  if (Object.values(S.body).some(v=>v.example)) await put("body", {log:Object.fromEntries(Object.entries(S.body).filter(([,v])=>!v.example))});
  msg("Ejemplos borrados."); render();
}

/* ================= eventos ================= */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el || el.disabled) return;
  const act = el.dataset.act, row = el.closest("[data-ei]"), ei = row ? +row.dataset.ei : -1, si = row?.dataset.si!=null ? +row.dataset.si : -1;
  const a = S.active, c = sheetCtx;
  switch (act){
    case "tab": tab = el.dataset.tab; closeSheet(); render(); scrollTo(0,0); break;
    case "close": closeSheet(); break;
    /* entreno */
    case "start-empty": startWorkout("Entreno "+(["de domingo","de lunes","de martes","de miércoles","de jueves","de viernes","de sábado"][new Date().getDay()]), []); break;
    case "start-routine": { const r = S.routines.find(x=>x.id===el.dataset.id); if (r) startWorkout(r.name, r.exercises.map(x=>{ const p = prevFor(x.name); return {name:x.name, sets:blankSets(x.sets, p?.map(s=>s.t))}; })); break; }
    case "repeat-workout": { const w = S.workouts.find(x=>x.id===el.dataset.id); closeSheet(); if (w) startWorkout(w.title, w.exercises.map(x=>({name:x.name, sets:blankSets(x.sets.length, x.sets.map(s=>s.t))}))); break; }
    case "add-ex": openPicker("active"); break;
    case "settype": { const s = a.exercises[ei].sets[si]; s.t = {n:"w",w:"f",f:"d",d:"n"}[s.t]; saveActive(); render(); break; }
    case "useprev": { const p = (prevFor(a.exercises[ei].name)||[])[si]; if (p){ const s = a.exercises[ei].sets[si]; s.kg = String(r1(p.kg)); s.reps = String(p.reps); saveActive(); render(); } break; }
    case "check": { const s = a.exercises[ei].sets[si]; const p = (prevFor(a.exercises[ei].name)||[])[si];
      if (!s.done){ if (s.kg==="" && p) s.kg = String(r1(p.kg)); if (s.reps==="" && p) s.reps = String(p.reps);
        if (!(+s.reps>0)){ const r = $(`rp-${ei}-${si}`); r?.focus(); return; }
        s.done = true; try { audio ||= new (window.AudioContext||window.webkitAudioContext)(); } catch {} const sec = restOf(a.exercises[ei], s); if (sec>0) startRest(sec, ei, si); }
      else { s.done = false; if (rest && rest.ei===ei && rest.si===si) stopRest(); }
      saveActive(); render(); break; }
    case "delset": a.exercises[ei].sets.splice(si,1); saveActive(); render(); break;
    case "addset": { const sets = a.exercises[ei].sets, last = sets[sets.length-1]; sets.push({t:"n", kg:last?.kg??"", reps:last?.reps??"", done:false}); saveActive(); render(); break; }
    case "ex-remove": a.exercises.splice(ei,1); saveActive(); render(); break;
    case "ex-up": { const x = a.exercises.splice(ei,1)[0]; a.exercises.splice(ei-1,0,x); saveActive(); render(); break; }
    case "finish": finishWorkout(); break;
    case "watch-paste": openWatchPaste(); break;
    case "wizard": openGoalWizard(false); break;
    case "admin": openAdmin(); break;
    case "adm-grant": admDo("grant", {user_id:el.dataset.id, months:+el.dataset.m}, el); break;
    case "adm-gift": admDo("grant", {user_id:el.dataset.id, forever:true}, el); break;
    case "adm-revoke": admDo("revoke", {user_id:el.dataset.id}, el); break;
    case "copy": { const v = el.dataset.v, done = () => { const t = el.textContent; el.textContent = "Copiado ✓"; setTimeout(() => el.textContent = t, 1500); };
      try { navigator.clipboard.writeText(v).then(done, () => {}); } catch {} break; }
    case "wizard-save": { const v = wizardVals(), g = calcGoals(v); if (!g) break;
      put("settings", {...S.settings, kcal:g.kcal, p:g.p, c:g.c, f:g.f, onboarded:true, profile:v});
      if (v.w && !S.body[today()]) put("body", {log:{...S.body, [today()]:{kg:r1(v.w)}}});
      closeSheet(); tab = "food"; render(); setBanner(`Objetivo guardado: ${fmt(g.kcal)} kcal y ${g.p} g de proteína al día.`); setTimeout(() => setBanner(""), 5000); break; }
    case "logout": sb.auth.signOut(); break;
    case "wipe": $("wipeBox").innerHTML = `<div class="confirm"><span style="flex:1">Se borrarán todos tus entrenos, comidas, rutinas y vídeos. No se puede deshacer.</span><button class="btn danger" data-act="wipe-yes">Borrar todo</button><button class="btn ghost" data-act="tab" data-tab="profile">Cancelar</button></div>`; break;
    case "delacc": $("wipeBox").innerHTML = `<div class="confirm"><span style="flex:1">Se eliminará tu cuenta con todos tus entrenos, comidas, rutinas y vídeos. No se puede deshacer.</span><button class="btn danger" data-act="delacc-yes">Eliminar cuenta</button><button class="btn ghost" data-act="tab" data-tab="profile">Cancelar</button></div>`; break;
    case "delacc-yes": el.disabled = true; deleteAccount().then(r => { if (r.ok){ localStorage.clear(); location.reload(); } else setBanner(r.code==="disabled" ? "El borrado de cuenta aún no está configurado. Escribe al contacto de la política de privacidad." : "No se pudo eliminar la cuenta. Inténtalo otra vez."); }); break;
    case "wipe-yes": el.disabled = true; deleteAllData().then(ok => { if (ok) location.reload(); else setBanner("No se pudo borrar todo. Inténtalo otra vez."); }); break;
    case "open-lib": openLibrary(); break;
    case "lib-f": c.f = el.dataset.f; drawLibrary(); break;
    case "lib-new": { const n = (c.q||"").trim(); routineDraft = null; openSheet("Crear ejercicio", `<label class="f">Nombre<input id="newExName" value="${esc(n)}" placeholder="Remo en máquina"></label>
      <label class="f">Grupo muscular<select id="newExMuscle">${MUSCLES.map(m=>`<option>${m}</option>`).join("")}</select></label><span class="msg" id="newExMsg" hidden></span>
      <button class="btn" data-act="lib-create">Crear</button>`, {kind:"newex", prev:c}); break; }
    case "lib-create": { const n = $("newExName").value.trim(), m = $("newExMuscle").value; const em = $("newExMsg");
      if (!n){ em.textContent = "Escribe un nombre."; em.hidden = false; break; } if (allExerciseNames().all.includes(n)){ em.textContent = "Ya existe un ejercicio con ese nombre."; em.hidden = false; break; }
      put("exlib", {list:[...S.exlib, {name:n, muscle:m}]}).then(()=>{ openExInfo(n, "lib"); sheetCtx.prev = {kind:"lib", q:"", f:"all"}; }); break; }
    case "open-review": openReview(); break;
    case "rv-apply": applyReview(); break;
    case "ex-sug": $("exNewName").value = el.dataset.v; $("exMuscle").value = muscleOf(el.dataset.v); break;
    case "ex-rename": { const oldN = c.name, newN = $("exNewName").value.trim(), m = $("exMuscle").value, from = c.from, prev = c.prev, msg = $("renMsg");
      if (!newN){ msg.textContent = "Escribe un nombre."; break; } el.disabled = true; msg.textContent = "Guardando…";
      renameExercise(oldN, newN, m, (i,n)=>{ msg.textContent = `Actualizando entrenos ${i} de ${n}…`; }).then(()=>{ render(); openExInfo(newN, from); sheetCtx.prev = prev; const r = $("renMsg"); if (r) r.textContent = "Guardado."; }); break; }
    case "edit-workout": openWorkoutEditor(el.dataset.id); break;
    case "we-type": { syncWE(); const s = c.w.exercises[+el.dataset.ei].sets[+el.dataset.si]; s.t = {n:"w",w:"f",f:"d",d:"n"}[s.t]; openWorkoutEditor(c.w.id, c.w); break; }
    case "we-delset": syncWE(); c.w.exercises[+el.dataset.ei].sets.splice(+el.dataset.si,1); openWorkoutEditor(c.w.id, c.w); break;
    case "we-addset": { syncWE(); const sets = c.w.exercises[+el.dataset.ei].sets, l = sets[sets.length-1]; sets.push({t:"n", kg:l?.kg||0, reps:l?.reps||0}); openWorkoutEditor(c.w.id, c.w); break; }
    case "we-delex": syncWE(); c.w.exercises.splice(+el.dataset.ei,1); openWorkoutEditor(c.w.id, c.w); break;
    case "we-addex": syncWE(); { const w = c.w; openPicker("wedit"); sheetCtx.wdraft = w; } break;
    case "we-save": { syncWE(); const w = c.w; w.exercises = w.exercises.map(e=>({...e, sets:e.sets.map(s=>({t:s.t, kg:parseNum(s.kg), reps:r0(parseNum(s.reps))}))})).filter(e=>e.sets.length);
      w.title = w.title.trim() || "Entreno"; put("w-"+w.id, w); render(); openWorkout(w.id); break; }
    case "shortcut-guide": openShortcutGuide(); break;
    case "copy-link": { const inp = $("appLink"), m = $("copyMsg");
      try { navigator.clipboard.writeText(APP_LINK).then(()=>{ m.textContent = "Enlace copiado."; }, ()=>{ inp.select(); m.textContent = "Mantén pulsado el enlace y elige Copiar."; }); }
      catch { inp.select(); m.textContent = "Mantén pulsado el enlace y elige Copiar."; } break; }
    case "ex-info": openExInfo(el.dataset.name, el.dataset.from); if (el.dataset.from==="picker"||el.dataset.from==="lib") sheetCtx.prev = c; break;
    case "ex-info-back": { const p = c.prev; if (c.from==="lib"){ openLibrary(p); break; } openSheet("Añadir ejercicio", `<input id="pkSearch" placeholder="Buscar ejercicio" autocomplete="off" aria-label="Buscar ejercicio" value="${esc(p.filter)}"><div class="chips" id="pkChips"></div><div id="pkList"></div><button class="btn" id="pkGo" data-act="picker-confirm" disabled>Añadir</button>`, p); drawPicker(); break; }
    case "vid-del": $("vidDel").innerHTML = `<div class="confirm"><span style="flex:1">¿Quitar el vídeo de este ejercicio?</span><button class="btn danger" data-act="vid-del-yes">Quitar</button></div>`; break;
    case "vid-del-yes": { const old = S.media[c.name]; const map = {...S.media}; delete map[c.name]; put("media", {map});
      if (old?.id && assets && !Object.values(map).some(v=>v.id===old.id)) assets.delete(old.id).catch(()=>{}); const prev = c.prev; openExInfo(c.name, c.from); sheetCtx.prev = prev; render(); break; }
    case "discard": $("discardBox").innerHTML = `<div class="confirm"><span style="flex:1">¿Descartar este entreno? Se perderán las series.</span><button class="btn danger" data-act="discard-yes">Descartar</button><button class="btn ghost" data-act="discard-no">Seguir</button></div>`; break;
    case "discard-no": render(); break;
    case "discard-yes": clearTimeout(saveT); stopRest(); S.active = null; del("active"); render(); break;
    case "rest-minus": if (rest){ rest.end -= 15000; tick(); } break;
    case "rest-plus": if (rest){ rest.end += 15000; rest.total += 15000; tick(); } break;
    case "rest-skip": stopRest(); break;
    case "ex-rest": openRestPicker(ei, -1); break;
    case "set-rest": openRestPicker(ei, si); break;
    case "rest-pick": { const v = +el.dataset.v, e2 = S.active.exercises[c.ei];
      if (c.si>=0){ e2.sets[c.si].rest = v; if (rest && rest.ei===c.ei && rest.si===c.si){ if (v>0){ const used = rest.total-(rest.end-Date.now()); rest.total = v*1000; rest.end = Date.now()+Math.max(0, v*1000-used); } else stopRest(); } }
      else { e2.rest = v; put("settings", {...S.settings, restByEx:{...(S.settings.restByEx||{}), [e2.name]:v}}); }
      saveActive(); closeSheet(); render(); break; }
    case "rest-all": { const e2 = S.active.exercises[c.ei], v = restOf(e2, e2.sets[c.si]); e2.rest = v; e2.sets.forEach(x=>delete x.rest);
      put("settings", {...S.settings, restByEx:{...(S.settings.restByEx||{}), [e2.name]:v}}); saveActive(); closeSheet(); render(); break; }
    case "open-workout": openWorkout(el.dataset.id); break;
    case "del-workout": $("wDel").innerHTML = `<div class="confirm"><span style="flex:1">¿Borrar este entreno para siempre?</span><button class="btn danger" data-act="del-workout-yes" data-id="${esc(el.dataset.id)}">Borrar</button></div>`; break;
    case "del-workout-yes": del("w-"+el.dataset.id); closeSheet(); render(); break;
    case "routine-from": { const w = S.workouts.find(x=>x.id===el.dataset.id); if (!w) break;
      routineDraft = {isNew:true, id:rid(), name:w.title, exercises:w.exercises.map(x=>({name:x.name, sets:x.sets.filter(s=>s.t!=="w").length||x.sets.length}))}; openRoutineEditor(); break; }
    /* rutinas */
    case "new-routine": routineDraft = {isNew:true, id:rid(), name:"", exercises:[]}; openRoutineEditor(); break;
    case "edit-routine": { const r = S.routines.find(x=>x.id===el.dataset.id); if (r){ routineDraft = JSON.parse(JSON.stringify(r)); openRoutineEditor(); } break; }
    case "rd-add": syncDraftName(); openPicker("routine"); break;
    case "rd-minus": syncDraftName(); routineDraft.exercises[+el.dataset.i].sets = Math.max(1, routineDraft.exercises[+el.dataset.i].sets-1); openRoutineEditor(); break;
    case "rd-plus": syncDraftName(); routineDraft.exercises[+el.dataset.i].sets++; openRoutineEditor(); break;
    case "rd-remove": syncDraftName(); routineDraft.exercises.splice(+el.dataset.i,1); openRoutineEditor(); break;
    case "rd-save": { syncDraftName(); const {isNew, ...r} = routineDraft; r.name = r.name.trim() || "Rutina"; delete r.example;
      put("routines", {list:[...S.routines.filter(x=>x.id!==r.id), r]}); closeSheet(); tab = "train"; render(); break; }
    case "rd-delete": $("rdDel").innerHTML = `<div class="confirm"><span style="flex:1">¿Borrar la rutina?</span><button class="btn danger" data-act="rd-delete-yes">Borrar</button></div>`; break;
    case "rd-delete-yes": put("routines", {list:S.routines.filter(x=>x.id!==routineDraft.id)}); closeSheet(); render(); break;
    /* selector */
    case "pk-toggle": { const n = el.dataset.name, i = c.sel.indexOf(n); i>=0 ? c.sel.splice(i,1) : c.sel.push(n); drawPicker(); break; }
    case "pk-muscle": c.muscle = el.dataset.m; drawPicker(); break;
    case "pk-create": { const n = c.filter.trim(); if (!n) break; const m = c.muscle || muscleOf(n); put("exlib", {list:[...S.exlib, {name:n, muscle:m}]}); c.sel.push(n); c.filter = ""; $("pkSearch").value = ""; drawPicker(); break; }
    case "picker-confirm": pickerConfirm(); break;
    /* diario */
    case "day-prev": day = addDays(day,-1); render(); break;
    case "day-next": day = addDays(day,1); render(); break;
    case "day-today": day = today(); render(); break;
    case "nutri-sub": nutriSub = el.dataset.k; render(); break;
    case "nutri-range": nutriRange = el.dataset.k; render(); break;
    case "nutri-detail": openNutriDetail(el.dataset.k); break;
    case "add-food": openAddFood(el.dataset.meal); break;
    case "plan-edit": openPlanEditor(+el.dataset.d || wdayOf(day)); break;
    case "plan-day": openPlanEditor(+el.dataset.d); break;
    case "plan-pick": openPlanPicker(c.n, el.dataset.m); break;
    case "plan-back": openPlanEditor(c.n); break;
    case "plan-pick-food": { const x = c.list[+el.dataset.i]; planAddFood(c.n, c.m, x, x.servings?.[0]?.g || 100); break; }
    case "plan-create": { const name = $("ppN").value.trim(), k = parseNum($("ppK").value), msg = $("ppMsg");
      if (!name || !(k>0)){ msg.textContent = "Pon al menos el nombre y las kcal por 100 g."; msg.hidden = false; break; }
      const x = {name, kcal:k, p:parseNum($("ppP").value), c:parseNum($("ppC").value), f:parseNum($("ppF").value), servings:[]};
      put("foods", {list:[...S.foods.filter(y=>y.name!==name), x]}); planAddFood(c.n, c.m, x, parseNum($("ppG").value) || 100); break; }
    case "plan-del": S.plan[c.n][el.dataset.m].splice(+el.dataset.i, 1); savePlan(); openPlanEditor(c.n); break;
    case "plan-copy": $("planCopy").innerHTML = `<div class="card stack"><b>Copiar el ${WDAYS[c.n-1].toLowerCase()} a:</b><div class="chips" style="flex-wrap:wrap">${WDAYS.map((w,i)=>i+1===c.n?"":`<label class="chip"><input type="checkbox" data-cp="${i+1}" style="width:auto;margin-right:4px">${w}</label>`).join("")}</div>
      <p class="note">Se sustituye lo que hubiera planificado esos días.</p><button class="btn" data-act="plan-copy-yes">Copiar</button></div>`; break;
    case "plan-copy-yes": { const src = JSON.stringify(planDay(c.n)); document.querySelectorAll("[data-cp]:checked").forEach(cb => { S.plan[cb.dataset.cp] = JSON.parse(src); }); savePlan(); openPlanEditor(c.n); break; }
    case "plan-opt": planDraft[day+"|"+el.dataset.m+"|opt"] = el.dataset.o; render(); break;
    case "plan30-off": el.parentElement.innerHTML = `¿Quitar el plan mensual? Lo ya apuntado se queda. <button class="link" data-act="plan30-off-yes">Quitar</button>`; break;
    case "plan30-off-yes": S.planDates = null; del("plandates"); render(); break;
    case "plan-undo": S.diary[day] = (S.diary[day]||[]).filter(e => e.id !== el.dataset.id); putDay(day); render(); break;
    case "plan-one": { const m = el.dataset.m, i = +el.dataset.i, f = curPlan(day)[m]?.[i]; if (f){ logPlan(m, [[f,i]]); putDay(day); render(); if (!MEALS.some(mm => planPending(mm).length)) confetti(); } break; }
    case "plan-add": logPlan(el.dataset.m, planPending(el.dataset.m)); putDay(day); render(); break;
    case "plan-add-all": MEALS.forEach(m => logPlan(m, planPending(m))); putDay(day); render(); confetti(); break;
    case "copy-yesterday": { const m = el.dataset.meal; const list = (S.diary[addDays(day,-1)]||[]).filter(x=>x.meal===m).map(({id,ex,...x})=>x); addEntries(m, list); break; }
    case "edit-entry": openEditEntry(el.dataset.id); break;
    case "ftab": stopScan(); c.t = el.dataset.t; c.food = null; drawFood(); break;
    case "scan-lookup": { const v = ($("scanCode").value||"").replace(/\D/g,""); if (v.length >= 8) lookupBarcode(v); else $("scanMsg").textContent = "El código tiene que tener al menos 8 números."; break; }
    case "pick-food": c.food = c.list[+el.dataset.i]; c.qty = null; c.unit = null; drawFoodDetail(); break;
    case "food-back": c.food = null; drawFood(); break;
    case "food-add": { const v = foodCalc(); if (!(v.g>0)) break; const x = c.food;
      const entry = {name:x.name, qty:v.qty, unit:v.unit, g:v.g, per:{kcal:x.kcal,p:x.p,c:x.c,f:x.f, ...(x.m?{m:x.m}:{})}, servings:x.servings||[], kcal:v.kcal, p:v.p, c:v.c, f:v.f};
      if (c.editId){ const L = S.diary[day]; const i = L.findIndex(z=>z.id===c.editId); if (i>=0) L[i] = {...L[i], ...entry}; putDay(day); closeSheet(); render(); }
      else { addEntries(c.meal, [entry]); closeSheet(); } break; }
    case "quick-add": { const k = parseNum($("qK").value); if (!(k>0)){ const m = $("qMsg"); m.textContent = "Escribe las calorías."; m.hidden = false; break; }
      addEntries(c.meal, [{name:$("qName").value.trim()||"Añadido rápido", kcal:k, p:parseNum($("qP").value), c:parseNum($("qC").value), f:parseNum($("qF").value)}]); closeSheet(); break; }
    case "create-food": { const name = $("cName").value.trim(), k = parseNum($("cK").value);
      if (!name || !(k>0)){ const m = $("cMsg"); m.textContent = "Pon al menos el nombre y las kcal por 100 g."; m.hidden = false; break; }
      const sg = parseNum($("cSg").value); const f = {name, kcal:k, p:parseNum($("cP").value), c:parseNum($("cC").value), f:parseNum($("cF").value), servings: sg>0 ? [{n:$("cSn").value.trim()||"ración", g:sg}] : []};
      put("foods", {list:[...S.foods.filter(x=>x.name!==name), f]}); c.t = "search"; c.food = f; c.qty = null; c.unit = null; drawFood(); break; }
    case "ai-run": runAI(); break;
    case "ai-add": addEntries(c.meal, (c.ai||[]).map(i=>({name:i.name, qty:i.g, unit:"g", kcal:i.kcal, p:i.p, c:i.c, f:i.f, src:"estimado con IA"}))); closeSheet(); break;
    case "entry-save": { const L = S.diary[day], i = L.findIndex(z=>z.id===c.editId); if (i>=0) L[i] = {...L[i], name:$("eN").value.trim()||L[i].name, kcal:parseNum($("eK").value), p:parseNum($("eP").value), c:parseNum($("eC").value), f:parseNum($("eF").value)};
      putDay(day); closeSheet(); render(); break; }
    case "entry-del": S.diary[day] = (S.diary[day]||[]).filter(z=>z.id!==c.editId); putDay(day); closeSheet(); render(); break;
    /* progreso */
    case "metric": metric = el.dataset.m; render(); break;
    /* perfil */
    case "imp-confirm": runImport(); break;
    case "imp-cancel": importState = null; render(); break;
    case "export-json": exportJSON(); break;
    case "export-w": exportW(); break;
    case "export-f": exportF(); break;
    case "load-ex": loadExamples(); break;
    case "clear-ex": clearExamples(); break;
  }
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.f && S.active){ const row = t.closest("[data-ei]"); const s = S.active.exercises[+row.dataset.ei].sets[+row.dataset.si]; s[t.dataset.f] = t.value; updateLiveStats(); saveActive(); }
  else if (t.id==="wTitle" && S.active){ S.active.title = t.value; saveActive(); }
  else if (t.id==="pkSearch"){ sheetCtx.filter = t.value; drawPicker(); }
  else if (t.id==="admQ"){ sheetCtx.q = t.value; drawAdmin(); }
  else if (t.id==="libSearch"){ sheetCtx.q = t.value; drawLibrary(); }
  else if (t.dataset.we){ const [ei,si,f] = t.dataset.we.split(":"); sheetCtx.w.exercises[+ei].sets[+si][f] = t.value; }
  else if (t.id==="fq"){ sheetCtx.q = t.value; drawFoodResults(); }
  else if (t.id==="fdQ"){ updateFoodDetail(); }
  else if (t.dataset.pl){ planDraft[t.dataset.pl] = t.value; updatePlanRow(t.dataset.pl); }
  else if (t.dataset.pe){ const [n,m,i] = t.dataset.pe.split("|"); const it = S.plan[n]?.[m]?.[+i]; if (it){ it.g = parseNum(t.value); clearTimeout(window._pe); window._pe = setTimeout(savePlan, 600); } }
  else if (t.id==="ppq"){ sheetCtx.q = t.value; drawPlanPicker(); }
  else if (["wSex","wAge","wH","wW","wAct","wGoal"].includes(t.id)){ updateWizard(); }
  else if (t.id==="hPaste"){ const v = parseWatchText(t.value); if (v){ $("hSteps").value = v.steps||""; $("hKcal").value = v.kcal||""; $("hDate").value = v.date; } }
  else if (t.id==="wPaste"){ clearTimeout(window._wp); window._wp = setTimeout(()=>handleWatchPaste(t.value), 400); }
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.id==="fdU"){ const c = sheetCtx, x = c.food, gOf = u => u==="g" ? 1 : (x.servings.find(s=>s.n===u)?.g||1);
    const grams = parseNum($("fdQ").value) * gOf(c.curUnit); c.curUnit = t.value;
    $("fdQ").value = r1(grams/gOf(t.value)) || (t.value==="g"?100:1); updateFoodDetail(); }
  else if (t.id==="progEx"){ progEx = t.value; render(); }
  else if (t.id==="exVid" && t.files?.[0]){ const prev = sheetCtx.prev; await uploadVideo(t.files[0]); if (sheetCtx) sheetCtx.prev ||= prev; }
  else if (t.id==="scanPhoto" && t.files?.[0]){ stopScan(); scanPhoto(t.files[0]); t.value = ""; }
  else if (t.id==="impH" && t.files?.[0]){ parseHealthFile(t.files[0]); }
  else if (t.id==="gAddEx" || t.id==="gSteps"){ await put("settings", {...S.settings, addEx:$("gAddEx").checked, stepGoal:Math.max(0,parseNum($("gSteps").value))||10000}); }
  else if (t.type==="file" && t.id!=="exVid" && t.files?.[0]){ const f = t.files[0]; const text = await f.text();
    importState = t.id==="impW" ? importWorkoutsCSV(text, f.name) : t.id==="impF" ? importFoodCSV(text, f.name) : importJSON(text, f.name);
    if (t.id==="impPlan"){ closeSheet(); tab = "profile"; }
    render(); document.querySelector(".imp")?.scrollIntoView({block:"center"}); }
});
document.addEventListener("submit", async e => {
  e.preventDefault();
  if (e.target.id==="fGoals"){ const g = {kcal:parseNum($("gKcal").value)||2200, p:parseNum($("gP").value), c:parseNum($("gC").value), f:parseNum($("gF").value), days:Math.min(7,Math.max(1,parseNum($("gDays").value)||4)), rest:Math.max(0,parseNum($("gRest").value)), stepGoal:S.settings.stepGoal||10000, addEx:!!S.settings.addEx, restByEx:S.settings.restByEx||{}};
    const ok = await put("settings", {...S.settings, ...g}); const m = $("goalMsg"); if (m) m.textContent = ok ? "Objetivos guardados." : "No se pudieron guardar."; }
  if (e.target.id==="fHealth"){ const d = $("hDate").value || today(), st = r0(parseNum($("hSteps").value)), kc = r0(parseNum($("hKcal").value)); const m = $("hMsg");
    if (!(st>0) && !(kc>0)){ m.textContent = "Escribe los pasos o las calorías, o pega lo que copió el atajo."; return; }
    const ok = await mergeHealth({days:{[d]:{steps:st || S.health.days[d]?.steps || 0, kcal:kc || S.health.days[d]?.kcal || 0}}, wos:[]});
    m.textContent = ok ? `Guardado: ${fmt(st)} pasos y ${fmt(kc)} kcal activas el ${dayLabel(d).toLowerCase()}.` : "No se pudo guardar."; return; }
  if (e.target.id==="fPass"){ const v = $("newPass").value, m = $("passMsg"); if (v.length<6){ m.textContent = "Usa al menos 6 caracteres."; return; }
    const { error } = await sb.auth.updateUser({password:v}); m.textContent = error ? "No se pudo cambiar. Inténtalo otra vez." : "Contraseña cambiada."; if (!error) $("newPass").value = ""; return; }
  if (e.target.id==="fWeight"){ const kg = parseNum($("bwIn").value); if (kg>0){ await put("body", {log:{...S.body, [today()]:{kg:r1(kg)}}}); render(); } }
});
document.addEventListener("keydown", e => { if (e.key==="Escape" && !$("sheet").hidden) closeSheet(); });

function checkHash(){ if (location.hash==="#watch") clearHash(); }
window.addEventListener("hashchange", checkHash);
init();
})();
