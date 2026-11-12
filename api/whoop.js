// Función de Vercel: conexión con WHOOP (Premium).
// - GET  /api/whoop?code=…&state=…        → vuelta desde WHOOP tras dar permiso
// - POST /api/whoop {action:"start"}       → enlace para conectar
// - POST /api/whoop {action:"sync"}        → trae los entrenos nuevos (y la recuperación de hoy)
// - POST /api/whoop {action:"disconnect"}  → desconecta y borra lo traído
// Variables en Vercel: WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY.
import crypto from "node:crypto";
import { sbAdmin, hasPremium, hasPremiumById, mergeActivities } from "./_sb.js";

const ID = () => (process.env.WHOOP_CLIENT_ID || "").trim();
const SECRET = () => (process.env.WHOOP_CLIENT_SECRET || "").trim();
const AUTH = "https://api.prod.whoop.com/oauth/oauth2/auth", TOKEN = "https://api.prod.whoop.com/oauth/oauth2/token", API = "https://api.prod.whoop.com/developer";
const SCOPES = "offline read:workout read:recovery read:cycles read:profile";
const sign = (s) => crypto.createHmac("sha256", "whoop-state:" + SECRET()).update(s).digest("base64url").slice(0, 32);

export default async function handler(req, res) {
  const sb = sbAdmin();
  if (!ID() || !SECRET()) return res.status(501).json({ code: "whoop_disabled" });
  if (!sb || sb.wrongKey) return res.status(501).json({ code: "disabled" });
  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`, redirect = `${origin}/api/whoop`;

  if (req.method === "GET") {
    const back = (r) => { res.statusCode = 302; res.setHeader("Location", `${origin}/#whoop=${r}`); res.end(); };
    const { code, state = "", error } = req.query || {};
    if (error || !code) return back("cancel");
    const [uid, ts, sig] = String(state).split(".");
    if (!uid || sign(`${uid}.${ts}`) !== sig || Date.now() - Number(ts) > 3600_000) return back("error");
    if (!(await hasPremiumById(sb, uid))) return back("premium");
    try {
      const t = await token({ grant_type: "authorization_code", code, redirect_uri: redirect });
      const prof = await fetch(`${API}/v2/user/profile/basic`, { headers: { Authorization: `Bearer ${t.access_token}` } }).then((r) => r.ok ? r.json() : {}).catch(() => ({}));
      await sb.call(`/rest/v1/whoop`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: uid, whoop_user_id: prof.user_id ? String(prof.user_id) : null, name: [prof.first_name, prof.last_name].filter(Boolean).join(" "),
          access_token: t.access_token, refresh_token: t.refresh_token || null, expires_at: Math.floor(Date.now() / 1000) + (t.expires_in || 3600), updated_at: new Date().toISOString() }) });
      await sync(sb, uid).catch(() => {});
      return back("ok");
    } catch { return back("error"); }
  }

  if (req.method !== "POST") return res.status(405).json({ code: "method" });
  const me = await sb.userFromToken((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  if (!me?.id) return res.status(401).json({ code: "not_granted" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  if (body.action !== "disconnect" && !(await hasPremium(sb, me))) return res.status(402).json({ code: "premium" });
  try {
    if (body.action === "start") {
      const ts = String(Date.now()), state = `${me.id}.${ts}.${sign(`${me.id}.${ts}`)}`;
      const u = new URL(AUTH); u.search = new URLSearchParams({ client_id: ID(), response_type: "code", redirect_uri: redirect, scope: SCOPES, state }).toString();
      return res.status(200).json({ url: u.toString() });
    }
    if (body.action === "sync") return res.status(200).json(await sync(sb, me.id));
    if (body.action === "disconnect") {
      const row = (await sb.call(`/rest/v1/whoop?select=access_token&user_id=eq.${me.id}`).catch(() => []))?.[0];
      if (row?.access_token) await fetch(`${API}/v2/user/access`, { method: "DELETE", headers: { Authorization: `Bearer ${row.access_token}` } }).catch(() => {});
      await sb.call(`/rest/v1/whoop?user_id=eq.${me.id}`, { method: "DELETE" }).catch(() => {});
      await sb.call(`/rest/v1/docs?user_id=eq.${me.id}&id=eq.whoop`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }
  } catch (e) {
    return res.status(502).json({ code: e.code || "error", detail: String(e.message || e).slice(0, 200) });
  }
  return res.status(400).json({ code: "invalid" });
}

async function token(params) {
  const r = await fetch(TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: ID(), client_secret: SECRET(), ...params, ...(params.grant_type === "refresh_token" ? { scope: "offline" } : {}) }).toString() });
  if (!r.ok) { const e = new Error("token " + r.status); e.code = "whoop_token"; throw e; }
  return r.json();
}

async function sync(sb, uid) {
  let row;
  try { row = (await sb.call(`/rest/v1/whoop?select=*&user_id=eq.${uid}`))?.[0]; }
  catch { const e = new Error("Falta la tabla whoop"); e.code = "no_table"; throw e; }
  if (!row) return { connected: false };
  if (row.expires_at < Date.now() / 1000 + 120 && row.refresh_token) {
    const t = await token({ grant_type: "refresh_token", refresh_token: row.refresh_token });
    Object.assign(row, { access_token: t.access_token, refresh_token: t.refresh_token || row.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (t.expires_in || 3600) });
    await sb.call(`/rest/v1/whoop?user_id=eq.${uid}`, { method: "PATCH", body: JSON.stringify({ access_token: row.access_token, refresh_token: row.refresh_token, expires_at: row.expires_at, updated_at: new Date().toISOString() }) });
  }
  const api = async (path) => {
    const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${row.access_token}` } });
    if (r.status === 401) { const e = new Error("revoked"); e.code = "revoked"; throw e; }
    if (r.status === 429) { const e = new Error("rate"); e.code = "whoop_rate"; throw e; }
    if (!r.ok) throw new Error("whoop " + r.status);
    return r.json();
  };
  const prev = (await sb.call(`/rest/v1/docs?select=data&user_id=eq.${uid}&id=eq.whoop`))?.[0]?.data || {};
  const last = Math.max(0, ...(prev.list || []).map((a) => a.start));
  const since = new Date(last ? last - 3 * 86400_000 : Date.now() - 90 * 86400_000).toISOString();
  const items = []; let next = "", pages = 0;
  try {
    do {
      const d = await api(`/v2/activity/workout?limit=25&start=${encodeURIComponent(since)}${next ? `&nextToken=${encodeURIComponent(next)}` : ""}`);
      for (const w of d.records || []) {
        const start = Date.parse(w.start), off = parseOffset(w.timezone_offset), sc = w.score || {};
        items.push({ id: "w" + w.id, name: "", type: w.sport_name || "activity", src: "whoop", start, day: new Date(start + off).toISOString().slice(0, 10),
          dur: Math.round((Date.parse(w.end) - start) / 1000) || 0, km: sc.distance_meter ? Math.round(sc.distance_meter / 10) / 100 : 0,
          hr: sc.average_heart_rate || null, kcal: sc.kilojoule != null ? Math.round(sc.kilojoule / 4.184) : null, strain: sc.strain != null ? Math.round(sc.strain * 10) / 10 : null });
      }
      next = d.next_token || ""; pages++;
    } while (next && pages < 8);
  } catch (e) {
    if (e.code === "revoked") { await sb.call(`/rest/v1/whoop?user_id=eq.${uid}`, { method: "DELETE" }); return { connected: false, revoked: true }; }
    throw e;
  }
  // recuperación más reciente (para mostrarla en la app)
  let recovery = prev.recovery || null;
  try { const r = await api(`/v2/recovery?limit=1`); const x = r.records?.[0]; if (x?.score) recovery = { pct: Math.round(x.score.recovery_score), hrv: Math.round(x.score.hrv_rmssd_milli || 0), rhr: Math.round(x.score.resting_heart_rate || 0), at: x.updated_at || x.created_at }; } catch {}
  return mergeActivities(sb, uid, "whoop", { athlete: row.name || "", recovery }, items);
}
function parseOffset(s) { const m = String(s || "").match(/([+-])(\d{2}):?(\d{2})/); return m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3]) * 60000 : 0; }
