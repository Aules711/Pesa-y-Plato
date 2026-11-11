// Función de Vercel: Premium y panel de administración.
// - "me": dice si quien llama es administrador y devuelve el número de Bizum (solo a usuarios con sesión).
// - "list", "grant", "revoke": solo para los emails de ADMIN_EMAILS.
// Variables en Vercel: SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS (separados por comas), BIZUM_PHONE.
import { createClient } from "@supabase/supabase-js";

const addMonths = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return res.status(501).json({ code: "disabled" });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ code: "not_granted" });
  const me = data.user;
  const admins = ["ametsaule@gmail.com", ...(process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)];
  const isAdmin = admins.includes((me.email || "").toLowerCase());

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const action = body.action || req.query?.action || "me";

  if (action === "me") return res.status(200).json({ admin: isAdmin, phone: process.env.BIZUM_PHONE || null, price: process.env.PREMIUM_PRICE || "3" });
  if (!isAdmin) return res.status(403).json({ code: "forbidden" });

  if (action === "list") {
    const users = [];
    for (let page = 1; page < 50; page++) {
      const { data: d, error: e } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (e) return res.status(502).json({ code: "error" });
      users.push(...d.users); if (d.users.length < 1000) break;
    }
    const { data: prem } = await admin.from("premium").select("*");
    const P = Object.fromEntries((prem || []).map((p) => [p.user_id, p]));
    return res.status(200).json({ users: users.map((u) => ({ id: u.id, email: u.email, created: u.created_at, last: u.last_sign_in_at,
      premium: P[u.id] ? { until: P[u.id].until, note: P[u.id].note } : null })).sort((a, b) => (b.created || "").localeCompare(a.created || "")) });
  }

  if (action === "grant" || action === "revoke") {
    const { data: target, error: e } = await admin.auth.admin.getUserById(body.user_id || "");
    if (e || !target?.user) return res.status(404).json({ code: "not_found" });
    if (action === "revoke") { await admin.from("premium").delete().eq("user_id", target.user.id); return res.status(200).json({ ok: true }); }
    const { data: cur } = await admin.from("premium").select("until").eq("user_id", target.user.id).maybeSingle();
    let until = null, note = "Regalado";
    if (!body.forever) {
      const months = Math.max(1, Math.min(24, parseInt(body.months || 1, 10)));
      const base = cur?.until && cur.until > today() ? cur.until : today();
      until = addMonths(base, months); note = "Pagado por Bizum";
    }
    const { error: e2 } = await admin.from("premium").upsert({ user_id: target.user.id, email: target.user.email, until, note, updated_at: new Date().toISOString() });
    if (e2) return res.status(502).json({ code: "error" });
    return res.status(200).json({ ok: true, until });
  }
  return res.status(400).json({ code: "invalid" });
}
