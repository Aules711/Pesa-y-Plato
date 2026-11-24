// Función de Vercel: lee el calendario de TrainingPeaks (enlace .ics / webcal, solo TrainingPeaks Premium)
// y devuelve los entrenos de los días pedidos con los datos que TrainingPeaks ponga (duración, kJ, kcal, TSS, km).
// No se inventa nada: si un dato no viene en el calendario, se devuelve vacío.
import { sbAdmin } from "./_sb.js";

const unesc = (s) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
const num = (s) => +String(s).replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
const iso = (v) => { const m = /(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(v || ""); return m ? { d: `${m[1]}-${m[2]}-${m[3]}`, t: m[4] ? +m[4] * 60 + +m[5] : null } : null; };
const TYPES = [[/run|carrera|correr|trote/i, "run"], [/bike|ride|cycl|bici|mtb/i, "bike"], [/swim|nata|nado|piscina/i, "swim"], [/strength|fuerza|gym|weights?/i, "gym"]];

function durFrom(text) {
  let m = /(?:planned|duration|duraci[oó]n|time|tiempo)[^\d]{0,15}(\d{1,2}):(\d{2})(?::(\d{2}))?/i.exec(text) || /\b(\d{1,2}):(\d{2}):(\d{2})\b/.exec(text);
  if (m) return +m[1] * 60 + +m[2] + Math.round(+(m[3] || 0) / 60);
  m = /\b(\d{1,2})\s*h(?:oras?|rs?)?\s*(\d{1,2})?\s*(?:m(?:in)?)?\b/i.exec(text); if (m) return +m[1] * 60 + +(m[2] || 0);
  m = /\b(\d{2,3})\s*(?:min|minutos|')/i.exec(text); return m ? +m[1] : 0;
}

export function parseIcs(txt) {
  const lines = txt.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/), out = [];
  let ev = null;
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") { ev = {}; continue; }
    if (l === "END:VEVENT") { if (ev) out.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = l.indexOf(":"); if (i < 0) continue;
    const key = l.slice(0, i).split(";")[0].toUpperCase(), val = l.slice(i + 1);
    if (key === "DTSTART") ev.s = iso(val); else if (key === "DTEND") ev.e = iso(val);
    else if (key === "SUMMARY") ev.name = unesc(val).trim(); else if (key === "DESCRIPTION") ev.desc = unesc(val).trim();
  }
  return out.filter((e) => e.s).map((e) => {
    const text = `${e.name || ""}\n${e.desc || ""}`;
    let dur = e.s.t != null && e.e?.t != null && e.e.d === e.s.d ? e.e.t - e.s.t : 0;
    if (!dur) dur = durFrom(text);
    const kj = /(\d[\d.,]*)\s*kj/i.exec(text), kcal = /(\d[\d.,]*)\s*(?:kcal|cal(?:or[ií]as)?\b)/i.exec(text);
    const tss = /tss[^\d]{0,6}(\d+(?:[.,]\d+)?)/i.exec(text), km = /(\d+(?:[.,]\d+)?)\s*km\b/i.exec(text);
    return { date: e.s.d, name: e.name || "Entreno", type: (TYPES.find(([rx]) => rx.test(text)) || [, "other"])[1], dur: dur > 0 && dur < 1440 ? dur : 0,
      kj: kj ? Math.round(num(kj[1])) : 0, kcal: kcal ? Math.round(num(kcal[1])) : 0, tss: tss ? Math.round(num(tss[1])) : 0, km: km ? num(km[1]) : 0,
      desc: (e.desc || "").slice(0, 400) };
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ code: "method" });
  const sb = sbAdmin();
  if (sb && !sb.wrongKey) {
    const me = await sb.userFromToken((req.headers.authorization || "").replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me?.id) return res.status(401).json({ code: "not_granted" });
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  let u; try { u = new URL(String(body.url || "").trim().replace(/^webcal:\/\//i, "https://")); } catch { return res.status(400).json({ code: "bad_url" }); }
  const tp = (h) => /(^|\.)trainingpeaks\.com$/i.test(h);
  if (u.protocol !== "https:" || !tp(u.hostname)) return res.status(400).json({ code: "not_tp" });
  let r; try { r = await fetch(u, { headers: { "user-agent": "BEINGHEALTHY/1.0" } }); } catch { return res.status(502).json({ code: "fetch" }); }
  if (!tp(new URL(r.url || u).hostname)) return res.status(400).json({ code: "not_tp" });
  if (!r.ok) return res.status(502).json({ code: "fetch", status: r.status });
  const txt = (await r.text()).slice(0, 3_000_000);
  if (!/BEGIN:VCALENDAR/.test(txt)) return res.status(502).json({ code: "not_ics" });
  const from = String(body.from || ""), to = String(body.to || from);
  const events = parseIcs(txt).filter((e) => (!from || e.date >= from) && (!to || e.date <= to)).sort((a, b) => a.date.localeCompare(b.date));
  return res.status(200).json({ events });
}
