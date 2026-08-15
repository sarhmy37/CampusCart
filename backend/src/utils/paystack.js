const crypto = require('crypto');

const PAYSTACK_BASE = 'https://api.paystack.co';
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

async function paystackRequest(pathname, options = {}) {
    const res = await fetch(`${PAYSTACK_BASE}${pathname}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${SECRET_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    const data = await res.json();
    if (!res.ok || data.status === false) {
        throw new Error(data.message || 'Paystack request failed');
    }
    return data;
}

function initializeTransaction({ email, amountGHS, reference, callback_url, metadata }) {
    return paystackRequest('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
            email,
            amount: Math.round(amountGHS * 100),
            currency: 'GHS',
            reference,
            callback_url,
            metadata,
        }),
    });
}

function verifyWebhookSignature(rawBody, signatureHeader) {
    const hash = crypto.createHmac('sha512', SECRET_KEY).update(rawBody).digest('hex');
    return hash === signatureHeader;
}

function createTransferRecipient({ type, name, account_number, bank_code }) {
    return paystackRequest('/transferrecipient', {
        method: 'POST',
        body: JSON.stringify({
            type: type === 'mobile_money' ? 'mobile_money' : 'ghipss',
            name,
            account_number,
            bank_code,
            currency: 'GHS',
        }),
    });
}

function initiateTransfer({ recipient_code, amountGHS, reason, reference }) {
    return paystackRequest('/transfer', {
        method: 'POST',
        body: JSON.stringify({
            source: 'balance',
            amount: Math.round(amountGHS * 100),
            recipient: recipient_code,
            reason,
            reference,
        }),
    });
}

module.exports = {
    paystackRequest,
    initializeTransaction,
    verifyWebhookSignature,
    createTransferRecipient,
    initiateTransfer,
};