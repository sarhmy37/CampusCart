const multer = require('multer');

const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
};

const uploadAvatar = multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadProductImages = multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});

// Combined uploader for the listing form: up to 6 images + 1 optional video,
// in the same multipart request. Multer only supports one fileSize limit per
// instance, so it's set to the video's ceiling (20MB) here — image size is
// re-checked manually in the route handler so images still can't exceed 5MB.
const productMediaFilter = (req, file, cb) => {
    if (file.fieldname === 'video') {
        if (file.mimetype.startsWith('video/')) return cb(null, true);
        return cb(new Error('Video must be a valid video file'));
    }
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
};

const uploadProductMedia = multer({
    storage: multer.memoryStorage(),
    fileFilter: productMediaFilter,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB ceiling (applies to video; images re-checked below)
}).fields([
    { name: 'images', maxCount: 6 },
    { name: 'video', maxCount: 1 },
]);

const chatMediaFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
        return cb(null, true);
    }
    cb(new Error('Only image or audio files are allowed'));
};

const uploadChatMedia = multer({
    storage: multer.memoryStorage(),
    fileFilter: chatMediaFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — covers a comfortably long voice note
});

// Chat wallpapers are always images (never audio), so this uses the same
// imageFilter as avatars/product photos rather than the looser chatMediaFilter.
const uploadWallpaper = multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = { uploadAvatar, uploadProductImages, uploadProductMedia, uploadChatMedia, uploadWallpaper };