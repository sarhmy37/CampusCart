// A plan counts as "active" only if it's not free AND hasn't expired.
// This is the single source of truth for plan-gated features (fees,
// search priority, badges, etc) — always check through this function
// rather than reading user.plan directly, so expiry is never missed.
function isPlanActive(plan, planExpiresAt) {
    if (!plan || plan === 'free') return false;
    if (!planExpiresAt) return false;
    return new Date(planExpiresAt) > new Date();
}

// Seller platform fee rate: 0% while on an active paid plan, 1.5% otherwise.
function getSellerFeeRate(plan, planExpiresAt) {
    return isPlanActive(plan, planExpiresAt) ? 0 : 0.015;
}

module.exports = { isPlanActive, getSellerFeeRate };