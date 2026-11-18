// BEINGHEALTHY · Cada deporte como una app propia: Hoy, Plan, Calendario, Carreras y Datos (resumen, estadísticas y zonas).
import { COACH, DAY_N, TIPS, makeCoachPlan, adaptWeek, goalFromRace, goalName, describeEnd, raceReq, insertRaces, raceMinutes, raceEffortKm } from "./coach.js";

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
  const J = injAdj(k); if (J) return J;
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
  const G = goalInfo(k); if (G) return { s: G.thr * 1.26, src: "tu marca objetivo" };
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
  if (!isEnd(k)) return list.map((x) => ({ ...x, short: shortOf(k, x) }));
  const base = paceFor(k).s, phase = P.weeks[w].phase.replace(" · descarga", ""), { goal, level } = P.req;
  return list.map((x) => {
    if (x.t === "S") return { ...x, short: shortOf(k, x) };
    if (x.t === "RACE") { const r = racesOf(k).find((r) => r.date === C.addDays(P.start, w * 7 + x.d)); return r?.km ? { ...x, km: r.km } : x; }
    const amt = (m) => kmTxt(k, kmFrom(k, m, "E", base));
    let km = kmFrom(k, x.dur, x.t, base);
    if (k === "swim" && (x.t === "E" || x.t === "Q")) {          // natación: la distancia es la suma de las series de la sesión
      const [, d0] = describeEnd(k, x.t, phase, x.dur, goal, w, level, () => "");
      let tot = 0; const rest = d0.replace(/(\d+)×(\d+) m/g, (_, a, b) => { tot += a * b; return ""; }); rest.replace(/(\d[\d.]*) m\b/g, (_, a) => { tot += +a.replace(".", ""); return ""; });
      if (tot) km = tot / 1000;
    }
    const [title, desc] = describeEnd(k, x.t, phase, x.dur, goal, w, level, (m) => m === x.dur ? kmTxt(k, km) : amt(m));
    const rate = { trail: { E: 25, R: 16, Q: 35, L: { t21: 32, t50: 40, ultra: 48, mont: 45 }[goal] || 38 }, hike: { E: 55, R: 40, Q: 70, L: 75 }, bike: { E: 7, R: 5, Q: 10, L: goal === "puertos" ? 20 : 12 } }[k]?.[x.t] || 0;
    const elev = rate && k !== "bike" ? Math.round(km * rate) : rate ? Math.round(km * rate / 10) * 10 : 0;
    const d2 = desc.replace(/^: /, "").replace(/unos \d+ m de desnivel positivo/, `unos ${elev} m de desnivel positivo`);
    const y = { ...x, title, desc: d2, km, ...(elev ? { elev } : {}), zone: zoneOf(x) };
    const pr = paceRange(k, y), G = goalInfo(k);
    if (pr) { y.pace = pr; y.paceTxt = `${paceS(pr[0])}–${paceS(pr[1])} /km`; }
    if (G && x.t === "L" && /ritmo de carrera/.test(d2)) y.desc = d2.replace(/a ritmo de carrera/, `a ritmo de carrera (${paceS(G.rp)} /km)`);
    y.short = shortOf(k, y); return y;
  });
}
function zoneOf(x) {
  if (x.t === "E" || x.t === "L") return "Z2"; if (x.t === "R") return "Z1-Z2"; if (x.t !== "Q") return "";
  const t = x.title || ""; return /VO2/.test(t) ? "Z5" : /Series|Cuestas/.test(t) && !/cortas/.test(t) ? "Z4-Z5" : /umbral|Umbral|Subida|Ritmo$/.test(t) ? "Z3-Z4" : /Bajadas/.test(t) ? "Z3" : /cambios|Cadencia/.test(t) ? "Z2-Z3" : "Z3-Z4";
}
function shortOf(k, x) {
  if (x.t === "E") return k === "swim" ? "Ejercicios de técnica y nado cómodo" : k === "bike" ? "En llano, cadencia ágil y ritmo cómodo" : "Ritmo conversacional";
  if (x.t === "R") return "Muy suave, solo para soltar las piernas";
  if (x.t === "L") return k === "swim" ? "Nado seguido a ritmo cómodo" : `Constante y conversacional${(x.dur || 0) >= 90 ? ". Practica la nutrición" : ""}${k === "trail" ? ". Anda las subidas fuertes" : ""}`;
  if (x.t === "RACE") return "¡Disfruta! Sal suave y come y bebe lo practicado";
  if (x.t === "S" || x.t === "F" || x.t === "F2") return x.desc.replace(/^Unos \d+ min(, más ligera)?\. ?/, "").replace(/ · /g, ", ").replace(/\.$/, "");
  const p = x.desc.split(" · "); return (p.length > 2 ? p.slice(1, -1).join(", ") : p[0]).replace(/\.$/, "");
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
  const Cc = COACH[k], tabs = [["hoy", "Hoy"], ["plan", "Plan"], ["prog", "Progreso"]];
  if (!["hoy", "plan", "prog"].includes(st.tab)) st.tab = "hoy";
  if (C.S.scoach?.[k] && !st.syncing) { const P = C.S.scoach[k]; if ((P.races ?? "") !== racesSig(k) || (P.req.raceId && P.req.date < C.today())) { st.syncing = true; Promise.resolve(syncPlan(k)).finally(() => { st.syncing = false; C.render(); }); } }
  const body = (st.msg ? `<div class="sp-adj">🔄 ${C.esc(st.msg)}</div>` : "") + { hoy: vHoy, plan: vPlanAll, prog: vProg }[st.tab](k); st.msg = "";
  return `<div class="spapp" style="--sp:${SP_COLOR[k]}">
    <div class="sp-head2"><div class="seg sp-seg">${tabs.map(([t, l]) => `<button data-act="sp-tab" data-t="${t}" aria-pressed="${st.tab === t}">${l}</button>`).join("")}</div>
      <button class="sp-plus" data-act="sp-add" aria-label="Añadir">＋</button></div>
    ${body}</div>`;
}

/* ---------- Hoy ---------- */
function sesCard(k, o, opts = {}) {
  const { esc, fmtMin, today, addDays } = C, P = C.S.scoach[k], x = o.x, day = addDays(P.start, o.w * 7 + x.d), done = isDone(k, o.w, o.i), isT = day === today();
  return `<div class="card sc-s ${done ? "done" : ""} ${isT && !opts.noToday ? "is-today" : ""}"><div class="sc-h"><span class="sc-d"><b>${DAY_N[x.d].slice(0, 3)}</b><small>${C.parseDay(day).getDate()}</small></span>
    <div class="sc-t"><b>${esc(x.title)}</b><small>${isT ? "Hoy · " : ""}${[amountOf(k, x), x.elev ? x.elev + " m+" : "", x.zone || ""].filter(Boolean).join(" · ")}${x.adj ? " · ajustada a tu carga" : ""}</small>${x.paceTxt ? `<small class="sp-pace">🎯 Ritmo ${x.paceTxt}</small>` : ""}</div>
    ${x.t === "RACE" ? "" : `<button class="sc-chk" data-act="sp-done" data-w="${o.w}" data-i="${o.i}" aria-pressed="${done}" aria-label="Marcar como hecha">✓</button>`}</div>
    <p class="sc-desc">${esc(x.desc).replace(/ · /g, "<br>· ")}</p>
    ${evalBox(k, o.w, o.i, x)}
    ${!done && day <= today() && x.t !== "RACE" ? `<div class="sc-acts">${COACH[k].gps && !["S", "F", "F2", "M"].includes(x.t) ? `<button class="btn soft" data-act="sp-gps" data-w="${o.w}" data-i="${o.i}">▶ Grabar con GPS</button>` : ""}<button class="btn ghost" data-act="sp-reg" data-w="${o.w}" data-i="${o.i}">Registrar</button></div>` : ""}
    ${["S", "F", "F2"].includes(x.t) ? prevBox(k) : ""}
    ${["S", "F", "F2"].includes(x.t) && !done ? `<button class="link" data-act="ex-sport" data-k="gym">Apuntar las series en Gym ›</button>` : ""}
    ${(() => { const a = done || day <= today() ? actForSes(k, o.w, x) : null; return a ? `<button class="link" data-act="ana-open" data-id="${esc(a.id)}">Ver análisis completo ›</button>` : ""; })()}</div>`;
}
function vHoy(k) {
  const { esc, fmt, fmtMin, today, addDays } = C, P = C.S.scoach?.[k], L = loadState(k), nr = nextRace(k), A = adjFor(k);
  const tod = P ? todayFor(k) : [];
  let next = null; if (P && !tod.length) for (let i = 1; i < 14 && !next; i++) { const o = plannedOn(k, addDays(today(), i))[0]; if (o) next = { ...o, in: i }; }
  const ws = C.weekStart(today()), wActs = actsOf(k).filter((a) => a.day >= ws), wMin = wActs.reduce((a, x) => a + (+x.dur || 0), 0) / 60, wKm = wActs.reduce((a, x) => a + (+x.km || 0), 0);
  const cw = P ? curWeek(P) : -1, wPlan = P?.weeks[cw]?.sessions.length || 0, wDone = P?.weeks[cw] ? P.weeks[cw].sessions.filter((_, i) => isDone(k, cw, i)).length : 0;
  const last = actsOf(k).slice(0, 4);
  return `${nr ? `<button class="card sp-race-cd" data-act="sp-tab" data-t="races"><span class="sp-cd"><b>${daysTo(nr.date)}</b><small>días</small></span><span><small class="note">Próxima ${RACE_W(k).one}</small><b>${esc(nr.name)}</b><small class="note">${C.dayLabel(nr.date)}${nr.km ? ` · ${km2(nr.km)} km` : ""}${nr.elev ? ` · ${nr.elev} m+` : ""}</small></span></button>` : ""}
  ${(() => { const la = actsOf(k)[0]; if (!la || la.day < addDays(today(), -3)) return ""; const R = analyze(la); if (!R) return "";
    return `<button class="card sp-last" data-act="ana-open" data-id="${esc(la.id)}"><span class="sp-sc big">${String(R.score).replace(".", ",")}</span><span class="n"><small class="note">Último entreno${la.src === "garmin" ? " · Garmin" : ""} · ${C.dayLabel(la.day)}</small><b>${esc(la.name || C.sportName(la.type))} · ${la.km ? kmTxt(k, la.km) : fmtMin(la.dur)}</b><small class="note">${R.good.length} cosa${R.good.length === 1 ? "" : "s"} bien · ${R.imp.length} a mejorar · Ver análisis completo</small></span><span class="prof-ch" aria-hidden="true">›</span></button>`; })()}
  ${goalCard(k)}
  ${injFor(k, true).length ? `<button class="card sp-inj-box" data-act="inj-open" style="text-align:left;color:inherit;font:inherit;border:0;cursor:pointer;width:100%">🩹 <b>${esc(injAdj(k).why)}</b></button>` : ""}
  ${!P ? `<div class="card sp-cta"><b>Crea tu plan de ${COACH[k].n.toLowerCase()}</b><p class="note">Te preparo los entrenos de cada semana según tu objetivo, y los ajusto a la carga que llevas.</p><button class="btn" data-act="sp-tab" data-t="plan">Crear mi plan</button></div>`
    : tod.length ? `<h2 class="sp-h2">Hoy te toca</h2>${tod.map((o) => sesCard(k, o, { noToday: true })).join("")}`
    : `<div class="card"><b>Hoy toca descanso 😌</b><p class="note" style="margin:0">${next ? `Siguiente: <b>${esc(next.x.title)}</b> ${next.in === 1 ? "mañana" : `el ${DAY_N[next.x.d].toLowerCase()}`}.` : "Descansar también es entrenar."}</p></div>`}
  <div class="card"><div class="top"><h2>Tu carga</h2><span class="sp-pill" style="background:color-mix(in srgb,${L.s.c} 18%,transparent);color:${L.s.c}">${L.s.n}</span></div>
    <div class="sp-load"><div><b>${Math.round(L.ctl)}</b><span>Forma</span></div><div><b>${Math.round(L.atl)}</b><span>Fatiga</span></div><div><b>${L.tsb > 0 ? "+" : ""}${Math.round(L.tsb)}</b><span>Frescura</span></div></div>
    ${sparkLoad(L.hist)}
    <p class="note" style="margin:0">${esc(A.why || L.s.msg)}</p></div>
  <div class="card"><h2>Esta semana</h2><div class="sp-load"><div><b>${P ? `${wDone}/${wPlan}` : wActs.length}</b><span>${P ? "sesiones" : "entrenos"}</span></div><div><b>${fmtMin(wMin * 60)}</b><span>tiempo</span></div>${isEnd(k) ? `<div><b>${km2(wKm)}</b><span>km</span></div>` : `<div><b>${fmt(wActs.reduce((a, x) => a + (+x.kcal || 0), 0))}</b><span>kcal</span></div>`}</div></div>
  ${last.length ? `<div class="card"><div class="top"><h2>Últimos entrenos</h2><button class="link" data-act="sp-tab" data-t="data">Ver todo ›</button></div><div class="list">${last.map(actRow).join("")}</div></div>` : ""}
  <div class="card"><h2>Consejos de tu coach</h2>${(TIPS[k] || []).map((t) => `<p class="note" style="margin:0">• ${esc(t)}</p>`).join("")}${injFor(k).map((x) => RISK[x.part]).filter((t, i, a) => t && a.indexOf(t) === i).map((t) => `<p class="note" style="margin:0">• 🩹 ${esc(t)}</p>`).join("")}</div>
`;
}
function sparkLoad(h) {
  if (!h.length) return ""; const mx = Math.max(1, ...h.map((x) => Math.max(x.ctl, x.atl))), W = 300, H = 60;
  const pts = (f) => h.map((x, i) => `${(i / (h.length - 1)) * W},${H - (f(x) / mx) * (H - 6) - 3}`).join(" ");
  return `<svg class="sp-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Forma y fatiga de las últimas 6 semanas"><polyline points="${pts((x) => x.ctl)}" fill="none" stroke="var(--sp)" stroke-width="2.5"/><polyline points="${pts((x) => x.atl)}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/></svg>
    <div class="sp-leg"><span><i style="background:var(--sp)"></i>Forma (6 semanas)</span><span><i class="dash"></i>Fatiga (7 días)</span></div>`;
}
function actRow(a) {
  const { esc, SPORT_ICO, sportName, actLine, dayLabel } = C;
  const R = analyze(a), src = a.src === "garmin" ? " · Garmin" : a.src === "whoop" ? " · WHOOP" : a.src === "strava" ? " · Strava" : "";
  const inner = `<span class="st-i" aria-hidden="true">${SPORT_ICO(a.type)}</span><span class="n"><b>${esc(a.name || sportName(a.type))}</b><small>${dayLabel(a.day)} · ${actLine(a)}${a.rpe ? ` · esfuerzo ${a.rpe}/10` : ""}${src}</small></span>`;
  return `<button class="li st-act" data-act="ana-open" data-id="${esc(a.id)}">${inner}${R ? `<span class="sp-sc">${String(R.score).replace(".", ",")}</span>` : ""}<span class="prof-ch" aria-hidden="true">›</span></button>`;
}

/* ---------- Plan ---------- */
function planForm(k) {
  const Cc = COACH[k], P = C.S.scoach?.[k]?.req || {}, nr = nextRace(k), o = (id, v, l, cur) => `<label class="seg-o"><input type="radio" name="${id}" value="${v}" ${String(cur) === String(v) ? "checked" : ""}><span>${l}</span></label>`;
  const g0 = P.goal || (nr ? goalFromRace(k, nr.km) : Cc.goals[0][0]);
  return `<div class="card sc-form"><h2>${Cc.e} Tu plan de ${C.esc(Cc.n)}</h2>
    <div class="f"><span>¿Cuál es tu objetivo?</span><div class="seg-g">${Cc.goals.map(([v, l]) => o("scGoal", v, l, g0)).join("")}</div></div>
    <div class="f"><span>Tu nivel</span><div class="seg-g">${o("scLv", "beg", "Empiezo", P.level)}${o("scLv", "mid", "Intermedio", P.level || "mid")}${o("scLv", "adv", "Avanzado", P.level)}</div></div>
    <div class="f"><span>¿Cuántos días a la semana puedes entrenar?</span><div class="seg-g">${[2, 3, 4, 5, 6].map((d) => o("scDays", d, d, P.days || 3)).join("")}</div></div>
    ${k === "run" ? `<label class="f">Marca objetivo (opcional)<input id="scTime" placeholder="h:mm:ss · ej.: 1:40:00" value="${P.goalTime ? hms(P.goalTime) : ""}"><small class="note">Con tu marca objetivo te pongo el ritmo de cada entreno y evalúo cómo vas. Si tu carrera tiene tiempo objetivo, uso ese.</small></label>` : ""}
    ${isEnd(k) && planTarget(k) ? `<p class="note sp-adj" style="margin:0">🏁 Tu plan se prepara para <b>${C.esc(planTarget(k).name)}</b> (tu carrera de más carga) y mete el resto de tus carreras. Cambia tus carreras en «Carreras».</p>` : isEnd(k) ? `<label class="f">Fecha de tu carrera u objetivo (opcional)<input type="date" id="scDate" min="${C.addDays(C.today(), 14)}" value="${C.esc(P.date || (nr && daysTo(nr.date) >= 14 ? nr.date : ""))}"></label>` : ""}
    ${actsOf(k).length ? `<p class="note" style="margin:0">Uso tus últimos entrenos para que el plan empiece a tu nivel actual.</p>` : ""}
    <button class="btn" data-act="sp-make">${C.S.scoach?.[k] ? "Rehacer mi plan" : "Crear mi plan"}</button>
    ${C.S.scoach?.[k] ? `<button class="btn ghost" data-act="sp-edit" data-v="0">Cancelar</button>` : ""}</div>`;
}
function recentLong(k) { const since = C.addDays(C.today(), -28); const l = actsOf(k).filter((a) => a.day >= since).map((a) => (+a.dur || 0) / 60); return l.length ? Math.round(Math.max(...l)) : 0; }
// las carreras que vienen mandan: el plan apunta a la de más carga (distancia + desnivel) y mete las demás con su descanso
export function planTarget(k) {
  const up = racesOf(k).filter((r) => r.date > C.today()).sort((a, b) => a.date < b.date ? -1 : 1);
  if (!up.length || !isEnd(k)) return null;
  const horizon = C.addDays(C.today(), 24 * 7), inH = up.filter((r) => r.date <= horizon);
  const L = inH.length ? inH : [up[0]];
  return L.reduce((b, r) => raceMinutes(k, r) > raceMinutes(k, b) + 1e-6 ? r : b);
}
export function makePlanFor(k, req) {
  const T = planTarget(k), base = { ...req, recentLong: recentLong(k) };
  const rq = T ? { ...base, ...raceReq(k, T) } : { ...base, raceId: "", raceName: "", peak: 0, taper: 0 };
  let P = makeCoachPlan(k, rq, C.today());
  P = insertRaces(P, racesOf(k).filter((r) => r.date >= C.today()));
  P.done = {}; P.races = racesSig(k);
  const out = C.put("sportcoach", { plans: { ...(C.S.scoach || {}), [k]: P } });
  return out.then((x) => { for (const a of actsOf(k)) if (a.day >= P.start) autoMark(k, a.day); return x; });
}
const racesSig = (k) => racesOf(k).filter((r) => r.date >= C.today()).map((r) => `${r.id}:${r.date}:${r.km || 0}:${r.elev || 0}`).sort().join("|");
// si cambian las carreras (o ya pasó la carrera objetivo), rehace el plan con tus mismas respuestas
export function syncPlan(k) {
  const P = C.S.scoach?.[k]; if (!P) return;
  const passed = P.req.raceId && P.req.date && P.req.date < C.today();
  if ((P.races ?? "") === racesSig(k) && !passed) return;
  const { goal, level, days, goalTime } = P.req; return makePlanFor(k, { goal, level, days, goalTime, date: passed ? "" : P.req.date });
}
const DAY3 = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
function weekBlock(k, P, w, cur) {
  const { esc, fmtMin } = C, list = weekSessions(k, w), wk = P.weeks[w], a0 = C.addDays(P.start, w * 7), a6 = C.addDays(a0, 6), d0 = C.parseDay(a0);
  const done = actsOf(k).filter((a) => a.day >= a0 && a.day <= a6), el = hasElev(k);
  const pKm = list.reduce((s, x) => s + (x.t === "RACE" ? 0 : x.km || 0), 0), pEl = list.reduce((s, x) => s + (x.elev || 0), 0), pMin = list.reduce((s, x) => s + (x.dur || 0), 0);
  const dKm = done.reduce((s, x) => s + (+x.km || 0), 0), dEl = done.reduce((s, x) => s + (+x.elev || 0), 0), dMin = done.reduce((s, x) => s + (+x.dur || 0), 0) / 60;
  const fk = (km) => kmTxt(k, Math.round(km * 10) / 10);
  const phase = wk.phase.includes("descarga") ? "Recuperación" : wk.phase;
  const tot = isEnd(k) ? `Plan ${fk(pKm)}${el ? ` · ${Math.round(pEl)} m+` : ""} — Hecho ${fk(dKm)}${el ? ` · ${Math.round(dEl)} m+` : ""}` : `Plan ${fmtMin(pMin * 60)} — Hecho ${fmtMin(dMin * 60)}`;
  const rows = list.map((x, i) => { const dn = isDone(k, w, i), day = C.addDays(a0, x.d);
    const ev = evalSes(k, w, i, x), meta = [x.km ? kmTxt(k, x.km) : x.t === "RACE" ? "" : x.dur ? fmtMin(x.dur * 60) : "", x.elev ? `${x.elev} m+` : "", x.paceTxt || x.zone || "", ev ? `⭐ ${ev.score}/10` : ""].filter(Boolean).join(" · ");
    return `<li><button class="pw-row ${dn ? "done" : ""} ${day === C.today() ? "hoy" : ""}" data-act="sp-ses" data-w="${w}" data-i="${i}"><span class="pw-dot" aria-hidden="true">${dn ? "✓" : ""}</span><span class="pw-t"><span>${DAY3[x.d]}: <b>${esc(x.title)}</b>${meta ? ` — ${meta}` : ""}</span><small>${esc(x.short || "")}</small></span></button></li>`; }).join("");
  return `<details class="card pw" ${w === cur ? "open" : ""}><summary><span class="pw-h"><b>Sem. ${w + 1}</b> · ${d0.getDate()} ${MON3[d0.getMonth()].toLowerCase()} ${String(d0.getFullYear()).slice(2)} <i class="pw-ph ${phase === "Recuperación" ? "rec" : ""}">${esc(phase)}</i>${w === cur ? `<i class="pw-now">Esta semana</i>` : ""}</span><small>${tot}</small></summary>
    <ul class="pw-list">${rows}</ul></details>`;
}
function vPlan(k) {
  const { esc } = C, P = C.S.scoach?.[k];
  if (!P || st.edit) return planForm(k);
  const cur = curWeek(P), all = P.weeks.reduce((n, x) => n + x.sessions.length, 0), dn = Object.keys(P.done || {}).length, A = adjFor(k), src = paceFor(k).src;
  return `<div class="card sc-hero"><span class="sc-e" aria-hidden="true">${COACH[k].e}</span><div><b>${esc(goalName(k, P.req.goal))}</b><span class="note">${P.req.date ? `Para el ${C.parseDay(P.req.date).getDate()} de ${MONTHS[C.parseDay(P.req.date).getMonth()]} · ` : ""}${P.req.days} días/semana · ${P.weeks.length} semanas · ${dn}/${all} hechas</span></div></div>
  ${A.f !== 1 || A.easy ? `<div class="sp-adj">⚙️ ${esc(A.why)}</div>` : ""}
  ${cur >= P.weeks.length ? `<div class="card"><b>🎉 ¡Plan terminado!</b><p class="note">Crea uno nuevo para seguir mejorando.</p><button class="btn" data-act="sp-edit" data-v="1">Nuevo plan</button></div>` : ""}
  ${P.weeks.map((_, w) => weekBlock(k, P, w, cur)).join("")}
  ${isEnd(k) ? `<p class="note">Toca un entreno para ver el detalle, grabarlo o marcarlo como hecho. Distancias calculadas con ${src}${src === "tu nivel" ? "; pon tu ritmo en Datos › Zonas para afinarlas" : ""}. Z = zona de intensidad (míralas en Datos › Zonas).</p>` : `<p class="note">Toca un entreno para ver el detalle o marcarlo como hecho.</p>`}
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
    <span class="n"><b>${esc(r.name)}${C.S.scoach?.[k]?.req?.raceId === r.id && r.date >= C.today() ? ` <i class="sp-prio pA">Objetivo del plan</i>` : ""}</b><small>${[r.km ? km2(r.km) + " km" : "", r.elev ? r.elev + " m+" : "", r.kind || ""].filter(Boolean).join(" · ")}${r.goal && fut ? ` · objetivo ${hms(r.goal)}` : ""}</small>
    ${fut ? `<small class="sp-in">${dd === 0 ? "¡Hoy!" : dd === 1 ? "Mañana" : `En ${dd} días`}</small>` : res ? `<small class="sp-res">${res}</small>` : `<small class="note">Toca para poner tu resultado</small>`}</span><span class="prof-ch" aria-hidden="true">›</span></button>`;
}
function vRaces(k) {
  const R = racesOf(k), up = R.filter((r) => r.date >= C.today()).sort((a, b) => a.date < b.date ? -1 : 1), past = R.filter((r) => r.date < C.today()).sort((a, b) => a.date < b.date ? 1 : -1), W = RACE_W(k);
  return `<button class="btn block" data-act="sp-race-new">+ ${W.add}</button>
  <h2 class="sp-h2">Próxim${W.one === "partido" || W.one === "combate" ? "o" : "a"}s</h2>${up.map((r) => raceRow(k, r)).join("") || `<p class="note">No tienes ${W.many.toLowerCase()} apuntad${W.one === "carrera" ? "a" : "o"}s. ${isEnd(k) ? "Guarda tu próxima carrera y tu plan se preparará para ella." : ""}</p>`}
  ${past.length ? `<h2 class="sp-h2">Hechas</h2>${past.map((r) => raceRow(k, r)).join("")}` : ""}`;
}
export function openRace(k, id, day) {
  const { esc } = C, r = (C.S.races || []).find((x) => x.id === id) || { sport: k, date: day || C.today() }, W = RACE_W(k), end = isEnd(k), fut = r.date >= C.today();
  const ro = (v, l) => `<label class="seg-o"><input type="radio" name="rRes" value="${v}" ${r.res === v ? "checked" : ""}><span>${l}</span></label>`;
  C.openSheet(id ? r.name : W.add, `<label class="f">${end ? "Nombre de la carrera" : k === "boxing" ? "Rival o evento" : "Rival o torneo"}<input id="rName" value="${esc(r.name || "")}" placeholder="${end ? "Ej.: Behobia-San Sebastián" : "Ej.: vs. CD Ejemplo"}"></label>
    <label class="f">Fecha<input type="date" id="rDate" value="${esc(r.date)}"></label>
    ${end ? `<div class="grid2"><label class="f">Distancia (km)<input id="rKm" inputmode="decimal" value="${r.km ? String(r.km).replace(".", ",") : ""}"></label>${hasElev(k) ? `<label class="f">Desnivel + (m)<input id="rElev" inputmode="numeric" value="${r.elev || ""}"></label>` : `<label class="f">Tiempo objetivo<input id="rGoal" placeholder="h:mm:ss" value="${r.goal ? hms(r.goal) : ""}"></label>`}</div>
      ${hasElev(k) ? `<label class="f">Tiempo objetivo<input id="rGoal" placeholder="h:mm:ss" value="${r.goal ? hms(r.goal) : ""}"></label>` : ""}
      ${fut ? `<p class="note" style="margin:0">🔄 Al guardar, tu plan se rehace solo: se prepara para tu carrera de más carga y mete las demás con días suaves antes y recuperación después, según su distancia y desnivel.</p>` : ""}
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
    ...(isEnd(k) ? { km: +v("rKm").replace(",", ".") || 0, elev: +v("rElev") || 0, goal: parseT(v("rGoal")), time: parseT(v("rTime")), pos: v("rPos") }
      : { kind: v("rKind"), res: radio("rRes"), score: v("rScore"), min: +v("rMin") || 0 }) };
  await C.put("races", { list: [r, ...(C.S.races || []).filter((x) => x.id !== r.id)] });
  let msg = "";
  if (r.date >= C.today()) {
    const old = C.S.scoach?.[k]?.req || {};
    await makePlanFor(k, { goalTime: old.goalTime, goal: old.goal || (isEnd(k) ? goalFromRace(k, raceEffortKm(k, r)) : COACH[k].goals[0][0]), level: old.level || "mid", days: old.days || (isEnd(k) ? 4 : 3), date: "" });
    const T = planTarget(k); msg = T ? `Plan rehecho: preparo ${T.name}${T.id !== r.id ? ` y meto ${r.name} con sus días suaves y de recuperación` : ""}.` : `Plan actualizado con ${r.name}.`;
    st.tab = "plan"; st.week = null;
  } else await syncPlan(k);
  st.msg = msg; C.closeSheet(); C.render(); scrollTo(0, 0);
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
  if (w != null && !isNaN(w)) await setDone(k, w, i, true); else await autoMark(k, day);
  C.closeSheet(); C.render(); C.confetti();
  const o = plannedOn(k, day).find((o) => evalSes(k, o.w, o.i, o.x));
  if (o) C.openSheet("Evaluación de tu entreno", sesCard(k, o, { noToday: true }));
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
    case "sp-tab": { const t = d.t; st.tab = { cal: "plan", races: "plan", data: "prog" }[t] || t; if (t === "cal") st.month = true; st.week = null; C.render(); scrollTo(0, 0); return true; }
    case "sp-month": st.month = d.v === "1"; C.render(); return true;
    case "sp-add": C.openSheet("Añadir", `<div class="sp-addl">${COACH[k].gps ? `<button class="prof-row" data-act="sp-gps"><span class="prof-ic">▶️</span><span class="prof-t"><b>Grabar con GPS</b><small>Empieza ahora y te mide distancia y ritmo</small></span></button>` : ""}
      <button class="prof-row" data-act="sp-reg"><span class="prof-ic">✍️</span><span class="prof-t"><b>Registrar entreno</b><small>Uno que ya hiciste sin reloj</small></span></button>
      <button class="prof-row" data-act="sp-race-new"><span class="prof-ic">🏁</span><span class="prof-t"><b>Añadir carrera</b><small>Tu plan se adapta solo</small></span></button>
      <button class="prof-row" data-act="inj-new"><span class="prof-ic">🩹</span><span class="prof-t"><b>Añadir lesión</b><small>Para que el plan la tenga en cuenta</small></span></button></div>`); return true;
    case "sp-week": st.week = +d.w; C.render(); return true;
    case "sp-edit": st.edit = d.v === "1"; C.render(); scrollTo(0, 0); return true;
    case "sp-make": { const r = (n) => document.querySelector(`input[name=${n}]:checked`)?.value;
      makePlanFor(k, { goal: r("scGoal"), level: r("scLv") || "mid", days: +r("scDays") || 3, date: C.$("scDate")?.value || "", goalTime: parseT(C.$("scTime")?.value || "") }).then(() => { st.edit = false; st.week = null; C.render(); scrollTo(0, 0); }); return true; }
    case "sp-del-plan": if (d.sure) { const P = { ...C.S.scoach }; delete P[k]; C.put("sportcoach", { plans: P }).then(C.render); } else { d.sure = 1; el.textContent = "Toca otra vez para borrar el plan"; } return true;
    case "sp-done": setDone(k, +d.w, +d.i); if (C.$("sheet") && !C.$("sheet").hidden) C.closeSheet(); C.render(); return true;
    case "sp-ses": { const x = weekSessions(k, +d.w)[+d.i]; if (x) C.openSheet(DAY_N[x.d], sesCard(k, { x, w: +d.w, i: +d.i }, { noToday: true })); return true; }
    case "sp-gps": C.closeSheet(); C.trkStart(COACH[k].gps, d.w != null ? { k, w: +d.w, i: +d.i } : { k }); return true;
    case "sp-reg": openReg(k, d.w != null ? +d.w : null, d.i != null ? +d.i : null); return true;
    case "sp-reg-save": saveReg(k, d.w != null ? +d.w : null, d.i != null ? +d.i : null); return true;
    case "sp-cal": st.cal = +d.v; C.render(); return true;
    case "sp-day": st.day = d.d; C.render(); return true;
    case "sp-race-new": openRace(k, null, d.d || null); return true;
    case "sp-race-edit": openRace(k, d.id); return true;
    case "sp-race-save": saveRace(k, d.id || null); return true;
    case "sp-race-del": if (d.sure) { C.put("races", { list: (C.S.races || []).filter((r) => r.id !== d.id) }).then(() => syncPlan(k)).then(() => { st.msg = "Carrera borrada: he ajustado tu plan."; C.closeSheet(); C.render(); }); } else { d.sure = 1; el.textContent = "Toca otra vez para borrar"; } return true;
    case "sp-data": st.data = d.v; C.render(); return true;
    case "sp-per": st.per = d.v; st.off = 0; C.render(); return true;
    case "sp-off": st.off = +d.v; C.render(); return true;
    case "sp-z-calc": zCalc(); return true;
    case "sp-z-save": zSave(k); return true;
  }
  return false;
}

/* ---------- Objetivo de marca, ritmos, predicción y evaluación ---------- */
const GOAL_KM = { "5k": 5, "10k": 10, "21k": 21.0975, "42k": 42.195 };
const riegel60 = (km, sec) => 3600 / (km * Math.pow(3600 / sec, 1 / 1.06));           // ritmo umbral (s/km) a partir de una marca
const predict = (thr, km) => 3600 * Math.pow(km / (3600 / thr), 1.06);
export function goalInfo(k) {
  if (k !== "run") return null; const P = C.S.scoach?.[k]; if (!P) return null;
  const T = planTarget(k), km = T?.km || GOAL_KM[P.req.goal], time = (T?.goal) || P.req.goalTime;
  if (!(km > 0 && time > 0)) return null;
  return { km, time, rp: time / km, thr: riegel60(km, time), name: T?.name || goalName(k, P.req.goal) };
}
// tu nivel actual (ritmo umbral estimado) con tus carreras y entrenos duros de las últimas 6 semanas
function thrNow(k) {
  const since = C.addDays(C.today(), -42), ests = [];
  for (const r of racesOf(k)) if (r.time && r.km && r.date >= C.addDays(C.today(), -120) && r.date < C.today()) ests.push(riegel60(r.km, r.time));
  for (const a of actsOf(k)) if (a.day >= since && a.km >= 3 && a.dur > 0 && (+a.rpe >= 7 || (a.hr && hrMax(k) && a.hr / hrMax(k) >= 0.85))) ests.push(riegel60(a.km, a.dur) * (a.rpe >= 9 || (a.hr && a.hr / hrMax(k) >= 0.9) ? 1 : 1.03));
  if (ests.length) return { thr: Math.min(...ests), src: "tus entrenos duros y carreras" };
  if (zonesOf(k).thr) return { thr: zonesOf(k).thr, src: "tu ritmo umbral" };
  const easy = actsOf(k).filter((a) => a.day >= since && a.km >= 3 && a.dur > 0).map((a) => a.dur / a.km).sort((a, b) => a - b);
  if (easy.length >= 3) return { thr: easy[Math.floor(easy.length / 2)] / 1.27, src: "tus rodajes (aproximado)" };
  return null;
}
function paceRange(k, x) {
  if (k !== "run") return null; const G = goalInfo(k), thr = G?.thr || zonesOf(k).thr; if (!thr) return null;
  if (x.t === "E" || x.t === "L") return [thr * 1.2, thr * 1.32];
  if (x.t === "R") return [thr * 1.3, thr * 1.45];
  if (x.t !== "Q") return null; const t = x.title || "";
  if (/Series/.test(t)) return [thr * 0.92, thr * 0.96];
  if (/umbral/i.test(t)) return [thr * 0.98, thr * 1.03];
  if (/cambios/.test(t)) return [thr * 1.2, thr * 1.32];
  return null;
}
function actForSes(k, w, x) {
  const P = C.S.scoach?.[k]; if (!P) return null; const day = C.addDays(P.start, w * 7 + x.d);
  return actsOf(k).find((a) => a.day === day) || null;
}
const evCache = new Map();
export function evalSes(k, w, i, x) {
  if (!isEnd(k) || ["S", "RACE"].includes(x.t)) return null;
  const a = actForSes(k, w, x); if (!a) return null;
  const ck = `${k}|${w}|${i}|${a.id}|${a.km}|${a.dur}|${a.rpe}|${x.km}|${x.paceTxt}`; if (evCache.has(ck)) return evCache.get(ck);
  const L = [], easy = x.t === "E" || x.t === "L" || x.t === "R"; let sc = 10;
  if (x.km && a.km) { const r = a.km / x.km;
    if (r < 0.8) { sc -= 2; L.push(`Te quedaste corto: ${km2(a.km)} de ${km2(x.km)} km.`); }
    else if (r > 1.25) { sc -= 1; L.push(`Hiciste bastante más de lo previsto (${km2(a.km)} de ${km2(x.km)} km): cuidado con pasarte de carga.`); }
    else L.push(`Distancia cumplida: ${km2(a.km)} km de ${km2(x.km)}.`); }
  const p = a.km > 0 ? a.dur / a.km : 0;
  if (x.pace && p && easy) {
    if (p < x.pace[0] * 0.97) { sc -= 2; L.push(`Ritmo ${paceS(p)} /km: demasiado rápido para este entreno (objetivo ${x.paceTxt}). Los suaves tienen que ser suaves para recuperar y mejorar.`); }
    else if (p > x.pace[1] * 1.08) { sc -= 0.5; L.push(`Ritmo ${paceS(p)} /km, algo más lento de lo previsto: bien si estabas cansado o había cuestas.`); }
    else L.push(`Ritmo perfecto: ${paceS(p)} /km (objetivo ${x.paceTxt}).`);
  } else if (x.t === "Q" && p) L.push(`Ritmo medio ${paceS(p)} /km (incluye calentamiento y vuelta a la calma)${x.paceTxt ? `; las series, a ${x.paceTxt}` : ""}.`);
  if (x.t === "Q" && a.rpe) {
    if (a.rpe < 6) { sc -= 1.5; L.push(`Esfuerzo ${a.rpe}/10: parece que no apretaste lo suficiente en la parte fuerte.`); }
    else if (a.rpe >= 10) { sc -= 1; L.push("Esfuerzo máximo: las series deben ser duras pero controladas, hasta 8-9/10."); }
    else L.push(`Esfuerzo ${a.rpe}/10: justo lo que pedía la sesión.`);
  }
  if (easy && a.rpe >= 7) { sc -= 1.5; L.push(`Esfuerzo ${a.rpe}/10, alto para un entreno suave. Duerme y come bien; si se repite, baja el ritmo.`); }
  const mx = hrMax(k); if (easy && a.hr && mx && a.hr / mx > 0.8) { sc -= 1; L.push(`Pulso medio ${a.hr} ppm (${Math.round(a.hr / mx * 100)} % de tu máximo): alto para zona 2.`); }
  const score = Math.max(1, Math.min(10, Math.round(sc * 2) / 2)), out = { score, verdict: score >= 8.5 ? "Muy bien" : score >= 6.5 ? "Bien" : "Mejorable", lines: L, a };
  evCache.set(ck, out); return out;
}
function evalBox(k, w, i, x) {
  const ev = evalSes(k, w, i, x); if (!ev) return "";
  const c = ev.score >= 8.5 ? "#2BB673" : ev.score >= 6.5 ? "#E0A800" : "#E8364F";
  return `<div class="sp-eval" style="--ev:${c}"><div class="sp-ev-h"><b>${String(ev.score).replace(".", ",")}/10</b><span>${ev.verdict}</span><small>Evaluación de tu entreno</small></div><ul>${ev.lines.map((l) => `<li>${C.esc(l)}</li>`).join("")}</ul></div>`;
}
const fmtT = (sec) => hms(Math.round(sec));
function goalCard(k) {
  const G = goalInfo(k); if (!G) return k === "run" && C.S.scoach?.[k] ? `<button class="card sp-cta" data-act="sp-edit" data-v="1" style="text-align:left;color:inherit;font:inherit;border:0;cursor:pointer;width:100%"><b>🎯 Ponte una marca objetivo</b><span class="note">Por ejemplo, media maratón en menos de 1:40. Te pongo el ritmo de cada entreno, evalúo cada uno y te digo si vas en camino.</span></button>` : "";
  const N = thrNow(k), pred = N ? predict(N.thr, G.km) : 0, diff = pred - G.time;
  const P = C.S.scoach[k], cw = curWeek(P), evs = []; for (const w of [cw, cw - 1]) if (P.weeks[w]) weekSessions(k, w).forEach((x, i) => { const e = evalSes(k, w, i, x); if (e) evs.push(e); });
  const avg = evs.length ? evs.reduce((s, e) => s + e.score, 0) / evs.length : 0, fast = evs.filter((e) => e.lines.some((l) => /demasiado rápido/.test(l))).length;
  const pct = pred ? Math.max(5, Math.min(100, Math.round(G.time / pred * 100))) : 0;
  return `<div class="card sp-goal"><span class="note">Tu objetivo</span><b class="sp-goal-t">${C.esc(G.name)} en ${fmtT(G.time)}</b>
    <div class="sp-load"><div><b>${paceS(G.rp)}</b><span>ritmo de carrera /km</span></div><div><b>${pred ? fmtT(pred) : "—"}</b><span>predicción hoy</span></div></div>
    ${pred ? `<div class="gh-bar" style="--tc:${diff <= 0 ? "#2BB673" : "var(--sp)"}"><i style="width:${pct}%"></i></div>
      <p class="note" style="margin:0">${diff <= 0 ? `✅ ¡Vas en camino! Hoy podrías hacer unos ${fmtT(pred)}, ${fmtT(-diff)} por debajo de tu objetivo.` : `Te faltan unos <b>${fmtT(diff)}</b> para tu objetivo. ${diff / G.time < 0.05 ? "Estás muy cerca: sigue el plan." : "Con el plan vas a ir recortando: la predicción se actualiza con tus series y carreras."}`} <small>(calculado con ${N.src})</small></p>`
      : `<p class="note" style="margin:0">Registra entrenos con su esfuerzo (sobre todo las series) y te diré qué tiempo podrías hacer hoy.</p>`}
    <p class="note sp-paces" style="margin:0">Tus ritmos: <b>suave ${paceS(G.thr * 1.2)}–${paceS(G.thr * 1.32)}</b> · <b>umbral ${paceS(G.thr * 0.98)}–${paceS(G.thr * 1.03)}</b> · <b>series ${paceS(G.thr * 0.92)}–${paceS(G.thr * 0.96)}</b> /km</p>
    ${evs.length ? `<p class="note" style="margin:0">📋 Últimas 2 semanas: nota media <b>${String(Math.round(avg * 10) / 10).replace(".", ",")}/10</b> en ${evs.length} entreno${evs.length > 1 ? "s" : ""}.${fast ? ` ${fast} rodaje${fast > 1 ? "s" : ""} demasiado rápido${fast > 1 ? "s" : ""}: los suaves, suaves.` : ""}</p>` : ""}</div>`;
}

/* ========== LESIONES ========== */
export const INJ_PARTS = [["rodilla", "Rodilla"], ["tobillo", "Tobillo"], ["aquiles", "Tendón de Aquiles"], ["gemelo", "Gemelo / sóleo"], ["espinilla", "Espinilla (periostitis)"],
  ["pie", "Pie / fascia plantar"], ["isquio", "Isquiotibiales"], ["cuadriceps", "Cuádriceps"], ["cadera", "Cadera / glúteo"], ["ingle", "Ingle / aductores"],
  ["cintilla", "Cintilla iliotibial"], ["lumbar", "Espalda baja"], ["hombro", "Hombro"], ["codo", "Codo"], ["muneca", "Muñeca"], ["cuello", "Cuello"], ["otra", "Otra zona"]];
const INJ_TYPES = ["Sobrecarga o tendinitis", "Rotura fibrilar", "Esguince", "Fractura por estrés", "Contractura", "Fascitis", "Operación", "Otra"];
const INJ_ST = { act: ["Activa", "#E8364F"], rec: ["Recuperándome", "#F08A24"], ok: ["Recuperada", "#2BB673"] };
const LOWER = ["rodilla", "tobillo", "aquiles", "gemelo", "espinilla", "pie", "isquio", "cuadriceps", "cadera", "ingle", "cintilla", "lumbar"];
const RELEV = { run: LOWER, trail: LOWER, hike: LOWER, football: LOWER, basket: LOWER, bike: ["rodilla", "cadera", "lumbar", "cuello", "cintilla"], swim: ["hombro", "cuello", "lumbar"],
  padel: [...LOWER, "hombro", "codo", "muneca"], tennis: [...LOWER, "hombro", "codo", "muneca"], boxing: ["hombro", "codo", "muneca", "cuello", "lumbar"] };
const PREV = {
  rodilla: "Sentadilla isométrica en pared 3×40 s · Step-down excéntrico 3×10 por pierna", tobillo: "Equilibrio a una pierna 3×30 s · Saltos pequeños controlados 3×10",
  aquiles: "Elevación de talón excéntrica (bajar lento) 3×15", gemelo: "Elevación de gemelos con rodilla doblada (sóleo) 3×15", espinilla: "Caminar de talones 3×30 m · Tibial con goma 3×15",
  pie: "Recoger una toalla con los dedos 3×30 s · Rodar el pie con una pelota 2 min", isquio: "Curl nórdico 3×5 · Puente de isquios a una pierna 3×10", cuadriceps: "Extensión de cuádriceps excéntrica 3×10",
  cadera: "Puente de glúteo a una pierna 3×12 · Monster walk con goma 3×15 pasos", ingle: "Plancha Copenhague 3×20 s · Aducción con goma 3×12", cintilla: "Abducción de cadera tumbado 3×15 · Monster walk con goma 3×15",
  lumbar: "Bird-dog 3×10 · Plancha lateral 3×30 s · Puente de glúteo 3×12", hombro: "Rotación externa con goma 3×15 · Face pull 3×12", codo: "Extensión de muñeca excéntrica 3×15",
  muneca: "Flexo-extensión de muñeca con mancuerna ligera 3×15", cuello: "Retracciones de cuello 3×10 · Estiramiento suave de trapecio",
};
const RISK = {
  rodilla: "Con historial de rodilla: cadencia alta (pasos cortos) y sin subir más de un 10 % el volumen a la semana.", aquiles: "Con historial de Aquiles: cuidado con meter muchas cuestas o series de golpe.",
  espinilla: "Con historial de periostitis: mejor tierra que asfalto y subidas de volumen muy graduales.", pie: "Con historial de fascia: revisa el desgaste de las zapatillas y trabaja gemelo y pie.",
  cintilla: "Con historial de cintilla: refuerza el glúteo medio y evita muchas bajadas seguidas.", isquio: "Con historial de isquios: calienta bien antes de series y sprints.",
  gemelo: "Con historial de gemelo: calienta progresivo y cuidado con cambios bruscos de ritmo.", tobillo: "Con historial de tobillo: ojo en terreno técnico; trabaja el equilibrio.",
  lumbar: "Con historial lumbar: core fuerte y no te encorves en las tiradas largas.", hombro: "Con historial de hombro: calienta el hombro antes de jugar.",
};
const injList = () => (C.S.injuries || []).slice().sort((a, b) => (a.status === "ok") - (b.status === "ok") || (a.date < b.date ? 1 : -1));
const partName = (p) => INJ_PARTS.find((x) => x[0] === p)?.[1] || "Otra zona";
export function injFor(k, onlyOpen) {
  const since = C.addDays(C.today(), -730);
  return injList().filter((x) => (RELEV[k] || LOWER).includes(x.part) && (onlyOpen ? x.status !== "ok" : (x.status !== "ok" || x.date >= since)));
}
export function injAdj(k) {
  const act = injFor(k, true); if (!act.length) return null;
  const hard = act.some((x) => x.status === "act"), names = [...new Set(act.map((x) => partName(x.part).toLowerCase()))].join(", ");
  return hard ? { f: 0.6, easy: true, why: `Tienes una lesión activa (${names}): plan muy suave y sin series. Si duele al entrenar, para y consulta a tu fisio.` }
    : { f: 0.85, easy: true, why: `Te estás recuperando (${names}): volumen algo más bajo y sin series hasta que estés recuperado.` };
}
function prevBox(k) {
  const L = [...new Set(injFor(k).map((x) => x.part))].filter((p) => PREV[p]); if (!L.length) return "";
  return `<div class="sp-inj-box">🩹 <b>Prevención por tus lesiones</b>${L.map((p) => `<br>· ${partName(p)}: ${C.esc(PREV[p])}`).join("")}</div>`;
}
export function openInjuries() {
  const { esc } = C, L = injList();
  C.openSheet("Historial de lesiones", `<p class="note" style="margin:0">Tu preparador lo tiene en cuenta: si tienes una lesión activa, el plan baja la carga y quita las series; si ya estás recuperado, añade ejercicios de prevención a tus sesiones de fuerza y te avisa en los análisis.</p>
    ${L.map((x) => `<button class="card sp-inj" data-act="inj-edit" data-id="${esc(x.id)}"><span class="sp-inj-dot" style="background:${INJ_ST[x.status]?.[1] || "#8A93A6"}"></span><span class="n"><b>${esc(partName(x.part))}${x.side && x.side !== "na" ? ` (${x.side === "i" ? "izquierda" : x.side === "d" ? "derecha" : "ambas"})` : ""}</b><small>${esc(x.type || "")} · ${x.date ? C.dayLabel(x.date) : ""} · <span style="color:${INJ_ST[x.status]?.[1]}">${INJ_ST[x.status]?.[0] || ""}</span></small>${x.notes ? `<small>${esc(x.notes)}</small>` : ""}</span><span class="prof-ch" aria-hidden="true">›</span></button>`).join("") || `<p class="note">Aún no has apuntado ninguna lesión.</p>`}
    <button class="btn" data-act="inj-new">+ Añadir lesión</button>
    <p class="note" style="margin:0">No sustituye a un fisioterapeuta o médico: ante dolor que no se va, consulta a un profesional.</p>`, { kind: "inj" });
}
function injForm(id) {
  const { esc } = C, x = (C.S.injuries || []).find((y) => y.id === id) || { status: "act", date: C.today(), side: "na" };
  const ro = (n, v, l, cur) => `<label class="seg-o"><input type="radio" name="${n}" value="${v}" ${cur === v ? "checked" : ""}><span>${l}</span></label>`;
  C.openSheet(id ? "Editar lesión" : "Añadir lesión", `<label class="f">Zona<select id="injPart">${INJ_PARTS.map(([v, l]) => `<option value="${v}" ${x.part === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <div class="f"><span>Lado</span><div class="seg-g">${ro("injSide", "i", "Izquierdo", x.side)}${ro("injSide", "d", "Derecho", x.side)}${ro("injSide", "b", "Ambos", x.side)}${ro("injSide", "na", "No aplica", x.side)}</div></div>
    <label class="f">Tipo<select id="injType">${INJ_TYPES.map((t) => `<option ${x.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="f">¿Cuándo empezó?<input type="date" id="injDate" value="${esc(x.date || "")}" max="${C.today()}"></label>
    <div class="f"><span>Estado</span><div class="seg-g">${ro("injSt", "act", "Activa (me duele)", x.status)}${ro("injSt", "rec", "Recuperándome", x.status)}${ro("injSt", "ok", "Recuperada", x.status)}</div></div>
    <label class="f">Notas (opcional)<input id="injNotes" value="${esc(x.notes || "")}" placeholder="Qué la provocó, qué te dijo el fisio…"></label>
    ${C.S.injConsent ? "" : `<label class="tgl"><input type="checkbox" id="injOk"><span>Acepto que la app guarde mis lesiones (datos de salud) para adaptar mi entrenamiento. Solo las veo yo y puedo borrarlas cuando quiera.</span></label>`}
    <span class="msg" id="injMsg" hidden></span>
    <button class="btn" data-act="inj-save" data-id="${esc(id || "")}">Guardar</button>
    ${id ? `<button class="btn danger" data-act="inj-del" data-id="${esc(id)}">Borrar</button>` : ""}
    <button class="btn ghost" data-act="inj-open">Volver</button>`, { kind: "inj" });
}
async function injSave(id) {
  const $ = C.$; if (!C.S.injConsent && !$("injOk")?.checked) { const m = $("injMsg"); m.textContent = "Para guardar tus lesiones tienes que aceptar la casilla."; m.hidden = false; return; }
  const r = (n) => document.querySelector(`input[name=${n}]:checked`)?.value;
  const x = { id: id || "i" + Date.now(), part: $("injPart").value, side: r("injSide") || "na", type: $("injType").value, date: $("injDate").value || C.today(), status: r("injSt") || "act", notes: $("injNotes").value.trim() };
  await C.put("injuries", { consent: true, list: [x, ...(C.S.injuries || []).filter((y) => y.id !== x.id)] });
  openInjuries(); C.render();
}
export function injAction(act, el) {
  const d = el.dataset;
  switch (act) {
    case "inj-open": openInjuries(); return true;
    case "inj-new": injForm(null); return true;
    case "inj-edit": injForm(d.id); return true;
    case "inj-save": injSave(d.id || null); return true;
    case "inj-del": if (d.sure) C.put("injuries", { consent: true, list: (C.S.injuries || []).filter((y) => y.id !== d.id) }).then(() => { openInjuries(); C.render(); }); else { d.sure = 1; el.textContent = "Toca otra vez para borrar"; } return true;
  }
  return false;
}

/* ========== ANÁLISIS COMPLETO DE UN ENTRENO ========== */
function hrZonesOf(k) { const mx = hrMax(k); if (!mx) return null; const rs = +zonesOf(k).hrrest || 0; return [0.6, 0.7, 0.8, 0.9].map((p) => Math.round(rs ? rs + (mx - rs) * p : mx * p)); }
export function analyze(a) {
  const k = sportOf(a); if (!k) return null;
  const good = [], imp = [], info = [], run = k === "run" || k === "trail", p = a.km > 0 ? a.dur / a.km : 0;
  // contra el plan
  let ses = null, ev = null; const P = C.S.scoach?.[k];
  if (P) { const o = plannedOn(k, a.day).find((o) => o.x.t !== "RACE"); if (o) { ses = o; ev = evalSes(k, o.w, o.i, o.x); } }
  const easy = ses ? ["E", "L", "R"].includes(ses.x.t) : (a.rpe ? a.rpe <= 5 : true);
  if (ev) for (const l of ev.lines) (/perfecto|cumplida|justo lo que/.test(l) ? good : /^Ritmo medio/.test(l) ? info : imp).push(l);
  else if (!P) info.push("No tienes plan en este deporte: crea uno en «Plan» y podré compararlo con lo que te tocaba.");
  else info.push("Hoy no tenías ningún entreno en el plan: cuenta como extra para tu carga.");
  const g0 = good.length, i0 = imp.length;
  // pulso por zonas
  const Z = hrZonesOf(k), hh = a.det?.hh; let zp = null;
  if (Z && hh) {
    const sec = [0, 0, 0, 0, 0]; for (const [b, s] of Object.entries(hh)) { const bpm = +b + 2; const z = bpm < Z[0] ? 0 : bpm < Z[1] ? 1 : bpm < Z[2] ? 2 : bpm < Z[3] ? 3 : 4; sec[z] += s; }
    const tot = sec.reduce((x, y) => x + y, 0) || 1; zp = sec.map((s) => Math.round(s / tot * 100));
    const hard = zp[3] + zp[4], lowZ = zp[0] + zp[1];
    if (easy) { if (zp[2] + hard > 25) imp.push(`El ${zp[2] + hard} % del tiempo fuiste en zona 3 o más: para un entreno suave, lo ideal es más del 80 % en zonas 1-2.`); else good.push(`Buen control del pulso: ${lowZ} % del tiempo en zonas 1-2, justo lo que pide un entreno suave.`); }
    else { if (hard >= 15) good.push(`Trabajaste de verdad la intensidad: ${hard} % del tiempo en zonas 4-5.`); else imp.push(`Solo un ${hard} % en zonas 4-5: en las series puedes apretar algo más.`); }
  } else if (a.hr && hrMax(k)) {
    const pc = Math.round(a.hr / hrMax(k) * 100); info.push(`Pulso medio ${a.hr} ppm (${pc} % de tu máximo)${a.maxHr ? `, máximo ${a.maxHr} ppm` : ""}.`);
    if (easy && pc > 80) imp.push("Pulso medio alto para un entreno suave: baja un poco el ritmo para quedarte en zona 2.");
  } else if (a.hr && !hrMax(k)) info.push("Pon tu FC máxima en Datos › Zonas para que analice tu pulso por zonas.");
  // desacople del pulso (fondo aeróbico)
  if (a.det?.dec != null && a.dur >= 1800 && easy) {
    if (a.det.dec <= 5) good.push(`Desacople del pulso ${String(a.det.dec).replace(".", ",")} %: tu pulso se mantuvo estable con el ritmo. Buena base aeróbica.`);
    else imp.push(`Desacople del pulso ${String(a.det.dec).replace(".", ",")} %: al final necesitaste más pulsaciones para el mismo ritmo. Falta fondo aeróbico, o influyó el calor o la hidratación. Más rodajes suaves y largos lo mejoran.`);
  }
  // cadencia
  const cad = a.det?.cad || a.cad;
  if (cad && run) {
    if (cad >= 170) good.push(`Cadencia ${cad} pasos/min: muy buena, pasos cortos y eficientes.`);
    else if (cad >= 162) info.push(`Cadencia ${cad} pasos/min: correcta. Subirla un 5 % (a ${Math.round(cad * 1.05)}) reduce el impacto en rodillas y tibias.`);
    else imp.push(`Cadencia ${cad} pasos/min: baja. Prueba pasos más cortos y rápidos (objetivo ${Math.round(cad * 1.05)}-${Math.round(cad * 1.08)}): menos impacto y menos riesgo de lesión.`);
  } else if (cad && k === "bike") (cad >= 80 && cad <= 95 ? good : info).push(`Cadencia media ${cad} rpm${cad < 80 ? ": algo baja, sube a 85-95 para cargar menos las rodillas" : cad > 95 ? ": alta, bien para piernas frescas" : ", en el rango ideal"}.`);
  // parciales
  const S = (a.det?.splits || []).filter((x) => !x.part && x.s > 0);
  if (S.length >= 4 && run) {
    const h = Math.floor(S.length / 2), f1 = S.slice(0, h).reduce((x, y) => x + y.s, 0) / h, f2 = S.slice(-h).reduce((x, y) => x + y.s, 0) / h;
    if (f2 < f1 * 0.99) good.push(`Parcial negativo: la segunda mitad (${paceS(f2)} /km) más rápida que la primera (${paceS(f1)} /km). Muy bien gestionado.`);
    else if (f2 > f1 * 1.05 && !hasElev(k)) imp.push(`Te fuiste apagando: la segunda mitad a ${paceS(f2)} /km frente a ${paceS(f1)} /km al principio. Sal un poco más suave.`);
    else good.push(`Ritmo regular de principio a fin (${paceS(f1)} → ${paceS(f2)} /km).`);
  }
  // de cara al objetivo
  const G = goalInfo(k), goalTxt = [];
  if (G && p) {
    goalTxt.push(`Tu objetivo: ${C.esc(G.name)} en ${hms(G.time)} (ritmo ${paceS(G.rp)} /km).`);
    if (!easy && a.km >= 3) { const eq = predict(riegel60(a.km, a.dur) * (a.rpe >= 9 ? 1 : 1.03), G.km), d = eq - G.time;
      goalTxt.push(d <= 0 ? `Con un esfuerzo así, hoy podrías hacer unos ${hms(eq)}: ¡ya estás por debajo del objetivo! ✅` : `Este entreno equivale a unos ${hms(eq)} en tu carrera: te faltan ${hms(d)}.`); }
    else if (easy && ses?.x?.pace) goalTxt.push("Los rodajes suaves no sirven para predecir tu marca, pero son la base para llegar a ella.");
    const nr = nextRace(k); if (nr) goalTxt.push(`Quedan ${daysTo(nr.date)} días para ${C.esc(nr.name)}.`);
  }
  // carga semanal y lesiones
  const ws = C.weekStart(a.day), wk = actsOf(k).filter((x) => x.day >= ws && x.day <= C.addDays(ws, 6)).reduce((s, x) => s + (+x.km || 0), 0), pw = actsOf(k).filter((x) => x.day >= C.addDays(ws, -7) && x.day < ws).reduce((s, x) => s + (+x.km || 0), 0);
  const inj = injFor(k), jump = pw > 5 && wk > pw * 1.15;
  if (isEnd(k) && jump) imp.push(`Llevas ${km2(wk)} km esta semana, un ${Math.round((wk / pw - 1) * 100)} % más que la anterior (${km2(pw)} km). Subir más de un 10 % de golpe aumenta el riesgo de lesión.`);
  const injTxt = [...new Set(inj.map((x) => x.part))].map((pt) => RISK[pt]).filter(Boolean);
  if (inj.some((x) => x.status !== "ok")) injTxt.unshift("Tienes una lesión sin recuperar del todo: si notas dolor durante el entreno, para. Mejor perder un día que un mes.");
  if (cad && run && cad < 168 && inj.some((x) => ["rodilla", "espinilla", "cadera", "cintilla"].includes(x.part))) injTxt.push("Con tu historial de lesiones, subir un poco la cadencia es de lo que más te puede ayudar.");
  const gO = good.length - g0, iO = imp.length - i0;
  if (ses?.x?.t === "Q" && !a.rpe && !zp) info.push("Apunta el esfuerzo (1-10) o pon tu FC máxima para que pueda valorar bien la parte fuerte.");
  const score = Math.max(1, Math.min(10, ev ? ev.score - iO * 1.25 + gO * 0.25 : 8 + good.length * 0.5 - imp.length));
  return { k, a, ses, ev, score: Math.round(score * 2) / 2, good, imp, info, zp, Z, splits: a.det?.splits || [], goalTxt, injTxt, p, cad, easy };
}
export function openAnalysis(id) {
  const a = C.allActs().find((x) => String(x.id) === String(id)); if (!a) return;
  const R = analyze(a); if (!R) { C.openSheet(a.name || "Entreno", `<p class="note">Este deporte todavía no tiene análisis.</p>`); return; }
  const { esc, fmtMin, fmt } = C, k = R.k, c = R.score >= 8.5 ? "#2BB673" : R.score >= 6.5 ? "#E0A800" : "#E8364F";
  const st = (l, v) => v ? `<div><span>${l}</span><b>${v}</b></div>` : "";
  const zc = ["#9FB4CC", "#4FD1A5", "#F2C14E", "#F08A24", "#E8364F"];
  const li = (arr, ic) => arr.map((t) => `<li><span aria-hidden="true">${ic}</span>${t}</li>`).join("");
  C.openSheet(a.name || C.sportName(a.type), `<div class="sp-ana" style="--sp:${SP_COLOR[k]}">
    <span class="note">${COACH[k].e} ${esc(COACH[k].n)} · ${C.dayLabel(a.day)}${a.src === "garmin" ? " · desde Garmin" : a.src === "whoop" ? " · desde WHOOP" : a.src === "strava" ? " · desde Strava" : ""}${R.ses ? ` · plan: ${esc(R.ses.x.title)}` : ""}</span>
    <div class="sp-stats">${st("Distancia", a.km ? kmTxt(k, a.km) : "")}${st("Tiempo", fmtMin(a.dur))}${st(k === "bike" ? "Velocidad" : "Ritmo", R.p ? (k === "bike" ? km2(a.km / (a.dur / 3600)) + " km/h" : paceS(R.p) + " /km") : "")}${st("Pulso medio", a.hr ? a.hr + " ppm" : "")}${st("Pulso máx.", a.maxHr ? a.maxHr + " ppm" : "")}${st("Cadencia", R.cad ? R.cad + (k === "bike" ? " rpm" : " ppm") : "")}${st("Desnivel +", a.elev ? fmt(a.elev) + " m" : "")}${st("Calorías", a.kcal ? fmt(a.kcal) : "")}</div>
    <div class="sp-eval" style="--ev:${c}"><div class="sp-ev-h"><b>${String(R.score).replace(".", ",")}/10</b><span>${R.score >= 8.5 ? "Muy bien" : R.score >= 6.5 ? "Bien" : "Mejorable"}</span><small>Nota del entreno</small></div></div>
    ${R.goalTxt.length ? `<div class="card sp-goal"><b>🎯 De cara a tu objetivo</b>${R.goalTxt.map((t) => `<p class="note" style="margin:0">${t}</p>`).join("")}</div>` : ""}
    ${R.good.length ? `<div class="card"><h2>Lo que has hecho bien</h2><ul class="sp-ul">${li(R.good, "✅")}</ul></div>` : ""}
    ${R.imp.length ? `<div class="card"><h2>Qué puedes mejorar</h2><ul class="sp-ul">${li(R.imp, "↗️")}</ul></div>` : ""}
    ${R.zp ? `<div class="card"><h2>Pulso por zonas</h2><div class="sp-zbar">${R.zp.map((v, i) => v ? `<i style="width:${v}%;background:${zc[i]}" title="Z${i + 1}: ${v} %"></i>` : "").join("")}</div>
      <div class="sp-zleg">${R.zp.map((v, i) => `<span><i style="background:${zc[i]}"></i>Z${i + 1} ${v} %<small>${i === 0 ? `<${R.Z[0]}` : i === 4 ? `>${R.Z[3]}` : `${R.Z[i - 1]}-${R.Z[i]}`}</small></span>`).join("")}</div></div>` : ""}
    ${R.splits.length ? `<div class="card"><h2>Parciales</h2><div class="sp-spl"><span>Km</span><span>${k === "bike" ? "km/h" : "Ritmo"}</span><span>Pulso</span><span>Cad.</span><span>m+</span>
      ${R.splits.map((x) => { const len = x.part ? (x.k % 1 || 1) : 1, pv = x.s / len; return `<b>${x.part ? String(x.k).replace(".", ",") : x.k}</b><span>${k === "bike" ? km2(3600 / pv) : paceS(pv)}</span><span>${x.hr || "—"}</span><span>${x.cad || "—"}</span><span>${x.up || 0}</span>`; }).join("")}</div></div>` : a.src === "garmin" ? `<p class="note">Los parciales, el pulso por zonas y la cadencia llegan cuando Garmin manda los detalles del entreno (unos minutos después).</p>` : ""}
    ${R.info.length ? `<div class="card"><h2>Datos</h2><ul class="sp-ul">${li(R.info, "ℹ️")}</ul></div>` : ""}
    ${R.injTxt.length ? `<div class="card sp-inj-box"><b>🩹 Tus lesiones</b>${R.injTxt.map((t) => `<p class="note" style="margin:0">${esc(t)}</p>`).join("")}<button class="link" data-act="inj-open">Ver mi historial de lesiones ›</button></div>` : ""}
    ${a.src === "app" ? `<button class="btn ghost" data-act="sport-open" data-id="${esc(a.id)}">Ver mapa y datos</button>` : ""}</div>`, { kind: "ana" });
}

/* ---------- vistas simplificadas: Plan (semanas o mes + carreras) y Progreso (todo en una) ---------- */
function vPlanAll(k) {
  const up = racesOf(k).filter((r) => r.date >= C.today()).sort((a, b) => a.date < b.date ? -1 : 1);
  const tg = (v, l) => `<button data-act="sp-month" data-v="${v}" aria-pressed="${!!st.month === (v === "1")}">${l}</button>`;
  return `${up.length ? `<h2 class="sp-h2">Próximas carreras</h2>${up.map((r) => raceRow(k, r)).join("")}` : ""}
    <button class="btn ghost" data-act="sp-race-new">+ ${RACE_W(k).add}</button>
    ${C.S.scoach?.[k] && !st.edit ? `<div class="seg sp-seg sm">${tg("0", "Semanas")}${tg("1", "Mes")}</div>` : ""}
    ${st.month && C.S.scoach?.[k] && !st.edit ? vCal(k) : vPlan(k)}`;
}
function vProg(k) {
  const past = racesOf(k).filter((r) => r.date < C.today()).sort((a, b) => a.date < b.date ? 1 : -1);
  return `<h2 class="sp-h2">Resumen</h2>${vRes(k)}
    ${vStats(k)}
    ${past.length ? `<h2 class="sp-h2">Carreras hechas</h2>${past.map((r) => raceRow(k, r)).join("")}` : ""}
    <h2 class="sp-h2">Tus zonas</h2>${vZones(k)}`;
}
