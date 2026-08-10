const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

function makeStorage(subfolder) {
    return multer.diskStorage({
        destination: path.join(__dirname, '..', '..', 'uploads', subfolder),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const uniqueName = crypto.randomBytes(16).toString('hex') + ext;
            cb(null, uniqueName);
        },
    });
}

const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
};

const uploadAvatar = multer({
    storage: makeStorage('avatars'),
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadProductImages = multer({
    storage: makeStorage('products'),
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = { uploadAvatar, uploadProductImages };
