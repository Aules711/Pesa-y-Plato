// Función de Vercel: conexión con Strava.
// - GET  /api/strava?code=…&state=…  → vuelta desde Strava tras dar permiso (guarda la conexión y trae las actividades)
// - POST /api/strava {action:"start"}      → devuelve el enlace para conectar
// - POST /api/strava {action:"sync"}       → trae las actividades nuevas
// - POST /api/strava {action:"disconnect"} → desconecta y borra lo traído
// Variables en Vercel: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY.
import crypto from "node:crypto";
import { sbAdmin } from "./_sb.js";

const ID = () => (process.env.STRAVA_CLIENT_ID || "").trim();
const SECRET = () => (process.env.STRAVA_CLIENT_SECRET || "").trim();
const DAYS_BACK = 90;
const sign = (s) => crypto.createHmac("sha256", SECRET()).update(s).digest("base64url").slice(0, 32);

export default async function handler(req, res) {
  const sb = sbAdmin();
  if (!ID() || !SECRET()) return res.status(501).json({ code: "strava_disabled" });
  if (!sb || sb.wrongKey) return res.status(501).json({ code: "disabled" });
  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

  // 1. Vuelta desde Strava
  if (req.method === "GET") {
    const back = (r) => { res.statusCode = 302; res.setHeader("Location", `${origin}/#strava=${r}`); res.end(); };
    const { code, state = "", error, scope = "" } = req.query || {};
    if (error || !code) return back("cancel");
    const [uid, ts, sig] = String(state).split(".");
    if (!uid || sign(`${uid}.${ts}`) !== sig || Date.now() - Number(ts) > 3600_000) return back("error");
    if (!String(scope).includes("activity:read")) return back("scope");
    try {
      const t = await stravaToken({ code, grant_type: "authorization_code" });
      await sb.call(`/rest/v1/strava`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: uid, athlete_id: t.athlete?.id, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at,
          athlete_name: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(" "), updated_at: new Date().toISOString() }) });
      await sync(sb, uid).catch(() => {});
      return back("ok");
    } catch { return back("error"); }
  }

  // 2. Acciones desde la app (con sesión)
  if (req.method !== "POST") return res.status(405).json({ code: "method" });
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const me = await sb.userFromToken(token);
  if (!me?.id) return res.status(401).json({ code: "not_granted" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

  try {
    if (body.action === "start") {
      const ts = String(Date.now()), state = `${me.id}.${ts}.${sign(`${me.id}.${ts}`)}`;
      const u = new URL("https://www.strava.com/oauth/mobile/authorize");
      u.search = new URLSearchParams({ client_id: ID(), response_type: "code", redirect_uri: `${origin}/api/strava`, approval_prompt: "auto", scope: "read,activity:read_all", state }).toString();
      return res.status(200).json({ url: u.toString() });
    }
    if (body.action === "sync") return res.status(200).json(await sync(sb, me.id));
    if (body.action === "disconnect") {
      const row = (await sb.call(`/rest/v1/strava?select=*&user_id=eq.${me.id}`))?.[0];
      if (row) await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { Authorization: `Bearer ${row.access_token}` } }).catch(() => {});
      await sb.call(`/rest/v1/strava?user_id=eq.${me.id}`, { method: "DELETE" });
      await sb.call(`/rest/v1/docs?user_id=eq.${me.id}&id=eq.strava`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }
  } catch (e) {
    return res.status(502).json({ code: e.code || "error", detail: String(e.message || e).slice(0, 200) });
  }
  return res.status(400).json({ code: "invalid" });
}

async function stravaToken(params) {
  const r = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: ID(), client_secret: SECRET(), ...params }) });
  if (!r.ok) { const e = new Error("token " + r.status); e.code = "strava_token"; throw e; }
  return r.json();
}

async function sync(sb, uid) {
  let row;
  try { row = (await sb.call(`/rest/v1/strava?select=*&user_id=eq.${uid}`))?.[0]; }
  catch { const e = new Error("Falta la tabla strava"); e.code = "no_table"; throw e; }
  if (!row) return { connected: false };

  // renovar el permiso si ha caducado (dura 6 horas)
  if (row.expires_at < Date.now() / 1000 + 120) {
    const t = await stravaToken({ grant_type: "refresh_token", refresh_token: row.refresh_token });
    Object.assign(row, { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at });
    await sb.call(`/rest/v1/strava?user_id=eq.${uid}`, { method: "PATCH", body: JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, updated_at: new Date().toISOString() }) });
  }
  const api = async (path) => {
    const r = await fetch(`https://www.strava.com/api/v3${path}`, { headers: { Authorization: `Bearer ${row.access_token}` } });
    if (r.status === 401) { const e = new Error("revoked"); e.code = "revoked"; throw e; }
    if (r.status === 429) { const e = new Error("rate"); e.code = "strava_rate"; throw e; }
    if (!r.ok) throw new Error("strava " + r.status);
    return r.json();
  };

  const prevDoc = (await sb.call(`/rest/v1/docs?select=data&user_id=eq.${uid}&id=eq.strava`))?.[0]?.data || {};
  const prev = Array.isArray(prevDoc.list) ? prevDoc.list : [];
  const known = new Map(prev.map((a) => [a.id, a]));
  const since = Math.floor(Date.now() / 1000) - DAYS_BACK * 86400;
  const after = prev.length ? Math.max(since, Math.floor(Math.max(...prev.map((a) => a.start)) / 1000) - 3 * 86400) : since;

  let list;
  try { list = await api(`/athlete/activities?after=${after}&per_page=100`); }
  catch (e) {
    if (e.code === "revoked") { await sb.call(`/rest/v1/strava?user_id=eq.${uid}`, { method: "DELETE" }); return { connected: false, revoked: true }; }
    throw e;
  }
  let details = 0;
  for (const a of list) {
    const old = known.get(a.id);
    let kcal = old?.kcal ?? null;
    if (kcal == null && details < 25) { details++; try { const d = await api(`/activities/${a.id}`); kcal = d.calories || null; } catch {} }
    if (kcal == null && a.kilojoules) kcal = Math.round(a.kilojoules * 1.05);
    known.set(a.id, {
      id: a.id, name: a.name, type: a.sport_type || a.type, start: Date.parse(a.start_date), day: String(a.start_date_local || a.start_date).slice(0, 10),
      dur: a.moving_time || a.elapsed_time || 0, km: Math.round((a.distance || 0) / 10) / 100, elev: Math.round(a.total_elevation_gain || 0),
      hr: a.average_heartrate ? Math.round(a.average_heartrate) : null, kcal: kcal != null ? Math.round(kcal) : null,
    });
  }
  const cut = Date.now() - 180 * 86400_000;
  const all = [...known.values()].filter((a) => a.start >= cut).sort((a, b) => b.start - a.start).slice(0, 300);
  const data = { connected: true, athlete: row.athlete_name || "", athleteId: row.athlete_id, synced: Date.now(), list: all };
  await sb.call(`/rest/v1/docs`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: uid, id: "strava", data }) });
  return data;
}
