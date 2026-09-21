// Central place for all static site imagery/video.
// Each file uses its Sanity URL when it has been uploaded (sanity-urls.json, written by
// trex-upload/upload.js). If a file isn't in there yet, it falls back to the old Cloudinary
// URL, which still serves the files that were uploaded before the account was deactivated.
import urls from './sanity-urls.json';

const CLOUD_NAME = 'b7fch4rp';

const cloudinaryImage = (path) => `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${path}`;
const cloudinaryVideo = (path) => `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${path}`;

// Sanity first, Cloudinary as the fallback.
function sanityImage(filename) {
    const url = urls[filename];
    if (!url) return cloudinaryImage(filename);
    return /\.svg$/i.test(filename) ? url : `${url}?auto=format`;
}

function sanityVideo(filename) {
    return urls[filename] || cloudinaryVideo(filename);
}

// Tour screenshots may be .jpg, .jpeg or .png, so match by name without the extension.
// Not in Sanity yet -> old Cloudinary path. If neither has it, the tour shows the big stamp.
function tourImage(base) {
    const key = Object.keys(urls).find((k) => k.replace(/\.[^.]+$/, '') === base);
    if (key) return `${urls[key]}?auto=format`;
    return cloudinaryImage(`f_auto,q_auto/${base}`);
}

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
].map(sanityImage);

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
].map(sanityImage);

export const GALLERY = [
    {
        label: 'Sneakers in all sizes',
        images: ['Shoe.jpg', 'Shoe2.jpg', 'Shoe3.jpg', 'Shoe4.jpg'].map(sanityImage),
        video: sanityVideo('Sneakers.mp4'),
    },
    {
        label: 'Meet up on campus',
        images: ['MeetOnCampus.jpg', 'MeetOnCampus2.jpg', 'MeetOnCampus3.jpg', 'Memen.jpg'].map(sanityImage),
        video: sanityVideo('Meeting.mp4'),
    },
    {
        label: 'Gadgets, gently used',
        images: ['Gadget.jpg', 'Gadget2.jpg', 'Gadget3.jpg', 'Gadget4.jpg'].map(sanityImage),
        video: sanityVideo('Gadjet.mp4'),
    },
    {
        label: 'Food',
        images: ['Waakye.jpg', 'Waakye2.jpg', 'Waakye3.jpg', 'Fufu.jpg'].map(sanityImage),
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
const tourShot = (name) => ({
    light: tourImage(`${name}-light`),
    dark: tourImage(`${name}-dark`),
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

// Network logos (for Mobile Data picker). Sanity has no e_trim, so once these are in
// Sanity, crop any padded logo in the source file. Until then the Cloudinary fallback
// keeps the trim.
function networkLogo(filename) {
    return urls[filename] ? `${urls[filename]}?auto=format` : cloudinaryImage(`e_trim:10/${filename}`);
}

export const MTN_LOGO = networkLogo('mtn.jpg');
export const VODAFONE_LOGO = networkLogo('voda.png');
export const AIRTELTIGO_LOGO = networkLogo('airtel.jpg');