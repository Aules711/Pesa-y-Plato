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
  // actividades nuevas (resumen) y sus detalles segundo a segundo, agrupadas por persona
  const byUser = new Map(), add = (a) => { if (a?.userId) (byUser.get(a.userId) || byUser.set(a.userId, []).get(a.userId)).push(a); };
  for (const a of [...(body.activities || []), ...(body.manuallyUpdatedActivities || [])]) add(a);
  for (const d of body.activityDetails || []) add({ ...(d.summary || {}), userId: d.userId, activityId: d.activityId || d.summary?.activityId, summaryId: d.summaryId, _det: d });
  for (const [gid, acts] of byUser) {
    const row = (await sb.call(`/rest/v1/garmin?select=user_id&garmin_user_id=eq.${encodeURIComponent(gid)}`).catch(() => []))?.[0];
    if (!row || !(await hasPremiumById(sb, row.user_id))) continue;
    const items = acts.map((a) => {
      const start = (a.startTimeInSeconds || 0) * 1000, local = new Date(start + (a.startTimeOffsetInSeconds || 0) * 1000);
      return { id: "g" + (a.activityId || a.summaryId), gid: a.activityId || null, name: a.activityName || "", type: a.activityType || "OTHER", src: "garmin",
        start, day: local.toISOString().slice(0, 10), dur: a.durationInSeconds || 0, km: Math.round((a.distanceInMeters || 0) / 10) / 100,
        hr: a.averageHeartRateInBeatsPerMinute || null, kcal: a.activeKilocalories != null ? Math.round(a.activeKilocalories) : null,
        device: a.deviceName || "", ...extra(a), ...(a._det ? { det: details(a._det) } : {}) };
    });
    // los detalles no deben borrar datos del resumen que ya teníamos
    for (const [i, it] of items.entries()) if (acts[i]._det) for (const k of Object.keys(it)) if (it[k] == null || it[k] === "" || (it[k] === 0 && k !== "start") || (k === "type" && it[k] === "OTHER")) delete it[k];
    await mergeActivities(sb, row.user_id, "garmin", {}, items);
  }
}

// datos extra del resumen (si el reloj los da)
function extra(a) {
  const o = {}, put = (k, v) => { if (v != null && v !== 0 && !Number.isNaN(v)) o[k] = v; };
  put("maxHr", a.maxHeartRateInBeatsPerMinute);
  put("cad", a.averageRunCadenceInStepsPerMinute ? Math.round(a.averageRunCadenceInStepsPerMinute) : a.averageBikeCadenceInRoundsPerMinute ? Math.round(a.averageBikeCadenceInRoundsPerMinute) : null);
  put("maxCad", a.maxRunCadenceInStepsPerMinute ? Math.round(a.maxRunCadenceInStepsPerMinute) : null);
  put("elev", a.totalElevationGainInMeters != null ? Math.round(a.totalElevationGainInMeters) : null);
  put("elevDown", a.totalElevationLossInMeters != null ? Math.round(a.totalElevationLossInMeters) : null);
  put("pow", a.averagePowerInWatts ? Math.round(a.averagePowerInWatts) : null);
  put("steps", a.steps);
  return o;
}
// resumen compacto de las muestras: parciales por km, tiempo por pulsaciones, desacople del pulso y cadencia
function details(d) {
  const S = (d.samples || []).filter((x) => x.startTimeInSeconds).sort((a, b) => a.startTimeInSeconds - b.startTimeInSeconds);
  if (S.length < 10) return null;
  const hh = {}, splits = []; let lastKmT = S[0].startTimeInSeconds, kmIdx = 1, hrS = 0, hrN = 0, cadS = 0, cadN = 0, up = 0, prevEl = null;
  const half = [{ t: 0, d: 0, hr: 0, n: 0 }, { t: 0, d: 0, hr: 0, n: 0 }], dEnd = S[S.length - 1].totalDistanceInMeters || 0;
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i], dt = Math.min(10, Math.max(0, b.startTimeInSeconds - a.startTimeInSeconds));
    if (b.heartRate) { const k = Math.floor(b.heartRate / 5) * 5; hh[k] = (hh[k] || 0) + dt; hrS += b.heartRate; hrN++; }
    const cad = b.stepsPerMinute || b.bikeCadenceInRPM; if (cad) { cadS += cad; cadN++; }
    if (b.elevationInMeters != null && prevEl != null && b.elevationInMeters > prevEl) up += b.elevationInMeters - prevEl;
    if (b.elevationInMeters != null) prevEl = b.elevationInMeters;
    const dist = b.totalDistanceInMeters || 0, h = dEnd && dist > dEnd / 2 ? 1 : 0;
    if (b.heartRate && b.speedMetersPerSecond > 0.5) { half[h].hr += b.heartRate; half[h].n++; half[h].t += dt; half[h].d += b.speedMetersPerSecond * dt; }
    if (dist >= kmIdx * 1000) {
      splits.push({ k: kmIdx, s: b.startTimeInSeconds - lastKmT, hr: hrN ? Math.round(hrS / hrN) : null, cad: cadN ? Math.round(cadS / cadN) : null, up: Math.round(up) });
      lastKmT = b.startTimeInSeconds; kmIdx++; hrS = hrN = cadS = cadN = 0; up = 0;
    }
  }
  const rest = dEnd - (kmIdx - 1) * 1000; if (rest > 150) splits.push({ k: Math.round((kmIdx - 1 + rest / 1000) * 100) / 100, s: S[S.length - 1].startTimeInSeconds - lastKmT, hr: hrN ? Math.round(hrS / hrN) : null, cad: cadN ? Math.round(cadS / cadN) : null, up: Math.round(up), part: 1 });
  let dec = null;
  if (half[0].n > 30 && half[1].n > 30 && half[0].d > 0 && half[1].d > 0) {
    const ef = (x) => (x.d / x.t) / (x.hr / x.n);          // velocidad por pulsación
    dec = Math.round((ef(half[0]) / ef(half[1]) - 1) * 1000) / 10;
  }
  const allCad = S.map((x) => x.stepsPerMinute || x.bikeCadenceInRPM).filter(Boolean);
  return { splits: splits.slice(0, 120), hh, dec, cad: allCad.length ? Math.round(allCad.reduce((a, b) => a + b, 0) / allCad.length) : null };
}
