// Llamadas a Supabase con la clave secreta, sin librerías.
// Sirve con la clave nueva (sb_secret_…) y con la antigua (service_role, eyJ…).
export function sbAdmin() {
  const url = process.env.VITE_SUPABASE_URL, key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  if (key.startsWith("sb_publishable_") || key === (process.env.VITE_SUPABASE_ANON_KEY || "").trim()) return { wrongKey: true };
  const base = { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) };
  const call = async (path, opt = {}) => {
    const r = await fetch(url + path, { ...opt, headers: { ...base, "content-type": "application/json", ...(opt.headers || {}) } });
    const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) { const e = new Error((data && (data.msg || data.message || data.error_description || data.error)) || `HTTP ${r.status}`); e.status = r.status; throw e; }
    return data;
  };
  return {
    call,
    // quién llama (con el token de su sesión)
    async userFromToken(token) {
      const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY || key, Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : null;
    },
  };
}

// ¿Tiene Premium? (administradores y regalados incluidos)
const FREE = ["ametsaule@gmail.com"];
export async function hasPremium(sb, me) {
  const mail = (me?.email || "").toLowerCase();
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (FREE.includes(mail) || admins.includes(mail)) return true;
  try {
    const row = (await sb.call(`/rest/v1/premium?select=until&user_id=eq.${me.id}`))?.[0];
    return !!row && (!row.until || row.until >= new Date().toISOString().slice(0, 10));
  } catch { return false; }
}
export async function hasPremiumById(sb, id) {
  try {
    const u = await sb.call(`/auth/v1/admin/users/${id}`);
    return hasPremium(sb, { id, email: u?.email });
  } catch { return false; }
}
// Guarda/mezcla actividades en el documento del usuario ("strava" o "garmin")
export async function mergeActivities(sb, uid, docId, extra, items) {
  const prev = (await sb.call(`/rest/v1/docs?select=data&user_id=eq.${uid}&id=eq.${docId}`))?.[0]?.data || {};
  const map = new Map((prev.list || []).map((a) => [String(a.id), a]));
  for (const a of items) map.set(String(a.id), { ...map.get(String(a.id)), ...a });
  const cut = Date.now() - 180 * 86400_000;
  const list = [...map.values()].filter((a) => a.start >= cut).sort((a, b) => b.start - a.start).slice(0, 300);
  const data = { ...prev, ...extra, connected: true, synced: Date.now(), list };
  await sb.call(`/rest/v1/docs`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: uid, id: docId, data }) });
  return data;
}
