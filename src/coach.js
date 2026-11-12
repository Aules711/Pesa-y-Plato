// BEINGHEALTHY · Coach por deporte: plan de entrenamiento semanal (gratis, sin IA).

export const COACH = {
  run:      { n: "Correr",      e: "🏃", kind: "end", gps: "run",  goals: [["5k", "5 km"], ["10k", "10 km"], ["21k", "Media maratón"], ["42k", "Maratón"], ["fit", "Ponerme en forma"]] },
  trail:    { n: "Trail",       e: "⛰️", kind: "end", gps: "trail", goals: [["t21", "Trail hasta 21 km"], ["t50", "Trail de 21 a 50 km"], ["ultra", "Ultra (más de 50 km)"], ["mont", "Correr por montaña, sin carrera"]] },
  bike:     { n: "Ciclismo",    e: "🚴", kind: "end", gps: "bike", goals: [["fondo", "Marcha o gran fondo"], ["puertos", "Subir mejor los puertos"], ["fit", "Ponerme en forma"]] },
  swim:     { n: "Natación",    e: "🏊", kind: "end", gps: "",     goals: [["tec", "Mejorar mi técnica"], ["1500", "Nadar 1.500 m seguidos"], ["tri", "Triatlón"], ["fit", "Ponerme en forma"]] },
  hike:     { n: "Montaña",     e: "🥾", kind: "end", gps: "hike", goals: [["ruta", "Una ruta larga o un pico"], ["fit", "Ponerme en forma"]] },
  padel:    { n: "Pádel",       e: "🎾", kind: "team", goals: [["rend", "Rendir más en los partidos"], ["les", "Evitar lesiones"], ["fit", "Ponerme en forma"]] },
  tennis:   { n: "Tenis",       e: "🎾", kind: "team", goals: [["rend", "Rendir más en los partidos"], ["les", "Evitar lesiones"], ["fit", "Ponerme en forma"]] },
  football: { n: "Fútbol",      e: "⚽", kind: "team", goals: [["rend", "Rendir más en los partidos"], ["les", "Evitar lesiones"], ["fit", "Ponerme en forma"]] },
  basket:   { n: "Baloncesto",  e: "🏀", kind: "team", goals: [["rend", "Rendir más en los partidos"], ["les", "Evitar lesiones"], ["fit", "Ponerme en forma"]] },
  boxing:   { n: "Boxeo",       e: "🥊", kind: "team", goals: [["comp", "Competir o hacer sparring"], ["rend", "Mejorar técnica y cardio"], ["fit", "Ponerme en forma"]] },
};
export const DAY_N = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const SLOTS = { 2: [1, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [0, 1, 3, 4, 6], 6: [0, 1, 2, 3, 4, 6] };
const DEF_WEEKS = { "5k": 8, "10k": 10, "21k": 12, "42k": 16, t21: 10, t50: 14, ultra: 18, mont: 8, fondo: 12, puertos: 10, tec: 8, "1500": 10, tri: 12, ruta: 10, fit: 8, rend: 8, les: 8, comp: 10 };
const PEAK = { "5k": 60, "10k": 75, "21k": 110, "42k": 180, t21: 150, t50: 270, ultra: 360, mont: 150, fondo: 300, puertos: 240, tec: 45, "1500": 55, tri: 75, ruta: 360, fit: 0 };
const FIT_PEAK = { run: 60, trail: 120, bike: 150, swim: 45, hike: 180 };
const LV = { beg: 0.7, mid: 1, adv: 1.15 };
const r5 = (x) => Math.max(15, Math.round(x / 5) * 5);
const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? " " + (m % 60) + " min" : ""}` : `${m} min`);

/* ---------- textos de sesiones ---------- */
const STR = {
  run: "Sentadilla búlgara 3×8 por pierna · Peso muerto rumano 3×8 · Elevación de gemelos 3×15 · Puente de glúteo a una pierna 3×10 · Plancha 3×40 s",
  trail: "Sentadilla búlgara 3×8 · Step-up al cajón con peso 3×10 · Peso muerto rumano 3×8 · Gemelos excéntricos 3×12 · Plancha lateral 3×30 s",
  bike: "Sentadilla 4×6 · Peso muerto rumano 3×8 · Zancadas 3×10 · Hip thrust 3×8 · Plancha y bird-dog 3×30 s",
  swim: "Dominadas o jalón 4×8 · Remo 3×10 · Press con mancuernas 3×10 · Face pull 3×15 · Rotadores con goma 3×15 · Plancha 3×40 s",
  hike: "Step-up al cajón con peso 3×12 · Sentadilla goblet 3×10 · Zancadas caminando 3×12 · Gemelos 3×15 · Plancha 3×40 s",
  padel: "Sentadilla 3×8 · Zancada lateral 3×8 por lado · Pallof press (antirrotación) 3×10 · Face pull 3×12 · Rotadores de hombro con goma 3×15 · Gemelos 3×12",
  tennis: "Sentadilla 3×8 · Zancada lateral 3×8 por lado · Lanzamiento rotacional de balón medicinal 3×6 · Face pull 3×12 · Rotadores de hombro 3×15 · Gemelos 3×12",
  football: "Sentadilla búlgara 3×6 · Curl nórdico 3×5 (protege los isquios) · Hip thrust 3×8 · Plancha Copenhague 3×20 s · Gemelos 3×12 · Plancha 3×40 s",
  basket: "Sentadilla 3×6 · Saltos al cajón 4×4 · Peso muerto rumano 3×8 · Gemelos y tobillo 3×12 · Press militar 3×8 · Pallof press 3×10",
  boxing: "Peso muerto 3×5 · Press banca 3×6 · Dominadas 3×máx · Lanzamiento rotacional de balón medicinal 4×6 · Remo 3×8 · Plancha 3×45 s",
};
const AGI = {
  padel: "Calienta 10 min · Split-step + salida a la bola 6×20 s · Desplazamientos laterales 6×10 m · Sprints cortos con cambio de dirección 6×(5-10-5)",
  tennis: "Calienta 10 min · Split-step y reacción 6×20 s · Desplazamientos laterales línea de fondo 6×20 s · Sprints 5-10-5 ×6",
  football: "Calienta 10 min · Escalera de coordinación 6 pasadas · Sprints 8×20 m · Cambios de dirección 5-10-5 ×6 · Saltos laterales 3×10",
  basket: "Calienta 10 min · Desplazamiento defensivo lateral 6×20 s · Saltos reactivos 4×6 · Sprints de pista 6×28 m · Cambios de dirección ×6",
  boxing: "Comba 5×2 min (1 min descanso) · Trabajo de pies en el sitio 4×2 min · Sombra rápida 3×1 min",
};
const PRAC = {
  padel: "Tu clase, entreno o partido de pádel. Si no tienes, 60 min de peloteo y juego.",
  tennis: "Tu clase, entreno o partido de tenis. Si no tienes, 60 min de peloteo con objetivos (cruzados, paralelos, saque).",
  football: "Tu entreno o partido con el equipo. Si no tienes, 45 min de técnica con balón (conducción, pase, tiro).",
  basket: "Tu entreno o partido con el equipo. Si no tienes, 45 min de tiro y bote (sobre todo tiros libres y en movimiento).",
  boxing: "Técnica: sombra 3×3 min · Saco 5×3 min · Manoplas si puedes · 1 min de descanso entre asaltos.",
};
export const TIPS = {
  run: ["La mayoría de tus kilómetros deben ser suaves: si no puedes hablar, vas demasiado rápido.", "Come hidratos 2-3 h antes de las series y de la tirada larga.", "Sube como mucho un 10 % el volumen de una semana a otra.", "Si te duele algo más de 2 días seguidos, descansa y consúltalo."],
  trail: ["Entrena en subida andando rápido: en carrera también andarás.", "En tiradas de más de 90 min toma 30-60 g de hidratos por hora (geles, dátiles, plátano).", "Practica las bajadas suaves para que las piernas se acostumbren.", "Prueba en los entrenos el material y la comida de la carrera."],
  bike: ["Haz la mayor parte de rodajes en zona suave (puedes hablar).", "En salidas largas come cada 30-45 min, antes de tener hambre.", "Ajusta bien la bici: la altura del sillín evita muchas lesiones.", "La cadencia alta (85-95 rpm) cansa menos las piernas."],
  swim: ["La técnica vale más que los metros: haz ejercicios en cada sesión.", "Respira cada 3 brazadas para equilibrar el cuerpo.", "Termina la sesión con 100-200 m muy suaves.", "Si te cansas mucho, usa pull-buoy o aletas para trabajar la técnica."],
  hike: ["Entrena con la mochila y las botas de la ruta.", "Las bajadas cargan las rodillas: los bastones ayudan mucho.", "Bebe y come algo cada hora en las rutas largas.", "Mira el tiempo y sal temprano."],
  padel: ["Calienta 10 min antes de jugar: hombro, muñeca y gemelos.", "El trabajo de hombro con goma evita las lesiones más típicas.", "No hagas fuerza de piernas pesada el día antes de un partido.", "Bebe durante el partido, también en invierno."],
  tennis: ["Calienta hombro y muñeca antes de sacar fuerte.", "El trabajo de rotadores evita lesiones de hombro.", "Deja 48 h entre la fuerza de piernas y un partido importante.", "Come algo de hidratos si el partido dura más de 90 min."],
  football: ["El curl nórdico reduce mucho las roturas de isquios: no te lo saltes.", "Deja la fuerza pesada lejos del día de partido (mejor 3-4 días antes).", "Después del partido, come proteína e hidratos en las 2 h siguientes.", "Duerme 8 h: se nota en la velocidad."],
  basket: ["Fortalece el tobillo: es la lesión más común.", "Los saltos, siempre frescos: al principio de la sesión.", "Deja 48 h entre fuerza de piernas y partido.", "Bebe en cada tiempo muerto."],
  boxing: ["Protege las manos: vendas bien puestas siempre.", "La comba mejora pies y cardio a la vez.", "El cuello y el core también se entrenan.", "Si haces sparring, nunca sin protector y con alguien de tu nivel."],
};

function endSession(sport, t, phase, mins, goal, wk, lvl) {
  const E = {
    run: ["Rodaje suave", `Corre ${hm(mins)} a ritmo cómodo (puedes hablar).`],
    trail: ["Rodaje suave por camino", `${hm(mins)} suave por tierra o sendero, mejor con algo de desnivel.`],
    bike: ["Rodaje suave", `${hm(mins)} en llano a ritmo cómodo, cadencia ágil (85-95 rpm).`],
    swim: ["Técnica", `${hm(mins)}: 200 m suave · 6×50 m de ejercicios de técnica (un brazo, toques, sculling) · 4×100 m cómodo · 100 m suave.`],
    hike: ["Caminata a buen paso", `${hm(mins)} a paso rápido, mejor con alguna cuesta.`],
  };
  if (t === "E") return E[sport];
  if (t === "R") return ["Recuperación", sport === "swim" ? `${hm(mins)} muy suave, alternando estilos.` : `${hm(mins)} muy suave. Si estás cansado, mejor descansa.`];
  if (t === "S") return ["Fuerza", `Unos 40 min. ${STR[sport]}.`];
  if (t === "RACE") return ["🏁 Día del objetivo", "¡Hoy es el día! Calienta 10-15 min, empieza más suave de lo que crees y bebe y come según lo practicado."];
  if (t === "L") {
    if (sport === "trail") return ["Tirada larga por montaña", `${hm(mins)} por montaña con unos ${Math.round(mins * (goal === "ultra" || goal === "t50" ? 9 : 7) / 50) * 50} m de desnivel positivo. Anda en las subidas fuertes.`];
    if (sport === "bike") return ["Salida larga", `${hm(mins)} a ritmo suave-medio${goal === "puertos" ? ", con 1-2 puertos" : ""}. Come cada 30-45 min.`];
    if (sport === "swim") return ["Nado continuo", `${hm(mins)}: nada seguido sin parar a ritmo cómodo (si hace falta, para 20 s cada 200 m).`];
    if (sport === "hike") return ["Ruta de montaña", `Una ruta de unas ${hm(mins)} con desnivel, con la mochila que llevarás.`];
    return ["Tirada larga", `${hm(mins)} a ritmo suave${phase === "Específica" && (goal === "21k" || goal === "42k") ? `, con los últimos ${Math.round(mins * 0.25 / 5) * 5} min a ritmo de carrera` : ""}.`];
  }
  // calidad
  const alt = wk % 2;
  const Q = {
    run: phase === "Base" ? (lvl === "beg" ? ["Rodaje con cambios", `${hm(mins)} suave y al final 6×20 s más rápido (andando 1 min entre medias).`] : ["Cuestas", `Calienta 15 min · 8×45 s cuesta arriba fuerte, bajada trotando · 10 min suave.`])
      : alt ? ["Series", `Calienta 15 min · ${goal === "5k" ? "8×400 m" : goal === "10k" ? "6×800 m" : "5×1.000 m"} rápido (te cuesta hablar), 90 s trotando entre series · 10 min suave.`]
      : ["Ritmo umbral", `Calienta 15 min · ${phase === "Puesta a punto" ? "2×8 min" : "3×10 min"} a ritmo cómodo-duro, 2 min suave entre medias · 10 min suave.`],
    trail: phase === "Base" ? ["Cuestas", "Calienta 15 min · 8×1 min cuesta arriba fuerte, bajada suave · 10 min suave."]
      : alt ? ["Subida continua", `Calienta 15 min · ${phase === "Puesta a punto" ? "2×8 min" : "3×10 min"} subiendo a ritmo fuerte constante, baja suave · 10 min suave.`]
      : ["Bajadas técnicas", "Calienta 15 min · 6×2 min bajando por sendero técnico a ritmo vivo (vuelve andando) · 15 min suave."],
    bike: phase === "Base" ? ["Cadencia y fuerza", "Calienta 15 min · 5×1 min cadencia muy alta (100+ rpm) · 4×3 min en cuesta con cadencia baja (60 rpm) · vuelta suave."]
      : alt ? ["Umbral", `Calienta 15 min · ${phase === "Puesta a punto" ? "3×6 min" : "4×8 min"} a ritmo fuerte sostenible, 4 min suave entre medias · vuelta suave.`]
      : ["VO2 máx", "Calienta 15 min · 6×3 min muy fuerte, 3 min suave entre medias · vuelta suave."],
    swim: phase === "Base" ? ["Series cortas", "300 m suave · 10×50 m a ritmo vivo con 20 s de descanso · 4×50 m técnica · 100 m suave."]
      : alt ? ["Series", `300 m suave · ${goal === "1500" || goal === "tri" ? "5×200 m" : "10×100 m"} a ritmo fuerte, 20-30 s de descanso · 100 m suave.`]
      : ["Ritmo", "300 m suave · 3×300 m a tu ritmo objetivo, 30 s de descanso · 4×50 m rápido · 100 m suave."],
    hike: ["Cuestas o escaleras", "Calienta 10 min · 6×3 min subiendo fuerte (cuesta o escaleras), baja tranquilo · 10 min suave."],
  };
  return Q[sport];
}
function teamSession(sport, t, phase, wk) {
  const C = phase === "Adaptación" ? "8×30 s fuerte / 30 s suave" : phase === "Desarrollo" ? "10×40 s fuerte / 20 s suave" : "6×1 min muy fuerte / 1 min suave";
  if (t === "P") return [sport === "boxing" ? "Técnica de boxeo" : "Práctica del deporte", PRAC[sport]];
  if (t === "F") return ["Fuerza y prevención", `Unos 45 min. ${STR[sport]}.`];
  if (t === "F2") return ["Fuerza (sesión 2)", `Unos 35 min, más ligera. ${STR[sport].split(" · ").slice(0, 4).join(" · ")}.`];
  if (t === "A") return ["Agilidad y velocidad", `Unos 35 min. ${AGI[sport]}. Descansa lo necesario: tiene que ser rápido.`];
  if (t === "C") return ["Resistencia", sport === "boxing" ? `Saco: ${phase === "Adaptación" ? "5" : phase === "Desarrollo" ? "6" : "8"}×3 min a buen ritmo, 1 min de descanso.` : `Calienta 10 min · ${C} (correr, bici o comba) · 10 min suave.`];
  if (t === "M") return ["Movilidad", "20-25 min: cadera, tobillo, hombro y columna. Termina con 5 min de respiración."];
  return ["Descanso activo", "Paseo o bici suave."];
}

// req: {goal, level, days, date}
export function makeCoachPlan(sport, req, todayISO) {
  const S = COACH[sport]; const days = Math.max(2, Math.min(6, +req.days || 3)), lvl = req.level || "mid", goal = req.goal || S.goals[0][0];
  const mon = (iso) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const start = mon(todayISO);
  let N = DEF_WEEKS[goal] || 8, raceDay = null;
  if (req.date && req.date > todayISO) {
    const wk = Math.floor((new Date(req.date + "T12:00:00") - new Date(start + "T12:00:00")) / (7 * 864e5));
    N = Math.max(3, Math.min(24, wk + 1)); raceDay = (new Date(req.date + "T12:00:00").getDay() + 6) % 7;
  }
  const slots = SLOTS[days], weeks = [];
  const event = S.kind === "end" && goal !== "fit" && goal !== "mont" && goal !== "tec";
  const taper = event ? (N >= 10 ? 2 : 1) : 0;
  for (let w = 0; w < N; w++) {
    const tw = w >= N - taper, rec = !tw && w % 4 === 3 && w < N - 1;
    let phase, list;
    if (S.kind === "end") {
      phase = tw ? "Puesta a punto" : w < (N - taper) * 0.4 ? "Base" : w < (N - taper) * 0.75 ? "Construcción" : "Específica";
      const peak = (PEAK[goal] || FIT_PEAK[sport]) * LV[lvl], st = Math.max(25, peak * 0.45);
      const prog = st + (peak - st) * Math.min(1, w / Math.max(1, N - taper - 1));
      const L = r5((tw ? peak * (w === N - 1 ? 0.45 : 0.65) : prog) * (rec ? 0.7 : 1));
      const pat = { 2: ["Q", "L"], 3: ["E", "Q", "L"], 4: ["E", "Q", "S", "L"], 5: ["E", "Q", "E", "S", "L"], 6: ["E", "Q", "R", "Q", "S", "L"] }[days].slice();
      if (rec) { const i = pat.lastIndexOf("Q"); if (i >= 0) pat[i] = "E"; }
      list = pat.map((t, i) => {
        const mins = t === "L" ? L : t === "S" ? 40 : t === "R" ? r5(L * 0.3) : t === "Q" ? (sport === "bike" ? 75 : sport === "swim" ? r5(Math.max(30, L * 0.8)) : 50) : r5(L * (sport === "bike" ? 0.45 : 0.55));
        const [title, desc] = endSession(sport, t, phase, mins, goal, w, lvl);
        return { d: slots[i], t, title, desc, dur: t === "L" || t === "E" || t === "R" ? mins : t === "S" ? 40 : t === "Q" ? mins : 0 };
      });
      if (w === N - 1 && raceDay != null) {
        list = list.filter((s) => s.d < raceDay && s.t !== "S").slice(-2).map((s) => ({ ...s, dur: r5(s.dur * 0.6), desc: s.desc + " Muy suave: la carrera está cerca." }));
        list.push({ d: raceDay, t: "RACE", title: "🏁 Día del objetivo", desc: endSession(sport, "RACE")[1], dur: 0 });
      }
    } else {
      phase = w < 2 ? "Adaptación" : w < N - 2 ? "Desarrollo" : "Rendimiento";
      const pat = { 2: ["F", "P"], 3: ["F", "A", "P"], 4: ["F", "A", "C", "P"], 5: ["F", "A", "C", "M", "P"], 6: ["F", "A", "C", "M", "F2", "P"] }[days];
      list = pat.map((t, i) => { const [title, desc] = teamSession(sport, t, phase, w); return { d: slots[i], t, title, desc: rec && t !== "P" ? desc + " (Semana de descarga: hazlo un poco más suave.)" : desc, dur: { F: 45, F2: 35, A: 35, C: 30, M: 25, P: 60 }[t] }; });
    }
    weeks.push({ phase: rec ? phase + " · descarga" : phase, sessions: list.sort((a, b) => a.d - b.d) });
  }
  return { sport, req: { ...req, goal, level: lvl, days }, start, weeks, created: Date.now() };
}
export const goalName = (sport, g) => COACH[sport]?.goals.find((x) => x[0] === g)?.[1] || "";
