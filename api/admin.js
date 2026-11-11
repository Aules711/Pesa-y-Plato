// Función de Vercel: Premium y portal de administración.
// - "me": dice si quien llama es administrador y devuelve el número de Bizum (solo a usuarios con sesión).
// - "list", "grant", "revoke": solo para administradores (ametsaule@gmail.com y los de ADMIN_EMAILS).
// Variables en Vercel: SUPABASE_SERVICE_ROLE_KEY, BIZUM_PHONE, opcional ADMIN_EMAILS (separados por comas).
import { sbAdmin } from "./_sb.js";

const addMonths = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export default async function handler(req, res) {
  const sb = sbAdmin();
  if (!sb) return res.status(501).json({ code: "disabled" });
  if (sb.wrongKey) return res.status(500).json({ code: "wrong_key" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const me = await sb.userFromToken(token);
  if (!me?.id) return res.status(401).json({ code: "not_granted" });
  const admins = ["ametsaule@gmail.com", ...(process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)];
  const isAdmin = admins.includes((me.email || "").toLowerCase());

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const action = body.action || req.query?.action || "me";

  if (action === "me") return res.status(200).json({ admin: isAdmin, phone: process.env.BIZUM_PHONE || null, price: process.env.PREMIUM_PRICE || "3" });
  if (!isAdmin) return res.status(403).json({ code: "forbidden" });

  try {
    if (action === "list") {
      const users = [];
      for (let page = 1; page < 50; page++) {
        const d = await sb.call(`/auth/v1/admin/users?page=${page}&per_page=1000`);
        const list = d?.users || []; users.push(...list); if (list.length < 1000) break;
      }
      let prem = [], noTable = false;
      try { prem = await sb.call(`/rest/v1/premium?select=*`); } catch (e) { noTable = true; }
      const P = Object.fromEntries((prem || []).map((p) => [p.user_id, p]));
      return res.status(200).json({ noTable, users: users.map((u) => ({ id: u.id, email: u.email, created: u.created_at, last: u.last_sign_in_at,
        premium: P[u.id] ? { until: P[u.id].until, note: P[u.id].note } : null })).sort((a, b) => (b.created || "").localeCompare(a.created || "")) });
    }

    if (action === "grant" || action === "revoke") {
      const id = String(body.user_id || "");
      const target = await sb.call(`/auth/v1/admin/users/${encodeURIComponent(id)}`).catch(() => null);
      if (!target?.id) return res.status(404).json({ code: "not_found" });
      if (action === "revoke") { await sb.call(`/rest/v1/premium?user_id=eq.${target.id}`, { method: "DELETE" }); return res.status(200).json({ ok: true }); }
      const cur = (await sb.call(`/rest/v1/premium?select=until&user_id=eq.${target.id}`))?.[0];
      let until = null, note = "Regalado";
      if (!body.forever) {
        const months = Math.max(1, Math.min(24, parseInt(body.months || 1, 10)));
        const base = cur?.until && cur.until > today() ? cur.until : today();
        until = addMonths(base, months); note = "Pagado por Bizum";
      }
      await sb.call(`/rest/v1/premium`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: target.id, email: target.email, until, note, updated_at: new Date().toISOString() }) });
      return res.status(200).json({ ok: true, until });
    }
  } catch (e) {
    return res.status(502).json({ code: "supabase", detail: String(e.message || e).slice(0, 200), status: e.status || 0 });
  }
  return res.status(400).json({ code: "invalid" });
}
