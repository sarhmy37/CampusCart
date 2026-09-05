export const SCHOOL_COORDS = {
    KNUST: { lat: 6.6732, lng: -1.5654 },
    ATU: { lat: 5.554028, lng: -0.205556 },   // corrected via Wikipedia (was 5.5504, -0.2174)
    UHAS: { lat: 6.6008, lng: 0.4713 },
    UCC: { lat: 5.1153, lng: -1.2903 },
    UDS: { lat: 9.393273, lng: -0.823513 },   // corrected via Tamale Teaching Hospital (was 9.3730, -0.8850)
    UEW: { lat: 5.35000, lng: -0.62500 },     // corrected via Winneba town center (was 5.3621, -0.6339)
    UPSA: { lat: 5.6614, lng: -0.1664 },
    PentUni: { lat: 5.6262, lng: -0.2742 },
    KsTU: { lat: 6.6911, lng: -1.6100 },
    CU: { lat: 5.5663, lng: -0.2410 },
    UG: { lat: 5.65083, lng: -0.18694 },      // added — University of Ghana, Legon
    UMaT: { lat: 5.3005, lng: -1.9900 },      // added — University of Mines and Technology, Tarkwa
};

export const MAX_DELIVERY_FEE = 40;

// Distance boundaries (km from campus)
// Each school has its own "on campus" radius, since campus sizes vary a lot
// (this should be roughly HALF of that school's longest straight-line span
// across the campus — e.g. KNUST's ~4.51km diagonal gives ~2.25km here).
// Values below were derived from each school's published campus area/span.
// Schools not listed fall back to DEFAULT_ON_CAMPUS_MAX_KM.
export const SCHOOL_ON_CAMPUS_RADIUS_KM = {
    KNUST: 2.25,
    ATU: 0.20,
    UHAS: 2.65,
    UCC: 1.00,
    UDS: 0.50,
    UEW: 1.40,
    UPSA: 0.20,   // estimated — no published campus area, matched to similar compact-urban profile
    PentUni: 0.45,
    KsTU: 0.20,   // estimated — no published campus area, matched to similar compact-urban profile
    CU: 0.70,
    UG: 2.55,
    UMaT: 0.83,
};
const DEFAULT_ON_CAMPUS_MAX_KM = 2;
const NEAR_CAMPUS_MAX_KM = 8; // "on campus" boundary → 8km = "near/just outside campus", >8km = "far"

export function getOnCampusRadius(sellerSchool) {
    return SCHOOL_ON_CAMPUS_RADIUS_KM[sellerSchool] ?? DEFAULT_ON_CAMPUS_MAX_KM;
}

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
    const onCampusMaxKm = getOnCampusRadius(sellerSchool);
    if (km <= onCampusMaxKm) return { tier: 'on_campus', distanceKm: km };
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