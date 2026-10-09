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
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === false) {
        const err = new Error(data.message || 'Paystack request failed');
        err.status = res.status;
        throw err;
    }
    return data;
}

function initializeTransaction({ email, amountGHS, reference, callback_url, cancel_action, metadata }) {
    return paystackRequest('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
            email,
            amount: Math.round(amountGHS * 100),
            currency: 'GHS',
            reference,
            callback_url,
            cancel_action,
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

function chargeAuthorization({ email, amountGHS, authorization_code, reference, metadata }) {
    return paystackRequest('/transaction/charge_authorization', {
        method: 'POST',
        body: JSON.stringify({
            email,
            amount: Math.round(amountGHS * 100),
            authorization_code,
            reference,
            currency: 'GHS',
            metadata,
        }),
    });
}

async function refundTransaction(reference, amountGHS) {
    const body = { transaction: reference };
    if (amountGHS) body.amount = Math.round(amountGHS * 100);
    const res = await fetch('https://api.paystack.co/refund', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.status) throw new Error(data.message || 'Paystack refund failed');
    return data;
}

const PAYSTACK_MOMO_CODES = { MTN: 'MTN', VOD: 'VOD', AT: 'ATL' };

function toPaystackBankCode(code) {
    return PAYSTACK_MOMO_CODES[code] || code;
}

async function resolvePayoutName(bank_code, account_number) {
    const code = toPaystackBankCode(bank_code);
    const data = await paystackRequest(
        `/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(code)}`
    );
    const name = data?.data?.account_name;
    if (!name) throw new Error('No name found');
    return name.toUpperCase();
}

module.exports = {
    paystackRequest,
    initializeTransaction,
    verifyWebhookSignature,
    createTransferRecipient,
    initiateTransfer,
    chargeAuthorization,
    refundTransaction,
    resolvePayoutName,
    toPaystackBankCode,
};