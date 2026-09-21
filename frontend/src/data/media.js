// Central place for all static site imagery/video, now served from Sanity.
// URLs come from sanity-urls.json, which is written by trex-upload/upload.js
// (copy trex-upload/urls.json to src/data/sanity-urls.json after each upload run).
import urls from './sanity-urls.json';

// Exact filename -> Sanity URL. Images get ?auto=format so browsers receive WebP/AVIF.
function sanityAsset(filename) {
    const url = urls[filename];
    if (!url) return undefined;
    return /\.(svg|mp4|webm)$/i.test(filename) ? url : `${url}?auto=format`;
}

// Find a file by name without its extension (used for the tour screenshots,
// which may be .jpg, .jpeg or .png).
function sanityAssetByBase(base) {
    const key = Object.keys(urls).find((k) => k.replace(/\.[^.]+$/, '') === base);
    return key ? sanityAsset(key) : undefined;
}

const sanityImage = sanityAsset;
const sanityVideo = sanityAsset;

// LOGOS
export const LOGO_LIGHT = sanityImage('logo-light.png'); // For Dark Mode
export const LOGO_DARK = sanityImage('logo-dark.png');   // For Light Mode
export const LOGO_PRO = sanityImage('logo-pro.png');
export const LOGO_PREMIUM = sanityImage('logo-premium.png');

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
    'Ashesi.jpg',
    'KTU.jpg',
    'GCTU.jpg',
    'GIMPA.jpg',
    'UENR.jpg',
].map(sanityImage).filter(Boolean);

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
    'Ashesi.jpg',
    'KTU.jpg',
    'GCTU.jpg',
    'GIMPA.jpg',
    'UENR.jpg',
].map(sanityImage).filter(Boolean);

export const GALLERY = [
    {
        label: 'Sneakers in all sizes',
        images: ['Shoe.jpg', 'Shoe2.jpg', 'Shoe3.jpg', 'Shoe4.jpg'].map(sanityImage).filter(Boolean),
        video: sanityVideo('Sneakers.mp4'),
    },
    {
        label: 'Meet up on campus',
        images: ['MeetOnCampus.jpg', 'MeetOnCampus2.jpg', 'MeetOnCampus3.jpg', 'Memen.jpg'].map(sanityImage).filter(Boolean),
        video: sanityVideo('Meeting.mp4'),
    },
    {
        label: 'Gadgets, gently used',
        images: ['Gadget.jpg', 'Gadget2.jpg', 'Gadget3.jpg', 'Gadget4.jpg'].map(sanityImage).filter(Boolean),
        video: sanityVideo('Gadjet.mp4'),
    },
    {
        label: 'Food',
        images: ['Waakye.jpg', 'Waakye2.jpg', 'Waakye3.jpg', 'Fufu.jpg'].map(sanityImage).filter(Boolean),
        video: sanityVideo('Foodie.mp4'),
    },
];

export const LOGIN_IMAGE = sanityImage('login.jpg');
export const REGISTER_IMAGE = sanityImage('register.jpg');
export const LOGIN_FORM_BG_LIGHT = sanityImage('back-f.png');
export const LOGIN_FORM_BG_DARK = sanityImage('back-g.png');
export const BALANCE_DARK_IMAGE = sanityImage('dark_bala.jpg');
export const BALANCE_LIGHT_IMAGE = sanityImage('light_bala.jpg');

// Additional images used elsewhere
export const SNEAKERS_2 = sanityImage('Sneakers2.jpg');
export const SNEAKERS_4 = sanityImage('Sneakers4.jpg');
export const MEET_ME = sanityImage('meetme.jpg');
export const FO00D = sanityImage('foood.jpg');
export const FAVICON = sanityImage('favicon.svg');
export const ICONS = sanityImage('icons.svg');

// ----- ONBOARDING TOUR (light + dark screenshot for each step) -----
// A missing screenshot gives undefined, and the tour then shows the big stamp instead.
const tourShot = (name) => ({
    light: sanityAssetByBase(`${name}-light`),
    dark: sanityAssetByBase(`${name}-dark`),
});

export const TOUR_IMAGES = {
    browse: tourShot('browse'),
    services: tourShot('services'),
    pay: tourShot('pay'),
    refer: tourShot('refer'),
    list: tourShot('list'),
    payout: tourShot('payout'),
    dashboard: tourShot('dashboard'),
    chat: tourShot('chat'),
};

// ----- VIDEOS -----
export const CART_VIDEO = sanityVideo('Cart.mp4');
export const DASHBOARD_VIDEO = sanityVideo('Dashboard.mp4');
export const CREATE_LISTING_VIDEO = sanityVideo('create-listing-bg.mp4');
export const FOODIE_VIDEO = sanityVideo('Foodie.mp4');
export const GADJET_VIDEO = sanityVideo('Gadjet.mp4');
export const MEETING_VIDEO = sanityVideo('Meeting.mp4');
export const SETTINGS_VIDEO = sanityVideo('Settings.mp4');
export const BENEFITS_VIDEO = sanityVideo('bene-vid.mp4');
export const SNEAKERS_VIDEO = sanityVideo('Sneakers.mp4');

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
    LOGO_DARK,
].filter(Boolean);

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
].filter(Boolean);

// Network logos (for Mobile Data picker). The old Cloudinary version trimmed the
// flat-color padding with e_trim; Sanity can't do that, so if a logo looks padded,
// crop that source image once before uploading it.
export const MTN_LOGO = sanityImage('mtn.jpg');
export const VODAFONE_LOGO = sanityImage('voda.png');
export const AIRTELTIGO_LOGO = sanityImage('airtel.jpg');