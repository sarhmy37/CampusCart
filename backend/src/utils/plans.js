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

const LISTING_LIMITS = {
    free: 10,
    pro: 30,
    premium: Infinity,
};

function getListingLimit(plan, planExpiresAt) {
    if (isPlanActive(plan, planExpiresAt)) {
        return LISTING_LIMITS[plan] ?? LISTING_LIMITS.free;
    }
    return LISTING_LIMITS.free;
}

const DELIVERY_DISCOUNT_RATES = {
    pro: 0.10,
    premium: 0.18,
};

// Buyer-side delivery discount. Capped intentionally below 20% — sellers
// keep a fixed 80% of the FULL (undiscounted) delivery fee, so any discount
// above 20% would make the platform lose money on that order's delivery leg.
function getDeliveryDiscountRate(plan, planExpiresAt) {
    if (!isPlanActive(plan, planExpiresAt)) return 0;
    return DELIVERY_DISCOUNT_RATES[plan] ?? 0;
}

module.exports = { isPlanActive, getSellerFeeRate, getListingLimit, getDeliveryDiscountRate };