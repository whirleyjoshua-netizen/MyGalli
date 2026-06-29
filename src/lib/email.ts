import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM || 'My Galli <onboarding@resend.dev>'

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    // Dev fallback: no provider configured — log so links are usable locally.
    console.log(`\n[email:dev] To: ${opts.to}\n[email:dev] Subject: ${opts.subject}\n[email:dev] ${opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n`)
    return
  }
  const resend = new Resend(key)
  await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html })
}

function shell(title: string, body: string, cta: { href: string; label: string }): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#0F3D2E">${title}</h1>
    <p style="color:#475569;font-size:14px;line-height:1.6">${body}</p>
    <a href="${cta.href}" style="display:inline-block;margin-top:16px;background:#39D98A;color:#fff;padding:10px 20px;border-radius:9999px;text-decoration:none;font-weight:600">${cta.label}</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:20px">If the button doesn't work, paste this link: ${cta.href}</p>
  </div>`
}

export function verificationEmail(link: string) {
  return {
    subject: 'Verify your My Galli email',
    html: shell('Welcome to My Galli', 'Confirm your email to secure your account.', { href: link, label: 'Verify email' }),
  }
}

export function resetEmail(link: string) {
  return {
    subject: 'Reset your My Galli password',
    html: shell('Reset your password', 'Click below to choose a new password. This link expires in 1 hour.', { href: link, label: 'Reset password' }),
  }
}
