// Central place for all static site imagery/video, served from the backend's
// /media folder (which maps to backend/public/ in server.js).
// Change MEDIA_BASE_URL if your backend URL differs (e.g. in production).
export const MEDIA_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

export function mediaUrl(filename) {
    return `${MEDIA_BASE_URL}/media/${filename}`;
}

// ----- IMAGES -----
export const HERO_IMAGES = [
    'knust-hero.jpg',
    'IMG_8639 2.jpg',
    'ATU.jpg',
    'UHAS.jpg',
    'UCC.jpg',
    'UDS.jpg',
    'UMAT.jpg',
    'UOE.jpg',
    'UPSA.jpg',
    'PentUNI.jpg',
    'KsTU.png',
    'CU.jpg',
].map(mediaUrl);

export const BROWSE_HEADER_IMAGES = [
    'IMG_8639 2.jpg',
    'knust-hero.jpg',
    'ATU.jpg',
    'UHAS.jpg',
    'UCC.jpg',
    'UDS.jpg',
    'UOE.jpg',
    'UPSA.jpg',
    'PentUNI.jpg',
    'KsTU.png',
    'CU.jpg',
    'UMAT.jpg',
].map(mediaUrl);

export const GALLERY = [
    {
        label: 'Sneakers in all sizes',
        images: ['Shoe.jpg', 'Shoe2.jpg', 'Shoe3.jpg', 'Shoe4.jpg'].map(mediaUrl),
        video: mediaUrl('Sneakers.mp4'),
    },
    {
        label: 'Meet up on campus',
        images: ['MeetOnCampus.jpg', 'MeetOnCampus2.jpg', 'MeetOnCampus3.jpg'].map(mediaUrl),
        video: mediaUrl('Meeting.mp4'),
    },
    {
        label: 'Gadgets, gently used',
        images: ['Gadget.jpg', 'Gadget2.jpg', 'Gadget3.jpg', 'Gadget4.jpg'].map(mediaUrl),
        video: mediaUrl('Gadjet.mp4'),
    },
    {
        label: 'Food',
        images: ['Waakye.jpg', 'Waakye2.jpg', 'Waakye3.jpg'].map(mediaUrl),
        video: mediaUrl('Foodie.mp4'),
    },
];

export const LOGIN_IMAGE = mediaUrl('login.jpg');
export const REGISTER_IMAGE = mediaUrl('register.jpg');

// Additional images used elsewhere
export const SNEAKERS_2 = mediaUrl('Sneakers2.jpg');
export const SNEAKERS_4 = mediaUrl('Sneakers4.jpg');
export const MEET_ME = mediaUrl('meetme.jpg');
export const FO00D = mediaUrl('foood.jpg');
export const FAVICON = mediaUrl('favicon.svg');
export const ICONS = mediaUrl('icons.svg');

// ----- VIDEOS -----
export const CART_VIDEO = mediaUrl('Cart.mp4');
export const DASHBOARD_VIDEO = mediaUrl('Dashboard.mp4');
export const CREATE_LISTING_VIDEO = mediaUrl('create-listing-bg.mp4');
export const FOODIE_VIDEO = mediaUrl('Foodie.mp4');
export const GADJET_VIDEO = mediaUrl('Gadjet.mp4');
export const MEETING_VIDEO = mediaUrl('Meeting.mp4');
export const SETTINGS_VIDEO = mediaUrl('Settings.mp4');
export const SNEAKERS_VIDEO = mediaUrl('Sneakers.mp4');

// All assets for preloading
export const PRELOAD_ASSETS = [
    ...HERO_IMAGES,
    ...GALLERY.flatMap((g) => g.images),
    LOGIN_IMAGE,
    REGISTER_IMAGE,
    SNEAKERS_2,
    SNEAKERS_4,
    MEET_ME,
    FO00D,
    CART_VIDEO,
    DASHBOARD_VIDEO,
    CREATE_LISTING_VIDEO,
    FOODIE_VIDEO,
    GADJET_VIDEO,
    MEETING_VIDEO,
    SETTINGS_VIDEO,
    SNEAKERS_VIDEO,
];