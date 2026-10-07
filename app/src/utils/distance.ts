export const SCHOOL_COORDS: Record<string, { lat: number; lng: number }> = {
  KNUST: { lat: 6.6732, lng: -1.5654 },
  ATU: { lat: 5.554028, lng: -0.205556 },
  UHAS: { lat: 6.6008, lng: 0.4713 },
  UCC: { lat: 5.1153, lng: -1.2903 },
  UDS: { lat: 9.393273, lng: -0.823513 },
  UEW: { lat: 5.35, lng: -0.625 },
  UPSA: { lat: 5.6614, lng: -0.1664 },
  PentUni: { lat: 5.6262, lng: -0.2742 },
  KsTU: { lat: 6.6911, lng: -1.61 },
  CU: { lat: 5.5663, lng: -0.241 },
  UG: { lat: 5.65083, lng: -0.18694 },
  UMaT: { lat: 5.3005, lng: -1.99 },
};

export const MAX_DELIVERY_FEE = 50;

export const SCHOOL_ON_CAMPUS_RADIUS_KM: Record<string, number> = {
  KNUST: 2.25,
  ATU: 0.20,
  UHAS: 2.65,
  UCC: 1.00,
  UDS: 0.50,
  UEW: 1.40,
  UPSA: 0.20,
  PentUni: 0.45,
  KsTU: 0.20,
  CU: 0.70,
  UG: 2.55,
  UMaT: 0.83,
};
const DEFAULT_ON_CAMPUS_MAX_KM = 2;
const NEAR_CAMPUS_MAX_KM = 8;

export function getOnCampusRadius(sellerSchool: string) {
  return SCHOOL_ON_CAMPUS_RADIUS_KM[sellerSchool] ?? DEFAULT_ON_CAMPUS_MAX_KM;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function clampFee(value: any) {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) return 0;
  return Math.min(n, MAX_DELIVERY_FEE);
}

export function getDistanceTier(buyerLat: number | null, buyerLng: number | null, sellerSchool: string) {
  const coords = SCHOOL_COORDS[sellerSchool];
  if (!coords || buyerLat == null || buyerLng == null) {
    return { tier: 'far_campus' as const, distanceKm: null };
  }
  const km = haversineKm(buyerLat, buyerLng, coords.lat, coords.lng);
  const onCampusMaxKm = getOnCampusRadius(sellerSchool);
  if (km <= onCampusMaxKm) return { tier: 'on_campus' as const, distanceKm: km };
  if (km <= NEAR_CAMPUS_MAX_KM) return { tier: 'near_campus' as const, distanceKm: km };
  return { tier: 'far_campus' as const, distanceKm: km };
}

export function calcDeliveryFee(
  buyerLat: number,
  buyerLng: number,
  sellerSchool: string,
  sellerDeliveryPrices: {
    delivery_fee_on_campus?: number;
    delivery_fee_near_campus?: number;
    delivery_fee_far_campus?: number;
  } = {}
) {
  const { tier, distanceKm } = getDistanceTier(buyerLat, buyerLng, sellerSchool);

  const priceMap = {
    on_campus: clampFee(sellerDeliveryPrices.delivery_fee_on_campus),
    near_campus: clampFee(sellerDeliveryPrices.delivery_fee_near_campus),
    far_campus: clampFee(sellerDeliveryPrices.delivery_fee_far_campus),
  };

  return { fee: priceMap[tier], tier, distanceKm };
}