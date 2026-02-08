import nodemailer from 'nodemailer';
import { prisma } from './db.js';

// Email configuration - defaults to console logging in development
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'SAGA <noreply@saga.se>';

// Create transporter (or null if not configured)
let transporter: nodemailer.Transporter | null = null;

if (SMTP_HOST && SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  // Verify connection
  transporter.verify((error) => {
    if (error) {
      console.error('[Email] Failed to connect to SMTP server:', error);
      transporter = null;
    } else {
      console.log('[Email] SMTP server connected successfully');
    }
  });
} else {
  console.log('[Email] SMTP not configured - emails will be logged to console');
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send an email
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, text, html } = options;

  if (!transporter) {
    // Log to console in development
    console.log('[Email] Would send email:');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body: ${text}`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html: html || text,
    });
    console.log(`[Email] Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}:`, error);
    return false;
  }
}

/**
 * Send notification emails for pending notifications
 */
export async function sendPendingNotificationEmails() {
  // Find notifications that haven't been emailed yet
  const pendingNotifications = await prisma.notification.findMany({
    where: {
      emailSent: false,
    },
    include: {
      user: true,
    },
  });

  if (pendingNotifications.length === 0) {
    return;
  }

  console.log(`[Email] Processing ${pendingNotifications.length} pending notification emails`);

  for (const notification of pendingNotifications) {
    // Check user preferences
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: notification.userId },
    });

    // Skip if email is disabled
    if (prefs && !prefs.emailEnabled) {
      // Mark as sent (skipped)
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true, emailSentAt: new Date() },
      });
      continue;
    }

    // Check specific notification type preferences
    let shouldSend = true;
    if (prefs) {
      switch (notification.type) {
        case 'DEADLINE_REMINDER':
          shouldSend = prefs.deadlineReminders;
          break;
        case 'UNSIGNED_ASSESSMENT':
          shouldSend = prefs.unsignedAssessments;
          break;
        case 'SUPERVISION_REMINDER':
          shouldSend = prefs.supervisionReminders;
          break;
        case 'SUBGOAL_SIGNED':
          shouldSend = prefs.subGoalSigned;
          break;
        case 'ASSESSMENT_SIGNED':
          shouldSend = prefs.assessmentSigned;
          break;
      }
    }

    if (!shouldSend) {
      // Mark as sent (skipped due to preferences)
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true, emailSentAt: new Date() },
      });
      continue;
    }

    // Send the email
    const success = await sendEmail({
      to: notification.user.email,
      subject: `SAGA: ${notification.title}`,
      text: notification.message,
      html: generateNotificationEmailHtml(notification.title, notification.message, notification.link),
    });

    // Update notification status
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        emailSent: true,
        emailSentAt: success ? new Date() : null,
      },
    });
  }
}

/**
 * Generate HTML email template
 */
function generateNotificationEmailHtml(title: string, message: string, link?: string | null): string {
  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  const fullLink = link ? `${baseUrl}${link}` : baseUrl;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 24px;
      margin: 20px 0;
    }
    .header {
      text-align: center;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
      margin-bottom: 16px;
    }
    .logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background-color: #2563eb;
      border-radius: 12px;
      color: white;
      font-size: 24px;
      font-weight: bold;
    }
    h1 {
      color: #111;
      font-size: 20px;
      margin: 16px 0 8px;
    }
    p {
      color: #555;
      margin: 8px 0;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      margin: 16px 0;
    }
    .button:hover {
      background-color: #1d4ed8;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #888;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">S</div>
        <h1>${title}</h1>
      </div>
      <p>${message}</p>
      ${link ? `
      <div style="text-align: center;">
        <a href="${fullLink}" class="button">Visa i SAGA</a>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <p>Detta e-postmeddelande skickades från SAGA - ST/BT Planerings- och Dokumentationssystem</p>
      <p>Du kan hantera dina e-postinställningar under Inställningar i SAGA.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Start email scheduler
 */
export function startEmailScheduler(intervalMinutes = 5) {
  // Send pending emails on startup
  sendPendingNotificationEmails();

  // Then run periodically
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(sendPendingNotificationEmails, intervalMs);

  console.log(`[Email] Scheduler started, checking every ${intervalMinutes} minutes`);
}
