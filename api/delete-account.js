// Función de Vercel: el usuario elimina su propia cuenta (derecho de supresión del RGPD).
// Usa la clave service_role, que SOLO vive en las variables de entorno de Vercel.
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ code: "method" });
  const url = process.env.VITE_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return res.status(501).json({ code: "disabled" });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ code: "not_granted" });
  const id = data.user.id;

  // 1. Borrar sus vídeos
  for (;;) {
    const { data: files } = await admin.storage.from("videos").list(id, { limit: 1000 });
    if (!files?.length) break;
    await admin.storage.from("videos").remove(files.map((f) => `${id}/${f.name}`));
    if (files.length < 1000) break;
  }
  // 2. Borrar el usuario (sus datos de la tabla docs se borran solos en cascada)
  const { error: delErr } = await admin.auth.admin.deleteUser(id);
  if (delErr) return res.status(502).json({ code: "error" });
  return res.status(200).json({ ok: true });
}
