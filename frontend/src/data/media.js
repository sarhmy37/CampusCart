// Central place for all static site imagery/video, now served from Cloudinary.
// Change CLOUD_NAME if you use a different Cloudinary account.
const CLOUD_NAME = 'b7fch4rp';

// Helper to generate Cloudinary Image URLs
function cloudinaryImage(filename) {
    // No cache-busting param — letting the URL stay stable lets the browser
    // actually cache these between visits instead of re-downloading every load.
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${filename}`;
}

// Helper to generate Cloudinary Video URLs — FIXED: removed /v1/
function cloudinaryVideo(filename) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${filename}`;
}

// LOGOS
export const LOGO_LIGHT = cloudinaryImage('logo-light.png'); // For Dark Mode
export const LOGO_DARK = cloudinaryImage('logo-dark.png');   // For Light Mode

// ----- IMAGES -----
export const HERO_IMAGES = [
    'knust-hero.jpg',
    'Legon.jpg',
    'UMAT.jpg',
    'UHAS.jpg',
    'UCC.jpg',
    'UDS.jpg',
    'UOE.jpg',
    'ATU.jpg',
    'UPSA.jpg',
    'PentUNI.jpg',
    'KsTU.png',
    'CU.jpg',
].map(cloudinaryImage);

export const BROWSE_HEADER_IMAGES = [
    'Legon.jpg',
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
].map(cloudinaryImage);

export const GALLERY = [
    {
        label: 'Sneakers in all sizes',
        images: ['Shoe.jpg', 'Shoe2.jpg', 'Shoe3.jpg', 'Shoe4.jpg'].map(cloudinaryImage),
        video: cloudinaryVideo('Sneakers.mp4'),
    },
    {
        label: 'Meet up on campus',
        images: ['MeetOnCampus.jpg', 'MeetOnCampus2.jpg', 'MeetOnCampus3.jpg', 'Memen.jpg'].map(cloudinaryImage),
        video: cloudinaryVideo('Meeting.mp4'),
    },
    {
        label: 'Gadgets, gently used',
        images: ['Gadget.jpg', 'Gadget2.jpg', 'Gadget3.jpg', 'Gadget4.jpg'].map(cloudinaryImage),
        video: cloudinaryVideo('Gadjet.mp4'),
    },
    {
        label: 'Food',
        images: ['Waakye.jpg', 'Waakye2.jpg', 'Waakye3.jpg', 'Fufu.jpg'].map(cloudinaryImage),
        video: cloudinaryVideo('Foodie.mp4'),
    },
];

export const LOGIN_IMAGE = cloudinaryImage('login.jpg');
export const REGISTER_IMAGE = cloudinaryImage('register.jpg');
export const BALANCE_DARK_IMAGE = cloudinaryImage('dark_bala.jpg');
export const BALANCE_LIGHT_IMAGE = cloudinaryImage('light_bala.jpg');

// Additional images used elsewhere
export const SNEAKERS_2 = cloudinaryImage('Sneakers2.jpg');
export const SNEAKERS_4 = cloudinaryImage('Sneakers4.jpg');
export const MEET_ME = cloudinaryImage('meetme.jpg');
export const FO00D = cloudinaryImage('foood.jpg');
export const FAVICON = cloudinaryImage('favicon.svg');
export const ICONS = cloudinaryImage('icons.svg');

// ----- VIDEOS -----
export const CART_VIDEO = cloudinaryVideo('Cart.mp4');
export const DASHBOARD_VIDEO = cloudinaryVideo('Dashboard.mp4');
export const CREATE_LISTING_VIDEO = cloudinaryVideo('create-listing-bg.mp4');
export const FOODIE_VIDEO = cloudinaryVideo('Foodie.mp4');
export const GADJET_VIDEO = cloudinaryVideo('Gadjet.mp4');
export const MEETING_VIDEO = cloudinaryVideo('Meeting.mp4');
export const SETTINGS_VIDEO = cloudinaryVideo('Settings.mp4');
export const SNEAKERS_VIDEO = cloudinaryVideo('Sneakers.mp4');

// Images only — cheap enough to preload/precache in bulk without
// exhausting the browser's connection pool.
export const PRELOAD_ASSETS = [
    ...HERO_IMAGES,
    ...GALLERY.flatMap((g) => g.images),
    LOGIN_IMAGE,
    REGISTER_IMAGE,
    BALANCE_DARK_IMAGE,
    BALANCE_LIGHT_IMAGE,
    SNEAKERS_2,
    SNEAKERS_4,
    MEET_ME,
    FO00D,
    LOGO_LIGHT,
    LOGO_DARK
];

// Videos are intentionally excluded from bulk preloading — each is several
// MB, and fetching 8 of them at once alongside ~28 images blew past the
// browser's per-origin connection limit (net::ERR_INSUFFICIENT_RESOURCES),
// which then surfaced as failed/uncacheable fetches in the service worker
// (workbox "no-response" errors). Videos should load lazily via their own
// <video> tags as they scroll into view instead.
export const PRELOAD_VIDEOS = [
    CART_VIDEO,
    DASHBOARD_VIDEO,
    CREATE_LISTING_VIDEO,
    FOODIE_VIDEO,
    GADJET_VIDEO,
    MEETING_VIDEO,
    SETTINGS_VIDEO,
    SNEAKERS_VIDEO,
];