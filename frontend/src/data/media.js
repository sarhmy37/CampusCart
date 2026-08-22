// Central place for all static site imagery/video, now served from Cloudinary.
// Change CLOUD_NAME if you use a different Cloudinary account.
const CLOUD_NAME = 'b7fch4rp';

// LOGOS (Moved to the TOP so they are defined before PRELOAD_ASSETS)
export const LOGO_LIGHT = cloudinaryImage('logo-light.png'); // For Dark Mode
export const LOGO_DARK = cloudinaryImage('logo-dark.png');   // For Light Mode

// Helper to generate Cloudinary Image URLs (UPDATED TO V2)
function cloudinaryImage(filename) {
    // Using v2 forces Cloudinary to fetch the freshly uploaded file instead of the cached v1
    // Adding ?t=${Date.now()} also forces the browser to ignore its own cache
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v2/${filename}?t=${Date.now()}`;
}

// Helper to generate Cloudinary Video URLs
function cloudinaryVideo(filename) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/v1/${filename}`;
}

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
    LOGO_LIGHT,
    LOGO_DARK   
];