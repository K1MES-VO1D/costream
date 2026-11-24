import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { dir } from "./store.js";

// Sends mail through any SMTP provider: set SMTP_URL (e.g. smtps://user:app-password@smtp.gmail.com:465)
// and optionally MAIL_FROM. Without SMTP_URL the message is written to the console and data/outbox.log
// so the flow still works for local testing.
const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
const from = process.env.MAIL_FROM || "Difonti <no-reply@difonti.local>";
export const mailEnabled = Boolean(transport);

export async function sendMail(to, subject, text) {
  if (!transport) {
    const entry = `--- ${new Date().toISOString()}\nTo: ${to}\nSubject: ${subject}\n\n${text}\n\n`;
    fs.appendFileSync(path.join(dir, "outbox.log"), entry, { mode: 0o600 });
    console.log(`[mail, geen SMTP ingesteld] naar ${to}: ${subject}\n${text}`);
    return;
  }
  await transport.sendMail({ from, to, subject, text });
}
