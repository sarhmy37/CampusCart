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

export function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function feeForDistance(km) {
    if (km <= 0.5) return 0;      // on campus — free
    if (km <= 2) return 15;
    if (km <= 5) return 25;
    return 35;
}

// Returns { fee, distanceKm } for a single seller's school vs buyer coords
export function calcDeliveryFee(buyerLat, buyerLng, sellerSchool) {
    const coords = SCHOOL_COORDS[sellerSchool];
    if (!coords) return { fee: 15, distanceKm: null }; // unknown school — fallback flat fee
    const km = haversineKm(buyerLat, buyerLng, coords.lat, coords.lng);
    return { fee: feeForDistance(km), distanceKm: km };
}