// Parses "Tre-X <samavih45@gmail.com>" into { name, email }
// Falls back gracefully if EMAIL_FROM is just a plain address.
function parseFromAddress(raw) {
    const match = raw && raw.match(/^(.*)<(.+)>$/);
    if (match) {
        return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
    }
    return { name: 'Tre-X', email: raw };
}

async function sendBrevoEmail({ to, subject, html }) {
    const sender = parseFromAddress(process.env.EMAIL_FROM);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            sender,
            to: [{ email: to }],
            subject,
            htmlContent: html,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Brevo email API error:', err);
        throw new Error(err.message || 'Failed to send email');
    }
}

async function sendVerificationEmail(toEmail, code) {
    await sendBrevoEmail({
        to: toEmail,
        subject: 'Your Tre-X verification code',
        html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
                <h2 style="color:#1e293b;">Verify your Tre-X account</h2>
                <p style="color:#475569;">Enter this code to verify your account:</p>
                <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color:#4f46e5;">${code}</p>
                <p style="color:#94a3b8; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
            </div>
        `,
    });
}

async function sendPasswordResetEmail(toEmail, code) {
    await sendBrevoEmail({
        to: toEmail,
        subject: 'Your Tre-X password reset code',
        html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
                <h2 style="color:#1e293b;">Reset your Tre-X password</h2>
                <p style="color:#475569;">Enter this code to change your password:</p>
                <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color:#4f46e5;">${code}</p>
                <p style="color:#94a3b8; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
            </div>
        `,
    });
}

async function sendOrderSMS(phoneNumber, message) {
    try {
        const digits = String(phoneNumber).replace(/\D/g, '');
        const normalized = digits.startsWith('0') ? '233' + digits.slice(1) : digits;

        const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sender: 'Tre-X',
                recipient: normalized,
                content: message,
                type: 'transactional',
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            // Log the error but DO NOT throw it. This stops the crash.
            console.warn('Brevo SMS skipped (Addon required):', err.message || 'Unknown SMS error');
            return; 
        }
    } catch (err) {
        // Catch any network errors and just log them instead of crashing the server
        console.warn('Failed to send SMS (network error):', err.message);
    }
}

async function sendSupportReplyEmail(toEmail, userMessage, reply) {
    await sendBrevoEmail({
        to: toEmail,
        subject: 'Reply from Tre-X Support',
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color:#1e293b;">We replied to your message</h2>
                <p style="color:#475569; font-size:13px;">You wrote:</p>
                <p style="color:#64748b; font-size:14px; background:#f8fafc; border-radius:8px; padding:12px;">${userMessage}</p>
                <p style="color:#475569; font-size:13px; margin-top:20px;">Our reply:</p>
                <p style="color:#1e293b; font-size:14px; background:#eef2ff; border-radius:8px; padding:12px;">${reply}</p>
                <p style="color:#94a3b8; font-size:12px; margin-top:20px;">If you have more questions, just message us again in the app.</p>
            </div>
        `,
    });
}

module.exports = { sendVerificationEmail, sendOrderSMS, sendPasswordResetEmail, sendSupportReplyEmail };