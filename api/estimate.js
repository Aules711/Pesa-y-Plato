// Función de Vercel: estima calorías y macros con IA, a partir de una FOTO del plato o de una descripción en texto.
// Solo responde a usuarios con sesión iniciada y con Premium (cuesta dinero de tu cuenta de Anthropic).
// La clave de Anthropic vive en las variables de entorno de Vercel (ANTHROPIC_API_KEY), nunca en el navegador.

const PER_MINUTE = 5;            // límite por usuario y minuto
const PER_DAY = 40;              // límite por usuario y día (para que nadie dispare tu factura)
const FREE = ["ametsaule@gmail.com"];
const hits = new Map();          // memoria de la instancia (se reinicia sola)

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ code: "method" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ code: "disabled" });
  const SB = process.env.VITE_SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY;

  // 1. Quién llama
  const auth = req.headers.authorization || "";
  const who = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: ANON, Authorization: auth } });
  if (!who.ok) return res.status(401).json({ code: "not_granted" });
  const { id, email = "" } = await who.json();

  // 2. Solo Premium (o administradores / regalados)
  const mail = email.toLowerCase();
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  let ok = admins.includes(mail) || FREE.includes(mail);
  if (!ok) {
    const p = await fetch(`${SB}/rest/v1/premium?select=until&user_id=eq.${id}`, { headers: { apikey: ANON, Authorization: auth } });
    const row = p.ok ? (await p.json())[0] : null;
    ok = !!row && (!row.until || row.until >= new Date().toISOString().slice(0, 10));
  }
  if (!ok) return res.status(402).json({ code: "premium" });

  // 3. Límites de uso
  const now = Date.now(), list = (hits.get(id) || []).filter((t) => now - t < 86_400_000);
  if (list.filter((t) => now - t < 60_000).length >= PER_MINUTE || list.length >= PER_DAY) return res.status(429).json({ code: "rate_limited" });
  hits.set(id, [...list, now]);

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const text = String(body.text || "").trim().slice(0, 1000);
  const image = typeof body.image === "string" ? body.image.replace(/^data:image\/\w+;base64,/, "") : "";
  if (!text && !image) return res.status(400).json({ code: "invalid" });
  if (image.length > 3_500_000) return res.status(413).json({ code: "too_big" });

  // 4. Pedir la estimación
  const rules = `Eres un dietista experto en cocina española. ${image ? "Mira la foto y reconoce cada alimento que se ve en el plato (o en la mesa)." : "Estima lo que describe esta persona."}
Calcula los gramos de cada alimento fijándote en el tamaño del plato, de los cubiertos y de las manos si salen. Si no se indican cantidades, usa raciones normales de un adulto.
Separa los componentes (por ejemplo: arroz, pollo, aceite, salsa) para que la persona pueda corregir cada uno. Incluye el aceite o la salsa si se ve o es lo habitual en ese plato.
${image ? "Si en la foto no hay comida, devuelve items vacío y explica por qué en \"note\"." : ""}
Responde SOLO con JSON con esta forma:
{"dish":"nombre corto del plato en español","items":[{"name":"nombre corto en español","grams":número,"kcal100":kcal por 100 g,"p100":proteína g por 100 g,"c100":carbohidratos g por 100 g,"f100":grasa g por 100 g}],"note":"una frase corta si hay algo dudoso, si no vacío"}
${text ? `Descripción${image ? " añadida por la persona" : ""}: ${text}` : ""}`;
  const content = image
    ? [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } }, { type: "text", text: rules }]
    : rules;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 1200, messages: [{ role: "user", content }] }),
  });
  if (r.status === 429) return res.status(429).json({ code: "rate_limited" });
  if (!r.ok) return res.status(502).json({ code: "upstream" });

  const out = (await r.json()).content?.map((c) => c.text || "").join("") || "";
  try {
    const data = JSON.parse(out.match(/\{[\s\S]*\}/)[0]);
    const n = (v) => Math.max(0, Number(v) || 0);
    const items = (Array.isArray(data.items) ? data.items : []).slice(0, 20).filter((i) => i && i.name).map((i) => ({
      name: String(i.name).slice(0, 80), grams: n(i.grams), kcal100: n(i.kcal100), p100: n(i.p100), c100: n(i.c100), f100: n(i.f100),
    }));
    return res.status(200).json({ dish: String(data.dish || "").slice(0, 80), note: String(data.note || "").slice(0, 200), items });
  } catch {
    return res.status(502).json({ code: "invalid_json" });
  }
}
