// src/config/email.js
const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendEmail({ to, subject, html, text, attachments = [] }) {
  if (!process.env.SMTP_USER) {
    logger.warn('Email not configured - skipping send');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
      attachments,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`Email send error to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

function getEmailTemplate(type, data) {
  const templates = {
    welcome: {
      subject: `Welcome to ${process.env.APP_NAME}`,
      html: `
        <h2>Welcome, ${data.firstName}!</h2>
        <p>Your ITSM account has been created successfully.</p>
        <p>Please verify your email using the link below:</p>
        <a href="${process.env.APP_URL}/verify-email?token=${data.token}" 
           style="padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:4px">
          Verify Email
        </a>
        <p>This link expires in 24 hours.</p>
      `,
    },
    passwordReset: {
      subject: 'Password Reset Request',
      html: `
        <h2>Reset Your Password</h2>
        <p>Hi ${data.firstName},</p>
        <p>Click the link below to reset your password:</p>
        <a href="${process.env.APP_URL}/reset-password?token=${data.token}"
           style="padding:10px 20px;background:#dc2626;color:white;text-decoration:none;border-radius:4px">
          Reset Password
        </a>
        <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      `,
    },
    ticketCreated: {
      subject: `Ticket #${data.ticketNumber} Created`,
      html: `
        <h2>Ticket Created Successfully</h2>
        <p>Hi ${data.firstName},</p>
        <p>Your ticket has been created:</p>
        <ul>
          <li><strong>Ticket #:</strong> ${data.ticketNumber}</li>
          <li><strong>Title:</strong> ${data.title}</li>
          <li><strong>Priority:</strong> ${data.priority}</li>
          <li><strong>Status:</strong> ${data.status}</li>
        </ul>
        <a href="${process.env.APP_URL}/tickets/${data.ticketId}"
           style="padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:4px">
          View Ticket
        </a>
      `,
    },
    ticketAssigned: {
      subject: `Ticket #${data.ticketNumber} Assigned to You`,
      html: `
        <h2>New Ticket Assigned</h2>
        <p>Hi ${data.firstName},</p>
        <p>A ticket has been assigned to you:</p>
        <ul>
          <li><strong>Ticket #:</strong> ${data.ticketNumber}</li>
          <li><strong>Title:</strong> ${data.title}</li>
          <li><strong>Priority:</strong> ${data.priority}</li>
          <li><strong>SLA Due:</strong> ${data.slaDue}</li>
        </ul>
        <a href="${process.env.APP_URL}/tickets/${data.ticketId}"
           style="padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:4px">
          View Ticket
        </a>
      `,
    },
    slaWarning: {
      subject: `⚠️ SLA Warning - Ticket #${data.ticketNumber}`,
      html: `
        <h2>⚠️ SLA Warning</h2>
        <p>Ticket #${data.ticketNumber} is approaching SLA breach:</p>
        <ul>
          <li><strong>Title:</strong> ${data.title}</li>
          <li><strong>Priority:</strong> ${data.priority}</li>
          <li><strong>Due:</strong> ${data.slaDue}</li>
          <li><strong>Time Remaining:</strong> ${data.timeRemaining}</li>
        </ul>
      `,
    },
  };

  return templates[type] || { subject: 'ITSM Notification', html: `<p>${data.message || ''}</p>` };
}

module.exports = { sendEmail, getEmailTemplate };
