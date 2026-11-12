// Función de Vercel: nutricionista con IA (Premium).
// Recibe la conversación y un resumen de los datos de la persona (objetivos, lo que ha comido, su plan, su ejercicio)
// y responde como un dietista-nutricionista. Usa ANTHROPIC_API_KEY (solo en Vercel).
import { sbAdmin, hasPremium } from "./_sb.js";

const PER_MINUTE = 6, PER_DAY = 60;
const hits = new Map();

const SYSTEM = `Eres «Nutri», el nutricionista con IA de BEINGHEALTHY, una app española de diario de comidas.
Hablas en español de España, cercano y motivador, tuteando, sin rodeos. Respuestas cortas y útiles para leer en el móvil:
normalmente 3-8 líneas o una lista breve; usa **negrita** para lo importante y listas con «- ». Nada de tablas.

Tienes los datos reales de la persona en <datos>. Úsalos siempre que ayuden: cita sus números (kcal, proteína, lo que ha comido, lo que le queda hoy, su plan del día, su ejercicio) y da consejos concretos con alimentos normales de supermercado español y cantidades en gramos.
Si te pide qué comer, propón opciones que encajen con lo que le queda del día y con su plan si lo tiene.
Si faltan datos (por ejemplo, no ha apuntado nada), dilo con naturalidad y pregunta lo mínimo.

Límites (muy importante):
- No diagnosticas ni tratas enfermedades. Si menciona una enfermedad, medicación, embarazo o lactancia, alergias, problemas de riñón, diabetes, etc., da solo pautas generales y recomienda consultarlo con su médico o un dietista-nutricionista colegiado.
- No propongas dietas por debajo de 1200 kcal (mujeres) / 1500 kcal (hombres), ayunos extremos, ni bajar más de ~1 % del peso por semana. No recomiendes suplementos con dosis concretas más allá de lo habitual (proteína en polvo, creatina 3-5 g, vitamina D si su médico la indica).
- Si notas señales de una relación problemática con la comida (miedo a comer, compensar con ejercicio o vómitos, restricción muy fuerte, culpa intensa), no des números ni planes: responde con cariño, sin juzgar, y anímale a hablarlo con un profesional; en España puede llamar al 024 si lo está pasando mal.
- No hables de temas que no sean nutrición, alimentación, hábitos, ejercicio o el uso de la app; reconduce con amabilidad.
- Nunca inventes datos de la persona que no estén en <datos>.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ code: "method" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ code: "disabled" });
  const sb = sbAdmin();
  if (!sb || sb.wrongKey) return res.status(501).json({ code: "no_service" });

  const me = await sb.userFromToken((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  if (!me?.id) return res.status(401).json({ code: "not_granted" });
  if (!(await hasPremium(sb, me))) return res.status(402).json({ code: "premium" });

  const now = Date.now(), list = (hits.get(me.id) || []).filter((t) => now - t < 86_400_000);
  if (list.filter((t) => now - t < 60_000).length >= PER_MINUTE || list.length >= PER_DAY) return res.status(429).json({ code: "rate_limited" });
  hits.set(me.id, [...list, now]);

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const ctx = String(body.context || "").slice(0, 8000);
  const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-12)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .map((m) => ({ role: m.role, content: m.text.slice(0, 2000) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return res.status(400).json({ code: "invalid" });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 900,
      system: `${SYSTEM}\n\n<datos>\n${ctx}\n</datos>`, messages: msgs }),
  });
  if (r.status === 429) return res.status(429).json({ code: "rate_limited" });
  if (!r.ok) return res.status(502).json({ code: "upstream" });
  const text = ((await r.json()).content || []).map((c) => c.text || "").join("").trim();
  return res.status(200).json({ text: text || "Perdona, no he podido responder. ¿Me lo repites?" });
}
