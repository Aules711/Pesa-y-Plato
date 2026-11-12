// BEINGHEALTHY · Deportes: tipos de deporte, grabación con GPS, mapa y calorías.
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// [clave, nombre, emoji, MET, gps, unidad de ritmo ("pace" min/km | "speed" km/h)]
export const SPORT_LIST = [
  ["run", "Correr", "🏃", 9.8, 1, "pace"], ["walk", "Caminar", "🚶", 3.8, 1, "pace"], ["hike", "Senderismo", "🥾", 6.0, 1, "pace"],
  ["trail", "Trail", "⛰️", 10.0, 1, "pace"], ["bike", "Bici", "🚴", 7.5, 1, "speed"], ["mtb", "Bici de montaña", "🚵", 8.5, 1, "speed"],
  ["skate", "Patines", "🛼", 7.0, 1, "speed"], ["swimow", "Natación en mar", "🌊", 8.0, 1, "pace"], ["ski", "Esquí", "⛷️", 7.0, 1, "speed"],
  ["kayak", "Kayak", "🛶", 5.0, 1, "speed"],
  ["swim", "Natación (piscina)", "🏊", 7.0, 0], ["football", "Fútbol", "⚽", 7.0, 0], ["basket", "Baloncesto", "🏀", 6.5, 0],
  ["padel", "Pádel", "🎾", 6.0, 0], ["tennis", "Tenis", "🎾", 7.3, 0], ["volley", "Voleibol", "🏐", 4.0, 0], ["handball", "Balonmano", "🤾", 8.0, 0],
  ["rugby", "Rugby", "🏉", 8.3, 0], ["boxing", "Boxeo", "🥊", 7.8, 0], ["martial", "Artes marciales", "🥋", 10.0, 0],
  ["crossfit", "CrossFit", "🏋️", 8.0, 0], ["hiit", "HIIT", "🔥", 8.0, 0], ["spin", "Spinning", "🚲", 8.5, 0], ["elliptical", "Elíptica", "🏃‍♀️", 5.0, 0],
  ["rowing", "Remo (máquina)", "🚣", 7.0, 0], ["climb", "Escalada", "🧗", 8.0, 0], ["yoga", "Yoga", "🧘", 2.5, 0], ["pilates", "Pilates", "🤸", 3.0, 0],
  ["dance", "Baile", "💃", 5.0, 0], ["surf", "Surf", "🏄", 3.5, 0], ["golf", "Golf", "⛳", 4.3, 0], ["other", "Otro deporte", "💪", 5.0, 0],
];
export const SPORT = Object.fromEntries(SPORT_LIST.map(([k, n, e, met, gps, unit]) => [k, { k, n, e, met, gps: !!gps, unit: unit || "pace" }]));

const R = 6371000, rad = (x) => (x * Math.PI) / 180;
export function dist(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// velocidad máxima creíble (m/s) para descartar saltos del GPS
const MAXV = { run: 9, trail: 8, walk: 4, hike: 4, swimow: 3, bike: 25, mtb: 20, skate: 15, ski: 35, kayak: 6 };

// calorías: correr y caminar por distancia; bici por velocidad; el resto por MET
export function kcalFor(type, kg, sec, km) {
  kg = +kg || 75; const h = sec / 3600, S = SPORT[type] || SPORT.other;
  if ((type === "run" || type === "trail") && km > 0.2) return Math.round(kg * km * (type === "trail" ? 1.15 : 1.0));
  if ((type === "walk" || type === "hike") && km > 0.2) return Math.round(kg * km * (type === "hike" ? 0.75 : 0.55));
  if ((type === "bike" || type === "mtb") && km > 0.2 && h > 0) {
    const v = km / h, met = v < 16 ? 4 : v < 19 ? 6.8 : v < 22 ? 8 : v < 25 ? 10 : 12;
    return Math.round(met * kg * h * (type === "mtb" ? 1.1 : 1));
  }
  return Math.round(S.met * kg * h);
}
export const pace = (sec, km) => { if (!(km > 0.02)) return "—"; const p = sec / km; return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, "0")}`; };
export const speed = (sec, km) => (sec > 0 ? (km / (sec / 3600)).toFixed(1).replace(".", ",") : "0,0");

/* ---------- grabación ---------- */
// t = estado de la grabación (se guarda en el dispositivo para no perderla si se cierra la app)
export function newTrack(type) { return { type, start: Date.now(), status: "ready", moving: 0, lastResume: 0, pts: [], m: 0, elev: 0, acc: null }; }
export function elapsed(t) { return Math.round((t.moving + (t.status === "run" ? Date.now() - t.lastResume : 0)) / 1000); }
export function addPoint(t, pos) {
  const c = pos.coords; t.acc = Math.round(c.accuracy);
  if (t.status !== "run" || c.accuracy > 35) return false;
  const p = [Math.round(c.latitude * 1e6) / 1e6, Math.round(c.longitude * 1e6) / 1e6, pos.timestamp || Date.now(), c.altitude != null ? Math.round(c.altitude) : null];
  const last = t.pts[t.pts.length - 1];
  if (last && !last[4]) {
    const d = dist(last, p), dt = Math.max(0.5, (p[2] - last[2]) / 1000);
    if (d < 3) return false;
    if (d / dt > (MAXV[t.type] || 30) && d > 30) return false;
    t.m += d;
    if (p[3] != null && last[3] != null && p[3] - last[3] > 1) t.elev += p[3] - last[3];
  }
  t.pts.push(p); return true;
}
// marca de pausa: el siguiente punto no suma distancia
export function markGap(t) { const l = t.pts[t.pts.length - 1]; if (l) l[4] = 1; }

// simplifica la ruta para guardarla (máx. ~500 puntos)
export function packRoute(pts) {
  if (pts.length <= 500) return pts.map((p) => [p[0], p[1], p[4] ? 1 : 0]);
  const step = pts.length / 500, out = [];
  for (let i = 0; i < pts.length; i += step) { const j = Math.floor(i); out.push([pts[j][0], pts[j][1], pts.slice(j, Math.floor(i + step)).some((p) => p[4]) ? 1 : 0]); }
  const l = pts[pts.length - 1]; out.push([l[0], l[1], 0]); return out;
}
function segments(route) { const segs = [[]]; for (const p of route) { segs[segs.length - 1].push([p[0], p[1]]); if (p.length > 3 ? p[4] : p[2]) segs.push([]); } return segs.filter((s) => s.length); }

/* ---------- mapa ---------- */
const dark = () => document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
export function makeMap(el, opts = {}) {
  const map = L.map(el, { zoomControl: false, attributionControl: true, dragging: opts.interactive !== false, scrollWheelZoom: false, touchZoom: opts.interactive !== false, doubleClickZoom: opts.interactive !== false });
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark() ? "dark_all" : "rastertiles/voyager"}/{z}/{x}/{y}{r}.png`, {
    maxZoom: 19, subdomains: "abcd", attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
  }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  map.setView(opts.center || [40.4168, -3.7038], opts.center ? 16 : 5);
  return map;
}
export function drawRoute(map, route, layer) {
  if (layer) layer.remove();
  const g = L.layerGroup().addTo(map), segs = segments(route);
  for (const s of segs) { L.polyline(s, { color: "#0B1220", weight: 8, opacity: 0.35 }).addTo(g); L.polyline(s, { color: "#FF5A1F", weight: 5, opacity: 1 }).addTo(g); }
  if (route.length) {
    L.circleMarker([route[0][0], route[0][1]], { radius: 6, color: "#fff", weight: 2, fillColor: "#1FA35C", fillOpacity: 1 }).addTo(g);
  }
  return g;
}
export function hereMarker(map, ll, m) { if (m) { m.setLatLng(ll); return m; } return L.circleMarker(ll, { radius: 8, color: "#fff", weight: 3, fillColor: "#4A8CFF", fillOpacity: 1 }).addTo(map); }
export function fitRoute(map, route) {
  if (!route.length) return; const b = L.latLngBounds(route.map((p) => [p[0], p[1]]));
  map.fitBounds(b, { padding: [24, 24], maxZoom: 17 });
}
