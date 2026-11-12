// BEINGHEALTHY · Gym: rangos por ejercicio y por músculo, mapa corporal, peso sugerido y plan de rutinas.
// Todo local y gratis (sin IA de pago).

export const TIERS = [
  { n: "Hierro",   c: "#8A93A6", at: 0 },
  { n: "Bronce",   c: "#C9824F", at: 0.35 },
  { n: "Plata",    c: "#C3CCD8", at: 0.55 },
  { n: "Oro",      c: "#F2C14E", at: 0.75 },
  { n: "Platino",  c: "#45D3C7", at: 1.0 },
  { n: "Diamante", c: "#6FA8FF", at: 1.25 },
  { n: "Élite",    c: "#B676FF", at: 1.55 },
];
const ROMAN = ["III", "II", "I"];

// 1RM estimado / peso corporal de un nivel «Platino» (intermedio-avanzado), hombre.
// bw: ejercicio con el propio cuerpo (carga = peso corporal × bw + lastre).
export const STD = {
  "Press banca": { b: 1.25 }, "Press banca con mancuernas": { b: 0.45 }, "Press inclinado con mancuernas": { b: 0.42 },
  "Aperturas con mancuernas": { b: 0.28 }, "Cruces en polea": { b: 0.35 }, "Flexiones": { b: 1.55, bw: 0.65 },
  "Flexiones diamante": { b: 1.3, bw: 0.65 }, "Flexiones pica": { b: 1.15, bw: 0.55 },
  "Dominadas": { b: 1.6, bw: 1 }, "Jalón al pecho": { b: 1.0 }, "Remo con barra": { b: 1.05 }, "Remo con mancuerna": { b: 0.5 },
  "Remo en polea baja": { b: 1.0 }, "Remo invertido": { b: 1.25, bw: 0.6 }, "Peso muerto": { b: 2.2 },
  "Press militar": { b: 0.8 }, "Press con mancuernas sentado": { b: 0.38 }, "Elevaciones laterales": { b: 0.2 }, "Pájaros": { b: 0.16 }, "Face pull": { b: 0.45 },
  "Curl con barra": { b: 0.62 }, "Curl con mancuernas": { b: 0.3 }, "Curl martillo": { b: 0.32 }, "Curl en polea": { b: 0.5 },
  "Extensión de tríceps en polea": { b: 0.6 }, "Press francés": { b: 0.55 }, "Fondos": { b: 1.7, bw: 1 },
  "Sentadilla": { b: 1.8, low: 1 }, "Sentadilla goblet": { b: 0.7, low: 1 }, "Sentadilla búlgara": { b: 0.65, low: 1 }, "Prensa": { b: 3.5, low: 1 },
  "Extensión de cuádriceps": { b: 1.0, low: 1 }, "Curl femoral": { b: 0.75, low: 1 }, "Peso muerto rumano": { b: 1.55, low: 1 }, "Zancadas": { b: 0.65, low: 1 },
  "Elevación de gemelos": { b: 1.5, low: 1 }, "Hip thrust": { b: 2.1, low: 1 }, "Puente de glúteo": { b: 1.5, bw: 0.6, low: 1 },
  "Sentadilla con peso corporal": { b: 2.1, bw: 0.8, low: 1 },
};
STD["Peso muerto"].low = 1;

const e1 = (kg, reps) => (reps > 0 ? kg * (1 + Math.min(reps, 20) / 30) : 0);

// puntuación (1 = Platino) de una serie
export function setScore(name, kg, reps, bw, sex) {
  const s = STD[name]; if (!s || !(reps > 0) || !(bw > 0)) return 0;
  const load = s.bw ? bw * s.bw + (+kg || 0) : +kg || 0; if (!(load > 0)) return 0;
  const base = s.b * (sex === "f" ? (s.low ? 0.72 : 0.6) : 1);
  return e1(load, reps) / bw / base;
}

export function tierOf(score) {
  let i = 0; while (i < TIERS.length - 1 && score >= TIERS[i + 1].at) i++;
  const T = TIERS[i], last = i === TIERS.length - 1, top = last ? T.at * 1.35 : TIERS[i + 1].at;
  const f = Math.max(0, Math.min(0.999, (score - T.at) / (top - T.at)));
  const sub = last ? "" : ROMAN[Math.floor(f * 3)];
  // siguiente escalón (subnivel o rango)
  let nextAt = null, nextName = "";
  if (!last) { const k = Math.floor(f * 3); if (k < 2) { nextAt = T.at + (top - T.at) * (k + 1) / 3; nextName = `${T.n} ${ROMAN[k + 1]}`; } else { nextAt = top; nextName = `${TIERS[i + 1].n}${i + 1 === TIERS.length - 1 ? "" : " III"}`; } }
  return { i, name: T.n, sub, label: sub ? `${T.n} ${sub}` : T.n, color: T.c, pct: f, points: Math.round(score * 1000), nextAt, nextName };
}

// kg necesarios (a 5 reps) para llegar a una puntuación
export function kgFor(name, score, bw, sex, reps = 5) {
  const s = STD[name]; if (!s) return null;
  const base = s.b * (sex === "f" ? (s.low ? 0.72 : 0.6) : 1), load = score * base * bw / (1 + reps / 30);
  const kg = s.bw ? load - bw * s.bw : load;
  return Math.max(0, Math.ceil(kg / 1.25) * 1.25);
}
// repeticiones necesarias con el propio cuerpo
export function repsFor(name, score, bw, sex) {
  const s = STD[name]; if (!s?.bw) return null;
  const base = s.b * (sex === "f" ? (s.low ? 0.72 : 0.6) : 1);
  return Math.max(1, Math.ceil((score * base / s.bw - 1) * 30));
}
export const isBW = (name) => !!STD[name]?.bw;

// mejores puntuaciones por ejercicio a partir de los entrenos
export function exerciseRanks(workouts, bw, sex, before = Infinity) {
  const out = {};
  for (const w of workouts) {
    if (w.start >= before) continue;
    for (const e of w.exercises) {
      if (!STD[e.name]) continue;
      for (const st of e.sets) {
        if (st.t === "w") continue;
        const sc = setScore(e.name, +st.kg || 0, +st.reps || 0, bw, sex);
        if (sc > (out[e.name]?.score || 0)) out[e.name] = { name: e.name, score: sc, kg: +st.kg || 0, reps: +st.reps || 0, at: w.start };
      }
    }
  }
  return out;
}

export const GYM_MUSCLES = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Piernas", "Glúteos"];
export function muscleRanks(ex, muscleOf) {
  const by = {};
  for (const r of Object.values(ex)) { const m = muscleOf(r.name); (by[m] ||= []).push(r.score); }
  const out = {};
  for (const m of GYM_MUSCLES) {
    const l = (by[m] || []).sort((a, b) => b - a); if (!l.length) continue;
    const sc = l.length > 1 ? l[0] * 0.7 + l[1] * 0.3 : l[0] * 0.92;   // premia trabajar el músculo con más de un ejercicio
    out[m] = { score: sc, n: l.length };
  }
  return out;
}

/* ---------- mapa corporal ---------- */
export function bodyMap(mr) {
  const col = (m) => (mr[m] ? tierOf(mr[m].score).color : "var(--surface2)");
  const op = (m) => (mr[m] ? 1 : 0.9);
  const P = (m, d) => `<path d="${d}" fill="${col(m)}" fill-opacity="${op(m)}" stroke="var(--bg)" stroke-width="1.4"><title>${m}${mr[m] ? ": " + tierOf(mr[m].score).label : ": sin datos"}</title></path>`;
  const E = (m, cx, cy, rx, ry, rot = 0) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="${col(m)}" fill-opacity="${op(m)}" stroke="var(--bg)" stroke-width="1.4"><title>${m}${mr[m] ? ": " + tierOf(mr[m].score).label : ": sin datos"}</title></ellipse>`;
  const base = (x) => `<g fill="var(--line)">
    <circle cx="${x}" cy="16" r="10"/><rect x="${x - 4}" y="25" width="8" height="8" rx="3"/>
    <ellipse cx="${x - 30}" cy="98" rx="4.5" ry="12" transform="rotate(8 ${x - 30} 98)"/><ellipse cx="${x + 30}" cy="98" rx="4.5" ry="12" transform="rotate(-8 ${x + 30} 98)"/>
    <circle cx="${x - 32}" cy="114" r="4"/><circle cx="${x + 32}" cy="114" r="4"/>
    <ellipse cx="${x - 8}" cy="196" rx="5" ry="4"/><ellipse cx="${x + 8}" cy="196" rx="5" ry="4"/></g>`;
  const F = 52, B = 156;
  const front = base(F) +
    E("Hombros", F - 19, 41, 8, 9, 20) + E("Hombros", F + 19, 41, 8, 9, -20) +
    P("Pecho", `M${F - 1} 35 L${F - 13} 35 Q${F - 19} 38 ${F - 18} 50 Q${F - 14} 60 ${F - 1} 58 Z`) +
    P("Pecho", `M${F + 1} 35 L${F + 13} 35 Q${F + 19} 38 ${F + 18} 50 Q${F + 14} 60 ${F + 1} 58 Z`) +
    E("Bíceps", F - 25, 66, 5, 12, 10) + E("Bíceps", F + 25, 66, 5, 12, -10) +
    P("Core", `M${F - 12} 61 L${F + 12} 61 L${F + 11} 94 Q${F} 100 ${F - 11} 94 Z`) +
    P("Piernas", `M${F - 13} 99 Q${F - 20} 120 ${F - 15} 150 L${F - 4} 150 Q${F - 1} 122 ${F - 2} 102 Z`) +
    P("Piernas", `M${F + 13} 99 Q${F + 20} 120 ${F + 15} 150 L${F + 4} 150 Q${F + 1} 122 ${F + 2} 102 Z`) +
    E("Piernas", F - 9, 172, 4.5, 15) + E("Piernas", F + 9, 172, 4.5, 15);
  const back = base(B) +
    E("Hombros", B - 19, 41, 8, 9, 20) + E("Hombros", B + 19, 41, 8, 9, -20) +
    P("Espalda", `M${B - 14} 33 L${B + 14} 33 Q${B + 20} 50 ${B + 13} 78 L${B} 86 L${B - 13} 78 Q${B - 20} 50 ${B - 14} 33 Z`) +
    E("Tríceps", B - 25, 64, 5, 12, 10) + E("Tríceps", B + 25, 64, 5, 12, -10) +
    P("Core", `M${B - 12} 82 L${B} 90 L${B + 12} 82 L${B + 12} 94 L${B - 12} 94 Z`) +
    E("Glúteos", B - 7, 104, 8, 9) + E("Glúteos", B + 7, 104, 8, 9) +
    E("Piernas", B - 9, 133, 6, 18, 3) + E("Piernas", B + 9, 133, 6, 18, -3) +
    E("Piernas", B - 9, 172, 5, 15) + E("Piernas", B + 9, 172, 5, 15);
  return `<svg class="gym-map" viewBox="0 0 208 214" role="img" aria-label="Mapa de tus músculos coloreado por rango">
    ${front}${back}
    <text x="${F}" y="212" text-anchor="middle">Delante</text><text x="${B}" y="212" text-anchor="middle">Detrás</text></svg>`;
}

export function badge(t, size = 34) {
  return `<span class="tier-b" style="--tc:${t.color};width:${size}px;height:${size}px" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg><b>${t.sub || "★"}</b></span>`;
}

/* ---------- peso sugerido (sobrecarga progresiva) ---------- */
// last: series de la última vez (sin calentamiento); range "8-12"
export function suggest(name, last, range = "8-12") {
  const work = (last || []).filter((s) => s.t !== "w" && (+s.reps || 0) > 0);
  if (!work.length) return null;
  const [lo, hi] = String(range).split(/[-–]/).map(Number); const top = hi || lo || 12, bot = lo || 8;
  const kg = Math.max(...work.map((s) => +s.kg || 0));
  const atKg = work.filter((s) => (+s.kg || 0) === kg);
  const allTop = atKg.every((s) => +s.reps >= top) && atKg.length >= Math.min(2, work.length);
  if (isBW(name) && !kg) {
    const best = Math.max(...work.map((s) => +s.reps || 0));
    return { kg: 0, reps: best + 1, why: `La última vez llegaste a ${best} repeticiones: intenta una más.` };
  }
  if (allTop) {
    const inc = kg >= 40 || /sentadilla|peso muerto|prensa|hip thrust|press banca$/i.test(name) ? 2.5 : kg >= 12 ? 1.25 : 1;
    return { kg: Math.round((kg + inc) * 100) / 100, reps: bot, up: true, why: `Hiciste ${top} o más en todas: sube a ${String(kg + inc).replace(".", ",")} kg y vuelve a ${bot} reps.` };
  }
  const minR = Math.min(...atKg.map((s) => +s.reps || 0));
  return { kg, reps: Math.min(top, minR + 1), why: `Mismo peso y busca ${Math.min(top, minR + 1)} reps en cada serie. Cuando llegues a ${top} en todas, subes.` };
}

/* ---------- plan de rutinas ---------- */
// [nombre, categoría, compuesto]
const POOL = {
  gym: [
    ["Sentadilla", "sq", 1], ["Prensa", "sq", 1], ["Sentadilla búlgara", "sq", 1],
    ["Peso muerto rumano", "hinge", 1], ["Peso muerto", "hinge", 1],
    ["Press banca", "hpush", 1], ["Press inclinado con mancuernas", "hpush", 1],
    ["Press militar", "vpush", 1], ["Press con mancuernas sentado", "vpush", 1],
    ["Jalón al pecho", "vpull", 1], ["Dominadas", "vpull", 1],
    ["Remo con barra", "hpull", 1], ["Remo en polea baja", "hpull", 1], ["Remo con mancuerna", "hpull", 1],
    ["Hip thrust", "glute", 1], ["Extensión de cuádriceps", "quad", 0], ["Curl femoral", "ham", 0], ["Elevación de gemelos", "calf", 0],
    ["Elevaciones laterales", "side", 0], ["Face pull", "rear", 0], ["Pájaros", "rear", 0], ["Cruces en polea", "chest", 0], ["Aperturas con mancuernas", "chest", 0],
    ["Curl con barra", "bi", 0], ["Curl martillo", "bi", 0], ["Curl en polea", "bi", 0],
    ["Extensión de tríceps en polea", "tri", 0], ["Press francés", "tri", 0], ["Fondos", "tri", 1],
    ["Elevación de piernas colgado", "core", 0], ["Crunch abdominal", "core", 0], ["Plancha", "core", 0],
  ],
  db: [
    ["Sentadilla goblet", "sq", 1], ["Sentadilla búlgara", "sq", 1], ["Zancadas", "sq", 1],
    ["Peso muerto rumano", "hinge", 1],
    ["Press banca con mancuernas", "hpush", 1], ["Press inclinado con mancuernas", "hpush", 1], ["Flexiones", "hpush", 1],
    ["Press con mancuernas sentado", "vpush", 1],
    ["Remo con mancuerna", "hpull", 1], ["Remo invertido", "vpull", 1],
    ["Hip thrust", "glute", 1], ["Puente de glúteo", "glute", 0], ["Elevación de gemelos", "calf", 0],
    ["Elevaciones laterales", "side", 0], ["Pájaros", "rear", 0], ["Aperturas con mancuernas", "chest", 0],
    ["Curl con mancuernas", "bi", 0], ["Curl martillo", "bi", 0], ["Press francés", "tri", 0], ["Flexiones diamante", "tri", 0],
    ["Plancha", "core", 0], ["Crunch abdominal", "core", 0],
  ],
  home: [
    ["Sentadilla con peso corporal", "sq", 1], ["Sentadilla búlgara", "sq", 1], ["Zancadas", "sq", 1],
    ["Puente de glúteo", "hinge", 1], ["Puente de glúteo", "glute", 1],
    ["Flexiones", "hpush", 1], ["Flexiones pica", "vpush", 1],
    ["Remo invertido", "hpull", 1], ["Remo invertido", "vpull", 1],
    ["Elevación de gemelos", "calf", 0], ["Flexiones diamante", "tri", 0], ["Fondos", "tri", 1],
    ["Plancha", "core", 0], ["Crunch abdominal", "core", 0], ["Elevación de piernas colgado", "core", 0],
  ],
};
const DAYS = {
  full: [["sq", "hpush", "vpull", "hinge", "side", "bi", "core"], ["hinge", "vpush", "hpull", "sq", "chest", "tri", "core"], ["sq", "hpush", "hpull", "glute", "rear", "bi", "tri"]],
  upper: [["hpush", "vpull", "vpush", "hpull", "side", "bi", "tri"], ["vpush", "hpull", "hpush", "vpull", "rear", "tri", "bi"]],
  lower: [["sq", "hinge", "quad", "ham", "calf", "core"], ["hinge", "sq", "glute", "ham", "calf", "core"]],
  push: [["hpush", "vpush", "chest", "side", "tri", "tri"], ["vpush", "hpush", "side", "chest", "tri", "side"]],
  pull: [["vpull", "hpull", "hpull", "rear", "bi", "bi"], ["hpull", "vpull", "rear", "hpull", "bi", "core"]],
  legs: [["sq", "hinge", "quad", "ham", "calf", "core"], ["hinge", "sq", "glute", "quad", "calf", "core"]],
};
const SPLITS = {
  2: [["Cuerpo completo A", "full", 0], ["Cuerpo completo B", "full", 1]],
  3: [["Cuerpo completo A", "full", 0], ["Cuerpo completo B", "full", 1], ["Cuerpo completo C", "full", 2]],
  4: [["Torso A", "upper", 0], ["Pierna A", "lower", 0], ["Torso B", "upper", 1], ["Pierna B", "lower", 1]],
  5: [["Empuje", "push", 0], ["Tirón", "pull", 0], ["Pierna A", "legs", 0], ["Torso", "upper", 0], ["Pierna B", "lower", 1]],
  6: [["Empuje A", "push", 0], ["Tirón A", "pull", 0], ["Pierna A", "legs", 0], ["Empuje B", "push", 1], ["Tirón B", "pull", 1], ["Pierna B", "legs", 1]],
};
const REPS = { str: ["4-6", "8-10", 4], mus: ["6-10", "10-15", 3], fat: ["8-12", "12-15", 3] };

export function makeGymPlan({ days = 3, goal = "mus", equip = "gym", level = "mid" }) {
  days = Math.max(2, Math.min(6, +days || 3));
  const pool = POOL[equip] || POOL.gym, R = REPS[goal] || REPS.mus;
  const max = level === "beg" ? 5 : level === "adv" ? 7 : 6;
  return SPLITS[days].map(([name, kind, v], di) => {
    const used = new Set(), list = [];
    for (const [k, cat] of DAYS[kind][v % DAYS[kind].length].entries()) {
      const opts = pool.filter((x) => x[1] === cat && !used.has(x[0])); if (!opts.length) continue;
      const x = opts[v % opts.length]; used.add(x[0]);
      const comp = !!x[2] && list.length < 3;
      const sets = level === "beg" ? 3 : comp ? R[2] : 3;
      list.push({ name: x[0], sets, reps: x[0] === "Plancha" ? "30-60" : comp ? R[0] : R[1] });
      if (list.length >= max) break;
    }
    return { name, exercises: list };
  });
}
export const NEW_LIB = [["Press banca con mancuernas", "Pecho"], ["Curl con mancuernas", "Bíceps"], ["Sentadilla goblet", "Piernas"], ["Remo invertido", "Espalda"],
  ["Flexiones diamante", "Tríceps"], ["Flexiones pica", "Hombros"], ["Puente de glúteo", "Glúteos"], ["Sentadilla con peso corporal", "Piernas"]];
