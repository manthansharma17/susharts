import { getEnv } from '../config/env.js';

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email is not configured (RESEND_API_KEY / EMAIL_FROM)');
  }
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Same key = same email; Resend drops repeats for 24h, so retries can't double-send. */
  idempotencyKey: string;
}

/** Sends one transactional email through Resend's HTTP API. Throws on any failure. */
export async function sendEmail(email: OutgoingEmail): Promise<{ id: string }> {
  const env = getEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new EmailNotConfiguredError();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': email.idempotencyKey,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok || !payload.id) {
    throw new Error(`Resend error ${response.status}: ${payload.message ?? 'unknown error'}`);
  }
  return { id: payload.id };
}

export function publicWebUrl(): string {
  const env = getEnv();
  return (env.PUBLIC_WEB_URL ?? env.CORS_ORIGINS[0] ?? 'http://localhost:5173').replace(/\/$/, '');
}
