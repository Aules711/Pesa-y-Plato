// Función de Vercel: el usuario elimina su propia cuenta (derecho de supresión del RGPD).
// Usa la clave secreta de Supabase, que SOLO vive en las variables de entorno de Vercel.
import { sbAdmin } from "./_sb.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ code: "method" });
  const sb = sbAdmin();
  if (!sb || sb.wrongKey) return res.status(501).json({ code: "disabled" });
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const me = await sb.userFromToken(token);
  if (!me?.id) return res.status(401).json({ code: "not_granted" });
  const id = me.id;
  try {
    // 1. Borrar sus vídeos
    for (let i = 0; i < 50; i++) {
      const files = await sb.call(`/storage/v1/object/list/videos`, { method: "POST", body: JSON.stringify({ prefix: id, limit: 1000 }) }).catch(() => []);
      if (!files?.length) break;
      await sb.call(`/storage/v1/object/videos`, { method: "DELETE", body: JSON.stringify({ prefixes: files.map((f) => `${id}/${f.name}`) }) });
      if (files.length < 1000) break;
    }
    // 2. Borrar el usuario (sus datos de la tabla docs se borran solos en cascada)
    await sb.call(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
    return res.status(200).json({ ok: true });
  } catch { return res.status(502).json({ code: "error" }); }
}
