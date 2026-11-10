// Función de Vercel: estima calorías y macros de una comida descrita en texto.
// Solo responde a usuarios con sesión iniciada en la app y usa tu clave de Anthropic,
// que vive en las variables de entorno de Vercel (nunca en el navegador).

const PER_MINUTE = 5;            // límite sencillo por usuario y minuto (web pública: más bajo)
const hits = new Map();          // memoria de la instancia (se reinicia sola)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ code: "method" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || process.env.VITE_AI_ENABLED !== "true") return res.status(501).json({ code: "disabled" });

  // 1. Comprobar que quien llama tiene sesión en Supabase
  const auth = req.headers.authorization || "";
  const who = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: auth },
  });
  if (!who.ok) return res.status(401).json({ code: "not_granted" });
  const { id } = await who.json();

  // 2. Límite de uso para que nadie dispare tu factura
  const now = Date.now();
  const recent = (hits.get(id) || []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) return res.status(429).json({ code: "rate_limited" });
  hits.set(id, [...recent, now]);

  const text = String(req.body?.text || "").trim();
  if (!text || text.length > 1000) return res.status(400).json({ code: "invalid" });

  // 3. Pedir la estimación
  const prompt = `Eres un dietista. Estima la información nutricional de lo que describe esta persona (comida española habitual si no se indica otra cosa). Si no da cantidades, usa raciones normales de un adulto.
Responde SOLO con JSON con esta forma: {"items":[{"name":"nombre corto en español","grams":número,"kcal":número,"p":gramos de proteína,"c":gramos de carbohidratos,"f":gramos de grasa}]}
Descripción: ${text}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (r.status === 429) return res.status(429).json({ code: "rate_limited" });
  if (!r.ok) return res.status(502).json({ code: "upstream" });

  const out = (await r.json()).content?.map((c) => c.text || "").join("") || "";
  try {
    const data = JSON.parse(out.match(/\{[\s\S]*\}/)[0]);
    return res.status(200).json({ items: Array.isArray(data.items) ? data.items.slice(0, 20) : [] });
  } catch {
    return res.status(502).json({ code: "invalid_json" });
  }
}
