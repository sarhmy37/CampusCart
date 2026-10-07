import urls from './sanity-urls.json';

function sanityAsset(filename: string): string | undefined {
  const url = (urls as Record<string, string>)[filename];
  return url;
}

function sanityAssetByBase(base: string): string | undefined {
  const key = Object.keys(urls).find((k) => k.replace(/\.[^.]+$/, '') === base);
  return key ? sanityAsset(key) : undefined;
}

const sanityImage = sanityAsset;
const sanityVideo = sanityAsset;

// ---- LOCAL (bundled) campus images ----
const CAMPUS = {
  KNUST:   require('../../assets/campus/knust-hero.jpg'),
  LEGON:   require('../../assets/campus/Legon.jpg'),
  UMAT:    require('../../assets/campus/UMAT.jpg'),
  UHAS:    require('../../assets/campus/UHAS.jpg'),
  UCC:     require('../../assets/campus/UCC.jpg'),
  UDS:     require('../../assets/campus/UDS.jpg'),
  UOE:     require('../../assets/campus/UOE.jpg'),
  ATU:     require('../../assets/campus/ATU.jpg'),
  UPSA:    require('../../assets/campus/UPSA.jpg'),
  PENTUNI: require('../../assets/campus/PentUNI.jpg'),
  KSTU:    require('../../assets/campus/KsTU.png'),
  CU:      require('../../assets/campus/CU.jpg'),
  ASHESI:  require('../../assets/campus/Ashesi.jpg'),
  KTU:     require('../../assets/campus/KTU.jpg'),
  GCTU:    require('../../assets/campus/GCTU.jpg'),
  GIMPA:   require('../../assets/campus/GIMPA.jpg'),
  UENR:    require('../../assets/campus/UENR.jpg'),
};

export const HERO_IMAGES = [
  CAMPUS.KNUST, CAMPUS.LEGON, CAMPUS.UMAT, CAMPUS.UHAS, CAMPUS.UCC, CAMPUS.UDS,
  CAMPUS.UOE, CAMPUS.ATU, CAMPUS.UPSA, CAMPUS.PENTUNI, CAMPUS.KSTU, CAMPUS.CU,
  CAMPUS.ASHESI, CAMPUS.KTU, CAMPUS.GCTU, CAMPUS.GIMPA, CAMPUS.UENR,
];

export const BROWSE_HEADER_IMAGES = [
  CAMPUS.LEGON, CAMPUS.KNUST, CAMPUS.ATU, CAMPUS.UHAS, CAMPUS.UCC, CAMPUS.UDS,
  CAMPUS.UOE, CAMPUS.UPSA, CAMPUS.PENTUNI, CAMPUS.KSTU, CAMPUS.CU, CAMPUS.UMAT,
  CAMPUS.ASHESI, CAMPUS.KTU, CAMPUS.GCTU, CAMPUS.GIMPA, CAMPUS.UENR,
];

// ---- LOCAL (bundled) app images ----
export const LOGO_LIGHT = require('../../assets/hero/logo-light.png');
export const LOGO_DARK = require('../../assets/hero/logo-dark.png');
export const LOGO_PRO = require('../../assets/hero/logo-pro.png');
export const LOGO_PREMIUM = require('../../assets/hero/logo-premium.png');

export const LOGIN_IMAGE = require('../../assets/hero/login.jpg');
export const REGISTER_IMAGE = require('../../assets/hero/register.jpg');
export const BALANCE_DARK_IMAGE = require('../../assets/hero/dark_bala.jpg');
export const BALANCE_LIGHT_IMAGE = require('../../assets/hero/light_bala.jpg');
export const BENEFITS_IMAGE = require('../../assets/hero/benefits.jpg');

export const MTN_LOGO = require('../../assets/hero/mtn.jpg');
export const VODAFONE_LOGO = require('../../assets/hero/voda.png');
export const AIRTELTIGO_LOGO = require('../../assets/hero/airtel.jpg');

// ---- LOCAL (bundled) videos ----
export const CART_VIDEO = require('../../assets/hero/Cart.mp4');
export const DASHBOARD_VIDEO = require('../../assets/hero/Dashboard.mp4');
export const CREATE_LISTING_VIDEO = require('../../assets/hero/create-listing-bg.mp4');
export const SETTINGS_VIDEO = require('../../assets/hero/Settings.mp4');

// ---- LOCAL (bundled) tour images ----
export const TOUR_IMAGES: Record<string, { light: any; dark?: any }> = {
  browse:    { light: require('../../assets/tour/browse.png') },
  chat:      { light: require('../../assets/tour/chat.png') },
  dashboard: { light: require('../../assets/tour/dashboard.png') },
  list:      { light: require('../../assets/tour/list.png') },
  services:  { light: require('../../assets/tour/services.png') },

  // Still to come — uncomment as you drop the PNGs into assets/tour/.
   pay:    { light: require('../../assets/tour/pay.png') }
  // refer:  { light: require('../../assets/tour/refer.png') },
  // payout: { light: require('../../assets/tour/payout.png') },
};

// ---- Sanity (remote) ----
export const GALLERY = [
  {
    label: 'Sneakers in all sizes',
    images: ['Shoe.jpg', 'Shoe2.jpg', 'Shoe3.jpg', 'Shoe4.jpg'].map(sanityImage).filter(Boolean) as string[],
    video: sanityVideo('Sneakers.mp4'),
  },
  {
    label: 'Meet up on campus',
    images: ['MeetOnCampus.jpg', 'MeetOnCampus2.jpg', 'MeetOnCampus3.jpg', 'Memen.jpg'].map(sanityImage).filter(Boolean) as string[],
    video: sanityVideo('Meeting.mp4'),
  },
  {
    label: 'Gadgets, gently used',
    images: ['Gadget.jpg', 'Gadget2.jpg', 'Gadget3.jpg', 'Gadget4.jpg'].map(sanityImage).filter(Boolean) as string[],
    video: sanityVideo('Gadjet.mp4'),
  },
  {
    label: 'Food',
    images: ['Waakye.jpg', 'Waakye2.jpg', 'Waakye3.jpg', 'Fufu.jpg'].map(sanityImage).filter(Boolean) as string[],
    video: sanityVideo('Foodie.mp4'),
  },
];

export const SNEAKERS_2 = sanityImage('Sneakers2.jpg');
export const SNEAKERS_4 = sanityImage('Sneakers4.jpg');
export const MEET_ME = sanityImage('meetme.jpg');
export const FO00D = sanityImage('foood.jpg');

export const FOODIE_VIDEO = sanityVideo('Foodie.mp4');
export const GADJET_VIDEO = sanityVideo('Gadjet.mp4');
export const MEETING_VIDEO = sanityVideo('Meeting.mp4');
export const SNEAKERS_VIDEO = sanityVideo('Sneakers.mp4');