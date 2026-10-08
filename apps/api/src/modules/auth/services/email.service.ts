import { request } from "node:https";
import type { EmailConfig } from "../../../config/env.js";

/**
 * Lightweight Resend email sender built on Node's native https module.
 * No external dependencies required.
 *
 * When resendApiKey is empty (development / test) the email is NOT sent;
 * instead the reset link is written to stdout so developers can still test
 * the full flow locally without a real email account.
 */
export class EmailService {
  constructor(private readonly config: EmailConfig) {}

  get appUrl(): string {
    return this.config.appUrl;
  }

  async sendPasswordReset(input: {
    to: string;
    resetUrl: string;
    firstName: string;
  }): Promise<void> {
    if (!this.config.resendApiKey) {
      // Development / test fallback — log instead of sending.
      console.info(
        `[email-service] Password-reset link for ${input.to} → ${input.resetUrl}`,
      );
      return;
    }

    const htmlBody = buildResetEmailHtml(input.firstName, input.resetUrl);
    const textBody = buildResetEmailText(input.firstName, input.resetUrl);

    await this.sendViaResend({
      from: this.config.from,
      to: [input.to],
      subject: "Reset your HAZA AIOS password",
      html: htmlBody,
      text: textBody,
    });
  }

  private sendViaResend(payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);

      const req = request(
        {
          hostname: "api.resend.com",
          path: "/emails",
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.resendApiKey}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(
                new Error(
                  `Resend API responded with ${res.statusCode}: ${data}`,
                ),
              );
            }
          });
        },
      );

      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function buildResetEmailHtml(firstName: string, resetUrl: string): string {
  const safeFirstName = firstName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeUrl = resetUrl.replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your HAZA AIOS password</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Inter',sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1d27;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;background:linear-gradient(135deg,#1a1d27 0%,#1e2235 100%);border-bottom:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:13px;letter-spacing:0.08em;color:#94a3b8;text-transform:uppercase;font-weight:600;">HAZA AIOS</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#f8fafc;">Password Reset</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#cbd5e1;">
                Hi ${safeFirstName},
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#94a3b8;">
                We received a request to reset the password for your HAZA AIOS account. Click the button below to choose a new password. This link expires in <strong style="color:#e2e8f0;">1 hour</strong>.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:linear-gradient(135deg,#ef4444,#dc2626);">
                    <a href="${safeUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:0.01em;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                Or copy and paste this URL into your browser:<br />
                <a href="${safeUrl}" style="color:#94a3b8;word-break:break-all;">${safeUrl}</a>
              </p>
              <p style="margin:24px 0 0;font-size:13px;color:#64748b;">
                If you did not request a password reset, you can safely ignore this email. Your password will not change.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:#475569;">
                &copy; ${new Date().getFullYear()} HAZA AIOS. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildResetEmailText(firstName: string, resetUrl: string): string {
  return [
    `Hi ${firstName},`,
    "",
    "We received a request to reset the password for your HAZA AIOS account.",
    "Click the link below to choose a new password. This link expires in 1 hour.",
    "",
    resetUrl,
    "",
    "If you did not request a password reset, you can safely ignore this email.",
    "Your password will not change.",
    "",
    "— HAZA AIOS",
  ].join("\n");
}
