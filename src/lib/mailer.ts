interface Email {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends an email via Resend when RESEND_API_KEY is configured; otherwise logs
 * the message so flows remain testable in development. Returns true if the
 * message was handed off (or logged) successfully.
 */
export async function sendEmail({ to, subject, text }: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[mailer] (no RESEND_API_KEY — logging instead)
  To: ${to}
  Subject: ${subject}
  ${text.split("\n").join("\n  ")}`);
    return true;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "OGsmith <onboarding@resend.dev>",
        to: [to],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      console.error(`[mailer] Resend returned ${res.status}:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mailer] send failed:", err);
    return false;
  }
}

export function verificationEmail(link: string): Omit<Email, "to"> {
  return {
    subject: "Verify your OGsmith email",
    text: `Welcome to OGsmith!

Confirm your email address by opening this link:

${link}

The link is valid for 7 days. If you didn't create an account, ignore this email.`,
  };
}

export function resetEmail(link: string): Omit<Email, "to"> {
  return {
    subject: "Reset your OGsmith password",
    text: `Someone (hopefully you) asked to reset the password for this OGsmith account.

Set a new password here (link valid for 1 hour):

${link}

If you didn't ask for this, you can safely ignore it — your password is unchanged.`,
  };
}
