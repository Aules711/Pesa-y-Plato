// Función de Vercel: conexión con Garmin Connect (programa Starter: Garmin nos ENVÍA las actividades nuevas).
// - GET  /api/garmin?code=…&state=…        → vuelta desde Garmin tras dar permiso
// - POST /api/garmin {action:"start"}       → enlace para conectar (solo Premium)
// - POST /api/garmin {action:"disconnect"}  → desconecta y borra lo recibido
// - POST /api/garmin  con cabecera garmin-client-id → avisos de Garmin (actividades nuevas, bajas)
// Variables en Vercel: GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY.
import crypto from "node:crypto";
import { sbAdmin, hasPremium, hasPremiumById, mergeActivities } from "./_sb.js";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
const ID = () => (process.env.GARMIN_CLIENT_ID || "").trim();
const SECRET = () => (process.env.GARMIN_CLIENT_SECRET || "").trim();
const TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const API = "https://apis.garmin.com/wellness-api/rest";
const hmac = (s) => crypto.createHmac("sha256", SECRET()).update(s).digest("base64url");
const verifierFor = (uid, ts) => hmac(`pkce.${uid}.${ts}`) + hmac(`pkce2.${uid}.${ts}`).slice(0, 20);   // 63 caracteres, se puede recalcular

export default async function handler(req, res) {
  const sb = sbAdmin();
  if (!ID() || !SECRET()) return res.status(501).json({ code: "garmin_disabled" });
  if (!sb || sb.wrongKey) return res.status(501).json({ code: "disabled" });
  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const redirect = `${origin}/api/garmin`;

  // 1. Avisos de Garmin (push)
  if (req.method === "POST" && req.headers["garmin-client-id"] !== undefined) {
    if (req.headers["garmin-client-id"] !== ID()) return res.status(401).json({ code: "bad_client" });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    try { await handlePush(sb, body); } catch (e) { console.error(e); }
    return res.status(200).json({ ok: true });
  }

  // 2. Vuelta desde Garmin
  if (req.method === "GET") {
    const back = (r) => { res.statusCode = 302; res.setHeader("Location", `${origin}/#garmin=${r}`); res.end(); };
    const { code, state = "", error } = req.query || {};
    if (error || !code) return back("cancel");
    const [uid, ts, sig] = String(state).split(".");
    if (!uid || hmac(`${uid}.${ts}`).slice(0, 32) !== sig || Date.now() - Number(ts) > 3600_000) return back("error");
    if (!(await hasPremiumById(sb, uid))) return back("premium");
    try {
      const t = await token({ grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifierFor(uid, ts), state });
      const who = await fetch(`${API}/user/id`, { headers: { Authorization: `Bearer ${t.access_token}` } }).then((r) => r.ok ? r.json() : {});
      if (!who.userId) return back("error");
      // si ese reloj estaba unido a otra cuenta de la app, se mueve a esta
      await sb.call(`/rest/v1/garmin?garmin_user_id=eq.${encodeURIComponent(who.userId)}&user_id=neq.${uid}`, { method: "DELETE" }).catch(() => {});
      await sb.call(`/rest/v1/garmin`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: uid, garmin_user_id: String(who.userId), access_token: t.access_token, refresh_token: t.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + (t.expires_in || 86400), updated_at: new Date().toISOString() }) });
      await mergeActivities(sb, uid, "garmin", { athlete: "" }, []);
      return back("ok");
    } catch { return back("error"); }
  }

  // 3. Acciones desde la app
  if (req.method !== "POST") return res.status(405).json({ code: "method" });
  const me = await sb.userFromToken((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  if (!me?.id) return res.status(401).json({ code: "not_granted" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  try {
    if (body.action === "start") {
      if (!(await hasPremium(sb, me))) return res.status(402).json({ code: "premium" });
      const ts = String(Date.now()), state = `${me.id}.${ts}.${hmac(`${me.id}.${ts}`).slice(0, 32)}`;
      const challenge = crypto.createHash("sha256").update(verifierFor(me.id, ts)).digest("base64url");
      const u = new URL("https://connect.garmin.com/oauth2Confirm");
      u.search = new URLSearchParams({ client_id: ID(), response_type: "code", redirect_uri: redirect, state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
      return res.status(200).json({ url: u.toString() });
    }
    if (body.action === "disconnect") {
      let row = null;
      try { row = (await sb.call(`/rest/v1/garmin?select=*&user_id=eq.${me.id}`))?.[0]; } catch {}
      if (row) {
        try {
          if (row.expires_at < Date.now() / 1000 + 60) { const t = await token({ grant_type: "refresh_token", refresh_token: row.refresh_token }); row.access_token = t.access_token; }
          await fetch(`${API}/user/registration`, { method: "DELETE", headers: { Authorization: `Bearer ${row.access_token}` } });
        } catch {}
        await sb.call(`/rest/v1/garmin?user_id=eq.${me.id}`, { method: "DELETE" });
      }
      await sb.call(`/rest/v1/docs?user_id=eq.${me.id}&id=eq.garmin`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }
  } catch (e) {
    return res.status(502).json({ code: e.code || "error", detail: String(e.message || e).slice(0, 200) });
  }
  return res.status(400).json({ code: "invalid" });
}

async function token(params) {
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: ID(), client_secret: SECRET(), ...params }).toString() });
  if (!r.ok) { const e = new Error("token " + r.status); e.code = "garmin_token"; throw e; }
  return r.json();
}

async function handlePush(sb, body) {
  // bajas: la persona quitó el permiso desde Garmin Connect
  for (const d of body.deregistrations || []) {
    const rows = await sb.call(`/rest/v1/garmin?select=user_id&garmin_user_id=eq.${encodeURIComponent(d.userId)}`).catch(() => []);
    for (const r of rows || []) {
      await sb.call(`/rest/v1/garmin?user_id=eq.${r.user_id}`, { method: "DELETE" });
      await sb.call(`/rest/v1/docs?user_id=eq.${r.user_id}&id=eq.garmin`, { method: "DELETE" });
    }
  }
  // actividades nuevas, agrupadas por persona
  const byUser = new Map();
  for (const a of [...(body.activities || []), ...(body.manuallyUpdatedActivities || [])]) {
    if (!a?.userId) continue; (byUser.get(a.userId) || byUser.set(a.userId, []).get(a.userId)).push(a);
  }
  for (const [gid, acts] of byUser) {
    const row = (await sb.call(`/rest/v1/garmin?select=user_id&garmin_user_id=eq.${encodeURIComponent(gid)}`).catch(() => []))?.[0];
    if (!row || !(await hasPremiumById(sb, row.user_id))) continue;
    const items = acts.map((a) => {
      const start = (a.startTimeInSeconds || 0) * 1000, local = new Date(start + (a.startTimeOffsetInSeconds || 0) * 1000);
      return { id: "g" + (a.activityId || a.summaryId), gid: a.activityId || null, name: a.activityName || "", type: a.activityType || "OTHER", src: "garmin",
        start, day: local.toISOString().slice(0, 10), dur: a.durationInSeconds || 0, km: Math.round((a.distanceInMeters || 0) / 10) / 100,
        hr: a.averageHeartRateInBeatsPerMinute || null, kcal: a.activeKilocalories != null ? Math.round(a.activeKilocalories) : null,
        device: a.deviceName || "" };
    });
    await mergeActivities(sb, row.user_id, "garmin", {}, items);
  }
}
