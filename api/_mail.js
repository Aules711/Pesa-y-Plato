// Envío de emails desde tu Gmail (contraseña de aplicación). Variables en Vercel: GMAIL_USER, GMAIL_APP_PASSWORD.
import nodemailer from "nodemailer";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const mailReady = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

export async function sendMail(to, subject, html, text) {
  if (!mailReady()) return { ok: false, reason: "no_config" };
  const t = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER.trim(), pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, "") } });
  try {
    await t.sendMail({ from: `"BEINGHEALTHY" <${process.env.GMAIL_USER.trim()}>`, to, subject, html, text });
    return { ok: true };
  } catch (e) { return { ok: false, reason: "send_failed", detail: String(e.message || e).slice(0, 160) }; }
}

const fmtDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });

// email de Premium regalado o activado
export function premiumEmail({ gift, until, appUrl }) {
  const title = gift ? "¡Te hemos regalado BEINGHEALTHY Premium! 🎁" : "¡Tu Premium ya está activo! ✨";
  const lead = gift ? "Tienes <b>Premium gratis</b>, sin fecha de fin y sin pagar nada. Es nuestro regalo para ti."
    : `Tu suscripción <b>Premium</b> está activa hasta el <b>${esc(fmtDate(until))}</b>. ¡Gracias por confiar en nosotros!`;
  const feats = ["Plan de nutrición a medida, con gramos y calorías de cada plato", "Sube el estudio de tu nutricionista y crea el plan con sus datos",
    "Foto al código de barras de cualquier producto", "Todos tus nutrientes en detalle", "Ayuno intermitente e informe semanal", "Conexión con Garmin y WHOOP"];
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#EEF1F7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1B2233">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F7;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden">
    <tr><td style="background:#121725;padding:28px 28px 22px;text-align:center"><img src="${esc(appUrl)}/icon-192.png" width="64" height="64" alt="" style="border-radius:16px">
      <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:.02em;margin-top:10px">BEINGHEALTHY</div></td></tr>
    <tr><td style="padding:28px">
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px">${title}</h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#3A4356">${lead}</p>
      <p style="font-size:14px;font-weight:700;margin:0 0 8px">Ya puedes usar:</p>
      <ul style="padding-left:20px;margin:0 0 22px;font-size:14px;line-height:1.7;color:#3A4356">${feats.map((f) => `<li>${f}</li>`).join("")}</ul>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td style="background:#4A8CFF;border-radius:12px">
        <a href="${esc(appUrl)}" style="display:inline-block;padding:14px 26px;color:#fff;font-weight:700;font-size:15px;text-decoration:none">Abrir la app</a></td></tr></table>
      <p style="font-size:12.5px;line-height:1.5;color:#7A8396;margin:22px 0 0">Si ya tenías la app abierta, ciérrala y vuelve a abrirla para ver todo lo nuevo.</p>
    </td></tr>
    <tr><td style="padding:16px 28px;background:#F6F8FB;font-size:11.5px;color:#8A93A6;text-align:center">Recibes este email porque tienes una cuenta en BEINGHEALTHY.</td></tr>
  </table></td></tr></table></body></html>`;
  const text = `${title.replace(/<[^>]+>/g, "")}\n\n${lead.replace(/<[^>]+>/g, "")}\n\nYa puedes usar:\n- ${feats.join("\n- ")}\n\nAbre la app: ${appUrl}`;
  return { subject: gift ? "🎁 Te hemos regalado BEINGHEALTHY Premium" : "✨ Tu BEINGHEALTHY Premium ya está activo", html, text };
}
