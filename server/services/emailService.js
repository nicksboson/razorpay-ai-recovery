const nodemailer = require('nodemailer');

let transporter = null;

async function initEmailService() {
  if (transporter) return;
  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log('✉️  Real Email Service Initialized (Gmail SMTP)');
      return;
    }

    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('✉️  Test Email Service Initialized (Ethereal Sandbox)');
  } catch (error) {
    console.error('Failed to initialize email service:', error.message);
  }
}

// 1. Email sent to the CUSTOMER (e.g. Card Expired)
async function sendReminderEmail(transaction) {
  if (!transporter) await initEmailService();
  if (!transporter) return;

  const amountStr = transaction.amount.toLocaleString('en-IN');
  const reasonStr = transaction.failure_reason.replace(/_/g, ' ').toUpperCase();

  const mailOptions = {
    from: '"Razorpay Recovery" <recovery@razorpay.test>',
    to: transaction.customer_email,
    subject: `Action Required: Payment Failed at ${transaction.merchant}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #111827; margin: 0; font-size: 24px;">Payment Failed</h2>
          <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Transaction ID: ${transaction._id}</p>
        </div>
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; color: #374151; font-size: 15px;">Hi there,</p>
          <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.5;">
            Your recent payment of <strong>₹${amountStr}</strong> at <strong>${transaction.merchant}</strong> could not be processed.
          </p>
        </div>
        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Failure Reason</p>
          <p style="margin: 0; color: #ef4444; font-weight: 600; font-size: 15px;">${reasonStr}</p>
        </div>
        <p style="color: #4b5563; font-size: 14px; margin-bottom: 24px; line-height: 1.5;">
          Please update your payment method or retry the transaction to ensure your service is not interrupted.
        </p>
        <div style="text-align: center;">
          <a href="http://localhost:5173" style="display: inline-block; background-color: #2563EB; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
            Retry Payment Now
          </a>
        </div>
      </div>
    `
  };

  await dispatchMail(mailOptions, 'Customer Reminder');
}

// 2. Email sent to the INTERNAL SUPPORT TEAM (e.g. Fraud Suspected)
async function sendEscalationEmail(transaction, aiReasoning) {
  if (!transporter) await initEmailService();
  if (!transporter) return;

  const amountStr = transaction.amount.toLocaleString('en-IN');
  const reasonStr = transaction.failure_reason.replace(/_/g, ' ').toUpperCase();
  
  // We send this to YOUR email address (from .env) to simulate an internal team alert
  const supportEmail = process.env.SMTP_USER || 'support@razorpay.test';

  const mailOptions = {
    from: '"Razorpay AI Agent" <ai-agent@razorpay.test>',
    to: supportEmail,
    subject: `🚨 URGENT: Human Escalation Required (₹${amountStr})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #fca5a5; border-radius: 12px; background-color: #fef2f2;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #991b1b; margin: 0; font-size: 24px;">🚨 Human Escalation Required</h2>
          <p style="color: #b91c1c; font-size: 14px; margin-top: 4px;">Transaction ID: ${transaction._id}</p>
        </div>
        <div style="background-color: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; color: #374151; font-size: 15px;"><strong>Customer:</strong> ${transaction.customer_email}</p>
          <p style="margin: 0 0 8px 0; color: #374151; font-size: 15px;"><strong>Amount:</strong> ₹${amountStr}</p>
          <p style="margin: 0 0 8px 0; color: #374151; font-size: 15px;"><strong>Merchant:</strong> ${transaction.merchant}</p>
          <p style="margin: 0; color: #ef4444; font-size: 15px; font-weight: 600;">System Flag: ${reasonStr}</p>
        </div>
        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 4px 0; color: #7f1d1d; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">AI Agent Reasoning</p>
          <p style="margin: 0; color: #991b1b; font-size: 15px; font-style: italic;">"${aiReasoning}"</p>
        </div>
        <div style="text-align: center;">
          <a href="http://localhost:5173" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
            Review Case in Dashboard
          </a>
        </div>
      </div>
    `
  };

  await dispatchMail(mailOptions, 'Internal Escalation Alert');
}

async function dispatchMail(mailOptions, type) {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`\n📧 [${type}] dispatched to: ${mailOptions.to}`);
    
    const testUrl = nodemailer.getTestMessageUrl(info);
    if (testUrl) {
      console.log(`🔗 VIEW LIVE EMAIL: ${testUrl}\n`);
    } else {
      console.log(`✅ Real email successfully delivered via Gmail!\n`);
    }
  } catch (error) {
    console.error(`Error sending ${type} email:`, error.message);
  }
}

module.exports = { sendReminderEmail, sendEscalationEmail };
