// BEINGHEALTHY · Cada deporte como una app propia: Hoy, Plan, Calendario, Carreras y Datos (resumen, estadísticas y zonas).
import { COACH, DAY_N, TIPS, makeCoachPlan, adaptWeek, goalFromRace, goalName, describeEnd } from "./coach.js";

let C = null;                                   // utilidades de main.js
export function spInit(ctx) { C = ctx; }

export const SP_COLOR = { run: "#FF6B35", trail: "#3FA34D", bike: "#E9A825", swim: "#2FA4E7", hike: "#A1785C", padel: "#1FB5A3", tennis: "#9DBA2A", football: "#2E9E5B", basket: "#F07B2B", boxing: "#E5383B" };
const TYPES = { run: ["run"], trail: ["trail"], bike: ["bike", "mtb"], swim: ["swim", "swimow"], hike: ["hike", "walk"], padel: ["padel"], tennis: ["tennis"], football: ["football"], basket: ["basket"], boxing: ["boxing"] };
const isEnd = (k) => COACH[k]?.kind === "end";
const hasElev = (k) => k === "trail" || k === "hike" || k === "bike";
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MON3 = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

let st = { tab: "hoy", data: "res", per: "w", off: 0, cal: 0, day: null, week: null, edit: false };
export function spEnter() { st = { ...st, tab: "hoy", data: "res", per: "w", off: 0, cal: 0, day: null, week: null, edit: false }; }

/* ---------- utilidades ---------- */
export function sportOf(a) {
  if (a.csport) return a.csport;
  for (const [k, l] of Object.entries(TYPES)) if (l.includes(a.type)) return k;
  const t = String(a.type || "");
  if (/trail/i.test(t)) return "trail";
  if (/run/i.test(t)) return "run";
  if (/ride|cycl|bik|mtb|gravel/i.test(t)) return "bike";
  if (/swim/i.test(t)) return "swim";
  if (/hik|walk/i.test(t)) return "hike";
  if (/soccer|football/i.test(t)) return "football";
  if (/padel/i.test(t)) return "padel";
  if (/tennis/i.test(t)) return "tennis";
  if (/basket/i.test(t)) return "basket";
  if (/box/i.test(t)) return "boxing";
  return "";
}
const actsOf = (k) => C.allActs().filter((a) => sportOf(a) === k);
const hms = (sec) => { sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`; };
const parseT = (s) => { const p = String(s || "").trim().split(":").map(Number); if (!p.length || p.some(isNaN) || !String(s).trim()) return 0; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60; };
const paceS = (secPerKm) => secPerKm > 0 ? `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, "0")}` : "—";
const km2 = (x) => String((Math.round((+x || 0) * 10) / 10)).replace(".", ",");
const zonesOf = (k) => C.S.zones?.[k] || {};
const hrMax = (k) => +zonesOf(k).hrmax || +Object.values(C.S.zones || {}).find((z) => z.hrmax)?.hrmax || 0;

/* ---------- carga (sRPE) ---------- */
export function loadOf(a, k) {
  const mx = hrMax(k);
  const rpe = +a.rpe || (a.hr && mx ? Math.max(2, Math.min(10, Math.round((a.hr / mx - 0.5) * 20))) : 5);
  return ((+a.dur || 0) / 60) * rpe;
}
export function loadState(k) {
  const { today, addDays } = C, acts = actsOf(k), byDay = {};
  for (const a of acts) byDay[a.day] = (byDay[a.day] || 0) + loadOf(a, k);
  let ctl = 0, atl = 0; const kc = 1 - Math.exp(-1 / 42), ka = 1 - Math.exp(-1 / 7), t = today(), hist = [];
  for (let i = 120; i >= 0; i--) { const d = addDays(t, -i), l = byDay[d] || 0; ctl += (l - ctl) * kc; atl += (l - atl) * ka; if (i < 42) hist.push({ d, ctl, atl }); }
  const ratio = ctl > 0 ? atl / ctl : 0, w7 = Object.entries(byDay).filter(([d]) => d > addDays(t, -7)).reduce((a, [, l]) => a + l, 0);
  let s;
  if (ctl < 8) s = { k: "none", n: "Pocos datos", c: "var(--muted)", msg: "Registra tus entrenos (con su esfuerzo del 1 al 10) y tu coach irá ajustando el plan a tu carga." };
  else if (ratio > 1.5) s = { k: "risk", n: "Carga muy alta", c: "#E8364F", msg: "Has subido la carga muy rápido. Esta semana el plan es más suave y sin series para evitar lesiones." };
  else if (ratio > 1.3) s = { k: "high", n: "Cargado", c: "#F08A24", msg: "Llevas mucha carga. He bajado un poco el volumen de esta semana." };
  else if (ratio >= 0.8) s = { k: "ok", n: "Óptimo", c: "#2BB673", msg: "Tu carga está en la zona buena para mejorar. Sigue el plan tal cual." };
  else s = { k: "fresh", n: "Fresco", c: "#4A8CFF", msg: "Estás descansado. Si vas cumpliendo, el plan sube un poco." };
  return { ctl, atl, tsb: ctl - atl, ratio, w7, s, hist };
}
function compliance(k) {
  const P = C.S.scoach?.[k]; if (!P) return null; const w = curWeek(P) - 1; if (w < 0 || !P.weeks[w]) return null;
  const n = P.weeks[w].sessions.length; return n ? P.weeks[w].sessions.filter((_, i) => isDone(k, w, i)).length / n : null;
}
export function adjFor(k) {
  const L = loadState(k), cp = compliance(k);
  if (L.s.k === "risk") return { f: 0.75, easy: true, why: L.s.msg };
  if (L.s.k === "high") return { f: 0.85, why: L.s.msg };
  if (cp != null && cp < 0.5) return { f: 0.9, why: "La semana pasada hiciste menos de la mitad: retomamos poco a poco." };
  if (L.s.k === "fresh" && cp != null && cp >= 0.75) return { f: 1.08, why: "Vas fresco y cumpliendo: subo un poco el volumen." };
  return { f: 1 };
}
const curWeek = (P) => Math.floor((C.parseDay(C.today()) - C.parseDay(P.start)) / (7 * 864e5));
export function weekSessions(k, w) {
  const P = C.S.scoach?.[k]; if (!P?.weeks[w]) return [];
  return withKm(k, P, w, rawWeek(k, P, w));
}
function rawWeek(k, P, w) {
  const cw = curWeek(P); if (w !== cw && w !== cw + 1) return P.weeks[w].sessions;
  const a = adjFor(k); if (a.f === 1 && !a.easy) return P.weeks[w].sessions;
  const ad = adaptWeek(P, w, a), t = C.today();
  return P.weeks[w].sessions.map((x, i) => { const day = C.addDays(P.start, w * 7 + x.d); return day < t || isDone(k, w, i) ? x : ad[i]; });
}
/* ---------- kilómetros de cada sesión ---------- */
const DEF_PACE = { run: { beg: 420, mid: 360, adv: 315 }, trail: { beg: 540, mid: 450, adv: 390 }, hike: { beg: 900, mid: 780, adv: 690 },
  bike: { beg: 180, mid: 144, adv: 124 }, swim: { beg: 1650, mid: 1300, adv: 1050 } };   // s/km (bici: 20/25/29 km/h; natación: 2:45/2:10/1:45 por 100 m)
// ritmo suave (segundos por km): tus últimos entrenos > tus zonas > tu nivel
export function paceFor(k) {
  const since = C.addDays(C.today(), -60), L = actsOf(k).filter((a) => a.day >= since && a.km > 0.3 && a.dur > 0).map((a) => a.dur / a.km).sort((a, b) => a - b);
  if (L.length >= 3) return { s: L[Math.floor(L.length / 2)], src: "tus últimos entrenos" };
  const Z = zonesOf(k);
  if ((k === "run" || k === "trail") && Z.thr) return { s: Z.thr * 1.2 * (k === "trail" ? 1.3 : 1), src: "tu ritmo umbral" };
  if (k === "swim" && Z.css) return { s: Z.css * 10 * 1.12, src: "tu CSS" };
  if (k === "bike" && Z.ftp && C.sportKg()) { const wkg = Z.ftp / C.sportKg(); return { s: 3600 / Math.max(18, Math.min(34, 16 + wkg * 3)), src: "tu FTP" }; }
  const lv = C.S.scoach?.[k]?.req?.level || "mid"; return { s: DEF_PACE[k]?.[lv] || 360, src: "tu nivel" };
}
const FACT = { E: 1, R: 1.08, L: 1.03, Q: 0.93 };
function kmFrom(k, mins, t, base) { const f = FACT[t] || 1, km = mins * 60 / (base * f * (k === "trail" && t === "L" ? 1.1 : 1)); return k === "swim" ? Math.max(0.1, Math.round(km * 20) / 20) : k === "bike" ? Math.round(km) : Math.max(0.5, Math.round(km * 2) / 2); }
export const kmTxt = (k, km) => k === "swim" ? `${Math.round(km * 1000).toLocaleString("es-ES")} m` : `${String(km).replace(".", ",")} km`;
function withKm(k, P, w, list) {
  if (!isEnd(k)) return list;
  const base = paceFor(k).s, phase = P.weeks[w].phase.replace(" · descarga", ""), { goal, level } = P.req;
  return list.map((x) => {
    if (x.t === "S") return x;
    if (x.t === "RACE") { const r = racesOf(k).find((r) => r.date === C.addDays(P.start, w * 7 + x.d)); return r?.km ? { ...x, km: r.km } : x; }
    const amt = (m) => kmTxt(k, kmFrom(k, m, "E", base));
    let km = kmFrom(k, x.dur, x.t, base);
    if (k === "swim" && (x.t === "E" || x.t === "Q")) {          // natación: la distancia es la suma de las series de la sesión
      const [, d0] = describeEnd(k, x.t, phase, x.dur, goal, w, level, () => "");
      let tot = 0; const rest = d0.replace(/(\d+)×(\d+) m/g, (_, a, b) => { tot += a * b; return ""; }); rest.replace(/(\d[\d.]*) m\b/g, (_, a) => { tot += +a.replace(".", ""); return ""; });
      if (tot) km = tot / 1000;
    }
    const [title, desc] = describeEnd(k, x.t, phase, x.dur, goal, w, level, (m) => m === x.dur ? kmTxt(k, km) : amt(m));
    return { ...x, title, desc: desc.replace(/^: /, ""), km };
  });
}
const amountOf = (k, x) => x.km ? kmTxt(k, x.km) : x.dur ? C.fmtMin(x.dur * 60) : "";

/* ---------- sesiones hechas ---------- */
const key = (k, w, i) => `${k}|${w}|${i}`;
export function isDone(k, w, i) { return !!C.S.scoach?.[k]?.done?.[key(k, w, i)]; }
export function setDone(k, w, i, force) {
  const P = C.S.scoach?.[k]; if (!P) return; const done = { ...(P.done || {}) }, kk = key(k, w, i);
  if (force || !done[kk]) done[kk] = Date.now(); else delete done[kk];
  return C.put("sportcoach", { plans: { ...C.S.scoach, [k]: { ...P, done } } });
}
// al registrar un entreno, marca la sesión del plan de ese día
export function autoMark(k, day) {
  const P = C.S.scoach?.[k]; if (!P) return; const off = Math.floor((C.parseDay(day) - C.parseDay(P.start)) / 864e5);
  const w = Math.floor(off / 7), d = off - w * 7; if (!P.weeks[w]) return;
  const i = P.weeks[w].sessions.findIndex((x, j) => x.d === d && !isDone(k, w, j) && x.t !== "RACE"); if (i >= 0) setDone(k, w, i, true);
}
// sesiones planificadas de un día (para el calendario y «Hoy»)
function plannedOn(k, day) {
  const P = C.S.scoach?.[k]; if (!P) return []; const off = Math.floor((C.parseDay(day) - C.parseDay(P.start)) / 864e5);
  if (off < 0) return []; const w = Math.floor(off / 7), d = off - w * 7; if (!P.weeks[w]) return [];
  const L = weekSessions(k, w); return L.map((x, i) => ({ x, w, i })).filter((o) => o.x.d === d);
}
export function todayFor(k) { return plannedOn(k, C.today()); }

/* ---------- carreras ---------- */
const racesOf = (k) => (C.S.races || []).filter((r) => r.sport === k);
const nextRace = (k) => racesOf(k).filter((r) => r.date >= C.today()).sort((a, b) => a.date < b.date ? -1 : 1)[0];
const daysTo = (d) => Math.round((C.parseDay(d) - C.parseDay(C.today())) / 864e5);
const RACE_W = (k) => isEnd(k) ? { one: "carrera", many: "Carreras", add: "Añadir carrera" } : k === "boxing" ? { one: "combate", many: "Combates", add: "Añadir combate" } : { one: "partido", many: "Partidos", add: "Añadir partido" };

/* ========== VISTA PRINCIPAL ========== */
export function spSubtitle(k) {
  const P = C.S.scoach?.[k], nr = nextRace(k);
  if (nr) return `🏁 ${C.esc(nr.name)} · ${daysTo(nr.date) === 0 ? "hoy" : "en " + daysTo(nr.date) + " días"}`;
  if (P) { const w = curWeek(P); return w >= P.weeks.length ? "Plan terminado" : `Semana ${Math.max(1, w + 1)} de ${P.weeks.length}`; }
  const n = actsOf(k).length; return n ? `${n} entreno${n > 1 ? "s" : ""}` : "Empieza aquí";
}
export function spView(k) {
  const Cc = COACH[k], tabs = [["hoy", "Hoy", "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"], ["plan", "Plan", "M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01"],
    ["cal", "Calendario", "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"], ["races", RACE_W(k).many, "M5 21V4h11l-2 4 2 4H5"], ["data", "Datos", "M4 20V10M10 20V4M16 20v-7M22 20H2"]];
  const body = { hoy: vHoy, plan: vPlan, cal: vCal, races: vRaces, data: vData }[st.tab](k);
  return `<div class="spapp" style="--sp:${SP_COLOR[k]}">
    <div class="sp-head"><button class="sp-back" data-act="ex-back" aria-label="Volver a Deportes">‹</button><span class="sp-ico" aria-hidden="true">${Cc.e}</span><b>${Cc.n}</b>
      <button class="sp-reg" data-act="sp-reg">+ Registrar</button></div>
    ${body}
    <nav class="spbar" aria-label="Secciones de ${Cc.n}">${tabs.map(([t, l, d]) => `<button data-act="sp-tab" data-t="${t}" ${st.tab === t ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24"><path d="${d}"/></svg>${l}</button>`).join("")}</nav></div>`;
}

/* ---------- Hoy ---------- */
function sesCard(k, o, opts = {}) {
  const { esc, fmtMin, today, addDays } = C, P = C.S.scoach[k], x = o.x, day = addDays(P.start, o.w * 7 + x.d), done = isDone(k, o.w, o.i), isT = day === today();
  return `<div class="card sc-s ${done ? "done" : ""} ${isT && !opts.noToday ? "is-today" : ""}"><div class="sc-h"><span class="sc-d"><b>${DAY_N[x.d].slice(0, 3)}</b><small>${C.parseDay(day).getDate()}</small></span>
    <div class="sc-t"><b>${esc(x.title)}</b><small>${isT ? "Hoy · " : ""}${amountOf(k, x)}${x.adj ? " · ajustada a tu carga" : ""}</small></div>
    ${x.t === "RACE" ? "" : `<button class="sc-chk" data-act="sp-done" data-w="${o.w}" data-i="${o.i}" aria-pressed="${done}" aria-label="Marcar como hecha">✓</button>`}</div>
    <p class="sc-desc">${esc(x.desc).replace(/ · /g, "<br>· ")}</p>
    ${!done && day <= today() && x.t !== "RACE" ? `<div class="sc-acts">${COACH[k].gps && !["S", "F", "F2", "M"].includes(x.t) ? `<button class="btn soft" data-act="sp-gps" data-w="${o.w}" data-i="${o.i}">▶ Grabar con GPS</button>` : ""}<button class="btn ghost" data-act="sp-reg" data-w="${o.w}" data-i="${o.i}">Registrar</button></div>` : ""}
    ${["S", "F", "F2"].includes(x.t) && !done ? `<button class="link" data-act="ex-sport" data-k="gym">Apuntar las series en Gym ›</button>` : ""}</div>`;
}
function vHoy(k) {
  const { esc, fmt, fmtMin, today, addDays } = C, P = C.S.scoach?.[k], L = loadState(k), nr = nextRace(k), A = adjFor(k);
  const tod = P ? todayFor(k) : [];
  let next = null; if (P && !tod.length) for (let i = 1; i < 14 && !next; i++) { const o = plannedOn(k, addDays(today(), i))[0]; if (o) next = { ...o, in: i }; }
  const ws = C.weekStart(today()), wActs = actsOf(k).filter((a) => a.day >= ws), wMin = wActs.reduce((a, x) => a + (+x.dur || 0), 0) / 60, wKm = wActs.reduce((a, x) => a + (+x.km || 0), 0);
  const cw = P ? curWeek(P) : -1, wPlan = P?.weeks[cw]?.sessions.length || 0, wDone = P?.weeks[cw] ? P.weeks[cw].sessions.filter((_, i) => isDone(k, cw, i)).length : 0;
  const last = actsOf(k).slice(0, 4);
  return `${nr ? `<button class="card sp-race-cd" data-act="sp-tab" data-t="races"><span class="sp-cd"><b>${daysTo(nr.date)}</b><small>días</small></span><span><small class="note">Próxima ${RACE_W(k).one}${nr.prio === "A" ? " · objetivo principal" : ""}</small><b>${esc(nr.name)}</b><small class="note">${C.dayLabel(nr.date)}${nr.km ? ` · ${km2(nr.km)} km` : ""}${nr.elev ? ` · ${nr.elev} m+` : ""}</small></span></button>` : ""}
  ${!P ? `<div class="card sp-cta"><b>Crea tu plan de ${COACH[k].n.toLowerCase()}</b><p class="note">Te preparo los entrenos de cada semana según tu objetivo, y los ajusto a la carga que llevas.</p><button class="btn" data-act="sp-tab" data-t="plan">Crear mi plan</button></div>`
    : tod.length ? `<h2 class="sp-h2">Hoy te toca</h2>${tod.map((o) => sesCard(k, o, { noToday: true })).join("")}`
    : `<div class="card"><b>Hoy toca descanso 😌</b><p class="note" style="margin:0">${next ? `Siguiente: <b>${esc(next.x.title)}</b> ${next.in === 1 ? "mañana" : `el ${DAY_N[next.x.d].toLowerCase()}`}.` : "Descansar también es entrenar."}</p></div>`}
  <div class="card"><div class="top"><h2>Tu carga</h2><span class="sp-pill" style="background:color-mix(in srgb,${L.s.c} 18%,transparent);color:${L.s.c}">${L.s.n}</span></div>
    <div class="sp-load"><div><b>${Math.round(L.ctl)}</b><span>Forma</span></div><div><b>${Math.round(L.atl)}</b><span>Fatiga</span></div><div><b>${L.tsb > 0 ? "+" : ""}${Math.round(L.tsb)}</b><span>Frescura</span></div></div>
    ${sparkLoad(L.hist)}
    <p class="note" style="margin:0">${esc(A.why || L.s.msg)}</p></div>
  <div class="card"><h2>Esta semana</h2><div class="sp-load"><div><b>${P ? `${wDone}/${wPlan}` : wActs.length}</b><span>${P ? "sesiones" : "entrenos"}</span></div><div><b>${fmtMin(wMin * 60)}</b><span>tiempo</span></div>${isEnd(k) ? `<div><b>${km2(wKm)}</b><span>km</span></div>` : `<div><b>${fmt(wActs.reduce((a, x) => a + (+x.kcal || 0), 0))}</b><span>kcal</span></div>`}</div></div>
  ${last.length ? `<div class="card"><div class="top"><h2>Últimos entrenos</h2><button class="link" data-act="sp-tab" data-t="data">Ver todo ›</button></div><div class="list">${last.map(actRow).join("")}</div></div>` : ""}
  <div class="card"><h2>Consejos de tu coach</h2>${(TIPS[k] || []).map((t) => `<p class="note" style="margin:0">• ${esc(t)}</p>`).join("")}</div>`;
}
function sparkLoad(h) {
  if (!h.length) return ""; const mx = Math.max(1, ...h.map((x) => Math.max(x.ctl, x.atl))), W = 300, H = 60;
  const pts = (f) => h.map((x, i) => `${(i / (h.length - 1)) * W},${H - (f(x) / mx) * (H - 6) - 3}`).join(" ");
  return `<svg class="sp-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Forma y fatiga de las últimas 6 semanas"><polyline points="${pts((x) => x.ctl)}" fill="none" stroke="var(--sp)" stroke-width="2.5"/><polyline points="${pts((x) => x.atl)}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/></svg>
    <div class="sp-leg"><span><i style="background:var(--sp)"></i>Forma (6 semanas)</span><span><i class="dash"></i>Fatiga (7 días)</span></div>`;
}
function actRow(a) {
  const { esc, SPORT_ICO, sportName, actLine, dayLabel } = C;
  const inner = `<span class="st-i" aria-hidden="true">${SPORT_ICO(a.type)}</span><span class="n"><b>${esc(a.name || sportName(a.type))}</b><small>${dayLabel(a.day)} · ${actLine(a)}${a.rpe ? ` · esfuerzo ${a.rpe}/10` : ""}</small></span>`;
  return a.src === "app" ? `<button class="li st-act" data-act="sport-open" data-id="${esc(a.id)}">${inner}<span class="prof-ch" aria-hidden="true">›</span></button>` : `<div class="li st-act">${inner}<small class="note">${a.src === "garmin" ? "Garmin" : a.src === "whoop" ? "WHOOP" : "Strava"}</small></div>`;
}

/* ---------- Plan ---------- */
function planForm(k) {
  const Cc = COACH[k], P = C.S.scoach?.[k]?.req || {}, nr = nextRace(k), o = (id, v, l, cur) => `<label class="seg-o"><input type="radio" name="${id}" value="${v}" ${String(cur) === String(v) ? "checked" : ""}><span>${l}</span></label>`;
  const g0 = P.goal || (nr ? goalFromRace(k, nr.km) : Cc.goals[0][0]);
  return `<div class="card sc-form"><h2>${Cc.e} Tu plan de ${C.esc(Cc.n)}</h2>
    <div class="f"><span>¿Cuál es tu objetivo?</span><div class="seg-g">${Cc.goals.map(([v, l]) => o("scGoal", v, l, g0)).join("")}</div></div>
    <div class="f"><span>Tu nivel</span><div class="seg-g">${o("scLv", "beg", "Empiezo", P.level)}${o("scLv", "mid", "Intermedio", P.level || "mid")}${o("scLv", "adv", "Avanzado", P.level)}</div></div>
    <div class="f"><span>¿Cuántos días a la semana puedes entrenar?</span><div class="seg-g">${[2, 3, 4, 5, 6].map((d) => o("scDays", d, d, P.days || 3)).join("")}</div></div>
    ${isEnd(k) ? `<label class="f">Fecha de tu carrera u objetivo (opcional)<input type="date" id="scDate" min="${C.addDays(C.today(), 14)}" value="${C.esc(P.date || (nr && daysTo(nr.date) >= 14 ? nr.date : ""))}"></label>` : ""}
    ${actsOf(k).length ? `<p class="note" style="margin:0">Uso tus últimos entrenos para que el plan empiece a tu nivel actual.</p>` : ""}
    <button class="btn" data-act="sp-make">${C.S.scoach?.[k] ? "Rehacer mi plan" : "Crear mi plan"}</button>
    ${C.S.scoach?.[k] ? `<button class="btn ghost" data-act="sp-edit" data-v="0">Cancelar</button>` : ""}</div>`;
}
function recentLong(k) { const since = C.addDays(C.today(), -28); const l = actsOf(k).filter((a) => a.day >= since).map((a) => (+a.dur || 0) / 60); return l.length ? Math.round(Math.max(...l)) : 0; }
export function makePlanFor(k, req) {
  const P = makeCoachPlan(k, { ...req, recentLong: recentLong(k) }, C.today()); P.done = {};
  return C.put("sportcoach", { plans: { ...(C.S.scoach || {}), [k]: P } });
}
function vPlan(k) {
  const { esc, fmtMin } = C, P = C.S.scoach?.[k];
  if (!P || st.edit) return planForm(k);
  const cur = curWeek(P), W = Math.max(0, Math.min(P.weeks.length - 1, st.week ?? cur)), wk = P.weeks[W], list = weekSessions(k, W);
  const all = P.weeks.reduce((n, x) => n + x.sessions.length, 0), dn = Object.keys(P.done || {}).length;
  const wDone = list.filter((_, i) => isDone(k, W, i)).length, mins = list.reduce((a, x) => a + (x.dur || 0), 0), A = adjFor(k);
  return `<div class="card sc-hero"><span class="sc-e" aria-hidden="true">${COACH[k].e}</span><div><b>${esc(goalName(k, P.req.goal))}</b><span class="note">${P.req.date ? `Para el ${C.parseDay(P.req.date).getDate()} de ${MONTHS[C.parseDay(P.req.date).getMonth()]} · ` : ""}${P.req.days} días/semana · ${P.weeks.length} semanas</span></div></div>
  ${(W === cur || W === cur + 1) && (A.f !== 1 || A.easy) ? `<div class="sp-adj">⚙️ ${esc(A.why)}</div>` : ""}
  <div class="card"><div class="sc-wk"><button class="iconb" data-act="sp-week" data-w="${W - 1}" ${W <= 0 ? "disabled" : ""} aria-label="Semana anterior">‹</button>
    <div><b>Semana ${W + 1} de ${P.weeks.length}</b><small>${esc(wk.phase)}${W === cur ? " · esta semana" : ""}</small></div>
    <button class="iconb" data-act="sp-week" data-w="${W + 1}" ${W >= P.weeks.length - 1 ? "disabled" : ""} aria-label="Semana siguiente">›</button></div>
    <div class="gh-bar" style="--tc:var(--sp)"><i style="width:${Math.round(wDone / Math.max(1, list.length) * 100)}%"></i></div>
    <span class="note">${wDone} de ${list.length} hechas · ${isEnd(k) ? kmTxt(k, Math.round(list.reduce((a, x) => a + (x.t === "RACE" ? 0 : x.km || 0), 0) * 10) / 10) : fmtMin(mins * 60)} en total · plan: ${dn}/${all}</span>${isEnd(k) ? `<span class="note">Distancias calculadas con ${paceFor(k).src}${paceFor(k).src === "tu nivel" ? `. Pon tu ritmo en Datos › Zonas para afinarlas` : ""}.</span>` : ""}</div>
  ${cur >= P.weeks.length ? `<div class="card"><b>🎉 ¡Plan terminado!</b><p class="note">Crea uno nuevo para seguir mejorando.</p><button class="btn" data-act="sp-edit" data-v="1">Nuevo plan</button></div>` : ""}
  ${list.map((x, i) => sesCard(k, { x, w: W, i })).join("")}
  <button class="btn ghost" data-act="sp-edit" data-v="1">Cambiar mi plan</button>
  <button class="btn danger" data-act="sp-del-plan">Borrar plan</button>`;
}

/* ---------- Calendario ---------- */
function vCal(k) {
  const { today, iso, esc } = C, t = C.parseDay(today()), base = new Date(t.getFullYear(), t.getMonth() + st.cal, 1);
  const y = base.getFullYear(), m = base.getMonth(), first = (base.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
  const acts = actsOf(k), races = racesOf(k), sel = st.day || today();
  const cells = []; for (let i = 0; i < first; i++) cells.push(`<span></span>`);
  for (let d = 1; d <= n; d++) {
    const day = iso(new Date(y, m, d)), a = acts.some((x) => x.day === day), r = races.find((x) => x.date === day), pl = plannedOn(k, day), pd = pl.length && pl.every((o) => isDone(k, o.w, o.i));
    cells.push(`<button class="cal-d ${day === today() ? "t" : ""} ${day === sel ? "sel" : ""}" data-act="sp-day" data-d="${day}"><b>${d}</b><span class="cal-dots">${r ? `<i class="r">🏁</i>` : ""}${a || pd ? `<i class="a"></i>` : ""}${pl.length && !pd ? `<i class="p"></i>` : ""}</span></button>`);
  }
  const dA = acts.filter((x) => x.day === sel), dR = races.filter((x) => x.date === sel), dP = plannedOn(k, sel);
  return `<div class="card"><div class="sc-wk"><button class="iconb" data-act="sp-cal" data-v="${st.cal - 1}" aria-label="Mes anterior">‹</button><div><b>${MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1)} ${y}</b></div><button class="iconb" data-act="sp-cal" data-v="${st.cal + 1}" aria-label="Mes siguiente">›</button></div>
    <div class="cal-g">${["L", "M", "X", "J", "V", "S", "D"].map((l) => `<span class="cal-h">${l}</span>`).join("")}${cells.join("")}</div>
    <div class="sp-leg"><span><i style="background:var(--sp)"></i>Hecho</span><span><i class="ring"></i>Planificado</span><span>🏁 ${RACE_W(k).one[0].toUpperCase() + RACE_W(k).one.slice(1)}</span></div></div>
  <h2 class="sp-h2">${C.dayLabel(sel)}</h2>
  ${dR.map((r) => raceRow(k, r)).join("")}
  ${dP.map((o) => sesCard(k, o)).join("")}
  ${dA.length ? `<div class="card"><div class="list">${dA.map(actRow).join("")}</div></div>` : ""}
  ${!dR.length && !dP.length && !dA.length ? `<p class="note">Nada este día.</p>` : ""}
  <button class="btn ghost" data-act="sp-race-new" data-d="${sel >= today() ? sel : ""}">+ ${RACE_W(k).add} este día</button>`;
}

/* ---------- Carreras / partidos ---------- */
function raceRow(k, r) {
  const { esc } = C, fut = r.date >= C.today(), dd = daysTo(r.date);
  const res = isEnd(k) ? (r.time ? `⏱ ${hms(r.time)}${r.km ? ` · ${paceS(r.time / r.km)} /km` : ""}${r.pos ? ` · ${esc(r.pos)}º` : ""}` : "") : (r.res ? `${{ W: "✅ Victoria", D: "🤝 Empate", L: "❌ Derrota" }[r.res] || ""}${r.score ? ` · ${esc(r.score)}` : ""}` : "");
  return `<button class="card sp-race" data-act="sp-race-edit" data-id="${esc(r.id)}"><span class="sp-rd"><b>${C.parseDay(r.date).getDate()}</b><small>${MON3[C.parseDay(r.date).getMonth()]}</small></span>
    <span class="n"><b>${esc(r.name)}${r.prio ? ` <i class="sp-prio p${r.prio}">${r.prio}</i>` : ""}</b><small>${[r.km ? km2(r.km) + " km" : "", r.elev ? r.elev + " m+" : "", r.kind || ""].filter(Boolean).join(" · ")}${r.goal && fut ? ` · objetivo ${hms(r.goal)}` : ""}</small>
    ${fut ? `<small class="sp-in">${dd === 0 ? "¡Hoy!" : dd === 1 ? "Mañana" : `En ${dd} días`}</small>` : res ? `<small class="sp-res">${res}</small>` : `<small class="note">Toca para poner tu resultado</small>`}</span><span class="prof-ch" aria-hidden="true">›</span></button>`;
}
function vRaces(k) {
  const R = racesOf(k), up = R.filter((r) => r.date >= C.today()).sort((a, b) => a.date < b.date ? -1 : 1), past = R.filter((r) => r.date < C.today()).sort((a, b) => a.date < b.date ? 1 : -1), W = RACE_W(k);
  return `<button class="btn block" data-act="sp-race-new">+ ${W.add}</button>
  <h2 class="sp-h2">Próxim${W.one === "partido" || W.one === "combate" ? "o" : "a"}s</h2>${up.map((r) => raceRow(k, r)).join("") || `<p class="note">No tienes ${W.many.toLowerCase()} apuntad${W.one === "carrera" ? "a" : "o"}s. ${isEnd(k) ? "Guarda tu próxima carrera y tu plan se preparará para ella." : ""}</p>`}
  ${past.length ? `<h2 class="sp-h2">Hechas</h2>${past.map((r) => raceRow(k, r)).join("")}` : ""}`;
}
export function openRace(k, id, day) {
  const { esc } = C, r = (C.S.races || []).find((x) => x.id === id) || { sport: k, date: day || C.today(), prio: "B" }, W = RACE_W(k), end = isEnd(k), fut = r.date >= C.today();
  const o = (v, l) => `<label class="seg-o"><input type="radio" name="rPrio" value="${v}" ${r.prio === v ? "checked" : ""}><span>${l}</span></label>`;
  const ro = (v, l) => `<label class="seg-o"><input type="radio" name="rRes" value="${v}" ${r.res === v ? "checked" : ""}><span>${l}</span></label>`;
  C.openSheet(id ? r.name : W.add, `<label class="f">${end ? "Nombre de la carrera" : k === "boxing" ? "Rival o evento" : "Rival o torneo"}<input id="rName" value="${esc(r.name || "")}" placeholder="${end ? "Ej.: Behobia-San Sebastián" : "Ej.: vs. CD Ejemplo"}"></label>
    <label class="f">Fecha<input type="date" id="rDate" value="${esc(r.date)}"></label>
    ${end ? `<div class="grid2"><label class="f">Distancia (km)<input id="rKm" inputmode="decimal" value="${r.km ? String(r.km).replace(".", ",") : ""}"></label>${hasElev(k) ? `<label class="f">Desnivel + (m)<input id="rElev" inputmode="numeric" value="${r.elev || ""}"></label>` : `<label class="f">Tiempo objetivo<input id="rGoal" placeholder="h:mm:ss" value="${r.goal ? hms(r.goal) : ""}"></label>`}</div>
      ${hasElev(k) ? `<label class="f">Tiempo objetivo<input id="rGoal" placeholder="h:mm:ss" value="${r.goal ? hms(r.goal) : ""}"></label>` : ""}
      <div class="f"><span>Importancia</span><div class="seg-g">${o("A", "A · objetivo principal")}${o("B", "B · importante")}${o("C", "C · entreno")}</div></div>
      <label class="tgl"><input type="checkbox" id="rPlan" ${!id && fut ? "checked" : ""}><span>Preparar mi plan para esta carrera (si es la A)</span></label>
      <details class="card" ${!fut ? "open" : ""}><summary style="cursor:pointer;font-weight:600">Resultado</summary><div class="stack" style="margin-top:10px">
        <div class="grid2"><label class="f">Tiempo final<input id="rTime" placeholder="h:mm:ss" value="${r.time ? hms(r.time) : ""}"></label><label class="f">Posición<input id="rPos" inputmode="numeric" value="${esc(r.pos || "")}"></label></div></div></details>`
    : `<label class="f">Tipo<select id="rKind">${["Liga", "Amistoso", "Torneo", "Copa", "Entreno"].map((x) => `<option ${r.kind === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <details class="card" ${!fut ? "open" : ""}><summary style="cursor:pointer;font-weight:600">Resultado</summary><div class="stack" style="margin-top:10px">
        <div class="seg-g">${ro("W", "Victoria")}${ro("D", k === "football" || k === "boxing" ? "Empate" : "—")}${ro("L", "Derrota")}</div>
        <div class="grid2"><label class="f">Marcador<input id="rScore" placeholder="${k === "padel" || k === "tennis" ? "6-4 6-3" : "2-1"}" value="${esc(r.score || "")}"></label><label class="f">Minutos jugados<input id="rMin" inputmode="numeric" value="${r.min || ""}"></label></div></div></details>`}
    <label class="f">Notas<textarea id="rNotes" rows="2">${esc(r.notes || "")}</textarea></label>
    <span class="msg" id="rMsg" hidden></span>
    <button class="btn" data-act="sp-race-save" data-id="${esc(id || "")}">Guardar</button>
    ${id ? `<button class="btn danger" data-act="sp-race-del" data-id="${esc(id)}">Borrar</button>` : ""}`, { kind: "race", sport: k });
}
export async function saveRace(k, id) {
  const $ = C.$, v = (x) => $(x)?.value?.trim() || "", name = v("rName"), date = v("rDate");
  if (!name || !date) { const m = $("rMsg"); m.textContent = "Pon el nombre y la fecha."; m.hidden = false; return; }
  const radio = (n) => document.querySelector(`input[name=${n}]:checked`)?.value || "";
  const r = { id: id || "r" + Date.now(), sport: k, name, date, notes: v("rNotes"),
    ...(isEnd(k) ? { km: +v("rKm").replace(",", ".") || 0, elev: +v("rElev") || 0, goal: parseT(v("rGoal")), prio: radio("rPrio") || "B", time: parseT(v("rTime")), pos: v("rPos") }
      : { kind: v("rKind"), res: radio("rRes"), score: v("rScore"), min: +v("rMin") || 0 }) };
  const plan = isEnd(k) && $("rPlan")?.checked && r.prio === "A" && daysTo(r.date) >= 14;
  await C.put("races", { list: [r, ...(C.S.races || []).filter((x) => x.id !== r.id)] });
  if (plan) { const old = C.S.scoach?.[k]?.req || {}; await makePlanFor(k, { goal: goalFromRace(k, r.km), level: old.level || "mid", days: old.days || 4, date: r.date }); st.tab = "plan"; st.week = null; }
  C.closeSheet(); C.render(); scrollTo(0, 0);
}

/* ---------- Registrar entreno ---------- */
export function openReg(k, w, i) {
  const { esc, today } = C, types = TYPES[k], Cc = COACH[k], P = C.S.scoach?.[k], ses = P && w != null ? weekSessions(k, w)[i] : null;
  const rpeL = ["", "Muy suave", "Suave", "Suave", "Moderado", "Algo duro", "Duro", "Duro", "Muy duro", "Máximo", "Máximo"];
  C.openSheet(ses ? ses.title : "Registrar entreno", `${Cc.gps ? `<button class="btn sp-gps-big" data-act="sp-gps" ${w != null ? `data-w="${w}" data-i="${i}"` : ""}>▶ Grabar ahora con GPS</button><div class="sp-or"><span>o apúntalo a mano</span></div>` : ""}
    ${types.length > 1 ? `<label class="f">Tipo<select id="regType">${types.map((t) => `<option value="${t}">${esc(C.sportName(t))}</option>`).join("")}</select></label>` : ""}
    <div class="grid2"><label class="f">Día<input type="date" id="regDay" value="${today()}" max="${today()}"></label><label class="f">Duración<input id="regDur" placeholder="h:mm o minutos" value="${ses?.dur ? ses.dur : ""}"></label></div>
    ${isEnd(k) ? `<div class="grid2"><label class="f">Distancia (km)<input id="regKm" inputmode="decimal" value="${ses?.km ? String(ses.km).replace(".", ",") : ""}"></label>${hasElev(k) ? `<label class="f">Desnivel + (m)<input id="regElev" inputmode="numeric"></label>` : `<label class="f">FC media<input id="regHr" inputmode="numeric" placeholder="ppm"></label>`}</div>` : ""}
    ${!isEnd(k) || hasElev(k) ? `<label class="f">FC media (opcional)<input id="regHr" inputmode="numeric" placeholder="ppm"></label>` : ""}
    <div class="f"><span>Esfuerzo (1 = muy suave, 10 = máximo): <b id="regRpeL">${rpeL[5]}</b></span><input type="range" id="regRpe" min="1" max="10" value="5" oninput="document.getElementById('regRpeL').textContent=${JSON.stringify(rpeL).replace(/"/g, "&quot;")}[this.value]+' · '+this.value"></div>
    <label class="f">Notas<input id="regNotes" placeholder="Cómo te has sentido, ruta…"></label>
    <span class="msg" id="regMsg" hidden></span>
    <button class="btn" data-act="sp-reg-save" ${w != null ? `data-w="${w}" data-i="${i}"` : ""}>Guardar entreno</button>`, { kind: "reg", sport: k });
}
export async function saveReg(k, w, i) {
  const $ = C.$, v = (x) => $(x)?.value?.trim() || "";
  let dur = v("regDur"); dur = /:/.test(dur) ? parseT(dur + ":00") : (+dur.replace(",", ".") || 0) * 60;
  if (!(dur > 0)) { const m = $("regMsg"); m.textContent = "Pon cuánto duró (por ejemplo 45 o 1:15)."; m.hidden = false; return; }
  const day = v("regDay") || C.today(), type = v("regType") || TYPES[k][0], km = +v("regKm").replace(",", ".") || 0;
  const start = day === C.today() ? Date.now() - dur * 1000 : C.parseDay(day).getTime() + 18 * 3600e3;
  const a = { id: "a" + Date.now(), type, csport: k, name: "", start, day, dur: Math.round(dur), km, elev: +v("regElev") || 0, hr: +v("regHr") || null, rpe: +v("regRpe") || 5, notes: v("regNotes"),
    kcal: C.kcalFor(type, C.sportKg(), dur, km) };
  await C.put("sports", { list: [a, ...(C.S.sports || [])] });
  if (w != null && !isNaN(w)) await setDone(k, w, i, true); else autoMark(k, day);
  C.closeSheet(); C.render(); C.confetti();
}

/* ---------- Datos: resumen, estadísticas y zonas ---------- */
function vData(k) {
  const seg = (v, l) => `<button data-act="sp-data" data-v="${v}" aria-pressed="${st.data === v}">${l}</button>`;
  return `<div class="seg sp-seg">${seg("res", "Resumen")}${seg("stats", "Estadísticas")}${seg("zones", "Zonas")}</div>${{ res: vRes, stats: vStats, zones: vZones }[st.data](k)}`;
}
function periodRange() {
  const { today, addDays, iso } = C, t = C.parseDay(today());
  if (st.per === "d") { const d = addDays(today(), st.off); return { a: d, b: d, label: C.dayLabel(d), sub: [] }; }
  if (st.per === "w") { const a = addDays(C.weekStart(today()), st.off * 7), b = addDays(a, 6); return { a, b, label: st.off === 0 ? "Esta semana" : `${C.parseDay(a).getDate()} ${MON3[C.parseDay(a).getMonth()]} – ${C.parseDay(b).getDate()} ${MON3[C.parseDay(b).getMonth()]}`, sub: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ l: "LMXJVSD"[i], a: addDays(a, i), b: addDays(a, i) })) }; }
  if (st.per === "m") { const f = new Date(t.getFullYear(), t.getMonth() + st.off, 1), l = new Date(f.getFullYear(), f.getMonth() + 1, 0), a = iso(f), b = iso(l), sub = [];
    for (let d = a; d <= b; d = addDays(d, 7)) { const e = addDays(d, 6) > b ? b : addDays(d, 6); sub.push({ l: String(C.parseDay(d).getDate()), a: d, b: e }); }
    return { a, b, label: `${MONTHS[f.getMonth()][0].toUpperCase() + MONTHS[f.getMonth()].slice(1)} ${f.getFullYear()}`, sub }; }
  const y = t.getFullYear() + st.off; return { a: `${y}-01-01`, b: `${y}-12-31`, label: String(y), sub: MON3.map((l, i) => ({ l: l[0], a: iso(new Date(y, i, 1)), b: iso(new Date(y, i + 1, 0)) })) };
}
function totals(L, k) { return { n: L.length, sec: L.reduce((a, x) => a + (+x.dur || 0), 0), km: L.reduce((a, x) => a + (+x.km || 0), 0), elev: L.reduce((a, x) => a + (+x.elev || 0), 0), kcal: L.reduce((a, x) => a + (+x.kcal || 0), 0), load: L.reduce((a, x) => a + loadOf(x, k), 0) }; }
function vRes(k) {
  const { fmt, fmtMin } = C, R = periodRange(), acts = actsOf(k), L = acts.filter((a) => a.day >= R.a && a.day <= R.b), T = totals(L, k);
  const pv = (v, l) => `<button data-act="sp-per" data-v="${v}" aria-pressed="${st.per === v}">${l}</button>`;
  const metric = isEnd(k) ? (x) => x.km : (x) => x.sec / 60, mU = isEnd(k) ? "km" : "min";
  const bars = R.sub.map((s) => { const t = totals(acts.filter((a) => a.day >= s.a && a.day <= s.b), k); return { l: s.l, v: metric(t) }; }), mx = Math.max(1, ...bars.map((b) => b.v));
  return `<div class="seg sp-seg sm">${pv("d", "Día")}${pv("w", "Semana")}${pv("m", "Mes")}${pv("y", "Año")}</div>
  <div class="card"><div class="sc-wk"><button class="iconb" data-act="sp-off" data-v="${st.off - 1}" aria-label="Anterior">‹</button><div><b>${R.label}</b></div><button class="iconb" data-act="sp-off" data-v="${st.off + 1}" ${st.off >= 0 ? "disabled" : ""} aria-label="Siguiente">›</button></div>
    <div class="sp-tot"><div><b>${T.n}</b><span>entrenos</span></div><div><b>${fmtMin(T.sec)}</b><span>tiempo</span></div>${isEnd(k) ? `<div><b>${km2(T.km)}</b><span>km</span></div>` : ""}${hasElev(k) ? `<div><b>${fmt(T.elev)}</b><span>m+</span></div>` : ""}<div><b>${fmt(T.kcal)}</b><span>kcal</span></div><div><b>${fmt(Math.round(T.load))}</b><span>carga</span></div></div>
    ${bars.length ? `<div class="sp-bars" role="img" aria-label="${mU} por periodo">${bars.map((b) => `<div><i style="height:${Math.max(b.v ? 4 : 0, b.v / mx * 100)}%" title="${km2(b.v)} ${mU}"></i><span>${b.l}</span></div>`).join("")}</div><span class="note">${isEnd(k) ? "Kilómetros" : "Minutos"} por ${st.per === "w" ? "día" : st.per === "m" ? "semana" : "mes"}</span>` : ""}</div>
  ${L.length ? `<div class="card"><div class="list">${L.slice(0, 30).map(actRow).join("")}</div></div>` : `<p class="note">Sin entrenos en este periodo.</p>`}`;
}
function vStats(k) {
  const { fmt, fmtMin, esc } = C, A = actsOf(k), T = totals(A, k), R = racesOf(k).filter((r) => r.date < C.today());
  let recs = "";
  if (isEnd(k)) {
    const minKm = k === "swim" ? 0.4 : k === "bike" ? 10 : 3, wd = A.filter((a) => a.km >= minKm && a.dur > 0);
    const best = (f, cmp) => wd.length ? wd.reduce((b, a) => cmp(f(a), f(b)) ? a : b) : null;
    const lg = A.length ? A.reduce((b, a) => (+a.km || 0) > (+b.km || 0) ? a : b) : null, lt = A.length ? A.reduce((b, a) => (+a.dur || 0) > (+b.dur || 0) ? a : b) : null, le = A.length ? A.reduce((b, a) => (+a.elev || 0) > (+b.elev || 0) ? a : b) : null;
    const fp = best((a) => a.dur / a.km, (x, y) => x < y);
    const row = (l, v, a) => a ? `<div class="sp-rec"><span>${l}</span><b>${v}</b><small>${C.dayLabel(a.day)}</small></div>` : "";
    recs = `<div class="card"><h2>Mejores entrenos</h2>${row("Más distancia", lg?.km ? km2(lg.km) + " km" : "", lg?.km ? lg : null)}${row("Más tiempo", lt ? fmtMin(lt.dur) : "", lt)}${hasElev(k) ? row("Más desnivel", le?.elev ? fmt(le.elev) + " m+" : "", le?.elev ? le : null) : ""}
      ${row(k === "bike" ? "Más rápido (media)" : k === "swim" ? "Mejor ritmo /100 m" : "Mejor ritmo medio", fp ? (k === "bike" ? km2(fp.km / (fp.dur / 3600)) + " km/h" : k === "swim" ? paceS(fp.dur / fp.km / 10) : paceS(fp.dur / fp.km) + " /km") : "", fp)}
      ${!A.length ? `<p class="note">Registra entrenos para ver tus récords.</p>` : ""}</div>`;
    const STD = k === "run" ? [[5, "5 km"], [10, "10 km"], [21.1, "Media maratón"], [42.2, "Maratón"]] : [];
    const pbs = STD.map(([d, l]) => { const c = R.filter((r) => r.time && r.km && Math.abs(r.km - d) / d < 0.04).sort((a, b) => a.time - b.time)[0]; return c ? `<div class="sp-rec"><span>${l}</span><b>${hms(c.time)}</b><small>${esc(c.name)}</small></div>` : ""; }).join("");
    const rr = R.filter((r) => r.time).sort((a, b) => a.date < b.date ? 1 : -1);
    recs += `<div class="card"><h2>Tus carreras</h2>${pbs ? `<h3 class="note" style="margin:0">Mejores marcas</h3>${pbs}` : ""}
      <div class="sp-tot"><div><b>${R.length}</b><span>hechas</span></div><div><b>${km2(R.reduce((a, r) => a + (+r.km || 0), 0))}</b><span>km en carrera</span></div>${hasElev(k) ? `<div><b>${fmt(R.reduce((a, r) => a + (+r.elev || 0), 0))}</b><span>m+</span></div>` : ""}</div>
      ${rr.slice(0, 6).map((r) => `<div class="sp-rec"><span>${esc(r.name)}</span><b>${hms(r.time)}</b><small>${r.km ? paceS(r.time / r.km) + " /km" : ""}${r.goal ? (r.time <= r.goal ? " · ✅ objetivo" : ` · objetivo ${hms(r.goal)}`) : ""}</small></div>`).join("") || `<p class="note">Cuando pongas el resultado de tus carreras, aquí verás tus marcas.</p>`}</div>`;
  } else {
    const w = R.filter((r) => r.res === "W").length, d = R.filter((r) => r.res === "D").length, l = R.filter((r) => r.res === "L").length, n = w + d + l;
    recs = `<div class="card"><h2>${RACE_W(k).many}</h2><div class="sp-tot"><div><b>${R.length}</b><span>jugados</span></div><div><b>${w}</b><span>victorias</span></div>${k === "football" || k === "boxing" ? `<div><b>${d}</b><span>empates</span></div>` : ""}<div><b>${l}</b><span>derrotas</span></div><div><b>${n ? Math.round(w / n * 100) : 0} %</b><span>ganados</span></div><div><b>${fmt(R.reduce((a, r) => a + (+r.min || 0), 0))}</b><span>minutos</span></div></div>
      ${n ? `<div class="sp-form">Últimos: ${R.filter((r) => r.res).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 5).map((r) => `<i class="f${r.res}">${{ W: "V", D: "E", L: "D" }[r.res]}</i>`).join("")}</div>` : `<p class="note">Apunta tus ${RACE_W(k).many.toLowerCase()} y sus resultados para ver tus estadísticas.</p>`}</div>`;
  }
  const wk = []; for (let i = 11; i >= 0; i--) { const a = C.addDays(C.weekStart(C.today()), -7 * i), t = totals(A.filter((x) => x.day >= a && x.day <= C.addDays(a, 6)), k); wk.push({ l: C.parseDay(a).getDate(), v: isEnd(k) ? t.km : t.sec / 60 }); }
  const mx = Math.max(1, ...wk.map((x) => x.v));
  return `<div class="card"><h2>Total</h2><div class="sp-tot"><div><b>${T.n}</b><span>entrenos</span></div><div><b>${fmtMin(T.sec)}</b><span>tiempo</span></div>${isEnd(k) ? `<div><b>${km2(T.km)}</b><span>km</span></div>` : ""}${hasElev(k) ? `<div><b>${fmt(T.elev)}</b><span>m+</span></div>` : ""}<div><b>${fmt(T.kcal)}</b><span>kcal</span></div></div></div>
  <div class="card"><h2>Últimas 12 semanas</h2><div class="sp-bars">${wk.map((b) => `<div><i style="height:${Math.max(b.v ? 4 : 0, b.v / mx * 100)}%"></i><span>${b.l}</span></div>`).join("")}</div><span class="note">${isEnd(k) ? "Kilómetros" : "Minutos"} por semana</span></div>
  ${recs}`;
}
function vZones(k) {
  const { esc } = C, Z = zonesOf(k), mx = +Z.hrmax || 0, rs = +Z.hrrest || 0, age = +C.S.settings.profile?.age || 0;
  const hrZ = mx ? [[1, "Recuperación", 0.5, 0.6], [2, "Fondo (aeróbico)", 0.6, 0.7], [3, "Tempo", 0.7, 0.8], [4, "Umbral", 0.8, 0.9], [5, "Máximo (VO2)", 0.9, 1]].map(([n, l, a, b]) => { const f = (p) => Math.round(rs ? rs + (mx - rs) * p : mx * p); return [n, l, `${f(a)}–${f(b)} ppm`]; }) : null;
  const T = +Z.thr || 0, paceZ = (k === "run" || k === "trail" || k === "hike") && T ? [[1, "Recuperación", T * 1.29, 0], [2, "Fondo", T * 1.14, T * 1.29], [3, "Tempo", T * 1.06, T * 1.14], [4, "Umbral", T * 0.97, T * 1.06], [5, "VO2 / series", 0, T * 0.97]].map(([n, l, a, b]) => [n, l, a && b ? `${paceS(a)}–${paceS(b)} /km` : a ? `más lento de ${paceS(a)}` : `más rápido de ${paceS(b)}`]) : null;
  const F = +Z.ftp || 0, powZ = k === "bike" && F ? [[1, "Recuperación", 0, 0.55], [2, "Fondo", 0.56, 0.75], [3, "Tempo", 0.76, 0.9], [4, "Umbral", 0.91, 1.05], [5, "VO2 máx", 1.06, 1.2], [6, "Anaeróbico", 1.21, 0]].map(([n, l, a, b]) => [n, l, b ? `${Math.round(F * a)}–${Math.round(F * b)} W` : `más de ${Math.round(F * a)} W`]) : null;
  const CS = +Z.css || 0, swimZ = k === "swim" && CS ? [[1, "Suave", CS + 15, 0], [2, "Aeróbico", CS + 8, CS + 15], [3, "Tempo", CS + 3, CS + 8], [4, "Umbral (CSS)", CS - 3, CS + 3], [5, "Rápido", 0, CS - 3]].map(([n, l, a, b]) => [n, l, a && b ? `${paceS(a)}–${paceS(b)} /100 m` : a ? `más lento de ${paceS(a)}` : `más rápido de ${paceS(b)}`]) : null;
  const tbl = (t, rows) => rows ? `<div class="card"><h2>${t}</h2>${rows.map(([n, l, v]) => `<div class="sp-z z${n}"><i>Z${n}</i><span>${l}</span><b>${v}</b></div>`).join("")}</div>` : "";
  return `<div class="card"><h2>Tus datos</h2>
    <div class="grid2"><label class="f">FC máxima<input id="zMax" inputmode="numeric" placeholder="${age ? Math.round(208 - 0.7 * age) + " (estimada)" : "ppm"}" value="${mx || ""}"></label><label class="f">FC en reposo<input id="zRest" inputmode="numeric" placeholder="opcional" value="${rs || ""}"></label></div>
    ${k === "run" || k === "trail" || k === "hike" ? `<label class="f">Ritmo umbral (min/km)<input id="zThr" placeholder="Ej.: 4:45" value="${T ? paceS(T) : ""}"></label>
      <details><summary class="link" style="cursor:pointer">Calcularlo con una carrera reciente</summary><div class="grid2" style="margin-top:8px"><label class="f">Distancia (km)<input id="zRk" inputmode="decimal" placeholder="10"></label><label class="f">Tiempo<input id="zRt" placeholder="h:mm:ss"></label></div><button class="btn soft" data-act="sp-z-calc">Calcular</button></details>` : ""}
    ${k === "bike" ? `<label class="f">FTP (vatios)<input id="zFtp" inputmode="numeric" placeholder="Ej.: 220" value="${F || ""}"></label>` : ""}
    ${k === "swim" ? `<label class="f">CSS: tu ritmo umbral por 100 m<input id="zCss" placeholder="Ej.: 1:45" value="${CS ? paceS(CS) : ""}"></label>` : ""}
    <span class="msg" id="zMsg" hidden></span>
    <button class="btn" data-act="sp-z-save">Guardar zonas</button>
    ${!mx ? `<p class="note" style="margin:0">Si no sabes tu FC máxima, déjala vacía y uso la estimada por tu edad${age ? "" : " (pon tu edad en tu perfil)"}. Con un reloj, la más alta de un esfuerzo a tope es mejor.</p>` : ""}</div>
    ${tbl("Zonas de frecuencia cardiaca", hrZ)}${tbl("Zonas de ritmo", paceZ)}${tbl("Zonas de potencia", powZ)}${tbl("Zonas de natación", swimZ)}`;
}
export function zCalc() {
  const $ = C.$, d = +($("zRk").value || "").replace(",", "."), t = parseT($("zRt").value);
  if (!(d > 0 && t > 0)) return;
  const d60 = d * Math.pow(3600 / t, 1 / 1.06); $("zThr").value = paceS(3600 / d60);
}
export async function zSave(k) {
  const $ = C.$, v = (x) => $(x)?.value?.trim() || "", age = +C.S.settings.profile?.age || 0;
  const z = { hrmax: +v("zMax") || (age ? Math.round(208 - 0.7 * age) : 0), hrrest: +v("zRest") || 0 };
  if (v("zThr")) z.thr = parseT(v("zThr")); if (v("zFtp")) z.ftp = +v("zFtp"); if (v("zCss")) z.css = parseT(v("zCss"));
  await C.put("zones", { map: { ...(C.S.zones || {}), [k]: z } }); C.render();
}

/* ---------- acciones ---------- */
export function spAction(act, el, k) {
  const d = el.dataset;
  switch (act) {
    case "sp-tab": st.tab = d.t; st.week = null; C.render(); scrollTo(0, 0); return true;
    case "sp-week": st.week = +d.w; C.render(); return true;
    case "sp-edit": st.edit = d.v === "1"; C.render(); scrollTo(0, 0); return true;
    case "sp-make": { const r = (n) => document.querySelector(`input[name=${n}]:checked`)?.value;
      makePlanFor(k, { goal: r("scGoal"), level: r("scLv") || "mid", days: +r("scDays") || 3, date: C.$("scDate")?.value || "" }).then(() => { st.edit = false; st.week = null; C.render(); scrollTo(0, 0); }); return true; }
    case "sp-del-plan": if (d.sure) { const P = { ...C.S.scoach }; delete P[k]; C.put("sportcoach", { plans: P }).then(C.render); } else { d.sure = 1; el.textContent = "Toca otra vez para borrar el plan"; } return true;
    case "sp-done": setDone(k, +d.w, +d.i); C.render(); return true;
    case "sp-gps": C.closeSheet(); C.trkStart(COACH[k].gps, d.w != null ? { k, w: +d.w, i: +d.i } : { k }); return true;
    case "sp-reg": openReg(k, d.w != null ? +d.w : null, d.i != null ? +d.i : null); return true;
    case "sp-reg-save": saveReg(k, d.w != null ? +d.w : null, d.i != null ? +d.i : null); return true;
    case "sp-cal": st.cal = +d.v; C.render(); return true;
    case "sp-day": st.day = d.d; C.render(); return true;
    case "sp-race-new": openRace(k, null, d.d || null); return true;
    case "sp-race-edit": openRace(k, d.id); return true;
    case "sp-race-save": saveRace(k, d.id || null); return true;
    case "sp-race-del": if (d.sure) { C.put("races", { list: (C.S.races || []).filter((r) => r.id !== d.id) }).then(() => { C.closeSheet(); C.render(); }); } else { d.sure = 1; el.textContent = "Toca otra vez para borrar"; } return true;
    case "sp-data": st.data = d.v; C.render(); return true;
    case "sp-per": st.per = d.v; st.off = 0; C.render(); return true;
    case "sp-off": st.off = +d.v; C.render(); return true;
    case "sp-z-calc": zCalc(); return true;
    case "sp-z-save": zSave(k); return true;
  }
  return false;
}
