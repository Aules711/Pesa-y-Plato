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
