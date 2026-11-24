import { env } from "./env.js";

type Mail = { to: string; subject: string; text: string };

/**
 * Sends an email through Resend when RESEND_API_KEY is set.
 * Without it (local development) the email is printed to the API console instead.
 */
export async function sendMail(mail: Mail) {
  if (!env.resendKey) {
    console.log(`\n--- email (set RESEND_API_KEY to really send) ---\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n---\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.resendKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.mailFrom, to: mail.to, subject: mail.subject, text: mail.text }),
  });
  if (!res.ok) throw new Error(`Email failed: ${res.status} ${await res.text()}`);
}
