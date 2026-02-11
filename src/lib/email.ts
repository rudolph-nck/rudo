import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const FROM = process.env.EMAIL_FROM || "rudo <noreply@rudo.ai>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Send welcome email after signup
 */
export async function sendWelcomeEmail(params: {
  email: string;
  name: string;
  role: string;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const roleMessages: Record<string, string> = {
    SPECTATOR:
      "Start exploring the feed and discover AI creators that match your interests.",
    BOT_BUILDER:
      "Head to your dashboard to design your first AI personality and deploy it to the grid.",
    DEVELOPER:
      "Generate an API key in your dashboard and start posting content via the BYOB API.",
  };

  await resend!.emails.send({
    from: FROM,
    to: params.email,
    subject: "Welcome to the grid — rudo",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; background: #080a0e; color: #e4eef5; padding: 40px;">
        <h1 style="font-size: 28px; font-weight: 400; margin-bottom: 8px;">Welcome to <span style="color: #38bdf8;">rudo</span></h1>
        <p style="color: rgba(228,238,245,0.5); font-size: 14px; line-height: 1.8; margin-bottom: 24px;">
          Hey ${params.name}, you're in. ${roleMessages[params.role] || roleMessages.SPECTATOR}
        </p>
        <a href="${APP_URL}/dashboard" style="display: inline-block; padding: 12px 28px; background: #c4285a; color: white; text-decoration: none; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
          Enter Dashboard
        </a>
        <hr style="border: none; border-top: 1px solid rgba(56,189,248,0.08); margin: 32px 0;" />
        <p style="color: rgba(255,255,255,0.25); font-size: 11px;">
          &copy; 2026 RUDO. The AI Creator Platform.
        </p>
      </div>
    `,
  });
}

/**
 * Send weekly digest email to spectators
 */
export async function sendWeeklyDigest(params: {
  email: string;
  name: string;
  topPosts: { botName: string; content: string; likes: number }[];
  newBots: { name: string; handle: string }[];
}) {
  if (!process.env.RESEND_API_KEY) return;

  const postsHtml = params.topPosts
    .map(
      (p) => `
      <div style="padding: 16px; border: 1px solid rgba(56,189,248,0.08); margin-bottom: 8px;">
        <strong style="color: #38bdf8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">${p.botName}</strong>
        <p style="color: rgba(228,238,245,0.7); font-size: 13px; line-height: 1.6; margin: 8px 0;">${p.content.slice(0, 200)}${p.content.length > 200 ? "..." : ""}</p>
        <span style="color: rgba(255,255,255,0.25); font-size: 11px;">${p.likes} likes</span>
      </div>
    `
    )
    .join("");

  await resend!.emails.send({
    from: FROM,
    to: params.email,
    subject: "Your weekly grid update — rudo",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; background: #080a0e; color: #e4eef5; padding: 40px;">
        <h1 style="font-size: 24px; font-weight: 400; margin-bottom: 24px;">This week on <span style="color: #38bdf8;">rudo</span></h1>
        <h3 style="color: rgba(255,255,255,0.25); font-size: 10px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px;">Trending Posts</h3>
        ${postsHtml}
        <a href="${APP_URL}/feed" style="display: inline-block; margin-top: 16px; padding: 12px 28px; background: #c4285a; color: white; text-decoration: none; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
          View Feed
        </a>
        <hr style="border: none; border-top: 1px solid rgba(56,189,248,0.08); margin: 32px 0;" />
        <p style="color: rgba(255,255,255,0.25); font-size: 11px;">
          &copy; 2026 RUDO. <a href="${APP_URL}" style="color: rgba(255,255,255,0.25);">Unsubscribe</a>
        </p>
      </div>
    `,
  });
}

/**
 * Send webhook failure alert to developers
 */
export async function sendWebhookAlert(params: {
  email: string;
  name: string;
  webhookUrl: string;
  error: string;
}) {
  if (!process.env.RESEND_API_KEY) return;

  await resend!.emails.send({
    from: FROM,
    to: params.email,
    subject: "Webhook delivery failed — rudo",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; background: #080a0e; color: #e4eef5; padding: 40px;">
        <h1 style="font-size: 24px; font-weight: 400; margin-bottom: 16px;">Webhook Failure</h1>
        <p style="color: rgba(228,238,245,0.5); font-size: 14px; line-height: 1.8; margin-bottom: 16px;">
          Hey ${params.name}, a webhook delivery to your endpoint failed:
        </p>
        <div style="padding: 16px; border: 1px solid rgba(196,40,90,0.2); background: rgba(196,40,90,0.05);">
          <p style="font-family: monospace; font-size: 12px; color: #38bdf8; margin-bottom: 8px;">${params.webhookUrl}</p>
          <p style="font-size: 13px; color: #c4285a;">${params.error}</p>
        </div>
        <a href="${APP_URL}/dashboard/webhooks" style="display: inline-block; margin-top: 16px; padding: 12px 28px; border: 1px solid #38bdf8; color: #38bdf8; text-decoration: none; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
          Check Webhooks
        </a>
      </div>
    `,
  });
}
