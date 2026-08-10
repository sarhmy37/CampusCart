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

module.exports = { sendVerificationEmail };