export const SCHOOL_COORDS = {
    KNUST: { lat: 6.6732, lng: -1.5654 },
    ATU: { lat: 5.5504, lng: -0.2174 },
    UHAS: { lat: 6.6008, lng: 0.4713 },
    UCC: { lat: 5.1153, lng: -1.2903 },
    UDS: { lat: 9.3730, lng: -0.8850 },
    UEW: { lat: 5.3621, lng: -0.6339 },
    UPSA: { lat: 5.6614, lng: -0.1664 },
    PentUni: { lat: 5.6262, lng: -0.2742 },
    KsTU: { lat: 6.6911, lng: -1.6100 },
    CU: { lat: 5.5663, lng: -0.2410 },
};

export const MAX_DELIVERY_FEE = 40;
const ON_CAMPUS_MAX_KM = 2;
const NEAR_CAMPUS_MAX_KM = 8;

export function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function clampFee(value) {
    const n = parseFloat(value);
    if (isNaN(n) || n < 0) return 0;
    return Math.min(n, MAX_DELIVERY_FEE);
}

export function getDistanceTier(buyerLat, buyerLng, sellerSchool) {
    const coords = SCHOOL_COORDS[sellerSchool];
    if (!coords || buyerLat == null || buyerLng == null) {
        return { tier: 'far_campus', distanceKm: null };
    }
    const km = haversineKm(buyerLat, buyerLng, coords.lat, coords.lng);
    if (km <= ON_CAMPUS_MAX_KM) return { tier: 'on_campus', distanceKm: km };
    if (km <= NEAR_CAMPUS_MAX_KM) return { tier: 'near_campus', distanceKm: km };
    return { tier: 'far_campus', distanceKm: km };
}

/**
 * @param {number} buyerLat
 * @param {number} buyerLng
 * @param {string} sellerSchool
 * @param {{ delivery_fee_on_campus:number, delivery_fee_near_campus:number, delivery_fee_far_campus:number }} sellerDeliveryPrices
 */
export function calcDeliveryFee(buyerLat, buyerLng, sellerSchool, sellerDeliveryPrices = {}) {
    const { tier, distanceKm } = getDistanceTier(buyerLat, buyerLng, sellerSchool);

    const priceMap = {
        on_campus: clampFee(sellerDeliveryPrices.delivery_fee_on_campus),
        near_campus: clampFee(sellerDeliveryPrices.delivery_fee_near_campus),
        far_campus: clampFee(sellerDeliveryPrices.delivery_fee_far_campus),
    };

    return { fee: priceMap[tier], tier, distanceKm };
}