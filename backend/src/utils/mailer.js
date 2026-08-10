const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST,
    port: Number(process.env.BREVO_SMTP_PORT),
    secure: false,
    auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY,
    },
});

async function sendVerificationEmail(toEmail, code) {
    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: toEmail,
        subject: 'Your CampusCart verification code',
        html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
                <h2 style="color:#1e293b;">Verify your CampusCart account</h2>
                <p style="color:#475569;">Enter this code to verify your account:</p>
                <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color:#4f46e5;">${code}</p>
                <p style="color:#94a3b8; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
            </div>
        `,
    });
}

async function sendPasswordResetEmail(toEmail, code) {
    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: toEmail,
        subject: 'Your CampusCart password reset code',
        html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
                <h2 style="color:#1e293b;">Reset your CampusCart password</h2>
                <p style="color:#475569;">Enter this code to change your password:</p>
                <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color:#4f46e5;">${code}</p>
                <p style="color:#94a3b8; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
            </div>
        `,
    });
}

async function sendOrderSMS(phoneNumber, message) {
    const digits = String(phoneNumber).replace(/\D/g, '');
    const normalized = digits.startsWith('0') ? '233' + digits.slice(1) : digits;

    const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            sender: 'CampusCart',
            recipient: normalized,
            content: message,
            type: 'transactional',
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Brevo SMS error:', err);
        throw new Error('Failed to send SMS');
    }
}

module.exports = { sendVerificationEmail, sendOrderSMS, sendPasswordResetEmail };