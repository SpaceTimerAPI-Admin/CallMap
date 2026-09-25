import nodemailer from 'nodemailer';
import twilio from 'twilio';

const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const sms = process.env.TWILIO_ACCOUNT_SID ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

export const smsEnabled = !!sms;

export async function sendEmail(to, subject, text) {
  if (!mailer) { console.log(`[email not configured] to=${to} subject="${subject}"\n${text}`); return false; }
  await mailer.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
  return true;
}

export async function sendSms(to, body) {
  if (!sms) { console.log(`[sms not configured] to=${to} ${body}`); return false; }
  await sms.messages.create({ from: process.env.TWILIO_FROM, to, body });
  return true;
}
